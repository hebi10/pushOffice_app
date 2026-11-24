"""Deterministic date/navigation helpers for disposable Android UI QA."""
from datetime import date, timedelta
import re
import xml.etree.ElementTree as ET

WEEKDAYS = ("월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일")

def week_start(day: date) -> date:
    return day - timedelta(days=(day.weekday() + 1) % 7)

def week_shift(current: date, target: date) -> int:
    return (week_start(target) - week_start(current)).days // 7

def day_label(day: date, count: int) -> str:
    if count < 0:
        raise ValueError("negative schedule count")
    return f"{day.month}월 {day.day}일 {WEEKDAYS[day.weekday()]}, 일정 {count}건"

def exact_clickable_center(root: ET.Element, label: str, package: str) -> tuple[int, int] | None:
    """Match an enabled app control, not a similarly named summary or another app."""
    matches = set()
    for node in root.iter("node"):
        if node.get("package") != package or node.get("clickable") != "true" or node.get("enabled") != "true":
            continue
        if label not in (node.get("text", ""), node.get("content-desc", "")):
            continue
        bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
        if not bounds:
            continue
        x1, y1, x2, y2 = map(int, bounds.groups())
        if x2 > x1 and y2 > y1:
            matches.add(((x1 + x2) // 2, (y1 + y2) // 2))
    if len(matches) > 1:
        raise RuntimeError(f"Ambiguous accessible action: {label}")
    return next(iter(matches), None)
