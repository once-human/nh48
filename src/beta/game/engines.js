// Every vehicle sounds like its own engine. There was one synth for an auto, a scooter, a motorbike and a bicycle alike,
// one recorded idle for every car and one for every bus, and three plain tones for the whole street (a cycle hummed like
// a car). Now each engine is worked out from what it is (the spec's own words: a single, a V10, a diesel, CNG, how big)
// and made the way an engine makes it: a firing pulse at the rate its cylinders fire (one bang every two turns of the
// crank, each cylinder), the harmonics that pulse has for that layout (a single is a train of hard knocks, a four a
// smoother buzz, a V8 the lope of its uneven pairs), the exhaust's and the intake's resonances, combustion noise beating
// with the firing, all of it brighter and harder under load and softer on the overrun. Idle and redline are the engine's.
// A bicycle has no engine: the freewheel ticks while you coast and the chain whirs when you pedal. Kept quieter than before.
import { Audio } from '@orig/game/audio.js';
import { specOf } from '@orig/vehicles/vehicle.js';
import { baseOf } from '../vehicles/models.js';
// The audio thread has to read every sound's settings, and it can't wait: if the game's in the middle of changing one, it plays
// that moment of the sound with the setting's default instead, which is a click or a hole in the sound. Every engine, tyre and
// wind sound was changing a handful of settings on every frame, and more at high speed, with less time to spare. So a setting
// changes at most 25 times a second, and only when it really changes. (Anything set for later, or a first or a big move, goes
// straight through.)
const stt0 = AudioParam.prototype.setTargetAtTime;
AudioParam.prototype.setTargetAtTime = function (v, t, tc) {
  const l = this._lv, T = this._lt;
  if (T !== undefined && t >= T && t < T + 0.5) {
    const c = Math.abs(v - l), big = v === 0 ? l !== 0 : c > Math.abs(l)*0.3 + 1e-4;
    if (!big && (t < T + 0.04 || c <= Math.abs(l)*0.004)) return this;
  }
  this._lv = v; this._lt = t;
  return stt0.call(this, v, t, tc);
};
const SHAPE_DR = 3, SHAPE_CURVE = new Float32Array(512);
for (let i = 0; i < 512; i++) { const x = i/256 - 1; SHAPE_CURVE[i] = Math.tanh(x*SHAPE_DR)/Math.tanh(SHAPE_DR); }

