// What the garage does to a vehicle, any vehicle: yours keep it for good (per vehicle, in the save), one you've
// taken keeps it while it's around (or until a shady garage gets it papers in your name). Here: how each mod looks
// on the vehicle (hung off it, rebuilt whole on every change), how it drives (top speed, pull, brakes, grip, ride
// height, armour, nitrous, fuel use), which of it the RTO and the traffic police don't allow, and the numbers the
// garage shows (real units: km/h, seconds to 60, metres to stop).
import * as THREE from 'three';
import { finishMaterial, tintMaterial } from './vehmat.js';
import { specOf } from './vehicle.js';
import { lin } from '../world/geo.js';

export const COLOURS = [
  ['Midnight black', [0.012, 0.012, 0.014]], ['Pune yellow', [0.85, 0.6, 0.02]], ['CNG green', [0.03, 0.32, 0.08]], ['Pearl white', [0.82, 0.82, 0.8]],
  ['Racing red', [0.62, 0.02, 0.02]], ['Royal blue', [0.02, 0.06, 0.45]], ['Saffron', [0.95, 0.32, 0.02]], ['Gunmetal', [0.12, 0.13, 0.15]],
  ['Mint', [0.3, 0.7, 0.5]], ['Wine', [0.25, 0.01, 0.06]], ['Gold', [0.62, 0.42, 0.08]], ['Pink', [0.85, 0.2, 0.42]],
  ['Silver', [0.45, 0.46, 0.48]], ['Sky blue', [0.15, 0.4, 0.75]], ['Purple', [0.2, 0.03, 0.4]], ['Lime', [0.35, 0.7, 0.03]],
];
export const NEON = [['Blue', 0x2f7dff], ['Pink', 0xff2f9d], ['Green', 0x2fff7d], ['Saffron', 0xff8a1a], ['Purple', 0xa02fff], ['White', 0xeaf2ff]];
export const HORNS = [['Stock', ''], ['Pressure horn', 'truck'], ['Musical horn', 'tempo'], ['Bus horn', 'bus']];
// key, name, roughness, metalness, reflections
export const FINISH = [['gloss', 'Factory gloss', 0.38, 0.1, 0.8], ['mirror', 'Mirror gloss', 0.1, 0.2, 1.3], ['metal', 'Metallic', 0.3, 0.6, 1.1], ['satin', 'Satin', 0.58, 0.25, 0.6], ['matte', 'Matte', 0.9, 0.0, 0.3], ['chrome', 'Chrome wrap', 0.05, 1.0, 1.7]];
export const RIMS = ['Stock', 'Chrome ten-spoke', 'Black alloy', 'Gold mesh', 'Red five-spoke', 'Bronze turbine', 'Body colour'];
export const LIVERY = ['None', 'Racing stripes', 'Flames', 'Warli art', 'Paithani border', 'Chequered', 'Tiger stripes', 'Camo', 'Truck art'];
export const FLAPS = ['Horn OK Please', 'बुरी नज़र वाले तेरा मुँह काला', 'आईची कृपा', 'Jai Maharashtra'];
// rear boards in the Puneri patya manner (the game's own lines)
export const PATYA = ['हॉर्न वाजवू नका. आम्ही बहिरे नाही.', 'सुट्टे पैसे आधी काढा.', 'मीटरप्रमाणे. वाद नको.', 'मागे बघू नका, पुढे बघा.'];
export const EXHAUST = [['', 'Stock'], ['sport', 'Sports exhaust'], ['dhak', 'Dhak-dhak silencer'], ['flame', 'Flame-spitting exhaust']];
export const FANCY = [['दादा', '4141'], ['BOSS', '8055']];        // the numbers that, painted the right way, read as a word

const AUTO_Y = [0.96, 0.74, 0.06].map(lin);                       // the yellow on an auto (models.js), as stored
export const classOf = (type) => type === 'cycle' ? 'cycle' : type === 'auto' ? 'auto' : type === 'tempo' ? 'tempo' : type === 'bus' ? 'bus' : specOf(type).two ? 'two' : 'car';

// this vehicle's mods: 'auto' for the stand's auto, the vehicle's id for yours, and for anything else (taken,
// found) its own, carried on it. Rentals: none (the travels would notice)
export function modsOf(G, v) {
  const s = G.life && G.life.s; if (!s || !v) return null;
  if (v.owned && v.owned.rental) return null;
  const key = v === G.player.auto ? 'auto' : v.owned && v.owned.id;
  if (!key) return v._tmpMods || (v._tmpMods = {});
  const M = s.mods || (s.mods = {});
  if (!M[key]) {
    M[key] = {};
    if (key === 'auto') { const U = s.upg || {}; if (U.engine) M.auto.engine = U.engine; if (U.horn) M.auto.horn = 'truck'; if (U.seat) M.auto.seat = 1; }    // what older saves bought
  }
  return M[key];
}

