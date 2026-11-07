// Whatever you can see in the way, people go round. They only ever checked the buildings: a lamp post, a tree, a stall, a
// parked scooter, a car on the road, your car across the footpath, all of it they walked straight through. Now, near you,
// everyone on foot looks a step or so ahead and starts drifting to the clear side in good time, turned the way they're
// going; if they get there anyway they're stopped at its surface and slide along it, and someone stopped dead by a thing
// that fills the way turns back. Vehicles are their own boxes, moving or not. This runs last, after everything else has
// moved anybody, so what's drawn is what was checked.
import { People } from '@orig/people/peds.js';

const NEAR = 60, BODY = 0.27, LOOK = 1.25, PROBE = 0.36, SIDE = 1.15, TURN_BACK = 1.3;
const skip = (p) => p.hidden || p.pax || p.fixed || p.rideOf || p.lift || p.corpse || p.seat || p.seated || p.ctl || p.duty || p.dead || p.fallen > 0 || p.mode === 'inside' || p.mode === 'fight' || p._thru;
const blocks = (k) => k !== 3 && k !== 4;                         // (the edge of the map, river banks and rails: their own rules)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// moved by (dx, dz), the way they're being moved, so whatever places them next frame doesn't put them back
function move(p, dx, dz) {
  p.x += dx; p.z += dz;
  if (p.mode === 'stand' && p.anchor) { p.anchor.x += dx; p.anchor.z += dz; }
  else if (p.mode === 'walk' || p.mode === 'cross' || p.mode === 'stand') { p.dodgeX += dx; p.dodgeZ += dz; }
}
// how far a circle is into a box: out along the shallower way. Writes OUT, returns the depth, or 0
const OUT = [0, 0];
function intoBox(x, z, ox, oz, hx, hz, L, W, r) {
  const rx = x - ox, rz = z - oz, al = rx*hx + rz*hz, ac = -rx*hz + rz*hx, qa = Math.max(-L/2, Math.min(L/2, al)), qc = Math.max(-W/2, Math.min(W/2, ac));
  let da = al - qa, dc = ac - qc, d = Math.hypot(da, dc), dep;
  if (d >= r) return 0;
  if (d < 1e-4) { const pa = L/2 - Math.abs(al), pc = W/2 - Math.abs(ac); if (pa < pc) { da = Math.sign(al) || 1; dc = 0; dep = pa + r; } else { da = 0; dc = Math.sign(ac) || 1; dep = pc + r; } }
  else { da /= d; dc /= d; dep = r - d; }
  OUT[0] = da*hx - dc*hz; OUT[1] = da*hz + dc*hx;
  return dep;
}
const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...rest) {
  const res = upd.call(this, dt, player, ...rest);
  const G = window.__nhAskG, C = this.W && this.W.collision, T = G && G.traffic, IN = G && G.interiors;
  if (!C || !player || dt <= 0 || (IN && IN.inside)) return res;
  // your own: the one you're in, and the ones you've left on the street
  const mine = []; const cur = player.cur;
  if (cur && !player.onFoot && player.spec) mine.push([cur, player.spec]);
  if (player.dropped) for (const d of player.dropped) if (d.veh && d.veh !== cur && d.veh.spec) mine.push([d.veh, d.veh.spec]);
  const frame = this._arF = ((this._arF || 0) + 1) & 3, px = player.x, pz = player.z;
  for (const p of this.list) {
    if (skip(p)) { p.steerT = 0; continue; }
    if (Math.abs(p.x - px) > NEAR || Math.abs(p.z - pz) > NEAR) continue;
    const walking = p.mode === 'walk' || p.mode === 'cross' || p.mode === 'free' || p.mode === 'chase';
    const py = p.y || 0;
    // ---- looking ahead, a few times a second: what's a step on, and which side of it is clear
    if (walking && p.v > 0.2 && (p.id & 3) === frame) {
      const hx = p.hx ?? Math.cos(p.yaw), hz = p.hz ?? Math.sin(p.yaw), ax = p.x + hx*LOOK, az = p.z + hz*LOOK;
      let nx = 0, nz = 0, hit = false;
      const r0 = C.resolve(ax, az, PROBE);
      if (r0 && blocks(r0.kind)) { nx = r0.nx; nz = r0.nz; hit = true; }
      const box = (ox, oz, ohx, ohz, L, W) => { if (!hit && intoBox(ax, az, ox, oz, ohx, ohz, L, W, PROBE)) { nx = ax - ox; nz = az - oz; hit = true; } };
      for (const [V, S] of mine) box(V.x, V.z, Math.cos(V.th), Math.sin(V.th), S.L || 4, S.W || 1.7);
      if (T && !hit) T.near(ax, az, 3.5, (o) => { if (o.T && !o.isPlayer && Math.abs((o.y || 0) - py) < 2) box(o.x, o.z, o.hx, o.hz, o.T.L, o.T.W); });
      if (hit) {
        const rx = -hz, rz = hx; let s = Math.sign(nx*rx + nz*rz) || (p.id & 4 ? 1 : -1);
        // that side's blocked too? the other one
        const w = C.resolve(p.x + rx*s*.9, p.z + rz*s*.9, PROBE); if (w && blocks(w.kind)) s = -s;
        p.steerS = p.steerT > 0 ? p.steerS : s; p.steerT = 0.5;
      }
    }
    // ---- drifting to that side, turned the way they're now going
    if (p.steerT > 0) {
      p.steerT -= dt;
      const hx = p.hx ?? Math.cos(p.yaw), hz = p.hz ?? Math.sin(p.yaw), s = p.steerS, sp = SIDE*Math.min(1, (p.v || 1)/1.1);
      if (walking && p.v > 0.2) {
        move(p, -hz*s*sp*dt, hx*s*sp*dt);
        const want = p.yaw + s*Math.atan2(sp, Math.max(.6, p.v)); p.yaw += wrap(want - p.yaw)*Math.min(1, dt*9); p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
      }
    }
    // ---- at its surface: stopped there, sliding along it
    let pressed = false;
    const hx = p.hx ?? Math.cos(p.yaw), hz = p.hz ?? Math.sin(p.yaw);
    for (let it = 0; it < 2; it++) {
      const r = C.resolve(p.x, p.z, BODY);
      if (!r || !blocks(r.kind)) break;
      move(p, r.nx*r.depth, r.nz*r.depth); if (r.nx*hx + r.nz*hz < -.6) pressed = true;
    }
    for (const [V, S] of mine) { const d = intoBox(p.x, p.z, V.x, V.z, Math.cos(V.th), Math.sin(V.th), S.L || 4, S.W || 1.7, BODY); if (d) { move(p, OUT[0]*d, OUT[1]*d); if (OUT[0]*hx + OUT[1]*hz < -.6) pressed = true; } }
    if (T) T.near(p.x, p.z, 3.5, (o) => {
      if (!o.T || o.isPlayer || Math.abs((o.y || 0) - py) > 2) return;
      const d = intoBox(p.x, p.z, o.x, o.z, o.hx, o.hz, o.T.L, o.T.W, BODY);
      if (d) { move(p, OUT[0]*d, OUT[1]*d); if (OUT[0]*hx + OUT[1]*hz < -.6) pressed = true; }
    });
    // ---- stopped dead by something that fills the way: back the way they came
    if (pressed && p.mode === 'walk') { p.pressT = (p.pressT || 0) + dt; if (p.pressT > TURN_BACK) { p.pressT = 0; p.dir = -p.dir; p.steerT = 0; } }
    else if (p.pressT) p.pressT = Math.max(0, p.pressT - dt*2);
  }
  return res;
};
