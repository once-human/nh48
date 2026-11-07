// Taking an auto, a tempo or a bus off someone who's driving it. It used to swap on the spot: you were in, they were on
// the road. Now you go to them first. An auto's open at the side: you step up beside the driver, take them by the shirt
// with both hands and haul them out past you onto the road. A tempo's cab and a bus's driver's door are on the right,
// up high on a bus: you reach in (up, on the bus), get hold of them and drag them down and out. They land beside you;
// then you get in. (Cars have their own door to open and the driver to haul out: beta/vehicles/cardoor.js. Two-wheelers,
// a shove: beta/vehicles/mount.js, whose same swap this uses, so the one who lands is the one who was driving. Loaded
// after beta/vehicles/getout.js, whose way in follows.)
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { specOf } from '@orig/vehicles/vehicle.js';
import { ikArm } from '@orig/people/humans.js';
import { free, torso, seg, sm } from './mount.js';
import { routeTo, setRoute, follow, walkTime, tooFar, calledOff } from './route.js';
import { baseOf } from './models.js';

const _c = new THREE.Vector3(), _t = new THREE.Vector3(), _h = new THREE.Vector3(), _p = new THREE.Vector3();
// where the driver is (along it from the middle, up, out to the right), and how far out from the side you stand
function cabOf(kind) {
  const b = baseOf(kind), S = specOf(kind) || {};
  if (b === 'auto') return { f: 0.22, up: 1.08, r: 0, out: (S.W || 1.4)/2 + 0.38, both: true };
  if (b === 'tempo') return { f: 1.05, up: 1.3, r: 0.32, out: (S.W || 1.7)/2 + 0.42 };
  if (b === 'bus') return { f: (S.L || 11.4)/2 - 1.0, up: 1.95, r: 0.75, out: (S.W || 2.55)/2 + 0.48, high: true };
  return null;
}
const enter = Pilot.prototype.enter;
Pilot.prototype.enter = function (offer, traffic) {
  const kind = offer && offer.kind === 'traffic' && offer.o && offer.o.type, cab = kind && cabOf(kind);
  if (!cab || offer.now || this._haul || this._mount || this.entering || !this.onFoot) return enter.call(this, offer, traffic);
  const o = offer.o, F = this.foot, hx = o.hx ?? Math.cos(o.th), hz = o.hz ?? Math.sin(o.th), rx = -hz, rz = hx;
  // the right side (the driver's), or an auto's left if that's the one you can stand at
  const sides = (cab.both ? [1, -1] : [1]).map(s => ({ s, x: o.x + hx*cab.f + rx*s*cab.out, z: o.z + hz*cab.f + rz*s*cab.out }));
  if (cab.both) sides.sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z));
  const side = sides.find(q => free(this, traffic, q.x, q.z, o));
  if (!side) return enter.call(this, offer, traffic);
  o.v = 0; o.argue = 6;
  const M = this._haul = { offer, traffic, o, kind, cab, side, t: 0, phase: 'walk' };
  M.max = walkTime(M, setRoute(this, M, routeTo(this, traffic, o, o.T || specOf(kind), side), { x: side.x, z: side.z, face: Math.atan2(-rz*side.s, -rx*side.s) }));
  this.frozen = true; this.busy = 4;
};
function done(P, go) {
  const M = P._haul; P._haul = null; P.frozen = false; P.puppet = null; P.busy = 0;
  if (P.act && P.act.kind === 'haul') P.act = null;
  // in, the way you get into one (beta/vehicles/getout.js: up the step, onto the seat)
  if (go && M.d) P.enter({ kind: 'dropped', d: M.d, label: '' }, M.traffic);
}
const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), M = this._haul;
  if (!M || !this.onFoot) return out;
  const F = this.foot, H = this.human; M.t += dt;
  if (this.downT > 0 || this.ko || (this.act && this.act.kind === 'hurt')) { done(this, false); return out; }
  const o = M.d ? M.d.veh : M.o, s = M.side.s;
  const hx = o.hx ?? Math.cos(o.th), hz = o.hz ?? Math.sin(o.th), rx = -hz, rz = hx, oy = o.y || 0;
  if (!M.d) { M.o.v = 0; M.o.argue = Math.max(M.o.argue || 0, 3); }
  if (M.phase === 'walk') {
    follow(this, M);
    const there = Math.hypot(F.x - M.side.x, F.z - M.side.z) < 0.3;
    if (calledOff(this, M) || (!there && M.t > M.max && tooFar(this, M.side))) { done(this, false); return out; }
    if (there || M.t > M.max) {
      this.puppet = null; M.t = 0; M.phase = 'grab'; M.x0 = F.x; M.z0 = F.z; M.yaw0 = F.yaw;
      this.act = { kind: 'haul', t: 0 }; H && H.play('idle', { fade: 0.2 });
    }
    return out;
  }
  if (!H) { done(this, false); return out; }
  // the driver's chest, and the way out (from the cab towards you)
  _c.set(o.x + hx*M.cab.f + rx*s*M.cab.r*0.6, oy + M.cab.up, o.z + hz*M.cab.f + rz*s*M.cab.r*0.6);
  const ox = rx*s, oz = rz*s;
  const want = Math.atan2(_c.z - F.z, _c.x - F.x);
  if (M.phase === 'grab') {
    // square up to them and reach in (up into the cab on a bus), both hands on their shirt
    const t = M.t, k = seg(t, 0, 0.42);
    F.yaw = M.yaw0 + Math.atan2(Math.sin(want - M.yaw0), Math.cos(want - M.yaw0))*seg(t, 0, 0.2);
    const step = 0.18*k;                                       // a step in to them
    F.x = M.x0 - ox*step; F.z = M.z0 - oz*step;
    H.holder.position.set(F.x, F.y, F.z); H.holder.rotation.set(0, -F.yaw, 0);
    const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw), frx = -fz, frz = fx;
    torso(H, 0, (M.cab.high ? -0.1 : 0.25)*k, frx, frz);
    for (const sd of [1, -1]) {
      _t.copy(_c).addScaledVector(_p.set(frx, 0, frz), sd*0.12).addScaledVector(_p.set(ox, 0, oz), 0.1);
      ikArm(H, sd > 0 ? 'r' : 'l', _t, _h.set(frx*sd*0.7, -1, frz*sd*0.7), k);
    }
    if (t >= 0.45) { M.phase = 'yank'; M.t = 0; M.x1 = F.x; M.z1 = F.z; }
    return out;
  }
  if (M.phase === 'yank') {
    // a heave back with the whole body, turning out of it, and they come out past you onto the road
    const t = M.t, T = 0.75, k = seg(t, 0, 0.45), back = seg(t, 0.05, 0.5), rel = seg(t, 0.45, T);
    const step = 0.35*back;
    F.x = M.x1 + ox*step; F.z = M.z1 + oz*step;
    F.yaw = want;
    H.holder.position.set(F.x, F.y, F.z); H.holder.rotation.set(0, -F.yaw, 0);
    const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw), frx = -fz, frz = fx;
    torso(H, 0.55*k*(1 - rel)*s, (-0.25*k + (M.cab.high ? -0.1 : 0.2)*(1 - k))*(1 - rel), frx, frz);
    // the hands come with them: out of the cab, down past your hip
    _p.set(F.x + ox*0.5, oy + 0.85, F.z + oz*0.5);
    for (const sd of [1, -1]) {
      _t.lerpVectors(_c, _p, k).addScaledVector(_h.set(frx, 0, frz), sd*0.12);
      ikArm(H, sd > 0 ? 'r' : 'l', _t, _h.set(frx*sd*0.7, -1, frz*sd*0.7), 1 - rel);
    }
    if (t > 0.18 && !M.d) {
      // out they come: the same person (the auto's real rider if there was one), landing past you, away from the cab
      this.audio?.thud?.(0.5);
      const R = M.o._riders && M.o._riders[0], keep = { x: F.x, z: F.z, yaw: F.yaw, y: F.y }, offer = M.offer;
      this._jab = { o: M.o, x: F.x + ox*0.9 + hx*0.3, z: F.z + oz*0.9 + hz*0.3, look: R && R.look };
      offer.now = true; offer.dragged = true;
      try { enter.call(this, offer, M.traffic); } finally { this._jab = null; }
      const veh = this.cur;
      if (veh && !this.onFoot) {
        this.exit(M.traffic, true);
        Object.assign(F, { x: keep.x, z: keep.z, yaw: keep.yaw, y: keep.y, v: 0, vx: 0, vz: 0 });
        M.d = (this.dropped || []).find(q => q.veh === veh);
        if (!M.d) { done(this, false); return out; }
        this.act = { kind: 'haul', t: 0 }; this.frozen = true;
      } else { done(this, false); return out; }
    }
    if (t >= T) done(this, true);
    return out;
  }
  return out;
};
