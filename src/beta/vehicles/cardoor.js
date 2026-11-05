// Getting into a car like you'd have to, and out of it. The door is the car's own: the panel and its window are cut
// out of the body along the shut lines that body draws (models.js doorOf), so when it swings out on its front hinge
// there's an opening behind it with the cabin in it, never a second door. You walk the whole way to it, take the
// handle and pull it open, step back as it comes, step into the gap, sit down onto the seat with your back to it,
// swing your legs in, reach out and pull the door shut. Out: the door pushed open, legs out over the sill, up off the
// seat, a step away, and it's shut behind you. The driver's door up against a wall or another car: you go round to
// the other one and climb across. Locked (about half the parked cars, and some drivers who see you coming): an elbow
// through the window first, glass on the road. A locked parked car has no key in it either: you lean in under the
// steering and wire it, a few sparks, then it catches. A car with someone at the wheel: you haul them out first.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { bendBone, ikArm } from '@orig/people/humans.js';
import { ikLeg } from '../game/fists.js';
import { free } from './mount.js';
import { grip } from './fit.js';
import { carSpec, doorOf, baseOf } from './models.js';

const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const hash = (x, z) => { const s = Math.sin(x*12.9898 + z*78.233)*43758.5453; return s - Math.floor(s); };
const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a)/(b - a)));
const bell = (k) => Math.sin(Math.PI*Math.max(0, Math.min(1, k)));
const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a))*k;

// ---------------------------------------------------------------- the cut
// Every triangle of the model on that side is clipped against the door's edges (its back and front edges, the sill
// line), and each piece goes to the door or stays on the body by where it lies: inside the edges, under the window's
// top edge, clear of the wheel arch. Both halves share one new set of vertices. Cut once per model and side.
const CUTS = new WeakMap();
function cutGeo(geo, D, s) {
  let per = CUTS.get(geo); if (!per) CUTS.set(geo, per = {});
  if (per[s]) return per[s];
  const A = geo.attributes, names = Object.keys(A).filter(n => !A[n].isInstancedBufferAttribute);
  const data = names.map(n => Array.from(A[n].array)), size = names.map(n => A[n].itemSize);
  const P = data[names.indexOf('position')], ni = names.indexOf('normal');
  let n = A.position.count;
  const ix = geo.index ? geo.index.array : null, nt = (ix ? ix.length : n)/3;
  const rest = [], door = [], memo = new Map();
  const at = (i, ax) => P[i*3 + ax];
  const cutAt = (a, b, ax, v) => {
    const key = (a < b ? a + ',' + b : b + ',' + a) + ',' + ax + ',' + v;
    const m = memo.get(key); if (m !== undefined) return m;
    const t = (v - at(a, ax))/(at(b, ax) - at(a, ax));
    for (let k = 0; k < data.length; k++) { const d = data[k], z = size[k]; for (let c = 0; c < z; c++) d.push(d[a*z + c] + (d[b*z + c] - d[a*z + c])*t); }
    if (ni >= 0) { const N = data[ni], o = n*3, l = Math.hypot(N[o], N[o + 1], N[o + 2]) || 1; N[o] /= l; N[o + 1] /= l; N[o + 2] /= l; }
    memo.set(key, n); return n++;
  };
  const xs = [D.x0, D.x0g, D.x1].filter((v, i, a) => a.indexOf(v) === i), planes = [...xs.map(v => [0, v]), [1, D.y0]];
  const [wx, wy, wr] = D.wheel;
  const inDoor = (x, y, z) => {
    z *= s;
    if (y < D.y0 || x > D.x1 || x < (y < D.belt + .012 ? D.x0 : D.x0g)) return false;
    if (z < D.zIn(x, y) || y > D.top(x)) return false;
    if (x > D.hood && y > D.belt - .012) return false;
    return Math.hypot(x - wx, y - wy) > wr;
  };
  const emit = (q) => {
    for (let k = 1; k < q.length - 1; k++) {
      const a = q[0], b = q[k], c = q[k + 1];
      (inDoor((at(a, 0) + at(b, 0) + at(c, 0))/3, (at(a, 1) + at(b, 1) + at(c, 1))/3, (at(a, 2) + at(b, 2) + at(c, 2))/3) ? door : rest).push(a, b, c);
    }
  };
  const clip = (q, p) => {
    if (p === planes.length) return emit(q);
    const [ax, v] = planes[p];
    let lo = false, hi = false;
    for (const i of q) { const c = at(i, ax) - v; if (c < -1e-6) lo = true; else if (c > 1e-6) hi = true; }
    if (!(lo && hi)) return clip(q, p + 1);
    const L = [], H = [];
    for (let k = 0; k < q.length; k++) {
      const i = q[k], j = q[(k + 1)%q.length], ci = at(i, ax) - v, cj = at(j, ax) - v;
      if (ci <= 1e-6) L.push(i); if (ci >= -1e-6) H.push(i);
      if ((ci < -1e-6 && cj > 1e-6) || (ci > 1e-6 && cj < -1e-6)) { const m = cutAt(i, j, ax, v); L.push(m); H.push(m); }
    }
    if (L.length > 2) clip(L, p + 1);
    if (H.length > 2) clip(H, p + 1);
  };
  const zq = D.hw(D.x0)*0.3;
  for (let t = 0; t < nt; t++) {
    const a = ix ? ix[t*3] : t*3, b = ix ? ix[t*3 + 1] : t*3 + 1, c = ix ? ix[t*3 + 2] : t*3 + 2;
    // nowhere near the door: as it was
    if (Math.max(at(a, 2)*s, at(b, 2)*s, at(c, 2)*s) < zq || Math.max(at(a, 0), at(b, 0), at(c, 0)) < D.x0 - .01 || Math.min(at(a, 0), at(b, 0), at(c, 0)) > D.x1 + .01
      || Math.max(at(a, 1), at(b, 1), at(c, 1)) < D.y0) { rest.push(a, b, c); continue; }
    clip([a, b, c], 0);
  }
  const attrs = names.map((nm, k) => new THREE.BufferAttribute(new Float32Array(data[k]), size[k], A[nm].normalized));
  const make = (I) => {
    const g = new THREE.BufferGeometry();
    names.forEach((nm, k) => g.setAttribute(nm, attrs[k]));
    for (const nm in A) if (A[nm].isInstancedBufferAttribute) g.setAttribute(nm, A[nm]);
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(I) : new Uint16Array(I), 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  };
  return (per[s] = { rest: make(rest), door: make(door) });
}

