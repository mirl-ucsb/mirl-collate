#!/usr/bin/env python3
"""Generate the sample images that ship with MIRL Collate.

Two "states" of one building facade, drawn from scratch with Pillow so there
are no external downloads and no licensing questions. State B differs from
state A in three small, localized ways (a bricked-up window, an added parapet
band, a different awning colour) so that the blink, swipe, and difference
views have something to reveal.

    python3 make-samples.py

Writes facade-a.png and facade-b.png next to this script.
"""

import os
from PIL import Image, ImageDraw

W, H = 1600, 1200
HERE = os.path.dirname(os.path.abspath(__file__))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_sky(d):
    top, bot = (120, 168, 214), (210, 228, 242)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp(top, bot, y / H))


def draw_window(d, x, y, w, h, bricked=False):
    frame = (238, 236, 228)
    glass_top, glass_bot = (96, 120, 140), (54, 74, 96)
    if bricked:  # window filled in: infill slightly off from the wall
        d.rectangle([x, y, x + w, y + h], fill=(176, 150, 116))
        for by in range(y, y + h, 10):
            d.line([(x, by), (x + w, by)], fill=(150, 128, 98), width=1)
        d.rectangle([x, y, x + w, y + h], outline=(150, 128, 98), width=3)
        return
    d.rectangle([x - 4, y - 4, x + w + 4, y + h + 8], fill=frame)  # sill + frame
    for i in range(h):
        d.line([(x, y + i), (x + w, y + i)], fill=lerp(glass_top, glass_bot, i / h))
    d.line([(x + w // 2, y), (x + w // 2, y + h)], fill=frame, width=4)  # muntins
    d.line([(x, y + h // 2), (x + w, y + h // 2)], fill=frame, width=4)
    d.rectangle([x, y, x + w, y + h], outline=frame, width=4)


def draw_facade(variant="a"):
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_sky(d)
    d.rectangle([0, H - 120, W, H], fill=(122, 120, 124))  # pavement

    bx0, by0, bx1, by1 = 180, 150, W - 180, H - 120  # building body
    d.rectangle([bx0, by0, bx1, by1], fill=(198, 168, 128))
    for y in range(by0, by1, 26):  # mortar courses
        d.line([(bx0, y), (bx1, y)], fill=(184, 156, 118), width=1)

    d.rectangle([bx0 - 14, by0 - 22, bx1 + 14, by0], fill=(170, 142, 104))  # cornice
    d.rectangle([bx0 - 14, by0 - 22, bx1 + 14, by0 - 18], fill=(150, 124, 90))
    if variant == "b":  # added parapet band
        d.rectangle([bx0 - 14, by0 - 54, bx1 + 14, by0 - 22], fill=(158, 132, 98))
        d.rectangle([bx0 - 14, by0 - 54, bx1 + 14, by0 - 50], fill=(140, 116, 84))

    cols, rows, margin_x, margin_top, gap_x, gap_y = 4, 3, 70, 60, 40, 46
    ww = ((bx1 - bx0) - 2 * margin_x - (cols - 1) * gap_x) // cols
    wh = int(ww * 1.5)
    for r in range(rows):
        for c in range(cols):
            x = bx0 + margin_x + c * (ww + gap_x)
            y = by0 + margin_top + r * (wh + gap_y)
            draw_window(d, x, y, ww, wh, bricked=(variant == "b" and r == 0 and c == 2))

    dw, dh = 150, 230  # arched door
    dx, dy = (W - dw) // 2, by1 - dh
    d.rectangle([dx, dy + 30, dx + dw, by1], fill=(108, 72, 46))
    d.pieslice([dx, dy, dx + dw, dy + 60], 180, 360, fill=(108, 72, 46))
    d.rectangle([dx + dw // 2 - 3, dy + 30, dx + dw // 2 + 3, by1], fill=(80, 52, 32))
    awn = (140, 60, 55) if variant == "a" else (60, 110, 120)  # awning colour differs
    d.polygon([(dx - 30, dy + 8), (dx + dw + 30, dy + 8),
               (dx + dw + 10, dy - 28), (dx - 10, dy - 28)], fill=awn)
    d.rectangle([dx - 40, by1, dx + dw + 40, by1 + 18], fill=(150, 148, 150))  # steps
    return img


if __name__ == "__main__":
    for v in ("a", "b"):
        out = os.path.join(HERE, f"facade-{v}.png")
        draw_facade(v).save(out)
        print("wrote", out)
