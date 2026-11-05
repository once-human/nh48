// Sitting on a two-wheeler the way it's built. The seated clip used to put everyone at the same spot whatever they
// rode (on a scooter that was over the floorboard, a hand's width in front of the seat). Each model's own seat, grips
// and footrests, taken from how it's built (beta/vehicles/models.js), in its frame (x forward, y up, z right):
// the hips go down on the seat, the body leans in only as far as it has to for the hands to reach the bars, the hands
// close round the grips, and the feet sit on the floorboard or the pegs. The getting on and off (mount.js, getout.js)
// work from the same numbers, so nothing jumps when they hand over.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { ikArm } from '@orig/people/humans.js';
import { ikLeg } from '../game/fists.js';

// hip: where the hip joints sit (a seat's top + 8 cm); grip: the middle of each grip's rubber; foot: the ankle over it
export const FIT = {
  scooter: { hip: [-0.2, 0.86], grip: [0.58, 1.02, 0.32], foot: [0.14, 0.41, 0.13] },
  bike: { hip: [-0.2, 1.01], grip: [0.58, 1.07, 0.32], foot: [0.0, 0.34, 0.2] },
  bullet: { hip: [-0.19, 1.055], grip: [0.58, 1.07, 0.32], foot: [0.0, 0.34, 0.2] },
  superbike: { hip: [-0.2, 0.99], grip: [0.385, 0.977, 0.22], foot: [-0.27, 0.54, 0.21] },
};
export const fitOf = (type) => FIT[/^scooter/.test(type) ? 'scooter' : /^bike/.test(type) ? 'bike' : type] || null;
// the seated clip carries the hip joints this far behind and above the body's origin
export const HIP_OFF = [-0.32, 0.58];
// the wrist sits behind and above the grip, the palm over it
export const WRIST = [-0.05, 0.035];

// fingers closed round something in the hand (k 0 open, 1 a full grip). The bend is about the line of the knuckles,
// the way that brings the fingertips down to the thumb (found once for each hand: rigs differ)
const FING = ['index', 'middle', 'ring', 'pinky'];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
function turn(b, axis, ang) {
  if (!b || !b.parent) return;
  const u = b.userData;
  if (u.gq && b.quaternion.equals(u.gq)) b.quaternion.copy(u.gb); else (u.gb || (u.gb = new THREE.Quaternion())).copy(b.quaternion);
  b.parent.getWorldQuaternion(_pq).invert();
  b.quaternion.premultiply(_q.setFromAxisAngle(_c.copy(axis).applyQuaternion(_pq), ang));
  (u.gq || (u.gq = new THREE.Quaternion())).copy(b.quaternion);
  b.updateMatrixWorld(true);
}
function hand(H, side) {
  const c = H._grip || (H._grip = {});
  if (c[side]) return c[side];
  const R = H.root, get = (n) => R.getObjectByName(n);
  const f = { f: FING.map(n => [1, 2, 3].map(i => get(`${n}_0${i}_${side}`))), tip: get(`index_04_leaf_${side}`), th: [1, 2, 3].map(i => get(`thumb_0${i}_${side}`)), s: 0, ts: 0 };
  if (!f.f[0][0] || !f.f[3][0]) return (c[side] = null);
  // which way is in: try the index finger both ways, keep the one that brings its tip nearer the thumb
  R.updateMatrixWorld(true);
  f.f[0][0].getWorldPosition(_a); f.f[3][0].getWorldPosition(_b); _ax.subVectors(_b, _a).normalize();
  const b0 = f.f[0][0], q0 = b0.quaternion.clone(), d = [];
  for (const s of [1, -1]) {
    b0.parent.getWorldQuaternion(_pq).invert();
    b0.quaternion.copy(q0).premultiply(_q.setFromAxisAngle(_c.copy(_ax).applyQuaternion(_pq), s*0.9)); b0.updateMatrixWorld(true);
    f.tip.getWorldPosition(_a); f.th[0].getWorldPosition(_b); d.push(_a.distanceTo(_b));
  }
  b0.quaternion.copy(q0); b0.updateMatrixWorld(true);
  f.s = d[0] < d[1] ? 1 : -1;
  // the thumb folds across the palm, about the line from the wrist down the middle finger
  const t0 = f.th[0], tq = t0 && t0.quaternion.clone(), dd = [];
  if (t0 && f.th[2]) {
    get(`hand_${side}`).getWorldPosition(_a); f.f[1][0].getWorldPosition(_b); const along = _b.clone().sub(_a).normalize();
    for (const s of [1, -1]) {
      t0.parent.getWorldQuaternion(_pq).invert();
      t0.quaternion.copy(tq).premultiply(_q.setFromAxisAngle(_c.copy(along).applyQuaternion(_pq), s*0.6)); t0.updateMatrixWorld(true);
      f.th[2].getWorldPosition(_a); f.f[1][0].getWorldPosition(_b); dd.push(_a.distanceTo(_b));
    }
    t0.quaternion.copy(tq); t0.updateMatrixWorld(true);
    f.ts = dd[0] < dd[1] ? 1 : -1;
  }
  return (c[side] = f);
}
export function grip(H, side, k = 1) {
  if (!H || k <= 0) return;
  const f = hand(H, side); if (!f) return;
  H.root.updateMatrixWorld(true);
  f.f[0][0].getWorldPosition(_a); f.f[3][0].getWorldPosition(_b); _ax.subVectors(_b, _a).normalize();
  const a = f.s*k;
  for (const ch of f.f) { turn(ch[0], _ax, a*1.15); turn(ch[1], _ax, a*1.35); turn(ch[2], _ax, a*0.85); }
  if (f.ts && f.th[0]) {
    H.root.getObjectByName(`hand_${side}`).getWorldPosition(_a); f.f[1][0].getWorldPosition(_b); _b.sub(_a).normalize();
    turn(f.th[0], _b, f.ts*k*0.45); turn(f.th[1], _ax, a*0.5); turn(f.th[2], _ax, a*0.6);
  }
}

