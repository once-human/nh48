// Whole-Pune streaming: the city is 4 km tiles. Tiles near you are fetched (gzip JSON), then joined to the
// world a slice at a time so no frame stalls: roads, buildings, surfaces, collision, trees, street furniture,
// parked vehicles, road markings, crowd activity, shops. Tiles far behind you are dropped again, so even a
// weak PC only ever holds a handful.
import { versioned } from '../core/assets.js';
import { cmRing } from './geo.js';
import { addStreetProps, removeStreetProps } from './propsChunk.js';
import { addGroundTile, removeGroundTile } from './groundChunk.js';

// 1 km pieces: fetched when you're within 1.2 km of one, dropped past 1.9 km; joining one costs at most a few ms a frame
const LOAD_R = 1200, DROP_R = 1900, BUDGET = 3;

async function fetchJSONgz(url) {
  const r = await fetch(versioned(url));
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const s = r.body.pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(s).text());
}

// the base file, shaped like the single map with empty tile layers (the tiles fill them in)
export function cityFromBase(B) {
  const m = B.meta;
  const P = (lon, lat) => [Math.round((lon - m.lon0) * m.mlon * 100), Math.round(-(lat - m.lat0) * m.mlat * 100)];
  const ring = m.outline.map(([lon, lat]) => P(lon, lat));
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of ring) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return {
    ...B, meta: { ...m, play: [x0, z0, x1, z1], outlineXZ: ring },
    graph: { nodes: [], edges: [] }, ground: [], water: [], banks: [], lakebanks: [], kerbs: [], rails: [], buildings: [],
    marks: { center: [], lane: [], zebra: [], stop: [], bump: [] }, trees: [], walls: [], lamps: [], poles: [], signals: [], stalls: [],
    parked: [], hoardings: [], shops: [], railways: [], platforms: [], shopNames: [], pins: [],
    activity: { cell: m.activity ? m.activity.cell : 50, cls: m.activity ? m.activity.cls : [], cells: [] },
  };
}

