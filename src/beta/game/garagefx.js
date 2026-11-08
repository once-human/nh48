// The garage at work: every job you pay for sounds like the job, one after another as they're done. Wheels, tyres,
// brakes, suspension: the impact wrench's rattle on each nut and the air line's hiss; a respray: the compressor
// thudding away and the gun's long passes; bodywork and a repair: a hammer on the panel and the sanding after; the
// engine, a turbo, a remap, an exhaust: the ratchet, and then a test rev (an exhaust's with a crackle on the
// overrun); lights, neon, a music system: wires crimped, a relay's tick, a hum; a new horn: tried out; a nitrous
// bottle: clanked in and the pressure hissing; a wash: the hose and a cloth squeaking on the glass; a service: the
// ratchet and the oil glugging in.
import { GarageUI } from '@orig/game/garageui.js';
import { hiss, ring, tone, go } from './sfx.js';

const J = (a, b) => a + (b - a)*Math.random();
const JOB = {
  wrench: (A, t) => { let c = t; for (let k = 0; k < 4 + Math.floor(Math.random()*2); k++) { const d = J(0.2, 0.38); for (let i = 0; i < d*28; i++) hiss(A, c + i/28, 0.025, J(900, 1300), 2, 0.07); tone(A, c, 95, d, 0.035, 'sawtooth'); ring(A, c + d, 1800, 0.05, 0.04, [1, 2.3]); c += d + J(0.12, 0.3); } hiss(A, c + 0.1, 0.35, 3000, 0.8, 0.05); return c - t + 0.5; },
  spray: (A, t) => { for (let i = 0; i < 6; i++) tone(A, t + i*0.18, 55, 0.12, 0.05); for (let p = 0; p < 3; p++) hiss(A, t + 0.3 + p*0.75, 0.6, J(3500, 5000), 0.9, 0.09); return 2.6; },
  hammer: (A, t) => { let c = t; for (let k = 0; k < 5 + Math.floor(Math.random()*3); k++) { ring(A, c, J(700, 1300), 0.18, 0.09, [1, 2.4, 3.9]); hiss(A, c, 0.02, 2500, 2, 0.1); c += J(0.18, 0.32); } for (let s = 0; s < 4; s++) hiss(A, c + 0.2 + s*0.22, 0.18, 2200, 0.7, 0.04, 'bandpass', 3200); return c - t + 1.2; },
  rev: (A, t, pops) => {
    let c = t; for (let k = 0; k < 2; k++) { for (let i = 0; i < 8; i++) hiss(A, c + i*0.06, 0.012, 3200, 4, 0.08); c += 0.7; }
    const ctx = A.ctx, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(40, c); o.frequency.linearRampToValueAtTime(150, c + 0.45); o.frequency.linearRampToValueAtTime(42, c + 1.3);
    lp.type = 'lowpass'; lp.frequency.value = 900; g.gain.setValueAtTime(0, c); g.gain.linearRampToValueAtTime(0.08, c + 0.1); g.gain.linearRampToValueAtTime(0.05, c + 1.1); g.gain.linearRampToValueAtTime(0, c + 1.4);
    o.connect(lp); lp.connect(g); g.connect(A.bus ? A.bus('fx') : ctx.destination); o.start(c); o.stop(c + 1.5);
    if (pops) for (let i = 0; i < 5; i++) { const at = c + 0.55 + J(0, 0.6); tone(A, at, 70, 0.05, 0.14); hiss(A, at, 0.04, 1200, 1, 0.12); }
    return c - t + 1.6;
  },
  wire: (A, t, hum) => { for (let i = 0; i < 4; i++) { hiss(A, t + i*0.25, 0.01, 3800, 5, 0.12); ring(A, t + i*0.25 + 0.01, 3000, 0.03, 0.03, [1, 1.8]); } hiss(A, t + 1.1, 0.008, 2400, 4, 0.12); if (hum) tone(A, t + 1.15, 100, 0.8, 0.03, 'square'); return 2.1; },
  staple: (A, t) => { for (let i = 0; i < 6; i++) { hiss(A, t + i*J(0.2, 0.3), 0.015, 2000, 3, 0.15); tone(A, t + i*0.25, 160, 0.03, 0.04); } return 1.8; },
  peel: (A, t) => { hiss(A, t, 0.5, 1500, 1.5, 0.07, 'bandpass', 4500); hiss(A, t + 0.7, 0.3, 900, 0.8, 0.04); return 1.2; },
  nitro: (A, t) => { ring(A, t, 900, 0.3, 0.08, [1, 2.7, 4.1]); ring(A, t + 0.25, 1100, 0.2, 0.05, [1, 2.7]); hiss(A, t + 0.7, 0.9, 6000, 0.6, 0.08, 'highpass'); return 1.8; },
  wash: (A, t) => { hiss(A, t, 2.2, 1800, 0.5, 0.07, 'lowpass'); for (let i = 0; i < 4; i++) tone(A, t + 1 + i*0.3, J(1500, 2400), 0.12, 0.02, 'sine', J(1700, 2800)); return 2.6; },
  service: (A, t) => { for (let i = 0; i < 10; i++) hiss(A, t + i*0.07, 0.012, 3000, 4, 0.08); for (let i = 0; i < 6; i++) tone(A, t + 1 + i*0.16, J(120, 180), 0.12, 0.05, 'sine', 80); return 2.2; },
};
const OF = { rims: 'wrench', tyres: 'wrench', brakes: 'wrench', susp: 'wrench', hydro: 'wrench', armor: 'hammer', paint: 'spray', livery: 'spray', body: 'hammer',
  engine: 'rev', turbo: 'rev', ecu: 'rev', exhaust: 'pops', lights: 'wire', neon: 'hum', beacon: 'wire', sound: 'hum', interior: 'staple', windows: 'peel', stickers: 'peel', plates: 'wire', nitro: 'nitro', horn: 'horn' };

