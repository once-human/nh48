// game/solid.js for /beta: your head is as solid as the rest of you. The game stops your body (a circle at your feet)
// at a wall, but a run leans you forward and a sprint more, so the head went on into the wall and with it your own
// eyes: the inside of a building, from the inside. Here the head is stopped too: by how far it reaches towards the
// nearest wall, you're held back from it. The reach is taken at its fullest over the stride (it nods forward and back
// with every step), so you stand steady against the wall and don't tremble there.
import { Pilot } from '@orig/game/pilot.js';

const HEAD_R = 0.25, BODY_R = 0.3;
const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const x0 = this.foot ? this.foot.x : 0, z0 = this.foot ? this.foot.z : 0;
  const out = upd.call(this, dt, ...a);
  const F = this.foot, H = this.human, o = H && H._headOff, C = this.W && this.W.collision;
  if (!F || !o || !C || !this.onFoot || this.seated || F.climb || F.swim || this.downT > 0 || this.ko || (F.deck ?? -1) >= 0) { this._hr = 0; return out; }
  const off = Math.hypot(o.x, o.z);
  if (off > 1.2) return out;
  // the nearest wall, from where your feet are (which is the right side of it)
  const r = C.resolve(F.x, F.z, off + HEAD_R + 0.5);
  if (!r || !(r.kind === 0 || r.kind === 1 || r.kind === 5)) { this._hr = Math.max(0, (this._hr || 0) - dt*0.6); return out; }
  const d = off + HEAD_R + 0.5 - r.depth, reach = -(o.x*r.nx + o.z*r.nz);
  this._hr = Math.max(reach, (this._hr || 0) - dt*0.6);
  const push = this._hr + HEAD_R - d;
  if (push > 0 && this._hr > BODY_R - HEAD_R) {
    F.x += r.nx*push; F.z += r.nz*push;
    const vn = F.vx*r.nx + F.vz*r.nz; if (vn < 0) { F.vx -= r.nx*vn; F.vz -= r.nz*vn; F.v = Math.hypot(F.vx, F.vz); }
    // (run into it flat out and it's felt)
    const sp = dt > 0 ? -((F.x - x0)*r.nx + (F.z - z0)*r.nz)/dt : 0;
    if (vn < -4.2 && !this._hitWall && window.__nhAskG && window.__nhAskG.rig && window.__nhAskG.rig.impact) { window.__nhAskG.rig.impact(-vn*0.45, F.x - r.nx*d, F.z - r.nz*d); this._hitWall = 0.6; }
  }
  if (this._hitWall > 0) this._hitWall -= dt;
  return out;
};
