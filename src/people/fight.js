// Street fights. E throws a punch (keep pressing: jab, cross, hook), Q rolls out of the way.
// Whoever you hit decides by who they are (people/areas.js personas): a dada or a delivery bhaiya
// squares up and hits back, a kaku threatens you with her chappal and shouts for help, an aaji
// just runs. People around stop to watch (phones out) or get away; a tough friend may join in;
// a traffic cop who sees it, or gets hit himself, brings the police (police.raiseHeat).
// Knock someone's health to zero and they're out cold for a few seconds; lose yours and you
// wake up on the footpath with some cash missing.
import { clamp, wrapAngle, RNG } from '../core/util.js';

// who fights back (chance), how much they can take, how hard they hit
export const TOUGH = { dada: 0.8, bhaiya: 0.7, collegeboy: 0.6, kaka: 0.3, kpguy: 0.35, tai: 0.25, kpgirl: 0.1, kaku: 0.15 };
const HP = { ajoba: 35, aaji: 30, kaku: 55, aunty: 50, kaka: 65, tai: 60, kpgirl: 55, collegegirl: 55, kpguy: 75, collegeboy: 80, dada: 100, bhaiya: 95 };
const POWER = { dada: 1.25, bhaiya: 1.15, collegeboy: 1, kpguy: 0.9, kaka: 0.85, tai: 0.85, kaku: 0.7, kpgirl: 0.7 };

// clip, playback speed, length (s), impact time (s), damage, reach (m), shove (m)
const MOVES = {
  punch: { clip: 'punch', speed: 1.6, dur: 0.5, hit: 0.2, dmg: 10, reach: 1.25, push: 0.22 },
  cross: { clip: 'cross', speed: 1.55, dur: 0.6, hit: 0.26, dmg: 14, reach: 1.3, push: 0.35 },
  hook: { clip: 'hook', speed: 0.9, dur: 0.62, hit: 0.32, dmg: 22, reach: 1.25, push: 0.6, down: 0.45 },
};
const COMBO = ['punch', 'cross', 'hook'];
const NPC_MOVES = ['punch', 'punch', 'cross', 'cross', 'hook'];

export class Brawl {
  constructor(game) {
    this.g = game; this.rng = new RNG(4242);
    this.active = 0;           // seconds since the last blow anywhere near you (0 = no fight)
    this.combo = 0; this.comboT = 0; this.queued = false;
    this.heatT = 0;
  }
  get people() { return this.g.people; }
  get P() { return this.g.player; }

