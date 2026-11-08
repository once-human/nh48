// A car, an auto, a tempo or a bus that's hit hard enough goes over. It was only ever shoved: spun and slid on its
// tyres however hard the hit, and it always came to rest on its wheels. Now, when a blow leaves it going sideways
// faster than its tyres can take off it, they grip and it trips over them, as a car does: the energy left in the
// sideways part of the blow against what it takes to lift its weight over the edge it stands on (how high its weight is,
// how far it is from that edge). Short of it, it lifts onto two wheels and drops back; past it, it goes over onto its
// side; well past it, it rolls over and over, and how many times and where it ends up (on its side, on its roof, back on
// its wheels) is how the rolling goes, the road and the walls stopping it. A sideways slide into a kerb trips it far
// sooner. Each one by how it's built (beta/vehicles/bikebody.js): an auto has one wheel at the front and goes over at a
// push; a hatchback takes a hard hit from the side; a low supercar a very hard one; a bus is wide and heavy at the floor
// and all but never does. It's a solid body of its own from the moment it goes up: every corner, the roof and the
// bumpers touch the road, and where it comes down hard it's dented there (the roof crushed, a side stoved in), and
// what's on that part of it comes off (beta/vehicles/parts.js: a mirror, a door, the bonnet, a bumper). On its side or
// its roof it stays there, wrecked: nobody can drive it again, and it's never stood back up. Back on its wheels, it
// can be got into and driven away. Hit again where it lies, it moves again.
// Your own car goes the same way with you in it: you can't do anything till it stops, and if it's ended up on its side
// or its roof you climb out of it.
import * as THREE from 'three';
import { Traffic } from '@orig/traffic/traffic.js';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { Pilot } from '@orig/game/pilot.js';
import { makeBody, stepBody, lie, tipOf, edgeOf, kickBody, bodyVel, ptOf } from './bikebody.js';

const G0 = () => window.__nhAskG, now = () => performance.now()/1000;
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _u = new THREE.Vector3();
const rolling = new Set();
const OVER = 0.6;            // lying further over than this (radians from upright) is on its side or its roof

// Its velocity after a blow (vx, vz, world), its turning (w, as th turns): does it go over? trip: how much of the sideways
// speed its tyres catch (a kerb all of it; flat tar about half). Returns true when it's a body now.
export function tryRoll(v, vx, vz, w = 0, opt = {}) {
  if (!v || !v.spec || v.spec.two || v._rb || v.dead || !v.root || !v.W || (v.deck ?? -1) >= 0) return false;
  const T = tipOf(v.type), hx = Math.cos(v.th), hz = Math.sin(v.th), rx = -hz, rz = hx;
  const along = vx*hx + vz*hz, lat = vx*rx + vz*rz;
  if (Math.abs(lat) < 1.5) return false;
  const s = Math.sign(lat), E = edgeOf(T, s), h = T.h, d = E.d;
  const trip = opt.trip ?? 0.45 + Math.random()*0.25;
  const I = T.kg2 + h*h + d*d, Erot = 0.5*lat*lat*(h*h/I)*trip, Etip = 9.8*(Math.hypot(h, d) - h);
  if (Erot < Etip*0.5) return false;
  start(v, along, lat, s, E, Math.sqrt(2*Erot/I), w, opt);
  return true;
}
function start(v, along, lat, s, E, om, w, opt) {
  const hx = Math.cos(v.th), hz = Math.sin(v.th), rx = -hz, rz = hx;
  _e.set(v.lean || 0, -v.th, v.pitch || 0, 'YXZ');
  const Q0 = new THREE.Quaternion().setFromEuler(_e), oy = v.y || 0;
  // turning over the edge on that side: the top goes the way it was going
  const bx = rx*s, bz = rz*s, O = [bz*om, -w, -bx*om];
  // the edge (where the tyres caught) keeps going along, and a little of the sideways slide is still in it
  const ve = [hx*along + rx*lat*0.3, 0, hz*along + rz*lat*0.3];
  const T = tipOf(v.type), Ew = _v.set(E.x, 0, E.z).applyQuaternion(Q0), C = _u.set(T.cx, T.h, T.cz).applyQuaternion(Q0);
  const r = [C.x - Ew.x, C.y - Ew.y, C.z - Ew.z];
  const vel = [ve[0] + O[1]*r[2] - O[2]*r[1], ve[1] + O[2]*r[0] - O[0]*r[2], ve[2] + O[0]*r[1] - O[1]*r[0]];
  const B = makeBody(v.type, Q0, v.x, oy, v.z, vel, O);
  v._rb = B; v._rbMine = !!opt.mine; v._rbT = 0; v._over = false; v._c = null;
  v.v = 0; v.vl = 0; v.w = 0; v.throttle = 0;
  rolling.add(v);
  G0()?.audio?.thud?.(0.5);
}
// hit again where it lies, or while it's still going: moved on at least as fast as the blow says, and turned over by a
// hard one
export function kickRoll(v, vx, vz, w = 0) {
  const B = v._rb; if (!B) return;
  const cur = bodyVel(B), sp = Math.hypot(vx, vz); if (sp < 0.05) return;
  const ux = vx/sp, uz = vz/sp, have = cur[0]*ux + cur[2]*uz, add = Math.max(0, sp - have);
  if (add < 0.05) return;
  const tw = add > 5 ? Math.min(3, (add - 5)*0.4)*(0.6 + Math.random()*0.8) : 0;
  kickBody(B, [ux*add, add > 5 ? Math.min(1.5, (add - 5)*0.15) : 0, uz*add], [uz*tw, -w*0.5, -ux*tw]);
  rolling.add(v);
}

