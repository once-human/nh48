// world/propsChunk.js for /beta: the game's street furniture (stalls moved to their own sets once it's up), and its
// own chunk builder: the stalls, bus shelters, boards and landmarks as before (their models are /beta's), no compound
// walls, and the Metro drawn again:
//   the viaduct as Pune's U girder: sloped webs, walls past the track with a lip, the cable troughs and the track's
//   plinths inside, overhead-wire masts with their cross arm
//   piers round, on a plinth, flaring out to the head, with bearings under the girder
//   stations with a yellow line along each platform and ribs under the canopy; kiosks framed, with a lip on the roof
export * from '@orig/world/propsChunk.js';
import * as THREE from 'three';
import { buildGlobalProps as gameProps } from '@orig/world/propsChunk.js';
import { ColorBuilder, QuadBuilder, polyLength } from '@orig/world/geo.js';
import { RNG, hash1 } from '@orig/core/util.js';
import { GL, WL } from '@orig/gfx/pbr.js';
import { compose } from './props.js';
import { GB } from '@orig/world/groundChunk.js';
import { FacadeB } from '@orig/world/buildingsChunk.js';
import { buildLandmark } from './landmarks.js';
import { stallSets } from './props.js';

export function buildGlobalProps(W) { gameProps(W); stallSets(W); }

function stationLayout(W, st) {
  const p = st.pts, L = polyLength(p), key = Math.round(p[0]) + ',' + Math.round(p[1]);
  const cache = W._stLay || (W._stLay = new Map());
  if (cache.has(key)) return cache.get(key);
  const ax = p[0], az = p[1], bx = p[p.length - 2], bz = p[p.length - 1];
  const dx = (bx - ax) / L, dz = (bz - az) / L, nx = dz, nz = -dx, cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const hl = Math.min(70, L / 2 + 5), ca = Math.min(38, hl * 0.6);
  const P = (a, b) => [cx + dx * a + nx * b, cz + dz * a + nz * b];
  const road = (a, b) => { const [x, z] = P(a, b); return W.surf.isRoad(x, z); };
  let known = false;                                  // any street under or beside it yet?
  for (let b = -12; b <= 12 && !known; b += 1.5) known = road(0, b) || road(-ca * 0.7, b) || road(ca * 0.7, b);
  // first edge off the road on one side (b > 0 or b < 0), within lim metres
  const edge = (a, sg, lim) => { for (let b = 0.5; b <= lim; b += 0.5) if (!road(a, b * sg)) return b * sg; return null; };
  const cols = [];
  for (const a of [-ca * 0.7, 0, ca * 0.7]) {
    if (!road(a, 0)) { cols.push([a, 0]); continue; }
    const l = edge(a, 1, 10), r = edge(a, -1, 10);
    if (l != null && r != null) { cols.push([a, l + Math.sign(l) * 0.9], [a, r + Math.sign(r) * 0.9]); }
    else cols.push([a, 0]);                           // a wide road: its median
  }
  // the stair tower: the first spot beside the road (either side) where its whole footprint is off the road
  let tower = null, ta = hl - 9;
  for (const a of [hl - 9, -(hl - 9), hl - 20, -(hl - 20), 0]) {
    for (let b = 8; b <= 30 && tower == null; b += 1) for (const sg of [1, -1]) {
      let ok = true;
      for (const [u, v] of [[-5, -3], [5, -3], [5, 3], [-5, 3], [0, 0], [0, -3], [0, 3]]) { const [x, z] = P(a + u, (b + v) * sg); if (W.surf.isRoad(x, z) || W.surf.inBuilding(x, z)) { ok = false; break; } }
      if (ok) { tower = b * sg; ta = a; break; }
    }
    if (tower != null) break;
  }
  const out = { cols, tower, ta };
  if (!known) return out;                             // the streets here aren't in yet: work it out again later
  cache.set(key, out);
  const C = W.collision, t0 = C.tag; C.tag = 0;
  for (const [a, b] of cols) { const [x, z] = P(a, b); C.addCircle(x, z, 1.1, 2); }
  if (tower != null) { const [tx, tz] = P(ta, tower); C.addRing([[-5, -3], [5, -3], [5, 3], [-5, 3]].flatMap(([u, v]) => [tx + dx * u + nx * v, tz + dz * u + nz * v]), 0); }
  C.tag = t0;
  return out;
}

