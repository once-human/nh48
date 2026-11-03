// /experiment: the crowd. Everyone is one draw: a single body with every accessory built in, and each person
// switches on their own (glasses, curls, a cap, a sun hat, a beard, headphones, a jhola, a saree, a topi...) and
// has their own colours, height and build, read from a small texture by their number. Legs and arms swing in the
// vertex shader. Near people get the full body; past 40 m a cheap one.
import * as THREE from 'three';
import { Builder, K, hex, rng } from './geo.js';

export const B = { GLASSES: 1, CAP: 2, SUNHAT: 4, BEARD: 8, PHONES: 16, JHOLA: 32, SCARF: 64, LONG: 128, SAREE: 256, TOPI: 512, HELMET: 1024, CURLY: 2048, KURTA: 4096, BUN: 8192, MOUSTACHE: 16384, BACKPACK: 32768 };
// slots: 0 the vertex's own colour, 1 shirt, 2 lower, 3 skin, 4 hair, 5 accessory, 6 second accessory
const S0 = 0, SHIRT = 1, LOWER = 2, SKIN = 3, HAIR = 4, ACC = 5, ACC2 = 6;

function nearBody() {
  const b = new Builder({ pla: 3 });
  const at = (slot, limb = 0, acc = 0, kind = K.cloth) => b.set({ pla: [slot, limb, acc], k: kind });
  const dark = [.1, .09, .09];
  for (const s of [-1, 1]) {
    const L = s < 0 ? 1 : 2, A = s < 0 ? 3 : 4;
    // shoes, legs (not under a saree), arms: sleeve, forearm, hand
    at(S0, L).col(0x2a2420); b.box(s * .09 - .05, 0, -.06, s * .09 + .05, .07, .13);
    at(LOWER, L, -B.SAREE); b.limb([s * .09, .9, 0], [s * .09, .06, .01], .078, .06, 7, false);
    at(SHIRT, A); b.limb([s * .205, 1.41, 0], [s * .225, 1.13, .01], .058, .05, 7);
    at(SKIN, A); b.limb([s * .225, 1.13, .01], [s * .225, .87, .04], .045, .04, 7, false); b.sphere(s * .225, .84, .045, .045, .05, .045, 5, 3);
    // ears, eyes, eyebrows
    at(SKIN); b.sphere(s * .108, 1.6, -.005, .024, .032, .02, 5, 3);
    at(S0).col(dark); b.sphere(s * .04, 1.618, .1, .016, .018, .01, 5, 3);
    at(HAIR); b.box(s * .04 - .025, 1.648, .098, s * .04 + .025, 1.66, .112);
    // glasses: round rims and a bridge
    at(S0, 0, B.GLASSES).col(0x1c1a1a); b.geo(new THREE.TorusGeometry(.032, .007, 3, 10), new THREE.Matrix4().makeTranslation(s * .041, 1.617, .118));
    // headphone cups, a sun-hat brim tie
    at(ACC, 0, B.PHONES); b.sphere(s * .118, 1.6, -.005, .03, .042, .036, 6, 4);
  }
  at(S0, 0, B.GLASSES).col(0x1c1a1a); b.box(-.01, 1.616, .115, .01, 1.624, .12);
  at(ACC, 0, B.PHONES); b.geo(new THREE.TorusGeometry(.122, .012, 3, 8, Math.PI), new THREE.Matrix4().makeTranslation(0, 1.6, -.005));
  // hips, torso, a long kurta, a saree with its pallu
  at(LOWER); b.cyl(0, .93, 0, .155, .17, .14, 10, 0, 0, 0, 1, .7);
  at(SHIRT); b.cyl(0, 1.19, 0, .17, .19, .48, 10, 0, 0, 0, 1, .62);
  at(SHIRT); b.sphere(0, 1.41, 0, .19, .06, .118, 8, 3, Math.PI / 2);
  at(SHIRT, 0, B.KURTA); b.cyl(0, .76, 0, .2, .175, .36, 10, 0, 0, 0, 1, .72);
  at(LOWER, 0, B.SAREE); b.cyl(0, .5, 0, .27, .175, .94, 12, 0, 0, 0, 1, .82);
  at(LOWER, 0, B.SAREE); b.rbox(.11, .62, .03, .02, 1.17, .118, 0, 0, .62);
  at(LOWER, 0, B.SAREE); b.rbox(.14, .7, .03, .14, 1.05, -.1, .1, 0, .1);
  // neck and head; nose, mouth
  at(SKIN); b.cyl(0, 1.46, 0, .05, .048, .1, 8);
  at(SKIN); b.sphere(0, 1.6, 0, .106, .126, .11, 10, 8);
  at(SKIN); b.sphere(0, 1.585, .104, .02, .03, .026, 5, 3);
  at(S0).col(0x6a3030); b.box(-.022, 1.54, .1, .022, 1.548, .108);
  // hair: a cap of it (not under a helmet), curls, long at the back, a bun
  at(HAIR, 0, -B.HELMET); b.geo(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, 1.75), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.618, -.012), new THREE.Quaternion().setFromEuler(new THREE.Euler(-.28, 0, 0)), new THREE.Vector3(.116, .12, .122)));
  const R = rng(5);
  at(HAIR, 0, B.CURLY);
  for (let i = 0; i < 8; i++) { const a = R() * Math.PI * 2, t = .2 + R() * 1.1; b.sphere(Math.sin(t) * Math.cos(a) * .1, 1.65 + Math.cos(t) * .09, Math.sin(t) * Math.sin(a) * .1 - .03, .055, .05, .055, 5, 3); }
  at(HAIR, 0, B.LONG); b.sphere(0, 1.48, -.075, .115, .19, .06, 7, 5);
  at(HAIR, 0, B.BUN); b.sphere(0, 1.6, -.135, .055, .05, .05, 6, 4);
  at(HAIR, 0, B.BEARD); b.sphere(0, 1.535, .045, .1, .075, .075, 8, 5);
  at(HAIR, 0, B.MOUSTACHE); b.box(-.036, 1.556, .104, .036, 1.572, .118);
  // a cap with a brim, a sun hat, a Gandhi topi, a helmet
  at(ACC, 0, B.CAP); b.geo(new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, 1.5), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.64, -.005), new THREE.Quaternion(), new THREE.Vector3(.122, .1, .124)));
  at(ACC, 0, B.CAP); b.box(-.08, 1.65, .09, .08, 1.662, .2);
  at(ACC, 0, B.SUNHAT); b.cyl(0, 1.7, 0, .115, .1, .1, 12); b.cyl(0, 1.665, 0, .22, .22, .014, 12);
  at(S0, 0, B.TOPI).col(0xf2efe6); b.geo(new THREE.CylinderGeometry(.06, .11, .07, 4, 1), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.715, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)), new THREE.Vector3(.8, 1, 1.4)));
  at(ACC, 0, B.HELMET); b.sphere(0, 1.62, -.005, .138, .14, .145, 10, 5, 1.85);
  at(S0, 0, B.HELMET).col(0x24282a); b.geo(new THREE.SphereGeometry(1, 6, 2, -.9, 1.8, 1.3, .55), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.62, 0), new THREE.Quaternion(), new THREE.Vector3(.142, .14, .15)));
  // a scarf, a jhola on a strap, a backpack
  at(ACC2, 0, B.SCARF); b.geo(new THREE.TorusGeometry(.07, .03, 4, 8), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.44, .01), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + .25, 0, 0)), new THREE.Vector3(1, 1, 1)));
  at(ACC2, 0, B.SCARF); b.rbox(.07, .26, .025, .06, 1.3, .115, .1, 0, .15);
  at(ACC2, 0, B.JHOLA); b.rbox(.03, .72, .02, .02, 1.12, .12, 0, 0, -.62); b.rbox(.028, .3, .02, .02, 1.12, -.115, 0, 0, -.62); b.rbox(.07, .3, .26, .25, .78, 0, 0, 0, .05);
  at(ACC2, 0, B.BACKPACK); b.rbox(.28, .34, .13, 0, 1.2, -.17); b.rbox(.04, .3, .03, .1, 1.24, .12); b.rbox(.04, .3, .03, -.1, 1.24, .12);
  return b.geometry();
}

