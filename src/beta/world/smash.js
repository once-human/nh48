// Everything standing in the street can be knocked down, by what would knock it down, and it goes as that thing goes.
// What breaks it is the energy of the blow into it, less what the striker's own front crumples away (a scooter folds
// up on a lamp post a car would flatten: the blow counts by 1/2 m v^2 * m/(m + 500)), and what's been taken already.
//   a steel street lamp or a signal leans over at its foot from a knock, and past that it folds over there and lies in
//   the road from where it stood, its light gone
//   a concrete electric pole cracks at the base and leans, and hit harder it snaps: the stump stays, the pole falls
//   free, grit and lumps of concrete off the break
//   a stall or a cart is shoved over as one thing and what's on it spills (the glasses, the fruit, the kettle); hit
//   hard the wooden ones come apart, planks, roof sheet, wheels
//   a round into a lamp's head breaks it and its light goes out
// Each piece is the prop's own parts as a rigid body (world/debris.js). What's down stays down: put back only once
// you've been well away for a few minutes and it's out of sight, nothing seen going back. Nothing fades.
// (What's heavy and solid, a Metro pier, a column, a wall, doesn't break: it stops you and dents you, as before.)
import * as THREE from 'three';
import { ColorBuilder } from '@orig/world/geo.js';
import { InstancedSet } from '@orig/world/props.js';
import { Debris, partsOf, pieceOf } from './debris.js';
import { FX } from './smashfx.js';
import { view } from './view.js';
import { hash1 } from '@orig/core/util.js';

// kg; h: how tall (for shots); J: bend / lean, break, what breaking it takes out of the striker; tip: a stall goes over
export const SPEC = {
  lamp: { mass: 160, h: 8.4, mat: 'steel', bend: 5e3, brk: 18e3, absorb: 14e3, mode: 'fold', base: 0.3, snd: 'steelFold' },
  signal: { mass: 110, h: 3.8, mat: 'steel', bend: 4e3, brk: 14e3, absorb: 10e3, mode: 'fold', base: 0.075, snd: 'steelFold' },
  pole: { mass: 650, h: 8.5, mat: 'rcc', bend: 15e3, brk: 38e3, absorb: 30e3, mode: 'snap', base: 1.35, snd: 'rccSnap' },
  stall0: { mass: 140, h: 2.4, mat: 'wood', tip: 2.5e3, brk: 7e3, absorb: 3e3, mode: 'cart', snd: 'wood', goods: 'glass' },          // tapri
  stall1: { mass: 110, h: 2.3, mat: 'wood', tip: 2e3, brk: 6e3, absorb: 2.5e3, mode: 'cart', snd: 'wood', goods: 'plastic' },       // paan
  stall2: { mass: 90, h: 2.3, mat: 'steel', tip: 1.2e3, brk: 9e3, absorb: 3e3, mode: 'cart', snd: 'tin', goods: 'glass' },          // vada pav
  stall3: { mass: 130, h: 1.4, mat: 'wood', tip: 1.2e3, brk: 6e3, absorb: 2.5e3, mode: 'cart', snd: 'wood', goods: 'fruit' },       // fruit
  stall4: { mass: 35, h: 2.1, mat: 'bamboo', tip: 300, brk: 900, absorb: 400, mode: 'cart', snd: 'bamboo', goods: 'cloth' },       // flowers
  // drawn in with the street (world/propsChunk.js), so no lean: they stand or they go, free, over on their own weight
  board: { mass: 40, h: 2.9, mat: 'steel', bend: 1e3, brk: 3e3, absorb: 1.5e3, mode: 'fold', free: true, base: -1, snd: 'steelFold' },   // a street-name board on its two posts
  banner: { mass: 15, h: 2.9, mat: 'bamboo', bend: 60, brk: 160, absorb: 100, mode: 'fold', free: true, base: -1, snd: 'bamboo' },     // a banner on its bamboo frame: a kick has it over
  bus: { mass: 300, h: 3.3, mat: 'steel', bend: 1e4, brk: 4e4, absorb: 2.5e4, mode: 'fold', free: true, base: -1, snd: 'steelFold' },   // a bus shelter
  // a young tree, a trunk 0.15 m across the middle: a thicker one by the cube of how much thicker (world/trees.js has which are small)
  tree: { mass: 120, h: 6, mat: 'wood', bend: 3e3, brk: 1e4, absorb: 5e3, mode: 'tree', snd: 'wood' },
  stall5: { mass: 220, h: 2.5, mat: 'steel', tip: 3.5e3, brk: 12e3, absorb: 5e3, mode: 'cart', snd: 'tin', goods: 'wood' },         // ganna
};
const KEEP = 240, AWAY = 140, CELL = 8;
const hsh = (n) => { const s = Math.sin(n*12.9898 + 78.233)*43758.5453; return s - Math.floor(s); };
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3();

