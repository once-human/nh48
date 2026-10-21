// Animated people: Quaternius' CC0 Universal Base Characters (a real face, eyes, brows and hair)
// on the Universal Animation Library rig (65 bones, the same clips on both bodies).
// Clothes are painted in the shader from the bind-pose (T-pose) position: shirt or kurta, trousers
// or salwar or saree, sleeve length, footwear. Skin is a tint over the texture's own skin detail,
// so lips, eyelids and knuckles survive while the tone becomes any Indian complexion.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { RNG } from '../core/util.js';

// Indian complexions (sRGB): fair, wheatish, medium, brown, deep brown
export const SKIN = [0xe2b394, 0xd6a17c, 0xc98f68, 0xb87b55, 0xa36945, 0x8a5636];
const SKIN_W = [1, 3, 3, 2.2, 1.2, 0.4];
const SHIRT = [0xf2f0ea, 0x5f86b8, 0xbf3f3a, 0x2b3550, 0xe9cf7a, 0x3f7a52, 0x8a3a74, 0xe08a35, 0x8e9093, 0x1f2024, 0xbfd0e2, 0xd9a7a7, 0x6a4c93, 0x2f6f73, 0xc7b89a];
const PANTS = [0x232a3d, 0x342f2a, 0x7a6c58, 0x1b1c1f, 0x4b5363, 0xd9d2c0, 0x3b4a5c, 0x2c3e66];
const KURTA = [0xe9e2cf, 0xf4d58d, 0xd1495b, 0x2e86ab, 0x7a9e7e, 0xf28f3b, 0x8e5572, 0xffffff, 0x3d405b, 0xc8553d];
const SALWAR = [0xf4f1ea, 0x2f2f33, 0xd9c7a3, 0x8e5572, 0x3d405b];
const SAREE = [0xc1121f, 0xf77f00, 0x2a9d8f, 0x7b2cbf, 0xffb703, 0x1d4e89, 0xe5989b, 0x9d0208, 0x386641];
const HAIR = [0x0d0b0a, 0x15110f, 0x1f1814, 0x2a201a, 0x6b6560, 0xb0aaa2];
const HAIR_M = ['hair_simpleparted', 'hair_simpleparted', 'hair_buzzed'];
const HAIR_F = ['hair_long', 'hair_long', 'hair_buns', 'hair_buzzedfemale'];
const c = (h) => new THREE.Color(h).convertSRGBToLinear();

// bind-pose landmarks (metres, glTF y-up, the body faces +z)
const BODY = {
  m: { hip: 0.95, neck: 1.55, armY: 1.30, shoulder: 0.21, wrist: 0.70 },
  f: { hip: 0.93, neck: 1.51, armY: 1.27, shoulder: 0.15, wrist: 0.64 },
};

