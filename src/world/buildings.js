// Buildings from OSM footprints: Pune apartments, peth wadas, bungalows, colleges, glass offices,
// temples, petrol-pump canopies. Shop fronts + signboards on street-facing ground floors,
// rooftop water tanks, stair cabins, dish antennas, solar heaters, hoardings, akash kandils.
import * as THREE from 'three';
import { FacadeBuilder, ColorBuilder, QuadBuilder, cmRing } from './geo.js';
import { F } from '../gfx/textures.js';
import { RNG, hash1 } from '../core/util.js';

const BASE = 0.15;
const PAL = {
  apt: [[0.97, 0.93, 0.82], [0.99, 0.9, 0.64], [0.98, 0.83, 0.7], [0.97, 0.84, 0.83], [0.8, 0.88, 0.96], [0.82, 0.94, 0.85],
        [0.97, 0.97, 0.95], [0.82, 0.82, 0.8], [0.88, 0.84, 0.95], [0.93, 0.8, 0.55], [0.99, 0.95, 0.88], [0.9, 0.93, 0.7]],
  com: [[0.95, 0.95, 0.93], [0.86, 0.86, 0.85], [0.98, 0.93, 0.85], [0.8, 0.85, 0.9], [0.95, 0.88, 0.78]],
  old: [[0.93, 0.9, 0.84], [0.9, 0.74, 0.46], [0.68, 0.82, 0.92], [0.78, 0.87, 0.62], [0.92, 0.72, 0.72], [0.67, 0.74, 0.82], [0.95, 0.85, 0.6]],
  bung: [[0.98, 0.97, 0.93], [0.99, 0.92, 0.78], [0.87, 0.58, 0.47], [0.98, 0.88, 0.55], [0.85, 0.9, 0.82]],
  inst: [[0.96, 0.88, 0.62], [0.94, 0.91, 0.82], [0.85, 0.6, 0.48], [0.9, 0.9, 0.88]],
  temple: [[1.0, 0.7, 0.35], [0.98, 0.95, 0.88]],
  white: [[1, 1, 1]],
};
const SHOPS = ['shop0', 'shop1', 'shop2', 'shop3', 'shop4', 'shop5', 'shop0', 'shop1', 'shop3'];
const STYLES = [
  { floors: ['apt0', 'apt1', 'apt2', 'apt3', 'apt4', 'apt5'], side: ['side0', 'side1'], lane: ['stilt', 'lobby', 'stilt'], main: SHOPS, fh: 3.1, gh: 3.25, pal: PAL.apt, shops: true },
  { floors: ['com0', 'com1', 'com2', 'apt0', 'apt1'], side: ['side0', 'side1'], lane: ['shop0', 'shop2', 'lobby', 'shop3'], main: SHOPS, fh: 3.35, gh: 3.9, pal: PAL.com, shops: true },
  { floors: ['old0', 'old1', 'old2'], side: ['plain', 'side1'], lane: ['old0', 'old1', 'shop2', 'shop0', 'shop3'], main: SHOPS, fh: 3.15, gh: 3.4, pal: PAL.old, shops: true },
  { floors: ['bung0', 'bung1'], side: ['bung0', 'plain'], lane: ['bung0', 'bung1'], main: ['bung0', 'shop1', 'bung1'], fh: 3.2, gh: 3.2, pal: PAL.bung },
  { floors: ['inst0', 'inst1'], side: ['inst1', 'plain'], lane: ['inst0', 'inst1'], main: ['inst0', 'inst1'], fh: 3.7, gh: 3.7, pal: PAL.inst },
  { floors: ['stone0', 'stone1'], side: ['stone0', 'stone1'], lane: ['stone1'], main: ['stone1'], fh: 4.4, gh: 4.6, pal: PAL.white },
  { floors: ['shed'], side: ['shed'], lane: ['shed', 'shop2'], main: ['shop2', 'shop0'], fh: 2.8, gh: 2.9, pal: PAL.white },
  null,
  { floors: ['temple'], side: ['temple'], lane: ['temple'], main: ['temple'], fh: 3.4, gh: 3.8, pal: PAL.temple },
  { floors: ['glass0', 'glass1'], side: ['glass0', 'glass1'], lane: ['shop1', 'lobby'], main: ['shop1', 'shop4'], fh: 3.6, gh: 4.3, pal: PAL.white, shops: true },
];

