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
  v8: { cyl: 8, idle: 850, red: 7200, h: 0.8, sub: 0.45, nz: 0.12, nf: 2200, f1: [160, 2, 8], f2: [600, 2, 5], lp: [400, 3200], drive: 2.0, vol: 0.05 },
  v10: { cyl: 10, idle: 1000, red: 8500, h: 0.85, sub: 0.25, nz: 0.1, nf: 3000, f1: [260, 2, 7], f2: [900, 2, 6], lp: [550, 4500], drive: 1.9, vol: 0.05 },
};
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
function tune(A, V, k) {
  if (V.cls === k) return;
  V.cls = k; const C = CLS[k], t = A.ctx.currentTime;
  V.osc.setPeriodicWave(waveFor(A.ctx, C));
  const c = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i/256 - 1; c[i] = Math.tanh(x*C.drive)/Math.tanh(C.drive); }
  V.shaper.curve = c;
  V.nbp.frequency.setValueAtTime(C.nf, t);
  V.f1.frequency.setValueAtTime(C.f1[0], t); V.f1.Q.setValueAtTime(C.f1[1], t); V.f1.gain.setValueAtTime(C.f1[2], t);
  V.f2.frequency.setValueAtTime(C.f2[0], t); V.f2.Q.setValueAtTime(C.f2[1], t); V.f2.gain.setValueAtTime(C.f2[2], t);
}
// set a voice going: r 0..1 of the way from idle to redline, load 0..1 (the throttle, how hard it's pulling), gain
function drive(A, V, k, r, load, gain) {
  const C = CLS[k], t = A.ctx.currentTime, rate = A.rateMul || 1, loud = A.engLoud || 1;
  tune(A, V, k);
  const rpm = C.idle + (C.red - C.idle)*Math.max(0, Math.min(1.08, r));
  // four-stroke: each cylinder fires once every two turns; a touch of wander, an engine's never metronomic
  const f = rpm/120*C.cyl*rate*(1 + (Math.random() - 0.5)*0.006);
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
function silence(A, V, tc = 0.2) { if (V) V.out.gain.setTargetAtTime(0, A.ctx.currentTime, tc); }
const mkVoice = voice;

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
  drive(this, this._pe, k, r, Math.max(0, Math.min(1, throttle)), 1.6);
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
  near.sort((a, b) => a[0] - b[0]);
  const t = this.ctx.currentTime;
  this._te.forEach((T, i) => {
    const n = near[i];
    if (!n) { if (T.v) { T.v = null; silence(this, T.V, 0.3); } return; }
    const [, v, k] = n, sp = Math.abs(v.v || 0), acc = T.v === v ? Math.max(0, sp - T.sp0)/0.12 : 0;
    T.v = v; T.sp0 = sp;
    drive(this, T.V, k, revsAt(k, sp), Math.min(1, acc*0.6 + (sp > 0.5 ? 0.15 : 0)), 1);
    if (T.pn.positionX) { T.pn.positionX.setTargetAtTime(v.rx ?? v.x, t, 0.08); T.pn.positionZ.setTargetAtTime(v.rz ?? v.z, t, 0.08); } else T.pn.setPosition(v.x, 0.8, v.z);
  });
};