// ---------------------------------------------------------------- the law
// what a traffic cop can hold against it (MV Act s.52: no alterations to a vehicle's registered specification)
export function illegalOf(m, type) {
  const out = [];
  if (!m) return out;
  if (m.tint > 0) out.push(['tint', 'Tinted windows']);
  if (m.exhaust === 'dhak' || m.exhaust === 'flame') out.push(['exhaust', 'Modified silencer']);
  if (m.horn && m.horn !== '') out.push(['horn', 'Pressure / multi-tone horn']);
  if (m.beacon) out.push(['beacon', m.beacon === 'red' ? 'Red beacon (laal batti)' : 'Flashing lights']);
  if (m.fancy) out.push(['fancy', 'Fancy number plate']);
  if (m.bullbar) out.push(['bullbar', 'Bull bar']);
  if (type === 'auto' && m.paint && !sameCol(m.paint, COLOURS[1][1])) out.push(['paint', 'Auto off its permit colours']);
  return out;
}
// take the illegal bits off (what a havaldar makes you do at the chowki)
export function strip(m, type) {
  const gone = illegalOf(m, type);
  for (const [k] of gone) { if (k === 'paint') m.paint = COLOURS[1][1].slice(); else if (k === 'tint' || k === 'bullbar') m[k] = 0; else m[k] = ''; }
  return gone.map(g => g[1]);
}
export const sameCol = (a, b) => a && b && Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[2] - b[2]) < 0.01;

// ---------------------------------------------------------------- the numbers
// top speed (km/h), seconds from 0 to 60 (40 for the slow ones), metres to stop from 60 (40), grip (g), toughness
export function statsOf(type, m = {}) {
  const S = specOf(type), cl = classOf(type);
  const tune = (1 + (m.engine || 0) * 0.08) * (m.ecu === 'sport' ? 1.04 : m.ecu === 'eco' ? 0.96 : 1) * (m.gears ? 1.2 : 1);
  const acc = S.acc * (m.turbo ? 1.18 : 1) * (m.ecu === 'sport' ? 1.05 : 1) * Math.min(1.1, tune);
  const top = S.vTop * tune, to = cl === 'car' ? 60 / 3.6 : Math.min(40 / 3.6, top * 0.85);
  let v = 0, t = 0;
  while (v < to && t < 60) { const a = acc * Math.max(0, 1 - Math.pow(v / top, 3)) - 0.12 - S.drag * v * v; if (a <= 0.02) { t = 60; break; } v += a * 0.02; t += 0.02; }
  const brake = S.brake * (1 + (m.brakes || 0) * 0.15), mu = S.mu * (1 + (m.tyres ? 0.06 : 0) + Math.max(0, m.lower || 0) * 0.03);
  const tough = 1 / (1 - (m.armor || 0) * 0.2) * (m.bullbar ? 1.1 : 1);
  return {
    top: Math.round(top * 3.6 * (S.drag > 0.002 ? 0.97 : 0.99)), to: Math.round(to * 3.6), t0: t >= 60 ? 99 : Math.round(t * 10) / 10,
    stop: Math.round(to * to / (2 * brake) * 10) / 10, grip: Math.round(mu / 9.81 * 100) / 100, tough: Math.round(tough * 100),
    n2o: m.nitro ? 1 : 0,
  };
}

