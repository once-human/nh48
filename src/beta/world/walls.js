// What a building takes from what's driven into it. It doesn't come down (nothing in a street should), but it shows it,
// by what the wall is where it was struck and how hard:
//   a wall (brick laid in cement, plastered and painted, as nearly every wall in Pune is): a black smear of bumper and
//   tyre on the paint from a nudge; from a real knock the plaster cracks, the cracks running out from a crushed patch
//   where it was struck; harder, the plaster comes away in a slab and the red brick shows under the grey render, bits
//   of plaster dropping; harder still, the bricks are knocked out, a hole into the dark behind them, bricks falling out
//   onto the road and the bonnet, broken ones left in its edge
//   a rolling shutter: dented in, the slats buckled and scraped bright where the paint's gone (rolled up past it, the
//   dent goes up into its box with it)
//   a shop's plate glass: a star of cracks from a knock; from a real hit the whole pane crazes white and falls in,
//   the glass pouring down onto the step and the road, the edges left in the frame
// Each spot keeps what it's taken, so a second knock where the first was goes further. Nothing's mended while you
// can see it: it's put right once you've been well away a few minutes and it's out of sight (world/smash.js).
import * as THREE from 'three';
import { ColorBuilder } from '@orig/world/geo.js';
import { pieceOf } from './debris.js';
import { FX } from './smashfx.js';
import { smash } from './smash.js';

const V3 = THREE.Vector3, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(1, 1, 1);
let seed = 1;
const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
const J = (a, b) => a + (b - a)*rnd();

// ---------------------------------------------------------------- the wall at a point
// the building's edge nearest (x, z): a frame on it, facing out to where the striker was (sx, sz)
function wallAt(C, x, z, sx, sz) {
  const c = C.cell, i0 = Math.floor((x - 1.5)/c), i1 = Math.floor((x + 1.5)/c), j0 = Math.floor((z - 1.5)/c), j1 = Math.floor((z + 1.5)/c);
  let best = null, bd = 1.2;
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const l = C.segs.get(C.key(i, j)); if (!l) continue;
    for (const s of l) {
      if (s.kind !== 0 && s.kind !== 5) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx*dx + dz*dz; if (L2 < 0.04) continue;
      const t = Math.max(0, Math.min(1, ((x - s.ax)*dx + (z - s.az)*dz)/L2)), d = Math.hypot(x - s.ax - dx*t, z - s.az - dz*t);
      if (d < bd) { bd = d; best = { s, t, L: Math.sqrt(L2) }; }
    }
  }
  if (!best) return null;
  const { s, t, L } = best, tx = (s.bx - s.ax)/L, tz = (s.bz - s.az)/L;
  let nx = -tz, nz = tx; if ((sx - s.ax)*nx + (sz - s.az)*nz < 0) { nx = -nx; nz = -nz; }
  return { ax: s.ax, az: s.az, tx, tz, nx, nz, L, u: t*L };
}
// points in the wall's frame: along it u, up y, out from it d
const P = (F, u, y, d) => [F.ax + F.tx*u + F.nx*d, y, F.az + F.tz*u + F.nz*d];