// a frame of it: the body on, the car drawn as it lies and known where it is to everything else
function tick(v, dt, TR) {
  const B = v._rb, W = v.W; if (!B || !W) return;
  if (!B.rest) {
    v._rbT += dt;
    stepBody(B, dt, W.surf ? (x, z) => W.surf.height(x, z) : 0, W.collision ? (x, z) => W.collision.resolve(x, z, B.rad) : null);
    _v.set(1, 0, 0).applyQuaternion(B.Q);
    if (Math.hypot(_v.x, _v.z) > 0.25) v.th = Math.atan2(_v.z, _v.x);
    v.x = B.ox; v.z = B.oz; v.y = W.surf ? W.surf.height(v.x, v.z) : B.oy;
    const bv = bodyVel(B); v.v = bv[0]*Math.cos(v.th) + bv[2]*Math.sin(v.th); v.vl = 0; v.w = 0; v.vy = 0;
    v.sync && v.sync(0);
    const st = v._st || (v._st = G0()?.player?.dropped.find(q => q.veh === v)?.st);
    if (st) { st.x = v.x; st.z = v.z; st.hx = Math.cos(v.th); st.hz = Math.sin(v.th); if (TR) TR.staticsT = 0; }
    // where it came down hard: dented there, and what's there comes off
    if (B.imp > 3.2 && B.impI >= 0 && !B.tyre[B.impI] && v.dent && !((v._dentT || 0) > now())) {
      v._dentT = now() + 0.12;
      const [lx, ly, lz] = ptOf(B, B.impI), up = _u.set(0, 1, 0).applyQuaternion(_q.copy(B.Q).invert());
      try { v.dent(lx, ly, lz, up.x, up.y, up.z, 0.6, Math.min(0.24, (B.imp - 2.6)*0.035)); } catch (e) { /* drawn as it was */ }
      if (v.wheels && B.imp > 7 && v.hurtTyre) for (const wh of v.wheels) if (Math.hypot(wh.x - lx, wh.z - lz) < 0.6) { try { v.hurtTyre(wh, 0.6); } catch (e) { /* as it is */ } }
    }
    const thump = Math.max(B.imp, B.wallHit || 0);
    if (thump > 2.5) {
      const G = G0(); G?.audio?.thud?.(Math.min(1, 0.2 + thump*0.06));
      if (v._rbMine) v.events && v.events.push({ type: 'crash', speed: thump, kind: 2, x: v.x, z: v.z });
    }
    // what it rolls into in the traffic is knocked aside, a two-wheeler over
    const sp = Math.hypot(bv[0], bv[2]);
    if (TR && sp > 2.5) TR.near(v.x, v.z, v.spec.L/2 + 2, (o) => {
      if (!o.T || o.isPlayer || o.parked || o.veh === v || o._hitT > now() || Math.hypot(o.x - v.x, o.z - v.z) > (v.spec.L + o.T.L)/2*0.6) return;
      o._hitT = now() + 0.8; o.angry = 6;
      if (o.T.two && !o.fallen) { o._hit = { vx: bv[0]*0.7, vz: bv[2]*0.7 }; o.fallen = 3.5; }
      else if (!o.T.two) { o.v = 0; o._sh = { vx: (o._sh?.vx || 0) + bv[0]*0.4, vz: (o._sh?.vz || 0) + bv[2]*0.4 }; }
      const k = o.T.two ? 0.15 : Math.min(0.6, (o.T.mass || 1000)/((v.spec.mass || 1000) + (o.T.mass || 1000)));
      kickBody(B, [-bv[0]*k, 0, -bv[2]*k]);
    });
    if (B.rest) settle(v);
  }
  if (B.rest) rolling.delete(v);
}
// stopped: on its wheels it's a car again (got into, it's driven off from there); on its side or its roof it's wrecked
function settle(v) {
  const L = lie(v._rb);
  v.v = 0;
  if (L.ang > OVER) { v._over = true; v.wreck = true; v.dmg = Math.max(v.dmg || 0, 0.5); }
  else { v._over = false; v.wreck = false; }
}
function release(v) {
  const B = v._rb; if (!B) return;
  _e.setFromQuaternion(B.Q, 'YXZ');
  v.th = -_e.y; v.lean = 0; v.pitch = 0; v.x = B.ox; v.z = B.oz; v.y = B.oy; v.vy = 0; v.v = 0; v.vl = 0; v.w = 0;
  v._rb = null; v._rbMine = false; v._over = false; v.wreck = false;
  rolling.delete(v);
}

