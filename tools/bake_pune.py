#!/usr/bin/env python3
"""bake_pune.py - bake the whole city in 4 km tiles.
  python3 tools/bake_pune.py plan            list the tiles (and the global chunk grid)
  python3 tools/bake_pune.py tile I J        bake one tile: Overture -> OSM-shaped raw -> bake_map -> shops,
                                             places, street life, flyovers  (data/tiles/t_I_J.json)
  python3 tools/bake_pune.py all [N]         every tile not baked yet (N in parallel)
The projection is the original map's (so the old centre keeps its coordinates); chunks are 200 m
on one global grid, tiles are 20 x 20 chunks, clipped to the city outline."""
import json, math, os, subprocess, sys, time
from shapely.geometry import Polygon, box
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LAT0, LON0, MLAT, MLON = 18.527, 73.865, 110686.0, 105589.0
CHUNK, TILE = 200.0, 4000.0
proj = lambda lat, lon: ((lon - LON0) * MLON, -(lat - LAT0) * MLAT)
unproj = lambda x, z: (-z / MLAT + LAT0, x / MLON + LON0)
ol = json.load(open(os.path.join(ROOT, 'data/raw/pune/outline.json')))['outline'][0]
OUTL = Polygon([proj(la, lo) for lo, la in ol]).buffer(0)
b = OUTL.bounds
GX0 = math.floor((b[0] - 400) / TILE) * TILE; GZ0 = math.floor((b[1] - 400) / TILE) * TILE
NTX = int(math.ceil((b[2] + 400 - GX0) / TILE)); NTZ = int(math.ceil((b[3] + 400 - GZ0) / TILE))
NCX, NCZ = int(NTX * TILE / CHUNK), int(NTZ * TILE / CHUNK)
GRID = f'{GX0},{GZ0},{NCX},{NCZ}'
OUT = os.path.join(ROOT, 'data/tiles'); os.makedirs(OUT, exist_ok=True)

def tiles():
    out = []
    for i in range(NTX):
        for j in range(NTZ):
            t = box(GX0 + i * TILE, GZ0 + j * TILE, GX0 + (i + 1) * TILE, GZ0 + (j + 1) * TILE)
            a = t.intersection(OUTL).area
            if a > 1e4: out.append((i, j, a / 1e6))
    return out

def bake(i, j):
    x0, z0 = GX0 + i * TILE, GZ0 + j * TILE
    x1, z1 = x0 + TILE, z0 + TILE
    m = 700.0
    la0, lo0 = unproj(x0 - m, z1 + m); la1, lo1 = unproj(x1 + m, z0 - m)
    raw = os.path.join(OUT, f'raw_{i}_{j}.json'); mp = os.path.join(OUT, f't_{i}_{j}.json')
    env = dict(os.environ, NH_TILE=f'{x0},{z0},{x1},{z1}', NH_GRID=GRID, NH_MAP=mp, NH_OSM=raw,
               NH_PLACES=os.path.join(ROOT, 'data/raw/pune/place.parquet'), NH_STREETBASE=os.path.join(OUT, f'sb_{i}_{j}.json'))
    t0 = time.time()
    log = open(os.path.join(OUT, f'log_{i}_{j}.txt'), 'w')
    def run(*a):
        r = subprocess.run([sys.executable, *a], cwd=ROOT, env=env, stdout=log, stderr=log)
        if r.returncode: raise SystemExit(f'tile {i},{j}: {a[0]} failed (see data/tiles/log_{i}_{j}.txt)')
    run('tools/ovt_to_osm.py', str(lo0), str(la0), str(lo1), str(la1), raw)
    run('tools/bake_map.py', raw, mp)
    for s in ('bake_shops', 'bake_places', 'bake_street', 'bake_flyovers'):
        run(f'tools/{s}.py')
    os.remove(raw)
    print(f'tile {i},{j} done in {time.time() - t0:.0f}s', os.path.getsize(mp) // 1024, 'KB', flush=True)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'plan'
    T = tiles()
    if cmd == 'plan':
        print('grid', GRID, 'tiles', NTX, 'x', NTZ, 'in city', len(T), 'km2', round(sum(t[2] for t in T)))
        c = [(i, j) for i, j, _ in T if GX0 + i * TILE <= 0 < GX0 + (i + 1) * TILE and GZ0 + j * TILE <= 0 < GZ0 + (j + 1) * TILE]
        print('centre tile', c)
    elif cmd == 'tile':
        bake(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == 'all':
        todo = [(i, j) for i, j, _ in T if not os.path.exists(os.path.join(OUT, f't_{i}_{j}.json'))]
        # nearest the centre first
        todo.sort(key=lambda t: math.hypot(GX0 + (t[0] + 0.5) * TILE, GZ0 + (t[1] + 0.5) * TILE))
        for i, j in todo:
            try: bake(i, j)
            except SystemExit as e: print(e, flush=True)
