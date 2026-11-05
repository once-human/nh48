// Getting out, and into the open ones, the way each one is done. Off a two-wheeler: the leg comes back over the
// seat and you step off. Out of a car: you come out of the door bent, and straighten up outside it. Out of an
// auto: a duck under the roof and out of the side. Down off a tempo or a bus: a step down. And into an auto,
// a tempo or a bus: up to the side you're nearer, a duck in (a step up for the big ones), sat down.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { specOf } from '@orig/vehicles/vehicle.js';
import { bendBone } from '@orig/people/humans.js';
import { ikLeg } from '../game/fists.js';
import { free, frameOf, seg, bez, torso } from './mount.js';
import { ikArm } from '@orig/people/humans.js';
import { reachLean, grip as close } from './fit.js';
import { frameOf as carFrame, stoop, put, originFor, feetDown } from './cardoor.js';

const CAR = new Set(['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super']);
const BIG = new Set(['bus', 'tempo', 'truck']);
const _t = new THREE.Vector3(), _a = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _pole = new THREE.Vector3(), _r = new THREE.Vector3();
const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const kindOfVeh = (P, v) => v === P.auto ? 'auto' : v.type;
// (cars: out through their own door, vehicles/cardoor.js)
const styleOf = (k) => { const S = specOf(k); return S && S.two ? 'two' : k === 'auto' ? 'auto' : CAR.has(k) ? null : BIG.has(k) ? 'step' : null; };

const exit = Pilot.prototype.exit;
Pilot.prototype.exit = function (traffic, force = false) {
  const veh = this.cur, was = this.onFoot;
  const out = exit.call(this, traffic, force);
  if (was || !this.onFoot || force || !veh) return out;
  const st = styleOf(kindOfVeh(this, veh)); if (!st) return out;
  const F = this.foot, hx = Math.cos(veh.th), hz = Math.sin(veh.th);
  // off a bus: down the front steps on the left, where the door is (not through the driver's side)
  if (veh.type === 'bus') { const sx = veh.x + hx*(11.4/2 - 0.71) + hz*(2.55/2 + 0.55), sz = veh.z + hz*(11.4/2 - 0.71) - hx*(2.55/2 + 0.55); F.x = sx; F.z = sz; F.yaw = Math.atan2(-hx, hz); }
  const ex = F.x, ez = F.z, ox = ex - veh.x, oz = ez - veh.z, od = Math.hypot(ox, oz) || 1;
  // where you start: on the seat (two-wheelers), in the doorway, under the roof, up on the step
  const inn = st === 'two' ? od : st === 'car' ? 0.5 : st === 'auto' ? 0.55 : 0.35;
  const sx = ex - ox/od*inn - (st === 'two' ? hx*0.15 : 0), sz = ez - oz/od*inn - (st === 'two' ? hz*0.15 : 0);
  this._out = { veh, kind: kindOfVeh(this, veh), st, t: 0, T: st === 'two' ? 1.15 : st === 'auto' ? 1.9 : 0.45, sx, sz, ex, ez, y0: F.y, hx, hz, seatY: (veh.y || 0) + 0.8, leg: null };
  F.x = sx; F.z = sz;
  this.frozen = true; this.act = { kind: 'getout', t: 0 };
  if ((st === 'two' || st === 'auto') && this.human) this.human.play('drive', { fade: 0 });
  return out;
};

