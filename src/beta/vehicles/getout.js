// Getting out, and into the open ones, the way each one is done. Off a two-wheeler: the leg comes back over the
// seat and you step off. Out of a car: you come out of the door bent, and straighten up outside it. Out of an
// auto: a duck under the roof and out of the side. Down off a tempo or a bus: a step down. And into an auto,
// a tempo or a bus: up to the side you're nearer, a duck in (a step up for the big ones), sat down.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { specOf } from '@orig/vehicles/vehicle.js';
import { bendBone } from '@orig/people/humans.js';
import { ikLeg } from '../game/fists.js';
import { free } from './mount.js';

const CAR = new Set(['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super']);
const BIG = new Set(['bus', 'tempo', 'truck']);
const _t = new THREE.Vector3(), _a = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _pole = new THREE.Vector3(), _r = new THREE.Vector3();
const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const kindOfVeh = (P, v) => v === P.auto ? 'auto' : v.type;
const styleOf = (k) => { const S = specOf(k); return S && S.two ? 'two' : k === 'auto' ? 'auto' : CAR.has(k) ? 'car' : BIG.has(k) ? 'step' : null; };

const exit = Pilot.prototype.exit;
Pilot.prototype.exit = function (traffic, force = false) {
  const veh = this.cur, was = this.onFoot;
  const out = exit.call(this, traffic, force);
  if (was || !this.onFoot || force || !veh) return out;
  const st = styleOf(kindOfVeh(this, veh)); if (!st) return out;
  const F = this.foot, hx = Math.cos(veh.th), hz = Math.sin(veh.th);
  const ex = F.x, ez = F.z, ox = ex - veh.x, oz = ez - veh.z, od = Math.hypot(ox, oz) || 1;
  // where you start: on the seat (two-wheelers), in the doorway, under the roof, up on the step
  const inn = st === 'two' ? od : st === 'car' ? 0.5 : st === 'auto' ? 0.55 : 0.35;
  const sx = ex - ox/od*inn - (st === 'two' ? hx*0.15 : 0), sz = ez - oz/od*inn - (st === 'two' ? hz*0.15 : 0);
  this._out = { st, t: 0, T: st === 'two' ? 0.75 : st === 'car' ? 0.7 : st === 'auto' ? 0.55 : 0.45, sx, sz, ex, ez, y0: F.y, hx, hz, seatY: (veh.y || 0) + 0.8, leg: null };
  F.x = sx; F.z = sz;
  this.frozen = true; this.act = { kind: 'getout', t: 0 };
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
  const fwd = st === 'step' ? (S.L || 4)/2 - 1.2 : 0;           // a bus or tempo: by the front
  const sides = [1, -1].map(s => ({ s, x: src.x + hx*fwd - hz*W*s, z: src.z + hz*fwd + hx*W*s }));
  sides.sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z));
  const side = sides.find(q => free(this, traffic, q.x, q.z, src));
  if (!side) return enter.call(this, offer, traffic);
  if (offer.kind === 'traffic') { offer.o.v = 0; offer.o.argue = 4; }
  this._in = { offer, traffic, src, st, side, t: 0, phase: 'walk', max: Math.hypot(side.x - F.x, side.z - F.z)/1.5 + 0.6, y0: F.y };
  this.frozen = true; this.puppet = { x: side.x, z: side.z }; this.busy = 3;
};

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
    if (O.st === 'car') bent(H, rx, rz, 0.75*(1 - sm(k*1.4)));
    else if (O.st === 'auto') bent(H, rx, rz, 0.55*(1 - sm(k*1.3)));
    else if (O.st === 'two') {
      // the leg on the far side comes back over the seat behind you
      const leg = 'r', hip = H.root.getObjectByName('thigh_' + leg), ft = H.root.getObjectByName('foot_' + leg);
      if (hip && ft) {
        H.root.updateMatrixWorld(true);
        if (!O.leg) { ft.getWorldPosition(_a); O.leg = _a.clone(); }
        _c.set(O.sx - O.hx*0.45, O.seatY + 0.45, O.sz - O.hz*0.45);
        _f.set(O.ex + (O.ex - O.sx)*0.1, O.y0 + 0.08, O.ez + (O.ez - O.sz)*0.1);
        const m = 1 - k, b = O.leg;
        _t.set(b.x*m*m + 2*_c.x*m*k + _f.x*k*k, b.y*m*m + 2*_c.y*m*k + _f.y*k*k, b.z*m*m + 2*_c.z*m*k + _f.z*k*k);
        _pole.set(Math.cos(F.yaw), 0.4, Math.sin(F.yaw));
        ikLeg(H, leg, _t, _pole, Math.min(1, (1 - k)*5));
      }
    }
    if (k >= 1) { F.x = O.ex; F.z = O.ez; F.y = O.y0; this._out = null; this.frozen = false; if (this.act && this.act.kind === 'getout') this.act = null; }
  }
  if (I) {
    I.t += dt;
    const src = I.src;
    if (I.phase === 'walk') {
      if (Math.hypot(F.x - I.side.x, F.z - I.side.z) < 0.35 || I.t > I.max) {
        I.phase = 'in'; I.t = 0; this.puppet = null; this.act = { kind: 'getin', t: 0 };
        I.sx = F.x; I.sz = F.z; F.yaw = Math.atan2(src.z - F.z, src.x - F.x);
        H.play('idle', { fade: 0.12 });
      }
    } else {
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
