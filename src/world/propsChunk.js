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
import { addLandmarks, buildLandmark } from './landmarks.js';

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

  // ---- street lamps, electric poles and their cables, signals: per tile (addStreetProps)
  const dyn = !!M.meta.tiles;
  W.lampSet = new InstancedSet(scene, P.lamp, W.mats.propI, 900, q.propRange, { cast: q.shadows });
  W.poleSet = new InstancedSet(scene, P.pole, W.mats.propI, 900, q.propRange, { cast: q.shadows });
  sets.push(W.lampSet, W.poleSet);
  W.lampPositions = [];
  W.wireMat = new THREE.LineBasicMaterial({ color: 0x151515 });
  const nSig = dyn ? 1500 : Math.max(1, M.signals.length);
  W.sigSet = new InstancedSet(scene, P.signal, W.mats.propI, nSig, q.propRange * 1.5, { cast: q.shadows });
  sets.push(W.sigSet);
  const bulbs = new THREE.InstancedMesh(P.bulb, new THREE.MeshBasicMaterial({ toneMapped: false }), nSig * 3);
  bulbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nSig * 3 * 3 + 3), 3);
  bulbs.frustumCulled = false;
  bulbs.count = 0;
  scene.add(bulbs);
  W.signalHeads = [];
  W.signalBulbs = bulbs;
  addStreetProps(W, M, 0);

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
  // metro stair towers and underground entrance kiosks (same shapes as buildPropsChunk draws)
  for (const c of index.chunks) {
    // the stations' columns and stair towers are placed off the road once the streets are in (stationLayout)
    for (const g of c.mgates) {
      const ang = hash1(g.x * 3.1 + g.z) * Math.PI, ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
      const kc = [[-3.5, -2.2], [3.5, -2.2], [3.5, 2.2], [-3.5, 2.2]].map(([a, b]) => [g.x + ux * a + vx * b, g.z + uz * a + vz * b]);
      collision.addLine([kc[1][0], kc[1][1], kc[2][0], kc[2][1], kc[3][0], kc[3][1], kc[0][0], kc[0][1]], 0);
    }
  }
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
  addLandmarks(W);
  // landmarks seen from across the city (Parvati on its hill) are built once and stay
  for (const L of W.landmarks) {
    if (!L.far) continue;
    const cb = new ColorBuilder(), gb = new GB(), fb = new FacadeB(), group = new THREE.Group(), mm = new THREE.Matrix4();
    try { buildLandmark(W, L.id, { fb, gb, cb, group, mm }); } catch (e) { console.warn('landmark', L.id, e); continue; }
    if (!cb.empty) { const m = new THREE.Mesh(cb.build(), W.mats.prop); m.castShadow = true; m.receiveShadow = true; group.add(m); }
    if (!gb.empty) { const m = new THREE.Mesh(gb.build(), W.mats.ground); m.receiveShadow = true; group.add(m); }
    if (!fb.empty) { const m = new THREE.Mesh(fb.build(), W.mats.facade); m.castShadow = true; m.receiveShadow = true; group.add(m); }
    group.name = 'landmark-' + L.id; W.scene.add(group);
  }
}

