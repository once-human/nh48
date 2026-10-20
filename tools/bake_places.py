# Places layer for the map screen, search and arrival cards.
#
#   python3 tools/bake_places.py     (after bake_map.py and bake_shops.py; rewrites data/map.json)
#
# landmarks: [[english, marathi, x_cm, z_cm, blurb, kind]]  real names, located from OSM by name
# places:    [[english, marathi, category, x_cm, z_cm]]      police, hospital, fuel, transit, park,
#                                                            temple, college, cinema, bank
# Shops and restaurants are not repeated here: the map reads them from `shops` so the names match
# the boards in the street.
import json, math, os, re, sys, collections
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MAP = os.path.join(ROOT, 'data/map.json')
OSM = os.path.join(ROOT, 'data/raw/merged.json')
M = json.load(open(MAP))
meta = M['meta']
LAT0, LON0, MLAT, MLON = meta['lat0'], meta['lon0'], meta['mlat'], meta['mlon']
def proj(lat, lon): return ((lon - LON0) * MLON, -(lat - LAT0) * MLAT)
vis = [v / 100 for v in meta['vis']]
def inside(x, z): return vis[0] < x < vis[2] and vis[1] < z < vis[3]

D = json.load(open(OSM))
P = {int(k): (v[0], v[1]) for k, v in D['nodes'].items()}
feats = []      # (name, tags, x, z, area)
for k, (lat, lon, t) in D['nodes'].items():
    if t.get('name'):
        x, z = proj(lat, lon); feats.append((t['name'], t, x, z, 0.0))
for k, w in D['ways'].items():
    t = w.get('tags', {})
    if not t.get('name') or 'highway' in t: continue
    pts = [proj(*P[n]) for n in w['nd'] if n in P]
    if len(pts) < 3: continue
    a = 0.0; cx = cz = 0.0
    for i in range(len(pts)):
        (x0, z0), (x1, z1) = pts[i], pts[(i + 1) % len(pts)]
        c = x0 * z1 - x1 * z0; a += c; cx += (x0 + x1) * c; cz += (z0 + z1) * c
    if abs(a) > 1e-6: cx /= 3 * a; cz /= 3 * a
    else: cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
    feats.append((t['name'], t, cx, cz, abs(a) / 2))
feats = [f for f in feats if inside(f[2], f[3])]
print('named OSM features in view', len(feats))

