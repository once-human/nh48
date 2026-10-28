#!/usr/bin/env python3
"""reshop.py - put Pune's real places back on the right buildings, in every streamed 1 km tile.

Reads data/raw/osm/places_clean.json (tools/pune_places.py) and rewrites, in each data/pune/t_*.json.gz:
  shopNames, shops    the boards: a real place goes on the street-facing wall of the building it is in (or one
                      within 6 m of its point; then the nearest within 20 m). Nothing is moved further, and a
                      place with no building there gets no board (it still has its map pin).
  buildings[..][5]    edge flags: '3' where real shops fill a wall (the open-shutter shop front)
  pins                every real place in the tile, at its real position
and data/pune/pins.json.gz, every place for the map's search.
Names are real; only national and international chains are parodied (tools/shopnames.py).
usage: python3 tools/reshop.py"""
import gzip, json, glob, math, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree
from shopnames import board_name, pin_name
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SHOP_CELL, SNAP, NEAR_R = 3.6, 6.0, 20.0
NO_BOARD_STYLES = {6, 7, 8, 10, 11, 13}
def nslots(L): return max(1, int(math.floor(L / SHOP_CELL)))

P = json.load(open(os.path.join(ROOT, 'data/raw/osm/places_clean.json')))
# names once
for c in P:
    r = board_name(c['raw'], c['cat'] or 'generic') if c['board'] else None
    if not r and c['board']: c['board'] = False
    if r: c['en'], c['mrb'], c['brand'] = r
    q = pin_name(c['raw'])
    c['pn'] = (q[0], c.get('mr') or q[1]) if q else None
    if c['board'] and c.get('mr'): c['mrb'] = c['mr']
grid = collections.defaultdict(list)
for c in P: grid[(math.floor(c['x'] / 1000), math.floor(c['z'] / 1000))].append(c)

tot = collections.Counter()
for f in sorted(glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz'))):
    T = json.load(gzip.open(f))
    i, j, rect = T['tile']
    x0, z0, x1, z1 = (v / 100 for v in rect)
    B = T['buildings']
    polys, edges = [], []
    for b in B:
        r = b[1]; pts = [(r[2 * k] / 100, r[2 * k + 1] / 100) for k in range(len(r) // 2)]
        polys.append(Polygon(pts) if len(pts) >= 3 else Point(pts[0]).buffer(0.1))
        fl = b[5]; es = []
        for k in range(len(pts)):
            (ax, az), (bx, bz) = pts[k], pts[(k + 1) % len(pts)]
            es.append((ax, az, bx, bz, math.hypot(bx - ax, bz - az), fl[k] if k < len(fl) else '0'))
        edges.append(es)
    tree = STRtree(polys) if polys else None
    cands = [c for c in grid[(math.floor((x0 + 1) / 1000), math.floor((z0 + 1) / 1000))] if x0 <= c['x'] < x1 and z0 <= c['z'] < z1]
    # brands and OSM first, then the most confident
    cands.sort(key=lambda c: -((2 if c.get('brand') else 0) + (1 if c['src'] == 1 else 0) + c['conf']))
    occupied, front = {}, set()
    def try_place(c, R):
        p = Point(c['x'], c['z'])
        near = [int(k) for k in tree.query(p.buffer(R))]
        inside = [bi for bi in near if polys[bi].contains(p)]
        cand = inside or sorted((bi for bi in near if polys[bi].distance(p) <= R), key=lambda bi: polys[bi].distance(p))[:3]
        for bi in cand:
            if B[bi][3] in NO_BOARD_STYLES: continue
            opts = []
            street = any(L > 2.6 and fl in '123' for (ax, az, bx, bz, L, fl) in edges[bi])
            for ei, (ax, az, bx, bz, L, fl) in enumerate(edges[bi]):
                if not (L > 2.6 and (fl in '123' or not street)): continue
                ex, ez = bx - ax, bz - az
                t = max(0.0, min(1.0, ((c['x'] - ax) * ex + (c['z'] - az) * ez) / (L * L)))
                opts.append((math.hypot(ax + ex * t - c['x'], az + ez * t - c['z']), ei, t))
            for d, ei, t in sorted(opts):
                ns = nslots(edges[bi][ei][4]); k0 = min(ns - 1, int(t * ns))
                for dk in (0, 1, -1, 2, -2):
                    k = k0 + dk
                    if 0 <= k < ns and (bi, ei, k) not in occupied:
                        occupied[(bi, ei, k)] = c; front.add((bi, ei)); return True
        return False
    placed = set()
    if tree is not None:
        for R in (SNAP, NEAR_R):
            for c in cands:
                if c['board'] and id(c) not in placed and try_place(c, R): placed.add(id(c))
    names, nidx, shops = [], {}, []
    for (bi, ei, k), c in sorted(occupied.items()):
        kind = 'brand' if c.get('brand') else ('trad' if c['cat'] in ('sweets', 'jewellery') and B[bi][8] else '')
        key = (c['en'], c['mrb'], c['cat'], kind)
        if key not in nidx: nidx[key] = len(names); names.append(list(key))
        shops.append([bi, ei, k, nidx[key], c['src']])
    filled = collections.Counter((bi, ei) for (bi, ei, k) in occupied)
    front = {fr for fr in front if filled[fr] * 2 >= nslots(edges[fr[0]][fr[1]][4])}
    for bi, b in enumerate(B):
        fl = list(b[5])
        for ei in range(len(fl)):
            if (bi, ei) in front: fl[ei] = '3'
            elif fl[ei] == '3': fl[ei] = '1'
        b[5] = ''.join(fl)
    T['shopNames'] = names; T['shops'] = shops
    T['pins'] = [[c['pn'][0], c['pn'][1], c['pin'], round(c['x'] * 100), round(c['z'] * 100), 1 if id(c) in placed else 0] for c in cands if c['pn']]
    with gzip.open(f, 'wb', 9) as fh: fh.write(json.dumps(T, separators=(',', ':'), ensure_ascii=False).encode())
    tot['tiles'] += 1; tot['boards'] += len(shops); tot['places'] += len(cands); tot['placed'] += len(placed)
print(dict(tot))
pins = [[c['pn'][0], c['pn'][1], c['pin'], round(c['x'] * 100), round(c['z'] * 100), 1] for c in P if c['pn']]
with gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz'), 'wb', 9) as fh: fh.write(json.dumps(pins, separators=(',', ':'), ensure_ascii=False).encode())
print('map pins', len(pins), collections.Counter(p[2] for p in pins).most_common())
