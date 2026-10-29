// Procedural vehicle + rider models. Local frame: +x forward, +y up, +z right; origin on the
// ground at the centre of the wheelbase. Paint channels: 1 body (instanceColor), 2 rider shirt
// (aColB), 3 helmet / hair / cargo (aColC).
import * as THREE from 'three';
import { loft, archDecal } from './loft.js';
import { ColorBuilder } from '../world/geo.js';

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
function wheel(b, x, y, z, r, w, hub = RIM) {
  b.addGeo(G.cyl16, M(x, y, z, r, w, r, Math.PI / 2), TYRE, MATTE);
  b.addGeo(G.cyl8, M(x, y, z, r * 0.55, w + 0.01, r * 0.55, Math.PI / 2), hub);
}
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
  // chassis + floor
  box(b, -1.3, 0.27, -0.6, 0.95, 0.33, 0.6, BLACK);
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
  for (const s of [-1, 1]) b.addGeo(G.sph2, M(-1.405, 0.47, s * 0.5, 0.012, 0.045, 0.075), TAIL, 0, 0.9);
  box(b, -1.41, 0.36, -0.17, -1.4, 0.47, 0.17, [0.98, 0.82, 0.12]);
  // passenger bench + backrest
  box(b, -1.25, 0.72, -0.6, -0.62, 0.9, 0.6, [0.12, 0.1, 0.09]);
  box(b, -1.33, 0.9, -0.6, -1.2, 1.32, 0.6, [0.12, 0.1, 0.09]);
  // driver area floor sides & legshield
  box(b, -0.2, 0.33, -0.55, 0.62, 0.42, 0.55, BLACK);
  // driver seat
  box(b, 0.1, 0.62, -0.24, 0.55, 0.76, 0.24, [0.13, 0.11, 0.1]);
  box(b, 0.2, 0.33, -0.12, 0.45, 0.62, 0.12, [0.15, 0.15, 0.15]);
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
  // headlamp + indicators + horn grille
  b.addGeo(G.cyl12, M(1.27, 0.7, 0, 0.09, 0.05, 0.09, 0, 0, Math.PI / 2), CHROME);
  b.addGeo(G.circle, M(1.30, 0.7, 0, 0.075, 0.075, 1, 0, Math.PI / 2), HEAD, 0, 1.0);
  for (const s of [-1, 1]) b.addGeo(G.sphLo, M(1.2, 0.86, s * 0.36, 0.04, 0.04, 0.04), AMBER, 0, 0.7);
  box(b, 1.22, 0.48, -0.12, 1.25, 0.56, 0.12, [0.2, 0.2, 0.2]);
  // windshield frame + glass + yellow visor
  box(b, 0.92, 1.0, -0.56, 0.95, 1.52, -0.52, BLACK); box(b, 0.92, 1.0, 0.52, 0.95, 1.52, 0.56, BLACK);
  box(b, 0.9, 1.5, -0.58, 1.02, 1.6, 0.58, AUTO_Y);
  sh.addGeo(G.box, M(0.935, 1.26, 0, 0.012, 0.48, 1.04, 0, 0, 0.08), opts.sepShield ? [0.75, 0.82, 0.86] : [0.1, 0.12, 0.14]);
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
    b.addGeo(G.cyl12, M(1.0, 1.38, s * 0.72, 0.07, 0.02, 0.05, 0, 0, Math.PI / 2), [0.2, 0.2, 0.22]);
  }
  // canopy: one rounded canvas hood over a frame, roof, rear wall and rear quarter panels; the sides
  // are open over the passenger bench and the driver (inside faces are drawn too)
  const roofY = 1.66;
  loft(b, [
    { x: -1.43, w: 0.66, yb: 0.74, yt: roofY + 0.02, n: 7, seg: 'quarter' },
    { x: -1.37, w: 0.7, yb: 0.74, yt: roofY + 0.04, n: 8, seg: 'quarter' },
    { x: -0.97, w: 0.7, yb: 0.74, yt: roofY + 0.04, n: 8, seg: 'open' },
    { x: 0.9, w: 0.66, yb: 0.74, yt: roofY + 0.02, n: 8, seg: 'nose' },
    { x: 1.0, w: 0.6, yb: 1.46, yt: roofY - 0.02, n: 5 },
  ], (seg, q) => {
    const CANVAS = [...BLACK, 1, MATTE];
    if (seg === 'capRear') return CANVAS;
    if (seg === 'capFront') return [...AUTO_Y, 0];
    if (q.ny < -0.5) return null;                                          // no floor in the hood
    if (seg === 'nose') return q.y > 1.42 ? (q.y < 1.6 && q.nx > 0.3 ? [...AUTO_Y, 0] : CANVAS) : null;
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
  // rear window (clear plastic) with chrome frame, on the back wall
  gl.addGeo(G.box, M(-1.435, 1.36, 0, 0.01, 0.2, 0.62), [0.1, 0.12, 0.14]);
  box(b, -1.442, 1.25, -0.33, -1.434, 1.27, 0.33, CHROME); box(b, -1.442, 1.45, -0.33, -1.434, 1.47, 0.33, CHROME);
  b.addGeo(G.cyl8, M(-1.44, 0.8, 0, 0.02, 1.0, 0.02, Math.PI / 2), CHROME);   // rear grab rail
  // front fork + mudguard
  b.addGeo(G.cyl8, M(xf + 0.02, 0.48, 0, 0.03, 0.55, 0.03, 0, 0, 0.25), CHROME);
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
export function buildScooter(opts = {}) {
  const b = newB(true), gl = newB(false);
  const R = 0.25;
  const body = [0.9, 0.9, 0.9];
  const paint = [...body, 1];
  // rear body: one rounded moulding over the engine, tail lamp at the back
  loft(b, [
    { x: -0.88, w: 0.12, yb: 0.42, yt: 0.62, n: 3 },
    { x: -0.8, w: 0.19, yb: 0.32, yt: 0.7, n: 3.5 },
    { x: -0.45, w: 0.21, yb: 0.28, yt: 0.72, n: 3.5 },
    { x: -0.18, w: 0.19, yb: 0.3, yt: 0.66, n: 3.2 },
    { x: -0.08, w: 0.14, yb: 0.34, yt: 0.5, n: 3 },
  ], () => paint, { ring: 20 });
  b.addGeo(G.sph2, M(-0.885, 0.54, 0, 0.012, 0.045, 0.085), TAIL, 0.9);
  // seat: a soft rounded cushion
  loft(b, [
    { x: -0.76, w: 0.13, yb: 0.69, yt: 0.75, n: 2.5 },
    { x: -0.7, w: 0.16, yb: 0.69, yt: 0.79, n: 3 },
    { x: -0.25, w: 0.16, yb: 0.69, yt: 0.78, n: 3 },
    { x: -0.12, w: 0.12, yb: 0.69, yt: 0.74, n: 2.5 },
  ], () => [0.08, 0.08, 0.08, 0, MATTE], { ring: 16 });
  // floorboard
  box(b, -0.3, 0.26, -0.18, 0.5, 0.33, 0.18, BLACK, 0, MATTE);
  // front apron: a curved shield rising to the handlebar
  loft(b, [
    { x: 0.42, w: 0.17, yb: 0.3, yt: 0.4, n: 3 },
    { x: 0.5, w: 0.2, yb: 0.3, yt: 0.66, n: 3.5 },
    { x: 0.58, w: 0.21, yb: 0.32, yt: 0.95, n: 3.5 },
    { x: 0.68, w: 0.2, yb: 0.36, yt: 0.98, n: 3 },
    { x: 0.73, w: 0.15, yb: 0.45, yt: 0.9, n: 2.6 },
  ], (seg, q) => paint, { ring: 20 });
  // handlebar with its rounded cowl and the headlamp
  loft(b, [
    { x: 0.56, w: 0.3, yb: 0.97, yt: 1.03, n: 3 },
    { x: 0.64, w: 0.32, yb: 0.96, yt: 1.06, n: 3 },
    { x: 0.71, w: 0.22, yb: 0.95, yt: 1.03, n: 2.6 },
  ], () => paint, { ring: 16 });
  b.addGeo(G.sph2, M(0.73, 0.96, 0, 0.03, 0.05, 0.08), HEAD, 0, 1);
  for (const s2 of [-1, 1]) limb(b, 0.62, 1.01, s2 * 0.3, 0.62, 1.01, s2 * 0.38, 0.022, BLACK);       // grips
  box(b, -0.89, 0.38, -0.08, -0.86, 0.45, 0.08, [0.98, 0.98, 0.95]);     // plate
  // mudguard
  guard(b, 0.66, R + 0.03, 0, R + 0.05, 0.1, body, 1);
  // rider + maybe pillion (noRider: real people ride it, see crowd.js)
  if (!opts.parked && !opts.noRider) {
    addRider(b, -0.38, 0.8, 0, { lean: 0.05, inst: true, handX: 0.62, handY: 1.0, handW: 0.3, footX: 0.12, footY: 0.36, helmet: opts.helmet ? [0.2, 0.2, 0.2] : null });
    if (opts.pillion) addPillion(b, -0.72, 0.82, 0, opts.sideSaddle, true);
  } else if (opts.parked) b.addGeo(G.cyl8, M(-0.2, 0.18, -0.12, 0.015, 0.36, 0.015, 0.35, 0, 0), CHROME);   // side stand
  wheel(b, 0.66, R, 0, R, 0.1); wheel(b, -0.62, R, 0, R, 0.1);
  return { body: b.build(), glass: gl.build(), dims: { L: 1.85, W: 0.72, H: 1.6, wb: 1.28 } };
}
export function buildBike(opts = {}) {
  const b = newB(true), gl = newB(false);
  const R = 0.3;
  const body = [0.6, 0.05, 0.05];
  // tank (a rounded teardrop), seat cushion, side covers
  loft(b, [
    { x: -0.08, w: 0.1, yb: 0.8, yt: 0.92, n: 2.6 },
    { x: 0.02, w: 0.15, yb: 0.79, yt: 1.0, n: 2.8 },
    { x: 0.3, w: 0.16, yb: 0.8, yt: 1.03, n: 2.8 },
    { x: 0.46, w: 0.12, yb: 0.84, yt: 0.99, n: 2.6 },
    { x: 0.52, w: 0.07, yb: 0.88, yt: 0.95, n: 2.4 },
  ], () => [...body, 1], { ring: 20 });
  loft(b, [
    { x: -0.66, w: 0.08, yb: 0.84, yt: 0.9, n: 2.5 },
    { x: -0.58, w: 0.13, yb: 0.84, yt: 0.95, n: 3 },
    { x: -0.06, w: 0.13, yb: 0.84, yt: 0.95, n: 3 },
    { x: 0.0, w: 0.09, yb: 0.85, yt: 0.92, n: 2.5 },
  ], () => [0.08, 0.08, 0.08, 0, MATTE], { ring: 16 });
  loft(b, [
    { x: -0.5, w: 0.1, yb: 0.6, yt: 0.82, n: 3 },
    { x: -0.42, w: 0.14, yb: 0.56, yt: 0.85, n: 3.5 },
    { x: -0.1, w: 0.14, yb: 0.56, yt: 0.85, n: 3.5 },
    { x: -0.04, w: 0.1, yb: 0.6, yt: 0.82, n: 3 },
  ], () => [...body, 1], { ring: 16 });
  // engine + exhaust
  box(b, -0.15, 0.35, -0.16, 0.3, 0.68, 0.16, [0.45, 0.45, 0.47]);
  b.addGeo(G.cyl8, M(-0.35, 0.36, 0.2, 0.05, 0.9, 0.05, 0, 0, Math.PI / 2 - 0.1), CHROME);
  // frame + fork + handlebar + lamp
  b.addGeo(G.cyl8, M(0.58, 0.72, 0, 0.03, 0.75, 0.03, 0, 0, 0.45), CHROME);
  box(b, 0.6, 1.05, -0.36, 0.66, 1.09, 0.36, BLACK);
  b.addGeo(G.cyl12, M(0.75, 1.0, 0, 0.09, 0.08, 0.09, 0, 0, Math.PI / 2), BLACK);
  b.addGeo(G.circle, M(0.8, 1.0, 0, 0.075, 0.075, 1, 0, Math.PI / 2), HEAD, 0, 1);
  box(b, -0.7, 0.8, -0.07, -0.66, 0.86, 0.07, TAIL, 0, 0.9);
  guard(b, 0.78, R + 0.04, 0, R + 0.04, 0.09, BLACK);
  guard(b, -0.6, R + 0.04, 0, R + 0.05, 0.12, BLACK);
  if (!opts.parked && !opts.noRider) {
    addRider(b, -0.32, 0.95, 0, { lean: 0.32, inst: true, handX: 0.6, handY: 1.08, handW: 0.34, footX: 0.05, footY: 0.42, helmet: opts.helmet ? [0.6, 0.6, 0.6] : null });
    if (opts.pillion) addPillion(b, -0.62, 0.97, 0, opts.sideSaddle, true);
  }
  wheel(b, 0.78, R, 0, R, 0.09); wheel(b, -0.6, R, 0, R, 0.11);
  return { body: b.build(), glass: gl.build(), dims: { L: 2.0, W: 0.75, H: 1.75, wb: 1.3 } };
}
export function buildCycle(opts = {}) {
  const b = newB(true), gl = newB(false);
  const R = 0.34;
  const c = [0.1, 0.1, 0.12];
  b.addGeo(G.cyl8, M(0.05, 0.62, 0, 0.022, 0.75, 0.022, 0, 0, Math.PI / 2 - 0.1), c, 0, 1);
  b.addGeo(G.cyl8, M(-0.2, 0.55, 0, 0.022, 0.6, 0.022, 0, 0, 0.6), c, 0, 1);
  b.addGeo(G.cyl8, M(0.35, 0.55, 0, 0.022, 0.6, 0.022, 0, 0, -0.35), c, 0, 1);
  box(b, -0.38, 0.86, -0.08, -0.15, 0.9, 0.08, [0.1, 0.08, 0.06]);
  box(b, 0.42, 0.98, -0.3, 0.46, 1.0, 0.3, CHROME);
  if (!opts.parked) addRider(b, -0.28, 0.92, 0, { lean: 0.22, inst: true, handX: 0.44, handY: 1.0, handW: 0.28, footX: 0.05, footY: 0.32 });
  for (const x of [0.5, -0.5]) {
    b.addGeo(new THREE.TorusGeometry(R, 0.025, 3, 12), M(x, R, 0), TYRE);
  }
  return { body: b.build(), glass: gl.build(), dims: { L: 1.75, W: 0.6, H: 1.75, wb: 1.0 } };
}

// ---------------------------------------------------------------- cars
// smooth body: a lofted lower body (bumper to bumper) + a lofted greenhouse whose quads are painted
// glass, roof or pillar; lamps, grille, plates and mirrors are small inset shapes on top
const GLASS = [0.07, 0.085, 0.1], TRIM = [0.07, 0.07, 0.075], UNDER = [0.05, 0.05, 0.05];
const trimBox = (b, x0, y0, z0, x1, y1, z1) => box(b, x0, y0, z0, x1, y1, z1, TRIM, 0, MATTE);
function carBody(b, gl, spec) {
  const { L, W, H, hood, roofF, roofR, beltY, sill, R, tail } = spec;
  const hl = L / 2, hw = W / 2;
  const deck = tail > 0.3 ? beltY - 0.03 : beltY - 0.06;          // boot lid height (sedans have a boot)
  const lower = [
    { x: -hl, w: hw - 0.1, yb: sill + 0.07, yt: deck - 0.11, n: 3.6 },
    { x: -hl + 0.05, w: hw - 0.04, yb: sill + 0.03, yt: deck - 0.04, n: 3.8 },
    { x: -hl + 0.2, w: hw - 0.01, yb: sill, yt: deck, n: 4 },
    { x: -hl + Math.max(0.35, tail), w: hw, yb: sill, yt: beltY, n: 4.5 },
    { x: 0, w: hw, yb: sill, yt: beltY, n: 4.5 },
    { x: hl - hood + 0.05, w: hw, yb: sill, yt: beltY, n: 4.5 },
    { x: hl - hood * 0.45, w: hw - 0.01, yb: sill, yt: beltY - 0.07, n: 4.2 },
    { x: hl - 0.16, w: hw - 0.03, yb: sill + 0.01, yt: beltY - 0.13, n: 4 },
    { x: hl - 0.04, w: hw - 0.07, yb: sill + 0.04, yt: beltY - 0.19, n: 3.8 },
    { x: hl, w: hw - 0.12, yb: sill + 0.07, yt: beltY - 0.23, n: 3.6 },
  ];
  const INSIDE = [0.16, 0.15, 0.14, 0, MATTE], HEADLINER = [0.62, 0.6, 0.56, 0, MATTE];
  // with an interior, the cabin is open from above between the windscreen and the rear seat (no painted lid at the
  // sill hiding the seats, the console and the bottom of the wheel from the driver's seat)
  const cabinTop = (q) => spec.interior && q.ny > 0.6 && q.x < hl - hood - 0.02 && q.x > -hl + tail + 0.15 && Math.abs(q.z) < hw - 0.1;
  loft(b, lower, (seg, q) => q.inside ? (q.y > spec.sill + 0.15 ? INSIDE : null) : cabinTop(q) ? null : q.ny < -0.55 ? [...UNDER, 0] : [1, 1, 1, 1],
    spec.interior ? { ring: 28, inner: 0.03, innerColor: true } : { ring: 28 });
  // greenhouse: rear window base -> roof -> windscreen base
  const gw = hw - 0.06, xr0 = -hl + tail, xf0 = hl - hood, xb = (roofF + roofR) / 2;
  const gh = [
    { x: xr0, w: gw, yb: deck - 0.02, yt: deck + 0.02, n: 5, tw: 0.92, seg: 'rear' },
    { x: roofR, w: gw - 0.03, yb: beltY - 0.04, yt: H, n: 5, tw: 0.8, seg: 'side' },
    { x: xb - 0.07, w: gw - 0.03, yb: beltY - 0.04, yt: H, n: 5, tw: 0.8, seg: 'pillar' },
    { x: xb + 0.07, w: gw - 0.03, yb: beltY - 0.04, yt: H, n: 5, tw: 0.8, seg: 'side' },
    { x: roofF, w: gw - 0.03, yb: beltY - 0.04, yt: H, n: 5, tw: 0.8, seg: 'wind' },
    { x: xf0, w: gw, yb: beltY - 0.03, yt: beltY + 0.01, n: 5, tw: 0.92 },
  ];
  const sedan = tail > 0.3;
  loft(b, gh, (seg, q) => {
    if (q.ny < -0.4) return null;                                    // inside the lower body
    const roof = q.ny > 0.72 && q.y > H - 0.14;
    if (q.inside) {                                                  // from the driver's seat: headliner + pillars, glass stays open
      if (roof) return HEADLINER;
      const sideQ = Math.abs(q.nz) > 0.55;
      if (seg === 'pillar' || (seg === 'wind' && sideQ) || (seg === 'rear' && sideQ && sedan)) return INSIDE;
      if (q.y > H - 0.2 && !sideQ && seg === 'side') return HEADLINER;
      return null;
    }
    if (roof || seg === 'pillar') return [1, 1, 1, 1];
    const side = Math.abs(q.nz) > 0.55;
    if (seg === 'wind') return side ? [1, 1, 1, 1] : [...GLASS, 0];
    if (seg === 'rear') return side && sedan ? [1, 1, 1, 1] : [...GLASS, 0];
    // side windows with a thin body-colour frame along the top
    return q.y > H - 0.2 && !side ? [1, 1, 1, 1] : [...GLASS, 0];
  }, spec.interior ? { ring: 28, caps: false, inner: 0.03, innerColor: true } : { ring: 28, caps: false });
  // lamps, grille and plates sit flat on the end faces (the lofts' caps), so they follow the body
  const front = lower[lower.length - 1], rear = lower[0];
  const fx = hl + 0.004, rx = -hl - 0.004;
  const fyc = (front.yb + front.yt) / 2, fh = (front.yt - front.yb) / 2, fw = front.w;
  const ryc = (rear.yb + rear.yt) / 2, rh = (rear.yt - rear.yb) / 2, rw = rear.w;
  const faceQuad = (x, y0, y1, z0, z1, dir, col, glow = 0) => {
    const base = b.c;
    b.v(x, y0, z0, dir, 0, 0, ...col, glow); b.v(x, y0, z1, dir, 0, 0, ...col, glow); b.v(x, y1, z1, dir, 0, 0, ...col, glow); b.v(x, y1, z0, dir, 0, 0, ...col, glow);
    // quad in the y-z plane facing dir (+x front / -x rear)
    if ((dir > 0) === (z1 > z0)) b.i.push(base, base + 2, base + 1, base, base + 3, base + 2); else b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (const sd of [-1, 1]) {
    faceQuad(fx, fyc + fh * 0.05, fyc + fh * 0.75, sd * fw * 0.5, sd * fw * 0.92, 1, HEAD, 1.0);
    faceQuad(rx, ryc + rh * 0.1, ryc + rh * 0.8, sd * rw * 0.55, sd * rw * 0.93, -1, TAIL, 0.9);
  }
  faceQuad(fx, fyc - fh * 0.75, fyc + fh * 0.55, -fw * 0.42, fw * 0.42, 1, TRIM);                // grille
  faceQuad(rx, ryc + rh * 0.3, ryc + rh * 0.55, -rw * 0.5, rw * 0.5, -1, [0.3, 0.05, 0.05], 0.5); // light bar
  const plate = spec.yellowPlate ? [0.98, 0.82, 0.12] : [0.95, 0.95, 0.92];
  faceQuad(rx - 0.002, ryc - rh * 0.65, ryc - rh * 0.05, -0.24, 0.24, -1, plate);
  faceQuad(fx + 0.002, fyc - fh * 0.95, fyc - fh * 0.35, -0.22, 0.22, 1, plate);
  // bumpers: dark lower lips just under the end faces
  box(b, hl - 0.12, sill + 0.03, -fw * 0.95, hl + 0.01, front.yb + 0.03, fw * 0.95, TRIM, 0, MATTE);
  box(b, -hl - 0.01, sill + 0.03, -rw * 0.95, -hl + 0.12, rear.yb + 0.03, rw * 0.95, TRIM, 0, MATTE);
  // mirrors (body colour caps on black stalks)
  for (const s of [-1, 1]) {
    box(b, xf0 - 0.08, beltY + 0.01, s * (gw - 0.02), xf0 - 0.02, beltY + 0.04, s * (hw + 0.02), TRIM, 0, MATTE);
    b.addGeo(G.sph2, M(xf0 - 0.06, beltY + 0.08, s * (hw + 0.06), 0.045, 0.06, 0.085), [1, 1, 1], 0, 1);
  }
  // wheels: tyres poke out of the body side, with a dark arch behind them
  const xw = L / 2 - spec.overhang;
  for (const x of [xw, -xw]) for (const s of [-1, 1]) {
    wheel(b, x, R, s * (hw - 0.08), R, 0.21);
    archDecal(b, x, R, s * (hw + 0.004), R + 0.07, s, UNDER);
  }
}
export function carSpec(kind) {
  let spec;
  if (kind === 'hatch') spec = { L: 3.65, W: 1.6, H: 1.66, hood: 0.75, roofF: 0.95, roofR: -1.5, beltY: 0.95, sill: 0.25, R: 0.29, tail: 0.15, overhang: 0.6 };
  else if (kind === 'suv') spec = { L: 4.5, W: 1.8, H: 1.88, hood: 1.05, roofF: 0.85, roofR: -2.05, beltY: 1.12, sill: 0.38, R: 0.36, tail: 0.12, overhang: 0.75 };
  else spec = { L: 4.0, W: 1.7, H: 1.5, hood: 1.0, roofF: 0.6, roofR: -1.05, beltY: 0.88, sill: 0.24, R: 0.3, tail: 0.6, overhang: 0.72 };
  if (kind === 'taxi') spec.yellowPlate = true;
  return spec;
}
// opts.interior: also draw the inside (door cards, headliner, pillars) for the driver's-seat view
export function buildCar(kind, opts = {}) {
  const b = newB(true), gl = newB(false);
  const spec = carSpec(kind);
  spec.interior = !!opts.interior;
  carBody(b, gl, spec);
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
export function buildBus() {
  const b = newB(true), gl = newB(false);
  const L = 11.4, W = 2.55, H = 3.15, hl = L / 2, hw = W / 2;
  const red = [0.72, 0.12, 0.1], cream = [0.93, 0.88, 0.76];
  box(b, -hl, 0.4, -hw, hl, 1.35, hw, red);
  box(b, -hl, 1.35, -hw, hl, 2.25, hw, cream);
  box(b, -hl, 2.25, -hw, hl, H, hw, cream);
  box(b, -hl + 0.05, 2.95, -hw + 0.05, hl - 0.05, H + 0.05, hw - 0.05, [0.85, 0.85, 0.82]);
  // stripe
  box(b, -hl - 0.005, 1.28, -hw - 0.005, hl + 0.005, 1.36, hw + 0.005, [0.98, 0.7, 0.1]);
  // windows (glass band) + front windscreen
  box(gl, -hl + 0.6, 1.45, -hw - 0.01, hl - 1.2, 2.3, hw + 0.01, [0.1, 0.12, 0.14]);
  box(gl, hl + 0.005, 1.15, -hw + 0.12, hl + 0.01, 2.55, hw - 0.12, [0.1, 0.12, 0.14]);
  box(gl, -hl - 0.01, 1.6, -hw + 0.3, -hl - 0.005, 2.4, hw - 0.3, [0.1, 0.12, 0.14]);
  // window pillars
  for (let x = -hl + 1.4; x < hl - 1.2; x += 1.15) box(b, x - 0.05, 1.42, -hw - 0.02, x + 0.05, 2.32, hw + 0.02, cream);
  // door openings (dark) on the left side (z<0 is the driver's left)
  box(b, hl - 1.15, 0.4, -hw - 0.012, hl - 0.25, 2.3, -hw + 0.02, [0.08, 0.08, 0.08]);
  box(b, -0.6, 0.4, -hw - 0.012, 0.4, 2.3, -hw + 0.02, [0.08, 0.08, 0.08]);
  // destination board (LED orange) front & rear
  box(b, hl + 0.01, 2.62, -0.9, hl + 0.02, 2.95, 0.9, [1.0, 0.45, 0.05], 0, 0.85);
  box(b, -hl - 0.02, 2.62, -0.7, -hl - 0.01, 2.9, 0.7, [1.0, 0.45, 0.05], 0, 0.7);
  for (const s of [-1, 1]) {
    box(b, hl + 0.005, 0.7, s * (hw - 0.4), hl + 0.02, 0.88, s * (hw - 0.12), HEAD, 0, 1);
    box(b, -hl - 0.02, 0.7, s * (hw - 0.35), -hl - 0.005, 0.95, s * (hw - 0.12), TAIL, 0, 0.9);
  }
  for (const x of [hl - 2.4, -hl + 3.0]) for (const s of [-1, 1]) wheel(b, x, 0.5, s * (hw - 0.25), 0.5, 0.3);
  box(b, -hl + 0.5, 3.15, -0.6, -hl + 2.5, 3.45, 0.6, [0.82, 0.82, 0.8]);   // CNG cylinders housing
  return { body: b.build(), glass: gl.build(), dims: { L, W, H, wb: 5.4 } };
}

// ---------------------------------------------------------------- tempo (mini truck)
export function buildTempo() {
  const b = newB(true), gl = newB(false);
  const L = 3.8, W = 1.55, hl = L / 2, hw = W / 2;
  const cab = [1, 1, 1];
  extrude(b, [[0.7, 0.4], [1.9, 0.4], [1.9, 1.05], [1.75, 1.85], [0.75, 1.9], [0.7, 1.9]], -hw, hw, cab, 1, 0.06);
  box(gl, 1.75, 1.15, -hw + 0.1, 1.86, 1.75, hw - 0.1, [0.1, 0.12, 0.14]);
  box(gl, 0.95, 1.2, -hw - 0.005, 1.55, 1.7, hw + 0.005, [0.1, 0.12, 0.14]);
  // cargo bed with low sides + load
  box(b, -hl, 0.55, -hw, 0.68, 0.65, hw, [0.35, 0.3, 0.25]);
  for (const s of [-1, 1]) box(b, -hl, 0.65, s * hw, 0.68, 1.05, s * (hw - 0.05), [0.9, 0.55, 0.1]);
  box(b, -hl, 0.65, -hw, -hl + 0.05, 1.05, hw, [0.9, 0.55, 0.1]);
  for (let k = 0; k < 6; k++) b.addGeo(G.sphLo, M(-1.6 + (k % 3) * 0.7, 0.95 + Math.floor(k / 3) * 0.3, (k % 2 ? 0.3 : -0.3), 0.36, 0.22, 0.3), [0.85, 0.82, 0.72], 0, 3);
  for (const s of [-1, 1]) {
    box(b, 1.89, 0.62, s * (hw - 0.3), 1.92, 0.75, s * (hw - 0.08), HEAD, 0, 1);
    box(b, -hl - 0.01, 0.6, s * (hw - 0.25), -hl + 0.02, 0.72, s * (hw - 0.05), TAIL, 0, 0.9);
  }
  box(b, -hl - 0.02, 0.42, -0.25, -hl - 0.01, 0.55, 0.25, [0.98, 0.82, 0.12]);
  for (const x of [1.25, -1.2]) for (const s of [-1, 1]) wheel(b, x, 0.32, s * (hw - 0.15), 0.32, 0.18);
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

// ---------------------------------------------------------------- far-LOD proxies (a few boxes each)
export function buildLow(kind, parked = false) {
  const b = newB(true);
  const two = ['scooter', 'scooterP', 'bike', 'bikeP', 'cycle'].includes(kind);
  if (two) {
    box(b, -0.8, 0.12, -0.05, 0.8, 0.6, 0.05, TYRE);
    box(b, -0.55, 0.45, -0.17, 0.55, 0.85, 0.17, [1, 1, 1], 1);
    if (parked) return b.build();
    box(b, -0.45, 0.85, -0.2, -0.1, 1.42, 0.2, [1, 1, 1], 2);
    box(b, -0.35, 1.42, -0.12, -0.12, 1.66, 0.12, [1, 1, 1], 3);
    if (kind === 'scooterP' || kind === 'bikeP') box(b, -0.85, 0.85, -0.2, -0.5, 1.4, 0.2, [1, 1, 1], 2);
  } else if (kind === 'auto') {
    box(b, -1.36, 0.25, -0.65, 1.2, 0.95, 0.65, BLACK);
    box(b, -1.37, 0.56, -0.66, -0.19, 0.64, 0.66, AUTO_Y);
    box(b, -1.38, 0.95, -0.66, 0.98, 1.7, 0.66, BLACK);
    box(b, 0.9, 1.0, -0.55, 0.98, 1.5, 0.55, [0.1, 0.12, 0.14]);
  } else if (kind === 'bus') {
    box(b, -5.7, 0.35, -1.27, 5.7, 1.35, 1.27, [0.72, 0.12, 0.1]);
    box(b, -5.7, 1.35, -1.27, 5.7, 3.15, 1.27, [0.93, 0.88, 0.76]);
    box(b, -5.1, 1.45, -1.28, 4.5, 2.3, 1.28, [0.1, 0.12, 0.14]);
  } else if (kind === 'tempo') {
    box(b, 0.7, 0.35, -0.77, 1.9, 1.9, 0.77, [1, 1, 1], 1);
    box(b, -1.9, 0.35, -0.77, 0.68, 1.05, 0.77, [0.9, 0.55, 0.1]);
  } else {
    const L = kind === 'hatch' ? 3.65 : kind === 'suv' ? 4.5 : 4.0, Wd = kind === 'hatch' ? 1.6 : kind === 'suv' ? 1.8 : 1.7;
    const H = kind === 'hatch' ? 1.66 : kind === 'suv' ? 1.88 : 1.5, belt = kind === 'suv' ? 1.12 : 0.92;
    box(b, -L / 2, 0.22, -Wd / 2, L / 2, belt, Wd / 2, [1, 1, 1], 1);
    box(b, -L / 2 + 0.5, belt, -Wd / 2 + 0.08, L / 2 - 1.0, H, Wd / 2 - 0.08, [0.1, 0.12, 0.14]);
    box(b, -L / 2 + 0.6, H - 0.05, -Wd / 2 + 0.1, L / 2 - 1.1, H + 0.02, Wd / 2 - 0.1, [1, 1, 1], 1);
  }
  return b.build();
}
