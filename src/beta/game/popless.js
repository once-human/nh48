// Out of a vehicle with no scene for it (a fire, hauled out in a fight, the police taking it, a power): you used to be
// in the seat one frame and standing by the door the next. Now the body comes from where it sat to where you stand
// over a little under half a second, eased, and the seated pose melts into standing. (The scenes that do have their
// own animation, beta/vehicles/cardoor.js and getout.js, aren't touched.)
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';

const T = 0.45, sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const exit = Pilot.prototype.exit;
Pilot.prototype.exit = function (traffic, force = false) {
  const H = this.human, was = this.onFoot, shown = H && H.holder.visible && this.riderShown;
  const from = shown ? H.holder.position.clone() : null;
  const out = exit.call(this, traffic, force);
  if (force && from && !was && this.onFoot) {
    const F = this.foot;
    this._unpop = { d: new THREE.Vector3(from.x - F.x, from.y - F.y, from.z - F.z), t: 0 };
    H.play('idle', { fade: 0.35 });
  }
  return out;
};
const upd = Pilot.prototype.update;
Pilot.prototype.update = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), U = this._unpop, H = this.human;
  if (!U) return out;
  U.t += dt;
  if (!H || !this.onFoot || U.t >= T || U.d.lengthSq() > 64) { this._unpop = null; return out; }
  const k = 1 - sm(U.t/T);
  H.holder.position.addScaledVector(U.d, k);
  return out;
};
