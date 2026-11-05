// Potholes you can see into, and the rubbish round a stall in pieces, not a stain. A pothole was a dark picture laid on
// the road (a brown blob a metre and a half across), and the rubbish was a scatter of coloured squares printed flat.
// Now a pothole is a hole: a ragged outline, walls dropping through the tar's black top layer into the brown base course
// under it, a bottom of dirt and loose stones, the broken edge crumbled a shade lighter, a few cracks running off it
// and bits of the aggregate thrown out onto the road round it. It's sunk into the road for real: the road is drawn
// first, then a lid over the hole clears the depth inside its outline (only where the road is what's showing there,
// so a car or a person in front of it stays in front), and the hole is drawn into the gap. Its size and depth are the
// ones the wheels feel (beta/vehicles/potholes.js asks potDepth). The rubbish by a stall: chai cups, a crushed bottle,
// carry bags, wrappers, a sheet of newspaper, peel, each its own shape and colour, lying where it was dropped.
import * as THREE from 'three';
import { RNG } from '@orig/core/util.js';

const frac = (x) => x - Math.floor(x);
// a pothole's shape, the same for whoever asks (the drawing and the wheels): how big, how deep, how ragged
export function potShape(p) {
  if (p._s) return p._s;
  const seed = Math.floor(p.x*7.31) * 7919 + Math.floor(p.z*13.7), r = (k) => frac(Math.sin(seed*0.0137 + k*12.9898)*43758.5453);
  const R = (p.rr || 0.55)*0.68;                       // 0.24..0.55 m across the middle: a wheel's worth, not a crater
  const dep = Math.min(0.11, 0.035 + r(1)*0.045 + (R - 0.24)*0.09);
  const harm = [2, 3, 4, 5, 7].map((n, i) => [n, (0.085 - i*0.011)*(0.45 + r(10 + i)), r(20 + i)*6.283]);
  return (p._s = { R, dep, harm, r, ca: Math.cos(p.ang || 0), sa: Math.sin(p.ang || 0), sq: p.sq || 1 });
}
const edge = (s, a) => { let k = 1; for (const [n, A, ph] of s.harm) k += A*Math.sin(n*a + ph); return s.R*k; };
// where (x, z) is in it: [how far in from the edge (m), the edge's radius there] or null outside
export function potWhere(p, x, z) {
  const s = potShape(p), dx = x - p.x, dz = z - p.z;
  if (dx*dx + dz*dz > s.R*s.R*1.8) return null;
  const lx = dx*s.ca + dz*s.sa, lz = (-dx*s.sa + dz*s.ca)/s.sq, rho = Math.hypot(lx, lz), e = edge(s, Math.atan2(lz, lx));
  return rho < e ? [e - rho, e] : null;
}
const at = (s, p, a, rad, out) => { const lx = Math.cos(a)*rad, lz = Math.sin(a)*rad*s.sq; out[0] = p.x + lx*s.ca - lz*s.sa; out[1] = p.z + lx*s.sa + lz*s.ca; return out; };

class Geo {
  constructor() { this.p = []; this.c = []; this.n = []; this.i = []; }
  v(x, y, z, c, n) { this.p.push(x, y, z); this.c.push(c[0], c[1], c[2]); this.n.push(n ? n[0] : 0, n ? n[1] : 1, n ? n[2] : 0); return this.p.length/3 - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  // a flat-shaded face (stones, litter)
  face(A, B, C, col) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const N = [nx, ny, nz]; this.tri(this.v(...A, col, N), this.v(...B, col, N), this.v(...C, col, N));
  }
  build(smooth) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setIndex(this.i);
    if (smooth) g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
const tint = (c, k) => [c[0]*k, c[1]*k, c[2]*k];
// a stone: a squashed, skewed octahedron
function stone(G, x, y, z, s, rng, col) {
  const a = rng.range(0, 6.28), ca = Math.cos(a), sa = Math.sin(a), sx = s*rng.range(0.7, 1.3), sy = s*rng.range(0.45, 0.8), sz = s*rng.range(0.7, 1.2);
  const P = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -0.6, 0], [0, 0, 1], [0, 0, -1]].map(([u, v, w]) => { const px = u*sx*rng.range(0.8, 1.2), pz = w*sz*rng.range(0.8, 1.2); return [x + px*ca - pz*sa, y + v*sy, z + px*sa + pz*ca]; });
  const F = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
  for (const [i, j, k] of F) G.face(P[i], P[j], P[k], tint(col, rng.range(0.85, 1.15)));
}
const GRAVEL = [[0.42, 0.4, 0.37], [0.3, 0.29, 0.28], [0.5, 0.46, 0.4], [0.36, 0.3, 0.25], [0.22, 0.21, 0.2]];
const N = 30, F = [0, 0.3, 0.55, 0.72, 0.84, 0.93, 1], Y = [1, 0.97, 0.9, 0.8, 0.62, 0.34, 0];
// the colours down the hole: dirt and grit at the bottom, the brown base course in the walls, the tar's black top
// layer at the lip, its broken edge lighter
const COL = [[0.2, 0.17, 0.14], [0.21, 0.18, 0.15], [0.23, 0.2, 0.16], [0.27, 0.23, 0.18], [0.34, 0.29, 0.23], [0.13, 0.13, 0.13], [0.36, 0.35, 0.33]];
export const LID_Y = 0.012;

