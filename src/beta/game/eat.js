// Eating and drinking what you buy, with the thing in your hand. Chai comes in the little fluted cutting glass, a
// filter coffee in a steel tumbler, cold drinks in a tall glass, beer in a pint, a cola in a can: up to the lips, a
// sip with the head back a touch (more of a tilt as it goes down), down to the chest, again, then it goes back on
// the counter. A vada pav, a bun maska, a puff, a burger: bitten, chewed, smaller each time. A plate (misal, poha,
// a thali, biryani, momos) in the left hand at the chest and eaten with the fingers of the right, a fork for
// noodles and pasta, a spoon for kulfi and amrakhand. You can walk while you do it; a punch, a run or a vehicle and
// it's put down. (Buying something used to change nothing on the street, and play the same drink clip indoors
// whatever it was: a vada pav drunk from an empty hand.)
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Shops, F as FOOD } from '@orig/game/shops.js';
import { ikArm } from '@orig/people/humans.js';
import { grip } from '../vehicles/fit.js';

const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const bone = (H, n) => (H._eb || (H._eb = {}))[n] || (H._eb[n] = H.root.getObjectByName(n));

// ---------------------------------------------------------------- the things themselves (metres, y up, base at 0)
const MAT = {};
const mat = (k, o) => MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial(o));
const glassM = () => mat('glass', { color: 0xc6d8d3, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
const steelM = () => mat('steel', { color: 0xd2d6d9, roughness: 0.28, metalness: 0.9 });
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = false; return o; };
// a liquid in a vessel: a solid of the inside, scaled down from the top as it's drunk
function liquid(rb, rt, h, col, inset = 0.003) {
  const g = new THREE.CylinderGeometry(rt - inset, rb - inset, h, 18); g.translate(0, h/2, 0);
  return mesh(g, mat('liq' + col, { color: col, roughness: 0.25 }));
}
function vessel(kind, col) {
  const G = new THREE.Group(); let fill = null, h = 0.1;
  if (kind === 'cutting') {             // the cutting glass: small, thick-bottomed, fluted (twelve flat faces)
    h = 0.078;
    const g = lathe([[0.0, 0], [0.021, 0], [0.022, 0.012], [0.029, h], [0.0275, h]], 12);
    G.add(mesh(g, glassM())); const fl = liquid(0.021, 0.026, h*0.62, col, 0.002); fl.position.y = 0.012; G.add(fl); fill = fl;
  } else if (kind === 'tumbler') {      // the steel tumbler of a filter coffee (its davara left on the counter)
    h = 0.085;
    G.add(mesh(lathe([[0, 0], [0.026, 0], [0.027, 0.006], [0.031, h], [0.033, h + 0.003], [0.03, h + 0.003], [0.026, 0.008], [0, 0.008]], 20), steelM()));
    const fl = liquid(0.026, 0.029, h*0.8, col); fl.position.y = 0.008; G.add(fl); fill = fl;
  } else if (kind === 'cup') {          // a café cup
    h = 0.07;
    G.add(mesh(lathe([[0, 0], [0.026, 0], [0.032, 0.012], [0.04, h], [0.037, h], [0.03, 0.014], [0, 0.012]], 22), mat('china', { color: 0xf3f1ec, roughness: 0.35 })));
    const hd = mesh(new THREE.TorusGeometry(0.017, 0.004, 6, 12, Math.PI*1.2), MAT.china); hd.rotation.z = -Math.PI*0.6; hd.position.set(0.042, 0.04, 0); G.add(hd);
    const fl = liquid(0.03, 0.036, h*0.75, col); fl.position.y = 0.012; G.add(fl); fill = fl;
  } else if (kind === 'can') {
    h = 0.115;
    const b = new THREE.CylinderGeometry(0.033, 0.033, h - 0.012, 20); b.translate(0, h/2, 0);
    G.add(mesh(b, mat('can', { color: col, roughness: 0.35, metalness: 0.55 })));
    G.add(mesh(lathe([[0.026, 0], [0.033, 0.006], [0.033, 0.006], [0, 0.006]], 20).translate(0, 0, 0), mat('alu', { color: 0xc9cdd1, roughness: 0.3, metalness: 0.9 })));
    const top = mesh(lathe([[0.033, h - 0.006], [0.028, h], [0, h - 0.002]], 20), MAT.alu); G.add(top);
  } else {                              // a tall glass, or a pint (beer: a head of foam)
    const pint = kind === 'pint'; h = pint ? 0.15 : 0.13;
    const rb = pint ? 0.031 : 0.03, rt = pint ? 0.043 : 0.036;
    G.add(mesh(lathe([[0, 0], [rb, 0], [rb + 0.001, 0.01], [rt, h], [rt - 0.002, h]], 20), glassM()));
    const fl = liquid(rb, rt - 0.004, h*0.8, col); fl.position.y = 0.01; G.add(fl); fill = fl;
    if (pint) { const fo = liquid(rt - 0.003, rt - 0.002, 0.012, 0xf4efe2, 0); fo.position.y = 0.01 + h*0.8; fill.userData.foam = fo; G.add(fo); }
  }
  return { G, fill, h };
}
// food in the hand: a pav (split, with what's inside showing), a puff, a khari, a sandwich, a slice, a modak
function handheld(kind) {
  const G = new THREE.Group();
  const bun = (y, top) => { const g = new THREE.SphereGeometry(0.05, 18, 10, 0, Math.PI*2, top ? 0 : Math.PI/2, Math.PI/2); g.scale(1, 0.55, 1); const m = mesh(g, mat('pav', { color: 0xc98a49, roughness: 0.75 })); m.position.y = y; return m; };
  if (kind === 'pav' || kind === 'maska' || kind === 'burger') {
    G.add(bun(0.028, false)); G.add(bun(0.032, true));
    const mid = new THREE.SphereGeometry(kind === 'maska' ? 0.044 : 0.046, 16, 8); mid.scale(1, kind === 'maska' ? 0.12 : 0.32, 1);
    const c = { pav: 0xb07a2a, maska: 0xf2dc8c, burger: 0x6b3d22 }[kind];
    const m = mesh(mid, mat('mid' + kind, { color: c, roughness: 0.6 })); m.position.y = 0.03; G.add(m);
    if (kind !== 'maska') { const ch = mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.003, 16), mat('green', { color: kind === 'burger' ? 0x5d9a3a : 0x4f7d2c, roughness: 0.7 })); ch.position.y = kind === 'burger' ? 0.043 : 0.042; G.add(ch); }
  } else if (kind === 'puff' || kind === 'khari') {
    const g = new THREE.BoxGeometry(kind === 'puff' ? 0.1 : 0.085, kind === 'puff' ? 0.028 : 0.016, kind === 'puff' ? 0.065 : 0.038, 3, 1, 2);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i)*(1 - Math.abs(p.getX(i))*3)); g.computeVertexNormals();
    const m = mesh(g, mat(kind, { color: kind === 'puff' ? 0xd9a256 : 0xe2b673, roughness: 0.7 })); m.position.y = 0.015; G.add(m);
  } else if (kind === 'sandwich' || kind === 'slice') {
    const g = new THREE.CylinderGeometry(kind === 'slice' ? 0.12 : 0.07, kind === 'slice' ? 0.12 : 0.07, kind === 'slice' ? 0.01 : 0.032, 3);
    g.translate(0, 0.016, 0);
    G.add(mesh(g, mat(kind, { color: kind === 'slice' ? 0xd8963a : 0xd9b27a, roughness: 0.7 })));
    const t = mesh(new THREE.CylinderGeometry(kind === 'slice' ? 0.108 : 0.064, kind === 'slice' ? 0.108 : 0.064, 0.004, 3), mat(kind + 't', { color: kind === 'slice' ? 0xb3341e : 0x4f7d2c, roughness: 0.6 }));
    t.position.y = kind === 'slice' ? 0.012 : 0.017; G.add(t);
  } else if (kind === 'modak') {
    const g = lathe([[0, 0], [0.022, 0.004], [0.026, 0.016], [0.018, 0.034], [0.006, 0.05], [0, 0.056]], 14);
    G.add(mesh(g, mat('modak', { color: 0xf1ebdc, roughness: 0.6 })));
  } else {                              // a cake in its paper
    G.add(mesh(lathe([[0, 0], [0.025, 0], [0.031, 0.03], [0.034, 0.032], [0.03, 0.046], [0.015, 0.055], [0, 0.057]], 16), mat('cake', { color: 0xa86b33, roughness: 0.75 })));
  }
  return G;
}
// a plate (a steel one, food heaped on it) or a bowl, and what you eat it with
function dish(kind, col) {
  const G = new THREE.Group(), bowl = kind === 'bowl' || kind === 'matka';
  if (kind === 'matka') G.add(mesh(lathe([[0, 0], [0.024, 0], [0.034, 0.025], [0.032, 0.045], [0.028, 0.05]], 16), mat('clay', { color: 0x9b4b2c, roughness: 0.9 })));
  else if (bowl) G.add(mesh(lathe([[0, 0], [0.03, 0], [0.045, 0.035], [0.047, 0.036], [0.044, 0.036], [0.028, 0.004], [0, 0.004]], 20), steelM()));
  else G.add(mesh(lathe([[0, 0], [0.1, 0], [0.105, 0.002], [0.122, 0.014], [0.125, 0.016], [0.12, 0.016], [0.1, 0.006], [0, 0.006]], 28), steelM()));
  const g = new THREE.SphereGeometry(bowl ? 0.033 : 0.075, 16, 8, 0, Math.PI*2, 0, Math.PI/2); g.scale(1, bowl ? 0.4 : 0.35, 1);
  const food = mesh(g, mat('food' + col, { color: col, roughness: 0.8 })); food.position.y = bowl ? (kind === 'matka' ? 0.042 : 0.026) : 0.006; G.add(food);
  return { G, food };
}
function utensil(kind) {
  const G = new THREE.Group();
  const h = mesh(new THREE.BoxGeometry(0.004, 0.0025, 0.13), steelM()); h.position.z = -0.06; G.add(h);
  if (kind === 'spoon') { const s = new THREE.SphereGeometry(0.016, 12, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2); s.scale(0.75, 0.3, 1.1); G.add(mesh(s, steelM())); }
  else for (const x of [-0.009, -0.003, 0.003, 0.009]) { const t = mesh(new THREE.BoxGeometry(0.002, 0.002, 0.03), steelM()); t.position.set(x, 0, 0.012); G.add(t); }
  return G;
}
// what each thing on the menus is, in the hand
const DRINK = {
  chai: ['cutting', 0x9a6a3f], fullchai: ['cutting', 0x8d5d34], filter: ['tumbler', 0xa77a52], cappu: ['cup', 0xb98e64],
  taak: ['tall', 0xe9ecd8], lassi: ['tall', 0xf3efe2], kokum: ['tall', 0x6e1834], sugarcane: ['tall', 0xc7c97e], mastani: ['tall', 0xf2a531],
  coldcoffee: ['tall', 0xb48a63], mocktail: ['tall', 0xd8e9b6], cocktail: ['tall', 0xc9466a], beer: ['pint', 0xd8a038], cola: ['can', 0x8a1820],
};
const HAND = { vadapav: 'pav', cheesevp: 'pav', bunmaska: 'maska', burger: 'burger', puff: 'puff', khari: 'khari', sandwich: 'sandwich', pizza: 'slice', modak: 'modak', mawacake: 'cake' };
const PLATE = {
  misal: 0xb5471d, misalx: 0xa83a16, poha: 0xe2c24a, bhaji: 0xb67a2c, sabudana: 0xe8d9a8, thali: 0xc99a45, puranpoli: 0xd9a34a,
  nonvegthali: 0x9c3d1c, biryani: 0xd9a441, vegbiryani: 0xdcb04c, kebab: 0x7a3b1d, dosa: 0xd99a3c, idli: 0xf1ede2, spdp: 0xe6d8b6,
  momos: 0xf0eadb, nachos: 0xe0b347, manchurian: 0x9c2416, noodles: 0xd7b56d, pasta: 0xc4502a, brownie: 0x4b2a17, maggi: 0xe9c25a,
};
const FORK = new Set(['noodles', 'pasta', 'manchurian']), SPOON = new Set(['brownie']);
const BOWL = { kulfi: ['matka', 0xf0dca8], shrikhand: ['bowl', 0xf2b83c], sundae: ['bowl', 0xf4ecd6] };
const byName = new Map(Object.entries(FOOD).map(([k, v]) => [v[0], k]));

