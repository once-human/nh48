// Brakes as each vehicle really has them. A supercar's ceramic discs and wide tyres stop it in a fraction of what a tempo
// needs; a bus is long and heavy; a Bullet's drums are weak; a cycle's blocks weaker. ABS and traction control only on what
// really has them: press hard and those cars keep steering and stop straight, the ABS light pulsing; a WagonR, an auto or a
// tempo locks its wheels, skids on, hardly steers, screeches and leaves black lines. Very hard stops from high speed mark
// the road either way (world/skids.js). Drive modes on the cars that have them (O).
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { clamp } from '@orig/core/util.js';
import { baseOf } from './models.js';
import { skidAt } from '../world/skids.js';

// m/s² at full pedal
const BRAKE = { super: 15, sports: 14, lux: 11, superbike: 12, city: 9.2, xuv: 8.8, nexon: 8.6, hatch: 8.4, wagonr: 8, alto: 7.8, sedan: 8.6, taxi: 8, suv: 8.2, ertiga: 8, innova: 7.8, scorpio: 7.6, fortuner: 7.8, bolero: 7, jeep: 7.2, auto: 5, tempo: 5.2, bus: 4, scooter: 6.4, bike: 7, bullet: 5.8, cycle: 3.6 };
const ABS = new Set(['super', 'sports', 'lux', 'superbike', 'city', 'xuv', 'nexon', 'suv', 'fortuner', 'scorpio', 'innova', 'ertiga']);
const TCS = new Set(['super', 'sports', 'lux', 'xuv', 'fortuner', 'superbike', 'scorpio', 'suv', 'nexon', 'innova']);
// (as each one has them. A Huracan's ANIMA, a 992's dial, an E-Class's Dynamic Select, a ZX-10R's rider modes, Mahindra's Zip Zap
// Zoom, Toyota's and Tata's and Hyundai's buttons, a Thar's transfer lever, a City's ECON. Nothing on an Alto, a Splendor or an auto)
const MODES = { super: ['Strada', 'Sport', 'Corsa'], sports: ['Normal', 'Sport', 'Sport+', 'Wet'], lux: ['Comfort', 'Eco', 'Sport', 'Sport+'], xuv: ['Zip', 'Zap', 'Zoom'], scorpio: ['Zip', 'Zap', 'Zoom'],
  superbike: ['Road', 'Sport', 'Rain'], fortuner: ['Normal', 'Eco', 'Power'], innova: ['Normal', 'Eco', 'Power'], nexon: ['City', 'Eco', 'Sport'], suv: ['Normal', 'Eco', 'Sport'], jeep: ['2H', '4H', '4L'], city: ['Normal', 'ECON'] };
