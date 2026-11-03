// /experiment: one long old Peth lane, made from nothing. Limewashed plaster, exposed brick and a few old wadas
// with Mangalore tiles; shops with their shutters up or down, boards and tarp awnings; chajjas that throw long
// shadows; iron balconies; arched windows of teal glass; trees with their trunks painted; poles and wires;
// two-wheelers parked anyhow. Everything is cut into 80 m pieces along the street so what's behind you isn't drawn.
import * as THREE from 'three';
import { Builder, K, hex, rng } from './geo.js';
import { SIGNS, signUV } from './signs.js';

export const ROAD = 4.5, FRONT = 6.8, Z0 = -620, Z1 = 620, CH = 80;

// limewash from the sketches: olive mustard, peth blue, teal, rust, sand, sage, whitewash, lilac grey, ochre...
const WALLS = [0xb8a24a, 0x4f7ea8, 0x3f8a8c, 0xa05a48, 0xe0c890, 0x7fa070, 0xd8d0c0, 0x8a8fb0, 0xc8a070, 0x6a9ac0, 0xe8e0c8, 0x9ab08a, 0xd6b45a, 0x5a8a9a];
const BRICK = [0xa8553e, 0x9a4a36, 0xb0603e];
const POP = [0x2f5fd0, 0xf08a24, 0x2f8a5a, 0xd83a2a, 0xf2c230, 0x2a8a8a];
const GOODS = [0xf2c230, 0xd83a2a, 0x2f5fd0, 0xeee8dc, 0x2f8a5a, 0xf08a24, 0xc8a070, 0x8a6a48, 0xd8607e];

