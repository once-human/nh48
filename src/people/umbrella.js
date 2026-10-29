// Umbrellas for the monsoon: most people open one when it rains (black mostly, the odd maroon, navy, a check,
// a bright one from Tulshibaug). One shape, used two ways: a real umbrella in the hand of the dressed people
// near you, and an instanced canopy over the far figures.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLS = [0x141414, 0x141414, 0x141414, 0x1b1b22, 0x1c2a4a, 0x5a1a22, 0x2c3a2a, 0x3b2a52, 0xb8242c, 0x1f6fb5, 0xe0a21a, 0x6a6e74];
// who carries one (most, never the police on duty or someone waving down an auto), and its colour
export function hasUmbrella(p) { return !p.cop && !p.pax && !p.crew && ((p.id >>> 3) % 10) < 6; }
export function umbrellaColor(p) { return COLS[(p.id >>> 5) % COLS.length]; }

// origin at the hand; the shaft up 0.92 m, the canopy over it
export function umbrellaGeo() {
  const canopy = new THREE.ConeGeometry(0.56, 0.27, 8, 1, true); canopy.translate(0, 1.0, 0);
  // the ribs' tips, a little lower than the cloth between them, so it reads as an umbrella not a lampshade
  const edge = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, b = new THREE.SphereGeometry(0.018, 4, 3); b.translate(Math.cos(a) * 0.555, 0.855, Math.sin(a) * 0.555); edge.push(b); }
  const shaft = new THREE.CylinderGeometry(0.011, 0.011, 1.0, 5); shaft.translate(0, 0.52, 0);
  const tip = new THREE.CylinderGeometry(0.006, 0.012, 0.09, 5); tip.translate(0, 1.17, 0);
  const handle = new THREE.TorusGeometry(0.045, 0.014, 5, 8, Math.PI); handle.rotateZ(Math.PI); handle.translate(0.045, 0.02, 0);
  const parts = [canopy, ...edge, shaft, tip, handle].map(g => { const q = g.index ? g.toNonIndexed() : g; q.deleteAttribute('uv'); return q; });
  return mergeGeometries(parts);
}
export function umbrellaMat() { return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide }); }
