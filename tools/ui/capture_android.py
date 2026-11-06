#!/usr/bin/env python3
"""Capture actual screens from a fresh isolated Android emulator."""
from __future__ import annotations

import json
import re
import struct
import zlib
import subprocess
import time
from datetime import date, datetime, timedelta
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
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
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
tap("아침 브리핑 알림 시간")
screenshot("03c-settings-time-expanded", "compact settings time editor")
tap("브리핑 시간 저장", scroll=True)
if find("설정 저장 완료") is None:
    raise RuntimeError("Settings save confirmation was not shown")
screenshot("03d-settings-save-notice", "shared app dialog after saving settings")
tap("확인")
tap("고급 설정")
screenshot("04-settings-advanced", "advanced settings")
tap("외부 정보 상세 설정", scroll=True)
screenshot("04a-settings-external-fields", "advanced settings with external fields expanded")
tap("외부 정보 상세 설정", scroll=True)
adb("shell", "input", "swipe", "360", "380", "360", "1400", "500")
adb("shell", "input", "swipe", "360", "380", "360", "1400", "500")
tap("기본 설정")
screenshot("03a-settings-basic-return", "basic settings after switching sections")
tap("홈", bottom=True)
tap("일정 빠르게 추가")
screenshot("05-quick-entry", "native quick-entry bottom sheet")
tap("음성 입력 화면 열기")
screenshot("05a-voice-editor", "native voice entry editor before voice activation")
tap("뒤로", scroll=True)
screenshot("05b-quick-entry-return", "chooser after exiting voice editor")
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
        time.sleep(2)
        adb("shell", "input", "swipe", "360", "1200", "360", "460", "420")
        if find("일정 저장") is None:
            raise RuntimeError("Native confirmation save button is unreachable after scrolling")
        screenshot("07b-native-confirmation-actions", "native confirmation save action after scrolling")
        adb("shell", "input", "swipe", "360", "440", "360", "1300", "420")
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
    tap("일정", bottom=True)
    screenshot("02a-calendar-with-schedule", "monthly calendar with real isolated appointment dot")
    tap("홈", bottom=True)
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
    tap("종료 날짜 선택", scroll=True)
    screenshot("12a-schedule-end-date-modal", "shared end-date picker")
    adb("shell", "input", "keyevent", "4")
    time.sleep(2)
    tap("종료 시간 선택", scroll=True)
    screenshot("13a-schedule-end-time-modal", "shared end-time picker")
    adb("shell", "input", "keyevent", "4")
    time.sleep(2)
    tap("매월 반복", scroll=True)
    tap("변경 사항 저장", scroll=True)
    screenshot("14a-schedule-repeat-dialog", "full recurrence update confirmation")
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
screenshot("04b-settings-advanced-dark", "advanced settings with explicit dark app theme")
adb("shell", "input", "swipe", "360", "380", "360", "1400", "500")
adb("shell", "input", "swipe", "360", "380", "360", "1400", "500")
tap("기본 설정")
screenshot("03b-settings-basic-dark", "basic settings with explicit dark app theme")
tap("홈", bottom=True)
screenshot("10-home-dark", "home with explicit dark app theme")
assert_dark_surface("10-home-dark", 4, 400)
tap("일정", bottom=True)
screenshot("02b-calendar-dark", "monthly calendar with explicit dark app theme")
tap("홈", bottom=True)
try:
    tap("UITest", scroll=True)
    screenshot("11a-schedule-detail-dark", "schedule detail with explicit dark app theme")
    assert_dark_surface("11a-schedule-detail-dark", 4, 400)
    adb("shell", "input", "keyevent", "4")
    time.sleep(3)
except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
    WARNINGS.append(f"Dark schedule detail capture: {exc}")
tap("일정 빠르게 추가")
screenshot("11-quick-entry-dark", "branded native chooser with explicit dark app theme")
assert_dark_surface("11-quick-entry-dark", 100, 1000)
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