export function* buildPropsChunk(W, C, group) {
  let ops = 0;
  const { M, mats, signs, index } = W;
  const P = W.proto;
  const cb = new ColorBuilder(), sb = new QuadBuilder(), gb = new GB(), fb = new FacadeB();
  const rng = new RNG(5000 + C.ci);
  const mm = new THREE.Matrix4();

  W.sliceLabel = 'pBus';
  for (const b of C.buses) {
    yield;
    const x = b[0] / 100, z = b[1] / 100, a = b[2];
    const dx = Math.cos(a), dz = Math.sin(a);
    const ry = Math.atan2(dx, dz);
    cb.addGeo(P.bus, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
    const s = signs.bus[0];
    const fx = Math.cos(ry), fz = -Math.sin(ry);
    sb.quad([x - fx * 1.1, 2.75, z - fz * 1.1], [x + fx * 1.1, 2.75, z + fz * 1.1], [x + fx * 1.1, 3.3, z + fz * 1.1], [x - fx * 1.1, 3.3, z - fz * 1.1],
      [Math.sin(ry), 0, Math.cos(ry)], s.u0, s.v0, s.u1, s.v1);
  }
  for (const s of C.stalls) {
    yield;
    const x = s[0] / 100, z = s[1] / 100, a = s[2], t = s[3];
    const proto = P['stall' + t] || P.stall0;
    const ry = Math.atan2(Math.cos(a), Math.sin(a));
    cb.addGeo(proto, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
    if (false) {                       // stall boards used invented shop names; real stalls are unnamed
      const sh = signs.shops[0];
      const fx = Math.cos(ry), fz = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry);
      const cx = x + nx * 0.6, cz = z + nz * 0.6;
      sb.quad([cx - fx * 1.1, 1.75, cz - fz * 1.1], [cx + fx * 1.1, 1.75, cz + fz * 1.1], [cx + fx * 1.1, 2.3, cz + fz * 1.1], [cx - fx * 1.1, 2.3, cz - fz * 1.1],
        [nx, 0, nz], sh.u0, sh.v0, sh.u1, sh.v1);
    }
  }
  for (const ex of C.extras) {
    yield;
    if (ex.kind === 'street' || ex.kind === 'banner') {
      const { x, z, fx, fz } = ex;
      const ry = Math.atan2(-fx, -fz);
      const ux = Math.cos(ry), uz = -Math.sin(ry), nx = -fx, nz = -fz;
      const ltr = (ux * nz - uz * nx) > 0;
      if (ex.kind === 'street') {
        cb.addGeo(P.streetBoard, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
        const s = signs.streets[ex.s];
        sb.quad([x - ux * 1.22, 2.23, z - uz * 1.22], [x + ux * 1.22, 2.23, z + uz * 1.22], [x + ux * 1.22, 2.87, z + uz * 1.22], [x - ux * 1.22, 2.87, z - uz * 1.22],
          [nx, 0, nz], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
      } else {
        cb.addGeo(P.bannerFrame, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
        const s = signs.banners[ex.s];
        sb.quad([x - ux * 1.65, 1.9, z - uz * 1.65], [x + ux * 1.65, 1.9, z + uz * 1.65], [x + ux * 1.65, 2.9, z + uz * 1.65], [x - ux * 1.65, 2.9, z - uz * 1.65],
          [nx, 0, nz], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
        sb.quad([x - ux * 1.65, 1.9, z - uz * 1.65], [x + ux * 1.65, 1.9, z + uz * 1.65], [x + ux * 1.65, 2.9, z + uz * 1.65], [x - ux * 1.65, 2.9, z - uz * 1.65],
          [-nx, 0, -nz], s.u0, s.v0, s.u0 + 0.001, s.v0 + 0.001);
      }
    } else if (ex.kind === 'landmark') {
      try { buildLandmark(W, ex.id, { fb, gb, cb, group, mm }); } catch (e) { console.warn('landmark', ex.id, e); }
    } else if (ex.kind === 'pier') {
      const { x, z, dx, dz } = ex;
      const ry = -Math.atan2(dx, -dz) + Math.PI / 2, ring = (r, n = 20) => { const o = []; for (let k = 0; k <= n; k++) o.push(x + Math.cos(k / n * 6.283) * r, z + Math.sin(k / n * 6.283) * r); return o; };
      gb.box(x, 0.0, z, 2.4, 0.35, 2.4, ry, GL.concrete, 0.7);                         // plinth
      gb.wall(ring(0.95), 0.35, 8.9, GL.concrete, 1, 0.92);                              // the column
      for (let k = 0; k < 5; k++) { const y = 8.9 + k * 0.26, r = 0.95 + Math.pow((k + 1) / 5, 1.6) * 1.6; gb.wall(ring(r), y, y + 0.27, GL.concrete, 1, 0.9 - k * 0.02); }   // the flare
      gb.box(x, 10.2, z, 6.5, 1.0, 2.4, ry, GL.concrete, 0.95);                          // the head under the girder
      for (const s of [-1.6, 1.6]) gb.box(x + Math.cos(ry) * s, 11.08, z + Math.sin(ry) * s, 0.7, 0.12, 0.7, ry, GL.asphaltOld, 0.5);   // bearings
    }
  }
  yield;
  W.sliceLabel = 'pMetro';
  // metro viaduct decks
  for (const m of C.metro) {
    const [constr, ax, az, bx, bz] = m;
    const sl = Math.hypot(bx - ax, bz - az);
    if (sl < 0.2) continue;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (constr === 1 && hash1(Math.round(mx) * 7 + Math.round(mz)) < 0.35) continue;
    const nx = (bz - az) / sl, nz = -(bx - ax) / sl;
    const hw = 2.5, bw = 1.5, top = 12.6, bot = 11.2;
    const quad = (o0, y0, o1, y1, shade = 0.9, out = 1) => {
      // a face between offsets o0 (bottom) and o1 (top); out 1 faces away from the centre line, -1 towards it
      const s = Math.sign(o1 || o0) * out;
      const fnx = nx * s, fnz = nz * s;
      const v0 = gb.v(ax + nx * o0, y0, az + nz * o0, fnx, 0, fnz, 0, y0, GL.concrete, shade);
      const v1 = gb.v(bx + nx * o0, y0, bz + nz * o0, fnx, 0, fnz, sl, y0, GL.concrete, shade);
      const v2 = gb.v(bx + nx * o1, y1, bz + nz * o1, fnx, 0, fnz, sl, y1, GL.concrete, shade);
      const v3 = gb.v(ax + nx * o1, y1, az + nz * o1, fnx, 0, fnz, 0, y1, GL.concrete, shade);
      const cx = -(bz - az), cz = (bx - ax);
      if ((cx * fnx + cz * fnz) >= 0) gb.i.push(v0, v1, v2, v0, v2, v3); else gb.i.push(v0, v2, v1, v0, v3, v2);
    };
    const flat = (o0, o1, y, sh, down = false) => gb.poly([[ax + nx * o0, az + nz * o0, bx + nx * o0, bz + nz * o0, bx + nx * o1, bz + nz * o1, ax + nx * o1, az + nz * o1]], y, GL.concrete, sh, down);
    // the U: sloped webs from the soffit up to the deck, the walls rising past the track, a lip on top
    quad(bw, bot, hw, top, 0.88); quad(-bw, bot, -hw, top, 0.88);
    quad(hw, top, hw, top + 1.3, 0.92); quad(-hw, top, -hw, top + 1.3, 0.92);
    quad(hw - 0.22, top, hw - 0.22, top + 1.3, 0.75, -1); quad(-hw + 0.22, top, -hw + 0.22, top + 1.3, 0.75, -1);
    flat(hw - 0.22, hw + 0.05, top + 1.3, 1.0); flat(-hw - 0.05, -hw + 0.22, top + 1.3, 1.0);
    quad(hw + 0.05, top + 1.18, hw + 0.05, top + 1.3, 0.8); quad(-hw - 0.05, top + 1.18, -hw - 0.05, top + 1.3, 0.8);
    flat(-bw, bw, bot, 0.6, true);
    flat(-hw + 0.22, hw - 0.22, top + 0.02, 0.72);
    // the cable trough along each wall, and the ballastless track's two plinths
    flat(hw - 0.75, hw - 0.22, top + 0.32, 0.6); flat(-hw + 0.22, -hw + 0.75, top + 0.32, 0.6);
    flat(-1.05, -0.45, top + 0.2, 0.62); flat(0.45, 1.05, top + 0.2, 0.62);
    // overhead wire masts every ~40 m
    if (hash1(Math.round(mx * 3) + Math.round(mz * 7)) < sl / 40) {
      for (const s of [1, -1]) { const px = mx + nx * (hw - 0.4) * s, pz = mz + nz * (hw - 0.4) * s; gb.box(px, top + 1.3, pz, 0.22, 4.6, 0.22, Math.atan2(nz, nx), GL.asphaltOld, 0.6); }
      gb.box(mx, top + 5.7, mz, 0.12, 0.14, hw * 2 - 0.6, Math.atan2(-nx, nz), GL.asphaltOld, 0.55);
    }
  }
  // metro stations, built like Pune's elevated ones: a concourse slung under the viaduct on columns in the
  // median, open side platforms at track level with a parapet, a pitched canopy on posts, and a stair tower
  // down to the footpath
  const gq = (a, b, c, d, n, layer, shade, both) => {
    const v = [a, b, c, d].map(q => gb.v(q[0], q[1], q[2], n[0], n[1], n[2], q[3] || 0, q[4] || 0, layer, shade));
    gb.i.push(v[0], v[1], v[2], v[0], v[2], v[3]);
    if (both) { const w = [a, b, c, d].map(q => gb.v(q[0], q[1], q[2], -n[0], -n[1], -n[2], q[3] || 0, q[4] || 0, layer, shade * 0.8)); gb.i.push(w[0], w[2], w[1], w[0], w[3], w[2]); }
  };
  for (const st of C.mstations) {
    const p = st.pts;
    const L = polyLength(p);
    if (L < 40) continue;
    const ax = p[0], az = p[1], bx = p[p.length - 2], bz = p[p.length - 1];
    const dx = (bx - ax) / L, dz = (bz - az) / L, nx = dz, nz = -dx;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const hl = Math.min(70, L / 2 + 5), hw = 11;
    const P = (a, b) => [cx + dx * a + nx * b, cz + dz * a + nz * b];
    const tint = [0.92, 0.92, 0.94];
    const seed = Math.floor(hash1(cx) * 255);
    // a box from (a0..a1 along, b0..b1 across, y0..y1), facade walls on the four sides
    const box = (a0, a1, b0, b1, y0, y1, style, layer, flags) => {
      const co = [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], mx = (co[0][0] + co[2][0]) / 2, mz = (co[0][1] + co[2][1]) / 2;
      for (let k = 0; k < 4; k++) {
        const [x0, z0] = co[k], [x1, z1] = co[(k + 1) % 4], l = Math.hypot(x1 - x0, z1 - z0);
        let ox = (z1 - z0) / l, oz = -(x1 - x0) / l;
        if (ox * ((x0 + x1) / 2 - mx) + oz * ((z0 + z1) / 2 - mz) < 0) { ox = -ox; oz = -oz; }
        fb.wall(x0, z0, x1, z1, y0, y1, ox, oz, 0, { eu: 0, eL: l, tint, style, layer, flags, seed, tx: (x1 - x0) / l, tz: (z1 - z0) / l, top: y1 });
      }
      gb.poly([co.flat()], y1, GL.concrete, 0.85);
      gb.poly([co.flat()], y0, GL.concrete, 0.5, true);
    };
    // the concourse under the tracks, on three columns in the median
    const ca = Math.min(38, hl * 0.6);
    box(-ca, ca, -9, 9, 7.4, 10.9, 1, WL.cladding, 6);
    const LY = stationLayout(W, st);
    for (const [a, b] of LY.cols) box(a - 0.8, a + 0.8, b - 0.8, b + 0.8, 0, 7.4, 3, WL.plaster, 2);
    // side platforms at track level, with a parapet on the outer edge
    for (const sd of [1, -1]) {
      const b0 = 2.6 * sd, b1 = 7.4 * sd;
      const ring = [P(-hl, b0), P(hl, b0), P(hl, b1), P(-hl, b1)].flat();
      gb.poly([ring], 12.78, GL.concrete, 0.9);
      gb.poly([ring], 12.0, GL.concrete, 0.45, true);
      const [ox0, oz0] = P(-hl, b1), [ox1, oz1] = P(hl, b1), n = [nx * sd, 0, nz * sd];
      gq([ox0, 12.0, oz0], [ox1, 12.0, oz1], [ox1, 13.85, oz1], [ox0, 13.85, oz0], n, GL.concrete, 0.8, true);
      for (const a of [-hl, hl]) { const [x0, z0] = P(a, b0), [x1, z1] = P(a, b1); gq([x0, 12.0, z0], [x1, 12.0, z1], [x1, 12.78, z1], [x0, 12.78, z0], [dx * Math.sign(a), 0, dz * Math.sign(a)], GL.concrete, 0.7, true); }
      // the platform edge: a yellow tactile line, a little in from the track
      { const [e0x, e0z] = P(-hl, b0 + 0.25 * sd), [e1x, e1z] = P(hl, b0 + 0.25 * sd), [e2x, e2z] = P(hl, b0 + 0.85 * sd), [e3x, e3z] = P(-hl, b0 + 0.85 * sd);
        gb.poly([[e0x, e0z, e1x, e1z, e2x, e2z, e3x, e3z]], 12.8, GL.kerbPaint, 1.1); }
      // canopy posts along the parapet
      for (let a = -hl + 6; a <= hl - 6; a += 15) box(a - 0.18, a + 0.18, b1 - 0.4 * sd - 0.18, b1 - 0.4 * sd + 0.18, 12.78, 17.15, 3, WL.plaster, 2);
    }
    // the canopy: two pitched planes over both platforms
    const ra = hl - 3;
    for (const sd of [1, -1]) {
      const [x0, z0] = P(-ra, 0), [x1, z1] = P(ra, 0), [x2, z2] = P(ra, 8.4 * sd), [x3, z3] = P(-ra, 8.4 * sd);
      const ny = 0.99, n = [nx * sd * 0.14, ny, nz * sd * 0.14];
      if (sd > 0) gq([x0, 18.1, z0], [x1, 18.1, z1], [x2, 17.0, z2], [x3, 17.0, z3], n, GL.concrete, 0.95, true);
      else gq([x0, 18.1, z0], [x3, 17.0, z3], [x2, 17.0, z2], [x1, 18.1, z1], n, GL.concrete, 0.95, true);
      const [ex0, ez0] = P(-ra, 8.4 * sd), [ex1, ez1] = P(ra, 8.4 * sd);
      gq([ex0, 16.7, ez0], [ex1, 16.7, ez1], [ex1, 17.0, ez1], [ex0, 17.0, ez0], [nx * sd, 0, nz * sd], GL.concrete, 0.8, true);
    }
    // ribs under the canopy, every 5 m
    for (let a = -ra; a <= ra; a += 5) for (const sd of [1, -1]) { const [x0, z0] = P(a, 0), [x1, z1] = P(a, 8.4 * sd); gb.box((x0 + x1) / 2, 16.55, (z0 + z1) / 2, 0.18, 0.45, 8.4, Math.atan2(-nx, nz), GL.asphaltOld, 0.55); }
    // a stair and escalator tower down to the footpath at one end, on the station's side of the road
    if (LY.tower) { const tb = LY.tower, tx0 = cx + dx * LY.ta + nx * tb, tz0 = cz + dz * LY.ta + nz * tb, sg = Math.sign(tb);
      const tc = [[-5, -3], [5, -3], [5, 3], [-5, 3]].map(([a, b]) => [tx0 + dx * a + nx * b, tz0 + dz * a + nz * b]);
      for (let k = 0; k < 4; k++) {
        const [x0, z0] = tc[k], [x1, z1] = tc[(k + 1) % 4], l = Math.hypot(x1 - x0, z1 - z0);
        let ox = (z1 - z0) / l, oz = -(x1 - x0) / l;
        if (ox * ((x0 + x1) / 2 - tx0) + oz * ((z0 + z1) / 2 - tz0) < 0) { ox = -ox; oz = -oz; }
        fb.wall(x0, z0, x1, z1, 0, 11.0, ox, oz, 0, { eu: 0, eL: l, tint, style: 1, layer: WL.cladding, flags: 6, seed, tx: (x1 - x0) / l, tz: (z1 - z0) / l, top: 11 });
      }
      gb.poly([tc.flat()], 11.0, GL.concrete, 0.8);
      // a bridge from the tower into the concourse
      const a0 = Math.min(Math.max(-ca + 1, Math.min(ca - 7, LY.ta - 3)), LY.ta - 4), a1 = Math.max(a0 + 6, LY.ta + 4), [bx0, bz0] = P(a0, 9 * sg), [bx1, bz1] = P(a1, 9 * sg), [bx2, bz2] = P(a1, tb - 3 * sg), [bx3, bz3] = P(a0, tb - 3 * sg);
      gb.poly([[bx0, bz0, bx1, bz1, bx2, bz2, bx3, bz3]], 10.9, GL.concrete, 0.8);
    }
    // the Metro sign along both canopy edges
    const s = signs.metro;
    for (const side of [1, -1]) {
      const [fx, fz] = P(0, (8.45) * side);
      const ltr = (dx * nz * side - dz * nx * side) > 0;
      sb.quad([fx - dx * 9, 15.4, fz - dz * 9], [fx + dx * 9, 15.4, fz + dz * 9], [fx + dx * 9, 16.65, fz + dz * 9], [fx - dx * 9, 16.65, fz - dz * 9],
        [nx * side, 0, nz * side], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
    }
  }
  // underground metro entrances: a glass kiosk with the Metro sign over the stairs
  for (const g of C.mgates || []) {
    const ang = hash1(g.x * 3.1 + g.z) * Math.PI, ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
    const kc = [[-3.5, -2.2], [3.5, -2.2], [3.5, 2.2], [-3.5, 2.2]].map(([a, b]) => [g.x + ux * a + vx * b, g.z + uz * a + vz * b]);
    const tint = [0.86, 0.88, 0.92], seed = 7;
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = kc[k], [x1, z1] = kc[(k + 1) % 4], l = Math.hypot(x1 - x0, z1 - z0);
      let ox = (z1 - z0) / l, oz = -(x1 - x0) / l;
      if (ox * ((x0 + x1) / 2 - g.x) + oz * ((z0 + z1) / 2 - g.z) < 0) { ox = -ox; oz = -oz; }
      if (k === 0) continue;                       // the open side: the stairs go down here
      fb.wall(x0, z0, x1, z1, 0, 3.3, ox, oz, 0, { eu: 0, eL: l, tint, style: 9, layer: WL.concrete, flags: 0, seed, tx: (x1 - x0) / l, tz: (z1 - z0) / l, top: 3.3 });
    }
    gb.poly([kc.flat()], 3.4, GL.concrete, 0.8);
    gb.poly([kc.flat()], 0.06, GL.concrete, 0.4);
    const kr = [[-3.7, -2.4], [3.7, -2.4], [3.7, 2.4], [-3.7, 2.4]].map(([a, b]) => [g.x + ux * a + vx * b, g.z + uz * a + vz * b]);
    gb.wall([...kr.flat(), kr[0][0], kr[0][1]], 3.3, 3.6, GL.concrete, 1, 0.9); gb.poly([kr.flat()], 3.6, GL.concrete, 0.85);
    for (const [a, b] of [[-3.5, -2.2], [3.5, -2.2], [3.5, 2.2], [-3.5, 2.2], [0, 2.2], [0, -2.2]]) gb.box(g.x + ux * a + vx * b, 0, g.z + uz * a + vz * b, 0.12, 3.3, 0.12, ang, GL.asphaltOld, 0.5);
    const s2 = signs.metro, fx = g.x - vx * 2.25, fz = g.z - vz * 2.25;
    sb.quad([fx - ux * 3, 3.45, fz - uz * 3], [fx + ux * 3, 3.45, fz + uz * 3], [fx + ux * 3, 4.45, fz + uz * 3], [fx - ux * 3, 4.45, fz - uz * 3], [-vx, 0, -vz], s2.u0, s2.v0, s2.u1, s2.v1);
  }
  // emit
  yield;
  W.sliceLabel = 'pEmitC';
  if (!cb.empty) { const m = new THREE.Mesh(yield* cb.buildSliced(), mats.prop); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  yield;
  W.sliceLabel = 'pEmitS';
  if (!sb.empty) { const m = new THREE.Mesh(yield* sb.buildSliced(), mats.oldSign); m.receiveShadow = true; group.add(m); }
  yield;
  W.sliceLabel = 'pEmitG';
  if (!gb.empty) { const m = new THREE.Mesh(gb.build(), mats.ground); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  yield;
  W.sliceLabel = 'pEmitF';
  if (!fb.empty) { const m = new THREE.Mesh(yield* fb.buildSliced(), mats.facade); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (C.wires.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(C.wires, 3));
    group.add(new THREE.LineSegments(g, W.wireMat));
  }
}
