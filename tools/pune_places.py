#!/usr/bin/env python3
"""pune_places.py - one clean list of Pune's real places, where they really are.

Sources: OpenStreetMap (data/raw/osm/pune_osm.json from tools/osm_pune.py, hand-placed by mappers: trusted)
and Overture Maps places (data/raw/pune/place.parquet: far more of them, but many listings are geocoded to
the wrong spot). An Overture listing is kept only when it is believable:
  * confidence >= 0.75, or >= 0.5 with a street address
  * not a geocoder fallback (5+ listings stacked on one point, the city centroid)
  * its pin code agrees with where it is: within ~3.5 km of where the city's well-placed listings with that
    pin code are (pin codes in Pune span a few km)
  * a locality it names ("FC Road", "Baner", "Hinjewadi"...) agrees with where it is: within ~3 km of where
    the well-placed listings naming that locality are
  * not a duplicate of an OSM place (same name within 250 m) or of a better Overture listing (80 m)
Out: data/raw/osm/places_clean.json  [{x, z, raw, cat (board trade or null), pin (map category), src, conf, board}]
usage: python3 tools/pune_places.py"""
import json, os, re, math, collections, statistics, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import duckdb
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LAT0, LON0, MLAT, MLON = 18.527, 73.865, 110686.0, 105589.0
def proj(lat, lon): return ((lon - LON0) * MLON, -(lat - LAT0) * MLAT)
OUT = os.path.join(ROOT, 'data/raw/osm/places_clean.json')

