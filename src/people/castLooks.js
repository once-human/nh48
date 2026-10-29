// The story's people, each their own person: the same face and clothes every time you meet them, dressed for
// who they are (Aai's maroon nine-yard, Bapu Kaka's khaki and white topi, Bhau's starched white kurta, the
// cyber-cell ACP in a pressed shirt, the delivery riders, the Baner designers, the Koregaon Park crowd).
// A base look is drawn from a seed of their name (skin, face, build), then their wardrobe goes on top.
import * as THREE from 'three';
import { RNG } from '../core/util.js';

const c = (h) => new THREE.Color(h).convertSRGBToLinear();
const V = (x, y, z, w) => new THREE.Vector4(x, y, z, w);
// cut: x sleeve (0.3 short .. 0.95 full), y top length, z lower length, w 0 shirt+trousers / 1 kurta / 2 saree
const CAST = {
  aai: { f: true, scale: 0.93, top: 0x6e1420, bottom: 0x6e1420, cut: V(0.3, 1, 0.9, 2), style: 'hair_buns', hair: 0x2a2522, bindi: true, glasses: true, persona: 'kaku', idle: 'talk' },
  bapu: { f: false, scale: 0.95, top: 0x9b8a5e, bottom: 0x8a7b54, cut: V(0.4, 1, 0.5, 0), style: 'hair_buzzed', hair: 0x8f8a84, beard: true, glasses: true, hat: true, hatCol: 0xf2f0ea, persona: 'ajoba', idle: 'arms_folded' },
  shinde: { f: true, scale: 0.97, top: 0xf2f2ef, bottom: 0x1b2333, cut: V(0.95, 1, 0.5, 0), style: 'hair_buns', hair: 0x141210, glasses: true, persona: 'tai', idle: 'arms_folded' },
  tj: { f: false, scale: 0.96, top: 0xe8402a, bottom: 0x3a3f47, cut: V(0.38, 1, 0.5, 0), style: 'hair_simpleparted', hair: 0x141210, hat: true, hatCol: 0x1a1a1a, pat: 4, patCol: 0xf6d743, persona: 'collegeboy', idle: 'phone' },
  khushi: { f: true, scale: 0.94, top: 0xb7a3d6, bottom: 0x2e4a72, cut: V(0.85, 0.6, 0.55, 1), style: 'pony', hair: 0x1c1512, glasses: true, persona: 'collegegirl', idle: 'phone' },
  kunal: { f: false, scale: 0.98, top: 0x5c6b47, bottom: 0xc8b893, cut: V(0.4, 1, 0.5, 0), style: 'hair_simpleparted', hair: 0x1c1512, beard: true, glasses: true, persona: 'kpguy', idle: 'phone' },
  tara: { f: true, scale: 0.95, top: 0x111114, bottom: 0x1c1c22, cut: V(0.05, 1, 0.5, 0), style: 'hair_long', hair: 0x2b1a12, persona: 'kpgirl', idle: 'talk' },
  veer: { f: false, scale: 0.99, top: 0x121214, bottom: 0x262a33, cut: V(0.38, 1, 0.5, 0), style: 'hair_buzzed', hair: 0x101010, beard: true, persona: 'kpguy', idle: 'arms_folded' },
  meera: { f: true, scale: 0.94, top: 0xf0ede4, bottom: 0x35507a, cut: V(0.9, 0.6, 0.55, 1), style: 'braid', hair: 0x17110e, glasses: true, persona: 'tai', idle: 'phone' },
  ira: { f: true, scale: 0.93, top: 0x2f6f73, bottom: 0x1f2229, cut: V(0.4, 1, 0.5, 0), style: 'hair_long', hair: 0x1a1210, persona: 'collegegirl', idle: 'talk' },
  bhau: { f: false, scale: 1.04, top: 0xf7f6f1, bottom: 0xf3f1ea, cut: V(0.95, 0.5, 0.55, 1), style: 'hair_simpleparted', hair: 0x0e0c0b, beard: true, persona: 'dada', idle: 'arms_folded' },
  kabir: { f: false, scale: 1.0, top: 0x1d2a44, bottom: 0x6b6f76, cut: V(0.95, 1, 0.5, 0), style: 'hair_simpleparted', hair: 0x18120f, beard: true, persona: 'kpguy', idle: 'talk' },
  harish: { f: false, scale: 1.0, top: 0xf1ead9, bottom: 0x2a2a2e, cut: V(0.95, 1, 0.5, 0), style: 'hair_simpleparted', hair: 0x9a958e, glasses: true, persona: 'kaka', idle: 'arms_folded' },
  aryan: { f: false, scale: 1.01, top: 0xf6f3ec, bottom: 0xcfc3a8, cut: V(0.6, 1, 0.5, 0), style: 'hair_simpleparted', hair: 0x0f0b09, shades: true, persona: 'kpguy', idle: 'talk' },
  sunny: { f: false, scale: 0.95, top: 0xf28a1d, bottom: 0x2b3240, cut: V(0.38, 1, 0.5, 0), style: 'hair_buzzed', hair: 0x141210, beard: true, persona: 'bhaiya', idle: 'idle' },
  barista: { f: false, scale: 0.96, top: 0x17171a, bottom: 0x5a4a3a, cut: V(0.38, 1, 0.5, 0), style: 'hair_simpleparted', hair: 0x1c1512, persona: 'collegeboy', idle: 'talk' },
  warkari: { f: false, scale: 0.92, top: 0xf4f2ea, bottom: 0xf0ede3, cut: V(0.9, 0.5, 0.55, 1), style: 'hair_buzzed', hair: 0xb9b5ae, beard: true, hat: true, hatCol: 0xfbfaf6, persona: 'ajoba', idle: 'talk' },
  goons: { f: false, scale: 1.03, top: 0x16161a, bottom: 0x2a2c30, cut: V(0.38, 1, 0.5, 0), style: 'hair_buzzed', hair: 0x0e0c0b, beard: true, persona: 'dada', idle: 'arms_folded' },
  raghu: { f: false, scale: 1.03, top: 0xf2f2ee, bottom: 0x2b2b2e, cut: V(0.95, 1, 0.5, 0), style: 'hair_simpleparted', hair: 0x0e0c0b, beard: true, shades: true, persona: 'dada', idle: 'arms_folded' },
};
const SKINS = { aai: 0x8d5a3b, bapu: 0x6e4429, shinde: 0x9a6a48, bhau: 0x7a4c2f, warkari: 0x5f3a24, harish: 0xc29274, aryan: 0xc79a7c, kabir: 0xa77452 };