// ---------------------------------------------------------------- the door on its hinge
// The body shows the opening, the panel hangs from a pivot at its front edge. Driven by the angle it's asked for
// (a hand on it), it follows a beat behind with some weight; let go to shut, it swings to and lands with a thud.
const IDENT = new THREE.Matrix4();
function hang(P, veh, s) {
  const D = doorOf(veh.type), B = veh.bodyMesh, Gm = veh.glassMesh;
  const body0 = B.geometry, glass0 = Gm ? Gm.geometry : null;
  const cb = cutGeo(body0, D, s), cg = glass0 && glass0.attributes.position.count ? cutGeo(glass0, D, s) : null;
  const pivot = new THREE.Group(); pivot.position.set(D.hinge[0], 0, s*D.hinge[1]);
  const dm = new THREE.InstancedMesh(cb.door, B.material, 1);
  dm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
  dm.instanceColor.array.set(B.instanceColor.array.subarray(0, 3));
  dm.setMatrixAt(0, IDENT); dm.position.set(-D.hinge[0], 0, -s*D.hinge[1]);
  dm.castShadow = true; dm.receiveShadow = true; dm.frustumCulled = false;
  pivot.add(dm);
  let gm = null;
  if (cg && cg.door.index.count) { gm = new THREE.Mesh(cg.door, Gm.material); gm.position.copy(dm.position); pivot.add(gm); }
  B.geometry = cb.rest; if (cg) Gm.geometry = cg.rest;
  veh.tilt.add(pivot);
  const R = { veh, s, D, pivot, dm, gm, body0, glass0, ang: 0, vel: 0, goal: 0, t: 0, auto: false, slam: false, closeAt: null, root: pivot };
  (P.doors || (P.doors = [])).push(R);
  return R;
}
function unhang(P, R) {
  const { veh } = R;
  if (veh.bodyMesh.geometry !== R.body0) veh.bodyMesh.geometry = R.body0;
  if (R.glass0 && veh.glassMesh) veh.glassMesh.geometry = R.glass0;
  R.pivot.parent && R.pivot.parent.remove(R.pivot);
  R.dm.dispose();
  const i = P.doors ? P.doors.indexOf(R) : -1; if (i >= 0) P.doors.splice(i, 1);
}
// a point on the door (in the body's own coordinates, closed), where it is now in the world
function onDoor(R, x, y, z, out) {
  R.dm.updateWorldMatrix(true, false);
  return out.set(x, y, R.s*z).applyMatrix4(R.dm.matrixWorld);
}
function shut(R) { if (!R.slam) { R.slam = true; R.vel = Math.min(R.vel, -1.6); } }
const MAX = 1.18;

// the car's frame: a point given along it, up, and out to its right (+) / left (-)
export function frameOf(src) {
  const hx = src.hx ?? Math.cos(src.th), hz = src.hz ?? Math.sin(src.th), y = src.y || 0;
  return { hx, hz, y, x: src.x, z: src.z, at: (a, u, r, o) => o.set(src.x + hx*a - hz*r, y + u, src.z + hz*a + hx*r) };
}
// where you sit to drive (as pilot.js has it)
function seatOf(type) {
  if (type === 'hatch') return [-0.2, 0.57, 0.36];
  if (type === 'suv') return [-0.3, 0.7, 0.38];
  const c = carSpec(type); return [c.L/2 - c.hood - 1.25, c.sill + 0.33, c.W*0.22];
}
// the seated clips carry the hips this far behind the body's origin, this high (measured off the rig)
const HIP_BACK = 0.33, HIP_UP = 0.58;

// ---------------------------------------------------------------- getting in
// the car you'll get into, built now (out of sight) so the door's ready when you reach it: the car on the road or in
// the row swaps for it as the door opens, and the same one is the one you drive away
function standIn(P, E) {
  const src = E.src;
  if (src.bodyMesh) return src;
  if (E.pre) return E.pre;
  const v = new Vehicle(P.W, P.scene, P.vmats, E.kind, src.col || src.paint || [0.6, 0.6, 0.6]);
  v.root.visible = false;
  E.pre = v; E.offer.pre = v;
  try { const s = E.s; cutGeo(v.bodyMesh.geometry, doorOf(E.kind), s); if (v.glassMesh) cutGeo(v.glassMesh.geometry, doorOf(E.kind), s); } catch (e) { /* drawn as it is */ }
  return v;
}
function showStandIn(P, E) {
  const v = E.pre; if (!v || v.root.visible) return;
  const src = E.src;
  v.reset(src.x, src.z, src.th ?? Math.atan2(src.hz, src.hx));
  v.y = E.offer.kind === 'parked' ? P.W.surf.height(src.x, src.z) : (src.y || 0);
  v.v = 0; v.sync(0); v.root.visible = true;
  // its cabin in from the start (seats, wheel, dash): the door opens on the inside of a car, not an empty shell
  if (v.cockpit) v.cockpit.group.visible = true;
  // (the parked rows only re-cull once the camera's moved 6 m: made to now, or the parked car stays drawn round this one)
  if (E.offer.kind === 'parked') { for (const it of src.items) it.off = true; P.W._propX = undefined; }
  else if (E.offer.kind === 'traffic') src.hideBody = true;
}
function dropStandIn(P, E) {
  const v = E.pre; if (!v || P.cur === v) return;
  if (P.doors) for (const R of P.doors.slice()) if (R.veh === v) unhang(P, R);
  v.root.parent && v.root.parent.remove(v.root);
  if (E.offer.kind === 'parked' && !E.src.taken) { for (const it of E.src.items) it.off = false; P.W._propX = undefined; }
  else if (E.offer.kind === 'traffic') E.src.hideBody = false;
  E.pre = null; E.offer.pre = null;
}

