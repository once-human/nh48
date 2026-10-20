// City map: tiles drawn on demand from the same map data the world is built from, a places index
// for search, and the full-screen map screen (drag, zoom, search, filters, waypoint + GPS).
// The minimap draws through the same tile cache, so both always agree with the streets you drive.
import { cmRing } from '../world/geo.js';

const TILE = 256;
const BASE_PPM = 0.25;            // pixels per metre at level 0
const MAX_LEVEL = 5;              // 8 px/m
const COL = {
  bg: '#101216', land: '#14171b', grass: '#16241b', soil: '#1b1a17', scrub: '#15211a', plaza: '#1a1c20', median: '#1a2219', pavers: '#1b1d22',
  water: '#0d2433', building: '#23272e', landmark: '#3a3220', road: '#3b3f47', main: '#5a5f69', arterial: '#6e7480', rail: '#2d3037', bridge: '#5d626c',
};
// map categories: label, colour, glyph
export const CATS = {
  landmark: ['Landmarks', '#f2b705', '★'], police: ['Police', '#5aa2ff', 'P'], hospital: ['Health', '#ff5a4f', '+'],
  food: ['Food & drink', '#ffb020', '●'], shop: ['Shops', '#7fd1ff', '●'], bank: ['Banks', '#4dd0c8', '₹'], fuel: ['Fuel', '#a08cff', 'F'],
  transit: ['Transit', '#33d17a', 'T'], park: ['Parks', '#5bbf6a', '♣'], temple: ['Temples', '#ff9f43', 'ॐ'], college: ['Colleges', '#c08cff', 'C'],
  cinema: ['Theatres', '#ff6ec7', '▶'],
};
const FOOD = new Set(['food', 'cafe', 'bar', 'icecream', 'sweets', 'bakery']);
const SHOPC = { bank: 'bank', atm: 'bank', police: 'police', clinic: 'hospital' };