function farBody() {
  const b = new Builder({ pla: 3 });
  const at = (slot, limb = 0, acc = 0) => b.set({ pla: [slot, limb, acc], k: K.cloth });
  for (const s of [-1, 1]) {
    at(LOWER, s < 0 ? 1 : 2, -B.SAREE); b.box(s * .09 - .065, .02, -.06, s * .09 + .065, .92, .06);
    at(SHIRT, s < 0 ? 3 : 4); b.box(s * .21 - .045, .86, -.045, s * .21 + .045, 1.42, .045);
  }
  at(LOWER, 0, B.SAREE); b.box(-.22, .02, -.17, .22, .95, .17);
  at(SHIRT); b.box(-.18, .9, -.11, .18, 1.44, .11);
  at(SHIRT, 0, B.KURTA); b.box(-.19, .6, -.12, .19, .92, .12);
  at(SKIN); b.sphere(0, 1.58, 0, .11, .13, .11, 6, 5);
  at(HAIR, 0, -B.HELMET); b.sphere(0, 1.63, -.015, .12, .1, .125, 6, 3, 1.6);
  at(ACC, 0, B.HELMET | B.CAP | B.SUNHAT); b.sphere(0, 1.64, 0, .14, .12, .145, 6, 3, 1.6);
  at(S0, 0, B.TOPI).col(0xf2efe6); b.box(-.06, 1.68, -.09, .06, 1.75, .09);
  at(ACC2, 0, B.BACKPACK | B.JHOLA); b.box(-.14, 1.0, -.25, .14, 1.36, -.11);
  return b.geometry();
}

