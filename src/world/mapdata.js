// Loads the embedded OSM-derived map, and provides the road graph, surface lookups and
// static collision geometry that the rest of the game queries.
import { cmRing } from './geo.js';

export async function loadMapJSON() {
  const el = document.getElementById('mapdata');
  const b64 = el.textContent.trim();
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to unpack the map (no DecompressionStream). Please update it.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  el.textContent = '';
  return JSON.parse(text);
}

// ---------------------------------------------------------------- road graph
export class Graph {
  constructor(M) {
    const N = M.graph.nodes, E = M.graph.edges;
    this.nodes = N.map((n, i) => ({ i, x: n[0] / 100, z: n[1] / 100, signal: !!(n[2] & 1), portal: !!(n[2] & 2), jr: n[3] / 100, out: [], inc: [], deg: 0, maxRank: 0 }));
    this.edges = E.map((e, i) => {
      const pts = cmRing(e[7]);
      const cum = [0];
      for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
      return { i, a: e[0], b: e[1], w: e[2] / 100, rank: e[3], oneway: !!e[4], name: e[5], sw: e[6] / 100, pts, cum, len: cum[cum.length - 1], bridge: !!e[8], restricted: !!e[9] };
    });
    for (const e of this.edges) {
      const A = this.nodes[e.a], B = this.nodes[e.b];
      A.deg++; B.deg++;
      A.maxRank = Math.max(A.maxRank, e.rank); B.maxRank = Math.max(B.maxRank, e.rank);
      // directed links: dir +1 a->b, -1 b->a
      A.out.push({ e, dir: 1 }); B.inc.push({ e, dir: 1 });
      if (!e.oneway) { B.out.push({ e, dir: -1 }); A.inc.push({ e, dir: -1 }); }
    }
    this.names = M.names;
  }
  // point along edge at distance s (0..len), returns [x,z,dx,dz]
  at(e, s, out = [0, 0, 0, 0]) {
    const pts = e.pts, cum = e.cum;
    if (s <= 0) { out[0] = pts[0]; out[1] = pts[1]; const L = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]) || 1; out[2] = (pts[2] - pts[0]) / L; out[3] = (pts[3] - pts[1]) / L; return out; }
    if (s >= e.len) {
      const n = pts.length; out[0] = pts[n - 2]; out[1] = pts[n - 1];
      const L = Math.hypot(pts[n - 2] - pts[n - 4], pts[n - 1] - pts[n - 3]) || 1;
      out[2] = (pts[n - 2] - pts[n - 4]) / L; out[3] = (pts[n - 1] - pts[n - 3]) / L; return out;
    }
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const L = cum[hi] - cum[lo] || 1;
    const t = (s - cum[lo]) / L;
    const ax = pts[2 * lo], az = pts[2 * lo + 1], bx = pts[2 * hi], bz = pts[2 * hi + 1];
    out[0] = ax + (bx - ax) * t; out[1] = az + (bz - az) * t;
    out[2] = (bx - ax) / L; out[3] = (bz - az) / L;
    return out;
  }
  // nearest point on the graph to (x,z): {e, s, d, side}
  nearest(x, z, maxD = 60, filter = null) {
    let best = null;
    const cand = this.grid ? this.gridQuery(x, z, maxD) : this.edges;
    for (const e of cand) {
      if (filter && !filter(e)) continue;
      const p = e.pts;
      for (let k = 0; k + 3 < p.length; k += 2) {
        const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
        let t = ((x - ax) * dx + (z - az) * dz) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + dx * t, pz = az + dz * t;
        const d = Math.hypot(x - px, z - pz);
        if (d < maxD && (!best || d < best.d)) {
          const side = Math.sign(dz * (x - ax) - dx * (z - az)) || 1;  // +1 = on the N (driver's left of a->b) side
          best = { e, s: e.cum[k / 2] + Math.sqrt(L2) * t, d, side };
        }
      }
    }
    return best;
  }
  buildGrid(cell = 40) {
    this.cell = cell;
    this.grid = new Map();
    for (const e of this.edges) {
      const p = e.pts;
      const seen = new Set();
      for (let k = 0; k + 3 < p.length; k += 2) {
        const L = Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]);
        const n = Math.max(1, Math.ceil(L / (cell / 2)));
        for (let j = 0; j <= n; j++) {
          const x = p[k] + (p[k + 2] - p[k]) * j / n, z = p[k + 1] + (p[k + 3] - p[k + 1]) * j / n;
          const key = Math.floor(x / cell) + ',' + Math.floor(z / cell);
          if (seen.has(key)) continue;
          seen.add(key);
          if (!this.grid.has(key)) this.grid.set(key, []);
          this.grid.get(key).push(e);
        }
      }
    }
  }
  gridQuery(x, z, r) {
    const c = this.cell, out = new Set();
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const l = this.grid.get(i + ',' + j);
        if (l) for (const e of l) out.add(e);
      }
    return out;
  }
  // A* over directed links. from {e,s} to {e,s}; returns list of {e,dir} and total length
  route(from, to, allowWrongWay = false) {
    const N = this.nodes;
    const goalX = N[to.e.a].x, goalZ = N[to.e.a].z;
    const h = (n) => Math.hypot(N[n].x - goalX, N[n].z - goalZ);
    const open = new MinHeap();
    const g = new Map(), prev = new Map();
    const startLinks = [];
    // start: leave current edge in either allowed direction
    const fe = from.e;
    startLinks.push({ node: fe.b, cost: fe.len - from.s, link: { e: fe, dir: 1 } });
    if (!fe.oneway || allowWrongWay) startLinks.push({ node: fe.a, cost: from.s, link: { e: fe, dir: -1 } });
    for (const s of startLinks) {
      if (!g.has(s.node) || g.get(s.node) > s.cost) { g.set(s.node, s.cost); prev.set(s.node, { from: -1, link: s.link }); open.push(s.node, s.cost + h(s.node)); }
    }
    const goalNodes = new Map();
    goalNodes.set(to.e.a, to.s);                         // arrive from a, drive a->b to s
    if (!to.e.oneway || allowWrongWay) goalNodes.set(to.e.b, to.e.len - to.s);
    let best = null;
    while (open.size) {
      const [n, f] = open.pop();
      const gn = g.get(n);
      if (best && f >= best.cost) break;
      if (goalNodes.has(n)) {
        const c = gn + goalNodes.get(n);
        if (!best || c < best.cost) best = { cost: c, node: n };
      }
      for (const l of N[n].out) {
        const m = l.dir > 0 ? l.e.b : l.e.a;
        const w = l.e.len * (l.e.restricted ? 3 : l.e.rank >= 4 ? 0.85 : l.e.rank === 0 ? 1.7 : l.e.rank <= 2 ? 1.25 : 1.0);   // gated and compound roads only when they really are the way
        const c = gn + w;
        if (!g.has(m) || c < g.get(m)) { g.set(m, c); prev.set(m, { from: n, link: l }); open.push(m, c + h(m)); }
      }
      if (allowWrongWay) {
        for (const l of N[n].inc) {
          if (!l.e.oneway) continue;
          const m = l.dir > 0 ? l.e.a : l.e.b;
          const c = gn + l.e.len * 2.5;
          if (!g.has(m) || c < g.get(m)) { g.set(m, c); prev.set(m, { from: n, link: { e: l.e, dir: -l.dir } }); open.push(m, c + h(m)); }
        }
      }
    }
    if (!best) return null;
    const links = [];
    let n = best.node;
    while (prev.has(n)) {
      const p = prev.get(n);
      links.unshift(p.link);
      if (p.from < 0) break;
      n = p.from;
    }
    // final partial link onto the target edge
    links.push({ e: to.e, dir: best.node === to.e.a ? 1 : -1, final: true });
    return { links, cost: best.cost };
  }
  // polyline for a route (for minimap / GPS arrow)
  routePolyline(route, from, to) {
    const out = [];
    const tmp = [0, 0, 0, 0];
    route.links.forEach((l, idx) => {
      const e = l.e;
      let s0 = l.dir > 0 ? 0 : e.len, s1 = l.dir > 0 ? e.len : 0;
      if (idx === 0) s0 = from.s;
      if (l.final) s1 = to.s;
      const n = Math.max(2, Math.ceil(Math.abs(s1 - s0) / 8));
      for (let k = 0; k <= n; k++) {
        this.at(e, s0 + (s1 - s0) * k / n, tmp);
        out.push(tmp[0], tmp[1]);
      }
    });
    return out;
  }
}

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(v, p) {
    const a = this.a; a.push([v, p]);
    let i = a.length - 1;
    while (i > 0) { const j = (i - 1) >> 1; if (a[j][1] <= a[i][1]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}

// ---------------------------------------------------------------- surfaces: road / raised / water
function pointInRings(x, z, rings) {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi)) inside = !inside;
    }
  }
  return inside;
}
export { pointInRings };

