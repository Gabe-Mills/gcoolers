#!/usr/bin/env python3
"""Regression tests for the live dashboard renderer.

The viewer draws a fixed-width bordered panel from `state.json`, a file it reads but
does not own. Every test here guards one of two invariants:

1. Geometry — a frame is always a perfect rectangle, at every terminal width.
2. Containment — no value from state can crash the renderer or reach the terminal
   as a control sequence.

Run: python3 -m unittest discover -s tests
"""
from __future__ import annotations

import importlib.machinery
import importlib.util
import json
import math
import os
import re
import shutil
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "bin" / "gcoolers"
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")

# Terminal widths worth covering: below the panel floor, the clamp points, and wide.
WIDTHS = (50, 56, 66, 84, 120, 140)


def load_gcoolers(name: str, *, truecolor: bool):
    """Import bin/gcoolers under a given color capability without running its CLI."""
    previous = os.environ.get("COLORTERM")
    os.environ["COLORTERM"] = "truecolor" if truecolor else ""
    try:
        loader = importlib.machinery.SourceFileLoader(name, str(SCRIPT))
        spec = importlib.util.spec_from_loader(name, loader)
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        sys.modules[name] = mod
        spec.loader.exec_module(mod)
        return mod
    finally:
        if previous is None:
            os.environ.pop("COLORTERM", None)
        else:
            os.environ["COLORTERM"] = previous


gc = load_gcoolers("gcoolers_render_tc", truecolor=True)
gc_basic = load_gcoolers("gcoolers_render_basic", truecolor=False)

CPU_HIST = [138 + 16 * math.sin(i / 11.0) + 5 * math.sin(i / 2.7) for i in range(140)]
GPU_HIST = [124 + 7 * math.sin(i / 17.0 + 2) for i in range(140)]

NOMINAL = {
    "cpu_f": 143.8, "gpu_f": 119.2, "peak_f": 152.0, "avg_f": 141.0, "driver": "CPU",
    "profile": "balanced", "pct": 0.43, "bias": 0.10, "zone": "43%", "load": "cpu",
    "why": "Discord call - CPU 141 to 43 pct", "next_check_s": 10, "daemon": True,
}


def plain(line: str) -> str:
    return ANSI.sub("", line)


def frame_widths(mod, state, hist_cpu, hist_gpu, cols, help_on=False):
    return {len(plain(ln)) for ln in mod.viewer_frame(state, hist_cpu, hist_gpu, cols, help_on)}


class TestFrameGeometry(unittest.TestCase):
    """A ragged frame means a broken border, which is the most visible failure."""

    def test_frame_is_rectangular_across_states_and_widths(self):
        states = {
            "nominal": {**NOMINAL, "ts": time.time()},
            "no readings": {"profile": "balanced", "ts": time.time()},
            "paused": {**NOMINAL, "paused": True, "ts": time.time()},
            "ice boost": {**NOMINAL, "boost_until": time.time() + 30, "ts": time.time()},
            "forced max": {**NOMINAL, "force": "max", "pct": 1.0, "ts": time.time()},
            "no why": {**NOMINAL, "why": "", "ts": time.time()},
            "overlong why": {**NOMINAL, "why": "x" * 400, "ts": time.time()},
            "stale daemon": {**NOMINAL, "daemon": False, "ts": time.time() - 600},
            "empty": {},
        }
        for label, state in states.items():
            for cols in WIDTHS:
                for help_on in (False, True):
                    for hist in ([], CPU_HIST):
                        with self.subTest(state=label, cols=cols, help=help_on, hist=len(hist)):
                            widths = frame_widths(gc, state, hist, hist, cols, help_on)
                            self.assertEqual(len(widths), 1, f"ragged frame: {sorted(widths)}")

    def test_frame_never_exceeds_terminal_width(self):
        state = {**NOMINAL, "ts": time.time()}
        for cols in WIDTHS:
            with self.subTest(cols=cols):
                widest = max(frame_widths(gc, state, CPU_HIST, GPU_HIST, cols))
                # The panel has a hard floor, so narrow terminals clamp rather than shrink.
                self.assertLessEqual(widest, max(56, cols))

    def test_key_hints_survive_every_width(self):
        state = {**NOMINAL, "ts": time.time()}
        for cols in WIDTHS:
            for help_on in (False, True):
                with self.subTest(cols=cols, help=help_on):
                    footer = plain(gc.viewer_frame(state, CPU_HIST, GPU_HIST, cols, help_on)[-1])
                    self.assertIn("boost", footer)
                    self.assertIn("Q", footer)


