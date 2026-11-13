// world/props.js for /beta: the game's street furniture and stalls at the same sizes, footprints and facing, modelled for real.
// Where the game places them, what collides and where the signal bulbs and sign quads go are all untouched.
// Stalls run to thousands of triangles and a busy square kilometre has over a hundred of them, so they aren't merged into
// the chunks: see stallSets at the bottom. (Merged props keep their colours through fixes.js.)
export * from '@orig/world/props.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ColorBuilder } from '@orig/world/geo.js';
import { buildProto as gameProto, compose, InstancedSet } from '@orig/world/props.js';
import { smash } from './smash.js';

const add0 = ColorBuilder.prototype.addGeo;
ColorBuilder.prototype.addGeo = function (geo, m, ...rest) { return geo.userData?.lod ? geo.userData.lod(m) : add0.call(this, geo, m, ...rest); };

// ---------------------------------------------------------------- the kit
let b = null, seed = 1;
const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
const jit = (c, a = 0.08) => { const k = 1 + (rnd() - 0.5)*a*2; return [Math.min(1, c[0]*k), Math.min(1, c[1]*k), Math.min(1, c[2]*k)]; };
const put = (g, x, y, z, c, o = {}) => b.addGeo(g, compose(x, y, z, o.ry || 0, o.sx || 1, o.sy || 1, o.sz || 1, o.rx || 0, o.rz || 0, new THREE.Matrix4()), c, o.glow || 0);
const box = (w, h, d, x, y, z, c, o) => put(new THREE.BoxGeometry(w, h, d), x, y, z, c, o);
const rbox = (w, h, d, x, y, z, c, o, r = 0.02) => put(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w/2.01, h/2.01, d/2.01)), x, y, z, c, o);
const cyl = (rt, rb, h, x, y, z, c, o = {}) => put(new THREE.CylinderGeometry(rt, rb, h, o.seg || 10, 1, !!o.open), x, y, z, c, o);
const ball = (r, x, y, z, c, o = {}) => put(new THREE.IcosahedronGeometry(r, o.det === undefined ? 1 : o.det), x, y, z, c, o);
const ring = (R, r, x, y, z, c, o = {}) => put(new THREE.TorusGeometry(R, r, o.tseg || 5, o.seg || 14), x, y, z, c, o);
const lathe = (pts, x, y, z, c, o = {}) => put(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), o.seg || 12), x, y, z, c, o);
const UP = new THREE.Vector3(0, 1, 0);
// a bare bulb on its wire under the roof, warm, the brightest thing on the stall after dark (it glows as the lamps do)
function bulb(x, top, z, drop = 0.24) {
  box(0.006, drop, 0.006, x, top - drop/2, z, [0.1, 0.1, 0.1]);
  cyl(0.017, 0.019, 0.04, x, top - drop - 0.015, z, [0.2, 0.19, 0.17], { seg: 8 });
  ball(0.042, x, top - drop - 0.07, z, [1, 0.84, 0.56], { det: 1, glow: 1.5 });
}
// a cart's: a thin pole up from the deck, an arm out, the bulb hanging off it
function poleBulb(x, z, y0, top, ax) {
  rod([x, y0, z], [x, top, z], 0.012, [0.3, 0.3, 0.3], 5);
  rod([x, top, z], [x + ax, top, z], 0.008, [0.3, 0.3, 0.3], 4);
  bulb(x + ax, top, z, 0.14);
}
function rod(a, e, r, c, seg = 6) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...e).sub(A), L = d.length(), m = new THREE.Matrix4();
  m.compose(A.addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1));
  b.addGeo(new THREE.CylinderGeometry(r, r, L, seg, 1, true), m, c);
}
function tube(pts, r, c, seg = 6, n = 10) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), n, r, seg, false);
  b.addGeo(g, new THREE.Matrix4(), c);
}
// a sheet seen from both sides: f(u, v) gives each point, the normals come from the shape
function sheet(nx, nz, f, c, glow = 0, soft = 0) {
  const p = [], ix = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) p.push(...f(i/nx, j/nz));
  const n = (nx + 1)*(nz + 1), at = (i, j) => j*(nx + 1) + i;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) ix.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
  const N = g.attributes.normal;
  if (soft) {      // (ribs that catch the light without turning to noise far off)
    const a = new THREE.Vector3(), v = new THREE.Vector3();
    for (let k = 0; k < N.count; k++) a.add(v.fromBufferAttribute(N, k));
    a.normalize();
    for (let k = 0; k < N.count; k++) { v.fromBufferAttribute(N, k).lerp(a, soft).normalize(); N.setXYZ(k, v.x, v.y, v.z); }
  }
  const P2 = [...p, ...p], N2 = [...N.array, ...Array.from(N.array, v => -v)], I2 = [...ix];
  for (let k = 0; k < ix.length; k += 3) I2.push(ix[k] + n, ix[k + 2] + n, ix[k + 1] + n);
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(N2, 3)); G.setIndex(I2);
  b.addGeo(G, new THREE.Matrix4(), c, glow);
}
// a tapered square section
function taper(w0, d0, w1, d1, h, x, y, z, c) {
  const g = new THREE.BoxGeometry(1, h, 1), P = g.attributes.position;
  for (let k = 0; k < P.count; k++) { const up = P.getY(k) > 0; P.setX(k, P.getX(k)*(up ? w1 : w0)); P.setZ(k, P.getZ(k)*(up ? d1 : d0)); }
  put(g, x, y, z, c);
}
// corrugated tin laid over a rectangle, the ribs running down the slope, each sheet its own age
const ZINC = [[0.55, 0.57, 0.6], [0.5, 0.51, 0.52], [0.6, 0.6, 0.6], [0.46, 0.36, 0.28], [0.52, 0.45, 0.38]];
function tin(w, d, x, y, z, slope, base = ZINC, sheetW = 0.82) {
  const n = Math.max(1, Math.round(w/sheetW)), sw = w/n, t = Math.tan(slope);
  for (let s = 0; s < n; s++) {
    const x0 = x - w/2 + s*sw - 0.012, w1 = sw + 0.024, c = jit(base[Math.floor(rnd()*base.length)], 0.06), lift = s*0.0015, wave = Math.round(w1/0.11);
    sheet(wave*3, 1, (u, v) => {
      const zz = (v - 0.5)*d;
      return [x0 + u*w1, y + lift - zz*t + Math.sin(u*wave*6.2832)*0.011, z + zz];
    }, c, 0, 0.6);
  }
}
// cloth tied at its corners, sagging, with a scalloped front when asked
function cloth(w, d, x, y, z, c, o = {}) {
  const sag = o.sag === undefined ? 0.09 : o.sag, slope = o.slope || 0, stripes = o.stripes || 1, cols = o.cols || [c];
  for (let s = 0; s < stripes; s++) {
    sheet(o.nx || 6, o.nz || 4, (u0, v) => {
      const u = (s + u0)/stripes, px = (u - 0.5)*w, pz = (v - 0.5)*d, drop = sag*Math.sin(u*3.1416)*Math.sin(v*3.1416) + (o.drape ? o.drape*Math.pow(v, 6) : 0);
      return [x + px, y - drop - pz*slope, z + pz];
    }, cols[s % cols.length]);
  }
}
// a cart wheel seen from the side: tyre, rim, spokes, hub. Its axle runs along z
function wheel(x, y, z, R, c = [0.09, 0.09, 0.09], spokes = 8) {
  ring(R - 0.022, 0.026, x, y, z, c, { seg: 18, tseg: 6 });
  ring(R - 0.05, 0.012, x, y, z, [0.5, 0.5, 0.52], { seg: 16, tseg: 4 });
  cyl(0.035, 0.035, 0.07, x, y, z, [0.3, 0.3, 0.32], { rx: Math.PI/2, seg: 8 });
  for (let k = 0; k < spokes; k++) {
    const a = k/spokes*6.2832, ex = Math.cos(a)*(R - 0.05), ey = Math.sin(a)*(R - 0.05);
    rod([x, y, z], [x + ex, y + ey, z], 0.004, [0.55, 0.55, 0.57], 3);
  }
}
// each corner of a model kept once. The builder gives a corner again for every face that meets at it, and a round thing
// (a fruit: eighty faces on forty-two corners) came out as two hundred and forty: a seller's cart of fruit was thirty
// thousand corners, and the carts round one street weighed more than the street. Only corners alike in every number
// (place, facing, colour, glow) are made one, so nothing looks any different
function weld(g) {
  const I = g.index && g.index.array, names = Object.keys(g.attributes), n = g.attributes.position.count;
  if (!I || names.some(k => !(g.attributes[k].array instanceof Float32Array))) return g;
  const A = names.map(k => { const a = g.attributes[k]; return { k, s: a.itemSize, f: a.array, u: new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length) }; });
  let size = 1; while (size < n*2) size <<= 1;
  const tab = new Int32Array(size).fill(-1), to = new Uint32Array(n), keep = [];
  for (let v = 0; v < n; v++) {
    let h = 2166136261;
    for (const a of A) for (let j = v*a.s, e = j + a.s; j < e; j++) h = Math.imul(h ^ a.u[j], 16777619);
    for (let s = (h >>> 0) & (size - 1); ; s = (s + 1) & (size - 1)) {
      const o = tab[s];
      if (o < 0) { tab[s] = to[v] = keep.length; keep.push(v); break; }
      const w = keep[o]; let same = true;
      for (const a of A) { for (let j = 0; j < a.s; j++) if (a.u[v*a.s + j] !== a.u[w*a.s + j]) { same = false; break; } if (!same) break; }
      if (same) { to[v] = o; break; }
    }
  }
  const m = keep.length; if (m === n) return g;
  const out = new THREE.BufferGeometry();
  for (const a of A) { const f = new Float32Array(m*a.s); for (let i = 0; i < m; i++) for (let j = 0; j < a.s; j++) f[i*a.s + j] = a.f[keep[i]*a.s + j]; out.setAttribute(a.k, new THREE.BufferAttribute(f, a.s)); }
  const J = new (m > 65535 ? Uint32Array : Uint16Array)(I.length); for (let i = 0; i < I.length; i++) J[i] = to[I[i]];
  out.setIndex(new THREE.BufferAttribute(J, 1));
  out.boundingBox = g.boundingBox; out.boundingSphere = g.boundingSphere; Object.assign(out.userData, g.userData);
  return out;
}
const finish = () => weld(b.build());
const start = (s) => { b = new ColorBuilder(); seed = s; };

