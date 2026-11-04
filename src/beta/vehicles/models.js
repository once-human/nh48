// /beta's vehicles: the same machines as vehicles/models.js (same sizes, wheel positions, seats, paint channels and cockpit openings, so everything that drives,
// parks, garages or collides with them is untouched), with far more made: real arches, doors, lamps, engines, spokes. The far models are real shapes too.
// ground at the centre of the wheelbase. Paint channels: 1 body (instanceColor), 2 rider shirt
// (aColB), 3 helmet / hair / cargo (aColC).
import * as THREE from 'three';
import { loft, archDecal } from '@orig/vehicles/loft.js';
import { ColorBuilder } from '@orig/world/geo.js';

const BLACK = [0.07, 0.07, 0.075], TYRE = [0.06, 0.06, 0.06], RIM = [0.62, 0.62, 0.64], CHROME = [0.78, 0.78, 0.8];
const AUTO_Y = [0.96, 0.74, 0.06], GREY = [0.35, 0.35, 0.37], SKIN = [0.62, 0.44, 0.32], HAIR = [0.08, 0.07, 0.06];
const HEAD = [1.0, 0.95, 0.82], TAIL = [0.95, 0.08, 0.05], AMBER = [1.0, 0.55, 0.05];

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function M(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 9),
  cyl16: new THREE.CylinderGeometry(1, 1, 1, 12),
  sph: new THREE.SphereGeometry(1, 8, 5),
  sphLo: new THREE.SphereGeometry(1, 6, 4),
  halfCyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, 0, Math.PI),
  cone: new THREE.ConeGeometry(1, 1, 8),
  circle: new THREE.CircleGeometry(1, 12),
  sph2: new THREE.SphereGeometry(1, 12, 9),
};
// rounded limb from a to b (a capsule), so riders read as people rather than stacked boxes
const _capCache = new Map();
function limb(b, ax, ay, az, bx, by, bz, r, c, paint = 0) {
  const L = Math.hypot(bx - ax, by - ay, bz - az);
  const key = Math.round(r * 1000) + ':' + Math.round(L * 100);
  let g = _capCache.get(key);
  if (!g) { g = new THREE.CapsuleGeometry(r, Math.max(0.001, L), 2, 7); _capCache.set(key, g); }
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(bx - ax, by - ay, bz - az).normalize());
  _m.compose(_p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2), q, _s.set(1, 1, 1));
  b.addGeo(g, _m, c, 0, paint);
}

function box(b, x0, y0, z0, x1, y1, z1, c, paint = 0, glow = 0) {
  b.addGeo(G.box, M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), c, glow, paint);
}
const MATTE = -1;       // glow channel value for matte parts (see vehmat.js)
let WHEELS = null;                    // collecting wheel positions for the model being built (see wheelsOf)
export function wheelsOf(build) { WHEELS = []; const m = build(); m.wh = WHEELS; WHEELS = null; return m; }
function extrude(b, pts, z0, z1, c, paint = 0, bevel = 0.04, glow = 0) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = Math.max(0.01, z1 - z0 - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, z0 + bevel);
  b.addGeo(g, M(0, 0, 0), c, glow, paint);
  g.dispose();
}
// mudguard / wheel arch: half cylinder over a wheel, axle along z, covering y >= centre
const ARC = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true, 0, Math.PI);
const _basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
function guard(b, x, y, z, r, w, c, paint = 0) {
  const m = new THREE.Matrix4().makeTranslation(x, y, z).multiply(_basis).multiply(new THREE.Matrix4().makeScale(r, w, r));
  b.addGeo(ARC, m, c, 0, paint);
  // inner face so the open arc isn't see-through from below
  const mi = new THREE.Matrix4().makeTranslation(x, y, z).multiply(_basis).multiply(new THREE.Matrix4().makeScale(-r * 0.98, w, r * 0.98));
  b.addGeo(ARC, mi, c.map(v => v * 0.6), 0, paint);
}
function newB(paintable = true) { const b = new ColorBuilder(); if (paintable) b.paint = []; return b; }

// ---------------------------------------------------------------- people
// seated rider: hips at (x, y), facing +x. lean forward (rad). colours via channels when `inst`
export function addRider(b, x, y, z, opts = {}) {
  const lean = opts.lean ?? 0.15;
  const shirt = opts.shirt || [0.8, 0.8, 0.8], pants = opts.pants || [0.18, 0.2, 0.28];
  const shirtP = opts.inst ? 2 : 0, headP = opts.inst ? 3 : 0;
  const helmet = opts.helmet;
  const fx = opts.footX ?? x + 0.42, fy = opts.footY ?? y - 0.42;
  for (const s of [-1, 1]) {
    const lz = z + s * 0.1;
    limb(b, x - 0.02, y, lz, x + 0.36, y + 0.02, lz + s * 0.02, 0.075, pants);            // thigh
    limb(b, x + 0.36, y + 0.02, lz + s * 0.02, fx, fy + 0.04, lz + s * 0.01, 0.06, pants);  // shin
    b.addGeo(G.sph2, M(fx + 0.06, fy, lz + s * 0.01, 0.12, 0.045, 0.055), [0.12, 0.1, 0.08]);   // shoe
  }
  // torso (leaning): a rounded chest over the hips
  const th = 0.54;
  const sx = x + Math.sin(lean) * th, sy = y + Math.cos(lean) * th + 0.05;
  if (!opts.noUpper) {
    b.addGeo(G.sph2, M(x + Math.sin(lean) * 0.08, y + 0.1, z, 0.15, 0.13, 0.19), pants);            // hips
    const tx = x + Math.sin(lean) * th * 0.52, ty = y + Math.cos(lean) * th * 0.52 + 0.05;
    b.addGeo(G.sph2, M(tx, ty, z, 0.13, th * 0.56, 0.2, 0, 0, -lean), shirt, 0, shirtP);
  }
  // arms reaching to the handlebar
  const hx = opts.handX ?? sx + 0.42, hy = opts.handY ?? sy - 0.22;
  for (const s of [-1, 1]) {
    let ax = sx - 0.02, ay = sy - 0.06, az = z + s * 0.19;
    const hz = z + s * (opts.handW ?? 0.3);
    const ex = ax + (hx - ax) * 0.5, ey = Math.min(ay, hy) - 0.08, ez = az + (hz - az) * 0.5 + s * 0.05;   // elbow a little out and down
    if (!opts.noUpper) limb(b, ax, ay, az, ex, ey, ez, 0.048, shirt, shirtP);
    limb(b, ex, ey, ez, hx, hy, hz, 0.04, opts.noUpper ? shirt : SKIN, opts.noUpper ? shirtP : 0);
    b.addGeo(G.sph2, M(hx, hy, hz, 0.05, 0.045, 0.05), SKIN);
  }
  if (opts.noUpper) return;
  // neck + head
  const hdx = sx + Math.sin(lean) * 0.12, hdy = sy + 0.15;
  limb(b, sx, sy - 0.04, z, hdx, hdy - 0.08, z, 0.045, SKIN);
  b.addGeo(G.sph2, M(hdx, hdy, z, 0.1, 0.12, 0.095), SKIN);
  if (helmet) {
    b.addGeo(G.sph2, M(hdx - 0.01, hdy + 0.03, z, 0.14, 0.135, 0.125), helmet, 0, headP);
    b.addGeo(G.sph2, M(hdx + 0.075, hdy + 0.0, z, 0.06, 0.06, 0.1), [0.08, 0.09, 0.1]);       // visor
  } else {
    b.addGeo(G.sph2, M(hdx - 0.02, hdy + 0.045, z, 0.108, 0.085, 0.102), opts.hair || HAIR, 0, headP);
  }
}
// pillion rider (women often sit side-saddle)
function addPillion(b, x, y, z, sideSaddle, inst) {
  if (!sideSaddle) { addRider(b, x, y, z, { lean: 0.05, inst, handX: x + 0.3, handY: y + 0.3, handW: 0.25, footX: x + 0.25, footY: y - 0.38 }); return; }
  const P = inst ? 2 : 0, cloth = [0.75, 0.25, 0.4];
  for (const s of [-0.07, 0.07]) {
    limb(b, x + s, y + 0.02, z + 0.02, x + s, y + 0.02, z + 0.36, 0.075, cloth, P);       // thighs out to the left
    limb(b, x + s, y + 0.02, z + 0.36, x + s, y - 0.44, z + 0.4, 0.06, cloth, P);         // shins hanging down
  }
  b.addGeo(G.sph2, M(x, y + 0.08, z, 0.17, 0.12, 0.17), cloth, 0, P);
  b.addGeo(G.sph2, M(x, y + 0.36, z, 0.13, 0.3, 0.19), cloth, 0, P);
  limb(b, x, y + 0.6, z, x, y + 0.68, z, 0.045, SKIN);
  b.addGeo(G.sph2, M(x, y + 0.75, z, 0.1, 0.12, 0.095), SKIN);
  b.addGeo(G.sph2, M(x - 0.03, y + 0.79, z, 0.11, 0.09, 0.105), HAIR, 0, inst ? 3 : 0);
  limb(b, x + 0.02, y + 0.52, z - 0.17, x + 0.25, y + 0.3, z - 0.15, 0.04, cloth, P);   // arm forward to the rider
}