// cyl: cylinders; idle, red: rpm; h: harmonic fall-off (higher is smoother); sub: the half-order lope (uneven firing,
// a single's thump); nz: combustion noise; nf: its band (Hz); f1, f2: exhaust and intake resonances [Hz, Q, dB];
// lp: the muffler's cut-off at idle and how far load opens it; drive: grit; vol; cvt: a scooter's belt holds the revs
const CLS = {
  scooter: { cyl: 1, idle: 1500, red: 7800, h: 0.75, sub: 0.25, nz: 0.18, nf: 2600, f1: [650, 2, 6], f2: [2100, 3, 4], lp: [900, 2600], drive: 1.4, vol: 0.045, cvt: true },
  commuter: { cyl: 1, idle: 1300, red: 8500, h: 0.6, sub: 0.45, nz: 0.22, nf: 1800, f1: [420, 2.5, 7], f2: [1500, 3, 4], lp: [700, 2400], drive: 2.2, vol: 0.05 },
  thumper: { cyl: 1, idle: 900, red: 5500, h: 0.5, sub: 0.8, nz: 0.2, nf: 900, f1: [170, 3, 9], f2: [700, 2, 4], lp: [420, 1500], drive: 2.6, vol: 0.06 },
  i4bike: { cyl: 4, idle: 1300, red: 13000, h: 0.9, sub: 0.06, nz: 0.12, nf: 3200, f1: [700, 2, 6], f2: [2400, 3, 5], lp: [1100, 4200], drive: 1.6, vol: 0.05 },
  auto: { cyl: 1, idle: 1100, red: 5200, h: 0.55, sub: 0.7, nz: 0.32, nf: 1300, f1: [300, 2.5, 8], f2: [1100, 2, 5], lp: [520, 1700], drive: 2.8, vol: 0.055 },
  i3: { cyl: 3, idle: 850, red: 6000, h: 0.85, sub: 0.3, nz: 0.1, nf: 1400, f1: [160, 2, 6], f2: [520, 2, 4], lp: [380, 1500], drive: 1.3, vol: 0.04 },
  i4: { cyl: 4, idle: 800, red: 6200, h: 1.05, sub: 0.08, nz: 0.08, nf: 1600, f1: [140, 2, 6], f2: [480, 2, 4], lp: [340, 1600], drive: 1.15, vol: 0.038 },
  i4t: { cyl: 4, idle: 750, red: 6500, h: 1.1, sub: 0.06, nz: 0.1, nf: 3600, f1: [130, 2, 6], f2: [520, 2, 3], lp: [320, 1700], drive: 1.1, vol: 0.036 },
  diesel4: { cyl: 4, idle: 750, red: 4200, h: 0.8, sub: 0.15, nz: 0.3, nf: 2800, f1: [120, 2, 7], f2: [900, 3, 5], lp: [300, 1200], drive: 1.9, vol: 0.05 },
  diesel6: { cyl: 6, idle: 600, red: 2500, h: 0.75, sub: 0.18, nz: 0.34, nf: 2400, f1: [90, 2.5, 9], f2: [700, 3, 5], lp: [240, 900], drive: 2.0, vol: 0.06 },
  v8: { cyl: 8, idle: 850, red: 7200, h: 0.8, sub: 0.45, nz: 0.12, nf: 2200, f1: [160, 2, 8], f2: [600, 2, 5], lp: [400, 3200], drive: 2.0, vol: 0.08, swell: 1.3 },
  v10: { cyl: 10, idle: 1000, red: 8500, h: 0.85, sub: 0.25, nz: 0.1, nf: 3000, f1: [260, 2, 7], f2: [900, 2, 6], lp: [550, 4500], drive: 1.9, vol: 0.095, swell: 1.5 },
};
// the firing itself (beta: an AudioWorklet, below): ev, where in the two turns of the crank each cylinder fires (0..1);
// amp, how hard each one (a V8's two banks into their pipes give the lope); dec, how fast a pulse dies (s); nz, how
// much of it is roar rather than thump; pipe, the exhaust's length as its echo (s: its note is 1/pipe); fb and damp, how
// much it rings and how dull; irr, how uneven it runs at idle (cycle to cycle); knock, a diesel's clatter
const even = (n) => [...Array(n).keys()].map(i => i/n);
const PULSE = {
  scooter: { ev: [0], amp: [1], dec: 0.0025, nz: 0.22, pipe: 0.0021, fb: 0.55, damp: 0.5, irr: 0.06, knock: 0, g: 1 },
  commuter: { ev: [0], amp: [1], dec: 0.003, nz: 0.2, pipe: 0.0028, fb: 0.6, damp: 0.45, irr: 0.08, knock: 0, g: 1 },
  thumper: { ev: [0], amp: [1], dec: 0.0065, nz: 0.1, pipe: 0.0058, fb: 0.7, damp: 0.33, irr: 0.13, knock: 0, g: 1.15 },
  i4bike: { ev: even(4), amp: [1, 0.97, 1.02, 0.99], dec: 0.0016, nz: 0.14, pipe: 0.0016, fb: 0.5, damp: 0.6, irr: 0.02, knock: 0, g: 0.95 },
  auto: { ev: [0], amp: [1], dec: 0.0035, nz: 0.34, pipe: 0.0033, fb: 0.55, damp: 0.55, irr: 0.1, knock: 0, g: 1 },
  i3: { ev: even(3), amp: [1, 0.94, 1.05], dec: 0.003, nz: 0.1, pipe: 0.0045, fb: 0.6, damp: 0.4, irr: 0.05, knock: 0, g: 1 },
  i4: { ev: even(4), amp: [1, 0.98, 1.02, 0.99], dec: 0.0028, nz: 0.08, pipe: 0.005, fb: 0.55, damp: 0.4, irr: 0.03, knock: 0, g: 1 },
  i4t: { ev: even(4), amp: [1, 0.98, 1.02, 0.99], dec: 0.0024, nz: 0.12, pipe: 0.0047, fb: 0.5, damp: 0.45, irr: 0.03, knock: 0, g: 0.95 },
  diesel4: { ev: even(4), amp: [1, 0.96, 1.03, 0.98], dec: 0.0022, nz: 0.24, pipe: 0.006, fb: 0.55, damp: 0.35, irr: 0.05, knock: 0.5, g: 1 },
  diesel6: { ev: even(6), amp: [1, 0.97, 1.02, 0.99, 1.03, 0.98], dec: 0.0025, nz: 0.26, pipe: 0.0075, fb: 0.6, damp: 0.3, irr: 0.04, knock: 0.45, g: 1.05 },
  v8: { ev: even(8), amp: [1, 0.78, 1.12, 0.74, 0.96, 1.08, 0.8, 1.02], dec: 0.0034, nz: 0.1, pipe: 0.0052, fb: 0.65, damp: 0.35, irr: 0.05, knock: 0, g: 1.8 },
  v10: { ev: even(10), amp: [1, 0.92, 1.06, 0.95, 1.02, 0.97, 1.05, 0.93, 1.01, 0.99], dec: 0.002, nz: 0.1, pipe: 0.0034, fb: 0.55, damp: 0.5, irr: 0.02, knock: 0, g: 2.3 },
};
// the engine as it runs, sample by sample: each cylinder's firing a pressure pulse into the pipe, never two cycles quite
// alike (lumpier at idle, steadier as it revs), the pipe ringing with it, a diesel's knock on each firing; revs and
// load glide (the parameters are smoothed per sample here, so nothing steps or zips)
// what's on top of the firing, by the kind of engine, and how old they run (age [from, to]): rattle and the revs it buzzes
// at (rr, rw), tick (tappets), whine and its ratio to the crank (whR), roar (the intake, roarF its note), crk (overrun, per s)
const LAY = {
  scooter: { age: [0.2, 0.8], rattle: 0.05, rr: 3200, rw: 700, tick: 0.012, whine: 0.016, whR: 3.1, roar: 0.02, roarF: 1400 },
  commuter: { age: [0.2, 0.9], rattle: 0.05, rr: 2900, rw: 600, tick: 0.03, whine: 0.008, whR: 4.2, roar: 0.03, roarF: 1200 },
  thumper: { age: [0.1, 0.7], rattle: 0.04, rr: 1500, rw: 400, tick: 0.055, whine: 0.006, whR: 3.6, roar: 0.03, roarF: 600 },
  i4bike: { age: [0, 0.2], rattle: 0, rr: 1, rw: 1, tick: 0.006, whine: 0.022, whR: 5.5, roar: 0.2, roarF: 1700, crk: 7 },
  auto: { age: [0.45, 1], rattle: 0.2, rr: 1500, rw: 650, tick: 0.09, whine: 0.04, whR: 6, roar: 0.015, roarF: 800 },
  i3: { age: [0.1, 0.8], rattle: 0.012, rr: 1000, rw: 250, tick: 0.004, whine: 0.003, whR: 7, roar: 0.008, roarF: 500 },
  i4: { age: [0.1, 0.7], rattle: 0.008, rr: 950, rw: 220, tick: 0.003, whine: 0.003, whR: 7, roar: 0.008, roarF: 500 },
  i4t: { age: [0, 0.3], rattle: 0, rr: 1, rw: 1, tick: 0.002, whine: 0.009, whR: 21, roar: 0.012, roarF: 650 },
  diesel4: { age: [0.2, 0.9], rattle: 0.05, rr: 950, rw: 300, tick: 0.04, whine: 0.014, whR: 8, roar: 0.012, roarF: 420 },
  diesel6: { age: [0.3, 1], rattle: 0.1, rr: 750, rw: 220, tick: 0.03, whine: 0.04, whR: 4, roar: 0.02, roarF: 320 },
  v8: { age: [0, 0.25], rattle: 0, rr: 1, rw: 1, tick: 0.003, whine: 0.004, whR: 6, roar: 0.85, roarF: 800, crk: 9 },
  v10: { age: [0, 0.15], rattle: 0, rr: 1, rw: 1, tick: 0.003, whine: 0.006, whR: 6, roar: 1.3, roarF: 1250, crk: 12 },
};
// no two alike: each vehicle's engine is its kind with its own pipe, its own unevenness, and whatever age has done to it
const selves = new Map();
function self(k, seed) {
  const key = k + (seed & 31); let Q = selves.get(key); if (Q) return Q;
  let h = (Math.imul((seed & 31) + 1, 2654435761) ^ k.length*97) >>> 0;
  const r = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h/4294967296; };
  const P = PULSE[k], L = LAY[k], age = L.age[0] + r()*(L.age[1] - L.age[0]);
  Q = { key, age, f1: 1 + (r() - 0.5)*0.14, f2: 1 + (r() - 0.5)*0.16, idle: 1 + (r() - 0.5)*0.1 + age*0.05,
    pulse: { ...P, pipe: P.pipe*(1 + (r() - 0.5)*0.1), dec: P.dec*(1 + (r() - 0.5)*0.2), irr: P.irr*(0.7 + r()*0.5 + age*0.9), amp: P.amp.map(a => a*(1 + (r() - 0.5)*(0.04 + 0.14*age))),
      miss: age*age*0.02, wand: 0.006 + 0.014*age, rattle: L.rattle*(0.35 + age), rr: L.rr*(0.8 + r()*0.5), rw: L.rw, tick: L.tick*(0.6 + age*0.8), whine: L.whine*(0.7 + r()*0.6), whR: L.whR*(1 + (r() - 0.5)*0.08), roar: L.roar, roarF: L.roarF*(0.92 + r()*0.16), crk: L.crk || 0 } };
  selves.set(key, Q); return Q;
}
const seedOf = (v) => v._es ?? (v._es = Math.floor(Math.random()*32));
const PROC = `class NhEngine extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'rpm', defaultValue: 800, minValue: 0, maxValue: 20000 }, { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1 }]; }
  constructor() { super(); this.wd = 0; this.tk = 0; this.rt = 0; this.wh = 0; this.rl = 0; this.rb = 0; this.res = 0; this.hn = 0; this.hc = 0; this.ck = 0; this.bk = 0; this.c = null; this.ph = 0; this.k = 0; this.nx = 0; this.env = 0; this.kn = 0; this.buf = new Float32Array(4096); this.w = 0; this.lp = 0; this.dc = 0; this.dx = 0; this.s = 22222; this.r = 0; this.l = 0;
    this.port.onmessage = (e) => { if (e.data.z !== undefined) { this.z = e.data.z; return; } this.c = e.data; this.k = 0; this.nx = this.ph + 0.01; }; }
  rnd() { this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0; return this.s/4294967296; }
  process(_, outs, P) {
    const o = outs[0] && outs[0][0]; if (!o) return true; const c = this.c; if (!c || this.z) { o.fill(0); return true; }
    const sr = sampleRate, R = P.rpm, L = P.load, ev = c.ev, n = ev.length, D = Math.max(2, Math.min(4000, Math.round(c.pipe*sr))), dE = Math.exp(-1/(c.dec*sr)), dK = Math.exp(-1/(0.0007*sr));
    for (let i = 0; i < o.length; i++) {
      this.r += ((R.length > 1 ? R[i] : R[0]) - this.r)*0.0015; this.l += ((L.length > 1 ? L[i] : L[0]) - this.l)*0.0008;
      if ((++this.bk & 63) === 0) { this.wd = (this.wd + (this.rnd() - 0.5)*(c.wand || 0)*0.25)*0.993; if (c.rattle) { const q = (this.r - c.rr)/c.rw; this.res = Math.exp(-q*q); } }
      const rpm = Math.max(1, this.r)*(1 + this.wd), load = this.l;
      this.ph += rpm/120/sr;
      while (this.ph >= this.nx) {
        const idle = Math.max(0, 1 - (rpm - c.idle)/(c.idle*1.5)), irr = c.irr*(0.35 + 0.65*idle) + 0.012;
        let a = c.amp[this.k % c.amp.length]*(1 + (this.rnd() - 0.5)*2*irr)*(0.55 + 0.45*load + 0.2*rpm/c.red);
        if (c.miss && this.rnd() < c.miss*(0.25 + 0.75*idle)) a *= 0.2;     // (a tired one that doesn't quite catch)
        this.rt += a; if (this.k === 0) this.tk = 1;
        this.env += a; this.kn += c.knock*a*(0.5 + 0.5*load);
        this.k++; if (this.k >= n) { this.k = 0; this.ph -= 1; this.nx -= 1; }
        this.nx = Math.floor(this.nx) + ev[this.k] + (this.k === 0 ? 1 : 0) + (this.rnd() - 0.5)*irr*0.02;
        if (this.nx <= this.ph) this.nx = this.ph + 1e-6;
      }
      const nz = this.rnd()*2 - 1, x = this.env*((1 - c.nz) + c.nz*nz*(0.6 + 0.6*load)) + this.kn*(this.rnd()*2 - 1);
      this.env *= dE; this.kn *= dK;
      const d = this.buf[(this.w - D) & 4095]; this.lp += (d - this.lp)*c.damp;
      const y = x + c.fb*this.lp; this.buf[this.w & 4095] = y; this.w++;
      const out = y - this.dx + 0.996*this.dc; this.dx = y; this.dc = out;
      // what's bolted to the engine: the tappets, a loose panel at the revs it buzzes at, the gears, the air going in, a crackle on the overrun
      let ex = 0, rr = rpm/c.red;
      if (c.tick) { ex += c.tick*this.tk*(this.rnd()*2 - 1); this.tk *= 0.955; }
      if (c.rattle) { if (--this.hc <= 0) { this.hc = sr/(560 + this.rnd()*420); this.hn = this.rnd()*2 - 1; } ex += c.rattle*this.res*Math.min(1.5, this.rt)*this.hn; this.rt *= 0.9965; }
      if (c.whine) { this.wh += rpm/60*c.whR/sr; if (this.wh > 1) this.wh -= 1; ex += c.whine*(0.2 + 0.8*load)*Math.min(1, rr*1.6)*Math.sin(6.2832*this.wh); }
      if (c.roar) { const f = 6.2832*c.roarF/sr; this.rl += ((this.rnd()*2 - 1) - this.rl)*f; this.rb += (this.rl - this.rb)*f*0.45; ex += c.roar*load*load*(0.25 + 0.75*rr)*(this.rl - this.rb)*(0.55 + 0.45*Math.min(1, this.env)); }
      if (c.crk) { if (load < 0.08 && rr > 0.45 && this.rnd() < c.crk/sr) this.ck = 0.6 + this.rnd()*0.8; if (this.ck > 0.001) { ex += this.ck*(this.rnd()*2 - 1)*0.5; this.ck *= 0.992; } }
      o[i] = out*c.g/(0.4 + rpm/120*n*c.dec*1.6) + ex;
    }
    return true;
  }
}
registerProcessor('nh-engine', NhEngine);`;
let wk = null;
// (loaded once, in the background; until it is, the older synth below plays)
function worklet(A) {
  if (wk || !A.ctx || !A.ctx.audioWorklet) return wk && wk.ok;
  wk = { ok: false };
  const url = URL.createObjectURL(new Blob([PROC], { type: 'application/javascript' }));
  A.ctx.audioWorklet.addModule(url).then(() => { wk.ok = true; if (A._pe) silence(A, A._pe, 0.05); if (A._pc) cycleSilence(A, A._pc); A._pe = null; A._pc = null; if (A._te) { for (const T of A._te) { try { T.V.out.disconnect(); } catch (e) { /* gone */ } } A._te = null; } }).catch(() => { /* the older synth stays */ });
  return false;
}
// what engine a vehicle has, from its type and the spec's own description
const memo = new Map();
export function engineOf(type) {
  if (memo.has(type)) return memo.get(type);
  const base = baseOf(type || ''), S = specOf(type) || specOf(base) || {}, m = (S.model || '').toLowerCase();
  let k;
  if (/^cycle/.test(base)) k = 'cycle';
  else if (/^scooter/.test(base)) k = 'scooter';
  else if (base === 'superbike' || /1000 ?cc|zx-|inline-?4/.test(m)) k = 'i4bike';
  else if (base === 'bullet' || /thumper|350/.test(m)) k = 'thumper';
  else if (/^bike/.test(base)) k = 'commuter';
  else if (/^auto/.test(base)) k = 'auto';
  else if (base === 'bus') k = 'diesel6';
  else if (/v10|v12/.test(m) || base === 'super') k = 'v10';
  else if (/v8/.test(m) || base === 'sports') k = 'v8';
  else if (/diesel/.test(m) || base === 'tempo' || base === 'jeep') k = 'diesel4';
  else if (/turbo|2\.0|lux/.test(m) || base === 'lux') k = 'i4t';
  else { const cc = /(\d\.\d)\s*(petrol|l\b)/.exec(m) || /(\d\.\d)/.exec(m); k = cc && parseFloat(cc[1]) < 1.1 ? 'i3' : base === 'suv' ? 'diesel4' : 'i4'; }
  memo.set(type, k);
  return k;
}

