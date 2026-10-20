// Procedural textures: ground (asphalt, CC road, pavers, soil...), facades (Pune apartments,
// wadas, shops...), decals. Everything is drawn at load time, nothing is downloaded.
import * as THREE from 'three';
import { makeNoise, fbm, RNG, clamp, lerp } from '../core/util.js';

// ---------------------------------------------------------------- helpers
function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

// draw fn(ctx) with wrap-around so the tile stays seamless
function wrapDraw(ctx, size, x, y, w, h, fn) {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      if (x + ox + w < 0 || x + ox > size || y + oy + h < 0 || y + oy > size) continue;
      ctx.save(); ctx.translate(ox, oy); fn(ctx); ctx.restore();
    }
  }
}

function pixelPass(ctx, size, fn) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      fn(x, y, d, i);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- ground layers
export const G = {
  asphalt: 0, concrete: 1, pavers: 2, compound: 3, grass: 4, soil: 5, scrub: 6, plaza: 7,
  median: 8, kerb: 9, kerbpaint: 10, stone: 11, deck: 12, water: 13, tactile: 14, rail: 15,
};
// metres covered by one repeat of the layer (u along x, v along z)
export const G_SCALE = [7, 9, 2.4, 10, 8, 11, 10, 4.8, 5, 2, 1, 4, 6, 8, 1.2, 4];

function genAsphalt(ctx, S, rng, nz, nz2, worn = 0) {
  pixelPass(ctx, S, (x, y, d, i) => {
    const u = x / S, v = y / S;
    const big = fbm(nz, u * 4, v * 4, 4, 4);
    const fine = nz2(x * 0.9, y * 0.9, S * 0.9);
    let g = 84 + big * 34 + (fine - 0.5) * 24 + worn;
    // aggregate chips
    const h = nz2(x * 2.7 + 13, y * 2.7 + 7, S * 2.7);
    if (h > 0.83) g += (h - 0.83) * 260;
    if (h < 0.12) g -= 14;
    d[i] = g; d[i + 1] = g * 0.995; d[i + 2] = g * 1.01 + 2; d[i + 3] = 255;
  });
  // tar repair patch (slightly darker, irregular)
  {
    const cx = rng.range(0, S), cy = rng.range(0, S), r = rng.range(40, 90) * S / 512;
    const tone = rng.range(52, 66);
    const pts = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283; const rr = r * rng.range(0.6, 1.2); pts.push([cx + Math.cos(a) * rr * 1.4, cy + Math.sin(a) * rr]); }
    wrapDraw(ctx, S, cx - r * 1.5, cy - r * 1.5, r * 3, r * 3, (c) => {
      c.fillStyle = `rgba(${tone},${tone},${tone + 2},0.16)`;
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill();
    });
  }
  // cracks
  ctx.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    let x = rng.range(0, S), y = rng.range(0, S);
    let a = rng.range(0, Math.PI * 2);
    const n = rng.int(8, 26);
    const pts = [[x, y]];
    for (let j = 0; j < n; j++) {
      a += rng.range(-0.7, 0.7);
      x += Math.cos(a) * 7 * S / 512; y += Math.sin(a) * 7 * S / 512;
      pts.push([x, y]);
    }
    wrapDraw(ctx, S, Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), 200, 200, (c) => {
      c.strokeStyle = 'rgba(18,18,20,0.55)'; c.lineWidth = rng.range(0.8, 1.8) * S / 512;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) c.lineTo(p[0], p[1]);
      c.stroke();
    });
  }
  // oil spots
  for (let k = 0; k < 5; k++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(6, 22) * S / 512;
    wrapDraw(ctx, S, x - r, y - r, 2 * r, 2 * r, (c) => {
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(10,10,12,0.45)'); gr.addColorStop(1, 'rgba(10,10,12,0)');
      c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    });
  }
}

function genConcrete(ctx, S, rng, nz, nz2) {
  pixelPass(ctx, S, (x, y, d, i) => {
    const u = x / S, v = y / S;
    const big = fbm(nz, u * 3, v * 3, 4, 3);
    const fine = nz2(x * 1.3, y * 1.3, S * 1.3);
    // transverse brush grooves
    const groove = Math.sin(y * 1.9 + nz(u * 8, v * 8, 8) * 3) * 4;
    let g = 150 + big * 34 + (fine - 0.5) * 18 + groove;
    // tyre darkening bands along u (vehicles drive along x in tile space? both) -> blotches
    const tyre = fbm(nz, u * 2 + 7, v * 6, 2, 2);
    g -= Math.max(0, tyre - 0.55) * 90;
    d[i] = g * 0.98; d[i + 1] = g * 0.975; d[i + 2] = g * 0.955; d[i + 3] = 255;
  });
  // panel joints every half tile
  ctx.strokeStyle = 'rgba(40,38,35,0.75)'; ctx.lineWidth = 2 * S / 512;
  for (const p of [0, S / 2]) {
    ctx.beginPath(); ctx.moveTo(p + 0.5, 0); ctx.lineTo(p + 0.5, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p + 0.5); ctx.lineTo(S, p + 0.5); ctx.stroke();
  }
  // cracks + stains
  for (let k = 0; k < 4; k++) {
    let x = rng.range(0, S), y = rng.range(0, S), a = rng.range(0, 6.28);
    ctx.strokeStyle = 'rgba(55,52,48,0.6)'; ctx.lineWidth = 1.2 * S / 512;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 14; j++) { a += rng.range(-0.6, 0.6); x += Math.cos(a) * 8; y += Math.sin(a) * 8; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let k = 0; k < 6; k++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(10, 40) * S / 512;
    wrapDraw(ctx, S, x - r, y - r, 2 * r, 2 * r, (c) => {
      const gr = c.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(70,62,50,0.35)'); gr.addColorStop(1, 'rgba(70,62,50,0)');
      c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    });
  }
}

function genPavers(ctx, S, rng, nz, nz2) {
  ctx.fillStyle = rgb(92, 86, 78); ctx.fillRect(0, 0, S, S);
  const cols = 12, rows = 24;            // 200 x 100 mm pavers in a 2.4 m tile
  const pw = S / cols, ph = S / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * pw / 2;
    for (let c = -1; c < cols + 1; c++) {
      const x = c * pw + off, y = r * ph;
      const t = rng.next();
      let base;
      // FC Road style: grey pavers with a reddish band now and then
      const band = (r % 12) < 2;
      if (band) base = [146, 104, 88];
      else if (t < 0.04) base = [150, 120, 100];
      else { const g = 148 + rng.range(-8, 8); base = [g, g - 3, g - 8]; }
      const k = rng.range(0.9, 1.04);
      if (rng.next() < 0.015) continue;            // missing paver: sand shows
      ctx.fillStyle = rgb(base[0] * k, base[1] * k, base[2] * k);
      const g = 1.6 * S / 512;
      ctx.beginPath();
      ctx.roundRect(x + g, y + g, pw - 2 * g, ph - 2 * g, 2.5 * S / 512);
      ctx.fill();
    }
  }
  // grime / dust
  pixelPass(ctx, S, (x, y, d, i) => {
    const u = x / S, v = y / S;
    const n = fbm(nz, u * 3, v * 3, 4, 3);
    const f = nz2(x * 1.7, y * 1.7, S * 1.7);
    const k = 0.72 + n * 0.42 + (f - 0.5) * 0.12;
    d[i] *= k; d[i + 1] *= k * 0.99; d[i + 2] *= k * 0.96;
  });
}

