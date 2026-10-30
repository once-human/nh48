#!/usr/bin/env python3
"""doors.py - every real place on its building, with a door, and every shopping street lined with shops.

1. Places: data/pune/pins.json.gz (Overture + OpenStreetMap). Wherever OSM lists the same place (same name within
   300 m) OSM's spot and OSM's kind win: OSM is placed by hand on the building, and it knows a pub is a pub
   (amenity=bar/pub/nightclub), where Overture's geocoder often drops a listing on the road outside.
   OSM files: Overpass JSON (`out center tags`), given as arguments.
2. Each 1 km tile: a place goes on the wall of the building it stands in, or of the nearest building within 40 m
   (a street-facing wall first), in the free shop slot nearest it; its board carries its real name (national chains
   parodied, shopnames.py) and its map pin moves to that door, so the pin, the board and the way in are one spot.
   A shop or an office with no building within 40 m is dropped from the map: the listing is somewhere else.
   Parks, landmarks, stations, temples, colleges, police, pumps keep their own spot (they aren't shopfronts).
3. Frontages that nobody lists, on streets that sell: trade boards with no name (Kirana, Medical, Amruttulya,
   Xerox...), following what the real shops around them sell. They're not on the map; no names are invented.
Out: data/pune/t_*.json.gz (buildings' wall flags, shopNames, shops, pins) and data/pune/pins.json.gz.
usage: python3 tools/doors.py osm1.json [osm2.json ...]"""
import gzip, json, glob, math, os, re, sys, collections, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shopnames import board_name

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SLOT, SNAP_R = 3.6, 40.0
NO_BOARD = {6, 7, 8, 10, 11, 13}                  # sheds, temples, ruins...: no shop boards on them
FILL_STYLE = {1: 0.95, 2: 0.9, 0: 0.55, 9: 0.5}    # commercial, old city, apartments, glass: how often a street wall has shops
KEEP_SPOT = {'park', 'landmark', 'transit', 'temple', 'college', 'police', 'fuel', 'cinema'}
nslots = lambda L: max(1, int(math.floor(L / SLOT)))
norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())

base = json.load(gzip.open(os.path.join(ROOT, 'data/pune/base.json.gz')))['meta']
LAT0, LON0, MLAT, MLON = base['lat0'], base['lon0'], base['mlat'], base['mlon']