// into the open ones
const enter = Pilot.prototype.enter;
const kindOf = (o) => o.kind === 'traffic' ? o.o.type : o.kind === 'parked' ? o.r.kind : o.kind === 'dropped' ? (o.d.veh.type || 'auto') : o.kind === 'service' ? o.sv.veh.type : null;
const srcOf = (o) => o.kind === 'traffic' ? o.o : o.kind === 'parked' ? o.r : o.kind === 'dropped' ? o.d.veh : o.kind === 'service' ? o.sv.veh : null;
Pilot.prototype.enter = function (offer, traffic) {
  const k = offer && offer.kind !== 'pet' && kindOf(offer), st = k && styleOf(k);
  if (!offer || offer.now || this._in || this.entering || this._mount || !this.onFoot || (st !== 'auto' && st !== 'step')) return enter.call(this, offer, traffic);
  const src = srcOf(offer), F = this.foot, S = specOf(k) || {};
  const hx = src.hx ?? Math.cos(src.th), hz = src.hz ?? Math.sin(src.th), W = (S.W || 1.4)/2 + 0.45;
  const fwd = st === 'step' ? (S.L || 4)/2 - 1.2 : st === 'auto' ? AUTO_SEAT[0] - 0.35 : 0;           // a bus or tempo: by the front; an auto: by its seat
  const bus = k === 'bus', fw = bus ? 11.4/2 - 0.71 : fwd;
  const sides = (bus ? [-1] : [1, -1]).map(s => ({ s, x: src.x + hx*fw - hz*W*s, z: src.z + hz*fw + hx*W*s }));     // (a bus: its front door, on the left)
  sides.sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z));
  const side = sides.find(q => free(this, traffic, q.x, q.z, src));
  if (!side) return enter.call(this, offer, traffic);
  if (offer.kind === 'traffic') { offer.o.v = 0; offer.o.argue = 4; }
  this._in = { offer, traffic, src, st, side, t: 0, phase: 'walk', max: Math.hypot(side.x - F.x, side.z - F.z)/1.5 + 0.6, y0: F.y };
  this.frozen = true; this.puppet = { x: side.x, z: side.z }; this.busy = 3;
};