const enter = Pilot.prototype.enter;
Pilot.prototype.enter = function (offer, traffic) {
  const was = this.entering;
  const out = enter.call(this, offer, traffic);
  const E = this.entering;
  if (!E || E === was || E.cd) return out;
  E.cd = true;
  const src = E.src, Fr = frameOf(src), D = doorOf(E.kind);
  E.D = D; E.s = 1;
  // by the handle, a little behind it, an arm's length out
  const stand = (s) => Fr.at(D.handle[0] - 0.24, 0, s*(D.hw(D.handle[0]) + 0.42), new THREE.Vector3());
  let p = stand(1);
  // the driver's door blocked: the passenger door, and over to the driver's seat once in
  if (!free(this, traffic, p.x, p.z, src)) { const q = stand(-1); if (free(this, traffic, q.x, q.z, src)) { p = q; E.s = -1; E.pass = true; } }
  E.door = { x: p.x, z: p.z }; this.puppet = E.door;
  E.locked = offer.kind === 'parked' ? hash(src.x, src.z) < 0.55 : offer.kind === 'traffic' ? Math.random() < 0.3 : false;
  E.wire = E.locked && offer.kind === 'parked';
  const F = this.foot;
  E.max = Math.max(1.6, Math.hypot(E.door.x - F.x, E.door.z - F.z)/1.5 + 0.6);
  E.real = 0;
  try { standIn(this, E); } catch (e) { E.pre = null; }
  return out;
};

// glass on the road
const shards = [];
function smash(P, E) {
  const A = P.audio;
  if (A) {
    A.noiseBurst?.(0.16, 4800, 0.9, 0.7);
    for (let i = 0; i < 7; i++) A.tone?.('triangle', [2400 + Math.random()*2200], 0.05, 0.06, 0, 0.04 + i*0.035 + Math.random()*0.03);
  }
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xbfd6dc, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.8 });
  const geo = new THREE.BoxGeometry(0.035, 0.004, 0.025);
  const y = (E.src.y || 0) + 1.05, dx = E.door.x - E.src.x, dz = E.door.z - E.src.z, d = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < 28; i++) {
    const s = new THREE.Mesh(geo, m);
    s.position.set(E.door.x - dx/d*0.4, y, E.door.z - dz/d*0.4);
    s.userData.v = new THREE.Vector3(dx/d*(0.5 + Math.random()*1.5) + (Math.random() - 0.5), Math.random()*1.4, dz/d*(0.5 + Math.random()*1.5) + (Math.random() - 0.5));
    s.userData.w = (Math.random() - 0.5)*20;
    g.add(s);
  }
  P.scene.add(g);
  shards.push({ g, t: 0, ground: E.src.y || 0, geo, m });
}

// what pilot.js asks for (getting out of a car the old way): this car's own door, open, and shut a moment later
Pilot.prototype.openDoor = function (src, kind, s = 1) {
  if (this._noDoor || !src.bodyMesh) return { veh: null, closeAt: null, dud: true };
  const R = hang(this, src, s); R.auto = true; return R;
};
Pilot.prototype.tickDoors = function (dt) {
  if (this.doors) for (const R of this.doors.slice()) {
    if (R.dud) continue;
    R.t += dt;
    if (!R.veh.root.parent) { unhang(this, R); continue; }
    if (R.auto) { if (R.closeAt != null) { R.closeAt -= dt; if (R.closeAt <= 0) shut(R); } R.goal = 1.0; }
    if (R.slam) {
      // let go: it swings to, faster as it goes, and lands
      R.vel -= 9*dt; R.ang += R.vel*dt;
      if (R.ang <= 0) { R.ang = 0; this.audio?.thud?.(0.32); R.veh.tilt.rotation.x += 0.004*R.s; unhang(this, R); continue; }
    } else {
      // a hand on it: it follows, with the weight of a door; the check strap stops it
      const k = 70, c = 2*Math.sqrt(k)*0.75;
      R.vel += (k*(R.goal - R.ang) - c*R.vel)*dt; R.ang += R.vel*dt;
      if (R.ang > MAX) { R.ang = MAX; R.vel = -Math.abs(R.vel)*0.25; }
      if (R.ang < 0) { R.ang = 0; R.vel = 0; }
    }
    R.pivot.rotation.y = R.s*R.ang;
    R.dm.instanceColor.array.set(R.veh.bodyMesh.instanceColor.array.subarray(0, 3)); R.dm.instanceColor.needsUpdate = true;
    if (R.t > 30 && !R.held) shut(R);
  }
  for (let i = shards.length - 1; i >= 0; i--) {
    const S = shards[i]; S.t += dt;
    for (const s of S.g.children) {
      const v = s.userData.v;
      if (s.position.y > S.ground + 0.01) { v.y -= 9.8*dt; s.position.addScaledVector(v, dt); s.rotation.x += s.userData.w*dt; s.rotation.z += s.userData.w*0.7*dt; }
      if (s.position.y <= S.ground + 0.01) { s.position.y = S.ground + 0.01; v.set(0, 0, 0); s.rotation.x = 0; s.rotation.z = 0; }
    }
    if (S.t > 25) { S.g.parent && S.g.parent.remove(S.g); S.geo.dispose(); S.m.dispose(); shards.splice(i, 1); }
  }
  if (this._cx) outTick(this, dt);
};

