// Walking into a shop where it stands. The room behind the shutter is the one you go into: no other room far away, no
// cut, no dimming. Its layout (world/shopplan.js) is the same one the builder drew, so the counter you saw from the
// street is the counter you walk up to, the keeper behind it was there before you came in, and the shelves are where
// they were.
//   The way in: while the shop's open, the building's front has a gap where the plan says (the whole open front of a
//   shop with a shutter, the door of a glazed one); shut, it's a wall again. Inside, the room's own walls and
//   everything standing on its floor are solid (an extra layer the collision tests besides the map's).
//   Inside, the game's Interiors has the shop as its current place (cur.inPlace), so the counter, the menu, the seats,
//   the keeper's "nobody at the counter" all work as in any room; but `inside` stays false, so the street carries on
//   round you: the traffic, the people, the light, the weather.
import { Collision } from '@orig/world/mapdata.js';
import { Interiors } from '@orig/world/interiors.js';
import { Shops, openNow } from '@orig/game/shops.js';
import { Pilot } from '@orig/game/pilot.js';
import { People } from '@orig/people/peds.js';
import { RNG } from '@orig/core/util.js';

const CELL = 8, key = (i, j) => i * 100003 + j;
const chunks = new Map();           // chunk -> its shop doors (each with .cell)
const cells = new Set();            // every shop cell built
const holes = new Map();            // grid key -> [hole]
const extra = new Map();            // grid key -> [seg] (the rooms' walls and furniture)
let V = 1;                          // bumped whenever holes come or go (segments re-match theirs)

// ---------------------------------------------------------------- the cells
function gridAdd(map, o, ax, az, bx, bz) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (CELL * 0.5))), seen = new Set();
  for (let k = 0; k <= n; k++) {
    const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, kk = key(Math.floor(x / CELL), Math.floor(z / CELL));
    if (seen.has(kk)) continue; seen.add(kk);
    let l = map.get(kk); if (!l) map.set(kk, l = []); l.push(o);
  }
  o._keys = [...seen];
}
function gridDel(map, o) { for (const kk of o._keys || []) { const l = map.get(kk); if (!l) continue; const i = l.indexOf(o); if (i >= 0) l.splice(i, 1); if (!l.length) map.delete(kk); } }
// a point of the cell (u along the front from its left, d inward negative) in the world
const at = (S, u, d) => { const F = S.F, U = S.a + u; return [F.ax + F.tx * U + F.nx * d, F.az + F.tz * U + F.nz * d]; };
// the world's (x, z) in the cell's frame
const local = (S, x, z) => { const F = S.F, dx = x - F.ax, dz = z - F.az; return [dx * F.tx + dz * F.tz - S.a, dx * F.nx + dz * F.nz]; };
const yawOf = (S, face) => { const F = S.F; const v = face === 'out' ? [F.nx, F.nz] : face === 'in' ? [-F.nx, -F.nz] : face === 'left' ? [-F.tx, -F.tz] : [F.tx, F.tz]; return Math.atan2(v[1], v[0]); };

export function cellsIn(ci, doors) {
  if (!doors.length) return;
  chunks.set(ci, doors);
  for (const door of doors) {
    const S = door.cell, P = S.plan;
    S.door = door; S.segs = []; cells.add(S);
    // the gap in the front (a shop served over the counter from the footpath has none)
    if (P.door[1] - P.door[0] > 0.3) {
      const [ax, az] = at(S, P.door[0], 0), [bx, bz] = at(S, P.door[1], 0);
      S.hole = { ax, az, bx, bz, on: false };
      gridAdd(holes, S.hole, ax, az, bx, bz);
    }
    // its walls (kind 0: the camera stops at them too) and what stands on the floor (kind 2)
    const seg = (u0, d0, u1, d1, kind) => { const [ax, az] = at(S, u0, d0), [bx, bz] = at(S, u1, d1); const s = { ax, az, bx, bz, kind, tag: -1 }; gridAdd(extra, s, ax, az, bx, bz); S.segs.push(s); };
    seg(0, 0, 0, -P.D, 0); seg(P.w, 0, P.w, -P.D, 0); seg(0, -P.D, P.w, -P.D, 0);
    for (const [u0, d0, u1, d1] of P.solids) { seg(u0, d0, u1, d0, 2); seg(u1, d0, u1, d1, 2); seg(u1, d1, u0, d1, 2); seg(u0, d1, u0, d0, 2); }
  }
  V++;
}
export function cellsOut(ci) {
  const doors = chunks.get(ci); if (!doors) return;
  chunks.delete(ci);
  for (const door of doors) {
    const S = door.cell;
    if (S.hole) gridDel(holes, S.hole);
    for (const s of S.segs || []) gridDel(extra, s);
    S.segs = []; cells.delete(S);
    dropStaff(S);
    if (here && here.S === S) leave(true);
  }
  V++;
}

