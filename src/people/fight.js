// Street fights. Left click throws a punch (keep clicking: jab, cross, hook), C rolls out of the way.
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
  push: { clip: 'push', speed: 1.2, dur: 0.7, hit: 0.3, dmg: 4, reach: 1.2, push: 1.4 },
};
const COMBO = ['punch', 'cross', 'hook'];
const NPC_MOVES = ['punch', 'punch', 'cross', 'cross', 'hook', 'push'];

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
    const max = P.hpMax ? P.hpMax() : 100;
    if (P.hurtT > 6 && P.hp < max && !P.ko) P.hp = Math.min(max, P.hp + dt * 7);
    if (!P.onFoot) {
      P.act = null; this.queued = false;
      // on a two-wheeler you can still throw a punch sideways at the rider (or walker) next to you
      if (this.rideT > 0) { this.rideT -= dt; if (this.rideT <= 0 && P.riderShown) P.human.play('drive', { fade: 0.15 }); }
      if ((input.took('Mouse0') || input.took('KeyX')) && P.spec && P.spec.two && !(this.rideT > 0)) this.ridePunch();
      return;
    }
    const F = P.foot, H = P.human;
    this.comboT -= dt;
    if (P.ko) return;
    const busyDown = P.downT > 0 || F.climb || F.air;
    // left mouse button punches (E opens the backpack), C rolls
    if ((input.took('Mouse0') || input.took('KeyX')) && !busyDown) {
      if (P.act && P.act.kind === 'atk') { if (P.act.t > P.act.dur * 0.35) this.queued = true; }
      else if (!P.act) this.attack();
    }
    if (input.took('KeyC') && !busyDown && !(P.act && P.act.kind === 'roll')) this.roll(input);
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
    if (best) return best;
    // nobody to hit: a vehicle in front of you (a rider gets knocked off, a car gets a dent)
    return this.vehicleAt(F.x + fx * 0.8, F.z + fz * 0.8, 1.2);
  }
  vehicleAt(x, z, r) {
    const P = this.P, T = this.g.traffic;
    let best = null, bd = r;
    if (T) T.near(x, z, 6, (o) => {
      if (!o.T || o.isPlayer || o.parked) return;
      const d = P.distToBox(x, z, o.x, o.z, o.hx, o.hz, o.T.L, o.T.W);
      if (d < bd) { bd = d; best = { veh: o, traffic: true, x: o.x, z: o.z }; }
    });
    for (const dd of P.dropped) {
      const v = dd.veh, S = v === P.auto ? null : v.spec;
      if (!S) continue;
      const d = P.distToBox(x, z, v.x, v.z, Math.cos(v.th), Math.sin(v.th), S.L, S.W);
      if (d < bd) { bd = d; best = { veh: v, traffic: false, x: v.x, z: v.z }; }
    }
    return best;
  }
  attack() {
    const P = this.P;
    const S = this.g.strays, F0 = P.foot;
    if (S && !this.pickTarget()) { const a = S.near(F0.x + Math.cos(F0.yaw) * 0.9, F0.z + Math.sin(F0.yaw) * 0.9, 1.5); if (a && a.kind === 'cow') { S.namaskar(a); return; } }
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
    if (q && !q.veh) {
      const dx = q.x - F.x, dz = q.z - F.z, d = Math.hypot(dx, dz);
      if (d > M.reach + 0.25 || (dx * fx + dz * fz) < 0.2 * d || q.hidden) q = null;
    }
    if (q && !q.veh && this.g.life && this.g.life.s.drunk > 0.6 && this.rng.next() < 0.35) q = null;     // too drunk to aim
    if (q && q.veh) { this.hitVehicle(q, M); return; }
    if (!q) {
      // an animal in front of you: a dog gets kicked (or a pack scatters), a cow gets a namaskar
      const S = this.g.strays;
      if (S) { if (S.scare(F.x + fx, F.z + fz)) return; const a = S.near(F.x + fx * 0.9, F.z + fz * 0.9, 1.3); if (a) S.struck(a); }
      return;
    }
    const crit = q.foe !== this.P && !q.angryAtYou;   // a sucker punch on someone not expecting it
    const dmg = M.dmg * (crit ? 1.35 : 1) * this.rng.range(0.85, 1.15) * (this.g.life ? this.g.life.punchMul : 1);
    this.people.hurt(q, dmg, F.x, F.z, M, true);
    this.g.audio.punch?.(M.dmg / 20);
    this.g.rig?.shake?.(0.08 + M.dmg / 200);
    this.started(q);
  }
  // punching a vehicle: a rider goes over (and gets up angry), a car takes a small dent and its
  // driver may well get out to settle it
  hitVehicle(q, M) {
    const G = this.g, P = this.P, o = q.veh, ppl = this.people;
    G.audio.thud?.(0.35);
    G.life?.change('karma', -1);
    if (!q.traffic) { o.dmg = Math.min(1, (o.dmg || 0) + 0.015); return; }
    const two = o.T.two;
    o.dmg = Math.min(1, (o.dmg || 0) + (two ? 0.02 : 0.012));
    if (two) { o.fallen = 3.5; o.v = 0; this.bail(o, M, true); return; }
    o.hits = (o.hits || 0) + 1; o.v = Math.min(o.v, 0.5);
    if (o.hits === 1 && this.rng.next() < 0.6) { G.audio.horn?.('car', 0.7, 0, 2); return; }
    this.bail(o, M, false);
  }
  // the driver or rider gets out and becomes one of the people on the street
  bail(o, M, knocked) {
    const G = this.g, P = this.P, ppl = this.people, kit = G.W.kit;
    if (!kit) return;
    const look = kit.randomLook(this.rng, { female: this.rng.chance(o.T.two ? 0.15 : 0.25), helmet: o.T.two && o.type !== 'cycle', avoid: P.look });
    if (o.colB) look.top = look.top.setRGB(o.colB[0], o.colB[1], o.colB[2]);
    const side = o.T.two ? -1 : 1;
    const x = o.x + (-o.hz) * (o.T.W / 2 + 0.6) * side, z = o.z + o.hx * (o.T.W / 2 + 0.6) * side;
    const persona = o.type === 'auto' ? this.rng.pick(['kaka', 'dada', 'bhaiya']) : ppl.pickPersona(look.female, x, z);
    const p = ppl.spawnAt(look, x, z, persona);
    if (!p) return;
    // a car or auto stays where it stopped: anyone could take it now
    if (!o.T.two || knocked) {
      const T = G.traffic, idx = T.list.indexOf(o);
      if (idx >= 0) {
        const v = new (G.debugSave.Vehicle)(G.W, G.scene, G.vmats, o.type.replace(/P$/, ''), o.col);       // the riders are off it now
        v.reset(o.x, o.z, Math.atan2(o.hz, o.hx)); v.y = G.W.surf.height(o.x, o.z);
        v.plate = P.randomPlate(); v.stolen = true; v.dmg = o.dmg || 0; v.helmet = false;
        T.despawn(idx); P.addDropped(v, T);
      }
    }
    p.grudge = 40; p.wait = 0.4;
    if (knocked) { p.fallen = 1.6; }
    // two on the scooter: the one on the back comes off too (side-saddle, usually a woman), on the other side
    if (/P$/.test(o.type)) {
      const look2 = kit.randomLook(this.rng, { female: o.type === 'scooterP' ? this.rng.chance(0.75) : this.rng.chance(0.2), avoid: P.look });
      const x2 = o.x - o.hx * 0.7 + o.hz * 0.9 * side, z2 = o.z - o.hz * 0.7 - o.hx * 0.9 * side;
      const q = ppl.spawnAt(look2, x2, z2, ppl.pickPersona(look2.female, x2, z2));
      if (q) { if (knocked) { q.fallen = 2.4; q.fallBy = 'foot'; } q.angry = 6; q.wait = 0.4; if (this.rng.next() < 0.5) q.grudge = 30; }
    }
    ppl.hurt(p, M.dmg * 0.4, P.x, P.z, null, true);
    this.started(p);
  }
  ridePunch() {
    const P = this.P, H = P.human, v = P.cur;
    this.rideT = 0.45;
    H.play('punch', { once: true, fade: 0.05, speed: 1.6, restart: true });
    this.g.audio.whoosh?.(0.5);
    // whoever is alongside, left or right
    const hx = Math.cos(v.th), hz = Math.sin(v.th);
    let best = null, bd = 1.9;
    for (const p of this.people.list) {
      if (p.hidden || p.pax || p.kid) continue;
      const dx = p.x - v.x, dz = p.z - v.z, along = dx * hx + dz * hz, lat = Math.abs(-dx * hz + dz * hx);
      if (Math.abs(along) < 1.2 && lat < bd) { bd = lat; best = p; }
    }
    const veh = best ? null : (this.vehicleAt(v.x - hz * 1.1, v.z + hx * 1.1, 1.1) || this.vehicleAt(v.x + hz * 1.1, v.z - hx * 1.1, 1.1));
    setTimeout(() => {
      if (best) { this.people.hurt(best, MOVES.punch.dmg * (this.g.life ? this.g.life.punchMul : 1), v.x, v.z, MOVES.cross, true); this.g.audio.punch?.(0.6); this.started(best); }
      else if (veh) this.hitVehicle(veh, MOVES.cross);
    }, 180);
  }
  // a fight starts (or carries on) with q: everyone around reacts, and maybe the police
  started(q) {
    const G = this.g, first = !this.active;
    this.active = 0.01;
    if (q.cop) { if (this.heatT <= 0) { this.heatT = 25; G.police.raiseHeat(2, 'Assaulting a police officer', 'assault'); } }
    else if (this.heatT <= 0 && G.police.copSeeing && G.police.copSeeing(q.x, q.z, 40)) { this.heatT = 40; G.police.raiseHeat(1, 'Beating someone up, a cop saw it', 'hurt'); }
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
    if (!P.onFoot && P.spec && P.spec.two && !P.ko) {
      // hit on your scooter: it hurts, and sometimes you go over
      P.hp = Math.max(1, P.hp - dmg); P.hurtT = 0; this.active = 0.01;
      G.audio.punch?.(dmg / 14); G.rig?.shake?.(0.2); G.hud.hurt?.();
      if (this.rng.next() < 0.35 || P.hp < 15) { P.exit(G.traffic, true); P.downT = 2.4; P.human.play('knockback', { once: true, fade: 0.06 }); }
      return true;
    }
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
    if (G.life) { G.life.s.tally.knockedOut++; G.life.change('respect', -3); G.life.change('mood', -0.15); } if (G.life && G.life.s.upg.chain) { G.life.s.upg.chain = 0; G.hud.toast('Your gold chain’s gone', 'Snatched while you were down', 'bad', 3); }
    P.human.play('death', { once: true, fade: 0.1 });
    // beaten by a cop: you're arrested, not robbed
    const cop = this.people.list.find(p => p.foe === P && p.cop);
    if (cop) {
      G.police.say('cop_arrest', cop);
      for (const p of this.people.list) if (p.foe === P) this.people.endFight(p, true);
      G.later?.(3.5, () => { P.ko = false; P.downT = 0; P.hp = 60; this.active = 0; G.police.arrest('Assaulting a police officer', true); });
      G.life?.change('respect', -4);
      return;
    }
    G.hud.flash?.('Knocked out', 'Pune doesn’t forget');
    // everyone who was fighting you wanders off, pleased with themselves
    for (const p of this.people.list) if (p.foe === P) { this.people.endFight(p, true); }
    // someone takes your cash while you're down, then you wake up in hospital
    const lost = Math.min(G.stats.money, Math.round(this.rng.range(150, 600) / 10) * 10);
    G.stats.money -= lost; G.saveStats?.();
    G.later?.(2.6, () => { this.active = 0; G.blackout ? G.blackout('beaten', lost) : (P.ko = false, P.hp = 45); });
  }

  // ---------------------------------------------------------------- the people (called from People.step)
  stepPed(p, dt) {
    const P = this.P, ppl = this.people;
    p.fightT += dt;
    // a cop in a fight radios for backup (beat marshals come for you)
    if (p.cop && p.backupT !== undefined && (p.backupT -= dt) <= 0) { p.backupT = undefined; this.g.police.say('cop_backup', null, true); this.g.police.raiseHeat(1, 'Assaulting a police officer, backup called', 'assault'); }
    if (p.stun > 0) { p.stun -= dt; p.v = 0; return; }
    const tx = P.x, tz = P.z, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    // done: you drove off, ran away, it's gone on too long, or they've had enough
    const onTwo = !P.onFoot && P.spec && P.spec.two;
    if ((!P.onFoot && !onTwo) || P.ko || d > 24 || p.fightT > 50) { ppl.endFight(p, P.ko); return; }
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
      // circle: a fighter doesn't stand still in front of you, they side-step and look for an opening
      p.circ = (p.circ ?? (this.rng.next() < 0.5 ? 1 : -1)); if (this.rng.next() < dt * 0.4) p.circ = -p.circ;
      const sx = -dz / d * p.circ, sz = dx / d * p.circ, cs = 0.9 * dt;
      p.x += sx * cs; p.z += sz * cs; p.v = 0.9;
      const res2 = ppl.W.collision.resolve(p.x, p.z, 0.25); if (res2 && res2.kind !== 3) { p.x += res2.nx * res2.depth; p.z += res2.nz * res2.depth; }
      if (d < want - 0.3) { p.x -= dx / d * dt * 1.2; p.z -= dz / d * dt * 1.2; }
      // your swing coming: back off out of reach (the quick ones)
      if (P.act && P.act.t < 0.15 && this.rng.next() < 0.25 * (POWER[p.persona] || 0.9)) { p.x -= dx / d * 0.5; p.z -= dz / d * 0.5; }
      p.atkT -= dt;
      if (p.atkT <= 0) {
        const name = this.rng.pick(NPC_MOVES), M = MOVES[name];
        p.act = { kind: 'atk', clip: M.clip, speed: M.speed * 0.92, t: 0, dur: M.dur / 0.92, hit: M.hit / 0.92, M, done: false };
        p.actId = (p.actId || 0) + 1;
        // sometimes a quick follow-up (one-two), sometimes a pause to breathe
        p.atkT = (this.rng.next() < 0.3 ? this.rng.range(0.35, 0.55) : this.rng.range(0.9, 1.9)) / (POWER[p.persona] || 0.9);
        if (this.rng.next() < 0.12) ppl.speakAs('fight', p, 1, 5);
      }
    }
    // personal space: two people fighting you don't stand inside each other; they spread round you
    for (const q of ppl.list) {
      if (q === p || q.mode !== 'fight' || q.fallen > 0) continue;
      const ex = p.x - q.x, ez = p.z - q.z, e = Math.hypot(ex, ez);
      if (e < 0.8 && e > 1e-4) { const k = (0.8 - e) * 0.5; p.x += ex / e * k; p.z += ez / e * k; q.x -= ex / e * k; q.z -= ez / e * k; }
      else if (e <= 1e-4) { p.x += 0.4; }
    }
    p.onRoad = ppl.W.surf.isRoad(p.x, p.z);
  }
}
export { HP, MOVES };
