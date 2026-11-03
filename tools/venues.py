#!/usr/bin/env python3
"""venues.py - real venues from place-listing CSVs, at their exact coordinates: each listing is sorted into what it
really is (club, pub, lounge, neighbourhood bar, family restaurant with a bar, or plain restaurant, café, hotel...),
its map pin goes on its coordinates, and its board and door go on the wall of the building at those coordinates, the
nearest free slot to the point. The same place's older pins and boards nearby are removed. A listing with no opening
hours may be shut, so it's held back (see --review) and whatever the map already has for it is left as it is.
Only the name, the kind and the position are baked: ratings, reviews, phones and the like stay out of the game.
Safe to rerun, and the CSVs of later searches can be added to the list.
In: CSVs. Out: data/pune/t_*.json.gz, pins.json.gz, src/world/famous.json.
usage: python3 tools/venues.py [--review out.csv] [--dry] a.csv b.csv ..."""
import csv, glob, gzip, json, math, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from place_kinds import kind_of, TRADE
from shopnames import brand_parody
csv.field_size_limit(10 ** 8)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LAT0, LON0, MLAT, MLON = 18.527, 73.865, 110686.0, 105589.0
SLOT, SNAP = 3.6, 15.0                         # shop slot width; a building further than this isn't the listing's building
NO_BOARD = {6, 7, 8, 10, 11, 13}
VERIFIED = 3                                   # a shop record's source: placed from coordinates, nothing may move it
MR = {'club': 'क्लब', 'pub': 'पब', 'lounge': 'लाउंज', 'bar': 'बार', 'restobar': 'बार अँड रेस्टॉरंट', 'food': 'उपाहारगृह', 'cafe': 'कॅफे', 'lodge': 'हॉटेल', 'shop': 'वाईन शॉप',
      'mall': 'मॉल', 'gaming': 'गेमिंग', 'memberclub': 'क्लब'}

# ---------------------------------------------------------------- what a listing really is
DANCE = {'Night club', 'Disco club', 'Dance club', 'Dance restaurant'}
PUB = {'Pub', 'Brewery', 'Brewpub', 'Gastropub', 'Irish pub', 'Sports bar', 'Beer garden', 'Live music bar', 'Microbrewery', 'Beer hall', 'German restaurant'}
LOUNGE = {'Lounge bar', 'Cocktail bar', 'Wine bar', 'Tapas bar'}
OTHER = {'Cafe': 'cafe', 'Coffee shop': 'cafe', 'Coffee store': 'cafe', 'Coffee roasters': 'cafe', 'Hotel': 'lodge', 'Resort hotel': 'lodge', 'Lodge': 'lodge', 'Beer store': 'shop', 'Wine store': 'shop', 'Liquor store': 'shop',
         'Shopping mall': 'mall', 'Amusement center': 'gaming', 'Amusement park': 'gaming', 'Pool hall': 'gaming', 'Juice shop': 'juice', 'Panipuri shop': 'misal', 'Dairy store': 'kirana', 'Banquet hall': 'services',
         'Cultural landmark': 'landmark', 'Social club': 'memberclub'}
NOT_VENUE = {'Manufacturer', 'Corporate office', 'Recruiter', 'Marketing agency', 'Condominium complex', 'Student dormitory', 'Business park', 'Repair service', ''}
MEMBERS = re.compile(r'poona club|ladies club|new club|turf club|residency club|boat club|deccan gymkhana|pyc hindu|\bgymkhana\b', re.I)
FAMILYNAME = re.compile(r'\b(family|barbe?cues?|bbq|dhaba|pure veg|veg restaurant|multicuisine|multi-cuisine|garden restaurant|thali|biryani|misal)\b', re.I)
CLUBNAME = re.compile(r'\b(night ?club|night ?life|superclub|luxury club|key club|dance (&|and) kitchen)\b', re.I)
# read one by one against the listings: the ones the rules can't see
HAND = {'Ballr': 'club', 'Barakka': 'club', 'Xclusive Superclub': 'club', 'Toyroom': 'club', 'Vault': 'club', 'Elrow': 'club', 'Plunge': 'club', 'Bira 91 Taproom': 'pub',
        "Agent Jack": 'pub', 'I Amsterdam': 'pub', 'Spice Factory': 'pub', 'LOVA': 'lounge', 'AZZURRO': 'lounge', 'Açai': 'lounge', 'Flair Mania': 'classes', 'Karve Statue': 'landmark', 'PizzaExpress': 'restobar', 'Effingut': 'pub'}
