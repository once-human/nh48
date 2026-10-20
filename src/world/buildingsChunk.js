// Per-chunk buildings: PBR facades (windows/interiors/shop fronts are procedural in the shader),
// sunshade bands (chajjas), parapets, flat & tiled roofs, temple shikharas, Shaniwar Wada's
// ramparts, rooftop clutter (Sintex tanks, stair cabins, dishes, solar heaters), Diwali lanterns,
// shop boards and rooftop hoardings.
import * as THREE from 'three';
import { cmRing, triangulate, ColorBuilder, QuadBuilder, lin } from './geo.js';
import { STYLE_PARAMS, WL } from '../gfx/pbr.js';
import { RNG, hash1 } from '../core/util.js';

export const BASE = 0.15;
const SHOP_CELL = 3.6;      // must match the facade shader

// sRGB paint palettes per style (converted to linear when written)
const PAL = {
  apt: [[0.97, 0.93, 0.82], [0.99, 0.9, 0.64], [0.98, 0.83, 0.7], [0.97, 0.82, 0.8], [0.8, 0.88, 0.96], [0.82, 0.94, 0.85],
    [0.97, 0.97, 0.95], [0.84, 0.84, 0.82], [0.88, 0.84, 0.95], [0.93, 0.78, 0.55], [0.99, 0.95, 0.88], [0.9, 0.93, 0.7],
    [0.95, 0.72, 0.55], [0.75, 0.82, 0.88], [1.0, 0.98, 0.9], [0.92, 0.88, 0.8]],
  com: [[0.95, 0.95, 0.93], [0.86, 0.86, 0.85], [0.98, 0.93, 0.85], [0.8, 0.85, 0.9], [0.95, 0.88, 0.78], [0.7, 0.72, 0.75]],
  old: [[0.93, 0.9, 0.84], [0.9, 0.74, 0.46], [0.66, 0.8, 0.92], [0.78, 0.87, 0.62], [0.92, 0.72, 0.72], [0.62, 0.72, 0.85], [0.95, 0.85, 0.6], [0.98, 0.96, 0.92]],
  bung: [[0.98, 0.97, 0.93], [0.99, 0.92, 0.78], [0.87, 0.6, 0.5], [0.98, 0.88, 0.58], [0.86, 0.9, 0.83], [1, 1, 1]],
  inst: [[0.96, 0.88, 0.62], [0.94, 0.91, 0.82], [0.85, 0.6, 0.48], [0.9, 0.9, 0.88]],
  temple: [[1.0, 0.72, 0.38], [0.98, 0.95, 0.9], [1.0, 0.84, 0.55]],
  stone: [[0.5, 0.49, 0.47], [0.58, 0.55, 0.5], [0.66, 0.62, 0.55]],
  camp: [[0.98, 0.92, 0.75], [0.95, 0.85, 0.6], [1, 0.98, 0.94], [0.9, 0.8, 0.65]],
  white: [[1, 1, 1]], black: [[0.12, 0.12, 0.13]], brick: [[1, 1, 1]], glass: [[0.75, 0.8, 0.85]],
};
function styleLook(style, district, rng) {
  const r = rng.next();
  switch (style) {
    case 0: return { pal: district === 2 ? PAL.camp : PAL.apt, layer: r < 0.2 ? WL.cladding : r < 0.55 ? WL.plaster : r < 0.8 ? WL.stucco : WL.beige, chajja: true };
    case 1: return { pal: PAL.com, layer: r < 0.4 ? WL.tiles : r < 0.7 ? WL.cladding : WL.concrete, chajja: r > 0.6 };
    case 2: return { pal: district === 2 ? PAL.camp : PAL.old, layer: r < 0.55 ? WL.worn : r < 0.8 ? WL.damaged : WL.plaster, chajja: true };
    case 3: return { pal: PAL.bung, layer: r < 0.6 ? WL.stucco : WL.plaster, chajja: r < 0.6 };
    case 4: return { pal: PAL.inst, layer: r < 0.6 ? WL.plaster : WL.concrete, chajja: true };
    case 5: return { pal: PAL.stone, layer: WL.sandstone, chajja: false };
    case 6: return { pal: PAL.white, layer: r < 0.6 ? WL.tin : WL.brick, chajja: false };
    case 8: return { pal: PAL.temple, layer: WL.stucco, chajja: false };
    case 9: return { pal: PAL.glass, layer: WL.concrete, chajja: false };
    case 10: return { pal: PAL.stone, layer: r < 0.5 ? WL.sandstone : WL.brick, chajja: false };
    case 11: return { pal: PAL.white, layer: WL.rubble, chajja: false };
    case 12: return { pal: PAL.stone, layer: WL.sandstone, chajja: false };
    case 13: return { pal: PAL.black, layer: WL.concrete, chajja: false };
    case 14: return { pal: PAL.brick, layer: WL.brick, chajja: false };
    default: return { pal: PAL.apt, layer: WL.plaster, chajja: false };
  }
}

