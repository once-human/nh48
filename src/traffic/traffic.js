// Lane-less Pune traffic: drive on the left, fill every gap, honk, mostly obey signals.
// Vehicles follow the OSM road graph with a free lateral offset; IDM car-following
// plus gap-seeking weaving for two-wheelers and autos.
import * as THREE from 'three';
import { TRAFFIC, curve } from '../world/activity.js';
import { RNG, clamp, lerp, wrapAngle } from '../core/util.js';
import { buildAuto, buildScooter, buildBike, buildCar, buildBus, buildTempo, buildCycle, buildLow, PAINTS } from '../vehicles/models.js';
import { lin } from '../world/geo.js';

export const TYPES = {
  scooter: { w: 30, L: 1.85, W: 0.75, vMul: [1.0, 1.25], A: 2.6, B: 5, T: 0.55, s0: 0.6, agile: 1.0, mass: 160, two: true, honk: 'beep' },
  scooterP: { w: 9, L: 1.85, W: 0.75, vMul: [0.95, 1.15], A: 2.2, B: 5, T: 0.65, s0: 0.7, agile: 0.9, mass: 220, two: true, honk: 'beep' },
  bike: { w: 20, L: 2.0, W: 0.78, vMul: [1.05, 1.35], A: 3.0, B: 5.5, T: 0.5, s0: 0.6, agile: 1.0, mass: 170, two: true, honk: 'beep' },
  bikeP: { w: 6, L: 2.0, W: 0.78, vMul: [1.0, 1.25], A: 2.7, B: 5.5, T: 0.55, s0: 0.65, agile: 0.9, mass: 230, two: true, honk: 'beep' },
  cycle: { w: 1.5, L: 1.75, W: 0.6, vMul: [0.35, 0.5], A: 0.8, B: 3, T: 0.8, s0: 0.6, agile: 0.6, mass: 90, two: true, honk: 'bell' },
  auto: { w: 15, L: 2.7, W: 1.4, vMul: [0.82, 1.0], A: 1.8, B: 4.5, T: 0.7, s0: 0.8, agile: 0.75, mass: 450, honk: 'auto' },
  hatch: { w: 10, L: 3.65, W: 1.6, vMul: [0.9, 1.1], A: 2.2, B: 5.5, T: 0.9, s0: 1.2, agile: 0.35, mass: 950, honk: 'car' },
  sedan: { w: 7, L: 4.0, W: 1.7, vMul: [0.9, 1.15], A: 2.4, B: 5.5, T: 0.9, s0: 1.2, agile: 0.3, mass: 1100, honk: 'car' },
  suv: { w: 4, L: 4.5, W: 1.8, vMul: [0.9, 1.15], A: 2.3, B: 5.5, T: 1.0, s0: 1.3, agile: 0.25, mass: 1700, honk: 'car' },
  taxi: { w: 2, L: 4.0, W: 1.7, vMul: [0.95, 1.15], A: 2.4, B: 5.5, T: 0.9, s0: 1.2, agile: 0.35, mass: 1100, honk: 'car' },
  tempo: { w: 4, L: 3.8, W: 1.55, vMul: [0.75, 0.95], A: 1.6, B: 4.5, T: 1.0, s0: 1.4, agile: 0.25, mass: 1400, honk: 'tempo' },
  lux: { w: 0.7, L: 4.92, W: 1.85, vMul: [0.95, 1.2], A: 2.8, B: 6, T: 0.9, s0: 1.3, agile: 0.3, mass: 1800, honk: 'car' },
  jeep: { w: 0.9, L: 3.98, W: 1.82, vMul: [0.95, 1.2], A: 2.4, B: 5.5, T: 0.9, s0: 1.3, agile: 0.3, mass: 1750, honk: 'car' },
  sports: { w: 0.05, L: 4.52, W: 1.85, vMul: [1.0, 1.3], A: 3.4, B: 6.5, T: 0.8, s0: 1.3, agile: 0.35, mass: 1500, honk: 'car' },
  super: { w: 0.025, L: 4.52, W: 1.93, vMul: [1.0, 1.35], A: 3.6, B: 7, T: 0.8, s0: 1.3, agile: 0.35, mass: 1420, honk: 'car' },
  bullet: { w: 3, L: 2.15, W: 0.8, vMul: [0.95, 1.2], A: 2.6, B: 5.5, T: 0.55, s0: 0.65, agile: 0.85, mass: 195, two: true, honk: 'beep' },
  bus: { w: 3, L: 11.4, W: 2.55, vMul: [0.7, 0.85], A: 1.1, B: 3.5, T: 1.4, s0: 2.0, agile: 0.05, mass: 9000, honk: 'bus', mainOnly: true },
};
const TYPE_NAMES = Object.keys(TYPES);
// the neighbourhood's own traffic (game.js tells the traffic which kind of place a spot is)
const ZONE_MIX = {
  rich: { lux: 5, suv: 1.8, sedan: 1.4, sports: 9, super: 9, jeep: 1.6, auto: 0.6, cycle: 0.4, tempo: 0.5, scooterP: 0.7 },          // KP, Boat Club Road, Baner, Kalyani Nagar...
  it: { sedan: 1.5, suv: 1.6, lux: 2, hatch: 1.3, bike: 1.2, taxi: 2.5, sports: 2, super: 1.5, cycle: 0.4, tempo: 0.7 },             // Hinjawadi, Kharadi, Magarpatta: cabs and company cars
  peth: { scooter: 1.4, scooterP: 1.6, auto: 1.3, cycle: 1.8, bullet: 1.4, hatch: 0.8, suv: 0.5, lux: 0.25, sports: 0.15, super: 0.1, jeep: 0.4 },
  station: { auto: 2, taxi: 1.8, bus: 1.3, tempo: 1.2, lux: 0.4, sports: 0.1, super: 0.05 },
  outskirts: { auto: 1.4, tempo: 1.8, bike: 1.4, bullet: 1.6, jeep: 2.2, cycle: 1.4, hatch: 0.8, sedan: 0.7, lux: 0.2, sports: 0.05, super: 0.03 },   // Lohegaon, Wagholi, Dhanori, the villages
};