DROP = re.compile(r'^(party|abc|best pub|nearby pune railway station|bhagalpur station|ac waiting place)$', re.I)
SHOPNAME = re.compile(r'wine shop|beer shop|beer (and|&) wine|wine metro|\bwines$|liquor|wine store|beer station|growler', re.I)
RESTO = re.compile(r'\b(restaurant|restro|resturant|restraunt|resto|hotel|family|lunch home|garden)\b', re.I)
NOTCLUB = re.compile(r'\b(lounge|sports?|restaurant|resto|cocktail|grill|rooftop|sky)\b', re.I)
late = lambda h: bool(re.search(r'[–-]\s*(12|1|2|3|4)(:\d\d)?\s*\W?am', h or ''))

def clean(t):
    t = re.sub(r'^(discover|bar in pune\s*-)\s*', '', t.strip(), flags=re.I)
    t = re.split(r'\s*\|\s*|\s+[-–—]\s*|\s*[-–—]\s+|\s*\(|\s*\[|\.\s| also ', t, flags=re.I)[0].strip(' ,-')
    if ',' in t and len(t.split(',')[0]) >= 4: t = t.split(',')[0].strip()
    if len(t) > 34: t = t[:34].rsplit(' ', 1)[0]
    t = re.sub(r'\s+(pune|koregaon park|kharadi|baner|hinjewadi|hinjawadi|wakad|viman nagar|kalyani nagar|camp)$', '', t, flags=re.I) if len(t.split()) > 1 else t
    return t

def classify(r):
    """-> kind, or None if it isn't a place to put on the map"""
    t, cats, L, rev = r['title'], [c.strip() for c in r['categories'].split(',')], r['labels'] or '', int(r['review_count'] or 0)
    prim, cs = cats[0], set(cats)
    name = clean(t)
    if rev < 5 or DROP.match(name) or prim in NOT_VENUE: return None
    if name.lower() == 'the mills': return 'landmark'                                      # a whole complex, its venues listed on their own
    if name.lower().startswith('effingut 2 go'): return 'shop'
    for k, v in HAND.items():
        if name.lower().startswith(k.lower()) and (k != 'Vault' or name.lower() == 'vault'): return v
    if re.search(r'juice bar', t, re.I): return 'juice'
    if SHOPNAME.search(t): return 'shop'
    if MEMBERS.search(t): return 'memberclub'
    if prim in OTHER: return OTHER[prim]
    has = lambda s: s in L
    drinks = has('Alcohol') or has('Bar on site') or bool(cs & (DANCE | PUB | LOUNGE | {'Bar', 'Bar & grill', 'Club'}))
    if not drinks:                                                                          # a restaurant that came up in the search
        k, _ = kind_of(name, 'food')
        return 'food' if k == 'bar' or k in ('office', 'services', 'classes', 'shop') else k
    family = FAMILYNAME.search(t) or 'Family restaurant' in cs and not (has('Upmarket') or has('Trendy')) or has('Family friendly') and has('Good for kids') and not has('Dancing')
    restofirst = 'restaurant' in prim.lower() or prim in ('Diner', 'Bistro', 'Food court', 'Buffet')
    # a real club: billed as one, people dance, it runs late
    billed = prim in DANCE or CLUBNAME.search(t) or re.search(r'\bclub\b', name, re.I) or (cats[1:2] and cats[1] in DANCE and not NOTCLUB.search(name))
    if billed and not FAMILYNAME.search(t) and rev >= 30 and (has('Dancing') or late(r['opening_hours'])) and not (restofirst and has('Family friendly')) and not (NOTCLUB.search(name) and prim not in DANCE and not CLUBNAME.search(t)): return 'club'
    if family or (restofirst and has('Good for kids') and not has('Dancing')) or RESTO.search(name): return 'restobar'
    if re.search(r'\b(lounge|cocktail|sky bar|rooftop)\b', name, re.I) or prim in LOUNGE: return 'lounge'
    if cs & PUB or re.search(r'\b(pub|brew\w*|taproom|tap room|beer garden)\b', t, re.I): return 'pub'
    # a big night out with no "pub" on the listing: dancing, a DJ, past midnight; or simply a popular, trendy place
    if has('Dancing') and late(r['opening_hours']) and rev >= 300 and (has('Upmarket') or has('Live music') or has('Reservations required')): return 'pub'
    if rev >= 1000 and (has('Trendy') or has('Upmarket')) and has('Cocktails'): return 'pub'
    if cs & LOUNGE: return 'lounge'
    if restofirst: return 'restobar'
    return 'bar'

