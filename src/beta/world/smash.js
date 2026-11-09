// Everything standing in the street can be knocked down, by what would knock it down, and it goes as that thing goes.
// What breaks it is the energy of the blow into it, less what the striker's own front crumples away (a scooter folds
// up on a lamp post a car would flatten: the blow counts by 1/2 m v^2 * m/(m + 500)), and what's been taken already.
//   a steel street lamp or a signal rings and sways from a knock (world/sway.js), bends over at its foot from a real
//   blow, and only a hard hit from a car folds it over there to lie in the road from where it stood, its light gone.
//   A signal is the stoutest of them
//   a concrete electric pole shudders, cracks at the base and leans, and hit harder it snaps: the stump stays, the pole
//   falls free, grit and lumps of concrete off the break. Its wires go with it, whatever it does
//   a stall or a cart is heavy (a tapri's counter, stove, cylinder and kettles are a third of a tonne): it takes a
//   shove to move, goes over slowly about its edge and lands with a thud, and what's on it stays on the counter until
//   it tips too far or is knocked out from under it, then spills and rolls; hit hard the wooden ones come apart
//   a round into a lamp's head breaks it and its light goes out
// Each piece is the prop's own parts as a rigid body (world/debris.js). What's down stays down: put back only once
// you've been well away for a few minutes and it's out of sight, nothing seen going back. Nothing fades.
// (What's heavy and solid, a Metro pier, a column, a wall, doesn't break: it stops you and dents you, as before.)
import * as THREE from 'three';
import { Collision } from '@orig/world/mapdata.js';
import { ColorBuilder } from '@orig/world/geo.js';
import { InstancedSet } from '@orig/world/props.js';
import { Debris, partsOf, pieceOf, lower } from './debris.js';
import * as Sway from './sway.js';
import { shake as shakeTree, treeStep, Leaves } from './treehit.js';
import { FX } from './smashfx.js';
import { view } from './view.js';
import { hash1 } from '@orig/core/util.js';