export class CityMap {
  constructor(W) {
    this.W = W;
    const M = W.M, I = W.index;
    this.x0 = M.meta.vis[0] / 100; this.z0 = M.meta.vis[1] / 100; this.x1 = M.meta.vis[2] / 100; this.z1 = M.meta.vis[3] / 100;
    this.cache = new Map(); this.queue = []; this.queued = new Set(); this.useT = 0;
    this.lmBld = new Set();
    // places: landmarks, POIs, and every real shop at the board it hangs on
    const P = [];
    for (const l of M.landmarks || []) P.push({ n: l[0], mr: l[1], c: 'landmark', x: l[2] / 100, z: l[3] / 100, blurb: l[4], k: l[5] });
    for (const p of M.places || []) P.push({ n: p[0], mr: p[1], c: p[2], x: p[3] / 100, z: p[4] / 100 });
    const names = M.shopNames || [];
    for (const s of M.shops || []) {
      if (!s[4]) continue;                       // invented boards are not on the map
      const nm = names[s[3]]; if (!nm || nm[2] === 'police') continue;   // police come from `places`
      const B = M.buildings[s[0]], r = B[1], n = r.length / 2, i = s[1], j = (i + 1) % n;
      const ax = r[2 * i] / 100, az = r[2 * i + 1] / 100, bx = r[2 * j] / 100, bz = r[2 * j + 1] / 100;
      const L = Math.hypot(bx - ax, bz - az), ns = Math.max(1, Math.floor(L / 3.6)), t = (s[2] + 0.5) / ns;
      P.push({ n: nm[0], mr: nm[1], c: FOOD.has(nm[2]) ? 'food' : (SHOPC[nm[2]] || 'shop'), sub: nm[2], x: ax + (bx - ax) * t, z: az + (bz - az) * t });
    }
    this.places = P;
    // grid of places for hit tests and culling
    this.pgrid = new Map(); this.pcell = 120;
    for (const p of P) { const k = this.key(p.x, p.z); if (!this.pgrid.has(k)) this.pgrid.set(k, []); this.pgrid.get(k).push(p); }
    // areas (suburbs) and districts for labels at low zoom
    this.areas = (M.pois || []).filter(p => p[4] === 'suburb' || p[4] === 'neighbourhood' || p[4] === 'locality')
      .map(p => ({ n: p[0], x: p[2] / 100, z: p[3] / 100 }));
    // streets for search and labels: one entry per name, at its longest edge
    const G = W.graph, best = new Map();
    for (const e of G.edges) {
      const nm = G.names[e.name]; if (!nm || !nm[0]) continue;
      const o = best.get(nm[0]); if (!o || e.len > o.e.len) best.set(nm[0], { e, nm });
    }
    this.streets = [...best.values()].map(({ e, nm }) => { const t = G.at(e, e.len / 2); return { n: nm[0], mr: nm[1], c: 'street', x: t[0], z: t[1], rank: e.rank }; });
    this.chunks = I.chunks;
  }
  // level-0 tiles for the whole city, drawn once while loading so the map never opens empty
  warm(z = 0) {
    const S = this.tileSize(z), nx = Math.ceil((this.x1 - this.x0) / S), ny = Math.ceil((this.z1 - this.z0) / S);
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) { const k = z + '/' + tx + '/' + ty; if (!this.cache.has(k)) this.cache.set(k, { c: this.renderTile(z, tx, ty), u: 1e12 }); }
  }
  key(x, z) { return Math.floor(x / this.pcell) + ',' + Math.floor(z / this.pcell); }
  placesNear(x, z, r) {
    const out = [], c = this.pcell;
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) { const l = this.pgrid.get(i + ',' + j); if (l) out.push(...l); }
    return out;
  }
  placesIn(xa, za, xb, zb) {
    const out = [], c = this.pcell;
    for (let i = Math.floor(xa / c); i <= Math.floor(xb / c); i++)
      for (let j = Math.floor(za / c); j <= Math.floor(zb / c); j++) { const l = this.pgrid.get(i + ',' + j); if (l) out.push(...l); }
    return out;
  }

  // ---------------------------------------------------------------- tiles
  level(ppm) { return Math.max(0, Math.min(MAX_LEVEL, Math.round(Math.log2(ppm / BASE_PPM) + 0.25))); }
  tileSize(z) { return TILE / (BASE_PPM * (1 << z)); }          // metres per tile
  tile(z, tx, ty, request = true) {
    const k = z + '/' + tx + '/' + ty;
    const t = this.cache.get(k);
    if (t) { t.u = this.useT; return t.c; }
    if (request && !this.queued.has(k)) { this.queued.add(k); this.queue.push([z, tx, ty, k]); }
    return null;
  }
  // render queued tiles within a time budget (ms); nearest-requested last-in first
  pump(budget = 4) {
    const t0 = performance.now();
    this.useT++;
    while (this.queue.length && performance.now() - t0 < budget) {
      const [z, tx, ty, k] = this.queue.pop();
      this.queued.delete(k);
      if (this.cache.has(k)) continue;
      this.cache.set(k, { c: this.renderTile(z, tx, ty), u: this.useT });
    }
    if (this.queue.length > 64) { for (const q of this.queue.splice(0, this.queue.length - 64)) this.queued.delete(q[3]); }
    if (this.cache.size > 140) {         // evict least recently used
      const arr = [...this.cache.entries()].sort((a, b) => a[1].u - b[1].u);
      for (let i = 0; i < arr.length - 110; i++) this.cache.delete(arr[i][0]);
    }
  }
  renderTile(z, tx, ty) {
    const W = this.W, S = this.tileSize(z), ppm = TILE / S;
    const wx0 = this.x0 + tx * S, wz0 = this.z0 + ty * S;
    const c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
    const x = c.getContext('2d');
    x.fillStyle = COL.land; x.fillRect(0, 0, TILE, TILE);
    x.setTransform(ppm, 0, 0, ppm, -wx0 * ppm, -wz0 * ppm);
    const I = W.index, cs = I.size;
    const i0 = Math.max(0, Math.floor((wx0 - this.x0) / cs) - 1), i1 = Math.min(I.ncx - 1, Math.floor((wx0 + S - this.x0) / cs) + 1);
    const j0 = Math.max(0, Math.floor((wz0 - this.z0) / cs) - 1), j1 = Math.min(I.ncz - 1, Math.floor((wz0 + S - this.z0) / cs) + 1);
    const ring = (r) => { x.moveTo(r[0], r[1]); for (let k = 2; k < r.length; k += 2) x.lineTo(r[k], r[k + 1]); x.closePath(); };
    const layer = (fn) => { for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(this.chunks[i + j * I.ncx]); };
    // ground (parks, plazas), water
    for (const kind of ['grass', 'scrub', 'soil', 'median', 'plaza', 'pavers']) {
      x.beginPath(); let any = false;
      layer(C => { for (const g of C.ground) if (g.kind === kind) { for (const r of g.rings) ring(r); any = true; } });
      if (any) { x.fillStyle = COL[kind]; x.fill('evenodd'); }
    }
    x.beginPath(); layer(C => { for (const rs of C.water) for (const r of rs) ring(r); }); x.fillStyle = COL.water; x.fill('evenodd');
    // roads: true asphalt shapes when zoomed in, graph lines with a minimum width when zoomed out
    const G = W.graph, mid = [wx0 + S / 2, wz0 + S / 2];
    const edges = G.gridQuery(mid[0], mid[1], S * 0.75);
    if (z >= 3) {
      x.beginPath(); layer(C => { for (const g of C.ground) if (g.kind === 'asphalt' || g.kind === 'concrete' || g.kind === 'bridge_road') for (const r of g.rings) ring(r); });
      x.fillStyle = COL.road; x.fill('evenodd');
    }
    const order = [...edges].sort((a, b) => a.rank - b.rank);
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const e of order) {
      if (z < 2 && e.rank < 3) continue;
      if (z >= 3 && e.rank < 4) continue;           // small streets: the asphalt fill already shows them
      const minPx = e.rank >= 5 ? 3.2 : e.rank >= 4 ? 2.4 : e.rank >= 3 ? 1.6 : 1.1;
      x.lineWidth = Math.max(e.w * (z >= 3 ? 0.9 : 1), minPx / ppm);
      x.strokeStyle = e.bridge ? COL.bridge : e.rank >= 5 ? COL.arterial : e.rank >= 4 ? COL.main : COL.road;
      const p = e.pts; x.beginPath(); x.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) x.lineTo(p[k], p[k + 1]); x.stroke();
    }
    // rails
    x.strokeStyle = COL.rail; x.lineWidth = Math.max(1.2, 1.4 / ppm); x.beginPath();
    layer(C => { for (const r of C.rails) { x.moveTo(r[0], r[1]); for (let k = 2; k < r.length; k += 2) x.lineTo(r[k], r[k + 1]); } }); x.stroke();
    // buildings
    if (z >= 1) {
      const M = W.M;
      x.beginPath(); const lm = [];
      layer(C => { for (const bi of C.bld) { const b = M.buildings[bi]; if (b[3] === 8 || b[3] === 11 || b[3] === 5 || b[3] === 12) lm.push(b); else ring(cmRing(b[1])); } });
      x.fillStyle = COL.building; x.fill();
      x.beginPath(); for (const b of lm) ring(cmRing(b[1])); x.fillStyle = COL.landmark; x.fill();
      if (z >= 4) { x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 0.6 / ppm * 2; x.beginPath(); layer(C => { for (const bi of C.bld) ring(cmRing(M.buildings[bi][1])); }); x.stroke(); }
    }
    return c;
  }
  // draw the map into ctx: view centred at (cx,cz) in metres, ppm screen px per metre, rotation rot (rad),
  // ctx already translated to the view centre in screen px; radius = half-diagonal of the view in px
  drawTiles(ctx, cx, cz, ppm, rot, radius) {
    const z = this.level(ppm), S = this.tileSize(z), r = radius / ppm;
    const t0x = Math.floor((cx - r - this.x0) / S), t1x = Math.floor((cx + r - this.x0) / S);
    const t0y = Math.floor((cz - r - this.z0) / S), t1y = Math.floor((cz + r - this.z0) / S);
    const nx = Math.ceil((this.x1 - this.x0) / S), ny = Math.ceil((this.z1 - this.z0) / S);
    ctx.save();
    ctx.rotate(rot); ctx.scale(ppm, ppm); ctx.translate(-cx, -cz);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // request nearest tiles last so they render first
    const want = [];
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      if (tx < 0 || ty < 0 || tx >= nx || ty >= ny) continue;
      want.push([Math.hypot(this.x0 + (tx + 0.5) * S - cx, this.z0 + (ty + 0.5) * S - cz), tx, ty]);
    }
    want.sort((a, b) => b[0] - a[0]);
    for (const [, tx, ty] of want) {
      const wx = this.x0 + tx * S, wz = this.z0 + ty * S;
      const c = this.tile(z, tx, ty);
      if (c) { ctx.drawImage(c, wx, wz, S + 0.5 / ppm, S + 0.5 / ppm); continue; }
      // fall back to a coarser level while this one renders
      for (let pz = z - 1; pz >= 0; pz--) {
        const PS = this.tileSize(pz), px = Math.floor((wx + 1e-3 - this.x0) / PS), py = Math.floor((wz + 1e-3 - this.z0) / PS);
        const pc = this.tile(pz, px, py, pz === 0);
        if (!pc) continue;
        const f = TILE / PS;
        ctx.drawImage(pc, (wx - (this.x0 + px * PS)) * f, (wz - (this.z0 + py * PS)) * f, S * f, S * f, wx, wz, S, S);
        break;
      }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- shared drawing bits
export function drawPin(x, X, Y, col, glyph, size = 9, ring = '#0a0b0d') {
  x.fillStyle = col; x.strokeStyle = ring; x.lineWidth = 2;
  x.beginPath(); x.arc(X, Y, size, 0, Math.PI * 2); x.fill(); x.stroke();
  if (glyph && glyph !== '●') {
    x.fillStyle = '#0a0b0d'; x.font = `800 ${Math.round(size * 1.15)}px Inter, Mukta, system-ui, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(glyph, X, Y + 0.5);
  }
}
export function drawArrow(x, X, Y, ang, s = 1) {
  x.save(); x.translate(X, Y); x.rotate(ang); x.scale(s, s);
  x.fillStyle = '#f4f1ea'; x.strokeStyle = '#0a0b0d'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, -11); x.lineTo(8, 8); x.lineTo(0, 4); x.lineTo(-8, 8); x.closePath(); x.fill(); x.stroke();
  x.restore();
}
export function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km' : Math.max(10, Math.round(m / 10) * 10) + ' m'; }
const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ऀ-ॿ ]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- full-screen map
export class MapScreen {
  constructor(game, root, city) {
    this.g = game; this.city = city;
    this.filters = new Set(['landmark', 'police', 'hospital', 'transit', 'fuel', 'food', 'shop', 'bank', 'park', 'temple', 'college', 'cinema']);
    this.view = { x: 0, z: 0, ppm: 0.6 };
    this.target = null;            // smooth fly-to {x,z,ppm}
    this.sel = null;
    this.vel = { x: 0, z: 0 };
    const m = document.createElement('div');
    m.className = 'ov bigmap'; m.hidden = true;
    m.innerHTML = `
      <canvas class="bm-canvas" aria-label="Map of Pune"></canvas>
      <div class="bm-top">
        <label class="bm-search glass"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <input id="bm-q" type="search" placeholder="Search places, streets, areas" autocomplete="off" spellcheck="false" aria-label="Search the map"><span class="kbd">/</span></label>
        <div class="bm-results glass" id="bm-res" hidden role="listbox"></div>
      </div>
      <div class="bm-filters" id="bm-filters" role="group" aria-label="Show on map"></div>
      <div class="bm-tools">
        <button class="ibtn" id="bm-in" title="Zoom in (+)">+</button><button class="ibtn" id="bm-out" title="Zoom out (−)">−</button>
        <button class="ibtn" id="bm-me" title="Centre on me (Space)"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
      </div>
      <button class="btn small bm-close" id="bm-close">Close <span class="kbd">M</span></button>
      <div class="bm-card glass" id="bm-card" hidden>
        <div class="bm-c-cat" id="bm-c-cat"></div><div class="bm-c-n" id="bm-c-n"></div><div class="bm-c-mr" lang="mr" id="bm-c-mr"></div>
        <div class="bm-c-b" id="bm-c-b"></div>
        <div class="bm-c-act"><button class="btn primary small" id="bm-c-go">Set waypoint</button><button class="btn small" id="bm-c-x">Close</button></div>
      </div>
      <div class="bm-foot"><span class="bm-scale" id="bm-scale"><i></i><b></b></span><span class="bm-hint">Drag to move · scroll to zoom · right-click to drop a pin · <span class="kbd">M</span> close</span></div>`;
    root.appendChild(m);
    this.el = m;
    this.cv = m.querySelector('.bm-canvas');
    this.$ = (id) => m.querySelector('#' + id);
    // filters
    const F = this.$('bm-filters');
    for (const [k, [label, col]] of Object.entries(CATS)) {
      const b = document.createElement('button');
      b.className = 'chip on'; b.dataset.k = k; b.setAttribute('aria-pressed', 'true');
      b.innerHTML = `<i style="background:${col}"></i>${label}`;
      b.onclick = () => { const on = !this.filters.has(k); on ? this.filters.add(k) : this.filters.delete(k); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); };
      F.appendChild(b);
    }
    this.$('bm-close').onclick = () => this.g.toggleMap(false);
    this.$('bm-in').onclick = () => this.zoomAt(1.6);
    this.$('bm-out').onclick = () => this.zoomAt(1 / 1.6);
    this.$('bm-me').onclick = () => this.centerOnMe();
    this.$('bm-c-x').onclick = () => this.select(null);
    this.$('bm-c-go').onclick = () => {
      const s = this.sel; if (!s) return;
      if (this.g.waypoint && this.g.waypoint.x === s.x && this.g.waypoint.z === s.z) this.g.setWaypoint(null);
      else this.g.setWaypoint({ x: s.x, z: s.z, name: s.n });
      this.renderCard();
    };
    this.bindPointer();
    this.bindSearch();
  }
  get hidden() { return this.el.hidden; }
  open() {
    this.el.hidden = false;
    const p = this.g.player;
    if (!this.opened) { this.view = { x: p.x, z: p.z, ppm: 0.9 }; this.opened = true; }
    else { this.view.x = p.x; this.view.z = p.z; }
    this.target = null; this.vel = { x: 0, z: 0 };
  }
  close() { this.el.hidden = true; this.$('bm-q').blur(); this.$('bm-res').hidden = true; }
  centerOnMe() { const p = this.g.player; this.flyTo(p.x, p.z, Math.max(this.view.ppm, 1.2)); }
  flyTo(x, z, ppm) { this.target = { x, z, ppm: ppm || this.view.ppm }; this.vel = { x: 0, z: 0 }; }
  clampView() {
    const c = this.city, v = this.view;
    v.ppm = Math.max(0.12, Math.min(8, v.ppm));
    v.x = Math.max(c.x0, Math.min(c.x1, v.x)); v.z = Math.max(c.z0, Math.min(c.z1, v.z));
  }
  toWorld(sx, sy) { const w = this.cv.clientWidth, h = this.cv.clientHeight, v = this.view; return [v.x + (sx - w / 2) / v.ppm, v.z + (sy - h / 2) / v.ppm]; }
  toScreen(x, z) { const w = this.cv.clientWidth, h = this.cv.clientHeight, v = this.view; return [w / 2 + (x - v.x) * v.ppm, h / 2 + (z - v.z) * v.ppm]; }
  zoomAt(f, sx, sy) {
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (sx === undefined) { sx = w / 2; sy = h / 2; }
    const [wx, wz] = this.toWorld(sx, sy);
    this.view.ppm *= f; this.clampView();
    // keep the point under the cursor fixed
    this.view.x = wx - (sx - w / 2) / this.view.ppm; this.view.z = wz - (sy - h / 2) / this.view.ppm;
    this.clampView(); this.target = null;
  }
  bindPointer() {
    const cv = this.cv, pts = new Map();
    let drag = null, moved = 0, pinch = null, lastT = 0;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]);
      this.target = null; this.vel = { x: 0, z: 0 };
      if (pts.size === 1) { drag = { x: e.offsetX, y: e.offsetY }; moved = 0; lastT = performance.now(); }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), ppm: this.view.ppm }; drag = null; }
      if (e.pointerType === 'touch') { clearTimeout(this.lp); this.lp = setTimeout(() => { if (moved < 6 && pts.size === 1) this.dropPin(e.offsetX, e.offsetY); }, 550); }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.offsetX, e.offsetY]);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const f = pinch.ppm * d / pinch.d / this.view.ppm; this.zoomAt(f, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return;
      }
      if (!drag) return;
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
      const now = performance.now(), dt = Math.max(1, now - lastT); lastT = now;
      this.view.x -= dx / this.view.ppm; this.view.z -= dy / this.view.ppm; this.clampView();
      this.vel = { x: -dx / this.view.ppm / dt * 16, z: -dy / this.view.ppm / dt * 16 };
      drag = { x: e.offsetX, y: e.offsetY };
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId); clearTimeout(this.lp);
      if (pts.size < 2) pinch = null;
      if (drag && moved < 6 && e.button !== 2) { this.vel = { x: 0, z: 0 }; this.pick(e.offsetX, e.offsetY); }
      if (performance.now() - lastT > 80) this.vel = { x: 0, z: 0 };
      drag = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), e.offsetX, e.offsetY); }, { passive: false });
    cv.addEventListener('dblclick', (e) => this.zoomAt(2, e.offsetX, e.offsetY));
    cv.addEventListener('contextmenu', (e) => { e.preventDefault(); this.dropPin(e.offsetX, e.offsetY); });
    window.addEventListener('keydown', (e) => {
      if (this.el.hidden) return;
      const typing = document.activeElement === this.$('bm-q');
      if (typing) {
        if (e.code === 'Escape') { this.$('bm-q').value = ''; this.$('bm-res').hidden = true; this.$('bm-q').blur(); }
        return;
      }
      if (e.key === '/') { e.preventDefault(); this.$('bm-q').focus(); }
      else if (e.key === '+' || e.key === '=') this.zoomAt(1.5);
      else if (e.key === '-' || e.key === '_') this.zoomAt(1 / 1.5);
      else if (e.code === 'Space') { e.preventDefault(); this.centerOnMe(); }
      else if (e.code === 'Escape' && this.sel) this.select(null);
    });
  }
  pickAt(sx, sy, r = 14) {
    const [wx, wz] = this.toWorld(sx, sy);
    let best = null, bd = r;
    for (const p of this.visiblePlaces || []) {
      const [X, Y] = this.toScreen(p.x, p.z); const d = Math.hypot(X - sx, Y - sy);
      if (d < bd) { bd = d; best = p; }
    }
    void wx; void wz;
    return best;
  }
  pick(sx, sy) {
    const p = this.pickAt(sx, sy);
    if (p) { this.select(p); return; }
    this.select(null);
  }
  dropPin(sx, sy) {
    const [x, z] = this.toWorld(sx, sy);
    const G = this.g.W.graph, near = G.nearest(x, z, 120);
    let label = 'Dropped pin';
    if (near) { const nm = G.names[near.e.name]; if (nm && nm[0]) label = nm[0]; }
    this.select({ n: label, mr: '', c: 'pin', x, z });
  }
  select(p) { this.sel = p; this.renderCard(); }
  renderCard() {
    const card = this.$('bm-card'), p = this.sel;
    card.hidden = !p;
    if (!p) return;
    const pl = this.g.player, d = Math.hypot(p.x - pl.x, p.z - pl.z);
    const cat = p.c === 'pin' ? 'Pin' : p.c === 'street' ? 'Street' : p.c === 'area' ? 'Area' : (CATS[p.c] ? CATS[p.c][0].replace(/s$/, '').replace(/ & drink/, '') : p.c);
    const sub = p.sub && p.sub !== 'generic' ? ' · ' + p.sub.replace('icecream', 'ice cream') : '';
    this.$('bm-c-cat').textContent = `${cat}${sub} · ${fmtDist(d)} away`;
    this.$('bm-c-n').textContent = p.n;
    this.$('bm-c-mr').textContent = p.mr || '';
    this.$('bm-c-b').textContent = p.blurb || '';
    this.$('bm-c-b').hidden = !p.blurb;
    const wp = this.g.waypoint;
    this.$('bm-c-go').textContent = wp && wp.x === p.x && wp.z === p.z ? 'Remove waypoint' : 'Set waypoint';
  }
  bindSearch() {
    const q = this.$('bm-q'), res = this.$('bm-res');
    const city = this.city;
    const pool = () => [
      ...city.places.filter(p => p.c === 'landmark').map(p => [p, 3]),
      ...city.areas.map(a => [{ ...a, c: 'area' }, 2.5]),
      ...city.streets.map(s => [s, 2]),
      ...city.places.filter(p => p.c !== 'landmark').map(p => [p, 1]),
    ];
    let items = [], cur = 0;
    const run = () => {
      const t = norm(q.value);
      if (!t) { res.hidden = true; items = []; return; }
      const pl = this.g.player, out = [];
      for (const [p, w] of pool()) {
        const n = norm(p.n) + ' ' + (p.mr || '');
        const i = n.indexOf(t);
        if (i < 0) continue;
        const wordStart = i === 0 || n[i - 1] === ' ';
        const d = Math.hypot(p.x - pl.x, p.z - pl.z);
        out.push([p, w * 10 + (i === 0 ? 6 : wordStart ? 3 : 0) - d / 1500]);
      }
      out.sort((a, b) => b[1] - a[1]);
      const seen = new Set();
      items = [];
      for (const [p] of out) { const k = p.n + '|' + p.c; if (seen.has(k)) continue; seen.add(k); items.push(p); if (items.length >= 8) break; }
      cur = 0;
      res.innerHTML = '';
      if (!items.length) { res.innerHTML = '<div class="bm-r-none">No matches in this part of Pune</div>'; res.hidden = false; return; }
      items.forEach((p, i) => {
        const r = document.createElement('button');
        r.className = 'bm-r' + (i === 0 ? ' cur' : ''); r.setAttribute('role', 'option');
        const col = CATS[p.c] ? CATS[p.c][1] : p.c === 'street' ? '#9aa0aa' : '#f4f1ea';
        const kind = p.c === 'street' ? 'Street' : p.c === 'area' ? 'Area' : CATS[p.c] ? CATS[p.c][0] : '';
        r.innerHTML = `<i style="background:${col}"></i><span class="n"></span><span class="k"></span><span class="d"></span>`;
        r.querySelector('.n').textContent = p.n; r.querySelector('.k').textContent = kind;
        r.querySelector('.d').textContent = fmtDist(Math.hypot(p.x - this.g.player.x, p.z - this.g.player.z));
        r.onmousedown = (e) => { e.preventDefault(); choose(p); };
        res.appendChild(r);
      });
      res.hidden = false;
    };
    const choose = (p) => {
      if (!p) return;
      if (CATS[p.c]) this.filters.add(p.c);
      this.flyTo(p.x, p.z, Math.max(this.view.ppm, p.c === 'area' ? 0.9 : p.c === 'street' ? 1.6 : 2.4));
      this.select(p); res.hidden = true; q.blur();
    };
    q.addEventListener('input', run);
    q.addEventListener('focus', run);
    q.addEventListener('blur', () => setTimeout(() => { res.hidden = true; }, 120));
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!items.length) return;
        cur = (cur + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
        [...res.children].forEach((c, i) => c.classList.toggle('cur', i === cur));
      } else if (e.key === 'Enter') { e.preventDefault(); choose(items[cur]); }
      e.stopPropagation();
    });
  }
  // ---------------------------------------------------------------- frame
  draw(dt) {
    const cv = this.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const v = this.view;
    if (this.target) {
      const k = 1 - Math.exp(-dt * 7), T = this.target;
      v.x += (T.x - v.x) * k; v.z += (T.z - v.z) * k; v.ppm *= Math.pow(T.ppm / v.ppm, k);
      if (Math.hypot(T.x - v.x, T.z - v.z) * v.ppm < 0.5 && Math.abs(Math.log(T.ppm / v.ppm)) < 0.01) this.target = null;
    } else if (Math.abs(this.vel.x) + Math.abs(this.vel.z) > 1e-3) {
      v.x += this.vel.x * dt * 60; v.z += this.vel.z * dt * 60;
      const f = Math.exp(-dt * 5); this.vel.x *= f; this.vel.z *= f;
    }
    this.clampView();
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = COL.bg; x.fillRect(0, 0, w, h);
    x.save(); x.translate(w / 2, h / 2);
    this.city.drawTiles(x, v.x, v.z, v.ppm * dpr / dpr, 0, Math.hypot(w, h) / 2);
    x.restore();
    this.city.pump(this.g.state === 'map' ? 7 : 3);
    const g = this.g, T = (X, Z) => this.toScreen(X, Z);
    // routes: ride (yellow), waypoint (blue)
    const line = (pts, col, wpx) => {
      if (!pts || pts.length < 4) return;
      x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = wpx + 3; x.lineJoin = 'round'; x.lineCap = 'round';
      const path = () => { x.beginPath(); for (let k = 0; k < pts.length; k += 2) { const [X, Y] = T(pts[k], pts[k + 1]); k ? x.lineTo(X, Y) : x.moveTo(X, Y); } };
      path(); x.stroke(); x.strokeStyle = col; x.lineWidth = wpx; path(); x.stroke();
    };
    line(g.nav && g.nav.pts, '#5fd0ff', 4);
    line(g.rides && g.rides.routePts, '#f2b705', 4);
    // labels with simple collision boxes
    const boxes = [];
    const free = (bx, by, bw, bh) => { for (const b of boxes) if (bx < b[0] + b[2] && bx + bw > b[0] && by < b[1] + b[3] && by + bh > b[1]) return false; boxes.push([bx, by, bw, bh]); return true; };
    const pad = 40;
    const [xa, za] = this.toWorld(-pad, -pad), [xb, zb] = this.toWorld(w + pad, h + pad);
    // street names along their longest edge
    if (v.ppm >= 0.55) {
      x.font = '600 11px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const minRank = v.ppm >= 2.2 ? 1 : v.ppm >= 1.1 ? 3 : 4;
      for (const s of this.city.streets) {
        if (s.rank < minRank || s.x < xa || s.x > xb || s.z < za || s.z > zb) continue;
        const [X, Y] = T(s.x, s.z); const tw = x.measureText(s.n).width;
        if (!free(X - tw / 2 - 3, Y - 7, tw + 6, 14)) continue;
        x.strokeStyle = 'rgba(16,18,22,.85)'; x.lineWidth = 3.5; x.strokeText(s.n, X, Y);
        x.fillStyle = s.rank >= 4 ? '#d9d5cc' : '#a7a49c'; x.fillText(s.n, X, Y);
      }
    }
    // areas at low zoom
    if (v.ppm < 1.4) {
      x.font = '700 12px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (const a of this.city.areas) {
        const [X, Y] = T(a.x, a.z); const t = a.n.toUpperCase(); const tw = x.measureText(t).width * 1.12;
        if (!free(X - tw / 2, Y - 8, tw, 16)) continue;
        x.save(); x.letterSpacing = '1.5px'; x.strokeStyle = 'rgba(16,18,22,.9)'; x.lineWidth = 4; x.strokeText(t, X, Y);
        x.fillStyle = 'rgba(244,241,234,.78)'; x.fillText(t, X, Y); x.restore();
      }
    }
    // places: landmarks always, others by zoom
    const vis = [];
    const near = this.city.placesIn(xa, za, xb, zb);
    near.sort((a, b) => (b.c === 'landmark') - (a.c === 'landmark'));
    for (const p of near) {
      if (!this.filters.has(p.c)) continue;
      const big = p.c === 'landmark';
      const minPpm = big ? 0 : (p.c === 'police' || p.c === 'hospital' || p.c === 'transit' || p.c === 'fuel') ? 0.5 : (p.c === 'park' || p.c === 'temple' || p.c === 'college' || p.c === 'cinema') ? 0.9 : 1.8;
      if (v.ppm < minPpm) continue;
      const [X, Y] = T(p.x, p.z);
      const s = big ? 10 : v.ppm >= 3 ? 7 : 5.5;
      if (!free(X - s, Y - s, s * 2, s * 2) && !big) continue;
      const [, col, gl] = CATS[p.c];
      drawPin(x, X, Y, col, s >= 7 ? gl : null, s);
      vis.push(p);
      const showName = big ? v.ppm >= 0.35 : v.ppm >= (p.c === 'food' || p.c === 'shop' || p.c === 'bank' ? 3.2 : 1.2);
      if (showName) {
        x.font = big ? '700 12px Inter, system-ui, sans-serif' : '600 11px Inter, system-ui, sans-serif';
        x.textAlign = 'left'; x.textBaseline = 'middle';
        const tw = x.measureText(p.n).width;
        if (free(X + s + 3, Y - 7, tw + 4, 14)) {
          x.strokeStyle = 'rgba(16,18,22,.9)'; x.lineWidth = 3.5; x.strokeText(p.n, X + s + 4, Y);
          x.fillStyle = big ? '#f7e3a1' : '#e9e6de'; x.fillText(p.n, X + s + 4, Y);
        }
      }
    }
    this.visiblePlaces = vis;
    // ride and police markers
    for (const m of [...(g.rides ? g.rides.markers() : []), ...(g.police ? g.police.markers() : [])]) {
      const [X, Y] = T(m.x, m.z);
      drawPin(x, X, Y, m.kind === 'pax' ? '#33d17a' : m.kind === 'cop' ? '#5aa2ff' : m.kind === 'marshal' ? '#ff4b3e' : '#f2b705', null, 6);
    }
    // waypoint + selection
    if (g.waypoint) { const [X, Y] = T(g.waypoint.x, g.waypoint.z); drawFlag(x, X, Y); }
    if (this.sel) {
      const [X, Y] = T(this.sel.x, this.sel.z);
      x.strokeStyle = '#f4f1ea'; x.lineWidth = 2; x.beginPath(); x.arc(X, Y, 15 + Math.sin(performance.now() / 220) * 1.5, 0, Math.PI * 2); x.stroke();
    }
    // player
    const p = g.player, [PX, PY] = T(p.x, p.z);
    x.fillStyle = 'rgba(95,208,255,.18)'; x.beginPath(); x.arc(PX, PY, 22, 0, Math.PI * 2); x.fill();
    drawArrow(x, PX, PY, p.th + Math.PI / 2);
    // scale bar
    const steps = [10, 20, 50, 100, 200, 500, 1000, 2000];
    let m = steps[0]; for (const s of steps) if (s * v.ppm <= 120) m = s;
    const sc = this.$('bm-scale'); sc.querySelector('i').style.width = Math.round(m * v.ppm) + 'px'; sc.querySelector('b').textContent = m >= 1000 ? m / 1000 + ' km' : m + ' m';
  }
}

export function drawFlag(x, X, Y) {
  x.save(); x.translate(X, Y);
  x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#0a0b0d'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -24); x.stroke();
  x.strokeStyle = '#f4f1ea'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -24); x.stroke();
  x.fillStyle = '#5fd0ff'; x.strokeStyle = '#0a0b0d'; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(1, -24); x.lineTo(15, -19); x.lineTo(1, -14); x.closePath(); x.fill(); x.stroke();
  x.restore();
}
