#!/usr/bin/env python3
"""pune_outline.py - the shape of the playable city: the Pune City subdistrict boundary (OSM
relation 10351626) joined with the built-up area around it (Pimpri-Chinchwad, Hinjewadi, Wagholi,
Loni Kalbhor...), found from building density (Overture buildings). Smoothed so it reads as a city
edge. Writes data/raw/pune/outline.json (lon/lat rings) and prints its area."""
import json, xml.etree.ElementTree as ET, numpy as np, shapely, pyarrow.parquet as pq
from shapely.geometry import Polygon, MultiPolygon, LineString, box
from shapely.ops import unary_union, linemerge, polygonize
D = 'data/raw/pune/'
# --- the subdistrict
root = ET.parse(D + 'rel_pune_city.osm').getroot()
nodes = {n.get('id'): (float(n.get('lon')), float(n.get('lat'))) for n in root.iter('node')}
ways = {w.get('id'): [nodes[nd.get('ref')] for nd in w.iter('nd') if nd.get('ref') in nodes] for w in root.iter('way')}
rel = root.find('relation')
lines = [LineString(ways[m.get('ref')]) for m in rel.iter('member') if m.get('type') == 'way' and m.get('role') in ('outer', '') and m.get('ref') in ways and len(ways[m.get('ref')]) > 1]
city = unary_union(list(polygonize(linemerge(lines))))
print('subdistrict km2', round(city.area * 111.0 * 105.6, 1))
# --- built-up density from buildings on a 250 m grid
BB = (73.70, 18.40, 74.06, 18.72); STEP = 0.0024     # ~250 m
nx, ny = int((BB[2] - BB[0]) / STEP) + 1, int((BB[3] - BB[1]) / STEP) + 1
cover = np.zeros((ny, nx))
t = pq.read_table(D + 'building.parquet', columns=['bbox'])
bb = t.column('bbox').to_pylist()
for b in bb:
    cx, cy = (b['xmin'] + b['xmax']) / 2, (b['ymin'] + b['ymax']) / 2
    i, j = int((cx - BB[0]) / STEP), int((cy - BB[1]) / STEP)
    if 0 <= i < nx and 0 <= j < ny: cover[j, i] += (b['xmax'] - b['xmin']) * (b['ymax'] - b['ymin']) * 111000 * 105600
cell = (STEP * 111000) * (STEP * 105600)
dense = cover / cell > 0.11               # 6% of the ground under roofs
cells = [box(BB[0] + i * STEP, BB[1] + j * STEP, BB[0] + (i + 1) * STEP, BB[1] + (j + 1) * STEP) for j in range(ny) for i in range(nx) if dense[j, i]]
urban = unary_union(cells).buffer(0.005).buffer(-0.007)          # close small gaps
parts = list(urban.geoms) if isinstance(urban, MultiPolygon) else [urban]
keep = [p for p in parts if p.intersects(city.buffer(0.01)) or p.area * 111 * 105.6 > 8]
shape = unary_union([city] + keep).buffer(0.006).buffer(-0.009).buffer(0.003)
shape = shape.intersection(box(*BB))
if isinstance(shape, MultiPolygon): shape = max(shape.geoms, key=lambda g: g.area)
shape = Polygon(shape.exterior).simplify(0.0008)
print('playable km2', round(shape.area * 111.0 * 105.6, 1), 'bounds', [round(v, 3) for v in shape.bounds])
json.dump({'outline': [list(map(lambda c: [round(c[0], 5), round(c[1], 5)], shape.exterior.coords))]}, open(D + 'outline.json', 'w'))
# quick look
try:
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(8, 8)); ax.imshow(dense, origin='lower', extent=[BB[0], BB[2], BB[1], BB[3]], cmap='Greys', alpha=0.6)
    x, y = shape.exterior.xy; ax.plot(x, y, 'r-'); cx, cy = (city.exterior.xy if isinstance(city, Polygon) else max(city.geoms, key=lambda g: g.area).exterior.xy); ax.plot(cx, cy, 'b--', lw=0.8)
    ax.plot([73.829, 73.901, 73.901, 73.829, 73.829], [18.508, 18.508, 18.546, 18.546, 18.508], 'g-')
    fig.savefig(D + 'outline.png', dpi=90)
except Exception as e: print('no plot', e)
