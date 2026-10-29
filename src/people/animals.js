// Animals (Quaternius CC0, low-poly): street dogs, cows, cats and the black kites circling overhead.
// The simulation (where they walk, when they rest) lives in peds.js; this draws them as animated
// models, sized and re-coloured for Pune: Indie dogs in fawn/black/patchy coats, off-white cows.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { RNG } from '../core/util.js';

const TARGET = { dog: 0.62, cat: 0.44, cow: 1.3, kite: 1.25 };   // standing height (kite: wingspan)
const C = (h) => new THREE.Color(h).convertSRGBToLinear();
const DOG_COATS = [0xb98a55, 0xc79a62, 0x2a2622, 0xd8c7a8, 0x8a5a33, 0xa77b4b];
const CAT_COATS = [0x6f6a64, 0x2b2927, 0xb07a43, 0x9a958f, 0xd8cbb8];

export class AnimalKit {
  constructor(gltfs) {
    this.src = {};
    for (const [k, g] of Object.entries(gltfs)) {
      if (!g) continue;
      const clips = {};
      for (const c of g.animations) { c.tracks = c.tracks.filter(t => !t.name.endsWith('.scale')); clips[c.name.replace(/\.\d+$/, '')] = clips[c.name.replace(/\.\d+$/, '')] || c; }
      // size and facing from the rest pose
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene, true);
      const sz = box.getSize(new THREE.Vector3());
      const scale = TARGET[k] / (k === 'kite' ? Math.max(sz.x, sz.z) : sz.y);
      // which way the animal actually faces in its rest pose: front feet / head minus back feet / tail
      // (some models face +X, some +Z; guessing wrong made them walk sideways)
      const fr = new THREE.Vector3(), bk = new THREE.Vector3(); let nf = 0, nb = 0;
      g.scene.traverse((o) => {
        const n = o.name || '';
        const p = o.getWorldPosition(new THREE.Vector3());
        if (/front|head|neck/i.test(n)) { fr.add(p); nf++; } else if (/back(?!bone)|tail|hips/i.test(n) && !/^Back$/.test(n)) { bk.add(p); nb++; }
      });
      let yaw = Math.PI / 2;
      if (nf && nb) { fr.divideScalar(nf); bk.divideScalar(nb); const fx = fr.x - bk.x, fz = fr.z - bk.z; if (Math.hypot(fx, fz) > 1e-4) yaw = Math.atan2(fz, fx); }
      this.src[k] = { g, clips, scale, box, yaw };
    }
  }
  has(k) { return !!this.src[k]; }
  // facing: the game's heading is +X; models come facing +Z (glTF), turned in `fixYaw`
  create(kind, rng) {
    const S = this.src[kind];
    if (!S) return null;
    const root = skeletonClone(S.g.scene);
    const mats = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const cl = list.map(m => { const c = m.clone(); c.roughness = 0.9; c.metalness = 0; c.flatShading = true; mats.set(m.name, c); return c; });
      o.material = Array.isArray(o.material) ? cl : cl[0];
    });
    const paint = (name, hex) => { const m = mats.get(name); if (m) m.color.copy(typeof hex === 'number' ? C(hex) : hex); };
    if (kind === 'dog') paint('Dog', rng.pick(DOG_COATS));
    if (kind === 'cat') { paint('Grey', rng.pick(CAT_COATS)); paint('White', 0xece6dc); paint('Pink', 0xd48a8a); }
    if (kind === 'cow') { const base = rng.pick([0xf1ece2, 0xe8e2d6, 0xd9d2c4, 0xf4f1ea]); paint('White', base); paint('Black', rng.chance(0.5) ? 0xb8b0a2 : base); paint('Pink', 0xc89a8a); }
    if (kind === 'kite') { paint('Wings', 0x3b2b20); paint('Head', 0x5a4636); paint('Beak', 0xd8b04a); paint('Claws', 0xd8b04a); }
    const holder = new THREE.Group();
    root.scale.multiplyScalar(S.scale);
    root.rotation.y = this.fixYaw(kind);
    holder.add(root);
    const mixer = new THREE.AnimationMixer(root);
    const A = { holder, root, mixer, kind, actions: {}, cur: null };
    A.play = (name, speed = 1) => {
      const clip = S.clips[name] || S.clips.Idle || Object.values(S.clips)[0];
      if (!clip) return;
      let a = A.actions[clip.name];
      if (!a) a = A.actions[clip.name] = mixer.clipAction(clip);
      a.timeScale = speed;
      if (A.cur === a) return;
      a.reset().play();
      if (A.cur) A.cur.crossFadeTo(a, 0.3, false);
      A.cur = a;
    };
    A.dispose = () => { mixer.stopAllAction(); for (const m of mats.values()) m.dispose(); };
    return A;
  }
  // models face +Z after export; the game's heading 0 is +X
  fixYaw(kind) { return kind === 'kite' ? Math.PI / 2 : (this.src[kind] ? this.src[kind].yaw : Math.PI / 2); }
}

