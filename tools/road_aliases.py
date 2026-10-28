#!/usr/bin/env python3
"""road_aliases.py - the names Punekars actually use, for roads OpenStreetMap carries under their official
names (Gopal Hari Deshmukh Marg is Baner Road to everyone). Rewrites the street-name table in
data/pune/base.json.gz.  usage: python3 tools/road_aliases.py"""
import gzip, json, os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ALIAS = [
    (r'^Gopal Hari Deshmukh Marg', ('Baner Road', 'बाणेर रस्ता')), (r'^(Dr\.? )?(Homi )?Bhabha (Marg|rd)', ('Pashan Road', 'पाषाण रस्ता')),
    (r'^Sant (Dyaneshwar|Jnaneshwar) Mar[gd]$', ('Alandi Road', 'आळंदी रस्ता')), (r'^Raja Mantri Path', ('DP Road', 'डीपी रस्ता')),
    (r'^Samrat Ashok Marg', ('Jail Road', 'जेल रोड')), (r'^Kakasaheb Gadgil Bridge', ('Z Bridge', 'झेड ब्रिज')),
    (r'^Shivaji Bridge$', ('Shivaji Bridge (Nava Pul)', 'नवा पूल')), (r'^Prabodhankar Thakare Path', ('Bibwewadi Kondhwa Road', 'बिबवेवाडी कोंढवा रस्ता')),
    (r'^Vishnushastri Chiplunkar Path', ('Law College Road', 'लॉ कॉलेज रस्ता')), (r'^Lalbahadur Shas?htri Marg', ('Shastri Road', 'शास्त्री रस्ता')),
    (r'^Amrutlal Mehta Path', ('Boat Club Road', 'बोट क्लब रस्ता')), (r'^Veer Santaji Ghorpade (Marg|Road)', ('Juna Bazar Road', 'जुना बाजार रस्ता')),
    (r'^Maharshi Vitthal Ramji Shinde Bridge', ('Balgandharva Bridge', 'बालगंधर्व पूल')), (r'^Dengle Bridge', ('Dengle Pul', 'डेंगळे पूल')),
]
p = os.path.join(ROOT, 'data/pune/base.json.gz')
B = json.load(gzip.open(p))
n = 0
for nm in B['names']:
    for pat, (en, mr) in ALIAS:
        if re.search(pat, nm[0]): nm[0], nm[1] = en, mr; n += 1; break
with gzip.open(p, 'wb', 9) as fh: fh.write(json.dumps(B, separators=(',', ':'), ensure_ascii=False).encode())
print('renamed', n)
