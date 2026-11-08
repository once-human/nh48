// A car comes apart where it's hit, part by part. A hard knock on a front door springs its lock: the door hangs on its
// hinge and swings with what the car does (open as it brakes or turns away, shut as it pulls away or into the wind,
// banging on its stop), and a harder one tears it off. A hit on the nose pops the bonnet's catch: it sits ajar and
// rattles over bumps, and at speed the wind gets under it and throws it up against the glass; hit hard enough it
// comes away. A mirror snaps off at a knock on it; a bumper hit hard comes away whole. Whatever comes off is a thing
// of its own on the road, a solid body (beta/vehicles/bikebody.js) by its corners: it tumbles, scrapes, tips over onto
// its flattest side and lies there where it landed (no bouncing). The panels are the car's own, cut out along its shut
// lines (beta/vehicles/cardoor.js); the mirrors and bumpers out of the body where they're drawn. A car going over
// (beta/vehicles/rollover.js) loses them where it comes down on them, and what's still hanging off it (an open door,
// a sprung bonnet) swings by which way is down for the car as it lies, not as if it were still on its wheels.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { Pilot } from '@orig/game/pilot.js';
import { hang } from './cardoor.js';
import { doorOf, baseOf, carSpec, buildUnder } from './models.js';
import { makePts, stepBody, bodyVel } from './bikebody.js';

const NO = /^(auto|bus|tempo|truck|tractor|cycle)/;
const can = (v) => v && v.spec && !v.spec.two && v.bodyMesh && v.tilt && !NO.test(baseOf(v.type || 'auto'));
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _w = new THREE.Vector3(), _d = new THREE.Vector3();
const live = new Set(), loose = [];
const CORN = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];

