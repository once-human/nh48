// A cyclist close by is a real person on the cycle, like the scooter and motorbike riders (the baked figure further
// off): sat on the saddle, hands on the bar, and pedalling. The crank goes round with the road they cover (once every
// 4.6 m, a roadster's wheel and gearing), the feet on the pedals all the way round, the knees coming up and over;
// coasting (slowing down) the pedals stay where they are; stopped, the left foot comes off and down onto the road
// and the right one waits on its pedal, up at the front ready to push off.
// (Which ones get a body, the seat, the grips, no helmet: patches on traffic.js and people/crowd.js in tools/build-beta.mjs.)
import * as THREE from 'three';
import { Crowd } from '@orig/people/crowd.js';
import { Pilot } from '@orig/game/pilot.js';
import { ikLeg } from '../game/fists.js';

const CRANK = [-0.05, 0.33], ARM = 0.15, PZ = 0.14, PER_TURN = 4.6;
const sm = (k) => k*k*(3 - 2*k);
const _t = new THREE.Vector3(), _pole = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
// the clip only poses the body on some frames: the legs are put back to the clip's pose before each solve, or each
// frame's turn would go on top of the last (and round and round the crank the leg would slowly twist)
const LEGS = ['thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
const bone = (H, n) => (H._cyb || (H._cyb = {}))[n] || (H._cyb[n] = H.root.getObjectByName(n));
function undo(H) {
  for (const n of LEGS) {
    const b = bone(H, n); if (!b) continue;
    const u = b.userData;
    if (u.cySet && b.quaternion.equals(u.cySet)) b.quaternion.copy(u.cyBase);
    (u.cyBase || (u.cyBase = new THREE.Quaternion())).copy(b.quaternion);
  }
}
function mark(H) { for (const n of LEGS) { const b = bone(H, n); if (b) (b.userData.cySet || (b.userData.cySet = new THREE.Quaternion())).copy(b.quaternion); } }
const dr = Crowd.prototype.drive;
Crowd.prototype.drive = function (s, dt, cx, cz) {
  dr.call(this, s, dt, cx, cz);
  const p = s.p, o = p && p.rideOf, H = s.H;
  if (!o || !/^cycle/.test(o.type) || p.seatIdx !== 0 || o.fallen > 0 || !H) return;
  if (Math.abs(p.x - cx) + Math.abs(p.z - cz) > 45) return;
  const C = p._cr || (p._cr = { a: Math.random()*Math.PI*2, lx: o.x, lz: o.z, v: 0, down: 0 });
  const m = Math.hypot(o.x - C.lx, o.z - C.lz), sp = Math.abs(o.v || 0); C.lx = o.x; C.lz = o.z;
  const slowing = dt > 0 && (C.v - sp)/dt > 0.4; C.v = sp;            // (braking or rolling to a stop: freewheeling)
  // round with the road, unless they're freewheeling down to a stop
  if (m < 3 && !slowing) C.a += m/PER_TURN*Math.PI*2;
  // the foot down: once all but stopped, back up once rolling (and the crank brought round, right pedal up front)
  const want = sp < 0.4 ? 1 : sp > 1.2 ? 0 : C.down > 0.5 ? 1 : 0;
  C.down += Math.sign(want - C.down)*Math.min(Math.abs(want - C.down), dt/0.4);
  if (C.down > 0.02) { const goal = -Math.PI*0.25; C.a += Math.atan2(Math.sin(goal - C.a), Math.cos(goal - C.a))*Math.min(1, dt*4)*C.down; }
  const w = sm(C.down);
  // the cycle as it's drawn
  const yaw = o.ryaw ?? o.yaw ?? Math.atan2(o.hz, o.hx), fx = Math.cos(yaw), fz = Math.sin(yaw);
  _e.set(o.roll || 0, -yaw, o.pitch || 0); _q.setFromEuler(_e);
  const ox = o.rx ?? o.x, oy = o.y || 0, oz = o.rz ?? o.z;
  undo(H);
  for (const [side, z, ph] of [['r', PZ, 0], ['l', -PZ, Math.PI]]) {
    // the pedal (0 at the top, a quarter turn on at the front), the ankle a little above and behind its spindle
    const a = C.a + ph, px = CRANK[0] + Math.sin(a)*ARM - 0.03, py = CRANK[1] + Math.cos(a)*ARM + 0.07;
    _t.set(px, py, z).applyQuaternion(_q); _t.x += ox; _t.y += oy; _t.z += oz;
    if (side === 'l' && w > 0) {
      // down to the road beside it, a little forward of the saddle
      const gx = ox + fx*0.05 + fz*0.38, gz = oz + fz*0.05 - fx*0.38;
      _t.set(_t.x + (gx - _t.x)*w, _t.y + (oy + 0.1 - _t.y)*w + Math.sin(Math.PI*w)*0.06, _t.z + (gz - _t.z)*w);
    }
    // the knee forward and a touch out
    // (right of the way it faces is (-fz, fx))
    const out = z > 0 ? 0.15 : -0.15;
    _pole.set(fx - fz*out, 0.35, fz + fx*out);
    ikLeg(H, side, _t, _pole, 1);
  }
  mark(H);
};

// ---- you on a cycle: your own legs on the pedals the same way, the crank going round with the road you cover,
// freewheeling as you slow, the left foot down on the road when you stop
const prd = Pilot.prototype.placeRider;
Pilot.prototype.placeRider = function () {
  prd.call(this);
  const v = this.riderShown, H = this.human;
  if (!v || !H || !/^cycle/.test(v.type || '') || v === this.auto || !v.tilt) return;
  const dt = Math.min(0.1, (performance.now() - (this._crT || performance.now()))/1000); this._crT = performance.now();
  const C = this._cr || (this._cr = { a: 0, lx: v.x, lz: v.z, v: 0, down: 0 });
  const m = Math.hypot(v.x - C.lx, v.z - C.lz), sp = Math.abs(v.v || 0); C.lx = v.x; C.lz = v.z;
  const slowing = dt > 0 && (C.v - sp)/dt > 0.4 && !(this._inp && this._inp.throttle > 0.1); C.v = sp;
  if (m < 3 && !slowing) C.a += m/PER_TURN*Math.PI*2*Math.sign(v.v || 1);
  const want = sp < 0.4 ? 1 : sp > 1.2 ? 0 : C.down > 0.5 ? 1 : 0;
  C.down += Math.sign(want - C.down)*Math.min(Math.abs(want - C.down), dt/0.4);
  if (C.down > 0.02) { const goal = -Math.PI*0.25; C.a += Math.atan2(Math.sin(goal - C.a), Math.cos(goal - C.a))*Math.min(1, dt*4)*C.down; }
  const w = sm(C.down), M = v.tilt.matrixWorld, fx = Math.cos(v.th), fz = Math.sin(v.th), gy = v.y || 0;
  H.holder.updateMatrixWorld(true);
  for (const [side, z, ph] of [['r', PZ, 0], ['l', -PZ, Math.PI]]) {
    const a = C.a + ph;
    _t.set(CRANK[0] + Math.sin(a)*ARM - 0.03, CRANK[1] + Math.cos(a)*ARM + 0.07, z).applyMatrix4(M);
    if (side === 'l' && w > 0) { const gx = v.x + fx*0.05 + fz*0.38, gz = v.z + fz*0.05 - fx*0.38; _t.set(_t.x + (gx - _t.x)*w, _t.y + (gy + 0.1 - _t.y)*w + Math.sin(Math.PI*w)*0.06, _t.z + (gz - _t.z)*w); }
    const out = z > 0 ? 0.15 : -0.15;
    _pole.set(fx - fz*out, 0.35, fz + fx*out);
    ikLeg(H, side, _t, _pole, 1);
  }
};
