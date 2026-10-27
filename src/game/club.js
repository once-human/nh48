// A night out: pay the cover at a club or brewpub after 8:30 PM and you're inside. Dance (mood up,
// energy down, an hour goes by), order at the bar (tipsy), talk to people (KP crowd: sometimes a
// friend, sometimes a number, sometimes a bill), or leave. The beat is synthesised; the lights are
// the club's. Last call at 1:30 AM, as in Pune.
import { RNG } from '../core/util.js';
import { fmt } from './shops.js';

const TALK = [
  ['A startup founder pitches you his app for autos. You nod a lot.', { mood: 0.04 }, 0],
  ['A group from Bengaluru wants to know where to get misal tomorrow. You tell them. They buy you a drink.', { mood: 0.08, drunk: 0.2 }, 0],
  ['You meet someone from your college. Numbers exchanged.', { mood: 0.12 }, 2],
  ['Someone spills a drink on you and apologises with another one.', { mood: 0.05, drunk: 0.2 }, 0],
  ['A DJ asks what you think of the set. You say “fire”. He’s pleased.', { mood: 0.06 }, 1],
  ['You end up paying for the whole table’s nachos.', { mood: -0.02 }, 0, 1400],
  ['A dada from your area recognises you and calls you “bhau” in front of everyone.', { mood: 0.06 }, 3],
];

export class Club {
  constructor(G) {
    this.g = G; this.rng = new RNG(2626);
    const el = document.createElement('div');
    el.className = 'club'; el.hidden = true;
    el.innerHTML = `<div class="cl-lights"><i></i><i></i><i></i><i></i></div><div class="cl-card glass">
      <div class="sh-k">Night out</div><div class="sh-t cl-name"></div><div class="cl-msg"></div>
      <div class="cl-acts"><button data-a="dance"><b>Dance</b><small>An hour on the floor</small></button><button data-a="drink"><b>Bar</b><small>A drink</small></button>
      <button data-a="talk"><b>Talk to people</b><small>Who knows</small></button><button data-a="leave"><b>Leave</b><small>Back to the street</small></button></div>
      <div class="cl-stat"></div></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (b) this.act(b.dataset.a); });
    window.addEventListener('keydown', (e) => { if (!this.on) return; if (e.code === 'Escape' || e.code === 'KeyF') { e.preventDefault(); e.stopImmediatePropagation(); this.leave(); return; } const m = /^Digit([1-4])$/.exec(e.code); if (m) this.act(['dance', 'drink', 'talk', 'leave'][+m[1] - 1]); }, true);
  }
  enter(ctx) {
    const G = this.g;
    this.on = true; this.ctx = ctx; G.state = 'shop';
    this.el.querySelector('.cl-name').textContent = ctx.name;
    this.say('The bass hits you at the door. It’s packed.');
    this.el.hidden = false;
    G.life.apply({ drunk: 0.15, mood: 0.05 });
    G.audio.updateEngine?.(0, 0, false);
    this.beat(true);
    this.stat();
  }
  say(t) { this.el.querySelector('.cl-msg').textContent = t; }
  stat() {
    const L = this.g.life.s, G = this.g;
    const h = Math.floor(G.hour), m = Math.floor((G.hour % 1) * 60);
    this.el.querySelector('.cl-stat').textContent = `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'} · energy ${Math.round(L.energy * 100)}% · mood ${Math.round(L.mood * 100)}% · ${L.drunk > 0.6 ? 'drunk' : L.drunk > 0.25 ? 'tipsy' : 'sober'} · cash ${fmt(G.stats.money)}`;
  }
  act(a) {
    const G = this.g, L = G.life;
    if (a === 'leave') return this.leave();
    if (G.hour >= 1.5 && G.hour < 11) { this.say('Lights on. Last call was at 1:30. Everybody out.'); return; }
    if (a === 'dance') {
      if (L.s.energy < 0.12) { this.say('Your legs say no. Sit down, have some water.'); return; }
      G.hour = (G.hour + 1) % 24; G.clock += 1;
      L.apply({ mood: 0.14, energy: -0.12, thirst: -0.1, hunger: -0.04 });
      this.say(this.rng.pick(['You own the floor for one song. Then another.', 'The DJ drops a Marathi remix. The whole place loses it.', 'Someone teaches you a step. You teach them the Ganpati dance.', 'You dance till your shirt sticks to you.']));
    } else if (a === 'drink') {
      const p = Math.round(450 * (G.shops ? G.shops.priceMul(this.ctx.x, this.ctx.z) / 1.3 : 1) / 10) * 10;
      if (!G.shops.spend(p)) { this.say('Card declined. Cash short.'); return; }
      L.apply({ drunk: 0.3, mood: 0.05, thirst: 0.1 });
      this.say(`${fmt(p)} for a drink. It’s a club.`);
    } else if (a === 'talk') {
      G.hour = (G.hour + 0.5) % 24; G.clock += 0.5;
      const [t, eff, resp, cost] = this.rng.pick(TALK);
      if (cost) { G.stats.money = Math.max(0, G.stats.money - cost); G.saveStats(); }
      L.apply(eff); if (resp) L.change('respect', resp);
      this.say(t + (cost ? ` (−${fmt(cost)})` : ''));
    }
    this.stat();
  }
  leave() {
    const G = this.g;
    this.on = false; this.el.hidden = true; this.beat(false);
    if (G.state === 'shop') G.state = 'play';
    if (G.life.s.drunk > 0.5) G.hud.toast('You’re drunk', 'Walk it off, or take a rickshaw. Driving like this is a ₹10,000 fine', 'warn', 4);
  }
  // a four-on-the-floor loop: kick, offbeat hat, a sub bass
  beat(on) {
    const A = this.g.audio, ctx = A.ctx;
    if (!ctx) return;
    if (!on) { if (this.loop) { clearInterval(this.loop); this.loop = null; } return; }
    const out = ctx.createGain(); out.gain.value = 0.35; out.connect(A.bus('music'));
    let step = 0;
    const tick = () => {
      const t = ctx.currentTime + 0.02, s = step++ % 8;
      if (s % 2 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(out); o.start(t); o.stop(t + 0.3); }
      if (s % 2 === 1) { const n = ctx.createBufferSource(); n.buffer = A.noise; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 0.06); }
      if (s === 0 || s === 3 || s === 6) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = [55, 55, 65.4, 49][Math.floor(step / 8) % 4]; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.22); }
    };
    this.loop = setInterval(tick, 60000 / 124 / 2);
  }
}