// ---- the bonnet: the skin over the engine, facing up, ahead of the glass (no new vertices: its own triangles)
function hoodOf(v) {
  const S = carSpec(v.type), hl = S.L/2, xf0 = hl - S.hood, B = v.bodyMesh, g = B.geometry, I = g.index && g.index.array, P = g.attributes.position.array, N = g.attributes.normal && g.attributes.normal.array;
  if (!I || !N || !(S.hood > 0.3)) return null;
  const rest = [], hood = [];
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const x = (P[a*3] + P[b*3] + P[c*3])/3, y = (P[a*3 + 1] + P[b*3 + 1] + P[c*3 + 1])/3, z = (P[a*3 + 2] + P[b*3 + 2] + P[c*3 + 2])/3, ny = (N[a*3 + 1] + N[b*3 + 1] + N[c*3 + 1])/3;
    // (the skin, and its inside under it: lift it and there's the underside of a bonnet, not a hole)
    (x > xf0 + 0.02 && x < hl - 0.06 && Math.abs(z) < S.W/2 - 0.06 && (y > S.beltY - 0.2 && ny > 0.45 || y > S.beltY - 0.26 && ny < -0.45) ? hood : rest).push(a, b, c);
  }
  if (hood.length < 30) return null;
  const mk = (idx) => { const n = new THREE.BufferGeometry(); for (const k of Object.keys(g.attributes)) n.setAttribute(k, g.attributes[k]); n.setIndex(idx); n.boundingSphere = g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere); return n; };
  return { rest: mk(rest), hood: mk(hood), hinge: xf0 + 0.02, y: S.beltY };
}
// what's under a panel (beta/vehicles/models.js buildUnder): put in the moment the panel first moves, while it still
// covers it, so it's there when the panel's gone and was never seen arriving
const UNDER = new Map();
function under(v, which) {
  const Pt = v._parts || (v._parts = {}), key = 'u:' + which; if (Pt[key]) return;
  Pt[key] = true;
  const B = v.bodyMesh; if (!B || !B.parent) return;
  const k = v.type + '|' + which; let g0 = UNDER.get(k);
  if (!g0) { try { g0 = buildUnder(v.type, which); } catch (e) { g0 = null; } UNDER.set(k, g0); }
  if (!g0 || !g0.attributes.position.count) return;
  const g = new THREE.BufferGeometry(), A = B.geometry.attributes;
  for (const n of Object.keys(g0.attributes)) g.setAttribute(n, g0.attributes[n]);
  for (const n in A) if (A[n].isInstancedBufferAttribute && !g.attributes[n]) g.setAttribute(n, A[n]);
  g.setIndex(g0.index); g.boundingSphere = g0.boundingSphere || (g0.computeBoundingSphere(), g0.boundingSphere);
  const m = new THREE.InstancedMesh(g, B.material, 1);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3); if (B.instanceColor) m.instanceColor.array.set(B.instanceColor.array.subarray(0, 3));
  m.setMatrixAt(0, _m.identity()); m.position.copy(B.position); m.quaternion.copy(B.quaternion); m.scale.copy(B.scale);
  m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false;
  B.parent.add(m);
}
function popHood(v) {
  const Pt = v._parts || (v._parts = {}); if (Pt.hood) return Pt.hood;
  try { v.own && v.own(); } catch (e) { /* as it is */ }
  under(v, 'front');
  const H = hoodOf(v); if (!H) return (Pt.hood = { none: true });
  const B = v.bodyMesh, pivot = new THREE.Group(); pivot.position.set(H.hinge, H.y, 0);
  const m = new THREE.InstancedMesh(H.hood, B.material, 1);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3); m.instanceColor.array.set(B.instanceColor.array.subarray(0, 3));
  m.setMatrixAt(0, new THREE.Matrix4()); m.position.set(-H.hinge, -H.y, 0); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
  pivot.add(m); v.tilt.add(pivot); B.geometry = H.rest; if (v._dg) v._dg.view = B.geometry;
  live.add(v);
  return (Pt.hood = { pivot, m, ang: 0.05, w: 0.6, ok: true });
}
function springDoor(v, s) {
  const Pt = v._parts || (v._parts = {}), key = 'door' + s; if (Pt[key]) return Pt[key];
  const G = window.__nhAskG, P = G && G.player; if (!P || (P.doors && P.doors.some(R => R.veh === v))) return null;     // (not while someone's at a door)
  try { v.own && v.own(); } catch (e) { /* as it is */ }
  let R = null; try { R = hang(P, v, s); } catch (e) { return null; }
  // the opening it leaves, and the cabin inside it (seats, dash, wheel: the same one you sit in, shown as a door does)
  under(v, 'door' + s);
  if (v.cockpit) v.cockpit.group.visible = true;
  R.sprung = true; R.held = true; R.ang = 0.12; R.vel = 1.5;
  const i = P.doors.indexOf(R); if (i >= 0) P.doors.splice(i, 1);                  // (it's ours, not the hand's)
  if (v._dg) v._dg.view = v.bodyMesh.geometry;
  (v._sprung || (v._sprung = {}))[s] = true;
  live.add(v);
  return (Pt[key] = { R, ok: true });
}

