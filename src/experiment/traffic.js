// /experiment: traffic. Autos, hatchbacks, PMPML buses and a lot of two-wheelers, one draw per kind. Each lane
// follows the one in front (a simple IDM) and stops for you and for anyone crossing. Like the crowd, the traffic
// is a ring around you: whatever drives far past you comes back in at the other end of the ring.
import * as THREE from 'three';
import { Builder, K, hex, rng } from './geo.js';

// vsa: [slot, acc]. slot 0 = the vertex's colour, 1 = iCol0, 2 = iCol1; acc = a bit of iMask that must be set
function vb() { const b = new Builder({ vsa: 2 }); return [b, (slot, kind = K.paint, acc = 0) => b.set({ vsa: [slot, acc], k: kind })]; }
const DARK = 0x1c1a1a, TYRE = 0x161616, GLASS = 0x22343a, SKINC = 0x9a6444, HAIRC = 0x1a1512;
const wheel = (b, x, y, z, r, w) => b.cyl(x, y, z, r, r, w, 12, 0, 0, Math.PI / 2);

function autoGeo() {
  const [b, at] = vb();
  at(2); b.box(-.62, .28, -1.15, .62, .78, .72);                                     // the black tub
  at(2); b.box(-.4, .3, .72, .4, .72, 1.22); at(1); b.box(-.4, .72, .72, .4, 1.04, 1.18);   // the nose: black under, yellow over
  at(1); b.box(-.66, 1.26, -1.2, .66, 1.6, .9); at(1); b.box(-.58, 1.6, -1.12, .58, 1.7, .82);  // the hood
  at(1); b.box(-.66, .78, -1.2, .66, 1.26, -1.08);                                   // the back
  at(0, K.plain).col(DARK); for (const x of [-.6, .6]) b.box(x - .03, .78, .8, x + .03, 1.26, .86);
  at(0, K.glass).col(GLASS); b.box(-.5, .98, .84, .5, 1.26, .88);
  at(0, K.plain).col(TYRE); wheel(b, 0, .21, 1.0, .21, .12); wheel(b, -.6, .21, -.8, .21, .12); wheel(b, .6, .21, -.8, .21, .12);
  at(0, K.plain).col(0x2a2420); b.box(-.55, .78, -1.06, .55, 1.12, -.82);            // the passenger seat
  at(0, K.cloth).col(0xb59a6a); b.box(-.2, .8, .18, .2, 1.2, .48);                   // the driver, in khaki
  at(0, K.cloth).col(SKINC); b.sphere(0, 1.33, .36, .1, .12, .1, 8, 6);
  at(0, K.cloth).col(HAIRC); b.sphere(0, 1.37, .34, .105, .09, .105, 8, 4, 1.7);
  at(0, K.plain).col(0xf2ead0); b.sphere(0, .92, 1.19, .06, .06, .04, 6, 4);
  return b.geometry();
}
function carGeo() {
  const [b, at] = vb();
  at(1); b.box(-.82, .32, -1.9, .82, .86, 1.9);
  at(1); b.box(-.8, .86, .55, .8, .95, 1.5);                                         // the bonnet's rise
  at(0, K.glass).col(GLASS); b.box(-.74, .86, -1.55, .74, 1.36, .55);
  at(1); b.box(-.76, 1.36, -1.6, .76, 1.45, .5);
  at(0, K.plain).col(TYRE); for (const x of [-.78, .78]) for (const z of [-1.25, 1.25]) wheel(b, x, .3, z, .3, .2);
  at(0, K.plain).col(0x2a2a2a); b.box(-.84, .3, 1.88, .84, .5, 1.98); b.box(-.84, .3, -1.98, .84, .5, -1.88);
  at(0, K.plain).col(0xf2ead0); b.box(-.7, .62, 1.9, -.4, .76, 1.93); b.box(.4, .62, 1.9, .7, .76, 1.93);
  at(0, K.plain).col(0xc0302a); b.box(-.75, .62, -1.93, -.5, .76, -1.9); b.box(.5, .62, -1.93, .75, .76, -1.9);
  return b.geometry();
}
// a two-wheeler; acc bits: 1 rider, 2 helmet, 4 dupatta round the face, 8 pillion
function bikeGeo() {
  const [b, at] = vb();
  at(0, K.plain).col(TYRE); wheel(b, 0, .27, .62, .27, .09); wheel(b, 0, .27, -.62, .27, .09);
  at(2); b.box(-.15, .3, -.62, .15, .62, .5); at(2); b.box(-.19, .3, .45, .19, .98, .6);
  at(0, K.plain).col(DARK); b.box(-.35, .98, .48, .35, 1.03, .55); b.box(-.17, .62, -.6, .17, .72, .12);
  at(0, K.plain).col(0xf2ead0); b.box(-.08, .85, .6, .08, .95, .63);
  // the rider
  at(0, K.cloth, 1).col(0x2e3c5a); b.box(-.2, .72, -.28, .2, .86, .22); for (const x of [-.14, .14]) b.box(x - .06, .36, .14, x + .06, .78, .28);
  at(1, K.cloth, 1); b.rbox(.38, .55, .22, 0, 1.1, -.14, -.22);
  at(1, K.cloth, 1); for (const s of [-1, 1]) b.limb([s * .2, 1.3, -.04], [s * .3, 1.02, .48], .05, .045, 6);
  at(0, K.cloth, 1).col(SKINC); b.sphere(0, 1.52, -.02, .1, .12, .105, 8, 6);
  at(0, K.cloth, 1).col(HAIRC); b.sphere(0, 1.56, -.04, .108, .09, .11, 8, 4, 1.7);
  at(2, K.paint, 2); b.sphere(0, 1.55, -.03, .135, .135, .14, 10, 6, 1.9);
  at(0, K.glass, 2).col(0x24282a); b.box(-.1, 1.5, .09, .1, 1.58, .11);
  at(1, K.cloth, 4); b.sphere(0, 1.53, -.02, .125, .14, .125, 8, 6);
  // a pillion, sat side-saddle in a saree
  at(0, K.cloth, 8).col(0xe07a2a); b.rbox(.36, .5, .22, 0, 1.08, -.48, .1); b.rbox(.42, .3, .5, .12, .78, -.45);
  at(0, K.cloth, 8).col(SKINC); b.sphere(0, 1.48, -.48, .1, .12, .1, 8, 6);
  at(0, K.cloth, 8).col(HAIRC); b.sphere(0, 1.5, -.55, .11, .12, .1, 8, 5);
  return b.geometry();
}
function busGeo() {
  const [b, at] = vb();
  at(1); b.box(-1.25, .5, -5.5, 1.25, 3.0, 5.5);
  at(2); b.box(-1.27, 1.0, -5.52, 1.27, 1.28, 5.52);
  at(0, K.glass).col(GLASS); b.box(-1.27, 1.7, -4.9, 1.27, 2.62, 4.7); b.box(-1.12, 1.25, 5.5, 1.12, 2.65, 5.56);
  at(1); b.box(-1.2, 3.0, -5.3, 1.2, 3.14, 5.2);
  at(0, K.plain).col(0x2a2018); b.box(-.9, 2.7, 5.5, .9, 2.92, 5.58);
  at(0, K.plain).col(0xf2a030); b.box(-.7, 2.75, 5.58, .7, 2.87, 5.6);
  at(0, K.plain).col(TYRE); for (const x of [-1.12, 1.12]) for (const z of [-3.6, 3.4]) wheel(b, x, .5, z, .5, .3);
  at(0, K.plain).col(0x2a2a2a); b.box(-1.28, .4, 5.5, 1.28, .7, 5.65);
  return b.geometry();
}

