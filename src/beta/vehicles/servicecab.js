// The police jeep and the 108 ambulance from the inside. Both are built on a stock vehicle with its own pieces hidden
// (src/vehicles/emodels.js gives them their bodies), and hiding those hid the stock cabin too: sitting in either you
// looked out of a body with nothing in it. The jeep is a Bolero, so it gets the Bolero's own cabin (beta/vehicles/cockpit.js),
// moved to where the jeep's windscreen and seats are, with what a Pune Police jeep has in it: the wireless set under the
// dash with its handset on the clip, the siren and beacon switch box, the duty logbook on the dash and a lathi by the
// door. The ambulance's cab is a van's, built here the same way: the dash across under the tall windscreen, the cluster
// with its needles, a flat wheel on its column, two seats, the 108 radio and the siren panel, and behind you the
// partition with its window into the patient box: the stretcher, the oxygen cylinder, the cabinets and the bench.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCarCockpit } from './cockpit.js';

const std = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const MAT = {};
const mat = (k, f) => MAT[k] || (MAT[k] = f());
const box = (x0, y0, z0, x1, y1, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1)/2, (y0 + y1)/2, (z0 + z1)/2); return g; };
function put(group, geos, material, shadow = true) {
  const g = geos.length > 1 ? mergeGeometries(geos.map(q => q.index ? q.toNonIndexed() : q), false) : geos[0];
  const m = new THREE.Mesh(g, material); m.castShadow = shadow; m.receiveShadow = true; group.add(m); return m;
}
// a rod from a to b (a lathi, a column, a tube)
function rod(a, b, r, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B), g = new THREE.CylinderGeometry(r, r, L, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate((A.x + B.x)/2, (A.y + B.y)/2, (A.z + B.z)/2); return g;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// a face drawn on a canvas, on a plane facing back into the cab (toward -x)
function face(tex, w, h, x, y, z, tiltBack = 0, lit = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lit ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : std(0xffffff, 0.5, 0, { map: tex }));
  m.rotation.order = 'YXZ'; m.rotation.y = -Math.PI/2; m.rotation.x = -tiltBack; m.position.set(x, y, z); return m;
}

