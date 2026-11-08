// What knocks the street's things down (world/smash.js says how they go): whatever you drive into them, by its weight
// and how fast it meets them; a kick or a punch, on what a kick or a punch can move; a round from the katta, which
// breaks a lamp's head and its light. A post or a stall that gives way takes only what breaking it takes out of the
// vehicle, and what it weighs: a car through a fruit cart hardly slows, a lamp post folded over takes a good bite out
// of it and a dent in the front, and the car goes on. One that holds stops it as a wall does.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { PlayerAuto } from '@orig/vehicles/player.js';
import { Game } from '@orig/game/game.js';
import { Arms, ARMS } from '@orig/game/arms.js';
import { Brawl } from '@orig/people/fight.js';
import { SPEC } from '../world/smash.js';
import { FX } from '../world/smashfx.js';
import { toughOf } from '../vehicles/damage.js';
import { baseOf } from '../vehicles/models.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// what each weighs (as vehicles/physics.js), with whoever's on it
const MASS = { cycle: 15, scooter: 120, bike: 130, bullet: 190, superbike: 200, auto: 350, hatch: 1000, sedan: 1150, taxi: 1150, sports: 1500, super: 1450, jeep: 1750, tempo: 1800, suv: 1900, lux: 1900, bus: 8000 };
const massOf = (v) => (MASS[(v.type || 'auto').replace(/P$/, '')] ?? MASS[baseOf(v.type || 'hatch')] ?? (v.spec && v.spec.mass) ?? 1000) + ((v.spec && v.spec.two) || v.type === 'cycle' ? 70 : 0) + (v.load || 0)*70;
const tallOf = (v) => { const t = baseOf(v.type || 'auto'); return v.spec && v.spec.two ? 1.25 : t === 'bus' ? 3.1 : t === 'tempo' ? 2.3 : t === 'auto' ? 1.75 : /suv|jeep/.test(t) ? 1.8 : /sports|super/.test(t) ? 1.2 : 1.5; };
const half = (v) => { const S = v.spec; return [(S ? S.L : 2.65)/2, (S ? S.W : 1.35)/2]; };

// where the body (box a x b at x, z heading hx, hz) is touching the thing, and which way into it
function touch(r, x, z, hx, hz, a, b, ux, uz) {
  const L = (px, pz) => { const dx = px - x, dz = pz - z; return [dx*hx + dz*hz, -dx*hz + dz*hx]; };
  for (const c of r.cols) {
    if (c.off) continue;
    if (c.r !== undefined) {
      const [lx, lz] = L(c.x, c.z), kx = clamp(lx, -a, a), kz = clamp(lz, -b, b), ex = lx - kx, ez = lz - kz, d = Math.hypot(ex, ez);
      if (d >= c.r + 0.12) continue;
      const px = x + kx*hx - kz*hz, pz = z + kx*hz + kz*hx;
      if (d > 1e-3) return { px, pz, nx: (ex*hx - ez*hz)/d, nz: (ex*hz + ez*hx)/d };
      return { px, pz, nx: ux, nz: uz };
    }
    for (let k = 0; k <= 6; k++) {
      const px = c.ax + (c.bx - c.ax)*k/6, pz = c.az + (c.bz - c.az)*k/6, [lx, lz] = L(px, pz);
      if (Math.abs(lx) < a + 0.12 && Math.abs(lz) < b + 0.12) return { px, pz, nx: ux, nz: uz };
    }
  }
  return null;
}
function drive(v) {
  const W = v.W, X = W && W.smash; if (!X || v.dead || (W.fly && v.deck >= 0)) return;      // (up on a flyover there's nothing of the street's)
  const hx = Math.cos(v.th), hz = Math.sin(v.th), vl = v.vl || 0, vx = hx*v.v - hz*vl, vz = hz*v.v + hx*vl, sp = Math.hypot(vx, vz);
  if (sp < 1) return;
  const [a, b] = half(v), m = massOf(v), ux = vx/sp, uz = vz/sp;
  X.near(v.x, v.z, Math.hypot(a, b) + 2, (r) => {
    if (r.st === 2 || X.t - (r._ht ?? -9) < 0.3 || Math.abs((v.y || 0) - r.y) > 2.5) return;
    const c = touch(r, v.x, v.z, hx, hz, a, b, ux, uz); if (!c) return;
    const vn = vx*c.nx + vz*c.nz; if (vn < 1) return;
    r._ht = X.t;
    const E = 0.5*m*vn*vn*m/(m + 500);
    const res = X.hit(r, { E, px: c.px, py: (v.y || 0) + Math.min(0.55, tallOf(v)*0.4), pz: c.pz, nx: c.nx, nz: c.nz, u: vn*0.85, m, by: 'car' });
    if (!res || !res.broke) return;
    // through it: what breaking it took, and what it carries off with it
    const v1 = Math.sqrt(Math.max(0, vn*vn - 2*res.absorb/m))*m/(m + res.carried), dv = vn - v1;
    const nvx = vx - c.nx*dv, nvz = vz - c.nz*dv;
    v.v = nvx*hx + nvz*hz; if (v.vl !== undefined) v.vl = -nvx*hz + nvz*hx;
    if (dv > 2.2 && v.events) v.events.push({ type: 'crash', speed: dv, kind: 2, x: c.px, z: c.pz });
    // and a dent where it went in, by how much it felt
    if (dv > 3 && v.dent && v.bodyMesh && v.box) {
      const lx = (c.px - v.x)*hx + (c.pz - v.z)*hz, lz = -(c.px - v.x)*hz + (c.pz - v.z)*hx, nlx = c.nx*hx + c.nz*hz, nlz = -c.nx*hz + c.nz*hx;
      v.dmg = Math.min(0.97, (v.dmg || 0) + dv*dv*0.0007*(v.armorMul ?? 1)*toughOf(v.type));
      try { const bb = v.box(), ly = bb.min.y + (bb.max.y - bb.min.y)*0.36; v.dent(clamp(lx, -a, a), ly, clamp(lz, -b, b), nlx, -0.12, nlz, clamp(0.35 + dv*0.035, 0.35, 0.9), Math.min(0.24, (dv - 3)*0.02*Math.sqrt(toughOf(v.type)))); } catch (e) { /* drawn as it was */ }
    }
  });
}
for (const K of [Vehicle, PlayerAuto]) {
  const cs = K.prototype.collideStatic;
  K.prototype.collideStatic = function (...a) { try { drive(this); } catch (e) { console.warn('smash', e); } return cs.apply(this, a); };
}

