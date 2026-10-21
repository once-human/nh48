// Leaf-cluster atlas drawn on a canvas at load: one cell per Pune street-tree species, each a
// twig with leaves of that species' shape and colour (bipinnate rain tree, feathery gulmohar,
// heart-shaped peepal, pinnate neem, drooping ashoka, coconut frond, glossy banyan, mango whorls).
// Cells are square; the twig enters at the bottom centre because ez-tree anchors leaf cards there.
import * as THREE from 'three';
import { RNG } from '../core/util.js';

export const LEAF = { rain: 0, gulmohar: 1, peepal: 2, neem: 3, ashoka: 4, palm: 5, banyan: 6, mango: 7 };
const COLS = 4, ROWS = 2;

function hsl(h, s, l) { return `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`; }

// one leaf blade along +x from the origin (petiole end), length L, half-width W
function blade(ctx, L, W, shape, rng, col) {
  ctx.beginPath();
  if (shape === 'heart') {
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.05, -W * 1.25, L * 0.55, -W * 1.05, L * 0.78, -W * 0.25);
    ctx.quadraticCurveTo(L * 0.9, -W * 0.05, L, 0);
    ctx.quadraticCurveTo(L * 0.9, W * 0.05, L * 0.78, W * 0.25);
    ctx.bezierCurveTo(L * 0.55, W * 1.05, L * 0.05, W * 1.25, 0, 0);
  } else if (shape === 'lance' || shape === 'wavy') {
    ctx.moveTo(0, 0);
    const n = shape === 'wavy' ? 7 : 1;
    if (n === 1) {
      ctx.bezierCurveTo(L * 0.25, -W * 1.1, L * 0.7, -W * 0.9, L, 0);
      ctx.bezierCurveTo(L * 0.7, W * 0.9, L * 0.25, W * 1.1, 0, 0);
    } else {
      for (let k = 1; k <= n; k++) { const t = k / n; ctx.lineTo(L * t, -W * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 + 0.25 * (k % 2))); }
      for (let k = n; k >= 0; k--) { const t = k / n; ctx.lineTo(L * t, W * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 + 0.25 * ((k + 1) % 2))); }
    }
  } else if (shape === 'serrate') {
    ctx.moveTo(0, 0);
    const n = 9;
    for (let k = 1; k <= n; k++) { const t = k / n; const w = W * Math.sin(Math.PI * Math.pow(t, 0.8)); ctx.lineTo(L * (t - 0.05), -w * 1.15); ctx.lineTo(L * t, -w * 0.85); }
    for (let k = n; k >= 1; k--) { const t = k / n; const w = W * Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.85; ctx.lineTo(L * t, w); }
    ctx.closePath();
  } else { // oval / ellipse
    ctx.ellipse(L / 2, 0, L / 2, W, 0, 0, Math.PI * 2);
  }
  const g = ctx.createLinearGradient(0, -W, 0, W);
  g.addColorStop(0, col[0]); g.addColorStop(0.5, col[1]); g.addColorStop(1, col[2]);
  ctx.fillStyle = g;
  ctx.fill();
  if (L > 14) {   // midrib
    ctx.strokeStyle = col[3]; ctx.lineWidth = Math.max(0.6, W * 0.08);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.92, 0); ctx.stroke();
  }
}

function leafCols(rng, h, s, l) {
  const dh = rng.range(-5, 5), dl = rng.range(-0.06, 0.06), ds = rng.range(-0.06, 0.06);
  const H = h + dh, S = Math.max(0, Math.min(1, s + ds)), Lm = l + dl;
  return [hsl(H, S, Lm + 0.06), hsl(H + 2, S, Lm), hsl(H - 3, S * 0.95, Lm - 0.07), hsl(H + 6, S * 0.7, Lm + 0.12)];
}

function stem(ctx, pts, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.stroke();
}

// a curved twig from (x0,y0) heading `ang` (radians, 0 = up) with `n` points; returns the points
function twig(x0, y0, ang, len, bend, n = 8) {
  const pts = [[x0, y0]];
  let a = ang, x = x0, y = y0;
  for (let k = 1; k <= n; k++) { a += bend / n; x += Math.sin(a) * len / n; y -= Math.cos(a) * len / n; pts.push([x, y]); }
  return pts;
}
function along(pts, t) {
  const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
  const a = pts[i], b = pts[i + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[0] - a[0], -(b[1] - a[1]))];
}

