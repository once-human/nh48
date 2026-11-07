// How a vehicle meets the world, for /beta. The game had every vehicle as a row of circles: two cars side by side sank
// into each other at the waist, rounded noses slid off walls, and the kerb was felt by two points down the middle, so you
// could "hit" it with no wheel near it and cross it with one wheel. Now a vehicle is its own rectangle (corners barely
// rounded) against walls, posts and other vehicles, turns a little when it's hit off-centre, and stands on four wheels.
import { Vehicle, knock } from '@orig/vehicles/vehicle.js';
import { clamp } from '@orig/core/util.js';

const RC = 0.1;                                  // the corners' rounding
const seen = new Set();
// a box of half sizes (a, b) centred at the origin, along x, against a segment (local coordinates); the push for the box
function boxSeg(a, b, x0, z0, x1, z1) {
  let best = null;
  const axis = (ux, uz, s0, s1, e) => {
    if (s0 > s1) { const t = s0; s0 = s1; s1 = t; }
    if (s0 >= e || s1 <= -e) return false;
    const dn = e - s0, dp = s1 + e;                // box moves -u by dn, or +u by dp
    const d = dn < dp ? dn : dp, sg = dn < dp ? -1 : 1;
    if (!best || d < best.d) best = { d, ux: ux*sg, uz: uz*sg };
    return true;
  };
  if (!axis(1, 0, x0, x1, a + RC) || !axis(0, 1, z0, z1, b + RC)) return null;
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz);
  if (L > 1e-6) { const nx = -dz/L, nz = dx/L, c = x0*nx + z0*nz; if (!axis(nx, nz, c, c, a*Math.abs(nx) + b*Math.abs(nz) + RC)) return null; }
  return best;
}
// two boxes: (a, b) at the origin along x, and one of half sizes (A, B) at (cx, cz) heading (ex, ez), local coordinates
function boxBox(a, b, cx, cz, ex, ez, A, B) {
  let best = null;
  const px = -ez, pz = ex;
  for (const [ux, uz] of [[1, 0], [0, 1], [ex, ez], [px, pz]]) {
    const r1 = a*Math.abs(ux) + b*Math.abs(uz), r2 = A*Math.abs(ex*ux + ez*uz) + B*Math.abs(px*ux + pz*uz), c = cx*ux + cz*uz;
    const o = r1 + r2 - Math.abs(c);
    if (o <= 0) return null;
    if (!best || o < best.d) best = { d: o, ux: c > 0 ? -ux : ux, uz: c > 0 ? -uz : uz };
  }
  return best;
}

// where on the body (local) a push (ux, uz) out of something lands, the something spanning [x0, x1] along the body
// and [z0, z1] across it: at a corner when the body meets it at an angle, across the middle of the face where the two
// are flush (and in between as it turns flush). It was always a corner: lying along a wall or against a car after a
// crash, the corner taking the push swapped ends every time the angle crossed zero, each push spun the body the other
// way, and it rocked left and right against it.
function where(ux, uz, a, b, x0, x1, z0, z1) {
  const side = Math.abs(uz) > Math.abs(ux);                // the push is across the body: a side face
  const off = side ? Math.abs(ux) : Math.abs(uz);           // how far from flush (the sine of the angle)
  const t = Math.min(1, off/0.17);                          // flush below ~0, a corner from ~10 degrees
  if (side) {
    const lo = Math.max(-a, Math.min(x0, x1)), hi = Math.min(a, Math.max(x0, x1)), mid = lo <= hi ? (lo + hi)/2 : clamp((x0 + x1)/2, -a, a);
    const corner = ux ? -Math.sign(ux)*a : mid;
    return [mid + (corner - mid)*t, -Math.sign(uz)*b];
  }
  const lo = Math.max(-b, Math.min(z0, z1)), hi = Math.min(b, Math.max(z0, z1)), mid = lo <= hi ? (lo + hi)/2 : clamp((z0 + z1)/2, -b, b);
  const corner = uz ? -Math.sign(uz)*b : mid;
  return [-Math.sign(ux)*a, mid + (corner - mid)*t];
}

