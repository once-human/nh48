// A dog, a cat or a cow knocked down goes down as the body it is, the same way people do (people/ragdoll.js): its
// skeleton becomes points with the weight in the trunk, the trunk (hips, ribs, shoulders) one solid piece, and the
// neck, the head, the tail and each leg hanging off it by joints that only turn so far from how they sit. Gravity
// has it; the road takes it without giving anything back (no bounce), and it slides with the grip fur and hide have on
// tar; what hit it is solid (the bumper takes its legs, a cow comes up onto the bonnet). It used to tip over stiff as
// a statue, rolled onto its side about its feet. One that's only knocked down gets up from where it lies (the legs
// gather under it from the way they fell); one that's dead stays as it fell.
import * as THREE from 'three';

const DT = 1/120, ITER = 6, G0 = 9.81, MU = 0.35, GRIP = 0.75, OUT = 0.7;
// per kind: the bones that make the solid trunk (the first is the skeleton's own root), the front and back leg roots
// (which way the trunk faces), its weight, and how thick its parts are
const KIND = {
  dog: { trunk: ['Bone', 'Bone.001', 'Bone.002', 'Bone.004', 'Bone.008', 'Bone.011', 'Bone.014', 'Bone.017'], front: ['Bone.014', 'Bone.017'], back: ['Bone.008', 'Bone.011'], head: 'Bone.003', mass: 25, r: 0.045 },
  cat: { trunk: ['Bone', 'Bone.001', 'Bone.002', 'Bone.004', 'Bone.008', 'Bone.011', 'Bone.014', 'Bone.017'], front: ['Bone.014', 'Bone.017'], back: ['Bone.008', 'Bone.011'], head: 'Bone.003', mass: 4, r: 0.025 },
  cow: { trunk: ['Body', 'Back', 'Hips', 'Torso', 'Shoulders', 'Neck', 'Tail1', 'BackLeg.L', 'BackLeg.R', 'FrontLeg.L', 'FrontLeg.R'], front: ['FrontLeg.L', 'FrontLeg.R'], back: ['BackLeg.L', 'BackLeg.R'], head: 'Head', mass: 420, r: 0.12 },
};
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const _a = new V3(), _b = new V3(), _c = new V3(), _s = new V3(), _q = new Q(), _q2 = new Q(), _M = new THREE.Matrix4(), _X = new V3(), _Y = new V3(), _Z = new V3();
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const smooth = (t) => { t = clamp(t, 0, 1); return t*t*(3 - 2*t); };
export const kindOf = (a) => a.cow || a.kind === 'cow' ? 'cow' : a.kind === 'cat' ? 'cat' : 'dog';

// the trunk's way round, from its leg roots: forward (back to front), and across
function trunkQ(R, out) {
  const P = R.p, K = R.K, f = (l, c) => (P[l[0]*3 + c] + P[l[1]*3 + c])/2;
  _X.set(f(K.fi, 0) - f(K.bi, 0), f(K.fi, 1) - f(K.bi, 1), f(K.fi, 2) - f(K.bi, 2));
  if (_X.lengthSq() < 1e-10) _X.set(1, 0, 0); _X.normalize();
  _Z.set(P[K.fi[0]*3] - P[K.fi[1]*3] + P[K.bi[0]*3] - P[K.bi[1]*3], P[K.fi[0]*3 + 1] - P[K.fi[1]*3 + 1] + P[K.bi[0]*3 + 1] - P[K.bi[1]*3 + 1], P[K.fi[0]*3 + 2] - P[K.fi[1]*3 + 2] + P[K.bi[0]*3 + 2] - P[K.bi[1]*3 + 2]);
  _Z.addScaledVector(_X, -_Z.dot(_X)); if (_Z.lengthSq() < 1e-10) _Z.set(0, 0, 1); _Z.normalize();
  _Y.crossVectors(_Z, _X);
  _M.makeBasis(_X, _Y, _Z); return out.setFromRotationMatrix(_M);
}

