# Blender (bpy) script: NH48's people from Quaternius' CC0 Universal Base Characters + Universal
# Animation Library (same 65-bone rig, so every clip plays on both bodies).
#   assets/people/people_m.glb   male body, eyes, brows, hair (parted / buzzed / beard), cap, helmet + clips
#   assets/people/people_f.glb   female body, eyes, brows, hair (long / buns / short), helmet
#   assets/people/skin_m.jpg, skin_f.jpg, hair.jpg   textures (1024 px)
# Clothes are painted in the game's shader from the bind-pose position (see src/people/humans.js);
# skin tone is a tint over the texture's light-skin detail, so faces keep their features.
# usage: blender -b -P tools/make_people2.py  (or python3 with the bpy module)   [-- --preview]
import bpy, math, os, sys, json
from mathutils import Vector

UBC = '/home/claude/assets_raw/ubc/Universal Base Characters[Standard]'
BODY = UBC + '/Base Characters/Godot - UE/Superhero_{g}_FullBody.gltf'
HAIR = UBC + '/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/{n}.gltf'
UAL1 = '/home/claude/assets_raw/x/universal_animation_librarystandard/Animation Library[Standard]/Unreal Engine/AL_Standard.fbx'
UAL2 = '/home/claude/assets_raw/x/universal_animation_library_2standard/Universal Animation Library 2 [Standard]/Unity/UAL2_Standard.fbx'
OUT = '/home/claude/nh48/assets/people'
PREVIEW = '/tmp/claude-0/-home-claude/56ffc9d4-15dd-5b73-afc1-0de9d6a40ddb/scratchpad/people2'
os.makedirs(OUT, exist_ok=True); os.makedirs(PREVIEW, exist_ok=True)

KEEP = {
    'idle': 'Idle_Loop', 'talk': 'Idle_Talking_Loop', 'walk': 'Walk_Loop', 'walk_formal': 'Walk_Formal_Loop',
    'jog': 'Jog_Fwd_Loop', 'sprint': 'Sprint_Loop', 'drive': 'Driving_Loop', 'sit_enter': 'Sitting_Enter',
    'sit': 'Sitting_Idle_Loop', 'sit_talk': 'Sitting_Talking_Loop', 'sit_exit': 'Sitting_Exit', 'interact': 'Interact',
    'pickup': 'PickUp_Table', 'punch': 'Punch_Jab', 'hit': 'Hit_Chest', 'death': 'Death01', 'push': 'Push_Loop',
    'dance': 'Dance_Loop', 'crouch': 'Crouch_Idle_Loop', 'fix': 'Fixing_Kneeling',
    'arms_folded': 'Idle_FoldArms_Loop', 'no': 'Idle_No_Loop', 'yes': 'Yes', 'phone': 'Idle_TalkingPhone_Loop',
    'wave': 'Idle_Rail_Call', 'drink': 'Consume', 'carry': 'Walk_Carry_Loop', 'knockback': 'Hit_Knockback',
    'getup': 'LayToIdle',
    # new: jumping and climbing
    'jump_start': 'Jump_Start', 'jump_loop': 'Jump_Loop', 'jump_land': 'Jump_Land', 'climb': 'ClimbUp_1m_RM',
    'roll': 'Roll',
    # fighting
    'cross': 'Punch_Cross', 'hook': 'Melee_Hook', 'hit_head': 'Hit_Head', 'block': 'Sword_Block',
    # water
    'swim': 'Swim_Fwd_Loop', 'swim_idle': 'Swim_Idle_Loop',
}
HAIRS = {'m': ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Beard'],
         'f': ['Hair_Long', 'Hair_Buns', 'Hair_BuzzedFemale']}
LIGHT = {'m': UBC + '/Base Characters/Textures/T_Superhero_Male_Ligh.png', 'f': UBC + '/Base Characters/Textures/T_Superhero_Female_Light_BaseColor.png'}

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def imp_gltf(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def imp_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=False)
    return [o for o in bpy.data.objects if o not in before]

def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)

