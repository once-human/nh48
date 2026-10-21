#!/usr/bin/env python3
"""merge_pune.py - join the baked tiles (data/tiles/t_I_J.json) into what the game loads:
  data/pune/base.json.gz     the whole city at once: projection, outline, road graph (every tile's
                             graph stitched at the seams), street names, places, landmarks, areas,
                             flyovers, metro, bus stops, map pins, crowd activity, shop names
  data/pune/t_I_J.json.gz    one per tile, streamed while you play: ground, water, kerbs, buildings,
                             markings, trees, walls, lamps, poles, signals, stalls, parking,
                             hoardings, shop fronts, railways
Street-name, shop-name and graph-node indices are renumbered to the global tables."""
import json, glob, gzip, os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC, OUT = os.path.join(ROOT, 'data/tiles'), os.path.join(ROOT, 'data/pune')
os.makedirs(OUT, exist_ok=True)
outline = json.load(open(os.path.join(ROOT, 'data/raw/pune/outline.json')))['outline'][0]
TILE_KEYS = ['ground', 'water', 'banks', 'lakebanks', 'kerbs', 'rails', 'buildings', 'marks', 'trees', 'walls', 'lamps', 'poles',
             'signals', 'stalls', 'parked', 'hoardings', 'shops', 'railways', 'platforms']
names, name_idx = [], {}
def nid(n):
    k = (n[0], n[1] if len(n) > 1 else '')
    if k not in name_idx: name_idx[k] = len(names); names.append(list(k))
    return name_idx[k]
nid(['', ''])
snames, sname_idx = [], {}
def sid(s):
    k = json.dumps(s, ensure_ascii=False)
    if k not in sname_idx: sname_idx[k] = len(snames); snames.append(s)
    return sname_idx[k]
gnodes, gkey, gedges = [], {}, []
base = dict(pois=[], places=[], landmarks=[], areas=[], flyovers=[], metro=[], mstations=[], buses=[], pins=[], cells=[])
seen_lm, seen_area = set(), set()
meta = None; tiles = []
files = sorted(glob.glob(os.path.join(SRC, 't_*.json')))
for f in files:
    i, j = map(int, re.findall(r't_(\d+)_(\d+)\.json', f)[0])
    M = json.load(open(f))
    if meta is None: meta = dict(M['meta']); meta.pop('tile', None); meta.pop('play', None)
    # street names and the road graph
    nm = [nid(n) for n in M['names']]
    nmap = []
    for x, z, fl, jr in M['graph']['nodes']:
        k = (x, z)
        if k in gkey:
            g = gkey[k]; gnodes[g][2] |= fl; gnodes[g][3] = max(gnodes[g][3], jr)
        else:
            g = gkey[k] = len(gnodes); gnodes.append([x, z, fl, jr])
        nmap.append(g)
    for e in M['graph']['edges']:
        e = list(e); e[0] = nmap[e[0]]; e[1] = nmap[e[1]]; e[5] = nm[e[5]] if e[5] < len(nm) else 0
        gedges.append(e)
    for fo in M.get('flyovers', []): fo = list(fo); fo[0] = nm[fo[0]] if fo[0] < len(nm) else 0; base['flyovers'].append(fo)
    # shop names (the boards) are global; shop fronts stay with their tile's buildings
    sm = [sid(s) for s in M.get('shopNames', [])]
    T = {k: M.get(k, []) for k in TILE_KEYS}
    T['shops'] = [[s[0], s[1], s[2], sm[s[3]] if s[3] < len(sm) else 0, s[4]] for s in M.get('shops', [])]
    T['signals'] = [[s[0], s[1], s[2], nmap[s[3]] if s[3] < len(nmap) else 0, s[4], s[5]] for s in M.get('signals', [])]
    T['tile'] = [i, j, M['meta']['tile']]
    for k in ('pois', 'places', 'metro', 'mstations', 'buses', 'pins'): base[k] += M.get(k, [])
    for lm in M.get('landmarks', []):
        if lm[0] not in seen_lm: seen_lm.add(lm[0]); base['landmarks'].append(lm)
    for a in M.get('areas', []):
        if a[0] not in seen_area: seen_area.add(a[0]); base['areas'].append(a)
    act = M.get('activity') or {}
    if act: base['cell'], base['cls'] = act['cell'], act['cls']; base['cells'] += act['cells']
    s = json.dumps(T, separators=(',', ':'), ensure_ascii=False).encode()
    with gzip.open(os.path.join(OUT, f't_{i}_{j}.json.gz'), 'wb', 9) as fh: fh.write(s)
    tiles.append([i, j, M['meta']['tile'], len(s)])
    print(f, len(s) // 1024, 'KB')
out = dict(meta={**meta, 'outline': [[round(v, 5) for v in p] for p in outline], 'tiles': tiles, 'tileSize': 4000},
           names=names, graph=dict(nodes=gnodes, edges=gedges), shopNames=snames, districts=['deccan', 'peth', 'camp', 'kp', 'station', 'residential', 'riverside'],
           pois=base['pois'], places=base['places'], landmarks=base['landmarks'], areas=base['areas'], flyovers=base['flyovers'],
           metro=base['metro'], mstations=base['mstations'], buses=base['buses'], pins=base['pins'],
           activity=dict(cell=base.get('cell', 50.0), cls=base.get('cls', []), cells=base['cells']), street=1)
s = json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode()
with gzip.open(os.path.join(OUT, 'base.json.gz'), 'wb', 9) as fh: fh.write(s)
print('base', len(s) // 1024, 'KB', 'nodes', len(gnodes), 'edges', len(gedges), 'names', len(names), 'shop names', len(snames), 'tiles', len(tiles))
