#!/usr/bin/env python3
"""
bake_map.py - turns the merged OpenStreetMap extract into game-ready map data.

Coordinates: local metres, x = east, z = south (three.js style, north = -z).
Everything the runtime needs is precomputed here so the browser only has to
triangulate and build meshes:
  roads / sidewalks / ground / water polygons (chunked), kerb + railing + bank lines,
  buildings (clipped to roads, with heights, styles and street-facing edges),
  road graph for AI traffic + GPS, markings, signals, trees, props, POIs.
Map data (c) OpenStreetMap contributors, ODbL.
"""
import json, math, random, sys, os, collections, re
import numpy as np
import shapely
from shapely.geometry import (LineString, Polygon, MultiPolygon, Point, box,
                              MultiLineString, GeometryCollection, LinearRing)
from shapely.ops import unary_union, linemerge, substring
from shapely import STRtree

SRC = sys.argv[1] if len(sys.argv) > 1 else 'raw/merged.json'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'map.json'

# ---------------------------------------------------------------- projection
# downloaded OSM box 18.508–18.546 N, 73.829–73.901 E; the playable box sits MARGIN inside it
_DL = (18.508, 18.546, 73.829, 73.901)
LAT_MIN, LAT_MAX = _DL[0] + 140 / 110686.0, _DL[1] - 140 / 110686.0
LON_MIN, LON_MAX = _DL[2] + 140 / 105589.0, _DL[3] - 140 / 105589.0
LAT0, LON0 = (LAT_MIN + LAT_MAX) / 2, (LON_MIN + LON_MAX) / 2
MLAT, MLON = 110686.0, 105589.0          # metres per degree at 18.52 N

def proj(lat, lon):
    return ((lon - LON0) * MLON, -(lat - LAT0) * MLAT)

PX0, PZ1 = proj(LAT_MIN, LON_MIN)
PX1, PZ0 = proj(LAT_MAX, LON_MAX)
PLAY = box(PX0, PZ0, PX1, PZ1)            # player is kept inside this
MARGIN = 138.0
VIS = PLAY.buffer(MARGIN, join_style='mitre')   # rendered + AI area
VB = VIS.bounds
CHUNK = 200.0
# ---- tile mode (whole Pune, tools/bake_pune.py): NH_TILE="x0,z0,x1,z1" (game metres, chunk aligned),
# NH_GRID="gx0,gz0,ncx,ncz" (the global chunk grid). The same projection as the original map, the
# area clipped to the city outline (data/raw/pune/outline.json). Everything is computed over the tile
# plus a margin, and only what falls in the tile's own chunks is written, so tiles join seamlessly.
TILE = os.environ.get('NH_TILE')
OUTL = None
if TILE:
    TX0, TZ0, TX1, TZ1 = map(float, TILE.split(','))
    GX0, GZ0, GNCX, GNCZ = os.environ['NH_GRID'].split(','); GX0, GZ0, GNCX, GNCZ = float(GX0), float(GZ0), int(GNCX), int(GNCZ)
    _ol = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data/raw/pune/outline.json')))['outline'][0]
    OUTL = Polygon([proj(la, lo) for lo, la in _ol]).buffer(0)
    CORE = box(TX0, TZ0, TX1, TZ1)
    VIS = CORE.buffer(320.0, join_style='mitre').intersection(OUTL)
    PLAY = VIS
    PX0, PZ0, PX1, PZ1 = TX0, TZ0, TX1, TZ1
    VB = VIS.bounds
    MARGIN = 0.0
rng = random.Random(1618)

import time as _time
_T0 = _time.time()
def log(*a):
    print('[%6.1fs]' % (_time.time() - _T0), *a, file=sys.stderr, flush=True)

# ---------------------------------------------------------------- load OSM
D = json.load(open(SRC))
NODES, WAYS, RELS = D['nodes'], D['ways'], D['rels']
P = {}
for k, (lat, lon, tags) in NODES.items():
    P[int(k)] = proj(lat, lon)

def way_coords(w):
    return [P[n] for n in w['nd'] if n in P]

def as_polys(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, (MultiPolygon, GeometryCollection)):
        out = []
        for x in g.geoms:
            out += as_polys(x)
        return out
    return []

def as_lines(g):
    if g is None or g.is_empty:
        return []
    if isinstance(g, LineString):
        return [g]
    if isinstance(g, LinearRing):
        return [LineString(g.coords)]
    if hasattr(g, 'geoms'):
        out = []
        for x in g.geoms:
            out += as_lines(x)
        return out
    return []

def fix(g):
    if not g.is_valid:
        g = shapely.make_valid(g)
    return g

def cm(v):
    return int(round(v * 100))

def ring_out(coords):
    """closed ring -> flat cm int list without the duplicate last point"""
    c = list(coords)
    if len(c) > 1 and c[0] == c[-1]:
        c = c[:-1]
    out = []
    for x, z in c:
        out += [cm(x), cm(z)]
    return out

def line_out(coords):
    out = []
    for x, z in coords:
        out += [cm(x), cm(z)]
    return out

def poly_out(p):
    p = shapely.geometry.polygon.orient(p, 1.0)
    rings = [ring_out(p.exterior.coords)] + [ring_out(i.coords) for i in p.interiors]
    return rings

# ---------------------------------------------------------------- multipolygon relations
def rel_polys(r):
    outers, inners = [], []
    for typ, ref, role in r['members']:
        if typ != 'way' or str(ref) not in WAYS:
            continue
        cs = way_coords(WAYS[str(ref)])
        if len(cs) < 2:
            continue
        (inners if role == 'inner' else outers).append(LineString(cs))
    def build(lines):
        merged = linemerge(lines) if lines else None
        polys = []
        for ln in as_lines(merged):
            if ln.is_ring or (len(ln.coords) > 3 and Point(ln.coords[0]).distance(Point(ln.coords[-1])) < 0.5):
                cs = list(ln.coords)
                if cs[0] != cs[-1]:
                    cs.append(cs[0])
                pg = fix(Polygon(cs))
                polys += as_polys(pg)
        return polys
    o = build(outers)
    i = build(inners)
    if not o:
        return []
    g = unary_union(o)
    if i:
        g = g.difference(unary_union(i))
    return as_polys(fix(g))

def way_poly(w):
    cs = way_coords(w)
    if len(cs) < 4 or w['nd'][0] != w['nd'][-1]:
        return []
    return as_polys(fix(Polygon(cs)))

# ---------------------------------------------------------------- water
water_polys, lake_polys = [], []
river_line = None
for k, w in WAYS.items():
    t = w['tags']
    if t.get('natural') == 'water':
        ps = way_poly(w)
        if t.get('water') == 'river':
            water_polys += ps
        else:
            lake_polys += ps
    if t.get('waterway') == 'river' and t.get('name') == 'Mutha':
        river_line = LineString(way_coords(w))
for k, r in RELS.items():
    t = r['tags']
    if t.get('natural') == 'water' or t.get('waterway') == 'riverbank':
        water_polys += rel_polys(r)
RIVER = fix(unary_union(water_polys)).intersection(VIS) if water_polys else Polygon()
LAKES = fix(unary_union(lake_polys)).intersection(VIS) if lake_polys else Polygon()
if RIVER.is_empty:
    RIVER = box(9e6, 9e6, 9e6 + 1, 9e6 + 1)      # no river in this tile: a speck far away keeps the overlays happy
WATER = fix(unary_union([RIVER, LAKES]))
log('water area', round(RIVER.area), 'lakes', round(LAKES.area))

def peth_side(x, z):
    """True inside the old-city peths."""
    return district_of(x, z) == 1
def _old_peth_side(x, z):
    if river_line is None:
        return False
    d = river_line.project(Point(x, z))
    a = river_line.interpolate(max(0, d - 5))
    b = river_line.interpolate(d + 5)
    p = river_line.interpolate(d)
    tx, tz = b.x - a.x, b.y - a.y
    cr = tx * (z - p.y) - tz * (x - p.x)
    # river flows roughly SW -> NE (north-east = +x, -z). Peths are to its right.
    return cr > 0

