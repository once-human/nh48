#!/usr/bin/env python3
"""ovt_fetch.py - pull the Pune box out of the latest Overture Maps release straight from its public S3
bucket (pyarrow, no DuckDB extensions), one GeoParquet per type in data/raw/pune/: segment, connector,
infrastructure, water, land_use, land, building, place, division_area.
usage: python3 tools/ovt_fetch.py [type ...]"""
import os, sys, time
import pyarrow.dataset as ds, pyarrow.fs as pafs, pyarrow.parquet as pq, pyarrow.compute as pc
BB = (73.68, 18.38, 74.08, 18.74)
TYPES = {'segment': 'transportation', 'connector': 'transportation', 'infrastructure': 'base', 'water': 'base', 'land_use': 'base', 'land': 'base',
         'building': 'buildings', 'place': 'places', 'division_area': 'divisions'}
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'data/raw/pune'); os.makedirs(OUT, exist_ok=True)
s3 = pafs.S3FileSystem(anonymous=True, region='us-west-2', proxy_options=os.environ.get('HTTPS_PROXY') or None)
rel = sorted(f.path for f in s3.get_file_info(pafs.FileSelector('overturemaps-us-west-2/release/')))[-1]
print('release', rel, flush=True)
for t in (sys.argv[1:] or TYPES):
    out = os.path.join(OUT, f'{t}.parquet')
    if os.path.exists(out): print(t, 'have it'); continue
    t0 = time.time()
    d = ds.dataset(f'{rel}/theme={TYPES[t]}/type={t}/', filesystem=s3, format='parquet')
    b = lambda k: pc.field(('bbox', k))
    f = (b('xmax') >= BB[0]) & (b('xmin') <= BB[2]) & (b('ymax') >= BB[1]) & (b('ymin') <= BB[3])
    tab = d.to_table(filter=f)
    pq.write_table(tab, out + '.part'); os.replace(out + '.part', out)
    print(t, tab.num_rows, 'rows', round(time.time() - t0), 's', flush=True)
