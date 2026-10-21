// Street furniture. Things that repeat thousands of times across the map (trees, lamps, electric
// poles, signals) are global instanced sets culled by distance every few frames; one-off pieces
// (bus shelters, stalls, compound walls, cables, street-name boards, banners, the Metro viaduct
// and its stations) are built per chunk by the streamer.
import * as THREE from 'three';
import { ColorBuilder, QuadBuilder, cmRing, walkLine, polyLength, lin } from './geo.js';
import { RNG, hash1 } from '../core/util.js';
import { propMaterial } from '../gfx/materials.js';
import { WL } from '../gfx/pbr.js';
import { GL } from '../gfx/pbr.js';
import { InstancedSet, buildProto, compose, yawX } from './props.js';
import { GB } from './groundChunk.js';
import { FacadeB, BASE } from './buildingsChunk.js';

const STREET_IDX = { 'FC Road': 0, 'JM Road': 1, 'Karve Road': 2, 'Prabhat Road': 3, 'Bhandarkar Road': 4, 'Ghole Road': 5, 'Apte Road': 6,
  'Tilak Road': 7, 'Laxmi Road': 8, 'Ganeshkhind Road': 9, 'Lakdi Pul (Sambhaji Bridge)': 12 };
const WALL_PAL = [[0.96, 0.92, 0.8], [0.98, 0.88, 0.6], [0.95, 0.8, 0.78], [0.85, 0.85, 0.82], [0.8, 0.88, 0.94], [0.97, 0.97, 0.94], [0.9, 0.75, 0.5]];