function genEarth(ctx, S, rng, nz, nz2, pal) {
  pixelPass(ctx, S, (x, y, d, i) => {
    const u = x / S, v = y / S;
    const a = fbm(nz, u * 4, v * 4, 5, 4);
    const b = fbm(nz, u * 9 + 3, v * 9 + 7, 3, 9);
    const f = nz2(x * 1.4, y * 1.4, S * 1.4);
    const m = clamp((a - pal.split) * 4 + 0.5, 0, 1);
    const c0 = pal.a, c1 = pal.b;
    let r = lerp(c0[0], c1[0], m), g = lerp(c0[1], c1[1], m), bl = lerp(c0[2], c1[2], m);
    const k = 0.8 + b * 0.35 + (f - 0.5) * pal.grain;
    // small stones
    const h = nz2(x * 3.1 + 5, y * 3.1 + 1, S * 3.1);
    const st = h > 0.86 ? 1.25 : 1;
    d[i] = r * k * st; d[i + 1] = g * k * st; d[i + 2] = bl * k * st; d[i + 3] = 255;
  });
  if (pal.blades) {
    // grass blade strokes
    for (let k = 0; k < pal.blades; k++) {
      const x = rng.range(0, S), y = rng.range(0, S);
      const l = rng.range(3, 9) * S / 512, a = -Math.PI / 2 + rng.range(-0.7, 0.7);
      const t = rng.next();
      ctx.strokeStyle = t < 0.6 ? `rgba(${pal.blade[0]},${pal.blade[1]},${pal.blade[2]},0.5)` : 'rgba(40,60,20,0.35)';
      ctx.lineWidth = 1 * S / 512;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  }
  if (pal.leaves) {
    for (let k = 0; k < pal.leaves; k++) {
      const x = rng.range(0, S), y = rng.range(0, S);
      ctx.fillStyle = rng.pick(['rgba(120,90,40,0.7)', 'rgba(150,110,50,0.6)', 'rgba(90,70,40,0.6)', 'rgba(110,120,50,0.5)']);
      ctx.beginPath(); ctx.ellipse(x, y, 3 * S / 512, 1.6 * S / 512, rng.range(0, 3), 0, 6.28); ctx.fill();
    }
  }
  if (pal.slabs) {
    for (let k = 0; k < pal.slabs; k++) {
      const x = rng.range(0, S), y = rng.range(0, S), w = rng.range(30, 80) * S / 512;
      const t = rng.range(120, 170);
      wrapDraw(ctx, S, x, y, w, w, (c) => {
        c.fillStyle = rgb(t, t * 0.97, t * 0.92);
        c.globalAlpha = 0.85;
        c.fillRect(x, y, w, w * rng.range(0.6, 1.2));
        c.globalAlpha = 1;
      });
    }
  }
}

function genPlaza(ctx, S, rng, nz, nz2) {
  ctx.fillStyle = rgb(120, 118, 112); ctx.fillRect(0, 0, S, S);
  const n = 8, w = S / n;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const t = rng.range(150, 182);
    ctx.fillStyle = rgb(t, t * 0.985, t * 0.95);
    ctx.fillRect(c * w + 1.5, r * w + 1.5, w - 3, w - 3);
  }
  pixelPass(ctx, S, (x, y, d, i) => {
    const k = 0.78 + fbm(nz, x / S * 3, y / S * 3, 4, 3) * 0.36 + (nz2(x * 1.5, y * 1.5, S * 1.5) - 0.5) * 0.1;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  });
}

function genKerb(ctx, S, rng, nz, nz2, painted) {
  pixelPass(ctx, S, (x, y, d, i) => {
    const u = x / S, v = y / S;
    let r, g, b;
    if (painted) {
      // black/yellow halves along u with chipped paint
      const yellow = (u % 1) < 0.5;
      const chip = fbm(nz, u * 10, v * 6, 4, 10) > 0.68;
      if (chip) { r = 150; g = 146; b = 138; }
      else if (yellow) { r = 226; g = 182; b = 40; }
      else { r = 30; g = 30; b = 32; }
    } else { r = 168; g = 164; b = 156; }
    const k = 0.8 + fbm(nz, u * 6 + 3, v * 3, 4, 6) * 0.3 + (nz2(x * 1.6, y * 1.6, S * 1.6) - 0.5) * 0.1;
    // dirt creeping up from the road at the bottom of the face (v=0 bottom)
    const dirt = 1 - clamp((v - 0.0) * 2.2, 0, 1) * 0.0 - (1 - clamp(v * 3, 0, 1)) * 0.25;
    d[i] = r * k * dirt; d[i + 1] = g * k * dirt; d[i + 2] = b * k * dirt; d[i + 3] = 255;
  });
}

function genStone(ctx, S, rng, nz, nz2) {
  ctx.fillStyle = rgb(118, 112, 104); ctx.fillRect(0, 0, S, S);
  let y = 0;
  while (y < S) {
    const h = rng.range(26, 46) * S / 512;
    let x = rng.range(-40, 0);
    while (x < S) {
      const w = rng.range(40, 90) * S / 512;
      const t = rng.range(46, 78);
      ctx.fillStyle = rgb(t, t * 0.97, t * 0.95);
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 5 * S / 512);
      ctx.fill();
      x += w;
    }
    y += h;
  }
  pixelPass(ctx, S, (x, y, d, i) => {
    const u = x / S, v = y / S;
    const k = 0.75 + fbm(nz, u * 5, v * 5, 4, 5) * 0.45;
    const moss = clamp((fbm(nz, u * 3 + 9, v * 2, 3, 3) - 0.55) * 3, 0, 1) * (v);
    d[i] = (d[i] * k) * (1 - moss) + 60 * moss;
    d[i + 1] = (d[i + 1] * k) * (1 - moss) + 72 * moss;
    d[i + 2] = (d[i + 2] * k) * (1 - moss) + 40 * moss;
  });
}

function genDeck(ctx, S, rng, nz, nz2) {
  pixelPass(ctx, S, (x, y, d, i) => {
    const u = x / S, v = y / S;
    let g = 150 + fbm(nz, u * 3, v * 3, 4, 3) * 40 + (nz2(x, y, S) - 0.5) * 16;
    // vertical rain streaks
    const streak = fbm(nz, u * 24, v * 1.5, 2, 24);
    g -= Math.max(0, streak - 0.5) * 120 * (0.4 + v * 0.6);
    d[i] = g; d[i + 1] = g * 0.99; d[i + 2] = g * 0.97; d[i + 3] = 255;
  });
  ctx.strokeStyle = 'rgba(60,60,60,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, S * 0.5); ctx.lineTo(S, S * 0.5); ctx.stroke();
}

function genTactile(ctx, S, rng, nz, nz2) {
  ctx.fillStyle = rgb(196, 160, 40); ctx.fillRect(0, 0, S, S);
  const n = 4, w = S / n;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    ctx.strokeStyle = 'rgba(90,70,20,0.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(c * w + 1, r * w + 1, w - 2, w - 2);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      ctx.fillStyle = 'rgba(230,200,80,1)';
      ctx.beginPath(); ctx.arc(c * w + (a + 0.5) * w / 4, r * w + (b + 0.5) * w / 4, w / 16, 0, 6.28); ctx.fill();
    }
  }
  pixelPass(ctx, S, (x, y, d, i) => {
    const k = 0.7 + fbm(nz, x / S * 3, y / S * 3, 3, 3) * 0.35;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  });
}

function genRail(ctx, S, rng, nz, nz2) {
  // ballast + sleepers (used for the railway strip near Shivajinagar)
  genEarth(ctx, S, rng, nz, nz2, { a: [110, 104, 96], b: [80, 76, 72], split: 0.5, grain: 0.5 });
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = rgb(70, 66, 60);
    ctx.fillRect(k * S / 8 + 4, S * 0.12, S / 16, S * 0.76);
  }
}

