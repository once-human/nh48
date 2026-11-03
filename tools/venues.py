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
import csv, difflib, functools, glob, gzip, json, math, os, re, sys, collections, unicodedata
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
    if len(t) > 34: t = re.sub(r'\s+(and|&|n|of|the|by|at|in|-)$', '', t[:34].rsplit(' ', 1)[0], flags=re.I)
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
fold = lambda s: unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower().replace('&', ' and ')     # (Açai is Acai)
strip = lambda s: re.sub(r'^the', '', re.sub(r'[^a-z0-9]', '', fold(s)))
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
META = json.load(gzip.open(os.path.join(ROOT, 'data/pune/base.json.gz')))['meta']
# a building's first field is the map chunk it belongs to
def chunkOf(x, z):
    i, j = int((x - META['vis'][0] / 100) // META['chunk']), int((z - META['vis'][1] / 100) // META['chunk'])
    return i + j * META['ncx']
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
# ---------------------------------------------------------------- is it the same place?
# Only the words that tell a place apart count: "Toit" and "Toit Brewery" are one place, "Samruddhi Classes" and "Samruddhi Pure
# Veg" are two. All of one's words in the other is only believed close by, and only of something you eat or drink at.
COMMON = set(('the and n pune poona india co company pvt ltd brewery brewing brew bar bars pub restaurant resturant restraunt restro resto rest o reto kitchen club cafe '
    'lounge eatery bistro nightclub night hotel family veg pure non multicuisine multi cuisine garden rooftop sky terrace dine dining banquets banquet diner grill '
    'mills camp baner balewadi wakad hinjewadi hinjawadi kothrud kharadi aundh koregaon park kalyani nagar viman mundhwa high street sb road fc').split())
@functools.lru_cache(maxsize=None)
def core(name):
    name = re.split(r'\bby\b', fold(name))[0] or fold(name)                 # ("Glint by Plunge" isn't Plunge, "Slounge by Lemon Tree" isn't the Lemon Tree)
    w = [t for t in re.split(r'[^a-z0-9]+', name) if t]
    return tuple(t for t in w if t not in COMMON and not t.isdigit()), ''.join(w)
def sameName(a, b):
    """-> 'same', 'part' or None"""
    (A, fa), (B, fb) = core(a), core(b)
    if fa == fb and fa: return 'same'
    if not A or not B: return None
    if A == B or sorted(A) == sorted(B): return 'same'
    if len(A) == len(B) and A[0][:3] == B[0][:3] and difflib.SequenceMatcher(None, ''.join(A), ''.join(B)).ratio() >= 0.88: return 'same'     # (Mahableshwar, Mahabaleshwar)
    sh, lo = (A, B) if len(A) < len(B) else (B, A)
    return 'part' if set(sh) <= set(lo) and len(''.join(sh)) >= 4 else None
EATS = {'food', 'cafe', 'bar', 'pub', 'club', 'lounge', 'restobar', 'tapri', 'thali', 'misal', 'biryani', 'southindian', 'chinese', 'fastfood', 'juice'}
OWN_TRADE = set('snacks snack center centre sports shop shoppe shopee shoppee beer wine wines juice chai tea bakery sweets lodge oyo rooms salon academy classes mart medical'.split())
NEVER = {'temple', 'park', 'college', 'hospital', 'clinic', 'chowki', 'fuel', 'bank', 'transit', 'mall', 'landmark', 'zoo', 'cinema'}
def isOld(name, kind, vname, d):
    """is this older pin (or board, by its trade) the listing's own?"""
    m = sameName(vname, name)
    if not m: return False
    (A, _), (B, _) = core(vname), core(name)
    if re.search(r'\bveg\b', fold(name)) and not re.search(r'\b(veg|restaurant|resto|restro|family)\b', fold(vname)): return False     # (Apsara Veg isn't Apsara Bar)
    if m == 'same': return d < (200 if len(''.join(A)) >= 6 else 80) and kind not in NEVER                  # (a short name is a common one)
    return d < 60 and kind in EATS and not (set(B) - set(A)) & OWN_TRADE                                    # (Swagat Snacks isn't Swagat Resto Bar)

# Told to us, or checked: not there
GONE = {'OLA head office', 'Drama 9', 'The Game Palacio', 'The Mills Social', 'The Mills Sociable', 'Themillspune'}
# A "bar" in the older data because its name says club or social: what it really is. Any other older bar with no listing is held out:
# the searches covered the whole city, and these are the pins nobody can vouch for. A name that doesn't even say it serves a drink
# stays on the map as a plain listing, for what it is: we only know its name
NOT_A_BAR = [(re.compile(p, re.I), k) for p, k in (
    (r'wine shop|beer shop|wine (and|&) beer|beer (and|&) wine|beer shopp?e|(?<!dine )(?<!dine & )(?<!dine and )wines?$|wines (and|&)|liquor|beer point', 'shop'), (r'juice', 'juice'),
    (r'fitness|\bgym\b|gymnasium|health club|crossfit|wellness|yoga|martial|karate|badminton|swimming|aquatic|workout|\bfit bar\b|\bsports? club', 'gym'),
    (r'foundation|network|pubmatic|software|technolog|solutions|society|association|rotary|lions club|council|\bngo\b|forum|group$|housing|services$|consult|welfare|commissioner', 'office'),
    (r'\bchai\b|tea bar', 'tapri'), (r'sandwich|salad|pav ?bhaji|snack|vada|misal|pizzeria', 'food'), (r'baker|bakes|cake', 'bakery'), (r'\bsalon\b|beauty|hair', 'barber'),
    (r'kids club|play ?school|tuition|classes|academy', 'classes'), (r'snooker|gaming|billiard', 'gaming'), (r'tattoo', 'services'))]
SERVES = re.compile(r'\b(hard rock|nightclub|night club|brewco|peg|pint|taproom|bars?|pub|resto|restro|restaurant|restraunt|lounge|cocktails?|taproom|brew ?pub|brewery|brewing|brews?|beer|wine|theka|permit|kitchen|dine|diner|bistro|hotel|spirits?)\b', re.I)
COFFEE = re.compile(r'coffee|\bbeans\b|\bcafe\b|\bread and brew\b|benne', re.I)
def barFate(name):
    """an older 'bar' with no listing -> the kind it really is, or None to hold it out"""
    k = next((v for rx, v in NOT_A_BAR if rx.search(name)), None)
    if k: return k
    if COFFEE.search(name) and not re.search(r'\b(bar|pub|lounge|cocktails?|beer|hard rock)\b', name, re.I): return 'cafe'
    return None if SERVES.search(name) or re.search(r'road$', name, re.I) else 'services'
JUNK = {'pune', 'head office', 'office', 'shop', 'hotel', 'restaurant', 'bank', 'atm', 'headquarters'}
SPAM = {'Math Tuition Classes Cuemath', 'Maths Tuition Classes', 'Home Cleaning Services'}       # home tutors and cleaners listed by the hundred at people's flats: nobody's shop
REKIND = [(re.compile(r'tuition|coaching|\bclasses\b', re.I), 'classes', {'temple', 'park', 'food', 'bar'}), (re.compile(r'(head|registered|corporate|regional) office', re.I), 'office', {'temple', 'park', 'food', 'bar', 'shop'})]
removed = []                 # (why, by what, name, kind, x, z): every pin taken off the map, for reading (scratch/venue_removed.csv)

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
Fp = os.path.join(ROOT, 'src/world/famous.json'); FAM = [f for f in json.load(open(Fp, encoding='utf-8')) if f['name'] not in GONE]; moved = []
for f in FAM:
    m = [r for r in venues if sameName(r['_name'], f['name']) == 'same' and math.hypot(r['x'] - f['x'], r['z'] - f['z']) < 300]
    if not m:
        if f.get('kind') in ('club', 'pub', 'lounge', 'bar', 'restobar'): print('famous nightlife with no listing:', f['name'])
        continue
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
    B.append([chunkOf(sum(q[0] for q in ring) / 4, sum(q[1] for q in ring) / 4), [round(v * 100) for q in ring for v in q], 3, 1, tpl[4], '1111', tpl[6], 0, tpl[8], tpl[9], ''])
    b = len(B) - 1; t.polys.append(ring); dirty.add(t.key)
    xs, zs = [q[0] for q in ring], [q[1] for q in ring]
    for i in range(int(min(xs) // 20), int(max(xs) // 20) + 1):
        for j in range(int(min(zs) // 20), int(max(zs) // 20) + 1): t.grid[(i, j)].append(b)
    e = min(range(4), key=lambda q: seg(x, z, *ring[q], *ring[(q + 1) % 4])[0])
    L = math.hypot(ring[(e + 1) % 4][0] - ring[e][0], ring[(e + 1) % 4][1] - ring[e][1])
    d, u = seg(x, z, *ring[e], *ring[(e + 1) % 4])
    return (0, t, b, e, u, L, d, False)
# what's plainly labelled wrong gets its label first, so a gym can't be taken for the restaurant next door
for p in pinsAll:
    if p[2] == 'bar':
        k = next((v for rx, v in NOT_A_BAR if rx.search(p[0])), None)
        if k: p[2] = k; tot['bar pins that were something else'] += 1
# first the old pins and boards of everyone (so a venue's old board doesn't hold the slot it wants), held places left alone
for r in venues:
    name, x, z = r['_name'], r['x'], r['z']; X, Z = x * 100, z * 100
    par = brand_parody(name); alt = par[0] if par else None
    for i in range(int(X // 40000) - 1, int(X // 40000) + 2):
        for j in range(int(Z // 40000) - 1, int(Z // 40000) + 2):
            for pi in pgrid.get((i, j), ()):
                p = pinsAll[pi]
                if pi in deadPins: continue
                d = math.hypot(p[3] - X, p[4] - Z) / 100
                if isOld(p[0], p[2], name, d) or (alt and d < 60 and sameName(alt, p[0]) == 'same'):
                    deadPins.add(pi); tot['old pins removed'] += 1; removed.append(('same place as a listing', name, p[0], p[2], p[3], p[4]))
    for t in around(x, z, 200):
        N = t.T['shopNames']; keep = []
        for s in t.T['shops']:
            P = t.polys[s[0]]
            if s[4] != 0 and s[3] < len(N) and P:
                d = max(0, min(math.hypot(q[0] - x, q[1] - z) for q in P) - 8)
                k = 'food' if N[s[3]][2] in ('food', 'cafe', 'bar', 'pub', 'club', 'lounge', 'restobar', 'hotel') else 'other'
                if isOld(N[s[3]][0], k, name, d) or (alt and d < 60 and sameName(alt, N[s[3]][0]) == 'same'): tot['old boards removed'] += 1; dirty.add(t.key); continue
            keep.append(s)
        t.T['shops'] = keep
# then what's left of the older data: what we know is wrong, what's labelled wrong, and bars nobody lists
Vcore = {core(r['_name'])[0] for r in venues}
Vword = {w for r in venues for w in core(r['_name'])[0] if len(w) >= 5}       # (Doolally here, the Doolally Taproom listed over there: it's over there)
listedElsewhere = lambda n: core(n)[0] in Vcore or (core(n)[0] and all(w in Vword for w in core(n)[0]))
for pi, p in enumerate(pinsAll):
    if pi in deadPins: continue
    n, k = p[0], p[2]
    why = 'known wrong' if n in GONE else 'listed by the hundred' if n in SPAM else 'not a name' if fold(n).strip() in JUNK else None
    if not why and k == 'bar':
        new = None if listedElsewhere(n) else barFate(n)                    # (the same name listed elsewhere: that's where it is)
        if new: p[2] = new; tot['bar pins that were something else'] += 1; continue
        why = 'older bar, no listing'
    if why: deadPins.add(pi); tot[why] += 1; removed.append((why, '', n, k, p[3], p[4])); continue
    for rx, v, frm in REKIND:
        if k in frm and rx.search(n): p[2] = v; tot['pins relabelled'] += 1; break
for key in list(paths):
    t = tile(key); N = t.T['shopNames']; keep = []
    for s in t.T['shops']:
        n = N[s[3]] if s[3] < len(N) else None
        if n and (n[0] in GONE or n[0] in SPAM): tot['wrong boards removed'] += 1; dirty.add(key); continue
        if n and s[4] in (1, 2) and n[2] == 'bar':
            new = None if listedElsewhere(n[0]) else barFate(n[0])
            dirty.add(key)
            if not new: tot['older bar boards removed'] += 1; continue
            s[3] = nameIdx(t, n[0], n[1], TRADE.get(new, 'generic'), n[3]); tot['bar boards that were something else'] += 1
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
            t.T['shops'].append([b, e, slot, nameIdx(t, name, MR.get(kind, name), trade, ''), VERIFIED]); dirty.add(t.key)     # (the name on its listing, chain or not)
            P = t.polys[b]; (ax, az), (bx, bz) = P[e], P[(e + 1) % len(P)]; L = math.hypot(bx - ax, bz - az); ns = max(1, int(L // SLOT)); q = (slot + 0.5) / ns
            r['_d'] = math.hypot(ax + (bx - ax) * q - x, az + (bz - az) * q - z); dist.append(r['_d']); tot['on the building it stands in' if ins else 'on the nearest building'] += 1
    pin = [name, '', kind, round(x * 100), round(z * 100), 1]
    newPins.append(pin); addPin[tkey(x, z)].append(pin)

# ---------------------------------------------------------------- write
kill = {(pinsAll[i][0], pinsAll[i][3], pinsAll[i][4]) for i in deadPins}
# the same name twice on one spot: one pin (the listing's, if it's one of them)
def once(L, log=True):
    keep, grid = [], collections.defaultdict(list)
    for p in L:
        f = strip(p[0]); c = (f, p[3] // 2500, p[4] // 2500)
        if f and any(q[2] == p[2] and math.hypot(q[3] - p[3], q[4] - p[4]) < 2500 for a in (-1, 0, 1) for b in (-1, 0, 1) for q in grid[(f, c[1] + a, c[2] + b)]):
            if log: removed.append(('twice on one spot', '', p[0], p[2], p[3], p[4]))
            continue
        grid[c].append(p); keep.append(p)
    return keep
out = once(newPins + [p for i, p in enumerate(pinsAll) if i not in deadPins])
live = collections.defaultdict(list)
for p in out: live[tkey(p[3] / 100, p[4] / 100)].append(p)
for key in paths:                                                    # (a tile's pins are the citywide list's, cut to the tile)
    t = tile(key); before = t.T.get('pins') or []; pins = live.get(key, [])
    if sorted(map(tuple, before)) != sorted(map(tuple, pins)): dirty.add(key)
    t.T['pins'] = pins
for key in dirty:
    with gzip.open(paths[key], 'wb', 9) as fh: fh.write(json.dumps(cache[key].T, separators=(',', ':'), ensure_ascii=False).encode())
with gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz'), 'wb', 9) as fh: fh.write(json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode())
json.dump(FAM, open(Fp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
with open(os.path.join(ROOT, 'scratch/venue_removed.csv'), 'w', newline='', encoding='utf-8') as fh:
    w = csv.writer(fh); w.writerow(['why', 'because of', 'name', 'kind', 'x', 'z']); w.writerows(sorted(removed))
json.dump([{'name': r['_name'], 'pin': r['_name'], 'kind': r['_kind'], 'x': r['x'], 'z': r['z'], 'door': round(r.get('_d', -1), 1)} for r in venues if tkey(r['x'], r['z']) in paths], open(os.path.join(ROOT, 'scratch/venues_in.json'), 'w', encoding='utf-8'), ensure_ascii=False)
d = sorted(dist)
print(dict(tot)); print('map pins', len(out), '| tiles rewritten', len(dirty))
print('door to coordinates: median %.1f m, within 10 m %d of %d, within 25 m %d, max %.0f m' % (d[len(d) // 2], sum(v <= 10 for v in d), len(d), sum(v <= 25 for v in d), d[-1]))
print('famous moved', moved); print('new buildings', built)
