// A foot down when a two-wheeler stops: coming to a halt the left foot comes off the peg or the floorboard and goes
// down to the road beside it, the machine leaning a little onto it; pulling away, it comes back up once you're
// rolling. (On a motorcycle the right foot stays on the rear brake.) You, and everyone riding close by in traffic
// at a signal or in a jam. (They used to sit there with both feet up on a machine standing upright by itself.)
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Crowd } from '@orig/people/crowd.js';
import { ikLeg } from '../game/fists.js';
import { ikArm } from '@orig/people/humans.js';
import { fitOf } from './fit.js';

const sm = (k) => k*k*(3 - 2*k);
const _f = new THREE.Vector3(), _t = new THREE.Vector3(), _pole = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const bone = (H, n) => (H._fdb || (H._fdb = {}))[n] || (H._fdb[n] = H.root.getObjectByName(n));
const OUT = 0.33;          // the foot this far out to the side of the machine's middle
// how far down the foot is (0 up, 1 on the road): down once you're all but stopped, up again once you're rolling
function step(S, speed, dt) {
  if (speed < 0.45) S.want = 1; else if (speed > 1.3) S.want = 0;
  S.k += Math.sign(S.want - S.k)*Math.min(Math.abs(S.want - S.k), dt/0.38);
  return sm(S.k);
}
// the left leg from where the clip and the pegs put it to the road at (gx, gy, gz); fx, fz the way the machine faces.
// A leg doesn't reach the road from the middle of a seat that high, so you do what riders do: slide over a little
// onto that side, and stand on the ball of the foot (toes on the road, heel up). The hands stay on the grips and
// the other foot on its peg.
const _h = [new THREE.Vector3(), new THREE.Vector3()], _hq = [new THREE.Quaternion(), new THREE.Quaternion()];
const _rf = new THREE.Vector3(), _rq = new THREE.Quaternion(), _ax = new THREE.Vector3();
// The clip doesn't set every one of these bones every frame: whatever was put on them last frame is undone first, or
// it would build on itself (the leg lifted a little more each frame till it stuck out sideways, the foot spun)
const MINE = ['thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'];
function undo(H) {
  for (const n of MINE) {
    const b = bone(H, n); if (!b) continue;
    const u = b.userData;
    if (u.fdSet && b.quaternion.equals(u.fdSet)) b.quaternion.copy(u.fdBase);
    (u.fdBase || (u.fdBase = new THREE.Quaternion())).copy(b.quaternion);
  }
}
function mark(H) {
  for (const n of MINE) { const b = bone(H, n); if (b) (b.userData.fdSet || (b.userData.fdSet = new THREE.Quaternion())).copy(b.quaternion); }
}
function plant(H, w, gx, gy, gz, fx, fz) {
  const fb = bone(H, 'foot_l'), rb = bone(H, 'foot_r'); if (!fb || !rb) return;
  undo(H);
  if (w <= 0.001) return;
  const hs = [bone(H, 'hand_l'), bone(H, 'hand_r')];
  H.root.updateMatrixWorld(true);
  fb.getWorldPosition(_f); fb.getWorldQuaternion(_q);
  rb.getWorldPosition(_rf); rb.getWorldQuaternion(_rq);
  for (let i = 0; i < 2; i++) if (hs[i]) { hs[i].getWorldPosition(_h[i]); hs[i].getWorldQuaternion(_hq[i]); }
  // over onto the left buttock (left of the way it faces is (fz, -fx)), a touch lower
  H.holder.position.x += fz*0.055*w; H.holder.position.z -= fx*0.055*w; H.holder.position.y -= 0.03*w;
  H.root.updateMatrixWorld(true);
  for (let i = 0; i < 2; i++) if (hs[i]) {
    const sd = i ? 1 : -1;
    _pole.set(-0.25*fx - 0.8*sd*fz, -0.7, -0.25*fz + 0.8*sd*fx);
    ikArm(H, i ? 'r' : 'l', _h[i], _pole, 1);
    hs[i].parent.getWorldQuaternion(_pq).invert(); hs[i].quaternion.copy(_pq.multiply(_hq[i]));
  }
  _pole.set(fx, 0.25, fz); ikLeg(H, 'r', _rf, _pole, 1);
  rb.parent.getWorldQuaternion(_pq).invert(); rb.quaternion.copy(_pq.multiply(_rq));
  // lifted clear of the peg on the way, then down on the ball of the foot (the ankle ~12 cm up, heel raised)
  _t.set(gx, gy + 0.12, gz).sub(_f).multiplyScalar(w).add(_f);
  _t.y += Math.sin(Math.PI*w)*0.07;
  _pole.set(fx*0.9, 0.3, fz*0.9);
  ikLeg(H, 'l', _t, _pole, 1);
  fb.parent.getWorldQuaternion(_pq).invert();
  fb.quaternion.copy(_pq.multiply(_q));
  // toes down: about the machine's right-hand axis (-fz, 0, fx), negative turns the toe down
  fb.updateMatrixWorld(true); fb.parent.getWorldQuaternion(_pq).invert();
  fb.quaternion.premultiply(_q.setFromAxisAngle(_ax.set(-fz, 0, fx).applyQuaternion(_pq), -0.5*w));
  H.root.updateMatrixWorld(true);
  mark(H);
}