// ---------------------------------------------------------------- on the vehicle
// handling and looks from the mods (after any change, when the vehicle comes out, and for the garage's preview)
export function applyMods(G, v, extra = {}) {
  const m = extra.mods || modsOf(G, v); if (!m) return;
  const type = v === G.player.auto ? 'auto' : v.type, cl = classOf(type);
  v.tune = (1 + (m.engine || 0) * 0.08) * (m.ecu === 'sport' ? 1.04 : m.ecu === 'eco' ? 0.96 : 1) * (m.gears ? 1.2 : 1);
  v.accMul = (m.turbo ? 1.18 : 1) * (m.ecu === 'sport' ? 1.05 : 1);
  v.econ = (m.ecu === 'eco' ? 1.3 : 1) * (m.cng ? 1.15 : 1);
  v.cngKit = !!m.cng;
  v.brakeMul = 1 + (m.brakes || 0) * 0.15;
  v.gripMul = 1 + (m.tyres ? 0.06 : 0) + Math.max(0, m.lower || 0) * 0.03;
  v.armorMul = (1 - (m.armor || 0) * 0.2) * (m.bullbar ? 0.9 : 1) * (m.crash ? 0.85 : 1);
  v.lower = (m.lower || 0) * 0.035;                       // (−1: lifted, sits higher)
  v.soft = m.lower < 0 ? 0.45 : m.lower === 2 ? 1.35 : 1;
  v.noFlat = !!m.bulletproof;
  v.hornKind = m.horn || '';
  v.lightCol = m.xenon ? 0xdfeaff : null;
  v.n2oMax = m.nitro ? 10 : 0; if (m.nitro && m.n2o == null) m.n2o = 10;
  v.hydro = !!m.hydro && cl !== 'two' && cl !== 'cycle';
  v.beacon = m.beacon || ''; if (!v.beacon) v.beaconOn = false;
  v.dj = !!m.dj; v.dashcam = !!m.dashcam;
  v.loud = m.exhaust === 'sport' ? 1.3 : m.exhaust === 'dhak' || m.exhaust === 'flame' ? 1.8 : 1;
  v.flames = m.exhaust === 'flame';
  // paint: the body colour (an auto: its yellow), the finish, the glass
  const body = v.bodyMesh;
  if (body) {
    if (cl === 'auto') recolourAuto(v, m.paint || null);
    else if (body.isInstancedMesh) {
      if (!v._paint0) v._paint0 = (v.paint || [0.6, 0.6, 0.6]).slice();
      const p = m.paint || v._paint0;
      v.paint = p.slice(); body.instanceColor.setXYZ(0, p[0], p[1], p[2]); body.instanceColor.needsUpdate = true;
      if (!v._mat0) v._mat0 = body.material;
      const f = FINISH.find(q => q[0] === m.finish);
      body.material = f && f[0] !== 'gloss' ? finishMaterial(...f) : v._mat0;
    }
  }
  if (v.glassMesh) { if (!v._glass0) v._glass0 = v.glassMesh.material; v.glassMesh.material = m.tint ? tintMaterial(m.tint) : v._glass0; }
  if (m.plate) v.plate = m.plate;
  dress(v, m, { sticker: extra.sticker, dmg: extra.dmg, auto: cl === 'auto', cl });
}
// an auto's yellow (the band, the brow, the hood) in another colour; its own copy of the colours, so only this one changes
function recolourAuto(v, col) {
  const body = v.bodyMesh, ud = body.userData;
  if (!col && !ud.yellow) return;
  if (!ud.yellow) {
    if (body.isInstancedMesh) { body.geometry = body.geometry.clone(); ud.ownGeo = true; }      // (shared by every auto otherwise)
    const c = body.geometry.attributes.color, idx = [];
    for (let i = 0; i < c.count; i++) if (Math.abs(c.getX(i) - AUTO_Y[0]) < 0.02 && Math.abs(c.getY(i) - AUTO_Y[1]) < 0.02 && Math.abs(c.getZ(i) - AUTO_Y[2]) < 0.02) idx.push(i);
    ud.yellow = idx;
  }
  const c = body.geometry.attributes.color, p = col || AUTO_Y;
  for (const i of ud.yellow) c.setXYZ(i, p[0], p[1], p[2]);
  c.needsUpdate = true;
}

const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.12, metalness: 1, envMapIntensity: 1.4 });
const black = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.55, metalness: 0.3 });
const SHARED = new Set([chrome, black]);
// a soft-edged pool of light (white; the neon's colour tints it)
let GT = null;
function glowTex() {
  if (GT) return GT;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); GT = new THREE.CanvasTexture(cv); GT.userData.keep = true; return GT;
}
// drawn textures, kept (the preview redraws the vehicle on every hover)
const TEX = new Map();
function tex(key, w, h, draw, px = 256) {
  if (TEX.has(key)) return TEX.get(key);
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.max(32, Math.round(px * h / w)); draw(cv.getContext('2d'), cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.keep = true; TEX.set(key, t); return t;
}
const plane = (w, h, map, alpha, side) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, transparent: !!alpha, alphaTest: alpha ? 0.05 : 0, depthWrite: !alpha, roughness: 0.45, metalness: 0.05, side: side || THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: -2 }));
const lamp = (col) => new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
const cssCol = (p) => `rgb(${p.map(c => Math.round(Math.pow(Math.min(1, c), 1 / 2.2) * 255)).join(',')})`;