// kg; h: how tall (for shots); J: bend / lean, break, what breaking it takes out of the striker; tip: a stall goes over
export const SPEC = {
  // (a car of a tonne at 20 km/h brings ~10 kJ, at 40 ~40 kJ, at 60 ~90 kJ; a loaded bus at 40 ~460 kJ)
  lamp: { mass: 190, h: 8.4, mat: 'steel', bend: 12e3, brk: 45e3, absorb: 32e3, mode: 'fold', base: 0.3, snd: 'steelFold' },
  signal: { mass: 150, h: 3.8, mat: 'steel', bend: 15e3, brk: 60e3, absorb: 40e3, mode: 'fold', base: 0.075, snd: 'steelFold' },
  pole: { mass: 700, h: 8.5, mat: 'rcc', bend: 30e3, brk: 90e3, absorb: 65e3, mode: 'snap', base: 1.35, snd: 'rccSnap' },
  // low: how far below the middle of its box its weight sits (a share of its half height); grip: how far it tips before
  // what's on it slides off (rad)
  stall0: { mass: 340, h: 2.4, mat: 'wood', tip: 4.5e3, brk: 16e3, absorb: 6e3, mode: 'cart', snd: 'wood', goods: 'glass', low: 0.35, grip: 0.42 },          // tapri
  stall1: { mass: 300, h: 2.3, mat: 'wood', tip: 4e3, brk: 14e3, absorb: 5e3, mode: 'cart', snd: 'wood', goods: 'plastic', low: 0.3, grip: 0.4 },          // paan
  stall2: { mass: 210, h: 2.3, mat: 'steel', tip: 3e3, brk: 18e3, absorb: 5e3, mode: 'cart', snd: 'tin', goods: 'glass', low: 0.3, grip: 0.38 },           // vada pav
  stall3: { mass: 230, h: 1.4, mat: 'wood', tip: 2.6e3, brk: 12e3, absorb: 4e3, mode: 'cart', snd: 'wood', goods: 'fruit', low: 0.2, grip: 0.5, round: true }, // fruit
  stall4: { mass: 45, h: 2.1, mat: 'bamboo', tip: 400, brk: 1.4e3, absorb: 500, mode: 'cart', snd: 'bamboo', goods: 'cloth', low: 0.2, grip: 0.6 },        // flowers
  // drawn in with the street (world/propsChunk.js), so no lean: they stand or they go, free, over on their own weight
  board: { mass: 40, h: 2.9, mat: 'steel', bend: 1e3, brk: 3e3, absorb: 1.5e3, mode: 'fold', free: true, base: -1, snd: 'steelFold' },   // a street-name board on its two posts
  banner: { mass: 15, h: 2.9, mat: 'bamboo', bend: 60, brk: 160, absorb: 100, mode: 'fold', free: true, base: -1, snd: 'bamboo' },     // a banner on its bamboo frame: a kick has it over
  bus: { mass: 300, h: 3.3, mat: 'steel', bend: 1e4, brk: 4e4, absorb: 2.5e4, mode: 'fold', free: true, base: -1, snd: 'steelFold' },   // a bus shelter
  // a young tree, a trunk 0.15 m across the middle: a thicker one by the cube of how much thicker, and an old one
  // (past 0.21 m) far more than that: its wood's set hard and its roots go down as far as it's high (Smash.reg). Green
  // wood bends a long way before it goes: a hatchback has to be doing 55 to snap a young one, a sapling 40
  tree: { mass: 150, h: 6, mat: 'wood', bend: 3e3, brk: 8e4, absorb: 2e4, mode: 'tree', snd: 'wood' },
  // the footpath's own (world/vendors.js): a fruit handcart and what's on it, a cobbler's box and stool and shoes, an umbrella
  // in a cart or standing in its bucket of stones
  cart: { mass: 130, h: 1.2, mat: 'wood', tip: 1.4e3, brk: 6e3, absorb: 2e3, mode: 'cart', snd: 'wood', goods: 'fruit', low: 0.25, grip: 0.5, round: true },
  cob: { mass: 40, h: 0.6, mat: 'wood', tip: 350, brk: 2.5e3, absorb: 800, mode: 'cart', snd: 'wood', goods: 'plastic', low: 0.2, grip: 0.6, deck: -1 },
  umbC: { mass: 6, h: 2, mat: 'cloth', tip: 60, brk: 1.5e3, absorb: 60, mode: 'cart', snd: 'cloth', low: 0, deck: 9 },
  umbS: { mass: 14, h: 2.3, mat: 'cloth', tip: 90, brk: 2e3, absorb: 100, mode: 'cart', snd: 'cloth', low: -0.4, deck: 9 },
  stall5: { mass: 480, h: 2.5, mat: 'steel', tip: 7e3, brk: 30e3, absorb: 10e3, mode: 'cart', snd: 'tin', goods: 'wood', low: 0.4, grip: 0.45 },  // ganna: the crusher's iron rollers
};
const MU_GOODS = { glass: 0.5, plastic: 0.45, fruit: 0.7, cloth: 0.8, wood: 0.6 };
const KEEP = 240, AWAY = 140, CELL = 8, MODE_SWAY = new Set(['lamp', 'signal', 'pole']);
const hsh = (n) => { const s = Math.sin(n*12.9898 + 78.233)*43758.5453; return s - Math.floor(s); };
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3();

export function smash(W) { return W.smash || (W.smash = new Smash(W)); }

