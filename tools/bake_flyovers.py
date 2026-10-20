# Flyovers from OSM: elevated road decks you can drive on.
#   python3 tools/bake_flyovers.py     (after bake_map.py; rewrites data/map.json)
# A flyover is an OSM drivable way tagged bridge=yes|viaduct with layer >= 1 that does not cross
# the river (river bridges stay at grade) and is longer than 120 m, or one named "... Flyover".
# Deck height: 6.5 m on layer 1, 9.5 m on layer 2. Where a deck end joins an ordinary road the
# deck ramps down to 0.15 m over up to 110 m. Satellite-traced "buildings" that are really the
# deck, and trees / lamps / poles that would poke through it, are removed.
#
# Output: flyovers: [[name_id, width_cm, oneway, [x,z,...] cm, [h,...] cm]]
import json, math, os, collections
from shapely.geometry import LineString, Polygon, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MAP = os.path.join(ROOT, 'data/map.json')
M = json.load(open(MAP)); meta = M['meta']
D = json.load(open(os.path.join(ROOT, 'data/raw/merged.json')))
def proj(lat, lon): return ((lon - meta['lon0']) * meta['mlon'], -(lat - meta['lat0']) * meta['mlat'])
P = {int(k): proj(v[0], v[1]) for k, v in D['nodes'].items()}
vis = [v / 100 for v in meta['vis']]
from shapely.geometry import box
VIS = box(*vis)
DRIVE = {'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
         'unclassified', 'residential', 'living_street', 'service', 'road'}
river = []
for w in D['ways'].values():
    t = w.get('tags', {})
    if t.get('natural') == 'water' and t.get('water') == 'river' or t.get('waterway') == 'riverbank':
        pts = [P[n] for n in w['nd'] if n in P]
        if len(pts) >= 4 and w['nd'][0] == w['nd'][-1]:
            g = Polygon(pts); river.append(g if g.is_valid else g.buffer(0))
for r in D['rels'].values():
    pass
RIVER = unary_union(river) if river else Polygon()
# fall back on the baked water polygons too
for _, rings in M['water']:
    for r in rings:
        pts = [(r[k] / 100, r[k + 1] / 100) for k in range(0, len(r), 2)]
        if len(pts) >= 3:
            g = Polygon(pts); RIVER = RIVER.union(g if g.is_valid else g.buffer(0))

def width_of(t):
    h = t['highway'].replace('_link', '')
    ow = t.get('oneway') in ('yes', '1', 'true', '-1')
    lanes = int(t['lanes']) if t.get('lanes', '').isdigit() else None
    try:
        tw = float(t.get('width', '').replace('m', ''))
        if 3 <= tw <= 30: return tw, ow
    except ValueError:
        pass
    per = 3.3
    if lanes: return lanes * per + 1.0, ow
    return (2 if ow else 4) * per + (1.0 if h in ('trunk', 'primary') else 0.6), ow

fly = []           # dict(nodes, pts, w, ow, H, name)
for k, w in D['ways'].items():
    t = w.get('tags', {})
    if t.get('highway') not in DRIVE: continue
    try: layer = int(t.get('layer', '0'))
    except ValueError: layer = 0
    named = 'flyover' in t.get('name', '').lower()
    if not (t.get('bridge') in ('yes', 'viaduct') and layer >= 1) and not named: continue
    nds = [n for n in w['nd'] if n in P]
    if len(nds) < 2: continue
    ln = LineString([P[n] for n in nds])
    if not ln.intersects(VIS): continue
    if ln.intersects(RIVER): continue
    if ln.length <= 120 and not named: continue
    if t.get('oneway') == '-1': nds = nds[::-1]
    wd, ow = width_of(t)
    fly.append(dict(nodes=nds, w=wd, ow=ow, H=6.5 + 3.0 * max(0, layer - 1), name=t.get('name', '')))
print('flyover ways', len(fly), collections.Counter(f['name'] for f in fly).most_common(8))

# which flyover ends touch the ordinary road network (ramp down there)
fly_nodes = collections.Counter()          # how many flyover ways pass through each node
for f in fly:
    for n in set(f['nodes']): fly_nodes[n] += 1
ground_nodes = set()
for w in D['ways'].values():
    t = w.get('tags', {})
    if t.get('highway') not in DRIVE: continue
    if t.get('bridge') in ('yes', 'viaduct') and t.get('layer', '0') not in ('0', ''): continue
    for n in w['nd']: ground_nodes.add(n)
names = M['names']; nidx = {tuple(n): i for i, n in enumerate(names)}
def name_id(en):
    if not en: return 0
    for i, n in enumerate(names):
        if n[0] == en: return i
    names.append([en, '']); return len(names) - 1

RAMP = 110.0
# distance along the flyover network from the nearest ramp foot, so a ramp that is split into
# several OSM pieces still climbs smoothly across them
import heapq
adj = collections.defaultdict(list)
for f in fly:
    nd = f['nodes']
    for a, b in zip(nd, nd[1:]):
        l = math.dist(P[a], P[b]); adj[a].append((b, l)); adj[b].append((a, l))
feet = set()
for f in fly:
    for n in (f['nodes'][0], f['nodes'][-1]):
        if n in ground_nodes and fly_nodes[n] == 1 and VIS.buffer(-5).contains(Point(P[n])): feet.add(n)
