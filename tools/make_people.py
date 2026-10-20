# Blender (bpy) script: builds NH48's people from Quaternius' CC0 Universal Animation Library.
#   people_m.glb  male mannequin (decimated) + rig + hair/cap/helmet meshes + the animation set
#   people_f.glb  female mannequin (decimated) + rig + hair meshes (plays the same clips at runtime)
# Clothes are painted in the game's shader from the bind-pose position, so one body can be a
# shirt-and-trousers office worker, a kurta, a salwar suit or a traffic constable.
# usage: python3 tools/make_people.py [preview]   (needs the bpy module)
import bpy, math, os, sys
from mathutils import Vector

ROOT = '/home/claude/assets_raw/x'
UAL1 = ROOT + '/universal_animation_librarystandard/Animation Library[Standard]/Unreal Engine/AL_Standard.fbx'
UAL2 = ROOT + '/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unity/UAL2_Standard.fbx'
FEM = ROOT + '/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Female Mannequin/Unity/Mannequin_F.fbx'
OUT = '/home/claude/nh48/assets/people'
PREVIEW = '/tmp/claude-0/-home-claude/56ffc9d4-15dd-5b73-afc1-0de9d6a40ddb/scratchpad/people'
os.makedirs(OUT, exist_ok=True)

KEEP = {
    'idle': 'Idle_Loop', 'talk': 'Idle_Talking_Loop', 'walk': 'Walk_Loop', 'walk_formal': 'Walk_Formal_Loop',
    'jog': 'Jog_Fwd_Loop', 'sprint': 'Sprint_Loop', 'drive': 'Driving_Loop', 'sit_enter': 'Sitting_Enter',
    'sit': 'Sitting_Idle_Loop', 'sit_talk': 'Sitting_Talking_Loop', 'sit_exit': 'Sitting_Exit', 'interact': 'Interact',
    'pickup': 'PickUp_Table', 'punch': 'Punch_Jab', 'hit': 'Hit_Chest', 'death': 'Death01', 'push': 'Push_Loop',
    'dance': 'Dance_Loop', 'crouch': 'Crouch_Idle_Loop', 'fix': 'Fixing_Kneeling',
    'arms_folded': 'Idle_FoldArms_Loop', 'no': 'Idle_No_Loop', 'yes': 'Yes', 'phone': 'Idle_TalkingPhone_Loop',
    'wave': 'Idle_Rail_Call', 'drink': 'Consume', 'carry': 'Walk_Carry_Loop', 'knockback': 'Hit_Knockback',
    'getup': 'LayToIdle',
}

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=False)
    return [o for o in bpy.data.objects if o not in before]

def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)

def decimate(obj, target_tris):
    r = min(1.0, target_tris / max(1, tri_count(obj)))
    m = obj.modifiers.new('dec', 'DECIMATE')
    m.ratio = r
    m.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects: o.select_set(False)
    obj.select_set(True)
    # the armature modifier must stay last; move decimate to the top
    while obj.modifiers.find('dec') > 0:
        bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')

def head_box(body):
    """bounding box (world) of vertices mostly weighted to the head"""
    gi = body.vertex_groups['Head'].index
    lo, hi = Vector((9, 9, 9)), Vector((-9, -9, -9))
    for v in body.data.vertices:
        w = 0
        for g in v.groups:
            if g.group == gi: w = g.weight
        if w > 0.6:
            p = body.matrix_world @ v.co
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    return lo, hi

def shell(name, arm, verts, faces, weights):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for i, wl in enumerate(weights):
        for bone, w in wl:
            vg = ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
            vg.add([i], w, 'REPLACE')
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
    ob.parent = arm
    for p in me.polygons: p.use_smooth = True
    mat = bpy.data.materials.get('M_People') or bpy.data.materials.new('M_People')
    me.materials.append(mat)
    return ob