export function makeGroundTexture(renderer, size = 512) {
  const S = size;
  const layers = 16;
  const data = new Uint8Array(S * S * 4 * layers);
  const c = cv(S, S);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const gens = [
    (r, a, b) => genAsphalt(ctx, S, r, a, b),
    (r, a, b) => genConcrete(ctx, S, r, a, b),
    (r, a, b) => genPavers(ctx, S, r, a, b),
    (r, a, b) => genEarth(ctx, S, r, a, b, { a: [150, 128, 98], b: [118, 104, 84], split: 0.5, grain: 0.3, leaves: 90, slabs: 2 }),
    (r, a, b) => genEarth(ctx, S, r, a, b, { a: [88, 118, 52], b: [124, 128, 66], split: 0.55, grain: 0.35, blades: 2600, blade: [120, 150, 60] }),
    (r, a, b) => genEarth(ctx, S, r, a, b, { a: [150, 86, 56], b: [128, 78, 52], split: 0.5, grain: 0.35 }),
    (r, a, b) => genEarth(ctx, S, r, a, b, { a: [132, 120, 76], b: [102, 112, 58], split: 0.5, grain: 0.4, blades: 1500, blade: [150, 140, 80], leaves: 60 }),
    (r, a, b) => genPlaza(ctx, S, r, a, b),
    (r, a, b) => genEarth(ctx, S, r, a, b, { a: [96, 120, 56], b: [130, 112, 80], split: 0.45, grain: 0.35, blades: 1800, blade: [110, 140, 60] }),
    (r, a, b) => genKerb(ctx, S, r, a, b, false),
    (r, a, b) => genKerb(ctx, S, r, a, b, true),
    (r, a, b) => genStone(ctx, S, r, a, b),
    (r, a, b) => genDeck(ctx, S, r, a, b),
    (r, a, b) => genEarth(ctx, S, r, a, b, { a: [70, 76, 60], b: [60, 66, 52], split: 0.5, grain: 0.2 }),
    (r, a, b) => genTactile(ctx, S, r, a, b),
    (r, a, b) => genRail(ctx, S, r, a, b),
  ];
  for (let L = 0; L < layers; L++) {
    ctx.clearRect(0, 0, S, S);
    const rng = new RNG(1000 + L * 77);
    const nz = makeNoise(31 + L, 64);
    const nz2 = makeNoise(97 + L * 3, S * 4);
    gens[L](rng, nz, nz2);
    const img = ctx.getImageData(0, 0, S, S).data;
    data.set(img, L * S * S * 4);
  }
  const tex = new THREE.DataArrayTexture(data, S, S, layers);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- facade tiles
// Each tile = one bay (about 3 m wide) x one floor (3.1 m). RGB = colour, A = material class:
// 255 paint (gets the building tint), ~128 window glass (reflects sky, lit at night), 0 other.
export const F = {};
const FACADE_LIST = [];
function defTile(name, fn) { F[name] = FACADE_LIST.length; FACADE_LIST.push(fn); }

// dual canvas drawing: colour + class mask
class Painter {
  constructor(S) {
    this.S = S;
    this.c = cv(S, S); this.x = this.c.getContext('2d', { willReadFrequently: true });
    this.m = cv(S, S); this.mx = this.m.getContext('2d', { willReadFrequently: true });
  }
  clear() { this.x.clearRect(0, 0, this.S, this.S); this.mx.fillStyle = '#000'; this.mx.fillRect(0, 0, this.S, this.S); }
  // u,v in metres of a 3.0 x 3.1 bay; y measured from TOP of tile in metres
  px(m) { return m / 3.0 * this.S; }
  py(m) { return m / 3.1 * this.S; }
  rect(x, y, w, h, color, cls) {
    const X = this.px(x), Y = this.py(y), W = this.px(w), H = this.py(h);
    this.x.fillStyle = color; this.x.fillRect(X, Y, W, H);
    if (cls !== undefined) { this.mx.fillStyle = `rgb(${cls},${cls},${cls})`; this.mx.fillRect(X, Y, W, H); }
  }
  grad(x, y, w, h, c0, c1, cls, horizontal = false) {
    const X = this.px(x), Y = this.py(y), W = this.px(w), H = this.py(h);
    const g = horizontal ? this.x.createLinearGradient(X, 0, X + W, 0) : this.x.createLinearGradient(0, Y, 0, Y + H);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    this.x.fillStyle = g; this.x.fillRect(X, Y, W, H);
    if (cls !== undefined) { this.mx.fillStyle = `rgb(${cls},${cls},${cls})`; this.mx.fillRect(X, Y, W, H); }
  }
  line(x0, y0, x1, y1, color, width, cls) {
    this.x.strokeStyle = color; this.x.lineWidth = this.px(width);
    this.x.beginPath(); this.x.moveTo(this.px(x0), this.py(y0)); this.x.lineTo(this.px(x1), this.py(y1)); this.x.stroke();
    if (cls !== undefined) {
      this.mx.strokeStyle = `rgb(${cls},${cls},${cls})`; this.mx.lineWidth = this.px(width);
      this.mx.beginPath(); this.mx.moveTo(this.px(x0), this.py(y0)); this.mx.lineTo(this.px(x1), this.py(y1)); this.mx.stroke();
    }
  }
  data() {
    const a = this.x.getImageData(0, 0, this.S, this.S).data;
    const m = this.mx.getImageData(0, 0, this.S, this.S).data;
    for (let i = 0; i < a.length; i += 4) a[i + 3] = m[i];
    return a;
  }
}

const WALL = 'rgb(236,232,224)';
function wallBase(P, rng, nz, opts = {}) {
  // light neutral plaster (tinted in shader) with weathering
  P.rect(0, 0, 3, 3.1, WALL, 255);
  const S = P.S;
  const img = P.x.getImageData(0, 0, S, S);
  const d = img.data;
  const streaks = opts.streaks ?? 1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const u = x / S, v = y / S;
    const blot = fbm(nz, u * 3, v * 3, 4, 3);
    const st = fbm(nz, u * 18 + 5, v * 1.2, 3, 18);      // vertical monsoon streaks
    const k = 0.86 + blot * 0.2 - Math.max(0, st - 0.52) * 0.9 * streaks * (0.5 + v * 0.7)
      + (nz(x * 0.9, y * 0.9, S * 0.9) - 0.5) * 0.06;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k * 0.98;
  }
  P.x.putImageData(img, 0, 0);
}
function stain(P, x, y, w, h, a = 0.35) {
  // dark drip below a sill / chhajja
  const X = P.px(x), Y = P.py(y), W = P.px(w), H = P.py(h);
  const g = P.x.createLinearGradient(0, Y, 0, Y + H);
  g.addColorStop(0, `rgba(40,42,40,${a})`); g.addColorStop(1, 'rgba(40,42,40,0)');
  P.x.fillStyle = g; P.x.fillRect(X, Y, W, H);
}
function glass(P, x, y, w, h, rng, curtain = true) {
  P.grad(x, y, w, h, 'rgb(98,116,132)', 'rgb(38,44,52)', 128);
  // reflection band
  P.x.fillStyle = 'rgba(200,215,230,0.18)';
  P.x.beginPath();
  P.x.moveTo(P.px(x + w * 0.15), P.py(y)); P.x.lineTo(P.px(x + w * 0.4), P.py(y));
  P.x.lineTo(P.px(x + w * 0.1), P.py(y + h)); P.x.lineTo(P.px(x - w * 0.15), P.py(y + h)); P.x.closePath(); P.x.fill();
  if (curtain && rng.chance(0.55)) {
    const cc = rng.pick(['rgb(150,60,60)', 'rgb(200,170,90)', 'rgb(90,110,150)', 'rgb(180,120,150)', 'rgb(220,210,190)', 'rgb(110,140,90)']);
    const cw = w * rng.range(0.25, 0.5);
    const side = rng.chance(0.5);
    P.rect(side ? x : x + w - cw, y, cw, h, cc, 110);
    P.x.fillStyle = 'rgba(0,0,0,0.18)';
    for (let k = 0; k < 4; k++) P.x.fillRect(P.px((side ? x : x + w - cw) + cw * k / 4), P.py(y), 2, P.py(h));
  }
}
function frame(P, x, y, w, h, color = 'rgb(170,172,170)', t = 0.05) {
  P.rect(x, y, w, t, color, 0); P.rect(x, y + h - t, w, t, color, 0);
  P.rect(x, y, t, h, color, 0); P.rect(x + w - t, y, t, h, color, 0);
  P.rect(x + w / 2 - t / 2, y, t, h, color, 0);
}
function grill(P, x, y, w, h, rng, style) {
  const col = rng.pick(['rgb(40,40,42)', 'rgb(30,60,50)', 'rgb(200,200,195)', 'rgb(90,70,50)', 'rgb(60,60,90)']);
  const t = 0.022;
  P.rect(x - 0.04, y - 0.04, w + 0.08, t * 2, col, 0); P.rect(x - 0.04, y + h + 0.02, w + 0.08, t * 2, col, 0);
  P.rect(x - 0.04, y - 0.04, t * 2, h + 0.08, col, 0); P.rect(x + w - 0.0, y - 0.04, t * 2, h + 0.08, col, 0);
  if (style === 0) {
    for (let k = 1; k < 8; k++) P.rect(x + w * k / 8 - t / 2, y, t, h, col, 0);
    for (let k = 1; k < 4; k++) P.rect(x, y + h * k / 4 - t / 2, w, t, col, 0);
  } else if (style === 1) {
    for (let k = 1; k < 10; k++) P.rect(x + w * k / 10 - t / 2, y, t, h, col, 0);
    // decorative waves
    P.x.strokeStyle = col; P.x.lineWidth = P.px(t);
    for (let k = 0; k < 3; k++) {
      P.x.beginPath();
      for (let s = 0; s <= 20; s++) {
        const xx = x + w * s / 20, yy = y + h * (k + 0.5) / 3 + Math.sin(s * 1.2) * 0.06;
        s ? P.x.lineTo(P.px(xx), P.py(yy)) : P.x.moveTo(P.px(xx), P.py(yy));
      }
      P.x.stroke();
    }
  } else {
    // diamond lattice (clipped to the window)
    P.x.save();
    P.x.beginPath(); P.x.rect(P.px(x), P.py(y), P.px(w), P.py(h)); P.x.clip();
    P.x.strokeStyle = col; P.x.lineWidth = P.px(t);
    const n = 6;
    for (let k = -n; k <= n * 2; k++) {
      P.x.beginPath(); P.x.moveTo(P.px(x + k * w / n), P.py(y)); P.x.lineTo(P.px(x + k * w / n + h), P.py(y + h)); P.x.stroke();
      P.x.beginPath(); P.x.moveTo(P.px(x + k * w / n), P.py(y)); P.x.lineTo(P.px(x + k * w / n - h), P.py(y + h)); P.x.stroke();
    }
    P.x.restore();
  }
}
function chhajja(P, x, y, w) {
  P.rect(x - 0.15, y - 0.09, w + 0.3, 0.09, 'rgb(225,221,212)', 255);
  P.rect(x - 0.15, y - 0.012, w + 0.3, 0.012, 'rgb(150,148,140)', 255);
  stain(P, x - 0.15, y, w + 0.3, 0.35, 0.45);
}
function sill(P, x, y, w) {
  P.rect(x - 0.05, y, w + 0.1, 0.05, 'rgb(210,206,198)', 255);
  stain(P, x, y + 0.05, w, 0.7, 0.28);
}
function acUnit(P, x, y) {
  P.rect(x, y, 0.8, 0.55, 'rgb(214,214,208)', 0);
  P.x.fillStyle = 'rgba(80,80,80,0.6)';
  for (let k = 0; k < 6; k++) P.x.fillRect(P.px(x + 0.08), P.py(y + 0.08 + k * 0.07), P.px(0.45), 1.5);
  P.x.strokeStyle = 'rgba(60,60,60,0.8)'; P.x.lineWidth = 2;
  P.x.beginPath(); P.x.arc(P.px(x + 0.62), P.py(y + 0.27), P.px(0.13), 0, 6.28); P.x.stroke();
  stain(P, x + 0.2, y + 0.55, 0.3, 0.5, 0.3);
}
function pipe(P, x, rng) {
  const col = rng.pick(['rgb(90,90,90)', 'rgb(210,205,195)', 'rgb(60,60,60)']);
  P.rect(x, 0, 0.09, 3.1, col, 0);
  P.rect(x - 0.02, 1.2, 0.13, 0.05, col, 0);
  stain(P, x - 0.1, 0, 0.3, 3.1, 0.12);
}
function clothes(P, x, y, w, rng) {
  P.line(x, y, x + w, y + 0.02, 'rgb(60,60,60)', 0.01, 0);
  let cx = x + 0.05;
  while (cx < x + w - 0.2) {
    const cw = rng.range(0.15, 0.42), ch = rng.range(0.3, 0.75);
    P.rect(cx, y + 0.01, cw, ch, rng.pick(['rgb(190,40,60)', 'rgb(40,90,160)', 'rgb(230,200,60)', 'rgb(240,240,235)',
      'rgb(70,140,90)', 'rgb(160,60,140)', 'rgb(230,120,40)', 'rgb(40,40,60)']), 0);
    cx += cw + rng.range(0.03, 0.12);
  }
}
function plants(P, x, y, w, rng) {
  for (let k = 0; k < 4; k++) {
    const px = x + w * (k + 0.5) / 4;
    P.rect(px - 0.09, y - 0.18, 0.18, 0.18, 'rgb(150,80,50)', 0);
    P.x.fillStyle = rng.pick(['rgb(50,110,50)', 'rgb(70,130,60)', 'rgb(40,90,40)']);
    P.x.beginPath(); P.x.arc(P.px(px), P.py(y - 0.28), P.px(0.16), 0, 6.28); P.x.fill();
  }
}
function railing(P, x, y, w, h, rng, kind) {
  const col = rng.pick(['rgb(40,40,40)', 'rgb(220,220,215)', 'rgb(60,90,80)']);
  if (kind === 0) {
    // concrete parapet with jaali cutouts
    P.rect(x, y, w, h, 'rgb(230,226,218)', 255);
    for (let k = 0; k < 6; k++) P.rect(x + 0.15 + k * (w - 0.3) / 6, y + 0.18, (w - 0.3) / 6 - 0.08, h - 0.36, 'rgb(30,30,32)', 0);
  } else {
    P.rect(x, y, w, 0.05, col, 0);
    for (let k = 0; k <= 14; k++) P.rect(x + k * w / 14, y, 0.025, h, col, 0);
    P.rect(x, y + h - 0.05, w, 0.05, col, 0);
  }
}

