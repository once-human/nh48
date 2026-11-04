// Geometry for the painted city, without three.js (it runs in a worker too). Every vertex carries what the paint
// shader needs: where it is, which way it faces, its colour (as painted, sRGB), the kind of surface, how worn it is and
// a seed, and a surface position in metres (along the wall, up the wall) so patterns sit right on any wall.
// Faces are wound from the normal asked for, so nothing comes out inside out. Indexed, compact attributes.
import earcut from 'earcut';

export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export function rng(s) { s |= 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hash2(a, b) { let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); h = Math.imul(h ^ h >>> 15, 0x85ebca6b); h ^= h >>> 13; return (h >>> 0); }
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mulc = (a, k) => [Math.min(1, a[0] * k), Math.min(1, a[1] * k), Math.min(1, a[2] * k)];

export class WB {
  constructor(cap = 4096) {
    this.lod = 0;          // seen from far (1) or from across the city (2): small things left out (quad, tube, cyl, blob); 3: nothing
    this.cap = 0; this.n = 0; this.ni = 0; this.icap = 0;
    this.grow(cap); this.growI(cap * 2);
    this.c = [1, 1, 1]; this.k = 0; this.w = 0; this.s = 0;
    this.cq = [255, 255, 255]; this.wq = 0; this.sq = 0;
  }
  // storage: typed arrays, doubled as they fill (a dense chunk has hundreds of thousands of vertices)
  grow(cap) {
    const P = new Float32Array(cap * 3), N = new Int8Array(cap * 3), C = new Uint8Array(cap * 3), K = new Uint8Array(cap), A = new Uint8Array(cap * 2), U = new Uint16Array(cap * 2);
    if (this.n) { P.set(this.P.subarray(0, this.n * 3)); N.set(this.N.subarray(0, this.n * 3)); C.set(this.C.subarray(0, this.n * 3)); K.set(this.K.subarray(0, this.n)); A.set(this.A.subarray(0, this.n * 2)); U.set(this.U.subarray(0, this.n * 2)); }
    this.P = P; this.N = N; this.C = C; this.K = K; this.A = A; this.U = U; this.cap = cap;
  }
  growI(cap) { const I = new Uint32Array(cap); if (this.ni) I.set(this.I.subarray(0, this.ni)); this.I = I; this.icap = cap; }
  idx(a, b, c) { if (this.ni + 3 > this.icap) this.growI(this.icap * 2); const I = this.I, o = this.ni; I[o] = a; I[o + 1] = b; I[o + 2] = c; this.ni = o + 3; }
  col(h) { this.c = typeof h === 'number' ? hex(h) : h; const q = this.cq; for (let i = 0; i < 3; i++) q[i] = Math.round(Math.min(1, Math.max(0, this.c[i])) * 255); return this; }
  kind(k) { this.k = k; return this; }
  wear(w) { this.w = w; this.wq = Math.round(Math.min(1, Math.max(0, w)) * 255); return this; }
  seed(s) { this.s = s; this.sq = Math.round(Math.min(1, Math.max(0, s)) * 255); return this; }
  set(k, c, w, s) { this.k = k; if (c !== undefined) this.col(c); if (w !== undefined) this.wear(w); if (s !== undefined) this.seed(s); return this; }
  v(x, y, z, nx, ny, nz, u, t) {
    const i = this.n;
    if (i >= this.cap) this.grow(this.cap * 2);
    const i3 = i * 3, i2 = i * 2, q = this.cq;
    this.P[i3] = x; this.P[i3 + 1] = y; this.P[i3 + 2] = z;
    this.N[i3] = Math.round(nx * 127); this.N[i3 + 1] = Math.round(ny * 127); this.N[i3 + 2] = Math.round(nz * 127);
    this.C[i3] = q[0]; this.C[i3 + 1] = q[1]; this.C[i3 + 2] = q[2]; this.K[i] = this.k;
    this.A[i2] = this.wq; this.A[i2 + 1] = this.sq;
    const a = Math.round(u * 32), b = Math.round(t * 32);
    this.U[i2] = ((a % 65536) + 65536) % 65536; this.U[i2 + 1] = ((b % 65536) + 65536) % 65536;
    return this.n++;
  }
  // triangle; n: the side it should face (its own normal is used for shading unless flat is given)
  tri(a, b, c, n, ua, ub, uc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const L = Math.hypot(nx, ny, nz); if (L < 1e-9 || (this.lod && (this.lod > 2 || L < (this.lod > 1 ? 0.3 : 0.04)))) return;
    nx /= L; ny /= L; nz /= L;
    let flip = false;
    if (n && nx * n[0] + ny * n[1] + nz * n[2] < 0) { flip = true; nx = -nx; ny = -ny; nz = -nz; }
    ua = ua || [0, 0]; ub = ub || [0, 0]; uc = uc || [0, 0];
    const i0 = this.v(a[0], a[1], a[2], nx, ny, nz, ua[0], ua[1]), i1 = this.v(b[0], b[1], b[2], nx, ny, nz, ub[0], ub[1]), i2 = this.v(c[0], c[1], c[2], nx, ny, nz, uc[0], uc[1]);
    if (flip) this.idx(i0, i2, i1); else this.idx(i0, i1, i2);
  }
  // quad, corners in order around; n the facing; uv per corner (default: none)
  quad(a, b, c, d, n, uv) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const L = Math.hypot(nx, ny, nz); if (L < 1e-9 || this.lod > 2) return;
    // seen from far (lod): no slivers (frames, bars, trims) and nothing tiny
    if (this.lod) {
      const m = Math.min(ux * ux + uy * uy + uz * uz, wx * wx + wy * wy + wz * wz);
      if (this.lod > 1 ? L < 0.6 || (L < 4 && m < 0.06) : L < 0.05 || (L < 0.6 && m < 0.01)) return;
    }
    nx /= L; ny /= L; nz /= L;
    let flip = false;
    if (n && nx * n[0] + ny * n[1] + nz * n[2] < 0) { flip = true; nx = -nx; ny = -ny; nz = -nz; }
    const q = uv || Z4;
    const i0 = this.v(a[0], a[1], a[2], nx, ny, nz, q[0], q[1]), i1 = this.v(b[0], b[1], b[2], nx, ny, nz, q[2], q[3]);
    const i2 = this.v(c[0], c[1], c[2], nx, ny, nz, q[4], q[5]), i3 = this.v(d[0], d[1], d[2], nx, ny, nz, q[6], q[7]);
    if (flip) { this.idx(i0, i2, i1); this.idx(i0, i3, i2); } else { this.idx(i0, i1, i2); this.idx(i0, i2, i3); }
  }
  // a horizontal polygon (flat ring(s) [x,z,...]), facing up (or down)
  poly(rings, y, down = false, uvScale = 1) {
    if (this.lod > 2) return;
    let total = 0; for (const r of rings) total += r.length;
    const co = new Float64Array(total), holes = []; let o = 0;
    for (let k = 0; k < rings.length; k++) { if (k > 0) holes.push(o / 2); co.set(rings[k], o); o += rings[k].length; }
    const t = earcut(co, holes, 2);
    const b = this.n, ny = down ? -1 : 1, ox = Math.floor(co[0] / 512) * 512, oz = Math.floor(co[1] / 512) * 512;
    for (let k = 0; k < co.length; k += 2) this.v(co[k], y, co[k + 1], 0, ny, 0, (co[k] - ox) * uvScale, (co[k + 1] - oz) * uvScale);
    for (let k = 0; k < t.length; k += 3) {
      const a = t[k], bb = t[k + 1], c = t[k + 2];
      const cy = (co[2 * bb + 1] - co[2 * a + 1]) * (co[2 * c] - co[2 * a]) - (co[2 * bb] - co[2 * a]) * (co[2 * c + 1] - co[2 * a + 1]);
      if ((cy > 0) === !down) this.idx(b + a, b + bb, b + c); else this.idx(b + a, b + c, b + bb);
    }
  }
  // an axis-aligned box; skip: bit mask of faces left out (1 +x, 2 -x, 4 +y, 8 -y, 16 +z, 32 -z)
  abox(x0, y0, z0, x1, y1, z1, skip = 8) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
    if (!(skip & 1)) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [z1, y0, z0, y0, z0, y1, z1, y1]);
    if (!(skip & 2)) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0, y0, z1, y0, z1, y1, z0, y1]);
    if (!(skip & 4)) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0, z1, x1, z1, x1, z0, x0, z0]);
    if (!(skip & 8)) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [x0, z0, x1, z0, x1, z1, x0, z1]);
    if (!(skip & 16)) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0, y0, x1, y0, x1, y1, x0, y1]);
    if (!(skip & 32)) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [x1, y0, x0, y0, x0, y1, x1, y1]);
  }
  // a box turned by yaw about its centre (cx, y0..y1, cz), size sx (along yaw's x) by sz
  ybox(cx, y0, cz, sx, y1, sz, yaw, skip = 8) {
    const c = Math.cos(yaw), s = Math.sin(yaw), hx = sx / 2, hz = sz / 2;
    const P = (x, z) => [cx + x * c - z * s, cz + x * s + z * c];
    const q = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
    const nrm = [[s, -c], [c, s], [-s, c], [-c, -s]];    // outward for edges 0-1, 1-2, 2-3, 3-0
    const bits = [32, 1, 16, 2];
    let u = 0;
    for (let k = 0; k < 4; k++) {
      const a = q[k], b = q[(k + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!(skip & bits[k])) this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [nrm[k][0], 0, nrm[k][1]], [u, y0, u + L, y0, u + L, y1, u, y1]);
      u += L;
    }
    if (!(skip & 4)) this.quad([q[0][0], y1, q[0][1]], [q[1][0], y1, q[1][1]], [q[2][0], y1, q[2][1]], [q[3][0], y1, q[3][1]], [0, 1, 0], [q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]]);
    if (!(skip & 8)) this.quad([q[0][0], y0, q[0][1]], [q[1][0], y0, q[1][1]], [q[2][0], y0, q[2][1]], [q[3][0], y0, q[3][1]], [0, -1, 0]);
  }
  // a vertical cylinder (or cone: r1 the top radius); caps: 1 top, 2 bottom
  cyl(x, y0, z, r0, r1, h, seg = 8, caps = 1, u0 = 0) {
    if (this.lod) { if (this.lod > 2) return; const r = Math.max(r0, r1); if (this.lod > 1 ? r < 0.3 && h < 4 : r < 0.12 && h < 2.5) return; seg = this.lod > 1 ? 4 : Math.max(4, seg >> 1); }
    const b = this.n, y1 = y0 + h, sl = (r0 - r1) / h, nl = Math.hypot(1, sl);
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      this.v(x + ca * r0, y0, z + sa * r0, ca / nl, sl / nl, sa / nl, u0 + a * r0, 0);
      this.v(x + ca * r1, y1, z + sa * r1, ca / nl, sl / nl, sa / nl, u0 + a * r0, h);
    }
    for (let i = 0; i < seg; i++) { const a = b + i * 2; this.idx(a, a + 1, a + 3); this.idx(a, a + 3, a + 2); }
    if ((caps & 1) && r1 > 0.001) { const c = this.v(x, y1, z, 0, 1, 0, 0, 0); const s0 = this.n; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; this.v(x + Math.cos(a) * r1, y1, z + Math.sin(a) * r1, 0, 1, 0, 0, 0); } for (let i = 0; i < seg; i++) this.idx(c, s0 + i + 1, s0 + i); }
    if (caps & 2) { const c = this.v(x, y0, z, 0, -1, 0, 0, 0); const s0 = this.n; for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; this.v(x + Math.cos(a) * r0, y0, z + Math.sin(a) * r0, 0, -1, 0, 0, 0); } for (let i = 0; i < seg; i++) this.idx(c, s0 + i, s0 + i + 1); }
  }
  // a thin tube from a to b (cables, pipes, rods): `sides` sided
  tube(a, b, r, sides = 3) {
    if (this.lod && (this.lod > 2 || r < (this.lod > 1 ? 0.12 : 0.05))) return;
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz); if (L < 1e-5) return;
    const tx = dx / L, ty = dy / L, tz = dz / L;
    let ox = 0, oy = 1, oz = 0; if (Math.abs(ty) > 0.9) { ox = 1; oy = 0; }
    let px = ty * oz - tz * oy, py = tz * ox - tx * oz, pz = tx * oy - ty * ox; const pl = Math.hypot(px, py, pz); px /= pl; py /= pl; pz /= pl;
    const qx = ty * pz - tz * py, qy = tz * px - tx * pz, qz = tx * py - ty * px;
    const b0 = this.n;
    for (let i = 0; i < sides; i++) {
      const an = i / sides * Math.PI * 2, c = Math.cos(an), s = Math.sin(an);
      const nx = px * c + qx * s, ny = py * c + qy * s, nz = pz * c + qz * s;
      this.v(a[0] + nx * r, a[1] + ny * r, a[2] + nz * r, nx, ny, nz, 0, 0);
      this.v(b[0] + nx * r, b[1] + ny * r, b[2] + nz * r, nx, ny, nz, L, 0);
    }
    for (let i = 0; i < sides; i++) { const a0 = b0 + i * 2, a1 = b0 + ((i + 1) % sides) * 2; this.idx(a0, a1, a1 + 1); this.idx(a0, a1 + 1, a0 + 1); }
  }
  // a sagging cable between two points, n pieces
  cable(a, b, sag, r = 0.012, n = 6) {
    let last = a;
    for (let i = 1; i <= n; i++) {
      const t = i / n, s = Math.sin(t * Math.PI) * sag;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - s, a[2] + (b[2] - a[2]) * t];
      this.tube(last, p, r, 3); last = p;
    }
  }
  // a low blob (bushes, potted plants, tree crowns): an eight-sided double cone, rounded by its normals
  blob(x, y, z, rx, ry, rz, seg = 6) {
    if (this.lod) { if (this.lod > 2 || Math.max(rx, rz) < (this.lod > 1 ? 0.7 : 0.35)) return; seg = 4; }
    const b = this.n;
    this.v(x, y + ry, z, 0, 1, 0, 0, 0);
    for (let j = 1; j <= 2; j++) {
      const ph = j / 3 * Math.PI, sy = Math.cos(ph), sr = Math.sin(ph);
      for (let i = 0; i < seg; i++) { const a = (i + j * 0.5) / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); this.v(x + ca * sr * rx, y + sy * ry, z + sa * sr * rz, ca * sr, sy, sa * sr, 0, 0); }
    }
    const bot = this.v(x, y - ry, z, 0, -1, 0, 0, 0);
    for (let i = 0; i < seg; i++) {
      const i1 = (i + 1) % seg;
      this.idx(b, b + 1 + i1, b + 1 + i);
      this.idx(b + 1 + i, b + 1 + i1, b + 1 + seg + i); this.idx(b + 1 + i1, b + 1 + seg + i1, b + 1 + seg + i);
      this.idx(bot, b + 1 + seg + i, b + 1 + seg + i1);
    }
  }
  get empty() { return this.n === 0; }
  // the compact arrays (transferable): position f32x3, normal i8x3, colour u8x3, kind u8, aux u8x2, uv u16x2 (1/32 m), index
  pack() {
    const n = this.n, ni = this.ni;
    const pos = this.P.slice(0, n * 3), nor = this.N.slice(0, n * 3), col = this.C.slice(0, n * 3), kind = this.K.slice(0, n), aux = this.A.slice(0, n * 2), uv = this.U.slice(0, n * 2);
    const idx = n > 65535 ? this.I.slice(0, ni) : Uint16Array.from(this.I.subarray(0, ni));
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < pos.length; i += 3) { const x = pos[i], y = pos[i + 1], z = pos[i + 2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; }
    return { n, pos, nor, col, kind, aux, uv, idx, box: [x0, y0, z0, x1, y1, z1] };
  }
}
const Z4 = [0, 0, 0, 0, 0, 0, 0, 0];