class TestMalformedState(unittest.TestCase):
    """state.json can be truncated, stale, or written by an older build."""

    CASES = {
        "nan": {"cpu_f": float("nan"), "gpu_f": float("nan"), "pct": float("nan")},
        "inf": {"cpu_f": float("inf"), "gpu_f": float("-inf"), "pct": float("inf")},
        "negative": {"cpu_f": -50, "gpu_f": -50, "peak_f": -1, "pct": -2.0, "bias": -50},
        "absurd": {"cpu_f": 1e9, "gpu_f": 1e9, "peak_f": 1e9, "pct": 1e9, "bias": 1e9,
                   "next_check_s": 1e12, "boost_until": 1e18},
        "wrong types": {"cpu_f": "hot", "gpu_f": [], "pct": None, "bias": {}, "zone": 5,
                        "profile": 7, "why": 42, "ts": "x", "boost_until": "soon"},
        "unicode why": {"cpu_f": 140, "why": "日本語 ✦ emoji 🔥 test"},
    }
    SERIES = ([], CPU_HIST, [float("nan")] * 10, [1e9] * 10, [float("inf")] * 5, [0.0] * 10)

    def test_render_survives_malformed_values(self):
        for label, state in self.CASES.items():
            for cols in WIDTHS:
                for series in self.SERIES:
                    with self.subTest(state=label, cols=cols, series=len(series)):
                        widths = frame_widths(gc, {**state, "ts": time.time()}, series, series, cols)
                        self.assertEqual(len(widths), 1, f"ragged frame: {sorted(widths)}")

    def test_absurd_values_are_suppressed_not_printed(self):
        body = plain("".join(gc.viewer_frame(self.CASES["absurd"], [], [], 84, False)))
        self.assertNotIn("1000000000", body)

    def test_missing_sensors_render_as_dash(self):
        body = plain("".join(gc.viewer_frame({"profile": "balanced"}, [], [], 84, False)))
        self.assertIn("—", body)
        # A daemon that stopped mid-write leaves no cpu_f; showing 0.0°F would be a lie.
        self.assertNotIn("0.0°F", body)


class TestTerminalInjection(unittest.TestCase):
    """No state field may smuggle escape sequences onto the user's terminal."""

    PAYLOAD = "\x1b[2J\x1b]0;pwned\x07\x1b[31mX\x07\x08\r\n\x9b6n"
    FIELDS = ("cpu_f", "gpu_f", "peak_f", "avg_f", "profile", "pct", "bias", "why",
              "next_check_s", "paused", "boost_until", "force", "daemon", "ts",
              "driver", "zone", "load", "mode", "heat_proc", "schedule")

    def test_no_field_crashes_or_leaks_control_sequences(self):
        for field in self.FIELDS:
            with self.subTest(field=field):
                state = {"cpu_f": 140, "gpu_f": 120, "ts": time.time(), "daemon": True,
                         field: self.PAYLOAD}
                body = "".join(gc.viewer_frame(state, [130.0] * 20, [120.0] * 20, 84, False))
                # Strip the renderer's own SGR colors; anything left came from the payload.
                residue = re.sub(r"\x1b\[[0-9;]*m", "", body)
                for ctrl in ("\x1b", "\x07", "\x08", "\x9b", "\r"):
                    self.assertNotIn(ctrl, residue, f"{field} leaked {ctrl!r}")

    def test_cooling_state_words_survives_junk(self):
        for junk in (self.PAYLOAD, None, [], {}, "NaN"):
            with self.subTest(junk=type(junk).__name__):
                self.assertIsNotNone(
                    gc.cooling_state_words({"boost_until": junk, "zone": junk, "load": junk})
                )

    def test_safe_terminal_text_strips_escapes(self):
        self.assertNotIn("\x1b", gc.safe_terminal_text("\x1b[31mred\x1b[0m"))