// ---------------------------------------------------------------- auto-rickshaw (Bajaj RE style, Pune livery)
// returns { body, glass, wheels: [{x,y,z,r,front}], dims }
export function buildAuto(opts = {}) {
  const b = newB(!opts.solid), gl = newB(false);
  const sh = opts.sepShield ? newB(false) : gl;     // windshield: separate (transparent) for the player
  const R = 0.21, xr = -0.98, xf = 1.0;
  // chassis + floor, and what hangs under it: frame rails, engine and gearbox, rear axle and its dampers, exhaust
  const SEAT = [0.12, 0.1, 0.09], SEAM2 = [0.045, 0.04, 0.038], DARK = [0.13, 0.13, 0.14], RUB = [0.03, 0.03, 0.033], STL = [0.5, 0.5, 0.52];
  rbox(b, -1.3, 0.25, -0.6, 0.6, 0.345, 0.6, BLACK);
  rbox(b, 0.4, 0.25, -0.44, 1.02, 0.34, 0.44, BLACK);
  for (const s of [-1, 1]) rbox(b, -1.32, 0.23, s*0.34 - 0.03, 0.9, 0.29, s*0.34 + 0.03, DARK);
  rbox(b, -1.2, 0.2, -0.26, -0.72, 0.42, 0.14, [0.2, 0.2, 0.21]);                                       // engine
  for (let k = 0; k < 5; k++) rbox(b, -1.14 + k*0.09, 0.19, -0.27, -1.11 + k*0.09, 0.4, 0.15, [0.28, 0.28, 0.29]);       // its fins
  b.addGeo(G.cyl16, M(-0.86, 0.3, 0.22, 0.14, 0.1, 0.14, Math.PI/2), [0.24, 0.24, 0.25]);            // the clutch cover
  b.addGeo(G.cyl12, M(xr, R, 0, 0.032, 1.1, 0.032, Math.PI/2), DARK);
  rbox(b, xr - 0.09, R - 0.08, -0.12, xr + 0.09, R + 0.08, 0.12, [0.16, 0.16, 0.17]);
  for (const s of [-1, 1]) {
    rod(b, [xr + 0.02, R + 0.02, s*0.48], [xr + 0.14, 0.62, s*0.46], 0.016, CHROME);
    rod(b, [xr + 0.03, R + 0.06, s*0.48], [xr + 0.1, 0.46, s*0.47], 0.03, [0.2, 0.2, 0.21]);
  }
  tube(b, [[-0.8, 0.26, -0.2], [-1.1, 0.24, -0.36], [-1.34, 0.26, -0.42], [-1.46, 0.27, -0.42]], 0.02, [0.25, 0.25, 0.26], 10, 6);
  rbox(b, -1.36, 0.22, -0.48, -1.12, 0.31, -0.36, [0.3, 0.3, 0.31]);                                  // silencer
  // rear body tub: one moulded shell with rounded corners, black with the yellow band
  loft(b, [
    { x: -1.4, w: 0.62, yb: 0.31, yt: 0.7, n: 4 },
    { x: -1.35, w: 0.665, yb: 0.28, yt: 0.74, n: 5.5 },
    { x: -0.3, w: 0.665, yb: 0.28, yt: 0.74, n: 5.5 },
    { x: -0.18, w: 0.6, yb: 0.3, yt: 0.7, n: 4 },
  ], (seg, q) => q.ny < -0.6 ? [...BLACK, 0] : (q.y > 0.565 && q.y < 0.645 && Math.abs(q.ny) < 0.6 ? [...AUTO_Y, 0] : [...BLACK, 0]), { ring: 28 });
  // rear mudguard flares
  for (const s of [-1, 1]) guard(b, xr, R + 0.04, s * 0.6, R + 0.08, 0.16, BLACK);
  // tail lamps + plate on the rear face
  for (const s of [-1, 1]) {
    rbox(b, -1.42, 0.41, s*0.42, -1.395, 0.53, s*0.58, RUB);
    b.addGeo(G.sph2, M(-1.415, 0.47, s*0.5, 0.012, 0.045, 0.07), TAIL, 0, 0.9);
    b.addGeo(G.sph2, M(-1.412, 0.52, s*0.55, 0.008, 0.012, 0.018), AMBER, 0, 0.5);
    rbox(b, -1.2, 0.36, s*0.665, -0.76, 0.385, s*0.672, [0.3, 0.3, 0.32]);                             // rubbing strip
    // the engine's side louvres
    for (let k = 0; k < 6; k++) rbox(b, -1.22 + k*0.05, 0.47, s*0.664, -1.2 + k*0.05, 0.545, s*0.672, [0.03, 0.03, 0.033]);
    rbox(b, xr - 0.15, 0.11, s*0.6, xr - 0.13, 0.36, s*0.7, RUB);                                       // mud flap
  }
  rbox(b, -1.425, 0.35, -0.19, -1.395, 0.485, 0.19, RUB);
  box(b, -1.428, 0.365, -0.17, -1.42, 0.47, 0.17, [0.98, 0.82, 0.12]);
  for (const [z0, n] of [[-0.14, 4], [0.03, 4]]) for (let k = 0; k < n; k++) box(b, -1.431, 0.39, z0 + k*0.028, -1.428, 0.445, z0 + k*0.028 + 0.016, [0.05, 0.05, 0.05]);  // the plate's letters
  tube(b, [[-1.34, 0.4, -0.63], [-1.44, 0.4, -0.6], [-1.48, 0.4, -0.3], [-1.48, 0.4, 0.3], [-1.44, 0.4, 0.6], [-1.34, 0.4, 0.63]], 0.013, CHROME, 18, 6);   // bumper bar
  // passenger bench + backrest
  box(b, -1.23, 0.72, -0.56, -0.66, 0.8, 0.56, [0.08, 0.08, 0.085]);
  for (let k = 0; k < 3; k++) {
    const a = -0.6 + k*0.4;
    rbox(b, -1.25, 0.77, a, -0.62, 0.91, a + 0.4, SEAT);                                                 // three cushions on the bench
    rbox(b, -1.335, 0.9, a + 0.005, -1.195, 1.33, a + 0.395, SEAT);
    for (let q = 0; q < 3; q++) box(b, -1.2, 0.97 + q*0.11, a + 0.05, -1.193, 0.978 + q*0.11, a + 0.35, SEAM2);   // stitched rows
    for (let q = 1; q < 3; q++) box(b, -1.21 + q*0.19, 0.905, a + 0.05, -1.206 + q*0.19, 0.911, a + 0.35, SEAM2);
  }
  for (const s of [-1, 1]) { rod(b, [-1.3, 0.92, s*0.61], [-0.72, 0.92, s*0.61], 0.012, CHROME); rod(b, [-0.72, 0.92, s*0.61], [-0.72, 0.76, s*0.61], 0.012, CHROME); }   // armrests
  // the floor's rubber ribs; a bar to hold behind the driver, padded in the middle
  for (let k = 0; k < 8; k++) box(b, -0.58 + k*0.05, 0.33, -0.5, -0.56 + k*0.05, 0.342, 0.5, RUB);
  rod(b, [-0.2, 1.06, -0.6], [-0.2, 1.06, 0.6], 0.014, CHROME);
  rod(b, [-0.2, 1.06, -0.26], [-0.2, 1.06, 0.26], 0.026, SEAT);
  // driver area floor sides & legshield
  rbox(b, -0.2, 0.32, -0.55, 0.62, 0.42, 0.55, BLACK);
  // driver seat
  rbox(b, 0.08, 0.63, -0.25, 0.57, 0.78, 0.25, [0.13, 0.11, 0.1]);
  for (const q of [-0.1, 0.1]) box(b, 0.1, 0.775, q - 0.003, 0.55, 0.781, q + 0.003, SEAM2);
  rbox(b, 0.2, 0.33, -0.13, 0.45, 0.65, 0.13, [0.15, 0.15, 0.15]);
  rod(b, [0.08, 0.72, -0.2], [0.02, 0.96, -0.2], 0.012, DARK); rod(b, [0.08, 0.72, 0.2], [0.02, 0.96, 0.2], 0.012, DARK);
  rbox(b, -0.03, 0.88, -0.24, 0.05, 1.08, 0.24, [0.13, 0.11, 0.1]);                                     // the driver's backrest
  // front cowl: a rounded nose, black with a yellow brow over the windscreen base
  loft(b, [
    { x: 0.55, w: 0.5, yb: 0.3, yt: 1.0, n: 5 },
    { x: 0.95, w: 0.5, yb: 0.3, yt: 1.0, n: 5 },
    { x: 1.1, w: 0.47, yb: 0.31, yt: 0.95, n: 4.5 },
    { x: 1.21, w: 0.39, yb: 0.35, yt: 0.84, n: 4 },
    { x: 1.27, w: 0.27, yb: 0.44, yt: 0.72, n: 3.5 },
  ], (seg, q) => {
    if (seg === 'capRear') return [0.06, 0.06, 0.065, 0];
    if (q.y > 0.9 && q.x > 0.9 && q.ny > 0.25) return [...AUTO_Y, 0];
    return [...BLACK, 0];
  }, { ring: 28 });
  extrude(b, [[0.8, 0.97], [0.93, 0.97], [0.93, 1.075], [0.8, 1.07]], -0.52, 0.52, BLACK, 0, 0.01);        // dash ledge (inside)
  // the dash: speedo in its pod, switches, the fare meter on its bracket, and a lime and chillies on a thread for luck
  rbox(b, 0.78, 1.04, -0.11, 0.86, 1.13, 0.11, DARK);
  b.addGeo(G.circle, M(0.778, 1.087, 0, 0.038, 0.038, 1, 0, -Math.PI / 2), [0.85, 0.85, 0.8]);
  rod(b, [0.777, 1.087, 0], [0.777, 1.11, 0.02], 0.002, [0.9, 0.2, 0.1]);
  for (const q of [-0.3, -0.24, 0.24, 0.3]) b.addGeo(G.cyl8, M(0.8, 1.07, q, 0.012, 0.016, 0.012, 0, 0, Math.PI / 2), RUB);
  rod(b, [0.88, 1.07, -0.42], [0.83, 1.18, -0.42], 0.008, RUB);
  rbox(b, 0.78, 1.15, -0.5, 0.86, 1.27, -0.32, [0.04, 0.04, 0.045]);
  box(b, 0.777, 1.2, -0.48, 0.78, 1.25, -0.34, [1, 0.15, 0.05], 0, 0.8);
  rod(b, [0.84, 1.66, 0.3], [0.84, 1.42, 0.3], 0.002, [0.85, 0.82, 0.75]);
  b.addGeo(G.sphLo, M(0.84, 1.4, 0.3, 0.022, 0.024, 0.022), [0.72, 0.8, 0.2]);
  for (const a of [-0.5, 0, 0.5]) rod(b, [0.84, 1.38, 0.3], [0.84 + a*0.03, 1.29, 0.3 + a*0.04], 0.006, [0.1, 0.42, 0.1]);
  // headlamp + indicators + horn grille
  b.addGeo(G.cyl16, M(1.25, 0.7, 0, 0.105, 0.09, 0.105, 0, 0, Math.PI / 2), BLACK);
  b.addGeo(RING_G, M(1.298, 0.7, 0, 0.098, 0.098, 0.14, 0, Math.PI / 2, 0), CHROME);
  b.addGeo(G.sph2, M(1.283, 0.7, 0, 0.022, 0.09, 0.09), HEAD, 0, 1.0);
  for (const s of [-1, 1]) {
    rbox(b, 1.17, 0.81, s*0.32, 1.235, 0.9, s*0.41, RUB);
    b.addGeo(G.sph2, M(1.228, 0.855, s*0.365, 0.012, 0.036, 0.036), AMBER, 0, 0.7);
    tube(b, [[0.62, 0.32, s*0.5], [0.95, 0.31, s*0.5], [1.12, 0.33, s*0.46], [1.22, 0.38, s*0.38]], 0.008, [0.03, 0.03, 0.033], 10, 4);  // the panel's lower seam
    tube(b, [[0.62, 0.98, s*0.505], [0.9, 0.98, s*0.505]], 0.006, [0.03, 0.03, 0.033], 3, 4);
    rod(b, [1.02, 0.58, s*0.46], [1.02, 0.72, s*0.46], 0.005, [0.03, 0.03, 0.033]);
  }
  rbox(b, 1.2, 0.44, -0.14, 1.262, 0.58, 0.14, RUB);
  for (let k = 0; k < 5; k++) box(b, 1.255, 0.46 + k*0.022, -0.115, 1.268, 0.47 + k*0.022, 0.115, [0.3, 0.3, 0.31]);       // the horn's grille
  rbox(b, 1.08, 0.31, -0.16, 1.2, 0.41, 0.16, [0.14, 0.14, 0.15]);
  box(b, 1.19, 0.325, -0.13, 1.204, 0.4, 0.13, [0.98, 0.82, 0.12]);                                       // front plate
  // windshield frame + glass + yellow visor
  const scrX = (y, z) => 0.957 - (y - 1.26)*0.08 - 0.05*(z*z)/(0.54*0.54);
  for (const s of [-1, 1]) tube(b, [[scrX(1.0, 0.54), 1.0, s*0.54], [scrX(1.26, 0.54), 1.26, s*0.54], [scrX(1.52, 0.54), 1.52, s*0.54]], 0.021, BLACK, 6, 6);
  rbox(b, 0.89, 1.5, -0.59, 1.03, 1.6, 0.59, AUTO_Y);                                                     // the yellow brow
  rbox(b, 0.98, 1.495, -0.56, 1.05, 1.525, 0.56, BLACK);                                                  // its lip
  for (const q of [-1, 1]) tube(b, [[scrX(1.03, 0.5), 1.03, q*0.5], [scrX(1.26, 0.5), 1.26, q*0.5], [scrX(1.49, 0.5), 1.49, q*0.5]], 0.009, RUB, 5, 4);
  tube(b, [[scrX(1.03, 0.5), 1.03, -0.5], [scrX(1.02, 0), 1.022, 0], [scrX(1.03, 0.5), 1.03, 0.5]], 0.009, RUB, 8, 4);
  tube(b, [[scrX(1.49, 0.5), 1.49, -0.5], [scrX(1.5, 0), 1.495, 0], [scrX(1.49, 0.5), 1.49, 0.5]], 0.009, RUB, 8, 4);
  patch(sh, 12, 6, (u, v) => { const y = 1.03 + 0.46*v, z = (u - 0.5)*1.02; return [scrX(y, z), y, z]; }, opts.sepShield ? [0.75, 0.82, 0.86, 0] : [0.1, 0.12, 0.14, 0], [1, 0.08, 0]);
  rod(b, [scrX(1.04, 0.1), 1.05, 0.1], [scrX(1.36, 0.34) + 0.012, 1.36, 0.34], 0.004, RUB);               // wiper
  b.addGeo(G.cyl8, M(scrX(1.04, 0.1) + 0.004, 1.05, 0.1, 0.012, 0.018, 0.012, 0, 0, Math.PI / 2), RUB);
  // handlebar (separate for the player so it can turn with the steering, pivot at the column top)
  const hb = opts.sepBar ? newB(false) : b, bo = opts.sepBar ? AUTO_BAR_PIVOT : [0, 0, 0];
  hb.addGeo(G.cyl8, M(0.72 - bo[0], 1.06 - bo[1], 0, 0.018, 0.78, 0.018, Math.PI / 2), CHROME);
  for (const s of [-1, 1]) hb.addGeo(G.cyl8, M(0.72 - bo[0], 1.06 - bo[1], s * 0.36, 0.03, 0.12, 0.03, Math.PI / 2), BLACK);
  if (opts.sepBar) {
    // little switch pods + brake lever so the turning bar reads clearly from the seat
    hb.addGeo(G.box, M(0.72 - bo[0], 1.075 - bo[1], -0.25, 0.05, 0.04, 0.06), [0.12, 0.12, 0.13]);
    hb.addGeo(G.box, M(0.72 - bo[0], 1.075 - bo[1], 0.25, 0.05, 0.04, 0.06), [0.12, 0.12, 0.13]);
    hb.addGeo(G.box, M(0.79 - bo[0], 1.06 - bo[1], 0.33, 0.015, 0.012, 0.16, 0.3), CHROME);
    hb.addGeo(G.box, M(0.72 - bo[0], 1.1 - bo[1], 0, 0.06, 0.03, 0.09), [0.1, 0.1, 0.1]);
  }
  b.addGeo(G.cyl8, M(0.82, 0.75, 0, 0.03, 0.62, 0.03, 0, 0, 0.35), BLACK);
  // fare meter on the dash (left side)
  box(b, 0.78, 1.0, -0.42, 0.9, 1.12, -0.22, [0.15, 0.15, 0.16]);
  box(b, 0.776, 1.05, -0.4, 0.78, 1.1, -0.24, [1.0, 0.18, 0.08], 0, 0.8);       // LED faces the driver & passengers
  box(b, 0.775, 1.015, -0.4, 0.78, 1.04, -0.24, [0.05, 0.05, 0.05]);
  // mirrors
  for (const s of [-1, 1]) {
    b.addGeo(G.cyl8, M(0.98, 1.25, s * 0.62, 0.01, 0.3, 0.01, s * 0.6, 0, 0), BLACK);
    b.addGeo(G.sph2, M(1.0, 1.38, s * 0.72, 0.016, 0.075, 0.055), [0.05, 0.05, 0.055]);
    b.addGeo(G.sph2, M(0.992, 1.38, s * 0.72, 0.012, 0.066, 0.047), [0.55, 0.62, 0.66]);
  }
  // canopy: one rounded canvas hood over a frame, roof, rear wall and rear quarter panels; the sides
  // are open over the passenger bench and the driver (inside faces are drawn too)
  const roofY = 1.66, HOOD_SEAMS = [-0.5, 0, 0.45];
  loft(b, [
    { x: -1.43, w: 0.66, yb: 0.74, yt: roofY + 0.02, n: 7, seg: 'quarter' },
    { x: -1.37, w: 0.7, yb: 0.74, yt: roofY + 0.04, n: 8, seg: 'quarter' },
    ...[-1.2].flatMap(c => [c - 0.009, c + 0.009].map(x => ({ x, w: 0.7, yb: 0.74, yt: roofY + 0.04, n: 8, seg: 'quarter' }))),
    { x: -0.97, w: 0.7, yb: 0.74, yt: roofY + 0.04, n: 8, seg: 'open' },
    ...HOOD_SEAMS.flatMap(c => [c - 0.009, c + 0.009].map(x => { const k = (x + 0.97)/1.87; return { x, w: 0.7 - 0.04*k, yb: 0.74, yt: roofY + 0.04 - 0.02*k, n: 8, seg: 'open' }; })),
    { x: 0.9, w: 0.66, yb: 0.74, yt: roofY + 0.02, n: 8, seg: 'nose' },
    { x: 1.0, w: 0.6, yb: 1.46, yt: roofY - 0.02, n: 5 },
  ], (seg, q) => {
    const seam = [-1.2, ...HOOD_SEAMS].some(c => Math.abs(q.x - c) < 0.009 ), CANVAS = seam ? [0.022, 0.022, 0.024, 0, MATTE] : [...BLACK, 1, MATTE];
    if (seg === 'capRear') return CANVAS;
    if (seg === 'capFront') return [...AUTO_Y, 0];
    if (q.ny < -0.5) return null;                                          // no floor in the hood
    if (seg === 'nose') return q.y > 1.52 ? (q.y < 1.6 && q.nx > 0.3 ? [...AUTO_Y, 0] : CANVAS) : null;
    if (seg === 'open') return q.y > 1.5 ? CANVAS : null;
    // rear quarters: canvas down to the tub, with a yellow trim line along the bottom edge
    if (q.y < 0.95) return null;
    return q.y < 1.0 ? [...AUTO_Y, 0] : CANVAS;
  }, { ring: 32, inner: 0.02 });
  for (const s of [-1, 1]) {
    b.addGeo(G.cyl8, M(-0.32, 1.16, s * 0.63, 0.018, 0.95, 0.018), CHROME);     // grab bar at the passenger opening
    b.addGeo(G.cyl8, M(0.6, 1.33, s * 0.6, 0.018, 0.62, 0.018), BLACK);           // front strut
    b.addGeo(G.cyl8, M(-0.97, 1.2, s * 0.66, 0.02, 0.95, 0.02), BLACK);           // hood frame at the opening
  }
  // the hood's seams and the bows under the canvas, and the side curtains rolled up and strapped
  for (const s of [-1, 1]) {
    tube(b, [[-0.95, 1.5, s*0.685], [-0.3, 1.51, s*0.69], [0.5, 1.5, s*0.668]], 0.036, [0.09, 0.085, 0.08], 14, 7, 0, MATTE);
    b.addGeo(G.sph2, M(-0.95, 1.5, s*0.685, 0.036, 0.036, 0.036), [0.09, 0.085, 0.08]); b.addGeo(G.sph2, M(0.5, 1.5, s*0.668, 0.036, 0.036, 0.036), [0.09, 0.085, 0.08]);
    for (const x of [-0.72, -0.2, 0.28]) { const z = s*(0.69 - (x > 0 ? x*0.03 : 0)); tube(b, [[x, 1.56, z - s*0.025], [x, 1.52, z + s*0.04], [x, 1.46, z + s*0.012]], 0.007, [0.035, 0.035, 0.038], 6, 4); }
    for (let k = 0; k < 4; k++) b.addGeo(G.cyl8, M(-1.33 + k*0.11, 1.03, s*0.702, 0.012, 0.008, 0.012, Math.PI/2), CHROME);    // press studs along the quarter's hem
  }
  // rear window (clear plastic) with a stitched canvas surround, on the back wall
  patch(b, 8, 4, (u, v) => [-1.433, 1.235 + 0.25*v, (u - 0.5)*0.72], [0.035, 0.035, 0.038, 0], [-1, 0, 0]);
  gl.addGeo(G.box, M(-1.436, 1.36, 0, 0.01, 0.2, 0.62), [0.1, 0.12, 0.14]);
  box(b, -1.442, 1.25, -0.33, -1.434, 1.262, 0.33, CHROME); box(b, -1.442, 1.458, -0.33, -1.434, 1.47, 0.33, CHROME);
  b.addGeo(G.cyl8, M(-1.44, 0.8, 0, 0.02, 1.0, 0.02, Math.PI / 2), CHROME);   // rear grab rail
  // front fork + mudguard
  b.addGeo(G.cyl8, M(xf + 0.02, 0.48, 0, 0.03, 0.55, 0.03, 0, 0, 0.25), CHROME);
  for (const s of [-1, 1]) { rod(b, [xf, R, s*0.075], [xf + 0.1, 0.58, s*0.05], 0.018, BLACK); rod(b, [xf + 0.03, R + 0.08, s*0.082], [xf + 0.12, 0.54, s*0.06], 0.026, [0.2, 0.2, 0.21]); }
  b.addGeo(G.cyl12, M(xf, R, 0, 0.022, 0.2, 0.022, Math.PI / 2), STL);
  guard(b, xf, R + 0.02, 0, R + 0.06, 0.16, BLACK);
  // driver (only when asked: player version draws its own)
  if (opts.driver) {
    addRider(b, 0.32, 0.8, 0, { lean: 0.08, shirt: opts.driverShirt || [0.95, 0.95, 0.92], pants: [0.25, 0.22, 0.2], handX: 0.72, handY: 1.07, handW: 0.33, footX: 0.66, footY: 0.42, inst: !!opts.inst });
  }
  const wheels = [{ x: xf, y: R, z: 0, r: R, w: 0.12, front: true }, { x: xr, y: R, z: -0.58, r: R, w: 0.13 }, { x: xr, y: R, z: 0.58, r: R, w: 0.13 }];
  if (opts.withWheels) for (const w of wheels) wheel(b, w.x, w.y, w.z, w.r, w.w);
  return { body: b.build(), glass: gl.build(), shield: opts.sepShield ? sh.build() : null, bar: opts.sepBar ? hb.build() : null, barPivot: AUTO_BAR_PIVOT, barAxis: AUTO_BAR_AXIS,
    wheels, dims: { L: 2.7, W: 1.4, H: 1.75, wb: 2.0 } };
}
export const AUTO_BAR_PIVOT = [0.715, 1.045, 0];
export const AUTO_BAR_AXIS = [-0.343, 0.939, 0];     // the steering column leans back towards the driver

// ---------------------------------------------------------------- two-wheelers
// ---------------------------------------------------------------- the /beta kit: everything below builds real shapes
const LATHE = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// a car tyre: rounded shoulders, tread grooves. Unit radius, unit width, axle along y
const TYRE_G = LATHE([[.6, -.47], [.74, -.5], [.87, -.5], [.95, -.47], [.99, -.38], [1, -.3], [1, -.16], [.975, -.14], [.975, -.08], [1, -.06], [1, .06], [.975, .08], [.975, .14], [1, .16], [1, .3], [.99, .38], [.95, .47], [.87, .5], [.74, .5], [.6, .47]], 20);
// a two-wheeler's tyre: round in section
const TYRE2_G = LATHE([[.76, -.34], [.82, -.46], [.9, -.5], [.96, -.42], [.995, -.22], [1, 0], [.995, .22], [.96, .42], [.9, .5], [.82, .46], [.76, .34]], 22);
const RIM2_G = LATHE([[.72, -.28], [.79, -.34], [.8, -.2], [.76, 0], [.8, .2], [.79, .34], [.72, .28], [.7, 0]], 22);
const DISH_G = LATHE([[.68, .5], [.62, .46], [.58, .12], [.2, .08], [0, .08]], 22);
const TUBE6 = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const HUB_G = new THREE.CylinderGeometry(1, 1, 1, 12);
const RING_G = new THREE.TorusGeometry(1, .08, 5, 18);
// a soft box (a superellipsoid). Unit size, centred
const RB = (() => { const g = new THREE.SphereGeometry(.5, 10, 7), p = g.attributes.position; const f = v => Math.sign(v)*Math.pow(Math.abs(v*2), .4)*.5;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, f(p.getX(i)), f(p.getY(i)), f(p.getZ(i))); g.computeVertexNormals(); return g; })();
function rbox(b, x0, y0, z0, x1, y1, z1, c, paint = 0, glow = 0) { b.addGeo(RB, M((x0 + x1)/2, (y0 + y1)/2, (z0 + z1)/2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), c, glow, paint); }
function tube(b, pts, r, c, seg = 10, rad = 6, paint = 0, glow = 0) {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), seg, r, rad, false);
  b.addGeo(g, M(0, 0, 0), c, glow, paint); g.dispose();
}
// a cylinder between two points (no caps)
const _yUp = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
function rod(b, a, e, r, c, geo = TUBE6, paint = 0, glow = 0) {
  _d.set(e[0] - a[0], e[1] - a[1], e[2] - a[2]); const L = _d.length(); _q.setFromUnitVectors(_yUp, _d.divideScalar(L || 1));
  b.addGeo(geo, _m.compose(_p.set((a[0] + e[0])/2, (a[1] + e[1])/2, (a[2] + e[2])/2), _q, _s.set(r, L, r)), c, glow, paint);
}
function axle(x, y, z, sr, sw, side = 1) { return M(x, y, z, sr, sw, sr, side*Math.PI/2); }
// a car's wheel: tyre, dished rim with spokes and nuts, the brake disc behind. `side` is which way it faces out
const SPOKES = [5, 6, 7, 5, 10];
function wheel(b, x, y, z, r, w, hub = RIM, style = 0) {
  if (WHEELS) WHEELS.push({ x, y, z, r, w });
  const side = z >= 0 ? 1 : -1;
  b.addGeo(TYRE_G, axle(x, y, z, r, w, side), TYRE, MATTE);
  b.addGeo(DISH_G, axle(x, y, z, r, w, side), hub);
  b.addGeo(HUB_G, axle(x, y, z - side*w*.3, r*.5, w*.06, side), [.3, .3, .32]);                       // brake disc
  const n = SPOKES[style % SPOKES.length], rr = r*.6;
  for (let i = 0; i < n; i++) {
    const a = i/n*Math.PI*2, ca = Math.cos(a), sa = Math.sin(a), wd = r*(n > 6 ? .07 : .12);
    _e.set(0, 0, a); _q.setFromEuler(_e);
    b.addGeo(RB, _m.compose(_p.set(x + ca*rr*.55, y + sa*rr*.55, z + side*w*.36), _q, _s.set(rr*.95, wd, w*.16)), hub);
  }
  b.addGeo(HUB_G, axle(x, y, z + side*w*.38, r*.17, w*.16, side), hub);
  for (let i = 0; i < 4; i++) { const a = i/4*Math.PI*2 + .5; b.addGeo(G.sphLo, M(x + Math.cos(a)*r*.11, y + Math.sin(a)*r*.11, z + side*w*.46, r*.022, r*.022, r*.022), [.25, .25, .27]); }
}
// a two-wheeler's wheel: thin round tyre, rim, spokes (or cast arms), hub, drum or disc
function wheel2(b, x, y, z, r, w, opts = {}) {
  if (WHEELS) WHEELS.push({ x, y, z, r, w });
  b.addGeo(TYRE2_G, axle(x, y, z, r, w), TYRE, MATTE);
  b.addGeo(RIM2_G, axle(x, y, z, r, w), opts.cast ? BLACK : CHROME);
  b.addGeo(HUB_G, axle(x, y, z, r*.2, w*.9), GREY);
  if (opts.cast) for (let i = 0; i < 5; i++) { const a = i/5*Math.PI*2, ca = Math.cos(a), sa = Math.sin(a); _e.set(0, 0, a); _q.setFromEuler(_e);
    b.addGeo(RB, _m.compose(_p.set(x + ca*r*.45, y + sa*r*.45, z), _q, _s.set(r*.6, r*.09, w*.34)), BLACK); }
  else for (let i = 0; i < 16; i++) { const a = i/16*Math.PI*2, ca = Math.cos(a), sa = Math.sin(a), a2 = a + (i % 2 ? .5 : -.5), sd = i % 2 ? 1 : -1;
    rod(b, [x + Math.cos(a2)*r*.16, y + Math.sin(a2)*r*.16, z + sd*w*.34], [x + ca*r*.74, y + sa*r*.74, z], .0035, CHROME); }
  if (opts.disc) { b.addGeo(HUB_G, axle(x, y, z + w*.42, r*.36, .006), [.55, .55, .58]); rbox(b, x + r*.22, y + r*.08, z + w*.36, x + r*.42, y + r*.36, z + w*.5, BLACK); }
  else b.addGeo(HUB_G, axle(x, y, z + w*.3, r*.36, w*.3), [.4, .4, .42]);
}

