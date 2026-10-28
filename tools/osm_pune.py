#!/usr/bin/env python3
"""osm_pune.py - the parts of OpenStreetMap the game needs for Pune, from the Maharashtra extract
(data/raw/osm/maharashtra.osm.pbf, from download.openstreetmap.fr, ODbL):
  pois       every named shop, eatery, temple, school, hospital, bank... with its exact position
  buildings  every building OSM has a name, level count or height for (and its outline)
  landmarks  outlines of historic places, attractions, stations, big temples, colleges
  metro      Pune Metro lines and stations (including Line 3, Hinjewadi to Shivajinagar)
-> data/raw/osm/pune_osm.json
usage: python3 tools/osm_pune.py"""
import json, os, osmium
from shapely.geometry import Polygon, LineString
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'data/raw/osm/maharashtra.osm.pbf')
OUT = os.path.join(ROOT, 'data/raw/osm/pune_osm.json')
LON0, LAT0, LON1, LAT1 = 73.66, 18.38, 74.10, 18.76
POI_KEYS = ('amenity', 'shop', 'tourism', 'leisure', 'office', 'healthcare', 'historic', 'craft', 'club', 'sport')
LM = lambda t: (t.get('historic') or t.get('tourism') in ('attraction', 'museum', 'viewpoint') or t.get('amenity') in ('place_of_worship', 'university', 'college', 'hospital', 'theatre', 'cinema', 'townhall', 'courthouse')
                or t.get('railway') == 'station' or t.get('building') in ('train_station', 'temple', 'church', 'mosque', 'palace', 'fort', 'cathedral') or t.get('leisure') in ('stadium', 'park', 'garden') or t.get('landuse') == 'religious')

def inside(lon, lat): return LON0 <= lon <= LON1 and LAT0 <= lat <= LAT1
def tagd(o): return {t.k: t.v for t in o.tags}

class H(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.pois, self.blds, self.lms, self.rail, self.stations = [], [], [], [], []
    def node(self, n):
        if not n.location.valid() or not inside(n.location.lon, n.location.lat): return
        t = tagd(n)
        if not t: return
        if t.get('railway') in ('station', 'halt') or t.get('public_transport') == 'station':
            self.stations.append({'id': n.id, 'lon': round(n.location.lon, 7), 'lat': round(n.location.lat, 7), 't': t})
        if t.get('name') and any(k in t for k in POI_KEYS):
            self.pois.append({'id': 'n%d' % n.id, 'lon': round(n.location.lon, 7), 'lat': round(n.location.lat, 7), 't': t})
    def way(self, w):
        t = tagd(w)
        if not t: return
        try: pts = [(round(nd.lon, 7), round(nd.lat, 7)) for nd in w.nodes]
        except osmium.InvalidLocationError: return
        if len(pts) < 2 or not any(inside(*p) for p in pts): return
        if t.get('railway') in ('subway', 'light_rail', 'construction', 'proposed', 'rail') and (t.get('railway') != 'rail' or 'metro' in (t.get('name', '') + t.get('construction', '')).lower()):
            self.rail.append({'id': w.id, 'pts': pts, 't': t})
        closed = len(pts) > 3 and pts[0] == pts[-1]
        if not closed: return
        poly = Polygon(pts)
        if not poly.is_valid: poly = poly.buffer(0)
        c = poly.representative_point()
        if t.get('name') and any(k in t for k in POI_KEYS) and 'building' not in t or (t.get('name') and any(k in t for k in POI_KEYS)):
            self.pois.append({'id': 'w%d' % w.id, 'lon': round(c.x, 7), 'lat': round(c.y, 7), 't': t, 'area': True})
        if 'building' in t and (t.get('name') or 'building:levels' in t or 'height' in t or LM(t)):
            self.blds.append({'id': w.id, 'pts': pts, 't': {k: v for k, v in t.items() if k in ('building', 'name', 'name:mr', 'building:levels', 'height', 'roof:shape', 'roof:levels', 'amenity', 'historic', 'religion', 'tourism', 'wikidata', 'building:colour', 'roof:colour', 'building:material')}})
        if LM(t) and t.get('name'):
            self.lms.append({'id': w.id, 'pts': pts, 't': t})
    def relation(self, r):
        t = tagd(r)
        if t.get('route') in ('subway', 'light_rail', 'train') and ('metro' in (t.get('name', '') + t.get('network', '')).lower()):
            self.rail.append({'rel': r.id, 't': t, 'members': [(m.type, m.ref, m.role) for m in r.members]})

h = H()
h.apply_file(SRC, locations=True, idx='flex_mem')
json.dump({'pois': h.pois, 'buildings': h.blds, 'landmarks': h.lms, 'rail': h.rail, 'stations': h.stations}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('pois', len(h.pois), 'buildings', len(h.blds), 'landmarks', len(h.lms), 'rail', len(h.rail), 'stations', len(h.stations), os.path.getsize(OUT) // 1024, 'KB')