const TYPES = {
  bike: { geo: bikeGeo, len: 1.9, vmax: 11, a: 3, share: .52 },
  auto: { geo: autoGeo, len: 2.7, vmax: 8.5, a: 2.2, share: .22 },
  car: { geo: carGeo, len: 4, vmax: 10, a: 2.4, share: .2 },
  bus: { geo: busGeo, len: 11.2, vmax: 8, a: 1.2, share: .06 },
};
// India keeps left: going away from the start (-z) on the left (-x)
const LANES = [{ x: -2.1, dir: -1, big: true }, { x: 2.1, dir: 1, big: true }, { x: -3.05, dir: -1 }, { x: 3.05, dir: 1 }, { x: -.7, dir: -1 }, { x: .7, dir: 1 }];

const CARS = [0xeeeeea, 0xeeeeea, 0xeeeeea, 0xb8bcc0, 0xb8bcc0, 0xc0302a, 0x2f5fd0, 0x3a3a3e, 0x1c1c1e, 0x7a2a30, 0xe07a24, 0x2f6a8a];
const BIKES = [0x1c1c1e, 0x1c1c1e, 0xb8302a, 0x2f5fd0, 0x6a6a6e, 0xeeeeea, 0x7a2a30, 0x2a6a4a];
const SHIRTS = [0x2f5fd0, 0xf08a24, 0xf2c230, 0xd83a2a, 0x2f8a5a, 0xeee8dc, 0x262626, 0x2a8a8a, 0xd8607e, 0xa8c8e8, 0x6b7a3a, 0x283a6a];

