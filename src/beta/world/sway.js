// What a post does when it's struck and stays up, and what its wires do with it. A steel lamp post or a signal rings
// like the tube it is: knocked, it sways at its own pitch and dies away over seconds; hit harder it bends at its foot
// (quickly, in about a tenth of a second, the steel giving) and then wobbles about where it's bent to. A concrete pole
// is stiffer and heavier, and its wires damp it: a short shudder. Each wire between two poles hangs by its own weight,
// a curve with the length it has: lean the pole towards the next one and it slackens and sags lower, away and it
// pulls tight; shake the pole and the wire swings about the line between its ends (as a pendulum would, at the rate
// its sag gives it, sqrt(1.25 g / sag)) and bounces up and down, long after the pole has stopped. When the pole comes
// down its end of each wire goes with the top of the pole, down into the road, and the wire hangs from the next pole
// to there, swinging, lying on the road where it reaches it.
import * as THREE from 'three';
import { compose } from '@orig/world/props.js';

// f: Hz, z: how much each swing loses (a share of critical)
const MODE = { lamp: { f: 1.3, z: 0.09 }, signal: { f: 2.1, z: 0.11 }, pole: { f: 1.6, z: 0.2 } };
const G0 = 9.81, _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const sm = (k) => k <= 0 ? 0 : k >= 1 ? 1 : k*k*(3 - 2*k);

