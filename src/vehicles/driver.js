// A driver with sense, for the police, the ambulance and anyone the game drives with a purpose: follows its road
// route (never cutting across the footpath), keeps left where the road is wide enough, slows for bends before
// them, follows slower traffic, stops for people (and honks), overtakes what's stopped when the next lane's clear,
// gets itself back onto the road, and when it's stuck or its target is behind it, backs up and turns like a person
// would (a three-point turn); if that keeps failing, it takes another way.
import { wrapAngle, clamp } from '../core/util.js';

const T4 = [0, 0, 0, 0];
export class Driver {
  constructor(veh, G, o = {}) {
    this.v = veh; this.G = G; this.o = Object.assign({ lane: 1.5, emergency: false, signals: true, offroadEnd: false }, o);
    this.route = null; this.idx = 0; this.routeT = 0; this.tx = 0; this.tz = 0;
    this.progT = 0; this.lastX = veh.x; this.lastZ = veh.z; this.rec = null; this.fails = 0; this.shift = 0; this.shiftT = 0; this.waitT = 0;
  }
  goTo(x, z) { if (Math.hypot(x - this.tx, z - this.tz) > 20) this.routeT = 0; this.tx = x; this.tz = z; }
  plan() {
    const W = this.G.W, v = this.v, hx = Math.cos(v.th), hz = Math.sin(v.th);
    // start from the road we're on, preferably one running our way
    const a = W.graph.nearest(v.x + hx * 3, v.z + hz * 3, 40), b = W.graph.nearest(this.tx, this.tz, 80);
    this.route = null; this.idx = 0;
    if (!a || !b) return;
    const r = W.graph.route(a, b, this.o.emergency);
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
  // what's ahead in our path (traffic, parked vehicles, people): the gap, and whether it's standing still
  scan(lat) {
    const G = this.G, v = this.v, hx = Math.cos(v.th), hz = Math.sin(v.th), S = v.spec, wHalf = (S.W || 1.8) / 2 + 0.55, look = 7 + Math.abs(v.v) * 1.6;
    let gap = 99, still = false, person = false;
    G.traffic.near(v.x + hx * look / 2, v.z + hz * look / 2, look / 2 + 6, (o) => {
      if (o === v.agent) return;
      const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz, ac = -rx * hz + rz * hx, ow = ((o.T ? o.T.W : o.W) || 1.8) / 2;
      if (al > 0.5 && al < look && Math.abs(ac - lat) < wHalf + ow && al < gap) { gap = al; still = Math.abs(o.v || 0) < 0.6; }
    });
    for (const p of G.people.list) {
      if (p.hidden || p.crew || p.cop) continue;
      const rx = p.x - v.x, rz = p.z - v.z; if (Math.abs(rx) > look + 2 || Math.abs(rz) > look + 2) continue;
      const al = rx * hx + rz * hz, ac = -rx * hz + rz * hx;
      if (al > 0.5 && al < Math.min(look, 12) && Math.abs(ac - lat) < wHalf + 0.3 && al < gap) { gap = al; still = true; person = true; }
    }
    return { gap, still, person };
  }
  update(dt, want) {
    const G = this.G, W = G.W, v = this.v, o = this.o, hx = Math.cos(v.th), hz = Math.sin(v.th), sp = Math.abs(v.v);
    if ((this.routeT -= dt) <= 0) { this.routeT = 2.5; this.plan(); }
    const inp = { throttle: 0, brake: 0, steer: 0, handbrake: false };
    // ---- recovering: back up with the wheel turned, then forward the other way
    if (this.rec) {
      const R = this.rec; R.t += dt;
      if (R.ph === 'back') { inp.brake = 0.7; inp.steer = R.steer; v.reverse = true; if (R.t > R.dur || this.blockedBehind()) { R.ph = 'fwd'; R.t = 0; v.reverse = false; } }
      else { v.reverse = false; inp.throttle = 0.6; inp.steer = -R.steer; if (R.t > 1.4) { this.rec = null; this.progT = 0; } }
      v.update(dt, inp, G.traffic); return;
    }
    v.reverse = false;
    if (want <= 0) { inp.brake = 1; inp.handbrake = sp < 0.5; v.update(dt, inp, G.traffic); return; }
    // ---- where to aim
    let ax = this.tx, az = this.tz, curve = 0, end = true;
    const onRoad = W.surf.isRoad(v.x, v.z);
    if (this.route && this.route.length >= 4) {
      this.project();
      const look = 5 + sp * 0.9, A = this.along(look);
      end = A.end && this.remaining() < 12;
      ax = A.x; az = A.z;
      // keep left of the middle, but only where the road is wide enough for it
      const e = W.graph.nearest(ax, az, 20), half = e ? e.e.w / 2 : 3, lane = Math.min(o.lane, half * 0.45);
      let lx = A.dz * lane, lz = -A.dx * lane;
      if (!W.surf.isRoad(ax + lx, az + lz)) { lx *= 0.3; lz *= 0.3; }
      ax += lx; az += lz;
      // overtaking: the lane to the right for a few seconds
      if (this.shiftT > 0) { this.shiftT -= dt; ax += -A.dz * this.shift; az += A.dx * this.shift; }
      const B = this.along(look + 18); curve = Math.abs(wrapAngle(Math.atan2(B.dz, B.dx) - Math.atan2(A.dz, A.dx)));
      // the last stretch: to the target itself, if it's on the road (or we're allowed off it)
      if (end && (o.offroadEnd || W.surf.isRoad(this.tx, this.tz))) { ax = this.tx; az = this.tz; }
    }
    // off the road: back onto the nearest bit of it first, slowly
    if (!onRoad && !end) { const n = W.graph.nearest(v.x, v.z, 40); if (n) { W.graph.at(n.e, n.s, T4); ax = T4[0] + T4[2] * 4; az = T4[1] + T4[3] * 4; want = Math.min(want, 4); } }
    const diff = wrapAngle(Math.atan2(az - v.z, ax - v.x) - v.th);
    // the target's behind us and we're slow: turn round properly
    if (Math.abs(diff) > 2.2 && sp < 3 && Math.hypot(ax - v.x, az - v.z) > 6) { this.rec = { ph: 'back', t: 0, dur: 1.6, steer: diff > 0 ? -1 : 1 }; v.update(dt, inp, G.traffic); return; }
    // ---- how fast
    let target = want * (curve > 1.2 ? 0.4 : curve > 0.7 ? 0.6 : curve > 0.35 ? 0.8 : 1) * (Math.abs(diff) > 0.8 ? 0.6 : 1);
    if (end) target = Math.min(target, Math.max(2, Math.hypot(this.tx - v.x, this.tz - v.z) * 0.6));
    // signals, when we're not on an emergency
    if (o.signals && !o.emergency && G.traffic.signals) {
      const n = W.graph.nearest(v.x + hx * 14, v.z + hz * 14, 10), node = n && W.graph.nodes[n.s < n.e.len / 2 ? n.e.a : n.e.b];
      if (node && node.signal) { const dn = Math.hypot(node.x - v.x, node.z - v.z); if (dn < 24 && dn > 7 && G.traffic.signals.stateForAngle(node.i, v.th) === 'r') target = Math.min(target, Math.max(0, (dn - 9) * 0.6)); }
    }
    // what's in front
    if ((this.scanT = (this.scanT || 0) - dt) <= 0) { this.scanT = 0.15; this.ahead = this.scan(this.shiftT > 0 ? this.shift : 0); }
    const H = this.ahead || { gap: 99 };
    if (H.gap < 99) {
      target = Math.min(target, Math.max(0, (H.gap - 3.2) * 0.9));
      this.waitT = H.still && sp < 1 ? this.waitT + dt : 0;
      // someone in the way: a honk; something stopped in the way: go round it if the next lane's clear
      if (H.person && this.waitT > 1 && !(this.honkT > 0)) { this.honkT = 4; G.traffic.honks && G.traffic.honks.push({ x: v.x, z: v.z, kind: 'car', n: 1 }); }
      if (H.still && !H.person && this.waitT > (o.emergency ? 0.8 : 2.5) && this.shiftT <= 0) for (const s of [2.6, -2.6]) { if (this.scan(s).gap > 12) { this.shift = s; this.shiftT = 4; this.waitT = 0; break; } }
    } else this.waitT = 0;
    this.honkT = (this.honkT || 0) - dt;
    // emergency: traffic ahead pulls over
    if (o.emergency && (this.yieldT = (this.yieldT || 0) - dt) <= 0) {
      this.yieldT = 0.5;
      G.traffic.near(v.x + hx * 16, v.z + hz * 16, 18, (q) => { if (!q.T || q.jc || q.isPlayer || q.service) return; const rx = q.x - v.x, rz = q.z - v.z, al = rx * hx + rz * hz; if (al < 0 || al > 34) return; const sd = -rx * hz + rz * hx; q.latT = q.lat + (sd > 0 ? 1 : -1) * 1.4; q.v = Math.min(q.v, 3); });
    }
    // ---- drive it
    inp.steer = clamp(diff * (v.spec.two ? 2.4 : 2.0), -1, 1);
    if (sp < target) inp.throttle = Math.abs(diff) < 0.4 ? 0.9 : 0.55;
    if (sp > target + 0.8) { inp.brake = sp > target + 4 ? 1 : 0.5; inp.throttle = 0; }
    v.update(dt, inp, G.traffic);
    // ---- stuck? (wanting to move, not moving, and not just waiting politely behind something for a moment)
    const moved = Math.hypot(v.x - this.lastX, v.z - this.lastZ);
    this.progT += dt;
    if (this.progT > 2) {
      const waiting = H.gap < 8 && this.waitT < 6;
      if (moved < 0.8 && target > 0.5 && !waiting) {
        this.fails++;
        this.rec = { ph: 'back', t: 0, dur: 1.5, steer: diff > 0 ? -1 : 1 };
        if (this.fails >= 3) { this.fails = 0; this.routeT = 0; this.idx = 0; }      // keep failing: another way
      } else if (moved > 3) this.fails = 0;
      this.progT = 0; this.lastX = v.x; this.lastZ = v.z;
    }
  }
  blockedBehind() {
    const G = this.G, v = this.v, hx = Math.cos(v.th), hz = Math.sin(v.th);
    let b = false;
    G.traffic.near(v.x - hx * 4, v.z - hz * 4, 5, (o) => { if (o === v.agent || b) return; const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz; if (al < -0.5 && al > -5 && Math.abs(-rx * hz + rz * hx) < 2) b = true; });
    return b || this.G.W.collision.ray(v.x, v.z, v.x - hx * 3.5, v.z - hz * 3.5) < 0.95;
  }
}
