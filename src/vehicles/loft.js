// Smooth vehicle bodies: a loft through rounded cross-sections (superellipses) placed along the
// vehicle's length. Normals come from the shared grid, so the surface shades smoothly like a
// moulded panel; colours are assigned per quad (body paint, glass, trim) so the window lines stay crisp.
import * as THREE from 'three';

// sec: { x, w (half width at the shoulder), yb, yt, n (squareness, 2 = ellipse .. 6 = boxy),
//        tw (top half-width factor: tumblehome), bw (bottom half-width factor), seg (tag for the
//        strip from this section to the next) }
// colorOf(seg, q) -> [r, g, b, paint, glow]   q: { y, z, nx, ny, nz, ring (0..1 around), top: bool }
export function loft(b, secs, colorOf, opts = {}) {
  const M = opts.ring || 24;
  const S = secs.length;
  const P = new Float32Array(S * M * 3);
  for (let i = 0; i < S; i++) {
    const s = secs[i], n = s.n || 4, cy = (s.yb + s.yt) / 2, hh = Math.max(0.001, (s.yt - s.yb) / 2);
    for (let k = 0; k < M; k++) {
      const a = (k / M) * Math.PI * 2 - Math.PI / 2;       // k = 0 at the bottom centre, going round
      const c = Math.cos(a), sn = Math.sin(a);
      const zz = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), yy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      const wf = yy > 0 ? 1 + ((s.tw ?? 1) - 1) * yy : 1 + ((s.bw ?? 1) - 1) * -yy;
      const o = (i * M + k) * 3;
      P[o] = s.x; P[o + 1] = cy + yy * hh; P[o + 2] = zz * s.w * wf;
    }
  }
  // smooth normals from the grid (central differences across the ring and along the length)
  const N = new Float32Array(S * M * 3);
  const v = (i, k) => { k = (k + M) % M; i = Math.max(0, Math.min(S - 1, i)); const o = (i * M + k) * 3; return [P[o], P[o + 1], P[o + 2]]; };
  for (let i = 0; i < S; i++) for (let k = 0; k < M; k++) {
    const a = v(i, k + 1), c = v(i, k - 1), d = v(i + 1, k), e = v(i - 1, k);
    const tx = a[0] - c[0], ty = a[1] - c[1], tz = a[2] - c[2];          // around the ring
    let lx = d[0] - e[0], ly = d[1] - e[1], lz = d[2] - e[2];             // along the length
    if (Math.abs(lx) + Math.abs(ly) + Math.abs(lz) < 1e-6) { lx = 1; ly = 0; lz = 0; }
    let nx = ty * lz - tz * ly, ny = tz * lx - tx * lz, nz = tx * ly - ty * lx;
    const L = Math.hypot(nx, ny, nz) || 1;
    const o = (i * M + k) * 3;
    // ring runs counter-clockwise seen from +x, length runs +x: this cross product points outward
    N[o] = -nx / L; N[o + 1] = -ny / L; N[o + 2] = -nz / L;
  }
  // emit strips with per-quad colour (vertices duplicated per strip so colour edges stay sharp)
  const add = (o, col) => b.v(P[o], P[o + 1], P[o + 2], N[o], N[o + 1], N[o + 2], col[0], col[1], col[2], col[4] || 0, col[3] || 0);
  for (let i = 0; i < S - 1; i++) {
    const seg = secs[i].seg;
    if (seg === 'skip') continue;
    for (let k = 0; k < M; k++) {
      const k2 = (k + 1) % M;
      const o00 = (i * M + k) * 3, o01 = (i * M + k2) * 3, o10 = ((i + 1) * M + k) * 3, o11 = ((i + 1) * M + k2) * 3;
      const y = (P[o00 + 1] + P[o01 + 1] + P[o10 + 1] + P[o11 + 1]) / 4, z = (P[o00 + 2] + P[o01 + 2] + P[o10 + 2] + P[o11 + 2]) / 4;
      const nx = (N[o00] + N[o01] + N[o10] + N[o11]) / 4, ny = (N[o00 + 1] + N[o01 + 1] + N[o10 + 1] + N[o11 + 1]) / 4, nz = (N[o00 + 2] + N[o01 + 2] + N[o10 + 2] + N[o11 + 2]) / 4;
      const x = (P[o00] + P[o10]) / 2;
      const col = colorOf(seg, { x, y, z, nx, ny, nz, ring: (k + 0.5) / M, i });
      if (!col) continue;
      const a = add(o00, col), bb = add(o01, col), c = add(o11, col), d = add(o10, col);
      // outward winding
      b.i.push(a, d, c, a, c, bb);
      if (opts.inner) {
        // the inside face, a little inward, facing in (open canopies, car interiors). colorOf is asked
        // again with inside: true so glass can be left open from within; default: darker outer colour
        const t = opts.inner;
        let dk = opts.innerColor ? colorOf(seg, { x, y, z, nx, ny, nz, ring: (k + 0.5) / M, i, inside: true }) : col.slice();
        if (!dk) continue;
        if (!opts.innerColor) { dk[0] *= 0.55; dk[1] *= 0.55; dk[2] *= 0.55; }
        const addIn = (o) => b.v(P[o] - N[o] * t, P[o + 1] - N[o + 1] * t, P[o + 2] - N[o + 2] * t, -N[o], -N[o + 1], -N[o + 2], dk[0], dk[1], dk[2], dk[4] || 0, dk[3] || 0);
        const ia = addIn(o00), ib = addIn(o01), ic = addIn(o11), id = addIn(o10);
        b.i.push(ia, ic, id, ia, ib, ic);
      }
    }
  }
  // end caps (flat, facing out along x)
  for (const [i, dir] of [[0, -1], [S - 1, 1]]) {
    if (opts.caps === false) continue;
    const col = colorOf(dir < 0 ? 'capRear' : 'capFront', { y: 0, z: 0, nx: dir, ny: 0, nz: 0, ring: 0, i });
    if (!col) continue;
    const s = secs[i];
    const c0 = b.v(s.x, (s.yb + s.yt) / 2, 0, dir, 0, 0, col[0], col[1], col[2], col[4] || 0, col[3] || 0);
    const ring = [];
    for (let k = 0; k < M; k++) { const o = (i * M + k) * 3; ring.push(b.v(P[o], P[o + 1], P[o + 2], dir, 0, 0, col[0], col[1], col[2], col[4] || 0, col[3] || 0)); }
    for (let k = 0; k < M; k++) {
      const a = ring[k], c = ring[(k + 1) % M];
      // the ring runs clockwise seen from the front, anticlockwise seen from behind
      if (dir > 0) b.i.push(c0, c, a); else b.i.push(c0, a, c);
    }
  }
}

// a flat disc/arch decal facing ±z (wheel-arch shadows on the body side)
export function archDecal(b, x, y, z, r, side, col) {
  const segs = 12, base = b.c;
  b.v(x, y, z, 0, 0, side, col[0], col[1], col[2]);
  for (let k = 0; k <= segs; k++) {
    const a = Math.PI * k / segs;
    b.v(x + Math.cos(a) * r, y + Math.sin(a) * r, z, 0, 0, side, col[0], col[1], col[2]);
  }
  for (let k = 0; k < segs; k++) { if (side > 0) b.i.push(base, base + 1 + k, base + 2 + k); else b.i.push(base, base + 2 + k, base + 1 + k); }
}