// A surface as a grid of points. outward = (along i) x (along k). Neighbouring quads of a colour share vertices, and the
// normals run smooth over the grid, so a panel is a panel; colours change exactly along the grid lines, so a window's
// edge is straight.
function gridSurface(b, P, colorOf, opts = {}) {
  const S = P.length, K = P[0].length, closed = !!opts.closed;
  const N = P.map(r => r.map(() => [0, 0, 0]));
  for (let i = 0; i < S; i++) for (let k = 0; k < K; k++) {
    const ka = closed ? (k + 1) % K : Math.min(K - 1, k + 1), kb = closed ? (k - 1 + K) % K : Math.max(0, k - 1), ia = Math.min(S - 1, i + 1), ib = Math.max(0, i - 1);
    const t = P[i][ka], t0 = P[i][kb], l = P[ia][k], l0 = P[ib][k];
    const tx = t[0] - t0[0], ty = t[1] - t0[1], tz = t[2] - t0[2]; let lx = l[0] - l0[0], ly = l[1] - l0[1], lz = l[2] - l0[2];
    let nx = ly*tz - lz*ty, ny = lz*tx - lx*tz, nz = lx*ty - ly*tx; const L = Math.hypot(nx, ny, nz);
    if (L < 1e-9) { N[i][k] = opts.up || [0, 1, 0]; continue; }
    N[i][k] = [nx/L, ny/L, nz/L];
  }
  const inner = opts.inner, ids = new Map(), ids2 = new Map();
  const vert = (i, k, col) => { const key = (i*4096 + k) + '|' + col.join(); let id = ids.get(key); if (id === undefined) { const p = P[i][k], n = N[i][k]; id = b.v(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], col[4] || 0, col[3] || 0); ids.set(key, id); } return id; };
  const vin = (i, k, col) => { const key = (i*4096 + k) + '|' + col.join(); let id = ids2.get(key); if (id === undefined) { const p = P[i][k], n = N[i][k]; id = b.v(p[0] - n[0]*inner, p[1] - n[1]*inner, p[2] - n[2]*inner, -n[0], -n[1], -n[2], col[0], col[1], col[2], col[4] || 0, col[3] || 0); ids2.set(key, id); } return id; };
  for (let i = 0; i < S - 1; i++) for (let k = 0; k < (closed ? K : K - 1); k++) {
    const k2 = (k + 1) % K, p = [P[i][k], P[i][k2], P[i + 1][k2], P[i + 1][k]];
    if (opts.skip && opts.skip(i, k, k2)) continue;
    const n = [(N[i][k][0] + N[i][k2][0] + N[i + 1][k][0] + N[i + 1][k2][0])/4, (N[i][k][1] + N[i][k2][1] + N[i + 1][k][1] + N[i + 1][k2][1])/4, (N[i][k][2] + N[i][k2][2] + N[i + 1][k][2] + N[i + 1][k2][2])/4];
    const q = { x: (p[0][0] + p[1][0] + p[2][0] + p[3][0])/4, y: (p[0][1] + p[1][1] + p[2][1] + p[3][1])/4, z: (p[0][2] + p[1][2] + p[2][2] + p[3][2])/4, nx: n[0], ny: n[1], nz: n[2], i, k };
    const col = colorOf(q);
    if (col) { const a = vert(i, k, col), c1 = vert(i, k2, col), c2 = vert(i + 1, k2, col), d = vert(i + 1, k, col); b.i.push(a, d, c2, a, c2, c1); }
    if (inner) { q.inside = true; const ci = colorOf(q); if (ci) { const a = vin(i, k, ci), c1 = vin(i, k2, ci), c2 = vin(i + 1, k2, ci), d = vin(i + 1, k, ci); b.i.push(a, c2, d, a, c1, c2); } }
  }
}
// a small patch over any surface: fn(u, v) gives the point; out says which way it should face
function patch(b, nu, nv, fn, col, out) {
  const P = []; for (let i = 0; i <= nu; i++) { const r = []; for (let k = 0; k <= nv; k++) r.push(fn(i/nu, k/nv)); P.push(r); }
  const a = P[0][0], e = P[nu][0], f = P[0][nv], lx = e[0] - a[0], ly = e[1] - a[1], lz = e[2] - a[2], tx = f[0] - a[0], ty = f[1] - a[1], tz = f[2] - a[2];
  if ((ly*tz - lz*ty)*out[0] + (lz*tx - lx*tz)*out[1] + (lx*ty - ly*tx)*out[2] < 0) P.reverse();
  gridSurface(b, P, () => col);
}
const lerp = (a, e, k) => a + (e - a)*k, sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
// interpolate a table of rows through x (Catmull-Rom, tangents from the neighbours)
function tableAt(T, x, c) {
  if (x <= T[0][0]) return T[0][c]; const n = T.length; if (x >= T[n - 1][0]) return T[n - 1][c];
  let i = 0; while (x > T[i + 1][0]) i++;
  const x0 = T[i][0], x1 = T[i + 1][0], h = x1 - x0, t = (x - x0)/h, y0 = T[i][c], y1 = T[i + 1][c];
  const m = (j) => { const a = T[Math.max(0, j - 1)], e = T[Math.min(n - 1, j + 1)]; return (e[c] - a[c])/(e[0] - a[0]); };
  const lim = (v) => { const d = Math.abs(y1 - y0)/h*3; return Math.max(-d - 1e-4, Math.min(d + 1e-4, v)); };
  const m0 = lim(m(i))*h, m1 = lim(m(i + 1))*h, t2 = t*t, t3 = t2*t;
  return (2*t3 - 3*t2 + 1)*y0 + (t3 - 2*t2 + t)*m0 + (-2*t3 + 3*t2)*y1 + (t3 - t2)*m1;
}
function stationsOf(list, min = .012) { const s = list.slice().sort((a, b) => a - b), o = [s[0]]; for (const x of s) if (x - o[o.length - 1] > min) o.push(x); return o; }

