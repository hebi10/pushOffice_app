#!/usr/bin/env python3
"""Guarded eight-image Mono Office Play listing update (never changes release tracks)."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from PIL import Image

import publish_play_store_images as play_images

ASSETS = Path("store-assets/ko-KR")
MANIFEST = ASSETS / "refresh-manifest-20261111.json"
POSTERS = ASSETS / "screenshots-refresh-20261111"
FEATURE = ASSETS / "feature-graphic-refresh-20261111.png"
ICON = ASSETS / "app-icon.png"
EXPECTED_FILES = (
    "01-home-briefing.png",
    "02-calendar.png",
    "03-quick-entry.png",
    "04-save-confirmation.png",
    "05-schedule-detail.png",
    "06-notification-settings.png",
    "07-ai-model-overview.png",
    "08-ai-model-details.png",
)
EXPECTED_ICON_SHA256 = "01b40efbf483830618d8e932d7afeeef7fa4f7ff602eb15cf00b455665eed803"


def hash_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def checked_png(path: Path, expected_size: tuple[int, int], mode: str, expected_hash: str | None = None) -> bytes:
    if not path.is_file():
        raise play_images.ListingError("Missing verified source graphic: " + str(path))
    with Image.open(path) as pic:
        if pic.format != "PNG" or pic.size != expected_size or pic.mode != mode:
            raise play_images.ListingError("Unexpected PNG format, dimensions or mode: " + str(path))
        pic.verify()
    if expected_hash and hash_of(path) != expected_hash:
        raise play_images.ListingError("Source graphic checksum mismatch: " + str(path))
    data = path.read_bytes()
    if len(data) > (1024 * 1024 if expected_size == (512, 512) else 15 * 1024 * 1024):
        raise play_images.ListingError("Source graphic exceeds Play image size limit: " + str(path))
    return data


def validated_assets_eight() -> dict[str, list[bytes]]:
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        raise play_images.ListingError("Missing or invalid eight-image provenance manifest") from None
    if data.get("package") != play_images.PACKAGE or data.get("language") != "ko-KR":
        raise play_images.ListingError("Listing identity does not match the approved app")
    if data.get("complete") is not True or data.get("missing"):
        raise play_images.ListingError("An Android capture is still missing")
    source_commit = data.get("appUiCommit", "")
    run = data.get("captureRun", "")
    if not isinstance(source_commit, str) or not re.fullmatch("[0-9a-f]{40}", source_commit):
        raise play_images.ListingError("Missing full Android source commit provenance")
    if not isinstance(run, str) or not re.fullmatch("[0-9]{6,}", run):
        raise play_images.ListingError("Missing GitHub Actions real-screen capture run")
    entries = data.get("screenshots", [])
    if not isinstance(entries, list) or tuple(item.get("name") for item in entries if isinstance(item, dict)) != EXPECTED_FILES:
        raise play_images.ListingError("Eight real screenshots or their order did not match approval")
    if entries[6].get("source") != "19a-ai-model-manager.png" or entries[7].get("source") != "19b-ai-model-manager-lower.png":
        raise play_images.ListingError("Model-management posters must use genuine Android captures")
    shots = []
    for entry in entries:
        digest = entry.get("sha256")
        if not isinstance(digest, str) or not re.fullmatch("[0-9a-f]{64}", digest):
            raise play_images.ListingError("Missing approved poster checksum")
        shots.append(checked_png(POSTERS / entry["name"], (1080, 1920), "RGB", digest))
    feature_hash = (data.get("featureGraphic") or {}).get("sha256")
    if not isinstance(feature_hash, str) or not re.fullmatch("[0-9a-f]{64}", feature_hash):
        raise play_images.ListingError("Feature graphic checksum is missing")
    feature = checked_png(FEATURE, (1024, 500), "RGB", feature_hash)
    icon = checked_png(ICON, (512, 512), "RGBA", EXPECTED_ICON_SHA256)
    return {"icon": [icon], "featureGraphic": [feature], "phoneScreenshots": shots}


if __name__ == "__main__":
    play_images.validated_assets = validated_assets_eight
    play_images.TYPES = ("icon", "featureGraphic", "phoneScreenshots")
    raise SystemExit(play_images.run())
