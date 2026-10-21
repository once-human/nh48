#!/usr/bin/env python3
"""ovt_to_osm.py - Overture Maps (data/raw/pune/*.parquet) for one box, written in the same shape
as osm_merge.py's output (nodes / ways / rels with OSM tags) so bake_map.py can bake any part of
Pune. Overture's transportation layer is OpenStreetMap's roads and rails; water, land use and
infrastructure carry their original OSM tags (source_tags). Buildings and places are read by the
bake scripts straight from the parquet files.
usage: ovt_to_osm.py lon0 lat0 lon1 lat1 out.json"""
import json, sys, duckdb
from shapely import wkb
lon0, lat0, lon1, lat1 = map(float, sys.argv[1:5]); OUT = sys.argv[5]
D = 'data/raw/pune/'
import os as _o; sys.path.insert(0, _o.path.dirname(_o.path.abspath(__file__))); from ddb import connect as _ddb
con = _ddb(); G = 'ST_AsWKB(geometry)'
W = f"bbox.xmax >= {lon0} and bbox.xmin <= {lon1} and bbox.ymax >= {lat0} and bbox.ymin <= {lat1}"
nodes, ways = {}, {}
key2id = {}
nid = [1]
def node(lon, lat, tags=None):
    k = (round(lon, 7), round(lat, 7))
    i = key2id.get(k)
    if i is None:
        i = nid[0]; nid[0] += 1; key2id[k] = i; nodes[str(i)] = [round(lat, 7), round(lon, 7), {}]
    if tags: nodes[str(i)][2].update(tags)
    return i
wid = [1]
def way(coords, tags):
    nd = [node(x, y) for x, y in coords]
    nd = [n for i, n in enumerate(nd) if i == 0 or n != nd[i - 1]]
    if len(nd) < 2: return
    ways[str(wid[0])] = {'nd': nd, 'tags': tags}; wid[0] += 1
def lines(g):
    if g.geom_type == 'LineString': return [list(g.coords)]
    if g.geom_type == 'MultiLineString': return [list(l.coords) for l in g.geoms]
    return []
def rings(g):
    if g.geom_type == 'Polygon': return [g]
    if g.geom_type == 'MultiPolygon': return list(g.geoms)
    return []

# ---- roads and rails
HW = {'motorway': 'trunk', 'motorway_link': 'trunk_link', 'unknown': 'unclassified'}
rows = con.sql(f"""select {G}, subtype, class, subclass, names, road_flags, rail_flags, level_rules, access_restrictions
                   from '{D}segment.parquet' where {W}""").fetchall()
for g, sub, cls, subcls, names, rflags, railflags, levels, access in rows:
    geom = wkb.loads(bytes(g))
    t = {}
    flags = set(v for f in (rflags or []) for v in (f.get('values') or []) if not f.get('between'))
    rf = set(v for f in (railflags or []) for v in (f.get('values') or []))
    lvl = next((l.get('value') for l in (levels or []) if not l.get('between')), None)
    if sub == 'road':
        hw = HW.get(cls, cls)
        if subcls == 'link' and hw in ('trunk', 'primary', 'secondary', 'tertiary'): hw += '_link'
        t['highway'] = hw
        if 'is_bridge' in flags: t['bridge'] = 'yes'
        if 'is_tunnel' in flags: t['tunnel'] = 'yes'
        for a in access or []:
            if a.get('access_type') == 'denied':
                when = a.get('when') or {}
                if when.get('heading') == 'backward' and not when.get('mode'): t['oneway'] = 'yes'
                elif not when: t['access'] = 'no'
            if a.get('access_type') == 'designated' and (a.get('when') or {}).get('using') == ['as_customer']: t['access'] = 'private'
    elif sub == 'rail':
        t['railway'] = {'subway': 'subway', 'light_rail': 'light_rail', 'standard_gauge': 'rail', 'narrow_gauge': 'rail'}.get(cls, 'rail')
        if 'is_bridge' in rf: t['bridge'] = 'viaduct' if t['railway'] in ('subway', 'light_rail') else 'yes'
        if 'is_tunnel' in rf: t['tunnel'] = 'yes'
        if 'is_under_construction' in rf: t['railway'] = 'construction'
    else:
        continue
    if lvl: t['layer'] = str(lvl)
    if names:
        if names.get('primary'): t['name'] = names['primary']
        for c in (names.get('common') or {}) if isinstance(names.get('common'), dict) else []:
            pass
        com = names.get('common')
        if isinstance(com, dict) and com.get('mr'): t['name:mr'] = com['mr']
        elif isinstance(com, list):
            for kv in com:
                if kv and kv[0] == 'mr': t['name:mr'] = kv[1]
    for cs in lines(geom): way(cs, t)

# ---- infrastructure: signals, crossings, bus stops, walls, bridges... (original OSM tags)
rows = con.sql(f"select {G}, source_tags, names from '{D}infrastructure.parquet' where {W}").fetchall()
for g, st, names in rows:
    geom = wkb.loads(bytes(g)); tags = dict(st or [])
    if names and names.get('primary') and 'name' not in tags: tags['name'] = names['primary']
    if geom.geom_type == 'Point': node(geom.x, geom.y, tags)
    else:
        for cs in lines(geom): way(cs, tags)
        for p in rings(geom): way(list(p.exterior.coords), tags)

# ---- water and land use (original OSM tags)
for f in ('water', 'land_use'):
    rows = con.sql(f"select {G}, source_tags, names from '{D}{f}.parquet' where {W}").fetchall()
    for g, st, names in rows:
        geom = wkb.loads(bytes(g)); tags = dict(st or [])
        if names and names.get('primary') and 'name' not in tags: tags['name'] = names['primary']
        for p in rings(geom):
            way(list(p.exterior.coords), tags)
            for hole in p.interiors: way(list(hole.coords), {'_hole': '1'})
        for cs in lines(geom): way(cs, tags)
json.dump({'nodes': nodes, 'ways': ways, 'rels': {}}, open(OUT, 'w'), separators=(',', ':'))
print('nodes', len(nodes), 'ways', len(ways))