// ---------------------------------------------------------------- the body through it
// a hand to a point (the hand toward the car's front is the one that takes the handle), fingers closed on it
function hand(H, sd, target, pole, w) { if (w <= 0.01) return; ikArm(H, sd, target, pole, w); grip(H, sd, w); }
// bent at the waist (under the roof, into the cabin), the head kept up
export function stoop(H, rx, rz, a) {
  if (!H || Math.abs(a) < 0.01) return;
  _r.set(rx, 0, rz);
  H.root.updateMatrixWorld(true);
  const s1 = H.root.getObjectByName('spine_01'), s3 = H.root.getObjectByName('spine_03'), nk = H.root.getObjectByName('neck_01');
  if (s1) bendBone(s1, _r, -a*0.6);
  if (s3) bendBone(s3, _r, -a*0.35);
  if (nk) bendBone(nk, _r, a*0.3);
  H.root.updateMatrixWorld(true);
}
// place the body: its origin, facing
export function put(H, p, yaw) { H.holder.position.copy(p); H.holder.rotation.set(0, -yaw, 0); H.holder.updateMatrixWorld(true); }
// the origin that puts the hips (as the seated clips carry them) on a point, facing yaw
export function originFor(hip, yaw, out) { return out.set(hip.x + Math.cos(yaw)*HIP_BACK, hip.y - HIP_UP, hip.z + Math.sin(yaw)*HIP_BACK); }
// feet down to the ground when the body sits higher than the clip has them (an SUV's seat)
export function feetDown(H, yaw, ground, w) {
  if (w <= 0.01) return;
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  for (const sd of ['l', 'r']) {
    const fb = H.root.getObjectByName('foot_' + sd); if (!fb) continue;
    fb.getWorldPosition(_a);
    if (_a.y < ground + 0.1) continue;
    _t.set(_a.x + fx*0.06, ground + 0.085, _a.z + fz*0.06);
    _p.set(fx, 0.25, fz);
    ikLeg(H, sd, _t, _p, w);
  }
}