// ---------------------------------------------------------------- what's in the hand, and the motion
function begin(P, id, scene) {
  end(P);
  let E = null;
  if (DRINK[id]) { const [k, c] = DRINK[id], v = vessel(k, c); E = { type: 'drink', ...v, rim: k === 'cutting' || k === 'tumbler', n: k === 'cutting' ? 3 : k === 'tumbler' || k === 'cup' ? 3 : 4 }; }
  else if (HAND[id]) E = { type: 'bite', G: handheld(HAND[id]), n: HAND[id] === 'slice' || HAND[id] === 'burger' ? 4 : 3 };
  else if (PLATE[id] || BOWL[id]) {
    const bw = BOWL[id], d = dish(bw ? bw[0] : 'plate', bw ? bw[1] : PLATE[id]);
    const ut = bw || SPOON.has(id) ? 'spoon' : FORK.has(id) ? 'fork' : null;
    E = { type: 'plate', ...d, ut: ut && utensil(ut), small: !!bw, n: bw ? 4 : 6 };
  }
  if (!E) return;
  E.t = 0; E.id = id;
  // a sip / a bite every so often: up (0.5 s), at the mouth, down, a pause; the last one and it's gone
  E.cyc = E.type === 'drink' ? 2.0 : E.type === 'bite' ? 2.2 : 1.7;
  E.D = 0.6 + E.n*E.cyc + 0.5;
  scene.add(E.G); if (E.ut) scene.add(E.ut);
  E.G.visible = false; if (E.ut) E.ut.visible = false;
  E.scene = scene;
  P._eat = E;
}
function end(P) {
  const E = P._eat; if (!E) return;
  E.scene.remove(E.G); if (E.ut) E.scene.remove(E.ut);
  P._eat = null;
}

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _u = new THREE.Vector3(), _x = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
// the middle of a palm: from the wrist toward the knuckles, a little into the curl of the fingers
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _hp = new THREE.Vector3(), _hc = new THREE.Vector3(), _ht = new THREE.Vector3(), _pl = new THREE.Vector3();
function palm(H, sd, out) {
  const h = bone(H, 'hand_' + sd), m = bone(H, 'middle_01_' + sd);
  h.getWorldPosition(_pa); if (!m) return out.copy(_pa);
  m.getWorldPosition(_pb);
  return out.copy(_pa).lerp(_pb, 0.75);
}
// turn the hand about the wrist so the line of its knuckles (index to little finger) runs along `axis`, index
// uppermost: a glass then goes up through the curl of the fingers the way it's held
const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3(), _hq = new THREE.Quaternion();
function orientHand(H, sd, axis, w) {
  const h = bone(H, 'hand_' + sd), i = bone(H, 'index_01_' + sd), p = bone(H, 'pinky_01_' + sd); if (!h || !i || !p || w <= 0) return;
  i.getWorldPosition(_k1); p.getWorldPosition(_k2); _k1.sub(_k2).normalize();
  _hq.setFromUnitVectors(_k1, axis);
  if (w < 1) _hq.slerp(_q.identity(), 1 - w);
  h.parent.getWorldQuaternion(_pq);
  h.getWorldQuaternion(_q).premultiply(_hq);
  h.quaternion.copy(_pq.invert().multiply(_q));
  H.root.updateMatrixWorld(true);
}
// the hole in a closed hand, where a glass goes
function hole(H, sd, out) {
  palm(H, sd, out);
  const m2 = bone(H, 'middle_02_' + sd); if (!m2) return out;
  m2.getWorldPosition(_pb);
  return out.lerp(_pb, 0.5);
}
// put that palm at p: the wrist where it has to be for it, twice over (the hand turns as the arm moves)
function handTo(H, sd, p0, pole, w) {
  const p = _hp.copy(p0); _ht.copy(p);
  for (let i = 0; i < 2; i++) {
    ikArm(H, sd, _ht, pole, w); H.root.updateMatrixWorld(true);
    palm(H, sd, _hc); _ht.addScaledVector(_hc.sub(p).negate(), w);
  }
  ikArm(H, sd, _ht, pole, w); H.root.updateMatrixWorld(true);
}

