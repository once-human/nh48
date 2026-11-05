// The painted city's buildings, one footprint at a time. Runs in a worker (worker.js), so a dense chunk of the old
// city never costs the game a frame; on the loading screen it runs on the main thread (same code, same result).
//
// Each building is the map's own: its outline, storeys and kind (apartment, old wada, bungalow, temple...) and its
// shop frontages are the game's, and it stands exactly as tall. What it looks like comes from where it is
// (world/areas.js): a peth house has tall wooden windows, flat grilles, a wooden gallery and Mangalore tiles; a
// Kothrud society has aluminium sliders in box grilles, chajjas over every window, washing on the balconies and
// Sintex tanks on the roof; a Baner tower has big glass and glass balconies and nothing on its roof; a vasti is bare
// brick, bright paint, tin and blue tarp. Areas blend, so each building draws its own character from the mix.
// Shops are drawn by trade and by class: a kirana's shelves of packets and sacks of grain, a chemist's white and
// green, a jeweller's glass and gold, a brand's glass front and cladding.
// Front walls (on a road) get real windows, balconies and grilles; back walls are painted (the shader draws their
// windows), which is what keeps a dense chunk light.
import { WB, Frame, rng, hash2, mixc, mulc, hex, signedArea, isConvex, offsetRing, insideRing } from './geom.js';
import { K, STYLE, BASE, SHOP_CELL, heightOf } from './kinds.js';
import { KINDS, PALETTES, KIND_IDS as KI, blend, pick } from './areas.js';
import { footpath } from './footpath.js';

// what a kind of place builds like
const TYPE = {};
for (const k of ['PETH', 'BAZAAR', 'MANDAI', 'HERITAGE', 'RIVER', 'PILGRIM']) TYPE[KI[k]] = 'peth';
for (const k of ['COLLEGE', 'SOC', 'PCMC', 'MIXED', 'SOUTH', 'GOVT', 'TEKDI', 'AIRPORT', 'STATION', 'BUS']) TYPE[KI[k]] = 'soc';
for (const k of ['CAMP', 'CANT', 'CAMPUS']) TYPE[KI[k]] = 'colonial';
for (const k of ['KP', 'BUNG']) TYPE[KI[k]] = 'bung';
for (const k of ['POSH', 'HIGH']) TYPE[KI[k]] = 'posh';
TYPE[KI.TOWER] = 'tower'; TYPE[KI.IT] = 'office';
for (const k of ['VASTI']) TYPE[KI[k]] = 'vasti';
for (const k of ['GAO', 'VILLAGE']) TYPE[KI[k]] = 'village';
for (const k of ['MIDC', 'HWY']) TYPE[KI[k]] = 'industrial';

// shop trades (the map's categories) -> how the inside is stocked
const TRADE = { grocery: 0, generic: 0, hardware: 8, sweets: 11, bakery: 13, food: 1, hotel: 1, restobar: 1, cafe: 1, bar: 1, icecream: 1, clinic: 2, pharmacy: 2,
  optician: 2, bank: 3, atm: 3, office: 3, travel: 3, classes: 3, clothes: 4, jewellery: 5, mobile: 6, electronics: 6, books: 7, garage: 9, salon: 10, gym: 10, shoes: 12 };
const POP = [0x2f5fd0, 0xf08a24, 0x2f8a5a, 0xd83a2a, 0xf2c230, 0x2a8a8a, 0xc8306a, 0x7a3ab8];
const CLOTH = [0xd83a2a, 0x2f5fd0, 0xf2c230, 0x2f8a5a, 0xe86a9a, 0xf08a24, 0xeeeae0, 0x7a3ab8, 0x1a1a2a, 0x8a1a2a, 0x3ab0c8];
const TANK = [0x1c1d1f, 0x1c1d1f, 0x1c1d1f, 0x22262a, 0xd8d4c8, 0x3a5a8a];
const DOORS = [0x4a3322, 0x2f5a4a, 0x35546f, 0x6a3a26, 0x5a2a20, 0x2a3a5a];

// ---------------------------------------------------------------- a chunk
// job: { cx, cz, blds: [{ bi, ring, levels, style, roof, flags, y, seed, shops: [[key, cat, brand]] }], foot }
// A chunk is drawn in its four quarters (each shown near or far on its own, gfx: world/buildings.js), at three
// distances: 'near', as it is close up (asked for only as you come close); and in the 'base' drawing, as it's seen
// from a street or two away (far: the same buildings without what can't be seen from there: frames, bars, cables,
// pots, the footpath's mess) and from across the city (mass: each building its walls with the shader's painted
// windows, its roof, what stands up on the roof).
export function cellOf(job, x, z) { return (x > job.cx ? 1 : 0) + (z > job.cz ? 2 : 0); }
const pk = (b) => b.empty ? null : b.pack();
export function buildChunk(job, area, kind = 'base') {
  for (const B of job.blds) {
    const r = B.ring, n = r.length / 2; let x = 0, z = 0;
    for (let i = 0; i < n; i++) { x += r[2 * i]; z += r[2 * i + 1]; }
    B.cell = cellOf(job, x / n, z / n);
  }
  const cells = [];
  if (kind === 'near') {
    const bs = [0, 1, 2, 3].map(() => new WB(2048)), cbs = [0, 1, 2, 3].map(() => new WB(256));
    for (const w of bs) w.rich = job.rich ?? 1;
    blds(job, area, bs, cbs);
    if (job.foot) { try { footpath(job.foot, area, (x, z) => bs[cellOf(job, x, z)]); } catch (e) { if (globalThis.BETA_THROW) throw e; } }
    for (let c = 0; c < 4; c++) cells.push({ main: pk(bs[c]), cut: pk(cbs[c]) });
  } else {
    const fs = [0, 1, 2, 3].map(() => new WB(1024)), ms = [0, 1, 2, 3].map(() => new WB(512)), x = new WB(4), xs = [x, x, x, x];
    x.lod = 3;
    for (const f of fs) f.lod = 1;
    for (const m of ms) m.lod = 2;
    blds(job, area, fs, xs);
    blds(job, area, ms, xs);
    for (let c = 0; c < 4; c++) cells.push({ far: pk(fs[c]), mass: pk(ms[c]) });
  }
  return { kind, cells, solids: kind === 'near' && job.foot ? job.foot.solids || [] : null };
}
function blds(job, area, bs, cbs) {
  const ctx = { area, fronts: [], lines: 0 };
  for (const B of job.blds) {
    const b = bs[B.cell], cb = cbs[B.cell];
    const s0 = b.n, c0 = cb.n;
    try { building(b, cb, B, ctx); } catch (e) { if (globalThis.BETA_THROW) throw e; }
    if (B.y) { for (let i = s0; i < b.n; i++) b.P[i * 3 + 1] += B.y; for (let i = c0; i < cb.n; i++) cb.P[i * 3 + 1] += B.y; }
  }
  if (!bs[0].lod) overLanes(bs, ctx);
}

// ---------------------------------------------------------------- one building
function building(b, cb, B, ctx) {
  const p = B.ring, n = p.length / 2;
  if (n < 3) return;
  const st = B.style, levels = Math.max(1, B.levels | 0);
  const area = signedArea(p), sgn = area > 0 ? 1 : -1, A2 = Math.abs(area);
  const normals = new Float64Array(p.length);
  let cx = 0, cz = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, dx = p[2 * j] - p[2 * i], dz = p[2 * j + 1] - p[2 * i + 1], L = Math.hypot(dx, dz) || 1;
    normals[2 * i] = sgn * dz / L; normals[2 * i + 1] = -sgn * dx / L;
    cx += p[2 * i]; cz += p[2 * i + 1];
  }
  cx /= n; cz /= n;
  const R = rng(B.seed);
  if (st === 7) return canopy(b, p, normals, R);
  // who this building is
  const mix = ctx.area.at(cx, cz), A = blend(mix), kind = pick(mix, R()), KD = KINDS[kind];
  let type = TYPE[kind] || 'soc';
  if (st === 9) type = 'office';
  else if (st === 1 && (type === 'posh' || type === 'tower' || A.wealth > 0.75)) type = 'office';
  else if (st === 1 && type === 'office' && levels < 3) type = 'posh';
  else if (st === 2 && type !== 'colonial') type = 'peth';
  else if (st === 3 && (type === 'soc' || type === 'tower' || type === 'posh')) type = R() < 0.6 ? 'bung' : type;
  else if (st === 6) type = 'industrial';
  if (type === 'office' && st === 0) type = A.wealth > 0.7 ? 'posh' : 'tower';      // homes in an IT belt
  const pal = PALETTES[KD.pal] || PALETTES.society;
  const L = look(R, A, KD, type, st, levels, pal, B);
  const { gh, fh, H } = heightOf(levels, st);
  const pitched = (B.roof === 1 || st === 10 || st === 12) && n <= 10 && isConvex(p) && A2 < 1600;
  const fort = st === 11;
  const parapet = fort ? 1.4 : pitched ? 0 : st === 6 ? 0.15 : 0.95;
  const top = BASE + H, wallTop = top + parapet;
  const G = { cb, p, n, normals, cx, cz, A2, gh, fh, H, top, wallTop, levels, st, L, A, type, R, B, shops: new Map((B.shops || []).map(s => [s[0], s])) };
  // ---- walls, edge by edge
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = p[2 * i], az = p[2 * i + 1], bx = p[2 * j], bz = p[2 * j + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    const F = new Frame(ax, az, (bx - ax) / len, (bz - az) / len, normals[2 * i], normals[2 * i + 1], u);
    if (b.lod > 1) massWall(b, G, F, len); else edge(b, cb, G, F, i, len, (B.flags && B.flags[i]) || '0', ctx);
    u += len;
  }
  // ---- the top (its own chances, so it's the same roof however the walls were drawn)
  G.R = rng(B.seed ^ 0x2545f491);
  if (fort) return fortTop(b, G);
  if (pitched) { pitchedRoof(b, G, top, st === 10 ? 0.75 : 0.3, st === 10 ? 9 : 3.4, st === 12 || st === 10 ? 0x7a6a62 : L.tile); return; }
  flatRoof(b, cb, G);
  if (st === 8) shikhara(b, G);
  else if (st === 13) pyramid(b, G);
  else if (st !== 6) {
    if (L.hip && !B.noRoof && n <= 8 && isConvex(p) && A2 < 420) pitchedRoof(b, G, wallTop, 0.3, 2.6, L.tile);
    else if (!L.uc) rooftop(b, cb, G);
  }
}

