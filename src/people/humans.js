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
// black and near-black for most, then browns, henna and highlights; the last two are grey (elders)
export const HAIR = [0x0d0b0a, 0x15110f, 0x1f1814, 0x2a201a, 0x3b2a20, 0x4a2f22, 0x5c2a1e, 0x6e4a2e, 0x6b6560, 0xb0aaa2];
const HAIR_W = [3, 3, 2.4, 1.6, 1.2, 0.9, 0.5, 0.4, 0, 0];
const HAIR_M = ['hair_simpleparted', 'hair_simpleparted', 'hair_buzzed'];
// women: open long hair, a bun, a ponytail or a plait (the last two are the close-cut cap with a tail on the head bone);
// the plain short cut is rare now
const HAIR_F = ['hair_long', 'hair_long', 'hair_long', 'hair_buns', 'hair_buns', 'pony', 'pony', 'braid', 'braid', 'hair_buzzedfemale'];
// the extra hair styles and what they're built on
const WEST_TOP = [0xf4f2ee, 0x16161a, 0xe9dccb, 0xf2c6cf, 0xc9b8e3, 0xb7c9a8, 0xb9d2ea, 0x8c1d2c, 0xf0e2a8, 0x6d7f9c];
const WEST_BOT = [0x3e5f8a, 0x2c4568, 0x16161a, 0xf2f0ea, 0xcbb89a, 0x6b7f99, 0x5a4636];
const TAIL = { pony: 'hair_buzzedfemale', braid: 'hair_buzzedfemale' };
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
      uCut: { value: u.cut }, uBindM: { value: u.bindM }, uBody: { value: u.body }, uArms: { value: u.arms }, uStyle: { value: u.style } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind; uniform mat4 uBindM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = (uBindM * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vBind; uniform vec3 uTop, uBottom, uSkin, uShoe; uniform vec4 uCut, uBody, uArms, uStyle;`)
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
        if (uCut.w > 1.5 && uCut.w < 2.5 && p.y < uCut.y * hip) col = mix(uBottom, uTop, step(0.5, fract(p.y * 3.0)) * 0.12);   // saree pleats
        if (uCut.w > 2.5 && p.y < uStyle.y * hip) { col = skin; cloth = 0.0; }                                                // below a skirt's hem: legs
        if (p.y < uBody.w) col = uShoe;
        if (p.y > hip - 0.03 && p.y < hip + 0.01 && uCut.y > 0.9) col *= 0.45;    // belt
      }
      // under the clothes the body isn't drawn at all (no skin or muscle pushing through the cloth);
      // a 2-4 cm band at each edge stays painted so no gap opens at a hem or cuff
      bool torsoIn = !arm && p.y > hip + 0.03 && p.y < neck - 0.045;
      bool armIn = arm && (ax - uArms.x) / (uArms.y - uArms.x) < uCut.x - 0.07;
      bool legIn = p.y < hip - 0.03 && p.y > uBody.w + 0.03 && (uCut.w < 1.5 || (uCut.w > 2.5 && p.y > uStyle.y * hip + 0.03));
      bool footIn = p.y < uBody.w - 0.015;
      if (torsoIn || armIn || legIn || footIn) discard;
      if (cloth > 0.5) col *= 0.92;
      diffuseColor.rgb *= col;`);
  };
  mat.customProgramCacheKey = () => 'nh-people-ubc2';
  return mat;
}