// What each mode does to the car, and they're not subtle. thr: the pedal's map. acc, top: the power it lets through. turn: how
// sharp the steering is. grip: tyres and how the dampers load them. loose: how soon the back lets go. vol: the exhaust's
// valves. pops: how often it spits (beta/vehicles/exotic.js). tcs: traction control, off in the last mode of the wild ones.
// esc: how hard the electronics keep the back in line: all of it in the calm modes, a little play in Sport, in Corsa nearly yours.
const FX = {
  super: { Strada: { esc: 1, thr: 0.78, acc: 0.72, top: 0.85, turn: 0.92, grip: 0.98, loose: -0.1, vol: 0.85, pops: 0.15 },
    Sport: { esc: 0.65, thr: 0.95, acc: 0.92, top: 0.95, turn: 1.04, grip: 1, loose: 0, vol: 1, pops: 0.7 },
    Corsa: { esc: 0.3, thr: 1, acc: 1.2, top: 1.05, turn: 1.18, grip: 1.05, loose: 0.14, vol: 1.3, pops: 1.4, tcs: false } },
  sports: { Normal: { esc: 1, thr: 0.8, acc: 0.76, top: 0.88, turn: 0.94, grip: 0.98, loose: -0.08, vol: 0.85, pops: 0.2 },
    Sport: { esc: 0.65, thr: 0.95, acc: 1, top: 1, turn: 1.06, grip: 1.02, loose: 0.04, vol: 1.1, pops: 0.8 },
    'Sport+': { esc: 0.4, thr: 1, acc: 1.14, top: 1.03, turn: 1.12, grip: 1.04, loose: 0.12, vol: 1.25, pops: 1.2, tcs: false },
    Wet: { esc: 1, thr: 0.55, acc: 0.55, top: 0.8, turn: 0.86, grip: 0.92, loose: -0.12, vol: 0.8, pops: 0 } },
  lux: { Comfort: { esc: 1, thr: 0.68, acc: 0.72, top: 0.9, turn: 0.86, grip: 0.97, loose: -0.1, vol: 0.6 },
    Eco: { esc: 1, thr: 0.55, acc: 0.6, top: 0.82, turn: 0.84, grip: 0.96, loose: -0.1, vol: 0.5 },
    Sport: { esc: 0.8, thr: 0.9, acc: 0.95, top: 0.98, turn: 1, grip: 1, loose: 0, vol: 0.95 },
    'Sport+': { esc: 0.65, thr: 1, acc: 1.14, top: 1.03, turn: 1.08, grip: 1.03, loose: 0.08, vol: 1.15 } },
  superbike: { Road: { thr: 0.82, acc: 0.72, top: 0.86, turn: 1, grip: 1, vol: 0.9, pops: 0.3 }, Sport: { thr: 1, acc: 1.12, top: 1.03, turn: 1.06, grip: 1.04, vol: 1.2, pops: 1.2, tcs: false },
    Rain: { thr: 0.5, acc: 0.48, top: 0.68, turn: 0.92, grip: 0.9, vol: 0.75, pops: 0 } },
  fortuner: { Normal: { thr: 0.85, acc: 0.88, top: 0.94, turn: 1, grip: 1, vol: 0.95 }, Eco: { thr: 0.6, acc: 0.66, top: 0.85, turn: 0.98, grip: 1, vol: 0.8 }, Power: { thr: 1, acc: 1.1, top: 1.02, turn: 1.02, grip: 1, vol: 1.15 } },
  innova: { Normal: { thr: 0.85, acc: 0.88, top: 0.94, turn: 1, grip: 1, vol: 0.95 }, Eco: { thr: 0.6, acc: 0.66, top: 0.85, turn: 0.98, grip: 1, vol: 0.8 }, Power: { thr: 1, acc: 1.1, top: 1.02, turn: 1, grip: 1, vol: 1.1 } },
  nexon: { City: { thr: 0.85, acc: 0.88, top: 0.94, turn: 1, grip: 1, vol: 0.95 }, Eco: { thr: 0.6, acc: 0.65, top: 0.84, turn: 0.98, grip: 1, vol: 0.8 }, Sport: { thr: 1, acc: 1.12, top: 1.03, turn: 1.04, grip: 1.01, vol: 1.15 } },
  suv: { Normal: { thr: 0.85, acc: 0.88, top: 0.94, turn: 1, grip: 1, vol: 0.95 }, Eco: { thr: 0.6, acc: 0.65, top: 0.84, turn: 0.98, grip: 1, vol: 0.8 }, Sport: { thr: 1, acc: 1.1, top: 1.02, turn: 1.04, grip: 1.01, vol: 1.12 } },
  jeep: { '2H': { thr: 0.95, acc: 1, top: 1, turn: 1, grip: 0.97, loose: 0.08, vol: 1 }, '4H': { thr: 0.95, acc: 0.96, top: 0.96, turn: 0.96, grip: 1.05, loose: -0.06, vol: 1 }, '4L': { thr: 0.75, acc: 0.8, top: 0.36, turn: 0.86, grip: 1.14, loose: -0.1, vol: 1.15 } },
  city: { Normal: { thr: 0.95, acc: 1, top: 1, turn: 1, grip: 1, vol: 1 }, ECON: { thr: 0.65, acc: 0.72, top: 0.88, turn: 1, grip: 1, vol: 0.85 } },
  scorpio: { Zip: { thr: 0.62, acc: 0.65, top: 0.8, turn: 0.94, grip: 0.98, vol: 0.8 }, Zap: { thr: 0.88, acc: 0.88, top: 0.92, turn: 1, grip: 1, vol: 0.95 },
    Zoom: { thr: 1, acc: 1.14, top: 1.03, turn: 1.06, grip: 1.02, vol: 1.15 } },
  xuv: { Zip: { thr: 0.62, acc: 0.65, top: 0.8, turn: 0.94, grip: 0.98, vol: 0.8 }, Zap: { thr: 0.88, acc: 0.88, top: 0.92, turn: 1, grip: 1, vol: 0.95 },
    Zoom: { thr: 1, acc: 1.14, top: 1.03, turn: 1.06, grip: 1.02, vol: 1.15 } },
};