// the pieces every two-wheeler has: bars with grips and levers, mirrors, indicators, plates, stands, a chain of parts that say what it is
function bars(b, x, y, w, c = BLACK) {
  tube(b, [[x - .02, y, -w], [x - .01, y + .025, -w*.6], [x + .01, y + .035, 0], [x - .01, y + .025, w*.6], [x - .02, y, w]], .011, c, 10, 5);
  for (const s of [-1, 1]) {
    rod(b, [x - .02, y, s*(w - .11)], [x - .02, y, s*(w + .005)], .018, BLACK, HUB_G);
    rbox(b, x - .05, y - .012, s*(w - .13), x + .01, y + .025, s*(w - .09), [.09, .09, .1]);                         // switch pod
    tube(b, [[x + .005, y + .012, s*(w - .12)], [x + .05, y + .005, s*(w - .08)], [x + .055, y - .005, s*(w - .01)]], .005, [.62, .62, .65], 5, 4);    // lever
    tube(b, [[x - .03, y + .02, s*(w - .14)], [x - .05, y + .09, s*(w - .11)], [x - .07, y + .17, s*(w - .08)]], .005, CHROME, 5, 4);    // mirror stalk
    b.addGeo(G.sph2, M(x - .07, y + .2, s*(w - .07), .012, .042, .065), BLACK);
    b.addGeo(G.sph2, M(x - .08, y + .2, s*(w - .07), .004, .035, .056), [.45, .5, .55], 0, 4);
  }
}
function winker(b, x, y, z, sx = 1) { rod(b, [x, y, z - Math.sign(z)*.04], [x, y, z], .006, BLACK, HUB_G); b.addGeo(G.sph2, M(x, y, z, .018, .018, .03), AMBER, .7); }
export function buildScooter(opts = {}) {
  const b = newB(true), gl = newB(false);
  const R = 0.25;
  const paint = [1, 1, 1, 1];
  const PLASTIC = [.14, .14, .15, 0, MATTE];
  // rear body: side panels over the engine, with a crease, tapering to the tail
  loft(b, [
    { x: -0.9, w: 0.08, yb: 0.47, yt: 0.6, n: 2.6 }, { x: -0.885, w: 0.12, yb: 0.43, yt: 0.63, n: 3 }, { x: -0.83, w: 0.175, yb: 0.36, yt: 0.68, n: 3.4 }, { x: -0.72, w: 0.2, yb: 0.31, yt: 0.71, n: 3.6 },
    { x: -0.58, w: 0.21, yb: 0.285, yt: 0.72, n: 3.6 }, { x: -0.45, w: 0.215, yb: 0.28, yt: 0.72, n: 3.6 }, { x: -0.3, w: 0.205, yb: 0.285, yt: 0.7, n: 3.4 }, { x: -0.18, w: 0.19, yb: 0.3, yt: 0.665, n: 3.2 }, { x: -0.1, w: 0.15, yb: 0.33, yt: 0.56, n: 3 }, { x: -0.06, w: 0.11, yb: 0.36, yt: 0.48, n: 2.8 },
  ], (seg, q) => (q.y < .385 && Math.abs(q.ny) < .9) ? PLASTIC : paint, { ring: 34 });
  // seat: a cushion with a step in it, its piping and hinge
  loft(b, [
    { x: -0.79, w: 0.1, yb: 0.69, yt: 0.755, n: 2.5 }, { x: -0.74, w: 0.145, yb: 0.69, yt: 0.8, n: 2.8 }, { x: -0.6, w: 0.165, yb: 0.69, yt: 0.815, n: 3 }, { x: -0.44, w: 0.175, yb: 0.69, yt: 0.8, n: 3 },
    { x: -0.38, w: 0.18, yb: 0.69, yt: 0.775, n: 3 }, { x: -0.26, w: 0.17, yb: 0.69, yt: 0.785, n: 3 }, { x: -0.16, w: 0.135, yb: 0.69, yt: 0.77, n: 2.8 }, { x: -0.1, w: 0.09, yb: 0.69, yt: 0.73, n: 2.4 },
  ], () => [0.07, 0.07, 0.075, 0, MATTE], { ring: 26 });
  tube(b, [[-.8, .69, 0], [-.74, .687, .15], [-.44, .685, .178], [-.16, .687, .137], [-.1, .69, 0]], .004, [.16, .16, .17], 14, 3);
  tube(b, [[-.8, .69, 0], [-.74, .687, -.15], [-.44, .685, -.178], [-.16, .687, -.137], [-.1, .69, 0]], .004, [.16, .16, .17], 14, 3);
  // grab rail behind the seat
  tube(b, [[-.46, .695, .17], [-.72, .71, .155], [-.83, .73, .08], [-.85, .735, 0], [-.83, .73, -.08], [-.72, .71, -.155], [-.46, .695, -.17]], .012, [.11, .11, .115], 18, 5);
  // tail: lamp cluster, indicators, plate on its bracket, rear mudguard
  rbox(b, -.905, .5, -.1, -.875, .595, .1, [.5, .03, .03], 0, .9);
  rbox(b, -.91, .525, -.055, -.89, .57, .055, TAIL, 0, 1);
  for (const s of [-1, 1]) b.addGeo(G.sph2, M(-.888, .535, s*.11, .014, .02, .03), AMBER, .7);
  guard(b, -0.62, R + .03, 0, R + .045, .11, BLACK, 0);
  rbox(b, -.93, .3, -.08, -.86, .4, .08, BLACK);
  box(b, -.936, .3, -.085, -.93, .4, .085, [.98, .98, .95]);
  // floorboard: rubber mat, ribs, the spine up to the shield
  rbox(b, -.28, .255, -.185, .5, .335, .185, [.06, .06, .065], 0, MATTE);
  for (let i = 0; i < 9; i++) box(b, -.22 + i*.075, .331, -.14, -.195 + i*.075, .34, .14, [.11, .11, .115], 0, MATTE);
  loft(b, [{ x: -.1, w: .1, yb: .3, yt: .4, n: 3 }, { x: .2, w: .1, yb: .3, yt: .37, n: 3 }, { x: .46, w: .1, yb: .3, yt: .44, n: 3 }], () => PLASTIC, { ring: 14 });
  // the shield: curved, with a recess down the middle, side indicators, a glovebox on the inside
  loft(b, [
    { x: 0.4, w: 0.15, yb: 0.3, yt: 0.4, n: 3, tw: .9 }, { x: 0.47, w: 0.19, yb: 0.3, yt: 0.6, n: 3.4, tw: .9 }, { x: 0.53, w: 0.205, yb: 0.31, yt: 0.82, n: 3.5, tw: .88 }, { x: 0.58, w: 0.21, yb: 0.32, yt: 0.95, n: 3.5, tw: .86 },
    { x: 0.63, w: 0.205, yb: 0.34, yt: 0.985, n: 3.3, tw: .86 }, { x: 0.68, w: 0.19, yb: 0.37, yt: 0.985, n: 3, tw: .86 }, { x: 0.72, w: 0.155, yb: 0.44, yt: 0.93, n: 2.7, tw: .86 }, { x: 0.74, w: 0.1, yb: 0.52, yt: 0.86, n: 2.4, tw: .9 },
  ], () => paint, { ring: 34 });
  rbox(b, .44, .44, -.14, .5, .72, .14, [.09, .09, .095], 0, MATTE);
  box(b, .745, .56, -.018, .755, .82, .018, [.2, .2, .21]);
  for (const s of [-1, 1]) { rbox(b, .72, .7, s*.13, .75, .75, s*.18, AMBER, 0, .6); rbox(b, .71, .72, s*.11, .74, .78, s*.19, [.75, .76, .78], 0, 0); }
  // handlebar cowl, with the headlamp in it, the speedo on top
  loft(b, [
    { x: 0.53, w: 0.2, yb: 0.965, yt: 1.03, n: 3 }, { x: 0.58, w: 0.29, yb: 0.965, yt: 1.05, n: 3 }, { x: 0.64, w: 0.31, yb: 0.96, yt: 1.065, n: 3 }, { x: 0.69, w: 0.26, yb: 0.955, yt: 1.05, n: 2.8 }, { x: 0.73, w: 0.16, yb: 0.965, yt: 1.02, n: 2.5 },
  ], () => paint, { ring: 22 });
  rbox(b, .715, .945, -.11, .755, 1.03, .11, [.7, .72, .74]);
  b.addGeo(G.sph2, M(.745, .988, 0, .022, .038, .085), HEAD, 1, 0);
  rbox(b, .53, 1.03, -.08, .6, 1.07, .08, BLACK); box(b, .545, 1.069, -.055, .59, 1.072, .055, [.72, .78, .8], 0, .15);
  bars(b, .6, 1.02, .37);
  // the fork, the front mudguard hugging the wheel, plate on the guard
  rod(b, [.68, .56, -.05], [.66, .25, -.05], .017, CHROME, HUB_G); rod(b, [.68, .56, .05], [.66, .25, .05], .017, CHROME, HUB_G);
  rod(b, [.72, .78, 0], [.68, .5, 0], .025, [.12, .12, .13], HUB_G);
  guard(b, 0.66, R + 0.012, 0, R + 0.03, 0.115, [1, 1, 1], 1);
  // the engine and swing arm: rounded case on the left, fan cover, the silencer on the right, the shock
  rbox(b, -.66, .2, -.1, -.14, .37, -.02, [.32, .32, .34]);
  for (let i = 0; i < 5; i++) box(b, -.56 + i*.09, .21, -.106, -.53 + i*.09, .35, -.098, [.22, .22, .24]);
  rbox(b, -.26, .2, -.14, -.08, .38, -.05, [.2, .2, .21]);
  rod(b, [-.75, .3, .12], [-.42, .28, .12], .05, [.34, .34, .36], HUB_G); rod(b, [-.79, .305, .12], [-.75, .3, .12], .02, CHROME, HUB_G);
  rbox(b, -.52, .24, .08, -.36, .34, .17, [.3, .3, .32]);
  rod(b, [-.66, .32, -.09], [-.62, .63, -.14], .018, CHROME, HUB_G); for (let i = 0; i < 6; i++) b.addGeo(RING_G, M(lerp(-.654, -.625, i/6), lerp(.36, .6, i/6), lerp(-.1, -.135, i/6), .028, .028, .05, Math.PI/2), [.75, .15, .1]);
  // the pillion's footrests; both stands
  for (const s of [-1, 1]) { rbox(b, -.42, .36, s*.2, -.3, .38, s*.28, BLACK); }
  if (!opts.parked && !opts.noRider) {
    addRider(b, -0.38, 0.8, 0, { lean: 0.05, inst: true, handX: 0.62, handY: 1.0, handW: 0.3, footX: 0.12, footY: 0.36, helmet: opts.helmet ? [0.2, 0.2, 0.2] : null });
    if (opts.pillion) addPillion(b, -0.72, 0.82, 0, opts.sideSaddle, true);
  } else if (opts.parked) { rod(b, [-.22, .28, -.13], [-.3, .02, -.26], .012, CHROME, HUB_G); rbox(b, -.34, .0, -.29, -.27, .02, -.23, BLACK); rod(b, [-.2, .24, -.08], [-.2, .03, -.09], .012, GREY, HUB_G); rod(b, [-.2, .24, .08], [-.2, .03, .09], .012, GREY, HUB_G); }
  wheel2(b, 0.66, R, 0, R, 0.1, { cast: true, disc: true }); wheel2(b, -0.62, R, 0, R, 0.11, { cast: true });
  return { body: b.build(), glass: gl.build(), dims: { L: 1.85, W: 0.72, H: 1.6, wb: 1.28 } };
}
export function buildBike(opts = {}) {
  const b = newB(true), gl = newB(false);
  const R = 0.3, paint = [1, 1, 1, 1], STEEL = [.5, .5, .52], DARKS = [.17, .17, .18], FRAME = [.08, .08, .085];
  // tank: full at the top, knee dents, a filler cap, a stripe
  loft(b, [
    { x: -0.1, w: 0.075, yb: 0.82, yt: 0.91, n: 2.4 }, { x: -0.05, w: 0.115, yb: 0.8, yt: 0.96, n: 2.6 }, { x: 0.02, w: 0.145, yb: 0.79, yt: 1.0, n: 2.8 }, { x: 0.1, w: 0.15, yb: 0.79, yt: 1.02, n: 2.8, bw: .72 }, { x: 0.2, w: 0.16, yb: 0.79, yt: 1.035, n: 2.8, bw: .7 },
    { x: 0.3, w: 0.155, yb: 0.8, yt: 1.035, n: 2.8, bw: .72 }, { x: 0.4, w: 0.13, yb: 0.82, yt: 1.015, n: 2.7 }, { x: 0.47, w: 0.1, yb: 0.85, yt: 0.985, n: 2.5 }, { x: 0.52, w: 0.06, yb: 0.88, yt: 0.95, n: 2.3 },
  ], () => paint, { ring: 34 });
  b.addGeo(HUB_G, M(.19, 1.04, 0, .045, .014, .045), CHROME); b.addGeo(HUB_G, M(.19, 1.05, 0, .022, .012, .022), [.5, .5, .52]);
  for (const s of [-1, 1]) patch(b, 8, 1, (u, v) => { const x = lerp(.02, .44, u), w = .145*(1 - (2*u - 1)**2*.4), y = lerp(.9, .945, v)*(1 - (u - .5)*.02); return [x, y, s*(w + .0035)]; }, [.95, .95, .93], [0, 0, s]);
  // seat: stepped, stitched, with a strap
  loft(b, [
    { x: -0.72, w: 0.07, yb: 0.84, yt: 0.9, n: 2.4 }, { x: -0.66, w: 0.11, yb: 0.84, yt: 0.945, n: 2.8 }, { x: -0.5, w: 0.125, yb: 0.84, yt: 0.955, n: 3 }, { x: -0.36, w: 0.13, yb: 0.84, yt: 0.945, n: 3 },
    { x: -0.3, w: 0.135, yb: 0.84, yt: 0.925, n: 3 }, { x: -0.12, w: 0.135, yb: 0.84, yt: 0.935, n: 3 }, { x: -0.04, w: 0.11, yb: 0.85, yt: 0.925, n: 2.6 }, { x: 0.01, w: 0.075, yb: 0.86, yt: 0.905, n: 2.4 },
  ], () => [0.07, 0.07, 0.075, 0, MATTE], { ring: 24 });
  tube(b, [[-.32, .93, -.135], [-.32, .95, -.07], [-.32, .955, 0], [-.32, .95, .07], [-.32, .93, .135]], .007, [.03, .03, .03], 8, 4);
  // side covers, tail piece, and the grab rail
  loft(b, [
    { x: -0.5, w: 0.095, yb: 0.62, yt: 0.82, n: 3 }, { x: -0.42, w: 0.135, yb: 0.57, yt: 0.85, n: 3.5 }, { x: -0.25, w: 0.145, yb: 0.55, yt: 0.86, n: 3.5 }, { x: -0.1, w: 0.14, yb: 0.56, yt: 0.86, n: 3.5 }, { x: -0.04, w: 0.1, yb: 0.6, yt: 0.82, n: 3 },
  ], () => paint, { ring: 22 });
  loft(b, [{ x: -.76, w: .05, yb: .815, yt: .85, n: 2.5 }, { x: -.7, w: .09, yb: .79, yt: .865, n: 2.8 }, { x: -.55, w: .105, yb: .75, yt: .865, n: 3 }, { x: -.45, w: .1, yb: .72, yt: .85, n: 3 }], () => paint, { ring: 16 });
  tube(b, [[-.42, .83, .13], [-.62, .875, .125], [-.72, .885, .08], [-.74, .89, 0], [-.72, .885, -.08], [-.62, .875, -.125], [-.42, .83, -.13]], .011, CHROME, 16, 5);
  // the engine: a cylinder with cooling fins, the head, the crankcase with its round covers, carb, the kick and gear levers
  const finL = 11; for (let i = 0; i < finL; i++) { const t = i/(finL - 1); b.addGeo(HUB_G, M(lerp(.2, .29, t), lerp(.5, .71, t), 0, .082 - Math.sin(t*3.1)*.004, .012, .112, 0, 0, -.42), i === finL - 1 ? [.5, .5, .52] : STEEL); }
  rod(b, [.2, .48, 0], [.3, .72, 0], .05, [.22, .22, .24], HUB_G);
  rbox(b, .24, .69, -.09, .36, .79, .09, [.4, .4, .42]);
  for (const s of [-1, 1]) rbox(b, .28, .73, s*.06, .32, .77, s*.1, [.25, .25, .27]);
  rbox(b, -.16, .28, -.135, .3, .54, .135, [.42, .42, .44]);
  for (const [cx, cy, r] of [[.1, .39, .115], [-.08, .38, .085]]) { b.addGeo(HUB_G, M(cx, cy, .14, r, .025, r, Math.PI/2), [.62, .62, .64]); b.addGeo(RING_G, M(cx, cy, .155, r*.7, r*.7, .05), [.3, .3, .32]); }
  b.addGeo(HUB_G, M(.03, .39, -.14, .13, .03, .13, Math.PI/2), [.6, .6, .62]);
  rbox(b, .02, .57, -.065, .16, .69, .065, [.28, .28, .3]); rod(b, [.03, .63, .05], [-.1, .66, .1], .035, BLACK, HUB_G);
  tube(b, [[-.05, .32, .14], [-.17, .36, .19], [-.27, .49, .19]], .009, STEEL, 6, 5); rod(b, [-.27, .49, .19], [-.2, .49, .19], .015, BLACK, HUB_G);       // kick
  tube(b, [[-.02, .34, -.15], [.1, .3, -.2], [.22, .32, -.2]], .008, STEEL, 6, 5);                                // gear lever
  // exhaust: header out of the head, down and along, the silencer with its end cap and heat shield
  tube(b, [[.34, .67, .05], [.43, .57, .1], [.42, .34, .14], [.27, .25, .18], [-.05, .27, .21], [-.3, .33, .21]], .022, CHROME, 22, 7);
  rod(b, [-.28, .33, .21], [-.82, .46, .21], .048, CHROME, HUB_G); b.addGeo(HUB_G, M(-.84, .465, .21, .054, .03, .054, 0, 0, Math.PI/2 + .23), [.34, .34, .36]);
  rbox(b, -.05, .25, .185, .12, .33, .205, [.3, .3, .32]);
  // the frame: backbone over the engine, downtubes, cradle, the swing arm, the rear shocks with their springs, chain and guard
  tube(b, [[.52, .96, 0], [.34, .88, 0], [-.05, .84, 0], [-.42, .82, 0]], .026, FRAME, 12, 6);
  tube(b, [[.52, .96, 0], [.48, .7, 0], [.36, .3, 0], [.1, .24, 0], [-.18, .27, 0], [-.22, .55, 0], [-.1, .83, 0]], .018, FRAME, 22, 6);
  for (const s of [-1, 1]) {
    rod(b, [-.2, .34, s*.1], [-.6, R, s*.1], .017, FRAME, HUB_G);
    rod(b, [-.53, .3, s*.12], [-.44, .77, s*.12], .012, CHROME, HUB_G); rod(b, [-.46, .68, s*.12], [-.44, .79, s*.12], .022, BLACK, HUB_G);
    for (let i = 0; i < 9; i++) b.addGeo(RING_G, M(lerp(-.515, -.465, i/9), lerp(.35, .66, i/9), s*.12, .03, .03, .06, Math.PI/2), CHROME);
    rbox(b, -.32, .3, s*.2, -.24, .32, s*.3, BLACK); rbox(b, -.04, .25, s*.14, .03, .27, s*.26, BLACK);          // footrests
  }
  rbox(b, -.62, .25, -.14, -.05, .35, -.105, [.1, .1, .105]);                                                     // chain guard
  b.addGeo(HUB_G, M(-.6, R, -.1, .08, .008, .08, Math.PI/2), [.3, .3, .32]);
  // fork legs with their gaiters; handlebar, the round headlamp in a chrome shell, two dials, top clamp
  for (const s of [-1, 1]) {
    rod(b, [.57, .96, s*.075], [.77, .33, s*.075], .019, CHROME, HUB_G);
    rod(b, [.67, .64, s*.075], [.78, R + .01, s*.075], .027, [.5, .5, .52], HUB_G);
    tube(b, [[.62, .97, s*.075], [.68, .99, s*.075], [.71, .99, s*.075]], .006, BLACK, 4, 4);
    winker(b, .68, .99, s*.2);
  }
  rbox(b, .54, .95, -.1, .64, .985, .1, [.2, .2, .22]);
  rod(b, [.67, 1.0, 0], [.8, 1.0, 0], .092, CHROME, HUB_G);
  b.addGeo(G.sph2, M(.668, 1.0, 0, .05, .092, .092), CHROME);
  b.addGeo(RING_G, M(.802, 1.0, 0, .085, .085, .08, 0, Math.PI/2), CHROME);
  b.addGeo(G.sph2, M(.8, 1.0, 0, .02, .079, .079), HEAD, 1);
  for (const s of [-1, 1]) { b.addGeo(HUB_G, M(.61, 1.09, s*.045, .037, .03, .037, 0, 0, .35), BLACK); b.addGeo(G.circle, M(.6, 1.106, s*.045, .03, .03, 1, -Math.PI/2 + .3), [.75, .78, .75], .1); }
  bars(b, .6, 1.07, .37, CHROME);
  rod(b, [.57, 1.05, -.02], [.6, 1.06, -.02], .012, BLACK, HUB_G); rod(b, [.57, 1.05, .02], [.6, 1.06, .02], .012, BLACK, HUB_G);
  // mudguards, tail lamp, plate, indicators
  guard(b, 0.78, R + 0.012, 0, R + 0.03, 0.1, [.08, .08, .09]); guard(b, -0.6, R + 0.04, 0, R + 0.05, 0.12, [.08, .08, .09]);
  rbox(b, -.74, .78, -.075, -.68, .84, .075, [.55, .04, .04], 0, .9); rbox(b, -.755, .79, -.04, -.735, .83, .04, TAIL, 0, 1);
  box(b, -.78, .62, -.09, -.775, .74, .09, [.98, .98, .95]); rod(b, [-.72, .78, 0], [-.77, .68, 0], .012, BLACK, HUB_G);
  for (const s of [-1, 1]) winker(b, -.72, .76, s*.19);
  box(b, .96, .5, -.05, .965, .58, .05, [.98, .98, .95]);
  if (!opts.parked && !opts.noRider) {
    addRider(b, -0.32, 0.95, 0, { lean: 0.32, inst: true, handX: 0.6, handY: 1.08, handW: 0.34, footX: 0.05, footY: 0.42, helmet: opts.helmet ? [0.6, 0.6, 0.6] : null });
    if (opts.pillion) addPillion(b, -0.62, 0.97, 0, opts.sideSaddle, true);
  } else if (opts.parked) { rod(b, [-.12, .28, -.08], [-.2, .02, -.28], .012, FRAME, HUB_G); }
  wheel2(b, 0.78, R, 0, R, 0.09, { disc: true }); wheel2(b, -0.6, R, 0, R, 0.11);
  return { body: b.build(), glass: gl.build(), dims: { L: 2.0, W: 0.75, H: 1.75, wb: 1.3 } };
}
export function buildCycle(opts = {}) {
  const b = newB(true), gl = newB(false);
  const R = 0.34, c = [1, 1, 1], STEEL = [.5, .5, .52];
  const hub = [.5, .28, 0], seat = [-.2, .84, 0], pedal = [-.05, .33, 0], head = [.36, .84, 0], down = [.34, .72, 0];
  for (const [a, e] of [[seat, pedal], [[-.18, .76, 0], head], [down, pedal]]) rod(b, a, e, .016, c, HUB_G, 1);
  for (const s of [-1, 1]) { rod(b, [-.5, R, s*.05], pedal, .009, c, HUB_G, 1); rod(b, [-.5, R, s*.05], [-.19, .78, s*.01], .008, c, HUB_G, 1); rod(b, [.5, R, s*.05], [.385, .72, s*.02], .012, c, HUB_G, 1); }
  rod(b, [.385, .72, 0], [.42, 1.0, 0], .014, CHROME, HUB_G); tube(b, [[.45, 1.0, -.3], [.44, 1.02, -.15], [.42, 1.0, 0], [.44, 1.02, .15], [.45, 1.0, .3]], .009, CHROME, 8, 5);
  for (const s of [-1, 1]) rod(b, [.45, 1.0, s*.2], [.45, 1.0, s*.3], .014, BLACK, HUB_G);
  rod(b, [-.2, .8, 0], [-.21, .88, 0], .011, CHROME, HUB_G); rbox(b, -.36, .87, -.07, -.1, .92, .07, [.08, .07, .06], 0, MATTE);
  b.addGeo(HUB_G, M(pedal[0], pedal[1], .05, .08, .006, .08, Math.PI/2), STEEL);
  for (const s of [-1, 1]) { const ped = [pedal[0] + s*.12, pedal[1] + s*.08, s*.11]; rod(b, [pedal[0], pedal[1], s*.05], ped, .006, STEEL, HUB_G); rbox(b, ped[0] - .04, ped[1] - .01, s*.1, ped[0] + .04, ped[1] + .01, s*.18, BLACK); }
  rod(b, [-.5, R, .05], pedal.slice(0, 2).concat(.05), .006, [.2, .2, .2], HUB_G);
  guard(b, -.5, R + .03, 0, R + .035, .05, c, 1); guard(b, .5, R + .03, 0, R + .035, .05, c, 1);
  if (!opts.parked) addRider(b, -0.28, 0.92, 0, { lean: 0.22, inst: true, handX: 0.44, handY: 1.0, handW: 0.28, footX: 0.05, footY: 0.32 });
  for (const x of [0.5, -0.5]) wheel2(b, x, R, 0, R, .05);
  return { body: b.build(), glass: gl.build(), dims: { L: 1.75, W: 0.6, H: 1.75, wb: 1.0 } };
}

