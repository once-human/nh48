// World index + streaming. The baked map is parsed once; static geometry is built per 200 m
// chunk when the camera comes near and disposed when it leaves, nearest chunks first, inside a
// per-frame time budget so driving never hitches.
import * as THREE from 'three';
import { cmRing } from './geo.js';

// district centres (same table as the baker): 0 deccan/FC, 1 peth, 2 camp, 3 KP, 4 station, 5 residential, 6 riverside
const DISTRICT_CENTRES = [
  [0, 18.5172, 73.8418], [0, 18.5235, 73.8410], [5, 18.5335, 73.8370], [5, 18.5125, 73.8345], [5, 18.5330, 73.8440],
  [4, 18.5300, 73.8500], [1, 18.5150, 73.8555], [1, 18.5205, 73.8590], [1, 18.5130, 73.8630], [4, 18.5285, 73.8690],
  [4, 18.5270, 73.8760], [2, 18.5160, 73.8790], [2, 18.5195, 73.8840], [6, 18.5370, 73.8820], [3, 18.5395, 73.8920],
  [3, 18.5355, 73.8930], [6, 18.5420, 73.8650], [6, 18.5250, 73.8620],
];
export const DISTRICTS = ['deccan', 'peth', 'camp', 'kp', 'station', 'residential', 'riverside'];