def bind_to(obj, arm):
    """re-target a mesh's armature modifier/parent to our armature, keeping its world shape"""
    mw = obj.matrix_world.copy()
    for m in obj.modifiers:
        if m.type == 'ARMATURE': m.object = arm
    if not any(m.type == 'ARMATURE' for m in obj.modifiers):
        m = obj.modifiers.new('Armature', 'ARMATURE'); m.object = arm
        if 'Head' not in obj.vertex_groups:
            vg = obj.vertex_groups.new(name='Head'); vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    obj.parent = arm
    obj.matrix_world = mw

def bone_heights(arm):
    out = {}
    for b in arm.data.bones:
        h = arm.matrix_world @ b.head_local
        out[b.name] = [round(h.x, 4), round(h.y, 4), round(h.z, 4)]
    return out

def keep_actions():
    names = {a.name.split('|')[-1]: a for a in bpy.data.actions}
    keep = []
    for game, src in KEEP.items():
        a = names.get(src)
        if not a:
            cand = [n for n in names if n.lower().startswith(src.lower().split('_')[0])]
            print('missing action', src, 'similar:', cand[:8]); continue
        a.name = game; a.use_fake_user = True; keep.append(a)
    for a in list(bpy.data.actions):
        if a not in keep: bpy.data.actions.remove(a)
    return keep

def strip_fingers(actions):
    drop = ('middle_', 'ring_', 'pinky_')
    for a in actions:
        fcs = a.fcurves if hasattr(a, 'fcurves') else None
        if fcs is None:
            try: fcs = a.layers[0].strips[0].channelbags[0].fcurves
            except Exception: continue
        for fc in list(fcs):
            if any(d in fc.data_path for d in drop): fcs.remove(fc)

def head_box(body):
    gi = body.vertex_groups['Head'].index
    lo, hi = Vector((9, 9, 9)), Vector((-9, -9, -9))
    for v in body.data.vertices:
        w = sum(g.weight for g in v.groups if g.group == gi)
        if w > 0.6:
            p = body.matrix_world @ v.co
            lo = Vector(map(min, lo, p)); hi = Vector(map(max, hi, p))
    return lo, hi

def ellipsoid(c, r, lat0, lat1, segs=20, rings=9):
    verts, faces = [], []
    for i in range(rings + 1):
        t = lat0 + (lat1 - lat0) * i / rings
        for j in range(segs):
            a = 2 * math.pi * j / segs
            verts.append(tuple(c + Vector((math.sin(t) * math.cos(a) * r.x, math.sin(t) * math.sin(a) * r.y, math.cos(t) * r.z))))
    for i in range(rings):
        for j in range(segs):
            a, b = i * segs + j, i * segs + (j + 1) % segs
            faces.append((a, a + segs, b + segs, b))
    return verts, faces

