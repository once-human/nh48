// Flyovers: elevated decks from OSM (tools/bake_flyovers.py) that vehicles can drive up, along and
// down. The world is otherwise flat, so the deck is a separate "layer": a vehicle joins it at a
// ramp foot and stays on it until it rolls off the other end. On the deck, parapets keep you on;
// on the ground, piers and the solid part of the ramps block you.
import * as THREE from 'three';
import { ColorBuilder } from './geo.js';

const CELL = 40;
const CONCRETE = [0.66, 0.65, 0.62], CONCRETE_D = [0.5, 0.49, 0.47], ASPHALT = [0.2, 0.2, 0.21];
const PAINT = [0.9, 0.9, 0.87], CRASH = [0.95, 0.85, 0.2];
const PARAPET_H = 0.95, DECK_T = 1.1;

export class Flyovers {
  constructor(W, scene) {
    this.W = W;
    this.segs = [];          // flat list of {f, ax, az, bx, bz, ha, hb, len, s0}
    this.decks = [];
    this.grid = new Map();
    const F = W.M.flyovers || [];
    F.forEach((d, fi) => {
      const [nid, wcm, ow, flat, hs] = d;
      const w = wcm / 100, pts = [], h = [];
      for (let k = 0; k < flat.length; k += 2) pts.push(flat[k] / 100, flat[k + 1] / 100);
      for (const v of hs) h.push(v / 100);
      const deck = { i: fi, w, hw: w / 2, ow: !!ow, pts, h, name: (W.M.names[nid] || [''])[0] };
      this.decks.push(deck);
      for (let k = 0; k + 3 < pts.length; k += 2) {
        const s = { f: fi, ax: pts[k], az: pts[k + 1], bx: pts[k + 2], bz: pts[k + 3], ha: h[k / 2], hb: h[k / 2 + 1], first: k === 0, last: k + 4 >= pts.length };
        s.len = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1e-6;
        this.segs.push(s);
        const x0 = Math.min(s.ax, s.bx) - deck.hw, x1 = Math.max(s.ax, s.bx) + deck.hw, z0 = Math.min(s.az, s.bz) - deck.hw, z1 = Math.max(s.az, s.bz) + deck.hw;
        for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
          const key = i + ',' + j; if (!this.grid.has(key)) this.grid.set(key, []); this.grid.get(key).push(s);
        }
      }
    });
    this.piers = [];
    if (this.decks.length) this.build(scene, W.mats);
  }
  // nearest deck point to (x,z): {s, t, d, h, lat, deck}
  probe(x, z, only = -1, skip = -1) {
    const l = this.grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
    if (!l) return null;
    let best = null;
    for (const s of l) {
      if (only >= 0 && s.f !== only || s.f === skip) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const u = ((x - s.ax) * dx + (z - s.az) * dz) / (s.len * s.len), t = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = s.ax + dx * t, pz = s.az + dz * t, d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d - 1e-6) {
        // metres past the free end of the deck (0 when alongside it)
        const past = s.first && u < 0 ? -u * s.len : s.last && u > 1 ? (u - 1) * s.len : 0;
        best = { s, t, d, px, pz, past, end: past > 0 ? (s.first && u < 0 ? s.ha : s.hb) : 0,
                 h: s.ha + (s.hb - s.ha) * t, deck: this.decks[s.f], lat: ((x - s.ax) * -dz + (z - s.az) * dx) / s.len };
      }
    }
    return best;
  }
  // which deck a body at (x,z) with current deck `cur` and height y is on (or -1 for the ground)
  track(x, z, cur, y = 0) {
    if (!this.decks.length) return -1;
    if (cur >= 0) {
      const q = this.probe(x, z, cur);
      if (q && !q.past && q.d <= q.deck.hw + 0.6) return cur;
      // carried onto the next piece of the same flyover?
      const n = this.probe(x, z, -1, cur);
      if (n && !n.past && n.d <= n.deck.hw + 0.6 && Math.abs(n.h - y) < 1.2) return n.s.f;
      if (q && q.past > 0 && q.end > 0.5 && q.past < 3) return cur;    // a deck that ends in the air: deckBlock stops you
      return -1;                                                       // rolled off a ramp foot
    }
    const q = this.probe(x, z);
    // drove onto a ramp foot: within the deck's width, at its low end
    if (q && q.past < 0.5 && Math.abs(q.lat) <= q.deck.hw - 0.3 && q.h < 0.9 && Math.abs(q.h - y) < 0.9) return q.s.f;
    return -1;
  }
  heightOn(cur, x, z) {
    const q = this.probe(x, z, cur);
    if (!q) { const n = this.probe(x, z); return n ? n.h : 0; }
    return q.h;
  }
  // keep a vehicle on its deck: the parapets
  clampDeck(o, cur, r = 1.0) {
    const q = this.probe(o.x, o.z, cur);
    if (!q) return false;
    const lim = q.deck.hw - r;
    if (q.d <= lim) return false;
    const nx = (o.x - q.px) / (q.d || 1), nz = (o.z - q.pz) / (q.d || 1);
    o.x = q.px + nx * lim; o.z = q.pz + nz * lim;
    return { nx: -nx, nz: -nz, depth: q.d - lim };
  }
  // collision circle on a deck: the parapets push it back in
  deckBlock(x, z, r, cur) {
    const q = this.probe(x, z, cur);
    if (!q) return null;
    if (q.past > 0) {
      if (q.end < 0.5) return null;                    // ramp foot: drive off onto the road
      const n = this.probe(x, z, -1, cur);             // the next piece carries on
      if (n && !n.past && n.d <= n.deck.hw + 0.6) return null;
      const s = q.s, sg = s.first && q.t === 0 ? 1 : -1;   // the deck stops here: a barrier
      return { nx: (s.bx - s.ax) / s.len * sg, nz: (s.bz - s.az) / s.len * sg, depth: q.past + r };
    }
    const lim = q.deck.hw - 0.25 - r;
    const ad = Math.abs(q.lat);
    if (ad <= lim) return null;
    const s = q.s, nx = -(s.bz - s.az) / s.len, nz = (s.bx - s.ax) / s.len, sg = q.lat > 0 ? -1 : 1;
    return { nx: nx * sg, nz: nz * sg, depth: ad - lim };
  }
  // on the ground: piers and the solid lower part of the ramps
  groundBlock(x, z, r) {
    const q = this.probe(x, z);
    if (q && !q.past && Math.abs(q.lat) < q.deck.hw + r && q.h > 0.45 && q.h < 4.6) {
      const s = q.s, sg = q.lat > 0 ? 1 : -1, nx = -(s.bz - s.az) / s.len * sg, nz = (s.bx - s.ax) / s.len * sg;
      return { nx, nz, depth: q.deck.hw + r - Math.abs(q.lat) };
    }
    for (const p of this.piersNear(x, z)) {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < p.r + r) return { nx: dx / (d || 1), nz: dz / (d || 1), depth: p.r + r - d };
    }
    return null;
  }
  // only the flyovers within sight draw (and only the close ones cast shadows)
  update(x, z) {
    if (!this.parts || Math.hypot(x - this.lastX, z - this.lastZ) < 25) return;
    this.lastX = x; this.lastZ = z;
    for (const p of this.parts) { const d = Math.hypot(p.x - x, p.z - z); p.mesh.visible = d < 1700; p.mesh.castShadow = d < 500; }
  }
  piersNear(x, z) { return this.pgrid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) || []; }

  build(scene, mats) {
    // one mesh per 400 m cell, not one for the whole city: only what's near the camera draws (all of Pune's
    // flyovers as a single mesh was 1.6 million triangles every frame, twice with shadows)
    const cbs = new Map(), BIN = 400;
    let cb = null;
    const at = (x, z) => { const k = Math.floor(x / BIN) + ',' + Math.floor(z / BIN); let c = cbs.get(k); if (!c) cbs.set(k, c = new ColorBuilder()); cb = c; };
    const quad = (a, b, c, d, col) => cb.quad ? cb.quad(a, b, c, d, col) : null;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const put = (x, y, z, sx, sy, sz, ry, col) => { Q.setFromAxisAngle(Y, ry); M4.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); cb.addGeo(box, M4, col); };
    this.pgrid = new Map();
    for (const dk of this.decks) {
      const P = dk.pts, H = dk.h, n = P.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const ax = P[2 * i], az = P[2 * i + 1], bx = P[2 * i + 2], bz = P[2 * i + 3];
        const ha = H[i], hb = H[i + 1];
        const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-6;
        const mx = (ax + bx) / 2, mz = (az + bz) / 2, mh = (ha + hb) / 2;
        at(mx, mz);
        const ry = Math.atan2(-dz, dx), pitch = Math.atan2(hb - ha, L);
        // deck slab: a box per 5 m piece, top at the road surface
        Q.setFromEuler(new THREE.Euler(0, ry, pitch, 'YXZ'));
        M4.compose(V.set(mx, mh - DECK_T / 2, mz), Q, S.set(L + 0.05, DECK_T, dk.w));
        cb.addGeo(box, M4, CONCRETE_D);
        // asphalt skin + centre/lane paint
        M4.compose(V.set(mx, mh + 0.01, mz), Q, S.set(L + 0.05, 0.02, dk.w - 0.4));
        cb.addGeo(box, M4, ASPHALT);
        if (i % 2 === 0) {
          const lanes = Math.max(1, Math.round((dk.w - 1) / 3.3));
          for (let k = 1; k < lanes; k++) {
            const off = -dk.hw + 0.5 + k * (dk.w - 1) / lanes;
            const nx = -dz / L, nz = dx / L;
            M4.compose(V.set(mx + nx * off, mh + 0.025, mz + nz * off), Q, S.set(L * 0.5, 0.02, 0.12));
            cb.addGeo(box, M4, PAINT);
          }
        }
        // parapets both sides
        for (const sd of [-1, 1]) {
          const nx = -dz / L * sd, nz = dx / L * sd;
          M4.compose(V.set(mx + nx * (dk.hw - 0.12), mh + PARAPET_H / 2, mz + nz * (dk.hw - 0.12)), Q, S.set(L + 0.05, PARAPET_H, 0.24));
          cb.addGeo(box, M4, CONCRETE);
          if (mh < 4.6 && mh > 0.4) {      // ramp walls down to the ground
            M4.compose(V.set(mx + nx * (dk.hw - 0.12), mh / 2, mz + nz * (dk.hw - 0.12)), Q, S.set(L + 0.05, mh, 0.3));
            cb.addGeo(box, M4, CONCRETE_D);
          }
        }
      }
      // piers every ~30 m where the deck is high
      let acc = 15;
      for (let i = 0; i < n - 1; i++) {
        const ax = P[2 * i], az = P[2 * i + 1], bx = P[2 * i + 2], bz = P[2 * i + 3];
        const L = Math.hypot(bx - ax, bz - az); acc += L;
        if (acc < 30) continue;
        acc = 0;
        const h = H[i];
        if (h < 4.6) continue;
        at(ax, az);
        const ry = Math.atan2(-(bz - az), bx - ax);
        const pw = Math.min(3.2, dk.w * 0.35);
        put(ax, (h - DECK_T) / 2, az, 1.3, h - DECK_T, pw, ry, CONCRETE);
        put(ax, h - DECK_T - 0.35, az, 1.8, 0.7, dk.w * 0.85, ry, CONCRETE);        // pier cap
        const pr = { x: ax, z: az, r: Math.max(0.8, pw / 2) };
        this.piers.push(pr);
        const key = Math.floor(ax / CELL) + ',' + Math.floor(az / CELL);
        if (!this.pgrid.has(key)) this.pgrid.set(key, []);
        this.pgrid.get(key).push(pr);
      }
    }
    this.parts = [];
    for (const [k, c] of cbs) {
      const [i, j] = k.split(',').map(Number);
      const mesh = new THREE.Mesh(c.build(), mats.prop);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.visible = false;
      scene.add(mesh);
      this.parts.push({ mesh, x: (i + 0.5) * BIN, z: (j + 0.5) * BIN });
    }
    this.lastX = 1e9; this.lastZ = 1e9;
    void quad; void CRASH;
  }
}

// shared by the player's auto and every other drivable vehicle
export function flyResolve(veh, x, z, r) {
  const F = veh.W.fly;
  if (F && veh.deck >= 0) return F.deckBlock(x, z, r, veh.deck);
  const res = veh.W.collision.resolve(x, z, r);
  if (res || !F) return res;
  return F.groundBlock(x, z, r);
}
export function flyTrack(veh) {
  const F = veh.W.fly;
  veh.deck = F ? F.track(veh.x, veh.z, veh.deck ?? -1, veh.y || 0) : -1;
}
export function flyHeight(veh, x, z, h) {
  const F = veh.W.fly;
  return F && veh.deck >= 0 ? Math.max(h, F.heightOn(veh.deck, x, z)) : h;
}