// the building's paint, materials and habits (chances are per building, drawn once)
function look(R, A, KD, type, st, levels, pal, B) {
  const c = (h) => hex(h);
  const tw = (col, k = 0.06) => col.map(v => Math.min(1, v * (1 - k + R() * k * 2)));
  const pickc = (a) => a[(R() * a.length) | 0];
  const wear = Math.min(1, Math.max(0, A.wear + (R() - 0.5) * 0.3));
  let wk = K.plaster, wall = tw(c(pickc(pal.wall))), trim = c(pickc(pal.trim));
  if (st === 14 || (type !== 'posh' && type !== 'office' && type !== 'bung' && R() < A.brick)) { wk = K.brick; wall = tw(c(pickc([0xa8553e, 0x9a4a36, 0xb0603e, 0x9a5a44]))); }
  else if (st === 5 || st === 12 || (st === 4 && R() < A.stone)) { wk = K.stone; wall = tw(c(pickc([0x6a625a, 0x7a7068, 0x8a7a6a, 0xa09078]))); }
  else if (st === 10) { wk = R() < 0.5 ? K.stone : K.brick; wall = wk === K.stone ? tw(c(0x8a8070)) : tw(c(0xa05a40)); }
  else if (st === 8) { wall = c(pickc([0xf0a050, 0xf6f0e6, 0xf4c070, 0xe8e0d0])); }
  else if (st === 13) { wall = c(0x2a2a2c); wk = K.plain; }
  else if (type === 'office') { wk = R() < 0.6 ? K.curtain : K.cladding; wall = tw(c(pickc(PALETTES.office.wall))); }
  else if (type === 'vasti' && R() < 0.5) wall = tw(c(pickc(PALETTES.vasti.wall)));
  // a strong band of colour on the newer towers (the orange or blue stripe up the corner)
  const accent = (type === 'tower' || type === 'soc') && R() < 0.35 ? c(pickc(PALETTES.tower.trim)) : null;
  const ch = (x) => R() < x;
  return {
    wk, wall, trim, accent, wear,
    rich: A.wealth,
    grille: ch(type === 'posh' || type === 'office' ? 0.05 : A.grille), boxGrille: type === 'soc' || type === 'tower' || type === 'village' ? ch(0.75) : ch(0.25),
    chajja: ch(type === 'posh' || type === 'office' ? 0.15 : A.chajja), band: ch(0.5),
    balcony: A.balcony, rail: A.rail, glassRail: type === 'posh' || (type === 'tower' && ch(0.6)),
    gallery: type === 'peth' && (st === 2 || ch(A.gallery)), arcade: type === 'colonial' && ch(0.5 + A.arcade * 0.5),
    stilt: (type === 'soc' || type === 'tower' || type === 'posh') && levels >= 4 && st === 0 && ch(0.55),
    shutters: type === 'peth' || type === 'colonial' || type === 'village' ? ch(0.55) : false,
    arched: (type === 'peth' && (st === 2 || st === 5) && ch(0.5)) || (type === 'colonial' && ch(0.6)) || st === 10 || st === 12 || st === 14,
    ac: A.ac, laundry: A.laundry, plants: A.plants, tanks: A.tanks, solar: A.solar, dish: A.dish, tin: A.tin, terrace: A.terrace, clutter: A.clutter,
    wires: A.wires, flex: A.flex, rangoli: A.rangoli, awning: A.awning, kandil: ch(0.22),
    uc: !(B.shops && B.shops.length) && levels >= 3 && ch(A.uc * (type === 'tower' || type === 'office' ? 2.2 : 1)),
    hip: (type === 'bung' || type === 'colonial' || type === 'village') && levels <= 2 && ch(type === 'village' ? 0.4 : 0.55),
    tile: pickc([0xb8573e, 0xa84c36, 0xc06040, 0x9a4a34]),
    winCol: type === 'office' || type === 'posh' ? pickc([0x3a5a6a, 0x2a4a5a, 0x4a6a78, 0x5a6a70]) : pickc([0x2e5a5c, 0x2a4e58, 0x35625e, 0x3a4a52, 0x4a5a5a]),
    frame: type === 'peth' || type === 'colonial' || type === 'village' ? c(pickc(DOORS)) : type === 'soc' || type === 'tower' ? c(pickc([0xd8d8d4, 0xc8c8c0, 0x8a8a86, 0xe8e4dc])) : c(0x2a2a2c),
    grilleCol: c(pickc([0x1e1e20, 0x1e1e20, 0x2a3a5a, 0x3a5a3a, 0x6a2a20, 0xd8d8d0])),
    space: type === 'peth' ? 2.3 : type === 'posh' ? 3.6 : type === 'vasti' ? 2.6 : type === 'colonial' ? 2.8 : 3.0,
  };
}

// ---------------------------------------------------------------- one wall
// from across the city: the wall in one piece, its windows painted by the shader (curtain walls as they are)
function massWall(b, G, F, len) {
  const { L, st, wallTop, B } = G;
  const wseed = (st * 16 + (B.seed & 7)) / 255;
  if (L.wk === K.curtain) { b.set(K.curtain, L.wall, L.wear, wseed); F.rect(b, 0, len, BASE, wallTop - 0.9, 0); b.set(K.cladding, L.wall, L.wear); F.rect(b, 0, len, wallTop - 0.9, wallTop, 0); return; }
  if (len < 3 || st === 8 || st === 13 || st === 11) b.set(L.wk, L.wall, L.wear, (B.seed % 251) / 255);
  else b.set(K.facadeWin, L.wall, L.wear, wseed + (L.grille ? 8 / 255 : 0));
  F.rect(b, 0, len, BASE, wallTop, 0);
}
function edge(b, cb, G, F, i, len, fl, ctx) {
  const { L, gh, fh, wallTop, levels, st, R, type } = G;
  const front = fl !== '0', shop = fl === '3' && len > 2.6;
  const wseed = (st * 16 + (G.B.seed & 7)) / 255;            // the shader's painted windows: style, grilles, a variation
  // blank: short walls and many back walls (they touch the next building)
  const blank = !front && (len < 3 || R() < 0.45);
  b.set(L.wk, L.wall, L.wear, (G.B.seed % 251) / 255);
  // the ground floor
  let y0 = BASE;
  const shopsHere = !shop && front && len > 2.6 && hasShops(G, i, len);
  if (shop || shopsHere) { shopFront(b, cb, G, F, i, len, shop); y0 = BASE + gh; }
  else if (front && L.stilt && fl !== '0' && len > 5) { stilt(b, G, F, len); y0 = BASE + gh; }
  else if (front && L.arcade && len > 5 && levels <= 3) { arcade(b, G, F, len); y0 = BASE + gh; }
  // the wall itself (back walls: the shader paints their windows)
  if (L.wk === K.curtain && !blank) { b.set(K.curtain, L.wall, L.wear, wseed); F.rect(b, 0, len, y0, wallTop - 0.9, 0); b.set(K.cladding, L.wall, L.wear); F.rect(b, 0, len, wallTop - 0.9, wallTop, 0); }
  else {
    if (!front && !blank && st !== 8 && st !== 13 && st !== 11 && L.wk !== K.curtain && !(b.rich > 1 && len > 2.5)) b.set(K.facadeWin, L.wall, L.wear, wseed + (L.grille ? 8 / 255 : 0));
    else if (L.wk === K.curtain) b.set(K.cladding, L.wall, L.wear);
    F.rect(b, 0, len, y0, wallTop, 0);
  }
  b.set(L.wk, L.wall, L.wear);
  structure(b, cb, G, F, i, len, front, blank, y0);
  b.set(L.wk, L.wall, L.wear);
  if (L.accent && front && len > 4 && R() < 0.3) { b.col(L.accent); F.box(b, len - 1.2, len - 0.2, BASE + gh, wallTop, 0, 0.08, 2 | 8); b.col(L.wall); }
  if (!front) {
    if (!blank && len > 3 && R() < 0.5 * (1 - L.rich)) pipe(b, F, R() * len, wallTop);
    if (blank && len > 5 && R() < L.flex * 0.25) painted(b, F, len, G);
    return;
  }
  // a plinth, and the wall's own features floor by floor
  if (y0 === BASE && !blank) { b.set(L.wk === K.brick ? K.plaster : L.wk === K.stone ? K.stone : K.plaster, mulc(L.wall, 0.8), Math.min(1, L.wear + 0.2)); F.box(b, 0, len, 0, BASE + 0.45, 0, 0.04, 2 | 8 | 16 | 32); b.set(L.wk, L.wall, L.wear); }
  if (L.wk === K.curtain || st === 13 || st === 8 || st === 11) return;
  const nb = Math.max(1, Math.floor(len / L.space + 0.25)), cell = len / nb;
  const floors = [];
  if (y0 === BASE) floors.push(BASE);
  for (let f = 1; f < levels; f++) floors.push(BASE + gh + (f - 1) * fh);
  const S = STYLE[st] || STYLE[0];
  // balconies: runs of bays, the same on every floor (they're built one over the other)
  const balc = new Uint8Array(nb);
  if (levels > 1 && cell > 1.6 && type !== 'office' && type !== 'industrial') for (let k = 0; k < nb; k++) if (R() < L.balcony * 0.7) balc[k] = 1;
  let door = -1;
  if (y0 === BASE) door = Math.floor(nb / 2);
  for (let fi = 0; fi < floors.length; fi++) {
    const fy = floors[fi], ground = fy === BASE;
    const flH = ground ? gh : fh;
    if (fy + 1.2 > G.top) break;
    // a chajja band right along the floor (the long shadow line of the old sketches)
    if (L.chajja && L.band && !ground && type !== 'posh') { b.set(K.concrete, mulc(L.wall, 0.94), L.wear); F.box(b, 0.05, len - 0.05, fy + flH - 0.55, fy + flH - 0.45, 0, 0.55, 2); b.set(L.wk, L.wall, L.wear); }
    for (let k = 0; k < nb; k++) {
      const uc = (k + 0.5) * cell;
      if (ground && k === door) { doorway(b, G, F, uc, cell); continue; }
      if (!ground && balc[k]) { balcony(b, cb, G, F, k * cell + 0.12, (k + 1) * cell - 0.12, fy, flH); continue; }
      const ww = Math.min(cell * 0.62, type === 'posh' ? 2.4 : type === 'vasti' ? 0.75 : S[2] > 0 ? Math.max(0.8, S[2]) : 1.1);
      const wh = Math.min(flH - 1.0, type === 'posh' ? 2.0 : type === 'vasti' ? 0.85 : type === 'peth' || type === 'colonial' ? 1.55 : Math.max(1.0, S[3]));
      const sill = ground ? fy + 0.95 : fy + (type === 'posh' ? 0.4 : S[5] || 0.85);
      win(b, cb, G, F, uc, sill, ww, wh, ground);
    }
    // an AC box under a window now and then; washing; a Diwali lantern
    if (!ground && R() < L.ac * 0.5 && cell > 1.5) acUnit(b, F, ((R() * nb | 0) + 0.5) * cell + cell * 0.32, fy + 0.35);
  }
  // cables along the front of the old streets (and the boxes they end in)
  if (L.wires > 0.5 && len > 3 && R() < L.wires) facadeWires(b, G, F, len);
  if (len > 6) ctx.fronts.push({ F, len, y: BASE + gh + 0.4, top: G.top, w: L.wires, B: G.B });
}
// what a wall is really made of, close up: the frame it's built on (columns and beams standing a little proud of the
// infill), the coping on its parapet, a plinth; a side wall's patched plaster, pipes, vents and meter box. It has
// chances of its own, so drawing it never changes how the rest of the building comes out.
function structure(b, cb, G, F, i, len, front, blank, y0) {
  if (b.lod || !b.rich) return;
  const { L, gh, fh, levels, top, wallTop, st, B } = G;
  if (L.wk === K.curtain || st === 8 || st === 13 || st === 11 || st === 7) return;
  const R = rng((B.seed ^ (i*0x9e3779)) | 0), wall = L.wall, wear = L.wear, shade = mulc(wall, 0.92), lit = mixc(wall, [1, 1, 1], 0.1), frame = L.wk === K.brick ? K.plaster : L.wk === K.stone ? K.stone : K.concrete;
  // the parapet's coping: a drip edge all along, and a band below it
  if (wallTop > top + 0.2) { b.set(K.concrete, mulc(wall, 0.84), Math.min(1, wear + 0.15), R()); F.box(b, -0.03, len + 0.03, wallTop - 0.07, wallTop + 0.03, 0, 0.055, 2); F.box(b, 0, len, top - 0.04, top + 0.09, 0, 0.03, 2); }
  // the floors' beams
  b.set(frame, lit, wear, R());
  for (let f = 1; f < levels; f++) { const y = BASE + gh + (f - 1)*fh; if (y >= y0 && y < top - 0.5) F.box(b, 0, len, y - 0.09, y + 0.14, 0, front ? 0.016 : 0.028, 2); }
  // the columns: at the corners and between the bays
  const cell = front ? len/Math.max(1, Math.floor(len/L.space + 0.25)) : Math.min(4.2, Math.max(2.8, len/Math.max(1, Math.round(len/3.6)))), nc = Math.max(1, Math.round(len/cell));
  b.set(frame, shade, wear, R());
  for (let k = 0; k <= nc; k++) { const u = k*len/nc, w = k === 0 || k === nc ? 0.17 : front ? 0.1 : 0.15; F.box(b, Math.max(0, u - w), Math.min(len, u + w), y0, top - 0.01, 0, front ? 0.024 : 0.034, 2 | 8); }
  // a plinth where none was drawn
  if (!front) { b.set(K.concrete, mulc(wall, 0.72), Math.min(1, wear + 0.25), R()); F.box(b, 0, len, 0, BASE + 0.32 + R()*0.2, 0, 0.035, 2 | 8); }
  if (front) {
    // an old front's moulded cornice, a new one's plain sunshade band under the parapet
    if ((L.type === 'peth' || G.type === 'peth' || G.type === 'colonial') && levels > 0 && top > BASE + 3) { b.set(K.plaster, lit, wear, R()); F.box(b, 0, len, top - 0.32, top - 0.2, 0, 0.09, 2); F.box(b, 0, len, top - 0.2, top - 0.12, 0, 0.16, 2); F.box(b, 0, len, top - 0.12, top - 0.04, 0, 0.23, 2); }
    if (G.type === 'colonial' && b.rich > 1) { b.set(K.plaster, mulc(wall, 0.97), wear, R()); for (const uq of [0, len - 0.42]) for (let y = BASE + 0.5; y < top - 0.5; y += 0.56) F.box(b, uq, uq + (Math.round(y*4)%2 ? 0.42 : 0.3), y, y + 0.26, 0, 0.04, 2); }
    return;
  }
  // the side of a building nobody painted for you
  // windows of its own
  if (!blank && b.rich > 1 && len > 2.5) {
    const keep = G.R; G.R = R; const nb = Math.max(1, Math.floor(len/Math.max(2.6, L.space))), c2 = len/nb, S = STYLE[st] || STYLE[0];
    for (let f = 0; f < levels; f++) { const fy = f === 0 ? BASE : BASE + gh + (f - 1)*fh, flH = f === 0 ? gh : fh; if (fy + 1.2 > top) break; for (let k = 0; k < nb; k++) { if (R() < 0.18) continue; const ww = Math.min(c2*0.5, G.type === 'vasti' ? 0.7 : Math.max(0.7, S[2]*0.8 || 0.9)), wh = Math.min(flH - 1.1, Math.max(0.8, (S[3] || 1.1)*0.9)); win(b, cb, G, F, (k + 0.5)*c2, fy + (f === 0 ? 1.0 : S[5] || 0.9), ww, wh, f === 0); } }
    G.R = keep;
  }
  // old repairs: a patch of newer plaster, plaster fallen off the brick
  const np = Math.floor(len*(top - BASE)/(blank ? 14 : 30)*(0.4 + wear)) + (blank ? 1 : 0);
  for (let k = 0; k < np && k < 14; k++) { const w = 0.4 + R()*R()*3, h = 0.3 + R()*R()*2.4, u = R()*Math.max(0.1, len - w), y = BASE + 0.4 + R()*Math.max(0.1, top - BASE - h - 0.6), brick = R() < wear*0.55;
    if (brick) { b.set(K.brick, [0.52, 0.3, 0.23], 0.7, R()); F.rect(b, u, u + w, y, y + h, 0.004); F.rect(b, u + w*0.15, u + w*1.1 > len ? len : u + w*1.1, y + h*0.2, y + h*0.8, 0.0045); }
    else { b.set(K.plaster, mulc(wall, 0.84 + R()*0.28), Math.min(1, wear + 0.2), R()); F.box(b, u, u + w, y, y + h, 0, 0.007, 2 | 8); } }
  if (len < 3) return;
  // a soil stack and a rainwater pipe, with collars at every floor, an elbow in at each one
  const pipes = 1 + (R() < 0.5 ? 1 : 0) + (levels > 3 && R() < 0.5 ? 1 : 0);
  for (let q = 0; q < pipes; q++) { const u = 0.4 + R()*(len - 0.8), cp = R() < 0.6 ? 0x3a3c3e : R() < 0.5 ? 0xd8d4c8 : 0x1c1c1e, rr = 0.035 + R()*0.03;
    b.set(K.plain, cp, 0.6, R()); b.cyl(...F.P(u, 0, 0.09).slice(0, 1), BASE, F.P(u, 0, 0.09)[2], rr, rr, top - BASE, 8, 0);
    for (let f = 0; f < levels; f++) { const y = f === 0 ? BASE + 1 : BASE + gh + (f - 1)*fh + 0.5; if (y > top) break; const p = F.P(u, y, 0.09); b.cyl(p[0], y, p[2], rr + 0.012, rr + 0.012, 0.09, 8, 0); if (R() < 0.5) b.tube(F.P(u + (R() < 0.5 ? -0.5 : 0.5), y + 0.28, 0.02), [p[0], y + 0.03, p[2]], rr*0.7, 5); }
    const sp = F.P(u, top + 0.04, 0.09); b.tube(sp, [sp[0], top + 0.3, sp[2]], rr, 6); }
  // a line of vent blocks, a meter box and its cable, a spout's stain
  if (R() < 0.4 && top > BASE + 4) { b.set(K.plain, 0x1c1a18, 0.4, R()); const u = 0.5 + R()*(len - 1.6), y = BASE + 2 + R()*(top - BASE - 3); for (let a = 0; a < 3; a++) for (let c = 0; c < 2; c++) F.rect(b, u + a*0.15, u + a*0.15 + 0.1, y + c*0.14, y + c*0.14 + 0.09, 0.005); }
  if (R() < 0.45) { const u = 0.3 + R()*(len - 0.9); b.set(K.metal, 0x5a6060, 0.6, R()); F.box(b, u, u + 0.42, BASE + 1.25, BASE + 1.85, 0, 0.14, 2); b.set(K.metal, 0x3a3f3f, 0.4); F.box(b, u + 0.03, u + 0.39, BASE + 1.3, BASE + 1.8, 0.14, 0.145, 2 | 8 | 4); b.set(K.plain, 0x161414, 0.2); const c0 = F.P(u + 0.2, BASE + 1.85, 0.08), c1 = F.P(u + 0.3, top, 0.06); b.tube(c0, c1, 0.012, 3); }
  for (let k = 0, nst = 1 + (R()*3 | 0); k < nst; k++) { const u = R()*(len - 0.5); b.set(K.stain, 0x2a2622, 0.8, R()); F.rect(b, u, u + 0.12 + R()*0.3, top - 1.2 - R()*3, top, 0.003); }
}
function hasShops(G, i, len) { const ns = Math.max(1, Math.floor(len / SHOP_CELL)); for (let k = 0; k < ns; k++) if (G.shops.has(i * 4096 + k)) return true; return false; }