function waveFor(ctx, C) {
  // a single's knock is rich all the way up; more cylinders, the smoother the sum
  const N = 40, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) im[n] = 1/Math.pow(n, C.h)*(n % 2 === 0 && C.cyl > 1 ? 0.7 : 1);
  return ctx.createPeriodicWave(re, im);
}
// one engine voice: built once, re-tuned to whatever engine it's given
function voice(A, dest) {
  const ctx = A.ctx;
  const osc = ctx.createOscillator(), sub = ctx.createOscillator(), oG = ctx.createGain(), sG = ctx.createGain();
  const nz = ctx.createBufferSource(); nz.buffer = A.noise; nz.loop = true;
  const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.Q.value = 0.8;
  const nAM = ctx.createGain(); nAM.gain.value = 0;
  const pulse = ctx.createOscillator(); pulse.type = 'square';
  const pG = ctx.createGain(); pG.gain.value = 0;
  const pre = ctx.createGain(), amp = ctx.createGain(), lope = ctx.createOscillator(), lG = ctx.createGain();
  const shaper = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), out = ctx.createGain();
  lp.type = 'lowpass'; lp.Q.value = 0.7; f1.type = 'peaking'; f2.type = 'peaking'; out.gain.value = 0;
  sub.type = 'sine'; lope.type = 'sine'; lG.gain.value = 0; amp.gain.value = 1;
  osc.connect(oG).connect(pre); sub.connect(sG).connect(pre);
  nz.connect(nbp).connect(nAM).connect(pre); pulse.connect(pG).connect(nAM.gain);
  pre.connect(amp); lope.connect(lG).connect(amp.gain);
  amp.connect(shaper).connect(lp).connect(f1).connect(f2).connect(out).connect(dest);
  osc.start(); sub.start(); nz.start(); pulse.start(); lope.start();
  return { osc, sub, oG, sG, nbp, nAM, pulse, pG, lope, lG, shaper, lp, f1, f2, out, cls: null, f: 0 };
}
// a voice on the worklet: the firing, then the muffler and the pipe's and the intake's colour as before
function wvoice(A, dest) {
  const ctx = A.ctx, eng = new AudioWorkletNode(ctx, 'nh-engine', { numberOfInputs: 0, outputChannelCount: [1] });
  const pre = ctx.createGain(); pre.gain.value = 0.7;
  const shaper = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), out = ctx.createGain();
  // (one curve, set once, how hard each engine drives it set by the gain before it: while a curve is swapped the audio thread can't
  // get at it and that moment of this voice is silence, and a passing car was a new one every time)
  shaper.curve = SHAPE_CURVE;
  lp.type = 'lowpass'; lp.Q.value = 0.6; f1.type = 'peaking'; f2.type = 'peaking'; out.gain.value = 0;
  eng.connect(pre).connect(shaper).connect(lp).connect(f1).connect(f2).connect(out).connect(dest);
  return { w: true, eng, pre, rpm: eng.parameters.get('rpm'), load: eng.parameters.get('load'), shaper, lp, f1, f2, out, cls: null };
}
function tune(A, V, k, seed = 0) {
  const Q = self(k, seed);
  if (V.cls === Q.key) return Q;
  V.cls = Q.key; const C = CLS[k], t = A.ctx.currentTime;
  if (V.w) V.eng.port.postMessage({ ...Q.pulse, idle: C.idle*Q.idle, red: C.red });
  else V.osc.setPeriodicWave(waveFor(A.ctx, C));
  const dr = V.w ? 1 + (C.drive - 1)*0.5 : C.drive;
  const c = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i/256 - 1; c[i] = Math.tanh(x*dr)/Math.tanh(dr); }
  if (V.w) V.pre.gain.value = 0.7*dr/SHAPE_DR; else V.shaper.curve = c;
  if (V.nbp) V.nbp.frequency.setValueAtTime(C.nf, t);     // (only the older synth has a noise band; the worklet makes its own)
  V.f1.frequency.setValueAtTime(C.f1[0]*Q.f1, t); V.f1.Q.setValueAtTime(C.f1[1], t); V.f1.gain.setValueAtTime(C.f1[2], t);
  V.f2.frequency.setValueAtTime(C.f2[0]*Q.f2, t); V.f2.Q.setValueAtTime(C.f2[1], t); V.f2.gain.setValueAtTime(C.f2[2], t);
  return Q;
}
// set a voice going: r 0..1 of the way from idle to redline, load 0..1 (the throttle, how hard it's pulling), gain
function drive(A, V, k, r, load, gain, seed = 0) {
  const C = CLS[k], t = A.ctx.currentTime, rate = A.rateMul || 1, loud = (A.engLoud || 1)*(A.modeVol || 1);
  if (V.w && V.idle) { V.idle = false; clearTimeout(V.napT); V.eng.port.postMessage({ z: 0 }); }
  const Q = tune(A, V, k, seed) || self(k, seed), idle = C.idle*Q.idle;
  const rpm = idle + (C.red - idle)*Math.max(0, Math.min(1.08, r));
  if (V.w) {
    // (the worklet smooths both itself; here only where they're headed)
    V.rpm.setTargetAtTime(rpm*rate, t, 0.04); V.load.setTargetAtTime(load, t, 0.08);
    V.lp.frequency.setTargetAtTime((C.lp[0] + C.lp[1]*(0.35*r + 0.65*load*(0.4 + r)))*(loud > 1 ? 0.8 : 1), t, 0.12);
    V.out.gain.setTargetAtTime(gain*C.vol*1.25*(0.6 + 0.25*r + 0.3*load)*(C.swell ? 0.55 + C.swell*load*(0.5 + r) : 1)*loud, t, 0.12);
    return;
  }
  // four-stroke: each cylinder fires once every two turns; a touch of wander, an engine's never metronomic
  const f = rpm/120*C.cyl*rate;
  if (Math.abs(f - V.f) > 0.15) {
    V.f = f;
    V.osc.frequency.setTargetAtTime(f, t, 0.03); V.sub.frequency.setTargetAtTime(f/2, t, 0.03);
    V.pulse.frequency.setTargetAtTime(f, t, 0.03); V.lG.gain.setTargetAtTime(C.sub*0.5*(1 - r*0.5), t, 0.05);
    V.lope.frequency.setTargetAtTime(f/2, t, 0.03);
  }
  V.oG.gain.setTargetAtTime(0.55, t, 0.05); V.sG.gain.setTargetAtTime(C.sub*0.45, t, 0.05);
  // combustion noise rides the firing, more of it under load
  V.pG.gain.setTargetAtTime(C.nz*(0.4 + load*0.9), t, 0.05);
  V.lp.frequency.setTargetAtTime((C.lp[0] + C.lp[1]*(0.35*r + 0.65*load*(0.4 + r)))*(loud > 1 ? 0.8 : 1), t, 0.05);
  V.out.gain.setTargetAtTime(gain*C.vol*(0.55 + 0.25*r + 0.35*load)*loud, t, 0.08);
}
// (and once it's faded, a voice nobody's listening to stops working: five engines ran flat out all the time, sound or no sound)
function silence(A, V, tc = 0.2) {
  if (!V) return;
  V.out.gain.setTargetAtTime(0, A.ctx.currentTime, tc);
  if (V.w && !V.idle) { V.idle = true; V.napT = setTimeout(() => { if (V.idle) V.eng.port.postMessage({ z: 1 }); }, tc*6000); }
}
const mkVoice = (A, dest) => worklet(A) ? wvoice(A, dest) : voice(A, dest);

