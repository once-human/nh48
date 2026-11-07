// Being hit by what you're driving, the way it goes. How a body moves is settled by what hits it and how fast. A low car takes
// the legs and the body wraps onto the bonnet, then it goes on up the glass and over, lower and further the faster you were
// going, and comes down behind or beside you (wrap, roof vault). Something tall and flat-fronted, a bus, a tempo, an auto,
// takes them in the middle and they go down in front of it, and if it doesn't stop it goes over them (forward projection, run
// over). The front corner spins them off to the side (fender vault). A two-wheeler knocks them down and loses a lot of its
// own speed to do it. Nobody goes up high: the height comes from the shape of the car, and the speed they leave with is capped.
// They go over the car's real outline, so nobody passes through it, and walls stop them. Whoever's lying in the road is under
// you, not pushed out of your way: each axle goes over them with a bump you feel.
import * as THREE from 'three';
import { People } from '@orig/people/peds.js';
import { baseOf } from '../vehicles/models.js';
import { tickVoice } from '../game/voices.js';

const G0 = 9.81, HIP = 0.9, FLAT = 0.2, MARGIN = 0.3;
const TALL = new Set(['bus', 'tempo', 'auto', 'bolero']);
const out = (p) => p.hidden || p.pax || p.rideOf || p.lift || p.seat || p.seated || p.mode === 'inside' || p.ctl || p.fixed || p._vetalBody;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t*t*(3 - 2*t); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the height of the vehicle's top at u (+1 its nose, -1 its tail): bonnet, glass, roof, down at the back
function topAt(u, H, tall) {
  if (tall) return H;
  const hood = H*0.66, edge = H*0.56;
  if (u > 0.3) return edge + (hood - edge)*(1 - u)/0.7;
  if (u > -0.1) return hood + (H - hood)*(0.3 - u)/0.4;
  if (u > -0.6) return H;
  return H - (H - hood*0.95)*(-0.6 - u)/0.4;
}
const heightOf = (V, S) => { if (S._hgt) return S._hgt; let h = 1.4; try { const b = V.box(); h = b.max.y - b.min.y; } catch (e) { /* the usual */ } return (S._hgt = Math.max(0.9, h)); };

const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _p = new THREE.Vector3();
// (people/crowd.js: the body turned about its hips, on top of where it's standing)
window.__nhTum = (holder, p) => {
  const h = p._hit; if (!h || !h.draw) return;
  _a.set(h.nx, 0, h.nz); _q.setFromAxisAngle(_a, h.draw);
  holder.quaternion.premultiply(_q);
  _p.set(0, HIP, 0).applyQuaternion(_q);
  holder.position.x -= _p.x; holder.position.y += HIP - _p.y; holder.position.z -= _p.z;
};

People.prototype.struck = function (p, V, S, player, sp, fx, fz, al, ac) {
  const base = baseOf(V.type || 'auto'), two = !!S.two, tall = TALL.has(base) || TALL.has(V.type) || !V.spec, kmh = sp*3.6, R = this.rng.next();
  const wide = Math.abs(ac)/(S.W/2 + MARGIN), side = Math.sign(ac) || (this.rng.next() < 0.5 ? -1 : 1), sx = -fz*side, sz = fx*side;
  const dead = kmh > 70 ? R < 0.8 : kmh > 50 ? R < 0.4 : kmh > 35 ? R < 0.08 : false, ko = dead || kmh > 25, crit = !dead && kmh > 45;
  p.fallen = dead || ko ? 1e6 : 3 + kmh*0.12; p.ko = ko; p.corpse = dead; p.unconscious = ko && !dead; p.v = 0; p.dodge = 0; p.steerT = 0;
  p.inj = { sev: dead ? 'dead' : crit ? 'critical' : ko ? 'ko' : 'knock', t: 0 };
  if (!ko) p.limp = 40 + kmh*2;
  this.remember(p, dead ? 'dead' : 'hit');
  this.events.push({ type: 'pedHit', p, speed: sp, x: p.x, z: p.z, sev: dead ? 'dead' : ko ? 'ko' : 'knock' });
  // how they leave: the share of your speed they take, what's added to the side, how they lift and turn
  const cap = Math.min(sp, 26);
  let along, lat, vy, spin;
  if (two) { along = 0.62*cap; lat = 0.12*cap*side; vy = Math.min(1.5, 0.4 + cap*0.05); spin = 2 + cap*0.15; }
  else if (tall) { along = 0.92*Math.min(cap, 17); lat = 0.08*cap*side; vy = 0.5; spin = 4; }
  else if (wide > 0.72) { along = 0.42*cap; lat = (0.22*cap + 0.8)*side; vy = Math.min(1.6, 0.5 + cap*0.05); spin = 3 + cap*0.2; }
  else if (kmh < 14) { along = 0.85*cap; lat = 0.1*cap*side; vy = 0.3; spin = 3; }
  else { along = Math.min(0.62*cap, 15); lat = 0.07*cap*side; vy = Math.min(1.4, 0.5 + cap*0.04); spin = 2.2 + cap*0.1; }
  p._hit = { x0: p.x, z0: p.z, x: p.x, z: p.z, y: HIP, vy, vx: fx*along + sx*lat, vz: fz*along + sz*lat, nx: -fz, nz: fx, ang: 0, spin, fx, fz, t: 0, lt: -1, bounce: 1, tall, yaw0: p.yaw, yaw: Math.atan2(fz, fx), H: heightOf(V, S), V, S, two, axle: 0 };
  // what it costs you: the weight of a person against yours
  const M = (S.mass || 1000) + (two ? 75 : 0), share = 75/(M + 75);
  const lost = Math.min(Math.abs(V.v)*share*1.2, Math.abs(V.v)); V.v -= Math.sign(V.v)*lost;
  if (two) { V.w = (V.w || 0) + side*Math.min(0.8, sp*0.04); }
  if (kmh > 18 && V.dent && !two) { try { const bb = V.box(), ly = bb.min.y + (bb.max.y - bb.min.y)*0.42; V.dent(S.L/2*Math.sign(V.v || 1), ly, ac, Math.sign(V.v || 1), -0.1, 0, 0.32, Math.min(0.07, kmh*0.0008)); } catch (e) { /* drawn as it was */ } }
};

