// A cat's meow, and a dog's bark, never the same twice.
// The meow is made the way a cat makes it: a voice (vocal folds buzzing, the overtones falling away as a throat's do)
// shaped by a mouth that opens and closes as it goes, three resonances moving from the closed "m-ee" to the open "aa"
// and round to the "ow". Every cat is its own size (a kitten higher and smaller-mouthed than a tom) and every call is
// one of the ways cats call: the short "mew", the questioning "mrrp?" that goes up, the rolled "mrrrow" with the
// purr-trill at its start, the long complaining "meeeaaow", the flat little "eh" of a cat who wants the door. The
// pitch wanders (no voice holds a note), the loudness shimmers, a breath of air runs under it.
// The bark is the recorded dogs (assets/snd), never played the same way twice: every dog its own size (bigger, lower
// and slower), barking once, twice, a run of them or a "wuf-wuf" in quick pairs, each bark a touch higher or lower,
// louder or softer, from the start or a hair in, through its own throat (a resonance where that dog's chest is).
import { Audio } from '@orig/game/audio.js';

let GLOT = null;
// a throat's buzz: every overtone there, each a little weaker than the one before (not a saw's hard edge)
function glottal(ctx) {
  if (GLOT && GLOT.ctx === ctx) return GLOT.w;
  const n = 40, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = Math.pow(k, -1.25)*(k % 2 ? 1 : 0.8);
  GLOT = { ctx, w: ctx.createPeriodicWave(re, im) };
  return GLOT.w;
}
// the ways a cat calls: [length (s), pitch at points along it (share of its top), how the mouth moves (closed 0 .. open 1), a trill at the start]
const CALLS = [
  { n: 'mew', d: [0.22, 0.35], f: [[0, 0.8], [0.3, 1], [1, 0.85]], m: [[0, 0.2], [0.4, 0.8], [1, 0.4]], tr: 0, w: 3 },
  { n: 'mrrp', d: [0.25, 0.4], f: [[0, 0.6], [0.5, 0.75], [1, 1.12]], m: [[0, 0.1], [0.6, 0.5], [1, 0.7]], tr: 0.45, w: 2 },
  { n: 'mrrow', d: [0.55, 0.85], f: [[0, 0.62], [0.3, 0.9], [0.55, 1], [1, 0.62]], m: [[0, 0.1], [0.35, 0.9], [0.7, 0.75], [1, 0.25]], tr: 0.3, w: 3 },
  { n: 'meow', d: [0.5, 0.8], f: [[0, 0.7], [0.3, 1], [0.6, 0.92], [1, 0.58]], m: [[0, 0.15], [0.3, 0.95], [0.75, 0.6], [1, 0.2]], tr: 0, w: 4 },
  { n: 'yowl', d: [0.9, 1.5], f: [[0, 0.75], [0.25, 0.95], [0.5, 1.05], [0.75, 0.9], [1, 0.7]], m: [[0, 0.2], [0.3, 1], [0.8, 0.85], [1, 0.3]], tr: 0, w: 1 },
  { n: 'eh', d: [0.12, 0.2], f: [[0, 0.95], [1, 0.9]], m: [[0, 0.5], [1, 0.6]], tr: 0, w: 2 },
];
const pick = (R) => { let s = 0; for (const c of CALLS) s += c.w; let r = R()*s; for (const c of CALLS) { if ((r -= c.w) < 0) return c; } return CALLS[0]; };
const lerpPath = (P, u) => { for (let i = 1; i < P.length; i++) if (u <= P[i][0]) { const a = P[i - 1], b = P[i], k = (u - a[0])/(b[0] - a[0] || 1); return a[1] + (b[1] - a[1])*k; } return P[P.length - 1][1]; };

