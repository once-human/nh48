// /beta's buildings chunk: the same game, a painted city. Stands in for world/buildingsChunk.js (for world.js only).
//
// Everything the game reads is worked out here exactly as the original does it, from the same map data and in the
// same order: the shop doors people walk into, the shutters that roll up when a shop opens, the shop boards and their
// sharp near copies, the footprints, the rooftop hoardings. Collision never came from the drawing (tiles.js gives it
// the outlines), so nothing the player bumps into changes either.
// What the buildings look like comes from world/builder.js, run in workers so a dense chunk of the old city costs the
// game no frame at all (and right here only if there are no workers).
import * as THREE from 'three';
import { cmRing } from '@orig/world/geo.js';
import { setShutters } from '@orig/world/buildingsChunk.js';
import { QuadBuilder } from '@orig/world/geo.js';
import { hash2, WB, signedArea, insideRing, mulc } from './geom.js';
import { K, BASE, SHOP_CELL, heightOf } from './kinds.js';
import { buildChunk, boardH } from './builder.js';
import { AreaField } from './areas.js';
import { footJob } from './footpath.js';
import { paint, packGeo } from '../gfx/paint.js';
import { kindOf } from '@orig/game/shops.js';
import { Frame } from './geom.js';
import { familyOf, cellDepth, shopPlan, planSeed } from './shopplan.js';
import { cellsIn, cellsOut } from './shopin.js';

export { setShutters, BASE };
// a sign material whose boards each carry their own light (aGlow): its own program, not a plain sign's
// (the material's shared: the game's own boards, a street's name board, draw with it too and carry no light of their
// own; without one the shader read whatever was left over, and they went black. They get a full one, always on)
export const glowSafe = (m) => { if (m._glowSafe) return m; m._glowSafe = true; const b0 = m.onBeforeRender;
  m.onBeforeRender = function (r, sc, cam, geo, obj, grp) { if (b0) b0.call(this, r, sc, cam, geo, obj, grp); if (geo && !geo.attributes.aGlow && geo.attributes.position) geo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(1), 1)); };
  return m; };
export const litMat = (m) => { m.userData.glow = true; m.customProgramCacheKey = () => 'glow'; return glowSafe(m); };