# Small portrait screen layout regression: run with an equivalent 360dp-ish
# viewport and preserve the default emulator dimensions after taking evidence.
try:
    adb("shell", "input", "keyevent", "4")
    adb("shell", "wm", "size", "640x1360")
    adb("shell", "wm", "density", "280")
    adb("shell", "am", "force-stop", APP)
    adb("shell", "monkey", "-p", APP, "1")
    time.sleep(10)
    tap("일정", bottom=True)
    screenshot("02c-calendar-compact", "monthly calendar on compact portrait screen")
    tap("홈", bottom=True)
    try:
        tap("UITest", scroll=True)
        screenshot("17a-schedule-detail-compact", "schedule detail on compact portrait screen")
        adb("shell", "input", "keyevent", "4")
        time.sleep(3)
    except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        WARNINGS.append(f"Compact schedule detail capture: {exc}")
    tap("일정 빠르게 추가")
    screenshot("15-compact-chooser", "bottom-sheet chooser on compact portrait screen")
    tap("텍스트로 일정 입력")
    screenshot("16-compact-editor", "editor on compact portrait screen")
    tap("직접 날짜와 시간 지정", scroll=True)
    screenshot("17-compact-confirmation", "confirmation form on compact portrait screen")
    adb("shell", "input", "swipe", "360", "1180", "360", "430", "420")
    if find("일정 저장") is None:
        raise RuntimeError("Compact confirmation save button is unreachable after scrolling")
    screenshot("17b-compact-confirmation-actions", "native save button accessible on narrow screen")
except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
    WARNINGS.append(f"Compact-screen capture: {exc}")
finally:
    adb("shell", "wm", "size", "720x1600")

# Preserved screens are hidden from the tab bar, but must remain deep-linkable.
# Verify the actual screens on Android rather than assuming routes from code.
def capture_preserved_route(page: str, expected_label: str, screenshot_name: str) -> None:
    adb("shell", "am", "force-stop", APP)
    urls = [
        f"pushofficeapp://{page}",
        f"pushofficeapp:///{page}",
        f"pushofficeapp:///(tabs)/{page}",
    ]
    for url in urls:
        try:
            adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW",
                "-d", url, "-p", APP, timeout=60)
            time.sleep(7)
            if find(expected_label):
                screenshot(screenshot_name, f"preserved {page} route opened by deep link")
                return
        except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
            continue
    raise RuntimeError(f"Preserved route {page} could not be opened on Android")


capture_preserved_route("briefing", "데일리 다이제스트", "18-legacy-briefing")
capture_preserved_route("chatHistory", "채팅 내역", "19-legacy-chat-history")


# Final QA matrix: system font enlargement and a tablet-class portrait viewport.
# This uses the installed production app; the test emulator contains disposable data.
QA_PROFILES = {
    "large_font": {
        "font_scale": 1.3,
        "viewport": "720x1600",
        "screens": [
            "20a-large-font-home.png",
            "20b-large-font-calendar.png",
            "20c-large-font-settings.png",
            "20d-large-font-chooser.png",
            "20e-large-font-editor.png",
        ],
    },
    "tablet_viewport": {
        "font_scale": 1.0,
        "viewport": "1440x2160",
        "screens": [
            "21a-tablet-home.png",
            "21b-tablet-calendar.png",
            "21c-tablet-settings.png",
            "21d-tablet-chooser.png",
            "21e-tablet-editor.png",
        ],
    },
}
widget_providers = {"small": False, "agenda": False}
try:
    widget_dump = adb("shell", "dumpsys", "appwidget", timeout=60).decode(
        "utf-8", errors="replace"
    )
    widget_providers["small"] = (
        "ScheduleWidgetProvider" in widget_dump
        and "com.hebi96.pushOffice_app" in widget_dump
    )
    widget_providers["agenda"] = (
        "ScheduleAgendaWidgetProvider" in widget_dump
        and "com.hebi96.pushOffice_app" in widget_dump
    )
    if not all(widget_providers.values()):
        WARNINGS.append("Installed Android app does not register both widget providers")
except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
    WARNINGS.append(f"Android widget provider registry inspection: {exc}")

try:
    adb("shell", "settings", "put", "system", "font_scale", "1.3")
    if adb("shell", "settings", "get", "system", "font_scale").decode().strip() != "1.3":
        raise RuntimeError("Android did not apply 130% system font scaling")
    adb("shell", "am", "force-stop", APP)
    adb("shell", "monkey", "-p", APP, "1")
    time.sleep(11)
    if not find("일정 빠르게 추가"):
        raise RuntimeError("Large-font home is missing its quick-add action")
    screenshot("20a-large-font-home", "130% font scale: home")
    tap("일정", bottom=True)
    screenshot("20b-large-font-calendar", "130% font scale: calendar")
    tap("설정", bottom=True)
    screenshot("20c-large-font-settings", "130% font scale: settings")
    tap("홈", bottom=True)
    tap("일정 빠르게 추가")
    screenshot("20d-large-font-chooser", "130% font scale: native input chooser")
    tap("텍스트로 일정 입력")
    screenshot("20e-large-font-editor", "130% font scale: native text editor")