// ---------------------------------------------------------------- windows
function win(b, cb, G, F, uc, y0, w, h, ground) {
  const { L, type, R } = G;
  const u0 = uc - w / 2, u1 = uc + w / 2, y1 = y0 + h;
  const wcol = L.winCol;
  if (type === 'posh' || type === 'office') {
    b.set(K.glass, wcol, 0, R()); F.rect(b, u0, u1, y0, y1, 0.02);
    b.set(K.metal, 0x2a2a2c, 0.1); frameRing(b, F, u0, u1, y0, y1, 0.05, 0.03);
    F.box(b, uc - 0.025, uc + 0.025, y0, y1, 0.02, 0.05, 2 | 4 | 8);
    if (type === 'posh' && L.chajja) { b.set(K.concrete, mulc(L.wall, 0.95), L.wear); F.box(b, u0 - 0.2, u1 + 0.2, y1 + 0.15, y1 + 0.25, 0, 0.6, 2); }
    return;
  }
  const arch = L.arched && !ground;
  // the glass (a dark pane: rooms behind it)
  b.set(K.glass, wcol, L.wear, R()); F.rect(b, u0, u1, y0, y1, 0.015);
  if (arch) { b.set(K.glass, wcol, L.wear); archTop(b, F, uc, w / 2, y1, 0.015); }
  // the frame and the sill
  b.set(type === 'soc' || type === 'tower' ? K.metal : K.wood, L.frame, L.wear);
  frameRing(b, F, u0, u1, y0, y1, type === 'vasti' ? 0.04 : 0.07, 0.05);
  if (type === 'soc' || type === 'tower') F.box(b, uc - 0.03, uc + 0.03, y0, y1, 0.015, 0.05, 2 | 4 | 8);
  b.set(K.plaster, type === 'peth' && L.wk !== K.brick ? mulc(L.wall, 1.05) : [0.86, 0.84, 0.8], L.wear);
  F.box(b, u0 - 0.1, u1 + 0.1, y0 - 0.09, y0, 0, 0.11, 2);
  if (arch) { b.set(K.plaster, [0.92, 0.9, 0.86], L.wear); archRing(b, F, uc, w / 2, y1, 0.08, 0.04); }
  // wooden shutters folded back on the old houses
  if (L.shutters && (type === 'peth' || type === 'colonial' || type === 'village')) {
    b.set(K.wood, L.frame, L.wear);
    const sw = w / 2;
    F.box(b, u0 - sw - 0.02, u0 - 0.02, y0, y1, 0, 0.04, 2 | 8);
    F.box(b, u1 + 0.02, u1 + sw + 0.02, y0, y1, 0, 0.04, 2 | 8);
  }
  // grilles: box grilles (the steel cage out from the window, plants inside) or flat ones in front of the pane
  if (L.grille) {
    cb.set(K.grille, L.grilleCol, L.wear, (G.B.seed >> 4 & 7) / 255);
    if (L.boxGrille && (type === 'soc' || type === 'tower' || type === 'village' || type === 'bung')) {
      const d = 0.34;
      F.rect(cb, u0 - 0.06, u1 + 0.06, y0 - 0.06, y1 + 0.06, d);
      cb.quad(F.P(u0 - 0.06, y0 - 0.06, 0), F.P(u0 - 0.06, y0 - 0.06, d), F.P(u0 - 0.06, y1 + 0.06, d), F.P(u0 - 0.06, y1 + 0.06, 0), [-F.tx, 0, -F.tz], [0, y0, d, y0, d, y1, 0, y1]);
      cb.quad(F.P(u1 + 0.06, y0 - 0.06, 0), F.P(u1 + 0.06, y0 - 0.06, d), F.P(u1 + 0.06, y1 + 0.06, d), F.P(u1 + 0.06, y1 + 0.06, 0), [F.tx, 0, F.tz], [0, y0, d, y0, d, y1, 0, y1]);
      b.set(K.metal, L.grilleCol, L.wear);
      F.box(b, u0 - 0.08, u1 + 0.08, y1 + 0.06, y1 + 0.1, 0, d + 0.02, 2);
      F.box(b, u0 - 0.08, u1 + 0.08, y0 - 0.1, y0 - 0.06, 0, d + 0.02, 2);
      if (R() < L.plants * 0.55) { b.set(K.leaf, R() < 0.5 ? 0x4f7a3a : 0x6a8a3a, 0); const q = F.P(uc + (R() - 0.5) * w * 0.5, 0, d * 0.5); b.blob(q[0], y0 + 0.2, q[2], 0.2, 0.22, 0.2, 5); }
    } else F.rect(cb, u0 - 0.04, u1 + 0.04, y0 - 0.04, y1 + 0.04, 0.09);
  }
  // a little chajja over the window (concrete, or tin in the vastis)
  if (L.chajja && !L.band) {
    if (type === 'vasti' || type === 'village') { b.set(K.tin, [0.62, 0.6, 0.56], Math.min(1, L.wear + 0.3)); F.slope(b, u0 - 0.2, u1 + 0.2, y1 + 0.3, 0, y1 + 0.12, 0.5); }
    else { b.set(K.concrete, mulc(L.wall, 0.95), L.wear); F.box(b, u0 - 0.22, u1 + 0.22, y1 + (arch ? w / 2 : 0) + 0.12, y1 + (arch ? w / 2 : 0) + 0.2, 0, 0.45, 2); }
  }
  b.set(L.wk, L.wall, L.wear);
}
// the four sides of a frame, as one ring in front of the wall
function frameRing(b, F, u0, u1, y0, y1, t, d) {
  F.box(b, u0 - t, u1 + t, y1, y1 + t, 0, d, 2 | 8);
  F.box(b, u0 - t, u1 + t, y0 - t, y0, 0, d, 2 | 4);
  F.box(b, u0 - t, u0, y0, y1, 0, d, 2 | 4 | 8 | 32);
  F.box(b, u1, u1 + t, y0, y1, 0, d, 2 | 4 | 8 | 16);
}
// a half circle over a window (glass) and its trim
function archTop(b, F, uc, r, y, d) {
  const seg = 6;
  for (let s = 0; s < seg; s++) {
    const a0 = Math.PI * s / seg, a1 = Math.PI * (s + 1) / seg;
    b.tri(F.P(uc, y, d), F.P(uc + Math.cos(a0) * r, y + Math.sin(a0) * r, d), F.P(uc + Math.cos(a1) * r, y + Math.sin(a1) * r, d), [F.nx, 0, F.nz]);
  }
}
function archRing(b, F, uc, r, y, t, d) {
  const seg = 6;
  for (let s = 0; s < seg; s++) {
    const a0 = Math.PI * s / seg, a1 = Math.PI * (s + 1) / seg, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    b.quad(F.P(uc + c0 * r, y + s0 * r, d), F.P(uc + c0 * (r + t), y + s0 * (r + t), d), F.P(uc + c1 * (r + t), y + s1 * (r + t), d), F.P(uc + c1 * r, y + s1 * r, d), [F.nx, 0, F.nz]);
  }
}
function doorway(b, G, F, uc, cell) {
  const { L, type, R } = G;
  const w = type === 'posh' || type === 'office' ? Math.min(cell * 0.7, 2.2) : Math.min(cell * 0.6, 1.1), h = 2.25;
  const u0 = uc - w / 2, u1 = uc + w / 2;
  if (type === 'posh' || type === 'office') {
    b.set(K.glass, 0x3a4a52, 0, R()); F.rect(b, u0, u1, BASE, BASE + h, 0.02);
    b.set(K.metal, 0x2a2a2c, 0); frameRing(b, F, u0, u1, BASE, BASE + h, 0.06, 0.05);
    b.set(K.marble, 0xd8d4cc, 0); F.box(b, u0 - 0.6, u1 + 0.6, 0, BASE + 0.12, 0, 1.2, 2 | 8);
    b.set(K.cladding, mulc(L.wall, 0.7), 0); F.box(b, u0 - 0.6, u1 + 0.6, BASE + h + 0.25, BASE + h + 0.45, 0, 1.4, 2);
    b.set(L.wk, L.wall, L.wear); return;
  }
  b.set(K.wood, DOORS[(R() * DOORS.length) | 0], L.wear); F.rect(b, u0, u1, BASE, BASE + h, 0.03);
  b.set(K.plaster, mulc(L.trim, 1), L.wear); frameRing(b, F, u0, u1, BASE, BASE + h, 0.1, 0.06);
  b.set(K.stone, 0x6a645c, L.wear); F.box(b, u0 - 0.25, u1 + 0.25, 0, BASE + 0.18, 0, 0.45, 2 | 8);
  if (type !== 'vasti' && R() < 0.5) { b.set(K.concrete, mulc(L.wall, 0.9), L.wear); F.box(b, u0 - 0.35, u1 + 0.35, BASE + h + 0.25, BASE + h + 0.33, 0, 0.7, 2); }
  // the electricity meter box beside it, and a rangoli on the step
  if (R() < 0.6) { b.set(K.metal, 0x8a8e8a, L.wear); F.box(b, u1 + 0.3, u1 + 0.75, BASE + 1.5, BASE + 2.1, 0, 0.16, 2); }
  if (R() < L.rangoli) { const cb = G.cb; cb.set(K.rangoli, 0xffffff, 0, G.R()); const c = F.P(uc, 0, 0.8); cb.quad([c[0] - 0.4, 0.172, c[2] - 0.4], [c[0] + 0.4, 0.172, c[2] - 0.4], [c[0] + 0.4, 0.172, c[2] + 0.4], [c[0] - 0.4, 0.172, c[2] + 0.4], [0, 1, 0], [-0.4, -0.4, 0.4, -0.4, 0.4, 0.4, -0.4, 0.4]); }
  b.set(L.wk, L.wall, L.wear);
}