// ---------------------------------------------------------------- cars
const GLASS = [0.05, 0.062, 0.075], TRIM = [0.07, 0.07, 0.075], UNDER = [0.05, 0.05, 0.05], SEAM = [.02, .02, .022, 0, MATTE];
const PAINTED = [1, 1, 1, 1], WINDOW = [...GLASS, 4], BLACKOUT = [...TRIM, 0, MATTE];
// the half section of the lower body, bottom centre to top centre, as [fraction of width, fraction of height]
const LOW_ROWS = [[0, 0], [.45, 0], [.8, 0], [.92, .012], [.965, .05], [.985, .11], [.99, .16], [.995, .28], [1, .42], [1.005, .56], [1.008, .68], [1.014, .775], [1, .8], [.985, .875], [.965, .945], [.93, .985], [.86, 1], [.6, 1.012], [.3, 1.02], [0, 1.024]];
const SIDE_ROWS = [0, .05, .1, .3, .5, .7, .86, .93, 1], ROOF_ROWS = [.97, .9, .76, .55, .28, 0];
const CHROMED = { lux: 1, sedan: 1, taxi: 1 };
function carBody(b, gl, spec, kind = 'sedan') {
  const { L, W, H, hood, roofF, roofR, beltY, sill, R, tail } = spec;
  const hl = L/2, hw = W/2, sedan = tail > 0.3, xr0 = -hl + tail, xf0 = hl - hood, xb = (roofF + roofR)/2, xw = hl - spec.overhang, Ra = R + .055;
  const deck = sedan ? beltY - 0.03 : beltY - 0.06, jeep = kind === 'jeep', suv = kind === 'suv' || jeep, low = kind === 'super' || kind === 'sports', twoDoor = low || jeep, chrome = !!CHROMED[kind];
  const T = [
    [-hl, hw*.8, sill + .17, deck - .17], [-hl + .015, hw*.86, sill + .12, deck - .11], [-hl + .05, hw*.91, sill + .075, deck - .06], [-hl + .14, hw*.96, sill + .03, deck - .02],
    [-hl + .32, hw*.99, sill, deck], [-hl + Math.max(.5, tail + .02), hw, sill, beltY], [0, hw, sill, beltY], [xf0 + .05, hw, sill, beltY],
    [hl - hood*.45, hw*.985, sill, beltY - .07], [hl - .22, hw*.96, sill + .01, beltY - .13], [hl - .09, hw*.91, sill + .035, beltY - .18], [hl - .03, hw*.86, sill + .08, beltY - .22], [hl, hw*.79, sill + .14, beltY - .27],
  ];
  const ringCache = new Map();
  const ringAt = (x) => { const key = Math.round(x*400); let r = ringCache.get(key); if (r) return r; const xq = key/400, w = tableAt(T, xq, 1), yb = tableAt(T, xq, 2), yt = tableAt(T, xq, 3);
    r = LOW_ROWS.map(([fz, fy]) => [fz*w, yb + fy*(yt - yb)]); ringCache.set(key, r); return r; };
  // where the body's skin is, at a height (side) / across (top)
  const zSide = (x, y) => { const r = ringAt(x); for (let i = 0; i < r.length - 1; i++) if (y <= r[i + 1][1]) { const k = (y - r[i][1])/Math.max(1e-5, r[i + 1][1] - r[i][1]); return lerp(r[i][0], r[i + 1][0], Math.max(0, k)); } return 0; };
  const yTop = (x, z) => { const r = ringAt(x); z = Math.abs(z); for (let i = 12; i < r.length - 1; i++) if (z >= r[i + 1][0]) { const k = (r[i][0] - z)/Math.max(1e-5, r[i][0] - r[i + 1][0]); return lerp(r[i][1], r[i + 1][1], k); } return r[r.length - 1][1]; };
  const xEnd = (dir, y, z) => { const az = Math.abs(z); for (let d = 0; d < .9; d += .0025) { const x = dir*(hl - d), r = ringAt(x); if (y >= r[0][1] && y <= r[r.length - 1][1] && zSide(x, y) >= az) return x; } return dir*(hl - .9); };
  const stn = [], add = (a, e, n) => { for (let i = 0; i <= n; i++) stn.push(lerp(a, e, i/n)); };
  for (const d of [.0, .015, .03, .05, .08, .11, .14, .18, .24, .32]) { stn.push(-hl + d, hl - d); }
  add(-hl + .3, hl - .3, Math.ceil((L - .6)/.16));
  for (const c of [xw, -xw]) add(c - Ra - .05, c + Ra + .05, 16);
  stn.push(xr0, xf0, xf0 + .05, roofR, roofF);
  const X = stationsOf(stn);
  const half = LOW_ROWS.length, rowsFull = half*2 - 2, cut = [];
  const lowerP = X.map((x, i) => {
    const r = ringAt(x), row = [], cu = [];
    for (let k = 0; k < rowsFull; k++) {
      const hk = k < half ? k : rowsFull - k, s = k < half ? 1 : -1; let px = x, py = r[hk][1], pz = s*r[hk][0], c = 0;
      if (hk >= 3 && hk <= 11) for (const cx of [xw, -xw]) { const d = Math.hypot(px - cx, py - R); if (d < Ra) { const f = Ra/Math.max(d, 1e-4); px = cx + (px - cx)*f; py = R + (py - R)*f; c = 1; } }
      row.push([px, py, pz]); cu.push(c);
    }
    cut.push(cu); return row;
  });
  const INSIDE = [0.16, 0.15, 0.14, 0, MATTE], HEADLINER = [0.62, 0.6, 0.56, 0, MATTE];
  const cabinTop = (q) => spec.interior && q.ny > 0.6 && q.x < xf0 - 0.02 && q.x > xr0 + 0.15 && Math.abs(q.z) < hw - 0.1;
  const cladding = suv ? sill + .3 : 0;
  gridSurface(b, lowerP, (q) => {
    if (q.inside) return q.y > sill + 0.15 ? INSIDE : null;
    if (cabinTop(q)) return null;
    if (q.ny < -0.55) return [...UNDER, 0, MATTE];
    if (q.y < sill + .07 || q.y < cladding) return BLACKOUT;
    return PAINTED;
  }, { closed: true, inner: spec.interior ? .03 : 0, skip: (i, k, k2) => cut[i][k] && cut[i][k2] && cut[i + 1][k] && cut[i + 1][k2] });
  // the ends: flat behind the lamps and bumpers
  for (const [end, dir] of [[0, -1], [X.length - 1, 1]]) {
    const r = lowerP[end], yc = (r[0][1] + r[half - 1][1])/2, c = b.v(X[end], yc, 0, dir, 0, 0, 1, 1, 1, 0, 1), ring = r.map(p => b.v(p[0], p[1], p[2], dir, 0, 0, 1, 1, 1, 0, 1));
    for (let k = 0; k < rowsFull; k++) { const a = ring[k], e = ring[(k + 1) % rowsFull]; if (dir > 0) b.i.push(c, e, a); else b.i.push(c, a, e); }
  }
  // the greenhouse: one surface from the belt, up over the roof and down. Where the top line falls, the across-rows
  // are the windscreen and the rear glass; where it runs flat they're the roof; the side-rows are the door glass
  const gwB = hw - .05, topAt = (x) => {
    if (x > roofF) return H - (H - beltY - .015)*Math.pow((x - roofF)/(xf0 - roofF), sedan || !low ? 1.2 : 1.05);
    if (x < roofR) return H - (H - deck)*Math.pow((roofR - x)/(roofR - xr0), sedan ? 1.35 : 1.1);
    return H; };
  const baseAt = (x) => x < roofR ? lerp(deck - .02, beltY - .04, sm((x - xr0)/(roofR - xr0))) : beltY - .04;
  const xC = sedan ? roofR + .02 : (suv ? roofR + .06 : roofR + .16), xQ = kind === 'suv' || kind === 'lux' ? roofR + .62 : 1e9;
  const gs = [xr0, xf0, roofR, roofF, xb - .045, xb + .045, xC, xC + .05, roofF - .08, roofR + .05]; if (xQ < 1e8) gs.push(xQ - .04, xQ + .04);
  const gX = (a, e, n) => { for (let i = 0; i <= n; i++) gs.push(lerp(a, e, i/n)); };
  gX(roofF, xf0, 9); gX(xr0, roofR, 7); gX(roofR, roofF, Math.ceil((roofF - roofR)/.12));
  gs.push(xf0 - .04, xr0 + .04);
  const GX = stationsOf(gs), side = SIDE_ROWS.length, RF = ROOF_ROWS.length, halfG = side + RF, fullG = halfG*2 - 1;
  const gP = GX.map((x) => {
    const top = topAt(x), base = baseAt(x), h = Math.max(.004, top - base), k = Math.min(1, h/.32), edgeY = top - .045*k, tall = Math.min(1, (edgeY - base)/Math.max(.05, H - base));
    const ez = lerp(gwB*.965, gwB*.8, sm(tall)), half = [];
    for (const t of SIDE_ROWS) half.push([x, lerp(base, edgeY, t), lerp(gwB, ez, Math.pow(t, 1.1)) + Math.sin(t*Math.PI)*.012*k]);
    for (const u of ROOF_ROWS) half.push([x, edgeY + (top - edgeY)*(1 - u*u), ez*u]);
    const row = half.slice(); for (let i = half.length - 2; i >= 0; i--) row.push([x, half[i][1], -half[i][2]]);
    return row;
  });
  const rowOf = (k) => k < halfG ? k : fullG - 1 - k;
  gridSurface(b, gP, (q) => {
    const r = rowOf(q.k), x = q.x;
    if (q.inside) {
      if (r >= side) return x < roofF && x > roofR ? HEADLINER : (r < side + 1 ? INSIDE : null);
      if (x < xC || x > xf0 - .04 || Math.abs(x - xb) < .05) return INSIDE;
      return r === 0 || r >= 6 ? HEADLINER : null;
    }
    const zone = x > roofF ? 'wind' : x < roofR ? 'rear' : 'roof';
    if (r < side - 1) {                                  // the door glass, in its frame
      const pillar = Math.abs(x - xb) < .05, qPillar = Math.abs(x - xQ) < .045;
      if (r === 0) return PAINTED;
      if (r === 1) return chrome ? [...CHROME, 0] : BLACKOUT;                     // the waist moulding
      if (r >= 7) return PAINTED;
      if (r === 6) return BLACKOUT;
      if (pillar) return BLACKOUT;
      if (qPillar) return kind === 'suv' ? PAINTED : BLACKOUT;
      if (x < xC) return PAINTED;                         // C/D pillar
      if (x > xf0 - .04) return PAINTED;
      return WINDOW;
    }
    if (r >= side - 1 && r < side + 1 && zone !== 'roof' && (zone === 'wind' || r === side - 1)) return PAINTED;     // A pillar
    if (zone === 'roof') return PAINTED;
    if (zone === 'wind') return x > xf0 - .04 ? BLACKOUT : x < roofF + .03 && false ? PAINTED : WINDOW;
    // rear glass: a wide frame on a boot car, a thin one on a hatch
    if (r < side + (sedan ? 2 : 1)) return PAINTED;
    return x < xr0 + .04 ? (sedan ? PAINTED : BLACKOUT) : WINDOW;
  }, { inner: spec.interior ? .03 : 0 });

  const EDGE = .004;
  const onSide = (s, x0, x1, y0, y1, c, o = {}) => patch(b, o.nu || 6, o.nv || 2, (u, v) => { const x = lerp(x0, x1, u), y = lerp(o.yb ? o.yb(u) : y0, o.yt ? o.yt(u) : y1, v); return [x, y, s*(zSide(x, y) + (o.off ?? EDGE))]; }, c, [0, 0, s]);
  const onEnd = (dir, z0, z1, y0, y1, c, o = {}) => patch(b, o.nu || 8, o.nv || 3, (u, v) => { const z = lerp(z0, z1, u), y = lerp(o.yb ? o.yb(u) : y0, o.yt ? o.yt(u) : y1, v); return [xEnd(dir, y, z) + dir*((o.off ?? EDGE) + (o.bulge || 0)*Math.sin(v*Math.PI)), y, z]; }, c, [dir, 0, (z0 + z1)*.3]);
  const onTop = (x0, x1, z0, z1, c, o = {}) => patch(b, o.nu || 8, o.nv || 3, (u, v) => { const x = lerp(x0, x1, u), z = lerp(z0, z1, v); return [x, yTop(x, z) + (o.off ?? EDGE), z]; }, c, [0, 1, 0]);
  const archTop = (x) => { let y = 0; for (const c of [xw, -xw]) { const d = Math.abs(x - c); if (d < Ra + .03) y = Math.max(y, R + Math.sqrt(Math.max(0, (Ra + .03)**2 - d*d))); } return y; };

  // ------------------------------------- wheel wells and arches
  for (const cx of [xw, -xw]) for (const s of [-1, 1]) {
    const m = new THREE.Matrix4().makeTranslation(cx, R, s*(hw - .17)).multiply(_basis).multiply(new THREE.Matrix4().makeScale(-(Ra - .004), .34, Ra - .004));
    b.addGeo(ARC, m, UNDER, MATTE);
    b.addGeo(G.circle, M(cx, R, s*(hw - .3), Ra, Ra, 1, s > 0 ? 0 : Math.PI), UNDER, MATTE);
    // the lip round the arch, and a flare on the big ones
    const lip = new THREE.TorusGeometry(Ra + .004, suv ? .03 : .012, 4, 18, Math.PI);
    b.addGeo(lip, M(cx, R, s*(hw + (suv ? .012 : .006))), suv ? TRIM : [1, 1, 1], suv ? MATTE : 0, suv ? 0 : 1); lip.dispose();
  }
  // ------------------------------------- the sides: doors, handles, sills, fuel flap
  const seamV = (s, x, y0, y1) => { const yb = Math.max(y0, archTop(x) + .01); if (y1 > yb) onSide(s, x - .004, x + .004, yb, y1, SEAM, { nu: 1, nv: 5, off: .0025 }); };
  const seamH = (s, x0, x1, y) => onSide(s, x0, x1, y - .004, y + .004, SEAM, { nu: 10, nv: 1, off: .0025 });
  for (const s of [-1, 1]) {
    const yd0 = sill + .075, yd1 = beltY - .012, xF = xf0 + .04, xM = twoDoor ? xb - .28 : xb, xE = sedan ? Math.max(roofR + .02, -xw + Ra + .06) : Math.max(xC, -xw + Ra + .06);
    seamV(s, xF, yd0, yd1); seamV(s, xM, yd0, yd1); if (!twoDoor) seamV(s, xE, yd0, yd1);
    seamH(s, twoDoor ? xM : xE, xF, yd0);
    // handles: little pulls on stalks
    for (const x of twoDoor ? [xM + .14] : [xb + .1, xE + .1]) { rbox(b, x - .065, beltY - .135, s*(zSide(x, beltY - .12) - .003), x + .065, beltY - .1, s*(zSide(x, beltY - .12) + .024), chrome ? CHROME : [1, 1, 1], chrome ? 0 : 1); onSide(s, x - .05, x + .05, beltY - .15, beltY - .09, [.02, .02, .02, 0, MATTE], { nu: 2, nv: 1, off: .002 }); }
    // the rubbing strip along the doors
    if (!low) onSide(s, Math.max(xE, -xw + Ra + .05), Math.min(xF, xw - Ra - .05), sill + .2, sill + .245, chrome ? [...CHROME, 0] : BLACKOUT, { nu: 8, nv: 1, off: .006 });
    // sills
    onSide(s, -xw + Ra + .02, xw - Ra - .02, sill + .012, sill + .072, BLACKOUT, { nu: 8, nv: 1, off: .006 });
    // side repeater ahead of the door, fuel flap behind
    onSide(s, xF + .1, xF + .17, beltY - .1, beltY - .07, [...AMBER, 0, .7], { nu: 2, nv: 1, off: .005 });
    if (s < 0 && !low) { const fx = -xw + .03, fy = Math.max(archTop(fx), sill + .3) + .1; seamH(s, fx - .08, fx + .08, fy); seamH(s, fx - .08, fx + .08, fy + .15); seamV(s, fx - .08, fy, fy + .15); seamV(s, fx + .08, fy, fy + .15); }
    // vents on the fast ones
    if (low) for (let i = 0; i < 4; i++) onSide(s, xw - Ra - .42 + i*.05, xw - Ra - .39 + i*.05, beltY - .24, beltY - .1, SEAM, { nu: 1, nv: 2, off: .003 });
    // mirror: an arm, a shaped body, glass on the back of it, an indicator in it
    const mx = xf0 - .1, my = beltY + .09, mz = hw + .055;
    tube(b, [[mx, beltY + .02, s*(hw - .06)], [mx + .005, beltY + .05, s*(hw - .01)], [mx, my, s*(mz - .04)]], .012, TRIM, 4, 5);
    b.addGeo(G.sph2, M(mx, my, s*mz, .05, .062, .095), [1, 1, 1], 0, 1);
    b.addGeo(G.sph2, M(mx - .03, my, s*mz, .022, .05, .082), [.38, .44, .5], 0, 4);
    b.addGeo(G.sphLo, M(mx + .03, my - .005, s*(mz + .06), .018, .012, .032), AMBER, .6);
    // window trim at the door tops is in the greenhouse; a rain gutter runs above it
    tube(b, [[roofF + .06, H - .05, s*(gwB*.81 + .006)], [xb, H - .046, s*(gwB*.81 + .007)], [roofR - .02, H - .05, s*(gwB*.81 + .006)]], .005, TRIM, 6, 4);
  }
  // ------------------------------------- the hood and boot: shut lines, creases
  const seamT = (x0, x1, z0, z1, n = 6) => onTop(x0, x1, z0, z1, SEAM, { nu: n, nv: 1, off: .002 });
  seamT(xf0 + .028, xf0 + .036, -hw*.84, hw*.84, 1);
  for (const s of [-1, 1]) { patch(b, 8, 1, (u, v) => { const x = lerp(xf0 + .03, hl - .17, u), w = tableAt(T, x, 1)*.86 + (v - .5)*.008*s; return [x, yTop(x, w) + .002, s*w]; }, SEAM, [0, 1, 0]);
    // two soft creases along the hood
    patch(b, 8, 2, (u, v) => { const x = lerp(xf0 + .06, hl - .2, u), w = tableAt(T, x, 1)*lerp(.42, .49, v); return [x, yTop(x, w) + .001 + Math.sin(v*Math.PI)*.006, s*w]; }, PAINTED, [0, 1, 0]); }
  if (sedan) { seamT(xr0 - .03, xr0 - .022, -hw*.84, hw*.84, 1); for (const s of [-1, 1]) patch(b, 6, 1, (u, v) => { const x = lerp(-hl + .1, xr0 - .025, u), w = hw*.84 + (v - .5)*.008*s; return [x, yTop(x, w) + .002, s*w]; }, SEAM, [0, 1, 0]); }
  // wipers lying at the foot of the windscreen
  for (const zz of [-.12, .42]) tube(b, [[xf0 - .03, beltY + .035, zz], [xf0 - .09, beltY + .058, zz - .25], [xf0 - .12, beltY + .08, zz - .5]], .0055, TRIM, 4, 4);
  // an aerial on the roof, a roof seam
  tube(b, [[roofR + .1, H, 0], [roofR + .02, H + .05, 0], [roofR - .1, H + .15, 0]], .004, TRIM, 4, 4);
  rbox(b, roofR + .06, H - .01, -.022, roofR + .2, H + .035, .022, TRIM, 0, MATTE);
  if (kind === 'lux' || kind === 'sedan') for (const s of [-1, 1]) patch(b, 6, 1, (u, v) => [lerp(roofR + .12, roofF - .1, u), H - .004 - (s*(.42 + v*.012))**2*.09, s*(.42 + v*.012)], SEAM, [0, 1, 0]);
  if (kind === 'lux') patch(b, 8, 4, (u, v) => { const z = lerp(-.42, .42, v); return [lerp(roofF - .85, roofF - .22, u), H + .002 - z*z*.09, z]; }, WINDOW, [0, 1, 0]);

  // ------------------------------------- the nose
  const yb0 = sill + .14, yt0 = beltY - .27, yM = (yb0 + yt0)/2, nW = tableAt(T, hl - .06, 1);
  const lampY0 = jeep ? yt0 - .03 : Math.min(yt0 + .02, beltY - .22), lampY1 = beltY - .13;
  if (jeep) {
    // a jeep's face: slatted grille between round lamps, a steel bumper
    for (const s of [-1, 1]) {
      const zc = s*nW*.68, yc = yt0 + .07, xc = xEnd(1, yc, zc) + .012;
      b.addGeo(HUB_G, M(xc - .01, yc, zc, .105, .05, .105, 0, 0, Math.PI/2), CHROME);
      b.addGeo(G.sph2, M(xc + .014, yc, zc, .022, .09, .09), HEAD, 1);
      b.addGeo(G.sphLo, M(xc + .005, yc - .13, s*nW*.82, .018, .03, .03), AMBER, .7);
    }
    onEnd(1, -nW*.38, nW*.38, yb0 + .15, yt0 + .15, BLACKOUT, { off: .005 });
    for (let i = -3; i <= 3; i++) onEnd(1, i*nW*.1 - .016, i*nW*.1 + .016, yb0 + .165, yt0 + .135, [...CHROME, 0], { nu: 1, nv: 2, off: .012 });
    rbox(b, hl - .03, sill + .13, -hw*.93, hl + .1, sill + .3, hw*.93, [.16, .16, .17], 0, MATTE);
  } else {
    // lamp clusters: a dark housing, the lens, a bright brow; they sweep back along the wing
    for (const s of [-1, 1]) {
      const z0 = s*nW*.42, z1 = s*nW*.995, yTopL = (u) => lerp(lampY1 - .035, lampY1, sm(u*1.4)), yBotL = (u) => lerp(lampY0 + .02, lampY0 + .07, sm(u));
      onEnd(1, z0, z1, 0, 0, [.09, .1, .11], { yb: yBotL, yt: yTopL, off: .005, nu: 10, nv: 3 });
      onEnd(1, s*nW*.47, s*nW*.74, 0, 0, [...HEAD, 0, 1], { yb: (u) => lerp(lampY0 + .03, lampY0 + .055, u), yt: (u) => lerp(lampY1 - .05, lampY1 - .025, u), off: .012, nu: 6, nv: 2, bulge: .008 });
      onEnd(1, s*nW*.75, s*nW*.96, 0, 0, [.72, .74, .76], { yb: (u) => lerp(lampY0 + .06, lampY0 + .085, u), yt: (u) => lerp(lampY1 - .03, lampY1 - .02, u), off: .01, nu: 4, nv: 2 });
      onEnd(1, s*nW*.44, s*nW*.98, 0, 0, [.95, .97, 1, 0, .5], { yb: (u) => lerp(lampY1 - .05, lampY1 - .022, sm(u*1.4)), yt: (u) => lerp(lampY1 - .04, lampY1 - .012, sm(u*1.4)), off: .014, nu: 8, nv: 1 });
      // fog lamp and its bezel
      const fz = s*nW*.72, fy = yb0 + .07, fx = xEnd(1, fy, fz);
      b.addGeo(HUB_G, M(fx - .004, fy, fz, .055, .03, .055, 0, 0, Math.PI/2), TRIM, MATTE); b.addGeo(G.sph2, M(fx + .012, fy, fz, .01, .042, .042), HEAD, .3);
    }
    // grille: a chrome surround, black mesh, slats, a badge
    const g0 = lampY0 + .02, g1 = lampY1 - .02, gz = nW*.4;
    if (chrome) onEnd(1, -gz - .02, gz + .02, g0 - .02, g1 + .015, [...CHROME, 0], { off: .007, nu: 8 });
    onEnd(1, -gz, gz, g0, g1, [...BLACK, 0, MATTE], { off: .011, nu: 8 });
    for (let i = 0; i < 5; i++) { const y = lerp(g0 + .012, g1 - .012, i/4); onEnd(1, -gz + .012, gz - .012, y - .005, y + .005, chrome ? [...CHROME, 0] : [.14, .14, .15], { off: .017, nu: 6, nv: 1 }); }
    const bx = xEnd(1, (g0 + g1)/2, 0); b.addGeo(G.sph2, M(bx + .022, (g0 + g1)/2, 0, .008, .032, .05), CHROME);
    // the bumper: a soft swell in the paint, then a black intake with its bars, a lip under that
    onEnd(1, -nW*.98, nW*.98, g0 - .1, g0 - .015, PAINTED, { off: .004, bulge: .014, nu: 12, nv: 3 });
    onEnd(1, -nW*.6, nW*.6, yb0 + .025, yb0 + .11, BLACKOUT, { off: .007, nu: 8 });
    for (let i = 0; i < 2; i++) { const y = yb0 + .05 + i*.035; onEnd(1, -nW*.58, nW*.58, y - .004, y + .004, [.16, .16, .17], { off: .012, nu: 6, nv: 1 }); }
    rbox(b, hl - .1, sill + .1, -hw*.88, hl - .005, sill + .155, hw*.88, TRIM, 0, MATTE);
  }
  // ------------------------------------- the tail
  const nR = tableAt(T, -hl + .06, 1), rY0 = sill + .17, rY1 = deck - .17, rH = deck - .03, tY0 = Math.max(rY1 - .06, rY0 + .12);
  const plate = spec.yellowPlate ? [0.98, 0.82, 0.12] : [0.95, 0.95, 0.92];
  const fPlateY = jeep ? sill + .34 : yb0 - .005;
  for (const s of [-1, 1]) {
    // tail lamps wrap round the corner: red, a dim band, the white reversing lamp
    onEnd(-1, s*nR*.5, s*nR*.998, tY0, rH, [.1, .02, .02], { off: .006, nu: 8, nv: 3 });
    onEnd(-1, s*nR*.53, s*nR*.98, tY0 + (rH - tY0)*.48, rH - .012, [...TAIL, 0, .9], { off: .012, nu: 8, nv: 2 });
    onEnd(-1, s*nR*.53, s*nR*.74, tY0 + .012, tY0 + (rH - tY0)*.4, [.92, .92, .9, 0, .15], { off: .012, nu: 4, nv: 1 });
    onEnd(-1, s*nR*.76, s*nR*.98, tY0 + .012, tY0 + (rH - tY0)*.4, [...AMBER, 0, .5], { off: .012, nu: 4, nv: 1 });
    onSide(s, -hl + .03, -hl + .2, tY0 + .012, rH, [...TAIL, 0, .7], { off: .007, nu: 5, nv: 2 });
    // the reflector in the bumper
    onEnd(-1, s*nR*.62, s*nR*.92, rY0 + .1, rY0 + .125, [.5, .03, .03, 0, .2], { off: .012, nu: 4, nv: 1 });
  }
  if (kind === 'lux' || kind === 'sedan') onEnd(-1, -nR*.5, nR*.5, tY0 + (rH - tY0)*.62, tY0 + (rH - tY0)*.78, chrome ? [...CHROME, 0] : [...TAIL, 0, .4], { off: .009, nu: 6, nv: 1 });
  // the boot lid's shut line, the bumper's seam and swell, a black valance, the plate in a recess
  onEnd(-1, -nR*.97, nR*.97, tY0 - .025, tY0 - .017, SEAM, { off: .004, nu: 8, nv: 1 });
  onEnd(-1, -nR*.97, nR*.97, rY0 + .02, tY0 - .03, PAINTED, { off: .004, bulge: .022, nu: 12, nv: 4 });
  onEnd(-1, -nR*.72, nR*.72, rY0, rY0 + .05, BLACKOUT, { off: .01, nu: 8, nv: 1 });
  onEnd(-1, -.27, .27, rY0 + .08, rY0 + .205, [.03, .03, .03, 0, MATTE], { off: .03, nu: 4, nv: 1 });
  onEnd(-1, -.25, .25, rY0 + .09, rY0 + .195, plate, { off: .036, nu: 4, nv: 1 });
  // a rear wiper and a stop lamp in the glass on a hatch; a lip on a boot; a wing on the fast ones
  if (!sedan) { const ry = lerp(deck, H, .25); tube(b, [[xr0 + .02, ry, 0], [xr0 + .05, ry + .1, .15], [xr0 + .06, ry + .2, .3]], .005, TRIM, 4, 4); rbox(b, roofR - .05, H - .05, -.25, roofR + .03, H - .015, .25, [...TAIL], 0, .7); }
  else patch(b, 10, 2, (u, v) => { const z = lerp(-hw*.84, hw*.84, u), x = lerp(-hl + .05, -hl + .12, v); return [x, yTop(x, z) + .004 + (1 - v)*.018*(1 - z*z), z]; }, PAINTED, [0, 1, 0]);
  if (low) { for (const s of [-1, 1]) rbox(b, -hl + .12, deck, s*hw*.72, -hl + .22, deck + .14, s*hw*.66, TRIM, 0, MATTE); rbox(b, -hl - .01, deck + .13, -hw*.86, -hl + .24, deck + .165, hw*.86, [1, 1, 1], 1); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) rbox(b, xf0 - .02 - i*.03 + hood*.5, yTop(hl - hood*.5, s*.36) - .005, s*.2, xf0 + .005 - i*.03 + hood*.5, yTop(hl - hood*.5, s*.36) + .007, s*.5, SEAM.slice(0, 3), 0, MATTE); }
  // the exhaust: a pipe with its tip showing
  for (const s of low ? [-1, 1] : [1]) { const z = s*hw*.55; rod(b, [-hl + .3, sill + .1, z], [-hl - .02, sill + .1, z], low ? .045 : .028, CHROME, HUB_G); b.addGeo(G.circle, M(-hl - .021, sill + .1, z, low ? .036 : .02, low ? .036 : .02, 1, 0, -Math.PI/2), [.01, .01, .01], MATTE); }
  // the front plate
  onEnd(1, -.24, .24, fPlateY - .05, fPlateY + .05, plate, { off: jeep ? .12 : .018, nu: 4, nv: 1 });
  // underneath, seen from a low camera: the axles, the sump, the silencer
  for (const c of [xw, -xw]) rod(b, [c, R, -hw + .12], [c, R, hw - .12], .03, UNDER, TUBE6);
  rbox(b, -hl + .5, sill - .1, hw*.2, -hl + 1.1, sill - .01, hw*.7, UNDER, 0, MATTE);
  // an SUV's rails and skid plates; a jeep's spare wheel on its back, hinges and a step
  if (suv) {
    for (const s of [-1, 1]) { const z = s*gwB*.76; tube(b, [[roofF - .1, H - .01, z], [roofF - .16, H + .05, z], [xb, H + .055, z], [roofR + .14, H + .05, z], [roofR + .08, H - .01, z]], .012, kind === 'suv' ? CHROME : TRIM, 12, 5);
      onSide(s, -xw + Ra + .02, xw - Ra - .02, sill + .05, sill + .1, [.2, .2, .22], { nu: 4, nv: 1, off: .03 }); }
    onEnd(1, -nW*.45, nW*.45, yb0 - .06, yb0 + .03, [.6, .6, .62], { off: .018, nu: 6, nv: 1 });
  }
  if (jeep) { wheel(b, -hl - .16, deck + .3, 0.001, R*.98, .22, RIM, 0); WHEELS && WHEELS.pop(); for (const y of [beltY - .1, sill + .3]) for (const s of [-1, 1]) rbox(b, xf0 + .02, y - .03, s*(hw - .01), xf0 + .1, y + .03, s*(hw + .018), [.1, .1, .11], 0, MATTE); }
  // the wheels
  const style = { sedan: 0, hatch: 1, suv: 2, taxi: 1, lux: 4, jeep: 3, sports: 2, super: 4 }[kind] ?? 0, hub = kind === 'taxi' || kind === 'hatch' ? [.42, .42, .44] : kind === 'super' || kind === 'sports' ? [.12, .12, .13] : RIM;
  for (const x of [xw, -xw]) for (const s of [-1, 1]) wheel(b, x, R, s*(hw - 0.08), R, 0.21, hub, style);
}