// ---------------------------------------------------------------- the Pune Police jeep
// (the jeep's windscreen meets its bonnet at x 1.12, y 1.17 and its side glass starts at 1.24; the Bolero's cabin is
// laid out for its own windscreen at x 1.035 and belt 1.13)
const JEEP_AT = new THREE.Vector3(0.085, 0.04, 0);
function policeKit(G, xf0, belt, fl, hw) {
  const blk = mat('pBlack', () => std(0x141518, 0.55)), grey = mat('pGrey', () => std(0x3a3d42, 0.5, 0.2));
  // the wireless set, slung under the dash on the passenger side, its face toward you, and the handset on its clip
  put(G, [box(xf0 - 0.76, fl + 0.24, -0.32, xf0 - 0.58, fl + 0.33, -0.08), box(xf0 - 0.6, fl + 0.33, -0.3, xf0 - 0.58, fl + 0.4, -0.1)], blk);
  const lcd = canvasTex(256, 96, (x, w, h) => {
    x.fillStyle = '#0d1410'; x.fillRect(0, 0, w, h); x.fillStyle = '#7dff9a'; x.font = '700 30px monospace'; x.fillText('CH 03', 14, 40);
    x.font = '600 20px monospace'; x.fillText('PUNE CTRL', 14, 74); x.fillStyle = '#ffb020'; x.beginPath(); x.arc(226, 26, 8, 0, 6.283); x.fill();
  });
  G.add(face(lcd, 0.12, 0.045, xf0 - 0.765, fl + 0.29, -0.2, 0, true));
  const knobs = []; for (const z of [-0.29, -0.27]) { const k = new THREE.CylinderGeometry(0.009, 0.009, 0.012, 10); k.rotateZ(Math.PI/2); k.translate(xf0 - 0.768, fl + 0.29, z + 0.005); knobs.push(k); }
  put(G, knobs, grey);
  const hs = new THREE.CapsuleGeometry(0.026, 0.07, 4, 10); hs.translate(xf0 - 0.66, belt - 0.12, -0.12);
  put(G, [hs, box(xf0 - 0.64, belt - 0.09, -0.135, xf0 - 0.62, belt - 0.06, -0.105)], blk);
  // its coiled cord, down to the set
  const coil = []; for (let i = 0; i <= 60; i++) { const t = i/60, a = t*Math.PI*2*14; coil.push(new THREE.Vector3(xf0 - 0.66 - 0.04*t + Math.cos(a)*0.012, belt - 0.17 - t*(belt - 0.17 - fl - 0.36), -0.12 - t*0.06 + Math.sin(a)*0.012)); }
  put(G, [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 120, 0.004, 5)], blk, false);
  // the siren and beacon switch box on the dash: four lit buttons and the selector
  put(G, [box(xf0 - 0.52, belt, -0.07, xf0 - 0.38, belt + 0.05, 0.07)], blk);
  const btn = [[0xff2a2a, -0.045], [0x2a5cff, -0.015], [0xffb020, 0.015], [0xf2f2f2, 0.045]];
  for (const [c, z] of btn) put(G, [box(xf0 - 0.5, belt + 0.05, z - 0.011, xf0 - 0.475, belt + 0.058, z + 0.011)], mat('pBtn' + c, () => new THREE.MeshBasicMaterial({ color: c, toneMapped: false })), false);
  const sel = new THREE.CylinderGeometry(0.016, 0.016, 0.012, 14); sel.translate(xf0 - 0.42, belt + 0.056, 0); put(G, [sel], grey);
  // the duty logbook on the passenger side of the dash
  const book = canvasTex(256, 192, (x, w, h) => {
    x.fillStyle = '#1d3f8f'; x.fillRect(0, 0, w, h); x.fillStyle = '#f5c518'; x.fillRect(0, 150, w, 10);
    x.fillStyle = '#fff'; x.font = '700 30px Mukta, sans-serif'; x.fillText('दैनंदिनी', 20, 60); x.font = '600 20px Inter, Arial'; x.fillText('PUNE POLICE · LOG', 20, 110);
  });
  const lb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.022, 0.15), [std(0xe9e4d6, 0.9), std(0xe9e4d6, 0.9), std(0xffffff, 0.7, 0, { map: book }), std(0x1d3f8f, 0.7), std(0xe9e4d6, 0.9), std(0xe9e4d6, 0.9)]);
  lb.position.set(xf0 - 0.34, belt + 0.013, -0.46); lb.rotation.y = 0.18; G.add(lb);
  // the lathi, leaning by the passenger door: bamboo, darker at its knots, a brass cap at the foot
  const z = -(hw - 0.13), a = [xf0 - 1.62, fl + 0.06, z], b = [xf0 - 0.72, fl + 0.5, z + 0.02];
  put(G, [rod(a, b, 0.014)], mat('pLathi', () => std(0xb8904a, 0.55)));
  const knots = []; for (const t of [0.18, 0.4, 0.62, 0.84]) { const p = a.map((v, i) => v + (b[i] - v)*t), q = a.map((v, i) => v + (b[i] - v)*(t + 0.012)); knots.push(rod(p, q, 0.016)); }
  put(G, knots, mat('pKnot', () => std(0x6e4e22, 0.6)));
  put(G, [rod(a, a.map((v, i) => v + (b[i] - v)*0.03), 0.016)], mat('pBrass', () => std(0xb08a3a, 0.35, 0.8)));
}

