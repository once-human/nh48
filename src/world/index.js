// World index + streaming. The baked map is parsed once; static geometry is built per 200 m
// chunk when the camera comes near and disposed when it leaves, nearest chunks first, inside a
// per-frame time budget so driving never hitches.
import * as THREE from 'three';
import TRANSIT from '../game/transit.json';
import { cmRing } from './geo.js';

// district centres (same table as the baker): 0 deccan/FC, 1 peth, 2 camp, 3 KP, 4 station, 5 residential, 6 riverside
const DISTRICT_CENTRES = [
  [0, 18.5172, 73.8418], [0, 18.5235, 73.8410], [5, 18.5335, 73.8370], [5, 18.5125, 73.8345], [5, 18.5330, 73.8440],
  [4, 18.5300, 73.8500], [1, 18.5150, 73.8555], [1, 18.5205, 73.8590], [1, 18.5130, 73.8630], [4, 18.5285, 73.8690],
  [4, 18.5270, 73.8760], [2, 18.5160, 73.8790], [2, 18.5195, 73.8840], [6, 18.5370, 73.8820], [3, 18.5395, 73.8920],
  [3, 18.5355, 73.8930], [6, 18.5420, 73.8650], [6, 18.5250, 73.8620],
];
const EMPTY = Object.freeze([]);
const TILE_FIELDS = ['ground', 'water', 'kerbs', 'banks', 'lakebanks', 'rails', 'bld', 'walls', 'lamps', 'poles', 'signals', 'stalls', 'hoardings',
  'center', 'lane', 'zebra', 'stop', 'bump', 'pot', 'railways', 'platforms'];
const CHUNK_FIELDS = [...TILE_FIELDS, 'buses', 'metro', 'mstations', 'mgates'];
export const DISTRICTS = ['deccan', 'peth', 'camp', 'kp', 'station', 'residential', 'riverside'];

