# Blender (bpy) script: NH48's animals from Quaternius' CC0 packs (Animal Pack Vol.2, Farm Animals).
#   dog.glb   street dog (the pack's dog, re-coloured at runtime as an Indie: fawn, black, patchy)
#   cat.glb   cat
#   cow.glb   cow (re-coloured off-white like the zebu cows that wander Pune's lanes)
#   kite.glb  the pack's eagle, re-coloured dark brown: the black kites (ghar) circling over the city
# Each is scaled to real size, keeps its material colours and its clips (renamed Idle/Walk/Run/...).
# usage: python3 tools/make_animals.py
import bpy, os

SRC = '/home/claude/assets_raw/x/animals'
OUT = '/home/claude/nh48/assets/animals'
os.makedirs(OUT, exist_ok=True)

JOBS = [
    # name, blend file, target height (m) of the standing model, clip renames, kite colours
    ('dog', 'Animal Pack Vol.2 by @Quaternius/Blends/Dog.blend', 0.72, {'Idle': 'Idle', 'Walking': 'Walk'}),
    ('cat', 'Animal Pack Vol.2 by @Quaternius/Blends/Cat.blend', 0.34, {'Idle': 'Idle', 'Walking': 'Walk'}),
    ('cow', 'Farm Animals by @Quaternius/Blends/Cow.blend', 1.5, {'Idle': 'Idle', 'Walk': 'Walk', 'WalkSlow': 'WalkSlow'}),
    ('kite', 'Animal Pack Vol.2 by @Quaternius/Blends/Eagle.blend', 0.5, None),
]

def world_bbox(objs):
    import mathutils
    lo = mathutils.Vector((1e9, 1e9, 1e9)); hi = -lo
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            lo = mathutils.Vector(map(min, lo, w)); hi = mathutils.Vector(map(max, hi, w))
    return lo, hi

for name, blend, height, clips in JOBS:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(SRC, blend))
    arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not arms or not meshes:
        print('skip', name, 'no armature/mesh'); continue
    arm = arms[0]
    # make sure we measure the rest pose
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    lo, hi = world_bbox(meshes)
    size = hi - lo
    print(name, 'bbox', tuple(round(v, 2) for v in size), 'actions', [a.name for a in bpy.data.actions])
    # scale: by height for walkers; the kite by its length (wingspan sets itself)
    h = size.z if name != 'kite' else max(size.x, size.y)
    k = height / h if name != 'kite' else 0.55 / h
    tops = [o for o in bpy.data.objects if o.parent is None and o.type in ('ARMATURE', 'MESH', 'EMPTY')]
    for o in tops:
        o.scale = (o.scale[0] * k, o.scale[1] * k, o.scale[2] * k)
        o.location = (o.location[0] * k, o.location[1] * k, o.location[2] * k)
    arm.data.pose_position = 'POSE'
    bpy.context.view_layer.update()
    # clips: keep and rename
    keep = []
    for a in list(bpy.data.actions):
        short = a.name.split('|')[-1]
        if clips is None:
            if a.frame_range[1] - a.frame_range[0] < 4: bpy.data.actions.remove(a); continue
            a.name = 'Fly'; a.use_fake_user = True; keep.append(a); continue
        if short in clips: a.name = clips[short]; a.use_fake_user = True; keep.append(a)
        else: bpy.data.actions.remove(a)
    if arm.animation_data is None: arm.animation_data_create()
    arm.animation_data.action = keep[0] if keep else None
    for o in bpy.data.objects: o.select_set(o in meshes or o is arm)
    for m in bpy.data.materials:
        if m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    c = n.inputs['Base Color'].default_value
                    print('   mat', m.name, tuple(round(v, 3) for v in c[:3]))
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=True,
                              export_animation_mode='ACTIONS', export_skins=True, export_morph=False, export_materials='EXPORT',
                              export_yup=True, export_apply=False, export_force_sampling=True, export_optimize_animation_size=True,
                              export_def_bones=False, export_extras=False, export_cameras=False, export_lights=False)
    print('wrote', path, os.path.getsize(path) // 1024, 'KB', 'clips', [a.name for a in keep])
