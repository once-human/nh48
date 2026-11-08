// The police aren't only after you. Someone else can be wanted too, and how badly decides who comes: a fight on the street
// gets two constables on foot (beta/game/pursuit.js chaseNpc); a vehicle that knocks you down and drives on gets a
// traffic marshal on his bike after it, lights going, and if you were badly hurt a patrol jeep as well; they run it down
// through the traffic, and it pulls over (some drivers try to get away first, and go faster) and sits at the kerb while
// they deal with it, then everyone goes on their way. It's called in by whoever saw it: a cop close by sends them at once,
// someone on the footpath gets their phone out and it takes a little while. Nobody saw it, nobody comes.
// Each of these units is its own (not the ones after you: they never come for you, and a chase of yours doesn't send
// them home).
import { Police, Marshal } from '@orig/game/police.js';
import { SPECS } from '@orig/vehicles/vehicle.js';

const nameOf = (o) => (SPECS[o.type] && SPECS[o.type].real) || 'vehicle';

class Unit extends Marshal {
  constructor(police, x, z, th, kind, o, role) {
    super(police, x, z, th, kind, role);
    this.tgt = o; this.oid = o.id; this.t = 0; this.held = 0; this.done = 0; this.unit = true;
  }
  gone() { const o = this.tgt; return !o || !o.alive || o.id !== this.oid || o.wreck; }
  update(dt) {
    const v = this.veh, o = this.tgt; this.t += dt; this.stunT -= dt;
    if (this.done > 0 || this.gone()) {
      if (!(this.done > 0)) this.done = 60;
      this.done -= dt;
      this.drive(v.x + Math.cos(v.th)*60, v.z + Math.sin(v.th)*60, 9, dt, false, false); this.animate(dt, false); return;
    }
    const d = Math.hypot(o.x - v.x, o.z - v.z);
    if (this.held > 0) {
      // pulled over beside it, the challan being written; then off
      this.held -= dt; o.argue = Math.max(o.argue || 0, 0.5);
      this.drive(o.x, o.z, 0, dt, false, false); this.animate(dt, true);
      if (this.held <= 0) { o.argue = 0; o.angry = 0; this.done = 60; }
      return;
    }
    // after it: where it's going, a little ahead
    const hx = o.hx ?? Math.cos(o.th || 0), hz = o.hz ?? Math.sin(o.th || 0);
    this.drive(o.x + hx*(o.v || 0)*0.8, o.z + hz*(o.v || 0)*0.8, (this.jeep ? 18 : 21), dt, false, true);
    this.animate(dt, true);
    if (d < 9) {
      // caught up: it pulls in (the one who ran slows back down to what it was)
      if (o._runMul) { o.vMul = o._runMul; o._runMul = 0; }
      o.argue = 25; this.held = 22 + Math.random()*10;
      const G = this.G, P = G.player;
      if (Math.hypot(o.x - P.x, o.z - P.z) < 140) G.hud.toast('Pulled over', `The ${nameOf(o)} that hit you, with the police beside it`, 'info', 3);
      for (const u of this.P._units || []) if (u !== this && u.tgt === o && !u.held) u.held = this.held;
    } else if (this.t > 150) this.done = 60;                      // (lost it)
  }
  catchDist() { return 1e9; }
}

// a unit for someone, from round the corner (never where you're looking)
function send(Po, o, kind, role) {
  const G = Po.g, W = Po.W;
  for (let k = 0; k < 40; k++) {
    const a = Math.random()*Math.PI*2, r = 80 + Math.random()*70, x = o.x + Math.cos(a)*r, z = o.z + Math.sin(a)*r;
    const e = W.graph.nearest(x, z, 30, (e) => e.rank >= 2); if (!e) continue;
    const t = W.graph.at(e.e, e.s);
    if (G.inView && G.inView(t[0], t[1])) continue;
    try { const u = new Unit(Po, t[0], t[1], Math.atan2(o.z - t[1], o.x - t[0]), kind, o, role); (Po._units || (Po._units = [])).push(u); } catch (e) { console.warn('unit', e); }
    return;
  }
}
// how badly they're wanted, and who comes for it
Police.prototype.wantNpc = function (o, lvl, why) {
  const W = this._npcW || (this._npcW = new Map()), was = W.get(o);
  if (was && was.lvl >= lvl) return;
  W.set(o, { lvl, why, t: 0 });
  if (o.T) {                                                       // a vehicle in the traffic
    if (Math.random() < 0.4 && !o._runMul) { o._runMul = o.vMul || 1; o.vMul = o._runMul*1.35; }     // (it tries to get away)
    send(this, o, 'bike', 'traffic');
    if (lvl >= 3) send(this, o, 'jeep', 'beat');
  } else this.chaseNpc && this.chaseNpc(o);
};

// knocked down by something that didn't stop
const onEvent = Police.prototype.onEvent;
Police.prototype.onEvent = function (ev) {
  onEvent.call(this, ev);
  if (ev.type !== 'gotHit' || !ev.o || !ev.o.T || this.g.free) return;
  const G = this.g, P = G.player, o = ev.o;
  if (Math.random() < 0.3) return;                                  // (this one stops, and it's words at the roadside: o.angry)
  const hurt = (P.hp ?? 100) < 35 ? 3 : 2;
  // who saw it: a cop near enough sends them now; else someone on the footpath, phone out, a while later
  if (this.copSeeing(P.x, P.z, 50)) { this.later(1.5, () => this.wantNpc(o, hurt, 'hitrun')); return; }
  const ppl = G.people; let w = null, bd = 30;
  for (const q of ppl.list) { if (q.hidden || q.cop || q.fallen > 0 || q.act) continue; const d = Math.hypot(q.x - P.x, q.z - P.z); if (d < bd) { bd = d; w = q; } }
  if (!w) return;
  w.yaw = Math.atan2(P.z - w.z, P.x - w.x); w.hx = Math.cos(w.yaw); w.hz = Math.sin(w.yaw); w.v = 0;
  w.act = { kind: 'react', clip: 'phone', speed: 1, t: 0, dur: 10 };
  this.later(8 + Math.random()*10, () => { if (o.alive) this.wantNpc(o, hurt, 'hitrun'); });
};

// their own units, every frame
const upd = Police.prototype.updateHeat;
Police.prototype.updateHeat = function (dt) {
  upd.call(this, dt);
  const U = this._units; if (!U || !U.length) return;
  const P = this.g.player;
  for (let i = U.length - 1; i >= 0; i--) {
    const u = U[i];
    try { u.update(dt); } catch (e) { console.warn('unit', e); u.done = 0.01; u.tgt = null; }
    const d = Math.hypot(u.veh.x - P.x, u.veh.z - P.z);
    if ((u.done > 0 && (u.done < 1 || d > 160) && !(this.g.inView && this.g.inView(u.veh.x, u.veh.z) && d < 400)) || d > 600) { u.dispose(); U.splice(i, 1); }
  }
  if (this._npcW) for (const [o, w] of this._npcW) if ((w.t += dt) > 180 || (o.T && !o.alive)) this._npcW.delete(o);
};