const P = Vehicle.prototype;
// what each weighs when it comes to a crash (a cycle's nothing to a scooter, a scooter's nothing to a car, a car's not much
// to a bus); the variants have their own in their specs
const MASS = { cycle: 15, scooter: 120, bike: 130, bullet: 190, superbike: 200, auto: 350, hatch: 1000, sedan: 1150, taxi: 1150, sports: 1500, super: 1450, jeep: 1750, tempo: 1800, suv: 1900, lux: 1900, bus: 8000 };
const massOf = (type, fb) => MASS[(type || '').replace(/P$/, '')] ?? fb ?? 1000;
// the deepest thing the body is into, in world terms: { nx, nz, depth, kind, lx, lz } (lx, lz: where on the body, local)
P.contact = function () {
  const S = this.spec, C = this.W.collision, a = S.L/2 - RC, b = S.W/2 - RC, hx = Math.cos(this.th), hz = Math.sin(this.th), px = -hz, pz = hx;
  const R = Math.hypot(a, b) + 0.3, cell = C.cell, i0 = Math.floor((this.x - R)/cell), i1 = Math.floor((this.x + R)/cell), j0 = Math.floor((this.z - R)/cell), j1 = Math.floor((this.z + R)/cell);
  const loc = (x, z) => { const dx = x - this.x, dz = z - this.z; return [dx*hx + dz*hz, dx*px + dz*pz]; };
  let best = null;
  seen.clear();
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const key = C.key(i, j), ls = C.segs.get(key), lc = C.circ.get(key);
    if (ls) for (const s of ls) {
      if (seen.has(s)) continue; seen.add(s);
      const [x0, z0] = loc(s.ax, s.az), [x1, z1] = loc(s.bx, s.bz), m = boxSeg(a, b, x0, z0, x1, z1);
      if (m && (!best || m.d > best.d)) { const [lx, lz] = where(m.ux, m.uz, a, b, x0, x1, z0, z1); best = { ...m, kind: s.kind, lx, lz }; }
    }
    if (lc) for (const q of lc) {
      if (q.off || seen.has(q)) continue; seen.add(q);
      const [cx, cz] = loc(q.x, q.z), kx = clamp(cx, -a, a), kz = clamp(cz, -b, b), ex = cx - kx, ez = cz - kz, d = Math.hypot(ex, ez), rr = RC + q.r;
      if (d >= rr) continue;
      let m;
      if (d > 1e-5) m = { d: rr - d, ux: -ex/d, uz: -ez/d };
      else { const ox = a - Math.abs(cx), oz = b - Math.abs(cz); m = ox < oz ? { d: ox + rr, ux: -Math.sign(cx) || -1, uz: 0 } : { d: oz + rr, ux: 0, uz: -Math.sign(cz) || -1 }; }
      if (!best || m.d > best.d) best = { ...m, kind: q.kind, lx: kx, lz: kz };
    }
  }
  if (!best) return null;
  return { nx: best.ux*hx + best.uz*px, nz: best.ux*hz + best.uz*pz, depth: best.d, kind: best.kind, lx: best.lx, lz: best.lz };
};
// a push out of something, as one solid body hitting another: an impulse at the point of contact. Straight on, the
// speed into it goes (a little bounce from a knock, a crunch from a real hit); off the middle it turns the car by how
// far off the middle it struck (a corner clipped at speed spins you); along a wall you slide on, scraping speed off
// by how hard you're pressed into it. (ox, oz: the velocity of what was hit; a wall's is nothing.)
P.bounce = function (res, ox, oz) {
  const S = this.spec, hx = Math.cos(this.th), hz = Math.sin(this.th);
  this.x += res.nx*res.depth; this.z += res.nz*res.depth;
  const nx = res.nx, nz = res.nz;
  // the contact point from the middle (world), and how fast it's moving there: the body's speed plus its turning
  const lx = res.lx ?? 0, lz = res.lz ?? 0, rx = hx*lx - hz*lz, rz = hz*lx + hx*lz, w = this.w || 0;
  let vx = hx*this.v - hz*this.vl, vz = hz*this.v + hx*this.vl;
  const cx = vx - w*rz - ox, cz = vz + w*rx - oz, vn = cx*nx + cz*nz;
  if (vn >= 0) return 0;
  const m = massOf(this.type, S.mass) + (this.load || 0)*70, I = m*(S.L*S.L + S.W*S.W)/12, spin = !S.two, m2 = res.m2 ?? Infinity, vx0 = vx, vz0 = vz;
  const hard = Math.min(1, Math.max(0, (-vn - 3)/9));
  // metal doesn't bounce: hardly any comes back, whatever the speed; leaning on something none does. And how much
  // this body takes of the blow is by what the other weighs (a wall or a kerb: all of it)
  const e = -vn < 1 ? 0 : 0.08*Math.min(1, (-vn - 1)/1.5);
  const rn = rx*nz - rz*nx, kn = 1/m + 1/m2 + (spin ? rn*rn/I : 0), J = -(1 + e)*vn/kn;
  vx += J*nx/m; vz += J*nz/m; let dw = spin ? J*rn/I : 0;
  // friction along the surface: the slide's speed scraped off by how hard it's pressed (never reversed)
  const tx = -nz, tz = nx, vt = cx*tx + cz*tz, rt = rx*tz - rz*tx, kt = 1/m + 1/m2 + (spin ? rt*rt/I : 0);
  const Jt = Math.max(-0.45*J, Math.min(0.45*J, -vt/kt));
  vx += Jt*tx/m; vz += Jt*tz/m; if (spin) dw += Jt*rt/I;
  // a big hit crumples: some of the speed goes into the metal
  const keep = 1 - 0.25*hard*(m2 === Infinity ? 1 : m2/(m + m2));
  this.v = (vx*hx + vz*hz)*keep; this.vl = (-vx*hz + vz*hx)*keep;
  if (spin) this.w = clamp(w + dw, -4, 4);
  // what it felt: how much its own speed changed, and which end took it
  const nl = nx*hx + nz*hz, nw = -nx*hz + nz*hx, dv = Math.hypot(this.v*hx - this.vl*hz - vx0, this.v*hz + this.vl*hx - vz0);
  this._J = J; this._dv = dv;
  this.lastHit = { zone: Math.abs(nl) > Math.abs(nw) ? (nl < 0 ? 'front' : 'rear') : (nw < 0 ? 'right' : 'left'), nx, nz, dv, speed: -vn, t: performance.now()/1000 };
  return -vn;
};
P.collideStatic = function () {
  const F = this.W.fly, hx = Math.cos(this.th), hz = Math.sin(this.th);
  // up on a flyover the deck's own edges hold you, as before
  if (F && this.deck >= 0) { for (let it = 0; it < 2; it++) for (const [o, r] of this.circles) { const res = F.deckBlock(this.x + hx*o, this.z + hz*o, r, this.deck); if (res) this.bounce(res, 0, 0); } return; }
  for (let it = 0; it < 3; it++) {
    const res = this.contact(); if (!res) break;
    const sp = this.bounce(res, 0, 0);
    if (sp > 2.2) this.events.push({ type: 'crash', speed: sp, kind: res.kind, x: this.x + hx*res.lx - hz*res.lz, z: this.z + hz*res.lx + hx*res.lz });
    else if (sp > 0.6) this.events.push({ type: 'scrape', speed: sp, kind: res.kind });
  }
  if (F) for (const [o, r] of this.circles) { const res = F.groundBlock(this.x + hx*o, this.z + hz*o, r); if (res) this.bounce(res, 0, 0); }
};
P.collideTraffic = function (traffic) {
  const S = this.spec, a = S.L/2, b = S.W/2;
  traffic.near(this.x, this.z, a + 8, (o) => {
    if ((o.isPlayer && !this.service) || o === this.agent || o.T === undefined && !o.parked || Math.abs((o.y || 0) - this.agent.y) > 2) return;
    const T = o.T || { L: o.L, W: o.W, mass: 1000, two: false }, hx = Math.cos(this.th), hz = Math.sin(this.th);
    const dx = o.x - this.x, dz = o.z - this.z, cx = dx*hx + dz*hz, cz = -dx*hz + dz*hx;
    const ohx = o.hx ?? 1, ohz = o.hz ?? 0, ex = ohx*hx + ohz*hz, ez = -ohx*hz + ohz*hx;
    const m = boxBox(a, b, cx, cz, ex, ez, T.L/2, T.W/2);
    if (!m) return;
    const me = this.W.playerVeh === this, m1 = massOf(this.type, S.mass) + (this.load || 0)*70;
    // what it weighs: anything in the street that can't be moved is as good as a wall, and to anyone but you the traffic is too
    const m2 = !me || (o.parked && !o.veh) ? Infinity : o.parked ? massOf(o.veh.type, o.veh.spec.mass) : massOf(o.type, T.mass);
    const share = m2 === Infinity ? (o.parked ? 1 : T.mass/(S.mass + T.mass)) : m2/(m1 + m2);
    const nx = m.ux*hx - m.uz*hz, nz = m.ux*hz + m.uz*hx;
    // far lighter and just hit, or a two-wheeler already down: pushed out of your way, with nothing more to you
    if (me && !o.parked && m2 < m1*0.4 && (o._hitT > performance.now()/1000 || T.two && o.fallen > 0)) { this.shoveTraffic(o, -nx*m.d, -nz*m.d); return; }
    // (the other box's reach along and across this one, for where on the body they meet)
    const ra = T.L/2*Math.abs(ex) + T.W/2*Math.abs(ez), rb = T.L/2*Math.abs(ez) + T.W/2*Math.abs(ex);
    const [lx, lz] = where(m.ux, m.uz, a, b, cx - ra, cx + ra, cz - rb, cz + rb);
    // how fast it's going, slide and all
    const sl = o.parked ? o.veh && o.veh._c : o._sh, ovx = ohx*(o.v || 0) + (sl ? sl.vx : 0), ovz = ohz*(o.v || 0) + (sl ? sl.vz : 0);
    const imp = this.bounce({ nx, nz, depth: m.d*share, lx, lz, m2 }, ovx, ovz);
    if (me && m2 !== Infinity) this.shoveTraffic(o, -nx*m.d*(1 - share), -nz*m.d*(1 - share));
    if (imp <= 0) return;
    if (me && m2 !== Infinity) { this.hitTraffic(o, T, { nx, nz, J: this._J, imp, lx, lz, m2 }, traffic); return; }
    if (!o.parked) {
      o.v = Math.max(0, o.v - imp*(1 - share)*0.8);
      o.angry = 6;
      if (me) knock(o, imp, T.two ? 0.016 : 0.012);
      if (T.two && imp > 3.0 && !o.fallen) { o.fallen = 3.5; this.events.push({ type: 'knock', who: 'two', speed: imp, x: o.x, z: o.z }); }
      else if (imp > 1.5) this.events.push({ type: 'hit', who: o.type, speed: imp, x: o.x, z: o.z, o });
      if (!(o.honkT > 0)) { o.honkT = 2.5; traffic.honks.push({ x: o.x, z: o.z, kind: T.honk, n: 2 }); }
    } else if (imp > 2.2) this.events.push({ type: 'crash', speed: imp, kind: 2, x: o.x, z: o.z });
  });
};
// four wheels on the ground (two for a two-wheeler): the body pitches and rolls with them, a kerb is felt when a wheel
// gets there, and climbing one takes speed off, more the faster and squarer you take it
P.ground = function (hx, hz, sp) {
  const S = this.spec, half = S.wb/2, tw = S.two ? 0 : S.W*0.41, px = -hz, pz = hx, W = this.W;
  const pts = S.two ? [[half, 0], [-half, 0]] : [[half, tw], [half, -tw], [-half, tw], [-half, -tw]];
  // (sag: a flat tyre puts that corner down on its rim, beta/vehicles/damage.js)
  const h = [], prev = this._wh; let off = 0;
  for (const [u, s] of pts) { const x = this.x + hx*u + px*s, z = this.z + hz*u + pz*s; h.push(this.heightAt(x, z) - (this.sag ? this.sag[h.length] || 0 : 0)); if (!W.surf.isRoad(x, z)) off++; }
  let jolt = 0, climb = 0;
  const lead = this.v >= 0 ? (S.two ? [0] : [0, 1]) : (S.two ? [1] : [2, 3]);
  if (prev && prev.length === h.length) for (let i = 0; i < h.length; i++) { const d = h[i] - prev[i]; jolt = Math.max(jolt, Math.abs(d)*(S.two ? 1 : 0.8)); if (lead.includes(i) && d > 0.07) climb = Math.max(climb, d); }
  this._wh = h;
  if (climb && sp > 1.2) this.v *= 1 - Math.min(0.3, climb*(S.two ? 0.9 : 1.6)*Math.min(1, sp/8));
  const f = S.two ? h[0] : (h[0] + h[1])/2, r = S.two ? h[1] : (h[2] + h[3])/2;
  const roll = S.two ? 0 : -Math.atan2((h[0] + h[2] - h[1] - h[3])/2, tw*2)*0.9;
  return { f, r, jolt, off: off/pts.length, roll };
};