// ---------------------------------------------------------------- the workers
// A chunk's drawings are made on a few workers from the map alone, while the game works out its own part of the
// chunk here: its base drawing (seen from a street away and from across the city), asked for as the chunk is built,
// and its close-up one, asked for only as you come near it. A finished drawing goes to whoever's waiting for it, or
// is kept for when it's wanted (the chunks around the one being built are asked for ahead of time).
// Who goes first: 0 a chunk being built now, 1 a close-up, 2 ahead of time.
class Painter {
  constructor() {
    this.area = null; this.workers = []; this.queue = []; this.jobs = new Map(); this.done = new Map(); this.id = 1; this.failed = false;
  }
  get ok() { return !this.failed && this.workers.length > 0; }
  init(W) {
    if (this.area) return;
    this.W = W;
    this.area = new AreaField(W.M);
    W.areaField = this.area; W.painter = this;
    this.stats = { base: 0, near: 0, ms: 0 };
    try {
      const src = document.getElementById('beta-worker');
      if (!src || typeof Worker === 'undefined') throw new Error('no worker');
      const url = URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' }));
      const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 2));
      for (let k = 0; k < n; k++) {
        const w = new Worker(url);
        w.busy = [];
        w.onmessage = (e) => this.back(w, e.data);
        w.onerror = (e) => { console.warn('beta worker', e.message || e); this.fail(); };
        w.postMessage({ pts: this.area.toPts() });
        this.workers.push(w);
      }
    } catch (e) { this.failed = true; }
  }
  // a worker broke: everything waiting on one is drawn here instead
  fail() {
    if (this.failed) return;
    this.failed = true;
    const js = [...this.jobs.values()];
    this.jobs.clear(); this.queue.length = 0;
    for (const j of js) { const f = j.waiters.splice(0); for (const g of f) g(null); }
  }
  sig(C) { const b = C.bld; return b.length + ':' + (b[0] ?? -1) + ':' + (b[b.length - 1] ?? -1) + ':' + (C.kerbs ? C.kerbs.length : 0) + ':' + (C.ground ? C.ground.length : 0); }
  want(C, kind, prio) {
    const key = C.ci + kind, s = this.sig(C);
    const d = this.done.get(key);
    if (d && d.sig === s) return d;
    let j = this.jobs.get(key);
    if (j && j.sig === s) { if (!j.sent && prio < j.prio) { this.queue.splice(this.queue.indexOf(j), 1); j.prio = prio; this.enqueue(j); } return j; }
    j = { key, ci: C.ci, kind, sig: s, C, prio, id: this.id++, sent: false, out: null, waiters: [] };
    this.jobs.set(key, j);
    this.enqueue(j);
    return j;
  }
  enqueue(j) {
    let i = this.queue.findIndex(q => q.prio > j.prio);
    if (i < 0) i = this.queue.length;
    this.queue.splice(i, 0, j);
    this.pump();
  }
  // no longer wanted (you've gone the other way before it was started)
  drop(C, kind) {
    const j = this.jobs.get(C.ci + kind);
    if (j && !j.sent) { this.jobs.delete(j.key); this.queue.splice(this.queue.indexOf(j), 1); }
  }
  // the chunk's ground is the first thing built: ask from there
  early(C) { if (this.ok) this.want(C, 'base', 0); }
  // one job at a time on each worker while you play (so a chunk you've just come to goes before ones asked for
  // ahead of time); while everything's built at once (paint.sync: this thread is busy and can't hand out more as
  // they finish) all of them, shared out
  pump() {
    const depth = paint.sync > 0 ? 64 : 1;
    for (let more = true; more && this.queue.length;) {
      more = false;
      for (const w of this.workers) {
        if (w.busy.length >= depth || !this.queue.length) continue;
        const j = this.queue.shift();
        if (this.jobs.get(j.key) !== j) { more = true; continue; }
        j.sent = true; w.busy.push(j); j.t0 = performance.now();
        w.postMessage({ id: j.id, kind: j.kind, job: jobOf(this.W, j.C, j.kind) });
        more = true;
      }
    }
  }
  back(w, m) {
    const i = w.busy.findIndex(b => b.id === m.id), j = i >= 0 ? w.busy.splice(i, 1)[0] : null;
    if (j && this.jobs.get(j.key) === j) {
      this.jobs.delete(j.key);
      this.stats[j.kind]++; this.stats.ms += performance.now() - j.t0;
      if (m.err) { console.warn('beta builder', m.err); j.out = { kind: j.kind, cells: [] }; }
      else j.out = m.out;
      j.C = null;
      const f = j.waiters.splice(0);
      if (f.length) for (const g of f) g(j.out);
      else { this.done.set(j.key, j); if (this.done.size > 24) this.done.delete(this.done.keys().next().value); }
    }
    this.pump();
  }
  take(C, kind) { this.done.delete(C.ci + kind); }
  // the chunks around this one that'll be built next
  prefetch(C) {
    const I = this.W.index, S = this.W.streamer;
    if (!I || !S || this.queue.length > 6) return;
    const i0 = Math.round((C.cx - I.x0) / I.size - 0.5), j0 = Math.round((C.cz - I.z0) / I.size - 0.5);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= I.ncx || j >= I.ncz) continue;
      const c = I.chunks[i + j * I.ncx];
      if (c && !c.built && c.bld.length && (!S.job || S.job.c !== c)) this.want(c, 'base', 2);
    }
  }
  // until every drawing asked for is in (the loading screen, after building the chunks around you)
  settle(onEach) {
    const n0 = this.jobs.size;
    return new Promise((res) => {
      const t0 = performance.now();
      const tick = () => {
        if (!this.ok || !this.jobs.size || performance.now() - t0 > 20000) return res();
        if (onEach && n0) onEach(Math.max(0, n0 - this.jobs.size), n0);
        setTimeout(tick, 25);
      };
      tick();
    });
  }
}
const painter = new Painter();
export { painter };