export class Surfaces {
  constructor(M) {
    const meta = M.meta;
    this.x0 = meta.vis[0] / 100; this.z0 = meta.vis[1] / 100;
    this.cs = meta.chunk; this.ncx = meta.ncx; this.ncz = meta.ncz;
    this.road = new Map();    // chunk -> [{rings, bb}]
    this.water = new Map();
    const add = (map, ci, rings) => {
      const rr = rings.map(cmRing);
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      const o = rr[0];
      for (let k = 0; k < o.length; k += 2) { x0 = Math.min(x0, o[k]); x1 = Math.max(x1, o[k]); z0 = Math.min(z0, o[k + 1]); z1 = Math.max(z1, o[k + 1]); }
      if (!map.has(ci)) map.set(ci, []);
      map.get(ci).push({ rings: rr, bb: [x0, z0, x1, z1] });
    };
    for (const [kind, polys] of M.ground) {
      if (kind === 'asphalt' || kind === 'concrete' || kind === 'bridge_road') for (const [ci, rings] of polys) add(this.road, ci, rings);
    }
    for (const [ci, rings] of M.water) add(this.water, ci, rings);
    // building footprints, filed in every chunk their box touches (for "is this spot inside a building")
    this.bld = new Map();
    for (const B of M.buildings) {
      const r = cmRing(B[1]);
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (let k = 0; k < r.length; k += 2) { x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k]); z0 = Math.min(z0, r[k + 1]); z1 = Math.max(z1, r[k + 1]); }
      const rec = { rings: [r], bb: [x0, z0, x1, z1] };
      const i0 = Math.floor((x0 - this.x0) / this.cs), i1 = Math.floor((x1 - this.x0) / this.cs), j0 = Math.floor((z0 - this.z0) / this.cs), j1 = Math.floor((z1 - this.z0) / this.cs);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        if (i < 0 || j < 0 || i >= this.ncx || j >= this.ncz) continue;
        const ci = i + j * this.ncx;
        if (!this.bld.has(ci)) this.bld.set(ci, []);
        this.bld.get(ci).push(rec);
      }
    }
  }
  inBuilding(x, z) { return this.test(this.bld, x, z); }
  chunkOf(x, z) {
    const i = Math.floor((x - this.x0) / this.cs), j = Math.floor((z - this.z0) / this.cs);
    if (i < 0 || j < 0 || i >= this.ncx || j >= this.ncz) return -1;
    return i + j * this.ncx;
  }
  test(map, x, z) {
    const ci = this.chunkOf(x, z);
    const l = map.get(ci);
    if (!l) return false;
    for (const p of l) {
      if (x < p.bb[0] || x > p.bb[2] || z < p.bb[1] || z > p.bb[3]) continue;
      if (pointInRings(x, z, p.rings)) return true;
    }
    return false;
  }
  isRoad(x, z) { return this.test(this.road, x, z); }
  isWater(x, z) { return this.test(this.water, x, z); }
  height(x, z) { return this.isRoad(x, z) ? 0 : 0.15; }
}