# ---------------------------------------------------------------- the listings
args, review, dry, files = sys.argv[1:], None, False, []
while args:
    a = args.pop(0)
    if a == '--review': review = args.pop(0)
    elif a == '--dry': dry = True
    else: files.append(a)
R = {}
for f in files:
    for r in csv.DictReader(open(f, encoding='utf-8-sig', newline='')): R.setdefault(r['place_id'], r)
print('listings', len(R), flush=True)
ALWAYS_OPEN = {'lodge', 'memberclub', 'mall', 'landmark'}          # hotels and members' clubs often just don't list hours
venues, held, gone = [], [], []
for r in R.values():
    k = classify(r)
    r['_kind'] = k or ''; r['_name'] = clean(r['title'])
    if not k: gone.append(r); continue
    if not r['opening_hours'] and k not in ALWAYS_OPEN: held.append(r); continue
    r['x'], r['z'] = (float(r['longitude']) - LON0) * MLON, -(float(r['latitude']) - LAT0) * MLAT
    venues.append(r)
# the same place twice under two ids: a name, within 40 m
seen, uniq = collections.defaultdict(list), []
strip = lambda s: re.sub(r'^the', '', re.sub(r'[^a-z0-9]', '', (s or '').lower()))
for r in sorted(venues, key=lambda r: -int(r['review_count'] or 0)):
    k = strip(r['_name'])
    if any(math.hypot(r['x'] - x, r['z'] - z) < 40 for x, z in seen[k]): continue
    seen[k].append((r['x'], r['z'])); uniq.append(r)
venues = uniq
print('kinds', collections.Counter(r['_kind'] for r in venues).most_common(), '| held (no hours)', len(held), '| not places', len(gone), flush=True)
if review:
    with open(review, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh); w.writerow(['status', 'kind', 'name', 'listing', 'categories', 'reviews', 'rating', 'area'])
        for st, L in (('in', venues), ('held: no hours', held), ('dropped', gone)):
            for r in sorted(L, key=lambda r: (r['_kind'], -int(r['review_count'] or 0))): w.writerow([st, r['_kind'], r['_name'], r['title'], r['categories'], r['review_count'], r['rating'], r['municipality'].split(',')[-1].strip()])
if dry: sys.exit(0)