// The map knows where the temples are only as pins. A pin that falls inside a small, low building is that temple:
// it becomes one (style 8: the saffron or white walls, the shikhara, its strings of bulbs). A pin inside a big block
// or a tower is a shrine in its compound, and that stays as it is. (Pins come in with their tile and the chunks are
// rebuilt then, so a building that had no pin yet is asked again; once it's a temple it stays one.)
// (the map's 'temple' is any place of worship, and a good few things that only have mandir in the name: it has to
// say it's a temple, and not be a dargah, a masjid, a church, a gurudwara, a theatre, a gym, a school, a library)
const MANDIR = /mandir|temple|ganpati|ganapati|maruti|devasthan|haveli|vithoba|jogeshwari|nilkantheshwar|swami narayan|मंदिर/i;
const NOT_MANDIR = /dargah|masjid|mosque|church|gurudwara|synagogue|agiary|vihar|natya|chitra|vyayam|talim|balak|vachan|vidya|shikshan|seva|karyalaya|dry ?fruit|tours|house|cave|दर्गा|मशीद|मस्जिद|चर्च/i;
let tGrid = null, tPins = null, tLen = -1;
function templeOf(M, B) {
  if (B[3] === 8 || B.notTemple) return;
  const pins = M.pins || [];
  if (pins !== tPins || pins.length !== tLen) {
    tGrid = new Map(); tPins = pins; tLen = pins.length;
    for (const q of pins) if (q[2] === 'temple' && MANDIR.test(q[0] + ' ' + q[1]) && !NOT_MANDIR.test(q[0] + ' ' + q[1])) { const k = Math.floor(q[3] / 5000) * 65536 + Math.floor(q[4] / 5000); (tGrid.get(k) || tGrid.set(k, []).get(k)).push(q); }
  }
  if ((B[2] | 0) > 2 || !(B[3] === 0 || B[3] === 2 || B[3] === 3 || B[3] === 4 || B[3] === 5)) { B.notTemple = true; return; }
  if (!tGrid.size) return;
  const r = B[1], n = r.length / 2; let x = 0, z = 0;
  for (let i = 0; i < n; i++) { x += r[2 * i]; z += r[2 * i + 1]; }
  x /= n; z /= n;
  const gx = Math.floor(x / 5000), gz = Math.floor(z / 5000);
  for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (const q of tGrid.get((gx + a) * 65536 + gz + c) || []) if (insideRing(q[3], q[4], r)) {
    if (Math.abs(signedArea(r)) / 1e4 <= 500) B[3] = 8; else B.notTemple = true;
    return;
  }
}

// what the builder needs to know about a chunk (all of it from the map, nothing from the game)
function jobOf(W, C, kind) {
  const { M, index } = W;
  const blds = [];
  for (const bi of C.bld) {
    const B = M.buildings[bi];
    if (!B) continue;
    templeOf(M, B);
    const ringCm = B[1];
    const sh = index.shopsByBld.get(bi), shops = [];
    if (sh && B[3] !== 8) for (const [key, s] of sh) { const nm = index.shopNames[s[3]]; shops.push([key, nm ? nm[2] : 'generic', nm ? nm[3] || '' : '', (nm && kindOf(nm[0], nm[2])) || '']); }
    blds.push({ bi, ring: cmRing(ringCm), levels: B[2], style: B[3], roof: B[4], flags: B[5], y: B.y || 0, seed: hash2(ringCm[0] * 31 + ringCm[1] * 17, bi) | 0, shops });
  }
  return { cx: C.cx, cz: C.cz, blds, rich: painter.rich ?? 1, foot: kind === 'near' ? footJob(C) : null };
}
// made here (no workers)
function drawHere(W, C, kind) { const t0 = performance.now(); const out = buildChunk(jobOf(W, C, kind), painter.area, kind); W.paintMs = performance.now() - t0; return out; }