export function buildStreet(matWorld, matSign) {
  const R = rng(1948);
  const pick = (a) => a[(R() * a.length) | 0];
  const nCh = Math.ceil((Z1 - Z0) / CH);
  const chunks = Array.from({ length: nCh }, () => new Builder());
  const signs = new Builder({}, true);
  const at = (z) => chunks[Math.max(0, Math.min(nCh - 1, Math.floor((z - Z0) / CH)))];

  // ---------------------------------------------------------------- the ground
  for (let c = 0; c < nCh; c++) {
    const b = chunks[c], z0 = Z0 + c * CH, z1 = z0 + CH;
    b.kind(K.road).col(0x5a5e66); b.quad([-ROAD, 0, z1], [ROAD, 0, z1], [ROAD, 0, z0], [-ROAD, 0, z0], [0, 1, 0]);
    for (const s of [-1, 1]) {
      b.kind(K.kerb).col(0xbab6ae); b.box(s * ROAD, 0, z0, s * (ROAD + .18), .16, z1, 'ny pz nz');
      b.kind(K.paver).col(0x9a958a); b.box(s * (ROAD + .18), 0, z0, s * (FRONT + 1.2), .15, z1, 'ny pz nz');
    }
  }
  // closed ends, far in the haze
  for (const z of [Z0 - 6, Z1 + 6]) { const b = at(z); b.kind(K.plaster).col(0xc8b48a); b.box(-30, 0, z - 4, 30, 16, z + 4, 'ny'); }

  // ---------------------------------------------------------------- the buildings
  let stats = { buildings: 0, shops: 0 };
  for (const s of [-1, 1]) {
    let u = Z0;
    while (u < Z1) {
      if (R() < .12) { const g = 1.2 + R() * 2; gully(at(u), s, u, u + g); u += g; continue; }
      const w = 4.5 + R() * 7.5, u1 = Math.min(Z1, u + w);
      building(at((u + u1) / 2), s, u, u1); stats.buildings++;
      u = u1;
    }
  }
  function gully(b, s, u0, u1) {
    b.kind(K.road).col(0x4a4c52); const X = (d) => s * (FRONT + d);
    b.quad([X(1.2), .15, u0], [X(1.2), .15, u1], [X(12), .15, u1], [X(12), .15, u0], [0, 1, 0]);
  }
  function fq(b, s, u0, u1, v0, v1, d) {
    const x = s * (FRONT + d);
    if (s > 0) b.quad([x, v0, u0], [x, v0, u1], [x, v1, u1], [x, v1, u0], [-s, 0, 0]);
    else b.quad([x, v0, u1], [x, v0, u0], [x, v1, u0], [x, v1, u1], [-s, 0, 0]);
  }
  // an arched pane: a rectangle with a half circle on top
  function farch(b, s, uc, hw, v0, v1, d) {
    const x = s * (FRONT + d), n = [-s, 0, 0];
    b.quad([x, v0, uc - hw], [x, v0, uc + hw], [x, v1, uc + hw], [x, v1, uc - hw], n);
    const seg = 9;
    for (let i = 0; i < seg; i++) {
      const a0 = Math.PI * i / seg, a1 = Math.PI * (i + 1) / seg;
      b.tri([x, v1, uc], [x, v1 + Math.sin(a0) * hw, uc + Math.cos(a0) * hw], [x, v1 + Math.sin(a1) * hw, uc + Math.cos(a1) * hw], n);
    }
  }
  function building(b, s, u0, u1) {
    const w = u1 - u0, r = R();
    const style = r < .16 ? 'wada' : r < .34 ? 'brick' : 'plaster';
    const floors = style === 'wada' ? 2 : 1 + Math.floor(Math.pow(R(), .8) * 4), FH = 3.1, H = floors * FH;
    const fo = (R() - .4) * .35, D = 9 + R() * 4;
    const X = (d) => s * (FRONT + fo + d);
    const fb = (uu0, uu1, v0, v1, d0, d1, skip = '') => b.box(X(d0), v0, uu0, X(d1), v1, uu1, skip);
    const wall = style === 'brick' ? pick(BRICK) : pick(WALLS), wk = style === 'brick' ? K.brick : K.plaster;
    const trim = style === 'brick' ? 0xe8e0d0 : pick([0xe8e0d0, 0xf2ece0, wall, 0x4a3a2e]);
    const shop = style !== 'wada' && R() < .78, arched = style === 'brick' ? R() < .7 : R() < .25;
    // body
    b.kind(wk).col(wall);
    if (shop) {
      if (H > FH) fb(u0, u1, FH, H, 0, D, 'ny');
      fb(u0, u0 + .35, 0, FH, 0, D, 'ny'); fb(u1 - .35, u1, 0, FH, 0, D, 'ny');
      fb(u0, u1, 2.7, FH, 0, 2.4);
      fb(u0 + .35, u1 - .35, 0, FH, 2.4, D, 'ny');
      shopFront(b, s, u0 + .35, u1 - .35, X, fb, w);
      stats.shops++;
    } else {
      fb(u0, u1, 0, H, 0, D, 'ny');
    }
    if (style === 'wada') { b.kind(K.stone).col(0x6a625a); fb(u0, u1, 0, .95, -.06, .5, 'ny'); }
    // windows, floor by floor
    const nw = Math.max(1, Math.floor((w - .5) / 2.2));
    for (let f = shop ? 1 : 0; f < floors; f++) {
      const base = f * FH;
      const balcony = f > 0 && style !== 'wada' && R() < .32;
      for (let i = 0; i < nw; i++) {
        const uc = u0 + (i + .5) * w / nw;
        if (f === 0 && i === Math.floor(nw / 2)) {                            // a door on the ground floor
          b.kind(K.wood).col(pick([0x4a3322, 0x2f5a4a, 0x35546f, 0x6a3a26])); fb(uc - .5, uc + .5, .15, 2.35, -.05, 0);
          b.kind(K.plain).col(trim); fb(uc - .6, uc + .6, 2.35, 2.5, -.08, 0);
          continue;
        }
        const v0 = base + .9, hw = .48, ph = arched ? .95 : 1.4;
        b.kind(K.glass).col(pick([0x2e5a5c, 0x2a4e58, 0x35625e]));
        if (arched) farch(b, s, uc, hw, v0, v0 + ph, -.02); else fq(b, s, uc - hw, uc + hw, v0, v0 + ph, -.02);
        b.kind(K.plain).col(trim);
        const top = v0 + ph + (arched ? hw : 0);
        fb(uc - hw - .07, uc - hw, v0, v0 + ph, -.06, 0); fb(uc + hw, uc + hw + .07, v0, v0 + ph, -.06, 0);
        if (!arched) fb(uc - hw - .07, uc + hw + .07, top, top + .07, -.06, 0);
        fb(uc - hw - .12, uc + hw + .12, v0 - .1, v0, -.1, 0);                    // the sill
        if (!arched && R() < .3) { b.kind(K.wood).col(pick([0x2f5a4a, 0x35546f, 0x6a3a26])); fb(uc - hw - .35, uc - hw - .08, v0, v0 + ph, -.05, 0); fb(uc + hw + .08, uc + hw + .35, v0, v0 + ph, -.05, 0); }
      }
      // a chajja over the floor, the long shadow line of the sketches
      if (style !== 'wada' && (f > 0 || !shop) && R() < .6) { b.kind(wk === K.brick ? K.plaster : wk).col(wk === K.brick ? 0xb8b0a0 : wall); fb(u0, u1, base + 2.42, base + 2.52, -.62, 0); }
      if (balcony) {
        const a0 = u0 + .4, a1 = u1 - .4;
        b.kind(K.plaster).col(trim === 0x4a3a2e ? wall : trim); fb(a0, a1, base - .02, base + .12, -1.05, 0);
        b.kind(K.plain).col(0x23211f); fb(a0, a1, base + .98, base + 1.04, -1.04, -.98);
        for (let uu = a0; uu < a1 - .05; uu += .17) fb(uu, uu + .025, base + .12, base + .98, -1.02, -.995);
        if (R() < .4) { b.kind(K.cloth).col(pick(POP)); fb(a0 + .3, a0 + .3 + R() * (a1 - a0 - .6), base + .5, base + .98, -1.0, -.97); }   // a sari drying
      }
      if (style === 'wada' && f === 1) {                                       // the wooden gallery
        b.kind(K.wood).col(0x5a3a24); fb(u0 + .2, u1 - .2, base - .05, base + .1, -.9, 0);
        fb(u0 + .2, u1 - .2, base + .9, base + 1.0, -.9, -.82);
        for (let uu = u0 + .25; uu < u1 - .3; uu += 1.3) fb(uu, uu + .14, base + .1, H, -.9, -.76);
        for (let uu = u0 + .3; uu < u1 - .3; uu += .32) fb(uu, uu + .06, base + .1, base + .9, -.88, -.84);
      }
    }
    // the roof
    if (style === 'wada') {
      b.kind(K.tiles).col(pick([0xb8573e, 0xa84c36, 0xc06040]));
      const xe = X(-.8), xr = X(D / 2), hr = H + 2.5;
      b.quad([xe, H, u0 - .3], [xe, H, u1 + .3], [xr, hr, u1 + .3], [xr, hr, u0 - .3], [-s * .6, .8, 0]);
      b.quad([xe, H, u0 - .3], [xe, H, u1 + .3], [xr, hr, u1 + .3], [xr, hr, u0 - .3], [s * .6, -.8, 0]);
      b.kind(K.plaster).col(wall);
      for (const uu of [u0, u1]) b.tri([X(0), H, uu], [xr, hr, uu], [X(D), H, uu], [0, 0, uu === u0 ? -1 : 1]);
    } else {
      b.kind(wk).col(wall); fb(u0, u1, H, H + .8, 0, .22, 'ny');
      if (R() < .55) { b.kind(K.plain).col(0x1f2122); b.cyl(s * (FRONT + fo + 2 + R() * 4), H + .6, u0 + .8 + R() * Math.max(.1, w - 1.6), .62, .62, 1.2, 12); }
      if (R() < .2) { b.kind(K.tin).col(0x9a948a); const xa = X(1.5), xb = X(5); b.quad([xa, H + 2.2, u0 + .3], [xa, H + 2.2, u1 - .3], [xb, H + 1.6, u1 - .3], [xb, H + 1.6, u0 + .3], [-s * .2, 1, 0]); }
    }
  }
  function shopFront(b, s, a0, a1, X, fb, w) {
    const fq2 = (uu0, uu1, v0, v1, d) => fq(b, s, uu0, uu1, v0, v1, d);
    // inside: the back wall lit warm, shelves of goods, a counter
    b.kind(K.inside).col(pick([0x8a6a48, 0x7a6a58, 0x9a7a52, 0x6a7a6a])); fq2(a0, a1, 0, 2.7, 2.39);
    b.kind(K.plain).col(0x7a7064); fb(a0, a1, 0, .16, 0, 2.4, 'ny');
    const st = R();
    if (st < .34) {                                                       // shutter down
      b.kind(K.shutter).col(pick([0x8a8a86, 0x8a8a86, 0x3a6ab8, 0x4a8a6a, 0xc8642a])); fb(a0, a1, .16, 2.7, .02, .1);
    } else {
      if (st < .5) { b.kind(K.shutter).col(0x8a8a86); fb(a0, a1, 1.95, 2.7, .02, .1); }
      for (const y of [.55, 1.15, 1.75]) {
        b.kind(K.wood).col(0x5a4232); fb(a0 + .1, a1 - .1, y - .04, y, 1.95, 2.39);
        for (let uu = a0 + .15; uu < a1 - .35; uu += .32 + R() * .25) { b.kind(K.plain).col(pick(GOODS)); fb(uu, uu + .22 + R() * .12, y, y + .2 + R() * .2, 2.0 + R() * .1, 2.36); }
      }
      b.kind(K.wood).col(pick([0x5a4232, 0x2f5a4a, 0x8a6a48])); fb(a0 + .4, a1 - .4, .16, .95, .7, 1.1);
    }
    // the board
    const sw = Math.min(a1 - a0 + .2, 3.3), sc = (a0 + a1) / 2;
    b.kind(K.plain).col(0x2a2622); fb(sc - sw / 2 - .04, sc + sw / 2 + .04, 2.71, 3.33, -.14, -.02);
    signs.set({ k: K.sign, c: [1, 1, 1], uv: signUV((R() * SIGNS.length) | 0) }); fq(signs, s, sc - sw / 2, sc + sw / 2, 2.73, 3.31, -.142);
    // a tarp awning
    if (R() < .38) {
      b.kind(K.cloth).col(pick(POP));
      const xa = s * (FRONT + .02), xb = s * (FRONT - 1.5);
      b.quad([xa, 2.68, a0], [xa, 2.68, a1], [xb, 2.25, a1], [xb, 2.25, a0], [-s * .4, 1, 0]);
      b.quad([xa, 2.68, a0], [xa, 2.68, a1], [xb, 2.25, a1], [xb, 2.25, a0], [s * .4, -1, 0]);
    }
  }

  // ---------------------------------------------------------------- trees, poles, wires, parked two-wheelers
  for (const s of [-1, 1]) {
    for (let z = Z0 + 20 + R() * 20; z < Z1 - 10; z += 28 + R() * 40) {
      const b = at(z), x = s * (ROAD + .9 + R() * .6), h = 3 + R() * 1.5;
      b.kind(K.wood).col(0x6b5040); b.cyl(x, h / 2, z, .2, .16, h, 8);
      b.kind(K.plain).col(0xf0ece0); b.cyl(x, .55, z, .215, .215, .5, 8);
      b.kind(K.plain).col(R() < .5 ? 0xc8402a : 0xd8a020); b.cyl(x, 1.05, z, .215, .215, .5, 8);
      const cx = x - s * (.6 + R()), cy = h + 1.6;
      for (let i = 0; i < 7; i++) {
        b.kind(K.leaf).col(pick([0x4f7a3a, 0x5e8a40, 0x3e6a30, 0x6a8a3a]));
        const rr = 1.1 + R() * 1.1;
        b.sphere(cx + (R() - .5) * 3, cy + (R() - .3) * 1.6, z + (R() - .5) * 3, rr, rr * .8, rr, 9, 6);
      }
    }
  }
  let prev = null;
  for (let z = Z0 + 10, i = 0; z < Z1; z += 34 + R() * 8, i++) {
    const s = i % 2 ? 1 : -1, x = s * (ROAD + .45), b = at(z);
    b.kind(K.plain).col(0x8a8a86); b.cyl(x, 4, z, .11, .08, 8, 8); b.box(x - .6, 7.4, z - .05, x + .6, 7.5, z + .05);
    const top = [x, 7.45, z];
    if (prev) {
      b.kind(K.plain).col(0x1a1818);
      for (const dx of [-.5, .5]) {
        const A = [prev[0] + dx, prev[1], prev[2]], C = [top[0] + dx, top[1], top[2]];
        let last = A;
        for (let k = 1; k <= 8; k++) { const t = k / 8, sag = Math.sin(t * Math.PI) * 1.1; const P = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t - sag, A[2] + (C[2] - A[2]) * t]; b.limb(last, P, .022, .022, 4, false); last = P; }
      }
    }
    prev = top;
  }
  // parked two-wheelers, angled into the kerb near the shops
  for (const s of [-1, 1]) {
    for (let z = Z0 + 5; z < Z1 - 5;) {
      if (R() < .5) { z += 6 + R() * 18; continue; }
      const n = 1 + (R() * 6 | 0);
      for (let i = 0; i < n; i++, z += 1.2) parkedBike(at(z), s * (ROAD - .5), z, (R() < .5 ? 0 : Math.PI) + (R() - .5) * .7, pick([0x1c1c1e, 0xb8302a, 0x2f5fd0, 0x6a6a6e, 0xeeeeea, 0x7a2a30]));
      z += 3 + R() * 10;
    }
  }
  function parkedBike(b, x, z, yaw, col) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
    const g = (geo, mm) => b.geo(geo, m.clone().multiply(mm));
    const T = (x, y, z, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(1, 1, 1));
    b.kind(K.plain).col(0x161616); for (const zz of [-.6, .6]) g(new THREE.CylinderGeometry(.27, .27, .09, 10), T(0, .27, zz, Math.PI / 2));
    b.kind(K.paint).col(col); g(new THREE.BoxGeometry(.3, .32, 1.1), T(0, .46, -.05)); g(new THREE.BoxGeometry(.38, .68, .15), T(0, .64, .52));
    b.kind(K.plain).col(0x1c1a1a); g(new THREE.BoxGeometry(.34, .1, .7), T(0, .67, -.22)); g(new THREE.BoxGeometry(.7, .05, .07), T(0, 1.0, .52));
  }

  // ---------------------------------------------------------------- meshes
  const meshes = [];
  let tris = 0;
  for (const b of chunks) { if (!b.count) continue; const m = new THREE.Mesh(b.geometry(), matWorld); meshes.push(m); tris += b.count / 3; }
  const sm = new THREE.Mesh(signs.geometry(), matSign); meshes.push(sm); tris += signs.count / 3;
  return { meshes, tris, stats };
}
