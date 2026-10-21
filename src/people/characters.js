// The player's character: picked once on the first Start (and changeable from the menu).
// Colours here are deliberately outside the street crowd's palettes, and the crowd never copies
// your hair + top, so you can always pick yourself out.
import * as THREE from 'three';
import { safeStorage } from '../core/util.js';

const c = (h) => new THREE.Color(h).convertSRGBToLinear();
export const SKINS = [
  { id: 'fair', name: 'Fair', hex: 0xe2b394 },
  { id: 'wheatish', name: 'Wheatish', hex: 0xd6a17c },
  { id: 'medium', name: 'Medium', hex: 0xc98f68 },
  { id: 'brown', name: 'Brown', hex: 0xa36945 },
];
export const CHARACTERS = [
  { id: 'aarav', name: 'Aarav', female: false, blurb: 'Engineering student from Kothrud. Knows every shortcut, uses none of them.',
    style: 'hair_simpleparted', beard: false, top: 0x1e7a6d, bottom: 0x2c3e66, shoe: 0xeeeeee, cut: [0.92, 1, 0.4, 0] },
  { id: 'kabir', name: 'Kabir', female: false, blurb: 'Third-generation auto driver from Kasba Peth. Mustard kurta, strong opinions.',
    style: 'hair_simpleparted', beard: true, top: 0xe0ac3c, bottom: 0xf1ece0, shoe: 0x3b2a1f, cut: [0.88, 0.55, 0.8, 1] },
  { id: 'vikram', name: 'Vikram', female: false, blurb: 'Gym in the morning, Camp in the evening, never on time.',
    style: 'hair_buzzed', beard: true, top: 0x161616, bottom: 0x55603a, shoe: 0x1d1a18, cut: [0.4, 1, 0.3, 0] },
  { id: 'ananya', name: 'Ananya', female: true, blurb: 'Design student on FC Road. Drives faster than her brother.',
    style: 'hair_long', beard: false, top: 0xd4486a, bottom: 0x2c3e66, shoe: 0xeeeeee, cut: [0.38, 1, 0.5, 0] },
  { id: 'meera', name: 'Meera', female: true, blurb: 'Runs her late father’s auto out of Sadashiv Peth. Takes no nonsense.',
    style: 'hair_buns', beard: false, top: 0x1f8a8a, bottom: 0xf3efe6, shoe: 0x3b2a1f, cut: [0.85, 0.55, 0.8, 1] },
  { id: 'sana', name: 'Sana', female: true, blurb: 'Night-shift techie from Koregaon Park. Knows where the good chai is at 2 am.',
    style: 'hair_buzzedfemale', beard: false, top: 0x8f7ac4, bottom: 0x1b1c1f, shoe: 0x1d1a18, cut: [0.92, 1, 0.45, 0] },
];

export function lookFor(charId, skinId) {
  const ch = CHARACTERS.find(x => x.id === charId) || CHARACTERS[0];
  const sk = SKINS.find(x => x.id === skinId) || SKINS[1];
  return {
    female: ch.female, skin: c(sk.hex), top: c(ch.top), bottom: c(ch.bottom), shoe: c(ch.shoe),
    cut: new THREE.Vector4(...ch.cut), hair: c(0x0d0b0a), style: ch.style, beard: ch.beard,
    scale: ch.female ? 0.95 : 0.98, acc: null, player: true,
  };
}
export function savedCharacter() {
  try { const st = safeStorage(); const v = st && JSON.parse(st.getItem('nh48_char') || 'null'); return v && v.id ? v : null; } catch (e) { return null; }
}
export function saveCharacter(id, skin) {
  try { const st = safeStorage(); if (st) st.setItem('nh48_char', JSON.stringify({ id, skin })); } catch (e) { /* private window */ }
}
