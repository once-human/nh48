// Animated people (Quaternius Universal Animation Library, CC0): one male and one female body on
// the same 65-bone rig, 29 clips, short hair / long hair + plait / police cap / helmet meshes.
// Clothes are painted in the shader from the bind-pose (T-pose) position: shirt or kurta,
// trousers or salwar, sleeve length, skin tone, footwear — so one body makes a whole city.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { RNG } from '../core/util.js';
import { U } from '../gfx/materials.js';

const SKIN = [0x8d5a3b, 0x9c6a46, 0xa8754f, 0x7a4b30, 0xb98463, 0x6b4129, 0xc79574];
const SHIRT = [0xf2f0ea, 0x5f86b8, 0xbf3f3a, 0x2b3550, 0xe9cf7a, 0x3f7a52, 0x8a3a74, 0xe08a35, 0x8e9093, 0x1f2024, 0xbfd0e2, 0xd9a7a7, 0x6a4c93, 0x2f6f73];
const PANTS = [0x232a3d, 0x342f2a, 0x7a6c58, 0x1b1c1f, 0x4b5363, 0xd9d2c0, 0x3b4a5c];
const KURTA = [0xe9e2cf, 0xf4d58d, 0xd1495b, 0x2e86ab, 0x7a9e7e, 0xf28f3b, 0x8e5572, 0xffffff, 0x3d405b, 0xc8553d];
const SALWAR = [0xf4f1ea, 0x2f2f33, 0xd9c7a3, 0x8e5572, 0x3d405b];
const SAREE = [0xc1121f, 0xf77f00, 0x2a9d8f, 0x7b2cbf, 0xffb703, 0x1d4e89, 0xe5989b, 0x9d0208, 0x386641];
const HAIR = [0x141110, 0x1d1714, 0x2a201a, 0x3a2c22, 0x5a5550, 0x9a958f];

