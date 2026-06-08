#!/usr/bin/env python3
"""Generate PWA install icons from brand logo JPEGs (192/512/maskable/apple-touch)."""

from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:
    raise SystemExit("Install Pillow first: pip install pillow") from exc

ROOT = Path(__file__).resolve().parents[1]

APPS = (
    {
        "name": "member",
        "logo": ROOT / "apps/web/member-app/public/brand/welfare-logo.jpg",
        "out": ROOT / "apps/web/member-app/public/icons",
        "bg": (250, 248, 245, 255),  # brand cream
    },
    {
        "name": "admin",
        "logo": ROOT / "apps/web/admin-portal/public/brand/batch-logo.jpg",
        "out": ROOT / "apps/web/admin-portal/public/icons",
        "bg": (6, 29, 71, 255),  # brand navy dark
    },
)


def _fit_logo(logo: Image.Image, canvas_size: int, *, maskable: bool) -> Image.Image:
    pad_ratio = 0.2 if maskable else 0.1
    pad = int(canvas_size * pad_ratio)
    inner = canvas_size - 2 * pad
    logo = logo.convert("RGBA")
    logo.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    return logo


def _compose(logo_path: Path, size: int, bg: tuple[int, int, int, int], *, maskable: bool) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg)
    logo = Image.open(logo_path)
    fitted = _fit_logo(logo, size, maskable=maskable)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def generate_set(logo_path: Path, out_dir: Path, bg: tuple[int, int, int, int]) -> None:
    if not logo_path.is_file():
        raise FileNotFoundError(f"Logo not found: {logo_path}")

    out_dir.mkdir(parents=True, exist_ok=True)
    sizes = (
        (192, "icon-192.png", False),
        (512, "icon-512.png", False),
        (512, "icon-maskable-512.png", True),
        (180, "apple-touch-icon.png", False),
    )
    for size, filename, maskable in sizes:
        img = _compose(logo_path, size, bg, maskable=maskable)
        img.convert("RGB").save(out_dir / filename, optimize=True)
        print(f"  {out_dir / filename}")


def main() -> None:
    for app in APPS:
        print(f"Generating {app['name']} PWA icons from {app['logo'].name} …")
        generate_set(app["logo"], app["out"], app["bg"])
    print("Done.")


if __name__ == "__main__":
    main()
