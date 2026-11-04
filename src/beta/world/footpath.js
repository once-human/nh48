// The mess of a real Pune footpath, drawn only (made in the painter's worker with the buildings, world/builder.js):
// pavers broken or gone to mud, slabs sunk and tipped up, manholes, a trench dug for a cable and never filled, roots
// lifting the paving, paan spat in the corners, a puddle that never dries, two-wheelers parked on the footpath, a
// handcart, a cobbler under his umbrella. How much of it depends on where you are (the area's footpath and mess
// settings, world/areas.js): Koregaon Park's are kept, Budhwar Peth's are not. It's laid along the game's own kerbs
// and inside its own footpaths (world/groundChunk.js), none of it is in the way of anything (the game's collision is
// its own) and nothing here decides anything.
import { rng, insideRing } from './geom.js';
import { K } from './kinds.js';
import { blend } from './areas.js';
import { bike } from './builder.js';

// the ground is laid this high over the road (world/groundChunk.js's KERB_H; not imported: the worker doesn't load the game)
export const KERB_H = 0.15;

const BIKES = [0x1c1c1e, 0x1c1c1e, 0x6a6a6e, 0xeeeeea, 0xb81e1e, 0x1e3a8a, 0x2f6a3a, 0x8a8a8e, 0xd8c8a0, 0x3a2a5a];
const FRUIT = [0xf2c230, 0xe8742a, 0x3a8a2a, 0xd83a2a, 0x8a3a6a, 0x9ac83a];

// what the worker needs of a chunk's ground: where it is, its kerbs, its footpaths
export function footJob(C) {
  const paths = [];
  for (const g of C.ground || []) {
    if (g.kind !== 'pavers' && g.kind !== 'bridge_sw') continue;
    const r = g.rings[0]; if (!r || r.length < 6) continue;
    paths.push({ rings: g.rings, bridge: g.kind === 'bridge_sw' });
  }
  return { ci: C.ci, cx: C.cx, cz: C.cz, kerbs: C.kerbs || [], paths };
}

// b(x, z): what to draw into there
export function footpath(F, area, b) {
  const paths = [];
  for (const g of F.paths) {
    const r = g.rings[0];
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]); }
    paths.push({ g, x0, z0, x1, z1, bridge: g.bridge });
  }
  if (!paths.length || !F.kerbs.length) return;
  const onPath = (x, z) => {
    for (const p of paths) {
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      if (!insideRing(x, z, p.g.rings[0])) continue;
      let hole = false; for (let k = 1; k < p.g.rings.length; k++) if (insideRing(x, z, p.g.rings[k])) { hole = true; break; }
      if (!hole) return p;
    }
    return null;
  };
  const R = rng(F.ci * 7919 + 17);
  const A = blend(area.at(F.cx, F.cz));
  const broken = 1 - A.fp, mess = A.mess, Y = KERB_H + 0.012;
  // walk the kerbs: the footpath is on their south side (the road's on the north, world/groundChunk.js)
  for (const p of F.kerbs) {
    let carry = R() * 6;
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3], L = Math.hypot(bx - ax, bz - az);
      if (L < 0.3) continue;
      const tx = (bx - ax) / L, tz = (bz - az) / L, nx = -tz, nz = tx;      // n: away from the road, into the footpath
      let s = carry;
      while (s < L) {
        const x = ax + tx * s, z = az + tz * s;
        const step = thing(b(x, z), R, x, z, tx, tz, nx, nz, onPath, broken, mess, A, Y);
        s += step;
      }
      carry = s - L;
    }
  }
}