function patchPeople(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTop = { value: mat.userData.top }; sh.uniforms.uBottom = { value: mat.userData.bottom };
    sh.uniforms.uSkin = { value: mat.userData.skin }; sh.uniforms.uShoe = { value: mat.userData.shoe };
    sh.uniforms.uCut = { value: mat.userData.cut };   // x sleeve end, y top end (hip 0.93 / kurta 0.55), z neckline, w style
    sh.uniforms.uBindM = { value: mat.userData.bindM };
    // positions are quantized (int16, -1..1): uBindM turns them back into rest-pose metres
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind; uniform mat4 uBindM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = (uBindM * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vBind; uniform vec3 uTop, uBottom, uSkin, uShoe; uniform vec4 uCut;`)
      .replace('#include <map_fragment>', `
      vec3 p = vBind; float ax = abs(p.x);
      vec3 col = uSkin;
      bool arm = ax > 0.2 && p.y > 1.22;
      if (arm) {
        col = ax < uCut.x ? uTop : uSkin;
      } else if (p.y > 1.5) {
        col = uSkin;                                         // neck and head
      } else if (p.y > 0.93) {
        col = uTop;
        if (p.y > 1.42 && ax < 0.06 && p.z > 0.0 && p.y > 1.5 - uCut.z * (0.06 - ax)) col = uSkin;    // neckline
      } else {
        col = p.y > uCut.y ? uTop : uBottom;                 // kurta / long top over the legs
        if (uCut.w > 1.5 && p.y < uCut.y) col = mix(uBottom, uTop, step(0.5, fract(p.y * 3.0)) * 0.12); // saree pleats
        if (p.y < 0.075) col = uShoe;
        if (p.y > 0.9 && p.y < 0.95 && uCut.y > 0.9) col *= 0.45; // belt
      }
      // face: eyes, brows, a hint of a mouth (front of the head in bind pose is +z)
      if (p.y > 1.6 && p.z > 0.06) {
        vec2 e = vec2(ax - 0.034, p.y - 1.705);
        float eye = 1.0 - smoothstep(0.006, 0.0085, length(e * vec2(1.0, 1.6)));
        float brow = (1.0 - smoothstep(0.0035, 0.005, abs(p.y - 1.728 + ax * 0.08))) * step(0.016, ax) * step(ax, 0.052);
        float mouth = (1.0 - smoothstep(0.002, 0.0035, abs(p.y - 1.643))) * step(ax, 0.022);
        col = mix(col, vec3(0.06, 0.045, 0.04), max(eye, brow * 0.85));
        col = mix(col, col * 0.55, mouth);
      }
      diffuseColor.rgb *= col;`);
  };
  mat.customProgramCacheKey = () => 'nh-people';
  return mat;
}

export class HumanKit {
  constructor(gM, gF) {
    this.src = { m: gM, f: gF };
    this.clips = {};
    for (const c of gM.animations) {
      // drop scale tracks (always 1) to save work in the mixer
      c.tracks = c.tracks.filter(t => !t.name.endsWith('.scale'));
      this.clips[c.name] = c;
    }
    this.baseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 });
    // rest-pose transform of each body (dequantisation lives in the skin's inverse bind matrices)
    this.bindM = {};
    for (const [k, g] of Object.entries(this.src)) {
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        if (!o.isSkinnedMesh || !o.name.startsWith('body')) return;
        const sk = o.skeleton, b = sk.bones[0];
        const M = new THREE.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[0]);
        this.bindM[k] = new THREE.Matrix4().multiplyMatrices(o.bindMatrixInverse, M).multiply(o.bindMatrix);
      });
    }
    this.accMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 });
  }
  // a random Pune look; opts can force female / role
  randomLook(rng, opts = {}) {
    const female = opts.female ?? rng.chance(0.45);
    const c = (h) => new THREE.Color(h).convertSRGBToLinear();
    const L = { female, skin: c(rng.pick(SKIN)), shoe: c(rng.pick([0x1d1a18, 0x3b2a1f, 0x555555, 0x8a6a4a, 0xd8d0c0])), hair: c(rng.pick(HAIR.slice(0, rng.chance(0.15) ? 6 : 4))),
      scale: female ? rng.range(0.85, 0.93) : rng.range(0.9, 0.98), acc: null };
    if (opts.role === 'police') {
      // Maharashtra traffic police: khaki uniform, white peaked cap
      Object.assign(L, { female: false, top: c(0xa08a5c), bottom: c(0x8f7b52), cut: new THREE.Vector4(0.36, 0.93, 0.6, 0), acc: 'cap_police', shoe: c(0x1a1715) });
      return L;
    }
    if (female) {
      const style = rng.next();
      if (style < 0.35) { L.top = c(rng.pick(SAREE)); L.bottom = L.top.clone().multiplyScalar(0.85); L.cut = new THREE.Vector4(0.3, 0.93, 0.9, 2); }       // saree
      else if (style < 0.75) { L.top = c(rng.pick(KURTA)); L.bottom = c(rng.pick(SALWAR)); L.cut = new THREE.Vector4(rng.chance(0.5) ? 0.42 : 0.6, 0.5, 0.8, 1); } // kurta + salwar/leggings
      else { L.top = c(rng.pick(SHIRT)); L.bottom = c(rng.pick(PANTS)); L.cut = new THREE.Vector4(rng.chance(0.6) ? 0.34 : 0.6, 0.93, 0.5, 0); }         // jeans + top (college)
      L.acc = rng.chance(0.5) ? 'hair_braid' : 'hair_long';
    } else {
      const style = rng.next();
      if (style < 0.12) { L.top = c(rng.pick(KURTA)); L.bottom = c(rng.pick([0xf4f1ea, 0xe8e0cc, 0x2f2f33])); L.cut = new THREE.Vector4(0.62, 0.52, 0.7, 1); }   // kurta pyjama
      else { L.top = c(rng.pick(SHIRT)); L.bottom = c(rng.pick(PANTS)); L.cut = new THREE.Vector4(rng.chance(0.55) ? 0.36 : 0.66, 0.93, rng.chance(0.5) ? 0.6 : 0.3, 0); }
      L.acc = rng.chance(0.06) ? null : 'hair_short';
    }
    if (opts.helmet) L.acc = 'helmet';
    return L;
  }
  create(look) {
    const g = look.female ? this.src.f : this.src.m;
    const root = skeletonClone(g.scene);
    const mat = this.baseMat.clone();
    mat.userData = { top: look.top.clone(), bottom: look.bottom.clone(), skin: look.skin.clone(), shoe: look.shoe.clone(), cut: look.cut.clone(), bindM: this.bindM[look.female ? 'f' : 'm'] || new THREE.Matrix4() };
    patchPeople(mat);
    const acc = this.accMat.clone();
    acc.color.copy(look.acc === 'cap_police' ? new THREE.Color(0xf4f4f0) : look.acc === 'helmet' ? new THREE.Color(new RNG(look.top.r * 1000 | 0).pick([0x111111, 0xb3121b, 0x1f3f8a, 0xf2f2f2, 0xd8b100])) : look.hair);
    let body = null;
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.frustumCulled = false;
      o.castShadow = true; o.receiveShadow = true;
      if (o.name.startsWith('body')) { o.material = mat; body = o; }
      else { o.material = acc; o.visible = o.name === look.acc || (look.acc === 'cap_police' && o.name === 'hair_short') || (look.acc === 'helmet' && false); }
    });
    // the exported rig faces +Z; turn it so the character faces +X (the game heading convention)
    const holder = new THREE.Group();
    root.rotation.y = Math.PI / 2;
    root.scale.setScalar(look.scale);
    holder.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const H = { holder, root, mixer, mat, acc, body, actions: {}, cur: null, look };
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
    H.dispose = () => { mat.dispose(); acc.dispose(); mixer.stopAllAction(); };
    return H;
  }
}