# ---------------------------------------------------------------- what a place is (its board's trade)
BARS = r'\b(bar|pub|brew\w*|taproom|tap room|lounge|night ?club|club house|cocktail|beer|wine|whisky|liquor|toit|effingut|doolally|high spirits|kiki|hard rock|independence brewing|swig)\b'
def trade_of(name, cat, osm=None):
    n = (name or '').lower()
    t = osm or {}
    a, s = t.get('amenity', ''), t.get('shop', '')
    if a in ('bar', 'pub', 'nightclub', 'biergarten') or s in ('alcohol', 'wine', 'beverages') and 'beer' in n: return 'bar'
    if a in ('cafe',): return 'cafe'
    if a in ('ice_cream',): return 'icecream'
    if s == 'bakery': return 'bakery'
    if s in ('confectionery', 'pastry'): return 'sweets'
    if s in ('clothes', 'tailor', 'fabric', 'boutique', 'fashion'): return 'clothes'
    if s == 'shoes': return 'shoes'
    if s == 'jewelry': return 'jewellery'
    if s in ('mobile_phone', 'telecommunication'): return 'mobile'
    if s in ('electronics', 'computer', 'appliance'): return 'electronics'
    if s in ('books', 'stationery', 'copyshop'): return 'books'
    if s == 'optician': return 'optician'
    if s in ('supermarket', 'convenience', 'greengrocer', 'dairy', 'grocery', 'general', 'butcher'): return 'grocery'
    if a == 'pharmacy' or s == 'chemist': return 'pharmacy'
    if s in ('hardware', 'doityourself', 'paint', 'electrical', 'trade'): return 'hardware'
    if s in ('hairdresser', 'beauty') or a == 'beauty': return 'salon'
    if s in ('car_repair', 'tyres', 'motorcycle_repair') or a in ('car_wash',): return 'garage'
    if re.search(BARS, n): return 'bar'
    if cat == 'food' or a in ('restaurant', 'fast_food', 'food_court'):
        if re.search(r'caf[eé]|coffee|chai|tea\b|amrut+ul+ya|tapri', n): return 'cafe'
        if re.search(r'bakery|bakers|cake', n): return 'bakery'
        if re.search(r'sweet|mithai|chitale|halwai|farsan', n): return 'sweets'
        if re.search(r'ice ?cream|kulfi|juice|mastani|shake', n): return 'icecream'
        return 'food'
    if cat == 'bank': return 'atm' if re.search(r'\batm\b', n) else 'bank'
    if cat == 'hospital': return 'pharmacy' if re.search(r'pharma|chemist|medical (store|&|and)|drug|medico', n) else 'clinic'
    if re.search(r'saree|sari|cloth|fashion|garment|boutique|textile|tailor|wear\b|collection', n): return 'clothes'
    if re.search(r'shoe|footwear|chappal', n): return 'shoes'
    if re.search(r'jewel|saraf|ornament', n): return 'jewellery'
    if re.search(r'mobile|cellular|phone', n): return 'mobile'
    if re.search(r'electronic|computer|laptop|appliance', n): return 'electronics'
    if re.search(r'book|stationer|xerox|print', n): return 'books'
    if re.search(r'optic|optician|lens|spectacle|eye ?wear', n): return 'optician'
    if re.search(r'kirana|grocer|provision|super ?market|mart\b|dairy|vegetable|fruit|general store', n): return 'grocery'
    if re.search(r'medical|pharma|chemist', n): return 'pharmacy'
    if re.search(r'hardware|paint|plywood|electrical|sanitary|tiles', n): return 'hardware'
    if re.search(r'salon|parlou?r|hair|beauty|spa\b|unisex', n): return 'salon'
    if re.search(r'garage|motor|auto ?works|service (centre|center|station)|tyre|car care|car wash|puncture', n): return 'garage'
    if re.search(r'\bhotel\b|lodge|\binn\b|residency|guest ?house|\bstay', n): return 'hotel'
    if re.search(r'travel|tours', n): return 'travel'
    return 'generic'
# what the map files it under (the pin's category field): a trade where the game has a place for it
PIN_TRADE = {'bar', 'cafe', 'bakery', 'sweets', 'icecream', 'clothes', 'shoes', 'jewellery', 'mobile', 'electronics', 'books', 'optician', 'grocery', 'pharmacy', 'salon', 'garage', 'atm'}