// a part's own triangles, with only the corners they use (a part shares the whole body's vertices: its size was the car's)
function compact(g) {
  const I = g.index && g.index.array; if (!I) return g.clone();
  const map = new Map(), idx = new Uint32Array(I.length);
  for (let t = 0; t < I.length; t++) { let k = map.get(I[t]); if (k === undefined) { k = map.size; map.set(I[t], k); } idx[t] = k; }
  const n = new THREE.BufferGeometry();
  for (const key of Object.keys(g.attributes)) {
    const A = g.attributes[key], sz = A.itemSize, src = A.array, out = new src.constructor(map.size*sz);
    for (const [o, k] of map) for (let c = 0; c < sz; c++) out[k*sz + c] = src[o*sz + c];
    n.setAttribute(key, new THREE.BufferAttribute(out, sz, A.normalized));
  }
  n.setIndex(new THREE.BufferAttribute(idx, 1));
  return n;
}
// cut out of the body where it's drawn: the triangles whose middles pass test(x, y, z), as a mesh of their own in the
// same place on the car (null when there's nothing there, or it's gone already)
function cutOut(v, test) {
  try { v.own && v.own(); } catch (e) { /* as it is */ }
  const B = v.bodyMesh, g = B.geometry, I = g.index && g.index.array, P = g.attributes.position.array;
  if (!I) return null;
  const rest = [], part = [];
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    (test((P[a*3] + P[b*3] + P[c*3])/3, (P[a*3 + 1] + P[b*3 + 1] + P[c*3 + 1])/3, (P[a*3 + 2] + P[b*3 + 2] + P[c*3 + 2])/3) ? part : rest).push(a, b, c);
  }
  if (part.length < 18) return null;
  const mk = (idx) => { const n = new THREE.BufferGeometry(); for (const k of Object.keys(g.attributes)) n.setAttribute(k, g.attributes[k]); n.setIndex(idx); n.boundingSphere = g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere); return n; };
  const pg = mk(part), m = new THREE.InstancedMesh(pg, B.material, 1);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3); if (B.instanceColor) m.instanceColor.array.set(B.instanceColor.array.subarray(0, 3));
  B.getMatrixAt && B.instanceMatrix ? B.getMatrixAt(0, _m) : _m.identity(); m.setMatrixAt(0, _m);
  m.position.copy(B.position); m.quaternion.copy(B.quaternion); m.scale.copy(B.scale); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
  B.parent.add(m);
  B.geometry = mk(rest); if (v._dg) v._dg.view = B.geometry;
  return m;
}
// a mirror (s: the side), or a bumper (e: 1 the front, -1 the back), off
function snapMirror(v, s) {
  const Pt = v._parts || (v._parts = {}), key = 'mirror' + s; if (Pt[key]) return;
  const S = carSpec(v.type), hw = S.W/2, xf0 = S.L/2 - S.hood, y0 = S.beltY - 0.04;
  Pt[key] = true;
  const m = cutOut(v, (x, y, z) => z*s > hw + 0.005 && y > y0 && y < S.beltY + 0.3 && x > xf0 - 0.55 && x < xf0 + 0.2);
  if (m) tearOff(v, m, { x: -Math.sin(v.th)*s*2.5, y: 1, z: Math.cos(v.th)*s*2.5 });
}
function dropBumper(v, e) {
  const Pt = v._parts || (v._parts = {}), key = 'bumper' + e; if (Pt[key]) return;
  const S = carSpec(v.type), hl = S.L/2, top = S.sill + (S.beltY - S.sill)*0.48;
  Pt[key] = true;
  under(v, e > 0 ? 'front' : 'rear');
  const m = cutOut(v, (x, y) => x*e > hl - 0.24 && y < top && y > 0.04);
  if (m) tearOff(v, m, { x: Math.cos(v.th)*e*1.5, y: 0.5, z: Math.sin(v.th)*e*1.5 });
}

