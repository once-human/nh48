# Real building heights from Google Open Buildings 2.5D Temporal (2023, CC BY 4.0 / ODbL).
#   python3 tools/fetch_heights.py      (once: downloads data/raw/heights/pune_2023_1m.npz)
#   python3 tools/bake_heights.py       (after bake_map.py; rewrites levels in data/map.json)
# For each footprint the height is the 70th percentile of the 1 m height raster over the pixels
# the model is confident are building. Floors = height / 3.1 m. OSM buildings that carry a
# human-entered building:levels tag keep it. Styles that contradict the real height are corrected
# (a "bungalow" that is really six storeys becomes an apartment block).
import json, os, math, collections, sys
import numpy as np
from pyproj import Transformer
from shapely.geometry import Polygon
from shapely.strtree import STRtree
from rasterio.features import rasterize
from rasterio.transform import from_origin
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MAP = os.path.join(ROOT, 'data/map.json')
M = json.load(open(MAP)); meta = M['meta']
R = np.load(os.path.join(ROOT, 'data/raw/heights/pune_2023_1m.npz'))
H, PR, X0, Y1 = R['height'], R['presence'], float(R['x0']), float(R['y1'])
tr = Transformer.from_crs('EPSG:4326', 'EPSG:32643', always_xy=True)
def to_utm(x, z):                       # game metres -> UTM
    lon = x / meta['mlon'] + meta['lon0']; lat = -z / meta['mlat'] + meta['lat0']
    return tr.transform(lon, lat)

# OSM buildings with a tagged level count keep it
D = json.load(open(os.path.join(ROOT, 'data/raw/merged.json')))
def proj(lat, lon): return ((lon - meta['lon0']) * meta['mlon'], -(lat - meta['lat0']) * meta['mlat'])
P = {int(k): proj(v[0], v[1]) for k, v in D['nodes'].items()}
tagged = []
for w in D['ways'].values():
    t = w.get('tags', {})
    if 'building' in t and t.get('building:levels', '').replace('.', '').isdigit():
        pts = [P[n] for n in w['nd'] if n in P]
        if len(pts) >= 4:
            g = Polygon(pts)
            tagged.append(g if g.is_valid else g.buffer(0))
ttree = STRtree(tagged)

FH = 3.1
stats = collections.Counter(); hs = []
for b in M['buildings']:
    r = b[1]
    pts = [(r[k] / 100, r[k + 1] / 100) for k in range(0, len(r), 2)]
    if len(pts) < 3: continue
    poly = Polygon(pts)
    if not poly.is_valid: poly = poly.buffer(0)
    if any(tagged[j].intersection(poly).area > 0.6 * poly.area for j in ttree.query(poly)):
        stats['osm tagged'] += 1; continue
    up = [to_utm(x, z) for x, z in pts]
    xs = [u[0] for u in up]; ys = [u[1] for u in up]
    c0, c1 = int(math.floor(min(xs) - X0)), int(math.ceil(max(xs) - X0)) + 1
    r0, r1 = int(math.floor(Y1 - max(ys))), int(math.ceil(Y1 - min(ys))) + 1
    if c0 < 0 or r0 < 0 or c1 > H.shape[1] or r1 > H.shape[0]: stats['outside raster'] += 1; continue
    mask = rasterize([Polygon(up)], out_shape=(r1 - r0, c1 - c0), transform=from_origin(X0 + c0, Y1 - r0, 1, 1), all_touched=False).astype(bool)
    if mask.sum() < 3:
        mask = rasterize([Polygon(up)], out_shape=(r1 - r0, c1 - c0), transform=from_origin(X0 + c0, Y1 - r0, 1, 1), all_touched=True).astype(bool)
    hh, pp = H[r0:r1, c0:c1][mask], PR[r0:r1, c0:c1][mask]
    good = np.isfinite(hh) & (pp > 0.5)
    if good.sum() < max(3, 0.25 * mask.sum()): stats['model unsure'] += 1; continue
    h = float(np.percentile(hh[good], 70))
    lv = max(1, min(30, int(round(h / FH))))
    old = b[2]; b[2] = lv; hs.append(h); stats['from 2.5D'] += 1
    st = b[3]
    if st == 3 and lv >= 4: b[3] = 0; stats['bungalow -> apartment'] += 1
    elif st == 2 and lv >= 6: b[3] = 0; stats['old -> apartment'] += 1
    elif st == 6 and h > 5: b[3] = 2 if b[8] else 0; stats['shed -> house'] += 1
    if abs(old - lv) >= 2: stats['changed by 2+ floors'] += 1
print(dict(stats))
hs = np.array(hs)
print('height m: p10 %.1f p50 %.1f p90 %.1f p99 %.1f max %.1f' % tuple(np.percentile(hs, [10, 50, 90, 99, 100])))
M['meta']['attribution'] = M['meta'].get('attribution', '') + ('' if '2.5D' in M['meta'].get('attribution', '') else '; heights: Google Open Buildings 2.5D Temporal (CC BY 4.0)')
if '--dry' not in sys.argv:
    json.dump(M, open(MAP, 'w'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', MAP)
