// A two-wheeler's front end turns when it's steered: the bars, the fork, the front wheel and its guard (and on a
// scooter the cowl with the lamp in it, on a motorbike the lamp and the clocks) swing about the steering head, the
// line from the top of the fork down through the front axle. It was one solid piece with the rest: you leant into a
// corner with the bars dead straight, and walked it round a U-turn the same.
// The model marks which of its vertices are the front end (beta/vehicles/models.js front()); the body is drawn as two
// meshes over the same vertex data, the front's triangles in one (on a pivot at the steering head) and the rest in
// the other. Your hands go to the grips where they've turned to (beta/vehicles/fit.js asks turned()).
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';

const split = new WeakMap();           // shared body geometry → { rest, front, ax }
function parts(geo) {
  if (split.has(geo)) return split.get(geo);
  const F = geo.userData && geo.userData.front, St = geo.userData && geo.userData.stand;
  let out = null;
  if (F && geo.index) {
    const inR = (R, i) => { if (R) for (const [a, b] of R) if (i >= a && i < b) return true; return false; };
    const I = geo.index.array, rest = [], fr = [], st = [];
    for (let t = 0; t + 2 < I.length; t += 3) (inR(F.r, I[t]) ? fr : inR(St, I[t]) ? st : rest).push(I[t], I[t + 1], I[t + 2]);
    const mk = (idx) => {
      const g = new THREE.BufferGeometry();
      for (const k of Object.keys(geo.attributes)) g.setAttribute(k, geo.attributes[k]);
      g.setIndex(new THREE.BufferAttribute(geo.index.count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
      g.boundingSphere = geo.boundingSphere; g.boundingBox = geo.boundingBox;
      return g;
    };
    const [x0, y0, x1, y1] = F.ax, L = Math.hypot(x1 - x0, y1 - y0) || 1;
    out = { src: geo, rest: mk(rest), front: mk(fr), stand: st.length ? mk(st) : null, top: new THREE.Vector3(x0, y0, 0), axis: new THREE.Vector3((x1 - x0)/L, (y1 - y0)/L, 0) };
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
  v._fr = { piv, axis: P.axis, top: P.top, ang: 0, mesh: fm, full: P.src, stand: sm };
}
// how far the bars are turned: the steer itself at a walk, less as it speeds up (at speed it steers by leaning, the
// bars hardly move)
const barsOf = (v) => { const sp = Math.abs(v.v || 0); return Math.max(-0.6, Math.min(0.6, (v.steer || 0)*(sp < 1 ? 1 : 1/(1 + (sp - 1)*0.18)))); };
const sync = Vehicle.prototype.sync;
Vehicle.prototype.sync = function (dt = 0) {
  if (this.spec && this.spec.two && this._fr === undefined && this.bodyMesh) setup(this);
  const F = this._fr;
  if (F) {
    // (+steer is a right turn: the front swings to +z, the rider's right; about the axis pointing down the fork)
    F.ang = barsOf(this);
    F.piv.quaternion.setFromAxisAngle(F.axis, F.ang);
    if (F.stand) { const G = window.__nhAskG, P = G && G.player; F.stand.visible = !(P && !P.onFoot && P.cur === this) && !this.rider && !this.driver; }
  }
  return sync.call(this, dt);
};
const disp = Vehicle.prototype.dispose;
Vehicle.prototype.dispose = function () { const F = this._fr; if (F) { F.piv.parent && F.piv.parent.remove(F.piv); F.mesh.dispose(); if (F.stand) { F.stand.parent && F.stand.parent.remove(F.stand); F.stand.dispose(); } } return disp.call(this); };

// a point on the machine (its own frame) where it is with the bars turned: the grips, for where your hands go
// (beta/vehicles/fit.js)
const _q = new THREE.Quaternion();
export function turned(v, p) {
  const F = v && v._fr;
  if (!F || Math.abs(F.ang) < 1e-4) return p;
  return p.sub(F.top).applyQuaternion(_q.setFromAxisAngle(F.axis, F.ang)).add(F.top);
}
