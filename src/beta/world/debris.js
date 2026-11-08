// What a knocked-down thing breaks into: solid pieces, each its own rigid body. Worked out in fixed steps (1/120 s, the
// same as a body falling, people/ragdoll.js), so the same hit on the same step goes the same way every time. Each piece
// is the prop's own parts (a plank, a wheel, a roof sheet, the pole itself), resting on the furthest points of its own
// shape, not on a box round it: a cart lies on its wheels and its roof's edge, a pole along its length. Gravity has
// it, the ground takes it without giving it back (nothing bounces: what lands stays landed), it slides with the grip
// its material has, it rolls and turns only as its weight and the ground make it, walls stop it, and your vehicle is
// solid to it (it's shoved by the bumper, it lies on the roof). Still for a moment, it's asleep and costs nothing until
// something touches it. A steel post that folds over stays fixed at its foot (a pin, with the steel's stiffness
// against it), so it lies in the road from where it stood.
import * as THREE from 'three';

const DT = 1/120, ITER = 6, G0 = 9.81, SLOP = 0.004;
const V3 = THREE.Vector3, _a = new V3(), _b = new V3(), _r = new V3(), _j = new V3(), _t = new V3(), _w = new V3(), _u = new V3(), _u2 = new V3();
const _m3 = new THREE.Matrix3(), _k = new THREE.Matrix3(), _q = new THREE.Quaternion(), _mq = new THREE.Matrix4();
const UP = new V3(0, 1, 0);

// the grip each material has on the road, and how much of its spin the ground lets it keep
export const MU = { steel: 0.45, rcc: 0.7, wood: 0.6, tin: 0.4, glass: 0.5, plastic: 0.45, fruit: 0.7, bamboo: 0.55, cloth: 0.8 };

