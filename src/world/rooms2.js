// Detailed rooms, modelled from photos of the real kind of place in Pune: a single-screen cinema (the lobby with
// its ticket window, popcorn and posters; the hall with its curtained screen, rising rows of red seats and the
// projector's beam), a wada-style temple (carved teak pillars and brackets, marigold torans, hanging brass lamps
// and bells, a stone sanctum with the deity in lamplight), a bowling and games hall (lanes, pins, ball returns,
// scoreboards; arcade cabinets, racing seats, air hockey, a claw machine, the prize counter), an abhyasika (rows of
// partitioned desks, lockers, the silence sign, a wall of books) and an istri and laundry shop (the long padded
// ironing table, irons, front-loaders, bundles tied in cloth, the rate card). Built with the interiors' toolkit
// (K): boxes, plus cylinders, spheres and cones, and painted panels (posters, screens, boards, floors).
import * as THREE from 'three';

const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14), CYL6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6), SPH = new THREE.SphereGeometry(0.5, 12, 8);
const CONE = new THREE.ConeGeometry(0.5, 1, 14), HALF = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1, false, 0, Math.PI), TOR = new THREE.TorusGeometry(0.5, 0.06, 8, 20);
const hexc = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

// the toolkit's shapes, placed in the room's frame (x across, y up from the floor, z in from the door)
function shapes(K) {
  const { O, FLOOR } = K;
  const put = (b, geo, x, y, z, sx, sy, sz, col, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(O.x + x, y + FLOOR, O.z + z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    b.addGeo(geo, m, hexc(col));
  };
  return {
    cyl: (b, x, y, z, r, h, col, rx, ry, rz) => put(b, CYL, x, y, z, r * 2, h, r * 2, col, rx, ry, rz),
    oct: (b, x, y, z, r, h, col) => put(b, CYL6, x, y, z, r * 2, h, r * 2, col),
    sph: (b, x, y, z, r, col, sy = 1) => put(b, SPH, x, y, z, r * 2, r * 2 * sy, r * 2, col),
    cone: (b, x, y, z, r, h, col, rx = 0) => put(b, CONE, x, y, z, r * 2, h, r * 2, col, rx),
    half: (b, x, y, z, r, h, col, ry = 0) => put(b, HALF, x, y, z, r * 2, h, r * 2, col, 0, ry),
    ring: (b, x, y, z, r, col, rx = Math.PI / 2, ry = 0) => put(b, TOR, x, y, z, r * 2, r * 2, r * 2, col, rx, ry),
  };
}
// a painted panel (a poster, a screen, a floor, a board): draw(ctx, w, h) on a canvas; glow = it lights itself
function panel(K, x, y, z, w, h, ry, draw, opts = {}) {
  const px = opts.px || 256, cw = Math.max(16, Math.round(w / Math.max(w, h) * px)), ch = Math.max(16, Math.round(h / Math.max(w, h) * px));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  draw(cv.getContext('2d'), cw, ch);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  const mat = opts.glow ? new THREE.MeshBasicMaterial({ map: t, toneMapped: false }) : new THREE.MeshLambertMaterial({ map: t });
  if (opts.alpha) { mat.transparent = true; mat.depthWrite = false; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(K.O.x + x, y + K.FLOOR, K.O.z + z); m.rotation.set(opts.rx || 0, ry, 0);
  K.R.dyn.push(m); return m;
}
const floorPanel = (K, x, z, w, d, draw, rep) => panel(K, x, 0.004, z, w, d, 0, draw, { rx: -Math.PI / 2, repeat: rep, px: 512 });
const rnd = (s) => { let x = s >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
const noise = (g, w, h, a, seed) => { const r = rnd(seed), d = g.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const n = (r() - 0.5) * a; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } g.putImageData(d, 0, 0); };
const font = (px, w = 700, dev) => `${w} ${px}px ${dev ? 'Mukta, "Noto Sans Devanagari", ' : ''}Archivo, Inter, system-ui, sans-serif`;

// ---------------------------------------------------------------- painted things
const PAINT = {
  marble(g, w, h) { g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, w, h); const r = rnd(4); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(120,110,95,${0.05 + r() * 0.08})`; g.lineWidth = 0.5 + r() * 1.5; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.4) * 40; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } noise(g, w, h, 10, 1); },
  stone(g, w, h) { g.fillStyle = '#7d7468'; g.fillRect(0, 0, w, h); const r = rnd(9); for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? -40 : 0; x < w; x += 110) { g.fillStyle = `hsl(32,${8 + r() * 6}%,${36 + r() * 10}%)`; g.fillRect(x + 2, y + 2, 106, 60); } noise(g, w, h, 22, 2); },
  carpet(g, w, h, a = '#4a0d18', b = '#7a1e2e') { g.fillStyle = a; g.fillRect(0, 0, w, h); g.strokeStyle = b; g.lineWidth = 3; for (let y = 16; y < h; y += 32) for (let x = 16; x < w; x += 32) { g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y); g.lineTo(x, y + 9); g.lineTo(x - 9, y); g.closePath(); g.stroke(); } noise(g, w, h, 12, 3); },
  cosmic(g, w, h) { g.fillStyle = '#0d0b1e'; g.fillRect(0, 0, w, h); const r = rnd(7), C = ['#2fd3ff', '#ff2f7d', '#ffd166', '#7dff6b', '#b26bff']; for (let i = 0; i < 90; i++) { g.strokeStyle = C[i % 5]; g.lineWidth = 2; const x = r() * w, y = r() * h, s = 6 + r() * 14; if (i % 3 === 0) { g.beginPath(); g.arc(x, y, s, 0, 6.28); g.stroke(); } else if (i % 3 === 1) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s * 0.4); g.lineTo(x, y + s); g.stroke(); } else g.strokeRect(x, y, s, s * 0.6); } },
  lane(g, w, h) { for (let i = 0; i < 39; i++) { g.fillStyle = `hsl(${30 + (i % 3)},${45 + (i % 5)}%,${58 + (i * 7) % 9}%)`; g.fillRect(i * w / 39, 0, w / 39 + 1, h); } g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1a0e'; for (let k = 0; k < 7; k++) { const x = (k + 1) * w / 8, y = h * 0.78 + Math.abs(k - 3) * h * 0.025; g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x - 5, y + 6); g.lineTo(x + 5, y + 6); g.closePath(); g.fill(); g.beginPath(); g.arc(x, h * 0.93, 2.5, 0, 6.28); g.fill(); } g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, h * 0.97, w, h * 0.03); },
  rangoli(g, w, h) { g.clearRect(0, 0, w, h); const cx = w / 2, cy = h / 2, C = ['#e63946', '#f4a261', '#2a9d8f', '#ffd166', '#ffffff', '#8338ec'];
    for (let r = 6; r > 0; r--) { g.fillStyle = C[r % C.length]; g.beginPath(); for (let k = 0; k <= 16; k++) { const a = k / 16 * 6.283, rr = (r / 6) * w * 0.48 * (k % 2 ? 0.86 : 1); k ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + rr, cy); } g.fill(); }
    g.fillStyle = '#fff'; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; g.beginPath(); g.arc(cx + Math.cos(a) * w * 0.3, cy + Math.sin(a) * w * 0.3, w * 0.03, 0, 6.28); g.fill(); } },
  books(g, w, h) { const r = rnd(5), C = ['#7a1e1e', '#1e3a7a', '#2e5a3a', '#c9a227', '#3a2416', '#5a2e6b', '#d8cfb8', '#1b1c1f'];
    for (let row = 0; row < 6; row++) { const y0 = row * h / 6; g.fillStyle = '#5a3a22'; g.fillRect(0, y0 + h / 6 - 6, w, 6); let x = 0; while (x < w) { const bw = 6 + r() * 12, bh = h / 6 - 10 - r() * 14; g.fillStyle = C[(r() * 8) | 0]; g.fillRect(x, y0 + h / 6 - 6 - bh, bw - 1, bh); g.fillStyle = 'rgba(255,230,160,.5)'; g.fillRect(x + 1, y0 + h / 6 - 6 - bh + 6, bw - 3, 2); x += bw; } } },
  notice(g, w, h) { g.fillStyle = '#8a5a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9a36b'; g.fillRect(6, 6, w - 12, h - 12); const r = rnd(11);
    for (let i = 0; i < 9; i++) { const x = 12 + r() * (w - 70), y = 12 + r() * (h - 70), pw = 40 + r() * 30, ph = 46 + r() * 20; g.fillStyle = ['#fffbe8', '#ffd6e0', '#d6f0ff', '#fff3b0'][i % 4]; g.fillRect(x, y, pw, ph); g.fillStyle = 'rgba(0,0,0,.35)'; for (let l = 0; l < 5; l++) g.fillRect(x + 5, y + 8 + l * 7, pw - 10 - r() * 10, 2); g.fillStyle = '#d1495b'; g.beginPath(); g.arc(x + pw / 2, y + 3, 2.5, 0, 6.28); g.fill(); } },
  curtain(g, w, h, c = [140, 18, 30]) { for (let x = 0; x < w; x++) { const f = 0.55 + 0.45 * Math.sin(x / w * Math.PI * 14) ** 2; g.fillStyle = `rgb(${c[0] * f | 0},${c[1] * f | 0},${c[2] * f | 0})`; g.fillRect(x, 0, 1, h); } g.fillStyle = '#d4a017'; g.fillRect(0, h - 10, w, 6); },
};
// a film poster, made up (title, a figure against a sunset or a city at night, the credits block)
function poster(g, w, h, i) {
  const T = [['PUNE EXPRESS', '#ff6b35', '#1a1a2e'], ['वारी', '#f7b801', '#3d1308'], ['MIDNIGHT MASTANI', '#e63946', '#0b0c10'], ['BHAU IS BACK', '#ffd166', '#2b2d42'], ['सांज', '#f28482', '#2f1b25'], ['MONSOON MAIL', '#4cc9f0', '#03045e']][i % 6];
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, T[1]); gr.addColorStop(1, T[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.moveTo(0, h * 0.72); for (let x = 0; x <= w; x += w / 10) g.lineTo(x, h * (0.6 + 0.08 * Math.sin(x * 0.05 + i))); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = 'rgba(0,0,0,.8)'; const cx = w * (0.4 + (i % 3) * 0.1); g.beginPath(); g.arc(cx, h * 0.38, w * 0.08, 0, 6.28); g.fill(); g.fillRect(cx - w * 0.11, h * 0.45, w * 0.22, h * 0.3);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(Math.round(w * 0.12), 900, /[ऀ-ॿ]/.test(T[0])); g.fillText(T[0], w / 2, h * 0.86);
  g.fillStyle = 'rgba(255,255,255,.6)'; for (let l = 0; l < 3; l++) g.fillRect(w * 0.15, h * 0.9 + l * 5, w * 0.7, 2);
  g.strokeStyle = '#d4a017'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
}
function board(g, w, h, title, lines, opts = {}) {
  g.fillStyle = opts.bg || '#1b1c1f'; g.fillRect(0, 0, w, h); g.strokeStyle = opts.edge || '#d4a017'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = opts.fg || '#ffd166'; g.textAlign = 'center'; g.font = font(Math.round(h * 0.13), 800, true); g.fillText(title, w / 2, h * 0.2);
  g.textAlign = 'left'; g.font = font(Math.round(h * 0.075), 600, true); g.fillStyle = opts.fg2 || '#f4f1ea';
  lines.forEach((l, i) => { const y = h * 0.36 + i * h * 0.105; if (Array.isArray(l)) { g.fillText(l[0], w * 0.08, y); g.textAlign = 'right'; g.fillText(l[1], w * 0.92, y); g.textAlign = 'left'; } else g.fillText(l, w * 0.08, y); });
}
function filmFrame(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#2b1d4e'); sky.addColorStop(0.45, '#e76f51'); sky.addColorStop(0.7, '#f4a261'); sky.addColorStop(1, '#2a1a12'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,230,160,.9)'; g.beginPath(); g.arc(w * 0.62, h * 0.58, h * 0.09, 0, 6.28); g.fill();
  g.fillStyle = '#1a1020'; g.beginPath(); g.moveTo(0, h * 0.7); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * (0.62 + 0.05 * Math.sin(x * 0.03) + 0.03 * Math.sin(x * 0.11))); g.lineTo(w, h); g.lineTo(0, h); g.fill();
  g.fillStyle = '#0d0810'; for (let k = 0; k < 18; k++) { const x = k * w / 18, bh = h * (0.05 + ((k * 37) % 11) / 60); g.fillRect(x, h * 0.72 - bh, w / 20, bh + h * 0.3); }
  g.fillStyle = '#000'; g.fillRect(w * 0.3, h * 0.62, w * 0.012, h * 0.2); g.beginPath(); g.arc(w * 0.306, h * 0.6, w * 0.012, 0, 6.28); g.fill();     // someone on the ridge
  g.fillStyle = 'rgba(0,0,0,.85)'; g.fillRect(0, 0, w, h * 0.06); g.fillRect(0, h * 0.94, w, h * 0.06);
}

// ---------------------------------------------------------------- the rooms
export const ROOMS2 = {

  // Pune Junction's booking hall: the windows down the left (reservation, unreserved, tatkal, enquiry), the
  // departures board on the right (every train coming soon: the railway isn't in the game yet), benches, pillars,
  // fans, a chai stall, and the arches through to the platforms with a coach waiting
  station(K) {
    const { B, GL, box, solid, spot, kp, W, D, H, R } = K, S2 = shapes(K);
    floorPanel(K, 0, D / 2, W, D, PAINT.stone, [W / 4, D / 4]);
    const wall = (g, w, h) => { g.fillStyle = '#eadfc4'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8a37a'; g.fillRect(0, h * 0.84, w, h * 0.16); g.fillStyle = '#f6efdd';
      for (let k = 0; k < 6; k++) { const x = (k + 0.5) * w / 6, aw = w / 6 * 0.32, top = h * 0.12; g.fillStyle = '#d9c9a4'; g.beginPath(); g.moveTo(x - aw, h * 0.55); g.lineTo(x - aw, top + aw); g.arc(x, top + aw, aw, Math.PI, 0); g.lineTo(x + aw, h * 0.55); g.closePath(); g.fill(); g.fillStyle = '#9fc3d8'; g.fillRect(x - aw * 0.75, top + aw * 0.5, aw * 1.5, h * 0.3); }
      noise(g, w, h, 10, 5); };
    for (const sd of [-1, 1]) panel(K, sd * (W / 2 - 0.05), H / 2, D / 2, D, H, -sd * Math.PI / 2, wall, { px: 1024 });
    panel(K, 0, H / 2, 0.11, W, H, 0, wall, { px: 1024 });
    box(B, 0, H - 0.01, D / 2, W, 0.02, D, 0xe8dcc0);
    // the back wall: two arches through to platform 1, a blue coach standing at it
    const arch = (g, w, h) => { const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#e8d9b0'); sky.addColorStop(1, '#a89878'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1f4f8f'; g.fillRect(0, h * 0.42, w, h * 0.42); g.fillStyle = '#e8dcc0'; g.fillRect(0, h * 0.5, w, h * 0.05); for (let x = 12; x < w - 30; x += 46) { g.fillStyle = '#0d1a2a'; g.fillRect(x, h * 0.58, 30, h * 0.12); g.fillStyle = '#9aa3ad'; g.fillRect(x, h * 0.58, 30, 3); }
      g.fillStyle = '#5c5a55'; g.fillRect(0, h * 0.84, w, h * 0.16); g.fillStyle = '#e8c547'; g.fillRect(0, h * 0.84, w, 5); };
    box(B, 0, H / 2, D - 0.15, W, H, 0.3, 0xeadfc4);
    for (const sd of [-1, 1]) { panel(K, sd * W / 4, 3.2, D - 0.32, 7, 6.4, Math.PI, arch, { px: 512 }); box(B, sd * W / 4, 6.55, D - 0.36, 7.6, 0.3, 0.12, 0xd9c9a4); for (const e of [-1, 1]) box(B, sd * W / 4 + e * 3.65, 3.2, D - 0.36, 0.3, 6.4, 0.12, 0xd9c9a4);
      panel(K, sd * W / 4, 7.6, D - 0.33, 4.4, 0.8, Math.PI, (g, w, h) => { g.fillStyle = '#f3c614'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.textAlign = 'center'; g.font = font(h * 0.42, 800, true); g.fillText(sd < 0 ? 'फलाट १  ·  PLATFORM 1  →' : '←  PLATFORMS 2 – 6  ·  पूल', w / 2, h * 0.65); }); }
    panel(K, 0, H - 1.4, D - 0.33, 9, 1.4, Math.PI, (g, w, h) => { g.fillStyle = '#f3c614'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#111'; g.textAlign = 'center'; g.font = font(h * 0.34, 800, true); g.fillText('पुणे जंक्शन', w / 2, h * 0.44); g.font = font(h * 0.26, 900); g.fillText('PUNE JN.', w / 2, h * 0.8); }, { px: 768 });
    // the booking windows down the left wall: a counter, glass with a grille, a clerk behind each, the queue rails
    const WIN = [['आरक्षण', 'RESERVATION'], ['आरक्षण', 'RESERVATION'], ['तत्काल', 'TATKAL'], ['चालू तिकीट', 'UNRESERVED'], ['चौकशी', 'ENQUIRY']];
    WIN.forEach(([mr, en], i) => {
      const z = 3.2 + i * 3.4, x = -W / 2 + 0.9;
      box(B, x, 0.55, z, 0.8, 1.1, 2.6, 0x6b4a2e); box(B, x, 1.12, z, 0.9, 0.05, 2.7, 0x4a3220);
      box(GL, x + 0.05, 1.75, z, 0.03, 1.1, 2.2, 0x9fc3d8); for (let k = 0; k < 9; k++) box(B, x + 0.08, 1.75, z - 1.0 + k * 0.25, 0.02, 1.1, 0.02, 0x3a3a3a);
      box(B, x, 2.45, z, 0.9, 0.3, 2.7, 0x4a3220);
      panel(K, x + 0.47, 2.85, z, 2.6, 0.6, Math.PI / 2, (g, w, h) => { g.fillStyle = '#1d3f7a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(h * 0.34, 700, true); g.fillText(mr, w / 2, h * 0.42); g.font = font(h * 0.28, 800); g.fillText(en + '  ' + (i + 1), w / 2, h * 0.82); });
      solid(x, z, 0.8, 2.6); kp(x - 0.25, z, 0, 'idle', 'keeper');
      for (const dz of [-0.75, 0.75]) { box(B, x + 3.0, 0.9, z + dz, 4.0, 0.04, 0.04, 0xb8bcc2); for (let k = 0; k < 4; k++) S2.cyl(B, x + 1.3 + k * 1.15, 0.45, z + dz, 0.025, 0.9, 0xb8bcc2); solid(x + 3.0, z + dz, 4.0, 0.1, 2); }
    });
    spot(-W / 2 + 2.2, 3.2 + 2 * 3.4, 1.6, 'counter', 'Booking window');
    // the departures board on the right wall, amber on black
    panel(K, W / 2 - 0.16, 5.6, D * 0.42, 10, 3.6, -Math.PI / 2, (g, w, h) => {
      g.fillStyle = '#0b0b0c'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb000'; g.textAlign = 'left';
      const rows = [['DEPARTURES', 'प्रस्थान', '', ''], ['Deccan Queen', 'Mumbai CSMT', '1', 'COMING SOON'], ['Udyan Express', 'KSR Bengaluru', '3', 'COMING SOON'], ['Mahalaxmi Express', 'Kolhapur', '2', 'COMING SOON'], ['Jhelum Express', 'Jammu Tawi', '4', 'COMING SOON'], ['Indrayani Express', 'Mumbai CSMT', '1', 'COMING SOON'], ['Sinhagad Express', 'Mumbai CSMT', '6', 'COMING SOON']];
      rows.forEach((r, i) => { const y = h * (0.13 + i * 0.13); g.font = font(h * (i ? 0.075 : 0.085), i ? 700 : 900, !i); g.fillStyle = i ? '#ffb000' : '#ffd36a'; g.fillText(r[0] + (i ? '' : '   ' + r[1]), w * 0.03, y);
        if (i) { g.fillText(r[1], w * 0.4, y); g.fillText(r[2], w * 0.68, y); g.fillStyle = Math.floor(i * 1.7) % 2 ? '#ff5a3d' : '#ffb000'; g.fillText(r[3], w * 0.76, y); } });
      g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
    }, { px: 1024 });
    box(B, W / 2 - 0.08, 5.6, D * 0.42, 0.1, 3.8, 10.2, 0x1a1a1a);
    // the station clock
    S2.cyl(B, W / 2 - 0.15, 8.4, D * 0.42, 0.55, 0.08, 0xf4f1ea, 0, 0, Math.PI / 2); S2.ring(B, W / 2 - 0.2, 8.4, D * 0.42, 0.58, 0x1b1c1f, Math.PI / 2);
    box(B, W / 2 - 0.22, 8.55, D * 0.42, 0.02, 0.35, 0.05, 0x1b1c1f); box(B, W / 2 - 0.22, 8.4, D * 0.42 + 0.12, 0.02, 0.04, 0.26, 0x1b1c1f);
    // pillars, steel benches, ceiling fans
    for (const x of [-W / 6, W / 6]) for (const z of [D * 0.3, D * 0.7]) { S2.cyl(B, x, H / 2, z, 0.45, H, 0xeadfc4); S2.cyl(B, x, 0.3, z, 0.6, 0.6, 0xb8a37a); solid(x, z, 1.0, 1.0); }
    for (let r = 0; r < 3; r++) for (const sd of [-1, 1]) { const z = 5 + r * 4.4, x = sd * 3.2; box(B, x, 0.45, z, 4.2, 0.05, 0.5, 0x8a97a3); box(B, x, 0.75, z + 0.24, 4.2, 0.5, 0.04, 0x8a97a3); for (const e of [-1.9, 0, 1.9]) box(B, x + e, 0.22, z, 0.06, 0.45, 0.45, 0x5a646e); solid(x, z, 4.2, 0.6, 2);
      for (let k = 0; k < 4; k++) R.seats.push({ x: K.O.x + x - 1.5 + k, z: K.O.z + z, yaw: -Math.PI / 2, used: false, wait: true }); }
    for (const x of [-W / 4, 0, W / 4]) for (const z of [D * 0.3, D * 0.62]) { S2.cyl(B, x, H - 0.4, z, 0.02, 0.8, 0x3a3a3a); for (let k = 0; k < 3; k++) box(B, x + Math.cos(k * 2.09) * 0.5, H - 0.8, z + Math.sin(k * 2.09) * 0.5, 0.9, 0.02, 0.14, 0x6b5a46, 0, -k * 2.09); }
    // the chai stall by the door
    box(B, W / 2 - 2.2, 0.55, 2.4, 2.4, 1.1, 0.8, 0x8a5a2a); box(B, W / 2 - 2.2, 1.12, 2.4, 2.5, 0.04, 0.9, 0x6b4a2e); S2.cyl(B, W / 2 - 2.8, 1.3, 2.4, 0.16, 0.32, 0xb8bcc2); for (let k = 0; k < 6; k++) S2.cyl(B, W / 2 - 1.9 + k * 0.12, 1.19, 2.25, 0.03, 0.1, 0xf4f1ea);
    panel(K, W / 2 - 2.2, 2.3, 2.0, 2.4, 0.8, 0, (g, w, h) => board(g, w, h, 'चहा · TEA & SNACKS', [['Chai', '₹10'], ['Vada pav', '₹20']], { bg: '#fffbe8', fg: '#7a1e1e', fg2: '#1b1c1f' }));
    solid(W / 2 - 2.2, 2.4, 2.4, 0.8); kp(W / 2 - 2.2, 2.9, Math.PI / 2, 'idle', 'helper');
    R.customers = 16;
  },
  // a single-screen cinema: lobby to the hall's doors at z = 10, the hall beyond it
  cinema(K) {
    const { B, GL, box, solid, spot, kp, chair, counter, W, D, H, C, O, R } = K, S2 = shapes(K);
    const LZ = 10;
    floorPanel(K, 0, LZ / 2, W, LZ, PAINT.marble, [W / 4, LZ / 4]);
    floorPanel(K, 0, (LZ + D) / 2, W, D - LZ, PAINT.carpet, [W / 3, (D - LZ) / 3]);
    // the dividing wall with two curtained doorways into the hall
    for (const [x0, x1] of [[-W / 2, -4.5], [-2.5, 2.5], [4.5, W / 2]]) { box(B, (x0 + x1) / 2, H / 2, LZ, x1 - x0, H, 0.3, 0x5a2a20); C.addSeg(O.x + x0, O.z + LZ, O.x + x1, O.z + LZ, 0); }
    for (const s of [-1, 1]) { box(B, s * 3.5, H / 2 + 1.4, LZ, 2.2, H - 2.8, 0.3, 0x5a2a20); panel(K, s * 3.5, 1.4, LZ - 0.16, 2.0, 2.8, Math.PI, (g, w, h) => PAINT.curtain(g, w, h)); box(GL, s * 3.5, 3.05, LZ - 0.17, 0.9, 0.22, 0.02, 0x2fff9d); }
    // the lobby's own walls: cream over a teak dado (the hall stays dark), a chandelier, lit coves
    const lobbyWall = (g, w, h) => { g.fillStyle = '#efe4cc'; g.fillRect(0, 0, w, h); g.fillStyle = '#6b3a26'; g.fillRect(0, h * 0.78, w, h * 0.22); g.fillStyle = '#4a2a1a'; g.fillRect(0, h * 0.76, w, h * 0.025); for (let x = 0; x < w; x += w / 8) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, h * 0.8, 2, h * 0.2); } noise(g, w, h, 6, 5); };
    for (const s of [-1, 1]) panel(K, s * (W / 2 - 0.03), H / 2, LZ / 2, LZ, H, -s * Math.PI / 2, lobbyWall, { px: 512 });
    panel(K, 0, H / 2, LZ - 0.155, W, H, Math.PI, lobbyWall, { px: 512 });
    panel(K, 0, H / 2, 0.11, W, H, 0, lobbyWall, { px: 512 });
    box(B, 0, H - 0.01, LZ / 2, W, 0.02, LZ, 0xf4ecd8);
    S2.cyl(B, 0, H - 0.4, LZ / 2, 0.02, 0.8, 0xc9a227); S2.ring(B, 0, H - 0.9, LZ / 2, 0.7, 0xc9a227); S2.ring(B, 0, H - 1.15, LZ / 2, 0.45, 0xc9a227);
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; S2.sph(GL, Math.cos(a) * 0.7, H - 0.95, LZ / 2 + Math.sin(a) * 0.7, 0.07, 0xfff1c8); if (k % 2) S2.sph(GL, Math.cos(a) * 0.45, H - 1.2, LZ / 2 + Math.sin(a) * 0.45, 0.06, 0xfff1c8); }
    for (const s of [-1, 1]) box(GL, s * (W / 2 - 0.3), H - 0.12, LZ / 2, 0.08, 0.04, LZ - 1, 0xffe2b0);
    // marquee over the doors: NOW SHOWING, ringed with bulbs
    panel(K, 0, 4.6, LZ - 0.17, 7, 1.6, Math.PI, (g, w, h) => { g.fillStyle = '#120608'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd166'; g.textAlign = 'center'; g.font = font(h * 0.24, 900); g.fillText('NOW SHOWING · आज', w / 2, h * 0.36); g.fillStyle = '#fff'; g.font = font(h * 0.34, 900); g.fillText('PUNE EXPRESS', w / 2, h * 0.78); }, { glow: true, px: 512 });
    for (let i = 0; i <= 22; i++) { const t = i / 22; S2.sph(GL, -3.6 + t * 7.2, 5.45, LZ - 0.2, 0.05, 0xfff0b0); S2.sph(GL, -3.6 + t * 7.2, 3.75, LZ - 0.2, 0.05, 0xfff0b0); }
    // ticket window, left: a wooden booth, a grilled window, the rate board
    box(B, -W / 2 + 2.6, 1.5, 5.5, 3.6, 3.0, 2.2, 0x6b3a26); solid(-W / 2 + 2.6, 5.5, 3.6, 2.2);
    box(GL, -W / 2 + 2.6 + 0, 1.55, 4.38, 1.1, 0.7, 0.02, 0xfff2d6); for (let i = 0; i < 8; i++) box(B, -W / 2 + 2.1 + i * 0.14, 1.55, 4.36, 0.02, 0.7, 0.02, 0x3a3a3a);
    box(B, -W / 2 + 2.6, 1.15, 4.3, 1.4, 0.06, 0.25, 0x3a2416);
    panel(K, -W / 2 + 2.6, 2.6, 4.38, 2.4, 0.7, Math.PI, (g, w, h) => { g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd166'; g.textAlign = 'center'; g.font = font(h * 0.5, 900, true); g.fillText('तिकीट · TICKETS', w / 2, h * 0.68); }, { glow: true });
    panel(K, -W / 2 + 0.06, 2.0, 5.5, 2.0, 1.4, Math.PI / 2, (g, w, h) => board(g, w, h, 'दर · RATES', [['Balcony', '₹180'], ['Upper stall', '₹150'], ['Stall', '₹120'], ['Matinee 12:30', '₹100']]), { px: 384 });
    kp(-W / 2 + 2.6, 6.1, -Math.PI / 2, 'idle', 'keeper');
    // the queue: chrome posts and a red rope
    for (let i = 0; i < 6; i++) { const z = 3.9 - i * 0.6 * 0; const x = -W / 2 + 4.6 + i * 0.9; S2.cyl(B, x, 0.48, 3.4, 0.03, 0.96, 0xd8dde2); S2.cyl(B, x, 0.04, 3.4, 0.14, 0.04, 0xb8bcc2); S2.sph(B, x, 0.98, 3.4, 0.05, 0xd8dde2); if (i < 5) box(B, x + 0.45, 0.88, 3.4, 0.86, 0.04, 0.04, 0xb5121b); void z; }
    // the snacks counter, right: glass front, a popcorn machine, a cold-drinks fridge, the menu boards lit above
    counter(W / 2 - 3.2, 5.6, 4.6, 0.8, 0x2a1a1a, true);
    box(B, W / 2 - 4.6, 1.45, 5.6, 0.7, 0.18, 0.6, 0xc1121f); box(GL, W / 2 - 4.6, 1.85, 5.6, 0.62, 0.6, 0.52, 0xffe08a); for (let k = 0; k < 14; k++) S2.sph(B, W / 2 - 4.85 + (k % 5) * 0.12, 1.62 + Math.floor(k / 5) * 0.06, 5.45 + (k % 3) * 0.12, 0.05, 0xfff3c4);
    box(B, W / 2 - 0.5, 1.0, 7.2, 0.8, 2.0, 0.8, 0xdadde2); box(GL, W / 2 - 0.91, 1.1, 7.2, 0.02, 1.5, 0.6, 0xd6f4ff); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) S2.cyl(B, W / 2 - 0.75, 0.55 + r * 0.38, 6.98 + k * 0.15, 0.04, 0.24, [0xc1121f, 0x2a9d8f, 0xf4a261, 0x1b1c1f][(r + k) % 4]);
    solid(W / 2 - 0.5, 7.2, 0.8, 0.8);
    for (let i = 0; i < 3; i++) panel(K, W / 2 - 4.6 + i * 1.5, 2.9, 6.1, 1.35, 0.85, Math.PI, (g, w, h) => board(g, w, h, ['POPCORN', 'SNACKS', 'DRINKS'][i], [[['Salted', '₹120'], ['Samosa', '₹40'], ['Cola', '₹60']][i], [['Caramel', '₹150'], ['Vada pav', '₹30'], ['Coffee', '₹50']][i], [['Cheese', '₹170'], ['Sandwich', '₹80'], ['Water', '₹20']][i]], { bg: '#1a0a0e' }), { glow: true });
    kp(W / 2 - 3.2, 6.3, -Math.PI / 2, 'idle', 'helper');
    // posters down both walls, framed and lit
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const z = 1.5 + i * 2.1; if (s < 0 && z > 3.6 && z < 7.6) continue; panel(K, s * (W / 2 - 0.07), 2.1, z, 1.1, 1.6, -s * Math.PI / 2, (g, w, h) => poster(g, w, h, i * 2 + (s > 0 ? 1 : 0)), { glow: true }); box(GL, s * (W / 2 - 0.1), 3.05, z, 0.12, 0.06, 0.5, 0xfff0d0); }
    // a bench, a water cooler with steel tumblers, a dustbin, two ceiling fans
    for (let k = 0; k < 2; k++) { box(B, 1.2 + k * 2.2, 0.45, 1.6, 1.8, 0.08, 0.5, 0x6b3a26); for (const a of [-0.8, 0.8]) box(B, 1.2 + k * 2.2 + a, 0.22, 1.6, 0.06, 0.44, 0.45, 0x3a2416); }
    box(B, -1.6, 0.6, 9.3, 0.6, 1.2, 0.5, 0xc0c6cc); S2.cyl(B, -1.6, 1.3, 9.3, 0.18, 0.3, 0x2e86ab); for (let k = 0; k < 3; k++) S2.cyl(B, -1.75 + k * 0.15, 1.24, 9.05, 0.035, 0.1, 0xd8dde2); solid(-1.6, 9.3, 0.6, 0.5);
    S2.cyl(B, 3, 0.3, 9.4, 0.18, 0.6, 0x2e7d4f);
    for (const x of [-3, 3]) { S2.cyl(B, x, H - 0.3, 5, 0.03, 0.6, 0x3a3a3a); S2.cyl(B, x, H - 0.62, 5, 0.12, 0.12, 0x6b5a46); for (let k = 0; k < 3; k++) box(B, x + Math.cos(k * 2.09) * 0.5, H - 0.64, 5 + Math.sin(k * 2.09) * 0.5, 0.9, 0.02, 0.14, 0x8a7a66, 0, -k * 2.09); }
    // ---- the hall: stage and screen, curtains, rising rows of seats, wall sconces, the projector's beam
    const SZ = D - 0.4, sw = W * 0.82, sh = H * 0.5;
    box(B, 0, 0.35, SZ - 1.0, W - 1, 0.7, 2.0, 0x2a1408); solid(0, SZ - 1.0, W - 1, 2.0);
    panel(K, 0, 0.7 + sh / 2 + 0.6, SZ - 0.05, sw, sh, Math.PI, filmFrame, { glow: true, px: 1024 });
    box(B, 0, 0.7 + sh + 0.95, SZ - 0.1, sw + 1.4, 0.5, 0.2, 0x8a1e2e); box(B, 0, 0.7 + sh + 0.72, SZ - 0.12, sw + 1.4, 0.06, 0.22, 0xd4a017);
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) S2.cyl(B, s * (sw / 2 + 0.25 + k * 0.17), 0.7 + (sh + 1.2) / 2, SZ - 0.35 - (k % 2) * 0.08, 0.1, sh + 1.2, k % 2 ? 0x8a1e2e : 0x6e1420);
    for (const s of [-1, 1]) { box(B, s * (W / 2 - 1), 1.6, SZ - 1.8, 0.8, 1.8, 0.6, 0x1b1c1f); S2.cyl(B, s * (W / 2 - 1), 1.9, SZ - 2.11, 0.22, 0.04, 0x3a3a3e, Math.PI / 2); S2.cyl(B, s * (W / 2 - 1), 1.2, SZ - 2.11, 0.14, 0.04, 0x3a3a3e, Math.PI / 2); }
    const rows = Math.min(12, Math.floor((D - LZ - 6) / 1.05));
    for (let r = 0; r < rows; r++) {
      const z = SZ - 6.2 - r * 1.05, y0 = r * 0.16;
      box(B, 0, y0 / 2, z - 0.1, W - 2, y0 + 0.001, 1.05, 0x3a1a22);
      for (let x = -W / 2 + 1.6; x <= W / 2 - 1.6; x += 0.62) {
        if (Math.abs(x) < 0.7) continue;                 // the centre aisle
        box(B, x, y0 + 0.45, z, 0.5, 0.1, 0.48, 0x9a1a2a); box(B, x, y0 + 0.82, z + 0.24, 0.52, 0.72, 0.1, 0x9a1a2a); box(B, x, y0 + 1.14, z + 0.26, 0.5, 0.08, 0.12, 0x7a1220);
        box(B, x + 0.29, y0 + 0.62, z + 0.02, 0.05, 0.08, 0.5, 0x2a1a14); box(B, x, y0 + 0.2, z + 0.1, 0.4, 0.4, 0.05, 0x2a1a14);
      }
      solid(-W / 4 - 0.3, z, W / 2 - 2.2, 0.9); solid(W / 4 + 0.3, z, W / 2 - 2.2, 0.9);
      for (const s of [-1, 1]) box(GL, s * 0.55, y0 + 0.05, z - 0.45, 0.08, 0.03, 0.08, 0xffb050);   // aisle lights
    }
    for (const s of [-1, 1]) for (let z = LZ + 2; z < SZ - 2; z += 3) { panel(K, s * (W / 2 - 0.06), 3.2, z, 2.6, 3.6, -s * Math.PI / 2, (g, w, h) => { g.fillStyle = '#3a1218'; g.fillRect(0, 0, w, h); for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#4a1820' : '#341016'; g.fillRect(0, k * h / 6, w, h / 6); } }); S2.half(GL, s * (W / 2 - 0.1), 4.9, z, 0.18, 0.3, 0xffcf8a, s > 0 ? -Math.PI / 2 : Math.PI / 2); }
    for (const s of [-1, 1]) box(GL, s * (W / 2 - 0.6), 2.6, SZ - 3.2, 0.7, 0.24, 0.02, 0x2fff9d);
    // the projection window high in the back wall, and its beam to the screen
    box(GL, 0, H - 1.6, LZ + 0.17, 0.8, 0.5, 0.02, 0xfff8e0);
    const len = Math.hypot(SZ - LZ, (H - 1.6) - (0.7 + sh / 2 + 0.6)), beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, sh * 0.6, len, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.set(O.x, K.FLOOR + ((H - 1.6) + (0.7 + sh / 2 + 0.6)) / 2, O.z + (LZ + SZ) / 2); beam.rotation.x = Math.PI / 2 - Math.atan2((H - 1.6) - (0.7 + sh / 2 + 0.6), SZ - LZ); R.dyn.push(beam);
    spot(-W / 2 + 2.6, 3.6, 1.6, 'counter', 'Tickets');
    spot(W / 2 - 3.2, 4.6, 1.6, 'counter', 'Popcorn and cold drinks');
    spot(0, LZ + 2.0, 1.6, 'counter', 'Find your seat: watch the film');
    for (let x = 1.2; x <= 3.4; x += 2.2) chair(x, 1.6, Math.PI / 2, x, 3, { seat: { wait: true } });
    R.customers = 6;
  },

  // a wada-style temple: the sabha mandap of carved teak, the sanctum at the back
  temple(K) {
    const { B, GL, box, solid, spot, kp, W, D, H, C, O, R } = K, S2 = shapes(K);
    floorPanel(K, 0, D / 2, W, D, PAINT.stone, [W / 4, D / 4]);
    panel(K, 0, 0.006, D * 0.45, 2.4, 2.4, 0, PAINT.rangoli, { rx: -Math.PI / 2, alpha: true });
    // wooden ceiling: beams across and along, dark teak
    for (let z = 1; z < D; z += 1.6) box(B, 0, H - 0.18, z, W, 0.2, 0.18, 0x3a2416);
    for (let x = -W / 2 + 1; x < W / 2; x += 2) box(B, x, H - 0.4, D / 2, 0.18, 0.22, D, 0x4a2e1c);
    // lime-plastered walls in ochre, a painted frieze, framed pictures of the deities
    const tWall = (g, w, h) => { g.fillStyle = '#e8c88a'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a1e1e'; g.fillRect(0, h * 0.12, w, h * 0.05); g.fillStyle = '#2e5a3a'; g.fillRect(0, h * 0.17, w, h * 0.015);
      for (let x = 10; x < w; x += 34) { g.fillStyle = '#d4a017'; g.beginPath(); g.arc(x, h * 0.145, 7, 0, 6.28); g.fill(); g.fillStyle = '#7a1e1e'; g.beginPath(); g.arc(x, h * 0.145, 3, 0, 6.28); g.fill(); }
      g.fillStyle = '#9a8e7c'; g.fillRect(0, h * 0.86, w, h * 0.14); noise(g, w, h, 14, 8); };
    for (const s of [-1, 1]) panel(K, s * (W / 2 - 0.02), H / 2, D / 2, D, H, -s * Math.PI / 2, tWall, { px: 512 });
    panel(K, 0, H / 2, 0.11, W, H, 0, tWall, { px: 512 });
    panel(K, 0, H / 2, D - 0.11, W, H, Math.PI, tWall, { px: 512 });
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const z = 3 + i * 3.6; panel(K, s * (W / 2 - 0.06), 2.6, z, 0.9, 1.2, -s * Math.PI / 2, (g, w, h) => { g.fillStyle = '#c9a227'; g.fillRect(0, 0, w, h); g.fillStyle = ['#e76f51', '#2a9d8f', '#8338ec'][i]; g.fillRect(8, 8, w - 16, h - 16); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(w / 2, h * 0.38, w * 0.22, 0, 6.28); g.fill(); g.fillStyle = '#d8461f'; g.beginPath(); g.ellipse(w / 2, h * 0.66, w * 0.26, h * 0.2, 0, 0, 6.28); g.fill(); }); }
    // two rows of carved teak pillars on stone bases, each with a bracket capital
    for (const sx of [-1, 1]) for (let z = 2.2; z < D - 4.5; z += 2.6) {
      const x = sx * (W / 2 - 2.4);
      box(B, x, 0.2, z, 0.62, 0.4, 0.62, 0x9a8e7c); S2.oct(B, x, H / 2, z, 0.2, H - 0.4, 0x5a3420);
      for (let k = 0; k < 4; k++) S2.cyl(B, x, 0.9 + k * 0.9, z, 0.24, 0.12, 0x3a2416);
      box(B, x, H - 0.75, z, 0.5, 0.3, 0.5, 0x4a2e1c); box(B, x, H - 0.55, z, 1.4, 0.16, 0.3, 0x4a2e1c);
      for (const a of [-1, 1]) box(B, x + a * 0.55, H - 0.75, z, 0.18, 0.4, 0.22, 0x5a3420, 0, 0, a * 0.5);
      solid(x, z, 0.62, 0.62);
    }
    // marigold torans swagged between the pillars, hanging brass lamps and bells
    for (const sx of [-1, 1]) for (let z = 2.2; z < D - 7; z += 2.6) for (let k = 0; k <= 12; k++) { const t = k / 12, y = H - 0.95 - Math.sin(t * Math.PI) * 0.55; S2.sph(B, sx * (W / 2 - 2.4), y, z + t * 2.6, 0.07, k % 3 === 2 ? 0x2e7d4f : k % 2 ? 0xffb300 : 0xff8f00); }
    for (let z = 3.5; z < D - 6; z += 2.6) for (const x of [-1.6, 1.6]) { S2.cyl(B, x, H - 0.8, z, 0.01, 1.4, 0x8a6a2a); S2.cone(B, x, H - 1.6, z, 0.18, 0.28, 0xd4a017, Math.PI); S2.cyl(B, x, H - 1.8, z, 0.12, 0.04, 0xd4a017); S2.sph(GL, x, H - 1.74, z, 0.04, 0xffb050); }
    // the sanctum: a stone shrine up three steps, a carved arch doorway, silver door frame, the deity in lamplight
    const SZ = D - 2.2;
    for (let i = 0; i < 3; i++) box(B, 0, 0.1 + i * 0.2, SZ - 2.4 + i * 0.35, 4.6 - i * 0.5, 0.2, 1.0, 0x8a8170);
    box(B, -1.6, 2.2, SZ, 1.4, 4.4, 2.6, 0x8a7a66); box(B, 1.6, 2.2, SZ, 1.4, 4.4, 2.6, 0x8a7a66); box(B, 0, 3.7, SZ, 1.8, 1.4, 2.6, 0x8a7a66);
    box(B, 0, 4.8, SZ, 5.2, 0.5, 3.0, 0x7d6e5a); S2.cone(B, 0, H - 0.6, SZ, 1.4, 1.0, 0xd4a017);
    for (const s of [-1, 1]) box(B, s * 0.92, 1.6, SZ - 1.31, 0.16, 3.0, 0.08, 0xcfd3d6); box(B, 0, 3.08, SZ - 1.31, 2.0, 0.16, 0.08, 0xcfd3d6);   // silver frame
    for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10; S2.sph(B, Math.cos(a) * 0.85, 3.0 + Math.sin(a) * 0.3, SZ - 1.36, 0.06, 0xcfd3d6); }
    for (let k = 0; k <= 16; k++) { const t = k / 16, x = -0.95 + t * 1.9, y = 3.25 - Math.sin(t * Math.PI) * 0.35; S2.sph(B, x, y, SZ - 1.42, 0.07, k % 2 ? 0xffb300 : 0xff7a00); }   // marigolds over the door
    S2.sph(GL, 0, 1.75, SZ - 0.2, 0.5, 0x6a2a08); for (const s of [-0.45, 0.45]) S2.sph(GL, s, 1.0, SZ - 0.45, 0.06, 0xffd27a);   // lamplight round the deity
    box(B, 0, 0.9, SZ + 0.2, 1.2, 0.5, 0.8, 0x6b5a46);                                 // the pedestal
    S2.sph(B, 0, 1.45, SZ + 0.2, 0.36, 0xd8461f, 1.2); S2.sph(B, 0, 1.98, SZ + 0.15, 0.24, 0xe0521f);   // the deity: sindoor-red, crowned
    S2.cone(B, 0, 2.32, SZ + 0.15, 0.16, 0.3, 0xd4a017); S2.cyl(B, 0.12, 1.7, SZ - 0.05, 0.05, 0.4, 0xd8461f, 0.3);
    box(GL, 0, 1.7, SZ + 0.62, 1.3, 1.8, 0.02, 0x5a2a10);
    for (let k = 0; k < 12; k++) S2.sph(B, -0.5 + (k % 6) * 0.2, 1.08 + Math.floor(k / 6) * 0.06, SZ - 0.25, 0.06, k % 2 ? 0xffb300 : 0xffffff);   // flowers
    for (const s of [-1, 1]) { S2.cyl(B, s * 0.75, 0.75, SZ - 0.6, 0.06, 0.5, 0xd4a017); S2.cone(GL, s * 0.75, 1.08, SZ - 0.6, 0.03, 0.08, 0xffd27a); }   // samai lamps
    S2.cyl(B, 0, H - 1.2, SZ - 1.8, 0.01, 2.0, 0x8a6a2a); S2.cone(B, 0, H - 2.35, SZ - 1.8, 0.28, 0.42, 0xc9a227, Math.PI);   // the big bell at the door
    solid(0, SZ, 5.2, 2.8); solid(0, SZ - 1.9, 4.6, 0.3);
    // the mouse, facing the deity; a deepmal (lamp tower) by the steps
    S2.sph(B, 0, 0.3, SZ - 4.0, 0.25, 0x5a5a5e, 0.8); S2.sph(B, 0, 0.45, SZ - 4.25, 0.12, 0x5a5a5e); box(B, 0, 0.08, SZ - 4.0, 0.7, 0.16, 0.9, 0x8a8170); solid(0, SZ - 4.0, 0.7, 0.9);
    const DX = W / 2 - 1.0; S2.oct(B, DX, 1.5, SZ - 4.5, 0.3, 3.0, 0x6b6458); for (let k = 0; k < 7; k++) { box(B, DX, 0.5 + k * 0.38, SZ - 4.5, 0.85, 0.06, 0.85, 0x6b6458); for (let a = 0; a < 4; a++) S2.sph(GL, DX + Math.cos(a * 1.57) * 0.38, 0.56 + k * 0.38, SZ - 4.5 + Math.sin(a * 1.57) * 0.38, 0.03, 0xffb050); } solid(DX, SZ - 4.5, 0.9, 0.9);
    // the donation box, the shoe rack by the door with chappals in it, a red runner to sit on
    box(B, -W / 2 + 1.2, 0.5, SZ - 4.2, 0.6, 1.0, 0.5, 0xc0c6cc); panel(K, -W / 2 + 1.2, 0.75, SZ - 4.46, 0.5, 0.25, Math.PI, (g, w, h) => { g.fillStyle = '#7a1e1e'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(h * 0.6, 800, true); g.fillText('दानपेटी', w / 2, h * 0.72); }); solid(-W / 2 + 1.2, SZ - 4.2, 0.6, 0.5);
    box(B, W / 2 - 1.4, 0.4, 1.0, 2.0, 0.8, 0.4, 0x6b4a2e); for (let k = 0; k < 10; k++) box(B, W / 2 - 2.2 + (k % 5) * 0.4, 0.12 + Math.floor(k / 5) * 0.4, 1.0, 0.22, 0.04, 0.1, [0x3a2416, 0x8a1e1e, 0x1b1c1f][k % 3]); solid(W / 2 - 1.4, 1.0, 2.0, 0.4);
    for (const x of [-1.4, 1.4]) box(B, x, 0.01, D / 2 - 1, 1.2, 0.02, D * 0.4, 0x8a1e1e);
    // the flowers-and-prasad stall at the entrance
    box(B, -W / 2 + 2.2, 0.45, 2.0, 2.4, 0.9, 0.8, 0x6b4a2e); solid(-W / 2 + 2.2, 2.0, 2.4, 0.8);
    for (let k = 0; k < 4; k++) { S2.cyl(B, -W / 2 + 1.4 + k * 0.55, 0.98, 2.0, 0.2, 0.12, 0xc8a46a); for (let j = 0; j < 6; j++) S2.sph(B, -W / 2 + 1.3 + k * 0.55 + (j % 3) * 0.08, 1.08, 1.95 + Math.floor(j / 3) * 0.1, 0.05, [0xffb300, 0xffffff, 0xe63946, 0x8a5a2a][k]); }
    kp(-W / 2 + 2.2, 2.6, -Math.PI / 2, 'idle', 'helper'); kp(1.4, SZ - 2.8, -Math.PI / 2, 'idle', 'keeper');
    spot(0, SZ - 3.4, 1.6, 'counter', 'Darshan');
    spot(-W / 2 + 2.2, 1.2, 1.3, 'counter', 'Flowers and prasad');
    R.customers = 6;
  },

  // bowling down one side, the games on the other, the prize counter at the back
  arcade(K) {
    const { B, GL, box, solid, spot, kp, chair, W, D, H, R, browse } = K, S2 = shapes(K);
    floorPanel(K, W / 4, D / 2, W / 2, D, PAINT.cosmic, [W / 4, D / 4]);
    const lanes = 4, lw = 1.25, lx0 = -W / 2 + 1.0, L0 = 3.6, L1 = D - 1.4;
    for (let i = 0; i < lanes; i++) {
      const x = lx0 + 0.3 + i * (lw + 0.55) + lw / 2;
      panel(K, x, 0.02, (L0 + L1) / 2, lw, L1 - L0, 0, PAINT.lane, { rx: -Math.PI / 2, px: 512 });
      for (const s of [-1, 1]) { box(B, x + s * (lw / 2 + 0.12), 0.0, (L0 + L1) / 2, 0.24, 0.03, L1 - L0, 0x111116); box(GL, x + s * (lw / 2 + 0.25), 0.03, (L0 + L1) / 2, 0.02, 0.02, L1 - L0, 0x2fd3ff); }
      box(B, x + lw / 2 + 0.28, 0.25, (L0 + L1) / 2, 0.16, 0.5, L1 - L0, 0x2a2a3a);
      // ten pins in their triangle
      for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) { const px = x + (k - r / 2) * 0.3, pz = L1 - 1.4 + r * 0.26; S2.cyl(B, px, 0.2, pz, 0.06, 0.4, 0xffffff); S2.sph(B, px, 0.42, pz, 0.055, 0xffffff); S2.cyl(B, px, 0.3, pz, 0.062, 0.03, 0xd1495b); }
      // the pinsetter hood, its lane number lit
      box(B, x, 1.3, L1 - 0.6, lw + 0.6, 1.0, 1.4, 0x14141c); panel(K, x, 1.35, L1 - 1.32, lw, 0.6, Math.PI, (g, w, h) => { g.fillStyle = '#0b0b12'; g.fillRect(0, 0, w, h); g.fillStyle = ['#2fd3ff', '#ff2f7d', '#ffd166', '#7dff6b'][i]; g.textAlign = 'center'; g.font = font(h * 0.7, 900); g.fillText(String(i + 1), w / 2, h * 0.78); }, { glow: true });
      // the ball return and its balls; the scoreboard overhead
      box(B, x + lw / 2 + 0.28, 0.45, L0 - 0.8, 0.5, 0.5, 1.2, 0x23233a); for (let k = 0; k < 4; k++) S2.sph(B, x + lw / 2 + 0.28, 0.82, L0 - 1.25 + k * 0.28, 0.12, [0x2fd3ff, 0xff2f7d, 0x7dff6b, 0xffd166][(k + i) % 4]);
      panel(K, x, 3.1, L0 - 0.4, 1.3, 0.75, Math.PI, (g, w, h) => { g.fillStyle = '#05060a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2fd3ff'; g.lineWidth = 2; for (let f = 0; f < 10; f++) g.strokeRect(4 + f * (w - 8) / 10, h * 0.25, (w - 8) / 10, h * 0.5); g.fillStyle = '#fff'; g.font = font(h * 0.18, 700); for (let f = 0; f < 6; f++) g.fillText(['X', '9', '7/', 'X', '8', '6'][f], 8 + f * (w - 8) / 10, h * 0.55); g.fillStyle = '#ffd166'; g.fillText(`LANE ${i + 1}`, 6, h * 0.18); }, { glow: true });
      solid(x, (L0 + L1) / 2, lw + 0.6, L1 - L0);
    }
    // seats behind the lanes, orange and curved
    for (let i = 0; i < lanes; i++) { const x = lx0 + 0.3 + i * (lw + 0.55) + lw / 2; S2.half(B, x, 0.3, 1.6, 0.7, 0.4, 0xf28f3b, Math.PI / 2); box(B, x, 0.55, 1.2, 1.3, 0.5, 0.15, 0xf28f3b); chair(x, 1.6, Math.PI / 2, x, 3, { seat: { wait: true } }); }
    // the games: cabinets with lit marquees and screens, racing seats, air hockey, a claw machine
    const gx0 = 1.5;
    for (let j = 0; j < 4; j++) for (let r = 0; r < 2; r++) {
      const x = gx0 + j * 1.5, z = 4 + r * 4.2, col = [0x2fd3ff, 0xff2f7d, 0xffd166, 0x7dff6b][(j + r) % 4];
      box(B, x, 0.6, z, 0.95, 1.2, 0.8, 0x15151d); box(B, x, 1.55, z + 0.08, 0.95, 0.7, 0.64, 0x15151d); box(GL, x, 2.05, z - 0.3, 0.93, 0.25, 0.04, col);
      panel(K, x, 1.55, z - 0.25, 0.75, 0.55, Math.PI, (g, w, h) => { g.fillStyle = '#05060a'; g.fillRect(0, 0, w, h); const rr = rnd(j * 7 + r); for (let k = 0; k < 40; k++) { g.fillStyle = ['#2fd3ff', '#ff2f7d', '#ffd166', '#7dff6b', '#ffffff'][k % 5]; g.fillRect(rr() * w, rr() * h, 4 + rr() * 8, 4 + rr() * 8); } }, { glow: true });
      box(B, x, 1.02, z - 0.48, 0.95, 0.12, 0.4, 0x2a2a3a); for (let k = 0; k < 4; k++) S2.sph(B, x - 0.25 + k * 0.17, 1.1, z - 0.52, 0.035, [0xff2f2f, 0x2f9dff, 0xffd166, 0x7dff6b][k]); S2.cyl(B, x - 0.36, 1.15, z - 0.45, 0.02, 0.12, 0x1b1c1f);
      solid(x, z, 0.95, 0.8, 2); browse(x, z - 1.0);
    }
    for (let k = 0; k < 2; k++) { const x = gx0 + k * 2.2, z = D - 6; box(B, x, 0.3, z, 0.9, 0.6, 1.4, 0x1b1c1f); box(B, x, 0.75, z + 0.3, 0.6, 0.6, 0.12, 0xc1121f); box(GL, x, 1.5, z - 0.8, 1.2, 0.75, 0.04, 0x8ec5ff); S2.cyl(B, x, 0.95, z - 0.25, 0.16, 0.04, 0x1b1c1f, Math.PI / 2 - 0.3); solid(x, z, 1.0, 1.6, 2); }
    box(B, W / 2 - 2.6, 0.8, D - 6, 1.2, 0.1, 2.0, 0xf2f4f6); box(B, W / 2 - 2.6, 0.4, D - 6, 1.0, 0.8, 1.8, 0x23233a); box(GL, W / 2 - 2.6, 0.87, D - 6, 1.1, 0.02, 1.9, 0x8ec5ff); S2.cyl(B, W / 2 - 2.6, 0.9, D - 6.5, 0.07, 0.06, 0xff2f7d); S2.cyl(B, W / 2 - 2.6, 0.9, D - 5.5, 0.07, 0.06, 0x2fd3ff); solid(W / 2 - 2.6, D - 6, 1.2, 2.0, 2);
    box(B, W / 2 - 0.8, 0.5, D - 9, 1.2, 1.0, 1.2, 0xff2f7d); box(GL, W / 2 - 0.8, 1.6, D - 9, 1.1, 1.2, 1.1, 0xbfe6ff); box(GL, W / 2 - 0.8, 2.3, D - 9, 1.2, 0.2, 1.2, 0xffd166);
    for (let k = 0; k < 14; k++) S2.sph(B, W / 2 - 1.15 + (k % 4) * 0.22, 1.1 + Math.floor(k / 4) * 0.12, D - 9.3 + (k % 3) * 0.25, 0.1, [0xff8fab, 0xffd166, 0x80ed99, 0xc77dff, 0x8ec5ff][k % 5]); solid(W / 2 - 0.8, D - 9, 1.2, 1.2);
    // the prize counter: shelves of soft toys behind glass, the card machine
    K.counter(W / 2 - 2.6, D - 1.6, 3.4, 0.8, 0x23233a, true);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) S2.sph(B, W / 2 - 4.0 + k * 0.32, 1.3 + r * 0.42, D - 0.4, 0.14, [0xff8fab, 0xffd166, 0x80ed99, 0xc77dff, 0x8ec5ff, 0xf28f3b][(r * 9 + k) % 6]);
    box(B, W / 2 - 2.6, 1.6, D - 0.25, 3.6, 1.6, 0.3, 0x15151d);
    kp(W / 2 - 2.6, D - 0.9, -Math.PI / 2, 'idle', 'keeper');
    panel(K, W / 2 - 2.6, H - 1.0, D - 0.12, 4.6, 0.9, Math.PI, (g, w, h) => { g.fillStyle = '#0b0b12'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff2f7d'; g.textAlign = 'center'; g.font = font(h * 0.55, 900); g.fillText('STRIKE ZONE', w / 2, h * 0.72); }, { glow: true });
    spot(W / 2 - 2.6, D - 2.5, 1.5, 'counter', 'Lanes, game cards and prizes');
    R.customers = 8;
  },

  // an abhyasika: partitioned desks in rows, a lamp each; lockers, books, the papers, silence
  library(K) {
    const { B, GL, box, solid, spot, kp, chair, W, D, H, R } = K, S2 = shapes(K);
    floorPanel(K, 0, D / 2, W, D, (g, w, h) => { g.fillStyle = '#c9bfa8'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) for (let y = 0; y < h; y += 32) { g.fillStyle = (x / 32 + y / 32) % 2 ? '#bfb49c' : '#d2c9b3'; g.fillRect(x, y, 32, 32); } noise(g, w, h, 8, 3); }, [W / 2, D / 2]);
    // walls of books, floor to ceiling, both sides of the front half
    for (const s of [-1, 1]) { box(B, s * (W / 2 - 0.25), H / 2, D * 0.3, 0.5, H, D * 0.5, 0x5a3a22); panel(K, s * (W / 2 - 0.51), H / 2, D * 0.3, D * 0.5, H - 0.3, -s * Math.PI / 2, PAINT.books, { px: 512 }); solid(s * (W / 2 - 0.25), D * 0.3, 0.5, D * 0.5); }
    // the desks: rows of cubicles, each with side partitions, a green-shaded lamp, books, a bottle, a bag
    const rows = Math.floor((D - 5) / 1.9);
    for (let r = 0; r < rows; r++) for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      const x = k * 1.25 + Math.sign(k) * 0.4, z = 4.2 + r * 1.9;
      box(B, x, 0.74, z, 1.1, 0.04, 0.6, 0x7a5236); box(B, x, 0.37, z - 0.28, 1.1, 0.74, 0.03, 0x6b4a2e);
      box(B, x - 0.56, 1.0, z, 0.03, 0.55, 0.6, 0xd8cfb8); box(B, x, 1.0, z - 0.3, 1.1, 0.55, 0.03, 0xd8cfb8);
      S2.cyl(B, x + 0.35, 0.78, z - 0.12, 0.06, 0.03, 0x2a2a2a); S2.cyl(B, x + 0.35, 0.95, z - 0.12, 0.012, 0.32, 0x2a2a2a); S2.half(GL, x + 0.3, 1.1, z - 0.06, 0.13, 0.3, 0x2fbf6a, 0);
      for (let b = 0; b < 3; b++) box(B, x - 0.3, 0.8 + b * 0.04, z - 0.15, 0.3, 0.04, 0.22, [0x2e4a7a, 0x8a1e1e, 0xd8cfb8][b]);
      if ((r + k) % 3) { S2.cyl(B, x + 0.05, 0.86, z - 0.2, 0.035, 0.22, 0x8ec5ff); box(B, x + 0.2, 0.78, z + 0.05, 0.24, 0.02, 0.18, 0xffffff); }
      chair(x, z + 0.55, -Math.PI / 2, x, z);
      solid(x, z, 1.15, 0.65, 2);
    }
    // steel lockers along the back wall, the newspaper stand, the clock and the silence sign
    for (let k = 0; k < 10; k++) { const x = -W / 2 + 1.0 + k * 0.62; if (x > W / 2 - 1) break; box(B, x, 1.0, D - 0.35, 0.6, 2.0, 0.5, 0x7d8a96); for (let j = 0; j < 3; j++) { box(B, x, 0.35 + j * 0.65, D - 0.6, 0.55, 0.6, 0.02, 0x8a97a3); box(B, x + 0.2, 0.5 + j * 0.65, D - 0.62, 0.04, 0.08, 0.02, 0x2a2a2a); } }
    solid(0, D - 0.35, W - 1, 0.5);
    box(B, -1.6, 0.7, 2.0, 1.2, 1.4, 0.3, 0x6b4a2e); for (let k = 0; k < 4; k++) box(B, -1.6, 0.6 + k * 0.22, 1.82, 1.0, 0.02, 0.32, [0xf4f1ea, 0xe8e2d6, 0xf4f1ea, 0xfff3d6][k], -0.35);
    S2.cyl(B, 0, H - 0.7, D - 0.08, 0.3, 0.05, 0xf4f1ea, Math.PI / 2); S2.ring(B, 0, H - 0.7, D - 0.1, 0.3, 0x1b1c1f, 0); box(B, 0.06, H - 0.65, D - 0.12, 0.12, 0.02, 0.01, 0x1b1c1f);
    panel(K, -W / 4, H - 0.75, D - 0.08, 2.4, 0.55, Math.PI, (g, w, h) => { g.fillStyle = '#fff3d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a1e1e'; g.textAlign = 'center'; g.font = font(h * 0.36, 800, true); g.fillText('शांतता राखा · SILENCE', w / 2, h * 0.64); });
    panel(K, W / 4, H - 0.85, D - 0.08, 1.8, 1.1, Math.PI, PAINT.notice);
    for (const x of [-W / 4, W / 4]) for (const z of [D * 0.4, D * 0.75]) { S2.cyl(B, x, H - 0.25, z, 0.02, 0.5, 0x3a3a3a); for (let k = 0; k < 3; k++) box(B, x + Math.cos(k * 2.09) * 0.45, H - 0.5, z + Math.sin(k * 2.09) * 0.45, 0.8, 0.02, 0.12, 0xd8d0c0, 0, -k * 2.09); }
    K.counter(2.5, 2.0, 2.4, 0.7, 0x6b4a2e); kp(2.5, 2.6, -Math.PI / 2, 'idle', 'keeper'); box(B, 2.0, 1.1, 2.0, 0.5, 0.3, 0.4, 0x1b1c1f);
    spot(2.5, 1.2, 1.3, 'counter', 'Front desk: a seat for two hours');
    R.customers = 8;
  },

  // an istri and laundry shop: the long padded ironing table, irons, front-loaders, bundles, the rate card
  laundry(K) {
    const { B, GL, box, solid, spot, kp, W, D, H, R } = K, S2 = shapes(K);
    floorPanel(K, 0, D / 2, W, D, (g, w, h) => { g.fillStyle = '#b8b2a6'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 40) for (let y = 0; y < h; y += 40) { g.strokeStyle = 'rgba(0,0,0,.18)'; g.strokeRect(x, y, 40, 40); } noise(g, w, h, 14, 6); }, [W / 2, D / 2]);
    // the ironing table: thick quilt on top, a charcoal iron and an electric one, a sprinkler bottle, a stack done
    box(B, 0, 0.45, D / 2, 3.6, 0.9, 1.0, 0x6b4a2e); box(B, 0, 0.93, D / 2, 3.6, 0.06, 1.0, 0xd8cfb8); box(B, 0, 0.965, D / 2, 3.5, 0.01, 0.95, 0xe9e0c8); solid(0, D / 2, 3.6, 1.0, 2);
    box(B, -0.7, 1.05, D / 2, 0.36, 0.16, 0.2, 0x2a2a2a); S2.cyl(B, -0.7, 1.22, D / 2, 0.03, 0.3, 0x3a2416, 0, 0, Math.PI / 2); for (let k = 0; k < 4; k++) S2.sph(GL, -0.84 + k * 0.09, 1.06, D / 2 + 0.11, 0.02, 0xff6a1a);
    box(B, 0.5, 1.03, D / 2 + 0.1, 0.28, 0.12, 0.16, 0xd8dde2); S2.cyl(B, 0.9, 1.06, D / 2 - 0.2, 0.05, 0.22, 0x8ec5ff);
    for (let k = 0; k < 6; k++) box(B, 1.3, 1.0 + k * 0.05, D / 2, 0.45, 0.05, 0.35, [0xf4f2ee, 0x2e86ab, 0xd1495b, 0xf4f2ee, 0x1b1c1f, 0xe0b23a][k]);
    // front-loading machines along the back, their round doors
    for (let i = 0; i < 4; i++) { const x = -W / 2 + 1.0 + i * 0.95; box(B, x, 0.45, D - 0.5, 0.85, 0.9, 0.7, 0xf2f4f6); S2.cyl(B, x, 0.48, D - 0.86, 0.26, 0.02, 0x22303a, Math.PI / 2); S2.ring(B, x, 0.48, D - 0.87, 0.28, 0xb8bcc2, 0); box(B, x, 0.84, D - 0.86, 0.6, 0.06, 0.02, 0x2e86ab); }
    box(B, W / 2 - 1.2, 0.8, D - 0.5, 1.2, 1.6, 0.7, 0xdfe5ea); solid(0, D - 0.5, W - 1, 0.7);
    // the rail of hangers waiting to go home, and shelves of bundles tied up in cloth with tags
    box(B, -W / 2 + 0.4, 1.9, D / 2 - 0.5, 0.04, 0.04, 3.4, 0xb8bcc2);
    for (let i = 0; i < 12; i++) { const z = D / 2 - 2.0 + i * 0.27; box(B, -W / 2 + 0.4, 1.45, z, 0.06, 0.85, 0.42, [0xf4f2ee, 0x2e86ab, 0xd1495b, 0x1b1c1f, 0xe0b23a, 0x7a9e7e][i % 6]); box(B, -W / 2 + 0.4, 1.86, z, 0.02, 0.06, 0.38, 0x8a8a8a); }
    box(B, W / 2 - 0.3, 1.2, D / 2, 0.5, 2.4, 3.0, 0x8a7a66); solid(W / 2 - 0.3, D / 2, 0.5, 3.0);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { box(B, W / 2 - 0.35, 0.3 + r * 0.55, D / 2 - 1.2 + k * 0.48, 0.4, 0.36, 0.42, [0xf4f1ea, 0xe0b23a, 0xc1121f, 0x2e86ab, 0x7a9e7e][(r + k) % 5]); box(B, W / 2 - 0.56, 0.38 + r * 0.55, D / 2 - 1.2 + k * 0.48, 0.02, 0.08, 0.06, 0xfff3b0); }
    // the counter by the door, the receipt book, the rate card
    K.counter(-0.5, 1.8, 2.4, 0.7, 0x8a7a66); box(B, -0.9, 1.1, 1.8, 0.3, 0.04, 0.2, 0xfffbe8); kp(-0.5, 2.4, -Math.PI / 2, 'idle', 'keeper');
    panel(K, 0, H - 1.0, D - 0.12, 2.6, 1.3, Math.PI, (g, w, h) => board(g, w, h, 'इस्त्री · RATES', [['Shirt / kurta', '₹15'], ['Trouser', '₹15'], ['Saree', '₹40'], ['Dry clean, suit', '₹250'], ['Wash + iron, kg', '₹90']], { bg: '#fffbe8', fg: '#7a1e1e', fg2: '#1b1c1f', edge: '#2e86ab' }), { px: 384 });
    S2.cyl(B, 0, H - 0.25, D / 2, 0.02, 0.5, 0x3a3a3a); for (let k = 0; k < 3; k++) box(B, Math.cos(k * 2.09) * 0.45, H - 0.5, D / 2 + Math.sin(k * 2.09) * 0.45, 0.8, 0.02, 0.12, 0xd8d0c0, 0, -k * 2.09);
    spot(-0.5, 1.0, 1.3, 'counter', 'At the counter');
    R.customers = 2;
  },
};

export { panel as roomPanel };