export function startAnimalRag(m, a, o = {}) {
  const kind = kindOf(a), K0 = KIND[kind]; if (!m || !m.root) return null;
  m.holder.updateMatrixWorld(true);
  const rootB = m.root.getObjectByName(K0.trunk[0]); if (!rootB || !rootB.isBone) return null;
  // every bone of it, parents first, and a point for each (and one at the tip of each bone with nothing beyond it)
  const B = [], idx = new Map(), pts = [];
  rootB.traverse((b) => { if (!b.isBone) return; idx.set(b, B.length); B.push({ b, name: b.name, i: pts.length, par: null, kids: [] }); b.getWorldPosition(_a); pts.push(_a.x, _a.y, _a.z); });
  for (const r of B) { const pi = r.b.parent && idx.get(r.b.parent); if (pi !== undefined) { r.par = B[pi]; B[pi].kids.push(r); } }
  const trunk = new Set(K0.trunk), find = (n) => B.find(r => r.name === n);
  for (const r of B) r.trunk = trunk.has(r.name);
  for (const r of B) {
    if (r.kids.length) { r.ci = (r.kids.find(k => !k.trunk) || r.kids[0]).i; continue; }
    // a tip: along the bone (a bone points down its own y), half as long again as the one before it
    const L = r.par ? Math.hypot(pts[r.i*3] - pts[r.par.i*3], pts[r.i*3 + 1] - pts[r.par.i*3 + 1], pts[r.i*3 + 2] - pts[r.par.i*3 + 2])*0.6 : 0.1;
    r.b.getWorldQuaternion(_q); _a.set(0, 1, 0).applyQuaternion(_q);
    r.ci = pts.length/3; r.tip = true; pts.push(pts[r.i*3] + _a.x*L, pts[r.i*3 + 1] + _a.y*L, pts[r.i*3 + 2] + _a.z*L);
  }
  const N = pts.length/3, p = new Float64Array(pts), q = new Float64Array(pts);
  // the weight: most of it in the trunk
  const nT = B.filter(r => r.trunk).length, mass = new Float64Array(N).fill(K0.mass*0.3/Math.max(1, N - nT));
  for (const r of B) if (r.trunk) mass[r.i] = K0.mass*0.7/nT;
  const w = mass.map(x => 1/x);
  // the bones: each from its parent's point, each tip from its bone's; the trunk braced every way so it's solid
  const links = [];
  const dist = (i, j) => Math.hypot(p[i*3] - p[j*3], p[i*3 + 1] - p[j*3 + 1], p[i*3 + 2] - p[j*3 + 2]);
  for (const r of B) { if (r.par && !(r.trunk && r.par.trunk)) links.push([r.par.i, r.i, dist(r.par.i, r.i)]); if (r.tip) links.push([r.i, r.ci, dist(r.i, r.ci)]); }
  const T = B.filter(r => r.trunk);
  for (let x = 0; x < T.length; x++) for (let y = x + 1; y < T.length; y++) { const d = dist(T[x].i, T[y].i); if (d > 1e-3) links.push([T[x].i, T[y].i, d]); }
  // how each bone lay, the way it pointed and its turn, and how far it may swing from that as its parent goes
  const K = { fi: K0.front.map(n => find(n).i), bi: K0.back.map(n => find(n).i) };
  const R = { kind, K, B, N, p, q, w, links, gy: new Float64Array(N), rad: K0.r, t: 0, acc: 0, still: 0, sleep: false, out: -1, car: null, sub: 1 };
  R.T0 = trunkQ(R, new Q()).invert();
  for (const r of B) {
    r.b.getWorldQuaternion(r.Q0 = new Q());
    r.d0 = new V3(p[r.ci*3] - p[r.i*3], p[r.ci*3 + 1] - p[r.i*3 + 1], p[r.ci*3 + 2] - p[r.i*3 + 2]).normalize();
    r.lim = r.name === K0.head || r.par?.name === K0.head ? 0.6 : r.par && r.par.trunk ? 1.0 : 1.2;
    r.D = new Q();
  }
  // moving as it was
  const vx = o.vx || 0, vz = o.vz || 0;
  for (let i = 0; i < N; i++) { q[i*3] = p[i*3] - vx*DT; q[i*3 + 2] = p[i*3 + 2] - vz*DT; }
  if (o.V) { const S = o.S || {}, M = o.M || S.mass || (S.two ? 260 : 1200); R.car = { V: o.V, S, top: o.top, x: o.V.x, z: o.V.z, th: o.V.th, k: M/(M + K0.mass) }; }
  a._arag = R;
  return R;
}

