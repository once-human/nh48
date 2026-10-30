// What you've done to your vehicles at the garage, kept per vehicle (your auto, and each one you own) and shown on
// them, on the road and in the garage bay: the colour, the engine stage and turbo, brakes, tyres (bulletproof
// too), the ride height, armour, neon under the body, the headlights, the horn, what hangs and sits inside (a
// Ganpati on the dashboard, nimbu-mirchi, fuzzy dice, an LED strip, seat covers, a digital meter), the plates.
import * as THREE from 'three';

export const COLOURS = [
  ['Midnight black', [0.012, 0.012, 0.014]], ['Pune yellow', [0.85, 0.6, 0.02]], ['CNG green', [0.03, 0.32, 0.08]], ['Pearl white', [0.82, 0.82, 0.8]],
  ['Racing red', [0.62, 0.02, 0.02]], ['Royal blue', [0.02, 0.06, 0.45]], ['Saffron', [0.95, 0.32, 0.02]], ['Gunmetal', [0.12, 0.13, 0.15]],
  ['Mint', [0.3, 0.7, 0.5]], ['Wine', [0.25, 0.01, 0.06]], ['Gold', [0.62, 0.42, 0.08]], ['Pink', [0.85, 0.2, 0.42]],
];
export const NEON = [['Blue', 0x2f7dff], ['Pink', 0xff2f9d], ['Green', 0x2fff7d], ['Saffron', 0xff8a1a], ['Purple', 0xa02fff], ['White', 0xeaf2ff]];
export const HORNS = [['Stock', ''], ['Pressure horn', 'truck'], ['Musical horn', 'tempo'], ['Bus horn', 'bus']];

// this vehicle's mods (made on first use): 'auto' for the stand's auto, the vehicle's id for the ones you own
export function modsOf(G, v) {
  const s = G.life && G.life.s; if (!s || !v) return null;
  const key = v === G.player.auto ? 'auto' : v.owned && v.owned.id; if (!key) return null;
  const M = s.mods || (s.mods = {});
  if (!M[key]) {
    M[key] = {};
    if (key === 'auto') { const U = s.upg || {}; if (U.engine) M.auto.engine = U.engine; if (U.horn) M.auto.horn = 'truck'; if (U.seat) M.auto.seat = 1; }    // what older saves bought
  }
  return M[key];
}
// handling and looks from the mods (called after any change, and when the vehicle comes out)
export function applyMods(G, v, extra = {}) {
  const m = modsOf(G, v) || extra.mods; if (!m) return;
  v.tune = 1 + (m.engine || 0) * 0.08;
  v.accMul = m.turbo ? 1.18 : 1;
  v.brakeMul = 1 + (m.brakes || 0) * 0.15;
  v.gripMul = 1 + (m.tyres ? 0.06 : 0) + (m.lower || 0) * 0.03;
  v.armorMul = 1 - (m.armor || 0) * 0.2;
  v.lower = (m.lower || 0) * 0.035;
  v.noFlat = !!m.bulletproof;
  v.hornKind = m.horn || '';
  v.lightCol = m.xenon ? 0xdfeaff : null;
  if (m.paint && v.bodyMesh) { v.paint = m.paint.slice(); v.bodyMesh.instanceColor.setXYZ(0, m.paint[0], m.paint[1], m.paint[2]); v.bodyMesh.instanceColor.needsUpdate = true; }
  if (m.plate) v.plate = m.plate;
  dress(v, m, { sticker: extra.sticker, dmg: extra.dmg, auto: v === G.player.auto || extra.auto });
}

