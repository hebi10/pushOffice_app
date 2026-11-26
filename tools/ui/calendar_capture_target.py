"""Deterministic date/navigation helpers for disposable Android UI QA."""
from datetime import date, timedelta
import re
import xml.etree.ElementTree as ET

WEEKDAYS = ("월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일")

def week_start(day: date) -> date:
    return day - timedelta(days=(day.weekday() + 1) % 7)

def week_shift(current: date, target: date) -> int:
    return (week_start(target) - week_start(current)).days // 7

def day_title(day: date) -> str:
    return f"{day.month}월 {day.day}일 {WEEKDAYS[day.weekday()]}"


def day_label(day: date, count: int) -> str:
    if count < 0:
        raise ValueError("negative schedule count")
    return f"{day_title(day)}, 일정 {count}건"


def agenda_jump_label(day: date) -> str:
    return f"선택 날짜 일정 목록으로 이동: {day_title(day)}"


def node_bounds(node: ET.Element) -> tuple[int, int, int, int] | None:
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
    if not match:
        return None
    x1, y1, x2, y2 = map(int, match.groups())
    if x2 <= x1 or y2 <= y1:
        return None
    return x1, y1, x2, y2


def exact_clickable_center(
    root: ET.Element, label: str, package: str, *, class_name: str | None = None, focused: bool = False,
) -> tuple[int, int] | None:
    """Match an enabled app control, not a similarly named summary or another app."""
    matches = set()
    for node in root.iter("node"):
        if node.get("package") != package or node.get("clickable") != "true" or node.get("enabled") != "true":
            continue
        if class_name is not None and node.get("class") != class_name:
            continue
        if focused and node.get("focused") != "true":
            continue
        if label not in (node.get("text", ""), node.get("content-desc", "")):
            continue
        bounds = node_bounds(node)
        if bounds is not None:
            x1, y1, x2, y2 = bounds
            matches.add(((x1 + x2) // 2, (y1 + y2) // 2))
    if len(matches) > 1:
        raise RuntimeError(f"Ambiguous accessible action: {label}")
    return next(iter(matches), None)


def native_scroll_swipe(root: ET.Element, package: str) -> tuple[int, int, int, int]:
    """Keep both endpoints inside the visible native scroll view above the footer."""
    scroll_views = set()
    for node in root.iter("node"):
        if (node.get("package") == package and node.get("class") == "android.widget.ScrollView"
                and node.get("scrollable") == "true" and node.get("enabled") == "true"):
            bounds = node_bounds(node)
            if bounds is not None:
                scroll_views.add(bounds)
    if len(scroll_views) != 1:
        raise RuntimeError("Expected one visible native scroll view for schedule confirmation")
    x1, y1, x2, y2 = next(iter(scroll_views))
    x = (x1 + x2) // 2
    height = y2 - y1
    return x, y1 + height * 4 // 5, x, y1 + height * 2 // 5
