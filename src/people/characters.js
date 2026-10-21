// The player's character, made once on the first Start (and changeable from the menu): man or woman, a
// name, a hairstyle, a hair colour, an outfit and a skin tone. The crowd never copies your hair + top,
// so you can always pick yourself out.
import * as THREE from 'three';
import { safeStorage } from '../core/util.js';

const c = (h) => new THREE.Color(h).convertSRGBToLinear();
export const SKINS = [
  { id: 'fair', name: 'Fair', hex: 0xe2b394 },
  { id: 'wheatish', name: 'Wheatish', hex: 0xd6a17c },
  { id: 'medium', name: 'Medium', hex: 0xc98f68 },
  { id: 'brown', name: 'Brown', hex: 0xa36945 },
];
export const HAIRS = {
  m: [{ id: 'part', name: 'Side parting', style: 'hair_simpleparted' }, { id: 'army', name: 'Army cut', style: 'hair_buzzed' }, { id: 'beard', name: 'Parting and beard', style: 'hair_simpleparted', beard: true }],
  f: [{ id: 'long', name: 'Long and open', style: 'hair_long' }, { id: 'pony', name: 'Ponytail', style: 'pony' }, { id: 'bun', name: 'Bun', style: 'hair_buns' }, { id: 'braid', name: 'Plait', style: 'braid' }],
};
export const HAIR_COLS = [
  { id: 'black', name: 'Black', hex: 0x0d0b0a }, { id: 'dark', name: 'Dark brown', hex: 0x2a201a }, { id: 'brown', name: 'Brown', hex: 0x4a2f22 },
  { id: 'henna', name: 'Henna', hex: 0x5c2a1e }, { id: 'caramel', name: 'Caramel', hex: 0x7a5232 },
];
export const OUTFITS = {
  m: [{ id: 'tee', name: 'Tee and jeans', top: 0x1e7a6d, bottom: 0x2c3e66, shoe: 0xeeeeee, cut: [0.38, 1, 0.4, 0] },
    { id: 'shirt', name: 'Shirt and chinos', top: 0x9cc0e6, bottom: 0xcbb89a, shoe: 0x5a3a24, cut: [0.92, 1, 0.6, 0] },
    { id: 'kurta', name: 'Kurta', top: 0xe0ac3c, bottom: 0xf1ece0, shoe: 0x3b2a1f, cut: [0.88, 0.55, 0.8, 1] }],
  f: [{ id: 'top', name: 'Top and jeans', top: 0xd4486a, bottom: 0x2c3e66, shoe: 0xeeeeee, cut: [0.38, 1, 0.5, 0] },
    { id: 'kurti', name: 'Kurti', top: 0x1f8a8a, bottom: 0xf3efe6, shoe: 0x3b2a1f, cut: [0.85, 0.55, 0.8, 1] },
    { id: 'saree', name: 'Saree', top: 0xa3122a, bottom: 0x8a0f24, shoe: 0x3b2a1f, cut: [0.3, 1, 0.9, 2] }],
};
export const DEFAULT = { female: false, name: '', hair: 'part', hairCol: 'black', outfit: 'tee', skin: 'wheatish' };
const OLD = { aarav: [false, 'Aarav', 'part', 'tee'], kabir: [false, 'Kabir', 'beard', 'kurta'], vikram: [false, 'Vikram', 'army', 'tee'],
  ananya: [true, 'Ananya', 'long', 'top'], meera: [true, 'Meera', 'bun', 'kurti'], sana: [true, 'Sana', 'pony', 'top'] };

// fill in anything missing (and read a save from before the creator)
export function normalise(ch) {
  ch = { ...DEFAULT, ...(ch || {}) };
  if (ch.id && OLD[ch.id] && !ch.made) { const [f, n, h, o] = OLD[ch.id]; Object.assign(ch, { female: f, name: ch.name || n, hair: h, outfit: o }); }
  const g = ch.female ? 'f' : 'm';
  if (!HAIRS[g].some(h => h.id === ch.hair)) ch.hair = HAIRS[g][0].id;
  if (!OUTFITS[g].some(o => o.id === ch.outfit)) ch.outfit = OUTFITS[g][0].id;
  if (!HAIR_COLS.some(h => h.id === ch.hairCol)) ch.hairCol = 'black';
  if (!ch.name) ch.name = ch.female ? 'Ananya' : 'Aarav';
  return ch;
}
export function lookOf(ch) {
  ch = normalise(ch);
  const g = ch.female ? 'f' : 'm', H = HAIRS[g].find(h => h.id === ch.hair), O = OUTFITS[g].find(o => o.id === ch.outfit);
  const sk = SKINS.find(x => x.id === ch.skin) || SKINS[1], hc = HAIR_COLS.find(h => h.id === ch.hairCol) || HAIR_COLS[0];
  return {
    female: ch.female, skin: c(sk.hex), top: c(O.top), bottom: c(O.bottom), shoe: c(O.shoe),
    cut: new THREE.Vector4(...O.cut), hair: c(hc.hex), style: H.style, beard: !!H.beard,
    scale: ch.female ? 0.95 : 0.98, acc: null, player: true,
  };
}
// kept for older callers: (id, skin) or a saved character object
export function lookFor(a, skin) { return lookOf(typeof a === 'object' && a ? a : { id: a, skin }); }
export function savedCharacter() {
  try { const st = safeStorage(); const v = st && JSON.parse(st.getItem('nh48_char') || 'null'); return v && (v.id || v.made) ? normalise(v) : null; } catch (e) { return null; }
}
export function saveCharacter(ch) {
  try { const st = safeStorage(); if (st) st.setItem('nh48_char', JSON.stringify({ ...normalise(ch), made: true })); } catch (e) { /* private window */ }
}
export function playerName() { const v = savedCharacter(); return v ? v.name : ''; }