// ---------------------------------------------------------------- a post struck
// n: which way the blow went (x, z), da: how much it bent over for good (rad), E: what the blow brought (J)
export function kick(X, r, nx, nz, da, E) {
  const M = MODE[r.kind]; if (!M || !r.items.length || r.st === 2) return;
  const S = X.spec(r);
  if (!r.rest) { r.rest = new THREE.Vector3(); r.y2 = new THREE.Vector3(); r.v2 = new THREE.Vector3(); }
  if (da > 0) {
    const to = r.rest.clone(); to.x += nx*da; to.z += nz*da; if (to.length() > 0.42) to.setLength(0.42);
    r.bend = { f: (r.bend ? r.tilt.clone().sub(r.y2) : r.rest.clone()), to, t: 0, T: 0.08 + to.distanceTo(r.rest)*0.5 };
    r.rest.copy(to);
  }
  // what of the blow stays in it as a ring: a few hundredths of it, as the post's own spring takes it
  const I = S.mass*S.h*S.h/3, w = 2*Math.PI*M.f, th = Math.min(0.06, Math.sqrt(2*0.04*E/(I*w*w)));
  r.v2.x += nx*th*w; r.v2.z += nz*th*w;
  if (!r.live) {
    const geo = r.kind === 'lamp' ? (r.dark ? X.W.proto.lampDead : X.W.proto.lamp) : X.geoOf(r);
    if (!geo) return;
    r.live = X.mesh(geo);
    for (const [, it] of r.items) it.off = true;
    if (r.deadIt) r.deadIt.off = true;
    X.dirty();
  }
  if (r.st === 0) r.st = 1;
  r.tb = X.t; X.down.add(r); X.moving.add(r);
  if (r.kind === 'pole') for (const q of spansOf(X, r)) wake(q);
}
// every frame: the posts on the move, then the wires
export function step(X, dt) {
  for (const r of X.moving) {
    const M = MODE[r.kind], w = 2*Math.PI*M.f;
    let base = r.rest;
    if (r.bend) { const B = r.bend; B.t += dt; base = _a.copy(B.f).lerp(B.to, sm(B.t/B.T)); if (B.t >= B.T) r.bend = null; }
    // (semi-implicit: the speed first, then where it gets to)
    const n = Math.max(1, Math.ceil(dt*w/0.4)), h = dt/n;
    for (let k = 0; k < n; k++) { r.v2.addScaledVector(r.y2, -w*w*h).multiplyScalar(1 - 2*M.z*w*h); r.y2.addScaledVector(r.v2, h); }
    r.tilt.copy(base).add(r.y2); r.tilt.y = 0;
    r.live.matrix.copy(X.frame(r, _m)); r.live.matrixWorld.copy(r.live.matrix);
    follow(X, r);
    if (!r.bend && r.y2.lengthSq() < 1e-8 && r.v2.lengthSq() < 4e-6) settle(X, r);
  }
  stepWires(X, dt);
}
// still again: back into its set, leaning as it's been left
function settle(X, r) {
  r.tilt.copy(r.rest); r.y2.set(0, 0, 0); r.v2.set(0, 0, 0);
  for (const [, it] of r.items) { it.off = false; X.lean(r, it); }
  if (r.dark) for (const [s, it] of r.items) if (s === X.W.lampSet) it.off = true;
  if (r.deadIt) { r.deadIt.off = false; X.lean(r, r.deadIt); }
  if (r.live) { r.live.parent && r.live.parent.remove(r.live); r.live = null; }
  X.moving.delete(r);
  follow(X, r, true);
  if (r.rest.lengthSq() < 1e-6 && r.st === 1 && !r.dark && !r.marks) { r.st = 0; X.down.delete(r); }
  X.dirty();
}
// what goes with it: a lamp's light, a signal's three bulbs
function follow(X, r, done) {
  if (r.lamp) {
    if (!r.lamp0) r.lamp0 = [r.lamp[0], r.lamp[1]];
    _v.set(r.lamp0[0] - r.x, 8.05, r.lamp0[1] - r.z); const a = r.tilt.length();
    if (a > 1e-5) _v.applyAxisAngle(_a.set(r.tilt.z, 0, -r.tilt.x).normalize(), a);
    r.lamp[0] = r.x + _v.x; r.lamp[1] = r.z + _v.z; if (done) X.W._lampsDirty = true;
  }
  if (r.head) bulbs(X, r);
}
// the lean alone, about the foot (as Smash.frame leans it)
function rotOf(X, r) {
  const a = r.tilt.length(); if (a < 1e-5) return _m2.identity();
  return _m2.makeRotationAxis(_a.set(r.tilt.z, 0, -r.tilt.x).normalize(), a);
}
export function bulbs(X, r) {
  const B = X.W.signalBulbs, h = r.head; if (!B || !h || !h.bulbs.length || h.dead) return;
  const R = rotOf(X, r).clone(), foot = _b.set(r.x, r.y, r.z);
  for (let k = 0; k < h.bulbs.length; k++) {
    compose(h.x + h.dx*0.24, 0.15 + 3.55 - k*0.3, h.z + h.dz*0.24, Math.atan2(h.dx, h.dz), 1, 1, 1, 0, 0, _m);
    _m.premultiply(_m2.makeTranslation(-foot.x, -foot.y, -foot.z)).premultiply(R).premultiply(_m2.makeTranslation(foot.x, foot.y, foot.z));
    B.setMatrixAt(h.bulbs[k], _m);
  }
  B.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- the wires
// a span: one wire's six lengths between two poles. ends[0] at its first corner, ends[1] at its last; each end held by
// a pole (the record) or by nothing that moves
function key(q) { return q.w.id + ':' + q.i; }
export function spansOf(X, r) {
  if (r.wsp && r.wspN === X.lineGen) return r.wsp;
  const out = [];
  for (const w of X.lines) {
    const A = w.a.array;
    for (let i = 0; i + 11 < w.a.count; i += 12) {
      const d0 = Math.hypot(A[i*3] - r.x, A[i*3 + 2] - r.z), d1 = Math.hypot(A[(i + 11)*3] - r.x, A[(i + 11)*3 + 2] - r.z);
      if (d0 >= 1 && d1 >= 1) continue;
      let q = X.wst.get(w.id + ':' + i);
      if (!q) {
        q = { w, i, keep: A.slice(i*3, i*3 + 36), th: 0, thv: 0, d: 0, dv: 0, on: false, ends: [null, null], prev: [null, null], vel: [new THREE.Vector3(), new THREE.Vector3()] };
        const K = q.keep;
        q.c0 = Math.hypot(K[33] - K[0], K[34] - K[1], K[35] - K[2]);
        q.s0 = []; let sm = 0;
        for (let j = 0; j < 12; j++) { const u = (Math.floor(j/2) + (j%2))/6, s = K[1] + (K[34] - K[1])*u - K[j*3 + 1]; q.s0.push(s); sm = Math.max(sm, s); }
        q.sm = Math.max(0.05, sm); q.L = q.c0 + 8*q.sm*q.sm/(3*Math.max(1, q.c0));
        X.wst.set(key(q), q);
      }
      q.ends[d0 < 1 ? 0 : 1] = r;
      // (the other end: whichever pole stands there)
      const o = d0 < 1 ? 11 : 0, ox = A[(i + o)*3], oz = A[(i + o)*3 + 2];
      if (!q.ends[d0 < 1 ? 1 : 0]) X.near(ox, oz, 1, (p) => { if (p.kind === 'pole' && Math.hypot(p.x - ox, p.z - oz) < 1) q.ends[d0 < 1 ? 1 : 0] = p; });
      out.push(q);
    }
  }
  r.wsp = out; r.wspN = X.lineGen;
  return out;
}
export function wake(q) { q.on = true; q.quiet = 0; }
export function forget(X, w) { for (const [k, q] of X.wst) if (q.w === w) X.wst.delete(k); }
// where an end is held now: the top of the pole as it leans, or wherever the top of it has got to as it falls
function endAt(X, q, e, out) {
  const K = q.keep, o = e ? 33 : 0, r = q.ends[e];
  out.set(K[o], K[o + 1], K[o + 2]);
  if (!r) return out;
  if (r.st === 2 && !r.topB) { out.set(r.x, 0.2, r.z); return out; }
  const a = r.tilt.length();
  if (a > 1e-5) { out.x -= r.x; out.y -= r.y; out.z -= r.z; out.applyAxisAngle(_a.set(r.tilt.z, 0, -r.tilt.x).normalize(), a); out.x += r.x; out.y += r.y; out.z += r.z; }
  if (r.st === 2) {
    // (where it was on the pole as it began to fall, and so where it is on it now)
    if (!q.loc) q.loc = [null, null];
    if (!q.loc[e]) q.loc[e] = out.clone().sub(r.topP).applyQuaternion(_q.copy(r.topQ).invert());
    const b = r.topB; return out.copy(q.loc[e]).applyQuaternion(b.q).add(b.p);
  }
  return out;
}
const _e0 = new THREE.Vector3(), _e1 = new THREE.Vector3(), _c = new THREE.Vector3(), _lat = new THREE.Vector3(), _ac = new THREE.Vector3();
// the wire as it hangs from where its ends are, its length kept: s, how far below the line between them it hangs mid-way
function shape(X, q) {
  endAt(X, q, 0, _e0); endAt(X, q, 1, _e1);
  _c.subVectors(_e1, _e0); const c = Math.max(0.1, _c.length()); _c.divideScalar(c);
  const s = c >= q.L ? 0.02 : Math.sqrt((q.L - c)*3*c/8);
  _lat.set(-_c.z, 0, _c.x); if (_lat.lengthSq() < 1e-6) _lat.set(1, 0, 0); _lat.normalize();
  const k = s/q.sm*(1 + q.d), ct = Math.cos(q.th), st = Math.sin(q.th), A = q.w.a.array, S = X.W.surf;
  for (let j = 0; j < 12; j++) {
    const u = (Math.floor(j/2) + (j%2))/6, g = q.s0[j]*k, o = (q.i + j)*3;
    let x = _e0.x + (_e1.x - _e0.x)*u + _lat.x*st*g, y = _e0.y + (_e1.y - _e0.y)*u - ct*g, z = _e0.z + (_e1.z - _e0.z)*u + _lat.z*st*g;
    const gy = (S ? S.height(x, z) : 0) + 0.18; if (y < gy) y = gy;      // (what reaches the road lies on it)
    A[o] = x; A[o + 1] = y; A[o + 2] = z;
  }
  return s;
}
function stepWires(X, dt) {
  if (!X.wst.size) return;
  const up = new Set();
  for (const q of X.wst.values()) {
    if (!q.on) continue;
    const s0 = shape(X, q), s = Math.max(0.12, s0), w = Math.sqrt(1.25*G0/s), wv = w*2.2;
    // how the ends moved: their pull across the line swings it, along it bounces it
    endAt(X, q, 0, _e0); endAt(X, q, 1, _e1); _c.subVectors(_e1, _e0).normalize(); _lat.set(-_c.z, 0, _c.x).normalize();
    let aLat = 0, aAl = 0, moving = false;
    for (let e = 0; e < 2; e++) {
      const p = e ? _e1 : _e0;
      if (!q.prev[e]) { q.prev[e] = p.clone(); continue; }
      _ac.subVectors(p, q.prev[e]).divideScalar(Math.max(1e-3, dt));
      const acc = _ac.clone().sub(q.vel[e]).divideScalar(Math.max(1e-3, dt)); q.vel[e].copy(_ac); q.prev[e].copy(p);
      if (_ac.lengthSq() > 1e-4) moving = true;
      aLat += acc.dot(_lat)*0.5; aAl += acc.dot(_c)*(e ? -0.5 : 0.5);
    }
    // (a pendulum hung from a moving point: what its point does, it feels the other way)
    const L = s/1.25, n = Math.max(1, Math.ceil(dt*wv/0.4)), h = dt/n;
    aLat = Math.max(-60, Math.min(60, aLat)); aAl = Math.max(-60, Math.min(60, aAl));
    for (let k = 0; k < n; k++) {
      // (a cable is heavy and stiff and the air's against it: it loses a good part of each swing, more the faster it's
      // going, and is hanging still again in three or four. It lost three parts in a hundred, and went on for most of a
      // minute; and a hard knock could send it right over the top, which no wire tied at both ends can do)
      q.thv += (-w*w*Math.sin(q.th) - 2*0.13*w*q.thv - 0.8*q.thv*Math.abs(q.thv) - aLat*Math.cos(q.th)/L)*h; q.th += q.thv*h;
      if (q.th > 1.15) { q.th = 1.15; if (q.thv > 0) q.thv *= -0.2; } else if (q.th < -1.15) { q.th = -1.15; if (q.thv < 0) q.thv *= -0.2; }
      q.dv += (-wv*wv*q.d - 2*0.22*wv*q.dv + aAl/Math.max(0.3, s)*0.5)*h; q.d = Math.max(-0.6, Math.min(1.5, q.d + q.dv*h));
    }
    up.add(q.w.a);
    if (!moving && Math.abs(q.th) < 2e-3 && Math.abs(q.thv) < 4e-3 && Math.abs(q.d) < 2e-3 && Math.abs(q.dv) < 5e-3) {
      if ((q.quiet += dt) > 0.4) { q.th = q.thv = q.d = q.dv = 0; shape(X, q); q.on = false; }
    } else q.quiet = 0;
  }
  for (const a of up) a.needsUpdate = true;
}
// a street's wires come in again: those of any pole that's leaning or down hang as it's left them
export function rehang(X, w) {
  let any = false;
  for (const r of X.down) if (r.kind === 'pole' && r.st > 0) { r.wsp = null; for (const q of spansOf(X, r)) if (q.w === w) { shape(X, q); any = true; } }
  if (any) w.a.needsUpdate = true;
}
// put back as it was strung
export function unhang(X, r) {
  for (const q of r.wsp || []) {
    const o = q.ends[0] === r ? q.ends[1] : q.ends[0];
    q.w.a.array.set(q.keep, q.i*3); q.w.a.needsUpdate = true;
    q.th = q.thv = q.d = q.dv = 0; q.loc = null; q.prev = [null, null];
    if (o && o.st > 0) { shape(X, q); } else X.wst.delete(key(q));
  }
  r.wsp = null;
}
