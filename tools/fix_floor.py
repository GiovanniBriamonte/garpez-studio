"""Evens out the darker band on the studio floor where it meets the sweep (at the TV's base level).
Reads renders/base_raw.png, writes renders/base.png. The TV and its soft shadow are left untouched.
Run after rendering the 'base' pass:  python3 tools/fix_floor.py"""
from pathlib import Path
import shutil
import numpy as np
from PIL import Image

R = Path(__file__).resolve().parents[1] / 'renders'
a = np.asarray(Image.open(R / 'base_raw.png').convert('RGB')).astype(np.float32)
L = a.mean(2); H, W = L.shape
sy = H / 2160                                  # rows below are tuned on the 3840x2160 render
y0, y1 = int(1680 * sy), int(1940 * sy)
ref = np.median(L[y0 + 20:y1 - 20, int(60 * sy):int(400 * sy)], axis=1)
diff = np.abs(L[y0 + 20:y1 - 20] - ref[:, None]).mean(0)
tv = np.where(diff > 12)[0]; x0, x1 = tv.min() - 30, tv.max() + 30
outside = np.r_[60:x0 - 60, x1 + 60:W - 60]
meas = np.median(L[y0:y1][:, outside], axis=1)
t = np.linspace(0, 1, y1 - y0); target = meas[0] * (1 - t) + meas[-1] * t
gain = np.maximum(target / meas, 1.0)
m = np.ones(W, np.float32)
for x in range(W):
    if x0 <= x <= x1: m[x] = 0
    elif x0 - 60 < x < x0: m[x] = (x0 - x) / 60
    elif x1 < x < x1 + 60: m[x] = (x - x1) / 60
a[y0:y1] *= (1 + (gain[:, None] - 1) * m[None, :])[..., None]
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(R / 'base.png')
if (R / 'base_raw.png.json').exists():
    shutil.copy(R / 'base_raw.png.json', R / 'base.png.json')
print('floor evened, max gain %.3f' % gain.max())