def shell(name, arm, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    vg = ob.vertex_groups.new(name='Head'); vg.add(list(range(len(verts))), 1.0, 'REPLACE')
    m = ob.modifiers.new('Armature', 'ARMATURE'); m.object = arm; ob.parent = arm
    for p in me.polygons: p.use_smooth = True
    mat = bpy.data.materials.get('M_Acc') or bpy.data.materials.new('M_Acc'); me.materials.append(mat)
    return ob

def headgear(arm, body, male):
    lo, hi = head_box(body)
    c = (lo + hi) / 2; s = hi - lo
    R = Vector((s.x / 2 * 1.12, s.y / 2 * 1.14, s.z / 2 * 1.08))
    out = []
    hv, hf = ellipsoid(c + Vector((0, 0.005, 0.015)), Vector((R.x * 1.25, R.y * 1.25, R.z * 1.15)), 0.0, 1.9)
    out.append(shell('helmet', arm, hv, hf))
    if male:
        top = c + Vector((0, 0, R.z * 0.55))
        cv, cf = ellipsoid(top, Vector((R.x * 1.06, R.y * 1.1, R.z * 0.5)), 0.0, 1.6)
        n = 12; vv = []; vf = []
        for j in range(n + 1):
            a = math.pi * (0.15 + 0.7 * j / n)
            for rr in (0.0, 1.0):
                rad = R.x * (0.9 + 0.55 * rr)
                vv.append((c.x + math.cos(a) * rad, c.y - math.sin(a) * rad * 0.95 - 0.02 * rr, top.z - 0.01 - 0.02 * rr))
        for j in range(n): a = j * 2; vf.append((a, a + 2, a + 3, a + 1))
        o = len(cv); out.append(shell('cap_police', arm, cv + vv, cf + [tuple(i + o for i in f) for f in vf]))
    print('head box', tuple(round(x, 3) for x in lo), tuple(round(x, 3) for x in hi))
    return out

def save_tex(img_name_part, out_name, size=1024):
    img = next((i for i in bpy.data.images if img_name_part.lower() in i.name.lower()), None)
    if not img: print('no image', img_name_part); return None
    img = img.copy(); img.scale(size, size)
    img.filepath_raw = f'{OUT}/{out_name}'; img.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 86
    img.save_render(f'{OUT}/{out_name}', scene=bpy.context.scene) if hasattr(img, 'save_render') else img.save()
    print('wrote', out_name, os.path.getsize(f'{OUT}/{out_name}') // 1024, 'KB')
    return out_name

def render(arm, tag, poses):
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'; scn.display.shading.color_type = 'TEXTURE'
    scn.render.resolution_x = 360; scn.render.resolution_y = 520
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam)
    cam.location = (1.6, -3.4, 1.15); cam.rotation_euler = (math.radians(86), 0, math.radians(25)); cam.data.lens = 50
    scn.camera = cam
    arm.animation_data_create()
    for name, frame in poses:
        a = bpy.data.actions.get(name) if name != 'rest' else None
        arm.animation_data.action = a
        if a and hasattr(arm.animation_data, 'action_slot') and a.slots: arm.animation_data.action_slot = a.slots[0]
        if a: scn.frame_set(int(a.frame_range[0] + (a.frame_range[1] - a.frame_range[0]) * frame))
        scn.render.filepath = f'{PREVIEW}/{tag}_{name}.png'
        bpy.ops.render.render(write_still=True)
    arm.animation_data.action = None


# ---------------------------------------------------------------- real clothes (shells over the body)
LM = {'m': dict(hip=0.95, neck=1.535, shoulder=0.21, wrist=0.70, ankle=0.10, knee=0.54),
      'f': dict(hip=0.93, neck=1.495, shoulder=0.15, wrist=0.64, ankle=0.09, knee=0.53)}

def shell_from_body(body, name, keep, push=0.014, smooth=18):
    import bmesh
    ob = body.copy(); ob.data = body.data.copy(); ob.name = name
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    mw = ob.matrix_world
    dead = [f for f in bm.faces if not all(keep(mw @ v.co) for v in f.verts)]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # hems and cuffs stay where they are: smoothing only moves vertices 3+ rings in from an edge
    bm.verts.ensure_lookup_table(); bm.verts.index_update()
    pinned = set(v.index for v in bm.verts if v.is_boundary)
    for _ in range(3):
        pinned |= set(e.other_vert(bm.verts[i]).index for i in list(pinned) for e in bm.verts[i].link_edges)
    bm.to_mesh(ob.data); bm.free()
    vg = ob.vertex_groups.new(name='smooth_free')
    vg.add([i for i in range(len(ob.data.vertices)) if i not in pinned], 1.0, 'REPLACE')
    # push out, melt the muscles away, push out again: cloth, not body paint
    for mod in list(ob.modifiers):
        if mod.type != 'ARMATURE': ob.modifiers.remove(mod)
    def add(t, **kw):
        m = ob.modifiers.new(t.lower(), t)
        for k, v in kw.items(): setattr(m, k, v)
        bpy.context.view_layer.objects.active = ob
        while ob.modifiers.find(m.name) > 0: bpy.ops.object.modifier_move_up(modifier=m.name)
        bpy.ops.object.modifier_apply(modifier=m.name)
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True)
    add('DISPLACE', strength=push * 0.8, mid_level=0.0)
    add('SMOOTH', factor=1.0, iterations=smooth, vertex_group='smooth_free')
    add('DISPLACE', strength=push * 0.9, mid_level=0.0)
    add('SMOOTH', factor=0.5, iterations=6, vertex_group='smooth_free')
    ob.vertex_groups.remove(ob.vertex_groups['smooth_free'])
    ob.data.materials.clear()
    mat = bpy.data.materials.get('M_Cloth') or bpy.data.materials.new('M_Cloth'); ob.data.materials.append(mat)
    for p in ob.data.polygons: p.use_smooth = True
    print('cloth', name, len(ob.data.vertices), 'verts')
    return ob

