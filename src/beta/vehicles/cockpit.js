// The cabin you sit in, made the way the real ones are. vehicles/cockpit.js gives every car the same plain room (a slab of
// a dash, boxes for seats, a ring for a wheel, one lit strip for the cluster); here each family gets its own inside on
// top of that, and the plain pieces it replaces are cut away.
//   Every car: seats with a cushion, bolsters, a sewn insert and piping, a back with its wings, a headrest on its two
//   posts, the runners and the recline lever, the belt's buckle; a real wheel with its airbag pad, thumb rests and
//   buttons; the column's shroud with the indicator and wiper stalks (and the key, with a keyring hanging off it); the
//   centre stack with its vents, the radio or the touchscreen, the hazard switch and the AC knobs; the console with the
//   gear lever in its boot, cupholders, the handbrake and an armrest; a glovebox, side vents, a trim strip across the
//   dash; a dial cluster with needles and the little screen between them; the pedals over the footwell, a footrest,
//   mats; the door cards' speakers, pockets, window switches and lock pins; sun visors, the roof lining, the grab
//   handles and the dome light, the belts down the pillars, a real rear bench. And the things people leave in their
//   cars here: a Ganesh on the dash, a mala on the mirror, a bottle in the door, a parking slip in the visor; a towel
//   over the cabbie's seat, the meter and the phone on its mount.
//   The E-Class-style (lux): one glass across the cluster and the screen, turbine vents, open-pore walnut, light round
//   the cabin in the drive mode's colour, quilted seats with neck pillows, seat switches on the doors, a rear armrest.
//   The 911-style (sports): five round dials under one cowl, the clock on top of the dash, the twist key left of the
//   wheel, the mode dial on the wheel, paddles, red-stitched sport seats, a shelf where the back seats fold.
//   The Huracán-style (super): carbon and suede everywhere, a screen that changes its whole face with the mode (Strada
//   green round dial, Sport amber, Corsa red bar and a huge gear), a flat-bottomed wheel with the mode toggle on it and
//   shift lights over the hub, column paddles, hexagonal vents, a bank of aircraft toggles with the start button under
//   its red flip cover, quilted buckets in carbon shells with the harness slots.
// The drive mode is in the cabin wherever the car has one: on every cluster, and on the wheel, in the light, on the
// console knob or on the 4x4 lever.
import * as THREE from 'three';
import { ColorBuilder, lin } from '@orig/world/geo.js';
import { buildCarCockpit as plainCockpit } from '@orig/vehicles/cockpit.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { carSpec, baseOf, doorOf, hasSun } from './models.js';
import { cabinGlass } from './vehmat.js';
import { showAll } from '../world/view.js';

const MATTE = -1, CARBON = -2, QUILT = -3, WOOD = -4, BRUSHED = -5, SUEDE = -6, PERF = -7, GRAIN = -8;
const DZ = 0.36, I4 = new THREE.Matrix4(), ONE = new THREE.Vector3(1, 1, 1), Q0 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0), ZZ = new THREE.Vector3(0, 0, 1);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mT = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const Qz = (a) => new THREE.Quaternion().setFromAxisAngle(ZZ, a);
const Qy = (a) => new THREE.Quaternion().setFromAxisAngle(UP, a);
// the same modes the car has (beta/vehicles/brakes.js)
const MODES = { super: ['Strada', 'Sport', 'Corsa'], sports: ['Normal', 'Sport', 'Sport+', 'Wet'], lux: ['Comfort', 'Eco', 'Sport', 'Sport+'], xuv: ['Zip', 'Zap', 'Zoom'], scorpio: ['Zip', 'Zap', 'Zoom'],
  fortuner: ['Normal', 'Eco', 'Power'], innova: ['Normal', 'Eco', 'Power'], nexon: ['City', 'Eco', 'Sport'], suv: ['Normal', 'Eco', 'Sport'], jeep: ['2H', '4H', '4L'], city: ['Normal', 'ECON'] };
const MC = { STRADA: '#35d07f', SPORT: '#ffb020', CORSA: '#ff3b30', NORMAL: '#e8edf2', 'SPORT+': '#ff3b30', WET: '#4fb3ff', COMFORT: '#7fc8ff', ECO: '#35d07f', ECON: '#35d07f',
  ZIP: '#35d07f', ZAP: '#4fb3ff', ZOOM: '#ff3b30', CITY: '#e8edf2', POWER: '#ff6a3d', '2H': '#e8edf2', '4H': '#ffb020', '4L': '#ff6a3d' };
const modeCol = (m) => MC[String(m || '').toUpperCase()] || '#e8edf2';
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0)/4294967296; };

class K {
  constructor() { this.b = new ColorBuilder(); this.b.paint = []; }
  add(g, m, c, glow = MATTE, paint = 0) { if (!g.attributes.normal) g.computeVertexNormals(); this.b.addGeo(g, m || I4, c, glow, paint); g.dispose(); return this; }
  box(x0, y0, z0, x1, y1, z1, c, glow, paint) {
    const g = new THREE.BoxGeometry(Math.max(1e-3, Math.abs(x1 - x0)), Math.max(1e-3, Math.abs(y1 - y0)), Math.max(1e-3, Math.abs(z1 - z0)));
    g.translate((x0 + x1)/2, (y0 + y1)/2, (z0 + z1)/2); return this.add(g, null, c, glow, paint);
  }
  obox(p, sx, sy, sz, q, c, glow, paint) { return this.add(new THREE.BoxGeometry(sx, sy, sz), new THREE.Matrix4().compose(p, q || Q0, ONE), c, glow, paint); }
  fbox(F, u, v, w, su, sv, sw, c, glow, paint) { return this.obox(F.at(u, v, w), su, sv, sw, F.q, c, glow, paint); }
  cyl(a, e, r0, r1, c, glow, paint, seg = 12) {
    const d = e.clone().sub(a), L = d.length(); if (L < 1e-5) return this;
    return this.add(new THREE.CylinderGeometry(r1, r0, L, seg), new THREE.Matrix4().compose(a.clone().add(e).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), ONE), c, glow, paint);
  }
  sph(p, r, c, glow, paint, sx = 1, sy = 1, sz = 1, seg = 10, q = Q0) { return this.add(new THREE.SphereGeometry(r, seg, Math.max(5, (seg*0.7) | 0)), new THREE.Matrix4().compose(p, q, v3(sx, sy, sz)), c, glow, paint); }
  ring(p, n, r, t, c, glow, paint, arc = Math.PI*2, rot = 0, rs = 8, ts = 36) {
    const g = new THREE.TorusGeometry(r, t, rs, ts, arc); g.rotateZ(rot);
    return this.add(g, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(ZZ, n.clone().normalize()), ONE), c, glow, paint);
  }
  disc(p, n, r, c, glow, paint, seg = 24) { return this.add(new THREE.CircleGeometry(r, seg), new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(ZZ, n.clone().normalize()), ONE), c, glow, paint); }
  ext(shape, depth, m, c, glow, paint, bevel = 0) {
    return this.add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 }), m, c, glow, paint);
  }
  tube(pts, r, c, glow, paint, closed = false, seg = 40, rs = 8) { return this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), seg, r, rs, closed), null, c, glow, paint); }
  mesh(mat) { return new THREE.Mesh(this.b.build(), mat); }
}
function rrect(w, h, r) {
  const s = new THREE.Shape(), x = -w/2, y = -h/2; r = Math.min(r, w/2 - 1e-4, h/2 - 1e-4);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function poly(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
const hexPts = (r, sx = 1) => [0, 1, 2, 3, 4, 5].map(i => [Math.cos(i*Math.PI/3)*r*sx, Math.sin(i*Math.PI/3)*r]);
// a flat face turned to the driver: its u to the car's right, v up (leaning t forward at the top), w out toward you
function frame(p, t = 0) {
  const X = v3(0, 0, 1), Y = v3(Math.sin(t), Math.cos(t), 0), Z = v3(-Math.cos(t), Math.sin(t), 0), m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p);
  return { m, q: new THREE.Quaternion().setFromRotationMatrix(m), at: (u, v, w = 0) => p.clone().addScaledVector(X, u).addScaledVector(Y, v).addScaledVector(Z, w), X, Y, Z };
}
const fm = (F, u, v, w) => F.m.clone().multiply(mT(u, v, w));
function screen(w, h, px, M) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.max(8, Math.round(px*h/w));
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.applyMatrix4(M);
  return { m, cv, ctx: cv.getContext('2d'), tex, W: cv.width, H: cv.height };
}
const lamp = (col) => new THREE.MeshBasicMaterial({ color: col, toneMapped: false });

function palette(kind, k) {
  const P = { top: [.09, .09, .095], topP: 0, topG: MATTE, face: [.16, .155, .15], faceP: 0, arm: [.2, .19, .18], trim: [.15, .145, .14], carpet: [.075, .072, .07],
    seat: [.17, .165, .16], seatIn: [.24, .23, .22], seatP: SUEDE, stitch: [.3, .29, .28], roof: [.6, .58, .54], decor: [.55, .56, .58], decorP: BRUSHED, decorG: 0,
    metal: [.62, .63, .65], piano: [.022, .022, .026], belt: [.1, .1, .11], wheel: [.07, .07, .075], accent: [.55, .56, .58], plastic: [.08, .08, .085] };
  if (/^(alto|wagonr|hatch)$/.test(kind)) Object.assign(P, { face: [.5, .45, .38], arm: [.48, .44, .38], trim: [.46, .42, .36], seat: [.3, .28, .26], seatIn: [.4, .37, .33], roof: [.7, .67, .61], decor: [.5, .51, .53] });
  else if (/^(city|sedan)$/.test(kind)) Object.assign(P, { face: [.58, .53, .45], arm: [.6, .54, .45], trim: [.53, .48, .41], seat: [.58, .52, .43], seatIn: [.64, .58, .48], seatP: PERF, roof: [.74, .7, .64], decor: [.6, .61, .63] });
  else if (kind === 'taxi') Object.assign(P, { face: [.22, .21, .2], arm: [.25, .24, .22], trim: [.24, .23, .21], seat: [.8, .77, .7], seatIn: [.72, .68, .6], seatP: QUILT, stitch: [.55, .5, .42], roof: [.6, .58, .53], decor: [.42, .43, .45] });
  else if (/^(innova|ertiga)$/.test(kind)) Object.assign(P, { face: [.36, .3, .24], arm: [.42, .35, .28], trim: [.38, .32, .26], seat: [.46, .39, .31], seatIn: [.52, .45, .36], seatP: PERF, roof: [.7, .66, .6], decor: [.3, .19, .11], decorP: WOOD });
  else if (/^(bolero|jeep)$/.test(kind)) Object.assign(P, { face: [.13, .13, .135], arm: [.12, .12, .12], trim: [.14, .14, .145], seat: [.1, .1, .105], seatIn: [.14, .14, .145], stitch: kind === 'jeep' ? [.62, .12, .1] : [.3, .3, .3], roof: [.22, .22, .23], decor: kind === 'jeep' ? [.5, .1, .08] : [.42, .43, .45], decorP: 0, decorG: MATTE });
  else if (k === 'suv') Object.assign(P, { face: [.12, .12, .125], arm: [.14, .14, .14], trim: [.13, .13, .135], seat: [.11, .11, .115], seatIn: kind === 'xuv' ? [.5, .48, .45] : [.15, .15, .155], seatP: PERF, stitch: [.5, .5, .5], roof: [.5, .49, .47], decor: [.6, .61, .63] });
  else if (k === 'lux') Object.assign(P, { top: [.07, .055, .045], face: [.55, .42, .3], arm: [.6, .46, .33], trim: [.5, .38, .27], carpet: [.09, .075, .06], seat: [.6, .47, .33], seatIn: [.64, .5, .36], seatP: QUILT, stitch: [.8, .72, .6], roof: [.78, .74, .68], decor: [.26, .15, .08], decorP: WOOD, metal: [.75, .76, .78], wheel: [.08, .065, .055] });
  else if (k === 'sports') Object.assign(P, { top: [.05, .05, .055], face: [.07, .07, .075], arm: [.08, .08, .085], trim: [.07, .07, .075], seat: [.06, .06, .065], seatIn: [.36, .06, .06], seatP: PERF, stitch: [.66, .09, .08], roof: [.09, .09, .095], decor: [.07, .07, .075], decorP: CARBON, accent: [.66, .09, .08] });
  else if (k === 'super') Object.assign(P, { top: [.07, .07, .075], topP: CARBON, topG: 0, face: [.05, .05, .055], faceP: SUEDE, arm: [.05, .05, .055], trim: [.06, .06, .065], seat: [.045, .045, .05], seatIn: [.06, .06, .065], seatP: QUILT, stitch: [.95, .7, .06], roof: [.06, .06, .065], decor: [.07, .07, .075], decorP: CARBON, accent: [.95, .7, .06] });
  return P;
}

// a seat: o = { x, z, fl, kS, P, st: 0 plain, 1 comfort, 2 sport, 3 bucket, towel }
function seat(B, o) {
  const { x, z, fl, kS, P, st } = o, sd = Math.sign(z) || 1, a = [0.2, 0.19, 0.23, 0.26][st], ca = Math.cos(a), sa = Math.sin(a);
  const hx = x - 0.27, hy = fl + 0.36, q = Qz(a), at = (s, t, zz) => v3(hx - sa*s + ca*t, hy + ca*s + sa*t, z + zz);
  const sc = P.seat, ins = P.seatIn, bol = [0.02, 0.025, 0.05, 0.08][st], L = (st === 3 ? 0.6 : 0.62)*kS, W = st === 1 ? 0.25 : 0.24;
  // the plinth, the runners on the floor, the side trim with its recline lever
  B.box(x - 0.24, fl, z - 0.19, x + 0.18, fl + 0.2, z + 0.19, st === 3 ? [.07, .07, .075] : P.plastic, st === 3 ? 0 : MATTE, st === 3 ? CARBON : 0);
  for (const r of [-0.16, 0.16]) B.box(x - 0.36, fl + 0.004, z + r - 0.013, x + 0.3, fl + 0.028, z + r + 0.013, [.3, .3, .32], 0, BRUSHED);
  B.box(x - 0.3, fl + 0.17, z + sd*(W - 0.01), x + 0.12, fl + 0.3, z + sd*(W + 0.008), P.plastic);
  B.box(x - 0.2, fl + 0.235, z + sd*(W + 0.008), x - 0.07, fl + 0.255, z + sd*(W + 0.024), [.12, .12, .13]);
  // the cushion: its base, the sewn middle, the bolsters, the rolled front, the piping
  B.box(x - 0.28, fl + 0.2, z - W, x + 0.22, fl + 0.33, z + W, sc);
  B.box(x - 0.27, fl + 0.33, z - 0.155, x + 0.2, fl + 0.358, z + 0.155, ins, MATTE, P.seatP);
  B.cyl(v3(x + 0.215, fl + 0.335, z - W + 0.01), v3(x + 0.215, fl + 0.335, z + W - 0.01), 0.032, 0.032, sc, MATTE, 0, 10);
  for (const s of [-1, 1]) {
    B.box(x - 0.27, fl + 0.33, z + s*0.155, x + 0.2, fl + 0.36 + bol, z + s*W, sc);
    B.box(x - 0.27, fl + 0.358, z + s*0.155 - 0.003, x + 0.2, fl + 0.362, z + s*0.155 + 0.003, P.stitch);
  }
  B.box(x + 0.198, fl + 0.33, z - 0.155, x + 0.204, fl + 0.362, z + 0.155, P.stitch);
  // the back, its sewn middle and its wings
  B.obox(at(L/2, -0.05, 0), 0.1, L, 2*W - 0.04, q, sc);
  B.obox(at(L*0.47, 0.004, 0), 0.012, L*0.78, 0.28, q, ins, MATTE, P.seatP);
  for (const s of [-1, 1]) {
    B.obox(at(L*0.45, 0.012 + bol*0.5, s*(W - 0.05)), 0.1 + bol, L*0.78, 0.075, q, sc);
    B.obox(at(L*0.47, 0.011, s*0.142), 0.004, L*0.78, 0.005, q, P.stitch);
  }
  if (st >= 1) for (const f of [0.3, 0.55, 0.8]) B.obox(at(L*f*0.95, 0.0105, 0), 0.003, 0.004, 0.27, q, P.stitch);
  // the map pocket on the back, for whoever sits behind
  if (st <= 1) B.obox(at(L*0.35, -0.104, 0), 0.008, L*0.4, 0.34, q, P.plastic);
  if (st === 3) {
    // a bucket's back runs on up into its headrest, with the slots for a harness; the shell behind is carbon
    const hh = 0.22*kS;
    B.obox(at(L + hh*0.5, -0.04, 0), 0.1, hh + 0.04, 0.27, q, sc);
    B.obox(at(L + hh*0.5, 0.012, 0), 0.008, hh*0.7, 0.18, q, ins, MATTE, P.seatP);
    for (const s of [-1, 1]) B.obox(at(L - 0.015, 0.012, s*0.075), 0.012, 0.055, 0.035, q, [.01, .01, .012]);
    B.obox(at((L + hh)/2, -0.106, 0), 0.014, L + hh + 0.02, 2*W - 0.02, q, [.07, .07, .075], 0, CARBON);
    for (const s of [-1, 1]) B.obox(at(L*0.5, -0.03, s*(W - 0.005)), 0.16, L*0.9, 0.012, q, [.07, .07, .075], 0, CARBON);
  } else if (st === 2) {
    const hh = 0.2*kS;
    B.obox(at(L + hh*0.5, -0.035, 0), 0.09, hh + 0.03, 0.27, q, sc);
    B.obox(at(L + hh*0.5, 0.012, 0), 0.006, hh*0.6, 0.17, q, ins, MATTE, P.seatP);
    B.obox(at(L*0.5, -0.104, 0), 0.008, L*0.95, 2*W - 0.06, q, [.07, .07, .075], 0, CARBON);
  } else {
    const hh = Math.max(0.12, 0.17*kS), hc = L + 0.07*kS + hh*0.5;
    for (const s of [-1, 1]) B.cyl(at(L - 0.03, -0.045, s*0.075), at(hc - hh*0.3, -0.045, s*0.075), 0.006, 0.006, P.metal, 0, BRUSHED, 8);
    B.obox(at(hc, -0.04, 0), 0.09 + (st === 1 ? 0.03 : 0), hh, 0.25, q, sc);
    B.obox(at(hc, 0.006 + (st === 1 ? 0.015 : 0), 0), 0.006, hh*0.65, 0.18, q, ins, MATTE, P.seatP);
    if (st === 1) B.sph(at(hc - hh*0.55, 0.05, 0), 0.05, [.86, .82, .75], MATTE, SUEDE, 2.2, 0.8, 0.9, 12, q);      // the neck pillow
  }
  // the belt's buckle on the inside, its red release
  B.box(x - 0.31, fl + 0.28, z - sd*(W + 0.03), x - 0.275, fl + 0.4, z - sd*(W + 0.015), [.1, .1, .11]);
  B.box(x - 0.315, fl + 0.4, z - sd*(W + 0.035), x - 0.268, fl + 0.445, z - sd*(W + 0.01), [.13, .13, .14]);
  B.box(x - 0.303, fl + 0.44, z - sd*(W + 0.03), x - 0.28, fl + 0.447, z - sd*(W + 0.015), [.72, .08, .06]);
  if (o.beads) {
    // a wooden-bead seat cover, the kind sold at every signal
    const Wd = (i, j) => { const h = hash(i + ':' + j); return [.5 + h*.15, .33 + h*.1, .16 + h*.06]; };
    for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) B.sph(v3(x - 0.24 + i*0.062, fl + 0.372, z - 0.15 + j*0.05), 0.0135, Wd(i, j), 0, 0, 1, 0.8, 1, 5);
    for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) B.sph(at(0.05 + i*L*0.09, 0.018, -0.15 + j*0.05), 0.0135, Wd(i + 20, j), 0, 0, 0.8, 1, 1, 5);
    for (const s2 of [-1, 1]) B.cyl(at(0.04, 0.015, s2*0.17), at(L*0.85, 0.015, s2*0.17), 0.003, 0.003, [.2, .12, .06], MATTE, 0, 4);
  }
  if (o.towel) {
    // a white towel over the top of the back, the way every cabbie has one
    const T = [.9, .89, .86];
    B.obox(at(L*0.82, 0.012, 0), 0.01, L*0.38, 0.42, q, T, MATTE, SUEDE);
    B.obox(at(L + 0.004, -0.05, 0), 0.12, 0.01, 0.42, q, T, MATTE, SUEDE);
    B.obox(at(L*0.86, -0.108, 0), 0.01, L*0.3, 0.42, q, T, MATTE, SUEDE);
    B.obox(at(L*0.64, 0.016, 0), 0.004, 0.012, 0.42, q, [.6, .2, .18]);
  }
}

