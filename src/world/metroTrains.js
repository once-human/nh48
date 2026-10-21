// Pune Metro trains running live on the viaducts: three-car sets in the line's colours, running end to
// end along each line, slowing into every station, a twenty-second dwell, then on. Up and down tracks.
import * as THREE from 'three';
import { cmRing } from './geo.js';
import TRANSIT from '../game/transit.json';

const DECK = 12.62, CAR = 21.0, GAP = 0.9, CRUISE = 22, ACC = 1.0, DWELL = 20, TRACK = 1.05;

function carGeometry(color) {
  // a body with a rounded-ish roof, a dark window band, the line's stripe, skirts and bogies
  const parts = [], col = new THREE.Color(color), white = new THREE.Color(0xe9ecef), dark = new THREE.Color(0x14181d), grey = new THREE.Color(0x5b6168);
  const add = (geo, c, x, y, z) => { geo.translate(x, y, z); const n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(geo.toNonIndexed()); };
  add(new THREE.BoxGeometry(CAR, 2.6, 2.86), white, 0, 1.75, 0);
  add(new THREE.BoxGeometry(CAR - 0.4, 0.5, 2.5), white, 0, 3.2, 0);
  add(new THREE.BoxGeometry(CAR - 1.2, 0.95, 2.9), dark, 0, 2.15, 0);          // windows
  add(new THREE.BoxGeometry(CAR - 0.1, 0.32, 2.9), col, 0, 1.25, 0);           // the line stripe
  add(new THREE.BoxGeometry(CAR - 2, 0.55, 2.4), grey, 0, 0.3, 0);             // skirt and bogies
  for (const x of [-CAR / 2 + 3, CAR / 2 - 3]) add(new THREE.BoxGeometry(2.6, 0.45, 2.2), dark, x, 0.2, 0);
  const g = mergeAll(parts);
  g.computeVertexNormals();
  return g;
}
function mergeAll(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return out;
}