// Phases, each with how long it takes:
//   walk (pilot.js and above) → smash (locked) → reach the handle → pull it open, stepping back with it →
//   wire (no key) → haul the driver out → step into the gap and turn your back to the seat → sit → legs in →
//   reach out and pull the door to → across to the driver's seat (in by the other door) → in.
const tick = Pilot.prototype.tickEnter;
Pilot.prototype.tickEnter = function (dt) {
  const E = this.entering, F = this.foot, H = this.human;
  if (!E.cd || !H) return tick.call(this, dt);
  E.real += dt; this.busy = Math.max(this.busy, 0.5);
  // the car stays where it is the whole time you're at its door (pilot.js stops it for 3 s, and this takes longer)
  if (E.offer.kind === 'traffic' && E.offer.o) { E.offer.o.v = 0; E.offer.o.argue = Math.max(E.offer.o.argue || 0, 0.5); }
  // knocked about on the way: it's off
  if (this.downT > 0 || this.ko || (this.act && this.act.kind === 'hurt')) return abortIn(this, E);
  const src = E.src, D = E.D, s = E.s, sd = s > 0 ? 'r' : 'l', od = s > 0 ? 'l' : 'r';
  const Fr = frameOf(E.pre && E.pre.root.visible ? E.pre : src), ground = Fr.y;
  const out = Math.atan2(s*Fr.hx, -s*Fr.hz), fwd = Math.atan2(Fr.hz, Fr.hx), hwH = D.hw(D.handle[0]);
  const setAct = () => { this.puppet = null; this.frozen = true; this.act = { kind: 'getin', move: true, vx: 0, vz: 0, t: 0 }; };
  if (E.phase === 'walk') {
    const near = Math.hypot(F.x - E.door.x, F.z - E.door.z) < 0.4;
    if (!(near || E.real >= E.max)) return;
    setAct(); E.phase = E.locked && !E.broke ? 'smash' : 'reach'; E.t = 0; E.from = new THREE.Vector3(F.x, F.y, F.z);
    if (E.phase === 'smash') {
      F.yaw = Math.atan2(src.z - F.z, src.x - F.x);
      H.play('hook', { once: true, fade: 0.08, restart: true, speed: 1.15 });
      if (E.offer.kind === 'traffic') { E.offer.o.v = 0; E.offer.o.argue = 6; }
    } else H.play('idle', { fade: 0.2 });
    return;
  }
  E.t += dt;
  const t = E.t;
  if (E.phase === 'smash') {
    put(H, _a.set(F.x, F.y, F.z), F.yaw);
    if (t > 0.3 && !E.broke) { E.broke = true; smash(this, E); this.events.push({ type: 'glass', x: E.door.x, z: E.door.z }); }
    if (t > 0.8) { E.phase = 'reach'; E.t = 0; H.play('idle', { fade: 0.25 }); }
    return;
  }
  // from here the car you're getting into is the one you'll drive: it takes the place of the one standing there
  if (!E.R) {
    try { const v = standIn(this, E); showStandIn(this, E); E.R = hang(this, v, s); E.R.held = true; E.veh = v; }
    catch (e) { console.warn('cardoor', e); return abortIn(this, E, true); }
  }
  const R = E.R, V = E.veh, Fv = frameOf(V);
  const hdl = onDoor(R, D.handle[0], D.handle[1], D.hw(D.handle[0]) + 0.012, _b);
  if (E.phase === 'reach') {
    // turn to it and take the handle
    const k = sm(t/0.38), yaw = lerpA(F.yaw, Math.atan2(hdl.z - F.z, hdl.x - F.x), Math.min(1, dt*8));
    F.yaw = yaw; put(H, _a.set(F.x, F.y, F.z), yaw);
    hand(H, sd, hdl, _p.set(-Math.cos(yaw)*0.3, -1, -Math.sin(yaw)*0.3), k);
    if (t >= 0.38) { E.phase = 'pull'; E.t = 0; E.p0 = new THREE.Vector3(F.x, F.y, F.z); this.audio?.blip?.(); }
    return;
  }
  // where you'll sit down: in the doorway, hips over the seat's front edge
  const seat = seatOf(V.type), hipX = Math.max(D.x0 + 0.24, Math.min(D.x1 - 0.5, seat[0] - 0.3));
  if (E.phase === 'pull') {
    // the door comes towards you and round; you step back out of its way, the hand with it till it's past
    R.goal = MAX*sm(t/0.75);
    const back = Fv.at(D.x0 - 0.5, 0, s*(hwH + 0.62), _a), k = sm(t/0.6);
    F.x = E.p0.x + (back.x - E.p0.x)*k; F.z = E.p0.z + (back.z - E.p0.z)*k;
    F.yaw = lerpA(F.yaw, Math.atan2(hdl.z - F.z, hdl.x - F.x), Math.min(1, dt*6));
    if (t < 0.05) H.play('walk', { speed: -0.55, fade: 0.2 });
    put(H, _t.set(F.x, F.y, F.z), F.yaw);
    hand(H, sd, hdl, _p.set(-Math.cos(F.yaw)*0.3, -1, -Math.sin(F.yaw)*0.3), 1 - seg(t, 0.35, 0.6));
    if (t >= 0.75) {
      E.t = 0; E.p0 = new THREE.Vector3(F.x, F.y, F.z);
      E.phase = E.wire ? 'wire' : E.offer.kind === 'traffic' && !E.pulled ? 'haul' : 'step';
      H.play('idle', { fade: 0.25 });
      if (E.wire) this.hud?.toast?.('Hotwiring', 'no key in this one', 'info', 2.2);
    }
    return;
  }
  if (E.phase === 'wire' || E.phase === 'haul') {
    // in at the doorway, bent into the cabin: wires under the steering, or hands on whoever's at the wheel
    const at = Fv.at(hipX + 0.1, 0, s*(hwH + 0.38), _a), k = sm(t/0.3);
    F.x = E.p0.x + (at.x - E.p0.x)*k; F.z = E.p0.z + (at.z - E.p0.z)*k;
    F.yaw = lerpA(F.yaw, out + Math.PI, Math.min(1, dt*8));
    put(H, _t.set(F.x, F.y, F.z), F.yaw);
    if (E.phase === 'wire') {
      lean(this, V, sm(t/0.4), true, t);
      if (Math.random() < dt*6) this.audio?.noiseBurst?.(0.03, 3200 + Math.random()*1500, 5, 0.22);
      if (t > 2.6) { E.wire = false; this.audio?.ignition?.(); E.phase = E.offer.kind === 'traffic' && !E.pulled ? 'haul' : 'step'; E.t = 0; E.p0 = new THREE.Vector3(F.x, F.y, F.z); }
    } else {
      // reach in and take hold, then heave back: they come out onto the road
      const pull = seg(t, 0.45, 0.8);
      lean(this, V, sm(t/0.35)*(1 - pull*0.7), false, t);
      if (pull > 0) { const bk = Fv.at(hipX + 0.1, 0, s*(hwH + 0.38 + 0.35*sm(pull)), _a); F.x = bk.x; F.z = bk.z; put(H, _t.set(F.x, F.y, F.z), F.yaw); }
      if (t > 0.62 && !E.pulled) {
        E.pulled = true; this.audio?.thud?.(0.4);
        const dr = this.spawnAngryDriver ? this.spawnAngryDriver(E.offer.o) : null;
        if (dr) { dr.fallen = 1.6; dr.react = 3; }
        E.offer.drv = dr || null;
      }
      if (t > 0.95) { E.phase = 'step'; E.t = 0; E.p0 = new THREE.Vector3(F.x, F.y, F.z); }
    }
    return;
  }
  if (E.phase === 'step') {
    // into the gap between the door and the body, turning your back to the seat
    const T = 0.6, k = sm(t/T), to = Fv.at(hipX, 0, s*(hwH + 0.3), _a);
    F.x = E.p0.x + (to.x - E.p0.x)*k; F.z = E.p0.z + (to.z - E.p0.z)*k;
    F.yaw = lerpA(F.yaw, out, Math.min(1, dt*7));
    if (t < 0.05) H.play('walk', { speed: 0.7, fade: 0.2 });
    put(H, _t.set(F.x, F.y, F.z), F.yaw);
    // the far hand on the top of the open door, steadying
    const top = onDoor(R, D.x0 + 0.12, D.top(D.x0 + 0.12) - 0.03, D.hw(D.x0) - 0.03, _f);
    hand(H, sd, top, _p.set(0, -1, 0), bell(t/T)*0.8);
    if (t >= T) { E.phase = 'sit'; E.t = 0; E.p0 = new THREE.Vector3(F.x, F.y, F.z); F.yaw = out; H.play('sit_enter', { once: true, restart: true, fade: 0.15, speed: 1.3 }); }
    return;
  }
  // sat down facing out, then round to the front
  const hipOut = Fv.at(hipX, seat[1] - 0.04, s*seat[2], new THREE.Vector3());
  if (E.phase === 'sit') {
    // the clip lowers the hips back and down; the body goes with it over the seat (it's higher than a chair in an SUV)
    const T = 1.0, k = sm(seg(t, 0.15, 0.75)), end = originFor(hipOut, out, _f);
    _a.set(E.p0.x + (end.x - E.p0.x)*k, E.p0.y + (end.y - E.p0.y)*k, E.p0.z + (end.z - E.p0.z)*k);
    put(H, _a, out);
    const rxw = -Math.sin(out), rzw = Math.cos(out);
    stoop(H, rxw, rzw, (D.low ? 0.5 : 0.28)*bell(seg(t, 0.15, 0.95)));
    feetDown(H, out, ground, k);
    const top = onDoor(R, D.x0 + 0.12, D.top(D.x0 + 0.12) - 0.03, D.hw(D.x0) - 0.03, _b);
    hand(H, sd, top, _p.set(0, -1, 0), 0.8*(1 - seg(t, 0.3, 0.7)));
    if (t >= T) { E.phase = 'legs'; E.t = 0; H.play('drive', { fade: 0.5 }); E.feet = null; }
    return;
  }
  const seatHip = Fv.at(seat[0] - 0.05 - HIP_BACK + 0.12, seat[1] - 0.04, s*seat[2], new THREE.Vector3());
  if (E.phase === 'legs') {
    // round on the seat to face the front, the feet lifted over the sill and into the footwell
    const T = 0.7, k = sm(t/T), yaw = lerpA(out, fwd, k);
    if (!E.feet) { E.feet = {}; for (const f of ['l', 'r']) { const b = H.root.getObjectByName('foot_' + f); if (b) E.feet[f] = b.getWorldPosition(new THREE.Vector3()); } }
    _t.lerpVectors(hipOut, seatHip, k);
    put(H, originFor(_t, yaw, _a), yaw);
    const sill = carSpec(V.type).sill;
    for (const f of ['l', 'r']) {
      if (!E.feet[f]) continue;
      const well = Fv.at(seat[0] + 0.45, sill - 0.05, s*seat[2] + (f === 'l' ? -0.12 : 0.12), _b);
      _t.lerpVectors(E.feet[f], well, k); _t.y += bell(k)*(sill + 0.12 - ground)*0.9;
      ikLeg(H, f, _t, _p.set(Math.cos(yaw), 0.4, Math.sin(yaw)), 1 - seg(t, 0.5, T));
    }
    if (t >= T) { E.phase = 'close'; E.t = 0; }
    return;
  }
  if (E.phase === 'close') {
    // lean out, take the door by its pull and bring it to; let go and it shuts
    put(H, originFor(seatHip, fwd, _a), fwd);
    const pull = onDoor(R, D.pull[0], D.pull[1], D.hw(D.pull[0]) - 0.07, _b);
    const reach = sm(t/0.35), lean2 = 0.3*bell(seg(t, 0, 0.75));
    if (lean2 > 0.01) { const fx = Math.cos(fwd), fz = Math.sin(fwd); const s1 = H.root.getObjectByName('spine_02'); if (s1) { bendBone(s1, _r.set(fx, 0, fz), s*lean2); H.root.updateMatrixWorld(true); } }
    if (t > 0.3) R.goal = Math.max(0.12, MAX*(1 - sm((t - 0.3)/0.35)));
    hand(H, sd, pull, _p.set(Math.cos(fwd)*0.3, -1, Math.sin(fwd)*0.3), reach*(1 - seg(t, 0.7, 0.9)));
    if (t > 0.68 && !R.slam) { R.held = false; shut(R); }
    if (t >= 0.9) { E.phase = E.pass ? 'across' : 'in'; E.t = 0; }
    return;
  }
  if (E.phase === 'across') {
    // over the gear stick to the driver's side
    const T = 0.75, k = sm(t/T), drv = Fv.at(seat[0] - 0.05 - HIP_BACK + 0.12, seat[1] + 0.03*bell(k), seat[2]*(-1 + 2*k), _a);
    put(H, originFor(drv, fwd, _t), fwd);
    if (t >= T) { E.phase = 'in'; E.t = 0; }
    return;
  }
  if (E.phase === 'in') {
    const keep = H.holder.position.clone(), o = E.offer;
    this.entering = null; this.frozen = false; this.puppet = null; if (this.act && this.act.kind === 'getin') this.act = null;
    o.now = true;
    this.enter(o, E.traffic);
    if (this.cur === V) { this._settle = { from: keep, t0: performance.now() }; if (R.veh === V) R.held = false; }
    else dropStandIn(this, E);
  }
};
function abortIn(P, E, quiet) {
  if (E.R) { E.R.held = false; shut(E.R); }
  // its driver's already out on the road: the car doesn't drive on without them. It stays standing there, empty, its
  // door swinging shut, a car you (or they) can get into
  if (E.offer.kind === 'traffic' && E.pulled && emptied(P, E)) {
    P.entering = null; P.frozen = false; P.puppet = null;
    if (P.act && P.act.kind === 'getin') P.act = null;
    if (!quiet) P.human?.play('idle', { fade: 0.2 });
    return;
  }
  if (!E.R || !E.pre || !E.pre.root.visible) dropStandIn(P, E);
  else { const v = E.pre; setTimeout(() => dropStandIn(P, { ...E, pre: v }), 900); }
  P.entering = null; P.frozen = false; P.puppet = null;
  if (P.act && P.act.kind === 'getin') P.act = null;
  if (!quiet) P.human?.play('idle', { fade: 0.2 });
}

