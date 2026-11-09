// The cabin inside the car's own shell. The dash, the seats, the pillars and the mirror are laid out for a roof that's
// flat at its full height, and /beta's bodies curve: the windscreen pillars' tops and the mirror came up through the roof,
// and in a saloon or an SUV the rear bench's back stood up over the boot behind the rear glass (the "board" behind the
// car and the blocks on top, there from the moment you got in, when the cabin is switched on). When a car is built,
// its body and glass are measured (the highest point over every 8 cm of the car's floor plan) and every
// point of the cabin is kept a few centimetres under them; anything off the body altogether goes down into it.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';

const CELL = 0.08, GAP = 0.035;
const key = (i, j) => i*4096 + j;
function shellTop(v) {
  const top = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), M = new THREE.Matrix4();
  const mark = (x, z, y) => { const k = key(Math.round(x/CELL), Math.round(z/CELL)); if (y > (top.get(k) ?? -9)) top.set(k, y); };
  const edge = (p, q) => { const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z)/(CELL*0.5)); for (let t = 0; t <= n; t++) { const k = n ? t/n : 0; mark(p.x + (q.x - p.x)*k, p.z + (q.z - p.z)*k, p.y + (q.y - p.y)*k); } };
  // (a police jeep or an ambulance: its own body, not the stock one hidden under it. beta/vehicles/servicecab.js)
  for (const mesh of v.shellMeshes || [v.bodyMesh, v.glassMesh]) {
    if (!mesh || !mesh.geometry) continue;
    mesh.updateMatrix(); M.copy(mesh.matrix);
    if (mesh.parent && mesh.parent !== v.tilt) { mesh.parent.updateMatrix(); M.premultiply(mesh.parent.matrix); }
    if (mesh.isInstancedMesh) { const I = new THREE.Matrix4(); mesh.getMatrixAt(0, I); M.multiply(I); }
    const pos = mesh.geometry.attributes.position, ix = mesh.geometry.index, nt = (ix ? ix.count : pos.count)/3;
    // the whole of every triangle laid over the grid, not just its corners (a roof is a few big triangles with nothing
    // in the middle: going by corners, the seats under it had "no roof" over them and were pressed flat)
    for (let t = 0; t < nt; t++) {
      a.fromBufferAttribute(pos, ix ? ix.getX(t*3) : t*3).applyMatrix4(M);
      b.fromBufferAttribute(pos, ix ? ix.getX(t*3 + 1) : t*3 + 1).applyMatrix4(M);
      c.fromBufferAttribute(pos, ix ? ix.getX(t*3 + 2) : t*3 + 2).applyMatrix4(M);
      edge(a, b); edge(b, c); edge(c, a);
      const den = (b.z - c.z)*(a.x - c.x) + (c.x - b.x)*(a.z - c.z); if (Math.abs(den) < 1e-5) continue;
      const i0 = Math.round(Math.min(a.x, b.x, c.x)/CELL), i1 = Math.round(Math.max(a.x, b.x, c.x)/CELL), j0 = Math.round(Math.min(a.z, b.z, c.z)/CELL), j1 = Math.round(Math.max(a.z, b.z, c.z)/CELL);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = i*CELL, z = j*CELL, u = ((b.z - c.z)*(x - c.x) + (c.x - b.x)*(z - c.z))/den, w = ((c.z - a.z)*(x - c.x) + (a.x - c.x)*(z - c.z))/den;
        if (u < 0 || w < 0 || u + w > 1) continue;
        mark(x, z, a.y*u + b.y*w + c.y*(1 - u - w));
      }
    }
  }
  return (x, z) => { const h = top.get(key(Math.round(x/CELL), Math.round(z/CELL))); return h === undefined ? null : h; };
}
function fit(v) {
  const C = v.cockpit; if (!C || C._fit) return;
  C._fit = true;
  const topAt = shellTop(v), p = new THREE.Vector3(), inv = new THREE.Matrix4();
  // (the cabin as a whole can sit moved in the car: the jeep's Bolero cabin is)
  C.group.updateMatrix(); const gm = C.group.matrix.clone(), gi = gm.clone().invert();
  // (the wheel on its pivot turns, and sits well inside: only the fixed pieces)
  for (const o of C.group.children) {
    if (!o.isMesh || !o.geometry) continue;
    o.updateMatrix(); inv.copy(o.matrix).invert();
    const g = o.geometry, pos = g.attributes.position; let moved = false;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrix).applyMatrix4(gm);
      const t = topAt(p.x, p.z), lim = t === null ? 0.3 : t - GAP;
      if (p.y > lim) { p.y = lim; p.applyMatrix4(gi).applyMatrix4(inv); pos.setXYZ(i, p.x, p.y, p.z); moved = true; }
    }
    if (moved) { pos.needsUpdate = true; g.computeBoundingSphere(); }
  }
}
Vehicle.prototype.fitCabin = function () { try { fit(this); } catch (e) { /* (a cabin we can't measure stays as it is) */ } };
const set = Vehicle.prototype.setCockpit;
Vehicle.prototype.setCockpit = function (on) {
  try { fit(this); } catch (e) { /* (a cabin we can't measure stays as it is) */ }
  return set.call(this, on);
};
// the cabin keeps up with the car (beta/vehicles/cockpit.js): its drive mode, its mirrors, the inside of its windows
const sync = Vehicle.prototype.sync;
Vehicle.prototype.sync = function (dt) {
  const r = sync.call(this, dt), C = this.cockpit;
  if (C && C.tick) C.tick(this);
  return r;
};