// ---------------------------------------------------------------- builders
export class FacadeB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.e = []; this.t = []; this.s = []; this.tn = []; this.top = []; this.i = []; this.c = 0; }
  v(x, y, z, nx, ny, nz, u, h, A) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, h); this.e.push(A.eu, A.eL);
    this.t.push(A.tint[0], A.tint[1], A.tint[2]); this.s.push(A.style, A.layer, A.flags, A.seed);
    this.tn.push(A.tx, A.tz); this.top.push(A.top);
    return this.c++;
  }
  // vertical quad a->b, y0..y1, outward normal (nx,nz); u along edge from u0; h measured from BASE
  wall(ax, az, bx, bz, y0, y1, nx, nz, u0, A) {
    const L = Math.hypot(bx - ax, bz - az);
    const a0 = this.v(ax, y0, az, nx, 0, nz, u0, y0 - BASE, A), b0 = this.v(bx, y0, bz, nx, 0, nz, u0 + L, y0 - BASE, A);
    const b1 = this.v(bx, y1, bz, nx, 0, nz, u0 + L, y1 - BASE, A), a1 = this.v(ax, y1, az, nx, 0, nz, u0, y1 - BASE, A);
    // triangle (a0, b0, b1) faces (-(bz-az), 0, bx-ax); keep it if that agrees with n
    const fd = -(bz - az) * nx + (bx - ax) * nz;
    if (fd > 0) this.i.push(a0, b0, b1, a0, b1, a1); else this.i.push(a0, b1, b0, a0, a1, b1);
  }
  // horizontal quad (for chajja tops/bottoms, parapet caps); pts in order, normal up/down
  flat(P, ny, A) {
    const vs = P.map(q => this.v(q[0], q[1], q[2], 0, ny, 0, q[0] + q[2], q[1] - BASE, A));
    const ux = P[1][0] - P[0][0], uz = P[1][2] - P[0][2], wx = P[3][0] - P[0][0], wz = P[3][2] - P[0][2];
    const cy = uz * wx - ux * wz;           // y of (p1-p0) x (p3-p0)
    if ((cy >= 0) === (ny > 0)) this.i.push(vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]); else this.i.push(vs[0], vs[2], vs[1], vs[0], vs[3], vs[2]);
  }
  get empty() { return this.c === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(this.n.map(v => Math.round(v * 127))), 3, true));
    g.setAttribute('fuv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('fedge', new THREE.Float32BufferAttribute(this.e, 2));
    g.setAttribute('ftint', new THREE.BufferAttribute(new Uint8Array(this.t.map(v => Math.min(255, Math.round(v * 255)))), 3, true));
    g.setAttribute('fstyle', new THREE.BufferAttribute(new Uint8Array(this.s), 4, false));
    g.setAttribute('ftan', new THREE.BufferAttribute(new Int8Array(this.tn.map(v => Math.round(v * 127))), 2, true));
    g.setAttribute('ftop', new THREE.Float32BufferAttribute(this.top, 1));
    g.setIndex(new THREE.BufferAttribute(this.c > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
export class RoofB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.l = []; this.t = []; this.i = []; this.c = 0; }
  v(x, y, z, nx, ny, nz, u, w, layer, tint) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.l.push(layer); this.t.push(...tint); return this.c++; }
  poly(rings, y, layer, tint, down = false) {
    const { coords, tris } = triangulate(rings);
    const b = this.c;
    for (let k = 0; k < coords.length; k += 2) this.v(coords[k], y, coords[k + 1], 0, down ? -1 : 1, 0, coords[k], coords[k + 1], layer, tint);
    if (down) for (let k = 0; k < tris.length; k += 3) this.i.push(b + tris[k], b + tris[k + 2], b + tris[k + 1]);
    else for (let k = 0; k < tris.length; k++) this.i.push(b + tris[k]);
  }
  tri(a, b, c, layer, tint) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    let flip = ny < 0;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    // uv: along eave (a->b) and up the slope
    const eL = Math.hypot(ux, uz) || 1, ex = ux / eL, ez = uz / eL;
    const uvOf = (q) => [(q[0] - a[0]) * ex + (q[2] - a[2]) * ez, Math.hypot(q[0] - a[0] - ((q[0] - a[0]) * ex + (q[2] - a[2]) * ez) * ex, q[2] - a[2] - ((q[0] - a[0]) * ex + (q[2] - a[2]) * ez) * ez, q[1] - a[1])];
    const ia = this.v(a[0], a[1], a[2], nx, ny, nz, ...uvOf(a), layer, tint);
    const ib = this.v(b[0], b[1], b[2], nx, ny, nz, ...uvOf(b), layer, tint);
    const ic = this.v(c[0], c[1], c[2], nx, ny, nz, ...uvOf(c), layer, tint);
    if (flip) this.i.push(ia, ic, ib); else this.i.push(ia, ib, ic);
  }
  get empty() { return this.c === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('ruv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('rlayer', new THREE.BufferAttribute(new Uint8Array(this.l), 1));
    g.setAttribute('rtint', new THREE.BufferAttribute(new Uint8Array(this.t.map(v => Math.min(255, Math.round(v * 255)))), 3, true));
    g.setIndex(new THREE.BufferAttribute(this.c > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------- geometry helpers
export function signedArea(p) {
  let a = 0;
  for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
  return a / 2;
}
function isConvex(p) {
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
const GEO = {};
function proto() {
  if (GEO.tank) return GEO;
  GEO.tank = new THREE.CylinderGeometry(0.62, 0.62, 1.3, 12, 1);
  GEO.tankLid = new THREE.CylinderGeometry(0.3, 0.3, 0.12, 8, 1);
  GEO.box = new THREE.BoxGeometry(1, 1, 1);
  GEO.dish = new THREE.CylinderGeometry(0.42, 0.06, 0.18, 12, 1, true);
  GEO.post = new THREE.CylinderGeometry(0.04, 0.04, 1, 5);
  GEO.solarTank = new THREE.CylinderGeometry(0.22, 0.22, 1.7, 10);
  GEO.kandil = new THREE.OctahedronGeometry(0.28, 0);
  GEO.kandilTail = new THREE.ConeGeometry(0.12, 0.45, 4);
  GEO.bastion = new THREE.CylinderGeometry(1, 1.12, 1, 14, 1, true);
  GEO.ring = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
  GEO.cone8 = new THREE.ConeGeometry(1, 1, 8, 1);
  GEO.flagTri = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0.9, -0.25, 0], 3)); g.computeVertexNormals(); return g; })();
  GEO.sph = new THREE.SphereGeometry(1, 10, 6);
  return GEO;
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), EUL = new THREE.Euler();
function mat(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { EUL.set(rx, ry, rz); Q.setFromEuler(EUL); return M4.compose(V.set(x, y, z), Q, S3.set(sx, sy, sz)); }

// ---------------------------------------------------------------- per-building heights (for hoardings, rooftop props, physics)
export function buildingHeight(B) {
  const [, , levels, styleId, roof] = B;
  const S = STYLE_PARAMS[styleId] || STYLE_PARAMS[0];
  const shopsCapable = styleId === 0 || styleId === 1 || styleId === 2 || styleId === 9;
  const gh = (levels > 1 || shopsCapable) ? S[1] : S[0];
  return { gh, fh: S[0], H: gh + (levels - 1) * S[0] };
}

// ---------------------------------------------------------------- chunk builder
export function buildBuildingsChunk(W, C, group) {
  const { M, mats, index } = W;
  proto();
  const fb = new FacadeB(), rb = new RoofB(), cb = new ColorBuilder(), sb = new QuadBuilder(), ob = new QuadBuilder();
  const signs = W.boards;
  const local = signs.chunkAtlas(C, (bi) => index.shopsByBld.get(bi));
  const footprints = [];
  C.doors = [];                    // shop fronts people can walk into
  for (const bi of C.bld) {
    const B = M.buildings[bi];
    const [, ringCm, levels, styleId, roof, flags, , hoard, peth, district] = B;
    const p = cmRing(ringCm);
    const n = p.length / 2;
    if (n < 3) continue;
    const rng = new RNG(ringCm[0] * 31 + ringCm[1] * 17 + bi);
    const seed = Math.floor(hash1(bi * 7919) * 255);
    const area = signedArea(p);
    const sgn = area > 0 ? 1 : -1;
    const normals = new Float64Array(p.length);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = p[2 * j] - p[2 * i], dz = p[2 * j + 1] - p[2 * i + 1], L = Math.hypot(dx, dz) || 1;
      normals[2 * i] = sgn * dz / L; normals[2 * i + 1] = -sgn * dx / L;
    }
    if (styleId === 7) { canopy(fb, rb, cb, p, normals, seed); continue; }
    const look = styleLook(styleId, district, rng);
    const tint = look.pal[rng.int(0, look.pal.length - 1)].map(v => lin(Math.min(1, v * rng.range(0.94, 1.03))));
    const S = STYLE_PARAMS[styleId] || STYLE_PARAMS[0];
    const { gh, fh, H } = buildingHeight(B);
    const pitched = (roof === 1 || styleId === 10 || styleId === 12) && n <= 10 && isConvex(p) && Math.abs(area) < 1600;
    const fort = styleId === 11;
    const parapet = fort ? 1.4 : pitched ? 0 : styleId === 6 ? 0.15 : 0.95;
    const top = BASE + H;
    const wallTop = top + parapet;
    footprints.push({ bi, p, h: wallTop });
    const shopsCapable = styleId === 0 || styleId === 1 || styleId === 2 || styleId === 9;
    let u = 0;
    const osm = index.shopsByBld.get(bi);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = p[2 * i], az = p[2 * i + 1], bx = p[2 * j], bz = p[2 * j + 1];
      const nx = normals[2 * i], nz = normals[2 * i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const tx = (bx - ax) / L, tz = (bz - az) / L;
      const fl = flags[i] || '0';
      let ef = 0;
      const shop = shopsCapable && L > 2.6 && (fl === '2' || (fl === '1' && (styleId === 1 || ((peth || district === 2 || district === 4) && rng.chance(0.5)))));
      if (shop) ef |= 1;
      if (fl === '0' && (L < 3 || rng.chance(0.45))) ef |= 2;
      if (fort) ef |= 2;
      const A = { eu: u, eL: L, tint, style: styleId, layer: look.layer, flags: ef, seed, tx, tz, top: wallTop - BASE };
      fb.wall(ax, az, bx, bz, BASE, wallTop, nx, nz, u, A);
      // chajja bands over each floor's windows
      if (look.chajja && !(ef & 2) && levels > 1 && L > 2.2) {
        const At = { ...A, layer: WL.concrete, flags: 4, tint: tint.map(v => v * 0.92) };
        const d = 0.42, th = 0.08;
        for (let f = 0; f < levels - 1; f++) {
          const y = BASE + gh + f * fh + S[5] + S[3] + 0.08;
          if (y > top - 0.3) break;
          const a0 = [ax + tx * 0.08, az + tz * 0.08], b0 = [bx - tx * 0.08, bz - tz * 0.08];
          const a1 = [a0[0] + nx * d, a0[1] + nz * d], b1 = [b0[0] + nx * d, b0[1] + nz * d];
          fb.flat([[a0[0], y, a0[1]], [b0[0], y, b0[1]], [b1[0], y, b1[1]], [a1[0], y, a1[1]]], 1, At);
          fb.flat([[a0[0], y - th, a0[1]], [b0[0], y - th, b0[1]], [b1[0], y - th, b1[1]], [a1[0], y - th, a1[1]]], -1, At);
          fb.wall(a1[0], a1[1], b1[0], b1[1], y - th, y, nx, nz, 0, At);
        }
      }
      // ground-floor shop boards
      if (shop) {
        const ns = Math.max(1, Math.floor(L / SHOP_CELL));
        const cw = L / ns;
        for (let k = 0; k < ns; k++) {
          let board = null;
          if (osm) { const s = osm.find(s => s[1] === i && Math.floor(s[2] * ns) === k); if (s) board = local.get(s); }
          if (!board) board = signs.generic(district, rng);
          const t0 = (k * cw + 0.15), t1 = ((k + 1) * cw - 0.15);
          const w = t1 - t0, h = Math.min(0.85, w / 4.1);
          const y1 = BASE + gh - 0.1, y0 = y1 - h;
          const o = 0.1;
          const x0 = ax + tx * t0 + nx * o, z0 = az + tz * t0 + nz * o, x1 = ax + tx * t1 + nx * o, z1 = az + tz * t1 + nz * o;
          C.doors.push({ x: (x0 + x1) / 2 + nx * 0.25, z: (z0 + z1) / 2 + nz * 0.25, nx, nz, n: 0 });
          const ltr = (tx * nz - tz * nx) > 0;
          (board.local ? ob : sb).quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [nx, 0, nz], ltr ? board.u0 : board.u1, board.v0, ltr ? board.u1 : board.u0, board.v1);
          // board frame edges
          const fc = [0.12, 0.12, 0.13];
          cb.addGeo(GEO.box, mat((x0 + x1) / 2 - nx * 0.05, y1 + 0.02, (z0 + z1) / 2 - nz * 0.05, w + 0.06, 0.04, 0.12, Math.atan2(-tz, tx)), fc);
          cb.addGeo(GEO.box, mat((x0 + x1) / 2 - nx * 0.05, y0 - 0.02, (z0 + z1) / 2 - nz * 0.05, w + 0.06, 0.04, 0.12, Math.atan2(-tz, tx)), fc);
          // awnings over peth / camp shops
          if ((peth || district === 2) && rng.chance(0.3)) awning(cb, rng, ax + tx * t0, az + tz * t0, ax + tx * t1, az + tz * t1, nx, nz, y0 - 0.05);
        }
      }
      // Diwali lanterns on balconies
      if ((styleId === 0 || styleId === 2) && levels > 1 && !(ef & 2) && rng.chance(0.18)) {
        const bays = Math.max(1, Math.floor(L / S[4]));
        for (let f = 0; f < levels - 1; f++) for (let k = 0; k < bays; k++) {
          if (!rng.chance(0.08)) continue;
          const t = (k + 0.5) / bays;
          kandil(cb, rng, ax + (bx - ax) * t + nx * 0.36, BASE + gh + f * fh + S[5] + S[3] - 0.15, az + (bz - az) * t + nz * 0.36);
        }
      }
      u += L;
    }
    // ---- roofs
    if (fort) { fortTop(fb, cb, p, normals, wallTop, tint, seed, look.layer); continue; }
    if (pitched) {
      pitchedRoof(rb, p, normals, top, Math.abs(area), styleId);
    } else {
      rb.poly([p], top, styleId === 9 || styleId === 1 ? WL.slab : (rng.chance(0.4) ? WL.bitumen : WL.slab), [0.85, 0.85, 0.85]);
      if (parapet > 0.2) {
        const inner = offsetRing(p, normals, -0.22);
        const Ap = { eu: 0, eL: 1, tint, style: styleId, layer: look.layer, flags: 4 | 2, seed, tx: 1, tz: 0, top: wallTop - BASE };
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ax = inner[2 * i], az = inner[2 * i + 1], bx = inner[2 * j], bz = inner[2 * j + 1];
          fb.wall(ax, az, bx, bz, top, wallTop, -normals[2 * i], -normals[2 * i + 1], 0, Ap);
          fb.flat([[p[2 * i], wallTop, p[2 * i + 1]], [p[2 * j], wallTop, p[2 * j + 1]], [bx, wallTop, bz], [ax, wallTop, az]], 1, Ap);
        }
      }
      if (styleId === 8) shikhara(cb, p, top, rng);
      else if (styleId === 13) pyramid(rb, p, top, Math.abs(area));
      else if (styleId !== 6) rooftop(cb, rng, p, normals, top, levels, Math.abs(area));
    }
  }
  // rooftop hoardings facing chowks
  for (const h of C.hoardings) {
    const x = h[2] / 100, z = h[3] / 100, ang = h[4];
    const f = footprints.find(f => insideRing(x, z, f.p));
    if (f && f.h > 6) hoarding(cb, sb, signs, x, f.h, z, ang, h[0]);
  }
  W.footprintsByChunk.set(C.ci, footprints);
  // emit
  if (!fb.empty) { const m = new THREE.Mesh(fb.build(), mats.facade); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (!rb.empty) { const m = new THREE.Mesh(rb.build(), mats.roof); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (!cb.empty) { const m = new THREE.Mesh(cb.build(), mats.prop); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (!sb.empty) { const m = new THREE.Mesh(sb.build(), mats.sign); m.receiveShadow = true; group.add(m); }
  let localMat = null;
  if (!ob.empty && local.tex) {
    localMat = mats.sign.clone();
    localMat.map = local.tex; localMat.emissiveMap = local.tex;
    const m = new THREE.Mesh(ob.build(), localMat); m.receiveShadow = true; group.add(m);
  }
  return () => { W.footprintsByChunk.delete(C.ci); if (local.tex) local.tex.dispose(); if (localMat) localMat.dispose(); };
}

function insideRing(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi)) inside = !inside;
  }
  return inside;
}

