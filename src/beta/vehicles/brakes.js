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
const TCS = new Set(['super', 'sports', 'lux', 'xuv', 'fortuner']);
const MODES = { super: ['Strada', 'Sport', 'Corsa'], sports: ['Normal', 'Sport'], lux: ['Comfort', 'Sport'], xuv: ['Zip', 'Zap', 'Zoom'] };
const THROTTLE = { Comfort: 0.82, Normal: 0.9, Strada: 0.85, Zip: 0.8, Zap: 0.92 };

export const has = (type) => { const b = baseOf(type); return { abs: ABS.has(type) || ABS.has(b), tcs: TCS.has(type) || TCS.has(b), modes: MODES[type] || MODES[b] || null }; };

const V = Vehicle.prototype, upd = V.update;
V.update = function (dt, inp, traffic) {
  const S = this.spec, sp = Math.abs(this.v), brk = inp.brake || 0, thr = inp.throttle || 0, H = this._has || (this._has = has(this.type));
  if (!S._brk) { S._brk = 1; const b = BRAKE[this.type] ?? BRAKE[baseOf(this.type)]; if (b) S.brake = b; }
  const hard = brk > 0.8 && !this.reverse && this.v > 3;
  this._lockT = hard && !H.abs ? (this._lockT || 0) + dt : 0;
  const locked = this._lockT > 0.2 && sp > 2.5;
  this.absOn = H.abs && hard && sp > 5;
  this.tcsOn = H.tcs && thr > 0.8 && sp < 15 && S.acc > 4 && !this.reverse;
  this.hbOn = !!inp.handbrake;
  const mode = H.modes && H.modes[this.driveMode || 0], tk = (mode && THROTTLE[mode]) || 1;
  let I = inp;
  if (locked || tk !== 1) { I = { ...inp, throttle: thr*tk }; if (locked) I.steer = (inp.steer || 0)*(S.two ? 0.5 : 0.2); }
  // (a locked tyre grips less than one still rolling)
  const bm = this.brakeMul; if (locked) this.brakeMul = (bm || 1)*0.82;
  const r = upd.call(this, dt, I, traffic);
  this.brakeMul = bm;
  // what the road and your ears get: a lock, a hard ABS stop from speed, a slide
  const dr = this.drift || 0, lvl = Math.max(locked ? 1 : 0, this.absOn && sp > 22 ? 0.4 : 0, dr > 0.2 ? dr : 0, this.hbOn && sp > 8 ? 0.7 : 0)*clamp((sp - 2)/4, 0, 1);
  this.skidL = lvl;
  if (this.W.playerVeh === this) { skidAt(this, lvl, dt); window.__nhAskG?.audio?.squeal?.(lvl, sp, dr); }
  return r;
};
