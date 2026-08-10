#!/usr/bin/env python3
"""Regression tests for the failure mode where the daemon never runs or never cools.

Run: python3 -m unittest discover -s tests
"""
from __future__ import annotations

import contextlib
import importlib.util
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "bin" / "gcoolers"


def load_gcoolers():
    """Import bin/gcoolers as a module without running its CLI entry point."""
    spec = importlib.util.spec_from_loader(
        "gcoolers_under_test", importlib.machinery.SourceFileLoader("gcoolers_under_test", str(SCRIPT))
    )
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


gc = load_gcoolers()


class TestLaunchAgentPath(unittest.TestCase):
    """launchd has no TCC grant for Desktop/Documents/Downloads/iCloud.

    A plist pointing into one of those folders makes python exit 2 on every launch, so the
    agent crash-loops and fans are never driven at all.
    """

    def test_tcc_roots_are_detected(self) -> None:
        home = Path.home()
        for protected in ("Desktop/proj/bin/gcoolers", "Documents/x", "Downloads/y"):
            self.assertTrue(gc.under_tcc(home / protected), protected)
        self.assertFalse(gc.under_tcc(home / "bin" / "gcoolers"))
        self.assertFalse(gc.under_tcc(Path("/opt/homebrew/bin/gcoolers")))

    def test_daemon_bin_stages_out_of_protected_folder(self) -> None:
        with _fake_protected_checkout() as (checkout, staged, root):
            with _patched(gc, GCOOL_BIN=checkout, DAEMON_BIN=staged, TCC_ROOTS=(root,)):
                self.assertEqual(gc.daemon_bin(), staged)
            self.assertTrue(staged.is_file())
            self.assertEqual(staged.read_bytes(), SCRIPT.read_bytes())

    def test_daemon_bin_reuses_a_staged_copy_when_staging_fails(self) -> None:
        with _fake_protected_checkout() as (checkout, staged, root):
            staged.parent.mkdir(parents=True, exist_ok=True)
            staged.write_text("#!/bin/sh\n")
            staged.chmod(0o755)
            checkout.unlink()  # unreadable source, e.g. TCC denial mid-flight
            with _patched(gc, GCOOL_BIN=checkout, DAEMON_BIN=staged, TCC_ROOTS=(root,)):
                self.assertEqual(gc.daemon_bin(), staged)

    def test_daemon_bin_leaves_safe_paths_alone(self) -> None:
        safe = Path("/opt/homebrew/bin/gcoolers")
        with _patched(gc, GCOOL_BIN=safe):
            self.assertEqual(gc.daemon_bin(), safe)

    def test_plist_program_is_never_tcc_protected(self) -> None:
        with _fake_protected_checkout() as (checkout, staged, root):
            with _patched(gc, GCOOL_BIN=checkout, DAEMON_BIN=staged, TCC_ROOTS=(root,)):
                plist = gc.launch_agent_plist()
                self.assertFalse(gc.under_tcc(gc.daemon_bin()))
            self.assertIn(str(staged), plist)
            self.assertNotIn(str(checkout), plist)

    def test_agent_program_reads_back_the_plist(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            agent = Path(tmp) / "com.gcoolers.daemon.plist"
            staged = Path(tmp) / "gcoolers"
            with _patched(gc, GCOOL_BIN=staged, LAUNCH_AGENT=agent):
                agent.write_text(gc.launch_agent_plist())
                self.assertEqual(gc.agent_program(), staged)


class TestCapRelease(unittest.TestCase):
    """A comfort cap must never win over thermal safety."""

    MAX_AT = 142.0
    CAP = 0.42

    def test_cap_holds_while_cool(self) -> None:
        for peak in (100.0, 125.0, self.MAX_AT - gc.CAP_RELEASE_SPAN):
            pct, released = gc.release_cap(self.CAP, peak, self.MAX_AT)
            self.assertAlmostEqual(pct, self.CAP)
            self.assertFalse(released)

    def test_cap_is_gone_at_and_above_the_ceiling(self) -> None:
        for peak in (self.MAX_AT, self.MAX_AT + 20):
            pct, released = gc.release_cap(self.CAP, peak, self.MAX_AT)
            self.assertAlmostEqual(pct, 1.0)
            self.assertTrue(released)

    def test_release_is_monotonic(self) -> None:
        last = 0.0
        for peak in range(100, 170):
            pct, _ = gc.release_cap(self.CAP, float(peak), self.MAX_AT)
            self.assertGreaterEqual(pct + 1e-9, last)
            last = pct

    def test_uncapped_stays_uncapped(self) -> None:
        self.assertEqual(gc.release_cap(1.0, 200.0, self.MAX_AT), (1.0, False))


class TestMeetingHints(unittest.TestCase):
    """A bare string needle iterates as characters and matches nearly every process."""

    def test_needles_are_tuples_of_nonempty_strings(self) -> None:
        for label, needles, mode in gc.MEETING_PROCESS_HINTS:
            self.assertIsInstance(needles, tuple, f"{label} needles must be a tuple")
            for needle in needles:
                self.assertIsInstance(needle, str)
                self.assertGreater(len(needle), 2, f"{label}: needle {needle!r} is too short")
            self.assertIn(mode, ("any", "busy", "discord"))

    def test_open_app_without_the_mic_is_not_a_call(self) -> None:
        with _patched(
            gc,
            mic_owners=lambda *a, **k: (set(), True),
            load_config=lambda: {"auto_meeting": True},
            _process_cpu_map=lambda: {"Discord Helper (Renderer)": 40.0, "Slack": 30.0},
        ):
            self.assertEqual(gc.detect_meeting_app({}), (False, None))

    def test_app_holding_the_mic_is_a_call(self) -> None:
        with _patched(
            gc,
            mic_owners=lambda *a, **k: ({"Discord"}, True),
            load_config=lambda: {"auto_meeting": True},
            _process_cpu_map=lambda: {},
        ):
            self.assertEqual(gc.detect_meeting_app({}), (True, "Discord"))

    def test_cpu_heuristics_still_apply_when_mic_state_is_unknown(self) -> None:
        with _patched(
            gc,
            mic_owners=lambda *a, **k: (set(), False),
            load_config=lambda: {"auto_meeting": True},
            _process_cpu_map=lambda: {"zoom.us": 12.0},
        ):
            self.assertEqual(gc.detect_meeting_app({}), (True, "Zoom"))


@contextlib.contextmanager
def _fake_protected_checkout():
    """A real copy of the script inside a directory treated as TCC-protected."""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "Desktop"
        checkout = root / "gcoolers-app" / "bin" / "gcoolers"
        checkout.parent.mkdir(parents=True)
        shutil.copy2(SCRIPT, checkout)
        staged = Path(tmp) / "bin" / "gcoolers"
        yield checkout, staged, root


class _patched:
    """Swap module attributes for the duration of a block."""

    def __init__(self, module, **attrs) -> None:
        self.module = module
        self.attrs = attrs
        self.saved: dict[str, object] = {}

    def __enter__(self):
        for name, value in self.attrs.items():
            self.saved[name] = getattr(self.module, name)
            setattr(self.module, name, value)
        return self.module

    def __exit__(self, *exc) -> None:
        for name, value in self.saved.items():
            setattr(self.module, name, value)


if __name__ == "__main__":
    unittest.main()
