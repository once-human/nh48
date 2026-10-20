# Bake every shop front in the city from real Pune data.
#
#   python3 tools/bake_shops.py        (after tools/bake_map.py; rewrites data/map.json in place)
#
# Real places come from OpenStreetMap (data/raw/merged.json) and Overture Maps Places
# (data/raw/overture/places.parquet, `overturemaps download --type=place`). Each one is snapped
# to the street-facing wall of the building it sits in, onto one 3.6 m shop slot, and gets a
# parody name (chains) or a one-letter spelling change (local shops). Frontages no dataset knows
# about get an invented name whose trade follows what the real shops around it sell (sarees and
# saraf on Laxmi Road, cafes on FC Road), and a name is never repeated within ~90 m.
#
# Output in map.json:
#   shopNames: [[english, marathi, category, kind]]          kind: '' | 'brand' | 'trad'
#   shops:     [[building, edge, slot, nameIndex, source]]   source: 0 invented, 1 OSM, 2 Overture
#   buildings[..][5] (edge flags): '3' marks a shop frontage edge (decided here, not at runtime)
import json, math, os, sys, collections, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree
from shopnames import board_name, filler, DIST_W, TRAD, _h

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MAP = os.path.join(ROOT, 'data/map.json')
OSM = os.path.join(ROOT, 'data/raw/merged.json')
OVT = os.path.join(ROOT, 'data/raw/overture/places.parquet')
SHOP_CELL = 3.6                 # must match buildingsChunk.js / the facade shader
SNAP = 30.0                     # metres from a real place to the wall it is put on
SECOND = 60.0                   # second pass: unplaced real places into empty nearby slots
UNIQUE_R = 90.0                 # no repeated name within this radius
DEFAULT_SHOP_STYLES = {0, 1, 2, 9}           # apartment, commercial, old, glass
REAL_SHOP_STYLES = {0, 1, 2, 3, 9, 14}       # + bungalow and brick: converted bungalows do have shops
t0 = time.time()
def log(*a): print(f'[{time.time() - t0:6.1f}s]', *a, flush=True)

M = json.load(open(MAP))
meta = M['meta']
LAT0, LON0, MLAT, MLON = meta['lat0'], meta['lon0'], meta['mlat'], meta['mlon']
def proj(lat, lon): return ((lon - LON0) * MLON, -(lat - LAT0) * MLAT)