// ---------------------------------------------------------------- who they are
const SKINS = [0x8a5a3c, 0xa06a48, 0xb27a54, 0x6e4630, 0xc08a62, 0x7d5038, 0x94603f, 0x5e3c28, 0xb98262];
const HAIRS = [0x1a1512, 0x231a14, 0x2a1f18, 0x1a1512, 0x3a2a1e];
const BLUE = 0x2f5fd0, ORANGE = 0xf08a24, YELLOW = 0xf2c230, RED = 0xd83a2a, GREEN = 0x2f8a5a, TEAL = 0x2a8a8a, PINK = 0xd8607e, MAROON = 0x7a2a30, NAVY = 0x283a6a, WHITE = 0xeee8dc, BLACK = 0x2a2a2c, OLIVE = 0x6b7a3a, CREAM = 0xf0e6cc, MUSTARD = 0xd8a020, KHAKI = 0xb59a6a, SKY = 0xa8c8e8, PURPLE = 0x6a4a9a;
const POP = [BLUE, ORANGE, YELLOW, RED, GREEN, TEAL, PINK, MAROON, NAVY, WHITE, BLACK, OLIVE, MUSTARD, PURPLE, BLUE, ORANGE];
const JEANS = [0x2e4a7a, 0x3a5a8a, 0x22324f, 0x2a2a2e, 0x5a6a7a, KHAKI];

