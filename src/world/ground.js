// Ground level of the city: road surfaces, footpaths, kerbs (black/yellow near chowks), river,
// embankments, bridges, lane paint, zebra crossings, speed breakers, potholes and dust.
import * as THREE from 'three';
import { GroundBuilder, QuadBuilder, cmRing, dashes, walkLine, triangulate } from './geo.js';
import { G, G_SCALE, DECAL } from '../gfx/textures.js';
import { RNG } from '../core/util.js';
import { pointInRings } from './mapdata.js';

export const KERB_H = 0.15;
export const WATER_Y = -2.4;

const KIND = {
  asphalt: [G.asphalt, 0], concrete: [G.concrete, 0], pavers: [G.pavers, KERB_H], compound: [G.compound, KERB_H],
  grass: [G.grass, KERB_H], soil: [G.soil, KERB_H], scrub: [G.scrub, KERB_H], plaza: [G.plaza, KERB_H],
  median: [G.median, KERB_H], bridge_road: [G.asphalt, 0], bridge_sw: [G.pavers, KERB_H],
};

export function buildGround(M, W) {
  const { graph, chunks, mats, decalUV } = W;
  const gb = new Map(), db = new Map();
  const GB = (ci) => { let b = gb.get(ci); if (!b) gb.set(ci, b = new GroundBuilder()); return b; };
  const DB = (ci) => { let b = db.get(ci); if (!b) db.set(ci, b = new QuadBuilder()); return b; };
  const cellUV = (i) => { const [u, v, s] = decalUV(i); return [u + 0.002, v + 0.002, u + s - 0.002, v + s - 0.002]; };

  // --- surfaces
  const bridgeRings = new Map();
  for (const [kind, polys] of M.ground) {
    const k = KIND[kind];
    if (!k) continue;
    const [layer, y] = k;
    for (const [ci, rings] of polys) {
      const rr = rings.map(cmRing);
      GB(ci).poly(rr, y, layer, G_SCALE[layer], kind === 'compound' ? 0.95 : 1);
      if (kind === 'bridge_road' || kind === 'bridge_sw') {
        if (!bridgeRings.has(ci)) bridgeRings.set(ci, []);
        bridgeRings.get(ci).push(rr);
      }
    }
  }
  // bridge underside
  for (const [ci, list] of bridgeRings) for (const rr of list) GB(ci).poly(rr, -1.15, G.deck, G_SCALE[G.deck], 0.55, true);

  // --- kerbs: road is on the N side of each line
  const junctions = graph.nodes.filter(n => n.deg >= 3 && n.maxRank >= 3);
  const jgrid = new Map();
  for (const n of junctions) {
    const key = Math.floor(n.x / 50) + ',' + Math.floor(n.z / 50);
    if (!jgrid.has(key)) jgrid.set(key, []);
    jgrid.get(key).push(n);
  }
  const nearJunction = (x, z, extra) => {
    const i = Math.floor(x / 50), j = Math.floor(z / 50);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) {
      const l = jgrid.get(a + ',' + b);
      if (l) for (const n of l) if (Math.hypot(n.x - x, n.z - z) < n.jr + extra) return true;
    }
    return false;
  };
  const dustUV = cellUV(DECAL.dust);
  for (const [ci, line] of M.kerbs) {
    const p = cmRing(line);
    const b = GB(ci);
    // split into painted / plain runs
    let run = [p[0], p[1]], painted = null;
    const flush = () => {
      if (run.length >= 4) {
        const layer = painted ? G.kerbpaint : G.kerb;
        b.wall(run, 0, KERB_H + 0.01, layer, painted ? 1.0 : 2.0, 0.3, 1, 0.92);
        b.strip(run, 0.2, KERB_H + 0.01, layer, painted ? 1.0 : 2.0, -1, 1.0);
      }
    };
    for (let k = 0; k + 3 < p.length; k += 2) {
      const mx = (p[k] + p[k + 2]) / 2, mz = (p[k + 1] + p[k + 3]) / 2;
      const pt = nearJunction(mx, mz, 14);
      if (painted === null) painted = pt;
      if (pt !== painted) { flush(); run = [p[k], p[k + 1]]; painted = pt; }
      run.push(p[k + 2], p[k + 3]);
    }
    flush();
    // dust drift along the kerb, on the road side
    const d = DB(ci);
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      const ox = dz / L * 0.85, oz = -dx / L * 0.85;
      d.quad([ax, 0.012, az], [bx, 0.012, bz], [bx + ox, 0.012, bz + oz], [ax + ox, 0.012, az + oz], [0, 1, 0],
        dustUV[0], dustUV[3], dustUV[2], dustUV[1]);
    }
  }

  // --- water surface (one mesh for all of it)
  const wb = new GroundBuilder();
  const waterRings = new Map();
  for (const [ci, rings] of M.water) {
    const rr = rings.map(cmRing);
    wb.poly(rr, WATER_Y, 0, 8);
    if (!waterRings.has(ci)) waterRings.set(ci, []);
    waterRings.get(ci).push(rr);
  }
  if (!wb.empty) {
    const wm = new THREE.Mesh(wb.build(), mats.water);
    wm.receiveShadow = true;
    W.scene.add(wm);
    W.waterMesh = wm;
  }

  // --- embankments: water on the N side
  for (const [ci, line] of M.banks) {
    const p = cmRing(line);
    const b = GB(ci);
    b.wall(p, WATER_Y - 1.2, KERB_H, G.stone, 4, 4, 1, 0.9);
    // riverside parapet on the land side
    b.wall(p, KERB_H, KERB_H + 0.75, G.deck, 3, 3, 1, 0.95);
    const inner = offsetLine(p, -0.25);
    b.wall(inner, KERB_H, KERB_H + 0.75, G.deck, 3, 3, -1, 0.85);
    b.strip(p, 0.25, KERB_H + 0.75, G.deck, 3, -1, 1.05);
  }
  // lake / pond banks (unoriented: decide side by testing the water polygons)
  for (const [ci, line] of M.lakebanks || []) {
    const p = cmRing(line);
    if (p.length < 4) continue;
    const rings = waterRings.get(ci) || [];
    const ax = p[0], az = p[1], bx = p[2], bz = p[3];
    const L = Math.hypot(bx - ax, bz - az) || 1;
    const tx = (ax + bx) / 2 + (bz - az) / L * 0.6, tz = (az + bz) / 2 - (bx - ax) / L * 0.6;
    let inWater = false;
    for (const rr of rings) if (pointInRings(tx, tz, rr)) { inWater = true; break; }
    const side = inWater ? 1 : -1;
    GB(ci).wall(p, WATER_Y - 1.0, KERB_H, G.stone, 4, 4, side, 0.9);
  }

  // --- bridges: deck is on the N side of rail lines
  for (const [ci, line] of M.rails) {
    const p = cmRing(line);
    const b = GB(ci);
    b.wall(p, -1.15, KERB_H, G.deck, 4, 2, -1, 0.8);              // deck edge, facing out over the water
    b.wall(p, KERB_H, KERB_H + 0.95, G.deck, 3, 3, -1, 0.95);      // parapet outer face
    const inner = offsetLine(p, 0.25);
    b.wall(inner, KERB_H, KERB_H + 0.95, G.deck, 3, 3, 1, 0.85);   // parapet inner face
    b.strip(p, 0.25, KERB_H + 0.95, G.deck, 3, 1, 1.05);
    // piers
    walkLine(p, 16, (x, z, dx, dz) => {
      const px = x + dz * 2.6, pz = z - dx * 2.6;
      b.box(px, WATER_Y - 1.5, pz, 1.1, -WATER_Y + 1.5 - 1.15, 1.1, Math.atan2(dz, dx), G.deck, 3, 0.8);
    }, 6);
  }

  // --- lane paint
  const paintUV = cellUV(DECAL.paint), yellowUV = cellUV(DECAL.yellow), zebraUV = cellUV(DECAL.zebra);
  const chunkOf = (x, z) => chunks.chunkOf(x, z);
  const lineQuad = (x0, z0, x1, z1, w, uv, y = 0.014) => {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
    if (L < 0.05) return;
    const ox = dz / L * w / 2, oz = -dx / L * w / 2;
    const ci = chunkOf((x0 + x1) / 2, (z0 + z1) / 2);
    if (ci < 0) return;
    DB(ci).quad([x0 - ox, y, z0 - oz], [x1 - ox, y, z1 - oz], [x1 + ox, y, z1 + oz], [x0 + ox, y, z0 + oz], [0, 1, 0], uv[0], uv[1], uv[2], uv[3]);
  };
  for (const line of M.marks.center) dashes(cmRing(line), 3.0, 4.5, (a, b, c, d) => lineQuad(a, b, c, d, 0.13, paintUV));
  for (const line of M.marks.lane) dashes(cmRing(line), 2.5, 5.0, (a, b, c, d) => lineQuad(a, b, c, d, 0.11, paintUV));
  W.zebras = [];
  for (const z of M.marks.zebra) {
    const x = z[0] / 100, zz = z[1] / 100, ang = z[2], w = z[3] / 100;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const nx = sa, nz = -ca;      // across the road
    const n = Math.max(3, Math.floor((w - 0.6) / 0.95));
    for (let k = 0; k < n; k++) {
      const off = -w / 2 + 0.5 + (k + 0.5) * (w - 1.0) / n;
      const cx = x + nx * off, cz = zz + nz * off;
      const ci = chunkOf(cx, cz);
      if (ci < 0) continue;
      DB(ci).ground(cx, 0.016, cz, ang, 1.5, 0.24, zebraUV);
    }
    W.zebras.push({ x, z: zz, ang, w });
  }
  for (const s of M.marks.stop) {
    const x = s[0] / 100, z = s[1] / 100, ang = s[2], w = s[3] / 100, dir = s[4];
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const nx = sa, nz = -ca;
    let cx = x, cz = z, half = w / 2 - 0.3;
    if (dir !== 0) { const side = dir > 0 ? 1 : -1; cx = x + nx * side * w / 4; cz = z + nz * side * w / 4; half = w / 4 - 0.2; }
    lineQuad(cx - nx * half, cz - nz * half, cx + nx * half, cz + nz * half, 0.35, paintUV, 0.015);
  }
  // speed breakers: a physical hump + paint
  W.bumps = [];
  for (const s of M.marks.bump) {
    const x = s[0] / 100, z = s[1] / 100, ang = s[2], w = s[3] / 100, painted = s[4];
    const ci = chunkOf(x, z);
    if (ci < 0) continue;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const nx = sa, nz = -ca;
    const half = w / 2 + 0.2;
    const prof = [[-0.55, 0], [-0.3, 0.07], [0, 0.1], [0.3, 0.07], [0.55, 0]];
    const b = GB(ci);
    for (let k = 0; k < prof.length - 1; k++) {
      const [d0, h0] = prof[k], [d1, h1] = prof[k + 1];
      const p0 = [x + ca * d0 - nx * half, h0, z + sa * d0 - nz * half];
      const p1 = [x + ca * d0 + nx * half, h0, z + sa * d0 + nz * half];
      const p2 = [x + ca * d1 + nx * half, h1, z + sa * d1 + nz * half];
      const p3 = [x + ca * d1 - nx * half, h1, z + sa * d1 - nz * half];
      const sl = (h1 - h0) / (d1 - d0);
      const ln = Math.hypot(sl, 1);
      const ny = 1 / ln, nAlong = -sl / ln;
      const vs = [p0, p1, p2, p3].map(P => b.v(P[0], P[1], P[2], ca * nAlong, ny, sa * nAlong, P[0] / 7, P[2] / 7, G.asphalt, 0.85));
      // orient up
      const ux = p1[0] - p0[0], uz = p1[2] - p0[2], vx = p3[0] - p0[0], vz = p3[2] - p0[2];
      const cy = uz * vx - ux * vz;
      if (cy >= 0) b.i.push(vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]); else b.i.push(vs[0], vs[2], vs[1], vs[0], vs[3], vs[2]);
    }
    if (painted) {
      const n = Math.floor(w / 0.6);
      for (let k = 0; k < n; k += 2) {
        const off = -w / 2 + (k + 0.5) * w / n;
        DB(ci).ground(x + nx * off, 0.105, z + nz * off, ang, 0.32, w / n / 2, k % 4 ? yellowUV : paintUV);
      }
    }
    W.bumps.push({ x, z, ang, w });
  }
  // potholes, oil stains, rubbish: deterministic per edge
  const rng = new RNG(911);
  const potUV = cellUV(DECAL.pothole), oilUV = cellUV(DECAL.oil), garbUV = cellUV(DECAL.garbage);
  W.potholes = [];
  const tmp = [0, 0, 0, 0];
  for (const e of graph.edges) {
    const per = e.rank <= 2 ? 34 : e.rank === 3 ? 60 : 140;
    let s = rng.range(5, per);
    while (s < e.len - 5) {
      graph.at(e, s, tmp);
      const lat = rng.range(-e.w / 2 + 0.8, e.w / 2 - 0.8);
      const x = tmp[0] + tmp[3] * lat, z = tmp[1] - tmp[2] * lat;
      const ci = chunkOf(x, z);
      if (ci >= 0) {
        const r = rng.range(0.35, 0.8);
        DB(ci).ground(x, 0.018, z, rng.range(0, 6.28), r, r * rng.range(0.7, 1.0), potUV);
        W.potholes.push({ x, z, r: r * 0.8 });
      }
      s += rng.range(per * 0.6, per * 1.6);
    }
    if (e.rank >= 2 && rng.chance(0.5)) {
      graph.at(e, e.len * rng.range(0.2, 0.8), tmp);
      const ci = chunkOf(tmp[0], tmp[1]);
      if (ci >= 0) DB(ci).ground(tmp[0], 0.013, tmp[1], rng.range(0, 6.28), rng.range(0.6, 1.4), rng.range(0.5, 1.0), oilUV);
    }
    if (e.rank <= 3 && rng.chance(0.12)) {
      graph.at(e, e.len * rng.range(0.1, 0.9), tmp);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = e.w / 2 + 0.6;
      const x = tmp[0] + tmp[3] * off * side, z = tmp[1] - tmp[2] * off * side;
      const ci = chunkOf(x, z);
      if (ci >= 0) DB(ci).ground(x, KERB_H + 0.02, z, rng.range(0, 6.28), rng.range(0.6, 1.1), rng.range(0.5, 0.9), garbUV);
    }
  }

  // --- emit meshes
  for (const [ci, b] of gb) {
    if (b.empty) continue;
    const m = new THREE.Mesh(b.build(), mats.ground);
    m.receiveShadow = true;
    chunks.add(ci, m);
  }
  for (const [ci, b] of db) {
    if (b.empty) continue;
    const m = new THREE.Mesh(b.build(), mats.decal);
    m.renderOrder = 1;
    m.receiveShadow = true;
    chunks.add(ci, m);
  }
}

// offset a polyline sideways by d along N (=(dz,-dx)); simple per-vertex average normal
export function offsetLine(p, d) {
  const out = new Float64Array(p.length);
  const n = p.length / 2;
  for (let k = 0; k < n; k++) {
    let nx = 0, nz = 0;
    if (k > 0) { const dx = p[2 * k] - p[2 * k - 2], dz = p[2 * k + 1] - p[2 * k - 1], L = Math.hypot(dx, dz) || 1; nx += dz / L; nz += -dx / L; }
    if (k < n - 1) { const dx = p[2 * k + 2] - p[2 * k], dz = p[2 * k + 3] - p[2 * k + 1], L = Math.hypot(dx, dz) || 1; nx += dz / L; nz += -dx / L; }
    const L = Math.hypot(nx, nz) || 1;
    out[2 * k] = p[2 * k] + nx / L * d; out[2 * k + 1] = p[2 * k + 1] + nz / L * d;
  }
  return out;
}