export class TileManager {
  constructor(W, base) {
    this.W = W; this.base = base; this.game = null;
    this.list = W.M.meta.tiles.map(([i, j, rect, size]) => ({ i, j, tag: 1 + i * 100 + j, rect: rect.map(v => v / 100), size, state: 'none' }));
    this.ready = []; this.dropping = []; this.job = null; this.t = 0;
    // the city's edge: a wall along the outline (the roads that cross it were barricaded in the bake)
    const o = W.M.meta.outlineXZ, C = W.collision;
    for (let k = 0; k < o.length; k++) { const a = o[k], b = o[(k + 1) % o.length]; C.addSeg(a[0] / 100, a[1] / 100, b[0] / 100, b[1] / 100, 3); }
  }
  dist(T, x, z) {
    const r = T.rect, dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - z, 0, z - r[3]);
    return Math.hypot(dx, dz);
  }
  url(T) { return `assets/pune/t_${T.i}_${T.j}.json.gz`; }
  fetch(T) { return (T.pending = this.fetch1(T)); }
  async fetch1(T) {
    T.state = 'loading';
    try { T.data = await fetchJSONgz(this.url(T)); T.state = 'ready'; this.ready.push(T); }
    catch (e) { console.warn('tile', T.i, T.j, e); T.state = 'none'; T.retry = performance.now() + 5000; }
  }
  // before the first frame: everything near the start, all at once
  async warm(x, z, r, onProgress) {
    const near = this.list.filter(T => this.dist(T, x, z) < r);
    let k = 0;
    await Promise.all(near.map(async T => { await this.fetch(T); onProgress && onProgress(++k, near.length * 2); }));
    for (const T of this.ready.splice(0)) { const it = this.integrate(T); while (!it.next().done) { /* drain */ } onProgress && onProgress(++k, near.length * 2); }
  }
  // once the game exists: what needed it (parked vehicles, signals) for the tiles already in
  attachGame(game) {
    this.game = game;
    for (const T of this.list) if (T.state === 'live' && T.parkedLater) { this.W.collision.tag = T.tag; this.W.parked?.addTile(T.parkedLater, T.tag); this.W.collision.tag = 0; T.parkedLater = null; }
  }
  update(dt, x, z) {
    if ((this.t -= dt) <= 0) {
      this.t = 0.5;
      for (const T of this.list) {
        const d = this.dist(T, x, z);
        if (T.state === 'none' && d < LOAD_R && !(T.retry > performance.now())) this.fetch(T);
        else if (T.state === 'live' && d > DROP_R) { T.state = 'dropping'; this.dropping.push(T); }
      }
    }
    if (!this.job && this.dropping.length) this.job = this.dropJob(this.dropping.shift());
    if (!this.job && this.ready.length) this.job = this.integrate(this.ready.shift());
    if (this.job) {
      const t0 = performance.now();
      while (performance.now() - t0 < BUDGET) { if (this.job.next().done) { this.job = null; break; } }
    }
  }
  // somewhere you're about to be (fast travel, a bus, the hospital): the pieces within r of (x, z) fetched and
  // joined right now, behind the black screen, so you arrive in a built street
  async ensure(x, z, r = 650, onProgress) {
    const need = this.list.filter(T => this.dist(T, x, z) < r);
    let done = 0; const tick = () => onProgress && onProgress(++done / Math.max(1, need.length * 2));
    while (this.job) { if (this.job.next().done) this.job = null; }
    for (const T of need) if (T.state === 'dropping') { this.dropping = this.dropping.filter(q => q !== T); T.state = 'live'; }
    await Promise.all(need.map(async T => { if (T.state === 'none') await this.fetch(T); else if (T.state === 'loading') await T.pending; tick(); }));
    for (const T of need) {
      if (T.state === 'ready') {
        this.ready = this.ready.filter(q => q !== T);
        try { const it = this.integrate(T); while (!it.next().done) { /* now */ } } catch (e) { console.warn('tile', T.i, T.j, e); }
        await new Promise(res => setTimeout(res, 0));        // let the bar move
      }
      tick();
    }
  }
  // join a tile to the world, a slice at a time
  *integrate(T) {
    const W = this.W, D = T.data, tag = T.tag, M = W.M, C = W.collision;
    const rect = T.rect;
    const tagged = (f) => { C.tag = tag; try { f(); } finally { C.tag = 0; } };
    // roads
    const g = W.graph.addTile(D.graph, tag);
    T.nodes = [...new Set(g.nodes)];
    if (this.game && this.game.traffic) this.game.traffic.signals.addNodes(T.nodes);
    yield;
    // buildings and everything filed by chunk
    const bOff = M.buildings.length;
    for (const b of D.buildings) M.buildings.push(b);
    T.bOff = bOff; T.bN = D.buildings.length;
    D.buses = []; D.pois = []; D.places = [];
    W.index.addTile(D, bOff, rect, tag);
    yield;
    W.surf.addTile({ ground: D.ground, water: D.water, buildings: [] }, tag);
    for (let k = 0; k < D.buildings.length; k += 1500) { yield; W.surf.addTile({ ground: [], water: [], buildings: D.buildings.slice(k, k + 1500) }, tag); }
    yield;
    for (let k = 0; k < D.buildings.length; k += 500) { tagged(() => { for (const B of D.buildings.slice(k, k + 500)) C.addRing(cmRing(B[1]), 0); }); yield; }
    tagged(() => {
      for (const [, line] of D.banks) C.addLine(cmRing(line), 4);
      for (const [, line] of D.rails) C.addLine(cmRing(line), 4);
    });
    yield;
    tagged(() => {
      for (const w of D.walls) { const p = cmRing(w); for (let k = 0; k + 3 < p.length; k += 2) C.addSeg(p[k], p[k + 1], p[k + 2], p[k + 3], 5); }
      for (const s of D.stalls) C.addCircle(s[0] / 100, s[1] / 100, 0.9, 2);
    });
    yield;
    tagged(() => W.trees.addTile(D.trees, tag));
    yield;
    tagged(() => addStreetProps(W, D, tag, g.nodes));
    yield;
    if (W.parked) tagged(() => W.parked.addTile(D, tag)); else T.parkedLater = { parked: D.parked };
    yield;
    addGroundTile(W, D, g.edges, tag);
    W.activity.addCells(D.activity || [], tag);
    for (const s of D.stalls) { s.tag = tag; M.stalls.push(s); }
    for (const p of D.pins || []) { p.tag = tag; M.pins.push(p); }
    if (W.cityMap && W.cityMap.addPins) W.cityMap.addPins(D.pins || []);
    yield;
    // chunks built before the data arrived get rebuilt, the map redraws here
    this.refresh(rect);
    T.data = null; T.state = 'live';
  }
  drop(T) { const it = this.dropJob(T); while (!it.next().done) { /* all at once */ } }
  // leave a tile behind, a slice per frame
  *dropJob(T) {
    const W = this.W, M = W.M, tag = T.tag;
    this.refresh(T.rect, true);
    yield;
    W.graph.removeTile(tag);
    yield;
    if (this.game && this.game.traffic) this.game.traffic.signals.addNodes(T.nodes || []);
    W.index.removeTile(tag);
    yield;
    for (let k = 0; k < T.bN; k++) M.buildings[T.bOff + k] = null;
    W.surf.removeTile(tag);
    yield;
    W.collision.removeTag(tag, T.rect);
    yield;
    W.trees.removeTile(tag);
    yield;
    removeStreetProps(W, tag);
    yield;
    W.parked?.removeTile(tag);
    removeGroundTile(W, tag);
    W.activity.removeTag(tag);
    M.stalls = M.stalls.filter(s => s.tag !== tag);
    M.pins = M.pins.filter(p => p.tag !== tag);
    T.state = 'none'; T.nodes = null;
  }
  refresh(rect, gone) {
    const W = this.W, I = W.index, st = W.streamer;
    for (const c of I.chunksIn(rect, 100)) {
      if (st && c.built) st.disposeChunk(c);
      if (W.cityMap) W.cityMap.prepped.delete(c.ci);
    }
    if (W.cityMap) { if (W.cityMap.invalidate) W.cityMap.invalidate(rect); else W.cityMap.cache.clear(); }
    W._propX = undefined;
    if (W.trees) W.trees.lastX = 1e9;
    void gone;
  }
}
