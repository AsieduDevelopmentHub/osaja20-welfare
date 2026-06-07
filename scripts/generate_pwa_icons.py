#!/usr/bin/env python3
"""Generate raster PWA icons (192/512) for older Android and install prompts."""

from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("Install Pillow first: pip install pillow") from exc

NAVY = (10, 45, 110, 255)
GOLD = (201, 162, 39, 255)
WHITE = (255, 255, 255, 255)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "web" / "member-app" / "public" / "icons"


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("arial.ttf", "Arial.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_icon(size: int, *, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), NAVY)
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.12) if maskable else int(size * 0.06)
    inner = size - 2 * pad
    cx = size // 2
    cy = size // 2
    stroke = max(3, size // 48)
    head_r = int(inner * 0.17)
    head_cy = cy - int(inner * 0.1)
    draw.ellipse(
        [cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r],
        outline=GOLD,
        width=stroke,
    )
    body_box = [cx - int(inner * 0.32), head_cy + head_r, cx + int(inner * 0.32), cy + int(inner * 0.42)]
    draw.arc(body_box, 200, 340, fill=GOLD, width=stroke)
    font = _font(max(14, int(size * 0.11)))
    draw.text((cx, cy + int(inner * 0.28)), "20", fill=WHITE, font=font, anchor="mm")
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(192).convert("RGB").save(OUT / "icon-192.png", optimize=True)
    draw_icon(512).convert("RGB").save(OUT / "icon-512.png", optimize=True)
    draw_icon(512, maskable=True).convert("RGB").save(OUT / "icon-maskable-512.png", optimize=True)
    print(f"Wrote PNG icons to {OUT}")


if __name__ == "__main__":
    main()
