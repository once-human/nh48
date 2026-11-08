// Getting on a two-wheeler like a person does. You walk to the side of it you're nearer (the other side if that one's up
// against something) and stand by the seat. Someone on it already: one hard shove, your right hand cocked back by the
// shoulder and driven into their chest with your hips and shoulder behind it, and they go off the far side and slide.
// Then: both hands to the bars, your weight on the outside foot, and the inside leg comes up behind you, over the seat
// and down on the far side, and you settle into the seat as the riding pose takes over. Hemmed in on both sides (parked
// between two bikes in a lane): you hop on from where you are.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { specOf } from '@orig/vehicles/vehicle.js';
import { RIDER_HIPS, ikArm, bendBone } from '@orig/people/humans.js';
import { ikLeg } from '../game/fists.js';
import { routeTo, setRoute, follow, walkTime, tooFar, calledOff } from './route.js';
import { fitOf, HIP_OFF, WRIST, grip as close, reachLean } from './fit.js';

const _t = new THREE.Vector3(), _a = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _pole = new THREE.Vector3(), _ax = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
export const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
export const seg = (t, a, b) => sm((t - a)/(b - a));
export const bez = (o, a, b, c, k) => { const m = 1 - k; return o.set(a.x*m*m + 2*b.x*m*k + c.x*k*k, a.y*m*m + 2*b.y*m*k + c.y*k*k, a.z*m*m + 2*b.z*m*k + c.z*k*k); };
const kindOf = (o) => o.kind === 'traffic' ? o.o.type : o.kind === 'parked' ? o.r.kind : o.kind === 'dropped' ? o.d.veh.type : o.kind === 'service' ? o.sv.veh.type : null;
const srcOf = (o) => o.kind === 'traffic' ? o.o : o.kind === 'parked' ? o.r : o.kind === 'dropped' ? o.d.veh : o.kind === 'service' ? o.sv.veh : null;
const bigBike = (k) => /bike|bullet|superbike/.test(k);

// is there room to stand at x, z (a wall, a parked vehicle, a moving one)
export function free(P, traffic, x, z, self) {
  const r = P.W.collision.resolve(x, z, 0.28);
  if (r && r.kind !== 3 && r.depth > 0.08) return false;
  let ok = true;
  if (traffic) traffic.near(x, z, 3, (o) => { if (o === self || !o.T) return; if (P.distToBox(x, z, o.x, o.z, o.hx, o.hz, o.T.L, o.T.W) < 0.25) ok = false; });
  for (const dd of P.dropped || []) { const v = dd.veh; if (v === self || !v.spec) continue; if (P.distToBox(x, z, v.x, v.z, Math.cos(v.th), Math.sin(v.th), v.spec.L, v.spec.W) < 0.25) ok = false; }
  return ok;
}
// where things are on a two-wheeler, in the world: the hips when seated (as placeRider puts them), the grips, the pegs
export function frameOf(src, kind) {
  const S = specOf(kind) || {}, hx = src.hx ?? Math.cos(src.th), hz = src.hz ?? Math.sin(src.th), rx = -hz, rz = hx, y = src.y || 0;
  const at = (f, u, r, o) => o.set(src.x + hx*f + rx*r, y + u, src.z + hz*f + rz*r);
  const ft = fitOf(kind);
  // (a bicycle: as placeRider has it)
  if (!ft) { const seatY = S.seat ? S.seat[1] : 0.8, sx = (S.seat ? S.seat[0] : -0.25) - 0.05; return { hx, hz, rx, rz, y, seatY, sx, at, bar: 0.42, barY: 1.0, barW: 0.28, hip: [sx + HIP_OFF[0], seatY - 0.62 + HIP_OFF[1]], foot: [-0.05, 0.4, 0.18], top: seatY - 0.04 }; }
  // the body's origin when seated (placeRider, fit.js), the wrists' spot on the grips, the feet's on the floorboard / pegs
  const sx = ft.hip[0] - HIP_OFF[0], seatY = ft.hip[1] - HIP_OFF[1] + 0.62;
  return { hx, hz, rx, rz, y, seatY, sx, at, bar: ft.grip[0] + WRIST[0], barY: ft.grip[1] + WRIST[1], barW: ft.grip[2], hip: ft.hip, foot: ft.foot, top: ft.hip[1] - 0.08 };
}
// turn a bone by up to two world-axis turns on top of the clip's pose (never on top of last frame's turn)
const _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _bx = new THREE.Vector3();
export function bend2(b, a1, t1, a2, t2) {
  if (!b || !b.parent) return;
  const u = b.userData;
  if (u.mq && b.quaternion.equals(u.mq)) b.quaternion.copy(u.mb); else (u.mb || (u.mb = new THREE.Quaternion())).copy(b.quaternion);
  b.parent.getWorldQuaternion(_pq).invert();
  if (t1) b.quaternion.premultiply(_rq.setFromAxisAngle(_bx.copy(a1).applyQuaternion(_pq), t1));
  if (a2 && t2) b.quaternion.premultiply(_rq.setFromAxisAngle(_bx.copy(a2).applyQuaternion(_pq), t2));
  (u.mq || (u.mq = new THREE.Quaternion())).copy(b.quaternion);
}
// the body twisted round the spine (+ turns it to its left) and bent forward over the hips; the head stays level
export function torso(H, twist, bend, rx, rz) {
  if (!twist && !bend) return;
  H.root.updateMatrixWorld(true);
  _ax.set(rx, 0, rz);
  const s1 = H.root.getObjectByName('spine_01'), s3 = H.root.getObjectByName('spine_03'), nk = H.root.getObjectByName('neck_01');
  bend2(s1, Y, twist*0.45, _ax, -bend*0.6); H.root.updateMatrixWorld(true);
  bend2(s3, Y, twist*0.55, _ax, -bend*0.4); H.root.updateMatrixWorld(true);
  if (bend) bend2(nk, _ax, bend*0.5);
  H.root.updateMatrixWorld(true);
}

