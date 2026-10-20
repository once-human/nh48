# Merge tiled OSM XML (API 0.6 map calls) into one JSON with nodes/ways/relations.
import xml.etree.ElementTree as ET, glob, json, sys
nodes={}; ways={}; rels={}
for fn in sorted(glob.glob(sys.argv[1]+'/*.osm')):
    root=ET.parse(fn).getroot()
    for el in root:
        if el.tag=='node':
            i=int(el.get('id'))
            tags={t.get('k'):t.get('v') for t in el.findall('tag')}
            nodes[i]=(float(el.get('lat')),float(el.get('lon')),tags)
        elif el.tag=='way':
            i=int(el.get('id'))
            ways[i]={'nd':[int(n.get('ref')) for n in el.findall('nd')],'tags':{t.get('k'):t.get('v') for t in el.findall('tag')}}
        elif el.tag=='relation':
            i=int(el.get('id'))
            rels[i]={'members':[(m.get('type'),int(m.get('ref')),m.get('role')) for m in el.findall('member')],'tags':{t.get('k'):t.get('v') for t in el.findall('tag')}}
out={'nodes':{str(k):v for k,v in nodes.items()},'ways':{str(k):v for k,v in ways.items()},'rels':{str(k):v for k,v in rels.items()}}
json.dump(out,open(sys.argv[2],'w'))
print('nodes',len(nodes),'ways',len(ways),'rels',len(rels))
