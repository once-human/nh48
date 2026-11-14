// Ctrl standing still: down on your haunches (Ctrl again, or moving off at a run, a jump, a vehicle, and you're up).
// Ctrl on the move is still the roll, the way you're going (people/fight.js, patched in tools/build-game.mjs).
// Crouched you can creep about, slowly, still low. No clip for it: built on whatever the clip is doing (the idle, or
// the walk while you creep): the hips come down, the legs fold to keep the feet where the clip put them (the knees
// forward and a little out), the back leans in and the neck comes up so you still look ahead, and standing still the
// hands go to rest on the knees.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { ikArm } from '@orig/people/humans.js';
import { ikLeg } from './fists.js';
import { UP, bone, smooth, turn, shiftPelvis, worldOf, axes, safe } from './dizzy.js';

const CREEP = 1.1;                          // m/s crouched (the game's default pace on foot is a 3.4 m/s jog)
const f = new THREE.Vector3(), r = new THREE.Vector3(), pole = new THREE.Vector3(), tg = new THREE.Vector3(), d = new THREE.Vector3();
const feet = { l: new THREE.Vector3(), r: new THREE.Vector3() }, knee = new THREE.Vector3();

Pilot.prototype.crouchKey = function () { this.crouched = !this.crouched; };
Pilot.prototype.crouchOff = function () { this.crouched = false; };
Pilot.prototype.crouchMul = function () { return this.crouched ? CREEP/3.4 : 1; };

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, input, ...rest) {
  const out = upd.call(this, dt, input, ...rest);
  const F = this.foot, H = this.human;
  if (!F || !H) return out;
  const run = input && input.key && input.key('ShiftLeft', 'ShiftRight') && F.v > 0.3;
  if (this.crouched && (!this.onFoot || this.seated || F.swim || F.air || F.climb || this.downT > 0 || this.ko || this._walk || run || (this.act && this.act.kind !== 'atk'))) this.crouched = false;
  if (this.crouched) { this._fid = null; this._idleT = 0; }          // (no arms folded or phone out down there)
  const want = this.crouched ? 1 : 0;
  this._cK = (this._cK || 0) + (want - (this._cK || 0))*Math.min(1, dt*(want ? 7 : 6));
  const k = smooth(this._cK);
  if (k < 0.005 || !this.onFoot || this.seated || F.swim) return out;
  pose(H, F, k);
  return out;
};

function pose(H, F, k) {
  H.root.updateMatrixWorld(true);
  axes(F.yaw, f, r);
  // where the clip has the feet, before anything moves
  const has = { l: !!worldOf(H, 'foot_l', feet.l), r: !!worldOf(H, 'foot_r', feet.r) };
  const mv = Math.min(1, F.v/CREEP), still = k*(1 - mv);
  // the hips down and a little back (less low creeping, to keep a stride)
  shiftPelvis(H, d.set(0, -(0.44 - 0.1*mv)*k, 0).addScaledVector(f, -0.07*k));
  // the back leans into it, the neck comes up again: eyes ahead
  turn(bone(H, 'spine_01'), r, -0.26*k); turn(bone(H, 'spine_02'), r, -0.16*k); turn(bone(H, 'spine_03'), r, -0.08*k);
  turn(bone(H, 'neck_01'), r, 0.26*k); turn(bone(H, 'Head'), r, 0.2*k);
  // the legs fold to the feet: knees forward and out, the feet a touch wider standing still
  for (const s of ['l', 'r']) {
    if (!has[s]) continue;
    const sd = s === 'r' ? 1 : -1;
    tg.copy(feet[s]).addScaledVector(r, sd*0.05*still);
    pole.copy(f).addScaledVector(UP, 0.1).addScaledVector(r, sd*0.3);
    safe(() => ikLeg(H, s, tg, pole, 1));
  }
  // standing still, the hands come to rest on the knees, elbows out
  if (still > 0.01) {
    H.root.updateMatrixWorld(true);
    for (const s of ['l', 'r']) {
      if (!worldOf(H, 'calf_' + s, knee)) continue;
      const sd = s === 'r' ? 1 : -1;
      tg.copy(knee).addScaledVector(UP, 0.07).addScaledVector(f, 0.05).addScaledVector(r, -sd*0.02);
      pole.copy(r).multiplyScalar(sd*0.9).addScaledVector(UP, -0.3).addScaledVector(f, -0.3);
      safe(() => ikArm(H, s, tg, pole, still*0.9));
    }
  }
}