export function buildPotholes(W, C, group) {
  if (!C.pot || !C.pot.length) return;
  const hole = new Geo(), lid = new Geo(), bits = new Geo(), q = [0, 0];
  for (const p of C.pot) {
    const s = potShape(p), rng = new RNG(1 + Math.abs(Math.floor(p.x*31 + p.z*17)));
    const base = hole.p.length/3, ring = (k) => base + 1 + k*N;
    hole.v(p.x, -s.dep*(0.95 + rng.range(0, 0.1)), p.z, tint(COL[0], rng.range(0.8, 1.1)));
    for (let k = 1; k < F.length; k++) for (let j = 0; j < N; j++) {
      const a = j/N*6.283, e = edge(s, a)*(k === F.length - 1 ? 1 : 1 + rng.range(-0.035, 0.035));
      at(s, p, a, e*F[k], q);
      const y = -s.dep*Y[k]*(k < 4 ? rng.range(0.9, 1.08) : 1);
      hole.v(q[0], y, q[1], tint(COL[k], rng.range(0.82, 1.15)));
    }
    // the broken lip just outside: up a few millimetres, crumbled, then down to the road's own dark
    const lip = hole.p.length/3;
    for (const [f, y, c] of [[1.06, 0.008, [0.33, 0.32, 0.3]], [1.16, 0.005, [0.17, 0.17, 0.18]]]) for (let j = 0; j < N; j++) {
      const a = j/N*6.283; at(s, p, a, edge(s, a)*(f + rng.range(-0.02, 0.03)), q);
      hole.v(q[0], y, q[1], tint(c, rng.range(0.85, 1.12)));
    }
    for (let j = 0; j < N; j++) hole.tri(base, ring(0) + (j + 1)%N, ring(0) + j);
    for (let k = 0; k < F.length - 2; k++) for (let j = 0; j < N; j++) {
      const a = ring(k) + j, b = ring(k) + (j + 1)%N, c = ring(k + 1) + j, d = ring(k + 1) + (j + 1)%N;
      hole.tri(a, b, c); hole.tri(b, d, c);
    }
    const last = ring(F.length - 2);
    for (let k = 0; k < 2; k++) for (let j = 0; j < N; j++) {
      const r0 = k ? lip : last, r1 = k ? lip + N : lip;
      const a = r0 + j, b = r0 + (j + 1)%N, c = r1 + j, d = r1 + (j + 1)%N;
      hole.tri(a, b, c); hole.tri(b, d, c);
    }
    // the lid: the hole's outline at the road, a little above it
    const l0 = lid.p.length/3; lid.v(p.x, LID_Y, p.z, [0, 0, 0]);
    for (let j = 0; j < N; j++) { const a = j/N*6.283; at(s, p, a, edge(s, a), q); lid.v(q[0], LID_Y, q[1], [0, 0, 0]); }
    for (let j = 0; j < N; j++) lid.tri(l0, l0 + 1 + (j + 1)%N, l0 + 1 + j);
    // loose stones in the bottom, and aggregate thrown out onto the road
    const nIn = Math.round(5 + s.R*16), nOut = Math.round(3 + s.R*10);
    for (let k = 0; k < nIn + nOut; k++) {
      const inside = k < nIn, a = rng.range(0, 6.28), e = edge(s, a), f = inside ? Math.sqrt(rng.next())*0.62 : rng.range(1.18, 1.9), sz = rng.range(0.012, inside ? 0.035 : 0.022);
      at(s, p, a, e*f, q);
      stone(bits, q[0], inside ? -s.dep*0.95 + sz*0.4 : 0.004 + sz*0.3, q[1], sz, rng, rng.pick(GRAVEL));
    }
    // cracks running off the edge
    const nc = rng.int(2, 4);
    for (let c = 0; c < nc; c++) {
      let a = rng.range(0, 6.28), e = edge(s, a), dir = a + rng.range(-0.5, 0.5); at(s, p, a, e*1.04, q);
      let x = q[0], z = q[1], w = rng.range(0.008, 0.016);
      const steps = rng.int(3, 7);
      for (let k = 0; k < steps; k++) {
        const L = rng.range(0.05, 0.12), nx = x + Math.cos(dir)*L, nz = z + Math.sin(dir)*L, w2 = w*0.75, px = -Math.sin(dir), pz = Math.cos(dir);
        const col = [0.05, 0.05, 0.05], y = 0.007;
        const a0 = bits.v(x + px*w, y, z + pz*w, col), a1 = bits.v(x - px*w, y, z - pz*w, col), b0 = bits.v(nx + px*w2, y, nz + pz*w2, col), b1 = bits.v(nx - px*w2, y, nz - pz*w2, col);
        bits.tri(a0, b0, a1); bits.tri(a1, b0, b1);
        x = nx; z = nz; w = w2; dir += rng.range(-0.6, 0.6);
      }
    }
  }
  // drawn after everything solid and the road's paint: the lid, then the hole (and its bits) into the gap it leaves
  const lg = lid.build(false), hg = hole.build(true), bg = bits.build(false);
  if (lg) { const m = new THREE.Mesh(lg, LID()); m.renderOrder = 2; m.frustumCulled = true; group.add(m); }
  if (hg) { const m = new THREE.Mesh(hg, HOLE()); m.renderOrder = 3; m.receiveShadow = true; group.add(m); }
  if (bg) { const m = new THREE.Mesh(bg, HOLE()); m.renderOrder = 3; m.receiveShadow = true; group.add(m); }
}
let lidM = null, holeM = null;
// (in the see-through pass, so it comes after all that's solid and the paint on the road; it draws nothing, it only
// pushes the depth back to the far plane inside the outline wherever the road is what's in front)
function LID() {
  return lidM || (lidM = new THREE.ShaderMaterial({
    vertexShader: 'void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
    fragmentShader: 'void main(){ gl_FragDepth = 1.; gl_FragColor = vec4(0.); }',
    colorWrite: false, depthWrite: true, depthFunc: THREE.LessEqualDepth, transparent: true,
  }));
}
// (stock, so it's painted like everything else, beta/gfx/repaint.js; in the see-through pass after the lid, opaque)
function HOLE() { return holeM || (holeM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, transparent: true, depthWrite: true })); }