function signedArea(p) {
  let a = 0;
  for (let i = 0, n = p.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1];
  }
  return a / 2;
}
function isConvex(p) {
  const n = p.length / 2;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = i, b = (i + 1) % n, c = (i + 2) % n;
    const cr = (p[2 * b] - p[2 * a]) * (p[2 * c + 1] - p[2 * b + 1]) - (p[2 * b + 1] - p[2 * a + 1]) * (p[2 * c] - p[2 * b]);
    if (Math.abs(cr) < 1e-6) continue;
    const s = Math.sign(cr);
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}
// offset ring (outward normals given) by d (positive = outward), mitre clamped
function offsetRing(p, normals, d) {
  const n = p.length / 2;
  const out = new Float64Array(p.length);
  for (let i = 0; i < n; i++) {
    const pi = (i - 1 + n) % n;
    let nx = normals[2 * pi] + normals[2 * i], nz = normals[2 * pi + 1] + normals[2 * i + 1];
    const L = Math.hypot(nx, nz) || 1;
    nx /= L; nz /= L;
    const cosHalf = nx * normals[2 * i] + nz * normals[2 * i + 1];
    const m = Math.min(2.5, 1 / Math.max(0.3, cosHalf));
    out[2 * i] = p[2 * i] + nx * d * m; out[2 * i + 1] = p[2 * i + 1] + nz * d * m;
  }
  return out;
}

// --- reusable prop geometry
const GEO = {};
function protoGeo() {
  if (GEO.tank) return GEO;
  GEO.tank = new THREE.CylinderGeometry(0.62, 0.62, 1.3, 10, 1);
  GEO.tankLid = new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8, 1);
  GEO.box = new THREE.BoxGeometry(1, 1, 1);
  GEO.dish = new THREE.CylinderGeometry(0.42, 0.06, 0.18, 12, 1, true);
  GEO.post = new THREE.CylinderGeometry(0.04, 0.04, 1, 4);
  GEO.solarTank = new THREE.CylinderGeometry(0.22, 0.22, 1.7, 8);
  GEO.kandil = new THREE.OctahedronGeometry(0.28, 0);
  GEO.kandilTail = new THREE.ConeGeometry(0.12, 0.45, 4);
  GEO.shikhara = new THREE.ConeGeometry(1, 1, 8, 4);
  GEO.flagTri = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0.9, -0.25, 0], 3)); g.computeVertexNormals(); return g; })();
  return GEO;
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), EUL = new THREE.Euler();
function mat(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
  EUL.set(rx, ry, rz); Q.setFromEuler(EUL);
  return M4.compose(V.set(x, y, z), Q, S3.set(sx, sy, sz));
}

