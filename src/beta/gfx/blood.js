// Blood that pools the way blood does. It was a star: a stamped outline with a spike every fifth point, scaled up from
// where the person was standing when they were hit (by the time they'd stopped they could be ten metres down the road).
// Now it comes from the body, under the head and chest, once the body's come to rest, and spreads from there: a smooth,
// lopsided pool whose edge creeps out unevenly (one side further, a rounded lobe here and there), runs a little further
// downhill on a sloping road, and slows as it goes; a few drops lie round it from the fall. Fresh, it's a deep glossy red;
// over the minutes it darkens to brown and goes dull as it dries. A second spill for the same person (they die later)
// makes their pool bigger rather than starting another.
import * as THREE from 'three';
import { Blood } from '@orig/gfx/blood.js';

const K = 44, DROPS = 6, DV = 9;
const FRESH = new THREE.Color(0x52060a), DRY = new THREE.Color(0x2a0b07);
const frac = (x) => x - Math.floor(x);

function geo() {
  const n = 1 + K + DROPS*DV, g = new THREE.BufferGeometry(), idx = [];
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n*3), 3));
  const nr = new Float32Array(n*3); for (let i = 1; i < nr.length; i += 3) nr[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
  for (let j = 0; j < K; j++) idx.push(0, 1 + (j + 1)%K, 1 + j);
  for (let d = 0; d < DROPS; d++) { const o = 1 + K + d*DV; for (let j = 0; j < DV - 1; j++) idx.push(o, o + 1 + (j + 1)%(DV - 1), o + 1 + j); }
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  return g;
}
// where the body's head and chest lie, if it has a body of its own still moving
function under(p) {
  const R = p && p._rag;
  if (R && R.p) return { x: R.p[3] + (R.p[6] - R.p[3])*0.45, z: R.p[5] + (R.p[8] - R.p[5])*0.45, still: R.sleep || R.out >= 0 || R.t > 6 };
  return p ? { x: p.x, z: p.z, still: !p._hit } : null;
}
function youAt() {
  const G = window.__nhAskG, P = G && G.player; if (!P) return null;
  const o = P.onFoot ? P.foot : P.cur; return o ? [o.x, o.z] : null;
}

Blood.prototype.spill = function (x, z, size = 0.6, grow = 25, p = null) {
  // the same person bleeding more: their pool grows on
  if (p) for (const b of this.list) if (b.m.visible && b.p === p) { b.max = Math.max(b.max, size); b.grow = Math.max(b.grow, b.t + grow*0.6); b.life = Math.max(b.life, b.t + 240); return b; }
  const b = this.list[this.k = (this.k + 1)%this.list.length];
  if (!b.g2) { b.m.geometry.dispose(); b.m.geometry = b.g2 = geo(); b.m.rotation.set(0, 0, 0); b.m.scale.setScalar(1); b.m.frustumCulled = false; }
  b.p = p; b.x = x; b.z = z; b.t = 0; b.max = size; b.grow = grow; b.life = 240 + Math.random()*60; b.wait = !!p; b.wt = 0; b.placed = false;
  b.seed = Math.random()*1000;
  const mat = b.m.material; mat.color.copy(FRESH); mat.roughness = 0.18; mat.metalness = 0; mat.opacity = 0.96; mat.transparent = true;
  b.m.visible = false;
  return b;
};

function place(B, b) {
  const W = B.W, s = b.seed, r = (k) => frac(Math.sin(s*12.9898 + k*78.233)*43758.5453);
  const h = (x, z) => (W.surf ? W.surf.height(x, z) : 0);
  b.y = h(b.x, b.z) + 0.011;
  // which way is down, and how steeply: it runs that way
  const gx = h(b.x - 0.5, b.z) - h(b.x + 0.5, b.z), gz = h(b.x, b.z - 0.5) - h(b.x, b.z + 0.5), sl = Math.min(1, Math.hypot(gx, gz)*12);
  const dn = Math.atan2(gz, gx), lobes = [[r(1)*6.283, 0.18 + r(2)*0.2], [r(3)*6.283, 0.1 + r(4)*0.15]];
  b.R = []; b.rate = [];
  const H = [[2, 0.1 + r(5)*0.08, r(6)*6.283], [3, 0.06 + r(7)*0.05, r(8)*6.283], [4, 0.03 + r(9)*0.03, r(10)*6.283], [6, 0.015, r(11)*6.283]];
  for (let j = 0; j < K; j++) {
    const a = j/K*6.283;
    let k = 1; for (const [n, A, ph] of H) k += A*Math.sin(n*a + ph);
    for (const [la, A] of lobes) k += A*Math.pow(Math.max(0, Math.cos(a - la)), 6);
    k += 0.45*sl*Math.pow(Math.max(0, Math.cos(a - dn)), 3);
    b.R.push(k); b.rate.push(0.8 + 0.4*frac(Math.sin((s + j*0.37)*3.1)*999));
  }
  // drops from the fall, round it
  const P = b.m.geometry.attributes.position.array;
  for (let d = 0; d < DROPS; d++) {
    const o = (1 + K + d*DV)*3, a = r(20 + d)*6.283, dd = (1.15 + r(30 + d)*0.7)*b.max, rr = 0.015 + r(40 + d)*0.035, cx = Math.cos(a)*dd, cz = Math.sin(a)*dd;
    P[o] = cx; P[o + 1] = 0; P[o + 2] = cz;
    for (let j = 0; j < DV - 1; j++) { const t = j/(DV - 1)*6.283, q = rr*(0.85 + 0.3*frac(Math.sin((d*9 + j)*7.7 + s)*999)); P[o + 3 + j*3] = cx + Math.cos(t)*q; P[o + 4 + j*3] = 0; P[o + 5 + j*3] = cz + Math.sin(t)*q; }
  }
  b.m.position.set(b.x, b.y, b.z);
  b.placed = true;
}

Blood.prototype.update = function (dt) {
  for (const b of this.list) {
    if (!b.g2 || (!b.m.visible && !b.wait)) continue;
    // waiting for the body to come to rest, then from under its head and chest
    if (b.wait) {
      b.wt += dt;
      const u = under(b.p);
      if (u) { b.x = u.x; b.z = u.z; }
      if (u && !u.still && b.wt < 8) continue;
      b.wait = false; b.p = b.p || null;
    }
    if (!b.placed) { place(this, b); b.m.visible = true; }
    b.t += dt;
    // the edge creeps out, each part at its own pace, slowing as it goes (fast at first, then barely)
    const P = b.m.geometry.attributes.position.array;
    for (let j = 0; j < K; j++) {
      const a = j/K*6.283, g = 1 - Math.exp(-2.6*b.t*b.rate[j]/b.grow), rad = Math.max(0.03, b.max*b.R[j]*g);
      P[3 + j*3] = Math.cos(a)*rad; P[4 + j*3] = 0; P[5 + j*3] = Math.sin(a)*rad;
    }
    b.m.geometry.attributes.position.needsUpdate = true;
    // drying: darker, browner, dull
    const dry = Math.min(1, Math.max(0, (b.t - 50)/150)), mat = b.m.material;
    mat.color.copy(FRESH).lerp(DRY, dry); mat.roughness = 0.18 + 0.55*dry; mat.opacity = 0.96;
    // gone, in the end, only while you're not there to see it go
    if (b.t >= b.life) { const y = youAt(); if (!y || Math.hypot(y[0] - b.x, y[1] - b.z) > 90) { b.m.visible = false; b.p = null; } }
  }
};
