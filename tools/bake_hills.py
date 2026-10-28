#!/usr/bin/env python3
"""bake_hills.py - Pune's hills, in the streamed tiles and on the horizon.

The city is built flat (roads, buildings, footpaths at ground level) but Pune sits among hills: Vetal Tekdi
and the ARAI hill above Kothrud and SB Road, Chaturshringi, Parvati, Taljai, Baner and Pashan hills, the
Katraj ghat. This raises them where nothing is built:
  rel   = ground elevation (data/raw/dem/pune_z13.npz, tools/fetch_dem.py) minus the city's own level there
          (a smooth surface through the elevations of the roads, so a gently sloping city stays flat)
  hill  = rel above 3 m, faded to nothing within ~50 m of any road, footpath, building or water, so streets,
          houses and their compounds keep their level and the slopes rise behind them
Out:
  every data/pune/t_*.json.gz with a hill gets  hill: [step_m, n, base64 uint16 LE heights (0.1 m), n*n row-major
     from the tile's north-west corner (z rows, x columns)]
  data/pune/base.json.gz  hills: [step_m, nx, nz, x0, z0, base64 uint16 (0.1 m)]: the far field, eroded so it
     is never higher than the detailed tiles anywhere it overlaps them
usage: python3 tools/bake_hills.py   (after tools/fetch_dem.py; any time after the tiles are baked)"""
import gzip, json, glob, math, os, base64
import numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw
import duckdb, shapely
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LAT0, LON0, MLAT, MLON = 18.527, 73.865, 110686.0, 105589.0
B = json.load(gzip.open(os.path.join(ROOT, 'data/pune/base.json.gz')))
VX0, VZ0, VX1, VZ1 = (v / 100 for v in B['meta']['vis'])

# ---------------------------------------------------------------- elevation, and the city's own level (20 m grid)
D = np.load(os.path.join(ROOT, 'data/raw/dem/pune_z13.npz'))
H, DX0, DY0, Z = D['h'], int(D['x0']), int(D['y0']), int(D['z'])
def dem(x, z):
    lon, lat = x / MLON + LON0, -z / MLAT + LAT0
    px = (lon + 180) / 360 * 2 ** Z * 256 - DX0 * 256
    r = np.radians(lat); py = (1 - np.log(np.tan(r) + 1 / np.cos(r)) / np.pi) / 2 * 2 ** Z * 256 - DY0 * 256
    return ndimage.map_coordinates(H, [py - 0.5, px - 0.5], order=1, mode='nearest')
G = 20.0
xs, zs = np.arange(VX0, VX1 + G, G), np.arange(VZ0, VZ1 + G, G)
XX, ZZ = np.meshgrid(xs, zs)
E = dem(XX, ZZ).astype(np.float32)
con = duckdb.connect(); con.sql('load spatial')
geoms = con.sql("""select ST_AsWKB(geometry) from 'data/raw/pune/segment.parquet' where subtype = 'road'
                   and class not in ('footway', 'path', 'track', 'steps', 'cycleway', 'bridleway', 'pedestrian', 'unknown')""").fetchall()
pts = shapely.get_coordinates(shapely.segmentize(shapely.from_wkb([bytes(g[0]) for g in geoms]), 0.0002))
gx = (((pts[:, 0] - LON0) * MLON - VX0) / G).astype(int); gz = ((-(pts[:, 1] - LAT0) * MLAT - VZ0) / G).astype(int)
ok = (gx >= 0) & (gx < len(xs)) & (gz >= 0) & (gz < len(zs))
road = np.zeros(E.shape, bool); road[gz[ok], gx[ok]] = True
def smooth(sig):
    w = ndimage.gaussian_filter(road.astype(np.float32), sig); v = ndimage.gaussian_filter(np.where(road, E, 0).astype(np.float32), sig)
    return w, v / np.maximum(w, 1e-6)
w1, b1 = smooth(30); w2, b2 = smooth(120)
base = np.where(w1 > 0.02, b1, b2)
rel20 = (E - base).astype(np.float32)
del XX, ZZ, E, base, w1, b1, w2, b2
print('relative elevation ready', rel20.shape, flush=True)

