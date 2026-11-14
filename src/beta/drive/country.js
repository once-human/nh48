// Long Drive's world: one road through open country, without end. Nothing of Pune is loaded for it (no streets, no
// buildings, no people, no traffic): only the ground, the road over it, trees, and the sky. It is made as you go, the
// same every time (one seed), and drawn with the city's own ground, hillside, tree and road paint.
//   the road   a two-lane country road, 7.2 m of asphalt and a gravel shoulder each side. It winds in long sweeps with
//              straights between, now and then tighter, and rises and falls with the land at no more than about 6.5%,
//              its crests and dips eased. It always keeps on in one general direction (never more than about 70
//              degrees off it), so it never comes back across itself and what's ahead is laid out well before you
//              could see it
//   the land   rolling ground with hills standing out of it and flat tops on the highest, cut away where the road goes
//              through a rise and banked up where it crosses a dip, with a shallow ditch either side
//   near/far   the ground round you in 128 m pieces at a 4 m grid out to 640 m; beyond that one coarse 64 m sheet out to
//              6 km under it, sunk away wherever a near piece is drawn, so nothing is ever missing and nothing is
//              drawn twice. The road is drawn all the way to 6 km
// Every height the car, the camera and your feet ask for comes from here (W.surf.height): the road's own surface on the
// road, the shoulder's fall to its edge, the ground everywhere else, exactly where they are drawn.
import * as THREE from 'three';
import { GroundBuilder, QuadBuilder, ColorBuilder } from '@orig/world/geo.js';
import { GL } from '@orig/gfx/pbr.js';
import { DECAL } from '@orig/gfx/textures.js';

const DS = 4, HW = 3.6, SH = 1.6, DITCH = 3, FLAT = HW + SH + DITCH, R_INF = 60, CELL = 64;
const NEAR = 128, NSTEP = 4, NRING = 5, FAR = 6144, FSTEP = 64, FSNAP = 512;
const PIECE = 64, PIECE_R = 6000, TBLOCK = 256, TREE_R = 1800, TREE_DROP = 2300;
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _V = new THREE.Vector3(), _S = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
const BOX = new THREE.BoxGeometry(1, 1, 1), ROCK = new THREE.IcosahedronGeometry(1, 1);
const AHEAD = 9500, BEHIND = 3000, HILL = 25, SEED = 48;

// ---- noise: smooth value noise, the same everywhere for the one seed
const hsh = (i, j, s) => { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s + SEED, 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0)/4294967296; };
function vn(x, z, s) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx*fx*(3 - 2*fx), v = fz*fz*(3 - 2*fz);
  const a = hsh(i, j, s), b = hsh(i + 1, j, s), c = hsh(i, j + 1, s), d = hsh(i + 1, j + 1, s);
  return (a + (b - a)*u)*(1 - v) + (c + (d - c)*u)*v;
}
// the land as it lies, before any road: broad swells, hills rising out of the flatter ground (the highest flat-topped,
// as the Deccan's are), the roll of the fields, and a little unevenness
export function nat(x, z) {
  const a = vn(x/1500, z/1500, 1), b = vn(x/460, z/460, 2), c = vn(x/140, z/140, 3), d = vn(x/38, z/38, 4);
  const hill = Math.pow(Math.max(0, b - 0.38)/0.62, 1.5)*(0.35 + a);
  let h = a*32 + hill*48 + c*5 + d*0.9;
  const top = 46 + vn(x/2600, z/2600, 5)*22;
  if (h > top) h = top + (h - top)*0.12;
  return h;
}