function rimTex(style, col) {
  return tex(`rim${style}${col || ''}`, 1, 1, (c, w) => {
    const r = w / 2; c.translate(r, r);
    const base = { 1: '#d9dee4', 2: '#1a1b1e', 3: '#c9a03a', 4: '#c4161c', 5: '#8a5a2b', 6: col || '#888' }[style];
    const dark = style === 2 ? '#050506' : '#2a2c30';
    c.fillStyle = dark; c.beginPath(); c.arc(0, 0, r, 0, 6.29); c.fill();
    c.fillStyle = base; c.strokeStyle = base;
    c.lineWidth = r * 0.12; c.beginPath(); c.arc(0, 0, r * 0.92, 0, 6.29); c.stroke();
    if (style === 3) { c.lineWidth = r * 0.05; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); c.lineTo(Math.cos(a + 0.9) * r * 0.88, Math.sin(a + 0.9) * r * 0.88); c.stroke(); c.beginPath(); c.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2); c.lineTo(Math.cos(a - 0.9) * r * 0.88, Math.sin(a - 0.9) * r * 0.88); c.stroke(); } }
    else if (style === 5) { for (let k = 0; k < 12; k++) { c.save(); c.rotate(k / 12 * 6.283); c.beginPath(); c.moveTo(r * 0.2, -r * 0.05); c.quadraticCurveTo(r * 0.6, r * 0.25, r * 0.88, r * 0.12); c.lineTo(r * 0.88, -r * 0.06); c.quadraticCurveTo(r * 0.55, r * 0.05, r * 0.2, -r * 0.18); c.fill(); c.restore(); } }
    else { const n = style === 1 ? 10 : style === 4 ? 5 : style === 2 ? 6 : 7, wd = style === 4 ? 0.2 : style === 1 ? 0.07 : 0.13; for (let k = 0; k < n; k++) { c.save(); c.rotate(k / n * 6.283); c.beginPath(); c.moveTo(r * 0.18, -r * wd * 0.7); c.lineTo(r * 0.88, -r * wd); c.lineTo(r * 0.88, r * wd); c.lineTo(r * 0.18, r * wd * 0.7); c.fill(); c.restore(); } }
    c.beginPath(); c.arc(0, 0, r * 0.24, 0, 6.29); c.fill();
    c.fillStyle = dark; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; c.beginPath(); c.arc(Math.cos(a) * r * 0.13, Math.sin(a) * r * 0.13, r * 0.03, 0, 6.29); c.fill(); }
    if (style !== 2) { const g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 6.29); c.fill(); }
  });
}
function liveryTex(k, light) {
  const ink = light ? '#111214' : '#f4f1ea', ink2 = light ? '#c4161c' : '#ffb000';
  return tex(`liv${k}${light}`, 4, 1, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = ink; c.strokeStyle = ink;
    if (k === 1) { c.fillRect(0, h * 0.38, w, h * 0.1); c.fillRect(0, h * 0.54, w, h * 0.1); c.fillStyle = ink2; c.fillRect(0, h * 0.49, w, h * 0.04); }
    else if (k === 2) { for (let i = 0; i < 9; i++) { const y = h * (0.25 + (i % 3) * 0.22), x = w * 0.02; c.fillStyle = i % 2 ? ink2 : '#ff5a00'; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(w * 0.2, y - h * 0.25, w * 0.32, y + h * 0.15, w * (0.42 + (i % 4) * 0.06), y - h * 0.05); c.bezierCurveTo(w * 0.3, y + h * 0.18, w * 0.15, y + h * 0.12, x, y + h * 0.16); c.fill(); } }
    else if (k === 3) {           // Warli: stick figures in a ring dance, a tree, the sun
      c.lineWidth = 3;
      for (let i = 0; i < 16; i++) { const x = w * 0.05 + i * w * 0.058, y = h * 0.62; c.beginPath(); c.arc(x, y - h * 0.32, h * 0.06, 0, 6.29); c.fill(); c.beginPath(); c.moveTo(x - h * 0.08, y - h * 0.24); c.lineTo(x + h * 0.08, y - h * 0.24); c.lineTo(x - h * 0.08, y - h * 0.02); c.lineTo(x + h * 0.08, y - h * 0.02); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x - h * 0.06, y); c.lineTo(x - h * 0.1, y + h * 0.18); c.moveTo(x + h * 0.06, y); c.lineTo(x + h * 0.1, y + h * 0.18); c.moveTo(x - h * 0.08, y - h * 0.2); c.lineTo(x - w * 0.03, y - h * 0.12); c.moveTo(x + h * 0.08, y - h * 0.2); c.lineTo(x + w * 0.03, y - h * 0.12); c.stroke(); }
      c.beginPath(); c.moveTo(0, h * 0.86); c.lineTo(w, h * 0.86); c.stroke();
    }
    else if (k === 4) {           // a Paithani border: peacocks and lotus in gold on the sari's edge
      c.fillStyle = light ? '#5a0f3c' : '#7a1650'; c.fillRect(0, h * 0.62, w, h * 0.3); c.fillStyle = '#d8a930'; c.fillRect(0, h * 0.62, w, h * 0.04); c.fillRect(0, h * 0.88, w, h * 0.04);
      for (let i = 0; i < 12; i++) { const x = w * 0.04 + i * w * 0.085, y = h * 0.77; c.beginPath(); c.ellipse(x, y, h * 0.07, h * 0.05, 0, 0, 6.29); c.fill(); c.beginPath(); c.moveTo(x + h * 0.05, y - h * 0.02); c.quadraticCurveTo(x + h * 0.1, y - h * 0.14, x + h * 0.06, y - h * 0.16); c.lineTo(x + h * 0.04, y - h * 0.03); c.fill(); c.beginPath(); c.moveTo(x - h * 0.06, y); c.quadraticCurveTo(x - h * 0.2, y - h * 0.08, x - h * 0.22, y + h * 0.06); c.quadraticCurveTo(x - h * 0.12, y + h * 0.04, x - h * 0.06, y + h * 0.03); c.fill(); }
    }
    else if (k === 5) { const s = h * 0.14; for (let i = 0; i * s < w; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) c.fillRect(i * s, h * 0.42 + j * s, s, s); }
    else if (k === 6) { c.fillStyle = light ? '#111' : '#0c0c0c'; for (let i = 0; i < 18; i++) { const x = (i * 71) % w; c.beginPath(); c.moveTo(x, h * 0.2); c.quadraticCurveTo(x + w * 0.03, h * 0.5, x - w * 0.01, h * 0.9); c.lineTo(x + w * 0.012, h * 0.88); c.quadraticCurveTo(x + w * 0.045, h * 0.5, x + w * 0.02, h * 0.22); c.fill(); } }
    else if (k === 7) { const cols = ['#4a5a2a', '#2c3418', '#7a6a40', '#1e2412']; for (let i = 0; i < 70; i++) { c.fillStyle = cols[i % 4]; c.beginPath(); c.ellipse((i * 97) % w, h * 0.2 + ((i * 53) % (h * 0.75)), w * 0.04, h * 0.1, i, 0, 6.29); c.fill(); } }
    else if (k === 8) {           // truck art: a painted border, flowers, an eye against nazar
      c.fillStyle = '#e8262a'; c.fillRect(0, h * 0.3, w, h * 0.08); c.fillStyle = '#1f8a3c'; c.fillRect(0, h * 0.82, w, h * 0.08); c.fillStyle = '#ffd400'; c.fillRect(0, h * 0.4, w, h * 0.04);
      for (let i = 0; i < 9; i++) { const x = w * 0.06 + i * w * 0.11, y = h * 0.62; for (let p = 0; p < 6; p++) { c.fillStyle = ['#ff2d55', '#ffd400', '#00a6ff'][i % 3]; c.beginPath(); c.ellipse(x + Math.cos(p) * h * 0.08, y + Math.sin(p) * h * 0.08, h * 0.06, h * 0.035, p, 0, 6.29); c.fill(); } c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, h * 0.04, 0, 6.29); c.fill(); }
    }
  }, 512);
}
function plateTex(kind, text) {
  return tex(`pl${kind}${text}`, 4.3, 1, (c, w, h) => {
    const yel = kind === 'vip';
    c.fillStyle = yel ? '#f2c230' : '#f4f4f0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1b1c1f'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    let x0 = 0;
    if (kind === 'hsrp' || kind === 'fancy') { c.fillStyle = '#1d4fa8'; c.fillRect(4, 4, w * 0.09, h - 8); c.fillStyle = '#fff'; c.font = `700 ${Math.round(h * 0.22)}px Archivo, sans-serif`; c.textAlign = 'center'; c.fillText('IND', w * 0.05 + 2, h * 0.86); c.fillStyle = 'rgba(70,120,220,.5)'; c.beginPath(); c.ellipse(w * 0.05 + 2, h * 0.3, h * 0.14, h * 0.12, 0, 0, 6.29); c.fill(); x0 = w * 0.09; }
    c.fillStyle = '#1b1c1f'; c.textAlign = 'center';
    if (kind === 'fancy') { c.font = `900 ${Math.round(h * 0.82)}px "Yatra One", Mukta, sans-serif`; c.fillText(text, x0 + (w - x0) / 2, h * 0.84); }
    else { c.font = `800 ${Math.round(h * 0.5)}px Archivo, sans-serif`; c.fillText(text, x0 + (w - x0) / 2, h * 0.7); }
  });
}
const textTex = (key, w, h, bg, fg, t, font) => tex(key, w, h, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.textAlign = 'center'; let fs = H * 0.6; c.font = `400 ${fs}px ${font}`; while (c.measureText(t).width > W * 0.92 && fs > 8) { fs -= 2; c.font = `400 ${fs}px ${font}`; } c.fillText(t, W / 2, H * 0.5 + fs * 0.36); }, 384);