// ---------------------------------------------------------------- near and far
// Each quarter of a chunk is shown as it is close up when you're within a street or so of it, as it's seen from a
// few streets away further out, and as massing from across the city beyond that. The close-up drawing is asked for
// as you come within a few streets of the chunk and let go of well after you've left. The streamer asks every frame,
// from where you are (a little slack each way, so nothing flickers on a line).
const lods = new Set();
const NEAR = [50, 70], FAR = [150, 180], ASK = 140, LET_GO = 320;
let lastX = 0, lastZ = 0;
const away = (x, z, cx, cz, h) => Math.hypot(Math.max(0, Math.abs(x - cx) - h), Math.max(0, Math.abs(z - cz) - h));
const show = (m, v) => { if (m) m.visible = v; };
function setLod(L, x, z, force) {
  const dC = away(x, z, L.cx, L.cz, L.h);
  if (!L.near && dC < ASK) askNear(L);
  else if (L.near && dC > LET_GO) letGo(L);
  for (const c of L.cells) {
    const d = away(x, z, c.cx, c.cz, L.h / 2);
    let lv = d < NEAR[c.lv === 0 ? 1 : 0] ? 0 : d < FAR[c.lv <= 1 ? 1 : 0] ? 1 : 2;
    if (lv === 0 && L.near !== 2) lv = 1;
    if (lv === c.lv && !force) continue;
    c.lv = lv;
    show(c.main, lv === 0); show(c.cut, lv === 0); show(c.far, lv === 1); show(c.mass, lv === 2);
  }
}
export function paintLod(x, z) {
  lastX = x; lastZ = z;
  for (const L of lods) setLod(L, x, z, false);
}
const mesh = (L, pk, mat, cast, name) => {
  if (!pk || !pk.n) return null;
  const m = new THREE.Mesh(packGeo(pk), mat); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false; m.visible = false; m.name = name;
  L.g.add(m); return m;
};
function askNear(L) {
  L.near = 1;
  const job = painter.ok ? painter.want(L.C, 'near', 1) : null;
  if (job && !job.out) job.waiters.push((out) => gotNear(L, out));
  else gotNear(L, job && job.out);
}
function gotNear(L, out) {
  if (L.dead || L.near !== 1) return;
  painter.take(L.C, 'near');
  if (!out) out = drawHere(L.W, L.C, 'near');
  for (let k = 0; k < 4; k++) {
    const c = L.cells[k], o = out.cells[k];
    if (!o) continue;
    c.main = mesh(L, o.main, paint.world, true, 'near'); c.cut = mesh(L, o.cut, paint.cut, false, 'cut');
  }
  L.near = 2;
  solidsIn(L, out.solids);
  setLod(L, lastX, lastZ, true);
}
// the footpath's carts, boxes and posts into the collision while they're drawn (world/footpath.js), out again after
const tagOf = (L) => 'fp' + L.C.ci, rectOf = (L) => { const h = L.W.index.size/2 + 4; return [L.cx - h, L.cz - h, L.cx + h, L.cz + h]; };
function solidsIn(L, sol) {
  const C = L.W.collision; if (!C || !sol || !sol.length) return;
  C.removeTag(tagOf(L), rectOf(L));
  const t0 = C.tag; C.tag = tagOf(L);
  try { for (const q of sol) { if (q[0] === 'r') C.addRing(q[1], 2); else C.addCircle(q[1], q[2], q[3], 2); } } finally { C.tag = t0; }
  L.solids = true;
}
function solidsOut(L) { if (L.solids) { L.W.collision?.removeTag(tagOf(L), rectOf(L)); L.solids = false; } }
function letGo(L) {
  if (L.near === 1) painter.drop(L.C, 'near');
  for (const c of L.cells) for (const k of ['main', 'cut']) { const m = c[k]; if (m) { L.g.remove(m); m.geometry.dispose(); c[k] = null; } }
  solidsOut(L);
  L.near = 0;
  setLod(L, lastX, lastZ, true);
}