// --- apartment residential floors
for (let variant = 0; variant < 6; variant++) {
  defTile('apt' + variant, (P, rng, nz) => {
    wallBase(P, rng, nz);
    const wx = 0.75, ww = 1.5, wy = 0.95, wh = 1.3;
    if (variant === 3 || variant === 5) {
      // balcony: dark recess with railing, clothes, plants
      P.grad(0.35, 0.45, 2.3, 2.15, 'rgb(48,46,44)', 'rgb(70,66,62)', 0);
      glass(P, 0.6, 0.75, 1.0, 1.75, rng);
      P.rect(1.75, 0.75, 0.7, 1.85, 'rgb(120,90,60)', 0); // door
      if (rng.chance(0.7)) clothes(P, 0.45, 0.55, 2.1, rng);
      railing(P, 0.35, 1.75, 2.3, 0.85, rng, variant === 3 ? 0 : 1);
      if (variant === 5) plants(P, 0.5, 1.75, 2.0, rng);
      chhajja(P, 0.35, 0.45, 2.3);
      P.rect(0.32, 2.6, 2.36, 0.06, 'rgb(225,221,212)', 255);
      stain(P, 0.35, 2.66, 2.3, 0.4, 0.4);
      return;
    }
    glass(P, wx, wy, ww, wh, rng);
    frame(P, wx, wy, ww, wh);
    grill(P, wx, wy, ww, wh, rng, variant % 3);
    chhajja(P, wx, wy - 0.25, ww);
    sill(P, wx, wy + wh, ww);
    if (variant === 1) acUnit(P, 2.25, 1.7);
    if (variant === 2) { clothes(P, wx + 0.05, wy + 0.05, ww - 0.1, rng); }
    if (variant === 4) { pipe(P, 2.6, rng); P.rect(0.15, 1.05, 0.4, 0.5, 'rgb(40,46,52)', 128); grill(P, 0.15, 1.05, 0.4, 0.5, rng, 0); }
    // slab line between floors
    P.rect(0, 3.02, 3, 0.08, 'rgb(220,216,208)', 255);
  });
}
// --- side walls (few small windows, pipes)
for (let variant = 0; variant < 2; variant++) {
  defTile('side' + variant, (P, rng, nz) => {
    wallBase(P, rng, nz, { streaks: 1.4 });
    if (variant === 0) {
      P.rect(1.2, 1.2, 0.55, 0.55, 'rgb(40,44,50)', 128); grill(P, 1.2, 1.2, 0.55, 0.55, rng, 0);
      stain(P, 1.2, 1.75, 0.55, 0.8, 0.3);
    } else {
      pipe(P, 0.6, rng); pipe(P, 0.75, rng);
      P.rect(2.0, 0.9, 0.35, 0.35, 'rgb(40,44,50)', 128);
    }
    P.rect(0, 3.04, 3, 0.06, 'rgb(215,211,203)', 255);
  });
}
// --- commercial upper floors
for (let variant = 0; variant < 3; variant++) {
  defTile('com' + variant, (P, rng, nz) => {
    wallBase(P, rng, nz, { streaks: 0.8 });
    if (variant === 0) {
      glass(P, 0.25, 0.7, 2.5, 1.7, rng, false);
      for (let k = 0; k <= 4; k++) P.rect(0.25 + k * 2.5 / 4 - 0.025, 0.7, 0.05, 1.7, 'rgb(150,150,150)', 0);
      chhajja(P, 0.25, 0.45, 2.5);
    } else if (variant === 1) {
      glass(P, 0.5, 0.9, 2.0, 1.4, rng);
      frame(P, 0.5, 0.9, 2.0, 1.4, 'rgb(120,120,125)');
      P.rect(0, 0.2, 3, 0.35, 'rgb(205,200,190)', 255);
    } else {
      // vertical fins
      glass(P, 0.3, 0.4, 2.4, 2.3, rng, false);
      for (let k = 0; k < 4; k++) P.rect(0.3 + k * 0.8, 0.4, 0.14, 2.3, 'rgb(228,224,216)', 255);
    }
    P.rect(0, 3.0, 3, 0.1, 'rgb(220,216,208)', 255);
  });
}
// --- glass curtain wall
for (let variant = 0; variant < 2; variant++) {
  defTile('glass' + variant, (P, rng, nz) => {
    const top = variant ? 'rgb(120,150,160)' : 'rgb(110,140,170)';
    const bot = variant ? 'rgb(40,70,74)' : 'rgb(30,50,80)';
    P.grad(0, 0, 3, 3.1, top, bot, 128);
    for (let k = 0; k <= 2; k++) P.rect(k * 1.5 - 0.03, 0, 0.06, 3.1, 'rgb(170,175,180)', 0);
    P.rect(0, 2.85, 3, 0.25, 'rgb(170,175,180)', 0);
    P.rect(0, 1.0, 3, 0.04, 'rgb(150,155,160)', 0);
  });
}
// --- old wada / peth floors
for (let variant = 0; variant < 3; variant++) {
  defTile('old' + variant, (P, rng, nz) => {
    wallBase(P, rng, nz, { streaks: 1.8 });
    // exposed brick patches
    if (rng.chance(0.7)) {
      const bx = rng.range(0, 2), by = rng.range(0.3, 2.2);
      P.rect(bx, by, 0.7, 0.4, 'rgb(150,80,60)', 0);
      P.x.strokeStyle = 'rgba(200,180,160,0.5)'; P.x.lineWidth = 1;
      for (let k = 0; k < 5; k++) { P.x.beginPath(); P.x.moveTo(P.px(bx), P.py(by + k * 0.08)); P.x.lineTo(P.px(bx + 0.7), P.py(by + k * 0.08)); P.x.stroke(); }
    }
    const wood = rng.pick(['rgb(90,60,40)', 'rgb(70,90,80)', 'rgb(60,70,110)', 'rgb(110,70,50)']);
    if (variant === 2) {
      // wooden sajja balcony
      P.rect(0.1, 1.55, 2.8, 1.0, 'rgb(60,40,30)', 0);
      for (let k = 0; k <= 12; k++) P.rect(0.1 + k * 2.8 / 12, 1.55, 0.05, 1.0, wood, 0);
      P.rect(0.05, 1.5, 2.9, 0.08, wood, 0);
      P.grad(0.4, 0.4, 2.2, 1.1, 'rgb(50,40,34)', 'rgb(30,26,24)', 128);
      P.rect(0.05, 0.25, 2.9, 0.12, 'rgb(150,90,60)', 0);  // tiled eave
    } else {
      // arched wooden window with shutters
      const x = 0.95, w = 1.1, y = 0.85, h = 1.45;
      P.x.fillStyle = wood;
      P.x.beginPath();
      P.x.moveTo(P.px(x - 0.1), P.py(y + h)); P.x.lineTo(P.px(x - 0.1), P.py(y + 0.3));
      P.x.quadraticCurveTo(P.px(x + w / 2), P.py(y - 0.35), P.px(x + w + 0.1), P.py(y + 0.3));
      P.x.lineTo(P.px(x + w + 0.1), P.py(y + h)); P.x.closePath(); P.x.fill();
      glass(P, x, y + 0.25, w, h - 0.3, rng);
      if (variant === 1) {
        P.rect(x - 0.45, y + 0.25, 0.42, h - 0.3, wood, 0);
        P.rect(x + w + 0.03, y + 0.25, 0.42, h - 0.3, wood, 0);
      }
      grill(P, x, y + 0.3, w, h - 0.35, rng, 0);
      sill(P, x - 0.1, y + h, w + 0.2);
    }
    P.rect(0, 3.0, 3, 0.1, 'rgb(205,198,186)', 255);
  });
}
// --- bungalow floors
for (let variant = 0; variant < 2; variant++) {
  defTile('bung' + variant, (P, rng, nz) => {
    wallBase(P, rng, nz, { streaks: 0.6 });
    const wood = rng.pick(['rgb(110,70,40)', 'rgb(240,240,235)', 'rgb(80,100,90)']);
    const x = 0.6, w = 1.8, y = 0.8, h = 1.5;
    P.rect(x - 0.08, y - 0.08, w + 0.16, h + 0.16, wood, 0);
    glass(P, x, y, w, h, rng);
    for (let k = 1; k < 3; k++) P.rect(x + w * k / 3 - 0.03, y, 0.06, h, wood, 0);
    P.rect(x, y + h * 0.35, w, 0.05, wood, 0);
    if (variant === 1) grill(P, x, y, w, h, rng, 1);
    // sloped chhajja
    P.x.fillStyle = 'rgb(160,90,60)';
    P.x.beginPath(); P.x.moveTo(P.px(x - 0.25), P.py(y - 0.08)); P.x.lineTo(P.px(x + w + 0.25), P.py(y - 0.08));
    P.x.lineTo(P.px(x + w + 0.1), P.py(y - 0.3)); P.x.lineTo(P.px(x - 0.1), P.py(y - 0.3)); P.x.closePath(); P.x.fill();
    stain(P, x - 0.2, y - 0.08, w + 0.4, 0.25, 0.35);
    sill(P, x, y + h, w);
  });
}
// --- institutional (college corridors)
for (let variant = 0; variant < 2; variant++) {
  defTile('inst' + variant, (P, rng, nz) => {
    wallBase(P, rng, nz, { streaks: 1.0 });
    if (variant === 0) {
      P.grad(0, 0.55, 3, 2.2, 'rgb(70,66,62)', 'rgb(92,88,82)', 0);
      P.rect(0.2, 0.9, 0.9, 1.6, 'rgb(100,80,60)', 0);
      glass(P, 1.5, 0.9, 1.1, 1.0, rng, false);
      P.rect(0, 1.95, 3, 0.8, 'rgb(225,221,213)', 255);
      for (let k = 0; k < 3; k++) P.rect(0.1 + k, 1.95, 0.8, 0.8, 'rgb(60,60,62)', 0), P.rect(0.15 + k, 2.0, 0.7, 0.7, 'rgb(225,221,213)', 255);
      P.rect(0, 0.4, 3, 0.15, 'rgb(220,216,208)', 255);
      P.rect(2.85, 0.55, 0.15, 2.2, 'rgb(228,224,216)', 255);
    } else {
      glass(P, 0.3, 0.8, 2.4, 1.5, rng);
      for (let k = 0; k <= 4; k++) P.rect(0.3 + k * 0.6 - 0.03, 0.8, 0.06, 1.5, 'rgb(200,196,188)', 0);
      chhajja(P, 0.3, 0.6, 2.4);
      sill(P, 0.3, 2.3, 2.4);
    }
  });
}
// --- heritage basalt stone (Fergusson College style)
for (let variant = 0; variant < 2; variant++) {
  defTile('stone' + variant, (P, rng, nz) => {
    P.rect(0, 0, 3, 3.1, 'rgb(96,90,84)', 0);
    let y = 0;
    while (y < 3.1) {
      const h = rng.range(0.28, 0.4);
      let x = -rng.range(0, 0.4);
      while (x < 3) {
        const w = rng.range(0.45, 0.8), t = rng.range(70, 104);
        P.rect(x + 0.015, y + 0.015, w - 0.03, h - 0.03, rgb(t, t * 0.95, t * 0.9), 0);
        x += w;
      }
      y += h;
    }
    // gothic arch window
    const x = 0.9, w = 1.2, top = 0.55, bot = 2.45;
    P.x.fillStyle = 'rgb(160,150,130)';
    P.x.beginPath(); P.x.moveTo(P.px(x - 0.12), P.py(bot)); P.x.lineTo(P.px(x - 0.12), P.py(top + 0.6));
    P.x.quadraticCurveTo(P.px(x - 0.12), P.py(top - 0.12), P.px(x + w / 2), P.py(top - 0.25));
    P.x.quadraticCurveTo(P.px(x + w + 0.12), P.py(top - 0.12), P.px(x + w + 0.12), P.py(top + 0.6));
    P.x.lineTo(P.px(x + w + 0.12), P.py(bot)); P.x.closePath(); P.x.fill();
    P.x.fillStyle = 'rgb(40,44,48)';
    P.x.beginPath(); P.x.moveTo(P.px(x), P.py(bot)); P.x.lineTo(P.px(x), P.py(top + 0.6));
    P.x.quadraticCurveTo(P.px(x), P.py(top), P.px(x + w / 2), P.py(top - 0.12));
    P.x.quadraticCurveTo(P.px(x + w), P.py(top), P.px(x + w), P.py(top + 0.6));
    P.x.lineTo(P.px(x + w), P.py(bot)); P.x.closePath(); P.x.fill();
    P.mx.fillStyle = 'rgb(128,128,128)'; P.mx.fillRect(P.px(x), P.py(top + 0.2), P.px(w), P.py(bot - top - 0.2));
    P.rect(x + w / 2 - 0.03, top + 0.1, 0.06, bot - top - 0.1, 'rgb(150,140,120)', 0);
    if (variant) P.rect(0, 2.75, 3, 0.18, 'rgb(150,140,124)', 0);
  });
}
// --- shop ground floors (3.6 m tall in the world; tile drawn for 3.1 and stretched)
const GOODS = ['rgb(200,60,50)', 'rgb(240,200,60)', 'rgb(60,120,190)', 'rgb(230,230,220)', 'rgb(70,150,80)', 'rgb(230,120,40)', 'rgb(150,70,150)'];
for (let variant = 0; variant < 6; variant++) {
  defTile('shop' + variant, (P, rng, nz) => {
    wallBase(P, rng, nz, { streaks: 0.5 });
    const ox = 0.12, ow = 2.76, oy = 0.62, oh = 2.48;
    if (variant === 2) {
      // closed rolling shutter
      P.rect(ox, oy, ow, oh, 'rgb(150,150,148)', 0);
      for (let k = 0; k < 40; k++) P.rect(ox, oy + k * oh / 40, ow, 0.012, 'rgba(70,70,70,0.6)', 0);
      P.rect(ox + ow / 2 - 0.2, oy + oh - 0.12, 0.4, 0.06, 'rgb(90,90,90)', 0);
      // posters
      if (rng.chance(0.7)) P.rect(ox + rng.range(0.2, 1.8), oy + rng.range(0.6, 1.4), 0.4, 0.55, rng.pick(GOODS), 0);
      return;
    }
    // open shop: dark interior, shelves of goods
    P.grad(ox, oy, ow, oh, 'rgb(46,40,34)', 'rgb(84,74,62)', 0);
    if (variant === 4) {
      // medical: white bright interior, green cross
      P.grad(ox, oy, ow, oh, 'rgb(200,205,200)', 'rgb(150,155,150)', 0);
    }
    for (let s = 0; s < 4; s++) {
      const sy = oy + 0.25 + s * 0.48;
      P.rect(ox + 0.05, sy + 0.36, ow - 0.1, 0.04, 'rgb(120,100,80)', 0);
      let gx = ox + 0.1;
      while (gx < ox + ow - 0.15) {
        const gw = rng.range(0.05, 0.16), gh = rng.range(0.15, 0.34);
        P.rect(gx, sy + 0.36 - gh, gw, gh, rng.pick(GOODS), 0);
        gx += gw + 0.02;
      }
    }
    if (variant === 1) {
      // glass shopfront
      glass(P, ox + 0.05, oy + 0.05, ow - 0.1, oh - 0.5, rng, false);
      P.rect(ox + ow / 2 - 0.04, oy, 0.08, oh, 'rgb(180,180,180)', 0);
    }
    if (variant === 3) {
      // half shutter
      P.rect(ox, oy, ow, oh * 0.4, 'rgb(150,150,148)', 0);
      for (let k = 0; k < 16; k++) P.rect(ox, oy + k * oh * 0.4 / 16, ow, 0.012, 'rgba(70,70,70,0.6)', 0);
    }
    if (variant === 5) {
      // eatery: counter + steel vessels
      P.rect(ox, oy + oh - 0.9, ow, 0.9, 'rgb(170,170,175)', 0);
      for (let k = 0; k < 5; k++) {
        P.x.fillStyle = 'rgb(200,200,205)';
        P.x.beginPath(); P.x.ellipse(P.px(ox + 0.3 + k * 0.5), P.py(oy + oh - 0.95), P.px(0.18), P.py(0.12), 0, 0, 6.28); P.x.fill();
      }
    }
    // rolled-up shutter box
    P.rect(ox - 0.05, oy - 0.12, ow + 0.1, 0.14, 'rgb(120,120,118)', 0);
    // floor step
    P.rect(0, 3.0, 3, 0.1, 'rgb(150,140,128)', 0);
  });
}
// --- residential ground floors
defTile('stilt', (P, rng, nz) => {
  wallBase(P, rng, nz, { streaks: 0.4 });
  P.grad(0, 0.35, 3, 2.75, 'rgb(36,34,32)', 'rgb(66,62,58)', 0);
  P.rect(0, 0.2, 3, 0.2, 'rgb(225,221,213)', 255);
  P.rect(1.35, 0.4, 0.3, 2.7, 'rgb(220,216,208)', 255);
  // parked scooters silhouettes
  for (let k = 0; k < 2; k++) {
    const x = 0.25 + k * 1.75;
    P.rect(x, 2.35, 0.9, 0.45, rng.pick(['rgb(40,40,45)', 'rgb(200,200,200)', 'rgb(160,30,40)', 'rgb(30,60,120)']), 0);
    P.x.fillStyle = 'rgb(20,20,20)';
    P.x.beginPath(); P.x.arc(P.px(x + 0.12), P.py(2.85), P.px(0.13), 0, 6.28); P.x.arc(P.px(x + 0.78), P.py(2.85), P.px(0.13), 0, 6.28); P.x.fill();
  }
});
defTile('lobby', (P, rng, nz) => {
  wallBase(P, rng, nz, { streaks: 0.5 });
  P.grad(0.7, 0.8, 1.6, 2.3, 'rgb(60,56,52)', 'rgb(90,84,78)', 0);
  grill(P, 0.7, 0.8, 1.6, 2.3, rng, 1);
  P.rect(0.6, 0.55, 1.8, 0.2, 'rgb(220,214,200)', 255);
  P.rect(0.2, 1.1, 0.35, 0.45, 'rgb(240,240,235)', 0); // name plate
  P.rect(2.45, 1.1, 0.4, 0.5, 'rgb(40,46,52)', 128);
});
defTile('parapet', (P, rng, nz) => {
  wallBase(P, rng, nz, { streaks: 1.6 });
  P.rect(0, 0, 3, 0.25, 'rgb(225,221,213)', 255);
  stain(P, 0, 0.25, 3, 1.2, 0.35);
});
defTile('roof', (P, rng, nz) => {
  const S = P.S;
  P.rect(0, 0, 3, 3.1, 'rgb(150,146,138)', 0);
  const img = P.x.getImageData(0, 0, S, S); const d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const k = 0.7 + fbm(nz, x / S * 4, y / S * 4, 4, 4) * 0.45 + (nz(x * 0.7, y * 0.7, S * 0.7) - 0.5) * 0.1;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  P.x.putImageData(img, 0, 0);
  // waterproofing patches (white/black)
  for (let k = 0; k < 3; k++) P.rect(rng.range(0, 2.4), rng.range(0, 2.4), rng.range(0.4, 1.2), rng.range(0.4, 1.0), rng.pick(['rgba(230,230,225,0.5)', 'rgba(30,30,30,0.35)']), 0);
});
defTile('tiles', (P, rng, nz) => {
  // Mangalore clay tiles, rows along u
  P.rect(0, 0, 3, 3.1, 'rgb(120,58,40)', 0);
  const rows = 14;
  for (let r = 0; r < rows; r++) {
    const y = r * 3.1 / rows;
    for (let c = 0; c < 12; c++) {
      const t = rng.range(0.75, 1.1);
      P.grad(c * 0.25 + (r % 2) * 0.125, y, 0.24, 3.1 / rows, rgb(176 * t, 86 * t, 56 * t), rgb(120 * t, 56 * t, 38 * t), 0);
    }
  }
  const S = P.S;
  const img = P.x.getImageData(0, 0, S, S); const d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const k = 0.62 + fbm(nz, x / S * 3, y / S * 3, 4, 3) * 0.5;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  P.x.putImageData(img, 0, 0);
});
defTile('cwall', (P, rng, nz) => {
  // compound wall: plaster with a dark plinth and heavy grime
  wallBase(P, rng, nz, { streaks: 2.0 });
  P.rect(0, 2.55, 3, 0.55, 'rgb(130,126,120)', 0);
  P.rect(0, 0, 3, 0.14, 'rgb(220,216,208)', 255);
  const S = P.S;
  const g = P.x.createLinearGradient(0, P.py(1.6), 0, P.py(3.1));
  g.addColorStop(0, 'rgba(70,60,45,0)'); g.addColorStop(1, 'rgba(70,60,45,0.5)');
  P.x.fillStyle = g; P.x.fillRect(0, P.py(1.6), S, P.py(1.5));
});
defTile('temple', (P, rng, nz) => {
  wallBase(P, rng, nz, { streaks: 0.6 });
  P.rect(0, 0, 3, 0.4, 'rgb(220,110,30)', 0);
  P.rect(0, 2.7, 3, 0.4, 'rgb(220,110,30)', 0);
  for (let k = 0; k < 6; k++) P.rect(0.1 + k * 0.5, 0.45, 0.06, 2.2, 'rgb(200,150,80)', 0);
  P.grad(1.0, 0.9, 1.0, 1.8, 'rgb(40,30,24)', 'rgb(60,40,30)', 0);
  P.x.fillStyle = 'rgb(240,160,40)';
  P.x.beginPath(); P.x.arc(P.px(1.5), P.py(0.9), P.px(0.5), Math.PI, 0); P.x.fill();
});
defTile('plain', (P, rng, nz) => { wallBase(P, rng, nz, { streaks: 1.2 }); });
defTile('shed', (P, rng, nz) => {
  // corrugated tin
  const base = rng.pick([[150, 150, 150], [60, 90, 150], [140, 90, 60]]);
  for (let k = 0; k < 40; k++) {
    const t = 0.75 + 0.25 * Math.sin(k * 1.4);
    P.rect(k * 3 / 40, 0, 3 / 40 + 0.01, 3.1, rgb(base[0] * t, base[1] * t, base[2] * t), 0);
  }
  for (let k = 0; k < 4; k++) P.rect(rng.range(0, 2.6), rng.range(0, 2.6), 0.4, 0.4, 'rgba(120,70,40,0.4)', 0);
});
defTile('deckside', (P, rng, nz) => {
  P.rect(0, 0, 3, 3.1, 'rgb(170,168,162)', 0);
  wallBase(P, rng, nz, { streaks: 2 });
  P.mx.fillStyle = '#000'; P.mx.fillRect(0, 0, P.S, P.S);
});
defTile('bus', (P, rng, nz) => { P.rect(0, 0, 3, 3.1, 'rgb(240,240,240)', 255); });
export const FACADE_COUNT = FACADE_LIST.length;

