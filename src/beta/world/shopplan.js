// One layout per shop, used twice: the city builder draws it (world/builder.js, in the workers) and the game walks you
// into it (world/shopin.js), so what you see from the street is exactly the room you step into: the same size, the
// same counter, shelves and stock, in the same places. No three.js here.
//
// A shop is a cell of a building's ground floor: w along the front, D deep, oh to the ceiling. Everything is in the
// cell's own frame: u along the front from the cell's left edge (0..w), d inward (0 at the front, -D at the back).
import { rng, hash2, Frame } from './geom.js';
import { SHOP_CELL } from './kinds.js';

// which way of fitting out a place takes (null: not done this way yet, the old room)
const FAMILY = {
  kirana: 'counter', shop: 'counter', paan: 'counter', florist: 'counter', sweets: 'counter', bakery: 'counter',
  pharmacy: 'counter', mobile: 'counter', electronics: 'counter', laundry: 'counter',
  tapri: 'eatery', misal: 'eatery', thali: 'eatery', biryani: 'eatery', southindian: 'eatery', chinese: 'eatery', fastfood: 'eatery', food: 'eatery',
  cafe: 'eatery', juice: 'eatery', icecream: 'eatery',
  barber: 'salon', garage: 'garage', bank: 'office', travel: 'office', estate: 'office',
  bar: 'lobby', cinema: 'lobby', gaming: 'lobby', gym: 'lobby', clinic: 'lobby', lodge: 'lobby', dealer: 'lobby', library: 'lobby', chowki: 'lobby',
  books: 'walls', clothes: 'walls', shoes: 'walls', optician: 'walls', jeweller: 'walls', petshop: 'walls',
};
// (a listed business the game has no kind for: a general store or a hardware shop if the map says so)
export const familyOf = (kind, cat) => FAMILY[kind || ''] || (!kind && (cat === 'grocery' || cat === 'generic' || cat === 'hardware') ? 'counter' : null);
// the places with a glass front and door (a showroom, a gym, a clinic, a cinema's foyer)
const GLASSY = new Set(['cinema', 'gym', 'clinic', 'dealer', 'library']);
// the places behind a wall with a door in it (a bar, a lodge, the police chowki, the games parlour)
const WALLED = new Set(['bar', 'lodge', 'chowki', 'gaming']);
// how deep each kind of shop goes, at most (the building has the last word)
const CAP = { counter: 4.4, walls: 5.2, eatery: 5.6, salon: 4.6, garage: 5.6, office: 5.2, lobby: 4.8 };