// one tile's lamps, poles (with cables into the chunks) and signal heads; nmap turns the tile's own graph
// node numbers into the world's
// Where a station's columns and its stair tower stand: off the carriageway. Pune's stations straddle the road
// on portal frames when there's no median, and the stair tower sits on the footpath beside the road. Worked out
// from the streets (W.surf) once they're loaded around the station, then kept, with its collision, for good.
function stationLayout(W, st) {
  const p = st.pts, L = polyLength(p), key = Math.round(p[0]) + ',' + Math.round(p[1]);
  const cache = W._stLay || (W._stLay = new Map());
  if (cache.has(key)) return cache.get(key);
  const ax = p[0], az = p[1], bx = p[p.length - 2], bz = p[p.length - 1];
  const dx = (bx - ax) / L, dz = (bz - az) / L, nx = dz, nz = -dx, cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const hl = Math.min(70, L / 2 + 5), ca = Math.min(38, hl * 0.6);
  const P = (a, b) => [cx + dx * a + nx * b, cz + dz * a + nz * b];
  const road = (a, b) => { const [x, z] = P(a, b); return W.surf.isRoad(x, z); };
  let known = false;                                  // any street under or beside it yet?
  for (let b = -12; b <= 12 && !known; b += 1.5) known = road(0, b) || road(-ca * 0.7, b) || road(ca * 0.7, b);
  // first edge off the road on one side (b > 0 or b < 0), within lim metres
  const edge = (a, sg, lim) => { for (let b = 0.5; b <= lim; b += 0.5) if (!road(a, b * sg)) return b * sg; return null; };
  const cols = [];
  for (const a of [-ca * 0.7, 0, ca * 0.7]) {
    if (!road(a, 0)) { cols.push([a, 0]); continue; }
    const l = edge(a, 1, 10), r = edge(a, -1, 10);
    if (l != null && r != null) { cols.push([a, l + Math.sign(l) * 0.9], [a, r + Math.sign(r) * 0.9]); }
    else cols.push([a, 0]);                           // a wide road: its median
  }
  // the stair tower: the first spot beside the road (either side) where its whole footprint is off the road
  let tower = null, ta = hl - 9;
  for (const a of [hl - 9, -(hl - 9), hl - 20, -(hl - 20), 0]) {
    for (let b = 8; b <= 30 && tower == null; b += 1) for (const sg of [1, -1]) {
      let ok = true;
      for (const [u, v] of [[-5, -3], [5, -3], [5, 3], [-5, 3], [0, 0], [0, -3], [0, 3]]) { const [x, z] = P(a + u, (b + v) * sg); if (W.surf.isRoad(x, z) || W.surf.inBuilding(x, z)) { ok = false; break; } }
      if (ok) { tower = b * sg; ta = a; break; }
    }
    if (tower != null) break;
  }
  const out = { cols, tower, ta };
  if (!known) return out;                             // the streets here aren't in yet: work it out again later
  cache.set(key, out);
  const C = W.collision, t0 = C.tag; C.tag = 0;
  for (const [a, b] of cols) { const [x, z] = P(a, b); C.addCircle(x, z, 1.1, 2); }
  if (tower != null) { const [tx, tz] = P(ta, tower); C.addRing([[-5, -3], [5, -3], [5, 3], [-5, 3]].flatMap(([u, v]) => [tx + dx * u + nx * v, tz + dz * u + nz * v]), 0); }
  C.tag = t0;
  return out;
}
export function addStreetProps(W, D, tag, nmap) { const it = addStreetPropsSteps(W, D, tag, nmap); while (!it.next().done) { /* all at once */ } }
// a piece at a time (the instanced sets are tagged only while this runs, never across a pause)
export function* addStreetPropsSteps(W, D, tag, nmap) {
  const { collision, index } = W;
  InstancedSet.tag = tag;
  let n = 0;
  for (const l of D.lamps) {
    if (++n % 300 === 0) { InstancedSet.tag = 0; yield; InstancedSet.tag = tag; }
    const x = l[0] / 100, z = l[1] / 100, a = l[2];
    const dx = Math.cos(a), dz = Math.sin(a);
    W.lampSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)));
    collision.addCircle(x, z, 0.16, 2);
    W.lampPositions.push([x + dx * 1.75, z + dz * 1.75, tag]);
  }
  const byRoad = new Map();
  for (const p of D.poles) {
    const x = p[0] / 100, z = p[1] / 100;
    if (!byRoad.has(p[2])) byRoad.set(p[2], []);
    byRoad.get(p[2]).push({ x, z, d: p[3] });
    collision.addCircle(x, z, 0.14, 2);
  }
  InstancedSet.tag = 0; yield; InstancedSet.tag = tag;
  for (const list of byRoad.values()) {
    if (++n % 40 === 0) { InstancedSet.tag = 0; yield; InstancedSet.tag = tag; }
    list.sort((a, b) => a.d - b.d);
    for (let k = 0; k < list.length; k++) {
      const a = list[k], nb = list[k + 1];
      const dirx = nb ? nb.x - a.x : 1, dirz = nb ? nb.z - a.z : 0;
      W.poleSet.add(a.x, a.z, compose(a.x, 0.15, a.z, yawX(-dirz, dirx)));
      if (!nb) continue;
      const L = Math.hypot(nb.x - a.x, nb.z - a.z);
      if (L > 55) continue;
      const ci = index.chunkOf(a.x, a.z);
      if (ci < 0) continue;
      const c = index.chunks[ci];
      if (!c.wires) c.wires = [];
      const arr = c.wires;
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
  InstancedSet.tag = 0; yield; InstancedSet.tag = tag;
  for (const s of D.signals) {
    const x = s[0] / 100, z = s[1] / 100, a = s[2];
    const dx = Math.cos(a), dz = Math.sin(a);
    W.sigSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)));
    collision.addCircle(x, z, 0.14, 2);
    W.signalHeads.push({ node: nmap ? nmap[s[3]] : s[3], x, z, dx, dz, bulbs: [], tag });
  }
  InstancedSet.tag = 0;
  layoutBulbs(W);
}
export function removeStreetProps(W, tag) {
  for (const S of [W.lampSet, W.poleSet, W.sigSet]) S.removeTag(tag);
  W.lampPositions = W.lampPositions.filter(p => p[2] !== tag);
  W.signalHeads = W.signalHeads.filter(h => h.tag !== tag);
  layoutBulbs(W);
}
// the three bulbs of every signal head, packed into the one instanced mesh
function layoutBulbs(W) {
  const bulbs = W.signalBulbs, cap = bulbs.instanceMatrix.count;
  let bi = 0;
  const dark = new THREE.Color(0.05, 0.05, 0.05);
  for (const h of W.signalHeads) {
    h.bulbs = [];
    for (let k = 0; k < 3 && bi < cap; k++) {
      bulbs.setMatrixAt(bi, compose(h.x + h.dx * 0.24, 0.15 + 3.55 - k * 0.3, h.z + h.dz * 0.24, Math.atan2(h.dx, h.dz)));
      bulbs.setColorAt(bi, dark);
      h.bulbs.push(bi++);
    }
  }
  bulbs.count = bi;
  bulbs.instanceMatrix.needsUpdate = true;
  if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
}

