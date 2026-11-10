// /beta's hills: the game's height grids (world/hills.js, which still answers the height under wheels and feet),
// drawn again. The near grid (8 m) is drawn at 4 m on a smooth curve through the heights rather than flat facets,
// with a little rocky relief on the slopes (never more than 0.25 m, never at the foot where you'd walk), and shaded
// by its shape: gullies darker, ridges and spurs lighter
import * as THREE from 'three';
import { Hills } from '@orig/world/hills.js';

const HILL_LAYER = 25, SINK = 0.08;
const hash = (x, z) => { const s = Math.sin(x*127.1 + z*311.7)*43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => {
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  const su = u*u*(3 - 2*u), sv = v*v*(3 - 2*v);
  return (a*(1 - su) + b*su)*(1 - sv) + (c*(1 - su) + d*su)*sv;
};
const cr = (p0, p1, p2, p3, t) => 0.5*(2*p1 + (-p0 + p2)*t + (2*p0 - 5*p1 + 4*p2 - p3)*t*t + (-p0 + 3*p1 - 3*p2 + p3)*t*t*t);

Hills.prototype.mesh = function (x0, z0, S, nx, nz, h, yOff) {
  const R = S <= 10 ? 2 : 1, s = S / R, mx = (nx - 1)*R + 1, mz = (nz - 1)*R + 1;
  const at = (i, j) => h[Math.max(0, Math.min(nz - 1, j))*nx + Math.max(0, Math.min(nx - 1, i))];
  // the finer grid: Catmull-Rom through the game's heights (clamped so the curve can't dig below zero)
  const H = new Float32Array(mx*mz);
  for (let J = 0; J < mz; J++) for (let I = 0; I < mx; I++) {
    const i = Math.floor(I / R), j = Math.floor(J / R), u = (I % R) / R, v = (J % R) / R;
    if (!u && !v) { H[J*mx + I] = at(i, j); continue; }
    const row = (jj) => cr(at(i - 1, jj), at(i, jj), at(i + 1, jj), at(i + 2, jj), u);
    H[J*mx + I] = Math.max(0, cr(row(j - 1), row(j), row(j + 1), row(j + 2), v));
  }
  const used = new Int32Array(mx*mz).fill(-1), cells = [];
  for (let j = 0; j < mz - 1; j++) for (let i = 0; i < mx - 1; i++) {
    const k = j*mx + i;
    if (H[k] > 0.05 || H[k + 1] > 0.05 || H[k + mx] > 0.05 || H[k + mx + 1] > 0.05) cells.push(k);
  }
  if (!cells.length) return null;
  // the far field is one sheet 50 km across: cut it into squares 4 km a side, so only the ones in view are drawn
  // (every point's height, slope and shade come from the heights, not from its square, so the joins don't show)
  if (R === 1) {
    const B = 64, by = new Map();
    for (const k of cells) { const i = k % mx, key = Math.floor(i / B) + Math.floor((k - i) / mx / B)*4096; let l = by.get(key); if (!l) by.set(key, l = []); l.push(k); }
    const grp = new THREE.Group();
    for (const l of by.values()) grp.add(this.sheet(l, used, H, mx, mz, x0, z0, s, R, yOff));
    return grp;
  }
  return this.sheet(cells, used, H, mx, mz, x0, z0, s, R, yOff);
};
Hills.prototype.sheet = function (cells, used, H, mx, mz, x0, z0, s, R, yOff) {
  const P = [], N = [], UV = [], SH = [], idx = [], mine = [];
  let c = 0;
  const hv = (i, j) => H[Math.max(0, Math.min(mz - 1, j))*mx + Math.max(0, Math.min(mx - 1, i))];
  const vert = (k) => {
    if (used[k] >= 0) return used[k];
    const i = k % mx, j = (k - i) / mx, x = x0 + i*s, z = z0 + j*s, y0 = H[k];
    const hl = hv(i - 1, j), hr = hv(i + 1, j), hu = hv(i, j - 1), hd = hv(i, j + 1);
    const gx = (hr - hl) / (2*s), gz = (hd - hu) / (2*s), steep = Math.hypot(gx, gz);
    // rock: only up the slope, more where it's steep
    const rock = R > 1 ? (vnoise(x*0.21, z*0.21) - 0.5)*0.5*Math.min(1, Math.max(0, y0 - 2) / 6)*Math.min(1, 0.3 + steep) : 0;
    let ax = -gx, az = -gz; const l = Math.hypot(ax, 1, az);
    P.push(x, y0 + rock + 0.15 - SINK + yOff, z); N.push(Math.round(ax / l*127), Math.round(127 / l), Math.round(az / l*127)); UV.push(x, z);
    // shade from the shape: below the average of its neighbours is a gully, above is a ridge
    const curv = (hl + hr + hu + hd)*0.25 - y0;
    SH.push(Math.max(120, Math.min(255, Math.round(200*(1 - Math.max(-0.18, Math.min(0.18, curv*0.12)) + rock*0.2)))));
    mine.push(k);
    return (used[k] = c++);
  };
  for (const k of cells) { const a = vert(k), b = vert(k + 1), d = vert(k + mx), e = vert(k + mx + 1); idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(N), 3, true));
  g.setAttribute('guv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('glayer', new THREE.BufferAttribute(new Uint8Array(c).fill(HILL_LAYER), 1));
  g.setAttribute('gshade', new THREE.BufferAttribute(new Uint8Array(SH), 1, true));
  g.setIndex(new THREE.BufferAttribute(c > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  const m = new THREE.Mesh(g, this.W.mats.ground);
  m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false;
  for (const k of mine) used[k] = -1;
  return m;
};
