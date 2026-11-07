// A crash between vehicles, by what each one weighs and how fast they met. Whatever's heavier carries on: a bus goes
// through a hatchback hardly slowed and the hatchback is thrown; a cycle that rides into a car stops dead and the car
// doesn't notice. Nothing bounces. A hit hard enough turns the car in the traffic into a real one (dented where it was
// struck, thrown and spun by the blow, its driver out and running), and it can be hit again where it lands. A two-
// wheeler goes over only if the blow beats its balance (a side hit sooner than one from behind), away from the blow.
import { Traffic } from '@orig/traffic/traffic.js';
import { Vehicle, knock } from '@orig/vehicles/vehicle.js';
import { Pilot } from '@orig/game/pilot.js';
import { promote } from './damage.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const now = () => performance.now()/1000, G0 = () => window.__nhAskG;
const THROWN = 8;            // m/s the blow gives a car before it's a real, dented one
const SLIDE = 6.5;           // m/s² of a pushed vehicle's tyres scraping

// where it stands in its lane (as traffic/spacing.js: along its link and across it, so it carries on from there)
function shift(v, dx, dz) {
  v.x += dx; v.z += dz;
  if (v.rx !== undefined) { v.rx += dx; v.rz += dz; }
  const e = v.l && v.l.e; if (!e || v.jc) return;
  v.s += dx*v.hx + dz*v.hz; if (e.len) v.s = clamp(v.s, 0.5, e.len - 0.5);
  const lim = Math.max(0.3, e.w/2 - (v.T.W || 0.8)/2 - 0.1); v.lat = clamp(v.lat + dx*v.hz - dz*v.hx, -lim, lim);
}
// pushed sideways or back: the slide dies on the tyres, and it drives on from where it stopped
const step = Traffic.prototype.step;
Traffic.prototype.step = function (v, dt) {
  const q = v._sh;
  if (q && dt > 0) {
    const sp = Math.hypot(q.vx, q.vz), k = Math.max(0, sp - SLIDE*dt)/(sp || 1);
    q.vx *= k; q.vz *= k; if (k <= 0) v._sh = null;
    shift(v, q.vx*dt, q.vz*dt);
  }
  return step.call(this, v, dt);
};
// a real car thrown by a blow: it slides on its locked tyres and spins, stopped by whatever it meets
const moving = new Set();
function throwCar(v, st, vx, vz, w) { v._c = { vx, vz, w, st }; moving.add(v); }
const upd = Traffic.prototype.update;
Traffic.prototype.update = function (dt, ...rest) {
  const r = upd.call(this, dt, ...rest);
  if (moving.size && dt > 0) for (const v of moving) { if (!v.root || !v.root.parent) { moving.delete(v); v._c = null; continue; } coast(this, v, dt); }
  return r;
};
function coast(TR, v, dt) {
  const q = v._c, sp = Math.hypot(q.vx, q.vz), W = v.W, k = Math.max(0, sp - 8.5*dt)/(sp || 1);
  q.vx *= k; q.vz *= k; q.w *= Math.max(0, 1 - 1.8*dt);
  v.x += q.vx*dt; v.z += q.vz*dt; v.th += q.w*dt;
  const c = W.collision && W.collision.resolve(v.x, v.z, v.spec.W/2);
  if (c) { v.x += c.nx*c.depth; v.z += c.nz*c.depth; const vn = q.vx*c.nx + q.vz*c.nz; if (vn < 0) { q.vx -= vn*c.nx; q.vz -= vn*c.nz; q.vx *= 0.6; q.vz *= 0.6; q.w *= 0.5; } }
  // what it's thrown into goes too
  if (sp > 4) TR.near(v.x, v.z, v.spec.L/2 + 1.5, (o) => {
    if (!o.T || o.isPlayer || o.parked || o._hitT > now() || Math.hypot(o.x - v.x, o.z - v.z) > (v.spec.L + o.T.L)/2*0.8) return;
    o._hitT = now() + 0.8;
    if (o.T.two && !o.fallen) { o._hit = { vx: q.vx*0.7, vz: q.vz*0.7 }; o.fallen = 3.5; }
    else if (!o.T.two) { o.v = 0; o._sh = { vx: q.vx*0.5, vz: q.vz*0.5 }; o.angry = 6; }
    q.vx *= 0.65; q.vz *= 0.65;
  });
  const st = q.st; st.x = v.x; st.z = v.z; st.hx = Math.cos(v.th); st.hz = Math.sin(v.th); TR.staticsT = 0;
  v.sync && v.sync(0);
  if (Math.hypot(q.vx, q.vz) < 0.08 && Math.abs(q.w) < 0.05) { v._c = null; moving.delete(v); }
}
// (a car left in the street knows its own record in the traffic's list of things to steer round)
const add = Pilot.prototype.addDropped;
Pilot.prototype.addDropped = function (veh, traffic) { const r = add.call(this, veh, traffic); const d = this.dropped.find(q => q.veh === veh); if (d) d.st.veh = veh; return r; };