export function makeFacadeTexture(renderer, size = 256) {
  const S = size;
  const n = FACADE_LIST.length;
  const data = new Uint8Array(S * S * 4 * n);
  const P = new Painter(S);
  for (let L = 0; L < n; L++) {
    P.clear();
    const rng = new RNG(5000 + L * 131);
    const nz = makeNoise(700 + L, S * 2);
    FACADE_LIST[L](P, rng, nz);
    data.set(P.data(), L * S * S * 4);
  }
  const tex = new THREE.DataArrayTexture(data, S, S, n);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- decals atlas (alpha)
// 4x4 grid of 128px cells: 0 paint dash, 1 zebra stripe, 2 dust gradient, 3 AO gradient,
// 4 pothole, 5 oil stain, 6 light pool, 7 puddle, 8 tyre marks, 9 shadow blob, 10 paint yellow
export const DECAL = { paint: 0, zebra: 1, dust: 2, ao: 3, pothole: 4, oil: 5, light: 6, puddle: 7, skid: 8, blob: 9, yellow: 10, garbage: 11 };
export function makeDecalTexture() {
  const C = 128, N = 4, S = C * N;
  const c = cv(S, S); const x = c.getContext('2d', { willReadFrequently: true });
  const rng = new RNG(77);
  const nz = makeNoise(9, 256);
  const cell = (i) => [(i % N) * C, Math.floor(i / N) * C];
  function worn(ix, col) {
    const [ox, oy] = cell(ix);
    const img = x.createImageData(C, C);
    for (let y = 0; y < C; y++) for (let xx = 0; xx < C; xx++) {
      const i = (y * C + xx) * 4;
      const w = fbm(nz, (ox + xx) / 24, (oy + y) / 24, 4, 64);
      const a = clamp((w - 0.36) * 3.2, 0, 1) * 0.92;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
      img.data[i + 3] = a * 255;
    }
    x.putImageData(img, ox, oy);
  }
  worn(DECAL.paint, [235, 235, 228]);
  worn(DECAL.zebra, [240, 240, 232]);
  worn(DECAL.yellow, [235, 190, 40]);
  {
    const [ox, oy] = cell(DECAL.dust);
    const g = x.createLinearGradient(0, oy, 0, oy + C);
    g.addColorStop(0, 'rgba(150,128,96,0.8)'); g.addColorStop(0.5, 'rgba(150,128,96,0.32)'); g.addColorStop(1, 'rgba(150,128,96,0)');
    x.fillStyle = g; x.fillRect(ox, oy, C, C);
  }
  {
    const [ox, oy] = cell(DECAL.ao);
    const g = x.createLinearGradient(0, oy, 0, oy + C);
    g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(0.35, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(ox, oy, C, C);
  }
  {
    const [ox, oy] = cell(DECAL.pothole);
    const cx = ox + C / 2, cy = oy + C / 2;
    x.save(); x.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = k / 24 * 6.28, r = C * (0.34 + 0.05 * Math.sin(a * 2 + 1) + 0.04 * Math.sin(a * 5) + rng.range(-0.03, 0.03));
      k ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    x.closePath();
    const g = x.createRadialGradient(cx, cy, 2, cx, cy, C * 0.45);
    g.addColorStop(0, 'rgba(36,32,28,0.95)'); g.addColorStop(0.7, 'rgba(60,54,46,0.9)'); g.addColorStop(1, 'rgba(110,100,86,0.6)');
    x.fillStyle = g; x.fill(); x.restore();
  }
  {
    const [ox, oy] = cell(DECAL.oil);
    const g = x.createRadialGradient(ox + C / 2, oy + C / 2, 0, ox + C / 2, oy + C / 2, C / 2);
    g.addColorStop(0, 'rgba(8,8,10,0.6)'); g.addColorStop(0.6, 'rgba(8,8,10,0.25)'); g.addColorStop(1, 'rgba(8,8,10,0)');
    x.fillStyle = g; x.fillRect(ox, oy, C, C);
  }
  {
    const [ox, oy] = cell(DECAL.light);
    const g = x.createRadialGradient(ox + C / 2, oy + C / 2, 0, ox + C / 2, oy + C / 2, C / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(ox, oy, C, C);
  }
  {
    const [ox, oy] = cell(DECAL.blob);
    const g = x.createRadialGradient(ox + C / 2, oy + C / 2, 0, ox + C / 2, oy + C / 2, C / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.55, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(ox, oy, C, C);
  }
  {
    const [ox, oy] = cell(DECAL.skid);
    for (let k = 0; k < 2; k++) {
      x.fillStyle = 'rgba(10,10,10,0.35)';
      x.fillRect(ox + C * (0.2 + k * 0.45), oy, C * 0.15, C);
    }
  }
  {
    const [ox, oy] = cell(DECAL.garbage);
    for (let k = 0; k < 60; k++) {
      x.fillStyle = rng.pick(['rgba(200,200,190,0.9)', 'rgba(60,120,60,0.9)', 'rgba(180,60,50,0.9)', 'rgba(90,70,50,0.9)', 'rgba(230,230,230,0.9)', 'rgba(40,40,40,0.9)']);
      const a = rng.range(0, 6.28), r = rng.range(0, C * 0.4);
      x.fillRect(ox + C / 2 + Math.cos(a) * r, oy + C / 2 + Math.sin(a) * r, rng.range(3, 10), rng.range(3, 10));
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, uv: (i) => { const [ox, oy] = cell(i); return [ox / S, 1 - (oy + C) / S, C / S]; } };
}

// leaf cluster texture for tree cards (alpha tested): overlapping small leaves, lit from above
export function makeLeafTexture() {
  const S = 256;
  const c = cv(S, S); const x = c.getContext('2d');
  const rng = new RNG(4242);
  const clusters = 26;
  for (let k = 0; k < 2200; k++) {
    // cluster leaves around sub-centres so the card has ragged gaps
    const ci = k % clusters;
    const ca = (ci * 2.39996) % 6.283, cr = Math.sqrt((ci + 0.5) / clusters) * S * 0.36;
    const ccx = S / 2 + Math.cos(ca) * cr, ccy = S / 2 + Math.sin(ca) * cr;
    const a = rng.range(0, 6.28), r = Math.pow(rng.next(), 0.7) * S * 0.12;
    const px = ccx + Math.cos(a) * r, py = ccy + Math.sin(a) * r;
    const lightK = 0.75 + 0.45 * (1 - py / S) + rng.range(-0.12, 0.12);
    const t = lightK * rng.range(0.8, 1.15);
    const hueShift = rng.next();
    const base = hueShift < 0.15 ? [96, 120, 40] : hueShift < 0.3 ? [56, 92, 40] : [70, 108, 46];
    x.fillStyle = rgb(Math.min(255, base[0] * t), Math.min(255, base[1] * t), Math.min(255, base[2] * t));
    x.save(); x.translate(px, py); x.rotate(rng.range(0, 6.28));
    x.beginPath(); x.ellipse(0, 0, rng.range(4, 7.5), rng.range(1.8, 3.2), 0, 0, 6.28); x.fill();
    x.restore();
  }
  // a few twigs
  x.strokeStyle = 'rgba(70,55,40,0.8)'; x.lineWidth = 1.2;
  for (let k = 0; k < 10; k++) {
    const a = rng.range(0, 6.28);
    x.beginPath(); x.moveTo(S / 2, S / 2); x.lineTo(S / 2 + Math.cos(a) * S * 0.35, S / 2 + Math.sin(a) * S * 0.35); x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  return tex;
}