class Decal {
  // (wound to face out whichever way out is)
  constructor(F) { this.F = F; this.b = new ColorBuilder(); this.flip = -F.tz*F.nx + F.tx*F.nz < 0; }
  tri(a, b, c) { if (this.flip) this.b.i.push(a, c, b); else this.b.i.push(a, b, c); }
  // a flat polygon (u, y) on the wall, d out
  poly(pts, d, c) {
    const F = this.F, b = this.b, n0 = b.c;
    for (const [u, y] of pts) { const p = P(F, Math.max(0.02, Math.min(F.L - 0.02, u)), Math.max(0.17, y), d); b.v(p[0], p[1], p[2], F.nx, 0, F.nz, c[0], c[1], c[2]); }
    for (let k = 1; k + 1 < pts.length; k++) this.tri(n0, n0 + k, n0 + k + 1);
  }
  fan(cu, cy, ring, d, c, cIn) {
    const F = this.F, b = this.b, n0 = b.c, ci = cIn || c;
    const p = P(F, cu, Math.max(0.17, cy), d); b.v(p[0], p[1], p[2], F.nx, 0, F.nz, ci[0], ci[1], ci[2]);
    for (const [u, y] of ring) { const q = P(F, Math.max(0.02, Math.min(F.L - 0.02, u)), Math.max(0.17, y), d); b.v(q[0], q[1], q[2], F.nx, 0, F.nz, c[0], c[1], c[2]); }
    for (let k = 0; k < ring.length; k++) this.tri(n0, n0 + 1 + k, n0 + 1 + (k + 1) % ring.length);
  }
  // a line along points, w wide
  line(pts, w, d, c) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const [u0, y0] = pts[k], [u1, y1] = pts[k + 1], L = Math.hypot(u1 - u0, y1 - y0) || 1, ou = -(y1 - y0)/L*w/2, oy = (u1 - u0)/L*w/2, t = 1 - 0.6*k/pts.length;
      this.poly([[u0 - ou*t, y0 - oy*t], [u1 - ou*t*0.8, y1 - oy*t*0.8], [u1 + ou*t*0.8, y1 + oy*t*0.8], [u0 + ou*t, y0 + oy*t]], d, c);
    }
  }
  // a box standing out of the wall (a broken brick, a lump left in it)
  box(u, y, d0, w, h, dd, c) {
    const F = this.F, b = this.b, g = new THREE.BoxGeometry(w, h, dd), p = P(F, u, y, d0 + dd/2);
    b.addGeo(g, _m.compose(new V3(p[0], p[1], p[2]), _q.setFromEuler(_e.set(0, Math.atan2(F.nx, F.nz), 0)), _s), c);
  }
  get empty() { return this.b.empty; }
  mesh(W) { const m = new THREE.Mesh(this.b.build(), W.mats.prop); m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false; W.scene.add(m); return m; }
}
// a ragged outline round (cu, cy), rw x rh
function ragged(cu, cy, rw, rh, n, k = 0.4) { const o = []; for (let i = 0; i < n; i++) { const a = i/n*6.283, j = 1 - k/2 + rnd()*k; o.push([cu + Math.cos(a)*rw*j, cy + Math.sin(a)*rh*j]); } return o; }
// a crack: a wandering line, branching now and then
function crack(D, u, y, a, len, d, c, w = 0.006) {
  const pts = [[u, y]]; let x = u, z = y;
  for (let s = 0; s < len;) { const st = J(0.04, 0.12); a += J(-0.6, 0.6); x += Math.cos(a)*st; z += Math.sin(a)*st; s += st; pts.push([x, z]);
    if (rnd() < 0.12 && len - s > 0.15) crack(D, x, z, a + (rnd() < 0.5 ? 1 : -1)*J(0.5, 1.1), (len - s)*J(0.3, 0.6), d, c, w*0.7); }
  D.line(pts, w, d, c);
}

// ---------------------------------------------------------------- the spots that have been struck
const spots = new Map();
function rec(X, key, x, z) {
  let s = spots.get(key);
  if (s && s.r.st === 0) { spots.delete(key); s = null; }
  if (!s) {
    const r = { id: 'wall:' + key, kind: 'wall', x, z, y: 0, ry: 0, items: [], cols: [], dmg: 0, tilt: new V3(), st: 1, bodies: [], meshes: [], m0: new Map(), tb: X.t };
    s = { r, E: 0, stage: 0, layer: 0 }; spots.set(key, s);
  }
  s.r.tb = X.t; X.down.add(s.r);
  return s;
}
const PLASTER = [0.62, 0.6, 0.56], BRICK = [0.56, 0.27, 0.18], MORTAR = [0.66, 0.63, 0.58], SOOT = [0.12, 0.12, 0.12], DARK = [0.04, 0.035, 0.03];

