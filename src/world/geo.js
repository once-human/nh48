// Geometry accumulation helpers. Each builder collects vertices in plain arrays and turns
// them into an indexed BufferGeometry with compact attribute types.
import * as THREE from 'three';
import earcut from 'earcut';

// colours in the code are written in sRGB; three expects linear vertex colours
const LIN = new Float32Array(1024);
for (let i = 0; i < 1024; i++) { const c = i / 1023; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export const lin = (c) => LIN[Math.max(0, Math.min(1023, Math.round(c * 1023)))];

export const cmRing = (flat) => {
  const out = new Float64Array(flat.length);
  for (let i = 0; i < flat.length; i++) out[i] = flat[i] / 100;
  return out;
};

// triangulate rings (flat [x,z,...] in metres) -> { coords, tris }
export function triangulate(rings) {
  let total = 0;
  for (const r of rings) total += r.length;
  const coords = new Float64Array(total);
  const holes = [];
  let o = 0;
  for (let k = 0; k < rings.length; k++) {
    if (k > 0) holes.push(o / 2);
    coords.set(rings[k], o); o += rings[k].length;
  }
  const tris = earcut(coords, holes, 2);
  // make every triangle face +y
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i], b = tris[i + 1], c = tris[i + 2];
    const ax = coords[2 * a], az = coords[2 * a + 1];
    const bx = coords[2 * b], bz = coords[2 * b + 1];
    const cx = coords[2 * c], cz = coords[2 * c + 1];
    // y component of (b-a) x (c-a) = (bz-az)(cx-ax) - (bx-ax)(cz-az)
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny < 0) { tris[i + 1] = c; tris[i + 2] = b; }
  }
  return { coords, tris };
}

// a plain array into a typed one a slice at a time, then the bounds the same way (a dense chunk has hundreds of
// thousands of values: done at once that was a 20-60 ms frame)
export function* toTyped(src, T = Float32Array) {
  const o = new T(src.length), S = 60000;
  for (let i = 0; i < src.length; i += S) { const e = Math.min(src.length, i + S); for (let k = i; k < e; k++) o[k] = src[k]; if (e < src.length) yield; }
  return o;
}
export function* boundsSliced(g) {
  const p = g.attributes.position.array, S = 90000;
  let a = Infinity, b = Infinity, c = Infinity, d = -Infinity, e = -Infinity, f = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    if (x < a) a = x; if (y < b) b = y; if (z < c) c = z; if (x > d) d = x; if (y > e) e = y; if (z > f) f = z;
    if (i % S === S - 3) yield;
  }
  g.boundingBox = new THREE.Box3(new THREE.Vector3(a, b, c), new THREE.Vector3(d, e, f));
  const cx = (a + d) / 2, cy = (b + e) / 2, cz = (c + f) / 2; let r2 = 0;
  for (let i = 0; i < p.length; i += 3) { const q = (p[i] - cx) ** 2 + (p[i + 1] - cy) ** 2 + (p[i + 2] - cz) ** 2; if (q > r2) r2 = q; if (i % S === S - 3) yield; }
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), Math.sqrt(r2));
}
// attrs: [name, plain array, item size]; one attribute per step
export function* geometrySliced(attrs, index, count) {
  const g = new THREE.BufferGeometry();
  for (const [name, arr, size] of attrs) { g.setAttribute(name, new THREE.BufferAttribute(yield* toTyped(arr), size)); yield; }
  g.setIndex(new THREE.BufferAttribute(yield* toTyped(index, count > 65535 ? Uint32Array : Uint16Array), 1)); yield;
  yield* boundsSliced(g);
  return g;
}
export const drain = (it) => { let st; while (!(st = it.next()).done) { /* all at once */ } return st.value; };
function finishIndex(geo, index, count) {
  const I = count > 65535 ? new Uint32Array(index) : new Uint16Array(index);
  geo.setIndex(new THREE.BufferAttribute(I, 1));
}

