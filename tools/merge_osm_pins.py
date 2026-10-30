#!/usr/bin/env python3
"""merge_osm_pins.py - add the named places OpenStreetMap knows and Overture doesn't to the map's pins.
In:  data/pune/pins.json.gz (Overture, from bake_allplaces.py), Overpass JSON files (shop / amenity / leisure /
     tourism / historic / craft / healthcare with a name, `out center tags`), data/pune/base.json.gz (projection)
Out: data/pune/pins.json.gz, the same shape: [[name, marathi, category, x_cm, z_cm, source], ...]  source 1 Overture, 2 OSM
A place is the same place if its name matches (letters and digits) within 80 m, or any pin of the same
category sits within 12 m with a name that starts the same. Nothing is invented: every pin is a real listing.
usage: python3 tools/merge_osm_pins.py q1.json q2.json ..."""
import gzip, json, os, re, sys, collections

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PINS = os.path.join(ROOT, 'data/pune/pins.json.gz')
base = json.load(gzip.open(os.path.join(ROOT, 'data/pune/base.json.gz')))
m = base['meta']
LAT0, LON0, MLAT, MLON = m['lat0'], m['lon0'], m['mlat'], m['mlon']
norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())

def cat_of(t):
    a, s, l, tu, h = t.get('amenity', ''), t.get('shop', ''), t.get('leisure', ''), t.get('tourism', ''), t.get('historic', '')
    if a == 'police': return 'police'
    if a in ('hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'veterinary') or t.get('healthcare'): return 'hospital'
    if a in ('bank', 'atm', 'bureau_de_change'): return 'bank'
    if a in ('fuel', 'charging_station'): return 'fuel'
    if a in ('bus_station', 'taxi', 'ferry_terminal') or t.get('public_transport') == 'station': return 'transit'
    if a == 'place_of_worship': return 'temple'
    if a in ('cinema', 'theatre', 'arts_centre'): return 'cinema'
    if a in ('school', 'college', 'university', 'library', 'kindergarten', 'language_school', 'driving_school'): return 'college'
    if a in ('restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream', 'food_court', 'biergarten', 'nightclub'): return 'food'
    if s in ('bakery', 'confectionery', 'pastry', 'deli', 'beverages', 'tea', 'coffee'): return 'food'
    if s: return 'shop'
    if l in ('park', 'garden', 'playground', 'nature_reserve'): return 'park'
    if tu in ('museum', 'attraction', 'gallery', 'viewpoint', 'zoo', 'theme_park') or h: return 'park' if tu == 'zoo' else 'landmark'
    return 'service'

pins = json.load(gzip.open(PINS))
for p in pins:
    if len(p) < 6: p.append(1)
grid = collections.defaultdict(list)
CELL = 80.0
def cell(x, z): return (int(x // CELL), int(z // CELL))
def add(p):
    x, z = p[3] / 100, p[4] / 100
    grid[cell(x, z)].append((norm(p[0]), p[2], x, z))
for p in pins: add(p)

def dupe(name, cat, x, z):
    n = norm(name); cx, cz = cell(x, z)
    for i in (cx - 1, cx, cx + 1):
        for j in (cz - 1, cz, cz + 1):
            for (qn, qc, qx, qz) in grid.get((i, j), ()):
                d = ((qx - x) ** 2 + (qz - z) ** 2) ** 0.5
                if qn == n and d < 80: return True
                if qc == cat and d < 12 and (qn[:6] == n[:6]): return True
    return False

added = collections.Counter(); seen = 0
for f in sys.argv[1:]:
    data = json.load(open(f))
    for e in data.get('elements', []):
        t = e.get('tags') or {}
        nm = (t.get('name:en') or t.get('name') or '').strip()
        if not nm or len(nm) < 2: continue
        lat = e.get('lat') or (e.get('center') or {}).get('lat'); lon = e.get('lon') or (e.get('center') or {}).get('lon')
        if lat is None or lon is None: continue
        seen += 1
        x, z = (lon - LON0) * MLON, -(lat - LAT0) * MLAT
        cat = cat_of(t)
        if dupe(nm, cat, x, z): continue
        mr = (t.get('name:mr') or '').strip()
        p = [nm, mr, cat, round(x * 100), round(z * 100), 2]
        pins.append(p); add(p); added[cat] += 1

with gzip.open(PINS, 'wb', 9) as fh:
    fh.write(json.dumps(pins, separators=(',', ':'), ensure_ascii=False).encode())
print('osm places seen', seen, 'added', sum(added.values()), dict(added.most_common()), 'total', len(pins), os.path.getsize(PINS) // 1024, 'KB')
