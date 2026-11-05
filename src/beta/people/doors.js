// In and out of a shop through its door. Someone popping into a shop used to vanish on the step outside it, and came
// back out of nowhere on the same step half a minute later. Now they walk in over the threshold, into the shop, and
// only then are they inside (out of sight, with no body); coming out, they step out of the shop's dark onto the
// footpath and carry on. (The door is a point a little out from the shop front; d.nx, d.nz face the street.)
import { People } from '@orig/people/peds.js';

const IN = 0.95, OUT = 0.35, SP = 1.15;
People.prototype.thruDoor = function (p, d, entering) {
  const x0 = entering ? p.x : d.x - d.nx*IN, z0 = entering ? p.z : d.z - d.nz*IN;
  const x1 = entering ? d.x - d.nx*IN : d.x + d.nx*OUT, z1 = entering ? d.z - d.nz*IN : d.z + d.nz*OUT;
  const L = Math.hypot(x1 - x0, z1 - z0), yaw = entering ? Math.atan2(-d.nz, -d.nx) : Math.atan2(d.nz, d.nx);
  p._thru = { x0, z0, x1, z1, t: 0, T: Math.max(0.3, L/SP), entering, d };
  p.hidden = false; p.x = x0; p.z = z0; p.v = SP; p.yaw = yaw; p.hx = Math.cos(yaw); p.hz = Math.sin(yaw);
};
const step = People.prototype.step;
People.prototype.step = function (p, dt, ...a) {
  const S = p._thru;
  if (!S) return step.call(this, p, dt, ...a);
  // knocked down, grabbed, in a fight on the way: off the doorstep and back to whatever's happening
  if (p.fallen > 0 || p.ko || p.dead || p.lift || p.mode === 'fight' || p.ctl) { p._thru = null; if (p.mode === 'inside') { if (S.entering && S.d) S.d.n--; p.door = null; p.mode = 'walk'; this.backToPath(p); } return step.call(this, p, dt, ...a); }
  S.t += dt;
  const k = Math.min(1, S.t/S.T);
  p.x = S.x0 + (S.x1 - S.x0)*k; p.z = S.z0 + (S.z1 - S.z0)*k; p.v = SP;
  if (k < 1) return;
  p._thru = null;
  if (S.entering) { p.hidden = true; p.v = 0; }
  else { p.v = 0; this.backToPath(p); }
};