# ---------------------------------------------------------------- places, with OSM's spot where it knows them
pins = json.load(gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz')))
osm = []
for f in sys.argv[1:]:
    for e in json.load(open(f)).get('elements', []):
        t = e.get('tags') or {}
        nm = (t.get('name:en') or t.get('name') or '').strip()
        lat = e.get('lat') or (e.get('center') or {}).get('lat'); lon = e.get('lon') or (e.get('center') or {}).get('lon')
        if not nm or lat is None: continue
        osm.append((norm(nm), (lon - LON0) * MLON, -(lat - LAT0) * MLAT, t))
og = collections.defaultdict(list)
for o in osm: og[(int(o[1] // 300), int(o[2] // 300))].append(o)
moved = 0
for p in pins:
    x, z, k = p[3] / 100, p[4] / 100, norm(p[0])
    best, bd = None, 300.0
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for o in og.get((int(x // 300) + i, int(z // 300) + j), ()):
                if o[0] == k or (len(k) >= 8 and o[0].startswith(k[:10])):
                    d = math.hypot(o[1] - x, o[2] - z)
                    if d < bd: bd, best = d, o
    p.append(best[3] if best else None)          # [6]: OSM tags
    if best and bd > 6: p[3], p[4] = round(best[1] * 100), round(best[2] * 100); moved += 1
# the same place listed twice a few metres apart ("Effingut" and "Effingut Brewerkz"): one pin, the fuller name
pins.sort(key=lambda p: -len(p[0]))
seen, uniq = collections.defaultdict(list), []
for p in pins:
    k, x, z = norm(p[0]), p[3] / 100, p[4] / 100
    cell = (int(x // 80), int(z // 80))
    dup = False
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            for (k2, x2, z2) in seen[(cell[0] + i, cell[1] + j)]:
                if (k2.startswith(k) or k.startswith(k2)) and len(min(k, k2, key=len)) >= 5 and math.hypot(x2 - x, z2 - z) < 80: dup = True
    if dup: continue
    seen[cell].append((k, x, z)); uniq.append(p)
print('places', len(pins), 'after duplicates', len(uniq), 'moved to OSM spot', moved, flush=True)
for p in uniq: p.append(trade_of(p[0], p[2], p[6]))        # [7]: trade
byTile = collections.defaultdict(list)
for p in uniq: byTile[(int((p[3] + 2000000) // 100000), int((p[4] + 2400000) // 100000))].append(p)

# ---------------------------------------------------------------- generic boards for the frontages nobody lists
GENERIC = [('grocery', 'Kirana & General Stores', 'किराणा भांडार', 14), ('pharmacy', 'Medical & General Stores', 'मेडिकल अँड जनरल स्टोअर्स', 8),
  ('cafe', 'Amruttulya', 'अमृततुल्य', 7), ('food', 'Vada Pav Centre', 'वडापाव सेंटर', 6), ('food', 'Pure Veg Restaurant', 'शुद्ध शाकाहारी उपाहारगृह', 5),
  ('books', 'Xerox & Stationery', 'झेरॉक्स व स्टेशनरी', 6), ('mobile', 'Mobile Repairing & Recharge', 'मोबाईल रिपेअरिंग', 7), ('clothes', 'Ladies & Gents Tailor', 'टेलर', 5),
  ('clothes', 'Readymade Garments', 'रेडिमेड कपडे', 5), ('hardware', 'Hardware & Paints', 'हार्डवेअर व पेंट्स', 5), ('hardware', 'Electricals', 'इलेक्ट्रिकल्स', 4),
  ('salon', 'Hair Cutting Salon', 'केशकर्तनालय', 6), ('bakery', 'Bakery', 'बेकरी', 4), ('sweets', 'Sweet Mart & Farsan', 'स्वीट मार्ट', 4),
  ('grocery', 'Dairy & Milk Centre', 'दूध डेअरी', 4), ('grocery', 'Fruits & Vegetables', 'फळे व भाजीपाला', 3), ('generic', 'Laundry & Ironing', 'लॉन्ड्री व इस्त्री', 3),
  ('shoes', 'Footwear', 'पादत्राणे', 3), ('clinic', 'Clinic', 'दवाखाना', 3), ('generic', 'Two Wheeler Garage', 'टू व्हीलर गॅरेज', 2), ('generic', 'Paan Shop', 'पान शॉप', 3),
  ('electronics', 'Electronics & Repairs', 'इलेक्ट्रॉनिक्स', 2), ('grocery', 'Chicken & Mutton', 'चिकन मटण', 2), ('generic', 'Cycle Mart', 'सायकल मार्ट', 1)]

# ---------------------------------------------------------------- geometry
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

tot = collections.Counter(); allpins = []; done = set()
rng = random.Random(48)
for f in sorted(glob.glob(os.path.join(ROOT, 'data/pune/t_*.json.gz'))):
    T = json.load(gzip.open(f))
    ti, tj, rect = T['tile']; done.add((ti, tj))
    B = T['buildings']
    polys, walls, grid = [], [], collections.defaultdict(list)
    for bi, b in enumerate(B):
        r = b[1]; P = [(r[2 * k] / 100, r[2 * k + 1] / 100) for k in range(len(r) // 2)]
        polys.append(P); fl = b[5]; ws = []
        for k in range(len(P)):
            (ax, az), (bx, bz) = P[k], P[(k + 1) % len(P)]
            L = math.hypot(bx - ax, bz - az)
            # which way is out: a step off the middle of the wall that isn't inside the building
            mx, mz = (ax + bx) / 2, (az + bz) / 2; nx, nz = ((bz - az) / L, -(bx - ax) / L) if L > 0 else (0, 0)
            if len(P) >= 3 and inside(mx + nx * 0.3, mz + nz * 0.3, P): nx, nz = -nx, -nz
            ws.append((ax, az, bx, bz, L, fl[k] if k < len(fl) else '0', nx, nz))
        walls.append(ws)
        if len(P) >= 3:
            xs, zs = [q[0] for q in P], [q[1] for q in P]
            for i in range(int(min(xs) // 20), int(max(xs) // 20) + 1):
                for j in range(int(min(zs) // 20), int(max(zs) // 20) + 1): grid[(i, j)].append(bi)
    def near(x, z, R):
        out = set()
        for i in range(int((x - R) // 20), int((x + R) // 20) + 1):
            for j in range(int((z - R) // 20), int((z + R) // 20) + 1): out.update(grid.get((i, j), ()))
        return out
    def door(bi, ei, k):
        ax, az, bx, bz, L, fl, nx, nz = walls[bi][ei]; ns = nslots(L); t = (k + 0.5) / ns
        return ax + (bx - ax) * t + nx * 0.9, az + (bz - az) * t + nz * 0.9
    occupied = {}
    names, nidx = [], {}
    def nameIdx(key):
        if key not in nidx: nidx[key] = len(names); names.append(list(key))
        return nidx[key]
    shops = []
    # the boards already here (real ones, from the earlier bake): keep them, know where their doors are
    oldNames = T.get('shopNames') or []
    boardAt = collections.defaultdict(list)
    for s in T.get('shops') or []:
        bi, ei, k, ni, src = s
        if bi >= len(B) or ei >= len(walls[bi]) or not oldNames[ni:ni + 1]: continue
        occupied[(bi, ei, k)] = True
        n = oldNames[ni]; ni2 = nameIdx(tuple(n)); shops.append([bi, ei, k, ni2, src])
        dx, dz = door(bi, ei, k); boardAt[norm(n[0])[:8]].append((dx, dz))
    # the real places
    P = byTile.get((ti, tj), [])
    P.sort(key=lambda p: -(1 if p[6] else 0))                     # OSM-known first: they're where they say
    tp = []
    for p in P:
        x, z = p[3] / 100, p[4] / 100
        cat, tr = p[2], p[7]
        if cat in KEEP_SPOT:
            bi = next((b for b in near(x, z, 2) if len(polys[b]) >= 3 and inside(x, z, polys[b])), None)
            tp.append(p); continue
        # a board here by the same name already: the pin goes to its door
        k8 = norm(p[0])[:8]
        hit = min(boardAt.get(k8, []), key=lambda d: math.hypot(d[0] - x, d[1] - z), default=None)
        if hit and math.hypot(hit[0] - x, hit[1] - z) < 80: p[3], p[4] = round(hit[0] * 100), round(hit[1] * 100); tp.append(p); tot['matched'] += 1; continue
        cands = [b for b in near(x, z, SNAP_R) if len(polys[b]) >= 3 and B[b][3] not in NO_BOARD]
        ins = [b for b in cands if inside(x, z, polys[b])]
        opts = []
        for b in (ins or cands):
            street = any(w[4] > 2.6 and w[5] in '123' for w in walls[b])
            for ei, w in enumerate(walls[b]):
                if w[4] <= 2.6 or (street and w[5] not in '123'): continue
                d, t = seg(x, z, w[0], w[1], w[2], w[3])
                if d <= SNAP_R: opts.append((d + (0 if w[5] in '123' else 6), b, ei, t))
        placed = False
        for d, b, ei, t in sorted(opts)[:12]:
            ns = nslots(walls[b][ei][4]); k0 = min(ns - 1, int(t * ns))
            for dk in (0, 1, -1, 2, -2, 3, -3):
                kk = k0 + dk
                if 0 <= kk < ns and (b, ei, kk) not in occupied:
                    occupied[(b, ei, kk)] = True
                    bn = board_name(p[0], tr if tr in ('food', 'cafe', 'bar', 'bank', 'atm', 'clinic', 'pharmacy', 'grocery', 'clothes', 'shoes', 'jewellery', 'mobile', 'electronics', 'books', 'optician', 'hardware', 'salon', 'bakery', 'sweets', 'icecream', 'hotel', 'travel') else 'generic')
                    en, mr, brand = bn if bn else (p[0], p[1] or p[0], False)
                    ni = nameIdx((en, p[1] or mr, tr if tr != 'garage' else 'generic', 'brand' if brand else ''))
                    shops.append([b, ei, kk, ni, 2]); boardAt[norm(en)[:8]].append(door(b, ei, kk))
                    dx, dz = door(b, ei, kk); p[3], p[4] = round(dx * 100), round(dz * 100)
                    placed = True; break
            if placed: break
        if placed: tp.append(p); tot['placed'] += 1
        else: tot['dropped'] += 1
    # streets that sell: the frontages nobody lists get trade boards, after what's sold around them
    real = [(q[3] / 100, q[4] / 100, q[7]) for q in tp]
    rgrid = collections.defaultdict(list)
    for q in real: rgrid[(int(q[0] // 150), int(q[1] // 150))].append(q)
    for bi, b in enumerate(B):
        st = b[3]
        if st not in FILL_STYLE or len(polys[bi]) < 3: continue
        for ei, w in enumerate(walls[bi]):
            L, fl = w[4], w[5]
            if fl not in '12' or L < 4.5: continue
            mx, mz = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
            around = [q for i in (-1, 0, 1) for j in (-1, 0, 1) for q in rgrid.get((int(mx // 150) + i, int(mz // 150) + j), ()) if math.hypot(q[0] - mx, q[1] - mz) < 150]
            busy = min(1.0, len(around) / 18)
            pr = FILL_STYLE[st] * (0.45 + 0.55 * busy) + (0.2 if fl == '2' else 0)
            if rng.random() > pr: continue
            mix = collections.Counter(q[2] for q in around)
            wts = [g[3] * (1 + 0.6 * mix.get(g[0], 0)) for g in GENERIC]
            last = None
            for kk in range(nslots(L)):
                if (bi, ei, kk) in occupied or rng.random() < 0.14: continue
                for _ in range(4):
                    g = rng.choices(GENERIC, wts)[0]
                    if g[1] != last: break
                last = g[1]; occupied[(bi, ei, kk)] = True
                shops.append([bi, ei, kk, nameIdx((g[1], g[2], g[0], '')), 0]); tot['generic'] += 1
    # walls that are mostly shops get the open shop front
    filled = collections.Counter((bi, ei) for (bi, ei, k) in occupied)
    for bi, b in enumerate(B):
        fl = list(b[5])
        for ei in range(len(fl)):
            if ei < len(walls[bi]) and filled[(bi, ei)] * 2 >= nslots(walls[bi][ei][4]): fl[ei] = '3'
        b[5] = ''.join(fl)
    T['shopNames'] = names; T['shops'] = shops
    T['pins'] = [[q[0], q[1], q[7] if q[7] in PIN_TRADE else q[2], q[3], q[4], 1] for q in tp]
    allpins += T['pins']
    with gzip.open(f, 'wb', 9) as fh: fh.write(json.dumps(T, separators=(',', ':'), ensure_ascii=False).encode())
    tot['tiles'] += 1; tot['boards'] += len(shops)
# places in no tile (outside the baked city) keep their spot
for key, L in byTile.items():
    if key not in done: allpins += [[q[0], q[1], q[7] if q[7] in PIN_TRADE else q[2], q[3], q[4], 1] for q in L]
with gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz'), 'wb', 9) as fh: fh.write(json.dumps(allpins, separators=(',', ':'), ensure_ascii=False).encode())
print(dict(tot), 'map pins', len(allpins), collections.Counter(p[2] for p in allpins).most_common(30))