// each bone's turn from how it lay: the trunk's from its leg roots, each other bone its parent's and then swung to point
// where its own points say. (con: also keep it inside its range by moving the far point)
function turns(R, con) {
  const p = R.p;
  trunkQ(R, _q2).multiply(R.T0);
  for (const r of R.B) {
    if (r.trunk) { r.D.copy(_q2); continue; }
    const Dp = r.par ? r.par.D : _q2;
    _a.copy(r.d0).applyQuaternion(Dp);
    _b.set(p[r.ci*3] - p[r.i*3], p[r.ci*3 + 1] - p[r.i*3 + 1], p[r.ci*3 + 2] - p[r.i*3 + 2]);
    const L = _b.length(); if (L < 1e-6) { r.D.copy(Dp); continue; }
    _b.multiplyScalar(1/L);
    if (con) {
      const ang = Math.acos(clamp(_a.dot(_b), -1, 1));
      if (ang > r.lim) {
        // back to the edge of its range, the far end moved (shared by the weights of the two ends)
        _c.crossVectors(_a, _b); if (_c.lengthSq() > 1e-10) {
          _c.normalize(); _q.setFromAxisAngle(_c, r.lim); _s.copy(_a).applyQuaternion(_q);
          const tx = p[r.i*3] + _s.x*L, ty = p[r.i*3 + 1] + _s.y*L, tz = p[r.i*3 + 2] + _s.z*L, wa = R.w[r.i], wb = R.w[r.ci], k = 0.5/(wa + wb);
          const dx = tx - p[r.ci*3], dy = ty - p[r.ci*3 + 1], dz = tz - p[r.ci*3 + 2];
          p[r.ci*3] += dx*wb*k*2; p[r.ci*3 + 1] += dy*wb*k*2; p[r.ci*3 + 2] += dz*wb*k*2;
          p[r.i*3] -= dx*wa*k; p[r.i*3 + 1] -= dy*wa*k; p[r.i*3 + 2] -= dz*wa*k;
          _b.copy(_s);
        }
      }
    }
    r.D.setFromUnitVectors(_a, _b).multiply(Dp);
  }
}