function flying(P, p, dt, V, S) {
  const h = p._hit, C = P.W && P.W.collision; h.t += dt;
  if (h.lt < 0) {
    h.vy -= G0*dt; h.y += h.vy*dt; h.x += h.vx*dt; h.z += h.vz*dt;
    h.ang += h.spin*dt*Math.min(1, h.t*6 + 0.3);
    // what they hit's outline, if they're still over it: they ride up it, they don't go through it
    const O = h.V;
    if (O && O === V && O.x !== undefined) {
      const hx = Math.cos(O.th), hz = Math.sin(O.th), rx = h.x - O.x, rz = h.z - O.z, la = rx*hx + rz*hz, lc = -rx*hz + rz*hx, W2 = S.W/2 + 0.2, L2 = S.L/2 + 0.15;
      if (Math.abs(lc) < W2 && Math.abs(la) < L2) {
        const top = topAt(Math.sign(O.v || 1)*la/(S.L/2), h.H, h.tall) + 0.14;
        if (h.tall) { const fr = Math.sign(O.v || 1); h.x = O.x + hx*fr*L2*1.001 + (lc*-hz); h.z = O.z + hz*fr*L2*1.001 + (lc*hx); }   // (a flat front has nothing to ride up: it carries them)
        else if (h.y < top) { h.vy = Math.max(h.vy, Math.min(2.4, 0.5 + (top - h.y)/Math.max(dt, 0.01)*0.12)); h.y = top; }
      }
    }
    if (h.y <= FLAT) {
      h.y = FLAT;
      if (h.bounce > 0 && h.vy < -2.6) { h.bounce--; h.vy *= -0.24; h.vx *= 0.72; h.vz *= 0.72; h.spin *= 0.4; }
      else { h.vy = 0; h.lt = 0; h.ang = Math.PI/2 + wrapA(h.ang - Math.PI/2); }
    }
  } else {
    // on the ground: scraping to a stop, and settling as they lie (the clip takes the body down as this turn comes off)
    const v = Math.hypot(h.vx, h.vz), dv = 0.85*G0*dt; if (v > dv) { h.x += h.vx*dt; h.z += h.vz*dt; h.vx -= h.vx/v*dv; h.vz -= h.vz/v*dv; } else { h.vx = h.vz = 0; }
    h.lt += dt;
    const wa = 1 - smooth((h.lt - 0.1)/0.42);
    h.ang = (Math.PI/2 + wrapA(h.ang - Math.PI/2)*Math.max(0, 1 - dt*14))*1;
    h.show = wa;
  }
  // a wall's a wall
  if (C) { const r = C.resolve(h.x, h.z, 0.28); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { h.x += r.nx*r.depth; h.z += r.nz*r.depth; const vn = h.vx*r.nx + h.vz*r.nz; if (vn < 0) { h.vx -= 1.25*vn*r.nx; h.vz -= 1.25*vn*r.nz; h.vx *= 0.55; h.vz *= 0.55; } } }
  // turned to the way they're going, quickly (they don't get a say)
  const k = Math.min(1, h.t/0.14); p.yaw = h.yaw0 + wrapA(h.yaw - h.yaw0)*smooth(k);
  p.x = h.x; p.z = h.z;
  const wa = h.lt < 0 ? 1 : (h.show ?? 1);
  // (hips at h.y while the turn's on; as it comes off, the clip's own lying pose takes over at the ground)
  p.liftY = wa*(h.y - HIP);
  const a0 = h.ang; h._a = a0; const drawn = h.lt < 0 ? a0 : a0*wa; h.draw = drawn;
  if (h.lt >= 0.55 && !(Math.hypot(h.vx, h.vz) > 0.1)) {
    p.liftY = 0;
    if (p.mode === 'walk' || p.mode === 'cross') { p.dodgeX = (p.dodgeX || 0) + h.x - h.x0; p.dodgeZ = (p.dodgeZ || 0) + h.z - h.z0; }
    else if (p.anchor) { p.anchor.x = h.x; p.anchor.z = h.z; }
    p._hit = null;
  }
}