export class MetroTrains {
  constructor(W, scene, M) {
    this.trains = []; this.scene = scene;
    // join the OSM ways into continuous lines (ends within 10 m)
    const ways = (M.metro || []).filter(m => !m[0]).map(m => cmRing(m[1])).filter(p => p.length >= 4);
    const chains = [];
    const used = new Set();
    const end = (p, last) => last ? [p[p.length - 2], p[p.length - 1]] : [p[0], p[1]];
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 10;
    for (let i = 0; i < ways.length; i++) {
      if (used.has(i)) continue;
      used.add(i);
      let pts = ways[i].slice(), grew = true;
      while (grew) {
        grew = false;
        for (let j = 0; j < ways.length; j++) {
          if (used.has(j)) continue;
          const w = ways[j], h = end(pts, false), t = end(pts, true);
          const rev = (q) => { const r = []; for (let k = q.length - 2; k >= 0; k -= 2) r.push(q[k], q[k + 1]); return r; };
          if (near(t, end(w, false))) pts = pts.concat(w.slice(2));
          else if (near(t, end(w, true))) pts = pts.concat(rev(w).slice(2));
          else if (near(h, end(w, true))) pts = w.concat(pts.slice(2));
          else if (near(h, end(w, false))) pts = rev(w).concat(pts.slice(2));
          else continue;
          used.add(j); grew = true;
        }
      }
      chains.push(pts);
    }
    // stations on the viaduct (the built station buildings), and each line's colour
    const stops = [];
    for (const c of W.index.chunks) for (const st of c.mstations || []) { const p = st.pts; stops.push([(p[0] + p[p.length - 2]) / 2, (p[1] + p[p.length - 1]) / 2]); }
    const lineCol = (x, z) => {
      let best = 0x7b3fa0, bd = 1e12;
      for (const l of TRANSIT.metro) for (const s of l.stations) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = parseInt(String(l.color).replace('#', ''), 16) || best; } }
      return best;
    };
    const geos = new Map(), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 });
    for (const pts of chains) {
      const seg = []; let L = 0;
      for (let k = 0; k + 3 < pts.length; k += 2) { const l = Math.hypot(pts[k + 2] - pts[k], pts[k + 3] - pts[k + 1]); seg.push(L); L += l; }
      seg.push(L);
      if (L < 900) continue;
      const path = { pts, seg, L };
      // where along the line each station sits
      path.stops = [];
      for (const [sx, sz] of stops) {
        let bs = -1, bd = 60;
        for (let k = 0; k + 3 < pts.length; k += 2) {
          const ax = pts[k], az = pts[k + 1], dx = pts[k + 2] - ax, dz = pts[k + 3] - az, L2 = dx * dx + dz * dz; if (L2 < 1e-3) continue;
          const t = Math.max(0, Math.min(1, ((sx - ax) * dx + (sz - az) * dz) / L2)), d = Math.hypot(ax + dx * t - sx, az + dz * t - sz);
          if (d < bd) { bd = d; bs = seg[k / 2] + t * Math.sqrt(L2); }
        }
        if (bs >= 0) path.stops.push(bs);
      }
      path.stops.sort((a, b) => a - b);
      const mid = this.at(path, L / 2, []);
      const color = lineCol(mid[0], mid[1]);
      if (!geos.has(color)) geos.set(color, carGeometry(color));
      const geo = geos.get(color);
      // a train each way for every ~3 km of line
      const n = Math.max(1, Math.round(L / 3000));
      for (let k = 0; k < n; k++) for (const dir of [1, -1]) {
        const cars = [0, 1, 2].map(() => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.matrixAutoUpdate = false; scene.add(m); return m; });
        this.trains.push({ path, dir, s: (L * (k + (dir > 0 ? 0.15 : 0.6)) / n) % L, v: CRUISE * 0.6, dwell: 0, cars });
      }
    }
  }
  // position and heading at distance s along a path
  at(path, s, out) {
    const { pts, seg } = path;
    s = Math.max(0, Math.min(path.L - 0.01, s));
    let lo = 0, hi = seg.length - 2;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (seg[m] <= s) lo = m; else hi = m - 1; }
    const k = lo * 2, ax = pts[k], az = pts[k + 1], bx = pts[k + 2], bz = pts[k + 3], l = (seg[lo + 1] - seg[lo]) || 1, t = (s - seg[lo]) / l;
    out[0] = ax + (bx - ax) * t; out[1] = az + (bz - az) * t; out[2] = (bx - ax) / l; out[3] = (bz - az) / l;
    return out;
  }
  update(dt, cam) {
    const tmp = [0, 0, 0, 0], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    for (const T of this.trains) {
      const P = T.path, len = 3 * CAR + 2 * GAP;
      if (T.dwell > 0) { T.dwell -= dt; if (T.dwell <= 0) T.left = T.s; }
      else {
        // the next station ahead: brake to stop with the train centred on it
        let next = null;
        for (const st of P.stops) { const d = (st - T.s) * T.dir; if (d > 2 && (next === null || d < next) && !(T.left !== undefined && Math.abs(st - T.left) < 5)) next = d; }
        const endD = T.dir > 0 ? P.L - len / 2 - T.s : T.s - len / 2;
        const target = Math.min(next ?? 1e9, endD);
        const vmax = Math.min(CRUISE, Math.sqrt(Math.max(0, 2 * ACC * target)));
        T.v = Math.min(vmax, T.v + ACC * dt);
        T.s += T.v * T.dir * dt;
        if (target < 1.5 && T.v < 1.2) { T.v = 0; T.dwell = DWELL; if (endD < 2) { T.dir = -T.dir; T.left = undefined; } else T.left = T.s; }
      }
      // skip the maths for trains far from the camera
      this.at(P, T.s, tmp);
      const far = cam && Math.hypot(tmp[0] - cam.x, tmp[1] - cam.z) > 2600;
      for (let c = 0; c < 3; c++) {
        const m = T.cars[c]; m.visible = !far; if (far) continue;
        const sc0 = T.s + (c - 1) * (CAR + GAP) * T.dir;
        this.at(P, sc0, tmp);
        const hx = tmp[2] * T.dir, hz = tmp[3] * T.dir, off = TRACK * (T.dir > 0 ? 1 : -1);
        pos.set(tmp[0] - tmp[3] * off, DECK, tmp[1] + tmp[2] * off);
        q.setFromAxisAngle(up, Math.atan2(-hz, hx));
        m.matrix.copy(m4.compose(pos, q, sc)); m.matrixWorldNeedsUpdate = true;
      }
    }
  }
}