class Road {
  constructor() {
    this.tr = 0.55; this.tx = Math.cos(this.tr); this.tz = Math.sin(this.tr);
    const x0 = -BEHIND*this.tx, z0 = -BEHIND*this.tz;
    this.x = [x0]; this.z = [z0]; this.a = [this.tr]; this.h = [nat(x0, z0)]; this.y = []; this.g = 0;
    this.grid = new Map(); this.q = { d: 0, ad: 0, y: 0, j: 0, t: 0 };
  }
  T(x, z) { return x*this.tx + z*this.tz; }
  get n() { return this.x.length; }
  // laid out until its end is `to` along the way it keeps to, and its heights settled to 200 m short of that
  grow(to) {
    let i = this.n - 1;
    while (this.T(this.x[i], this.z[i]) < to) {
      const s = i*DS;
      // the bends: long sweeps with straights between; some stretches wind more than others
      let k = (vn(s/300, 0.5, 7) - 0.5)*2.4; k = Math.sign(k)*Math.max(0, Math.abs(k) - 0.2)/0.8;
      k *= (0.45 + 0.75*vn(s/1100, 3.5, 8))/70;
      let a = this.a[i], off = Math.atan2(Math.sin(a - this.tr), Math.cos(a - this.tr));
      if (Math.abs(off) > 0.85) k -= Math.sign(off)*(Math.abs(off) - 0.85)*0.03;
      a += Math.max(-1/60, Math.min(1/60, k))*DS;
      off = Math.atan2(Math.sin(a - this.tr), Math.cos(a - this.tr));
      if (Math.abs(off) > 1.22) a = this.tr + Math.sign(off)*1.22;
      const x = this.x[i] + Math.cos(a)*DS, z = this.z[i] + Math.sin(a)*DS;
      this.x.push(x); this.z.push(z); this.a.push(a); this.h.push(nat(x, z)); i++;
    }
    // heights: following the land (its average over 240 m either way), the grade eased in and out and held under 6.5%
    for (let j = this.y.length; j < this.n - 60; j++) {
      let m = 0, c = 0; for (let q = Math.max(0, j - 30); q <= Math.min(this.n - 1, j + 30); q++) { m += this.h[q]; c++; } m /= c;
      if (!j) { this.y.push(m); continue; }
      const want = (m - this.y[j - 1])/60, g = Math.max(-0.065, Math.min(0.065, Math.max(this.g - 0.0035, Math.min(this.g + 0.0035, want))));
      this.g = g; this.y.push(this.y[j - 1] + g*DS);
      const key = Math.floor(this.x[j - 1]/CELL) + ',' + Math.floor(this.z[j - 1]/CELL);
      let l = this.grid.get(key); if (!l) this.grid.set(key, l = []); l.push(j - 1);
    }
  }
  // the nearest bit of road within 60 m: how far off it (signed, + to its left), and its height there. null if none
  near(x, z) {
    const ci = Math.floor(x/CELL), cj = Math.floor(z/CELL), Y = this.y, X = this.x, Z = this.z;
    let best = R_INF, bj = -1, bt = 0, bs = 0;
    for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) {
      const l = this.grid.get(a + ',' + b); if (!l) continue;
      for (const j of l) {
        const x0 = X[j], z0 = Z[j], dx = X[j + 1] - x0, dz = Z[j + 1] - z0;
        let t = ((x - x0)*dx + (z - z0)*dz)/(DS*DS); t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = x - x0 - dx*t, pz = z - z0 - dz*t, d = Math.sqrt(px*px + pz*pz);
        if (d < best) { best = d; bj = j; bt = t; bs = dx*(z - z0) - dz*(x - x0); }
      }
    }
    if (bj < 0) return null;
    const q = this.q; q.ad = best; q.d = bs < 0 ? -best : best; q.j = bj; q.t = bt; q.y = Y[bj] + (Y[bj + 1] - Y[bj])*bt;
    return q;
  }
}

