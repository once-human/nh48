// The 108 ambulance (a Force Traveller-style high-roof van) and the Pune Police jeep (a Bolero-style box SUV), built
// properly: a rounded body from a side profile, glass that sits on it, wheels that turn, the light bar, the livery
// in Marathi and English, grille, lamps, mirrors, bumpers. Each returns { group, wheels, lights: { red, blue },
// dims, seats } in the vehicle's own frame (x forward, y up, +z the right-hand side where the driver sits).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAT = {};
function mat(key, make) { return MAT[key] || (MAT[key] = make()); }
const std = (color, roughness = 0.5, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  paint: () => mat('paint', () => std(0xf4f5f2, 0.32, 0.05)),
  black: () => mat('black', () => std(0x16171a, 0.6)),
  trim: () => mat('trim', () => std(0x2a2c30, 0.45)),
  chrome: () => mat('chrome', () => std(0xc9ccd0, 0.22, 0.9)),
  tyre: () => mat('tyre', () => std(0x141414, 0.9)),
  rim: () => mat('rim', () => std(0xb8bcc2, 0.3, 0.7)),
  glass: () => mat('glass', () => new THREE.MeshStandardMaterial({ color: 0x1a232b, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.72 })),
  frost: () => mat('frost', () => std(0xdfe5ea, 0.35, 0.1)),
  head: () => mat('head', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dd, emissiveIntensity: 0.6, roughness: 0.2 })),
  tail: () => mat('tail', () => new THREE.MeshStandardMaterial({ color: 0x8a0d0d, emissive: 0xff1a1a, emissiveIntensity: 0.4, roughness: 0.3 })),
  amber: () => mat('amber', () => new THREE.MeshStandardMaterial({ color: 0xc87a10, emissive: 0xff9a1a, emissiveIntensity: 0.3, roughness: 0.3 })),
  red: () => mat('red', () => new THREE.MeshBasicMaterial({ color: 0xff2424, toneMapped: false })),
  blue: () => mat('blue', () => new THREE.MeshBasicMaterial({ color: 0x2a5cff, toneMapped: false })),
  redOff: () => mat('redOff', () => std(0x5a0c0c, 0.25)),
  blueOff: () => mat('blueOff', () => std(0x0c1a5a, 0.25)),
};

// a canvas texture, drawn once
const TEX = {};
function canvasMat(key, w, h, draw, opts = {}) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d', { willReadFrequently: true }), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (TEX[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, transparent: !!opts.transparent, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
}
function starOfLife(x, cx, cy, r, col) {
  x.save(); x.translate(cx, cy); x.fillStyle = col;
  for (let k = 0; k < 3; k++) { x.save(); x.rotate(k * Math.PI / 3); x.fillRect(-r * 0.2, -r, r * 0.4, r * 2); x.restore(); }
  x.fillStyle = '#fff'; x.fillRect(-r * 0.04, -r * 0.7, r * 0.08, r * 1.4);
  x.beginPath(); x.arc(0, -r * 0.42, r * 0.12, 0, 6.283); x.fill();
  x.restore();
}
function redCross(x, cx, cy, r) { x.fillStyle = '#d61f1f'; x.fillRect(cx - r * 0.3, cy - r, r * 0.6, r * 2); x.fillRect(cx - r, cy - r * 0.3, r * 2, r * 0.6); }

