#!/usr/bin/env python3
"""Capture actual screens from a fresh isolated Android emulator."""
from __future__ import annotations

import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

APP = "com.hebi96.pushOffice_app"
OUT = Path("ui-captures")
OUT.mkdir(exist_ok=True)
REPORT: list[dict[str, str]] = []


def adb(*args: str, timeout: int = 45) -> bytes:
    return subprocess.run(["adb", *args], check=True, capture_output=True, timeout=timeout).stdout


def screenshot(name: str, note: str) -> None:
    raw = adb("exec-out", "screencap", "-p")
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"{name}: emulator did not return a PNG")
    path = OUT / f"{name}.png"
    path.write_bytes(raw)
    REPORT.append({"file": path.name, "expected": note})
    print(f"Captured {path} ({len(raw)} bytes)")


def find(label: str, bottom: bool = False) -> tuple[int, int] | None:
    try:
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=45)
        content = adb("exec-out", "cat", "/sdcard/ui.xml")
        root = ET.fromstring(content.decode("utf-8", errors="replace"))
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ET.ParseError):
        return None
    matches = []
    for node in root.iter("node"):
        text = node.get("text", "")
        desc = node.get("content-desc", "")
        if label not in text and label not in desc:
            continue
        bounds = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
        if bounds is None:
            continue
        x1, y1, x2, y2 = map(int, bounds.groups())
        if x2 <= x1 or y2 <= y1:
            continue
        matches.append(((x1 + x2) // 2, (y1 + y2) // 2))
    if not matches:
        return None
    if bottom:
        return max(matches, key=lambda center: center[1])
    return min(matches, key=lambda center: center[1])


def tap(label: str, bottom: bool = False) -> None:
    target = None
    for _ in range(3):
        target = find(label, bottom=bottom)
        if target:
            break
        time.sleep(2)
    if not target:
        raise RuntimeError(f"Could not locate accessible action: {label}")
    adb("shell", "input", "tap", str(target[0]), str(target[1]))
    time.sleep(4)
    print(f"Tapped {label}: {target}")


adb("shell", "wm", "size", "720x1600")
adb("shell", "wm", "density", "280")
adb("shell", "monkey", "-p", APP, "1")
time.sleep(22)
screenshot("01-home", "home screen")
tap("일정", bottom=True)
screenshot("02-calendar", "monthly calendar")
tap("설정", bottom=True)
screenshot("03-settings", "basic settings")
tap("고급 설정")
screenshot("04-settings-advanced", "advanced settings")
tap("홈", bottom=True)
tap("텍스트 · 음성으로 일정 추가")
screenshot("05-quick-entry", "native quick-entry chooser")
tap("텍스트로 일정 입력")
screenshot("06-native-editor", "native text entry editor")

WARNINGS: list[str] = []

try:
    tap("직접 날짜와 시간 지정")
    screenshot("07-native-save-preview", "branded native date/time confirmation form")
    try:
        tap("달력에서 날짜 선택")
        screenshot("08-native-date-picker", "native calendar picker")
        adb("shell", "input", "keyevent", "4")
        time.sleep(2)
        tap("시간 선택")
        screenshot("09-native-time-picker", "native time picker")
        adb("shell", "input", "keyevent", "4")
    except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        WARNINGS.append(f"Date/time picker capture: {exc}")
except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
    WARNINGS.append(f"Native save-preview capture: {exc}")

try:
    adb("shell", "cmd", "uimode", "night", "yes")
    adb("shell", "am", "force-stop", APP)
    adb("shell", "monkey", "-p", APP, "1")
    time.sleep(12)
    screenshot("10-home-dark", "home screen with system dark mode enabled")
    tap("텍스트 · 음성으로 일정 추가")
    screenshot("11-quick-entry-dark", "branded native chooser in dark mode")
    tap("텍스트로 일정 입력")
    screenshot("12-native-editor-dark", "native editor in dark mode")
except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
    WARNINGS.append(f"Dark-mode capture: {exc}")
finally:
    try:
        adb("shell", "cmd", "uimode", "night", "no")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass

(OUT / "capture-manifest.json").write_text(
    json.dumps(
        {
            "source": "Android 29 emulator, new local installation",
            "screens": REPORT,
            "warnings": WARNINGS,
        },
        ensure_ascii=False,
        indent=2,
    ),
    encoding="utf-8",
)
for note in WARNINGS:
    print(f"Capture limitation: {note}")