// how far in from (x, z) the building goes, along -n
export function depthAt(p, x, z, nx, nz) {
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
// the cell's depth: the building's depth across the whole cell (its two ends and its middle), never more than half of
// it in a deep building (so two shops back to back on a block never meet), between 2.4 m and the kind's cap
export function cellDepth(p, F, a, c, fam) {
  let d = 30;
  for (const u of [a + 0.25, (a + c) / 2, c - 0.25]) { const P = F.P(u, 0, -0.02); d = Math.min(d, depthAt(p, P[0], P[2], F.nx, F.nz)); }
  return Math.max(0.6, Math.min(CAP[fam] || 3.2, d - 0.35, Math.max(2.4, d / 2 - 0.1)));
}
// wall i of the building's ring as a frame (u along it from its start, d out of the building; the same frame both the
// builder and the game make of it)
function frameOf(p, i) {
  const n = p.length / 2, j = (i + 1) % n, ax = p[2 * i], az = p[2 * i + 1], dx = p[2 * j] - ax, dz = p[2 * j + 1] - az, L = Math.hypot(dx, dz) || 1;
  let a2 = 0; for (let q = 0; q < n; q++) { const r = (q + 1) % n; a2 += p[2 * q] * p[2 * r + 1] - p[2 * r] * p[2 * q + 1]; }
  const sg = a2 > 0 ? 1 : -1;
  return { F: new Frame(ax, az, dx / L, dz / L, sg * dz / L, -sg * dx / L), L };
}
// The room behind cell k of wall i: where it starts and ends along the wall (the cell less its pillars), how deep it
// goes, or null (no business there that you walk into). famAt(i, k): the family of the business in that cell.
//   At a corner of the building, where the wall before this one has a room in its last cell, the two rooms would share
// the floor in the corner: the one round the corner keeps it, and this wall's first room starts beyond it. If that
// leaves too little (the corner room can reach past the first cell), this one has no room: a window in the wall that serves you on the footpath (hatch).
export function roomSpan(p, i, k, famAt, lvl = 0) {
  const fam = famAt(i, k);
  if (!fam) return null;
  const { F, L } = frameOf(p, i), ns = Math.max(1, Math.floor(L / SHOP_CELL)), cw = L / ns;
  let a = k * cw + 0.18; const c = (k + 1) * cw - 0.18;
  if (lvl < 3 && a < CAP.eatery + 0.5) { const s0 = cornerStart(p, i, F, famAt, lvl); if (s0 > a) a = s0; }
  if (c - a < 1.5) return { a, c, D: 0, F, fam, hatch: true };
  return { a, c, D: cellDepth(p, F, a, c, fam), F, fam };
}
function cornerStart(p, i, F, famAt, lvl) {
  const n = p.length / 2;
  let j = (i - 1 + n) % n;
  for (let g = 0; g < 2; g++) { const q = (j + 1) % n; if (Math.hypot(p[2 * q] - p[2 * j], p[2 * q + 1] - p[2 * j + 1]) >= 0.05) break; j = (j - 1 + n) % n; }
  if (j === i) return 0;
  const Lp = frameOf(p, j).L; if (Lp <= 2.6) return 0;
  const nsp = Math.max(1, Math.floor(Lp / SHOP_CELL)), sp = roomSpan(p, j, nsp - 1, famAt, lvl + 1);
  if (!sp || sp.hatch) return 0;
  let mu = -1e9, md = 1e9;
  for (const t of [sp.a, sp.c]) for (const d of [0, -sp.D]) { const P = sp.F.P(t, 0, d), ex = P[0] - F.ax, ez = P[2] - F.az; mu = Math.max(mu, ex * F.tx + ez * F.tz); md = Math.min(md, ex * F.nx + ez * F.nz); }
  // (round an outside corner it reaches in along this wall; round an inside one it's out of the way)
  return mu > 0.18 && md < -0.1 ? mu + 0.15 : 0;
}
export const planSeed = (bi, key) => hash2(bi | 0, key | 0) | 0;

// o: { kind, cat, brand, w, D, oh, seed, glass }
export function shopPlan(o) {
  const fam = familyOf(o.kind, o.cat);
  if (!fam) return null;
  const R = rng(o.seed), w = o.w, D = o.D, oh = o.oh;
  const P = { fam, kind: o.kind || '', cat: o.cat, w, D, oh, glass: !!o.glass || o.kind === 'jeweller' || familyOf(o.kind, o.cat) === 'office' || GLASSY.has(o.kind), door: null, pieces: [], solids: [], keeper: [], spot: null, spots: [], browse: [], seats: [], tpl: 'shop' };
  if (fam === 'counter') counterShop(P, R, o);
  else if (fam === 'walls') wallsShop(P, R, o);
  else if (fam === 'eatery') eatery(P, R, o);
  else if (fam === 'salon') salon(P, R, o);
  else if (fam === 'garage') garage(P, R, o);
  else if (fam === 'office') office(P, R, o);
  else if (fam === 'lobby') lobby(P, R, o);
  if (P.spot && !P.spots.length) P.spots.push({ u: P.spot.u, d: P.spot.d, kind: 'counter' });
  // the way in: the whole open front, or the glass door in the middle of a glazed one
  if (!P.door && P.front === 'wall') P.door = [Math.max(0.1, w / 2 - 0.55), Math.min(w - 0.1, w / 2 + 0.55)];
  if (!P.door) P.door = P.glass ? [Math.max(0.1, w / 2 - 0.5), Math.min(w - 0.1, w / 2 + 0.5)] : [0, w];
  return P;
}

// A shop with a counter: the customers' floor inside the front, the counter across the shop with the keeper behind it
// (a hinged flap at one end, his way in and out), the stock on the shelves behind him floor to ceiling. Deeper shops
// have shelves down the side walls behind the counter too, and something on the customers' side: sacks of rice and
// dal, a cold-drinks fridge, a cake fridge, the flowers on their steps.
function counterShop(P, R, o) {
  const { w, D, oh } = P, k = P.kind, cat = o.cat;
  const put = (q, solid = true) => { P.pieces.push(q); if (solid) P.solids.push([Math.min(q.u0, q.u1), Math.min(q.d0, q.d1), Math.max(q.u0, q.u1), Math.max(q.d0, q.d1)]); return q; };
  const stock = k === 'mobile' ? 'mobile' : k === 'electronics' ? 'tv' : k === 'pharmacy' ? 'medicine' : k === 'sweets' ? 'sweets' : k === 'bakery' ? 'bakery' : k === 'laundry' ? 'laundry'
    : k === 'florist' ? 'flowers' : k === 'paan' ? 'paan' : cat === 'hardware' ? 'hardware' : 'kirana';
  P.stock = stock;
  const glassTop = stock === 'mobile' || stock === 'tv' || stock === 'medicine' || stock === 'sweets' || stock === 'bakery';
  // too shallow to walk into: a kiosk, the counter at the front
  if (D < 2.35) {
    const cf = -0.25, cb = cf - 0.55;
    put({ t: 'counter', u0: 0.05, u1: w - 0.05, d0: cb, d1: cf, h: 0.95, glass: glassTop, stock });
    put({ t: 'shelf', u0: 0.05, u1: w - 0.05, d0: -D, d1: -D + 0.3, h: oh - 0.1, face: 'out', stock });
    P.keeper.push({ u: w / 2, d: Math.max(-D + 0.4, cb - 0.35), face: 'out', role: 'keeper', anim: 'idle' });
    P.spot = { u: w / 2, d: 0.55 };
    P.door = [0, 0];                                                      // (served from the footpath)
    P.tube = { u0: 0.3, u1: Math.min(w - 0.3, 1.5), d: (cb - D) / 2 };
    return;
  }
  const sd = stock === 'medicine' || stock === 'mobile' ? 0.3 : 0.38;      // the back shelves' depth
  const back = -D + sd;
  // the counter: at most 2.4 m in (a deep shop's back is the keeper's and the stock's), always 0.65 m clear behind it
  const cf = Math.max(back + 0.65 + 0.55, -2.4), cb = cf - 0.55;
  const fs = R() < 0.5 ? 0 : 1, fw = Math.min(0.75, w * 0.25);            // the flap's end and width
  const flap = fs ? [w - 0.05 - fw, w - 0.05] : [0.05, 0.05 + fw];
  put({ t: 'counter', u0: 0.05, u1: w - 0.05, d0: cb, d1: cf, h: stock === 'tv' ? 0.95 : 0.95, glass: glassTop, stock, flap });
  // the shelves behind, floor to ceiling
  put({ t: 'shelf', u0: 0.05, u1: w - 0.05, d0: -D, d1: back, h: oh - 0.08, face: 'out', stock });
  // down the side walls behind the counter, when there's room to stand between
  const behind = cb - back;
  if (behind > 1.3) for (const s of [0, 1]) {
    if (s === fs && R() < 0.6) continue;                                   // (the keeper's way in from the flap)
    const u0 = s ? w - 0.33 : 0.02, u1 = s ? w - 0.02 : 0.33;
    put({ t: 'shelf', u0, u1, d0: back + 0.05, d1: cb - 0.25, h: oh - 0.08, face: s ? 'left' : 'right', stock });
  }
  // the keeper (and a helper in a wide shop), behind the middle of the counter, facing you
  const kd = Math.max(back + 0.3, cb - 0.38);
  P.keeper.push({ u: w / 2 + (fs ? -0.25 : 0.25), d: kd, face: 'out', role: 'keeper', anim: 'idle' });
  if (w > 4.6) P.keeper.push({ u: fs ? w * 0.22 : w * 0.78, d: kd, face: 'out', role: 'helper', anim: 'idle' });
  P.spot = { u: w / 2, d: cf + 0.45 };
  // the customers' side: what stands on the floor by the walls (never in front of the counter's middle)
  const floor = -cf;                                                       // how deep the customers' floor is
  const side = R() < 0.5 ? 0 : 1, su = (x) => side ? w - x : x;
  if (floor > 0.9 && w > 2.4) {
    const fd0 = Math.max(cf + 0.08, -1.6), fd1 = Math.min(-0.15, fd0 + 0.6);
    if (stock === 'kirana' || stock === 'hardware') {
      if (R() < 0.75) put({ t: 'sacks', u0: su(0.08), u1: su(0.78), d0: Math.max(cf + 0.1, -0.85), d1: -0.12, stock });
      if (R() < 0.65 && floor > 1.2) put({ t: 'fridge', u0: su(w - 0.72), u1: su(w - 0.08), d0: cf + 0.08, d1: cf + 0.68, h: 1.75, face: side ? 'right' : 'left', drinks: true });
    } else if (stock === 'bakery' || stock === 'sweets') {
      if (floor > 1.2) put({ t: 'fridge', u0: su(0.08), u1: su(0.72), d0: cf + 0.08, d1: cf + 0.68, h: 1.6, face: side ? 'left' : 'right', cake: true });
    } else if (stock === 'flowers') {
      put({ t: 'steps', u0: su(0.08), u1: su(Math.min(1.1, w * 0.35)), d0: Math.max(cf + 0.1, -1.2), d1: -0.1 });
    } else if (stock === 'medicine' || stock === 'mobile') {
      if (floor > 1.2 && R() < 0.6) put({ t: 'stand', u0: su(0.1), u1: su(0.55), d0: fd0, d1: fd1, h: 1.5, stock });
    }
  }
  // the strips of packets hanging over the counter (never over where you walk), the tube light over it
  if (stock === 'kirana' || stock === 'paan' || stock === 'mobile') put({ t: 'hang', u0: 0.1, u1: w - 0.1, d: cb + 0.05, y0: Math.max(1.95, oh - 0.75) }, false);
  P.tube = { u0: Math.max(0.3, w / 2 - 0.7), u1: Math.min(w - 0.3, w / 2 + 0.7), d: cb };
  // the istriwala's table behind the counter, his coal iron on it
  if (stock === 'laundry' && behind > 0.5) put({ t: 'ironing', u0: fs ? 0.3 : w - 1.5, u1: fs ? 1.5 : w - 0.3, d0: back + 0.05, d1: Math.min(cb - 0.45, back + 0.75) }, false);
  if (stock === 'tv' || stock === 'mobile') P.poster = { wall: side ? 'left' : 'right', d0: Math.max(cf + 0.15, -1.6), d1: Math.max(cf + 0.15, -1.6) + 0.7, y0: 1.2, y1: Math.min(oh - 0.2, 2.2) };
  for (let i = 0; i < 2 && floor > 1.0; i++) P.browse.push([w * (0.3 + 0.4 * i), Math.min(-0.4, cf + 0.55)]);
}

// A shop you walk round: what it sells down both side walls (one, in a narrow shop, so there's always room to pass),
// more on the back wall, and the counter across the back with the keeper behind it; a bookshop's cash desk is by the
// door instead, its table of new books in the middle. A jeweller's are glass cases with stools in front of the back
// one; an optician's, boards of frames on the walls; a shoe shop's, slanted shelves of pairs and a bench to try them
// on; a clothes shop's, rails of shirts, trousers and kurtas on hangers, a mannequin by the door; a pet shop's, a
// wall of lit fish tanks and the cages and the bags of feed opposite.
function wallsShop(P, R, o) {
  const { w, D, oh } = P, k = P.kind;
  const put = (q, solid = true) => { P.pieces.push(q); if (solid) P.solids.push([Math.min(q.u0, q.u1), Math.min(q.d0, q.d1), Math.max(q.u0, q.u1), Math.max(q.d0, q.d1)]); return q; };
  const stock = { books: 'books', clothes: 'clothes', shoes: 'shoes', optician: 'frames', jeweller: 'gold', petshop: 'pets' }[k];
  P.stock = stock; P.tpl = k === 'clothes' || k === 'shoes' || k === 'optician' ? 'boutique' : 'shop';
  const sd = { books: 0.32, clothes: 0.55, shoes: 0.38, frames: 0.14, gold: 0.55, pets: 0.48 }[stock];
  const two = w - 2 * sd >= 1.25, first = R() < 0.5 ? 0 : 1;          // both walls, or the one
  const bd = stock === 'books' ? 0.32 : 0.38;                         // the back shelves
  const back = -D + bd;
  P.tube = { u0: Math.max(0.3, w / 2 - 0.7), u1: Math.min(w - 0.3, w / 2 + 0.7), d: -D * 0.5 };
  if (stock === 'books') {
    // shelves of spines up every wall; the cash desk by the door, the keeper between it and the wall; a table of
    // new books in the middle when there's room to walk round it
    put({ t: 'shelf', u0: 0.05, u1: w - 0.05, d0: -D, d1: back, h: oh - 0.08, face: 'out', stock });
    const ds = first, du0 = ds ? w - 1.25 : 0.65, du1 = ds ? w - 0.65 : 1.25;
    const deskOK = w >= 2.6;
    for (const s of two ? [0, 1] : [first]) {
      const d0 = back + 0.02, d1 = deskOK && s === ds ? -1.45 : -0.25;
      if (d1 - d0 > 0.5) put({ t: 'shelf', u0: s ? w - sd : 0.02, u1: s ? w - 0.02 : sd, d0, d1, h: oh - 0.08, face: s ? 'left' : 'right', stock });
    }
    if (deskOK) {
      put({ t: 'counter', u0: du0, u1: du1, d0: -1.3, d1: -0.35, h: 0.9, glass: false, stock, desk: true });
      P.keeper.push({ u: ds ? w - 0.33 : 0.33, d: -0.85, face: ds ? 'left' : 'right', role: 'keeper', anim: 'idle' });
      P.spot = { u: ds ? w - 1.75 : 1.75, d: -0.85 };
    } else {
      P.keeper.push({ u: w / 2, d: back + 0.35, face: 'out', role: 'keeper', anim: 'idle' });
      P.spot = { u: w / 2, d: back + 1.0 };
    }
    const free0 = two ? sd + 0.85 : (first ? 0.85 : sd + 0.85), free1 = two ? w - sd - 0.85 : (first ? w - sd - 0.85 : w - 0.85);
    if (free1 - free0 > 0.7 && D > 3.2) { const d1 = -1.2, d0 = Math.max(back + 0.9, d1 - 1.2); if (d1 - d0 > 0.5) { put({ t: 'table', u0: free0, u1: free1, d0, d1, h: 0.8, stock }); P.browse.push([(free0 + free1) / 2, d1 + 0.45]); } }
    P.browse.push([w / 2, back + 0.6]);
    return;
  }
  // the counter across the back (the keeper behind it, in front of the back shelves)
  const cb = Math.max(back + 0.65, -D + 1.0), cf = cb + 0.55;
  const fs = R() < 0.5 ? 0 : 1, fw = Math.min(0.7, w * 0.22), flap = fs ? [w - 0.05 - fw, w - 0.05] : [0.05, 0.05 + fw];
  put({ t: 'shelf', u0: 0.05, u1: w - 0.05, d0: -D, d1: back, h: oh - 0.08, face: 'out', stock });
  put({ t: 'counter', u0: 0.05, u1: w - 0.05, d0: cb, d1: cf, h: 0.95, glass: stock === 'gold' || stock === 'frames' || stock === 'pets', stock, flap });
  const kd = Math.max(back + 0.3, cb - 0.36);
  P.keeper.push({ u: w / 2 + (fs ? -0.3 : 0.3), d: kd, face: 'out', role: 'keeper', anim: 'idle' });
  if (w > 4.4 && stock !== 'frames') P.keeper.push({ u: fs ? w * 0.25 : w * 0.75, d: kd, face: 'out', role: 'helper', anim: 'idle' });
  P.spot = { u: w / 2, d: cf + 0.5 };
  // down the side walls, from the front to the counter
  const s0 = -0.25, s1 = cf - 0.12;
  const LBL = stock === 'clothes' ? [['Shirts and tees', 'tops'], ['Trousers and jeans', 'bottoms'], ['Kurtas and sarees', 'ethnic']]
    : stock === 'shoes' ? [['Sneakers', 'sneak'], ['Formal shoes', 'formal'], ['Chappals and sandals', 'chappal']] : [['Frames', 'frames'], ['Sunglasses', 'shades'], ['Contact lenses', 'lens']];
  let li = (R() * 3) | 0;
  if (s0 - s1 > 0.6) for (const s of two ? [0, 1] : [first]) {
    const u0 = s ? w - sd : 0.02, u1 = s ? w - 0.02 : sd, face = s ? 'left' : 'right';
    const t = stock === 'clothes' ? 'rail' : stock === 'gold' ? 'counter' : stock === 'pets' ? (s === first ? 'tanks' : 'shelf') : 'shelf';
    const q = put({ t, u0, u1, d0: s1, d1: s0, h: t === 'counter' ? 0.95 : stock === 'frames' ? oh - 0.3 : oh - 0.08, face, stock, glass: t === 'counter', side: true });
    // what you'd try on, at the wall it hangs on (F there)
    if (stock === 'clothes' || stock === 'shoes' || stock === 'frames') {
      const [label, sub] = LBL[li++ % 3]; q.label = label;
      P.spots.push({ u: s ? w - sd - 0.55 : sd + 0.55, d: (s0 + s1) / 2, kind: 'rack', label, sub });
    }
  }
  // stools at the counter (a jeweller's, an optician's): you sit while they show you
  if (stock === 'gold' || stock === 'frames') {
    const n = w > 3 ? 2 : 1;
    for (let i = 0; i < n; i++) { const u = w * (i + 1) / (n + 1); put({ t: 'stool', u0: u - 0.17, u1: u + 0.17, d0: cf + 0.25, d1: cf + 0.59, h: 0.65 }, false); P.seats.push({ u, d: cf + 0.42, face: 'in', tu: u, td: cf - 0.1 }); }
  }
  // a mannequin by the door, a bench to try shoes on
  const midU0 = two ? sd + 0.15 : first ? 0.15 : sd + 0.15, midU1 = two ? w - sd - 0.15 : first ? w - sd - 0.15 : w - 0.15;
  if (stock === 'clothes' && midU1 - midU0 > 1.6) { const u = first ? midU1 - 0.3 : midU0 + 0.3; put({ t: 'mannequin', u0: u - 0.22, u1: u + 0.22, d0: -0.75, d1: -0.31 }); }
  if (stock === 'shoes' && midU1 - midU0 > 1.9 && cf < -2.2) {
    const u0 = midU0 + 0.55, u1 = midU1 - 0.55, d1 = Math.max(cf + 0.95, -1.75), d0 = d1 - 0.4;
    put({ t: 'bench', u0, u1, d0, d1, h: 0.42 });
    for (let u = u0 + 0.35; u < u1 - 0.2; u += 0.7) P.seats.push({ u, d: (d0 + d1) / 2, face: 'out', tu: u, td: d1 + 0.5, wait: true });
  }
  for (let i = 0; i < 2; i++) P.browse.push([w * (0.35 + 0.3 * i), Math.min(-0.5, (s0 + s1) / 2 + (i ? 0.4 : -0.4))]);
}

// A place to eat: the counter across the back where you order (the kitchen's hatch and the menu board behind it), and
// the floor in front with its tables, two chairs to a table, in a column or two against one wall and a clear way down
// the other from the door to the counter. A tapri has a bench down the wall instead and the chai on the boil; a
// juice bar or an ice-cream parlour, too narrow for tables, has a ledge along the wall with stools.
function eatery(P, R, o) {
  const { w, D, oh } = P, k = P.kind;
  const put = (q, solid = true) => { P.pieces.push(q); if (solid) P.solids.push([Math.min(q.u0, q.u1), Math.min(q.d0, q.d1), Math.max(q.u0, q.u1), Math.max(q.d0, q.d1)]); return q; };
  const stock = k === 'cafe' ? 'cafe' : k === 'juice' ? 'juice' : k === 'icecream' ? 'icecream' : k === 'tapri' ? 'chai' : k === 'fastfood' ? 'fast' : 'food';
  P.stock = stock; P.tpl = k === 'cafe' || k === 'juice' || k === 'icecream' ? 'cafe' : 'eatery';
  // the counter and the kitchen behind it
  const back = -D + 0.3, cb = back + 0.6, cf = cb + 0.6;
  const fs = R() < 0.5 ? 0 : 1, fw = Math.min(0.75, w * 0.22), flap = fs ? [w - 0.05 - fw, w - 0.05] : [0.05, 0.05 + fw];
  put({ t: 'kitchen', u0: 0.02, u1: w - 0.02, d0: -D, d1: back, h: oh - 0.05, stock });
  put({ t: 'counter', u0: 0.05, u1: w - 0.05, d0: cb, d1: cf, h: 1.0, glass: stock === 'icecream' || stock === 'cafe' || stock === 'food' && R() < 0.4, stock, flap });
  const kd = (back + cb) / 2;
  P.keeper.push({ u: w / 2 + (fs ? -0.3 : 0.3), d: kd, face: 'out', role: 'keeper', anim: 'idle' });
  if (w > 4) P.keeper.push({ u: fs ? w * 0.22 : w * 0.78, d: kd, face: 'out', role: 'helper', anim: 'idle' });
  P.spot = { u: w / 2, d: cf + 0.5 };
  P.spots.push({ u: w / 2, d: cf + 0.5, kind: 'counter', label: 'Order at the counter' });
  P.tube = { u0: Math.max(0.3, w / 2 - 0.7), u1: Math.min(w - 0.3, w / 2 + 0.7), d: (cf - 0.35) / 2 };
  // the floor: between the front and the space you order in
  const f0 = -0.35, f1 = cf + 0.75, deep = f0 - f1;
  const aisle = R() < 0.5 ? 0 : 1;                                    // which wall the way in runs along
  const seat = (u, d, face, tu, td) => P.seats.push({ u, d, face, tu, td });
  if (stock === 'chai' && deep > 0.9) {
    // the bench down the wall, the chai drinkers on it facing across
    const s = 1 - aisle, u0 = s ? w - 0.5 : 0.05, u1 = s ? w - 0.05 : 0.5;
    put({ t: 'bench', u0, u1, d0: f1, d1: f0, h: 0.45 });
    for (let d = f0 - 0.35; d > f1 + 0.2; d -= 0.6) seat(s ? w - 0.28 : 0.28, d, s ? 'left' : 'right', s ? w - 1.0 : 1.0, d);
    P.browse.push([w / 2, f0 - 0.6]);
    return;
  }
  const nc = Math.min(3, Math.floor((w - 1.05) / 0.85)), nr = Math.floor((deep + 0.1) / 1.5);
  if (nc >= 1 && nr >= 1 && stock !== 'juice') {
    for (let c = 0; c < nc; c++) {
      const tu = aisle ? 0.45 + c * 0.85 : w - 0.45 - c * 0.85;       // columns from the far wall in
      for (let r = 0; r < nr; r++) {
        const td = f0 - 0.72 - r * 1.5;
        put({ t: 'etable', u0: tu - 0.35, u1: tu + 0.35, d0: td - 0.28, d1: td + 0.28, h: 0.74, stock });
        put({ t: 'chair', u0: tu - 0.19, u1: tu + 0.19, d0: td + 0.36, d1: td + 0.7, face: 'in', stock }, false); seat(tu, td + 0.53, 'in', tu, td);
        put({ t: 'chair', u0: tu - 0.19, u1: tu + 0.19, d0: td - 0.7, d1: td - 0.36, face: 'out', stock }, false); seat(tu, td - 0.53, 'out', tu, td);
      }
    }
  } else if (deep > 0.7) {
    // a ledge along the wall, stools at it
    const s = 1 - aisle, u0 = s ? w - 0.36 : 0.02, u1 = s ? w - 0.02 : 0.36;
    put({ t: 'ledge', u0, u1, d0: f1, d1: f0, h: 1.05, stock });
    for (let d = f0 - 0.3; d > f1 + 0.2; d -= 0.6) { const u = s ? w - 0.62 : 0.62; put({ t: 'stool', u0: u - 0.16, u1: u + 0.16, d0: d - 0.16, d1: d + 0.16, h: 0.72 }, false); seat(u, d, s ? 'right' : 'left', s ? w - 0.2 : 0.2, d); }
  }
  P.browse.push([aisle ? w - 0.5 : 0.5, f0 - 0.5]);
}

// A barber's: the mirror down one wall with the counter of bottles, combs and the steriliser under it, a chair or two
// facing it with the barber behind; the bench for whoever's waiting down the other wall, a poster of haircuts over it
function salon(P, R, o) {
  const { w, D, oh } = P;
  const put = (q, solid = true) => { P.pieces.push(q); if (solid) P.solids.push([Math.min(q.u0, q.u1), Math.min(q.d0, q.d1), Math.max(q.u0, q.u1), Math.max(q.d0, q.d1)]); return q; };
  P.stock = 'salon'; P.tpl = 'salon';
  const s = R() < 0.5 ? 0 : 1, mu0 = s ? w - 0.32 : 0.02, mu1 = s ? w - 0.02 : 0.32, face = s ? 'left' : 'right';
  const d0 = -D + 0.25, d1 = -0.4;
  put({ t: 'mirror', u0: mu0, u1: mu1, d0, d1, h: 0.82, face });
  const n = Math.max(1, Math.min(3, Math.floor((d1 - d0) / 1.25)));
  P.tube = { u0: Math.max(0.3, w / 2 - 0.7), u1: Math.min(w - 0.3, w / 2 + 0.7), d: -D * 0.5 };
  for (let i = 0; i < n; i++) {
    const d = d0 + (i + 0.5) * (d1 - d0) / n, cu = s ? w - 1.0 : 1.0;
    // (whoever's in the chair looks into the mirror)
    const look = s ? 'right' : 'left';
    put({ t: 'barberchair', u0: cu - 0.3, u1: cu + 0.3, d0: d - 0.3, d1: d + 0.3, face: look }, false);
    P.seats.push({ u: cu, d, face: look, tu: s ? w - 0.2 : 0.2, td: d, salon: true });
    P.spots.push({ u: s ? cu - 0.7 : cu + 0.7, d, kind: 'chair', label: 'Sit in the chair' });
    if (i === 0) P.keeper.push({ u: s ? cu - 0.55 : cu + 0.55, d: d - 0.45, face: s ? 'right' : 'left', role: 'barber', anim: 'idle' });
  }
  // the waiting bench, opposite
  if (w > 2.9) {
    const bu0 = s ? 0.05 : w - 0.5, bu1 = s ? 0.5 : w - 0.05;
    put({ t: 'bench', u0: bu0, u1: bu1, d0: -D + 0.4, d1: Math.min(-0.6, -D + 0.4 + 1.6), h: 0.45 });
    for (let d = -D + 0.75; d < Math.min(-0.6, -D + 2.0) - 0.2; d += 0.6) P.seats.push({ u: s ? 0.28 : w - 0.28, d, face: s ? 'right' : 'left', tu: w / 2, td: d, wait: true });
    P.poster = { wall: s ? 'left' : 'right', d0: -D + 0.5, d1: -D + 1.2, y0: 1.3, y1: Math.min(oh - 0.2, 2.1) };
  }
  P.browse.push([w / 2, -0.8]);
}
// A garage: open to the street, the floor black with oil; tyres stacked down one wall, the workbench across the back
// with its vice, the tools on the board over it; the mechanic at the bench
function garage(P, R, o) {
  const { w, D, oh } = P;
  const put = (q, solid = true) => { P.pieces.push(q); if (solid) P.solids.push([Math.min(q.u0, q.u1), Math.min(q.d0, q.d1), Math.max(q.u0, q.u1), Math.max(q.d0, q.d1)]); return q; };
  P.stock = 'garage'; P.tpl = 'garage';
  const s = R() < 0.5 ? 0 : 1;
  put({ t: 'stain', u0: 0.3, u1: w - 0.3, d0: -D + 0.3, d1: -0.2 }, false);
  put({ t: 'bench', u0: 0.1, u1: w - 0.1, d0: -D + 0.05, d1: -D + 0.7, h: 0.9, work: true });
  put({ t: 'tyres', u0: s ? w - 0.7 : 0.05, u1: s ? w - 0.05 : 0.7, d0: -D + 0.8, d1: Math.min(-0.3, -D + 0.8 + 2.0) });
  P.keeper.push({ u: w / 2, d: -D + 0.95, face: 'in', role: 'keeper', anim: 'idle' });
  P.spot = { u: w / 2, d: -D + 1.6 };
  P.spots.push({ u: w / 2, d: -D + 1.6, kind: 'counter', label: 'Talk to the mechanic' });
  P.tube = { u0: Math.max(0.3, w / 2 - 0.7), u1: Math.min(w - 0.3, w / 2 + 0.7), d: -D * 0.5 };
}
// A bank, a travel agent's, an estate agent's: a glass front and door; the desk across the back (a bank's counter
// under glass, an ATM by the door), the people at it sitting behind it, chairs in front of it for you
function office(P, R, o) {
  const { w, D, oh } = P, k = P.kind;
  const put = (q, solid = true) => { P.pieces.push(q); if (solid) P.solids.push([Math.min(q.u0, q.u1), Math.min(q.d0, q.d1), Math.max(q.u0, q.u1), Math.max(q.d0, q.d1)]); return q; };
  const bank = k === 'bank';
  P.stock = bank ? 'bank' : 'office'; P.tpl = bank ? 'bank' : 'office';
  const back = -D + 0.3, cb = back + 0.75, cf = cb + 0.65;
  put({ t: 'shelf', u0: 0.05, u1: w - 0.05, d0: -D, d1: back, h: Math.min(oh - 0.1, 2.0), face: 'out', stock: 'office' });
  // (a gap at one end of the desk for the people who sit behind it)
  const du1 = w > 2.6 ? w - 0.75 : w - 0.15;
  put({ t: 'desk', u0: 0.15, u1: du1, d0: cb, d1: cf, h: bank ? 1.05 : 0.76, glass: bank });
  const n = bank && w > 3.6 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const u = 0.15 + (du1 - 0.15) * (i + 1) / (n + 1);
    put({ t: 'ochair', u0: u - 0.25, u1: u + 0.25, d0: back + 0.1, d1: back + 0.5, face: 'out' }, false);
    P.keeper.push({ u, d: back + 0.3, face: 'out', role: bank ? 'teller' : 'keeper', anim: bank ? 'idle' : 'sit' });
    if (!bank && cf < -1.0) { put({ t: 'ochair', u0: u - 0.22, u1: u + 0.22, d0: cf + 0.25, d1: cf + 0.65, face: 'in' }, false); P.seats.push({ u, d: cf + 0.45, face: 'in', tu: u, td: cf - 0.2 }); }
  }
  P.spot = { u: (0.15 + du1) / 2, d: cf + 0.5 };
  P.spots.push({ u: (0.15 + du1) / 2, d: cf + 0.5, kind: 'counter', label: bank ? 'At the counter' : k === 'travel' ? 'Book a trip' : 'Ask about a flat' });
  if (bank && w > 2.6 && cf < -1.25) {
    const s = R() < 0.5 ? 0 : 1, au0 = s ? w - 0.62 : 0.06, au1 = s ? w - 0.06 : 0.62;
    put({ t: 'atm', u0: au0, u1: au1, d0: -1.1, d1: -0.45, face: s ? 'left' : 'right' });
    P.spots.push({ u: s ? w - 1.0 : 1.0, d: -0.78, kind: 'atm', label: 'Use the ATM' });
  }
  P.tube = { u0: Math.max(0.3, w / 2 - 0.7), u1: Math.min(w - 0.3, w / 2 + 0.7), d: -D * 0.5 };
}

