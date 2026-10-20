// Procedural vehicle + rider models. Local frame: +x forward, +y up, +z right; origin on the
// ground at the centre of the wheelbase. Paint channels: 1 body (instanceColor), 2 rider shirt
// (aColB), 3 helmet / hair / cargo (aColC).
import * as THREE from 'three';
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
};

function box(b, x0, y0, z0, x1, y1, z1, c, paint = 0, glow = 0) {
  b.addGeo(G.box, M((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), c, glow, paint);
}
function wheel(b, x, y, z, r, w, hub = RIM) {
  b.addGeo(G.cyl16, M(x, y, z, r, w, r, Math.PI / 2), TYRE);
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
  // thighs
  box(b, x - 0.05, y - 0.07, z - 0.19, x + 0.38, y + 0.08, z - 0.03, pants);
  box(b, x - 0.05, y - 0.07, z + 0.03, x + 0.38, y + 0.08, z + 0.19, pants);
  // shins down to footrest
  const fx = opts.footX ?? x + 0.42, fy = opts.footY ?? y - 0.42;
  b.addGeo(G.box, M((x + 0.38 + fx) / 2, (y + fy) / 2, z - 0.11, 0.13, Math.hypot(fx - x - 0.38, fy - y) + 0.05, 0.13, 0, 0, Math.atan2(fx - x - 0.38, y - fy)), pants);
  b.addGeo(G.box, M((x + 0.38 + fx) / 2, (y + fy) / 2, z + 0.11, 0.13, Math.hypot(fx - x - 0.38, fy - y) + 0.05, 0.13, 0, 0, Math.atan2(fx - x - 0.38, y - fy)), pants);
  box(b, fx - 0.04, fy - 0.05, z - 0.17, fx + 0.18, fy + 0.03, z - 0.05, [0.12, 0.1, 0.08]);
  box(b, fx - 0.04, fy - 0.05, z + 0.05, fx + 0.18, fy + 0.03, z + 0.17, [0.12, 0.1, 0.08]);
  // torso (leaning)
  const th = 0.56;
  const tx = x + Math.sin(lean) * th / 2, ty = y + Math.cos(lean) * th / 2 + 0.05;
  if (!opts.noUpper) b.addGeo(G.box, M(tx, ty, z, 0.24, th, 0.4, 0, 0, -lean), shirt, 0, shirtP);
  const sx = x + Math.sin(lean) * th, sy = y + Math.cos(lean) * th + 0.05;
  // arms reaching to handlebar
  const hx = opts.handX ?? sx + 0.42, hy = opts.handY ?? sy - 0.22;
  for (const s of [-1, 1]) {
    let ax = sx, ay = sy - 0.04, az = z + s * 0.22;
    const hz = z + s * (opts.handW ?? 0.3);
    if (opts.noUpper) { ax += (hx - ax) * 0.5; ay += (hy - ay) * 0.5; az += (hz - az) * 0.5; }   // forearms only
    const L = Math.hypot(hx - ax, hy - ay, hz - az);
    const mx = (ax + hx) / 2, my = (ay + hy) / 2, mz = (az + hz) / 2;
    const dir = new THREE.Vector3(hx - ax, hy - ay, hz - az).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    _m.compose(_p.set(mx, my, mz), q, _s.set(0.09, L, 0.09));
    b.addGeo(G.box, _m, shirt, 0, shirtP);
    b.addGeo(G.sphLo, M(hx, hy, hz, 0.05, 0.05, 0.05), SKIN);
  }
  // neck + head
  if (opts.noUpper) return;
  const hdx = sx + Math.sin(lean) * 0.13, hdy = sy + 0.16;
  b.addGeo(G.sph, M(hdx, hdy, z, 0.11, 0.13, 0.105), SKIN);
  if (helmet) {
    b.addGeo(G.sph, M(hdx - 0.01, hdy + 0.03, z, 0.145, 0.145, 0.135), helmet, 0, headP);
    box(b, hdx + 0.06, hdy - 0.02, z - 0.1, hdx + 0.13, hdy + 0.06, z + 0.1, [0.1, 0.12, 0.14]);
  } else {
    b.addGeo(G.sph, M(hdx - 0.02, hdy + 0.05, z, 0.115, 0.09, 0.11), opts.hair || HAIR, 0, headP);
  }
}
// pillion rider (women often sit side-saddle)
function addPillion(b, x, y, z, sideSaddle, inst) {
  if (!sideSaddle) { addRider(b, x, y, z, { lean: 0.05, inst, handX: x + 0.3, handY: y + 0.3, handW: 0.25, footX: x + 0.25, footY: y - 0.38 }); return; }
  const P = inst ? 2 : 0;
  box(b, x - 0.15, y - 0.05, z, x + 0.15, y + 0.1, z + 0.38, [0.6, 0.15, 0.3], 0, P);     // legs to the left side
  box(b, x - 0.12, y - 0.48, z + 0.3, x + 0.12, y, z + 0.45, [0.6, 0.15, 0.3], 0, P);
  b.addGeo(G.box, M(x, y + 0.33, z, 0.24, 0.55, 0.38), [0.75, 0.25, 0.4], 0, P);
  b.addGeo(G.sph, M(x, y + 0.72, z, 0.11, 0.13, 0.105), SKIN);
  b.addGeo(G.sph, M(x - 0.03, y + 0.76, z, 0.12, 0.1, 0.11), HAIR, 0, inst ? 3 : 0);
}

// ---------------------------------------------------------------- auto-rickshaw (Bajaj RE style, Pune livery)
// returns { body, glass, wheels: [{x,y,z,r,front}], dims }
export function buildAuto(opts = {}) {
  const b = newB(!opts.solid), gl = newB(false);
  const sh = opts.sepShield ? newB(false) : gl;     // windshield: separate (transparent) for the player
  const R = 0.21, xr = -0.98, xf = 1.0;
  // chassis + floor
  box(b, -1.36, 0.27, -0.6, 0.95, 0.33, 0.6, BLACK);
  // rear body tub (black) with yellow band
  box(b, -1.36, 0.33, -0.66, -0.2, 0.72, 0.66, BLACK);
  box(b, -1.37, 0.56, -0.67, -0.19, 0.64, 0.67, AUTO_Y);
  // rear mudguard flares
  for (const s of [-1, 1]) box(b, xr - 0.32, 0.28, s * 0.66, xr + 0.32, 0.5, s * 0.6, BLACK);
  // tail panel: lights + plate
  box(b, -1.375, 0.42, -0.6, -1.37, 0.5, -0.46, TAIL, 0, 0.9);
  box(b, -1.375, 0.42, 0.46, -1.37, 0.5, 0.6, TAIL, 0, 0.9);
  box(b, -1.38, 0.34, -0.17, -1.37, 0.46, 0.17, [0.98, 0.82, 0.12]);
  // passenger bench + backrest
  box(b, -1.25, 0.72, -0.6, -0.62, 0.9, 0.6, [0.12, 0.1, 0.09]);
  box(b, -1.33, 0.9, -0.6, -1.2, 1.32, 0.6, [0.12, 0.1, 0.09]);
  // driver area floor sides & legshield
  box(b, -0.2, 0.33, -0.55, 0.62, 0.42, 0.55, BLACK);
  // driver seat
  box(b, 0.1, 0.62, -0.24, 0.55, 0.76, 0.24, [0.13, 0.11, 0.1]);
  box(b, 0.2, 0.33, -0.12, 0.45, 0.62, 0.12, [0.15, 0.15, 0.15]);
  // front cowl: rounded nose, black lower + yellow brow
  extrude(b, [[0.55, 0.3], [1.05, 0.3], [1.24, 0.42], [1.27, 0.62], [1.18, 0.9], [0.98, 1.0], [0.62, 1.0]], -0.5, 0.5, BLACK, 0, 0.07);
  extrude(b, [[0.8, 0.97], [0.93, 0.97], [0.93, 1.075], [0.8, 1.07]], -0.52, 0.52, BLACK, 0, 0.01);        // dash ledge (inside)
  extrude(b, [[0.93, 0.97], [1.02, 0.97], [1.06, 1.06], [0.93, 1.075]], -0.52, 0.52, AUTO_Y, 0, 0.02);     // yellow brow (outside)
  // headlamp + indicators + horn grille
  b.addGeo(G.cyl12, M(1.27, 0.7, 0, 0.09, 0.05, 0.09, 0, 0, Math.PI / 2), CHROME);
  b.addGeo(G.circle, M(1.30, 0.7, 0, 0.075, 0.075, 1, 0, Math.PI / 2), HEAD, 0, 1.0);
  for (const s of [-1, 1]) b.addGeo(G.sphLo, M(1.2, 0.86, s * 0.36, 0.04, 0.04, 0.04), AMBER, 0, 0.7);
  box(b, 1.22, 0.48, -0.12, 1.25, 0.56, 0.12, [0.2, 0.2, 0.2]);
  // windshield frame + glass + yellow visor
  box(b, 0.92, 1.0, -0.56, 0.95, 1.52, -0.52, BLACK); box(b, 0.92, 1.0, 0.52, 0.95, 1.52, 0.56, BLACK);
  box(b, 0.9, 1.5, -0.58, 1.02, 1.6, 0.58, AUTO_Y);
  sh.addGeo(G.box, M(0.935, 1.26, 0, 0.012, 0.48, 1.04, 0, 0, 0.08), opts.sepShield ? [0.75, 0.82, 0.86] : [0.1, 0.12, 0.14]);
  // handlebar
  b.addGeo(G.cyl8, M(0.72, 1.06, 0, 0.018, 0.78, 0.018, Math.PI / 2), CHROME);
  for (const s of [-1, 1]) b.addGeo(G.cyl8, M(0.72, 1.06, s * 0.36, 0.03, 0.12, 0.03, Math.PI / 2), BLACK);
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
  // canopy (black canvas hood): roof, rounded edges, rear wall, rear quarter panels, struts
  const roofY = 1.66;
  box(b, -1.38, roofY - 0.05, -0.62, 0.98, roofY + 0.04, 0.62, BLACK, 1);
  for (const s of [-1, 1]) b.addGeo(G.cyl12, M(-0.2, roofY - 0.06, s * 0.62, 0.09, 2.36, 0.09, 0, 0, Math.PI / 2), BLACK, 0, 1);
  b.addGeo(G.cyl12, M(0.97, roofY - 0.06, 0, 0.09, 1.24, 0.09, Math.PI / 2), BLACK, 0, 1);
  box(b, -1.4, 0.72, -0.66, -1.34, roofY, 0.66, BLACK, 1);
  for (const s of [-1, 1]) {
    box(b, -1.38, 0.95, s * 0.7, -0.98, roofY, s * 0.64, BLACK, 1);
    box(b, -1.37, 0.95, s * 0.705, -1.0, 1.0, s * 0.645, AUTO_Y);       // yellow trim at the canvas edge
    b.addGeo(G.cyl8, M(-0.32, 1.16, s * 0.63, 0.018, 0.95, 0.018), CHROME);
    b.addGeo(G.cyl8, M(0.6, 1.33, s * 0.6, 0.018, 0.62, 0.018), BLACK);
  }
  gl.addGeo(G.box, M(-1.405, 1.36, 0, 0.01, 0.2, 0.62), [0.1, 0.12, 0.14]);
  // rear window frame + rounded rear edge of the hood + grab rail
  box(b, -1.412, 1.25, -0.33, -1.405, 1.27, 0.33, CHROME); box(b, -1.412, 1.45, -0.33, -1.405, 1.47, 0.33, CHROME);
  b.addGeo(G.cyl12, M(-1.38, roofY - 0.06, 0, 0.09, 1.24, 0.09, Math.PI / 2), BLACK, 0, 1);
  b.addGeo(G.cyl8, M(-1.42, 0.82, 0, 0.02, 1.0, 0.02, Math.PI / 2), CHROME);
  box(b, -1.415, 0.98, -0.5, -1.405, 1.18, 0.5, [0.05, 0.05, 0.05]);
  // front fork + mudguard
  b.addGeo(G.cyl8, M(xf + 0.02, 0.48, 0, 0.03, 0.55, 0.03, 0, 0, 0.25), CHROME);
  guard(b, xf, R + 0.02, 0, R + 0.06, 0.16, BLACK);
  // driver (only when asked: player version draws its own)
  if (opts.driver) {
    addRider(b, 0.32, 0.8, 0, { lean: 0.08, shirt: opts.driverShirt || [0.95, 0.95, 0.92], pants: [0.25, 0.22, 0.2], handX: 0.72, handY: 1.07, handW: 0.33, footX: 0.66, footY: 0.42, inst: !!opts.inst });
  }
  const wheels = [{ x: xf, y: R, z: 0, r: R, w: 0.12, front: true }, { x: xr, y: R, z: -0.58, r: R, w: 0.13 }, { x: xr, y: R, z: 0.58, r: R, w: 0.13 }];
  if (opts.withWheels) for (const w of wheels) wheel(b, w.x, w.y, w.z, w.r, w.w);
  return { body: b.build(), glass: gl.build(), shield: opts.sepShield ? sh.build() : null, wheels, dims: { L: 2.7, W: 1.4, H: 1.75, wb: 2.0 } };
}

// ---------------------------------------------------------------- two-wheelers
export function buildScooter(opts = {}) {
  const b = newB(true), gl = newB(false);
  const R = 0.25;
  const body = [0.9, 0.9, 0.9];
  // front apron + floorboard + rear body
  extrude(b, [[0.42, 0.3], [0.62, 0.3], [0.72, 0.62], [0.7, 0.98], [0.56, 0.98], [0.5, 0.62]], -0.2, 0.2, body, 1, 0.05);
  box(b, -0.3, 0.26, -0.18, 0.5, 0.34, 0.18, BLACK);
  extrude(b, [[-0.72, 0.3], [-0.2, 0.3], [-0.12, 0.45], [-0.18, 0.68], [-0.78, 0.68], [-0.86, 0.5]], -0.21, 0.21, body, 1, 0.06);
  box(b, -0.72, 0.68, -0.15, -0.12, 0.76, 0.15, [0.08, 0.08, 0.08]);
  // handlebar + headlamp
  box(b, 0.6, 0.98, -0.32, 0.68, 1.04, 0.32, body, 1);
  b.addGeo(G.circle, M(0.72, 0.95, 0, 0.06, 0.06, 1, 0, Math.PI / 2), HEAD, 0, 1);
  box(b, -0.87, 0.52, -0.1, -0.84, 0.58, 0.1, TAIL, 0, 0.9);
  box(b, -0.88, 0.4, -0.08, -0.86, 0.48, 0.08, [0.98, 0.98, 0.95]);
  // mudguard
  guard(b, 0.66, R + 0.03, 0, R + 0.05, 0.1, body, 1);
  // rider + maybe pillion
  if (!opts.parked) {
    addRider(b, -0.38, 0.8, 0, { lean: 0.05, inst: true, handX: 0.62, handY: 1.0, handW: 0.3, footX: 0.12, footY: 0.36, helmet: opts.helmet ? [0.2, 0.2, 0.2] : null });
    if (opts.pillion) addPillion(b, -0.72, 0.82, 0, opts.sideSaddle, true);
  } else b.addGeo(G.cyl8, M(-0.2, 0.18, -0.12, 0.015, 0.36, 0.015, 0.35, 0, 0), CHROME);   // side stand
  wheel(b, 0.66, R, 0, R, 0.1); wheel(b, -0.62, R, 0, R, 0.1);
  return { body: b.build(), glass: gl.build(), dims: { L: 1.85, W: 0.72, H: 1.6, wb: 1.28 } };
}
export function buildBike(opts = {}) {
  const b = newB(true), gl = newB(false);
  const R = 0.3;
  const body = [0.6, 0.05, 0.05];
  // tank, seat, side covers
  extrude(b, [[-0.05, 0.78], [0.42, 0.82], [0.5, 0.95], [0.12, 1.02], [-0.1, 0.95]], -0.15, 0.15, body, 1, 0.05);
  box(b, -0.62, 0.86, -0.13, 0.0, 0.95, 0.13, [0.08, 0.08, 0.08]);
  box(b, -0.5, 0.55, -0.14, -0.05, 0.85, 0.14, body, 1);
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
  if (!opts.parked) {
    addRider(b, -0.32, 0.95, 0, { lean: 0.32, inst: true, handX: 0.6, handY: 1.08, handW: 0.34, footX: 0.05, footY: 0.42, helmet: opts.helmet ? [0.6, 0.6, 0.6] : null });
    if (opts.pillion) addPillion(b, -0.62, 0.97, 0, opts.sideSaddle, true);
  }
  wheel(b, 0.78, R, 0, R, 0.09); wheel(b, -0.6, R, 0, R, 0.11);
  return { body: b.build(), glass: gl.build(), dims: { L: 2.0, W: 0.75, H: 1.75, wb: 1.3 } };
}
export function buildCycle() {
  const b = newB(true), gl = newB(false);
  const R = 0.34;
  const c = [0.1, 0.1, 0.12];
  b.addGeo(G.cyl8, M(0.05, 0.62, 0, 0.022, 0.75, 0.022, 0, 0, Math.PI / 2 - 0.1), c, 0, 1);
  b.addGeo(G.cyl8, M(-0.2, 0.55, 0, 0.022, 0.6, 0.022, 0, 0, 0.6), c, 0, 1);
  b.addGeo(G.cyl8, M(0.35, 0.55, 0, 0.022, 0.6, 0.022, 0, 0, -0.35), c, 0, 1);
  box(b, -0.38, 0.86, -0.08, -0.15, 0.9, 0.08, [0.1, 0.08, 0.06]);
  box(b, 0.42, 0.98, -0.3, 0.46, 1.0, 0.3, CHROME);
  addRider(b, -0.28, 0.92, 0, { lean: 0.22, inst: true, handX: 0.44, handY: 1.0, handW: 0.28, footX: 0.05, footY: 0.32 });
  for (const x of [0.5, -0.5]) {
    b.addGeo(new THREE.TorusGeometry(R, 0.025, 3, 12), M(x, R, 0), TYRE);
  }
  return { body: b.build(), glass: gl.build(), dims: { L: 1.75, W: 0.6, H: 1.75, wb: 1.0 } };
}

// ---------------------------------------------------------------- cars
function carBody(b, gl, spec) {
  const { L, W, H, hood, roofF, roofR, beltY, sill, R, tail } = spec;
  const hl = L / 2, hw = W / 2;
  // lower body side profile
  const lower = [[-hl, sill], [hl - 0.05, sill], [hl, sill + 0.15], [hl, beltY - 0.05], [hl - hood * 0.15, beltY],
    [-hl + 0.1, beltY], [-hl, beltY - 0.12]];
  extrude(b, lower, -hw, hw, [1, 1, 1], 1, 0.08);
  // cabin (glass) + roof
  const cab = [[-hl + tail, beltY], [hl - hood, beltY], [roofF, H - 0.06], [roofR, H - 0.06]];
  extrude(gl, cab, -hw + 0.07, hw - 0.07, [0.12, 0.14, 0.16], 0, 0.04);
  extrude(b, [[roofR - 0.02, H - 0.08], [roofF + 0.02, H - 0.08], [roofF - 0.02, H], [roofR + 0.04, H]], -hw + 0.06, hw - 0.06, [1, 1, 1], 1, 0.03);
  // pillars (body colour) on both sides
  const pil = (x0, x1) => {
    for (const s of [-1, 1]) {
      const z0 = s * (hw - 0.03), z1 = s * (hw - 0.09);
      extrude(b, [[x0, beltY], [x0 + 0.08, beltY], [x1 + 0.08, H - 0.06], [x1, H - 0.06]], Math.min(z0, z1), Math.max(z0, z1), [1, 1, 1], 1, 0);
    }
  };
  pil(hl - hood - 0.04, roofF - 0.04);
  pil((hl - hood + (-hl + tail)) / 2 - 0.04, (roofF + roofR) / 2 - 0.04);
  pil(-hl + tail - 0.02, roofR);
  // lights, grille, bumpers, plates
  for (const s of [-1, 1]) {
    box(b, hl - 0.04, beltY - 0.2, s * (hw - 0.32), hl + 0.01, beltY - 0.08, s * (hw - 0.08), HEAD, 0, 1.0);
    box(b, -hl - 0.01, beltY - 0.22, s * (hw - 0.3), -hl + 0.04, beltY - 0.08, s * (hw - 0.06), TAIL, 0, 0.9);
  }
  box(b, hl - 0.02, sill + 0.2, -hw + 0.35, hl + 0.015, beltY - 0.25, hw - 0.35, [0.1, 0.1, 0.1]);
  box(b, hl - 0.05, sill - 0.02, -hw + 0.05, hl + 0.05, sill + 0.14, hw - 0.05, [0.15, 0.15, 0.15]);
  box(b, -hl - 0.05, sill - 0.02, -hw + 0.05, -hl + 0.05, sill + 0.14, hw - 0.05, [0.15, 0.15, 0.15]);
  box(b, -hl - 0.06, sill + 0.17, -0.25, -hl - 0.05, sill + 0.29, 0.25, spec.yellowPlate ? [0.98, 0.82, 0.12] : [0.95, 0.95, 0.92]);
  box(b, hl + 0.055, sill + 0.02, -0.25, hl + 0.06, sill + 0.13, 0.25, spec.yellowPlate ? [0.98, 0.82, 0.12] : [0.95, 0.95, 0.92]);
  // mirrors
  for (const s of [-1, 1]) box(b, hl - hood - 0.05, beltY + 0.05, s * hw, hl - hood + 0.08, beltY + 0.16, s * (hw + 0.12), [1, 1, 1], 1);
  // wheels + arches
  const xw = L / 2 - spec.overhang;
  for (const x of [xw, -xw]) for (const s of [-1, 1]) {
    wheel(b, x, R, s * (hw - 0.12), R, 0.2);
    guard(b, x, R + 0.02, s * (hw - 0.04), R + 0.07, 0.08, [0.05, 0.05, 0.05]);
  }
}
export function buildCar(kind) {
  const b = newB(true), gl = newB(false);
  let spec;
  if (kind === 'hatch') spec = { L: 3.65, W: 1.6, H: 1.66, hood: 0.75, roofF: 0.95, roofR: -1.5, beltY: 0.95, sill: 0.25, R: 0.29, tail: 0.15, overhang: 0.6 };
  else if (kind === 'suv') spec = { L: 4.5, W: 1.8, H: 1.88, hood: 1.05, roofF: 0.85, roofR: -2.05, beltY: 1.12, sill: 0.38, R: 0.36, tail: 0.12, overhang: 0.75 };
  else spec = { L: 4.0, W: 1.7, H: 1.5, hood: 1.0, roofF: 0.6, roofR: -1.05, beltY: 0.88, sill: 0.24, R: 0.3, tail: 0.6, overhang: 0.72 };
  if (kind === 'taxi') spec.yellowPlate = true;
  carBody(b, gl, spec);
  if (kind === 'taxi') {
    box(b, -0.15, spec.H, -0.25, 0.15, spec.H + 0.12, 0.25, [0.98, 0.85, 0.15], 0, 0.4);
  }
  if (kind === 'suv') {
    // roof rails + spare wheel
    for (const s of [-1, 1]) box(b, -1.9, spec.H, s * 0.7, 0.7, spec.H + 0.06, s * 0.65, [0.2, 0.2, 0.2]);
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
  for (const s of [-1, 1]) box(b, -hl, 0.65, s * hw, 0.68, 1.05, s * (hw - 0.05), [0.9, 0.55, 0.1], 0, 1);
  box(b, -hl, 0.65, -hw, -hl + 0.05, 1.05, hw, [0.9, 0.55, 0.1], 0, 1);
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
