// An auto rickshaw you've taken off the street corners like one: up on two wheels when you throw it into a turn (the
// inside back wheel lifts, the body rolls out), down again as you ease off, and pushed past that for half a second it
// goes over on its side, slides to a stop and is stood up again. The same numbers as your own auto (vehicles/player.js);
// a traffic auto used the car's tyres (beta/vehicles/tyres.js) and slid round instead, which no auto does.
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { clamp } from '@orig/core/util.js';
import { baseOf } from './models.js';

// (a real auto takes a hard, fast corner to get a wheel up, and a lot more held for a good while to go over)
const LIFT = 7.2, TIP = 10.5;
const isAuto = (v) => baseOf(v.type) === 'auto';

const upd = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) {
  if (!isAuto(this)) return upd.call(this, dt, inp, traffic);
  const T = this._tip3;
  if (T) {
    // on its side: slides to a stop, then it's stood back up
    this.events.length = 0;
    T.t -= dt;
    this.v *= Math.exp(-dt*2.5); this.vl = (this.vl || 0)*Math.exp(-dt*3); this.w = 0;
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    this.x += (hx*this.v - hz*this.vl)*dt; this.z += (hz*this.v + hx*this.vl)*dt;
    this.collideStatic();
    const tgt = T.t > 0.7 ? 1.32 : 0;
    T.ang += (tgt - T.ang)*Math.min(1, dt*(T.t > 0.7 ? 6 : 4));
    if (T.t <= 0) { this._tip3 = null; this.v = 0; this.lift = 0; this._liftT = 0; this.events.push({ type: 'recovered' }); }
    this.sync(dt);
    return;
  }
  const out = upd.call(this, dt, inp, traffic);
  const la = Math.abs(this.latAcc || 0), tgt = la > LIFT ? clamp((la - LIFT)*0.08, 0, 0.3) : 0;
  this.lift = (this.lift || 0) + (tgt - (this.lift || 0))*Math.min(1, dt*(tgt > (this.lift || 0) ? 7 : 4));
  this._liftSide = Math.sign(this.latAcc || 0) || this._liftSide || 1;
  if (la > TIP) { this._liftT = (this._liftT || 0) + dt; if (this._liftT > 0.9) { this._tip3 = { t: 3.2, side: this._liftSide, ang: 0 }; this.events.push({ type: 'tip', speed: Math.abs(this.v) }); } }
  else this._liftT = Math.max(0, (this._liftT || 0) - dt*2);
  if (tgt > 0.05 && !this._liftWarned) { this.events.push({ type: 'lift' }); this._liftWarned = true; }
  if (tgt === 0) this._liftWarned = false;
  return out;
};
const sync = Vehicle.prototype.sync;
Vehicle.prototype.sync = function (dt = 0) {
  const r = sync.call(this, dt);
  if (this.tilt && isAuto(this) && (this.lift > 1e-3 || this._tip3)) {
    // rolls out of the turn about the outside wheels; on its side, onto the outside
    const tip = this._tip3 ? -this._tip3.ang*this._tip3.side : 0, side = this._tip3 ? this._tip3.side : this._liftSide || 1;
    this.tilt.rotation.x += -(this.lift || 0)*side + tip;
    this.tilt.position.y += (this.lift || 0)*0.5 + Math.abs(tip)*0.45;
  }
  return r;
};