export function updateProps(W, cx, cz) {
  // the instanced street furniture only needs re-culling once the camera has really moved
  if (W._propX === undefined || Math.hypot(cx - W._propX, cz - W._propZ) >= 6) {
    W._propX = cx; W._propZ = cz;
    for (const s of W.instSets) s.update(cx, cz);
  }
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
    } else if (ex.kind === 'landmark') {
      try { buildLandmark(W, ex.id, { fb, gb, cb, group, mm }); } catch (e) { console.warn('landmark', ex.id, e); }
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
    // now and then a Puneri patya on the wall by the gate, one on each face
    if (false && signs.patya.length && hash1(p[0] * 3.7 + p[1] * 1.3) < 0.13) {
      const ax = p[0], az = p[1], bx = p[2], bz = p[3], L = Math.hypot(bx - ax, bz - az);
      if (L > 2.4) {
        const tx = (bx - ax) / L, tz = (bz - az) / L, nx = tz, nz = -tx, at = Math.min(1.4, L / 2), w = 0.9, h = 0.45, y0 = BASE + 1.0;
        for (const side of [1, -1]) {
          const s = signs.patya[Math.floor(hash1(p[0] + p[1] * 7 + side) * signs.patya.length)];
          const ox = nx * side, oz = nz * side, cx = ax + tx * at + ox * 0.125, cz = az + tz * at + oz * 0.125, rx = oz, rz = -ox;
          sb.quad([cx - rx * w / 2, y0, cz - rz * w / 2], [cx + rx * w / 2, y0, cz + rz * w / 2], [cx + rx * w / 2, y0 + h, cz + rz * w / 2], [cx - rx * w / 2, y0 + h, cz - rz * w / 2], [ox, 0, oz], s.u0, s.v0, s.u1, s.v1);
        }
      }
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
    if (constr === 1 && hash1(Math.round(mx) * 7 + Math.round(mz)) < 0.35) continue;
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
  // metro stations, built like Pune's elevated ones: a concourse slung under the viaduct on columns in the
  // median, open side platforms at track level with a parapet, a pitched canopy on posts, and a stair tower
  // down to the footpath
  const gq = (a, b, c, d, n, layer, shade, both) => {
    const v = [a, b, c, d].map(q => gb.v(q[0], q[1], q[2], n[0], n[1], n[2], q[3] || 0, q[4] || 0, layer, shade));
    gb.i.push(v[0], v[1], v[2], v[0], v[2], v[3]);
    if (both) { const w = [a, b, c, d].map(q => gb.v(q[0], q[1], q[2], -n[0], -n[1], -n[2], q[3] || 0, q[4] || 0, layer, shade * 0.8)); gb.i.push(w[0], w[2], w[1], w[0], w[3], w[2]); }
  };
  for (const st of C.mstations) {
    const p = st.pts;
    const L = polyLength(p);
    if (L < 40) continue;
    const ax = p[0], az = p[1], bx = p[p.length - 2], bz = p[p.length - 1];
    const dx = (bx - ax) / L, dz = (bz - az) / L, nx = dz, nz = -dx;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const hl = Math.min(70, L / 2 + 5), hw = 11;
    const P = (a, b) => [cx + dx * a + nx * b, cz + dz * a + nz * b];
    const tint = [0.92, 0.92, 0.94];
    const seed = Math.floor(hash1(cx) * 255);
    // a box from (a0..a1 along, b0..b1 across, y0..y1), facade walls on the four sides
    const box = (a0, a1, b0, b1, y0, y1, style, layer, flags) => {
      const co = [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], mx = (co[0][0] + co[2][0]) / 2, mz = (co[0][1] + co[2][1]) / 2;
      for (let k = 0; k < 4; k++) {
        const [x0, z0] = co[k], [x1, z1] = co[(k + 1) % 4], l = Math.hypot(x1 - x0, z1 - z0);
        let ox = (z1 - z0) / l, oz = -(x1 - x0) / l;
        if (ox * ((x0 + x1) / 2 - mx) + oz * ((z0 + z1) / 2 - mz) < 0) { ox = -ox; oz = -oz; }
        fb.wall(x0, z0, x1, z1, y0, y1, ox, oz, 0, { eu: 0, eL: l, tint, style, layer, flags, seed, tx: (x1 - x0) / l, tz: (z1 - z0) / l, top: y1 });
      }
      gb.poly([co.flat()], y1, GL.concrete, 0.85);
      gb.poly([co.flat()], y0, GL.concrete, 0.5, true);
    };
    // the concourse under the tracks, on three columns in the median
    const ca = Math.min(38, hl * 0.6);
    box(-ca, ca, -9, 9, 7.4, 10.9, 1, WL.cladding, 6);
    const LY = stationLayout(W, st);
    for (const [a, b] of LY.cols) box(a - 0.8, a + 0.8, b - 0.8, b + 0.8, 0, 7.4, 3, WL.plaster, 2);
    // side platforms at track level, with a parapet on the outer edge
    for (const sd of [1, -1]) {
      const b0 = 2.6 * sd, b1 = 7.4 * sd;
      const ring = [P(-hl, b0), P(hl, b0), P(hl, b1), P(-hl, b1)].flat();
      gb.poly([ring], 12.78, GL.concrete, 0.9);
      gb.poly([ring], 12.0, GL.concrete, 0.45, true);
      const [ox0, oz0] = P(-hl, b1), [ox1, oz1] = P(hl, b1), n = [nx * sd, 0, nz * sd];
      gq([ox0, 12.0, oz0], [ox1, 12.0, oz1], [ox1, 13.85, oz1], [ox0, 13.85, oz0], n, GL.concrete, 0.8, true);
      for (const a of [-hl, hl]) { const [x0, z0] = P(a, b0), [x1, z1] = P(a, b1); gq([x0, 12.0, z0], [x1, 12.0, z1], [x1, 12.78, z1], [x0, 12.78, z0], [dx * Math.sign(a), 0, dz * Math.sign(a)], GL.concrete, 0.7, true); }
      // canopy posts along the parapet
      for (let a = -hl + 6; a <= hl - 6; a += 15) box(a - 0.18, a + 0.18, b1 - 0.4 * sd - 0.18, b1 - 0.4 * sd + 0.18, 12.78, 17.15, 3, WL.plaster, 2);
    }
    // the canopy: two pitched planes over both platforms
    const ra = hl - 3;
    for (const sd of [1, -1]) {
      const [x0, z0] = P(-ra, 0), [x1, z1] = P(ra, 0), [x2, z2] = P(ra, 8.4 * sd), [x3, z3] = P(-ra, 8.4 * sd);
      const ny = 0.99, n = [nx * sd * 0.14, ny, nz * sd * 0.14];
      if (sd > 0) gq([x0, 18.1, z0], [x1, 18.1, z1], [x2, 17.0, z2], [x3, 17.0, z3], n, GL.concrete, 0.95, true);
      else gq([x0, 18.1, z0], [x3, 17.0, z3], [x2, 17.0, z2], [x1, 18.1, z1], n, GL.concrete, 0.95, true);
      const [ex0, ez0] = P(-ra, 8.4 * sd), [ex1, ez1] = P(ra, 8.4 * sd);
      gq([ex0, 16.7, ez0], [ex1, 16.7, ez1], [ex1, 17.0, ez1], [ex0, 17.0, ez0], [nx * sd, 0, nz * sd], GL.concrete, 0.8, true);
    }
    // a stair and escalator tower down to the footpath at one end, on the station's side of the road
    if (LY.tower) { const tb = LY.tower, tx0 = cx + dx * LY.ta + nx * tb, tz0 = cz + dz * LY.ta + nz * tb, sg = Math.sign(tb);
      const tc = [[-5, -3], [5, -3], [5, 3], [-5, 3]].map(([a, b]) => [tx0 + dx * a + nx * b, tz0 + dz * a + nz * b]);
      for (let k = 0; k < 4; k++) {
        const [x0, z0] = tc[k], [x1, z1] = tc[(k + 1) % 4], l = Math.hypot(x1 - x0, z1 - z0);
        let ox = (z1 - z0) / l, oz = -(x1 - x0) / l;
        if (ox * ((x0 + x1) / 2 - tx0) + oz * ((z0 + z1) / 2 - tz0) < 0) { ox = -ox; oz = -oz; }
        fb.wall(x0, z0, x1, z1, 0, 11.0, ox, oz, 0, { eu: 0, eL: l, tint, style: 1, layer: WL.cladding, flags: 6, seed, tx: (x1 - x0) / l, tz: (z1 - z0) / l, top: 11 });
      }
      gb.poly([tc.flat()], 11.0, GL.concrete, 0.8);
      // a bridge from the tower into the concourse
      const a0 = Math.min(Math.max(-ca + 1, Math.min(ca - 7, LY.ta - 3)), LY.ta - 4), a1 = Math.max(a0 + 6, LY.ta + 4), [bx0, bz0] = P(a0, 9 * sg), [bx1, bz1] = P(a1, 9 * sg), [bx2, bz2] = P(a1, tb - 3 * sg), [bx3, bz3] = P(a0, tb - 3 * sg);
      gb.poly([[bx0, bz0, bx1, bz1, bx2, bz2, bx3, bz3]], 10.9, GL.concrete, 0.8);
    }
    // the Metro sign along both canopy edges
    const s = signs.metro;
    for (const side of [1, -1]) {
      const [fx, fz] = P(0, (8.45) * side);
      const ltr = (dx * nz * side - dz * nx * side) > 0;
      sb.quad([fx - dx * 9, 15.4, fz - dz * 9], [fx + dx * 9, 15.4, fz + dz * 9], [fx + dx * 9, 16.65, fz + dz * 9], [fx - dx * 9, 16.65, fz - dz * 9],
        [nx * side, 0, nz * side], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
    }
  }
  // underground metro entrances: a glass kiosk with the Metro sign over the stairs
  for (const g of C.mgates || []) {
    const ang = hash1(g.x * 3.1 + g.z) * Math.PI, ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
    const kc = [[-3.5, -2.2], [3.5, -2.2], [3.5, 2.2], [-3.5, 2.2]].map(([a, b]) => [g.x + ux * a + vx * b, g.z + uz * a + vz * b]);
    const tint = [0.86, 0.88, 0.92], seed = 7;
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = kc[k], [x1, z1] = kc[(k + 1) % 4], l = Math.hypot(x1 - x0, z1 - z0);
      let ox = (z1 - z0) / l, oz = -(x1 - x0) / l;
      if (ox * ((x0 + x1) / 2 - g.x) + oz * ((z0 + z1) / 2 - g.z) < 0) { ox = -ox; oz = -oz; }
      if (k === 0) continue;                       // the open side: the stairs go down here
      fb.wall(x0, z0, x1, z1, 0, 3.3, ox, oz, 0, { eu: 0, eL: l, tint, style: 9, layer: WL.concrete, flags: 0, seed, tx: (x1 - x0) / l, tz: (z1 - z0) / l, top: 3.3 });
    }
    gb.poly([kc.flat()], 3.4, GL.concrete, 0.8);
    gb.poly([kc.flat()], 0.06, GL.concrete, 0.4);
    const s2 = signs.metro, fx = g.x - vx * 2.25, fz = g.z - vz * 2.25;
    sb.quad([fx - ux * 3, 3.45, fz - uz * 3], [fx + ux * 3, 3.45, fz + uz * 3], [fx + ux * 3, 4.45, fz + uz * 3], [fx - ux * 3, 4.45, fz - uz * 3], [-vx, 0, -vz], s2.u0, s2.v0, s2.u1, s2.v1);
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
