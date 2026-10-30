// Pune's street animals, up close:
//   dogs   feed one a Parle-G (F) and it follows you around for a while, barks at anyone who picks a
//          fight with you; pet it (F) and it wags. At night, on quiet streets, a pack may come for
//          you on foot (keep walking, or stand your ground and swing at them: they scatter).
//          Kick one (the punch button) and it yelps and runs, or bites back; the street's dog
//          lovers will remember.
//   cows   amble into the middle of the road and lie there; traffic stops and honks and goes
//          round. Feed one a banana for karma. Try to hit one and you do a namaskar instead:
//          cows are sacred here.
// Animals live on the footpath graph (people/peds.js stepAnimal); while one of these is going on
// the animal is "free" (a.free) and moved here instead.
import { clamp, wrapAngle, RNG } from '../core/util.js';

export class Strays {
  constructor(G) { this.g = G; this.rng = new RNG(1313); this.packT = 30; }
  get list() { return this.g.people.animals; }
  // the animal next to you (for F and the punch button)
  near(x, z, r = 1.9) {
    let best = null, bd = r;
    for (const a of this.list) { if (a.kind === 'cat') continue; const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  label(a) {
    const L = this.g.life;
    if (a.kind === 'dog') return L.has('dogfood') ? 'Feed the dog a pouch' : L.has('biscuit') ? 'Feed the dog a Parle-G' : a.free && a.free.mode === 'follow' ? 'Pet your dog' : 'Pet the dog';
    return L.has('banana') ? 'Feed the cow a banana' : 'Touch the cow’s forehead (namaskar)';
  }
  // F next to an animal
  interact(a) {
    const G = this.g, L = G.life, P = G.player;
    if (a.kind === 'dog') {
      const pouch = L.take('dogfood');
      if (pouch || L.take('biscuit')) {
        L.change('karma', pouch ? 3 : 2); L.change('mood', 0.04); L.s.tally.fed++;
        this.free(a, { mode: 'follow', t: pouch ? 420 : 150 });
        G.hud.toast('Best friends now', 'The dog follows you for a while, and barks at anyone who picks on you', 'good', 3.2);
        this.cheer(a, 'kind');
      } else { a.wag = 2; L.change('mood', 0.03); G.hud.toast('Good boy', 'The tail goes like a fan', 'info', 1.8); }
      P.human.play('pickup', { once: true, fade: 0.1, restart: true }); P.act = { kind: 'hurt', t: 0, dur: 0.9 };
      return;
    }
    if (L.take('banana')) {
      L.change('karma', 3); L.change('mood', 0.05); L.s.tally.fed++;
      a.rest = 20; a.moving = false;
      G.hud.toast('The cow eats from your hand', '+karma. An aaji somewhere approves', 'good', 3);
    } else this.namaskar(a);
    this.cheer(a, 'kind');
    P.human.play('interact', { once: true, fade: 0.1, restart: true }); P.act = { kind: 'hurt', t: 0, dur: 1.1 };
  }
  namaskar(a) {
    const G = this.g, P = G.player;
    G.life.change('karma', 1);
    P.human.play('yes', { once: true, fade: 0.1, restart: true }); P.act = { kind: 'hurt', t: 0, dur: 1.2 };
    if (!this._namT || G.t - this._namT > 20) { this._namT = G.t; G.hud.toast('You fold your hands instead', 'Cows are sacred here. Even you know better', 'info', 3); }
    void a;
  }
  // the punch button with an animal in front of you
  struck(a) {
    const G = this.g, L = G.life;
    if (a.kind === 'cow') { this.namaskar(a); return true; }
    if (a.kind !== 'dog') return false;
    G.audio.bark?.(0.9); G.audio.thud?.(0.2);
    L.change('karma', -6); L.change('respect', -1);
    if (this.rng.next() < 0.35) { this.free(a, { mode: 'chase', t: 6, bite: 0 }); G.hud.toast('It bites back', 'Fair enough, honestly', 'bad', 2.4); }
    else { this.free(a, { mode: 'flee', t: 5 }); }
    this.cheer(a, 'drunk');          // the nearest person tells you off
    return true;
  }
  // someone nearby says something about what you just did
  cheer(a, sc) {
    const ppl = this.g.people;
    let best = null, bd = 18;
    for (const p of ppl.list) { if (p.hidden || p.pax || p.cop || p.kid) continue; const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < bd) { bd = d; best = p; } }
    if (best) { ppl.lineT = 0; ppl.speakAs(sc, best, 1, 4); }
  }
  free(a, f) { a.free = Object.assign({ t: 10 }, f); a.chase = 0; }
  update(dt) {
    const G = this.g, P = G.player, hour = G.hour, night = hour > 22 || hour < 5.5;
    // a pack on a quiet street at night
    this.packT -= dt;
    if (night && P.onFoot && this.packT <= 0) {
      this.packT = this.rng.range(25, 60);
      const quiet = G.people.actHere < 9;
      if (quiet && this.rng.next() < 0.55) {
        const dogs = this.list.filter(a => a.kind === 'dog' && !a.free && Math.hypot(a.x - P.x, a.z - P.z) < 45);
        if (dogs.length) {
          for (const d of dogs.slice(0, 3)) this.free(d, { mode: 'chase', t: 9, bite: 0 });
          G.hud.toast('Street dogs, at night', 'They’re after you. Keep moving, or turn and swing at them', 'warn', 3.2);
        }
      }
    }
    for (const a of this.list) {
      const f = a.free;
      if (a.wag > 0) a.wag -= dt;
      // cows wander into the road and settle there for a while
      if (a.kind === 'cow' && !f && !a.inRoad && this.rng.next() < dt * 0.004 && Math.hypot(a.x - P.x, a.z - P.z) < 120) { a.inRoad = this.rng.range(30, 80); a.lat0 = a.lat; a.lat = a.side * this.rng.range(0, a.e.w * 0.3); a.moving = false; }
      if (a.inRoad > 0) { a.inRoad -= dt; a.moving = false; a.rest = Math.max(a.rest, 2); if (a.inRoad <= 0) a.lat = a.lat0 ?? a.lat; }
      if (!f) continue;
      f.t -= dt;
      const dx = P.x - a.x, dz = P.z - a.z, d = Math.hypot(dx, dz);
      let tx = a.x, tz = a.z, sp = 0;
      if (f.mode === 'follow') {
        // trot along behind you; guard you in a fight
        const foe = G.people.list.find(p => p.foe === P && p.mode === 'fight');
        if (foe) { tx = foe.x; tz = foe.z; sp = 5; if (Math.hypot(foe.x - a.x, foe.z - a.z) < 1.4 && (f.barkT = (f.barkT || 0) - dt) <= 0) { f.barkT = 0.8; G.audio.bark?.(0.8); if (this.rng.next() < 0.25) { G.people.endFight(foe); G.people.flee(foe, a.x, a.z, 20); } } }
        else if (d > 2.4) { tx = P.x - Math.cos(P.th) * 1.6; tz = P.z - Math.sin(P.th) * 1.6; sp = d > 6 ? 5.5 : 2.2; }
        if (d > 60 || !P.onFoot && d > 25) f.t = 0;
      } else if (f.mode === 'chase') {
        tx = P.x; tz = P.z; sp = P.onFoot ? 4.6 : 0;
        if ((f.barkT = (f.barkT || 0) - dt) <= 0) { f.barkT = 0.6 + this.rng.next() * 0.6; G.audio.bark?.(Math.min(0.9, 10 / (d + 4))); }
        if (d < 0.9 && P.onFoot && (f.bite = (f.bite || 0) - dt) <= 0 && !(P.act && P.act.iframe)) {
          f.bite = 2;
          P.hp = Math.max(1, P.hp - 6); P.hurtT = 0; G.hud.hurt?.(); G.rig?.shake?.(0.12);
          if (!this._biteT || G.t - this._biteT > 30) { this._biteT = G.t; G.hud.toast('Bitten', 'Get an anti-rabies shot at a clinic. Seriously', 'bad', 3); }
        }
        if (d > 30 || !P.onFoot) f.t = Math.min(f.t, 0.5);
      } else if (f.mode === 'flee') {
        tx = a.x - dx / (d || 1) * 10; tz = a.z - dz / (d || 1) * 10; sp = 5.5;
      }
      if (sp > 0) {
        const mx = tx - a.x, mz = tz - a.z, md = Math.hypot(mx, mz);
        if (md > 0.3) {
          const st = Math.min(md, sp * dt);
          a.x += mx / md * st; a.z += mz / md * st;
          const res = G.W.collision.resolve(a.x, a.z, 0.3);
          if (res && res.kind !== 3) { a.x += res.nx * res.depth; a.z += res.nz * res.depth; }
          const yaw = Math.atan2(mz, mx);
          a.yaw += wrapAngle(yaw - a.yaw) * Math.min(1, dt * 8);
          a.moving = true; a.v = sp;
        } else { a.moving = false; a.v = 0; }
      } else { a.moving = false; a.v = 0; }
      a.hx = Math.cos(a.yaw); a.hz = Math.sin(a.yaw);
      if (f.t <= 0) this.release(a);
    }
  }
  // back to its footpath, from wherever it ended up
  release(a) {
    a.free = null;
    const n = this.g.W.graph.nearest(a.x, a.z, 60, e => e.rank >= 1);
    if (n) { a.e = n.e; a.s = clamp(n.s, 2, Math.max(2.1, n.e.len - 2)); }
  }
  // you swung at whatever's in front of you: a dog pack scatters
  scare(x, z) {
    let any = false;
    for (const a of this.list) if (a.free && a.free.mode === 'chase' && Math.hypot(a.x - x, a.z - z) < 3) { this.free(a, { mode: 'flee', t: 4 }); any = true; }
    return any;
  }
}