export function makeLook(R) {
  const pick = (a) => a[(R() * a.length) | 0], p = (x) => R() < x;
  const L = { shirt: pick(POP), lower: pick(JEANS), skin: pick(SKINS), hair: pick(HAIRS), acc: pick(POP), acc2: pick(POP), mask: 0, h: .93 + R() * .14, girth: .45 + R() * .5 };
  const r = R();
  if (r < .22) {                                                   // college: tee, jeans, curls or a cap, earphones, a bag
    if (p(.4)) L.mask |= B.CURLY; if (p(.35)) L.mask |= B.GLASSES; if (p(.3)) L.mask |= B.PHONES; if (p(.45)) L.mask |= B.BACKPACK; else if (p(.3)) L.mask |= B.JHOLA;
    if (p(.2)) L.mask |= B.CAP; if (p(.25)) L.mask |= B.BEARD; L.girth = .3 + R() * .4;
  } else if (r < .38) {                                            // office: a pale shirt, dark trousers, a moustache
    L.shirt = pick([WHITE, SKY, CREAM, 0xd8d0e8, 0xe8d8c0, BLUE]); L.lower = pick([0x2a2a2e, 0x3a3a44, 0x4a4030, NAVY]);
    if (p(.6)) L.mask |= B.MOUSTACHE; if (p(.45)) L.mask |= B.GLASSES; if (p(.3)) L.mask |= B.JHOLA;
  } else if (r < .58) {                                            // in a saree: the hair up or down, a jhola
    L.mask |= B.SAREE | (p(.6) ? B.BUN : B.LONG); L.lower = pick([ORANGE, RED, GREEN, PINK, YELLOW, BLUE, MAROON, PURPLE, TEAL]); L.shirt = pick([L.lower, MUSTARD, GREEN, MAROON, RED]);
    if (p(.35)) L.mask |= B.GLASSES; if (p(.4)) L.mask |= B.JHOLA; L.h = .88 + R() * .1; if (p(.25)) L.hair = 0x8a8680;
  } else if (r < .7) {                                             // an uncle in a kurta, perhaps the topi
    L.mask |= B.KURTA; L.shirt = pick([WHITE, CREAM, SKY, ORANGE, YELLOW]); L.lower = pick([WHITE, CREAM, 0x8a8a8a]);
    if (p(.4)) L.mask |= B.TOPI; if (p(.75)) L.mask |= B.MOUSTACHE; if (p(.5)) L.mask |= B.GLASSES; if (p(.5)) L.hair = pick([0x9a9590, 0xd8d4cc, 0x9a9590]);
    if (p(.3)) L.mask |= B.JHOLA; L.girth = .5 + R() * .5;
  } else if (r < .85) {                                            // a kurti, a dupatta, the hair long
    L.mask |= B.KURTA | B.LONG; L.shirt = pick([PINK, YELLOW, TEAL, ORANGE, BLUE, GREEN, PURPLE, RED]); L.lower = pick([WHITE, BLACK, NAVY, CREAM, MUSTARD]);
    if (p(.55)) L.mask |= B.SCARF; if (p(.35)) L.mask |= B.JHOLA; if (p(.3)) L.mask |= B.GLASSES; if (p(.2)) L.mask |= B.SUNHAT; L.h = .9 + R() * .1; L.girth = .3 + R() * .4;
  } else if (r < .94) {                                            // working: a vest or an old shirt, a bandana, a beard
    L.shirt = pick([OLIVE, KHAKI, CREAM, RED, BLUE, 0x8a7a5a]); L.lower = pick([KHAKI, 0x4a4030, NAVY, 0x6a5a40]);
    if (p(.35)) L.mask |= B.SCARF; if (p(.4)) L.mask |= B.BEARD; else if (p(.5)) L.mask |= B.MOUSTACHE; if (p(.2)) L.mask |= B.CAP; if (p(.15)) L.mask |= B.HELMET;
    L.acc2 = pick([RED, ORANGE, YELLOW]);
  } else {                                                         // a schoolkid
    L.shirt = WHITE; L.lower = pick([NAVY, 0x3a5a8a, MAROON]); L.mask |= B.BACKPACK; L.h = .64 + R() * .12; L.girth = .3; if (p(.4)) L.mask |= B.LONG;
  }
  return L;
}