export function smash(W) { return W.smash || (W.smash = new Smash(W)); }

class Smash {
  constructor(W) {
    this.W = W; this.byMesh = new Map(); this.lines = new Set(); this.sag = []; this.by = new Map(); this.grid = new Map(); this.down = new Set(); this.t = 0; this.chk = 0; this.nSnd = 0; this.sndT = 0;
    this.debris = new Debris();
    this.debris.onLand = (b, v) => { if (this.nSnd++ < 6) FX.land(b.mat, b.p.x, b.p.y, b.p.z, v, b.m); };
  }
  // ---------------------------------------------------------------- what's standing where
  // a thing (by its kind and spot) and what of it there is: items drawn ([set, item]), its solids, its lamp, its signal head
  reg(kind, x, z, ry, o = {}) {
    const id = kind + ':' + Math.round(x*10) + ',' + Math.round(z*10);
    let r = this.by.get(id);
    if (!r) {
      r = { id, kind, x, z, ry, y: 0.15, items: [], cols: [], dmg: 0, tilt: new THREE.Vector3(), st: 0, dark: false, bodies: [], meshes: [], m0: new Map(), tb: 0 };
      this.by.set(id, r);
      const k = Math.floor(x/CELL) + ',' + Math.floor(z/CELL); let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(r);
    }
    if (o.items) for (const [set, it] of o.items) {
      if (!it) continue;
      const i = r.items.findIndex(e => e[0] === set);
      if (i >= 0) r.items[i] = [set, it]; else r.items.push([set, it]);
      r.y = it.m[13]; r.m0.set(it, Float32Array.from(it.m));
      if (r.st === 2 || (r.dark && set === this.W.lampSet)) it.off = true;
      else if (r.st === 1) this.lean(r, it);
    }
    if (o.cols) { for (const c of o.cols) if (c) { r.cols.push(c); if (r.st === 2) c.off = true; } if (r.cols.length > 96) r.cols.splice(0, r.cols.length - 96); }
    if (o.lamp) { r.lamp = o.lamp; if (r.dark || r.st === 2) o.lamp.out = true; }
    if (o.head) { r.head = o.head; if (r.st === 2) o.head.dead = true; }
    if (o.tree != null) {
      r.ti = o.tree; const f = o.tr/0.15, B = SPEC.tree;
      r.S = Object.assign({}, B, { mass: B.mass*f*f, bend: B.bend*f*f*f, brk: B.brk*f*f*f, absorb: B.absorb*f*f*f, h: o.h || B.h });
      if (r.st === 2) { const T = this.W.trees; if (T) (T.dead || (T.dead = new Set())).add(o.tree); }
    }
    // its run of triangles in its street's mesh: [mesh, first index, end]
    if (o.draw) {
      r.draw = (r.draw || []).filter(e => e.m.parent);
      for (const d of o.draw) if (d) {
        const e = { m: d[0], i0: d[1], i1: d[2], keep: null }; r.draw.push(e);
        let l = this.byMesh.get(e.m); if (!l) this.byMesh.set(e.m, l = new Set()); l.add(r);
        if (r.st === 2) this.cut(e, true);
      }
    }
    return r;
  }
  // a run taken out of its mesh (every index the same: nothing to draw) or put back
  cut(e, out) {
    const ix = e.m.geometry.index; if (!ix || !ix.array) return;
    const a = ix.array;
    if (out) { if (!e.keep) e.keep = a.slice(e.i0, e.i1); a.fill(0, e.i0, e.i1); }
    else if (e.keep) { a.set(e.keep, e.i0); e.keep = null; } else return;
    ix.needsUpdate = true;
  }
  // a street let go: what was drawn in it no longer is
  unmesh(...ms) {
    for (const m of ms) { if (!m) continue; const l = this.byMesh.get(m); if (!l) continue; for (const r of l) r.draw = r.draw.filter(e => e.m !== m); this.byMesh.delete(m); }
  }
  // a street's wires, pole to pole (6 lengths a wire, 5 wires a span: world/propsChunk.js). A pole that's down already
  // has its own down as the street comes in
  wired(line) {
    const w = { line, a: line.geometry.attributes.position };
    this.lines.add(w);
    for (const r of this.down) if (r.kind === 'pole' && r.st === 2) { const sp = this.spans(r, w); for (const q of sp) this.hang(q, 1); if (sp.length) { r.spans.push(...sp); w.a.needsUpdate = true; } }
    return w;
  }
  unwire(w) { this.lines.delete(w); for (const r of this.down) if (r.spans) r.spans = r.spans.filter(q => q.w !== w); this.sag = this.sag.filter(q => q.w !== w); }
  // the wires that run to this pole: [{ w, i (first corner), end (0: the pole's at its start, 1: at its end), keep }]
  spans(r, w) {
    const A = w.a.array, out = [];
    for (let i = 0; i + 11 < w.a.count; i += 12) {
      const d0 = Math.hypot(A[i*3] - r.x, A[i*3 + 2] - r.z), d1 = Math.hypot(A[(i + 11)*3] - r.x, A[(i + 11)*3 + 2] - r.z);
      if (d0 < 1 || d1 < 1) out.push({ w, i, end: d0 < 1 ? 0 : 1, keep: A.slice(i*3, i*3 + 36) });
    }
    return out;
  }
  // a wire let go at one end: down from the pole that's still up, slack, to the road where the other one was. k: how far down
  hang(q, k) {
    const A = q.w.a.array, K = q.keep, f = q.end ? K[1] : K[34];       // (how high it's still held: the far end's corner)
    for (let j = 0; j < 12; j++) {
      const u = (Math.floor(j/2) + (j%2))/6, t = q.end ? u : 1 - u;      // (t: 0 at the end still held, 1 at the pole)
      const y = Math.max(0.18, f*(1 - t) + 0.2*t - 1.6*t*(1 - t));
      A[(q.i + j)*3 + 1] = K[j*3 + 1] + (y - K[j*3 + 1])*k;
    }
  }
  near(x, z, rad, fn) {
    const i0 = Math.floor((x - rad)/CELL), i1 = Math.floor((x + rad)/CELL), j0 = Math.floor((z - rad)/CELL), j1 = Math.floor((z + rad)/CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = this.grid.get(i + ',' + j); if (l) for (const r of l) fn(r); }
  }
  // drawn as it now is this very frame (the sets are only gone through every fifth of a second: the post would stand a
  // moment beside itself falling)
  dirty() {
    const W = this.W, G = window.__nhAskG, c = G && G.camera;
    W._propX = undefined; W._lampsDirty = true; if (window.__post && window.__post.shadows) window.__post.shadows.dirty = true;
    if (c && window.__updateProps) try { window.__updateProps(W, c.position.x, c.position.z); } catch (e) { /* next time round */ }
  }
  // its turn and lean, as a matrix about its foot
  frame(r, out) {
    const a = r.tilt.length();
    _q.setFromAxisAngle(_ax.set(0, 1, 0), r.ry);
    out.compose(_v.set(r.x, r.y, r.z), _q, _s.set(1, 1, 1));
    if (a > 1e-4) { _m2.makeRotationAxis(_ax.set(r.tilt.z, 0, -r.tilt.x).normalize(), a); out.premultiply(_m.makeTranslation(-r.x, -r.y, -r.z)).premultiply(_m2).premultiply(_m.makeTranslation(r.x, r.y, r.z)); }
    return out;
  }
  lean(r, it) {
    const m0 = r.m0.get(it); if (!m0) return;
    const a = r.tilt.length(); if (a < 1e-4) { it.m.set(m0); return; }
    _m.fromArray(m0); _m2.makeRotationAxis(_ax.set(r.tilt.z, 0, -r.tilt.x).normalize(), a);
    const T = new THREE.Matrix4().makeTranslation(r.x, r.y, r.z), Ti = new THREE.Matrix4().makeTranslation(-r.x, -r.y, -r.z);
    _m.premultiply(Ti).premultiply(_m2).premultiply(T); _m.toArray(it.m);
  }
  // ---------------------------------------------------------------- a blow
  // o: { E (what the blow brings, after the striker's own crumpling), px, py, pz (where), nx, nz (into it), u (how fast the
  // striker goes on, m/s, if it does), m (striker kg), by: 'car' | 'kick' | 'shot' }. Returns { broke, absorb, carried }
  hit(r, o) {
    const S = r.S || SPEC[r.kind]; if (!S || r.st === 2) return null;
    const tot = o.E + r.dmg;
    let out = { broke: false, absorb: 0, carried: 0 };
    if (S.mode === 'cart') {
      if (tot >= S.brk) out = this.apart(r, o, false);
      else if (tot >= S.tip) out = this.apart(r, o, true);
      else if (o.by !== 'shot') FX.knock(S.mat, o.px, o.py, o.pz, Math.min(1, 0.3 + o.E/S.tip));
    } else if (tot >= S.brk) out = S.mode === 'tree' ? this.fell(r, o) : this.fall(r, o, tot);
    else if (o.E >= S.bend*0.6 && o.by === 'car' && r.items.length) {
      // it gives at its foot, by how much past giving the blow was
      const da = Math.min(0.3, Math.max(0, (o.E - S.bend*0.6)/(S.brk - S.bend*0.6))*0.32 + 0.02);
      r.tilt.x += o.nx*da; r.tilt.z += o.nz*da; if (r.tilt.length() > 0.42) r.tilt.setLength(0.42);
      r.st = 1; r.tb = this.t; this.down.add(r);
      for (const [, it] of r.items) this.lean(r, it);
      this.dirty();
      FX.brk(S.mat === 'rcc' ? 'rccSnap' : 'steelFold', r.x, r.y + 0.5, r.z, 0.35 + da*1.5);
    } else if (o.by !== 'shot') FX.knock(S.mat, o.px, o.py, o.pz, Math.min(1, 0.25 + o.E/(S.bend || 1e3)));
    r.dmg += o.E*0.5;
    return out;
  }
  // gone from the street: not drawn, not solid, its light off
  gone(r) {
    for (const [, it] of r.items) it.off = true;
    if (r.deadIt) r.deadIt.off = true;
    for (const c of r.cols) c.off = true;
    if (r.lamp) r.lamp.out = true;
    if (r.head) r.head.dead = true;
    if (r.draw) for (const e of r.draw) this.cut(e, true);
    r.st = 2; r.tb = this.t; this.down.add(r);
    this.dirty();
  }
  mesh(geo) { const m = new THREE.Mesh(geo, this.W.mats.prop); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; (this.W.scene).add(m); return m; }
  // a piece as a body, where it stood (F: the thing's frame)
  body(r, pc, F, mass, mat, extra) {
    const p = pc.c.clone().applyMatrix4(F), q = new THREE.Quaternion().setFromRotationMatrix(_m.extractRotation(F));
    const b = this.debris.add(Object.assign({ mesh: this.mesh(pc.geo), p, q, m: Math.max(0.2, mass), half: pc.half, pts: pc.pts, mat }, extra));
    this.debris.iw(b);
    r.bodies.push(b);
    return b;
  }
  // a push at a world point on a body
  push(b, px, py, pz, jx, jy, jz) { this.debris.iw(b); this.debris.impulse(b, new THREE.Vector3(px - b.p.x, py - b.p.y, pz - b.p.z), new THREE.Vector3(jx, jy, jz)); }
  stub(r, pc, F) { const m = this.mesh(pc.geo); m.matrix.copy(F).multiply(_m.makeTranslation(pc.c.x, pc.c.y, pc.c.z)); m.matrixWorld.copy(m.matrix); r.meshes.push(m); }
  geoOf(r) { const P = this.W.proto; return r.kind === 'lamp' ? P.lampDead || P.lamp : r.kind === 'board' ? P.streetBoard : r.kind === 'banner' ? P.bannerFrame : P[r.kind]; }
  // the sign on it (its run of the street's sign quads), as part of the piece it's on
  signOn(r, b) {
    const e = r.draw && r.draw.find(q => q.m.material === this.W.mats.oldSign); if (!e) return;
    const g0 = e.m.geometry, ix = e.keep || g0.index.array.slice(e.i0, e.i1), A = g0.attributes, n = ix.length;
    const inv = b.mesh.matrix.clone().invert(), nm = new THREE.Matrix3().getNormalMatrix(inv);
    const P = new Float32Array(n*3), N = new Float32Array(n*3), U = new Float32Array(n*2);
    for (let k = 0; k < n; k++) {
      const i = ix[k];
      _v.fromBufferAttribute(A.position, i).applyMatrix4(inv); P.set([_v.x, _v.y, _v.z], k*3);
      _v.fromBufferAttribute(A.normal, i).applyMatrix3(nm).normalize(); N.set([_v.x, _v.y, _v.z], k*3);
      U[k*2] = A.uv.getX(i); U[k*2 + 1] = A.uv.getY(i);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    const m = new THREE.Mesh(g, e.m.material); m.receiveShadow = true; b.mesh.add(m); b.mesh.updateMatrixWorld();
  }

  // ---- a post: folds over at its foot (steel) or snaps there (concrete)
  fall(r, o, tot) {
    const S = r.S || SPEC[r.kind], geo = this.geoOf(r); if (!geo) { this.gone(r); return { broke: true, absorb: S.absorb, carried: 0 }; }
    const parts = partsOf(geo), F = this.frame(r, new THREE.Matrix4());
    const low = parts.filter(p => p.max.y <= S.base + 1e-3), up = parts.filter(p => p.max.y > S.base + 1e-3);
    this.gone(r);
    if (low.length) this.stub(r, pieceOf(geo, low), F);
    if (!up.length) return { broke: true, absorb: S.absorb, carried: 0 };
    const pc = pieceOf(geo, up), snap = S.mode === 'snap', torn = !snap && tot > S.brk*3.2;
    const pinL = new THREE.Vector3(0, S.base + 0.02, 0).sub(pc.c);
    const b = this.body(r, pc, F, S.mass, S.mat, snap || torn || S.free ? {} : { pin: new THREE.Vector3(0, S.base + 0.02, 0).applyMatrix4(F), pinLocal: pinL, stiff: 2.2 });
    if (r.draw) { this.signOn(r, b); r.top = b; r.top0 = b.mesh.matrix.clone(); }
    // the blow, where it struck, carried on by what struck it
    const u = Math.max(1, o.u ?? 2), J = S.mass*u*(snap ? 0.45 : 0.35);
    this.push(b, o.px, Math.max(r.y + S.base + 0.15, o.py), o.pz, o.nx*J, J*0.05, o.nz*J);
    if (snap) {
      // grit and lumps off the break
      for (let k = 0; k < 6; k++) {
        const s = 0.05 + hsh(k + r.x)*0.09, cb = new ColorBuilder(); cb.addGeo(new THREE.IcosahedronGeometry(s, 0), _m.makeScale(1, 0.7 + hsh(k*3 + r.z)*0.5, 1), [0.6, 0.59, 0.55]);
        const pr = pieceOf(cb.build(), [{ tris: [...Array(20).keys()] }]);
        const a = hsh(k*7 + r.z)*6.283, rb = this.body(r, pr, _m2.makeTranslation(r.x + Math.cos(a)*0.15, r.y + S.base - 0.1 - hsh(k)*0.4, r.z + Math.sin(a)*0.15), 0.4 + s*8, 'rcc', {});
        rb.v.set(o.nx*u*0.5 + Math.cos(a)*1.4, 1 + hsh(k*11)*1.6, o.nz*u*0.5 + Math.sin(a)*1.4); rb.w.set(hsh(k)*8 - 4, hsh(k + 1)*8 - 4, hsh(k + 2)*8 - 4);
      }
    }
    // its wires come down with it, sagging to the road from the next poles
    if (r.kind === 'pole') { r.spans = []; for (const w of this.lines) r.spans.push(...this.spans(r, w)); for (const q of r.spans) this.sag.push(Object.assign(q, { t: 0 })); }
    FX.brk(S.snd, r.x, r.y + 0.6, r.z, 1);
    if (r.kind === 'lamp' && !r.dark) FX.brk('glass', r.x, r.y + 7, r.z, 0.5);
    return { broke: true, absorb: S.absorb, carried: S.mass*0.25 };
  }
  // ---- a young tree: snaps at its foot and comes down whole, crown and all, drawn as it stood (world/trees.js) but
  // with nothing of the near-to-far handover, so it's there whatever the distance until it's put back
  fell(r, o) {
    const S = r.S || SPEC.tree, T = this.W.trees, t = r.ti;
    this.gone(r);
    if (!T || t == null || !T.arch || !T.sets) return { broke: true, absorb: S.absorb, carried: 0 };
    (T.dead || (T.dead = new Set())).add(t); T.lastX = 1e9;
    const k = T.k[t], A = T.arch[k], set = T.sets[k], s = T.s[t], ro = T.r[t];
    const sx = s*(0.92 + hash1(t*3.3)*0.16), sy = s*(0.9 + hash1(t*5.1)*0.2), y0 = 0.12 + T.y[t], tr = A.trunkR*s;
    const mk = (m) => new THREE.ShaderMaterial({ vertexShader: m.vertexShader, fragmentShader: m.fragmentShader, uniforms: m.uniforms, vertexColors: m.vertexColors, side: m.side });
    const fm = (T._fm || (T._fm = []))[k] || (T._fm[k] = [mk(set.nb.material), mk(set.nl.material)]);
    const bb = A.near.l.boundingBox || (A.near.l.computeBoundingBox(), A.near.l.boundingBox), b0 = A.near.b.boundingBox || (A.near.b.computeBoundingBox(), A.near.b.boundingBox);
    const H = Math.max(bb.max.y, b0.max.y)*sy, cm = new THREE.Vector3(0, H*0.38, 0);
    const Q = new THREE.Quaternion().setFromAxisAngle(_ax.set(0, 1, 0), ro);
    const M = new THREE.Matrix4().compose(new THREE.Vector3(0, -cm.y, 0), Q, new THREE.Vector3(sx, sy, sx));
    const g = new THREE.Group();
    for (const [geo, mat, leaf] of [[A.near.b, fm[0], false], [A.near.l, fm[1], true]]) {
      const im = new THREE.InstancedMesh(geo, mat, 1); im.setMatrixAt(0, M); im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      if (leaf && T.leafShadow) im.customDepthMaterial = T.leafShadow;
      g.add(im);
    }
    this.W.scene.add(g);
    // what it lies on: its foot, along its trunk, and round its crown
    const pts = [], P = (x, y, z) => pts.push(new THREE.Vector3(x, y, z).applyQuaternion(Q).setY(y - cm.y));
    for (const h of [0, 0.25, 0.5]) for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) P(a*tr, H*h, c*tr);
    const cx = (bb.min.x + bb.max.x)/2*sx, cz = (bb.min.z + bb.max.z)/2*sx, hx = (bb.max.x - bb.min.x)/2*sx, hz = (bb.max.z - bb.min.z)/2*sx, y1 = bb.min.y*sy, y2 = bb.max.y*sy, ym = (y1 + y2)/2;
    for (const a of [-1, 1]) for (const c of [-1, 1]) { P(cx + a*hx*0.7, y1 + (ym - y1)*0.3, cz + c*hz*0.7); P(cx + a*hx*0.7, y2 - (y2 - ym)*0.3, cz + c*hz*0.7); }
    P(cx + hx, ym, cz); P(cx - hx, ym, cz); P(cx, ym, cz + hz); P(cx, ym, cz - hz); P(cx, y2, cz);
    const p = new THREE.Vector3(T.x[t], y0, T.z[t]).add(cm);
    const b = this.debris.add({ mesh: g, p, q: new THREE.Quaternion(), m: S.mass, half: new THREE.Vector3(Math.max(0.3, hx*0.6), H/2, Math.max(0.3, hz*0.6)), pts, mat: 'wood', keepGeo: true });
    this.debris.iw(b); r.bodies.push(b);
    const J = S.mass*Math.max(1, o.u ?? 2)*0.45;
    this.push(b, o.px, Math.max(y0 + 1.2, o.py), o.pz, o.nx*J, 0, o.nz*J);
    FX.brk('wood', r.x, y0 + 0.5, r.z, 1); FX.brk('cloth', r.x, y0 + H*0.6, r.z, 1.5);
    return { broke: true, absorb: S.absorb, carried: S.mass*0.3 };
  }
  // ---- a stall: over as one (tip), or into its pieces
  apart(r, o, tip) {
    const S = r.S || SPEC[r.kind], geo = this.geoOf(r); if (!geo) { this.gone(r); return { broke: true, absorb: S.absorb, carried: S.mass }; }
    const parts = partsOf(geo), F = this.frame(r, new THREE.Matrix4()), Fi = F.clone().invert();
    const big = (p) => Math.max(p.size.x, p.size.y, p.size.z);
    const goods = parts.filter(p => big(p) < 0.3), frame = parts.filter(p => big(p) >= 0.3);
    this.gone(r);
    // what the striker shoves along: the stall moves off at what the two would go at together
    const u = Math.max(0.6, o.u ?? 1.5), m = o.m || 1000, w = u*Math.min(1.25, m/(m + S.mass)*1.15);
    const lp = new THREE.Vector3(o.px, o.py, o.pz).applyMatrix4(Fi);         // (where it was struck, in its own frame)
    const groups = [];
    if (tip) groups.push(frame);
    else {
      // the frame by where its parts are: a plank, a side, the roof, a wheel each go their own way
      const cells = new Map();
      for (const p of frame) { const k = Math.floor(p.c.x/0.65) + ',' + Math.floor(p.c.y/0.9) + ',' + Math.floor(p.c.z/0.65); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(p); }
      groups.push(...cells.values());
    }
    const fm = frame.reduce((s, p) => s + p.size.x*p.size.y*p.size.z + 1e-4, 0);
    let seq = 0;
    for (const g of groups) {
      if (!g.length) continue;
      const pc = pieceOf(geo, g), vol = g.reduce((s, p) => s + p.size.x*p.size.y*p.size.z + 1e-4, 0), mass = S.mass*0.8*vol/fm;
      // a roof sheet up high, flat and wide, is tin whatever the stall's made of
      const mat = pc.half.y < 0.06 && pc.c.y > 1.7 && pc.half.x > 0.4 ? 'tin' : S.mat;
      const b = this.body(r, pc, F, mass, mat, {});
      if (tip) this.push(b, o.px, o.py, o.pz, o.nx*mass*w, mass*0.6, o.nz*mass*w);
      else {
        const d = pc.c.distanceTo(lp), f = 1.25 - 0.5*Math.min(1, d/1.6), h = hsh(++seq + r.x*3.1);
        b.v.set(o.nx*w*f + (h - 0.5)*1.6, 0.6 + hsh(seq + 9)*1.8*f, o.nz*w*f + (hsh(seq + 4) - 0.5)*1.6);
        b.w.set((hsh(seq + 1) - 0.5)*7, (hsh(seq + 2) - 0.5)*5, (hsh(seq + 3) - 0.5)*7);
      }
    }
    // what's on it spills: each thing its own (bunched up past forty)
    let gs = goods;
    if (gs.length > 40) { const cells = new Map(); for (const p of gs) { const k = Math.floor(p.c.x/0.3) + ',' + Math.floor(p.c.y/0.3) + ',' + Math.floor(p.c.z/0.3); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(p); } gs = [...cells.values()]; }
    else gs = gs.map(p => [p]);
    for (const g of gs) {
      const pc = pieceOf(geo, g), b = this.body(r, pc, F, Math.max(0.15, S.mass*0.2/gs.length), S.goods || S.mat, {}), h = hsh(++seq + r.z*1.7);
      b.v.set(o.nx*w*(0.9 + h*0.6) + (hsh(seq + 5) - 0.5)*2, 0.8 + hsh(seq + 6)*2.2, o.nz*w*(0.9 + h*0.6) + (hsh(seq + 7) - 0.5)*2);
      b.w.set((hsh(seq + 1) - 0.5)*10, (hsh(seq + 2) - 0.5)*10, (hsh(seq + 3) - 0.5)*10);
    }
    FX.brk(tip ? (S.mat === 'steel' ? 'tin' : 'wood') : S.snd, r.x, r.y + 0.8, r.z, tip ? 0.7 : 1);
    if (S.goods === 'glass' || S.goods === 'fruit' || S.goods === 'plastic') FX.brk(S.goods, r.x, r.y + 1, r.z, 0.7);
    return { broke: true, absorb: tip ? S.tip*0.5 : S.absorb, carried: tip ? S.mass : S.mass*0.5 };
  }
  // ---- a lamp's head shot out: the glass comes down, the light's gone
  darken(r) {
    if (r.dark || r.st === 2 || r.kind !== 'lamp') return false;
    const W = this.W, P = W.proto;
    r.dark = true;
    if (P.lampDead) {
      if (!W.lampDeadSet) { W.lampDeadSet = new InstancedSet(W.scene, P.lampDead, W.mats.propI, 256, W.lampSet.range, { cast: W.quality.shadows }); W.lampDeadSet.mesh.shadowStill = true; W.instSets.push(W.lampDeadSet); }
      const e = r.items.find(q => q[0] === W.lampSet);
      if (e) { e[1].off = true; const mm = new THREE.Matrix4().fromArray(e[1].m); r.deadIt = W.lampDeadSet.add(r.x, r.z, mm); }
    }
    if (r.lamp) r.lamp.out = true;
    // the head's glass in bits, off the head and down
    const F = this.frame(r, new THREE.Matrix4()), hp = new THREE.Vector3(1.75, 8.05, 0).applyMatrix4(F);
    for (let k = 0; k < 7; k++) {
      const cb = new ColorBuilder(), s = 0.03 + hsh(k + r.x)*0.05; cb.addGeo(new THREE.BoxGeometry(s, 0.006, s*0.8), new THREE.Matrix4(), [0.92, 0.94, 0.95], 0.2);
      const pc = pieceOf(cb.build(), [{ tris: [...Array(12).keys()] }]);
      const b = this.body(r, pc, _m.makeTranslation(hp.x + (hsh(k*3) - 0.5)*0.4, hp.y, hp.z + (hsh(k*5) - 0.5)*0.2), 0.02, 'glass', {});
      b.v.set((hsh(k*7) - 0.5)*1.5, -0.5 - hsh(k)*0.5, (hsh(k*9) - 0.5)*1.5); b.w.set(hsh(k)*12 - 6, hsh(k + 3)*12 - 6, hsh(k + 6)*12 - 6);
    }
    r.tb = this.t; this.down.add(r); this.dirty();
    FX.brk('glass', hp.x, hp.y, hp.z, 0.9);
    return true;
  }
  // ---------------------------------------------------------------- every step
  // cars: the vehicles pieces can meet ([{ x, z, hx, hz, a, b, y0, y1, vx, vz }])
  tick(dt, cars) {
    this.t += dt; this.sndT -= dt; if (this.sndT <= 0) { this.sndT = 0.1; this.nSnd = 0; }
    if (this.debris.list.length) this.debris.step(dt, this.W, cars);
    if (this.sag.length) {
      const up = new Set();
      for (const q of this.sag) { q.t = Math.min(1, q.t + dt/1.3); this.hang(q, q.t*q.t); up.add(q.w.a); }
      for (const a of up) a.needsUpdate = true;
      this.sag = this.sag.filter(q => q.t < 1);
    }
    if ((this.chk -= dt) > 0) return;
    this.chk = 0.5;
    const G = window.__nhAskG, cam = G && G.camera, W = this.W;
    // a broken signal stays dark (its bulbs are laid out again whenever a tile comes or goes)
    const B = W.signalBulbs;
    if (B) { let ch = false; for (const r of this.down) if (r.head && r.head.dead) for (const i of r.head.bulbs) { B.getMatrixAt(i, _m); if (_m.elements[0] !== 0 || _m.elements[5] !== 0) { B.setMatrixAt(i, _m.makeScale(0, 0, 0)); ch = true; } } if (ch) B.instanceMatrix.needsUpdate = true; }
    if (!cam) return;
    // put back what's been down a while, once you're well away and it's out of sight
    for (const r of this.down) {
      if (this.t - r.tb < KEEP) continue;
      const d = Math.hypot(r.x - cam.position.x, r.z - cam.position.z);
      if (d < AWAY || view.sees(r.x, r.z, 0, 30)) continue;
      if (r.bodies.some(b => Math.hypot(b.p.x - cam.position.x, b.p.z - cam.position.z) < AWAY || view.sees(b.p.x, b.p.z, 0, 30))) continue;
      this.restore(r);
    }
  }
  restore(r) {
    for (const b of r.bodies) { this.debris.remove(b); if (b.mesh) { b.mesh.parent && b.mesh.parent.remove(b.mesh); b.mesh.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.geometry && !b.keepGeo) o.geometry.dispose(); }); } }
    if (r.ti != null && this.W.trees && this.W.trees.dead) { this.W.trees.dead.delete(r.ti); this.W.trees.lastX = 1e9; }
    if (r.draw) { r.draw = r.draw.filter(e => e.m.parent); for (const e of r.draw) this.cut(e, false); }
    r.top = null;
    if (r.spans) { for (const q of r.spans) { q.w.a.array.set(q.keep, q.i*3); q.w.a.needsUpdate = true; } this.sag = this.sag.filter(q => !r.spans.includes(q)); r.spans = null; }
    for (const m of r.meshes) { m.parent && m.parent.remove(m); m.geometry.dispose(); }
    r.bodies = []; r.meshes = [];
    r.tilt.set(0, 0, 0);
    for (const [, it] of r.items) { it.off = false; const m0 = r.m0.get(it); if (m0) it.m.set(m0); }
    if (r.deadIt) { r.deadIt.off = true; const S = this.W.lampDeadSet; if (S) S.items = S.items.filter(q => q !== r.deadIt); r.deadIt = null; }
    for (const c of r.cols) c.off = false;
    if (r.lamp) r.lamp.out = false;
    if (r.head) r.head.dead = false;
    r.st = 0; r.dmg = 0; r.dark = false;
    this.down.delete(r);
    this.dirty();
  }
}