class TestRenderHelpers(unittest.TestCase):
    def test_visible_width_ignores_ansi(self):
        self.assertEqual(gc.visible_width(f"{gc.BOLD}{gc.CYAN}abc{gc.RESET}"), 3)

    def test_pad_to_pads_by_visible_width(self):
        self.assertEqual(gc.visible_width(gc.pad_to(f"{gc.DIM}ab{gc.RESET}", 10)), 10)

    def test_grad_bar_width_is_exact_and_clamped(self):
        for ratio in (-1.0, 0.0, 0.5, 1.0, 5.0):
            with self.subTest(ratio=ratio):
                self.assertEqual(gc.visible_width(gc.grad_bar(ratio, 16)), 16)

    def test_braille_area_shape(self):
        for height in (1, 2, 4):
            rows = gc.braille_area(CPU_HIST, 30, height, 100, 160)
            self.assertEqual(len(rows), height)
            for row in rows:
                self.assertEqual(gc.visible_width(row), 30)

    def test_braille_area_degenerate_inputs(self):
        for series in ([], [130.0] * 50, [float("nan")] * 5):
            with self.subTest(series=len(series)):
                # A flat series makes lo == hi; the span guard must avoid a zero divide.
                rows = gc.braille_area(series, 20, 2, 130.0, 130.0)
                self.assertTrue(all(gc.visible_width(r) == 20 for r in rows))

    def test_heat_gradient_is_clamped_and_monotonic(self):
        self.assertEqual(gc.heat_rgb(-5.0), gc._HEAT_STOPS[0][1])
        self.assertEqual(gc.heat_rgb(9.0), gc._HEAT_STOPS[-1][1])
        self.assertLess(gc.heat_rgb(0.0)[0], gc.heat_rgb(0.5)[0])
        self.assertLess(gc.heat_rgb(0.5)[0], gc.heat_rgb(1.0)[0])

    def test_temp_norm_clamped(self):
        self.assertEqual(gc.temp_norm(-40), 0.0)
        self.assertEqual(gc.temp_norm(999), 1.0)

    def test_reading_rejects_implausible_values(self):
        for bad in (0, None, "x", -40, 1e9, float("nan")):
            with self.subTest(value=bad):
                self.assertIsNone(gc._reading(bad))
        self.assertEqual(gc._reading(140.0), 140.0)

    def test_clamp_bounds_and_junk(self):
        self.assertEqual(gc._clamp("x", 0, 1), 0)
        self.assertEqual(gc._clamp(float("nan"), 0, 1), 0)
        self.assertEqual(gc._clamp(None, 0, 1), 0)
        self.assertEqual(gc._clamp(-5, 0, 1), 0)
        self.assertEqual(gc._clamp(99, 0, 1), 1)
        self.assertEqual(gc._clamp(0.5, 0, 1), 0.5)

    def test_thermal_band_glyphs_are_single_width(self):
        # A double-width glyph silently shifts every column to its right.
        for temp in (0, 100, 135, 150, 170):
            with self.subTest(temp=temp):
                self.assertEqual(len(gc.thermal_band(temp)[2]), 1)


class TestColorFallback(unittest.TestCase):
    """Terminals without COLORTERM must still get a correct, if plainer, panel."""

    def test_truecolor_disabled_without_colorterm(self):
        self.assertFalse(gc_basic.TRUECOLOR)

    def test_no_24bit_escapes_emitted(self):
        body = "".join(gc_basic.viewer_frame({**NOMINAL, "ts": time.time()},
                                             CPU_HIST, GPU_HIST, 84, False))
        self.assertNotIn("38;2;", body)

    def test_fallback_frames_still_rectangular(self):
        for cols in WIDTHS:
            with self.subTest(cols=cols):
                widths = frame_widths(gc_basic, {**NOMINAL, "ts": time.time()},
                                      CPU_HIST, GPU_HIST, cols)
                self.assertEqual(len(widths), 1)


