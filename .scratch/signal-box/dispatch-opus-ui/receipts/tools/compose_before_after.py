"""Compose the before/after comparison: same two demo states, same 1920x1080 viewport, old UI left, new UI right."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

before_dir, after_dir, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
FONTS = Path.home() / ".claude/skills/onetake/looks/fonts"
INK, MUTE, BRASS, RED, GREEN, GROUND = "#EFE8D6", "#8C938A", "#C9A35B", "#E8503F", "#5FE0A0", "#0B0F0D"


def face(name, size, instance=None, axes=None):
    f = ImageFont.truetype(str(FONTS / name), size)
    try:
        if axes is not None:
            f.set_variation_by_axes(axes)
        elif instance is not None:
            f.set_variation_by_name(instance)
    except (OSError, ValueError):
        pass
    return f


W, M, GAP = 2000, 40, 40
TW = (W - 2 * M - GAP) // 2
TH = round(TW * 1080 / 1920)
TOP = 170
ROW_GAP = 96
H = TOP + 2 * TH + ROW_GAP + 80

rows = [
    ("b1-north-to-bridge.png", "1920x1080-01-lever-frame-interlock.png", "State 1 · Lever #3 → #1 sets NORTH_TO_BRIDGE for Builder"),
    ("b4-replay-receipt.png", "1920x1080-04-trial-receipt-verified.png", "State 4 · cursed table, replay step 3: collision + PBT Trial Receipt"),
]

canvas = Image.new("RGB", (W, H), GROUND)
d = ImageDraw.Draw(canvas)
title = face("Fraunces.ttf", 46, instance="SemiBold")
mono = face("GeistMono.ttf", 18)
caps = face("Archivo.ttf", 17, instance="SemiBold")
d.text((M, 34), "Signal Box · Live Demo UI — before / after", font=title, fill=INK)
d.text((M + 2, 98), "same app states · same 1920×1080 viewport · production build (next start)", font=mono, fill=MUTE)

for col, (label, sub, color) in enumerate([
    ("BEFORE", "inline-style admin panel", RED),
    ("AFTER", "lamp-and-brass signal box", GREEN),
]):
    x = M + col * (TW + GAP)
    d.text((x, 138), label, font=caps, fill=color)
    d.text((x + 86, 139), sub, font=mono, fill=MUTE)

for r, (before_name, after_name, caption) in enumerate(rows):
    y = TOP + r * (TH + ROW_GAP)
    for col, path in enumerate([before_dir / before_name, after_dir / after_name]):
        x = M + col * (TW + GAP)
        tile = Image.open(path).convert("RGB").resize((TW, TH), Image.LANCZOS)
        canvas.paste(tile, (x, y))
        d.rectangle((x - 1, y - 1, x + TW, y + TH), outline="#5B4A2C", width=1)
    d.text((M, y + TH + 18), caption, font=mono, fill=BRASS)

out.parent.mkdir(parents=True, exist_ok=True)
canvas.save(out, optimize=True)
print(out, canvas.size)
