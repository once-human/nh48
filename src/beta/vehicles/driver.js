// The driver for anything the game drives with a purpose (the police, the 108 ambulance, a duty run), /beta's own:
// a trained driver on an Indian road. It reads the road ahead and is down to a bend's speed before the bend, steers
// one smooth line, and picks its place across the road by where there's actually room: left of what's in front,
// right of it, or out on the other side when nothing's coming for far enough, then back in. On a call it never
// shoves a queue: it slows, hoots, lets them pull aside and squeezes through; at a red it comes down to a crawl,
// looks both ways and goes; off a call it keeps to the lights like anyone careful. It stops for people, animals
// and you on foot, gives two-wheelers room, pulls in to the kerb where it's going, and when it's stuck it backs
// off and goes round before it tries a three-point turn, and takes another road if this one's shut.
// Same class, same fields as src/vehicles/driver.js (which the builds outside /beta still use).
import { wrapAngle, clamp } from '@orig/core/util.js';

const T4 = [0, 0, 0, 0];
const OBS = [];                                          // what's ahead, reused: { al, lat, hw, ov, still, two, pl }
export class Driver {
  constructor(veh, G, o = {}) {
    this.v = veh; this.G = G; this.o = Object.assign({ lane: 1.5, emergency: false, signals: true, offroadEnd: false, careful: false, kerb: false, gentle: false, creep: 0 }, o);
    this.route = null; this.idx = 0; this.routeT = 0; this.tx = 0; this.tz = 0;
    this.progT = 0; this.lastX = veh.x; this.lastZ = veh.z; this.rec = null; this.fails = 0; this.shift = 0; this.shiftT = 0; this.waitT = 0;
    this.st = 0; this.avoid = null; this.avoidT = 0; this.jT = 0; this.ahead = null; this.vCap = 99;
  }
  goTo(x, z) { if (Math.hypot(x - this.tx, z - this.tz) > 20) this.routeT = 0; this.tx = x; this.tz = z; }
  plan() {
    const W = this.G.W, v = this.v, hx = Math.cos(v.th), hz = Math.sin(v.th);
    // start from the road we're on, preferably one running our way
    const a = W.graph.nearest(v.x + hx * 3, v.z + hz * 3, 40), b = W.graph.nearest(this.tx, this.tz, 80);
    this.route = null; this.idx = 0;
    if (!a || !b) return;
    // a road we couldn't get down a moment ago costs three times its length for a while: another way if there is one
    const av = this.avoid && this.avoidT > 0 && this.avoid !== b.e && !this.avoid.restricted ? this.avoid : null;
    if (av) av.restricted = true;
    let r = null; try { r = W.graph.route(a, b, this.o.emergency); } finally { if (av) av.restricted = false; }
    if (r) this.route = W.graph.routePolyline(r, a, b);
  }
  // the nearest point index on the route, moving forward only (a few back to be safe)
  project() {
    const R = this.route, v = this.v; if (!R) return;
    let bi = this.idx, bd = 1e12;
    for (let i = Math.max(0, this.idx - 4); i < Math.min(R.length - 1, this.idx + 40); i += 2) { const q = (R[i] - v.x) ** 2 + (R[i + 1] - v.z) ** 2; if (q < bd) { bd = q; bi = i; } }
    this.idx = bi; this.offD = Math.sqrt(bd);
  }
  // a point `ahead` metres along the route from the projection, and the road direction there
  along(ahead) {
    const R = this.route; let i = this.idx, left = ahead;
    while (i + 3 < R.length) { const L = Math.hypot(R[i + 2] - R[i], R[i + 3] - R[i + 1]); if (L >= left) { const t = left / L; return { x: R[i] + (R[i + 2] - R[i]) * t, z: R[i + 1] + (R[i + 3] - R[i + 1]) * t, dx: (R[i + 2] - R[i]) / L, dz: (R[i + 3] - R[i + 1]) / L, end: false }; } left -= L; i += 2; }
    const n = R.length; const dx = R[n - 2] - R[n - 4] || 1, dz = R[n - 1] - R[n - 3] || 0, l = Math.hypot(dx, dz) || 1;
    return { x: R[n - 2], z: R[n - 1], dx: dx / l, dz: dz / l, end: true };
  }
  remaining() { const R = this.route; if (!R) return 0; let s = 0; for (let i = this.idx; i + 3 < R.length; i += 2) s += Math.hypot(R[i + 2] - R[i], R[i + 3] - R[i + 1]); return s; }
  // the fastest we can be going now and still be down to each bend's speed by the time we're in it
  cornerSpeed(aLat, aBrk, sp) {
    const R = this.route; if (!R) return 99;
    const reach = Math.min(110, 18 + sp * sp / (2 * aBrk) + sp);
    let i = this.idx, d = 0, cap = 99, ph = null, n = 0;
    while (i + 3 < R.length && d < reach && n++ < 28) {
      const dx = R[i + 2] - R[i], dz = R[i + 3] - R[i + 1], L = Math.hypot(dx, dz);
      if (L > 0.5) {
        const h = Math.atan2(dz, dx);
        if (ph !== null) {
          const k = Math.abs(wrapAngle(h - ph)) / Math.max(4, L);              // how tight, per metre
          if (k > 0.004) { const vc = Math.sqrt(aLat / k), now = Math.sqrt(vc * vc + 2 * aBrk * Math.max(0, d - 3)); if (now < cap) cap = now; }
        }
        ph = h; d += L;
      }
      i += 2;
    }
    return Math.max(2.5, cap);
  }
  // everything on the road ahead of us, in our own frame (al ahead, lat to the right), people and animals too
  look(range) {
    const G = this.G, v = this.v, hx = Math.cos(v.th), hz = Math.sin(v.th);
    OBS.length = 0;
    G.traffic.near(v.x + hx * range / 2, v.z + hz * range / 2, range / 2 + 6, (o) => {
      if (o === v.agent || Math.abs((o.y || 0) - (v.agent.y || 0)) > 2) return;
      const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz; if (al < 0.5 || al > range) return;
      const ov = (o.v || 0) * ((o.hx ?? 1) * hx + (o.hz ?? 0) * hz);
      OBS.push({ al, lat: -rx * hz + rz * hx, hw: ((o.T ? o.T.W : o.W) || 1.8) / 2, ov, still: Math.abs(o.v || 0) < 0.6, two: !!(o.T && o.T.two), pl: !!o.isPlayer, person: false });
    });
    if (!(v.agent.y > 2)) {
      const near = Math.min(range, 16), P = G.people;
      const one = (p, hw) => {
        const rx = p.x - v.x, rz = p.z - v.z; if (Math.abs(rx) > near + 2 || Math.abs(rz) > near + 2) return;
        const al = rx * hx + rz * hz; if (al < 0.5 || al > near) return;
        OBS.push({ al, lat: -rx * hz + rz * hx, hw, ov: 0, still: true, two: false, pl: false, person: true });
      };
      if (P && P.list) for (const p of P.list) { if (p.hidden || p.crew || p.cop) continue; one(p, 0.3); }
      if (P && P.animals) for (const a of P.animals) { if (a.hidden) continue; one(a, a.cow ? 0.75 : 0.35); }
      const Pl = G.player; if (Pl && Pl.onFoot && !this.o.offroadEnd) one(Pl, 0.3);
    }
    return OBS;
  }
  // how far it's clear along a line `lat` to our right; `out` gets what stops it
  free(lat, wHalf, out, onc) {
    let gap = 99, hit = null;
    for (const q of OBS) {
      const m = q.person ? 0.3 : q.two ? 0.45 : 0.2;
      if (Math.abs(q.lat - lat) >= wHalf + q.hw + m) continue;
      const g = onc && q.ov < -1 ? q.al + q.ov * 2.2 : q.al;                          // something coming at us is nearer than it looks
      if (g < gap) { gap = g; hit = q; }
    }
    if (out) out.hit = hit;
    return gap;
  }
  // kept for anyone asking the old way: what's in our path at `lat`
  scan(lat) {
    this.look(7 + Math.abs(this.v.v) * 1.6);
    const o = {}, gap = Math.max(0.5, this.free(lat, (this.v.spec.W || 1.8) / 2 + 0.35, o)), h = o.hit;
    return { gap: h ? gap : 99, still: !!(h && h.still), person: !!(h && h.person), ov: h && !h.person ? h.ov : 0, isPlayer: !!(h && h.pl) };
  }
  update(dt, want) {
    const G = this.G, W = G.W, v = this.v, o = this.o, hx = Math.cos(v.th), hz = Math.sin(v.th), sp = Math.abs(v.v);
    if ((this.routeT -= dt) <= 0) { this.routeT = 2.5; this.plan(); }
    if (this.avoidT > 0) this.avoidT -= dt;
    const inp = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    // ---- recovering: back up with the wheel turned, then forward the other way
    if (this.rec) {
      const R = this.rec; R.t += dt;
      if (R.ph === 'back') { inp.brake = 0.7; inp.steer = R.steer; v.reverse = true; if (R.t > R.dur || this.blockedBehind()) { R.ph = 'fwd'; R.t = 0; v.reverse = false; } }
      else { v.reverse = false; inp.throttle = 0.6; inp.steer = -R.steer; if (R.t > (R.fwd || 1.4)) { this.rec = null; this.progT = 0; this.lastX = v.x; this.lastZ = v.z; } }
      this.st = inp.steer;
      v.update(dt, inp, G.traffic); return;
    }
    v.reverse = false;
    if (want <= 0) { inp.brake = sp > 3 ? 0.7 : 1; inp.handbrake = sp < 0.5; this.st *= 0.8; v.update(dt, inp, G.traffic); return; }
    // how hard this driver corners and brakes: flat out on a call, easy with someone on the stretcher, tidy otherwise
    const aLat = o.gentle ? 2.4 : o.emergency ? (v.spec.two ? 6.5 : 5.2) : 3.2, aBrk = o.gentle ? 2.6 : o.emergency ? 5.5 : 3.4;
    const Wv = v.spec.W || 1.8, wHalf = Wv / 2 + 0.35;
    // ---- where to aim
    let ax = this.tx, az = this.tz, end = true, half = 3, oneway = false, rdx = hx, rdz = hz, cur = 0, base = 0, haveRoad = false, rem = 0;
    const onRoad = W.surf.isRoad(v.x, v.z);
    const look = clamp(4.5 + sp * 0.75, 5, 24);
    let A = null;
    if (this.route && this.route.length >= 4) {
      this.project();
      A = this.along(look); rem = this.remaining();
      end = A.end && rem < 12;
      haveRoad = true; rdx = A.dx; rdz = A.dz;
      const e = W.graph.nearest(A.x, A.z, 20);
      if (e) { half = e.e.w / 2; oneway = !!e.e.oneway; }
      // where we are across the road now (to the right of its middle), by the bit of route under us
      const R = this.route, i = Math.min(this.idx, R.length - 4), sx = R[i + 2] - R[i], sz = R[i + 3] - R[i + 1], sl = Math.hypot(sx, sz) || 1;
      cur = (-(v.x - R[i]) * sz + (v.z - R[i + 1]) * sx) / sl;
      // keep left of the middle where the road's wide enough; right in by the kerb for the last stretch to a scene
      base = oneway ? 0 : -Math.min(o.lane, half * 0.45);
      if (o.kerb && !o.offroadEnd && rem < 30) base = -Math.max(0, half - Wv / 2 - 0.35);
    } else this.shift = 0;
    if (end) this.shift = 0;
    let off = base + this.shift;
    // ---- what's ahead, and which line across the road to take
    const range = clamp(9 + sp * 2.0, 12, this.bend > 0.25 ? 18 : 46);              // (round a bend, only what's near is really in our way)
    if ((this.scanT = (this.scanT || 0) - dt) <= 0) {
      this.scanT = 0.12;
      this.look(range);
      const h = {};                                      // our line, in our own frame
      let gap = this.free(off - cur, wHalf, h), H = h.hit;
      if (this.shiftT > 0) this.shiftT -= 0.12;
      if (haveRoad && !end) {
        const lim = Math.max(0, half - Wv / 2 - 0.15), slow = H && !H.person && !H.pl && (H.still ? (o.emergency ? gap < 12 + sp * 1.5 : this.waitT > 2.5) : o.emergency && gap < 16 + sp && H.ov < want - 2);
        if (slow && this.shiftT <= 0) {
          // every line across the road we could take: the best is the clearest, near where we are, and on our own side
          let best = null, bs = gap + 5;
          const step = v.spec.two ? 0.7 : 1.0, hi = oneway || o.emergency || H.still ? lim : Math.min(lim, 0.4);
          for (let c = -lim; c <= hi + 0.01; c += step) {
            if (Math.abs(c - off) < 0.6) continue;
            const f = this.free(c - cur, wHalf, null);
            if (f < 12) continue;
            const wrong = !oneway && c > 0.3 ? 1 : 0;
            if (wrong && this.free(c - cur, wHalf + 0.4, null, true) < Math.min(range - 2, 26 + sp)) continue;      // the other side only when it's clear well ahead
            const s = Math.min(f, 40) - Math.abs(c - cur) * 1.6 - wrong * 5 - Math.abs(c - base) * 0.5;
            if (s > bs && W.surf.isRoad(A.x - rdz * c, A.z + rdx * c)) { bs = s; best = c; }
          }
          if (best !== null) { off = best; this.shift = off - base; this.shiftT = 2.2; this.waitT = 0; gap = this.free(off - cur, wHalf, h); H = h.hit; }
        } else if (this.shiftT <= 0 && Math.abs(this.shift) > 0.3) {
          // past it: back to our own side as soon as there's room there
          if (this.free(base - cur, wHalf + 0.3, null) > Math.min(range, 14 + sp * 1.2)) { off = base; this.shift = 0; this.shiftT = 0.8; }
        }
      }
      // anything close by our side as we go through (a gap in a queue, a two-wheeler, someone at the edge): ease past
      let side = 99; const mine = off - cur;
      for (const q of OBS) { if (q.al > 9 + sp * 0.5 || q === H) continue; const c = Math.abs(q.lat - mine) - wHalf - q.hw + 0.35; if (c < (q.person ? 1.3 : q.two ? 0.9 : 0.5) && q.ov < sp - 1) side = Math.min(side, q.person ? 5 : 7 + Math.max(0, c) * 5); }
      this.ahead = H ? { gap: Math.max(0, gap), still: H.still, person: H.person, ov: H.person ? 0 : H.ov, isPlayer: H.pl, side } : { gap: 99, side };
      this.vCap = this.cornerSpeed(aLat, aBrk, sp);
      if (A) { const B = this.along(look + 18); this.bend = Math.abs(wrapAngle(Math.atan2(B.dz, B.dx) - Math.atan2(A.dz, A.dx))); } else this.bend = 0;
    }
    if (A) {
      ax = A.x; az = A.z;
      let c = off;
      if (!W.surf.isRoad(ax - rdz * c, az + rdx * c)) c *= 0.3;
      ax += -rdz * c; az += rdx * c;
      // the last stretch: to the target itself if it's on the road (or we're allowed off it); to the kerb beside it otherwise
      if (end && (o.offroadEnd || (!o.kerb && W.surf.isRoad(this.tx, this.tz)))) { ax = this.tx; az = this.tz; }
    }
    // off the road: back onto the nearest bit of it first, slowly
    if (!onRoad && !end) { const n = W.graph.nearest(v.x, v.z, 40); if (n) { W.graph.at(n.e, n.s, T4); ax = T4[0] + T4[2] * 4; az = T4[1] + T4[3] * 4; want = Math.min(want, 4); } }
    const diff = wrapAngle(Math.atan2(az - v.z, ax - v.x) - v.th);
    // the target's behind us and we're slow: turn round properly
    if (Math.abs(diff) > 2.2 && sp < 3 && Math.hypot(ax - v.x, az - v.z) > 6) { this.rec = { ph: 'back', t: 0, dur: 1.6, steer: diff > 0 ? -1 : 1 }; v.update(dt, inp, G.traffic); return; }
    // ---- how fast: the road's shape first, then the end of the run
    let target = Math.min(want, this.vCap) * (Math.abs(diff) > 0.8 ? 0.6 : 1);
    if (end) target = Math.min(target, o.kerb && !o.offroadEnd ? Math.sqrt(2 * aBrk * 0.6 * Math.max(0, rem - 1.5)) : Math.max(2, Math.hypot(this.tx - v.x, this.tz - v.z) * 0.6));
    else if (o.kerb && rem < 40) target = Math.min(target, Math.sqrt(9 + 2 * aBrk * 0.6 * rem));
    // ---- the lights. Off a call: stop at red (and at amber when there's room to). On a call: down to a crawl at a red,
    // a look both ways, wait for what's crossing, then through; chasing hard it only lifts off
    const sig = G.traffic.signals;
    if (sig && (o.signals || o.emergency || o.careful)) {
      const la = 12 + sp * 1.4, n = W.graph.nearest(v.x + hx * la, v.z + hz * la, 10), node = n && W.graph.nodes[n.s < n.e.len / 2 ? n.e.a : n.e.b];
      if (node && node.signal) {
        const nx = node.x - v.x, nz = node.z - v.z, dn = Math.hypot(nx, nz), st = nx * hx + nz * hz > 0 && dn > 6 && dn < 60 ? sig.stateForAngle(node.i, v.th) : null;
        if (st === 'r' || (st === 'a' && o.signals && dn - 9 > sp * sp / (2 * aBrk))) {
          if (o.signals) { if (dn < 9 + sp * sp / (2 * aBrk * 0.7) + 6) target = Math.min(target, Math.sqrt(2 * aBrk * 0.7 * Math.max(0, dn - 9))); }
          else {
            const hot = o.creep || (o.careful ? 5 : 9);                         // (chasing hard, it only lifts off)
            target = Math.min(target, Math.sqrt(hot * hot + 2 * aBrk * Math.max(0, dn - 14)));
            if (dn < 22) {
              if ((this.jT -= dt) <= 0) { this.jT = 0.25; this.cross = this.crossing(node, hx, hz); }
              if (this.cross && !(this.crossW > 3.5) && !sig.crossClear(node.i)) { this.crossW = (this.crossW || 0) + dt; target = Math.min(target, dn > 11 ? 1.6 : target); }
            }
          }
        } else this.crossW = 0;
      } else this.crossW = 0;
    }
    // ---- what's in front: keep up with it, a real gap behind you at speed, a dead stop short of a person
    const H = this.ahead || { gap: 99, side: 99 };
    if (H.gap < 99) {
      const stand = H.person ? 4 : H.isPlayer ? 3.6 + sp * 0.3 : 3.2 + (o.gentle ? 0.8 : 0);
      const room = Math.max(0, H.gap - stand), vo = Math.max(0, H.ov || 0);
      target = Math.min(target, H.person ? Math.sqrt(2 * aBrk * 0.8 * room) : Math.max(vo + room * 0.9, Math.min(vo + 3, Math.sqrt(vo * vo + 2 * aBrk * 0.7 * room))));
      this.waitT = H.still && sp < 1 ? this.waitT + dt : 0;
      // someone in the way: a honk; a queue in the way on a call: the horn as well as the siren, and wait for them to move over
      if (this.waitT > 1 && !(this.honkT > 0) && (H.person || o.emergency)) { this.honkT = H.person ? 4 : 2.5; G.traffic.honks && G.traffic.honks.push({ x: v.x, z: v.z, kind: 'car', n: H.person ? 1 : 2 }); }
    } else this.waitT = 0;
    if (H.side < 99) target = Math.min(target, H.side);
    this.honkT = (this.honkT || 0) - dt;
    // emergency: traffic ahead moves over, each to the side away from us, and eases off (not what's already clear)
    if (o.emergency && (this.yieldT = (this.yieldT || 0) - dt) <= 0) {
      this.yieldT = 0.5;
      const mine = off - cur;
      G.traffic.near(v.x + hx * 18, v.z + hz * 18, 20, (q) => {
        if (!q.T || q.jc || q.isPlayer || q.service) return;
        const rx = q.x - v.x, rz = q.z - v.z, al = rx * hx + rz * hz; if (al < 0 || al > 38) return;
        const sd = -rx * hz + rz * hx - mine; if (Math.abs(sd) > wHalf + 2.6) return;
        const same = (q.hx ?? hx) * hx + (q.hz ?? hz) * hz >= 0, dir = (sd > 0 ? 1 : -1) * (same ? 1 : -1);
        q.latT = q.lat + dir * 1.4; if (same || Math.abs(sd) < wHalf + 1) q.v = Math.min(q.v, same ? 3 : 2);
      });
    }
    // ---- drive it: one smooth line (the wheel doesn't snap), the pedals by how far off the speed we are
    const wantS = clamp(diff * (v.spec.two ? 2.4 : 2.1) / (1 + sp * 0.03), -1, 1), rate = (sp < 4 ? 6 : 3.6) * dt;
    this.st += clamp(wantS - this.st, -rate, rate);
    inp.steer = this.st;
    const maxT = o.gentle ? 0.6 : 0.95;
    if (sp < target - 0.2) inp.throttle = clamp((target - sp) * 0.35 + 0.25, 0.25, Math.abs(diff) < 0.4 ? maxT : 0.55);
    else if (sp > target + 0.6) { const over = sp - target; inp.brake = H.gap < 6 || target < 0.3 ? 1 : clamp(over * 0.28, 0.25, 1); }
    v.update(dt, inp, G.traffic);
    // ---- stuck? (wanting to move, not moving, and not just waiting politely behind something for a moment)
    const moved = Math.hypot(v.x - this.lastX, v.z - this.lastZ);
    this.progT += dt;
    if (this.progT > 1.6) {
      const waiting = (H.gap < 8 && this.waitT < (o.emergency ? 4 : 6)) || this.crossW > 0 && this.crossW < 3.5;
      if (moved < 0.6 && target > 0.5 && !waiting) {
        this.fails++;
        if (this.fails === 1 && haveRoad) {
          // first, like anyone would: back off a length and go round on whichever side has the room
          const lim = Math.max(0, half - Wv / 2 - 0.15); this.look(14);
          let side = 0, bf = 6;
          for (const c of [base, -lim, lim, 0]) { if (Math.abs(c - cur) < 0.8) continue; const f = this.free(c - cur, wHalf, null); if (f > bf) { bf = f; side = c - cur; this.shift = c - base; } }
          const sg = side ? Math.sign(side) : (diff > 0 ? 1 : -1);
          this.rec = { ph: 'back', t: 0, dur: 1.1, steer: -sg * 0.6, fwd: 0.7 }; this.shiftT = 4;
        } else this.rec = { ph: 'back', t: 0, dur: 1.5, steer: diff > 0 ? -1 : 1 };
        if (this.fails >= 3) {                                                  // keeps failing: this road's shut, another way
          this.fails = 0; this.routeT = 0; this.idx = 0;
          const n = W.graph.nearest(v.x + hx * 10, v.z + hz * 10, 30); if (n) { this.avoid = n.e; this.avoidT = 40; }
        }
      } else if (moved > 3) this.fails = 0;
      this.progT = 0; this.lastX = v.x; this.lastZ = v.z;
    }
  }
  // at a red we mean to cross: is anything coming across the junction at speed?
  crossing(node, hx, hz) {
    const G = this.G, v = this.v; let c = false;
    G.traffic.near(node.x, node.z, 24, (q) => {
      if (c || q === v.agent || q.service || Math.abs(q.v || 0) < 2.5) return;
      const qx = q.hx ?? 1, qz = q.hz ?? 0; if (Math.abs(qx * hx + qz * hz) > 0.6) return;                 // going our way or against it, not across
      const tx = node.x - q.x, tz = node.z - q.z, toward = tx * qx + tz * qz, d = Math.hypot(tx, tz);
      if (toward > -4 && d < 6 + Math.abs(q.v) * 1.8) c = true;
    });
    return c;
  }
  blockedBehind() {
    const G = this.G, v = this.v, hx = Math.cos(v.th), hz = Math.sin(v.th);
    let b = false;
    G.traffic.near(v.x - hx * 4, v.z - hz * 4, 5, (o) => { if (o === v.agent || b) return; const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz; if (al < -0.5 && al > -5 && Math.abs(-rx * hz + rz * hx) < 2) b = true; });
    return b || this.G.W.collision.ray(v.x, v.z, v.x - hx * 3.5, v.z - hz * 3.5) < 0.95;
  }
}
