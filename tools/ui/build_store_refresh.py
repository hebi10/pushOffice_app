#!/usr/bin/env python3
"""Build monochrome Play graphics using genuine captured Android screenshots."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SLOTS = [
    ("01-home-briefing.png", "22b-home-today-three.png", "오늘 일정과 브리핑을 한눈에", "홈에서 오늘 할 일과 다음 일정을 확인"),
    ("02-calendar.png", "23c-calendar-today-three-list.png", "월간 일정을 더 쉽게", "날짜별 일정과 반복 일정을 한눈에"),
    ("03-quick-entry.png", "05-quick-entry.png", "텍스트·음성으로 빠른 일정 입력", "입력 방식을 선택하고 편하게 기록"),
    ("04-save-confirmation.png", "07c-native-confirmation-populated.png", "저장 전 일정 정보를 확인", "제목과 날짜·시간을 확인한 뒤 저장"),
    ("05-schedule-detail.png", "11-schedule-detail.png", "일정별 세부 설정도 간편하게", "시간·반복·알림·삭제를 한곳에서"),
    ("06-notification-settings.png", "03c-settings-time-expanded.png", "내 생활에 맞는 알림 설정", "일정 알림과 아침 브리핑을 관리"),
    ("07-ai-model-overview.png", "19a-ai-model-manager.png", "기기 AI 모델을 직접 관리", "지원 기기에서 모델 상태를 비교하고 확인"),
    ("08-ai-model-details.png", "19b-ai-model-manager-lower.png", "원하는 AI 모델을 선택", "모델별 설치·테스트 기능을 확인"),
]
COLOR = "#23262B"
BG = "#F7F8FA"
SUB = "#676C73"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    choices = (
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf")
        if bold else
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/truetype/nanum/NanumSquareRoundR.ttf")
    )
    for choice in choices:
        if Path(choice).is_file():
            return ImageFont.truetype(choice, size)
    raise FileNotFoundError("A Korean font must be installed")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fitted_font(draw: ImageDraw.ImageDraw, line: str, max_width: int, size: int, bold: bool):
    while size >= 32:
        face = font(size, bold)
        if draw.textbbox((0, 0), line, font=face)[2] <= max_width:
            return face
        size -= 2
    raise ValueError("Headline too long: " + line)


def poster(index: int, title: str, subtitle: str, source: Path, out: Path) -> dict:
    with Image.open(source) as original:
        if original.width < 320 or original.height < 700 or original.width >= original.height:
            raise ValueError("Unexpected Android screenshot aspect ratio: " + source.name)
        screen = original.convert("RGB")
    image = Image.new("RGB", (1080, 1920), BG)
    draw = ImageDraw.Draw(image)
    draw.text((75, 55), "Push Office", font=font(36, True), fill=COLOR, anchor="lt")
    draw.text((1007, 73), f"{index:02d} / 08", font=font(24), fill=SUB, anchor="rt")
    draw.text((75, 142), title, font=fitted_font(draw, title, 940, 60, True), fill=COLOR, anchor="lt")
    draw.text((78, 245), subtitle, font=fitted_font(draw, subtitle, 940, 33, False), fill=SUB, anchor="lt")
    inner_w = 689
    inner_h = round(screen.height * inner_w / screen.width)
    if inner_h > 1532:
        inner_h = 1532
        inner_w = round(screen.width * inner_h / screen.height)
    fitted = screen.resize((inner_w, inner_h), Image.Resampling.LANCZOS)
    x, y = (1080 - inner_w) // 2, 329
    draw.rounded_rectangle((x-11, y-11, x+inner_w+10, y+inner_h+10), radius=31, fill=COLOR)
    image.paste(fitted, (x, y))
    draw.text((540, 1891), "실제 Android 앱 화면 · 예시 일정", font=font(20), fill=SUB, anchor="mt")
    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out, format="PNG", optimize=True)
    return {"name": out.name, "source": source.name, "source_sha256": sha(source),
            "sha256": sha(out), "size": [1080, 1920], "mode": "RGB"}


def feature(icon: Path, out: Path) -> dict:
    background = Image.new("RGB", (1024, 500), BG)
    draw = ImageDraw.Draw(background)
    draw.text((66, 64), "Push Office", font=font(78, True), fill=COLOR, anchor="lt")
    draw.text((68, 191), "일정과 브리핑을 한곳에서", font=font(40, True), fill=COLOR, anchor="lt")
    draw.text((68, 286), "빠른 입력 · 달력 · 알림", font=font(27), fill=SUB, anchor="lt")
    with Image.open(icon) as mark:
        if mark.size != (512, 512):
            raise ValueError("Store icon must be 512×512")
        pasted = mark.convert("RGB").resize((330, 330), Image.Resampling.LANCZOS)
    background.paste(pasted, (665, 88))
    out.parent.mkdir(parents=True, exist_ok=True)
    background.save(out, "PNG", optimize=True)
    return {"name": out.name, "sha256": sha(out), "size": [1024, 500], "mode": "RGB"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--captures", type=Path, default=Path("ui-captures"))
    parser.add_argument("--out", type=Path, default=Path("store-refresh-output"))
    parser.add_argument("--icon", type=Path, default=Path("store-assets/ko-KR/app-icon.png"))
    parser.add_argument("--allow-incomplete", action="store_true")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    results, missing = [], []
    for index, (name, source_name, title, subtitle) in enumerate(SLOTS, 1):
        path = args.captures / source_name
        if not path.is_file():
            missing.append(source_name)
            continue
        results.append(poster(index, title, subtitle, path, args.out / name))
    manifest = {
        "package": "com.hebi96.pushOffice_app", "language": "ko-KR",
        "appUiCommit": os.environ.get("SOURCE_COMMIT_SHA", os.environ.get("GITHUB_SHA", "local-preview")),
        "captureRun": os.environ.get("GITHUB_RUN_ID", "local-preview"),
        "sourcePolicy": "unmodified actual Android emulator screenshot pixels",
        "complete": len(results) == 8 and not missing,
        "screenshots": results,
        "missing": missing,
    }
    manifest["featureGraphic"] = feature(args.icon, args.out / "feature-graphic.png")
    (args.out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not manifest["complete"] and not args.allow_incomplete:
        raise SystemExit("Missing real Android captures: " + ", ".join(missing))
    print(f"Mono Office Play refresh: {len(results)}/8 real screenshots")


if __name__ == "__main__":
    main()
