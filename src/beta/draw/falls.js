// Going down like a body does. Whoever falls (a punch, a shove, a car) turns to face what hit them, so the fall
// goes away from it, and carries on a little the way they were knocked: a shove sends them back a step, a car
// throws them along its way. You too: knocked down while running you go over with your speed, not on the spot.
import { People } from '@orig/people/peds.js';
import { Pilot } from '@orig/game/pilot.js';

const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...a) {
  const out = upd.call(this, dt, player, ...a), G = this._G;
  if (!G || !G.player) return out;
  const P = G.player, T = G.traffic, W = this.W;
  for (const p of this.list) {
    const down = p.fallen > 0;
    if (down && !p._down) {
      p._down = true;
      // what put them down
      let sx = 0, sz = 0, sp = 0;
      const dpx = p.x - P.x, dpz = p.z - P.z, dp = Math.hypot(dpx, dpz);
      if (P.onFoot && dp < 2.6 && dp > 1e-3) { sx = dpx/dp; sz = dpz/dp; sp = 2.2; }
      else if (T && T.near) {
        let best = null, bd = 5;
        T.near(p.x, p.z, 6, (o) => { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd && Math.abs(o.v || 0) > 1.5) { bd = d; best = o; } });
        if (!best && !P.onFoot && P.cur && Math.hypot(P.cur.x - p.x, P.cur.z - p.z) < 5 && Math.abs(P.v || 0) > 1.5) best = { hx: Math.cos(P.cur.th), hz: Math.sin(P.cur.th), v: P.v };
        if (best) { sx = best.hx; sz = best.hz; sp = Math.min(7, Math.abs(best.v)*0.6); }
      }
      if (sp > 0) {
        // they face it, and fall back away from it
        p.yaw = Math.atan2(-sz, -sx); p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
        p._slide = { vx: sx*sp, vz: sz*sp };
      }
    } else if (!down && p._down) p._down = false;
    const S = p._slide;
    if (S && down) {
      p.x += S.vx*dt; p.z += S.vz*dt;
      const k = Math.exp(-dt*5); S.vx *= k; S.vz *= k;
      const r = W && W.collision && W.collision.resolve(p.x, p.z, 0.25);
      if (r && r.kind !== 3) { p.x += r.nx*r.depth; p.z += r.nz*r.depth; S.vx *= 0.3; S.vz *= 0.3; }
      if (Math.hypot(S.vx, S.vz) < 0.05) p._slide = null;
    } else if (S) p._slide = null;
  }
  return out;
};

// you: the speed you had goes with you as you go over, and the fall is a little softer to come into
const foot = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const F = this.foot, was = this.downT > 0, vx = F ? F.vx : 0, vz = F ? F.vz : 0;
  const out = foot.call(this, dt, ...a);
  if (!F) return out;
  if (this.downT > 0 && !was) {
    const v = Math.hypot(vx, vz);
    this._fall = v > 1 ? { vx: vx*0.7, vz: vz*0.7 } : null;
    // falling the way you were going: face it (the clip falls backward), so turn to face where you came from
    if (v > 1) { F.yaw = Math.atan2(-vz, -vx); this.human.holder.rotation.set(0, -F.yaw, 0); }
  }
  const S = this._fall;
  if (S && this.downT > 0) {
    F.x += S.vx*dt; F.z += S.vz*dt;
    const k = Math.exp(-dt*4); S.vx *= k; S.vz *= k;
    const r = this.W && this.W.collision && this.W.collision.resolve(F.x, F.z, 0.3);
    if (r && r.kind !== 3) { F.x += r.nx*r.depth; F.z += r.nz*r.depth; S.vx = S.vz = 0; }
    this.human.holder.position.set(F.x, F.y, F.z);
  } else this._fall = null;
  return out;
};
