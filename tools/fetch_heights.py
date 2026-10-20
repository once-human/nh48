# Google Open Buildings 2.5D Temporal (2023): building height + presence rasters for the play area,
# read straight from the public bucket (Cloud-Optimised GeoTIFFs) at 1 m and saved locally.
#   python3 tools/fetch_heights.py   -> data/raw/heights/pune_2023_1m.npz
# Licence: CC BY 4.0 / ODbL (Google Research, Open Buildings 2.5D Temporal).
import numpy as np, rasterio, os
from rasterio.windows import from_bounds
from pyproj import Transformer
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data/raw/heights/pune_2023_1m.npz')
tr = Transformer.from_crs('EPSG:4326', 'EPSG:32643', always_xy=True)
x0, y0 = tr.transform(73.826, 18.506); x1, y1 = tr.transform(73.904, 18.548)
x0, y0, x1, y1 = [round(v) - (round(v) % 2) for v in (x0 - 20, y0 - 20, x1 + 20, y1 + 20)]
W, H = (x1 - x0), (y1 - y0)            # 1 m pixels
height = np.full((H, W), np.nan, np.float32); pres = np.zeros((H, W), np.float32)
base = '/vsicurl/https://storage.googleapis.com/open-buildings-temporal-data/v1/geotiffs/3bc2c_2023_06_30/'
for t in ('tile_L2SatnJj5Ko.tif', 'tile_sLUpHHDznnw.tif'):
    with rasterio.open(base + t) as ds:
        b = ds.bounds
        ix0, iy0, ix1, iy1 = max(x0, b.left), max(y0, b.bottom), min(x1, b.right), min(y1, b.top)
        if ix0 >= ix1 or iy0 >= iy1: continue
        win = from_bounds(ix0, iy0, ix1, iy1, ds.transform)
        w, h = int(ix1 - ix0), int(iy1 - iy0)
        hb = ds.read(2, window=win, out_shape=(h, w)); pb = ds.read(3, window=win, out_shape=(h, w))
        r0, c0 = int(y1 - iy1), int(ix0 - x0)
        m = hb > -90
        height[r0:r0 + h, c0:c0 + w][m] = hb[m]; pres[r0:r0 + h, c0:c0 + w] = np.maximum(pres[r0:r0 + h, c0:c0 + w], np.where(pb > -90, pb, 0))
        print(t, 'read', w, h, flush=True)
np.savez_compressed(OUT, height=height, presence=pres, x0=x0, y1=y1)
print('saved', OUT, height.shape, 'valid', np.isfinite(height).mean())