// A leaf card is ~1.5–2 m of crown: a clump of a few twigs carrying leaves at real size (a 512 px
// cell is ~4 mm per pixel). Leaves deeper in the clump are drawn first and darker, the outer ones
// last and lighter, which gives each card some volume.
function clump(ctx, S, rng, o) {
  const leaves = [];
  const twigs = o.twigs;
  for (let t = 0; t < twigs; t++) {
    const ang = (t / Math.max(1, twigs - 1) - 0.5) * o.fan + rng.range(-0.15, 0.15);
    const main = twig(S / 2 + rng.range(-S * 0.03, S * 0.03), S * (0.98 - rng.range(0, 0.08)), ang, S * rng.range(o.len[0], o.len[1]), rng.range(-0.5, 0.5), 10);
    stem(ctx, main, S * o.stemW, o.stemC);
    const n = o.perTwig;
    for (let k = 0; k < n; k++) {
      const u = o.start + (1 - o.start) * Math.pow(k / n, 0.8);
      const [x, y, a] = along(main, u);
      const sd = rng.chance(0.5) ? 1 : -1;
      const la = a + sd * rng.range(o.spread[0], o.spread[1]) + (o.droop || 0);
      const L = S * rng.range(o.size[0], o.size[1]) * (o.grow ? 0.7 + 0.5 * u : 1);
      const off = o.petiole ? S * o.petiole : 0;
      leaves.push({ x: x + Math.sin(la) * off, y: y - Math.cos(la) * off, a: la, L, depth: Math.hypot(x - S / 2, y - S * 0.55) / S + rng.range(-0.1, 0.1), pet: off, px: x, py: y });
    }
  }
  // inner (near the clump centre) first
  leaves.sort((p, q) => p.depth - q.depth);
  for (const lf of leaves) {
    if (lf.pet) stem(ctx, [[lf.px, lf.py], [lf.x, lf.y]], S * 0.0035, o.stemC);
    const shade = Math.min(1, 0.45 + lf.depth * 1.3);
    ctx.save(); ctx.translate(lf.x, lf.y); ctx.rotate(lf.a - Math.PI / 2);
    const col = leafCols(rng, o.h, o.s, o.l * (0.72 + 0.38 * shade));
    blade(ctx, lf.L, lf.L * o.ratio, o.shape, rng, o.alt && rng.chance(o.alt.p) ? leafCols(rng, o.alt.h, o.alt.s, o.alt.l) : col);
    ctx.restore();
  }
}

const DRAW = {
  // rain tree: dense masses of small paired leaflets
  rain(ctx, S, rng) { clump(ctx, S, rng, { twigs: 9, fan: 2.6, len: [0.45, 0.62], stemW: 0.006, stemC: '#6a5d45', perTwig: 60, start: 0.1,
    spread: [0.9, 1.4], size: [0.03, 0.05], ratio: 0.42, shape: 'oval', h: 96, s: 0.42, l: 0.31, grow: true }); },
  // gulmohar: fine feathery fronds of tiny leaflets
  gulmohar(ctx, S, rng) { clump(ctx, S, rng, { twigs: 12, fan: 2.8, len: [0.5, 0.7], stemW: 0.004, stemC: '#7c7a3c', perTwig: 110, start: 0.05,
    spread: [1.1, 1.5], size: [0.016, 0.024], ratio: 0.3, shape: 'oval', h: 88, s: 0.5, l: 0.36 }); },
  // peepal: heart-shaped leaves with drip tips on long petioles (they flutter)
  peepal(ctx, S, rng) { clump(ctx, S, rng, { twigs: 7, fan: 2.4, len: [0.4, 0.58], stemW: 0.007, stemC: '#6b5a44', perTwig: 16, start: 0.2,
    spread: [0.4, 1.3], size: [0.08, 0.11], ratio: 0.42, shape: 'heart', petiole: 0.035, h: 92, s: 0.5, l: 0.34 }); },
  // neem: pinnate leaves of serrated falcate leaflets
  neem(ctx, S, rng) { clump(ctx, S, rng, { twigs: 10, fan: 2.8, len: [0.42, 0.62], stemW: 0.004, stemC: '#7a7a40', perTwig: 40, start: 0.12,
    spread: [0.8, 1.2], size: [0.05, 0.07], ratio: 0.22, shape: 'serrate', h: 100, s: 0.46, l: 0.31 }); },
  // ashoka: long narrow wavy leaves hanging off the twig
  ashoka(ctx, S, rng) { clump(ctx, S, rng, { twigs: 6, fan: 1.2, len: [0.55, 0.8], stemW: 0.006, stemC: '#5a4a38', perTwig: 22, start: 0.05,
    spread: [0.2, 0.6], droop: Math.PI * 0.85, size: [0.13, 0.19], ratio: 0.09, shape: 'wavy', h: 105, s: 0.5, l: 0.23 }); },
  // coconut frond laid horizontally: rachis along the middle, leaflets swept to the tip, drooping
  palm(ctx, S, rng) {
    const y0 = S * 0.5;
    stem(ctx, [[0, y0], [S, y0 + S * 0.02]], S * 0.016, '#a08a4a');
    for (let k = 0; k < 70; k++) {
      const t = k / 70, x = t * S * 0.98;
      const len = S * 0.47 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) * rng.range(0.85, 1.05);
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.translate(x, y0 + S * 0.02 * t); ctx.rotate(sd * (Math.PI / 2 - 0.55) + rng.range(-0.08, 0.08));
        blade(ctx, len, S * 0.011, 'lance', rng, leafCols(rng, 78, 0.45, 0.36 + rng.range(-0.05, 0.05))); ctx.restore();
      }
    }
  },
  // banyan: big glossy elliptic leaves
  banyan(ctx, S, rng) { clump(ctx, S, rng, { twigs: 8, fan: 2.6, len: [0.4, 0.6], stemW: 0.008, stemC: '#6b5d4c', perTwig: 20, start: 0.15,
    spread: [0.5, 1.2], size: [0.08, 0.11], ratio: 0.32, shape: 'oval', petiole: 0.015, h: 100, s: 0.48, l: 0.25 }); },
  // mango: whorls of long glossy leaves, the odd coppery new flush
  mango(ctx, S, rng) { clump(ctx, S, rng, { twigs: 9, fan: 2.8, len: [0.35, 0.55], stemW: 0.007, stemC: '#5d4b3a', perTwig: 22, start: 0.45,
    spread: [0.3, 1.6], size: [0.12, 0.16], ratio: 0.14, shape: 'lance', h: 115, s: 0.45, l: 0.22, alt: { p: 0.08, h: 18, s: 0.45, l: 0.35 } }); },
};

