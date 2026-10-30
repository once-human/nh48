#!/usr/bin/env python3
"""campuses.py - Pune's universities and colleges as campuses, from their OpenStreetMap outlines (amenity=university /
college, hand-mapped): a gate with the name over it where the campus meets its nearest main road, the buildings inside
in the institutional style, no invented shop boards inside the walls, and a map pin at the gate.
In: Overpass JSON (`out geom tags`). Out: src/world/landmarks.json (kind 'gate'), data/pune/t_*.json.gz, pins.json.gz.
usage: python3 tools/campuses.py campus.json"""
import gzip, json, glob, math, os, sys, re, collections
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LAT0, LON0, MLAT, MLON = 18.527, 73.865, 110686.0, 105589.0
P = lambda lat, lon: ((lon - LON0) * MLON, -(lat - LAT0) * MLAT)
def inside(x, z, Q):
    c = False
    for k in range(len(Q)):
        (ax, az), (bx, bz) = Q[k], Q[k - 1]
        if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az + 1e-12) + ax: c = not c
    return c
def area(Q): return abs(sum(Q[i][0] * Q[i - 1][1] - Q[i - 1][0] * Q[i][1] for i in range(len(Q)))) / 2

camp = []
for e in json.load(open(sys.argv[1]))['elements']:
    nm = (e.get('tags') or {}).get('name')
    if not nm or re.search(r'playground|ground$|hostel|building|bulding', nm, re.I): continue
    rings = []
    if e['type'] == 'way' and e.get('geometry'): rings = [e['geometry']]
    elif e['type'] == 'relation': rings = [m['geometry'] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
    for g in rings:
        Q = [P(p['lat'], p['lon']) for p in g]
        if len(Q) >= 4 and area(Q) > 2500: camp.append((nm, Q))
print('campuses', len(camp), flush=True)

# the roads, from the tiles (main roads first: a gate faces the road you'd come in by)
tiles = {}
for f in glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz')):
    i, j = map(int, re.findall(r't_(\d+)_(\d+)', f)[0]); tiles[(i, j)] = f
def tkey(x, z): return (int((x * 100 + 2000000) // 100000), int((z * 100 + 2400000) // 100000))
edgeCache = {}
def edgesNear(x0, z0, x1, z1):
    out = []
    for i in range(tkey(x0, z0)[0], tkey(x1, z1)[0] + 1):
        for j in range(tkey(x0, z0)[1], tkey(x1, z1)[1] + 1):
            f = tiles.get((i, j))
            if not f: continue
            if f not in edgeCache: T = json.load(gzip.open(f)); edgeCache[f] = [(e[3], [(e[7][k] / 100, e[7][k + 1] / 100) for k in range(0, len(e[7]), 2)]) for e in T['graph']['edges']]
            out += edgeCache[f]
    return out

LM = [l for l in json.load(open(os.path.join(ROOT, 'src/world/landmarks.json'))) if l.get('kind') != 'gate']
gates, byTile = [], collections.defaultdict(list)
for k, (nm, Q) in enumerate(camp):
    xs, zs = [q[0] for q in Q], [q[1] for q in Q]
    E = edgesNear(min(xs) - 150, min(zs) - 150, max(xs) + 150, max(zs) + 150)
    best = None
    for rank, pts in E:
        w = 1.0 if rank >= 4 else 1.4 if rank >= 3 else 2.2 if rank >= 2 else 4
        for (rx, rz) in pts[::1]:
            for (qx, qz) in Q:
                d = math.hypot(rx - qx, rz - qz) * w
                if best is None or d < best[0]: best = (d, qx, qz, rx, rz)
    if not best or best[0] > 400: continue
    _, gx, gz, rx, rz = best
    dx, dz = rx - gx, rz - gz; L = math.hypot(dx, dz) or 1
    rot = math.atan2(-dx / L, dz / L)
    gates.append({'id': f'gate_{k}', 'kind': 'gate', 'name': nm, 'x': round(gx, 2), 'z': round(gz, 2), 'rot': round(rot, 4), 'w': 14.0, 'd': 3.0})
    for key in {tkey(x, z) for x, z in Q}: byTile[key].append((nm, Q))
json.dump(LM + gates, open(os.path.join(ROOT, 'src/world/landmarks.json'), 'w'), ensure_ascii=False)
print('gates', len(gates), flush=True)

# inside the walls: institutional buildings, no invented boards
tot = collections.Counter()
for key, cs in byTile.items():
    f = tiles.get(key)
    if not f: continue
    T = json.load(gzip.open(f)); B = T['buildings']; drop = set()
    for bi, b in enumerate(B):
        r = b[1]; cx = sum(r[0::2]) / len(r[0::2]) / 100; cz = sum(r[1::2]) / len(r[1::2]) / 100
        if any(inside(cx, cz, Q) for _, Q in cs):
            if b[3] in (0, 1, 2, 3, 6, 9): b[3] = 4; tot['buildings'] += 1
            drop.add(bi)
    keep = [s for s in T['shops'] if not (s[0] in drop and s[4] == 0)]
    tot['boards removed'] += len(T['shops']) - len(keep); T['shops'] = keep
    real = collections.Counter((s[0], s[1]) for s in keep)
    for bi in drop:
        fl = list(B[bi][5])
        for ei in range(len(fl)):
            if fl[ei] == '3' and not real[(bi, ei)]: fl[ei] = '1'
        B[bi][5] = ''.join(fl)
    with gzip.open(f, 'wb', 9) as fh: fh.write(json.dumps(T, separators=(',', ':'), ensure_ascii=False).encode())
# a pin at each gate
pins = json.load(gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz')))
names = {re.sub(r'[^a-z0-9]', '', p[0].lower()) for p in pins}
for g in gates:
    if re.sub(r'[^a-z0-9]', '', g['name'].lower()) not in names: pins.append([g['name'], '', 'college', round(g['x'] * 100), round(g['z'] * 100), 1]); tot['pins'] += 1
with gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz'), 'wb', 9) as fh: fh.write(json.dumps(pins, separators=(',', ':'), ensure_ascii=False).encode())
print(dict(tot))
