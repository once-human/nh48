// A scooter, a bike or a cycle left standing in the street, parked in a row or one somebody got off, goes over when
// it's knocked: a kick has it over on its side, a round into it tips it, a car into it sends it down and sliding the
// way it was shoved, spinning if it was hit at one end. It falls as a solid thing of its own (bikebody.js, the same as
// one you come off) and lies there as it ended up, till you get on it and ride it away.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { Brawl } from '@orig/people/fight.js';
import { makeBody, stepBody } from './bikebody.js';

const G0 = () => window.__nhAskG, _e = new THREE.Euler(), down = new Set(), struck = new Set();
const isTwo = (v) => !!(v && v.spec && v.spec.two);

// over it goes: shoved (dx, dz) at k m/s, or carrying on as it was thrown (vel)
function over(P, V, dx, dz, k, vel) {
  if (V._rb || (!P.onFoot && P.cur === V) || (P._down2 && P._down2.V === V)) return false;
  const hx = Math.cos(V.th), hz = Math.sin(V.th), L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  const across = dx*-hz + dz*hx, side = Math.abs(across) > 0.15 ? Math.sign(across) : (Math.random() < 0.5 ? -1 : 1);
  const roll = side*(0.5 + Math.min(2.6, k*0.35) + Math.max(0, k - 8)*0.25)*(0.85 + Math.random()*0.3);
  const yawW = (Math.random() - 0.5)*Math.min(3, k*0.3), vy = Math.min(1.5, Math.max(0, k - 7)*0.1);
  _e.set(V.lean || 0, -V.th, V.pitch || 0, 'YXZ');
  const Q0 = new THREE.Quaternion().setFromEuler(_e), v = vel || [dx*k*0.5, 0, dz*k*0.5];
  // (what was sliding it upright hands over to the body)
  if (V._c) { V._c.vx = V._c.vz = V._c.w = 0; }
  V.v = 0; V.vl = 0;
  V._rb = makeBody(V.type, Q0, V.x, V.y || 0, V.z, [v[0], vy, v[1]], [hx*roll, yawW, hz*roll]);
  down.add(V);
  return true;
}
function off(V) {
  const B = V._rb;
  if (B) { _e.setFromQuaternion(B.Q, 'YXZ'); V.th = -_e.y; V.lean = _e.x; V.x = B.ox; V.z = B.oz; }
  V._rb = null; down.delete(V);
}

// struck where it stands (a round, a kick, a bumper: whatever dents it)
const dent0 = Vehicle.prototype.dent;
if (dent0) Vehicle.prototype.dent = function (lx, ly, lz, nx, ny, nz, ...rest) {
  if (isTwo(this) && !this._rb && !this.isPlayer) { const hx = Math.cos(this.th), hz = Math.sin(this.th); this._kn = [nx*hx - nz*hz, nx*hz + nz*hx]; struck.add(this); }
  return dent0.call(this, lx, ly, lz, nx, ny, nz, ...rest);
};

const upd = Pilot.prototype.update;
Pilot.prototype.update = function (dt, ...a) {
  const out = upd.call(this, dt, ...a);
  if (!(dt > 0)) return out;
  try {
    const P = this, mine = (V) => P.dropped.some(d => d.veh === V);
    // a two-wheeler left in the street and thrown (crash.js slides it upright): it goes over instead, the way it was going
    for (const d of P.dropped) {
      const V = d.veh; if (!isTwo(V) || V._rb || !V._c) continue;
      const sp = Math.hypot(V._c.vx, V._c.vz); if (sp > 1) over(P, V, V._c.vx, V._c.vz, sp, [V._c.vx, V._c.vz]);
    }
    for (const V of struck) { struck.delete(V); if (V._kn && mine(V) && !V._rb) over(P, V, V._kn[0], V._kn[1], 1.4); V._kn = null; }
    for (const V of down) {
      const B = V._rb;
      if (!B || (!P.onFoot && P.cur === V) || !mine(V) || (P._down2 && P._down2.V === V)) { if (!(P._down2 && P._down2.V === V)) off(V); else down.delete(V); continue; }
      if (!B.rest) {
        const W = P.W, gy = W.surf ? W.surf.height(B.c[0], B.c[2]) : 0;
        stepBody(B, dt, gy, W.collision ? (x, z) => W.collision.resolve(x, z, 0.45) : null);
        if (B.rest) P.audio?.thud?.(0.25);
        V.x = B.ox; V.z = B.oz;
        const d = P.dropped.find(q => q.veh === V); if (d && d.st) { d.st.x = V.x; d.st.z = V.z; }
      } else { B.ox = V.x; B.oz = V.z; }
      V.sync && V.sync(0);
    }
  } catch (e) { console.warn('knockover', e); }
  return out;
};

// a kick at nobody, at a two-wheeler standing there: it goes over (a parked one in a row is woken as a real one first)
const land = Brawl.prototype.landPlayer;
Brawl.prototype.landPlayer = function (A) {
  const q = A.target, M = A.M, out = land.call(this, A);
  try {
    const G = this.g, P = G && G.player, F = this.P.foot;
    if (!P || !P.onFoot || !M || (q && !q.veh && Math.hypot(q.x - F.x, q.z - F.z) < (M.reach || 1) + 0.25)) return out;
    const leg = !!(M.leg || /kick|stomp|front|round|low/.test(A.name || '')); if (!leg) return out;
    const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw), reach = Math.min(1.3, M.reach || 1), px = F.x + fx*reach*0.75, pz = F.z + fz*reach*0.75;
    // (the nearest point on it, end to end, to where the foot lands)
    const dist = (x, z, hx, hz) => { const t = Math.max(-0.75, Math.min(0.75, (px - x)*hx + (pz - z)*hz)); return Math.hypot(px - x - hx*t, pz - z - hz*t); };
    let best = null, bd = 0.55;
    for (const d of P.dropped) { const V = d.veh; if (!isTwo(V) || V._rb || P.cur === V) continue; const e = dist(V.x, V.z, Math.cos(V.th), Math.sin(V.th)); if (e < bd) { bd = e; best = { V }; } }
    const W = P.W;
    if (W.parkedList) for (const rp of W.parkedList) {
      if (rp.taken || !(rp.kind === 'scooter' || rp.kind === 'bike' || rp.kind === 'cycle') || Math.abs(rp.x - px) > 2 || Math.abs(rp.z - pz) > 2) continue;
      const L = Math.hypot(rp.hx, rp.hz) || 1, e = dist(rp.x, rp.z, rp.hx/L, rp.hz/L); if (e < bd) { bd = e; best = { rp }; }
    }
    if (!best) return out;
    let V = best.V;
    if (best.rp) { if (!Vehicle.prototype.wakeParked || !Vehicle.prototype.wakeParked.call(P.auto, best.rp)) return out; const D = P.dropped[P.dropped.length - 1]; V = D && D.veh; }
    if (V) over(P, V, fx, fz, 1.6);
  } catch (e) { console.warn('knockover', e); }
  return out;
};