function awning(cb, rng, ax, az, bx, bz, nx, nz, y) {
  const c = rng.pick([[0.15, 0.35, 0.7], [0.75, 0.2, 0.15], [0.9, 0.6, 0.1], [0.2, 0.55, 0.3], [0.6, 0.6, 0.62], [0.95, 0.95, 0.92]]);
  const o = 1.1;
  const p0 = [ax, y, az], p1 = [bx, y, bz], p2 = [bx + nx * o, y - 0.45, bz + nz * o], p3 = [ax + nx * o, y - 0.45, az + nz * o];
  const len = Math.hypot(o, 0.45), ny = o / len, nh = 0.45 / len;
  const nn = [nx * nh, ny, nz * nh];
  const v = [p0, p1, p2, p3].map(P => cb.v(P[0], P[1], P[2], nn[0], nn[1], nn[2], c[0], c[1], c[2]));
  const ux = p1[0] - p0[0], uz = p1[2] - p0[2], wx = p3[0] - p0[0], wz = p3[2] - p0[2];
  const cy = uz * wx - ux * wz;
  if (cy >= 0) cb.i.push(v[0], v[1], v[2], v[0], v[2], v[3]); else cb.i.push(v[0], v[2], v[1], v[0], v[3], v[2]);
  const vb = [p0, p1, p2, p3].map(P => cb.v(P[0], P[1] - 0.01, P[2], -nn[0], -nn[1], -nn[2], c[0] * 0.6, c[1] * 0.6, c[2] * 0.6));
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
  if (area < 40) return;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  const inner = offsetRing(p, normals, -1.4);
  const pick = () => {
    const i = rng.int(0, n - 1), t = rng.next(), j = (i + 1) % n;
    const ex = inner[2 * i] + (inner[2 * j] - inner[2 * i]) * t, ez = inner[2 * i + 1] + (inner[2 * j + 1] - inner[2 * i + 1]) * t;
    const k = rng.range(0, 0.5);
    return [ex + (cx - ex) * k, ez + (cz - ez) * k];
  };
  if (levels >= 3 && area > 90) {
    const x = cx + rng.range(-2, 2), z = cz + rng.range(-2, 2);
    const rot = Math.atan2(normals[1], normals[0]);
    cb.addGeo(GEO.box, mat(x, top + 1.3, z, 2.6, 2.6, 3.0, rot), [0.82, 0.8, 0.76]);
    cb.addGeo(GEO.box, mat(x, top + 2.66, z, 2.9, 0.12, 3.3, rot), [0.7, 0.7, 0.68]);
  }
  const tanks = area > 300 ? rng.int(2, 5) : rng.int(1, 2);
  for (let k = 0; k < tanks; k++) {
    const [x, z] = pick();
    const s = rng.range(0.8, 1.15), lift = rng.chance(0.4) ? 0.6 : 0;
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
    const [x, z] = pick(); const r = rng.range(0, 6.28);
    cb.addGeo(GEO.box, mat(x, top + 0.75, z, 2.0, 0.08, 1.6, r, 0.45), [0.08, 0.12, 0.22]);
    cb.addGeo(GEO.solarTank, mat(x, top + 1.3, z, 1, 1, 1, r, 0, Math.PI / 2), [0.8, 0.8, 0.82]);
  }
  if (levels >= 6 && rng.chance(0.08)) {           // mobile tower
    const [x, z] = pick();
    for (let k = 0; k < 4; k++) cb.addGeo(GEO.post, mat(x + (k & 1 ? 0.5 : -0.5), top + 4, z + (k & 2 ? 0.5 : -0.5), 1.4, 8, 1.4), [0.55, 0.56, 0.58]);
    for (let k = 0; k < 3; k++) cb.addGeo(GEO.box, mat(x + Math.cos(k * 2.1) * 0.7, top + 7.2, z + Math.sin(k * 2.1) * 0.7, 0.3, 1.4, 0.12, k * 2.1), [0.88, 0.88, 0.88]);
  }
}
function pitchedRoof(rb, p, normals, top, area, styleId) {
  const n = p.length / 2;
  const eave = offsetRing(p, normals, 0.45);
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  const steep = styleId === 10 ? 0.75 : 0.3;
  const rise = Math.min(styleId === 10 ? 9 : 3.4, Math.max(1.1, Math.sqrt(area) * steep));
  const apex = [cx, top + rise, cz];
  const y = top - 0.12;
  const layer = WL.clayTiles;
  const tint = styleId === 12 || styleId === 10 ? [0.75, 0.7, 0.66] : [1, 1, 1];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    rb.tri([eave[2 * i], y, eave[2 * i + 1]], [eave[2 * j], y, eave[2 * j + 1]], apex, layer, tint);
  }
  rb.poly([eave], y - 0.02, WL.slab, [0.6, 0.6, 0.6], true);
}
function pyramid(rb, p, top, area) {
  const n = p.length / 2;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  const apex = [cx, top + Math.sqrt(area) * 0.55, cz];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; rb.tri([p[2 * i], top, p[2 * i + 1]], [p[2 * j], top, p[2 * j + 1]], apex, WL.slab, [0.06, 0.06, 0.07]); }
}
function shikhara(cb, p, top, rng) {
  const n = p.length / 2;
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  let minR = 1e9;
  for (let i = 0; i < n; i++) minR = Math.min(minR, Math.hypot(p[2 * i] - cx, p[2 * i + 1] - cz));
  const R = Math.max(1.0, Math.min(3.2, minR * 0.8));
  const col = rng.chance(0.6) ? [1.0, 0.62, 0.25] : [0.97, 0.95, 0.9];
  // stacked tapering tiers (a simplified Nagara shikhara) + amalaka + kalash + saffron flag
  const tiers = 6;
  let y = top;
  for (let k = 0; k < tiers; k++) {
    const r = R * (1 - k / (tiers + 1.5)), h = R * 0.55;
    cb.addGeo(GEO.cone8, mat(cx, y + h * 0.5, cz, r, h * 1.6, r, k * 0.3), col.map(v => v * (0.9 + 0.1 * (k % 2))));
    y += h * 0.82;
  }
  cb.addGeo(GEO.ring, mat(cx, y + 0.15, cz, R * 0.3, 0.25, R * 0.3), col);
  cb.addGeo(GEO.sph, mat(cx, y + 0.5, cz, 0.22, 0.3, 0.22), [0.95, 0.75, 0.2]);
  cb.addGeo(GEO.post, mat(cx, y + 1.4, cz, 1, 1.8, 1), [0.3, 0.25, 0.2]);
  cb.addGeo(GEO.flagTri, mat(cx + 0.03, y + 2.25, cz, 1.2, 1.2, 1.2, rng.range(0, 6)), [1.0, 0.45, 0.05]);
}
// Shaniwar Wada style ramparts: thick walls with merlons and round bastions at the corners
function fortTop(fb, cb, p, normals, wallTop, tint, seed, layer) {
  const n = p.length / 2;
  const inner = offsetRing(p, normals, -2.2);
  const A = { eu: 0, eL: 1, tint, style: 11, layer, flags: 2, seed, tx: 1, tz: 0, top: wallTop - BASE };
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = inner[2 * i], az = inner[2 * i + 1], bx = inner[2 * j], bz = inner[2 * j + 1];
    const L = Math.hypot(bx - ax, bz - az);
    fb.wall(ax, az, bx, bz, BASE, wallTop - 1.4, -normals[2 * i], -normals[2 * i + 1], u, A);
    fb.flat([[p[2 * i], wallTop - 1.4, p[2 * i + 1]], [p[2 * j], wallTop - 1.4, p[2 * j + 1]], [bx, wallTop - 1.4, bz], [ax, wallTop - 1.4, az]], 1, A);
    u += L;
    // merlons along the outer edge
    const oL = Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]);
    const tx = (p[2 * j] - p[2 * i]) / (oL || 1), tz = (p[2 * j + 1] - p[2 * i + 1]) / (oL || 1);
    const rot = Math.atan2(-tz, tx);
    for (let d = 0.8; d < oL - 0.4; d += 1.6) {
      const x = p[2 * i] + tx * d - normals[2 * i] * 0.3, z = p[2 * i + 1] + tz * d - normals[2 * i + 1] * 0.3;
      cb.addGeo(GEO.box, mat(x, wallTop - 0.7, z, 0.8, 1.4, 0.6, rot), [0.58, 0.5, 0.42]);
    }
  }
  // bastions where the outline turns sharply
  for (let i = 0; i < n; i++) {
    const pi = (i - 1 + n) % n;
    const turn = normals[2 * pi] * normals[2 * i] + normals[2 * pi + 1] * normals[2 * i + 1];
    if (turn > 0.7) continue;
    const x = p[2 * i], z = p[2 * i + 1];
    cb.addGeo(GEO.bastion, mat(x, wallTop / 2 + 0.6, z, 4.2, wallTop + 1.2, 4.2), [0.55, 0.48, 0.4]);
    cb.addGeo(GEO.ring, mat(x, wallTop + 1.25, z, 4.25, 0.1, 4.25), [0.5, 0.44, 0.37]);
  }
}
function canopy(fb, rb, cb, p, normals, seed) {
  const n = p.length / 2;
  const y0 = 5.2, y1 = 5.9;
  const tint = [lin(0.12), lin(0.55), lin(0.32)];
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const L = Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]);
    const A = { eu: u, eL: L, tint, style: 7, layer: WL.cladding, flags: 2, seed, tx: (p[2 * j] - p[2 * i]) / (L || 1), tz: (p[2 * j + 1] - p[2 * i + 1]) / (L || 1), top: y1 - BASE };
    fb.wall(p[2 * i], p[2 * i + 1], p[2 * j], p[2 * j + 1], y0, y1, normals[2 * i], normals[2 * i + 1], u, A);
    u += L;
  }
  rb.poly([p], y1, WL.slab, [0.9, 0.9, 0.9]);
  rb.poly([p], y0, WL.slab, [0.95, 0.95, 0.95], true);
  const inner = offsetRing(p, normals, -1.5);
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; }
  cx /= n; cz /= n;
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 4))) cb.addGeo(GEO.box, mat(inner[2 * i], y0 / 2, inner[2 * i + 1], 0.5, y0, 0.5), [0.85, 0.85, 0.85]);
  for (let k = -1; k <= 1; k += 2) {
    cb.addGeo(GEO.box, mat(cx + k * 2.5, 0.85, cz, 0.8, 1.5, 0.5), [0.9, 0.9, 0.9]);
    cb.addGeo(GEO.box, mat(cx + k * 2.5, 1.2, cz + 0.26, 0.6, 0.5, 0.02), [0.1, 0.5, 0.3], 0.4);
  }
}
function hoarding(cb, sb, signs, x, y, z, ang, k) {
  const s = signs.ad(k);
  const nx = Math.cos(ang), nz = Math.sin(ang), tx = -nz, tz = nx;
  const Wd = 9, Hh = 4.5, lift = 2.0, y0 = y + lift, y1 = y0 + Hh;
  for (const o of [-Wd / 2 + 0.6, 0, Wd / 2 - 0.6]) {
    cb.addGeo(GEO.box, mat(x + tx * o - nx * 0.4, y + (lift + Hh) / 2, z + tz * o - nz * 0.4, 0.18, lift + Hh, 0.18, -ang), [0.25, 0.25, 0.27]);
    cb.addGeo(GEO.box, mat(x + tx * o - nx * 1.4, y + lift * 0.6, z + tz * o - nz * 1.4, 0.12, lift * 1.2, 0.12, -ang), [0.25, 0.25, 0.27]);
  }
  cb.addGeo(GEO.box, mat(x - nx * 0.12, (y0 + y1) / 2, z - nz * 0.12, Wd + 0.3, Hh + 0.3, 0.15, Math.atan2(-tz, tx)), [0.2, 0.2, 0.22]);
  sb.quad([x - tx * Wd / 2, y0, z - tz * Wd / 2], [x + tx * Wd / 2, y0, z + tz * Wd / 2], [x + tx * Wd / 2, y1, z + tz * Wd / 2], [x - tx * Wd / 2, y1, z - tz * Wd / 2],
    [nx, 0, nz], s.u1, s.v0, s.u0, s.v1);
  for (const o of [-Wd / 3, 0, Wd / 3]) cb.addGeo(GEO.box, mat(x + tx * o + nx * 0.5, y1 + 0.25, z + tz * o + nz * 0.5, 0.3, 0.15, 0.3), [1, 0.95, 0.8], 1.0);
}