except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
    WARNINGS.append(f"130% Android font-scale QA: {exc}")
finally:
    adb("shell", "settings", "put", "system", "font_scale", "1.0")

try:
    adb("shell", "wm", "size", "1440x2160")
    adb("shell", "wm", "density", "280")
    adb("shell", "am", "force-stop", APP)
    adb("shell", "monkey", "-p", APP, "1")
    time.sleep(11)
    if not find("일정 빠르게 추가"):
        raise RuntimeError("Tablet-size home is missing its quick-add action")
    screenshot("21a-tablet-home", "1440x2160 tablet-class viewport: home")
    tap("일정", bottom=True)
    screenshot("21b-tablet-calendar", "1440x2160 tablet-class viewport: calendar")
    tap("설정", bottom=True)
    screenshot("21c-tablet-settings", "1440x2160 tablet-class viewport: settings")
    tap("홈", bottom=True)
    tap("일정 빠르게 추가")
    screenshot("21d-tablet-chooser", "1440x2160 tablet-class viewport: native chooser")
    tap("텍스트로 일정 입력")
    screenshot("21e-tablet-editor", "1440x2160 tablet-class viewport: native editor")
except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
    WARNINGS.append(f"Tablet-class viewport QA: {exc}")
finally:
    adb("shell", "wm", "size", "720x1600")
    adb("shell", "wm", "density", "280")
    adb("shell", "settings", "put", "system", "font_scale", "1.0")

(OUT / "device-matrix.json").write_text(
    json.dumps({
        "profiles": QA_PROFILES,
        "widget_providers_registered": widget_providers,
        "not_verified": [
            "Physical phone and real tablet hardware",
            "Launcher widget placement, resize and click on third-party launchers",
            "Microphone-based speech recognition (emulator uses -noaudio)",
            "Gemini Nano inference on supported real hardware",
            "Play Store install/update on a tester account",
        ],
    }, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

# A disposable three-event home fixture gives design reviewers a populated baseline.
# Run after all previous emulator scenarios; clear only this isolated test installation.
try:
    adb("shell", "pm", "clear", APP)
    adb("shell", "monkey", "-p", APP, "1")
    time.sleep(22)
    device_clock = datetime.strptime(
        adb("shell", "date", "+%Y-%m-%dT%H:%M").decode().strip(), "%Y-%m-%dT%H:%M"
    )
    next_midnight = datetime.combine(device_clock.date() + timedelta(days=1), datetime.min.time())
    minutes_left = int((next_midnight - device_clock).total_seconds() // 60)
    if minutes_left < 16:
        raise RuntimeError("Too near device midnight to capture three future appointments")
    fixture_gap = max(5, min(40, (minutes_left - 8) // 4))
    for sample in (1, 2, 3):
        fixture = device_clock + timedelta(minutes=fixture_gap * sample)
        tap("일정 빠르게 추가")
        tap("텍스트로 일정 입력")
        tap("직접 날짜와 시간 지정", scroll=True)
        type_field("일정 제목", f"TodayQA{sample}")
        type_field("날짜 (YYYY-MM-DD)", fixture.strftime("%Y-%m-%d"))
        type_field("시간 (HH:mm)", fixture.strftime("%H:%M"))
        tap("일정 저장", scroll=True)
        time.sleep(4)
        if sample == 1:
            if find("TodayQA1") is None:
                raise RuntimeError("Populated home did not show its first appointment")
            screenshot("22a-home-today-one", "home with one real local appointment today")
    if find("3건") is None:
        raise RuntimeError("Populated home did not show three appointments today")
    screenshot("22b-home-today-three", "home with three real local appointments today")
except (RuntimeError, subprocess.CalledProcessError, subprocess.TimeoutExpired, ValueError) as exc:
    WARNINGS.append(f"Populated home fixture: {exc}")


(OUT / "capture-manifest.json").write_text(
    json.dumps({
        "source": "Android 29 emulator, 720x1600 default and 640x1360 compact mode",
        "screens": REPORT,
        "warnings": WARNINGS,
    }, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
for note in WARNINGS:
    print(f"Capture limitation: {note}")
