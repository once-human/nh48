// A two-wheeler's front end turns when it's steered: the bars, the fork, the front wheel and its guard (and on a
// scooter the cowl with the lamp in it, on a motorbike the lamp and the clocks) swing about the steering head, the
// line from the top of the fork down through the front axle. It was one solid piece with the rest: you leant into a
// corner with the bars dead straight, and walked it round a U-turn the same.
// The model marks which of its vertices are the front end (beta/vehicles/models.js front()); the body is drawn as two
// meshes over the same vertex data, the front's triangles in one (on a pivot at the steering head) and the rest in
// the other. Your hands go to the grips where they've turned to (beta/vehicles/fit.js asks turned()).
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { rolled, wheelMesh, turn, dropWheel, nearCam } from './wheelspin.js';

const split = new WeakMap();           // shared body geometry → { rest, front, ax }
function parts(geo) {
  if (split.has(geo)) return split.get(geo);
  const F = geo.userData && geo.userData.front, St = geo.userData && geo.userData.stand, WH = (geo.userData && geo.userData.wh2) || [];
  let out = null;
  if (F && geo.index) {
    const inR = (R, i) => { if (R) for (const [a, b] of R) if (i >= a && i < b) return true; return false; };
    const I = geo.index.array, rest = [], fr = [], st = [], wt = WH.map(() => []);
    // (each wheel on its own, to go round: the front one on the turning front end)
    const inW = (i) => { for (let k = 0; k < WH.length; k++) if (i >= WH[k].v[0] && i < WH[k].v[1]) return k; return -1; };
    for (let t = 0; t + 2 < I.length; t += 3) { const k = inW(I[t]); (k >= 0 ? wt[k] : inR(F.r, I[t]) ? fr : inR(St, I[t]) ? st : rest).push(I[t], I[t + 1], I[t + 2]); }
    const mk = (idx) => {
      const g = new THREE.BufferGeometry();
      for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.attributes[k]);
      g.setIndex(new THREE.BufferAttribute(geo.index.count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
      g.boundingSphere = geo.boundingSphere; g.boundingBox = geo.boundingBox;
      return g;
    };
    const [x0, y0, x1, y1] = F.ax, L = Math.hypot(x1 - x0, y1 - y0) || 1;
    const wheels = WH.map((W, k) => wt[k].length ? { W, geo: mk(wt[k]), front: inR(F.r, W.v[0]) } : null).filter(Boolean);
    out = { src: geo, rest: mk(rest), front: mk(fr), stand: st.length ? mk(st) : null, wheels, top: new THREE.Vector3(x0, y0, 0), axis: new THREE.Vector3((x1 - x0)/L, (y1 - y0)/L, 0) };
  }
  split.set(geo, out);
  return out;
}
function setup(v) {
  v._fr = null;
  const body = v.bodyMesh, P = body && parts(body.geometry);
  if (!P) return;
  const fm = new THREE.InstancedMesh(P.front, body.material, 1);
  fm.instanceColor = body.instanceColor;                       // (the same paint)
  fm.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-P.top.x, -P.top.y, 0));
  fm.castShadow = body.castShadow; fm.receiveShadow = body.receiveShadow; fm.frustumCulled = false;
  const piv = new THREE.Group(); piv.position.copy(P.top); piv.add(fm);
  body.geometry = P.rest; body.parent.add(piv);
  // the stand, on its own: down when it's parked, up when someone's riding it
  let sm = null;
  if (P.stand) {
    sm = new THREE.InstancedMesh(P.stand, body.material, 1);
    sm.instanceColor = body.instanceColor; sm.setMatrixAt(0, new THREE.Matrix4());
    sm.castShadow = body.castShadow; sm.receiveShadow = body.receiveShadow; sm.frustumCulled = false;
    body.parent.add(sm);
  }
  const wh = P.wheels.map(({ W, geo, front }) => {
    const w = wheelMesh(geo, body, W);
    if (front) { w.spin.position.set(W.x - P.top.x, W.y - P.top.y, W.z); piv.add(w.spin); } else { w.spin.position.set(W.x, W.y, W.z); body.parent.add(w.spin); }
    return w;
  });
  v._fr = { piv, axis: P.axis, top: P.top, ang: 0, mesh: fm, full: P.src, stand: sm, wh };
}
// how far the bars are turned: the steer itself at a walk, less as it speeds up (at speed it steers by leaning, the
// bars hardly move)
const barsOf = (v) => { if (v.barVis !== undefined) return v.barVis; const sp = Math.abs(v.v || 0); return Math.max(-0.6, Math.min(0.6, (v.steer || 0)*(sp < 1 ? 1 : 1/(1 + (sp - 1)*0.18)))); };
const sync = Vehicle.prototype.sync;
Vehicle.prototype.sync = function (dt = 0) {
  if (this.spec && this.spec.two && this._fr === undefined && this.bodyMesh) setup(this);
  const F = this._fr;
  if (F) {
    // (+steer is a right turn: the front swings to +z, the rider's right; about the axis pointing down the fork)
    F.ang = barsOf(this);
    F.piv.quaternion.setFromAxisAngle(F.axis, F.ang);
    // the wheels roll with the road (a locked brake stops them)
    const dist = rolled(this, F), near = F.wh.length && nearCam(this), locked = this._lockT > 0.2 && Math.abs(this.v || 0) > 1.5;
    for (const w of F.wh) turn(w, locked ? 0 : -dist/w.W.r, near);
    if (F.stand) { const G = window.__nhAskG, P = G && G.player; F.stand.visible = !(P && !P.onFoot && P.cur === this) && !this.rider && !this.driver; }
  }
  return sync.call(this, dt);
};
const disp = Vehicle.prototype.dispose;
Vehicle.prototype.dispose = function () { const F = this._fr; if (F) { F.piv.parent && F.piv.parent.remove(F.piv); F.mesh.dispose(); for (const w of F.wh) dropWheel(w); if (F.stand) { F.stand.parent && F.stand.parent.remove(F.stand); F.stand.dispose(); } } return disp.call(this); };

// a point on the machine (its own frame) where it is with the bars turned: the grips, for where your hands go
// (beta/vehicles/fit.js)
const _q = new THREE.Quaternion();
export function turned(v, p) {
  const F = v && v._fr;
  if (!F || Math.abs(F.ang) < 1e-4) return p;
  return p.sub(F.top).applyQuaternion(_q.setFromAxisAngle(F.axis, F.ang)).add(F.top);
}
