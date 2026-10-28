// Pune's landmarks as their own models, built where OpenStreetMap has them (tools/landmarks_bake.py places
// them, sizes them from the real outline, turns the front to the road, and clears the map's generic boxes
// off the site): Shaniwar Wada's walls, bastions and Delhi Darwaza with its spikes; Dagdusheth's white and
// gold temple with the idol lit inside; Mahatma Phule Mandai's octagonal tower and eight wings; Pune
// station with its clock tower and the yellow name board; Aga Khan Palace's arcades; Lal Mahal; Lal Deval;
// Tulshibaug's tall spire; Kasba Ganpati; the University's main building; COEP; Osho's black pyramid.
//
// Local frame per landmark: u along its width (+x), v from the front (v = -d/2, the road side) to the back.
// Big surfaces use the city's PBR facade and ground materials; details are vertex-coloured.
import * as THREE from 'three';
import LM from './landmarks.json';
import { compose } from './props.js';
import { BASE } from './buildingsChunk.js';
import { WL, GL } from '../gfx/pbr.js';
import { lin } from './geo.js';

const T = (c) => c.map(lin);
const STONE = T([0.55, 0.5, 0.45]), BRICK = T([0.62, 0.36, 0.27]), CREAM = T([0.95, 0.89, 0.74]), WHITE = T([0.97, 0.96, 0.93]),
  RED = T([0.74, 0.32, 0.24]);
const C = { teak: [0.36, 0.22, 0.12], iron: [0.2, 0.2, 0.21], bronze: [0.28, 0.24, 0.16], marble: [0.96, 0.95, 0.92], gold: [0.95, 0.72, 0.22],
  saffron: [0.98, 0.5, 0.08], red: [0.7, 0.08, 0.06], dark: [0.07, 0.06, 0.06], cream: [0.95, 0.89, 0.74], white: [0.97, 0.97, 0.95],
  tile: [0.62, 0.27, 0.17], slate: [0.25, 0.26, 0.28], green: [0.24, 0.42, 0.16], water: [0.28, 0.45, 0.55], black: [0.06, 0.06, 0.07],
  stone: [0.58, 0.53, 0.47], brick: [0.6, 0.32, 0.24], marigold: [1.0, 0.62, 0.05] };
const G = {};
const geo = (k, f) => G[k] || (G[k] = f());

// Shaniwar Wada's layout in its own frame (u across, v from the Delhi Darwaza side inward), from the OSM outline:
// the gate sits between the two round bastions at u -2..7.6 on the north face. Shared with game/wada.js
export const SW = (() => {
  const GU = 2.73, GW = 9.6, GV = -83.2;
  const U0 = -68, U1 = 64.5, V0 = -76, V1 = 77.3, cross = [-26, 28];
  const trees = [];
  for (let u = U0 + 7; u <= U1 - 7; u += 12.5) { if (Math.abs(u - GU) > 11) trees.push([u, V0 + 6.5, 3 + ((u * 7) % 3 + 3) % 3 * 0.4]); trees.push([u, V1 - 6.5, 3.3]); }
  for (let v = V0 + 18; v <= V1 - 14; v += 13) { trees.push([U0 + 6.5, v, 3.2]); trees.push([U1 - 6.5, v, 3.4]); }
  return {
    GU, GW, GV, WU: GU + 1.7, U0, U1, V0, V1, cross, trees,
    bastions: [[-6.7, -84.4, 4.4, 15], [12.4, -83.9, 4.6, 15], [71.9, -80.3, 6.9, 13], [74.2, 4.6, 6.0, 12.6], [70.3, 81.8, 5.6, 12.6], [-73.6, 81.8, 6.5, 13], [-75.9, -9.3, 4.8, 12.6], [-73.4, -81.5, 6.1, 13]],
    plinths: [[-34, -52, 36, 28], [38, -52, 34, 28], [-34, 1, 36, 32], [38, 1, 34, 32], [-34, 54, 36, 30], [38, 54, 34, 30]],
    karanje: [GU, -26], counter: [GU - 13, GV - 6], plaque: [GU + 13, GV - 5.5],
    // the hawkers outside the gate: [u, v, key, name, mr, price, note, colour]
    vendors: [[GU - 24, GV - 14, 'bhel', 'Bhel', 'भेळ', 40, 'Puffed rice, sev, chutney, a paper cone', [0.85, 0.2, 0.12]],
      [GU - 26, GV - 24, 'vadapav', 'Vada pav', 'वडापाव', 20, 'With the dry garlic chutney', [0.95, 0.6, 0.1]],
      [GU + 24, GV - 14, 'chai', 'Amruttulya chai', 'अमृततुल्य चहा', 15, 'Cutting, strong, sweet', [0.55, 0.3, 0.12]],
      [GU + 26, GV - 24, 'butta', 'Bhutta', 'भाजलेलं कणीस', 40, 'Roasted corn, lime and chilli', [0.9, 0.75, 0.15]],
      [GU - 28, GV - 34, 'ganne', 'Sugarcane juice', 'उसाचा रस', 30, 'Pressed while you wait, with ginger', [0.3, 0.6, 0.2]],
      [GU - 27, GV - 44, 'kulfi', 'Kulfi', 'कुल्फी', 50, 'Malai kulfi on a stick', [0.95, 0.9, 0.8]]],
    isGateSeg: (a, b) => Math.abs(a[1] - GV) < 0.3 && Math.abs(b[1] - GV) < 0.3 && Math.min(a[0], b[0]) > -3 && Math.max(a[0], b[0]) < 8.5,
  };
})();

// ---------------------------------------------------------------- the per-landmark builder
class LB {
  constructor(L, b) {
    Object.assign(this, b);                    // fb (facades), gb (ground), cb (coloured), group, mm
    this.L = L; this.c = Math.cos(L.rot); this.s = Math.sin(L.rot);
    this.seed = Math.abs(Math.round(L.x * 7 + L.z * 3)) % 251;
    this.Y0 = BASE + (L.y || 0);                // up on its hill (Parvati), or at street level
  }
  // local (u, v) -> world [x, z]; +u along the width, +v toward the back
  P(u, v) { return [this.L.x + u * this.c + v * this.s, this.L.z + u * this.s - v * this.c]; }
  N(nu, nv) { return [nu * this.c + nv * this.s, nu * this.s - nv * this.c]; }
  A(layer, tint, style = 11, flags = 2, top = 10) { return { eu: 0, eL: 1, tint, style, layer, flags, seed: this.seed, tx: this.c, tz: this.s, top }; }
  // a wall from local a to b, facing the normal (nu, nv)
  wall(ua, va, ub, vb, y0, y1, nu, nv, A, u0 = 0) {
    const [ax, az] = this.P(ua, va), [bx, bz] = this.P(ub, vb), [nx, nz] = this.N(nu, nv);
    const L = Math.hypot(bx - ax, bz - az) || 1;
    this.fb.wall(ax, az, bx, bz, this.Y0 + y0, this.Y0 + y1, nx, nz, u0, { ...A, eu: u0, eL: L, tx: (bx - ax) / L, tz: (bz - az) / L, top: y1 });
  }
  // a closed ring of walls (local points), faces outward (or inward)
  ring(pts, y0, y1, A, inward = false) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const s = (area > 0 ? 1 : -1) * (inward ? -1 : 1);
    let u = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv);
      if (L < 0.01) continue;
      this.wall(a[0], a[1], b[0], b[1], y0, y1, s * dv / L, -s * du / L, A, u); u += L;
    }
  }
  box(u, v, w, d, y0, y1, A, roofA) {
    const h = [[u - w / 2, v - d / 2], [u + w / 2, v - d / 2], [u + w / 2, v + d / 2], [u - w / 2, v + d / 2]];
    this.ring(h, y0, y1, A);
    if (roofA !== null) this.flat(h, y1, roofA || A);
  }
  // a horizontal face (4 local points) at height y
  flat(q, y, A, down = false) {
    this.fb.flat(q.map(([u, v]) => { const [x, z] = this.P(u, v); return [x, this.Y0 + y, z]; }), down ? -1 : 1, A);
  }
  // any quad (local [u, y, v] points, in order) with the facade material, facing away from `ref` (a local
  // [u, y, v] point inside the solid; default: straight below the quad's middle, so roofs face up)
  quad(q, A, ref) {
    const w = q.map(([u, y, v]) => { const [x, z] = this.P(u, v); return [x, this.Y0 + y, z]; });
    const ax = w[1][0] - w[0][0], ay = w[1][1] - w[0][1], az = w[1][2] - w[0][2];
    let bx = w[3][0] - w[0][0], by = w[3][1] - w[0][1], bz = w[3][2] - w[0][2];
    if (Math.hypot(bx, by, bz) < 1e-6) { bx = w[2][0] - w[0][0]; by = w[2][1] - w[0][1]; bz = w[2][2] - w[0][2]; }
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    const mx = (w[0][0] + w[1][0] + w[2][0] + w[3][0]) / 4, my = (w[0][1] + w[1][1] + w[2][1] + w[3][1]) / 4, mz = (w[0][2] + w[1][2] + w[2][2] + w[3][2]) / 4;
    let rx = mx, ry = my - 10, rz = mz;
    if (ref) { const [x, z] = this.P(ref[0], ref[2]); rx = x; ry = this.Y0 + ref[1]; rz = z; }
    const flip = (mx - rx) * nx + (my - ry) * ny + (mz - rz) * nz < 0;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const vs = w.map(p => this.fb.v(p[0], p[1], p[2], nx, ny, nz, p[0] * 0.7 + p[2] * 0.7, p[1] - this.Y0, A));
    if (flip) this.fb.i.push(vs[0], vs[2], vs[1], vs[0], vs[3], vs[2]); else this.fb.i.push(vs[0], vs[1], vs[2], vs[0], vs[2], vs[3]);
  }
  // a gabled or hipped roof over a local box, in tiles: ridge along u
  roof(u, v, w, d, y, rise, A, hip = true) {
    const x0 = u - w / 2, x1 = u + w / 2, z0 = v - d / 2, z1 = v + d / 2, r = y + rise, inset = hip ? Math.min(d / 2, w / 2) : 0;
    this.quad([[x0, y, z0], [x1, y, z0], [x1 - inset, r, v], [x0 + inset, r, v]], A);
    this.quad([[x1, y, z1], [x0, y, z1], [x0 + inset, r, v], [x1 - inset, r, v]], A);
    if (hip) { this.quad([[x1, y, z0], [x1, y, z1], [x1 - inset, r, v], [x1 - inset, r, v]], A); this.quad([[x0, y, z1], [x0, y, z0], [x0 + inset, r, v], [x0 + inset, r, v]], A); }
  }
  ground(pts, y, layer, shade = 1) {
    const flat = []; for (const [u, v] of pts) { const [x, z] = this.P(u, v); flat.push(x, z); }
    this.gb.poly([flat], this.Y0 + y, layer, shade);
  }
  // coloured parts: geometry placed at local (u, y, v), turned by yaw (radians, about the up axis;
  // the geometry's own +z faces the landmark's front)
  part(g, u, y, v, col, yaw = 0, sx = 1, sy = 1, sz = 1, glow = 0) {
    const [x, z] = this.P(u, v);
    this.cb.addGeo(g, compose(x, this.Y0 + y, z, -this.L.rot + yaw, sx, sy, sz, 0, 0, this.mm), col, glow);
  }
  cbox(u, y, v, w, h, d, col, yaw = 0, glow = 0) { if (y <= 0.6 && h > 1.8 && w < 1.6 && d < 1.6 && this.col) this.hitc(u, v, Math.max(w, d) / 2 + 0.05); this.part(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), u, y + h / 2, v, col, yaw, w, h, d, glow); }
  cyl(u, y, v, r, h, col, n = 12, glow = 0) { if (y <= 0.6 && h > 1.8 && r < 0.9 && this.col) this.hitc(u, v, r + 0.05); this.part(geo('cyl' + n, () => new THREE.CylinderGeometry(1, 1, 1, n)), u, y + h / 2, v, col, 0, r, h, r, glow); }
  cone(u, y, v, r, h, col, n = 12, glow = 0) { this.part(geo('cone' + n, () => new THREE.ConeGeometry(1, 1, n)), u, y + h / 2, v, col, 0, r, h, r, glow); }
  dome(u, y, v, r, h, col, n = 14, glow = 0) { this.part(geo('dome' + n, () => new THREE.SphereGeometry(1, n, 8, 0, Math.PI * 2, 0, Math.PI / 2)), u, y, v, col, 0, r, h, r, glow); }
  sphere(u, y, v, r, col, glow = 0) { this.part(geo('sph', () => new THREE.SphereGeometry(1, 12, 8)), u, y, v, col, 0, r, r, r, glow); }
  // an arch opening seen from the front: a dark recess with a round (or pointed) head, on a wall facing -v
  arch(u, v, w, h, y = 0, col = C.dark, pointed = false, yaw = 0) {
    const rr = w / 2, head = pointed ? rr * 1.3 : rr;
    this.cbox(u, y, v, w, h - head, 0.12, col, yaw);
    this.part(geo(pointed ? 'parch' : 'rarch', () => archHead(pointed)), u, y + h - head, v - 0.07, col, yaw, rr, rr, 1);
  }
  // collision: a wall segment, a circle
  hit(ua, va, ub, vb) { const [ax, az] = this.P(ua, va), [bx, bz] = this.P(ub, vb); this.col.push(['s', ax, az, bx, bz]); }
  hitc(u, v, r) { const [x, z] = this.P(u, v); this.col.push(['c', x, z, r]); }
  hitk(ua, va, ub, vb, kind) { const [ax, az] = this.P(ua, va), [bx, bz] = this.P(ub, vb); this.col.push(['s', ax, az, bx, bz, kind]); }
  // walkable surfaces up off the ground (a plinth's top, a ramp of steps, the rampart walk): heights in the
  // landmark's own frame, turned into Surfaces.height lookups once (addLandmarks)
  deckRect(u, v, w, d, h) { (this.decks || (this.decks = [])).push({ t: 'rect', u, v, w, d, h }); }
  deckRamp(u0, v0, u1, v1, w, h0, h1) { (this.decks || (this.decks = [])).push({ t: 'ramp', u0, v0, u1, v1, w, h0, h1 }); }
  deckBand(ring, inner, h, skip) { (this.decks || (this.decks = [])).push({ t: 'band', ring, inner, h, skip }); }
  hitBox(u, v, w, d) { const h = [[u - w / 2, v - d / 2], [u + w / 2, v - d / 2], [u + w / 2, v + d / 2], [u - w / 2, v + d / 2]]; for (let i = 0; i < 4; i++) this.hit(...h[i], ...h[(i + 1) % 4]); }
  // merlons along a local polyline
  merlons(pts, y, col, every = 2.3, w = 1.2, h = 0.95, t = 0.7, closed = true) {
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
      const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let s = every / 2; s < L; s += every) { const t2 = s / L; this.cbox(a[0] + (b[0] - a[0]) * t2, y, a[1] + (b[1] - a[1]) * t2, w, h, t, col, yaw); }
    }
  }
  // a name board (canvas texture), facing the front
  board(u, y, v, w, h, draw, key, yaw = 0) {
    let mat = boardMats.get(key);
    if (!mat) {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w);
      draw(cv.getContext('2d'), cv.width, cv.height);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 });
      boardMats.set(key, mat);
    }
    const m = new THREE.Mesh(geo('plane', () => new THREE.PlaneGeometry(1, 1)), mat);
    const [x, z] = this.P(u, v);
    m.position.set(x, this.Y0 + y, z); m.rotation.y = -this.L.rot + yaw; m.scale.set(w, h, 1);
    m.updateMatrix(); m.matrixAutoUpdate = false;
    this.group.add(m);
  }
}
const boardMats = new Map();
// the head of an arch opening: a half disc (or a pointed Gothic head), standing on y = 0, facing +z, width 2
function archHead(pointed) {
  const sh = new THREE.Shape();
  sh.moveTo(-1, 0);
  if (pointed) { sh.quadraticCurveTo(-0.95, 0.95, 0, 1.3); sh.quadraticCurveTo(0.95, 0.95, 1, 0); }
  else sh.absarc(0, 0, 1, Math.PI, 0, true);
  sh.lineTo(-1, 0);
  return new THREE.ShapeGeometry(sh, 10);
}