export class WorldIndex {
  constructor(M) {
    const meta = M.meta;
    this.M = M;
    this.x0 = meta.vis[0] / 100; this.z0 = meta.vis[1] / 100;
    this.size = meta.chunk; this.ncx = meta.ncx; this.ncz = meta.ncz;
    this.dc = DISTRICT_CENTRES.map(([d, la, lo]) => ({ d, x: (lo - meta.lon0) * meta.mlon, z: -(la - meta.lat0) * meta.mlat }));
    const n = this.ncx * this.ncz;
    // chunk data arrays start as one shared empty array and get their own on the first item: the whole
    // city is 36,000 chunks and most of them are far away and empty at any moment
    this.chunks = [];
    for (let k = 0; k < n; k++) {
      const i = k % this.ncx, j = Math.floor(k / this.ncx);
      const c = { ci: k, i, j, cx: this.x0 + (i + 0.5) * this.size, cz: this.z0 + (j + 0.5) * this.size, built: null, dist: 0, district: 5 };
      for (const f of CHUNK_FIELDS) c[f] = EMPTY;
      this.chunks.push(c);
    }
    for (const c of this.chunks) c.district = this.district(c.cx, c.cz);
    this.shopNames = [];
    this.shopsByBld = new Map();
    this.tileRanges = new Map();
    this.addBase(M);
    if (M.buildings) this.addTile(M, 0, null);
  }
  put(arr, ci, item) {
    const c = this.chunks[ci];
    if (!c || (this._rng && !this._rng(c))) return;
    if (c[arr] === EMPTY) c[arr] = [];
    c[arr].push(item);
  }
  // city-wide things from the base map: the metro and its stations
  addBase(M) {
    const at = (x, z) => this.chunkOf(x, z), put = (a, ci, it) => this.put(a, ci, it);
    for (const s of M.buses || []) put('buses', at(s[0] / 100, s[1] / 100), s);
    for (const m of M.metro || []) { const p = cmRing(m[1]); for (let k = 0; k + 3 < p.length; k += 2) put('metro', at((p[k] + p[k + 2]) / 2, (p[k + 1] + p[k + 3]) / 2), [m[0], p[k], p[k + 1], p[k + 2], p[k + 3]]); }
    for (const st of M.mstations || []) { const p = cmRing(st[1]); put('mstations', at(p[0], p[1]), { name: st[0], pts: p }); }
    // every elevated Pune Metro station gets a station building on the viaduct (where the map has no
    // platform drawn), every underground one an entrance kiosk on the street (game/transit.json)
    const segs = [];
    for (const m of M.metro || []) { const p = cmRing(m[1]); for (let k = 0; k + 3 < p.length; k += 2) segs.push([p[k], p[k + 1], p[k + 2], p[k + 3]]); }
    const have = (M.mstations || []).map(st => { const p = cmRing(st[1]); return [(p[0] + p[p.length - 2]) / 2, (p[1] + p[p.length - 1]) / 2]; });
    for (const l of TRANSIT.metro) for (const s of l.stations) {
      if (s.ug) { put('mgates', at(s.x, s.z), { name: s.name, x: s.x, z: s.z, color: l.color }); continue; }
      if (have.some(([x, z]) => Math.hypot(x - s.x, z - s.z) < 120)) continue;
      let best = null, bd = 70;
      for (const [ax, az, bx, bz] of segs) {
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; if (L2 < 1) continue;
        const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(px - s.x, pz - s.z);
        if (d < bd) { bd = d; const L = Math.sqrt(L2); best = [px, pz, dx / L, dz / L]; }
      }
      if (!best) continue;
      const [cx, cz, ux, uz] = best;
      have.push([cx, cz]);
      put('mstations', at(cx, cz), { name: s.name, pts: [cx - ux * 65, cz - uz * 65, cx + ux * 65, cz + uz * 65], color: l.color });
    }
  }
  // one tile's worth of the city into its chunks. bOff: where its buildings start in M.buildings;
  // rect (metres) keeps everything inside the tile's own chunks. Returns the chunks it touched.
  addTile(D, bOff, rect, tag = 0) {
    const at = (x, z) => this.chunkOf(x, z), put = (a, ci, it) => this.put(a, ci, it);
    this._rng = rect ? (c) => c.cx >= rect[0] && c.cx < rect[2] && c.cz >= rect[1] && c.cz < rect[3] : null;
    const off = bOff || 0;
    for (const [kind, polys] of D.ground) for (const [ci, rings] of polys) put('ground', ci, { kind, rings: rings.map(cmRing) });
    for (const [ci, rings] of D.water) put('water', ci, rings.map(cmRing));
    for (const [ci, line] of D.kerbs) put('kerbs', ci, cmRing(line));
    for (const [ci, line] of D.banks) put('banks', ci, cmRing(line));
    for (const [ci, line] of D.lakebanks || []) put('lakebanks', ci, cmRing(line));
    for (const [ci, line] of D.rails) put('rails', ci, cmRing(line));
    D.buildings.forEach((b, bi) => put('bld', b[0], bi + off));
    for (const w of D.walls) put('walls', at(w[0] / 100, w[1] / 100), cmRing(w));
    for (const l of D.lamps) put('lamps', at(l[0] / 100, l[1] / 100), l);
    for (const l of D.poles) put('poles', at(l[0] / 100, l[1] / 100), l);
    for (const s of D.signals) put('signals', at(s[0] / 100, s[1] / 100), s);
    for (const s of D.stalls) put('stalls', at(s[0] / 100, s[1] / 100), s);
    for (const h of D.hoardings) put('hoardings', at(h[2] / 100, h[3] / 100), h);
    for (const q of D.marks.center) { const p = cmRing(q); put('center', at(p[p.length >> 2 << 1], p[(p.length >> 2 << 1) + 1]), p); }
    for (const q of D.marks.lane) { const p = cmRing(q); put('lane', at(p[p.length >> 2 << 1], p[(p.length >> 2 << 1) + 1]), p); }
    for (const z of D.marks.zebra) put('zebra', at(z[0] / 100, z[1] / 100), z);
    for (const z of D.marks.stop) put('stop', at(z[0] / 100, z[1] / 100), z);
    for (const z of D.marks.bump) put('bump', at(z[0] / 100, z[1] / 100), z);
    for (const r of D.railways || []) { const p = cmRing(r[1]); put('railways', at(p[0], p[1]), { yard: r[0], pts: p }); }
    for (const pf of D.platforms || []) { const p = cmRing(pf); put('platforms', at(p[0], p[1]), p); }
    // shops grouped by building: bi -> Map(edge * 4096 + slot -> [bi, edge, slot, nameIndex, source]);
    // the tile's shop-board names join the global table
    const nOff = this.shopNames.length;
    for (const nm of D.shopNames || []) this.shopNames.push(nm);
    for (const s0 of D.shops || []) {
      const s = off || nOff ? [s0[0] + off, s0[1], s0[2], s0[3] + nOff, s0[4]] : s0;
      let m = this.shopsByBld.get(s[0]);
      if (!m) { m = new Map(); this.shopsByBld.set(s[0], m); }
      m.set(s[1] * 4096 + s[2], s);
    }
    this._rng = null;
    this.tileRanges.set(tag, { off, n: D.buildings.length, rect });
  }
  // forget a tile: its chunks go back to empty, its buildings and shops are dropped
  removeTile(tag) {
    const T = this.tileRanges.get(tag);
    if (!T) return;
    const r = T.rect;
    for (const c of r ? this.chunksIn(r) : this.chunks) {
      if (r && !(c.cx >= r[0] && c.cx < r[2] && c.cz >= r[1] && c.cz < r[3])) continue;
      for (const f of TILE_FIELDS) c[f] = EMPTY;
      c.wires = []; c.extras = (c.extras || []).filter(e => e.kind === 'pier');   // the metro stays
    }
    for (let k = 0; k < T.n; k++) this.shopsByBld.delete(T.off + k);
    this.tileRanges.delete(tag);
  }
  // the chunks over a rect (metres), with a margin
  *chunksIn(r, m = 0) {
    const i0 = Math.max(0, Math.floor((r[0] - m - this.x0) / this.size)), i1 = Math.min(this.ncx - 1, Math.floor((r[2] + m - this.x0) / this.size));
    const j0 = Math.max(0, Math.floor((r[1] - m - this.z0) / this.size)), j1 = Math.min(this.ncz - 1, Math.floor((r[3] + m - this.z0) / this.size));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) yield this.chunks[i + j * this.ncx];
  }
  chunkOf(x, z) {
    const i = Math.floor((x - this.x0) / this.size), j = Math.floor((z - this.z0) / this.size);
    if (i < 0 || j < 0 || i >= this.ncx || j >= this.ncz) return -1;
    return i + j * this.ncx;
  }
  district(x, z) {
    let best = 5, bd = 1e18;
    for (const c of this.dc) { const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < bd) { bd = d; best = c.d; } }
    return best;
  }
}

