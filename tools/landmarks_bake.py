#!/usr/bin/env python3
"""landmarks_bake.py - place Pune's landmark models and clear the ground for them.

For every landmark in tools/landmarks_spec.json: its real outline from OpenStreetMap, the side that faces the
nearest main road (the front, where the gate or the entrance is), and its size in that frame
-> src/world/landmarks.json  [{id, name, x, z, rot, w, d, outline}]  (metres; rot: the model's +x axis angle)
Then, in every streamed tile (data/pune/t_*.json.gz), the map's own boxes inside a landmark's outline (+ claim
margin) are removed, with their shop boards, so the real model stands there alone.
usage: python3 tools/landmarks_bake.py   (after reshop.py)"""
import gzip, json, glob, math, os
from shapely.geometry import Polygon, Point, box
from shapely import affinity
import duckdb, shapely
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LAT0, LON0, MLAT, MLON = 18.527, 73.865, 110686.0, 105589.0
def proj(lon, lat): return ((lon - LON0) * MLON, -(lat - LAT0) * MLAT)
spec = json.load(open(os.path.join(ROOT, 'tools/landmarks_spec.json')))['list']
D = json.load(open(os.path.join(ROOT, 'data/raw/osm/pune_osm.json')))
ways = {}
for l in D['landmarks'] + D['buildings']: ways.setdefault(l['id'], l)
nodes = {int(p['id'][1:]): p for p in D['pois'] if p['id'][0] == 'n'}
con = duckdb.connect(); con.sql('load spatial')

out, claims = [], []
for s in spec:
    if 'way' in s:
        poly = Polygon([proj(*p) for p in ways[s['way']]['pts']]).buffer(0)
    elif 'ovt' in s:                 # the biggest footprint the open building data has within r m of a point
        lat, lon, rr = s['ovt']; px, pz = proj(lon, lat)
        best = None
        for (g,) in con.sql(f"""select ST_AsWKB(geometry) from '{ROOT}/data/raw/pune/building.parquet'
                              where bbox.xmin < {lon + 0.002} and bbox.xmax > {lon - 0.002} and bbox.ymin < {lat + 0.002} and bbox.ymax > {lat - 0.002}""").fetchall():
            gg = shapely.from_wkb(bytes(g))
            if gg.geom_type != 'Polygon': continue
            q = Polygon([proj(x, y) for x, y in gg.exterior.coords]).buffer(0)
            if q.centroid.distance(Point(px, pz)) <= rr and (best is None or q.area > best.area): best = q
        poly = best
    else:
        n = nodes[s['node']]; x, z = proj(n['lon'], n['lat']); w, d = s['size']
        poly = box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
    c = poly.centroid
    lon, lat = c.x / MLON + LON0, -c.y / MLAT + LAT0
    # the nearest proper road (not a footway or service lane) within 150 m: that side is the front
    r = con.sql(f"""select ST_X(ST_ClosestPoint(geometry, ST_Point({lon}, {lat}))), ST_Y(ST_ClosestPoint(geometry, ST_Point({lon}, {lat})))
                    from '{ROOT}/data/raw/pune/segment.parquet'
                    where subtype = 'road' and class in ('primary', 'secondary', 'tertiary', 'residential', 'trunk', 'unclassified', 'living_street')
                      and bbox.xmin < {lon + 0.0015} and bbox.xmax > {lon - 0.0015} and bbox.ymin < {lat + 0.0015} and bbox.ymax > {lat - 0.0015}
                    order by ST_Distance(geometry, ST_Point({lon}, {lat})) limit 1""").fetchone()
    rx, rz = proj(r[0], r[1]) if r else (c.x, c.y - 1)
    fx, fz = rx - c.x, rz - c.y
    if s.get('front'): fx, fz = s['front']                 # known facing (Shaniwar Wada's Delhi Darwaza faces north)
    fl = math.hypot(fx, fz) or 1; fx /= fl; fz /= fl
    # the outline's own axes: the one closest to the road direction becomes the front
    mr = list(poly.minimum_rotated_rectangle.exterior.coords)
    best = None
    for k in range(2):
        ex, ez = mr[k + 1][0] - mr[k][0], mr[k + 1][1] - mr[k][1]; L = math.hypot(ex, ez) or 1
        for sgn in (1, -1):
            nx, nz = -ez / L * sgn, ex / L * sgn
            dot = nx * fx + nz * fz
            if best is None or dot > best[0]: best = (dot, nx, nz)
    _, nx, nz = best
    # local frame: -z is the front (toward the road), +x is to the right when facing the building from the road
    zx, zz = -nx, -nz
    xx, xz = -zz, zx
    rot = math.atan2(xz, xx)
    loc = [((px - c.x) * xx + (pz - c.y) * xz, (px - c.x) * zx + (pz - c.y) * zz) for px, pz in poly.exterior.coords]
    lx = [p[0] for p in loc]; lz = [p[1] for p in loc]
    ox, oz = (max(lx) + min(lx)) / 2, (max(lz) + min(lz)) / 2
    cx, cz = c.x + ox * xx + oz * zx, c.y + ox * xz + oz * zz
    w, d = max(lx) - min(lx), max(lz) - min(lz)
    rec = dict(id=s['id'], name=s['name'], x=round(cx, 2), z=round(cz, 2), rot=round(rot, 4), w=round(w, 2), d=round(d, 2),
               outline=[[round(p[0] - ox, 2), round(p[1] - oz, 2)] for p in loc])
    for k in ('hill', 'far'):
        if s.get(k): rec[k] = True
    # named points inside, in the local frame (Parvati's temple courtyard within the hilltop)
    for k, a in (s.get('anchors') or {}).items():
        ap = Polygon([proj(*p) for p in ways[a]['pts']]).centroid if isinstance(a, int) else Point(*proj(a[1], a[0]))
        rec.setdefault('anchors', {})[k] = [round((ap.x - cx) * xx + (ap.y - cz) * xz, 2), round((ap.x - cx) * zx + (ap.y - cz) * zz, 2)]
    out.append(rec)
    claims.append((s['id'], poly.buffer(s.get('claim', 2))))
    if s.get('plaza'):           # open ground in front (Shaniwar Wada's lawn and statue): no trees, no boxes
        claims.append((s['id'] + ':plaza', Polygon([(c.x + ox * xx + oz * zx + pu * xx + pv * zx, c.y + ox * xz + oz * zz + pu * xz + pv * zz) for pu, pv in s['plaza']])))
    print(f"{s['id']:12s} at {cx:8.1f} {cz:8.1f}  {w:6.1f} x {d:6.1f} m  front toward road {math.degrees(math.atan2(-zz, -zx)):6.1f} deg")