const chrome = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
// a soft-edged pool of light (white; the neon's colour tints it)
let GT = null;
function glowTex() {
  if (GT) return GT;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); GT = new THREE.CanvasTexture(cv); return GT;
}
const tex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = Math.max(32, Math.round(256 * h / w)); draw(cv.getContext('2d'), cv.width, cv.height); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
const plane = (w, h, draw, alpha) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex(w, h, draw), transparent: !!alpha, depthWrite: !alpha }));
// the mods you can see, hung off the vehicle (replaced whole each time)
export function dress(v, m, o = {}) {
  if (v._mods) { v.tilt.remove(v._mods); v._mods.traverse(q => { if (q.geometry) q.geometry.dispose(); if (q.material && q.material !== chrome) { if (q.material.map && q.material.map !== GT) q.material.map.dispose(); q.material.dispose(); } }); v._mods = null; }
  if (!v.bodyMesh || !v.tilt) return;
  const bg = v.bodyMesh.geometry; if (!bg.boundingBox) bg.computeBoundingBox(); const bb = bg.boundingBox;
  const X0 = bb.min.x, X1 = bb.max.x, L = X1 - X0, Wd = bb.max.z - bb.min.z, Y0 = bb.min.y, Hh = bb.max.y - bb.min.y, two = v.spec && v.spec.two;
  const g = new THREE.Group(); g.name = 'mods';
  // neon under the body: a hard strip of light and a soft spill on the road
  if (m.neon) {
    for (const [sc, op] of [[1.0, 0.9], [1.7, 0.45]]) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(L * sc, Wd * sc), new THREE.MeshBasicMaterial({ color: m.neon, map: glowTex(), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      n.rotation.x = -Math.PI / 2; n.position.set((X0 + X1) / 2, Y0 + 0.1, 0); g.add(n);
    }
  }
  if (o.sticker != null && o.auto) { const t = o.sticker, s = plane(0.9, 0.2, (c, w, h) => { c.fillStyle = '#0c0b0a'; c.fillRect(0, 0, w, h); c.fillStyle = '#F2C230'; c.textAlign = 'center'; c.font = `400 ${Math.round(h * 0.62)}px "Yatra One", Mukta, sans-serif`; c.fillText(t, w / 2, h * 0.72); }); s.position.set(X0 - 0.015, Y0 + Hh * 0.45, 0); s.rotation.y = -Math.PI / 2; g.add(s); }
  if (m.seat && !two) { const c = plane(0.7, 0.5, (x, w, h) => { x.fillStyle = '#d9a441'; x.fillRect(0, 0, w, h); for (let k = 0; k < 70; k++) { const px = (k * 97 % w), py = (k * 53 % h); x.fillStyle = '#3a2412'; x.beginPath(); x.ellipse(px, py, 6, 4, k, 0, 6.28); x.fill(); x.fillStyle = '#7a4a1a'; x.beginPath(); x.ellipse(px, py, 3, 2, 0, 0, 6.28); x.fill(); } }); c.position.set((X0 + X1) / 2 - L * 0.12, Y0 + Hh * 0.4, 0); c.rotation.set(-Math.PI / 2, 0, Math.PI / 2); c.scale.set(1, Wd * 1.1, 1); g.add(c); }
  if (m.horn === 'truck' || m.horn === 'bus') for (const s of [-0.12, 0.12]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 12, 1, true), chrome); h.rotation.z = -Math.PI / 2; h.position.set(X1 + 0.08, Y0 + Hh * 0.35, s); g.add(h); }
  if (m.engine) for (const s of m.turbo ? [-1, 1] : [1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.5, 12), chrome); e.rotation.z = Math.PI / 2; e.position.set(X0 - 0.1, Y0 + 0.22, s * Wd * 0.3); g.add(e); }
  // on the dashboard and hanging from the mirror
  const dash = [X1 - L * 0.22, Y0 + Hh * 0.62, 0];
  if (m.ganpati) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8461f })); b.position.set(dash[0], dash[1], dash[2]); g.add(b); const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 8), new THREE.MeshLambertMaterial({ color: 0xd4a017 })); c.position.set(dash[0], dash[1] + 0.08, dash[2]); g.add(c); }
  if (m.nimbu) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 4), new THREE.MeshLambertMaterial({ color: 0x222222 })); s.position.set(X1 - 0.05, Y0 + Hh * 0.72, 0); g.add(s); const l = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe8d22a })); l.position.set(X1 - 0.05, Y0 + Hh * 0.6, 0); g.add(l); for (let k = 0; k < 4; k++) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.09, 5), new THREE.MeshLambertMaterial({ color: 0x2e8b2e })); ch.position.set(X1 - 0.05, Y0 + Hh * 0.53 - k * 0.01, (k - 1.5) * 0.02); g.add(ch); } }
  if (m.dice) for (const s of [-0.03, 0.04]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshLambertMaterial({ color: 0xf4f2ee })); d.position.set(X1 - L * 0.3, Y0 + Hh * 0.75 - Math.abs(s) * 2, s); d.rotation.set(0.4, 0.3, 0.2); g.add(d); }
  if (m.led && !two) { const l = new THREE.Mesh(new THREE.BoxGeometry(L * 0.6, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: m.led, toneMapped: false })); l.position.set((X0 + X1) / 2, bb.max.y - 0.1, 0); g.add(l); }
  if (m.meter && o.auto) { const mt = plane(0.16, 0.1, (c, w, h) => { c.fillStyle = '#0b0f0b'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff3b30'; c.font = `700 ${Math.round(h * 0.6)}px monospace`; c.textAlign = 'center'; c.fillText('30.00', w / 2, h * 0.72); }); mt.position.set(X1 - L * 0.28, Y0 + Hh * 0.55, Wd * 0.28); mt.rotation.y = Math.PI / 2; g.add(mt); }
  if (m.vip) for (const [x, ry] of [[X1 + 0.012, Math.PI / 2], [X0 - 0.012, -Math.PI / 2]]) { const p = plane(two ? 0.28 : 0.52, 0.12, (c, w, h) => { c.fillStyle = '#f2c230'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1b1c1f'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4); c.fillStyle = '#1b1c1f'; c.textAlign = 'center'; c.font = `900 ${Math.round(h * 0.55)}px Archivo, sans-serif`; c.fillText(m.vip, w / 2, h * 0.7); }); p.position.set(x, Y0 + 0.32, 0); p.rotation.y = ry; g.add(p); }
  // knocked about: scrapes and dents down both sides (the garage shows them; the road shows its own smoke)
  if ((o.dmg || 0) > 0.08) for (const s of [-1, 1]) { const d = o.dmg; const p = plane(L * 0.7, Hh * 0.4, (c, w, h) => { const n = Math.round(10 + d * 50); for (let k = 0; k < n; k++) { c.strokeStyle = `rgba(30,25,20,${0.3 + ((k * 37) % 10) / 25})`; c.lineWidth = 1 + (k % 3); const px = (k * 71) % w, py = (k * 29) % h; c.beginPath(); c.moveTo(px, py); c.lineTo(px + ((k % 7) - 3) * 9, py + ((k % 5) - 2) * 3); c.stroke(); } if (d > 0.35) for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(20,18,16,.35)'; c.beginPath(); c.ellipse((k * 61) % w, (k * 23) % h, 18, 10, 0, 0, 6.28); c.fill(); } }, true); p.position.set((X0 + X1) / 2, Y0 + Hh * 0.38, s > 0 ? bb.max.z + 0.015 : bb.min.z - 0.015); p.rotation.y = s > 0 ? 0 : Math.PI; g.add(p); }
  v.tilt.add(g); v._mods = g;
}
