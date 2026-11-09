// Vehicles take up room too. Each pair that overlaps (their real boxes, length and width) is eased apart: sideways across
// the lane if that's the shorter way out and there's lane to do it in, else the one behind drops back, and it then waits
// until the one in front has gone. Whatever it's moved by stays moved. (It used to be nudged where the road would put it
// straight back: on a junction's curve, past the edge of its lane, or back along a lane that it then drove forward along,
// so two vehicles touching went forwards and backwards every frame, as fast as the screen could show.)
import { Traffic } from '@orig/traffic/traffic.js';

const RAD = 120, GAP = 0.06, NEAR = 0.3;
const step = Traffic.prototype.step;
Traffic.prototype.step = function (v, dt) {
  if (!(v._hold > 0) || !(dt > 0)) { step.call(this, v, dt); if (v.ignore && v.ignore.isPlayer) v.ignore = null; return; }  // (nobody drives through you to get out of a jam: they go round)
  v._hold -= dt; v._heldT = (v._heldT || 0) + dt;
  const s0 = v.s, l0 = v.l, jc0 = v.jc, t0 = jc0 ? jc0.t : 0;
  step.call(this, v, dt);
  if (v.ignore && v.ignore.isPlayer) v.ignore = null;
  // waiting
  // (behind one that's moving it goes at its speed, no faster; behind one that's stopped, it's stopped)
  const cap = v._cap || 0, ds = cap*dt;
  if (v.l === l0 && v.jc === jc0) { if (jc0) jc0.t = Math.min(jc0.t, t0 + ds/jc0.L); else v.s = Math.min(v.s, s0 + ds); v.v = Math.min(v.v, cap); this.place(v, dt); }
  // locked solid for a long time with nobody looking: gone, the way a stuck one goes anyway
  if (v._heldT > 25 && this._seen && !this._seen(v.x, v.z)) v.alive = false;
};
// where the road will put it from now on is moved too, on a link or on a junction's curve
function move(v, dx, dz) {
  v.x += dx; v.z += dz; if (v.rx !== undefined) { v.rx += dx; v.rz += dz; }
  const j = v.jc;
  if (j) { j.p0x += dx; j.p0z += dz; j.cx += dx; j.cz += dz; j.p2x += dx; j.p2z += dz; }
}
const dropBack = (v, d) => {
  const hx = v.hx ?? 1, hz = v.hz ?? 0;
  if (v.jc) return move(v, -hx*d, -hz*d);
  const s = Math.max(0, (v.s || 0) - d), got = (v.s || 0) - s; v.s = s; v.x -= hx*got; v.z -= hz*got; if (v.rx !== undefined) { v.rx -= hx*got; v.rz -= hz*got; }
};
// sideways by this much of (nx, nz), as far as its lane lets it. Returns how far it went
function aside(v, nx, nz, d) {
  if (v.jc) return 0;
  const hx = v.hx ?? 1, hz = v.hz ?? 0, e = v.l && v.l.e; if (!e) return 0;
  const hi = Math.max(0.3, e.w/2 - (v.T.W || 0.8)/2 - 0.15), lo = e.oneway ? -hi : 0.3, want = (nx*hz - nz*hx)*d, lat = Math.max(lo, Math.min(hi, v.lat + want)), got = lat - v.lat;
  if (Math.abs(got) < 1e-5) return 0;
  v.lat = lat; if (v.latT !== undefined) v.latT = Math.max(lo, Math.min(hi, v.latT + got));
  v.x += hz*got; v.z -= hx*got; if (v.rx !== undefined) { v.rx += hz*got; v.rz -= hx*got; }
  return Math.abs(got);
}
const upd = Traffic.prototype.update;
Traffic.prototype.update = function (dt, px, pz, avoidView) {
  upd.call(this, dt, px, pz, avoidView);
  if (!(dt > 0)) return;
  const L = [];
  for (const v of this.list) {
    if (!v.alive || v.isPlayer || v.parked || v.wreck || v.fallen > 0 || v.hideBody || !v.T) continue;
    if (!(v._hold > 0)) v._heldT = 0;
    if (Math.abs(v.x - px) > RAD || Math.abs(v.z - pz) > RAD) continue;
    L.push(v);
  }
  const k = Math.min(1, dt*10);
  for (let i = 0; i < L.length; i++) {
    const a = L[i], ahx = a.hx ?? Math.cos(a.yaw || 0), ahz = a.hz ?? Math.sin(a.yaw || 0);
    for (let j = i + 1; j < L.length; j++) {
      const b = L[j], dx = b.x - a.x, dz = b.z - a.z, reach = (a.T.L + b.T.L)*0.5 + NEAR;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
      // in a's frame, b's box projected: half-extents along and across a's heading
      const bhx = b.hx ?? Math.cos(b.yaw || 0), bhz = b.hz ?? Math.sin(b.yaw || 0);
      const c = Math.abs(ahx*bhx + ahz*bhz), s = Math.sqrt(Math.max(0, 1 - c*c));
      const bAl = b.T.L/2*c + b.T.W/2*s, bAc = b.T.L/2*s + b.T.W/2*c;
      const al = dx*ahx + dz*ahz, ac = -dx*ahz + dz*ahx;
      const pa = a.T.L/2 + bAl + GAP - Math.abs(al), pc = a.T.W/2 + bAc + GAP - Math.abs(ac);
      if (pc <= 0 || pa <= -NEAR) continue;
      // who's driving into whom: the one pointing at the other. Both (nose to nose, or across each other): the slower one waits
      const aInto = dx*ahx + dz*ahz > 0, bInto = -(dx*bhx + dz*bhz) > 0;
      if (!aInto && !bInto) continue;                 // (back to back: they're leaving)
      const back = aInto && bInto ? ((a.v || 0) < (b.v || 0) || ((a.v || 0) === (b.v || 0) && a.id < b.id) ? a : b) : aInto ? a : b;
      back._hold = Math.max(back._hold || 0, pa > 0 ? 0.4 : 0.2); back._cap = Math.max(0, (back === a ? b : a).v || 0);
      if (pa <= 0) continue;                          // (nearly touching: it just waits)
      if (pc < pa) {
        // across: each moves its share of the way out, sideways in its own lane (a light one more than a heavy one)
        const sg = Math.sign(ac) || (i % 2 ? 1 : -1), ma = a.T.mass || 500, mb = b.T.mass || 500, wa = mb/(ma + mb), nx = -ahz*sg, nz = ahx*sg;
        // (and a real overlap, past a few centimetres, is put right at once: two cars are never inside each other)
        const max = 1.2*dt + Math.max(0, pc - 0.04), st = Math.min(Math.max(pc*k, pc - 0.04), max), got = aside(a, -nx, -nz, st*wa) + aside(b, nx, nz, st*(1 - wa));
        if (got >= st*0.5) continue;
      }
      // along: the one behind drops back, if that's away from the other. If it isn't, it only waits
      const fx = back === a ? b : a, bhx2 = back === a ? ahx : bhx, bhz2 = back === a ? ahz : bhz, ox = back.x - fx.x, oz = back.z - fx.z, od = Math.hypot(ox, oz) || 1;
      const away = -(ox*bhx2 + oz*bhz2)/od;
      if (away < -0.2) dropBack(back, Math.min(pa, 0.9*dt + Math.max(0, back._cap)*dt*0.6 + Math.max(0, pa - 0.04))*Math.min(1, -away*1.5));   // (never so fast it reverses what it's doing)
    }
  }
};
