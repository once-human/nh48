import json, math, sys
from PIL import Image, ImageDraw, ImageFont
d=json.load(open('raw/merged.json')); N=d['nodes']; W=d['ways']; R=d['rels']
lat0,lat1,lon0,lon1 = 18.5085,18.5335,73.8330,73.8535
S=1400; sc=S/(lat1-lat0)
H=S; Wd=int((lon1-lon0)*sc*math.cos(math.radians(18.52)))
im=Image.new('RGB',(Wd,H),(235,232,222)); dr=ImageDraw.Draw(im)
def P(nid):
    n=N.get(str(nid)); 
    if not n: return None
    return ((n[1]-lon0)*sc*math.cos(math.radians(18.52)), (lat1-n[0])*sc)
def pts(w): return [p for p in (P(i) for i in w['nd']) if p]
col={'trunk':(200,60,60),'primary':(230,120,40),'secondary':(220,180,40),'tertiary':(150,150,150),'residential':(110,110,110),'service':(170,170,170),'living_street':(130,130,130)}
wid={'trunk':7,'primary':6,'secondary':5,'tertiary':4,'residential':2,'service':1,'living_street':2}
for w in W.values():
    t=w['tags']; p=pts(w)
    if len(p)<2: continue
    if t.get('natural')=='water' or t.get('waterway') in ('riverbank',) or t.get('water'):
        dr.polygon(p,fill=(150,190,230))
    elif t.get('landuse') in ('grass','recreation_ground') or t.get('leisure') in ('park','garden','pitch') or t.get('natural') in ('wood','scrub'):
        dr.polygon(p,fill=(190,220,170))
for w in W.values():
    t=w['tags']; p=pts(w)
    if len(p)<2: continue
    if 'building' in t: dr.polygon(p,fill=(200,180,170),outline=(150,130,120))
for w in W.values():
    t=w['tags']; p=pts(w)
    if len(p)<2: continue
    h=t.get('highway','').replace('_link','')
    if t.get('waterway') in ('river','stream'): dr.line(p,fill=(60,110,200),width=3)
    if t.get('railway'): dr.line(p,fill=(80,0,120) if t['railway']!='construction' else (200,0,200),width=2)
    if h in col:
        c=col[h]
        if t.get('bridge')=='yes': c=(0,160,160)
        if t.get('tunnel') or t.get('layer','0').startswith('-'): c=(0,0,0)
        dr.line(p,fill=c,width=wid[h])
for nid,n in N.items():
    if n[2].get('highway')=='traffic_signals':
        p=P(nid); dr.ellipse([p[0]-4,p[1]-4,p[0]+4,p[1]+4],fill=(255,0,0))
font=ImageFont.load_default()
seen=set()
for w in W.values():
    t=w['tags']; n=t.get('name')
    if n and t.get('highway') in ('trunk','primary','secondary','tertiary') and n not in seen:
        p=pts(w); 
        if len(p)>=2:
            m=p[len(p)//2]; dr.text((m[0]+3,m[1]+3),n[:28],fill=(0,0,0),font=font); seen.add(n)
for nid,n in N.items():
    if n[2].get('name') and (n[2].get('place') or n[2].get('amenity') in ('college','cinema','theatre')):
        p=P(nid); dr.text((p[0],p[1]),n[2]['name'][:24],fill=(0,0,160),font=font)
im.save(sys.argv[1]); print(im.size)