// the ones in the street, every frame
const upd = Traffic.prototype.update;
Traffic.prototype.update = function (dt, ...rest) {
  const r = upd.call(this, dt, ...rest);
  if (rolling.size && dt > 0) {
    const P = G0()?.player;
    for (const v of rolling) {
      if (!v.root || !v.root.parent || !v._rb) { rolling.delete(v); continue; }
      if (P && P.cur === v && !P.onFoot) continue;                          // (yours goes with your own update)
      tick(v, dt, this);
    }
  }
  return r;
};
// yours: while it's going over you've no say in anything; a slide sideways into a kerb trips it
const vu = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) {
  const P = G0()?.player;
  if (this._rb && this.spec && !this.spec.two && P && P.cur === this && !P.onFoot) {
    if (!this._rbMine) release(this);                                       // (got into one lying on its wheels: it's yours to drive)
    else {
      if (this.events) this.events.length = 0;
      tick(this, dt, traffic);
      this.latAcc = 0; this.lift = 0; this.throttle = 0; this.brake = 0; this.steer = 0;
      return;
    }
  }
  const prev = this._wh && this._wh.slice();
  const out = vu.call(this, dt, inp, traffic);
  const h = this._wh, S = this.spec;
  if (dt > 0 && prev && h && h.length === 4 && S && !S.two && P && P.cur === this && !P.onFoot) {
    const vl = this.vl || 0, s = vl > 0 ? 0 : 1;                              // (moving to its right, the right wheels lead: 0 and 2)
    const climb = Math.max(h[s] - prev[s], h[s + 2] - prev[s + 2]);
    if (Math.abs(vl) > 4.5 && climb > 0.09) {
      const hx = Math.cos(this.th), hz = Math.sin(this.th);
      tryRoll(this, hx*this.v - hz*vl, hz*this.v + hx*vl, this.w || 0, { trip: 0.9 + Math.random()*0.1, mine: true });
    }
  }
  return out;
};
// hit while you're driving: what the blow left you going sideways at
const velOf = (v) => { const c = Math.cos(v.th), s = Math.sin(v.th); return [(v.v || 0)*c - (v.vl || 0)*s, (v.v || 0)*s + (v.vl || 0)*c]; };
const pu = Pilot.prototype.update;
Pilot.prototype.update = function (dt, inp, traffic, ...rest) {
  const V = !this.onFoot ? this.cur : null, car = V && V !== this.auto && V.spec && !V.spec.two && !V._rb;
  const before = car ? velOf(V) : null, th0 = car ? V.th : 0;
  const out = pu.call(this, dt, inp, traffic, ...rest);
  if (car && dt > 0 && this.cur === V && !this.onFoot && !V._rb) {
    const after = velOf(V), dv = Math.hypot(after[0] - before[0], after[1] - before[1]);
    const turned = Math.abs(Math.atan2(Math.sin(V.th - th0), Math.cos(V.th - th0))) > 1.2;      // (a jump of heading is a reset, not a crash)
    const rx = -Math.sin(V.th), rz = Math.cos(V.th), side = Math.abs((after[0] - before[0])*rx + (after[1] - before[1])*rz);
    if (dv > 4 && side > 3 && !turned) tryRoll(V, after[0], after[1], V.w || 0, { mine: true });
  }
  // over and stopped: out of it, the way you can
  const R = V && V._rb;
  if (R && V._rbMine && R.rest && this.cur === V && !this.onFoot) {
    if (V._over) { V._outT = (V._outT || 0) + dt; if (V._outT > 1.2) { V._outT = 0; V._rbMine = false; this.exit(traffic, true); } }
    else release(V);
  }
  return out;
};
// (not out of the door while it's still going over)
const ex = Pilot.prototype.exit;
Pilot.prototype.exit = function (traffic, force = false) {
  const V = this.cur; if (!force && V && V._rb && V._rbMine) return;
  return ex.call(this, traffic, force);
};
// one on its side or its roof isn't one you can get into, nor one that's still going over
const fo = Pilot.prototype.findOffer;
Pilot.prototype.findOffer = function (traffic) {
  const off = [];
  for (const d of this.dropped || []) { const v = d.veh; if (v && !v.dead && v.spec && !v.spec.two && (v._over || (v._rb && !v._rb.rest))) { v.dead = true; off.push(v); } }
  try { return fo.call(this, traffic); } finally { for (const v of off) v.dead = false; }
};