// the atlas painted ahead of time (tools/bake_leaves.mjs): raw RGBA, rows already flipped and bled
export function leafAtlasFrom(pre) {
  const tex = new THREE.DataTexture(pre.data, pre.w, pre.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.anisotropy = 4; tex.needsUpdate = true;
  return { tex, uv: (i) => ({ u0: (i % COLS) / COLS, v0: 1 - (Math.floor(i / COLS) + 1) / ROWS, su: 1 / COLS, sv: 1 / ROWS }) };
}
export function makeLeafAtlas(cell = 512) {
  const cv = document.createElement('canvas');
  cv.width = COLS * cell; cv.height = ROWS * cell;
  const ctx = cv.getContext('2d');
  const names = Object.keys(LEAF);
  for (const nm of names) {
    const i = LEAF[nm];
    const cx = (i % COLS) * cell, cy = Math.floor(i / COLS) * cell;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx, cy, cell, cell); ctx.clip();
    ctx.translate(cx, cy);
    DRAW[nm](ctx, cell, new RNG(4000 + i * 77));
    ctx.restore();
  }
  // bleed leaf colour into transparent texels so mipmaps don't go dark at the edges (done on raw
  // pixels: a canvas would drop the colour of fully transparent texels)
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const w = cv.width, h = cv.height;
  const d = new Uint8Array(img.data.buffer.slice(0));
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = d[i * 4 + 3] > 8 ? 1 : 0;
  for (let pass = 0; pass < 4; pass++) {
    const prev = filled.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (prev[i]) continue;
      // (neighbours inline: an array per texel made this the slowest part of the whole load)
      let r = 0, g = 0, b = 0, n = 0, q;
      q = i - 1; if (prev[q]) { r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; n++; }
      q = i + 1; if (prev[q]) { r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; n++; }
      q = i - w; if (prev[q]) { r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; n++; }
      q = i + w; if (prev[q]) { r += d[q * 4]; g += d[q * 4 + 1]; b += d[q * 4 + 2]; n++; }
      if (n) { d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n; filled[i] = 1; }
    }
  }
  // flip rows so v runs bottom-up like a canvas texture
  const out = new Uint8Array(d.length), row = w * 4;
  for (let y = 0; y < h; y++) out.set(d.subarray(y * row, (y + 1) * row), (h - 1 - y) * row);
  const tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return { tex, canvas: cv, uv: (i) => ({ u0: (i % COLS) / COLS, v0: 1 - (Math.floor(i / COLS) + 1) / ROWS, su: 1 / COLS, sv: 1 / ROWS }) };
}