// An auto: no door, a low roof. In: your back to the seat at the side opening, a duck under the roof's edge and down
// onto the seat, then round to face the handlebar with the legs coming in over the floor's edge. Out the same way
// back: round to the side, the feet out onto the road, up off the seat under the roof and a step clear.
const AUTO_SEAT = [0.36, 0.8, 0], HIP_FWD = 0.33;
const _h = new THREE.Vector3(), _o = new THREE.Vector3(), _w = new THREE.Vector3();
function autoIn(P, I) {
  const F = P.foot, H = P.human, src = I.src, Fr = carFrame(src), s = I.side.s, t = I.t, ground = I.y0;
  const fwd = Math.atan2(Fr.hz, Fr.hx), out = Math.atan2(s*Fr.hx, -s*Fr.hz);
  const hipSeat = Fr.at(AUTO_SEAT[0] - 0.05 - HIP_FWD + 0.02, AUTO_SEAT[1] - 0.04, 0, new THREE.Vector3());
  const hipSide = Fr.at(AUTO_SEAT[0] - 0.05 - HIP_FWD + 0.02, AUTO_SEAT[1] - 0.04, s*0.22, new THREE.Vector3());
  if (I.phase === 'turn') {
    // your back to the opening by the seat, a half step in
    const k = sm(t/0.35), to = Fr.at(AUTO_SEAT[0] - 0.35, 0, s*0.95, _o);
    F.x = I.sx + (to.x - I.sx)*k; F.z = I.sz + (to.z - I.sz)*k;
    F.yaw = I.yaw0 + Math.atan2(Math.sin(out - I.yaw0), Math.cos(out - I.yaw0))*k;
    put(H, _w.set(F.x, ground, F.z), F.yaw);
    if (t >= 0.35) { I.phase = 'sit'; I.t = 0; I.p0 = new THREE.Vector3(F.x, ground, F.z); H.play('sit_enter', { once: true, restart: true, fade: 0.15, speed: 1.35 }); }
    return;
  }
  if (I.phase === 'sit') {
    // down and back onto the seat, ducked under the roof
    const k = sm((t - 0.12)/0.62), end = originFor(hipSide, out, _o);
    _w.set(I.p0.x + (end.x - I.p0.x)*k, I.p0.y + (end.y - I.p0.y)*k, I.p0.z + (end.z - I.p0.z)*k);
    put(H, _w, out);
    stoop(H, -Math.sin(out), Math.cos(out), 0.5*Math.sin(Math.PI*Math.min(1, Math.max(0, t/0.95))));
    feetDown(H, out, ground, k);
    if (t >= 0.95) { I.phase = 'legs'; I.t = 0; H.play('drive', { fade: 0.45 }); I.feet = null; }
    return;
  }
  if (I.phase === 'legs') {
    // round to the handlebar, the feet up over the floor's edge and in
    const T = 0.6, k = sm(t/T), yaw = out + Math.atan2(Math.sin(fwd - out), Math.cos(fwd - out))*k;
    if (!I.feet) { I.feet = {}; for (const f of ['l', 'r']) { const b = H.root.getObjectByName('foot_' + f); if (b) I.feet[f] = b.getWorldPosition(new THREE.Vector3()); } }
    _h.lerpVectors(hipSide, hipSeat, k);
    put(H, originFor(_h, yaw, _o), yaw);
    for (const f of ['l', 'r']) {
      if (!I.feet[f]) continue;
      const well = Fr.at(AUTO_SEAT[0] + 0.32, 0.36, f === 'l' ? -0.13 : 0.13, _w);
      _t.lerpVectors(I.feet[f], well, k); _t.y += Math.sin(Math.PI*k)*0.32;
      ikLeg(H, f, _t, _pole.set(Math.cos(yaw), 0.4, Math.sin(yaw)), 1 - sm((t - 0.35)/(T - 0.35)));
    }
    if (t >= T) {
      const keep = H.holder.position.clone(), o = I.offer;
      P._in = null; P.frozen = false; P.puppet = null;
      if (P.act && P.act.kind === 'getin') P.act = null;
      F.y = I.y0; o.now = true; P.enter(o, I.traffic);
      if (!P.onFoot) P._settle = { from: keep, t0: performance.now() };
    }
  }
}
function autoOut(P, O) {
  const F = P.foot, H = P.human, V = O.veh, Fr = carFrame(V), t = O.t, ground = O.y0;
  if (!O.s) O.s = Math.sign((O.ex - V.x)*-Fr.hz + (O.ez - V.z)*Fr.hx) || 1;
  const s = O.s, fwd = Math.atan2(Fr.hz, Fr.hx), out = Math.atan2(s*Fr.hx, -s*Fr.hz);
  const hipSeat = Fr.at(AUTO_SEAT[0] - 0.05 - HIP_FWD + 0.02, AUTO_SEAT[1] - 0.04, 0, new THREE.Vector3());
  const hipSide = Fr.at(AUTO_SEAT[0] - 0.05 - HIP_FWD + 0.02, AUTO_SEAT[1] - 0.04, s*0.22, new THREE.Vector3());
  const stand = Fr.at(AUTO_SEAT[0] - 0.35, 0, s*0.98, new THREE.Vector3()); stand.y = ground;
  F.x = stand.x; F.z = stand.z;
  if (t < 0.6) {
    // round on the seat, the feet out over the edge to the road
    const k = sm(t/0.6), yaw = fwd + Math.atan2(Math.sin(out - fwd), Math.cos(out - fwd))*k;
    if (!O.sat) { O.sat = true; H.play('sit', { fade: 0.4 }); }
    _h.lerpVectors(hipSeat, hipSide, k);
    put(H, originFor(_h, yaw, _o), yaw);
    for (const f of ['l', 'r']) {
      const well = Fr.at(AUTO_SEAT[0] + 0.32, 0.36, f === 'l' ? -0.13 : 0.13, _w).clone();
      const road = Fr.at(AUTO_SEAT[0] - 0.37 + (f === 'l' ? 0.12 : -0.12)*s, 0.085, s*0.62, _o);
      _t.lerpVectors(well, road, k); _t.y += Math.sin(Math.PI*k)*0.3;
      ikLeg(H, f, _t, _pole.set(Math.cos(yaw), 0.4, Math.sin(yaw)), Math.min(1, k*3));
    }
    return;
  }
  if (t < 1.5) {
    // up off the seat, ducked under the roof, out from under it
    if (!O.rose) { O.rose = true; H.play('sit_exit', { once: true, restart: true, fade: 0.2, speed: 1.15 }); O.o0 = originFor(hipSide, out, new THREE.Vector3()); }
    const u = t - 0.6, k = sm((u - 0.05)/0.7);
    _w.set(O.o0.x + (stand.x - O.o0.x)*k, O.o0.y + (ground - O.o0.y)*k, O.o0.z + (stand.z - O.o0.z)*k);
    put(H, _w, out);
    stoop(H, -Math.sin(out), Math.cos(out), 0.5*Math.sin(Math.PI*Math.min(1, u/0.85)));
    feetDown(H, out, ground, 1 - k);
    return;
  }
  // a step clear
  if (!O.walked) { O.walked = true; H.play('walk', { speed: 0.75, fade: 0.25 }); }
  const k = sm((t - 1.5)/0.4);
  F.x = stand.x + (O.ex - stand.x)*k; F.z = stand.z + (O.ez - stand.z)*k; F.y = ground;
  put(H, _w.set(F.x, ground, F.z), out);
  if (t >= O.T - 0.02) H.play('idle', { fade: 0.25 });
}