// Streams chunks around a focus point. `builders` are generator functions fn*(W, chunk, group)
// that add meshes to the chunk group and `yield` between pieces of work (they may return a dispose
// callback). One chunk is built at a time and resumed every frame until this frame's time budget is
// spent, so even a dense chunk never stalls a frame: it just appears a few frames later. Finished
// meshes join the scene one per frame so their GPU uploads are spread out too.
export class Streamer {
  constructor(W, scene, builders, opts = {}) {
    this.W = W; this.scene = scene; this.builders = builders;
    this.radius = opts.radius || 420;       // build within
    this.keep = opts.keep || 560;           // dispose beyond
    this.budgetMs = opts.budgetMs || 4;
    this.built = new Set();
    this.job = null;                        // chunk being built
    this.pendingAdd = [];                   // finished chunks whose meshes are joining the scene
    this.stats = { built: 0, disposed: 0, ms: 0, worst: 0, slices: 0 };
  }
  setRadius(r) { this.radius = r; this.keep = r + 140; }
  *run(c, g, disposers) {
    for (const b of this.builders) {
      if (this.job) this.job.stage = b.name;
      const r = b(this.W, c, g);
      let d = r;
      if (r && typeof r.next === 'function') {
        let st;
        while (!(st = r.next()).done) yield;
        d = st.value;
      }
      if (typeof d === 'function') disposers.push(d);
      yield;
    }
  }
  startJob(c) {
    const g = new THREE.Group();
    g.name = 'chunk' + c.ci;
    g.matrixAutoUpdate = false;
    const disposers = [];
    this.job = { c, g, disposers, it: this.run(c, g, disposers), ms: 0 };
  }
  finishJob() {
    const { c, g, disposers } = this.job;
    g.traverse(o => { if (o.isMesh || o.isLine) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
    c.built = { group: g, disposers };
    this.built.add(c);
    this.stats.built++;
    this.stats.ms = this.job.ms;
    (this.times = this.times || []).push(+this.job.ms.toFixed(1));
    this.job = null;
    return c;
  }
  // show a finished chunk: everything at once (loading screen) or one mesh per frame
  reveal(c, all) {
    const g = c.built.group;
    if (all) { this.scene.add(g); this.W.farGround?.set(c, true); return; }
    const kids = g.children.slice();
    for (const k of kids) k.visible = false;
    this.scene.add(g);
    if (kids.length) this.pendingAdd.push({ c, kids, i: 0 }); else this.W.farGround?.set(c, true);   // an empty chunk (nothing streamed in there yet)
  }
  cancelJob() {
    const { g, disposers } = this.job;
    g.traverse(o => { if ((o.isMesh || o.isLine) && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    for (const d of disposers) d();
    this.job = null;
  }
  disposeChunk(c) {
    const b = c.built;
    if (!b) return;
    this.pendingAdd = this.pendingAdd.filter(p => p.c !== c);
    this.scene.remove(b.group);
    b.group.traverse(o => { if ((o.isMesh || o.isLine) && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    for (const d of b.disposers) d();
    c.built = null;
    this.built.delete(c);
    this.W.farGround?.set(c, false);
    this.stats.disposed++;
  }
  buildNow(c) {
    const t0 = performance.now();
    this.startJob(c);
    while (!this.job.it.next().done) { /* drain */ }
    this.job.ms = performance.now() - t0;
    this.reveal(this.finishJob(), true);
  }
  // build everything within `r` right now (loading screen)
  warm(x, z, r, onEach) {
    if (this.job) this.cancelJob();
    for (const p of this.pendingAdd) { for (const k of p.kids) k.visible = true; this.W.farGround?.set(p.c, true); }
    this.pendingAdd.length = 0;
    const list = this.W.index.chunks.filter(c => Math.hypot(c.cx - x, c.cz - z) < r + this.W.index.size * 0.7 && !c.built);
    list.sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z));
    for (let k = 0; k < list.length; k++) { this.buildNow(list[k]); if (onEach) onEach(k + 1, list.length); }
  }
  pickNext(x, z, viewDir) {
    const I = this.W.index, half = I.size * 0.71;
    const r2 = this.radius;
    const i0 = Math.max(0, Math.floor((x - r2 - I.x0) / I.size)), i1 = Math.min(I.ncx - 1, Math.floor((x + r2 - I.x0) / I.size));
    const j0 = Math.max(0, Math.floor((z - r2 - I.z0) / I.size)), j1 = Math.min(I.ncz - 1, Math.floor((z + r2 - I.z0) / I.size));
    let best = null, bs = 1e18, n = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = I.chunks[i + j * I.ncx];
      if (c.built) continue;
      const dx = c.cx - x, dz = c.cz - z, d = Math.hypot(dx, dz) - half;
      if (d > this.radius) continue;
      n++;
      let score = d;
      if (viewDir && d > 40) score -= (dx * viewDir.x + dz * viewDir.z) / Math.max(1, d + half) * 160;   // what you're looking at first
      if (score < bs) { bs = score; best = c; }
    }
    this.missing = n;
    return best;
  }
  update(x, z, viewDir) {
    const I = this.W.index, half = I.size * 0.71;
    const t0 = performance.now();
    // drop far chunks (and a half-built one we've driven away from)
    for (const c of this.built) if (Math.hypot(c.cx - x, c.cz - z) - half > this.keep) this.disposeChunk(c);
    if (this.job && Math.hypot(this.job.c.cx - x, this.job.c.cz - z) - half > this.keep) this.cancelJob();
    // one finished mesh joins the scene per frame
    if (this.pendingAdd.length) {
      const p = this.pendingAdd[0];
      p.kids[p.i++].visible = true;
      if (p.i >= p.kids.length) { this.pendingAdd.shift(); this.W.farGround?.set(p.c, true); }
    }
    // resume the current build until the budget is spent
    let slices = 0;
    while (performance.now() - t0 < this.budgetMs) {
      if (!this.job) {
        const c = this.pickNext(x, z, viewDir);
        if (!c) break;
        this.startJob(c);
      }
      const s0 = performance.now();
      const st = this.job.it.next();
      const sl = performance.now() - s0;
      this.job.ms += sl;
      if (sl > (this.stats.maxSlice || 0)) { this.stats.maxSlice = sl; this.stats.maxSliceAt = this.job.stage + ':' + (this.W.sliceLabel || ''); }
      slices++;
      if (st.done) this.reveal(this.finishJob(), false);
    }
    const spent = performance.now() - t0;
    this.stats.slices = slices;
    this.stats.worst = Math.max(this.stats.worst * 0.995, spent);
    return (this.missing || 0) + (this.job ? 1 : 0) + this.pendingAdd.length;
  }
}
