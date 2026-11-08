// Ducking into a shop isn't a hiding place from a cop who saw you go in. If one of them had you in sight in the last
// few seconds and is close enough to have seen which door, they come in after you a few seconds later (as long as it
// takes them to get there and off the bike), and chase you round the room like out on the street. One who didn't see
// you go in doesn't know you're there: that's the hiding place. Out of the door again and whoever came in after you
// comes out after you.
// (The chase itself, the speeds, the catching, the traffic and the signals: patches on game/police.js and
// vehicles/driver.js in tools/build-beta.mjs.)
import { Police } from '@orig/game/police.js';
import { Interiors } from '@orig/world/interiors.js';
import { Brain } from '@orig/people/brain.js';

// ---- they remember. When they lose you it isn't over: for a while, a cop who sees that same vehicle (or you, up close, on
// foot) knows it, and it starts again. Changing vehicles is how you get away with it.
const HEAT_AT = [0, 1, 3, 7, 15, 25], levelOf = (x) => { let l = 0; for (let i = 1; i < 6; i++) if (x >= HEAT_AT[i]) l = i; return l; };
function remember(Po, G) {
  const P = G.player, now = performance.now()/1000, M = Po._mem;
  if (Po.heat > 0) {
    Po._peak = Math.max(Po._peak || 0, Po.heat);
    Po._lastV = P.onFoot ? null : P.cur;
    return;
  }
  if (Po._peak) { Po._mem = { veh: Po._lastV, until: now + 240 + Po._peak*160, peak: Po._peak }; Po._peak = 0; return; }
  if (!M || G.free) return;
  if (now > M.until) { Po._mem = null; return; }
  if ((Po._memT = (Po._memT || 0) - 1/60) > 0) return;
  Po._memT = 0.5;
  const it = M.veh ? !P.onFoot && P.cur === M.veh : P.onFoot;
  if (it && Po.copSeeing(P.x, P.z, M.veh ? 40 : 14)) {
    Po._mem = null;
    Po.raiseHeat(M.peak >= 3 ? 2 : 1, M.veh ? 'They know this one' : 'They know your face', 'rash');
  }
}
// ---- blamed on whoever it looks like: what you do in someone else's body is theirs. Going in, everything the world holds
// against you is noted. Coming out, it's put back exactly, and whatever was added while you were them goes to them: the police
// (their points, their charges, what they remember, the description they're looking for), a witness still on the phone, an
// e-challan on its way, whoever you hit and whoever's after you, the neighbourhood's opinion, your own karma. Nobody saw you do
// anything: you were lying down the road.
Police.prototype.hostIn = function () {
  if (this._host) return;
  const G = this.g, L = this.law, ppl = G.people, life = G.life && G.life.s;
  this._host = { pts: this.pts || 0, charges: new Set(this.charges), peak: this._peak || 0, lastV: this._lastV, mem: this._mem, unseenT: this.unseenT, lastSeen: this.lastSeen,
    desc: L && L.desc, calls: new Set(L ? L.calls : []), sms: new Set(this.sms), dues: this.dues ? this.dues.length : 0, inc: new Set(G.brain ? G.brain.inc : []),
    pmem: ppl && ppl.mem ? new Map([...ppl.mem].map(([k, v]) => [k, { ...v }])) : null, karma: life ? life.karma : undefined, respect: life ? life.respect : undefined };
  if (G.rep) G.rep.deed = () => {};
  // in this body nobody knows you: whatever the street had against you is your old body's, kept above and put back when
  // you come out. Anyone fighting you or after you saw who did it, and it wasn't this one: off your own body, they saw you
  // drop where you stood, and stand over it staring; off someone else, hostOut has already sent them after that one
  if (ppl) {
    const Pl = G.player, body = ppl.list.find(q => q && q._vetalBody);
    for (const q of ppl.list) {
      if (!q || q.cop || !(q.foe === Pl || q.chase === Pl)) continue;
      if (q.foe === Pl) ppl.endFight(q);
      q.chase = null; q.grudge = 0; q.angry = 0; q.youFirst = false; q.angryAtYou = false;
      if (body) ppl.watch(q, body.x, body.z, 8 + Math.random()*8); else ppl.backToPath(q);
    }
    if (ppl.brawl) ppl.brawl.active = 0;
    if (ppl.mem) ppl.mem = new Map();
  }
};
Police.prototype.hostOut = function (p) {
  const B = this._host; if (!B) return;
  this._host = null;
  const G = this.g, L = this.law, ppl = G.people, Pl = G.player, life = G.life && G.life.s;
  let got = (this.pts || 0) > B.pts;
  // the police: back as they were
  this.pts = B.pts; this.heat = levelOf(B.pts); this.charges = B.charges; this._peak = B.peak; this._lastV = B.lastV; this._mem = B.mem; this.unseenT = B.unseenT; this.lastSeen = B.lastSeen;
  if (G.hud && G.hud.setHeat && !this.heat) G.hud.setHeat(0);
  if (G.rep) delete G.rep.deed;
  if (life) { if (B.karma !== undefined) life.karma = B.karma; if (B.respect !== undefined) life.respect = B.respect; }
  // anything on its way to them about what you just did: it's about the person you were
  if (L) {
    L.desc = B.desc;
    for (let i = L.calls.length - 1; i >= 0; i--) {
      const q = L.calls[i]; if (B.calls.has(q)) continue;
      const left = q.calling ? q.calling.t : 5;
      q.calling = null; L.calls.splice(i, 1);
      if (p) this.later(Math.max(1, left), () => this.chaseNpc(p));
    }
  }
  this.sms = this.sms.filter((m) => B.sms.has(m));
  if (this.dues && this.dues.length > B.dues) this.dues.length = B.dues;
  if (G.brain) for (const I of G.brain.inc) if (!B.inc.has(I)) { I.byYou = false; I.reported = true; }
  if (ppl) {
    ppl.mem = B.pmem || new Map();
    if (ppl.brawl) ppl.brawl.active = 0;
    for (const q of ppl.list) {
      if (!q || q === p) continue;
      const fought = q.foe === Pl;
      if (fought) ppl.endFight(q);
      q.grudge = 0; q.angry = 0; q.youFirst = false; q.angryAtYou = false;
      // whoever was after you, or squaring up to you, goes for the one they saw do it. They're the one standing there
      if ((fought || q.chase === Pl) && !q.cop && p) { q.fixed = false; q.mode = 'chase'; q.chase = p; q.runSp = q.runSp || 3.4; q.chaseT = 0; q.anim = null; }
    }
  }
  if (got && p) this.chaseNpc(p);
};
// someone else being wanted: a constable or two come for them on foot, they run, and if they're caught they stand there and it's over
Police.prototype.chaseNpc = function (who) {
  const G = this.g, ppl = G.people, kit = G.W && G.W.kit; if (!ppl || !kit || !who) return;
  const L = this._npc || (this._npc = []); if (L.length >= 3 || L.some(c => c.who === who)) return;
  const donor = ppl.list.find(q => q && q.cop && q.look) || this.marshals.find(m => m.H && m.H.look)?.H;
  if (!donor) return;
  for (let i = 0; i < 2; i++) {
    const a = Math.random()*6.28, d = 26 + Math.random()*14, c = ppl.spawnAt(donor.look, who.x + Math.cos(a)*d, who.z + Math.sin(a)*d, 'kaka');
    if (!c) continue;
    c.cop = true; c.lathi = true; c.fixed = false; c.mode = 'chase'; c.chase = who; c.runSp = 3.7 + Math.random()*0.5; c.chaseT = 0; c.anim = null;
    L.push({ c, who, t: 0, caught: 0 });
  }
};
function npcChases(Po, G, dt) {
  const L = Po._npc; if (!L || !L.length) return;
  const ppl = G.people, on = (p) => p && ppl.list.includes(p);
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i], { c, who } = q; q.t += dt;
    if (!on(c) || !on(who) || who.fallen > 0 && who.corpse || q.t > 100) { if (on(c)) { c.mode = 'walk'; c.chase = null; } L.splice(i, 1); continue; }
    const d = Math.hypot(c.x - who.x, c.z - who.z);
    c.chase = who; c.chaseT = 0; c.mode = 'chase';
    if (q.caught) {
      who.mode = 'stand'; who.wait = 30; c.runSp = 1.2;
      if ((q.caught += dt) > 9 && Math.hypot(who.x - G.player.x, who.z - G.player.z) > 18) { ppl.remove(who); ppl.remove(c); L.splice(i, 1); }
    } else if (d < 1.5) q.caught = 0.01;
    else if ((q.run = (q.run || 0) - dt) <= 0) { q.run = 3.5; if (ppl.flee) ppl.flee(who, c.x, c.z, 30); }
  }
}
// a witness to a fight rings it in, some of the time, and in a while somebody comes for whoever started it
const inc = Brain.prototype.incident;
Brain.prototype.incident = function (kind, x, z, o = {}) {
  const r = inc.call(this, kind, x, z, o);
  if (kind === 'fight' && !o.byYou && o.p && o.p !== window.__nhAskG?.player && Math.random() < 0.45) {
    const G = window.__nhAskG, who = o.foe && o.foe.foot ? null : o.foe;
    const off = who && who.x !== undefined ? who : o.p;
    setTimeout(() => { try { if (G.police && G.people.list.includes(off)) G.police.chaseNpc(off); } catch (e) { /* they got away */ } }, 6000 + Math.random()*9000);
  }
  return r;
};

const upd = Police.prototype.updateHeat;
Police.prototype.updateHeat = function (dt) {
  const G = this.g, P = G.player, now = G.t || 0;
  remember(this, G); npcChases(this, G, dt);
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