const STEEL = [0.62, 0.63, 0.66], DARKST = [0.22, 0.22, 0.24], RUST = [0.4, 0.26, 0.17], ROPE = [0.62, 0.52, 0.35], BLACK = [0.06, 0.06, 0.07], WOOD = [0.5, 0.34, 0.2];
const LPG = [0.72, 0.1, 0.08];
function gasCylinder(x, y, z, s = 1) {
  lathe([[0, 0], [0.15*s, 0], [0.15*s, 0.04*s], [0.16*s, 0.08*s], [0.16*s, 0.46*s], [0.12*s, 0.54*s], [0.04*s, 0.57*s], [0.04*s, 0.62*s], [0, 0.62*s]], x, y, z, LPG);
  ring(0.06*s, 0.008, x, y + 0.65*s, z, [0.6, 0.15, 0.1], { rx: Math.PI/2, seg: 10, tseg: 4 });
}
function glassTumbler(x, y, z, fill) {
  cyl(0.034, 0.028, 0.09, x, y + 0.045, z, [0.82, 0.86, 0.85], { seg: 8 });
  if (fill) cyl(0.03, 0.028, 0.06, x, y + 0.03, z, fill, { seg: 8 });
}
function bamboo(x0, y0, z0, x1, y1, z1, r = 0.04, c = [0.7, 0.58, 0.35]) {
  rod([x0, y0, z0], [x1, y1, z1], r, jit(c, 0.05), 7);
  const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.max(1, Math.floor(L/0.48));
  for (let k = 1; k <= n; k++) {
    const t = (k + (rnd() - 0.5)*0.2)/(n + 1);
    if (Math.abs(x1 - x0) + Math.abs(z1 - z0) < L*0.1) ring(r, 0.007, x0 + (x1 - x0)*t, y0 + (y1 - y0)*t, z0 + (z1 - z0)*t, [c[0]*0.72, c[1]*0.7, c[2]*0.65], { rx: Math.PI/2, seg: 8, tseg: 3 });
  }
}
const lash = (x, y, z, r = 0.05) => { for (let k = 0; k < 3; k++) ring(r, 0.008, x, y + (k - 1)*0.018, z, ROPE, { rx: Math.PI/2, seg: 8, tseg: 3 }); };

// ---------------------------------------------------------------- street furniture
function lamp() {
  start(11);
  const G = [0.42, 0.44, 0.46], rAt = (y) => 0.13 - 0.06*y/8;
  cyl(0.24, 0.27, 0.22, 0, 0.11, 0, [0.58, 0.57, 0.53], { seg: 12 });       // footing
  box(0.38, 0.03, 0.38, 0, 0.235, 0, DARKST);
  for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) cyl(0.018, 0.018, 0.05, x, 0.27, z, RUST, { seg: 6 });
  cyl(0.07, 0.13, 8.0, 0, 4.0, 0, G, { seg: 14 });
  for (const y of [3.0, 5.6]) cyl(rAt(y) + 0.007, rAt(y) + 0.012, 0.09, 0, y, 0, [0.37, 0.39, 0.41], { seg: 14 });  // where the sections join
  cyl(rAt(1.1) + 0.003, 0.133, 1.1, 0, 0.55, 0, [0.28, 0.27, 0.26], { seg: 14, open: true }); // street grime up to knee height and above
  // the old flyers everyone ties on, faded, no words
  put(new THREE.CylinderGeometry(rAt(2.3) + 0.004, rAt(1.9) + 0.004, 0.42, 8, 1, true, 0.1, 1.9), 0, 2.1, 0, [0.82, 0.76, 0.6]);
  put(new THREE.CylinderGeometry(rAt(2.8) + 0.005, rAt(2.5) + 0.005, 0.28, 8, 1, true, 2.5, 1.4), 0, 2.65, 0, [0.72, 0.42, 0.28]);
  // the junction box with its door, hinges and lock, the conduit down to the ground and the cable up the pole
  rbox(0.4, 0.5, 0.16, 0, 1.2, 0.12, [0.55, 0.55, 0.5], {}, 0.018);
  box(0.34, 0.44, 0.012, 0, 1.2, 0.203, [0.5, 0.5, 0.46]);
  for (const y of [1.06, 1.34]) cyl(0.012, 0.012, 0.05, -0.17, y, 0.208, DARKST, { seg: 6 });
  box(0.03, 0.05, 0.015, 0.14, 1.2, 0.214, DARKST);
  rod([0.1, 0.95, 0.12], [0.1, 0.22, 0.14], 0.016, [0.18, 0.18, 0.19]);
  box(0.42, 0.018, 0.2, 0, 1.46, 0.12, [0.47, 0.47, 0.43], { rx: 0.1 });
  rod([0, 1.45, 0.105], [0, 7.5, 0.08], 0.011, BLACK, 4);
  for (const y of [2.3, 3.6, 4.9, 6.2]) ring(rAt(y) + 0.006, 0.006, 0, y, 0, BLACK, { rx: Math.PI/2, seg: 10, tseg: 3 });
  // the arm curves out and up to the head, on a collar
  tube([[0, 7.6, 0], [0.03, 7.92, 0], [0.32, 8.12, 0], [0.9, 8.2, 0], [1.46, 8.2, 0]], 0.05, G, 8, 14);
  cyl(0.085, 0.085, 0.16, 0, 7.72, 0, [0.37, 0.39, 0.41], { seg: 10 });
  ball(0.075, 0, 8.02, 0, [0.36, 0.38, 0.4], { sy: 0.8 });
  // LED head: cast housing, fins along its back, the lit panel under its frame
  rbox(0.65, 0.12, 0.3, 1.75, 8.15, 0, [0.3, 0.3, 0.32], {}, 0.04);
  rbox(0.14, 0.09, 0.14, 1.42, 8.19, 0, [0.27, 0.27, 0.29], {}, 0.03);
  for (let k = 0; k < 7; k++) box(0.012, 0.03, 0.24, 1.55 + k*0.065, 8.222, 0, [0.26, 0.26, 0.28]);
  box(0.56, 0.025, 0.26, 1.75, 8.095, 0, [0.2, 0.2, 0.22]);
  box(0.5, 0.03, 0.22, 1.75, 8.08, 0, [1.0, 0.92, 0.8], { glow: 1.0 });
  cyl(0.022, 0.026, 0.03, 1.97, 8.225, 0, [0.12, 0.12, 0.13], { seg: 8 });   // the dusk sensor
  return finish();
}

function pole() {
  start(23);
  const C = [0.62, 0.61, 0.58], T = 0.74;  // how much it narrows at the top
  // cast I-section: two flanges and a thinner web, with the holes for steps and fittings running up it
  for (const s of [-1, 1]) taper(0.055, 0.16, 0.055*T, 0.16*T, 8.5, s*0.072, 4.25, 0, jit(C, 0.02));
  taper(0.1, 0.09, 0.08, 0.07, 8.5, 0, 4.25, 0, [0.56, 0.55, 0.52]);
  for (let k = 0; k < 11; k++) { const y = 1.0 + k*0.62; box(0.05, 0.05, 0.095 - y*0.003, 0, y, 0, [0.14, 0.13, 0.12]); }
  taper(0.28, 0.24, 0.215, 0.175, 0.42, 0, 0.21, 0, [0.46, 0.45, 0.41]);                 // the rough collar at the ground
  taper(0.208, 0.168, 0.205, 0.165, 0.9, 0, 0.87, 0, [0.42, 0.41, 0.37]);                  // splash-dirt
  box(0.09, 0.14, 0.012, 0, 2.95, 0.05, [0.85, 0.85, 0.8]);                                // the board's number plate
  box(0.15, 0.22, 0.008, 0.01, 2.2, 0.082, [0.8, 0.7, 0.55]);                              // flyers
  box(0.14, 0.17, 0.008, -0.01, 2.5, 0.083, [0.68, 0.74, 0.76]);
  // crossarm: angle iron, braced back to the pole, through-bolted
  box(1.6, 0.012, 0.1, 0, 7.945, 0, [0.25, 0.25, 0.27]);
  box(1.6, 0.1, 0.012, 0, 7.9, -0.044, [0.23, 0.23, 0.25]);
  for (const s of [-1, 1]) rod([s*0.55, 7.87, -0.03], [0.02*s, 7.42, -0.075], 0.012, [0.22, 0.22, 0.24], 4);
  box(0.2, 0.2, 0.012, 0, 7.86, 0.078, [0.28, 0.28, 0.3]);
  for (const [x, y] of [[-0.06, 7.8], [0.06, 7.8], [-0.06, 7.92], [0.06, 7.92]]) cyl(0.012, 0.012, 0.02, x, y, 0.09, RUST, { rx: Math.PI/2, seg: 6 });
  // porcelain pin insulators, ribbed
  for (const o of [-0.7, -0.25, 0.25, 0.7]) {
    cyl(0.009, 0.009, 0.05, o, 7.965, 0, RUST, { seg: 5 });
    lathe([[0.012, 0], [0.05, 0.012], [0.03, 0.03], [0.044, 0.046], [0.027, 0.062], [0.037, 0.08], [0.024, 0.1], [0.026, 0.116], [0, 0.128]], o, 7.942, 0, [0.85, 0.85, 0.8], { seg: 8 });
  }
  // the box, with its door, hood, fuse unit and cables
  rbox(0.35, 0.5, 0.25, 0, 5.2, 0.2, [0.35, 0.36, 0.36], {}, 0.015);
  box(0.29, 0.44, 0.012, 0, 5.2, 0.328, [0.31, 0.32, 0.32]);
  box(0.38, 0.02, 0.28, 0, 5.46, 0.2, [0.29, 0.3, 0.3], { rx: 0.1 });
  for (const y of [5.06, 5.34]) cyl(0.01, 0.01, 0.04, -0.15, y, 0.337, DARKST, { seg: 6 });
  box(0.03, 0.045, 0.012, 0.12, 5.2, 0.34, [0.75, 0.6, 0.15]);
  box(0.42, 0.04, 0.13, 0, 5.5, 0.1, [0.25, 0.25, 0.26]);
  rod([0.08, 5.46, 0.17], [0.08, 7.82, 0.06], 0.012, BLACK, 4);
  rod([-0.08, 5.46, 0.17], [-0.05, 7.82, 0.06], 0.009, BLACK, 4);
  rod([0.06, 4.96, 0.2], [0.06, 2.2, 0.092], 0.011, BLACK, 4);
  rod([0.02, 7.5, 0.066], [0.02, 0.4, 0.09], 0.006, [0.3, 0.2, 0.08], 3);                 // the earth wire
  for (const y of [3.4, 4.5, 6.4]) box(0.22, 0.012, 0.19, 0, y, 0, [0.55, 0.55, 0.58]);
  // coils of extra cable everyone leaves on poles
  ring(0.28, 0.035, 0, 6.2, 0.12, [0.08, 0.08, 0.08], { seg: 16, tseg: 5 });
  ring(0.26, 0.016, 0.02, 6.18, 0.155, [0.12, 0.11, 0.1], { seg: 14, tseg: 4 });
  ring(0.29, 0.012, -0.02, 6.21, 0.09, [0.06, 0.06, 0.06], { seg: 14, tseg: 3 });
  for (const a of [0.7, 2.2, 4.3]) box(0.07, 0.022, 0.095, Math.cos(a)*0.28, 6.2 + Math.sin(a)*0.28, 0.12, [0.7, 0.68, 0.6], { rz: a + 1.57 });
  return finish();
}