// ---------------------------------------------------------------- the chunk
export function* buildBuildingsChunk(W, C, group) {
  const { M, mats, index } = W;
  painter.init(W);
  // the drawing: ask now (if the ground hasn't), so it's being made while the game's own part is worked out
  const job = painter.ok ? painter.want(C, 'base', 0) : null;
  if (job) {
    if (away(lastX, lastZ, C.cx, C.cz, W.index.size / 2) < ASK) painter.want(C, 'near', 1);
    if (!paint.sync) painter.prefetch(C);
  }
  const signs = W.boards;
  W.sliceLabel = 'atlas';
  const local = yield* signs.chunkAtlas(C, (bi) => index.shopsByBld.get(bi), index.shopNames);
  W.sliceLabel = 'bld';
  const sb = new QuadBuilder(), ob = new QuadBuilder();
  const nearRecs = [], shut = [], footprints = [], glowRecs = [];
  C.doors = [];
  let ops = 0;
  for (const bi of C.bld) {
    if ((++ops & 7) === 0) yield;
    const B = M.buildings[bi];
    if (!B) continue;
    templeOf(M, B);
    const dy = B.y || 0;
    const [, ringCm, levels, styleId, roof, flags] = B;
    const p = cmRing(ringCm);
    const n = p.length / 2;
    if (n < 3) continue;
    const area = signedArea(p), sgn = area > 0 ? 1 : -1;
    const normals = new Float64Array(p.length);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, dx = p[2 * j] - p[2 * i], dz = p[2 * j + 1] - p[2 * i + 1], L = Math.hypot(dx, dz) || 1;
      normals[2 * i] = sgn * dz / L; normals[2 * i + 1] = -sgn * dx / L;
    }
    if (styleId === 7) continue;                                            // a petrol pump's canopy: no walls, no shops
    const { gh } = heightOf(levels, styleId);
    const pitched = (roof === 1 || styleId === 10 || styleId === 12) && n <= 10 && isConvexRing(p) && Math.abs(area) < 1600;
    const parapet = styleId === 11 ? 1.4 : pitched ? 0 : styleId === 6 ? 0.15 : 0.95;
    const wallTop = BASE + heightOf(levels, styleId).H + parapet;
    footprints.push({ bi, p, h: wallTop + dy });
    const shopsHere = styleId === 8 ? null : index.shopsByBld.get(bi);        // (a temple has no shops let into it)
    const slotDoor = new Map();
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = p[2 * i], az = p[2 * i + 1], bx = p[2 * j], bz = p[2 * j + 1];
      const nx = normals[2 * i], nz = normals[2 * i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const tx = (bx - ax) / L, tz = (bz - az) / L;
      const fl = flags[i] || '0';
      const shop = styleId !== 8 && fl === '3' && L > 2.6;
      if (shop) {
        const ns = Math.max(1, Math.floor(L / SHOP_CELL)), cw = L / ns, oh = gh - 0.85;
        for (let k = 0; k < ns; k++) {
          const t = (k + 0.5) * cw;
          shut.push({ x: ax + tx * t + nx * 0.035, y: BASE + dy, z: az + tz * t + nz * 0.035, ry: Math.atan2(nx, nz), w: Math.max(0.6, cw - 0.36), h: oh, key: i * 4096 + k, sd: slotDoor });
        }
      }
      let boards = shop;
      if (!boards && shopsHere && L > 2.6) { const ns0 = Math.max(1, Math.floor(L / SHOP_CELL)); for (let k = 0; k < ns0 && !boards; k++) boards = shopsHere.has(i * 4096 + k); }
      if (!boards) continue;
      const ns = Math.max(1, Math.floor(L / SHOP_CELL)), cw = L / ns;
      for (let k = 0; k < ns; k++) {
        const sh = shopsHere && shopsHere.get(i * 4096 + k);
        const board = sh && local.get(sh);
        if (!board) continue;
        const t0 = k * cw + 0.15, t1 = (k + 1) * cw - 0.15;
        const w = t1 - t0, h = boardH(w);
        const y1 = BASE + gh - 0.07, y0 = y1 - h;
        const o = 0.1;
        const x0 = ax + tx * t0 + nx * o, z0 = az + tz * t0 + nz * o, x1 = ax + tx * t1 + nx * o, z1 = az + tz * t1 + nz * o;
        C.doors.push({ x: (x0 + x1) / 2 + nx * 0.25, z: (z0 + z1) / 2 + nz * 0.25, nx, nz, n: 0, shop: sh ? sh[3] : -1 });
        // the shop behind the door, laid out exactly as world/builder.js draws it (world/shopplan.js)
        if (sh) {
          const nm = index.shopNames[sh[3]], kind = (nm && kindOf(nm[0], nm[2])) || '', cat = nm ? nm[2] : 'generic', fam = familyOf(kind, cat);
          if (fam) {
            const a = k * cw + 0.18, c = (k + 1) * cw - 0.18, Fr = new Frame(ax, az, tx, tz, nx, nz), oh = gh - 0.85;
            const plan = shopPlan({ kind, cat, brand: nm ? nm[3] || '' : '', w: c - a, D: cellDepth(p, Fr, a, c, fam), oh, seed: planSeed(bi, i * 4096 + k), glass: !shop || (nm && nm[3]) === 'brand' });
            if (plan) C.doors[C.doors.length - 1].cell = { F: Fr, a, plan, y: BASE + dy, shutter: shop };
          }
        }
        slotDoor.set(i * 4096 + k, C.doors[C.doors.length - 1]);
        const ltr = (tx * nz - tz * nx) > 0;
        glowRecs.push({ o: !!board.local, v: (board.local ? ob : sb).c, door: C.doors[C.doors.length - 1] });
        (board.local ? ob : sb).quad([x0, y0 + dy, z0], [x1, y0 + dy, z1], [x1, y1 + dy, z1], [x0, y1 + dy, z0], [nx, 0, nz], ltr ? board.u0 : board.u1, board.v0, ltr ? board.u1 : board.u0, board.v1);
        if (sh) nearRecs.push({ door: C.doors[C.doors.length - 1], s: sh, x0, y0: y0 + dy, z0, x1, y1: y1 + dy, z1, nx, nz, ltr, mx: (x0 + x1) / 2, mz: (z0 + z1) / 2 });
      }
    }
  }
  // rooftop hoardings facing the chowks (their frames are drawn here, they're few)
  W.sliceLabel = 'hoard';
  const hb = new WB();
  for (const h of C.hoardings) {
    yield;
    const x = h[2] / 100, z = h[3] / 100, ang = h[4];
    const f = footprints.find(f => insideRing(x, z, f.p));
    if (f && f.h > 6) hoarding(hb, sb, signs, x, f.h, z, ang, h[0]);
  }
  W.footprintsByChunk.set(C.ci, footprints);
  // the drawing. Streaming in: wait for it (the streamer moves on to its other work meanwhile). Built all at once
  // (the loading screen, the game's jumps: paint.sync): don't, it joins the chunk when it comes. Made here if there
  // are no workers
  W.sliceLabel = 'paint';
  if (job && !paint.sync) while (!job.out && painter.ok) { W.paintWait = true; yield; }
  const h = W.index.size / 2, q = h / 2;
  const L = { W, C, cx: C.cx, cz: C.cz, h, g: new THREE.Group(), near: 0, dead: false,
    cells: [0, 1, 2, 3].map(k => ({ cx: C.cx + (k & 1 ? q : -q), cz: C.cz + (k & 2 ? q : -q), lv: -1, far: null, mass: null, main: null, cut: null })) };
  L.g.matrixAutoUpdate = false;
  const draw = (out) => {
    if (L.dead) return;
    painter.take(C, 'base');
    if (!out) out = drawHere(W, C, 'base');
    for (let k = 0; k < 4; k++) {
      const c = L.cells[k], o = out.cells[k];
      if (o) { c.far = mesh(L, o.far, paint.world, true, 'far'); c.mass = mesh(L, o.mass, paint.world, true, 'mass'); }
    }
    group.add(L.g);
    lods.add(L);
    setLod(L, lastX, lastZ, true);
  };
  if (job && !job.out && painter.ok) job.waiters.push(draw); else draw(job && job.out);
  yield;
  W.sliceLabel = 'emit';
  if (!hb.empty) { const m = new THREE.Mesh(packGeo(hb.pack()), paint.world); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  yield;
  // each board's light, one number a vertex, that its shutter takes down (world/shutters.js)
  const glowOn = (g, o) => { const a = new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(1), 1); g.setAttribute('aGlow', a); C.glow = C.glow || { recs: glowRecs }; C.glow[o ? 'o' : 's'] = a; };
  litMat(mats.sign);
  if (!sb.empty) { const g = yield* sb.buildSliced(); glowOn(g, false); const m = new THREE.Mesh(g, mats.sign); m.receiveShadow = true; group.add(m); }
  yield;
  let localMat = null;
  if (!ob.empty && local.tex) {
    localMat = mats.sign.clone();
    localMat.map = local.tex; localMat.emissiveMap = local.tex; litMat(localMat);
    W.signMats.add(localMat);
    const g = yield* ob.buildSliced(); glowOn(g, true); const m = new THREE.Mesh(g, localMat); m.receiveShadow = true; group.add(m);
  }
  if (W.nearBoards) W.nearBoards.addChunk(C.ci, C.cx, C.cz, nearRecs);
  cellsIn(C.ci, C.doors.filter(d => d.cell));
  // the shutters, one instance each; game.js lifts the ones whose shop is open (and keeps them in step with the clock)
  let shutMesh = null;
  if (shut.length) {
    shutMesh = new THREE.InstancedMesh(shutterGeo(), paint.shutter, shut.length);
    shutMesh.frustumCulled = false; shutMesh.receiveShadow = true;
    for (const r of shut) { r.door = r.sd.get(r.key) || null; delete r.sd; }
    C.shutters = { im: shutMesh, list: shut, fresh: true };
    setShutters(C, () => false);
    group.add(shutMesh);
  }
  return () => {
    L.dead = true;
    lods.delete(L);
    solidsOut(L);
    if (L.near === 1) painter.drop(C, 'near');
    if (shutMesh) { shutMesh.dispose(); C.shutters = null; }
    W.footprintsByChunk.delete(C.ci);
    cellsOut(C.ci);
    if (W.nearBoards) W.nearBoards.dropChunk(C.ci);
    if (local.tex) local.tex.dispose();
    if (localMat) { W.signMats.delete(localMat); localMat.dispose(); }
  };
}