# ---------------------------------------------------------------- what's built (8 m grid): roads, footpaths, buildings, water
S = 8.0
NX, NZ = int(round((VX1 - VX0) / S)) + 1, int(round((VZ1 - VZ0) / S)) + 1
img = Image.new('L', (NX, NZ), 0); dr = ImageDraw.Draw(img)
DEV = {'asphalt', 'concrete', 'pavers', 'plaza', 'median', 'bridge_road', 'bridge_sw'}
def px(r): return [((r[k] / 100 - VX0) / S, (r[k + 1] / 100 - VZ0) / S) for k in range(0, len(r) - 1, 2)]
tiles = sorted(glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz')))
for f in tiles:
    T = json.load(gzip.open(f))
    for kind, polys in T['ground']:
        if kind not in DEV: continue
        for ci, rings in polys:
            if len(rings[0]) >= 6: dr.polygon(px(rings[0]), fill=1)
    for ci, rings in T['water']:
        if len(rings[0]) >= 6: dr.polygon(px(rings[0]), fill=1)
# the landmark models stand on level ground
for L in json.load(open(os.path.join(ROOT, 'src/world/landmarks.json'))):
    c, s_ = math.cos(L['rot']), math.sin(L['rot'])
    ring = [((L['x'] + u * c - v * s_ - VX0) / S, (L['z'] + u * s_ + v * c - VZ0) / S) for u, v in L['outline']]
    dr.polygon(ring, fill=1)
dev = np.asarray(img, dtype=bool)
# buildings are not cut out of the hills: the ones on a hillside get lifted onto it (below)
lab_img = Image.new('I', (NX, NZ), 0); dl = ImageDraw.Draw(lab_img)
bids = [None]
for f in tiles:
    T = json.load(gzip.open(f))
    for bi, b in enumerate(T['buildings']):
        if len(b[1]) >= 6: bids.append((f, bi)); dl.polygon(px(b[1]), fill=len(bids) - 1)
lab = np.asarray(lab_img, dtype=np.int32)
del lab_img
print('built-up raster', dev.shape, dev.mean().round(3), flush=True)
dist = ndimage.distance_transform_edt(~dev).astype(np.float32) * S
del dev, img

# ---------------------------------------------------------------- the hills (8 m)
def sstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
zi, xi = np.mgrid[0:NZ, 0:NX].astype(np.float32)
rel = ndimage.map_coordinates(rel20, [zi * S / G, xi * S / G], order=3, mode='nearest').astype(np.float32)
del zi, xi
hill = np.maximum(rel - 3.0, 0) * sstep(6, 50, dist)
hill = ndimage.gaussian_filter(hill, 1.2) * sstep(3, 14, dist)
hill[hill < 0.05] = 0
del rel
# only real hills: a rise that tops 12 m somewhere (not every gentle swell between two streets)
comp, nc = ndimage.label(hill > 0.5)
keep = np.zeros(nc + 1, bool); keep[1:] = ndimage.maximum(hill, comp, np.arange(1, nc + 1)) > 12
hill[~keep[comp]] = 0
del comp
# buildings on a slope: lifted to the lowest ground under them (the uphill side sits into the hill), and the
# ground under them (and a step around) levelled to that
nb = len(bids)
bmin = ndimage.minimum(hill, lab, np.arange(nb)); bmin = np.where(np.isfinite(bmin), bmin, 0); bmin[0] = 0
pad = ndimage.grey_dilation(lab, size=3)
hill = np.where(pad > 0, bmin[pad], hill).astype(np.float32)
lift = {}
for k in np.nonzero(bmin >= 0.3)[0]:
    f, bi = bids[k]; lift.setdefault(f, []).append([bi, int(round(bmin[k] * 10))])
print('buildings lifted onto hillsides', sum(len(v) for v in lift.values()), flush=True)
del lab, pad
print('hills: max', hill.max().round(1), 'm; area over 2 m', round(float((hill > 2).sum()) * S * S / 1e6, 2), 'km2', flush=True)

# ---------------------------------------------------------------- per tile
def b64(a): return base64.b64encode(np.clip(np.round(a * 10), 0, 65535).astype('<u2').tobytes()).decode()
n_t = 0
for f in tiles:
    T = json.load(gzip.open(f))
    x0, z0, x1, z1 = (v / 100 for v in T['tile'][2])
    n = int(round((x1 - x0) / S)) + 1
    i0, j0 = int(round((x0 - VX0) / S)), int(round((z0 - VZ0) / S))
    blk = hill[j0:j0 + n, i0:i0 + n]
    had = 'hill' in T or 'hillB' in T
    T.pop('hill', None); T.pop('hillB', None)
    if blk.shape == (n, n) and blk.max() > 1.5:
        T['hill'] = [S, n, b64(blk)]; n_t += 1
        if f in lift: T['hillB'] = lift[f]
    elif not had: continue
    with gzip.open(f, 'wb', 9) as fh: fh.write(json.dumps(T, separators=(',', ':'), ensure_ascii=False).encode())
print('tiles with hills', n_t, flush=True)

# ---------------------------------------------------------------- the far field: 64 m, eroded (min over the cell's reach)
F = 64.0
k = int(F / S)
far = ndimage.minimum_filter(hill, size=2 * k + 1)[::k, ::k]
far = np.maximum(far - 0.3, 0)
B['hills'] = [F, far.shape[1], far.shape[0], VX0, VZ0, b64(far)]
if 'Terrain' not in B['meta'].get('attribution', ''): B['meta']['attribution'] = B['meta'].get('attribution', '') + '; terrain: Terrain Tiles on AWS (SRTM, NASA)'
with gzip.open(os.path.join(ROOT, 'data/pune/base.json.gz'), 'wb', 9) as fh: fh.write(json.dumps(B, separators=(',', ':'), ensure_ascii=False).encode())
print('far field', far.shape, 'max', far.max().round(1), 'cells over 1 m', int((far > 1).sum()))