// ---------------------------------------------------------------- balconies, galleries
function balcony(b, cb, G, F, u0, u1, fy, flH) {
  const { L, type, R } = G;
  const d = type === 'posh' ? 1.4 : type === 'peth' ? 0.9 : 1.05;
  // the room's opening behind (a door and a window, dark)
  b.set(K.glass, L.winCol, L.wear, R()); F.rect(b, u0 + 0.2, u1 - 0.2, fy + 0.05, fy + Math.min(2.3, flH - 0.4), 0.015);
  if (G.L.gallery && type === 'peth' && fy < BASE + G.gh + 0.1) {
    // a wada's carved wooden gallery
    b.set(K.wood, 0x5a3a24, L.wear);
    F.box(b, u0, u1, fy - 0.05, fy + 0.1, 0, d, 2);
    F.box(b, u0, u1, fy + 0.9, fy + 1.0, d - 0.08, d, 2);
    for (let uu = u0 + 0.05; uu < u1 - 0.1; uu += 1.3) F.box(b, uu, uu + 0.14, fy + 0.1, fy + flH, d - 0.14, d, 2 | 8);
    cb.set(K.grille, 0x5a3a24, L.wear, 3 / 255); F.rect(cb, u0, u1, fy + 0.1, fy + 0.9, d - 0.04);
    return;
  }
  b.set(K.concrete, L.wk === K.brick ? [0.72, 0.7, 0.66] : mulc(L.wall, 0.96), L.wear);
  F.box(b, u0, u1, fy - 0.03, fy + 0.12, 0, d, 2);
  const rh = 1.0;
  if (L.glassRail) {
    b.set(K.glass, 0x7a9aa0, 0, R()); F.box(b, u0, u1, fy + 0.12, fy + rh, d - 0.04, d - 0.02, 2 | 8);
    b.set(K.metal, 0x2a2a2c, 0); F.box(b, u0, u1, fy + rh, fy + rh + 0.04, d - 0.06, d, 2);
  } else if (R() < 0.45 || type === 'soc') {
    // a plastered parapet with a rail on top (and the plants on it)
    b.set(L.wk === K.brick ? K.plaster : L.wk, L.accent && R() < 0.5 ? L.accent : L.wall, L.wear);
    F.box(b, u0, u1, fy + 0.12, fy + 0.85, d - 0.12, d, 2 | 8);
    F.box(b, u0, u0 + 0.1, fy + 0.12, fy + 0.85, 0, d - 0.12, 2 | 8 | 1);
    F.box(b, u1 - 0.1, u1, fy + 0.12, fy + 0.85, 0, d - 0.12, 2 | 8 | 1);
    cb.set(K.grille, L.grilleCol, L.wear, 1 / 255); F.rect(cb, u0, u1, fy + 0.85, fy + rh + 0.05, d - 0.06);
    if (R() < L.plants) for (let uu = u0 + 0.3; uu < u1 - 0.3; uu += 0.5 + R()) { b.set(K.plain, 0x9a5a3a, 0.3); const P0 = F.P(uu, 0, d - 0.06); b.cyl(P0[0], fy + 0.85, P0[2], 0.1, 0.13, 0.2, 6); b.set(K.leaf, R() < 0.5 ? 0x4f7a3a : 0x5e8a40, 0); b.blob(P0[0], fy + 1.18, P0[2], 0.2, 0.2, 0.2, 5); }
  } else {
    // MS railings
    cb.set(K.grille, L.grilleCol, L.wear, ((G.B.seed >> 7) & 3) / 255 + 4 / 255);
    F.rect(cb, u0, u1, fy + 0.12, fy + rh, d - 0.03);
    cb.quad(F.P(u0, fy + 0.12, 0), F.P(u0, fy + 0.12, d), F.P(u0, fy + rh, d), F.P(u0, fy + rh, 0), [-F.tx, 0, -F.tz], [0, fy, d, fy, d, fy + rh, 0, fy + rh]);
    cb.quad(F.P(u1, fy + 0.12, 0), F.P(u1, fy + 0.12, d), F.P(u1, fy + rh, d), F.P(u1, fy + rh, 0), [F.tx, 0, F.tz], [0, fy, d, fy, d, fy + rh, 0, fy + rh]);
    b.set(K.metal, L.grilleCol, L.wear); F.box(b, u0, u1, fy + rh, fy + rh + 0.05, d - 0.06, d, 2);
  }
  // washing on a line, a sari over the rail
  if (R() < L.laundry * 0.8) {
    cb.set(K.laundry, CLOTH[(R() * CLOTH.length) | 0], 0, R());
    const ya = fy + Math.min(2.2, flH - 0.5);
    let uu = u0 + 0.2 + R() * 0.3;
    while (uu < u1 - 0.5) { const w = 0.3 + R() * 0.5, hh = 0.4 + R() * 0.6; cb.col(CLOTH[(R() * CLOTH.length) | 0]); F.rect(cb, uu, Math.min(u1 - 0.2, uu + w), ya - hh, ya, d * 0.55); uu += w + 0.1 + R() * 0.3; }
    b.set(K.plain, 0x2a2a2a, 0); b.tube(F.P(u0 + 0.1, ya, d * 0.55), F.P(u1 - 0.1, ya, d * 0.55), 0.008, 3);
  }
  if (L.kandil && R() < 0.35) kandil(b, F.P((u0 + u1) / 2, 0, d - 0.3), fy + flH - 0.55, R);
  b.set(L.wk, L.wall, L.wear);
}
function kandil(b, P, y, R) {
  const col = [[1, 0.55, 0.1], [1, 0.2, 0.3], [0.2, 0.6, 1], [1, 0.85, 0.2], [0.6, 0.2, 0.9], [0.1, 0.8, 0.4]][(R() * 6) | 0];
  b.set(K.glow, col, 0, 0.5);
  b.blob(P[0], y, P[2], 0.22, 0.28, 0.22, 4);
  b.set(K.cloth, mulc(col, 0.8), 0); b.cyl(P[0], y - 0.65, P[2], 0.02, 0.12, 0.38, 4, 0);
}