// o: { x, z (where it touched), sx, sz (where the striker's middle is), y0, y1 (the height of what struck it), E (J), w (how wide) }
export function hitWall(W, o) {
  const X = smash(W), C = W.collision; if (!C || !C.segs) return;
  const F = wallAt(C, o.x, o.z, o.sx, o.sz); if (!F) return;
  seed = (Math.floor(o.x*37 + o.z*91) & 0x7fffffff) || 7;
  const px = F.ax + F.tx*F.u, pz = F.az + F.tz*F.u, yc = (o.y0 + o.y1)/2;
  // a shutter down over it, or a pane of a shop's glass front
  const sh = shutterAt(W, px, pz, F, o);
  if (sh) return dentShutter(X, W, F, sh, o);
  const gl = glassAt(W, px, pz, F);
  if (gl) return glass(X, W, F, gl, o);
  // the wall itself
  const key = Math.round(px*1.25) + ',' + Math.round(pz*1.25) + ',' + Math.round(yc), s = rec(X, key, px, pz);
  s.E += o.E;
  const E = Math.max(o.E, s.E*0.7), stage = E > 35e3 ? 4 : E > 12e3 ? 3 : E > 2.5e3 ? 2 : E > 600 ? 1 : 0;
  if (!stage) return;
  const D = new Decal(F), lay = () => 0.004 + 0.003*(s.layer++ % 6), u = F.u, w = Math.min(1.6, o.w || 1.4);
  // the smear of the bumper on the paint, along the wall
  if (stage >= 1 && s.stage < 1) {
    const hw = Math.min(w*0.5, 0.25 + E/3e4), hh = Math.min(0.2, (o.y1 - o.y0)*0.3 + 0.04);
    D.fan(u, yc, ragged(u, yc, hw, hh, 12, 0.5), lay(), [0.2, 0.2, 0.2], SOOT);
    for (let k = 0; k < 4; k++) { const y = yc + J(-hh, hh)*0.8; D.line([[u - hw*J(0.6, 1.3), y], [u + hw*J(0.6, 1.3), y + J(-0.02, 0.02)]], J(0.004, 0.012), lay(), [0.28, 0.27, 0.26]); }
  }
  // cracked: a crushed patch, the cracks running out of it
  if (stage >= 2 && s.stage < 2) {
    const r = Math.min(0.35, 0.08 + E/8e4), d = lay();
    D.fan(u, yc, ragged(u, yc, r, r*0.8, 10, 0.6), d, PLASTER, [0.5, 0.48, 0.45]);
    const n = 5 + Math.floor(rnd()*4), len = Math.min(1.8, 0.35 + E/1.2e4);
    for (let k = 0; k < n; k++) crack(D, u, yc, k/n*6.283 + J(-0.3, 0.3), len*J(0.5, 1.1), d + 0.001, [0.16, 0.15, 0.14], J(0.004, 0.008));
    chips(X, s.r, F, u, yc, 4 + Math.floor(E/3e3), PLASTER, 0.04);
  }
  // the plaster off in a slab: the grey render, and the brick under it in its courses
  if (stage >= 3 && s.stage < 3) {
    const rw = Math.min(0.9, 0.3 + E/6e4), rh = Math.min(0.6, 0.22 + E/9e4), d = lay() + 0.004;
    D.fan(u, yc, ragged(u, yc, rw*1.1, rh*1.1, 14, 0.5), d - 0.002, [0.7, 0.68, 0.63]);
    D.fan(u, yc, ragged(u, yc, rw, rh, 14, 0.5), d, PLASTER, [0.55, 0.53, 0.5]);
    bricks(D, u, yc, rw*0.75, rh*0.7, d + 0.002);
    chips(X, s.r, F, u, yc, 8 + Math.floor(E/4e3), PLASTER, 0.07);
  }
  // knocked through: a hole into the dark, broken bricks round its edge, the rest out on the road
  if (stage >= 4 && s.stage < 4) {
    const rw = Math.min(0.85, 0.3 + E/1.5e5), rh = Math.min(0.55, 0.2 + E/2.4e5), d = lay() + 0.01;
    const edge = ragged(u, yc, rw, rh, 16, 0.35);
    D.fan(u, yc, edge, d, [0.1, 0.08, 0.07], DARK);
    for (const [eu, ey] of edge) if (rnd() < 0.8) D.box(eu + J(-0.04, 0.04), ey + J(-0.03, 0.03), -0.02, J(0.1, 0.23), 0.075, J(0.05, 0.12), BRICK.map(c => c*J(0.85, 1.1)));
    fallBricks(X, s.r, F, u, yc, rw, rh, Math.min(18, 4 + Math.floor(E/8e3)));
    FX.brk('bricks', px, yc, pz, Math.min(1.3, E/6e4));
  } else FX.brk('plaster', px, yc, pz, Math.min(1.2, 0.3 + E/2e4));
  s.stage = Math.max(s.stage, stage);
  if (!D.empty) s.r.meshes.push(D.mesh(W));
}
// brick in its courses inside an ellipse, the mortar between
function bricks(D, cu, cy, rw, rh, d) {
  D.fan(cu, cy, ragged(cu, cy, rw*1.05, rh*1.05, 14, 0.25), d, MORTAR);
  for (let row = -6; row <= 6; row++) {
    const y = cy + row*0.085; if (Math.abs(row*0.085) > rh) continue;
    const half = rw*Math.sqrt(Math.max(0, 1 - (row*0.085/rh)**2)), off = (row & 1)*0.12;
    for (let x = -half - 0.24 + off; x < half; x += 0.24) {
      const a = Math.max(-half, x), b = Math.min(half, x + 0.22); if (b - a < 0.03) continue;
      D.poly([[cu + a, y - 0.035], [cu + b, y - 0.035], [cu + b, y + 0.035], [cu + a, y + 0.035]], d + 0.001, BRICK.map(c => c*J(0.82, 1.12)));
    }
  }
}
// bits of plaster (or glass) off the wall, falling
function chips(X, r, F, u, y, n, c, s0) {
  for (let k = 0; k < n; k++) {
    const cb = new ColorBuilder(), s = s0*J(0.4, 1.2); cb.addGeo(new THREE.IcosahedronGeometry(s, 0), _m.makeScale(1, 0.5, 0.9), c.map(v => v*J(0.9, 1.05)));
    const pc = pieceOf(cb.build(), [{ tris: [...Array(20).keys()] }]), p = P(F, u + J(-0.25, 0.25), y + J(-0.15, 0.15), 0.03);
    const b = X.body(r, pc, _m.makeTranslation(p[0], p[1], p[2]), 0.05 + s*4, 'rcc', {});
    const out = J(0.3, 1.4); b.v.set(F.nx*out + F.tx*J(-0.6, 0.6), J(-0.2, 0.8), F.nz*out + F.tz*J(-0.6, 0.6)); b.w.set(J(-8, 8), J(-8, 8), J(-8, 8));
  }
}
function fallBricks(X, r, F, u, y, rw, rh, n) {
  for (let k = 0; k < n; k++) {
    const cb = new ColorBuilder(), whole = rnd() < 0.6, L = whole ? 0.23 : J(0.08, 0.16);
    cb.addGeo(new THREE.BoxGeometry(L, 0.075, 0.11), _m.identity(), BRICK.map(c => c*J(0.85, 1.1)));
    if (rnd() < 0.5) cb.addGeo(new THREE.BoxGeometry(L*0.9, 0.012, 0.1), _m.makeTranslation(0, 0.043, 0), MORTAR);
    const g = cb.build(), pc = pieceOf(g, [{ tris: [...Array(g.index.count/3).keys()] }]), p = P(F, u + J(-rw, rw)*0.8, y + J(-rh, rh)*0.8, 0.06);
    const b = X.body(r, pc, _m.compose(new V3(p[0], p[1], p[2]), _q.setFromEuler(_e.set(J(-0.3, 0.3), Math.atan2(F.nx, F.nz) + J(-0.3, 0.3), J(-0.3, 0.3))), _s), whole ? 3.2 : 1.6, 'rcc', {});
    const out = J(0.4, 2.2); b.v.set(F.nx*out + F.tx*J(-0.8, 0.8), J(0, 1.2), F.nz*out + F.tz*J(-0.8, 0.8)); b.w.set(J(-6, 6), J(-6, 6), J(-6, 6));
  }
}