# ---------------------------------------------------------------- roads
DRIVE = {'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link',
         'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'road'}
CLASS_RANK = {'trunk': 6, 'primary': 5, 'secondary': 4, 'tertiary': 3, 'residential': 2,
              'unclassified': 2, 'road': 2, 'living_street': 1, 'service': 0}
POPULAR = {
    'Gopal Krushna Gokhale Path': ('FC Road', 'फर्ग्युसन कॉलेज रस्ता'),
    'Jangli Maharaj Path': ('JM Road', 'जंगली महाराज रस्ता'),
    'Lokmanya Tilak Marg': ('Tilak Road', 'टिळक रस्ता'),
    'Laxmi Path': ('Laxmi Road', 'लक्ष्मी रस्ता'),
    'Bhandarkar Path': ('Bhandarkar Road', 'भांडारकर रस्ता'),
    'Prabhat Path': ('Prabhat Road', 'प्रभात रस्ता'),
    'Karve Road': ('Karve Road', 'कर्वे रस्ता'),
    'Ghole Road': ('Ghole Road', 'घोले रस्ता'),
    'Apte Path': ('Apte Road', 'आपटे रस्ता'),
    'Ganeshkhind Road': ('Ganeshkhind Road', 'गणेशखिंड रस्ता'),
    'Shivaji Road': ('Shivaji Road', 'शिवाजी रस्ता'),
    'Sambhaji Bridge': ('Lakdi Pul (Sambhaji Bridge)', 'लकडी पूल'),
    'Narubhau Limaye Path': ('Narubhau Limaye Path', 'नारूभाऊ लिमये पथ'),
    'Chhatrapati Sambhaji Path': ('Chhatrapati Sambhaji Road', 'छत्रपती संभाजी रस्ता'),
    'Congress Bhavan Path': ('Congress Bhavan Road', 'काँग्रेस भवन रस्ता'),
    'Chaturshringi Road': ('Chaturshringi Road', 'चतु:शृंगी रस्ता'),
    'Mahatma Gandhi Marg': ('MG Road', 'महात्मा गांधी रस्ता'),
    'Senapati Bapat Marg': ('SB Road', 'सेनापती बापट रस्ता'),
    'Old Pune–Mumbai Highway': ('Old Mumbai–Pune Highway', 'जुना पुणे-मुंबई महामार्ग'),
    'Bund Garden Road': ('Bund Garden Road', 'बंड गार्डन रस्ता'),
    'North Main Road': ('North Main Road', 'नॉर्थ मेन रोड'),
    'South Main Road': ('South Main Road', 'साउथ मेन रोड'),
    'Koregaon Road': ('Koregaon Road', 'कोरेगाव रस्ता'),
    'Dhole Patil Road': ('Dhole Patil Road', 'ढोले पाटील रस्ता'),
    'Moledina Road': ('Moledina Road', 'मोलेदिना रस्ता'),
    'East Street': ('East Street', 'ईस्ट स्ट्रीट'),
    'Sassoon Marg': ('Sassoon Road', 'ससून रस्ता'),
    'Raja Bahadur Mill Marg': ('Raja Bahadur Mill Road', 'राजा बहादूर मिल रस्ता'),
    'Babasaheb Ambedkar Marg': ('Ambedkar Road', 'आंबेडकर रस्ता'),
    'Jawaharlal Nehru Marg': ('Nehru Road', 'नेहरू रस्ता'),
    'Lalbahadur Shashtri Marg': ('LBS Road', 'लालबहादूर शास्त्री रस्ता'),
    'Vishnushastri Chiplunkar Path': ('Chiplunkar Road', 'चिपळूणकर रस्ता'),
    'Bajirao Road': ('Bajirao Road', 'बाजीराव रस्ता'),
    'R. B. Kumthekar Marg': ('Kumthekar Road', 'कुमठेकर रस्ता'),
    'Narsimha Chintaman Kelkar Marg': ('NC Kelkar Road', 'न. चिं. केळकर रस्ता'),
    'Gopal Ganesh Agarkar Path': ('Agarkar Road', 'आगरकर रस्ता'),
    'Sadhu Vaswani Path': ('Sadhu Vaswani Road', 'साधू वासवानी रस्ता'),
    'Sangamwadi Road': ('Sangamwadi Road', 'संगमवाडी रस्ता'),
    'Boat Club Road': ('Boat Club Road', 'बोट क्लब रस्ता'),
    'Deccan College Road': ('Deccan College Road', 'डेक्कन कॉलेज रस्ता'),
    'Mangaldas Road': ('Mangaldas Road', 'मंगलदास रस्ता'),
    'Kasturba Gandhi Road': ('Kasturba Gandhi Road', 'कस्तुरबा गांधी रस्ता'),
    'Sangamwadi Bridge': ('Sangam Bridge', 'संगम पूल'),
    'New Sangam Bridge': ('New Sangam Bridge', 'नवा संगम पूल'),
    'Jayantarao Tilak Bridge': ('Jayantrao Tilak Bridge', 'जयंतराव टिळक पूल'),
}

# ---------------------------------------------------------------- districts (shops, people, trees, building styles)
DISTRICT_CENTRES = [  # code, lat, lon
    (0, 18.5172, 73.8418), (0, 18.5235, 73.8410), (5, 18.5335, 73.8370), (5, 18.5125, 73.8345), (5, 18.5330, 73.8440),
    (4, 18.5300, 73.8500), (1, 18.5150, 73.8555), (1, 18.5205, 73.8590), (1, 18.5130, 73.8630), (4, 18.5285, 73.8690),
    (4, 18.5270, 73.8760), (2, 18.5160, 73.8790), (2, 18.5195, 73.8840), (6, 18.5370, 73.8820), (3, 18.5395, 73.8920),
    (3, 18.5355, 73.8930), (6, 18.5420, 73.8650), (6, 18.5250, 73.8620),
]
DISTRICT_NAMES = ['deccan', 'peth', 'camp', 'kp', 'station', 'residential', 'riverside']
def district_of(x, z):
    best, bd = 5, 1e18
    for code, la, lo in DISTRICT_CENTRES:
        cx, cz = proj(la, lo)
        d = (cx - x) ** 2 + (cz - z) ** 2
        if d < bd:
            best, bd = code, d
    return best
NAMES = []
NAME_IDX = {}

def name_id(en, mr=''):
    key = (en, mr)
    if key not in NAME_IDX:
        NAME_IDX[key] = len(NAMES)
        NAMES.append([en, mr])
    return NAME_IDX[key]

name_id('', '')

def road_dims(t):
    h = t['highway']
    base = h.replace('_link', '')
    ow = t.get('oneway') in ('yes', '1', 'true', '-1') or t.get('junction') == 'roundabout'
    lanes = int(t['lanes']) if t.get('lanes', '').isdigit() else None
    if base == 'trunk':
        w = (lanes or (2 if ow else 4)) * 3.4 + 1.0; sw = 3.0
    elif base == 'primary':
        w = (lanes or (2 if ow else 4)) * 3.3 + 1.2; sw = 3.0
    elif base == 'secondary':
        w = (lanes or (2 if ow else 3)) * 3.2 + 1.0; sw = 2.4
    elif base == 'tertiary':
        w = (lanes * 3.1 + 0.8) if lanes else (6.2 if ow else 8.0); sw = 1.8
    elif base in ('residential', 'unclassified', 'road'):
        w = 5.4 if ow else 6.0; sw = 1.1
    elif base == 'living_street':
        w = 4.6; sw = 0.0
    else:
        w = 3.8; sw = 0.0
    if h.endswith('_link'):
        w = min(w, 7.4)
    n = t.get('name', '')
    if n == 'Gopal Krushna Gokhale Path': w, sw = 11.5, 4.2
    elif n == 'Jangli Maharaj Path': w, sw = max(w, 13.0), 3.6
    elif n == 'Lokmanya Tilak Marg': w, sw = 12.5, 2.6
    elif n == 'Laxmi Path': w, sw = 7.2, 1.4
    elif n in ('Bhandarkar Path', 'Prabhat Path'): w, sw = 8.2, 2.2
    elif n == 'Karve Road': w, sw = max(w, 9.0), 3.0
    if t.get('bridge') == 'yes' and sw == 0:
        sw = 1.2
    return w, sw, ow

log('buildings start')
bpolys = []
for k, w in WAYS.items():
    t = w['tags']
    if 'building' in t or 'building:part' in t:
        if 'building:part' in t and 'building' not in t:
            continue
        for p in way_poly(w):
            bpolys.append((p, t, int(k)))
for k, r in RELS.items():
    t = r['tags']
    if 'building' in t:
        for p in rel_polys(r):
            bpolys.append((p, t, int(k)))
# Overture Maps buildings (Google Open Buildings + Microsoft ML footprints) fill the gaps OSM has
# in the dense peths and bastis. Footprints already in OSM, or mostly covered by an OSM building,
# are skipped so OSM's tagged detail (names, levels, landmarks) always wins.
OVT_B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data/raw/overture/buildings.parquet')
if os.path.exists(OVT_B) and not os.environ.get('NO_OVERTURE'):
    import duckdb
    from shapely import wkb as _wkb
    con = duckdb.connect(); con.sql('load spatial')
    if TILE:
        OVT_B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data/raw/pune/building.parquet')
        _b = VIS.bounds
        _lo0, _lo1 = _b[0] / MLON + LON0, _b[2] / MLON + LON0
        _la0, _la1 = -_b[3] / MLAT + LAT0, -_b[1] / MLAT + LAT0
        _where = f"where bbox.xmax >= {_lo0} and bbox.xmin <= {_lo1} and bbox.ymax >= {_la0} and bbox.ymin <= {_la1}"
    else:
        _where = ''
    rows = con.sql(f"""select ST_AsWKB(geometry), list_transform(sources, s -> s.dataset), num_floors, height
                       from '{OVT_B}' {_where}""").fetchall()
    osm_tree = STRtree([b[0] for b in bpolys])
    added = 0
    for i, (g, srcs, floors, height) in enumerate(rows):
        if 'OpenStreetMap' in srcs and not TILE:
            continue
        geom = _wkb.loads(bytes(g))
        for gp in ([geom] if geom.geom_type == 'Polygon' else list(getattr(geom, 'geoms', []))):
            p = fix(Polygon([proj(y, x) for x, y in gp.exterior.coords]))
            if p.is_empty or p.area < 14:
                continue
            cover = sum(bpolys[j][0].intersection(p).area for j in osm_tree.query(p))
            if cover > 0.3 * p.area:
                continue
            t = {'building': 'yes', 'source': 'overture'}
            if floors: t['building:levels'] = str(int(floors))
            elif height: t['height'] = str(round(float(height), 1))
            bpolys.append((p, t, 9_000_000_000 + i))
            added += 1
    log('overture buildings added', added)


# ---------------------------------------------------------------- street corridors
# Real carriageway width is rarely tagged in Pune. The buildings on both sides are real
# (satellite-traced footprints), so the gap between them caps how wide a street can be.
_bgeo = [bp[0] for bp in bpolys]
_btree = STRtree(_bgeo)
def corridor_widths(ln, step=12.0, reach=25.0):
    out = []
    L = ln.length
    n = max(1, int(L // step))
    for i in range(n):
        d = (i + 0.5) * L / n
        p = ln.interpolate(d)
        q = ln.interpolate(min(L, d + 0.5)); o = ln.interpolate(max(0.0, d - 0.5))
        tx, tz = q.x - o.x, q.y - o.y; tl = math.hypot(tx, tz) or 1.0
        nx, nz = -tz / tl, tx / tl
        side = []
        for sgn in (1, -1):
            ray = LineString([(p.x + nx * sgn * 0.3, p.y + nz * sgn * 0.3), (p.x + nx * sgn * reach, p.y + nz * sgn * reach)])
            best = None
            for j in _btree.query(ray):
                g = _bgeo[j]
                if g.intersects(ray):
                    dd = p.distance(g.intersection(ray))
                    best = dd if best is None else min(best, dd)
            side.append(best)
        if side[0] is not None and side[1] is not None:
            out.append(side[0] + side[1])
    return out, n
MINW = {'trunk': 7.0, 'primary': 6.5, 'secondary': 6.0, 'tertiary': 5.0, 'unclassified': 3.6, 'residential': 3.6, 'road': 3.6,
        'living_street': 3.0, 'service': 2.8}
corr_stats = collections.Counter()

RD = []      # dicts: line, w, sw, ow, cls, rank, name, nid, oid, nodes, bridge, service
for k, w in WAYS.items():
    t = w['tags']
    h = t.get('highway')
    if h not in DRIVE:
        continue
    if t.get('area') == 'yes':
        continue
    if t.get('tunnel') in ('yes', 'building_passage', 'culvert'):
        continue
    try:
        layer = int(t.get('layer', '0'))
    except ValueError:
        layer = 0
    if layer < 0:
        continue
    if t.get('service') in ('parking_aisle', 'drive-through', 'emergency_access'):
        continue
    nds = [n for n in w['nd'] if n in P]
    if len(nds) < 2:
        continue
    cs = [P[n] for n in nds]
    ln = LineString(cs)
    if ln.length < 0.5:
        continue
    is_bridge = t.get('bridge') in ('yes', 'viaduct')
    if is_bridge and layer >= 1 and not ln.intersects(RIVER) and ln.length > 120:
        continue  # long flyovers: not modelled yet (short culverts over nalas stay at grade)
    if 'Flyover' in t.get('name', ''):
        continue
    if not ln.intersects(VIS.buffer(60)):
        continue
    if t.get('oneway') == '-1':
        nds = nds[::-1]
        cs = cs[::-1]
        ln = LineString(cs)
    wd, sw, ow = road_dims(t)
    base = h.replace('_link', '')
    try:
        tagged_w = float(t.get('width', '').replace('m', '').strip())
    except ValueError:
        tagged_w = 0
    if 2.5 <= tagged_w <= 40:
        wd = tagged_w; corr_stats['tagged'] += 1
    elif not (t.get('bridge') in ('yes', 'viaduct')):
        cw, ns = corridor_widths(ln)
        if len(cw) >= max(2, 0.4 * ns):
            c = sorted(cw)[len(cw) // 4]               # a narrow-but-not-extreme point of the street
            if c < wd + 2 * sw:
                sw2 = 0.0 if sw == 0 else max(0.6, min(sw, (c - wd) / 2))
                wd2 = max(MINW.get(base, 3.0), min(wd, c - 2 * sw2))
                corr_stats['narrowed'] += 1
                wd, sw = wd2, sw2
            else:
                corr_stats['fits'] += 1
        else:
            corr_stats['open'] += 1
    nm = t.get('name', '')
    en, mr = POPULAR.get(nm, (nm, t.get('name:mr', '')))
    if nm and not mr:
        mr = t.get('name:mr', '')
    RD.append(dict(line=ln, w=wd, sw=sw, ow=ow, cls=base, rank=CLASS_RANK.get(base, 0), name=nm,
                   nid=name_id(en, mr) if nm else 0, oid=int(k), nodes=nds, bridge=is_bridge,
                   service=(base == 'service' or base == 'living_street'),
                   access=t.get('access', '')))
log('road ways', len(RD), dict(corr_stats))

def buf(r, extra=0.0):
    return r['line'].buffer(r['w'] / 2 + extra, cap_style='round', join_style='round', quad_segs=4)

ROAD_RAW = unary_union([buf(r) for r in RD])
CLOSE = 2.6
ROAD = fix(ROAD_RAW.buffer(CLOSE, quad_segs=3).buffer(-CLOSE, quad_segs=3))
ROAD = fix(ROAD.intersection(VIS))
MAIN_ROAD = fix(unary_union([buf(r) for r in RD if r['rank'] >= 3]).intersection(ROAD))
SW_RAW = unary_union([buf(r, r['sw']) for r in RD if r['sw'] > 0])
SW = fix(SW_RAW.buffer(1.5, quad_segs=3).buffer(-1.5, quad_segs=3))
SW = fix(SW.difference(ROAD).intersection(VIS))
log('road area', round(ROAD.area), 'sidewalk area', round(SW.area))

# metro viaduct: medians where it runs over roads + pillar line
metro_lines = []
for k, w in WAYS.items():
    t = w['tags']
    if t.get('bridge') == 'viaduct' and t.get('railway') in ('subway', 'construction', 'light_rail', 'rail'):
        cs = way_coords(w)
        if len(cs) >= 2:
            ln = LineString(cs)
            if ln.intersects(VIS):
                metro_lines.append((ln.intersection(VIS), t.get('railway') == 'construction', t.get('name', '')))
MEDIANS = Polygon()
if metro_lines:
    mlu = unary_union([m[0] for m in metro_lines])
    MEDIANS = fix(mlu.buffer(1.1, cap_style='flat').intersection(ROAD).difference(RIVER))
    MEDIANS = unary_union([p for p in as_polys(MEDIANS) if p.area > 6])
    if not MEDIANS.is_empty:
        ROAD = fix(ROAD.difference(MEDIANS))

# water vs roads: bridges
BRIDGE = fix(unary_union([ROAD, SW]).intersection(RIVER))
GROUND = fix(VIS.difference(ROAD).difference(WATER).difference(SW))
log('bridge area', round(BRIDGE.area), 'ground area', round(GROUND.area))
for _g in (ROAD, SW, WATER, RIVER, MAIN_ROAD, VIS, PLAY):
    shapely.prepare(_g)

# ---------------------------------------------------------------- landuse overlays
LU_TYPES = {  # ground surface ids used by the runtime
    'compound': 0, 'pavers': 1, 'grass': 2, 'soil': 3, 'scrub': 4, 'plaza': 5, 'rail': 6,
}
lu = collections.defaultdict(list)
campus_polys = []
for src in [('w', k, w) for k, w in WAYS.items()] + [('r', k, r) for k, r in RELS.items()]:
    typ, k, el = src
    t = el['tags']
    kind = None
    if t.get('leisure') in ('park', 'garden') or t.get('landuse') in ('grass', 'recreation_ground', 'village_green', 'meadow', 'cemetery'):
        kind = 'grass'
    elif t.get('leisure') in ('pitch', 'stadium', 'track', 'sports_centre'):
        kind = 'soil'
    elif t.get('natural') in ('wood', 'scrub', 'grassland', 'heath', 'wetland') or t.get('landuse') in ('forest',):
        kind = 'scrub'
    elif t.get('amenity') in ('parking',) or t.get('landuse') in ('railway',):
        kind = 'plaza'
    if t.get('amenity') in ('college', 'school', 'university', 'hospital'):
        ps = way_poly(el) if typ == 'w' else rel_polys(el)
        for p in ps:
            campus_polys.append((p, t.get('name', ''), t.get('amenity')))
    if not kind:
        continue
    ps = way_poly(el) if typ == 'w' else rel_polys(el)
    lu[kind] += ps
OVER = {}
used = Polygon()
for kind in ('soil', 'grass', 'scrub', 'plaza'):
    if not lu[kind]:
        continue
    g = fix(unary_union(lu[kind])).intersection(GROUND).difference(used)
    g = fix(g)
    OVER[kind] = g
    used = fix(unary_union([used, g]))
GROUND_DEFAULT = fix(GROUND.difference(used))

# ---------------------------------------------------------------- road graph (AI + GPS)
graph_ways = [r for r in RD if r['access'] != 'no']        # navigation uses every drivable road
def MAJOR(e): return not e['r']['service'] and e['r']['access'] not in ('private',)
cnt = collections.Counter()
for r in graph_ways:
    for n in r['nodes']:
        cnt[n] += 1
signal_nodes = [int(k) for k, v in NODES.items() if v[2].get('highway') == 'traffic_signals']
gnodes = {}   # osm node -> graph index
gnode_xy = []
def gid(n):
    if n not in gnodes:
        gnodes[n] = len(gnode_xy)
        gnode_xy.append(P[n])
    return gnodes[n]

raw_edges = []
for r in graph_ways:
    nds = r['nodes']
    cut = [0] + [i for i in range(1, len(nds) - 1) if cnt[nds[i]] > 1] + [len(nds) - 1]
    for a, b in zip(cut[:-1], cut[1:]):
        seg = nds[a:b + 1]
        pts = [P[n] for n in seg]
        if LineString(pts).length < 0.3:
            continue
        raw_edges.append(dict(a=seg[0], b=seg[-1], pts=pts, r=r))

# clip to the visible area; portals where roads leave it
edges = []
vis_inner = VIS.buffer(-2)
for e in raw_edges:
    ln = LineString(e['pts'])
    if vis_inner.contains(ln):
        edges.append(dict(a=gid(e['a']), b=gid(e['b']), pts=e['pts'], r=e['r']))
        continue
    inter = ln.intersection(vis_inner)
    for piece in as_lines(inter):
        if piece.length < 5:
            continue
        pc = list(piece.coords)
        def endpoint(pt, osm_end):
            if Point(pt).distance(Point(P[osm_end])) < 0.01:
                return gid(osm_end)
            gnode_xy.append(pt)
            return len(gnode_xy) - 1
        a = endpoint(pc[0], e['a'])
        b = endpoint(pc[-1], e['b'])
        edges.append(dict(a=a, b=b, pts=pc, r=e['r'], portal=True))

# connectivity: keep the largest weakly connected component
adj = collections.defaultdict(set)
for i, e in enumerate(edges):
    adj[e['a']].add(e['b']); adj[e['b']].add(e['a'])
seen, comps = set(), []
for n in list(adj):
    if n in seen:
        continue
    st, comp = [n], []
    seen.add(n)
    while st:
        u = st.pop(); comp.append(u)
        for v in adj[u]:
            if v not in seen:
                seen.add(v); st.append(v)
    comps.append(comp)
comps.sort(key=len, reverse=True)
for c in comps[:6]:
    xs = [gnode_xy[n][0] for n in c]; zs = [gnode_xy[n][1] for n in c]
    log('component', len(c), 'x', round(min(xs)), round(max(xs)), 'z', round(min(zs)), round(max(zs)))
big = set(comps[0])
edges = [e for e in edges if e['a'] in big]
used_nodes = sorted({e['a'] for e in edges} | {e['b'] for e in edges})
remap = {o: i for i, o in enumerate(used_nodes)}
node_xy = [gnode_xy[o] for o in used_nodes]
for e in edges:
    e['a'] = remap[e['a']]; e['b'] = remap[e['b']]
deg = collections.Counter()           # junction degree for markings/signals: public through-roads only
for e in edges:
    if MAJOR(e): deg[e['a']] += 1; deg[e['b']] += 1
log('graph nodes', len(node_xy), 'edges', len(edges), 'components', len(comps))

# junction radius: max half width of incident roads
jrad = collections.defaultdict(float)
for e in edges:
    for n in (e['a'], e['b']):
        jrad[n] = max(jrad[n], e['r']['w'] / 2 + 1.5)

# signals -> nearest junction (deg >= 3)
jtree_idx = [i for i in range(len(node_xy)) if deg[i] >= 3]
jtree = STRtree([Point(node_xy[i]) for i in jtree_idx])
signal_j = set()
for s in signal_nodes:
    if s not in P:
        continue
    p = Point(P[s])
    if not VIS.contains(p):
        continue
    qi = jtree.nearest(p)
    j = jtree_idx[qi]
    if Point(node_xy[j]).distance(p) < 40:
        signal_j.add(j)
# merge signal junctions closer than 25 m (big chowks are several OSM nodes)
log('signalised junctions', len(signal_j))

portal_nodes = set()
barricade_nodes = set()
for e in edges:
    for n in (e['a'], e['b']):
        x, z = node_xy[n]
        if not VIS.buffer(-6).contains(Point(x, z)):
            if TILE:
                if OUTL.exterior.distance(Point(x, z)) < 8: barricade_nodes.add(n)
            else:
                portal_nodes.add(n)

# ---------------------------------------------------------------- markings
marks_center, marks_lane, zebras, stoplines, bumps = [], [], [], [], []
def junction_cut(n):
    return Point(node_xy[n]).buffer(jrad[n] + 2.5)

for e in edges:
    if not MAJOR(e): continue
    r = e['r']
    ln = LineString(e['pts'])
    cut = Polygon()
    pieces = []
    for n in (e['a'], e['b']):
        if deg[n] >= 3 or n in signal_j:
            pieces.append(junction_cut(n))
    if pieces:
        cut = unary_union(pieces)
    if not r['ow'] and r['w'] >= 7.5 and r['rank'] >= 2:
        g = ln.difference(cut) if not cut.is_empty else ln
        for s in as_lines(g):
            if s.length > 4:
                marks_center.append(line_out(s.coords))
    if r['ow'] and r['w'] >= 7.0:
        nl = max(2, int(round((r['w'] - 1.0) / 3.3)))
        for k in range(1, nl):
            off = -r['w'] / 2 + 0.5 + k * (r['w'] - 1.0) / nl
            try:
                ol = ln.offset_curve(off, quad_segs=2, join_style='round')
            except Exception:
                continue
            g = ol.difference(cut) if not cut.is_empty else ol
            for s in as_lines(g):
                if s.length > 4:
                    marks_lane.append(line_out(s.coords))

def tangent_at(ln, d):
    a = ln.interpolate(max(0, d - 1.0)); b = ln.interpolate(min(ln.length, d + 1.0))
    dx, dz = b.x - a.x, b.y - a.y
    L = math.hypot(dx, dz) or 1
    return dx / L, dz / L

# zebras + stop lines at signal approaches, speed bumps near minor junctions
for e in edges:
    if not MAJOR(e): continue
    r = e['r']
    ln = LineString(e['pts'])
    for end, n in ((0, e['a']), (1, e['b'])):
        if n in portal_nodes:
            continue
        dist = jrad[n] + 1.8
        if ln.length < dist + 6:
            continue
        d = dist if end == 0 else ln.length - dist
        p = ln.interpolate(d)
        tx, tz = tangent_at(ln, d)
        if n in signal_j:
            zebras.append([cm(p.x), cm(p.y), round(math.atan2(tz, tx), 3), cm(r['w']), 1])
            # stop line for traffic approaching n
            ds = (dist + 3.8) if end == 0 else ln.length - dist - 3.8
            if 0 < ds < ln.length:
                q = ln.interpolate(ds)
                approach_forward = (end == 1)
                if r['ow'] and not approach_forward:
                    continue
                stoplines.append([cm(q.x), cm(q.y), round(math.atan2(tz, tx), 3), cm(r['w']),
                                  0 if r['ow'] else (1 if approach_forward else -1)])
        elif deg[n] >= 3 and r['rank'] in (2, 3) and rng.random() < 0.13 and ln.length > dist + 14:
            db = (dist + 7) if end == 0 else ln.length - dist - 7
            q = ln.interpolate(db)
            bumps.append([cm(q.x), cm(q.y), round(math.atan2(tz, tx), 3), cm(r['w']), 1 if rng.random() < 0.5 else 0])

# OSM pedestrian crossings on the roads
road_tree_lines = [LineString(e['pts']) for e in edges]
rtree = STRtree(road_tree_lines)
zebra_pts = [(z[0] / 100, z[1] / 100) for z in zebras]
for k, v in NODES.items():
    if v[2].get('highway') != 'crossing':
        continue
    x, z = proj(v[0], v[1])
    p = Point(x, z)
    if not PLAY.buffer(MARGIN - 10).contains(p):
        continue
    if any(math.hypot(x - a, z - b) < 12 for a, b in zebra_pts):
        continue
    i = rtree.nearest(p)
    ln = road_tree_lines[i]
    if ln.distance(p) > 3:
        continue
    e = edges[i]
    if e['r']['rank'] < 2:
        continue
    d = ln.project(p)
    q = ln.interpolate(d)
    tx, tz = tangent_at(ln, d)
    zebras.append([cm(q.x), cm(q.y), round(math.atan2(tz, tx), 3), cm(e['r']['w']), 0])
    zebra_pts.append((q.x, q.y))
log('markings: center', len(marks_center), 'lane', len(marks_lane), 'zebras', len(zebras), 'bumps', len(bumps))

# ---------------------------------------------------------------- buildings
BLOCKERS = fix(unary_union([ROAD, MEDIANS]).buffer(0.1))      # carriageway only: sidewalks never cut a real building
log('blockers ready')
# the road union is one huge polygon: clip it (and the water) into 250 m cells once, so each
# building is cut only by the pieces around it (minutes faster per tile than cutting by the whole)
from shapely.prepared import prep as _prep
_CELL = 250.0
_vb = VIS.bounds
_X0, _Z0 = math.floor(_vb[0] / _CELL) * _CELL, math.floor(_vb[1] / _CELL) * _CELL
_n = 1
while _X0 + _n * _CELL < _vb[2] or _Z0 + _n * _CELL < _vb[3]: _n *= 2
def _clip(g, i0, j0, n, out):
    if g.is_empty: return
    if n == 1: out[(i0, j0)] = g; return
    h = n // 2
    for di, dj in ((0, 0), (h, 0), (0, h), (h, h)):
        b = box(_X0 + (i0 + di) * _CELL, _Z0 + (j0 + dj) * _CELL, _X0 + (i0 + di + h) * _CELL, _Z0 + (j0 + dj + h) * _CELL)
        _clip(g.intersection(b), i0 + di, j0 + dj, h, out)
_BL_CELLS, _WA_CELLS = {}, {}
_clip(BLOCKERS, 0, 0, _n, _BL_CELLS)
_clip(WATER, 0, 0, _n, _WA_CELLS)
_VIS_P = _prep(VIS)
def cut_local(p, roads=True):
    b = p.bounds
    i0, i1 = int((b[0] - _X0) // _CELL), int((b[2] - _X0) // _CELL)
    j0, j1 = int((b[1] - _Z0) // _CELL), int((b[3] - _Z0) // _CELL)
    q = p
    for i in range(i0, i1 + 1):
        for j in range(j0, j1 + 1):
            for cells in ((_BL_CELLS, _WA_CELLS) if roads else (_WA_CELLS,)):
                g = cells.get((i, j))
                if g is not None and q.intersects(g): q = q.difference(g)
    q = fix(q)
    return q if _VIS_P.contains(q) else q.intersection(VIS)
log('road cells', len(_BL_CELLS))
main_lines = [r['line'] for r in RD if r['rank'] >= 4]
main_tree = STRtree(main_lines)
anyroad_lines = [r['line'] for r in RD]
anyroad_tree = STRtree(anyroad_lines)
campus_tree = STRtree([c[0] for c in campus_polys]) if campus_polys else None

STYLE = {'apartment': 0, 'commercial': 1, 'old': 2, 'bungalow': 3, 'institution': 4,
         'heritage': 5, 'shed': 6, 'canopy': 7, 'temple': 8, 'glass': 9,
         'church': 10, 'fort': 11, 'station': 12, 'pyramid': 13, 'brick': 14}
# named landmarks -> (style, levels, roof). Matched by substring of the OSM name.
LANDMARK_STYLE = [
    ('Fergusson College', 'heritage', 3, 1), ('BMCC Main', 'heritage', 2, 1), ('College of Engineering', 'heritage', 3, 1),
    ('Deccan College', 'heritage', 2, 1), ('Council Hall', 'heritage', 2, 1), ('Sassoon', 'heritage', 3, 1),
    ('Lal Mahal', 'heritage', 2, 1), ('Ohel David', 'brick', 2, 1), ('Synagogue', 'brick', 2, 1),
    ("Church", 'church', 2, 1), ("St.Xavier", 'church', 2, 1), ("Saint Patrick", 'church', 2, 1),
    ('Shaniwar Wada', 'fort', 3, 0), ('Pune Railway Station', 'station', 2, 1), ('Pune Junction', 'station', 2, 1),
    ('Osho', 'pyramid', 4, 3), ('JW Marriott', 'glass', 22, 0), ('Kelkar Museum', 'heritage', 3, 1),
    ('Tilak Smarak', 'institution', 3, 0), ('Bal Gandharva', 'institution', 3, 0), ('Balgandharva', 'institution', 3, 0),
    ('Dagdusheth', 'temple', 2, 3), ('Tulshibaug', 'temple', 2, 3), ('Omkareshwar', 'temple', 2, 3),
    ('ISKCON', 'temple', 3, 3), ('Kasba Ganpati', 'temple', 1, 3), ('Gurudwara', 'temple', 2, 3), ('Masjid', 'temple', 2, 3),
]
buildings = []
btree_src = []
cut_stats = collections.Counter()
for p, t, oid in bpolys:
    if not p.intersects(VIS):
        continue
    if p.area < 10:
        continue
    q = cut_local(p)
    lost = 1 - q.area / max(p.area, 1e-6)
    if lost > 0.3 and t.get('building') == 'train_station' and not re.search(r'railway station|junction', t.get('name', ''), re.I):
        cut_stats['elevated station skipped'] += 1
        continue                      # metro stations stand over the road; the metro layer draws them
    if lost > 0.3 and p.area > 150:
        q = cut_local(p, roads=False)        # the footprint is real; the road overlap is a data artefact
        cut_stats['kept whole'] += 1
    parts = [x for x in as_polys(q) if x.area > 12]
    if not parts:
        continue
    btype = t.get('building', 'yes')
    for part in parts:
        part = part.simplify(0.06, preserve_topology=True)   # drop only collinear points
        if part.is_empty or part.area < 12:
            continue
        part = shapely.geometry.polygon.orient(part, 1.0)
        if len(part.interiors) > 0:
            part = Polygon(part.exterior)
        c = part.centroid
        area = part.area
        h_rng = random.Random(oid * 7 + int(area))
        dist = district_of(c.x, c.y)
        peth = dist == 1
        bname = t.get('name', '')
        dmain = main_lines[main_tree.nearest(c)].distance(c) if main_lines else 999
        campus = None
        if campus_tree is not None:
            for ci in campus_tree.query(c):
                if campus_polys[ci][0].contains(c):
                    campus = campus_polys[ci]
                    break
        levels = None
        if t.get('building:levels', '').replace('.', '').isdigit():
            levels = max(1, int(float(t['building:levels'])))
        elif t.get('height', '').replace('.', '').isdigit():
            levels = max(1, int(float(t['height']) / 3.2))
        style = 'apartment'
        roof = 0   # 0 flat, 1 tiled pitched, 2 canopy, 3 dome/shikhara
        lm = None
        if bname:
            for key, st, lv, rf in LANDMARK_STYLE:
                if key.lower() in bname.lower():
                    lm = (st, lv, rf); break
        if lm and area > 60:
            style, roof = lm[0], lm[2]
            levels = levels or lm[1]
        elif btype in ('roof', 'carport') or t.get('amenity') == 'fuel':
            style, levels, roof = 'canopy', 1, 2
        elif btype in ('temple',) or t.get('amenity') == 'place_of_worship':
            style, roof = 'temple', 3
            levels = levels or 1
        elif area < 30:
            style = 'shed'
            levels = levels or 1
            roof = 1 if h_rng.random() < 0.4 else 0
        elif campus and campus[2] in ('college', 'school', 'university'):
            if 'Fergusson' in campus[1] and area > 400:
                style = 'heritage'; levels = levels or h_rng.choice([2, 2, 3]); roof = 1
            else:
                style = 'institution'; levels = levels or h_rng.choice([2, 3, 3, 4, 5])
        elif btype in ('college', 'school', 'university', 'hospital', 'public', 'civic', 'government'):
            style = 'institution'; levels = levels or h_rng.choice([3, 4, 5])
        elif btype in ('commercial', 'retail', 'office', 'hotel'):
            style = 'glass' if (area > 700 and h_rng.random() < 0.6) else 'commercial'
            levels = levels or h_rng.choice([4, 5, 6, 7, 8])
        elif peth:
            style = 'old' if h_rng.random() < 0.65 else 'apartment'
            if dmain < 22:
                style = 'commercial' if h_rng.random() < 0.6 else style
                levels = levels or h_rng.choice([3, 4, 4, 5])
            else:
                levels = levels or h_rng.choice([2, 2, 3, 3, 3, 4])
            if style == 'old' and area < 180 and h_rng.random() < 0.45:
                roof = 1
        elif dist == 3:      # Koregaon Park: bungalows in gardens, low apartments, cafes on the main roads
            if dmain < 22 and area > 80:
                style = 'commercial' if h_rng.random() < 0.65 else 'apartment'
                levels = levels or h_rng.choice([2, 3, 3, 4])
            elif area < 520:
                style = 'bungalow' if h_rng.random() < 0.7 else 'apartment'
                levels = levels or (h_rng.choice([1, 2, 2]) if style == 'bungalow' else h_rng.choice([3, 4, 4]))
                roof = 1 if (style == 'bungalow' and h_rng.random() < 0.45) else 0
            else:
                levels = levels or h_rng.choice([4, 5, 6, 7])
        elif dist == 2:      # Camp: low colonial blocks with tiled roofs and verandas
            if dmain < 22 and area > 60:
                style = 'commercial' if h_rng.random() < 0.6 else 'old'
                levels = levels or h_rng.choice([2, 2, 3, 3, 4])
            else:
                style = 'old' if h_rng.random() < 0.55 else ('bungalow' if area < 400 else 'apartment')
                levels = levels or h_rng.choice([1, 2, 2, 3])
            if style in ('old', 'bungalow') and h_rng.random() < 0.55:
                roof = 1
        elif dist == 4 and dmain < 26 and area > 60:   # station / Shivajinagar: lodges, travel agents, offices
            style = 'commercial' if h_rng.random() < 0.75 else 'apartment'
            levels = levels or h_rng.choice([3, 4, 4, 5, 6])
        else:
            if dmain < 24 and area > 80:
                style = 'commercial' if h_rng.random() < 0.7 else 'apartment'
                levels = levels or h_rng.choice([3, 4, 5, 5, 6, 7])
            elif 70 < area < 420:
                # isolated small footprint: bungalow
                nb = [x for x in btree_src[-80:] if x.distance(part) < 5.0]
                if not nb and h_rng.random() < 0.55:
                    style = 'bungalow'; levels = levels or h_rng.choice([1, 2, 2]); roof = 1 if h_rng.random() < 0.3 else 0
                else:
                    levels = levels or h_rng.choice([3, 4, 4, 5])
            elif area >= 420:
                levels = levels or h_rng.choice([4, 5, 6, 7, 8, 10])
                if area > 1500 and h_rng.random() < 0.3:
                    style = 'glass'
            else:
                levels = levels or h_rng.choice([1, 2, 2, 3])
                if levels <= 2:
                    style = 'old' if h_rng.random() < 0.5 else 'bungalow'
        levels = int(min(levels, 14))
        # street-facing edges
        ext = list(part.exterior.coords)[:-1]
        flags = []
        for i in range(len(ext)):
            ax, az = ext[i]; bx, bz = ext[(i + 1) % len(ext)]
            ex, ez = bx - ax, bz - az
            L = math.hypot(ex, ez)
            if L < 0.5:
                flags.append('0'); continue
            # outward normal for CCW (x,z) ring: (ez, -ex)
            nx, nz = ez / L, -ex / L
            mx, mz = (ax + bx) / 2, (az + bz) / 2
            if part.contains(Point(mx + nx * 0.3, mz + nz * 0.3)):
                nx, nz = -nx, -nz
            f = '0'
            for dd in (2.0, 5.0, 9.0, 14.0):
                qp = Point(mx + nx * dd, mz + nz * dd)
                if ROAD.contains(qp) or SW.contains(qp):
                    ri = anyroad_tree.nearest(qp)
                    rk = CLASS_RANK.get(RD[ri]['cls'], 0) if ri is not None else 0
                    f = '2' if (rk >= 3 and L > 2.5) else '1'
                    break
            flags.append(f)
        tint = h_rng.randrange(0, 16)
        buildings.append(dict(p=part, levels=levels, style=STYLE[style], roof=roof, flags=''.join(flags),
                              tint=tint, oid=oid, peth=peth, dist=dist, name=bname if (lm or len(bname) < 40) else ''))
        btree_src.append(part)
log('buildings', len(buildings), collections.Counter(b['style'] for b in buildings), dict(cut_stats))

ALL_BLD = unary_union([b['p'] for b in buildings])
bld_tree = STRtree([b['p'] for b in buildings])
def near_building(x, z, r):
    q = Point(x, z).buffer(r)
    for i in bld_tree.query(q):
        if buildings[i]['p'].intersects(q):
            return True
    return False

def free_spot(x, z, r=1.0):
    p = Point(x, z)
    if not VIS.contains(p):
        return False
    q = p.buffer(r)
    if ROAD.intersects(q) or WATER.intersects(q):
        return False
    for i in bld_tree.query(q):
        if buildings[i]['p'].intersects(q):
            return False
    return True

# ---------------------------------------------------------------- trees
TREE_TYPES = {'rain': 0, 'gulmohar': 1, 'peepal': 2, 'neem': 3, 'ashoka': 4, 'coconut': 5, 'banyan': 6, 'mango': 7}
trees = []
tree_pts = []
def add_tree(x, z, kind, s=1.0):
    for (a, b) in tree_pts[-400:]:
        if (a - x) ** 2 + (b - z) ** 2 < 16:
            return False
    trees.append([cm(x), cm(z), TREE_TYPES[kind], round(s, 2)])
    tree_pts.append((x, z))
    return True

for k, v in NODES.items():
    if v[2].get('natural') == 'tree':
        x, z = proj(v[0], v[1])
        if free_spot(x, z, 0.8):
            add_tree(x, z, rng.choice(['rain', 'rain', 'gulmohar', 'peepal', 'neem', 'mango', 'banyan']), rng.uniform(0.85, 1.25))

TREE_ROADS = {'Prabhat Path': 0.85, 'Bhandarkar Path': 0.85, 'Gopal Krushna Gokhale Path': 0.6,
              'Karve Road': 0.45, 'Jangli Maharaj Path': 0.55, 'Ganeshkhind Road': 0.6, 'Apte Path': 0.6,
              'Ghole Road': 0.5, 'North Main Road': 0.95, 'South Main Road': 0.85, 'Boat Club Road': 0.95,
              'Bund Garden Road': 0.7, 'Koregaon Road': 0.75, 'Dhole Patil Road': 0.6, 'Sadhu Vaswani Path': 0.6,
              'Mahatma Gandhi Marg': 0.3, 'Senapati Bapat Marg': 0.6, 'Moledina Road': 0.5, 'Sassoon Marg': 0.65}
DIST_TREE = [1.0, 0.35, 0.9, 1.6, 0.7, 1.15, 1.2]     # by district: KP lanes are a canopy, peths are bare
for r in RD:
    if r['cls'] == 'service':
        continue
    dens = TREE_ROADS.get(r['name'], 0.45 if r['rank'] >= 3 else 0.32)
    ln = r['line']
    if r['name'] not in TREE_ROADS:
        dens = min(0.95, dens * DIST_TREE[district_of(ln.centroid.x, ln.centroid.y)])
    d = rng.uniform(3, 10)
    while d < ln.length - 3:
        p = ln.interpolate(d)
        tx, tz = tangent_at(ln, d)
        for side in (1, -1):
            if rng.random() > dens:
                continue
            off = r['w'] / 2 + (r['sw'] * 0.75 if r['sw'] > 0 else 1.6)
            x = p.x + tz * off * side
            z = p.y - tx * off * side
            if free_spot(x, z, 0.9):
                kind = rng.choices(['rain', 'gulmohar', 'peepal', 'neem', 'ashoka', 'mango'], [5, 3, 1.5, 2.5, 1.5, 1])[0]
                add_tree(x, z, kind, rng.uniform(0.8, 1.2))
        d += rng.uniform(9, 16)

COMPOUND_TREE = [1.0, 0.3, 0.8, 1.9, 0.55, 1.15, 1.3]   # by district, for open ground inside plots
def scatter(poly, spacing, kinds, weights, scale=(0.85, 1.25), by_district=None):
    if poly.is_empty:
        return
    for part in as_polys(poly):
        if part.area < 20:
            continue
        shapely.prepare(part)
        minx, minz, maxx, maxz = part.bounds
        dens = 1.0
        if by_district:
            c = part.representative_point()
            dens = by_district[district_of(c.x, c.y)]
        n = part.area / (spacing * spacing) * dens
        tries = int(n * 2) + (1 if rng.random() < (n * 2) % 1 else 0)
        for _ in range(min(tries, 6000)):
            x = rng.uniform(minx, maxx); z = rng.uniform(minz, maxz)
            if not part.contains(Point(x, z)):
                continue
            if free_spot(x, z, 1.5):
                add_tree(x, z, rng.choices(kinds, weights)[0], rng.uniform(*scale))

if 'grass' in OVER:
    scatter(OVER['grass'], 13, ['rain', 'banyan', 'peepal', 'gulmohar', 'neem', 'coconut', 'mango'], [4, 1.5, 1.5, 2, 2, 1, 2])
if 'scrub' in OVER:
    scatter(OVER['scrub'], 9, ['neem', 'rain', 'mango', 'peepal', 'banyan'], [3, 2, 2, 1, 1])
if 'soil' in OVER:
    edge = OVER['soil'].boundary.buffer(4).intersection(OVER['soil'].buffer(2))
    scatter(fix(edge), 10, ['rain', 'gulmohar', 'ashoka'], [3, 2, 2])
# compounds: open ground between bungalows / institutions
open_ground = fix(GROUND_DEFAULT.difference(ALL_BLD.buffer(2.5)))
log('open ground ready')
scatter(open_ground, 13, ['mango', 'coconut', 'ashoka', 'neem', 'rain', 'gulmohar', 'peepal'], [3, 2.5, 2.5, 2, 2.5, 1.5, 0.6], by_district=COMPOUND_TREE)
log('trees', len(trees))

# ---------------------------------------------------------------- compound walls
walls = []
MAIN_NEAR = fix(MAIN_ROAD.buffer(1.5)); shapely.prepare(MAIN_NEAR)
blocks = as_polys(GROUND)
for blk in blocks:
    if blk.area < 150:
        continue
    if blk.area / max(blk.length, 1) < 3.5:      # thin medians / leftovers
        continue
    c = blk.representative_point()
    if peth_side(c.x, c.y) and rng.random() < 0.6:
        continue
    inset = fix(blk.buffer(-0.35, join_style='mitre'))
    for pg in as_polys(inset):
        ring = shapely.segmentize(LineString(pg.exterior.coords), 3.0)
        cs = list(ring.coords)
        ok = []
        for i in range(len(cs) - 1):
            (ax, az), (bx, bz) = cs[i], cs[i + 1]
            L = math.hypot(bx - ax, bz - az)
            if L < 1e-3:
                ok.append(False); continue
            mx, mz = (ax + bx) / 2, (az + bz) / 2
            nx, nz = (bz - az) / L, -(bx - ax) / L
            if pg.contains(Point(mx + nx * 0.2, mz + nz * 0.2)):
                nx, nz = -nx, -nz          # make it point outward
            out1 = Point(mx + nx * 2.0, mz + nz * 2.0)
            out2 = Point(mx + nx * 5.0, mz + nz * 5.0)
            good = (ROAD.contains(out1) or SW.contains(out1) or ROAD.contains(out2))
            good = good and not MAIN_NEAR.contains(out1) and not MAIN_NEAR.contains(out2)
            good = good and not near_building(mx, mz, 1.2)
            ok.append(good)
        # runs of consecutive ok pieces -> walls with gates
        run = []
        def flush(run):
            if len(run) < 2:
                return
            ln = LineString(run)
            L = ln.length
            d = 0.0
            while d < L:
                e2 = min(L, d + rng.uniform(10, 26))
                if e2 - d > 3:
                    walls.append(line_out(substring(ln, d, e2).coords))
                d = e2 + 3.4
        for i, good in enumerate(ok):
            if good:
                if not run:
                    run = [cs[i]]
                run.append(cs[i + 1])
            else:
                flush(run); run = []
        flush(run)
log('compound wall runs', len(walls))

# ---------------------------------------------------------------- street furniture
lamps, poles, buses, stalls, parked, hoardings, signals_out = [], [], [], [], [], [], []
def on_sidewalk_or_ground(x, z, r=0.4):
    p = Point(x, z)
    if not VIS.contains(p):
        return False
    q = p.buffer(r)
    if ROAD.intersects(q) or WATER.intersects(q):
        return False
    for i in bld_tree.query(q):
        if buildings[i]['p'].intersects(q):
            return False
    return True

junction_pts = [node_xy[n] for n in range(len(node_xy)) if deg[n] >= 3]
jp_tree = STRtree([Point(p) for p in junction_pts]) if junction_pts else None
def near_junction(x, z, d):
    if jp_tree is None:
        return False
    i = jp_tree.nearest(Point(x, z))
    a, b = junction_pts[i]
    return math.hypot(a - x, b - z) < d

for r in RD:
    if r['rank'] < 2 or r['service']:
        continue
    ln = r['line']
    main = r['rank'] >= 3
    step = 32 if main else 36
    d = rng.uniform(4, 14)
    side_toggle = 1
    while d < ln.length - 2:
        p = ln.interpolate(d)
        tx, tz = tangent_at(ln, d)
        if main:
            sides = (1,) if r['ow'] and r['w'] < 9 else (1, -1)
            for side in sides:
                off = r['w'] / 2 + 0.55
                x, z = p.x + tz * off * side, p.y - tx * off * side
                if on_sidewalk_or_ground(x, z, 0.25) and not near_junction(x, z, 6):
                    lamps.append([cm(x), cm(z), round(math.atan2(tx * side, -tz * side), 3)])  # arm direction (toward road centre)
        else:
            side = side_toggle
            off = r['w'] / 2 + 0.45
            x, z = p.x + tz * off * side, p.y - tx * off * side
            if on_sidewalk_or_ground(x, z, 0.25):
                poles.append([cm(x), cm(z), r['oid'] % 100000, int(d)])
            side_toggle = -side_toggle if rng.random() < 0.25 else side_toggle
        d += step + rng.uniform(-4, 4)
log('lamps', len(lamps), 'poles', len(poles))

# signal heads: one pole per approach at the kerb on the left, facing traffic
for e in edges:
    if not MAJOR(e): continue
    ln = LineString(e['pts'])
    r = e['r']
    for end, n in ((0, e['a']), (1, e['b'])):
        if n not in signal_j:
            continue
        approach_forward = (end == 1)   # vehicles moving a->b arrive at b
        if r['ow'] and not approach_forward:
            continue
        dist = jrad[n] + 0.8
        if ln.length < dist + 2:
            continue
        d = dist if end == 0 else ln.length - dist
        p = ln.interpolate(d)
        tx, tz = tangent_at(ln, d)
        dirx, dirz = (tx, tz) if approach_forward else (-tx, -tz)
        # left of travel direction = (dirz, -dirx)
        off = r['w'] / 2 + 0.6
        x, z = p.x + dirz * off, p.y - dirx * off
        signals_out.append([cm(x), cm(z), round(math.atan2(-dirz, -dirx), 3), n, edges.index(e) if False else 0, cm(r['w'])])

# bus stops: snap to kerb, sheltered on the sidewalk
for k, v in NODES.items():
    if v[2].get('highway') != 'bus_stop':
        continue
    x, z = proj(v[0], v[1])
    p = Point(x, z)
    if not VIS.buffer(-20).contains(p):
        continue
    i = rtree.nearest(p)
    ln = road_tree_lines[i]
    e = edges[i]
    d = ln.project(p)
    q = ln.interpolate(d)
    tx, tz = tangent_at(ln, d)
    side = 1 if (tz * (x - q.x) - tx * (z - q.y)) > 0 else -1
    off = e['r']['w'] / 2 + max(1.2, e['r']['sw'] * 0.6)
    sx, sz = q.x + tz * off * side, q.y - tx * off * side
    nm = v[2].get('name', '')
    buses.append([cm(sx), cm(sz), round(math.atan2(tx * side, -tz * side), 3), nm, v[2].get('name:mr', '')])  # facing the road
log('bus stops', len(buses))

# stalls (tea, paan, vada pav, fruit carts) near junctions & colleges, on sidewalks
STALL = {'tea': 0, 'paan': 1, 'vadapav': 2, 'fruit': 3, 'flower': 4, 'juice': 5}
sw_polys = as_polys(SW)
sw_tree = STRtree(sw_polys) if sw_polys else None
for n in range(len(node_xy)):
    if deg[n] < 3 or n in portal_nodes:
        continue
    x0, z0 = node_xy[n]
    k = 2 if n in signal_j else (1 if rng.random() < 0.35 else 0)
    for _ in range(k):
        for attempt in range(12):
            a = rng.uniform(0, math.tau); rr = jrad[n] + rng.uniform(3, 12)
            x, z = x0 + math.cos(a) * rr, z0 + math.sin(a) * rr
            if on_sidewalk_or_ground(x, z, 1.1):
                # face the nearest road
                p = Point(x, z)
                i = rtree.nearest(p); ln = road_tree_lines[i]
                q = ln.interpolate(ln.project(p))
                ang = math.atan2(q.y - z, q.x - x)
                stalls.append([cm(x), cm(z), round(ang, 3), rng.choices(list(STALL.values()), [5, 3, 3, 3, 1, 1])[0]])
                break
log('stalls', len(stalls))

# parked two-wheelers and cars along kerbs. FC Road / JM Road style streets are lined with
# scooters on both sides; quieter streets get the odd row. Rows skip trees, lamps, shelters, stalls.
PARK_DENSITY = {'FC Road': 1.0, 'JM Road': 1.0, 'Laxmi Road': 1.0, 'Tilak Road': 0.85, 'Apte Road': 0.8,
                'Shivaji Road': 0.8, 'Bhandarkar Road': 0.75, 'Karve Road': 0.6, 'Prabhat Road': 0.65,
                'Ghole Road': 0.6, 'Chhatrapati Sambhaji Road': 0.55, 'Narubhau Limaye Path': 0.6,
                'MG Road': 1.0, 'East Street': 1.0, 'North Main Road': 0.85, 'Bajirao Road': 0.85,
                'Kumthekar Road': 0.9, 'Chiplunkar Road': 0.7, 'NC Kelkar Road': 0.8, 'Moledina Road': 0.8,
                'Sadhu Vaswani Road': 0.7, 'Dhole Patil Road': 0.6, 'Koregaon Road': 0.6}
occ = collections.defaultdict(list)          # 4 m grid of props a parked vehicle must not overlap
def occ_add(x, z, r):
    occ[(int(x // 4), int(z // 4))].append((x, z, r))
for t in tree_pts: occ_add(t[0], t[1], 0.7)
for l in lamps: occ_add(l[0] / 100, l[1] / 100, 0.35)
for l in poles: occ_add(l[0] / 100, l[1] / 100, 0.35)
for l in buses: occ_add(l[0] / 100, l[1] / 100, 2.6)
for l in stalls: occ_add(l[0] / 100, l[1] / 100, 1.4)
def occ_hit(x, z, r):
    i, j = int(x // 4), int(z // 4)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for (a, b, rr) in occ.get((i + di, j + dj), ()):
                if (a - x) ** 2 + (b - z) ** 2 < (r + rr) ** 2:
                    return True
    return False
def lerp(a, b, t):
    return a + (b - a) * t
wall_lines = [LineString([(w[i] / 100, w[i + 1] / 100) for i in range(0, len(w), 2)]) for w in walls if len(w) >= 4]
wall_tree = STRtree(wall_lines) if wall_lines else None
def near_wall(x, z, r):
    if wall_tree is None:
        return False
    q = Point(x, z)
    for i in wall_tree.query(q.buffer(r)):
        if wall_lines[i].distance(q) < r:
            return True
    return False
for e in edges:
    r = e['r']
    if r['rank'] > 5 or r['bridge'] or e.get('portal') or (r['rank'] < 2 and r['service']):
        continue
    ln = LineString(e['pts'])
    if ln.length < 20:
        continue
    disp = POPULAR.get(r['name'], (r['name'], ''))[0]
    dens = PARK_DENSITY.get(disp, 0.5 if r['rank'] >= 3 else 0.3)
    row_max = int(round(lerp(5, 11, dens)))
    for side in (1, -1):
        if dens < 0.7 and rng.random() < 0.5:
            continue
        d = rng.uniform(4, 16)
        while d < ln.length - 6:
            kind = rng.choices([0, 1, 2], [6, 3 if dens < 0.7 else 1, 2])[0]   # 0 scooter row, 1 car, 2 bike row
            if kind == 1 and r['w'] < 7.0:
                kind = 0          # cars only where traffic can still pass them on its own side
            n = 1 if kind == 1 else rng.randint(2 if dens >= 0.7 else 1, row_max)
            row_len = 4.4 if kind == 1 else n * 0.85
            mid = min(d + row_len / 2, ln.length - 6)
            p = ln.interpolate(mid)
            tx, tz = tangent_at(ln, mid)
            if kind == 1:
                off = r['w'] / 2 - 1.0                      # on the road at the kerb (traffic steers around)
            else:
                off = r['w'] / 2 + (0.6 if r['sw'] > 0.8 else 0.55)   # footpath edge / earth shoulder
            x, z = p.x + tz * off * side, p.y - tx * off * side
            ang = math.atan2(tz, tx) if rng.random() < 0.6 else math.atan2(-tz, -tx)
            ca, sa = math.cos(ang), math.sin(ang)
            ok = not near_junction(x, z, jrad[e['a']] + 6 + row_len / 2) and not near_building(x, z, 0.5)
            if ok and kind != 1 and r['sw'] <= 0.8 and not on_sidewalk_or_ground(x, z, 0.25):
                ok = False
            if ok:
                mask = 0
                for i in range(n):
                    o = (i - (n - 1) / 2) * (0.85 if kind != 1 else 0)
                    px, pz = x + ca * o, z + sa * o
                    if kind == 1 or (not occ_hit(px, pz, 0.5) and not near_building(px, pz, 0.35)
                                     and not near_wall(px, pz, 0.95) and rng.random() > 0.06):
                        mask |= 1 << i
                if mask:
                    parked.append([cm(x), cm(z), round(ang, 3), kind, n, side, mask])
            d += row_len + (rng.uniform(lerp(30, 3, dens), lerp(80, 16, dens)))
log('parked groups', len(parked))

# rooftop hoardings facing big junctions
for b in buildings:
    if b['style'] not in (STYLE['commercial'], STYLE['apartment'], STYLE['old'], STYLE['glass']):
        continue
    if b['levels'] < 3 or b['p'].area < 120:
        continue
    c = b['p'].centroid
    if not near_junction(c.x, c.y, 45):
        continue
    if rng.random() > 0.35:
        continue
    i = jp_tree.nearest(c)
    jx, jz = junction_pts[i]
    hoardings.append([len(hoardings), buildings.index(b) if False else 0, cm(c.x), cm(c.y), round(math.atan2(jz - c.y, jx - c.x), 3)])
    b['hoard'] = 1
log('hoardings', len(hoardings))

# ---------------------------------------------------------------- shops from OSM points of interest (parody names)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from names import parody
def shop_cat(t):
    a, sh = t.get('amenity'), t.get('shop')
    if a in ('restaurant', 'fast_food', 'food_court'): return 'food'
    if a == 'cafe': return 'cafe'
    if a in ('bar', 'pub', 'biergarten', 'nightclub'): return 'bar'
    if a == 'ice_cream': return 'icecream'
    if a == 'bank': return 'bank'
    if a == 'atm': return 'atm'
    if a == 'pharmacy' or sh == 'chemist': return 'pharmacy'
    if a in ('clinic', 'doctors', 'dentist'): return 'clinic'
    if t.get('tourism') in ('hotel', 'guest_house', 'hostel', 'motel'): return 'hotel'
    if not sh: return None
    if sh in ('clothes', 'fashion', 'boutique', 'tailor', 'fabric', 'bag'): return 'clothes'
    if sh == 'shoes': return 'shoes'
    if sh in ('jewelry', 'jewellery', 'watches'): return 'jewellery'
    if sh in ('mobile_phone', 'telecommunication'): return 'mobile'
    if sh in ('books', 'stationery', 'copyshop'): return 'books'
    if sh == 'bakery': return 'bakery'
    if sh in ('confectionery', 'pastry', 'sweets', 'chocolate'): return 'sweets'
    if sh in ('supermarket', 'convenience', 'greengrocer', 'general', 'dairy', 'butcher'): return 'grocery'
    if sh in ('hardware', 'doityourself', 'paint'): return 'hardware'
    if sh in ('hairdresser', 'beauty', 'cosmetics'): return 'salon'
    if sh == 'optician': return 'optician'
    if sh in ('electronics', 'computer', 'appliance'): return 'electronics'
    if sh == 'travel_agency': return 'travel'
    return 'generic'
shop_src = []
for k, v in NODES.items():
    t = v[2]
    if t.get('name') and shop_cat(t):
        x, z = proj(v[0], v[1]); shop_src.append((x, z, t))
for k, w in WAYS.items():
    t = w['tags']
    if t.get('name') and shop_cat(t) and 'highway' not in t:
        cs = way_coords(w)
        if len(cs) >= 3:
            c = LineString(cs).centroid; shop_src.append((c.x, c.y, t))
shops_out = []
used_slots = set()
for x, z, t in shop_src:
    p = Point(x, z)
    if not VIS.contains(p):
        continue
    bi = bld_tree.nearest(p)
    b = buildings[bi]
    if b['p'].distance(p) > 25:
        continue
    ext = list(b['p'].exterior.coords)[:-1]
    best = None
    for ei in range(len(ext)):
        if ei >= len(b['flags']) or b['flags'][ei] == '0':
            continue
        seg = LineString([ext[ei], ext[(ei + 1) % len(ext)]])
        if seg.length < 2.5:
            continue
        dd = seg.distance(p)
        if best is None or dd < best[0]:
            best = (dd, ei, seg)
    if not best:
        continue
    dd, ei, seg = best
    tpos = seg.project(p) / seg.length
    key = (bi, ei, round(tpos * 4))
    if key in used_slots:
        continue
    used_slots.add(key)
    cat = shop_cat(t)
    en, mr = parody(t['name'], cat)
    shops_out.append([bi, ei, round(tpos, 3), cat, en, mr])
log('osm shops placed', len(shops_out), 'of', len(shop_src))

# railway tracks (Pune Junction yard, suburban lines) and ground-level platforms
rail_out, platforms_out = [], []
for k, w in WAYS.items():
    t = w['tags']
    if t.get('railway') == 'rail' and t.get('bridge') not in ('yes', 'viaduct') and t.get('tunnel') != 'yes':
        cs = way_coords(w)
        if len(cs) >= 2:
            for s_ in as_lines(LineString(cs).intersection(VIS)):
                if s_.length > 3:
                    rail_out.append([1 if t.get('service') in ('yard', 'siding', 'spur') else 0, line_out(s_.coords)])
    elif t.get('railway') == 'platform' and t.get('layer', '0') in ('0', ''):
        for pg in way_poly(w):
            if pg.intersects(VIS):
                platforms_out.append(ring_out(pg.exterior.coords))
log('rail lines', len(rail_out), 'platforms', len(platforms_out))

# ---------------------------------------------------------------- POIs (ride destinations)
poi_src = []
def add_poi(name, mr, x, z, kind):
    poi_src.append((name, mr, x, z, kind))
KEEP_AMEN = {'college', 'school', 'university', 'hospital', 'cinema', 'theatre', 'library', 'police',
             'bus_station', 'place_of_worship', 'marketplace', 'arts_centre', 'post_office', 'townhall', 'courthouse'}
for k, v in NODES.items():
    t = v[2]
    nm = t.get('name')
    if not nm:
        continue
    x, z = proj(v[0], v[1])
    if not PLAY.buffer(-30).contains(Point(x, z)):
        continue
    if t.get('amenity') in KEEP_AMEN or t.get('tourism') in ('attraction', 'museum') or t.get('historic') or \
            t.get('railway') == 'station' or t.get('place') in ('neighbourhood', 'suburb', 'quarter') or \
            t.get('leisure') in ('park', 'stadium') or 'Chowk' in nm or 'chowk' in nm:
        add_poi(nm, t.get('name:mr', ''), x, z, t.get('amenity') or t.get('place') or t.get('leisure') or 'poi')
for k, w in WAYS.items():
    t = w['tags']
    nm = t.get('name')
    if not nm or 'highway' in t:
        continue
    if t.get('amenity') in KEEP_AMEN or t.get('leisure') in ('park', 'stadium', 'sports_centre', 'garden') or \
            t.get('tourism') or t.get('historic') or t.get('building') in ('train_station',) or \
            (t.get('railway') == 'station'):
        ps = way_poly(w)
        if not ps:
            continue
        c = ps[0].representative_point()
        if PLAY.buffer(-30).contains(c):
            add_poi(nm, t.get('name:mr', ''), c.x, c.y, t.get('amenity') or t.get('leisure') or 'poi')
# famous anchors that may not be tagged as nodes
pois = []
seen_names = set()
for name, mr, x, z, kind in poi_src:
    key = name.lower().strip()
    if key in seen_names:
        continue
    p = Point(x, z)
    i = rtree.nearest(p)
    e = edges[i]
    if e.get('portal') or e['r']['rank'] < 2:
        # try a better road within 120 m
        cand = rtree.query(p.buffer(120))
        best = None
        for ci in cand:
            ee = edges[ci]
            if ee.get('portal') or ee['r']['rank'] < 2:
                continue
            dd = road_tree_lines[ci].distance(p)
            if best is None or dd < best[0]:
                best = (dd, ci)
        if best is None:
            continue
        i = best[1]; e = edges[i]
    ln = road_tree_lines[i]
    if ln.distance(p) > 140:
        continue
    seen_names.add(key)
    dpar = ln.project(p) / max(ln.length, 1e-6)
    pois.append([name, mr, cm(x), cm(z), kind, i, round(dpar, 4)])
log('pois', len(pois))

# ---------------------------------------------------------------- chunking + output
if TILE:
    G0X, G0Z = GX0, GZ0
    NCX, NCZ = GNCX, GNCZ
    CI = (int(round((TX0 - GX0) / CHUNK)), int(round((TX1 - GX0) / CHUNK)))
    CJ = (int(round((TZ0 - GZ0) / CHUNK)), int(round((TZ1 - GZ0) / CHUNK)))
else:
    G0X, G0Z = VB[0], VB[1]
    NCX = int(math.ceil((VB[2] - VB[0]) / CHUNK)); NCZ = int(math.ceil((VB[3] - VB[1]) / CHUNK))
    CI, CJ = (0, NCX), (0, NCZ)
def chunk_index(x, z):
    i = int((x - G0X) // CHUNK); j = int((z - G0Z) // CHUNK)
    return i, j
def in_core(i, j): return CI[0] <= i < CI[1] and CJ[0] <= j < CJ[1]

def chunked_polys(g, min_area=0.5):
    out = []
    g = fix(g)
    for i in range(*CI):
        for j in range(*CJ):
            cb = box(G0X + i * CHUNK, G0Z + j * CHUNK, G0X + (i + 1) * CHUNK, G0Z + (j + 1) * CHUNK)
            if not g.intersects(cb):
                continue
            part = fix(shapely.clip_by_rect(g, *cb.bounds))
            for p in as_polys(part):
                if p.area < min_area:
                    continue
                p = p.simplify(0.05, preserve_topology=True)
                if p.is_empty:
                    continue
                for pp in as_polys(p):
                    out.append([i + j * NCX, poly_out(pp)])
    return out

def chunked_lines(g, min_len=0.3):
    out = []
    for i in range(*CI):
        for j in range(*CJ):
            cb = box(G0X + i * CHUNK, G0Z + j * CHUNK, G0X + (i + 1) * CHUNK, G0Z + (j + 1) * CHUNK)
            if not g.intersects(cb):
                continue
            for s in as_lines(shapely.clip_by_rect(g, *cb.bounds)):
                if s.length >= min_len:
                    out.append([i + j * NCX, line_out(s.coords)])
    return out

ROAD_LANE = fix(ROAD.difference(MAIN_ROAD))
ground_layers = []
ground_layers.append(('asphalt', chunked_polys(fix(MAIN_ROAD.difference(RIVER)))))
ground_layers.append(('concrete', chunked_polys(fix(ROAD_LANE.difference(RIVER)))))
ground_layers.append(('pavers', chunked_polys(fix(SW.difference(RIVER)))))
ground_layers.append(('compound', chunked_polys(GROUND_DEFAULT)))
for kind, g in OVER.items():
    ground_layers.append((kind, chunked_polys(g)))
ground_layers.append(('median', chunked_polys(MEDIANS) if not MEDIANS.is_empty else []))
bridge_road = fix(ROAD.intersection(RIVER))
bridge_sw = fix(SW.intersection(RIVER))
ground_layers.append(('bridge_road', chunked_polys(bridge_road)))
ground_layers.append(('bridge_sw', chunked_polys(bridge_sw)))

# kerb lines: road boundary that is not over water and not on the outer edge
kerb_src = fix(unary_union([ROAD, MEDIANS])).boundary
kerb_src = kerb_src.difference(RIVER.buffer(0.3)).difference(VIS.exterior.buffer(0.5))
ROAD_M = fix(unary_union([ROAD, MEDIANS])); shapely.prepare(ROAD_M)
def orient_left(lines, region, inside_is_left=True, probe=0.35):
    out = []
    for ci, pts in lines:
        xs = [p / 100 for p in pts]
        coords = list(zip(xs[0::2], xs[1::2]))
        if len(coords) < 2:
            continue
        votes = 0
        for k in range(len(coords) - 1):
            (ax, az), (bx, bz) = coords[k], coords[k + 1]
            L = math.hypot(bx - ax, bz - az)
            if L < 0.05:
                continue
            lx, lz = (bz - az) / L, -(bx - ax) / L
            mx, mz = (ax + bx) / 2, (az + bz) / 2
            inl = region.contains(Point(mx + lx * probe, mz + lz * probe))
            inr = region.contains(Point(mx - lx * probe, mz - lz * probe))
            if inl and not inr: votes += 1
            elif inr and not inl: votes -= 1
            if abs(votes) >= 3:
                break
        if (votes < 0) == inside_is_left:
            coords = coords[::-1]
        out.append([ci, line_out(coords)])
    return out
# medians are raised islands: for them the road is OUTSIDE, so orient by the road region
kerbs = orient_left(chunked_lines(kerb_src, 0.2), ROAD)
# bridge edges (deck sides + railings): deck on the left
deck = fix(unary_union([ROAD, SW]).intersection(RIVER)); shapely.prepare(deck)
rail_src = deck.boundary.intersection(RIVER.buffer(-0.4))
rails = orient_left(chunked_lines(rail_src, 0.5), deck)
# river banks: water boundary not under bridges, oriented so water is on the LEFT
bank_src = RIVER.boundary.difference(unary_union([ROAD, SW]).buffer(0.2)).intersection(VIS.buffer(-0.5))
banks = []
for ci, pts in chunked_lines(bank_src, 0.5):
    xs = [p / 100 for p in pts]
    coords = list(zip(xs[0::2], xs[1::2]))
    if len(coords) < 2:
        continue
    (ax, az), (bx, bz) = coords[0], coords[1]
    L = math.hypot(bx - ax, bz - az) or 1
    lx, lz = (bz - az) / L, -(bx - ax) / L   # left normal
    test = Point((ax + bx) / 2 + lx * 1.0, (az + bz) / 2 + lz * 1.0)
    if not RIVER.contains(test):
        coords = coords[::-1]
    banks.append([ci, line_out(coords)])
lake_banks = chunked_lines(LAKES.boundary, 0.5) if not LAKES.is_empty else []
water_out = chunked_polys(RIVER) + chunked_polys(LAKES) if not LAKES.is_empty else chunked_polys(RIVER)

bout = []
bmap = {}
for bi0, b in enumerate(buildings):
    c = b['p'].representative_point()
    i, j = chunk_index(c.x, c.y)
    if not in_core(i, j):
        continue
    bmap[bi0] = len(bout)
    bout.append([i + j * NCX, ring_out(b['p'].exterior.coords), b['levels'], b['style'], b['roof'],
                 b['flags'], b['tint'], b.get('hoard', 0), 1 if b['peth'] else 0, b['dist'], b['name']])

graph_nodes = []
for n, (x, z) in enumerate(node_xy):
    f = 0
    if n in signal_j: f |= 1
    if n in portal_nodes: f |= 2
    if n in barricade_nodes: f |= 4
    graph_nodes.append([cm(x), cm(z), f, cm(jrad[n])])
graph_edges = []
def _edge_in_core(e):
    if not TILE: return True
    ln = LineString(e['pts']); m = ln.interpolate(0.5, normalized=True)
    return CORE.contains(m)
for e in edges:
    if not _edge_in_core(e): continue
    r = e['r']
    graph_edges.append([e['a'], e['b'], cm(r['w']), r['rank'], 1 if r['ow'] else 0, r['nid'], cm(r['sw']),
                        line_out(e['pts']), 1 if r['bridge'] else 0, 1 if r['access'] in ('private',) else 0])

metro_out = []
for g, constr, name in metro_lines:
    for s in as_lines(g):
        if s.length > 10:
            metro_out.append([1 if constr else 0, line_out(s.simplify(0.5).coords)])
# metro stations (platform polygons / station ways on the viaduct)
mstations = []
for k, w in WAYS.items():
    t = w['tags']
    if t.get('railway') in ('platform', 'station') and t.get('layer', '0') in ('1', '2', '3'):
        cs = way_coords(w)
        if len(cs) >= 2:
            ln = LineString(cs)
            if VIS.contains(ln.centroid):
                mstations.append([t.get('name', ''), line_out(ln.coords)])

if TILE:
    # point features: only the ones standing in this tile
    def _core_pts(L, ix=0, iz=1):
        return [q for q in L if CORE.contains(Point(q[ix] / 100, q[iz] / 100))]
    trees = _core_pts(trees); lamps = _core_pts(lamps); poles = _core_pts(poles); signals_out = _core_pts(signals_out)
    buses = _core_pts(buses); stalls = _core_pts(stalls); hoardings = _core_pts(hoardings, 2, 3); pois = [q for q in pois if CORE.contains(Point(q[2] / 100, q[3] / 100))] if pois and len(pois[0]) > 3 and isinstance(pois[0][2], (int, float)) else pois
    marks_center = [l for l in marks_center if CORE.contains(Point(l[0] / 100, l[1] / 100))]
    marks_lane = [l for l in marks_lane if CORE.contains(Point(l[0] / 100, l[1] / 100))]
    zebras = _core_pts(zebras); stoplines = _core_pts(stoplines); bumps = _core_pts(bumps)
    walls = [w for w in walls if CORE.contains(Point(w[0] / 100, w[1] / 100))]
    parked = [q for q in parked if CORE.contains(Point(q[0] / 100, q[1] / 100))] if parked and isinstance(parked[0][0], (int, float)) else parked
    metro_out = [m for m in metro_out if CORE.contains(Point(m[1][0] / 100, m[1][1] / 100))]
    mstations = [m for m in mstations if CORE.contains(Point(m[1][0] / 100, m[1][1] / 100))]
    shops_out = [[bmap[q[0]]] + list(q[1:]) for q in shops_out if q[0] in bmap]
    rail_out = [r for r in rail_out if CORE.contains(Point(r[1][0] / 100, r[1][1] / 100))]
    platforms_out = [r for r in platforms_out if r and CORE.contains(Point(r[0] / 100, r[1] / 100))]
out = dict(
    meta=dict(lat0=LAT0, lon0=LON0, mlat=MLAT, mlon=MLON, play=[cm(PX0), cm(PZ0), cm(PX1), cm(PZ1)],
              vis=[cm(G0X), cm(G0Z), cm(G0X + NCX * CHUNK), cm(G0Z + NCZ * CHUNK)] if TILE else [cm(VB[0]), cm(VB[1]), cm(VB[2]), cm(VB[3])],
              chunk=CHUNK, ncx=NCX, ncz=NCZ, tile=[cm(TX0), cm(TZ0), cm(TX1), cm(TZ1)] if TILE else None,
              attribution='Map data (c) OpenStreetMap contributors, ODbL'),
    names=NAMES,
    ground=[[k, v] for k, v in ground_layers],
    water=water_out, banks=banks, lakebanks=lake_banks, kerbs=kerbs, rails=rails,
    buildings=bout,
    graph=dict(nodes=graph_nodes, edges=graph_edges),
    marks=dict(center=marks_center, lane=marks_lane, zebra=zebras, stop=stoplines, bump=bumps),
    trees=trees, walls=walls, lamps=lamps, poles=poles, signals=signals_out, buses=buses,
    stalls=stalls, parked=parked, hoardings=hoardings, pois=pois, metro=metro_out, mstations=mstations,
    shops=shops_out, railways=rail_out, platforms=platforms_out, districts=DISTRICT_NAMES,
)
s = json.dumps(out, separators=(',', ':'), ensure_ascii=False, default=lambda o: int(o) if float(o).is_integer() else float(o))
open(OUT, 'w').write(s)
log('wrote', OUT, len(s) // 1024, 'KB')

# debug snapshot for eyeballing
try:
    from PIL import Image, ImageDraw
    S = 0.5
    W_, H_ = int((VB[2] - VB[0]) * S), int((VB[3] - VB[1]) * S)
    im = Image.new('RGB', (W_, H_), (60, 60, 55)); dr = ImageDraw.Draw(im)
    def tp(x, z): return ((x - VB[0]) * S, (z - VB[1]) * S)
    def dpoly(g, col):
        for p in as_polys(g):
            dr.polygon([tp(*c) for c in p.exterior.coords], fill=col)
            for h in p.interiors:
                dr.polygon([tp(*c) for c in h.coords], fill=(60, 60, 55))
    dpoly(GROUND_DEFAULT, (150, 140, 120))
    for kind, col in (('grass', (110, 160, 80)), ('soil', (170, 110, 70)), ('scrub', (130, 140, 90)), ('plaza', (160, 160, 160))):
        if kind in OVER: dpoly(OVER[kind], col)
    dpoly(SW, (200, 190, 175))
    dpoly(ROAD, (70, 70, 75))
    dpoly(WATER, (70, 110, 140))
    dpoly(bridge_road, (90, 90, 95))
    if not MEDIANS.is_empty: dpoly(MEDIANS, (230, 200, 40))
    for b in buildings:
        col = [(220, 210, 190), (210, 180, 170), (190, 150, 120), (230, 230, 200), (180, 180, 210), (160, 140, 120), (150, 150, 150), (120, 120, 120), (240, 140, 60), (150, 190, 220)][b['style']]
        dr.polygon([tp(*c) for c in b['p'].exterior.coords], fill=col, outline=(40, 40, 40))
    for t in trees:
        x, z = tp(t[0] / 100, t[1] / 100); dr.ellipse([x - 2, z - 2, x + 2, z + 2], fill=(30, 110, 30))
    for w in walls:
        pts = [tp(w[i] / 100, w[i + 1] / 100) for i in range(0, len(w), 2)]
        dr.line(pts, fill=(250, 250, 250), width=1)
    for e in graph_edges:
        pts = [tp(e[7][i] / 100, e[7][i + 1] / 100) for i in range(0, len(e[7]), 2)]
        dr.line(pts, fill=(255, 200, 0) if e[4] else (0, 220, 255), width=1)
    for n in graph_nodes:
        if n[2] & 1:
            x, z = tp(n[0] / 100, n[1] / 100); dr.ellipse([x - 4, z - 4, x + 4, z + 4], outline=(255, 0, 0), width=2)
        if n[2] & 2:
            x, z = tp(n[0] / 100, n[1] / 100); dr.rectangle([x - 3, z - 3, x + 3, z + 3], fill=(255, 0, 255))
    pr = [tp(PX0, PZ0), tp(PX1, PZ1)]
    dr.rectangle(pr, outline=(255, 255, 255), width=2)
    im.save(OUT.replace('.json', '_debug.png'))
    log('debug png ok', im.size)
except Exception as ex:
    log('debug png failed', ex)
