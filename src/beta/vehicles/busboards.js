// A PMPML bus says where it's going: the route board over the windscreen (and the small one at the back) lit amber
// with a real route's number and where it ends, as the board on the bus does. The routes are PMPML's own, from
// OpenStreetMap (game/transit.json: the number and "from => to"); each bus is on one of them, the same one for as long
// as it's around. Where the map data has the end of the line's name in Marathi too (the stop of that name), the board
// goes between the two every few seconds, as the LED boards do; where it hasn't, it stays in English.
// The buses close to you get the boards (as many as the door sets, beta/vehicles/busdoors.js, the same way).
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Traffic } from '@orig/traffic/traffic.js';
import T from '@orig/game/transit.json';

const POOL = 8, NEAR = 140, FLIP = 4.5;
// the boards on the model (beta/vehicles/models.js buildBus): the front one's face and the back one's, bus frame
const FRONT = { x: 5.455, y: 2.795, w: 1.82, h: 0.27, dir: 1 }, BACK = { x: -5.66, y: 2.76, w: 1.38, h: 0.26, dir: -1 };

// each route: its number, where it ends, and that end in Marathi if a stop of that name has it
const MR = new Map();
for (const r of T.bus || []) for (const s of r.stops || []) if (s.mr) MR.set(s.name.toLowerCase(), s.mr);
const mrOf = (name) => {
  const n = name.toLowerCase();
  if (MR.has(n)) return MR.get(n);
  for (const [k, v] of MR) if (k === n + ' bus stand' || k === n + ' bus depot' || k.replace(/ (bus stand|bus depot|bus sthanak)$/, '') === n) return v;
  return null;
};
const ROUTES = (T.bus || []).map((r) => {
  const to = (r.name.split('=>')[1] || r.stops[r.stops.length - 1].name).trim();
  return { ref: String(r.ref), to, mr: mrOf(to) };
});