const carAt = (R, k) => { const C = R.car, V = C.V; return [C.x + (V.x - C.x)*k, C.z + (V.z - C.z)*k, C.th + Math.atan2(Math.sin(V.th - C.th), Math.cos(V.th - C.th))*k]; };
const vm = [0, 0, 0];
function step(R) {
  const p = R.p, q = R.q, N = R.N, w = R.w, r = R.rad;
  for (let i = 0; i < N*3; i++) { const x = p[i], v = (x - q[i])*0.998; q[i] = x; p[i] = x + v + (i%3 === 1 ? -G0*DT*DT : 0); }
  const C = R.car;
  let cx, cz, th, hx, hz, fr, L2, W2, gy, cvx, cvz;
  if (C && R.carOn) { [cx, cz, th] = carAt(R, R.sub); hx = Math.cos(th); hz = Math.sin(th); fr = Math.sign(C.V.v || 1); L2 = (C.S.L || 4)/2; W2 = (C.S.W || 1.7)/2; gy = C.gy; cvx = (C.V.v || 0)*hx*DT; cvz = (C.V.v || 0)*hz*DT; }
  for (let it = 0; it < ITER; it++) {
    for (const [a, b, len] of R.links) {
      const A = a*3, Bq = b*3, dx = p[Bq] - p[A], dy = p[Bq + 1] - p[A + 1], dz = p[Bq + 2] - p[A + 2], d = Math.hypot(dx, dy, dz) || 1e-6, e = (d - len)/d/(w[a] + w[b]);
      p[A] += dx*e*w[a]; p[A + 1] += dy*e*w[a]; p[A + 2] += dz*e*w[a]; p[Bq] -= dx*e*w[b]; p[Bq + 1] -= dy*e*w[b]; p[Bq + 2] -= dz*e*w[b];
    }
    turns(R, true);
    for (let i = 0; i < N; i++) { const g = R.gy[i] + r; if (p[i*3 + 1] < g) p[i*3 + 1] = g; }
  }
  let touching = 0;
  for (let i = 0; i < N; i++) {
    const j = i*3;
    // what hit it: put back outside on the side it came in by, and moving off that side no faster than it's moving
    // (people/ragdoll.js does the same, for the same reason: nothing is thrown by being put back)
    if (C && R.carOn) {
      const rx = p[j] - cx, rz = p[j + 2] - cz, la = rx*hx + rz*hz, lc = -rx*hz + rz*hx, l2 = L2 + r, w2 = W2 + r;
      if (Math.abs(la) < l2 && Math.abs(lc) < w2) {
        const top = gy + C.top(fr*la/L2) + r;
        if (p[j + 1] < top && p[j + 1] > gy - 0.2) {
          const qx = q[j] - cx + cvx, qz = q[j + 2] - cz + cvz, la0 = qx*hx + qz*hz, lc0 = -qx*hz + qz*hx, top0 = gy + C.top(clamp(fr*la0/L2, -1, 1)) + r;
          const dTop = top - p[j + 1], dF = l2 - fr*la, dB = l2 + fr*la, dS = w2 - Math.abs(lc);
          let face;
          if (q[j + 1] >= top0 - 0.03 || dTop < 0.06) face = 0;
          else if (fr*la0 >= l2 - 0.02) face = 1;
          else if (Math.abs(lc0) >= w2 - 0.02) face = 3;
          else if (-fr*la0 >= l2 - 0.02) face = 2;
          else { const m = Math.min(dF, dB, dS*1.6); face = m === dF ? 1 : m === dB ? 2 : 3; }
          let vx = p[j] - q[j], vy = p[j + 1] - q[j + 1], vz = p[j + 2] - q[j + 2], nx = 0, ny = 0, nz = 0, d = 0, us = 0;
          const cs = Math.hypot(cvx, cvz);
          if (face === 0) { ny = 1; d = dTop; us = Math.min(Math.max(0, top - top0)*0.6, (0.22*cs/DT + 0.4)*DT); }
          else if (face === 1) { nx = hx*fr; nz = hz*fr; d = dF; us = cs*C.k; }
          else if (face === 2) { nx = -hx*fr; nz = -hz*fr; d = dB; }
          else { const sg = Math.sign(lc) || 1; nx = -hz*sg; nz = hx*sg; d = dS; }
          p[j] += nx*d; p[j + 1] += ny*d; p[j + 2] += nz*d;
          const vn = vx*nx + vy*ny + vz*nz, jn = Math.max(0, us - vn);
          vx += nx*jn; vy += ny*jn; vz += nz*jn;
          const rx2 = vx - cvx*C.k, rz2 = vz - cvz*C.k, rn = rx2*nx + rz2*nz, tx = rx2 - rn*nx, tz = rz2 - rn*nz, tl = Math.hypot(tx, tz);
          if (tl > 1e-9) { const k = Math.min(tl, MU*(jn + (face === 3 ? Math.min(d, cs)*0.3 : 0)))/tl; vx -= tx*k; vz -= tz*k; }
          q[j] = p[j] - vx; q[j + 1] = p[j + 1] - vy; q[j + 2] = p[j + 2] - vz;
        }
      }
    }
    // the road: no bounce, and it slides to a stop
    const g = R.gy[i] + r;
    if (p[j + 1] <= g + 0.004) {
      touching++;
      if (p[j + 1] < g) p[j + 1] = g;
      let vx = p[j] - q[j], vz = p[j + 2] - q[j + 2], vy = p[j + 1] - q[j + 1];
      if (vy > 0) vy = 0;
      const v = Math.hypot(vx, vz), dv = GRIP*G0*DT*DT;
      if (v > dv) { vx -= vx/v*dv; vz -= vz/v*dv; } else { vx = 0; vz = 0; }
      q[j] = p[j] - vx; q[j + 1] = p[j + 1] - vy; q[j + 2] = p[j + 2] - vz;
    }
  }
  // its limbs go with it more than against it, and much more so once it's down
  let M = 0; vm[0] = vm[1] = vm[2] = 0;
  for (let i = 0; i < N; i++) { const m = 1/w[i]; M += m; for (let c = 0; c < 3; c++) vm[c] += (p[i*3 + c] - q[i*3 + c])*m; }
  for (let c = 0; c < 3; c++) vm[c] /= M;
  const keep = touching >= N*0.3 ? 0.965 : touching >= 2 ? 0.985 : 0.995;
  for (let i = 0; i < N*3; i++) { const v = p[i] - q[i], c = i%3; q[i] = p[i] - (vm[c] + (v - vm[c])*keep); }
}