export function carSpec(kind) {
  let spec;
  if (kind === 'hatch') spec = { L: 3.65, W: 1.6, H: 1.66, hood: 0.75, roofF: 0.95, roofR: -1.5, beltY: 0.95, sill: 0.25, R: 0.29, tail: 0.15, overhang: 0.6 };
  else if (kind === 'suv') spec = { L: 4.5, W: 1.8, H: 1.88, hood: 1.05, roofF: 0.85, roofR: -2.05, beltY: 1.12, sill: 0.38, R: 0.36, tail: 0.12, overhang: 0.75 };
  else spec = { L: 4.0, W: 1.7, H: 1.5, hood: 1.0, roofF: 0.6, roofR: -1.05, beltY: 0.88, sill: 0.24, R: 0.3, tail: 0.6, overhang: 0.72 };
  // (low and wide; long and formal; tall and boxy)
  if (kind === 'super') spec = { L: 4.52, W: 1.93, H: 1.15, hood: 1.2, roofF: 0.1, roofR: -0.55, beltY: 0.72, sill: 0.12, R: 0.33, tail: 0.95, overhang: 0.98 };
  else if (kind === 'sports') spec = { L: 4.52, W: 1.85, H: 1.3, hood: 1.2, roofF: 0.45, roofR: -1.25, beltY: 0.8, sill: 0.16, R: 0.33, tail: 0.3, overhang: 0.85 };
  else if (kind === 'lux') spec = { L: 4.92, W: 1.85, H: 1.47, hood: 1.3, roofF: 0.6, roofR: -1.25, beltY: 0.92, sill: 0.24, R: 0.33, tail: 0.78, overhang: 0.95 };
  else if (kind === 'jeep') spec = { L: 3.98, W: 1.82, H: 1.92, hood: 1.0, roofF: 0.75, roofR: -1.75, beltY: 1.15, sill: 0.46, R: 0.39, tail: 0.05, overhang: 0.55 };
  if (kind === 'taxi') spec.yellowPlate = true;
  return spec;
}
// opts.interior: also draw the inside (door cards, headliner, pillars) for the driver's-seat view
export function buildCar(kind, opts = {}) {
  const b = newB(true), gl = newB(false);
  const spec = carSpec(kind);
  spec.interior = !!opts.interior;
  carBody(b, gl, spec, kind);
  if (kind === 'taxi') {
    box(b, -0.15, spec.H, -0.25, 0.15, spec.H + 0.12, 0.25, [0.98, 0.85, 0.15], 0, 0.4);
  }
  if (kind === 'suv') {
    // roof rails + spare wheel
    for (const s of [-1, 1]) box(b, -1.9, spec.H - 0.04, s * 0.62, 0.7, spec.H + 0.02, s * 0.57, [0.2, 0.2, 0.2]);
  }
  return { body: b.build(), glass: gl.build(), dims: { L: spec.L, W: spec.W, H: spec.H, wb: spec.L - 2 * spec.overhang } };
}