// ---------------------------------------------------------------- ground
export class GroundBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.l = []; this.s = []; this.i = []; this.c = 0; }
  v(x, y, z, nx, ny, nz, u, w, layer, shade = 1) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.l.push(layer); this.s.push(shade);
    return this.c++;
  }
  // horizontal polygon at height y, world-mapped uv with `scale` metres per repeat
  poly(rings, y, layer, scale, shade = 1, down = false) {
    const { coords, tris } = triangulate(rings);
    const base = this.c;
    for (let k = 0; k < coords.length; k += 2) {
      const x = coords[k], z = coords[k + 1];
      this.v(x, y, z, 0, down ? -1 : 1, 0, x / scale, z / scale, layer, shade);
    }
    if (down) for (let k = 0; k < tris.length; k += 3) this.i.push(base + tris[k], base + tris[k + 2], base + tris[k + 1]);
    else for (let k = 0; k < tris.length; k++) this.i.push(base + tris[k]);
  }
  // vertical wall along a polyline. Faces the side normal N=(dz,-dx) if side=+1, the opposite if -1.
  wall(pts, y0, y1, layer, uScale, vScale, side = 1, shade = 1, u0 = 0) {
    let u = u0;
    for (let k = 0; k + 3 < pts.length; k += 2) {
      const ax = pts[k], az = pts[k + 1], bx = pts[k + 2], bz = pts[k + 3];
      const dx = bx - ax, dz = bz - az;
      const L = Math.hypot(dx, dz);
      if (L < 1e-4) continue;
      const nx = side * dz / L, nz = -side * dx / L;
      const ua = u / uScale, ub = (u + L) / uScale;
      const a0 = this.v(ax, y0, az, nx, 0, nz, ua, 0, layer, shade);
      const b0 = this.v(bx, y0, bz, nx, 0, nz, ub, 0, layer, shade);
      const b1 = this.v(bx, y1, bz, nx, 0, nz, ub, (y1 - y0) / vScale, layer, shade);
      const a1 = this.v(ax, y1, az, nx, 0, nz, ua, (y1 - y0) / vScale, layer, shade);
      // winding: (a0,b0,b1) faces -N ; so for side normal use reversed
      if (side > 0) this.i.push(a0, b1, b0, a0, a1, b1);
      else this.i.push(a0, b0, b1, a0, b1, a1);
      u += L;
    }
    return u;
  }
  // flat strip offset to the N side (side=+1) or the other side, at height y
  strip(pts, w, y, layer, uScale, side = 1, shade = 1) {
    let u = 0;
    for (let k = 0; k + 3 < pts.length; k += 2) {
      const ax = pts[k], az = pts[k + 1], bx = pts[k + 2], bz = pts[k + 3];
      const dx = bx - ax, dz = bz - az;
      const L = Math.hypot(dx, dz);
      if (L < 1e-4) continue;
      const ox = side * dz / L * w, oz = -side * dx / L * w;
      const a = this.v(ax, y, az, 0, 1, 0, u / uScale, 0, layer, shade);
      const b = this.v(bx, y, bz, 0, 1, 0, (u + L) / uScale, 0, layer, shade);
      const c = this.v(bx + ox, y, bz + oz, 0, 1, 0, (u + L) / uScale, w / uScale, layer, shade);
      const d = this.v(ax + ox, y, az + oz, 0, 1, 0, u / uScale, w / uScale, layer, shade);
      // ensure up-facing
      const ny = (bz - az) * (ox) - (bx - ax) * (oz);
      if (ny >= 0) this.i.push(a, b, c, a, c, d); else this.i.push(a, c, b, a, d, c);
      u += L;
    }
  }
  box(cx, cy, cz, sx, sy, sz, rot, layer, scale = 2, shade = 1) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const hx = sx / 2, hz = sz / 2;
    const P = (x, z) => [cx + x * c - z * s, cz + x * s + z * c];
    const q = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
    // sides
    for (let k = 0; k < 4; k++) {
      const a = q[k], b = q[(k + 1) % 4];
      this.wall([a[0], a[1], b[0], b[1]], cy, cy + sy, layer, scale, scale, 1, shade);
    }
    // top
    const t = [q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]];
    this.poly([t], cy + sy, layer, scale, shade);
  }
  get empty() { return this.c === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(this.n.map(v => Math.round(v * 127))), 3, true));
    g.setAttribute('guv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('glayer', new THREE.BufferAttribute(new Uint8Array(this.l), 1));
    g.setAttribute('gshade', new THREE.BufferAttribute(new Uint8Array(this.s.map(v => Math.min(255, Math.round(v * 200)))), 1, true));
    finishIndex(g, this.i, this.c);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------- facades
export class FacadeBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.l = []; this.t = []; this.s = []; this.i = []; this.c = 0; }
  v(x, y, z, nx, ny, nz, u, w, layer, tint, seed) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.l.push(layer);
    this.t.push(tint[0], tint[1], tint[2]); this.s.push(seed);
    return this.c++;
  }
  // vertical quad from (ax,az)->(bx,bz) between y0,y1 facing outward normal (nx,nz)
  quad(ax, az, bx, bz, y0, y1, nx, nz, u0, u1, v0, v1, layer, tint, seed) {
    const a0 = this.v(ax, y0, az, nx, 0, nz, u0, v0, layer, tint, seed);
    const b0 = this.v(bx, y0, bz, nx, 0, nz, u1, v0, layer, tint, seed);
    const b1 = this.v(bx, y1, bz, nx, 0, nz, u1, v1, layer, tint, seed);
    const a1 = this.v(ax, y1, az, nx, 0, nz, u0, v1, layer, tint, seed);
    // (a0,b0,b1) normal = (-(bz-az), 0, (bx-ax)) ; compare with requested normal
    const cx = -(bz - az), cz = (bx - ax);
    if (cx * nx + cz * nz >= 0) this.i.push(a0, b0, b1, a0, b1, a1);
    else this.i.push(a0, b1, b0, a0, a1, b1);
  }
  poly(rings, y, layer, scale, tint, seed, down = false) {
    const { coords, tris } = triangulate(rings);
    const base = this.c;
    for (let k = 0; k < coords.length; k += 2) {
      const x = coords[k], z = coords[k + 1];
      this.v(x, y, z, 0, down ? -1 : 1, 0, x / scale, z / scale, layer, tint, seed);
    }
    for (let k = 0; k < tris.length; k += 3) {
      if (down) this.i.push(base + tris[k], base + tris[k + 2], base + tris[k + 1]);
      else this.i.push(base + tris[k], base + tris[k + 1], base + tris[k + 2]);
    }
  }
  tri(p0, p1, p2, uv0, uv1, uv2, layer, tint, seed) {
    // free triangle (pitched roofs); normal from cross product, made to face outward/up
    let ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    let vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    let flip = false;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; flip = true; }
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    const a = this.v(p0[0], p0[1], p0[2], nx, ny, nz, uv0[0], uv0[1], layer, tint, seed);
    const b = this.v(p1[0], p1[1], p1[2], nx, ny, nz, uv1[0], uv1[1], layer, tint, seed);
    const c = this.v(p2[0], p2[1], p2[2], nx, ny, nz, uv2[0], uv2[1], layer, tint, seed);
    if (flip) this.i.push(a, c, b); else this.i.push(a, b, c);
  }
  get empty() { return this.c === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(this.n.map(v => Math.round(v * 127))), 3, true));
    g.setAttribute('fuv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('flayer', new THREE.BufferAttribute(new Uint8Array(this.l), 1));
    g.setAttribute('ftint', new THREE.BufferAttribute(new Uint8Array(this.t.map(v => Math.round(lin(Math.min(1, v)) * 255))), 3, true));
    g.setAttribute('fseed', new THREE.BufferAttribute(new Uint8Array(this.s.map(v => Math.round(v * 255))), 1, true));
    finishIndex(g, this.i, this.c);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------- vertex-coloured props
export class ColorBuilder {
  constructor() { this.p = []; this.n = []; this.col = []; this.g = []; this.i = []; this.c = 0; this.paint = null; }
  v(x, y, z, nx, ny, nz, r, g, b, glow = 0, paint = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.col.push(lin(r), lin(g), lin(b)); this.g.push(glow);
    if (this.paint) this.paint.push(paint);
    return this.c++;
  }
  // add an existing BufferGeometry (non-indexed or indexed) transformed by matrix, coloured
  addGeo(geo, m, color, glow = 0, paint = 0) {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const v3 = new THREE.Vector3(), n3 = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const base = this.c;
    for (let k = 0; k < pos.count; k++) {
      v3.fromBufferAttribute(pos, k).applyMatrix4(m);
      n3.fromBufferAttribute(nor, k).applyMatrix3(nm).normalize();
      this.v(v3.x, v3.y, v3.z, n3.x, n3.y, n3.z, color[0], color[1], color[2], glow, paint);
    }
    if (geo.index) { const ix = geo.index.array; for (let k = 0; k < ix.length; k++) this.i.push(base + ix[k]); }
    else for (let k = 0; k < pos.count; k++) this.i.push(base + k);
  }
  get empty() { return this.c === 0; }
  build() { return drain(this.buildSliced()); }
  *buildSliced() {
    const a = [['position', this.p, 3], ['normal', this.n, 3], ['color', this.col, 3], ['glow', this.g, 1]];
    if (this.paint) a.push(['paint', this.paint, 1]);
    return yield* geometrySliced(a, this.i, this.c);
  }
}

// ---------------------------------------------------------------- textured quads (signs, decals)
export class QuadBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; this.c = 0; }
  // quad from 4 corners (p: [x,y,z] x4, in order around) with uv rect
  quad(c0, c1, c2, c3, n, u0, v0, u1, v1) {
    const b = this.c;
    const U = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const P = [c0, c1, c2, c3];
    for (let k = 0; k < 4; k++) {
      this.p.push(P[k][0], P[k][1], P[k][2]); this.n.push(n[0], n[1], n[2]); this.uv.push(U[k][0], U[k][1]);
    }
    this.c += 4;
    // winding to face n
    const ax = c1[0] - c0[0], ay = c1[1] - c0[1], az = c1[2] - c0[2];
    const bx = c2[0] - c0[0], by = c2[1] - c0[1], bz = c2[2] - c0[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
    else this.i.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  // quad with per-vertex normals (foliage cards)
  quadN(P, N, u0, v0, u1, v1) {
    const b = this.c;
    const U = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let k = 0; k < 4; k++) { this.p.push(P[k][0], P[k][1], P[k][2]); this.n.push(N[k][0], N[k][1], N[k][2]); this.uv.push(U[k][0], U[k][1]); }
    this.c += 4;
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  // flat decal on the ground: centre, half-extents along dir (a) and across, uv rect
  ground(cx, y, cz, ang, hl, hw, uvr) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const ax = ca * hl, az = sa * hl, bx = -sa * hw, bz = ca * hw;
    this.quad([cx - ax - bx, y, cz - az - bz], [cx + ax - bx, y, cz + az - bz], [cx + ax + bx, y, cz + az + bz], [cx - ax + bx, y, cz - az + bz],
      [0, 1, 0], uvr[0], uvr[1], uvr[2], uvr[3]);
  }
  get empty() { return this.c === 0; }
  build() { return drain(this.buildSliced()); }
  *buildSliced() { return yield* geometrySliced([['position', this.p, 3], ['normal', this.n, 3], ['uv', this.uv, 2]], this.i, this.c); }
}

