// The bus's doors open. Each doorway (front and middle, on the left) has two leaves, and each leaf is two glazed
// panels hinged together: the first on the doorway's post, the second on the first, its far edge running in a track
// along the doorway, so they fold in on themselves against the post like a city bus's (a jackknife), with a hiss of
// air when the bus has pulled in at a stop and is waiting, and fold shut again before it pulls out; your own bus opens
// them when you stop it, and when you get on or off. The doorways in the body are open (beta/vehicles/models.js), so
// with the leaves folded you see in: the step, the poles, the seats.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const L = 11.4, hl = L/2, hw = 2.55/2, DOORS = [[hl - 1.17, hl - 0.25], [-0.62, 0.42]];
const OPEN = 1.36, SPEED = 1/0.8, POOL = 10, NEAR = 110;
const Y0 = 0.5, Y1 = 2.38;              // the leaves from the step to the doorway's head
let mats = null;
const box = (g, m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
// one panel, from its hinge (x = 0) along +x for w: an aluminium frame round two panes, a painted kick panel at the
// foot, a rubber edge where it meets the next one, a grab bar on the inside (+z). Built once per width and shared:
// a mesh per material
const PANELS = new Map();
function panelGeo(w, edge) {
  const key = Math.round(w*1000) + (edge ? 'e' : ''); if (PANELS.has(key)) return PANELS.get(key);
  const parts = { frame: [], glass: [], kick: [], rubber: [], bar: [] }, h = Y1 - Y0;
  const bx = (k, w2, h2, d, x, y, z) => parts[k].push(new THREE.BoxGeometry(w2, h2, d).translate(x, y, z));
  bx('frame', 0.045, h, 0.034, 0.0225, Y0 + h/2, 0); bx('frame', 0.045, h, 0.034, w - 0.0225, Y0 + h/2, 0);   // the stiles
  bx('frame', w, 0.06, 0.034, w/2, Y1 - 0.03, 0);                       // top rail
  bx('frame', w, 0.07, 0.034, w/2, 1.36, 0);                            // the rail between the panes
  bx('frame', w, 0.03, 0.034, w/2, Y0 + 0.335, 0);
  bx('kick', w - 0.02, 0.32, 0.03, w/2, Y0 + 0.16, 0);                  // kick panel
  bx('glass', w - 0.09, 1.325 - Y0 - 0.35, 0.008, w/2, (Y0 + 0.35 + 1.325)/2, 0); bx('glass', w - 0.09, Y1 - 0.06 - 1.395, 0.008, w/2, (1.395 + Y1 - 0.06)/2, 0);
  if (edge) parts.rubber.push(new THREE.CylinderGeometry(0.016, 0.016, h - 0.04, 6).translate(w + 0.006, Y0 + h/2, 0));
  parts.bar.push(new THREE.CylinderGeometry(0.013, 0.013, 0.95, 8).translate(w*0.55, 1.42, 0.05));
  for (const y of [0.97, 1.87]) bx('bar', 0.025, 0.025, 0.05, w*0.55, y, 0.027);
  const out = {};
  for (const k in parts) if (parts[k].length) { out[k] = mergeGeometries(parts[k].map(g => g.index ? g.toNonIndexed() : g)); parts[k].forEach(g => g.dispose()); }
  PANELS.set(key, out); return out;
}
function panel(w, edge) {
  if (!mats) mats = {
    frame: new THREE.MeshStandardMaterial({ color: 0x8e9398, roughness: 0.38, metalness: 0.65 }),
    // (the bus's own window glass, so the doors match the windows beside them: dark and glossy, not a clear sheet)
    glass: (window.__nhAskG && window.__nhAskG.vmats && window.__nhAskG.vmats.glass) || new THREE.MeshStandardMaterial({ color: 0x0c1114, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.8, depthWrite: false }),
    kick: new THREE.MeshStandardMaterial({ color: 0xa8241b, roughness: 0.45, metalness: 0.1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.95 }),
    bar: new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.22, metalness: 0.85 }),
  };
  const g = new THREE.Group(), P = panelGeo(w, edge);
  for (const k in P) { const o = new THREE.Mesh(P[k], mats[k]); if (k === 'glass') o.renderOrder = 2; g.add(o); }
  return g;
}
// a leaf: the first panel on the post, the second hung on its far edge. fold(a): a = 0 shut, 1 folded
function leaf(w, flip) {
  const pw = w/2 - 0.004, p1 = new THREE.Group(), p2 = new THREE.Group();
  p1.add(panel(pw, false)); p2.position.set(pw + 0.004, 0, 0); p2.add(panel(pw, true)); p1.add(p2);
  const top = new THREE.Group(); if (flip) top.rotation.y = Math.PI; top.add(p1);
  return { g: top, fold: (a, dir) => { p1.rotation.y = dir*a; p2.rotation.y = -dir*2*a; } };
}
function makeSet(scene) {
  const root = new THREE.Group(); root.matrixAutoUpdate = false;
  const leaves = [];
  for (const [a, e] of DOORS) {
    const m = (a + e)/2, z = -(hw + 0.006);
    // the leaf from one post folds in one way, the one from the other post the other way
    const L0 = leaf(m - a - 0.012, false); L0.g.position.set(a + 0.01, 0, z); root.add(L0.g); leaves.push([L0, -1]);
    const L1 = leaf(e - m - 0.012, true); L1.g.position.set(e - 0.01, 0, z); root.add(L1.g); leaves.push([L1, 1]);
    // the track along the doorway's head the folding edges run in
    box(root, mats.frame, e - a, 0.035, 0.05, m, Y1 + 0.02, z + 0.03);
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
    // the air rams: quick in the middle, eased at the ends, and the leaves settle against their stops
    const e = S.k*S.k*(3 - 2*S.k), set = open && S.k > 0.85 ? Math.sin((S.k - 0.85)/0.15*Math.PI)*0.03 : 0;
    for (const [lf, dir] of S.leaves) lf.fold(OPEN*e + set, dir);
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