  // ---------------------------------------------------------------- the player
  update(dt, input) {
    const P = this.P, G = this.g;
    if (P.hp === undefined) P.hp = 100;
    P.hurtT = (P.hurtT || 0) + dt;
    if (this.active > 0) { this.active += dt; if (this.active > 12) this.active = 0; }
    this.heatT -= dt;
    // health comes back on its own once nobody has hit you for a while
    if (P.hurtT > 6 && P.hp < 100 && !P.ko) P.hp = Math.min(100, P.hp + dt * 7);
    if (!P.onFoot) { P.act = null; this.queued = false; return; }
    const F = P.foot, H = P.human;
    this.comboT -= dt;
    if (P.ko) return;
    const busyDown = P.downT > 0 || F.climb || F.air;
    if (input.took('KeyE') && !busyDown) {
      if (P.act && P.act.kind === 'atk') { if (P.act.t > P.act.dur * 0.35) this.queued = true; }
      else if (!P.act) this.attack();
    }
    if (input.took('KeyQ') && !busyDown && !(P.act && P.act.kind === 'roll')) this.roll(input);
    const A = P.act;
    if (!A) return;
    A.t += dt;
    if (A.kind === 'atk') {
      // turn into the target and step in a little
      if (A.target) {
        const q = A.target, dx = q.x - F.x, dz = q.z - F.z, d = Math.hypot(dx, dz);
        F.yaw += wrapAngle(Math.atan2(dz, dx) - F.yaw) * Math.min(1, dt * 18);
        if (d > 0.9 && A.t < A.hit) { const st = Math.min(d - 0.85, dt * 2.6); F.x += dx / d * st; F.z += dz / d * st; }
      }
      if (!A.done && A.t >= A.hit) { A.done = true; this.landPlayer(A); }
      if (A.t >= A.dur) {
        P.act = null;
        if (this.queued) { this.queued = false; this.attack(); }
      }
    } else if (A.kind === 'roll') {
      const k = A.t < 0.5 ? 1 : Math.max(0, 1 - (A.t - 0.5) / 0.25);
      A.vx = A.dx * 5.2 * k; A.vz = A.dz * 5.2 * k;
      if (A.t >= A.dur) P.act = null;
    } else if (A.kind === 'hurt') {
      if (A.t >= A.dur) P.act = null;
    }
    void H;
  }
  // nearest person in front of you within reach of a lunge
  pickTarget() {
    const F = this.P.foot, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
    let best = null, bs = 1e9;
    for (const p of this.people.list) {
      if (p.hidden || p.pax || p.kid || (p.fallen > 0 && p.ko)) continue;
      const dx = p.x - F.x, dz = p.z - F.z;
      if (Math.abs(dx) > 3 || Math.abs(dz) > 3) continue;
      const d = Math.hypot(dx, dz);
      if (d > 2.6 || d < 1e-3) continue;
      const c = (dx * fx + dz * fz) / d;
      if (c < 0.25 && d > 0.9) continue;
      // prefer whoever's already fighting you, then straight ahead, then close
      const s = d * (1.6 - c) * (p.foe ? 0.5 : 1);
      if (s < bs) { bs = s; best = p; }
    }
    return best;
  }
  attack() {
    const P = this.P;
    if (this.comboT <= 0) this.combo = 0;
    const name = COMBO[this.combo % COMBO.length];
    this.combo = (this.combo + 1) % COMBO.length; this.comboT = 0.9;
    const M = MOVES[name];
    P.act = { kind: 'atk', name, t: 0, dur: M.dur, hit: M.hit, M, target: this.pickTarget(), done: false };
    P.human.play(M.clip, { once: true, fade: 0.06, speed: M.speed, restart: true });
    this.g.audio.whoosh?.(0.5);
  }
  roll(input) {
    const P = this.P, F = P.foot;
    let dx = F.vx, dz = F.vz, d = Math.hypot(dx, dz);
    if (d < 0.5) { dx = -Math.cos(F.yaw); dz = -Math.sin(F.yaw); d = 1; }        // standing still: roll back out of reach
    dx /= d; dz /= d;
    F.yaw = Math.atan2(dz, dx);
    P.act = { kind: 'roll', t: 0, dur: 0.78, dx, dz, vx: 0, vz: 0, iframe: true };
    P.human.play('roll', { once: true, fade: 0.06, speed: 1.25, restart: true });
    void input;
  }
  landPlayer(A) {
    const P = this.P, F = P.foot, M = A.M;
    const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
    let q = A.target;
    if (q) {
      const dx = q.x - F.x, dz = q.z - F.z, d = Math.hypot(dx, dz);
      if (d > M.reach + 0.25 || (dx * fx + dz * fz) < 0.2 * d || q.hidden) q = null;
    }
    if (!q) return;          // whiff
    const crit = q.foe !== this.P && !q.angryAtYou;   // a sucker punch on someone not expecting it
    const dmg = M.dmg * (crit ? 1.35 : 1) * this.rng.range(0.85, 1.15);
    this.people.hurt(q, dmg, F.x, F.z, M, true);
    this.g.audio.punch?.(M.dmg / 20);
    this.g.rig?.shake?.(0.08 + M.dmg / 200);
    this.started(q);
  }
  // a fight starts (or carries on) with q: everyone around reacts, and maybe the police
  started(q) {
    const G = this.g, first = !this.active;
    this.active = 0.01;
    if (q.cop) { if (this.heatT <= 0) { this.heatT = 25; G.police.raiseHeat(2, 'Assaulting a police officer'); } }
    else if (this.heatT <= 0 && G.police.copSeeing && G.police.copSeeing(q.x, q.z, 40)) { this.heatT = 40; G.police.raiseHeat(1, 'Assault — a cop saw you'); }
    if (first) this.witnesses(q);
  }
  witnesses(q) {
    const ppl = this.people, r = this.rng;
    let shouted = false;
    for (const p of ppl.list) {
      if (p === q || p.hidden || p.pax || p.cop || p.mode === 'fight' || p.fallen > 0 || p.ctl) continue;
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d > 16) continue;
      // a friend standing with them (same group outside a café or bar) may join in
      if (q.venue && p.venue === q.venue && r.next() < (TOUGH[p.persona] || 0) * 0.7) { ppl.startFight(p, this.P); continue; }
      const u = r.next();
      if (u < 0.4) ppl.flee(p, this.P.x, this.P.z, 18 + r.next() * 12);
      else if (u < 0.85) {
        const a = Math.atan2(p.z - q.z, p.x - q.x), rr = 4 + r.next() * 2.5;
        ppl.goTo(p, q.x + Math.cos(a) * rr, q.z + Math.sin(a) * rr, (w) => { w.mode = 'watch'; w.watch = { x: q.x, z: q.z, follow: q }; w.wait = 10 + r.next() * 10; w.anim = r.pick(['phone', 'phone', 'arms_folded', 'no']); });
      }
      if (!shouted && d < 10 && r.next() < 0.5) shouted = ppl.speakAs('crowd', p, 1, 4);
    }
  }

  // someone hits you
  hurtPlayer(dmg, sx, sz) {
    const P = this.P, F = P.foot, G = this.g;
    if (!P.onFoot || P.ko || P.downT > 0) return false;
    if (P.act && P.act.iframe) return false;
    P.hp = Math.max(0, P.hp - dmg); P.hurtT = 0;
    this.active = 0.01;
    const dx = F.x - sx, dz = F.z - sz, d = Math.hypot(dx, dz) || 1;
    F.x += dx / d * 0.25; F.z += dz / d * 0.25;
    G.audio.punch?.(dmg / 14);
    G.rig?.shake?.(0.15 + dmg / 60);
    G.hud.hurt?.();
    if (P.hp <= 0) { this.knockOut(); return true; }
    P.act = { kind: 'hurt', t: 0, dur: 0.38 };
    P.human.play(this.rng.chance(0.5) ? 'hit_head' : 'hit', { once: true, fade: 0.05, restart: true });
    this.queued = false;
    return true;
  }
  knockOut() {
    const P = this.P, G = this.g;
    P.ko = true; P.act = null; P.downT = 7;
    P.human.play('death', { once: true, fade: 0.1 });
    G.hud.flash?.('Knocked out', 'Pune doesn’t forget');
    // everyone who was fighting you wanders off, pleased with themselves
    for (const p of this.people.list) if (p.foe === P) { this.people.endFight(p, true); }
    G.later?.(6.2, () => {
      P.ko = false; P.hp = 45; P.hurtT = 0;
      const lost = Math.min(G.stats.money, Math.round(this.rng.range(150, 600) / 10) * 10);
      G.stats.money -= lost; G.saveStats?.();
      G.hud.toast('You come round on the footpath', lost ? `Someone helped themselves to ₹${lost} from your wallet` : 'Your wallet was empty anyway', 'bad', 4.5);
      this.active = 0;
    });
  }

  // ---------------------------------------------------------------- the people (called from People.step)
  stepPed(p, dt) {
    const P = this.P, ppl = this.people;
    p.fightT += dt;
    if (p.stun > 0) { p.stun -= dt; p.v = 0; return; }
    const tx = P.x, tz = P.z, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    // done: you drove off, ran away, it's gone on too long, or they've had enough
    if (!P.onFoot || P.ko || d > 24 || p.fightT > 50) { ppl.endFight(p, P.ko); return; }
    if (p.hp < p.hp0 * 0.3 && !p.cop && !p.lastStand) { ppl.speakAs('flee', p, 0.8, 3); ppl.endFight(p); ppl.flee(p, tx, tz, 30); return; }
    const yaw = Math.atan2(dz, dx);
    p.yaw += wrapAngle(yaw - p.yaw) * Math.min(1, dt * 7);
    p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
    const A = p.act;
    if (A) {
      A.t += dt; p.v = 0;
      if (A.kind === 'atk' && !A.done && A.t >= A.hit) {
        A.done = true;
        // it lands if you're still in front of them and in reach (rolling away works)
        if (d < A.M.reach + 0.15 && (dx * p.hx + dz * p.hz) > 0.55 * d) this.hurtPlayer(A.M.dmg * 0.62 * (POWER[p.persona] || 0.9) * (p.cop ? 1.2 : 1), p.x, p.z);
      }
      if (A.t >= A.dur) p.act = null;
      return;
    }
    // close the distance (jog), or circle and pick the moment
    const want = 1.0;
    if (d > want + 0.25) {
      const sp = d > 4 ? 3.3 : 1.9, st = Math.min(d - want, sp * dt);
      p.x += dx / d * st; p.z += dz / d * st;
      const res = ppl.W.collision.resolve(p.x, p.z, 0.25);
      if (res && res.kind !== 3) { p.x += res.nx * res.depth; p.z += res.nz * res.depth; }
      p.v = sp; p.phase += dt * sp * 4.2;
    } else {
      p.v = 0;
      if (d < want - 0.3) { p.x -= dx / d * dt * 1.2; p.z -= dz / d * dt * 1.2; }
      p.atkT -= dt;
      if (p.atkT <= 0) {
        const name = this.rng.pick(NPC_MOVES), M = MOVES[name];
        p.act = { kind: 'atk', clip: M.clip, speed: M.speed * 0.92, t: 0, dur: M.dur / 0.92, hit: M.hit / 0.92, M, done: false };
        p.actId = (p.actId || 0) + 1;
        p.atkT = this.rng.range(0.9, 1.9) / (POWER[p.persona] || 0.9);
        if (this.rng.next() < 0.12) ppl.speakAs('fight', p, 1, 5);
      }
    }
    p.onRoad = ppl.W.surf.isRoad(p.x, p.z);
  }
}
export { HP, MOVES };
