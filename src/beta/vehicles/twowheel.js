// How a two-wheeler goes round a corner, for /beta. The game turned it at the rate its bars pointed (like a car) and
// tilted the model by however hard it was turning, the same for a bicycle, an Activa and a litre superbike. A bike
// turns by leaning: you push on the bars, it falls into the lean, and the lean is what turns it (at a lean of L, at
// speed v, it goes round at g tan L / v). How far it can lean is its own: a scooter's floorboard and a Bullet's pegs
// touch down long before a superbike's knee slider does, and never past what the tyres can hold. How quickly it
// tips in is its own too: a heavy thumper is slow to roll over, a bicycle flicks; and every bike gets steadier, slower
// to lean, the faster it goes (the wheels are gyroscopes). Brake hard while leaned over and there's less grip left
// to turn with, so it runs wide. The back brake (handbrake) locks the rear and lets it step out. Below walking pace
// it steers on the bars, as you do pushing off. And a litre bike lifts its front wheel on full throttle in first.
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { clamp, lerp } from '@orig/core/util.js';

// the furthest it leans (rad), how fast it can roll (rad/s), how keen it is to tip in (1/s)
const BIKE = {
  cycle: [0.6, 4.2, 9], scooter: [0.6, 3.2, 7], bike: [0.72, 3.0, 6.5], bullet: [0.62, 2.1, 4.5], superbike: [0.96, 3.6, 7.5],
};
const G = 9.81;
const sstep = (a, b, x) => { const t = clamp((x - a)/(b - a), 0, 1); return t*t*(3 - 2*t); };

Vehicle.prototype.twoWheel = function (dt, inp, thr) {
  const S = this.spec, B = BIKE[this.type] || BIKE[S.alias] || BIKE.bike;
  const v = this.v, sp = Math.abs(v), s = clamp(inp.steer, -1, 1), hb = !!inp.handbrake;
  const W = this.W, wet = (W.wet || 0)*(this.rainTyre ? 0.3 : 1);
  const mu = S.mu*(this.gripMul || 1)*(1 - wet*0.3)*(this.onFootpath && !this.offroad ? 0.85 : 1);
  // grip used braking or driving leaves less for the corner (the friction circle)
  const ax = clamp(Math.abs(v - (this._pv ?? v))/Math.max(dt, 1e-3), 0, mu);
  this._pv = v;
  const latCap = mu*Math.sqrt(Math.max(0.12, 1 - (ax/mu)**2));
  const maxLean = Math.min(B[0], Math.atan(latCap/G));
  // ---- the lean: rolls toward what you ask, as fast as this bike rolls, steadier at speed
  const L0 = this.bikeL || 0;
  const want = s*maxLean*sstep(1.5, 6, sp);
  const rate = B[1]/(1 + sp/30);
  let dl = (want - L0)*B[2]*dt;
  dl = clamp(dl, -rate*dt, rate*dt);
  let L = clamp(L0 + dl, -B[0], B[0]);
  // ---- the turn: the lean's, at speed; the bars', at walking pace
  const lock = S.steerMax/(1 + sp*sp/40);
  const wBars = v*Math.tan(s*lock)/S.wb;
  const wLean = Math.sign(v || 1)*G*Math.tan(L)/Math.max(sp, 0.8);
  const k = sstep(2.5, 7, sp);
  let w = lerp(wBars, wLean, k);
  // more turn than the tyres can hold (braked into it, a wet road): it runs wide, and the lean comes up with it
  let slide = 0;
  const dem = sp*Math.abs(w);
  if (dem > latCap && sp > 1) { const q = latCap/dem; slide = 1 - q; w *= q; L = Math.sign(L)*Math.min(Math.abs(L), Math.atan(latCap/G)); }
  // the back brake locks the rear: a little steer and the tail swings out, more the faster it's going
  let vlT = slide*0.3*v*Math.sign(w);
  if (hb && sp > 3) { w += s*0.55*Math.min(1, sp/12); vlT += s*0.18*sp; }
  this.bikeL = L;
  this.w = w;
  this.th += w*dt;
  if (this.th > Math.PI) this.th -= 2*Math.PI; else if (this.th < -Math.PI) this.th += 2*Math.PI;
  this.vl += (vlT - this.vl)*Math.min(1, dt*(hb ? 2.5 : 5));
  if (Math.abs(this.vl) > 1.5) this.events.push({ type: 'drift', amount: Math.abs(this.vl), sp });
  this.drift = clamp(Math.abs(this.vl)/4, 0, 1);
  // the bars as they'd be turned for this (a few degrees at speed, full lock at a crawl)
  this.steer = clamp(Math.atan(w*S.wb/Math.max(Math.abs(v), 0.5))*Math.sign(v || 1), -S.steerMax, S.steerMax);
  // what you see: the lean at speed, the little tilt of steering by the bars below it
  this.bikeLean = lerp(Math.atan(v*wBars/G), L, k);
  // a litre bike's front comes up on full throttle in the low gears
  const wh = this.type === 'superbike' && thr > 0.9 && v > 1.5 && v < 17 && !hb ? 0.24*(1 - v/17) : 0;
  this.wheelie = (this.wheelie || 0) + (wh - (this.wheelie || 0))*Math.min(1, dt*(wh > (this.wheelie || 0) ? 2.2 : 5));
};
