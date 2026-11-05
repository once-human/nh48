// The mess of a real Pune footpath, drawn only (made in the painter's worker with the buildings, world/builder.js):
// pavers broken or gone to mud, slabs sunk and tipped up, manholes, a trench dug for a cable and never filled, roots
// lifting the paving, paan spat in the corners, a puddle that never dries, two-wheelers parked on the footpath, a
// handcart, a cobbler under his umbrella. How much of it depends on where you are (the area's footpath and mess
// settings, world/areas.js): Koregaon Park's are kept, Budhwar Peth's are not. It's laid along the game's own kerbs
// and inside its own footpaths (world/groundChunk.js), none of it is in the way of anything (the game's collision is
// its own) and nothing here decides anything, except that what stands up off it is solid: the handcarts, the cobbler's
// box and stool, the umbrella poles, the posts of a trench's tape go out as F.solids (rings and posts, world/buildings.js
// puts them into the collision while the close-up drawing's in).
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
  SOL = F.solids = [];
  const A = blend(area.at(F.cx, F.cz));
  const broken = 1 - A.fp, mess = A.mess, Y = KERB_H + 0.012;
  // walk the kerbs: the footpath is on their south side (the road's on the north, world/groundChunk.js)
  for (const p of F.kerbs) {
    let carry = R() * 6;
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3], L = Math.hypot(bx - ax, bz - az);
      if (L < 0.3) continue;
      const tx = (bx - ax) / L, tz = (bz - az) / L, nx = -tz, nz = tx;      // n: away from the road, into the footpath
      if (b(ax, az).rich) kerbSide(b, R, ax, az, tx, tz, nx, nz, L, Y, onPath, broken, mess);
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