export function buildGlobalProps(W) {
  const { M, scene, collision, quality: q, index } = W;
  const P = buildProto();
  W.proto = P;
  W.instSets = [];
  const sets = W.instSets;
  for (const c of index.chunks) { c.wires = []; c.extras = []; }

  // ---- street lamps
  const lampSet = new InstancedSet(scene, P.lamp, W.mats.prop, 900, q.propRange, { cast: q.shadows });
  sets.push(lampSet);
  W.lampPositions = [];
  for (const l of M.lamps) {
    const x = l[0] / 100, z = l[1] / 100, a = l[2];
    const dx = Math.cos(a), dz = Math.sin(a);
    lampSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)));
    collision.addCircle(x, z, 0.16, 2);
    W.lampPositions.push([x + dx * 1.75, z + dz * 1.75]);
  }

  // ---- electric poles; cables go to the chunk of their first pole
  const poleSet = new InstancedSet(scene, P.pole, W.mats.prop, 900, q.propRange, { cast: q.shadows });
  sets.push(poleSet);
  const byRoad = new Map();
  for (const p of M.poles) {
    const x = p[0] / 100, z = p[1] / 100;
    if (!byRoad.has(p[2])) byRoad.set(p[2], []);
    byRoad.get(p[2]).push({ x, z, d: p[3] });
    collision.addCircle(x, z, 0.14, 2);
  }
  for (const list of byRoad.values()) {
    list.sort((a, b) => a.d - b.d);
    for (let k = 0; k < list.length; k++) {
      const a = list[k], nb = list[k + 1];
      const dirx = nb ? nb.x - a.x : 1, dirz = nb ? nb.z - a.z : 0;
      poleSet.add(a.x, a.z, compose(a.x, 0.15, a.z, yawX(-dirz, dirx)));
      if (!nb) continue;
      const L = Math.hypot(nb.x - a.x, nb.z - a.z);
      if (L > 55) continue;
      const ci = index.chunkOf(a.x, a.z);
      if (ci < 0) continue;
      const arr = index.chunks[ci].wires;
      const ux = -(nb.z - a.z) / L, uz = (nb.x - a.x) / L;
      for (const o of [-0.7, -0.25, 0.25, 0.7, 0.0]) {
        const y0 = o === 0 ? 6.4 : 8.08;
        const sag = 0.35 + L * 0.012 + (o === 0 ? 0.4 : 0);
        let px = a.x + ux * o, pz = a.z + uz * o, py = y0 + 0.15;
        for (let s = 1; s <= 6; s++) {
          const t = s / 6;
          const qx = a.x + (nb.x - a.x) * t + ux * o, qz = a.z + (nb.z - a.z) * t + uz * o;
          const qy = y0 + 0.15 - 4 * sag * t * (1 - t);
          arr.push(px, py, pz, qx, qy, qz);
          px = qx; py = qy; pz = qz;
        }
      }
    }
  }
  W.wireMat = new THREE.LineBasicMaterial({ color: 0x151515 });

  // ---- signals (bulb colours driven by the traffic system)
  const nSig = Math.max(1, M.signals.length);
  const sigSet = new InstancedSet(scene, P.signal, W.mats.prop, nSig, q.propRange * 1.5, { cast: q.shadows });
  sets.push(sigSet);
  const bulbMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const bulbs = new THREE.InstancedMesh(P.bulb, bulbMat, nSig * 3);
  bulbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nSig * 3 * 3 + 3), 3);
  bulbs.frustumCulled = false;
  scene.add(bulbs);
  W.signalHeads = [];
  let bi = 0;
  for (const s of M.signals) {
    const x = s[0] / 100, z = s[1] / 100, a = s[2];
    const dx = Math.cos(a), dz = Math.sin(a);
    sigSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)));
    collision.addCircle(x, z, 0.14, 2);
    const head = { node: s[3], x, z, dx, dz, bulbs: [] };
    for (let k = 0; k < 3; k++) {
      const m = compose(x + dx * 0.24, 0.15 + 3.55 - k * 0.3, z + dz * 0.24, Math.atan2(dx, dz));
      bulbs.setMatrixAt(bi, m);
      bulbs.setColorAt(bi, new THREE.Color(0.05, 0.05, 0.05));
      head.bulbs.push(bi++);
    }
    W.signalHeads.push(head);
  }
  bulbs.count = bi;
  W.signalBulbs = bulbs;

  // ---- street-name boards + festival banners near main junctions (placed per chunk)
  const rng = new RNG(777);
  const tmp = [0, 0, 0, 0];
  let banners = 0;
  for (const n of W.graph.nodes) {
    if (n.deg < 3 || n.maxRank < 3 || n.portal) continue;
    let best = null;
    for (const l of [...n.out, ...n.inc]) {
      const nm = W.graph.names[l.e.name]?.[0];
      if (nm && STREET_IDX[nm] !== undefined && (!best || l.e.rank > best.e.rank)) best = l;
    }
    if (best && rng.chance(0.7)) {
      const e = best.e, fromA = e.a === n.i;
      W.graph.at(e, fromA ? Math.min(e.len, n.jr + 4) : Math.max(0, e.len - n.jr - 4), tmp);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = e.w / 2 + Math.max(0.8, e.sw * 0.5);
      const x = tmp[0] + tmp[3] * off * side, z = tmp[1] - tmp[2] * off * side;
      const ci = index.chunkOf(x, z);
      if (ci >= 0 && !W.surf.isRoad(x, z)) {
        const fx = fromA ? -tmp[2] : tmp[2], fz = fromA ? -tmp[3] : tmp[3];
        index.chunks[ci].extras.push({ kind: 'street', x, z, fx, fz, s: STREET_IDX[W.graph.names[e.name][0]] });
        collision.addCircle(x, z, 0.12, 2);
      }
    }
    if ((n.signal || rng.chance(0.15)) && banners < 120) {
      const l = n.out[0] || n.inc[0];
      if (!l) continue;
      const e = l.e, fromA = e.a === n.i;
      W.graph.at(e, fromA ? Math.min(e.len, n.jr + 7) : Math.max(0, e.len - n.jr - 7), tmp);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = e.w / 2 + Math.max(1.0, e.sw * 0.6);
      const x = tmp[0] + tmp[3] * off * side, z = tmp[1] - tmp[2] * off * side;
      const ci = index.chunkOf(x, z);
      if (ci < 0 || W.surf.isRoad(x, z)) continue;
      const fx = fromA ? -tmp[2] : tmp[2], fz = fromA ? -tmp[3] : tmp[3];
      index.chunks[ci].extras.push({ kind: 'banner', x, z, fx, fz, s: rng.int(0, W.signs.banners.length - 1) });
      banners++;
    }
  }
  // collision for per-chunk statics (needed even when the chunk isn't built)
  for (const b of M.buses) collision.addCircle(b[0] / 100, b[1] / 100, 0.9, 2);
  for (const s of M.stalls) collision.addCircle(s[0] / 100, s[1] / 100, 0.9, 2);
  for (const w of M.walls) { const p = cmRing(w); for (let k = 0; k + 3 < p.length; k += 2) collision.addSeg(p[k], p[k + 1], p[k + 2], p[k + 3], 5); }   // kind 5: a 1.8 m compound wall you can climb
  W.metroPiers = [];
  for (const [, line] of M.metro) {
    const p = cmRing(line);
    if (polyLength(p) < 20) continue;
    walkLine(p, 28, (x, z, dx, dz) => {
      for (const q2 of W.metroPiers) if (Math.hypot(q2[0] - x, q2[1] - z) < 9) return;
      W.metroPiers.push([x, z, dx, dz]);
      const ci = index.chunkOf(x, z);
      if (ci >= 0) index.chunks[ci].extras.push({ kind: 'pier', x, z, dx, dz });
      collision.addCircle(x, z, 1.0, 2);
    }, 10);
  }
}