// one thing on the footpath at (x, z), the kerb running along t; returns how far to the next
function thing(b, R, x, z, tx, tz, nx, nz, onPath, broken, mess, A, Y) {
  const r = R();
  const at = (d) => [x + nx * d, z + nz * d];
  const yaw = Math.atan2(tz, tx);
  // broken paving, gone to mud (more of it the worse the area keeps its footpaths)
  if (r < 0.22 * broken + 0.02) {
    const [px, pz] = at(0.5 + R() * 1.8); const P = onPath(px, pz); if (!P || P.bridge) return 2;
    const w = 0.4 + R() * 1.4 * (0.5 + broken), d = 0.3 + R() * 0.9;
    b.set(K.soil, R() < 0.5 ? 0x7a6450 : 0x6a5a48, 0.7, R());
    blobPatch(b, px, Y + 0.003, pz, w, d, yaw, R, 7);
    // the pavers round it, loose and tipped
    b.set(K.paver, 0x9a8a78, 0.6, R());
    for (let i = 0; i < 2 + R() * 4; i++) { const a = R() * 6.28, rr = w * 0.5 + R() * 0.3; b.ybox(px + Math.cos(a) * rr, Y - 0.02, pz + Math.sin(a) * rr, 0.22, Y + 0.04 + R() * 0.05, 0.11, R() * 3, 8); }
    return 3 + R() * 10 / (0.3 + broken);
  }
  // a slab sunk, one tipped up by a root
  if (r < 0.3 * broken + 0.05) {
    const [px, pz] = at(0.6 + R() * 1.6); const P = onPath(px, pz); if (!P) return 2;
    if (R() < 0.5) { b.set(K.concrete, 0x8a8478, 0.6, R()); b.ybox(px, Y - 0.06, pz, 0.6, Y - 0.025, 0.6, yaw + (R() - 0.5) * 0.2, 8); }
    else {
      b.set(K.concrete, 0x9a948a, 0.5, R());
      const tilt = 0.08 + R() * 0.1, c = Math.cos(yaw), s = Math.sin(yaw);
      const P0 = [px - c * 0.3 - s * 0.3, Y, pz - s * 0.3 + c * 0.3], P1 = [px + c * 0.3 - s * 0.3, Y, pz + s * 0.3 + c * 0.3];
      const P2 = [px + c * 0.3 + s * 0.3, Y + tilt, pz + s * 0.3 - c * 0.3], P3 = [px - c * 0.3 + s * 0.3, Y + tilt, pz - s * 0.3 - c * 0.3];
      b.quad(P0, P1, P2, P3, [0, 1, 0]);
      b.set(K.wood, 0x5a4232, 0.5); b.tube([px - s * 0.4, Y + 0.02, pz + c * 0.4], [px + s * 0.6 + c * 0.2, Y + 0.03, pz - c * 0.6 + s * 0.2], 0.05, 4);
    }
    return 4 + R() * 12;
  }
  // a manhole: the round iron lid, or a square chamber cover (some of them cracked, one or two open with a stick in)
  if (r < 0.38) {
    const [px, pz] = at(0.7 + R() * 1.2); const P = onPath(px, pz); if (!P) return 2;
    if (R() < 0.55) { b.set(K.metal, 0x3a3a3c, 0.6, R()); b.cyl(px, Y - 0.01, pz, 0.32, 0.32, 0.025, 10); b.set(K.concrete, 0x7a766e, 0.6); b.cyl(px, Y - 0.012, pz, 0.42, 0.42, 0.02, 10); }
    else { b.set(K.concrete, 0x8a857c, 0.6, R()); b.ybox(px, Y - 0.01, pz, 0.7, Y + 0.015, 0.7, yaw, 8); b.set(K.metal, 0x2a2a2a, 0.6); b.ybox(px, Y + 0.015, pz, 0.08, Y + 0.03, 0.4, yaw, 8); }
    if (R() < 0.15 * broken) { b.set(K.wood, 0x6a5a42, 0.6); b.tube([px, Y, pz], [px + 0.2, Y + 1.0, pz + 0.1], 0.025, 3); b.set(K.cloth, 0xd83a2a, 0); b.blob(px + 0.2, Y + 1.0, pz + 0.1, 0.08, 0.06, 0.08, 4); }
    return 6 + R() * 14;
  }
  // a trench for a cable, dug and left: the cut, a pipe in it, the earth heaped beside, a tape across
  if (r < 0.43 + 0.05 * broken) {
    const len = 3 + R() * 8, off = 0.6 + R() * 1.0;
    const [px, pz] = at(off), [ex, ez] = [px + tx * len, pz + tz * len];
    if (!onPath(px, pz) || !onPath(ex, ez)) return 3;
    b.set(K.soil, 0x4a3a2c, 0.9, R());
    b.quad([px - nx * 0.25, Y + 0.004, pz - nz * 0.25], [ex - nx * 0.25, Y + 0.004, ez - nz * 0.25], [ex + nx * 0.25, Y + 0.004, ez + nz * 0.25], [px + nx * 0.25, Y + 0.004, pz + nz * 0.25], [0, 1, 0]);
    b.set(K.paint, R() < 0.5 ? 0x2a5ab8 : 0xd87a2a, 0.3); b.tube([px, Y + 0.05, pz], [ex, Y + 0.05, ez], 0.06, 5);
    b.set(K.soil, 0x8a6a4c, 0.8, R());
    for (let t = 0.3; t < len; t += 0.8 + R()) b.blob(px + tx * t + nx * 0.6, Y + 0.05, pz + tz * t + nz * 0.6, 0.4, 0.18, 0.3, 5);
    if (R() < 0.5) { b.set(K.cloth, 0xf2c230, 0.2); b.tube([px + nx * 0.4, Y + 0.8, pz + nz * 0.4], [ex + nx * 0.4, Y + 0.8, ez + nz * 0.4], 0.01, 3); b.set(K.metal, 0xd83a2a, 0.3); b.tube([px + nx * 0.4, Y, pz + nz * 0.4], [px + nx * 0.4, Y + 0.85, pz + nz * 0.4], 0.02, 3); b.tube([ex + nx * 0.4, Y, ez + nz * 0.4], [ex + nx * 0.4, Y + 0.85, ez + nz * 0.4], 0.02, 3); }
    return len + 5 + R() * 20;
  }
  // paan spat at the foot of a wall, oil, a damp patch
  if (r < 0.52 + 0.1 * mess) {
    const [px, pz] = at(0.3 + R() * 2.4); if (!onPath(px, pz)) return 2;
    b.set(K.stain, R() < 0.6 ? 0x8a2a1e : 0x3a342c, 0.8, R());
    blobPatch(b, px, Y + 0.002 + R() * 0.002, pz, 0.2 + R() * 0.5, 0.15 + R() * 0.4, R() * 6, R, 6);
    return 1.5 + R() * 6;
  }
  // a puddle that never quite dries
  if (r < 0.57 + 0.04 * broken) {
    const [px, pz] = at(0.4 + R() * 1.8); if (!onPath(px, pz)) return 2;
    b.set(K.water, 0x3a4a48, 0.2, R());
    blobPatch(b, px, Y + 0.004, pz, 0.5 + R() * 1.2, 0.4 + R() * 0.8, R() * 6, R, 8);
    return 4 + R() * 10;
  }
  // mud washed up against the kerb
  if (r < 0.64 + 0.05 * broken) {
    const len = 1 + R() * 4; const [px, pz] = at(0.15); if (!onPath(px, pz)) return 2;
    b.set(K.soil, 0x8a7458, 0.8, R());
    b.quad([px, Y + 0.003, pz], [px + tx * len, Y + 0.003, pz + tz * len], [px + tx * len + nx * 0.35, Y + 0.003, pz + tz * len + nz * 0.35], [px + nx * 0.2, Y + 0.003, pz + nz * 0.2], [0, 1, 0]);
    return len + 2 + R() * 6;
  }
  // two-wheelers parked on the footpath, nose to the shops (a row of them where it's busy)
  if (r < 0.78 + 0.08 * mess) {
    const n = 1 + Math.floor(R() * (1 + mess * 6));
    let s = 0;
    for (let i = 0; i < n; i++) {
      const [px, pz] = at(1.1 + R() * 0.3); const qx = px + tx * s, qz = pz + tz * s;
      if (!onPath(qx, qz)) break;
      bike(b, qx, Y, qz, Math.atan2(-nx, -nz) + (R() - 0.5) * 0.4, BIKES[(R() * BIKES.length) | 0]);
      s += 0.75 + R() * 0.35;
    }
    return s + 3 + R() * 10;
  }
  // a handcart of fruit, an umbrella over it
  if (r < 0.86 + 0.04 * mess && A.wealth < 0.8) {
    const [px, pz] = at(0.9); if (!onPath(px, pz)) return 3;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    b.set(K.wood, 0x6a4a32, 0.6, R()); b.ybox(px, Y + 0.6, pz, 1.8, Y + 0.72, 0.9, yaw, 0);
    b.set(K.plain, 0x1a1a1a, 0.5);
    for (const sx of [-0.6, 0.6]) for (const sz of [-0.48, 0.48]) b.cyl(px + c * sx - s * sz, Y, pz + s * sx + c * sz, 0.03, 0.03, 0.6, 4, 0);
    b.set(K.metal, 0x2a2a2a, 0.5); b.tube([px - c * 0.9, Y + 0.65, pz - s * 0.9], [px - c * 1.4, Y + 0.85, pz - s * 1.4], 0.025, 3);
    for (let i = 0; i < 14; i++) { b.set(K.leaf, FRUIT[(R() * FRUIT.length) | 0], 0.2); const u = (R() - 0.5) * 1.6, v = (R() - 0.5) * 0.75; b.blob(px + c * u - s * v, Y + 0.8, pz + s * u + c * v, 0.13, 0.09, 0.13, 4); }
    if (R() < 0.7) umbrella(b, px, Y + 0.72, pz, R);
    return 12 + R() * 25;
  }
  // a cobbler: his box, a low stool, shoes laid out, a faded umbrella
  if (r < 0.9) {
    const [px, pz] = at(1.2); if (!onPath(px, pz)) return 3;
    b.set(K.wood, 0x5a3a24, 0.7, R()); b.ybox(px, Y, pz, 0.6, Y + 0.4, 0.4, yaw, 8);
    b.set(K.plain, 0x3a3a3a, 0.6); b.ybox(px + nx * 0.6, Y, pz + nz * 0.6, 0.35, Y + 0.25, 0.3, yaw, 8);
    b.set(K.tarp, 0x2a5ab8, 0.4); b.quad([px - tx * 0.9 - nx * 0.4, Y + 0.004, pz - tz * 0.9 - nz * 0.4], [px + tx * 0.9 - nx * 0.4, Y + 0.004, pz + tz * 0.9 - nz * 0.4], [px + tx * 0.9 + nx * 0.9, Y + 0.004, pz + tz * 0.9 + nz * 0.9], [px - tx * 0.9 + nx * 0.9, Y + 0.004, pz - tz * 0.9 + nz * 0.9], [0, 1, 0]);
    b.set(K.plain, 0x2a1a12, 0.5); for (let i = 0; i < 5; i++) { const u = (i - 2) * 0.28; b.ybox(px + tx * u - nx * 0.3, Y, pz + tz * u - nz * 0.3, 0.1, Y + 0.08, 0.26, yaw + Math.PI / 2, 8); }
    umbrella(b, px + nx * 0.3, Y, pz + nz * 0.3, R, 0x1a1a1e);
    return 30 + R() * 40;
  }
  return 2 + R() * 6;
}

