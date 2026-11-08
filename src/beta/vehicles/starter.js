// Turning a key, and turning it off, sounds like the machine you're in. The starter motor is a little electric motor
// geared to the engine: its whine, and the engine's compressions against it, each one a heave that slows it and lets it
// go (a four-cylinder's quick even churn, a diesel's slow heavy ones with a clatter when it catches, a twin's lopsided
// pair, a single's one big thump). A scooter's is a short high whirr; an auto is started by hand, a pull on the lever
// beside the seat, once or twice, before it puts into life. A supercar's starter is quick and the engine flares up
// high and settles. Off: the engine runs down through its last few turns with a shudder, and on a diesel a shake.
// Each time a little different (how cold it is, how long it takes to catch, the battery).
import { baseOf } from './models.js';

// [starter whine Hz, compressions per second while cranking, how heavy each one, how it catches, flare]
const KIND = {
  car: { f: 210, pulse: 7, heavy: 0.5, catch: 'smooth', flare: 0.08 },
  diesel: { f: 150, pulse: 4.2, heavy: 0.9, catch: 'clatter', flare: 0.04 },
  super: { f: 290, pulse: 11, heavy: 0.35, catch: 'flare', flare: 0.5 },
  scooter: { f: 420, pulse: 9, heavy: 0.25, catch: 'smooth', flare: 0.1 },
  bike: { f: 330, pulse: 6, heavy: 0.55, catch: 'smooth', flare: 0.2 },
  single: { f: 260, pulse: 3.2, heavy: 1, catch: 'thump', flare: 0.15 },
  superbike: { f: 380, pulse: 12, heavy: 0.4, catch: 'flare', flare: 0.55 },
  auto: { f: 0, pulse: 0, heavy: 1, catch: 'pull', flare: 0.1 },
};
export function kindOf(v) {
  const b = baseOf(v.type || 'auto'), t = v.type || '';
  if (/^auto/.test(t) || b === 'auto') return 'auto';
  if (/superbike/.test(t)) return 'superbike';
  if (/bullet|enfield/.test(t)) return 'single';
  if (v.spec && v.spec.two) return /^bike/.test(b) ? 'bike' : 'scooter';
  if (b === 'super' || b === 'sports') return 'super';
  if (/bus|tempo|truck|jeep|bolero|scorpio|xuv|fortuner|thar/.test(t + ' ' + b)) return 'diesel';
  return 'car';
}
function out(A) { return A.bus ? A.bus('fx') : A.ctx.destination; }
function noise(ctx, dur) { const n = Math.ceil(ctx.sampleRate*dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random()*2 - 1; const s = ctx.createBufferSource(); s.buffer = b; return s; }
// a thump: a low knock and a puff of air
function thump(A, t, f, vol, len = 0.12) {
  const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(f*1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + len*0.6);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
  o.connect(g); g.connect(out(A)); o.start(t); o.stop(t + len + 0.02);
  const n = noise(ctx, len), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f*4; bp.Q.value = 1.2;
  ng.gain.setValueAtTime(vol*0.5, t); ng.gain.exponentialRampToValueAtTime(0.0008, t + len*0.8); n.connect(bp); bp.connect(ng); ng.connect(out(A)); n.start(t); n.stop(t + len);
}

// the starter, for `dur` seconds, then it catches
export function startSound(A, v, dur) {
  if (!A || !A.ctx) return;
  try {
    const ctx = A.ctx, t0 = ctx.currentTime + 0.02, K = KIND[kindOf(v)], R = Math.random, batt = 0.9 + R()*0.15;
    if (K.catch === 'pull') {
      // an auto: the lever, pulled hard once or twice, each pull a scrape and the engine coughing round
      const pulls = dur > 0.8 ? 2 : 1 + (R() < 0.3 ? 1 : 0);
      for (let i = 0; i < pulls; i++) {
        const t = t0 + i*0.55;
        const n = noise(ctx, 0.3), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(500, t + 0.25); bp.Q.value = 2;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.28); n.connect(bp); bp.connect(g); g.connect(out(A)); n.start(t); n.stop(t + 0.3);
        for (let k = 0; k < 3; k++) thump(A, t + 0.08 + k*0.07, 55 + R()*10, 0.3*(1 - k*0.25), 0.09);
      }
      return;
    }
    // the starter motor: a geared whine, slowed by every compression and let go
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth';
    const f = K.f*batt, pulse = K.pulse*(0.9 + R()*0.2);
    lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.7;
    o.frequency.setValueAtTime(f*0.6, t0); o.frequency.linearRampToValueAtTime(f, t0 + 0.12);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.05);
    const n = Math.max(2, Math.floor(dur*pulse));
    for (let i = 0; i < n; i++) {
      const t = t0 + 0.1 + i/pulse, d = 1/pulse;
      // a compression: the motor drags, then spins free
      o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f*(1 - 0.22*K.heavy), t + d*0.45); o.frequency.linearRampToValueAtTime(f*(1 + 0.05), t + d*0.9);
      g.gain.setValueAtTime(0.05, t); g.gain.linearRampToValueAtTime(0.05 + 0.03*K.heavy, t + d*0.4); g.gain.linearRampToValueAtTime(0.04, t + d*0.9);
      if (K.heavy > 0.45) thump(A, t + d*0.4, 45 + 30*(1 - K.heavy), 0.08*K.heavy, d*0.6);
    }
    const te = t0 + 0.1 + n/pulse;
    g.gain.setValueAtTime(0.045, te); g.gain.linearRampToValueAtTime(0, te + 0.08);
    o.connect(lp); lp.connect(g); g.connect(out(A)); o.start(t0); o.stop(te + 0.1);
    // and it catches
    if (K.catch === 'clatter') { for (let k = 0; k < 6; k++) thump(A, te + k*0.06, 70 + R()*20, 0.12*(1 - k*0.12), 0.07); }
    else if (K.catch === 'thump') { thump(A, te, 48, 0.3, 0.2); thump(A, te + 0.21, 46, 0.22, 0.18); }
    else thump(A, te, K.catch === 'flare' ? 70 : 55, 0.16, 0.12);
  } catch (e) { /* silent */ }
}
// what it does as it catches: a flare of revs (high on a supercar), settling to idle
export function flareOf(v) { return KIND[kindOf(v)].flare; }
// off: the last few turns running down, a shudder
export function stopSound(A, v) {
  if (!A || !A.ctx) return;
  try {
    const ctx = A.ctx, t = ctx.currentTime + 0.01, k = kindOf(v), K = KIND[k];
    const turns = k === 'diesel' ? 5 : k === 'single' ? 3 : 4;
    for (let i = 0; i < turns; i++) { const at = t + i*(0.07 + i*0.04); thump(A, at, (k === 'diesel' ? 50 : 60) - i*4, (0.12 + 0.05*K.heavy)*(1 - i/turns), 0.1 + i*0.02); }
    if (k === 'diesel') thump(A, t + 0.6, 38, 0.18, 0.3);                     // (the shake as it stops)
  } catch (e) { /* silent */ }
}