// ---------------------------------------------------------------- the collision, with the gaps and the rooms
// the holes on a map segment: the ones lying along it (found again whenever holes come or go)
function holesOf(s) {
  if (s._hv === V) return s._h;
  s._hv = V; s._h = null;
  const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz; if (L2 < 1e-6) return null;
  const L = Math.sqrt(L2), n = Math.max(1, Math.ceil(L / (CELL * 0.5))), seen = new Set();
  for (let k = 0; k <= n; k++) {
    const kk = key(Math.floor((s.ax + dx * k / n) / CELL), Math.floor((s.az + dz * k / n) / CELL));
    if (seen.has(kk)) continue; seen.add(kk);
    for (const h of holes.get(kk) || []) {
      // both its ends on the line, inside the segment
      const off = (x, z) => Math.abs((x - s.ax) * dz - (z - s.az) * dx) / L, t = (x, z) => ((x - s.ax) * dx + (z - s.az) * dz) / L2;
      if (off(h.ax, h.az) > 0.06 || off(h.bx, h.bz) > 0.06) continue;
      const ta = t(h.ax, h.az), tb = t(h.bx, h.bz);
      if (Math.min(ta, tb) < -0.02 || Math.max(ta, tb) > 1.02) continue;
      (s._h || (s._h = [])).push({ h, t0: Math.max(0, Math.min(ta, tb)), t1: Math.min(1, Math.max(ta, tb)) });
    }
  }
  return s._h;
}
// the solid stretches of a segment with open holes in it, as [t0, t1] pairs
function solidParts(hs) {
  const open = hs.filter(q => q.h.on).sort((p, q) => p.t0 - q.t0);
  if (!open.length) return null;
  const out = []; let t = 0;
  for (const q of open) { if (q.t0 > t) out.push(t, q.t0); t = Math.max(t, q.t1); }
  if (t < 1) out.push(t, 1);
  return out;
}
function nearest(x, z, r, ax, az, bx, bz, kind, best) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
  let t = ((x - ax) * dx + (z - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = x - (ax + dx * t), ez = z - (az + dz * t), d = Math.hypot(ex, ez);
  if (d < r && (!best || r - d > best.depth)) return { nx: d > 1e-6 ? ex / d : 0, nz: d > 1e-6 ? ez / d : 1, depth: r - d, kind };
  return best;
}
function inter(ax, az, bx, bz, cx, cz, dx, dz) {
  const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz, den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

// ---------------------------------------------------------------- open or shut, the people who work there
let G = null, here = null;
const infoOf = (S) => S.info || (S.info = G.shops && G.shops.infoOf(S.door));
function isOpen(S) {
  const sh = S.door._sh;
  if (S.shutter && sh) return (sh.k ?? 0) > 0.97 && (sh.t ?? 1) > 0.5;
  const inf = infoOf(S); return !inf || openNow(inf, G.hour).open;
}
const down = (p) => !p || p.corpse || p.dead || p.ko || p.fallen > 0 || p.mode === 'flee';
function makeStaff(S) {
  const ppl = G.people, kit = G.W.kit, inf = infoOf(S);
  if (!ppl || !inf) return;
  const rng = new RNG((S.plan.kind.length * 7919 + Math.round(S.door.x * 13) * 31 + Math.round(S.door.z * 7)) >>> 0), keep = ppl.rng; ppl.rng = rng;
  S.staff = [];
  try {
    S.plan.keeper.forEach((k, n) => {
      const [x, z] = at(S, k.u, k.d), yaw = yawOf(S, k.face), female = rng.chance(S.plan.stock === 'medicine' || S.plan.stock === 'bakery' ? 0.35 : 0.15);
      const p = ppl.make(G.W.graph.edges[0], 1, 1, { female, mode: 'fixed', adult: true });
      p.fixed = true; p.mode = 'fixed'; p.interior = true; p.shopStaff = true; p.x = x; p.z = z; p.yaw = yaw; p.hx = Math.cos(yaw); p.hz = Math.sin(yaw);
      p.anim = k.anim; p.idle = k.anim; p.onRoad = false; p.role = k.role;
      p.persona = female ? 'kaku' : rng.chance(0.5) ? 'kaka' : ppl.pickPersona(false, x, z);
      if (kit) { const L = kit.randomLook(new RNG(rng.int(1, 1e9)), { female }); p.look = L; p.shirt = [L.top.r, L.top.g, L.top.b]; p.lower = [L.bottom.r, L.bottom.g, L.bottom.b]; p.skin = [L.skin.r, L.skin.g, L.skin.b]; }
      S.staff.push(p);
    });
  } finally { ppl.rng = keep; }
}
function dropStaff(S) {
  if (!S.staff) return;
  for (const p of S.staff) if (!p.corpse && !p.dead && G && G.people) G.people.remove(p);
  S.staff = null; S.info = null;
}
// every so often: each shop near you, open or shut; its gap; its people (they come while you can't see the shop,
// and go when it's shut and out of sight, or you're far off)
function tend() {
  const P = G.player, inView = G.inView;
  let staffed = 0; for (const S of cells) if (S.staff) staffed++;
  for (const S of cells) {
    const dx = S.door.x - P.x, dz = S.door.z - P.z, d = Math.hypot(dx, dz);
    if (d > 140) { if (S.hole) S.hole.on = false; if (S.staff && !(inView && inView(S.door.x, S.door.z) && d < 220)) dropStaff(S); continue; }
    const open = isOpen(S), inside = here && here.S === S;
    if (S.hole) S.hole.on = open || inside;
    const seen = inView && inView(S.door.x, S.door.z), sh = S.door._sh, shut = S.shutter && sh ? (sh.k ?? 0) < 0.03 : !open;
    // (they come while the shop's out of sight, or too far off to make out a face; they go once the shutter's down,
    // or when a glazed shop's shut and you can't see it, or you're far off)
    if (open && !S.staff && d < 80 && (!seen || d > 50) && staffed < 28) { makeStaff(S); staffed++; }
    else if (S.staff && (d > 110 || (!open && (shut && (S.shutter || !seen))))) dropStaff(S);
  }
}

// ---------------------------------------------------------------- in and out
const LABEL = { kirana: 'Buy something', shop: 'Buy something', paan: 'A paan, or something else', florist: 'Buy flowers', sweets: 'Buy sweets', bakery: 'Buy from the bakery',
  pharmacy: 'Ask for medicine', mobile: 'Phones, recharge, repairs', electronics: 'Look at what they have', laundry: 'Give in clothes, collect them ironed',
  books: 'Buy a book', clothes: 'Pay at the counter', shoes: 'Try on shoes', optician: 'Eye test and glasses', jeweller: 'Look at the gold', petshop: 'Buy for your pet' };
function roomOf(S) {
  if (S.R) return S.R;
  const P = S.plan, inf = infoOf(S), [ox, oz] = at(S, P.w / 2, 0), R = { tpl: P.tpl || 'shop', style: 'local', layout: P.fam, O: { x: ox, z: oz }, W: P.w, D: P.D, H: P.oh,
    spots: [], seats: [], people: [], dyn: [], props: [], browse: [], peds: [], hearts: [], customers: 0, inPlace: true, group: { visible: true } };
  // what F does where: the counter, a rail of clothes to try on, a wall of shoes or frames
  for (const q of P.spots) { if (q.kind === 'counter' && P.stock === 'clothes') continue; const [x, z] = at(S, q.u, q.d); R.spots.push({ x, z, r: q.kind === 'counter' ? 1.5 : 1.2, kind: q.kind, label: q.label || (inf && LABEL[inf.kind]) || 'Buy something', sub: q.sub }); }
  // the seats: a stool at the jeweller's counter, the bench in a shoe shop
  for (const q of P.seats) { const [x, z] = at(S, q.u, q.d), [tx, tz] = at(S, q.tu, q.td); R.seats.push({ x, z, yaw: yawOf(S, q.face), table: { x: tx, z: tz }, used: false, wait: !!q.wait }); }
  for (const [u, d] of P.browse) R.browse.push(at(S, u, d));
  return (S.R = R);
}
function enter(S) {
  const I = G.interiors, inf = infoOf(S);
  if (!I || I.cur || !inf) return;
  const R = roomOf(S);
  // the people who work here are the room's (the counter needs one of them on their feet)
  R.people = S.plan.keeper.map(k => ({ role: k.role })); R.peds = S.staff ? S.staff.slice() : [];
  I.cur = { R, ctx: inf, door: { x: S.door.x, z: S.door.z, yaw: 0 }, plate: null, seat: null, dancing: false, talk: null, inPlace: true };
  here = { S };
  G.hud.enterPlace?.(inf);
  if (R.peds.some(p => !down(p))) G.shops.speak(inf.kind, 'hello');
  if (R.seats.length && G.date && G.date.onEnter) G.date.onEnter(R, inf);
  G.shops.scanT = 0;
}
function leave(gone) {
  const I = G.interiors, C = I && I.cur;
  here = null;
  if (!C || !C.inPlace) return;
  if (C.seat) I.stand();
  I.cur = null;
  G.hud.leavePlace?.();
  if (G.shops) G.shops.scanT = 0;
  void gone;
}
function track() {
  const P = G.player, I = G.interiors;
  if (here) {
    const S = here.S, [u, d] = local(S, P.x, P.z);
    if (!P.onFoot || !cells.has(S) || u < -0.3 || u > S.plan.w + 0.3 || d > -0.05 || d < -S.plan.D - 0.3) leave();
    return;
  }
  if (!P.onFoot || !I || I.cur) return;
  for (const S of cells) {
    if (Math.abs(S.door.x - P.x) > 8 || Math.abs(S.door.z - P.z) > 8) continue;
    const [u, d] = local(S, P.x, P.z);
    if (u > 0 && u < S.plan.w && d < -0.3 && d > -S.plan.D) { enter(S); return; }
  }
}

// ---------------------------------------------------------------- the game's side
export function install() {
  // (patched here, once every module is in: the map's collision is the one every walker and the camera use)
  Collision.prototype.resolve = function (x, z, r) {
    const c = this.cell;
    let best = null;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c), j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.key(i, j);
      const ls = this.segs.get(k);
      if (ls) for (const s of ls) {
        const hs = s.kind === 0 && holes.size ? holesOf(s) : null, parts = hs && solidParts(hs);
        if (!parts) { best = nearest(x, z, r, s.ax, s.az, s.bx, s.bz, s.kind, best); continue; }
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        for (let q = 0; q < parts.length; q += 2) best = nearest(x, z, r, s.ax + dx * parts[q], s.az + dz * parts[q], s.ax + dx * parts[q + 1], s.az + dz * parts[q + 1], s.kind, best);
      }
      const lc = this.circ.get(k);
      if (lc) for (const q of lc) {
        if (q.off) continue;
        const ex = x - q.x, ez = z - q.z, d = Math.hypot(ex, ez), rr = r + q.r;
        if (d < rr && (!best || rr - d > best.depth)) best = { nx: d > 1e-6 ? ex / d : 1, nz: d > 1e-6 ? ez / d : 0, depth: rr - d, kind: q.kind };
      }
    }
    // the rooms (their grid is the same size as the map's: CELL)
    if (extra.size) for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
      const ls = extra.get(key(i, j)); if (ls) for (const s of ls) best = nearest(x, z, r, s.ax, s.az, s.bx, s.bz, s.kind, best);
    }
    return best;
  };
  Collision.prototype.ray = function (ax, az, bx, bz) {
    const c = this.cell;
    let tmin = 1;
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (c * 0.5))), seen = new Set(), seenX = new Set();
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
      const kk = this.key(Math.floor(x / c), Math.floor(z / c));
      if (!seen.has(kk)) {
        seen.add(kk);
        const ls = this.segs.get(kk);
        if (ls) for (const s of ls) {
          if (s.kind !== 0) continue;
          const hs = holes.size ? holesOf(s) : null, parts = hs && solidParts(hs);
          if (!parts) { const t = inter(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz); if (t !== null && t < tmin) tmin = t; continue; }
          const dx = s.bx - s.ax, dz = s.bz - s.az;
          for (let q = 0; q < parts.length; q += 2) { const t = inter(ax, az, bx, bz, s.ax + dx * parts[q], s.az + dz * parts[q], s.ax + dx * parts[q + 1], s.az + dz * parts[q + 1]); if (t !== null && t < tmin) tmin = t; }
        }
      }
      const kx = key(Math.floor(x / CELL), Math.floor(z / CELL));
      if (extra.size && !seenX.has(kx)) {
        seenX.add(kx);
        for (const s of extra.get(kx) || []) { if (s.kind !== 0) continue; const t = inter(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz); if (t !== null && t < tmin) tmin = t; }
      }
    }
    return tmin;
  };
  // `inside` is a room elsewhere; a shop on the street isn't
  Object.defineProperty(Interiors.prototype, 'inside', { configurable: true, get() { return !!this.cur && !this.cur.inPlace; } });
  const exit = Interiors.prototype.exit;
  Interiors.prototype.exit = function (...a) { if (this.cur && this.cur.inPlace) { leave(); return; } return exit.apply(this, a); };
  // the room's light is the street's (no indoor lighting for a shop open to it)
  const upd = Interiors.prototype.update;
  Interiors.prototype.update = function (dt) {
    if (!this.cur || !this.cur.inPlace) return upd.call(this, dt);
    const sky = this.g.sky; this.g.sky = null;
    try { return upd.call(this, dt); } finally { this.g.sky = sky; }
  };
  // what's near you: in a shop, its counter (and its seats, the people in it) first, then the street as ever, minus
  // this shop's own door
  const scan = Shops.prototype.scan;
  Shops.prototype.scan = function () {
    G = this.g;
    const I = G.interiors, P = G.player;
    if (I && I.cur && I.cur.inPlace) {
      const sp = I.near(P.x, P.z);
      if (sp) { this.near = { kind: 'ispot', s: sp, name: sp.label }; return; }
      scan.call(this);
      if (this.near && this.near.door && here && this.near.door === here.S.door) this.near = null;
      return;
    }
    scan.call(this);
  };
  // F at the door of a shop you walk into: you walk in, up to the counter (F there for what they sell). One served
  // over the counter from the footpath: F is the counter
  const tryUse = Shops.prototype.tryUse;
  Shops.prototype.tryUse = function () {
    G = this.g;
    const n = this.near, P = G.player, S = n && n.door && n.door.cell;
    if (!S || !cells.has(S) || this.open || !P.onFoot || P._walk || (G.interiors && G.interiors.cur)) return tryUse.call(this);
    const oh = openNow(n, G.hour);
    if (!isOpen(S) || (oh && !oh.open)) return tryUse.call(this);
    if (!S.hole) { this.show(n); return true; }
    const sp = S.plan.spot || { u: S.plan.w / 2, d: -0.8 }, [tx, tz] = at(S, sp.u, sp.d), [u] = local(S, P.x, P.z);
    // from off to one side, to the middle of the doorway first
    const mid = (S.plan.door[0] + S.plan.door[1]) / 2;
    if (u < S.plan.door[0] + 0.2 || u > S.plan.door[1] - 0.2) { const [mx, mz] = at(S, mid, 0.5); walkTo(P, mx, mz); P._shopNext = [tx, tz]; }
    else walkTo(P, tx, tz);
    this.scanT = 0.3;
    return true;
  };
  const label = Shops.prototype.label;
  Shops.prototype.label = function () {
    const n = this.near, S = n && n.door && n.door.cell;
    if (S && cells.has(S) && !S.hole && isOpen(S)) return `${n.name} · ${LABEL[n.kind] || 'Buy something'}`;
    return label.call(this);
  };
  // the walk (world/walkin.js moves you along it), and the second leg of one that turns into the doorway
  const foot = Pilot.prototype.updateFoot;
  Pilot.prototype.updateFoot = function (dt, ...a) {
    const out = foot.call(this, dt, ...a);
    if (this._shopNext && !this._walk) { const [x, z] = this._shopNext; this._shopNext = null; walkTo(this, x, z); }
    return out;
  };
  // the shops near you kept in step (the people's update runs every frame you're out in the city)
  const pu = People.prototype.update;
  People.prototype.update = function (dt, ...a) {
    const out = pu.call(this, dt, ...a);
    if (!G && this._G) G = this._G;
    if (G && G.player) { if ((this._shopT = (this._shopT || 0) - dt) <= 0) { this._shopT = 0.25; tend(); } track(); }
    return out;
  };
}
function walkTo(P, x, z) {
  const F = P.foot, d = Math.hypot(x - F.x, z - F.z);
  P._walk = { kind: 'inside', tx: x, tz: z, t: 0, max: d / 1.4 + 1.2 };
  P.act = { kind: 'walk', t: 0 }; P.frozen = true; P.human.play('walk', { fade: 0.25, speed: 1.1 });
}