function emptied(P, E) {
  const o = E.offer.o, TR = E.traffic;
  let v = E.pre;
  try {
    if (!v) { v = new Vehicle(P.W, P.scene, P.vmats, E.kind, o.col || [0.6, 0.6, 0.6]); }
    v.reset(o.x, o.z, o.th ?? Math.atan2(o.hz, o.hx)); v.y = o.y || 0; v.v = 0; v.sync(0); v.root.visible = true;
    v.helmet = false; v.plate = P.randomPlate ? P.randomPlate() : v.plate;
  } catch (e) { return false; }
  E.pre = null; E.offer.pre = null;
  const i = TR && TR.list ? TR.list.indexOf(o) : -1;
  if (i >= 0) TR.despawn(i);
  P.addDropped(v, TR);
  return true;
}

// bent in at the open door: the body forward into the cabin, the hands down under the dash (wiring) or on the seat
function lean(P, V, k, wire, t) {
  const H = P.human, F = P.foot; if (!H) return;
  const w = Math.min(1, k);
  const dx = V.x - F.x, dz = V.z - F.z, d = Math.hypot(dx, dz) || 1;
  _r.set(-dz/d, 0, dx/d);
  H.root.updateMatrixWorld(true);
  const sp = H.root.getObjectByName('spine_01'), sp3 = H.root.getObjectByName('spine_03');
  if (sp) bendBone(sp, _r, -0.55*w);
  if (sp3) bendBone(sp3, _r, -0.25*w);
  H.root.updateMatrixWorld(true);
  const y = (V.y || 0) + (wire ? 0.55 : 0.75);
  for (const s of ['l', 'r']) {
    const o = (s === 'l' ? 1 : -1)*0.13, j = wire ? Math.sin(t*9 + (s === 'l' ? 0 : 2))*0.03 : 0;
    _t.set(F.x + dx/d*0.75 + _r.x*o + j, y + j, F.z + dz/d*0.75 + _r.z*o);
    _p.set(_r.x*(s === 'l' ? 1 : -1), -1, _r.z*(s === 'l' ? 1 : -1));
    ikArm(H, s, _t, _p, w);
    grip(H, s, w);
  }
}

