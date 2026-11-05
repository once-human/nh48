// What's in your hand, held the way a hand holds it. The torch sits in your grip, not floating off the wrist; the arm
// points it where you look only as far as an arm goes (about 60 degrees either side of your chest, a little up, more
// down); look further and your body turns with you. The beam comes out of the torch, the way the torch points, not
// out of the camera. (Which hand punches with the torch up: game/fists.js.)
import * as THREE from 'three';
import { Lights } from '@orig/game/lights.js';
import { ikArm } from '@orig/people/humans.js';
import { grip } from '../vehicles/fit.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const YAW = 1.0, UP = 0.6, DOWN = 0.95;
const _d = new THREE.Vector3(), _s = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3(), _h = new THREE.Vector3(), _l = new THREE.Vector3();

// where the arm can point, from where you look: within reach of your chest. Returns the turn your body still owes
export function reach(C, yaw, out) {
  C.getWorldDirection(_d);
  const ly = Math.atan2(_d.z, _d.x), lp = Math.asin(Math.max(-1, Math.min(1, _d.y)));
  const rel = wrap(ly - yaw), r = Math.max(-YAW, Math.min(YAW, rel)), p = Math.max(-DOWN, Math.min(UP, lp));
  out.set(Math.cos(yaw + r)*Math.cos(p), Math.sin(p), Math.sin(yaw + r)*Math.cos(p));
  return rel - r;
}

const torchMesh = Lights.prototype.torchMesh;
Lights.prototype.torchMesh = function (on) {
  torchMesh.call(this, on);
  const P = this.g.player;
  if (!P.torchArm || !this.tm) return;
  const C = this.g.camera, tm = this.tm, aim = this.aim || (this.aim = new THREE.Vector3());
  P.torchArm = (H2) => {
    const F = P.foot, sh = H2.root.getObjectByName('upperarm_r'), hand = H2.root.getObjectByName('hand_r'); if (!sh || !hand) return;
    const owe = reach(C, F.yaw, aim);
    // standing, the body comes round with the look once the arm can't go further
    if (Math.abs(owe) > 0.02 && F.v < 0.3) F.yaw += owe*0.25;
    sh.getWorldPosition(_s);
    // the hand out in front of the chest, a little in from the shoulder, the elbow down and out
    const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
    _t.copy(_s).addScaledVector(aim, 0.5); _t.x -= -fz*0.08; _t.z -= fx*0.08; _t.y -= 0.1;
    _p.set(-fz*0.6 + aim.x*0.1, -1, fx*0.6 + aim.z*0.1).normalize();
    ikArm(H2, 'r', _t, _p, 1);
    grip(H2, 'r', 0.85);
    // the torch in the grip: the palm is a hand's width past the wrist, along the forearm
    hand.getWorldPosition(_h); H2.root.getObjectByName('lowerarm_r').getWorldPosition(_l);
    const fa = _l.sub(_h).multiplyScalar(-1).normalize();
    _h.addScaledVector(fa, 0.075);
    const par = tm.parent; par.updateMatrixWorld(true);
    tm.position.copy(par.worldToLocal(_t.copy(_h)));
    tm.lookAt(_h.x + aim.x*5, _h.y + aim.y*5, _h.z + aim.z*5);
    tm.updateMatrixWorld(true);
  };
};
const update = Lights.prototype.update;
Lights.prototype.update = function (dt, night) {
  update.call(this, dt, night);
  const t = this.torch, P = this.g.player;
  if (!t || t.intensity <= 0 || !this.tm || !this.tm.parent || !this.aim || !P.onFoot) return;
  // out of the lens, along the torch
  this.tm.getWorldPosition(_h); _h.addScaledVector(this.aim, 0.15);
  t.position.copy(_h);
  t.target.position.set(_h.x + this.aim.x*10, _h.y + this.aim.y*10, _h.z + this.aim.z*10);
  t.target.updateMatrixWorld();
};