// ---- off it: a rigid thing on the road
function tearOff(v, mesh, kick) {
  mesh.updateWorldMatrix(true, false);
  const geo = compact(mesh.geometry); geo.computeBoundingBox();
  const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), half = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const im = new THREE.InstancedMesh(geo, mesh.material, 1);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceColor ? mesh.instanceColor.array.subarray(0, 3) : [0.6, 0.6, 0.6]), 3);
  im.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z)); im.castShadow = im.receiveShadow = true; im.frustumCulled = false;
  mesh.matrixWorld.decompose(_v, _q, _s);
  const pos = c.clone().applyMatrix4(mesh.matrixWorld);
  im.position.copy(pos); im.quaternion.copy(_q);
  const G = window.__nhAskG; (G && G.scene || v.tilt.parent).add(im);
  mesh.parent && mesh.parent.remove(mesh);
  // going as the car was where it came off (rolling over, that's the body's own speed), and thrown off it by the blow
  const hx = Math.cos(v.th), hz = Math.sin(v.th), sp = v.v || 0, cv = v._rb ? bodyVel(v._rb) : [hx*sp*0.85, 0, hz*sp*0.85];
  const pts = []; for (const c of CORN) pts.push([c[0]*half.x, c[1]*half.y, c[2]*half.z, 1, 0]);
  const B = makePts(pts, im.quaternion, im.position.x, im.position.y, im.position.z, [cv[0] + kick.x, Math.max(0, cv[1]) + 1.2 + Math.abs(kick.y), cv[2] + kick.z],
    [(Math.random() - 0.5)*5, (Math.random() - 0.5)*4, (Math.random() - 0.5)*5]);
  loose.push({ m: im, B, r: Math.max(0.08, Math.min(half.x, half.z)*0.8), t: 0 });
  window.__nhAskG?.audio?.thud?.(0.45);
}
function tickLoose(dt, W, G) {
  for (let i = loose.length - 1; i >= 0; i--) {
    const L = loose[i], m = L.m, B = L.B; L.t += dt;
    if (B.rest) {
      // lying where it landed: gone only once it's a few minutes old and well out of sight
      if (L.t > 180 && G && G.camera && m.position.distanceTo(G.camera.position) > 160 && !(G.inView && G.inView(m.position.x, m.position.z))) { m.parent && m.parent.remove(m); m.geometry.dispose(); loose.splice(i, 1); }
      continue;
    }
    stepBody(B, dt, W && W.surf ? (x, z) => W.surf.height(x, z) : 0, W && W.collision ? (x, z) => W.collision.resolve(x, z, L.r) : null);
    m.position.set(B.ox, B.oy, B.oz); m.quaternion.copy(B.Q);
  }
}
// which way is up for the car, in its own terms (on its wheels straight up; on its side or its roof, not)
const _up = new THREE.Vector3(), _iq = new THREE.Quaternion();
function upOf(v) { return v._rb ? _up.set(0, 1, 0).applyQuaternion(_iq.copy(v._rb.Q).invert()) : _up.set(0, 1, 0); }

// ---- what a hit does to them: where on the car, how deep the dent
let busy = false;
const dent = Vehicle.prototype.dent;
if (dent) Vehicle.prototype.dent = function (lx, ly, lz, nx, ny, nz, r, depth) {
  const out = dent.apply(this, arguments);
  if (busy || !can(this) || !(depth > 0.04)) return out;
  busy = true;
  try {
    const S = carSpec(this.type), hl = S.L/2, hw = S.W/2;
    // the nose: the catch goes, or it all comes away
    if (lx > hl - S.hood*0.6 && ly < S.beltY + 0.1) {
      const h = popHood(this);
      if (h && h.ok && !h.gone) { h.w += depth*20; if (depth > 0.15) { h.gone = true; tearOff(this, h.m, { x: Math.cos(this.th)*-2, y: 3, z: Math.sin(this.th)*-2 }); } }
    }
    // come down on the bonnet (going over): its catch goes, and it's torn off if it was hard
    else if (lx > hl - S.hood && ly > S.beltY - 0.15 && depth > 0.06) {
      const h = popHood(this);
      if (h && h.ok && !h.gone) { h.w += depth*12; if (depth > 0.16) { h.gone = true; tearOff(this, h.m, { x: 0, y: 1.5, z: 0 }); } }
    }
    // a mirror: a knock anywhere near it and it's off
    if (Math.abs(lz) > hw - 0.3 && lx > hl - S.hood - 0.9 && lx < hl - S.hood + 0.5 && ly > S.beltY - 0.35 && depth > 0.04) snapMirror(this, lz > 0 ? 1 : -1);
    // a bumper: hit hard at that end, low, it comes away
    if (Math.abs(lx) > hl - 0.5 && ly < S.beltY && depth > 0.12) dropBumper(this, lx > 0 ? 1 : -1);
    // a front door: its lock goes, or it's torn away
    const D = doorOf(this.type);
    if (D && Math.abs(lz) > hw - 0.25 && lx > D.x0 - 0.1 && lx < D.x1 + 0.1) {
      const s = lz > 0 ? 1 : -1, d = springDoor(this, s);
      if (d && d.ok && !d.gone) {
        d.R.vel += depth*30;
        if (depth > 0.13) { d.gone = true; tearOff(this, d.R.dm, { x: -Math.sin(this.th)*s*3, y: 1.5, z: Math.cos(this.th)*s*3 }); if (d.R.gm) d.R.gm.parent && d.R.gm.parent.remove(d.R.gm); }
      }
    }
  } catch (e) { /* drawn as it was */ }
  busy = false;
  return out;
};

