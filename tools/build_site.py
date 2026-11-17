import json, re
import numpy as np
from PIL import Image, ImageFilter

# Builds public/tv/ from the Blender passes in renders/ and the page template in src/.
# Run from anywhere:  python3 tools/build_site.py
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
R = str(ROOT / 'renders') + '/'
D = str(ROOT / 'public' / 'tv') + '/'   # served by Next.js at / (see next.config.ts)
T = str(ROOT / 'src') + '/'
geo = json.load(open(R + 'base.png.json'))
RW, RH = 3840, 2160
REFL = 0.3   # how much of the glass reflections stays visible over the picture

def arr(p, mode='RGB'):
    return np.asarray(Image.open(R + p).convert(mode)).astype(np.float32)

def feather_box(box, inset, blur):
    m = Image.new('L', (RW, RH), 0)
    x0, y0, x1, y1 = [round(v) for v in (box[0] * RW, box[1] * RH, box[2] * RW, box[3] * RH)]
    m.paste(255, (x0 + inset, y0 + inset, x1 - inset, y1 - inset))
    return np.asarray(m.filter(ImageFilter.GaussianBlur(blur))).astype(np.float32)[..., None] / 255

base = arr('base.png')

# --- screen mask
a = arr('mask.png', 'RGBA')[..., 3]
ys, xs = np.where(a > 128)
x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
clean = np.zeros_like(a); clean[y0:y1, x0:x1] = a[y0:y1, x0:x1]
# cut off the slivers of phosphor seen through the gap above/below the curved glass (thin coloured streaks):
# no column may reach higher/lower than the typical top/bottom edge of the picture
_on = clean > 128
_cols = np.where(_on.any(0))[0]
_tops = np.array([np.argmax(_on[:, c]) for c in _cols]); _bots = np.array([RH - 1 - np.argmax(_on[::-1, c]) for c in _cols])
_mid = slice(len(_cols) // 5, len(_cols) * 4 // 5)
_T = int(np.median(_tops[_mid])) + 3; _B = int(np.median(_bots[_mid])) - 3
clean[:_T, :] = 0; clean[_B + 1:, :] = 0
print('screen mask clipped to rows', _T, _B)
m = Image.new('RGBA', (x1 - x0, y1 - y0), (255, 255, 255, 0)); m.putalpha(Image.fromarray(clean[y0:y1, x0:x1].astype(np.uint8)))
m.save(D + 'screenmask.png', optimize=True)
sw, sh = x1 - x0, y1 - y0

# --- black tube: rendered only around the CRT, blended into the base, reflections toned down over the picture
f = feather_box(geo['crtbox'], 18, 8)
dark = base * (1 - f) + arr('dark.png') * f
sm = np.asarray(Image.fromarray(clean.astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[..., None] / 255
Image.fromarray(np.clip(dark * (1 - sm * (1 - REFL)), 0, 255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=1)).save(D + 'dark.webp', quality=90, method=6)

# --- tube light (outside the screen only)
sp = np.asarray(Image.open(R + 'spill.png').convert('L').resize((RW, RH), Image.BILINEAR)).astype(np.float32) / 255
# keep the light off the screen and off the black lip right around the glass (it showed as thin coloured streaks there)
_m = Image.fromarray(clean.astype(np.uint8)).resize((RW // 4, RH // 4), Image.BILINEAR).filter(ImageFilter.MaxFilter(17))
dil = np.asarray(_m.resize((RW, RH), Image.BILINEAR).filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255
# light as alpha (no black anywhere), faded out well before the sides of the frame
xs_ = np.linspace(0, 1, RW)[None, :]; ys_ = np.linspace(0, 1, RH)[:, None]
win = np.clip((0.47 - np.abs(xs_ - 0.5)) / 0.17, 0, 1) * np.clip((1.0 - ys_) / 0.07, 0, 1)
alpha = (np.clip(sp * (1 - dil) * win, 0, 1) * 255).astype(np.uint8)
im = Image.new('RGBA', (RW, RH), (255, 255, 255, 0)); im.putalpha(Image.fromarray(alpha))
# soft light: smooth it (no render noise can survive) and keep it big and lightly compressed, so it never shows blocks
sm_al = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(6))
im = Image.new('RGBA', (RW, RH), (255, 255, 255, 0)); im.putalpha(sm_al)
im.resize((1600, 900), Image.LANCZOS).save(D + 'spill.webp', quality=95, alpha_quality=100, method=6)

# --- one pressed image per key
keys = arr('keys.png')
pressed, buttons, shades = [], [], []
labels = ['Info', 'Previous channel', 'Next channel', 'Power']
for i, k in enumerate(geo['keys']):
    bx = k['box']
    px0, py0, px1, py1 = round(bx[0] * RW), round(bx[1] * RH), round(bx[2] * RW), round(bx[3] * RH)
    crop = keys[py0:py1, px0:px1]
    diff = np.abs(crop - base[py0:py1, px0:px1]).mean()
    al = Image.new('L', (px1 - px0, py1 - py0), 0); al.paste(255, (7, 7, px1 - px0 - 7, py1 - py0 - 7))
    al = al.filter(ImageFilter.GaussianBlur(2.5))
    im = Image.fromarray(crop.astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=1)).convert('RGBA'); im.putalpha(al)
    im.save(D + f'key{i}.webp', quality=92, method=6)
    print('key', i, 'diff vs base', round(float(diff), 2))
    pressed.append('    <img class="pressed" src="key%d.webp" alt="" style="left:%.4f%%;top:%.4f%%;width:%.4f%%;height:%.4f%%">' % (
        i, px0 / RW * 100, py0 / RH * 100, (px1 - px0) / RW * 100, (py1 - py0) / RH * 100))
    shades.append('    <div class="shade" style="left:%.4f%%;top:%.4f%%"></div>' % (k['c'][0] * 100, k['c'][1] * 100))
    buttons.append('    <button class="btn" style="left:%.4f%%;top:%.4f%%" aria-label="%s"></button>' % (k['c'][0] * 100, k['c'][1] * 100, labels[i]))
step = geo['keys'][1]['c'][0] - geo['keys'][0]['c'][0]

# --- backdrop column
col = []
for i in range(13):
    y = min(RH - 1, round(i / 12 * (RH - 1)))
    p = base[max(0, y - 4):min(RH, y + 5), 2:30].reshape(-1, 3).mean(0)
    col.append('#%02x%02x%02x %.1f%%' % (*p.astype(int), i / 12 * 100))

# --- pixel sprite from the SVG
svg = open(T + 'screensaver-sprite.svg').read()
cols = dict(re.findall(r'\.(cls-\d)\s*\{\s*fill:\s*(#[0-9a-fA-F]+)', svg))
rects = re.findall(r'<rect class="(cls-\d)" x="([\d.]+)" y="([\d.]+)"', svg)
xs_ = sorted({float(r[1]) for r in rects}); ys_ = sorted({float(r[2]) for r in rects})
st = 14.93
px = [[round((float(x) - xs_[0]) / st), round((float(y) - ys_[0]) / st), cols[c]] for c, x, y in rects]
sprite = {'w': max(p[0] for p in px) + 1, 'h': max(p[1] for p in px) + 1, 'px': px}
print('sprite', sprite['w'], sprite['h'], len(px))

rep = {
    'TOP': col[0].split()[0], 'BOTTOM': col[-1].split()[0], 'COLUMN': ', '.join(col),
    'SX': '%.4f' % (x0 / RW * 100), 'SY': '%.4f' % (y0 / RH * 100), 'SW': '%.4f' % (sw / RW * 100), 'SH': '%.4f' % (sh / RH * 100),
    'CH': str(round(400 * sh / sw)), 'BW': '%.4f' % (step * 100), 'BH': '%.4f' % (step * 100 * 16 / 9 * 1.25),
    'PRESSED': '\n'.join(pressed), 'SHADES': '\n'.join(shades), 'CW': '%.4f' % (step * 100 * .765), 'CHH': '%.4f' % (step * 100 * .765 * 16 / 9), 'BUTTONS': '\n'.join(buttons), 'SPRITE': json.dumps(sprite, separators=(',', ':')),
    'AUDIO': open(T + 'audio.js').read(),
}
html = open(T + 'template.html').read()
for k, v in rep.items(): html = html.replace('{{' + k + '}}', v)
assert '{{' not in html
open(D + 'index.html', 'w').write(html)