// ---------------------------------------------------------------- shops
function shopFront(b, cb, G, F, i, len, shopEdge) {
  const { L, gh, R, type } = G;
  const ns = Math.max(1, Math.floor(len / SHOP_CELL)), cw = len / ns, oh = gh - 0.85;
  const W = F, yT = BASE + gh;
  b.set(L.wk === K.curtain ? K.cladding : L.wk, L.wall, L.wear);
  for (let k = 0; k < ns; k++) {
    const sh = G.shops.get(i * 4096 + k);
    const a = k * cw + 0.18, c = (k + 1) * cw - 0.18;
    if (!shopEdge) {
      // a business on a wall with no shutters of its own (the game gives it a board and a door, never a shutter): a
      // glazed front in the wall, so it never looks open when it's shut
      W.rect(b, k * cw, (k + 1) * cw, BASE, yT, 0);
      if (!sh) continue;
      const lux = (sh[2] === 'brand' ? 0.55 : 0) + L.rich * 0.55;
      b.set(K.glass, lux > 0.6 ? 0x6a8088 : 0x4a5a5e, L.wear * 0.5, R()); W.rect(b, a + 0.1, c - 0.1, BASE + 0.35, BASE + oh, 0.025);
      b.set(K.metal, lux > 0.6 ? 0x2a2a2c : L.frame, L.wear); frameRing(b, W, a + 0.1, c - 0.1, BASE + 0.35, BASE + oh, 0.06, 0.05);
      const dm = (a + c) / 2; W.box(b, dm - 0.03, dm + 0.03, BASE + 0.35, BASE + oh, 0.02, 0.05, 2 | 4 | 8);
      b.set(K.stone, 0x6a645c, L.wear); W.box(b, a, c, 0, BASE + 0.35, 0, 0.3, 2 | 8);
      b.set(K.metal, 0x1e1e20, 0.2);
      const t0 = k * cw + 0.15, t1 = (k + 1) * cw - 0.15, h = Math.min(0.85, (t1 - t0) / 4.1), y1 = BASE + gh - 0.1, y0 = y1 - h;
      W.box(b, t0 - 0.03, t1 + 0.03, y1, y1 + 0.04, -0.05, 0.12, 2); W.box(b, t0 - 0.03, t1 + 0.03, y0 - 0.04, y0, -0.05, 0.12, 2);
      b.set(L.wk === K.curtain ? K.cladding : L.wk, L.wall, L.wear);
      continue;
    }
    // the pillars either side and the band over the opening (where the board goes)
    W.rect(b, k * cw, a, BASE, yT, 0); W.rect(b, c, (k + 1) * cw, BASE, yT, 0);
    const trade = sh ? (TRADE[sh[1]] ?? 0) : -1, brand = sh && sh[2] === 'brand', famous = sh && sh[2] === 'trad';
    const lux = (brand ? 0.55 : 0) + L.rich * 0.55 + (trade === 5 ? 0.25 : 0) - (famous ? 0.2 : 0);
    if (lux > 0.75 && sh) { b.set(K.cladding, R() < 0.5 ? [0.2, 0.2, 0.22] : [0.86, 0.85, 0.82], 0.05); W.box(b, a - 0.18, c + 0.18, BASE + oh, yT, 0, 0.12, 2); b.set(L.wk, L.wall, L.wear); }
    else W.rect(b, a, c, BASE + oh, yT, 0);
    shopInside(b, cb, G, F, a, c, oh, trade, lux, sh, famous);
    if (!sh) continue;
    // the board's frame (the board itself is the game's)
    const t0 = k * cw + 0.15, t1 = (k + 1) * cw - 0.15, w = t1 - t0, h = Math.min(0.85, w / 4.1), y1 = BASE + gh - 0.1, y0 = y1 - h;
    b.set(K.metal, 0x1e1e20, 0.2);
    W.box(b, t0 - 0.03, t1 + 0.03, y1, y1 + 0.04, -0.05, 0.12, 2);
    W.box(b, t0 - 0.03, t1 + 0.03, y0 - 0.04, y0, -0.05, 0.12, 2);
    // an awning over the old bazaar shops: a tin sheet or a striped tarp
    if (lux < 0.6 && R() < L.awning * (type === 'peth' ? 0.9 : 0.55)) {
      if (R() < 0.45) { b.set(K.tin, [0.6, 0.58, 0.54], Math.min(1, L.wear + 0.25)); W.slope(b, a - 0.1, c + 0.1, y0 - 0.05, 0.12, y0 - 0.5, 1.25); }
      else { b.set(K.cloth, POP[(R() * POP.length) | 0], 0.3, R()); W.slope(b, a - 0.1, c + 0.1, y0 - 0.05, 0.12, y0 - 0.45, 1.1); }
    }
    // a raised step (ota) in front of the old shops
    if (type === 'peth' || type === 'village' || famous) { b.set(K.stone, 0x6a645c, L.wear); W.box(b, a - 0.1, c + 0.1, 0, BASE + 0.18, 0, 0.42, 2 | 8); }
    else if (lux > 0.75) { b.set(K.marble, 0x8a8682, 0); W.box(b, a - 0.1, c + 0.1, 0, BASE + 0.1, 0, 0.5, 2 | 8); }
  }
  b.set(L.wk, L.wall, L.wear);
}
// how far in from (x, z) the building goes, along -n (the shop can't be deeper than the building)
function depthAt(p, x, z, nx, nz) {
  let best = 30;
  const dx = -nx, dz = -nz;
  for (let i = 0, n = p.length / 2; i < n; i++) {
    const j = (i + 1) % n, ax = p[2 * i], az = p[2 * i + 1], ex = p[2 * j] - ax, ez = p[2 * j + 1] - az;
    const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - x) * ez - (az - z) * ex) / den, s = ((ax - x) * dz - (az - z) * dx) / den;
    if (t > 0.05 && s >= 0 && s <= 1 && t < best) best = t;
  }
  return best;
}
const GOODS = [
  [0xf2c230, 0xd83a2a, 0x2f5fd0, 0xeee8dc, 0x2f8a5a, 0xf08a24, 0xc8a070],           // kirana
  [0xd8c8a0, 0xeee8dc, 0xc8a070, 0xb85a2a],                                           // food
  [0xeef2ee, 0x2f8a5a, 0xd8e8f0, 0xf2f2ec],                                           // medical
  [0xd8dce0, 0xb8c0c8, 0x8a96a0],                                                      // office
  [0xd83a2a, 0x2f5fd0, 0xf2c230, 0xe86a9a, 0x7a3ab8, 0xeeeae0, 0x1a1a2a],             // clothes
  [0xe8c060, 0xd8a840, 0xf2e2b0],                                                      // jewellery
  [0x2a2a2e, 0xe8e8ec, 0x2f5fd0, 0xd83a2a],                                           // mobile
  [0x8a3a2a, 0x2a4a6a, 0x3a6a3a, 0xc8a070, 0xeee8dc],                                 // books
  [0x8a8e92, 0x5a5e62, 0xc8642a, 0x2f5fd0, 0xd8c040],                                 // hardware
  [0x2a2a2a, 0x4a4a4a, 0x8a3a2a],                                                      // garage
  [0xe8e0d8, 0x2a2a2e, 0xd8a0b0],                                                      // salon
  [0xf2c230, 0xf08a24, 0xeee8dc, 0xd86a8a, 0x8a5a2a],                                 // sweets
  [0x2a2a2e, 0x8a5a3a, 0xe8e8ec, 0xd83a2a],                                           // shoes
  [0xd9a35b, 0xe8c27a, 0xc98a3a, 0xf0e0b0, 0xf2d8a0, 0xb8742e, 0xfaf3e3],             // bakery
];
function shopInside(b, cb, G, F, a, c, oh, trade, lux, sh, famous) {
  const { R, L } = G;
  const mid = F.P((a + c) / 2, 0, 0);
  const D = Math.max(0.6, Math.min(trade === 3 || trade === 1 ? 3.2 : 2.4, depthAt(G.p, mid[0], mid[2], F.nx, F.nz) - 0.35));
  const yb = BASE, yt = BASE + oh;
  // the room
  const wallC = trade === 2 ? 0xeef0ea : trade === 5 ? 0xe8d8b8 : trade === 9 ? 0x5a5650 : trade === 3 ? 0xe8eae8 : [0x8a6a48, 0x9a7a52, 0x7a6a58, 0xd8c8a8, 0xe0d8c8][(R() * 5) | 0];
  b.set(K.inside, wallC, trade === 9 ? 0.8 : 0.2, R());
  F.rect(b, c, a, yb, yt, -D, 1);                                          // the back wall (seen from the street)
  b.quad(F.P(a, yb, 0), F.P(a, yb, -D), F.P(a, yt, -D), F.P(a, yt, 0), [F.tx, 0, F.tz]);
  b.quad(F.P(c, yb, 0), F.P(c, yb, -D), F.P(c, yt, -D), F.P(c, yt, 0), [-F.tx, 0, -F.tz]);
  b.set(K.inside, trade === 9 ? 0x4a4640 : 0xe8e4d8, 0.2); b.quad(F.P(a, yt, 0), F.P(c, yt, 0), F.P(c, yt, -D), F.P(a, yt, -D), [0, -1, 0]);
  b.set(lux > 0.6 ? K.marble : K.sqTiles, lux > 0.6 ? 0xd8d0c4 : [0xb8b0a0, 0xc8c0b0, 0x8a8478][(R() * 3) | 0], 0.3); b.quad(F.P(a, yb + 0.01, 0), F.P(c, yb + 0.01, 0), F.P(c, yb + 0.01, -D), F.P(a, yb + 0.01, -D), [0, 1, 0]);
  if (!sh) return;                                                          // nobody's: the shutter stays down
  // the tube light
  b.set(K.glow, trade === 5 ? [1, 0.92, 0.75] : [0.95, 0.98, 1], 0, 0.9); F.box(b, a + 0.3, Math.min(c - 0.3, a + 1.5), yt - 0.06, yt - 0.02, -D * 0.4 - 0.04, -D * 0.4, 0);
  // the stock: shelves painted on the back wall (one quad), then a few real things
  if (trade !== 3 && trade !== 9 && trade !== 10 && trade !== 13) { b.set(K.goods, 0xffffff, 0.2, (trade * 16 + ((R() * 16) | 0)) / 255); F.rect(b, c - 0.05, a + 0.05, yb + 0.3, yt - 0.15, -D + 0.04, 1); }
  const gc = GOODS[Math.max(0, trade)] || GOODS[0];
  const pc = () => gc[(R() * gc.length) | 0];
  const w = c - a;
  switch (trade) {
    case 0: case 8: case 11: {                                             // kirana, hardware, sweets: a counter, sacks, hanging packets
      b.set(K.wood, [0x5a4232, 0x2f5a4a, 0x8a6a48][(R() * 3) | 0], L.wear); F.box(b, a + 0.2, c - 0.6, yb, yb + 0.95, -0.95, -0.55, 2 | 8);
      if (trade === 11) { b.set(K.glass, 0xa8c0c0, 0, R()); F.box(b, a + 0.2, c - 0.6, yb + 0.95, yb + 1.35, -0.95, -0.55, 2 | 8); }
      for (let s = 0; s < 3; s++) { if (R() < 0.5) continue; const uu = a + 0.3 + R() * (w - 0.6); const P0 = F.P(uu, 0, -0.25); b.set(K.cloth, [0xeee8dc, 0xd8c8a0, 0xc8a070][s], 0.3); b.blob(P0[0], yb + 0.32, P0[2], 0.22, 0.32, 0.22, 5); }
      if (trade === 0 && R() < 0.8) { cb.set(K.laundry, 0xffffff, 0, R()); for (let uu = a + 0.1; uu < c - 0.2; uu += 0.32 + R() * 0.2) { cb.col(pc()); F.rect(cb, uu, uu + 0.2, yt - 0.9 - R() * 0.4, yt - 0.05, 0.06); } }
      if (trade === 8) { b.set(K.metal, 0x8a8e92, 0.4); for (let s = 0; s < 4; s++) { const P0 = F.P(a + 0.3 + R() * (w - 0.6), 0, -D * 0.6); b.tube([P0[0], yb, P0[2]], [P0[0] + (R() - 0.5) * 0.3, yb + 1.6 + R() * 0.6, P0[2]], 0.03, 4); } }
      break;
    }
    case 1: {                                                              // food: a counter at the front, a menu, tables inside
      b.set(lux > 0.6 ? K.wood : K.sqTiles, lux > 0.6 ? 0x6a4a32 : 0xd8d8d0, 0.3); F.box(b, a + 0.15, a + Math.min(1.6, w * 0.45), yb, yb + 1.0, -0.8, -0.2, 2 | 8);
      b.set(K.glass, 0xb8c8c8, 0, R()); F.box(b, a + 0.15, a + Math.min(1.6, w * 0.45), yb + 1.0, yb + 1.35, -0.8, -0.3, 2 | 8);
      b.set(K.ad, pc(), 0, R()); F.rect(b, c - 0.2, c - 1.3, yb + 1.5, yb + 2.1, -D + 0.05, 1);
      if (D > 1.8) for (let s = 0; s < 2; s++) { const uu = a + 0.6 + (s + 0.5) * (w - 0.8) / 2; b.set(K.plain, lux > 0.6 ? 0x5a3a2a : 0xd8d8d4, 0.2); F.box(b, uu - 0.35, uu + 0.35, yb + 0.7, yb + 0.75, -D + 0.5, -D + 1.2, 2); F.box(b, uu - 0.04, uu + 0.04, yb, yb + 0.7, -D + 0.8, -D + 0.88, 2 | 4 | 8); }
      if (lux > 0.6 && R() < 0.6) { b.set(K.leaf, 0x4f7a3a, 0); const P0 = F.P(c - 0.3, 0, 0.35); b.set(K.plain, 0x3a3a3a, 0); b.cyl(P0[0], 0, P0[2], 0.2, 0.25, 0.45, 6); b.set(K.leaf, 0x4f7a3a, 0); b.blob(P0[0], 0.9, P0[2], 0.32, 0.45, 0.32, 5); }
      break;
    }
    case 2: case 5: case 6: {                                              // chemist, jeweller, mobiles: glass counters, bright
      b.set(K.glass, trade === 5 ? 0xd8c890 : 0xc8d8d8, 0, R()); F.box(b, a + 0.2, c - 0.2, yb, yb + 1.0, -D + 0.3, -D + 0.8, 2 | 8);
      b.set(K.wood, trade === 5 ? 0x5a2a1a : 0xe8e8e4, 0.1); F.box(b, a + 0.25, c - 0.25, yb + 0.95, yb + 1.0, -D + 0.3, -D + 0.85, 2);
      if (trade === 5) { b.set(K.glow, [1, 0.85, 0.5], 0, 0.95); for (let s = 0; s < 3; s++) F.box(b, a + 0.4 + s * (w - 0.8) / 3, a + 0.55 + s * (w - 0.8) / 3, yt - 0.05, yt - 0.01, -D * 0.5 - 0.07, -D * 0.5 + 0.07, 0); }
      if (trade === 2 && sh) { b.set(K.glow, [0.2, 0.85, 0.35], 0, 0.95); F.box(b, c - 0.2, c + 0.1, yt + 0.12, yt + 0.42, 0.05, 0.12, 2); }
      if (lux > 0.6) { b.set(K.glass, 0x8aa0a8, 0, R()); F.rect(b, a, c, yb, yt, 0.0); }        // a glass front
      break;
    }
    case 3: {                                                              // bank, office: a glass front and a desk
      b.set(K.plain, 0xb8b8b4, 0.1); F.box(b, a + 0.4, c - 0.4, yb, yb + 0.8, -D + 0.6, -D + 1.2, 2 | 8);
      b.set(K.glass, 0x7a9098, 0, R()); F.rect(b, a, c, yb, yt, 0.0);
      b.set(K.metal, 0x2a2a2c, 0); F.box(b, (a + c) / 2 - 0.03, (a + c) / 2 + 0.03, yb, yt, 0, 0.04, 2);
      break;
    }
    case 4: case 12: {                                                     // clothes, shoes: things hanging, a mannequin at the door
      if (trade === 4) { cb.set(K.laundry, 0xffffff, 0, R()); for (let uu = a + 0.1; uu < c - 0.3; uu += 0.35 + R() * 0.25) { cb.col(pc()); F.rect(cb, uu, uu + 0.28, yt - 1.4 - R() * 0.3, yt - 0.25, -D * 0.5); } }
      b.set(K.wood, 0x6a4a32, 0.2); F.box(b, a + 0.3, c - 0.3, yb, yb + 0.9, -D + 0.35, -D + 0.9, 2 | 8);
      if (R() < 0.6) { const P0 = F.P(a + 0.4, 0, -0.35); b.set(K.cloth, pc(), 0.1); b.cyl(P0[0], yb, P0[2], 0.16, 0.2, 1.1, 6, 1); b.set(K.plain, 0xe8d8c8, 0); b.blob(P0[0], yb + 1.3, P0[2], 0.1, 0.13, 0.1, 4); }
      if (lux > 0.6) { b.set(K.glass, 0x8aa0a8, 0, R()); F.rect(b, a, c, yb, yt, 0.0); }
      break;
    }
    case 13: {                                                             // a Pune bakery: the glass case at the front, jars on it, bread behind
      b.set(K.wood, [0x8a5a32, 0xe8e4dc, 0x5a3a22][(R() * 3) | 0], L.wear); F.box(b, a + 0.15, c - 0.15, yb, yb + 0.75, -0.9, -0.4, 2 | 8);
      b.set(K.glass, 0xd8e8e0, 0, R()); F.box(b, a + 0.15, c - 0.15, yb + 0.75, yb + 1.15, -0.9, -0.4, 2 | 8);
      for (let uu = a + 0.25; uu < c - 0.4; uu += 0.32) { b.set(K.plain, pc(), 0.2); F.box(b, uu, uu + 0.26, yb + 0.78, yb + 0.84, -0.8, -0.5, 2); }
      for (let uu = a + 0.3; uu < c - 0.35; uu += 0.28) { if (R() < 0.3) continue; b.set(K.glass, 0xe8e2cc, 0, R()); F.box(b, uu, uu + 0.16, yb + 1.15, yb + 1.4, -0.75, -0.6, 2 | 4 | 8); b.set(K.plain, 0xc8302a, 0.1); F.box(b, uu - 0.005, uu + 0.165, yb + 1.4, yb + 1.44, -0.755, -0.595, 2); }
      if (D > 1.2) {
        b.set(K.wood, 0x6a4a32, 0.3);
        for (let s = 0; s < 4; s++) {
          const y = yb + 0.5 + s * 0.45; if (y > yt - 0.3) break;
          F.box(b, a + 0.1, c - 0.1, y, y + 0.03, -D + 0.05, -D + 0.4, 2);
          for (let uu = a + 0.15; uu < c - 0.3; uu += 0.22 + R() * 0.08) { b.set(K.plain, pc(), 0.2); F.box(b, uu, uu + 0.18, y + 0.03, y + 0.15 + R() * 0.08, -D + 0.1, -D + 0.32, 2 | 4 | 8); }
          b.set(K.wood, 0x6a4a32, 0.3);
        }
      }
      if (w > 2.2 && D > 1.8) { b.set(K.glow, [1, 0.96, 0.88], 0, 0.85); F.box(b, c - 0.75, c - 0.15, yb, yb + 1.8, -D + 0.45, -D + 1.0, 2); }
      break;
    }
    case 7: { b.set(K.wood, 0x5a4232, 0.3); F.box(b, a + 0.2, c - 0.2, yb, yb + 0.9, -0.9, -0.4, 2 | 8); break; }      // books: a table of them at the front
    case 9: {                                                              // garage: tyres, an oily floor, a bike on its stand
      b.set(K.plain, 0x1a1a1a, 0.6); for (let s = 0; s < 4; s++) { const P0 = F.P(a + 0.3 + R() * (w - 0.6), 0, -D + 0.3 + R() * 0.3); b.cyl(P0[0], yb + s * 0.0, P0[2], 0.3, 0.3, 0.2 + (s % 2) * 0.2, 8); }
      b.set(K.stain, 0x1a1a1a, 0.8); F.box(b, a + 0.4, c - 0.4, yb + 0.012, yb + 0.014, -D + 0.2, -0.2, 2 | 8 | 16 | 32);
      break;
    }
    case 10: {                                                             // salon, gym: mirrors and a chair
      b.set(K.glass, 0xc8d8e0, 0, R()); F.rect(b, c - 0.1, a + 0.1, yb + 0.9, yb + 2.0, -D + 0.04, 1);
      b.set(K.plain, 0x1a1a1e, 0.1); F.box(b, a + w * 0.3, a + w * 0.3 + 0.55, yb, yb + 0.95, -D + 0.6, -D + 1.15, 2);
      break;
    }
  }
  if (famous && R() < 0.7) { b.set(K.wood, 0x3a2a1e, 0.6); F.box(b, a + 0.1, c - 0.1, yb, yb + 0.6, -0.5, -0.1, 2 | 8); }   // an old counter, the queue's
  b.set(L.wk, L.wall, L.wear);
}

