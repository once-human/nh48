// Everything in the street is solid in its own shape. A stall, a bus shelter, a street-name board, a banner frame was
// a 0.9 m circle at its middle or nothing at all: you walked through the ends of a shelter's bench and the banners'
// bamboo, and bumped into air beside a cart. Each model's footprint is now worked out from the model itself: the parts
// of it between your ankles and your head (0.05 m to 1.7 m up: a banner's bottom rail or a shelter's roof you walk
// under, its plinth you step over), laid out on a 6 cm grid, each separate piece (a post, the counter, a stool, the
// bench) as the few rectangles that cover it, and those go into the collision as walls round them.
import * as THREE from 'three';
import { signedArea, offsetRing } from './geom.js';

const CELL = 0.06, Y0 = 0.05, Y1 = 1.7;
const cache = new Map();

// the pieces of a model's footprint: [[x0, z0, x1, z1] in its own frame] or a circle [x, z, r] for a thin post
function footprint(geo) {
  if (cache.has(geo)) return cache.get(geo);
  const pos = geo.attributes.position, idx = geo.index, n = idx ? idx.count : pos.count;
  const cells = new Set(), K = (i, j) => i*4096 + j;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  let mi = 1e9, mj = 1e9, Mi = -1e9, Mj = -1e9;
  const mark = (x, z) => { const i = Math.floor(x/CELL) + 2048, j = Math.floor(z/CELL) + 2048; cells.add(K(i, j)); if (i < mi) mi = i; if (i > Mi) Mi = i; if (j < mj) mj = j; if (j > Mj) Mj = j; };
  for (let t = 0; t + 2 < n; t += 3) {
    const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    const ylo = Math.min(a.y, b.y, c.y), yhi = Math.max(a.y, b.y, c.y);
    if (yhi < Y0 || ylo > Y1) continue;
    // sample the triangle finely enough to touch every cell under it, keeping only the samples in the height band
    const L = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)), N = Math.max(1, Math.ceil(L/(CELL*0.5)));
    for (let u = 0; u <= N; u++) for (let v = 0; v <= N - u; v++) {
      const w = N - u - v;
      p.set(0, 0, 0).addScaledVector(a, u/N).addScaledVector(b, v/N).addScaledVector(c, w/N);
      if (p.y >= Y0 && p.y <= Y1) mark(p.x, p.z);
    }
  }
  // separate pieces (cells touching, corners too), each covered by rectangles: runs along each row, a run merged
  // with the one under it when they span the same cells
  const out = [], seen = new Set();
  for (const k0 of cells) {
    if (seen.has(k0)) continue;
    const comp = [], st = [k0]; seen.add(k0);
    while (st.length) {
      const k = st.pop(); comp.push(k);
      const i = Math.floor(k/4096), j = k % 4096;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const q = K(i + di, j + dj); if (cells.has(q) && !seen.has(q)) { seen.add(q); st.push(q); } }
    }
    let ci0 = 1e9, cj0 = 1e9, ci1 = -1e9, cj1 = -1e9;
    for (const k of comp) { const i = Math.floor(k/4096), j = k % 4096; ci0 = Math.min(ci0, i); ci1 = Math.max(ci1, i); cj0 = Math.min(cj0, j); cj1 = Math.max(cj1, j); }
    const w = (ci1 - ci0 + 1)*CELL, d = (cj1 - cj0 + 1)*CELL;
    const X = (i) => (i - 2048)*CELL, Z = (j) => (j - 2048)*CELL;
    // a post or a pipe: a circle
    if (w <= 0.3 && d <= 0.3) { out.push([(X(ci0) + X(ci1 + 1))/2, (Z(cj0) + Z(cj1 + 1))/2, Math.max(w, d)/2]); continue; }
    // mostly solid: one box round it
    if (comp.length >= 0.7*(ci1 - ci0 + 1)*(cj1 - cj0 + 1)) { out.push([X(ci0), Z(cj0), X(ci1 + 1), Z(cj1 + 1)]); continue; }
    const set = new Set(comp), rects = [];          // [i0, i1, j0, j1] in cells
    let open = [];
    for (let j = cj0; j <= cj1; j++) {
      const next = [];
      for (let i = ci0; i <= ci1; i++) {
        if (!set.has(K(i, j))) continue;
        const s = i; while (i + 1 <= ci1 && set.has(K(i + 1, j))) i++;
        const o = open.find((r) => r[0] === s && r[1] === i);
        if (o) { o[3] = j; next.push(o); } else { const r = [s, i, j, j]; rects.push(r); next.push(r); }
      }
      open = next;
    }
    for (const [i0, i1, j0, j1] of rects) out.push([X(i0), Z(j0), X(i1 + 1), Z(j1 + 1)]);
  }
  cache.set(geo, out);
  return out;
}