export function updateProps(W, cx, cz) {
  for (const s of W.instSets) s.update(cx, cz);
  W.trees?.update(cx, cz);
  W.grass?.update(cx, cz);
}

export function* buildPropsChunk(W, C, group) {
  let ops = 0;
  const { M, mats, signs, index } = W;
  const P = W.proto;
  const cb = new ColorBuilder(), sb = new QuadBuilder(), gb = new GB(), fb = new FacadeB();
  const rng = new RNG(5000 + C.ci);
  const mm = new THREE.Matrix4();

  W.sliceLabel = 'pBus';
  for (const b of C.buses) {
    const x = b[0] / 100, z = b[1] / 100, a = b[2];
    const dx = Math.cos(a), dz = Math.sin(a);
    const ry = Math.atan2(dx, dz);
    cb.addGeo(P.bus, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
    const s = signs.bus[0];
    const fx = Math.cos(ry), fz = -Math.sin(ry);
    sb.quad([x - fx * 1.1, 2.75, z - fz * 1.1], [x + fx * 1.1, 2.75, z + fz * 1.1], [x + fx * 1.1, 3.3, z + fz * 1.1], [x - fx * 1.1, 3.3, z - fz * 1.1],
      [Math.sin(ry), 0, Math.cos(ry)], s.u0, s.v0, s.u1, s.v1);
  }
  for (const s of C.stalls) {
    const x = s[0] / 100, z = s[1] / 100, a = s[2], t = s[3];
    const proto = P['stall' + t] || P.stall0;
    const ry = Math.atan2(Math.cos(a), Math.sin(a));
    cb.addGeo(proto, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
    if (false) {                       // stall boards used invented shop names; real stalls are unnamed
      const sh = signs.shops[0];
      const fx = Math.cos(ry), fz = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry);
      const cx = x + nx * 0.6, cz = z + nz * 0.6;
      sb.quad([cx - fx * 1.1, 1.75, cz - fz * 1.1], [cx + fx * 1.1, 1.75, cz + fz * 1.1], [cx + fx * 1.1, 2.3, cz + fz * 1.1], [cx - fx * 1.1, 2.3, cz - fz * 1.1],
        [nx, 0, nz], sh.u0, sh.v0, sh.u1, sh.v1);
    }
  }
  for (const ex of C.extras) {
    if (ex.kind === 'street' || ex.kind === 'banner') {
      const { x, z, fx, fz } = ex;
      const ry = Math.atan2(-fx, -fz);
      const ux = Math.cos(ry), uz = -Math.sin(ry), nx = -fx, nz = -fz;
      const ltr = (ux * nz - uz * nx) > 0;
      if (ex.kind === 'street') {
        cb.addGeo(P.streetBoard, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
        const s = signs.streets[ex.s];
        sb.quad([x - ux * 1.22, 2.23, z - uz * 1.22], [x + ux * 1.22, 2.23, z + uz * 1.22], [x + ux * 1.22, 2.87, z + uz * 1.22], [x - ux * 1.22, 2.87, z - uz * 1.22],
          [nx, 0, nz], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
      } else {
        cb.addGeo(P.bannerFrame, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
        const s = signs.banners[ex.s];
        sb.quad([x - ux * 1.65, 1.9, z - uz * 1.65], [x + ux * 1.65, 1.9, z + uz * 1.65], [x + ux * 1.65, 2.9, z + uz * 1.65], [x - ux * 1.65, 2.9, z - uz * 1.65],
          [nx, 0, nz], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
        sb.quad([x - ux * 1.65, 1.9, z - uz * 1.65], [x + ux * 1.65, 1.9, z + uz * 1.65], [x + ux * 1.65, 2.9, z + uz * 1.65], [x - ux * 1.65, 2.9, z - uz * 1.65],
          [-nx, 0, -nz], s.u0, s.v0, s.u0 + 0.001, s.v0 + 0.001);
      }
    } else if (ex.kind === 'pier') {
      const { x, z, dx, dz } = ex;
      const ring = [];
      for (let k = 0; k <= 12; k++) ring.push(x + Math.cos(k / 12 * 6.283) * 0.9, z + Math.sin(k / 12 * 6.283) * 0.9);
      gb.wall(ring, 0, 11.0, GL.concrete, 1, 0.92);
      gb.box(x, 10.2, z, 6.5, 1.2, 2.2, -Math.atan2(dx, -dz) + Math.PI / 2, GL.concrete, 0.9);
    }
  }
  yield;
  W.sliceLabel = 'pWalls';
  // compound walls: plastered, painted, with a coping and gate pillars
  const wallH = 1.65;
  for (const p of C.walls) {
    if ((++ops & 7) === 0) yield;
    if (p.length < 4) continue;
    const seed = Math.floor(hash1(p[0] * 13 + p[1]) * 255);
    const tint = WALL_PAL[Math.floor(hash1(p[0] + p[1]) * WALL_PAL.length)].map(lin);
    let u = 0;
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const nx = (bz - az) / L, nz = -(bx - ax) / L, tx = (bx - ax) / L, tz = (bz - az) / L;
      const t = 0.1;
      const A = { eu: u, eL: L, tint, style: 3, layer: WL.plaster, flags: 2, seed, tx, tz, top: wallH };
      fb.wall(ax + nx * t, az + nz * t, bx + nx * t, bz + nz * t, BASE, BASE + wallH, nx, nz, u, A);
      fb.wall(ax - nx * t, az - nz * t, bx - nx * t, bz - nz * t, BASE, BASE + wallH, -nx, -nz, u, { ...A, tx: -tx, tz: -tz });
      const y = BASE + wallH, c = 0.14;
      fb.flat([[ax + nx * c, y, az + nz * c], [bx + nx * c, y, bz + nz * c], [bx - nx * c, y, bz - nz * c], [ax - nx * c, y, az - nz * c]], 1, { ...A, layer: WL.concrete, flags: 6 });
      u += L;
    }
    const ends = [[p[0], p[1], p[2], p[3]], [p[p.length - 2], p[p.length - 1], p[p.length - 4], p[p.length - 3]]];
    for (const [ex, ez, ox, oz] of ends) {
      const L = Math.hypot(ox - ex, oz - ez) || 1;
      const dx = (ox - ex) / L, dz = (oz - ez) / L;
      const cx = ex + dx * 0.2, cz = ez + dz * 0.2, r = 0.22, h = wallH + 0.35;
      const sq = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([a, b]) => [cx + dx * a - dz * b, cz + dz * a + dx * b]);
      const A = { eu: 0, eL: 0.44, tint: tint.map(v => v * 0.92), style: 3, layer: WL.plaster, flags: 2, seed, tx: 1, tz: 0, top: h };
      for (let k = 0; k < 4; k++) {
        const [ax, az] = sq[k], [bx, bz] = sq[(k + 1) % 4];
        const l2 = Math.hypot(bx - ax, bz - az) || 1;
        let nx = (bz - az) / l2, nz = -(bx - ax) / l2;
        if (nx * ((ax + bx) / 2 - cx) + nz * ((az + bz) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
        fb.wall(ax, az, bx, bz, BASE, BASE + h, nx, nz, 0, { ...A, tx: (bx - ax) / l2, tz: (bz - az) / l2 });
      }
      fb.flat([[sq[0][0], BASE + h, sq[0][1]], [sq[1][0], BASE + h, sq[1][1]], [sq[2][0], BASE + h, sq[2][1]], [sq[3][0], BASE + h, sq[3][1]]], 1, { ...A, layer: WL.concrete, flags: 6 });
    }
  }
  yield;
  W.sliceLabel = 'pMetro';
  // metro viaduct decks
  for (const m of C.metro) {
    const [constr, ax, az, bx, bz] = m;
    const sl = Math.hypot(bx - ax, bz - az);
    if (sl < 0.2) continue;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (constr && hash1(Math.round(mx) * 7 + Math.round(mz)) < 0.35) continue;
    const nx = (bz - az) / sl, nz = -(bx - ax) / sl;
    const hw = 2.5, bw = 1.5, top = 12.6, bot = 11.2;
    const quad = (o0, y0, o1, y1) => {
      // side face between offsets o0 (bottom) and o1 (top); facing away from the centre line
      const s = Math.sign(o1 || o0);
      const fnx = nx * s, fnz = nz * s;
      const v0 = gb.v(ax + nx * o0, y0, az + nz * o0, fnx, 0, fnz, 0, y0, GL.concrete, 0.9);
      const v1 = gb.v(bx + nx * o0, y0, bz + nz * o0, fnx, 0, fnz, sl, y0, GL.concrete, 0.9);
      const v2 = gb.v(bx + nx * o1, y1, bz + nz * o1, fnx, 0, fnz, sl, y1, GL.concrete, 0.9);
      const v3 = gb.v(ax + nx * o1, y1, az + nz * o1, fnx, 0, fnz, 0, y1, GL.concrete, 0.9);
      const cx = -(bz - az), cz = (bx - ax);
      if ((cx * fnx + cz * fnz) >= 0) gb.i.push(v0, v1, v2, v0, v2, v3); else gb.i.push(v0, v2, v1, v0, v3, v2);
    };
    quad(bw, bot, hw, top); quad(-bw, bot, -hw, top);
    quad(hw, top, hw, top + 1.3); quad(-hw, top, -hw, top + 1.3);
    gb.poly([[ax + nx * bw, az + nz * bw, bx + nx * bw, bz + nz * bw, bx - nx * bw, bz - nz * bw, ax - nx * bw, az - nz * bw]], bot, GL.concrete, 0.6, true);
    gb.poly([[ax + nx * hw, az + nz * hw, bx + nx * hw, bz + nz * hw, bx - nx * hw, bz - nz * hw, ax - nx * hw, az - nz * hw]], top + 0.02, GL.concrete, 0.75);
  }
  // metro stations: concourse + glazed platform level on the viaduct
  for (const st of C.mstations) {
    const p = st.pts;
    const L = polyLength(p);
    if (L < 40) continue;
    const ax = p[0], az = p[1], bx = p[p.length - 2], bz = p[p.length - 1];
    const dx = (bx - ax) / L, dz = (bz - az) / L, nx = dz, nz = -dx;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const hl = Math.min(70, L / 2 + 5), hw = 11;
    const corners = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([a, b]) => [cx + dx * a + nx * b, cz + dz * a + nz * b]);
    const tint = [0.92, 0.92, 0.94];
    const seed = Math.floor(hash1(cx) * 255);
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % 4];
      const l = Math.hypot(x1 - x0, z1 - z0);
      let ox = (z1 - z0) / l, oz = -(x1 - x0) / l;
      if (ox * ((x0 + x1) / 2 - cx) + oz * ((z0 + z1) / 2 - cz) < 0) { ox = -ox; oz = -oz; }
      const tx = (x1 - x0) / l, tz = (z1 - z0) / l;
      fb.wall(x0, z0, x1, z1, 8.5, 11.0, ox, oz, 0, { eu: 0, eL: l, tint, style: 1, layer: WL.cladding, flags: 6, seed, tx, tz, top: 11 });
      fb.wall(x0, z0, x1, z1, 13.6, 18.5, ox, oz, 0, { eu: 0, eL: l, tint, style: 9, layer: WL.concrete, flags: 0, seed, tx, tz, top: 18.5 });
    }
    const ring = corners.flat();
    gb.poly([ring], 18.5, GL.concrete, 0.85);
    gb.poly([ring], 8.5, GL.concrete, 0.5, true);
    const s = signs.metro;
    for (const side of [1, -1]) {
      const fx = cx + nx * (hw + 0.05) * side, fz = cz + nz * (hw + 0.05) * side;
      const ltr = (dx * nz * side - dz * nx * side) > 0;
      sb.quad([fx - dx * 9, 18.6, fz - dz * 9], [fx + dx * 9, 18.6, fz + dz * 9], [fx + dx * 9, 20.1, fz + dz * 9], [fx - dx * 9, 20.1, fz - dz * 9],
        [nx * side, 0, nz * side], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
    }
  }
  // emit
  yield;
  W.sliceLabel = 'pEmitC';
  if (!cb.empty) { const m = new THREE.Mesh(cb.build(), mats.prop); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  yield;
  W.sliceLabel = 'pEmitS';
  if (!sb.empty) { const m = new THREE.Mesh(sb.build(), mats.oldSign); m.receiveShadow = true; group.add(m); }
  yield;
  W.sliceLabel = 'pEmitG';
  if (!gb.empty) { const m = new THREE.Mesh(gb.build(), mats.ground); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  yield;
  W.sliceLabel = 'pEmitF';
  if (!fb.empty) { const m = new THREE.Mesh(yield* fb.buildSliced(), mats.facade); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (C.wires.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(C.wires, 3));
    group.add(new THREE.LineSegments(g, W.wireMat));
  }
}
