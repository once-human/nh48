// you in a car, in /beta's bodies: nothing of you below the floor (skin.js clips at H._clipY, so your feet don't show
// under the car), and in the low two-seaters you sit lower and lie back, as you have to in one, so your head stays
// under the roof
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { carSpec, baseOf } from '../vehicles/models.js';

const CARS = new Set(['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super']), V = new THREE.Vector3();
const pr = Pilot.prototype.placeRider;
Pilot.prototype.placeRider = function () {
  pr.call(this);
  const v = this.riderShown, H = this.human;
  if (!H) return;
  if (!v || v === this.auto || !CARS.has(baseOf(v.type))) { H._clipY = undefined; return; }
  const S = carSpec(v.type);
  if (S.H < 1.4) {
    const k = (1.4 - S.H) / 0.25;                       // the Huracán-style lies back further than the 911-style
    H.holder.translateY(-0.16 * Math.min(1, k)); H.holder.rotateZ(0.22 + 0.12 * Math.min(1, k));
    H.holder.updateMatrixWorld(true);
  }
  H._clipY = V.set(0, S.sill + 0.05, 0).applyMatrix4(v.tilt.matrixWorld).y;
};
const hr = Pilot.prototype.hideRider;
Pilot.prototype.hideRider = function () { hr.call(this); if (this.human) this.human._clipY = undefined; };
const uf = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (...a) { if (this.human && !this.riderShown) this.human._clipY = undefined; return uf.apply(this, a); };
