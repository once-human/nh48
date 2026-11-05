// A bus shelter says which stop it is: its name on the board along the top, as the map has it (OpenStreetMap's name for
// the stop, and its Marathi name above it where the map has one). The shelters near you get theirs, both faces; the
// board's the one the shelter already had (world/propsChunk.js draws a blank one there), written on.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';

const POOL = 8, NEAR = 90, BW = 2.2, BH = 0.55, Y = 3.025;
function makeBoard() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: tex });
  const g = new THREE.PlaneGeometry(BW, BH), front = new THREE.Mesh(g, m), back = new THREE.Mesh(g, m);
  const root = new THREE.Group(); root.add(front, back); back.rotation.y = Math.PI; front.position.z = 0.03; back.position.z = -0.03;
  root.visible = false;
  return { root, tex, ctx: cv.getContext('2d'), stop: null };
}
function fit(c, text, x, y, room, px, font) {
  c.font = `bold ${px}px ${font}`;
  const w = c.measureText(text).width;
  if (w > room) { c.save(); c.translate(x - room/2, y); c.scale(room/w, 1); c.textAlign = 'left'; c.fillText(text, 0, 0); c.restore(); }
  else { c.textAlign = 'center'; c.fillText(text, x, y); }
}
function paint(B, s) {
  const c = B.ctx, W = 512, H = 128, en = s[3] || '', mr = s[4] || '';
  c.fillStyle = '#123a6b'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#f2f2ee'; c.fillRect(0, H - 7, W, 7); c.fillRect(0, 0, W, 4);
  c.fillStyle = '#ffffff'; c.textBaseline = 'middle';
  if (mr) { fit(c, mr, W/2, H*0.33, W - 30, 44, '"Noto Sans Devanagari", "Mangal", sans-serif'); fit(c, en, W/2, H*0.72, W - 30, 34, '"Arial Narrow", Arial, sans-serif'); }
  else fit(c, en, W/2, H*0.52, W - 30, 50, '"Arial Narrow", Arial, sans-serif');
  B.tex.needsUpdate = true;
}
const boards = [];
let list = null, tT = 0;
function step(P, dt) {
  const G = window.__nhAskG, M = G && G.W && G.W.M, scene = P.scene;
  if (!M || !scene) return;
  if (!list) list = (M.buses || []).filter(b => b.length > 3 && b[3]);
  if ((tT -= dt) > 0) return;
  tT = 0.5;
  while (boards.length < POOL) { const B = makeBoard(); scene.add(B.root); boards.push(B); }
  const x = P.x, z = P.z, near = [];
  for (const b of list) { const dx = b[0]/100 - x, dz = b[1]/100 - z; if (Math.abs(dx) < NEAR && Math.abs(dz) < NEAR) { const d = Math.hypot(dx, dz); if (d < NEAR) near.push([d, b]); } }
  near.sort((a, b) => a[0] - b[0]); near.length = Math.min(near.length, POOL);
  const want = new Set(near.map(n => n[1]));
  for (const B of boards) if (B.stop && !want.has(B.stop)) { B.stop = null; B.root.visible = false; }
  for (const [, s] of near) {
    if (boards.some(B => B.stop === s)) continue;
    const B = boards.find(q => !q.stop); if (!B) break;
    B.stop = s; paint(B, s);
    // where the shelter's own board is: its middle, 2.75 to 3.3 m up, facing the way the shelter faces
    const ry = Math.atan2(Math.cos(s[2]), Math.sin(s[2]));
    B.root.position.set(s[0]/100, Y, s[1]/100); B.root.rotation.set(0, ry, 0); B.root.visible = true;
  }
}
const upd = Pilot.prototype.update;
Pilot.prototype.update = function (dt, ...a) {
  const out = upd.call(this, dt, ...a);
  try { step(this, dt); } catch (e) { /* (never stop the game over a sign) */ }
  return out;
};