// a body from a side profile (x, y points), extruded across the width with rounded edges
function profileBody(pts, W, bevel = 0.06) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
  const depth = W - bevel * 2;
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, steps: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals();
  return g;
}
const boxG = (x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };
// a flat panel on a side of the body (+z or -z), facing out
function sidePanel(x0, y0, x1, y1, z, side, slantFront = 0) {
  const s = new THREE.Shape(); s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1 - slantFront, y1); s.lineTo(x0, y1); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  if (side < 0) { g.scale(1, 1, -1); g.index && g.setIndex([...g.index.array].reverse()); }
  g.translate(0, 0, z * side);
  g.computeVertexNormals();
  return g;
}
// a quad between two points on the profile (windscreen, rear glass), spanning the width, nudged out along its normal
function slopePanel(a, b, W, out = 0.07) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L;      // outward for a profile drawn clockwise from the front
  const g = new THREE.PlaneGeometry(L, W);
  g.rotateX(-Math.PI / 2);                    // in x-z
  g.rotateZ(Math.atan2(dy, dx));
  g.translate((a[0] + b[0]) / 2 + nx * out, (a[1] + b[1]) / 2 + ny * out, 0);
  return g;
}
function add(group, geos, material) {
  const g = geos.length > 1 ? mergeGeometries(geos.map(q => q.index ? q.toNonIndexed() : q), false) : geos[0];
  const m = new THREE.Mesh(g, material); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
}
function wheels(group, list, r, w) {
  const out = [];
  const tyre = new THREE.CylinderGeometry(r, r, w, 22); tyre.rotateX(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 14); rim.rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.04, 8); hub.rotateX(Math.PI / 2);
  // spokes so you can see them turn
  const sp = []; for (let k = 0; k < 5; k++) { const b = new THREE.BoxGeometry(r * 1.1, 0.05, w + 0.03); b.rotateZ(k * Math.PI / 5); sp.push(b); }
  const spokes = mergeGeometries(sp);
  for (const [x, z, front] of list) {
    const steer = new THREE.Group(); steer.position.set(x, r, z); group.add(steer);
    const spin = new THREE.Group(); steer.add(spin);
    const t = new THREE.Mesh(tyre, M.tyre()); t.castShadow = true; spin.add(t);
    spin.add(new THREE.Mesh(rim, M.rim()), new THREE.Mesh(hub, M.chrome()), new THREE.Mesh(spokes, M.trim()));
    out.push({ steer, spin, front, r });
  }
  return out;
}
function lightBar(group, x, y, W, len = 0.34) {
  const base = boxG(x - len / 2, y, -W / 2, x + len / 2, y + 0.06, W / 2);
  add(group, [base], M.black());
  const half = (W - 0.06) / 2;
  const red = [], blue = [], redO = [], blueO = [];
  // lenses in pairs across the bar: right red, left blue (a pattern that alternates)
  for (let k = 0; k < 3; k++) {
    const z0 = 0.03 + k * half / 3, z1 = z0 + half / 3 - 0.02;
    red.push(boxG(x - len / 2 + 0.02, y + 0.06, z0, x + len / 2 - 0.02, y + 0.16, z1));
    blue.push(boxG(x - len / 2 + 0.02, y + 0.06, -z1, x + len / 2 - 0.02, y + 0.16, -z0));
  }
  for (const g of red) redO.push(g.clone()); for (const g of blue) blueO.push(g.clone());
  const r = add(group, red, M.red()), b = add(group, blue, M.blue());
  const ro = add(group, redO, M.redOff()), bo = add(group, blueO, M.blueOff());
  r.castShadow = b.castShadow = false;
  return { red: r, blue: b, redOff: ro, blueOff: bo };
}

