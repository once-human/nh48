// Parked vehicles: rows of scooters and bikes nosed into the kerb, cars along lanes,
// and auto stands near bus stops. Instanced with near/far LOD and distance culling.
import * as THREE from 'three';
import { buildScooter, buildBike, buildCar, buildAuto, buildLow, PAINTS } from '../vehicles/models.js';
import { InstancedSet, compose, yawX } from '../world/props.js';
import { RNG } from '../core/util.js';
import { lin } from '../world/geo.js';

export function buildParked(W, scene, vmats, quality) {
  const rng = new RNG(5150);
  const near = 60, far = Math.max(140, quality.propRange);
  const kinds = {
    scooter: buildScooter({ parked: true }).body, bike: buildBike({ parked: true }).body,
    hatch: buildCar('hatch'), sedan: buildCar('sedan'), suv: buildCar('suv'),
    auto: buildAuto({ withWheels: true }),
  };
  const sets = {};
  const mk = (k, geoNear, glassGeo, low, cap, capFar) => {
    const sN = new InstancedSet(scene, geoNear, vmats.body, cap, near, { cast: quality.shadows, color: true });
    const sF = new InstancedSet(scene, low, vmats.body, capFar, far, { minRange: near, color: true });
    let sG = null;
    if (glassGeo && glassGeo.attributes.position.count) sG = new InstancedSet(scene, glassGeo, vmats.glass, cap, near, {});
    for (const s of [sN, sF]) {
      s.mesh.geometry = s.mesh.geometry.clone();
      s.mesh.geometry.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array(s.capacity * 3).fill(1), 3));
      s.mesh.geometry.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array(s.capacity * 3).fill(1), 3));
    }
    sets[k] = { sN, sF, sG };
  };
  // capacities are the most instances visible at once (near ring / far ring)
  mk('scooter', kinds.scooter, null, buildLow('scooter', true), 520, 1100);
  mk('bike', kinds.bike, null, buildLow('bike', true), 260, 520);
  for (const c of ['hatch', 'sedan', 'suv']) mk(c, kinds[c].body, kinds[c].glass, buildLow(c), 60, 120);
  mk('auto', kinds.auto.body, kinds.auto.glass, buildLow('auto'), 80, 120);
  const m = new THREE.Matrix4();
  // every parked vehicle is recorded so the player can take it (hide its instances + colliders)
  W.parkedList = [];
  const add = (k, x, z, dx, dz, col) => {
    compose(x, W.surf.isRoad(x, z) ? 0 : 0.15, z, yawX(dx, dz), 1, 1, 1, 0, 0, m);
    const S = sets[k];
    const rec = { kind: k, x, z, hx: dx, hz: dz, col, items: [S.sN.add(x, z, m, col), S.sF.add(x, z, m, col)], circles: [], taken: false };
    if (S.sG) rec.items.push(S.sG.add(x, z, m));
    W.parkedList.push(rec);
    return rec;
  };
  const pick = (a) => rng.pick(a).map(lin);
  const statics = [];        // parked cars sit on the road: traffic sees them as stopped vehicles
  // a tile's parked vehicles (all of them at once for the single map)
  const addTile = (D, tag) => {
  InstancedSet.tag = tag;
  const n0 = W.parkedList.length, s0 = statics.length;
  for (const p of D.parked) {
    const x = p[0] / 100, z = p[1] / 100, ang = p[2], kind = p[3], n = p[4], side = p[5];
    const mask = p[6] ?? ((1 << n) - 1);
    const tx = Math.cos(ang), tz = Math.sin(ang);          // along the kerb
    if (kind === 1) {
      const k = rng.weighted(['hatch', 'sedan', 'suv'], [5, 3, 2]);
      const rec = add(k, x, z, tx, tz, pick(PAINTS.car));
      rec.circles.push(W.collision.addCircle(x + tx * 1.1, z + tz * 1.1, 0.85, 2), W.collision.addCircle(x - tx * 1.1, z - tz * 1.1, 0.85, 2));
      rec.static = { x, z, hx: tx, hz: tz, v: 0, W: 1.8, L: k === 'hatch' ? 3.7 : 4.4, parked: true };
      statics.push(rec.static);
      continue;
    }
    // two-wheeler row: nosed in at ~60 degrees to the kerb, 0.85 m apart
    const k = kind === 2 ? 'bike' : 'scooter';
    const kerbIn = [-tz * side, tx * side];       // toward the building side
    const a = 1.05;                               // rotation from the kerb line
    const hx = tx * Math.cos(a) + kerbIn[0] * Math.sin(a), hz = tz * Math.cos(a) + kerbIn[1] * Math.sin(a);
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;            // gap in the row (tree, lamp post, a scooter just left)
      const o = (i - (n - 1) / 2) * 0.85;
      const px = x + tx * o, pz = z + tz * o;
      const rec = add(k, px, pz, hx, hz, pick(PAINTS.two));
      rec.circles.push(W.collision.addCircle(px, pz, 0.45, 2));
    }
  }
  for (let k = n0; k < W.parkedList.length; k++) W.parkedList[k].tag = tag;
  for (let k = s0; k < statics.length; k++) statics[k].tag = tag;
  InstancedSet.tag = 0;
  };
  addTile(W.M, 0);
  // auto stands: rows of autos waiting near bus stops
  for (const b of W.M.buses) {
    if (rng.next() > 0.45) continue;
    const x = b[0] / 100, z = b[1] / 100, a = b[2];
    const fx = Math.cos(a), fz = Math.sin(a);          // faces the road
    const tx = -fz, tz = fx;                           // along the kerb
    const n = rng.int(3, 6);
    for (let i = 0; i < n; i++) {
      const o = 7 + i * 2.9;
      const px = x + fx * 1.6 + tx * o, pz = z + fz * 1.6 + tz * o;
      if (!W.surf.isRoad(px, pz)) continue;
      const rec = add('auto', px, pz, -tx, -tz, [lin(0.12), lin(0.12), lin(0.12)]);
      rec.circles.push(W.collision.addCircle(px, pz, 0.8, 2), W.collision.addCircle(px - tx * 0.9, pz - tz * 0.9, 0.7, 2));
      rec.static = { x: px, z: pz, hx: -tx, hz: -tz, v: 0, W: 1.4, L: 2.7, parked: true };
      statics.push(rec.static);
    }
  }
  const all = [];
  for (const k in sets) { const S = sets[k]; all.push(S.sN, S.sF); if (S.sG) all.push(S.sG); }
  const removeTile = (tag) => {
    for (const S of all) S.removeTag(tag);
    W.parkedList = W.parkedList.filter(r => r.tag !== tag);
    for (let k = statics.length - 1; k >= 0; k--) if (statics[k].tag === tag) statics.splice(k, 1);
  };
  return { sets: all, statics, addTile, removeTile };
}
