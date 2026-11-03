#!/usr/bin/env python3
"""check_places.py - run after tools/venues.py and before pushing the map: fails if the data breaks what we promise.
Every listing's pin exactly on its coordinates; nothing known wrong anywhere; no bar that isn't a listing; no place twice.
Also prints a neighbourhood's pins and boards for reading (--box x0 z0 x1 z1).  In: data/pune, scratch/venues_in.json."""
import glob, gzip, json, math, os, re, sys, collections, unicodedata
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
GONE = {'OLA head office', 'Drama 9', 'The Game Palacio', 'The Mills Social', 'The Mills Sociable', 'Themillspune', 'Math Tuition Classes Cuemath', 'Maths Tuition Classes', 'Home Cleaning Services'}
NIGHT = {'bar', 'pub', 'club', 'lounge', 'restobar'}
fold = lambda s: unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower().replace('&', ' and ')
sq = lambda s: re.sub(r'^the', '', re.sub(r'[^a-z0-9]', '', fold(s)))
pins = json.load(gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz')))
V = json.load(open(os.path.join(ROOT, 'scratch/venues_in.json'), encoding='utf-8'))
bad = collections.defaultdict(list)
at = {(p[0], p[3], p[4]): p for p in pins}
inMap = lambda v: -2000000 <= v['x'] * 100 and -2400000 <= v['z'] * 100
for v in V:
    if (v['pin'], round(v['x'] * 100), round(v['z'] * 100)) not in at:
        # (a famous place keeps its own name, at the listing's coordinates)
        if not any(abs(p[3] - v['x'] * 100) < 2 and abs(p[4] - v['z'] * 100) < 2 for p in pins): bad['listing not on its coordinates'].append(v['name'])
listed = {(round(v['x'] * 100), round(v['z'] * 100)) for v in V}
for p in pins:
    if p[0] in GONE: bad['known wrong, still a pin'].append(p[0])
    if p[2] in NIGHT and (p[3], p[4]) not in listed: bad['a bar with no listing'].append(p[0])
    if p[2] == 'bar' and re.search(r'fitness|\bgym\b|health club|foundation|wine shop', p[0], re.I): bad['not a bar, labelled a bar'].append(p[0])
g = collections.defaultdict(list)
for p in pins: g[(sq(p[0]), p[3] // 2500, p[4] // 2500)].append(p)
for (f, a, b), L in list(g.items()):
    if not f: continue
    for p in L:
        for i in (-1, 0, 1):
            for j in (-1, 0, 1):
                for q in g.get((f, a + i, b + j), []):
                    if q is not p and q[2] == p[2] and id(q) > id(p) and math.hypot(q[3] - p[3], q[4] - p[4]) < 2500: bad['twice on one spot'].append(p[0])
boards = 0; union = set(); tiles = {tuple(map(int, re.findall(r't_(\d+)_(\d+)', f)[0])) for f in glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz'))}
tkey = lambda m: (int((m[1] + 2000000) // 100000), int((m[2] + 2400000) // 100000))
far = sorted((v for v in V if v['door'] > 10), key=lambda v: -v['door'])
for f in glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz')):
    T = json.load(gzip.open(f)); N = T.get('shopNames') or []
    for p in T.get('pins') or []: union.add((p[0], p[3], p[4]))
    for s in T.get('shops') or []:
        n = N[s[3]] if s[3] < len(N) else None
        if n and n[0] in GONE: bad['known wrong, still a board'].append(n[0])
        if n and n[2] in NIGHT and s[4] != 3: boards += 1
if boards: bad['bar boards not from a listing'].append(boards)
src = open(os.path.join(ROOT, 'src/world/venues.js'), encoding='utf-8').read() + open(os.path.join(ROOT, 'src/world/famous.json'), encoding='utf-8').read()
for n in GONE - {'The Mills Sociable', 'Themillspune', 'Math Tuition Classes Cuemath', 'Maths Tuition Classes', 'Home Cleaning Services'}:
    if f'"{n}"' in src or f"'{n}'" in src: bad['known wrong, still in the source'].append(n)
miss = {m for m in {(p[0], p[3], p[4]) for p in pins} - union if tkey(m) in tiles}      # (out past the last tile: on the map, nothing to stream)
if miss: bad['in the citywide list, not in its tile'].extend(sorted(m[0] for m in miss)[:10] + [f'({len(miss)} in all)'])
a = sys.argv
if '--box' in a:
    i = a.index('--box'); x0, z0, x1, z1 = map(float, a[i + 1:i + 5])
    for p in sorted(pins, key=lambda p: p[0]):
        if x0 * 100 < p[3] < x1 * 100 and z0 * 100 < p[4] < z1 * 100: print(f'  {p[0][:40]:40} {p[2]:10} {p[3] / 100:7.0f},{p[4] / 100:7.0f}  {"LISTED" if (p[3], p[4]) in listed else ""}')
dd = sorted(v['door'] for v in V if v['door'] >= 0)
print(f'{len(pins)} pins, {len(V)} from listings. Door to coordinates: median {dd[len(dd) // 2]} m, within 10 m {sum(d <= 10 for d in dd)} of {len(dd)}, within 25 m {sum(d <= 25 for d in dd)}, max {dd[-1]} m')
print('furthest doors:', [(v['name'], v['door']) for v in far[:8]])
for k, L in bad.items(): print('FAIL', k, len(L), L[:12])
print('FAILED' if bad else 'OK'); sys.exit(1 if bad else 0)