# (english, marathi, pattern on the OSM name, blurb or '', kind)
LANDMARKS = [
    ('Shaniwar Wada', 'शनिवारवाडा', r'shaniwar ?wada', 'Seat of the Peshwas, finished in 1732. Burned in 1828; the walls and gates still stand.', 'fort'),
    ('Dagdusheth Halwai Ganpati', 'दगडूशेठ हलवाई गणपती', r'dagdu ?sheth', "Pune's most visited Ganpati temple.", 'temple'),
    ('Kasba Ganpati', 'कसबा गणपती', r'kasba ganpati', "Pune's gramdaivat, the city's presiding deity.", 'temple'),
    ('Lal Mahal', 'लाल महाल', r'lal mahal', "Shivaji Maharaj's childhood home, rebuilt in the 1980s.", 'heritage'),
    ('Vishrambaug Wada', 'विश्रामबाग वाडा', r'^vishram ?ba(u)?g ?wada$', 'Mansion built for Bajirao II, the last Peshwa.', 'heritage'),
    ('Tulshibaug Ram Mandir', 'तुळशीबाग राम मंदिर', r'tul(s|sh)i ?ba(u)?g', 'Ram temple in the middle of the Tulshibaug market lanes.', 'temple'),
    ('Mahatma Phule Mandai', 'महात्मा फुले मंडई', r'phule mandai|mahatma phule (market|mandai)|reay market', 'The old Reay Market, opened in 1886.', 'market'),
    ('Fergusson College', 'फर्ग्युसन महाविद्यालय', r'^fergusson college$|fergusson college \(', 'Founded in 1885 by the Deccan Education Society.', 'college'),
    ('College of Engineering Pune', 'अभियांत्रिकी महाविद्यालय पुणे', r'^college of engineering$', 'COEP, founded in 1854.', 'college'),
    ('Balgandharva Rangmandir', 'बालगंधर्व रंगमंदिर', r'bal ?gandharva', "Pune's best-known Marathi theatre.", 'theatre'),
    ('Pune Junction', 'पुणे जंक्शन', r'^pune junction$', "The city's main railway station.", 'station'),
    ('Shivajinagar Station', 'शिवाजीनगर स्थानक', r'shivaji ?nagar (railway )?station', 'Suburban station on the Lonavala line.', 'station'),
    ('Sassoon Hospital', 'ससून रुग्णालय', r'sassoon', 'Government hospital, opened in 1867.', 'hospital'),
    ('Raja Dinkar Kelkar Museum', 'राजा दिनकर केळकर संग्रहालय', r'kelkar museum', "One man's collection of everyday Indian objects.", 'museum'),
    ('Omkareshwar Temple', 'ओंकारेश्वर मंदिर', r'omkareshwar', 'Shiva temple on the bank of the Mutha.', 'temple'),
    ('Tilak Smarak Mandir', 'टिळक स्मारक मंदिर', r'tilak smarak', '', 'theatre'),
    ('Ohel David Synagogue', 'लाल देऊळ', r'ohel david|lal deval', 'The Lal Deval, a red-brick synagogue from 1867.', 'heritage'),
    ('Osho Teerth Park', 'ओशो तीर्थ उद्यान', r'osho teerth', '', 'park'),
    ('Bund Garden', 'बंड गार्डन', r'^bund garden$', '', 'park'),
    ('Council Hall', 'कौन्सिल हॉल', r'^council hall$', '', 'heritage'),
    ('Deccan Gymkhana', 'डेक्कन जिमखाना', r'^deccan gymkhana$|deccan gymkhana club', '', 'sport'),
    ('Sambhaji Park', 'संभाजी उद्यान', r'^sambhaji (park|udyan)', '', 'park'),
    ('Appa Balwant Chowk', 'अप्पा बळवंत चौक', r'appa balwant', "Pune's book market.", 'market'),
    ('Nana Wada', 'नाना वाडा', r'nana wada', '', 'heritage'),
    ('Bhide Wada', 'भिडे वाडा', r'bhide wada', 'Where Savitribai and Jyotirao Phule opened a school for girls in 1848.', 'heritage'),
    ("St. Mary's Church", 'सेंट मेरी चर्च', r"st\.? ?mary'?s church", '', 'church'),
    ('Poona Club', 'पूना क्लब', r'poona club', '', 'sport'),
    ('Pune Station Bus Stand', 'पुणे स्टेशन बस स्थानक', r'pune station (bus|st) (stand|depot)|msrtc.*pune station', '', 'station'),
    ('Shivajinagar Bus Stand', 'शिवाजीनगर बस स्थानक', r'shivaji ?nagar (bus|st) (stand|depot)', '', 'station'),
    ('Royal Connaught Boat Club', 'रॉयल कॅनॉट बोट क्लब', r'^royal connaught boat club$', '', 'sport'),
    ('Agriculture College', 'कृषी महाविद्यालय', r'college of agriculture', '', 'college'),
]
landmarks = []
for en, mr, pat, blurb, kind in LANDMARKS:
    rx = re.compile(pat, re.I)
    hits = [f for f in feats if rx.search(f[0])]
    if not hits: continue
    f = max(hits, key=lambda f: f[4])          # the biggest named area wins over a stray node
    if not mr: mr = f[1].get('name:mr', '')
    landmarks.append([en, mr, round(f[2] * 100), round(f[3] * 100), blurb, kind])
print('landmarks found', len(landmarks), 'of', len(LANDMARKS), [l[0] for l in landmarks])

def pcat(t):
    a = t.get('amenity'); sh = t.get('shop')
    if a == 'police': return 'police'
    if a in ('hospital', 'clinic') and 'hospital' in t.get('name', '').lower() or a == 'hospital': return 'hospital'
    if a == 'fuel': return 'fuel'
    if a in ('bus_station',) or t.get('railway') in ('station', 'halt') or t.get('public_transport') == 'station': return 'transit'
    if t.get('leisure') in ('park', 'garden'): return 'park'
    if a == 'place_of_worship': return 'temple'
    if a in ('college', 'university'): return 'college'
    if a in ('cinema', 'theatre'): return 'cinema'
    return None
places, seen = [], set()
lm_names = {l[0].lower() for l in landmarks}
for name, t, x, z, area in sorted(feats, key=lambda f: -f[4]):
    c = pcat(t)
    if not c: continue
    key = (name.lower(), c)
    if key in seen or name.lower() in lm_names: continue
    seen.add(key)
    places.append([name, t.get('name:mr', ''), c, round(x * 100), round(z * 100)])
print('places', len(places), collections.Counter(p[2] for p in places))
M['landmarks'] = landmarks
M['places'] = places
json.dump(M, open(MAP, 'w'), separators=(',', ':'), ensure_ascii=False)
print('wrote', os.path.getsize(MAP) // 1024, 'KB')
