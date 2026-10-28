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
    if (Math.hypot(x - this.counter.x, z - this.counter.z) < 3.2) return { kind: 'wada', act: 'ticket', name: 'Shaniwar Wada tickets', x: this.counter.x, z: this.counter.z };
    const [u, v] = this.local(x, z);
    if (Math.abs(u - SW.GU) < 4.5 && v > SW.GV - 4 && v < SW.GV + 0.5) { const g = this.P(SW.WU, SW.GV - 1); return { kind: 'wada', act: 'in', name: 'Delhi Darwaza', x: g.x, z: g.z }; }
    if (Math.abs(u - SW.GU) < 4.5 && v > SW.GV + 8.5 && v < SW.GV + 13) { const g = this.P(SW.GU, SW.GV + 10); return { kind: 'wada', act: 'out', name: 'Delhi Darwaza', x: g.x, z: g.z }; }
    return null;
  }
  label(n) {
    if (n && n.act === 'in') return !this.isOpen() ? 'Delhi Darwaza · Shut for the night · opens 8 am' : this.hasTicket() ? 'Go in through the Delhi Darwaza · F' : `Delhi Darwaza · Ticket first, ${fmt(PRICE)} at the window on the left`;
    if (n && n.act === 'out') return 'Leave by the Delhi Darwaza · F';
    if (!this.isOpen()) return 'Shaniwar Wada · Ticket window shut · opens 8 am';
    if (this.hasTicket()) return 'You have your ticket · walk in by the small door in the gate';
    return `Buy a ticket for Shaniwar Wada · ${fmt(PRICE)} · F`;
  }
  use(n) {
    const G = this.g, P = G.player;
    if (n && n.act === 'out') { const o = this.P(SW.WU, SW.GV - 2.4), f = this.P(SW.WU, SW.GV - 20); P.teleportFoot(o.x, o.z, Math.atan2(f.z - o.z, f.x - o.x), G.traffic); G.rig.inited = false; return; }
    if (n && n.act === 'in') {
      if (!this.isOpen()) { G.hud.toast('Band aahe, udya ya', 'Shaniwar Wada is open 8 am to 6:30 pm', 'warn', 2.6); return; }
      if (!this.hasTicket()) { G.hud.toast('Ticket? Ticket kaadha', `${fmt(PRICE)} at the window on the left`, 'warn', 2.6); return; }
      const i = this.P(SW.GU, SW.GV + 11.5), f = this.P(SW.GU, SW.GV + 40);
      P.teleportFoot(i.x, i.z, Math.atan2(f.z - i.z, f.x - i.x), G.traffic); G.rig.inited = false;
      G.hud.toast('Shaniwar Wada', 'The plinths of the palace, Hazari Karanje, the steps up to the ramparts on either side of the gate', 'info', 4);
      return;
    }
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
    this.haunt(dt);
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
    // closing time: the crowd goes home (a couple at a time, never the ones right in front of you)
    let extraOut = nOut - wantOut, extraIn = nIn - wantIn;
    for (const p of [...this.tourists]) {
      if (p.wadaIn ? extraIn <= 0 : extraOut <= 0) continue;
      if (Math.hypot(p.x - P.x, p.z - P.z) < 12) continue;
      this.remove(p); p.wadaIn ? extraIn-- : extraOut--;
    }
    if (open && (!this.guard || !G.people.list.includes(this.guard))) this.spawnGuard();
    if (!open && this.guard) { this.remove(this.guard); this.guard = null; }
  }
  // after midnight, by the Delhi Darwaza: Pune's oldest ghost story. Young Peshwa Narayanrao was killed in the
  // wada in 1773 and, the story goes, on some nights you can still hear him call for his uncle
  haunt(dt) {
    const G = this.g, P = G.player, h = G.hour;
    if (!(h >= 23.5 || h < 4) || !P.onFoot) { this.hauntT = 0; return; }
    const g = this.P(SW.GU, SW.GV - 10);
    if (Math.hypot(P.x - g.x, P.z - g.z) > 45) { this.hauntT = 0; return; }
    const night = Math.floor(((G.clock || 0) + 8) / 24);
    if (this.hauntNight === night) return;
    if ((this.hauntT = (this.hauntT || 0) + dt) < 7) return;
    this.hauntNight = night;
    this.wail();
    G.hud.say && G.hud.say('…', 'काका, मला वाचवा!', '“Uncle, save me!”', 5);
    G.later(5.5, () => G.hud.toast('Did you hear that?', 'Shaniwar Wada after midnight. Narayanrao Peshwa, 1773. Puneri dadis still won’t walk past here at night', 'info', 6));
  }
  // a thin voice-like wail: filtered noise and a falling tone, far off, from the gate
  wail() {
    const A = this.g.audio, ctx = A && A.ctx;
    if (!ctx) return;
    try {
      const t = ctx.currentTime, out = ctx.createGain(); out.gain.value = 0; out.connect(A.master || ctx.destination);
      out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.22, t + 1.2); out.gain.linearRampToValueAtTime(0.16, t + 3); out.gain.linearRampToValueAtTime(0, t + 5);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(430, t + 1.6); o.frequency.exponentialRampToValueAtTime(560, t + 2.4); o.frequency.exponentialRampToValueAtTime(300, t + 4.8);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency);
      const n = ctx.createBufferSource(), buf = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      n.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2.5;
      const og = ctx.createGain(); og.gain.value = 0.35; const ng = ctx.createGain(); ng.gain.value = 0.5;
      const rv = ctx.createDelay(); rv.delayTime.value = 0.23; const fb = ctx.createGain(); fb.gain.value = 0.45; rv.connect(fb); fb.connect(rv);
      o.connect(og); og.connect(out); n.connect(bp); bp.connect(ng); ng.connect(out); out.connect(rv); rv.connect(A.master || ctx.destination);
      o.start(t); lfo.start(t); n.start(t); o.stop(t + 5.2); lfo.stop(t + 5.2); n.stop(t + 5.2);
      setTimeout(() => { try { fb.disconnect(); rv.disconnect(); } catch (e) { /* gone */ } }, 9000);
    } catch (e) { /* no sound, still the words */ }
  }
  remove(p) {
    const list = this.g.people.list, i = list.indexOf(p);
    if (i >= 0) { if (p.body) p.body.release(); list.splice(i, 1); }
    this.tourists = this.tourists.filter(q => q !== p);
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
