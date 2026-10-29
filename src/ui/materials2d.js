// Surfaces for the jhola and the diary, painted once into canvases: hand block-printed cotton (indigo and madder
// on unbleached cloth, the weave showing through), cream notebook paper (ruled, a red margin, the odd tea ring),
// a teak desk with its grain, and kraft paper for tags. All slightly uneven, the way the real things are.
const C = new Map();
const rnd = (s) => { let x = s >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function noise(x, w, h, amt, seed, size = 1) {
  const r = rnd(seed), img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0); void size;
}
// cotton, block printed: a repeat of little buti motifs and a border of paisleys
export function cotton(w = 1024, h = 1024) {
  const k = 'cot' + w + 'x' + h; if (C.has(k)) return C.get(k);
  const [c, x] = canvas(w, h), r = rnd(7);
  x.fillStyle = '#e9dcc0'; x.fillRect(0, 0, w, h);
  // the weave
  for (let y = 0; y < h; y += 2) { x.fillStyle = `rgba(120,95,60,${0.035 + r() * 0.03})`; x.fillRect(0, y, w, 1); }
  for (let X = 0; X < w; X += 2) { x.fillStyle = `rgba(255,250,235,${0.03 + r() * 0.03})`; x.fillRect(X, 0, 1, h); }
  // block-printed buti: an indigo flower, a madder dot, each stamp a little off
  const S = 86;
  for (let j = 0; j < h / S + 1; j++) for (let i = 0; i < w / S + 1; i++) {
    const cx = i * S + (j % 2 ? S / 2 : 0) + (r() - 0.5) * 4, cy = j * S + (r() - 0.5) * 4, a = (r() - 0.5) * 0.12, ink = 0.75 + r() * 0.25;
    x.save(); x.translate(cx, cy); x.rotate(a); x.globalAlpha = ink;
    x.fillStyle = '#26406e';
    for (let p = 0; p < 6; p++) { x.save(); x.rotate(p * Math.PI / 3); x.beginPath(); x.ellipse(0, -11, 5, 10, 0, 0, 6.283); x.fill(); x.restore(); }
    x.fillStyle = '#9c2a22'; x.beginPath(); x.arc(0, 0, 5, 0, 6.283); x.fill();
    x.fillStyle = '#26406e'; for (const [dx, dy] of [[S / 2, 0], [0, S / 2]]) { x.beginPath(); x.arc(dx * 0.5, dy * 0.5, 2.4, 0, 6.283); x.fill(); }
    x.restore();
  }
  x.globalAlpha = 1;
  noise(x, w, h, 18, 3);
  C.set(k, c); return c;
}
// the inside of the bag: the same cloth, unprinted side out, in its own shadow
export function lining(w = 1024, h = 1024) {
  const k = 'lin' + w + 'x' + h; if (C.has(k)) return C.get(k);
  const [c, x] = canvas(w, h), r = rnd(11);
  x.fillStyle = '#8c7a5c'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { x.fillStyle = `rgba(40,30,18,${0.05 + r() * 0.05})`; x.fillRect(0, y, w, 1); }
  for (let X = 0; X < w; X += 2) { x.fillStyle = `rgba(255,240,210,${0.025 + r() * 0.03})`; x.fillRect(X, 0, 1, h); }
  // the print showing faintly through from the other side
  x.globalAlpha = 0.08; x.drawImage(cotton(512, 512), 0, 0, w, h); x.globalAlpha = 1;
  // creases
  for (let i = 0; i < 9; i++) { const y = r() * h, g = x.createLinearGradient(0, y - 30, 0, y + 30); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${0.08 + r() * 0.08})`); g.addColorStop(0.52, 'rgba(255,240,210,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.translate(w / 2, y); x.rotate((r() - 0.5) * 0.6); x.translate(-w / 2, -y); x.fillStyle = g; x.fillRect(-w, y - 30, w * 3, 60); x.restore(); }
  noise(x, w, h, 22, 5);
  C.set(k, c); return c;
}
// notebook paper: cream, faint blue rules, a red margin, foxing, a tea ring on some pages
export function paper(w = 900, h = 1200, seed = 1, ruled = true) {
  const k = 'pap' + w + 'x' + h + ':' + seed + ruled; if (C.has(k)) return C.get(k);
  const [c, x] = canvas(w, h), r = rnd(seed * 97 + 13);
  const g = x.createRadialGradient(w * 0.5, h * 0.45, h * 0.1, w * 0.5, h * 0.5, h * 0.8); g.addColorStop(0, '#f3ead3'); g.addColorStop(1, '#ddcfae');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  if (ruled) {
    x.strokeStyle = 'rgba(70,110,170,.28)'; x.lineWidth = 1.4;
    for (let y = h * 0.12; y < h - 30; y += 44) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y + (r() - 0.5) * 0.8); x.stroke(); }
    x.strokeStyle = 'rgba(190,50,50,.4)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w * 0.12, 0); x.lineTo(w * 0.12, h); x.stroke();
  }
  for (let i = 0; i < 26; i++) { const fx = r() * w, fy = r() * h, fr = 4 + r() * 18; const f = x.createRadialGradient(fx, fy, 0, fx, fy, fr); f.addColorStop(0, 'rgba(150,110,50,.12)'); f.addColorStop(1, 'rgba(150,110,50,0)'); x.fillStyle = f; x.fillRect(fx - fr, fy - fr, fr * 2, fr * 2); }
  if (r() < 0.35) { const tx = w * (0.55 + r() * 0.3), ty = h * (0.6 + r() * 0.3), tr = 60 + r() * 30; x.strokeStyle = 'rgba(140,90,40,.22)'; x.lineWidth = 6; x.beginPath(); x.arc(tx, ty, tr, 0.3, 5.9); x.stroke(); x.lineWidth = 2; x.beginPath(); x.arc(tx + 2, ty + 1, tr - 5, 0, 6.283); x.stroke(); }
  noise(x, w, h, 10, seed);
  C.set(k, c); return c;
}
// the desk: teak, the grain running across, a little worn where the hands go
export function teak(w = 1600, h = 1000) {
  const k = 'teak' + w + 'x' + h; if (C.has(k)) return C.get(k);
  const [c, x] = canvas(w, h), r = rnd(23);
  x.fillStyle = '#4a2a16'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { const v = Math.sin(y * 0.021) * 0.5 + Math.sin(y * 0.0057 + 2) * 0.5; x.fillStyle = `rgba(${v > 0 ? '120,70,35' : '25,12,6'},${0.12 + Math.abs(v) * 0.18})`; x.fillRect(0, y, w, 2 + r() * 2); }
  for (let i = 0; i < 40; i++) { const y = r() * h, wl = 200 + r() * 600, x0 = r() * w; x.strokeStyle = `rgba(20,10,4,${0.15 + r() * 0.2})`; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(x0, y); for (let t = 0; t <= wl; t += 20) x.lineTo(x0 + t, y + Math.sin(t * 0.02 + i) * 6); x.stroke(); }
  const g = x.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.9); g.addColorStop(0, 'rgba(255,190,110,.18)'); g.addColorStop(1, 'rgba(0,0,0,.6)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  noise(x, w, h, 14, 9);
  C.set(k, c); return c;
}
export function kraft(w = 320, h = 200) {
  const k = 'kraft' + w + 'x' + h; if (C.has(k)) return C.get(k);
  const [c, x] = canvas(w, h), r = rnd(31);
  x.fillStyle = '#c4a073'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,60,30' : '230,200,150'},.12)`; x.fillRect(r() * w, r() * h, 1 + r() * 8, 1); }
  noise(x, w, h, 16, 4);
  C.set(k, c); return c;
}
export const url = (c) => { if (!c._url) c._url = c.toDataURL('image/jpeg', 0.86); return c._url; };