function isConvexRing(p) {
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

let SHG = null;
function shutterGeo() { if (!SHG) { SHG = new THREE.PlaneGeometry(1, 1); SHG.translate(0, 0.5, 0); SHG.userData.shared = true; } return SHG; }

// a hoarding on a roof: steel legs and braces, the frame, three lamps over it; the ad itself goes in the board atlas
function hoarding(b, sb, signs, x, y, z, ang, k) {
  const s = signs.ad(k);
  const nx = Math.cos(ang), nz = Math.sin(ang), tx = -nz, tz = nx;
  const Wd = 9, Hh = 4.5, lift = 2.0, y0 = y + lift, y1 = y0 + Hh;
  const yaw = Math.atan2(tz, tx);
  b.set(K.metal, [0.25, 0.25, 0.27], 0.5, 0.3);
  for (const o of [-Wd / 2 + 0.6, 0, Wd / 2 - 0.6]) {
    b.ybox(x + tx * o - nx * 0.4, y, z + tz * o - nz * 0.4, 0.18, y1, 0.18, yaw, 8);
    b.tube([x + tx * o - nx * 0.4, y + lift + 0.5, z + tz * o - nz * 0.4], [x + tx * o - nx * 1.6, y, z + tz * o - nz * 1.6], 0.05, 4);
  }
  b.set(K.metal, [0.2, 0.2, 0.22], 0.3);
  b.ybox(x - nx * 0.12, y0 - 0.15, z - nz * 0.12, Wd + 0.3, y1 + 0.15, 0.15, yaw, 0);
  b.set(K.metal, [0.3, 0.3, 0.3], 0.4);
  for (const o of [-Wd / 3, 0, Wd / 3]) { b.tube([x + tx * o, y1 + 0.1, z + tz * o], [x + tx * o + nx * 0.6, y1 + 0.3, z + tz * o + nz * 0.6], 0.025, 3); }
  b.set(K.glow, mulc([1, 0.95, 0.8], 1), 0, 0.8);
  for (const o of [-Wd / 3, 0, Wd / 3]) b.ybox(x + tx * o + nx * 0.6, y1 + 0.2, z + tz * o + nz * 0.6, 0.3, y1 + 0.32, 0.3, yaw, 0);
  sb.quad([x - tx * Wd / 2 + nx * 0.02, y0, z - tz * Wd / 2 + nz * 0.02], [x + tx * Wd / 2 + nx * 0.02, y0, z + tz * Wd / 2 + nz * 0.02],
    [x + tx * Wd / 2 + nx * 0.02, y1, z + tz * Wd / 2 + nz * 0.02], [x - tx * Wd / 2 + nx * 0.02, y1, z - tz * Wd / 2 + nz * 0.02], [nx, 0, nz], s.u1, s.v0, s.u0, s.v1);
}