// ---------------------------------------------------------------- shutters
function chunksAt(W, x, z) {
  const I = W.index, out = []; if (!I || !I.chunkOf) return out;
  for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) { const ci = I.chunkOf(x + dx, z + dz), c = ci >= 0 && I.chunks[ci]; if (c && !out.includes(c)) out.push(c); }
  return out;
}
function shutterAt(W, x, z, F, o) {
  for (const C of chunksAt(W, x, z)) {
    const S = C.shutters; if (!S) continue;
    for (const r of S.list) {
      const fx = Math.cos(r.ry), fz = -Math.sin(r.ry), dx = x - r.x, dz = z - r.z;
      if (Math.abs(dx*fx + dz*fz) > r.w/2 + 0.05 || Math.abs(dx*Math.sin(r.ry) + dz*Math.cos(r.ry)) > 0.3) continue;
      const bottom = r.y + r.h*(r.k ?? 0);
      if (o.y1 > bottom + 0.1) return { r, S, u: dx*fx + dz*fz, bottom };
    }
  }
  return null;
}
const dents = new Set();
function dentShutter(X, W, F, sh, o) {
  const r = sh.r, key = 'sh:' + Math.round(r.x*10) + ',' + Math.round(r.z*10), s = rec(X, key, r.x, r.z);
  s.E += o.E; if (o.E < 500) { FX.brk('shutter', r.x, (o.y0 + o.y1)/2, r.z, 0.3); return; }
  const fx = Math.cos(r.ry), fz = -Math.sin(r.ry), nx = Math.sin(r.ry), nz = Math.cos(r.ry);
  // (in the shutter's own frame: along it from its left edge, out from the wall it's on)
  const G = { ax: r.x - fx*r.w/2, az: r.z - fz*r.w/2, tx: fx, tz: fz, nx, nz, L: r.w }, D = new Decal(G);
  const u = r.w/2 + sh.u, yc = Math.max(sh.bottom + 0.15, (o.y0 + o.y1)/2), E = o.E;
  const rw = Math.min(r.w*0.45, 0.3 + E/3e4), rh = Math.min(0.7, 0.15 + E/5e4), d = 0.025 + 0.002*(s.layer++ % 5);
  // the slats bent in: each one darker where it's pushed back, bright where it's folded over the next
  for (let k = -8; k <= 8; k++) {
    const y = yc + k*0.08, f = 1 - (k*0.08/rh)**2; if (f <= 0) continue;
    const hw = rw*Math.sqrt(f)*J(0.85, 1.1), sh2 = 0.35 + 0.5*(1 - f);
    D.poly([[u - hw, y - 0.035], [u + hw, y - 0.035], [u + hw*0.9, y + 0.005], [u - hw*0.9, y + 0.005]], d, [0.22*sh2 + 0.1, 0.22*sh2 + 0.1, 0.24*sh2 + 0.1]);
    D.poly([[u - hw*0.9, y + 0.005], [u + hw*0.9, y + 0.005], [u + hw*0.8, y + 0.03], [u - hw*0.8, y + 0.03]], d, [0.5, 0.5, 0.52]);
  }
  // scraped to the bare steel along where the bumper went
  for (let k = 0; k < 5 + Math.floor(E/4e3); k++) { const y = yc + J(-rh, rh)*0.6; D.line([[u - rw*J(0.8, 1.4), y], [u + rw*J(0.8, 1.4), y + J(-0.03, 0.03)]], J(0.003, 0.01), d + 0.002, [0.72, 0.72, 0.74]); }
  const m = D.mesh(W); s.r.meshes.push(m);
  dents.add({ m, r, y0: yc - rh, rec: s.r });
  FX.brk('shutter', r.x, yc, r.z, Math.min(1.3, 0.35 + E/1.5e4));
}
// a dent goes up with the shutter, into its box (and is back when it comes down)
export function stepWalls() {
  for (const q of dents) {
    if (!q.m.parent || q.rec.st === 0) { dents.delete(q); continue; }
    q.m.visible = q.r.y + q.r.h*(q.r.k ?? 0) < q.y0;
  }
}