function patchBody(mat) {
  mat.onBeforeCompile = (sh) => {
    const u = mat.userData;
    Object.assign(sh.uniforms, { uTop: { value: u.top }, uBottom: { value: u.bottom }, uSkin: { value: u.skin }, uShoe: { value: u.shoe },
      uCut: { value: u.cut }, uBindM: { value: u.bindM }, uBody: { value: u.body }, uArms: { value: u.arms } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind; uniform mat4 uBindM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = (uBindM * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vBind; uniform vec3 uTop, uBottom, uSkin, uShoe; uniform vec4 uCut, uBody, uArms;`)
      .replace('#include <map_fragment>', `
      vec3 tex = texture2D(map, vMapUv).rgb;
      // uBody: hip, neck, arm height, ankle; uArms: shoulder x, wrist x
      vec3 p = vBind; float ax = abs(p.x);
      float hip = uBody.x, neck = uBody.y;
      // skin keeps the texture's detail relative to its own (light-tan) skin
      const vec3 REF = vec3(0.40, 0.18, 0.085);
      float l = dot(tex, vec3(0.3, 0.55, 0.15)) / dot(REF, vec3(0.3, 0.55, 0.15));
      vec3 skin = uSkin * mix(vec3(l), tex / REF, 0.2);
      skin = mix(vec3(dot(skin, vec3(0.3, 0.55, 0.15))), skin, 0.82);
      vec3 col = skin;
      float cloth = 0.0;
      bool arm = ax > uArms.x && p.y > uBody.z;
      if (arm) {
        // sleeve: uCut.x is how far down the arm it reaches (0 sleeveless, 0.4 short, 1 full)
        float t = (ax - uArms.x) / (uArms.y - uArms.x);
        if (t < uCut.x) { col = uTop; cloth = 1.0; }
      } else if (p.y > neck) {
        col = skin;
      } else if (p.y > hip) {
        col = uTop; cloth = 1.0;
        // neckline: a V at the front
        if (p.z > 0.0 && p.y > neck - 0.07 - uCut.z * 0.05 && ax < (p.y - (neck - 0.07 - uCut.z * 0.05)) * 0.9 + 0.012) { col = skin; cloth = 0.0; }
      } else {
        col = p.y > uCut.y * hip ? uTop : uBottom; cloth = 1.0;
        if (uCut.w > 1.5 && p.y < uCut.y * hip) col = mix(uBottom, uTop, step(0.5, fract(p.y * 3.0)) * 0.12);   // saree pleats
        if (p.y < uBody.w) col = uShoe;
        if (p.y > hip - 0.03 && p.y < hip + 0.01 && uCut.y > 0.9) col *= 0.45;    // belt
      }
      // under the clothes the body isn't drawn at all (no skin or muscle pushing through the cloth);
      // a 2-4 cm band at each edge stays painted so no gap opens at a hem or cuff
      bool torsoIn = !arm && p.y > hip + 0.03 && p.y < neck - 0.045;
      bool armIn = arm && (ax - uArms.x) / (uArms.y - uArms.x) < uCut.x - 0.07;
      bool legIn = p.y < hip - 0.03 && p.y > uBody.w + 0.03 && uCut.w < 1.5;
      bool footIn = p.y < uBody.w - 0.015;
      if (torsoIn || armIn || legIn || footIn) discard;
      if (cloth > 0.5) col *= 0.92;
      diffuseColor.rgb *= col;`);
  };
  mat.customProgramCacheKey = () => 'nh-people-ubc';
  return mat;
}

export class HumanKit {
  constructor(gM, gF) {
    this.src = { m: gM, f: gF };
    this.clips = {};
    for (const cl of gM.animations) {
      cl.tracks = cl.tracks.filter(t => !t.name.endsWith('.scale'));
      // root-motion clips: the game moves the body itself
      if (cl.name === 'climb' || cl.name === 'roll') cl.tracks = cl.tracks.filter(t => t.name !== 'root.position');
      this.clips[cl.name] = cl;
    }
    this.bindM = {}; this.maps = {}; this.hairMat = {}; this.eyeMat = {};
    for (const [k, g] of Object.entries(this.src)) {
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        if (o.name.startsWith('body')) {
          const sk = o.skeleton, b = sk.bones[0];
          const M = new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[0]);
          this.bindM[k] = new THREE.Matrix4().multiplyMatrices(o.bindMatrixInverse, M).multiply(o.bindMatrix);
          this.maps[k] = o.material.map;
          if (this.maps[k]) { this.maps[k].colorSpace = THREE.SRGBColorSpace; this.maps[k].anisotropy = 4; }
        } else if (o.name.startsWith('eyes')) this.eyeMat[k] = o.material;
        else if ((o.name.startsWith('hair') || o.name.startsWith('face')) && o.material && o.material.map && !this.hairMat[k]) this.hairMat[k] = o.material.map;
      });
    }
    this.accMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 });
  }
  // a random Pune look; opts: female, role ('police'), helmet, avoid (the player's look: never copy it)
  randomLook(rng, opts = {}) {
    const female = opts.female ?? rng.chance(0.45);
    const L = { female, skin: c(rng.weighted ? rng.weighted(SKIN, SKIN_W) : rng.pick(SKIN)), shoe: c(rng.pick([0x1d1a18, 0x3b2a1f, 0x555555, 0x8a6a4a, 0xd8d0c0])),
      hair: c(rng.pick(HAIR.slice(0, rng.chance(0.18) ? 6 : 4))), scale: female ? rng.range(0.9, 0.97) : rng.range(0.93, 1.0), acc: null,
      style: female ? rng.pick(HAIR_F) : rng.pick(HAIR_M), beard: !female && rng.chance(0.3) };
    if (opts.role === 'police') {
      Object.assign(L, { female: false, top: c(0xa08a5c), bottom: c(0x8f7b52), cut: new THREE.Vector4(0.42, 1, 0.6, 0), acc: 'cap_police', style: 'hair_buzzed', shoe: c(0x1a1715) });
      return L;
    }
    if (female) {
      const s = rng.next();
      if (s < 0.35) { L.top = c(rng.pick(SAREE)); L.bottom = L.top.clone().multiplyScalar(0.85); L.cut = new THREE.Vector4(0.3, 1, 0.9, 2); L.style = rng.chance(0.6) ? 'hair_buns' : 'hair_long'; }   // saree
      else if (s < 0.72) { L.top = c(rng.pick(KURTA)); L.bottom = c(rng.pick(SALWAR)); L.cut = new THREE.Vector4(rng.chance(0.5) ? 0.4 : 0.85, 0.55, 0.8, 1); } // kurta + salwar
      else { L.top = c(rng.pick(SHIRT)); L.bottom = c(rng.pick(PANTS)); L.cut = new THREE.Vector4(rng.chance(0.6) ? 0.35 : 0.9, 1, 0.5, 0); }           // jeans + top
    } else {
      const s = rng.next();
      if (s < 0.12) { L.top = c(rng.pick(KURTA)); L.bottom = c(rng.pick([0xf4f1ea, 0xe8e0cc, 0x2f2f33])); L.cut = new THREE.Vector4(0.9, 0.55, 0.7, 1); }   // kurta pyjama
      else { L.top = c(rng.pick(SHIRT)); L.bottom = c(rng.pick(PANTS)); L.cut = new THREE.Vector4(rng.chance(0.55) ? 0.38 : 0.92, 1, rng.chance(0.5) ? 0.6 : 0.3, 0); }
    }
    if (opts.helmet) L.acc = 'helmet';
    // nobody in the city wears exactly what you wear, with your hair
    const A = opts.avoid || this.player;
    if (A && L.female === A.female && L.style === A.style) {
      const d = Math.abs(L.top.r - A.top.r) + Math.abs(L.top.g - A.top.g) + Math.abs(L.top.b - A.top.b);
      if (d < 0.25) L.top = c(rng.pick(SHIRT.filter(h => Math.abs(c(h).r - A.top.r) + Math.abs(c(h).g - A.top.g) + Math.abs(c(h).b - A.top.b) > 0.4)));
      if (L.style === A.style) L.style = female ? (A.style === 'hair_long' ? 'hair_buns' : 'hair_long') : (A.style === 'hair_buzzed' ? 'hair_simpleparted' : 'hair_buzzed');
    }
    return L;
  }
  create(look) {
    const k = look.female ? 'f' : 'm';
    const g = this.src[k];
    const root = skeletonClone(g.scene);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0, map: this.maps[k] || null });
    const B = BODY[k];
    mat.userData = { top: look.top.clone(), bottom: look.bottom.clone(), skin: look.skin.clone(), shoe: look.shoe.clone(), cut: look.cut.clone(),
      bindM: this.bindM[k] || new THREE.Matrix4(), body: new THREE.Vector4(B.hip, B.neck, B.armY, 0.085), arms: new THREE.Vector4(B.shoulder, B.wrist, 0, 0) };
    if (mat.map) patchBody(mat);
    const acc = this.accMat.clone();
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0, map: this.hairMat[k] || null });
    // clothes are real shells over the body: top (short / long sleeves), trousers, kurta hem, saree
    const topMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const botMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 });
    let body = null; const parts = [];
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
      if (o.name.startsWith('body')) { o.material = mat; body = o; }
      else if (o.name.startsWith('eyes')) { o.castShadow = false; }
      else if (o.name.startsWith('hair') || o.name.startsWith('face')) { o.material = hairMat; o.castShadow = false; parts.push(o); }
      else if (o.name.startsWith('cloth')) { o.material = o.name === 'cloth_pants' ? botMat : o.name === 'cloth_shoes' ? shoeMat : topMat; o.castShadow = o.name !== 'cloth_shoes'; parts.push(o); }
      else { o.material = acc; parts.push(o); }
    });
    const holder = new THREE.Group();
    root.rotation.y = Math.PI / 2;            // the rig faces +Z; the game's heading is +X
    root.scale.setScalar(look.scale);
    holder.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const H = { holder, root, mixer, mat, acc, hairMat, topMat, botMat, shoeMat, body, parts, actions: {}, cur: null, look };
    this.applyLook(H, look);
    H.play = (name, { fade = 0.25, speed = 1, once = false } = {}) => {
      let a = H.actions[name];
      if (!a) {
        const clip = this.clips[name];
        if (!clip) return null;
        a = H.actions[name] = mixer.clipAction(clip);
      }
      a.timeScale = speed;
      if (H.cur === a) return a;
      a.reset();
      a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      a.clampWhenFinished = once;
      a.enabled = true;
      a.play();
      if (H.cur) H.cur.crossFadeTo(a, fade, false);
      H.cur = a;
      return a;
    };
    H.setAcc = (name) => { H.look = Object.assign({}, H.look, { acc: name }); this.applyLook(H, H.look, true); };
    H.dispose = () => { mat.dispose(); acc.dispose(); hairMat.dispose(); topMat.dispose(); botMat.dispose(); mixer.stopAllAction(); };
    return H;
  }
  // dress a body (also used when the crowd hands a pooled body to someone else)
  applyLook(H, look, accOnly = false) {
    if (!accOnly) {
      const u = H.mat.userData;
      u.top.copy(look.top); u.bottom.copy(look.bottom); u.skin.copy(look.skin); u.shoe.copy(look.shoe); u.cut.copy(look.cut);
      H.hairMat.color.copy(look.hair).multiplyScalar(1.8);
      H.topMat.color.copy(look.top); H.botMat.color.copy(look.bottom); H.shoeMat.color.copy(look.shoe);
      H.root.scale.setScalar(look.scale);
      H.look = look;
    }
    const helmet = look.acc === 'helmet', cap = look.acc === 'cap_police';
    const saree = look.cut.w > 1.5, kurta = !saree && look.cut.y < 0.9, longSleeve = look.cut.x > 0.6;
    for (const o of H.parts) {
      const n = o.name;
      if (n.startsWith('face')) o.visible = true;                                         // eyebrows
      else if (n === 'cloth_top_short') o.visible = !longSleeve;
      else if (n === 'cloth_top_long') o.visible = longSleeve;
      else if (n === 'cloth_pants') o.visible = !saree;
      else if (n === 'cloth_kurta') o.visible = kurta;
      else if (n === 'cloth_saree') o.visible = saree;
      else if (n === 'cloth_shoes') o.visible = true;
      else if (n === 'hair_beard') o.visible = !!look.beard;
      else if (n.startsWith('hair')) o.visible = !helmet && n === (cap ? 'hair_buzzed' : look.style);
      else if (n === 'helmet') o.visible = helmet;
      else if (n === 'cap_police') o.visible = cap;
      else o.visible = false;
    }
    if (helmet) H.acc.color.copy(look.helmetCol || new THREE.Color(0x1b1d22));
    else if (cap) H.acc.color.set(0xf4f4f0);
  }
}
