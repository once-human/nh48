# Street life from the real places: how a Pune street is used, not just where it runs.
#   python3 tools/bake_street.py          (after bake_shops.py / bake_places.py; rewrites data/map.json)
#
# 1. Compound walls only where they belong. Bungalow and housing-society plots in Pune have a wall
#    and a gate; a street of shops, cafes and bars does not. It opens straight onto the footpath
#    (KP Lane 6, FC Road, the Mills, the peths). Any wall piece fronting a real business is removed.
# 2. Parking at the real kerb. Two-wheelers are parked nose-in along the outer kerb of a street.
#    A dual carriageway's median is never a parking place, and nor is the middle of the road, so
#    rows that sit there are dropped. Every real shop, cafe, bar and clinic front gets its row of
#    scooters at the kerb, and nightlife and busy restaurants get cars as well.
# 3. Activity: a 50 m grid that counts real places by what they draw people for (nightlife, food,
#    shops, offices, colleges, temples, parks, clinics, transit). The game turns it into crowd
#    size by hour: bars full from 9 pm to 1:30 am, offices by day, peth shops shut 1:30-4 pm.
import json, math, os, random, collections, sys
import pyarrow.parquet as pq
from shapely import wkb
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MAP = os.path.join(ROOT, 'data/map.json')
M = json.load(open(MAP)); meta = M['meta']
rng = random.Random(4848)
def proj(lat, lon): return ((lon - meta['lon0']) * meta['mlon'], -(lat - meta['lat0']) * meta['mlat'])
cm = lambda v: int(round(v * 100))
def ring(flat): return [(flat[k] / 100, flat[k + 1] / 100) for k in range(0, len(flat) - 1, 2)]
# idempotent: work from the walls / parking bake_map.py made (saved the first time this runs on a fresh bake)
BASE = os.path.join(ROOT, 'data/raw/street_base.json')
if M.get('street'):
    base = json.load(open(BASE)); M['walls'], M['parked'] = base['walls'], base['parked']
else:
    json.dump({'walls': M['walls'], 'parked': M['parked']}, open(BASE, 'w'), separators=(',', ':'))
M['street'] = 1

# ---------------------------------------------------------------- roads
E = M['graph']['edges']
lines, polys, info = [], [], []
for e in E:
    pts = ring(e[7])
    if len(pts) < 2: continue
    ln = LineString(pts)
    if ln.length < 0.5: continue
    w = e[2] / 100
    lines.append(ln); polys.append(ln.buffer(w / 2, cap_style='flat')); info.append(dict(w=w, rank=e[3], ow=bool(e[4]), sw=e[6] / 100, name=e[5], bridge=bool(e[8])))
ltree = STRtree(lines); ptree = STRtree(polys)
def nearest_edge(x, z):
    i = ltree.nearest(Point(x, z)); return i, lines[i], info[i]
def on_other_road(x, z, own):
    p = Point(x, z)
    for j in ptree.query(p):
        if j != own and polys[j].contains(p): return True
    return False

# buildings (to keep scooters off them)
B = [Polygon(ring(b[1])) for b in M['buildings']]
B = [g if g.is_valid else g.buffer(0) for g in B]
btree = STRtree(B)
def in_building(x, z, r=0.3):
    q = Point(x, z).buffer(r)
    return any(B[i].intersects(q) for i in btree.query(q))

# ---------------------------------------------------------------- real businesses
OPEN_FRONT = {'food', 'cafe', 'bar', 'clothes', 'hardware', 'books', 'grocery', 'jewellery', 'electronics', 'bakery',
              'shoes', 'mobile', 'pharmacy', 'optician', 'icecream', 'sweets', 'generic', 'salon', 'clinic', 'bank', 'atm', 'travel', 'hotel'}
biz = []                                   # (x, z, cat)
for p in M['pins']:
    biz.append((p[3] / 100, p[4] / 100, p[2]))
bpts = [Point(x, z) for x, z, _ in biz]
biz_tree = STRtree(bpts)
def biz_near(x, z, r):
    q = Point(x, z)
    return [biz[i] for i in biz_tree.query(q.buffer(r)) if bpts[i].distance(q) <= r]