function bent(H, rx, rz, a) {
  if (!H || Math.abs(a) < 0.01) return;
  _r.set(rx, 0, rz);
  H.root.updateMatrixWorld(true);
  const s1 = H.root.getObjectByName('spine_01'), s3 = H.root.getObjectByName('spine_03'), nk = H.root.getObjectByName('neck_01');
  if (s1) bendBone(s1, _r, -a*0.6);
  if (s3) bendBone(s3, _r, -a*0.3);
  if (nk) bendBone(nk, _r, a*0.25);       // eyes stay up
}

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), F = this.foot, H = this.human;
  const O = this._out, I = this._in;
  if ((O || I) && (this.downT > 0 || this.ko || (this.act && this.act.kind === 'hurt'))) {
    if (O) { F.x = O.ex; F.z = O.ez; F.y = O.y0; }
    this._out = this._in = null; this.frozen = false; this.puppet = null; return out;
  }
  if (O) {
    O.t += dt;
    const k = Math.min(1, O.t/O.T), e = sm(k);
    F.x = O.sx + (O.ex - O.sx)*e; F.z = O.sz + (O.ez - O.sz)*e;
    let y = O.y0;
    if (O.st === 'step') y = O.y0 + 0.38*(1 - e) + Math.sin(Math.PI*k)*0.06;
    H.holder.position.set(F.x, y, F.z); H.holder.rotation.set(0, -F.yaw, 0);
    const rx = -Math.sin(F.yaw), rz = Math.cos(F.yaw);        // (right of where you face: the bend is about it)
    if (O.st === 'auto') autoOut(this, O);
    else if (O.st === 'two') {
      // from the seat: the left foot down to the road, up off the seat onto it, the right leg back over behind you,
      // and you stand beside it (the reverse of getting on, mount.js)
      const Fr = frameOf(O.veh, O.kind), t = O.t, scoot = !/bike|bullet|superbike/.test(O.kind);
      // which side you get off: the side the game put you out on (-1 its left)
      if (!O.side) {
        O.side = Math.sign((O.ex - O.veh.x)*Fr.rx + (O.ez - O.veh.z)*Fr.rz) || -1;
        // and you end up standing just beside it, over the foot you put down, not a stride off
        const end = Fr.at(Fr.hip[0] + 0.02, 0, O.side*0.52, new THREE.Vector3());
        if (free(this, null, end.x, end.z, O.veh)) { O.ex = end.x; O.ez = end.z; }
      }
      const side = O.side, outLeg = side < 0 ? 'l' : 'r', inLeg = side < 0 ? 'r' : 'l';
      // the foot down to the road; up off the seat onto it; the other leg across (forward through the floorboard on a
      // scooter, back over the seat on a motorcycle) and down beside it; the hands let go last
      const down = seg(t, 0, 0.3), rise = seg(t, 0.22, scoot ? 0.62 : 0.55), over = seg(t, scoot ? 0.35 : 0.4, scoot ? 0.8 : 0.9), done = seg(t, 0.88, 1.15);
      if (!O.stood && t > (scoot ? 0.4 : 0.45)) { O.stood = true; H.play('idle', { fade: 0.4 }); }
      // the body: across over the planted foot as it stands (on a motorcycle most of the way before the leg comes over)
      const seat = Fr.at(Fr.sx, Fr.seatY - 0.62, 0, _c), sy = seat.y;
      const acr = scoot ? sm(rise*0.5 + over*0.5) : sm(rise*0.7 + over*0.3);
      const bx = seat.x + (O.ex - seat.x)*acr, bz = seat.z + (O.ez - seat.z)*acr;
      const by = sy + (O.y0 - sy)*rise + Math.sin(Math.PI*rise)*0.03;
      F.x = bx; F.z = bz;
      H.holder.position.set(bx, by, bz); H.holder.rotation.set(0, -F.yaw, 0);
      const knee = (sd, up) => _pole.set(Fr.hx + Fr.rx*sd*0.3, up, Fr.hz + Fr.rz*sd*0.3);
      H.root.updateMatrixWorld(true);
      // the foot that goes down first: off its floorboard / peg, out and down to the road just beside it
      if (!O.peg) O.peg = Fr.at(Fr.foot[0], Fr.foot[1], side*Fr.foot[2], new THREE.Vector3());
      const plant = Fr.at(Fr.hip[0] + 0.1, 0.085, side*0.4, _f);
      const pk = down, pup = Math.sin(Math.PI*pk)*0.06;
      _t.copy(O.peg).lerp(plant, pk); _t.y += pup;
      ikLeg(H, outLeg, _t, knee(side, 0.25), 1 - done);
      // the other leg, from its own floorboard / peg
      if (!O.leg) O.leg = Fr.at(Fr.foot[0], Fr.foot[1], -side*Fr.foot[2], new THREE.Vector3());
      const via = scoot ? Fr.at(Fr.foot[0] - 0.04, Fr.foot[1] + 0.26, side*0.04, new THREE.Vector3()) : Fr.at(Fr.hip[0] - 0.42, Fr.top + 0.16, 0, new THREE.Vector3());
      const land = Fr.at(Fr.hip[0] + (scoot ? 0.18 : -0.12), 0.085, side*0.66, new THREE.Vector3());
      bez(_t, O.leg, via, land, over);
      ikLeg(H, inLeg, _t, knee(-side, scoot ? 0.7 : 0.2), 1 - done);
      // a motorcycle: lean over the tank as the leg comes over the back
      torso(H, 0, (scoot ? 0.1 : 0.4)*Math.sin(Math.PI*over), Fr.rx, Fr.rz);
      const hold = 1 - seg(t, scoot ? 0.6 : 0.75, scoot ? 0.9 : 1.0);
      const wr = [Fr.at(Fr.bar, Fr.barY, -Fr.barW, new THREE.Vector3()), Fr.at(Fr.bar, Fr.barY, Fr.barW, new THREE.Vector3())];
      // the far hand comes off as you stand; the near one stays on its grip till the leg's across
      const near = wr[side > 0 ? 1 : 0];
      if (hold > 0) reachLean(H, _r.set(Fr.rx, 0, Fr.rz), rise < 0.5 ? wr : [near, near], hold*(1 - rise*0.5));
      for (const hs of ['l', 'r']) {
        const sd = hs === 'l' ? -1 : 1, w = sd === side ? hold : 1 - rise;
        _pole.set(-Fr.hx*0.25 + Fr.rx*sd*0.8, -0.7, -Fr.hz*0.25 + Fr.rz*sd*0.8);
        ikArm(H, hs, wr[sd > 0 ? 1 : 0], _pole, w);
        close(H, hs, w);
      }
    }
    if (k >= 1) { F.x = O.ex; F.z = O.ez; F.y = O.y0; this._out = null; this.frozen = false; if (this.act && this.act.kind === 'getout') this.act = null; }
  }
  if (I) {
    I.t += dt;
    const src = I.src;
    if (I.phase === 'walk') {
      if (Math.hypot(F.x - I.side.x, F.z - I.side.z) < 0.35 || I.t > I.max) {
        I.phase = I.st === 'auto' ? 'turn' : 'in'; I.t = 0; this.puppet = null; this.act = { kind: 'getin', t: 0 };
        I.sx = F.x; I.sz = F.z; I.yaw0 = F.yaw; if (I.st !== 'auto') F.yaw = Math.atan2(src.z - F.z, src.x - F.x);
        H.play('idle', { fade: 0.12 });
      }
    } else if (I.st === 'auto') autoIn(this, I);
    else {
      const T = I.st === 'step' ? 0.55 : 0.5, k = Math.min(1, I.t/T), e = sm(k);
      const tx = I.sx + (src.x - I.sx)*0.45, tz = I.sz + (src.z - I.sz)*0.45;
      F.x = I.sx + (tx - I.sx)*e; F.z = I.sz + (tz - I.sz)*e;
      const y = I.st === 'step' ? I.y0 + 0.38*e + Math.sin(Math.PI*k)*0.06 : I.y0;
      H.holder.position.set(F.x, y, F.z); H.holder.rotation.set(0, -F.yaw, 0);
      const rx = -Math.sin(F.yaw), rz = Math.cos(F.yaw);
      bent(H, rx, rz, (I.st === 'auto' ? 0.6 : 0.25)*Math.sin(Math.PI*Math.min(1, k*1.1)));
      if (k >= 1) {
        const o = I.offer; this._in = null; this.frozen = false; this.puppet = null;
        if (this.act && this.act.kind === 'getin') this.act = null;
        F.y = I.y0; o.now = true; this.enter(o, I.traffic);
      }
    }
  }
  return out;
};