// ---------------------------------------------------------------- a bicycle: freewheel and chain
function cycleVoice(A, dest) {
  const ctx = A.ctx, nz = ctx.createBufferSource(); nz.buffer = A.noise; nz.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
  const tick = ctx.createGain(); tick.gain.value = 0;
  const clk = ctx.createOscillator(); clk.type = 'square'; const cG = ctx.createGain(); cG.gain.value = 0;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2;
  const whir = ctx.createGain(); whir.gain.value = 0;
  const roll = ctx.createBiquadFilter(); roll.type = 'lowpass'; roll.frequency.value = 400; const rG = ctx.createGain(); rG.gain.value = 0;
  nz.connect(hp).connect(tick).connect(dest); clk.connect(cG).connect(tick.gain);
  nz.connect(bp).connect(whir).connect(dest);
  nz.connect(roll).connect(rG).connect(dest);
  nz.start(); clk.start();
  return { clk, cG, tick, whir, rG, bp };
}
function cycleDrive(A, Y, sp, pedal) {
  const t = A.ctx.currentTime, wheel = sp/2.1;                  // turns a second (a 700c wheel)
  const coast = sp > 0.4 && pedal < 0.05;
  // the pawls click over the ratchet: about two dozen to a turn
  Y.clk.frequency.setTargetAtTime(Math.max(1, wheel*24), t, 0.05);
  Y.cG.gain.setTargetAtTime(coast ? 0.012 : 0, t, 0.05);
  Y.whir.gain.setTargetAtTime(pedal > 0.05 && sp > 0.3 ? 0.006 + Math.min(0.01, sp*0.0015) : 0, t, 0.1);
  Y.bp.frequency.setTargetAtTime(900 + sp*90, t, 0.1);
  Y.rG.gain.setTargetAtTime(Math.min(0.012, sp*0.0016), t, 0.1);
}
function cycleSilence(A, Y) { if (!Y) return; const t = A.ctx.currentTime; Y.cG.gain.setTargetAtTime(0, t, 0.1); Y.whir.gain.setTargetAtTime(0, t, 0.1); Y.rG.gain.setTargetAtTime(0, t, 0.1); }

