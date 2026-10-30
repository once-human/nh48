// City map: tiles drawn on demand from the same map data the world is built from, a places index
// for search, and the full-screen map screen (drag, zoom, search, filters, waypoint + GPS).
// The minimap draws through the same tile cache, so both always agree with the streets you drive.
import { versioned } from '../core/assets.js';
import { cmRing } from '../world/geo.js';
import TRANSIT from '../game/transit.json';
import { lineOpen, opensOn } from '../game/metroOpen.js';

const TILE = 256;
const BASE_PPM = 0.25;            // pixels per metre at level 0
const MAX_LEVEL = 5;              // 8 px/m
const COL = {
  bg: '#101216', land: '#14171b', grass: '#16241b', soil: '#1b1a17', scrub: '#15211a', plaza: '#1a1c20', median: '#1a2219', pavers: '#1b1d22',
  water: '#0d2433', building: '#23272e', landmark: '#3a3220', road: '#3b3f47', main: '#5a5f69', arterial: '#6e7480', rail: '#2d3037', bridge: '#5d626c',
};
// map categories: label, colour, glyph
export const CATS = {
  landmark: ['Landmarks', '#f2b705', 'star'], police: ['Police', '#5aa2ff', 'shield'], hospital: ['Health', '#ff5a4f', 'cross'],
  food: ['Food & drink', '#ffb020', 'food'], shop: ['Shops', '#7fd1ff', 'bag'], bank: ['Banks', '#4dd0c8', 'bank'], fuel: ['Fuel', '#a08cff', 'fuel'],
  transit: ['Transit', '#33d17a', 'bus'], park: ['Parks', '#5bbf6a', 'tree'], temple: ['Temples', '#ff9f43', 'temple'], college: ['Colleges', '#c08cff', 'cap'],
  cinema: ['Theatres', '#ff6ec7', 'film'], service: ['Offices & services', '#9aa0aa', 'building'],
};
// one filled icon set (24 x 24) for every pin on the map and minimap
const ICON_PATHS = {
  star: 'M12 2.6l2.8 5.9 6.5.8-4.8 4.5 1.2 6.4L12 17.1l-5.7 3.1 1.2-6.4-4.8-4.5 6.5-.8z',
  shield: 'M12 2 4 5.2v6.3c0 4.8 3.3 9 8 10.5 4.7-1.5 8-5.7 8-10.5V5.2z',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  food: 'M7 2v8a2.5 2.5 0 0 0 2 2.4V22h2.5v-9.6A2.5 2.5 0 0 0 13.5 10V2h-1.7v7h-1.2V2H9.4v7H8.2V2zm9.5 0c-2 0-3 3-3 6.8 0 1.9 1 3 2.2 3.4V22h2.6V2z',
  bag: 'M5 8h14l-1.1 13.2a1 1 0 0 1-1 .8H7.1a1 1 0 0 1-1-.8zM8.5 8V6.5a3.5 3.5 0 0 1 7 0V8h-2.2V6.5a1.3 1.3 0 0 0-2.6 0V8z',
  bank: 'M12 2 2 7.2V9.5h20V7.2zM4 11h3v7H4zm6.5 0h3v7h-3zM17 11h3v7h-3zM2 19.5h20V22H2z',
  fuel: 'M4 3h10v18H4zm2.2 2.2v5h5.6v-5zM15 7.2l1.5-1.4 3.5 3.5v8.9a2 2 0 0 1-4 0V14h-1v-2.4h3.4v6.6h.2V10.2z',
  bus: 'M6 2h12a3 3 0 0 1 3 3v12.5h-1.2V21h-3.3v-3.5h-9V21H4.2v-3.5H3V5a3 3 0 0 1 3-3zm-.3 3.5v6h12.6v-6zM7 13.4a1.6 1.6 0 1 0 .01 0zm10 0a1.6 1.6 0 1 0 .01 0z',
  tree: 'M12 1.8 4.5 12.5h4L4 19h7v3.2h2V19h7l-4.5-6.5h4z',
  temple: 'M12 1l1.8 3.4H16l-1 3h2.6l-1 3H20V22h-5.6v-5a2.4 2.4 0 0 0-4.8 0v5H4V10.4h3.4l-1-3H9l-1-3h2.2z',
  cap: 'M12 3 .8 9 12 15l9.2-4.9V16h2V9zM5 13.3V17c0 1.8 3.1 3.3 7 3.3s7-1.5 7-3.3v-3.7l-7 3.8z',
  film: 'M3 4h18v16H3zm5.4 3.6v8.8l7.6-4.4z',
  building: 'M3 22V3h12v6h6v13zM6 6v2.4h2.4V6zm4 0v2.4h2.4V6zm-4 4.3v2.4h2.4v-2.4zm4 0v2.4h2.4v-2.4zm7 1.1v2.4h2.2v-2.4zm-11 3v2.4h2.4v-2.4zm4 0v2.4h2.4v-2.4zm7 1.1v2.4h2.2v-2.4z',
  auto: 'M2.5 16.5V10a6 6 0 0 1 6-6h6.8l4.4 5.5H22v7h-2.2a2.8 2.8 0 0 1-5.5 0H8.2a2.8 2.8 0 0 1-5.5 0zM9 6.2v3.6h7.4l-2.9-3.6z',
  home: 'M12 2.6 1.8 11.2h3V21.5h5.4v-6.2h3.6v6.2h5.4V11.2h3z',
  rupee: 'M6 3h12v2.2h-4.1c.6.6 1 1.3 1.2 2H18v2.2h-2.9a5.2 5.2 0 0 1-4.6 4.4L16.3 21h-3l-5.6-7.6v-1.8h2.2a3 3 0 0 0 2.8-2.2H6V7.2h6.6A3 3 0 0 0 9.9 5.2H6z',
};
const ICON2D = {};
const iconPath = (n) => ICON2D[n] || (ICON_PATHS[n] ? (ICON2D[n] = new Path2D(ICON_PATHS[n])) : null);
const FOOD = new Set(['food', 'cafe', 'bar', 'icecream', 'sweets', 'bakery']);
const SHOPC = { bank: 'bank', atm: 'bank', police: 'police', clinic: 'hospital' };