const SPEED_BY_RANK = [4.5, 5, 7, 9.5, 11.5, 13.5, 14.5];
const tmpA = [0, 0, 0, 0], tmpB = [0, 0, 0, 0];

function linkLen(l) { return l.e.len; }
// point on a directed link at distance s from its start
function linkAt(graph, l, s, out) {
  const e = l.e;
  if (l.dir > 0) graph.at(e, s, out);
  else { graph.at(e, e.len - s, out); out[2] = -out[2]; out[3] = -out[3]; }
  return out;
}
function linkEnd(l) { return l.dir > 0 ? l.e.b : l.e.a; }
function linkStart(l) { return l.dir > 0 ? l.e.a : l.e.b; }
// lateral bounds (driver's left positive)
function latBounds(l) {
  const hw = l.e.w / 2 - 0.55;
  if (l.e.oneway) return [-hw, hw];
  return [0.45, Math.max(0.6, hw)];
}

export class Traffic {
  constructor(W, scene, mats, quality) {
    this.W = W; this.graph = W.graph; this.scene = scene;
    this.rng = new RNG(4242);
    this.max = quality.traffic;
    this.list = [];
    this.pool = [];
    this.grid = new Map();
    this.cell = 10;
    this.honks = [];        // events for audio: {x,z,kind}
    this.player = null;
    this.peds = null;
    this.signals = new Signals(W);
    this.time = 0;
    this.hour = 12;
    // build models + instanced meshes
    const models = {
      scooter: buildScooter({ helmet: true }), scooterP: buildScooter({ helmet: false, pillion: true, sideSaddle: true }),
      bike: buildBike({ helmet: true }), bikeP: buildBike({ helmet: true, pillion: true }), cycle: buildCycle(),
      auto: buildAuto({ driver: true, inst: true, withWheels: true }),
      hatch: buildCar('hatch'), sedan: buildCar('sedan'), suv: buildCar('suv'), taxi: buildCar('taxi'),
      lux: buildCar('lux'), jeep: buildCar('jeep'), sports: buildCar('sports'), super: buildCar('super'), bullet: buildBike({ helmet: true }),
      tempo: buildTempo(), bus: buildBus(),
      // the same, empty: close and slow, real people ride them (crowd.js)
      scooterE: buildScooter({ helmet: true, noRider: true }), bikeE: buildBike({ helmet: true, noRider: true }), autoE: buildAuto({ inst: true, withWheels: true }),
    };
    this.models = models;
    this.inst = {};
    const cap = Math.max(8, Math.ceil(this.max * 0.6));
    for (const k of [...TYPE_NAMES, 'scooterE', 'bikeE', 'autoE']) {
      const m = models[k];
      const c = /E$/.test(k) ? 16 : k === 'bus' ? Math.max(4, Math.ceil(this.max * 0.08)) : cap;
      const body = new THREE.InstancedMesh(m.body.clone(), mats.body, c);
      body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3);
      body.geometry.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));
      body.geometry.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));
      body.castShadow = quality.shadows; body.receiveShadow = true;
      body.frustumCulled = false; body.count = 0;
      scene.add(body);
      let glass = null;
      if (m.glass.attributes.position.count) {
        glass = new THREE.InstancedMesh(m.glass, mats.glassI || mats.glass, c);
        glass.frustumCulled = false; glass.count = 0;
        scene.add(glass);
      }
      // far LOD: a handful of boxes
      const lowGeo = buildLow(k);
      const low = new THREE.InstancedMesh(lowGeo, mats.body, c);
      low.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3);
      lowGeo.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));
      lowGeo.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));
      low.castShadow = false; low.receiveShadow = true; low.frustumCulled = false; low.count = 0;
      scene.add(low);
      this.inst[k] = { body, glass, low, cap: c, n: 0, nl: 0 };
    }
    this.lodDist = 80;          // the simple far model only past this (it used to swap in plain view)
    this.cam = new THREE.Vector3();
    this.mtx = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.eul = new THREE.Euler(0, 0, 0, 'YXZ');
    this.v3 = new THREE.Vector3(); this.s3 = new THREE.Vector3(1, 1, 1);
  }

  // ---------------------------------------------------------------- spawning
  pickType(link) {
    const main = link.e.rank >= 4;
    const mix = { ...this.mix() }, p = link.e.pts, z = this.zoneAt && p ? this.zoneAt(p[0], p[1]) : null, Z = ZONE_MIX[z];
    if (Z) for (const k in Z) mix[k] = (mix[k] ?? 1) * Z[k];
    let tot = 0;
    for (const k of TYPE_NAMES) { const t = TYPES[k]; if (t.mainOnly && !main) continue; tot += t.w * (mix[k] ?? 1); }
    let x = this.rng.next() * tot;
    for (const k of TYPE_NAMES) { const t = TYPES[k]; if (t.mainOnly && !main) continue; x -= t.w * (mix[k] ?? 1); if (x <= 0) return k; }
    return 'scooter';
  }
  // what is on the road by hour: PMPML buses stop around 11 pm, goods tempos run early morning,
  // late at night it is cabs, autos and bikes
  mix() {
    const h = this.hour;
    if (h >= 23.5 || h < 5) return { bus: 0.1, tempo: 0.5, cycle: 0.2, taxi: 3.5, auto: 1.3, scooterP: 0.6, suv: 1.4, sedan: 1.3 };
    if (h < 7) return { bus: 0.6, tempo: 1.8, cycle: 2.5, taxi: 1.5 };
    if (h >= 21) return { bus: 0.6, taxi: 2.2, tempo: 0.6, cycle: 0.5, auto: 1.15 };
    // the school runs: the school autos and vans, a parent with a child on the back of the scooter
    if ((h >= 7 && h < 8.75) || (h >= 12.5 && h < 13.75)) return { auto: 1.5, scooterP: 1.7, cycle: 1.4, bus: 1.2 };
    // the evening rush home: everyone on two wheels
    if (h >= 17.5 && h < 20.5) return { scooter: 1.25, bike: 1.25, scooterP: 1.2, cycle: 0.7 };
    return {};
  }
  randomLink(px, pz, rMin, rMax) {
    // roads around you (cached, refreshed as you move): picking from the whole city's graph would
    // almost never land near you once all of Pune is loaded
    // one cache per radius: the spawner asks for two (round you, and down the road ahead)
    const C = (this._nearC = this._nearC || {})[rMax] || (this._nearC[rMax] = { list: null, x: 0, z: 0 });
    if (!C.list || Math.hypot(px - C.x, pz - C.z) > 60) { C.list = [...this.graph.gridQuery(px, pz, rMax)]; C.x = px; C.z = pz; }
    const edges = C.list.length ? C.list : this.graph.liveEdges;
    for (let tries = 0; tries < 40; tries++) {
      const e = edges[Math.floor(this.rng.next() * edges.length)];
      if (e.rank < 2) continue;
      if (this.rng.next() > [0, 0, 0.2, 0.45, 0.8, 1, 1][e.rank]) continue;
      const s = this.rng.range(2, Math.max(2.1, e.len - 2));
      this.graph.at(e, s, tmpA);
      const d = Math.hypot(tmpA[0] - px, tmpA[1] - pz);
      if (d < rMin || d > rMax) continue;
      const dir = e.oneway ? 1 : (this.rng.chance(0.5) ? 1 : -1);
      return { l: { e, dir }, s: dir > 0 ? s : e.len - s, x: tmpA[0], z: tmpA[1] };
    }
    return null;
  }
  spawn(px, pz, rMin, rMax, avoidView, ox = px, oz = pz, oMin = 0) {
    const r = this.randomLink(px, pz, rMin, rMax);
    if (!r) return null;
    if (oMin && Math.hypot(r.x - ox, r.z - oz) < oMin) return null;
    if (avoidView && avoidView(r.x, r.z)) return null;
    for (const o of this.list) if (Math.abs(o.x - r.x) < 9 && Math.abs(o.z - r.z) < 9) return null;
    const type = this.pickType(r.l);
    const T = TYPES[type];
    // never drop a bus or truck right on top of the player's camera
    if (T.L > 5 && Math.hypot(r.x - ox, r.z - oz) < 45) return null;
    const v = this.pool.pop() || {};
    const [lo, hi] = latBounds(r.l);
    Object.assign(v, {
      type, T, l: r.l, s: r.s, lat: this.rng.range(lo, hi), latT: 0, v: 0, vMul: this.rng.range(T.vMul[0], T.vMul[1]),
      next: null, jc: null, x: r.x, z: r.z, hx: 1, hz: 0, yaw: 0, roll: 0, pitch: 0, stuck: 0, honkT: this.rng.range(2, 12),
      ignore: null, ignoreT: 0, fallen: 0, alive: true, redRunner: this.rng.chance(T.two ? 0.12 : 0.03), id: Math.floor(this.rng.next() * 1e9),
      col: null, colB: null, colC: null, angry: 0, prevV: 0,
    });
    v.latT = v.lat; v.dwell = 0; v.stopAt = null; v.lastStop = null;
    v.v = SPEED_BY_RANK[r.l.e.rank] * v.vMul * this.rng.range(0.3, 0.8);
    // colours
    const P = PAINTS;
    const pick = (a) => a[Math.floor(this.rng.next() * a.length)].map(lin);
    if (type === 'auto') v.col = [lin(0.12), lin(0.12), lin(0.12)];
    else if (type === 'taxi') v.col = [lin(0.96), lin(0.96), lin(0.95)];
    else if (type === 'tempo') v.col = pick(P.tempo);
    else if (type === 'bus') v.col = [1, 1, 1];
    else if (T.two) v.col = pick(P.two);
    else v.col = pick(P.car);
    v.colB = type === 'auto' ? [0.62, 0.55, 0.4] : pick(P.shirt); v.colC = pick(P.helmet);   // Pune auto drivers wear khaki
    this.place(v, 0);
    this.list.push(v);
    return v;
  }
  despawn(i) {
    const v = this.list[i];
    v.alive = false;
    this.list[i] = this.list[this.list.length - 1];
    this.list.pop();
    this.pool.push(v);
  }

  // ---------------------------------------------------------------- routing
  chooseNext(v) {
    const node = this.graph.nodes[linkEnd(v.l)];
    if (node.portal) return null;
    const outs = node.out;
    linkAt(this.graph, v.l, linkLen(v.l), tmpA);
    const inx = tmpA[2], inz = tmpA[3];
    let best = null, tot = 0;
    const cands = [];
    for (const o of outs) {
      if (o.e === v.l.e) continue;     // no U-turns unless dead end
      if (o.e.rank < 2) continue;
      if (TYPES[v.type].mainOnly && o.e.rank < 4) continue;
      linkAt(this.graph, o, 0, tmpB);
      const dot = inx * tmpB[2] + inz * tmpB[3];
      const cross = inx * tmpB[3] - inz * tmpB[2];
      let w = Math.pow(o.e.rank + 1, 1.4);
      if (dot > 0.8) w *= 3;
      else if (dot < -0.3) w *= 0.25;
      if (this.graph.nodes[linkEnd(o)].portal) w *= 0.5;
      cands.push([o, w, cross, dot]);
      tot += w;
    }
    if (!cands.length) {
      // dead end: turn around if allowed
      const back = outs.find(o => o.e === v.l.e);
      return back ? { l: back, turn: Math.PI } : null;
    }
    let x = this.rng.next() * tot;
    for (const c of cands) { x -= c[1]; if (x <= 0) { best = c; break; } }
    best = best || cands[0];
    return { l: best[0], turn: Math.atan2(best[2], best[3]) };
  }

  // build the junction connector curve from current position to the next link
  startJunction(v) {
    const n = v.next;
    const node = this.graph.nodes[linkEnd(v.l)];
    const r = Math.min(node.jr, n.l.e.len * 0.45);
    linkAt(this.graph, n.l, r, tmpB);
    const [lo, hi] = latBounds(n.l);
    let lat2 = clamp(v.lat, lo, hi);
    // turning left: hug the kerb, turning right: stay toward centre
    if (n.turn < -0.6) lat2 = lerp(lat2, hi, 0.5);
    else if (n.turn > 0.6) lat2 = lerp(lat2, lo, 0.6);
    const p2x = tmpB[0] + tmpB[3] * lat2, p2z = tmpB[1] - tmpB[2] * lat2;
    const p0x = v.x, p0z = v.z;
    // control point: intersect the two tangents (fallback midpoint)
    const d0x = v.hx, d0z = v.hz, d2x = tmpB[2], d2z = tmpB[3];
    const den = d0x * d2z - d0z * d2x;
    let cx, cz;
    if (Math.abs(den) > 0.15) {
      const t = ((p2x - p0x) * d2z - (p2z - p0z) * d2x) / den;
      cx = p0x + d0x * t; cz = p0z + d0z * t;
      if (t < 0 || t > 40) { cx = (p0x + p2x) / 2; cz = (p0z + p2z) / 2; }
    } else { cx = (p0x + p2x) / 2; cz = (p0z + p2z) / 2; }
    // approximate length
    let L = 0, px = p0x, pz = p0z;
    for (let k = 1; k <= 8; k++) {
      const t = k / 8, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      const x = a * p0x + b * cx + c * p2x, z = a * p0z + b * cz + c * p2z;
      L += Math.hypot(x - px, z - pz); px = x; pz = z;
    }
    v.jc = { p0x, p0z, cx, cz, p2x, p2z, L: Math.max(0.5, L), t: 0, s2: r, lat2, turn: n.turn };
  }

  // ---------------------------------------------------------------- per-frame update
  update(dt, px, pz, avoidView) {
    this.time += dt;
    this.signals.update(dt);
    // how fast and which way the player is going: at speed the road ahead has to be full when you get there
    if (this._px === undefined) { this._px = px; this._pz = pz; this._sp = 0; this._hx = 1; this._hz = 0; }
    const mdx = px - this._px, mdz = pz - this._pz, md = Math.hypot(mdx, mdz);
    this._px = px; this._pz = pz;
    if (md < 50 && dt > 0) {          // a teleport (fast travel) isn't speed
      this._sp += (md / dt - this._sp) * Math.min(1, dt * 2);
      if (md > 0.02) { this._hx += (mdx / md - this._hx) * Math.min(1, dt * 3); this._hz += (mdz / md - this._hz) * Math.min(1, dt * 3); const n = Math.hypot(this._hx, this._hz) || 1; this._hx /= n; this._hz /= n; }
    }
    const sp = this._sp, fast = sp > 7, hx = this._hx, hz = this._hz;
    // keep population
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      const dx = v.x - px, dz = v.z - pz, d = Math.hypot(dx, dz);
      // at speed, what you've left behind goes (out of sight) so the budget moves to the road ahead
      const behind = fast && dx * hx + dz * hz < -0.3 * d && d > 110 && (!avoidView || !avoidView(v.x, v.z));
      if ((d > 300 && !(avoidView && avoidView(v.x, v.z) && d < 420)) || !v.alive || behind) this.despawn(i);
    }
    // fewer vehicles at 3 am than at 6 pm; the far ones drop out as it thins
    const target = Math.round(this.max * curve(TRAFFIC, this.hour));
    for (let i = this.list.length - 1; i >= 0 && this.list.length > target * 1.1; i--) {
      const v = this.list[i];
      if (Math.hypot(v.x - px, v.z - pz) > 150 && (!avoidView || !avoidView(v.x, v.z))) this.despawn(i);
    }
    let tries = 8 + Math.min(16, Math.round(sp));
    while (this.list.length < target && tries-- > 0) {
      const urgent = this.list.length < target * 0.5;
      if (fast && this.rng.next() < 0.8) {
        // ahead: around a point 6-8 s down the road, never closer than 70 m and never in plain view
        // (the view check alone would refuse the whole road ahead: in view is fine past 140 m, where a car is a speck in the haze)
        const look = Math.min(sp * 7, 200);
        const hidden = avoidView ? (x, z) => avoidView(x, z) && Math.hypot(x - px, z - pz) < 140 : null;
        this.spawn(px + hx * look, pz + hz * look, 0, 170, hidden, px, pz, 70);
      } else {
        // never out of thin air where you can see: even when the streets are empty, a new vehicle starts
        // round a corner or past 140 m, where it's a speck in the haze
        const hidden = avoidView ? (x, z) => avoidView(x, z) && Math.hypot(x - px, z - pz) < 140 : null;
        this.spawn(px, pz, urgent ? 50 : 80, 240, hidden);
      }
    }
    this._seen = avoidView ? (x, z) => avoidView(x, z) && Math.hypot(x - px, z - pz) < 160 : null;
    this.buildGrid();
    for (const v of this.list) {
      const px = v.x, pz = v.z;
      this.step(v, dt);
      // what you see moves smoothly even when the simulation shifts lanes or snaps onto a junction curve in one
      // step: the jump becomes an offset that fades out in a fraction of a second; the heading eases after the sim's
      if (v.rx === undefined || v._fresh !== v.id) { v._fresh = v.id; v.offX = v.offZ = 0; v.ryaw = v.yaw; }
      else {
        const sp = Math.abs(v.v || 0) * dt, hx = Math.cos(v.yaw), hz = Math.sin(v.yaw), dx = v.x - px, dz = v.z - pz;
        const jx = dx - hx * sp * Math.sign(v.v || 1), jz = dz - hz * sp * Math.sign(v.v || 1), j = Math.hypot(jx, jz);
        if (j > 0.06 && j < 6) { v.offX -= jx; v.offZ -= jz; } else if (j >= 6) { v.offX = v.offZ = 0; v.ryaw = v.yaw; }
        const k = Math.exp(-dt * 7); v.offX *= k; v.offZ *= k;
        v.ryaw += Math.atan2(Math.sin(v.yaw - v.ryaw), Math.cos(v.yaw - v.ryaw)) * (1 - Math.exp(-dt * 14));
      }
      v.rx = v.x + v.offX; v.rz = v.z + v.offZ;
    }
    this.render();
  }
  prefill(px, pz) {
    const target = Math.round(this.max * curve(TRAFFIC, this.hour));
    for (let k = 0; k < this.max * 6 && this.list.length < target; k++) this.spawn(px, pz, 22, 240, null);
    // let them settle
    for (let k = 0; k < 40; k++) { this.buildGrid(); for (const v of this.list) this.step(v, 0.1); }
  }

  // parked cars / auto stands on the carriageway: obstacles the traffic has to steer around
  setStatics(list) { this.statics = list; this.staticsNear = []; this.staticsT = 0; }
  buildGrid() {
    const g = this.grid;
    g.clear();
    const c = this.cell;
    const put = (a) => {
      const key = Math.floor(a.x / c) * 73856 + Math.floor(a.z / c);
      let l = g.get(key); if (!l) g.set(key, l = []);
      l.push(a);
    };
    for (const v of this.list) put(v);
    if (this.player && !(this.player.y > 2.2)) put(this.player.agent);     // up on a flyover: not in the street's way
    if (this.extra) for (const a of this.extra) put(a);
    if (this.peds) for (const p of this.peds.roadAgents()) put(p);
    if (this.statics) {
      if ((this.staticsT -= 1 / 60) <= 0 && this.player) {
        this.staticsT = 1;
        const px = this.player.x, pz = this.player.z;
        this.staticsNear = this.statics.filter(s => Math.abs(s.x - px) < 320 && Math.abs(s.z - pz) < 320);
      }
      for (const s of this.staticsNear) put(s);
    }
  }
  near(x, z, r, cb) {
    const c = this.cell;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.grid.get(i * 73856 + j);
      if (l) for (const a of l) cb(a);
    }
  }

  // nearest obstacle in a lateral corridor ahead: returns {gap, v, agent}
  scan(v, latOffset, look) {
    const T = v.T;
    const hx = v.hx, hz = v.hz, nx = hz, nz = -hx;     // n = driver's left
    const cx = v.x + nx * latOffset, cz = v.z + nz * latOffset;
    let best = null;
    this.near(v.x + hx * look * 0.5, v.z + hz * look * 0.5, look * 0.6 + 4, (o) => {
      if (o === v || (v.ignore && o === v.ignore && v.ignoreT > 0)) return;
      const rx = o.x - cx, rz = o.z - cz;
      const along = rx * hx + rz * hz;
      if (along <= 0 || along > look) return;
      const side = rx * nx + rz * nz;
      const ow = o.W !== undefined ? o.W : o.T.W;
      const oL = o.L !== undefined ? o.L : o.T.L;
      // project other's extent sideways when it's crossing our path
      const ohx = o.hx ?? 1, ohz = o.hz ?? 0;
      const cross = Math.abs(ohx * nx + ohz * nz);
      const halfO = ow / 2 * (1 - cross) + oL / 2 * cross;
      if (Math.abs(side) > T.W / 2 + halfO + 0.22) return;
      const gap = along - T.L / 2 - (oL / 2 * (1 - cross) + ow / 2 * cross);
      if (!best || gap < best.gap) {
        const ov = (o.v || 0) * (ohx * hx + ohz * hz);
        best = { gap, v: ov, agent: o, side };
      }
    });
    return best;
  }

  busStop(v, vDes, dt) {
    if (v.dwell > 0) { v.dwell -= dt; return 0; }
    if ((v.bsT = (v.bsT || 0) - dt) <= 0) {
      v.bsT = 0.5; v.stopAt = null;
      const I = this.W.index, ci = I ? I.chunkOf(v.x, v.z) : -1, C = ci >= 0 ? I.chunks[ci] : null, L = C && C.buses;
      if (L) for (const b of L) {
        if (b === v.lastStop) continue;
        const sx = b[0] / 100, sz = b[1] / 100, dx = sx - v.x, dz = sz - v.z, ah = dx * v.hx + dz * v.hz, sd = dx * v.hz - dz * v.hx;
        if (ah > 1 && ah < 40 && sd > -1 && sd < 9) { v.stopAt = { b, sx, sz }; break; }
      }
    }
    const S = v.stopAt; if (!S) return vDes;
    v.latT = latBounds(v.l)[1];
    const ah = (S.sx - v.x) * v.hx + (S.sz - v.z) * v.hz;
    if (ah < 2) { v.dwell = 7 + this.rng.next() * 9; v.lastStop = S.b; v.stopAt = null; return 0; }
    return Math.min(vDes, 1.2 + ah * 0.35);
  }
  step(v, dt) {
    const T = v.T;
    if (v.wreck) { v.v = 0; v.rich = false; return; }                 // a burnt shell: just an obstacle now
    if (v.fallen > 0) { v.fallen -= dt; v.v = 0; return; }
    if (v.argue > 0) { v.argue -= dt; v.v = 0; return; }            // its driver's out, having words with you
    if (v.ignoreT > 0) v.ignoreT -= dt;
    if (v.angry > 0) v.angry -= dt;
    if (v.honkT > 0) v.honkT -= dt;
    // --- desired speed
    const e = v.l.e;
    let vDes = SPEED_BY_RANK[e.rank] * v.vMul;
    if (!v.jc) {
      // slow for upcoming turn
      const remain = e.len - v.s;
      if (!v.next && remain < 30) v.next = this.chooseNext(v);
      if (v.next && Math.abs(v.next.turn) > 0.5) {
        const turnV = 3.2 + (1 - Math.min(1, Math.abs(v.next.turn) / 1.6)) * 5;
        if (remain < 25) vDes = Math.min(vDes, lerp(turnV, vDes, clamp((remain - 6) / 19, 0, 1)));
      }
    } else if (Math.abs(v.jc.turn) > 0.5) vDes = Math.min(vDes, 3.5 + (1 - Math.min(1, Math.abs(v.jc.turn) / 1.6)) * 5);
    // rubberneckers: everyone crawls past a crash, a fight, someone down in the road, to have a good look
    const gk = this.gawk;
    if (gk && gk.length) for (let i = 0; i < gk.length; i++) { const dx = gk[i].x - v.x, dz = gk[i].z - v.z, d2 = dx * dx + dz * dz; if (d2 < 900) vDes = Math.min(vDes, 2.4 + Math.sqrt(d2) * 0.12); }
    // buses pull in to the kerb at their stops and sit there a while (and the traffic behind goes round)
    if (v.type === 'bus' && !v.jc) vDes = this.busStop(v, vDes, dt);
    // a siren or a beacon coming up behind: over to the kerb and slow (your police duty, or the garage's laal batti)
    const Y = this.yieldTo;
    if (Y && !v.jc) {
      const dx = v.x - Y.x, dz = v.z - Y.z, along = dx * Y.hx + dz * Y.hz;
      if (along > 2 && along < 55 && Math.abs(-dx * Y.hz + dz * Y.hx) < 7 && (v.hx * Y.hx + v.hz * Y.hz) > 0.4) { v.latT = latBounds(v.l)[1]; vDes = Math.min(vDes, 2.2); }
    }
    // --- obstacles
    const look = 7 + v.v * 2.4;
    const ob = this.scan(v, 0, look);
    let gap = 999, vo = 0, agent = null;
    if (ob) { gap = ob.gap; vo = ob.v; agent = ob.agent; }
    // signal stop line
    if (!v.jc) {
      const endNode = this.graph.nodes[linkEnd(v.l)];
      if (endNode.signal) {
        const st = this.signals.state(endNode.i, v.l);
        const stopAt = e.len - Math.min(endNode.jr, e.len * 0.45) - 3.5;
        const dStop = stopAt - v.s;
        const freeLeft = v.next && v.next.turn < -0.6;
        if (st !== 'g' && !freeLeft && dStop > -1 && dStop < 60) {
          const canStop = v.v * v.v / (2 * T.B) < dStop + 1;
          if (!(st === 'a' && !canStop) && !(v.redRunner && st === 'r' && this.signals.crossClear(endNode.i))) {
            if (dStop < gap) { gap = Math.max(0, dStop); vo = 0; agent = null; }
          }
        }
      }
    }
    // --- IDM
    const dv = v.v - vo;
    const sStar = T.s0 + v.v * T.T + (v.v * dv) / (2 * Math.sqrt(T.A * T.B));
    let acc = T.A * (1 - Math.pow(v.v / Math.max(0.5, vDes), 4) - Math.pow(Math.max(0, sStar) / Math.max(0.1, gap), 2));
    acc = clamp(acc, -T.B * 1.8, T.A);
    v.prevV = v.v;
    v.v = Math.max(0, v.v + acc * dt);
    if (gap < 0.2) v.v = Math.min(v.v, 0.3);
    // --- weaving: look for a gap beside the slow thing in front
    if (!v.jc && ob && ob.gap < 9 && (vo < v.v - 0.5 || vo < 1.0) && this.rng.next() < T.agile * dt * 3) {
      const [lo, hi] = latBounds(v.l);
      const half = T.W / 2 + (ob.agent.W ?? ob.agent.T?.W ?? 1) / 2 + 0.3;
      const opts = [v.lat + ob.side - half, v.lat + ob.side + half];   // pass on its right, or its left
      if (this.rng.next() < 0.35) opts.reverse();
      for (const nl of opts) {
        if (nl < lo || nl > hi) continue;
        const o2 = this.scan(v, nl - v.lat, look + 6);
        if (!o2 || o2.gap > ob.gap + 6) { v.latT = nl; break; }
      }
    }
    // drift back toward a comfortable lane position when free
    if (!v.jc && (!ob || ob.gap > 25)) {
      const [lo, hi] = latBounds(v.l);
      const pref = e.oneway ? lerp(lo, hi, T.two ? 0.75 : 0.45) : lerp(lo, hi, T.two ? 0.7 : 0.35);
      v.latT = lerp(v.latT, pref, dt * 0.08);
    }
    // --- stuck handling (deadlocks in junctions)
    if (v.v < 0.25 && agent && agent.v !== undefined && agent.v < 0.25) {
      v.stuck += dt;
      if (v.stuck > 4.5 + (v.id % 5)) {
        if (agent.parked && !v.jc) {
          // squeeze past a parked car, even if it means a moment on the wrong side of the road
          const [lo, hi] = latBounds(v.l);
          const half = T.W / 2 + agent.W / 2 + 0.35;
          v.latT = Math.max(Math.min(lo, 0) - (v.l.e.oneway ? 0 : v.l.e.w * 0.2), v.lat + (ob ? ob.side : 0) - half);
          v.stuck = 0;
        } else { v.ignore = agent; v.ignoreT = 2.5; v.stuck = 0; }
      }
    } else v.stuck = Math.max(0, v.stuck - dt);
    // --- honking
    v.honkT -= dt;
    if (v.honkT <= 0) {
      const blocked = ob && ob.gap < 10 && vo < 1.5;
      const isPlayer = agent && agent.isPlayer;
      if (blocked || isPlayer || this.rng.next() < 0.15) {
        this.honks.push({ x: v.x, z: v.z, kind: T.honk, n: blocked ? this.rng.int(1, 3) : 1 });
      }
      v.honkT = blocked ? this.rng.range(1.2, 4) : this.rng.range(6, 22);
    }
    // --- move
    const ds = v.v * dt;
    const latRate = (T.two ? 1.5 : 0.9) * dt;
    v.lat += clamp(v.latT - v.lat, -latRate, latRate);
    if (v.jc) {
      const j = v.jc;
      j.t += ds / j.L;
      if (j.t >= 1) {
        const over = (j.t - 1) * j.L;
        v.l = v.next.l; v.s = j.s2 + over; v.lat = j.lat2; v.latT = j.lat2; v.next = null; v.jc = null;
        if (this.graph.nodes[linkStart(v.l)].portal && v.l.e.len < 5) v.alive = false;
      }
    } else {
      v.s += ds;
      const node = this.graph.nodes[linkEnd(v.l)];
      const r = Math.min(node.jr, e.len * 0.45);
      if (v.s >= e.len - r) {
        if (!v.next) v.next = this.chooseNext(v);
        // the end of the streets streamed in so far: only drop out where nobody's looking, else wait there
        if (!v.next) { if (this._seen && this._seen(v.x, v.z)) { v.s = e.len - r; v.v = 0; return; } v.alive = false; return; }
        if (v.next.l.e === v.l.e && v.next.l.dir !== v.l.dir) {
          // U-turn at dead end
          v.l = v.next.l; v.s = Math.max(0.5, e.len - v.s); v.next = null;
        } else this.startJunction(v);
      }
    }
    this.place(v, dt);
  }

  place(v, dt) {
    let x, z, hx, hz;
    if (v.jc) {
      const j = v.jc, t = clamp(j.t, 0, 1);
      const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
      x = a * j.p0x + b * j.cx + c * j.p2x; z = a * j.p0z + b * j.cz + c * j.p2z;
      hx = 2 * (1 - t) * (j.cx - j.p0x) + 2 * t * (j.p2x - j.cx);
      hz = 2 * (1 - t) * (j.cz - j.p0z) + 2 * t * (j.p2z - j.cz);
      const L = Math.hypot(hx, hz) || 1; hx /= L; hz /= L;
    } else {
      linkAt(this.graph, v.l, v.s, tmpA);
      hx = tmpA[2]; hz = tmpA[3];
      x = tmpA[0] + hz * v.lat; z = tmpA[1] - hx * v.lat;
    }
    // smooth heading and lean
    const yaw = Math.atan2(hz, hx);
    if (dt > 0) {
      const dy = wrapAngle(yaw - v.yaw);
      const yawRate = dy / dt;
      v.yaw += dy * Math.min(1, dt * 12);
      const latAcc = clamp(v.v * yawRate, -6, 6);
      const targetRoll = v.T.two ? clamp(Math.atan(latAcc / 9.8), -0.45, 0.45) : clamp(-latAcc * 0.012, -0.05, 0.05);
      v.roll += (targetRoll - v.roll) * Math.min(1, dt * 6);
      const lonAcc = (v.v - v.prevV) / dt;
      v.pitch += (clamp(lonAcc * 0.006, -0.03, 0.03) - v.pitch) * Math.min(1, dt * 5);
    } else v.yaw = yaw;
    v.hx = Math.cos(v.yaw); v.hz = Math.sin(v.yaw);
    v.x = x; v.z = z;
    v.y = this.W.surf.isRoad(x, z) ? 0 : 0.15;
  }

  render() {
    for (const k in this.inst) { this.inst[k].n = 0; this.inst[k].nl = 0; }
    const m = this.mtx, q = this.q, e = this.eul, p = this.v3, s = this.s3;
    const cx = this.cam.x, cz = this.cam.z, L2 = this.lodDist * this.lodDist;
    // the riders you're right next to (close, slow): real people on an empty model instead of the baked figures
    let nr = 0;
    for (const v of this.list) {
      // every two-wheeler and auto within the radius (no speed or count limit; 14 at most, a safety net)
      const R = this.richR || 28;
      const near = (v.x - cx) * (v.x - cx) + (v.z - cz) * (v.z - cz) < R * R && /^(scooter|bike|auto)/.test(v.type) && !(v.fallen > 0);
      v.rich = near && nr < 14 ? (nr++, true) : false;
    }
    for (const v of this.list) {
      const seated = v.wreck || (v.rich && v._riders && v._riders.every(r => r.body));
      const I = this.inst[seated ? v.type.replace(/P$/, '') + 'E' : v.type] || this.inst[v.type];
      const far = (v.x - cx) * (v.x - cx) + (v.z - cz) * (v.z - cz) > L2;
      const roll = v.fallen > 0 ? 1.3 : v.roll;
      e.set(roll, -(v.ryaw ?? v.yaw), v.pitch, 'YXZ');
      q.setFromEuler(e);
      p.set(v.rx ?? v.x, (v.y || 0) + (v.fallen > 0 ? 0.3 : 0), v.rz ?? v.z);
      m.compose(p, q, s);
      const mesh = far ? I.low : I.body;
      const i = far ? I.nl : I.n;
      if (i >= I.cap) continue;
      mesh.setMatrixAt(i, m);
      // damage shows: soot past a fifth, a burnt shell when it's gone up
      const dk = v.wreck ? 0.07 : v.dmg > 0.2 ? 1 - (v.dmg - 0.2) * 0.55 : 1;
      mesh.instanceColor.setXYZ(i, v.col[0] * dk, v.col[1] * dk, v.col[2] * dk);
      mesh.geometry.attributes.aColB.setXYZ(i, v.colB[0] * dk, v.colB[1] * dk, v.colB[2] * dk);
      mesh.geometry.attributes.aColC.setXYZ(i, v.colC[0] * dk, v.colC[1] * dk, v.colC[2] * dk);
      if (far) I.nl++;
      else { if (I.glass) I.glass.setMatrixAt(i, m); I.n++; }
    }
    for (const k in this.inst) {
      const I = this.inst[k];
      for (const [mesh, n] of [[I.body, I.n], [I.low, I.nl]]) {
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.geometry.attributes.aColB.needsUpdate = true;
        mesh.geometry.attributes.aColC.needsUpdate = true;
      }
      if (I.glass) { I.glass.count = I.n; I.glass.instanceMatrix.needsUpdate = true; }
    }
  }
}

