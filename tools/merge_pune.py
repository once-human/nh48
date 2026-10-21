#!/usr/bin/env python3
"""merge_pune.py - turn the baked tiles (data/tiles/t_I_J.json) into what the game streams:
  data/pune/base.json.gz    small, loaded at start: projection, chunk grid, the city outline, the tile list,
                            street names, a coarse main-road graph (GPS and the big map), landmarks, areas,
                            flyovers, the metro and its stations, bus stops
  data/pune/t_I_J.json.gz   one per 4 km tile, loaded near you and dropped behind you: its road graph
                            (node indices local to the tile, street names global), ground, water, kerbs,
                            buildings, markings, trees, walls, lamps, poles, signals, stalls, parking,
                            hoardings, shop fronts and their names, railways, map pins, places, crowd activity
Everything in a tile is clipped to the tile's own square, so no two tiles carry the same thing."""
import json, glob, gzip, os, re, math
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC, OUT = os.path.join(ROOT, 'data/tiles'), os.path.join(ROOT, 'data/pune')
os.makedirs(OUT, exist_ok=True)
for old in glob.glob(os.path.join(OUT, 't_*.json.gz')): os.remove(old)
outline = json.load(open(os.path.join(ROOT, 'data/raw/pune/outline.json')))['outline'][0]

names, name_idx = [], {}
def nid(n):
    k = (n[0], n[1] if len(n) > 1 else '')
    if k not in name_idx: name_idx[k] = len(names); names.append(list(k))
    return name_idx[k]
nid(['', ''])

def rdp(pts, eps):
    # Ramer-Douglas-Peucker on a flat [x0,z0,x1,z1,...] list (cm)
    P = [(pts[k], pts[k + 1]) for k in range(0, len(pts), 2)]
    if len(P) < 3: return pts
    keep = [False] * len(P); keep[0] = keep[-1] = True
    st = [(0, len(P) - 1)]
    while st:
        a, b = st.pop(); ax, az = P[a]; bx, bz = P[b]; L = math.hypot(bx - ax, bz - az) or 1
        best, bi = -1, -1
        for i in range(a + 1, b):
            d = abs((bx - ax) * (az - P[i][1]) - (ax - P[i][0]) * (bz - az)) / L
            if d > best: best, bi = d, i
        if best > eps: keep[bi] = True; st += [(a, bi), (bi, b)]
    return [c for i, p in enumerate(P) if keep[i] for c in p]

coarse_nodes, coarse_key, coarse_edges = [], {}, []
def cnode(x, z):
    k = (x, z)
    if k not in coarse_key: coarse_key[k] = len(coarse_nodes); coarse_nodes.append([x, z])
    return coarse_key[k]