class TestStateIO(unittest.TestCase):
    """load_json caches on stat; save_json must stay correct and self-healing."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_cache_invalidates_when_file_changes(self):
        path = self.tmp / "s.json"
        path.write_text(json.dumps({"a": 1}))
        self.assertEqual(gc.load_json(path, {}), {"a": 1})
        time.sleep(0.01)
        path.write_text(json.dumps({"a": 2}))
        self.assertEqual(gc.load_json(path, {}), {"a": 2})

    def test_cached_reads_return_independent_objects(self):
        path = self.tmp / "s.json"
        path.write_text(json.dumps({"a": 2, "nested": {"k": 1}}))
        first = gc.load_json(path, {})
        first["a"] = 999
        first["nested"]["k"] = 999
        self.assertEqual(gc.load_json(path, {})["a"], 2)
        self.assertEqual(gc.load_json(path, {})["nested"]["k"], 1)

    def test_missing_and_corrupt_files_fall_back_to_default(self):
        self.assertEqual(gc.load_json(self.tmp / "nope.json", {"d": 1}), {"d": 1})
        bad = self.tmp / "bad.json"
        bad.write_text("{not json")
        self.assertEqual(gc.load_json(bad, {"d": 1}), {"d": 1})

    def test_save_json_recovers_if_support_dir_disappears(self):
        # ensure_dirs() only runs once per process, so a deleted support dir would
        # otherwise break every subsequent write for the life of the daemon.
        support = self.tmp / "support"
        with _patched(gc, SUPPORT=support, LOG_PATH=support / "l.log",
                      migrate_from_gcool=lambda: None, _DIRS_READY=False):
            target = support / "state.json"
            gc.save_json(target, {"a": 1})
            shutil.rmtree(support)
            gc.save_json(target, {"a": 2})
            self.assertEqual(json.loads(target.read_text()), {"a": 2})


class TestDenseDashboard(unittest.TestCase):
    """v3.04 layout: no blank filler, capped width, 2-row history, ready gate."""

    def test_no_blank_filler_rows_on_tall_terminals(self):
        state = {**NOMINAL, "ts": time.time()}
        lines = gc.viewer_frame(state, CPU_HIST, GPU_HIST, 120, False, rows=60)
        plains = [plain(ln) for ln in lines]
        # Strip box-drawing / spaces — a filler row is empty of content.
        empties = [p for p in plains if not p.strip(" │╭╮╯╰├┤─═╔╗╚╝")]
        self.assertEqual(empties, [], f"blank filler rows: {empties!r}")
        self.assertLessEqual(len(lines), 18)

    def test_history_is_two_rows_per_sensor(self):
        state = {**NOMINAL, "ts": time.time()}
        body = "\n".join(plain(ln) for ln in gc.viewer_frame(state, CPU_HIST, GPU_HIST, 100, False))
        self.assertIn("HISTORY", body)
        # Label + temp on the spark header row.
        self.assertRegex(body, r"CPU\s+14[0-9]\.\d°")
        self.assertRegex(body, r"GPU\s+11[0-9]\.\d°")

    def test_panel_width_capped_on_ultrawide(self):
        state = {**NOMINAL, "ts": time.time()}
        widest = max(len(plain(ln)) for ln in gc.viewer_frame(state, CPU_HIST, GPU_HIST, 200, False))
        # box max 100 → painted line ≤ 102
        self.assertLessEqual(widest, 102)

    def test_host_lives_in_header_not_avg_row(self):
        state = {**NOMINAL, "ts": time.time()}
        lines = [plain(ln) for ln in gc.viewer_frame(state, CPU_HIST, GPU_HIST, 100, False)]
        self.assertTrue(any("GCOOLERS" in ln and "GOVERNING" in ln for ln in lines))
        avg = next(ln for ln in lines if "AVG" in ln and "PEAK" in ln)
        self.assertNotIn("HOST", avg)

    def test_governor_ready_requires_daemon_fresh_temps(self):
        now = time.time()
        self.assertFalse(gc.governor_ready({}))
        self.assertFalse(gc.governor_ready({"daemon": True, "ts": now}))
        self.assertFalse(gc.governor_ready({"daemon": True, "ts": now - 60, "cpu_f": 120}))
        self.assertTrue(gc.governor_ready({"daemon": True, "ts": now, "cpu_f": 120.0}))
        self.assertTrue(gc.governor_ready({"daemon": True, "ts": now, "peak_f": 125.0}))

    def test_hist_bounds_span_and_sanitize(self):
        lo, hi = gc._hist_bounds([130.0, 131.0])
        self.assertGreaterEqual(hi - lo, 14.0)
        lo, hi = gc._hist_bounds([])
        self.assertEqual((lo, hi), (100.0, 150.0))

    def test_cached_host_is_stable_and_short(self):
        a = gc.cached_host(12)
        b = gc.cached_host(12)
        self.assertEqual(a, b)
        self.assertLessEqual(len(a), 12)


class TestSmartEfficiency(unittest.TestCase):
    """Parsed JSON cache, history seed, adaptive refresh."""

    def test_load_json_cache_returns_independent_copies(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "s.json"
            path.write_text('{"a": 1, "nested": {"x": 2}}\n')
            gc._JSON_CACHE.clear()
            a = gc.load_json(path, {})
            b = gc.load_json(path, {})
            self.assertEqual(a, b)
            a["a"] = 99
            self.assertEqual(b["a"], 1)
            # Second load must be a cache hit (same mtime) and still isolated.
            c = gc.load_json(path, {})
            self.assertEqual(c["a"], 1)

    def test_seed_viewer_history_reads_cpu_gpu_samples(self):
        from collections import deque
        with tempfile.TemporaryDirectory() as tmp:
            hist = Path(tmp) / "history.json"
            now = time.time()
            hist.write_text(json.dumps({
                "samples": [
                    {"t": now - 10, "cpu": 130.0, "gpu": 110.0},
                    {"t": now - 5, "cpu": 140.0, "gpu": 115.0},
                    {"t": now - 1, "cpu": "bad", "gpu": 120.0},
                    {"t": now - 3600, "cpu": 99.0, "gpu": 99.0},  # too old — erased
                ],
                "events": [],
            }))
            cpu: deque = deque(maxlen=40)
            gpu: deque = deque(maxlen=40)
            with _patched(gc, HISTORY_PATH=hist):
                gc.seed_viewer_history(cpu, gpu)
            self.assertEqual(list(cpu), [130.0, 140.0])
            self.assertEqual(list(gpu), [110.0, 115.0, 120.0])
            self.assertNotIn(99.0, cpu)

    def test_spark_series_scrolls_old_points_off(self):
        long = list(range(200))
        clipped = gc.spark_series(long, width=30)
        self.assertLessEqual(len(clipped), 60)
        self.assertEqual(clipped[-1], 199)
        self.assertEqual(clipped[0], 200 - len(clipped))

    def test_trim_viewer_history_caps_length(self):
        from collections import deque
        cpu: deque = deque(range(100), maxlen=200)
        gpu: deque = deque(range(100), maxlen=200)
        gc.trim_viewer_history(cpu, gpu, keep=40)
        self.assertEqual(len(cpu), 40)
        self.assertEqual(len(gpu), 40)
        self.assertEqual(cpu[0], 60)

    def test_viewer_sleep_faster_when_hot(self):
        calm = gc.viewer_sleep_s({"zone": "AUTO", "pct": 0.0, "peak_f": 120}, False)
        hot = gc.viewer_sleep_s({"zone": "89%", "pct": 0.89, "peak_f": 150}, True)
        self.assertGreater(calm, hot)
        self.assertLessEqual(hot, 0.2)


class _patched:
    """Temporarily swap module attributes, restoring them afterwards."""

    def __init__(self, mod, **attrs):
        self.mod, self.attrs = mod, attrs
        self.saved: dict[str, object] = {}

    def __enter__(self):
        for key, value in self.attrs.items():
            self.saved[key] = getattr(self.mod, key)
            setattr(self.mod, key, value)
        return self.mod

    def __exit__(self, *_exc):
        for key, value in self.saved.items():
            setattr(self.mod, key, value)
        self.mod._DIRS_READY = False
        return False


if __name__ == "__main__":
    unittest.main()