function pose(P, dt) {
  const E = P._eat, H = P.human, F = P.foot;
  E.t += dt;
  const t = E.t;
  if (t >= E.D) { end(P); return; }
  const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
  _f.set(fx, 0, fz); _r.set(-fz, 0, fx);
  H.root.updateMatrixWorld(true);
  const hd = bone(H, 'Head'), s3 = bone(H, 'spine_03'); if (!hd || !s3) return;
  // the mouth (from the head bone at the top of the neck), and where the hand rests between: in front of the chest
  hd.getWorldPosition(_m).addScaledVector(_f, 0.1); _m.y += 0.045;
  s3.getWorldPosition(_u);
  const rest = _p.copy(_u).addScaledVector(_f, 0.27).addScaledVector(_r, 0.13); rest.y -= 0.12;
  const w = sm(t/0.5)*(1 - sm((t - (E.D - 0.45))/0.45));        // the arm comes up at the start, down at the end
  // where in the cycle: 0 down at the chest, 1 at the mouth
  const ct = t - 0.6, i = Math.floor(ct/E.cyc), u = ct - i*E.cyc;
  const up = ct < 0 || i >= E.n ? 0 : sm(u/0.5)*(1 - sm((u - (E.type === 'drink' ? 1.25 : 0.85))/0.45));
  const done = Math.max(0, Math.min(E.n, i + (u > 0.8 ? 1 : 0)))/E.n;           // how much is gone
  // the head back for a sip, forward to meet a bite
  if (E.type === 'drink') { const nk = bone(H, 'neck_01'); if (nk) { nk.parent.getWorldQuaternion(_pq).invert(); nk.quaternion.premultiply(_q.setFromAxisAngle(_x.copy(_r).applyQuaternion(_pq), 0.16*up*(0.5 + done))); } }
  else { const nk = bone(H, 'neck_01'); if (nk) { nk.parent.getWorldQuaternion(_pq).invert(); nk.quaternion.premultiply(_q.setFromAxisAngle(_x.copy(_r).applyQuaternion(_pq), -0.14*up)); } }
  H.root.updateMatrixWorld(true);
  hd.getWorldPosition(_m).addScaledVector(_f, 0.1); _m.y += 0.045;

  if (E.type === 'drink') {
    // the glass: rim to the lips, tipped toward you, more as it empties. A hot cutting glass or tumbler is held by
    // its rim between the thumb and fingers; anything else round its middle
    const tilt = up*(0.45 + 0.7*done), hold = E.rim ? 0.9 : 0.5;
    const tu = _u.copy(UP).applyAxisAngle(_r, tilt);                      // the glass's own up, tipped
    const lips = _t.copy(_m).addScaledVector(_f, 0.02);
    const atMouth = lips.addScaledVector(tu, -E.h*(1 - hold));
    const c = _c.copy(rest).lerp(atMouth, up);
    handTo(H, 'r', c.clone(), _a.set(-fx*0.2, -1, -fz*0.2).addScaledVector(_r, 0.9), w);
    orientHand(H, 'r', tu, w);
    grip(H, 'r', (E.rim ? -0.2 : -0.1)*w);
    E.G.visible = w > 0.05;
    hole(H, 'r', _b);
    E.G.position.copy(_b).addScaledVector(tu, -E.h*hold);
    E.G.quaternion.setFromAxisAngle(_r, tilt);
    if (E.fill) { const k = Math.max(0.06, 1 - done*0.94); E.fill.scale.y = k; if (E.fill.userData.foam) E.fill.userData.foam.position.y = 0.01 + E.fill.geometry.parameters.height*k; }
  } else if (E.type === 'bite') {
    const c = _c.copy(rest).lerp(_t.copy(_m).addScaledVector(_f, 0.06).addScaledVector(UP, -0.03), up);
    handTo(H, 'r', c.clone(), _a.set(-fx*0.2, -1, -fz*0.2).addScaledVector(_r, 0.9), w);
    E.G.visible = w > 0.05;
    palm(H, 'r', _b);
    // held flat, the bitten edge toward you; what's left of it gets smaller
    E.G.position.copy(_b).addScaledVector(_f, 0.03); E.G.position.y -= 0.02;
    E.G.quaternion.setFromAxisAngle(_r, 0.35 + up*0.4);
    const k = 1 - done*0.8; E.G.scale.set(k, 1, 1).multiplyScalar(0.85 + 0.15*k);
    E.G.rotateY(-F.yaw);
  } else {
    // the plate in the left hand, low at the chest, a little out; the right goes plate to mouth
    const pl = _pl.copy(_u).addScaledVector(_f, 0.3).addScaledVector(_r, -0.04); pl.y -= 0.22;
    handTo(H, 'l', _x.copy(pl).addScaledVector(UP, -0.025).addScaledVector(_r, -0.06), _a.set(-fx*0.2, -1, -fz*0.2).addScaledVector(_r, -0.9), w);
    grip(H, 'l', -0.6*w);
    E.G.visible = w > 0.05;
    E.G.position.copy(pl); E.G.quaternion.setFromAxisAngle(UP, -F.yaw);
    E.food.scale.setScalar(Math.max(0.15, 1 - done*0.85));
    const pick = _t.copy(pl).addScaledVector(UP, E.small ? 0.06 : 0.04).addScaledVector(_r, 0.03);
    const c = _c.copy(pick).lerp(_m.clone().addScaledVector(_f, 0.04).addScaledVector(UP, -0.04), up);
    handTo(H, 'r', c.clone(), _a.set(-fx*0.2, -1, -fz*0.2).addScaledVector(_r, 0.9), w);
    if (E.ut) {
      E.ut.visible = w > 0.05;
      palm(H, 'r', _b);
      E.ut.position.copy(_b).addScaledVector(_f, 0.04);
      // pointing away from you, down into the plate, up to the mouth
      E.ut.quaternion.setFromAxisAngle(UP, -F.yaw + Math.PI/2).premultiply(_q.setFromAxisAngle(_r, -0.35 + up*0.6));
    } else grip(H, 'r', 0.25*w*(1 - up));                // fingers together to pick it up
  }
  H.root.updateMatrixWorld(true);
}

