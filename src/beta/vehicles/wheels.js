// A car's wheels go round and its front ones turn. They were part of the body: a Huracan at 300 km/h had its spokes standing
// still and steered with its wheels dead straight. Now each is drawn on its own over the same vertices (so a dent or a torn
// tyre on the body's copy is still on them, beta/vehicles/damage.js own()). They roll with the road speed; the fronts turn with
// the wheel, the inside one a little further, as a steering rack does it, and stay where you left them when you get out. The
// handbrake stops the back ones, a locked brake all of them, and a car with the power to do it spins its driven wheels on a
// launch. A Huracan's and a 911's back wheels steer too, as the real ones do: against the fronts slowly, to get round, and
// with them at speed, to stay planted.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { baseOf } from './models.js';
import { rolled, wheelMesh, turn, dropWheel, nearCam } from './wheelspin.js';

const split = new WeakMap();
const REAR_STEER = new Set(['super', 'sports']);
const DRIVE_BACK = new Set(['super', 'sports', 'lux', 'jeep', 'bus', 'tempo', 'auto']);
function parts(geo, wh) {
  if (split.has(geo)) return split.get(geo);
  let out = null;
  const I = geo.index && geo.index.array, pos = geo.attributes.position, a = pos && pos.array;
  if (I && wh && wh.length) {
    const which = new Int8Array(pos.count).fill(-1);
    for (let k = 0; k < pos.count; k++) {
      const x = a[k*3], y = a[k*3 + 1], z = a[k*3 + 2];
      for (let w = 0; w < wh.length; w++) { const W = wh[w]; if ((x - W.x)**2 + (y - W.y)**2 < (W.r + 0.025)**2 && Math.abs(z - W.z) < W.w/2 + 0.035) { which[k] = w; break; } }
    }
    const rest = [], each = wh.map(() => []);
    for (let t = 0; t + 2 < I.length; t += 3) {
      const A = which[I[t]], B = which[I[t + 1]], C = which[I[t + 2]];
      (A >= 0 && A === B && A === C ? each[A] : rest).push(I[t], I[t + 1], I[t + 2]);
    }
    const mk = (idx) => { const g = new THREE.BufferGeometry(); for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.attributes[k]); g.setIndex(idx); if (!geo.boundingSphere) geo.computeBoundingSphere(); g.boundingSphere = geo.boundingSphere; return g; };
    if (each.every(e => e.length)) out = { rest: mk(rest), wheels: each.map(mk), src: geo };
  }
  split.set(geo, out);
  return out;
}
function setup(v) {
  v._wh4 = null;
  const body = v.bodyMesh, wh = v.wheels, P = body && parts(body.geometry, wh);
  if (!P) return;
  const list = wh.map((W, i) => {
    const w = wheelMesh(P.wheels[i], body, W), steer = new THREE.Group(); steer.position.set(W.x, W.y, W.z); steer.add(w.spin); body.parent.add(steer);
    return Object.assign(w, { steer, front: W.x > 0 });
  });
  body.geometry = P.rest;
  v._wh4 = { list, src: P.src, t: performance.now(), base: baseOf(v.type) };
  v._bb = null;
}
const sync = Vehicle.prototype.sync;
Vehicle.prototype.sync = function (dt = 0) {
  const S = this.spec;
  if (S && !S.two && this._wh4 === undefined && this.bodyMesh && this.wheels && this.wheels.length) setup(this);
  const F = this._wh4;
  if (F) {
    const now = performance.now(), d = Math.min(0.1, (now - F.t)/1000), dist = rolled(this, F), near = nearCam(this), v = this.v || 0, sp = Math.abs(v), sd = this.steer || 0, TW = S.W/2; F.t = now;
    const locked = this._lockT > 0.2 && sp > 1.5, hb = !!this.hbOn && sp > 0.5, base = F.base;
    // (driven wheels spinning up on a launch, if it has the power and nothing's holding it back)
    const thr = this._thrIn || 0, spare = this.tcsOn ? 0 : Math.max(0, (S.acc || 0)*(this.accMul || 1) - 5.5), launch = !this.reverse && thr > 0.8 && sp < 14 ? spare*(1 - sp/14)*3 : 0;
    const rear = REAR_STEER.has(base) ? Math.max(-0.05, Math.min(0.05, sd*(sp < 15 ? -0.14 : sp < 22 ? -0.14 + 0.28*(sp - 15)/7 : 0.14))*(sp < 0.5 ? 0 : 1)) : 0;
    for (const w of F.list) {
      const W = w.W, flat = this._flats && this._flats.has(W), driven = w.front ? !DRIVE_BACK.has(base) || base === 'super' : DRIVE_BACK.has(base);
      let da = -dist/W.r;                                 // (the road gone by, over the radius)
      if (locked || (hb && !w.front)) da = 0;
      else if (driven && launch > 0) da -= launch/W.r*d;
      if (!flat) turn(w, da, near);
      if (w.front) { const inner = Math.sign(W.z)*Math.sign(sd) > 0 ? 1.1 : 0.92; w.steer.rotation.y = -sd*(Math.abs(W.z) < 0.15 ? 1 : inner); }
      else if (rear) w.steer.rotation.y = -rear;
    }
  }
  return sync.call(this, dt);
};
// (what's asked of the pedal, for the launch above)
const upd = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) { this._thrIn = inp ? inp.throttle || 0 : 0; return upd.call(this, dt, inp, traffic); };
// a ray that finds a tyre first (the body's mesh hasn't got them now): which wheel, or nothing, nearer than `far`
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _M = new THREE.Matrix4();
export function tyreOnRay(v, ray, far) {
  const F = v._wh4; if (!F) return null;
  _M.copy(v.bodyMesh.matrixWorld).invert(); _o.copy(ray.ray.origin).applyMatrix4(_M); _d.copy(ray.ray.direction).transformDirection(_M);
  let best = null, bt = far;
  for (const { W } of F.list) { const t = (W.x - _o.x)*_d.x + (W.y - _o.y)*_d.y + (W.z - _o.z)*_d.z; if (t < 0 || t > bt) continue; const dx = _o.x + _d.x*t - W.x, dy = _o.y + _d.y*t - W.y, dz = _o.z + _d.z*t - W.z; if (dx*dx + dy*dy < W.r*W.r && Math.abs(dz) < W.w) { bt = t; best = W; } }
  return best;
}
const disp = Vehicle.prototype.dispose;
Vehicle.prototype.dispose = function () { const F = this._wh4; if (F) { for (const w of F.list) { w.steer.parent && w.steer.parent.remove(w.steer); dropWheel(w); } this._wh4 = null; } return disp.call(this); };