function signal() {
  start(37);
  const P0 = [0.15, 0.15, 0.16], H = [0.1, 0.1, 0.1];
  box(0.32, 0.025, 0.32, 0, 0.012, 0, DARKST);
  for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) cyl(0.014, 0.014, 0.05, x, 0.04, z, RUST, { seg: 6 });
  cyl(0.08, 0.1, 3.4, 0, 1.7, 0, P0, { seg: 12 });
  // black and yellow up to head height of a scooter
  for (let k = 0; k < 6; k++) cyl(0.105, 0.11, 0.25, 0, 0.145 + k*0.25, 0, k % 2 ? [0.1, 0.1, 0.1] : [0.9, 0.72, 0.1], { seg: 12, open: true });
  cyl(0.11, 0.11, 0.035, 0, 1.53, 0, [0.1, 0.1, 0.1], { seg: 12 });
  // the controller's little box on the pole and its conduit up
  rbox(0.18, 0.28, 0.1, 0, 2.0, -0.13, [0.26, 0.27, 0.28], {}, 0.012);
  box(0.14, 0.23, 0.01, 0, 2.0, -0.183, [0.22, 0.23, 0.24]);
  rod([0, 2.14, -0.12], [0, 2.75, -0.09], 0.011, BLACK, 4);
  // the head: the case, a board behind the lamps, a socket and a hood over each. The lamps are the game's, at x 0.24
  rbox(0.3, 1.0, 0.35, 0.05, 3.25, 0, H, {}, 0.035);
  box(0.016, 1.16, 0.54, 0.2, 3.25, 0, [0.05, 0.05, 0.05]);
  for (const s of [-1, 1]) box(0.018, 1.17, 0.02, 0.2, 3.25, s*0.27, [0.85, 0.68, 0.08]);
  for (const s of [-1, 1]) box(0.018, 0.02, 0.56, 0.2, 3.25 + s*0.585, 0, [0.85, 0.68, 0.08]);
  for (let k = 0; k < 3; k++) {
    const y = 3.55 - k*0.3;
    ring(0.12, 0.012, 0.222, y, 0, [0.03, 0.03, 0.03], { ry: Math.PI/2, seg: 14, tseg: 4 });
    cyl(0.11, 0.11, 0.015, 0.218, y, 0, [0.03, 0.03, 0.03], { rz: Math.PI/2, seg: 12 });
    sheet(10, 1, (u, v) => { const a = -0.25 + u*3.64, R = 0.128 + v*0.012; return [0.224 + v*0.2, y + Math.sin(a)*R, Math.cos(a)*R]; }, [0.035, 0.035, 0.035]);
  }
  // its back: a door, hinges, the clamps round the pole
  box(0.012, 0.92, 0.28, -0.103, 3.25, 0, [0.13, 0.13, 0.13]);
  for (const y of [2.95, 3.55]) { cyl(0.012, 0.012, 0.05, -0.11, y, 0.14, DARKST, { seg: 6 }); }
  for (const y of [2.82, 3.68]) { box(0.08, 0.05, 0.1, -0.12, y, 0, [0.2, 0.2, 0.21]); }
  cyl(0.085, 0.085, 0.03, 0, 3.415, 0, H, { seg: 10 });
  const g = finish();
  return g;
}

function shelter() {
  start(41);
  const F = [0.35, 0.5, 0.4], R = [0.2, 0.45, 0.32], P0 = [0.75, 0.78, 0.8];
  for (const [x, z, h] of [[-2.2, -0.6, 2.6], [2.2, -0.6, 2.6], [-2.2, 0.6, 2.4], [2.2, 0.6, 2.4]]) {
    rbox(0.1, h, 0.1, x, h/2, z, jit(F, 0.04), {}, 0.015);
    box(0.24, 0.02, 0.24, x, 0.01, z, DARKST);
    for (const [a, c] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) cyl(0.012, 0.012, 0.03, x + a, 0.03, z + c, RUST, { seg: 5 });
    box(0.106, 0.5, 0.106, x, 0.27, z, [0.25, 0.3, 0.26]);
  }
  // the roof: tin on purlins, with a gutter along its low edge and a pipe down
  for (const s of [-1, 1]) rod([s*2.2, 2.42, 0.6], [s*2.2, 2.61, -0.6], 0.04, F);
  for (const z of [-0.6, -0.15, 0.3, 0.72]) box(4.9, 0.05, 0.05, 0, 2.555 - z*0.08, z, [0.3, 0.42, 0.35]);
  tin(5.0, 1.8, 0, 2.62, 0, 0.08, [R, [0.18, 0.4, 0.29], [0.24, 0.48, 0.35], [0.2, 0.36, 0.28]], 0.92);
  sheet(4, 1, (u, v) => { const a = u*3.1416; return [-2.5 + v*5.0, 2.525 + 0.0 - Math.sin(a)*0.045, 0.92 + Math.cos(a)*0.05]; }, [0.24, 0.3, 0.27]);
  tube([[2.42, 2.49, 0.9], [2.32, 2.3, 0.68], [2.28, 2.1, 0.66], [2.28, 0.25, 0.66]], 0.022, [0.24, 0.3, 0.27], 6, 10);
  // the sign's frame stands on the roof: its quad sits just in front at z 0
  box(2.36, 0.68, 0.04, 0, 2.87, -0.035, [0.13, 0.14, 0.15]);
  for (const s of [-1, 1]) box(0.05, 0.6, 0.05, s*1.16, 2.86, -0.05, [0.3, 0.32, 0.34]);
  box(2.36, 0.03, 0.05, 0, 3.21, -0.04, F);
  // back wall: rails and slats, a poster case with nothing advertised, stickers and dents
  for (const y of [0.62, 1.4, 2.2]) box(4.34, 0.05, 0.03, 0, y, -0.668, [0.3, 0.42, 0.35]);
  for (let k = 0; k <= 21; k++) { const x = -2.1 + k*0.2; if (x > -1.2 && x < 0.1) continue; box(0.15, 1.6, 0.012, x, 1.4, -0.62, jit(P0, 0.04)); }
  rbox(1.32, 1.56, 0.07, -0.55, 1.4, -0.62, [0.26, 0.3, 0.3], {}, 0.015);
  box(1.2, 1.44, 0.01, -0.55, 1.4, -0.58, [0.86, 0.85, 0.8]);
  for (const [x, y, w, h, c] of [[-1.7, 1.1, 0.2, 0.28, [0.9, 0.82, 0.3]], [0.5, 0.95, 0.16, 0.22, [0.85, 0.35, 0.25]], [0.9, 1.6, 0.26, 0.2, [0.92, 0.9, 0.82]], [1.55, 1.25, 0.14, 0.3, [0.4, 0.6, 0.8]], [-0.7, 1.05, 0.34, 0.24, [0.75, 0.7, 0.55]]]) box(w, h, 0.004, x, y, x < 0 && x > -1.2 ? -0.573 : -0.611, c);
  // the bench: slats on real legs, an armrest every two seats so nobody sleeps on it
  for (const z of [-0.5, -0.36, -0.22]) rbox(4.0, 0.035, 0.11, 0, 0.5, z, jit([0.6, 0.6, 0.62], 0.05), {}, 0.012);
  for (const x of [-1.8, -0.6, 0.6, 1.8]) {
    box(0.05, 0.47, 0.05, x, 0.235, -0.36, [0.3, 0.32, 0.33]);
    box(0.04, 0.04, 0.46, x, 0.46, -0.36, [0.3, 0.32, 0.33]);
    tube([[x, 0.52, -0.5], [x, 0.7, -0.45], [x, 0.7, -0.22], [x, 0.52, -0.18]], 0.012, [0.28, 0.3, 0.31], 5, 8);
  }
  // a bin at one end
  lathe([[0, 0], [0.15, 0], [0.18, 0.62], [0.19, 0.64], [0.17, 0.66], [0, 0.66]], -2.02, 0, 0.3, [0.2, 0.42, 0.28], { seg: 10 });
  return finish();
}