def ellipsoid(c, r, lat0, lat1, segs=18, rings=8, deform=None):
    """band of an ellipsoid between latitudes lat0..lat1 (0 = top); faces point outwards"""
    verts, faces = [], []
    for i in range(rings + 1):
        t = lat0 + (lat1 - lat0) * i / rings
        for j in range(segs):
            a = 2 * math.pi * j / segs
            p = Vector((math.sin(t) * math.cos(a) * r.x, math.sin(t) * math.sin(a) * r.y, math.cos(t) * r.z))
            if deform: p = deform(p, i / rings, a)
            verts.append(tuple(c + p))
    for i in range(rings):
        for j in range(segs):
            a, b = i * segs + j, i * segs + (j + 1) % segs
            faces.append((a, c_idx(b, segs), c_idx(b, segs) + segs, a + segs) if False else (a, a + segs, b + segs, b))
    if lat0 < 1e-3:
        pass
    return verts, faces

def c_idx(b, segs): return b

def merge(*parts):
    V, F = [], []
    for v, f in parts:
        o = len(V); V += v; F += [tuple(i + o for i in fc) for fc in f]
    return V, F

def accessories(arm, body, female):
    lo, hi = head_box(body)
    c = (lo + hi) / 2
    size = hi - lo
    print('head box', tuple(round(x, 3) for x in lo), tuple(round(x, 3) for x in hi))
    R = Vector((size.x / 2 * 1.08, size.y / 2 * 1.1, size.z / 2 * 1.06))
    top = c + Vector((0, 0.008, 0.012))
    out = []
    head_w = lambda n: [[('Head', 1.0)] for _ in range(n)]
    if not female:
        # short side-parted hair: crown cap down to above the ears, a bit lower at the back
        def short(p, f, a):
            if p.y > 0: p.z -= 0.035 * f * (p.y / R.y)
            if p.y < -R.y * 0.6 and p.z < R.z * 0.2: p.z += 0.02    # keep the forehead clear
            return p
        v, f = ellipsoid(top, R, 0.0, 1.45, deform=short)
        out.append(shell('hair_short', arm, v, f, head_w(len(v))))
        # traffic constable's white cap: drum + visor
        cv, cf = ellipsoid(top + Vector((0, 0, 0.045)), Vector((R.x * 1.05, R.y * 1.08, R.z * 0.55)), 0.0, 1.6)
        vv = []; vf = []
        n = 12
        for j in range(n + 1):
            a = math.pi * (0.15 + 0.7 * j / n)
            for rr in (0.0, 1.0):
                rad = R.x * (0.9 + 0.55 * rr)
                vv.append((c.x + math.cos(a) * rad, c.y - math.sin(a) * rad * 0.95 - 0.02 * rr, top.z + 0.025 - 0.02 * rr))
        for j in range(n):
            a = j * 2; vf.append((a, a + 2, a + 3, a + 1))
        V, F = merge((cv, cf), (vv, vf))
        out.append(shell('cap_police', arm, V, F, head_w(len(V))))
    else:
        # long hair: cap + a fall down the back to the shoulder blades (weighted head -> spine)
        def longh(p, f, a):
            if p.y > -R.y * 0.2: p.z -= 0.11 * f * max(0, (p.y + R.y * 0.2) / (R.y * 1.2))
            if p.y < -R.y * 0.6 and p.z < R.z * 0.25: p.z += 0.025
            return p
        v, f = ellipsoid(top, R, 0.0, 1.55, rings=10, deform=longh)
        w = [[('Head', 1.0)] if vz > c.z - 0.08 else [('Head', 0.6), ('neck_01', 0.4)] for (_, _, vz) in v]
        out.append(shell('hair_long', arm, v, f, w))
        # braid / plait
        bv, bf = [], []
        steps, segs = 9, 6
        for i in range(steps + 1):
            z = c.z - 0.02 - i * 0.045
            yb = c.y + R.y * 0.95 + i * 0.006
            rr = 0.03 * (1 - i / (steps * 1.4))
            for j in range(segs):
                a = 2 * math.pi * j / segs
                bv.append((c.x + math.cos(a) * rr, yb + math.sin(a) * rr, z))
        for i in range(steps):
            for j in range(segs):
                a, b = i * segs + j, i * segs + (j + 1) % segs
                bf.append((a, b, b + segs, a + segs))
        bw = [[('Head', 1.0)] if vz > c.z - 0.1 else [('neck_01', 0.5), ('spine_03', 0.5)] for (_, _, vz) in bv]
        V = v + bv; F = f + [tuple(i + len(v) for i in fc) for fc in bf]
        out.append(shell('hair_braid', arm, V, F, w + bw))
    # two-wheeler helmet (both): bigger shell + visor band
    hv, hf = ellipsoid(c + Vector((0, 0.005, 0.01)), Vector((R.x * 1.28, R.y * 1.3, R.z * 1.22)), 0.0, 1.9)
    out.append(shell('helmet', arm, hv, hf, head_w(len(hv))))
    return out