// ---- every step: the pieces, and what they can meet (you, and any car left in the street that's moving)
function cars(G) {
  const P = G.player, out = [], at = P.onFoot ? P.foot : P.cur;
  const put = (v) => {
    const [a, b] = half(v), hx = Math.cos(v.th), hz = Math.sin(v.th), vl = v.vl || 0, y = v.y || 0;
    out.push({ x: v.x, z: v.z, hx, hz, a, b, y0: y + 0.18, y1: y + tallOf(v), vx: hx*v.v - hz*vl, vz: hz*v.v + hx*vl });
  };
  if (!P.onFoot && P.cur) put(P.cur);
  for (const q of P.dropped || []) { const v = q.veh; if (v && v !== P.cur && v.root && v.root.parent && Math.abs(v.x - at.x) < 80 && Math.abs(v.z - at.z) < 80) put(v); }
  return out;
}
const fixed = Game.prototype.fixed;
Game.prototype.fixed = function (dt) {
  const r = fixed.call(this, dt);
  const X = this.W && this.W.smash;
  if (X && this.state === 'play' && dt > 0) try { X.tick(dt, cars(this)); } catch (e) { console.warn('smash', e); }
  return r;
};

// ---- a round from the gun: what it meets first along the line from the camera
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _h = new THREE.Vector3();
function shotAt(X, o, d, F, range) {
  let best = null;
  const cand = (t, r, head, mat) => { if (t > 0.3 && (!best || t < best.t)) best = { t, r, head, mat }; };
  X.near(F.x, F.z, range, (r) => {
    if (r.st === 2) return;
    const S = r.S || SPEC[r.kind]; if (!S) return;
    const inY = (t) => { const y = o.y + d.y*t; return y > r.y - 0.2 && y < r.y + S.h; };
    // a lamp's head: the glass under it
    if (r.kind === 'lamp' && !r.dark && r.lamp) {
      _h.set(r.lamp[0], r.y + 8.1, r.lamp[1]).sub(o);
      const tc = _h.dot(d), d2 = _h.lengthSq() - tc*tc; if (tc > 0 && d2 < 0.3*0.3) cand(tc - Math.sqrt(0.09 - d2), r, true, 'glass');
    }
    for (const c of r.cols) {
      if (c.off) continue;
      if (c.r !== undefined) {
        const ox = o.x - c.x, oz = o.z - c.z, A = d.x*d.x + d.z*d.z, B = 2*(ox*d.x + oz*d.z), C = ox*ox + oz*oz - c.r*c.r, D = B*B - 4*A*C;
        if (D < 0 || A < 1e-9) continue;
        const t = (-B - Math.sqrt(D))/(2*A); if (inY(t)) cand(t, r, false, S.mat);
      } else {
        const ex = c.bx - c.ax, ez = c.bz - c.az, den = d.x*ez - d.z*ex; if (Math.abs(den) < 1e-9) continue;
        const t = ((c.ax - o.x)*ez - (c.az - o.z)*ex)/den, u = ((c.ax - o.x)*d.z - (c.az - o.z)*d.x)/den;
        if (u >= 0 && u <= 1 && inY(t)) cand(t, r, false, S.mat);
      }
    }
  });
  return best;
}
const use = Arms.prototype.use;
Arms.prototype.use = function (...args) {
  const G = this.g, Pl = G.player, A = this.held && ARMS[this.held], X = G.W && G.W.smash;
  if (!A || !A.gun || !Pl || !Pl.onFoot || !(this.life.s.ammo > 0) || !X) return use.apply(this, args);
  const F = Pl.foot; G.camera.getWorldPosition(_o); G.camera.getWorldDirection(_d);
  const hit = shotAt(X, _o, _d, F, A.range + 4);
  if (!hit) return use.apply(this, args);
  const hx = _o.x + _d.x*hit.t, hy = _o.y + _d.y*hit.t, hz = _o.z + _d.z*hit.t, dh = Math.hypot(hx - F.x, hz - F.z);
  if (dh > A.range) return use.apply(this, args);
  // someone in front of it takes the round as before; anyone behind it is safe
  const fl = Math.hypot(_d.x, _d.z) || 1, ax = _d.x/fl, az = _d.z/fl;
  let first = false;
  for (const p of G.people.list) { if (p.hidden || p.fallen > 0) continue; const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz); if (d > dh || d < 0.5 || (dx*ax + dz*az)/d < 0.985) continue; if (G.W.collision.ray && G.W.collision.ray(F.x, F.z, p.x, p.z) < 0.97) continue; first = true; }
  const hid = [];
  if (!first) for (const p of G.people.list) { if (p.hidden) continue; if (Math.hypot(p.x - F.x, p.z - F.z) > dh + 0.3) { p.hidden = true; hid.push(p); } }
  G._shotStop = first ? null : hit.t; G._shotHitT = null;
  let r;
  try { r = use.apply(this, args); } finally { for (const p of hid) p.hidden = false; G._shotStop = null; }
  if (first || (G._shotHitT != null && G._shotHitT < hit.t)) return r;
  // (a round knocks over only what's light: a banner, a flower cart, the third or fourth into something a little more)
  try { if (!(hit.head && X.darken(hit.r))) { FX.hit(hit.mat, hx, hy, hz); if (!hit.head) X.hit(hit.r, { E: 250, px: hx, py: hy, pz: hz, nx: ax, nz: az, u: 1.2, m: 60, by: 'shot' }); } } catch (e) { console.warn('smash', e); }
  return r;
};