// a flat ragged patch on the ground
function blobPatch(b, x, y, z, w, d, yaw, R, n) {
  const c = Math.cos(yaw), s = Math.sin(yaw), pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = 0.7 + R() * 0.45; const u = Math.cos(a) * w * 0.5 * rr, v = Math.sin(a) * d * 0.5 * rr; pts.push([x + c * u - s * v, y, z + s * u + c * v]); }
  for (let i = 0; i < n; i++) b.tri([x, y, z], pts[i], pts[(i + 1) % n], [0, 1, 0], [0, 0], [pts[i][0] - x, pts[i][2] - z], [pts[(i + 1) % n][0] - x, pts[(i + 1) % n][2] - z]);
}
function umbrella(b, x, y, z, R, col) {
  const h = 1.9, r = 1.1, c = col ?? [0x2a5ab8, 0xd83a2a, 0xf2c230, 0x2f8a5a, 0x1a1a1e][(R() * 5) | 0];
  b.set(K.metal, 0x3a3a3a, 0.4); b.tube([x, y, z], [x, y + h, z], 0.02, 3);
  b.set(K.cloth, c, 0.4, R());
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283;
    const p0 = [x + Math.cos(a0) * r, y + h - 0.35, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y + h - 0.35, z + Math.sin(a1) * r];
    b.tri([x, y + h + 0.05, z], p0, p1, [0, 1, 0]); b.tri([x, y + h + 0.05, z], p0, p1, [0, -1, 0]);
  }
}
