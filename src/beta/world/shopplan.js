// One layout per shop, used twice: the city builder draws it (world/builder.js, in the workers) and the game walks you
// into it (world/shopin.js), so what you see from the street is exactly the room you step into: the same size, the
// same counter, shelves and stock, in the same places. No three.js here.
//
// A shop is a cell of a building's ground floor: w along the front, D deep, oh to the ceiling. Everything is in the
// cell's own frame: u along the front from the cell's left edge (0..w), d inward (0 at the front, -D at the back).
import { rng, hash2 } from './geom.js';

// which way of fitting out a place takes (null: not done this way yet, the old room)
const FAMILY = {
  kirana: 'counter', shop: 'counter', paan: 'counter', florist: 'counter', sweets: 'counter', bakery: 'counter',
  pharmacy: 'counter', mobile: 'counter', electronics: 'counter',
};
// (a listed business the game has no kind for: a general store or a hardware shop if the map says so)
export const familyOf = (kind, cat) => FAMILY[kind || ''] || (!kind && (cat === 'grocery' || cat === 'generic' || cat === 'hardware') ? 'counter' : null);
// how deep each kind of shop goes, at most (the building has the last word)
const CAP = { counter: 4.4 };

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
export const planSeed = (bi, key) => hash2(bi | 0, key | 0) | 0;

// o: { kind, cat, brand, w, D, oh, seed, glass }
export function shopPlan(o) {
  const fam = familyOf(o.kind, o.cat);
  if (!fam) return null;
  const R = rng(o.seed), w = o.w, D = o.D, oh = o.oh;
  const P = { fam, kind: o.kind || '', cat: o.cat, w, D, oh, glass: !!o.glass, door: null, pieces: [], solids: [], keeper: [], spot: null, browse: [], seats: [] };
  if (fam === 'counter') counterShop(P, R, o);
  // the way in: the whole open front, or the glass door in the middle of a glazed one
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
  const stock = k === 'mobile' ? 'mobile' : k === 'electronics' ? 'tv' : k === 'pharmacy' ? 'medicine' : k === 'sweets' ? 'sweets' : k === 'bakery' ? 'bakery'
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
  if (stock === 'tv' || stock === 'mobile') P.poster = { wall: side ? 'left' : 'right', d0: Math.max(cf + 0.15, -1.6), d1: Math.max(cf + 0.15, -1.6) + 0.7, y0: 1.2, y1: Math.min(oh - 0.2, 2.2) };
  for (let i = 0; i < 2 && floor > 1.0; i++) P.browse.push([w * (0.3 + 0.4 * i), Math.min(-0.4, cf + 0.55)]);
}
