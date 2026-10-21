#!/usr/bin/env python3
"""bake_transit.py - Pune Metro lines and PMPML bus routes for the game (src/game/transit.json).
Metro: the operational Purple (PCMC-Swargate, underground from Range Hills to Swargate) and Aqua
(Vanaz-Ramwadi, elevated) lines, stations in order with their real positions (OpenStreetMap).
Line 3 (Hinjewadi-Shivajinagar) is listed but marked not open.
Buses: PMPML route relations from OpenStreetMap with their stops in order.
Coordinates are game metres (x east, z south), same projection as data/map.json."""
import json, sys
MAP = json.load(open('data/map.json'))['meta']
LAT0, LON0, MLAT, MLON = MAP['lat0'], MAP['lon0'], MAP['mlat'], MAP['mlon']
proj = lambda lat, lon: (round((lon - LON0) * MLON, 1), round(-(lat - LAT0) * MLAT, 1))

# [name, mr, lat, lon, underground]
PURPLE = [
 ['PCMC Bhavan', 'पीसीएमसी भवन', 18.6289, 73.8007, 0], ['Sant Tukaram Nagar', 'संत तुकाराम नगर', 18.6203, 73.8158, 0],
 ['Nashik Phata', 'नाशिक फाटा', 18.6036, 73.8236, 0], ['Kasarwadi', 'कासारवाडी', 18.5966, 73.8267, 0],
 ['Phugewadi', 'फुगेवाडी', 18.5844, 73.8327, 0], ['Dapodi', 'दापोडी', 18.5770, 73.8363, 0], ['Bopodi', 'बोपोडी', 18.5674, 73.8410, 0],
 ['Khadki', 'खडकी', 18.5599, 73.8443, 0], ['Shivaji Nagar', 'शिवाजीनगर', 18.53217, 73.84966, 1], ['District Court', 'जिल्हा न्यायालय', 18.52679, 73.8569, 1],
 ['Kasba Peth', 'कसबा पेठ', 18.52137, 73.85962, 1], ['Mahatma Phule Mandai', 'महात्मा फुले मंडई', 18.5129, 73.85701, 1], ['Swargate', 'स्वारगेट', 18.49974, 73.85746, 1]]
AQUA = [
 ['Vanaz', 'वनाज', 18.50717, 73.80523, 0], ['Anand Nagar', 'आनंदनगर', 18.50955, 73.81408, 0], ['Ideal Colony', 'आयडियल कॉलनी', 18.50888, 73.82213, 0],
 ['Nal Stop', 'नळ स्टॉप', 18.50734, 73.82879, 0], ['Garware College', 'गरवारे महाविद्यालय', 18.51199, 73.83805, 0], ['Deccan Gymkhana', 'डेक्कन जिमखाना', 18.51645, 73.84445, 0],
 ['Chhatrapati Sambhaji Udyan', 'छत्रपती संभाजी उद्यान', 18.52008, 73.84738, 0], ['PMC', 'पुणे महानगरपालिका', 18.52274, 73.85335, 0], ['District Court', 'जिल्हा न्यायालय', 18.52672, 73.85775, 0],
 ['Mangalwar Peth', 'मंगळवार पेठ', 18.5301, 73.86505, 0], ['Pune Railway Station', 'पुणे रेल्वे स्टेशन', 18.52975, 73.8726, 0], ['Ruby Hall Clinic', 'रुबी हॉल क्लिनिक', 18.53272, 73.87775, 0],
 ['Bund Garden', 'बंड गार्डन', 18.54059, 73.88344, 0], ['Yerawada', 'येरवडा', 18.54532, 73.88669, 0], ['Kalyani Nagar', 'कल्याणी नगर', 18.54445, 73.90571, 0], ['Ramwadi', 'रामवाडी', 18.55673, 73.90812, 0]]
PINK = [['Shivaji Nagar', 'शिवाजीनगर', 18.53047, 73.84857, 0], ['Agriculture College', 'कृषी महाविद्यालय', 18.53301, 73.84149, 0], ['RBI', 'आरबीआय', 18.53637, 73.83669, 0]]

def stations(arr):
    out = []
    for n, mr, la, lo, ug in arr:
        x, z = proj(la, lo); out.append({'name': n, 'mr': mr, 'x': x, 'z': z, 'ug': ug})
    return out
metro = [
 {'id': 'purple', 'name': 'Purple Line', 'mr': 'जांभळी मार्गिका', 'color': '#7d3c98', 'open': True, 'stations': stations(PURPLE)},
 {'id': 'aqua', 'name': 'Aqua Line', 'mr': 'निळी मार्गिका', 'color': '#1fb5c9', 'open': True, 'stations': stations(AQUA)},
 {'id': 'pink', 'name': 'Line 3 (Hinjewadi)', 'mr': 'मार्गिका ३', 'color': '#e8508b', 'open': False, 'stations': stations(PINK)},
]
# buses
M = json.load(open('data/raw/merged.json'))
N = M['nodes']
routes = []
for k, r in M['rels'].items():
    t = r.get('tags', {})
    if t.get('route') != 'bus' or not t.get('ref') or 'MSRTC' in (t.get('name') or ''): continue
    stops = []
    for typ, ref, role in r['members']:
        if typ != 'node' or not role.startswith(('platform', 'stop')): continue
        n = N.get(str(ref))
        if not n: continue
        tg = (n[2] if len(n) > 2 else {}) or {}
        name = tg.get('name') or tg.get('name:en')
        if not name: continue
        if stops and stops[-1]['name'] == name: continue
        x, z = proj(n[0], n[1])
        stops.append({'name': name, 'mr': tg.get('name:mr', ''), 'x': x, 'z': z})
    if len(stops) >= 3:
        routes.append({'ref': t['ref'], 'name': (t.get('name') or '').replace('Bus ' + t['ref'] + ':', '').replace('Bus ' + t['ref'] + ' :', '').strip(), 'stops': stops})
json.dump({'metro': metro, 'bus': routes, 'fares': {
  'metro': 'Pune Metro: ₹10 minimum, ₹35 maximum, by distance',
  'bus': 'PMPML (2025 fare stages): ₹10 for the first 5 km, ₹10 more per 5 km up to 30 km'}},
  open('src/game/transit.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('metro stations', sum(len(l['stations']) for l in metro), 'bus routes', len(routes), [(r['ref'], len(r['stops'])) for r in routes])
