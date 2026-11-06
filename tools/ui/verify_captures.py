#!/usr/bin/env python3
"""Fail UI screenshot checks when critical visual evidence is absent or incomplete."""
from __future__ import annotations

import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "ui-captures"
REQUIRED = {
    "01-home.png",
    "02-calendar.png",
    "03-settings.png",
    "03c-settings-time-expanded.png",
    "03d-settings-save-notice.png",
    "04-settings-advanced.png",
    "05-quick-entry.png",
    "06-native-editor.png",
    "07-native-save-preview.png",
    "07b-native-confirmation-actions.png",
    "08-native-date-picker.png",
    "09-native-time-picker.png",
    "10-home-with-fixture.png",
    "11-schedule-detail.png",
    "12-schedule-date-modal.png",
    "13-schedule-time-modal.png",
    "12a-schedule-end-date-modal.png",
    "13a-schedule-end-time-modal.png",
    "14a-schedule-repeat-dialog.png",
    "14-schedule-delete-dialog.png",
    "02b-calendar-dark.png",
    "03b-settings-basic-dark.png",
    "04b-settings-advanced-dark.png",
    "10-home-dark.png",
    "11a-schedule-detail-dark.png",
    "11-quick-entry-dark.png",
    "12-native-editor-dark.png",
    "02c-calendar-compact.png",
    "17a-schedule-detail-compact.png",
    "15-compact-chooser.png",
    "16-compact-editor.png",
    "17-compact-confirmation.png",
    "17b-compact-confirmation-actions.png",
    "18-legacy-briefing.png",
    "19-legacy-chat-history.png",
}


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("invalid PNG header")
    return struct.unpack(">II", data[16:24])


def verify() -> None:
    manifest = ROOT / "capture-manifest.json"
    report = json.loads(manifest.read_text(encoding="utf-8"))
    errors: list[str] = []

    warnings = report.get("warnings")
    if not isinstance(warnings, list):
        errors.append("capture-manifest.json: missing warnings array")
    elif warnings:
        errors.extend(f"capture warning: {warning}" for warning in warnings)

    screens = report.get("screens")
    if not isinstance(screens, list):
        raise ValueError("capture-manifest.json: missing screens array")

    names = [item.get("file") for item in screens if isinstance(item, dict)]
    filenames = {name for name in names if isinstance(name, str)}
    if len(names) != len(filenames):
        errors.append("capture manifest contains duplicate or invalid screenshot names")
    missing = REQUIRED - filenames
    if missing:
        errors.append("required screen not captured: " + ", ".join(sorted(missing)))

    dimensions: dict[str, tuple[int, int]] = {}
    for name in sorted(filenames):
        if Path(name).name != name or not name.endswith(".png"):
            errors.append(f"unsafe or non-PNG screenshot name: {name}")
            continue
        image = ROOT / name
        if not image.is_file():
            errors.append(f"screenshot file missing: {name}")
            continue
        try:
            width, height = png_size(image)
            if width < 320 or height < 320:
                errors.append(f"screenshot too small: {name} ({width}x{height})")
            dimensions[name] = (width, height)
        except (OSError, ValueError) as exc:
            errors.append(f"invalid screenshot {name}: {exc}")

    full = dimensions.get("11-schedule-detail.png")
    compact = dimensions.get("17a-schedule-detail-compact.png")
    if full and compact and compact[0] >= full[0]:
        errors.append("compact detail screenshot was not captured at a narrower viewport")

    if errors:
        print("Push Office UI capture verification failed:")
        for item in errors:
            print(f"- {item}")
        raise SystemExit(1)
    print(f"Push Office UI capture verification passed: {len(filenames)} screenshots, 0 warnings")


if __name__ == "__main__":
    verify()