export const has = (type) => { const b = baseOf(type); return { abs: ABS.has(type) || ABS.has(b), tcs: TCS.has(type) || TCS.has(b), modes: MODES[type] || MODES[b] || null }; };

const V = Vehicle.prototype, upd = V.update;
V.update = function (dt, inp, traffic) {
  const S = this.spec, sp = Math.abs(this.v), brk = inp.brake || 0, thr = inp.throttle || 0, H = this._has || (this._has = has(this.type));
  if (!S._brk) { S._brk = 1; const b = BRAKE[this.type] ?? BRAKE[baseOf(this.type)]; if (b) S.brake = b; }
  const hard = brk > 0.8 && !this.reverse && this.v > 3;
  this._lockT = hard && !H.abs ? (this._lockT || 0) + dt : 0;
  const locked = this._lockT > 0.2 && sp > 2.5;
  this.absOn = H.abs && hard && sp > 5;
  const mode = H.modes && H.modes[this.driveMode || 0]; this._modeName = mode || '';
  const fx = mode && (FX[this.type] || FX[baseOf(this.type)] || {})[mode], tk = (fx && fx.thr) || 1;
  this.tcsOn = H.tcs && !(fx && fx.tcs === false) && thr > 0.8 && sp < 15 && S.acc > 4 && !this.reverse;
  this.hbOn = !!inp.handbrake;
  this.modeEsc = fx ? fx.esc ?? 1 : 0.8; this.modePops = fx ? fx.pops ?? 0 : 1; this.modeLoose = fx ? fx.loose || 0 : 0; this.turnMul = fx ? fx.turn || 1 : 1;
  if (this.W.playerVeh === this) { const A = window.__nhAskG?.audio; if (A) A.modeVol = fx ? fx.vol || 1 : 1; }
  let I = inp;
  if (locked || tk !== 1) { I = { ...inp, throttle: thr*tk }; if (locked) I.steer = (inp.steer || 0)*(S.two ? 0.5 : 0.2); }
  // (a locked tyre grips less than one still rolling)
  const bm = this.brakeMul, gm = this.gripMul; if (locked) this.brakeMul = (bm || 1)*0.82;
  if (this.flatN) this.gripMul = (gm || 1)*(1 - 0.2*Math.min(2, this.flatN));          // (on a flat, the back lets go far sooner)
  const am = this.accMul, pm = this.powerMul;
  if (fx) { this.gripMul = (this.gripMul || 1)*(fx.grip || 1); this.accMul = (am || 1)*(fx.acc || 1); this.powerMul = (pm ?? 1)*(fx.top || 1); }
  const r = upd.call(this, dt, I, traffic);
  this.brakeMul = bm; this.gripMul = gm; this.accMul = am; this.powerMul = pm;
  // what the road and your ears get: a lock, a hard ABS stop from speed, a slide
  const dr = this.drift || 0, lvl = Math.max(locked ? 1 : 0, this.absOn && sp > 22 ? 0.4 : 0, dr > 0.2 ? dr : 0, this.hbOn && sp > 8 ? 0.7 : 0)*clamp((sp - 2)/4, 0, 1);
  this.skidL = lvl;
  if (this.W.playerVeh === this) { skidAt(this, lvl, dt); window.__nhAskG?.audio?.squeal?.(lvl, sp, dr, this); }
  return r;
};
