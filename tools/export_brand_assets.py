#!/usr/bin/env python3
"""Export Push Office PNGs from the generated mark and unmodified app captures.

Requires Pillow and Noto Sans CJK Regular/Bold. No vector reconstruction, drawing,
cropping, or retouching of the mark or app UI is performed. Only the transparent
source's nearly invisible outer padding is trimmed before proportional resizing.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/images"
STORE = ROOT / "store-assets/ko-KR"
SOURCES = ROOT / "store-assets/source-screenshots"
BLUE = "#4B94DC"
NEUTRAL = "#F4F7FA"
FONT_DIRS = (Path("/root/.local/share/fonts"), Path("/usr/share/fonts/opentype/noto"))
CAPTURES = (
    ("01-quick-settings.png", "빠른 설정에서 바로 기록"),
    ("02-input-chooser.png", "텍스트·음성으로 일정 입력"),
    ("03-change-preview.png", "저장 전 변경 내용을 확인"),
    ("04-home-briefing.png", "오늘의 일정과 브리핑"),
    ("05-calendar.png", "달력에서 일정을 한눈에"),
    ("07-home-widgets.png", "홈 화면 위젯으로 확인"),
)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    filename = "NotoSansCJK-Bold.ttc" if bold else "NotoSansCJK-Regular.ttc"
    for folder in FONT_DIRS:
        path = folder / filename
        if path.exists():
            return ImageFont.truetype(str(path), size, index=1)  # Korean face
    raise FileNotFoundError(f"Install {filename} before exporting Korean text")


def put_text(image: Image.Image, at: tuple[int, int], text: str, size: int,
             fill: str, bold: bool = False) -> None:
    ImageDraw.Draw(image).text(at, text, font=font(size, bold), fill=fill, anchor="lt")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--captures", type=Path, default=SOURCES,
                        help="Directory containing the six original app screenshots")
    args = parser.parse_args()
    STORE.mkdir(parents=True, exist_ok=True)
    (STORE / "screenshots").mkdir(exist_ok=True)

    original = Image.open(ASSETS / "push-office-mark.png").convert("RGBA")
    # Alpha <= 8 is invisible generation noise, well outside the actual mark.
    bounds = original.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if bounds is None:
        raise ValueError("The source mark is empty")
    mark = original.crop(bounds)

    def mark_at_height(height: int) -> Image.Image:
        width = round(mark.width * height / mark.height)
        return mark.resize((width, height), Image.Resampling.LANCZOS)

    def centered_mark(size: int, height: int, background: str | None) -> Image.Image:
        canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
        resized = mark_at_height(height)
        canvas.alpha_composite(resized, ((size - resized.width) // 2, (size - height) // 2))
        return canvas if background is None else canvas.convert("RGB")

    outputs = []

    def save(image: Image.Image, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, optimize=True)
        outputs.append({"path": str(path.relative_to(ROOT)), "width": image.width,
                        "height": image.height, "mode": image.mode,
                        "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})

    icon = centered_mark(1024, 720, BLUE)
    save(icon, ASSETS / "push-office-icon.png")
    save(icon.resize((512, 512), Image.Resampling.LANCZOS), ASSETS / "push-office-store-icon.png")
    save(icon.resize((512, 512), Image.Resampling.LANCZOS), STORE / "app-icon.png")
    # The entire mark fits a 620 px circle centered in the 1024 px foreground,
    # inside the Android adaptive icon's 66/108 safe circle (625.8 px).
    adaptive_height = math.floor(620 / math.sqrt(1 + (mark.width / mark.height) ** 2))
    adaptive = centered_mark(1024, adaptive_height, None)
    save(adaptive, ASSETS / "push-office-adaptive-foreground.png")
    monochrome = Image.new("RGBA", adaptive.size, (255, 255, 255, 0))
    monochrome.putalpha(adaptive.getchannel("A"))
    save(monochrome, ASSETS / "push-office-adaptive-monochrome.png")
    save(icon.resize((64, 64), Image.Resampling.LANCZOS), ASSETS / "push-office-favicon.png")
    save(centered_mark(1024, 720, None), ASSETS / "push-office-splash.png")

    feature = Image.new("RGB", (1024, 500), BLUE)
    put_text(feature, (62, 78), "Push Office", 55, "white", True)
    put_text(feature, (64, 180), "빠르게 기록하고,", 39, "white", True)
    put_text(feature, (64, 238), "하루를 정리하세요", 39, "white", True)
    put_text(feature, (65, 378), "일정 · 알림 · 위젯", 25, "white")
    feature_mark = mark_at_height(288)
    feature.paste(feature_mark, (704, 106), feature_mark)
    save(feature, STORE / "feature-graphic.png")

    screen_manifest = []
    for filename, caption in CAPTURES:
        source_path = args.captures / filename
        source = Image.open(source_path).convert("RGB")
        # Proportional fit of the entire source: status/navigation bars retained.
        fitted = source.copy()
        fitted.thumbnail((900, 1540), Image.Resampling.LANCZOS)
        screen = Image.new("RGB", (1080, 1920), NEUTRAL)
        put_text(screen, (76, 73), "Push Office", 30, BLUE, True)
        put_text(screen, (76, 143), caption, 52, "#172536", True)
        put_text(screen, (78, 238), "예시 일정 · 실제 앱 화면", 25, "#617083")
        position = ((1080 - fitted.width) // 2, 330)
        screen.paste(fitted, position)
        save(screen, STORE / "screenshots" / filename)
        screen_manifest.append({"source": filename, "source_width": source.width,
                                "source_height": source.height, "fitted_width": fitted.width,
                                "fitted_height": fitted.height, "x": position[0], "y": position[1],
                                "source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
                                "caption": caption})

    manifest = {"brand_blue": BLUE, "source_mark": "assets/images/push-office-mark.png",
                "source_mark_sha256": hashlib.sha256((ASSETS / "push-office-mark.png").read_bytes()).hexdigest(),
                "mark_crop": list(bounds), "adaptive_safe_circle_diameter": 620,
                "screenshots": screen_manifest, "outputs": outputs}
    (STORE / "export-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    for item in outputs:
        print(f"{item['path']}: {item['width']}x{item['height']} {item['mode']}")


if __name__ == "__main__":
    main()