// polyline utilities
export function polyLength(pts) {
  let L = 0;
  for (let k = 0; k + 3 < pts.length; k += 2) L += Math.hypot(pts[k + 2] - pts[k], pts[k + 3] - pts[k + 1]);
  return L;
}
// walk a polyline emitting samples every `step` metres: cb(x, z, dirx, dirz, dist)
export function walkLine(pts, step, cb, start = 0) {
  let acc = 0, next = start;
  for (let k = 0; k + 3 < pts.length; k += 2) {
    const ax = pts[k], az = pts[k + 1], bx = pts[k + 2], bz = pts[k + 3];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    if (L < 1e-6) continue;
    while (next <= acc + L) {
      const t = (next - acc) / L;
      cb(ax + dx * t, az + dz * t, dx / L, dz / L, next);
      next += step;
    }
    acc += L;
  }
  return acc;
}
// dashes along polyline: cb(x0,z0,x1,z1)
export function dashes(pts, dash, gap, cb) {
  let acc = 0, on = true, rem = dash;
  for (let k = 0; k + 3 < pts.length; k += 2) {
    let ax = pts[k], az = pts[k + 1];
    const bx = pts[k + 2], bz = pts[k + 3];
    let L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / (L || 1), uz = (bz - az) / (L || 1);
    while (L > 1e-6) {
      const s = Math.min(rem, L);
      const nx = ax + ux * s, nz = az + uz * s;
      if (on) cb(ax, az, nx, nz);
      ax = nx; az = nz; L -= s; rem -= s;
      if (rem <= 1e-6) { on = !on; rem = on ? dash : gap; }
    }
  }
}
