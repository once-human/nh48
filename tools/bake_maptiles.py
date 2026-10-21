#!/usr/bin/env python3
"""bake_maptiles.py - the city map as pictures: every baked 4 km tile drawn at three zooms into WebP
images, so the big map and the minimap never draw the city at runtime when zoomed out.
  r0  0.125 px/m, 500 px = 4 km   r1  0.25 px/m, 500 px = 2 km   r2  0.5 px/m, 500 px = 1 km   r3  1 px/m, 1000 px = 1 km
Out: data/pune/map/r{L}/{tx}_{tz}.webp (tx, tz count from the map's west and north edge, meta.vis).
Same colours as src/ui/map.js. usage: python3 tools/bake_maptiles.py [--force]"""
import glob, json, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC, OUT = os.path.join(ROOT, 'data/tiles'), os.path.join(ROOT, 'data/pune/map')
FORCE = '--force' in sys.argv
COL = dict(bg='#101216', land='#14171b', grass='#16241b', soil='#1b1a17', scrub='#15211a', plaza='#1a1c20', median='#1a2219', pavers='#1b1d22',
           water='#0d2433', building='#23272e', landmark='#3a3220', road='#3b3f47', main='#5a5f69', arterial='#6e7480', rail='#2d3037', bridge='#5d626c',
           limit='#a57a1e')
LEVELS = [(0.125, 4, 500), (0.25, 3, 500), (0.5, 2, 500), (1.0, 0, 1000)]   # px per metre, smallest road rank drawn, image size
IMG, SS = 500, 2                                  # image size, supersampling
outline = json.load(open(os.path.join(ROOT, 'data/raw/pune/outline.json')))['outline'][0]

def lm(b): return b[3] in (8, 11, 5, 12)
for f in sorted(glob.glob(os.path.join(SRC, 't_*_*.json'))):
    if not re.search(r't_\d+_\d+\.json$', f): continue
    M = json.load(open(f)); meta = M['meta']; rect = meta['tile']; vis = meta['vis']
    oxy = [((lon - meta['lon0']) * meta['mlon'] * 100, -(lat - meta['lat0']) * meta['mlat'] * 100) for lon, lat in outline]
    span = rect[2] - rect[0]                      # cm
    for L, (ppm, minrank, IMG) in enumerate(LEVELS):
        tm = IMG / ppm * 100                      # cm per image
        n = max(1, int(round(span / tm)))
        tx0, tz0 = int(round((rect[0] - vis[0]) / tm)), int(round((rect[1] - vis[1]) / tm))
        d = os.path.join(OUT, f'r{L}'); os.makedirs(d, exist_ok=True)
        if not FORCE and all(os.path.exists(os.path.join(d, f'{tx0 + a}_{tz0 + b}.webp')) and os.path.getmtime(os.path.join(d, f'{tx0 + a}_{tz0 + b}.webp')) > os.path.getmtime(f) for a in range(n) for b in range(n)):
            continue
        W = IMG * n * SS
        k = ppm / 100 * SS                         # px per cm
        X0, Z0 = vis[0] + tx0 * tm, vis[1] + tz0 * tm
        P = lambda r: [((r[q] - X0) * k, (r[q + 1] - Z0) * k) for q in range(0, len(r) - 1, 2)]
        im = Image.new('RGB', (W, W), COL['land']); dr = ImageDraw.Draw(im)
        for kind, polys in M['ground']:
            if kind not in COL or kind in ('pavers',): continue
            for _, rings in polys:
                if rings and len(rings[0]) >= 6: dr.polygon(P(rings[0]), fill=COL[kind])
        for _, rings in M.get('water', []):
            for r in rings[:1]:
                if len(r) >= 6: dr.polygon(P(r), fill=COL['water'])
        G = M['graph']
        for e in sorted(G['edges'], key=lambda e: e[3]):
            if e[3] < minrank: continue
            px = 3.4 if e[3] >= 5 else 2.6 if e[3] >= 4 else 1.7 if e[3] >= 3 else 1.2
            wd = max(e[2] / 100 * ppm, px) * SS
            col = COL['bridge'] if len(e) > 8 and e[8] else COL['arterial'] if e[3] >= 5 else COL['main'] if e[3] >= 4 else COL['road']
            pts = P(e[7])
            if len(pts) >= 2: dr.line(pts, fill=col, width=max(1, int(round(wd))), joint='curve')
            r = wd / 2
            for (x, z) in (pts[0], pts[-1]): dr.ellipse([x - r, z - r, x + r, z + r], fill=col)
        for _, line in M.get('rails', []):
            if len(line) >= 4: dr.line(P(line), fill=COL['rail'], width=max(1, int(1.4 * SS)))
        if L > 0:
            for b in M['buildings']:
                if len(b[1]) >= 6: dr.polygon(P(b[1]), fill=COL['landmark'] if lm(b) else COL['building'])
        # outside the city: dark, and the city limit dashed in amber
        mask = Image.new('L', (W, W), 0); ImageDraw.Draw(mask).polygon([((x - X0) * k, (z - Z0) * k) for x, z in oxy], fill=255)
        im = Image.composite(im, Image.new('RGB', (W, W), COL['bg']), mask)
        dr = ImageDraw.Draw(im)
        ol = [((x - X0) * k, (z - Z0) * k) for x, z in oxy]
        dr.line(ol + ol[:1], fill=COL['limit'], width=2 * SS)
        im = im.resize((IMG * n, IMG * n), Image.LANCZOS)
        empty = mask.resize((n, n), Image.BOX)
        for a in range(n):
            for b in range(n):
                if empty.getpixel((a, b)) == 0: continue          # wholly outside the city
                im.crop((a * IMG, b * IMG, (a + 1) * IMG, (b + 1) * IMG)).save(os.path.join(d, f'{tx0 + a}_{tz0 + b}.webp'), 'WEBP', quality=78, method=4)
    print('map', os.path.basename(f), flush=True)

IMG = 500
# one picture of the whole city for the first look (loaded with the game): r0 pieces at half size
r0 = os.path.join(OUT, 'r0')
fs = [f for f in os.listdir(r0) if f.endswith('.webp')] if os.path.isdir(r0) else []
if fs:
    xy = [tuple(map(int, f[:-5].split('_'))) for f in fs]
    nx, nz = max(a for a, _ in xy) + 1, max(b for _, b in xy) + 1
    big = Image.new('RGB', (nx * IMG, nz * IMG), COL['bg'])
    for f, (a, b) in zip(fs, xy): big.paste(Image.open(os.path.join(r0, f)).convert('RGB'), (a * IMG, b * IMG))
    big = big.resize((nx * IMG // 2, nz * IMG // 2), Image.LANCZOS)
    big.save(os.path.join(OUT, 'overview.webp'), 'WEBP', quality=80, method=5)
    print('overview', big.size, os.path.getsize(os.path.join(OUT, 'overview.webp')) // 1024, 'KB')
