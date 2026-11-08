// Off your own two-wheeler. Ride into something hard enough, or have something hit you, and you don't stay sat on it:
// the machine stops (or is knocked away) under you and you go on with the speed you had, off the seat as a body of
// your own (people/ragdoll.js), astride for the first instant, over the bars if you went in front-on, rolling and
// sliding down the road till you stop, and you get up only once you've stopped. The scooter or the bike goes on as a
// solid body of its own (bikebody.js): over on its side away from you and sliding, spun round, rolled over or end over
// end, however the blow sent it, and it lies as it ended up till you go back and get on it again.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { startRag, seatRag } from '../people/ragdoll.js';
import { makeBody, stepBody } from './bikebody.js';

const _e = new THREE.Euler();
// drawn however its body lies while it's down
const sync0 = Vehicle.prototype.sync;
Vehicle.prototype.sync = function (dt = 0) {
  const r = sync0.call(this, dt), B = this._rb;
  if (B) { this.root.position.set(B.ox, B.oy, B.oz); this.root.quaternion.copy(B.Q); this.tilt.position.set(0, 0, 0); this.tilt.rotation.set(0, 0, 0); }
  return r;
};
const velOf = (v) => { const c = Math.cos(v.th), s = Math.sin(v.th); return [(v.v || 0)*c - (v.vl || 0)*s, (v.v || 0)*s + (v.vl || 0)*c]; };

const upd = Pilot.prototype.update;
Pilot.prototype.update = function (dt, inp, traffic, ...rest) {
  const V0 = !this.onFoot ? this.cur : null, two = V0 && V0 !== this.auto && V0.spec && V0.spec.two;
  const before = two ? velOf(V0) : null, th0 = two ? V0.th : 0;
  const out = upd.call(this, dt, inp, traffic, ...rest);
  if (two && dt > 0 && this.cur === V0 && !this.onFoot && !this._out && !this._cx && !this.act && !this.frozen) {
    const after = velOf(V0), sp0 = Math.hypot(before[0], before[1]), dv = Math.hypot(after[0] - before[0], after[1] - before[1]);
    // (a jump of heading with no blow is a teleport, a reset: not a crash)
    const turned = Math.abs(Math.atan2(Math.sin(V0.th - th0), Math.cos(V0.th - th0))) > 1.2 && dv > sp0*1.5;
    if (sp0 > 3 && dv > 5.2 && !turned) { try { thrown(this, V0, before, after, dv, traffic); } catch (e) { console.warn('throwoff', e); } }
  }
  // the machine you came off, going over and sliding
  const D = this._down2;
  if (D && dt > 0) tip(this, D, dt);
  return out;
};

function thrown(P, V, before, after, dv, traffic) {
  const H = P.human, hx = Math.cos(V.th), hz = Math.sin(V.th);
  const x = V.x - hx*0.15, z = V.z - hz*0.15, gy = P.W.surf ? P.W.surf.height(x, z) : 0, seat = (V.y || 0) + (/^bike/.test(V.type) ? 0.92 : 0.85);
  // which way it goes over: away from the blow's sideways part, else whichever way it was leaning
  const lat = (after[0] - before[0])*-hz + (after[1] - before[1])*hx, side = Math.abs(lat) > 0.6 ? Math.sign(lat) : Math.sign(V.lean || 0.001);
  P.exit(traffic, true);
  if (!P.onFoot) return;
  P._unpop = null;
  const F = P.foot; F.x = x; F.z = z; F.y = gy; F.yaw = V.th; F.vx = F.vz = 0; F.v = 0;
  P.downT = 3 + Math.min(6, dv*0.3);
  P.events.push({ type: 'gotHit', speed: dv*0.8, who: 'fall', x, z });
  // you go on as you were going (the machine's stopped or been knocked away under you), a little up off the seat
  const R = H && startRag(P, { H, yaw: V.th });
  if (R) { seatRag(R, x, z, V.th, gy + seat, before[0]*0.95 + (after[0] - before[0])*0.25, 0.8 + Math.min(1.6, dv*0.08), before[1]*0.95 + (after[1] - before[1])*0.25); P._fall = null; }
  // the machine: carrying on with what it had after the blow, turned over by it: onto its side away from you, spun if
  // it was hit off-centre, end over end if it stopped dead from the front
  V.v = 0; V.vl = 0;
  const s0 = -side || 1, rx = -hz, rz = hx, ahead = (after[0] - before[0])*hx + (after[1] - before[1])*hz;
  const roll = s0*(0.8 + Math.min(2, dv*0.12) + Math.min(4, Math.max(0, dv - 9)*0.3))*(0.85 + Math.random()*0.3);
  const pitchW = ahead < -6 && Math.abs(lat) < -ahead*0.5 ? Math.min(5, (-ahead - 6)*0.35 + 0.8) : 0;
  const yawW = (Math.random() - 0.5)*Math.min(3, dv*0.15), vy = Math.min(2, Math.max(0, dv - 9)*0.12 + pitchW*0.15);
  _e.set(V.lean || 0, -V.th, V.pitch || 0, 'YXZ');
  const Q0 = new THREE.Quaternion().setFromEuler(_e);
  V._rb = makeBody(V.type, Q0, V.x, V.y || 0, V.z, [after[0], vy, after[1]], [hx*roll - rx*pitchW, yawW, hz*roll - rz*pitchW]);
  P._down2 = { V };
}

function tip(P, D, dt) {
  const V = D.V, B = V._rb;
  const off = () => { if (B) { _e.setFromQuaternion(B.Q, 'YXZ'); V.th = -_e.y; V.lean = _e.x; V.x = B.ox; V.z = B.oz; } V._rb = null; P._down2 = null; };
  if (!P.onFoot && P.cur === V) { off(); return; }                                  // (back on it: it's stood up as you ride)
  if (!P.dropped.some(d => d.veh === V) || !B) { off(); return; }
  if (!B.rest) {
    const W = P.W, gy = W.surf ? W.surf.height(B.c[0], B.c[2]) : 0;
    stepBody(B, dt, gy, W.collision ? (x, z) => W.collision.resolve(x, z, 0.45) : null);
    if (B.rest) P.audio?.thud?.(0.3);
    V.x = B.ox; V.z = B.oz;
    const d = P.dropped.find(q => q.veh === V); if (d && d.st) { d.st.x = V.x; d.st.z = V.z; }
  } else { B.ox = V.x; B.oz = V.z; }                                               // (lying: pushed about, it goes where it's pushed)
  V.sync && V.sync(0);
}