dist = {n: 0.0 for n in feet}; pq = [(0.0, n) for n in feet]
while pq:
    d0, a = heapq.heappop(pq)
    if d0 > dist.get(a, 1e18): continue
    for b, l in adj[a]:
        if d0 + l < dist.get(b, 1e18): dist[b] = d0 + l; heapq.heappush(pq, (d0 + l, b))
print('ramp feet', len(feet))
# where a layer-2 deck meets a layer-1 deck it climbs the extra 3 m over 60 m
nodeH = collections.defaultdict(list)
for f in fly:
    for n in set(f['nodes']): nodeH[n].append(f['H'])
steps = {n: min(v) for n, v in nodeH.items() if max(v) - min(v) > 0.5}
dist2 = {}; pq = []
for n, hl in steps.items(): dist2[n] = (0.0, hl); pq.append((0.0, n))
while pq:
    d0, a = heapq.heappop(pq)
    if d0 > dist2[a][0]: continue
    for b, l in adj[a]:
        if b not in dist2 or d0 + l < dist2[b][0]: dist2[b] = (d0 + l, dist2[a][1]); heapq.heappush(pq, (d0 + l, b))
STEP = 60.0
sm = lambda u: u * u * (3 - 2 * u)
out = []
footprints = []
for f in fly:
    pts = [P[n] for n in f['nodes']]
    ln = LineString(pts)
    L = ln.length
    arc = [0.0]
    for a, b in zip(pts, pts[1:]): arc.append(arc[-1] + math.dist(a, b))
    nd_d = [(arc[i], dist.get(n, 1e9)) for i, n in enumerate(f['nodes'])]
    nd_s = [(arc[i],) + dist2[n] for i, n in enumerate(f['nodes']) if n in dist2]
    n = max(2, int(L // 5) + 1)
    dense = [ln.interpolate(i / (n - 1), normalized=True) for i in range(n)]
    H = f['H']
    hs = []
    for i, p in enumerate(dense):
        sp = L * i / (n - 1)
        dd = min(d + abs(sp - sa) for sa, d in nd_d)
        h = min(H, 0.15 + (H - 0.15) * sm(min(1.0, dd / RAMP)))
        for sa, d, hl in nd_s:
            if H > hl: h = min(h, hl + (H - hl) * sm(min(1.0, (d + abs(sp - sa)) / STEP)))
        hs.append(h)
    flat = []
    for p in dense: flat += [round(p.x * 100), round(p.y * 100)]
    out.append([name_id(f['name']), round(f['w'] * 100), 1 if f['ow'] else 0, flat, [round(h * 100) for h in hs]])
    footprints.append(ln.buffer(f['w'] / 2 + 1.0, cap_style='flat'))
deck = unary_union(footprints) if footprints else Polygon()
# main carriageways (rank >= 3): nothing real stands on them except elevated metro stations,
# skywalks and the flyovers themselves, which satellite tracing sometimes reports as buildings
mains = []
for e in M['graph']['edges']:
    if e[3] >= 3:
        r = e[7]; pts = [(r[k] / 100, r[k + 1] / 100) for k in range(0, len(r), 2)]
        if len(pts) >= 2: mains.append(LineString(pts).buffer(e[2] / 200, cap_style='flat'))
MAIN = unary_union(mains)
print('deck area m2', round(deck.area))

# remove satellite "buildings" that are the deck itself, and tall things under it
removed = collections.Counter()
keepB = []
for b in M['buildings']:
    r = b[1]
    pts = [(r[k] / 100, r[k + 1] / 100) for k in range(0, len(r), 2)]
    if len(pts) >= 3:
        g = Polygon(pts)
        if not g.is_valid: g = g.buffer(0)
        if g.intersection(deck).area > 0.4 * g.area: removed['buildings on a deck'] += 1; continue
        if g.intersection(MAIN).area > 0.3 * g.area: removed['buildings over a main road'] += 1; continue
    keepB.append(b)
dtree = STRtree([deck]) if not deck.is_empty else None
def under(x, z): return dtree is not None and deck.contains(Point(x, z))
for key in ('trees', 'lamps', 'poles', 'stalls', 'hoardings'):
    lst = M.get(key) or []
    xi, zi = (2, 3) if key == 'hoardings' else (0, 1)
    keep = [e for e in lst if not under(e[xi] / 100, e[zi] / 100)]
    removed[key] = len(lst) - len(keep); M[key] = keep
# buildings are indexed by shops (s[0]); keep shop indices valid
if removed['buildings on a deck'] or removed['buildings over a main road']:
    old_to_new, j = {}, 0
    keepset = set(id(b) for b in keepB)
    for i, b in enumerate(M['buildings']):
        if id(b) in keepset: old_to_new[i] = j; j += 1
    M['shops'] = [[old_to_new[s[0]]] + s[1:] for s in M.get('shops', []) if s[0] in old_to_new]
    M['buildings'] = keepB
print('removed', dict(removed))
M['flyovers'] = out
json.dump(M, open(MAP, 'w'), separators=(',', ':'), ensure_ascii=False)
print('flyovers', len(out), 'wrote', os.path.getsize(MAP) // 1024, 'KB')
