// Going down like a body does. Whoever falls (a punch, a shove, a car) turns to face what hit them, so the fall
// goes away from it, and carries on a little the way they were knocked: a shove sends them back a step, a car
// throws them along its way. You too: knocked down while running you go over with your speed, not on the spot.
import { People } from '@orig/people/peds.js';
import { Pilot } from '@orig/game/pilot.js';
import { startRag, seatRag, tick as ragTick, pose as ragPose } from '../people/ragdoll.js';

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
      // the body's own from here (people/ragdoll.js): pushed where it was hit, more at the chest than the feet, it goes
      // over as it goes; with nothing to push it (a shot, out cold) the knees just go and it folds where it stands
      p._rq = p._throw ? null : sp > 0 ? { push: [sx*sp*0.55, sz*sp*0.55, 0.4] } : { vy: -0.6 }; p._rqT = 0.8;
    } else if (!down && p._down) {
      p._down = false;
      // up again after being knocked over: a hand to the head a moment, getting their bearings
      if (!p.corpse && !p.ko && !p.act && p.inj) p.act = { kind: 'hurt', clip: 'hit_head', speed: 1, t: 0, dur: 2.2 };
    }
    // (started as soon as there's a body to start: someone who's only just been given one, a rider thrown off, gets it
    // a frame or two late, never not at all)
    if (down && !p._rag && (p._rq || p._throw) && (p._rqT -= dt) > 0) {
      const T0 = p._throw;
      if (T0 ? startRag(p, { yaw: T0.yaw }) : startRag(p, p._rq)) {
        p._slide = null; p._rq = null;
        if (T0) { seatRag(p._rag, T0.x, T0.z, T0.yaw, T0.y, T0.vx, T0.vy, T0.vz); p._throw = null; p.x = T0.x; p.z = T0.z; }
      }
    }
    if (!down) { p._rq = null; p._throw = null; }
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
  // your own body goes down the way anyone's does (people/ragdoll.js): thrown with the speed you had, limp, landing
  // how it lands; as you come round it goes from where you lie into getting up
  const H = this.human;
  if (this.downT > 0 && !was && H && !this._rag) {
    const v = Math.hypot(vx, vz);
    if (startRag(this, { H, yaw: F.yaw, push: v > 0.5 ? [vx*0.5, vz*0.5, 0.3] : null, vy: v > 0.5 ? 0 : -0.6 })) this._fall = null;
  }
  const R = this._rag;
  if (R) {
    if (!(this.downT > 0) || this.onFoot === false) {
      if (R.out < 0) { R.out = performance.now(); const hx = R.p[0] - R.p[6], hz = R.p[2] - R.p[8]; if (Math.hypot(hx, hz) > 0.05) F.yaw = Math.atan2(hz, hx); F.x = R.p[0]; F.z = R.p[2]; }
      if (performance.now() - R.out > 600 || this.onFoot === false) this._rag = null;
      else if (H) { H.holder.position.set(F.x, F.y, F.z); H.holder.rotation.set(0, -F.yaw, 0); ragPose(this, H); }
      return out;
    }
    if (!R.sleep) ragTick(R, dt, this.W);
    F.x = R.p[0]; F.z = R.p[2];
    if (H) { H.holder.position.set(F.x, F.y, F.z); H.holder.rotation.set(0, -F.yaw, 0); ragPose(this, H); }
    return out;
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