// you: on the player's machine, from the seat placeRider has already put you on
const pr = Pilot.prototype.placeRider;
Pilot.prototype.placeRider = function () {
  const v = this.riderShown, f = v && v.spec && v.spec.two && fitOf(v.type);
  let w = 0;
  if (f && v.tilt) {
    const S = v._fd || (v._fd = { k: 0, want: 0, t: performance.now(), lean: 0 });
    const now = performance.now(), dt = Math.min(0.1, (now - S.t)/1000); S.t = now;
    w = v.tipped ? 0 : step(S, Math.abs(v.v || 0), dt);
    // the machine leans onto the foot (taken off again first if nothing has reset the tilt since)
    const r = v.tilt.rotation;
    if (S.set !== undefined && r.x === S.set) r.x += S.lean;
    S.lean = 0.12*w; r.x -= S.lean; S.set = r.x;
    v.tilt.updateMatrixWorld(true);
  }
  pr.call(this);
  if (!f || !this.human || this.riderShown !== v) return;
  const fx = Math.cos(v.th), fz = Math.sin(v.th), ax = f.hip[0] + 0.14;
  _t.set(v.x + fx*ax + fz*OUT, 0, v.z + fz*ax - fx*OUT);
  const FL = this.W.fly, gy = v.deck >= 0 && FL ? FL.heightOn(v.deck, _t.x, _t.z) : this.W.surf.height(_t.x, _t.z);
  plant(this.human, w, _t.x, gy, _t.z, fx, fz);
};

// riders in traffic close to you (the ones with bodies): the one in front, not the pillion
const SEAT_X = { bike: 0.0, scooter: 0.04 };
const dr = Crowd.prototype.drive;
Crowd.prototype.drive = function (s, dt, cx, cz) {
  dr.call(this, s, dt, cx, cz);
  const p = s.p, o = p && p.rideOf, H = s.H;
  if (!o || p.seatIdx !== 0 || p.sideSaddle || /^auto|^cycle/.test(o.type) || o.fallen > 0 || !H) return;
  const S = p._fd || (p._fd = { k: 0, want: 0 });
  // (far off, only last frame's pose undone)
  const w = Math.abs(p.x - cx) + Math.abs(p.z - cz) > 40 ? (S.k = 0) : step(S, Math.abs(o.v || 0), dt);
  const yaw = o.ryaw ?? o.yaw ?? Math.atan2(o.hz, o.hx), fx = Math.cos(yaw), fz = Math.sin(yaw);
  const ax = (SEAT_X[/^bike/.test(o.type) ? 'bike' : 'scooter'] ?? 0) + 0.12, ox = o.rx ?? o.x, oz = o.rz ?? o.z;
  // (right of the way it faces is (-fz, fx): the left foot goes the other way)
  plant(H, w, ox + fx*ax + fz*OUT, o.y || 0, oz + fz*ax - fx*OUT, fx, fz);
};