# ---------------------------------------------------------------- trades (for shop boards) and map categories
def osm_trade(t):
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
def osm_pin(t):
    a = t.get('amenity')
    if a == 'police': return 'police'
    if a in ('college', 'university', 'school', 'kindergarten'): return 'college'
    if a == 'place_of_worship': return 'temple'
    if a in ('hospital', 'clinic', 'doctors', 'dentist', 'pharmacy') or t.get('healthcare'): return 'hospital'
    if a in ('bank', 'atm'): return 'bank'
    if a in ('fuel', 'charging_station'): return 'fuel'
    if a in ('bus_station',) or t.get('railway'): return 'transit'
    if t.get('leisure') in ('park', 'garden', 'playground', 'nature_reserve'): return 'park'
    if a in ('cinema', 'theatre', 'arts_centre'): return 'cinema'
    if t.get('historic') or t.get('tourism') in ('attraction', 'museum', 'viewpoint'): return 'landmark'
    if a in ('restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'ice_cream', 'food_court'): return 'food'
    if t.get('shop'): return 'shop'
    return 'service'
sys_path = os.path.dirname(os.path.abspath(__file__))
from bake_shops_cats import TAX, BASIC, kw_cat, ovt_pin    # noqa: E402

# ---------------------------------------------------------------- Pune localities named in names and addresses
LOCALITIES = ['fc road', 'fergusson college', 'jm road', 'jangli maharaj', 'deccan', 'shivajinagar', 'kothrud', 'karve road', 'erandwane', 'erandawane',
    'prabhat road', 'law college', 'model colony', 'aundh', 'baner', 'balewadi', 'pashan', 'sus road', 'bavdhan', 'warje', 'karve nagar', 'sinhagad road',
    'dhayari', 'katraj', 'kondhwa', 'nibm', 'wanowrie', 'hadapsar', 'magarpatta', 'kharadi', 'viman nagar', 'kalyani nagar', 'koregaon park', 'yerwada',
    'yerawada', 'vishrantwadi', 'dhanori', 'lohegaon', 'wagholi', 'camp', 'mg road', 'east street', 'swargate', 'bibwewadi', 'market yard', 'sahakar nagar',
    'parvati', 'sadashiv peth', 'narayan peth', 'shaniwar peth', 'budhwar peth', 'kasba peth', 'rasta peth', 'nana peth', 'bhavani peth', 'ganesh peth',
    'somwar peth', 'mangalwar peth', 'raviwar peth', 'shukrawar peth', 'guruwar peth', 'tilak road', 'laxmi road', 'bajirao road', 'kumthekar',
    'hinjewadi', 'hinjawadi', 'wakad', 'pimple saudagar', 'pimple nilakh', 'pimpri', 'chinchwad', 'nigdi', 'akurdi', 'ravet', 'punawale', 'tathawade',
    'thergaon', 'bhosari', 'moshi', 'chikhali', 'dapodi', 'khadki', 'kirkee', 'bopodi', 'sangvi', 'aundh road', 'ganeshkhind', 'university road',
    'senapati bapat', 'sb road', 'gokhale nagar', 'model colony', 'lullanagar', 'salunke vihar', 'fatima nagar', 'ghorpadi', 'mundhwa', 'keshav nagar',
    'undri', 'pisoli', 'handewadi', 'manjri', 'ambegaon', 'narhe', 'vadgaon', 'anand nagar', 'nanded city', 'kothrud depot', 'paud road', 'bhusari colony']

def norm(s): return re.sub(r'[^a-z0-9]', '', (s or '').lower())

# ---------------------------------------------------------------- OSM
D = json.load(open(os.path.join(ROOT, 'data/raw/osm/pune_osm.json')))
out = []
for p in D['pois']:
    t = p['t']; nm = t.get('name')
    if not nm: continue
    x, z = proj(p['lat'], p['lon'])
    tr = osm_trade(t)
    out.append(dict(x=round(x, 2), z=round(z, 2), raw=nm, mr=t.get('name:mr', ''), cat=tr, pin=osm_pin(t), src=1, conf=1.0,
                    board=tr is not None and t.get('amenity') not in ('police', 'hospital', 'place_of_worship', 'bus_station', 'parking')))
n_osm = len(out)
print('osm places', n_osm)

# ---------------------------------------------------------------- Overture
con = duckdb.connect(); con.sql('load spatial')
rows = con.sql("""select ST_X(geometry), ST_Y(geometry), names.primary, basic_category, taxonomy.primary, taxonomy.hierarchy, confidence,
                         addresses[1].freeform, addresses[1].postcode
                  from 'data/raw/pune/place.parquet' where names.primary is not null and confidence >= 0.4""").fetchall()
stack = collections.Counter((round(r[0], 5), round(r[1], 5)) for r in rows)
def fallback(lon, lat): return (abs(lat - 18.5203) < 0.0005 and abs(lon - 73.8567) < 0.0005) or stack[(round(lon, 5), round(lat, 5))] >= 5
good = [r for r in rows if not fallback(r[0], r[1])]
print('overture listings', len(rows), 'after fallbacks', len(good))
# where each pin code and each locality really is: medians of the confident listings
pcs, locs = collections.defaultdict(list), collections.defaultdict(list)
def loc_of(text):
    low = (text or '').lower()
    best = None
    for L in LOCALITIES:
        if re.search(r'(?<![a-z])' + re.escape(L) + r'(?![a-z])', low) and (best is None or len(L) > len(best)): best = L
    return best
for lon, lat, nm, bc, tx, hier, conf, ff, pc in good:
    if conf < 0.8: continue
    if pc and re.fullmatch(r'41\d{4}', pc): pcs[pc].append((lon, lat))
    L = loc_of(ff)
    if L: locs[L].append((lon, lat))
centre = lambda pts: (statistics.median(p[0] for p in pts), statistics.median(p[1] for p in pts))
PC = {k: centre(v) for k, v in pcs.items() if len(v) >= 8}
LC = {k: centre(v) for k, v in locs.items() if len(v) >= 6}
def km(a, b): return math.hypot((a[0] - b[0]) * MLON, (a[1] - b[1]) * MLAT) / 1000
drop = collections.Counter()
ovt = []
for lon, lat, nm, bc, tx, hier, conf, ff, pc in good:
    # nightlife is where wrong spots hurt most (people go looking for the bar): stricter for bars, pubs, clubs
    night = (bc or '') in ('bar', 'pub', 'night_club', 'nightclub', 'lounge', 'cocktail_bar', 'wine_bar', 'beer_bar', 'brewery', 'sports_bar') or bool(re.search(r'\b(bar|pub|lounge|brew|club|taproom)\b', (nm or '').lower()))
    if not (conf >= (0.82 if night else 0.75) or (conf >= (0.65 if night else 0.5) and ff)): drop['weak'] += 1; continue
    if pc and pc in PC and km((lon, lat), PC[pc]) > (2.5 if night else 3.5): drop['pin code elsewhere'] += 1; continue
    L = loc_of(nm) or loc_of(ff)
    if L and L in LC and km((lon, lat), LC[L]) > (1.8 if night else 3.0): drop['locality elsewhere'] += 1; continue
    x, z = proj(lat, lon)
    cat = TAX.get(tx) or BASIC.get(bc)
    if cat == '?': cat = kw_cat(nm)
    ovt.append(dict(x=round(x, 2), z=round(z, 2), raw=nm.strip(), mr='', cat=cat, pin=ovt_pin(bc, hier), src=2, conf=round(conf, 3), board=cat is not None))
# ---------------------------------------------------------------- famous places: one real location
# Overture repeats famous names at wrong spots ("Sassoon General Hospital" in Shivajinagar). Where OpenStreetMap
# has the place, an Overture listing of the same name more than 1.5 km from it goes.
FAMOUS = [r'(b ?j medical college and )?(david )?sassoon( general)? hospital', r'shaniwar ?wada( fort)?',
    r'(shreemant |shrimant )?dagdu ?sheth( halwai)?( ganpati)?( temple| mandir)?', r'aga ?khan palace', r'parvati( hill| temple| mandir| devasthan)+',
    r'(shri |sri )?saras ?baug( ganpati| ganesh)?( temple| mandir| garden)?', r'fergusson college', r'(coep|college of engineering pune|coep technological university)',
    r'(savitribai phule pune university|university of pune|pune university|sppu)( main building)?', r'lal mahal', r'(shri )?kasba ganpati( temple| mandir)?',
    r'tulshi ?baug( ram mandir)?', r'(mahatma phule )?mandai', r'(shri )?chat(u|ur)sh?r(i|u)ng(i|hi)( devi)?( temple| mandir)?', r'(mahadji )?shinde ch?hatri',
    r'pataleshwar( cave)?( temple| caves)?', r'raja dinkar kelkar museum', r'vishram ?b(a|au)g ?wada', r'osho (international meditation resort|ashram|teerth park)',
    r'pune (railway station|junction)', r'phoenix market ?city', r'empress (botanical )?garden', r'(rajiv gandhi zoological park|katraj zoo)',
    r'bal ?gandharva (rang ?mandir|theatre)', r'jehangir hospital', r'(deenanath|dinanath) mangeshkar hospital', r'kem hospital', r'ruby hall clinic',
    r'omkareshwar( temple| mandir)?', r'national war museum', r'pu ?la deshpande (garden|udyan)', r'sambhaji (park|udyan)', r'(chhatrapati )?shivaji (stadium|park)']
FAMOUS = [re.compile(x) for x in FAMOUS]
def fnorm(n):
    n = re.sub(r'[^a-z0-9]+', ' ', (n or '').lower()).strip()
    return re.sub(r'( pune| pune maharashtra| maharashtra)+$', '', n).strip()
ref = collections.defaultdict(list)
for c in out:
    k = fnorm(c['raw'])
    for i, rx in enumerate(FAMOUS):
        if rx.fullmatch(k): ref[i].append((c['x'], c['z']))
kept = []
for c in ovt:
    k = fnorm(c['raw']); bad = False
    for i, rx in enumerate(FAMOUS):
        if ref[i] and rx.fullmatch(k) and min(math.hypot(c['x'] - x, c['z'] - z) for x, z in ref[i]) > 1500: bad = True; break
    if bad: drop['famous name, wrong place'] += 1
    else: kept.append(c)
ovt = kept
print('overture dropped', dict(drop), 'kept', len(ovt))
# ---------------------------------------------------------------- duplicates
grid = collections.defaultdict(list)
for c in out: grid[(int(c['x'] // 250), int(c['z'] // 250))].append(c)
ovt.sort(key=lambda c: -c['conf'])
dups = 0
for c in ovt:
    k = norm(c['raw']); gx, gz = int(c['x'] // 250), int(c['z'] // 250); dup = False
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            for o in grid[(gx + dx, gz + dz)]:
                d = math.hypot(o['x'] - c['x'], o['z'] - c['z'])
                ok = norm(o['raw'])
                if (ok == k and d < (400 if o['src'] == 1 else 80)) or (o['src'] == 1 and d < 120 and len(k) > 5 and (k in ok or ok in k)):
                    dup = o; break
            if dup: break
        if dup: break
    if dup:
        dups += 1
        if dup['src'] == 1 and dup['cat'] in (None, 'generic') and c['cat']: dup['cat'] = c['cat']; dup['board'] = True
        continue
    grid[(gx, gz)].append(c); out.append(c)
print('duplicates merged', dups, '| places', len(out), '| OSM', n_osm, '| Overture', len(out) - n_osm)
json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')