// the mods you can see, hung off the vehicle (replaced whole each time)
export function dress(v, m, o = {}) {
  const drop = (g) => g.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material && !SHARED.has(q.material)) { if (q.material.map && !q.material.map.userData.keep) q.material.map.dispose(); q.material.dispose(); } });
  if (v._mods) { v.tilt.remove(v._mods); drop(v._mods); v._mods = null; }
  if (v._rims) { for (const r of v._rims) { r.parent && r.parent.remove(r); drop(r); } v._rims = null; }
  v._beacon = null; v._tip = null;
  if (!v.bodyMesh || !v.tilt) return;
  const bg = v.bodyMesh.geometry; if (!bg.boundingBox) bg.computeBoundingBox(); const bb = bg.boundingBox;
  const X0 = bb.min.x, X1 = bb.max.x, L = X1 - X0, Wd = bb.max.z - bb.min.z, Y0 = bb.min.y, Y1 = bb.max.y, Hh = Y1 - Y0, cl = o.cl || 'car', two = cl === 'two' || cl === 'cycle';
  const g = new THREE.Group(); g.name = 'mods';
  const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => { mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh; };
  const cyl = (r0, r1, h, mat, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const wh = v.wheels || [];
  // neon under the body: a hard strip of light and a soft spill on the road
  if (m.neon) for (const [sc, op] of [[1.0, 0.9], [1.7, 0.45]]) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(L * sc, Wd * sc), new THREE.MeshBasicMaterial({ color: m.neon, map: glowTex(), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    add(n, (X0 + X1) / 2, Y0 + 0.1, 0, -Math.PI / 2);
  }
  // livery down both sides (a two-wheeler: on the tank)
  if (m.livery && cl !== 'cycle') {
    const p = v.paint || [0.5, 0.5, 0.5], light = (p[0] + p[1] + p[2]) / 3 > 0.25 || cl === 'auto' && !m.paint;
    const t = liveryTex(m.livery, light ? 1 : 0), w = two ? 0.62 : L * 0.82, h = two ? 0.2 : Hh * 0.42, y = two ? Y0 + Hh * 0.52 : Y0 + Hh * 0.36, x = two ? (X0 + X1) / 2 + 0.12 : (X0 + X1) / 2;
    for (const s of [-1, 1]) add(plane(w, h, t, true), x, y, s > 0 ? (two ? 0.17 : bb.max.z + 0.012) : (two ? -0.17 : bb.min.z - 0.012), 0, s > 0 ? 0 : Math.PI);
  }
  if (o.sticker != null && o.auto) add(plane(0.9, 0.2, textTex('stk' + o.sticker, 0.9, 0.2, '#0c0b0a', '#F2C230', o.sticker, '"Yatra One", Mukta, sans-serif')), X0 - 0.015, Y0 + Hh * 0.45, 0, 0, -Math.PI / 2);
  if (m.seat && !two) { const c = plane(0.7, 0.5, tex('leopard', 0.7, 0.5, (x, w, h) => { x.fillStyle = '#d9a441'; x.fillRect(0, 0, w, h); for (let k = 0; k < 70; k++) { const px = (k * 97 % w), py = (k * 53 % h); x.fillStyle = '#3a2412'; x.beginPath(); x.ellipse(px, py, 6, 4, k, 0, 6.28); x.fill(); x.fillStyle = '#7a4a1a'; x.beginPath(); x.ellipse(px, py, 3, 2, 0, 0, 6.28); x.fill(); } })); add(c, (X0 + X1) / 2 - L * 0.12, Y0 + Hh * 0.4, 0, -Math.PI / 2, 0, Math.PI / 2); c.scale.set(1, Wd * 1.1, 1); }
  if (m.horn === 'truck' || m.horn === 'bus') for (const s of [-0.12, 0.12]) add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 12, 1, true), chrome), X1 + 0.08, Y0 + Hh * 0.35, s, 0, 0, -Math.PI / 2);
  // the exhaust: tips at the back (a two-wheeler's silencer down the right side); where the flames and pops come from
  const ex = m.exhaust || (m.engine ? 'tune' : '');
  if (ex && cl !== 'cycle') {
    if (two) {
      const len = ex === 'dhak' ? 0.75 : 0.55, r = ex === 'dhak' ? 0.06 : 0.05;
      add(cyl(r * 0.8, r, len, chrome), X0 + 0.45, 0.36, 0.2, 0, 0, Math.PI / 2 - 0.12);
      if (ex === 'dhak') add(cyl(r * 1.05, r * 1.05, 0.06, black), X0 + 0.1, 0.32, 0.2, 0, 0, Math.PI / 2 - 0.12);
      v._tip = [X0 + 0.08, 0.33, 0.2];
    } else {
      const n = ex === 'flame' || m.turbo ? 2 : 1, r = ex === 'tune' ? 0.05 : ex === 'sport' ? 0.075 : 0.09;
      for (let i = 0; i < n; i++) { const z = n === 2 ? (i ? 1 : -1) * Wd * 0.28 : Wd * 0.3; add(cyl(r, r * 0.85, 0.45, chrome, 16), X0 - 0.08, Y0 + 0.22, z, 0, 0, Math.PI / 2); add(cyl(r * 0.8, r * 0.8, 0.02, black, 16), X0 - 0.31, Y0 + 0.22, z, 0, 0, Math.PI / 2); }
      v._tip = [X0 - 0.32, Y0 + 0.22, Wd * 0.3];
    }
  }
  // rims: a disc over each wheel's outer face (on your auto they turn with the wheel)
  if (m.rims && wh.length) {
    const t = rimTex(m.rims, m.rims === 6 ? cssCol(v.paint || [0.5, 0.5, 0.5]) : null), mat = new THREE.MeshStandardMaterial({ map: t, roughness: m.rims === 2 ? 0.5 : 0.15, metalness: m.rims === 2 ? 0.4 : 0.85, envMapIntensity: 1.3, transparent: true, alphaTest: 0.1 });
    v._rims = [];
    for (const w of wh) for (const s of Math.abs(w.z) < 0.05 ? [-1, 1] : [Math.sign(w.z)]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(w.r * 0.66, 32), mat.clone()), zz = s * (w.w / 2 + 0.008);
      if (w.mesh) { d.position.set(0, 0, zz); d.rotation.y = s > 0 ? 0 : Math.PI; w.mesh.add(d); v._rims.push(d); }
      else add(d, w.x, w.y, w.z + zz, 0, s > 0 ? 0 : Math.PI);
    }
  }
  // body: spoiler, front lip and skirts, roof carrier, bull bar, mud flaps
  if (cl === 'car') {
    if (m.spoiler === 1) add(box(0.14, 0.04, Wd * 0.86, black), X0 + 0.12, Y0 + Hh * 0.7, 0, 0, 0, -0.12);
    if (m.spoiler === 2) { add(box(0.3, 0.035, Wd * 0.98, black), X0 + 0.16, Y0 + Hh * 0.86, 0, 0, 0, -0.1); for (const s of [-1, 1]) { add(cyl(0.018, 0.018, Hh * 0.18, black, 6), X0 + 0.2, Y0 + Hh * 0.76, s * Wd * 0.32); add(box(0.32, 0.12, 0.02, black), X0 + 0.16, Y0 + Hh * 0.86, s * Wd * 0.49); } }
    if (m.kit) { add(box(0.1, 0.03, Wd * 0.9, black), X1 + 0.02, Y0 + 0.12, 0); for (const s of [-1, 1]) add(box(L * 0.5, 0.06, 0.05, black), (X0 + X1) / 2, Y0 + 0.17, s * (Wd / 2 + 0.01)); add(box(0.08, 0.05, Wd * 0.7, black), X0 - 0.02, Y0 + 0.13, 0); }
  }
  if (m.rack && !two) { const y = Y1 + 0.06, l = cl === 'auto' ? 0.9 : L * 0.42, x = cl === 'auto' ? -0.3 : (X0 + X1) / 2 - L * 0.05; for (const s of [-1, 1]) { add(box(l, 0.035, 0.035, black), x, y, s * Wd * 0.36); for (const e of [-1, 1]) add(box(0.04, 0.07, 0.04, black), x + e * l * 0.45, y - 0.035, s * Wd * 0.36); } for (let i = 0; i < 4; i++) add(box(0.03, 0.025, Wd * 0.74, black), x - l / 2 + l * (i + 0.5) / 4, y + 0.01, 0); }
  if (m.bullbar && (cl === 'car' || cl === 'tempo')) { for (const s of [-1, 1]) add(cyl(0.025, 0.025, 0.55, chrome, 8), X1 + 0.12, Y0 + 0.42, s * Wd * 0.3); for (const y of [0.25, 0.6]) add(cyl(0.025, 0.025, Wd * 0.62, chrome, 8), X1 + 0.12, Y0 + y, 0, Math.PI / 2); add(cyl(0.022, 0.022, 0.2, chrome, 8), X1 + 0.03, Y0 + 0.6, Wd * 0.3, 0, 0, Math.PI / 2); add(cyl(0.022, 0.022, 0.2, chrome, 8), X1 + 0.03, Y0 + 0.6, -Wd * 0.3, 0, 0, Math.PI / 2); }
  if (m.flaps != null && m.flaps !== '' && !two && wh.length) {
    const t = textTex('flap' + m.flaps, 0.3, 0.42, '#141414', '#f4d03f', FLAPS[m.flaps] || FLAPS[0], '"Yatra One", Mukta, sans-serif'), xr = Math.min(...wh.map(w => w.x));
    for (const w of wh.filter(q => Math.abs(q.x - xr) < 0.05 && Math.abs(q.z) > 0.05)) add(plane(0.3, 0.32, t, false, THREE.DoubleSide), w.x - w.r - 0.06, w.r * 0.85, w.z, 0, -Math.PI / 2);
  }
  // two-wheelers: crash guards, saddle bags; a cycle's basket
  if (m.crash && cl === 'two') for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.016, 6, 14, Math.PI), chrome), (X0 + X1) / 2 + 0.28, 0.42, s * 0.2, 0, 0, Math.PI / 2);
  if (m.saddle && cl === 'two') for (const s of [-1, 1]) add(box(0.42, 0.28, 0.12, new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.7 })), X0 + 0.4, 0.62, s * 0.25);
  if (m.basket && cl === 'cycle') add(box(0.32, 0.2, 0.3, new THREE.MeshStandardMaterial({ map: tex('mesh', 1, 1, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#c8ccd2'; c.lineWidth = 6; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * w / 8, 0); c.lineTo(i * w / 8, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 8); c.lineTo(w, i * h / 8); c.stroke(); } }, 128), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.3 })), X1 - 0.05, 0.95, 0);
  // an auto's own: the board on the back, rain curtains rolled up over the sides
  if (cl === 'auto' && m.patya != null && m.patya !== '') add(plane(0.78, 0.17, textTex('patya' + m.patya, 0.78, 0.17, '#fbf6e9', '#b3121b', PATYA[m.patya] || PATYA[0], '"Yatra One", Mukta, sans-serif')), X0 - 0.03, Y0 + Hh * 0.6, 0, 0, -Math.PI / 2);
  if (cl === 'auto' && m.curtain) for (const s of [-1, 1]) add(cyl(0.05, 0.05, 1.0, new THREE.MeshStandardMaterial({ color: 0x1f4d2e, roughness: 0.85 }), 10), -0.75, Y0 + Hh * 0.84, s * (Wd / 2 - 0.02), 0, 0, Math.PI / 2);
  // lights: fog lamps, a beacon or strobes on the roof (modfx flashes them)
  if (m.fogs) for (const s of two ? [0] : [-1, 1]) { add(cyl(0.06, 0.06, 0.04, black, 14), X1 + 0.02, Y0 + (two ? Hh * 0.55 : 0.32), s * Wd * 0.33, 0, 0, Math.PI / 2); add(new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), lamp(0xffe9a8)), X1 + 0.045, Y0 + (two ? Hh * 0.55 : 0.32), s * Wd * 0.33, 0, Math.PI / 2); }
  if (m.beacon && !two) {
    const y = Y1 + (m.rack ? 0.12 : 0.04), x = cl === 'auto' ? -0.2 : (X0 + X1) / 2 - L * 0.04;
    if (m.beacon === 'red') { const on = add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, 6.29, 0, Math.PI / 2), lamp(0xff1a1a)), x, y, 0), off = add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, 6.29, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a0808, roughness: 0.2, transparent: true, opacity: 0.9 })), x, y, 0); add(cyl(0.11, 0.11, 0.03, chrome, 14), x, y, 0); v._beacon = { a: [on], b: [], off: [off] }; on.visible = false; }
    else { const a = [], b = [], off = []; for (const s of [-1, 1]) { const l = add(box(0.1, 0.05, Wd * 0.3, lamp(s > 0 ? 0x2f6bff : 0xf4f8ff)), x, y + 0.02, s * Wd * 0.17); (s > 0 ? a : b).push(l); l.visible = false; off.push(add(box(0.1, 0.05, Wd * 0.3, new THREE.MeshStandardMaterial({ color: s > 0 ? 0x10204a : 0x3a3d44, roughness: 0.3 })), x, y + 0.019, s * Wd * 0.17)); } v._beacon = { a, b, off }; }
  }
  // on the dashboard and hanging from the mirror
  const dash = [X1 - L * 0.22, Y0 + Hh * 0.62, 0];
  if (m.ganpati) { add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8461f })), dash[0], dash[1], dash[2]); add(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 8), new THREE.MeshLambertMaterial({ color: 0xd4a017 })), dash[0], dash[1] + 0.08, dash[2]); }
  if (m.nimbu) { add(cyl(0.004, 0.004, 0.25, new THREE.MeshLambertMaterial({ color: 0x222222 }), 4), X1 - 0.05, Y0 + Hh * 0.72, 0); add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe8d22a })), X1 - 0.05, Y0 + Hh * 0.6, 0); for (let k = 0; k < 4; k++) add(cyl(0.008, 0.004, 0.09, new THREE.MeshLambertMaterial({ color: 0x2e8b2e }), 5), X1 - 0.05, Y0 + Hh * 0.53 - k * 0.01, (k - 1.5) * 0.02); }
  if (m.dice) for (const s of [-0.03, 0.04]) add(box(0.06, 0.06, 0.06, new THREE.MeshLambertMaterial({ color: 0xf4f2ee })), X1 - L * 0.3, Y0 + Hh * 0.75 - Math.abs(s) * 2, s, 0.4, 0.3, 0.2);
  if (m.led && !two) add(box(L * 0.6, 0.02, 0.03, lamp(m.led)), (X0 + X1) / 2, Y1 - 0.1, 0);
  if (m.meter && o.auto) add(plane(0.16, 0.1, textTex('meter', 0.16, 0.1, '#0b0f0b', '#ff3b30', '30.00', 'monospace')), X1 - L * 0.28, Y0 + Hh * 0.55, Wd * 0.28, 0, Math.PI / 2);
  if (m.dashcam && !two) add(box(0.05, 0.05, 0.08, black), X1 - L * (cl === 'auto' ? 0.15 : 0.32), Y1 - (cl === 'auto' ? 0.35 : 0.12), 0.1);
  // number plates: a fancy one, a VIP number, or the high-security plate (front and back)
  const pk = m.fancy ? 'fancy' : m.vip ? 'vip' : m.hsrp ? 'hsrp' : '';
  if (pk && cl !== 'cycle') { const txt = m.fancy || m.vip || v.plate || 'MH12'; for (const [x, ry] of [[X1 + 0.012, Math.PI / 2], [X0 - 0.012, -Math.PI / 2]]) add(plane(two ? 0.3 : 0.52, two ? 0.1 : 0.12, plateTex(pk, txt)), x, Y0 + (two ? 0.55 : 0.32), 0, 0, ry); }
  // knocked about: scrapes and dents down both sides (the garage shows them; the road shows its own smoke)
  if ((o.dmg || 0) > 0.08) for (const s of [-1, 1]) { const d = Math.round(o.dmg * 10) / 10; add(plane(L * 0.7, Hh * 0.4, tex('dmg' + d, L * 0.7, Hh * 0.4, (c, w, h) => { const n = Math.round(10 + d * 50); for (let k = 0; k < n; k++) { c.strokeStyle = `rgba(30,25,20,${0.3 + ((k * 37) % 10) / 25})`; c.lineWidth = 1 + (k % 3); const px = (k * 71) % w, py = (k * 29) % h; c.beginPath(); c.moveTo(px, py); c.lineTo(px + ((k % 7) - 3) * 9, py + ((k % 5) - 2) * 3); c.stroke(); } if (d > 0.35) for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(20,18,16,.35)'; c.beginPath(); c.ellipse((k * 61) % w, (k * 23) % h, 18, 10, 0, 0, 6.28); c.fill(); } }), true), (X0 + X1) / 2, Y0 + Hh * 0.38, s > 0 ? bb.max.z + 0.015 : bb.min.z - 0.015, 0, s > 0 ? 0 : Math.PI); }
  v.tilt.add(g); v._mods = g;
}
