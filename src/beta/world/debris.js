// What a knocked-down thing breaks into: solid pieces, each its own rigid body. Worked out in fixed steps (1/120 s, the
// same as a body falling, people/ragdoll.js), so the same hit on the same step goes the same way every time. Each piece
// is the prop's own parts (a plank, a wheel, a roof sheet, the pole itself), resting on the furthest points of its own
// shape, not on a box round it: a cart lies on its wheels and its roof's edge, a pole along its length. Gravity has
// it, the ground takes it without giving it back (nothing bounces: what lands stays landed), it slides with the grip
// its material has, it rolls and turns only as its weight and the ground make it, walls stop it, and your vehicle is
// solid to it (it's shoved by the bumper, it lies on the roof). Still for a moment, it's asleep and costs nothing until
// something touches it. A steel post that folds over stays fixed at its foot (a pin, with the steel's stiffness
// against it), so it lies in the road from where it stood. A heavy thing carries its weight low (a stall's counter,
// its stove and its cylinder; not its tin roof), so it's slow to go over and settles where it lands. What's laid on
// a counter rides on it as long as the counter holds it (it tips past what the thing's grip on it can hold, or it
// lands hard, or it's struck out from under it), then it's off with the speed it had on it; what's round rolls.
import * as THREE from 'three';

const DT = 1/120, ITER = 6, G0 = 9.81, SLOP = 0.004;
const V3 = THREE.Vector3, _a = new V3(), _b = new V3(), _r = new V3(), _j = new V3(), _t = new V3(), _w = new V3(), _u = new V3(), _u2 = new V3();
const _m3 = new THREE.Matrix3(), _k = new THREE.Matrix3(), _q = new THREE.Quaternion(), _mq = new THREE.Matrix4();
const UP = new V3(0, 1, 0), _qi = new THREE.Quaternion(), _l = new V3(), _u3 = new V3(), _pv = new V3(), _dv = new V3();
// a world point in a body's own box: the face it's nearest to (out of the box, in the world) and how deep it's in, or null
// (flat: only by its sides, never its top or bottom, for something on wheels that shoves it along the road)
function inBox(o, pw, flat, dv, hint) {
  _l.copy(pw).sub(o.p).applyQuaternion(_qi.copy(o.q).invert());
  const h = o.half, fx = h.x - Math.abs(_l.x), fy = h.y - Math.abs(_l.y), fz = h.z - Math.abs(_l.z);
  // (within a hair of a side counts as touching it, as with the ground: two crates square on each other, each corner
  // lying exactly on a side was in by one side and out by the other, and the top one stood on two opposite corners and tipped)
  const sk = flat ? 0 : SLOP;
  if (fx <= -sk || fy <= -sk || fz <= -sk) return null;
  if (flat) {
    // of its own axes, the ones lying flattest, and of those the nearer face
    const ax = [[new V3(Math.sign(_l.x) || 1, 0, 0), fx], [new V3(0, Math.sign(_l.y) || 1, 0), fy], [new V3(0, 0, Math.sign(_l.z) || 1), fz]].map(([n, f]) => [n.applyQuaternion(o.q), f]);
    let best = null; for (const [n, f] of ax) { const h = Math.hypot(n.x, n.z); if (h < 0.5) continue; if (!best || f < best[1]) best = [n.setY(0).normalize(), f]; }
    return best ? { n: best[0], pen: best[1] } : null;
  }
  // out through the face it came in by: the one it was outside of a moment ago and is moving in through. Else the
  // nearest face it's really in past: a corner lying exactly in line with a side (crates stacked square, a box on a
  // shelf) is in by nothing there, and was pushed out sideways by nothing, so it went on falling straight through
  const f = [fx, fy, fz], H = [h.x, h.y, h.z], L = [_l.x, _l.y, _l.z]; let ax = -1, s = 1;
  // (still in by the face it came in by, while it stays in: guessed afresh each step, a corner on an edge flipped to the side)
  if (hint) { ax = Math.abs(hint) - 1; s = Math.sign(hint); }
  else if (dv) {
    _pv.copy(dv).applyQuaternion(_qi).multiplyScalar(-DT).add(_l); const P = [_pv.x, _pv.y, _pv.z];
    // (of the faces it crossed this step, the last one: it was only inside once it was past all three)
    let tl = -1;
    for (let k = 0; k < 3; k++) { const pk = Math.abs(P[k]), lk = Math.abs(L[k]); if (pk < H[k] - 1e-6 || pk <= lk + 1e-6) continue; const t = (pk - H[k])/(pk - lk); if (t > tl) { tl = t; ax = k; s = Math.sign(P[k]) || 1; } }
  }
  if (ax < 0) { for (let k = 0; k < 3; k++) if (f[k] > 1e-4 && (ax < 0 || f[k] < f[ax])) ax = k; if (ax < 0) ax = fx < fy && fx < fz ? 0 : fy < fz ? 1 : 2; s = Math.sign(L[ax]) || 1; }
  const n = new V3(ax === 0 ? s : 0, ax === 1 ? s : 0, ax === 2 ? s : 0);
  return { n: n.applyQuaternion(o.q), pen: f[ax], code: (ax + 1)*s };
}