const enter = Pilot.prototype.enter;
Pilot.prototype.enter = function (offer, traffic) {
  const kind = offer && kindOf(offer), S = kind && specOf(kind);
  if (!offer || offer.now || offer.kind === 'pet' || this._mount || this.entering || !S || !S.two || !this.onFoot) return enter.call(this, offer, traffic);
  const src = srcOf(offer), F = this.foot;
  const hx = src.hx ?? Math.cos(src.th), hz = src.hz ?? Math.sin(src.th), W = (S.W || 0.7)/2 + 0.16;
  // left of the machine is (hz, -hx), right is (-hz, hx); nearer side first
  const sides = [-1, 1].map(s => ({ s, x: src.x - hz*W*s - hx*0.05, z: src.z + hx*W*s - hz*0.05 }));
  sides.sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z));
  const side = sides.find(q => free(this, traffic, q.x, q.z, src));
  const rider = offer.kind === 'traffic';
  if (rider) { offer.o.v = 0; offer.o.argue = 6; }
  const M = this._mount = { offer, traffic, src, kind, hx, hz, side, t: 0, phase: side ? 'walk' : 'hop', rider, max: 0 };
  if (side) { this.frozen = true; M.max = walkTime(M, setRoute(this, M, routeTo(this, traffic, src, S, side), { x: side.x, z: side.z, face: Math.atan2(hz, hx) })); }
  this.busy = 4;
};

// the body on the seat of a close, slow two-wheeler (people/crowd.js gives them one)
function riderOf(o) { const R = o && o._riders && o._riders[0]; return R && R.body && R.body.H && R.body.H.root ? R.body.H : null; }
// shoved off: the one who was riding it (their look, not a stranger's), down where they sat
const sad = Pilot.prototype.spawnAngryDriver;
Pilot.prototype.spawnAngryDriver = function (o, mode) {
  const J = this._jab;
  if (!J || J.o !== o || !this.kit) return sad.call(this, o, mode);
  const kit = this.kit, rl = kit.randomLook;
  if (J.look) kit.randomLook = () => J.look;
  let p;
  try { p = sad.call(this, o, mode); } finally { kit.randomLook = rl; }
  if (p) { p.x = J.x; p.z = J.z; J.p = p; }
  return p;
};