export class Country {
  constructor(W, scene) {
    this.W = W; this.scene = scene; this.road = new Road();
    this.group = new THREE.Group(); this.group.name = 'country'; scene.add(this.group);
    this.near = new Map(); this.pieces = new Map(); this.blocks = new Map(); this.hc = new Map();
    this.far = null; this.fc = null; this.maxT = -1e9; this.tag = 900000;
    this.road.grow(AHEAD);
    const r = this.road; let s = 0; while (s < r.y.length - 1 && r.T(r.x[s], r.z[s]) < 0) s++;
    this.start = { x: r.x[s], z: r.z[s], th: r.a[s], i: s };
    const P = W.decalUV(DECAL.paint); this.paintUV = [P[0] + 0.002, P[1] + 0.002, P[0] + P[2] - 0.002, P[1] + P[2] - 0.002];
  }
  // ---- heights
  // the ground as drawn: the land, cut or banked to the road's level and a ditch's depth beside it
  ground(x, z) {
    const n = nat(x, z), q = this.road.near(x, z);
    if (!q) return n;
    const ry = q.y - 0.35;
    if (q.ad <= FLAT) return ry;
    const w = Math.min(R_INF - FLAT, 2 + Math.abs(n - ry)*1.5), t = (q.ad - FLAT)/w;
    if (t >= 1) return n;
    return ry + (n - ry)*t*t*(3 - 2*t);
  }
  // what stands under a wheel or a foot: the road and its shoulder where they are, the ground everywhere else
  height(x, z) {
    const q = this.road.near(x, z);
    if (q && q.ad <= HW + SH) return q.y - (q.ad > HW ? (q.ad - HW)*0.12 : 0);
    return this.ground(x, z);
  }
  isRoad(x, z) { const q = this.road.near(x, z); return !!q && q.ad <= HW; }
  // ---- every frame: lay the road on ahead, and build what's come near (a few milliseconds at most)
  update(x, z, budget = 3) {
    const r = this.road, t = r.T(x, z);
    if (t > this.maxT) { this.maxT = t; if (r.T(r.x[r.n - 1], r.z[r.n - 1]) < t + AHEAD - 400) r.grow(t + AHEAD); }
    const t0 = performance.now(), left = () => performance.now() - t0 < budget;
    this.farAt(x, z);
    // the ground round you, nearest first
    const ci = Math.floor(x/NEAR), cj = Math.floor(z/NEAR), want = [];
    for (let a = -NRING; a <= NRING; a++) for (let b = -NRING; b <= NRING; b++) want.push([ci + a, cj + b, a*a + b*b]);
    want.sort((p, q) => p[2] - q[2]);
    let sunk = false;
    for (const [i, j] of want) { const k = i + ',' + j; if (this.near.has(k)) continue; if (!left()) break; this.near.set(k, this.chunk(i, j)); this.sink(i, j, true); sunk = true; }
    for (const [k, m] of this.near) { const [i, j] = k.split(',').map(Number); if (Math.abs(i - ci) > NRING + 1 || Math.abs(j - cj) > NRING + 1) { this.drop(m); this.near.delete(k); this.sink(i, j, false); sunk = true; } }
    if (sunk && this.far) this.far.geometry.attributes.position.needsUpdate = true;
    // the road, to 6 km
    const n = r.y.length - 1;
    for (let p = 0; p*PIECE < n; p++) {
      const i = Math.min(n, p*PIECE + PIECE/2), d = Math.hypot(r.x[i] - x, r.z[i] - z), has = this.pieces.has(p);
      if (d < PIECE_R && !has && (p + 1)*PIECE <= n) { if (!left()) continue; const tag = ++this.tag, C = this.W.collision; C.tag = tag; let o; try { o = this.piece(p); } finally { C.tag = 0; } o.tag = tag; this.pieces.set(p, o); }
      else if (d > PIECE_R + 500 && has) { const o = this.pieces.get(p); for (const m of o) this.drop(m); this.W.collision.removeTag(o.tag); this.pieces.delete(p); }
    }
    // the trees, in 256 m blocks
    const bi = Math.floor(x/TBLOCK), bj = Math.floor(z/TBLOCK), R = Math.ceil(TREE_R/TBLOCK), T = this.W.trees;
    if (T) {
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        const k = (bi + a) + ',' + (bj + b); if (this.blocks.has(k) || Math.hypot(a, b)*TBLOCK > TREE_R) continue; if (!left()) break;
        const tag = ++this.tag, C = this.W.collision; C.tag = tag;
        let rk; try { const tr = this.trees(bi + a, bj + b); T.addTile(tr.list, tag); rk = tr.rocks; } finally { C.tag = 0; }
        this.blocks.set(k, { tag, rk });
      }
      for (const [k, B] of this.blocks) {
        const [i, j] = k.split(',').map(Number), tag = B.tag;
        if (Math.hypot(i - bi, j - bj)*TBLOCK > TREE_DROP) { T.removeTile(tag); if (B.rk) this.drop(B.rk); this.W.collision.removeTag(tag, [i*TBLOCK, j*TBLOCK, (i + 1)*TBLOCK, (j + 1)*TBLOCK]); this.blocks.delete(k); }
      }
    }
  }
  // before the first frame: everything round the start, all at once
  warm(x, z) { this.update(x, z, 1e9); }
  drop(m) { this.group.remove(m); m.geometry.dispose(); }
  mesh(g, mat, order = 0) { const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false; m.renderOrder = order; this.group.add(m); return m; }
  // ---- a near piece of ground: a 4 m grid, its normals from the slopes, and a skirt down round its edge (the far sheet's
  // coarser edge never shows through a crack)
  chunk(i, j) {
    const n = NEAR/NSTEP + 1, x0 = i*NEAR, z0 = j*NEAR, H = new Float32Array((n + 2)*(n + 2));
    for (let b = -1; b <= n; b++) for (let a = -1; a <= n; a++) H[(b + 1)*(n + 2) + a + 1] = this.ground(x0 + a*NSTEP, z0 + b*NSTEP);
    const h = (a, b) => H[(b + 1)*(n + 2) + a + 1], gb = new GroundBuilder(), id = new Int32Array(n*n);
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
      const nx = -(h(a + 1, b) - h(a - 1, b))/(2*NSTEP), nz = -(h(a, b + 1) - h(a, b - 1))/(2*NSTEP), l = Math.hypot(nx, 1, nz), x = x0 + a*NSTEP, z = z0 + b*NSTEP;
      id[b*n + a] = gb.v(x, h(a, b), z, nx/l, 1/l, nz/l, x, z, HILL, 1);
    }
    for (let b = 0; b < n - 1; b++) for (let a = 0; a < n - 1; a++) { const p = id[b*n + a], q = id[b*n + a + 1], r = id[(b + 1)*n + a], s = id[(b + 1)*n + a + 1]; gb.i.push(p, r, q, q, r, s); }
    const edge = (list) => {
      const top = list.map(([a, b]) => id[b*n + a]), low = list.map(([a, b]) => { const x = x0 + a*NSTEP, z = z0 + b*NSTEP; return gb.v(x, h(a, b) - 3, z, 0, 1, 0, x, z, HILL, 0.8); });
      for (let k = 0; k < list.length - 1; k++) gb.i.push(top[k], low[k], top[k + 1], top[k + 1], low[k], low[k + 1], top[k], top[k + 1], low[k], top[k + 1], low[k + 1], low[k]);
    };
    const L = [...Array(n).keys()];
    edge(L.map(a => [a, 0])); edge(L.map(a => [a, n - 1])); edge(L.map(b => [0, b])); edge(L.map(b => [n - 1, b]));
    return this.mesh(gb.build(), this.W.mats.ground);
  }
  // ---- the far sheet: 64 m, out to 6 km, moved on every 512 m. Each height is worked out once and kept
  fh(i, j) { const k = i*1048576 + j; let v = this.hc.get(k); if (v === undefined) { v = this.ground(i*FSTEP, j*FSTEP) - 0.6; this.hc.set(k, v); } return v; }
  farAt(x, z) {
    const cx = Math.round(x/FSNAP)*FSNAP, cz = Math.round(z/FSNAP)*FSNAP;
    if (this.fc && this.fc[0] === cx && this.fc[1] === cz) return;
    this.fc = [cx, cz];
    const n = 2*FAR/FSTEP + 1, i0 = (cx - FAR)/FSTEP, j0 = (cz - FAR)/FSTEP, gb = new GroundBuilder();
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
      const i = i0 + a, j = j0 + b, nx = -(this.fh(i + 1, j) - this.fh(i - 1, j))/(2*FSTEP), nz = -(this.fh(i, j + 1) - this.fh(i, j - 1))/(2*FSTEP), l = Math.hypot(nx, 1, nz);
      gb.v(i*FSTEP, this.fh(i, j), j*FSTEP, nx/l, 1/l, nz/l, i*FSTEP, j*FSTEP, HILL, 1);
    }
    for (let b = 0; b < n - 1; b++) for (let a = 0; a < n - 1; a++) { const p = b*n + a; gb.i.push(p, p + n, p + 1, p + 1, p + n, p + n + 1); }
    if (this.far) this.drop(this.far);
    this.far = this.mesh(gb.build(), this.W.mats.ground);
    this.far.geometry.boundingSphere.radius = FAR*1.5;
    this.fn = n; this.fi0 = i0; this.fj0 = j0;
    for (const k of this.near.keys()) { const [i, j] = k.split(',').map(Number); this.sink(i, j, true); }
    this.far.geometry.attributes.position.needsUpdate = true;
  }
  // where a near piece is drawn, the far sheet's point in its middle goes well down out of the way (and comes back up
  // when the piece goes)
  sink(i, j, down) {
    if (!this.far) return;
    const a = (i*NEAR + NEAR/2)/FSTEP - this.fi0, b = (j*NEAR + NEAR/2)/FSTEP - this.fj0;
    if (a < 0 || b < 0 || a >= this.fn || b >= this.fn) return;
    const P = this.far.geometry.attributes.position, k = b*this.fn + a;
    P.setY(k, this.fh(this.fi0 + a, this.fj0 + b) - (down ? 40 : 0));
  }
  // ---- 256 m of road: the asphalt, the shoulders falling to the ditch, and the paint (a broken white line down the
  // middle, a solid one along each edge)
  piece(p) {
    const r = this.road, j0 = p*PIECE, j1 = Math.min(r.y.length - 1, j0 + PIECE), gb = new GroundBuilder(), db = new QuadBuilder();
    const X = [-(HW + SH + 0.6), -(HW + SH), -HW, HW, HW + SH, HW + SH + 0.6], Y = [-0.75, -0.19, 0, 0, -0.19, -0.75];
    const strips = [[0, 1, GL.dirt], [1, 2, GL.dirt], [2, 3, GL.asphalt], [3, 4, GL.dirt], [4, 5, GL.dirt]];
    const at = (j, o, dy) => { const a = r.a[j], c = Math.cos(a), s = Math.sin(a); return [r.x[j] - s*o, r.y[j] + dy, r.z[j] + c*o]; };
    const nrm = (j) => { const g = (r.y[Math.min(r.y.length - 1, j + 1)] - r.y[Math.max(0, j - 1)])/(2*DS), a = r.a[j], l = Math.hypot(g, 1); return [-g*Math.cos(a)/l, 1/l, -g*Math.sin(a)/l]; };
    for (const [c0, c1, layer] of strips) {
      let prev = null;
      for (let j = j0; j <= j1; j++) {
        const N = nrm(j), A = at(j, X[c0], Y[c0]), B = at(j, X[c1], Y[c1]);
        const u = gb.v(A[0], A[1], A[2], N[0], N[1], N[2], A[0], A[2], layer, layer === GL.asphalt ? 0.95 : 0.85), v = gb.v(B[0], B[1], B[2], N[0], N[1], N[2], B[0], B[2], layer, layer === GL.asphalt ? 0.95 : 0.85);
        if (prev) gb.i.push(prev[0], prev[1], u, prev[1], v, u);
        prev = [u, v];
      }
    }
    const uv = this.paintUV, line = (j, o, w, y = 0.022) => {
      const N = nrm(j), a = at(j, o - w/2, y), b = at(j, o + w/2, y), c = at(j + 1, o + w/2, y), d = at(j + 1, o - w/2, y);
      db.quad(a, b, c, d, N, uv[0], uv[1], uv[2], uv[3]);
    };
    for (let j = j0; j < j1; j++) { if (j % 3 === 0) line(j, 0, 0.12); line(j, HW - 0.25, 0.14); line(j, -(HW - 0.25), 0.14); }
    const out = [this.mesh(gb.build(), this.W.mats.ground)];
    if (!db.empty) out.push(this.mesh(db.build(), this.W.mats.decal, 1));
    const cb = this.solids(j0, j1, at);
    if (cb.c) { const m = this.mesh(cb.build(), this.W.mats.prop); m.castShadow = true; out.push(m); }
    return out;
  }
  // what's beside the road and solid: you can go into any of it, and it stops you as a wall or a post would
  //   crash barrier  steel W-beam on posts, on the side where the road stands high over the land (an embankment more than
  //                  about 2 m up) and round the outside of the sharpest bends
  //   culvert        where the road dips to cross a stream bed: a low concrete parapet each side, painted black and white
  //   km stone       every kilometre on the left: the white stone with the yellow top
  solids(j0, j1, at) {
    const r = this.road, cb = new ColorBuilder(), C = this.W.collision, RAIL = HW + SH - 0.15;
    const box = (x, y, z, a, w, h, d, col) => { _Q.setFromAxisAngle(_UP, -a); _M.compose(_V.set(x, y + h/2, z), _Q, _S.set(w, h, d)); cb.addGeo(BOX, _M, col); };
    const steel = [0.6, 0.62, 0.64], post = [0.36, 0.37, 0.38], conc = [0.82, 0.81, 0.77], dark = [0.08, 0.08, 0.08];
    const curv = (j) => { const a0 = r.a[Math.max(0, j - 3)], a1 = r.a[Math.min(r.a.length - 1, j + 3)]; return Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))/(6*DS); };
    for (const sd of [-1, 1]) {
      // which samples want a barrier on this side
      const want = [];
      for (let j = j0; j <= j1; j++) {
        const o = sd*(FLAT + 6), c = Math.cos(r.a[j]), s = Math.sin(r.a[j]), up = r.y[j] - nat(r.x[j] - s*o, r.z[j] + c*o), k = curv(j);
        want.push(up > 2.2 || (k*sd < -1/95));
      }
      let run = [];
      const flush = () => {
        if (run.length >= 5) {
          let prev = null;
          for (const j of run) {
            const p = at(j, sd*RAIL, 0);
            if ((j - j0) % 1 === 0) box(p[0], p[1] - 0.25, p[2], r.a[j], 0.12, 1.05, 0.12, post);
            if (prev) {
              const dx = p[0] - prev[0], dz = p[2] - prev[2], L = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
              box((p[0] + prev[0])/2, (p[1] + prev[1])/2 + 0.5, (p[2] + prev[2])/2, a, L + 0.02, 0.32, 0.08, steel);
              C.addSeg(prev[0], prev[2], p[0], p[2], 0);
            }
            prev = p;
          }
        }
        run = [];
      };
      for (let j = j0; j <= j1; j++) { if (want[j - j0]) run.push(j); else flush(); }
      flush();
    }
    // a culvert at the bottom of a dip
    for (let j = Math.max(j0, 40); j <= j1 && j < r.y.length - 41; j++) {
      if (r.y[j] > r.y[j - 1] || r.y[j] > r.y[j + 1] || r.y[j] > r.y[j - 40] - 1.2 || r.y[j] > r.y[j + 40] - 1.2) continue;
      for (const sd of [-1, 1]) {
        let prev = null;
        for (let q = -3; q <= 3; q++) {
          const p = at(j + q, sd*(HW + SH - 0.05), 0);
          if (prev) {
            const dx = p[0] - prev[0], dz = p[2] - prev[2], L = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
            box((p[0] + prev[0])/2, (p[1] + prev[1])/2 - 0.2, (p[2] + prev[2])/2, a, L + 0.01, 0.75, 0.3, (q & 1) ? dark : conc);
            C.addSeg(prev[0], prev[2], p[0], p[2], 0);
          }
          prev = p;
        }
      }
    }
    // the kilometre stones
    for (let j = j0; j <= j1; j++) {
      if (j % Math.round(1000/DS)) continue;
      const p = at(j, FLAT - 0.6, 0), y = r.y[j] - 0.35;
      box(p[0], y, p[2], r.a[j] + Math.PI/2, 0.45, 0.55, 0.2, [0.93, 0.93, 0.9]);
      box(p[0], y + 0.55, p[2], r.a[j] + Math.PI/2, 0.45, 0.22, 0.2, [0.95, 0.75, 0.1]);
      C.addCircle(p[0], p[2], 0.32, 1);
    }
    return cb;
  }
  // ---- the trees of a 256 m block: groves and open fields by the lie of the land, and here and there an avenue of old
  // banyans and rain trees along the road, as on the old state roads
  trees(bi, bj) {
    const out = [], x0 = bi*TBLOCK, z0 = bj*TBLOCK, r = this.road;
    const dens = vn(x0/700, z0/700, 21), n = Math.round(6 + Math.pow(dens, 2.2)*140);
    const KINDS = [3, 3, 3, 6, 6, 5, 0, 2, 3, 6, 1, 7];
    for (let k = 0; k < n; k++) {
      const x = x0 + hsh(bi*31 + k, bj, 22)*TBLOCK, z = z0 + hsh(bi, bj*31 + k, 23)*TBLOCK;
      if (vn(x/90, z/90, 24) < 0.42 - dens*0.2) continue;                 // (in clumps, not spread evenly)
      const q = r.near(x, z); if (q && q.ad < FLAT + 2) continue;
      out.push([Math.round(x*100), Math.round(z*100), KINDS[Math.floor(hsh(k, bi + bj, 25)*KINDS.length)], 0.75 + hsh(k, bj - bi, 26)*0.55]);
    }
    // the avenue: whichever stretches of road cross this block
    const seen = new Set();
    for (let a = Math.floor(x0/CELL) - 1; a <= Math.floor((x0 + TBLOCK)/CELL); a++) for (let b = Math.floor(z0/CELL) - 1; b <= Math.floor((z0 + TBLOCK)/CELL); b++) {
      for (const j of r.grid.get(a + ',' + b) || []) {
        if (j % 4 || seen.has(j) || vn(j*DS/900, 9.5, 27) < 0.58) continue; seen.add(j);
        for (const sd of [-1, 1]) {
          if (hsh(j, sd, 28) < 0.18) continue;                              // (a gap where one's gone)
          const o = sd*(FLAT + 1.2 + hsh(j, sd, 29)*1.5), c = Math.cos(r.a[j]), s = Math.sin(r.a[j]), x = r.x[j] - s*o, z = r.z[j] + c*o;
          if (x < x0 || x >= x0 + TBLOCK || z < z0 || z >= z0 + TBLOCK) continue;
          out.push([Math.round(x*100), Math.round(z*100), hsh(j, sd, 30) < 0.6 ? 5 : 0, 1.0 + hsh(j, sd, 31)*0.4]);
        }
      }
    }
    // and boulders: laterite, dark and rough, out in the fields and on the hillsides
    const cb = new ColorBuilder(), C = this.W.collision, nr = Math.round(hsh(bi, bj, 40)*7*(0.3 + dens));
    for (let k = 0; k < nr; k++) {
      const x = x0 + hsh(bi*17 + k, bj, 41)*TBLOCK, z = z0 + hsh(bi, bj*17 + k, 42)*TBLOCK, q = r.near(x, z);
      if (q && q.ad < FLAT + 1.5) continue;
      const s = 0.35 + Math.pow(hsh(k, bi - bj, 43), 2)*1.3, y = this.ground(x, z);
      _Q.setFromAxisAngle(_UP, hsh(k, bi, 44)*6.28); _M.compose(_V.set(x, y + s*0.35, z), _Q, _S.set(s*(0.9 + hsh(k, 1, 45)*0.5), s*(0.55 + hsh(k, 2, 46)*0.3), s*(0.8 + hsh(k, 3, 47)*0.4)));
      const t = hsh(k, 4, 48); cb.addGeo(ROCK, _M, [0.42 + t*0.12, 0.27 + t*0.08, 0.2 + t*0.05]);
      C.addCircle(x, z, s*0.85, 1);
    }
    let rocks = null;
    if (cb.c) { rocks = this.mesh(cb.build(), this.W.mats.prop); rocks.castShadow = true; }
    return { list: out, rocks };
  }
}