// ---------------------------------------------------------------- the 108 ambulance
export function buildAmbulance() {
  const g = new THREE.Group();
  const L = 5.3, W = 1.98, hw = W / 2, base = 0.42, roof = 2.6;
  const P = [[-2.62, base], [2.45, base], [2.62, 0.58], [2.66, 0.98], [2.52, 1.16], [2.02, 1.3], [1.48, 2.24], [1.22, 2.44], [1.0, roof], [-2.62, roof]];
  add(g, [profileBody(P, W)], M.paint());
  // glass: the windscreen, the cab doors, frosted panes down the patient box, the rear doors
  const glass = [slopePanel([2.02, 1.32], [1.5, 2.2], W - 0.22)];
  for (const s of [1, -1]) {
    glass.push(sidePanel(1.18, 1.42, 2.0, 2.16, hw + 0.062, s, 0.5));
  }
  add(g, glass, M.glass());
  const frost = [];
  for (const s of [1, -1]) frost.push(sidePanel(-2.1, 1.78, -0.9, 2.2, hw + 0.062, s), sidePanel(-0.6, 1.78, 0.5, 2.2, hw + 0.062, s));
  add(g, frost, M.frost());
  // the livery: a red band with रुग्णवाहिका / AMBULANCE 108, a star of life, a thin red line above
  const band = canvasMat('ambBand', 2048, 256, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#d42020'; x.fillRect(0, 70, w, 120);
    x.fillStyle = '#1b56c9'; x.fillRect(0, 196, w, 22);
    x.fillStyle = '#fff'; x.textBaseline = 'middle';
    x.font = '800 92px Mukta, sans-serif'; x.fillText('रुग्णवाहिका', 300, 132);
    x.font = '900 92px Inter, Arial, sans-serif'; x.textAlign = 'right'; x.fillText('AMBULANCE  108', 1980, 132);
    starOfLife(x, 160, 130, 54, '#1b56c9');
  });
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(sidePanel(-2.55, 0.95, 1.05, 1.62, hw + 0.064, s), band);
    // u along x: the shape is built in x-y, so its uv is its x-y; remap to 0..1
    const uv = m.geometry.attributes.uv, pos = m.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) { const u = (pos.getX(i) + 2.55) / 3.6; uv.setXY(i, s > 0 ? u : 1 - u, (pos.getY(i) - 0.95) / 0.67); }
    g.add(m);
  }
  // red stripes along the cab doors and the bonnet sides
  const stripes = [];
  for (const s of [1, -1]) stripes.push(sidePanel(1.05, 1.08, 2.45, 1.2, hw + 0.064, s));
  add(g, stripes, mat('stripe', () => std(0xd42020, 0.4)));
  // the rear: two doors, a red cross, 108
  const rear = canvasMat('ambRear', 512, 512, (x, w, h) => {
    x.fillStyle = '#f4f5f2'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#d42020'; x.fillRect(0, 300, w, 56);
    x.strokeStyle = '#9aa0a6'; x.lineWidth = 6; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
    x.fillStyle = '#26303a'; x.fillRect(40, 40, 170, 140); x.fillRect(302, 40, 170, 140);
    redCross(x, 256, 240, 44);
    x.fillStyle = '#fff'; x.font = '900 46px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('108', 256, 328);
    x.fillStyle = '#c0c4c8'; x.fillRect(200, 380, 40, 12); x.fillRect(272, 380, 40, 12);
  });
  const rp = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, roof - base - 0.2), rear); rp.rotation.y = -Math.PI / 2; rp.position.set(-2.62 - 0.063, (roof + base) / 2 + 0.05, 0); g.add(rp);
  // the front: AMBULANCE mirrored so it reads right in a mirror, a grille, headlamps, the bumper
  const front = canvasMat('ambFront', 1024, 160, (x, w, h) => {
    x.fillStyle = '#f4f5f2'; x.fillRect(0, 0, w, h); x.translate(w, 0); x.scale(-1, 1);
    x.fillStyle = '#d42020'; x.font = '900 112px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('AMBULANCE', w / 2, h / 2 + 6);
  });
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.22), front);
  fp.rotation.x = -Math.atan2(0.5, 0.14); fp.rotation.order = 'YXZ'; fp.rotation.y = Math.PI / 2;
  fp.position.set(2.3, 1.27, 0); g.add(fp);
  add(g, [boxG(2.6, 0.7, -0.55, 2.7, 0.94, 0.55)], M.black());                                    // grille
  const slats = []; for (let k = 0; k < 4; k++) slats.push(boxG(2.69, 0.73 + k * 0.055, -0.53, 2.71, 0.75 + k * 0.055, 0.53)); add(g, slats, M.chrome());
  add(g, [boxG(2.55, 0.86, -0.92, 2.68, 1.0, -0.62), boxG(2.55, 0.86, 0.62, 2.68, 1.0, 0.92)], M.head());
  add(g, [boxG(2.55, 0.78, -0.94, 2.66, 0.85, -0.74), boxG(2.55, 0.78, 0.74, 2.66, 0.85, 0.94)], M.amber());
  add(g, [boxG(2.6, 0.4, -hw - 0.02, 2.82, 0.62, hw + 0.02), boxG(-2.78, 0.4, -hw - 0.02, -2.58, 0.6, hw + 0.02)], M.trim());
  add(g, [boxG(-2.7, 0.75, -hw + 0.02, -2.6, 1.25, -hw + 0.16), boxG(-2.7, 0.75, hw - 0.16, -2.6, 1.25, hw - 0.02)], M.tail());
  // mirrors on arms, a side step, wheel arches, the AC pod on the roof, a beacon at each rear corner
  const trim = [];
  for (const s of [1, -1]) {
    trim.push(boxG(1.86, 1.62, s * hw, 1.92, 1.66, s * (hw + 0.2)), boxG(1.8, 1.42, s * (hw + 0.18), 1.92, 1.8, s * (hw + 0.26)));
    trim.push(boxG(0.0, 0.32, s * (hw - 0.1), 0.9, 0.4, s * (hw + 0.06)));
    for (const ax of [1.75, -1.45]) { const a = new THREE.CylinderGeometry(0.47, 0.47, 0.08, 16, 1, false, 0, Math.PI); a.rotateX(Math.PI / 2); a.rotateZ(Math.PI / 2); a.translate(ax, 0.42, s * (hw + 0.02)); trim.push(a); }
  }
  add(g, trim, M.black());
  add(g, [boxG(-1.7, roof, -0.6, -0.6, roof + 0.22, 0.6)], M.paint());
  const bars = lightBar(g, 0.82, roof, W - 0.1, 0.32);
  const corner = [], cornerB = [];
  for (const s of [1, -1]) { corner.push(boxG(-2.6, roof, s * (hw - 0.22), -2.42, roof + 0.12, s * (hw - 0.05))); cornerB.push(boxG(-2.6, roof, s * (hw - 0.22), -2.42, roof + 0.12, s * (hw - 0.05))); }
  bars.red2 = add(g, corner, M.red()); bars.red2Off = add(g, cornerB, M.redOff());
  const wl = wheels(g, [[1.75, hw - 0.2, true], [1.75, -hw + 0.2, true], [-1.45, hw - 0.2, false], [-1.45, -hw + 0.2, false]], 0.38, 0.24);
  return { group: g, wheels: wl, lights: bars, dims: { L: 5.4, W }, seats: [[1.32, 1.18, 0.42, 'driver'], [1.32, 1.18, -0.42, 'mate']] };
}