def skirt(arm, body, name, z0, z1, flare, g):
    """a tube from the waist down (kurta hem or saree), skinned to the pelvis and legs"""
    mw = body.matrix_world
    pts = [mw @ v.co for v in body.data.vertices]
    rings, segs = 10, 28
    verts, faces, wts = [], [], []
    for i in range(rings + 1):
        z = z0 + (z1 - z0) * i / rings
        band = [p for p in pts if abs(p.z - z) < 0.03 and abs(p.x) < 0.3]
        rx = max((abs(p.x) for p in band), default=0.17) + 0.05
        ry = max((abs(p.y - 0.03) for p in band), default=0.12) + 0.045
        f = i / rings
        rx = max(rx, 0.17) + flare * f; ry = max(ry, 0.12) + flare * 0.8 * f
        for j in range(segs):
            a = 2 * math.pi * j / segs
            x, y = math.cos(a) * rx, 0.03 + math.sin(a) * ry
            verts.append((x, y, z))
            side = max(0.0, min(1.0, 0.5 + x / (2 * rx)))       # 1 = left leg (+x)
            leg = min(1.0, f * 1.2)
            thigh = 'thigh_l', 'thigh_r'
            w = [('pelvis', 1.0 - leg * 0.85)]
            if leg > 0: w += [('thigh_l', leg * 0.85 * side), ('thigh_r', leg * 0.85 * (1 - side))]
            wts.append(w)
    for i in range(rings):
        for j in range(segs):
            a, b = i * segs + j, i * segs + (j + 1) % segs
            faces.append((a, b, b + segs, a + segs))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for i, wl in enumerate(wts):
        for bn, w in wl:
            if w <= 0.001: continue
            vg = ob.vertex_groups.get(bn) or ob.vertex_groups.new(name=bn); vg.add([i], w, 'REPLACE')
    m = ob.modifiers.new('Armature', 'ARMATURE'); m.object = arm; ob.parent = arm
    for p in me.polygons: p.use_smooth = True
    me.materials.append(bpy.data.materials.get('M_Cloth') or bpy.data.materials.new('M_Cloth'))
    print('cloth', name, len(verts), 'verts')
    return ob

def clothes(arm, body, g):
    L = LM[g]; out = []
    hip, neck, sh, wr = L['hip'], L['neck'], L['shoulder'], L['wrist']
    def top(sleeve):
        end = sh + sleeve * (wr - sh)
        def keep(p):
            ax = abs(p.x)
            if p.z > neck - 0.005 or p.z < hip - 0.08: return False
            if ax > sh + 0.02 and p.z > neck - 0.32:      # the arm (T-pose)
                return ax <= end
            return ax < sh + 0.08
        return keep
    out.append(shell_from_body(body, 'cloth_top_short', top(0.38), push=0.013, smooth=45))
    out.append(shell_from_body(body, 'cloth_top_long', top(0.93), push=0.013, smooth=45))
    out.append(shell_from_body(body, 'cloth_shoes', lambda p: p.z < L['ankle'] + 0.015, push=0.012, smooth=6))
    out.append(shell_from_body(body, 'cloth_pants', lambda p: L['ankle'] < p.z < hip + 0.05 and abs(p.x) < 0.3, push=0.012, smooth=12))
    out.append(skirt(arm, body, 'cloth_kurta', hip + 0.02, L['knee'], 0.06, g))
    out.append(skirt(arm, body, 'cloth_saree', hip + 0.06, L['ankle'] + 0.01, 0.05, g))    # men can wear one too
    return out