Audio.prototype.meow = function (x, z, size) {
  if (!this.ctx) return;
  const go = () => {
    try {
      const ctx = this.ctx, R = Math.random, t = ctx.currentTime + 0.01, C = pick(R);
      // this cat: small and high to big and low; its mouth as big as it is
      const sz = size ?? R(), top = 560 + (1 - sz)*420 + R()*60, mouth = 1.15 - sz*0.3;
      const dur = C.d[0] + R()*(C.d[1] - C.d[0]);
      const v = ctx.createOscillator(); v.setPeriodicWave(glottal(ctx));
      // the pitch along the call, with a voice's wander (a few random steps, never a clean line)
      const f = v.frequency, steps = Math.max(6, Math.round(dur*28));
      for (let i = 0; i <= steps; i++) { const u = i/steps, j = 1 + (R() - 0.5)*0.035; f.linearRampToValueAtTime(top*lerpPath(C.f, u)*j, t + u*dur); }
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.5 + R()*3; vg.gain.value = top*(0.006 + R()*0.01); vib.connect(vg); vg.connect(f);
      // breath under the voice, more of it in a yowl and a little "eh"
      const nb = ctx.createBuffer(1, Math.ceil(ctx.sampleRate*(dur + 0.1)), ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = R()*2 - 1;
      const n = ctx.createBufferSource(); n.buffer = nb; const ng = ctx.createGain(); ng.gain.value = 0.1 + R()*0.12 + (C.n === 'yowl' || C.n === 'eh' ? 0.1 : 0);
      const src = ctx.createGain(); v.connect(src); n.connect(ng); ng.connect(src);
      // the rolled "rr": the voice chopped at a purr's rate at the start of the call
      const trill = ctx.createGain(); src.connect(trill);
      if (C.tr > 0) {
        const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 22 + R()*8; lfo.type = 'triangle'; lg.gain.value = 0.5;
        lfo.connect(lg); lg.connect(trill.gain); trill.gain.setValueAtTime(0.5, t); trill.gain.setValueAtTime(0.5, t + C.tr*dur); trill.gain.linearRampToValueAtTime(1, t + C.tr*dur + 0.03);
        lg.gain.setValueAtTime(0.5, t + C.tr*dur); lg.gain.linearRampToValueAtTime(0, t + C.tr*dur + 0.03);
        lfo.start(t); lfo.stop(t + dur + 0.05);
      }
      // the mouth: three resonances, closed "ee" (F1 low, F2 high) to open "aa" (F1 up, F2 down) to round "ow" (both low)
      const mix = ctx.createGain();
      const form = (m) => [(380 + 560*m)*mouth, (2300 - 900*m - (m > 0.7 ? 300 : 0))*mouth, (3200 - 300*m)*mouth];
      const amp = [1, 0.5 + R()*0.15, 0.2 + R()*0.1], Q = [5 + R()*2, 8 + R()*3, 10];
      for (let k = 0; k < 3; k++) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = Q[k];
        for (let i = 0; i <= 8; i++) { const u = i/8; bp.frequency.linearRampToValueAtTime(form(lerpPath(C.m, u))[k], t + u*dur); }
        const g = ctx.createGain(); g.gain.value = amp[k]; trill.connect(bp); bp.connect(g); g.connect(mix);
      }
      // a little nasal hum in the "m"
      const nas = ctx.createBiquadFilter(); nas.type = 'bandpass'; nas.frequency.value = 260*mouth; nas.Q.value = 4; const ngn = ctx.createGain(); ngn.gain.setValueAtTime(0.5, t); ngn.gain.linearRampToValueAtTime(0, t + Math.min(0.12, dur*0.3)); trill.connect(nas); nas.connect(ngn); ngn.connect(mix);
      // loudness: soft in, full on the vowel, a shimmer, away
      const out = ctx.createGain(), A = out.gain, lv = 0.38 + R()*0.22;
      A.setValueAtTime(0, t); A.linearRampToValueAtTime(lv*0.3, t + 0.03);
      for (let i = 1; i <= steps; i++) { const u = i/steps, env = Math.min(1, u/0.3)*(u > 0.75 ? 1 - (u - 0.75)/0.25*0.9 : 1); A.linearRampToValueAtTime(lv*env*(0.9 + R()*0.2), t + u*dur); }
      A.linearRampToValueAtTime(0, t + dur + 0.03);
      mix.connect(out);
      if (this.out3) this.out3(out, 0, this.bus('world')); else out.connect(this.master || ctx.destination);
      v.start(t); vib.start(t); n.start(t); v.stop(t + dur + 0.08); vib.stop(t + dur + 0.08); n.stop(t + dur + 0.08);
    } catch (e) { /* silent */ }
  };
  if (x !== undefined && this.at) this.at(x, z, go, 0.3); else go();
};

// a bark: the recordings, as a dog of its own size barks them
const _bark = Audio.prototype.bark;
Audio.prototype.bark = function (vol = 0.3, pan = Math.random()*1.6 - 0.8) {
  if (!this.ctx) return;
  if (!this.buf || !this.buf.dog_bark) return _bark.call(this, vol, pan);
  const R = Math.random, size = R(), base = 1.28 - size*0.45;                 // (a pup's yap to a big dog's woof)
  const chest = 350 + (1 - size)*600;                                          // where its chest rings
  // how it barks this time: once, twice, a run, or in quick pairs
  const way = R(), times = [];
  if (way < 0.25) times.push(0);
  else if (way < 0.5) times.push(0, 0.32 + R()*0.18);
  else if (way < 0.8) { let t = 0; const k = 3 + Math.floor(R()*3), gap = 0.28 + R()*0.2; for (let i = 0; i < k; i++) { times.push(t); t += gap*(0.85 + R()*0.35); } }
  else { let t = 0; for (let i = 0; i < 2 + Math.floor(R()*2); i++) { times.push(t, t + 0.13 + R()*0.05); t += 0.6 + R()*0.3; } }
  const which = R() < 0.5 ? 'dog_bark' : 'dog_bark2';
  times.forEach((d, i) => {
    const nm = R() < 0.7 ? which : (which === 'dog_bark' ? 'dog_bark2' : 'dog_bark');
    // each one a little different: pitch, loudness (the last of a run trails off), a hair in from the start
    const tail = times.length > 2 && i === times.length - 1 ? 0.7 : 1;
    this.play(nm, { vol: vol*0.8*(0.75 + R()*0.4)*tail, pan, rate: base*(0.95 + R()*0.1), delay: d, offset: R()*0.03, filter: { type: 'peaking', f: chest*(0.9 + R()*0.2), q: 1.2, gain: 3 + R()*4 } });
  });
};