// the grip each material has on the road, and how much of its spin the ground lets it keep
const CORN = [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
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

// a piece with its weight carried low: its middle of mass f of its half height below the middle of its box
export function lower(pc, f) {
  const d = pc.half.y*f; if (!d) return pc;
  pc.geo.translate(0, d, 0); pc.geo.computeBoundingSphere(); for (const p of pc.pts) p.y += d; pc.c.y -= d;
  return pc;
}

// ---------------------------------------------------------------- the bodies
export class Debris {
  constructor() { this.list = []; this.acc = 0; this.t = 0; this.onLand = null; }
  // o: { mesh, p, q, v, w, m, half, pts, mat, pin (world point of its local pinLocal), pinLocal, stiff }
  add(o) {
    const h = o.half, m = o.m, ix = m*(h.y*h.y + h.z*h.z)/3, iy = m*(h.x*h.x + h.z*h.z)/3, iz = m*(h.x*h.x + h.y*h.y)/3;
    const b = Object.assign({ v: new V3(), w: new V3(), mu: MU[o.mat] ?? 0.5, still: 0, sleep: false, air: 1, sndT: -9, jn: null }, o);
    b.iI = new V3(1/ix, 1/iy, 1/iz); b.im = 1/m; b.born = this.t; b.ign = null;
    b.jn = new Float32Array(b.pts.length);
    // (against another piece, its box is felt at its corners, the middles of its edges and of its faces: by corners alone, two
    // boxes offset both ways overlap at two opposite corners only, and the top one tipped over that line)
    b.bp = []; for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) b.bp.push(new V3(x*h.x, y*h.y, z*h.z));
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
    while (this.acc >= DT) { this.acc -= DT; this.t += DT; for (let i = 0; i < this.list.length; i++) { this.bi = i; this.tick(this.list[i], W, cars); } }
    for (const b of this.list) if (!b.sleep || b._dirty) { this.sync(b); b._dirty = false; }
  }
  sync(b) { if (b.mesh) { b.mesh.position.copy(b.p); b.mesh.quaternion.copy(b.q); b.mesh.updateMatrix(); b.mesh.updateMatrixWorld(); } }
  tick(b, W, cars) {
    // carried on something: where it is on it, until it can't be held there
    if (b.ride) {
      const R = b.ride, P = R.on;
      _q.copy(P.q); b.p.copy(R.lp).applyQuaternion(_q).add(P.p); b.q.copy(_q).multiply(R.lq);
      const upY = 1 - 2*(P.q.x*P.q.x + P.q.z*P.q.z);           // (how upright the thing under it still is)
      if (upY < R.cos || (P.jolt || 0) > R.jolt || this.list.indexOf(P) < 0) {
        this.velAt(P, _r.subVectors(b.p, P.p), b.v); b.w.copy(P.w).multiplyScalar(0.6);
        b.ride = null; b.sleep = false; b.still = 0;
      } else { b.sleep = P.sleep; b._dirty = !P.sleep; return; }
    }
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
    if (b.ball) {
      // a round thing touches the road at one point, under its middle
      const g = S ? S.height(b.p.x, b.p.z) : 0, pen = g - (b.p.y - b.ball);
      if (pen > -SLOP) { cs.push({ r: new V3(0, -b.ball, 0), n: UP, sv: null, pen, j: 0, i: 0, fresh: b.jn[0] === 0 }); deep = pen; touch = true; }
      else b.jn[0] = 0;
    } else for (let i = 0; i < b.pts.length; i++) {
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
        if (!c.side && top <= fx && top <= fz) { n = UP; pen = top; }          // (on a car's roof; a person is only ever met from the side: nothing rests on someone's head)
        else if (fx < fz) { const s = Math.sign(lx) || 1; n = new V3(c.hx*s, 0, c.hz*s); pen = fx; }
        else { const s = Math.sign(lz) || 1; n = new V3(-c.hz*s, 0, c.hx*s); pen = fz; }
        cs.push({ r: pw.sub(b.p).clone(), n, car: c, pen, j: 0, i: -1, fresh: true });
        touch = true;
      }
      // a long piece (a pole, a trunk, a shelter's roof) lying across: its corners can be either side of the car, so the
      // car's own corners and sides, low and at the bumper, into the piece
      if (Math.max(b.half.x, b.half.y, b.half.z) > 0.45) for (const y of [c.y0 + 0.08, Math.min(c.y1 - 0.05, c.y0 + 0.4)]) for (const [u, w] of CORN) {
        const lx = u*c.a, lz = w*c.b; _b.set(c.x + lx*c.hx - lz*c.hz, y, c.z + lx*c.hz + lz*c.hx);
        const q = inBox(b, _b, true); if (!q) continue;
        q.n.negate();
        cs.push({ r: _b.clone().sub(b.p), n: q.n, car: c, pen: q.pen, j: 0, i: -1, fresh: true }); touch = true;
      }
    }
    // the other pieces: none goes through another (each point of this one in another's box is pushed out of it, and that
    // one takes its share back)
    // (each pair once a step, after both have moved, and both ways: this one's corners in that one's box and that one's in
    // this one's. Solved from one side only, a crate landing square on another was caught by its own two corners on the
    // one side and none on the other, spun, and thrown off)
    for (let oi = 0; oi < this.list.length; oi++) {
      const o = this.list[oi];
      if (o === b || (oi > this.bi && !o.sleep) || (b.ride && b.ride.on === o) || (o.ride && o.ride.on === b)) continue;
      if (o.r0 === undefined) o.r0 = o.half.length();
      const dx = b.p.x - o.p.x, dy = b.p.y - o.p.y, dz = b.p.z - o.p.z, rr = b.r0 + o.r0; if (dx*dx + dy*dy + dz*dz > rr*rr) continue;
      // (pieces of the one thing, born into each other's boxes as it broke, leave each other be until they've come apart)
      const ig = b.ign && b.ign.has(o), n0 = cs.length, cm = b.cm || (b.cm = new Map());
      const mem = cm.get(o) || [new Int8Array(26), new Int8Array(26)];
      for (let i = 0; i < 26; i++) {
        const pw = _b.copy(b.bp[i]).applyQuaternion(b.q).add(b.p), r = pw.clone().sub(b.p), ro = pw.clone().sub(o.p);
        const q = inBox(o, pw, false, this.velAt(b, r, _dv).sub(this.velAt(o, ro, _u3)), mem[0][i]); if (!q) { mem[0][i] = 0; continue; }
        mem[0][i] = q.code;
        cs.push({ r, ro, n: q.n, ob: o, pen: q.pen, j: 0, i: -1, fresh: true });
      }
      for (let i = 0; i < 26; i++) {
        const pw = _b.copy(o.bp[i]).applyQuaternion(o.q).add(o.p), r = pw.clone().sub(b.p), ro = pw.clone().sub(o.p);
        const q = inBox(b, pw, false, this.velAt(o, ro, _dv).sub(this.velAt(b, r, _u3)), mem[1][i]); if (!q) { mem[1][i] = 0; continue; }
        mem[1][i] = q.code;
        cs.push({ r, ro, n: q.n.negate(), ob: o, pen: q.pen, j: 0, i: -1, fresh: true });
      }
      if (cs.length === n0) { cm.delete(o); if (ig) { b.ign.delete(o); if (o.ign) o.ign.delete(b); } continue; }
      cm.set(o, mem);
      if (ig || (Math.abs(b.born - o.born) < 1e-6 && this.t - b.born < 0.05)) { cs.length = n0; (b.ign || (b.ign = new Set())).add(o); (o.ign || (o.ign = new Set())).add(b); continue; }
      touch = true;
    }
    // a landing: how fast it came down, for its sound
    if (this.onLand) for (const c of cs) if (c.fresh && c.n === UP) { const vn = -this.velAt(b, c.r, _a).y; if (vn > 1.2) b.jolt = Math.max(b.jolt || 0, vn); if (vn > 1.2 && this.t - b.sndT > 0.22) { b.sndT = this.t; this.onLand(b, vn); } break; }
    // the solve: the contacts push only, never pull; the pin holds its point where it is
    for (let it = 0; it < ITER; it++) {
      for (const c of cs) {
        const C = c.car, O = c.ob, rel = (out) => { this.velAt(b, c.r, out); if (C) { out.x -= C.vx; out.z -= C.vz; } else if (O) out.sub(this.velAt(O, c.ro, _u3)); return out; };
        // what's on the other side gives too, by its weight: a car (sideways only: it's on its wheels), another piece
        const other = (n) => C ? C.im*(n.x*n.x + n.z*n.z) : O ? O.im : 0;
        const give = (J) => { if (C) { C.vx -= J.x*C.im; C.vz -= J.z*C.im; C.hit = Math.max(C.hit || 0, b.m); } else if (O) { O.v.addScaledVector(J, -O.im); if (O.sleep) { O.sleep = false; O.still = 0; } } };
        const vn = rel(_a).dot(c.n), k = this.kn(b, c.r, c.n) + other(c.n);
        // (pressed into something: out at its own speed, gently, so a body isn't fired off a bumper)
        const bias = C || O ? Math.min(2, c.pen*8) : 0;
        // (someone on foot pushes only as hard as a person can, about 450 N: they shove a plank or a crate along, never a
        // concrete pole or a shelter; walking into one, they're held)
        let dj = -(vn - bias)/k; const j0 = c.j; c.j = Math.max(0, j0 + dj); if (C && C.side) c.j = Math.min(c.j, 450*DT); dj = c.j - j0;
        if (dj) { _j.copy(c.n).multiplyScalar(dj); this.impulse(b, c.r, _j); give(_j); }
        // friction across the contact: the slide scraped off, as far as how hard it's pressed allows
        const v2 = rel(_a);
        _t.copy(v2).addScaledVector(c.n, -v2.dot(c.n)); const vt = _t.length();
        if (vt > 1e-5) { _t.divideScalar(vt); const kt = this.kn(b, c.r, _t) + other(_t), jt = Math.min(vt/kt, b.mu*c.j); _j.copy(_t).multiplyScalar(-jt); this.impulse(b, c.r, _j); give(_j); }
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
    // and out of whatever it's sunk into, each its share by weight (a car or a person pushed back off a heavy one)
    for (const c of cs) {
      if (!(c.car || c.ob) || c.pen <= SLOP) continue;
      // (what's lying on the road is held there by its grip on it too: a person walking into something heavy takes all of it)
      const mo = c.car ? c.car.m : c.ob.m, mb = b.m*(touch && c.car && c.car.side ? 1 + 25*b.mu : 1), sh = mo/(mo + mb), d = (c.pen - SLOP)*0.5;
      b.p.addScaledVector(c.n, d*sh);
      if (c.car) { c.car.px -= c.n.x*d*(1 - sh); c.car.pz -= c.n.z*d*(1 - sh); }
      else { c.ob.p.addScaledVector(c.n, -d*(1 - sh)); c.ob._dirty = true; }
    }
    for (const c of cs) if (c.i >= 0) b.jn[c.i] = c.j || 1e-6;
    // walls, posts, buildings: out of them, and the speed into them gone
    const C = W.collision;
    if (C) { const r = C.resolve(b.p.x, b.p.z, Math.max(0.05, Math.min(b.half.x, b.half.z, 0.5))); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { b.p.x += r.nx*r.depth; b.p.z += r.nz*r.depth; const vn = b.v.x*r.nx + b.v.z*r.nz; if (vn < 0) { b.v.x -= vn*r.nx; b.v.z -= vn*r.nz; } } }
    // (a long one, a pole or a trunk or a shelter's roof, by its two ends as well: by its middle alone, an end went into a
    // wall or through a post. The end's push turns it as well as moving it)
    const hm = Math.max(b.half.x, b.half.y, b.half.z);
    if (C && hm > 0.6) {
      const ax = b.half.x === hm ? 'x' : b.half.y === hm ? 'y' : 'z';
      for (const sg of [-1, 1]) {
        _r.set(0, 0, 0); _r[ax] = sg*hm*0.95; _r.applyQuaternion(b.q);
        const ex = b.p.x + _r.x, ez = b.p.z + _r.z;
        const q = C.resolve(ex, ez, 0.1); if (!q || q.depth <= 0 || q.kind === 3 || q.kind === 4) continue;
        if (!b.pin) { b.p.x += q.nx*q.depth*0.7; b.p.z += q.nz*q.depth*0.7; }
        const vn = this.velAt(b, _r, _a).x*q.nx + _a.z*q.nz;
        if (vn < 0) { _j.set(q.nx, 0, q.nz); const k = this.kn(b, _r, _j); this.impulse(b, _r, _j.multiplyScalar(-vn/k)); }
        touch = true;
      }
    }
    // a little air, and its spin dies a little faster on the ground
    if (b.jolt) b.jolt = Math.max(0, b.jolt - 30*DT);
    // (what rolls loses its roll slowly, to the road's roughness; what lies on it, fast)
    b.v.multiplyScalar(1 - 0.02*DT); b.w.multiplyScalar(1 - (touch ? (b.ball ? 0.35 : 0.6) : 0.05)*DT);
    if (b.ball && touch) { const h = Math.hypot(b.v.x, b.v.z), dv = Math.min(h, (b.roll ?? 0.06)*G0*DT); if (h > 1e-5) { b.v.x -= b.v.x/h*dv; b.v.z -= b.v.z/h*dv; } }
    if (touch && b.v.lengthSq() < 0.012 && b.w.lengthSq() < 0.03) { if ((b.still += DT) > 0.6) { b.sleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0); b._dirty = true; } }
    else b.still = 0;
    if (b.p.y < -50) { b.sleep = true; b._dirty = true; }
  }
}
