# Pack Poly Haven PBR sets (CC0) into vertically stacked JPEG strips, one per map type,
# loaded at runtime into WebGL2 texture arrays.
import sys, os, json
from PIL import Image, ImageOps, ImageEnhance, ImageStat
SRC = '/home/claude/assets_raw/ph/1k'
OUT = '/home/claude/nh48/assets/tex'
GROUND = ['asphalt_01', 'asphalt_02', 'interlocking_concrete_pavers', 'concrete_pavers_02', 'park_dirt',
          'leafy_grass', 'grass_path_2', 'dirty_concrete', 'forest_ground_04', 'road_damaged', 'castle_wall_varriation']
WALL = ['plastered_wall', 'white_stucco', 'beige_wall_002', 'concrete_wall_008', 'worn_plaster_wall', 'damaged_plaster',
        'exterior_wall_cladding', 'rectangular_facade_tiles', 'brick_wall_001', 'castle_wall_varriation',
        'large_sandstone_blocks_01', 'painted_metal_shutter', 'rusty_metal_shutter', 'corrugated_iron', 'bitumen',
        'clay_roof_tiles', 'dark_wooden_planks', 'concrete_floor_worn_001']
# layers whose colour comes from the building's paint: neutralise them to a light grey with the texture's detail
TINTABLE = {'plastered_wall', 'white_stucco', 'beige_wall_002', 'worn_plaster_wall', 'damaged_plaster', 'concrete_wall_008',
            'exterior_wall_cladding', 'painted_metal_shutter'}

def neutral(img):
    g = ImageOps.grayscale(img)
    mean = ImageStat.Stat(g).mean[0]
    g = ImageEnhance.Brightness(g).enhance(200.0 / max(1, mean))   # mean ~ 0.78
    g = ImageEnhance.Contrast(g).enhance(1.15)
    return g.convert('RGB')

def strip(names, kind, size, q, tint=False):
    img = Image.new('RGB', (size, size * len(names)))
    for i, n in enumerate(names):
        t = Image.open(f'{SRC}/{n}_{kind}.jpg').convert('RGB').resize((size, size), Image.LANCZOS)
        if tint and n in TINTABLE:
            t = neutral(t)
        img.paste(t, (0, i * size))
    return img

for name, names, sa in (('ground', GROUND, 1024), ('wall', WALL, 512)):
    a = strip(names, 'diff', sa, 86, tint=(name == 'wall'))
    a.save(f'{OUT}/{name}_alb.jpg', quality=86, optimize=True, progressive=True)
    strip(names, 'nor', 512, 90).save(f'{OUT}/{name}_nrm.jpg', quality=90, optimize=True)
    strip(names, 'arm', 256 if name == 'wall' else 512, 88).save(f'{OUT}/{name}_arm.jpg', quality=88, optimize=True)
# bark
for n in ('bark_brown_02', 'palm_bark'):
    for kind, sz in (('diff', 512), ('nor', 512)):
        Image.open(f'{SRC}/{n}_{kind}.jpg').convert('RGB').resize((sz, sz), Image.LANCZOS).save(f'{OUT}/{n}_{kind}.jpg', quality=86)
json.dump({'ground': GROUND, 'wall': WALL, 'tintable': sorted(TINTABLE)}, open(f'{OUT}/layers.json', 'w'), indent=1)
for f in sorted(os.listdir(OUT)):
    print(f, os.path.getsize(f'{OUT}/{f}') // 1024, 'KB')
