// Shaniwar Wada as a place you visit: a ticket window by the Delhi Darwaza (₹25, 8 am to 6:30 pm, as the ASI
// counter charges Indian visitors), a guard at the little wicket door who wants to see it, and tourists: a
// crowd on the garden in front (photos with Bajirao's statue, the gate), families and college groups strolling
// the lawns and the palace plinths inside.
import LM from '../world/landmarks.json';
import { SW } from '../world/landmarks.js';
import { fmt } from './shops.js';

const PRICE = 25, OPEN = 8, CLOSE = 18.5;

export class Wada {
  constructor(G) {
    this.g = G;
    this.L = LM.find(l => l.id === 'shaniwar');
    if (!this.L) return;
    this.c = Math.cos(this.L.rot); this.s = Math.sin(this.L.rot);
    this.counter = this.P(SW.counter[0], SW.counter[1] - 2.2);
    this.tourists = [];
    this.t = 0; this.msgT = 0;
  }
  P(u, v) { const L = this.L; return { x: L.x + u * this.c + v * this.s, z: L.z + u * this.s - v * this.c }; }
  local(x, z) { const dx = x - this.L.x, dz = z - this.L.z; return [dx * this.c + dz * this.s, dx * this.s - dz * this.c]; }
  isOpen() { const h = this.g.hour; return h >= OPEN && h < CLOSE; }
  hasTicket() { const t = this.g.life && this.g.life.s.wadaTicket; return t !== undefined && (this.g.clock || 0) - t < 10; }
  // the ticket window, for the F prompt
  near(x, z) {
    if (!this.L) return null;
    return Math.hypot(x - this.counter.x, z - this.counter.z) < 3.2 ? { kind: 'wada', name: 'Shaniwar Wada tickets', x: this.counter.x, z: this.counter.z } : null;
  }
  label() {
    if (!this.isOpen()) return 'Shaniwar Wada · Ticket window shut · opens 8 am';
    if (this.hasTicket()) return 'You have your ticket · walk in by the small door in the gate';
    return `Buy a ticket for Shaniwar Wada · ${fmt(PRICE)} · F`;
  }
  use() {
    const G = this.g;
    if (!this.isOpen()) { G.hud.toast('Closed for the day', 'Shaniwar Wada is open 8 am to 6:30 pm. The light and sound show is at the same window after dark', 'info', 3); return; }
    if (this.hasTicket()) { G.hud.toast('Already got one', 'In by the wicket in the Delhi Darwaza', 'info', 2); return; }
    if (!G.shops.spend(PRICE)) { G.hud.toast('Not enough cash', `The ticket is ${fmt(PRICE)}`, 'warn', 2); return; }
    G.life.s.wadaTicket = G.clock || 0;
    G.hud.toast('Ticket, ₹25', 'In through the little door in the Delhi Darwaza. “Photo kadhaycha asel tar aat jaa”', 'info', 3.2);
  }
  update(dt) {
    if (!this.L) return;
    const G = this.g, P = G.player;
    if (this.msgT > 0) this.msgT -= dt;
    // the guard at the wicket: no ticket (or shut for the day), no entry. Nothing on wheels goes in at all
    const [u, v] = this.local(P.x, P.z);
    if (Math.abs(u - SW.WU) < 1.2 && v > SW.GV - 0.4 && v < SW.GV + 9) {
      const ok = P.onFoot && this.isOpen() && this.hasTicket();
      const goingIn = !this._wasIn;
      if (!ok && goingIn) {
        const out = this.P(SW.WU, SW.GV - 1.2);
        if (P.onFoot) { P.foot.x = out.x; P.foot.z = out.z; P.foot.v = 0; }
        else if (P.cur) { P.cur.x = out.x; P.cur.z = out.z; P.cur.v = 0; }
        if (this.msgT <= 0) {
          this.msgT = 3;
          const why = !P.onFoot ? ['Gaadi aat nahi', 'Park it outside and walk in'] : !this.isOpen() ? ['Band aahe, udya ya', 'Shaniwar Wada is open 8 am to 6:30 pm'] : ['Ticket? Ticket kaadha', `${fmt(PRICE)} at the window on the left`];
          G.hud.toast(why[0], why[1], 'warn', 2.6);
        }
      }
    } else this._wasIn = v > SW.GV + 9 && u > SW.U0 && u < SW.U1 && v < SW.V1;
    // tourists while you're around and it's open (a few hang about outside in the evening)
    if ((this.t -= dt) > 0) return;
    this.t = 1.5;
    this.tourists = this.tourists.filter(p => G.people.list.includes(p));
    const d = Math.hypot(P.x - this.L.x, P.z - this.L.z), open = this.isOpen();
    if (d > 260) { this.drop(); return; }
    const h = G.hour, busy = open ? (h > 16 || h < 11 ? 1 : 0.7) : (h > 18.5 && h < 21.5 ? 0.35 : 0);
    const wantOut = Math.round(16 * busy), wantIn = open ? Math.round(18 * busy) : 0;
    let nOut = 0, nIn = 0; for (const p of this.tourists) p.wadaIn ? nIn++ : nOut++;
    for (let k = 0; k < 4 && nOut < wantOut; k++, nOut++) this.spawnOutside();
    for (let k = 0; k < 4 && nIn < wantIn; k++, nIn++) this.spawnInside();
    if (!this.guard || !G.people.list.includes(this.guard)) this.spawnGuard();
  }
  drop() {
    const list = this.g.people.list;
    for (const p of [...this.tourists, this.guard].filter(Boolean)) { const i = list.indexOf(p); if (i >= 0) { if (p.body) p.body.release(); list.splice(i, 1); } }
    this.tourists = []; this.guard = null;
  }
  person(x, z, opts) {
    const G = this.g, near = G.W.graph.nearest(x, z, 160);
    if (!near) return null;
    const p = G.people.make(near.e, near.s, near.side || 1, opts);
    p.x = x; p.z = z; p.tourist = true;
    return p;
  }
  // in front: little groups on the garden facing the gate or the statue, phones up
  spawnOutside() {
    const R = Math.random, gu = SW.GU + (R() - 0.5) * 30, gv = SW.GV - 8 - R() * 40;
    const look = R() < 0.6 ? this.P(SW.GU, SW.GV) : this.P(SW.GU, SW.GV - 36);
    const at = this.P(gu, gv);
    const p = this.person(at.x, at.z, { mode: 'stand' });
    if (!p) return;
    p.anchor = { x: at.x, z: at.z, fx: look.x, fz: look.z };
    p.wait = 1e9; p.idle = R() < 0.55 ? 'phone' : R() < 0.5 ? 'talk' : 'idle';
    this.tourists.push(p);
  }
  // inside: strolling from one spot to the next (the fountain, a plinth's courtyard, under a tree)
  spawnInside() {
    const R = Math.random, spots = this.spots || (this.spots = [[SW.GU, SW.GV + 14], SW.karanje, ...SW.plinths.map(q => [q[0] + (q[0] < 0 ? q[2] / 2 + 3 : -q[2] / 2 - 3), q[1]]), ...SW.cross.map(v => [SW.GU + 20, v]), ...SW.cross.map(v => [SW.GU - 22, v])]);
    const s0 = spots[Math.floor(R() * spots.length)], at = this.P(s0[0] + (R() - 0.5) * 6, s0[1] + (R() - 0.5) * 6);
    const p = this.person(at.x, at.z, { mode: 'walk' });
    if (!p) return;
    p.wadaIn = true; p.speed *= 0.7;
    const next = (q) => {
      if (R() < 0.35) { q.mode = 'stand'; q.anchor = { x: q.x, z: q.z }; q.idle = R() < 0.5 ? 'phone' : 'talk'; q.wait = 8 + R() * 20; q.anchorNext = next; return; }
      const s = spots[Math.floor(R() * spots.length)], t = this.P(s[0] + (R() - 0.5) * 6, s[1] + (R() - 0.5) * 6);
      this.g.people.goTo(q, t.x, t.z, next);
    };
    next(p);
    this.tourists.push(p);
  }
  // the ASI guard by the wicket, in khaki
  spawnGuard() {
    const at = this.P(SW.WU + 1.6, SW.GV - 1.0), look = this.P(SW.WU, SW.GV - 8);
    const p = this.person(at.x, at.z, { mode: 'stand', female: false });
    if (!p) return;
    p.fixed = true; p.anchor = { x: at.x, z: at.z, fx: look.x, fz: look.z }; p.wait = 1e9; p.idle = 'arms_folded';
    p.shirt = [0.45, 0.38, 0.22]; p.lower = [0.4, 0.34, 0.2];
    if (p.look && p.look.top) { p.look.top.setRGB?.(0.45, 0.38, 0.22); p.look.bottom?.setRGB?.(0.4, 0.34, 0.2); }
    this.guard = p;
  }
}