// a car in a parked row, hit: the row's drawn one goes and a real one is standing there, the same colour, in the same spot
Vehicle.prototype.wakeParked = function (r) {
  const G = G0(), Pl = G && G.player, TR = G && G.traffic; if (!TR || r.taken) return false;
  r.taken = true;
  for (const it of r.items) it.off = true;
  for (const c of r.circles) c.off = true;
  if (r.static && TR.statics) { const i = TR.statics.indexOf(r.static); if (i >= 0) TR.statics.splice(i, 1); }
  Pl.W._propX = undefined;
  const v = new Vehicle(Pl.W, Pl.scene, Pl.vmats, r.kind, r.col);
  v.reset(r.x, r.z, Math.atan2(r.hz, r.hx)); v.y = Pl.W.surf.height(r.x, r.z); v.v = 0;
  v.plate = Pl.randomPlate ? Pl.randomPlate() : v.plate; v.sync && v.sync(0);
  Pl.addDropped(v, TR); TR.staticsT = 0;
  return true;
};
// where the blow went in on a real car: dented there, by how hard it was hit; turned by how far off its middle it was
function struck(v, cx, cz, dirx, dirz, dv, m2) {
  const c = Math.cos(v.th), s = Math.sin(v.th), dx = cx - v.x, dz = cz - v.z, S = v.spec;
  const lx = clamp(dx*c + dz*s, -S.L/2, S.L/2), lz = clamp(-dx*s + dz*c, -S.W/2, S.W/2), nx = dirx*c + dirz*s, nz = -dirx*s + dirz*c;
  if (dv > 3 && v.dent) {
    const bb = v.box(), ly = bb.min.y + (bb.max.y - bb.min.y)*0.36;
    try { v.dent(lx, ly, lz, nx, -0.12, nz, clamp(0.35 + dv*0.04, 0.35, 0.95), Math.min(0.28, (dv - 3)*0.024)); } catch (e) { /* drawn as it was */ }
    v.dmg = Math.min(0.97, (v.dmg || 0) + dv*dv*0.0009*(v.armorMul ?? 1));
  }
  return clamp(dv*(lx*nz - lz*nx)*12/(S.L*S.L + S.W*S.W), -3.5, 3.5);
}
Vehicle.prototype.hitTraffic = function (o, T, H, traffic) {
  // (what's thrown goes a little less far than the sums say: a body crumples and takes some of it, and an auto's so light it
  // flew off like a toy)
  const K = /^auto/.test(o.type || (o.veh && o.veh.type) || '') ? 0.72 : 0.88;
  const { nx, nz, J, imp, lx, lz, m2 } = H, dv = J/m2, ix = -nx*dv*K, iz = -nz*dv*K, hx = Math.cos(this.th), hz = Math.sin(this.th);
  const cx = this.x + hx*lx - hz*lz, cz = this.z + hz*lx + hx*lz, G = G0();
  o._hitT = now() + 0.5;
  // one left in the street: it's a real car already
  if (o.parked) {
    const v = o.veh, q = v._c, w = struck(v, cx, cz, -nx, -nz, dv, m2)*K;
    throwCar(v, o, (q ? q.vx : 0) + ix, (q ? q.vz : 0) + iz, (q ? q.w : 0) + w);
    if (imp > 2.2) this.events.push({ type: 'crash', speed: imp, kind: 2, x: o.x, z: o.z });
    return;
  }
  o.angry = 6;
  if (!(o.honkT > 0)) { o.honkT = 2.5; traffic.honks.push({ x: o.x, z: o.z, kind: T.honk, n: 2 }); }
  if (T.two) {
    // its balance: from the side it's quickly gone, from behind it mostly gets shoved along
    const along = Math.abs(ix*o.hx + iz*o.hz)/(dv || 1), bal = 1.7 + 1.9*along*along;
    knock(o, imp, 0.016);
    if (dv > bal && !o.fallen) { o._hit = { vx: ix, vz: iz }; o.fallen = 3.5; this.events.push({ type: 'knock', who: 'two', speed: imp, x: o.x, z: o.z }); return; }
  } else if (dv >= THROWN && !o.service && !o.wreck && !o.hideBody && !(o.argue > 0) && !((o.y || 0) > 0.5) && G) {
    const ovx = o.hx*(o.v || 0), ovz = o.hz*(o.v || 0), v = promote(G, o);
    if (v) {
      const st = G.player.dropped.find(q => q.veh === v)?.st, w = struck(v, cx, cz, -nx, -nz, dv, m2)*K;
      if (st) throwCar(v, st, ovx + ix, ovz + iz, w);
      this.events.push({ type: 'crash', speed: imp, kind: 2, x: v.x, z: v.z });
      return;
    }
  }
  if (!T.two) o.dmg = Math.min(0.97, (o.dmg || 0) + dv*dv*0.0012);
  // what goes along its heading is its speed; the rest shoves it across
  const along = ix*o.hx + iz*o.hz, v1 = Math.max(0, (o.v || 0) + along), used = v1 - (o.v || 0), sx = ix - o.hx*used, sz = iz - o.hz*used;
  o.v = v1;
  if (Math.hypot(sx, sz) > 0.15) o._sh = { vx: (o._sh?.vx || 0) + sx, vz: (o._sh?.vz || 0) + sz };
  if (imp > 1.5) this.events.push({ type: 'hit', who: o.type, speed: imp, x: o.x, z: o.z, o });
};
// (something much lighter you're still driving through: out of the way, no more cost to you)
Vehicle.prototype.shoveTraffic = function (o, dx, dz) { if (o.parked) return; shift(o, dx, dz); };