// put a model's footprint into the collision, placed as compose(x, y, z, ry) places it
function place(C, geo, x, z, ry, kind = 2) {
  const cs = Math.cos(ry), sn = Math.sin(ry), W = (lx, lz) => [x + lx*cs + lz*sn, z - lx*sn + lz*cs];
  for (const f of footprint(geo)) {
    if (f.length === 3) { const [cx, cz] = W(f[0], f[1]); C.addCircle(cx, cz, f[2], kind); continue; }
    const [x0, z0, x1, z1] = f;
    if (x1 - x0 < 0.02 || z1 - z0 < 0.02) continue;
    C.addRing([W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)].flat(), kind);
  }
}

// what the game calls (propsChunk.js and tiles.js, patched in tools/build-beta.mjs)
export function makeSolids(W) {
  return {
    // a stall [x, z, a, kind] (cm), drawn at compose(x, 0.15, z, atan2(cos a, sin a))
    stall(s, C) {
      const P = W.proto, geo = P && (P['stall' + s[3]] || P.stall0);
      if (!geo) { C.addCircle(s[0]/100, s[1]/100, 0.9, 2); return; }
      place(C, geo, s[0]/100, s[1]/100, Math.atan2(Math.cos(s[2]), Math.sin(s[2])));
    },
    // a bus shelter [x, z, a] (cm), drawn at compose(x, 0.15, z, atan2(cos a, sin a))
    bus(b, C) {
      const P = W.proto;
      if (!P || !P.bus) { C.addCircle(b[0]/100, b[1]/100, 0.9, 2); return; }
      place(C, P.bus, b[0]/100, b[1]/100, Math.atan2(Math.cos(b[2]), Math.sin(b[2])));
    },
    // a street-name board or a banner frame at (x, z), its face to (fx, fz): drawn at ry = atan2(-fx, -fz)
    board(kind, x, z, fx, fz, C) {
      const P = W.proto, geo = P && (kind === 'banner' ? P.bannerFrame : P.streetBoard);
      if (!geo) { if (kind !== 'banner') C.addCircle(x, z, 0.12, 2); return; }
      place(C, geo, x, z, Math.atan2(-fx, -fz));
    },
  };
}

// A building's collision: its outline as a wall, except a petrol pump's canopy (style 7), a roof on columns you drive
// in under: only its columns and the two pumps are solid, where world/builder.js's canopy() stands them.
export function buildingSolid(B, ring, C) {
  if (B[3] !== 7) { C.addRing(ring, 0); return; }
  const p = ring, n = p.length / 2; if (n < 3) return;
  const sgn = signedArea(p) > 0 ? 1 : -1, normals = new Float64Array(p.length);
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, dx = p[2 * j] - p[2 * i], dz = p[2 * j + 1] - p[2 * i + 1], L = Math.hypot(dx, dz) || 1;
    normals[2 * i] = sgn * dz / L; normals[2 * i + 1] = -sgn * dx / L; cx += p[2 * i]; cz += p[2 * i + 1];
  }
  cx /= n; cz /= n;
  const sq = (x, z, w, d) => C.addRing([x - w / 2, z - d / 2, x + w / 2, z - d / 2, x + w / 2, z + d / 2, x - w / 2, z + d / 2], 2);
  const inner = offsetRing(p, normals, -1.5);
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 4))) sq(inner[2 * i], inner[2 * i + 1], 0.5, 0.5);
  for (const k of [-1, 1]) sq(cx + k * 2.5, cz, 0.8, 0.5);
}
