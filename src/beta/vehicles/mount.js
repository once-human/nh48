// Getting on a two-wheeler like a person does. You walk to the side of it you're nearer (the other side if
// that one's up against something), stand by the seat facing the way it points, and swing your leg over the seat; the
// leg comes up behind and down on the far side, and you settle on. Someone on it already gets pushed off first
// and goes down. Hemmed in on both sides (parked between two bikes in a lane): you hop on from where you are.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { specOf } from '@orig/vehicles/vehicle.js';
import { ikLeg } from '../game/fists.js';

const _t = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _pole = new THREE.Vector3();
const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const kindOf = (o) => o.kind === 'traffic' ? o.o.type : o.kind === 'parked' ? o.r.kind : o.kind === 'dropped' ? o.d.veh.type : o.kind === 'service' ? o.sv.veh.type : null;
const srcOf = (o) => o.kind === 'traffic' ? o.o : o.kind === 'parked' ? o.r : o.kind === 'dropped' ? o.d.veh : o.kind === 'service' ? o.sv.veh : null;

// is there room to stand at x, z (a wall, a parked vehicle, a moving one)
export function free(P, traffic, x, z, self) {
  const r = P.W.collision.resolve(x, z, 0.28);
  if (r && r.kind !== 3 && r.depth > 0.08) return false;
  let ok = true;
  if (traffic) traffic.near(x, z, 3, (o) => { if (o === self || !o.T) return; if (P.distToBox(x, z, o.x, o.z, o.hx, o.hz, o.T.L, o.T.W) < 0.25) ok = false; });
  for (const dd of P.dropped || []) { const v = dd.veh; if (v === self || !v.spec) continue; if (P.distToBox(x, z, v.x, v.z, Math.cos(v.th), Math.sin(v.th), v.spec.L, v.spec.W) < 0.25) ok = false; }
  return ok;
}

const enter = Pilot.prototype.enter;
Pilot.prototype.enter = function (offer, traffic) {
  const kind = offer && kindOf(offer), S = kind && specOf(kind);
  if (!offer || offer.now || offer.kind === 'pet' || this._mount || this.entering || !S || !S.two || !this.onFoot) return enter.call(this, offer, traffic);
  const src = srcOf(offer), F = this.foot;
  const hx = src.hx ?? Math.cos(src.th), hz = src.hz ?? Math.sin(src.th), W = (S.W || 0.7)/2 + 0.42;
  // left of the machine is (hz, -hx), right is (-hz, hx); nearer side first
  const sides = [-1, 1].map(s => ({ s, x: src.x - hz*W*s - hx*0.15, z: src.z + hx*W*s - hz*0.15 }));
  sides.sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z));
  const side = sides.find(q => free(this, traffic, q.x, q.z, src));
  const rider = offer.kind === 'traffic';
  if (rider) { offer.o.v = 0; offer.o.argue = 6; }
  this._mount = { offer, traffic, src, hx, hz, side, t: 0, phase: side ? 'walk' : 'hop', seatY: (src.y || 0) + (/bike|bullet|superbike/.test(kind) ? 0.82 : 0.72), rider };
  if (side) { this.frozen = true; this.puppet = { x: side.x, z: side.z, face: Math.atan2(hz, hx) }; }
  this.busy = 3;
  return;
};

function finish(P) {
  const M = P._mount; P._mount = null; P.frozen = false; P.puppet = null;
  if (P.act && P.act.kind === 'mount') P.act = null;
  const o = M.offer; o.now = true;
  enter.call(P, o, M.traffic);
}

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), M = this._mount;
  if (!M || !this.onFoot) return out;
  const F = this.foot, H = this.human; M.t += dt;
  // knocked about on the way: you don't get on
  if (this.downT > 0 || this.ko || (this.act && this.act.kind === 'hurt')) { this._mount = null; this.frozen = false; this.puppet = null; this.busy = 0; return out; }
  const seatX = M.src.x - M.hx*0.15, seatZ = M.src.z - M.hz*0.15, face = Math.atan2(M.hz, M.hx);
  if (M.phase === 'walk') {
    const near = M.side && Math.hypot(F.x - M.side.x, F.z - M.side.z) < 0.35;
    if (near || M.t > 2.4) {
      this.puppet = null; F.yaw = face; M.t = 0;
      M.phase = M.rider ? 'push' : 'mount';
      this.act = { kind: 'mount', t: 0 };
      if (M.rider) { F.yaw = Math.atan2(M.src.z - F.z, M.src.x - F.x); H.play('push', { once: true, fade: 0.1, restart: true, speed: 1.2 }); }
      else H.play('idle', { fade: 0.15 });
    }
  } else if (M.phase === 'push') {
    // shoved off: they go down on the far side (people/fight.js bail via pilot.enter)
    if (M.t > 0.35 && !M.offer.dragged) { M.offer.dragged = true; this.audio?.thud?.(0.4); }
    if (M.t > 0.7) { M.phase = 'mount'; M.t = 0; F.yaw = face; H.play('idle', { fade: 0.15 }); }
  } else if (M.phase === 'mount') {
    // leg over: the leg on the machine's side comes up behind, over the seat and down on the far side
    const T = 0.7, k = M.t/T, leg = M.side.s < 0 ? 'r' : 'l';
    F.yaw = face;
    F.x += (seatX - F.x)*Math.min(1, dt*3*sm(k)); F.z += (seatZ - F.z)*Math.min(1, dt*3*sm(k));
    H.holder.position.set(F.x, F.y, F.z); H.holder.rotation.set(0, -F.yaw, 0);
    const hip = H.root.getObjectByName('thigh_' + leg), ft = H.root.getObjectByName('foot_' + leg);
    if (hip && ft) {
      H.root.updateMatrixWorld(true);
      hip.getWorldPosition(_a); ft.getWorldPosition(_b);
      const sx = -M.hz*M.side.s, sz = M.hx*M.side.s;           // towards the machine
      _c.set(seatX - M.hx*0.45, M.seatY + 0.45, seatZ - M.hz*0.45);                         // up behind the seat
      _f.set(seatX + sx*0.32, M.seatY - 0.35, seatZ + sz*0.32);                             // down on the far side
      const m = 1 - k;
      _t.set(_b.x*m*m + 2*_c.x*m*k + _f.x*k*k, _b.y*m*m + 2*_c.y*m*k + _f.y*k*k, _b.z*m*m + 2*_c.z*m*k + _f.z*k*k);
      _pole.set(M.hx, 0.4, M.hz);
      ikLeg(H, leg, _t, _pole, Math.min(1, k*4, (1 - k)*6 + 0.2));
    }
    if (M.t >= T) finish(this);
  } else if (M.phase === 'hop') {
    // no room either side: a hop, up and on
    if (M.t < dt*1.5) { this.act = { kind: 'mount', t: 0 }; H.play('jump_start', { once: true, fade: 0.08, restart: true }); M.x0 = F.x; M.z0 = F.z; }
    const T = 0.5, k = sm(M.t/T);
    F.x = M.x0 + (seatX - M.x0)*k; F.z = M.z0 + (seatZ - M.z0)*k; F.yaw = face;
    H.holder.position.set(F.x, F.y + Math.sin(Math.PI*Math.min(1, M.t/T))*0.55, F.z); H.holder.rotation.set(0, -F.yaw, 0);
    if (M.t >= T) finish(this);
  }
  return out;
};