// Draws peds.js animals (cows, dogs) plus cats on the footpaths and kites in the sky.
export class Fauna {
  constructor(people, kit, scene, W) {
    this.people = people; this.kit = kit; this.scene = scene; this.W = W;
    this.rng = new RNG(808);
    this.models = new Map();   // animal record → model
    this.kites = [];
    if (!kit) return;
    people.drawAnimals = false;
    for (const a of people.animals) this.attach(a, a.kind || (a.cow ? 'cow' : 'dog'));
    if (kit.has('kite')) for (let k = 0; k < 3; k++) {
      const m = kit.create('kite', this.rng);
      scene.add(m.holder); m.play('Fly', 0.6 + this.rng.next() * 0.2);
      this.kites.push({ m, r: 40 + this.rng.next() * 60, h: 45 + this.rng.next() * 35, a: this.rng.next() * 6.28, w: (0.08 + this.rng.next() * 0.06) * (this.rng.chance(0.5) ? 1 : -1), cx: 0, cz: 0 });
    }
  }
  attach(a, kind) {
    const m = this.kit.create(kind, this.rng);
    if (!m) return;
    this.scene.add(m.holder);
    m.play('Idle');
    this.models.set(a, m);
  }
  update(dt, cx, cz) {
    if (!this.kit) return;
    for (const [a, m] of this.models) {
      if (a.gone) { this.scene.remove(m.holder); m.dispose(); this.models.delete(a); continue; }
      const d = Math.abs(a.x - cx) + Math.abs(a.z - cz);
      m.holder.visible = d < 120;
      if (!m.holder.visible) continue;
      const sh = d < 50;
      if (m.sh !== sh) { m.sh = sh; m.root.traverse(o => { if (o.isMesh) o.castShadow = sh; }); }
      // being petted: turned to you; a dog bounces and its whole back end wags, a cat leans in and settles
      let hy = 0, yaw = a.yaw, roll = 0;
      if (a.petT > 0) {
        a.petT -= dt; a.petPh = (a.petPh || 0) + dt;
        if (a.petX !== undefined) yaw = Math.atan2(a.petZ - a.z, a.petX - a.x);
        if (a.kind === 'dog' || (!a.kind && !a.cow)) { hy = Math.abs(Math.sin(a.petPh * 9)) * 0.06; roll = Math.sin(a.petPh * 18) * 0.12; }
        else if (a.kind === 'cat') { hy = -0.03; roll = Math.sin(a.petPh * 3) * 0.05; }
        else { roll = Math.sin(a.petPh * 2) * 0.04; }
      }
      m.holder.position.set(a.x, this.W.surf.height(a.x, a.z) + hy, a.z);
      m.holder.rotation.set(0, -yaw, roll);
      const lie = !a.moving && a.kind !== 'cow' && !a.cow;
      m.play(a.moving ? (a.cow ? 'WalkSlow' : 'Walk') : 'Idle', a.moving ? (a.cow ? 0.9 : Math.min(2.6, Math.max(1, a.v / 1.1))) : 1);
      m.root.position.y = lie && a.lie ? -0.05 : 0;
      m.mixer.update(d < 60 ? dt : dt);
    }
    // kites circle slowly over wherever you are, drifting with you
    for (const k of this.kites) {
      k.cx += (cx - k.cx) * Math.min(1, dt * 0.05); k.cz += (cz - k.cz) * Math.min(1, dt * 0.05);
      if (!k.init) { k.cx = cx; k.cz = cz; k.init = true; }
      k.a += k.w * dt;
      const x = k.cx + Math.cos(k.a) * k.r, z = k.cz + Math.sin(k.a) * k.r;
      k.m.holder.position.set(x, k.h + Math.sin(k.a * 3) * 2, z);
      const yaw = k.a + Math.sign(k.w) * Math.PI / 2;
      k.m.holder.rotation.set(0, -yaw, Math.sign(k.w) * 0.35, 'YXZ');
      k.m.mixer.update(dt);
    }
  }
}