// ---- every frame: the hanging parts swing with the car, the loose ones tumble
const LIMIT = 1.18;
function tickParts(dt) {
  for (const v of live) {
    const Pt = v._parts; if (!Pt || !v.root || !v.root.parent) { live.delete(v); continue; }
    const sp = v.v || 0, k0 = v._pvel ?? sp, acc = dt > 0 ? (sp - k0)/dt : 0; v._pvel = sp;
    const yawR = dt > 0 && v._pth !== undefined ? Math.atan2(Math.sin(v.th - v._pth), Math.cos(v.th - v._pth))/dt : 0; v._pth = v.th;
    const lat = yawR*sp;                                                  // (the car turning: what's loose swings out)
    const H = Pt.hood, U = upOf(v);
    if (H && H.ok && !H.gone) {
      // the wind under it (more the more it's open, and the faster), its weight, the car's bumps, its stop at the glass
      const wind = sp > 0 && !v._rb ? sp*sp*0.006*(H.ang + 0.08) : 0, bump = (v.vy || 0)*0.8;
      H.w += (wind - 9.8*0.9*(Math.cos(H.ang)*U.y - Math.sin(H.ang)*U.x) + acc*-0.25 + bump*6 - H.w*1.5)*dt; H.ang += H.w*dt;
      if (H.ang < 0.03) { H.ang = 0.03; H.w = Math.abs(H.w) > 1 ? -H.w*0.2 : 0; }
      if (H.ang > 1.3) { H.ang = 1.3; H.w = -Math.abs(H.w)*0.15; if (Math.abs(H.w) > 0.3) window.__nhAskG?.audio?.thud?.(0.25); }
      H.pivot.rotation.z = H.ang;
    }
    for (const s of [1, -1]) {
      const d = Pt['door' + s]; if (!d || !d.ok || d.gone) continue;
      const R = d.R;
      // braking swings it open, pulling away shuts it, the wind shuts it, turning away from it throws it open
      // (and its weight: on its side, the door on top falls open; the one underneath is held shut by the road)
      const f = -acc*0.6 - (v._rb ? 0 : sp*Math.abs(sp)*0.012*(R.ang + 0.1)) + lat*s*0.35 - s*U.z*5;
      R.vel += (f - R.vel*1.2)*dt; R.ang += R.vel*dt;
      if (s*U.z < -0.4 && R.ang > 0.05) { R.ang = 0.05; R.vel = 0; }
      if (R.ang > LIMIT) { R.ang = LIMIT; R.vel = -Math.abs(R.vel)*0.2; }
      if (R.ang < 0.02) { R.ang = 0.02; if (R.vel < -0.8) window.__nhAskG?.audio?.thud?.(0.2); R.vel = Math.abs(R.vel)*0.15; }
      R.pivot.rotation.y = R.s*R.ang;
    }
  }
}
const td = Pilot.prototype.tickDoors;
Pilot.prototype.tickDoors = function (dt) {
  const r = td.call(this, dt);
  if (dt > 0) { tickParts(dt); const G = window.__nhAskG; if (loose.length) tickLoose(dt, this.W || (G && G.W), G); }
  return r;
};