# ---------------------------------------------------------------- 1. walls
keep, dropped = [], 0
for w in M['walls']:
    pts = ring(w)
    if len(pts) < 2: continue
    ln = LineString(pts)
    mid = ln.interpolate(0.5, normalized=True)
    near = biz_near(mid.x, mid.y, 18 + ln.length / 2)
    shops = sum(1 for b in near if b[2] in OPEN_FRONT)
    offices = sum(1 for b in near if b[2] not in OPEN_FRONT and b[2] != 'police')
    if shops >= 1 or offices >= 3:
        dropped += 1; continue
    keep.append(w)
print('walls kept', len(keep), 'removed in front of businesses', dropped)
M['walls'] = keep

# ---------------------------------------------------------------- 2. parking
kept, why = [], collections.Counter()
for p in M['parked']:
    x, z, ang, kind, n, side = p[0] / 100, p[1] / 100, p[2], p[3], p[4], p[5]
    i, ln, inf = nearest_edge(x, z)
    q = ln.interpolate(ln.project(Point(x, z)))
    dx, dz = x - q.x, z - q.y; d = math.hypot(dx, dz) or 1e-6
    ox, oz = dx / d, dz / d                              # outward, away from this carriageway
    # the far side of a median, or the middle of the road: another carriageway right behind the row
    if on_other_road(x + ox * 2.5, z + oz * 2.5, i) or on_other_road(x + ox * 5.0, z + oz * 5.0, i):
        why['median / between carriageways'] += 1; continue
    if kind != 1 and on_other_road(x, z, i):
        why['on another road'] += 1; continue
    kept.append(p)
print('parked kept', len(kept), dict(why))