export class Traffic {
  constructor(max, material) {
    this.max = max; this.R = 230; this.list = []; this.rand = rng(11);
    this.meshes = {};
    for (const k in TYPES) {
      const g = TYPES[k].geo(), cap = Math.ceil(max * TYPES[k].share) + 4;
      const ig = new THREE.InstancedBufferGeometry();
      for (const a in g.attributes) ig.setAttribute(a, g.attributes[a]);
      ig.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
      ig.setAttribute('iCol0', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
      ig.setAttribute('iCol1', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
      ig.setAttribute('iMask', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1));
      ig.instanceCount = 0;
      const m = new THREE.Mesh(ig, material); m.frustumCulled = false; m.tris = g.attributes.position.count / 3; m.cap = cap;
      this.meshes[k] = m;
    }
  }
  get n() { return this.list.length; }
  // rebuild the traffic with n vehicles around pz
  setCount(n, pz) {
    n = Math.max(0, Math.min(this.max, n | 0));
    const R = this.rand, pick = (a) => a[(R() * a.length) | 0];
    const counts = {}; let left = n;
    for (const k of ['bus', 'car', 'auto']) { counts[k] = Math.round(n * TYPES[k].share); left -= counts[k]; }
    counts.bike = Math.max(0, left);
    this.list = [];
    const idx = { bike: 0, auto: 0, car: 0, bus: 0 };
    for (const k in counts) for (let i = 0; i < counts[k] && idx[k] < this.meshes[k].cap; i++) {
      const T = TYPES[k], m = this.meshes[k], j = idx[k]++, A = m.geometry.attributes;
      const lanes = k === 'bike' ? [2, 3, 4, 5, 2, 3] : [0, 1];
      const v = { k, j, T, lane: pick(lanes), p: 0, v: T.vmax * (.6 + R() * .4), vmax: T.vmax * (.8 + R() * .35), len: T.len, seed: R() * 100 };
      let c0, c1, mask = 0;
      if (k === 'auto') { c0 = R() < .85 ? 0xf2c230 : 0xe8b420; c1 = R() < .72 ? 0x1e1e1e : 0x2f7a4a; }
      else if (k === 'car') { c0 = pick(CARS); c1 = 0; }
      else if (k === 'bus') { const r = R(); c0 = r < .55 ? 0xc8522a : r < .8 ? 0x2f6ab0 : 0x3a8a4a; c1 = 0xf0e6cc; }
      else { c0 = pick(SHIRTS); c1 = pick(BIKES); mask = 1 | (R() < .5 ? 2 : R() < .35 ? 4 : 0) | (R() < .25 ? 8 : 0); }
      A.iCol0.array.set(hex(c0), j * 3); A.iCol1.array.set(hex(c1), j * 3); A.iMask.array[j] = mask;
      this.list.push(v);
    }
    for (const k in this.meshes) { const A = this.meshes[k].geometry.attributes; A.iCol0.needsUpdate = A.iCol1.needsUpdate = A.iMask.needsUpdate = true; this.meshes[k].geometry.instanceCount = idx[k]; }
    // spread each lane's vehicles out along the ring
    const span = this.R * 2;
    LANES.forEach((L, li) => {
      const mine = this.list.filter(v => v.lane === li); let p = pz * L.dir - this.R;
      const gap = span / Math.max(1, mine.length);
      for (const v of mine) { v.p = p + R() * Math.max(0, gap - v.len - 2); p += Math.max(gap, v.len + 1.5); v.v = Math.min(v.v, v.vmax); }
    });
  }
  // obstacles: a flat list x, z, x, z... (you and whoever's crossing)
  update(dt, t, pz, obstacles) {
    const byLane = LANES.map(() => []);
    for (const v of this.list) byLane[v.lane].push(v);
    for (let li = 0; li < LANES.length; li++) {
      const L = LANES[li], q = byLane[li], half = L.big ? 1.1 : .55;
      q.sort((a, b) => b.p - a.p);
      for (let i = 0; i < q.length; i++) {
        const v = q[i], lead = i ? q[i - 1] : null;
        let gap = lead ? (lead.p - lead.len / 2) - (v.p + v.len / 2) : 1e9, vl = lead ? lead.v : v.vmax;
        for (let o = 0; o < obstacles.length; o += 2) {
          if (Math.abs(obstacles[o] - L.x) > half + .6) continue;
          const op = obstacles[o + 1] * L.dir, g = op - .5 - (v.p + v.len / 2);
          if (g > -.5 && g < gap) { gap = g; vl = 0; }
        }
        const s0 = v.k === 'bike' ? .9 : 1.8, star = s0 + v.v * .9 + v.v * (v.v - vl) / (2 * Math.sqrt(v.T.a * 4));
        let acc = v.T.a * (1 - Math.pow(v.v / v.vmax, 4) - Math.pow(Math.max(star, 0) / Math.max(gap, .05), 2));
        acc = Math.max(-9, Math.min(v.T.a, acc));
        v.v = Math.max(0, v.v + acc * dt); v.p += v.v * dt;
        const rel = v.p - pz * L.dir;
        if (rel > this.R) v.p -= this.R * 2; else if (rel < -this.R) v.p += this.R * 2;
      }
    }
    for (const k in this.meshes) this.meshes[k].geometry.attributes.iPos.needsUpdate = true;
    for (const v of this.list) {
      const L = LANES[v.lane], a = this.meshes[v.k].geometry.attributes.iPos.array, o = v.j * 4;
      const wob = v.k === 'bike' ? Math.sin(t * .35 + v.seed) * .15 : 0;
      a[o] = L.x + wob + (v.k === 'bus' ? L.dir * .15 : 0); a[o + 1] = 0; a[o + 2] = v.p * L.dir; a[o + 3] = (L.dir > 0 ? 0 : Math.PI) + (v.k === 'bike' ? Math.cos(t * .35 + v.seed) * .06 * Math.min(1, v.v / 4) : 0);
    }
  }
}