// the board's picture: amber LEDs on black, the number big on the left, the destination after it
function paint(B, R, mr) {
  const c = B.ctx, W = c.canvas.width, H = c.canvas.height;
  c.fillStyle = '#050403'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffae1a'; c.textBaseline = 'middle';
  c.font = `bold ${Math.round(H*0.78)}px "Arial Narrow", Arial, sans-serif`;
  const nw = c.measureText(R.ref).width;
  c.fillText(R.ref, H*0.25, H*0.54);
  const text = mr && R.mr ? R.mr : R.to, x0 = H*0.25 + nw + H*0.45, room = W - x0 - H*0.2;
  let size = H*(mr ? 0.6 : 0.62);
  c.font = `bold ${Math.round(size)}px ${mr ? '"Noto Sans Devanagari", "Mangal", sans-serif' : '"Arial Narrow", Arial, sans-serif'}`;
  const tw = c.measureText(text).width;
  if (tw > room) { c.save(); c.translate(x0, 0); c.scale(room/tw, 1); c.fillText(text, 0, H*0.54); c.restore(); }
  else c.fillText(text, x0 + (room - tw)/2, H*0.54);
  // the LED grid: dark lines between the dots, so it reads as lamps, not print
  c.fillStyle = 'rgba(5,4,3,0.62)';
  const p = H/16;
  for (let x = 0; x < W; x += p) c.fillRect(x, 0, p*0.32, H);
  for (let y = 0; y < H; y += p) c.fillRect(0, y, W, p*0.32);
  B.tex.needsUpdate = true;
}
function makeBoard(spec) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512*spec.h/spec.w);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // (a hair proud of the housing's face, and pulled forward in depth: the lit plate in the model's board and this one
  // were in the same plane and took turns showing, the neon one second and the number the next)
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  m.color.setScalar(1.35);                                  // (lit: a touch over white, so it glows at night)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), m);
  mesh.position.set(spec.x + spec.dir*0.012, spec.y, 0); mesh.rotation.y = spec.dir > 0 ? Math.PI/2 : -Math.PI/2;
  return { mesh, tex, ctx: cv.getContext('2d') };
}
function makeSet(scene) {
  const root = new THREE.Group(); root.matrixAutoUpdate = false;
  const F = makeBoard(FRONT), B = makeBoard(BACK);
  root.add(F.mesh, B.mesh); scene.add(root);
  return { root, boards: [F, B], bus: null, R: null, mr: false, t: 0 };
}
const sets = [], mine = new WeakMap();
const routeOf = (o) => {
  if (!ROUTES.length) return null;
  if (o.id !== undefined) return ROUTES[Math.abs(o.id | 0) % ROUTES.length];
  if (!mine.has(o)) mine.set(o, ROUTES[Math.floor(Math.random()*ROUTES.length)]);
  return mine.get(o);
};
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
function step(P, dt) {
  const G = window.__nhAskG, TR = G && G.traffic, scene = P.scene;
  if (!TR || !scene || !ROUTES.length) return;
  while (sets.length < POOL) sets.push(makeSet(scene));
  const near = [];
  for (const o of TR.list) if (o.type === 'bus' && !o.isPlayer && !o.wreck) { const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < NEAR) near.push({ o, d, traffic: true }); }
  const cur = !P.onFoot && P.cur && P.cur.type === 'bus' ? P.cur : null;
  if (cur) near.push({ o: cur, d: 0 });
  for (const dd of P.dropped || []) if (dd.veh && dd.veh.type === 'bus' && !dd.veh.dead) { const d = Math.hypot(dd.veh.x - P.x, dd.veh.z - P.z); if (d < NEAR) near.push({ o: dd.veh, d }); }
  near.sort((a, b) => a.d - b.d); near.length = Math.min(near.length, POOL);
  const want = new Set(near.map(n => n.o));
  for (const S of sets) if (S.bus && !want.has(S.bus)) S.bus = null;
  for (const n of near) {
    let S = sets.find(q => q.bus === n.o);
    const o = n.o;
    if (!S) { S = sets.find(q => !q.bus); if (!S) continue; S.bus = o; S.R = routeOf(o); S.mr = false; S.t = Math.random()*FLIP; for (const B of S.boards) paint(B, S.R, false); }
    // English, then Marathi, and back (only where there's Marathi for it)
    if (S.R.mr && (S.t += dt) > FLIP) { S.t = 0; S.mr = !S.mr; for (const B of S.boards) paint(B, S.R, S.mr); }
    if (n.traffic) {
      _e.set(o.fallen > 0 ? 1.3 : (o.roll || 0), -(o.ryaw ?? o.yaw), (o.pitch || 0) + (o.slope || 0), 'YXZ'); _q.setFromEuler(_e);
      _p.set(o.rx ?? o.x, (o.y || 0) + (o.fallen > 0 ? 0.3 : 0), o.rz ?? o.z);
      S.root.matrix.compose(_p, _q, _s);
    } else if (o.tilt) { o.tilt.updateWorldMatrix(true, false); S.root.matrix.copy(o.tilt.matrixWorld); }
    S.root.matrixWorldNeedsUpdate = true;
  }
  for (const S of sets) S.root.visible = !!S.bus;
}
// (set on the bus once the traffic has been placed for this frame, not before: placed from the player's own step, which
// comes first, they were always where the bus had been a frame ago, and stood off it as it drove)
let pend = null;
const upd = Pilot.prototype.update;
Pilot.prototype.update = function (dt, ...a) {
  const out = upd.call(this, dt, ...a);
  pend = [this, (pend ? pend[1] : 0) + dt];
  return out;
};
const ren = Traffic.prototype.render;
Traffic.prototype.render = function (...a) {
  const out = ren.apply(this, a);
  if (pend) { try { step(pend[0], pend[1]); } catch (e) { /* (never stop the game over a sign) */ } pend[1] = 0; }
  return out;
};