// ---------------------------------------------------------------- stilt parking, colonial arcades
function stilt(b, G, F, len) {
  const { L, gh, R } = G;
  const m = F.P(len / 2, 0, 0), D = Math.max(1.2, Math.min(4, depthAt(G.p, m[0], m[2], F.nx, F.nz) - 0.5));
  const yt = BASE + gh;
  b.set(K.concrete, [0.62, 0.6, 0.56], L.wear);
  const nb = Math.max(1, Math.round(len / 4.5)), cell = len / nb;
  for (let k = 0; k <= nb; k++) { const u = Math.min(len - 0.2, Math.max(0, k * cell - 0.2)); F.box(b, u, u + 0.4, BASE, yt, -0.4, 0, 2 | 8 | 4); }
  F.rect(b, 0, len, yt - 0.45, yt, 0);                                    // the beam
  b.set(K.inside, 0x5a5a56, 0.6, 0); F.rect(b, len, 0, BASE, yt - 0.45, -D, 1);
  b.quad(F.P(0, yt - 0.45, 0), F.P(len, yt - 0.45, 0), F.P(len, yt - 0.45, -D), F.P(0, yt - 0.45, -D), [0, -1, 0]);
  b.set(K.concrete, 0x6a6862, 0.6); b.quad(F.P(0, BASE, 0), F.P(len, BASE, 0), F.P(len, BASE, -D), F.P(0, BASE, -D), [0, 1, 0]);
  // (no drawn two-wheelers under the stilts: only vehicles you can ride are vehicles)
  if (len > 6 && D > 3 && R() < 0.5) { const P0 = F.P(len * 0.7, 0, -D + 1.6); b.set(K.cloth, [0x8a8a86, 0x3a4a6a, 0xb8b0a0][(R() * 3) | 0], 0.3); b.ybox(P0[0], BASE, P0[2], 4.0, BASE + 1.4, 1.8, Math.atan2(F.tz, F.tx), 8); }
  b.set(L.wk, L.wall, L.wear);
}
function arcade(b, G, F, len) {
  const { L, gh } = G;
  const D = 2.2, yt = BASE + gh;
  const nb = Math.max(2, Math.round(len / 3)), cell = len / nb;
  b.set(K.plaster, L.trim[0] > 0.8 ? L.trim : [0.95, 0.93, 0.88], L.wear);
  for (let k = 0; k <= nb; k++) { const u = Math.min(len - 0.25, Math.max(0, k * cell - 0.25)); F.box(b, u, u + 0.5, BASE, yt, -0.5, 0, 2 | 8 | 4); }
  for (let k = 0; k < nb; k++) {                                            // the arch over each bay
    const u0 = k * cell + 0.25, u1 = (k + 1) * cell - 0.25, uc = (u0 + u1) / 2, r = (u1 - u0) / 2, ys = yt - 0.4 - r;
    F.rect(b, u0, u1, ys + r, yt, 0);
    for (let s = 0; s < 5; s++) {
      const a0 = Math.PI * s / 5, a1 = Math.PI * (s + 1) / 5;
      b.quad(F.P(uc + Math.cos(a0) * r, ys + Math.sin(a0) * r, 0), F.P(uc + Math.cos(a0) * r, ys + r, 0), F.P(uc + Math.cos(a1) * r, ys + r, 0), F.P(uc + Math.cos(a1) * r, ys + Math.sin(a1) * r, 0), [F.nx, 0, F.nz]);
    }
  }
  b.set(K.plaster, mulc(L.wall, 0.9), L.wear); F.rect(b, len, 0, BASE, yt, -D, 1);
  b.set(K.inside, 0xb8b0a0, 0.3, 0); b.quad(F.P(0, yt - 0.4, 0), F.P(len, yt - 0.4, 0), F.P(len, yt - 0.4, -D), F.P(0, yt - 0.4, -D), [0, -1, 0]);
  b.set(K.sqTiles, 0x9a8a78, 0.4); b.quad(F.P(0, BASE + 0.01, 0), F.P(len, BASE + 0.01, 0), F.P(len, BASE + 0.01, -D), F.P(0, BASE + 0.01, -D), [0, 1, 0]);
  // doors and windows in the back of the verandah
  for (let k = 0; k < nb; k++) { const uc = (k + 0.5) * cell; b.set(K.wood, L.frame, L.wear); F.rect(b, uc + 0.5, uc - 0.5, BASE, BASE + 2.3, -D + 0.02, 1); }
  b.set(L.wk, L.wall, L.wear);
}
function bike(b, x, y, z, yaw, col) {
  const c = Math.cos(yaw), s = Math.sin(yaw), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  b.set(K.plain, 0x161616, 0.3);
  for (const lz of [-0.6, 0.6]) { const q = at(0, lz); b.ybox(q[0], y, q[1], 0.08, y + 0.52, 0.52, -yaw, 8); }
  b.set(K.paint, col, 0.2); { const q = at(0, -0.05); b.ybox(q[0], y + 0.3, q[1], 0.3, y + 0.62, 1.1, -yaw, 8); }
  { const q = at(0, 0.52); b.ybox(q[0], y + 0.3, q[1], 0.36, y + 0.98, 0.15, -yaw, 8); }
  b.set(K.plain, 0x1c1a1a, 0.3); { const q = at(0, -0.22); b.ybox(q[0], y + 0.62, q[1], 0.32, y + 0.72, 0.7, -yaw, 8); }
}
export { bike };

// ---------------------------------------------------------------- wall details
function acUnit(b, F, u, y) {
  b.set(K.plain, [0.88, 0.88, 0.86], 0.3); F.box(b, u - 0.4, u + 0.4, y, y + 0.56, 0, 0.3, 2);
  b.set(K.metal, [0.25, 0.25, 0.26], 0.2); F.rect(b, u - 0.3, u + 0.1, y + 0.1, y + 0.46, 0.305);
  b.set(K.metal, [0.4, 0.4, 0.4], 0.5); F.box(b, u - 0.45, u + 0.45, y - 0.05, y, 0, 0.34, 2);
}
function pipe(b, F, u, top) {
  b.set(K.plain, [0.3, 0.3, 0.3], 0.6);
  const a = F.P(u, 0.2, 0.08), c = F.P(u, top, 0.08);
  b.tube(a, c, 0.05, 4);
}
// a painted advert on a blank side wall
function painted(b, F, len, G) {
  const R = G.R, w = Math.min(len - 1, 3 + R() * 4), u0 = (len - w) / 2, y0 = BASE + 2 + R() * 2;
  if (y0 + 2 > G.top) return;
  b.set(K.ad, POP[(R() * POP.length) | 0], G.L.wear, R()); F.rect(b, u0, u0 + w, y0, y0 + Math.min(3, w * 0.5), 0.01);
  b.set(G.L.wk, G.L.wall, G.L.wear);
}
// the cables stapled along an old front, the meter boxes they run to
function facadeWires(b, G, F, len) {
  const { R, gh, L } = G;
  const y = BASE + gh + 0.25 + R() * 0.4, n = 1 + ((R() * 4 * L.wires) | 0);
  b.set(K.plain, 0x161414, 0.2);
  for (let k = 0; k < n; k++) {
    const yy = y + k * 0.07, d = 0.06 + k * 0.03;
    b.cable(F.P(0, yy, d), F.P(len, yy + (R() - 0.5) * 0.2, d), 0.12 + R() * 0.25, 0.011, 5);
  }
  // a drop to the ground and a bunch of loops
  if (R() < 0.6) { const u = R() * len; b.tube(F.P(u, y, 0.08), F.P(u + 0.1, BASE + 1.6, 0.06), 0.012, 3); b.set(K.metal, 0x5a6060, 0.6); F.box(b, u - 0.2, u + 0.25, BASE + 1.3, BASE + 1.7, 0, 0.14, 2); }
  if (R() < 0.4) { b.set(K.plain, 0x161414, 0.2); const u = R() * len; for (let s = 0; s < 3; s++) b.cable(F.P(u - 0.3, y - 0.1, 0.1), F.P(u + 0.3, y - 0.1, 0.1), 0.25 + s * 0.12, 0.011, 4); }
}
// cables strung across the lanes, front to front (the old city's tangle)
function overLanes(bs, ctx) {
  const F = ctx.fronts;
  if (F.length < 2) return;
  let made = 0;
  for (let i = 0; i < F.length && made < 160; i++) {
    const a = F[i];
    if (a.w < 0.45) continue;
    const R = rng(a.B.seed ^ 0x5bd1e995);
    if (R() > a.w) continue;
    const ua = a.len * (0.2 + R() * 0.6), pa = a.F.P(ua, 0, 0);
    // the nearest front across, facing back at this one
    let best = null, bd = 16;
    for (let j = 0; j < F.length; j++) {
      if (j === i || F[j].B === a.B) continue;
      const o = F[j], dot = o.F.nx * a.F.nx + o.F.nz * a.F.nz;
      if (dot > -0.7) continue;
      const t = (pa[0] - o.F.ax) * o.F.tx + (pa[2] - o.F.az) * o.F.tz;
      if (t < 0.5 || t > o.len - 0.5) continue;
      const pb = o.F.P(t, 0, 0), d = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]);
      if (d < 3 || d > bd) continue;
      const along = (pb[0] - pa[0]) * a.F.nx + (pb[2] - pa[2]) * a.F.nz;
      if (along < d * 0.8) continue;
      bd = d; best = { o, t };
    }
    if (!best) continue;
    const n = 1 + ((R() * 4) | 0), yb = Math.min(a.top, best.o.top) - 0.5, b = bs[a.B.cell];
    b.set(K.plain, 0x141212, 0.2);
    for (let k = 0; k < n; k++) {
      const y0 = Math.min(yb, a.y + 0.8 + R() * 3), y1 = Math.min(yb, best.o.y + 0.8 + R() * 3);
      if (y0 < 4 || y1 < 4) continue;
      const s0 = (R() - 0.5) * 2, s1 = (R() - 0.5) * 2;
      b.cable(a.F.P(Math.max(0.2, Math.min(a.len - 0.2, ua + s0)), y0, 0.1), best.o.F.P(Math.max(0.2, Math.min(best.o.len - 0.2, best.t + s1)), y1, 0.1), 0.25 + bd * 0.03 + R() * 0.4, 0.012, 6);
      made++;
    }
  }
}

