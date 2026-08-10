#!/usr/bin/env python3
"""Smoke-test the cinematic splash + boot-load sequence in a PTY."""
from __future__ import annotations

import fcntl
import importlib.machinery
import importlib.util
import json
import os
import pty
import re
import select
import struct
import sys
import tempfile
import termios
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "bin" / "gcoolers"
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")


class SplashTests(unittest.TestCase):
    def test_splash_and_boot_load_emit_markers(self) -> None:
        driver = tempfile.NamedTemporaryFile("w", suffix=".py", delete=False)
        state = Path(tempfile.mkdtemp()) / "state.json"
        state.write_text(
            json.dumps(
                {
                    "daemon": True,
                    "ts": time.time(),
                    "cpu_f": 118.5,
                    "peak_f": 122.0,
                    "gpu_f": 110.0,
                    "profile": "balanced",
                }
            )
        )
        driver.write(
            f"""
import importlib.machinery, importlib.util, time, os, sys
from pathlib import Path
os.environ["TERM"] = "xterm-256color"
os.environ["COLUMNS"] = "100"
os.environ["LINES"] = "36"
path = Path({str(SCRIPT)!r})
loader = importlib.machinery.SourceFileLoader("gcoolers_splash_ut", str(path))
spec = importlib.util.spec_from_loader(loader.name, loader)
mod = importlib.util.module_from_spec(spec)
loader.exec_module(mod)
mod.STATE_PATH = Path({str(state)!r})
mod.detect_silicon = lambda: "Apple M-series (test)"
mod.ensure_daemon = lambda profile=None: None
mod.daemon_running = lambda: True
def fast_nap(secs, scale=True):
    if mod._splash_skip_pending():
        raise mod._SplashSkip
    time.sleep(0.004)
mod._splash_nap = fast_nap
mod.gcool_splash("balanced", first_run=False)
mod.gcool_boot_load("balanced")
sys.stdout.write("\\n__SPLASH_DONE__\\n")
sys.stdout.flush()
"""
        )
        driver.close()

        pid, fd = pty.fork()
        if pid == 0:
            os.environ["TERM"] = "xterm-256color"
            os.environ["COLUMNS"] = "100"
            os.environ["LINES"] = "36"
            os.execv(sys.executable, [sys.executable, driver.name])

        fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 36, 100, 0, 0))
        buf = b""
        deadline = time.time() + 20
        while time.time() < deadline:
            r, _, _ = select.select([fd], [], [], 0.2)
            if r:
                try:
                    chunk = os.read(fd, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                buf += chunk
                if b"__SPLASH_DONE__" in buf:
                    break
            try:
                wpid, _ = os.waitpid(pid, os.WNOHANG)
                if wpid:
                    while select.select([fd], [], [], 0.05)[0]:
                        try:
                            buf += os.read(fd, 65536)
                        except OSError:
                            break
                    break
            except ChildProcessError:
                break
        try:
            os.close(fd)
        except OSError:
            pass
        os.unlink(driver.name)

        plain = ANSI.sub("", buf.decode("utf-8", "replace")).replace("\r", "\n")
        self.assertNotIn("Traceback", plain)
        for marker in (
            "GCOOLERS",
            "G C O O L E R S",
            "BOOT SEQUENCE",
            "FROST LOCK",
            "THERMAL CORE ONLINE",
            "BOOT PATH CLEAR",
            "SYSTEM START",
            "SYSTEM NOMINAL",
            "__SPLASH_DONE__",
        ):
            self.assertIn(marker, plain, msg=f"missing {marker}")


if __name__ == "__main__":
    unittest.main()
