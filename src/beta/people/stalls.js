// A stall keeper keeps to the stall. They used to drop it for anything: someone in the area who'd heard about you, you
// standing too close, a stare, a passer-by's fright; once they'd run, the stall was theirs no more and they walked off
// down the road for good. Now: an odd look at you, and back to work. They run only when it's a real emergency (you've
// hit them and they're frightened, a blast nearby), and once it's over they come back and stand behind it again.
// One who fights back fights at the stall: a few steps after you and no further, then back behind it.
import { People } from '@orig/people/peds.js';

const now = () => performance.now()/1000;
const LEASH = 7;           // how far one who's fighting you comes out from behind the stall (m)

function emergency(ppl, p) {
  if (p._hurtAt && now() - p._hurtAt < 8) return true;
  const B = ppl.brain;
  if (B) for (const I of B.inc) if (I.kind === 'blast' && Math.hypot(I.x - p.x, I.z - p.z) < 45) return true;
  return false;
}
const keep = (p) => { if (p.anchor && !p._home) p._home = { ...p.anchor }; };

const hurt = People.prototype.hurt;
People.prototype.hurt = function (p, ...a) { if (p && p.vendor) { keep(p); p._hurtAt = now(); } return hurt.call(this, p, ...a); };

const flee = People.prototype.flee;
People.prototype.flee = function (p, x, z, dist) {
  if (p.vendor) {
    keep(p);
    if (!emergency(this, p)) { p.react = 2.4; p.reactAt = { x, z }; p.reactAnim = 'no'; return; }      // a look, that's all
    p._ranT = now();
  }
  return flee.call(this, p, x, z, dist);
};

const upd = People.prototype.update;
People.prototype.update = function (dt, ...rest) {
  const r = upd.call(this, dt, ...rest);
  if ((this._vsT = (this._vsT || 0) - dt) <= 0) { this._vsT = 0.5; tend(this); }
  return r;
};
function tend(ppl) {
  for (const p of ppl.list) {
    if (!p.vendor) continue;
    keep(p);
    const H = p._home;
    if (!H || p.corpse || p.dead || p.ko || p.fallen > 0 || p.hidden || p.pax || p.ctl) continue;
    if (p.mode === 'fight') { if (Math.hypot(p.x - H.x, p.z - H.z) > LEASH) { ppl.endFight(p); home(ppl, p); } continue; }
    if (p.fleeing && now() - (p._ranT || 0) < 25) continue;                // ran for it: back when it's blown over
    if (p.mode === 'stand' && p.anchor) { p._going = false; continue; }
    if (p._going && p.mode === 'free') continue;
    home(ppl, p);
  }
}
// back behind the stall, facing the street, for the rest of their hours
function home(ppl, p) {
  const H = p._home; p._going = true;
  ppl.goTo(p, H.x, H.z, (q) => { q._going = false; q.fleeing = false; q.mode = 'stand'; q.anchor = { ...H }; q.wait = 1e9; q.x = H.x; q.z = H.z; q.anim = null; });
}
