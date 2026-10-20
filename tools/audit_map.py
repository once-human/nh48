# Whole-map audit: how faithfully data/map.json reproduces the OSM source.
#   python3 tools/audit_map.py
# Roads: length per OSM class present as drivable graph (navigation/traffic) vs in the source.
# Buildings: how much of each OSM building footprint survived the bake (road cutting, clipping).
# Places: how far real shops were moved to reach the wall they hang on.
import json, math, collections, os, sys
from shapely.geometry import Polygon, LineString, Point
from shapely.strtree import STRtree
from shapely.ops import unary_union
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
M = json.load(open(os.path.join(ROOT, 'data/map.json')))
D = json.load(open(os.path.join(ROOT, 'data/raw/merged.json')))
meta = M['meta']
def proj(lat, lon): return ((lon - meta['lon0']) * meta['mlon'], -(lat - meta['lat0']) * meta['mlat'])
P = {int(k): proj(v[0], v[1]) for k, v in D['nodes'].items()}
vis = [v / 100 for v in meta['vis']]
from shapely.geometry import box
VIS = box(*vis)

# ---------------------------------------------------------------- roads
graph = [LineString([(e[7][k] / 100, e[7][k + 1] / 100) for k in range(0, len(e[7]), 2)]) for e in M['graph']['edges']]
gtree = STRtree(graph)
by = collections.defaultdict(lambda: [0.0, 0.0])
for w in D['ways'].values():
    t = w.get('tags', {}); h = t.get('highway')
    if not h or h in ('footway', 'path', 'steps', 'pedestrian', 'cycleway', 'bridleway', 'corridor', 'elevator', 'platform', 'bus_stop', 'proposed', 'construction', 'raceway'): continue
    pts = [P[n] for n in w['nd'] if n in P]
    if len(pts) < 2: continue
    ln = LineString(pts).intersection(VIS)
    if ln.is_empty: continue
    L = ln.length
    # sample every 10 m: covered if a graph edge is within 4 m
    n = max(2, int(L / 10)); cov = 0
    for i in range(n + 1):
        p = ln.interpolate(i / n, normalized=True)
        if any(graph[j].distance(p) < 4 for j in gtree.query(p.buffer(4))): cov += 1
    key = h + ('/' + t['service'] if h == 'service' and t.get('service') else '') + (' (private)' if t.get('access') in ('private', 'no') else '')
    by[key][0] += L; by[key][1] += L * cov / (n + 1)
print('ROADS: source length vs length in the drivable graph (navigation + traffic)')
tot = [0, 0]
for k, (L, c) in sorted(by.items(), key=lambda kv: -kv[1][0]):
    if L < 300: continue
    print(f'  {k:32s} {L/1000:7.1f} km   in graph {100*c/L:5.1f}%')
    tot[0] += L; tot[1] += c
print(f'  {"ALL":32s} {tot[0]/1000:7.1f} km   in graph {100*tot[1]/tot[0]:5.1f}%')

# ---------------------------------------------------------------- buildings
baked = [Polygon([(b[1][k] / 100, b[1][k + 1] / 100) for k in range(0, len(b[1]), 2)]) for b in M['buildings'] if len(b[1]) >= 6]
baked = [p if p.is_valid else p.buffer(0) for p in baked]
btree = STRtree(baked)
lost = []; n = 0; area_src = area_kept = 0
for k, w in D['ways'].items():
    t = w.get('tags', {})
    if 'building' not in t: continue
    pts = [P[x] for x in w['nd'] if x in P]
    if len(pts) < 4: continue
    p = Polygon(pts)
    if not p.is_valid: p = p.buffer(0)
    if p.area < 20 or not p.within(VIS): continue
    kept = sum(baked[j].intersection(p).area for j in btree.query(p))
    n += 1; area_src += p.area; area_kept += min(kept, p.area)
    if kept < 0.75 * p.area: lost.append((p.area - kept, t.get('name', ''), t.get('building'), round(kept / p.area, 2), [round(v) for v in p.centroid.coords[0]]))
print(f'\nBUILDINGS: {n} OSM footprints, {100*area_kept/area_src:.1f}% of their area survives the bake')
print(f'  {len(lost)} lost more than a quarter of their footprint; biggest losses:')
for a, nm, bt, r, c in sorted(lost, reverse=True)[:25]: print(f'   {a:8.0f} m2 lost  kept {r:4.2f}  {bt:12s} {nm[:40]:40s} at {c}')

# ---------------------------------------------------------------- places
print('\nPLACES (real shops): distance from the source point to the board it was given')
print('  (computed by tools/bake_shops.py; rerun it with AUDIT=1 for the list)')