// a line for any place on the map: what kind of place it is, from its name and kind, and what it's good for in the game
const BLURB = [
  [/pharma|chemist|medical(?! college)/i, 'A chemist. Painkillers, ORS and a first-aid kit, when you’ve taken a knock.'],
  [/hospital|nursing home/i, 'A hospital. If you’re knocked out nearby, this is where you wake up.'],
  [/clinic|dental|dr\.?\s|diagnostic|path(o)?lab/i, 'A clinic. Small things patched up, no queue at the counter if you’re lucky.'],
  [/petrol|fuel|pump|hp |bharat petroleum|indian oil|iocl|bpcl|hpcl/i, 'Petrol and diesel. Fill up before the needle hits red.'],
  [/cng/i, 'CNG. Autos queue here; so will you.'],
  [/metro/i, 'A Pune Metro station. Quick across the city, no traffic.'],
  [/railway|station|junction/i, 'Trains in and out of Pune.'],
  [/bus|pmpml|stand|depot/i, 'PMPML buses stop here.'],
  [/mandir|temple|ganpati|ganesh|maruti|hanuman|devi|mata|vitthal|datta|shiv|ram mandir/i, 'A temple. Bells, flowers outside, and quiet inside.'],
  [/masjid|mosque|dargah/i, 'A mosque.'], [/church|chapel/i, 'A church.'], [/gurudwara/i, 'A gurudwara.'],
  [/misal/i, 'Misal pav, as spicy as you ask for.'], [/vada ?pav|wada ?pav/i, 'Vada pav, hot from the kadhai.'],
  [/amrutt?ulya|chai|tea/i, 'Cutting chai. The cheapest pick-me-up in Pune.'], [/cafe|coffee/i, 'A café. Coffee and somewhere to sit.'],
  [/bakery|bakers/i, 'A bakery. Shrewsbury biscuits and fresh pav.'], [/sweet|mithai|chitale/i, 'Sweets. Barfi and bakarwadi to take home or give away.'],
  [/bar|pub|brew|wine/i, 'A bar. Don’t drive after.'], [/hotel|restaurant|dhaba|mess|biryani|kitchen|thali/i, 'Somewhere to eat. They’ll pack a parcel for later too.'],
  [/atm/i, 'An ATM.'], [/bank/i, 'A bank. Put cash away where nobody can take it off you.'],
  [/kirana|general stores|provision|mart|super ?market|d-?mart|grocer/i, 'Groceries. Water, Parle-G, bananas for the cows.'],
  [/jewel|gold|sarafa/i, 'A jeweller. Gold by the gram, bought and sold at the day’s rate.'],
  [/cloth|garment|fashion|saree|wear|tailor/i, 'Clothes. Anyone can wear anything; the street will have opinions.'],
  [/mobile|electronics|phone/i, 'Phones and electronics.'], [/garage|auto works|motors|service centre|tyre|puncture/i, 'A garage. Dents out, engine sorted.'],
  [/gym|fitness/i, 'A gym. Get fitter, hit harder.'], [/school|vidyalaya|shala/i, 'A school.'], [/college|university|institute|academy/i, 'A college. Students everywhere around exam time.'],
  [/police|chowki/i, 'Police. Pay your e-challans here, or stay well away.'],
  [/garden|udyan|park|baug/i, 'A garden. Benches, morning walkers, the odd couple.'], [/theatre|cinema|multiplex|pvr|inox|natya/i, 'A theatre.'],
];
const KIND_BLURB = { food: 'Somewhere to eat.', shop: 'A shop.', bank: 'A bank.', fuel: 'Petrol and diesel.', transit: 'Getting about the city starts here.', hospital: 'Medical help.', temple: 'A place of worship.',
  park: 'A green space in the city.', college: 'A school or college.', cinema: 'A theatre.', police: 'Police.', service: 'An office or service.', landmark: 'One of Pune’s landmarks.' };