// lean the chest in (about spine_03) until both wrists can reach their targets
const _s = new THREE.Vector3(), _r = new THREE.Vector3(), _w = [new THREE.Vector3(), new THREE.Vector3()], _pole = new THREE.Vector3();
const _rq = new THREE.Quaternion(), _bq = new THREE.Quaternion();
export function reachLean(H, right, targets, w = 1) {
  const R = H.root, s3 = R.getObjectByName('spine_03'); if (!s3) return;
  const arm = (sd) => { const u = R.getObjectByName('upperarm_' + sd), l = R.getObjectByName('lowerarm_' + sd), h = R.getObjectByName('hand_' + sd); return [u, l, h]; };
  const A = [arm('l'), arm('r')]; if (!A[0][0] || !A[1][0]) return;
  R.updateMatrixWorld(true);
  const len = (c) => c[0].getWorldPosition(_a).distanceTo(c[1].getWorldPosition(_b)) + _b.distanceTo(c[2].getWorldPosition(_c));
  const L = Math.min(len(A[0]), len(A[1]))*0.97;
  _bq.copy(s3.quaternion);
  let lean = 0;
  for (let it = 0; it < 4; it++) {
    let over = 0;
    for (let i = 0; i < 2; i++) { A[i][0].getWorldPosition(_s); over = Math.max(over, _s.distanceTo(targets[i]) - L); }
    if (over <= 0.005) break;
    // about 45 cm from the waist to the shoulders: the lean that brings them that much nearer
    lean = Math.min(0.75, lean + over/0.42);
    s3.parent.getWorldQuaternion(_pq).invert();
    s3.quaternion.copy(_bq).premultiply(_rq.setFromAxisAngle(_c.copy(right).applyQuaternion(_pq), -lean));
    R.updateMatrixWorld(true);
  }
  if (w < 1 && lean > 0) {
    lean *= Math.max(0, w);
    s3.parent.getWorldQuaternion(_pq).invert();
    s3.quaternion.copy(_bq).premultiply(_rq.setFromAxisAngle(_c.copy(right).applyQuaternion(_pq), -lean));
    R.updateMatrixWorld(true);
  }
  // and the head back up to look down the road
  if (lean > 0) { const nk = R.getObjectByName('neck_01'); if (nk) { nk.parent.getWorldQuaternion(_pq).invert(); nk.quaternion.premultiply(_rq.setFromAxisAngle(_c.copy(right).applyQuaternion(_pq), lean*0.8)); R.updateMatrixWorld(true); } }
}