// ---------------------------------------------------------------- the crowd
export const NEAR = 34;
export class Crowd {
  constructor(max, material) {
    this.max = max; this.n = 0; this.R = 170;
    const rows = Math.ceil(max * 8 / 64);
    this.tex = new THREE.DataTexture(new Uint8Array(64 * rows * 4), 64, rows, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter; this.tex.generateMipmaps = false;
    this.meshes = [nearBody(), farBody()].map((g) => {
      const ig = new THREE.InstancedBufferGeometry(); ig.index = null;
      for (const k in g.attributes) ig.setAttribute(k, g.attributes[k]);
      const iPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
      const iAnim = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
      ig.setAttribute('iPos', iPos); ig.setAttribute('iAnim', iAnim); ig.instanceCount = 0;
      const m = new THREE.Mesh(ig, material); m.frustumCulled = false; m.tris = g.attributes.position.count / 3;
      return m;
    });
    this.near = this.meshes[0]; this.far = this.meshes[1];
    const F = (n) => new Float32Array(max);
    this.x = F(); this.z = F(); this.yaw = F(); this.spd = F(); this.dir = F(); this.lane = F(); this.ph = F(); this.mode = new Uint8Array(max); this.hgt = F();
    this.rand = rng(7); this.crossing = 0; this.shown = [0, 0];
    this.player = { x: 0, z: 0, yaw: Math.PI, spd: 0 };
    this.look(0, { shirt: BLUE, lower: 0x2e4a7a, skin: 0xa06a48, hair: 0x1a1512, acc: ORANGE, acc2: ORANGE, mask: B.CURLY | B.GLASSES | B.JHOLA, h: 1, girth: .45 });
  }
  look(i, L) {
    const d = this.tex.image.data, o = i * 8 * 4, put = (k, h, a = 255) => { const [r, g, b] = hex(h); d[o + k * 4] = r * 255; d[o + k * 4 + 1] = g * 255; d[o + k * 4 + 2] = b * 255; d[o + k * 4 + 3] = a; };
    put(0, L.shirt); put(1, L.lower); put(2, L.skin); put(3, L.hair); put(4, L.acc); put(5, L.acc2);
    d[o + 24] = L.mask & 255; d[o + 25] = (L.mask >> 8) & 255; d[o + 26] = Math.round((L.h - .6) / .6 * 255); d[o + 27] = Math.round(L.girth * 255);
    this.hgt[i] = L.h;
  }
  // how many people: new ones are placed around pz, the rest keep walking
  setCount(n, pz) {
    n = Math.min(this.max, Math.max(1, n | 0));
    const R = this.rand;
    for (let i = Math.max(1, this.n); i < n; i++) {
      this.look(i, makeLook(R));
      this.spawn(i, pz + (R() * 2 - 1) * this.R);
    }
    this.n = n; this.tex.needsUpdate = true;
  }
  spawn(i, z) {
    const R = this.rand, s = R() < .5 ? -1 : 1, r = R();
    this.z[i] = z; this.ph[i] = R() * 100;
    if (r < .18) {                                                  // stood at a shop front, talking
      this.mode[i] = 1; this.x[i] = s * (5.9 + R() * .7); this.lane[i] = this.x[i]; this.yaw[i] = R() * 6.28; this.spd[i] = 0;
    } else {
      this.mode[i] = 0; this.dir[i] = R() < .5 ? -1 : 1;
      this.lane[i] = r < .3 ? s * (3.95 + R() * .45) : s * (4.85 + R() * 1.55);    // some on the road's edge, as in Pune
      this.x[i] = this.lane[i]; this.spd[i] = (1.05 + R() * .55) * (this.hgt[i] < .8 ? 1.15 : 1);
      this.yaw[i] = this.dir[i] > 0 ? 0 : Math.PI;
    }
  }
  update(dt, t, camera, obstacles) {
    const P = this.player, R = this.rand, n = this.n, span = this.R * 2;
    obstacles.length = 0;
    for (let i = 1; i < n; i++) {
      const m = this.mode[i];
      if (m === 0) {
        this.z[i] += this.dir[i] * this.spd[i] * dt;
        this.x[i] += (this.lane[i] - this.x[i]) * Math.min(1, dt * 1.2);
        this.ph[i] += dt * this.spd[i] / (.68 * this.hgt[i]) * Math.PI;
        this.yaw[i] = this.dir[i] > 0 ? 0 : Math.PI;
        if (this.crossing < 2 + n / 120 && R() < dt * .004) { this.mode[i] = 2; this.dir[i] = this.x[i] > 0 ? -1 : 1; this.crossing++; }
      } else if (m === 1) {
        this.ph[i] += dt * 1.3;
      } else {
        this.x[i] += this.dir[i] * this.spd[i] * 1.1 * dt;
        this.ph[i] += dt * this.spd[i] * 1.1 / (.68 * this.hgt[i]) * Math.PI;
        this.yaw[i] = this.dir[i] > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (Math.abs(this.x[i]) < 4.6) obstacles.push(this.x[i], this.z[i]);
        if (this.x[i] * this.dir[i] > 4.9 + R() * 1.4) { this.mode[i] = 0; this.lane[i] = this.x[i]; this.dir[i] = R() < .5 ? -1 : 1; this.crossing--; }
      }
      // you: people step round you
      const dx = this.x[i] - P.x, dz = this.z[i] - P.z;
      if (dx * dx + dz * dz < .5) { const s = dx >= 0 ? 1 : -1; this.x[i] += s * dt * 1.5; if (m === 0) this.lane[i] += s * dt * 1.5; }
      // the street keeps going: whoever falls far behind you walks back in at the other end
      if (dz > this.R) this.z[i] -= span; else if (dz < -this.R) this.z[i] += span;
    }
    P.ph = (P.ph || 0) + dt * P.spd / .68 * Math.PI;
    // the instance lists: near (full body), far (cheap), nobody behind the camera
    const cx = camera.position.x, cz = camera.position.z, fx = -Math.sin(camera.rotation.y), fz = -Math.cos(camera.rotation.y);
    const nA = this.near.geometry.attributes, fA = this.far.geometry.attributes;
    const np = nA.iPos.array, na = nA.iAnim.array, fp = fA.iPos.array, fa = fA.iAnim.array;
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const x = i ? this.x[i] : P.x, z = i ? this.z[i] : P.z, dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 > 9 && dx * fx + dz * fz < -2) continue;
      const y = Math.abs(x) > 4.5 ? .15 : 0, yaw = i ? this.yaw[i] : P.yaw, ph = i ? this.ph[i] : P.ph, amp = i ? (this.mode[i] === 1 ? 0 : 1) : Math.min(1, P.spd / 1.2);
      if (d2 < NEAR * NEAR) { np[a * 4] = x; np[a * 4 + 1] = y; np[a * 4 + 2] = z; np[a * 4 + 3] = yaw; na[a * 4] = ph; na[a * 4 + 1] = amp; na[a * 4 + 2] = i; a++; }
      else if (d2 < 340 * 340) { fp[b * 4] = x; fp[b * 4 + 1] = y; fp[b * 4 + 2] = z; fp[b * 4 + 3] = yaw; fa[b * 4] = ph; fa[b * 4 + 1] = amp; fa[b * 4 + 2] = i; b++; }
    }
    this.near.geometry.instanceCount = a; this.far.geometry.instanceCount = b; this.shown = [a, b];
    for (const A of [nA, fA]) { A.iPos.clearUpdateRanges(); A.iAnim.clearUpdateRanges(); }
    nA.iPos.addUpdateRange(0, a * 4); nA.iAnim.addUpdateRange(0, a * 4); fA.iPos.addUpdateRange(0, b * 4); fA.iAnim.addUpdateRange(0, b * 4);
    nA.iPos.needsUpdate = nA.iAnim.needsUpdate = fA.iPos.needsUpdate = fA.iAnim.needsUpdate = true;
  }
}