// ---------------------------------------------------------------- yours
const ue = Audio.prototype.updateEngine;
Audio.prototype.updateEngine = function (rpm, throttle, running, kind = 'auto') {
  if (!this.ctx) return;
  // the game's own synth and recordings stay quiet (and it still hushes the street when you stop)
  ue.call(this, rpm, throttle, running, running ? 'none' : kind);
  const G = window.__nhAskG, P = G && G.player;
  const v = running && P && !P.onFoot ? (P.inAuto ? P.auto : P.cur) : null;
  const k = v ? (v === P.auto ? 'auto' : engineOf(v.type)) : null;
  if (!this._pe) { this._pe = mkVoice(this, this.bus('traffic')); this._pc = cycleVoice(this, this.bus('traffic')); }
  if (!k || (v && (v.dead || v.wreck))) { silence(this, this._pe); cycleSilence(this, this._pc); return; }
  if (k === 'cycle') { silence(this, this._pe); cycleDrive(this, this._pc, Math.abs(v.v || 0), throttle); return; }
  cycleSilence(this, this._pc);
  const C = CLS[k];
  // a scooter's belt: open the throttle and the revs go up and stay there while the speed catches up
  let r = Math.max(0, Math.min(1.1, rpm || 0));
  if (C.cvt) { const sp = Math.min(1, Math.abs(v.v || 0)/((v.spec && v.spec.vTop) || 20)); r = throttle > 0.1 ? Math.max(r, 0.45 + 0.4*sp + 0.1*throttle) : Math.min(r, 0.1 + sp*0.5); }
  drive(this, this._pe, k, r, Math.max(0, Math.min(1, throttle)), 1.6, seedOf(v));
};

