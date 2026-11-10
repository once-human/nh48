// world/facing.js for /beta: a big mesh of flat faces (a landmark's walls, every stone its own block) has most of its
// triangles looking away from you at any moment: the far walls, the tops of the courses above your eyes, the end of each
// block you're not on the side of. The graphics chip throws those away, but only after doing the work of placing them.
// Here the mesh's triangles are put in order by the way they face and how far along that way they sit, so each frame
// the ones that can't be facing you are simply not sent. The picture is the same to the pixel. Only your own view does
// it; the sun leaves out the whole of a direction it can't see the back of, and every other camera gets everything.
import * as THREE from 'three';
import { view } from './view.js';

const BINS = 2048, LEAST = 60000, MIN = 3000, MOST = 12, EVERY = 24000;
const bin = (d, B) => Math.max(0, Math.min(BINS - 1, Math.floor((d - B.d0)/B.step)));

function pick(r, sc, cam) {
  const F = this.facing, e = this.matrixWorld.elements, c = cam.matrixWorld.elements, side = this.material.side;
  let n = F.n;
  if (e[0] === 1 && e[5] === 1 && e[10] === 1) {
    if (cam === view.cam && side === THREE.FrontSide) {
      const x = c[12] - e[12], y = c[13] - e[13], z = c[14] - e[14], far = Math.hypot(x - F.cx, y - F.cy, z - F.cz) + F.r;
      const b = Math.floor((F.x*x + F.y*y + F.z*z + F.slack*far + .005 - F.d0)/F.step);
      n = b < 0 ? 0 : b >= BINS ? F.n : F.cum[b + 1];
    } else if (cam.isOrthographicCamera && side !== THREE.DoubleSide) {
      const k = -(F.x*c[8] + F.y*c[9] + F.z*c[10]);
      if (side === THREE.BackSide ? k < -F.slack - .002 : k > F.slack + .002) n = 0;
    }
  }
  this.geometry.drawRange.count = n*3;
}

// (a generator, as the builders are: it gives way every few thousand triangles so a landmark arriving doesn't hold a frame)
export function* byFacing(mesh) {
  const g = mesh.geometry, I = g.index && g.index.array, P = g.attributes.position.array, nt = I ? I.length/3 : 0, out = [];
  if (nt < LEAST) return out;
  // each triangle's own facing, from its corners (which is what the chip goes by)
  const of = new Int32Array(nt), by = new Map(), list = [];
  for (let t = 0; t < nt; t++) {
    if (t%EVERY === EVERY - 1) yield;
    const a = I[t*3]*3, b = I[t*3 + 1]*3, c = I[t*3 + 2]*3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let x = uy*vz - uz*vy, y = uz*vx - ux*vz, z = ux*vy - uy*vx; const l = Math.hypot(x, y, z);
    if (!(l > 1e-9)) { of[t] = -1; continue; }
    x /= l; y /= l; z /= l;
    const key = (Math.round(x*256) + 256) + (Math.round(y*256) + 256)*1024 + (Math.round(z*256) + 256)*1048576;
    let B = by.get(key); if (!B) { B = { i: list.length, x, y, z, n: 0, slack: 0 }; by.set(key, B); list.push(B); }
    B.n++; const off = Math.hypot(x - B.x, y - B.y, z - B.z); if (off > B.slack) B.slack = off;
    of[t] = B.i;
  }
  const big = list.filter(B => B.n >= MIN).sort((a, b) => b.n - a.n).slice(0, MOST);
  if (!big.length) return out;
  for (const B of big) { B.on = true; B.d0 = Infinity; B.d1 = -Infinity; B.lo = [Infinity, Infinity, Infinity]; B.hi = [-Infinity, -Infinity, -Infinity]; B.cum = new Uint32Array(BINS + 1); }
  yield;
  // how far along its facing each one sits (its nearest corner), and the room its direction takes up
  const d = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    if (t%EVERY === EVERY - 1) yield;
    const B = of[t] < 0 ? null : list[of[t]]; if (!B || !B.on) continue;
    let m = Infinity;
    for (let k = 0; k < 3; k++) {
      const a = I[t*3 + k]*3, x = P[a], y = P[a + 1], z = P[a + 2], s = B.x*x + B.y*y + B.z*z; if (s < m) m = s;
      if (x < B.lo[0]) B.lo[0] = x; if (y < B.lo[1]) B.lo[1] = y; if (z < B.lo[2]) B.lo[2] = z; if (x > B.hi[0]) B.hi[0] = x; if (y > B.hi[1]) B.hi[1] = y; if (z > B.hi[2]) B.hi[2] = z;
    }
    d[t] = m; m = d[t]; if (m < B.d0) B.d0 = m; if (m > B.d1) B.d1 = m;
  }
  yield;
  let rest = nt; for (const B of big) { rest -= B.n; B.step = Math.max(1e-4, (B.d1 - B.d0)/BINS*1.0001); }
  for (let t = 0; t < nt; t++) { const B = of[t] < 0 ? null : list[of[t]]; if (B && B.on) B.cum[bin(d[t], B) + 1]++; }
  let base = rest; for (const B of big) { B.base = base; base += B.n; for (let i = 0; i < BINS; i++) B.cum[i + 1] += B.cum[i]; B.at = B.cum.slice(0, BINS); }
  yield;
  // the triangles in their new order: what's left over first, then each direction from its nearest to its farthest
  const J = new I.constructor(I.length); let r = 0;
  for (let t = 0; t < nt; t++) {
    if (t%EVERY === EVERY - 1) yield;
    const B = of[t] < 0 ? null : list[of[t]], j = (B && B.on ? B.base + B.at[bin(d[t], B)]++ : r++)*3;
    J[j] = I[t*3]; J[j + 1] = I[t*3 + 1]; J[j + 2] = I[t*3 + 2];
  }
  I.set(J); g.index.needsUpdate = true; g.setDrawRange(0, rest*3);
  for (const B of big) {
    const s = new THREE.BufferGeometry(); for (const k in g.attributes) s.setAttribute(k, g.attributes[k]); s.setIndex(g.index); s.setDrawRange(B.base*3, B.n*3);
    s.boundingBox = new THREE.Box3(new THREE.Vector3(...B.lo), new THREE.Vector3(...B.hi)); s.boundingSphere = s.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(s, mesh.material); m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow; m.layers.mask = mesh.layers.mask; m.renderOrder = mesh.renderOrder; m.name = mesh.name;
    const c = s.boundingSphere.center;
    m.facing = { x: B.x, y: B.y, z: B.z, slack: B.slack, d0: B.d0, step: B.step, cum: B.cum, n: B.n, cx: c.x, cy: c.y, cz: c.z, r: s.boundingSphere.radius };
    m.onBeforeRender = pick; out.push(m);
  }
  return out;
}
