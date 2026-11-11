#!/usr/bin/env python3
"""Draw the kmwo icon: a blue dumbbell on a dark tile. Run after changing it:

    python scripts/make_icons.py

Writes the PNGs phones use for Add to Home Screen, and icon.svg for the
browser tab. Needs Pillow (pip install pillow); the site itself doesn't.

    site/icon.svg               browser tab
    site/icon-180.png           iOS home screen (full square; iOS rounds it)
    site/icon-192.png           Android, "any"
    site/icon-512.png           Android, "any"
    site/icon-512-maskable.png  Android, "maskable" (art inside the safe circle)
"""
from pathlib import Path

from PIL import Image, ImageDraw

SITE = Path(__file__).resolve().parent.parent / "site"
BG = "#111418"
FG = "#2f6fed"

# Dumbbell on a 100-unit canvas: (x0, y0, x1, y1, radius)
SHAPES = [
    (22, 47, 78, 53, 2),   # bar
    (16, 30, 28, 70, 4),   # left plate
    (72, 30, 84, 70, 4),   # right plate
    (8, 38, 18, 62, 3),    # left outer plate
    (82, 38, 92, 62, 3),   # right outer plate
]


def draw(size, scale=1.0, rounded=True):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=size * 0.22 if rounded else 0, fill=BG)
    k = size / 100 * scale
    off = size * (1 - scale) / 2
    for x0, y0, x1, y1, r in SHAPES:
        d.rounded_rectangle((off + x0 * k, off + y0 * k, off + x1 * k, off + y1 * k), radius=r * k, fill=FG)
    return img


def svg():
    rects = "".join(
        f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" rx="{r}" fill="{FG}"/>'
        for x0, y0, x1, y1, r in SHAPES
    )
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            f'<rect width="100" height="100" rx="22" fill="{BG}"/>{rects}</svg>\n')


def main():
    draw(180, rounded=False).save(SITE / "icon-180.png")
    draw(192).save(SITE / "icon-192.png")
    draw(512).save(SITE / "icon-512.png")
    draw(512, scale=0.72, rounded=False).save(SITE / "icon-512-maskable.png")
    (SITE / "icon.svg").write_text(svg(), encoding="utf-8")
    print("Wrote icons to", SITE)


if __name__ == "__main__":
    main()
