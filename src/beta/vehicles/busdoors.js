// The bus's doors open. Each doorway (front and middle, on the left) has two glazed leaves that fold in on their outer
// hinges with a hiss of air when the bus has pulled in at a stop and is waiting, and fold shut again before it pulls
// out; your own bus opens them when you stop it, and when you get on or off. The doorways in the body are open
// (beta/vehicles/models.js), so with the leaves folded you see in: the step, the poles, the seats.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';

const L = 11.4, hl = L/2, hw = 2.55/2, DOORS = [[hl - 1.17, hl - 0.25], [-0.62, 0.42]];
const OPEN = 1.42, SPEED = 1/0.7, POOL = 10, NEAR = 110;
let mats = null;
function leaf(w) {
  if (!mats) mats = {
    frame: new THREE.MeshStandardMaterial({ color: 0xd2c8ae, roughness: 0.55, metalness: 0.1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.55 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd8b040, roughness: 0.3, metalness: 0.7 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  };
  const g = new THREE.Group(), add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  // the leaf runs from its hinge (x = 0) along +x for w
  add(new THREE.BoxGeometry(w, 1.86, 0.02), mats.frame, w/2, 1.43, 0);
  add(new THREE.BoxGeometry(w - 0.1, 0.86, 0.01), mats.glass, w/2, 1.85, -0.012);
  add(new THREE.BoxGeometry(w - 0.1, 0.68, 0.01), mats.glass, w/2, 0.96, -0.012);
  add(new THREE.BoxGeometry(w, 0.04, 0.03), mats.rubber, w/2, 0.52, 0);
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), mats.brass, w - 0.07, 1.45, -0.035);
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), mats.brass, w - 0.07, 1.45, 0.03);
  return g;
}
function makeSet(scene) {
  const root = new THREE.Group(); root.matrixAutoUpdate = false;
  const leaves = [];
  for (const [a, e] of DOORS) {
    const m = (a + e)/2, z = -(hw + 0.006);
    // the leaf from the front edge folds in one way, the one from the back edge the other
    const p0 = new THREE.Group(); p0.position.set(a + 0.015, 0, z); p0.add(leaf(m - a - 0.023)); root.add(p0); leaves.push([p0, -1]);
    const p1 = new THREE.Group(); p1.position.set(e - 0.015, 0, z); const l1 = leaf(e - m - 0.023); l1.rotation.y = Math.PI; p1.add(l1); root.add(p1); leaves.push([p1, 1]);
  }
  scene.add(root);
  return { root, leaves, bus: null, k: 0, was: 0 };
}
const sets = [];
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);

function step(P, dt) {
  const G = window.__nhAskG, T = G && G.traffic, scene = P.scene;
  if (!T || !scene) return;
  while (sets.length < POOL) sets.push(makeSet(scene));
  // the buses near you: traffic, yours, any left standing
  const near = [];
  for (const o of T.list) if (o.type === 'bus' && !o.isPlayer) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < NEAR) near.push({ o, d, traffic: true }); }
  const mine = !P.onFoot && P.cur && P.cur.type === 'bus' ? P.cur : null;
  if (mine) near.push({ o: mine, d: 0 });
  for (const dd of P.dropped || []) if (dd.veh && dd.veh.type === 'bus') { const d = Math.hypot(dd.veh.x - P.x, dd.veh.z - P.z); if (d < NEAR) near.push({ o: dd.veh, d }); }
  near.sort((a, b) => a.d - b.d); near.length = Math.min(near.length, POOL);
  const want = new Set(near.map(n => n.o));
  for (const S of sets) if (S.bus && !want.has(S.bus)) { S.bus = null; S.k = 0; }
  for (const n of near) {
    let S = sets.find(q => q.bus === n.o);
    if (!S) { S = sets.find(q => !q.bus); if (!S) continue; S.bus = n.o; S.k = 0; S.stillT = 0; }
    const o = n.o;
    // open: waiting at a stop (and shut a second before it leaves); yours stopped, or you getting on or off
    let open;
    if (n.traffic) open = (o.dwell || 0) > 1.2 && Math.abs(o.v || 0) < 0.3;
    else {
      S.stillT = Math.abs(o.v || 0) < 0.4 ? (S.stillT || 0) + dt : 0;
      open = S.stillT > 0.5 || (P._in && P._in.src === o) || (P._out && P._out.veh === o);
    }
    const was = S.k;
    S.k = Math.max(0, Math.min(1, S.k + (open ? SPEED : -SPEED)*dt));
    if ((was === 0 && S.k > 0) || (was === 1 && S.k < 1)) G.audio?.at?.(o.x, o.z, () => G.audio.noiseBurst?.(0.45, 700, 0.5, 0.18));
    const e = S.k*S.k*(3 - 2*S.k);
    for (const [pv, dir] of S.leaves) pv.rotation.y = dir*OPEN*e;
    // on the bus as it's drawn
    if (n.traffic) {
      _e.set(o.fallen > 0 ? 1.3 : (o.roll || 0), -(o.ryaw ?? o.yaw), (o.pitch || 0) + (o.slope || 0), 'YXZ'); _q.setFromEuler(_e);
      _p.set(o.rx ?? o.x, o.y || 0, o.rz ?? o.z);
      S.root.matrix.compose(_p, _q, _s);
    } else if (o.tilt) { o.tilt.updateWorldMatrix(true, false); S.root.matrix.copy(o.tilt.matrixWorld); }
    S.root.matrixWorldNeedsUpdate = true;
  }
  for (const S of sets) S.root.visible = !!S.bus;
}

const upd = Pilot.prototype.update;
Pilot.prototype.update = function (dt, ...a) {
  const out = upd.call(this, dt, ...a);
  try { step(this, dt); } catch (e) { /* (never stop the game over a door) */ }
  return out;
};