// ---------------------------------------------------------------- rubbish
const BAG = [[0.92, 0.92, 0.9], [0.92, 0.92, 0.9], [0.85, 0.35, 0.55], [0.25, 0.4, 0.75], [0.1, 0.1, 0.1], [0.3, 0.6, 0.35]];
const WRAP = [[0.85, 0.15, 0.12], [0.95, 0.75, 0.1], [0.75, 0.75, 0.78], [0.15, 0.3, 0.75], [0.2, 0.6, 0.25], [0.95, 0.45, 0.1]];
function piece(G, x, y, z, rng) {
  const a = rng.range(0, 6.28), ca = Math.cos(a), sa = Math.sin(a), T = (u, v, w) => [x + u*ca - w*sa, y + v, z + u*sa + w*ca];
  const k = rng.next();
  if (k < 0.22) {
    // a carry bag, crumpled
    const col = rng.pick(BAG), r = rng.range(0.07, 0.13), h = rng.range(0.03, 0.06), P = [];
    for (let j = 0; j < 7; j++) { const t = j/7*6.283, q = r*rng.range(0.6, 1.1); P.push(T(Math.cos(t)*q, rng.range(0, 0.01), Math.sin(t)*q*0.8)); }
    const top = T(rng.range(-0.02, 0.02), h, rng.range(-0.02, 0.02));
    for (let j = 0; j < 7; j++) G.face(P[j], top, P[(j + 1)%7], tint(col, rng.range(0.85, 1.05)));
  } else if (k < 0.4) {
    // a chai cup, paper or clay, on its side or squashed flat
    const clay = rng.chance(0.35), col = clay ? [0.62, 0.32, 0.2] : [0.93, 0.92, 0.88], r0 = 0.025, r1 = 0.034, L = 0.06, sq = rng.chance(0.4) ? 0.35 : 1;
    for (let j = 0; j < 8; j++) {
      const t0 = j/8*6.283, t1 = (j + 1)/8*6.283;
      const p = (t, r, u) => T(u, (r + Math.sin(t)*r)*sq, Math.cos(t)*r);
      const A = p(t0, r0, -L/2), B = p(t1, r0, -L/2), Cc = p(t1, r1, L/2), D = p(t0, r1, L/2), sh = 0.8 + 0.25*Math.sin(t0);
      G.face(A, B, Cc, tint(col, sh)); G.face(A, Cc, D, tint(col, sh));
    }
  } else if (k < 0.52) {
    // a plastic bottle, crushed
    const col = rng.pick([[0.7, 0.82, 0.88], [0.55, 0.75, 0.6], [0.8, 0.85, 0.9]]), r = 0.034, L = rng.range(0.16, 0.24), sq = rng.range(0.4, 0.8);
    for (let j = 0; j < 6; j++) {
      const t0 = j/6*6.283, t1 = (j + 1)/6*6.283, p = (t, u, rr) => T(u, (rr + Math.sin(t)*rr)*sq, Math.cos(t)*rr);
      const A = p(t0, -L/2, r), B = p(t1, -L/2, r), Cc = p(t1, L/2 - 0.04, r), D = p(t0, L/2 - 0.04, r), E = p(t0, L/2, 0.013), Fq = p(t1, L/2, 0.013);
      G.face(A, B, Cc, col); G.face(A, Cc, D, col); G.face(D, Cc, Fq, tint(col, 0.9)); G.face(D, Fq, E, tint(col, 0.9));
    }
  } else if (k < 0.78) {
    // a wrapper or a scrap of paper, a little bent
    const news = rng.chance(0.3), col = news ? [0.82, 0.8, 0.74] : rng.pick(WRAP), w = news ? rng.range(0.12, 0.22) : rng.range(0.04, 0.08), d = news ? w*rng.range(0.6, 0.9) : w*rng.range(0.4, 0.7), b = rng.range(0, 0.02);
    const A = T(-w/2, 0.002, -d/2), B = T(w/2, 0.002, -d/2), Cc = T(w/2, 0.002 + b, d/2), D = T(-w/2, 0.002 + b, d/2);
    G.face(A, Cc, B, col); G.face(A, D, Cc, col);
  } else {
    // peel and leaves
    const col = rng.pick([[0.55, 0.45, 0.15], [0.35, 0.25, 0.12], [0.6, 0.5, 0.2], [0.3, 0.32, 0.12]]), w = rng.range(0.05, 0.1);
    const A = T(-w, 0.004, 0), B = T(0, 0.012, -w*0.35), Cc = T(w, 0.004, 0), D = T(0, 0.006, w*0.35);
    G.face(A, Cc, B, col); G.face(A, D, Cc, tint(col, 0.85));
  }
}
// rubbish round a stall (where the game laid its stain), on the footpath
export function buildLitter(W, C, group, y0) {
  const G = new Geo(), rng = new RNG(7000 + (C.ci || 0));
  for (const s of C.stalls || []) {
    if (!rng.chance(0.6)) continue;
    const cx = s[0]/100, cz = s[1]/100, n = rng.int(5, 14);
    for (let k = 0; k < n; k++) {
      const a = rng.range(0, 6.28), r = Math.sqrt(rng.next())*1.6, x = cx + Math.cos(a)*r, z = cz + Math.sin(a)*r;
      if (W.surf && W.surf.inBuilding && W.surf.inBuilding(x, z)) continue;
      piece(G, x, (W.surf && W.surf.isRoad && W.surf.isRoad(x, z)) ? 0.004 : y0, z, rng);
    }
  }
  const g = G.build(false);
  if (g) { const m = new THREE.Mesh(g, litterM || (litterM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }))); m.receiveShadow = true; group.add(m); }
}
let litterM = null;
