// How a car goes round a corner, for /beta: tyres, not a turn rate. The game turned a car at the rate its wheels
// pointed (the bicycle model), shaved that when the turn asked for more grip than there was, and faked a drift by
// adding yaw and sideways speed on a timer once the handbrake was pulled: it pivoted, slid sideways at a fixed share
// of its speed, and snapped straight again. Now each axle's tyres push on the car by how far they're slipping sideways
// (a curve that rises to a peak a few degrees in and eases off past it, the way rubber does), the load on them moves
// with braking and acceleration (brake into a corner and the front bites, lift and the back goes light), a driven
// axle that's spinning its tyres has less left for cornering (the friction circle), and the handbrake locks the back
// wheels so they slide wherever the car's going. A drift is what's left: the back steps out, opposite lock and the
// throttle hold it, and it comes back when you let it. Each car has its own weight, balance, drive and centre of
// gravity, so a rear-engined coupé, a front-drive hatch, a 4x4 and a bus all handle like themselves.
// (Two-wheelers lean to turn instead: beta/vehicles/twowheel.js. Longitudinal: engine, brakes, gears, drag are the game's.)
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { clamp, lerp } from '@orig/core/util.js';
import { baseOf } from './models.js';

// front share of the weight, which wheels drive, the centre of gravity's height (m)
const CHASSIS = {
  hatch: [0.61, 'F', 0.52], sedan: [0.6, 'F', 0.52], taxi: [0.6, 'F', 0.54], suv: [0.58, 'F', 0.68],
  lux: [0.52, 'R', 0.5], jeep: [0.55, 'A', 0.78], sports: [0.39, 'R', 0.45], super: [0.43, 'A', 0.42],
  auto: [0.36, 'R', 0.62], tempo: [0.46, 'R', 0.8], bus: [0.34, 'R', 1.25],
};
// how readily the back lets go: [the rear tyres' grip against the front's, how soon they slide and how long they keep
// sliding]. An ordinary car is set up to push on, not slide (more grip at the back, a handbrake turn that dies out
// fast); a sports car's back is lighter and its tyres let go progressively, so it drifts and holds one
// (cut hard, more than once: every car was sliding at 100 km/h on nothing but the steering. Now only the handbrake on a sports
// car or a supercar lets the back go; on steering and throttle alone everything grips)
const DRIFT = { sports: [1.35, 0.72], super: [1.4, 0.68] }, ORDINARY = [1.85, 0.42];
// how much sideways pull full lock asks for at speed (m/s²): the lock is what gives this and no more, a little under the
// tyres' peak, so the car turns hard and stays clean instead of ploughing on (too much lock) or barely turning (too little).
// Supercars sharpest, heavy things slowest
const TURN = { super: 13, sports: 12.5, lux: 10.5, hatch: 9, sedan: 9, taxi: 8.5, suv: 8.2, jeep: 7.6, auto: 6, tempo: 5.8, bus: 3.8 };
// a low car's body pushes it onto the road at speed (share of grip added at 70 m/s)
const AERO = { super: 0.4, sports: 0.3, lux: 0.08 };
// An auto rickshaw doesn't slide: one wheel in front and a high seat, so it runs out of footprint before it runs out
// of grip: the inside wheel comes up first (on two wheels), and pushed further it goes over (beta/vehicles/auto3w.js)
const THREE_WHEEL = new Set(['auto']);
const G = 9.81;
// rubber: lateral force (share of the most it can give) at slip angle al. Peak near 8 degrees, about 0.8 of it
// sliding; C lower is a flatter, more forgiving curve past the peak (drift tyres)
const MF = (al, B, C) => Math.sin(C*Math.atan(B*al));

