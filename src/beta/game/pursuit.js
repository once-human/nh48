// Ducking into a shop isn't a hiding place from a cop who saw you go in. If one of them had you in sight in the last
// few seconds and is close enough to have seen which door, they come in after you a few seconds later (as long as it
// takes them to get there and off the bike), and chase you round the room like out on the street. One who didn't see
// you go in doesn't know you're there: that's the hiding place. Out of the door again and whoever came in after you
// comes out after you.
// (The chase itself, the speeds, the catching, the traffic and the signals: patches on game/police.js and
// vehicles/driver.js in tools/build-beta.mjs.)
import { Police } from '@orig/game/police.js';
import { Interiors } from '@orig/world/interiors.js';

const upd = Police.prototype.updateHeat;
Police.prototype.updateHeat = function (dt) {
  const G = this.g, P = G.player, now = G.t || 0;
  // who's seen you lately, and where they were
  if (this.heat > 0) for (const m of this.marshals) if (m.sees) { m._sawAt = now; m._sawP = { x: P.x, z: P.z }; }
  // following you in
  const F = this._follow, IN = G.interiors;
  if (F && IN && IN.inside && (F.t -= dt) <= 0 && this.heat > 0) {
    this._follow = null;
    const m = F.m, R = IN.cur.R;
    if (this.marshals.includes(m)) comeIn(this, m, R);
  }
  if (F && (!IN || !IN.inside || this.heat === 0)) this._follow = null;
  upd.call(this, dt);
};
// in through the door after you: whoever of the unit is already on foot, else the rider (or the jeep's crew) gets off
function comeIn(police, m, R) {
  const G = police.g, P = G.player, dx = R.O.x, dz = R.O.z + 1.2;
  if (m.mode !== 'foot') {
    // off the bike at the door (dismount makes them, chasing you, beside the vehicle; then they're at the door)
    m.dismount();
  }
  let k = 0;
  for (const p of m.foot) {
    p._outside = { x: p.x, z: p.z };
    p.x = dx + (k++ - 0.5)*0.7; p.z = dz; p.chase = P; p.mode = 'chase'; p.chaseT = Math.min(p.chaseT || 0, -8);
    if (p.dodgeX !== undefined) p.dodgeX = p.dodgeZ = 0;
  }
  police.say && police.say('m_spot2', m);
  G.hud.toast('Police!', 'He saw you go in. He’s come in after you', 'bad', 2.6);
}

const enter = Interiors.prototype.enter;
Interiors.prototype.enter = function (ctx) {
  const G = this.g, P = G.player, x = P.x, z = P.z;
  const r = enter.call(this, ctx);
  const pol = G.police;
  if (!this.inside || !pol || !(pol.heat > 0)) return r;
  // the one who saw you last (in the last 4 s), close enough to have seen this door
  const now = G.t || 0;
  let best = null, bd = 1e9;
  for (const m of pol.marshals) {
    if (!(m._sawAt > now - 4) || m.stunT > 0) continue;
    const ex = m.mode === 'foot' && m.foot[0] ? m.foot[0] : m.veh, d = Math.hypot(ex.x - x, ex.z - z);
    if (d < 70 && d < bd) { bd = d; best = m; }
  }
  if (best) pol._follow = { m: best, t: 1.5 + bd/(best.mode === 'foot' ? 5.5 : 9) };
  return r;
};
const exit = Interiors.prototype.exit;
Interiors.prototype.exit = function () {
  const G = this.g, C = this.cur, pol = G.police;
  const R = C && C.R;
  exit.call(this);
  if (!R || !pol) return;
  pol._follow = null;
  // whoever came in after you comes out of the same door, just behind you
  const P = G.player;
  for (const m of pol.marshals) for (const p of m.foot) {
    if (Math.abs(p.x - R.O.x) > 150 || Math.abs(p.z - R.O.z) > 150) continue;
    p.x = P.x - Math.cos(P.th)*1.6; p.z = P.z - Math.sin(P.th)*1.6; p.chase = P;
  }
};