// ---------------------------------------------------------------- the pieces of a model
// its connected parts: every triangle joined to the ones it shares a corner with (corners at the same spot count as shared:
// a box's faces are separate vertices), each part with its bounds
export function partsOf(geo) {
  if (geo.userData.parts) return geo.userData.parts;
  const P = geo.attributes.position, n = P.count, I = geo.index ? geo.index.array : null, nt = (I ? I.length : n)/3;
  const up = new Int32Array(n); for (let i = 0; i < n; i++) up[i] = i;
  const root = (i) => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
  const join = (a, b) => { a = root(a); b = root(b); if (a !== b) up[a] = b; };
  const weld = new Map(), A = P.array;
  for (let i = 0; i < n; i++) {
    const k = Math.round(A[i*3]*500) + ',' + Math.round(A[i*3 + 1]*500) + ',' + Math.round(A[i*3 + 2]*500), o = weld.get(k);
    if (o === undefined) weld.set(k, i); else join(i, o);
  }
  const vi = (t, c) => I ? I[t*3 + c] : t*3 + c;
  for (let t = 0; t < nt; t++) { join(vi(t, 0), vi(t, 1)); join(vi(t, 0), vi(t, 2)); }
  const by = new Map();
  for (let t = 0; t < nt; t++) {
    const r = root(vi(t, 0)); let p = by.get(r);
    if (!p) by.set(r, p = { tris: [], min: new V3(1e9, 1e9, 1e9), max: new V3(-1e9, -1e9, -1e9) });
    p.tris.push(t);
    for (let c = 0; c < 3; c++) { const v = vi(t, c); _a.fromArray(A, v*3); p.min.min(_a); p.max.max(_a); }
  }
  const out = [...by.values()];
  for (const p of out) { p.c = p.min.clone().add(p.max).multiplyScalar(0.5); p.size = p.max.clone().sub(p.min); }
  geo.userData.parts = out;
  return out;
}
// a piece made of some of those parts, as its own geometry centred on its middle, with the points it rests on
const DIRS = [];
for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) DIRS.push(new V3(x, y*1.0001, z).normalize());
export function pieceOf(geo, parts) {
  const P = geo.attributes.position, I = geo.index ? geo.index.array : null, map = new Map(), idx = [];
  const vi = (t, c) => I ? I[t*3 + c] : t*3 + c;
  for (const p of parts) for (const t of p.tris) for (let c = 0; c < 3; c++) { const v = vi(t, c); let k = map.get(v); if (k === undefined) map.set(v, k = map.size); idx.push(k); }
  const g = new THREE.BufferGeometry(), src = [...map.keys()];
  for (const name in geo.attributes) {
    const a = geo.attributes[name], s = a.itemSize, arr = new a.array.constructor(src.length*s);
    for (let i = 0; i < src.length; i++) for (let c = 0; c < s; c++) arr[i*s + c] = a.array[src[i]*s + c];
    g.setAttribute(name, new THREE.BufferAttribute(arr, s, a.normalized));
  }
  g.setIndex(src.length > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingBox();
  const c = g.boundingBox.getCenter(new V3()), half = g.boundingBox.getSize(new V3()).multiplyScalar(0.5).max(new V3(0.015, 0.015, 0.015));
  g.translate(-c.x, -c.y, -c.z); g.computeBoundingBox(); g.computeBoundingSphere();
  // the furthest of its own points every way round: what it lies on
  const pa = g.attributes.position.array, pts = [];
  for (const d of DIRS) {
    let best = -1e9, bi = 0;
    for (let i = 0; i < pa.length; i += 3) { const s = pa[i]*d.x + pa[i + 1]*d.y + pa[i + 2]*d.z; if (s > best) { best = s; bi = i; } }
    if (!pts.some(q => Math.abs(q.x - pa[bi]) < 0.01 && Math.abs(q.y - pa[bi + 1]) < 0.01 && Math.abs(q.z - pa[bi + 2]) < 0.01)) pts.push(new V3(pa[bi], pa[bi + 1], pa[bi + 2]));
  }
  // a long thing (a pole) rests along its length too, not only at its ends
  const ax = half.x >= half.y && half.x >= half.z ? 'x' : half.y >= half.z ? 'y' : 'z', L = half[ax], th = Math.min(...['x', 'y', 'z'].filter(k => k !== ax).map(k => half[k]));
  if (L > 5*th) for (let k = 1; k < 6; k++) { const u = -L + 2*L*k/6; for (const [s1, s2] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const p = new V3(); p[ax] = u; const o = ['x', 'y', 'z'].filter(q => q !== ax); p[o[0]] = s1*half[o[0]]*0.9; p[o[1]] = s2*half[o[1]]*0.9; pts.push(p); } }
  return { geo: g, c, half, pts, vol: 8*half.x*half.y*half.z };
}

// ---------------------------------------------------------------- the bodies
export class Debris {
  constructor() { this.list = []; this.acc = 0; this.t = 0; this.onLand = null; }
  // o: { mesh, p, q, v, w, m, half, pts, mat, pin (world point of its local pinLocal), pinLocal, stiff }
  add(o) {
    const h = o.half, m = o.m, ix = m*(h.y*h.y + h.z*h.z)/3, iy = m*(h.x*h.x + h.z*h.z)/3, iz = m*(h.x*h.x + h.y*h.y)/3;
    const b = Object.assign({ v: new V3(), w: new V3(), mu: MU[o.mat] ?? 0.5, still: 0, sleep: false, air: 1, sndT: -9, jn: null }, o);
    b.iI = new V3(1/ix, 1/iy, 1/iz); b.im = 1/m;
    b.jn = new Float32Array(b.pts.length);
    this.list.push(b); this.sync(b);
    return b;
  }
  remove(b) { const i = this.list.indexOf(b); if (i >= 0) this.list.splice(i, 1); }
  // world inverse inertia from the body's turn
  iw(b) {
    _mq.makeRotationFromQuaternion(b.q); _m3.setFromMatrix4(_mq);
    const R = _m3.elements, D = b.iI, o = b._Iw || (b._Iw = new THREE.Matrix3()), e = o.elements;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) e[i + j*3] = R[i]*D.x*R[j] + R[i + 3]*D.y*R[j + 3] + R[i + 6]*D.z*R[j + 6];
    return o;
  }
  impulse(b, r, J) { b.v.addScaledVector(J, b.im); _w.crossVectors(r, J).applyMatrix3(b._Iw); b.w.add(_w); }
  // how hard it is to move point r along n
  kn(b, r, n) { _u.crossVectors(r, n).applyMatrix3(b._Iw); return b.im + _u2.crossVectors(_u, r).dot(n); }
  velAt(b, r, out) { return out.crossVectors(b.w, r).add(b.v); }
  // vehicles: [{ x, z, hx, hz, a, b, y0, y1, vx, vz }]
  step(dt, W, cars) {
    this.acc = Math.min(this.acc + dt, 0.1);
    while (this.acc >= DT) { this.acc -= DT; this.t += DT; for (let i = 0; i < this.list.length; i++) this.tick(this.list[i], W, cars); }
    for (const b of this.list) if (!b.sleep || b._dirty) { this.sync(b); b._dirty = false; }
  }
  sync(b) { if (b.mesh) { b.mesh.position.copy(b.p); b.mesh.quaternion.copy(b.q); b.mesh.updateMatrix(); b.mesh.updateMatrixWorld(); } }
  tick(b, W, cars) {
    // something on the move touching it wakes it
    if (b.sleep) {
      let near = false;
      for (const c of cars) if (Math.abs(c.vx) + Math.abs(c.vz) > 0.3 && Math.abs(c.x - b.p.x) < c.a + b.r0 + 0.5 && Math.abs(c.z - b.p.z) < c.a + b.r0 + 0.5) near = true;
      if (!near) return;
      b.sleep = false; b.still = 0;
    }
    if (b.r0 === undefined) b.r0 = b.half.length();
    b.v.y -= G0*DT;
    b.p.addScaledVector(b.v, DT);
    const wl = b.w.length(); if (wl > 1e-6) { _q.setFromAxisAngle(_a.copy(b.w).divideScalar(wl), wl*DT); b.q.premultiply(_q).normalize(); }
    this.iw(b);
    // what it's touching: the ground under each of its points, and any vehicle it's in
    const S = W.surf, cs = b._cs || (b._cs = []); cs.length = 0;
    let deep = 0, touch = false;
    for (let i = 0; i < b.pts.length; i++) {
      const pw = _b.copy(b.pts[i]).applyQuaternion(b.q).add(b.p), g = S ? S.height(pw.x, pw.z) : 0, pen = g - pw.y;
      if (pen > -SLOP) {
        const r = pw.sub(b.p).clone();
        cs.push({ r, n: UP, sv: null, pen, j: 0, i, fresh: b.jn[i] === 0 });
        if (pen > deep) deep = pen; touch = true;
      } else b.jn[i] = 0;
    }
    for (const c of cars) {
      const dx = b.p.x - c.x, dz = b.p.z - c.z; if (Math.abs(dx) > c.a + b.r0 + 0.3 || Math.abs(dz) > c.a + b.r0 + 0.3) continue;
      for (let i = 0; i < b.pts.length; i++) {
        const pw = _b.copy(b.pts[i]).applyQuaternion(b.q).add(b.p), lx = (pw.x - c.x)*c.hx + (pw.z - c.z)*c.hz, lz = -(pw.x - c.x)*c.hz + (pw.z - c.z)*c.hx;
        if (Math.abs(lx) > c.a || Math.abs(lz) > c.b || pw.y > c.y1 || pw.y < c.y0) continue;
        // out by the nearest face: the roof, or a side
        const top = c.y1 - pw.y, fx = c.a - Math.abs(lx), fz = c.b - Math.abs(lz);
        let n, pen;
        if (top <= fx && top <= fz) { n = UP; pen = top; }
        else if (fx < fz) { const s = Math.sign(lx) || 1; n = new V3(c.hx*s, 0, c.hz*s); pen = fx; }
        else { const s = Math.sign(lz) || 1; n = new V3(-c.hz*s, 0, c.hx*s); pen = fz; }
        cs.push({ r: pw.sub(b.p).clone(), n, sv: new V3(c.vx, 0, c.vz), pen, j: 0, i: -1, fresh: true });
        touch = true;
      }
    }
    // a landing: how fast it came down, for its sound
    if (this.onLand) for (const c of cs) if (c.fresh && c.n === UP) { const vn = -this.velAt(b, c.r, _a).y; if (vn > 1.2 && this.t - b.sndT > 0.22) { b.sndT = this.t; this.onLand(b, vn); } break; }
    // the solve: the contacts push only, never pull; the pin holds its point where it is
    for (let it = 0; it < ITER; it++) {
      for (const c of cs) {
        const vel = this.velAt(b, c.r, _a); if (c.sv) vel.sub(c.sv);
        const vn = vel.dot(c.n), k = this.kn(b, c.r, c.n);
        // (pressed into a vehicle: out at its own speed, gently, so a body isn't fired off a bumper)
        const bias = c.sv ? Math.min(2, c.pen*8) : 0;
        let dj = -(vn - bias)/k; const j0 = c.j; c.j = Math.max(0, j0 + dj); dj = c.j - j0;
        if (dj) this.impulse(b, c.r, _j.copy(c.n).multiplyScalar(dj));
        // friction across the contact: the slide scraped off, as far as how hard it's pressed allows
        const v2 = this.velAt(b, c.r, _a); if (c.sv) v2.sub(c.sv);
        _t.copy(v2).addScaledVector(c.n, -v2.dot(c.n)); const vt = _t.length();
        if (vt > 1e-5) { _t.divideScalar(vt); const kt = this.kn(b, c.r, _t), jt = Math.min(vt/kt, b.mu*c.j); this.impulse(b, c.r, _j.copy(_t).multiplyScalar(-jt)); }
      }
      if (b.pin) {
        const r = _r.copy(b.pinLocal).applyQuaternion(b.q), err = _b.copy(r).add(b.p).sub(b.pin), vel = this.velAt(b, r, _a).addScaledVector(err, 0.2/DT);
        // K = 1/m I - [r]x Iw [r]x, the pin's stiffness to a push at it
        const I = b._Iw.elements, e = _k.elements, rx = r.x, ry = r.y, rz = r.z;
        const S = [0, rz, -ry, -rz, 0, rx, ry, -rx, 0];            // [r]x, column-major
        const T = new Array(9).fill(0);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let q = 0; q < 3; q++) s += I[i + q*3]*S[q + j*3]; T[i + j*3] = s; }
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let q = 0; q < 3; q++) s += S[i + q*3]*T[q + j*3]; e[i + j*3] = (i === j ? b.im : 0) - s; }
        _k.invert(); _j.copy(vel).negate().applyMatrix3(_k); this.impulse(b, r, _j);
      }
    }
    // the steel at the fold: it resists bending, so the fall is slowed at first, never sprung back
    if (b.pin && b.stiff) { const k = Math.max(0, 1 - b.stiff*DT); b.w.multiplyScalar(k); }
    if (deep > SLOP) b.p.y += (deep - SLOP)*0.6;
    for (const c of cs) if (c.i >= 0) b.jn[c.i] = c.j || 1e-6;
    // walls, posts, buildings: out of them, and the speed into them gone
    const C = W.collision;
    if (C) { const r = C.resolve(b.p.x, b.p.z, Math.max(0.05, Math.min(b.half.x, b.half.z, 0.5))); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { b.p.x += r.nx*r.depth; b.p.z += r.nz*r.depth; const vn = b.v.x*r.nx + b.v.z*r.nz; if (vn < 0) { b.v.x -= vn*r.nx; b.v.z -= vn*r.nz; } } }
    // a little air, and its spin dies a little faster on the ground
    b.v.multiplyScalar(1 - 0.02*DT); b.w.multiplyScalar(1 - (touch ? 0.6 : 0.05)*DT);
    if (touch && b.v.lengthSq() < 0.012 && b.w.lengthSq() < 0.03) { if ((b.still += DT) > 0.6) { b.sleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0); b._dirty = true; } }
    else b.still = 0;
    if (b.p.y < -50) { b.sleep = true; b._dirty = true; }
  }
}
