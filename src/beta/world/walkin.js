// Walking in and out of places, all the way. F at a door: you walk up to it from wherever you are (as far as that is,
// at a walk), and through it; as you cross the doorway the picture cuts straight to the room (no dimming, no fade), with
// you still walking, a few steps into it. Going out (F at the door inside): you walk to the door, through it, and the
// picture cuts to you coming out onto the footpath walking, a couple of steps clear of the shop. Your keys are yours
// again once you've stopped.
import { Shops, openNow } from '@orig/game/shops.js';
import { Interiors } from '@orig/world/interiors.js';
import { Pilot } from '@orig/game/pilot.js';

const SPEED = 1.4, FADE = 0;
// (the cut: nothing dims; kept as a call so the walk reads the same)
function dim() {}
const walk = (P, W) => { P._walk = W; P.act = { kind: 'walk', t: 0 }; P.frozen = true; P.human.play('walk', { fade: 0.25, speed: 1.1 }); };

// in: up to the door and through it
const tryUse = Shops.prototype.tryUse;
Shops.prototype.tryUse = function () {
  const G = this.g, P = G.player, n = this.near, I = G.interiors;
  if (P._walk) return true;
  const door = n && n.door && !n.cart && I && !I.inside && I.templateOf && I.templateOf(n.kind) ? n.door : null;
  const oh = door && openNow(n, G.hour);
  if (!door || !P.onFoot || (oh && !oh.open)) return tryUse.call(this);
  const F = P.foot, dx = door.x - F.x, dz = door.z - F.z, d = Math.hypot(dx, dz) || 1;
  // a point just past the doorway, on the line you walk in on
  walk(P, { kind: 'in', tx: door.x + dx/d*0.6, tz: door.z + dz/d*0.6, dx: door.x, dz: door.z, t: 0, max: d/SPEED + 1.4, near: n, dimmed: false });
  return true;
};
// out (the door inside, F): walk to it, through, and out
const use = Interiors.prototype.use;
Interiors.prototype.use = function (s) {
  if (!s || s.kind !== 'exit' || this._out) return use.call(this, s);
  const P = this.g.player, R = this.cur && this.cur.R;
  if (!R || !P.onFoot || P._walk) return use.call(this, s);
  const F = P.foot, tx = R.O.x, tz = R.O.z - 0.3;
  walk(P, { kind: 'toexit', tx, tz, dx: R.O.x, dz: R.O.z + 0.2, t: 0, max: Math.hypot(tx - F.x, tz - F.z)/SPEED + 1.2, I: this });
};

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), W = this._walk;
  if (!W) return out;
  if (this.downT > 0 || this.ko || (this.act && this.act.kind === 'hurt')) { this._walk = null; this.frozen = false; dim(false); return out; }
  const F = this.foot, H = this.human, dx = W.tx - F.x, dz = W.tz - F.z, d = Math.hypot(dx, dz);
  W.t += dt;
  // a steady walk, easing in and out, turning smoothly onto the line
  const sp = SPEED*Math.min(1, 0.35 + W.t*2.5)*Math.min(1, 0.4 + d*1.5);
  if (d > 0.03) {
    const st = Math.min(d, sp*dt);
    F.x += dx/d*st; F.z += dz/d*st;
    let dy = Math.atan2(dz, dx) - F.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); F.yaw += dy*Math.min(1, dt*6);
  }
  F.v = sp; F.vx = 0; F.vz = 0;
  H.holder.position.set(F.x, F.y, F.z); H.holder.rotation.set(0, -F.yaw, 0);
  if (H.cur === H.actions?.walk) H.cur.timeScale = Math.max(0.6, sp/1.25);
  const dd = W.dx !== undefined ? Math.hypot(W.dx - F.x, W.dz - F.z) : 9;
  const done = d < 0.06 || W.t > W.max;
  // crossing the doorway: the picture goes as you go through
  if ((W.kind === 'in' || W.kind === 'toexit') && !W.dimmed && (dd < 0.45 || W.t > W.max - FADE)) { W.dimmed = true; W.dimT = W.t; dim(true); }
  if (W.dimmed && !W.fired && W.t - W.dimT > FADE*0.9) {
    W.fired = true;
    const G = window.__nhAskG;
    if (W.kind === 'in') {
      const S = G && G.shops, keep = S.near; S.near = W.near; tryUse.call(S); if (!G.interiors.inside) S.near = keep;
      const C = G.interiors.inside && G.interiors.cur;
      if (C && C.R) {
        // inside: through the door and on into the room
        const O = C.R.O; F.x = O.x; F.z = O.z + 0.2; F.yaw = Math.PI/2;
        this._walk = { kind: 'inside', tx: O.x, tz: O.z + 2.0, t: 0, max: 1.6 };
        H.holder.position.set(F.x, F.y, F.z); H.holder.rotation.set(0, -F.yaw, 0);
      } else { this._walk = null; this.frozen = false; if (this.act && this.act.kind === 'walk') this.act = null; H.play('idle', { fade: 0.3 }); }
      setTimeout(() => dim(false), 80);
      return out;
    }
    if (W.kind === 'toexit') {
      W.I._out = true; use.call(W.I, { kind: 'exit' }); W.I._out = false;
      // outside: out of the door and a couple of steps onto the footpath
      const yaw = F.yaw;
      this._walk = { kind: 'out', tx: F.x + Math.cos(yaw)*2.0, tz: F.z + Math.sin(yaw)*2.0, t: 0, max: 1.9 };
      if (this.act) this.act.kind = 'walk';
      setTimeout(() => dim(false), 80);
      return out;
    }
  }
  if (done && (W.kind === 'inside' || W.kind === 'out' || (!W.dimmed && W.kind !== 'in'))) {
    this._walk = null; this.frozen = false;
    if (this.act && this.act.kind === 'walk') this.act = null;
    H.play('idle', { fade: 0.35 });
  }
  return out;
};
