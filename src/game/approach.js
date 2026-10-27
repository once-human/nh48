// Out on the street at night, by the clubs: someone from the crowd out front walks over and starts talking.
// Far more often if you're a woman, more with charm, never while you're driving, busy, or with your date.
import { CAST } from '../people/cast.js';

export class StreetApproach {
  constructor(G) { this.g = G; this.cool = 30; this.walker = null; }
  update(dt) {
    const G = this.g, P = G.player, D = G.date, ppl = G.people;
    if (!D || !ppl) return;
    const W = this.walker;
    if (W) {
      const p = W.p;
      if (G.state !== 'play' || !P.onFoot || G.interiors.inside || p.fallen > 0 || (W.t += dt) > 18 || Math.hypot(p.x - P.x, p.z - P.z) > 30) { this.release(); return; }
      if (Math.hypot(p.x - P.x, p.z - P.z) < 1.25) {
        p.mode = 'stand'; p.goal = null; p.anim = 'talk'; p.yaw = Math.atan2(P.z - p.z, P.x - p.x);
        this.walker = null;
        const room = { R: { tpl: 'club', peds: [] }, outside: true, dancing: false };
        if (!D.approach(p, room)) this.done(p);
        else D.onClose = () => this.done(p);
      } else if (p.goal) { p.goal.x = P.x; p.goal.z = P.z; }
      return;
    }
    if ((this.cool -= dt) > 0) return;
    const h = G.hour;
    if (G.state !== 'play' || !P.onFoot || G.interiors.inside || D.cur || !(h >= 21 || h < 2.5)) return;
    let rate = 1 / 240;                              // per second near a club crowd, for a man
    if (P.look.female) rate *= 3.5;
    rate *= 0.4 + G.life.charm * 1.2;
    if (Math.random() > rate * dt) return;
    const cand = ppl.list.filter(q => q.clubber && !q.approached && !D.blocked(q) && !q.hidden && q.mode === 'stand' && !!q.female !== !!P.look.female && Math.hypot(q.x - P.x, q.z - P.z) < 14 && Math.hypot(q.x - P.x, q.z - P.z) > 2);
    if (!cand.length) { this.cool = 6; return; }
    const p = cand[Math.floor(Math.random() * cand.length)];
    p.approached = true;
    if (!p.name) { const pool = CAST[p.female ? 'f' : 'm']; p.name = pool[Math.floor(Math.random() * pool.length)].name; }
    p.home = p.anchor; p.anchor = null;
    if (p.venue) { p.venue.clubCrowd--; p.venue = null; p.clubber = false; }
    ppl.goTo(p, P.x, P.z, () => {});
    this.walker = { p, t: 0 };
  }
  release() { const W = this.walker; this.walker = null; if (W) this.done(W.p); }
  done(p) {
    this.cool = 40 + Math.random() * 60;
    p.anim = null; p.goal = null; p.mode = 'walk';
    if (this.g.people.backToPath) this.g.people.backToPath(p);
  }
}
