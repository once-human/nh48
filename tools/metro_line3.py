#!/usr/bin/env python3
"""metro_line3.py - Pune Metro Line 3 (Pink Line, Hinjewadi - Shivajinagar) into the base map.

The old base map had Line 3 as a broken under-construction viaduct (flag 1, gaps) that stopped short of Maan.
This takes both tracks of the main line from OpenStreetMap (data/raw/osm/pune_osm.json: the viaduct ways
named "Pune Metro Line 3", not the depot yard, spurs or crossovers), drops the old Line 3 ways, and adds the
new ones with flag 2: complete, trains run once the line opens (src/game/metroOpen.js decides by the date).
usage: python3 tools/metro_line3.py"""
import gzip, json, math, os
from shapely.geometry import LineString
from shapely.ops import unary_union
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LAT0, LON0, MLAT, MLON = 18.527, 73.865, 110686.0, 105589.0
D = json.load(open(os.path.join(ROOT, 'data/raw/osm/pune_osm.json')))
ways = []
for w in D['rail']:
    t = w.get('t', {})
    if 'pts' not in w or 'Line 3' not in t.get('name', ''): continue
    if t.get('service') in ('yard', 'spur', 'crossover', 'siding'): continue
    pts = [((lon - LON0) * MLON, -(lat - LAT0) * MLAT) for lon, lat in w['pts']]
    if len(pts) < 2: continue
    ways.append(pts)
L3 = unary_union([LineString(p) for p in ways]).buffer(60)
p = os.path.join(ROOT, 'data/pune/base.json.gz')
B = json.load(gzip.open(p))
keep, dropped = [], 0
for f, r in B['metro']:
    if f == 2: dropped += 1; continue                       # an earlier run
    if f == 1:
        line = LineString([(r[k] / 100, r[k + 1] / 100) for k in range(0, len(r), 2)])
        if line.length > 0 and line.intersection(L3).length > 0.6 * line.length: dropped += 1; continue
    keep.append([f, r])
for pts in ways: keep.append([2, [round(v * 100) for xy in pts for v in xy]])
B['metro'] = keep
with gzip.open(p, 'wb', 9) as fh: fh.write(json.dumps(B, separators=(',', ':'), ensure_ascii=False).encode())
km = sum(LineString(w).length for w in ways) / 1000
print(f'Line 3: dropped {dropped} old ways, added {len(ways)} ways ({km:.1f} km of track)')