Vehicle.prototype.tyres = function (dt, inp, thr) {
  const S = this.spec, base = baseOf(this.type);
  const ch = CHASSIS[base] || CHASSIS[this.type] || [0.58, 'F', 0.55];
  const m = S.mass + (this.load || 0)*70, wb = S.wb, a = wb*(1 - ch[0]), b = wb - a, h = ch[2], drive = ch[1];
  // (a: CG to the front axle, b: to the rear; the heavier end is nearer the CG)
  const Iz = m*(S.L*S.L + S.W*S.W)/12*0.95;
  const W = this.W, wet = (W.wet || 0)*(this.rainTyre ? 0.3 : 1);
  const tw = THREE_WHEEL.has(base);
  const aero = 1 + (AERO[base] || 0)*Math.min(1.3, (this.v/70)**2);
  const mu = S.mu/G*(this.gripMul || 1)*(1 - wet*0.28)*(this.onFootpath && !this.offroad ? 0.82 : 1)*(tw ? 1.4 : 1)*aero;
  const sporty = !!(DRIFT[base] || DRIFT[this.type]), dr = DRIFT[base] || DRIFT[this.type] || ORDINARY, muR = mu*dr[0];
  const ease = (this.driftEase || 1)*dr[1]*(1 + wet*0.5);
  // (a little softer than racing rubber: the grip builds over a few more degrees, so it's easier to feel)
  const Bf = 10, Cf = 1.5, Br = 10/Math.sqrt(ease), Cr = 1.5 - 0.15*clamp(ease - 1, 0, 1);
  // the handbrake: a sports car's locks the back and it slides; an ordinary car's grabs the back wheels, tightens the
  // turn and scrubs speed, but it doesn't swing round; an auto's just brakes
  const hb = !!inp.handbrake && sporty && Math.abs(this.v) > 6, hbSoft = !!inp.handbrake && !hb;
  if (hbSoft && Math.abs(this.v) > 0.3) this.v -= Math.sign(this.v)*Math.min(Math.abs(this.v), 4.5*dt);
  // ---- steering: the wheel turns at a hand's pace, less lock the faster you go; while the back's out the wheels
  // are helped round toward where the car's going (what your hands do: catch it), more the less you're asking for
  const u0 = this.v, sp = Math.hypot(u0, this.vl || 0);
  const u2 = Math.max(16, u0*u0), maxSteer = Math.min(S.steerMax, Math.atan(wb*(TURN[base] || 8.5)*(1 - wet*0.3)*aero/u2) + 0.062);
  const beta = Math.abs(u0) > 2 ? Math.atan2(this.vl || 0, Math.abs(u0)) : 0;
  const assist = hb ? 0.3 : 0.7 - 0.3*Math.abs(inp.steer || 0);
  const target = clamp(clamp(inp.steer || 0, -1, 1)*maxSteer + beta*assist*Math.sign(u0 || 1), -S.steerMax, S.steerMax);
  // (a keypress is all or nothing, so the wheel takes a fifth of a second to full lock at any speed; quick hands catching a slide)
  const rate = Math.max(Math.abs(beta) > 0.1 ? 6 : Math.abs(target) < Math.abs(this.steer) ? 5 : 3.8, 0)*Math.min(1, Math.max(0.3, maxSteer/S.steerMax*1.25));
  this.steer += clamp(target - this.steer, -rate*dt, rate*dt);
  const d = this.steer, cd = Math.cos(d), sd = Math.sin(d);
  // ---- the forces, in small steps (the tyres are stiff)
  const ax = this._axL ?? 0;                                      // last step's fore-aft acceleration: the weight moves with it
  const n = Math.max(1, Math.ceil(dt*300)), hs = dt/n;
  let u = this.v, s = this.vl || 0, w = this.w || 0, slipR = 0, slideR = 0;
  const hbSlip = hbSoft ? 1 : 0;
  // the driven axle's push (the game already added it to the speed; here it only uses up the tyres' grip)
  const push = Math.max(0, thr)*S.acc*(this.accMul || 1)*Math.max(0, 1 - Math.pow(Math.max(0, u)/(S.vTop*(this.powerMul ?? 1)), 3))*m;
  const pF = drive === 'F' ? push : drive === 'A' ? push*0.45 : 0, pR = push - pF;
  for (let i = 0; i < n; i++) {
    const tr = clamp(m*ax*h/wb, -m*G*0.45, m*G*0.45);
    const Fzf = Math.max(0.1*m*G, m*G*b/wb - tr), Fzr = Math.max(0.1*m*G, m*G*a/wb + tr);
    // front: the slip of the steered wheels
    const vfx = u, vfy = s + a*w, lonF = vfx*cd + vfy*sd, latF = -vfx*sd + vfy*cd;
    const alF = Math.atan2(latF, Math.max(0.5, Math.abs(lonF)));
    // (a driven axle can't push harder than its tyres hold, and spinning them still leaves some grip to the side:
    // the back steps out under power and stays catchable)
    const qF = Math.min(pF, 0.9*mu*Fzf), capF = Math.sqrt(Math.max((0.45*mu*Fzf)**2, (mu*Fzf)**2 - qF*qF));
    const Fyf = -capF*MF(alF, Bf, Cf);
    // rear: rolling, or locked by the handbrake (then it slides, all of its grip against the way it's moving)
    const vry = s - b*w;
    let Fxr = 0, Fyr;
    if (hb && Math.abs(u) > 1.5) {
      // (an ordinary car's locked back scrubs off its slide sooner: less of a pirouette)
      const vr = Math.hypot(u, vry) || 1, k = muR*(dr[0] > 1 ? 0.8 : 0.7)*Fzr;
      Fxr = -k*u/vr; Fyr = -k*vry/vr; slideR = 1;
    } else {
      const alR = Math.atan2(vry, Math.max(0.5, Math.abs(u)));
      const qR = Math.min(pR, 0.9*muR*Fzr), capR = Math.sqrt(Math.max((0.45*muR*Fzr)**2, (muR*Fzr)**2 - qR*qR))*(hbSoft && !tw ? 0.92 : 1);
      Fyr = -capR*MF(alR, Br, Cr);
      slipR = Math.max(slipR, Math.abs(alR));
    }
    // the body: x forward, y to the right, w turning right
    let dw = (a*Fyf*cd - b*Fyr)/Iz;
    // past about 35 degrees sideways the slide is held there rather than going round (a game's drift, not a spin;
    // keep the handbrake on and it goes round)
    const bt = Math.abs(u) > 3 ? Math.atan2(s, Math.abs(u)) : 0, over = Math.abs(bt) - 0.6;
    if (over > 0 && !hb) dw += Math.sign(bt)*Math.sign(u)*over*20;
    // and a slide comes back smoothly, not with a whip the other way: the turning eased toward what the wheels ask,
    // the more the further out the back is (a driver's feet and hands, not a stability system: it never stops a slide)
    const sl = clamp((Math.abs(bt) - 0.03)/0.12, 0, 1);
    if (sl > 0 && !hb) dw -= (w - u*Math.tan(d)/wb)*(hbSlip > 0 ? 3 : 9)*sl;
    // no snap: turning never runs past what the tyres can actually hold at this speed (a driver feeling it)
    if (!hb && Math.abs(u) > 6) { const wMax = mu*G*1.12/Math.abs(u); if (Math.abs(w) > wMax) dw -= (w - Math.sign(w)*wMax)*14; }
    const du = (-Fyf*sd + Fxr)/m + s*w, ds = (Fyf*cd + Fyr)/m - u*w;
    u += du*hs; s += ds*hs; w += dw*hs;
    // slow, the tyres just roll where they point (no slip worth the name; and no jitter about zero), and the car turns
    // about its back axle the way a car does: the back wheels roll straight and the nose swings. (It turned about its
    // middle: wheels on full lock, the back swung out sideways, and against a wall or a kerb post that sideways swing
    // was blocked, which stopped it going forward or back at all while the wheels were turned)
    const k = clamp((Math.abs(u) - 1.2)/2.8, 0, 1);
    if (k < 1) { const wk = u*Math.tan(d)/wb; w = lerp(wk, w, k); s = lerp(b*w, s, k); }
  }
  this.v = u; this.vl = s; this.w = clamp(w, -4, 4);
  this.th = Math.atan2(Math.sin(this.th + this.w*dt), Math.cos(this.th + this.w*dt));
  this._axL = clamp((u - (this._uL ?? u))/Math.max(1e-3, dt), -12, 12); this._uL = u;
  // how far out the back is (sounds, smoke, the HUD): the rear slip past the tyres' peak, or a locked slide
  const D = clamp(Math.max(slideR, (slipR - 0.12)/0.35), 0, 1)*clamp((sp - 4)/4, 0, 1);
  this.drift = D;
  // (the screech and the smoke: a real slide, not every corner taken briskly)
  if (D > (sporty ? 0.05 : 0.25) && Math.abs(s) > (sporty ? 1.5 : 2.5)) this.events.push({ type: 'drift', amount: Math.abs(s), sp });
  this.latAcc = u*this.w;
};