export function blurbFor(p) { if (p.blurb) return p.blurb; const n = p.n || ''; for (const [re, t] of BLURB) if (re.test(n)) return t; return KIND_BLURB[p.c] || ''; }

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
    // every real place at its source position (tools/bake_shops.py); boards in the street carry the same names
    for (const q of M.pins || []) {
      const c = q[2];
      if (c === 'police') continue;                      // police come from `places`
      P.push({ n: q[0], mr: q[1], c: FOOD.has(c) ? 'food' : (SHOPC[c] || (c === 'service' ? 'service' : 'shop')), sub: c, x: q[3] / 100, z: q[4] / 100 });
    }
    this.places = P;
    // grid of places for hit tests and culling
    this.pgrid = new Map(); this.pcell = 120;
    for (const p of P) { const k = this.key(p.x, p.z); if (!this.pgrid.has(k)) this.pgrid.set(k, []); this.pgrid.get(k).push(p); }
    // areas (suburbs) and districts for labels at low zoom
    this.areas = (M.areas || (M.pois || []).filter(p => p[4] === 'suburb').map(p => [p[0], p[1], p[2], p[3], 2]))
      .map(a => ({ n: a[0], mr: a[1], x: a[2] / 100, z: a[3] / 100, tier: a[4] }))
      .sort((a, b) => a.tier - b.tier);
    // streets for search and labels: one entry per name, at its longest edge
    const G = W.graph, best = new Map();
    for (const e of G.edges) {
      const nm = G.names[e.name]; if (!nm || !nm[0]) continue;
      const o = best.get(nm[0]); if (!o || e.len > o.e.len) best.set(nm[0], { e, nm });
    }
    this.streets = [...best.values()].map(({ e, nm }) => {
      const t = G.at(e, e.len / 2);
      let a = Math.atan2(t[3], t[2]); if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
      return { n: nm[0], mr: nm[1], c: 'street', x: t[0], z: t[1], rank: e.rank, a, len: e.len };
    }).sort((a, b) => b.rank - a.rank || b.len - a.len);
    // all of Pune (streamed): the city's outline, its rivers and its main roads are always drawn, whether or not
    // the detailed tile there is loaded; the detail goes on top where it is
    if (M.coarse) this.setCoarse(M.coarse, M.cwater);
    // all of Pune: the zoomed-out map is pictures baked offline (tools/bake_maptiles.py), never drawn at runtime;
    // closer in, the live drawing goes over them only where the city has streamed in
    this.raster = M.meta.tiles ? { levels: [[0.125, 4000], [0.25, 2000], [0.5, 1000], [1, 1000]], img: new Map(), ov: new Image() } : null;
    // the whole city in one small picture, there from the first frame; sharper pieces load over it as you look
    if (this.raster) { const o = this.raster.ov; o.decoding = 'async'; o.onload = () => { o.ok = true; }; o.src = versioned('assets/pune/map/overview.webp'); }
    this.chunks = I.chunks;
    this.res = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));   // tile pixels per CSS pixel
    this.cap = 160;
    this.prepped = new Map();
  }
  // level-0 tiles for the whole city, drawn once while loading so the map never opens empty
  warm(z = 0) {
    if (this.raster) return;                 // the baked pictures are the overview
    const S = this.tileSize(z), nx = Math.ceil((this.x1 - this.x0) / S), ny = Math.ceil((this.z1 - this.z0) / S);
    for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) { const k = z + '/' + tx + '/' + ty; if (!this.cache.has(k)) this.cache.set(k, { c: this.renderTile(z, tx, ty), u: 1e12 }); }
  }
  // a tile streamed in: its shops and places join the map (and stay, once you've been near them)
  addPins(pins) {
    const seen = this.pinSeen || (this.pinSeen = new Set());
    for (const q of pins) {
      const c = q[2], id = q[0] + '@' + q[3] + ',' + q[4];
      if (seen.has(id)) continue;
      seen.add(id);
      const p = { n: q[0], mr: q[1], c: CATS[c] ? c : FOOD.has(c) ? 'food' : (SHOPC[c] || 'shop'), sub: c, x: q[3] / 100, z: q[4] / 100 };
      this.places.push(p);
      const k = this.key(p.x, p.z); if (!this.pgrid.has(k)) this.pgrid.set(k, []); this.pgrid.get(k).push(p);
    }
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
    if (t) { if (t.u < 1e12) t.u = this.useT; return t.c; }
    if (request && !this.queued.has(k)) { this.queued.add(k); this.queue.push([z, tx, ty, k]); }
    return null;
  }
  // render queued tiles within a time budget (ms), newest request first
  pump(budget = 4) {
    const t0 = performance.now();
    this.useT++;
    while (this.queue.length && performance.now() - t0 < budget) {
      const [z, tx, ty, k] = this.queue.pop();
      this.queued.delete(k);
      if (this.cache.has(k)) continue;
      this.cache.set(k, { c: this.renderTile(z, tx, ty), u: this.useT });
    }
    if (this.queue.length > 160) { for (const q of this.queue.splice(0, this.queue.length - 160)) this.queued.delete(q[3]); }
    if (this.cache.size > this.cap) {      // evict least recently used, never what is on screen
      const arr = [...this.cache.entries()].filter(e => e[1].u < this.useT - 1).sort((a, b) => a[1].u - b[1].u);
      for (let i = 0; i < arr.length && this.cache.size > this.cap * 0.85; i++) this.cache.delete(arr[i][0]);
    }
  }
  // per-chunk shapes with bounding boxes, built the first time a tile needs the chunk
  prep(ci) {
    let P = this.prepped.get(ci);
    if (P) return P;
    const C = this.chunks[ci], M = this.W.M;
    const bb = (r) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (let k = 0; k < r.length; k += 2) { const x = r[k], z = r[k + 1]; if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z; } return [a, b, c, d]; };
    P = { ground: [], road: [], water: [], bld: [], rails: [] };
    for (const g of C.ground) {
      const road = g.kind === 'asphalt' || g.kind === 'concrete' || g.kind === 'bridge_road';
      if (!road && !COL[g.kind]) continue;
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      for (const r of g.rings) { const q = bb(r); box[0] = Math.min(box[0], q[0]); box[1] = Math.min(box[1], q[1]); box[2] = Math.max(box[2], q[2]); box[3] = Math.max(box[3], q[3]); }
      (road ? P.road : P.ground).push({ kind: g.kind, rings: g.rings, bb: box });
    }
    for (const rs of C.water) for (const r of rs) P.water.push({ r, bb: bb(r) });
    for (const r of C.rails) P.rails.push({ r, bb: bb(r) });
    for (const bi of C.bld) {
      const b = M.buildings[bi], r = cmRing(b[1]);
      P.bld.push({ r, bb: bb(r), lm: b[3] === 8 || b[3] === 11 || b[3] === 5 || b[3] === 12 });
    }
    this.prepped.set(ci, P);
    return P;
  }
  renderTile(z, tx, ty) {
    const W = this.W, S = this.tileSize(z), ppm = TILE / S, res = this.res, px = TILE * res;
    const wx0 = this.x0 + tx * S, wz0 = this.z0 + ty * S, wx1 = wx0 + S, wz1 = wz0 + S;
    const c = document.createElement('canvas'); c.width = px; c.height = px;
    const x = c.getContext('2d');
    if (!this.raster) { x.fillStyle = COL.land; x.fillRect(0, 0, px, px); }
    const k = ppm * res;
    x.setTransform(k, 0, 0, k, -wx0 * k, -wz0 * k);
    const I = W.index, cs = I.size, m = 2 / k;
    const hit = (b) => b[0] < wx1 + m && b[2] > wx0 - m && b[1] < wz1 + m && b[3] > wz0 - m;
    const i0 = Math.max(0, Math.floor((wx0 - this.x0) / cs) - 1), i1 = Math.min(I.ncx - 1, Math.floor((wx1 - this.x0) / cs) + 1);
    const j0 = Math.max(0, Math.floor((wz0 - this.z0) / cs) - 1), j1 = Math.min(I.ncz - 1, Math.floor((wz1 - this.z0) / cs) + 1);
    const Ps = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) Ps.push(this.prep(i + j * I.ncx));
    const ring = (r) => { x.moveTo(r[0], r[1]); for (let q = 2; q < r.length; q += 2) x.lineTo(r[q], r[q + 1]); x.closePath(); };
    // ground: parks, plazas, medians
    for (const kind of ['grass', 'scrub', 'soil', 'median', 'plaza', 'pavers']) {
      x.beginPath(); let any = false;
      for (const P of Ps) for (const g of P.ground) if (g.kind === kind && hit(g.bb)) { for (const r of g.rings) ring(r); any = true; }
      if (any) { x.fillStyle = COL[kind]; x.fill('evenodd'); }
    }
    x.beginPath(); let any = false;
    for (const P of Ps) for (const w of P.water) if (hit(w.bb)) { ring(w.r); any = true; }
    if (any) { x.fillStyle = COL.water; x.fill('evenodd'); }
    // roads: real asphalt shapes close up, graph lines with a minimum width further out
    if (z >= 3) {
      x.beginPath(); any = false;
      for (const P of Ps) for (const g of P.road) if (hit(g.bb)) { for (const r of g.rings) ring(r); any = true; }
      if (any) { x.fillStyle = COL.road; x.fill('evenodd'); }
    }
    const edges = [...W.graph.gridQuery(wx0 + S / 2, wz0 + S / 2, S * 0.75)].sort((a, b) => a.rank - b.rank);
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const e of edges) {
      if (z < 2 && e.rank < 3) continue;
      if (z >= 3 && e.rank < 4) continue;
      const minPx = e.rank >= 5 ? 3.4 : e.rank >= 4 ? 2.6 : e.rank >= 3 ? 1.7 : 1.1;
      x.lineWidth = Math.max(e.w * (z >= 3 ? 0.9 : 1), minPx / ppm);
      x.strokeStyle = e.bridge ? COL.bridge : e.rank >= 5 ? COL.arterial : e.rank >= 4 ? COL.main : COL.road;
      const p = e.pts; x.beginPath(); x.moveTo(p[0], p[1]); for (let q = 2; q < p.length; q += 2) x.lineTo(p[q], p[q + 1]); x.stroke();
    }
    // flyovers on top of the streets they cross
    if (W.fly) for (const dk of W.fly.decks) {
      const p = dk.pts;
      x.lineWidth = Math.max(dk.w, 3.4 / ppm); x.strokeStyle = 'rgba(0,0,0,.45)';
      x.beginPath(); x.moveTo(p[0], p[1]); for (let q = 2; q < p.length; q += 2) x.lineTo(p[q], p[q + 1]); x.stroke();
      x.lineWidth = Math.max(dk.w * 0.8, 2.6 / ppm); x.strokeStyle = '#8b909a'; x.stroke();
    }
    x.strokeStyle = COL.rail; x.lineWidth = Math.max(1.2, 1.4 / ppm); x.beginPath();
    for (const P of Ps) for (const r of P.rails) if (hit(r.bb)) { const q = r.r; x.moveTo(q[0], q[1]); for (let n = 2; n < q.length; n += 2) x.lineTo(q[n], q[n + 1]); }
    x.stroke();
    // buildings
    x.beginPath(); const lm = [];
    for (const P of Ps) for (const b of P.bld) if (hit(b.bb)) { if (b.lm) lm.push(b); else ring(b.r); }
    x.fillStyle = COL.building; x.fill();
    if (lm.length) { x.beginPath(); for (const b of lm) ring(b.r); x.fillStyle = COL.landmark; x.fill(); }
    if (z >= 4) {
      x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1 / ppm; x.beginPath();
      for (const P of Ps) for (const b of P.bld) if (hit(b.bb)) ring(b.r);
      x.stroke();
    }
    return c;
  }
  // one baked map picture (level L, image tx, tz): loads once, then stays
  rimg(L, tx, tz) {
    const k = L + '/' + tx + '/' + tz, R = this.raster;
    let o = R.img.get(k);
    if (!o) {
      o = { im: new Image(), ok: false };
      o.im.decoding = 'async';
      o.im.onload = () => { o.ok = true; };
      o.im.onerror = () => { o.bad = true; };
      o.im.src = versioned(`assets/pune/map/r${L}/${tx}_${tz}.webp`);
      R.img.set(k, o);
    }
    return o;
  }
  drawRaster(ctx, cx, cz, r, devPpm) {
    const R = this.raster, want = devPpm <= 0.09 ? -1 : devPpm <= 0.18 ? 0 : devPpm <= 0.36 ? 1 : devPpm <= 0.72 ? 2 : 3;
    // the whole-city overview only where the sharper pictures haven't arrived (it sat under them, drawn for nothing)
    let covered = want >= 0;
    if (covered) {
      const m = R.levels[want][1], a0 = Math.floor((cx - r - this.x0) / m), a1 = Math.floor((cx + r - this.x0) / m), b0 = Math.floor((cz - r - this.z0) / m), b1 = Math.floor((cz + r - this.z0) / m);
      for (let b = Math.max(0, b0); b <= b1 && covered; b++) for (let a = Math.max(0, a0); a <= a1 && covered; a++) { const o = this.rimg(want, a, b); if (!o.ok && !o.bad) covered = false; }
    }
    if (!covered && R.ov.ok) ctx.drawImage(R.ov, this.x0, this.z0, R.ov.naturalWidth * 16, R.ov.naturalHeight * 16);   // 0.0625 px/m
    if (want < 0) return;
    for (let L = Math.max(0, want - 1); L <= want; L++) {
      const m = R.levels[L][1];
      const a0 = Math.floor((cx - r - this.x0) / m), a1 = Math.floor((cx + r - this.x0) / m);
      const b0 = Math.floor((cz - r - this.z0) / m), b1 = Math.floor((cz + r - this.z0) / m);
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
        if (a < 0 || b < 0) continue;
        // coarser levels only fill in under a finer picture that hasn't arrived yet
        if (L < want) { let need = false; const f = m / R.levels[want][1]; for (let q = 0; q < f && !need; q++) for (let w = 0; w < f && !need; w++) { const o = this.rimg(want, a * f + q, b * f + w); need = !o.ok && !o.bad; } if (!need) continue; }
        const o = this.rimg(L, a, b);
        if (o.ok) ctx.drawImage(o.im, this.x0 + a * m, this.z0 + b * m, m + 0.5 / devPpm, m + 0.5 / devPpm);
      }
    }
  }
  // the main-road network (streamed Pune: it arrives a few seconds after the start) gives the map its
  // street names everywhere, before you've been there
  setCoarse(coarse, cwater) {
    const M = { ...this.W.M, coarse, cwater };
    {
      const bbf = (r) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (let k = 0; k < r.length; k += 2) { const x = r[k], z = r[k + 1]; if (x < a) a = x; if (x > c) c = x; if (z < b) b = z; if (z > d) d = z; } return [a, b, c, d]; };
      const m = (q) => Float32Array.from(q, v => v / 100);
      const N = M.coarse.nodes;
      const edges = M.coarse.edges.map(e => {
        const pts = e[5] && e[5].length >= 4 ? m(e[5]) : m([N[e[0]][0], N[e[0]][1], N[e[1]][0], N[e[1]][1]]);
        return { pts, rank: e[2], name: e[4], bb: bbf(pts) };
      }).sort((a, b) => a.rank - b.rank);
      const water = (M.cwater || []).map(r => { const q = m(r); return { r: q, bb: bbf(q) }; });
      const ol = (M.meta.outlineXZ || []).flatMap(([x, z]) => [x / 100, z / 100]);
      this.coarse = { edges, water, outline: ol.length ? ol : null };
      // street names from the main roads, for labels and search before you've been there
      const nm = M.names || [], have = new Set(this.streets.map(s => s.n)), longest = new Map();
      for (const e of edges) {
        const n = nm[e.name]; if (!n || !n[0] || have.has(n[0])) continue;
        const L = Math.hypot(e.bb[2] - e.bb[0], e.bb[3] - e.bb[1]), o = longest.get(n[0]);
        if (!o || L > o.L) longest.set(n[0], { e, n, L });
      }
      for (const { e, n, L } of longest.values()) {
        const p = e.pts, k = (p.length >> 2) << 1, a0 = Math.atan2(p[Math.min(p.length - 1, k + 3)] - p[k + 1], p[Math.min(p.length - 2, k + 2)] - p[k]);
        let a = a0; if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
        this.streets.push({ n: n[0], mr: n[1], c: 'street', x: p[k], z: p[k + 1], rank: e.rank, a, len: L });
      }
      this.streets.sort((a, b) => b.rank - a.rank || b.len - a.len);
    }
  }
  // quietly fetch a whole level's pictures (or those within r of x, z), a few at a time, so the map is sharp
  // wherever you look before you look there
  prefetch(L, x, z, r = 1e9) {
    if (!this.raster) return;
    const m = this.raster.levels[L][1], todo = [];
    const a0 = Math.max(0, Math.floor((Math.max(this.x0, x - r) - this.x0) / m)), a1 = Math.floor((Math.min(this.x1, x + r) - this.x0) / m);
    const b0 = Math.max(0, Math.floor((Math.max(this.z0, z - r) - this.z0) / m)), b1 = Math.floor((Math.min(this.z1, z + r) - this.z0) / m);
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) todo.push([Math.hypot(this.x0 + (a + 0.5) * m - x, this.z0 + (b + 0.5) * m - z), a, b]);
    todo.sort((p, q) => p[0] - q[0]);
    let i = 0;
    const next = () => { if (i >= todo.length) return; const [, a, b] = todo[i++]; const o = this.rimg(L, a, b); if (o.ok || o.bad) next(); else { o.im.addEventListener('load', next, { once: true }); o.im.addEventListener('error', next, { once: true }); } };
    for (let k = 0; k < 4; k++) next();
  }
  // has the city streamed in anywhere under this map tile?
  loadedAt(wx0, wz0, S) {
    const I = this.W.index, cs = I.size;
    const i0 = Math.max(0, Math.floor((wx0 - this.x0) / cs)), i1 = Math.min(I.ncx - 1, Math.floor((wx0 + S - this.x0) / cs));
    const j0 = Math.max(0, Math.floor((wz0 - this.z0) / cs)), j1 = Math.min(I.ncz - 1, Math.floor((wz0 + S - this.z0) / cs));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const C = this.chunks[i + j * I.ncx]; if (C && ((C.ground && C.ground.length) || (C.bld && C.bld.length))) return true; }
    return false;
  }
  // a part of the city streamed in or out: only the live map tiles over it are redrawn
  invalidate(rect) {
    for (const k of [...this.cache.keys()]) {
      const [z, tx, ty] = k.split('/').map(Number), S = this.tileSize(z), wx = this.x0 + tx * S, wz = this.z0 + ty * S;
      if (wx < rect[2] + 50 && wx + S > rect[0] - 50 && wz < rect[3] + 50 && wz + S > rect[1] - 50) this.cache.delete(k);
    }
  }
  // draw the map into ctx: view centred at (cx,cz) in metres, ppm screen px per metre, rotation rot (rad),
  // ctx already translated to the view centre in screen px; radius = half-diagonal of the view in px
  // lvlPpm: device pixels per metre (picks the level so tile pixels match screen pixels)
  // hq: smooth resampling for the big map; the minimap is drawn near 1:1 thirty times a second, where 'high' only
  // made the browser rebuild every picture's smaller copies each time (tens of ms on a laptop's graphics)
  drawTiles(ctx, cx, cz, ppm, rot, radius, lvlPpm = ppm, hq = true) {
    const z = this.level(lvlPpm / this.res), S = this.tileSize(z), r = radius / ppm;
    const t0x = Math.floor((cx - r - this.x0) / S), t1x = Math.floor((cx + r - this.x0) / S);
    const t0y = Math.floor((cz - r - this.z0) / S), t1y = Math.floor((cz + r - this.z0) / S);
    const nx = Math.ceil((this.x1 - this.x0) / S), ny = Math.ceil((this.z1 - this.z0) / S);
    ctx.save();
    ctx.rotate(rot); ctx.scale(ppm, ppm); ctx.translate(-cx, -cz);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = hq ? 'high' : 'low';
    if (this.raster) {
      this.drawRaster(ctx, cx, cz, r, lvlPpm / this.res);
      if (z < 2) { ctx.restore(); return; }
    }
    // request nearest tiles last so they render first
    const want = [];
    for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
      if (tx < 0 || ty < 0 || tx >= nx || ty >= ny) continue;
      want.push([Math.hypot(this.x0 + (tx + 0.5) * S - cx, this.z0 + (ty + 0.5) * S - cz), tx, ty]);
    }
    want.sort((a, b) => b[0] - a[0]);
    this.cap = Math.max(this.cap, Math.min(400, want.length * 2 + 60));
    for (const [, tx, ty] of want) {
      const wx = this.x0 + tx * S, wz = this.z0 + ty * S;
      if (this.raster && !this.loadedAt(wx, wz, S)) continue;
      const c = this.tile(z, tx, ty);
      if (c) { ctx.drawImage(c, wx, wz, S + 0.5 / ppm, S + 0.5 / ppm); continue; }
      // fall back to a coarser level while this one renders
      for (let pz = z - 1; pz >= (this.raster ? 2 : 0); pz--) {
        const PS = this.tileSize(pz), px = Math.floor((wx + 1e-3 - this.x0) / PS), py = Math.floor((wz + 1e-3 - this.z0) / PS);
        const pc = this.tile(pz, px, py, pz === 0);
        if (!pc) continue;
        const f = TILE * this.res / PS;
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
  const ip = glyph && iconPath(glyph);
  if (ip) {
    const k = size * 1.25 / 24;
    x.save(); x.translate(X - 12 * k, Y - 12 * k); x.scale(k, k); x.fillStyle = '#0a0b0d'; x.fill(ip, 'evenodd'); x.restore();
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
    // the legend: nothing picked shows everything; pick some and only those show
    this.legend = new Set();
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
      <button class="btn primary small bm-track" id="bm-track" title="Route to your current mission">◆ Track mission</button>
      <button class="btn small bm-close" id="bm-close">Close <span class="kbd" data-k="M">M</span></button>
      <div class="bm-card glass" id="bm-card" hidden>
        <div class="bm-c-pic" id="bm-c-pic"></div>
        <div class="bm-c-cat" id="bm-c-cat"></div><div class="bm-c-n" id="bm-c-n"></div><div class="bm-c-mr" lang="mr" id="bm-c-mr"></div>
        <div class="bm-c-b" id="bm-c-b"></div>
        <div class="bm-c-rep" id="bm-c-rep"></div>
        <div class="bm-c-near" id="bm-c-near"></div>
        <div class="bm-c-act"><button class="btn primary small" id="bm-c-go">Set waypoint</button><button class="btn small" id="bm-c-ft">Take a rickshaw</button><button class="btn small" id="bm-c-x">Close</button></div>
      </div>
      <div class="bm-foot"><span class="bm-scale" id="bm-scale"><i></i><b></b></span><span class="bm-hint"><span><svg class="ms" viewBox="0 0 16 22" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="19" rx="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v7" stroke="currentColor" stroke-width="1.2"/><path d="M8 2.2v6.3H2.2V8a5.8 5.8 0 0 1 5.8-5.8z" fill="currentColor"/></svg>Select</span><span><svg class="ms" viewBox="0 0 16 22" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="19" rx="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v7" stroke="currentColor" stroke-width="1.2"/><path d="M8 2.2v6.3h5.8V8A5.8 5.8 0 0 0 8 2.2z" fill="currentColor"/></svg>Drop pin</span><span><svg class="ms" viewBox="0 0 16 22" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="19" rx="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v7" stroke="currentColor" stroke-width="1.2"/><rect x="6.6" y="4" width="2.8" height="5" rx="1.4" fill="currentColor"/></svg>Zoom</span><span><svg class="ms" viewBox="0 0 16 22" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="19" rx="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v7" stroke="currentColor" stroke-width="1.2"/><path d="M8 2.2v6.3H2.2V8a5.8 5.8 0 0 1 5.8-5.8z" fill="currentColor"/></svg><i class="ms-dr">⇔</i>Pan</span><span><span class="kbd">Space</span>Recenter</span><span><span class="kbd">/</span>Search</span></span><span class="bm-credit">© OpenStreetMap contributors · Overture Maps · SRTM terrain</span></div>`;
    root.appendChild(m);
    this.el = m;
    this.cv = m.querySelector('.bm-canvas');
    this.$ = (id) => m.querySelector('#' + id);
    // filters
    const F = this.$('bm-filters');
    for (const [k, [label, col]] of Object.entries(CATS)) {
      const b = document.createElement('button');
      b.className = 'chip'; b.dataset.k = k; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = `<i style="background:${col}"></i>${label}`;
      b.onclick = () => { const on = !this.legend.has(k); on ? this.legend.add(k) : this.legend.delete(k); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); F.classList.toggle('some', this.legend.size > 0); };
      F.appendChild(b);
    }
    this.$('bm-close').onclick = () => this.g.toggleMap(false);
    this.$('bm-track').onclick = () => { const st = this.g.story, t = st && st.trackNow ? st.trackNow() : null; if (t) { this.view.x = t.x; this.view.z = t.z; this.g.hud.toast('Tracking', t.name, 'meter', 2); } else this.g.hud.toast('No mission right now', 'Your phone will ring when there is one', 'info', 2.4); };
    this.$('bm-in').onclick = () => this.zoomAt(1.6);
    this.$('bm-out').onclick = () => this.zoomAt(1 / 1.6);
    this.$('bm-me').onclick = () => this.centerOnMe();
    this.$('bm-c-x').onclick = () => this.select(null);
    this.$('bm-c-ft').onclick = () => { const s = this.sel; if (s && this.g.fastTravel(s.x, s.z, s.n)) this.select(null); };
    this.$('bm-c-go').onclick = () => {
      const s = this.sel; if (!s) return;
      if (this.g.waypoint && this.g.waypoint.x === s.x && this.g.waypoint.z === s.z) this.g.setWaypoint(null);
      else this.g.setWaypoint({ x: s.x, z: s.z, name: s.n });
      this.renderCard();
    };
    this.bindPointer();
    this.bindSearch();
  }
  shows(k) { return !this.legend.size || this.legend.has(k); }
  get hidden() { return this.el.hidden; }
  open() {
    this.el.hidden = false;
    const p = this.g.player;
    if (!this.opened) { this.view = { x: p.x, z: p.z, ppm: 0.9 }; this.opened = true; }
    else { this.view.x = p.x; this.view.z = p.z; }
    this.target = null; this.vel = { x: 0, z: 0 };
  }
  close() { this.g.liveView && this.g.liveView.stop(); this.el.hidden = true; this.$('bm-q').blur(); this.$('bm-res').hidden = true; }
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
      else if (e.code === 'Escape') { if (this.sel) this.select(null); else { e.stopImmediatePropagation(); this.g.toggleMap(false); } }   // Esc: clear the pick, then close
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
    // nothing there: the neighbourhood you clicked in (right-click drops an exact pin)
    const [x, z] = this.toWorld(sx, sy), subs = (this.g.hud && this.g.hud.suburbs) || [];
    let a = null, bd = 2500 * 2500; for (const q of subs) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; a = q; } }
    this.select(a ? { n: a.n, mr: '', c: 'area', x, z } : null);
  }
  dropPin(sx, sy) {
    const [x, z] = this.toWorld(sx, sy);
    const subs = (this.g.hud && this.g.hud.suburbs) || []; let a = null, bd = 2500 * 2500; for (const q of subs) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; a = q; } }
    this.select({ n: 'Dropped pin', mr: '', c: 'pin', x, z, street: this.streetAt(x, z), area: a ? a.n : '' });
  }
  // the name of the road at (x, z): the streets built round you first, else the city's main roads
  streetAt(x, z) {
    const G = this.g.W.graph, near = G.nearest(x, z, 90);
    if (near) { const nm = G.names[near.e.name]; if (nm && nm[0]) return nm[0]; }
    const C = this.coarse, N = this.W.M.names || []; if (!C) return '';
    let best = null, bd = 160;
    for (const e of C.edges) {
      const b = e.bb; if (x < b[0] - bd || x > b[2] + bd || z < b[1] - bd || z > b[3] + bd) continue;
      const p = e.pts;
      for (let k = 0; k + 3 < p.length; k += 2) {
        const ax = p[k], az = p[k + 1], dx = p[k + 2] - ax, dz = p[k + 3] - az, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        if (d < bd && N[e.name] && N[e.name][0]) { bd = d; best = N[e.name][0]; }
      }
    }
    return best || '';
  }
  select(p) { this.sel = p; this.renderCard(); }
  renderCard() {
    const card = this.$('bm-card'), p = this.sel;
    card.hidden = !p;
    if (!p) { this.g.liveView && this.g.liveView.stop(); return; }
    const pl = this.g.player, d = Math.hypot(p.x - pl.x, p.z - pl.z);
    const cat = p.c === 'pin' ? (p.street || p.area || 'Pin') : p.c === 'street' ? 'Street' : p.c === 'area' ? 'Area' : (CATS[p.c] ? CATS[p.c][0].replace(/s$/, '').replace(/ & drink/, '') : p.c);
    const sub = p.sub && p.sub !== 'generic' ? ' · ' + p.sub.replace('icecream', 'ice cream') : '';
    this.$('bm-c-cat').textContent = `${cat}${sub} · ${fmtDist(d)} away`;
    this.$('bm-c-n').textContent = p.n;
    this.$('bm-c-mr').textContent = p.mr || '';
    const bl = p.c === 'pin' ? (p.street ? `On ${p.street}, ${p.area || 'Pune'}.` : `In ${p.area || 'Pune'}.`) : p.c === 'area' ? `A neighbourhood of Pune.` : blurbFor(p);
    this.$('bm-c-b').textContent = bl;
    this.$('bm-c-b').hidden = !bl;
    const ft = this.$('bm-c-ft'), cost = this.g.fastTravelCost(p.x, p.z), why = this.g.fastTravelBlock();
    ft.textContent = this.g.free ? 'Go there now' : `Take a rickshaw · ₹${cost}`;
    ft.disabled = !!why || this.g.stats.money < cost || d < 40;
    ft.title = why || (this.g.stats.money < cost ? `You have ₹${this.g.stats.money}` : 'Skip the drive');
    // the place itself, live: the real street if it's near you, a model of it if not (liveview.js)
    { const el = this.$('bm-c-pic'); let cv = el.querySelector('canvas'); if (!cv) { el.innerHTML = '<canvas width="400" height="225"></canvas>'; cv = el.querySelector('canvas'); } this.g.liveView && this.g.liveView.show(p, cv); }
    // what's round there: the neighbourhood, and what you'd find within a few minutes' walk
    { const el = this.$('bm-c-near'), R = 500, list = (this.city.placesIn ? this.city.placesIn(p.x - R, p.z - R, p.x + R, p.z + R) : []).filter(q => Math.hypot(q.x - p.x, q.z - p.z) < R);
      const n = {}; for (const q of list) n[q.c] = (n[q.c] || 0) + 1;
      const subs = (this.g.hud && this.g.hud.suburbs) || []; let a = null, bd = 2500 * 2500; for (const q of subs) { const dd = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (dd < bd) { bd = dd; a = q; } }
      const pol = list.filter(q => q.c === 'police').length + (this.city.placesIn ? this.city.placesIn(p.x - 1500, p.z - 1500, p.x + 1500, p.z + 1500).filter(q => q.c === 'police').length : 0) * 0.3;
      const rows = [['Area', a ? a.n : 'Pune'], ...[['food', 'Food & drink'], ['shop', 'Shops'], ['transit', 'Transit'], ['temple', 'Temples'], ['hospital', 'Health'], ['bank', 'Banks'], ['fuel', 'Fuel']].filter(([k]) => n[k]).map(([k, l]) => [l, n[k], CATS[k][1]]),
        ['Police round here', pol >= 3 ? 'High' : pol >= 1 ? 'Medium' : 'Low']];
      el.innerHTML = `<div class="bm-c-k">Within 500 m</div>` + rows.map(([l, v, c]) => `<div class="bm-c-r">${c ? `<i style="background:${c}"></i>` : '<i class="no"></i>'}<span>${l}</span><b>${v}</b></div>`).join(''); }
    // how people round there take you
    { const R = this.g.rep, el = this.$('bm-c-rep');
      if (R && !this.g.free) { const v = R.standing(p.x, p.z), w = v > 0.45 ? 'One of ours' : v > 0.15 ? 'Liked' : v < -0.45 ? 'Trouble' : v < -0.15 ? 'Wary' : 'Neutral';
        el.innerHTML = `<span>Round here</span><i><b style="left:${(50 + v * 50).toFixed(1)}%"></b></i><em class="${v > 0.15 ? 'g' : v < -0.15 ? 'r' : ''}">${w}</em>`; el.hidden = false; } else el.hidden = true; }
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
      if (CATS[p.c] && this.legend.size && !this.legend.has(p.c)) { this.legend.add(p.c); const b = this.$('bm-filters').querySelector(`[data-k="${p.c}"]`); if (b) b.classList.add('on'); }
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
  // Pune Metro on the map, in each line's colour: the real viaducts (and straight runs between the underground
  // stations), a dot for every station, names when zoomed in. A line not open yet is drawn dashed
  metroLines() {
    if (this._metro) return this._metro;
    const M = this.g.W.M, lines = TRANSIT.metro.map(l => ({ ...l, open: lineOpen(l), runs: [] }));
    const lineAt = (x, z) => { let b = null, bd = 1e18; for (const l of lines) for (const s of l.stations) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; b = l; } } return b; };
    for (const [f, r] of M.metro || []) {
      if (f === 1) continue;                                     // other lines still being built
      const p = cmRing(r); if (p.length < 4) continue;
      const k = (p.length >> 2) << 1, l = lineAt(p[k], p[k + 1]);
      if (l) l.runs.push(p);
    }
    for (const l of lines) for (let i = 0; i + 1 < l.stations.length; i++) {
      const a = l.stations[i], b = l.stations[i + 1];
      if (a.ug || b.ug) l.runs.push([a.x, a.z, b.x, b.z]);
    }
    return (this._metro = lines);
  }
  drawMetro(x, T, z) {
    const lines = this.metroLines(), w = Math.max(2.2, Math.min(5, 2.6 * Math.pow(z, 0.35)));
    x.lineJoin = 'round'; x.lineCap = 'round';
    for (const l of lines) {
      x.setLineDash(l.open ? [] : [w * 2.2, w * 1.6]);
      for (const pass of [0, 1]) {
        x.strokeStyle = pass ? l.color : 'rgba(10,11,13,.55)'; x.lineWidth = pass ? w : w + 2.5; x.globalAlpha = l.open ? 1 : 0.8;
        x.beginPath();
        for (const q of l.runs) { const [X0, Y0] = T(q[0], q[1]); x.moveTo(X0, Y0); for (let k = 2; k < q.length; k += 2) { const [X, Y] = T(q[k], q[k + 1]); x.lineTo(X, Y); } }
        x.stroke();
      }
    }
    x.setLineDash([]); x.globalAlpha = 1;
    if (z < 0.22) return;
    const r = z < 0.6 ? 3 : 4.5;
    x.font = '650 11px Inter, system-ui, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
    for (const l of lines) for (const s of l.stations) {
      const [X, Y] = T(s.x, s.z);
      x.fillStyle = s.soon || !l.open ? '#9aa0a8' : '#f4f1ea'; x.strokeStyle = l.color; x.lineWidth = 2;
      x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.fill(); x.stroke();
      if (z >= 1.1) {
        const t = s.name + (!l.open ? ` · opens ${opensOn(l)}` : s.soon ? ' · opens later' : '');
        x.strokeStyle = 'rgba(16,18,22,.92)'; x.lineWidth = 3.5; x.strokeText(t, X + r + 4, Y); x.fillStyle = l.color; x.fillText(t, X + r + 4, Y);
      }
    }
  }
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
    this.city.drawTiles(x, v.x, v.z, v.ppm, 0, Math.hypot(w, h) / 2, v.ppm * dpr);
    x.restore();
    this.city.pump(this.g.state === 'map' ? 12 : 3);
    const g = this.g, T = (X, Z) => this.toScreen(X, Z);
    // routes: ride (yellow), waypoint (blue)
    const line = (pts, col, wpx) => {
      if (!pts || pts.length < 4) return;
      x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = wpx + 3; x.lineJoin = 'round'; x.lineCap = 'round';
      const path = () => { x.beginPath(); for (let k = 0; k < pts.length; k += 2) { const [X, Y] = T(pts[k], pts[k + 1]); k ? x.lineTo(X, Y) : x.moveTo(X, Y); } };
      path(); x.stroke(); x.strokeStyle = col; x.lineWidth = wpx; path(); x.stroke();
    };
    this.drawMetro(x, T, v.ppm);
    line(g.nav && g.nav.pts, '#5fd0ff', 4);
    line(g.rides && g.rides.routePts, '#f2b705', 4);
    // labels, most important first; each claims a box so nothing overlaps
    const boxes = [];
    // keep labels out from under the search bar, filter chips, buttons and the place card
    for (const el of [this.$('bm-filters'), this.el.querySelector('.bm-top'), this.$('bm-close'), this.el.querySelector('.bm-tools'), this.$('bm-card')]) {
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect(), o = cv.getBoundingClientRect();
      boxes.push([r.left - o.left - 6, r.top - o.top - 6, r.width + 12, r.height + 12]);
    }
    const free = (bx, by, bw, bh) => { for (const b of boxes) if (bx < b[0] + b[2] && bx + bw > b[0] && by < b[1] + b[3] && by + bh > b[1]) return false; boxes.push([bx, by, bw, bh]); return true; };
    const pad = 60;
    const [xa, za] = this.toWorld(-pad, -pad), [xb, zb] = this.toWorld(w + pad, h + pad);
    const inV = (p) => p.x > xa && p.x < xb && p.z > za && p.z < zb;
    const fade = (ppm, lo, hi, e = 0.18) => Math.max(0, Math.min(1, (Math.log(ppm) - Math.log(lo)) / e + 1, (Math.log(hi) - Math.log(ppm)) / e + 1));
    const text = (t, X, Y, font, fill, halo = 'rgba(16,18,22,.92)', hw = 3.5) => { x.font = font; x.strokeStyle = halo; x.lineWidth = hw; x.strokeText(t, X, Y); x.fillStyle = fill; x.fillText(t, X, Y); };
    const vis = [];
    const z = v.ppm;
    const TOP = new Set(['Shaniwar Wada', 'Dagdusheth Halwai Ganpati', 'Pune Junction', 'Fergusson College', 'Osho Teerth Park', 'Mahatma Phule Mandai', 'Sassoon Hospital', 'Bund Garden', 'College of Engineering Pune']);
    // 1. landmarks: a handful when the whole city is in view, all of them from district zoom in
    if (this.shows('landmark')) {
      for (const p of this.city.places) {
        if (p.c !== 'landmark' || !inV(p)) continue;
        if (z < 0.45 && !TOP.has(p.n)) continue;
        const [X, Y] = T(p.x, p.z), s = z < 0.45 ? 7 : 9;
        x.font = '700 12px Inter, system-ui, sans-serif';
        const tw = x.measureText(p.n).width;
        if (!free(X - s, Y - s, s * 2 + tw + 8, s * 2)) continue;
        drawPin(x, X, Y, CATS.landmark[1], CATS.landmark[2], s);
        x.textAlign = 'left'; x.textBaseline = 'middle';
        text(p.n, X + s + 5, Y, '700 12px Inter, system-ui, sans-serif', '#f7e3a1');
        vis.push(p);
      }
    }
    // 2. areas: big districts zoomed out, neighbourhoods mid, chowks close in
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const a of this.city.areas) {
      const al = a.tier === 1 ? fade(z, 0.1, 1.15) : a.tier === 2 ? fade(z, 0.5, 2.4) : fade(z, 1.3, 4.5);
      if (al <= 0.02 || !inV(a)) continue;
      const [X, Y] = T(a.x, a.z);
      const big = a.tier === 1 && z < 0.7;
      const t = a.tier === 3 ? a.n : a.n.toUpperCase();
      const font = a.tier === 3 ? '600 11.5px Inter, system-ui, sans-serif' : big ? '750 15px Archivo, Inter, system-ui, sans-serif' : '700 12px Inter, system-ui, sans-serif';
      x.font = font; x.letterSpacing = a.tier === 3 ? '0px' : big ? '2.5px' : '1.6px';
      const tw = x.measureText(t).width, th = big ? 34 : 18;
      if (!free(X - tw / 2 - 4, Y - th / 2, tw + 8, th)) { x.letterSpacing = '0px'; continue; }
      x.globalAlpha = al;
      text(t, X, big ? Y - 6 : Y, font, a.tier === 3 ? 'rgba(244,241,234,.7)' : 'rgba(244,241,234,.86)', 'rgba(16,18,22,.9)', 4);
      x.letterSpacing = '0px';
      if (big && a.mr) text(a.mr, X, Y + 11, '600 12px Mukta, "Nirmala UI", sans-serif', 'rgba(244,241,234,.55)', 'rgba(16,18,22,.9)', 3);
      x.globalAlpha = 1;
    }
    // 3. street names, rotated along the road
    if (z >= 0.6) {
      const minRank = z >= 3 ? 1 : z >= 1.6 ? 3 : z >= 0.85 ? 4 : 5;
      x.font = '600 11px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      let n = 0;
      for (const s of this.city.streets) {
        if (s.rank < minRank || !inV(s)) continue;
        const tw = x.measureText(s.n).width;
        if (tw > s.len * z * 0.9) continue;            // name longer than the road at this zoom
        const [X, Y] = T(s.x, s.z);
        const ca = Math.abs(Math.cos(s.a)), sa = Math.abs(Math.sin(s.a));
        const bw = tw * ca + 14 * sa, bh = tw * sa + 14 * ca;
        if (!free(X - bw / 2, Y - bh / 2, bw, bh)) continue;
        x.save(); x.translate(X, Y); x.rotate(s.a);
        text(s.n, 0, 0, '600 11px Inter, system-ui, sans-serif', s.rank >= 4 ? '#e2ded5' : '#b3b0a8', 'rgba(16,18,22,.88)', 3.5);
        x.restore();
        if (++n > 120) break;
      }
    }
    // 4. places by category, appearing as you zoom in
    const near = this.city.placesIn(xa, za, xb, zb);
    // (picked in the legend: they show from much further out)
    const MINZ = this.legend.size ? { police: 0.2, fuel: 0.2, transit: 0.25, hospital: 0.25, temple: 0.3, park: 0.3, college: 0.3, cinema: 0.3, food: 0.45, shop: 0.5, bank: 0.45, service: 0.7 }
      : { police: 0.5, fuel: 0.55, transit: 0.55, hospital: 0.7, temple: 0.8, park: 0.7, college: 0.7, cinema: 0.7, food: 0.85, shop: 1.0, bank: 0.95, service: 1.6 };
    const NAMEZ = { police: 1.5, fuel: 1.5, transit: 1.5, hospital: 2.4, temple: 2.6, park: 1.8, college: 1.8, cinema: 1.8, food: 2.2, shop: 2.8, bank: 2.8, service: 3.6 };
    for (const p of near) {
      if (p.c === 'landmark' || !this.shows(p.c) || z < (MINZ[p.c] || 3)) continue;
      const [X, Y] = T(p.x, p.z);
      const small = p.c === 'food' || p.c === 'shop' || p.c === 'bank' || p.c === 'service';
      const s = small ? (z >= 4 ? 6 : 4.5) : z >= 3 ? 7 : 5.5;
      if (!free(X - s, Y - s, s * 2, s * 2)) continue;
      const [, col, gl] = CATS[p.c];
      drawPin(x, X, Y, col, s >= 7 ? gl : null, s);
      vis.push(p);
      if (z >= (NAMEZ[p.c] || 5)) {
        x.font = '600 11px Inter, system-ui, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
        const tw = x.measureText(p.n).width;
        if (free(X + s + 3, Y - 7, tw + 6, 14)) text(p.n, X + s + 4, Y, '600 11px Inter, system-ui, sans-serif', '#e9e6de');
      }
    }
    this.visiblePlaces = vis;
    // ride and police markers
    for (const m of [...(g.home && g.home.markers ? g.home.markers() : []), ...(g.story && g.story.markers ? g.story.markers() : []), ...(g.rides ? g.rides.markers() : []), ...(g.police ? g.police.markers() : []), ...(g.props ? g.props.markers() : [])]) {
      const [X, Y] = T(m.x, m.z);
      const prop = m.kind === 'prop', pc = prop ? (m.owned ? '#33d17a' : '#c58cff') : null;
      drawPin(x, X, Y, prop ? pc : m.kind === 'pax' ? '#33d17a' : m.kind === 'cop' ? '#5aa2ff' : m.kind === 'marshal' || m.kind === 'footcop' ? '#ff4b3e' : m.kind === 'naka' ? '#ff3b30' : m.kind === 'story' ? '#ff9933' : '#f2b705', m.kind === 'tow' ? 'auto' : prop ? (m.owned ? 'home' : 'rupee') : null, m.kind === 'tow' || prop || m.kind === 'story' ? 9 : 6);
      if (m.label) { x.textAlign = 'left'; x.textBaseline = 'middle'; } if (m.label) text(m.label, X + 11, Y, '700 11px Inter, system-ui, sans-serif', pc || '#f2b705');
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