export function hasCast(who) { return !!CAST[who]; }
export function castPersona(who) { return CAST[who] ? CAST[who].persona : null; }
export function castIdle(who) { return CAST[who] ? CAST[who].idle : 'talk'; }
// a cast member's look (i: for a group like the goons, each one a little different)
export function castLook(kit, who, i = 0) {
  const C = CAST[who]; if (!kit || !C) return null;
  let h = 7; for (const ch of who) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const L = kit.randomLook(new RNG(h + i * 977), { female: C.f, dress: 'modern' });
  L.top = c(C.top); L.bottom = c(C.bottom); L.cut = C.cut.clone(); L.style = C.style; L.hair = c(C.hair);
  L.scale = C.scale + (i ? (i % 2 ? 0.02 : -0.015) : 0);
  L.beard = !!C.beard; L.glasses = !!C.glasses; L.shades = !!C.shades; L.bindi = !!C.bindi;
  L.hat = !!C.hat; if (C.hatCol) L.hatCol = c(C.hatCol);
  L.pat = C.pat || 0; if (C.patCol) L.patCol = c(C.patCol);
  if (SKINS[who]) L.skin = c(SKINS[who]);
  L.shoe = c(who === 'bhau' || who === 'aai' || who === 'warkari' ? 0x5a3a22 : who === 'aryan' ? 0x6b4a2e : 0x16140f);
  L.acc = null; L.cast = who;
  return L;
}
