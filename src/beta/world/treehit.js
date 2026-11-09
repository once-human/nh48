// A tree struck and still standing. Every tree feels it: the whole crown sways off the blow and back, slow for a big
// one (its weight's up in the crown, so it swings at half a beat a second, longer the taller it is) with a quick
// shudder through the branches on top of that, and leaves come down out of it, more the harder it was hit, fluttering
// side to side as they fall and lying where they land; hit hard, twigs and a few small branches drop. Where the
// bumper or the shoulder met it the bark's torn off, the pale wood under it showing, ragged at the edges, worse the
// harder. A big old trunk takes all that; only something enormous (a bus, a car at a speed nothing should be doing
// on a street) cracks it, and then it leans for good, split at the foot, and past that it goes over (world/smash.js
// fell). The leaves and the bark stay as they are until the street's been left a while and nobody's looking.
import * as THREE from 'three';
import { ColorBuilder } from '@orig/world/geo.js';
import { hash1 } from '@orig/core/util.js';
import { pieceOf } from './debris.js';
import { FX } from './smashfx.js';

const G0 = 9.81, _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
const hsh = (n) => { const s = Math.sin(n*12.9898 + 78.233)*43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- the blow
export function shake(X, r, o, tot) {
  const T = X.W.trees, t = r.ti, S = X.spec(r); if (!T || t == null) return;
  const k = T.k[t], A = T.arch[k], s = T.s[t], H = Math.max(3, (A.H || 10)*s), M = S.mass*2.5;
  const f = 1.05/Math.sqrt(H/6), w = 2*Math.PI*f, I = M*H*H/3;
  const th = Math.min(0.07, Math.sqrt(2*0.03*o.E/(I*w*w)));
  const SW = T.sway || (T.sway = new Map());
  let q = SW.get(t);
  if (!q) SW.set(t, q = { ax: 0, az: 0, vx: 0, vz: 0, bx: 0, bz: 0, ux: 0, uz: 0, rx: 0, rz: 0, w, z: 0.08, w2: w*3.4, slot: null, x: T.x[t], y: 0.12 + T.y[t], z0: T.z[t] });
  q.done = false; q.vx += o.nx*th*w; q.vz += o.nz*th*w;
  q.ux += o.nx*th*0.5*q.w2; q.uz += o.nz*th*0.5*q.w2;
  // cracked through at the foot: it leans away from the blow for good
  const big = (r.tr || 0.15) >= 0.21;
  if (big && tot > S.crk && o.by === 'car' && !r.cracked) {
    r.cracked = true; const a = Math.min(0.09, 0.03 + (tot - S.crk)/(S.brk - S.crk)*0.07);
    q.rx += o.nx*a; q.rz += o.nz*a; r.st = 1;
    FX.brk('split', r.x, q.y + 0.6, r.z, 1);
  }
  X.down.add(r); r.tb = X.t; r.marks = true;
  // what comes down out of it
  const crown = crownOf(T, t), nLeaf = Math.round(Math.min(140, Math.max(o.by === 'shot' ? 2 : 4, th*2600)));
  X.leaves.drop(r, crown, nLeaf, o.nx, o.nz, k);
  if (o.E > 3e3) twigs(X, r, crown, Math.min(7, Math.floor(o.E/5e3) + 1), o);
  if (o.by === 'car' && o.E > 1.2e3) scar(X, r, T, t, o);
  FX.brk('trunk', o.px, o.py, o.pz, Math.min(1, 0.3 + o.E/2e4));
  FX.brk('rustle', r.x, q.y + H*0.6, r.z, Math.min(1.3, 0.2 + th*25));
}
// the crown's box, in the world: where leaves come from
function crownOf(T, t) {
  const k = T.k[t], A = T.arch[k], s = T.s[t], L = A.near.l, bb = L.boundingBox || (L.computeBoundingBox(), L.boundingBox);
  const sx = s*(0.92 + hash1(t*3.3)*0.16), sy = s*(0.9 + hash1(t*5.1)*0.2), r = T.r[t], c = Math.cos(r), sn = Math.sin(r);
  const cx = (bb.min.x + bb.max.x)/2*sx, cz = (bb.min.z + bb.max.z)/2*sx;
  return { x: T.x[t] + c*cx + sn*cz, z: T.z[t] - sn*cx + c*cz, y0: 0.12 + T.y[t] + bb.min.y*sy, y1: 0.12 + T.y[t] + bb.max.y*sy, hx: (bb.max.x - bb.min.x)/2*sx, hz: (bb.max.z - bb.min.z)/2*sx };
}
// twigs and small branches with their leaves, as bodies
function twigs(X, r, C, n, o) {
  for (let i = 0; i < n; i++) {
    const cb = new ColorBuilder(), L = 0.25 + hsh(i + r.x)*0.6, br = [0.32, 0.24, 0.16];
    cb.addGeo(new THREE.CylinderGeometry(0.008, 0.014, L, 5), _m.makeRotationZ(Math.PI/2), br);
    for (let j = 0; j < 3; j++) cb.addGeo(new THREE.CylinderGeometry(0.004, 0.007, L*0.4, 4), _m.compose(_v.set((j - 1)*L*0.3, 0.04, 0), _q.setFromEuler(_e.set(0.6*(j - 1), 0, 0.9)), _s), br);
    for (let j = 0; j < 6; j++) cb.addGeo(new THREE.PlaneGeometry(0.07, 0.04), _m.compose(_v.set((hsh(j + i) - 0.5)*L, 0.03 + hsh(j*3)*0.06, (hsh(j*7) - 0.5)*0.08), _q.setFromEuler(_e.set(hsh(j)*3, hsh(j + 1)*3, 0)), _s), j % 2 ? [0.2, 0.33, 0.12] : [0.26, 0.4, 0.14]);
    const g = cb.build(), pc = pieceOf(g, [{ tris: [...Array(g.index ? g.index.count/3 : g.attributes.position.count/3).keys()] }]);
    const a = hsh(i*5 + r.z)*6.283, rr = 0.3 + hsh(i*7)*0.6;
    const b = X.body(r, pc, _m.makeTranslation(C.x + Math.cos(a)*C.hx*rr, C.y0 + (C.y1 - C.y0)*(0.1 + hsh(i*11)*0.4), C.z + Math.sin(a)*C.hz*rr), 0.15 + L*0.5, 'wood', {});
    b.v.set(o.nx*0.8 + (hsh(i) - 0.5), -0.2, o.nz*0.8 + (hsh(i + 2) - 0.5)); b.w.set(hsh(i)*4 - 2, hsh(i + 1)*4 - 2, hsh(i + 2)*4 - 2);
  }
}
// the bark torn off where it was struck: the pale wood, its edge ragged, a few shreds hanging
function scar(X, r, T, t, o) {
  const k = T.k[t], A = T.arch[k], s = T.s[t], tr = A.trunkR*s, y0 = 0.12 + T.y[t];
  const cx = T.x[t], cz = T.z[t], a0 = Math.atan2(-o.nz, -o.nx), sev = Math.min(1, o.E/3e4);
  const yc = Math.max(y0 + 0.25, Math.min(y0 + 1.1, o.py)), hh = 0.12 + sev*0.35, span = 0.35 + sev*0.6, cb = new ColorBuilder(), N = 9;
  const P = (a, y, d) => { const R = tr*(1.02 - 0.08*(y - y0)/Math.max(1, A.H*s)) + d; return [cx + Math.cos(a)*R, y, cz + Math.sin(a)*R]; };
  const rim = [], wood = [0.8, 0.67, 0.48], torn = [0.36, 0.27, 0.18];
  for (let i = 0; i < N; i++) { const u = i/N*6.283, j = 0.75 + hsh(i + r.x*3)*0.45; rim.push([Math.cos(u)*span*0.5*j, Math.sin(u)*hh*j]); }
  const tri = (p0, p1, p2, c) => { const n0 = [p0[0] - cx, 0, p0[2] - cz], l = Math.hypot(n0[0], n0[2]) || 1, i0 = cb.v(...p0, n0[0]/l, 0, n0[2]/l, ...c); cb.v(...p1, n0[0]/l, 0, n0[2]/l, ...c); cb.v(...p2, n0[0]/l, 0, n0[2]/l, ...c); cb.i.push(i0, i0 + 1, i0 + 2); };
  const C = P(a0, yc, 0.004);
  for (let i = 0; i < N; i++) {
    const p = rim[i], q = rim[(i + 1)%N];
    tri(C, P(a0 + p[0], yc + p[1], 0.004), P(a0 + q[0], yc + q[1], 0.004), wood.map(v => v*(0.9 + hsh(i)*0.15)));
    // the torn edge, a little proud of it
    const p2 = [p[0]*1.18, p[1]*1.18], q2 = [q[0]*1.18, q[1]*1.18];
    tri(P(a0 + p[0], yc + p[1], 0.007), P(a0 + p2[0], yc + p2[1], 0.012), P(a0 + q2[0], yc + q2[1], 0.012), torn);
    tri(P(a0 + p[0], yc + p[1], 0.007), P(a0 + q2[0], yc + q2[1], 0.012), P(a0 + q[0], yc + q[1], 0.007), torn);
  }
  // a few strips of bark hanging off its lower edge
  for (let i = 0; i < 2 + Math.round(sev*3); i++) { const u = (hsh(i*3 + r.z) - 0.5)*span*0.8, L = 0.06 + hsh(i)*0.12*(1 + sev); tri(P(a0 + u - 0.03, yc - hh*0.7, 0.01), P(a0 + u + 0.03, yc - hh*0.7, 0.01), P(a0 + u + 0.005, yc - hh*0.7 - L, 0.03), torn); }
  const m = new THREE.Mesh(cb.build(), X.W.mats.prop); m.receiveShadow = true; m.matrixAutoUpdate = false; X.W.scene.add(m); r.meshes.push(m);
}

// ---------------------------------------------------------------- every frame: the crowns swaying back
export function treeStep(X, dt) {
  const T = X.W.trees, SW = T && T.sway; if (!SW || !SW.size) return;
  for (const [t, q] of SW) {
    if (q.done) continue;
    const n = Math.max(1, Math.ceil(dt*q.w2/0.4)), h = dt/n;
    for (let k = 0; k < n; k++) {
      q.vx += (-q.w*q.w*q.ax - 2*q.z*q.w*q.vx)*h; q.vz += (-q.w*q.w*q.az - 2*q.z*q.w*q.vz)*h; q.ax += q.vx*h; q.az += q.vz*h;
      q.ux += (-q.w2*q.w2*q.bx - 2*0.16*q.w2*q.ux)*h; q.uz += (-q.w2*q.w2*q.bz - 2*0.16*q.w2*q.uz)*h; q.bx += q.ux*h; q.bz += q.uz*h;
    }
    const still = Math.abs(q.ax) + Math.abs(q.az) + Math.abs(q.bx) + Math.abs(q.bz) < 2e-4 && Math.abs(q.vx) + Math.abs(q.vz) + Math.abs(q.ux) + Math.abs(q.uz) < 2e-3;
    if (still) { q.ax = q.az = q.vx = q.vz = q.bx = q.bz = q.ux = q.uz = 0; }
    if (q.slot) { const [k, i] = q.slot, set = T.sets[k], a = set.nb.instanceMatrix; T.tiltAt(a.array, i*16, t, q); a.addUpdateRange(i*16, 16); a.needsUpdate = true; }
    if (still) { if (q.rx || q.rz) q.done = true; else SW.delete(t); }
  }
}
// a tree with a lean or a sway: its matrix (laid out upright at o) turned about its foot
export function tilt(a, o, q, moving) {
  const x = q.rx + (moving ? q.ax + q.bx : 0), z = q.rz + (moving ? q.az + q.bz : 0), ang = Math.hypot(x, z); if (ang < 1e-6) return;
  _m.makeRotationAxis(_v.set(z, 0, -x).normalize(), ang);
  const R = _m.elements;
  for (let c = 0; c < 3; c++) {
    const m0 = a[o + c*4], m1 = a[o + c*4 + 1], m2 = a[o + c*4 + 2];
    a[o + c*4] = R[0]*m0 + R[4]*m1 + R[8]*m2; a[o + c*4 + 1] = R[1]*m0 + R[5]*m1 + R[9]*m2; a[o + c*4 + 2] = R[2]*m0 + R[6]*m1 + R[10]*m2;
  }
}

// ---------------------------------------------------------------- leaves
// every leaf shaken out, falling as a leaf falls (slow, swinging from side to side, turning over), then lying flat
// where it came down. Three greens and a dry one, each a set of its own
const CAP = 700;
export class Leaves {
  constructor(W) {
    this.W = W; this.sets = []; this.n = 0; this.list = [];
    const COL = [[0.22, 0.34, 0.12], [0.3, 0.42, 0.14], [0.17, 0.27, 0.1], [0.5, 0.42, 0.18]];
    for (const c of COL) {
      const cb = new ColorBuilder();
      // a leaf: a little diamond, bent along its middle
      const p = [[0, 0.004, -0.045], [0.022, 0, 0], [0, 0.004, 0.045], [-0.022, 0, 0]];
      for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) { const b0 = cb.v(...p[i], 0, 1, 0, ...c); cb.v(...p[j], 0, 1, 0, ...c); cb.v(...p[k], 0, 1, 0, ...c); cb.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 1); }
      const im = new THREE.InstancedMesh(cb.build(), W.mats.propI || W.mats.prop, CAP); im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
      W.scene.add(im); this.sets.push({ im, items: [] });
    }
  }
  drop(r, C, n, nx, nz, k) {
    for (let i = 0; i < n; i++) {
      const s = this.sets[(i + k) % 4 === 3 && hsh(i + r.x) < 0.6 ? 3 : (i + k) % 3]; if (s.items.length >= CAP) continue;
      const h = (j) => hsh(i*7.1 + j + r.x*0.37 + this.n*0.013), a = h(1)*6.283, rr = Math.sqrt(h(2));
      const L = { r, p: new THREE.Vector3(C.x + Math.cos(a)*C.hx*rr*0.9, C.y0 + (C.y1 - C.y0)*(0.15 + h(3)*0.8), C.z + Math.sin(a)*C.hz*rr*0.9),
        v: new THREE.Vector3(nx*(0.4 + h(4)*0.8) + (h(5) - 0.5)*0.6, (h(6) - 0.3)*0.8, nz*(0.4 + h(4)*0.8) + (h(7) - 0.5)*0.6),
        ph: h(8)*6.283, fr: 1.2 + h(9)*1.4, sw: 0.4 + h(10)*0.6, vt: 0.7 + h(11)*0.7, yaw: h(12)*6.283, spin: (h(13) - 0.5)*5, down: false };
      s.items.push(L); this.n++;
    }
    this.dirty = true;
  }
  remove(r) { for (const s of this.sets) s.items = s.items.filter(L => L.r !== r); this.dirty = true; }
  step(dt) {
    if (!this.n) return;
    const S = this.W.surf;
    for (const s of this.sets) {
      if (!s.items.length && !s.im.count) continue;
      let moved = this.dirty, i = 0;
      for (const L of s.items) {
        if (!L.down) {
          moved = true;
          // drag takes it to its slow fall; it swings across, turning
          const kd = Math.min(1, dt*5);
          L.v.y += (-L.vt - L.v.y)*kd - G0*dt*0.15; L.v.x *= 1 - kd*0.5; L.v.z *= 1 - kd*0.5;
          L.ph += L.fr*6.283*dt; L.yaw += L.spin*dt;
          const sx = Math.cos(L.ph)*L.sw;
          L.p.x += (L.v.x + Math.cos(L.yaw)*sx)*dt; L.p.z += (L.v.z + Math.sin(L.yaw)*sx)*dt; L.p.y += (L.v.y - Math.abs(Math.sin(L.ph))*0.15)*dt;
          const g = (S ? S.height(L.p.x, L.p.z) : 0) + 0.006;
          if (L.p.y <= g) { L.p.y = g; L.down = true; L.ph = (hsh(L.yaw)*0.3 - 0.15); }
        }
        const tilt = L.down ? L.ph : Math.sin(L.ph)*0.9;
        _q.setFromEuler(_e.set(tilt, L.yaw, L.down ? 0 : Math.cos(L.ph)*0.5, 'YXZ'));
        _m.compose(L.p, _q, _s); s.im.setMatrixAt(i++, _m);
      }
      if (moved || s.im.count !== i) { s.im.count = i; s.im.instanceMatrix.needsUpdate = true; }
    }
    this.dirty = false;
  }
}