// ---------------------------------------------------------------- static collision
export class Collision {
  constructor(cell = 8) { this.cell = cell; this.segs = new Map(); this.circ = new Map(); this.nseg = 0; }
  key(i, j) { return i * 100003 + j; }
  addSeg(ax, az, bx, bz, kind = 0) {
    const s = { ax, az, bx, bz, kind };
    const c = this.cell;
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(L / (c * 0.5)));
    const seen = new Set();
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
      const key = this.key(Math.floor(x / c), Math.floor(z / c));
      if (seen.has(key)) continue;
      seen.add(key);
      let l = this.segs.get(key); if (!l) this.segs.set(key, l = []);
      l.push(s);
    }
    this.nseg++;
  }
  addLine(pts, kind = 0) { for (let k = 0; k + 3 < pts.length; k += 2) this.addSeg(pts[k], pts[k + 1], pts[k + 2], pts[k + 3], kind); }
  addRing(pts, kind = 0) { this.addLine(pts, kind); const n = pts.length; this.addSeg(pts[n - 2], pts[n - 1], pts[0], pts[1], kind); }
  addCircle(x, z, r, kind = 1) {
    const key = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let l = this.circ.get(key); if (!l) this.circ.set(key, l = []);
    const c = { x, z, r, kind, off: false };
    l.push(c);
    return c;
  }
  // resolve a circle against static geometry; returns {nx, nz, depth, kind} of deepest contact or null
  resolve(x, z, r, out) {
    const c = this.cell;
    let best = null;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const key = this.key(i, j);
      const ls = this.segs.get(key);
      if (ls) for (const s of ls) {
        const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1e-9;
        let t = ((x - s.ax) * dx + (z - s.az) * dz) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = s.ax + dx * t, pz = s.az + dz * t;
        const ex = x - px, ez = z - pz;
        const d = Math.hypot(ex, ez);
        if (d < r && (!best || r - d > best.depth)) best = { nx: d > 1e-6 ? ex / d : 0, nz: d > 1e-6 ? ez / d : 1, depth: r - d, kind: s.kind };
      }
      const lc = this.circ.get(key);
      if (lc) for (const q of lc) {
        if (q.off) continue;
        const ex = x - q.x, ez = z - q.z;
        const d = Math.hypot(ex, ez), rr = r + q.r;
        if (d < rr && (!best || rr - d > best.depth)) best = { nx: d > 1e-6 ? ex / d : 1, nz: d > 1e-6 ? ez / d : 0, depth: rr - d, kind: q.kind };
      }
    }
    return best;
  }
  // segment-vs-walls ray test for the camera; returns hit fraction (0..1) or 1
  ray(ax, az, bx, bz) {
    const c = this.cell;
    let tmin = 1;
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(L / (c * 0.5)));
    const seen = new Set();
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
      const key = this.key(Math.floor(x / c), Math.floor(z / c));
      if (seen.has(key)) continue; seen.add(key);
      const ls = this.segs.get(key);
      if (!ls) continue;
      for (const s of ls) {
        if (s.kind !== 0) continue;
        const t = segInter(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz);
        if (t !== null && t < tmin) tmin = t;
      }
    }
    return tmin;
  }
}

function segInter(ax, az, bx, bz, cx, cz, dx, dz) {
  const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den;
  const u = ((cx - ax) * rz - (cz - az) * rx) / den;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
  return null;
}