// ---------------------------------------------------------------- everyone else's: the nearest few, each where it is
// (their revs from their speed through the gears an engine like that has)
const GEARS = { scooter: [30], commuter: [5, 9, 13, 17, 22], thumper: [5, 10, 15, 20, 26], i4bike: [9, 16, 23, 30, 37, 44], auto: [4.5, 9, 13.5, 18],
  i3: [6, 11, 16, 22, 30], i4: [6, 11, 17, 24, 33], i4t: [7, 13, 20, 28, 38, 50], diesel4: [5, 10, 16, 22, 30], diesel6: [3.5, 7, 11, 15, 19], v8: [9, 16, 24, 33, 43, 55], v10: [10, 18, 27, 37, 48, 61, 75] };
function revsAt(k, sp) {
  const g = GEARS[k] || [10, 20, 30], C = CLS[k];
  if (C && C.cvt) return Math.min(1, 0.2 + sp/12);
  let lo = 0; for (const hi of g) { if (sp < hi) return Math.max(0.05, (sp - lo*0.55)/(hi - lo*0.55)); lo = hi; }
  return 1;
}
Audio.prototype.engines = function (list, lx, lz) {
  if (!this.ctx) return;
  const NV = 5;
  if (!this._te) { this._te = []; for (let i = 0; i < NV; i++) { const pn = this.panner({ x: 0, y: 0.8, z: 0 }, 6); pn.connect(this.bus('traffic')); this._te.push({ V: mkVoice(this, pn), pn, v: null, sp0: 0 }); } }
  const near = [];
  for (const v of list) {
    if (v.isPlayer || v.wreck || v.parked || v.hideBody) continue;
    const k = engineOf(v.type); if (k === 'cycle') continue;
    const q = (v.x - lx)**2 + (v.z - lz)**2; if (q > 3600) continue;
    near.push([q, v, k]);
  }
  // (flat out you can't pick out five engines over your own, and that's when the audio thread has the least to spare)
  const G = window.__nhAskG, Pc = G && G.player, fast = Pc && !Pc.onFoot && Math.abs(Pc.cur?.v || 0) > 22;
  near.sort((a, b) => a[0] - b[0]); near.length = Math.min(near.length, fast ? 2 : NV);
  const t = this.ctx.currentTime, want = new Map(near.map(n => [n[1], n]));
  // each voice keeps to its vehicle while it's still among the nearest (handing a voice from one to another mid-note
  // was a jump in the sound); a free one takes a newcomer, faded in rather than switched
  for (const T of this._te) if (T.v && !want.has(T.v)) { T.v = null; silence(this, T.V, 0.25); T.quiet = t + 0.35; }
  for (const n of near) {
    if (this._te.some(T => T.v === n[1])) continue;
    const T = this._te.find(q => !q.v && !(q.quiet > t)); if (!T) continue;
    T.v = n[1]; T.sp0 = Math.abs(n[1].v || 0); T.ld = 0.15;
  }
  this._te.forEach((T) => {
    const n = T.v && want.get(T.v);
    if (!n) return;
    const [, v, k] = n, sp = Math.abs(v.v || 0), acc = Math.max(0, sp - T.sp0)/0.12;
    T.sp0 = sp; T.ld += (Math.min(1, acc*0.6 + (sp > 0.5 ? 0.15 : 0)) - T.ld)*0.15;
    drive(this, T.V, k, revsAt(k, sp), T.ld, 1, seedOf(v));
    if (T.pn.positionX) { T.pn.positionX.setTargetAtTime(v.rx ?? v.x, t, 0.08); T.pn.positionZ.setTargetAtTime(v.rz ?? v.z, t, 0.08); } else T.pn.setPosition(v.x, 0.8, v.z);
  });
};