// ---------------------------------------------------------------- the 108 ambulance's cab and patient box
// (its windscreen runs from x 2.02, y 1.32 up to x 1.5, y 2.2; the cab glass from x 1.18 to 2.0, y 1.42 to 2.16; the seats
// at x 1.32, y 1.18, z ±0.42; inside the body is about 1.98 m across and the roof is at 2.6)
function ambulanceCab() {
  const G = new THREE.Group(), hw = 0.93, fl = 0.78, xp = 0.76, xr = -2.52, rf = 2.5;
  const dash = mat('aDash', () => std(0x2b2e33, 0.75)), trim = mat('aTrim', () => std(0x5b6067, 0.7)), floor = mat('aFloor', () => std(0x3a3f45, 0.9));
  const seatM = mat('aSeat', () => std(0x2c3644, 0.85)), white = mat('aWhite', () => std(0xe8ecec, 0.6)), chrome = mat('aChrome', () => std(0xbfc4ca, 0.3, 0.7));
  // the cab: floor, the dash under the windscreen, the doors' lower trims, the roof lining, the pillars
  put(G, [box(xp, fl - 0.04, -hw, 2.15, fl, hw)], floor);
  put(G, [box(1.78, 1.02, -hw, 2.08, 1.3, hw), box(1.86, 1.3, -hw, 2.0, 1.36, hw), box(1.7, fl, -0.18, 1.86, 1.1, 0.18)], dash);
  put(G, [box(1.7, 1.36, 0.28, 1.86, 1.42, 0.58)], dash);                        // the cluster's hood
  for (const s of [1, -1]) {
    put(G, [box(xp, fl, s*hw - 0.04, 2.0, 1.42, s*hw + 0.0), box(xp, 1.42, s*hw - 0.05, 1.18, rf, s*hw), box(1.18, 2.16, s*hw - 0.05, 1.62, rf, s*hw)], trim);
    put(G, [box(1.0, 1.2, s*(hw - 0.07), 1.7, 1.24, s*(hw - 0.03))], dash);         // the armrest along the door
    put(G, [rod([2.02, 1.32, s*(hw - 0.03)], [1.5, 2.22, s*(hw - 0.03)], 0.035)], dash);   // the windscreen pillar
  }
  put(G, [box(xp, rf - 0.03, -hw, 1.5, rf, hw), box(1.42, 2.2, -hw, 1.56, 2.3, hw)], trim);
  // the cluster: speed and revs, needles that move
  const dial = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#0c0d0f'; x.fillRect(0, 0, w, h);
    for (const [cx, max, step, lab] of [[128, 140, 20, 'km/h'], [384, 5, 1, 'x1000 rpm']]) {
      x.strokeStyle = '#3c4048'; x.lineWidth = 4; x.beginPath(); x.arc(cx, 128, 112, 0, 6.283); x.stroke();
      x.fillStyle = '#e8edf2'; x.font = '600 22px Inter, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let v = 0; v <= max; v += step) { const a = -Math.PI*1.25 + (v/max)*Math.PI*1.5; x.fillText(String(v), cx + Math.cos(a)*84, 128 + Math.sin(a)*84); x.fillRect(cx + Math.cos(a)*104 - 2, 128 + Math.sin(a)*104 - 2, 4, 4); }
      x.font = '500 16px Inter, Arial'; x.fillStyle = '#9aa2ad'; x.fillText(lab, cx, 190);
    }
  });
  G.add(face(dial, 0.3, 0.15, 1.705, 1.32, 0.43, 0.25));
  const needle = (cx) => { const p = new THREE.Group(); p.rotation.order = 'YXZ'; p.rotation.y = -Math.PI/2; p.rotation.x = -0.25; p.position.set(1.703, 1.32, cx);
    const n = new THREE.Mesh(box(-0.002, -0.0025, -0.001, 0.05, 0.0025, 0.001), mat('aNeedle', () => new THREE.MeshBasicMaterial({ color: 0xff5a1f, toneMapped: false }))); p.add(n); G.add(p); return p; };
  const sp = needle(0.43 - 0.075), rv = needle(0.43 + 0.075);
  // the wheel, flat on its column as a van's is
  const col = new THREE.Group(); col.position.set(1.66, 1.5, 0.42); col.rotation.z = 0.75; G.add(col);
  put(col, [rod([0, -0.02, 0], [0, -0.32, 0], 0.03)], dash);
  const spin = new THREE.Group(); col.add(spin);
  const rim = new THREE.TorusGeometry(0.2, 0.018, 10, 36); rim.rotateX(Math.PI/2);
  put(spin, [rim, box(-0.19, -0.012, -0.015, 0.19, 0.012, 0.015), box(-0.015, -0.012, -0.0, 0.015, 0.012, 0.19), new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16)], dash);
  // the seats: a cushion, a tall back, a headrest, the driver's and the one beside
  for (const s of [1, -1]) {
    const z = s*0.42, sx = 1.32;
    put(G, [box(sx - 0.24, 1.06, z - 0.25, sx + 0.22, 1.18, z + 0.25), box(sx - 0.3, fl, z - 0.2, sx + 0.1, 1.06, z + 0.2)], seatM);
    const back = box(-0.06, 0, -0.25, 0.06, 0.66, 0.25); back.rotateZ(0.16); back.translate(sx - 0.28, 1.16, z); const head = box(-0.05, 0, -0.13, 0.05, 0.2, 0.13); head.rotateZ(0.16); head.translate(sx - 0.39, 1.86, z);
    put(G, [back, head], seatM);
  }
  // the 108 radio in the dash, and the siren panel by it
  const radio = canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#101214'; x.fillRect(0, 0, w, h); x.fillStyle = '#ff5a5a'; x.font = '800 34px Inter, Arial'; x.fillText('108', 14, 44); x.fillStyle = '#9fe8ff'; x.font = '600 20px monospace'; x.fillText('EMRI  CH 2', 14, 78); });
  put(G, [box(1.76, 1.12, -0.16, 1.86, 1.2, 0.04)], mat('aBlk', () => std(0x141518, 0.55)));
  G.add(face(radio, 0.19, 0.072, 1.758, 1.16, -0.06, 0, true));
  const mic = new THREE.CapsuleGeometry(0.022, 0.05, 4, 10); mic.translate(1.74, 1.06, 0.1); put(G, [mic], mat('aBlk', () => null));
  put(G, [box(1.74, 0.94, -0.14, 1.8, 1.02, 0.14)], mat('aBlk', () => null));
  for (const [c, z] of [[0xff2a2a, -0.09], [0x2a5cff, -0.03], [0xffb020, 0.03], [0xf2f2f2, 0.09]]) put(G, [box(1.735, 0.965, z - 0.02, 1.742, 0.995, z + 0.02)], mat('aBtn' + c, () => new THREE.MeshBasicMaterial({ color: c, toneMapped: false })), false);
  // the partition, with its window into the back
  put(G, [box(xp - 0.04, fl, -hw, xp, 1.75, hw), box(xp - 0.04, 2.15, -hw, xp, rf, hw), box(xp - 0.04, 1.75, -hw, xp, 2.15, -0.36), box(xp - 0.04, 1.75, 0.36, xp, 2.15, hw)], white);
  put(G, [box(xp - 0.03, 1.75, -0.36, xp - 0.01, 2.15, 0.36)], mat('aPane', () => std(0xbfd6e0, 0.05, 0.2, { transparent: true, opacity: 0.18, depthWrite: false })), false);
  // the patient box, lined all round (seen from the inside: the body itself is solid paint), lit from a strip overhead
  const lin = box(xr, fl - 0.04, -hw, xp - 0.04, rf, hw);
  const room = new THREE.Mesh(lin, mat('aRoom', () => std(0xeef1f1, 0.65, 0, { side: THREE.BackSide }))); room.receiveShadow = true; G.add(room);
  put(G, [box(-1.8, rf - 0.03, -0.1, -0.2, rf - 0.01, 0.1)], mat('aLamp', () => new THREE.MeshBasicMaterial({ color: 0xf4f8ff, toneMapped: false })), false);
  put(G, [box(xr + 0.02, fl - 0.04, -hw, xp - 0.05, fl - 0.02, hw)], mat('aVinyl', () => std(0x6f7f86, 0.8)));
  // the stretcher on the left: its frame, the legs, an orange mattress and a pillow, the straps
  const sz = -0.4;
  put(G, [box(-2.3, 1.18, sz - 0.28, -0.4, 1.21, sz + 0.28), rod([-2.2, fl, sz - 0.24], [-2.2, 1.18, sz - 0.24], 0.014), rod([-2.2, fl, sz + 0.24], [-2.2, 1.18, sz + 0.24], 0.014), rod([-0.5, fl, sz - 0.24], [-0.5, 1.18, sz - 0.24], 0.014), rod([-0.5, fl, sz + 0.24], [-0.5, 1.18, sz + 0.24], 0.014), rod([-2.3, 1.22, sz + 0.29], [-0.4, 1.22, sz + 0.29], 0.012), rod([-2.3, 1.22, sz - 0.29], [-0.4, 1.22, sz - 0.29], 0.012)], chrome);
  put(G, [box(-2.28, 1.21, sz - 0.26, -0.42, 1.29, sz + 0.26)], mat('aMat', () => std(0xd8571f, 0.75)));
  put(G, [box(-0.78, 1.29, sz - 0.2, -0.46, 1.36, sz + 0.2)], mat('aPillow', () => std(0xf4f4f0, 0.9)));
  put(G, [box(-1.62, 1.29, sz - 0.27, -1.56, 1.3, sz + 0.27), box(-1.02, 1.29, sz - 0.27, -0.96, 1.3, sz + 0.27)], mat('aBlk', () => null));
  // the oxygen cylinder strapped upright by the partition: black, its white shoulder, the regulator and its gauge
  const cy = new THREE.CylinderGeometry(0.09, 0.09, 0.9, 18); cy.translate(xp - 0.2, fl + 0.45, 0.62);
  put(G, [cy], mat('aCyl', () => std(0x16181b, 0.45, 0.3)));
  const sh = new THREE.SphereGeometry(0.09, 18, 8, 0, Math.PI*2, 0, Math.PI/2); sh.translate(xp - 0.2, fl + 0.9, 0.62); put(G, [sh], mat('aWhite', () => null));
  put(G, [rod([xp - 0.2, fl + 0.98, 0.62], [xp - 0.2, fl + 1.06, 0.62], 0.02), box(xp - 0.12, fl + 0.6, 0.5, xp - 0.09, fl + 0.64, 0.74)], chrome);
  const gauge = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16); gauge.rotateZ(Math.PI/2); gauge.translate(xp - 0.24, fl + 1.06, 0.62); put(G, [gauge], mat('aGauge', () => std(0xeeeeea, 0.4)));
  // the cabinets along the right wall, white with grey handles, and the attendant's bench under them
  const cab = [], han = [];
  for (let i = 0; i < 3; i++) { const x0 = -2.3 + i*0.52; cab.push(box(x0, 1.72, hw - 0.36, x0 + 0.5, 2.42, hw - 0.02)); han.push(box(x0 + 0.2, 2.02, hw - 0.375, x0 + 0.3, 2.04, hw - 0.36)); }
  put(G, cab, mat('aCab', () => std(0xf3f4f2, 0.5)));
  put(G, han, trim);
  put(G, [box(-2.2, fl, hw - 0.42, -0.9, 1.22, hw - 0.02)], mat('aBench', () => std(0x24496e, 0.85)));
  put(G, [box(-2.2, 1.22, hw - 0.1, -0.9, 1.65, hw - 0.04)], mat('aBench', () => null));
  return {
    group: G, eye: [1.24, 1.93, 0.42], spin,
    update(steer, kmh, gear, rpm) {
      spin.rotation.y = -steer*6.5;
      sp.rotation.z = Math.PI*1.25 - Math.min(140, kmh || 0)/140*Math.PI*1.5;
      rv.rotation.z = Math.PI*1.25 - Math.min(5000, rpm || 800)/5000*Math.PI*1.5;
    },
  };
}

// the cabin in, and the camera to its seat. kind: 'pol' or 'amb'
export function serviceCabin(v, kind, vmats) {
  if (v.cockpit && v.cockpit.group.parent) v.cockpit.group.parent.remove(v.cockpit.group);
  let C;
  if (kind === 'pol') {
    C = buildCarCockpit('bolero', vmats);
    const S = { xf0: 1.035, belt: 1.13, fl: 0.5, hw: 0.875 };
    try { policeKit(C.group, S.xf0, S.belt, S.fl, S.hw); } catch (e) { console.warn('police cabin', e); }
    C.group.position.copy(JEEP_AT);
    C.eye = [C.eye[0] + JEEP_AT.x, C.eye[1] + JEEP_AT.y, C.eye[2]];
  } else {
    C = ambulanceCab(); C._fit = true;          // (built inside the van's own lines: nothing to press under its roof)
  }
  v.tilt.add(C.group); v.cockpit = C; v.cockpitEye = C.eye;
  // what the cabin is kept under: the service body's shell and glass, not the stock one hidden under it
  if (v.md) v.shellMeshes = v.md.group.children.filter(o => o.isMesh && o.material && (o.material.transparent || o.geometry.type === 'ExtrudeGeometry'));
  return C;
}