function finish(P) {
  const M = P._mount; P._mount = null; P.frozen = false; P.puppet = null;
  if (P.act && P.act.kind === 'mount') P.act = null;
  const o = M.offer; o.now = true;
  enter.call(P, o, M.traffic);
}
function abort(P) { P._mount = null; P.frozen = false; P.puppet = null; P.busy = 0; if (P.act && P.act.kind === 'mount') P.act = null; }

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), M = this._mount;
  if (!M || !this.onFoot) return out;
  const F = this.foot, H = this.human; M.t += dt;
  if (this.downT > 0 || this.ko || (this.act && this.act.kind === 'hurt')) { abort(this); return out; }
  const Fr = frameOf(M.src, M.kind), face = Math.atan2(Fr.hz, Fr.hx);
  const s = M.side ? M.side.s : 0;                          // -1: you're on its left
  if (M.phase === 'walk') {
    follow(this, M);
    const near = M.side && Math.hypot(F.x - M.side.x, F.z - M.side.z) < 0.3;
    if (calledOff(this, M) || (!near && M.t > M.max && tooFar(this, M.side))) { abort(this); return out; }
    if (near || M.t > M.max) {
      this.puppet = null; M.t = 0;
      this.act = { kind: 'mount', t: 0 };
      M.phase = M.rider ? 'shove' : 'mount';
      M.x0 = F.x; M.z0 = F.z; M.yaw0 = F.yaw;
      H.play('idle', { fade: 0.2 });
    }
    return out;
  }
  if (M.phase === 'shove') {
    // square up to them, cock the right hand by the shoulder, drive it into their chest
    const T = 0.62, t = M.t, k1 = seg(t, 0, 0.2), k2 = seg(t, 0.2, 0.32), k3 = seg(t, 0.36, T);
    const want = Math.atan2(M.src.z - F.z, M.src.x - F.x);
    F.yaw = M.yaw0 + Math.atan2(Math.sin(want - M.yaw0), Math.cos(want - M.yaw0))*sm(t/0.16);
    const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw), rx = -fz, rz = fx;
    const step = 0.16*k2*(1 - k3*0.6);                      // the weight goes in behind it
    F.x = M.x0 + fx*step; F.z = M.z0 + fz*step;
    H.holder.position.set(F.x, F.y, F.z); H.holder.rotation.set(0, -F.yaw, 0);
    torso(H, (-0.45*k1 + 0.8*k2)*(1 - k3), 0, rx, rz);
    const sh = H.root.getObjectByName('upperarm_r');
    if (sh) {
      H.root.updateMatrixWorld(true); sh.getWorldPosition(_a);
      // their chest: the rider's own (the close riders are real bodies), or where it'd be; the palm lands on its front
      const rb = riderOf(M.src), ch = rb && (rb.root.getObjectByName('spine_03') || rb.root.getObjectByName('spine_02'));
      if (ch) { rb.root.updateMatrixWorld(true); ch.getWorldPosition(_c); }
      else Fr.at(Fr.sx*0.3, Fr.seatY + 0.42, 0, _c);
      _c.x -= fx*0.11; _c.z -= fz*0.11;
      _f.set(_a.x - fx*0.12 + rx*0.08, _a.y - 0.12, _a.z - fz*0.12 + rz*0.08);   // cocked by your shoulder
      if (t < 0.2) _t.copy(_f);
      else if (t < 0.36) _t.lerpVectors(_f, _c, Math.min(1, k2*1.1));
      else _t.lerpVectors(_c, _f, k3);
      _pole.set(rx*0.6, -1, rz*0.6);
      ikArm(H, 'r', _t, _pole, Math.min(1, t/0.1)*(1 - k3));
    }
    // contact: they're off (pilot.enter spawns them down; falls.js throws them away from you), the machine is yours
    if (t > 0.3 && !M.hit) {
      M.hit = true; this.audio?.punch?.(0.7); this.audio?.thud?.(0.45);
      const o = M.offer, keep = { x: F.x, z: F.z, yaw: F.yaw, y: F.y };
      // the same person goes over, from where they sat, away from you (pilot.spawnAngryDriver, below)
      const R = M.src._riders && M.src._riders[0];
      this._jab = { o: M.src, x: (R ? R.x : M.src.x) + fx*0.15, z: (R ? R.z : M.src.z) + fz*0.15, look: R && R.look };
      o.now = true; o.dragged = true;
      try { enter.call(this, o, M.traffic); } finally { this._jab = null; }
      const veh = this.cur;
      if (veh && !this.onFoot) {
        this.exit(M.traffic, true);
        Object.assign(F, { x: keep.x, z: keep.z, yaw: keep.yaw, y: keep.y, v: 0, vx: 0, vz: 0 });
        const d = (this.dropped || []).find(q => q.veh === veh);
        if (d) { M.offer = { kind: 'dropped', d, label: '' }; M.src = veh; this.act = { kind: 'mount', t: 0 }; this.frozen = true; }
        else { abort(this); return out; }
      } else { abort(this); return out; }
    }
    if (t >= T) { M.phase = 'mount'; M.t = 0; M.x0 = F.x; M.z0 = F.z; M.yaw0 = F.yaw; }
    return out;
  }
  if (M.phase === 'mount') {
    // hands to the bars, then the inside leg across: through the floorboard on a scooter, up over the back of the seat
    // on a motorcycle (the body leaning over the tank); only once it's across does the body come over and sit
    const scoot = !bigBike(M.kind), T = scoot ? 1.0 : 1.15, t = M.t;
    const grip = seg(t, 0, 0.28), lift = seg(t, 0.2, scoot ? 0.62 : 0.72), across = seg(t, scoot ? 0.45 : 0.55, scoot ? 0.85 : 0.95), sit = seg(t, scoot ? 0.6 : 0.7, T);
    F.yaw = M.yaw0 + Math.atan2(Math.sin(face - M.yaw0), Math.cos(face - M.yaw0))*seg(t, 0, 0.2);
    const hip = Fr.at(Fr.sx, 0, 0, _f), hx0 = hip.x, hz0 = hip.z;
    const bx = M.x0 + (hx0 - M.x0)*across, bz = M.z0 + (hz0 - M.z0)*across;
    const by = F.y + (Fr.y + Fr.seatY - 0.62 - F.y)*sit + (scoot ? 0 : Math.sin(Math.PI*lift)*0.04);
    F.x = bx; F.z = bz;
    H.holder.position.set(bx, by, bz); H.holder.rotation.set(0, -F.yaw, 0);
    if (!M.sat && t > (scoot ? 0.62 : 0.74)) { M.sat = true; H.play('drive', { fade: 0.35 }); }
    const inLeg = s < 0 ? 'r' : 'l', outLeg = s < 0 ? 'l' : 'r';
    H.root.updateMatrixWorld(true);
    // the outside foot stays planted until the seat takes the weight
    const fo = H.root.getObjectByName('foot_' + outLeg), fi = H.root.getObjectByName('foot_' + inLeg);
    // (the knees forward and a little out, as on the machine)
    const knee = (sd, up) => _pole.set(Fr.hx + Fr.rx*sd*0.3, up, Fr.hz + Fr.rz*sd*0.3);
    // the outside foot stays on the road while it takes the weight, then up onto its floorboard / peg as you sit
    if (fo) {
      if (!M.plant) { fo.getWorldPosition(_a); M.plant = _a.clone(); }
      const peg = Fr.at(Fr.foot[0], Fr.foot[1], s*Fr.foot[2], new THREE.Vector3());
      _t.copy(M.plant).lerp(peg, seg(t, scoot ? 0.72 : 0.8, T));
      if (_t.y < M.plant.y) _t.y = M.plant.y;
      ikLeg(H, outLeg, _t, knee(s, 0.25), 1);
    }
    if (fi) {
      if (!M.swing) { fi.getWorldPosition(_a); M.swing = _a.clone(); }
      // over what, and where it ends: through over a scooter's floorboard, low; up over the back of a motorcycle's seat
      const mid = scoot ? Fr.at(Fr.foot[0] - 0.04, Fr.foot[1] + 0.26, s*0.04, new THREE.Vector3()) : Fr.at(Fr.hip[0] - 0.42, Fr.top + 0.16, 0, new THREE.Vector3());
      const land = Fr.at(Fr.foot[0], Fr.foot[1], -s*Fr.foot[2], new THREE.Vector3());
      bez(_t, M.swing, mid, land, lift);
      ikLeg(H, inLeg, _t, knee(-s, scoot ? 0.7 : 0.2), Math.min(1, t/0.2));
    }
    // a motorcycle: lean over the tank as the leg goes over the back; settling in, the lean the bars want
    torso(H, 0, (scoot ? 0.12 : 0.45)*grip*(1 - sit), Fr.rx, Fr.rz);
    const wr = [Fr.at(Fr.bar, Fr.barY, -Fr.barW, new THREE.Vector3()), Fr.at(Fr.bar, Fr.barY, Fr.barW, new THREE.Vector3())];
    if (sit > 0) reachLean(H, _ax.set(Fr.rx, 0, Fr.rz), wr, sit);
    for (const side of ['l', 'r']) {
      const sd = side === 'l' ? -1 : 1;
      _pole.set(-Fr.hx*0.25 + Fr.rx*sd*0.8, -0.7, -Fr.hz*0.25 + Fr.rz*sd*0.8);
      ikArm(H, side, wr[sd > 0 ? 1 : 0], _pole, grip);
      close(H, side, grip);
    }
    if (t >= T) finish(this);
    return out;
  }
  if (M.phase === 'hop') {
    // no room either side: a hop, up and on
    if (M.t < dt*1.5) { this.act = { kind: 'mount', t: 0 }; H.play('jump_start', { once: true, fade: 0.08, restart: true }); M.x0 = F.x; M.z0 = F.z; }
    const T = 0.55, k = sm(M.t/T), hipX = Fr.at(Fr.sx, 0, 0, _f).x, hipZ = _f.z;
    F.x = M.x0 + (hipX - M.x0)*k; F.z = M.z0 + (hipZ - M.z0)*k; F.yaw = face;
    const by = F.y + (Fr.y + Fr.seatY - 0.62 - F.y)*k + Math.sin(Math.PI*Math.min(1, M.t/T))*0.5;
    H.holder.position.set(F.x, by, F.z); H.holder.rotation.set(0, -F.yaw, 0);
    if (M.t > T*0.6 && !M.sat) { M.sat = true; H.play('drive', { fade: 0.2 }); }
    if (M.t >= T) finish(this);
  }
  return out;
};
