// Working out, for real: each machine in a gym is its own exercise (bench press, squats, dumbbell curls, the heavy
// bag, the treadmill). A set is ten reps; each rep is a press of Space (or a click) as the bar swings through the
// green: dead centre is a clean rep, near it a grinder, outside it a miss that costs you. Three sets, then you're done.
// What it builds is yours: strength (harder punches, more health, more you can carry in the jhola) and stamina
// (sprint longer, tire slower). Train hard and you're sore tomorrow (slower to sprint); skip a week and it fades.
// A protein shake before makes the session count for more.
const EX = {
  bench: { name: 'Bench press', mr: 'बेंच प्रेस', what: 'Chest, shoulders, arms', stat: 'str', speed: 1.15, anim: 'crouch' },
  squat: { name: 'Squats', mr: 'स्क्वॅट्स', what: 'Legs and core', stat: 'str', speed: 1.0, anim: 'crouch' },
  curl: { name: 'Dumbbell curls', mr: 'डंबेल्स', what: 'Biceps, grip', stat: 'str', speed: 1.35, anim: 'yes' },
  bag: { name: 'The heavy bag', mr: 'पंचिंग बॅग', what: 'Punching power and wind', stat: 'both', speed: 1.7, anim: 'punch' },
  tread: { name: 'Treadmill', mr: 'ट्रेडमिल', what: 'Stamina', stat: 'sta', speed: 1.25, anim: 'run' },
};
export class Gym {
  constructor(G) {
    this.g = G; this.on = null;
    const el = this.el = document.createElement('div'); el.className = 'gymx'; el.hidden = true;
    el.innerHTML = `<div class="gx2-card"><div class="gx2-k"></div><h3></h3><p></p><div class="gx2-bar"><i class="gx2-zone"></i><i class="gx2-sweet"></i><u></u></div>
      <div class="gx2-row"><span class="gx2-set"></span><span class="gx2-reps"></span><span class="gx2-form"></span></div><div class="gx2-hint"><span class="kbd">Space</span> on the green · <span class="kbd">F</span> stop</div></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    addEventListener('keydown', (e) => {
      if (!this.on) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) this.rep(); }
      else if (e.code === 'KeyF' || e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.stop(); }
    }, true);
    el.addEventListener('pointerdown', () => this.on && this.rep());
  }
  get life() { return this.g.life; }
  fit() { const s = this.life.s; return s.fit || (s.fit = { str: Math.min(40, s.fitness || 0), sta: Math.min(40, (s.fitness || 0) * 0.6), last: -1, sore: -9, load: 0 }); }
  // can you train here today: a member, a day pass, or not
  allowed() { const L = this.life, G = this.g, day = Math.floor((G.clock || 0) / 24); return (L.s.gymUntil || -1) >= day || L.s.gymPass === day || G.free; }
  start(kind) {
    const G = this.g, L = this.life, E = EX[kind]; if (!E) return;
    if (!this.allowed()) { G.hud.toast('Members only', 'Buy a day pass or a membership at the front desk', 'info', 2.6); return; }
    if (L.s.energy < 0.12) { G.hud.toast('Too tired', 'Eat something, sleep. Then come back', 'warn', 2.4); return; }
    const day = Math.floor((G.clock || 0) / 24), F = this.fit(), sore = F.sore === day - 1 || F.sore === day;
    this.on = { kind, E, set: 1, reps: 0, good: 0, t: Math.random() * 6, misses: 0, sore, shake: (L.s.shakeAt || -9) > (G.clock || 0) - 3 };
    G.state = 'shop';
    const P = G.player; if (P.human) P.human.play(E.anim, { restart: true });
    this.el.querySelector('.gx2-k').textContent = `${E.mr} · ${E.what}`;
    this.el.querySelector('h3').textContent = E.name;
    this.el.querySelector('p').textContent = sore ? 'Still sore from yesterday: the green is smaller' : this.on.shake ? 'The shake’s kicking in: this one counts for more' : 'Three sets of ten. Smooth, not fast';
    this.el.hidden = false; this.paint();
  }
  // the bar swings; the green narrows as you tire and as the set goes on
  zone() { const o = this.on, F = this.fit(), w = 0.3 - o.reps * 0.008 - (o.set - 1) * 0.02 - (o.sore ? 0.07 : 0) + (o.E.stat === 'sta' ? F.sta : F.str) / 400; return Math.max(0.1, Math.min(0.36, w)); }
  pos() { const o = this.on; return 0.5 + 0.5 * Math.sin(o.t * o.E.speed * (1 + o.reps * 0.03)); }
  update(dt) { if (!this.on) return; this.on.t += dt * 2.2; this.paint(); const P = this.g.player; if (P.human && this.g.state !== 'play') P.human.mixer.update(dt); }
  rep() {
    const o = this.on, G = this.g, L = this.life; if (!o) return;
    const d = Math.abs(this.pos() - 0.5), z = this.zone() / 2;
    let q = d < z * 0.35 ? 'Clean rep' : d < z ? 'Grinder' : 'Missed';
    if (q === 'Missed') { o.misses++; G.audio.thud?.(0.15); if (o.misses >= 4) { G.hud.toast('Form gone', 'You’re done for today. Don’t hurt yourself', 'warn', 2.4); this.stop(); return; } }
    else { o.reps++; o.good += q === 'Clean rep' ? 1 : 0.6; G.audio.thud?.(q === 'Clean rep' ? 0.35 : 0.22); L.apply({ energy: -0.006, thirst: -0.005, hunger: -0.003 }); const P = G.player; if (P.human) P.human.play(o.E.anim, { restart: true }); }
    this.el.querySelector('.gx2-form').textContent = q;
    this.el.querySelector('.gx2-form').className = 'gx2-form ' + (q === 'Clean rep' ? 'ok' : q === 'Grinder' ? 'meh' : 'bad');
    if (o.reps >= 10) { if (o.set >= 3) { this.finish(); return; } o.set++; o.reps = 0; o.misses = 0; G.hud.toast(`Set ${o.set - 1} done`, 'Breathe. Next set', 'meter', 1.4); }
    this.paint();
  }
  finish() {
    const o = this.on, G = this.g, L = this.life, F = this.fit(), day = Math.floor((G.clock || 0) / 24);
    const quality = o.good / 30, base = 1.6 * quality * (o.shake ? 1.5 : 1) * (G.gymTier === 'premium' ? 1.2 : 1);
    const cap = 50, before = { ...F };
    // gains slow as you get strong
    const add = (k, v) => { F[k] = Math.min(cap, F[k] + v * (1 - F[k] / (cap + 10))); };
    if (o.E.stat === 'str' || o.E.stat === 'both') add('str', base);
    if (o.E.stat === 'sta' || o.E.stat === 'both') add('sta', base * (o.E.stat === 'both' ? 0.7 : 1.2));
    F.load = (F.last === day ? F.load : 0) + 1; F.last = day; if (F.load >= 3) F.sore = day;
    L.s.fitness = Math.min(40, (F.str * 0.6 + F.sta * 0.4) * 0.8);          // (max health, as before)
    L.apply({ energy: -0.12, mood: 0.08 });
    L.s.tally && (L.s.tally.workouts = (L.s.tally.workouts || 0) + 1);
    G.hud.toast(`${o.E.name}: done`, `Strength ${Math.round(before.str)}→${Math.round(F.str)} · Stamina ${Math.round(before.sta)}→${Math.round(F.sta)}${F.load >= 3 ? ' · you’ll feel it tomorrow' : ''}`, 'good', 3.4);
    L.save(); this.stop();
  }
  stop() { if (!this.on) return; this.on = null; this.el.hidden = true; if (this.g.state === 'shop') this.g.state = 'play'; const P = this.g.player; if (P.human) P.human.play('idle', { fade: 0.2 }); }
  paint() {
    const o = this.on; if (!o) return;
    const z = this.zone();
    this.el.querySelector('.gx2-zone').style.cssText = `left:${(0.5 - z / 2) * 100}%;width:${z * 100}%`;
    this.el.querySelector('.gx2-sweet').style.cssText = `left:${(0.5 - z * 0.175) * 100}%;width:${z * 35}%`;
    this.el.querySelector('.gx2-bar u').style.left = `${this.pos() * 100}%`;
    this.el.querySelector('.gx2-set').textContent = `Set ${o.set} of 3`;
    this.el.querySelector('.gx2-reps').textContent = `${o.reps} / 10`;
  }
  // every day: fitness fades if you've stopped going (a week off, then a point a day)
  daily(day) { const F = this.fit(); if (F.last >= 0 && day - F.last > 7) { F.str = Math.max(0, F.str - 0.8); F.sta = Math.max(0, F.sta - 1); this.life.s.fitness = Math.min(40, (F.str * 0.6 + F.sta * 0.4) * 0.8); } }
  // what it does out in the city
  strength() { return this.fit().str; }
  stamina() { return this.fit().sta; }
  sore() { const F = this.fit(), day = Math.floor((this.g.clock || 0) / 24); return F.sore === day || F.sore === day - 1 && (this.g.hour || 0) < 14; }
}
