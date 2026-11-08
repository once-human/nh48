// A car comes apart where it's hit, part by part. A hard knock on a front door springs its lock: the door hangs on its
// hinge and swings with what the car does (open as it brakes or turns away, shut as it pulls away or into the wind,
// banging on its stop), and a harder one tears it off. A hit on the nose pops the bonnet's catch: it sits ajar and
// rattles over bumps, and at speed the wind gets under it and throws it up against the glass; hit hard enough it
// comes away. Whatever comes off is a thing of its own on the road: it tumbles, scrapes, tips over onto its flattest
// side and lies there (no bouncing). The panels are the car's own, cut out along its shut lines (beta/vehicles/cardoor.js).
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { Pilot } from '@orig/game/pilot.js';
import { hang } from './cardoor.js';
import { doorOf, baseOf, carSpec } from './models.js';

const NO = /^(auto|bus|tempo|truck|tractor|cycle)/;
const can = (v) => v && v.spec && !v.spec.two && v.bodyMesh && v.tilt && !NO.test(baseOf(v.type || 'auto'));
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _w = new THREE.Vector3(), _d = new THREE.Vector3();
const live = new Set(), loose = [];

// ---- the bonnet: the skin over the engine, facing up, ahead of the glass (no new vertices: its own triangles)
function hoodOf(v) {
  const S = carSpec(v.type), hl = S.L/2, xf0 = hl - S.hood, B = v.bodyMesh, g = B.geometry, I = g.index && g.index.array, P = g.attributes.position.array, N = g.attributes.normal && g.attributes.normal.array;
  if (!I || !N || !(S.hood > 0.3)) return null;
  const rest = [], hood = [];
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const x = (P[a*3] + P[b*3] + P[c*3])/3, y = (P[a*3 + 1] + P[b*3 + 1] + P[c*3 + 1])/3, z = (P[a*3 + 2] + P[b*3 + 2] + P[c*3 + 2])/3, ny = (N[a*3 + 1] + N[b*3 + 1] + N[c*3 + 1])/3;
    (x > xf0 + 0.02 && x < hl - 0.06 && y > S.beltY - 0.2 && ny > 0.45 && Math.abs(z) < S.W/2 - 0.06 ? hood : rest).push(a, b, c);
  }
  if (hood.length < 30) return null;
  const mk = (idx) => { const n = new THREE.BufferGeometry(); for (const k of Object.keys(g.attributes)) n.setAttribute(k, g.attributes[k]); n.setIndex(idx); n.boundingSphere = g.boundingSphere || (g.computeBoundingSphere(), g.boundingSphere); return n; };
  return { rest: mk(rest), hood: mk(hood), hinge: xf0 + 0.02, y: S.beltY };
}
function popHood(v) {
  const Pt = v._parts || (v._parts = {}); if (Pt.hood) return Pt.hood;
  try { v.own && v.own(); } catch (e) { /* as it is */ }
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
  R.sprung = true; R.held = true; R.ang = 0.12; R.vel = 1.5;
  const i = P.doors.indexOf(R); if (i >= 0) P.doors.splice(i, 1);                  // (it's ours, not the hand's)
  if (v._dg) v._dg.view = v.bodyMesh.geometry;
  (v._sprung || (v._sprung = {}))[s] = true;
  live.add(v);
  return (Pt[key] = { R, ok: true });
}