// at the wheel: the last of the sit carried into where the driving seat really has you (no jump)
const pr = Pilot.prototype.placeRider;
Pilot.prototype.placeRider = function () {
  pr.call(this);
  const S = this._settle, H = this.human; if (!S || !H) return;
  const k = (performance.now() - S.t0)/320;
  if (k >= 1) { this._settle = null; return; }
  H.holder.position.lerp(S.from, 1 - sm(k)); H.holder.updateMatrixWorld(true);
};

// (what you're pressing, for walking off before the door's quite shut)
const uf = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, input, ...a) { this._inp = input; return uf.call(this, dt, input, ...a); };

// ---------------------------------------------------------------- getting out
// The door pushed open, round on the seat with the legs out over the sill, up off it, a step clear and the door shut
// behind you. Out of the other side (the driver's blocked): across to that seat first.
const exit = Pilot.prototype.exit;
Pilot.prototype.exit = function (traffic, force = false) {
  const veh = this.cur, H = this.human, was = this.onFoot;
  const car = !was && veh && veh !== this.auto && veh.bodyMesh && veh.spec && !veh.spec.two && veh.type !== 'bus' && veh.type !== 'tempo' && (() => { try { doorOf(veh.type); return true; } catch (e) { return false; } })();
  if (!car || force || !H) return exit.call(this, traffic, force);
  const from = H.holder.position.clone();
  this._noDoor = true;
  let out;
  try { out = exit.call(this, traffic, force); } finally { this._noDoor = false; }
  if (!this.onFoot) return out;
  const F = this.foot, Fr = frameOf(veh), s = Math.sign((F.x - veh.x)*-Fr.hz + (F.z - veh.z)*Fr.hx) || 1;
  this._cx = { veh, s, t: 0, phase: s < 0 ? 'across' : 'open', from, end: new THREE.Vector3(F.x, F.y, F.z), y0: F.y, R: null };
  this.frozen = true; this.act = { kind: 'getout', move: true, vx: 0, vz: 0, t: 0 };
  H.play('drive', { fade: 0 });
  return out;
};
function outTick(P, dt) {
  const C = P._cx, H = P.human, F = P.foot, V = C.veh;
  if (!H || P.downT > 0 || P.ko || (P.act && P.act.kind === 'hurt') || !P.onFoot) return outDone(P, true);
  C.t += dt;
  const t = C.t, s = C.s, sd = s > 0 ? 'r' : 'l', D = doorOf(V.type), Fv = frameOf(V), ground = C.y0;
  const seat = seatOf(V.type), fwd = Math.atan2(Fv.hz, Fv.hx), out = Math.atan2(s*Fv.hx, -s*Fv.hz), hwH = D.hw(D.handle[0]);
  const hipX = Math.max(D.x0 + 0.24, Math.min(D.x1 - 0.5, seat[0] - 0.3));
  const seatHip = Fv.at(seat[0] - 0.05 - HIP_BACK + 0.12, seat[1] - 0.04, s*seat[2], new THREE.Vector3());
  const hipOut = Fv.at(hipX, seat[1] - 0.04, s*seat[2], new THREE.Vector3());
  const walking = !!(P._inp && P._inp.key && P._inp.key('KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'));
  const keepF = () => { const p = Fv.at(hipX, 0, s*(hwH + 0.3), _f); F.x = p.x; F.z = p.z; F.y = ground; };
  if (C.phase === 'across') {
    const T = 0.7, k = sm(t/T), p = Fv.at(seat[0] - 0.05 - HIP_BACK + 0.12, seat[1] - 0.04 + 0.03*bell(k), seat[2]*(1 - 2*k), _a);
    put(H, originFor(p, fwd, _t), fwd); keepF();
    if (t >= T) { C.phase = 'open'; C.t = 0; }
    return;
  }
  if (!C.R) C.R = hang(P, V, s), C.R.held = true;
  const R = C.R;
  if (C.phase === 'open') {
    // the handle pulled, a shove with the hand and it swings out
    const T = 0.6;
    originFor(seatHip, fwd, _a); if (s > 0 && C.from) _a.lerp(C.from, 1 - sm(t/0.3));
    put(H, _a, fwd); keepF();
    R.goal = t < 0.2 ? 0.08 : MAX*sm((t - 0.2)/0.45);
    const pull = onDoor(R, D.pull[0], D.pull[1], D.hw(D.pull[0]) - 0.07, _b);
    hand(H, sd, pull, _p.set(Math.cos(fwd)*0.3, -1, Math.sin(fwd)*0.3), sm(t/0.2)*(1 - seg(t, 0.4, 0.6)));
    if (t >= T) { C.phase = 'legs'; C.t = 0; C.feet = null; }
    return;
  }
  if (C.phase === 'legs') {
    // round on the seat, the legs out over the sill and down to the road
    const T = 0.65, k = sm(t/T), yaw = lerpA(fwd, out, k);
    _t.lerpVectors(seatHip, hipOut, k);
    put(H, originFor(_t, yaw, _a), yaw); keepF();
    const sill = carSpec(V.type).sill;
    for (const f of ['l', 'r']) {
      const well = Fv.at(seat[0] + 0.45, sill - 0.05, s*seat[2] + (f === 'l' ? -0.12 : 0.12), _b).clone();
      const road = Fv.at(hipX + (f === 'l' ? 0.13 : -0.13)*s, 0.085, s*(hwH + 0.22), _a);
      _t.lerpVectors(well, road, k); _t.y += bell(k)*(sill + 0.12 - ground)*0.9;
      ikLeg(H, f, _t, _p.set(Math.cos(yaw), 0.4, Math.sin(yaw)), Math.min(1, k*3));
    }
    if (t >= T) { C.phase = 'rise'; C.t = 0; H.play('sit_exit', { once: true, restart: true, fade: 0.2, speed: 1.15 }); C.o0 = H.holder.position.clone(); }
    return;
  }
  if (C.phase === 'rise') {
    // up off the seat over your feet: the clip stands you up, the body comes out of the doorway with it
    const T = 0.95, k = sm(seg(t, 0.05, 0.75)), to = Fv.at(hipX, 0, s*(hwH + 0.32), _a);
    _t.set(C.o0.x + (to.x - C.o0.x)*k, C.o0.y + (ground - C.o0.y)*k, C.o0.z + (to.z - C.o0.z)*k);
    put(H, _t, out); keepF();
    stoop(H, -Math.sin(out), Math.cos(out), (D.low ? 0.45 : 0.25)*bell(seg(t, 0, 0.8)));
    feetDown(H, out, ground, 1 - k);
    if (t >= T) { C.phase = 'step'; C.t = 0; C.p0 = new THREE.Vector3(to.x, ground, to.z); H.play('walk', { speed: 0.75, fade: 0.25 }); }
    return;
  }
  const clear = Fv.at(D.x0 - 0.45, 0, s*(hwH + 0.7), new THREE.Vector3());
  if (C.phase === 'step') {
    // a step clear, round to face the door
    const T = 0.55, k = sm(t/T);
    F.x = C.p0.x + (clear.x - C.p0.x)*k; F.z = C.p0.z + (clear.z - C.p0.z)*k; F.y = ground;
    const edge = onDoor(R, D.x0 + 0.1, D.top(D.x0 + 0.1) - 0.05, D.hw(D.x0), _b);
    F.yaw = lerpA(out, Math.atan2(edge.z - F.z, edge.x - F.x), k);
    put(H, _t.set(F.x, F.y, F.z), F.yaw);
    if (t >= T || (walking && t > 0.2)) { C.phase = 'shut'; C.t = 0; H.play('idle', { fade: 0.2 }); }
    return;
  }
  if (C.phase === 'shut') {
    // a push on the door's edge and it swings to
    F.x = clear.x; F.z = clear.z; F.y = ground;
    const edge = onDoor(R, D.x0 + 0.1, D.top(D.x0 + 0.1) - 0.05, D.hw(D.x0) + 0.02, _b);
    F.yaw = lerpA(F.yaw, Math.atan2(edge.z - F.z, edge.x - F.x), Math.min(1, dt*8));
    put(H, _t.set(F.x, F.y, F.z), F.yaw);
    hand(H, sd, edge, _p.set(-Math.cos(F.yaw)*0.3, -1, -Math.sin(F.yaw)*0.3), sm(t/0.2)*(1 - seg(t, 0.3, 0.45)));
    if (t > 0.22) R.goal = Math.max(0, R.goal - dt*2);
    if (t > 0.3 && !R.slam) { R.held = false; shut(R); }
    if (t >= 0.45 || walking) outDone(P);
  }
}
function outDone(P, hurt) {
  const C = P._cx; P._cx = null;
  if (C && C.R) { C.R.held = false; shut(C.R); }
  if (!hurt && P.foot) P.foot.y = C.y0;
  P.frozen = false; if (P.act && P.act.kind === 'getout') P.act = null;
  if (!hurt) P.human?.play('idle', { fade: 0.2 });
}