// the kerb itself, stone by stone (each with its own colour, height and lean, its road edge chamfered), and what
// collects along it: the storm drain's grates, tar patches, cracks, litter in the gutter, the paving a little uneven.
function kerbSide(b, R, ax, az, tx, tz, nx, nz, L, Y, onPath, broken, mess) {
  const P = (x, z, d, y) => [x + nx * d, y, z + nz * d];
  for (let s = 0; s < L;) {
    const len = Math.min(0.5 + R() * 0.5, L - s); if (len < 0.08) break;
    const x0 = ax + tx * (s + 0.005), z0 = az + tz * (s + 0.005), x1 = ax + tx * (s + len - 0.005), z1 = az + tz * (s + len - 0.005), w = b(x0, z0);
    const tone = 0.74 + R() * 0.34, c = [0.58 * tone, 0.57 * tone, 0.53 * tone], top = Y + 0.002 + R() * 0.016 * (1 + broken), lean = R() * 0.01, ch = 0.028;
    w.set(K.concrete, c, 0.45 + R() * 0.5, R());
    w.quad(P(x0, z0, -0.032, 0), P(x1, z1, -0.032, 0), P(x1, z1, -0.032, top - ch), P(x0, z0, -0.032, top - ch), [-nx, 0, -nz]);
    w.quad(P(x0, z0, -0.032, top - ch), P(x1, z1, -0.032, top - ch), P(x1, z1, -0.004, top), P(x0, z0, -0.004, top), [-nx * 0.7, 0.7, -nz * 0.7]);
    w.quad(P(x0, z0, -0.004, top), P(x1, z1, -0.004, top), P(x1, z1, 0.15, top - lean), P(x0, z0, 0.15, top - lean), [0, 1, 0]);
    w.quad(P(x0, z0, 0.15, top - lean), P(x1, z1, 0.15, top - lean), P(x1, z1, 0.15, Y - 0.01), P(x0, z0, 0.15, Y - 0.01), [nx, 0, nz]);
    w.quad(P(x1, z1, -0.032, 0), P(x1, z1, 0.15, 0), P(x1, z1, 0.15, top - lean), P(x1, z1, -0.032, top), [tx, 0, tz]);
    w.quad(P(x0, z0, -0.032, 0), P(x0, z0, 0.15, 0), P(x0, z0, 0.15, top - lean), P(x0, z0, -0.032, top), [-tx, 0, -tz]);
    s += len;
  }
  const RY = 0.016;
  // grates in the gutter
  for (let s = 3 + R() * 14; s < L - 0.7; s += 14 + R() * 26) {
    const x = ax + tx * s - nx * 0.24, z = az + tz * s - nz * 0.24, w = b(x, z), yaw = Math.atan2(tz, tx);
    w.set(K.concrete, 0x5a5854, 0.7, R()); w.ybox(x, 0.004, z, 0.96, RY + 0.006, 0.42, yaw, 8);
    w.set(K.plain, 0x0c0c0c, 0.2); w.ybox(x, 0.006, z, 0.82, RY + 0.009, 0.3, yaw, 8);
    w.set(K.metal, 0x34302c, 0.8, R()); for (let k = -3; k <= 3; k++) w.ybox(x + tx * k * 0.11, 0.008, z + tz * k * 0.11, 0.04, RY + 0.014, 0.31, yaw, 8);
  }
  // tar patches and cracks on the road, cracks in the paving
  for (let s = R() * 18; s < L; s += 8 + R() * (28 - broken * 14)) {
    const d = -(0.3 + R() * 2.6), x = ax + tx * s + nx * d, z = az + tz * s + nz * d, w = b(x, z);
    if (R() < 0.45) { w.set(K.oldRoad, R() < 0.5 ? 0x2e2e30 : 0x3e3c3a, 0.5 + R() * 0.5, R()); ragged(w, x, 0.011 + R() * 0.003, z, 0.7 + R() * 3, 0.5 + R() * 1.4, Math.atan2(tz, tx), R, 12); }
    else crack(w, R, x, 0.013, z, 3 + R() * 5);
  }
  for (let s = R() * 12; s < L; s += 6 + R() * 16) {
    const d = 0.25 + R() * 2.2, x = ax + tx * s + nx * d, z = az + tz * s + nz * d; if (onPath(x, z)) crack(b(x, z), R, x, Y + 0.004, z, 2 + R() * 4);
  }
  // litter: along the gutter mostly
  const LIT = [0xe8e4d8, 0xe8e4d8, 0xc9c0ac, 0xd83a2a, 0x2a5ab8, 0xf2c230, 0x3a8a2a, 0x7a5a3a, 0x9a7a4a];
  for (let s = R() * 2; s < L; s += 0.5 + R() * (4.5 - mess * 3.2)) {
    const onRoad = R() < 0.72, d = onRoad ? -(0.05 + R() * R() * 0.8) : 0.2 + R() * 2, x = ax + tx * s + nx * d, z = az + tz * s + nz * d, y = onRoad ? RY : Y + 0.004;
    if (!onRoad && !onPath(x, z)) continue;
    const w = b(x, z), r = R();
    if (r < 0.55) { const a = R() * 6.28, c = Math.cos(a), si = Math.sin(a), hu = 0.03 + R() * 0.07, hv = 0.02 + R() * 0.05, lift = 0.004 + R() * 0.012; w.set(K.plain, LIT[(R() * LIT.length) | 0], 0.6, R()); w.quad([x - c * hu - si * hv, y, z - si * hu + c * hv], [x + c * hu - si * hv, y + lift, z + si * hu + c * hv], [x + c * hu + si * hv, y, z + si * hu - c * hv], [x - c * hu + si * hv, y + lift * 0.5, z - si * hu - c * hv], [0, 1, 0]); }
    else if (r < 0.85) { w.set(K.leaf, R() < 0.5 ? 0x7a5a2a : 0x5a4a22, 0.5, R()); for (let k = 0; k < 3; k++) { const a = R() * 6.28, q = 0.04 + R() * 0.03, ox = (R() - 0.5) * 0.2, oz = (R() - 0.5) * 0.2; w.tri([x + ox, y + 0.002, z + oz], [x + ox + Math.cos(a) * q, y + 0.002, z + oz + Math.sin(a) * q], [x + ox + Math.cos(a + 1.2) * q, y + 0.012, z + oz + Math.sin(a + 1.2) * q], [0, 1, 0]); } }
    else if (r < 0.93) { const a = R() * 6.28; w.set(K.plain, R() < 0.5 ? 0xa8c8d8 : 0xdcdcd4, 0.2, R()); w.tube([x, y + 0.03, z], [x + Math.cos(a) * 0.2, y + 0.03, z + Math.sin(a) * 0.2], 0.03, 6); }
    else { w.set(K.stone, 0x6a665e, 0.5, R()); w.blob(x, y, z, 0.03 + R() * 0.05, 0.02 + R() * 0.03, 0.03 + R() * 0.04, 5); }
  }
  // the paving, a paver here and there sitting proud of the rest (every one, in Ultra)
  if (b(ax, az).rich > 1) for (let s = 0; s < L; s += 0.5 + R() * 0.9) {
    const x = ax + tx * s + nx * (0.25 + R() * 2.3), z = az + tz * s + nz * (0.25 + R() * 2.3); if (!onPath(x, z)) continue;
    const w = b(x, z); w.set(K.paver, 0x9a8a78, 0.5 + R() * 0.4, R()); w.ybox(x, Y - 0.01, z, 0.215, Y + 0.002 + R() * 0.012, 0.105, Math.atan2(tz, tx) + (R() < 0.5 ? 0 : Math.PI / 2) + (R() - 0.5) * 0.08, 8);
  }
}
// a patch with a torn edge
function ragged(b, x, y, z, w, d, yaw, R, n) { blobPatch(b, x, y, z, w, d, yaw, R, n); }
// a crack: a thin dark line wandering across a surface, with a branch
function crack(b, R, x, y, z, len) {
  b.set(K.stain, 0x121110, 0.8, R());
  let a = R() * 6.28, px = x, pz = z; const n = Math.ceil(len / 0.35);
  for (let i = 0; i < n; i++) { a += (R() - 0.5) * 1.1; const q = 0.2 + R() * 0.3, qx = px + Math.cos(a) * q, qz = pz + Math.sin(a) * q, w = 0.007 + R() * 0.012, ox = -Math.sin(a) * w, oz = Math.cos(a) * w; b.quad([px - ox, y, pz - oz], [qx - ox, y, qz - oz], [qx + ox, y, qz + oz], [px + ox, y, pz + oz], [0, 1, 0]);
    if (R() < 0.18) { const b2 = a + (R() < 0.5 ? 1 : -1) * (0.6 + R()), ex = px + Math.cos(b2) * 0.3, ez = pz + Math.sin(b2) * 0.3; b.quad([px - ox * 0.6, y, pz - oz * 0.6], [ex, y, ez], [ex, y, ez], [px + ox * 0.6, y, pz + oz * 0.6], [0, 1, 0]); }
    px = qx; pz = qz; }
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
    if (R() < 0.15 * broken) { b.set(K.wood, 0x6a5a42, 0.6); b.tube([px, Y, pz], [px + 0.2, Y + 1.0, pz + 0.1], 0.025, 3); post(px + 0.05, pz + 0.03, 0.05); b.set(K.cloth, 0xd83a2a, 0); b.blob(px + 0.2, Y + 1.0, pz + 0.1, 0.08, 0.06, 0.08, 4); }
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
    if (R() < 0.5) { b.set(K.cloth, 0xf2c230, 0.2); b.tube([px + nx * 0.4, Y + 0.8, pz + nz * 0.4], [ex + nx * 0.4, Y + 0.8, ez + nz * 0.4], 0.01, 3); b.set(K.metal, 0xd83a2a, 0.3); b.tube([px + nx * 0.4, Y, pz + nz * 0.4], [px + nx * 0.4, Y + 0.85, pz + nz * 0.4], 0.02, 3); b.tube([ex + nx * 0.4, Y, ez + nz * 0.4], [ex + nx * 0.4, Y + 0.85, ez + nz * 0.4], 0.02, 3); post(px + nx * 0.4, pz + nz * 0.4, 0.04); post(ex + nx * 0.4, ez + nz * 0.4, 0.04); }
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
  // (two-wheelers on the footpath are the game's own parked ones now, real and rideable: none drawn in here)
  if (r < 0.78 + 0.08 * mess) return 3 + R() * 10;
  // a handcart of fruit, an umbrella over it
  if (r < 0.86 + 0.04 * mess && A.wealth < 0.8) {
    const [px, pz] = at(0.9); if (!onPath(px, pz)) return 3;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    b.set(K.wood, 0x6a4a32, 0.6, R()); b.ybox(px, Y + 0.6, pz, 1.8, Y + 0.72, 0.9, yaw, 0);
    box(px, pz, 1.8, 0.9, yaw); box(px - c * 1.15, pz - s * 1.15, 0.5, 0.06, yaw);      // (the bed, the handle)
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
    box(px, pz, 0.6, 0.4, yaw); box(px + nx * 0.6, pz + nz * 0.6, 0.35, 0.3, yaw);
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
  b.set(K.metal, 0x3a3a3a, 0.4); b.tube([x, y, z], [x, y + h, z], 0.02, 3); post(x, z, 0.04);
  b.set(K.cloth, c, 0.4, R());
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283;
    const p0 = [x + Math.cos(a0) * r, y + h - 0.35, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y + h - 0.35, z + Math.sin(a1) * r];
    b.tri([x, y + h + 0.05, z], p0, p1, [0, 1, 0]); b.tri([x, y + h + 0.05, z], p0, p1, [0, -1, 0]);
  }
}

// what's solid of it: a box w x d (w along yaw) round (x, z) as its four corners, or a post
let SOL = null;
function box(x, z, w, d, yaw) {
  if (!SOL) return;
  const c = Math.cos(yaw), s = Math.sin(yaw), u = w / 2, v = d / 2;
  SOL.push(['r', [x - c * u + s * v, z - s * u - c * v, x + c * u + s * v, z + s * u - c * v, x + c * u - s * v, z + s * u + c * v, x - c * u - s * v, z - s * u + c * v]]);
}
function post(x, z, r) { if (SOL) SOL.push(['c', x, z, r]); }