// the cloth shells get their fabric from where they sit on the body (bind pose), not UVs: stripes,
// checks, denim, a print, an open jacket over a tee, colour blocks; a skirt is the long shell cut at its hem
// uStyle: x pattern (0 plain, 1 stripes, 2 checks, 3 denim, 4 dots, 5 open jacket, 6 colour block), y hem (x hip height)
function patchCloth(mat, which) {
  mat.onBeforeCompile = (sh) => {
    const u = mat.userData;
    Object.assign(sh.uniforms, { uStyle: { value: u.style }, uPat: { value: u.pat }, uWhich: { value: which }, uBindM: { value: u.bindM } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP; uniform mat4 uBindM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = (uBindM * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vP; uniform vec4 uStyle; uniform vec3 uPat; uniform float uWhich;
      float h21(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 p = vP; float pt = uStyle.x;
      // the long shell as a skirt: nothing below the hem
      if (uWhich > 1.5 && uStyle.y > 0.01 && p.y < uStyle.y * 0.95) discard;
      if (uWhich < 0.5) {
        if (pt > 0.5 && pt < 1.5) diffuseColor.rgb = mix(diffuseColor.rgb, uPat, step(0.5, fract(p.y * 16.0)));
        else if (pt > 1.5 && pt < 2.5) { float a = step(0.5, fract(p.x * 11.0)), b = step(0.5, fract(p.y * 11.0)); diffuseColor.rgb = mix(diffuseColor.rgb, uPat, (a + b) * 0.33); }
        else if (pt > 3.5 && pt < 4.5) { vec2 g = fract(vec2(p.x + p.z, p.y) * 22.0) - 0.5; diffuseColor.rgb = mix(diffuseColor.rgb, uPat, step(length(g), 0.17)); }
        else if (pt > 4.5 && pt < 5.5) { float inner = step(abs(p.x), 0.065) * step(0.0, p.z) * step(p.y, 1.47); diffuseColor.rgb = mix(diffuseColor.rgb, uPat, inner); if (abs(abs(p.x) - 0.07) < 0.008 && p.z > 0.0) diffuseColor.rgb *= 0.55; }
        else if (pt > 5.5) diffuseColor.rgb = mix(diffuseColor.rgb, uPat, step(1.22, p.y));
      } else if (pt > 2.5 && pt < 3.5 || uStyle.z > 0.5) {
        // denim: a twill grain and a lighter wash down the front of the thighs
        float n = h21(floor(vec2(p.x * 260.0 + p.y * 260.0, p.y * 90.0)));
        diffuseColor.rgb *= 0.9 + n * 0.16;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.35, smoothstep(0.03, 0.12, p.z) * smoothstep(0.45, 0.75, p.y) * 0.5);
      }`);
  };
  mat.customProgramCacheKey = () => 'nh-cloth-' + which;
  return mat;
}

// two-bone IK for an arm, on top of whatever clip is playing: shoulder-elbow-hand reach for a world
// point, the elbow bending toward 'pole'. w blends from the clip (0) to the reach (1).
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion();
function aim(bone, from, to) {
  // turn bone (in world) so the direction 'from' becomes 'to'
  _q.setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  bone.updateMatrixWorld(true);
}
export function ikArm(H, side, target, pole, w = 1) {
  const R = H.root, up = H._ik && H._ik[side] || (H._ik = H._ik || {}, H._ik[side] = [R.getObjectByName('upperarm_' + side), R.getObjectByName('lowerarm_' + side), R.getObjectByName('hand_' + side)]);
  const [u, l, h] = up;
  if (!u || !l || !h || w <= 0) return;
  R.updateMatrixWorld(true);
  _q0.copy(u.quaternion); _q1.copy(l.quaternion);
  u.getWorldPosition(_a); l.getWorldPosition(_b); h.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _t.copy(target).sub(_a);
  const d = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, _t.length()));
  _t.setLength(d);
  // where the elbow goes: along the reach, pushed out toward the pole
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const dir = _t.clone().normalize(), side2 = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  _e.copy(dir).multiplyScalar(cosA * l1).add(side2.multiplyScalar(sinA * l1)).add(_a);
  aim(u, _b.clone().sub(_a), _e.clone().sub(_a));
  l.getWorldPosition(_b); h.getWorldPosition(_c);
  aim(l, _c.clone().sub(_b), _t.clone().add(_a).sub(_b));
  if (w < 1) { u.quaternion.slerpQuaternions(_q0, u.quaternion.clone(), w); l.quaternion.slerpQuaternions(_q1, l.quaternion.clone(), w); }
  R.updateMatrixWorld(true);
}

export class HumanKit {
  constructor(gM, gF) {
    this.src = { m: gM, f: gF };
    this.clips = {};
    for (const cl of gM.animations) {
      cl.tracks = cl.tracks.filter(t => !t.name.endsWith('.scale'));
      // root-motion clips: the game moves the body itself
      if (['climb', 'roll', 'hook', 'cross', 'punch', 'block'].includes(cl.name)) cl.tracks = cl.tracks.filter(t => t.name !== 'root.position');
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
      hair: c(rng.chance(0.07) ? rng.pick(HAIR.slice(8)) : rng.weighted ? rng.weighted(HAIR, HAIR_W) : rng.pick(HAIR.slice(0, 6))), scale: female ? rng.range(0.9, 0.97) : rng.range(0.93, 1.0), acc: null,
      style: female ? rng.pick(HAIR_F) : rng.pick(HAIR_M), beard: !female && rng.chance(0.3),
      glasses: rng.chance(female ? 0.12 : 0.16), bindi: female && rng.chance(0.3) };
    if (opts.role === 'police') {
      Object.assign(L, { female: false, top: c(0xa08a5c), bottom: c(0x8f7b52), cut: new THREE.Vector4(0.42, 1, 0.6, 0), acc: 'cap_police', style: 'hair_buzzed', shoe: c(0x1a1715) });
      return L;
    }
    // opts.dress: 'modern' (jeans and tops), 'traditional' (saree / kurta), or anything
    let D = opts.dress;
    if (female && D === 'modern' && rng.chance(0.5)) D = 'western';
    if (female && D === 'western') {
      // KP, Viman Nagar, Baner, the college crowd: lighter skin on average, western clothes, open hair or a ponytail, highlights
      L.skin = c(rng.weighted ? rng.weighted(SKIN, [4, 3, 1.4, 0.6, 0.2, 0.05]) : rng.pick(SKIN.slice(0, 3)));
      L.top = c(rng.pick(WEST_TOP)); L.bottom = c(rng.pick(WEST_BOT));
      L.cut = new THREE.Vector4(rng.chance(0.65) ? 0.3 : 0.9, 1, rng.chance(0.4) ? 0.35 : 0.55, 0);
      L.style = rng.pick(['hair_long', 'hair_long', 'hair_long', 'pony', 'hair_buzzedfemale']);
      L.hair = c(rng.weighted ? rng.weighted(HAIR.slice(0, 8), [1.5, 1.5, 1.5, 1.6, 1.4, 1.2, 0.7, 0.9]) : rng.pick(HAIR.slice(2, 8)));
      L.bindi = false; L.glasses = rng.chance(0.15); L.scale = rng.range(0.93, 0.98);
      L.shoe = c(rng.pick([0xf2f0ea, 0x1d1a18, 0xd8c0a8, 0xe9d6c8]));
    } else if (female) {
      let s = rng.next();
      if (D === 'modern') s = 0.72 + s * 0.28; else if (D === 'traditional') s *= 0.72;
      if (s < 0.35) { L.top = c(rng.pick(SAREE)); L.bottom = L.top.clone().multiplyScalar(0.85); L.cut = new THREE.Vector4(0.3, 1, 0.9, 2); L.style = rng.pick(['hair_buns', 'hair_buns', 'hair_long', 'braid']); L.bindi = rng.chance(0.75); }   // saree
      else if (s < 0.72) { L.top = c(rng.pick(KURTA)); L.bottom = c(rng.pick(SALWAR)); L.cut = new THREE.Vector4(rng.chance(0.5) ? 0.4 : 0.85, 0.55, 0.8, 1); } // kurta + salwar
      else { L.top = c(rng.pick(SHIRT)); L.bottom = c(rng.pick(PANTS)); L.cut = new THREE.Vector4(rng.chance(0.6) ? 0.35 : 0.9, 1, 0.5, 0); }           // jeans + top
    } else {
      let s = rng.next();
      if (D === 'modern') s = 0.12 + s * 0.88; else if (D === 'traditional' && s < 0.5) s *= 0.24;
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
    const style = new THREE.Vector4(), pat = new THREE.Color();
    mat.userData = { top: look.top.clone(), bottom: look.bottom.clone(), skin: look.skin.clone(), shoe: look.shoe.clone(), cut: look.cut.clone(), style,
      bindM: this.bindM[k] || new THREE.Matrix4(), body: new THREE.Vector4(B.hip, B.neck, B.armY, 0.085), arms: new THREE.Vector4(B.shoulder, B.wrist, 0, 0) };
    if (mat.map) patchBody(mat);
    const acc = this.accMat.clone();
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0, map: this.hairMat[k] || null });
    // clothes are real shells over the body: top (short / long sleeves), trousers, kurta hem, saree
    const topMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const botMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 });
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    for (const [m, w] of [[topMat, 0], [botMat, 1], [skirtMat, 2]]) { m.userData = { style, pat, bindM: this.bindM[k] || new THREE.Matrix4() }; patchCloth(m, w); }
    let body = null; const parts = [];
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
      if (o.name.startsWith('body')) { o.material = mat; body = o; }
      else if (o.name.startsWith('eyes')) { o.castShadow = false; }
      else if (o.name.startsWith('hair') || o.name.startsWith('face')) { o.material = hairMat; o.castShadow = false; parts.push(o); }
      else if (o.name.startsWith('cloth')) { o.material = o.name === 'cloth_pants' ? botMat : o.name === 'cloth_shoes' ? shoeMat : o.name === 'cloth_saree' ? skirtMat : topMat; o.castShadow = o.name !== 'cloth_shoes'; parts.push(o); }
      else { o.material = acc; parts.push(o); }
    });
    const holder = new THREE.Group();
    root.rotation.y = Math.PI / 2;            // the rig faces +Z; the game's heading is +X
    root.scale.setScalar(look.scale);
    holder.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const H = { holder, root, mixer, mat, acc, hairMat, topMat, botMat, shoeMat, skirtMat, style, pat, body, parts, actions: {}, cur: null, look };
    // ponytail, plait, glasses and bindi ride on the head bone
    const head = root.getObjectByName('Head'), X = head && this.extras(k);
    if (X) {
      H.xtra = {};
      for (const [n, geo] of Object.entries(X.geo)) {
        const m = new THREE.Mesh(geo, n === 'glasses' || n === 'lens' ? this.glassMat : n === 'bindi' ? this.bindiMat : n === 'cap' ? new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }) : hairMat);
        m.matrixAutoUpdate = false; m.matrix.copy(X.local); m.castShadow = false; m.visible = false;
        head.add(m); H.xtra[n] = m;
      }
    }
    this.applyLook(H, look);
    H.play = (name, { fade = 0.25, speed = 1, once = false, restart = false } = {}) => {
      let a = H.actions[name];
      if (!a) {
        const clip = this.clips[name];
        if (!clip) return null;
        a = H.actions[name] = mixer.clipAction(clip);
      }
      a.timeScale = speed;
      if (H.cur === a) { if (restart) { a.reset(); a.play(); } return a; }
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
    H.dispose = () => { mat.dispose(); acc.dispose(); hairMat.dispose(); topMat.dispose(); botMat.dispose(); skirtMat.dispose(); mixer.stopAllAction(); };
    return H;
  }
  // geometry for the head-bone extras, built once per body in the rig's rest pose and carried into the
  // Head bone's space (so they follow every nod and turn)
  extras(k) {
    this._xtra = this._xtra || {};
    if (this._xtra[k] !== undefined) return this._xtra[k];
    const g = this.src[k], sc = g.scene;
    sc.updateMatrixWorld(true);
    const head = sc.getObjectByName('Head');
    let cap = null, eyes = null;
    sc.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const b = new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld);
      if (o.name === (k === 'f' ? 'hair_buzzedfemale' : 'hair_buzzed')) cap = b;
      else if (o.name.startsWith('eyes')) eyes = b;
    });
    if (!head || !cap || !eyes) return (this._xtra[k] = null);
    this.glassMat = this.glassMat || new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35, metalness: 0.4 });
    this.bindiMat = this.bindiMat || new THREE.MeshStandardMaterial({ color: 0xa3101c, roughness: 0.5 });
    const cx = (cap.min.x + cap.max.x) / 2, top = cap.max.y, back = cap.min.z, H = cap.max.y - cap.min.y;
    const ey = (eyes.min.y + eyes.max.y) / 2, ez = eyes.max.z, ew = eyes.max.x - eyes.min.x;
    const merge = (list) => {
      const pos = [], nrm = [], idx = []; let base = 0;
      for (const q of list) { const n = q.toNonIndexed ? q : q; const p = n.attributes.position, nn = n.attributes.normal, ix = n.index;
        for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(nn.getX(i), nn.getY(i), nn.getZ(i)); }
        if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); base += p.count; }
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); out.setIndex(idx);
      return out;
    };
    // ponytail: a tie at the crown's back, then a tapered fall
    const tie = new THREE.SphereGeometry(0.034, 10, 8); tie.translate(cx, top - H * 0.32, back + 0.01);
    const tail = new THREE.CylinderGeometry(0.036, 0.012, 0.26, 10, 4); tail.translate(0, -0.13, 0); tail.rotateX(0.32); tail.translate(cx, top - H * 0.34, back - 0.005);
    const pony = merge([tie, tail]);
    // plait: a chain of beads down the back to the shoulder blades, with a tassel
    const beads = [];
    for (let i = 0; i < 9; i++) { const r = 0.034 - i * 0.0022, b = new THREE.SphereGeometry(r, 9, 7); b.scale(1, 1.35, 0.9); b.translate(cx + (i % 2 ? 0.006 : -0.006), top - H * 0.55 - i * 0.045, back - 0.012 - Math.min(i, 3) * 0.006); beads.push(b); }
    const tas = new THREE.ConeGeometry(0.018, 0.06, 8); tas.rotateX(Math.PI); tas.translate(cx, top - H * 0.55 - 9 * 0.045 - 0.01, back - 0.03); beads.push(tas);
    const braid = merge(beads);
    // glasses: two rims and a bridge just in front of the eyes
    const rim = (x) => { const t = new THREE.TorusGeometry(ew * 0.16, 0.0035, 6, 18); t.translate(x, ey, ez + 0.012); return t; };
    const br = new THREE.BoxGeometry(ew * 0.18, 0.004, 0.004); br.translate(cx, ey + 0.004, ez + 0.012);
    const armL = new THREE.BoxGeometry(0.004, 0.004, 0.1); armL.translate(cx - ew * 0.5, ey + 0.004, ez - 0.04);
    const armR = armL.clone(); armR.translate(ew, 0, 0);
    const glasses = merge([rim(cx - ew * 0.26), rim(cx + ew * 0.26), br, armL, armR]);
    const bindi = new THREE.CircleGeometry(0.0055, 12); bindi.translate(cx, ey + 0.038, ez - 0.004);
    // sunglasses: dark lenses in the same rims
    const lensL = new THREE.CircleGeometry(ew * 0.16, 16); lensL.translate(cx - ew * 0.26, ey, ez + 0.013);
    const lensR = new THREE.CircleGeometry(ew * 0.16, 16); lensR.translate(cx + ew * 0.26, ey, ez + 0.013);
    const lens = merge([lensL, lensR]);
    // a baseball cap: a crown over the hair and a brim out front
    const crown = new THREE.SphereGeometry(0.105, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2); crown.scale(1, 0.75, 1.08); crown.translate(cx, top - 0.06, (cap.min.z + cap.max.z) / 2);
    const brim = new THREE.CylinderGeometry(0.085, 0.085, 0.008, 18, 1, false, -Math.PI / 2, Math.PI); brim.scale(1, 1, 0.9); brim.translate(cx, top - 0.06, (cap.min.z + cap.max.z) / 2 + 0.07);
    const capG = merge([crown, brim]);
    // rest pose -> Head bone space
    const toHead = new THREE.Matrix4().copy(head.matrixWorld).invert();
    return (this._xtra[k] = { geo: { pony, braid, glasses, bindi, lens, cap: capG }, local: toHead });
  }
  // dress a body (also used when the crowd hands a pooled body to someone else)
  applyLook(H, look, accOnly = false) {
    if (!accOnly) {
      const u = H.mat.userData;
      u.top.copy(look.top); u.bottom.copy(look.bottom); u.skin.copy(look.skin); u.shoe.copy(look.shoe); u.cut.copy(look.cut);
      H.hairMat.color.copy(look.hair).multiplyScalar(1.8);
      H.topMat.color.copy(look.top); H.botMat.color.copy(look.bottom); H.shoeMat.color.copy(look.shoe);
      // a saree's shell is the saree's colour; a skirt's is the skirt's
      if (H.skirtMat) H.skirtMat.color.copy(look.cut.w > 2.5 ? look.bottom : look.top);
      if (H.style) { H.style.set(look.pat || 0, look.cut.w > 2.5 ? look.hem || 0.62 : 0, look.denim ? 1 : 0, 0); H.pat.copy(look.patCol || look.top); }
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
      else if (n.startsWith('hair')) o.visible = !helmet && n === (cap ? 'hair_buzzed' : TAIL[look.style] || look.style);
      else if (n === 'helmet') o.visible = helmet;
      else if (n === 'cap_police') o.visible = cap;
      else o.visible = false;
    }
    if (H.xtra) {
      H.xtra.pony.visible = !helmet && look.style === 'pony';
      H.xtra.braid.visible = !helmet && look.style === 'braid';
      H.xtra.glasses.visible = (!!look.glasses || !!look.shades) && !helmet;
      if (H.xtra.lens) H.xtra.lens.visible = !!look.shades && !helmet;
      if (H.xtra.cap) { H.xtra.cap.visible = !!look.hat && !helmet && !cap; if (look.hat) H.xtra.cap.material.color.copy(look.hatCol || look.top); }
      H.xtra.bindi.visible = !!look.bindi && !!look.female;
    }
    if (helmet) H.acc.color.copy(look.helmetCol || new THREE.Color(0x1b1d22));
    else if (cap) H.acc.color.set(0xf4f4f0);
  }
}
