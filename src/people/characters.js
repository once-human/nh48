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
// hair is black, one style each; the choice is what you wear
export const HAIRS = { m: [{ id: 'part', name: 'Side parting', style: 'hair_simpleparted' }], f: [{ id: 'long', name: 'Long', style: 'hair_long' }] };
export const HAIR_COLS = [{ id: 'black', name: 'Black', hex: 0x0d0b0a }];
export const OUTFITS = {
  m: [{ id: 'casual', name: 'Casual', sub: 'Tee and jeans', top: 0x1e7a6d, bottom: 0x2c3e66, shoe: 0xeeeeee, cut: [0.38, 1, 0.4, 0] },
    { id: 'western', name: 'Western', sub: 'Shirt and chinos', top: 0xf2f0ea, bottom: 0x23324d, shoe: 0x5a3a24, cut: [0.92, 1, 0.6, 0] },
    { id: 'trad', name: 'Traditional', sub: 'Kurta pyjama', top: 0xe0ac3c, bottom: 0xf1ece0, shoe: 0x3b2a1f, cut: [0.88, 0.55, 0.8, 1] }],
  f: [{ id: 'casual', name: 'Casual', sub: 'Top and jeans', top: 0xd4486a, bottom: 0x2c3e66, shoe: 0xeeeeee, cut: [0.38, 1, 0.5, 0] },
    { id: 'western', name: 'Western', sub: 'Shirt and trousers', top: 0x16161a, bottom: 0xe9dccb, shoe: 0x1d1a18, cut: [0.92, 1, 0.5, 0] },
    { id: 'trad', name: 'Traditional', sub: 'Saree', top: 0xa3122a, bottom: 0x8a0f24, shoe: 0x3b2a1f, cut: [0.3, 1, 0.9, 2] }],
};
export const DEFAULT = { female: false, name: '', hair: 'part', hairCol: 'black', outfit: 'casual', skin: 'wheatish' };
const OLD = { aarav: [false, 'Aarav', 'part', 'casual'], kabir: [false, 'Kabir', 'part', 'trad'], vikram: [false, 'Vikram', 'part', 'casual'],
  ananya: [true, 'Ananya', 'long', 'casual'], meera: [true, 'Meera', 'long', 'trad'], sana: [true, 'Sana', 'long', 'western'] };
const OLD_OUT = { tee: 'casual', shirt: 'western', kurta: 'trad', top: 'casual', kurti: 'trad', saree: 'trad' };

// fill in anything missing (and read a save from before the creator)
export function normalise(ch) {
  ch = { ...DEFAULT, ...(ch || {}) };
  // a save from before the creator: convert it once, then it's an ordinary character (never re-applied)
  if (ch.id && OLD[ch.id] && !ch.made) { const [f, n, h, o] = OLD[ch.id]; Object.assign(ch, { female: f, name: ch.name || n, hair: h, outfit: o }); }
  delete ch.id; ch.made = true;
  const g = ch.female ? 'f' : 'm';
  if (OLD_OUT[ch.outfit]) ch.outfit = OLD_OUT[ch.outfit];
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