export function buildCarCockpit(kind, mats) {
  const C = plainCockpit(kind, mats);
  try { dress(C, kind, mats); } catch (e) { console.warn('cockpit', e); }
  return C;
}

function dress(C, kind, mats) {
  const k = baseOf(kind), S = carSpec(kind), hl = S.L/2, hw = S.W/2, xf0 = hl - S.hood, belt = S.beltY, fl = S.sill + 0.06, H = S.H;
  const tier = k === 'super' ? 3 : k === 'sports' ? 2 : k === 'lux' ? 1 : 0, low = tier >= 2, rh = hash(kind);
  const kS = Math.min(1, (H - (low ? 0.24 : 0.15) - fl)/1.2), xs = xf0 - 1.35, xF = xf0 - 0.62, yC = fl + 0.27;
  const D = doorOf(kind), P = palette(kind, k), modes = MODES[kind] || MODES[k] || null;
  if (tier === 0) { P.topP = GRAIN; P.faceP = GRAIN; }
  const AT = tier >= 1 || kind === 'xuv' || kind === 'fortuner', modern = tier >= 1 || /^(xuv|nexon|city|fortuner|scorpio|innova|ertiga|suv|sedan)$/.test(kind);
  const G = C.group, kids = G.children.slice(), trims = G.userData.trim || {}, tl = Object.values(trims);
  const solids = kids.filter(o => o.isMesh && o.material === mats.solid && !tl.includes(o));
  const dash = solids[0], hood = solids[1], cab = solids[solids.length - 1];
  const spin = C.spin, pivot = spin.parent;
  const flats = kids.filter(o => o.isMesh && o.material && o.material.isMeshBasicMaterial);
  const B = new K(), W = new K(), extra = [], onWheel = [];
  const xb = -hl + 0.55, xd = xf0 - 0.55, d0 = Math.max(xb, D.x0 + 0.015), d1 = Math.min(xd, D.x1 - 0.02);
  const four = !low && k !== 'jeep' && S.L > 3.8, rear = S.L > 3.8 && !low;

  // ------------------------------------------------------------ the wheel's own frame, and the column's
  const wc = v3(xf0 - 0.8, belt - 0.03, DZ), ax = v3(-0.91, 0.41, 0).normalize(), Yc = v3(ax.y, -ax.x, 0).normalize();
  const colM = new THREE.Matrix4().makeBasis(ZZ.clone(), Yc, ax).setPosition(wc), qCol = new THREE.Quaternion().setFromRotationMatrix(colM);
  const CF = { m: colM, q: qCol, at: (u, v, w = 0) => wc.clone().addScaledVector(ZZ, u).addScaledVector(Yc, v).addScaledVector(ax, w) };
  const R = 0.185;

  // ------------------------------------------------------------ the footwell: floor, toe board, firewall; the pedals
  B.box(xf0 - 0.56, fl - 0.04, -(hw - 0.12), xf0 - 0.14, fl, hw - 0.12, P.carpet);
  B.obox(v3(xf0 - 0.08, fl + 0.11, 0), 0.02, 0.26, 2*hw - 0.26, Qz(-0.5), P.carpet);
  B.box(xf0 - 0.04, fl + 0.2, -(hw - 0.12), xf0 - 0.01, belt - 0.22, hw - 0.12, [.06, .06, .062]);
  B.box(xF, belt - 0.37, -(hw - 0.13), xF + 0.3, belt - 0.31, -0.16, P.face);                         // under the passenger's side
  const pedM = tier >= 2 ? [.72, .73, .75] : [.13, .13, .14], pedP = tier >= 2 ? BRUSHED : 0, pedG = tier >= 2 ? 0 : MATTE;
  // the pedals, each on its own hinge, going down as you press them
  const pedals = [];
  const pedal = (z, w, organ, what) => {
    const piv = organ ? v3(xf0 - 0.42, fl + 0.02, z) : v3(xf0 - 0.27, belt - 0.3, z), Kp = new K(), rel = (p) => p.clone().sub(piv);
    const pad = rel(v3(xf0 - 0.49, fl + 0.15, z));
    if (organ) Kp.obox(rel(v3(xf0 - 0.46, fl + 0.11, z)), 0.016, 0.2, w, Qz(Math.PI - 1.15), pedM, pedG, pedP);
    else { Kp.cyl(v3(0, 0, 0), pad, 0.008, 0.008, [.15, .15, .16], 0, 0, 8); Kp.obox(pad, 0.014, 0.075, w, Qz(Math.PI - 0.95), pedM, pedG, pedP); }
    if (tier >= 2) for (const dy of [-0.022, 0, 0.022]) Kp.obox(organ ? rel(v3(xf0 - 0.468 - dy*0.4, fl + 0.11 + dy*2, z)) : pad.clone().add(v3(-0.009 + dy*0.6, dy*0.75, 0)), 0.006, 0.008, w*0.8, Qz(Math.PI - (organ ? 1.15 : 0.95)), [.05, .05, .055]);
    else for (const dy of [-0.02, 0, 0.02]) if (!organ) Kp.obox(pad.clone().add(v3(-0.008 + dy*0.6, dy*0.75, 0)), 0.004, 0.006, w*0.85, Qz(Math.PI - 0.95), [.06, .06, .065]);
    const m = Kp.mesh(mats.solid); m.position.copy(piv); extra.push(m); pedals.push({ m, organ, what });
  };
  pedal(DZ + 0.115, 0.06, tier >= 1, 'thr');
  pedal(DZ - (AT ? 0.04 : 0.03), AT ? 0.12 : 0.075, false, 'brk');
  if (!AT) pedal(DZ - 0.17, 0.07, false, 'clu');
  B.obox(v3(xf0 - 0.47, fl + 0.12, DZ - (AT ? 0.21 : 0.3)), 0.014, 0.2, 0.075, Qz(Math.PI - 1.1), tier >= 2 ? pedM : [.09, .09, .095], pedG, pedP);   // the footrest
  for (const s of [-1, 1]) {                     // the mats, with a heel pad under the pedals
    B.box(xs + 0.05, fl + 0.001, s*DZ - 0.22, xf0 - 0.44, fl + 0.011, s*DZ + 0.22, tier === 1 ? [.12, .1, .08] : [.055, .053, .05], MATTE, SUEDE);
    if (s > 0) B.box(xf0 - 0.62, fl + 0.011, DZ - 0.16, xf0 - 0.46, fl + 0.016, DZ + 0.18, [.035, .035, .037]);
  }

  // ------------------------------------------------------------ the column: shroud, stalks, key
  B.ext(rrect(0.11, 0.1, 0.035), 0.2, colM.clone().multiply(mT(0, -0.012, -0.28)), [.06, .06, .065], MATTE, 0, 0.004);
  let stalk = null;
  if (tier < 3) for (const s of [-1, 1]) {
    // (built round where it comes out of the shroud, so the indicator's can flick up and down)
    const Ks = new K(), r0 = v3(s*0.055, 0.012, -0.11), L0 = (u, v, w) => v3(u, v, w).sub(r0);
    Ks.cyl(L0(s*0.055, 0.012, -0.11), L0(s*0.16, 0.024, -0.115), 0.008, 0.009, [.07, .07, .075], MATTE, 0, 8);
    Ks.cyl(L0(s*0.15, 0.023, -0.115), L0(s*0.19, 0.027, -0.116), 0.011, 0.011, [.08, .08, .085], MATTE, 0, 10);
    Ks.cyl(L0(s*0.168, 0.025, -0.115), L0(s*0.172, 0.0255, -0.115), 0.0115, 0.0115, tier === 1 ? P.metal : [.75, .75, .73], tier === 1 ? 0 : MATTE, tier === 1 ? BRUSHED : 0, 10);
    for (let i = 0; i < 3; i++) Ks.box(s*(0.177 + i*0.004) - 0.0006 - r0.x, 0.035 - r0.y, -0.116 - r0.z - 0.004, s*(0.177 + i*0.004) + 0.0006 - r0.x, 0.0365 - r0.y, -0.116 - r0.z + 0.004, [.85, .85, .85], 0.3);
    const m = Ks.mesh(mats.solid); m.position.copy(CF.at(r0.x, r0.y, r0.z)); m.quaternion.copy(qCol); extra.push(m);
    if (s > 0) stalk = m;
  }
  if (!modern || k === 'jeep') {
    // the key in the barrel on the shroud, its ring and what hangs off it
    const kp = CF.at(0.058, -0.01, -0.22);
    B.disc(kp, ZZ, 0.012, [.6, .6, .62], 0, BRUSHED);
    B.box(kp.x - 0.003, kp.y - 0.006, kp.z, kp.x + 0.003, kp.y + 0.006, kp.z + 0.022, [.68, .68, .7], 0, BRUSHED);
    B.box(kp.x - 0.007, kp.y - 0.017, kp.z + 0.02, kp.x + 0.007, kp.y + 0.017, kp.z + 0.042, [.05, .05, .055]);
    B.ring(v3(kp.x, kp.y - 0.03, kp.z + 0.045), v3(1, 0, 0), 0.011, 0.0015, [.7, .7, .72], 0, BRUSHED, Math.PI*2, 0, 6, 16);
    B.box(kp.x - 0.002, kp.y - 0.085, kp.z + 0.035, kp.x + 0.002, kp.y - 0.042, kp.z + 0.06, rh > 0.5 ? [.78, .6, .24] : [.35, .18, .1], rh > 0.5 ? 0 : MATTE, rh > 0.5 ? BRUSHED : 0);
  }

  // ------------------------------------------------------------ the centre stack and the console
  const wS = tier === 1 ? 0.17 : tier === 3 ? 0.15 : 0.15, yM = Math.max(yC + 0.07, belt - 0.27), Ax = xF + 0.004, Ay = belt - 0.05, Bx = xF - 0.012, Cx = xF - 0.1;
  const stack = tier === 1 || tier === 2 ? P.top : tier === 3 ? [.07, .07, .075] : (P.face[0] > 0.3 ? [.1, .1, .105] : P.face);
  B.ext(poly([[xf0 - 0.42, fl], [xf0 - 0.42, belt - 0.03], [Ax, Ay], [Bx, yM], [Cx, yC], [Cx, fl]]), 2*wS, mT(0, 0, -wS), stack, tier === 3 ? 0 : MATTE, tier === 3 ? CARBON : 0, 0.006);
  const tU = Math.atan2(Ax - Bx, Ay - yM), tL = Math.atan2(Bx - Cx, yM - yC);
  const FU = (y, z = 0) => frame(v3(Bx + (Ax - Bx)*(y - yM)/(Ay - yM) - 0.007, y, z), tU);       // on the upright part of the stack, at height y
  const FL = (f, z = 0) => frame(v3(Cx + (Bx - Cx)*f - 0.007 - 0.004, yC + (yM - yC)*f, z), tL);  // on the slope down to the console
  const xCb = xs - (tier === 0 && !/^(alto|wagonr|hatch|taxi|jeep|bolero)$/.test(kind) || tier >= 1 ? 0.45 : 0.08), wC = tier >= 1 ? 0.12 : 0.095;
  B.box(xCb, fl, -wC, Cx + 0.01, yC, wC, tier === 3 ? [.07, .07, .075] : P.trim, tier === 3 ? 0 : MATTE, tier === 3 ? CARBON : 0);
  B.box(xCb + 0.01, yC, -wC + 0.008, Cx, yC + 0.006, wC - 0.008, tier === 1 ? P.decor : tier >= 2 ? P.piano : [.07, .07, .075], tier === 1 ? 0 : tier >= 2 ? 0 : MATTE, tier === 1 ? WOOD : 0);
  if (xCb < xs - 0.3) {
    // the armrest between the seats, padded, with a seam round its top
    B.box(xs - 0.45, yC, -wC, xs - 0.1, fl + 0.48, wC, P.arm, MATTE, tier === 3 ? SUEDE : 0);
    B.box(xs - 0.45, fl + 0.48, -wC + 0.01, xs - 0.1, fl + 0.5, wC - 0.01, P.arm);
    for (const s of [-1, 1]) B.box(xs - 0.45, fl + 0.478, s*(wC - 0.012) - 0.002, xs - 0.1, fl + 0.482, s*(wC - 0.012) + 0.002, P.stitch);
  }
  if (tier <= 1) {
    // cupholders, sunk in the console
    const xc = tier === 1 ? xf0 - 1.0 : xf0 - 1.13;
    for (const s of [-1, 1]) { B.cyl(v3(xc, yC - 0.05, s*0.045), v3(xc, yC + 0.0065, s*0.045), 0.036, 0.036, [.02, .02, .022], MATTE, 0, 16); B.ring(v3(xc, yC + 0.007, s*0.045), UP, 0.037, 0.003, tier === 1 ? P.metal : [.12, .12, .13], tier === 1 ? 0 : MATTE, tier === 1 ? BRUSHED : 0, Math.PI*2, 0, 6, 20); }
  }
  // a car's every mode-lit part, set by C.mode
  const lit = { names: modes || [], set: [] };

  // ------------------------------------------------------------ tier 0: the everyday car
  if (tier === 0) {
    // vents on the stack: frame, the dark inside, slats, a tab; the hazard switch between them
    const vent = (F, w, h) => {
      B.ext(rrect(w + 0.016, h + 0.016, 0.01), 0.008, fm(F, 0, 0, 0), P.decor, P.decorG, P.decorP, 0.002);
      B.fbox(F, 0, 0, 0.0095, w, h, 0.002, [.02, .02, .022]);
      for (let i = 0; i < 4; i++) B.fbox(F, 0, -h/2 + h*(i + 0.5)/4, 0.012, w - 0.004, 0.004, 0.006, [.07, .07, .075]);
      B.fbox(F, w*0.1, 0, 0.016, 0.012, 0.009, 0.006, P.decor, P.decorG, P.decorP);
    };
    const yv = belt - 0.09;
    for (const s of [-1, 1]) vent(FU(yv, s*0.075), 0.1, 0.048);
    for (const s of [-1, 1]) vent(frame(v3(xF - 0.003, belt - 0.1, s*(hw - 0.21)), 0), 0.085, 0.05);
    { const F = FU(yv, 0); B.fbox(F, 0, 0, 0.008, 0.024, 0.024, 0.008, [.05, .05, .055]); B.fbox(F, 0, 0, 0.0125, 0.012, 0.011, 0.002, [.75, .1, .08]); }
    // the screen or the radio, the AC below on the slope
    const top = yv - 0.034, bot = yM + 0.006, room = top - bot;
    const FS = FU((top + bot)/2, 0);
    let scr = null;
    if (kind === 'nexon') {
      // a tablet standing on the dash, the AC's own panel where a radio would be
      const F = frame(v3(xF + 0.09, belt + 0.075, -0.02), 0.12);
      B.fbox(F, 0, 0, -0.006, 0.19, 0.115, 0.012, P.piano, 0);
      B.fbox(F, 0, -0.07, -0.02, 0.04, 0.04, 0.03, P.piano, 0);
      scr = screen(0.175, 0.1, 360, fm(F, 0, 0, 0.0005));
      B.fbox(FS, 0, 0, 0.004, 0.2, Math.max(0.02, room - 0.01), 0.008, P.piano, 0);
      for (let i = 0; i < 5; i++) B.fbox(FS, -0.07 + i*0.035, 0, 0.009, 0.022, 0.012, 0.003, [.1, .1, .11]);
    } else if (modern && room > 0.065) {
      B.fbox(FS, 0, 0, 0.004, 0.25, room, 0.008, P.piano, 0);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) B.fbox(FS, s*0.112, room*(0.3 - i*0.3), 0.009, 0.014, Math.min(0.016, room*0.2), 0.003, [.1, .1, .11]);
      scr = screen(0.19, Math.min(0.105, room - 0.01), 360, fm(FS, 0, 0, 0.0085));
    } else {
      // a single-DIN radio: the face, a small lit display, the two knobs and a row of buttons
      const h = Math.max(0.02, Math.min(0.052, room - 0.006));
      B.fbox(FS, 0, 0, 0.004, 0.182, h, 0.008, [.04, .04, .045]);
      for (const s of [-1, 1]) { B.cyl(FS.at(s*0.072, 0, 0.008), FS.at(s*0.072, 0, 0.024), 0.012, 0.011, [.12, .12, .13], MATTE, 0, 14); B.ring(FS.at(s*0.072, 0, 0.0245), FS.Z, 0.0085, 0.0012, [.6, .6, .62], 0, BRUSHED, Math.PI*2, 0, 4, 16); }
      for (let i = 0; i < 6; i++) B.fbox(FS, -0.042 + i*0.017, -h*0.32, 0.01, 0.013, 0.008, 0.004, [.18, .18, .19]);
      scr = screen(0.07, 0.022, 140, fm(FS, 0, h*0.12, 0.0085));
    }
    extra.push(scr.m);
    // the AC: three knobs (fan, the temperature's blue to red, where it blows), AC and recirculation buttons
    for (const [i, z] of [[0, -0.075], [1, 0], [2, 0.075]]) {
      const F = FL(0.55, z);
      B.cyl(F.at(0, 0, 0), F.at(0, 0, 0.022), 0.024, 0.022, [.07, .07, .075], MATTE, 0, 18);
      B.ring(F.at(0, 0, 0.0225), F.Z, 0.019, 0.0016, P.decor, P.decorG, P.decorP, Math.PI*2, 0, 4, 20);
      B.fbox(F, 0, 0.012, 0.023, 0.003, 0.012, 0.002, [.9, .9, .9]);
      if (i === 1) { B.ring(F.at(0, 0, 0.002), F.Z, 0.032, 0.002, [.15, .35, .85], MATTE, 0, 1.5, 0.9, 4, 12); B.ring(F.at(0, 0, 0.002), F.Z, 0.032, 0.002, [.85, .15, .1], MATTE, 0, 1.5, 0.7 + 1.5, 4, 12); }
    }
    for (const s of [-1, 1]) { const F = FL(0.2, s*0.038); B.fbox(F, 0, 0, 0.004, 0.03, 0.016, 0.008, [.09, .09, .095]); B.fbox(F, 0, 0.004, 0.0085, 0.006, 0.003, 0.001, [.3, .9, .4], 0.6); }
    // a trim strip across the dash, the glovebox, the knee panel
    B.box(xF - 0.006, belt - 0.15, -(hw - 0.15), xF, belt - 0.13, -wS - 0.005, P.decor, P.decorG, P.decorP);
    B.box(xF - 0.004, belt - 0.31, -(hw - 0.24), xF + 0.002, belt - 0.16, -wS - 0.03, P.face);
    for (const [y0, y1] of [[belt - 0.312, belt - 0.307], [belt - 0.163, belt - 0.158]]) B.box(xF - 0.005, y0, -(hw - 0.24), xF - 0.003, y1, -wS - 0.03, [.04, .04, .04]);
    B.box(xF - 0.012, belt - 0.19, -wS - 0.1, xF - 0.004, belt - 0.175, -wS - 0.04, [.08, .08, .085]);
    B.box(xF - 0.04, Math.max(fl + 0.3, belt - 0.44), DZ - 0.22, xF + 0.02, belt - 0.2, DZ + 0.24, P.face);
    B.box(xF - 0.042, belt - 0.33, DZ + 0.06, xF - 0.04, belt - 0.24, DZ + 0.2, [.05, .05, .05]);   // the fuse box lid's seam
    B.box(xF - 0.045, belt - 0.42, DZ + 0.2, xF - 0.02, belt - 0.405, DZ + 0.235, [.1, .1, .11]);  // the bonnet release
    // right of the wheel, by the door: the mirror joystick and the headlamp levelling wheel
    { const F = frame(v3(xF - 0.003, belt - 0.24, DZ + 0.25), 0); B.fbox(F, 0, 0, 0.006, 0.05, 0.04, 0.008, [.05, .05, .055]); B.cyl(F.at(-0.01, 0, 0.008), F.at(-0.01, 0, 0.02), 0.008, 0.007, [.1, .1, .11], MATTE, 0, 10); B.cyl(F.at(0.013, -0.012, 0.004), F.at(0.013, 0.012, 0.004), 0.01, 0.01, [.12, .12, .13], MATTE, 0, 12); }
    if (modern) { const F = frame(v3(xF - 0.003, belt - 0.2, DZ - 0.255), 0); B.cyl(F.at(0, 0, 0), F.at(0, 0, 0.012), 0.017, 0.016, [.55, .56, .58], 0, BRUSHED, 18); B.cyl(F.at(0, 0, 0.012), F.at(0, 0, 0.016), 0.013, 0.013, [.06, .06, .065], MATTE, 0, 18); B.fbox(F, 0, 0.004, 0.0165, 0.012, 0.002, 0.001, [.85, .15, .1]); }
    // the gear lever in its boot (or the automatic's selector), the handbrake
    const xg = xf0 - 0.95;
    if (AT) {
      B.box(xg - 0.09, yC + 0.006, -0.045, xg + 0.06, yC + 0.012, 0.045, P.piano, 0);
      B.cyl(v3(xg, yC, 0), v3(xg - 0.01, yC + 0.11, 0), 0.012, 0.01, [.1, .1, .1], MATTE, 0, 10);
      B.obox(v3(xg - 0.012, yC + 0.135, 0), 0.07, 0.06, 0.045, Qz(0.15), [.08, .08, .085]);
      B.obox(v3(xg - 0.012, yC + 0.168, 0), 0.06, 0.008, 0.035, Qz(0.15), P.decor, P.decorG, P.decorP);
    } else {
      // (the boot stays; the lever and its knob go round the gate with the gear you're in)
      B.ring(v3(xg, yC + 0.008, 0), UP, 0.05, 0.006, P.decor, P.decorG, P.decorP, Math.PI*2, 0, 6, 24);
      B.cyl(v3(xg, yC + 0.004, 0), v3(xg, yC + 0.06, 0), 0.05, 0.03, [.06, .06, .062], MATTE, SUEDE, 14);
      const Kg = new K();
      Kg.cyl(v3(0, 0.03, 0), v3(0, 0.1, 0), 0.03, 0.016, [.06, .06, .062], MATTE, SUEDE, 12);
      Kg.cyl(v3(0, 0.1, 0), v3(-0.008, 0.2, 0), 0.008, 0.008, [.12, .12, .12], MATTE, 0, 8);
      Kg.sph(v3(-0.008, 0.22, 0), 0.032, [.07, .07, .075], MATTE, 0, 1, 0.85, 1, 14);
      const kt = v3(-0.008, 0.247, 0);
      for (const dz of [-0.012, 0, 0.012]) Kg.box(kt.x - 0.011, kt.y, kt.z + dz - 0.0008, kt.x + 0.011, kt.y + 0.002, kt.z + dz + 0.0008, [.85, .85, .85]);
      Kg.box(kt.x - 0.0008, kt.y, kt.z - 0.012, kt.x + 0.0008, kt.y + 0.002, kt.z + 0.012, [.85, .85, .85]);
      const gl = Kg.mesh(mats.solid); gl.position.set(xg, yC + 0.004, 0); extra.push(gl); C._gear = gl;
    }
    if (!AT || kind === 'xuv' || kind === 'fortuner') {
      const hp = v3(xf0 - 1.24, yC + 0.01, -0.0), he = v3(xf0 - 1.45, yC + 0.08, 0);
      B.cyl(hp, he, 0.014, 0.017, [.07, .07, .075], MATTE, 0, 10);
      B.cyl(he, he.clone().add(v3(-0.012, 0.004, 0)), 0.008, 0.008, [.55, .56, .58], 0, BRUSHED, 8);
      B.box(hp.x - 0.05, yC, -0.03, hp.x + 0.04, yC + 0.012, 0.03, [.05, .05, .055]);
    }
    // the drive mode, wherever this car has one
    if (k === 'jeep' || kind === 'jeep') {
      // the transfer case's lever beside the gear lever: forward 2H, upright 4H, back 4L
      const piv = v3(xf0 - 1.07, yC + 0.01, -0.065), Lk = new K();
      Lk.cyl(v3(0, 0, 0), v3(0, 0.16, 0), 0.007, 0.007, [.12, .12, .12], MATTE, 0, 8); Lk.sph(v3(0, 0.175, 0), 0.022, [.06, .06, .065], MATTE, 0, 1, 1.15, 1, 12);
      Lk.box(-0.01, 0.193, -0.008, 0.01, 0.198, 0.008, [.85, .55, .1]);
      const lev = Lk.mesh(mats.solid); lev.position.copy(piv); extra.push(lev);
      B.box(piv.x - 0.06, yC, piv.z - 0.025, piv.x + 0.06, yC + 0.012, piv.z + 0.025, [.04, .04, .045]);
      lit.set.push((m, i) => { lev.rotation.z = [0.28, 0, -0.3][i] ?? 0; });
    } else if (kind === 'city') {
      // ECON, its lamp green when it's on
      const F = frame(v3(xF - 0.003, belt - 0.245, DZ - 0.255), 0);
      B.fbox(F, 0, 0, 0.006, 0.034, 0.018, 0.008, [.08, .08, .085]);
      const dot = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.004), lamp(0x1d2a20)); dot.applyMatrix4(fm(F, -0.008, 0.004, 0.0105)); extra.push(dot);
      lit.set.push((m) => dot.material.color.set(String(m).toUpperCase() === 'ECON' ? '#3ddc84' : '#1d2a20'));
    } else if (modes) {
      // a drive-mode knob at the head of the console, its pointer turned to the mode, a lamp by each
      const kp = v3(Cx - 0.07, yC + 0.006, 0), Nk = new K();
      B.cyl(kp, kp.clone().add(v3(0, 0.006, 0)), 0.04, 0.04, [.05, .05, .055], MATTE, 0, 24);
      Nk.cyl(v3(0, 0, 0), v3(0, 0.03, 0), 0.026, 0.024, [.08, .08, .085], MATTE, 0, 20); Nk.ring(v3(0, 0.03, 0), UP, 0.023, 0.002, [.6, .61, .63], 0, BRUSHED, Math.PI*2, 0, 4, 20);
      Nk.box(-0.004, 0.0305, 0.004, 0.004, 0.0325, 0.022, [.9, .9, .9]);
      const knob = Nk.mesh(mats.solid); knob.position.copy(kp).y += 0.006; extra.push(knob);
      const n = modes.length, angs = modes.map((_, i) => (i - (n - 1)/2)*0.8), dots = angs.map((a) => { const d = new THREE.Mesh(new THREE.CircleGeometry(0.005, 10), lamp(0x222222)); d.rotation.x = -Math.PI/2; d.position.set(kp.x - Math.cos(a)*0.034, yC + 0.0125, kp.z + Math.sin(a)*0.034); extra.push(d); return d; });
      // (the pointer's at local +z: turned by a about y it points at (−cos, sin) round the knob's front)
      lit.set.push((m, i) => { knob.rotation.y = -Math.PI/2 + angs[i]; dots.forEach((d, j) => d.material.color.set(j === i ? modeCol(m) : '#202224')); });
    }
    // the cluster
    const F = frame(v3(xf0 - 0.56, belt + 0.06, DZ), 0.25);
    const cl = screen(0.3, 0.1125, 512, F.m), vmax = /^(alto|wagonr)$/.test(kind) ? 160 : k === 'suv' ? 200 : 180;
    extra.push(cl.m);
    C._draw = analog(cl, vmax, kind, AT, scr, kind === 'taxi', modes); C._cl = cl; C._scr = [cl, scr];
  }

  // ------------------------------------------------------------ the E-Class-style
  if (tier === 1) {
    const amb = lamp(0x7fc8ff); C._amb = amb;
    const strip = (x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0) || 1e-3, Math.abs(y1 - y0) || 1e-3, Math.abs(z1 - z0) || 1e-3); g.translate((x0 + x1)/2, (y0 + y1)/2, (z0 + z1)/2); const m = new THREE.Mesh(g, amb); extra.push(m); return m; };
    // one glass across the cluster and the screen, on its slab, a leather cowl over the dials
    const F = frame(v3(xf0 - 0.555, belt + 0.065, 0.21), 0.18);
    B.fbox(F, 0, 0, -0.012, 0.66, 0.138, 0.02, P.piano, 0);
    for (const s of [-1, 1]) B.fbox(F, 0, s*0.069, -0.004, 0.66, 0.003, 0.012, P.metal, 0, BRUSHED);
    B.fbox(F, 0.17, 0.077, 0.03, 0.33, 0.01, 0.07, P.top);
    const ws = screen(0.64, 0.125, 1024, fm(F, 0, 0, 0.0005)); extra.push(ws.m);
    // four turbine vents along the dash, a light ring round each
    const turb = (p) => {
      const Fv = frame(p, 0);
      B.ring(Fv.at(0, 0, 0.006), Fv.Z, 0.04, 0.007, P.metal, 0, BRUSHED, Math.PI*2, 0, 8, 30);
      B.disc(Fv.at(0, 0, 0.002), Fv.Z, 0.038, [.02, .02, .022]);
      for (let i = 0; i < 9; i++) { const a = i/9*Math.PI*2; B.obox(Fv.at(Math.cos(a)*0.021, Math.sin(a)*0.021, 0.008), 0.034, 0.003, 0.008, Fv.q.clone().multiply(Qz(a)).multiply(new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), 0.6)), P.metal, 0, BRUSHED); }
      B.cyl(Fv.at(0, 0, 0.004), Fv.at(0, 0, 0.022), 0.009, 0.007, P.metal, 0, BRUSHED, 14);
      const rg = new THREE.Mesh(new THREE.TorusGeometry(0.0475, 0.0018, 4, 32), amb); rg.applyMatrix4(fm(Fv, 0, 0, 0.004)); extra.push(rg);
    };
    for (const z of [-(hw - 0.22), -0.09, 0.09, hw - 0.22]) turb(Math.abs(z) < 0.2 ? FU(belt - 0.1, z).at(0, 0, 0) : v3(xF - 0.003, belt - 0.11, z));
    // walnut across the dash, the light above it, the climate's toggles on the stack
    B.box(xF - 0.008, belt - 0.21, -(hw - 0.13), xF, belt - 0.165, hw - 0.13, P.decor, 0, WOOD);
    strip(xF - 0.006, belt - 0.162, -(hw - 0.13), xF - 0.003, belt - 0.158, hw - 0.13);
    { const Ft = FU(Math.max(yM + 0.03, belt - 0.2)); B.fbox(Ft, 0, 0, 0.004, 0.26, 0.05, 0.008, P.piano, 0); for (let i = 0; i < 6; i++) { B.fbox(Ft, -0.1 + i*0.04, 0, 0.012, 0.012, 0.02, 0.012, P.metal, 0, BRUSHED); B.fbox(Ft, -0.1 + i*0.04, 0.017, 0.009, 0.01, 0.003, 0.001, [.85, .85, .85], 0.4); } }
    // the console: the touchpad on its rest, the controller, the light along each side; the column's gear stalk
    { const xp = xf0 - 1.12; B.ext(rrect(0.07, 0.08, 0.015), 0.006, new THREE.Matrix4().makeRotationX(-Math.PI/2).premultiply(mT(xp, yC + 0.006, 0)), P.piano, 0); B.box(xp - 0.1, yC + 0.006, -0.045, xp - 0.04, yC + 0.02, 0.045, P.metal, 0, BRUSHED);
      B.cyl(v3(xp + 0.075, yC + 0.006, 0), v3(xp + 0.075, yC + 0.03, 0), 0.025, 0.024, P.metal, 0, BRUSHED, 24); B.cyl(v3(xp + 0.075, yC + 0.03, 0), v3(xp + 0.075, yC + 0.034, 0), 0.02, 0.02, P.piano, 0, 0, 24); }
    for (const s of [-1, 1]) strip(xCb + 0.02, yC - 0.008, s*(wC + 0.001) - 0.0015, Cx - 0.01, yC - 0.004, s*(wC + 0.001) + 0.0015);
    B.cyl(CF.at(0.055, -0.01, -0.12), CF.at(0.13, -0.01, -0.14), 0.006, 0.008, P.metal, 0, BRUSHED, 8);
    B.box(xF - 0.004, belt - 0.33, -(hw - 0.24), xF + 0.002, belt - 0.22, -wS - 0.03, P.face);
    B.box(xF - 0.04, Math.max(fl + 0.3, belt - 0.44), DZ - 0.22, xF + 0.02, belt - 0.22, DZ + 0.24, P.face);
    C._draw = luxScreen(ws, amb); C._cl = ws; C._scr = [ws];
    C._amb = amb; C._strip = strip;
  }

  // ------------------------------------------------------------ the 911-style
  if (tier === 2) {
    // five round dials under one cowl: the big rev counter in the middle
    const F = frame(v3(xf0 - 0.555, belt + 0.06, DZ), 0.22);
    B.fbox(F, 0, 0, -0.007, 0.4, 0.14, 0.01, [.02, .02, .022]);
    B.fbox(F, 0, 0.074, 0.05, 0.42, 0.012, 0.115, P.top);
    for (const s of [-1, 1]) B.fbox(F, s*0.205, 0.004, 0.05, 0.012, 0.15, 0.115, P.top);
    B.fbox(F, 0, 0.0675, 0.106, 0.42, 0.002, 0.003, P.stitch);
    for (const [u, r] of [[0, 0.052], [-0.083, 0.04], [0.083, 0.04], [-0.148, 0.032], [0.148, 0.032]]) B.ring(F.at(u, 0, 0.004), F.Z, r, 0.0028, P.metal, 0, BRUSHED, Math.PI*2, 0, 6, 40);
    const cl = screen(0.36, 0.108, 800, fm(F, 0, 0, 0.0005)); extra.push(cl.m);
    // the clock on top of the dash
    const cp = v3(xF + 0.2, belt + 0.06, 0), cq = new THREE.Quaternion().setFromUnitVectors(ZZ, v3(-0.85, 0.53, 0).normalize());
    const CFk = { m: new THREE.Matrix4().compose(cp, cq, ONE), q: cq, at: (u, v, w) => v3(u, v, w).applyQuaternion(cq).add(cp) };
    B.cyl(CFk.at(0, 0, -0.04), CFk.at(0, 0, 0.002), 0.038, 0.04, P.top, MATTE, 0, 28);
    B.ring(CFk.at(0, 0, 0.003), CFk.at(0, 0, 1).sub(cp), 0.037, 0.0035, P.metal, 0, BRUSHED, Math.PI*2, 0, 6, 36);
    const ck = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.CircleGeometry(0.035, 40), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.applyMatrix4(CFk.m.clone().multiply(mT(0, 0, 0.0035))); return { m, cv, ctx: cv.getContext('2d'), tex }; })();
    extra.push(ck.m);
    // slim vents across the top of the stack, the screen, the toggles and hazard under it
    for (const s of [-1, 1]) { const Fv = FU(belt - 0.085, s*0.072); B.fbox(Fv, 0, 0, 0.004, 0.13, 0.03, 0.008, P.piano, 0); for (let i = 0; i < 3; i++) B.fbox(Fv, 0, -0.01 + i*0.01, 0.009, 0.124, 0.003, 0.004, [.1, .1, .105]); }
    const FS = FU(Math.max(yM + 0.06, belt - 0.17));
    B.fbox(FS, 0, 0, 0.004, 0.26, 0.1, 0.008, P.piano, 0);
    const ts = screen(0.245, 0.09, 480, fm(FS, 0, 0, 0.0085)); extra.push(ts.m);
    { const Ft = FL(0.75); for (let i = 0; i < 5; i++) { const u = -0.08 + i*0.04; B.fbox(Ft, u, 0, 0.004, 0.026, 0.02, 0.008, P.piano, 0); B.cyl(Ft.at(u, -0.002, 0.008), Ft.at(u, 0.007, 0.022), 0.0035, 0.003, P.metal, 0, BRUSHED, 8); } }
    // the console's little selector and its buttons, the twist key left of the wheel
    { const xg = xf0 - 0.98; B.box(xg - 0.05, yC + 0.006, -0.03, xg + 0.05, yC + 0.016, 0.03, P.metal, 0, BRUSHED); B.obox(v3(xg, yC + 0.035, 0), 0.03, 0.035, 0.016, Qz(0.2), [.05, .05, .055], 0);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) B.box(xg - 0.12 + i*0.035, yC + 0.006, s*0.05 - 0.012, xg - 0.095 + i*0.035, yC + 0.012, s*0.05 + 0.012, [.04, .04, .045]); }
    { const Fk = frame(v3(xF - 0.003, belt - 0.2, DZ - 0.235), 0); B.cyl(Fk.at(0, 0, 0), Fk.at(0, 0, 0.006), 0.02, 0.02, P.metal, 0, BRUSHED, 20); B.cyl(Fk.at(0, 0, 0.006), Fk.at(0, 0, 0.024), 0.013, 0.012, [.06, .06, .065], MATTE, 0, 16); B.fbox(Fk, 0, 0, 0.026, 0.026, 0.009, 0.01, [.07, .07, .075]); }
    B.box(xF - 0.04, Math.max(fl + 0.28, belt - 0.42), DZ - 0.22, xF + 0.02, belt - 0.22, DZ + 0.24, P.face);
    B.box(xF - 0.008, belt - 0.16, -(hw - 0.14), xF, belt - 0.13, -wS - 0.005, P.decor, 0, CARBON);
    B.box(xF - 0.004, belt - 0.32, -(hw - 0.24), xF + 0.002, belt - 0.17, -wS - 0.03, P.face);
    // where the little back seats fold flat: a carpeted shelf with two luggage straps
    B.box(xs - 0.95, fl + 0.2, -(hw - 0.2), xs - 0.5, fl + 0.36, hw - 0.2, P.carpet, MATTE, SUEDE);
    B.obox(v3(xs - 0.62, fl + 0.6, 0), 0.06, 0.5, 2*hw - 0.4, Qz(0.35), P.carpet, MATTE, SUEDE);
    for (const s of [-1, 1]) B.box(xs - 0.93, fl + 0.36, s*0.3 - 0.015, xs - 0.52, fl + 0.365, s*0.3 + 0.015, [.12, .12, .13]);
    C._draw = fiveDial(cl, ts, ck); C._cl = cl; C._scr = [cl, ts];
  }

  // ------------------------------------------------------------ the Huracán-style
  if (tier === 3) {
    // a carbon cowl over the screen
    const F = frame(v3(xf0 - 0.555, belt + 0.055, DZ), 0.25);
    B.fbox(F, 0, 0, -0.007, 0.35, 0.14, 0.01, [.015, .015, .017]);
    B.fbox(F, 0, 0.072, 0.05, 0.37, 0.012, 0.12, [.07, .07, .075], 0, CARBON);
    for (const s of [-1, 1]) B.obox(F.at(s*0.182, 0.0, 0.05), 0.012, 0.155, 0.12, F.q.clone().multiply(Qz(s*-0.18)), [.07, .07, .075], 0, CARBON);
    B.fbox(F, 0, 0.066, 0.11, 0.37, 0.002, 0.003, P.stitch);
    const cl = screen(0.32, 0.12, 768, fm(F, 0, 0, 0.0005)); extra.push(cl.m);
    // three hexagonal vents across the top of the stack, one at each end of the dash
    const hexVent = (Fv, r) => {
      const sh = poly(hexPts(r + 0.008)); sh.holes.push(new THREE.Path(hexPts(r).reverse().map(([x, y]) => new THREE.Vector2(x, y))));
      B.ext(sh, 0.012, fm(Fv, 0, 0, 0), [.05, .05, .055], 0, 0, 0.001);
      B.ext(poly(hexPts(r)), 0.002, fm(Fv, 0, 0, 0.002), [.015, .015, .017], MATTE, 0);
      for (let i = -2; i <= 2; i++) B.fbox(Fv, 0, i*r*0.32, 0.008, r*1.7*(1 - Math.abs(i)*0.17), 0.0035, 0.008, [.08, .08, .085]);
      B.fbox(Fv, 0, 0, 0.014, 0.012, 0.012, 0.008, [.55, .56, .58], 0, BRUSHED);
    };
    for (const z of [-0.088, 0, 0.088]) hexVent(FU(belt - 0.09, z), 0.036);
    for (const s of [-1, 1]) hexVent(frame(v3(xF - 0.003, belt - 0.1, s*(hw - 0.2)), 0), 0.034);
    // the screen under them
    const sT = belt - 0.09 - 0.036*0.87 - 0.012, sB = yM + 0.004, sh = Math.max(0.026, sT - sB), FS = FU((sT + sB)/2);
    B.fbox(FS, 0, 0, 0.004, 0.2, sh, 0.008, [.015, .015, .017], 0);
    const ts = screen(0.185, sh - 0.008, 400, fm(FS, 0, 0, 0.0085)); extra.push(ts.m);
    // a carbon bridge with eight aircraft toggles, and in the middle, under its red flip cover, the start button
    const FB = FL(0.55);
    B.fbox(FB, 0, 0, 0.004, 0.27, 0.06, 0.008, [.07, .07, .075], 0, CARBON);
    for (let i = 0; i < 8; i++) {
      const u = (i < 4 ? -0.118 : 0.04) + (i % 4)*0.026;
      B.fbox(FB, u, 0, 0.009, 0.016, 0.03, 0.004, [.04, .04, .045], 0);
      B.cyl(FB.at(u, -0.002, 0.01), FB.at(u, 0.012, 0.03), 0.0032, 0.0026, [.72, .73, .75], 0, BRUSHED, 8);
      B.fbox(FB, u, -0.022, 0.0112, 0.012, 0.004, 0.001, [.88, .88, .88], 0.3);
    }
    B.cyl(FB.at(0, 0, 0.008), FB.at(0, 0, 0.02), 0.014, 0.013, [.72, .05, .04], MATTE, 0, 18);
    B.ring(FB.at(0, 0, 0.0085), FB.Z, 0.016, 0.002, [.72, .73, .75], 0, BRUSHED, Math.PI*2, 0, 4, 20);
    B.obox(FB.at(0, 0.022, 0.03), 0.036, 0.004, 0.036, FB.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(v3(1, 0, 0), -1.0)), [.8, .06, .05], 0);
    B.fbox(FB, 0, 0.018, 0.01, 0.03, 0.006, 0.006, [.55, .56, .58], 0, BRUSHED);
    // under that, the gearbox's controls: the reverse lever, P, and the auto/manual switch
    { const Fg = FL(0.12); B.fbox(Fg, -0.05, 0, 0.004, 0.03, 0.02, 0.012, [.72, .73, .75], 0, BRUSHED); B.fbox(Fg, 0, 0, 0.004, 0.024, 0.018, 0.008, [.04, .04, .045], 0); B.fbox(Fg, 0.045, 0, 0.004, 0.034, 0.018, 0.008, [.04, .04, .045], 0);
      B.fbox(Fg, 0, 0, 0.0085, 0.006, 0.008, 0.001, [.9, .9, .9], 0.3); B.fbox(Fg, 0.045, 0, 0.0085, 0.016, 0.003, 0.001, [.9, .9, .9], 0.3); }
    // the paddles, big, on the column (they don't turn with the wheel)
    const Pd = new K();
    for (const s of [-1, 1]) {
      Pd.obox(CF.at(s*0.15, 0.03, -0.038), 0.11, 0.05, 0.007, qCol.clone().multiply(Qz(s*-0.35)), [.72, .73, .75], 0, BRUSHED);
      Pd.obox(CF.at(s*0.08, 0.01, -0.06), 0.05, 0.02, 0.02, qCol, [.06, .06, .065], 0);
    }
    extra.push(Pd.mesh(mats.solid));
    B.box(xF - 0.04, Math.max(fl + 0.26, belt - 0.4), DZ - 0.22, xF + 0.02, belt - 0.22, DZ + 0.24, P.face, MATTE, SUEDE);
    B.box(xF - 0.004, belt - 0.32, -(hw - 0.24), xF + 0.002, belt - 0.17, -wS - 0.03, P.face, MATTE, SUEDE);
    B.box(xF - 0.009, belt - 0.165, -(hw - 0.14), xF, belt - 0.14, -wS - 0.005, P.accent, MATTE);
    // behind the seats, the bulkhead to the engine
    B.box(xs - 0.66, fl, -(hw - 0.14), xs - 0.6, belt + 0.02, hw - 0.14, [.06, .06, .065], MATTE, SUEDE);
    B.box(xs - 0.61, belt - 0.12, -(hw - 0.2), xs - 0.6, belt - 0.1, hw - 0.2, [.07, .07, .075], 0, CARBON);
    C._draw = superScreen(cl, ts); C._cl = cl; C._scr = [cl, ts];
  }

  // the premium cabins: a contrast seam sewn along the dash's edge, and under the glovebox
  if (tier >= 1) for (const y of [belt - 0.083, belt - 0.315]) B.box(xF - 0.0035, y - 0.0015, -(hw - 0.15), xF - 0.0005, y + 0.0015, hw - 0.15, P.stitch);
  // ------------------------------------------------------------ every car: the top of the dash and the windscreen
  {
    // the demister's slots along the foot of the windscreen, the speaker in the middle, the light sensor, the tweeters in
    // the corners by the pillars
    for (let i = 0; i < 4; i++) { const z0 = -(hw - 0.3) + i*(2*hw - 0.6)/4; B.box(xf0 - 0.15, belt + 0.03, z0 + 0.02, xf0 - 0.135, belt + 0.033, z0 + (2*hw - 0.6)/4 - 0.02, [.02, .02, .022]); }
    B.box(xf0 - 0.36, belt + 0.032, -0.08, xf0 - 0.27, belt + 0.035, 0.08, tier === 3 ? [.03, .03, .035] : [.05, .05, .055], MATTE, PERF);
    B.sph(v3(xf0 - 0.2, belt + 0.032, 0.14), 0.012, [.02, .02, .025], 0, 4, 1, 0.5, 1, 10);
    for (const s of [-1, 1]) { const tp = v3(xf0 - 0.16, belt + 0.03, s*(hw - 0.2)); B.disc(tp.clone().add(v3(0, 0.004, 0)), v3(-0.5, 1, -s*0.6), 0.03, tier === 1 ? P.metal : [.04, .04, .045], tier === 1 ? 0 : MATTE, tier === 1 ? BRUSHED : PERF, 3); }
    // what's stuck to the inside of the windscreen: the FASTag behind the mirror, the PUC and insurance discs in the corner
    const Ax = xf0 - 0.04, Ay = belt + 0.03, Bx = S.roofF, By = H - 0.03, dl = Math.hypot(Bx - Ax, By - Ay), ang = Math.atan2(By - Ay, Bx - Ax);
    const onGlass = (t, z) => v3(Ax + (Bx - Ax)*t + Math.sin(ang)*0.05, Ay + (By - Ay)*t + 0.03, z);
    const gq = Qz(ang - Math.PI/2);
    B.obox(onGlass(0.86, -0.13), 0.002, 0.045, 0.085, gq, [.93, .93, .9]);
    B.obox(onGlass(0.86, -0.13).add(v3(0, 0.001, 0)), 0.0025, 0.022, 0.022, gq, [.7, .7, .7]);
    if (tier <= 1) { B.add(new THREE.CylinderGeometry(0.03, 0.03, 0.002, 18), new THREE.Matrix4().compose(onGlass(0.12, -(hw - 0.32)), gq.clone().multiply(Qz(Math.PI/2)), ONE), [.95, .88, .55]); B.add(new THREE.CylinderGeometry(0.028, 0.028, 0.002, 18), new THREE.Matrix4().compose(onGlass(0.12, -(hw - 0.4)), gq.clone().multiply(Qz(Math.PI/2)), ONE), [.75, .85, .95]); }
    void dl;
    // the mirror: a proper housing round the glass (the glass itself, a real one: below)
    const mx = Math.min(xf0 - 0.42, S.roofF - 0.12), mp = v3(mx - 0.035, H - 0.148, 0), E = v3(xf0 - 1.25, belt + 0.19, DZ);
    const mn = E.clone().sub(mp).normalize().add(v3(-1, 0, 0)).normalize(), mX = UP.clone().cross(mn).normalize(), mY = mn.clone().cross(mX);
    const mM = new THREE.Matrix4().makeBasis(mX, mY, mn).setPosition(mp);
    B.ext(rrect(0.215, 0.064, 0.026), 0.028, mM.clone().multiply(mT(0, 0, -0.03)), tier === 3 ? [.07, .07, .075] : [.07, .07, .075], tier === 3 ? 0 : MATTE, tier === 3 ? CARBON : 0, 0.004);
    B.ext(rrect(0.2, 0.052, 0.02), 0.002, mM.clone().multiply(mT(0, 0, 0.0005)), [.16, .18, .2], 0, 4);
    C._irvm = { M: mM, w: 0.196, h: 0.05 };
    if (tier >= 1) B.box(mx - 0.03, H - 0.105, -0.03, mx + 0.01, H - 0.085, 0.03, [.07, .07, .075]);    // the rain and light sensor's housing
  }
  // the ports at the foot of the stack, and what gets left plugged in or in the cupholder
  if (tier <= 1) {
    const Fp = FL(0.06); for (const u of [-0.06, -0.035]) B.fbox(Fp, u, 0, 0.004, 0.016, 0.008, 0.008, [.02, .02, .022]);
    B.cyl(Fp.at(0.05, 0, 0), Fp.at(0.05, 0, 0.01), 0.013, 0.012, [.05, .05, .055], MATTE, 0, 14); B.disc(Fp.at(0.05, 0, 0.0105), Fp.Z, 0.009, [.01, .01, .012], MATTE, 0, 12);
    if (tier === 0 && (rh > 0.45 || kind === 'taxi')) {
      const a0 = Fp.at(-0.06, 0, 0.012);
      B.tube([a0, a0.clone().add(v3(-0.03, -0.03, 0.01)), v3(xf0 - 0.85, yC + 0.01, 0.07), v3(xf0 - 1.0, yC + 0.012, 0.085), v3(xf0 - 1.12, yC + 0.03, 0.05)], 0.0022, [.9, .9, .88], MATTE, 0, false, 30, 4);
    }
    if (tier === 0 && /^(taxi|bolero|alto|jeep)$/.test(kind)) {
      // a cutting chai, half drunk
      const cp = v3(xf0 - 1.13, yC - 0.02, 0.045);
      B.cyl(cp, cp.clone().add(v3(0, 0.08, 0)), 0.022, 0.028, [.75, .8, .8], 0, 4, 14);
      B.disc(cp.clone().add(v3(0, 0.045, 0)), UP, 0.025, [.55, .36, .2], 0, 0, 14);
    }
  }
  if (tier === 1) for (const [x0, y, z0, z1] of [[xF + 0.004, belt - 0.374, -(hw - 0.13), -0.16], [xF - 0.038, Math.max(fl + 0.3, belt - 0.44) - 0.003, DZ - 0.2, DZ + 0.22]]) C._strip(x0 - 0.003, y - 0.002, z0, x0, y, z1);

  // ------------------------------------------------------------ every car: the seats
  const st = [0, 1, 2, 3][tier];
  for (const s of [-1, 1]) seat(B, { x: xs, z: s*DZ, fl, kS, P, st, towel: kind === 'taxi' && s > 0, beads: s > 0 && /^(bolero|wagonr|ertiga)$/.test(kind) });
  if (rear) {
    // the rear bench: three places, three headrests, the belts at its sides; the parcel shelf behind
    const xr = Math.max(xb, S.roofR - 0.45), yt = Math.min(fl + 0.95, H - 0.32), zw = hw - 0.15, a = 0.18;
    B.box(xr + 0.04, fl + 0.18, -zw, xr + 0.56, fl + 0.34, zw, P.seat);
    for (const s of [-1, 1]) B.box(xr + 0.06, fl + 0.34, s*zw*0.62 - s*0.17, xr + 0.53, fl + 0.36, s*zw*0.62 + s*0.12, P.seatIn, MATTE, P.seatP);
    B.cyl(v3(xr + 0.55, fl + 0.32, -zw + 0.01), v3(xr + 0.55, fl + 0.32, zw - 0.01), 0.03, 0.03, P.seat, MATTE, 0, 10);
    const bh = yt - fl - 0.34, bq = Qz(a), bc = v3(xr + 0.06 - Math.sin(a)*bh*0.5, fl + 0.34 + Math.cos(a)*bh*0.5, 0);
    B.obox(bc, 0.1, bh, 2*zw, bq, P.seat);
    for (const s of [-1, 1]) B.obox(bc.clone().add(v3(0.052, 0, s*zw*0.6)), 0.008, bh*0.8, 0.3, bq, P.seatIn, MATTE, P.seatP);
    for (const z of [-zw/3, zw/3]) B.obox(bc.clone().add(v3(0.051, 0, z)), 0.004, bh*0.9, 0.004, bq, P.stitch);
    const topc = v3(xr + 0.06 - Math.sin(a)*bh, fl + 0.34 + Math.cos(a)*bh, 0);
    for (const z of tier === 1 ? [-zw*0.6, zw*0.6] : [-zw*0.66, 0, zw*0.66]) {
      for (const s of [-1, 1]) B.cyl(topc.clone().add(v3(-0.04, -0.02, z + s*0.06)), topc.clone().add(v3(-0.05, 0.05, z + s*0.06)), 0.005, 0.005, P.metal, 0, BRUSHED, 6);
      B.obox(topc.clone().add(v3(-0.055, 0.1, z)), 0.08, Math.max(0.1, 0.14*kS), 0.2, bq, P.seat);
    }
    if (tier === 1) { B.box(xr + 0.12, fl + 0.36, -0.13, xr + 0.5, fl + 0.5, 0.13, P.arm); B.box(xr + 0.3, fl + 0.5, -0.11, xr + 0.48, fl + 0.505, 0.11, P.decor, 0, WOOD); for (const s of [-1, 1]) B.cyl(v3(xr + 0.39, fl + 0.46, s*0.055), v3(xr + 0.39, fl + 0.506, s*0.055), 0.032, 0.032, [.02, .02, .022], MATTE, 0, 14); }
    for (const s of [-1, 1]) {
      const z = s*(zw - 0.02);
      B.box(xr - 0.04, fl + 0.36, z - 0.022, xr - 0.035, yt + 0.06, z + 0.022, P.belt);
      B.box(xr + 0.06, fl + 0.3, s*0.1 - 0.012, xr + 0.09, fl + 0.4, s*0.1 + 0.012, [.12, .12, .13]);
    }
    if (S.tail > 0.3 || /^(alto|wagonr|hatch|taxi)$/.test(kind)) {
      B.box(xr - 0.55, yt - 0.02, -zw, xr - 0.06, yt, zw, P.trim);
      if (/^(city|sedan|taxi|innova)$/.test(kind)) { B.box(xr - 0.4, yt, -0.28, xr - 0.16, yt + 0.09, -0.16, [.85, .82, .76]); B.box(xr - 0.31, yt + 0.09, -0.24, xr - 0.25, yt + 0.1, -0.2, [.95, .95, .94]); }
    }
    if (four || tier === 1) B.box(xr + 0.56, fl, -0.12, xs - 0.3, fl + 0.06, 0.12, P.carpet);
  }

  // ------------------------------------------------------------ every car: belts down the pillars, the pillars' trim
  for (const s of [-1, 1]) {
    const zp = s*(hw - 0.135), top = Math.min(H - 0.3, belt + 0.46);
    B.box(D.x0 - 0.075, belt - 0.04, s*(hw - 0.16), D.x0 + 0.02, H - 0.13, s*(hw - 0.1), P.trim);
    B.box(D.x0 - 0.055, top - 0.03, zp - s*0.03, D.x0 - 0.005, top + 0.01, zp - s*0.022, [.12, .12, .13]);
    B.box(D.x0 - 0.045, fl + 0.05, zp - s*0.026, D.x0 - 0.015, top - 0.02, zp - s*0.022, P.belt);
  }

  // ------------------------------------------------------------ every car: the roof inside
  {
    const x0 = S.roofR + 0.08, x1 = S.roofF - 0.03, zr = Math.min(hw - 0.28, low ? 0.42 : 0.5), yr = H - 0.04, rf = tier >= 2 ? P.roof : P.roof, rp = tier >= 2 ? SUEDE : SUEDE;
    const pane = (a0, a1, b0, b1) => { if (a1 - a0 < 0.02 || b1 - b0 < 0.02) return; const g = new THREE.BoxGeometry(a1 - a0, 0.012, b1 - b0, 8, 1, 4); g.translate((a0 + a1)/2, yr, (b0 + b1)/2); B.add(g, null, rf, MATTE, rp); };
    if (tier === 1 || hasSun(kind)) { const s0 = S.roofF - 0.87, s1 = S.roofF - 0.2; pane(x0, s0, -zr, zr); pane(s1, x1, -zr, zr); pane(s0, s1, -zr, -0.44); pane(s0, s1, 0.44, zr); }
    else pane(x0, x1, -zr, zr);
    // the dome lamp, the map lamps up by the mirror
    const dc = (x0 + x1)/2;
    if (x1 - x0 > 0.4) { B.box(dc - 0.06, yr - 0.016, -0.05, dc + 0.06, yr - 0.006, 0.05, [.75, .74, .7]); B.box(dc - 0.045, yr - 0.018, -0.035, dc + 0.045, yr - 0.016, 0.035, [.95, .94, .88], 0.25); }
    const xm = x1 - 0.12;
    B.box(xm - 0.1, yr - 0.03, -0.11, xm + 0.04, yr - 0.006, 0.11, tier >= 2 ? [.07, .07, .075] : P.plastic, tier === 3 ? 0 : MATTE, tier === 3 ? CARBON : 0);
    for (const s of [-1, 1]) B.box(xm - 0.07, yr - 0.032, s*0.06 - 0.025, xm - 0.02, yr - 0.03, s*0.06 + 0.025, [.9, .9, .86], 0.15);
    if (tier === 3) for (let i = 0; i < 4; i++) B.box(xm - 0.005, yr - 0.034, -0.045 + i*0.03 - 0.008, xm + 0.025, yr - 0.03, -0.045 + i*0.03 + 0.008, i === 1 ? [.72, .05, .04] : [.04, .04, .045]);
    // the sun visors, a slip of paper tucked in the driver's
    for (const s of [-1, 1]) {
      const za = s*0.13, zb = s*Math.min(hw - 0.17, zr + 0.1), xv0 = S.roofF - 0.27, xv1 = S.roofF - 0.02;
      B.box(xv0, H - 0.075, Math.min(za, zb), xv1, H - 0.053, Math.max(za, zb), tier >= 2 ? P.roof : P.roof.map(c => c*0.92), MATTE, SUEDE);
      B.cyl(v3(xv1 - 0.01, H - 0.05, za), v3(xv1 - 0.01, H - 0.05, zb), 0.005, 0.005, [.5, .5, .5], MATTE, 0, 6);
      if (s < 0) B.box(xv0 + 0.04, H - 0.0755, -0.2, xv1 - 0.05, H - 0.075, -0.36, [.4, .4, .42], 0.0);
      if (s > 0 && tier === 0) { B.box(xv0 - 0.025, H - 0.07, 0.24, xv0 + 0.06, H - 0.067, 0.31, [.93, .92, .86]); B.box(xv0 - 0.012, H - 0.069, 0.33, xv0 + 0.07, H - 0.066, 0.38, [.95, .88, .55]); }
    }
    // grab handles over the doors (not the driver's)
    if (tier <= 1) for (const [x, s] of [[(D.x0 + D.x1)/2, -1], ...(four ? [[D.x0 - 0.45, -1], [D.x0 - 0.45, 1]] : [])]) {
      const zr2 = s*(hw - 0.17), y = H - 0.17;
      B.tube([v3(x - 0.11, y + 0.03, zr2), v3(x - 0.08, y - 0.025, zr2 - s*0.03), v3(x + 0.08, y - 0.025, zr2 - s*0.03), v3(x + 0.11, y + 0.03, zr2)], 0.009, P.roof.map(c => c*0.8), MATTE, 0, false, 16, 6);
    }
  }

  // ------------------------------------------------------------ what people keep in their cars
  if (tier === 0) {
    const mx = Math.min(xf0 - 0.42, S.roofF - 0.12), my = H - 0.2;
    if (/^(hatch|alto|wagonr|taxi|bolero|ertiga|innova)$/.test(kind) || rh < 0.3) {
      // a little Ganesh on the dash
      const g = v3(xF + 0.13, belt + 0.03, -0.06), sf = [.88, .34, .08], gold = [.8, .6, .2];
      B.cyl(g, g.clone().add(v3(0, 0.012, 0)), 0.022, 0.024, gold, 0, BRUSHED, 16);
      B.sph(g.clone().add(v3(0, 0.03, 0)), 0.021, sf, MATTE, 0, 1, 1.1, 1.05, 12);
      B.sph(g.clone().add(v3(-0.004, 0.06, 0)), 0.015, sf, MATTE, 0, 1, 1, 1, 12);
      for (const s of [-1, 1]) B.sph(g.clone().add(v3(-0.002, 0.062, s*0.016)), 0.011, sf, MATTE, 0, 0.35, 1, 1, 10);
      B.tube([g.clone().add(v3(-0.016, 0.058, 0)), g.clone().add(v3(-0.024, 0.04, 0.004)), g.clone().add(v3(-0.02, 0.024, 0.01))], 0.004, sf, MATTE, 0, false, 8, 6);
      B.cyl(g.clone().add(v3(-0.004, 0.072, 0)), g.clone().add(v3(-0.004, 0.09, 0)), 0.011, 0.003, gold, 0, BRUSHED, 10);
      B.box(g.x - 0.03, belt + 0.028, g.z - 0.03, g.x + 0.03, belt + 0.03, g.z + 0.03, [.8, .12, .08]);
    }
    if (/^(taxi|innova|bolero|scorpio|ertiga)$/.test(kind) || rh > 0.6) {
      // a mala hanging off the mirror
      for (let i = 0; i <= 18; i++) { const t = i/18, y = my - 0.11*Math.sin(Math.PI*t), z = -0.035 + 0.07*t; B.sph(v3(mx - 0.004, y, z), 0.0042, i % 6 === 0 ? [.8, .62, .25] : [.42, .16, .07], i % 6 === 0 ? 0 : MATTE, i % 6 === 0 ? BRUSHED : 0, 1, 1, 1, 6); }
      B.cyl(v3(mx - 0.004, my - 0.115, 0), v3(mx - 0.004, my - 0.15, 0), 0.004, 0.004, [.8, .3, .05], MATTE, 0, 6);
    }
  }
  if (kind === 'taxi') {
    // the meter on the dash, the phone on its mount by the driver's vent
    const mp = v3(xF + 0.09, belt + 0.035, -0.38);
    B.box(mp.x - 0.05, mp.y, mp.z - 0.065, mp.x + 0.03, mp.y + 0.055, mp.z + 0.065, [.06, .06, .065]);
    const F = frame(v3(mp.x - 0.051, mp.y + 0.03, mp.z), 0.1);
    const ms = screen(0.1, 0.025, 200, fm(F, 0, 0, 0.0005)); extra.push(ms.m);
    C._meter = ms;
    const Fp = frame(v3(xF - 0.03, belt - 0.03, hw - 0.21), 0.05);
    B.fbox(Fp, 0, -0.035, -0.012, 0.03, 0.012, 0.02, [.05, .05, .055]);
    B.fbox(Fp, 0, 0, 0, 0.075, 0.15, 0.009, [.03, .03, .035], 0);
    const ps = screen(0.068, 0.14, 160, fm(Fp, 0, 0, 0.0047)); extra.push(ps.m);
    mapPhone(ps);
  }
  // a bottle in the passenger's door pocket
  const bottle = tier === 0;

  // ------------------------------------------------------------ the door cards
  for (const s of [-1, 1]) {
    const tm = trims[s], T = new K(), zi = s*(hw - 0.15), zin = (d) => zi - s*d;
    const spk = v3(d1 - 0.17, fl + 0.19, zin(0.004)), n = v3(0, 0, -s);
    // the speaker, low and forward
    if (tier === 3) { const sh = poly(hexPts(0.07)); T.ext(sh, 0.004, new THREE.Matrix4().compose(spk, new THREE.Quaternion().setFromUnitVectors(ZZ, n), ONE), [.03, .03, .035], MATTE, PERF); }
    else { T.disc(spk, n, 0.068, tier === 1 ? P.metal : [.05, .05, .055], tier === 1 ? 0 : MATTE, tier === 1 ? BRUSHED : PERF, 28); T.ring(spk, n, 0.07, 0.004, tier === 1 ? P.metal : [.09, .09, .095], tier === 1 ? 0 : MATTE, tier === 1 ? BRUSHED : 0, Math.PI*2, 0, 4, 28); }
    // the pocket along the bottom
    T.box(d0 + 0.06, fl + 0.07, zin(0.06), d1 - 0.27, fl + 0.2, zin(0.005), P.trim);
    T.box(d0 + 0.07, fl + 0.19, zin(0.055), d1 - 0.28, fl + 0.201, zin(0.012), [.03, .03, .03]);
    if (bottle && s < 0) {
      const bp = v3(d0 + 0.2, fl + 0.09, zin(0.035));
      T.cyl(bp, bp.clone().add(v3(0, 0.2, 0)), 0.03, 0.03, [.62, .74, .8], 0, 4.0, 14);
      T.cyl(bp.clone().add(v3(0, 0.2, 0)), bp.clone().add(v3(0, 0.235, 0)), 0.03, 0.013, [.62, .74, .8], 0, 4.0, 14);
      T.cyl(bp.clone().add(v3(0, 0.235, 0)), bp.clone().add(v3(0, 0.25, 0)), 0.014, 0.014, [.1, .3, .75], MATTE, 0, 12);
      T.cyl(bp.clone().add(v3(0, 0.1, 0)), bp.clone().add(v3(0, 0.15, 0)), 0.0305, 0.0305, [.15, .4, .8], MATTE, 0, 14);
    }
    // the trim: walnut and a light (E-Class), carbon (Huracán), a stitched band (911)
    if (tier === 1) { T.box(d0 + 0.05, belt - 0.11, zin(0.006), d1 - 0.05, belt - 0.07, zin(0), P.decor, 0, WOOD); tm && C._strip && (() => { const g = new THREE.BoxGeometry(d1 - d0 - 0.1, 0.004, 0.003); g.translate((d0 + d1)/2, belt - 0.115, zin(0.007)); const m = new THREE.Mesh(g, C._amb); m.userData.amb = true; tm.add(m); })(); }
    if (tier === 3) { T.box(d0 + 0.05, fl + 0.26, zin(0.006), d1 - 0.1, belt - 0.14, zin(0), [.07, .07, .075], 0, CARBON); T.box(d0 + 0.05, belt - 0.14, zin(0.007), d1 - 0.06, belt - 0.03, zin(0), P.face, MATTE, SUEDE); }
    if (tier === 2) { T.box(d0 + 0.05, belt - 0.15, zin(0.006), d1 - 0.05, belt - 0.08, zin(0), P.face); for (const y of [belt - 0.152, belt - 0.078]) T.box(d0 + 0.05, y - 0.0015, zin(0.007), d1 - 0.05, y + 0.0015, zin(0.006), P.stitch); }
    // the pull: a strap (Huracán), a bar (911)
    if (tier === 3) T.tube([v3(d0 + 0.26, belt - 0.12, zin(0.006)), v3(d0 + 0.33, belt - 0.175, zin(0.035)), v3(d0 + 0.42, belt - 0.12, zin(0.006))], 0.008, [.05, .05, .055], MATTE, SUEDE, false, 12, 6);
    if (tier === 2) T.cyl(v3(d0 + 0.22, belt - 0.2, zin(0.035)), v3(d0 + 0.5, belt - 0.2, zin(0.035)), 0.01, 0.01, P.top, MATTE, 0, 10);
    // the window switches on the armrest; on the driver's, all four (two in a two-door). Or the winder, in the cars that wind
    const ax0 = Math.min(xf0 - 0.85, d1) - 0.15, nsw = s > 0 ? (four ? 4 : 2) : 1, wind = /^(alto|taxi|bolero|jeep)$/.test(kind);
    const crank = (T2, x, y) => { const c0 = v3(x, y, zin(0.004)); T2.cyl(c0, c0.clone().add(v3(0, 0, -s*0.018)), 0.018, 0.016, [.1, .1, .11], MATTE, 0, 14); const e = c0.clone().add(v3(0.075, -0.035, -s*0.02)); T2.cyl(c0.clone().add(v3(0, 0, -s*0.018)), e, 0.006, 0.005, [.65, .66, .68], 0, BRUSHED, 6); T2.cyl(e, e.clone().add(v3(0, 0, -s*0.035)), 0.009, 0.008, [.08, .08, .085], MATTE, 0, 10); };
    if (wind) crank(T, d0 + 0.32, belt - 0.2);
    T.box(ax0, belt - 0.262, zin(0.12), ax0 + 0.14, belt - 0.255, zin(0.045), tier >= 2 ? [.07, .07, .075] : P.piano, tier === 3 ? 0 : MATTE, tier === 3 ? CARBON : 0);
    if (!wind) for (let i = 0; i < nsw; i++) T.box(ax0 + 0.02 + (i % 2)*0.05, belt - 0.255, zin(0.105 - Math.floor(i/2)*0.035), ax0 + 0.045 + (i % 2)*0.05, belt - 0.247, zin(0.08 - Math.floor(i/2)*0.035), [.1, .1, .11]);
    // the lock pin on the sill, and on the E-Class the seat's own switch, shaped like a seat
    if (tier === 0) T.cyl(v3(d0 + 0.1, belt - 0.02, zin(0.03)), v3(d0 + 0.1, belt + 0.02, zin(0.03)), 0.005, 0.0045, [.15, .15, .16], MATTE, 0, 8);
    if (tier === 1) { const sp = v3(xf0 - 1.25, belt - 0.05, zin(0.012)); T.box(sp.x, sp.y, sp.z - 0.006, sp.x + 0.05, sp.y + 0.008, sp.z + 0.006, P.metal, 0, BRUSHED); T.obox(sp.clone().add(v3(-0.005, 0.025, 0)), 0.008, 0.045, 0.012, Qz(0.2), P.metal, 0, BRUSHED); T.box(sp.x - 0.015, sp.y + 0.048, sp.z - 0.006, sp.x - 0.005, sp.y + 0.06, sp.z + 0.006, P.metal, 0, BRUSHED); }
    // the release behind the handle: a metal surround
    T.box(xf0 - 0.97, belt - 0.13, zin(0.002), xf0 - 0.8, belt - 0.07, zin(0), tier >= 1 ? P.metal : [.12, .12, .13], tier >= 1 ? 0 : MATTE, tier >= 1 ? BRUSHED : 0);
    if (tm) tm.add(T.mesh(mats.solid));
    // and on the back doors, the same that stays with the body
    if (four) {
      const xr0 = Math.max(xb, D.x0 - 0.95), xr1 = D.x0 - 0.06;
      if (xr1 - xr0 > 0.3) {
        B.disc(v3(xr0 + 0.16, fl + 0.19, zin(0.004)), n, 0.055, tier === 1 ? P.metal : [.05, .05, .055], tier === 1 ? 0 : MATTE, tier === 1 ? BRUSHED : PERF, 24);
        B.box(xr0 + 0.05, belt - 0.32, zin(0.11), xr1 - 0.1, belt - 0.26, zin(0.0), P.arm);
        B.box(xr1 - 0.25, belt - 0.12, zin(0.03), xr1 - 0.13, belt - 0.08, zin(0.0), [.5, .5, .52], 0, BRUSHED);
        if (wind || kind === 'wagonr') crank(B, xr0 + 0.3, belt - 0.2); else B.box(xr1 - 0.3, belt - 0.262, zin(0.1), xr1 - 0.25, belt - 0.255, zin(0.06), [.1, .1, .11]);
        if (tier === 1) B.box(xr0 + 0.05, belt - 0.11, zin(0.006), xr1 - 0.05, belt - 0.07, zin(0), P.decor, 0, WOOD);
        if (tier === 0) B.cyl(v3(xr1 - 0.05, belt - 0.02, zin(0.03)), v3(xr1 - 0.05, belt + 0.02, zin(0.03)), 0.005, 0.0045, [.15, .15, .16], MATTE, 0, 8);
      }
    }
  }

  // ------------------------------------------------------------ the wheel
  const tw = new THREE.Group();
  tw.quaternion.copy(pivot.quaternion.clone().invert().multiply(qCol));
  const flatB = tier === 3, rimT = tier >= 2 ? 0.019 : tier === 1 ? 0.0175 : 0.0165;
  const rimC = tier === 3 ? [.05, .05, .055] : P.wheel, rimP = tier === 3 ? SUEDE : 0;
  if (flatB) { const pts = []; for (let i = 0; i < 64; i++) { const a = i/64*Math.PI*2; pts.push(v3(Math.sin(a)*R, Math.max(-0.8*R, Math.cos(a)*R), 0)); } W.tube(pts, rimT, rimC, MATTE, rimP, true, 96, 10); }
  else W.ring(v3(0, 0, 0), ZZ, R, rimT, rimC, MATTE, rimP, Math.PI*2, 0, 10, 56);
  const arcOn = (mid, half, t, c, glow, paint) => W.ring(v3(0, 0, 0), ZZ, R, t, c, glow, paint, half*2, mid - half, 10, 24);
  if (tier === 3) { arcOn(0, 0.55, rimT + 0.0007, [.06, .06, .065], MATTE, PERF); arcOn(Math.PI, 0.55, rimT + 0.0007, [.06, .06, .065], MATTE, PERF); arcOn(Math.PI/2, 0.07, rimT + 0.001, P.accent, MATTE, 0); }
  if (tier === 2) { arcOn(Math.PI/2, 0.05, rimT + 0.001, P.accent, MATTE, 0); arcOn(0, 0.6, rimT + 0.0005, [.07, .07, .075], MATTE, PERF); arcOn(Math.PI, 0.6, rimT + 0.0005, [.07, .07, .075], MATTE, PERF); }
  if (tier === 1) { arcOn(Math.PI/2, 0.7, rimT + 0.0008, P.decor, 0, WOOD); arcOn(-Math.PI/2, 0.7, rimT + 0.0008, P.decor, 0, WOOD); }
  if (tier === 0) for (const s of [-1, 1]) W.sph(v3(s*R*Math.sin(1.15), R*Math.cos(1.15), 0.004), 0.021, P.wheel, MATTE, 0, 1, 1.6, 1, 10, Qz(-s*1.15 - Math.PI/2));
  // spokes
  const spC = tier === 3 ? [.07, .07, .075] : tier === 2 ? [.08, .08, .085] : P.wheel, spG = tier === 3 ? 0 : MATTE, spP = tier === 3 ? CARBON : 0;
  for (const s of [-1, 1]) {
    if (tier === 1) for (const dy of [-0.014, 0.014]) W.obox(v3(s*0.115, -0.02 + dy, -0.016), 0.12, 0.011, 0.012, Qz(s*-0.1), P.metal, 0, BRUSHED);
    else W.obox(v3(s*0.112, -0.022, -0.018), 0.13, 0.045, 0.018, Qz(s*-0.1), spC, spG, spP);
    if (tier === 2) W.obox(v3(s*0.115, -0.022, -0.008), 0.1, 0.012, 0.004, Qz(s*-0.1), P.metal, 0, BRUSHED);
  }
  const yB = flatB ? -0.8*R : -R;
  W.obox(v3(0, (yB - 0.03)/2 - 0.005, -0.018), 0.05, -yB - 0.03, 0.016, Q0, spC, spG, spP);
  // the hub, its pad, a plain badge
  const hubC = tier === 1 ? P.wheel : tier >= 2 ? [.06, .06, .065] : [.09, .09, .095];
  if (tier === 3) W.ext(poly(hexPts(0.068, 1.15)), 0.028, mT(0, -0.01, -0.03), hubC, MATTE, SUEDE, 0.006);
  else W.ext(rrect(tier >= 1 ? 0.115 : 0.13, tier >= 1 ? 0.09 : 0.095, tier >= 1 ? 0.04 : 0.035), 0.03, mT(0, -0.008, -0.03), hubC, MATTE, 0, 0.006);
  if (tier === 1) W.ring(v3(0, -0.004, 0.0075), ZZ, 0.016, 0.0022, P.metal, 0, BRUSHED, Math.PI*2, 0, 6, 24);
  else W.disc(v3(0, -0.004, 0.0075), ZZ, tier >= 2 ? 0.013 : 0.014, tier >= 2 ? [.08, .08, .085] : P.metal, 0, BRUSHED, 20);
  // buttons on the spokes
  const btns = tier >= 1 || (modern && !/^(alto|wagonr|bolero|taxi)$/.test(kind));
  if (btns) for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const bx = s*(0.072 + (i % 2)*0.022), by = -0.012 - Math.floor(i/2)*0.02;
    if (tier === 1) W.ext(rrect(0.018, 0.015, 0.004), 0.003, mT(bx, by, -0.008), P.piano, 0);
    else W.box(bx - 0.008, by - 0.006, -0.009, bx + 0.008, by + 0.006, -0.004, [.1, .1, .11]);
    W.box(bx - 0.003, by - 0.0006, -0.0035, bx + 0.003, by + 0.0006, -0.003, [.85, .85, .85], 0.3);
  }
  if (tier === 3) {
    // the indicator buttons and the high beam on the left spoke, the wipers on the right
    for (const [bx, by, c] of [[-0.075, -0.004, [.15, .15, .16]], [-0.075, -0.026, [.15, .15, .16]], [-0.098, -0.015, [.15, .15, .16]], [0.085, -0.015, [.15, .15, .16]]]) { W.box(bx - 0.009, by - 0.007, -0.007, bx + 0.009, by + 0.007, -0.001, c); W.box(bx - 0.004, by - 0.001, -0.0008, bx + 0.004, by + 0.001, 0, [.9, .9, .9], 0.3); }
  }
  // the mode on the wheel: the Huracán's toggle on its bottom spoke, the 911's dial
  if (tier === 3 && modes) {
    W.box(-0.03, yB + 0.03, -0.012, 0.03, yB + 0.06, 0.004, [.05, .05, .055]);
    const lab = screen(0.05, 0.011, 200, mT(0, yB + 0.037, 0.0042)); onWheel.push(lab.m);
    const Lv = new K(); Lv.box(-0.004, -0.004, 0, 0.004, 0.012, 0.012, [.72, .73, .75], 0, BRUSHED); Lv.box(-0.006, 0.01, 0.006, 0.006, 0.015, 0.014, [.8, .06, .05]);
    const lev = Lv.mesh(mats.solid); lev.position.set(0, yB + 0.05, 0.004); onWheel.push(lev);
    lit.set.push((m, i) => {
      lev.position.x = (i - 1)*0.014; lev.rotation.z = -(i - 1)*0.35;
      const { ctx, W: w, H: h } = lab; ctx.fillStyle = '#050506'; ctx.fillRect(0, 0, w, h); ctx.font = '700 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      modes.forEach((n, j) => { ctx.fillStyle = j === i ? modeCol(n) : '#444'; ctx.fillText(n.toUpperCase(), w*(j + 0.5)/modes.length, h/2); });
      lab.tex.needsUpdate = true;
    });
    // shift lights over the hub
    const leds = [0, 1, 2, 3, 4].map(i => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.005, 0.003), lamp(0x111111)); m.position.set((i - 2)*0.011, 0.05, -0.012); onWheel.push(m); return m; });
    C._leds = leds;
    W.box(-0.032, 0.045, -0.016, 0.032, 0.055, -0.012, [.03, .03, .035]);
  }
  if (tier === 2 && modes) {
    const dp = v3(0.068, -0.075, -0.003);
    W.cyl(dp.clone().add(v3(0, 0, -0.01)), dp, 0.023, 0.023, [.05, .05, .055], MATTE, 0, 24);
    W.ring(dp, ZZ, 0.021, 0.003, P.metal, 0, BRUSHED, Math.PI*2, 0, 6, 28);
    const face = screen(0.036, 0.036, 128, mT(dp.x, dp.y, dp.z + 0.0005)); face.m.geometry.dispose(); face.m.geometry = new THREE.CircleGeometry(0.018, 28); onWheel.push(face.m);
    const Pk = new K(); Pk.box(-0.0015, 0.008, 0.0006, 0.0015, 0.018, 0.0016, [.9, .9, .9]); Pk.cyl(v3(0, 0, 0), v3(0, 0, 0.004), 0.007, 0.007, [.6, .07, .06], MATTE, 0, 14);
    const ptr = Pk.mesh(mats.solid); ptr.position.copy(dp); onWheel.push(ptr);
    const n = modes.length, angs = modes.map((_, i) => (i - (n - 1)/2)*0.75);
    lit.set.push((m, i) => {
      ptr.rotation.z = -angs[i];
      const { ctx, W: w } = face, c = w/2; ctx.fillStyle = '#0a0a0b'; ctx.fillRect(0, 0, w, w); ctx.font = '700 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      modes.forEach((nm, j) => { const a = angs[j] - Math.PI/2; ctx.fillStyle = j === i ? modeCol(nm) : '#777'; ctx.fillText(nm === 'Normal' ? 'N' : nm === 'Sport' ? 'S' : nm === 'Sport+' ? 'S+' : nm === 'Wet' ? 'W' : nm[0], c + Math.cos(a)*44, c + Math.sin(a)*44); });
      face.tex.needsUpdate = true;
    });
    for (const s of [-1, 1]) W.obox(v3(s*0.125, 0.035, -0.036), 0.06, 0.075, 0.006, Qz(s*0.25), P.metal, 0, BRUSHED);
  }
  if (tier === 1) for (const s of [-1, 1]) W.obox(v3(s*0.12, 0.03, -0.034), 0.035, 0.05, 0.005, Qz(s*0.25), P.metal, 0, BRUSHED);

  // ------------------------------------------------------------ in it goes; the plain pieces it replaces come out
  const cut = (mesh, boxes) => {
    const g = mesh.geometry, p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count, keep = [], e = 0.003;
    const inside = (i, b) => { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); return x >= b[0] - e && x <= b[3] + e && y >= b[1] - e && y <= b[4] + e && z >= b[2] - e && z <= b[5] + e; };
    for (let t = 0; t < n; t += 3) { const a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2; if (!boxes.some(bx => inside(a, bx) && inside(b, bx) && inside(c, bx))) keep.push(a, b, c); }
    g.setIndex(keep);
  };
  const boxes = [[xs - 0.62, fl + 0.15, DZ - 0.245, xs + 0.27, fl + 1.3, DZ + 0.245], [xs - 0.62, fl + 0.15, -DZ - 0.245, xs + 0.27, fl + 1.3, -DZ + 0.245],
    [xf0 - 1.7, fl - 0.01, -0.11, xf0 - 0.5, fl + 0.7, 0.11], [xf0 - 0.67, fl + 0.25, -(hw - 0.11), xf0 - 0.47, belt + 0.001, hw - 0.11]];
  if (rear) { const xr = Math.max(xb, S.roofR - 0.45); boxes.push([xr - 0.03, fl + 0.19, -(hw - 0.14), xr + 0.56, H, hw - 0.14]); }
  // (everything new is built first: if any of it fails, the plain cabin stays whole)
  const newCab = B.mesh(mats.solid), wheel = W.mesh(mats.solid);
  cut(cab, boxes);
  const recol = (mesh, map) => {
    const c = mesh.geometry.attributes.color; if (!c) return;
    const L = map.map(([f, t]) => [f.map(lin), t.map(lin)]);
    for (let i = 0; i < c.count; i++) for (const [f, t] of L) if (Math.abs(c.getX(i) - f[0]) < 1e-3 && Math.abs(c.getY(i) - f[1]) < 1e-3 && Math.abs(c.getZ(i) - f[2]) < 1e-3) { c.setXYZ(i, t[0], t[1], t[2]); break; }
    c.needsUpdate = true;
  };
  const map = [[[0.2, 0.19, 0.18], P.trim], [[0.58, 0.53, 0.45], P.arm], [[0.11, 0.105, 0.1], P.carpet], [[0.17, 0.16, 0.15], P.top]];
  for (const m of [cab, hood, ...tl]) recol(m, map);
  {
    // the dash itself: its top and its face in this car's own finish
    const g = dash.geometry, nr = g.attributes.normal, c = g.attributes.color, N = nr.count, gl = new Float32Array(N), pt = new Float32Array(N), tc = P.top.map(lin), fc = P.face.map(lin);
    for (let i = 0; i < N; i++) { const up = nr.getY(i) > 0.5; const t = up ? tc : fc; c.setXYZ(i, t[0], t[1], t[2]); gl[i] = up ? P.topG : MATTE; pt[i] = up ? P.topP : P.faceP; }
    c.needsUpdate = true; g.setAttribute('glow', new THREE.BufferAttribute(gl, 1)); g.setAttribute('paint', new THREE.BufferAttribute(pt, 1));
  }
  if (tier >= 1) hood.visible = false;
  for (const f of flats) f.visible = false;
  spin.children[0].visible = false;
  G.add(newCab);
  for (const m of extra) G.add(m);
  tw.add(wheel); for (const m of onWheel) tw.add(m); spin.add(tw);

  // ------------------------------------------------------------ live: the cluster, the mode
  let cur = null, last = performance.now();
  const st0 = { tag: '', dist: 0, odo: Math.round(12000 + rh*70000 + (kind === 'taxi' ? 190000 : 0)), corsaT: 0, prevK: 0, lat: 0, lon: 0 };
  C.mode = (name) => {
    name = name || (modes ? modes[0] : '');
    if (name === cur) return; cur = name;
    const i = Math.max(0, modes ? modes.indexOf(name) : 0);
    for (const f of lit.set) f(name, i);
    if (C._amb) C._amb.color.set(modeCol(name));
    st0.corsaT = 0;
  };
  C.mode('');
  // a layer of glass over each screen, catching the light like the real ones
  const sg = cabinGlass({ side: THREE.FrontSide, tint: 0x0a0c0e });
  // (in a group of their own: they share their screens' shape, which the cabin fitting already keeps under the roof)
  const SG = new THREE.Group(); G.add(SG);
  for (const S2 of C._scr || []) if (S2 && S2.m) { const o = new THREE.Mesh(S2.m.geometry, sg); o.position.copy(S2.m.position); o.quaternion.copy(S2.m.quaternion); o.scale.copy(S2.m.scale); o.translateZ(0.0015); o.renderOrder = 3; SG.add(o); }
  // the mirrors: the one on the windscreen, and (once the body's measured) the two on the doors
  const MG = new THREE.Group(); G.add(MG); C._mg = MG; MG.visible = false;
  { const I = C._irvm, r = mirror(I.w, I.h, tier >= 2 ? 1024 : 768, tier >= 2 ? 256 : 196, 0, 'rect', tier >= 2 ? 2 : 3); r.matrixAutoUpdate = false; r.matrix.copy(I.M).multiply(mT(0, 0, 0.0035)); MG.add(r); }
  const Eye = v3(xf0 - 1.25, belt + 0.19, DZ), glassM = cabinGlass({ wip: [belt + 0.02, -0.34*hw/0.875, 0.2*hw/0.875, 0.56*hw/0.875], band: [H - 0.22, H - 0.12, 1], tint: tier === 3 ? 0x161c1b : 0x1c2624 });
  C.tick = (v) => {
    C._v = v;
    C.mode(v._modeName || '');
    MG.visible = !!v.inCockpit;
    if (!C._orvm && v.bodyMesh) { C._orvm = true; try { doorMirrors(v, MG, Eye, hw, belt, xf0); } catch (e) { /* (no glass found: no mirror) */ } }
    // the windows' inside, kept to the body as it is (dents, a door hung open on its own hinge). Made the first time
    // you're in this car (from outside the windows are their own outside, and nobody sees the inside of them)
    if (!v.inCockpit && !C._glass) return;
    if (!v.inCockpit && C._gOut) return; C._gOut = !v.inCockpit;
    C._glass = true;
    // (from the seat the windows are these inside panes, with the wipers' arcs and the dust on them: the outside of the
    // glass isn't drawn over them)
    const gmat = v.glassMesh && v.glassMesh.material;
    v.tilt.traverse((m) => { if (m.isMesh && gmat && m.material === gmat && !m.userData.cgPane) m.visible = !v.inCockpit; });
    v.tilt.traverse((m) => {
      if (!m.isMesh || !m.geometry.attributes.paint || !(m.material === v.bodyMesh.material || (gmat && m.material === gmat))) return;
      let g = m.userData.cg;
      // (beside the pane it's the inside of, not under it: the pane itself is hidden from the seat)
      if (!g) { g = m.userData.cg = { mesh: new THREE.Mesh(new THREE.BufferGeometry(), glassM), geo: null, ver: -1 }; g.mesh.frustumCulled = false; g.mesh.renderOrder = 2; g.mesh.userData.cgPane = true; (m.parent || m).add(g.mesh); if (m.parent) { g.mesh.position.copy(m.position); g.mesh.quaternion.copy(m.quaternion); g.mesh.scale.copy(m.scale); } }
      const pv = m.geometry.attributes.position.version;
      if (g.geo !== m.geometry || g.ver !== pv) { g.geo = m.geometry; g.ver = pv; g.mesh.geometry.dispose(); g.mesh.geometry = innerGlass(m.geometry, belt, hw, xf0); }
    });
  };
  const u0 = C.update;
  let wasOff = true, sweep = 0;
  const vTop = [190, 260, 330, 340][tier];
  C.update = function (steer, kmh, gear, rpm, night, mode) {
    u0.call(this, steer, kmh, gear, rpm, night, mode);
    const now = performance.now(), dt = Math.min(0.1, (now - last)/1000); last = now;
    C.mode(mode);
    st0.dist += kmh/3.6*dt; st0.corsaT += dt;
    st0.lon += ((kmh - st0.prevK)/3.6/Math.max(dt, 1e-3)/9.81 - st0.lon)*Math.min(1, dt*4); st0.prevK = kmh;
    st0.lat += (Math.max(-1.6, Math.min(1.6, (steer || 0)*(kmh/3.6)**2/9.81*0.09)) - st0.lat)*Math.min(1, dt*4);
    if (C._leds) { const on = [0.62, 0.72, 0.8, 0.87, 0.93], col = ['#2bd46a', '#2bd46a', '#ffc21a', '#ff3b30', '#ff3b30'], blink = rpm > 0.96 && (now % 200) < 100; C._leds.forEach((l, j) => l.material.color.set(blink ? '#3a7bff' : rpm >= on[j] ? col[j] : '#111111')); }
    // the car itself: the engine off (a dark cluster), starting (the needles sweep round and back), the indicators, the
    // pedals under your feet, the gear lever in its gate
    const v = C._v, off = !!(v && (v._off || v._crank > 0)), I = v && v._ind;
    if (wasOff && !off) sweep = 1.3;
    wasOff = off;
    let kD = kmh, rD = rpm;
    if (sweep > 0) { sweep -= dt; const f = Math.sin(Math.max(0, Math.min(1, 1 - sweep/1.3))*Math.PI); kD = Math.max(kmh, vTop*f); rD = Math.max(rpm, f); }
    const blink = I && (I.s || I.haz) && Math.floor((now - I.t0)/353) % 2 === 0, il = blink && (I.s < 0 || I.haz), ir = blink && (I.s > 0 || I.haz);
    st0.tag = (off ? 'off' : 'on') + (il ? 'L' : '') + (ir ? 'R' : '');
    if (stalk) { const a = I && I.s ? I.s*0.13 : 0; stalk.quaternion.copy(qCol).multiply(Qz(a)); }
    if (v) for (const p of pedals) {
      const f = p.what === 'thr' ? (v.throttle || 0) : p.what === 'brk' ? (v.brake || 0) : (v.shiftT > 0 ? 1 : 0);
      p.f = (p.f || 0) + (f - (p.f || 0))*Math.min(1, dt*14);
      p.m.rotation.z = p.organ ? -0.22*p.f : (p.what === 'clu' ? 0.4 : 0.3)*p.f;
    }
    if (C._gear) {
      const g = gear | 0, col = g > 0 ? Math.min(2, Math.floor((g - 1)/2)) : 1, fw = g > 0 ? ((g - 1) % 2 === 0 ? -1 : 1) : 0, rev = v && v.reverse;
      const tx = rev ? 0.2 : g > 0 ? (col - 1)*0.17 : 0, tz = rev ? 0.24 : fw*0.24;
      C._gear.rotation.x += (tx - C._gear.rotation.x)*Math.min(1, dt*16); C._gear.rotation.z += (tz - C._gear.rotation.z)*Math.min(1, dt*16);
    }
    const cl = C._cl;
    if (off) {
      if (cl && cl._dark !== st0.tag) { cl._dark = st0.tag; const { ctx, W: w, H: h } = cl; ctx.fillStyle = '#030304'; ctx.fillRect(0, 0, w, h); if (il || ir) arrows(ctx, w, h, il, ir); cl.tex.needsUpdate = true; }
      if (C._meter) meter(C._meter, st0);
      return;
    }
    if (cl) cl._dark = null;
    const v0 = cl ? cl.tex.version : 0;
    if (C._draw) C._draw(kD, gear, rD, cur || '', st0);
    if (cl && cl.tex.version !== v0 && (il || ir)) { arrows(cl.ctx, cl.W, cl.H, il, ir); cl.tex.needsUpdate = true; }
    if (C._meter) meter(C._meter, st0);
  };
}