export function tickAnimalRag(R, dt, W) {
  const surf = W && W.surf, col = W && W.collision, p = R.p, q = R.q;
  for (let i = 0; i < R.N; i++) {
    const j = i*3; if (surf) R.gy[i] = surf.height(p[j], p[j + 2]);
    if (col && p[j + 1] - R.gy[i] < 2.2) { const r = col.resolve(p[j], p[j + 2], R.rad + 0.05); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { p[j] += r.nx*r.depth; p[j + 2] += r.nz*r.depth; const vn = (p[j] - q[j])*r.nx + (p[j + 2] - q[j + 2])*r.nz; if (vn < 0) { q[j] += vn*r.nx; q[j + 2] += vn*r.nz; } } }
  }
  const C = R.car;
  if (C) {
    C.gy = surf ? surf.height(C.V.x, C.V.z) : 0;
    const r0 = R.B[0].i;
    R.carOn = R.t < 3 && (R.t < 0.25 || p[r0*3 + 1] - R.gy[r0] > 0.42*(R.kind === 'cow' ? 2.2 : 1));
    if (R.t >= 3) R.car = null;
  }
  R.acc = Math.min(R.acc + dt, DT*8);
  const n = Math.floor(R.acc/DT);
  for (let s = 0; s < n; s++) { R.sub = (s + 1)/n; step(R); }
  R.acc -= n*DT; R.t += n*DT;
  if (C && R.car) { C.x = C.V.x; C.z = C.V.z; C.th = C.V.th; }
  let mx = 0; for (let i = 0; i < R.N*3; i++) mx = Math.max(mx, Math.abs(p[i] - q[i]));
  R.still = mx/DT < 0.1 && n > 0 ? R.still + dt : n > 0 ? 0 : R.still;
  if ((R.still > 0.4 && R.t > 1) || R.t > 10) R.sleep = true;
}

// where it lies: its root, and the way its trunk faces (the model is kept there, so it's drawn where it is)
export function where(R) {
  const P = R.p, K = R.K, i = R.B[0].i, f = (l, c) => (P[l[0]*3 + c] + P[l[1]*3 + c])/2;
  return { x: P[i*3], z: P[i*3 + 2], yaw: Math.atan2(f(K.fi, 2) - f(K.bi, 2), f(K.fi, 0) - f(K.bi, 0)) };
}

// the bones from the points
function poseNow(m, R) {
  turns(R, false);
  const root = R.B[0].b;
  for (const r of R.B) {
    const b = r.b; b.parent.updateMatrixWorld(true);
    b.parent.matrixWorld.decompose(_a, _q, _s);
    _q2.copy(r.D).multiply(r.Q0); b.quaternion.copy(_q.invert().multiply(_q2));
    if (b === root) { _a.set(R.p[r.i*3], R.p[r.i*3 + 1], R.p[r.i*3 + 2]); _M.copy(b.parent.matrixWorld).invert(); b.position.copy(_a.applyMatrix4(_M)); }
    b.updateMatrixWorld(true);
  }
}

// every frame it's down (from people/animals.js, in place of its clip): run it, keep the model where the body is, pose it.
// Getting up: the clip takes the bones back from where they lay, over a moment
window.__nhARag = (m, a, dt, W) => {
  const R = a._arag;
  if (!R || !a.dead && R.out < 0) { a._arag = null; m.mixer.update(dt); return; }
  if (R.out >= 0) {
    const k = smooth((performance.now() - R.out)/(OUT*1000));
    m.mixer.update(dt);
    for (const r of R.B) { const s = R.saved.get(r.b); if (s) r.b.quaternion.copy(s.q).slerp(_q.copy(r.b.quaternion), k); if (r === R.B[0] && s) r.b.position.lerpVectors(s.p, _a.copy(r.b.position), k); }
    if (k >= 1) a._arag = null;
    return;
  }
  if (!R.sleep && dt > 0) tickAnimalRag(R, dt, W);
  const o = where(R); a.x = o.x; a.z = o.z; a.yaw = o.yaw; a.hx = Math.cos(o.yaw); a.hz = Math.sin(o.yaw);
  m.holder.position.set(o.x, W && W.surf ? W.surf.height(o.x, o.z) : 0, o.z); m.holder.rotation.set(0, -o.yaw, 0);
  m.holder.updateMatrixWorld(true);
  poseNow(m, R);
};
// up again: from here the clip has it back
export function releaseAnimalRag(a) {
  const R = a._arag; if (!R || R.out >= 0) return;
  R.out = performance.now(); R.saved = new Map();
  for (const r of R.B) R.saved.set(r.b, { q: r.b.quaternion.clone(), p: r.b.position.clone() });
}