// ---- off it: a rigid thing on the road
function tearOff(v, mesh, kick) {
  mesh.updateWorldMatrix(true, false);
  const geo = mesh.geometry.clone(); geo.computeBoundingBox();
  const bb = geo.boundingBox, c = bb.getCenter(new THREE.Vector3()), half = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const im = new THREE.InstancedMesh(geo, mesh.material, 1);
  im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceColor ? mesh.instanceColor.array.subarray(0, 3) : [0.6, 0.6, 0.6]), 3);
  im.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z)); im.castShadow = im.receiveShadow = true; im.frustumCulled = false;
  mesh.matrixWorld.decompose(_v, _q, _s);
  const pos = c.clone().applyMatrix4(mesh.matrixWorld);
  im.position.copy(pos); im.quaternion.copy(_q);
  const G = window.__nhAskG; (G && G.scene || v.tilt.parent).add(im);
  mesh.parent && mesh.parent.remove(mesh);
  const hx = Math.cos(v.th), hz = Math.sin(v.th), sp = v.v || 0;
  loose.push({ m: im, half, v: new THREE.Vector3(hx*sp*0.85 + kick.x, 1.2 + Math.abs(kick.y), hz*sp*0.85 + kick.z), w: new THREE.Vector3((Math.random() - 0.5)*5, (Math.random() - 0.5)*4, (Math.random() - 0.5)*5), t: 0, still: 0 });
  window.__nhAskG?.audio?.thud?.(0.45);
}
const CORN = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
function tickLoose(dt, W, cam) {
  for (let i = loose.length - 1; i >= 0; i--) {
    const L = loose[i], m = L.m; L.t += dt;
    if (L.still > 1.5) {
      // lying still: gone once it's far behind and a few minutes old
      if (L.t > 180 && cam && m.position.distanceTo(cam.position) > 160) { m.parent && m.parent.remove(m); m.geometry.dispose(); loose.splice(i, 1); }
      continue;
    }
    L.v.y -= 9.81*dt; m.position.addScaledVector(L.v, dt);
    const wl = L.w.length(); if (wl > 1e-4) { _q.setFromAxisAngle(_w.copy(L.w).divideScalar(wl), wl*dt); m.quaternion.premultiply(_q); }
    // the road under its corners: nothing goes into it, and what touches it scrapes and stops turning
    const g = W && W.surf ? W.surf.height(m.position.x, m.position.z) : 0;
    let low = 0, touching = 0;
    for (const c of CORN) { _d.set(c[0]*L.half.x, c[1]*L.half.y, c[2]*L.half.z).applyQuaternion(m.quaternion); const pen = g - (m.position.y + _d.y); if (pen > 0) { touching++; low = Math.max(low, pen); } }
    if (touching) {
      m.position.y += low; if (L.v.y < 0) L.v.y = 0;
      const k = Math.max(0, 1 - 6*dt); L.v.x *= k; L.v.z *= k; L.w.multiplyScalar(Math.max(0, 1 - 5*dt));
      // its weight tips it onto its flattest side: the axis nearest straight down goes to straight down
      let best = null, bd = -2; for (const a of AX) for (const sg of [1, -1]) { _d.copy(a).multiplyScalar(sg).applyQuaternion(m.quaternion); if (-_d.y > bd) { bd = -_d.y; best = _d.clone(); } }
      if (best) { const ax = _w.crossVectors(best, new THREE.Vector3(0, -1, 0)); const ang = Math.asin(Math.min(1, ax.length())); if (ang > 0.01) L.w.addScaledVector(ax.normalize(), ang*25*dt); }
    }
    if (W && W.collision) { const r = W.collision.resolve(m.position.x, m.position.z, Math.max(L.half.x, L.half.z)*0.6); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { m.position.x += r.nx*r.depth; m.position.z += r.nz*r.depth; const vn = L.v.x*r.nx + L.v.z*r.nz; if (vn < 0) { L.v.x -= vn*r.nx*1.2; L.v.z -= vn*r.nz*1.2; } } }
    L.still = touching && L.v.length() < 0.15 && L.w.length() < 0.2 ? L.still + dt : 0;
  }
}

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
    const H = Pt.hood;
    if (H && H.ok && !H.gone) {
      // the wind under it (more the more it's open, and the faster), its weight, the car's bumps, its stop at the glass
      const wind = sp > 0 ? sp*sp*0.006*(H.ang + 0.08) : 0, bump = (v.vy || 0)*0.8;
      H.w += (wind - 9.8*Math.cos(H.ang)*0.9 + acc*-0.25 + bump*6 - H.w*1.5)*dt; H.ang += H.w*dt;
      if (H.ang < 0.03) { H.ang = 0.03; H.w = Math.abs(H.w) > 1 ? -H.w*0.2 : 0; }
      if (H.ang > 1.3) { H.ang = 1.3; H.w = -Math.abs(H.w)*0.15; if (Math.abs(H.w) > 0.3) window.__nhAskG?.audio?.thud?.(0.25); }
      H.pivot.rotation.z = H.ang;
    }
    for (const s of [1, -1]) {
      const d = Pt['door' + s]; if (!d || !d.ok || d.gone) continue;
      const R = d.R;
      // braking swings it open, pulling away shuts it, the wind shuts it, turning away from it throws it open
      const f = -acc*0.6 - sp*Math.abs(sp)*0.012*(R.ang + 0.1) + lat*s*0.35;
      R.vel += (f - R.vel*1.2)*dt; R.ang += R.vel*dt;
      if (R.ang > LIMIT) { R.ang = LIMIT; R.vel = -Math.abs(R.vel)*0.2; }
      if (R.ang < 0.02) { R.ang = 0.02; if (R.vel < -0.8) window.__nhAskG?.audio?.thud?.(0.2); R.vel = Math.abs(R.vel)*0.15; }
      R.pivot.rotation.y = R.s*R.ang;
    }
  }
}
const td = Pilot.prototype.tickDoors;
Pilot.prototype.tickDoors = function (dt) {
  const r = td.call(this, dt);
  if (dt > 0) { tickParts(dt); const G = window.__nhAskG; if (loose.length) tickLoose(dt, this.W || (G && G.W), G && G.camera); }
  return r;
};
