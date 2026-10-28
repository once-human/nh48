#!/usr/bin/env python3
"""fetch_dem.py - Pune's ground elevation (the hills: Parvati, Taljai, Vetal Tekdi, Chaturshringi, Baner,
Pashan, Katraj) from the open terrain tiles on AWS (Terrarium encoding, SRTM-based; "Terrain Tiles" by
Mapzen / Linux Foundation, open data). Mosaics zoom-13 tiles (~18 m) into data/raw/dem/pune_z13.npz:
  h (rows north->south, cols west->east, metres above sea level), lon0, lat0 (the north-west corner), z
usage: python3 tools/fetch_dem.py"""
import math, os, io, urllib.request
import numpy as np
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
Z = 13
W, E_, S, N = 73.62, 74.14, 18.34, 18.80
def tx(lon): return (lon + 180) / 360 * 2 ** Z
def ty(lat): r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** Z
x0, x1, y0, y1 = int(tx(W)), int(tx(E_)), int(ty(N)), int(ty(S))
H = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1):
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'
        im = np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=30).read())).convert('RGB')).astype(np.float32)
        H[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
    print('row', y - y0 + 1, 'of', y1 - y0 + 1, flush=True)
# the mosaic's corner, back in degrees
def lon_of(px): return px / 2 ** Z * 360 - 180
def lat_of(py): n = math.pi - 2 * math.pi * py / 2 ** Z; return math.degrees(math.atan(math.sinh(n)))
np.savez_compressed(os.path.join(ROOT, 'data/raw/dem/pune_z13.npz'), h=H, x0=x0, y0=y0, z=Z)
print('saved', H.shape, 'elev', H.min(), H.max(), 'corner', lat_of(y0), lon_of(x0))
