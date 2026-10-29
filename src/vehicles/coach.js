// An intercity AC coach, the kind that does Mumbai–Pune through the night: a long white body with a tall dark
// window band, a raked one-piece windscreen with two wipers, the 'rabbit-ear' mirrors on stalks out front, an
// orange LED destination board, the roof AC pod, a front door on the left with its steps, three axles (a tag
// axle at the back), a maroon and saffron sweep down the sides with the name in Marathi, lamps that glow.
// Returns { group, wheels, dims, door } in the coach's frame (x forward, y up, +z the right-hand side).
import * as THREE from 'three';
import { M, canvasMat, profileBody, boxG, sidePanel, slopePanel, add, wheels } from './emodels.js';

export function buildCoach(name = 'शिवनेरी', dest = 'पुणे · PUNE') {
  const g = new THREE.Group();
  const L = 12.2, W = 2.55, F = L / 2, B = -L / 2;
  // the body, from its side profile: a near-vertical nose, a tall roof, a gently sloped back
  const prof = [[F - 0.05, 0.42], [F + 0.02, 0.95], [F - 0.04, 2.95], [F - 0.3, 3.42], [B + 0.25, 3.46], [B, 3.2], [B - 0.02, 0.48], [B + 0.3, 0.42]];
  add(g, [profileBody(prof, W, 0.09)], M.paint());
  // skirt and bumpers
  add(g, [boxG(F - 0.12, 0.36, -W / 2 + 0.02, F + 0.08, 0.72, W / 2 - 0.02), boxG(B - 0.08, 0.38, -W / 2 + 0.02, B + 0.12, 0.7, W / 2 - 0.02),
    boxG(B + 0.4, 0.34, -W / 2 - 0.01, F - 0.3, 0.5, -W / 2 + 0.06), boxG(B + 0.4, 0.34, W / 2 - 0.06, F - 0.3, 0.5, W / 2 + 0.01)], M.trim());
  // the window band down both sides, and the windscreen and back glass
  const z = W / 2 + 0.005;
  add(g, [sidePanel(B + 0.45, 1.72, F - 0.55, 3.08, z, 1), sidePanel(B + 0.45, 1.72, F - 1.45, 3.08, z, -1)], M.glass());
  // window pillars, so it reads as rows of seats
  const pil = []; for (let x = B + 1.4; x < F - 1.0; x += 1.55) { pil.push(boxG(x - 0.05, 1.72, z - 0.01, x + 0.05, 3.08, z + 0.02), boxG(x - 0.05, 1.72, -z - 0.02, x + 0.05, 3.08, -z + 0.01)); }
  add(g, pil, M.black());
  add(g, [slopePanel([F + 0.0, 1.08], [F - 0.28, 3.3], W - 0.18, 0.06)], M.glass());
  add(g, [slopePanel([B + 0.02, 2.3], [B + 0.22, 3.25], W - 0.4, 0.06)], M.glass());
  // wipers, parked across the bottom of the screen
  add(g, [boxG(F + 0.04, 1.18, -0.95, F + 0.08, 1.21, -0.05), boxG(F + 0.04, 1.18, 0.1, F + 0.08, 1.21, 0.95)], M.black());
  // the front door (left side, behind the front wheel) and its steps
  add(g, [sidePanel(F - 1.42, 0.5, F - 0.58, 3.05, z + 0.006, -1)], M.glass());
  add(g, [boxG(F - 1.45, 0.5, -W / 2 - 0.01, F - 1.39, 3.05, -W / 2 + 0.02), boxG(F - 0.6, 0.5, -W / 2 - 0.01, F - 0.54, 3.05, -W / 2 + 0.02)], M.chrome());
  // the livery: a maroon and saffron sweep with the name, both sides
  const liv = (side) => canvasMat('coach-liv-' + name + side, 1024, 96, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#7a1424'); gr.addColorStop(0.55, '#b0232f'); gr.addColorStop(1, '#f39a1e');
    x.fillStyle = gr; x.beginPath(); x.moveTo(0, h * 0.62); x.bezierCurveTo(w * 0.35, h * 0.62, w * 0.6, h * 0.1, w, h * 0.12); x.lineTo(w, h * 0.42); x.bezierCurveTo(w * 0.62, h * 0.4, w * 0.36, h * 0.95, 0, h * 0.95); x.closePath(); x.fill();
    x.fillStyle = '#7a1424'; x.font = `800 ${h * 0.5}px Mukta, "Noto Sans Devanagari", sans-serif`; x.textBaseline = 'middle';
    x.textAlign = side > 0 ? 'right' : 'left'; x.fillText(name, side > 0 ? w * 0.97 : w * 0.03, h * 0.72);
  }, { transparent: true });
  const lp = (side) => { const s = sidePanel(B + 0.4, 0.62, F - 1.6, 1.62, z + 0.012, side); s.computeBoundingBox(); const bb = s.boundingBox, uv = s.attributes.uv, p = s.attributes.position; for (let i = 0; i < uv.count; i++) { const u = (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x); uv.setXY(i, side > 0 ? u : 1 - u, (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y)); } return s; };
  add(g, [lp(1)], liv(1)); add(g, [lp(-1)], liv(-1));
  // the destination board, lit orange
  const dest_ = canvasMat('coach-dest-' + dest, 512, 64, (x, w, h) => { x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffa21a'; x.font = `700 ${h * 0.62}px Mukta, "Noto Sans Devanagari", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#ff8a00'; x.shadowBlur = 8; x.fillText(dest, w / 2, h * 0.54); });
  dest_.emissive = new THREE.Color(0xffffff); dest_.emissiveMap = dest_.map; dest_.emissiveIntensity = 0.9;
  const db = new THREE.PlaneGeometry(1.7, 0.22); db.rotateY(Math.PI / 2); db.translate(F - 0.25, 3.18, 0);
  add(g, [db], dest_);
  // lamps
  add(g, [boxG(F + 0.02, 0.8, -1.1, F + 0.1, 0.98, -0.62), boxG(F + 0.02, 0.8, 0.62, F + 0.1, 0.98, 1.1)], M.head());
  add(g, [boxG(B - 0.1, 0.9, -1.15, B - 0.02, 1.35, -0.9), boxG(B - 0.1, 0.9, 0.9, B - 0.02, 1.35, 1.15)], M.tail());
  add(g, [boxG(F - 0.4, 0.62, -W / 2 - 0.02, F - 0.25, 0.7, -W / 2), boxG(F - 0.4, 0.62, W / 2, F - 0.25, 0.7, W / 2 + 0.02)], M.amber());
  // the rabbit-ear mirrors: stalks curving out and down from the roof line, the glass hanging in front
  for (const s of [-1, 1]) {
    add(g, [boxG(F - 0.3, 3.25, s * (W / 2 - 0.05), F + 0.35, 3.3, s * (W / 2 + 0.25)), boxG(F + 0.3, 2.55, s * (W / 2 + 0.2), F + 0.36, 3.3, s * (W / 2 + 0.26))], M.black());
    add(g, [boxG(F + 0.28, 2.15, s * (W / 2 + 0.05), F + 0.4, 2.6, s * (W / 2 + 0.4))], M.trim());
  }
  // the AC pod on the roof, and a ladder of grilles at the back for the engine
  add(g, [boxG(B + 2.4, 3.44, -0.85, B + 5.4, 3.72, 0.85)], M.frost());
  const gr = []; for (let k = 0; k < 6; k++) gr.push(boxG(B - 0.03, 0.75 + k * 0.17, -0.8, B + 0.01, 0.82 + k * 0.17, 0.8));
  add(g, gr, M.black());
  // three axles: steering at the front, a drive axle and a tag axle at the back
  const r = 0.52, wz = W / 2 - 0.05;          // (the outer half of each tyre stands proud of the body, as on a real coach)
  const wh = wheels(g, [[F - 2.1, wz, true], [F - 2.1, -wz, true], [B + 3.4, wz], [B + 3.4, -wz], [B + 2.15, wz], [B + 2.15, -wz]], r, 0.32);
  // dark wheel arches
  const arch = []; for (const x of [F - 2.1, B + 3.4, B + 2.15]) { arch.push(boxG(x - 0.62, 0.42, W / 2 - 0.02, x + 0.62, 1.12, W / 2 + 0.004), boxG(x - 0.62, 0.42, -W / 2 - 0.004, x + 0.62, 1.12, -W / 2 + 0.02)); }
  add(g, arch, M.black());
  return { group: g, wheels: wh, dims: { L, W }, door: { x: F - 1.0, z: -W / 2 - 0.9 } };
}
