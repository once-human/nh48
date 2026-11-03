// /experiment: the shop boards, all painted into one atlas (one texture, one draw for every sign in the street).
// Made-up shops of an old Peth lane, Marathi and English, hand-lettered with a little grime.
import * as THREE from 'three';
import { rng } from './geo.js';

const MR = "'Yatra One', 'Mukta', sans-serif", MR2 = "'Rozha One', 'Mukta', serif", EN = "800 1em 'Archivo', sans-serif", HAND = "'Kalam', 'Mukta', sans-serif";
// main, second line, board, letters, font for the main line
export const SIGNS = [
  ['श्री गणेश किराणा', 'SHREE GANESH KIRANA STORES', '#f2c230', '#b8261c', MR],
  ['अमृततुल्य', 'चहा · क्रीमरोल · बन मस्का', '#c8302a', '#f6e6b0', MR],
  ['SAI MEDICAL', '& GENERAL STORES · OPEN 24 HRS', '#2f8a5a', '#ffffff', EN],
  ['मिसळ हाऊस', 'MISAL · POHE · UPMA', '#f08a24', '#1a1512', MR2],
  ['XEROX', 'LAMINATION · SPIRAL BINDING · PRINT', '#2f5fd0', '#f2c230', EN],
  ['काका वडापाव', 'वडापाव · भजी · चहा', '#f4efe2', '#c8302a', MR],
  ['OM SWEETS', 'मिठाई · फरसाण · नमकीन', '#7a2a30', '#f2c230', EN],
  ['साडी सेंटर', 'SAREE CENTRE · पैठणी', '#d8607e', '#ffffff', MR2],
  ['PATIL HARDWARE', 'PAINTS · SANITARY · PLUMBING', '#1c1c1e', '#f2c230', EN],
  ['KULKARNI OPTICIANS', 'चष्मा घर · EYE TESTING', '#f4efe2', '#2f5fd0', EN],
  ['MOBILE REPAIRING', 'RECHARGE · ACCESSORIES', '#d83a2a', '#ffffff', EN],
  ['लक्ष्मी स्टील', 'भांडी भांडार', '#2a8a8a', '#ffffff', MR],
  ['GANPATI ELECTRICALS', 'WIRING · FANS · LED', '#f2c230', '#1f3f9a', EN],
  ['HOTEL SAGAR', 'PURE VEG · FAMILY ROOM', '#2f6a3a', '#f2c230', EN],
  ['पान शॉप', 'PAAN · COLD DRINKS', '#1c1c1e', '#7fd07a', MR],
  ['BAKERY', 'KHARI · TOAST · NANKATAI', '#efe2c4', '#7a3a1e', EN],
  ['DESHPANDE CLASSES', 'MHT-CET · JEE · 11th–12th', '#2f5fd0', '#ffffff', EN],
  ['TAILOR', 'GENTS & LADIES · ALTERATION', '#f4efe2', '#7a2a30', EN],
  ['फुलवाला', 'हार · गजरा · बुके', '#f08a24', '#1f5a2a', MR],
  ['येथे गाडी लावू नये', 'लावल्यास हवा सोडण्यात येईल', '#ece4cf', '#a31f14', HAND],
  ['JOSHI PHOTO STUDIO', 'PASSPORT PHOTO IN 5 MIN', '#c8302a', '#ffffff', EN],
  ['BHARAT CYCLE MART', 'REPAIR · PUNCTURE', '#2f5fd0', '#ffffff', EN],
  ['अन्नपूर्णा खानावळ', 'घरगुती जेवण · थाळी ₹120', '#f2c230', '#7a2a30', MR],
  ['STATIONERY', 'वह्या · पेन · XEROX', '#2a8a8a', '#f4efe2', EN],
  ['जय भवानी ट्रेडर्स', 'धान्य · डाळी · मसाले', '#efe2c4', '#2f5fd0', MR],
  ['SHREE DATTA', 'CHAPPAL & SHOE MART', '#7a2a30', '#ffffff', EN],
  ['डॉ. गोखले', 'दवाखाना · सकाळी ९–१ · सायं ६–९', '#ffffff', '#1f3f9a', MR2],
  ['COLD DRINKS', 'लिंबू सरबत · कोकम', '#2f8a5a', '#f2c230', EN],
  ['ज्ञानदीप वाचनालय', 'वाचनालय · ग्रंथालय', '#283a6a', '#f4efe2', MR],
  ['GOLDEN TAILORS', 'SINCE 1972', '#1c1c1e', '#e8c060', EN],
  ['शिवम् इलेक्ट्रॉनिक्स', 'TV · FRIDGE · REPAIR', '#d83a2a', '#ffffff', MR],
  ['RAJ HAIR SALOON', 'A/C · कटिंग · दाढी', '#f4efe2', '#d83a2a', EN],
];
export const COLS = 4, ROWS = 8, CW = 512, CH = 128;

export function signAtlas() {
  const c = document.createElement('canvas'); c.width = CW * COLS; c.height = CH * ROWS;
  const x = c.getContext('2d'), R = rng(23);
  SIGNS.forEach(([main, sub, bg, fg, font], i) => {
    const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH;
    x.save(); x.beginPath(); x.rect(ox, oy, CW, CH); x.clip();
    x.fillStyle = bg; x.fillRect(ox, oy, CW, CH);
    x.strokeStyle = fg; x.globalAlpha = .55; x.lineWidth = 4; x.strokeRect(ox + 7, oy + 7, CW - 14, CH - 14); x.globalAlpha = 1;
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    const fit = (txt, f, size, maxW) => { x.font = f.includes('1em') ? f.replace('1em', size + 'px') : `${size}px ${f}`; const w = x.measureText(txt).width; if (w > maxW) { size *= maxW / w; x.font = f.includes('1em') ? f.replace('1em', size + 'px') : `${size}px ${f}`; } };
    fit(main, font, 64, CW - 44);
    x.save(); x.translate(ox + CW / 2, oy + 54); x.rotate((R() - .5) * .016); x.fillText(main, 0, 0); x.restore();
    fit(sub, font === EN ? "700 1em 'Archivo', sans-serif" : "600 1em 'Mukta', sans-serif", 22, CW - 60);
    x.fillText(sub, ox + CW / 2, oy + 101);
    // monsoon streaks, chipped paint
    for (let k = 0; k < 22; k++) { const sx = ox + R() * CW, L = R() * CH * .9, a = .04 + R() * .2, g = x.createLinearGradient(0, oy, 0, oy + L); g.addColorStop(0, `rgba(25,18,10,${a})`); g.addColorStop(1, 'rgba(25,18,10,0)'); x.fillStyle = g; x.fillRect(sx, oy, 1 + R() * 3, L); }
    for (let k = 0; k < 5; k++) { x.fillStyle = `rgba(235,225,205,${.08 + R() * .2})`; x.fillRect(ox + R() * CW, oy + R() * CH, 4 + R() * 22, 2 + R() * 6); }
    x.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// uv rectangle of sign i (canvas y runs down; texture v runs up)
export function signUV(i) {
  const cx = i % COLS, cy = Math.floor(i / COLS);
  return [cx / COLS, 1 - (cy + 1) / ROWS, (cx + 1) / COLS, 1 - cy / ROWS];
}