# ---------------------------------------------------------------- tiles
tkey = lambda x, z: (int((x * 100 + 2000000) // 100000), int((z * 100 + 2400000) // 100000))
paths = {tuple(map(int, re.findall(r't_(\d+)_(\d+)', f)[0])): f for f in glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz'))}
cache, dirty = {}, set()
def inside(x, z, P):
    c = False
    for k in range(len(P)):
        (ax, az), (bx, bz) = P[k], P[k - 1]
        if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az + 1e-12) + ax: c = not c
    return c
def seg(x, z, ax, az, bx, bz):
    ex, ez = bx - ax, bz - az; L2 = ex * ex + ez * ez or 1e-9
    t = max(0.0, min(1.0, ((x - ax) * ex + (z - az) * ez) / L2))
    return math.hypot(ax + ex * t - x, az + ez * t - z), t
class Tile:
    def __init__(self, key):
        self.key, self.T = key, json.load(gzip.open(paths[key]))
        self.polys = [[(b[1][2 * k] / 100, b[1][2 * k + 1] / 100) for k in range(len(b[1]) // 2)] for b in self.T['buildings']]
        self.grid = collections.defaultdict(list)
        for bi, P in enumerate(self.polys):
            if len(P) < 3: continue
            xs, zs = [q[0] for q in P], [q[1] for q in P]
            for i in range(int(min(xs) // 20), int(max(xs) // 20) + 1):
                for j in range(int(min(zs) // 20), int(max(zs) // 20) + 1): self.grid[(i, j)].append(bi)
    def near(self, x, z, R):
        out = set()
        for i in range(int((x - R) // 20), int((x + R) // 20) + 1):
            for j in range(int((z - R) // 20), int((z + R) // 20) + 1): out.update(self.grid.get((i, j), ()))
        return out
def tile(key):
    if key not in paths: return None
    if key not in cache: cache[key] = Tile(key)
    return cache[key]
def around(x, z, R=0):
    i, j = tkey(x, z); out = []
    for a in range(tkey(x - max(R, 60), z)[0], tkey(x + max(R, 60), z)[0] + 1):
        for b in range(tkey(x, z - max(R, 60))[1], tkey(x, z + max(R, 60))[1] + 1):
            t = tile((a, b))
            if t: out.append(t)
    return out
GENERIC = re.compile(r'(pune|poona|brewery|brewing|brew|bar|pub|and|n|restaurant|resturant|restro|resto|kitchen|club|cafe|lounge|eatery|bistro|nightclub|night|india|co|company)*')
norm = lambda s: re.sub(r'^the', '', re.sub(r'[^a-z0-9]', '', (s or '').lower()))
def sameName(a, b):
    if not a or not b: return False
    if a == b: return True
    s = min(len(a), len(b))
    sh, lo = (a, b) if len(a) < len(b) else (b, a)
    if len(sh) >= 4 and lo.startswith(sh) and GENERIC.fullmatch(lo[len(sh):]): return True      # "Toit" and "Toit Pune Brewery"
    return s >= 6 and a[:max(6, min(8, s))] == b[:max(6, min(8, s))]

pinsAll = json.load(gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz')))
pgrid = collections.defaultdict(set)
for i, p in enumerate(pinsAll): pgrid[(p[3] // 40000, p[4] // 40000)].add(i)
deadPins = set()
tot = collections.Counter(); dist = []; addPin = collections.defaultdict(list); newPins = []; nextId = 900000
def nameIdx(t, en, mr, trade, flag):
    N = t.T['shopNames']
    key = [en, mr, trade, flag]
    if key in N: return N.index(key)
    N.append(key); return len(N) - 1

# the hand-written list follows the coordinates (and a famous place keeps the name the game knows it by)
Fp = os.path.join(ROOT, 'src/world/famous.json'); FAM = json.load(open(Fp, encoding='utf-8')); moved = []
for f in FAM:
    m = [r for r in venues if sameName(norm(r['_name']), norm(f['name'])) and math.hypot(r['x'] - f['x'], r['z'] - f['z']) < 300]
    if not m: continue
    r = min(m, key=lambda r: math.hypot(r['x'] - f['x'], r['z'] - f['z']))
    moved.append((f['name'], round(math.hypot(r['x'] - f['x'], r['z'] - f['z']))))
    f['x'], f['z'] = round(r['x'], 1), round(r['z'], 1); r['_name'] = f['name']
    if f.get('kind') and r['_kind'] in ('club', 'pub', 'lounge', 'bar', 'restobar'): f['kind'] = r['_kind']
# the map has no footprint where a listing stands (a complex nobody traced): a small commercial block on the spot, clear of
# the road, its long side to the street; neighbours in the same complex share it. Returns what the wall search returns.
def roadNear(x, z):
    best = None
    for t in around(x, z, 80):
        for e in t.T['graph']['edges']:
            p = e[7]
            for k in range(0, len(p) - 2, 2):
                ax, az, bx, bz = p[k] / 100, p[k + 1] / 100, p[k + 2] / 100, p[k + 3] / 100
                if abs(ax - x) > 120 or abs(az - z) > 120: continue
                d, u = seg(x, z, ax, az, bx, bz)
                if best is None or d < best[0]: best = (d, ax + (bx - ax) * u, az + (bz - az) * u, bx - ax, bz - az, e[2] / 100)
    return best
built = 0
def newBuilding(x, z):
    global built
    t = tile(tkey(x, z)); B = t.T['buildings']
    W, D = 7.0, 5.0                                             # half width along the road, half depth
    cx, cz, tx, tz = x, z, 1.0, 0.0
    rd = roadNear(x, z)
    if rd:
        d, rx, rz, ex, ez, w = rd; L = math.hypot(ex, ez) or 1; tx, tz = ex / L, ez / L
        need = w / 2 + D + 3.5                                  # road, footpath, then the wall
        if d < need:
            nx, nz = (x - rx, z - rz) if d > 0.1 else (-tz, tx)
            n = math.hypot(nx, nz) or 1; cx, cz = rx + nx / n * need, rz + nz / n * need
    nx, nz = -tz, tx
    ring = [(cx + sx * W * tx + sz * D * nx, cz + sx * W * tz + sz * D * nz) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    r0 = next((q for q in t.polys if len(q) >= 3), None); sign = sum(r0[i][0] * r0[i - 1][1] - r0[i - 1][0] * r0[i][1] for i in range(len(r0))) if r0 else 1
    if sign * sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1] for i in range(4)) < 0: ring.reverse()
    tpl = B[min(range(len(B)), key=lambda b: (t.polys[b][0][0] - x) ** 2 + (t.polys[b][0][1] - z) ** 2 if t.polys[b] else 1e18)] if B else [0, [], 2, 1, 0, '', 0, 0, 0, 0, '']
    built += 1
    B.append([9000000 + t.key[0] * 100000 + t.key[1] * 1000 + len(B) % 1000, [round(v * 100) for q in ring for v in q], 3, 1, tpl[4], '1111', tpl[6], 0, tpl[8], tpl[9], ''])
    b = len(B) - 1; t.polys.append(ring); dirty.add(t.key)
    xs, zs = [q[0] for q in ring], [q[1] for q in ring]
    for i in range(int(min(xs) // 20), int(max(xs) // 20) + 1):
        for j in range(int(min(zs) // 20), int(max(zs) // 20) + 1): t.grid[(i, j)].append(b)
    e = min(range(4), key=lambda q: seg(x, z, *ring[q], *ring[(q + 1) % 4])[0])
    L = math.hypot(ring[(e + 1) % 4][0] - ring[e][0], ring[(e + 1) % 4][1] - ring[e][1])
    d, u = seg(x, z, *ring[e], *ring[(e + 1) % 4])
    return (0, t, b, e, u, L, d, False)
# first the old pins and boards of everyone (so a venue's old board doesn't hold the slot it wants), held places left alone
for r in venues:
    k, x, z = norm(r['_name']), r['x'], r['z']; X, Z = x * 100, z * 100
    par = brand_parody(r['_name']); pk = norm(par[0]) if par else None
    for i in range(int(X // 40000) - 1, int(X // 40000) + 2):
        for j in range(int(Z // 40000) - 1, int(Z // 40000) + 2):
            for pi in pgrid.get((i, j), ()):
                p = pinsAll[pi]
                if pi not in deadPins and math.hypot(p[3] - X, p[4] - Z) < 40000 and sameName(k, norm(p[0])): deadPins.add(pi); tot['old pins removed'] += 1
    for t in around(x, z, 400):
        N = t.T['shopNames']; keep = []
        for s in t.T['shops']:
            if s[4] != 0 and s[3] < len(N) and (sameName(k, norm(N[s[3]][0])) or (pk and sameName(pk, norm(N[s[3]][0])))):
                P = t.polys[s[0]]
                if P and math.hypot(P[0][0] - x, P[0][1] - z) < 450: tot['old boards removed'] += 1; dirty.add(t.key); continue
            keep.append(s)
        t.T['shops'] = keep
# then each venue, most reviewed first, gets the slot nearest its coordinates
for r in sorted(venues, key=lambda r: -int(r['review_count'] or 0)):
    x, z, kind, name = r['x'], r['z'], r['_kind'], r['_name']
    if tkey(x, z) not in paths: tot['outside the map'] += 1; continue
    trade = kind if kind in ('club', 'pub', 'lounge', 'bar', 'restobar') else TRADE.get(kind, 'generic')
    best = None
    for t in around(x, z, SNAP):
        cands = [b for b in t.near(x, z, SNAP) if t.T['buildings'][b][3] not in NO_BOARD]
        hit = [b for b in cands if inside(x, z, t.polys[b])]
        for b in (hit or cands):
            P = t.polys[b]; fl = t.T['buildings'][b][5]
            for e in range(len(P)):
                (ax, az), (bx, bz) = P[e], P[(e + 1) % len(P)]
                L = math.hypot(bx - ax, bz - az)
                if L <= 2.6: continue
                d, u = seg(x, z, ax, az, bx, bz)
                if not hit and d > SNAP: continue
                score = d + (0 if (e < len(fl) and fl[e] in '123') else 5) - (100 if hit else 0)
                if not best or score < best[0]: best = (score, t, b, e, u, L, d, bool(hit))
    if kind == 'landmark': pass                                # (a statue, a complex: a pin, no shopfront)
    elif not best and not (best := newBuilding(x, z)): tot['no building, no room'] += 1
    else:
        _, t, b, e, u, L, d, ins = best
        ns = max(1, int(math.floor(L / SLOT))); k0 = min(ns - 1, int(u * ns))
        real = {(s[0], s[1], s[2]) for s in t.T['shops'] if s[4] != 0}
        order = [k0 + dk for dk in (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5) if 0 <= k0 + dk < ns]
        slot = next((kk for kk in order if (b, e, kk) not in real), None)
        if slot is None:                                            # a full wall (a whole complex's venues): the next wall round
            P = t.polys[b]
            for e2 in sorted(range(len(P)), key=lambda q: seg(x, z, *P[q], *P[(q + 1) % len(P)])[0]):
                L2 = math.hypot(P[(e2 + 1) % len(P)][0] - P[e2][0], P[(e2 + 1) % len(P)][1] - P[e2][1])
                if L2 <= 2.6: continue
                free = [kk for kk in range(max(1, int(L2 // SLOT))) if (b, e2, kk) not in real]
                if free: e, slot = e2, free[0]; break
        if slot is None: tot['no free wall'] += 1
        else:
            t.T['shops'] = [s for s in t.T['shops'] if (s[0], s[1], s[2]) != (b, e, slot)]
            par = brand_parody(name)
            en, flag = (par[0], 'brand') if par else (name, '')
            t.T['shops'].append([b, e, slot, nameIdx(t, en, MR.get(kind, en), trade, flag), VERIFIED]); dirty.add(t.key)
            P = t.polys[b]; (ax, az), (bx, bz) = P[e], P[(e + 1) % len(P)]; L = math.hypot(bx - ax, bz - az); ns = max(1, int(L // SLOT)); q = (slot + 0.5) / ns
            r['_d'] = math.hypot(ax + (bx - ax) * q - x, az + (bz - az) * q - z); dist.append(r['_d']); tot['on the building it stands in' if ins else 'on the nearest building'] += 1
    pin = [name, '', kind, round(x * 100), round(z * 100), 1]
    newPins.append(pin); addPin[tkey(x, z)].append(pin)

# ---------------------------------------------------------------- write
kill = {(pinsAll[i][0], pinsAll[i][3], pinsAll[i][4]) for i in deadPins}
out = [p for i, p in enumerate(pinsAll) if i not in deadPins] + newPins
for key in {tkey(pinsAll[i][3] / 100, pinsAll[i][4] / 100) for i in deadPins} | set(addPin):
    t = tile(key)
    if not t: continue
    before = len(t.T.get('pins') or [])
    t.T['pins'] = [p for p in t.T.get('pins') or [] if (p[0], p[3], p[4]) not in kill] + addPin.get(key, [])
    if len(t.T['pins']) != before or key in addPin: dirty.add(key)
for key in dirty:
    with gzip.open(paths[key], 'wb', 9) as fh: fh.write(json.dumps(cache[key].T, separators=(',', ':'), ensure_ascii=False).encode())
with gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz'), 'wb', 9) as fh: fh.write(json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode())
json.dump(FAM, open(Fp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
d = sorted(dist)
print(dict(tot)); print('map pins', len(out), '| tiles rewritten', len(dirty))
print('door to coordinates: median %.1f m, within 10 m %d of %d, within 25 m %d, max %.0f m' % (d[len(d) // 2], sum(v <= 10 for v in d), len(d), sum(v <= 25 for v in d), d[-1]))
print('famous moved', moved); print('new buildings', built)