// ---------------------------------------------------------------- the glass and the mirrors
// the inside of a body's windows: its glass triangles (paint 4) above the waist, inside the body's width (not the door
// mirrors' glass, not the lamps' lenses ahead of the windscreen), a hair in from the outside
function innerGlass(src, belt, hw, xf0) {
  const P = src.attributes.position, N = src.attributes.normal, Pt = src.attributes.paint, ix = src.index, n = ix ? ix.count : P.count, pos = [], nor = [];
  const ok = (i) => { const p = Pt.getX(i); return p > 3.5 && p < 4.5 && P.getY(i) > belt - 0.12 && Math.abs(P.getZ(i)) < hw + 0.01 && P.getX(i) < xf0 + 0.15; };
  for (let t = 0; t < n; t += 3) {
    const a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2;
    if (!ok(a) || !ok(b) || !ok(c)) continue;
    for (const i of [a, b, c]) { pos.push(P.getX(i) - N.getX(i)*0.003, P.getY(i) - N.getY(i)*0.003, P.getZ(i) - N.getZ(i)*0.003); nor.push(N.getX(i), N.getY(i), N.getZ(i)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
// a mirror that really shows what's behind you. Each draws its picture every third frame, in turn with the others (so
// together they cost one small extra look at the street), and never from inside another's picture or a shadow pass
let MIRRORING = false;
// shape: 'oval' (a low car's lens), 'round' (a door mirror's glass: a rectangle with well rounded corners), or a plain
// rectangle with small ones (the one on the screen), so the picture is the glass's own shape and not a block in it
function mirror(w, h, tw, th, slot, shape, every = 3) {
  const geo = shape === 'oval' ? new THREE.CircleGeometry(0.5, 48).scale(w, h, 1) : new THREE.ShapeGeometry(rrect(w, h, shape === 'round' ? Math.min(w, h)*0.42 : Math.min(w, h)*0.22), 12);
  // (ShapeGeometry's uv is its own x and y: the reflection's drawn by where it is on the screen, not by uv)
  const r = new Reflector(geo, { clipBias: 0.003, textureWidth: tw, textureHeight: th, color: 0xc4c9cc, multisample: 4 });
  const ob = r.onBeforeRender; let k = slot;
  r.onBeforeRender = function (rd, sc, cam, ...a) {
    if (MIRRORING || !cam || !cam.isPerspectiveCamera || (k++ % every) !== 0) return;
    // (the streets behind you were left out of your own picture, world/view.js: the mirror looks exactly there, so they're
    // back before it draws. Your picture's list is already made by now, so nothing's added to it)
    MIRRORING = true; showAll(); try { ob.call(this, rd, sc, cam, ...a); } finally { MIRRORING = false; }
  };
  r.castShadow = false; r.receiveShadow = false; r.frustumCulled = false;
  return r;
}
// the door mirrors: found where the body has its mirror glass, out past the doors, each turned so you see the road
// behind down your own side
function doorMirrors(v, MG, Eye, hw, belt, xf0) {
  const g = v.bodyMesh.geometry, P = g.attributes.position, Pt = g.attributes.paint, Cl = g.attributes.color; if (!Pt) return;
  const bb = { '-1': null, 1: null };
  // (the everyday cars' mirrors are window glass; the low cars' are a shaped lens of their own colour)
  const lens = (i) => Cl && Math.abs(Cl.getX(i) - 0.214) < 0.004 && Math.abs(Cl.getY(i) - 0.264) < 0.004 && Math.abs(Cl.getZ(i) - 0.319) < 0.004;
  for (const pass of [0, 1]) for (let i = 0; i < P.count; i++) {
    const p = Pt.getX(i), x = P.getX(i), y = P.getY(i), z = P.getZ(i), s = z < 0 ? '-1' : 1;
    if (pass && bb[s] && !bb[s].lens) continue;
    if (pass ? !lens(i) || Math.abs(z) < hw - 0.15 || x < xf0 - 1.3 : !(p > 3.5 && p < 4.5) || Math.abs(z) < hw - 0.02 || x < xf0 - 1.0) continue;
    if (y < belt - 0.15 || x > xf0 + 0.4) continue;
    const b = bb[s] || (bb[s] = { x0: 9, x1: -9, y0: 9, y1: -9, z0: 9, z1: -9, lens: pass });
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z);
  }
  let slot = 1;
  for (const b of Object.values(bb)) {
    if (!b || b.z1 - b.z0 < 0.04 || b.y1 - b.y0 < 0.03) continue;
    const c = v3(b.x0, (b.y0 + b.y1)/2, (b.z0 + b.z1)/2), n = Eye.clone().sub(c).normalize().add(v3(-1, 0, 0)).normalize();
    const w = (b.z1 - b.z0)*0.92, h = (b.y1 - b.y0)*0.9, sup = b.lens, tw = sup ? 512 : 384;
    const X = UP.clone().cross(n).normalize(), Y = n.clone().cross(X), r = mirror(w, h, tw, Math.max(96, Math.round(tw*h/w)), slot++, b.lens ? 'oval' : 'round', sup ? 2 : 3);
    r.matrixAutoUpdate = false; r.matrix.makeBasis(X, Y, n).setPosition(c.addScaledVector(n, 0.004)); MG.add(r);
  }
}
function arrows(c, w, h, l, r) {
  c.fillStyle = '#2bd46a';
  const a = (x, d) => { const s = h*0.09; c.beginPath(); c.moveTo(x + d*s*1.6, h*0.1); c.lineTo(x, h*0.1 - s); c.lineTo(x, h*0.1 - s*0.45); c.lineTo(x - d*s*1.2, h*0.1 - s*0.45); c.lineTo(x - d*s*1.2, h*0.1 + s*0.45); c.lineTo(x, h*0.1 + s*0.45); c.lineTo(x, h*0.1 + s); c.closePath(); c.fill(); };
  if (l) a(w*0.06, -1); if (r) a(w*0.94, 1);
}

// ---------------------------------------------------------------- the clusters
const hourNow = () => { const h = window.__nhAskG && window.__nhAskG.hour; return typeof h === 'number' ? h : 12; };
const hhmm = () => { const h = hourNow(), H = Math.floor(h) % 24, M = Math.floor((h % 1)*60); return String(H).padStart(2, '0') + ':' + String(M).padStart(2, '0'); };
function dialFace(b, cx, cy, R, max, step, red, o = {}) {
  const A0 = o.a0 ?? Math.PI*0.75, SW = o.sw ?? Math.PI*1.5;
  if (o.fill !== false) { const g = b.createRadialGradient(cx, cy, R*0.1, cx, cy, R*1.05); g.addColorStop(0, o.c0 || '#16191d'); g.addColorStop(1, o.c1 || '#060708'); b.fillStyle = g; b.beginPath(); b.arc(cx, cy, R*1.03, 0, 7); b.fill(); }
  if (red) { b.strokeStyle = o.redC || '#c0262b'; b.lineWidth = R*0.08; b.beginPath(); b.arc(cx, cy, R*0.9, A0 + SW*red, A0 + SW); b.stroke(); }
  for (let v = 0, i = 0; v <= max + 1e-6; v += step/(o.sub || 2), i++) {
    const a = A0 + SW*v/max, major = i % (o.sub || 2) === 0;
    b.strokeStyle = major ? (o.tc || '#eef2f5') : '#7d868f'; b.lineWidth = major ? Math.max(2, R*0.03) : Math.max(1, R*0.015);
    b.beginPath(); b.moveTo(cx + Math.cos(a)*R*(major ? 0.8 : 0.86), cy + Math.sin(a)*R*(major ? 0.8 : 0.86)); b.lineTo(cx + Math.cos(a)*R*0.95, cy + Math.sin(a)*R*0.95); b.stroke();
    if (major && o.labels !== false) { b.fillStyle = o.tc || '#eef2f5'; b.font = `600 ${Math.round(R*0.16)}px system-ui, sans-serif`; b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillText(String(Math.round(v*(o.mul || 1))), cx + Math.cos(a)*R*0.64, cy + Math.sin(a)*R*0.64); }
  }
  return (ctx, f, col = '#ff5a1f') => {
    const a = A0 + SW*Math.max(0, Math.min(1.02, f));
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, R*0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - Math.cos(a)*R*0.14, cy - Math.sin(a)*R*0.14); ctx.lineTo(cx + Math.cos(a)*R*0.9, cy + Math.sin(a)*R*0.9); ctx.stroke();
    ctx.fillStyle = '#22262b'; ctx.beginPath(); ctx.arc(cx, cy, R*0.11, 0, 7); ctx.fill();
  };
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const gearTxt = (g, AT) => (g > 0 ? (AT ? 'D' : '') + g : 'N');

// the everyday car's: rev counter, speedometer, the little screen between them; and its radio or touchscreen
function analog(s, vmax, kind, AT, scr, taxi, modes) {
  const { ctx, W, H } = s, bg = document.createElement('canvas'); bg.width = W; bg.height = H; const b = bg.getContext('2d');
  b.fillStyle = '#030405'; b.fillRect(0, 0, W, H);
  const R = H*0.44, cy = H*0.53, tach = dialFace(b, W*0.2, cy, R, 7, 1, 6/7), spd = dialFace(b, W*0.8, cy, R, vmax, vmax > 180 ? 40 : 20, 0, { sub: 4 });
  b.fillStyle = '#7d868f'; b.font = `500 ${Math.round(R*0.11)}px system-ui, sans-serif`; b.textAlign = 'center';
  b.fillText('x1000 r/min', W*0.2, cy + R*0.42); b.fillText('km/h', W*0.8, cy + R*0.42);
  b.fillStyle = '#0a1418'; rr(b, W*0.385, H*0.12, W*0.23, H*0.78, 10); b.fill();
  // the fuel and temperature bars down the sides of the middle screen, the usual lamps
  let key = '';
  const sc = scr ? (() => { const { ctx: c, W: w, H: h } = scr, g = c.createLinearGradient(0, 0, w, h); return { c, w, h, g }; })() : null;
  const fuel = 0.35 + hash(kind + 'f')*0.6;
  return (kmh, gear, rpm, mode, st) => {
    const k2 = Math.round(kmh) + '|' + Math.round(rpm*60) + '|' + gear + '|' + mode + '|' + hhmm() + '|' + Math.floor(st.dist/100);
    if (k2 + st.tag === key) return; key = k2 + st.tag;
    ctx.drawImage(bg, 0, 0);
    tach(ctx, Math.min(1, rpm*0.93)); spd(ctx, kmh/vmax);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cfe9f5'; ctx.font = `600 ${Math.round(H*0.11)}px ui-monospace, Menlo, monospace`; ctx.fillText(hhmm(), W*0.5, H*0.2);
    ctx.fillStyle = '#f2b705'; ctx.font = `700 ${Math.round(H*0.3)}px system-ui, sans-serif`; ctx.fillText(gearTxt(gear, AT), W*0.5, H*0.47);
    if (mode) { ctx.fillStyle = modeCol(mode); ctx.font = `700 ${Math.round(H*0.1)}px system-ui, sans-serif`; ctx.fillText(String(mode).toUpperCase(), W*0.5, H*0.68); }
    ctx.fillStyle = '#8fb4c4'; ctx.font = `500 ${Math.round(H*0.075)}px ui-monospace, Menlo, monospace`; ctx.fillText('ODO ' + (st.odo + Math.floor(st.dist/1000)) + ' km', W*0.5, H*0.82);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i < Math.round(fuel*6) ? '#cfe9f5' : '#1d2c33'; ctx.fillRect(W*0.395, H*(0.78 - i*0.1), W*0.012, H*0.07); ctx.fillStyle = i < 3 ? '#cfe9f5' : '#1d2c33'; ctx.fillRect(W*0.593, H*(0.78 - i*0.1), W*0.012, H*0.07); }
    if (rpm < 0.02) { ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(W*0.2, cy + R*0.6, H*0.025, 0, 7); ctx.fill(); }
    s.tex.needsUpdate = true;
    if (sc && (sc._k !== mode + hhmm())) {
      sc._k = mode + hhmm();
      const { c, w, h } = sc;
      if (w > 200) {
        // the touchscreen: a map, the time, the drive mode in its own tile
        c.fillStyle = '#0d1a22'; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#25414f'; c.lineWidth = 6; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(0, h*hash(kind + i)); c.lineTo(w, h*hash(kind + 'b' + i)); c.stroke(); }
        c.strokeStyle = '#3d8bd9'; c.lineWidth = 8; c.beginPath(); c.moveTo(w*0.5, h); c.lineTo(w*0.5, h*0.55); c.lineTo(w*0.75, h*0.25); c.stroke();
        c.fillStyle = '#eef3f6'; c.beginPath(); c.moveTo(w*0.5, h*0.72); c.lineTo(w*0.47, h*0.82); c.lineTo(w*0.53, h*0.82); c.fill();
        c.fillStyle = 'rgba(8,14,18,0.85)'; c.fillRect(0, 0, w, h*0.18);
        c.fillStyle = '#eef3f6'; c.font = `600 ${Math.round(h*0.12)}px system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(hhmm(), 8, h*0.09);
        if (mode) { c.fillStyle = modeCol(mode); c.textAlign = 'right'; c.fillText(String(mode).toUpperCase(), w - 8, h*0.09); }
      } else {
        c.fillStyle = '#071012'; c.fillRect(0, 0, w, h); c.fillStyle = '#7fe0ff'; c.font = `600 ${Math.round(h*0.62)}px ui-monospace, Menlo, monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(mode ? String(mode).toUpperCase() : 'FM 93.5', w/2, h/2);
      }
      scr.tex.needsUpdate = true;
    }
  };
}
// the taxi's meter: the flag fare, then by the kilometre after the first one and a half
function meter(s, st) {
  const km = st.dist/1000, fare = 28 + Math.max(0, km - 1.5)*18.66, t = fare.toFixed(2);
  if (s._t === t) return; s._t = t;
  const { ctx, W, H } = s; ctx.fillStyle = '#100403'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff3a1f'; ctx.font = `700 ${Math.round(H*0.8)}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(t, W - 6, H/2);
  ctx.font = `600 ${Math.round(H*0.35)}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('HIRED', 4, H*0.3);
  s.tex.needsUpdate = true;
}
function mapPhone(s) {
  const { ctx: c, W: w, H: h } = s;
  c.fillStyle = '#e9e5dc'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#ffffff'; c.lineWidth = 9; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, h*(0.1 + i*0.17)); c.lineTo(w, h*(0.05 + i*0.2)); c.stroke(); c.beginPath(); c.moveTo(w*(0.2 + i*0.15), 0); c.lineTo(w*(0.1 + i*0.17), h); c.stroke(); }
  c.strokeStyle = '#4a8af4'; c.lineWidth = 7; c.beginPath(); c.moveTo(w*0.5, h*0.85); c.lineTo(w*0.5, h*0.5); c.lineTo(w*0.8, h*0.3); c.lineTo(w*0.8, 0); c.stroke();
  c.fillStyle = '#1a73e8'; c.beginPath(); c.arc(w*0.5, h*0.85, 8, 0, 7); c.fill();
  c.fillStyle = '#0f5132'; c.fillRect(0, 0, w, h*0.12); c.fillStyle = '#fff'; c.font = `600 ${Math.round(h*0.05)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('↱ 200 m', w/2, h*0.06);
  s.tex.needsUpdate = true;
}
// the E-Class-style's one glass: the screen on the left, the two dials on the right, in the mode's colour
function luxScreen(s, amb) {
  const { ctx, W, H } = s, bgs = new Map();
  const bgFor = (col) => {
    if (bgs.has(col)) return bgs.get(col);
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const b = bg.getContext('2d');
    b.fillStyle = '#05080b'; b.fillRect(0, 0, W, H);
    // the map side
    b.fillStyle = '#0c1820'; b.fillRect(8, 8, W*0.47, H - 16);
    b.strokeStyle = '#1e3644'; b.lineWidth = 8; for (let i = 0; i < 9; i++) { b.beginPath(); b.moveTo(8, 8 + (H - 16)*hash('l' + i)); b.lineTo(8 + W*0.47, 8 + (H - 16)*hash('r' + i)); b.stroke(); }
    b.strokeStyle = '#2f89ff'; b.lineWidth = 9; b.beginPath(); b.moveTo(W*0.24, H - 10); b.lineTo(W*0.24, H*0.5); b.lineTo(W*0.36, H*0.2); b.stroke();
    const dA = dialFace(b, W*0.64, H*0.5, H*0.44, 260, 20, 0, { sub: 2, c0: '#0c1117', c1: '#05080b' }), dB = dialFace(b, W*0.9, H*0.5, H*0.44, 7, 1, 6.2/7, { c0: '#0c1117', c1: '#05080b' });
    for (const x of [W*0.64, W*0.9]) { b.strokeStyle = col; b.lineWidth = 3; b.beginPath(); b.arc(x, H*0.5, H*0.46, 0, 7); b.stroke(); }
    const r = { bg, dA, dB }; bgs.set(col, r); return r;
  };
  let key = '';
  return (kmh, gear, rpm, mode, st) => {
    const col = modeCol(mode), k2 = Math.round(kmh) + '|' + Math.round(rpm*60) + '|' + gear + '|' + mode + '|' + hhmm();
    if (k2 + st.tag === key) return; key = k2 + st.tag;
    const { bg, dA, dB } = bgFor(col);
    ctx.drawImage(bg, 0, 0); dA(ctx, kmh/260, '#f4f6f8'); dB(ctx, Math.min(1, rpm*0.92), '#f4f6f8');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eef3f6'; ctx.font = '700 46px system-ui, sans-serif'; ctx.fillText(String(Math.round(kmh)), W*0.77, H*0.42);
    ctx.font = '500 16px system-ui, sans-serif'; ctx.fillStyle = '#9aa6b0'; ctx.fillText('km/h', W*0.77, H*0.58);
    ctx.fillStyle = col; ctx.font = '700 22px system-ui, sans-serif'; ctx.fillText(String(mode).toUpperCase(), W*0.77, H*0.17);
    ctx.fillStyle = '#eef3f6'; ctx.font = '700 30px system-ui, sans-serif'; ctx.fillText(gearTxt(gear, true), W*0.77, H*0.8);
    ctx.fillStyle = 'rgba(5,8,11,0.85)'; ctx.fillRect(8, 8, W*0.47, 36);
    ctx.textAlign = 'left'; ctx.fillStyle = '#eef3f6'; ctx.font = '600 22px system-ui, sans-serif'; ctx.fillText(hhmm(), 20, 26);
    ctx.textAlign = 'right'; ctx.fillStyle = col; ctx.fillText('DYNAMIC SELECT · ' + String(mode).toUpperCase(), W*0.47, 26);
    s.tex.needsUpdate = true;
  };
}
// the 911-style's five dials, its touchscreen, the clock on the dash
function fiveDial(s, ts, ck) {
  const { ctx, W, H } = s, sc = W/0.36, bg = document.createElement('canvas'); bg.width = W; bg.height = H; const b = bg.getContext('2d');
  b.fillStyle = '#020203'; b.fillRect(0, 0, W, H);
  const at = (u) => W/2 + u*sc, cy = H/2;
  const tach = dialFace(b, at(0), cy, 0.05*sc, 9, 1, 7.5/9, { c0: '#101114', c1: '#030304' });
  const spd = dialFace(b, at(-0.083), cy, 0.038*sc, 330, 30, 0, { c0: '#0d0e10', c1: '#030304', sub: 3 });
  for (const u of [-0.148, 0.148]) { b.fillStyle = '#070a0d'; b.beginPath(); b.arc(at(u), cy, 0.031*sc, 0, 7); b.fill(); }
  b.fillStyle = '#0b0c0e'; b.beginPath(); b.arc(at(0.083), cy, 0.038*sc, 0, 7); b.fill();
  b.fillStyle = '#8b939b'; b.font = '600 13px system-ui, sans-serif'; b.textAlign = 'center'; b.fillText('OIL °C', at(0.083), cy - 30); b.fillText('FUEL', at(0.083), cy + 40);
  let key = '';
  return (kmh, gear, rpm, mode, st) => {
    const col = modeCol(mode), k2 = Math.round(kmh) + '|' + Math.round(rpm*80) + '|' + gear + '|' + mode + '|' + hhmm();
    if (k2 + st.tag === key) return; key = k2 + st.tag;
    ctx.drawImage(bg, 0, 0);
    tach(ctx, Math.min(1.01, rpm*0.98), '#e8edf2'); spd(ctx, kmh/330, '#e8edf2');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f6f8'; ctx.font = '700 34px system-ui, sans-serif'; ctx.fillText(String(Math.round(kmh)), at(0), cy + 34);
    ctx.fillStyle = col; ctx.font = '800 30px system-ui, sans-serif'; ctx.fillText(gear > 0 ? 'M' + gear : 'N', at(0), cy - 30);
    // the left screen: the mode; the right: the time and a g-meter
    ctx.fillStyle = col; ctx.font = '800 22px system-ui, sans-serif'; ctx.fillText(String(mode).toUpperCase(), at(-0.148), cy - 6);
    ctx.fillStyle = '#8b939b'; ctx.font = '600 11px system-ui, sans-serif'; ctx.fillText(mode === 'Wet' ? 'WET MODE' : 'PASM ' + (/\+/.test(mode) ? 'SPORT' : 'NORMAL'), at(-0.148), cy + 18);
    ctx.strokeStyle = '#2a3036'; ctx.lineWidth = 1.5; for (const r of [20, 40]) { ctx.beginPath(); ctx.arc(at(0.148), cy + 6, r, 0, 7); ctx.stroke(); }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(at(0.148) + st.lat*24, cy + 6 - st.lon*24, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8edf2'; ctx.font = '600 13px ui-monospace, Menlo, monospace'; ctx.fillText(hhmm(), at(0.148), cy - 52);
    ctx.strokeStyle = '#e8edf2'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(at(0.083), cy, 0.032*sc, Math.PI*0.8, Math.PI*(0.8 + 0.5*Math.min(1, 0.5 + rpm*0.3))); ctx.stroke();
    ctx.strokeStyle = '#e8edf2'; ctx.beginPath(); ctx.arc(at(0.083), cy, 0.032*sc, Math.PI*0.2 - 0.6, Math.PI*0.2); ctx.stroke();
    s.tex.needsUpdate = true;
    if (ts._k !== mode + hhmm()) {
      ts._k = mode + hhmm(); const { ctx: c, W: w, H: h } = ts;
      c.fillStyle = '#0a0d10'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) { const x = 10 + i*(w - 20)/4; c.fillStyle = i === 0 ? '#14191e' : '#101418'; rr(c, x, 34, (w - 20)/4 - 8, h - 44, 8); c.fill(); }
      c.fillStyle = col; c.font = '700 22px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(mode).toUpperCase(), 10 + ((w - 20)/4 - 8)/2, h*0.6);
      c.fillStyle = '#8b939b'; c.font = '600 13px system-ui, sans-serif'; ['MODE', 'NAV', 'MEDIA', 'PHONE'].forEach((t, i) => c.fillText(t, 10 + i*(w - 20)/4 + ((w - 20)/4 - 8)/2, 50));
      c.textAlign = 'left'; c.fillStyle = '#e8edf2'; c.font = '600 18px system-ui, sans-serif'; c.fillText(hhmm(), 12, 17);
      ts.tex.needsUpdate = true;
    }
    if (ck._k !== hhmm()) {
      ck._k = hhmm(); const { ctx: c, cv } = ck, w = cv.width, r = w/2, h = hourNow();
      c.fillStyle = '#060606'; c.fillRect(0, 0, w, w);
      for (let i = 0; i < 60; i++) { const a = i/60*Math.PI*2, L = i % 5 ? 0.07 : 0.14; c.strokeStyle = i % 5 ? '#888' : '#f2f2f2'; c.lineWidth = i % 5 ? 2 : 5; c.beginPath(); c.moveTo(r + Math.sin(a)*r*(0.92 - L), r - Math.cos(a)*r*(0.92 - L)); c.lineTo(r + Math.sin(a)*r*0.92, r - Math.cos(a)*r*0.92); c.stroke(); }
      const hand = (a, L, w2, col2) => { c.strokeStyle = col2; c.lineWidth = w2; c.lineCap = 'round'; c.beginPath(); c.moveTo(r, r); c.lineTo(r + Math.sin(a)*r*L, r - Math.cos(a)*r*L); c.stroke(); };
      hand((h % 12)/12*Math.PI*2, 0.5, 9, '#f2f2f2'); hand((h % 1)*Math.PI*2, 0.75, 6, '#f2f2f2');
      c.fillStyle = '#c9201a'; c.beginPath(); c.arc(r, r, 9, 0, 7); c.fill();
      c.fillStyle = '#9a9a9a'; c.font = '600 18px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('SPORT CHRONO', r, r*1.45);
      ck.tex.needsUpdate = true;
    }
  };
}
// the Huracán-style's screen, a different face for each mode
function superScreen(s, ts) {
  const { ctx, W, H } = s, hexBg = new Map();
  const bgFor = (col) => {
    if (hexBg.has(col)) return hexBg.get(col);
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const b = bg.getContext('2d');
    b.fillStyle = '#030304'; b.fillRect(0, 0, W, H);
    b.strokeStyle = 'rgba(255,255,255,0.035)'; b.lineWidth = 1;
    for (let y = 0, r = 0; y < H + 20; y += 17, r++) for (let x = (r % 2)*15; x < W + 30; x += 30) { b.beginPath(); for (let i = 0; i < 7; i++) { const a = i*Math.PI/3; b.lineTo(x + Math.cos(a)*9, y + Math.sin(a)*9); } b.stroke(); }
    b.strokeStyle = col; b.globalAlpha = 0.5; b.lineWidth = 2; b.beginPath(); b.moveTo(20, H - 22); b.lineTo(W - 20, H - 22); b.stroke(); b.globalAlpha = 1;
    hexBg.set(col, bg); return bg;
  };
  let key = '';
  return (kmh, gear, rpm, mode, st) => {
    const M = String(mode).toUpperCase(), col = modeCol(mode), k2 = Math.round(kmh) + '|' + Math.round(rpm*90) + '|' + gear + '|' + M + '|' + (M === 'CORSA' ? Math.floor(st.corsaT*10) : hhmm()) + '|' + Math.round(st.lat*20) + Math.round(st.lon*20);
    if (k2 + st.tag === key) return; key = k2 + st.tag;
    ctx.drawImage(bgFor(col), 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const r8 = Math.min(1, rpm), gtx = gear > 0 ? String(gear) : 'N';
    if (M === 'CORSA') {
      // a bar of revs right across the top, blocks going red as they near the limit; a huge gear; the lap clock; the tyres
      const n = 40; for (let i = 0; i < n; i++) { const f = (i + 1)/n, on = r8 >= f - 1e-3; ctx.fillStyle = on ? (f > 0.9 ? '#ff2a1f' : f > 0.75 ? '#ffb020' : '#f4f6f8') : '#1a1b1e'; ctx.fillRect(24 + i*(W - 48)/n, 16, (W - 48)/n - 3, 40); }
      ctx.fillStyle = '#ffffff'; ctx.font = '800 150px system-ui, sans-serif'; ctx.fillText(gtx, W/2, H*0.6);
      ctx.fillStyle = '#f4f6f8'; ctx.font = '700 40px system-ui, sans-serif'; ctx.fillText(String(Math.round(kmh)), W*0.7, H*0.5); ctx.font = '500 16px system-ui, sans-serif'; ctx.fillStyle = '#8b939b'; ctx.fillText('km/h', W*0.7, H*0.62);
      const t = st.corsaT, mm = Math.floor(t/60), ss = (t % 60).toFixed(1).padStart(4, '0');
      ctx.fillStyle = col; ctx.font = '700 15px system-ui, sans-serif'; ctx.fillText('LAP', W*0.15, H*0.33); ctx.fillStyle = '#f4f6f8'; ctx.font = '700 34px ui-monospace, Menlo, monospace'; ctx.fillText(mm + ':' + ss, W*0.15, H*0.47);
      for (let i = 0; i < 4; i++) { const x = W*0.85 + (i % 2 ? 22 : -22), y = H*0.42 + (i < 2 ? -26 : 26), tc = 70 + Math.min(40, kmh*0.2); ctx.fillStyle = tc > 95 ? '#35d07f' : '#4fb3ff'; rr(ctx, x - 12, y - 20, 24, 40, 5); ctx.fill(); ctx.fillStyle = '#e8edf2'; ctx.font = '600 11px system-ui, sans-serif'; ctx.fillText(Math.round(tc) + '°', x + (i % 2 ? 26 : -26), y); }
    } else if (M === 'SPORT') {
      // the revs as a wide band over the top, a g-meter on the left, the temperatures on the right
      const cx = W/2, cy = H*0.95, R = H*0.8, a0 = Math.PI*1.12, a1 = Math.PI*1.88;
      ctx.lineCap = 'butt'; ctx.lineWidth = 26; ctx.strokeStyle = '#1a1b1e'; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
      ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + (a1 - a0)*r8); ctx.stroke();
      ctx.strokeStyle = '#ff2a1f'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R + 18, a0 + (a1 - a0)*0.88, a1); ctx.stroke();
      for (let i = 0; i <= 9; i++) { const a = a0 + (a1 - a0)*i/9; ctx.fillStyle = '#c8ced4'; ctx.font = '600 16px system-ui, sans-serif'; ctx.fillText(String(i), cx + Math.cos(a)*(R - 32), cy + Math.sin(a)*(R - 32)); }
      ctx.fillStyle = '#ffffff'; ctx.font = '800 92px system-ui, sans-serif'; ctx.fillText(gtx, cx, H*0.6);
      ctx.fillStyle = '#f4f6f8'; ctx.font = '700 30px system-ui, sans-serif'; ctx.fillText(Math.round(kmh) + ' km/h', cx, H*0.86);
      ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 1.5; for (const r of [24, 48]) { ctx.beginPath(); ctx.arc(W*0.13, H*0.55, r, 0, 7); ctx.stroke(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(W*0.13 + st.lat*30, H*0.55 - st.lon*30, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#8b939b'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText('G', W*0.13, H*0.22);
      for (const [i, l, f] of [[0, 'OIL', 0.62], [1, 'WATER', 0.55]]) { const y = H*(0.4 + i*0.25); ctx.fillStyle = '#8b939b'; ctx.fillText(l, W*0.87, y - 14); ctx.fillStyle = '#1a1b1e'; ctx.fillRect(W*0.8, y, W*0.14, 8); ctx.fillStyle = col; ctx.fillRect(W*0.8, y, W*0.14*f, 8); }
    } else {
      // Strada: one round rev counter in the middle with the speed inside it
      const cx = W/2, cy = H*0.56, R = H*0.42, a0 = Math.PI*0.75, sw = Math.PI*1.5;
      for (let i = 0; i <= 45; i++) { const f = i/45, a = a0 + sw*f, on = r8 >= f; ctx.strokeStyle = on ? (f > 0.85 ? '#ff2a1f' : col) : '#1d1e21'; ctx.lineWidth = i % 5 ? 3 : 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a)*R*0.86, cy + Math.sin(a)*R*0.86); ctx.lineTo(cx + Math.cos(a)*R, cy + Math.sin(a)*R); ctx.stroke(); }
      for (let i = 0; i <= 9; i++) { const a = a0 + sw*i/9; ctx.fillStyle = '#c8ced4'; ctx.font = '600 15px system-ui, sans-serif'; ctx.fillText(String(i), cx + Math.cos(a)*R*0.72, cy + Math.sin(a)*R*0.72); }
      ctx.fillStyle = '#ffffff'; ctx.font = '700 64px system-ui, sans-serif'; ctx.fillText(String(Math.round(kmh)), cx, cy - 4); ctx.fillStyle = '#8b939b'; ctx.font = '500 15px system-ui, sans-serif'; ctx.fillText('km/h', cx, cy + 34);
      ctx.fillStyle = col; ctx.font = '800 34px system-ui, sans-serif'; ctx.fillText(gtx, cx, cy + R*0.78);
      ctx.fillStyle = '#c8ced4'; ctx.font = '600 18px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.fillText(hhmm(), 22, 40); ctx.fillText('TRIP ' + (st.dist/1000).toFixed(1) + ' km', 22, H*0.75);
      ctx.textAlign = 'right'; ctx.fillText('31 °C', W - 22, 40); ctx.fillText('FM 98.3', W - 22, H*0.75);
    }
    ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.font = '800 20px system-ui, sans-serif'; ctx.fillText(M, W/2, 14 + (M === 'CORSA' ? 60 : 0));
    s.tex.needsUpdate = true;
    if (ts._k !== M + hhmm()) {
      ts._k = M + hhmm(); const { ctx: c, W: w, H: h } = ts;
      c.fillStyle = '#050506'; c.fillRect(0, 0, w, h);
      c.fillStyle = col; c.font = '800 34px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(M, w/2, h*0.42);
      c.fillStyle = '#8b939b'; c.font = '600 15px system-ui, sans-serif'; c.fillText(M === 'CORSA' ? 'ESC OFF · GEARBOX TRACK' : M === 'SPORT' ? 'ESC SPORT · EXHAUST OPEN' : 'ESC ON · COMFORT', w/2, h*0.68);
      c.textAlign = 'left'; c.fillStyle = '#e8edf2'; c.fillText(hhmm(), 10, 16);
      ts.tex.needsUpdate = true;
    }
  };
}