// a wheel going over someone on the ground
function overBody(P, p, V, S, player, sp, dt) {
  const hx = Math.cos(V.th), hz = Math.sin(V.th), rx = p.x - V.x, rz = p.z - V.z, al = rx*hx + rz*hz, ac = -rx*hz + rz*hx, s = Math.sign(V.v || 1);
  if (Math.abs(ac) > S.W/2 + 0.2 || Math.abs(al) > S.L/2 + 1 + sp*dt) { p._ovF = p._ovR = false; p._ovL = undefined; return; }
  const u = al*s, wb = (S.wb || S.L*0.6)/2, last = p._ovL ?? u; p._ovL = u;
  const axle = (i, at) => {
    if (!(last > at && u <= at)) return;
    // how much of a lift a body gives: a car's spring takes most of it, a two-wheeler's doesn't
    const kick = S.two ? 0.85 : (S.mass || 1000) > 5000 ? 0.1 : 0.42, bump = Math.min(1, 0.5 + sp*0.05);
    if (V.vy !== undefined) V.vy += kick*bump;
    V.v -= Math.sign(V.v)*Math.min(Math.abs(V.v), (S.two ? 0.9 : (S.mass || 1000) > 5000 ? 0.05 : 0.28));
    if (S.two) V.w = (V.w || 0) + (ac >= 0 ? 1 : -1)*0.25;
    const G = window.__nhAskG; G?.audio?.thud?.(Math.min(0.5, 0.18 + sp*0.012));
    // and what it does to them
    if (!p.corpse) {
      const kmh = sp*3.6, R = P.rng.next(), dead = kmh > 45 || (kmh > 20 ? R < 0.5 : R < 0.12) || (p.inj && p.inj.sev === 'critical');
      p.ko = true; p.unconscious = !dead; p.corpse = dead; p.fallen = 1e6; p.inj = { sev: dead ? 'dead' : 'critical', t: 0 };
      if (dead) P.events.push({ type: 'pedDied', p, x: p.x, z: p.z });
    }
    // dragged a little and rolled by it
    if (!p._hit) { const fx = hx*s, fz = hz*s; p._hit = { x0: p.x, z0: p.z, x: p.x, z: p.z, y: FLAT, vy: 0, vx: fx*Math.min(sp*0.2, 2.5), vz: fz*Math.min(sp*0.2, 2.5), nx: -fz, nz: fx, ang: 0, spin: 0, fx, fz, t: 1, lt: 0.6, bounce: 0, yaw0: p.yaw, yaw: p.yaw, H: 1, V, S, axle: 1, show: 0 }; }
  };
  axle(0, wb); axle(1, -wb);
}

const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...rest) {
  const V = player && !player.onFoot ? player.cur : null, S = player && player.spec;
  const overhead = V && V.deck >= 0 && player.y > 2.2;
  if (V && S && dt > 0 && !overhead) {
    const vx = (V.v || 0)*Math.cos(V.th) - (V.vl || 0)*Math.sin(V.th), vz = (V.v || 0)*Math.sin(V.th) + (V.vl || 0)*Math.cos(V.th), sp = Math.hypot(vx, vz);
    if (sp > 1.4) {
      const hx = Math.cos(V.th), hz = Math.sin(V.th), s = Math.sign(V.v || 1), reach = sp*dt + 0.05, RAD = S.L + reach + 2, L2 = S.L/2 + MARGIN, W2 = S.W/2 + MARGIN, fx = vx/sp, fz = vz/sp;
      for (const p of this.list) {
        if (Math.abs(p.x - V.x) > RAD || Math.abs(p.z - V.z) > RAD || out(p)) continue;
        if (p._hit && p._hit.lt < 0) continue;
        if (p.fallen > 1.6 || p.corpse) { overBody(this, p, V, S, player, sp, dt); continue; }
        if (p.fallen > 0) continue;
        const rx = p.x - V.x, rz = p.z - V.z, al = (rx*hx + rz*hz)*s, ac = -rx*hz + rz*hx;
        if (Math.abs(ac) < W2 && al < L2 && al > -L2 - reach) this.struck(p, V, S, player, sp, fx, fz, al, ac);
      }
    }
  }
  const r = upd.call(this, dt, player, ...rest);
  if (dt > 0) for (const p of this.list) if (p._hit) flying(this, p, dt, V, S);
  const G = window.__nhAskG; if (G) tickVoice(G);
  return r;
};