// Bajirao I on horseback, the bronze outside the Delhi Darwaza: the horse mid-stride with its near foreleg
// raised, neck arched, tail streaming; the Peshwa upright in the saddle in his pagadi, a long spear held high
function horseman(B, u, v, s, yaw) {
  const br = C.bronze, dk = [0.2, 0.17, 0.11];
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  // local statue frame: a along the horse (+a is where it faces: the front, -v), b across; y up
  const at = (a, b) => [u + b * cs - (-a) * sn, v + b * sn + (-a) * cs];
  const put = (key, mk, a, y, b, col = br, sx = 1, sy = 1, sz = 1) => { const [pu, pv] = at(a * s, b * s); B.part(geo(key, mk), pu, y * s, pv, col, yaw, s * sx, s * sy, s * sz); };
  const y0 = 3.6 / s;                                   // on top of the plinth
  const Y = (y) => y0 + y;
  // body and chest
  put('h_body', () => { const g = new THREE.CapsuleGeometry(0.42, 1.25, 6, 14); g.rotateX(Math.PI / 2); g.scale(1, 1.05, 1); return g; }, 0, Y(1.55), 0);
  put('h_chest', () => new THREE.SphereGeometry(0.48, 14, 10), 0.72, Y(1.6), 0);
  put('h_rump', () => new THREE.SphereGeometry(0.47, 14, 10), -0.7, Y(1.6), 0);
  // neck arched up, the head with its muzzle, ears, the mane along the crest
  put('h_neck', () => { const g = new THREE.CylinderGeometry(0.2, 0.33, 0.95, 12); g.rotateX(0.62); return g; }, 1.05, Y(2.12), 0);
  put('h_head', () => { const g = new THREE.CylinderGeometry(0.13, 0.2, 0.62, 10); g.rotateX(1.75); return g; }, 1.42, Y(2.52), 0);
  put('h_muzzle', () => new THREE.SphereGeometry(0.15, 10, 8), 1.7, Y(2.43), 0);
  for (const sd of [-1, 1]) put('h_ear', () => new THREE.ConeGeometry(0.05, 0.18, 6), 1.3, Y(2.82), sd * 0.08);
  put('h_mane', () => { const g = new THREE.BoxGeometry(0.06, 0.16, 0.9); g.rotateX(0.62); return g; }, 0.98, Y(2.32), 0, dk);
  // legs: upper and lower; the near foreleg lifted and bent
  const leg = (a, b, lift) => {
    if (!lift) { put('h_upleg', () => new THREE.CylinderGeometry(0.1, 0.13, 0.7, 8), a, Y(0.95), b); put('h_loleg', () => new THREE.CylinderGeometry(0.06, 0.08, 0.62, 8), a, Y(0.34), b); put('h_hoof', () => new THREE.CylinderGeometry(0.08, 0.09, 0.08, 8), a, Y(0.04), b, dk); return; }
    put('h_upleg_r', () => { const g = new THREE.CylinderGeometry(0.1, 0.13, 0.66, 8); g.rotateX(0.9); return g; }, a + 0.22, Y(1.08), b);
    put('h_loleg_r', () => { const g = new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8); g.rotateX(-0.35); return g; }, a + 0.38, Y(0.7), b);
  };
  leg(0.62, -0.2, false); leg(0.62, 0.2, true); leg(-0.62, -0.2, false); leg(-0.68, 0.2, false);
  put('h_tail', () => { const g = new THREE.CylinderGeometry(0.05, 0.16, 1.0, 8); g.rotateX(-0.55); return g; }, -1.28, Y(1.3), 0, dk);
  // saddle cloth and saddle
  put('h_cloth', () => new THREE.BoxGeometry(0.98, 0.5, 0.95), -0.05, Y(1.72), 0, [0.24, 0.2, 0.12]);
  // the rider: legs astride, torso upright in an angarkha, the pagadi, shield on the back, the spear
  for (const sd of [-1, 1]) {
    put('r_thigh', () => { const g = new THREE.CylinderGeometry(0.1, 0.12, 0.55, 8); g.rotateX(Math.PI / 2 - 0.3); return g; }, 0.1, Y(2.05), sd * 0.38);
    put('r_shin', () => new THREE.CylinderGeometry(0.07, 0.09, 0.62, 8), 0.27, Y(1.55), sd * 0.43);
  }
  put('r_hips', () => new THREE.BoxGeometry(0.42, 0.22, 0.5), -0.05, Y(2.1), 0);
  put('r_torso', () => { const g = new THREE.CylinderGeometry(0.2, 0.27, 0.72, 10); return g; }, -0.04, Y(2.55), 0);
  put('r_skirt', () => new THREE.CylinderGeometry(0.27, 0.38, 0.3, 12), -0.04, Y(2.18), 0);
  put('r_head', () => new THREE.SphereGeometry(0.14, 12, 10), -0.02, Y(3.06), 0);
  put('r_pagadi', () => { const g = new THREE.CylinderGeometry(0.16, 0.18, 0.18, 12); g.rotateZ(0.12); return g; }, -0.05, Y(3.22), 0);
  put('r_kalgi', () => new THREE.ConeGeometry(0.035, 0.22, 6), -0.12, Y(3.4), 0);
  put('r_shield', () => { const g = new THREE.SphereGeometry(0.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4); g.rotateZ(Math.PI / 2); return g; }, -0.26, Y(2.6), 0);
  // right arm up holding the spear, the left on the reins
  put('r_arm_up', () => { const g = new THREE.CylinderGeometry(0.055, 0.07, 0.62, 8); g.rotateX(-0.25); g.rotateZ(-0.35); return g; }, 0.02, Y(3.0), 0.3);
  put('r_arm_rein', () => { const g = new THREE.CylinderGeometry(0.055, 0.07, 0.6, 8); g.rotateX(Math.PI / 2 - 0.6); return g; }, 0.25, Y(2.55), -0.2);
  put('r_spear', () => { const g = new THREE.CylinderGeometry(0.025, 0.025, 3.4, 6); g.rotateX(0.18); return g; }, 0.12, Y(3.15), 0.42);
  put('r_spearhead', () => { const g = new THREE.ConeGeometry(0.06, 0.32, 6); g.rotateX(0.18); return g; }, 0.42, Y(4.85), 0.42, [0.5, 0.48, 0.45]);
}

// a Nagara spire: tiers narrowing upward with small corner spirelets, an amalaka, a gold kalash. Returns the top
function shikhara(B, u, v, y, r, n, col, yaw = Math.PI / 4) {
  for (let k = 0; k < n; k++) {
    const h = Math.max(0.9, r * 0.5);
    B.part(geo('stier', () => new THREE.CylinderGeometry(0.86, 1, 1, 4)), u, y + h / 2, v, col, yaw, r, h, r);
    if (k < n - 2) for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + yaw; B.cone(u + Math.cos(a) * r * 0.78, y + h, v + Math.sin(a) * r * 0.78, Math.max(0.2, r * 0.14), h * 0.9, col, 6); }
    y += h; r *= 0.84;
  }
  B.part(geo('amalaka', () => new THREE.CylinderGeometry(1, 1, 1, 16)), u, y + 0.25, v, col, 0, r * 1.25, 0.5, r * 1.25);
  B.sphere(u, y + 0.75, v, Math.max(0.3, r * 0.45), C.gold, 0.35); B.cone(u, y + 0.9, v, Math.max(0.12, r * 0.18), r * 1.2 + 0.6, C.gold, 8, 0.35);
  return y + r * 1.2 + 1.5;
}
// a saffron pennant on a pole
function flag(B, u, v, y, h = 3) {
  B.cyl(u, y, v, 0.05, h, C.iron, 5);
  B.part(geo('pennant', () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, -0.35, 0, 0, -0.7, 0, 0, 0, 0, 0, -0.7, 0, 1, -0.35, 0], 3)); g.computeVertexNormals(); return g; }), u, y + h, v, C.saffron, 0.6, 1.6, 1.6, 1);
}
// a chhatri: a domed kiosk on four pillars
function chhatri(B, u, v, y, s, col, dome = col) {
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.cyl(u + a * s * 0.42, y, v + b * s * 0.42, s * 0.07, s * 1.1, col, 6);
  B.cbox(u, y + s * 1.1, v, s * 1.05, s * 0.14, s * 1.05, col);
  B.dome(u, y + s * 1.24, v, s * 0.5, s * 0.55, dome); B.cone(u, y + s * 1.75, v, s * 0.07, s * 0.35, C.gold, 6);
}
// a roof with its ridge along v (the gable ends face the front and the back)
function roofV(B, u, v, w, d, y, rise, A) {
  const x0 = u - w / 2, x1 = u + w / 2, z0 = v - d / 2, z1 = v + d / 2, r = y + rise;
  B.quad([[x0, y, z0], [x0, y, z1], [u, r, z1], [u, r, z0]], A, [u, y - 1, v]);
  B.quad([[x1, y, z1], [x1, y, z0], [u, r, z0], [u, r, z1]], A, [u, y - 1, v]);
}
// a triangular gable wall at the end of roofV, facing -v (front) or +v
function gable(B, u, v, w, y, rise, A, back = false) {
  B.quad([[u - w / 2, y, v], [u + w / 2, y, v], [u, y + rise, v], [u, y + rise, v]], A, [u, y, v + (back ? -1 : 1)]);
}