// after the clip and everything else has posed you
const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...rest) {
  if (!this._eat) return upd.call(this, dt, ...rest);
  // (eyes on what you're eating, not glancing about at passers-by)
  const lp = this.lookPose; this.lookPose = null;
  try { upd.call(this, dt, ...rest); } finally { this.lookPose = lp; }
  if (!this._eat) return;
  // a punch, a fall, a run, a climb or the river: it's put down
  const F = this.foot, A = this.act;
  if (!this.onFoot || this.downT || this.ko || F.climb || F.swim || F.air || (A && A.kind !== 'hurt') || F.v > 2.4 || this._pet || this.seated) { end(this); return; }
  pose(this, dt);
};
const ex = Pilot.prototype.enter;
Pilot.prototype.enter = function (...a) { end(this); return ex.apply(this, a); };

// buying something to have there and then (not a parcel, not into the bag, not served at a table)
const items = Shops.prototype.items;
Shops.prototype.items = function (ctx) {
  const out = items.call(this, ctx), G = this.g;
  const dineIn = !!(ctx && ctx.inside && ctx.spot === 'counter' && G.interiors && G.interiors.cur && G.interiors.cur.R.seats.length);
  for (const it of out) {
    const id = byName.get(it.label); if (!id || FOOD[id][4] || !it.act) continue;
    const act = it.act;
    it.act = (...a) => {
      const r = act(...a);
      if (typeof r === 'string' && !(dineIn && !ctx.parcel) && !/in your bag|packed/i.test(r)) {
        const P = G.player;
        if (P && P.onFoot && P.human) {
          // (in place of the drink clip played indoors for anything)
          if (P.act && P.act.kind === 'hurt' && P.human.cur === P.human.actions.drink) { P.act = null; P.human.play('idle', { fade: 0.25 }); }
          begin(P, id, G.scene);
        }
      }
      return r;
    };
  }
  return out;
};