// The bigger places (a bar, a cinema, a games parlour, a gym, a clinic, a lodge, a showroom, a library, the police
// chowki): the front of the place is in the street like any shop, and through it you're in its front room, the same
// size as the frontage: the desk or the counter where you pay, ask or wait, with whoever keeps it, and at the back a
// door. Through that door is the place itself (the hall, the club, the gym floor, the doctor's room), the old room.
function lobby(P, R, o) {
  const { w, D, oh } = P, k = P.kind;
  const put = (q, solid = true) => { P.pieces.push(q); if (solid) P.solids.push([Math.min(q.u0, q.u1), Math.min(q.d0, q.d1), Math.max(q.u0, q.u1), Math.max(q.d0, q.d1)]); return q; };
  P.stock = k === 'library' ? 'books' : 'lobby_' + k; P.tpl = 'lobby';
  if (WALLED.has(k)) P.front = 'wall';
  // the door at the back, in the middle or to one side (the desk takes the other)
  const s = R() < 0.5 ? 0 : 1, bw = Math.min(1.1, w - 0.6), bu0 = w < 2.8 ? (w - bw) / 2 : s ? w - bw - 0.25 : 0.25, bu1 = bu0 + bw;
  put({ t: 'backdoor', u0: bu0, u1: bu1, d0: -D, d1: -D + 0.05, h: Math.min(oh - 0.15, 2.2), kind: k }, false);
  P.back = { u: (bu0 + bu1) / 2, d: -D + 0.5 };
  const LBL = { bar: 'Go in', cinema: 'Into the hall', gaming: 'Into the parlour', gym: 'Onto the gym floor', clinic: 'Into the clinic', lodge: 'Up to the rooms', dealer: 'Into the showroom', library: 'Into the reading room', chowki: 'Inside' };
  P.spots.push({ u: P.back.u, d: -D + 0.65, kind: 'backdoor', label: LBL[k] || 'Go in' });
  // the desk: down the side away from the door in a wide place, across the front of the room in a narrow one
  const free0 = s ? 0.1 : bu1 + 0.2, free1 = s ? bu0 - 0.2 : w - 0.1;
  const DESK = { bar: 'Pay at the door', cinema: 'Buy a ticket', gaming: 'Buy tokens', gym: 'Membership', clinic: 'See the doctor', lodge: 'Reception', dealer: 'Ask about a vehicle', library: 'Become a member', chowki: 'Talk to the havaldar' };
  const lbl = DESK[k] || 'At the counter';
  if (free1 - free0 > 1.0) {
    const dd0 = -D + 0.3, dd1 = Math.min(-0.9, -D + 0.3 + Math.min(2.2, D - 1.3)), side = s ? 'right' : 'left';
    // (along the wall, the keeper between it and the wall)
    const cu0 = s ? free0 + 0.5 : free1 - 0.95, cu1 = cu0 + 0.45;
    if (dd1 - dd0 > 0.7) {
      put({ t: 'desk', u0: cu0, u1: cu1, d0: dd0, d1: dd1, h: k === 'cinema' || k === 'lodge' || k === 'chowki' ? 1.05 : 0.8, glass: k === 'cinema', side: true });
      const ku = s ? cu0 - 0.3 : cu1 + 0.3;
      P.keeper.push({ u: ku, d: (dd0 + dd1) / 2, face: s ? 'right' : 'left', role: k === 'chowki' ? 'keeper' : k === 'clinic' ? 'keeper' : 'keeper', anim: 'idle' });
      P.spot = { u: s ? cu1 + 0.55 : cu0 - 0.55, d: (dd0 + dd1) / 2 };
      P.spots.push({ u: P.spot.u, d: P.spot.d, kind: 'counter', label: lbl });
      void side;
    }
  }
  if (!P.spot) {
    // narrow: the counter across by the door at the back, the keeper behind it to one side
    const cu0 = 0.1, cu1 = Math.max(0.6, bu0 - 0.1);
    if (cu1 - cu0 > 0.5) { put({ t: 'desk', u0: cu0, u1: cu1, d0: -D + 0.3, d1: -D + 0.85, h: 1.0, glass: k === 'cinema' }); P.keeper.push({ u: (cu0 + cu1) / 2, d: -D + 0.15, face: 'out', role: 'keeper', anim: 'idle' }); }
    else if (k !== 'bar') P.keeper.push({ u: Math.max(0.3, bu0 - 0.25), d: -D + 0.45, face: 'out', role: 'keeper', anim: 'idle' });
    P.spot = { u: Math.max(0.5, (cu0 + cu1) / 2), d: -D + 1.4 };
    P.spots.push({ u: P.spot.u, d: P.spot.d, kind: 'counter', label: lbl });
  }
  // what each kind has in its front room, along the wall opposite the desk
  const ou0 = s ? w - 0.55 : 0.05, ou1 = ou0 + 0.5, od0 = -D + 1.0 + (w < 2.8 ? 0.6 : 0), od1 = -0.6;
  const room = od1 - od0 > 0.8 && w > 2.4;
  if (k === 'bar') { P.keeper.push({ u: s ? Math.max(0.4, bu0 - 0.35) : Math.min(w - 0.4, bu1 + 0.35), d: -D + 0.55, face: 'out', role: 'bouncer', anim: 'idle' }); P.neon = true; }
  else if (k === 'cinema') { P.posters = 3; if (room) { put({ t: 'bench', u0: ou0, u1: ou1, d0: od0, d1: od1, h: 0.45 }); for (let d = od0 + 0.35; d < od1 - 0.2; d += 0.6) P.seats.push({ u: (ou0 + ou1) / 2, d, face: s ? 'left' : 'right', tu: w / 2, td: d, wait: true }); } }
  else if (k === 'gaming') { if (room) put({ t: 'cabinet', u0: s ? ou0 - 0.1 : ou0, u1: s ? ou1 : ou1 + 0.1, d0: od0, d1: od1, face: s ? 'left' : 'right' }); P.neon = true; }
  else if (k === 'gym') { if (room) put({ t: 'weights', u0: ou0, u1: ou1, d0: od0, d1: od1 }); P.posters = 1; }
  else if (k === 'clinic' || k === 'chowki' || k === 'lodge') { if (room) { put({ t: 'bench', u0: ou0, u1: ou1, d0: od0, d1: od1, h: 0.45 }); for (let d = od0 + 0.35; d < od1 - 0.2; d += 0.6) P.seats.push({ u: (ou0 + ou1) / 2, d, face: s ? 'left' : 'right', tu: w / 2, td: d, wait: true }); } if (k === 'clinic') P.posters = 1; }
  else if (k === 'dealer') { if (w > 2.6 && D > 3) put({ t: 'scooter', u0: w / 2 - 0.35, u1: w / 2 + 0.35, d0: -D + 1.4, d1: -0.5 }); P.posters = 1; }
  else if (k === 'library') { if (room) put({ t: 'shelf', u0: ou0, u1: ou1 - 0.1, d0: od0, d1: od1, h: Math.min(oh - 0.1, 2.1), face: s ? 'left' : 'right' }); }
  P.tube = { u0: Math.max(0.3, w / 2 - 0.7), u1: Math.min(w - 0.3, w / 2 + 0.7), d: -D * 0.5 };
  P.browse.push([w / 2, -0.8]);
}
