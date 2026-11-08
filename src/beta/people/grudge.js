// Whoever you hit has it in for the body that hit them, not for you. Hit someone and then go into someone else (Vetal),
// or hop on to a third: the one you hit never saw you go anywhere. They saw that person do it, so that's who they go
// for (beta/game/pursuit.js hands them over as you leave a body). Here's what they do when they catch up: they square
// up and lay into them, a few blows, the one being hit staggering back and then getting away from them, and once
// they've had their go (or they can't catch them, or the one they were after is down) they let it go and carry on.
// Left your own body to do it? They saw you drop where you stood: they stop, stand over it and stare.
import { People } from '@orig/people/peds.js';

const sc = People.prototype.stepChase;
People.prototype.stepChase = function (p, dt) {
  const T = p.chase;
  // the police (a constable after someone: their own lathi), and anyone after you, as they always were
  if (!T || T.foot || p.cop || p.lathi) return sc.call(this, p, dt);
  const gone = !this.list.includes(T) || T.corpse || T.fallen > 0 || T.hidden || T.pax;
  const G = p._grudge || (p._grudge = { hits: 0, t: 0, swing: 0.4, land: -1 });
  G.t += dt;
  if (gone || G.hits >= 2 + (p.id % 3) || G.t > 30) { p._grudge = null; p.chase = null; p.act = null; this.backToPath(p); return; }
  const dx = T.x - p.x, dz = T.z - p.z, d = Math.hypot(dx, dz);
  if (d >= 1.1) return sc.call(this, p, dt);
  p.v = 0; p.yaw = Math.atan2(dz, dx); p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
  // a swing, and a moment later it lands: they're knocked back a step and get away
  if (!p.act && (G.swing -= dt) <= 0) {
    G.swing = 0.9 + Math.random()*0.6;
    p.act = { kind: 'atk', clip: Math.random() < 0.5 ? 'hook' : 'cross', speed: 1.1, t: 0, dur: 0.6 }; p.actId = (p.actId || 0) + 1;
    G.land = 0.3;
  }
  if (G.land > 0 && (G.land -= dt) <= 0) {
    G.hits++;
    window.__nhNudge?.(T, dx/(d || 1)*1.6, dz/(d || 1)*1.6);
    T.act = { kind: 'react', clip: 'block', speed: 1.3, t: 0, dur: 0.45 }; T.actId = (T.actId || 0) + 1;
    if (T.hp !== undefined) T.hp = Math.max(1, T.hp - 6);
    this.flee(T, p.x, p.z, 25);
    this.speakAs?.('fight', p, 1, 3);
  }
};
