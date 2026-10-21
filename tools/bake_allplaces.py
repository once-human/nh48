#!/usr/bin/env python3
"""bake_allplaces.py - every real place Overture knows in Pune, for the map and its search:
colleges and universities, schools, hospitals and clinics, temples, mosques and churches, parks, banks and
ATMs, petrol pumps, stations, cinemas, police, offices, restaurants and shops. Points that are only
geocoder fallbacks (5+ listings stacked on one spot) are dropped, near-duplicates merged.
Out: data/pune/pins.json.gz  [[name, marathi, category, x_cm, z_cm, 1], ...]   category: a map filter
usage: python3 tools/bake_allplaces.py"""
import gzip, json, os, re, collections, struct
import pyarrow.parquet as pq

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
base = json.load(gzip.open(os.path.join(ROOT, 'data/pune/base.json.gz')))
m = base['meta']
LAT0, LON0, MLAT, MLON = m['lat0'], m['lon0'], m['mlat'], m['mlon']

def cat_of(bc, tax):
    h = ' '.join([bc or ''] + list((tax or {}).get('hierarchy') or []))
    if re.search(r'police', h): return 'police'
    if re.search(r'college|universit|school|place_of_learning|education|tutoring|preschool', h): return 'college'
    if re.search(r'worship|religious|temple|mosque|church|gurudwara', h): return 'temple'
    if re.search(r'hospital|clinic|health|medical|dental|pharmacy|diagnostic|physician|doctor|care_facility|rehabilitation', h): return 'hospital'
    if re.search(r'bank|atm|credit_union|financial', h): return 'bank'
    if re.search(r'gas_station|fuel|charging', h): return 'fuel'
    if re.search(r'bus_station|train_station|metro|airport|transit|railway|bus_stop|taxi', h): return 'transit'
    if re.search(r'park|garden|playground|zoo|nature|lake|hiking', h): return 'park'
    if re.search(r'movie|cinema|theat|performing_arts|auditorium', h): return 'cinema'
    if re.search(r'historic|monument|landmark|museum|fort|palace|memorial', h): return 'landmark'
    if re.search(r'restaurant|eatery|cafe|coffee|bar\b|pub|bakery|dessert|juice|tea_|food_court|fast_food|sweet|ice_cream|food_and_drink|brewery|lounge', h): return 'food'
    if re.search(r'store|shop|mall|market|retail', h): return 'shop'
    return 'service'

t = pq.read_table(os.path.join(ROOT, 'data/raw/pune/place.parquet'), columns=['names', 'basic_category', 'taxonomy', 'confidence', 'geometry'])
rows = t.to_pylist()
pts = []
stack = collections.Counter()
for r in rows:
    g = r['geometry']
    if not g or len(g) < 21: continue
    lon, lat = struct.unpack('<dd', g[5:21])
    stack[(round(lon, 5), round(lat, 5))] += 1
seen = {}
out = []
for r in rows:
    nm = (r['names'] or {}).get('primary')
    if not nm or (r['confidence'] or 0) < 0.4: continue
    g = r['geometry']
    lon, lat = struct.unpack('<dd', g[5:21])
    if stack[(round(lon, 5), round(lat, 5))] >= 5: continue           # a geocoder fallback, not where it is
    if abs(lat - 18.5203) < 0.0005 and abs(lon - 73.8567) < 0.0005: continue
    x, z = (lon - LON0) * MLON, -(lat - LAT0) * MLAT
    key = re.sub(r'[^a-z0-9]', '', nm.lower())[:40]
    cell = (key, int(x // 60), int(z // 60))
    if cell in seen: continue
    seen[cell] = 1
    out.append([nm.strip(), '', cat_of(r['basic_category'], r['taxonomy']), round(x * 100), round(z * 100), 1])
with gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz'), 'wb', 9) as fh:
    fh.write(json.dumps(out, separators=(',', ':'), ensure_ascii=False).encode())
c = collections.Counter(p[2] for p in out)
print('places', len(out), dict(c.most_common()), os.path.getsize(os.path.join(ROOT, 'data/pune/pins.json.gz')) // 1024, 'KB')
