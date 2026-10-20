# Download OSM API 0.6 map tiles for a bbox, splitting tiles that exceed the node limit.
import urllib.request, sys, os, time
LAT0, LAT1, LON0, LON1 = 18.508, 18.546, 73.829, 73.901
STEP = 0.012
out = 'data/raw/tiles'
def fetch(a, b, c, d, name, depth=0):
    fn = f'{out}/{name}.osm'
    if os.path.exists(fn) and os.path.getsize(fn) > 1000:
        return
    url = f'https://api.openstreetmap.org/api/0.6/map?bbox={c:.5f},{a:.5f},{d:.5f},{b:.5f}'
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'nh48-game-baker/1.0 (personal project)'})
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
            open(fn, 'wb').write(data)
            print(name, len(data) // 1024, 'KB', flush=True)
            time.sleep(1.0)
            return
        except urllib.error.HTTPError as e:
            if e.code == 400 and depth < 4:
                print(name, 'too big, splitting', flush=True)
                mlat, mlon = (a + b) / 2, (c + d) / 2
                for k, (aa, bb, cc, dd) in enumerate([(a, mlat, c, mlon), (a, mlat, mlon, d), (mlat, b, c, mlon), (mlat, b, mlon, d)]):
                    fetch(aa, bb, cc, dd, f'{name}_{k}', depth + 1)
                return
            print(name, 'HTTP', e.code, 'retry', flush=True); time.sleep(5 * (attempt + 1))
        except Exception as e:
            print(name, 'err', e, 'retry', flush=True); time.sleep(5 * (attempt + 1))
i = 0
lat = LAT0
while lat < LAT1 - 1e-9:
    lon = LON0; j = 0
    while lon < LON1 - 1e-9:
        fetch(lat, min(LAT1, lat + STEP), lon, min(LON1, lon + STEP), f't_{i}_{j}')
        lon += STEP; j += 1
    lat += STEP; i += 1
print('done')
