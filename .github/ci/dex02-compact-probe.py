"""Isolated compact-calendar smoke for the DEX-02 QA branch."""

from datetime import date, timedelta
from pathlib import Path
import subprocess
import time
import xml.etree.ElementTree as ET

from calendar_capture_target import agenda_jump_label, day_label, exact_clickable_center, node_bounds, week_shift


APP = 'com.hebi96.pushOffice_app'
OUT = Path('compact-dex-evidence')
OUT.mkdir(exist_ok=True)


def adb(*args):
    return subprocess.check_output(['adb', *args], timeout=50)


def hierarchy():
    adb('shell', 'uiautomator', 'dump', '/sdcard/dex02-ui.xml')
    return ET.fromstring(adb('exec-out', 'cat', '/sdcard/dex02-ui.xml'))


def capture(name, tree=None):
    tree = tree if tree is not None else hierarchy()
    ET.ElementTree(tree).write(OUT / f'{name}.xml', encoding='utf-8')
    (OUT / f'{name}.png').write_bytes(adb('exec-out', 'screencap', '-p'))
    print(f'Captured {name}', flush=True)


def tap_center(center):
    adb('shell', 'input', 'tap', *map(str, center))
    time.sleep(2)


def find(tree, label, *, bottom=False, class_name=None):
    candidates = []
    for node in tree.iter('node'):
        if node.get('package') != APP or (class_name is not None and node.get('class') != class_name):
            continue
        if label in node.get('text', '') or label in node.get('content-desc', ''):
            bounds = node_bounds(node)
            if bounds:
                x1, y1, x2, y2 = bounds
                candidates.append(((x1 + x2) // 2, (y1 + y2) // 2))
    return (max if bottom else min)(candidates, key=lambda pt: pt[1]) if candidates else None


def swipe(x, y1, y2):
    adb('shell', 'input', 'swipe', str(x), str(y1), str(x), str(y2), '420')
    time.sleep(2)


def tap(label, *, bottom=False, class_name=None, scroll=False, exact=False):
    for attempt in range(5):
        tree = hierarchy()
        center = (exact_clickable_center(tree, label, APP) if exact else
                  find(tree, label, bottom=bottom, class_name=class_name))
        if center:
            tap_center(center)
            return
        if scroll and attempt:
            swipe(360, 1200, 440)
        else:
            time.sleep(1)
    raise RuntimeError(f'Required action is missing: {label}')


def edit(label, value, scroll=False):
    tap(label, class_name='android.widget.EditText', scroll=scroll)
    adb('shell', 'input', 'text', value)
    adb('shell', 'input', 'keyevent', '4')
    time.sleep(2)


def launch():
    adb('shell', 'am', 'force-stop', APP)
    adb('shell', 'monkey', '-p', APP, '1')
    time.sleep(12)


try:
    adb('shell', 'wm', 'size', '720x1600')
    adb('shell', 'wm', 'density', '280')
    launch()
    assert adb('shell', 'date', '+%z').strip() == b'+0900'
    today = date.fromisoformat(adb('shell', 'date', '+%Y-%m-%d').decode().strip())
    fixture = today + timedelta(days=1)
    tap('일정 빠르게 추가')
    tap('텍스트로 일정 입력')
    tap('직접 날짜와 시간 지정')
    edit('일정 제목', 'UITest')
    tap('날짜·시간 직접 입력', scroll=True)
    edit('날짜 (YYYY-MM-DD)', fixture.isoformat(), scroll=True)
    edit('시간 (HH:mm)', '09:00', scroll=True)
    swipe(360, 430, 1320)
    tap('직접 입력 접기', scroll=True)
    tap('일정 저장', scroll=True)
    time.sleep(6)
    assert find(hierarchy(), 'UITest'), 'Disposable schedule was not saved'
    tap('설정', bottom=True)
    tap('고급 설정')
    tap('어두운 테마', scroll=True)

    adb('shell', 'wm', 'size', '640x1360')
    launch()
    tap('일정', bottom=True)
    tap('오늘', exact=True)
    tap('주간 일정', exact=True)
    current_day = date.fromisoformat(adb('shell', 'date', '+%Y-%m-%d').decode().strip())
    shift = week_shift(current_day, fixture)
    assert abs(shift) <= 1, f'Unexpected fixture week shift {shift}'
    if shift:
        tap('다음 주' if shift > 0 else '이전 주', exact=True)
    tap(day_label(fixture, 1), exact=True)
    tree = hierarchy()
    capture('01-compact-after-date-tap', tree)
    label = agenda_jump_label(fixture)
    center = exact_clickable_center(tree, label, APP)
    print(f'Exact action initially visible: {center is not None}', flush=True)

    for attempt in range(1, 4):
        if center:
            break
        scrolls = {node_bounds(n) for n in tree.iter('node')
                   if n.get('package') == APP and n.get('scrollable') == 'true'
                   and n.get('class') == 'android.widget.ScrollView' and n.get('enabled') == 'true'}
        scrolls.discard(None)
        assert len(scrolls) == 1, f'Expected one visible calendar ScrollView, got {scrolls}'
        x1, y1, x2, y2 = next(iter(scrolls))
        span = y2 - y1
        swipe((x1 + x2) // 2, y1 + span * 4 // 5, y1 + span * 2 // 5)
        tree = hierarchy()
        capture(f'02-compact-after-scroll-{attempt}', tree)
        center = exact_clickable_center(tree, label, APP)

    assert center, f'Could not locate exact selected-date calendar action: {label}'
    tap_center(center)
    tap('UITest')
    tree = hierarchy()
    assert find(tree, '일정 제목 수정') and find(tree, 'UITest'), 'Wrong or missing compact schedule detail'
    capture('03-compact-actual-schedule-detail', tree)
    print(f'Compact selected-date jump and actual saved schedule verified for {fixture}', flush=True)
except Exception:
    try:
        capture('99-compact-failure')
    except (subprocess.SubprocessError, ET.ParseError) as error:
        print(f'Could not collect failure hierarchy: {error}', flush=True)
    raise