// ---------------------------------------------------------------- stalls
function tapri() {
  start(53);
  const P = [0.55, 0.36, 0.2], RED = [0.75, 0.2, 0.15], SIDE = [0.7, 0.68, 0.6];
  // the counter: planks on a frame, on two courses of brick
  box(2.2, 1.0, 1.2, 0, 0.5, 0, [0.28, 0.18, 0.1]);
  for (const k of [0, 1, 2, 3, 4, 5]) { box(2.22, 0.15, 0.015, 0, 0.1 + k*0.165, 0.605, jit(P, 0.12)); box(2.22, 0.15, 0.015, 0, 0.1 + k*0.165, -0.605, jit(P, 0.12)); box(0.015, 0.15, 1.22, 1.105, 0.1 + k*0.165, 0, jit(P, 0.12)); box(0.015, 0.15, 1.22, -1.105, 0.1 + k*0.165, 0, jit(P, 0.12)); }
  for (const x of [-1.08, 0, 1.08]) box(0.06, 1.0, 0.03, x, 0.5, 0.615, [0.34, 0.22, 0.12]);
  box(2.26, 0.03, 1.26, 0, 1.0, 0, STEEL);
  box(2.28, 0.02, 0.04, 0, 0.985, 0.63, [0.5, 0.5, 0.53]);
  for (let k = 0; k < 13; k++) { const row = k % 2; rbox(0.2, 0.07, 0.1, -1.08 + k*0.185, 0.03, 0.6 + row*0.01, jit([0.5, 0.26, 0.18], 0.14), {}, 0.01); }
  // the walls: painted tin with its ribs, posts at the corners
  box(2.2, 1.2, 0.04, 0, 1.6, -0.57, RED);
  for (let k = 0; k <= 14; k++) for (const z of [-0.545, -0.595]) box(0.016, 1.2, 0.012, -1.08 + k*0.155, 1.6, z, [0.66, 0.17, 0.13]);
  for (const s of [-1, 1]) {
    box(0.04, 1.2, 1.2, s*1.07, 1.6, 0, SIDE);
    for (let k = 0; k <= 7; k++) for (const o of [-0.024, 0.024]) box(0.012, 1.2, 0.016, s*(1.07 + o), 1.6, -0.56 + k*0.16, [0.62, 0.6, 0.53]);
    box(0.012, 0.3, 0.5, s*1.094, 1.22, -0.1 + s*0.12, RUST);
    box(0.05, 1.3, 0.05, s*1.07, 1.65, 0.58, [0.3, 0.25, 0.2]);
  }
  box(2.2, 0.05, 0.05, 0, 2.2, 0.58, [0.3, 0.25, 0.2]);
  // the shelf at the back, with jars of biscuits and rusk, and the sachets hanging in the opening
  box(2.08, 0.025, 0.2, 0, 1.75, -0.44, [0.42, 0.28, 0.16]);
  for (let k = 0; k < 7; k++) {
    const x = -0.9 + k*0.3, c = [[0.8, 0.55, 0.25], [0.65, 0.35, 0.15], [0.9, 0.75, 0.45]][k % 3];
    cyl(0.07, 0.07, 0.2, x, 1.87, -0.44, [0.78, 0.82, 0.82], { seg: 10 });
    cyl(0.062, 0.062, 0.13, x, 1.84, -0.44, c, { seg: 8 });
    cyl(0.075, 0.075, 0.03, x, 1.98, -0.44, [[0.8, 0.2, 0.15], [0.2, 0.4, 0.75], [0.9, 0.75, 0.2]][k % 3], { seg: 10 });
  }
  const SA = [[0.9, 0.2, 0.2], [0.95, 0.75, 0.1], [0.2, 0.5, 0.9], [0.9, 0.9, 0.9], [0.2, 0.7, 0.3]];
  box(2.1, 0.012, 0.012, 0, 2.13, 0.5, [0.2, 0.2, 0.2]);
  for (let k = 0; k < 16; k++) { const x = -1.0 + k*0.135; for (let j = 0; j < 4; j++) box(0.07, 0.085, 0.006, x, 2.08 - j*0.092, 0.5, SA[(k + (k > 7 ? 2 : 0)) % 5]); }
  // the tin roof, with a batten holding it down and bricks on top
  for (const z of [-0.5, 0.15, 0.8]) box(2.5, 0.05, 0.06, 0, 2.2 - z*0.1, z, [0.38, 0.28, 0.2]);
  tin(2.6, 1.7, 0, 2.25, 0.15, 0.1);
  for (const [x, z] of [[-0.8, -0.2], [0.55, 0.4], [0.9, -0.3]]) box(0.2, 0.07, 0.1, x, 2.33 - z*0.1 - 0.015, z, [0.5, 0.26, 0.18], { rx: 0.1, ry: x });
  // the stove, the blue flame the game had and the chai pot on it, then the kettle
  cyl(0.18, 0.2, 0.05, 0.5, 1.04, 0.1, [0.2, 0.2, 0.21], { seg: 12 });
  for (let k = 0; k < 3; k++) { const a = k*2.09; box(0.3, 0.012, 0.02, 0.5 + Math.cos(a)*0.09, 1.075, 0.1 + Math.sin(a)*0.09, BLACK, { ry: a }); }
  cyl(0.18, 0.18, 0.12, 0.5, 1.03, 0.1, [0.15, 0.25, 0.6], { glow: 0.6, seg: 12, open: true });
  lathe([[0, 0], [0.13, 0], [0.16, 0.05], [0.16, 0.2], [0.17, 0.215], [0.15, 0.215], [0.15, 0.06], [0, 0.17]], 0.5, 1.08, 0.1, [0.75, 0.75, 0.78], { seg: 16 });
  cyl(0.15, 0.15, 0.01, 0.5, 1.255, 0.1, [0.52, 0.32, 0.17], { seg: 14 });
  tube([[0.62, 1.3, 0.14], [0.68, 1.42, 0.2], [0.76, 1.4, 0.3]], 0.008, [0.4, 0.4, 0.42], 4, 6);
  ring(0.05, 0.008, 0.8, 1.38, 0.33, [0.5, 0.5, 0.52], { rx: 1.2, seg: 10, tseg: 3 });
  lathe([[0, 0], [0.09, 0], [0.11, 0.04], [0.1, 0.14], [0.05, 0.19], [0.05, 0.21], [0, 0.21]], -0.25, 1.015, 0.05, [0.72, 0.72, 0.75], { seg: 12 });
  rod([-0.15, 1.08, 0.05], [-0.07, 1.17, 0.05], 0.012, [0.72, 0.72, 0.75], 5);
  tube([[-0.35, 1.08, 0.05], [-0.4, 1.2, 0.05], [-0.33, 1.2, 0.05]], 0.008, BLACK, 4, 6);
  // the glasses of chai on their tray, a jar of sugar, a spoon, a bowl of washing water
  box(0.62, 0.012, 0.2, -0.4, 1.022, 0.35, [0.68, 0.68, 0.7]);
  for (let k = 0; k < 5; k++) glassTumbler(-0.6 + k*0.1, 1.03, 0.35, [0.62, 0.38, 0.18]);
  cyl(0.06, 0.05, 0.1, -0.85, 1.065, 0.3, [0.85, 0.85, 0.82], { seg: 10 });
  lathe([[0, 0], [0.07, 0], [0.12, 0.05], [0.13, 0.06], [0, 0.045]], 0.0, 1.015, 0.4, [0.74, 0.75, 0.78], { seg: 14 });
  // the gas cylinder at the end of the counter, the customers' bench on legs, two stools
  gasCylinder(0.82, 1.015, -0.25, 0.6);
  rod([0.82, 1.3, -0.25], [0.55, 1.05, 0.0], 0.008, [0.75, 0.3, 0.1], 4);
  box(1.4, 0.05, 0.33, 0, 0.42, 1.0, jit([0.4, 0.3, 0.2], 0.1));
  for (const s of [-1, 1]) for (const z of [0.88, 1.12]) box(0.05, 0.4, 0.05, s*0.6, 0.2, z, [0.26, 0.2, 0.14]);
  box(1.2, 0.03, 0.03, 0, 0.15, 1.0, [0.26, 0.2, 0.14]);
  bulb(0.45, 2.24, 0.62);
  return finish();
}

function paan() {
  start(67);
  const G = [0.2, 0.45, 0.35], TR = [0.92, 0.82, 0.3], D = [0.1, 0.08, 0.07];
  // a real cabin with a real opening: back, sides, under and over the window
  box(1.4, 2.2, 0.04, 0, 1.1, -0.58, G);
  for (let k = 0; k < 6; k++) box(0.03, 2.2, 0.012, -0.6 + k*0.24, 1.1, -0.606, [0.17, 0.39, 0.3]);
  for (const y of [0.25, 1.1, 2.0]) box(1.42, 0.05, 0.012, 0, y, -0.607, y === 1.1 ? [0.17, 0.39, 0.3] : TR);
  for (const s of [-1, 1]) {
    box(0.04, 2.2, 1.2, s*0.68, 1.1, 0, G);
    for (let k = 0; k <= 4; k++) box(0.03, 2.2, 0.012, s*0.7, 1.1, -0.48 + k*0.24, [0.17, 0.39, 0.3]);
    box(0.012, 0.05, 1.2, s*0.705, 1.1, 0, TR); box(0.012, 0.05, 1.2, s*0.705, 2.0, 0, TR);
  }
  box(1.4, 0.98, 0.04, 0, 0.51, 0.58, G);
  box(1.4, 0.3, 0.04, 0, 2.05, 0.58, G);
  box(1.36, 0.04, 1.16, 0, 0.02, 0, DARKST);
  box(1.36, 0.04, 1.16, 0, 2.18, 0, [0.15, 0.12, 0.1]);
  for (const s of [-1, 1]) box(0.1, 0.92, 0.05, s*0.65, 1.45, 0.58, G);
  for (const y of [0.3, 0.6, 0.9]) box(1.42, 0.012, 0.012, 0, y, 0.606, [0.15, 0.36, 0.28]);
  box(1.42, 0.05, 0.02, 0, 0.12, 0.606, TR); box(1.42, 0.05, 0.02, 0, 1.92, 0.606, TR);
  // inside: a dark wall, shelves of boxes, a mirror, jars and the marble where he folds the leaf
  box(1.28, 1.0, 0.02, 0, 1.45, -0.55, D);
  for (const y of [1.2, 1.48, 1.74]) {
    box(1.26, 0.02, 0.24, 0, y, -0.44, [0.28, 0.18, 0.1]);
    for (let k = 0; k < 11; k++) { const h = 0.1 + rnd()*0.08; box(0.095, h, 0.11, -0.54 + k*0.108, y + 0.01 + h/2, -0.46, jit([[0.75, 0.15, 0.12], [0.9, 0.85, 0.75], [0.15, 0.25, 0.6], [0.92, 0.7, 0.1], [0.12, 0.42, 0.3]][Math.floor(rnd()*5)], 0.1)); }
  }
  rbox(0.34, 0.42, 0.012, 0.42, 1.48, -0.3, [0.72, 0.82, 0.86], {}, 0.005);
  box(1.3, 0.05, 1.14, 0, 1.01, 0, [0.28, 0.18, 0.1]);
  box(1.46, 0.035, 0.32, 0, 1.03, 0.72, [0.86, 0.86, 0.84]);
  for (const s of [-1, 1]) rod([s*0.6, 1.02, 0.84], [s*0.6, 0.62, 0.61], 0.012, DARKST, 4);
  // on the counter: the stack of betel leaves, brass tins of what goes in, a jar of sweets, the lime in its cup
  for (let k = 0; k < 7; k++) { const y = 1.05 + k*0.012; ball(0.09, -0.35 + rnd()*0.015, y, 0.72 + rnd()*0.015, jit([0.25, 0.55, 0.15], 0.15), { sy: 0.08, sz: 0.75, ry: rnd()*6.28, det: 1 }); }
  for (let k = 0; k < 6; k++) { const x = -0.12 + k*0.075, z = 0.66 + (k % 2)*0.09; cyl(0.032, 0.036, 0.06, x, 1.078, z, [0.8, 0.62, 0.22], { seg: 8 }); cyl(0.028, 0.028, 0.005, x, 1.111, z, [[0.9, 0.86, 0.75], [0.45, 0.2, 0.1], [0.75, 0.15, 0.2], [0.85, 0.75, 0.25], [0.3, 0.1, 0.07], [0.3, 0.55, 0.3]][k], { seg: 8 }); }
  cyl(0.06, 0.06, 0.16, 0.48, 1.13, 0.7, [0.78, 0.82, 0.82], { seg: 10 });
  cyl(0.055, 0.055, 0.11, 0.48, 1.105, 0.7, [0.85, 0.25, 0.25], { seg: 8 });
  cyl(0.065, 0.065, 0.025, 0.48, 1.22, 0.7, [0.85, 0.7, 0.2], { seg: 10 });
  // the strips of sachets the game had, cut up into sachets
  const cols = [[0.9, 0.2, 0.2], [0.95, 0.75, 0.1], [0.2, 0.5, 0.9], [0.9, 0.9, 0.9], [0.2, 0.7, 0.3]];
  box(1.3, 0.015, 0.015, 0, 1.9, 0.66, [0.2, 0.2, 0.2]);
  for (let k = 0; k < 14; k++) for (let j = 0; j < 5; j++) box(0.07, 0.092, 0.004, -0.6 + k*0.092, 1.85 - j*0.1, 0.66, cols[k % 5]);
  // the flap, propped up over the customer, and the tin above it
  box(1.34, 0.025, 0.46, 0, 2.02, 0.84, [0.17, 0.39, 0.3], { rx: 0.3 });
  for (const s of [-1, 1]) rod([s*0.6, 1.92, 1.04], [s*0.62, 1.04, 0.62], 0.01, DARKST, 4);
  tin(1.7, 1.5, 0, 2.25, 0.1, 0.04, ZINC, 0.6);
  // a garland over the window, lime and chillies below it, a bulb on its wire, a stool to reach it all
  for (let k = 0; k < 9; k++) { const t = k/8, x = -0.56 + t*1.12; ball(0.03, x, 1.94 - Math.sin(t*3.1416)*0.06, 0.615, k % 2 ? [1, 0.6, 0.05] : [1, 0.85, 0.2], { det: 0 }); }
  box(0.008, 0.2, 0.008, 0, 0.85, 0.61, [0.8, 0.8, 0.7]);
  ball(0.022, 0, 0.75, 0.61, [0.8, 0.8, 0.2], { det: 0 });
  for (const a of [-0.5, 0.5]) ball(0.012, Math.sin(a)*0.018, 0.71, 0.61, [0.15, 0.5, 0.12], { det: 0, sy: 2.6 });
  cyl(0.15, 0.13, 0.03, -0.45, 0.42, 1.0, [0.2, 0.4, 0.7], { seg: 12 });
  for (let k = 0; k < 4; k++) { const a = k*1.57 + 0.8; rod([-0.45 + Math.cos(a)*0.1, 0.41, 1.0 + Math.sin(a)*0.1], [-0.45 + Math.cos(a)*0.13, 0, 1.0 + Math.sin(a)*0.13], 0.012, [0.2, 0.4, 0.7], 4); }
  bulb(-0.42, 2.24, 0.5);
  return finish();
}