function play(G, list, horn = 'car') {
  const A = G.audio; if (!A || !A.ctx) return;
  go(A, (t0) => {
    let t = t0;
    for (const j of list) {
      if (j === 'horn') { const at = t; setTimeout(() => { try { A.horn(horn, 0.45); } catch (e) { /* quiet */ } }, (at - A.ctx.currentTime)*1000 + 600); JOB.wire(A, t, false); t += 2; continue; }
      const k = j === 'pops' ? 'rev' : j === 'hum' ? 'wire' : j, f = JOB[k]; if (!f) continue;
      t += f(A, t, j === 'pops' || j === 'hum') + 0.3;
    }
  });
}
const fit = GarageUI.prototype.fit;
GarageUI.prototype.fit = function (...a) {
  const jobs = [...new Set([...this.queue.values()].map(q => OF[q.cat] || null).filter(Boolean))], n0 = this.queue.size;
  const r = fit.apply(this, a);
  const hk = (this.base && this.base.horn) || ({ scooter: 'scooter', bike: 'beep', auto: 'beep' }[this.type]) || 'car';
  if (n0 && !this.queue.size) play(this.g, jobs, hk);                       // (done: the queue's empty; short of money it isn't)
  return r;
};
const pick = GarageUI.prototype.pick;
GarageUI.prototype.pick = function (i, ...a) {
  const o = this.opts && this.opts[i], m0 = this.g.stats ? this.g.stats.money : 0;
  const r = pick.call(this, i, ...a);
  if (o && o.job && !o.off && this.g.stats && this.g.stats.money !== m0) {
    const n = o.name || '';
    play(this.g, [/Repair/.test(n) ? 'hammer' : /service/i.test(n) ? 'service' : /Wash/.test(n) ? 'wash' : /nitrous/i.test(n) ? 'nitro' : null].filter(Boolean));
  }
  return r;
};
