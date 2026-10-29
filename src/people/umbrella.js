// Umbrellas for the monsoon: most people open one when it rains (black mostly, the odd maroon, navy, a check,
// a bright one from Tulshibaug). One shape, used two ways: a real umbrella in the hand of the dressed people
// near you, and an instanced canopy over the far figures.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLS = [0x141414, 0x141414, 0x141414, 0x1b1b22, 0x1c2a4a, 0x5a1a22, 0x2c3a2a, 0x3b2a52, 0xb8242c, 0x1f6fb5, 0xe0a21a, 0x6a6e74];
// who carries one (most, never the police on duty or someone waving down an auto), and its colour
export function hasUmbrella(p) { return !p.cop && !p.pax && !p.crew && ((p.id >>> 3) % 10) < 6; }
export function umbrellaColor(p) { return COLS[(p.id >>> 5) % COLS.length]; }

// three kinds: the everyday 8-panel black (most), a big golf umbrella, a small folding one
export function umbrellaKind(p) { const k = (p.id >>> 11) % 10; return k < 6 ? 0 : k < 8 ? 1 : 2; }
const KINDS = [
  { r: 0.5, h: 0.24, ribs: 8, shaft: 0.74, sag: 0.035 },     // everyday
  { r: 0.62, h: 0.22, ribs: 8, shaft: 0.82, sag: 0.04 },     // golf
  { r: 0.43, h: 0.2, ribs: 6, shaft: 0.62, sag: 0.03 },      // folding
];
const GEO = [];
// origin at the hand: the shaft up, a domed canopy whose cloth sags between the ribs, the rib tips, the ferrule on
// top, a J handle below the hand
export function umbrellaGeo(kind = 0) {
  if (GEO[kind]) return GEO[kind];
  const K = KINDS[kind], top = K.shaft + 0.06, seg = K.ribs * 4, rings = 7;
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, rr = K.r * Math.sin(t * Math.PI / 2), yy = top - K.h * (1 - Math.cos(t * Math.PI / 2));
    for (let j = 0; j <= seg; j++) {
      const a = j / seg * Math.PI * 2, between = Math.abs(Math.sin(a * K.ribs / 2));   // 0 on a rib, 1 mid-panel
      const sag = K.sag * between * t, inward = 1 - 0.05 * between * t * t;
      pos.push(Math.cos(a) * rr * inward, yy - sag, Math.sin(a) * rr * inward);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const canopy = new THREE.BufferGeometry(); canopy.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); canopy.setIndex(idx); canopy.computeVertexNormals();
  const parts = [canopy];
  for (let k = 0; k < K.ribs; k++) { const a = k / K.ribs * Math.PI * 2, b = new THREE.SphereGeometry(0.014, 4, 3); b.translate(Math.cos(a) * K.r * 0.995, top - K.h - 0.004, Math.sin(a) * K.r * 0.995); parts.push(b); }
  const shaft = new THREE.CylinderGeometry(0.009, 0.009, top, 5); shaft.translate(0, top / 2, 0); parts.push(shaft);
  const fer = new THREE.CylinderGeometry(0.004, 0.01, 0.07, 5); fer.translate(0, top + 0.035, 0); parts.push(fer);
  const grip = new THREE.CylinderGeometry(0.016, 0.016, 0.1, 6); grip.translate(0, -0.02, 0); parts.push(grip);
  if (kind !== 2) { const hook = new THREE.TorusGeometry(0.04, 0.013, 5, 8, Math.PI); hook.rotateZ(Math.PI); hook.translate(0.04, -0.07, 0); parts.push(hook); }
  GEO[kind] = mergeGeometries(parts.map(g => { const q = g.index ? g.toNonIndexed() : g; if (q.attributes.uv) q.deleteAttribute('uv'); if (!q.attributes.normal) q.computeVertexNormals(); return q; }));
  return GEO[kind];
}
export function umbrellaMat() { return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide }); }