// at the wheel of a car: both hands on the rim at ten to two, turning with it, fingers round it. The cabin's wheel sits
// further from the seat than an arm reaches, so you sit forward on the cushion as far as it takes (never more than 30 cm)
const _g = [new THREE.Vector3(), new THREE.Vector3()], _sh = new THREE.Vector3(), _fw = new THREE.Vector3();
function wheelOf(v) {
  if (v._wheel !== undefined) return v._wheel;
  const piv = v.cockpit.group.children.find(o => o.type === 'Group' && o.children.length === 1 && o.children[0].type === 'Group' && o.children[0].children.some(c => c.isMesh));
  return (v._wheel = piv ? piv.children[0] : null);
}
function atWheel(H, v) {
  const spin = wheelOf(v); if (!spin) return;
  const m = v.tilt.matrixWorld, R = H.root;
  // the wrists just behind the rim (toward you), at ten and two on the wheel as it's turned
  spin.updateWorldMatrix(true, false);
  for (const i of [0, 1]) _g[i].set((i ? 1 : -1)*0.2*Math.sin(1.0), 0.2*Math.cos(1.0), 0.055).applyMatrix4(spin.matrixWorld);
  _r.set(0, 0, 1).transformDirection(m);
  // (which is your right hand's: the one further to the car's right, the wheel turned or not)
  const rIs1 = _g[1].dot(_r) >= _g[0].dot(_r), wr = rIs1 ? [_g[0], _g[1]] : [_g[1], _g[0]];
  const u = R.getObjectByName('upperarm_l'), l = R.getObjectByName('lowerarm_l'), h = R.getObjectByName('hand_l'); if (!u || !l || !h) return;
  H.holder.updateMatrixWorld(true);
  const L = (u.getWorldPosition(_a).distanceTo(l.getWorldPosition(_b)) + _b.distanceTo(h.getWorldPosition(_c)))*0.96;
  let over = 0;
  for (const [i, sd] of [[0, 'l'], [1, 'r']]) { R.getObjectByName('upperarm_' + sd).getWorldPosition(_sh); over = Math.max(over, _sh.distanceTo(wr[i]) - L); }
  if (over > 0) {
    _fw.set(1, 0, 0).transformDirection(m);
    H.holder.position.addScaledVector(_fw, Math.min(0.3, over*1.05));
    H.holder.updateMatrixWorld(true);
  }
  for (const [i, sd] of [[0, 'l'], [1, 'r']]) {
    const s = sd === 'r' ? 1 : -1;
    _pole.set(-0.3, -1, s*0.6).transformDirection(m);
    ikArm(H, sd, wr[i], _pole, 1);
    grip(H, sd, 1);
  }
}

const pr = Pilot.prototype.placeRider;
Pilot.prototype.placeRider = function () {
  pr.call(this);
  const v = this.riderShown, H = this.human;
  if (!v || !H) return;
  // whoever was driving it is out on the road now: their figure doesn't stay in the seat with you
  if (v.driver && v.driver.visible) { v.driver.visible = false; if (v.driverArms) v.driverArms.visible = false; }
  const two = v !== this.auto && v.spec && v.spec.two;
  if (!two && v.cockpit) { atWheel(H, v); return; }
  if (!two && v !== this.auto && v.type !== 'auto') return;
  const f = two && fitOf(v.type), m = v.tilt.matrixWorld;
  if (f) {
    // down on the seat
    H.holder.position.set(f.hip[0] - HIP_OFF[0], f.hip[1] - HIP_OFF[1], 0).applyMatrix4(m);
    H.holder.updateMatrixWorld(true);
    // the hands on the grips: lean in as far as it takes
    const right = _r.set(0, 0, 1).transformDirection(m).clone();
    for (const i of [0, 1]) _w[i].set(f.grip[0] + WRIST[0], f.grip[1] + WRIST[1], (i ? 1 : -1)*f.grip[2]).applyMatrix4(m);
    reachLean(H, right, _w);
    for (const i of [0, 1]) { const sd = i ? 1 : -1; _pole.set(-0.25, -0.7, sd*0.8).transformDirection(m); ikArm(H, i ? 'r' : 'l', _w[i], _pole, 1); }
    // the feet on the floorboard / the pegs, knees forward and a little out
    for (const i of [0, 1]) {
      const sd = i ? 1 : -1;
      _s.set(f.foot[0], f.foot[1], sd*f.foot[2]).applyMatrix4(m);
      _pole.set(1, 0.25, sd*0.3).transformDirection(m);
      ikLeg(H, i ? 'r' : 'l', _s, _pole, 1);
    }
  }
  grip(H, 'l', 1); grip(H, 'r', 1);
};
