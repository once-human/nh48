// Walking in and out of places. F at a door no longer drops you inside: you walk up to the shutter (as far as you
// still are from it), the picture dims as you step through, and you're in. Coming out you step out onto the
// footpath the same way, the street fading up around you. While it plays your keys are yours again only after.
import { Shops, openNow } from '@orig/game/shops.js';
import { Interiors } from '@orig/world/interiors.js';
import { Pilot } from '@orig/game/pilot.js';

const SPEED = 1.35, FADE = 0.28;
let veil = null;
function dim(on) {
  if (!veil) {
    veil = document.createElement('div');
    veil.style.cssText = `position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:40;transition:opacity ${FADE}s ease`;
    document.body.appendChild(veil);
  }
  veil.style.opacity = on ? '1' : '0';
}

// in: up to the door, then the room
const tryUse = Shops.prototype.tryUse;
Shops.prototype.tryUse = function () {
  const G = this.g, P = G.player, n = this.near, I = G.interiors;
  if (P._walk) return true;
  const door = n && n.door && !n.cart && I && !I.inside && I.templateOf && I.templateOf(n.kind) ? n.door : null;
  const oh = door && openNow(n, G.hour);
  if (!door || !P.onFoot || (oh && !oh.open)) return tryUse.call(this);
  const F = P.foot, d = Math.hypot(door.x - F.x, door.z - F.z);
  P._walk = { kind: 'in', tx: door.x, tz: door.z, t: 0, max: Math.min(1.6, d/SPEED + 0.15), near: n, dimmed: false };
  P.act = { kind: 'walk', t: 0 };
  P.human.play('walk', { fade: 0.2 });
  return true;
};
// out (the door inside, F): a step or two onto the footpath. Anything else that takes you out (a teleport, a
// blackout) is still instant
const use = Interiors.prototype.use;
Interiors.prototype.use = function (s) {
  if (!s || s.kind !== 'exit' || this._out) return use.call(this, s);
  const P = this.g.player, had = !!this.cur;
  this._out = true;
  dim(true);
  setTimeout(() => {
    this._out = false;
    if (!this.cur) { dim(false); return; }
    this.exit();
    if (!had || !P.onFoot) { dim(false); return; }
    const F = P.foot;
    P._walk = { kind: 'out', tx: F.x + Math.cos(F.yaw)*1.3, tz: F.z + Math.sin(F.yaw)*1.3, t: 0, max: 1.0 };
    P.act = { kind: 'walk', t: 0 };
    P.human.play('walk', { fade: 0.15 });
    dim(false);
  }, FADE*1000);
};

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), W = this._walk;
  if (!W) return out;
  const F = this.foot, dx = W.tx - F.x, dz = W.tz - F.z, d = Math.hypot(dx, dz);
  W.t += dt;
  if (d > 0.05) {
    const st = Math.min(d, SPEED*dt);
    F.x += dx/d*st; F.z += dz/d*st;
    let dy = Math.atan2(dz, dx) - F.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); F.yaw += dy*Math.min(1, dt*8);
    this.human.holder.position.set(F.x, F.y, F.z); this.human.holder.rotation.set(0, -F.yaw, 0);
  }
  const done = d < 0.3 || W.t > W.max;
  if (W.kind === 'in' && !W.dimmed && (d < 0.9 || W.t > W.max - FADE)) { W.dimmed = true; dim(true); }
  if (done) {
    this._walk = null;
    if (this.act && this.act.kind === 'walk') this.act = null;
    this.human.play('idle', { fade: 0.25 });
    if (W.kind === 'in') {
      const G = window.__nhAskG, S = G && G.shops;
      setTimeout(() => {
        if (S) { const keep = S.near; S.near = W.near; tryUse.call(S); if (!G.interiors.inside) S.near = keep; }
        setTimeout(() => dim(false), 60);
      }, W.dimmed ? FADE*1000*0.6 : 0);
    }
  }
  return out;
};