// ---- a kick or a punch at nobody: whatever's in front of the foot or the fist
const land = Brawl.prototype.landPlayer;
Brawl.prototype.landPlayer = function (A) {
  const q = A.target, F = this.P.foot, M = A.M, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
  let aimed = false;
  if (q) { if (q.veh) aimed = true; else { const dx = q.x - F.x, dz = q.z - F.z, d = Math.hypot(dx, dz); aimed = !(d > M.reach + 0.25 || (dx*fx + dz*fz) < 0.2*d || q.hidden); } }
  const out = land.call(this, A);
  const X = this.g.W && this.g.W.smash;
  if (!aimed && X && M) try {
    const reach = Math.min(1.3, M.reach || 1), px = F.x + fx*reach*0.75, pz = F.z + fz*reach*0.75;
    let best = null, bd = 0.45;
    X.near(px, pz, 2, (r) => {
      if (r.st === 2) return;
      for (const c of r.cols) {
        if (c.off) continue;
        let d;
        if (c.r !== undefined) d = Math.hypot(px - c.x, pz - c.z) - c.r;
        else { const ex = c.bx - c.ax, ez = c.bz - c.az, L2 = ex*ex + ez*ez || 1e-9, t = clamp(((px - c.ax)*ex + (pz - c.az)*ez)/L2, 0, 1); d = Math.hypot(px - c.ax - ex*t, pz - c.az - ez*t); }
        if (d < bd) { bd = d; best = r; }
      }
    });
    if (best) {
      const leg = !!(M.leg || /kick|stomp|front|round|low/.test(A.name || ''));
      X.hit(best, { E: leg ? 180 : 45, px, py: (best.y || 0) + (leg ? 0.5 : 1.3), pz, nx: fx, nz: fz, u: leg ? 2.2 : 1, m: 75, by: 'kick' });
    }
  } catch (e) { console.warn('smash', e); }
  return out;
};
