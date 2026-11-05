#!/usr/bin/env python3
"""Capture actual screens from a fresh isolated Android emulator."""
from __future__ import annotations

import json
import re
import struct
import zlib
import subprocess
import time
from datetime import date, timedelta
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


def pixel_rgb(path: Path, x: int, y: int) -> tuple[int, int, int]:
    """Read an RGB pixel from an Android PNG without optional Python packages."""
    raw = path.read_bytes()
    if raw[:8] != b"\\x89PNG\\r\\n\\x1a\\n":
        raise RuntimeError(f"{path.name}: invalid PNG")
    offset, width, height, depth, kind, pieces = 8, 0, 0, 0, 0, []
    while offset < len(raw):
        length = struct.unpack_from(">I", raw, offset)[0]
        tag = raw[offset + 4:offset + 8]
        payload = raw[offset + 8:offset + 8 + length]
        offset += length + 12
        if tag == b"IHDR":
            width, height, depth, kind, _, _, interlace = struct.unpack(">IIBBBBB", payload)
            if depth != 8 or kind not in (2, 6) or interlace:
                raise RuntimeError(f"{path.name}: unsupported PNG mode")
        elif tag == b"IDAT":
            pieces.append(payload)
        elif tag == b"IEND":
            break
    if not 0 <= x < width or not 0 <= y < height:
        raise RuntimeError(f"{path.name}: sample coordinate outside screenshot")
    bpp = 3 if kind == 2 else 4
    stride = width * bpp
    inflated = zlib.decompress(b"".join(pieces))
    pointer = 0
    previous = bytearray(stride)
    for _ in range(y + 1):
        filter_kind = inflated[pointer]
        pointer += 1
        row = bytearray(inflated[pointer:pointer + stride])
        pointer += stride
        for i in range(stride):
            left = row[i - bpp] if i >= bpp else 0
            up = previous[i]
            upper_left = previous[i - bpp] if i >= bpp else 0
            if filter_kind == 1:
                row[i] = (row[i] + left) & 255
            elif filter_kind == 2:
                row[i] = (row[i] + up) & 255
            elif filter_kind == 3:
                row[i] = (row[i] + (left + up) // 2) & 255
            elif filter_kind == 4:
                candidate = left + up - upper_left
                da, db, dc = abs(candidate - left), abs(candidate - up), abs(candidate - upper_left)
                predictor = left if da <= db and da <= dc else up if db <= dc else upper_left
                row[i] = (row[i] + predictor) & 255
            elif filter_kind != 0:
                raise RuntimeError(f"{path.name}: unknown PNG filter {filter_kind}")
        previous = row
    return tuple(previous[x*bpp:x*bpp + 3])


def assert_dark_surface(name: str, x: int, y: int) -> None:
    rgb = pixel_rgb(OUT / f"{name}.png", x, y)
    if max(rgb) > 115:
        raise RuntimeError(f"{name}: expected a dark surface at ({x},{y}), got RGB {rgb}")
    print(f"Verified real dark-mode surface in {name}: RGB {rgb}")


def find(label: str, bottom: bool = False, class_name: str | None = None) -> tuple[int, int] | None:
    try:
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=45)
        content = adb("exec-out", "cat", "/sdcard/ui.xml")
        root = ET.fromstring(content.decode("utf-8", errors="replace"))
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ET.ParseError):
        return None
    matches = []
    for node in root.iter("node"):
        if class_name and node.get("class") != class_name:
            continue
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


def tap(label: str, bottom: bool = False, scroll: bool = False) -> None:
    target = None
    for attempt in range(5 if scroll else 3):
        target = find(label, bottom=bottom)
        if target:
            break
        if scroll and attempt > 0:
            adb("shell", "input", "swipe", "360", "1200", "360", "440", "420")
        time.sleep(2)
    if not target:
        raise RuntimeError(f"Could not locate accessible action: {label}")
    adb("shell", "input", "tap", str(target[0]), str(target[1]))
    time.sleep(4)
    print(f"Tapped {label}: {target}")


def type_field(label: str, value: str) -> None:
    target = find(label, class_name="android.widget.EditText")
    if not target:
        raise RuntimeError(f"Missing editable field: {label}")
    adb("shell", "input", "tap", str(target[0]), str(target[1]))
    adb("shell", "input", "text", value)
    adb("shell", "input", "keyevent", "4")
    time.sleep(2)


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

# A disposable emulator-only appointment exercises the real RN detail and
# confirmation views; it is never written to the user's phone or Play app.
try:
    emulator_date = adb("shell", "date", "+%Y-%m-%d").decode().strip()
    tomorrow = (date.fromisoformat(emulator_date) + timedelta(days=1)).isoformat()
    type_field("일정 제목", "UITest")
    type_field("날짜 (YYYY-MM-DD)", tomorrow)
    type_field("시간 (HH:mm)", "09:00")
    tap("일정 저장", scroll=True)
    time.sleep(10)
    screenshot("10-home-with-fixture", "next appointment created on isolated emulator")
    tap("UITest", scroll=True)
    screenshot("11-schedule-detail", "React Native schedule detail screen")
    tap("일정 날짜 선택", scroll=True)
    screenshot("12-schedule-date-modal", "branded calendar date picker")
    adb("shell", "input", "keyevent", "4")
    time.sleep(2)
    tap("시작 시간 선택", scroll=True)
    screenshot("13-schedule-time-modal", "branded time editor")
    adb("shell", "input", "keyevent", "4")
    time.sleep(2)
    tap("일정 삭제", scroll=True)
    screenshot("14-schedule-delete-dialog", "themed destructive confirmation dialog")
    adb("shell", "input", "keyevent", "4")
except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError) as exc:
    WARNINGS.append(f"Sample schedule and detail-modal capture: {exc}")

# Check the real in-app "dark" setting, not just the emulator system
# preference: cmd uimode alone did not change the prior captured app surfaces.
adb("shell", "input", "keyevent", "4")
time.sleep(3)
tap("설정", bottom=True)
tap("고급 설정")
tap("어두운 테마", scroll=True)
time.sleep(6)
tap("홈", bottom=True)
screenshot("10-home-dark", "home with explicit dark app theme")
assert_dark_surface("10-home-dark", 4, 400)
tap("텍스트 · 음성으로 일정 추가")
screenshot("11-quick-entry-dark", "branded native chooser with explicit dark app theme")
assert_dark_surface("11-quick-entry-dark", 100, 500)
tap("텍스트로 일정 입력")
screenshot("12-native-editor-dark", "native editor with explicit dark app theme")
assert_dark_surface("12-native-editor-dark", 100, 500)

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