class Smash {
  constructor(W) {
    this.W = W; this.byMesh = new Map(); this.lines = new Set(); this.moving = new Set(); this.wst = new Map(); this.lineGen = 0; this.lineN = 0; this.by = new Map(); this.grid = new Map(); this.down = new Set(); this.t = 0; this.chk = 0; this.nSnd = 0; this.sndT = 0;
    this.debris = new Debris(); this.leaves = new Leaves(W);
    this.debris.onLand = (b, v) => { if (this.nSnd++ < 6) FX.land(b.mat, b.p.x, b.p.y, b.p.z, v, b.m); };
    this.flick = new Set();
  }
  spec(r) { return r.S || SPEC[r.kind]; }
  shake(r, o, tot) { shakeTree(this, r, o, tot); }
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
    if (o.y != null) r.y = o.y;
    if (o.geo) r.geo = o.geo;
    if (o.items) for (const [set, it] of o.items) {
      if (!it) continue;
      const i = r.items.findIndex(e => e[0] === set);
      if (i >= 0) r.items[i] = [set, it]; else r.items.push([set, it]);
      r.y = it.m[13]; r.m0.set(it, Float32Array.from(it.m));
      if (r.st === 2 || (r.dark && set === this.W.lampSet) || r.live) it.off = true;
      else if (r.st === 1) this.lean(r, it);
    }
    if (o.cols) { for (const c of o.cols) if (c) { r.cols.push(c); if (r.st === 2) c.off = true; } if (r.cols.length > 96) r.cols.splice(0, r.cols.length - 96); }
    if (o.lamp) { r.lamp = o.lamp; if (r.dark || r.st === 2) o.lamp.out = true; }
    if (o.head) { r.head = o.head; if (r.st === 2) o.head.dead = true; }
    if (o.lamp && r.lamp0 && r.st === 1) { o.lamp[0] = r.lamp[0]; o.lamp[1] = r.lamp[1]; }
    if (o.tree != null) {
      r.ti = o.tree; r.tr = o.tr; const f = o.tr/0.15, B = SPEC.tree, old = 1 + 2.5*Math.min(1, Math.max(0, (o.tr - 0.17)/0.09)), f3 = f*f*f*old;
      r.S = Object.assign({}, B, { mass: B.mass*Math.pow(f, 2.5), bend: B.bend*f3, brk: Math.max(4e4, B.brk*f3), crk: B.brk*f3*0.45, absorb: B.absorb*f3, h: o.h || B.h });
      const T = this.W.trees;
      if (r.st === 2) { if (T) (T.dead || (T.dead = new Set())).add(o.tree); }
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
    const w = { line, a: line.geometry.attributes.position, id: ++this.lineN };
    this.lines.add(w); this.lineGen++;
    Sway.rehang(this, w);
    return w;
  }
  unwire(w) { this.lines.delete(w); this.lineGen++; Sway.forget(this, w); }
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
    if (r.live) return;
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
    else if (S.mode === 'tree') this.shake(r, o, tot);
    else if (o.E >= S.bend*0.6 && o.by === 'car' && r.items.length) {
      // it gives at its foot, by how much past giving the blow was, quickly, and rings on where it's bent to
      const da = Math.min(0.3, Math.max(0, (o.E - S.bend*0.6)/(S.brk - S.bend*0.6))*0.3 + 0.015);
      Sway.kick(this, r, o.nx, o.nz, da, o.E);
      FX.brk(S.mat === 'rcc' ? 'rccSnap' : 'steelFold', r.x, r.y + 0.5, r.z, 0.3 + da*1.5);
    } else {
      if (r.items.length && MODE_SWAY.has(r.kind)) Sway.kick(this, r, o.nx, o.nz, 0, o.E);
      if (o.by !== 'shot') FX.knock(S.mat, o.px, o.py, o.pz, Math.min(1, 0.25 + o.E/(S.bend || 1e3)));
    }
    r.dmg += o.E*0.5;
    if (r.lamp && r.st !== 2 && !r.dark) this.flicker(r, o.E, S);
    return out;
  }
  // ---- a lamp knocked: its tube stutters, off and on, longer the harder it was hit, and settles back on
  flicker(r, E, S) {
    r.fl = Math.max(r.fl || 0, Math.min(3, 0.6 + 2.4*E/(S.brk || 4e4))); r.flN = 0; this.flick.add(r);
  }
  flickStep(dt) {
    for (const r of this.flick) {
      r.fl -= dt; r.flN -= dt;
      const end = r.fl <= 0 || r.st === 2 || r.dark || !r.lamp;
      if (!end && r.flN > 0) continue;
      const was = r.lamp && r.lamp.out;
      if (end) { this.flick.delete(r); if (r.lamp) r.lamp.out = r.st === 2 || r.dark; }
      else {
        // mostly off at first, catching more and more as it settles
        const on = Math.random() < 0.25 + 0.6*Math.max(0, 1 - r.fl/1.5);
        r.lamp.out = !on; r.flN = on ? 0.04 + Math.random()*0.18 : 0.03 + Math.random()*0.12;
      }
      if (r.lamp && r.lamp.out !== was) { this.W._lampsDirty = true; this.pool(r); }
    }
  }
  // the game's own soft patch of light under each lamp (game.js buildLightPools), laid down once when the city's
  // built: put out with the lamp, and moved with it when it's left leaning
  pool(r) {
    const G = window.__nhAskG, P = G && G.lightPools, l = r.lamp; if (!P || !l) return;
    const im = P.mesh, a = im.instanceMatrix.array;
    if (r._pool === undefined) {
      const l0 = r.lamp0 || l; r._pool = -1;
      for (let i = 0; i < im.count; i++) if (Math.abs(a[i*16 + 12] - l0[0]) < 0.05 && Math.abs(a[i*16 + 14] - l0[1]) < 0.05) { r._pool = i; break; }
    }
    const o = r._pool*16; if (o < 0) return;
    const s = l.out ? 0 : 11; a[o] = a[o + 10] = s; a[o + 5] = l.out ? 0 : 1; a[o + 12] = l[0]; a[o + 14] = l[1];
    im.instanceMatrix.needsUpdate = true;
  }
  // gone from the street: not drawn, not solid, its light off
  gone(r) {
    if (r.live) { r.live.parent && r.live.parent.remove(r.live); r.live = null; this.moving.delete(r); }
    for (const [, it] of r.items) it.off = true;
    if (r.deadIt) r.deadIt.off = true;
    for (const c of r.cols) c.off = true;
    if (r.lamp) { r.lamp.out = true; this.pool(r); }
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
  geoOf(r) { const P = this.W.proto; return r.geo ? r.geo : r.kind === 'lamp' ? P.lampDead || P.lamp : r.kind === 'board' ? P.streetBoard : r.kind === 'banner' ? P.bannerFrame : P[r.kind]; }
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
    // what's left standing at its foot stays solid (a concrete pole's stump, knee-high and up), once what fell is clear of it
    if (low.length && S.base >= 0.5) r.stubAt = this.t;
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
    if (r.kind === 'pole') { r.topB = b; r.topP = b.p.clone(); r.topQ = b.q.clone(); r.wsp = null; for (const q of Sway.spansOf(this, r)) { q.loc = null; Sway.wake(q); } }
    FX.brk(S.snd, r.x, r.y + 0.6, r.z, 1);
    if (r.kind === 'lamp' && !r.dark) FX.brk('glass', r.x, r.y + 7, r.z, 0.5);
    return { broke: true, absorb: S.absorb, carried: S.mass*0.25 };
  }
  // ---- a young tree: snaps at its foot and comes down whole, crown and all, drawn as it stood (world/trees.js) but
  // with nothing of the near-to-far handover, so it's there whatever the distance until it's put back
  fell(r, o) {
    const S = r.S || SPEC.tree, T = this.W.trees, t = r.ti;
    this.gone(r); r.stubAt = this.t;           // (its stump, or the foot an old one goes over about, is still in the ground: solid again once the trunk's clear)
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
    if (T.sway) T.sway.delete(t);
    // an old tree goes over about what's left of its foot, the fibres still holding it there; a young one snaps clean
    const big = (r.tr || 0.15) >= 0.21;
    const b = this.debris.add(Object.assign({ mesh: g, p, q: new THREE.Quaternion(), m: S.mass, half: new THREE.Vector3(Math.max(0.3, hx*0.6), H/2, Math.max(0.3, hz*0.6)), pts, mat: 'wood', keepGeo: true },
      big ? { pin: new THREE.Vector3(T.x[t], y0 + 0.4, T.z[t]), pinLocal: new THREE.Vector3(0, 0.4 - cm.y, 0), stiff: 0.8 } : {}));
    this.debris.iw(b); r.bodies.push(b);
    if (!big) this.stump(r, T.x[t], y0, T.z[t], tr, o);
    const J = S.mass*Math.max(1, o.u ?? 2)*(big ? 0.25 : 0.45);
    this.push(b, o.px, Math.max(y0 + 1.2, o.py), o.pz, o.nx*J, 0, o.nz*J);
    FX.brk(big ? 'split' : 'wood', r.x, y0 + 0.5, r.z, 1); FX.brk('rustle', r.x, y0 + H*0.6, r.z, 1.5);
    this.leaves.drop(r, { x: r.x, z: r.z, y0: y0 + H*0.4, y1: y0 + H, hx: hx*0.8, hz: hz*0.8 }, big ? 120 : 50, o.nx, o.nz, k);
    return { broke: true, absorb: S.absorb, carried: S.mass*0.3 };
  }
  // what a snapped young tree leaves in the ground: a knee-high stump, its bark on, broken off on a slant (lower on the
  // side it was struck from, where the wood went first), the pale wood split into long splinters standing up from it
  // and a few torn strips of bark. It stays put, rooted, until the tree's put back
  stump(r, x, y0, z, tr, o) {
    const cb = new ColorBuilder(), R = Math.max(0.05, tr*1.02), bark = [0.3, 0.24, 0.18], wood = [0.78, 0.66, 0.47], dk = [0.55, 0.44, 0.3], N = 10;
    const a0 = Math.atan2(o.nz, o.nx), hb = 0.42 + hsh(r.x)*0.25, sl = 0.1 + hsh(r.z)*0.08;
    const top = (a) => hb + Math.cos(a - a0)*sl + (hsh(a*7.3 + r.x) - 0.5)*0.06;
    const tri = (p, q, w, c, n) => { const i0 = cb.v(...p, ...n, ...c); cb.v(...q, ...n, ...c); cb.v(...w, ...n, ...c); cb.i.push(i0, i0 + 1, i0 + 2); };
    for (let i = 0; i < N; i++) {
      const a = i/N*6.283, b = (i + 1)/N*6.283, ca = Math.cos(a), sa = Math.sin(a), cb2 = Math.cos(b), sb = Math.sin(b), fl = 1.25;     // (a root flare at the foot)
      const p0 = [x + ca*R*fl, y0 - 0.05, z + sa*R*fl], p1 = [x + cb2*R*fl, y0 - 0.05, z + sb*R*fl], p2 = [x + cb2*R, y0 + top(b), z + sb*R], p3 = [x + ca*R, y0 + top(a), z + sa*R];
      const nm = [Math.cos((a + b)/2), 0.15, Math.sin((a + b)/2)], c = bark.map(v => v*(0.85 + hsh(i + r.x)*0.3));
      tri(p0, p2, p1, c, nm); tri(p0, p3, p2, c, nm);
      // the break: the wood, and a splinter up off every other edge
      tri([x, y0 + hb - 0.02, z], [x + cb2*R*0.97, y0 + top(b), z + sb*R*0.97], [x + ca*R*0.97, y0 + top(a), z + sa*R*0.97], i % 3 ? wood : dk, [0, 1, 0]);
      if (i % 2 === 0) {
        const m = (a + b)/2, rr = R*(0.35 + hsh(i*3 + r.z)*0.5), L = 0.08 + hsh(i*5 + r.x)*0.2, w = R*0.22, cx = x + Math.cos(m)*rr, cz = z + Math.sin(m)*rr, yb = y0 + top(m) - 0.02;
        const tx = -Math.sin(m)*w, tz = Math.cos(m)*w, tip = [cx + Math.cos(m)*0.02 + o.nx*L*0.25, yb + L, cz + Math.sin(m)*0.02 + o.nz*L*0.25];
        tri([cx - tx, yb, cz - tz], [cx + tx, yb, cz + tz], tip, wood, [Math.cos(m), 0.3, Math.sin(m)]);
        tri([cx + tx, yb, cz + tz], [cx - tx, yb, cz - tz], tip, dk, [-Math.cos(m), 0.3, -Math.sin(m)]);
      }
    }
    for (let i = 0; i < 3; i++) {
      const a = a0 + Math.PI + (hsh(i + r.x*2) - 0.5)*2.4, ca = Math.cos(a), sa = Math.sin(a), yt = y0 + top(a), L = 0.12 + hsh(i*9)*0.18, d = R + 0.012;
      tri([x + ca*d - sa*0.03, yt, z + sa*d + ca*0.03], [x + ca*d + sa*0.03, yt, z + sa*d - ca*0.03], [x + ca*(d + 0.06), yt + L, z + sa*(d + 0.06)], bark, [ca, 0, sa]);
    }
    const m = new THREE.Mesh(cb.build(), this.W.mats.prop); m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; this.W.scene.add(m); r.meshes.push(m);
  }
  // ---- a stall: over as one (tip), or into its pieces
  apart(r, o, tip) {
    const S = r.S || SPEC[r.kind], geo = this.geoOf(r); if (!geo) { this.gone(r); return { broke: true, absorb: S.absorb, carried: S.mass }; }
    const parts = partsOf(geo), F = this.frame(r, new THREE.Matrix4()), Fi = F.clone().invert();
    const big = (p) => Math.max(p.size.x, p.size.y, p.size.z);
    // (what's laid on it, small and up off its foot; small bits of its own frame, a wheel's spokes, a brick, go with the frame)
    const dk = S.deck ?? 0.6, goods = parts.filter(p => big(p) < 0.3 && p.min.y > dk), frame = parts.filter(p => !(big(p) < 0.3 && p.min.y > dk));
    this.gone(r);
    // what the striker shoves along: the two go on together at what the blow's momentum gives them both (and the
    // striker's still there behind it, pushing, if it keeps coming)
    const u = Math.max(0.4, o.u ?? 1.5), m = o.m || 1000, w = u*m/(m + S.mass);
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
    let seq = 0, carrier = null;
    for (const g of groups) {
      if (!g.length) continue;
      const pc = pieceOf(geo, g), vol = g.reduce((s, p) => s + p.size.x*p.size.y*p.size.z + 1e-4, 0), mass = S.mass*0.85*vol/fm;
      // a roof sheet up high, flat and wide, is tin whatever the stall's made of
      const sheet = pc.half.y < 0.06 && pc.c.y > 1.7 && pc.half.x > 0.4, mat = sheet ? 'tin' : S.mat;
      if (tip || pc.c.y < 1.2) lower(pc, (S.low || 0)*(tip ? 1 : 0.6));
      const b = this.body(r, pc, F, mass, mat, {});
      if (tip) {
        // struck where it was struck: low on it, and its foot goes and the top's left to come down after; high, over it goes
        this.push(b, o.px, Math.max(r.y + 0.15, o.py), o.pz, o.nx*mass*w, mass*w*0.06, o.nz*mass*w);
        carrier = b;
      } else {
        // the pieces nearest the blow take most of it; what's far from it hardly moves (and falls where it stood)
        const d = pc.c.distanceTo(lp), f = Math.max(0.15, 1.15 - 0.75*Math.min(1, d/1.8)), h = hsh(++seq + r.x*3.1), lt = sheet ? 2.2 : 1;
        b.v.set(o.nx*w*f + (h - 0.5)*0.6*lt, (0.15 + hsh(seq + 9)*0.6)*f*lt, o.nz*w*f + (hsh(seq + 4) - 0.5)*0.6*lt);
        b.w.set((hsh(seq + 1) - 0.5)*3*f*lt, (hsh(seq + 2) - 0.5)*2*f*lt, (hsh(seq + 3) - 0.5)*3*f*lt);
      }
    }
    // what's on it: each thing its own (bunched up past forty). Set down on the counter, it stays there while the
    // counter holds it; struck out from under it, it's left behind and drops
    let gs = goods;
    if (gs.length > 40) { const cells = new Map(); for (const p of gs) { const k = Math.floor(p.c.x/0.3) + ',' + Math.floor(p.c.y/0.3) + ',' + Math.floor(p.c.z/0.3); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(p); } gs = [...cells.values()]; }
    else gs = gs.map(p => [p]);
    const held = carrier && w < (MU_GOODS[S.goods] ?? 0.5)*9.81*0.12;      // (as fast as the grip on them can bring them along at once)
    for (const g of gs) {
      const pc = pieceOf(geo, g), hx = Math.max(pc.half.x, pc.half.y, pc.half.z), hn = Math.min(pc.half.x, pc.half.y, pc.half.z), round = S.round && hx < 0.075 && hx < hn*1.35, h = hsh(++seq + r.z*1.7);
      const b = this.body(r, pc, F, Math.max(0.12, S.mass*0.15/gs.length), S.goods || S.mat, round ? { ball: (pc.half.x + pc.half.y + pc.half.z)/3, roll: 0.08 } : {});
      if (held) {
        _q.copy(carrier.q).invert();
        b.ride = { on: carrier, lp: b.p.clone().sub(carrier.p).applyQuaternion(_q), lq: _q.clone().multiply(b.q), cos: Math.cos((S.grip || 0.45)*(0.8 + h*0.4)), jolt: 1.5 + h*1.5 };
      } else {
        // left behind as the counter goes from under it: a part of the shove, a hop off the boards, and over
        const k = carrier ? 0.35 + h*0.3 : 0.7 + h*0.4;
        b.v.set(o.nx*w*k + (hsh(seq + 5) - 0.5)*0.5, 0.2 + hsh(seq + 6)*0.7, o.nz*w*k + (hsh(seq + 7) - 0.5)*0.5);
        b.w.set((hsh(seq + 1) - 0.5)*6, (hsh(seq + 2) - 0.5)*6, (hsh(seq + 3) - 0.5)*6);
      }
    }
    FX.brk(tip ? (S.mat === 'steel' ? 'tin' : 'wood') : S.snd, r.x, r.y + 0.8, r.z, tip ? 0.7 : 1);
    FX.brk('thud', r.x, r.y + 0.3, r.z, Math.min(1.2, S.mass/300));
    if (S.goods === 'glass' || S.goods === 'fruit' || S.goods === 'plastic') FX.brk(S.goods, r.x, r.y + 1, r.z, held ? 0.3 : 0.7);
    if (r.link) for (const q of r.link) if (q.st !== 2) this.hit(q, Object.assign({}, o, { E: Math.max(o.E, (q.S || SPEC[q.kind]).tip || 0) }));
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
      if (e) { e[1].off = true; const mm = new THREE.Matrix4().fromArray(e[1].m); r.deadIt = W.lampDeadSet.add(r.x, r.z, mm); r.m0.set(r.deadIt, r.m0.get(e[1])); if (r.live) { r.deadIt.off = true; r.live.geometry = P.lampDead; } }
    }
    if (r.lamp) { r.lamp.out = true; this.pool(r); }
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
    if (this.moving.size || this.wst.size) Sway.step(this, dt);
    treeStep(this, dt); this.leaves.step(dt);
    if (this.flick.size) this.flickStep(dt);
    if ((this.chk -= dt) > 0) return;
    this.chk = 0.5;
    // a stump left in the ground: solid again as soon as what came off it has fallen clear (straight away it would shove the
    // trunk or the pole sideways as it starts to go), or after a few seconds whatever happens
    for (const r of this.down) {
      if (r.stubAt == null || r.st !== 2) continue;
      const b = r.bodies[0], rc = r.cols.reduce((m, c) => Math.max(m, c.r || 0), 0.2);
      const clear = !b || Math.hypot(b.p.x - r.x, b.p.z - r.z) > rc + Math.max(0.05, Math.min(b.half.x, b.half.z, 0.5)) + 0.25;
      if (clear || this.t - r.stubAt > 4) { for (const c of r.cols) c.off = false; Collision.rev++; r.stubAt = null; }
    }
    // a lamp left leaning: its patch of light goes where its head now is
    for (const r of this.down) if (r.lamp && r.st === 1 && !this.flick.has(r)) this.pool(r);
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
    if (r.ti != null && this.W.trees) { const T = this.W.trees; if (T.dead) T.dead.delete(r.ti); if (T.sway) T.sway.delete(r.ti); T.lastX = 1e9; this.leaves.remove(r); r.cracked = false; }
    if (r.draw) { r.draw = r.draw.filter(e => e.m.parent); for (const e of r.draw) this.cut(e, false); }
    r.top = null;
    if (r.live) { r.live.parent && r.live.parent.remove(r.live); r.live = null; } this.moving.delete(r);
    r.topB = null; r.rest = null; r.bend = null; r.marks = null;
    if (r.lamp && r.lamp0) { r.lamp[0] = r.lamp0[0]; r.lamp[1] = r.lamp0[1]; r.lamp0 = null; }
    for (const m of r.meshes) { m.parent && m.parent.remove(m); m.geometry.dispose(); }
    r.bodies = []; r.meshes = [];
    r.tilt.set(0, 0, 0);
    for (const [, it] of r.items) { it.off = false; const m0 = r.m0.get(it); if (m0) it.m.set(m0); }
    if (r.deadIt) { r.deadIt.off = true; const S = this.W.lampDeadSet; if (S) S.items = S.items.filter(q => q !== r.deadIt); r.deadIt = null; }
    for (const c of r.cols) c.off = false;
    Collision.rev++;
    if (r.lamp) { r.lamp.out = false; this.pool(r); }
    if (r.head) r.head.dead = false;
    r.st = 0; r.dmg = 0; r.dark = false; r.stubAt = null;
    if (r.kind === 'pole') { Sway.spansOf(this, r); Sway.unhang(this, r); }
    if (r.head) Sway.bulbs(this, r);
    this.down.delete(r);
    this.dirty();
  }
}