// a wall's own frame: o the origin on the ground, t along the wall, n out of it. P(u, y, d): u along, y up, d out
export class Frame {
  constructor(ax, az, tx, tz, nx, nz, u0 = 0) { this.ax = ax; this.az = az; this.tx = tx; this.tz = tz; this.nx = nx; this.nz = nz; this.u0 = u0; }
  P(u, y, d) { return [this.ax + this.tx * u + this.nx * d, y, this.az + this.tz * u + this.nz * d]; }
  // a flat piece in the wall's plane, d out, facing out (s = 1) or in (s = -1)
  rect(b, u0, u1, y0, y1, d, s = 1) {
    const U0 = this.u0 + u0, U1 = this.u0 + u1;
    b.quad(this.P(u0, y0, d), this.P(u1, y0, d), this.P(u1, y1, d), this.P(u0, y1, d), [this.nx * s, 0, this.nz * s], [U0, y0, U1, y0, U1, y1, U0, y1]);
  }
  // a box in the wall's frame. skip bits: 1 out face, 2 back face (against the wall), 4 top, 8 bottom, 16 left (u0), 32 right (u1)
  box(b, u0, u1, y0, y1, d0, d1, skip = 2) {
    if (u0 > u1) [u0, u1] = [u1, u0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (d0 > d1) [d0, d1] = [d1, d0];
    const U0 = this.u0 + u0, U1 = this.u0 + u1, n = [this.nx, 0, this.nz], t = [this.tx, 0, this.tz];
    if (!(skip & 1)) b.quad(this.P(u0, y0, d1), this.P(u1, y0, d1), this.P(u1, y1, d1), this.P(u0, y1, d1), n, [U0, y0, U1, y0, U1, y1, U0, y1]);
    if (!(skip & 2)) b.quad(this.P(u0, y0, d0), this.P(u1, y0, d0), this.P(u1, y1, d0), this.P(u0, y1, d0), [-n[0], 0, -n[2]], [U0, y0, U1, y0, U1, y1, U0, y1]);
    if (!(skip & 4)) b.quad(this.P(u0, y1, d0), this.P(u1, y1, d0), this.P(u1, y1, d1), this.P(u0, y1, d1), [0, 1, 0], [U0, d0, U1, d0, U1, d1, U0, d1]);
    if (!(skip & 8)) b.quad(this.P(u0, y0, d0), this.P(u1, y0, d0), this.P(u1, y0, d1), this.P(u0, y0, d1), [0, -1, 0], [U0, d0, U1, d0, U1, d1, U0, d1]);
    if (!(skip & 16)) b.quad(this.P(u0, y0, d0), this.P(u0, y0, d1), this.P(u0, y1, d1), this.P(u0, y1, d0), [-t[0], 0, -t[2]], [d0, y0, d1, y0, d1, y1, d0, y1]);
    if (!(skip & 32)) b.quad(this.P(u1, y0, d0), this.P(u1, y0, d1), this.P(u1, y1, d1), this.P(u1, y1, d0), t, [d0, y0, d1, y0, d1, y1, d0, y1]);
  }
  // a sloped sheet (awning) from the wall at height y0 out to d at height y1, both sides
  slope(b, u0, u1, y0, d0, y1, d1) {
    const a = this.P(u0, y0, d0), c = this.P(u1, y0, d0), e = this.P(u1, y1, d1), f = this.P(u0, y1, d1);
    const up = [this.nx * (y0 - y1), d1 - d0, this.nz * (y0 - y1)];
    const U0 = this.u0 + u0, U1 = this.u0 + u1;
    b.quad(a, c, e, f, up, [U0, 0, U1, 0, U1, d1 - d0, U0, d1 - d0]);
    b.quad(a, c, e, f, [-up[0], -up[1], -up[2]], [U0, 0, U1, 0, U1, d1 - d0, U0, d1 - d0]);
  }
}

// polygon helpers (flat rings [x, z, ...] in metres)
export function signedArea(p) {
  let a = 0;
  for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
  return a / 2;
}
export function isConvex(p) {
  const n = p.length / 2; let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = i, b = (i + 1) % n, c = (i + 2) % n;
    const cr = (p[2 * b] - p[2 * a]) * (p[2 * c + 1] - p[2 * b + 1]) - (p[2 * b + 1] - p[2 * a + 1]) * (p[2 * c] - p[2 * b]);
    if (Math.abs(cr) < 1e-6) continue;
    const s = Math.sign(cr);
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}
export function offsetRing(p, normals, d) {
  const n = p.length / 2, out = new Float64Array(p.length);
  for (let i = 0; i < n; i++) {
    const pi = (i - 1 + n) % n;
    let nx = normals[2 * pi] + normals[2 * i], nz = normals[2 * pi + 1] + normals[2 * i + 1];
    const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    const cosHalf = nx * normals[2 * i] + nz * normals[2 * i + 1];
    const m = Math.min(2.5, 1 / Math.max(0.3, cosHalf));
    out[2 * i] = p[2 * i] + nx * d * m; out[2 * i + 1] = p[2 * i + 1] + nz * d * m;
  }
  return out;
}
export function insideRing(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}