// the chassis all the carts share: a deck with a lip, rails beneath, four wheels, a pair of handles
function cart(w, d, deck, R, wz, wx = w/2 - 0.1) {
  box(w, 0.04, d, 0, 0.8, 0, deck);
  for (const s of [-1, 1]) { box(w + 0.04, 0.08, 0.025, 0, 0.82, s*(d/2 + 0.01), [deck[0]*0.75, deck[1]*0.75, deck[2]*0.75]); box(w - 0.08, 0.06, 0.05, 0, 0.68, s*(d/2 - 0.1), [0.28, 0.28, 0.3]); }
  for (const s of [-1, 1]) box(0.025, 0.08, d + 0.02, s*(w/2 + 0.01), 0.82, 0, [deck[0]*0.75, deck[1]*0.75, deck[2]*0.75]);
  for (const x of [-wx, wx]) { rod([x, R, -wz - 0.03], [x, R, wz + 0.03], 0.018, DARKST); box(0.06, 0.68 - R, 0.05, x, (0.68 + R)/2, -wz + 0.06, DARKST); box(0.06, 0.68 - R, 0.05, x, (0.68 + R)/2, wz - 0.06, DARKST); for (const z of [-wz, wz]) wheel(x, R, z, R); }
  for (const s of [-1, 1]) tube([[-w/2, 0.72, s*(d/2 - 0.1)], [-w/2 - 0.3, 0.74, s*(d/2 - 0.1)], [-w/2 - 0.42, 0.86, s*(d/2 - 0.14)]], 0.016, [0.28, 0.28, 0.3], 5, 6);
}