export function buildBuildings(M, W) {
  const { chunks, mats, signs, collision } = W;
  protoGeo();
  const fbs = new Map(), cbs = new Map(), sbs = new Map();
  const FB = (ci) => { let b = fbs.get(ci); if (!b) fbs.set(ci, b = new FacadeBuilder()); return b; };
  const CB = (ci) => { let b = cbs.get(ci); if (!b) cbs.set(ci, b = new ColorBuilder()); return b; };
  const SB = (ci) => { let b = sbs.get(ci); if (!b) sbs.set(ci, b = new QuadBuilder()); return b; };
  W.footprints = [];
  let shopCount = 0;

  for (let bi = 0; bi < M.buildings.length; bi++) {
    const B = M.buildings[bi];
    const [ci, ringCm, levels, styleId, roof, flags, tintIdx, hoard, peth] = B;
    let p = cmRing(ringCm);
    const n = p.length / 2;
    if (n < 3) continue;
    const rng = new RNG(ringCm[0] * 31 + ringCm[1] * 17 + bi);
    const seed = hash1(bi * 7919);
    const area = signedArea(p);
    // outward normals per edge
    const normals = new Float64Array(p.length);
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = p[2 * j] - p[2 * i], dz = p[2 * j + 1] - p[2 * i + 1], L = Math.hypot(dx, dz) || 1;
      normals[2 * i] = sgn * dz / L; normals[2 * i + 1] = -sgn * dx / L;
    }
    collision.addRing(p, 0);
    W.footprints.push({ p, h: 0 });
    const fb = FB(ci);
    if (styleId === 7) { canopy(fb, CB(ci), p, normals, rng, seed); continue; }
    const st = STYLES[styleId] || STYLES[0];
    const tint = st.pal[tintIdx % st.pal.length].map(v => v * rng.range(0.94, 1.03));
    const fh = st.fh, gh = levels > 1 || st.shops ? st.gh : st.fh;
    const H = gh + (levels - 1) * fh;
    const top = BASE + H;
    const pitched = roof === 1 && n <= 8 && isConvex(p) && Math.abs(area) < 900;
    const parapet = pitched ? 0 : (styleId === 6 ? 0.15 : 0.95);
    const floorVar = F[st.floors[rng.int(0, st.floors.length - 1)]];
    const floorVar2 = F[st.floors[rng.int(0, st.floors.length - 1)]];
    const sideVar = F[st.side[rng.int(0, st.side.length - 1)]];
    W.footprints[W.footprints.length - 1].h = top + parapet;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = p[2 * i], az = p[2 * i + 1], bx = p[2 * j], bz = p[2 * j + 1];
      const nx = normals[2 * i], nz = normals[2 * i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const fl = flags[i] || '0';
      const bays = Math.max(1, Math.round(L / 3.0));
      if (fl === '0') {
        fb.quad(ax, az, bx, bz, BASE, top, nx, nz, 0, bays, 0, levels, sideVar, tint, seed);
      } else {
        // ground floor
        const shopsHere = (fl === '2' && st.shops) || (fl === '1' && styleId === 2 && peth && rng.chance(0.45)) ||
                          (fl === '1' && styleId === 1);
        if (shopsHere && L > 2.6) {
          const nseg = Math.max(1, Math.round(L / rng.range(3.6, 6.0)));
          for (let k = 0; k < nseg; k++) {
            const t0 = k / nseg, t1 = (k + 1) / nseg;
            const sx0 = ax + (bx - ax) * t0, sz0 = az + (bz - az) * t0, sx1 = ax + (bx - ax) * t1, sz1 = az + (bz - az) * t1;
            const segL = L / nseg;
            const sb = Math.max(1, Math.round(segL / 3.0));
            const tile = F[(fl === '2' ? st.main : st.lane)[rng.int(0, (fl === '2' ? st.main : st.lane).length - 1)]];
            fb.quad(sx0, sz0, sx1, sz1, BASE, BASE + gh, nx, nz, 0, sb, 0, 1, tile, tint, seed);
            const isShop = tile >= F.shop0 && tile <= F.shop5;
            if (isShop) {
              addSign(SB(ci), signs, rng, sx0, sz0, sx1, sz1, nx, nz, BASE + gh, segL);
              shopCount++;
              if (peth && rng.chance(0.35)) awning(CB(ci), rng, sx0, sz0, sx1, sz1, nx, nz, BASE + gh - 1.05);
            }
          }
        } else {
          const tile = F[st.lane[rng.int(0, st.lane.length - 1)]];
          fb.quad(ax, az, bx, bz, BASE, BASE + gh, nx, nz, 0, bays, 0, 1, tile, tint, seed);
          if (rng.chance(0.06)) patya(SB(ci), signs, rng, ax, az, bx, bz, nx, nz, BASE + 1.5);
        }
        // upper floors
        if (levels > 1) {
          const v = i % 2 ? floorVar2 : floorVar;
          fb.quad(ax, az, bx, bz, BASE + gh, top, nx, nz, 0, bays, 0, levels - 1, v, tint, seed);
          // diwali lanterns hanging from balconies
          if ((styleId === 0 || styleId === 2) && rng.chance(0.55)) {
            for (let f = 1; f < levels; f++) for (let k = 0; k < bays; k++) {
              if (!rng.chance(0.07)) continue;
              const t = (k + 0.5) / bays;
              const x = ax + (bx - ax) * t + nx * 0.42, z = az + (bz - az) * t + nz * 0.42;
              const y = BASE + gh + f * fh - 0.75;
              kandil(CB(ci), rng, x, y, z);
            }
          }
        }
      }
      // parapet
      if (parapet > 0) {
        fb.quad(ax, az, bx, bz, top, top + parapet, nx, nz, 0, bays, 0, 1, F.parapet, tint, seed);
      }
    }
    if (pitched) {
      pitchedRoof(fb, p, normals, top, tint, seed, Math.abs(area));
    } else {
      // roof slab + parapet thickness
      fb.poly([p], top, F.roof, 4, tint, seed);
      if (parapet > 0) {
        const inner = offsetRing(p, normals, -0.22);
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ax = inner[2 * i], az = inner[2 * i + 1], bx = inner[2 * j], bz = inner[2 * j + 1];
          fb.quad(ax, az, bx, bz, top, top + parapet, -normals[2 * i], -normals[2 * i + 1], 0, Math.hypot(bx - ax, bz - az) / 3, 0, 0.3, F.parapet, tint, seed);
          // top cap
          const oax = p[2 * i], oaz = p[2 * i + 1], obx = p[2 * j], obz = p[2 * j + 1];
          const y = top + parapet;
          const i0 = fb.v(oax, y, oaz, 0, 1, 0, 0, 0, F.parapet, tint, seed);
          const i1 = fb.v(obx, y, obz, 0, 1, 0, 1, 0, F.parapet, tint, seed);
          const i2 = fb.v(bx, y, bz, 0, 1, 0, 1, 0.05, F.parapet, tint, seed);
          const i3 = fb.v(ax, y, az, 0, 1, 0, 0, 0.05, F.parapet, tint, seed);
          const cy = (obz - oaz) * (ax - oax) - (obx - oax) * (az - oaz);
          if (cy >= 0) fb.i.push(i0, i1, i2, i0, i2, i3); else fb.i.push(i0, i2, i1, i0, i3, i2);
        }
        if (styleId !== 6 && styleId !== 8) rooftop(CB(ci), rng, p, normals, top, levels, Math.abs(area));
      }
      if (styleId === 8) shikhara(fb, CB(ci), p, top, tint, seed, rng);
    }
  }
  // hoardings (rooftop billboards facing the nearest chowk)
  for (const h of M.hoardings) {
    const x = h[2] / 100, z = h[3] / 100, ang = h[4];
    const ci = chunks.chunkOf(x, z);
    if (ci < 0) continue;
    // find roof height by footprint lookup
    let y = null;
    for (const f of W.footprints) {
      const p = f.p;
      let inside = false;
      for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
        if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi)) inside = !inside;
      }
      if (inside) { y = f.h; break; }
    }
    if (y === null || y < 6) continue;
    hoarding(CB(ci), SB(ci), signs, x, y, z, ang, h[0]);
  }

  for (const [ci, b] of fbs) {
    if (b.empty) continue;
    const m = new THREE.Mesh(b.build(), mats.facade);
    m.castShadow = true; m.receiveShadow = true;
    chunks.add(ci, m);
  }
  for (const [ci, b] of cbs) {
    if (b.empty) continue;
    const m = new THREE.Mesh(b.build(), mats.prop);
    m.castShadow = true; m.receiveShadow = true;
    chunks.add(ci, m, 'detail');
  }
  for (const [ci, b] of sbs) {
    if (b.empty) continue;
    const m = new THREE.Mesh(b.build(), mats.sign);
    m.receiveShadow = true;
    chunks.add(ci, m, 'detail');
  }
  W.shopCount = shopCount;
}