export class WorldIndex {
  constructor(M) {
    const meta = M.meta;
    this.M = M;
    this.x0 = meta.vis[0] / 100; this.z0 = meta.vis[1] / 100;
    this.size = meta.chunk; this.ncx = meta.ncx; this.ncz = meta.ncz;
    this.dc = DISTRICT_CENTRES.map(([d, la, lo]) => ({ d, x: (lo - meta.lon0) * meta.mlon, z: -(la - meta.lat0) * meta.mlat }));
    const n = this.ncx * this.ncz;
    this.chunks = [];
    for (let k = 0; k < n; k++) {
      const i = k % this.ncx, j = Math.floor(k / this.ncx);
      this.chunks.push({ ci: k, i, j, cx: this.x0 + (i + 0.5) * this.size, cz: this.z0 + (j + 0.5) * this.size,
        ground: [], water: [], kerbs: [], banks: [], lakebanks: [], rails: [], bld: [], walls: [], lamps: [], poles: [],
        signals: [], buses: [], stalls: [], hoardings: [], center: [], lane: [], zebra: [], stop: [], bump: [], pot: [],
        metro: [], railways: [], platforms: [], mstations: [], built: null, dist: 0, district: 5 });
    }
    for (const c of this.chunks) c.district = this.district(c.cx, c.cz);
    const at = (x, z) => this.chunkOf(x, z);
    const put = (arr, ci, item) => { if (ci >= 0 && ci < n) this.chunks[ci][arr].push(item); };
    for (const [kind, polys] of M.ground) for (const [ci, rings] of polys) put('ground', ci, { kind, rings: rings.map(cmRing) });
    for (const [ci, rings] of M.water) put('water', ci, rings.map(cmRing));
    for (const [ci, line] of M.kerbs) put('kerbs', ci, cmRing(line));
    for (const [ci, line] of M.banks) put('banks', ci, cmRing(line));
    for (const [ci, line] of M.lakebanks || []) put('lakebanks', ci, cmRing(line));
    for (const [ci, line] of M.rails) put('rails', ci, cmRing(line));
    M.buildings.forEach((b, bi) => put('bld', b[0], bi));
    for (const w of M.walls) put('walls', at(w[0] / 100, w[1] / 100), cmRing(w));
    for (const l of M.lamps) put('lamps', at(l[0] / 100, l[1] / 100), l);
    for (const l of M.poles) put('poles', at(l[0] / 100, l[1] / 100), l);
    for (const s of M.signals) put('signals', at(s[0] / 100, s[1] / 100), s);
    for (const s of M.buses) put('buses', at(s[0] / 100, s[1] / 100), s);
    for (const s of M.stalls) put('stalls', at(s[0] / 100, s[1] / 100), s);
    for (const h of M.hoardings) put('hoardings', at(h[2] / 100, h[3] / 100), h);
    for (const s of M.marks.center) { const p = cmRing(s); put('center', at(p[p.length >> 2 << 1], p[(p.length >> 2 << 1) + 1]), p); }
    for (const s of M.marks.lane) { const p = cmRing(s); put('lane', at(p[p.length >> 2 << 1], p[(p.length >> 2 << 1) + 1]), p); }
    for (const z of M.marks.zebra) put('zebra', at(z[0] / 100, z[1] / 100), z);
    for (const z of M.marks.stop) put('stop', at(z[0] / 100, z[1] / 100), z);
    for (const z of M.marks.bump) put('bump', at(z[0] / 100, z[1] / 100), z);
    for (const m of M.metro) { const p = cmRing(m[1]); for (let k = 0; k + 3 < p.length; k += 2) put('metro', at((p[k] + p[k + 2]) / 2, (p[k + 1] + p[k + 3]) / 2), [m[0], p[k], p[k + 1], p[k + 2], p[k + 3]]); }
    for (const r of M.railways || []) { const p = cmRing(r[1]); put('railways', at(p[0], p[1]), { yard: r[0], pts: p }); }
    for (const pf of M.platforms || []) { const p = cmRing(pf); put('platforms', at(p[0], p[1]), p); }
    for (const st of M.mstations || []) { const p = cmRing(st[1]); put('mstations', at(p[0], p[1]), { name: st[0], pts: p }); }
    // shops grouped by building
    this.shopsByBld = new Map();
    for (const s of M.shops || []) { if (!this.shopsByBld.has(s[0])) this.shopsByBld.set(s[0], []); this.shopsByBld.get(s[0]).push(s); }
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

// Streams chunks around a focus point. `builders` is a list of fn(W, chunk, group) that add meshes
// to the chunk group (and may return a dispose callback).
export class Streamer {
  constructor(W, scene, builders, opts = {}) {
    this.W = W; this.scene = scene; this.builders = builders;
    this.radius = opts.radius || 420;       // build within
    this.keep = opts.keep || 560;           // dispose beyond
    this.budgetMs = opts.budgetMs || 7;
    this.built = new Set();
    this.queue = [];
    this.stats = { built: 0, disposed: 0, ms: 0 };
  }
  setRadius(r) { this.radius = r; this.keep = r + 140; }
  buildChunk(c) {
    const t0 = performance.now();
    const g = new THREE.Group();
    g.name = 'chunk' + c.ci;
    const disposers = [];
    for (const b of this.builders) {
      const d = b(this.W, c, g);
      if (typeof d === 'function') disposers.push(d);
    }
    g.traverse(o => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
    g.matrixAutoUpdate = false;
    this.scene.add(g);
    c.built = { group: g, disposers };
    this.built.add(c);
    this.W.farGround?.set(c, true);
    this.stats.built++;
    this.stats.ms = performance.now() - t0;
  }
  disposeChunk(c) {
    const b = c.built;
    if (!b) return;
    this.scene.remove(b.group);
    b.group.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    for (const d of b.disposers) d();
    c.built = null;
    this.built.delete(c);
    this.W.farGround?.set(c, false);
    this.stats.disposed++;
  }
  // build everything within `r` right now (loading screen)
  warm(x, z, r, onEach) {
    const list = this.W.index.chunks.filter(c => Math.hypot(c.cx - x, c.cz - z) < r + this.W.index.size * 0.7 && !c.built);
    list.sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z));
    for (let k = 0; k < list.length; k++) { this.buildChunk(list[k]); if (onEach) onEach(k + 1, list.length); }
  }
  update(x, z, viewDir) {
    const I = this.W.index, half = I.size * 0.71;
    const t0 = performance.now();
    // drop far chunks
    for (const c of [...this.built]) if (Math.hypot(c.cx - x, c.cz - z) - half > this.keep) this.disposeChunk(c);
    // candidates: nearest missing chunks, slightly favouring the view direction
    const r2 = this.radius;
    const i0 = Math.max(0, Math.floor((x - r2 - I.x0) / I.size)), i1 = Math.min(I.ncx - 1, Math.floor((x + r2 - I.x0) / I.size));
    const j0 = Math.max(0, Math.floor((z - r2 - I.z0) / I.size)), j1 = Math.min(I.ncz - 1, Math.floor((z + r2 - I.z0) / I.size));
    const cand = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = I.chunks[i + j * I.ncx];
      if (c.built) continue;
      const dx = c.cx - x, dz = c.cz - z, d = Math.hypot(dx, dz) - half;
      if (d > this.radius) continue;
      let score = d;
      if (viewDir && d > 60) score -= (dx * viewDir.x + dz * viewDir.z) / Math.max(1, d + half) * 80;
      cand.push([score, c]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, c] of cand) {
      if (performance.now() - t0 > this.budgetMs) break;
      this.buildChunk(c);
    }
    return cand.length;
  }
}