// ---------------------------------------------------------------- roofs
function flatRoof(b, cb, G) {
  const { p, n, normals, top, wallTop, L, R, type } = G;
  b.set(type === 'posh' || type === 'office' ? K.slab : R() < 0.45 ? K.bitumen : K.slab, [0.82, 0.8, 0.76], Math.min(1, L.wear + 0.1), R());
  b.poly([Array.from(p)], top);
  if (wallTop - top < 0.2) return;
  const inner = offsetRing(p, normals, -0.22);
  const wall = L.wk === K.curtain || L.wk === K.cladding ? [0.78, 0.78, 0.76] : L.wall;
  b.set(L.wk === K.curtain ? K.cladding : L.wk === K.facadeWin ? K.plaster : L.wk, wall, L.wear);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = inner[2 * i], az = inner[2 * i + 1], bx = inner[2 * j], bz = inner[2 * j + 1];
    const nx = -normals[2 * i], nz = -normals[2 * i + 1];
    b.quad([ax, top, az], [bx, top, bz], [bx, wallTop, bz], [ax, wallTop, az], [nx, 0, nz], [0, top, 1, top, 1, wallTop, 0, wallTop]);
    b.quad([p[2 * i], wallTop, p[2 * i + 1]], [p[2 * j], wallTop, p[2 * j + 1]], [bx, wallTop, bz], [ax, wallTop, az], [0, 1, 0]);
  }
  // a glass rail along the top of the posh ones
  if (type === 'posh' && R() < 0.5) {
    b.set(K.glass, 0x8aa8b0, 0, R());
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; b.quad([p[2 * i], wallTop, p[2 * i + 1]], [p[2 * j], wallTop, p[2 * j + 1]], [p[2 * j], wallTop + 0.6, p[2 * j + 1]], [p[2 * i], wallTop + 0.6, p[2 * i + 1]], [normals[2 * i], 0, normals[2 * i + 1]]); }
  }
}
// what's up on a Pune roof
function rooftop(b, cb, G) {
  const { p, n, normals, top, A2, levels, L, R, type, cx, cz } = G;
  if (A2 < 30) return;
  const inner = offsetRing(p, normals, -1.2);
  const spot = () => {
    const i = (R() * n) | 0, t = R(), j = (i + 1) % n;
    const ex = inner[2 * i] + (inner[2 * j] - inner[2 * i]) * t, ez = inner[2 * i + 1] + (inner[2 * j + 1] - inner[2 * i + 1]) * t;
    const k = R() * 0.55;
    const x = ex + (cx - ex) * k, z = ez + (cz - ez) * k;
    return insideRing(x, z, p) ? [x, z] : [cx, cz];
  };
  const rot = Math.atan2(normals[1], normals[0]);
  const posh = type === 'posh' || type === 'office';
  // the stair cabin (mumty), and on a society's the RCC water tank up on it
  if (levels >= 3 && A2 > 80) {
    const x = cx + (R() - 0.5) * 3, z = cz + (R() - 0.5) * 3;
    if (insideRing(x, z, p)) {
      b.set(posh ? K.cladding : K.plaster, posh ? [0.84, 0.84, 0.82] : L.wall, L.wear);
      b.ybox(x, top, z, 2.8, top + 2.7, 3.2, rot, 8);
      b.set(K.concrete, [0.72, 0.7, 0.66], L.wear); b.ybox(x, top + 2.7, z, 3.2, top + 2.85, 3.6, rot, 8);
      if (!posh && (type === 'soc' || type === 'tower') && A2 > 200 && R() < 0.6) {
        b.set(K.concrete, [0.78, 0.76, 0.72], Math.min(1, L.wear + 0.2)); b.ybox(x, top + 2.85, z, 2.6, top + 4.4, 3.0, rot, 8);
        b.set(K.sintex, 0x1c1d1f, 0.3); b.cyl(x + 0.6, top + 4.4, z + 0.5, 0.6, 0.6, 1.2, 10);
      }
    }
  }
  if (posh) {
    // a terrace: a pergola, planters, a deck; or the lift's machine room and a cooling unit
    if (R() < 0.6 + L.terrace) {
      const [x, z] = spot();
      b.set(K.wood, 0x6a4a32, 0.2);
      for (let k = -2; k <= 2; k++) b.ybox(x + Math.cos(rot) * k * 0.5, top + 2.5, z + Math.sin(rot) * k * 0.5, 0.08, top + 2.6, 3.2, rot, 8);
      for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]]) b.ybox(x + dx, top, z + dz, 0.12, top + 2.5, 0.12, 0, 8);
      b.set(K.leaf, 0x4f7a3a, 0); for (let k = 0; k < 4; k++) { const [px, pz] = spot(); b.set(K.plain, 0x8a8a86, 0.2); b.ybox(px, top, pz, 0.6, top + 0.5, 0.6, rot, 8); b.set(K.leaf, [0x4f7a3a, 0x5e8a40, 0x3e6a30][k % 3], 0); b.blob(px, top + 0.9, pz, 0.45, 0.5, 0.45, 5); }
    }
    if (R() < 0.5) { const [x, z] = spot(); b.set(K.metal, 0x9a9e9e, 0.2); b.ybox(x, top, z, 1.6, top + 1.2, 1.2, rot, 8); }
    return;
  }
  // Sintex tanks, black, one or many, some up on a stand
  const nt = A2 > 300 ? 1 + ((R() * 4 * L.tanks) | 0) : (R() < L.tanks ? 1 + (R() < 0.3 ? 1 : 0) : 0);
  for (let k = 0; k < nt; k++) {
    const [x, z] = spot();
    const r = 0.5 + R() * 0.3, h = 1.0 + R() * 0.6, lift = R() < 0.45 ? 0.5 + R() * 0.9 : 0;
    if (lift) { b.set(K.brick, [0.62, 0.36, 0.28], 0.6); b.ybox(x, top, z, r * 2.2, top + lift, r * 2.2, rot, 8); }
    b.set(K.sintex, TANK[(R() * TANK.length) | 0], 0.3, R()); b.cyl(x, top + lift, z, r, r * 0.97, h, 10);
    b.cyl(x, top + lift + h, z, r * 0.55, r * 0.3, 0.14, 8);
    b.set(K.plain, 0xd8d8d0, 0.4); b.tube([x + r, top + lift + h * 0.8, z], [x + r + 0.4, top + 0.1, z + 0.2], 0.025, 3);
  }
  // a dish or two, an old TV aerial
  if (R() < L.dish) { const [x, z] = spot(); dish(b, x, top, z, R); if (R() < 0.3) { const [x2, z2] = spot(); dish(b, x2, top, z2, R); } }
  if (type === 'peth' && R() < 0.25) { const [x, z] = spot(); b.set(K.metal, 0x6a6a6a, 0.6); b.tube([x, top, z], [x, top + 3.2, z], 0.025, 3); for (let k = 0; k < 4; k++) b.tube([x - 0.6 + k * 0.05, top + 2.4 + k * 0.25, z], [x + 0.6 - k * 0.05, top + 2.4 + k * 0.25, z], 0.012, 3); }
  // solar water heaters: a dark blue panel, the white tank across its top
  if (R() < L.solar && A2 > 60) {
    const [x, z] = spot(), c = Math.cos(rot), s = Math.sin(rot);
    b.set(K.glass, 0x1a2a4a, 0.1, R());
    const P0 = [x - c * 1.0, top + 0.35, z - s * 1.0], P1 = [x + c * 1.0, top + 0.35, z + s * 1.0], P2 = [x + c * 1.0 - s * 1.2, top + 1.25, z + s * 1.0 + c * 1.2], P3 = [x - c * 1.0 - s * 1.2, top + 1.25, z - s * 1.0 + c * 1.2];
    b.quad(P0, P1, P2, P3, [s * 0.6, 0.8, -c * 0.6]); b.set(K.metal, 0x8a8a8a, 0.3); b.quad(P0, P1, P2, P3, [-s * 0.6, -0.8, c * 0.6]);
    b.set(K.plain, 0xe8e8e4, 0.3); b.tube([P3[0] - s * 0.25, top + 1.45, P3[2] + c * 0.25], [P2[0] - s * 0.25, top + 1.45, P2[2] + c * 0.25], 0.24, 8);
    b.set(K.metal, 0x6a6a6a, 0.4); b.tube(P0, [P0[0], top, P0[2]], 0.03, 3); b.tube(P1, [P1[0], top, P1[2]], 0.03, 3); b.tube(P3, [P3[0], top, P3[2]], 0.03, 3); b.tube(P2, [P2[0], top, P2[2]], 0.03, 3);
  }
  // washing lines
  if (R() < L.laundry * 0.6 && A2 > 50) {
    const [x, z] = spot(), c = Math.cos(rot + 1.2), s = Math.sin(rot + 1.2), l = 2 + R() * 3;
    const a = [x - c * l / 2, top + 1.7, z - s * l / 2], e = [x + c * l / 2, top + 1.7, z + s * l / 2];
    b.set(K.metal, 0x5a5a5a, 0.5); b.tube([a[0], top, a[2]], a, 0.025, 3); b.tube([e[0], top, e[2]], e, 0.025, 3);
    b.set(K.plain, 0x2a2a2a, 0); b.tube(a, e, 0.008, 3);
    for (let t = 0.1; t < 0.9; t += 0.12 + R() * 0.15) {
      const w = 0.25 + R() * 0.4, hh = 0.4 + R() * 0.7;
      const q0 = [a[0] + (e[0] - a[0]) * t, top + 1.7, a[2] + (e[2] - a[2]) * t], q1 = [a[0] + (e[0] - a[0]) * Math.min(0.95, t + w / l), top + 1.7, a[2] + (e[2] - a[2]) * Math.min(0.95, t + w / l)];
      cb.set(K.laundry, CLOTH[(R() * CLOTH.length) | 0], 0, R()); cb.quad(q0, q1, [q1[0], top + 1.7 - hh, q1[2]], [q0[0], top + 1.7 - hh, q0[2]], [s, 0, -c]);
      cb.quad(q0, q1, [q1[0], top + 1.7 - hh, q1[2]], [q0[0], top + 1.7 - hh, q0[2]], [-s, 0, c]);
    }
  }
  // a tin shed on posts, held down with stones; a blue tarp; junk
  if (R() < L.tin * 0.8 && A2 > 40) {
    const [x, z] = spot(), w = 2 + R() * 3, d = 1.8 + R() * 2;
    b.set(K.metal, 0x4a4a4a, 0.6);
    for (const [dx, dz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) b.tube([x + dx, top, z + dz], [x + dx, top + (dz < 0 ? 2.3 : 2.0), z + dz], 0.04, 3);
    b.set(K.tin, [0.64, 0.62, 0.58], Math.min(1, L.wear + 0.35), R());
    b.quad([x - w / 2 - 0.2, top + 2.35, z - d / 2 - 0.2], [x + w / 2 + 0.2, top + 2.35, z - d / 2 - 0.2], [x + w / 2 + 0.2, top + 2.0, z + d / 2 + 0.2], [x - w / 2 - 0.2, top + 2.0, z + d / 2 + 0.2], [0, 1, 0.15]);
    b.quad([x - w / 2 - 0.2, top + 2.34, z - d / 2 - 0.2], [x + w / 2 + 0.2, top + 2.34, z - d / 2 - 0.2], [x + w / 2 + 0.2, top + 1.99, z + d / 2 + 0.2], [x - w / 2 - 0.2, top + 1.99, z + d / 2 + 0.2], [0, -1, -0.15]);
    b.set(K.stone, 0x6a6460, 0.5); for (let k = 0; k < 3; k++) b.blob(x + (R() - 0.5) * w, top + 2.3, z + (R() - 0.5) * d * 0.3, 0.15, 0.1, 0.15, 4);
  }
  if (type === 'vasti' || type === 'village' ? R() < 0.55 : R() < L.clutter * 0.2) {
    const [x, z] = spot(), w = 1.5 + R() * 2.5, d = 1.5 + R() * 2;
    b.set(K.tarp, R() < 0.8 ? 0x2a5ab8 : 0xd87a2a, 0.3, R());
    b.quad([x - w / 2, top + 1.9, z - d / 2], [x + w / 2, top + 1.9, z - d / 2], [x + w / 2, top + 1.3, z + d / 2], [x - w / 2, top + 1.3, z + d / 2], [0, 1, 0.3]);
    b.quad([x - w / 2, top + 1.9, z - d / 2], [x + w / 2, top + 1.9, z - d / 2], [x + w / 2, top + 1.3, z + d / 2], [x - w / 2, top + 1.3, z + d / 2], [0, -1, -0.3]);
    b.set(K.wood, 0x5a4a3a, 0.6); b.tube([x - w / 2, top, z - d / 2], [x - w / 2, top + 1.9, z - d / 2], 0.03, 3); b.tube([x + w / 2, top, z - d / 2], [x + w / 2, top + 1.9, z - d / 2], 0.03, 3);
  }
  if (R() < L.clutter * 0.5) {
    const [x, z] = spot();
    const jc = [[0x8a8a86, 0.8, 0.9, 0.6], [0x2a5ab8, 0.5, 0.45, 0.5], [0xd8d4c8, 0.45, 0.8, 0.45], [0x6a4a32, 1.2, 0.5, 0.6]][(R() * 4) | 0];
    b.set(K.plain, jc[0], 0.7); b.ybox(x, top, z, jc[1], top + jc[2], jc[3], R() * 3, 8);
    if (R() < 0.5) { b.set(K.plain, 0x1a1a1a, 0.5); const q = spot(); b.cyl(q[0], top, q[1], 0.32, 0.32, 0.2, 8); }
  }
  // a mobile tower on a tall one, now and then
  if (levels >= 5 && R() < 0.06) {
    const [x, z] = spot();
    b.set(K.metal, 0x9a9c9e, 0.4);
    const hh = 6 + R() * 5;
    for (let k = 0; k < 4; k++) b.tube([x + (k & 1 ? 0.6 : -0.6), top, z + (k & 2 ? 0.6 : -0.6)], [x + (k & 1 ? 0.2 : -0.2), top + hh, z + (k & 2 ? 0.2 : -0.2)], 0.05, 3);
    b.set(K.plain, 0xe8e8e8, 0.2); for (let k = 0; k < 3; k++) b.ybox(x + Math.cos(k * 2.1) * 0.5, top + hh - 1.6, z + Math.sin(k * 2.1) * 0.5, 0.3, top + hh, 0.12, -k * 2.1, 8);
  }
}
function dish(b, x, y, z, R) {
  const a = R() * 6.28, el = 0.6;
  const nx = Math.cos(a) * Math.cos(el), ny = Math.sin(el), nz = Math.sin(a) * Math.cos(el);
  const cx = x, cy = y + 1.0, cz = z;
  b.set(K.metal, 0x5a5a5a, 0.4); b.tube([x, y, z], [cx, cy, cz], 0.025, 3);
  b.set(K.plain, R() < 0.7 ? 0xe8e8e4 : 0x3a3a3a, 0.4);
  // the dish: a shallow cone facing (nx, ny, nz)
  let ux = -nz, uz = nx; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
  const vx = ny * uz, vy = nz * ux - nx * uz, vz = -ny * ux;
  const r = 0.38, seg = 8, tip = [cx + nx * 0.12, cy + ny * 0.12, cz + nz * 0.12];
  for (let s = 0; s < seg; s++) {
    const a0 = s / seg * 6.283, a1 = (s + 1) / seg * 6.283;
    const p0 = [cx + (ux * Math.cos(a0) + vx * Math.sin(a0)) * r, cy + vy * Math.sin(a0) * r, cz + (uz * Math.cos(a0) + vz * Math.sin(a0)) * r];
    const p1 = [cx + (ux * Math.cos(a1) + vx * Math.sin(a1)) * r, cy + vy * Math.sin(a1) * r, cz + (uz * Math.cos(a1) + vz * Math.sin(a1)) * r];
    b.tri([cx - nx * 0.1, cy - ny * 0.1, cz - nz * 0.1], p0, p1, [nx, ny, nz]);
    b.tri([cx - nx * 0.1, cy - ny * 0.1, cz - nz * 0.1], p0, p1, [-nx, -ny, -nz]);
  }
  b.tube([cx, cy, cz], tip, 0.012, 3);
}
function pitchedRoof(b, G, y0, steep, maxRise, tile) {
  const { p, n, normals, cx, cz, A2, L } = G;
  const eave = offsetRing(p, normals, 0.5);
  const rise = Math.min(maxRise, Math.max(1.1, Math.sqrt(A2) * steep));
  const apex = [cx, y0 + rise, cz], y = y0 - 0.12;
  b.set(K.tiles, tile, L.wear, G.R());
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = [eave[2 * i], y, eave[2 * i + 1]], c = [eave[2 * j], y, eave[2 * j + 1]];
    // uv: along the eave, and up the slope
    const ex = c[0] - a[0], ez = c[2] - a[2], el = Math.hypot(ex, ez) || 1;
    const along = (q) => ((q[0] - a[0]) * ex + (q[2] - a[2]) * ez) / el;
    const up = (q) => Math.hypot(q[0] - (a[0] + ex / el * along(q)), q[2] - (a[2] + ez / el * along(q)), q[1] - y);
    b.tri(a, c, apex, [0, 1, 0], [along(a), up(a)], [along(c), up(c)], [along(apex), up(apex)]);
  }
  b.set(K.wood, 0x4a3a2a, L.wear); b.poly([Array.from(eave)], y - 0.02, true);
}
function pyramid(b, G) {
  const { p, n, cx, cz, A2, top } = G, apex = [cx, top + Math.sqrt(A2) * 0.55, cz];
  b.set(K.plain, 0x1e1e20, 0.1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; b.tri([p[2 * i], top, p[2 * i + 1]], [p[2 * j], top, p[2 * j + 1]], apex, [0, 1, 0]); }
}
function shikhara(b, G) {
  const { p, n, cx, cz, top, R } = G;
  let minR = 1e9; for (let i = 0; i < n; i++) minR = Math.min(minR, Math.hypot(p[2 * i] - cx, p[2 * i + 1] - cz));
  const rr = Math.max(1.0, Math.min(3.2, minR * 0.8)), col = R() < 0.6 ? [1.0, 0.62, 0.25] : [0.97, 0.95, 0.9];
  let y = top;
  for (let k = 0; k < 6; k++) { const r = rr * (1 - k / 7.5), h = rr * 0.55; b.set(K.plaster, mulc(col, 0.9 + 0.1 * (k % 2)), 0.2); b.cyl(cx, y, cz, r, r * 0.82, h * 0.9, 8); y += h * 0.82; }
  b.set(K.plaster, col, 0.2); b.cyl(cx, y, cz, rr * 0.3, rr * 0.3, 0.25, 8);
  b.set(K.glow, [0.95, 0.75, 0.2], 0, 0.2); b.blob(cx, y + 0.55, cz, 0.22, 0.3, 0.22, 5);
  b.set(K.wood, 0x3a2a1e, 0.3); b.tube([cx, y, cz], [cx, y + 2.4, cz], 0.03, 3);
  b.set(K.cloth, [1.0, 0.45, 0.05], 0); b.tri([cx, y + 2.4, cz], [cx, y + 1.9, cz], [cx + 0.9, y + 2.15, cz + 0.1], [0, 0, 1]); b.tri([cx, y + 2.4, cz], [cx, y + 1.9, cz], [cx + 0.9, y + 2.15, cz + 0.1], [0, 0, -1]);
}
function fortTop(b, G) {
  const { p, n, normals, wallTop, L } = G;
  const inner = offsetRing(p, normals, -2.2);
  b.set(L.wk, L.wall, L.wear);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = inner[2 * i], az = inner[2 * i + 1], bx = inner[2 * j], bz = inner[2 * j + 1];
    b.quad([ax, BASE, az], [bx, BASE, bz], [bx, wallTop - 1.4, bz], [ax, wallTop - 1.4, az], [-normals[2 * i], 0, -normals[2 * i + 1]], [0, 0, 1, 0, 1, wallTop, 0, wallTop]);
    b.quad([p[2 * i], wallTop - 1.4, p[2 * i + 1]], [p[2 * j], wallTop - 1.4, p[2 * j + 1]], [bx, wallTop - 1.4, bz], [ax, wallTop - 1.4, az], [0, 1, 0]);
    const oL = Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]), tx = (p[2 * j] - p[2 * i]) / (oL || 1), tz = (p[2 * j + 1] - p[2 * i + 1]) / (oL || 1);
    for (let d = 0.8; d < oL - 0.4; d += 1.6) {
      const x = p[2 * i] + tx * d - normals[2 * i] * 0.3, z = p[2 * i + 1] + tz * d - normals[2 * i + 1] * 0.3;
      b.ybox(x, wallTop - 1.4, z, 0.8, wallTop, 0.6, -Math.atan2(tz, tx), 8);
    }
  }
  for (let i = 0; i < n; i++) {
    const pi = (i - 1 + n) % n;
    if (normals[2 * pi] * normals[2 * i] + normals[2 * pi + 1] * normals[2 * i + 1] > 0.7) continue;
    b.set(K.stone, [0.55, 0.48, 0.4], L.wear); b.cyl(p[2 * i], 0, p[2 * i + 1], 4.4, 4.0, wallTop + 1.2, 14, 1);
  }
}
// a petrol pump's canopy
function canopy(b, p, normals, R) {
  const n = p.length / 2, y0 = 5.2, y1 = 5.9;
  const brand = [[0x1a4a9a, 0xd82a2a], [0xf2c230, 0x1a4a9a], [0xf08a24, 0x1a3a7a], [0x2a8a4a, 0xf2c230]][(R() * 4) | 0];
  let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, len = Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]);
    if (len < 0.05) continue;
    const F = new Frame(p[2 * i], p[2 * i + 1], (p[2 * j] - p[2 * i]) / len, (p[2 * j + 1] - p[2 * i + 1]) / len, normals[2 * i], normals[2 * i + 1], u);
    b.set(K.cladding, brand[0], 0.1); F.rect(b, 0, len, y0, y1, 0);
    b.set(K.cladding, brand[1], 0.1); F.rect(b, 0, len, y0 - 0.12, y0, 0);
    u += len;
  }
  b.set(K.slab, 0xe8e8e4, 0.2); b.poly([Array.from(p)], y1);
  b.set(K.glow, [0.95, 0.97, 1], 0, 0.6); b.poly([Array.from(p)], y0 - 0.12, true);
  let cx = 0, cz = 0; for (let i = 0; i < n; i++) { cx += p[2 * i]; cz += p[2 * i + 1]; } cx /= n; cz /= n;
  const inner = offsetRing(p, normals, -1.5);
  b.set(K.plain, 0xe8e8e4, 0.2);
  for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 4))) b.ybox(inner[2 * i], 0, inner[2 * i + 1], 0.5, y0, 0.5, 0, 8);
  for (let k = -1; k <= 1; k += 2) {
    b.set(K.plain, 0xf0f0ec, 0.2); b.ybox(cx + k * 2.5, 0.15, cz, 0.8, 1.7, 0.5, 0, 8);
    b.set(K.glow, hex(brand[0]), 0, 0.3); b.ybox(cx + k * 2.5, 1.0, cz + 0.26, 0.6, 1.5, 0.02, 0, 8);
  }
}

