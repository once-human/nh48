# Render baked map.json (not the OSM source) for checking. usage: plot_map.py map.json out.png x0 z0 x1 z1 scale
import json, sys
from PIL import Image, ImageDraw
M = json.load(open(sys.argv[1])); out = sys.argv[2]
x0, z0, x1, z1, S = map(float, sys.argv[3:8])
W, H = int((x1 - x0) * S), int((z1 - z0) * S)
im = Image.new('RGB', (W, H), (20, 20, 20))
def tp(x, z): return ((x / 100 - x0) * S, (z / 100 - z0) * S)
def ring(r): return [tp(r[i], r[i + 1]) for i in range(0, len(r), 2)]
COL = {'asphalt': (68, 68, 72), 'concrete': (150, 150, 145), 'pavers': (196, 170, 150), 'compound': (150, 135, 110),
       'grass': (100, 150, 70), 'soil': (170, 100, 60), 'scrub': (130, 140, 90), 'plaza': (165, 165, 160),
       'median': (240, 200, 30), 'bridge_road': (100, 100, 110), 'bridge_sw': (200, 180, 160)}
def fill(rings, col):
    mask = Image.new('L', (W, H), 0); d = ImageDraw.Draw(mask)
    d.polygon(ring(rings[0]), fill=255)
    for h in rings[1:]:
        d.polygon(ring(h), fill=0)
    im.paste(col, mask=mask)
def fill_fast(rings, col, dr):
    dr.polygon(ring(rings[0]), fill=col)
dr = ImageDraw.Draw(im)
for ci, rings in M['water']:
    (fill if len(rings) > 1 else lambda r, c: fill_fast(r, c, dr))(rings, (60, 100, 130))
for kind, polys in M['ground']:
    for ci, rings in polys:
        if len(rings) > 1: fill(rings, COL.get(kind, (255, 0, 255)))
        else: fill_fast(rings, COL.get(kind, (255, 0, 255)), dr)
dr = ImageDraw.Draw(im)
for ci, l in M['kerbs']: dr.line(ring(l), fill=(255, 255, 255), width=1)
for ci, l in M['rails']: dr.line(ring(l), fill=(255, 0, 0), width=2)
for ci, l in M['banks']: dr.line(ring(l), fill=(0, 255, 255), width=2)
for w in M['walls']: dr.line(ring(w), fill=(235, 225, 200), width=2)
for b in M['buildings']:
    dr.polygon(ring(b[1]), fill=(200 - 12 * b[3], 180, 160 + 6 * b[3]), outline=(30, 30, 30))
    # street facing edges
    r = b[1]; n = len(r) // 2
    for i, f in enumerate(b[5]):
        if f != '0':
            a = tp(r[2 * i], r[2 * i + 1]); c = tp(r[2 * ((i + 1) % n)], r[2 * ((i + 1) % n) + 1])
            dr.line([a, c], fill=(255, 60, 60) if f == '2' else (60, 60, 255), width=2)
for t in M['trees']:
    x, z = tp(t[0], t[1]); dr.ellipse([x - 3, z - 3, x + 3, z + 3], fill=(40, 120, 40))
for l in M['marks']['center']: dr.line(ring(l), fill=(255, 255, 255), width=1)
for l in M['marks']['lane']: dr.line(ring(l), fill=(220, 220, 220), width=1)
import math
for z in M['marks']['zebra']:
    x, zz = tp(z[0], z[1]); a = z[2]; w = z[3] / 100 * S / 2
    nx, nz = -math.sin(a), math.cos(a)
    dr.line([(x - nx * w, zz - nz * w), (x + nx * w, zz + nz * w)], fill=(255, 255, 0), width=3)
for z in M['marks']['bump']:
    x, zz = tp(z[0], z[1]); a = z[2]; w = z[3] / 100 * S / 2
    nx, nz = -math.sin(a), math.cos(a)
    dr.line([(x - nx * w, zz - nz * w), (x + nx * w, zz + nz * w)], fill=(255, 128, 0), width=2)
for l in M['lamps']:
    x, z = tp(l[0], l[1]); dr.rectangle([x - 1, z - 1, x + 1, z + 1], fill=(255, 255, 160))
for s in M['signals']:
    x, z = tp(s[0], s[1]); dr.rectangle([x - 3, z - 3, x + 3, z + 3], fill=(255, 0, 0))
for s in M['stalls']:
    x, z = tp(s[0], s[1]); dr.rectangle([x - 2, z - 2, x + 2, z + 2], fill=(255, 0, 255))
for s in M['buses']:
    x, z = tp(s[0], s[1]); dr.rectangle([x - 4, z - 2, x + 4, z + 2], fill=(0, 200, 255))
for m in M['metro']:
    dr.line(ring(m[1]), fill=(0, 230, 230) if not m[0] else (230, 0, 230), width=3)
for e in M['graph']['edges']:
    dr.line(ring(e[7]), fill=(255, 220, 0) if e[4] else (0, 200, 255), width=1)
im.save(out); print(im.size)
