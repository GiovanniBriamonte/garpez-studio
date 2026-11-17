import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'build', 'tex')
os.makedirs(TEX, exist_ok=True)

# 1. High-res 2x micro-silkscreen labels above the 4 compact buttons
W_tex, H_tex = 4736, 1800
img = Image.new('RGBA', (W_tex, H_tex), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

FONT_CANDIDATES = [
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',      # macOS
    '/Library/Fonts/Arial Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',   # Linux
    'C:/Windows/Fonts/arialbd.ttf',                           # Windows
]
font_path = next(p for p in FONT_CANDIDATES if os.path.exists(p))
font = ImageFont.truetype(font_path, 140)

x_min, x_max = 0.0966, 0.2150
z_min, z_max = -0.2050, -0.1600

def to_px(wx, wz):
    px = (wx - x_min) / (x_max - x_min) * W_tex
    py = (z_max - wz) / (z_max - z_min) * H_tex
    return px, py

labels = [
    (0.1052, -0.1690, "INFO"),
    (0.1362, -0.1690, "CH-"),
    (0.1672, -0.1690, "CH+"),
    (0.1982, -0.1690, "POWER"),
]

def draw_tracked_text(draw, cx, cy, text, font, fill, tracking=8):
    widths = [draw.textlength(ch, font=font) for ch in text]
    total_w = sum(widths) + tracking * (len(text) - 1)
    bbox = font.getbbox("Ag")
    h = bbox[3] - bbox[1]
    x = cx - total_w / 2.0
    y = cy - h / 2.0 - bbox[1]
    for i, ch in enumerate(text):
        draw.text((x, y), ch, font=font, fill=fill)
        x += widths[i] + tracking

for wx, wz, txt in labels:
    px, py = to_px(wx, wz)
    draw_tracked_text(draw, px, py, txt, font, (242, 244, 247, 255), tracking=8)

img.save(os.path.join(TEX, 'silkscreen_labels.png'))

# 2. Realistic studio softbox scrim texture (organic multi-bank studio softbox with soft bottom fade)
sw, sh = 1024, 512
yy, xx = np.mgrid[0:sh, 0:sw]
nx = (xx / (sw - 1)) * 2.0 - 1.0
ny = (yy / (sh - 1)) * 2.0 - 1.0  # -1 at top, +1 at bottom (UV V=0 at bottom -> ny=+1)

# Soft horizontal perimeter falloff + gentle vertical falloff toward bottom of softbox
falloff_x = np.clip(1.0 - (np.abs(nx) ** 3.2), 0.0, 1.0)
falloff_top = np.clip(1.0 - (np.maximum(0.0, -ny) ** 3.0), 0.0, 1.0)
# Smooth bottom gradient fade (mimics studio softbox curved reflection fading down the CRT glass)
falloff_bot = np.clip(1.0 - (np.maximum(0.0, (ny + 0.15) / 1.15) ** 1.8), 0.0, 1.0)
falloff = falloff_x * falloff_top * falloff_bot

# Subtle internal softbox baffle ribs (3-panel studio bank feel)
rib1 = 1.0 - 0.24 * np.exp(-((nx + 0.34) / 0.075)**2)
rib2 = 1.0 - 0.22 * np.exp(-((nx - 0.32) / 0.075)**2)
scrim = np.clip(falloff * rib1 * rib2, 0.0, 1.0)

rgb = np.zeros((sh, sw, 3), dtype=np.uint8)
rgb[:, :, 0] = np.clip(scrim * 255, 0, 255).astype(np.uint8)
rgb[:, :, 1] = np.clip(scrim * 253, 0, 255).astype(np.uint8)
rgb[:, :, 2] = np.clip(scrim * 250, 0, 255).astype(np.uint8)
Image.fromarray(rgb).save(os.path.join(TEX, 'softbox_scrim.png'))
print("Textures regenerated.")
