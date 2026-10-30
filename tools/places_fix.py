#!/usr/bin/env python3
"""places_fix.py - a pass over the baked tiles (after doors.py): every place's kind from its name (place_kinds.py),
its board painted for that trade, and nothing standing inside a landmark (Shaniwar Wada isn't a TVS showroom).
Rewrites data/pune/t_*.json.gz (pins, shopNames, shops) and data/pune/pins.json.gz. Safe to rerun.
usage: python3 tools/places_fix.py"""
import gzip, json, glob, math, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from place_kinds import kind_of, TRADE
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())
# landmark footprints, in world metres
LM = json.load(open(os.path.join(ROOT, 'src/world/landmarks.json')))
polys = []
for L in LM:
    c, s = math.cos(L['rot']), math.sin(L['rot'])
    loc = L.get('outline') or [[-L['w'] / 2, -L['d'] / 2], [L['w'] / 2, -L['d'] / 2], [L['w'] / 2, L['d'] / 2], [-L['w'] / 2, L['d'] / 2]]
    # local (u, v) -> world: dx = u c + v s, dz = u s - v c
    P = [(L['x'] + u * c + v * s, L['z'] + u * s - v * c) for u, v in loc]
    xs, zs = [p[0] for p in P], [p[1] for p in P]
    polys.append((L['name'], norm(L['name'])[:8], P, (min(xs) - 3, min(zs) - 3, max(xs) + 3, max(zs) + 3)))
def inside(x, z, P):
    c = False
    for k in range(len(P)):
        (ax, az), (bx, bz) = P[k], P[k - 1]
        if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az + 1e-12) + ax: c = not c
    return c
def inLandmark(x, z, name=''):
    for nm, key, P, bb in polys:
        if bb[0] <= x <= bb[2] and bb[1] <= z <= bb[3] and inside(x, z, P) and not norm(name).startswith(key[:6]): return nm
    return None

tot = collections.Counter(); allp = []
for f in sorted(glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz'))):
    T = json.load(gzip.open(f)); B = T['buildings']
    pins = []
    for p in T.get('pins') or []:
        x, z = p[3] / 100, p[4] / 100
        if inLandmark(x, z, p[0]): tot['pin in a landmark'] += 1; continue
        k, tr = kind_of(p[0], p[2])
        if p[2] in ('landmark', 'park', 'transit') : k = p[2]
        pins.append([p[0], p[1], k, p[3], p[4], 1]); tot[k] += 1
    T['pins'] = pins; allp += pins
    # boards: the trade from the name; none on a building inside a landmark
    names = T.get('shopNames') or []
    for n in names:
        if n[3] == 'brand' or n[2] in ('generic',) and not n[0]: continue
        k, tr = kind_of(n[0], n[2])
        if n[2] not in ('grocery', 'pharmacy', 'cafe', 'food', 'clothes', 'books', 'mobile', 'salon', 'bakery', 'sweets', 'hardware', 'clinic', 'electronics', 'shoes') or k in ('office', 'classes', 'gym', 'garage', 'bar', 'bank', 'jeweller', 'optician'):
            n[2] = tr
    keep = []
    for s in T.get('shops') or []:
        b = B[s[0]] if s[0] < len(B) else None
        if not b: continue
        r = b[1]; cx = sum(r[0::2]) / len(r[0::2]) / 100; cz = sum(r[1::2]) / len(r[1::2]) / 100
        if inLandmark(cx, cz): tot['board in a landmark'] += 1; continue
        keep.append(s)
    T['shops'] = keep
    with gzip.open(f, 'wb', 9) as fh: fh.write(json.dumps(T, separators=(',', ':'), ensure_ascii=False).encode())
# the places outside every tile (pins.json only) keep theirs, re-kinded
old = json.load(gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz')))
have = {(p[0], p[3], p[4]) for p in allp}
for p in old:
    if (p[0], p[3], p[4]) in have or inLandmark(p[3] / 100, p[4] / 100, p[0]): continue
    tile = os.path.join(ROOT, f"data/pune/t_{int((p[3] + 2000000) // 100000)}_{int((p[4] + 2400000) // 100000)}.json.gz")
    if os.path.exists(tile): continue
    k, tr = kind_of(p[0], p[2]); allp.append([p[0], p[1], p[2] if p[2] in ('landmark', 'park', 'transit') else k, p[3], p[4], 1])
with gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz'), 'wb', 9) as fh: fh.write(json.dumps(allp, separators=(',', ':'), ensure_ascii=False).encode())
print(len(allp), dict(tot.most_common()))