// ---------------------------------------------------------------- the landmarks
const BUILD = {
  // Shaniwar Wada: the Peshwas' fort. Stone ramparts with a brick upper course and merlons, nine bastions,
  // the Delhi Darwaza on the north with its spiked teak doors and the nagarkhana above, gardens and the
  // plinths of the burnt palace inside, the Hazari Karanje lotus fountain, Bajirao on horseback outside.
  shaniwar(B) {
    const L = B.L, ring = L.outline, W = SW;
    const sA = B.A(WL.rubble, STONE, 11, 2, 7.2), bA = B.A(WL.brick, BRICK, 11, 2, 10.6), topA = B.A(WL.slab, STONE);
    // the rampart on the real outline (its round lobes are the bastions), stone below and brick above, laid in
    // panels that each weathered their own way (rebuilt patches, sun-bleached runs, monsoon-darkened bays)
    const hsh = (k) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    let area = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area > 0 ? 1 : -1, segs = [];
    { let ru = 0, pk = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length], du = b[0] - a[0], dv = b[1] - a[1], Ls = Math.hypot(du, dv);
        if (Ls < 0.01) continue;
        const nu = sg * dv / Ls, nv = -sg * du / Ls; segs.push({ a, b, du: du / Ls, dv: dv / Ls, L: Ls, nu, nv, gate: W.isGateSeg(a, b) });
        const n = Math.max(1, Math.round(Ls / 6.5));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n, ua = a[0] + du * t0, va = a[1] + dv * t0, ub = a[0] + du * t1, vb = a[1] + dv * t1;
          const r1 = hsh(++pk), r2 = hsh(pk + 0.5), r3 = hsh(pk + 0.25);
          const ks = 0.86 + r1 * 0.26, kb = 0.84 + r2 * 0.3, warm = (r3 - 0.5) * 0.1;
          B.wall(ua, va, ub, vb, 0, 7.2, nu, nv, { ...sA, tint: [STONE[0] * ks * (1 + warm * 0.5), STONE[1] * ks, STONE[2] * ks * (1 - warm * 0.4)] }, ru);
          B.wall(ua, va, ub, vb, 7.2, 10.6, nu, nv, { ...bA, tint: [BRICK[0] * kb * (1 + warm), BRICK[1] * kb, BRICK[2] * kb * (1 - warm)] }, ru);
          ru += Ls / n;
        }
      } }
    // a dressed-stone string course where the stone gives way to brick, damp grime at the foot, arrow slits
    // in the brick, and rain streaks running down from the merlons
    { let q = 0;
      for (const S of segs) {
        const mu = (S.a[0] + S.b[0]) / 2, mv = (S.a[1] + S.b[1]) / 2, yaw = Math.atan2(S.dv, S.du);
        B.cbox(mu + S.nu * 0.16, 7.02, mv + S.nv * 0.16, S.L + 0.25, 0.34, 0.32, [0.62, 0.58, 0.52], yaw);
        B.cbox(mu + S.nu * 0.04, 0, mv + S.nv * 0.04, S.L + 0.05, 0.3 + hsh(q + 9) * 0.3, 0.05, [0.42, 0.41, 0.36], yaw);
        if (S.gate || S.L < 9) { q++; continue; }
        for (let d = 3; d < S.L - 2; d += 4.6) {
          const r = hsh(++q), pu = S.a[0] + S.du * d, pv = S.a[1] + S.dv * d;
          B.cbox(pu + S.nu * 0.03, 8.1, pv + S.nv * 0.03, 0.16, 0.95, 0.06, [0.08, 0.06, 0.05], yaw);
          if (r < 0.55) { const l = 1.2 + hsh(q + 3) * 2.6, w = 0.3 + hsh(q + 4) * 0.5, o = (hsh(q + 5) - 0.5) * 1.6;
            B.cbox(pu + S.du * o + S.nu * 0.025, 10.6 - l, pv + S.dv * o + S.nv * 0.025, w, l, 0.04, [0.36, 0.2, 0.15], yaw); }
          if (r > 0.7) { const l = 0.8 + hsh(q + 6) * 2.4, o = (hsh(q + 7) - 0.5) * 2;
            B.cbox(pu + S.du * o + S.nu * 0.025, 7.0 - l, pv + S.dv * o + S.nv * 0.025, 0.4 + hsh(q + 8) * 0.6, l, 0.04, [0.27, 0.27, 0.25], yaw); }
        }
      } }
    // the four lesser gates of the wada: Mastani (Alibahadur) on the north, Khidki on the east, Ganesh and
    // Narayan (Jambhul) on the south; arched, with studded teak doors, shut, their names on a stone above
    const lesser = [[42, -79.2, 0, -1, 'मस्तानी दरवाजा', 'MASTANI DARWAZA', -76], [68.9, -36, 1, 0, 'खिडकी दरवाजा', 'KHIDKI DARWAZA', 64.5], [30, 81.05, 0, 1, 'गणेश दरवाजा', 'GANESH DARWAZA', 77.3], [-38, 81.0, 0, 1, 'नारायण दरवाजा', 'NARAYAN DARWAZA', 77.3]];
    for (const [pu, pv, nu, nv, mr, en, inner] of lesser) {
      for (const side of [1, -1]) {
        const fu = side > 0 ? pu : nu ? inner : pu, fv = side > 0 ? pv : nv ? inner : pv, su = nu * side, sv2 = nv * side;
        const yaw = Math.atan2(su, -sv2), tu = -sv2, tv = su;                 // tangent along the wall
        const at = (o, t) => [fu + su * o + tu * t, fv + sv2 * o + tv * t];
        { const [a, b] = at(0.2, 0); B.cbox(a, 0, b, 5.4, 6.4, 0.4, [0.5, 0.46, 0.41], yaw); }
        { const [a, b] = at(0.42, 0); B.cbox(a, 0, b, 3.3, 3.9, 0.06, [0.07, 0.05, 0.04], yaw); B.part(geo('rarch', () => archHead(false)), a, 3.9, b, [0.07, 0.05, 0.04], yaw, 1.65, 1.65, 1); }
        for (const t of [-0.76, 0.76]) { const [a, b] = at(0.47, t); B.cbox(a, 0, b, 1.48, 4.6, 0.1, C.teak, yaw);
          for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const [c2, d2] = at(0.54, t - 0.54 + j * 0.36); B.part(geo('stud', () => new THREE.SphereGeometry(0.045, 6, 4)), c2, 0.6 + i * 0.66, d2, C.iron, yaw); } }
        if (side > 0) { const [a, b] = at(0.43, 0); B.board(a, 5.75, b, 3.0, 0.5, (x, w, h) => { x.fillStyle = '#5b544a'; x.fillRect(0, 0, w, h); x.fillStyle = '#efe4cc'; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.font = `800 ${h * 0.42}px Mukta, sans-serif`; x.fillText(mr, w * 0.3, h * 0.52); x.font = `700 ${h * 0.28}px Inter, sans-serif`; x.fillText(en, w * 0.72, h * 0.54); }, 'sw-g-' + en, yaw); }
      }
    }
    const IN = [[W.U0, W.V0], [W.U1, W.V0], [W.U1, W.V1], [W.U0, W.V1]];
    { const iA = B.A(WL.brick, BRICK, 11, 2, 10.6), g0 = W.GU - W.GW / 2 - 0.3, g1 = W.GU + W.GW / 2 + 0.3;      // inner faces, open at the gate
      B.wall(W.U0, W.V0, g0, W.V0, 0, 10.6, 0, 1, iA); B.wall(g1, W.V0, W.U1, W.V0, 0, 10.6, 0, 1, iA);
      B.wall(W.U1, W.V0, W.U1, W.V1, 0, 10.6, -1, 0, iA); B.wall(W.U1, W.V1, W.U0, W.V1, 0, 10.6, 0, -1, iA); B.wall(W.U0, W.V1, W.U0, W.V0, 0, 10.6, 1, 0, iA); }
    { const o = []; for (const [u, v] of ring) { const [x, z] = B.P(u, v); o.push(x, z); }
      const h = []; for (const [u, v] of IN) { const [x, z] = B.P(u, v); h.push(x, z); }
      B.gb.poly([o, h], B.Y0 + 10.6, GL.concrete, 0.85); }
    B.merlons(ring, 10.6, [0.47, 0.26, 0.2], 2.4, 1.3, 1.0, 0.75);
    // the bastion towers standing up out of the lobes
    for (const [u, v, r, H] of W.bastions) {
      const pts = []; for (let i = 0; i < 18; i++) pts.push([u + Math.cos(i / 18 * 6.283) * r, v + Math.sin(i / 18 * 6.283) * r]);
      B.ring(pts, 0, 7.6, sA); B.ring(pts, 7.6, H, bA);
      for (let i = 0; i < 18; i += 2) B.flat([[u, v], pts[i], pts[(i + 1) % 18], pts[(i + 2) % 18]], H, topA);
      B.merlons(pts, H, [0.47, 0.26, 0.2], 2.2, 1.2, 1.0, 0.7);
      for (let i = 0; i < 18; i += 3) { const a = i / 18 * 6.283; B.cbox(u + Math.cos(a) * (r + 0.02), H - 3, v + Math.sin(a) * (r + 0.02), 0.25, 1.4, 0.1, C.dark, a + Math.PI / 2); }
      B.hitc(u, v, r);
    }
    // Delhi Darwaza between its two bastions: the gate block, the arch, the spiked teak doors with the
    // small wicket door you go in by, the nagarkhana gallery and its eave, the saffron jaripatka on top
    const gu = W.GU, gw = W.GW, gv = W.GV;
    B.box(gu, gv + 4.4, gw + 0.6, 9, 0, 9.5, sA, null); B.box(gu, gv + 4.4, gw + 0.6, 9, 9.5, 17.5, bA, B.A(WL.slab, STONE));
    B.arch(gu, gv - 0.12, 6.2, 9.4, 0, [0.12, 0.09, 0.07]);
    B.arch(gu, gv + 9.0, 6.2, 9.4, 0, [0.12, 0.09, 0.07], false, Math.PI);                 // and its inner face, into the fort
    for (const side of [-1, 1]) {
      const du = gu + side * 1.5;
      B.cbox(du, 0, gv - 0.2, 2.9, 7.6, 0.18, C.teak);
      for (let r = 0; r < 4; r++) B.cbox(du, 1.1 + r * 1.7, gv - 0.31, 2.9, 0.09, 0.05, C.iron);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) {
        const su = du - 1.25 + (j + 0.5) * (2.5 / 9), sy = 3.0 + i * 0.32;
        B.part(geo('spike', () => { const g = new THREE.ConeGeometry(0.045, 0.32, 5); g.rotateX(Math.PI / 2); return g; }), su, sy, gv - 0.46, C.iron);
      }
    }
    B.cbox(W.WU, 0, gv - 0.33, 1.25, 2.1, 0.06, [0.05, 0.04, 0.03]);                // the wicket, open
    B.cbox(W.WU, 2.1, gv - 0.34, 1.35, 0.1, 0.08, C.iron);
    for (const k of [-1, 0, 1]) B.arch(gu + k * 3.6, gv - 0.12, 1.5, 2.6, 11.2, C.dark);
    B.cbox(gu, 13.9, gv - 0.9, gw - 1.5, 2.6, 1.6, C.teak); B.cbox(gu, 16.4, gv - 1.0, gw - 0.6, 0.25, 2.0, [0.3, 0.18, 0.1]);
    for (let k = -3; k <= 3; k++) B.cbox(gu + k * 1.25, 13.9, gv - 1.65, 0.18, 2.5, 0.18, [0.3, 0.18, 0.1]);
    B.merlons([[gu - gw / 2 - 0.3, gv - 0.1], [gu + gw / 2 + 0.3, gv - 0.1]], 17.5, C.brick, 2.0, 1.2, 1.0, 0.7, false);
    flag(B, gu, gv + 4.4, 17.5, 7); flag(B, gu - 0.15, gv + 4.4, 17.5, 7);
    // ---- inside: lawns, stone paths, the palace's plinths with their rooms and courtyards, Hazari Karanje
    B.ground(IN, 0.03, GL.grass, 0.95);
    const path = (u0, v0, u1, v1) => B.ground([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 0.05, GL.concrete, 0.9);
    path(gu - 3, W.V0, gu + 3, W.V1);                                              // gate to the south wall
    for (const v of W.cross) path(W.U0 + 3, v - 2.5, W.U1 - 3, v + 2.5);
    path(W.U0, W.V0, W.U1, W.V0 + 3); path(W.U0, W.V1 - 3, W.U1, W.V1); path(W.U0, W.V0, W.U0 + 3, W.V1); path(W.U1 - 3, W.V0, W.U1, W.V1);
    const plA = B.A(WL.rubble, STONE, 11, 2, 0.9), slab = B.A(WL.sandstone, T([0.86, 0.8, 0.7]), 11, 2, 0.9);
    for (const [u, v, w, d] of W.plinths) {
      B.box(u, v, w, d, 0, 0.9, plA, slab);
      const cw = w * 0.42, cd = d * 0.42;
      B.ground([[u - cw / 2, v - cd / 2], [u + cw / 2, v - cd / 2], [u + cw / 2, v + cd / 2], [u - cw / 2, v + cd / 2]], 0.93, GL.grass, 0.9);
      B.cbox(u, 0.9, v, 3.2, 0.35, 3.2, C.stone); B.cbox(u, 1.0, v, 2.6, 0.27, 2.6, C.water);          // the courtyard's little tank
      // rooms: the courtyard's edge, the partitions out to the rim
      for (const [a, b, c2, d2] of [[-cw / 2, -cd / 2, cw / 2, -cd / 2], [cw / 2, -cd / 2, cw / 2, cd / 2], [cw / 2, cd / 2, -cw / 2, cd / 2], [-cw / 2, cd / 2, -cw / 2, -cd / 2],
        [-w / 2 + 0.3, -d / 2 + 0.3, w / 2 - 0.3, -d / 2 + 0.3], [w / 2 - 0.3, -d / 2 + 0.3, w / 2 - 0.3, d / 2 - 0.3], [w / 2 - 0.3, d / 2 - 0.3, -w / 2 + 0.3, d / 2 - 0.3], [-w / 2 + 0.3, d / 2 - 0.3, -w / 2 + 0.3, -d / 2 + 0.3]]) {
        const L2 = Math.hypot(c2 - a, d2 - b); B.cbox(u + (a + c2) / 2, 0.9, v + (b + d2) / 2, L2 + 0.5, 0.28, 0.5, C.stone, Math.atan2(d2 - b, c2 - a));
      }
      for (let k = -2; k <= 2; k++) {
        if (k === 0) continue;
        const fu = k / 2.5 * (w / 2), fv = k / 2.5 * (d / 2);
        B.cbox(u + fu, 0.9, v - (d / 2 + cd / 2) / 2, 0.5, 0.28, (d - cd) / 2 - 0.3, C.stone); B.cbox(u + fu, 0.9, v + (d / 2 + cd / 2) / 2, 0.5, 0.28, (d - cd) / 2 - 0.3, C.stone);
        B.cbox(u - (w / 2 + cw / 2) / 2, 0.9, v + fv * 0.6, (w - cw) / 2 - 0.3, 0.28, 0.5, C.stone); B.cbox(u + (w / 2 + cw / 2) / 2, 0.9, v + fv * 0.6, (w - cw) / 2 - 0.3, 0.28, 0.5, C.stone);
      }
      for (let i = 0; i < 6; i++) for (const sv of [-1, 1]) B.cbox(u - cw / 2 + (i + 0.5) * cw / 6, 0.9, v + sv * (cd / 2 - 0.6), 0.55, 0.45, 0.55, C.stone);   // column stumps
      // three solid steps up from the path side, the rest of the edge a low stone wall you can climb (Space)
      const sgn = u < gu ? 1 : -1, su = u + sgn * w / 2;
      for (let k = 0; k < 3; k++) B.cbox(su + sgn * (1.0 - k * 0.4), 0, v, 0.42, (k + 1) * 0.3, 4.2, C.stone);
      B.deckRamp(su + sgn * 1.25, v, su, v, 4.2, 0.0, 0.9);
      B.deckRect(u, v, w, d, 0.9);
      const e0 = [u - w / 2, v - d / 2], e1 = [u + w / 2, v - d / 2], e2 = [u + w / 2, v + d / 2], e3 = [u - w / 2, v + d / 2];
      B.hitk(...e0, ...e1, 5); B.hitk(...e2, ...e3, 5);
      B.hitk(su, v - d / 2, su, v - 2.2, 5); B.hitk(su, v + 2.2, su, v + d / 2, 5);
      const ou = u - sgn * w / 2; B.hitk(ou, v - d / 2, ou, v + d / 2, 5);
    }
    // Hazari Karanje: the sixteen-petal lotus fountain
    { const [u, v] = W.karanje, pts = []; for (let i = 0; i < 32; i++) { const r = i % 2 ? 4.4 : 6.6, a = i / 32 * 6.283; pts.push([u + Math.cos(a) * r, v + Math.sin(a) * r]); }
      B.ring(pts, 0, 0.75, B.A(WL.rubble, STONE, 11, 2, 0.75)); B.ring(pts, 0, 0.75, B.A(WL.rubble, STONE, 11, 2, 0.75), true); B.ground(pts, 0.6, GL.concrete, 0.8); B.cyl(u, 0.62, v, 3.6, 0.05, C.water, 20);
      B.cyl(u, 0.6, v, 0.55, 1.3, C.stone, 8); B.cone(u, 1.9, v, 0.5, 0.6, C.stone, 8); B.hitc(u, v, 6); }
    // big old trees along the walls
    for (const [u, v, r] of W.trees) {
      B.cyl(u, 0, v, r * 0.11, r * 1.1, [0.33, 0.24, 0.17], 7);
      B.sphere(u, r * 1.55, v, r, [0.17, 0.3, 0.12]); B.sphere(u + r * 0.4, r * 1.25, v - r * 0.3, r * 0.75, [0.2, 0.34, 0.14]);
      B.hitc(u, v, r * 0.13);
    }
    // ---- outside the gate: the garden, Bajirao I on his tall plinth, the ticket window, the plaque
    const sv = gv - 36;
    B.ground([[gu - 18, sv - 15], [gu + 18, sv - 15], [gu + 18, sv + 15], [gu - 18, sv + 15]], 0.04, GL.grass, 0.9);
    path(gu - 2.5, sv + 15, gu + 2.5, gv - 0.4);
    { const pA = B.A(WL.sandstone, T([0.62, 0.57, 0.5]), 11, 2, 3.6), cap = B.A(WL.slab, T([0.7, 0.66, 0.6]));
      B.box(gu, sv, 6.4, 9.0, 0, 0.45, pA, cap); B.box(gu, sv, 5.6, 8.2, 0.45, 0.9, pA, cap);
      B.box(gu, sv, 4.2, 6.8, 0.9, 3.3, pA, null); B.box(gu, sv, 4.8, 7.4, 3.3, 3.6, pA, cap);
      B.cbox(gu, 1.5, sv - 3.42, 2.2, 1.2, 0.05, [0.24, 0.2, 0.13]);
      B.board(gu, 2.1, sv - 3.46, 2.0, 1.05, (x, w, h) => { x.fillStyle = '#3a3122'; x.fillRect(0, 0, w, h); x.fillStyle = '#d9c38c'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = `800 ${h * 0.17}px Mukta, sans-serif`; x.fillText('श्रीमंत बाजीराव पेशवे', w / 2, h * 0.3); x.font = `700 ${h * 0.12}px Inter, sans-serif`; x.fillText('SHRIMANT BAJIRAO PESHWA I', w / 2, h * 0.55);
        x.font = `500 ${h * 0.1}px Inter, sans-serif`; x.fillText('1700 – 1740', w / 2, h * 0.76); }, 'sw-bajirao');
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; B.cyl(gu + Math.cos(a) * 7.2, 0, sv + Math.sin(a) * 9.2, 0.07, 0.75, C.iron, 6); }
      horseman(B, gu, sv, 1.35, 0);
      B.hitBox(gu, sv, 6.4, 9.0); }
    { const [ku, kv] = W.counter;
      B.box(ku, kv, 3.4, 2.4, 0, 2.7, B.A(WL.plaster, T([0.93, 0.86, 0.7]), 2, 2, 2.7), null);
      B.roof(ku, kv, 4.2, 3.2, 2.7, 0.9, B.A(WL.clayTiles, T(C.tile)), true);
      B.cbox(ku, 1.0, kv - 1.22, 1.4, 0.9, 0.06, C.dark);
      B.board(ku, 3.05, kv - 1.75, 3.2, 0.62, (x, w, h) => { x.fillStyle = '#7a1d12'; x.fillRect(0, 0, w, h); x.fillStyle = '#f6e7c8'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = `800 ${h * 0.46}px Mukta, sans-serif`; x.fillText('तिकीट घर', w * 0.3, h * 0.52); x.font = `700 ${h * 0.34}px Inter, sans-serif`; x.fillText('TICKETS  ₹25', w * 0.73, h * 0.53); }, 'sw-tickets');
      B.hitBox(ku, kv, 3.4, 2.4); }
    { const [pu, pv] = W.plaque;
      B.box(pu, pv, 3.2, 0.5, 0, 2.2, B.A(WL.sandstone, STONE), B.A(WL.slab, STONE));
      B.board(pu, 1.25, pv - 0.27, 2.8, 1.5, (x, w, h) => { x.fillStyle = '#2b2620'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9dcc0'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = `800 ${h * 0.2}px Mukta, sans-serif`; x.fillText('शनिवारवाडा', w / 2, h * 0.24); x.font = `800 ${h * 0.15}px Inter, sans-serif`; x.fillText('SHANIWAR WADA', w / 2, h * 0.47);
        x.font = `500 ${h * 0.09}px Inter, sans-serif`; x.fillText('Seat of the Peshwas · 1732', w / 2, h * 0.66); x.fillText('Open 8 am to 6:30 pm', w / 2, h * 0.8); }, 'sw-plaque');
      B.hitBox(pu, pv, 3.2, 0.5);
      // and, being Pune, a patya on its post next to it
      B.cyl(pu + 3.2, 0, pv, 0.06, 1.9, C.iron, 6);
      B.board(pu + 3.2, 1.75, pv - 0.08, 1.3, 0.62, (x, w, h) => { x.fillStyle = '#f6f3ea'; x.fillRect(0, 0, w, h); x.strokeStyle = '#9b1c1c'; x.lineWidth = h * 0.05; x.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#9b1c1c'; x.font = `800 ${h * 0.24}px Mukta, sans-serif`; x.fillText('रात्री १२ नंतर', w / 2, h * 0.32);
        x.fillStyle = '#1a1a1a'; x.fillText('येथे थांबू नये.', w / 2, h * 0.62); x.font = `600 ${h * 0.1}px Inter, sans-serif`; x.fillStyle = '#555'; x.fillText('(do not linger here after midnight)', w / 2, h * 0.86); }, 'sw-patya'); }
    // the hawkers' carts: a painted body, bicycle wheels, a striped umbrella, the name on a board
    for (const [vu, vv, key, name, mr, price, , col] of W.vendors) {
      B.cbox(vu, 0.55, vv, 2.0, 0.7, 1.05, col); B.cbox(vu, 1.25, vv, 2.1, 0.06, 1.15, [0.75, 0.74, 0.7]);
      for (const sd of [-1, 1]) B.part(geo('cartwheel', () => { const g = new THREE.TorusGeometry(0.32, 0.04, 6, 16); return g; }), vu + sd * 0.7, 0.36, vv + 0.56, C.dark, 0);
      B.cyl(vu, 1.3, vv, 0.03, 1.4, C.iron, 5); B.cone(vu, 2.62, vv, 1.25, 0.45, ({ bhel: [0.85, 0.15, 0.15], vadapav: [0.1, 0.35, 0.75], chai: [0.95, 0.85, 0.2], butta: [0.2, 0.55, 0.25], ganne: [0.95, 0.5, 0.1], kulfi: [0.9, 0.3, 0.45] })[key], 8);
      B.board(vu, 1.55, vv - 0.6, 1.5, 0.4, (x, w, h) => { x.fillStyle = '#f7f1e3'; x.fillRect(0, 0, w, h); x.fillStyle = '#9b1c1c'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = `800 ${h * 0.42}px Mukta, sans-serif`; x.fillText(mr, w * 0.5, h * 0.36); x.fillStyle = '#1a1a1a'; x.font = `700 ${h * 0.26}px Inter, sans-serif`; x.fillText(`${name} · ₹${price}`, w * 0.5, h * 0.76); }, 'sw-v-' + key);
      B.hitBox(vu, vv, 2.1, 1.2);
    }
    // collision: the rampart all round, the gate shut except the wicket
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if (W.isGateSeg(a, b)) continue; B.hit(...a, ...b); }
    B.hit(gu - gw / 2 - 0.3, gv, gu + gw / 2 + 0.3, gv);
    B.hitBox(gu, gv + 4.4, gw + 0.6, 9);
    // ---- the rampart walk: up two flights of stone steps inside the north wall, round the top of the walls,
    // with the old cannons on their carriages looking out over the city
    B.deckBand(ring, [[W.U0, W.V0], [W.U1, W.V0], [W.U1, W.V1], [W.U0, W.V1]], 10.6, [gu - gw / 2 - 0.5, gu + gw / 2 + 0.5, gv + 9.2]);
    for (const sgn of [1, -1]) {
      const ua = gu + sgn * 13, ub = gu + sgn * 43, vv = W.V0 + 1.7, n = 30;
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; B.cbox(ua + (ub - ua) * t, 0, vv, 1.02, 10.6 * (k + 1) / n, 3.2, C.stone); }
      B.deckRamp(ua, vv, ub, vv, 3.2, 0, 10.6);
      B.hitk(ua, vv + 1.6, ub, vv + 1.6, 5);
    }
    const cannon = (u, v, yaw) => {
      const fx = Math.sin(yaw), fz = -Math.cos(yaw), at = (a, b) => [u + a * Math.cos(yaw) - b * Math.sin(yaw), v + a * Math.sin(yaw) + b * Math.cos(yaw)];
      B.cbox(u, 10.6, v, 1.2, 0.55, 2.2, C.teak, yaw);
      for (const sd of [-1, 1]) { const [wu, wv] = at(sd * 0.7, 0.3); B.part(geo('wheel', () => { const g = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14); g.rotateZ(Math.PI / 2); return g; }), wu, 10.95, wv, [0.28, 0.17, 0.09], yaw); }
      B.part(geo('barrel', () => { const g = new THREE.CylinderGeometry(0.17, 0.26, 2.6, 12); g.rotateX(Math.PI / 2); return g; }), u + fx * 0.3, 11.35, v + fz * 0.3, [0.13, 0.13, 0.14], yaw);
      void fx;
    };
    for (const u of [gu - 26, gu + 26, -52, 50]) cannon(u, -77.6, 0);
    for (const v of [-45, 40]) { cannon(-69.8, v, -Math.PI / 2); cannon(66.2, v, Math.PI / 2); }
  },

  // Dagdusheth Halwai Ganpati: a white marble temple open to the street, gold everywhere, the idol lit inside
  dagdusheth(B) {
    const hw = B.L.w / 2, hd = B.L.d / 2, fv = -hd;
    const wA = B.A(WL.stucco, WHITE), mA = B.A(WL.slab, WHITE);
    B.cbox(0, 0, 0, B.L.w, 1.0, B.L.d, C.marble);                                   // the plinth
    for (let k = 0; k < 3; k++) B.cbox(0, k * 0.33, fv - 1.2 + k * 0.4, B.L.w - 2, 0.33, 0.8, C.marble);   // steps
    // side and back walls, a dark red sanctum at the back
    B.cbox(-hw + 0.3, 1, (fv + 2 + hd) / 2, 0.6, 7, hd - fv - 2, C.marble); B.cbox(hw - 0.3, 1, (fv + 2 + hd) / 2, 0.6, 7, hd - fv - 2, C.marble);
    B.cbox(0, 1, hd - 0.3, B.L.w, 7, 0.6, C.marble);
    B.cbox(0, 1, hd - 1.2, B.L.w - 2, 7, 0.3, [0.45, 0.04, 0.05]);
    // the idol: on a silver throne under a gold arch, two metres of gold
    const iv = hd - 3.2;
    B.cbox(0, 1, iv, 3.6, 1.1, 2, [0.8, 0.8, 0.82], 0, 0.15);
    B.part(geo('makhar', () => new THREE.TorusGeometry(2.3, 0.22, 8, 24, Math.PI)), 0, 2.2, iv - 0.2, C.gold, 0, 1, 1.25, 1, 0.5);
    B.sphere(0, 2.9, iv, 0.95, C.gold, 0.55);                                      // belly
    B.sphere(0, 4.15, iv, 0.62, C.gold, 0.55);                                     // head
    B.part(geo('trunk', () => { const g = new THREE.TorusGeometry(0.42, 0.13, 6, 12, Math.PI * 1.2); g.rotateY(Math.PI / 2); return g; }), 0.15, 3.65, iv - 0.55, C.gold, 0, 1, 1, 1, 0.55);
    for (const s of [-1, 1]) B.part(geo('ear', () => new THREE.CircleGeometry(0.55, 12)), s * 0.6, 4.2, iv + 0.05, C.gold, s * 0.3, 1, 1.1, 1, 0.5);
    B.cone(0, 4.6, iv, 0.4, 0.9, C.gold, 10, 0.6);                                  // crown
    B.cyl(0, 1.0, iv - 1.2, 1.6, 0.25, C.marigold, 16, 0.2);                        // flowers at the feet
    // the front: four pillars and three scalloped arches, all white with gold bands
    const ys = 1, ph = 6.2;
    for (const u of [-hw + 0.8, -hw / 3, hw / 3, hw - 0.8]) {
      B.cyl(u, ys, fv + 2, 0.45, ph, C.marble, 12);
      for (const y of [ys + 0.4, ys + 3, ys + ph - 0.4]) B.cyl(u, y, fv + 2, 0.52, 0.22, C.gold, 12, 0.2);
    }
    for (const u of [-hw / 1.5, 0, hw / 1.5]) {
      const w = B.L.w / 3 - 1.2;
      B.part(geo('scallop', () => new THREE.TorusGeometry(1, 0.12, 6, 20, Math.PI)), u, ys + ph - w / 2 - 0.2, fv + 2, C.marble, 0, w / 2, w / 2, 1);
      for (let k = 0; k < 5; k++) { const a = (k + 0.5) / 5 * Math.PI; B.sphere(u + Math.cos(a) * w / 2, ys + ph - w / 2 - 0.2 + Math.sin(a) * w / 2, fv + 2, 0.22, C.marble); }
      B.part(geo('garland', () => new THREE.TorusGeometry(1, 0.09, 5, 16, Math.PI)), u, ys + ph - 0.6, fv + 1.8, C.marigold, Math.PI, w / 2.2, 0.9, 1, 0.15);
    }
    B.cbox(0, ys + ph, fv + 2, B.L.w, 1.0, 0.8, C.marble);                          // the beam
    B.cbox(0, ys + ph + 0.35, fv + 1.55, B.L.w, 0.3, 0.1, C.gold, 0, 0.35);
    // upper storey: white with arched niches, a parapet, chhatris at the corners
    B.cbox(0, ys + ph + 1, 1.5, B.L.w, 3.2, B.L.d - 3, C.marble);
    for (let k = -2; k <= 2; k++) B.arch(k * 3.6, fv + 1.45, 1.2, 2.2, ys + ph + 1.5, [0.85, 0.62, 0.2]);
    const top = ys + ph + 4.2;
    for (const [u, v] of [[-hw + 1.5, fv + 3], [hw - 1.5, fv + 3], [-hw + 1.5, hd - 1.5], [hw - 1.5, hd - 1.5]]) {
      for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) B.cyl(u + a, top, v + b, 0.13, 1.6, C.marble, 6);
      B.dome(u, top + 1.6, v, 1.15, 1.2, C.marble); B.cone(u, top + 2.7, v, 0.22, 0.7, C.gold, 8, 0.3);
    }
    // the shikhara over the sanctum: stepped white tiers, gold bands, the kalash and a saffron flag
    let y = top, r = 5.2;
    const sv = hd * 0.25;
    for (let k = 0; k < 7; k++) {
      B.part(geo('tier', () => new THREE.CylinderGeometry(0.82, 1, 1, 8)), 0, y + 0.8, sv, C.marble, Math.PI / 8, r, 1.6, r);
      B.cyl(0, y + 1.6, sv, r * 0.84, 0.15, C.gold, 8, 0.25);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + Math.PI / 8; B.cone(Math.cos(a) * r * 0.86, y + 1.6, sv + Math.sin(a) * r * 0.86, 0.32, 0.9, C.marble, 6); }
      y += 1.6; r *= 0.8;
    }
    B.dome(0, y, sv, r * 1.15, 1.4, C.marble); B.cyl(0, y + 1.3, sv, 0.45, 0.35, C.gold, 10, 0.4);
    B.sphere(0, y + 2.0, sv, 0.42, C.gold, 0.5); B.cone(0, y + 2.3, sv, 0.12, 1.0, C.gold, 8, 0.5);
    B.cyl(0.6, y + 1.6, sv, 0.04, 3.2, C.iron, 5); B.part(geo('flag', () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1.4, -0.35, 0, 0, -0.7, 0], 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)); return g; }), 0.62, y + 4.8, sv, C.saffron, Math.PI / 2);
    // Jay and Vijay, the marble doorkeepers
    for (const s of [-1, 1]) {
      const u = s * (hw - 1.1), v = fv + 0.6;
      B.cbox(u, 1, v, 1.0, 1.0, 1.0, C.marble);
      B.cyl(u, 2, v, 0.32, 1.3, C.marble, 10); B.sphere(u, 3.55, v, 0.28, C.marble); B.cone(u, 3.75, v, 0.24, 0.5, C.gold, 8, 0.3);
      B.cyl(u + s * 0.45, 2, v, 0.06, 2.1, C.gold, 6, 0.2);                           // the mace
    }
    // strings of lights along the front edges
    for (let u = -hw; u <= hw; u += 0.5) B.sphere(u, ys + ph + 1.05, fv + 1.4, 0.06, [1, 0.85, 0.45], 1.5);
    B.hitBox(0, 2, B.L.w, B.L.d - 4); B.hit(-hw, fv, -hw, fv + 2); B.hit(hw, fv, hw, fv + 2);
  },

  // Mahatma Phule Mandai (Reay Market, 1886): an octagonal grey-stone tower over a tiled verandah, eight
  // wings of market halls radiating out, Gothic arches at the end of each
  mandai(B) {
    const R = Math.min(B.L.w, B.L.d) / 2, sA = B.A(WL.rubble, STONE, 5, 0, 12), tile = B.A(WL.clayTiles, T(C.tile)), slab = B.A(WL.slab, STONE);
    const oct = (r, a0 = Math.PI / 8) => { const p = []; for (let i = 0; i < 8; i++) { const a = a0 + i / 8 * 6.283; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; };
    // eight wings
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 6.283, ca = Math.cos(a), sa = Math.sin(a), w = 12, r0 = 12, r1 = R - 1, h = 6.4;
      const q = (t, s) => [ca * t - sa * s, sa * t + ca * s];
      const pts = [q(r0, -w / 2), q(r1, -w / 2), q(r1, w / 2), q(r0, w / 2)];
      B.ring(pts, 0, h, sA);
      // gabled roof along the wing
      const ridge = h + 3.4;
      const P3 = (t, s, y) => { const [u, v] = q(t, s); return [u, y, v]; };
      B.quad([P3(r0, -w / 2 - 0.6, h), P3(r1 + 0.6, -w / 2 - 0.6, h), P3(r1 + 0.6, 0, ridge), P3(r0, 0, ridge)], tile);
      B.quad([P3(r1 + 0.6, w / 2 + 0.6, h), P3(r0, w / 2 + 0.6, h), P3(r0, 0, ridge), P3(r1 + 0.6, 0, ridge)], tile);
      // the gable end: a stone triangle with a Gothic arch below it
      const g0 = P3(r1, -w / 2, h), g1 = P3(r1, w / 2, h), g2 = P3(r1, 0, ridge - 0.2);
      B.quad([g0, g1, g2, g2], sA, [0, h, 0]);
      const [eu, ev] = q(r1 + 0.05, 0);
      B.part(geo('garch', () => { const g = new THREE.BoxGeometry(3.4, 4.2, 0.1); return g; }), eu, 2.1, ev, C.dark, a + Math.PI / 2);
      B.part(geo('garchtop', () => { const g = new THREE.CylinderGeometry(0, 1.9, 1.6, 4); g.rotateY(Math.PI / 4); g.scale(1, 1, 0.05); return g; }), eu, 4.95, ev, C.dark, a + Math.PI / 2);
      for (const s of [-1, 1]) { const [hu, hv] = q(r1 - 0.2, s * w / 2); B.hitc(hu, hv, 0.6); }
      B.hit(...q(r0, -w / 2), ...q(r1, -w / 2)); B.hit(...q(r0, w / 2), ...q(r1, w / 2));
    }
    // the verandah ring and the tower
    const ver = oct(13), tw = oct(8.5), up = oct(6.2);
    for (let i = 0; i < 8; i++) {
      const a = ver[i], b = ver[(i + 1) % 8], c = tw[(i + 1) % 8], d = tw[i];
      B.quad([[a[0], 7.2, a[1]], [b[0], 7.2, b[1]], [c[0], 9.6, c[1]], [d[0], 9.6, d[1]]], tile);
      B.cyl(a[0], 0, a[1], 0.35, 7.2, C.stone, 8);
    }
    B.ring(tw, 0, 14.5, sA);
    B.ring(up, 14.5, 23.5, B.A(WL.rubble, STONE, 5, 0, 24));
    for (let i = 0; i < 8; i++) { const a = tw[i], b = tw[(i + 1) % 8], c = up[(i + 1) % 8], d = up[i]; B.quad([[a[0], 14.5, a[1]], [b[0], 14.5, b[1]], [c[0], 14.5, c[1]], [d[0], 14.5, d[1]]], slab); }
    // the spire: an octagonal slate pyramid with a finial
    for (let i = 0; i < 8; i++) { const a = up[i], b = up[(i + 1) % 8]; B.quad([[a[0] * 1.08, 23.5, a[1] * 1.08], [b[0] * 1.08, 23.5, b[1] * 1.08], [0, 31.5, 0], [0, 31.5, 0]], B.A(WL.slab, T(C.slate)), [0, 24, 0]); }
    B.cyl(0, 31.3, 0, 0.12, 2.4, C.iron, 6); B.sphere(0, 32.2, 0, 0.3, C.iron);
    B.merlons(up, 23.5, C.stone, 1.6, 0.6, 0.7, 0.4);
    B.hitc(0, 0, 8.6);
  },

  // Pune Junction (1925): a long two-storey cream building with arched windows and a tiled roof, an arcaded
  // porch in the middle, the clock tower above it, and the yellow railway name board
  station(B) {
    const hw = B.L.w / 2, hd = B.L.d / 2, fv = -hd;
    const cA = B.A(WL.stucco, CREAM, 12, 0, 10.5), tile = B.A(WL.clayTiles, T(C.tile));
    B.box(0, 0, B.L.w, B.L.d, 0, 10.5, cA, null);
    B.roof(0, 0, B.L.w + 1.2, B.L.d + 1.2, 10.5, 3.6, tile, true);
    // white bands at each floor
    for (const y of [0.9, 5.2, 10.2]) { B.cbox(0, y, fv - 0.08, B.L.w, 0.3, 0.16, C.white); B.cbox(0, y, hd + 0.08, B.L.w, 0.3, 0.16, C.white); }
    // the porch: five arches on pillars, a flat roof with a balustrade
    const pw = 26, pd = 8;
    B.box(0, fv - pd / 2, pw, pd, 6.5, 7.6, B.A(WL.stucco, CREAM), B.A(WL.slab, CREAM));
    for (let k = 0; k <= 5; k++) { const u = -pw / 2 + k * pw / 5; B.cbox(u, 0, fv - pd + 0.4, 0.9, 6.5, 0.9, C.cream); }
    for (let k = 0; k < 5; k++) { const u = -pw / 2 + (k + 0.5) * pw / 5; B.part(geo('parc', () => new THREE.TorusGeometry(1, 0.28, 6, 16, Math.PI)), u, 4.6, fv - pd + 0.4, C.cream, 0, pw / 10 - 0.45, pw / 10 - 0.45, 1.2); }
    for (let u = -pw / 2; u <= pw / 2; u += 0.6) B.cyl(u, 7.6, fv - pd + 0.3, 0.09, 0.8, C.white, 6);
    B.cbox(0, 8.4, fv - pd + 0.3, pw, 0.15, 0.3, C.white);
    // the clock tower
    B.box(0, 0, 8, 8, 10.5, 22.5, B.A(WL.stucco, CREAM, 12, 2, 22.5), null);
    for (const [nu, nv, yaw] of [[0, -1, 0], [0, 1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
      B.part(geo('clock', () => new THREE.CircleGeometry(1.5, 24)), nu * 4.05, 18.5, nv * 4.05, C.white, yaw, 1, 1, 1, 0.6);
      B.part(geo('hand', () => new THREE.BoxGeometry(0.12, 1.1, 0.04)), nu * 4.1, 18.9, nv * 4.1, C.black, yaw);
      B.part(geo('hand2', () => { const g = new THREE.BoxGeometry(0.1, 0.8, 0.04); g.rotateZ(1.2); return g; }), nu * 4.1, 18.4, nv * 4.1, C.black, yaw);
    }
    B.roof(0, 0, 9, 9, 22.5, 5, tile, true);
    B.cyl(0, 27.4, 0, 0.08, 2.2, C.iron, 6);
    // the name board, as on every Indian Railways station
    B.board(0, 9.0, fv - pd - 0.1, 14, 1.9, (x, w, h) => {
      x.fillStyle = '#f3c614'; x.fillRect(0, 0, w, h); x.strokeStyle = '#111'; x.lineWidth = 10; x.strokeRect(8, 8, w - 16, h - 16);
      x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `700 ${Math.round(h * 0.34)}px "Mukta", "Nirmala UI", sans-serif`; x.fillText('पुणे जंक्शन', w * 0.5, h * 0.3);
      x.font = `800 ${Math.round(h * 0.3)}px "Inter", "Arial", sans-serif`; x.fillText('PUNE JN.', w * 0.5, h * 0.72);
    }, 'pune-jn');
    for (let i = 0; i < 4; i++) B.hit(...[[-hw, fv], [hw, fv], [hw, hd], [-hw, hd]][i], ...[[hw, fv], [hw, hd], [-hw, hd], [-hw, fv]][i]);
    for (let k = 0; k <= 5; k++) B.hitc(-pw / 2 + k * pw / 5, fv - pd + 0.4, 0.6);
  },

  // Aga Khan Palace (1892): two storeys of arcades all round, a third storey in the middle with turrets,
  // cream walls, white arches, and the lawns
  agakhan(B) {
    const hw = B.L.w / 2, hd = B.L.d / 2;
    const inA = B.A(WL.plaster, T([0.84, 0.78, 0.64]), 3, 0, 10);
    B.box(0, 0, B.L.w - 5, B.L.d - 5, 0, 10, inA, B.A(WL.slab, CREAM));
    B.ground([[-hw - 6, -hd - 6], [hw + 6, -hd - 6], [hw + 6, hd + 6], [-hw - 6, hd + 6]], 0.03, GL.grass, 0.95);     // its lawn, kept off the roads
    // the arcades on both floors, all four sides
    const side = (ua, va, ub, vb, nu, nv) => {
      const L = Math.hypot(ub - ua, vb - va), n = Math.max(2, Math.round(L / 3.4)), yaw = Math.atan2(vb - va, ub - ua);
      for (let f = 0; f < 2; f++) {
        const y0 = f * 5;
        for (let k = 0; k <= n; k++) { const t = k / n; B.cbox(ua + (ub - ua) * t, y0, va + (vb - va) * t, 0.6, 5, 0.6, C.cream, yaw); }
        for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; B.part(geo('aarc', () => new THREE.TorusGeometry(1, 0.3, 6, 16, Math.PI)), ua + (ub - ua) * t, y0 + 3.4, va + (vb - va) * t, C.white, yaw, L / n / 2 - 0.3, 1.4, 1.5); }
        B.part(geo('band', () => new THREE.BoxGeometry(1, 0.35, 0.7)), (ua + ub) / 2, y0 + 4.82, (va + vb) / 2, C.white, yaw, L + 0.6, 1, 1);
      }
      // the balustrade on the roof
      for (let k = 0; k <= Math.round(L / 0.5); k++) { const t = k / Math.round(L / 0.5); B.cyl(ua + (ub - ua) * t, 10, va + (vb - va) * t, 0.08, 0.8, C.white, 6); }
      B.part(geo('band', () => new THREE.BoxGeometry(1, 0.35, 0.7)), (ua + ub) / 2, 10.95, (va + vb) / 2, C.cream, yaw, L + 0.6, 1, 0.5);
    };
    side(-hw, -hd, hw, -hd, 0, -1); side(hw, -hd, hw, hd, 1, 0); side(hw, hd, -hw, hd, 0, 1); side(-hw, hd, -hw, -hd, -1, 0);
    B.flat([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]], 5.02, B.A(WL.slab, CREAM)); B.flat([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]], 10, B.A(WL.slab, CREAM));
    // the middle block's third storey with a pediment and turrets
    B.box(0, 0, B.L.w - 4, 18, 10, 14.6, B.A(WL.stucco, CREAM, 2, 0, 14.6), B.A(WL.slab, CREAM));
    for (const [u, v] of [[-hw + 2, -9], [hw - 2, -9], [hw - 2, 9], [-hw + 2, 9]]) { B.cyl(u, 14.6, v, 1.1, 1.8, C.cream, 10); B.dome(u, 16.4, v, 1.2, 1.3, C.white); B.cone(u, 17.6, v, 0.15, 0.7, C.gold, 6); }
    B.part(geo('pedi', () => { const g = new THREE.CylinderGeometry(0, 1, 1, 3); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI); g.scale(1, 1, 0.3); return g; }), 0, 15.6, -hd + 0.3, C.cream, 0, 5, 1.8, 1);
    for (let i = 0; i < 4; i++) B.hit(...[[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]][i], ...[[hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]][i]);
  },

  // Lal Mahal: red walls, two storeys, tiled roof, wooden balconies; Jijabai and young Shivaji in the garden
  lalmahal(B) {
    const hd = B.L.d / 2;
    B.box(0, 0, B.L.w, B.L.d, 0, 8.4, B.A(WL.plaster, T([0.66, 0.24, 0.18]), 2, 0, 8.4), null);
    B.roof(0, 0, B.L.w + 1.6, B.L.d + 1.6, 8.4, 4.2, B.A(WL.clayTiles, T(C.tile)), true);
    for (let k = -4; k <= 4; k++) { B.cbox(k * 7.2, 4.4, -hd - 0.6, 3.4, 2.2, 1.2, C.teak); B.cbox(k * 7.2, 6.6, -hd - 0.7, 3.8, 0.2, 1.5, [0.3, 0.18, 0.1]); }
    B.arch(0, -hd - 0.08, 3.4, 4.2, 0, C.teak);
    B.hitBox(0, 0, B.L.w, B.L.d);
  },

  // Ohel David (Lal Deval, 1867): red brick Gothic with a tall tower and spire
  ohel(B) {
    const hd = B.L.d / 2, w = Math.min(B.L.w - 2, 16), L2 = B.L.d - 6;
    B.box(0, 2, w, L2, 0, 10, B.A(WL.brick, RED, 10, 0, 10), null);
    B.roof(0, 2, w + 1, L2 + 1, 10, 6, B.A(WL.slab, T(C.slate)), false);
    const tv = -hd + 3.5;
    B.box(0, tv, 7, 7, 0, 26, B.A(WL.brick, RED, 10, 0, 26), null);
    for (const [u, v] of [[-3.5, tv - 3.5], [3.5, tv - 3.5], [3.5, tv + 3.5], [-3.5, tv + 3.5]]) B.cone(u, 26, v, 0.55, 3, C.brick, 6);
    B.part(geo('spire', () => new THREE.ConeGeometry(1, 1, 8)), 0, 26 + 6, tv, C.slate, Math.PI / 8, 3.6, 12, 3.6);
    for (const [nu, nv, yaw] of [[0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) B.part(geo('clock', () => new THREE.CircleGeometry(1.5, 24)), nu * 3.55, 21, tv + nv * 3.55, C.white, yaw, 0.8, 0.8, 1, 0.4);
    B.arch(0, tv - 3.58, 2.4, 4.6, 0, C.dark, true);
    for (let k = 0; k < 3; k++) B.arch(0, tv - 3.58, 1.0, 3.2, 8 + k * 5.2, C.dark, true);
    B.hitBox(0, 2, w, L2); B.hitBox(0, tv, 7, 7);
  },

  // Tulshibaug Ram Mandir: a hall in front and one of the tallest temple spires in the old city
  tulshibaug(B) {
    const hd = B.L.d / 2;
    B.box(0, -hd / 2, B.L.w, hd, 0, 5.5, B.A(WL.plaster, T([0.9, 0.86, 0.78]), 8, 0, 5.5), B.A(WL.slab, STONE));
    const sv = hd / 2;
    let y = 0, r = Math.min(B.L.w, B.L.d) * 0.5;
    B.box(0, sv, r * 1.6, r * 1.6, 0, 8, B.A(WL.sandstone, STONE, 8, 2, 8), null);
    y = 8;
    for (let k = 0; k < 10; k++) {
      B.part(geo('stier', () => new THREE.CylinderGeometry(0.86, 1, 1, 4)), 0, y + 1.25, sv, C.stone, Math.PI / 4, r, 2.5, r);
      for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + Math.PI / 4; B.cone(Math.cos(a) * r * 0.75, y + 2.5, sv + Math.sin(a) * r * 0.75, 0.35, 1.1, C.stone, 6); }
      y += 2.5; r *= 0.86;
    }
    B.dome(0, y, sv, r * 1.2, 1.5, C.stone); B.sphere(0, y + 1.9, sv, 0.5, C.gold, 0.4); B.cone(0, y + 2.3, sv, 0.15, 1.2, C.gold, 6, 0.4);
    B.hitBox(0, 0, B.L.w, B.L.d);
  },

  // Kasba Ganpati, the city's first deity: an old timber hall under a tiled roof, a small spire, vermilion
  kasba(B) {
    const hw = B.L.w / 2, hd = B.L.d / 2;
    B.box(0, 2, B.L.w - 2, B.L.d - 4, 0, 6, B.A(WL.plaster, T([0.95, 0.88, 0.72]), 2, 0, 6), null);
    B.roof(0, 2, B.L.w, B.L.d - 2, 6, 3.2, B.A(WL.clayTiles, T(C.tile)), true);
    for (let k = 0; k <= 6; k++) B.cbox(-hw + 1 + k * (B.L.w - 2) / 6, 0, -hd + 1.2, 0.45, 5.6, 0.45, C.teak);
    B.cbox(0, 5.6, -hd + 1.2, B.L.w - 1.5, 0.5, 0.6, C.teak);
    B.cbox(0, 0.5, hd - 3.5, 2.4, 2.4, 1.2, C.red, 0, 0.2); B.sphere(0, 2.4, hd - 3.6, 0.7, [0.85, 0.25, 0.08], 0.3);
    let y = 9, r = 3.2;
    for (let k = 0; k < 5; k++) { B.part(geo('tier', () => new THREE.CylinderGeometry(0.82, 1, 1, 8)), 0, y + 0.7, hd - 4, C.white, Math.PI / 8, r, 1.4, r); y += 1.4; r *= 0.8; }
    B.sphere(0, y + 0.4, hd - 4, 0.4, C.gold, 0.4);
    B.hitBox(0, 2, B.L.w - 2, B.L.d - 4);
  },

  // Savitribai Phule Pune University's main building (the old Government House): Italianate grey stone,
  // a long two-storey front with a tall square tower in the middle
  sppu(B) {
    const sA = B.A(WL.sandstone, T([0.78, 0.74, 0.66]), 5, 0, 11);
    B.box(0, 0, B.L.w, B.L.d, 0, 11, sA, B.A(WL.slab, STONE));
    const tw = 9;
    B.box(0, 0, tw, tw, 11, 30, B.A(WL.sandstone, T([0.78, 0.74, 0.66]), 5, 0, 30), B.A(WL.slab, STONE));
    for (const [nu, nv, yaw] of [[0, -1, 0], [0, 1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
      B.part(geo('clock', () => new THREE.CircleGeometry(1.5, 24)), nu * (tw / 2 + 0.05), 26, nv * (tw / 2 + 0.05), C.white, yaw, 1.2, 1.2, 1, 0.4);
      B.part(geo('hand', () => new THREE.BoxGeometry(0.12, 1.1, 0.04)), nu * (tw / 2 + 0.1), 26.4, nv * (tw / 2 + 0.1), C.black, yaw);
    }
    B.merlons([[-tw / 2, -tw / 2], [tw / 2, -tw / 2], [tw / 2, tw / 2], [-tw / 2, tw / 2]], 30, C.stone, 1.5, 0.7, 0.9, 0.5);
    B.roof(0, 0, tw + 0.4, tw + 0.4, 30.9, 3.5, B.A(WL.slab, T(C.slate)), true);
    B.merlons([[-B.L.w / 2, -B.L.d / 2], [B.L.w / 2, -B.L.d / 2], [B.L.w / 2, B.L.d / 2], [-B.L.w / 2, B.L.d / 2]], 11, C.stone, 2.2, 0.9, 0.8, 0.5);
    B.hitBox(0, 0, B.L.w, B.L.d);
  },

  // College of Engineering Pune (1854 campus, the 1912 main building): grey basalt Gothic with a central tower
  coep(B) {
    const fv = -B.L.d / 2, w = Math.min(B.L.w, 110), d = 16;
    const sA = B.A(WL.rubble, STONE, 10, 0, 12);
    B.box(0, fv + d / 2 + 4, w, d, 0, 12, sA, null);
    B.roof(0, fv + d / 2 + 4, w + 1, d + 1, 12, 4, B.A(WL.slab, T(C.slate)), true);
    B.box(0, fv + 4 + d / 2, 10, 10, 12, 27, B.A(WL.rubble, STONE, 10, 0, 27), null);
    for (const [u, v] of [[-5, fv - 1], [5, fv - 1], [5, fv + 9 + 4], [-5, fv + 9 + 4]]) B.cone(u, 27, v, 0.6, 3.4, C.stone, 6);
    B.part(geo('spire', () => new THREE.ConeGeometry(1, 1, 8)), 0, 27 + 5, fv + 4 + d / 2, C.slate, Math.PI / 8, 4.2, 10, 4.2);
    for (const [nu, yaw] of [[-1, 0]]) B.part(geo('clock', () => new THREE.CircleGeometry(1.5, 24)), 0, 22.5, fv + 4 + d / 2 - 5.05, C.white, yaw, 1.1, 1.1, 1, 0.4);
    B.arch(0, fv + 3.9, 4, 6.5, 0, C.dark, true);
    B.hitBox(0, fv + d / 2 + 4, w, d);
  },

  // Parvati: the Peshwas' hilltop temples over the city. Basalt walls round the summit, the Devdeveshwar temple
  // (a panchayatan: Shiva's spire with four smaller shrines at the corners of its court), the Vishnu, Vitthal and
  // Kartikeya temples, the Peshwa museum, and the nagarkhana gateway where the 108 steps come up
  parvati(B) {
    const L = B.L, ring = L.outline, hw = L.w / 2, hd = L.d / 2;
    const sA = B.A(WL.rubble, STONE, 11, 2, 5), wA = B.A(WL.stucco, WHITE, 11, 2, 6);
    B.ring(ring, -4, 4.2, sA);
    B.merlons(ring, 4.2, C.stone, 2.6, 1.2, 0.9, 0.6);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[(i - 1 + ring.length) % ring.length], c = ring[i], q = ring[(i + 1) % ring.length];
      const a1 = Math.atan2(c[1] - p[1], c[0] - p[0]), a2 = Math.atan2(q[1] - c[1], q[0] - c[0]);
      let t = Math.abs(a2 - a1); if (t > Math.PI) t = 2 * Math.PI - t;
      if (t > 0.5) { B.cyl(c[0], -4, c[1], 4, 10, C.stone, 14); B.merlons(Array.from({ length: 12 }, (_, k) => [c[0] + Math.cos(k / 12 * 6.283) * 4, c[1] + Math.sin(k / 12 * 6.283) * 4]), 6, C.stone, 2.1, 1.0, 0.8, 0.5); B.hitc(c[0], c[1], 4); }
    }
    B.ground(ring, 0.05, GL.concrete, 0.95);
    // Devdeveshwar in its court
    const [tu, tv] = L.anchors && L.anchors.temple ? L.anchors.temple : [0, 0];
    B.ring([[tu - 17, tv - 19], [tu + 17, tv - 19], [tu + 17, tv + 19], [tu - 17, tv + 19]], 0, 5, wA);
    B.merlons([[tu - 17, tv - 19], [tu + 17, tv - 19], [tu + 17, tv + 19], [tu - 17, tv + 19]], 5, C.white, 2.0, 0.9, 0.8, 0.5);
    B.cbox(tu, 0, tv - 19.1, 3.6, 4.2, 0.3, C.dark);                                   // the court's gate
    B.cbox(tu, 0, tv + 2, 13, 1.4, 18, C.black);                                       // black stone plinth
    B.box(tu, tv - 3, 9, 8, 1.4, 6.6, B.A(WL.rubble, T([0.3, 0.29, 0.28]), 11, 2, 6.6), null);
    B.dome(tu, 6.6, tv - 3, 3.6, 2.6, C.white); B.cone(tu, 9.1, tv - 3, 0.3, 1.2, C.gold, 8, 0.3);
    B.box(tu, tv + 5, 7, 7, 1.4, 7.6, B.A(WL.rubble, T([0.3, 0.29, 0.28]), 11, 2, 7.6), null);
    const top = shikhara(B, tu, tv + 5, 7.6, 4.0, 10, C.white);
    flag(B, tu, tv + 5, top - 0.6, 3.5);
    for (const [a, b] of [[-11, -12], [11, -12], [11, 13], [-11, 13]]) { B.box(tu + a, tv + b, 4.4, 4.4, 0, 4.2, wA, null); shikhara(B, tu + a, tv + b, 4.2, 2.1, 6, C.white); }
    B.hitBox(tu, tv, 34, 38);
    // the other temples and the museum across the hilltop
    const sp = (fu, fv) => [Math.max(-hw + 12, Math.min(hw - 12, fu)), Math.max(-hd + 10, Math.min(hd - 10, fv))];
    { const [u, v] = sp(tu - 55, tv + 6); B.box(u, v, 9, 9, 0, 5.5, B.A(WL.rubble, STONE, 11, 2, 5.5), null); shikhara(B, u, v, 5.5, 3.2, 8, C.cream); B.hitBox(u, v, 9, 9); }      // Vishnu
    { const [u, v] = sp(tu - 85, tv - 4); B.box(u, v, 7, 7, 0, 4.8, wA, null); shikhara(B, u, v, 4.8, 2.6, 7, C.white); B.hitBox(u, v, 7, 7); }                                    // Vitthal
    { const [u, v] = sp(tu + 60, tv + 10); B.box(u, v, 7, 7, 0, 5, wA, null); B.dome(u, 5, v, 3.4, 4.2, C.white); B.cone(u, 9.2, v, 0.3, 1.4, C.gold, 8, 0.3); flag(B, u, v, 10, 3); B.hitBox(u, v, 7, 7); }   // Kartikeya
    { const [u, v] = sp(tu + 32, tv - 22); B.box(u, v, 20, 9, 0, 6, B.A(WL.plaster, CREAM, 2, 0, 6), null); B.roof(u, v, 21, 10, 6, 2.6, B.A(WL.clayTiles, T(C.tile)), true); B.hitBox(u, v, 20, 9); }   // Peshwa museum
    // the nagarkhana: the gateway on the city side, a drum gallery over the arch
    { const [u] = sp(tu, 0), v = -hd + 4;
      B.box(u, v, 11, 8, -4, 8.5, sA, null); B.arch(u, v - 4.05, 4.2, 6, 0, C.dark);
      B.box(u, v, 11.5, 8.5, 8.5, 11.5, B.A(WL.plaster, CREAM, 2, 2, 11.5), null);
      for (let k = -2; k <= 2; k++) B.arch(u + k * 2.1, v - 4.3, 1.2, 2.2, 8.9, C.dark);
      B.roof(u, v, 12.6, 9.6, 11.5, 2.4, B.A(WL.clayTiles, T(C.tile)), true);
      for (const k of [-1, 1]) B.hitBox(u + k * 4.5, v, 2, 8); }
    for (let i = 0; i < ring.length; i++) B.hit(...ring[i], ...ring[(i + 1) % ring.length]);
  },

  // Shinde Chhatri (Wanowrie): Mahadji Shinde's memorial, Rajasthani in yellow sandstone. A two-storey hall
  // with cusped arches, little domed chhatris along the parapet, the Shiva temple's spire behind, and
  // Mahadji's own domed samadhi to one side, in a walled garden
  shinde(B) {
    const L = B.L, hd = L.d / 2, ring = L.outline;
    const SAND = T([0.93, 0.8, 0.56]), sand = [0.93, 0.8, 0.56], sA = B.A(WL.sandstone, SAND, 11, 2, 6);
    B.ring(ring, 0, 1.8, sA); B.ground(ring, 0.04, GL.tiles, 0.95);
    const w = Math.min(30, L.w * 0.45), v0 = 2;
    B.box(0, v0, w, 16, 0, 6.5, sA, null);
    for (let k = -4; k <= 4; k++) B.arch(k * (w / 9.5), v0 - 8.05, 2.4, 4.6, 0.3, C.dark, true);
    B.cbox(0, 6.5, v0, w + 1, 0.5, 17, sand);
    B.box(0, v0 + 1, w - 4, 13, 7, 11.5, sA, B.A(WL.slab, SAND));
    for (let k = -4; k <= 4; k++) B.arch(k * ((w - 4) / 9.5), v0 + 1 - 6.55, 1.5, 3, 7.6, C.dark, true);
    B.merlons([[-w / 2, v0 - 8], [w / 2, v0 - 8]], 7, sand, 1.6, 0.6, 0.7, 0.4, false);
    for (const [a, b] of [[-w / 2 + 1.5, v0 - 6.5], [w / 2 - 1.5, v0 - 6.5], [-w / 2 + 1.5, v0 + 7], [w / 2 - 1.5, v0 + 7], [-w / 4, v0 - 7], [w / 4, v0 - 7]]) chhatri(B, a, b, 7, 2.2, sand, C.cream);
    B.box(0, v0 + 4, 8, 8, 11.5, 14, sA, null);
    const top = shikhara(B, 0, v0 + 4, 14, 4.2, 9, sand);
    flag(B, 0, v0 + 4, top - 0.6, 3);
    // Mahadji's samadhi: a platform and a big chhatri
    const su = -w / 2 - 10, sv = v0 + 2;
    B.box(su, sv, 8, 8, 0, 1.4, sA, B.A(WL.slab, T(C.marble)));
    chhatri(B, su, sv, 1.4, 6, sand, C.cream);
    // the gate in the garden wall
    B.box(0, -hd + 1, 5, 2.4, 0, 5, sA, null); B.arch(0, -hd - 0.25, 2.6, 3.6, 0, C.dark, true); chhatri(B, 0, -hd + 1, 5, 1.8, sand, C.cream);
    B.hitBox(0, v0, w, 16); B.hitBox(su, sv, 8, 8);
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if (Math.abs(a[1] + hd) + Math.abs(b[1] + hd) > 2) B.hit(...a, ...b); }
  },

  // Omkareshwar (1740s), on the river by Shaniwar Wada: a basalt temple with one of the old city's tallest
  // spires, a domed hall in front, a Nandi pavilion, all inside a stone wall
  omkareshwar(B) {
    const L = B.L, ring = L.outline, hd = L.d / 2;
    const DARK = T([0.36, 0.33, 0.3]), dA = B.A(WL.rubble, DARK, 11, 2, 7), dark = [0.36, 0.33, 0.3];
    B.ring(ring, 0, 3.4, B.A(WL.rubble, STONE, 11, 2, 3.4)); B.ground(ring, 0.04, GL.concrete, 0.95);
    B.cbox(0, 0, 2, 14, 1.2, 24, dark);
    B.box(0, -4, 10, 10, 1.2, 6.8, dA, null); B.dome(0, 6.8, -4, 4.2, 3, dark); B.cone(0, 9.7, -4, 0.3, 1.4, C.gold, 8, 0.3);
    for (const [a, b] of [[-4.6, -8.6], [4.6, -8.6], [-4.6, 0.4], [4.6, 0.4]]) B.dome(a, 6.8, b, 0.9, 0.9, dark);
    B.arch(0, -9.05, 2.6, 4, 1.2, C.dark);
    B.box(0, 6, 8, 8, 1.2, 8, dA, null);
    const top = shikhara(B, 0, 6, 8, 4.0, 11, [0.46, 0.43, 0.4]);
    flag(B, 0, 6, top - 0.6, 3);
    { const v = -hd + 7; for (const [a, b] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) B.cyl(a, 0.8, v + b, 0.25, 3, C.stone, 8); B.cbox(0, 0, v, 4.4, 0.8, 4.4, dark); B.dome(0, 3.8, v, 2.3, 1.8, dark); B.cbox(0, 0.8, v, 1.0, 1.0, 1.8, C.black); }
    B.hitBox(0, 2, 14, 24);
    for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; if (Math.abs(a[1] + hd) + Math.abs(b[1] + hd) > 2) B.hit(...a, ...b); }
  },

  // St. Mary's Church (1825), the oldest in the Deccan: white Gothic with a square tower and spire in front
  stmary(B) {
    const L = B.L, hd = L.d / 2, w = Math.min(14, L.w - 4), d = L.d - 10;
    const cA = B.A(WL.stucco, T([0.96, 0.94, 0.88]), 10, 2, 10);
    B.box(0, 3, w, d, 0, 10, cA, null);
    roofV(B, 0, 3, w + 1, d + 0.6, 10, 5.5, B.A(WL.slab, T([0.32, 0.3, 0.3])));
    gable(B, 0, 3 + d / 2, w, 10, 5.5, cA, true);
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) B.arch(side * (w / 2 + 0.05), 3 - d / 2 + 3 + k * (d - 6) / 4, 1.4, 4.6, 3, C.dark, true, side * Math.PI / 2);
    const tv = -hd + 4.2;
    B.box(0, tv, 6.6, 6.6, 0, 21, B.A(WL.stucco, T([0.97, 0.95, 0.9]), 10, 2, 21), B.A(WL.slab, T(C.white)));
    for (const [a, b] of [[-3.3, -3.3], [3.3, -3.3], [3.3, 3.3], [-3.3, 3.3]]) B.cone(a, 21, tv + b, 0.45, 2.6, C.white, 6);
    B.part(geo('spire', () => new THREE.ConeGeometry(1, 1, 8)), 0, 21 + 7, tv, C.white, Math.PI / 8, 2.9, 14, 2.9);
    B.cyl(0, 35, tv, 0.06, 1.6, C.iron, 4); B.cbox(0, 35.9, tv, 0.9, 0.08, 0.08, C.iron);
    B.part(geo('clock', () => new THREE.CircleGeometry(1.5, 24)), 0, 17, tv - 3.35, C.white, 0, 0.8, 0.8, 1, 0.4);
    B.arch(0, tv - 3.35, 2.4, 4.4, 0, C.dark, true); B.arch(0, tv - 3.35, 1.1, 3, 9, C.dark, true);
    B.hitBox(0, 3, w, d); B.hitBox(0, tv, 6.6, 6.6);
  },

  // Vishrambaug Wada (1807), Bajirao II's mansion on Bajirao Road: a long three-storey front with the famous
  // carved teak balcony over the gate, teak pillars along the street, a tiled roof
  vishrambaug(B) {
    const L = B.L, hd = L.d / 2, w = L.w, fv = -hd;
    B.box(0, 0, w, L.d, 0, 11.2, B.A(WL.plaster, T([0.93, 0.87, 0.74]), 2, 0, 11.2), null);
    B.roof(0, 0, w + 1.2, L.d + 1.2, 11.2, 3, B.A(WL.clayTiles, T(C.tile)), true);
    for (let k = 0; k <= Math.floor(w / 3); k++) { const u = -w / 2 + 0.4 + k * (w - 0.8) / Math.floor(w / 3); B.cbox(u, 0, fv + 0.3, 0.4, 3.9, 0.4, C.teak); }
    B.cbox(0, 3.9, fv - 0.6, w, 0.45, 0.7, C.teak); B.cbox(0, 4.3, fv - 0.9, w + 0.4, 0.15, 1.4, [0.3, 0.18, 0.1]);
    // the balcony: carved teak, its own little roof, brackets under
    const bw = Math.min(13, w * 0.3);
    B.cbox(0, 4.5, fv - 1.1, bw, 3.9, 1.8, [0.33, 0.2, 0.1]);
    for (let k = 0; k < 22; k++) B.cbox(-bw / 2 + 0.3 + k * (bw - 0.6) / 21, 5.1, fv - 2.05, 0.12, 2.6, 0.08, [0.22, 0.13, 0.07]);
    for (let k = -2; k <= 2; k++) { B.arch(k * bw / 5.2, fv - 2.1, 1.2, 2.2, 5.4, [0.12, 0.08, 0.05]); B.cbox(k * bw / 5.2, 4.1, fv - 1.6, 0.25, 0.4, 1.2, C.teak); }
    B.quad([[-bw / 2 - 0.4, 8.6, fv - 2.4], [bw / 2 + 0.4, 8.6, fv - 2.4], [bw / 2 + 0.4, 9.4, fv - 0.2], [-bw / 2 - 0.4, 9.4, fv - 0.2]], B.A(WL.clayTiles, T(C.tile)));
    B.arch(0, fv - 0.05, 3.4, 3.8, 0, C.teak);
    for (let f = 0; f < 2; f++) for (let k = -7; k <= 7; k++) { if (Math.abs(k) < 3) continue; B.cbox(k * w / 15.5, 5 + f * 3.1, fv - 0.06, 1.0, 1.7, 0.1, [0.18, 0.11, 0.06]); }
    B.hitBox(0, 0, w, L.d);
  },

  // Fergusson College's main building: grey basalt, two storeys of pointed arches, a central tower
  fergusson(B) {
    const L = B.L, w = Math.min(L.w, 60), d = Math.min(L.d, 16), fv = -L.d / 2;
    const sA = B.A(WL.rubble, T([0.5, 0.48, 0.45]), 10, 2, 11);
    B.box(0, fv + d / 2, w, d, 0, 11, sA, null);
    B.roof(0, fv + d / 2, w + 1, d + 1, 11, 3.6, B.A(WL.clayTiles, T([0.55, 0.28, 0.2])), true);
    for (let f = 0; f < 2; f++) for (let k = -9; k <= 9; k++) B.arch(k * (w / 19.5), fv - 0.05, 1.5, 3.4, 0.8 + f * 5.2, C.dark, true);
    const tv = fv + 3.5;
    B.box(0, tv, 8, 8, 0, 23, B.A(WL.rubble, T([0.5, 0.48, 0.45]), 10, 2, 23), null);
    B.arch(0, tv - 4.05, 3, 5, 0, C.dark, true);
    B.part(geo('clock', () => new THREE.CircleGeometry(1.5, 24)), 0, 19, tv - 4.06, C.white, 0, 1, 1, 1, 0.4);
    B.merlons([[-4, tv - 4], [4, tv - 4], [4, tv + 4], [-4, tv + 4]], 23, C.stone, 1.6, 0.7, 0.8, 0.5);
    B.roof(0, tv, 8.4, 8.4, 23.8, 4.5, B.A(WL.slab, T(C.slate)), true);
    for (const [a, b] of [[-4, tv - 4], [4, tv - 4], [4, tv + 4], [-4, tv + 4]]) B.cone(a, 23.8, b, 0.4, 2.4, C.stone, 6);
    B.hitBox(0, fv + d / 2, w, d); B.hitBox(0, tv, 8, 8);
  },

  // Chaturshringi: the goddess's temple up the hillside on Senapati Bapat Road, a white and saffron spire over
  // a pillared hall, steps down the slope
  chaturshringi(B) {
    const L = B.L, hd = L.d / 2, w = Math.min(L.w, 26), d = Math.min(L.d, 26);
    const wA = B.A(WL.stucco, WHITE, 11, 2, 7);
    B.ground([[-L.w / 2, -hd], [L.w / 2, -hd], [L.w / 2, hd], [-L.w / 2, hd]], 0.05, GL.tiles, 0.95);
    B.box(0, -d / 4, w, d / 2, 0, 6, wA, null);
    for (let k = -3; k <= 3; k++) B.arch(k * w / 7.5, -d / 2 - 0.05, 1.8, 3.8, 0.4, C.dark);
    for (const a of [-w / 3, 0, w / 3]) { B.dome(a, 6, -d / 4, 2.2, 2, C.white); B.cone(a, 8, -d / 4, 0.2, 1, C.gold, 6, 0.3); }
    B.box(0, d / 4, 10, 10, 0, 8, wA, null);
    const top = shikhara(B, 0, d / 4, 8, 5, 10, [0.97, 0.66, 0.3]);
    flag(B, 0, d / 4, top - 0.6, 3.5);
    for (let k = 0; k < 18; k++) B.cbox(0, -0.45 * (k + 1), -hd - 0.8 * k - 0.4, 6, 0.45, 0.8, C.stone);
    B.hitBox(0, 0, w, d);
  },

  // Osho's meditation resort: black buildings in a garden, the great black pyramid auditorium
  osho(B) {
    const s = Math.min(B.L.w, B.L.d) * 0.6;
    B.ground([[-B.L.w / 2, -B.L.d / 2], [B.L.w / 2, -B.L.d / 2], [B.L.w / 2, B.L.d / 2], [-B.L.w / 2, B.L.d / 2]], 0.03, GL.grass, 0.85);
    B.box(0, 0, s, s, 0, 3, B.A(WL.cladding, T([0.07, 0.07, 0.08]), 9, 2, 3), null);
    const h = s * 0.42, k = [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]];
    for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4]; B.quad([[a[0], 3, a[1]], [b[0], 3, b[1]], [0, 3 + h, 0], [0, 3 + h, 0]], B.A(WL.cladding, T([0.05, 0.05, 0.06]), 9, 2, 3 + h), [0, 4, 0]); }
    B.hitBox(0, 0, s, s);
  },
};