def keep_actions():
    names = {a.name.split('|')[-1]: a for a in bpy.data.actions}
    keep = []
    for game, src in KEEP.items():
        a = names.get(src)
        if not a: print('missing action', src); continue
        a.name = game; a.use_fake_user = True; keep.append(a)
    for a in list(bpy.data.actions):
        if a not in keep: bpy.data.actions.remove(a)
    return keep

def strip_fingers(actions):
    # finger curls aren't readable at game distances; keep thumbs/index for the driving grip
    drop = ('middle_', 'ring_', 'pinky_')
    for a in actions:
        fcs = a.fcurves if hasattr(a, 'fcurves') else None
        if fcs is None:
            try: fcs = a.layers[0].strips[0].channelbags[0].fcurves
            except Exception: continue
        for fc in list(fcs):
            if any(d in fc.data_path for d in drop): fcs.remove(fc)

def export(path, objs, with_anim):
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=with_anim,
                              export_animation_mode='ACTIONS', export_skins=True, export_morph=False, export_materials='EXPORT',
                              export_yup=True, export_apply=False, export_force_sampling=True, export_optimize_animation_size=True,
                              export_def_bones=False, export_extras=False, export_cameras=False, export_lights=False)
    print('wrote', path, os.path.getsize(path) // 1024, 'KB')

def render(arm, objs, tag, poses):
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.render.resolution_x = 320; scn.render.resolution_y = 480
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam)
    cam.location = (2.2, -4.0, 1.25); cam.rotation_euler = (math.radians(84), 0, math.radians(29)); cam.data.lens = 45
    scn.camera = cam
    os.makedirs(PREVIEW, exist_ok=True)
    arm.animation_data_create()
    for name, frame in poses:
        a = bpy.data.actions.get(name)
        if not a: continue
        arm.animation_data.action = a
        if hasattr(arm.animation_data, 'action_slot') and a.slots: arm.animation_data.action_slot = a.slots[0]
        scn.frame_set(int(a.frame_range[0] + (a.frame_range[1] - a.frame_range[0]) * frame))
        scn.render.filepath = f'{PREVIEW}/{tag}_{name}.png'
        bpy.ops.render.render(write_still=True)
    arm.animation_data.action = None

def build(female):
    clear()
    objs = import_fbx(FEM if female else UAL2)
    arm = next(o for o in objs if o.type == 'ARMATURE')
    for o in objs:
        if o.type == 'MESH' and o.name.lower().startswith('ico'): bpy.data.objects.remove(o)
    body = next(o for o in bpy.data.objects if o.type == 'MESH')
    body.name = 'body_f' if female else 'body_m'
    if not female:
        objs1 = import_fbx(UAL1)
        for o in objs1: bpy.data.objects.remove(o)
    print('tris before', tri_count(body))
    decimate(body, 3600)
    print('tris after', tri_count(body))
    mat = bpy.data.materials.new('M_People')
    body.data.materials.clear(); body.data.materials.append(mat)
    acc = accessories(arm, body, female)
    acts = keep_actions() if not female else []
    if not female: strip_fingers(acts)
    if '--preview' in sys.argv:
        poses = [('idle', 0.3), ('walk', 0.25), ('drive', 0.5), ('sit', 0.5), ('phone', 0.5), ('punch', 0.5), ('push', 0.4), ('drink', 0.5)]
        if female:
            # borrow the male clips for a check render
            pass
        for o in acc: o.hide_render = o.name not in ('hair_short', 'hair_long')
        render(arm, [body] + acc, 'f' if female else 'm', poses if not female else [])
    if female:
        for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    export(f'{OUT}/people_{"f" if female else "m"}.glb', [arm, body] + acc, not female)

if __name__ == '__main__':
    build(False)
    build(True)