// the empty map the city's world is built from for Long Drive: the same shape as Pune's, with nothing in it
export function emptyMap() {
  const play = [-100000, -100000, 100000, 100000];
  return {
    meta: { lat0: 18.527, lon0: 73.865, mlat: 110686, mlon: 105589, vis: [-100000, -100000, 100000, 100000], chunk: 200, ncx: 10, ncz: 10, play, outlineXZ: [[play[0], play[1]], [play[2], play[1]], [play[2], play[3]], [play[0], play[3]]], tiles: [], tileSize: 1000, activity: { cell: 50, cls: [] } },
    names: [], districts: [], landmarks: [], areas: [], flyovers: [], metro: [], mstations: [], buses: [], places: [], pois: [], street: {}, hills: null,
    graph: { nodes: [], edges: [] }, ground: [], water: [], banks: [], lakebanks: [], kerbs: [], rails: [], buildings: [],
    marks: { center: [], lane: [], zebra: [], stop: [], bump: [] }, trees: [], walls: [], lamps: [], poles: [], signals: [], stalls: [],
    parked: [], hoardings: [], shops: [], railways: [], platforms: [], shopNames: [], pins: [], activity: { cell: 50, cls: [], cells: [] },
  };
}

// the world, made over for the drive: nothing of the city built or kept solid, every height from the country
export function countryWorld(W, scene) {
  W.collision = new W.collision.constructor(8);
  if (W.streamer) W.streamer.builders = [];
  W.fly = null;                                           // (no flyovers out here: nothing asks after them)
  const C = W.country = new Country(W, scene);
  W.surf.height = (x, z) => C.height(x, z);
  W.surf.isRoad = (x, z) => C.isRoad(x, z);
  W.surf.isWater = () => false;
  W.surf.inBuilding = () => false;
  if (W.hills) W.hills.height = (x, z) => C.ground(x, z);
  return C;
}