function vadapav() {
  start(79);
  cart(1.8, 0.9, [0.6, 0.6, 0.62], 0.28, 0.45);
  // the steel skirt, with its rows of rivets and a lower shelf holding what's needed
  for (const s of [-1, 1]) { box(1.78, 0.34, 0.012, 0, 0.61, s*0.42, [0.55, 0.56, 0.58]); for (let k = 0; k < 12; k++) cyl(0.006, 0.006, 0.006, -0.82 + k*0.149, 0.76, s*0.428, [0.72, 0.72, 0.74], { rx: Math.PI/2, seg: 5 }); }
  box(1.5, 0.02, 0.7, 0, 0.36, 0, [0.35, 0.35, 0.37]);
  gasCylinder(0.45, 0.37, 0, 0.72);
  tube([[0.45, 0.82, 0], [0.62, 0.9, 0.2], [0.55, 0.96, 0.05]], 0.01, [0.8, 0.35, 0.1], 4, 8);
  for (let k = 0; k < 3; k++) cyl(0.11, 0.11, 0.06, -0.45, 0.4 + k*0.065, 0.15, [0.8, 0.75, 0.68], { seg: 12 });
  cyl(0.14, 0.13, 0.32, -0.3, 0.53, -0.15, [0.2, 0.42, 0.7], { seg: 10 });
  // the glass box: a steel frame with nothing drawn in the panes, so you can see what's in it
  const fx = -0.35, fy = 0.82, W = 0.9, H = 0.45, D = 0.7, ST = [0.7, 0.72, 0.74];
  box(W + 0.03, 0.02, D + 0.03, fx, fy + 0.01, 0, [0.72, 0.72, 0.74]);
  box(W + 0.03, 0.02, D + 0.03, fx, fy + H, 0, ST);
  for (const x of [-1, 1]) for (const z of [-1, 1]) box(0.022, H, 0.022, fx + x*W/2, fy + H/2, z*D/2, ST);
  for (const z of [-1, 1]) box(W, 0.012, 0.012, fx, fy + H*0.5, z*D/2, [0.82, 0.84, 0.85]);
  // the vadas in their pile, the pav in rows, chutneys in bowls
  const VD = [[0.76, 0.5, 0.15], [0.7, 0.42, 0.12], [0.82, 0.58, 0.2]];
  for (let l = 0; l < 3; l++) for (let i = 0; i < 5 - l; i++) for (let j = 0; j < 3 - l; j++) ball(0.052, fx - 0.33 + l*0.04 + i*0.1, fy + 0.07 + l*0.08, -0.22 + l*0.05 + j*0.1, jit(VD[(i + j) % 3], 0.1), { sy: 0.8, det: 1 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { rbox(0.09, 0.06, 0.09, fx + 0.1 + i*0.095, fy + 0.055, 0.04 + j*0.1, jit([0.88, 0.66, 0.36], 0.05), {}, 0.024); box(0.092, 0.004, 0.092, fx + 0.1 + i*0.095, fy + 0.06, 0.04 + j*0.1, [0.95, 0.85, 0.65]); }
  for (let k = 0; k < 3; k++) { const c = [[0.25, 0.5, 0.16], [0.72, 0.18, 0.1], [0.82, 0.72, 0.5]][k]; lathe([[0, 0], [0.05, 0], [0.075, 0.04], [0, 0.03]], fx - 0.25 + k*0.17, fy + 0.02, 0.22, [0.72, 0.72, 0.74], { seg: 10 }); cyl(0.066, 0.066, 0.004, fx - 0.25 + k*0.17, fy + 0.052, 0.22, c, { seg: 10 }); }
  // the kadhai on its burner: oil in it, a slotted spoon across, and the paper the vadas go out in
  cyl(0.22, 0.24, 0.07, 0.5, 0.86, 0, [0.14, 0.14, 0.15], { seg: 12 });
  lathe([[0, 0], [0.12, 0.012], [0.25, 0.08], [0.34, 0.17], [0.35, 0.18], [0.33, 0.18], [0, 0.03]], 0.5, 0.88, 0, [0.25, 0.25, 0.25], { seg: 18 });
  cyl(0.315, 0.315, 0.004, 0.5, 1.03, 0, [0.42, 0.27, 0.07], { seg: 18 });
  for (const s of [-1, 1]) ring(0.05, 0.008, 0.5, 1.06, s*0.35, DARKST, { seg: 8, tseg: 3 });
  for (let k = 0; k < 4; k++) ball(0.04, 0.45 + k*0.04, 1.045, -0.1 + (k % 2)*0.16, VD[k % 3], { sy: 0.7 });
  rod([0.7, 1.09, 0.1], [0.32, 1.12, 0.42], 0.007, [0.6, 0.6, 0.62], 4);
  cyl(0.06, 0.06, 0.008, 0.3, 1.125, 0.44, [0.55, 0.55, 0.57], { seg: 10 });
  for (let k = 0; k < 6; k++) box(0.28, 0.006, 0.2, -0.05 + (rnd() - 0.5)*0.01, 0.85 + k*0.007, 0.32, jit([0.82, 0.8, 0.72], 0.04), { ry: (rnd() - 0.5)*0.15 });
  // the pole the game had, a second one, and the awning on them
  rod([0.85, 0.8, 0.4], [0.85, 2.2, 0.4], 0.035, [0.4, 0.4, 0.4]);
  rod([0.85, 0.8, -0.2], [0.85, 2.15, -0.2], 0.03, [0.4, 0.4, 0.4]);
  rod([0.1, 2.15, 0.6], [1.1, 2.15, 0.6], 0.012, [0.35, 0.35, 0.36], 4);
  rod([0.1, 2.15, -0.2], [1.1, 2.15, -0.2], 0.012, [0.35, 0.35, 0.36], 4);
  cloth(1.0, 0.8, 0.6, 2.2, 0.2, [0.9, 0.3, 0.1], { sag: 0.05, stripes: 4, cols: [[0.9, 0.3, 0.1], [0.92, 0.72, 0.15]], nx: 2, nz: 3, slope: 0.08 });
  bulb(0.6, 2.14, 0.25, 0.2);
  return finish();
}

function fruits() {
  start(89);
  cart(2.0, 1.0, [0.45, 0.32, 0.2], 0.3, 0.5, 0.8);
  for (let k = 0; k < 7; k++) box(1.96, 0.012, 0.13, 0, 0.826, -0.42 + k*0.14, jit([0.5, 0.36, 0.22], 0.12));
  // a sack laid on the deck under the fruit
  sheet(8, 4, (u, v) => [-0.95 + u*1.9, 0.846 + Math.sin(u*25)*Math.sin(v*18)*0.003, -0.42 + v*0.84], [0.68, 0.56, 0.36]);
  const fruit = [[0.9, 0.55, 0.05], [0.85, 0.12, 0.1], [0.35, 0.65, 0.15], [0.95, 0.8, 0.15]];
  // the game's pile, each kind its own shape: oranges with a dimple, apples with a stalk, guavas, mangoes
  const sph = new THREE.IcosahedronGeometry(0.075, 1);
  for (let layer = 0; layer < 3; layer++) {
    const nx = 7 - layer*2, nz = 3 - layer;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const kind = Math.floor(i/Math.max(1, nx/4)) % 4, x = -0.75 + layer*0.11 + i*0.22 + (rnd() - 0.5)*0.015, y = 0.95 + layer*0.15, z = -0.3 + layer*0.11 + j*0.22 + (rnd() - 0.5)*0.015;
      const c = jit(fruit[kind], 0.09), s = kind === 3 ? [1.25, 1.65, 1.2] : kind === 2 ? [1.3, 1.18, 1.3] : kind === 1 ? [1.34, 1.24, 1.34] : [1.4, 1.34, 1.4];
      put(sph, x, y, z, c, { sx: s[0], sy: s[1], sz: s[2], ry: rnd()*6.28, rx: (rnd() - 0.5)*0.5 });
      if (layer === 2 || j === nz - 1 || nz === 1) { if (kind === 1) rod([x, y + 0.09, z], [x + 0.01, y + 0.125, z], 0.004, [0.3, 0.2, 0.1], 3); if (kind === 0) ball(0.012, x, y + 0.1, z, [0.3, 0.42, 0.12], { det: 0 }); }
    }
  }
  // a frame over the cart, hanging bananas from it, and the hand scale
  for (const [x, z] of [[-0.95, -0.46], [0.95, -0.46], [-0.95, 0.46], [0.95, 0.46]]) rod([x, 0.84, z], [x, 1.98, z], 0.016, [0.35, 0.35, 0.37], 5);
  for (const z of [-0.46, 0.46]) rod([-0.95, 1.98, z], [0.95, 1.98, z], 0.012, [0.35, 0.35, 0.37], 5);
  for (const x of [-0.95, 0, 0.95]) rod([x, 1.98, -0.46], [x, 1.98, 0.46], 0.012, [0.35, 0.35, 0.37], 5);
  cloth(2.15, 1.2, 0, 2.03, 0, [0.15, 0.42, 0.72], { sag: 0.07, nx: 6, nz: 3, slope: 0.04 });
  for (const x of [-0.72, -0.28]) {
    rod([x, 1.98, 0.46], [x, 1.72, 0.46], 0.009, [0.5, 0.42, 0.2], 4);
    for (let tier = 0; tier < 4; tier++) for (let k = 0; k < 7; k++) {
      const a = k/7*6.28, y = 1.65 - tier*0.1, r = 0.05 + tier*0.004, nx = Math.cos(a), nz = Math.sin(a);
      tube([[x + nx*r, y + 0.08, 0.46 + nz*r], [x + nx*(r + 0.05), y, 0.46 + nz*(r + 0.05)], [x + nx*(r + 0.04), y - 0.08, 0.46 + nz*(r + 0.04)]], 0.016, jit([0.93, 0.8, 0.2], 0.06), 5, 3);
    }
  }
  const sx = 0.55, sy = 1.55, sz = 0.46;
  rod([sx, 1.98, sz], [sx, sy + 0.08, sz], 0.004, [0.8, 0.7, 0.3], 3);
  box(0.46, 0.012, 0.012, sx, sy + 0.08, sz, [0.55, 0.42, 0.14]);
  for (const s of [-1, 1]) {
    for (const [a, c] of [[0.06, 0], [-0.03, 0.05], [-0.03, -0.05]]) rod([sx + s*0.22, sy + 0.08, sz], [sx + s*0.22 + a, sy - 0.14, sz + c], 0.002, [0.2, 0.2, 0.2], 3);
    lathe([[0, 0], [0.07, 0.008], [0.09, 0.03], [0.085, 0.032], [0, 0.012]], sx + s*0.22, sy - 0.16, sz, [0.72, 0.62, 0.3], { seg: 10 });
  }
  // the crates waiting underneath
  for (const [x, z, c] of [[-0.32, 0.05, [0.2, 0.42, 0.7]], [0.34, -0.06, [0.8, 0.3, 0.12]]]) {
    box(0.48, 0.015, 0.34, x, 0.08, z, c);
    for (const s of [-1, 1]) for (const y of [0.13, 0.2, 0.27]) { box(0.48, 0.03, 0.012, x, y, z + s*0.17, c); box(0.012, 0.03, 0.34, x + s*0.24, y, z, c); }
    for (let k = 0; k < 5; k++) ball(0.06, x - 0.14 + k*0.07, 0.3, z + (k % 2 ? 0.05 : -0.05), fruit[(k + (x > 0 ? 2 : 0)) % 4], { det: 1 });
  }
  poleBulb(0.93, -0.44, 0.85, 1.95, -0.4);
  return finish();
}

function flowers() {
  start(97);
  const HEAP = [[1, 0.6, 0.05], [0.95, 0.95, 0.9], [0.9, 0.15, 0.3], [1, 0.8, 0.1]];
  // a plank table on crates under the baskets, banana leaves on it
  box(1.72, 0.03, 1.28, -0.1, 0.205, 0.15, [0.42, 0.32, 0.2]);
  for (const [x, z] of [[-0.82, -0.32], [0.62, -0.32], [-0.82, 0.62], [0.62, 0.62]]) box(0.07, 0.19, 0.07, x, 0.095, z, [0.3, 0.22, 0.14]);
  for (let k = 0; k < 4; k++) sheet(4, 2, (u, v) => [-0.9 + k*0.38 + u*0.6, 0.224 + Math.sin(v*3.14)*0.006, -0.42 + v*1.14], jit([0.2, 0.46, 0.14], 0.14));
  for (let k = 0; k < 4; k++) {
    const x = -0.6 + (k % 2)*1.0, z = k > 1 ? 0.5 : -0.2;
    // a woven basket: bands round it and a rim, a dome of heads
    lathe([[0, 0], [0.25, 0], [0.35, 0.25], [0.37, 0.27], [0.34, 0.27], [0, 0.24]], x, 0.225, z, [0.65, 0.5, 0.3], { seg: 14 });
    for (const t of [0.06, 0.13, 0.2]) ring(0.25 + t*0.4, 0.008, x, 0.225 + t, z, [0.55, 0.4, 0.22], { rx: Math.PI/2, seg: 14, tseg: 3 });
    ring(0.355, 0.016, x, 0.49, z, [0.56, 0.42, 0.24], { rx: Math.PI/2, seg: 16, tseg: 4 });
    put(new THREE.SphereGeometry(0.3, 10, 5, 0, 6.29, 0, 1.4), x, 0.45, z, [HEAP[k][0]*0.72, HEAP[k][1]*0.72, HEAP[k][2]*0.72]);
    for (let f = 0; f < 70; f++) {
      const a = f*2.399963, t = (f + 0.5)/70, polar = t*1.34, px = Math.sin(polar)*Math.cos(a)*0.31, py = Math.cos(polar)*0.31, pz = Math.sin(polar)*Math.sin(a)*0.31;
      ball(0.027, x + px, 0.45 + py, z + pz, jit(HEAP[k], 0.13), { det: 0, ry: a, sy: 0.72 });
    }
  }
  // the canopy on its bamboo, lashed at the top, weighed down at the foot, rope to the corners
  for (const [x, z] of [[-0.85, -0.6], [0.85, -0.6], [-0.85, 0.9], [0.85, 0.9]]) {
    bamboo(x, 0, z, x, 2.0, z, 0.03, [0.5, 0.4, 0.3]);
    lash(x, 1.92, z, 0.036);
    cyl(0.1, 0.12, 0.12, x, 0.06, z, [0.42, 0.4, 0.37], { seg: 7 });
  }
  for (const x of [-0.85, 0.85]) bamboo(x, 1.93, -0.6, x, 1.93, 0.9, 0.022, [0.55, 0.45, 0.32]);
  for (const z of [-0.6, 0.9]) bamboo(-0.85, 1.93, z, 0.85, 1.93, z, 0.022, [0.55, 0.45, 0.32]);
  cloth(1.8, 1.6, 0, 2.0, 0.15, [0.2, 0.4, 0.75], { sag: 0.08, drape: 0.14, nx: 6, nz: 7 });
  // garlands in strings: marigold with a white jasmine knot every so often
  for (let g = 0; g < 7; g++) {
    const x = -0.72 + g*0.24, L = 0.6 + (g % 3)*0.12;
    rod([x, 1.92, 0.9], [x, 1.92 - L, 0.9], 0.003, [0.3, 0.5, 0.2], 3);
    for (let k = 0; k < 12; k++) ball(0.021, x + (k % 2 ? 0.006 : -0.006), 1.9 - k/12*L, 0.9, k % 5 === 4 ? [0.96, 0.95, 0.88] : g % 3 === 1 ? [0.92, 0.2, 0.25] : [1, 0.6, 0.05], { det: 0 });
  }
  // the bits he sells them with: a stack of leaf cones, a thread reel, a stool
  for (let k = 0; k < 5; k++) put(new THREE.ConeGeometry(0.03, 0.14, 7), 0.72, 0.36 + k*0.018, -0.28, [0.28, 0.5, 0.2], { rz: 1.5 });
  cyl(0.035, 0.035, 0.05, 0.72, 0.25, -0.05, [0.9, 0.88, 0.82], { seg: 8 });
  cyl(0.15, 0.13, 0.03, 0.55, 0.3, -0.75, [0.8, 0.3, 0.15], { seg: 12 });
  for (let k = 0; k < 4; k++) { const a = k*1.57 + 0.8; rod([0.55 + Math.cos(a)*0.1, 0.29, -0.75 + Math.sin(a)*0.1], [0.55 + Math.cos(a)*0.13, 0, -0.75 + Math.sin(a)*0.13], 0.012, [0.8, 0.3, 0.15], 4); }
  bulb(0, 1.98, 0.2, 0.22);
  return finish();
}

function ganna() {
  start(101);
  const G = [0.15, 0.55, 0.3], TR = [0.95, 0.88, 0.55];
  // the cart: the game's box on real wheels, painted panels with their trim
  box(1.8, 0.9, 1.0, 0, 0.75, 0, G);
  for (const s of [-1, 1]) {
    box(1.82, 0.03, 0.012, 0, 1.13, s*0.505, TR); box(1.82, 0.03, 0.012, 0, 0.37, s*0.505, TR);
    for (const x of [-0.6, 0, 0.6]) { box(0.52, 0.56, 0.006, x, 0.75, s*0.505, [0.1, 0.45, 0.25]); box(0.42, 0.46, 0.008, x, 0.75, s*0.507, [0.92, 0.82, 0.3]); box(0.36, 0.4, 0.01, x, 0.75, s*0.509, [0.85, 0.2, 0.15]); }
  }
  box(1.86, 0.03, 1.06, 0, 1.21, 0, STEEL);
  for (const s of [-1, 1]) { box(0.006, 0.56, 0.72, s*0.903, 0.75, 0, [0.1, 0.45, 0.25]); box(0.008, 0.46, 0.62, s*0.905, 0.75, 0, [0.92, 0.82, 0.3]); box(0.01, 0.4, 0.56, s*0.907, 0.75, 0, [0.85, 0.2, 0.15]); }
  for (const x of [-0.72, 0.72]) { for (const z of [-0.42, 0.42]) wheel(x, 0.22, z + Math.sign(z)*0.12, 0.22, BLACK, 6); box(0.05, 0.14, 0.9, x, 0.27, 0, DARKST); }
  // the crusher: its iron frame, two toothed rollers on show, gears on top, the tray and spout under
  const IR = [0.75, 0.75, 0.8], DK = [0.3, 0.32, 0.34];
  rbox(0.6, 0.6, 0.5, 0.4, 1.5, 0, IR, {}, 0.03);
  box(0.42, 0.3, 0.02, 0.4, 1.56, -0.26, [0.16, 0.16, 0.17]);
  for (const x of [0.28, 0.5]) { cyl(0.1, 0.1, 0.03, x, 1.56, -0.272, [0.58, 0.58, 0.62], { rx: Math.PI/2, seg: 14 }); for (let k = 0; k < 8; k++) { const a = k*0.785; box(0.008, 0.2, 0.012, x, 1.56, -0.285, [0.4, 0.4, 0.44], { rz: a }); } }
  box(0.66, 0.05, 0.56, 0.4, 1.81, 0, DK);
  for (const x of [0.25, 0.55]) { cyl(0.12, 0.12, 0.04, x, 1.85, 0, [0.42, 0.42, 0.46], { seg: 14 }); cyl(0.03, 0.03, 0.06, x, 1.89, 0, DK, { seg: 8 }); for (let k = 0; k < 14; k++) { const a = k/14*6.2832; box(0.02, 0.04, 0.016, x + Math.cos(a)*0.125, 1.85, Math.sin(a)*0.125, DK, { ry: -a }); } }
  for (const [x, z] of [[0.14, -0.22], [0.66, -0.22], [0.14, 0.22], [0.66, 0.22]]) cyl(0.018, 0.018, 0.02, x, 1.843, z, [0.6, 0.6, 0.62], { seg: 6 });
  box(0.7, 0.03, 0.56, 0.4, 1.235, 0, DARKST);
  box(0.26, 0.015, 0.32, 0.4, 1.27, -0.32, [0.6, 0.6, 0.63], { rx: -0.2 });
  for (const x of [0.25, 0.55]) box(0.012, 0.09, 0.32, x, 1.3, -0.32, [0.55, 0.55, 0.58], { rx: -0.2 });
  // the flywheel you can hear from the next street: rim, spokes, a crank, a string of bells that shakes with it
  const fx = 0.4, fy = 1.5, fz = 0.3;
  ring(0.32, 0.03, fx, fy, fz, [0.2, 0.2, 0.2], { seg: 24, tseg: 7 });
  cyl(0.06, 0.06, 0.09, fx, fy, fz, [0.3, 0.3, 0.32], { rx: Math.PI/2, seg: 10 });
  cyl(0.024, 0.024, 0.12, fx, fy, fz - 0.08, DK, { rx: Math.PI/2, seg: 8 });
  for (let k = 0; k < 6; k++) { const a = k*1.0472; box(0.3, 0.03, 0.016, fx + Math.cos(a)*0.17, fy + Math.sin(a)*0.17, fz, [0.18, 0.18, 0.18], { rz: a }); }
  rod([fx + 0.26, fy + 0.15, fz + 0.03], [fx + 0.26, fy + 0.15, fz + 0.22], 0.018, [0.2, 0.2, 0.2], 6);
  for (let k = 0; k < 18; k++) { const a = k/18*6.2832; ball(0.014, fx + Math.cos(a)*0.28, fy + Math.sin(a)*0.28, fz + 0.03, k % 3 ? [0.82, 0.68, 0.22] : [0.85, 0.2, 0.15], { det: 0 }); }
  for (let k = 0; k < 12; k++) { const a = k/12*6.2832; ball(0.008, fx + Math.cos(a)*0.145, fy + Math.sin(a)*0.145, fz + 0.015, [0.82, 0.68, 0.22], { det: 0 }); }
  // the canes the game had, thicker as a bundle now, jointed, with their leaves on, tied upright to a post
  rod([-0.66, 0.5, -0.4], [-0.66, 2.0, -0.4], 0.02, DARKST, 5);
  for (let k = 0; k < 16; k++) {
    const a = k*2.399963, rr = 0.03 + Math.sqrt(k/16)*0.16, x = -0.45 + Math.cos(a)*rr, z = -0.3 + Math.sin(a)*rr, top = 2.35 + rnd()*0.3, lean = (rnd() - 0.5)*0.08;
    const C = jit([0.55, 0.65, 0.25], 0.14);
    rod([x + 0.0, 1.22, z], [x + lean - 0.05, top, z - 0.04], 0.022, C, 5);
    for (let n = 1; n < 6; n++) { const t = n/6; if (k < 8) ring(0.022, 0.005, x + (lean - 0.05)*t, 1.22 + (top - 1.22)*t, z - 0.04*t, [0.42, 0.42, 0.18], { rx: Math.PI/2, seg: 7, tseg: 3 }); }
    if (k % 3 === 0) { const lx = x + lean - 0.05, lz = z - 0.04, d = rnd()*6.28; sheet(1, 4, (u, v) => { const w = (u - 0.5)*0.04*(1 - v*0.8), o = v*0.4; return [lx + Math.cos(d)*o + Math.sin(d)*w, top + Math.sin(v*2.4)*0.16 - v*v*0.2, lz + Math.sin(d)*o - Math.cos(d)*w]; }, [0.3, 0.55, 0.16]); }
  }
  for (const y of [1.5, 1.95]) ring(0.2, 0.012, -0.47, y, -0.3, ROPE, { rx: Math.PI/2, seg: 12, tseg: 3 });
  // on top: the jug, the strainer, the glasses, a blue ice box, lemons and a block of ginger
  lathe([[0, 0], [0.08, 0], [0.095, 0.18], [0.11, 0.21], [0, 0.18]], -0.25, 1.225, 0.28, [0.7, 0.7, 0.73], { seg: 12 });
  cyl(0.08, 0.08, 0.004, -0.25, 1.4, 0.28, [0.7, 0.72, 0.28], { seg: 10 });
  ring(0.055, 0.008, -0.14, 1.32, 0.28, [0.6, 0.6, 0.63], { seg: 10, tseg: 3 });
  for (let k = 0; k < 6; k++) glassTumbler(-0.62 + (k % 3)*0.1, 1.225, 0.14 + Math.floor(k/3)*0.1, k < 2 ? [0.68, 0.78, 0.28] : null);
  rbox(0.34, 0.2, 0.26, -0.72, 1.33, 0.32, [0.15, 0.35, 0.72], {}, 0.02);
  box(0.36, 0.03, 0.28, -0.72, 1.44, 0.32, [0.82, 0.84, 0.86]);
  for (let k = 0; k < 7; k++) ball(0.024, 0.07 + (k % 4)*0.05, 1.25 + (k > 3 ? 0.035 : 0), 0.42 + (k > 3 ? -0.02 : 0), [0.75, 0.82, 0.22], { det: 0 });
  // the poles and the cloth over it all
  for (const [x, z] of [[-0.86, -0.46], [0.86, -0.46], [-0.86, 0.46], [0.86, 0.46]]) rod([x, 1.22, z], [x, 2.52, z], 0.018, [0.38, 0.38, 0.4], 5);
  for (const z of [-0.46, 0.46]) rod([-0.86, 2.52, z], [0.86, 2.52, z], 0.012, [0.38, 0.38, 0.4], 4);
  cloth(1.95, 1.16, 0, 2.56, 0, [0.9, 0.82, 0.3], { sag: 0.06, stripes: 6, cols: [[0.92, 0.82, 0.3], [0.2, 0.55, 0.32]], nx: 2, nz: 3, slope: 0.05 });
  poleBulb(-0.85, -0.45, 1.2, 2.1, 0.38);
  return finish();
}

// ---------------------------------------------------------------- boards
function streetBoard() {
  start(107);
  // the posts stand behind the board now, not through the name. The name's quad is on z 0, at the game's height
  for (const o of [-1.15, 1.15]) {
    cyl(0.04, 0.04, 2.9, o, 1.45, -0.11, [0.35, 0.35, 0.35], { seg: 8 });
    ball(0.05, o, 2.91, -0.11, [0.3, 0.3, 0.3], { sy: 0.8 });
    cyl(0.085, 0.1, 0.1, o, 0.05, -0.11, [0.55, 0.54, 0.5], { seg: 8 });
    for (let k = 0; k < 2; k++) { box(0.12, 0.03, 0.09, o, 2.15 + k*0.47, -0.065, [0.22, 0.22, 0.23]); }
    for (let k = 0; k < 9; k++) cyl(0.043, 0.043, 0.2, o, 0.2 + k*0.2, -0.11, k % 2 ? [0.1, 0.1, 0.1] : [0.88, 0.86, 0.8], { seg: 8, open: true });
  }
  box(2.5, 0.68, 0.03, 0, 2.4, -0.03, [0.1, 0.25, 0.5]);
  for (const y of [2.06, 2.74]) box(2.54, 0.03, 0.05, 0, y, -0.025, [0.72, 0.72, 0.74]);
  for (const x of [-1.26, 1.26]) box(0.03, 0.71, 0.05, x, 2.4, -0.025, [0.72, 0.72, 0.74]);
  for (const x of [-1.05, 0, 1.05]) box(0.02, 0.68, 0.02, x, 2.4, -0.055, [0.3, 0.3, 0.32]);
  return finish();
}

function bannerFrame() {
  start(109);
  // bamboo with its joints, rails lashed on behind the banner, a brace and a stone at each foot
  for (const o of [-1.7, 1.7]) {
    bamboo(o, 0, 0, o, 3.2, 0, 0.045);
    for (const y of [2.76, 1.74]) lash(o, y, 0, 0.056);
    cyl(0.2, 0.26, 0.2, o, 0.09, 0, [0.46, 0.44, 0.4], { seg: 6 });
    ball(0.11, o + 0.2, 0.08, 0.08, [0.5, 0.48, 0.44], { det: 0, sy: 0.7 });
    bamboo(o, 1.65, -0.03, o*0.97, 0, -0.75, 0.024);
    lash(o, 1.65, -0.02, 0.04);
    ball(0.13, o*0.97, 0.06, -0.75, [0.46, 0.44, 0.4], { det: 0, sy: 0.65 });
  }
  for (const y of [2.76, 1.74]) bamboo(-1.78, y, -0.05, 1.78, y, -0.05, 0.025);
  // the rope pulled across at the top where the banner is tied
  rod([-1.7, 2.82, 0.0], [1.7, 2.82, 0.0], 0.005, ROPE, 3);
  rod([-1.7, 1.82, 0.0], [1.7, 1.82, 0.0], 0.005, ROPE, 3);
  return finish();
}

// the same model with nothing lit
function unlit(g) { const c = g.clone(); if (c.attributes.glow) { c.setAttribute('glow', c.attributes.glow.clone()); c.attributes.glow.array.fill(0); } return c; }
export function buildProto() {
  const P = gameProto();
  P.stallFar = [P.stall0, P.stall1, P.stall2, P.stall3, P.stall4, P.stall5];
  P.lamp = lamp();
  P.lampDead = unlit(P.lamp);       // (shot out, or down in the road: world/smash.js)
  P.pole = pole();
  P.signal = signal();
  P.bus = shelter();
  P.stall0 = tapri();
  P.stall1 = paan();
  P.stall2 = vadapav();
  P.stall3 = fruits();
  P.stall4 = flowers();
  P.stall5 = ganna();
  P.streetBoard = streetBoard();
  P.bannerFrame = bannerFrame();
  return P;
}

// Stalls as instances, in two sets for each kind: the full model close to, the game's simple one further out, to the edge of
// what's built. Their shadows go in the still map with the lamps, poles and signals, so none of it redraws every frame.
export function stallSets(W) {
  const P = W.proto, mat = W.mats.propI, cast = W.quality.shadows, seen = new Set(), near = [], far = [];
  P.stallFar.forEach((low, k) => {
    const n = new InstancedSet(W.scene, P['stall' + k], mat, 300, 60, { cast }), f = new InstancedSet(W.scene, low, mat, 1500, 9999, { cast, minRange: 60 });
    f.update = function (cx, cz, fr) { this.range = W.streamer ? W.streamer.keep : 9999; InstancedSet.prototype.update.call(this, cx, cz, fr); };
    near.push(n); far.push(f); W.instSets.push(n, f);
    n.mesh.shadowStill = f.mesh.shadowStill = true;
    P['stall' + k].userData.lod = (m) => {      // (a chunk can be built again after it's been let go)
      const e = m.elements, id = Math.round(e[12]*10) + ',' + Math.round(e[14]*10);
      if (seen.has(id)) return;
      seen.add(id);
      smash(W).reg('stall' + k, e[12], e[14], Math.atan2(e[8], e[0]), { items: [[n, n.add(e[12], e[14], m)], [f, f.add(e[12], e[14], m)]] });
      W._propX = undefined;
    };
  });
  for (const s of [W.lampSet, W.poleSet, W.sigSet]) s.mesh.shadowStill = true;
  W.stallNear = (d) => { for (const s of near) s.range = d; for (const s of far) s.minRange = d; W._propX = undefined; };
}

// ---------------------------------------------------------------- the footpath's own (world/footpath.js says where)
// A fruit seller's handcart: planks on two rails, two cycle wheels under the middle and two legs at the handle end,
// its fruit heaped on it. A cobbler's pitch: his wooden box with its lid up and the tools in it, the iron last, a low
// stool, a tarpaulin on the paving with the shoes laid out on it. And an umbrella over either: a pole and eight panels
// of cloth on their ribs, its foot in a bucket of stones (or tied to the cart). Each its own model, local to where it
// stands (x along the kerb, z into the footpath), made once for each of a few looks
const UMB = [[0.16, 0.35, 0.72], [0.85, 0.23, 0.16], [0.95, 0.76, 0.19], [0.18, 0.54, 0.35], [0.1, 0.1, 0.12]];
const FRUIT = [[[0.95, 0.6, 0.1], [0.92, 0.52, 0.08]], [[0.8, 0.12, 0.1], [0.62, 0.1, 0.1]], [[0.95, 0.82, 0.2], [0.9, 0.75, 0.15]], [[0.4, 0.62, 0.15], [0.32, 0.55, 0.12]], [[0.45, 0.2, 0.35], [0.35, 0.15, 0.3]]];
const VG = new Map();
export function vendorGeo(kind, v) {
  const key = kind + ':' + v; let g = VG.get(key);
  if (!g) { g = kind === 'cart' ? handcart(v) : kind === 'cob' ? cobbler(v) : umbrella(v, kind === 'umbS'); g.userData.shared = true; VG.set(key, g); }
  return g;
}
function handcart(v) {
  start(301 + v*17);
  const deck = jit([0.42, 0.29, 0.18], 0.1), dk = [deck[0]*0.7, deck[1]*0.7, deck[2]*0.7];
  for (let k = 0; k < 6; k++) box(1.8, 0.03, 0.145, 0, 0.72, -0.375 + k*0.15, jit(deck, 0.12));
  for (const s of [-1, 1]) { box(1.84, 0.08, 0.03, 0, 0.77, s*0.455, dk); box(1.7, 0.06, 0.05, 0, 0.675, s*0.36, DARKST); }
  for (const s of [-1, 1]) box(0.03, 0.08, 0.94, s*0.92, 0.77, 0, dk);
  // the wheels on their axle, and the stand
  rod([0.1, 0.33, -0.5], [0.1, 0.33, 0.5], 0.015, DARKST);
  for (const z of [-0.5, 0.5]) { wheel(0.1, 0.33, z, 0.33); box(0.05, 0.32, 0.04, 0.1, 0.5, z*0.8, DARKST); }
  for (const z of [-0.34, 0.34]) box(0.04, 0.66, 0.04, -0.82, 0.33, z, DARKST);
  for (const z of [-0.36, 0.36]) tube([[-0.9, 0.7, z], [-1.2, 0.74, z], [-1.38, 0.86, z]], 0.016, [0.28, 0.28, 0.3], 5, 6);
  rod([-1.38, 0.86, -0.38], [-1.38, 0.86, 0.38], 0.018, [0.2, 0.2, 0.22]);
  // a sack laid under the fruit, and the fruit heaped up in the middle, the odd one rolled to the edge
  sheet(8, 4, (u, w) => [-0.85 + u*1.7, 0.74 + Math.sin(u*25)*Math.sin(w*18)*0.003, -0.4 + w*0.8], [0.66, 0.55, 0.36]);
  const C = FRUIT[v % FRUIT.length], R0 = 0.05;
  for (let l = 0; l < 4; l++) {
    const nx = 13 - l*3, nz = 6 - l, y = 0.745 + R0 + l*R0*1.55;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (rnd() < 0.12 + l*0.1) continue;
      const x = (i - (nx - 1)/2)*R0*2.15 + (rnd() - 0.5)*0.02, z = (j - (nz - 1)/2)*R0*2.15 + (l % 2)*R0*0.5 + (rnd() - 0.5)*0.02;
      ball(R0*(0.85 + rnd()*0.25), x, y, z, jit(C[(i + j) % 2], 0.1), { det: 1 });
    }
  }
  // the scale hanging off the handle end, and a bowl of the weights
  rod([-0.85, 0.79, 0], [-0.85, 1.1, 0], 0.006, ROPE, 3);
  cyl(0.11, 0.09, 0.03, -0.85, 0.95, 0, [0.7, 0.68, 0.62], { seg: 12 });
  return finish();
}
function cobbler(v) {
  start(401 + v*13);
  const W0 = jit([0.36, 0.23, 0.14], 0.1);
  // the box: four sides, a shelf, its lid propped up behind; awls, a hammer and the thread in it
  box(0.6, 0.38, 0.02, 0, 0.2, 0.19, W0); box(0.6, 0.38, 0.02, 0, 0.2, -0.19, W0); box(0.02, 0.38, 0.36, 0.29, 0.2, 0, W0); box(0.02, 0.38, 0.36, -0.29, 0.2, 0, W0);
  box(0.58, 0.02, 0.36, 0, 0.02, 0, [0.3, 0.2, 0.12]); box(0.56, 0.015, 0.34, 0, 0.3, 0, [0.32, 0.22, 0.13]);
  box(0.6, 0.02, 0.38, 0, 0.55, -0.32, W0, { rx: -1.2 });
  for (let k = 0; k < 4; k++) { cyl(0.012, 0.012, 0.09, -0.2 + k*0.05, 0.36, 0.05, [0.6, 0.45, 0.25], { seg: 6 }); cyl(0.003, 0.003, 0.06, -0.2 + k*0.05, 0.43, 0.05, [0.7, 0.7, 0.72], { seg: 4 }); }
  cyl(0.02, 0.02, 0.02, 0.15, 0.33, -0.05, [0.85, 0.82, 0.7], { seg: 8 });
  rbox(0.18, 0.03, 0.03, 0.12, 0.33, 0.08, [0.25, 0.18, 0.12], {}, 0.01); box(0.03, 0.04, 0.05, 0.2, 0.33, 0.08, [0.3, 0.3, 0.32]);
  // the iron last on the paving, polish tins, a brush
  cyl(0.03, 0.04, 0.22, 0.45, 0.11, 0.25, [0.18, 0.18, 0.2], { seg: 8 }); rbox(0.18, 0.05, 0.07, 0.48, 0.245, 0.25, [0.2, 0.2, 0.22], {}, 0.02);
  for (let k = 0; k < 3; k++) cyl(0.035, 0.035, 0.025, 0.4 + k*0.08, 0.0125, -0.05, [[0.12, 0.1, 0.08], [0.45, 0.25, 0.1], [0.75, 0.7, 0.6]][k], { seg: 10 });
  rbox(0.14, 0.04, 0.06, 0.62, 0.02, 0.05, [0.5, 0.35, 0.18], {}, 0.015);
  // his stool
  box(0.32, 0.03, 0.28, 0, 0.24, 0.6, [0.32, 0.32, 0.34]); for (const [x, z] of [[-0.13, 0.48], [0.13, 0.48], [-0.13, 0.72], [0.13, 0.72]]) box(0.025, 0.23, 0.025, x, 0.115, z, [0.22, 0.22, 0.24]);
  // the tarpaulin and the shoes on it, toes to the road
  sheet(6, 4, (u, w) => [-0.9 + u*1.8, 0.004 + Math.sin(u*14 + w*9)*0.003, -0.4 + w*1.3], [0.16, 0.33, 0.68]);
  for (let i = 0; i < 6; i++) {
    const x = -0.75 + i*0.28, c = [[0.1, 0.08, 0.07], [0.35, 0.2, 0.1], [0.55, 0.35, 0.18], [0.1, 0.08, 0.07], [0.6, 0.15, 0.12], [0.25, 0.25, 0.28]][(i + v) % 6];
    for (const s of [-0.055, 0.055]) { rbox(0.09, 0.07, 0.25, x + s, 0.04, -0.28, c, {}, 0.03); box(0.095, 0.015, 0.26, x + s, 0.012, -0.28, [0.12, 0.1, 0.08]); }
  }
  return finish();
}
// the umbrella: its pole down to y = 0 (in a bucket of stones on the paving, or, on a cart, from the deck)
function umbrella(v, standing) {
  start(501 + v*7);
  const c = UMB[v % UMB.length], h = standing ? 2.05 : 1.85, y0 = standing ? 0.26 : 0, R = 1.1, n = 8;
  if (standing) { cyl(0.13, 0.11, 0.26, 0, 0.13, 0, [0.35, 0.36, 0.38], { seg: 12, open: true }); cyl(0.12, 0.12, 0.01, 0, 0.22, 0, [0.5, 0.48, 0.44], { seg: 12 }); }
  rod([0, y0 - (standing ? 0.2 : 0), 0], [0, h + 0.05, 0], 0.018, [0.3, 0.3, 0.32], 6);
  // the canopy: eight panels sagging a little between the ribs, the ribs under them
  sheet(n*2, 4, (u, w) => { const a = u*6.2832, r = w*R, sag = Math.sin(u*n*Math.PI)**2*0.04*w; return [Math.cos(a)*r, h + 0.05 - w*0.38 - sag + w*w*0.05, Math.sin(a)*r]; }, jit(c, 0.05));
  for (let k = 0; k < n; k++) { const a = k/n*6.2832; rod([0, h + 0.04, 0], [Math.cos(a)*R, h + 0.05 - 0.33, Math.sin(a)*R], 0.005, [0.25, 0.25, 0.27], 3); rod([0, h - 0.5, 0], [Math.cos(a)*R*0.45, h - 0.12, Math.sin(a)*R*0.45], 0.004, [0.25, 0.25, 0.27], 3); }
  cyl(0.02, 0.012, 0.06, 0, h + 0.09, 0, [0.2, 0.2, 0.22], { seg: 6 });
  return finish();
}