function addSign(sb, signs, rng, ax, az, bx, bz, nx, nz, yTop, L) {
  const s = rng.chance(0.08) ? signs.patya[rng.int(0, signs.patya.length - 1)] : signs.shops[rng.int(0, signs.shops.length - 1)];
  const inset = 0.12;
  const dx = (bx - ax) / L, dz = (bz - az) / L;
  const w = L - 2 * inset;
  const h = Math.min(1.0, w / 4);
  const ox = nx * 0.12, oz = nz * 0.12;
  const x0 = ax + dx * inset + ox, z0 = az + dz * inset + oz, x1 = bx - dx * inset + ox, z1 = bz - dz * inset + oz;
  const y1 = yTop - 0.12, y0 = y1 - h;
  // text must read left-to-right when seen from the street
  const ltr = (dx * nz - dz * nx) > 0;
  sb.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [nx, 0, nz], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
}
function patya(sb, signs, rng, ax, az, bx, bz, nx, nz, y) {
  const s = signs.patya[rng.int(0, signs.patya.length - 1)];
  const L = Math.hypot(bx - ax, bz - az);
  if (L < 1.4) return;
  const t = rng.range(0.2, 0.8);
  const cx = ax + (bx - ax) * t + nx * 0.03, cz = az + (bz - az) * t + nz * 0.03;
  const dx = (bx - ax) / L, dz = (bz - az) / L;
  const hw = 0.32, hh = 0.16;
  const ltr = (dx * nz - dz * nx) > 0;
  sb.quad([cx - dx * hw, y - hh, cz - dz * hw], [cx + dx * hw, y - hh, cz + dz * hw], [cx + dx * hw, y + hh, cz + dz * hw], [cx - dx * hw, y + hh, cz - dz * hw],
    [nx, 0, nz], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
}
function awning(cb, rng, ax, az, bx, bz, nx, nz, y) {
  const c = rng.pick([[0.15, 0.35, 0.7], [0.75, 0.2, 0.15], [0.9, 0.6, 0.1], [0.2, 0.55, 0.3], [0.6, 0.6, 0.62]]);
  const o = 1.1;
  const p0 = [ax, y, az], p1 = [bx, y, bz], p2 = [bx + nx * o, y - 0.45, bz + nz * o], p3 = [ax + nx * o, y - 0.45, az + nz * o];
  const len = Math.hypot(o, 0.45);
  const ny = o / len, nh = 0.45 / len;
  const n = [nx * nh, ny, nz * nh];
  const v = [p0, p1, p2, p3].map(P => cb.v(P[0], P[1], P[2], n[0], n[1], n[2], c[0], c[1], c[2]));
  const ux = p1[0] - p0[0], uz = p1[2] - p0[2], wx = p3[0] - p0[0], wy = p3[1] - p0[1], wz = p3[2] - p0[2];
  const cy = uz * wx - ux * wz;
  if (cy >= 0) cb.i.push(v[0], v[1], v[2], v[0], v[2], v[3]); else cb.i.push(v[0], v[2], v[1], v[0], v[3], v[2]);
  // underside
  const vb = [p0, p1, p2, p3].map(P => cb.v(P[0], P[1] - 0.01, P[2], -n[0], -n[1], -n[2], c[0] * 0.6, c[1] * 0.6, c[2] * 0.6));
  if (cy >= 0) cb.i.push(vb[0], vb[2], vb[1], vb[0], vb[3], vb[2]); else cb.i.push(vb[0], vb[1], vb[2], vb[0], vb[2], vb[3]);
}
function kandil(cb, rng, x, y, z) {
  const col = rng.pick([[1, 0.55, 0.1], [1, 0.2, 0.3], [0.2, 0.6, 1], [1, 0.85, 0.2], [0.6, 0.2, 0.9], [0.1, 0.8, 0.4]]);
  cb.addGeo(GEO.kandil, mat(x, y, z, 1, 1.25, 1, rng.range(0, 3)), col, 1.0);
  cb.addGeo(GEO.kandilTail, mat(x, y - 0.45, z, 1, 1, 1, 0, Math.PI), col.map(v => v * 0.8), 0.6);
  cb.addGeo(GEO.post, mat(x, y + 0.5, z, 0.3, 0.5, 0.3), [0.2, 0.2, 0.2]);
}
function rooftop(cb, rng, p, normals, top, levels, area) {
  const n = p.length / 2;
  // centroid & extents
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  const inner = offsetRing(p, normals, -1.4);
  const pick = () => {
    const i = rng.int(0, n - 1);
    const t = rng.next();
    const j = (i + 1) % n;
    const ex = inner[2 * i] + (inner[2 * j] - inner[2 * i]) * t, ez = inner[2 * i + 1] + (inner[2 * j + 1] - inner[2 * i + 1]) * t;
    const k = rng.range(0, 0.5);
    return [ex + (cx - ex) * k, ez + (cz - ez) * k];
  };
  if (area < 40) return;
  // stair cabin (mumty)
  if (levels >= 3 && area > 90) {
    const [x, z] = [cx + rng.range(-2, 2), cz + rng.range(-2, 2)];
    const rot = Math.atan2(normals[1], normals[0]);
    cb.addGeo(GEO.box, mat(x, top + 1.3, z, 2.6, 2.6, 3.0, rot), [0.82, 0.8, 0.76]);
  }
  // black Sintex tanks on a frame
  const tanks = area > 300 ? rng.int(2, 4) : rng.int(1, 2);
  for (let k = 0; k < tanks; k++) {
    const [x, z] = pick();
    const s = rng.range(0.8, 1.15);
    const lift = rng.chance(0.4) ? 0.6 : 0;
    cb.addGeo(GEO.tank, mat(x, top + 0.65 * s + lift, z, s, s, s), rng.chance(0.85) ? [0.06, 0.06, 0.07] : [0.85, 0.85, 0.82]);
    cb.addGeo(GEO.tankLid, mat(x, top + 1.32 * s + lift, z, s, 1, s), [0.08, 0.08, 0.09]);
    if (lift) cb.addGeo(GEO.box, mat(x, top + lift / 2, z, 1.4, lift, 1.4), [0.35, 0.33, 0.3]);
  }
  if (rng.chance(0.35)) {
    const [x, z] = pick();
    cb.addGeo(GEO.dish, mat(x, top + 0.9, z, 1, 1, 1, rng.range(0, 6), 0.9), [0.85, 0.85, 0.85]);
    cb.addGeo(GEO.post, mat(x, top + 0.45, z, 1, 0.9, 1), [0.3, 0.3, 0.3]);
  }
  if (rng.chance(0.3) && area > 60) {
    // solar water heater: tilted panel + tank
    const [x, z] = pick();
    const r = rng.range(0, 6.28);
    cb.addGeo(GEO.box, mat(x, top + 0.75, z, 2.0, 0.08, 1.6, r, 0.45), [0.08, 0.12, 0.22]);
    cb.addGeo(GEO.solarTank, mat(x - Math.sin(r) * 0.0, top + 1.3, z, 1, 1, 1, r, 0, Math.PI / 2), [0.8, 0.8, 0.82]);
  }
}
function pitchedRoof(fb, p, normals, top, tint, seed, area) {
  const n = p.length / 2;
  const eave = offsetRing(p, normals, 0.45);
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  const rise = Math.min(3.0, Math.max(1.1, Math.sqrt(area) * 0.28));
  const apex = [cx, top + rise, cz];
  const y = top - 0.12;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = [eave[2 * i], y, eave[2 * i + 1]], b = [eave[2 * j], y, eave[2 * j + 1]];
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
    const slant = Math.hypot(Math.hypot(apex[0] - mx, apex[2] - mz), rise);
    fb.tri(a, b, apex, [0, 0], [L / 3, 0], [L / 6, slant / 3.1], F.tiles, [1, 1, 1], seed);
  }
  // eave underside (soffit)
  fb.poly([eave], y - 0.02, F.plain, 3, tint.map(v => v * 0.7), seed, true);
}
function shikhara(fb, cb, p, top, tint, seed, rng) {
  const n = p.length / 2;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  let minR = 1e9;
  for (let i = 0; i < n; i++) minR = Math.min(minR, Math.hypot(p[2 * i] - cx, p[2 * i + 1] - cz));
  const R = Math.max(1.0, Math.min(3.0, minR * 0.8));
  const h = R * 3.2;
  cb.addGeo(GEO.shikhara, mat(cx, top + h / 2, cz, R, h, R), [1.0, 0.62, 0.25]);
  cb.addGeo(GEO.post, mat(cx, top + h + 0.9, cz, 1, 1.8, 1), [0.3, 0.25, 0.2]);
  cb.addGeo(GEO.flagTri, mat(cx + 0.03, top + h + 1.75, cz, 1.2, 1.2, 1.2, rng.range(0, 6)), [1.0, 0.45, 0.05]);
}
function canopy(fb, cb, p, normals, rng, seed) {
  const n = p.length / 2;
  const y0 = 5.2, y1 = 5.9;
  const tint = [0.12, 0.55, 0.32];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const L = Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]);
    fb.quad(p[2 * i], p[2 * i + 1], p[2 * j], p[2 * j + 1], y0, y1, normals[2 * i], normals[2 * i + 1], 0, L / 3, 0, 1, F.bus, tint, seed);
  }
  fb.poly([p], y1, F.roof, 4, [1, 1, 1], seed);
  fb.poly([p], y0, F.bus, 3, [0.95, 0.95, 0.95], seed, true);
  const inner = offsetRing(p, normals, -1.5);
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 4))) {
    cb.addGeo(GEO.box, mat(inner[2 * i], y0 / 2, inner[2 * i + 1], 0.5, y0, 0.5), [0.85, 0.85, 0.85]);
  }
  for (let k = -1; k <= 1; k += 2) {
    cb.addGeo(GEO.box, mat(cx + k * 2.5, 0.85, cz, 0.8, 1.5, 0.5), [0.9, 0.9, 0.9]);
    cb.addGeo(GEO.box, mat(cx + k * 2.5, 1.2, cz + 0.26, 0.6, 0.5, 0.02), [0.1, 0.5, 0.3], 0.4);
  }
}
function hoarding(cb, sb, signs, x, y, z, ang, k) {
  const s = signs.ads[k % signs.ads.length];
  const nx = Math.cos(ang), nz = Math.sin(ang);
  const tx = -nz, tz = nx;
  const W = 9, Hh = 4.5, lift = 2.0;
  const y0 = y + lift, y1 = y0 + Hh;
  // posts + truss
  for (const o of [-W / 2 + 0.6, 0, W / 2 - 0.6]) {
    cb.addGeo(GEO.box, mat(x + tx * o - nx * 0.4, y + (lift + Hh) / 2, z + tz * o - nz * 0.4, 0.18, lift + Hh, 0.18, -ang), [0.25, 0.25, 0.27]);
    cb.addGeo(GEO.box, mat(x + tx * o - nx * 1.4, y + lift * 0.6, z + tz * o - nz * 1.4, 0.12, lift * 1.2, 0.12, -ang, 0, 0.0), [0.25, 0.25, 0.27]);
  }
  cb.addGeo(GEO.box, mat(x - nx * 0.12, (y0 + y1) / 2, z - nz * 0.12, W + 0.3, Hh + 0.3, 0.15, Math.atan2(-tz, tx)), [0.2, 0.2, 0.22]);
  // board faces the junction (+n side)
  const fx = x + nx * 0.0, fz = z + nz * 0.0;
  sb.quad([fx - tx * W / 2, y0, fz - tz * W / 2], [fx + tx * W / 2, y0, fz + tz * W / 2], [fx + tx * W / 2, y1, fz + tz * W / 2], [fx - tx * W / 2, y1, fz - tz * W / 2],
    [nx, 0, nz], s.u1, s.v0, s.u0, s.v1);
  // lights on top
  for (const o of [-W / 3, 0, W / 3]) cb.addGeo(GEO.box, mat(x + tx * o + nx * 0.5, y1 + 0.25, z + tz * o + nz * 0.5, 0.3, 0.15, 0.3), [1, 0.95, 0.8], 1.0);
}