// ---------------------------------------------------------------- city bus (fictional Pune livery)
const PANE = [0.07, 0.085, 0.1, 4], RUBBER = [0.03, 0.03, 0.033], STEEL = [0.5, 0.5, 0.52];
// a body of stations along x: outline(x) gives half the section, bottom middle round to the roof's middle, as [z, y]. `at`
// shapes the ends (where a height's face really is at that x); both ends are closed off.
function shell(b, xs, outline, at, colorOf, closeN = 6) {
  const rows = [], put = (x, zs) => { const O = outline(x), row = []; for (const [z, y] of O) { const q = at(x, y, z*zs); row.push([q, y, z*zs]); } for (let i = O.length - 2; i > 0; i--) { const [z, y] = O[i], q = at(x, y, -z*zs); row.push([q, y, -z*zs]); } rows.push(row); };
  const F = [1, .97, .88, .66, .34, 0.001];
  for (let i = closeN - 1; i > 0; i--) put(xs[0], F[i]);
  for (const x of xs) put(x, 1);
  for (let i = 1; i < closeN; i++) put(xs[xs.length - 1], F[i]);
  gridSurface(b, rows, colorOf, { closed: true });
}
// ---------------------------------------------------------------- city bus
export function buildBus() {
  const b = newB(true), gl = newB(false);
  const L = 11.4, W = 2.55, H = 3.15, hl = L / 2, hw = W / 2;
  const red = [0.72, 0.12, 0.1], cream = [0.93, 0.88, 0.76], roofC = [0.84, 0.84, 0.8], band = [0.98, 0.7, 0.1], WX = [hl - 2.4, -hl + 3.0], AR = 0.64;
  const front = (y) => hl - (y > 1.08 ? 0.03 + 0.42*Math.pow((y - 1.08)/2.1, 1.3) : 0.035*(1.08 - y)), rear = (y) => -hl + (y > 2.3 ? 0.12*(y - 2.3)/0.9 : 0) + (y < 0.7 ? 0.08*(0.7 - y)/0.3 : 0);
  const at = (x, y, z) => { const c = Math.pow(Math.abs(z)/hw, 3.4); return Math.max(rear(y) + 0.16*c, Math.min(front(y) - 0.2*c, x)); };
  const yArch = (x) => { let yb = 0; for (const w of WX) { const d = Math.abs(x - w); if (d < AR) yb = Math.max(yb, 0.5 + Math.sqrt(AR*AR - d*d)); } return yb; };
  const outline = (x) => { const a = yArch(x), yb = Math.max(0.42, a), low = Math.max(yb + 0.03, 0.56); return [[0, 0.42], [hw - 0.42, 0.42], [hw - 0.42, yb], [hw - 0.03, yb], [hw, low], [hw, Math.max(low + 0.05, 0.86)], [hw, Math.max(low + 0.1, 1.1)], [hw, 1.32], [hw, 1.38], [hw - 0.01, 1.66], [hw - 0.02, 2.0], [hw - 0.032, 2.32], [hw - 0.06, 2.66], [hw - 0.13, 2.88], [hw - 0.34, 3.05], [hw - 0.72, 3.13], [hw*0.3, 3.165], [0, 3.175]]; };
  const xs = stationsOf([-hl, -hl + 0.12, ...Array.from({ length: 46 }, (_, i) => -hl + (i + 1)*L/47), hl - 0.12, hl, ...WX.flatMap(w => [-1, -.92, -.75, -.5, -.25, 0, .25, .5, .75, .92, 1].map(k => w + k*AR))], 0.02);
  const sideZ = (y) => hw - Math.max(0, y - 1.38)*0.034;
  shell(b, xs, outline, at, (q) => {
    if (q.ny < -0.55 || Math.abs(q.z) < hw - 0.05 && q.y < 1.0 && Math.abs(q.nx) < 0.7) return [...RUBBER, 0];
    if (q.y > 2.92) return [...roofC, 0];
    if (q.y > 1.3 && q.y < 1.385) return [...band, 0];
    return q.y < 1.34 ? [...red, 0] : [...cream, 0];
  });
  // chassis, axles, what's under there
  box(b, -hl + 0.5, 0.28, -0.5, hl - 0.6, 0.44, 0.5, RUBBER);
  for (const w of WX) { b.addGeo(G.cyl12, M(w, 0.5, 0, 0.09, 2.1, 0.09, Math.PI/2), [0.12, 0.12, 0.13]); rbox(b, w - 0.16, 0.34, -0.2, w + 0.16, 0.64, 0.2, [0.1, 0.1, 0.11]); for (const s of [-1, 1]) { rbox(b, w - 0.56, 0.42, s*0.72 - .05, w + 0.56, 0.5, s*0.72 + .05, [0.14, 0.14, 0.15]); wheel(b, w, 0.5, s*(hw - 0.25), 0.5, 0.3); } }
  for (const w of WX) for (const s of [-1, 1]) { rbox(b, w - AR - 0.02, 0.32, s*(hw - 0.12), w - AR + 0.03, 0.72, s*(hw - 0.01), RUBBER); tube(b, [[w - AR*.97, 0.98, s*(hw + .012)], [w - AR*.6, 1.03 + .12, s*(hw + .012)], [w, 1.16, s*(hw + .012)], [w + AR*.6, 1.15, s*(hw + .012)], [w + AR*.97, 0.98, s*(hw + .012)]], 0.015, [0.15, 0.15, 0.16], 14, 5); }
  // the sides: panels and their rivets, rubbing strip, reflectors, a flap, windows between pillars with sliding panes
  const bay = 1.15, x0 = -hl + 0.72, x1 = hl - 1.22;
  for (const s of [-1, 1]) {
    tube(b, [[-hl + 0.1, 0.92, s*(hw + .012)], [hl - 0.1, 0.92, s*(hw + .012)]], 0.014, [0.45, 0.1, 0.09], 2, 5);
    tube(b, [[-hl + 0.14, 2.9, s*(sideZ(2.75) - .03)], [hl - 0.5, 2.9, s*(sideZ(2.75) - .03)]], 0.03, [0.2, 0.2, 0.2], 2, 6);    // the rain gutter
    for (let x = -hl + 0.4; x < hl - 0.3; x += 0.58) { if (yArch(x) > 0.1) continue; box(b, x - 0.006, 0.6, s*hw, x + 0.006, 1.28, s*(hw + 0.004), [0.4, 0.09, 0.08]); for (let y = 0.68; y < 1.28; y += 0.14) b.addGeo(G.sph2, M(x + .02, y, s*(hw + .002), .006, .006, .005), STEEL); }
    for (const rx of [-hl + 0.34, -0.9, hl - 1.1]) box(b, rx - 0.05, 0.72, s*hw, rx + 0.05, 0.78, s*(hw + 0.008), [1, 0.5, 0.08], 0, 0.3);
    rbox(b, -1.5, 0.72, s*hw, -0.9, 1.14, s*(hw + 0.012), [0.6, 0.14, 0.12]);                 // service flap
    for (let x = x0; x + bay*0.5 < x1; x += bay) {
      const a = x + 0.05, e = Math.min(x1, x + bay) - 0.05, door = s < 0 && ((a < hl - 0.2 && e > hl - 1.2) || (a < 0.45 && e > -0.65)); if (door) continue;
      patch(b, 3, 3, (u, v) => [a + (e - a)*u, 1.5 + 0.82*v, s*(sideZ(1.5 + 0.82*v) + 0.005)], [...RUBBER, 0], [0, 0, s]);
      patch(b, 3, 3, (u, v) => [a + 0.035 + (e - a - 0.07)*u, 1.535 + 0.75*v, s*(sideZ(1.53 + 0.75*v) + 0.012)], PANE, [0, 0, s]);
      box(b, a, 1.885, s*sideZ(1.9), e, 1.915, s*(sideZ(1.9) + 0.024), RUBBER);                 // top sash of the slider
      box(b, (a + e)/2 - 0.012, 1.915, s*sideZ(2.1), (a + e)/2 + 0.012, 2.3, s*(sideZ(2.1) + 0.02), [0.55, 0.55, 0.57]);
    }
    rbox(b, x0 - 0.02, 1.47, s*sideZ(1.47), x1 + 0.02, 1.5, s*(sideZ(1.47) + 0.02), [0.55, 0.55, 0.57]);
    rbox(b, x0 - 0.02, 2.33, s*sideZ(2.33), x1 + 0.02, 2.36, s*(sideZ(2.33) + 0.02), [0.55, 0.55, 0.57]);
  }
  // doors: folding, glass nearly to the step, grab rails, the step lit
  for (const [a, e] of [[hl - 1.17, hl - 0.25], [-0.62, 0.42]]) {
    const m = (a + e)/2, z = -(hw + 0.007);
    rbox(b, a - 0.04, 0.44, z - 0.012, e + 0.04, 2.42, z + 0.02, RUBBER);
    for (const [u0, u1] of [[a + 0.015, m - 0.008], [m + 0.008, e - 0.015]]) {
      rbox(b, u0, 0.5, z - 0.018, u1, 2.36, z, [0.82, 0.78, 0.68]);
      patch(b, 2, 3, (u, v) => [u0 + 0.05 + (u1 - u0 - 0.1)*u, 1.42 + 0.86*v, z - 0.02], PANE, [0, 0, -1]);
      patch(b, 2, 3, (u, v) => [u0 + 0.05 + (u1 - u0 - 0.1)*u, 0.62 + 0.68*v, z - 0.02], PANE, [0, 0, -1]);
      rod(b, [u1 - 0.07, 0.95, z - 0.035], [u1 - 0.07, 1.95, z - 0.035], 0.012, [0.88, 0.75, 0.2]);
    }
    box(b, a, 0.34, -hw - 0.02, e, 0.44, -hw + 0.3, [0.25, 0.25, 0.26]);
  }
  // the front: windscreen in two curved panes, wipers, a route board under a hood, grille, lamps, bumper
  const fz = (y, z) => front(y) - 0.2*Math.pow(Math.abs(z)/hw, 3.4) + 0.006;
  for (const s of [-1, 1]) {
    patch(b, 10, 8, (u, v) => { const y = 1.18 + 1.42*v, z = s*(0.012 + (hw - 0.14)*u); return [fz(y, z), y, z]; }, [...RUBBER, 0], [1, 0.1, 0]);
    patch(b, 10, 8, (u, v) => { const y = 1.22 + 1.34*v, z = s*(0.04 + (hw - 0.21)*u); return [fz(y, z) + 0.006, y, z]; }, PANE, [1, 0.1, 0]);
    rod(b, [fz(1.25, s*0.8) + 0.04, 1.25, s*0.8], [fz(1.95, s*0.34) + 0.03, 1.95, s*0.34], 0.007, RUBBER);
    rod(b, [fz(1.2, s*0.8) + 0.04, 1.2, s*0.8], [fz(1.25, s*0.8) + 0.04, 1.26, s*0.8], 0.018, RUBBER);
    // headlamps, indicator, fog lamp
    rbox(b, hl - 0.03, 0.66, s*0.66, hl + 0.02, 0.94, s*(hw - 0.1), [0.1, 0.1, 0.11]);
    for (const q of [0.82, 1.03]) { b.addGeo(G.cyl12, M(hl + 0.012, 0.8, s*q, 0.092, 0.03, 0.092, 0, 0, Math.PI/2), CHROME); b.addGeo(G.circle, M(hl + 0.03, 0.8, s*q, 0.078, 0.078, 1, 0, Math.PI/2), HEAD, 0, 1); }
    b.addGeo(G.sph2, M(hl + 0.01, 1.01, s*(hw - 0.2), 0.05, 0.03, 0.09), AMBER, 0, 0.7);
    // mirrors on long arms
    tube(b, [[hl - 0.26, 2.68, s*(hw - 0.06)], [hl + 0.08, 2.74, s*(hw + 0.14)], [hl + 0.12, 2.42, s*(hw + 0.18)]], 0.014, RUBBER, 10, 6);
    rbox(b, hl + 0.07, 1.94, s*(hw + 0.1), hl + 0.17, 2.46, s*(hw + 0.3), RUBBER);
    box(gl, hl + 0.06, 1.97, s*(hw + 0.12), hl + 0.065, 2.43, s*(hw + 0.28), [0.5, 0.56, 0.6]);
    box(b, hl - 0.3, 3.01, s*(hw - 0.5), hl - 0.17, 3.05, s*(hw - 0.3), [1, 0.45, 0.05], 0, 0.5);      // marker lamps
  }
  box(b, fz(1.2, 0) - .01, 1.18, -0.022, fz(1.2, 0) + 0.018, 2.6, 0.022, RUBBER);
  rbox(b, fz(2.74, 0) - 0.08, 2.61, -1.03, fz(2.74, 0) + 0.08, 2.98, 1.03, [0.03, 0.03, 0.03]);       // the route board in its housing
  box(b, fz(2.74, 0) + 0.08, 2.65, -0.92, fz(2.74, 0) + 0.085, 2.94, 0.92, [1, 0.45, 0.05], 0, 0.85);
  rbox(b, fz(2.94, 0) - 0.05, 2.97, -1.08, fz(2.94, 0) + 0.2, 3.01, 1.08, cream);
  rbox(b, hl - 0.09, 0.38, -hw - 0.012, hl + 0.09, 0.62, hw + 0.012, [0.12, 0.12, 0.13]);             // bumper
  rbox(b, hl + 0.06, 0.42, -0.26, hl + 0.095, 0.56, 0.26, [0.96, 0.96, 0.9]);
  for (let k = 0; k < 7; k++) rbox(b, hl - 0.015, 0.68 + k*0.045, -0.48, hl + 0.018, 0.7 + k*0.045, 0.48, [0.09, 0.09, 0.1]);
  // the back: its window, the engine's louvres, lamps, a board, ladder rungs
  const rx = (y) => rear(y) - 0.006;
  patch(b, 8, 6, (u, v) => { const y = 1.62 + 0.86*v, z = (u - .5)*(W - 0.62); return [rx(y) + .16*Math.pow(Math.abs(z)/hw, 3.4), y, z]; }, [...RUBBER, 0], [-1, 0, 0]);
  patch(b, 8, 6, (u, v) => { const y = 1.66 + 0.78*v, z = (u - .5)*(W - 0.7); return [rx(y) - 0.006 + .16*Math.pow(Math.abs(z)/hw, 3.4), y, z]; }, PANE, [-1, 0, 0]);
  for (let k = 0; k < 12; k++) rbox(b, -hl - 0.022, 0.62 + k*0.058, -0.86, -hl + 0.02, 0.645 + k*0.058, 0.86, [0.09, 0.09, 0.1]);
  rbox(b, -hl - 0.09, 0.38, -hw - 0.012, -hl + 0.09, 0.6, hw + 0.012, [0.12, 0.12, 0.13]);
  box(b, rx(2.76) - 0.012, 2.62, -0.7, rx(2.76) + 0.01, 2.9, 0.7, [1, 0.45, 0.05], 0, 0.7);
  for (const s of [-1, 1]) { rbox(b, -hl - 0.03, 0.72, s*(hw - 0.3), -hl + 0.02, 1.04, s*(hw - 0.06), [0.1, 0.1, 0.1]); for (const q of [0.8, 0.96]) b.addGeo(G.sph2, M(-hl - 0.02, q, s*(hw - 0.18), 0.03, 0.07, 0.09), TAIL, 0, 0.9); b.addGeo(G.sph2, M(-hl - 0.02, 1.1, s*(hw - 0.18), 0.03, 0.04, 0.08), AMBER, 0, 0.7); rod(b, [-hl + 0.1, 0.42, s*0.55], [-hl - 0.02, 0.2, s*0.55], 0.02, RUBBER); }
  box(b, -hl - 0.03, 0.46, -0.17, -hl - 0.015, 0.56, 0.17, [0.98, 0.9, 0.3]);
  // the roof: the gas tanks' long housing with its ribs and vents, hatches, an antenna
  for (let x = -hl + 0.6; x < -hl + 4.6; x += 0.5) rbox(b, x + 0.02, 3.13, -0.72, x + 0.46, 3.44, 0.72, [0.82, 0.82, 0.79]);
  for (let x = -hl + 0.8; x < -hl + 4.6; x += 0.5) for (const s of [-1, 1]) for (let k = 0; k < 4; k++) box(b, x + k*0.08, 3.22, s*0.721, x + k*0.08 + 0.05, 3.36, s*0.726, [0.3, 0.3, 0.3]);
  for (const x of [0.4, 2.8]) { rbox(b, x - 0.48, 3.15, -0.42, x + 0.48, 3.25, 0.42, [0.74, 0.74, 0.7]); rbox(b, x - 0.4, 3.24, -0.34, x + 0.4, 3.28, 0.34, [0.1, 0.12, 0.13]); }
  for (let x = 0.9; x < hl - 1; x += 0.6) for (const s of [-1, 1]) box(b, x, 3.1, s*0.62 - .01, x + 0.012, 3.17, s*0.62 + .01, [0.68, 0.68, 0.64]);
  rod(b, [2.1, 3.16, 0.2], [1.9, 3.72, 0.22], 0.008, RUBBER);
  return { body: b.build(), glass: gl.build(), dims: { L, W, H, wb: 5.4 } };
}

// ---------------------------------------------------------------- tempo (mini truck)
export function buildTempo() {
  const b = newB(true), gl = newB(false);
  const L = 3.8, W = 1.55, hl = L / 2, hw = W / 2, cab = [1, 1, 1], R = 0.32, FX = 1.25, RX = -1.2, side = [0.9, 0.55, 0.1], wood = [0.42, 0.3, 0.2], AR = 0.4;
  // the cab, in one piece: nose, bonnet, raked windscreen, roof, a flat back; its wheel arch cut in
  const roofY = (x) => { const t = [[0.7, 1.9], [1.05, 1.93], [1.36, 1.92], [1.5, 1.86], [1.62, 1.62], [1.73, 1.28], [1.78, 1.16], [1.88, 1.12], [1.95, 1.04], [1.99, 0.94]]; for (let i = 0; i < t.length - 1; i++) if (x <= t[i + 1][0]) { const k = (x - t[i][0])/(t[i + 1][0] - t[i][0]); return t[i][1] + (t[i + 1][1] - t[i][1])*k; } return 0.94; };
  const yArch = (x) => { const d = Math.abs(x - FX); return d < AR ? R + Math.sqrt(AR*AR - d*d) : 0; };
  const outline = (x) => { const rt = roofY(x), yb = Math.max(0.42, yArch(x)), y2 = Math.max(yb + 0.04, 0.52), sh = Math.min(1.14, rt - 0.02), hasGlass = rt > 1.2, O = [[0, 0.42], [hw - 0.2, 0.42], [hw - 0.2, yb], [hw - 0.02, yb], [hw, y2], [hw, Math.max(y2 + .03, 0.78)], [hw, Math.max(y2 + .05, sh - 0.14)], [hw, sh]]; if (hasGlass) O.push([hw - 0.035, sh + (rt - sh)*0.5], [hw - 0.07, rt - 0.09], [hw - 0.17, rt - 0.02], [hw*0.45, rt], [0, rt + 0.006]); else O.push([hw - 0.06, rt - 0.01], [hw*0.45, rt + 0.004], [0, rt + 0.006]); return O; };
  const noseAt = (x, y, z) => { const c = Math.pow(Math.abs(z)/hw, 3); return Math.min(x, 1.99 - 0.13*c - (y > 1.0 ? (y - 1)*.12 : (1 - y)*.05)); };
  const xs = stationsOf([0.7, 0.72, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.36, 1.43, 1.5, 1.56, 1.62, 1.68, 1.73, 1.78, 1.83, 1.88, 1.92, 1.95, 1.97, 1.99, ...[-1, -.9, -.7, -.45, 0, .45, .7, .9, 1].map(k => FX + k*AR)], 0.012);
  // shell() wants all its row lengths equal, so the rows are padded to the longest outline
  const outline2 = (x) => { const O = outline(x); while (O.length < 13) O.splice(O.length - 1, 0, [(O[O.length - 2][0] + O[O.length - 1][0])/2, (O[O.length - 2][1] + O[O.length - 1][1])/2]); return O; };
  shell(b, xs, outline2, noseAt, (q) => (q.ny < -0.55 || (Math.abs(q.z) < hw - 0.05 && q.y < 0.9 && Math.abs(q.nx) < 0.7)) ? [...RUBBER, 0] : [...cab, 1]);
  // chassis
  box(b, -hl + 0.1, 0.34, -0.42, 0.75, 0.46, -0.32, RUBBER); box(b, -hl + 0.1, 0.34, 0.32, 0.75, 0.46, 0.42, RUBBER);
  for (const x of [-1.6, -1.1, -0.6, -0.1, 0.4]) box(b, x, 0.42, -0.5, x + 0.06, 0.55, 0.5, [0.12, 0.12, 0.13]);
  b.addGeo(G.cyl12, M(RX, R, 0, 0.05, 1.35, 0.05, Math.PI/2), [0.12, 0.12, 0.13]); rbox(b, RX - 0.12, R - 0.1, -0.13, RX + 0.12, R + 0.1, 0.13, [0.1, 0.1, 0.11]);
  for (const s of [-1, 1]) { rbox(b, RX - 0.55, 0.36, s*0.4 - .03, RX + 0.55, 0.42, s*0.4 + .03, [0.15, 0.15, 0.16]); wheel(b, FX, R, s*(hw - 0.15), R, 0.18); wheel(b, RX, R, s*(hw - 0.15), R, 0.18); rbox(b, RX - AR - 0.04, 0.2, s*(hw - 0.17), RX - AR, 0.58, s*(hw - 0.01), RUBBER); }
  tube(b, [[0.2, 0.33, 0.3], [-0.8, 0.31, 0.32], [-1.72, 0.33, 0.38], [-1.86, 0.36, 0.38]], 0.024, [0.2, 0.2, 0.2], 10, 6);    // exhaust
  b.addGeo(G.cyl12, M(-0.25, 0.32, -0.1, 0.17, 0.2, 0.17, Math.PI/2), [0.06, 0.06, 0.06]);                                         // the spare slung under it
  // glass: windscreen, door windows, a small back window; pillars, doors, handles, wipers, mirrors
  const wx = (y, z) => noseAt(1.99, y, z) - 0.01, wsY = (x) => roofY(x);
  const ws = (u, v, m, lift) => { const x = 1.5 + m + (1.76 - 1.5 - 2*m)*v, zw = hw - 0.17 - m, z = (2*u - 1)*zw, c = Math.abs(z)/(hw - 0.17); return [x + lift*0.8, wsY(x) - 0.02*c*c*c + lift, z]; };
  patch(b, 16, 8, (u, v) => ws(u, v, 0, 0.009), [...RUBBER, 0], [1, 1, 0]);
  patch(b, 16, 8, (u, v) => ws(u, v, 0.022, 0.014), PANE, [1, 1, 0]);
  for (const s of [-1, 1]) {
    patch(b, 6, 4, (u, v) => { const x = 0.98 + 0.5*u; return [x - v*0.0, 1.2 + (Math.min(1.78, roofY(x) - 0.12) - 1.2)*v, s*(hw - 0.035*v - 0.002 + 0.007)]; }, PANE, [0, 0, s]);
    box(b, 0.95, 1.14, s*hw, 0.98, 1.82, s*(hw + 0.006), RUBBER);
    rbox(b, 0.92, 0.6, s*hw, 0.94, 1.8, s*(hw + 0.005), [0.05, 0.05, 0.055]);             // door shuts
    rbox(b, 1.52, 0.6, s*hw, 1.54, 1.15, s*(hw + 0.005), [0.05, 0.05, 0.055]);
    rbox(b, 0.92, 0.58, s*hw, 1.54, 0.6, s*(hw + 0.005), [0.05, 0.05, 0.055]);
    rbox(b, 1.0, 1.05, s*(hw + 0.002), 1.14, 1.09, s*(hw + 0.022), [0.08, 0.08, 0.085]);       // handle
    rod(b, [1.56, 1.42, s*(hw - 0.02)], [1.62, 1.5, s*(hw + 0.16)], 0.009, RUBBER);
    rbox(b, 1.58, 1.42, s*(hw + 0.12), 1.64, 1.67, s*(hw + 0.26), RUBBER);
    rod(b, [1.77, 1.2, s*0.62], [1.62, 1.6, s*0.2], 0.006, RUBBER);
    // lamps, indicator, the fender's stripe, bumper ends
    rbox(b, 1.94, 0.76, s*0.48, 2.0, 0.96, s*0.72, [0.8, 0.8, 0.82]);
    b.addGeo(G.sph2, M(1.99, 0.86, s*0.6, 0.03, 0.08, 0.1), HEAD, 0, 1);
    b.addGeo(G.sph2, M(1.97, 0.7, s*0.62, 0.025, 0.03, 0.07), AMBER, 0, 0.7);
    // tail lamps on the bed's end
    rbox(b, -hl - 0.03, 0.56, s*(hw - 0.3), -hl + 0.02, 0.74, s*(hw - 0.06), [0.1, 0.1, 0.1]); b.addGeo(G.sph2, M(-hl - 0.03, 0.65, s*(hw - 0.18), 0.02, 0.07, 0.1), TAIL, 0, 0.9);
    rbox(b, RX - 0.44, 0.12, s*(hw - 0.26), RX - 0.41, 0.48, s*(hw - 0.04), RUBBER);          // mud flaps
  }
  // the grille, its bars and badge; bumper, plate
  rbox(b, 1.955, 0.7, -0.44, 2.0, 0.96, 0.44, [0.05, 0.05, 0.055]);
  for (let k = 0; k < 5; k++) rbox(b, 1.985, 0.72 + k*0.05, -0.42, 2.012, 0.74 + k*0.05, 0.42, [0.5, 0.5, 0.52]);
  b.addGeo(G.sph2, M(2.012, 0.84, 0, 0.012, 0.04, 0.06), CHROME);
  rbox(b, 1.9, 0.5, -hw - 0.01, 2.04, 0.66, hw + 0.01, [0.14, 0.14, 0.15]); box(b, 2.035, 0.53, -0.2, 2.045, 0.62, 0.2, [0.96, 0.96, 0.9]);
  // the bed: planks, posts, hinged sides, a tailgate with chains and latches
  rbox(b, -hl, 0.5, -hw, 0.68, 0.56, hw, [0.2, 0.18, 0.16]);
  for (let z = -hw + 0.04; z < hw - 0.04; z += 0.14) box(b, -hl + 0.02, 0.56, z, 0.66, 0.595, z + 0.125, wood);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) rbox(b, -hl + 0.02, 0.62 + k*0.145, s*hw - 0.022, 0.66, 0.75 + k*0.145, s*hw + 0.022, side);
    for (const x of [-1.78, -1.0, -0.2, 0.62]) { rbox(b, x - 0.04, 0.54, s*hw - 0.03, x + 0.04, 1.1, s*hw + 0.032, [0.14, 0.14, 0.15]); }
    for (const x of [-1.4, -0.6, 0.2]) { b.addGeo(G.cyl8, M(x, 0.62, s*(hw + 0.026), 0.015, 0.06, 0.015, 0, 0, Math.PI/2), [0.15, 0.15, 0.15]); rod(b, [x, 0.98, s*(hw + 0.024)], [x, 1.02, s*(hw + 0.036)], 0.012, STEEL); }
  }
  for (let k = 0; k < 3; k++) rbox(b, -hl - 0.025, 0.62 + k*0.145, -hw + 0.03, -hl + 0.025, 0.75 + k*0.145, hw - 0.03, side);
  for (const x of [-hl, 0.66]) rbox(b, x - 0.02, 1.07, -hw, x + 0.02, 1.11, hw, [0.14, 0.14, 0.15]);
  for (const s of [-1, 1]) tube(b, [[-hl - 0.03, 1.02, s*(hw - 0.03)], [-hl - 0.09, 0.9, s*(hw - 0.03)], [-hl - 0.03, 0.78, s*(hw + 0.02)]], 0.005, STEEL, 8, 4);
  box(b, 0.68, 0.56, -hw, 0.71, 1.32, hw, [0.2, 0.2, 0.2]);                             // the cab's guard
  for (let z = -hw + 0.06; z < hw; z += 0.1) rod(b, [0.67, 1.1, z], [0.67, 1.32, z], 0.006, [0.14, 0.14, 0.15]);
  box(b, -hl - 0.03, 0.44, -0.2, -hl - 0.01, 0.55, 0.2, [0.98, 0.82, 0.12]);
  // the load: sacks, a rope over them
  const load = [[-1.55, -0.32], [-1.55, 0.3], [-0.95, -0.32], [-0.95, 0.3], [-0.35, -0.32], [-0.35, 0.3], [0.25, -0.32], [0.25, 0.3]];
  for (const [x, z] of load) b.addGeo(RB, M(x, 0.76, z, 0.62, 0.32, 0.52), [0.85, 0.82, 0.72], 0, 3);
  for (const [x, z] of load.slice(0, 5)) b.addGeo(RB, M(x + 0.16, 1.03, z*.6, 0.6, 0.28, 0.5), [0.8, 0.77, 0.66], 0, 3);
  for (const x of [-1.25, -0.25]) tube(b, [[x, 1.1, -hw], [x, 1.26, -0.3], [x, 1.28, 0.3], [x, 1.1, hw]], 0.008, [0.72, 0.7, 0.6], 12, 4);
  return { body: b.build(), glass: gl.build(), dims: { L, W, H: 1.95, wb: 2.45 } };
}