// ---------------------------------------------------------------- shop glass
function glassAt(W, x, z, F) {
  for (const C of chunksAt(W, x, z)) for (const d of C.doors || []) {
    const S = d.cell; if (!S || !S.plan || !S.plan.glass) continue;
    const Fr = S.F, u = (x - Fr.ax)*Fr.tx + (z - Fr.az)*Fr.tz, dd = (x - Fr.ax)*Fr.nx + (z - Fr.az)*Fr.nz;
    if (Math.abs(dd) > 0.35) continue;
    const a = S.a, P0 = S.plan, w = P0.w;
    if (u < a || u > a + w) continue;
    const g0 = a + P0.door[0], g1 = a + P0.door[1];
    // (the doorway itself is open)
    if (u > g0 && u < g1) return null;
    const pane = u <= g0 ? [a, g0] : [g1, a + w];
    if (pane[1] - pane[0] < 0.1) return null;
    return { S, Fr, pane, side: u <= g0 ? 0 : 1, u, y0: S.y + 0.05, y1: S.y + P0.oh, key: paneKey(Fr, pane[0]) };
  }
  return null;
}
const paneKey = (Fr, p0) => 'gl:' + Math.round(Fr.ax*10 + p0*7) + ',' + Math.round(Fr.az*10);
// the pane taken out of the street's drawing (its run of the near and far meshes, world/buildings.js), into the
// spot's record so it's put back with the spot
function paneOut(X, r, e) { const q = { m: e.m, i0: e.i0, i1: e.i1, keep: null }; X.cut(q, true); (r.draw || (r.draw = [])).push(q); }
// a pane drawn anew (you've come back near it, or its street's been made again) while it's still lying in the road
export function paneDrawn(W, S, side, e) {
  const s = spots.get(paneKey(S.F, side ? S.a + S.plan.door[1] : S.a));
  if (s && s.stage >= 2 && s.r.st !== 0) paneOut(smash(W), s.r, e);
}
function glass(X, W, F, g, o) {
  const s = rec(X, g.key, F.ax + F.tx*F.u, F.az + F.tz*F.u);
  if (s.stage >= 2) return;                       // (already gone)
  s.E += o.E;
  const E = Math.max(o.E, s.E*0.8), Fr = g.Fr, G = { ax: Fr.ax, az: Fr.az, tx: Fr.tx, tz: Fr.tz, nx: Fr.nx, nz: Fr.nz, L: 1e4 }, D = new Decal(G);
  const u = g.u, yc = Math.min(g.y1 - 0.2, Math.max(g.y0 + 0.2, (o.y0 + o.y1)/2)), WH = [0.86, 0.9, 0.92];
  if (E < 300) { FX.brk('crackGlass', F.ax + F.tx*F.u, yc, F.az + F.tz*F.u, 0.3); return; }
  if (E < 2500 && s.stage < 1) {
    // a star: crushed white at the middle, the cracks running out straight, rings of them between
    const d = 0.016, R = Math.min(1.1, 0.25 + E/2500*0.8);
    D.fan(u, yc, ragged(u, yc, 0.04, 0.04, 8, 0.6), d, WH);
    const n = 7 + Math.floor(rnd()*5), spokes = [];
    for (let k = 0; k < n; k++) { const a = k/n*6.283 + J(-0.2, 0.2), L = R*J(0.5, 1.15), pts = []; for (let t = 0; t <= 4; t++) pts.push([u + Math.cos(a + J(-0.05, 0.05))*L*t/4, yc + Math.sin(a)*L*t/4]); spokes.push([a, L]);
      D.line(pts.map(([pu, py]) => [Math.max(g.pane[0] + 0.02, Math.min(g.pane[1] - 0.02, pu)), Math.max(g.y0, Math.min(g.y1, py))]), 0.004, d + 0.001, WH); }
    for (const rr of [0.12, 0.3]) for (let k = 0; k < n; k++) { const [a0, L0] = spokes[k], [a1, L1] = spokes[(k + 1) % n], q = rr*R; if (L0 < q || L1 < q) continue; D.line([[u + Math.cos(a0)*q, yc + Math.sin(a0)*q], [u + Math.cos(a1)*q*J(0.9, 1.1), yc + Math.sin(a1)*q*J(0.9, 1.1)]], 0.003, d + 0.002, WH); }
    s.stage = 1; s.r.meshes.push(D.mesh(W));
    FX.brk('crackGlass', F.ax + F.tx*F.u, yc, F.az + F.tz*F.u, 0.9);
    return;
  }
  // gone: the pane crazed into its little pieces round the edge where it still hangs, the middle of it fallen through
  const [p0, p1] = g.pane, d = 0.017, cw = 0.07;
  for (let y = g.y0; y < g.y1; y += cw) for (let x = p0; x < p1; x += cw) {
    const cu = x + cw/2, cy = y + cw/2, fx = Math.min(cu - p0, p1 - cu), fy = Math.min(cy - g.y0, g.y1 - cy), edge = Math.min(fx, fy);
    if (edge > J(0.06, 0.28)) continue;
    D.poly([[x + J(0, 0.01), y + J(0, 0.01)], [x + cw - J(0, 0.012), y + J(0, 0.01)], [x + cw - J(0, 0.01), y + cw - J(0, 0.012)], [x + J(0, 0.012), y + cw - J(0, 0.01)]], d, [0.66 + rnd()*0.2, 0.72 + rnd()*0.18, 0.75 + rnd()*0.17]);
  }
  // what came down: a spill of it on the step and the road, and a few big pieces falling
  const cb = new ColorBuilder(), n = Math.min(260, Math.floor((p1 - p0)*(g.y1 - g.y0)*55));
  for (let k = 0; k < n; k++) {
    const a = J(p0, p1), out = Math.pow(rnd(), 1.8)*J(0.4, 1.4), y = Math.max(0.16, g.y0 - 0.05) + 0.003, p = P(G, a, y, out);
    const gs = J(0.008, 0.02); cb.addGeo(new THREE.BoxGeometry(gs, gs*0.6, gs*J(0.7, 1.2)), _m.compose(new V3(p[0], p[1] + gs*0.3, p[2]), _q.setFromEuler(_e.set(0, J(0, 3), 0)), _s), [0.74, 0.82, 0.84]);
  }
  const spill = new THREE.Mesh(cb.build(), W.mats.prop); spill.matrixAutoUpdate = false; spill.receiveShadow = true; W.scene.add(spill); s.r.meshes.push(spill);
  for (let k = 0; k < 10; k++) {
    const sb = new ColorBuilder(), sw = J(0.05, 0.16); sb.addGeo(new THREE.BoxGeometry(sw, sw*J(0.6, 1.4), 0.008), _m.identity(), [0.6, 0.7, 0.72]);
    const pc = pieceOf(sb.build(), [{ tris: [...Array(12).keys()] }]), p = P(G, J(p0 + 0.1, p1 - 0.1), J(g.y0 + 0.3, g.y1 - 0.2), 0.03);
    const b = X.body(s.r, pc, _m.makeTranslation(p[0], p[1], p[2]), 0.12, 'glass', {});
    b.v.set(G.nx*J(0.2, 1.2), J(-0.5, 0.3), G.nz*J(0.2, 1.2)); b.w.set(J(-6, 6), J(-6, 6), J(-6, 6));
  }
  // and the pane itself is gone, only its edges left in the frame
  const pl = g.S.draw && g.S.draw[g.side];
  if (pl) for (const e of pl) if (e.m.parent) paneOut(X, s.r, e);
  s.stage = 2; s.r.meshes.push(D.mesh(W));
  FX.brk('shatter', F.ax + F.tx*F.u, yc, F.az + F.tz*F.u, Math.min(1.2, 0.6 + E/1e4));
}