// ---------------------------------------------------------------- the Pune Police jeep
export function buildPoliceJeep() {
  const g = new THREE.Group();
  const W = 1.76, hw = W / 2, base = 0.45, roof = 1.9;
  const P = [[-1.98, base], [1.92, base], [2.02, 0.6], [2.02, 0.98], [1.9, 1.1], [1.12, 1.17], [0.72, 1.8], [0.6, roof], [-1.92, roof], [-2.0, 1.8]];
  add(g, [profileBody(P, W)], M.paint());
  // glass all round
  const glass = [slopePanel([1.12, 1.19], [0.74, 1.76], W - 0.2), slopePanel([-2.0, 1.76], [-2.0, 1.25], W - 0.24, 0.07)];
  for (const s of [1, -1]) glass.push(sidePanel(-1.82, 1.24, 0.95, 1.76, hw + 0.062, s, 0.24));
  add(g, glass, M.glass());
  // pillars over the glass (B, C), black
  const pil = [];
  for (const s of [1, -1]) for (const x of [-0.1, -1.0]) pil.push(sidePanel(x - 0.06, 1.24, x + 0.06, 1.77, hw + 0.064, s));
  add(g, pil, M.black());
  // the band: blue with पुणे पोलीस, POLICE, DIAL 112, a yellow edge
  const band = canvasMat('polBand', 2048, 256, (x, w, h) => {
    x.fillStyle = '#f4f5f2'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1d3f8f'; x.fillRect(0, 56, w, 150);
    x.fillStyle = '#f5c518'; x.fillRect(0, 206, w, 18); x.fillRect(0, 40, w, 14);
    x.fillStyle = '#fff'; x.textBaseline = 'middle';
    x.font = '800 96px Mukta, sans-serif'; x.fillText('पुणे पोलीस', 70, 134);
    x.font = '900 104px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('POLICE', 1160, 132);
    x.font = '800 60px Inter, Arial, sans-serif'; x.textAlign = 'right'; x.fillText('DIAL 112', 1990, 132);
  });
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(sidePanel(-1.95, 0.72, 1.85, 1.12, hw + 0.064, s), band);
    const uv = m.geometry.attributes.uv, pos = m.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) { const u = (pos.getX(i) + 1.95) / 3.8; uv.setXY(i, s > 0 ? u : 1 - u, (pos.getY(i) - 0.72) / 0.4); }
    g.add(m);
  }
  const bonnet = canvasMat('polBonnet', 512, 128, (x, w, h) => { x.fillStyle = '#f4f5f2'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d3f8f'; x.font = '900 84px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLICE', w / 2, h / 2 + 4); });
  const bp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), bonnet); bp.rotation.order = 'YXZ'; bp.rotation.y = Math.PI / 2; bp.rotation.x = -Math.PI / 2 + 0.09; bp.position.set(1.5, 1.16, 0); g.add(bp);
  // front: a chrome-slat grille, square lamps, a black bumper with a bull bar; rear: the spare wheel, lamps
  add(g, [boxG(1.98, 0.66, -0.5, 2.06, 0.96, 0.5)], M.black());
  const sl = []; for (let k = 0; k < 6; k++) sl.push(boxG(2.05, 0.68, -0.48 + k * 0.19, 2.08, 0.94, -0.44 + k * 0.19)); add(g, sl, M.chrome());
  add(g, [boxG(1.94, 0.76, -0.84, 2.05, 0.96, -0.56), boxG(1.94, 0.76, 0.56, 2.05, 0.96, 0.84)], M.head());
  add(g, [boxG(1.94, 0.66, -0.84, 2.04, 0.74, -0.7), boxG(1.94, 0.66, 0.7, 2.04, 0.74, 0.84)], M.amber());
  add(g, [boxG(1.98, 0.42, -hw, 2.18, 0.62, hw), boxG(2.12, 0.62, -0.42, 2.2, 0.98, -0.36), boxG(2.12, 0.62, 0.36, 2.2, 0.98, 0.42), boxG(2.12, 0.92, -0.42, 2.2, 0.98, 0.42), boxG(-2.1, 0.42, -hw, -1.96, 0.6, hw)], M.trim());
  add(g, [boxG(-2.04, 0.95, -hw + 0.04, -1.98, 1.22, -hw + 0.16), boxG(-2.04, 0.95, hw - 0.16, -1.98, 1.22, hw - 0.04)], M.tail());
  const sp = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 20); sp.rotateZ(Math.PI / 2); sp.translate(-2.14, 1.05, 0);
  add(g, [sp], M.tyre());
  // the spare-wheel cover: POLICE and 112 on blue
  const cover = canvasMat('polCover', 256, 256, (x, w, h) => {
    x.fillStyle = '#1d3f8f'; x.beginPath(); x.arc(128, 128, 128, 0, 6.283); x.fill();
    x.strokeStyle = '#f5c518'; x.lineWidth = 12; x.beginPath(); x.arc(128, 128, 118, 0, 6.283); x.stroke();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 52px Inter, Arial'; x.fillText('POLICE', 128, 108); x.font = '800 44px Inter, Arial'; x.fillText('112', 128, 162);
  });
  const cv = new THREE.Mesh(new THREE.CircleGeometry(0.31, 28), cover); cv.rotation.y = -Math.PI / 2; cv.position.set(-2.256, 1.05, 0); g.add(cv);
  // mirrors, arches, roof rails, a step
  const trim = [];
  for (const s of [1, -1]) {
    trim.push(boxG(0.82, 1.3, s * hw, 0.92, 1.34, s * (hw + 0.14)), boxG(0.78, 1.22, s * (hw + 0.12), 0.9, 1.44, s * (hw + 0.2)));
    trim.push(boxG(-1.8, roof, s * (hw - 0.16), 0.4, roof + 0.05, s * (hw - 0.1)));
    trim.push(boxG(-1.0, 0.38, s * (hw - 0.05), 0.8, 0.44, s * (hw + 0.1)));
    for (const ax of [1.35, -1.32]) { const a = new THREE.CylinderGeometry(0.45, 0.45, 0.08, 16, 1, false, 0, Math.PI); a.rotateX(Math.PI / 2); a.rotateZ(Math.PI / 2); a.translate(ax, 0.45, s * (hw + 0.02)); trim.push(a); }
  }
  add(g, trim, M.black());
  const bars = lightBar(g, -0.2, roof + 0.03, W - 0.3, 0.3);
  const wl = wheels(g, [[1.35, hw - 0.18, true], [1.35, -hw + 0.18, true], [-1.32, hw - 0.18, false], [-1.32, -hw + 0.18, false]], 0.36, 0.24);
  return { group: g, wheels: wl, lights: bars, dims: { L: 4.2, W }, seats: [[0.05, 0.82, 0.38, 'driver'], [0.05, 0.82, -0.38, 'mate']] };
}