json.dump(out, open(os.path.join(ROOT, 'src/world/landmarks.json'), 'w'), separators=(',', ':'))

# ---------------------------------------------------------------- clear the generic boxes
removed = 0
for f in sorted(glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz'))):
    T = json.load(gzip.open(f))
    rect = [v / 100 for v in T['tile'][2]]
    tb = box(*rect)
    hit = [cl for _, cl in claims if cl.intersects(tb)]
    if not hit: continue
    keep, remap = [], {}
    for bi, b in enumerate(T['buildings']):
        r = b[1]; pts = [(r[2 * k] / 100, r[2 * k + 1] / 100) for k in range(len(r) // 2)]
        if len(pts) >= 3:
            bp = Polygon(pts).buffer(0)
            if bp.area > 0 and any(cl.intersection(bp).area > 0.3 * bp.area for cl in hit): removed += 1; continue
        remap[bi] = len(keep); keep.append(b)
    # trees on a landmark's ground or its plaza
    nt = len(T.get('trees', []))
    T['trees'] = [t for t in T.get('trees', []) if not any(cl.contains(Point(t[0] / 100, t[1] / 100)) for cl in hit)]
    if len(keep) == len(T['buildings']) and nt == len(T['trees']): continue
    T['buildings'] = keep
    T['shops'] = [[remap[s[0]], s[1], s[2], s[3], s[4]] for s in T['shops'] if s[0] in remap]
    with gzip.open(f, 'wb', 9) as fh: fh.write(json.dumps(T, separators=(',', ':'), ensure_ascii=False).encode())
print('generic buildings removed under landmarks', removed)