# ---------------------------------------------------------------- buildings and their street edges
B = M['buildings']
polys, edges = [], []          # edges[bi] = [(ax, az, bx, bz, L, flag)]
for bi, b in enumerate(B):
    r = b[1]
    pts = [(r[2 * i] / 100, r[2 * i + 1] / 100) for i in range(len(r) // 2)]
    polys.append(Polygon(pts) if len(pts) >= 3 else Point(pts[0]).buffer(0.1))
    fl = b[5]; es = []
    for i in range(len(pts)):
        (ax, az), (bx, bz) = pts[i], pts[(i + 1) % len(pts)]
        es.append((ax, az, bx, bz, math.hypot(bx - ax, bz - az), fl[i] if i < len(fl) else '0'))
    edges.append(es)
tree = STRtree(polys)
log('buildings', len(B))

def nslots(L): return max(1, int(math.floor(L / SHOP_CELL)))

def default_front(bi, i):
    b = B[bi]; sid, peth, dist = b[3], b[8], b[9]
    ax, az, bx, bz, L, fl = edges[bi][i]
    if sid not in DEFAULT_SHOP_STYLES or L <= 2.6: return False
    if fl == '2': return True
    if fl == '1': return sid == 1 or ((peth or dist in (2, 4)) and (_h('front', bi, i) % 100) < 50)
    return False

def real_ok(bi, i):
    ax, az, bx, bz, L, fl = edges[bi][i]
    return B[bi][3] in REAL_SHOP_STYLES and L > 2.6 and fl in '12'

# ---------------------------------------------------------------- real places
def osm_cat(t):
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

TAX = {'jewelry_store': 'jewellery', 'watch_store': 'jewellery', 'shoe_store': 'shoes', 'eyewear_store': 'optician',
       'sunglasses_store': 'optician', 'bakery': 'bakery', 'patisserie_cake_shop': 'bakery', 'cupcake_shop': 'bakery',
       'donut_shop': 'bakery', 'ice_cream_shop': 'icecream', 'frozen_yogurt_shop': 'icecream', 'dessert_shop': 'icecream',
       'juice_bar': 'icecream', 'candy_store': 'sweets', 'chocolatier': 'sweets', 'grocery_store': 'grocery',
       'convenience_store': 'grocery', 'produce_store': 'grocery', 'organic_grocery_store': 'grocery', 'butcher_shop': 'grocery',
       'indian_grocery_store': 'grocery', 'health_food_store': 'grocery', 'supermarket': 'grocery', 'liquor_store': 'bar',
       'mobile_phone_store': 'mobile', 'tea_room': 'cafe', 'bubble_tea': 'cafe'}
BASIC = {'restaurant': 'food', 'casual_eatery': 'food', 'fast_food_restaurant': 'food', 'cafe': 'cafe', 'coffee_shop': 'cafe',
         'bar': 'bar', 'fashion_and_apparel_store': 'clothes', 'electronics_store': 'electronics',
         'hardware_home_and_garden_store': 'hardware', 'food_and_beverage_store': 'grocery', 'bank_or_credit_union': 'bank',
         'atm': 'atm', 'pharmacy_and_drug_store': 'pharmacy', 'dental_clinic': 'clinic', 'personal_or_beauty_service': 'salon',
         'personal_care_and_beauty_store': 'salon', 'printing_service': 'books', 'books_music_and_video_store': 'books',
         'travel_service': 'travel', 'hotel': 'hotel', 'lodging': 'hotel', 'flowers_and_gifts_store': 'generic',
         'sporting_goods_store': 'shoes', 'arts_crafts_and_hobby_store': 'generic', 'specialty_store': 'generic',
         'vehicle_parts_store': 'hardware', 'gym': 'generic', 'warehouse_club_store': 'grocery', 'vision_or_eye_care_clinic': 'optician',
         'diagnostics_imaging_or_lab_service': 'clinic', 'shopping': '?', 'grocery_store': 'grocery', 'convenience_store': 'grocery'}
KW = [('jewel|saraf|gold|diamond|bangle', 'jewellery'), ('medical|chemist|pharma|drug', 'pharmacy'),
      ('mobile|telecom|cellular|phone', 'mobile'), ('saree|sari|cloth|textile|fashion|boutique|dress|garment|tailor|wear|collection|paithani', 'clothes'),
      ('foot|shoe|chappal|sandal', 'shoes'), ('electric|electronic|appliance|radio|computer', 'electronics'),
      ('hardware|paint|plywood|glass|steel|sanitary|tiles|traders', 'hardware'), ('book|stationer|xerox|print', 'books'),
      ('sweet|mithai|farsan|chiwda', 'sweets'), ('bakery|cake|bakers', 'bakery'), ('optic|eye', 'optician'),
      ('kirana|provision|general store|super ?market|mart|dairy|fruit', 'grocery'), ('travel|tour', 'travel')]
import re
def kw_cat(name):
    low = name.lower()
    for pat, c in KW:
        if re.search(pat, low): return c
    return 'generic'

cands = []      # dict(x, z, en, mr, cat, brand, src, pri)
def add(x, z, raw, cat, src, conf):
    r = board_name(raw, cat)
    if not r: return
    en, mr, brand = r
    if cat == 'atm' and not brand: return
    cands.append(dict(x=x, z=z, en=en, mr=mr, cat=cat, brand=brand, src=src, pri=(2 if brand else 0) + (1 if src == 1 else 0) + conf))

D = json.load(open(OSM))
P = {int(k): proj(v[0], v[1]) for k, v in D['nodes'].items()}
for k, (lat, lon, t) in D['nodes'].items():
    c = osm_cat(t) if t.get('name') else None
    if c: x, z = proj(lat, lon); add(x, z, t['name'], c, 1, 1.0)
for k, w in D['ways'].items():
    t = w.get('tags', {})
    c = osm_cat(t) if t.get('name') and 'highway' not in t else None
    if not c: continue
    cs = [P[n] for n in w['nd'] if n in P]
    if len(cs) >= 3:
        x = sum(p[0] for p in cs) / len(cs); z = sum(p[1] for p in cs) / len(cs)
        add(x, z, t['name'], c, 1, 1.0)
n_osm = len(cands)
log('osm candidates', n_osm)

import duckdb
con = duckdb.connect(); con.sql('load spatial')
rows = con.sql(f"""select ST_X(geometry), ST_Y(geometry), names.primary, basic_category, taxonomy.primary, confidence
                   from '{OVT}' where confidence >= 0.45 and names.primary is not null""").fetchall()
for lon, lat, name, basic, tax, conf in rows:
    cat = TAX.get(tax) or BASIC.get(basic)
    if not cat: continue
    if cat == '?': cat = kw_cat(name)
    x, z = proj(lat, lon)
    add(x, z, name, cat, 2, conf)
log('overture candidates', len(cands) - n_osm, 'of', len(rows))

# dedupe: same board name within 45 m (OSM and Overture often list the same shop)
cands.sort(key=lambda c: -c['pri'])
grid = collections.defaultdict(list)
kept = []
for c in cands:
    key = c['en'].lower()
    gx, gz = int(c['x'] // 45), int(c['z'] // 45)
    dup = False
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            for o in grid[(gx + dx, gz + dz)]:
                if o['en'].lower() == key and math.hypot(o['x'] - c['x'], o['z'] - c['z']) < 45: dup = True; break
            if dup: break
        if dup: break
    if not dup:
        grid[(gx, gz)].append(c); kept.append(c)
cands = kept
log('unique real places', len(cands))

# ---------------------------------------------------------------- snapping onto shop slots
occupied = {}                  # (bi, ei, k) -> cand
front = set()                  # (bi, ei) shop frontage edges

def slot_point(bi, ei, k):
    ax, az, bx, bz, L, fl = edges[bi][ei]
    t = (k + 0.5) / nslots(L)
    return ax + (bx - ax) * t, az + (bz - az) * t

def try_place(c, radius, allowed):
    p = Point(c['x'], c['z'])
    near = [int(i) for i in tree.query(p.buffer(radius))]
    near.sort(key=lambda bi: polys[bi].distance(p))
    for bi in near[:4]:
        if polys[bi].distance(p) > radius: break
        opts = []
        for ei, (ax, az, bx, bz, L, fl) in enumerate(edges[bi]):
            if not allowed(bi, ei): continue
            ex, ez = bx - ax, bz - az
            t = max(0.0, min(1.0, ((c['x'] - ax) * ex + (c['z'] - az) * ez) / (L * L)))
            d = math.hypot(ax + ex * t - c['x'], az + ez * t - c['z'])
            opts.append((d, ei, t))
        opts.sort()
        for d, ei, t in opts:
            ns = nslots(edges[bi][ei][4])
            k0 = min(ns - 1, int(t * ns))
            for dk in sorted(range(-ns, ns + 1), key=abs):
                k = k0 + dk
                if 0 <= k < ns and (bi, ei, k) not in occupied:
                    occupied[(bi, ei, k)] = c; front.add((bi, ei)); c['placed'] = (bi, ei, k)
                    return True
    return False

for bi in range(len(B)):
    for ei in range(len(edges[bi])):
        if default_front(bi, ei): front.add((bi, ei))
n_default = len(front)
placed = sum(try_place(c, SNAP, real_ok) for c in cands)
log('placed (pass 1)', placed)
# pass 2: places a bit further from any wall go into empty slots of existing frontages nearby
placed2 = sum(try_place(c, SECOND, lambda bi, ei: (bi, ei) in front) for c in cands if 'placed' not in c)
log('placed (pass 2)', placed2, '| frontage edges', n_default, '->', len(front))

# ---------------------------------------------------------------- fill the rest
cat_grid = collections.defaultdict(collections.Counter)   # 120 m cells: what real shops sell around here
for c in cands:
    cat_grid[(int(c['x'] // 120), int(c['z'] // 120))][c['cat']] += 1
name_grid = collections.defaultdict(list)
def name_near(en, x, z):
    gx, gz = int(x // UNIQUE_R), int(z // UNIQUE_R)
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            for (n2, x2, z2) in name_grid[(gx + dx, gz + dz)]:
                if n2 == en and (x2 - x) ** 2 + (z2 - z) ** 2 < UNIQUE_R * UNIQUE_R: return True
    return False
def remember(en, x, z): name_grid[(int(x // UNIQUE_R), int(z // UNIQUE_R))].append((en, x, z))
for (bi, ei, k), c in occupied.items():
    x, z = slot_point(bi, ei, k); remember(c['en'], x, z)

LOC_DAMP = {'hotel': 0.45, 'clinic': 0.35, 'travel': 0.6, 'generic': 0.7}   # often upstairs / over-listed
NO_FILL = {'bank', 'atm'}      # banks only where real ones are
def pick_cat(x, z, dist, seed):
    w = collections.Counter()
    base = DIST_W[dist] if 0 <= dist < len(DIST_W) else DIST_W[5]
    tb = sum(base.values())
    for k, v in base.items(): w[k] += 0.35 * v / tb
    loc = collections.Counter()
    gx, gz = int(x // 120), int(z // 120)
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            loc.update(cat_grid[(gx + dx, gz + dz)])
    for k in NO_FILL: loc.pop(k, None)
    for k, f in LOC_DAMP.items():
        if k in loc: loc[k] *= f
    tl = sum(loc.values())
    if tl >= 4:
        for k, v in loc.items(): w[k] += 0.65 * v / tl
    else:
        for k, v in base.items(): w[k] += 0.65 * v / tb
    tot = sum(w.values()); r = (seed % 100000) / 100000 * tot
    for k, v in sorted(w.items()):
        r -= v
        if r <= 0: return k
    return 'generic'

fills = 0
for (bi, ei) in sorted(front):
    ns = nslots(edges[bi][ei][4])
    for k in range(ns):
        if (bi, ei, k) in occupied: continue
        x, z = slot_point(bi, ei, k)
        dist = B[bi][9]
        cat = pick_cat(x, z, dist, _h('cat', bi, ei, k))
        s0 = _h('name', bi, ei, k)
        for tr in range(24):
            en, mr = filler(cat, s0 + tr * 7919)
            if not name_near(en, x, z): break
        trad = cat in TRAD and (B[bi][8] or dist in (1, 5, 6)) and (_h('trad', bi, ei, k) % 100) < 55
        occupied[(bi, ei, k)] = dict(en=en, mr=mr, cat=cat, brand=False, src=0, trad=trad)
        remember(en, x, z); fills += 1
log('invented fillers', fills)

# ---------------------------------------------------------------- write
names, nidx, shops = [], {}, []
for (bi, ei, k), c in sorted(occupied.items()):
    kind = 'brand' if c.get('brand') else ('trad' if c.get('trad') or (c['src'] and c['cat'] in ('sweets', 'jewellery') and B[bi][8]) else '')
    key = (c['en'], c['mr'], c['cat'], kind)
    if key not in nidx: nidx[key] = len(names); names.append(list(key))
    shops.append([bi, ei, k, nidx[key], c['src']])
for bi, b in enumerate(B):
    fl = list(b[5])
    for ei in range(len(fl)):
        if (bi, ei) in front: fl[ei] = '3'
        elif fl[ei] == '3': fl[ei] = '1'
    b[5] = ''.join(fl)
M['shopNames'] = names
M['shops'] = shops
att = meta.get('attribution', '')
if 'Overture' not in att:
    meta['attribution'] = att + '; places (c) Overture Maps Foundation, CDLA-Permissive-2.0'
src = collections.Counter(s[4] for s in shops)
log('shops', len(shops), '| real OSM', src[1], '| real Overture', src[2], '| invented', src[0], '| unique names', len(names))
json.dump(M, open(MAP, 'w'), separators=(',', ':'), ensure_ascii=False)
log('wrote', MAP, os.path.getsize(MAP) // 1024, 'KB')
