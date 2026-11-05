// Whatever state it's in, a vehicle you're driving can always be got moving, slowly. On its rims, nose against a kerb,
// on broken ground, four flats on a bus: the drag of the rims (beta/vehicles/damage.js) or a kerb's lip could add up
// to more than reverse gear gives (1.8 m/s² for a car, 0.7 for a two-wheeler walked back), and it sat there with the
// engine going and wouldn't budge either way. Now as long as you're asking it to go (throttle forward, or holding the
// brake in reverse), it creeps at least at a walking crawl that way: 0.9 m/s forward, 0.7 back (0.5 back on two
// wheels), more slowly the worse off it is. Anything solid still stops it (that's collision, not this).
import { Vehicle } from '@orig/vehicles/vehicle.js';

const upd = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) {
  const r = upd.call(this, dt, inp, traffic);
  if (!(dt > 0) || !inp || this.dead || this.powerMul === 0) return r;
  const S = this.spec || {}, thr = inp.throttle || 0, brk = inp.brake || 0;
  const want = !this.reverse && thr > 0.1 ? 1 : this.reverse && brk > 0.1 ? -1 : 0;
  if (!want || inp.handbrake) return r;
  // the worse off, the slower the crawl: each flat takes a little off it
  const bad = 1 - Math.min(0.45, (this.flatN || 0)*0.1);
  const min = (want > 0 ? 0.9 : S.two ? 0.5 : 0.7)*bad*(want > 0 ? Math.min(1, thr*1.5) : Math.min(1, brk*1.5));
  // (eased up to it, a car finding its feet, not a jump)
  if (want*this.v < min) this.v += (want*min - this.v)*Math.min(1, dt*3);
  return r;
};