// palette helpers for AI traffic (sRGB, converted to linear by caller)
export const PAINTS = {
  car: [[0.95, 0.95, 0.94], [0.95, 0.95, 0.94], [0.75, 0.76, 0.78], [0.55, 0.56, 0.58], [0.12, 0.12, 0.13], [0.6, 0.08, 0.08], [0.1, 0.2, 0.45], [0.75, 0.62, 0.45], [0.3, 0.32, 0.36], [0.85, 0.85, 0.83]],
  two: [[0.08, 0.08, 0.08], [0.9, 0.9, 0.9], [0.62, 0.05, 0.05], [0.1, 0.25, 0.55], [0.45, 0.47, 0.5], [0.85, 0.75, 0.2], [0.2, 0.45, 0.3], [0.95, 0.4, 0.6]],
  shirt: [[0.95, 0.95, 0.93], [0.4, 0.6, 0.85], [0.85, 0.3, 0.3], [0.2, 0.25, 0.35], [0.95, 0.85, 0.5], [0.3, 0.55, 0.35], [0.6, 0.2, 0.5], [0.95, 0.6, 0.2], [0.55, 0.55, 0.55], [0.15, 0.15, 0.17]],
  helmet: [[0.1, 0.1, 0.1], [0.9, 0.9, 0.9], [0.7, 0.1, 0.1], [0.15, 0.3, 0.6], [0.08, 0.07, 0.06], [0.08, 0.07, 0.06]],
  tempo: [[0.95, 0.95, 0.93], [0.2, 0.4, 0.75], [0.85, 0.6, 0.1], [0.9, 0.9, 0.85]],
};

// ---------------------------------------------------------------- far models: real shapes, just fewer of everything
function lowWheel(b, x, y, z, r, w) { b.addGeo(G.cyl8, M(x, y, z, r, w, r, Math.PI/2), TYRE, MATTE); b.addGeo(G.cyl8, M(x, y, z, r*.55, w + .01, r*.55, Math.PI/2), RIM); }
const LR = (pts, paint, ring = 8) => pts;
export function buildLow(kind, parked = false) {
  const b = newB(true);
  const two = ['scooter', 'scooterP', 'bike', 'bikeP', 'cycle', 'bullet', 'superbike'].includes(kind), paintQ = () => [1, 1, 1, 1], dark = () => [.07, .07, .075, 0, MATTE];
  if (two) {
    const scooter = kind.startsWith('scooter'), cyc = kind === 'cycle', R = cyc ? .34 : scooter ? .25 : .3, xf = cyc ? .5 : scooter ? .66 : .78, xr = cyc ? -.5 : scooter ? -.62 : -.6;
    lowWheel(b, xf, R, 0, R, .1); lowWheel(b, xr, R, 0, R, .11);
    if (cyc) { rod(b, [xf, R, 0], [.38, .9, 0], .02, BLACK, TUBE6); rod(b, [-.2, .86, 0], [-.05, .33, 0], .02, [1, 1, 1], TUBE6, 1); rod(b, [-.18, .76, 0], [.36, .84, 0], .02, [1, 1, 1], TUBE6, 1); rod(b, [.34, .72, 0], [-.05, .33, 0], .02, [1, 1, 1], TUBE6, 1); rod(b, xr < 0 ? [xr, R, 0] : [0, 0, 0], [-.05, .33, 0], .014, BLACK, TUBE6); rod(b, [.42, 1, -.3], [.42, 1, .3], .012, CHROME, TUBE6); }
    else if (scooter) {
      loft(b, [{ x: -.88, w: .11, yb: .45, yt: .62, n: 3 }, { x: -.6, w: .2, yb: .29, yt: .72, n: 3.5 }, { x: -.2, w: .19, yb: .3, yt: .67, n: 3 }, { x: -.08, w: .13, yb: .36, yt: .5, n: 3 }], paintQ, { ring: 8 });
      loft(b, [{ x: -.75, w: .12, yb: .69, yt: .77, n: 3 }, { x: -.45, w: .17, yb: .69, yt: .8, n: 3 }, { x: -.12, w: .12, yb: .69, yt: .75, n: 3 }], dark, { ring: 6 });
      loft(b, [{ x: -.3, w: .18, yb: .26, yt: .33, n: 4 }, { x: .5, w: .18, yb: .26, yt: .34, n: 4 }], dark, { ring: 6 });
      loft(b, [{ x: .42, w: .17, yb: .3, yt: .42, n: 3 }, { x: .56, w: .21, yb: .32, yt: .95, n: 3.5 }, { x: .68, w: .19, yb: .37, yt: .99, n: 3 }, { x: .74, w: .1, yb: .52, yt: .86, n: 2.5 }], paintQ, { ring: 8 });
      loft(b, [{ x: .56, w: .28, yb: .97, yt: 1.03, n: 3 }, { x: .72, w: .18, yb: .96, yt: 1.03, n: 2.5 }], paintQ, { ring: 6 });
      rod(b, [.62, 1.01, -.38], [.62, 1.01, .38], .022, BLACK, TUBE6);
    } else {
      loft(b, [{ x: -.1, w: .08, yb: .82, yt: .92, n: 2.6 }, { x: .2, w: .16, yb: .79, yt: 1.03, n: 2.8 }, { x: .52, w: .06, yb: .88, yt: .95, n: 2.4 }], paintQ, { ring: 8 });
      loft(b, [{ x: -.68, w: .08, yb: .84, yt: .9, n: 2.5 }, { x: -.3, w: .13, yb: .84, yt: .95, n: 3 }, { x: 0, w: .08, yb: .85, yt: .92, n: 2.5 }], dark, { ring: 6 });
      loft(b, [{ x: -.5, w: .1, yb: .6, yt: .82, n: 3 }, { x: -.1, w: .14, yb: .56, yt: .85, n: 3.5 }], paintQ, { ring: 6 });
      rbox(b, -.15, .3, -.14, .32, .7, .14, [.42, .42, .44]);
      rod(b, [.57, .96, 0], [.78, .33, 0], .03, CHROME, TUBE6); rod(b, [-.2, .34, .21], [-.82, .46, .21], .05, CHROME, TUBE6); rod(b, [.6, 1.07, -.37], [.6, 1.07, .37], .016, BLACK, TUBE6);
      b.addGeo(G.sphLo, M(.72, 1, 0, .09, .09, .09), CHROME);
    }
    if (parked) return b.build();
    // the rider: shoulders, a head, arms and legs in a few sides
    const hipX = cyc ? -.28 : scooter ? -.38 : -.32, hipY = cyc ? .92 : scooter ? .8 : .95, lean = cyc ? .2 : scooter ? .1 : .28, hand = [cyc ? .44 : .62, cyc ? 1 : 1.04];
    const shX = hipX + lean*.5, shY = hipY + .5;
    rod(b, [hipX, hipY, 0], [shX, shY, 0], .17, [1, 1, 1], G.cyl8, 2);
    b.addGeo(G.sphLo, M(shX, shY, 0, .17, .08, .19), [1, 1, 1], 0, 2);
    b.addGeo(G.sphLo, M(shX + .05, shY + .18, 0, .12, .13, .115), [1, 1, 1], 0, 3);
    for (const s of [-1, 1]) { rod(b, [shX, shY - .02, s*.18], [hand[0], hand[1], s*.28], .04, [1, 1, 1], TUBE6, 2); rod(b, [hipX, hipY, s*.08], [hipX + .35, hipY - .05, s*.13], .06, [.2, .22, .3], TUBE6); rod(b, [hipX + .35, hipY - .05, s*.13], [hipX + .45, .36, s*.13], .05, [.2, .22, .3], TUBE6); }
    if (kind === 'scooterP' || kind === 'bikeP') { const px = hipX - .36; rod(b, [px, hipY + .02, 0], [px + .05, hipY + .48, 0], .16, [1, 1, 1], G.cyl8, 2); b.addGeo(G.sphLo, M(px + .07, hipY + .66, 0, .11, .12, .11), SKIN); for (const s of [-1, 1]) rod(b, [px, hipY, s*.08], [px + .25, hipY - .42, s*.13], .055, [.2, .22, .3], TUBE6); }
  } else if (kind === 'auto') {
    loft(b, [{ x: -1.4, w: .62, yb: .31, yt: .7, n: 4 }, { x: -1.35, w: .665, yb: .28, yt: .74, n: 5.5 }, { x: -.3, w: .665, yb: .28, yt: .74, n: 5.5 }, { x: -.18, w: .6, yb: .3, yt: .7, n: 4 }], (s, q) => q.y > .565 && q.y < .66 && Math.abs(q.ny) < .6 ? [...AUTO_Y, 0] : [...BLACK, 0], { ring: 10 });
    loft(b, [{ x: .1, w: .55, yb: .3, yt: .5, n: 4 }, { x: .55, w: .5, yb: .3, yt: 1, n: 5 }, { x: 1.1, w: .47, yb: .31, yt: .95, n: 4.5 }, { x: 1.27, w: .27, yb: .44, yt: .72, n: 3.5 }], (s, q) => q.y > .88 ? [...AUTO_Y, 0] : [...BLACK, 0], { ring: 10 });
    loft(b, [{ x: -1.43, w: .66, yb: .74, yt: 1.68, n: 7 }, { x: -1.37, w: .7, yb: .74, yt: 1.7, n: 8, seg: 'open' }, { x: -.97, w: .7, yb: .74, yt: 1.7, n: 8, seg: 'open' }, { x: .9, w: .66, yb: .74, yt: 1.68, n: 8 }, { x: 1, w: .6, yb: 1.46, yt: 1.64, n: 5 }], (s, q) => q.ny < -.5 ? null : (s === 'open' && q.y < 1.5 ? null : [...BLACK, 1, MATTE]), { ring: 12, inner: .02 });
    box(b, .92, 1, -.54, .95, 1.5, .54, [.1, .12, .14]);
    box(b, -1.25, .72, -.6, -.62, .9, .6, [.12, .1, .09]); box(b, -1.33, .9, -.6, -1.2, 1.32, .6, [.12, .1, .09]);
    lowWheel(b, 1, .21, 0, .21, .12); for (const s of [-1, 1]) lowWheel(b, -.98, .21, s*.58, .21, .13);
    b.addGeo(G.circle, M(1.3, .7, 0, .075, .075, 1, 0, Math.PI/2), HEAD, 1);
    for (const s of [-1, 1]) box(b, -1.42, .44, s*.42, -1.4, .5, s*.58, TAIL, 0, .9);
  } else if (kind === 'bus') {
    const red = [.72, .12, .1], cream = [.93, .88, .76];
    loft(b, [{ x: -5.7, w: 1.2, yb: .42, yt: 3.1, n: 7 }, { x: -5.6, w: 1.27, yb: .36, yt: 3.15, n: 9, seg: 'b' }, { x: 5.6, w: 1.27, yb: .36, yt: 3.15, n: 9 }, { x: 5.7, w: 1.2, yb: .42, yt: 3.1, n: 7 }], (s, q) => q.ny > .6 ? [.85, .85, .82, 0] : q.y < 1.35 ? [...red, 0] : [...cream, 0], { ring: 12 });
    for (const s of [-1, 1]) box(b, -5.1, 1.45, s*1.272, 4.5, 2.3, s*1.278, [.1, .12, .14]);
    box(b, 5.7, 1.15, -1.1, 5.72, 2.55, 1.1, [.1, .12, .14]); box(b, -5.72, 1.6, -.95, -5.7, 2.4, .95, [.1, .12, .14]);
    box(b, 5.72, 2.62, -.9, 5.73, 2.95, .9, [1, .45, .05], 0, .85);
    for (const x of [3.3, -2.7]) for (const s of [-1, 1]) lowWheel(b, x, .5, s*1.02, .5, .3);
    for (const s of [-1, 1]) { box(b, 5.71, .7, s*.87, 5.73, .88, s*1.15, HEAD, 0, 1); box(b, -5.73, .7, s*.92, -5.71, .95, s*1.15, TAIL, 0, .9); }
  } else if (kind === 'tempo') {
    loft(b, [{ x: .7, w: .77, yb: .36, yt: 1.9, n: 8 }, { x: 1.7, w: .77, yb: .36, yt: 1.88, n: 8, seg: 'n' }, { x: 1.9, w: .72, yb: .4, yt: 1.1, n: 6 }], paintQ, { ring: 10 });
    box(gl0(b), 1.6, 1.12, -.66, 1.8, 1.72, .66, [.1, .12, .14]); box(b, .95, 1.2, -.775, 1.55, 1.7, .775, [.1, .12, .14]);
    box(b, -1.9, .55, -.77, .68, .65, .77, [.35, .3, .25]); for (const s of [-1, 1]) box(b, -1.9, .65, s*.77, .68, 1.05, s*.72, [.9, .55, .1]); box(b, -1.9, .65, -.77, -1.85, 1.05, .77, [.9, .55, .1]);
    b.addGeo(G.sphLo, M(-.6, 1, 0, 1.1, .4, .55), [.85, .82, .72], 0, 3);
    for (const x of [1.25, -1.2]) for (const s of [-1, 1]) lowWheel(b, x, .32, s*.62, .32, .18);
    for (const s of [-1, 1]) { box(b, 1.89, .62, s*.47, 1.92, .75, s*.69, HEAD, 0, 1); box(b, -1.91, .6, s*.52, -1.88, .72, s*.72, TAIL, 0, .9); }
  } else {
    const k = ['hatch', 'suv', 'super', 'sports', 'lux', 'jeep'].includes(kind) ? kind : 'sedan', cs = carSpec(k), L = cs.L, W = cs.W, H = cs.H, belt = cs.beltY, sill = cs.sill, hl = L/2, hw = W/2, sedan = cs.tail > .3, deck = belt - (sedan ? .03 : .06);
    loft(b, [{ x: -hl, w: hw*.82, yb: sill + .12, yt: deck - .1, n: 3.6 }, { x: -hl + .15, w: hw*.97, yb: sill + .02, yt: deck - .02, n: 4 }, { x: -hl + Math.max(.45, cs.tail), w: hw, yb: sill, yt: belt, n: 4.5 }, { x: hl - cs.hood, w: hw, yb: sill, yt: belt, n: 4.5 }, { x: hl - .2, w: hw*.96, yb: sill + .01, yt: belt - .13, n: 4 }, { x: hl, w: hw*.8, yb: sill + .1, yt: belt - .24, n: 3.6 }],
      (s, q) => q.ny < -.5 ? [...UNDER, 0, MATTE] : PAINTED, { ring: 14 });
    const gw = hw - .06, xr0 = -hl + cs.tail, xf0 = hl - cs.hood, ring = 14;
    loft(b, [{ x: xr0, w: gw, yb: deck - .02, yt: deck + .02, n: 5, tw: .92 }, { x: cs.roofR, w: gw - .03, yb: belt - .04, yt: H, n: 5, tw: .8 }, { x: cs.roofF, w: gw - .03, yb: belt - .04, yt: H, n: 5, tw: .8 }, { x: xf0, w: gw, yb: belt - .03, yt: belt + .01, n: 5, tw: .92 }],
      (s, q) => q.ny < -.4 ? null : (q.ny > .72 && q.y > H - .1) ? PAINTED : WINDOW, { ring, caps: false });
    for (const sd of [-1, 1]) {
      box(b, hl - .005, belt - .27, sd*W*.2, hl + .004, belt - .17, sd*W*.385, HEAD, 0, 1);
      box(b, -hl - .004, deck - .22, sd*W*.22, -hl + .005, deck - .12, sd*W*.4, TAIL, 0, .9);
      for (const x of [L/2 - cs.overhang, -(L/2 - cs.overhang)]) lowWheel(b, x, cs.R, sd*(hw - .08), cs.R, .21);
    }
    box(b, hl + .002, sill + .17, -W*.18, hl + .006, belt - .28, W*.18, BLACK);
  }
  return b.build();
}
function gl0(b) { return b; }