// ---------------------------------------------------------------- traffic signals
// Each signalised junction rotates green between its approach arms; left turns are free.
class Signals {
  constructor(W) {
    this.W = W;
    this.g = W.graph;
    this.j = new Map();
    this.rng = new RNG(99);
    this.addNodes(this.g.nodes.map(n => n.i));
    this.heads = [];
  }
  // (re)build the junctions at these nodes: at start, and when a tile's roads arrive or leave
  addNodes(list) {
    const rng = this.rng;
    for (const i of list) {
      const n = this.g.nodes[i];
      this.j.delete(i);
      if (!n || !n.signal) continue;
      const arms = [];
      for (const l of n.inc) {
        // incoming direction at the node
        const tmp = [0, 0, 0, 0];
        if (l.dir > 0) this.g.at(l.e, l.e.len, tmp); else { this.g.at(l.e, 0, tmp); tmp[2] = -tmp[2]; tmp[3] = -tmp[3]; }
        const ang = Math.atan2(tmp[3], tmp[2]);
        let arm = arms.find(a => Math.abs(wrapAngle(a.ang - ang)) < 0.5);
        if (!arm) { arm = { ang, links: [] }; arms.push(arm); }
        arm.links.push(l.e.i * 2 + (l.dir > 0 ? 1 : 0));
      }
      if (arms.length < 2) continue;
      // pair opposite arms into one phase when the junction is a simple crossroad
      const phases = [];
      const used = new Set();
      for (const a of arms) {
        if (used.has(a)) continue;
        const opp = arms.find(b => b !== a && !used.has(b) && Math.abs(wrapAngle(b.ang - a.ang - Math.PI)) < 0.45);
        used.add(a);
        const ph = { links: new Set(a.links), angs: [a.ang] };
        if (opp && arms.length >= 4) { used.add(opp); opp.links.forEach(x => ph.links.add(x)); ph.angs.push(opp.ang); }
        phases.push(ph);
      }
      this.j.set(n.i, { phases, cur: rng.int(0, phases.length - 1), t: rng.range(0, 15), green: rng.range(16, 26), amber: 3, allRed: 1.2 });
    }
  }
  update(dt) {
    for (const s of this.j.values()) {
      s.t += dt;
      if (s.t > s.green + s.amber + s.allRed) { s.t = 0; s.cur = (s.cur + 1) % s.phases.length; }
    }
  }
  phaseState(s, linkKey) {
    const ph = s.phases[s.cur];
    if (!ph.links.has(linkKey)) return 'r';
    if (s.t < s.green) return 'g';
    if (s.t < s.green + s.amber) return 'a';
    return 'r';
  }
  state(nodeIdx, l) {
    const s = this.j.get(nodeIdx);
    if (!s) return 'g';
    return this.phaseState(s, l.e.i * 2 + (l.dir > 0 ? 1 : 0));
  }
  // state for a direction of travel (heading angle) approaching a node: used by signal heads & player checks
  stateForAngle(nodeIdx, ang) {
    const s = this.j.get(nodeIdx);
    if (!s) return null;
    for (let k = 0; k < s.phases.length; k++) {
      const ph = s.phases[k];
      if (ph.angs.some(a => Math.abs(wrapAngle(a - ang)) < 0.6)) {
        if (k !== s.cur) return 'r';
        if (s.t < s.green) return 'g';
        if (s.t < s.green + s.amber) return 'a';
        return 'r';
      }
    }
    return null;
  }
  crossClear(nodeIdx) { const s = this.j.get(nodeIdx); return s ? s.t > s.green + 0.5 : true; }
}