base = dict(landmarks=[], areas=[], flyovers=[], metro=[], mstations=[], buses=[], places=[], pois=[])
SUB = 4                                          # 4 km bake tiles -> 4 x 4 streamed pieces of 1 km
def split(T, rect, ti, tj, vis, CH, NCX, act_meta):
    w, h = (rect[2] - rect[0]) / SUB, (rect[3] - rect[1]) / SUB
    def sub_of(x, z):
        a = min(SUB - 1, max(0, int((x - rect[0]) // w))); b = min(SUB - 1, max(0, int((z - rect[1]) // h)))
        return a, b
    def ci_sub(ci):
        a, b = ci % NCX, ci // NCX
        return sub_of(vis[0] + (a + 0.5) * CH, vis[1] + (b + 0.5) * CH)
    P = {}
    def get(k):
        if k not in P:
            a, b = k
            r = [rect[0] + a * w, rect[1] + b * h, rect[0] + (a + 1) * w, rect[1] + (b + 1) * h]
            r = [int(round(v)) for v in r]
            P[k] = dict(graph=dict(nodes=[], edges=[]), _nmap={}, tile=[ti * SUB + a, tj * SUB + b, r], water=[], kerbs=[], banks=[], lakebanks=[], rails=[],
                        ground=[[kind, []] for kind, _ in T['ground']], buildings=[], _bmap={}, walls=[], lamps=[], poles=[], stalls=[], parked=[],
                        signals=[], hoardings=[], trees=[], marks={k2: [] for k2 in T['marks']}, railways=[], platforms=[], shopNames=[], _smap={}, shops=[], pins=[], activity=[])
        return P[k]
    G = T['graph']; N = G['nodes']
    # two nodes on one spot in a tile are a flyover over a road: nudge the second so pieces don't fuse them
    seenxy = {}
    for k, n in enumerate(N):
        key = (n[0], n[1])
        if key in seenxy: n[0] += 1
        else: seenxy[key] = k
    def node(S, k):
        m = S['_nmap']
        if k not in m: m[k] = len(S['graph']['nodes']); S['graph']['nodes'].append(N[k])
        return m[k]
    for e in G['edges']:
        pts = e[7]; mi = (len(pts) >> 2) << 1
        S = get(sub_of(pts[mi], pts[mi + 1]))
        e2 = list(e); e2[0] = node(S, e[0]); e2[1] = node(S, e[1]); S['graph']['edges'].append(e2)
    for sg in T['signals']:
        S = get(sub_of(sg[0], sg[1])); sg2 = list(sg); sg2[3] = node(S, sg[3]); S['signals'].append(sg2)
    for k in ('water', 'kerbs', 'banks', 'lakebanks', 'rails'):
        for x in T.get(k, []): get(ci_sub(x[0]))[k].append(x)
    for gi, (kind, polys) in enumerate(T['ground']):
        for pp in polys: get(ci_sub(pp[0]))['ground'][gi][1].append(pp)
    for bi, b in enumerate(T['buildings']):
        S = get(ci_sub(b[0])); S['_bmap'][bi] = len(S['buildings']); S['buildings'].append(b)
    for sh in T['shops']:
        if not isinstance(sh[3], int): continue          # an older bake's shop record: no board slot to hang on
        for S in P.values():
            if sh[0] in S['_bmap']:
                m = S['_smap']
                if sh[3] not in m: m[sh[3]] = len(S['shopNames']); S['shopNames'].append(T['shopNames'][sh[3]])
                S['shops'].append([S['_bmap'][sh[0]], sh[1], sh[2], m[sh[3]], sh[4]]); break
    pt = lambda k, ix, iz: [get(sub_of(x[ix], x[iz]))[k].append(x) for x in T.get(k, [])]
    pt('walls', 0, 1); pt('lamps', 0, 1); pt('poles', 0, 1); pt('stalls', 0, 1); pt('parked', 0, 1); pt('trees', 0, 1); pt('hoardings', 2, 3); pt('pins', 3, 4)
    for k2, v in T['marks'].items():
        for q in v:
            if k2 in ('center', 'lane'): mi = (len(q) >> 2) << 1; get(sub_of(q[mi], q[mi + 1]))['marks'][k2].append(q)
            else: get(sub_of(q[0], q[1]))['marks'][k2].append(q)
    for r in T.get('railways', []): get(sub_of(r[1][0], r[1][1]))['railways'].append(r)
    for pf in T.get('platforms', []): get(sub_of(pf[0], pf[1]))['platforms'].append(pf)
    if act_meta:
        c = act_meta['cell'] * 100
        for x in T.get('activity', []): get(sub_of((x[0] + 0.5) * c, (x[1] + 0.5) * c))['activity'].append(x)
    out = []
    for S in P.values():
        for k in ('_nmap', '_bmap', '_smap'): S.pop(k)
        si, sj, sr = S['tile']
        out.append((si, sj, sr, S))
    return out

cwater = []                                       # every river and lake, simplified, for the city map
seen = {k: set() for k in base}
meta = None; tiles = []; act_meta = None
files = sorted(glob.glob(os.path.join(SRC, 't_*.json')))
for f in files:
    i, j = map(int, re.findall(r't_(\d+)_(\d+)\.json', f)[0])
    M = json.load(open(f))
    if meta is None: meta = dict(M['meta']); meta.pop('tile', None); meta.pop('play', None)
    rect = M['meta']['tile']                       # cm
    vis, CH, NCX = meta['vis'], meta['chunk'] * 100, meta['ncx']
    ins = lambda x, z: rect[0] <= x < rect[2] and rect[1] <= z < rect[3]
    def ci_in(ci):
        a, b = ci % NCX, ci // NCX
        return ins(vis[0] + (a + 0.5) * CH, vis[1] + (b + 0.5) * CH)
    nm = [nid(n) for n in M['names']]
    gn = lambda k: nm[k] if k < len(nm) else 0
    # the tile's road graph, street names made global; main roads also go into the coarse graph
    G = M['graph']
    edges = []
    for e in G['edges']:
        e = list(e); e[5] = gn(e[5]); edges.append(e)
        if e[3] >= 3:
            A, B = G['nodes'][e[0]], G['nodes'][e[1]]
            coarse_edges.append([cnode(A[0], A[1]), cnode(B[0], B[1]), e[3], e[4], e[5], rdp(e[7], 600)])
    T = dict(graph=dict(nodes=G['nodes'], edges=edges), tile=[i, j, rect])
    # chunk-indexed layers: keep the chunks inside this tile
    for k in ('water', 'kerbs', 'banks', 'lakebanks', 'rails'):
        T[k] = [x for x in M.get(k, []) if ci_in(x[0])]
    T['ground'] = [[kind, [p for p in polys if ci_in(p[0])]] for kind, polys in M.get('ground', [])]
    for x in T['water']:
        for r in x[1]:
            if len(r) < 6: continue
            xs, zs = r[0::2], r[1::2]
            if (max(xs) - min(xs)) * (max(zs) - min(zs)) < 400 * 400: continue     # under ~4 m across: skip
            q = rdp(r, 250)
            if len(q) >= 6: cwater.append(q)
    # buildings: keep the tile's own, and remember where each old index went (shops point at buildings)
    bmap, B = {}, []
    for bi, b in enumerate(M['buildings']):
        if ci_in(b[0]): bmap[bi] = len(B); B.append(b)
    T['buildings'] = B
    # point layers: keep what stands inside the tile
    T['walls'] = [w for w in M.get('walls', []) if ins(w[0], w[1])]
    for k in ('lamps', 'poles', 'stalls', 'parked'): T[k] = [x for x in M.get(k, []) if ins(x[0], x[1])]
    T['signals'] = [s for s in M.get('signals', []) if ins(s[0], s[1])]       # node index stays tile-local
    T['hoardings'] = [h for h in M.get('hoardings', []) if ins(h[2], h[3])]
    T['trees'] = [t for t in M.get('trees', []) if ins(t[0], t[1])]
    mk = M.get('marks', {})
    T['marks'] = {k: ([s for s in v if ins(s[0], s[1])] if k in ('zebra', 'stop', 'bump') else v) for k, v in mk.items()}
    T['railways'] = M.get('railways', []); T['platforms'] = M.get('platforms', [])
    T['shopNames'] = M.get('shopNames', [])
    T['shops'] = [[bmap[s[0]], s[1], s[2], s[3], s[4]] for s in M.get('shops', []) if s[0] in bmap]
    T['pins'] = [p for p in M.get('pins', []) if ins(p[3], p[4])]
    base['places'] += [p for p in M.get('places', []) if ins(p[3], p[4])]
    base['pois'] += [p for p in M.get('pois', []) if ins(p[2], p[3])]
    act = M.get('activity') or {}
    if act:
        act_meta = {'cell': act['cell'], 'cls': act['cls']}
        c = act['cell'] * 100
        T['activity'] = [x for x in act['cells'] if ins((x[0] + 0.5) * c, (x[1] + 0.5) * c)]
    # city-wide bits go to the base once
    for k in ('landmarks', 'areas'):
        for x in M.get(k, []):
            if x[0] not in seen[k]: seen[k].add(x[0]); base[k].append(x)
    for fo in M.get('flyovers', []):
        key = json.dumps(fo[3][:4])
        if key not in seen['flyovers']: seen['flyovers'].add(key); fo = list(fo); fo[0] = gn(fo[0]); base['flyovers'].append(fo)
    for k in ('metro', 'mstations'):
        for x in M.get(k, []):
            key = json.dumps(x[1][:4] if isinstance(x[1], list) else x)
            if key not in seen[k]: seen[k].add(key); base[k].append(x)
    for b in M.get('buses', []):
        if ins(b[0], b[1]): base['buses'].append(b)
    # streamed as 1 km pieces: a sixteenth of the work each time one joins the world
    for (si, sj, sr, S) in split(T, rect, i, j, vis, CH, NCX, act_meta):
        s = json.dumps(S, separators=(',', ':'), ensure_ascii=False).encode()
        with gzip.open(os.path.join(OUT, f't_{si}_{sj}.json.gz'), 'wb', 9) as fh: fh.write(s)
        tiles.append([si, sj, sr, len(s)])
    print(f'tile {i},{j}', 'buildings', len(B), 'pins', len(T['pins']), flush=True)
# (every real place for the map's search: tools/bake_allplaces.py writes data/pune/pins.json.gz)
out = dict(meta={**meta, 'outline': [[round(v, 5) for v in p] for p in outline], 'tiles': tiles, 'tileSize': 1000, 'activity': act_meta},
           names=names, districts=['deccan', 'peth', 'camp', 'kp', 'station', 'residential', 'riverside'],
           landmarks=base['landmarks'], areas=base['areas'], flyovers=base['flyovers'], metro=base['metro'], mstations=base['mstations'], buses=base['buses'], places=base['places'], pois=base['pois'], street=1)
s = json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode()
with gzip.open(os.path.join(OUT, 'base.json.gz'), 'wb', 9) as fh: fh.write(s)
# the main-road network and rivers for the map's street names: not needed to start, so a file of their own
with gzip.open(os.path.join(OUT, 'base_map.json.gz'), 'wb', 9) as fh:
    fh.write(json.dumps(dict(coarse=dict(nodes=coarse_nodes, edges=coarse_edges), cwater=cwater), separators=(',', ':'), ensure_ascii=False).encode())
print('base', len(s) // 1024, 'KB', 'coarse nodes', len(coarse_nodes), 'edges', len(coarse_edges), 'names', len(names), 'tiles', len(tiles))
