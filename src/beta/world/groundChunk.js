// /beta's own ground: the same surfaces, kerbs, banks, bridges, paint and breakers as the game's (world/groundChunk.js,
// from the same map data, so nothing anyone feels changes: road 0, footpath KERB_H), drawn with more to them.
//   kerbs: separate 1 m blocks with a chamfered nose, the joints between them and a gutter of grime along the road;
//          at the big chowks the blocks are painted black and yellow in turn
//   river banks: a battered (sloping) stone face down to the water, a coping band, and a parapet with a capstone
//   bridges: parapets with a cap, a fascia under the deck's edge, hammerhead piers
//   speed breakers: a smooth hump, not five flats
import * as THREE from 'three';
import { triangulate, QuadBuilder, dashes, walkLine } from '@orig/world/geo.js';
import { GL } from '@orig/gfx/pbr.js';
import { DECAL } from '../gfx/textures.js';
import { RNG } from '@orig/core/util.js';
import { pointInRings } from '@orig/world/mapdata.js';
import { scatterTufts } from '@orig/world/grass.js';
import { buildPotholes, buildLitter } from './potholes.js';
import { GB, KERB_H, WATER_Y } from '@orig/world/groundChunk.js';

// a band along a polyline at a slant: from (off0, y0) to (off1, y1) across it, side the way GB.wall faces
function slope(gb, p, off0, y0, off1, y1, layer, shade, side = 1) {
  let u = 0;
  for (let k = 0; k + 3 < p.length; k += 2) {
    const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    if (L < 1e-4) continue;
    const ox = dz / L, oz = -dx / L, dO = off1 - off0, dY = y1 - y0, nl = Math.hypot(dO, dY) || 1;
    // the normal: across the band, turned up out of it
    const nh = dY / nl*side, ny = -dO / nl*side, nx = ox*nh, nz = oz*nh;
    const a0 = gb.v(ax + ox*off0, y0, az + oz*off0, nx, ny, nz, u, y0, layer, shade), b0 = gb.v(bx + ox*off0, y0, bz + oz*off0, nx, ny, nz, u + L, y0, layer, shade);
    const b1 = gb.v(bx + ox*off1, y1, bz + oz*off1, nx, ny, nz, u + L, y1 + 0.5, layer, shade), a1 = gb.v(ax + ox*off1, y1, az + oz*off1, nx, ny, nz, u, y1 + 0.5, layer, shade);
    // wind it the way its normal faces: (b0 - a0) x (a1 - a0) against n
    const ex = bx - ax, ez = bz - az, fx = ox*(off1 - off0), fy = y1 - y0, fz = oz*(off1 - off0);
    const cx = -ez*fy, cy = ez*fx - ex*fz, cz = ex*fy;
    if (cx*nx + cy*ny + cz*nz > 0) gb.i.push(a0, b0, b1, a0, b1, a1); else gb.i.push(a0, b1, b0, a0, a1, b1);
    u += L;
  }
}
// cut a polyline into pieces of about len metres (the kerb's blocks)
function pieces(p, len, f) {
  let acc = [p[0], p[1]], left = len, idx = 0;
  for (let k = 0; k + 3 < p.length; k += 2) {
    let ax = p[k], az = p[k + 1]; const bx = p[k + 2], bz = p[k + 3];
    let L = Math.hypot(bx - ax, bz - az);
    while (L > left) {
      const t = left / L; ax += (bx - ax)*t; az += (bz - az)*t; L -= left;
      acc.push(ax, az); f(acc, idx++); acc = [ax, az]; left = len;
    }
    acc.push(bx, bz); left -= L;
  }
  if (acc.length >= 4) f(acc, idx);
}
// shorten a piece at both ends by g (the joint between blocks)
function trim(q, g) {
  const o = q.slice(), n = o.length;
  const cut = (i, j) => { const dx = o[j] - o[i], dz = o[j + 1] - o[i + 1], L = Math.hypot(dx, dz); if (L > g*2) { o[i] += dx / L*g; o[i + 1] += dz / L*g; } };
  cut(0, 2); cut(n - 2, n - 4);
  return o;
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
    case 'concrete': return [district === 1 || district === 2 ? GL.concrete : GL.asphaltOld, 0.008];
    case 'pavers': return [district === 0 || district === 2 ? GL.tiles : GL.pavers, KERB_H + 0.012];
    case 'compound': return [GL.compound, KERB_H];
    case 'grass': return [GL.grass, KERB_H + 0.004];
    case 'soil': return [GL.dirt, KERB_H + 0.002];
    case 'scrub': return [GL.earth, KERB_H + 0.003];
    case 'plaza': return [GL.concrete, KERB_H + 0.008];
    case 'median': return [GL.median, KERB_H + 0.01];
    case 'bridge_road': return [GL.asphalt, 0];
    case 'bridge_sw': return [GL.tiles, KERB_H + 0.012];
    default: return null;
  }
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
    // painted near the big chowks: decided per block, black and yellow in turn
    pieces(p, 1.0, (q, i) => {
      const mx = q[0], mz = q[1], painted = nearJ(mx, mz, 14), layer = painted ? GL.kerbPaint : GL.kerbPlain;
      const b = trim(q, 0.012), sh = painted ? (i & 1 ? 0.32 : 1.0) : 0.9 + ((i*7919) % 13)/130;
      gb.wall(b, -0.02, KERB_H - 0.03, layer, 1, sh*0.92);                      // the face
      slope(gb, b, 0, KERB_H - 0.03, -0.035, KERB_H + 0.01, layer, sh*0.98, 1);    // the chamfered nose
      gb.strip(offsetLine(b, -0.035), 0.165, KERB_H + 0.01, layer, -1, sh);        // the top
    });
    // the joints show as the gutter's grime between blocks; the gutter itself, a dark band along the road
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      const ox = dz / L * 0.55, oz = -dx / L * 0.55;
      db.quad([ax, 0.012, az], [bx, 0.012, bz], [bx + ox, 0.012, bz + oz], [ax + ox, 0.012, az + oz], [0, 1, 0], dustUV[0], dustUV[3], dustUV[2], dustUV[1]);
    }
    gb.strip(p, 0.28, 0.004, GL.asphaltOld, 1, 0.62);
  }
  // water + stone embankments
  yield;
  for (const rr of C.water) wb.poly(rr, WATER_Y, 0, 1);
  for (const p of C.banks) {
    // the stone face leans back from the water as it rises (0.9 m over its height), then a coping band, then the parapet
    slope(gb, p, 0.9, WATER_Y - 1.2, 0.0, KERB_H - 0.12, GL.rubble, 0.88, 1);
    gb.wall(p, KERB_H - 0.12, KERB_H, GL.kerbPlain, 1, 0.8);
    gb.wall(p, KERB_H, KERB_H + 0.68, GL.kerbPlain, 1, 0.95);
    const inner = offsetLine(p, -0.25), capO = offsetLine(p, 0.04), capI = offsetLine(p, -0.29);
    gb.wall(inner, KERB_H, KERB_H + 0.68, GL.kerbPlain, -1, 0.85);
    // the capstone: a little wider than the wall, with its own edges
    gb.wall(capO, KERB_H + 0.68, KERB_H + 0.78, GL.kerbPlain, 1, 1.0);
    gb.wall(capI, KERB_H + 0.68, KERB_H + 0.78, GL.kerbPlain, -1, 0.9);
    gb.strip(capO, 0.33, KERB_H + 0.78, GL.kerbPlain, -1, 1.08);
    slope(gb, capO, 0, KERB_H + 0.68, -0.04, KERB_H + 0.66, GL.kerbPlain, 0.6, -1);
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
    // the fascia: a lip under the deck's edge that keeps the rain off the beams
    const fas = offsetLine(p, -0.06);
    gb.wall(fas, -1.35, -0.95, GL.kerbPlain, -1, 0.7);
    slope(gb, fas, 0, -1.35, 0.3, -1.35, GL.kerbPlain, 0.45, 1);
    gb.wall(p, KERB_H, KERB_H + 0.9, GL.kerbPlain, -1, 0.95);
    const inner = offsetLine(p, 0.25), capO = offsetLine(p, -0.04), capI = offsetLine(p, 0.29);
    gb.wall(inner, KERB_H, KERB_H + 0.9, GL.kerbPlain, 1, 0.85);
    gb.wall(capO, KERB_H + 0.9, KERB_H + 1.0, GL.kerbPlain, -1, 1.0);
    gb.wall(capI, KERB_H + 0.9, KERB_H + 1.0, GL.kerbPlain, 1, 0.9);
    gb.strip(capO, 0.33, KERB_H + 1.0, GL.kerbPlain, 1, 1.08);
    // piers: a column with a wider head under the deck, standing on a footing
    walkLine(p, 16, (x, z, dx, dz) => {
      const px = x + dz * 2.6, pz = z - dx * 2.6, a = Math.atan2(dz, dx), top = -1.15;
      gb.box(px, WATER_Y - 1.5, pz, 1.6, 0.9, 1.6, a, GL.rubble, 0.7);
      gb.box(px, WATER_Y - 0.6, pz, 1.0, top - 0.7 - (WATER_Y - 0.6), 1.0, a, GL.kerbPlain, 0.78);
      gb.box(px, top - 0.7, pz, 1.4, 0.7, 4.6, a, GL.kerbPlain, 0.85);
    }, 6);
  }
  yield;
  // lane paint
  const paintUV = cellUV(DECAL.paint), yellowUV = cellUV(DECAL.yellow), zebraUV = cellUV(DECAL.zebra);
  const lineQuad = (x0, z0, x1, z1, w, uv, y = 0.022) => {
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
      db.ground(x + nx * off, 0.024, zz + nz * off, ang, 1.5, 0.24, zebraUV);
    }
  }
  for (const s of C.stop) {
    const x = s[0] / 100, z = s[1] / 100, ang = s[2], w = s[3] / 100, dir = s[4];
    const nx = Math.sin(ang), nz = -Math.cos(ang);
    let cx = x, cz = z, half = w / 2 - 0.3;
    if (dir !== 0) { const side = dir > 0 ? 1 : -1; cx = x + nx * side * w / 4; cz = z + nz * side * w / 4; half = w / 4 - 0.2; }
    lineQuad(cx - nx * half, cz - nz * half, cx + nx * half, cz + nz * half, 0.35, paintUV, 0.023);
  }
  // speed breakers: physical hump + paint
  for (const s of C.bump) {
    const x = s[0] / 100, z = s[1] / 100, ang = s[2], w = s[3] / 100, painted = s[4];
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = sa, nz = -ca, half = w / 2 + 0.2;
    const prof = []; for (let k = 0; k <= 12; k++) { const d = -0.6 + k*0.1, t = d / 0.6; prof.push([d, 0.1*Math.pow(Math.cos(t*Math.PI/2), 1.4)]); }
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
  // (potholes and the rubbish by the stalls are real shapes now: ./potholes.js)
  const nOil = Math.round(C.ground.length * 0.3);
  for (let k = 0; k < nOil; k++) {
    const g = C.ground[rng.int(0, C.ground.length - 1)];
    if (!g || (g.kind !== 'asphalt' && g.kind !== 'concrete')) continue;
    const r0 = g.rings[0];
    const vi = rng.int(0, r0.length / 2 - 1) * 2;
    db.ground(r0[vi] * 0.9 + C.cx * 0.1, 0.013, r0[vi + 1] * 0.9 + C.cz * 0.1, rng.range(0, 6.28), rng.range(0.6, 1.4), rng.range(0.5, 1.0), oilUV);
  }
  buildPotholes(W, C, group); buildLitter(W, C, group, KERB_H + 0.012);
  // emit (one heavy array conversion per step)
  yield;
  W.sliceLabel = 'gEmit';
  if (!gb.empty) { const m = new THREE.Mesh(gb.build(), mats.ground); m.receiveShadow = true; group.add(m); }
  yield;
  if (!wb.empty) { const m = new THREE.Mesh(wb.build(), mats.water); m.receiveShadow = true; group.add(m); }
  if (!db.empty) { const m = new THREE.Mesh(db.build(), mats.decal); m.renderOrder = 1; m.receiveShadow = true; group.add(m); }
}
