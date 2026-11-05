// The cabin inside the car's own shell. The dash, the seats, the pillars and the mirror are laid out for a roof that's
// flat at its full height, and /beta's bodies curve: the windscreen pillars' tops and the mirror came up through the roof,
// and in a saloon or an SUV the rear bench's back stood up over the boot behind the rear glass (the "board" behind the
// car and the blocks on top, there from the moment you got in, when the cabin is switched on). The first time a car's
// cabin is shown, its body and glass are measured (the highest point over every 8 cm of the car's floor plan) and every
// point of the cabin is kept a few centimetres under them; anything off the body altogether goes down into it.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';

const CELL = 0.08, GAP = 0.035;
const key = (i, j) => i*4096 + j;
function shellTop(v) {
  const top = new Map(), p = new THREE.Vector3(), M = new THREE.Matrix4();
  for (const mesh of [v.bodyMesh, v.glassMesh]) {
    if (!mesh || !mesh.geometry) continue;
    mesh.updateMatrix(); M.copy(mesh.matrix);
    if (mesh.isInstancedMesh) { const I = new THREE.Matrix4(); mesh.getMatrixAt(0, I); M.multiply(I); }
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(M);
      const k = key(Math.round(p.x/CELL), Math.round(p.z/CELL));
      if (p.y > (top.get(k) ?? -9)) top.set(k, p.y);
    }
  }
  // between the body's own points: the lowest of what's round about (so a gap never lets a piece through)
  return (x, z) => {
    const i = Math.round(x/CELL), j = Math.round(z/CELL), h = top.get(key(i, j));
    if (h !== undefined) return h;
    let lo = Infinity;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const q = top.get(key(i + a, j + b)); if (q !== undefined && q < lo) lo = q; }
    return lo === Infinity ? null : lo;
  };
}
function fit(v) {
  const C = v.cockpit; if (!C || C._fit) return;
  C._fit = true;
  const topAt = shellTop(v), p = new THREE.Vector3(), inv = new THREE.Matrix4();
  // (the wheel on its pivot turns, and sits well inside: only the fixed pieces)
  for (const o of C.group.children) {
    if (!o.isMesh || !o.geometry) continue;
    o.updateMatrix(); inv.copy(o.matrix).invert();
    const g = o.geometry, pos = g.attributes.position; let moved = false;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrix);
      const t = topAt(p.x, p.z), lim = t === null ? 0.3 : t - GAP;
      if (p.y > lim) { p.y = lim; p.applyMatrix4(inv); pos.setXYZ(i, p.x, p.y, p.z); moved = true; }
    }
    if (moved) { pos.needsUpdate = true; g.computeBoundingSphere(); }
  }
}
const set = Vehicle.prototype.setCockpit;
Vehicle.prototype.setCockpit = function (on) {
  try { fit(this); } catch (e) { /* (a cabin we can't measure stays as it is) */ }
  return set.call(this, on);
};