def build(g):
    male = g == 'm'
    clear()
    objs = imp_gltf(BODY.format(g='Male' if male else 'Female'))
    arm = next(o for o in objs if o.type == 'ARMATURE')
    meshes = [o for o in objs if o.type == 'MESH']
    body = max(meshes, key=lambda o: len(o.data.vertices))
    body.name = 'body_' + g
    for o in list(meshes):
        if o is not body and not o.data.materials: bpy.data.objects.remove(o); meshes.remove(o)
    # light-skin texture: the game tints it to Indian skin tones (the dark one can't be lightened well)
    lt = bpy.data.images.load(LIGHT[g])
    for m in body.data.materials:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and 'normal' not in n.image.name.lower() and 'rough' not in n.image.name.lower(): n.image = lt
    for o in meshes:
        if o is body: continue
        mats = [m.name for m in o.data.materials if m]
        o.name = 'eyes' if any('Eye' in m for m in mats) else 'face_' + o.name
        print('extra mesh', o.name, mats, len(o.data.vertices))
    print('body tris', tris(body), 'mats', [m.name for m in body.data.materials if m])
    hairs = []
    for n in HAIRS[g]:
        ho = imp_gltf(HAIR.format(n=n))
        for o in ho:
            if o.type == 'MESH':
                o.name = n.lower().replace('hair_', 'hair_').replace('eyebrows_', 'brows_')
                bind_to(o, arm); hairs.append(o)
        for o in ho:
            if o.type == 'ARMATURE': bpy.data.objects.remove(o)
    acc = headgear(arm, body, male)
    cl = clothes(arm, body, g)
    # clips (male file only; the female body plays the same clips at runtime)
    acts = []
    if male:
        for p in (UAL1, UAL2):
            for o in imp_fbx(p):
                bpy.data.objects.remove(o)
        acts = keep_actions()
    else:
        for p in (UAL1,):
            for o in imp_fbx(p): bpy.data.objects.remove(o)
        acts = keep_actions()
    meta = {'bones': bone_heights(arm), 'tris': tris(body)}
    json.dump(meta, open(f'{PREVIEW}/meta_{g}.json', 'w'))
    if '--preview' in sys.argv:
        render(arm, g, [('rest', 0), ('idle', 0.3), ('walk', 0.25), ('drive', 0.5), ('jump_loop', 0.5), ('climb', 0.5)])
    if not male:
        for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    else:
        # the exporter only finds actions on an armature that has animation data
        arm.animation_data_create()
        a0 = bpy.data.actions.get('idle')
        arm.animation_data.action = a0
        if a0 and hasattr(arm.animation_data, 'action_slot') and a0.slots: arm.animation_data.action_slot = a0.slots[0]
    # textures: base colour only (the game shades skin and clothes itself), 1024 px body, 512 hair, 256 eyes
    for mat in bpy.data.materials:
        if not mat.use_nodes: continue
        nt = mat.node_tree
        for n in list(nt.nodes):
            if n.type == 'TEX_IMAGE' and n.image and any(k in n.image.name.lower() for k in ('normal', 'rough')): nt.nodes.remove(n)
            elif n.type == 'NORMAL_MAP': nt.nodes.remove(n)
    for img in bpy.data.images:
        if img.size[0] <= 0: continue
        nm = img.name.lower(); s = 256 if 'eye' in nm else 512 if 'hair' in nm else 1024
        if img.size[0] > s: img.scale(s, s)
    for o in bpy.context.selected_objects: o.select_set(False)
    keep = [arm, body] + [o for o in bpy.data.objects if o.type == 'MESH' and o not in (body,) and o.parent == arm]
    for o in keep: o.select_set(True)
    path = f'{OUT}/people_{g}.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_animations=male,
                              export_animation_mode='ACTIONS', export_skins=True, export_morph=False, export_materials='EXPORT',
                              export_image_format='JPEG', export_jpeg_quality=82, export_texture_dir='',
                              export_yup=True, export_apply=False, export_force_sampling=True, export_optimize_animation_size=True,
                              export_def_bones=False, export_extras=False, export_cameras=False, export_lights=False)
    print('wrote', path, os.path.getsize(path) // 1024, 'KB')

if __name__ == '__main__':
    which = [a for a in sys.argv if a in ('m', 'f')] or ['m', 'f']
    for g in which: build(g)
