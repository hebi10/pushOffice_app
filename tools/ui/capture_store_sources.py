#!/usr/bin/env python3
"""Capture unaltered Push Office Play screenshot sources with disposable emulator data."""
from __future__ import annotations

import json
import re
import struct
import subprocess
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from pathlib import Path

APP = "com.hebi96.pushOffice_app"
ROOT = Path("ui-captures/store-source")
ROOT.mkdir(parents=True, exist_ok=True)
SOURCES: list[dict[str, str]] = []
SAMPLE_TITLES = ("Team meeting", "Design review", "Workout")
EXPECTED_TIME_ZONE = "Asia/Seoul"
SCREEN_WIDTH, SCREEN_HEIGHT = 1080, 1920


def adb(*args: str, timeout: int = 45) -> bytes:
    return subprocess.run(["adb", *args], check=True, capture_output=True, timeout=timeout).stdout


def locate(label: str, *, bottom: bool = False, class_name: str | None = None) -> tuple[int, int] | None:
    adb("shell", "uiautomator", "dump", "/sdcard/store-source-ui.xml", timeout=60)
    raw = adb("exec-out", "cat", "/sdcard/store-source-ui.xml")
    tree = ET.fromstring(raw.decode("utf-8", errors="replace"))
    matches: list[tuple[int, int]] = []
    for node in tree.iter("node"):
        if class_name and node.get("class") != class_name:
            continue
        if label not in node.get("text", "") and label not in node.get("content-desc", ""):
            continue
        bounds = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
        if not bounds:
            continue
        x1, y1, x2, y2 = map(int, bounds.groups())
        if x2 > x1 and y2 > y1:
            matches.append(((x1 + x2) // 2, (y1 + y2) // 2))
    if not matches:
        return None
    return (max if bottom else min)(matches, key=lambda point: point[1])


def tap(label: str, *, bottom: bool = False, scroll: bool = False) -> None:
    target = None
    for attempt in range(6 if scroll else 3):
        target = locate(label, bottom=bottom)
        if target:
            break
        if scroll:
            adb("shell", "input", "swipe", "540", "1510", "540", "590", "400")
        time.sleep(1.5)
    if target is None:
        raise RuntimeError(f"Store source screen cannot reach action: {label}")
    adb("shell", "input", "tap", str(target[0]), str(target[1]))
    time.sleep(2.5)


def write_field(label: str, content: str) -> None:
    node = locate(label, class_name="android.widget.EditText")
    if node is None:
        raise RuntimeError(f"Store source field not found: {label}")
    adb("shell", "input", "tap", str(node[0]), str(node[1]))
    adb("shell", "input", "text", content.replace(" ", "%s"))
    adb("shell", "input", "keyevent", "4")
    time.sleep(1.5)


def capture(filename: str, description: str) -> None:
    raw = adb("exec-out", "screencap", "-p")
    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError(f"Invalid screenshot: {filename}")
    size = struct.unpack(">II", raw[16:24])
    if size != (SCREEN_WIDTH, SCREEN_HEIGHT):
        raise RuntimeError(f"Wrong marketing capture size {filename}: {size}")
    (ROOT / filename).write_bytes(raw)
    SOURCES.append({"file": filename, "description": description})
    print(f"Store source captured: {filename} ({len(raw)} bytes)")


def fresh_home() -> None:
    adb("shell", "am", "force-stop", APP)
    adb("shell", "monkey", "-p", APP, "1")
    time.sleep(10)


def add_event(title: str, when: datetime) -> None:
    tap("일정 빠르게 추가")
    tap("텍스트로 일정 입력")
    tap("직접 날짜와 시간 지정", scroll=True)
    write_field("일정 제목", title)
    write_field("날짜 (YYYY-MM-DD)", when.strftime("%Y-%m-%d"))
    write_field("시간 (HH:mm)", when.strftime("%H:%M"))
    tap("일정 저장", scroll=True)
    time.sleep(4)


def main() -> None:
    zone = adb("shell", "getprop", "persist.sys.timezone").decode().strip()
    offset = adb("shell", "date", "+%z").decode().strip()
    if zone != EXPECTED_TIME_ZONE or offset != "+0900":
        raise RuntimeError(f"Expected Asia/Seoul (+0900), got {zone} ({offset}).")

    adb("shell", "wm", "size", f"{SCREEN_WIDTH}x{SCREEN_HEIGHT}")
    adb("shell", "wm", "density", "400")
    adb("shell", "settings", "put", "system", "font_scale", "1.0")
    adb("shell", "pm", "clear", APP)
    fresh_home()
    now = datetime.strptime(adb("shell", "date", "+%Y-%m-%dT%H:%M").decode().strip(), "%Y-%m-%dT%H:%M")
    midnight = datetime.combine(now.date() + timedelta(days=1), datetime.min.time())
    minutes_left = int((midnight - now).total_seconds() // 60)
    if minutes_left < 180:
        raise RuntimeError("Store captures need three same-day future events; the device is too close to midnight.")
    gap = max(25, min(75, (minutes_left - 25) // 4))

    for index, title in enumerate(SAMPLE_TITLES, 1):
        add_event(title, now + timedelta(minutes=gap * index))

    fresh_home()
    if locate("3건") is None:
        raise RuntimeError("Natural three-event home fixture did not render")
    capture("01-home-briefing.png", "Home and today's briefing with three natural sample appointments")
    tap(SAMPLE_TITLES[0], bottom=True, scroll=True)
    if locate("일정 관리") is None:
        raise RuntimeError("Schedule detail did not open from a real sample appointment")
    capture("05-schedule-detail.png", "Actual saved schedule detail and editable information")
    fresh_home()
    tap("일정", bottom=True)
    if locate("일정 3건") is None:
        raise RuntimeError("Selected calendar day is missing three sample appointments")
    capture("02-calendar-agenda.png", "Calendar with three appointments on a selected date")

    tap("설정", bottom=True)
    capture("06-settings.png", "Notification, briefing and widget options in settings")
    tap("홈", bottom=True)
    tap("일정 빠르게 추가")
    capture("03-entry-chooser.png", "Actual native text or voice choice sheet; no recording started")
    tap("텍스트로 일정 입력")
    tap("직접 날짜와 시간 지정", scroll=True)
    write_field("일정 제목", "Client meeting")
    write_field("날짜 (YYYY-MM-DD)", (now.date() + timedelta(days=1)).isoformat())
    write_field("시간 (HH:mm)", "10:30")
    if locate("Client meeting") is None or locate("일정 저장") is None or locate(EXPECTED_TIME_ZONE) is None:
        raise RuntimeError("Store confirmation is missing input, save action or Korean timezone")
    capture("04-save-confirmation.png", "Real populated native confirmation with Asia/Seoul timezone")

    fresh_home()
    tap("설정", bottom=True)
    tap("고급 설정")
    tap("어두운 테마", scroll=True)
    tap("홈", bottom=True)
    capture("07-dark-home.png", "Actual dark-mode home; optional seventh store screenshot")

    (ROOT / "store-source-manifest.json").write_text(
        json.dumps({
            "kind": "unaltered-device-capture",
            "device": "Android 29 emulator",
            "timezone": zone,
            "utc_offset": offset,
            "screen_size": [SCREEN_WIDTH, SCREEN_HEIGHT],
            "sample_events": list(SAMPLE_TITLES),
            "screens": SOURCES,
            "not_captured": [
                "Two widgets actually placed and resized on a launcher",
                "Physical microphone input and on-device speech recognition",
                "Real alert reception and Gemini Nano inference",
            ],
        }, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Store source set ready: {len(SOURCES)} PNGs (7 expected)")


if __name__ == "__main__":
    main()
