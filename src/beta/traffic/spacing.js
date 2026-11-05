// Vehicles take up room too. Near you the traffic kept its gaps along the lane but not across it: two-wheelers
// splitting the lanes rode through each other, a scooter sat inside the one beside it at a signal. Each pair that
// overlaps (their real boxes, length and width) is eased apart: sideways across the lane if that's the shorter way
// out, else the one behind drops back.
import { Traffic } from '@orig/traffic/traffic.js';

const RAD = 50, GAP = 0.06;
const upd = Traffic.prototype.update;
Traffic.prototype.update = function (dt, px, pz, avoidView) {
  upd.call(this, dt, px, pz, avoidView);
  if (!(dt > 0)) return;
  const L = [];
  for (const v of this.list) {
    if (!v.alive || v.isPlayer || v.parked || v.wreck || v.fallen > 0 || v.hideBody || !v.T) continue;
    if (Math.abs(v.x - px) > RAD || Math.abs(v.z - pz) > RAD) continue;
    L.push(v);
  }
  const k = Math.min(1, dt*10);
  for (let i = 0; i < L.length; i++) {
    const a = L[i], ahx = a.hx ?? Math.cos(a.yaw || 0), ahz = a.hz ?? Math.sin(a.yaw || 0);
    for (let j = i + 1; j < L.length; j++) {
      const b = L[j], dx = b.x - a.x, dz = b.z - a.z, reach = (a.T.L + b.T.L)*0.5;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
      // in a's frame, b's box projected: half-extents along and across a's heading
      const bhx = b.hx ?? Math.cos(b.yaw || 0), bhz = b.hz ?? Math.sin(b.yaw || 0);
      const c = Math.abs(ahx*bhx + ahz*bhz), s = Math.sqrt(Math.max(0, 1 - c*c));
      const bAl = b.T.L/2*c + b.T.W/2*s, bAc = b.T.L/2*s + b.T.W/2*c;
      const al = dx*ahx + dz*ahz, ac = -dx*ahz + dz*ahx;
      const pa = a.T.L/2 + bAl + GAP - Math.abs(al), pc = a.T.W/2 + bAc + GAP - Math.abs(ac);
      if (pa <= 0 || pc <= 0) continue;
      if (pc < pa) {
        // across: each moves half the way out, sideways in its own lane (a light one moves more than a heavy one)
        const sg = Math.sign(ac) || (i % 2 ? 1 : -1), ma = a.T.mass || 500, mb = b.T.mass || 500, wa = mb/(ma + mb);
        const nx = -ahz*sg, nz = ahx*sg;           // from a towards b, across a
        shift(a, -nx*pc*wa*k, -nz*pc*wa*k);
        shift(b, nx*pc*(1 - wa)*k, nz*pc*(1 - wa)*k);
      } else {
        // along: the one behind (by a's heading) drops back and slows to the speed of the one in front
        const back = al > 0 ? a : b, front = back === a ? b : a;
        back.s = Math.max(0, (back.s || 0) - pa*k);
        const bx = back.hx ?? 1, bz = back.hz ?? 0; back.x -= bx*pa*k; back.z -= bz*pa*k;
        if (back.v > front.v) back.v = front.v;
      }
    }
  }
};
// move a vehicle sideways by (dx, dz): on a link its lane offset (and where it was steering to, so it doesn't steer
// straight back in); through a junction just its position for this frame
function shift(v, dx, dz) {
  const hx = v.hx ?? Math.cos(v.yaw || 0), hz = v.hz ?? Math.sin(v.yaw || 0);
  v.x += dx; v.z += dz;
  if (v.rx !== undefined) { v.rx += dx; v.rz += dz; }
  if (v.jc) return;
  // place(): x = base + hz*lat, z = base - hx*lat
  // (never off the carriageway, nor over onto the other side of a two-way road: what can't move over stays)
  const e = v.l && v.l.e; if (!e) return;
  const hi = Math.max(0.3, e.w/2 - (v.T.W || 0.8)/2 - 0.15), lo = e.oneway ? -hi : 0.3;
  const dl = dx*hz - dz*hx, lat = Math.max(lo, Math.min(hi, v.lat + dl));
  v.lat = lat;
  if (v.latT !== undefined) v.latT = Math.max(lo, Math.min(hi, v.latT + dl*0.5));
}