# rows in front of real businesses: nose-in scooters at the kerb, cars outside nightlife / restaurants
occ = collections.defaultdict(list)
def occ_add(x, z, r): occ[(int(x // 4), int(z // 4))].append((x, z, r))
def occ_hit(x, z, r):
    i, j = int(x // 4), int(z // 4)
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            for (u, v, rr) in occ.get((i + a, j + b), ()):
                if (u - x) ** 2 + (v - z) ** 2 < (r + rr) ** 2: return True
    return False
for t in M['trees']: occ_add(t[0] / 100, t[1] / 100, 0.7)
for l in M['lamps']: occ_add(l[0] / 100, l[1] / 100, 0.35)
for l in M['poles']: occ_add(l[0] / 100, l[1] / 100, 0.35)
for l in M['buses']: occ_add(l[0] / 100, l[1] / 100, 6.0)
for l in M['stalls']: occ_add(l[0] / 100, l[1] / 100, 1.4)
for s in M['signals']: occ_add(s[0] / 100, s[1] / 100, 1.0)
for p in kept:
    x, z, ang, kind, n = p[0] / 100, p[1] / 100, p[2], p[3], p[4]
    ca, sa = math.cos(ang), math.sin(ang)
    for k in range(n): o = (k - (n - 1) / 2) * 0.85; occ_add(x + ca * o, z + sa * o, 0.45 if kind != 1 else 2.2)
deg = collections.Counter([e[0] for e in E] + [e[1] for e in E])
jpts = [Point(M['graph']['nodes'][n][0] / 100, M['graph']['nodes'][n][1] / 100) for n, c in deg.items() if c >= 3]
jtree = STRtree(jpts)
def near_junction(x, z, r):
    q = Point(x, z)
    return any(jpts[i].distance(q) < r for i in jtree.query(q.buffer(r)))
CARS_FOR = {'bar', 'food', 'cafe', 'hotel', 'clinic', 'jewellery', 'bank'}
added = collections.Counter()
order = list(range(len(biz))); rng.shuffle(order)
for bi in order:
    bx, bz, cat = biz[bi]
    if cat not in OPEN_FRONT and cat != 'service': continue
    i, ln, inf = nearest_edge(bx, bz)
    if inf['rank'] < 1 or inf['bridge'] or inf['rank'] >= 6: continue
    s = ln.project(Point(bx, bz))
    if s < 6 or s > ln.length - 6: continue
    q = ln.interpolate(s)
    dist = Point(bx, bz).distance(q)
    if dist > inf['w'] / 2 + 30: continue               # set well back from the street
    a = ln.interpolate(max(0, s - 1)); b = ln.interpolate(min(ln.length, s + 1))
    tx, tz = b.x - a.x, b.y - a.y; L = math.hypot(tx, tz) or 1; tx /= L; tz /= L
    sd = 1 if (tz * (bx - q.x) - tx * (bz - q.y)) > 0 else -1     # which side the business is on
    nx, nz = tz * sd, -tx * sd                                       # toward the business
    car = cat in CARS_FOR and inf['w'] >= 7 and rng.random() < (0.55 if cat == 'bar' else 0.25)
    if car:
        off = inf['w'] / 2 - 1.0
        x, z = q.x + nx * off, q.y + nz * off
        if occ_hit(x, z, 2.4) or near_junction(x, z, 14) or on_other_road(x + nx * 2.5, z + nz * 2.5, i): car = False
        else:
            ang = math.atan2(tz, tx) if rng.random() < 0.5 else math.atan2(-tz, -tx)
            kept.append([cm(x), cm(z), round(ang, 3), 1, 1, sd, 1]); occ_add(x, z, 2.4); added['car'] += 1
            continue
    off = inf['w'] / 2 + (0.6 if inf['sw'] > 0.8 else 0.55)
    x, z = q.x + nx * off, q.y + nz * off
    if near_junction(x, z, 10) or on_other_road(x, z, i) or on_other_road(x + nx * 2.5, z + nz * 2.5, i): continue
    n = rng.randint(3, 7) if cat != 'service' else rng.randint(1, 3)
    ang = math.atan2(tz, tx); ca, sa = math.cos(ang), math.sin(ang)
    mask = 0
    for k in range(n):
        o = (k - (n - 1) / 2) * 0.85
        px, pz = x + ca * o, z + sa * o
        if not occ_hit(px, pz, 0.45) and not in_building(px, pz, 0.35) and rng.random() > 0.08: mask |= 1 << k
    if not mask: continue
    kept.append([cm(x), cm(z), round(ang, 3), 2 if rng.random() < 0.3 else 0, n, sd, mask])
    for k in range(n):
        if mask >> k & 1: occ_add(x + ca * (k - (n - 1) / 2) * 0.85, z + sa * (k - (n - 1) / 2) * 0.85, 0.45)
    added['two-wheeler rows'] += 1
print('parking added in front of businesses', dict(added), 'total groups', len(kept))
M['parked'] = kept

# ---------------------------------------------------------------- 3. activity grid
CLS = ['night', 'food', 'retail', 'office', 'edu', 'worship', 'leisure', 'health', 'transit']
def cls_of_overture(basic, hier):
    h0 = hier[0] if hier else ''
    b = basic or ''
    if b in ('bar', 'lounge', 'dance_club', 'music_venue', 'pub', 'brewery', 'nightclub') or 'bar' in (hier or [])[-1:] : return 'night'
    if b in ('restaurant', 'casual_eatery', 'fast_food_restaurant', 'cafe', 'coffee_shop', 'food_truck_stand', 'smoothie_juice_bar',
             'non_alcoholic_beverage_venue', 'food_and_drink', 'food_service') or h0 == 'food_and_drink': return 'food'
    if b in ('college_university', 'education', 'specialty_school', 'educational_service', 'place_of_learning', 'tutoring_service',
             'high_school', 'preschool', 'elementary_school', 'campus_building', 'library', 'research_institute') or h0 == 'education': return 'edu'
    if b in ('hindu_place_of_worship', 'christian_place_of_worship', 'muslim_place_of_worship', 'religious_organization'): return 'worship'
    if b in ('park', 'gym', 'sport_or_fitness_facility', 'fitness_studio', 'stadium_arena', 'swimming_pool', 'sport_court', 'movie_theater',
             'theatre_venue', 'performing_arts_venue', 'museum', 'art_gallery', 'event_venue', 'arts_and_entertainment', 'monument'): return 'leisure'
    if b in ('hospital', 'specialized_health_care', 'dental_clinic', 'diagnostics_imaging_or_lab_service', 'health_care', 'surgery',
             'outpatient_care_facility', 'pharmacy_and_drug_store', 'pediatric_clinic', 'medical_service', 'primary_care_or_general_clinic') or h0 == 'health_care': return 'health'
    if b in ('train_station', 'public_transit_facility_or_service', 'travel_and_transportation', 'taxi_or_ride_share_service'): return 'transit'
    if h0 == 'shopping' or b.endswith('_store') or b in ('shopping', 'shopping_mall', 'atm', 'bank_or_credit_union', 'personal_or_beauty_service'): return 'retail'
    if b in ('corporate_or_business_office', 'professional_service', 'financial_service', 'real_estate_service', 'government_office',
             'b2b_office_and_professional_service', 'b2b_service', 'technical_service', 'media_service', 'design_service', 'attorney_or_law_firm',
             'legal_service', 'telecommunications_service', 'printing_service', 'building_or_construction_service') or h0 in ('business_to_business', 'professional_services'): return 'office'
    return None
CELL = 50.0
grid = collections.defaultdict(lambda: [0.0] * len(CLS))
def add(x, z, c, w=1.0):
    # spread over the cell and its neighbours (people walk a block or two)
    i, j = int(math.floor(x / CELL)), int(math.floor(z / CELL))
    k = CLS.index(c)
    for a in (-1, 0, 1):
        for b in (-1, 0, 1):
            grid[(i + a, j + b)][k] += w * (1.0 if a == 0 and b == 0 else 0.35 if a == 0 or b == 0 else 0.2)
vis = [v / 100 for v in meta['vis']]
T = pq.read_table(os.path.join(ROOT, 'data/raw/overture/places.parquet'), columns=['geometry', 'confidence', 'basic_category', 'taxonomy', 'operating_status'])
cnt = collections.Counter()
rows = list(zip(*[T.column(c).to_pylist() for c in ['geometry', 'confidence', 'basic_category', 'taxonomy', 'operating_status']]))
pts = [wkb.loads(r[0]) for r in rows]
stack = collections.Counter((round(p.x, 5), round(p.y, 5)) for p in pts)
for pt, (g, conf, basic, tax, st) in zip(pts, rows):
    if conf is not None and conf < 0.3: continue
    if st and st != 'open': continue
    # geocoder fallbacks (city / pin-code centroids, many listings on one point) are not real locations
    if abs(pt.y - 18.5203) < 0.0004 and abs(pt.x - 73.8567) < 0.0004 or stack[(round(pt.x, 5), round(pt.y, 5))] >= 5:
        cnt['skipped: geocoder fallback'] += 1; continue
    x, z = proj(pt.y, pt.x)
    if not (vis[0] <= x <= vis[2] and vis[1] <= z <= vis[3]): continue
    c = cls_of_overture(basic, (tax or {}).get('hierarchy'))
    if not c or c in ('night', 'food', 'retail'): continue      # those come from the deduped pins below
    add(x, z, c); cnt[c] += 1
# OSM landmarks and places pull crowds too
BIG = {'college': ('edu', 25), 'temple': ('worship', 6), 'park': ('leisure', 10), 'hospital': ('health', 10), 'transit': ('transit', 30), 'cinema': ('leisure', 12)}
for p in M['places']:
    if p[2] in BIG: c, w = BIG[p[2]]; add(p[3] / 100, p[4] / 100, c, w); cnt[c + ' (landmark)'] += 1
for l in M['landmarks']:
    add(l[2] / 100, l[3] / 100, 'leisure', 15); cnt['landmark'] += 1
# bars, food and shops from the pins: OSM and Overture already merged and deduped there
PINC = {'bar': ('night', 1.5), 'food': ('food', 1), 'cafe': ('food', 1), 'bakery': ('food', 1), 'icecream': ('food', 1), 'sweets': ('food', 1)}
for c in ('clothes', 'hardware', 'books', 'grocery', 'jewellery', 'electronics', 'shoes', 'mobile', 'generic', 'salon', 'optician', 'pharmacy', 'bank', 'atm', 'travel'):
    PINC[c] = ('retail', 1)
for p in M['pins']:
    if p[2] in PINC: c, w = PINC[p[2]]; add(p[3] / 100, p[4] / 100, c, w); cnt[c + ' (pins)'] += 1
print('activity sources', dict(cnt))
# ---------------------------------------------------------------- 4. buildings by what is really inside
# A tower full of company offices is glass-fronted, a hospital an institution, a shopping complex a
# commercial block. Bungalows stay bungalows even with a cafe inside (that is Koregaon Park).
inside = collections.defaultdict(collections.Counter)
def tag_inside(x, z, what):
    q = Point(x, z)
    for i in btree.query(q.buffer(3.0)):
        if B[i].distance(q) <= 3.0: inside[i][what] += 1; return
for pt, (g, conf, basic, tax, st) in zip(pts, rows):
    if conf is not None and conf < 0.3 or st and st != 'open': continue
    if abs(pt.y - 18.5203) < 0.0004 and abs(pt.x - 73.8567) < 0.0004 or stack[(round(pt.x, 5), round(pt.y, 5))] >= 5: continue
    x, z = proj(pt.y, pt.x)
    c = cls_of_overture(basic, (tax or {}).get('hierarchy'))
    if basic == 'shopping_mall': c = 'mall'
    elif basic == 'hospital': c = 'hospital'
    elif basic in ('hotel', 'resort') and conf and conf >= 0.6: c = 'hotel'
    if c: tag_inside(x, z, c)
for p in M['pins']:
    if p[2] in PINC and PINC[p[2]][0] in ('retail', 'food'): tag_inside(p[3] / 100, p[4] / 100, 'shopfood')
STY = dict(apartment=0, commercial=1, old=2, bungalow=3, institution=4, glass=9)
changed = collections.Counter()
for i, b in enumerate(M['buildings']):
    st, lv, k = b[3], b[2], inside.get(i)
    if not k or st not in (0, 1, 2): continue
    if k['hospital'] and B[i].area > 400: b[3] = STY['institution']; changed['hospital -> institution'] += 1
    elif k['mall'] and lv >= 2: b[3] = STY['glass'] if lv >= 4 else STY['commercial']; changed['mall'] += 1
    elif k['office'] >= 4 and lv >= 5: b[3] = STY['glass']; changed['office tower -> glass'] += 1
    elif k['office'] >= 2 and lv >= 3 and st == 0: b[3] = STY['commercial']; changed['office block -> commercial'] += 1
    elif k['hotel'] and lv >= 7: b[3] = STY['glass']; changed['hotel -> glass'] += 1
    elif k['shopfood'] >= 4 and 2 <= lv <= 5 and st == 0 and B[i].area > 250: b[3] = STY['commercial']; changed['shopping complex -> commercial'] += 1
print('building use', dict(changed))

cells = []
for (i, j), v in grid.items():
    if sum(v) < 0.3: continue
    cells.append([i, j] + [round(a, 1) for a in v])
M['activity'] = {'cell': CELL, 'cls': CLS, 'cells': cells}
print('activity cells', len(cells))
# the busiest cells per class, as a sanity check against what Pune actually is
def where(i, j):
    x, z = (i + 0.5) * CELL, (j + 0.5) * CELL
    best = min(M['areas'], key=lambda a: (a[2] / 100 - x) ** 2 + (a[3] / 100 - z) ** 2)
    return best[0]
for k, c in enumerate(CLS):
    top = sorted(cells, key=lambda r: -r[2 + k])[:3]
    print(' ', c.ljust(8), ' | '.join(f'{where(r[0], r[1])} {r[2 + k]}' for r in top))
if '--dry' not in sys.argv:
    json.dump(M, open(MAP, 'w'), separators=(',', ':'), ensure_ascii=False)
    print('wrote', os.path.getsize(MAP) // 1024, 'KB')