// a ring moved inward by d (a convex-ish outline; good enough for rampart thickness)
function shrink(ring, d) {
  let cu = 0, cv = 0; for (const [u, v] of ring) { cu += u; cv += v; } cu /= ring.length; cv /= ring.length;
  const n = ring.length, out = [];
  let area = 0; for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const p = ring[(i - 1 + n) % n], c = ring[i], q = ring[(i + 1) % n];
    const n1 = norm2(s * (c[1] - p[1]), -s * (c[0] - p[0])), n2 = norm2(s * (q[1] - c[1]), -s * (q[0] - c[0]));
    let nx = n1[0] + n2[0], nz = n1[1] + n2[1]; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    const cosH = Math.max(0.35, nx * n1[0] + nz * n1[1]);
    out.push([c[0] - nx * d / cosH, c[1] - nz * d / cosH]);
  }
  return out;
}
function norm2(x, z) { const L = Math.hypot(x, z) || 1; return [x / L, z / L]; }

export const LANDMARKS = LM;
// register: each landmark builds with the chunk its centre is in; its collision is permanent
export function addLandmarks(W) {
  const { index, collision } = W;
  W.landmarks = [];
  for (const L of LM) {
    if (!BUILD[L.id]) continue;
    const ci = index.chunkOf(L.x, L.z);
    if (ci < 0) continue;
    const c = index.chunks[ci];
    if (!L.far) c.extras.push({ kind: 'landmark', id: L.id });     // the far ones are built once, for good (propsChunk)
    W.landmarks.push(L);
    // collision is worked out once by a dry run of the builder
    const col = [];
    const B = new LB(L, { fb: nullB(), gb: nullB(), cb: nullB(), group: { add() {} }, mm: new THREE.Matrix4() });
    B.col = col;
    try { BUILD[L.id](B); } catch (e) { console.warn('landmark', L.id, e); }
    for (const h of col) { if (h[0] === 's') collision.addSeg(h[1], h[2], h[3], h[4], h[5] || 0); else collision.addCircle(h[1], h[2], h[3], 0); }
    if (B.decks) for (const d of B.decks) addDeck(W, L, d);
  }
}
// a deck in world terms: a box to test first, then the height (above the landmark's base) or -1
function addDeck(W, L, d) {
  const c = Math.cos(L.rot), s = Math.sin(L.rot), base = BASE + (L.y || 0);
  const loc = (x, z) => { const dx = x - L.x, dz = z - L.z; return [dx * c + dz * s, dx * s - dz * c]; };
  let pts, h;
  if (d.t === 'rect') { pts = [[d.u - d.w / 2, d.v - d.d / 2], [d.u + d.w / 2, d.v + d.d / 2]]; h = (u, v) => Math.abs(u - d.u) <= d.w / 2 && Math.abs(v - d.v) <= d.d / 2 ? d.h : -1; }
  else if (d.t === 'ramp') {
    const ax = d.u1 - d.u0, av = d.v1 - d.v0, L2 = ax * ax + av * av, len = Math.sqrt(L2);
    pts = [[Math.min(d.u0, d.u1) - d.w, Math.min(d.v0, d.v1) - d.w], [Math.max(d.u0, d.u1) + d.w, Math.max(d.v0, d.v1) + d.w]];
    h = (u, v) => { const t = ((u - d.u0) * ax + (v - d.v0) * av) / L2, off = Math.abs((u - d.u0) * av - (v - d.v0) * ax) / len; return t >= 0 && t <= 1 && off <= d.w / 2 ? d.h0 + (d.h1 - d.h0) * t : -1; };
  } else {
    pts = d.ring;
    const inside = (u, v, r) => { let o = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [ui, vi] = r[i], [uj, vj] = r[j]; if ((vi > v) !== (vj > v) && u < (uj - ui) * (v - vi) / (vj - vi) + ui) o = !o; } return o; };
    const [[a0, b0], , [a1, b1]] = d.inner;
    h = (u, v) => (u > a0 && u < a1 && v > b0 && v < b1) || (d.skip && u > d.skip[0] && u < d.skip[1] && v < d.skip[2]) || !inside(u, v, d.ring) ? -1 : d.h;
  }
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  const us = pts.map(q => q[0]), vs = pts.map(q => q[1]);
  for (const u of [Math.min(...us), Math.max(...us)]) for (const v of [Math.min(...vs), Math.max(...vs)]) { const x = L.x + u * c + v * s, z = L.z + u * s - v * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  (W.surf.decks || (W.surf.decks = [])).push({ bb: [x0, z0, x1, z1], h: (x, z) => { const [u, v] = loc(x, z), y = h(u, v); return y < 0 ? -1 : base + y; } });
}
function nullB() { return { wall() {}, flat() {}, poly() {}, addGeo() {}, v() { return 0; }, i: [] }; }
// build one landmark into a chunk's builders
export function buildLandmark(W, id, b) {
  const L = LM.find(x => x.id === id);
  if (!L || !BUILD[id]) return;
  const B = new LB(L, b); B.col = [];
  BUILD[id](B);
}
