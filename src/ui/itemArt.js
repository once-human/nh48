// Painted pictures of the things in your jhola: each one lit from the top left, shaded, with its highlight and a
// soft shadow under it, the way a product shot looks (not a flat icon). Drawn once at the size asked, cached.
const CACHE = new Map();
const R = (x, a, b, c, d, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + c, b, a + c, b + d, r); x.arcTo(a + c, b + d, a, b + d, r); x.arcTo(a, b + d, a, b, r); x.arcTo(a, b, a + c, b, r); x.closePath(); };
const lin = (x, x0, y0, x1, y1, stops) => { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rad = (x, cx, cy, r0, r1, stops) => { const g = x.createRadialGradient(cx, cy, r0, cx, cy, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const shadow = (x, cx, cy, rx, ry) => { x.save(); x.fillStyle = rad(x, cx, cy, 0, rx, [[0, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,0)']]); x.scale(1, ry / rx); x.beginPath(); x.arc(cx, cy * rx / ry, rx, 0, 6.283); x.fill(); x.restore(); };
const gloss = (x, a, b, c, d) => { x.save(); x.globalAlpha = 0.35; x.fillStyle = lin(x, a, b, a + c, b, [[0, 'rgba(255,255,255,0)'], [0.25, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,0)']]); x.fillRect(a, b, c, d); x.restore(); };
const text = (x, s, cx, cy, size, col, w = 800, font = 'Inter, sans-serif') => { x.fillStyle = col; x.font = `${w} ${size}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(s, cx, cy); };

const ART = {
  water: (x) => { shadow(x, 80, 146, 30, 7); x.fillStyle = lin(x, 56, 0, 104, 0, [[0, '#7fb6d8'], [0.45, '#d8f0ff'], [1, '#5e98bf']]); R(x, 56, 40, 48, 104, 14); x.fill();
    x.fillStyle = '#1e5fa8'; R(x, 66, 18, 28, 16, 4); x.fill(); x.fillStyle = '#2a76c9'; R(x, 64, 30, 32, 10, 3); x.fill();
    x.fillStyle = lin(x, 56, 0, 104, 0, [[0, '#0d6fb8'], [1, '#1a8ad8']]); x.fillRect(56, 78, 48, 30); text(x, 'BISLERI', 80, 93, 10, '#fff'); gloss(x, 56, 40, 48, 104); },
  tiffin: (x) => { shadow(x, 80, 146, 42, 8); for (let k = 0; k < 3; k++) { const y = 92 - k * 30; x.fillStyle = lin(x, 40, 0, 120, 0, [[0, '#8e959c'], [0.35, '#f1f4f6'], [0.6, '#b9c0c6'], [1, '#6d747b']]); R(x, 40, y, 80, 30, 6); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.stroke(); }
    x.strokeStyle = '#7d848b'; x.lineWidth = 5; x.beginPath(); x.moveTo(52, 34); x.quadraticCurveTo(80, 4, 108, 34); x.stroke(); x.fillStyle = '#c9ced3'; R(x, 74, 22, 12, 100, 4); x.fill(); },
  vadapav: (x) => { shadow(x, 80, 140, 46, 9); x.fillStyle = rad(x, 70, 62, 6, 52, [[0, '#f6d29a'], [0.7, '#d79a4a'], [1, '#9c6326']]); x.beginPath(); x.ellipse(80, 72, 50, 30, 0, Math.PI, 0); x.fill();
    x.fillStyle = rad(x, 76, 92, 4, 40, [[0, '#e8b85a'], [0.6, '#c27d22'], [1, '#7d4a12']]); x.beginPath(); x.ellipse(80, 92, 46, 16, 0, 0, 6.283); x.fill();
    x.fillStyle = '#2f7d32'; for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(52 + k * 26, 84, 9, 4, 0.5, 0, 6.283); x.fill(); }
    x.fillStyle = rad(x, 76, 112, 4, 50, [[0, '#f4cf8c'], [1, '#b47432']]); x.beginPath(); x.ellipse(80, 110, 50, 20, 0, 0, Math.PI); x.fill();
    x.fillStyle = '#4a8c2a'; x.beginPath(); x.ellipse(122, 120, 6, 18, 0.9, 0, 6.283); x.fill(); x.fillStyle = 'rgba(255,255,255,.4)'; for (let k = 0; k < 6; k++) x.fillRect(48 + k * 13, 56 + (k % 2) * 4, 3, 2); },
  biscuit: (x) => { shadow(x, 80, 146, 50, 8); x.save(); x.translate(80, 84); x.rotate(-0.18); x.fillStyle = lin(x, -46, 0, 46, 0, [[0, '#d8a821'], [0.5, '#ffe36a'], [1, '#c79312']]); R(x, -46, -54, 92, 108, 8); x.fill();
    x.fillStyle = '#c0281f'; x.fillRect(-46, -54, 92, 20); text(x, 'Parle-G', 0, -44, 15, '#fff'); x.fillStyle = '#f2c94c'; x.beginPath(); x.arc(0, 8, 24, 0, 6.283); x.fill(); x.fillStyle = '#fcd9b6'; x.beginPath(); x.arc(0, 4, 13, 0, 6.283); x.fill();
    text(x, 'G', 0, 40, 18, '#c0281f'); x.restore(); gloss(x, 34, 30, 92, 110); },
  banana: (x) => { shadow(x, 82, 142, 46, 8); for (let k = 0; k < 3; k++) { x.save(); x.translate(80, 80 + k * 6); x.rotate(-0.4 + k * 0.28); x.fillStyle = lin(x, -10, -40, 14, 40, [[0, '#f9e15a'], [0.6, '#e8c228'], [1, '#a98a12']]); x.beginPath(); x.moveTo(-4, -50); x.quadraticCurveTo(34, -4, 2, 48); x.quadraticCurveTo(14, -2, -12, -48); x.closePath(); x.fill(); x.fillStyle = '#5b4a1a'; x.fillRect(-7, -54, 5, 7); x.restore(); } },
  chikki: (x) => { shadow(x, 80, 140, 48, 8); x.fillStyle = rad(x, 70, 70, 6, 70, [[0, '#e8a64a'], [1, '#8a4b14']]); R(x, 34, 50, 92, 70, 6); x.fill();
    for (let k = 0; k < 40; k++) { const px = 40 + (k * 37) % 80, py = 56 + (k * 53) % 58; x.fillStyle = k % 3 ? '#f3d8a8' : '#c88a46'; x.beginPath(); x.ellipse(px, py, 5, 3.4, k, 0, 6.283); x.fill(); } gloss(x, 34, 50, 92, 70); },
  medkit: (x) => { shadow(x, 80, 146, 50, 8); x.fillStyle = lin(x, 0, 40, 0, 130, [[0, '#ffffff'], [1, '#c9ced4']]); R(x, 30, 48, 100, 84, 12); x.fill(); x.fillStyle = '#7a8088'; R(x, 64, 34, 32, 18, 6); x.fill(); x.fillStyle = lin(x, 0, 40, 0, 130, [[0, '#ffffff'], [1, '#c9ced4']]); R(x, 70, 40, 20, 10, 3); x.fill();
    x.fillStyle = '#d62828'; x.fillRect(72, 70, 16, 46); x.fillRect(57, 85, 46, 16); gloss(x, 30, 48, 100, 84); },
  painkiller: (x) => { shadow(x, 80, 140, 50, 8); x.save(); x.translate(80, 86); x.rotate(-0.2); x.fillStyle = lin(x, -50, 0, 50, 0, [[0, '#aab2ba'], [0.5, '#f4f6f8'], [1, '#9aa3ab']]); R(x, -50, -32, 100, 64, 6); x.fill();
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { x.fillStyle = rad(x, -38 + i * 19, -12 + j * 26, 1, 9, [[0, '#ffffff'], [1, '#d3d8de']]); x.beginPath(); x.arc(-38 + i * 19, -12 + j * 26, 8, 0, 6.283); x.fill(); x.strokeStyle = 'rgba(0,0,0,.18)'; x.stroke(); } x.restore(); },
  ors: (x) => { shadow(x, 80, 146, 40, 8); x.fillStyle = lin(x, 46, 0, 114, 0, [[0, '#e86f1c'], [0.5, '#ffa34a'], [1, '#d35e12']]); x.beginPath(); x.moveTo(46, 30); x.lineTo(114, 30); x.lineTo(110, 140); x.lineTo(50, 140); x.closePath(); x.fill();
    x.fillStyle = '#fff'; R(x, 54, 70, 52, 34, 4); x.fill(); text(x, 'ORS', 80, 87, 18, '#d35e12'); x.fillStyle = 'rgba(0,0,0,.2)'; for (let k = 0; k < 9; k++) x.fillRect(48 + k * 7, 30, 3, 6); gloss(x, 46, 30, 68, 110); },
  energy: (x) => { shadow(x, 80, 146, 30, 7); x.fillStyle = lin(x, 52, 0, 108, 0, [[0, '#1b2a5a'], [0.4, '#4a64c8'], [0.6, '#2e44a0'], [1, '#141d40']]); R(x, 52, 30, 56, 114, 10); x.fill();
    x.fillStyle = lin(x, 52, 0, 108, 0, [[0, '#8a9099'], [0.5, '#e8ecf0'], [1, '#7a8089']]); R(x, 54, 24, 52, 10, 4); x.fill(); x.fillStyle = '#f2c230'; x.beginPath(); x.moveTo(86, 50); x.lineTo(66, 92); x.lineTo(80, 92); x.lineTo(72, 124); x.lineTo(96, 80); x.lineTo(82, 80); x.closePath(); x.fill(); gloss(x, 52, 30, 56, 114); },
  coldcoffee: (x) => { shadow(x, 80, 146, 32, 7); x.fillStyle = lin(x, 50, 0, 110, 0, [[0, 'rgba(210,220,230,.55)'], [0.5, 'rgba(255,255,255,.75)'], [1, 'rgba(190,200,210,.5)']]); x.beginPath(); x.moveTo(48, 40); x.lineTo(112, 40); x.lineTo(104, 144); x.lineTo(56, 144); x.closePath(); x.fill();
    x.fillStyle = lin(x, 0, 60, 0, 140, [[0, '#d7b48c'], [1, '#8a5a36']]); x.beginPath(); x.moveTo(52, 62); x.lineTo(108, 62); x.lineTo(103, 140); x.lineTo(57, 140); x.closePath(); x.fill();
    x.fillStyle = '#f4f0e8'; x.beginPath(); x.ellipse(80, 40, 34, 9, 0, 0, 6.283); x.fill(); x.fillStyle = '#2e9e5b'; x.save(); x.translate(92, 30); x.rotate(0.3); x.fillRect(-3, -28, 6, 40); x.restore(); },
  bakarwadi: (x) => { shadow(x, 80, 142, 48, 9); for (let k = 0; k < 5; k++) { const cx = 46 + (k % 3) * 34, cy = 74 + Math.floor(k / 3) * 34; x.fillStyle = rad(x, cx - 4, cy - 4, 2, 18, [[0, '#f0c27a'], [1, '#a5641f']]); x.beginPath(); x.arc(cx, cy, 16, 0, 6.283); x.fill();
    x.strokeStyle = '#7a4314'; x.lineWidth = 2.2; x.beginPath(); for (let a = 0; a < 12; a += 0.4) x.lineTo(cx + Math.cos(a) * a * 1.15, cy + Math.sin(a) * a * 1.15); x.stroke(); } },
  barfi: (x) => { shadow(x, 80, 144, 50, 8); x.fillStyle = lin(x, 0, 60, 0, 136, [[0, '#d03a4a'], [1, '#8a1626']]); R(x, 28, 62, 104, 74, 6); x.fill(); x.fillStyle = '#f6d36b'; x.fillRect(28, 62, 104, 8);
    for (let k = 0; k < 6; k++) { const cx = 46 + (k % 3) * 34, cy = 88 + Math.floor(k / 3) * 28; x.fillStyle = lin(x, 0, cy - 12, 0, cy + 12, [[0, '#fff6e2'], [1, '#e6cf9e']]); x.beginPath(); x.moveTo(cx, cy - 12); x.lineTo(cx + 14, cy); x.lineTo(cx, cy + 12); x.lineTo(cx - 14, cy); x.closePath(); x.fill(); x.fillStyle = '#d8d8d8'; x.fillRect(cx - 6, cy - 2, 12, 2); } },
  shrewsbury: (x) => { shadow(x, 80, 146, 48, 8); x.fillStyle = lin(x, 0, 40, 0, 140, [[0, '#1d3a6b'], [1, '#0f2142']]); x.beginPath(); x.ellipse(80, 118, 50, 16, 0, 0, 6.283); x.fill(); x.fillRect(30, 60, 100, 58);
    x.fillStyle = lin(x, 30, 0, 130, 0, [[0, '#28497f'], [0.5, '#4d74b8'], [1, '#1d3a6b']]); x.beginPath(); x.ellipse(80, 60, 50, 16, 0, 0, 6.283); x.fill(); text(x, 'Kayani', 80, 92, 15, '#f2d27a', 700, 'Georgia, serif');
    x.fillStyle = rad(x, 74, 46, 2, 22, [[0, '#f5d79a'], [1, '#c7934a']]); x.beginPath(); x.ellipse(80, 50, 22, 8, 0, 0, 6.283); x.fill(); },
  gajra: (x) => { shadow(x, 80, 140, 46, 8); for (let k = 0; k < 22; k++) { const a = k / 22 * 6.283, cx = 80 + Math.cos(a) * 40, cy = 84 + Math.sin(a) * 26; x.fillStyle = rad(x, cx - 2, cy - 2, 1, 9, [[0, '#ffffff'], [1, '#e4e8d8']]); x.beginPath(); x.arc(cx, cy, 8, 0, 6.283); x.fill(); x.fillStyle = '#7fae3a'; x.fillRect(cx - 1, cy + 6, 2, 3); } },
  book: (x) => { shadow(x, 82, 146, 48, 8); x.fillStyle = '#efe6d0'; x.fillRect(42, 40, 82, 104); x.fillStyle = lin(x, 36, 0, 120, 0, [[0, '#6b1d24'], [1, '#9a2c36']]); R(x, 36, 34, 82, 106, 4); x.fill(); x.fillStyle = '#4a1218'; x.fillRect(36, 34, 10, 106);
    x.strokeStyle = '#d9b24a'; x.lineWidth = 2; x.strokeRect(54, 48, 54, 78); text(x, 'पुणे', 81, 78, 22, '#d9b24a', 800, 'Mukta, sans-serif'); text(x, 'GUIDE', 81, 104, 11, '#d9b24a'); gloss(x, 36, 34, 82, 106); },
  lottery: (x) => { shadow(x, 80, 140, 52, 8); x.save(); x.translate(80, 86); x.rotate(-0.12); x.fillStyle = lin(x, -56, 0, 56, 0, [[0, '#ffe4f1'], [0.5, '#fff7d6'], [1, '#d8f0ff']]); R(x, -56, -36, 112, 72, 4); x.fill();
    x.setLineDash([3, 3]); x.strokeStyle = '#c24d8a'; x.strokeRect(-50, -30, 100, 60); x.setLineDash([]); text(x, 'महाराष्ट्र लॉटरी', 0, -14, 12, '#7a1f5a', 800, 'Mukta, sans-serif'); text(x, '₹ 1,00,000', 0, 6, 15, '#c24d8a'); text(x, 'No. 46 1918', 0, 24, 10, '#333', 600, 'monospace'); x.restore(); },
  torch: (x) => { shadow(x, 84, 140, 52, 8); x.save(); x.translate(80, 86); x.rotate(-0.5); x.fillStyle = lin(x, 0, -14, 0, 14, [[0, '#3a3d42'], [0.4, '#8f959c'], [1, '#22252a']]); R(x, -56, -12, 82, 24, 6); x.fill();
    x.fillStyle = lin(x, 0, -20, 0, 20, [[0, '#4b4f55'], [0.4, '#a9afb6'], [1, '#2a2d32']]); R(x, 24, -20, 32, 40, 6); x.fill(); x.fillStyle = rad(x, 58, 0, 2, 22, [[0, '#ffffff'], [0.5, '#ffe9a8'], [1, 'rgba(255,233,168,0)']]); x.beginPath(); x.arc(58, 0, 22, 0, 6.283); x.fill();
    x.fillStyle = '#c0281f'; R(x, -20, -15, 12, 6, 2); x.fill(); x.restore(); },
  beer: (x) => { shadow(x, 80, 148, 26, 7); x.fillStyle = lin(x, 60, 0, 100, 0, [[0, '#3a1e06'], [0.4, '#8a4a10'], [0.6, '#5e300a'], [1, '#2a1404']]); x.beginPath(); x.moveTo(72, 20); x.lineTo(88, 20); x.lineTo(88, 52); x.quadraticCurveTo(102, 62, 102, 82); x.lineTo(102, 142); x.lineTo(58, 142); x.lineTo(58, 82); x.quadraticCurveTo(58, 62, 72, 52); x.closePath(); x.fill();
    x.fillStyle = '#d6b043'; R(x, 70, 14, 20, 10, 3); x.fill(); x.fillStyle = lin(x, 0, 92, 0, 128, [[0, '#f3e6c4'], [1, '#d8c79c']]); x.fillRect(58, 92, 44, 36); text(x, 'KF', 80, 110, 16, '#c0281f'); gloss(x, 58, 20, 44, 122); },
};
export function itemArt(id, size = 160) {
  const k = id + '@' + size; if (CACHE.has(k)) return CACHE.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  x.scale(size / 160, size / 160);
  (ART[id] || ART.tiffin)(x);
  const url = c.toDataURL('image/png'); CACHE.set(k, url); return url;
}
export const hasArt = (id) => !!ART[id];
