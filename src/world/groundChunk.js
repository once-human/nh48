// Per-chunk ground: road surfaces, footpaths, open ground, kerbs (black/yellow near chowks),
// river water + stone embankments, bridge decks and parapets, lane paint, zebras, speed
// breakers and potholes. UVs are in metres; the PBR ground material picks the scale per layer.
import * as THREE from 'three';
import { triangulate, QuadBuilder, dashes, walkLine } from './geo.js';
import { GL } from '../gfx/pbr.js';
import { DECAL } from '../gfx/textures.js';
import { RNG } from '../core/util.js';
import { pointInRings } from './mapdata.js';
import { scatterTufts } from './grass.js';

export const KERB_H = 0.15;
export const WATER_Y = -2.4;

export class GB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.l = []; this.s = []; this.i = []; this.c = 0; }
  v(x, y, z, nx, ny, nz, u, w, layer, shade = 1) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.l.push(layer); this.s.push(shade);
    return this.c++;
  }
  poly(rings, y, layer, shade = 1, down = false) {
    const { coords, tris } = triangulate(rings);
    const base = this.c;
    for (let k = 0; k < coords.length; k += 2) this.v(coords[k], y, coords[k + 1], 0, down ? -1 : 1, 0, coords[k], coords[k + 1], layer, shade);
    if (down) for (let k = 0; k < tris.length; k += 3) this.i.push(base + tris[k], base + tris[k + 2], base + tris[k + 1]);
    else for (let k = 0; k < tris.length; k++) this.i.push(base + tris[k]);
  }
  // vertical wall along a polyline, facing N=(dz,-dx)*side
  wall(pts, y0, y1, layer, side = 1, shade = 1, u0 = 0) {
    let u = u0;
    for (let k = 0; k + 3 < pts.length; k += 2) {
      const ax = pts[k], az = pts[k + 1], bx = pts[k + 2], bz = pts[k + 3];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 1e-4) continue;
      const nx = side * dz / L, nz = -side * dx / L;
      const a0 = this.v(ax, y0, az, nx, 0, nz, u, y0, layer, shade);
      const b0 = this.v(bx, y0, bz, nx, 0, nz, u + L, y0, layer, shade);
      const b1 = this.v(bx, y1, bz, nx, 0, nz, u + L, y1, layer, shade);
      const a1 = this.v(ax, y1, az, nx, 0, nz, u, y1, layer, shade);
      if (side > 0) this.i.push(a0, b1, b0, a0, a1, b1); else this.i.push(a0, b0, b1, a0, b1, a1);
      u += L;
    }
    return u;
  }
  strip(pts, w, y, layer, side = 1, shade = 1) {
    let u = 0;
    for (let k = 0; k + 3 < pts.length; k += 2) {
      const ax = pts[k], az = pts[k + 1], bx = pts[k + 2], bz = pts[k + 3];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 1e-4) continue;
      const ox = side * dz / L * w, oz = -side * dx / L * w;
      const a = this.v(ax, y, az, 0, 1, 0, u, 0, layer, shade);
      const b = this.v(bx, y, bz, 0, 1, 0, u + L, 0, layer, shade);
      const c = this.v(bx + ox, y, bz + oz, 0, 1, 0, u + L, w, layer, shade);
      const d = this.v(ax + ox, y, az + oz, 0, 1, 0, u, w, layer, shade);
      const ny = (bz - az) * ox - (bx - ax) * oz;
      if (ny >= 0) this.i.push(a, b, c, a, c, d); else this.i.push(a, c, b, a, d, c);
      u += L;
    }
  }
  box(cx, cy, cz, sx, sy, sz, rot, layer, shade = 1) {
    const c = Math.cos(rot), s = Math.sin(rot), hx = sx / 2, hz = sz / 2;
    const P = (x, z) => [cx + x * c - z * s, cz + x * s + z * c];
    const q = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
    for (let k = 0; k < 4; k++) { const a = q[k], b = q[(k + 1) % 4]; this.wall([a[0], a[1], b[0], b[1]], cy, cy + sy, layer, 1, shade); }
    this.poly([[q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]]], cy + sy, layer, shade);
  }
  get empty() { return this.c === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(this.n.map(v => Math.round(v * 127))), 3, true));
    g.setAttribute('guv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('glayer', new THREE.BufferAttribute(new Uint8Array(this.l), 1));
    g.setAttribute('gshade', new THREE.BufferAttribute(new Uint8Array(this.s.map(v => Math.min(255, Math.round(v * 200)))), 1, true));
    const I = this.c > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i);
    g.setIndex(new THREE.BufferAttribute(I, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

function offsetLine(p, d) {
  const out = new Float64Array(p.length), n = p.length / 2;
  for (let k = 0; k < n; k++) {
    let nx = 0, nz = 0;
    if (k > 0) { const dx = p[2 * k] - p[2 * k - 2], dz = p[2 * k + 1] - p[2 * k - 1], L = Math.hypot(dx, dz) || 1; nx += dz / L; nz += -dx / L; }
    if (k < n - 1) { const dx = p[2 * k + 2] - p[2 * k], dz = p[2 * k + 3] - p[2 * k + 1], L = Math.hypot(dx, dz) || 1; nx += dz / L; nz += -dx / L; }
    const L = Math.hypot(nx, nz) || 1;
    out[2 * k] = p[2 * k] + nx / L * d; out[2 * k + 1] = p[2 * k + 1] + nz / L * d;
  }
  return out;
}

// surface kind -> [layer, height]; footpaths in Deccan / Camp are square tiles, elsewhere zig-zag pavers
function kindLayer(kind, district) {
  switch (kind) {
    case 'asphalt': return [GL.asphalt, 0];
    case 'concrete': return [district === 1 || district === 2 ? GL.concrete : GL.asphaltOld, 0];
    case 'pavers': return [district === 0 || district === 2 ? GL.tiles : GL.pavers, KERB_H];
    case 'compound': return [GL.compound, KERB_H];
    case 'grass': return [GL.grass, KERB_H];
    case 'soil': return [GL.dirt, KERB_H];
    case 'scrub': return [GL.earth, KERB_H];
    case 'plaza': return [GL.concrete, KERB_H];
    case 'median': return [GL.median, KERB_H];
    case 'bridge_road': return [GL.asphalt, 0];
    case 'bridge_sw': return [GL.tiles, KERB_H];
    default: return null;
  }
}

// global per-map extras computed once (physics needs them everywhere): potholes + speed breakers
export function prepareGroundGlobals(W) {
  const { graph, index } = W;
  const rng = new RNG(911);
  const tmp = [0, 0, 0, 0];
  W.potholes = []; W.bumps = []; W.zebras = [];
  for (const e of graph.edges) {
    const per = e.rank <= 2 ? 34 : e.rank === 3 ? 60 : 140;
    let s = rng.range(5, per);
    while (s < e.len - 5) {
      graph.at(e, s, tmp);
      const lat = rng.range(-e.w / 2 + 0.8, e.w / 2 - 0.8);
      const x = tmp[0] + tmp[3] * lat, z = tmp[1] - tmp[2] * lat;
      const r = rng.range(0.35, 0.8);
      const p = { x, z, r: r * 0.8, rr: r, ang: rng.range(0, 6.28), sq: rng.range(0.7, 1.0) };
      W.potholes.push(p);
      index.chunks[index.chunkOf(x, z)]?.pot.push(p);
      s += rng.range(per * 0.6, per * 1.6);
    }
  }
  for (const s of W.M.marks.bump) W.bumps.push({ x: s[0] / 100, z: s[1] / 100, ang: s[2], w: s[3] / 100 });
  for (const z of W.M.marks.zebra) W.zebras.push({ x: z[0] / 100, z: z[1] / 100, ang: z[2], w: z[3] / 100 });
  W.bumpGrid = null;
}
// speed breakers near a point (a 16 m grid: every wheel of every vehicle asks, every step)
const NONE = [];
export function bumpsAt(W, x, z) {
  if (!W.bumpGrid) {
    W.bumpGrid = new Map();
    for (const b of W.bumps) for (let i = Math.floor((b.x - 8) / 16); i <= Math.floor((b.x + 8) / 16); i++) for (let j = Math.floor((b.z - 8) / 16); j <= Math.floor((b.z + 8) / 16); j++) {
      const k = i * 65536 + j; let l = W.bumpGrid.get(k); if (!l) W.bumpGrid.set(k, l = []); l.push(b);
    }
  }
  return W.bumpGrid.get(Math.floor(x / 16) * 65536 + Math.floor(z / 16)) || NONE;
}

export function* buildGroundChunk(W, C, group) {
  let ops = 0;
  W.sliceLabel = 'gSurf';
  const { mats, decalUV, graph } = W;
  const gb = new GB(), db = new QuadBuilder(), wb = new GB();
  const cellUV = (i) => { const [u, v, s] = decalUV(i); return [u + 0.002, v + 0.002, u + s - 0.002, v + s - 0.002]; };
  const dist = C.district;
  // surfaces
  const bridgeRings = [];
  for (const g of C.ground) {
    if ((++ops & 7) === 0) yield;
    const kl = kindLayer(g.kind, dist);
    if (!kl) continue;
    gb.poly(g.rings, kl[1], kl[0], g.kind === 'compound' ? 0.95 : 1);
    if (g.kind === 'bridge_road' || g.kind === 'bridge_sw') bridgeRings.push(g.rings);
  }
  for (const rr of bridgeRings) gb.poly(rr, -1.15, GL.kerbPlain, 0.55, true);

  // kerbs: road on the N side; painted black/yellow within ~14 m of big chowks
  const nearJ = (x, z, extra) => W.junctionNear(x, z, extra);
  const dustUV = cellUV(DECAL.dust);
  yield;
  for (const p of C.kerbs) {
    if ((++ops & 7) === 0) yield;
    let run = [p[0], p[1]], painted = null;
    const flush = () => {
      if (run.length >= 4) {
        const layer = painted ? GL.kerbPaint : GL.kerbPlain;
        gb.wall(run, 0, KERB_H + 0.01, layer, 1, 0.92);
        gb.strip(run, 0.2, KERB_H + 0.01, layer, -1, 1.0);
      }
    };
    for (let k = 0; k + 3 < p.length; k += 2) {
      const mx = (p[k] + p[k + 2]) / 2, mz = (p[k + 1] + p[k + 3]) / 2;
      const pt = nearJ(mx, mz, 14);
      if (painted === null) painted = pt;
      if (pt !== painted) { flush(); run = [p[k], p[k + 1]]; painted = pt; }
      run.push(p[k + 2], p[k + 3]);
    }
    flush();
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      const ox = dz / L * 0.55, oz = -dx / L * 0.55;
      db.quad([ax, 0.012, az], [bx, 0.012, bz], [bx + ox, 0.012, bz + oz], [ax + ox, 0.012, az + oz], [0, 1, 0], dustUV[0], dustUV[3], dustUV[2], dustUV[1]);
    }
  }
  // water + stone embankments
  yield;
  for (const rr of C.water) wb.poly(rr, WATER_Y, 0, 1);
  for (const p of C.banks) {
    gb.wall(p, WATER_Y - 1.2, KERB_H, GL.rubble, 1, 0.9);
    gb.wall(p, KERB_H, KERB_H + 0.75, GL.kerbPlain, 1, 0.95);
    const inner = offsetLine(p, -0.25);
    gb.wall(inner, KERB_H, KERB_H + 0.75, GL.kerbPlain, -1, 0.85);
    gb.strip(p, 0.25, KERB_H + 0.75, GL.kerbPlain, -1, 1.05);
  }
  for (const p of C.lakebanks) {
    if (p.length < 4) continue;
    const ax = p[0], az = p[1], bx = p[2], bz = p[3];
    const L = Math.hypot(bx - ax, bz - az) || 1;
    const tx = (ax + bx) / 2 + (bz - az) / L * 0.6, tz = (az + bz) / 2 - (bx - ax) / L * 0.6;
    let inWater = false;
    for (const rr of C.water) if (pointInRings(tx, tz, rr)) { inWater = true; break; }
    gb.wall(p, WATER_Y - 1.0, KERB_H, GL.rubble, inWater ? 1 : -1, 0.9);
  }
  // bridge decks + parapets + piers
  for (const p of C.rails) {
    gb.wall(p, -1.15, KERB_H, GL.kerbPlain, -1, 0.8);
    gb.wall(p, KERB_H, KERB_H + 0.95, GL.kerbPlain, -1, 0.95);
    const inner = offsetLine(p, 0.25);
    gb.wall(inner, KERB_H, KERB_H + 0.95, GL.kerbPlain, 1, 0.85);
    gb.strip(p, 0.25, KERB_H + 0.95, GL.kerbPlain, 1, 1.05);
    walkLine(p, 16, (x, z, dx, dz) => {
      const px = x + dz * 2.6, pz = z - dx * 2.6;
      gb.box(px, WATER_Y - 1.5, pz, 1.1, -WATER_Y + 1.5 - 1.15, 1.1, Math.atan2(dz, dx), GL.rubble, 0.8);
    }, 6);
  }
  yield;
  // lane paint
  const paintUV = cellUV(DECAL.paint), yellowUV = cellUV(DECAL.yellow), zebraUV = cellUV(DECAL.zebra);
  const lineQuad = (x0, z0, x1, z1, w, uv, y = 0.014) => {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    if (L < 0.05) return;
    const ox = dz / L * w / 2, oz = -dx / L * w / 2;
    db.quad([x0 - ox, y, z0 - oz], [x1 - ox, y, z1 - oz], [x1 + ox, y, z1 + oz], [x0 + ox, y, z0 + oz], [0, 1, 0], uv[0], uv[1], uv[2], uv[3]);
  };
  for (const line of C.center) dashes(line, 3.0, 4.5, (a, b, c, d) => lineQuad(a, b, c, d, 0.13, paintUV));
  for (const line of C.lane) dashes(line, 2.5, 5.0, (a, b, c, d) => lineQuad(a, b, c, d, 0.11, paintUV));
  for (const z of C.zebra) {
    const x = z[0] / 100, zz = z[1] / 100, ang = z[2], w = z[3] / 100;
    const nx = Math.sin(ang), nz = -Math.cos(ang);
    const n = Math.max(3, Math.floor((w - 0.6) / 0.95));
    for (let k = 0; k < n; k++) {
      const off = -w / 2 + 0.5 + (k + 0.5) * (w - 1.0) / n;
      db.ground(x + nx * off, 0.016, zz + nz * off, ang, 1.5, 0.24, zebraUV);
    }
  }
  for (const s of C.stop) {
    const x = s[0] / 100, z = s[1] / 100, ang = s[2], w = s[3] / 100, dir = s[4];
    const nx = Math.sin(ang), nz = -Math.cos(ang);
    let cx = x, cz = z, half = w / 2 - 0.3;
    if (dir !== 0) { const side = dir > 0 ? 1 : -1; cx = x + nx * side * w / 4; cz = z + nz * side * w / 4; half = w / 4 - 0.2; }
    lineQuad(cx - nx * half, cz - nz * half, cx + nx * half, cz + nz * half, 0.35, paintUV, 0.015);
  }
  // speed breakers: physical hump + paint
  for (const s of C.bump) {
    const x = s[0] / 100, z = s[1] / 100, ang = s[2], w = s[3] / 100, painted = s[4];
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = sa, nz = -ca, half = w / 2 + 0.2;
    const prof = [[-0.55, 0], [-0.3, 0.07], [0, 0.1], [0.3, 0.07], [0.55, 0]];
    for (let k = 0; k < prof.length - 1; k++) {
      const [d0, h0] = prof[k], [d1, h1] = prof[k + 1];
      const P = [[x + ca * d0 - nx * half, h0, z + sa * d0 - nz * half], [x + ca * d0 + nx * half, h0, z + sa * d0 + nz * half],
        [x + ca * d1 + nx * half, h1, z + sa * d1 + nz * half], [x + ca * d1 - nx * half, h1, z + sa * d1 - nz * half]];
      const sl = (h1 - h0) / (d1 - d0), ln = Math.hypot(sl, 1), ny = 1 / ln, na = -sl / ln;
      const vs = P.map(q => gb.v(q[0], q[1], q[2], ca * na, ny, sa * na, q[0], q[2], GL.asphaltOld, 0.85));
      const ux = P[1][0] - P[0][0], uz = P[1][2] - P[0][2], vx = P[3][0] - P[0][0], vz = P[3][2] - P[0][2];
      if (uz * vx - ux * vz >= 0) gb.i.push(vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]); else gb.i.push(vs[0], vs[2], vs[1], vs[0], vs[3], vs[2]);
    }
    if (painted) {
      const n = Math.floor(w / 0.6);
      for (let k = 0; k < n; k += 2) {
        const off = -w / 2 + (k + 0.5) * w / n;
        db.ground(x + nx * off, 0.105, z + nz * off, ang, 0.32, w / n / 2, k % 4 ? yellowUV : paintUV);
      }
    }
  }
  yield;
  // grass and weed tufts for the near-camera grass field
  W.sliceLabel = 'gGrass';
  if (!C.tufts) yield* scatterTufts(C);
  W.sliceLabel = 'gDecal';
  // potholes, oil stains, litter
  const rng = new RNG(1000 + C.ci);
  const potUV = cellUV(DECAL.pothole), oilUV = cellUV(DECAL.oil), garbUV = cellUV(DECAL.garbage);
  for (const p of C.pot) db.ground(p.x, 0.018, p.z, p.ang, p.rr, p.rr * p.sq, potUV);
  const nOil = Math.round(C.ground.length * 0.3);
  for (let k = 0; k < nOil; k++) {
    const g = C.ground[rng.int(0, C.ground.length - 1)];
    if (!g || (g.kind !== 'asphalt' && g.kind !== 'concrete')) continue;
    const r0 = g.rings[0];
    const vi = rng.int(0, r0.length / 2 - 1) * 2;
    db.ground(r0[vi] * 0.9 + C.cx * 0.1, 0.013, r0[vi + 1] * 0.9 + C.cz * 0.1, rng.range(0, 6.28), rng.range(0.6, 1.4), rng.range(0.5, 1.0), oilUV);
  }
  for (const s of C.stalls) {
    if (rng.chance(0.5)) db.ground(s[0] / 100 + rng.range(-1.5, 1.5), KERB_H + 0.02, s[1] / 100 + rng.range(-1.5, 1.5), rng.range(0, 6.28), rng.range(0.6, 1.1), rng.range(0.5, 0.9), garbUV);
  }
  // emit (one heavy array conversion per step)
  yield;
  W.sliceLabel = 'gEmit';
  if (!gb.empty) { const m = new THREE.Mesh(gb.build(), mats.ground); m.receiveShadow = true; group.add(m); }
  yield;
  if (!wb.empty) { const m = new THREE.Mesh(wb.build(), mats.water); m.receiveShadow = true; group.add(m); }
  if (!db.empty) { const m = new THREE.Mesh(db.build(), mats.decal); m.renderOrder = 1; m.receiveShadow = true; group.add(m); }
}
