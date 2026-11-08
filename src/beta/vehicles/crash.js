// A crash between vehicles, by what each one weighs and how fast they met. Whatever's heavier carries on: a bus goes
// through a hatchback hardly slowed and the hatchback is thrown; a cycle that rides into a car stops dead and the car
// doesn't notice. Nothing bounces. A hit hard enough turns the car in the traffic into a real one (dented where it was
// struck, thrown and spun by the blow, its driver out and running), and it can be hit again where it lands. A two-
// wheeler goes over only if the blow beats its balance (a side hit sooner than one from behind), away from the blow.
import { Traffic } from '@orig/traffic/traffic.js';
import { Vehicle, knock } from '@orig/vehicles/vehicle.js';
import { Pilot } from '@orig/game/pilot.js';
import { PlayerAuto } from '@orig/vehicles/player.js';
import { promote, toughOf } from './damage.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const now = () => performance.now()/1000, G0 = () => window.__nhAskG;
const THROWN = 8;            // m/s the blow gives a car before it's a real, dented one
const SLIDE = 6.5;           // m/s² of a pushed vehicle's tyres scraping

// where it stands in its lane (as traffic/spacing.js: along its link and across it, so it carries on from there)
function shift(v, dx, dz) {
  v.x += dx; v.z += dz;
  if (v.rx !== undefined) { v.rx += dx; v.rz += dz; }
  const J = v.jc; if (J) { J.p0x += dx; J.p0z += dz; J.cx += dx; J.cz += dz; J.p2x += dx; J.p2z += dz; return; }   // (on a junction's curve: the curve goes with it, or the next frame would put it straight back)
  const e = v.l && v.l.e; if (!e) return;
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
  // solid along its whole length, nose, middle and tail, not just a circle in the middle (its ends went into things)
  const hx = Math.cos(v.th), hz = Math.sin(v.th), r = v.spec.W/2, reach = Math.max(0, v.spec.L/2 - r);
  for (const u of reach > 0.2 ? [reach, 0, -reach] : [0]) {
    const c = W.collision && W.collision.resolve(v.x + hx*u, v.z + hz*u, r);
    if (c) { v.x += c.nx*c.depth; v.z += c.nz*c.depth; const vn = q.vx*c.nx + q.vz*c.nz; if (vn < 0) { q.vx -= vn*c.nx; q.vz -= vn*c.nz; q.vx *= 0.6; q.vz *= 0.6; q.w = q.w*0.5 + u*vn*0.15; } }
  }
  // thrown into a parked one: it wakes as a real car and takes a share of the blow, shoved and spun on where it was hit
  if (sp > 2.5 && W.parkedList) for (const rp of W.parkedList) {
    if (rp.taken || Math.abs(rp.x - v.x) > 6 || Math.abs(rp.z - v.z) > 6) continue;
    const two = rp.kind === 'scooter' || rp.kind === 'bike', d = Math.hypot(rp.x - v.x, rp.z - v.z);
    if (d > (v.spec.L + (two ? 1.8 : 4))/2*0.7) continue;
    if (!Vehicle.prototype.wakeParked.call(v, rp)) continue;
    const G = G0(), D = G && G.player.dropped[G.player.dropped.length - 1];
    if (D && D.veh && D.st) { const s2 = (rp.x - v.x)*q.vz - (rp.z - v.z)*q.vx; throwCar(D.veh, D.st, q.vx*(two ? 0.85 : 0.55), q.vz*(two ? 0.85 : 0.55), clamp(-s2*0.25, -3, 3)); }
    q.vx *= two ? 0.85 : 0.55; q.vz *= two ? 0.85 : 0.55;
  }
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
  if (window.__post && window.__post.shadows) window.__post.shadows.dirty = true;   // (parked ones are in the still shadows)
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
    v.dmg = Math.min(0.97, (v.dmg || 0) + dv*dv*0.0009*(v.armorMul ?? 1)*toughOf(v.type));
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
// Leaning on something with your foot down. No speed in it, so no blow: what counts is force. Your engine's pull at the
// wheels (its weight times its acceleration, by the drive mode and how far down your foot is), as far as your tyres can
// put it down (past that they spin), against what holds the other: its weight on its brakes, a parked one's on the
// handbrake alone. More than that and the two go together, as fast as what's left over can move the both of them; less
// and nothing moves. So a Huracan shoves a hatchback off the line, Corsa harder than Strada, and a scooter leans on a
// bus for ever. (m1, m2: what each weighs. Returns true when it's taken care of the contact.)
const DRIVEN = { super: 1, jeep: 1, sports: 0.65, lux: 0.55, auto: 0.7, tempo: 0.6, bus: 0.6 };
const HOLD = 7.4, HANDBRAKE = 3.2, FOOT = 3;         // m/s² of grip on: a driver's brakes, a handbrake (back wheels only), a rider's brake and feet
const AUTO_SPEC = { acc: 2.35, mu: 6.8 };
function press(o, T, nx, nz, depth, m1, m2, traffic) {
  const dt = this._cdt || 0; if (!(dt > 0)) return false;
  const S = this.spec || AUTO_SPEC, hx = Math.cos(this.th), hz = Math.sin(this.th), dx = -nx, dz = -nz, fa = dx*hx + dz*hz;
  const thr = this.throttle || 0, back = this.reverse && (this.brake || 0) > 0.1;
  if (back ? fa > -0.4 : !(thr > 0.05 && fa > 0.4)) return false;
  const hasVl = this.vl !== undefined, vl = hasVl ? this.vl : 0, vx = hx*this.v - hz*vl, vz = hz*this.v + hx*vl;
  const sl = o.parked ? o.veh && o.veh._c : o._sh, ovx = (o.hx ?? 1)*(o.v || 0) + (sl ? sl.vx : 0), ovz = (o.hz ?? 0)*(o.v || 0) + (sl ? sl.vz : 0);
  const mine = vx*dx + vz*dz, theirs = ovx*dx + ovz*dz;
  if (mine - theirs > 1.6) return false;              // (that's a hit, not a lean)
  const t = now();
  let P = this._press;
  if (!P || P.o !== o || t - P.t > 0.2) P = this._press = { o, vc: Math.max(0, theirs), t, sc: 0, x: o.x, z: o.z, jam: 0, told: false };
  P.t = t;
  const base = (this.type || 'auto').replace(/P$/, ''), a = back ? S.acc*0.7 : thr*S.acc*(this.accMul || 1)/(1 + (this.load || 0)*0.1);
  const F0 = m1*a, grip = m1*(S.mu || 8)*0.85*(DRIVEN[base] ?? (S.two ? 0.6 : 0.55)), F = Math.min(F0, grip);
  let hold = o.parked ? (o.veh && o.veh.spec.two ? 6 : HANDBRAKE) : T.two ? FOOT : HOLD;
  if (P.vc > 0.05) hold *= 0.82;                      // (tyres already sliding hold less than tyres standing)
  const R = m2*hold;
  P.vc = Math.max(0, P.vc + (F - R)/(m1 + m2)*dt);
  // you: out of it, and going as fast as the two are
  this.x += nx*depth; this.z += nz*depth;
  if (hasVl) { const nvx = vx + (P.vc - mine)*dx, nvz = vz + (P.vc - mine)*dz; this.v = nvx*hx + nvz*hz; this.vl = -nvx*hz + nvz*hx; }
  else this.v = Math.sign(fa)*P.vc/Math.max(0.5, Math.abs(fa));
  if (F0 > grip) { this.skidL = Math.max(this.skidL || 0, 0.5 + thr*0.5); this.rpm = Math.max(this.rpm || 0, 0.5 + thr*0.4); }
  if (!(P.vc > 0)) return true;
  // it: goes with you, turning if you've got it off its middle
  if ((P.sc -= dt) <= 0) { P.sc = 0.22 + Math.random()*0.22; this.events.push({ type: 'scrape', speed: 1.1, kind: 2 }); }
  if (o.parked) {
    const v = o.veh; if (!v) return true;
    const q = v._c, I = m2*(v.spec.L*v.spec.L + v.spec.W*v.spec.W)/12, lv = (o.x - this.x)*dz - (o.z - this.z)*dx;
    throwCar(v, o, P.vc*dx, P.vc*dz, clamp((q ? q.w : 0) - lv*(F - R)/I*dt, -1.5, 1.5));
    return true;
  }
  if (T.two && !o.fallen && (F > R*2.5 || P.vc > 1.2)) { o._hit = { vx: P.vc*dx*1.2, vz: P.vc*dz*1.2 }; o.fallen = 3.5; o.angry = 6; this.events.push({ type: 'knock', who: 'two', speed: 2, x: o.x, z: o.z }); return true; }
  o.v = 0; o.angry = 6; o._sh = { vx: P.vc*dx, vz: P.vc*dz };
  if (!T.two) o.dmg = Math.min(0.97, (o.dmg || 0) + dt*0.006);
  if (!(o.honkT > 0)) { o.honkT = 2.5; traffic.honks.push({ x: o.x, z: o.z, kind: T.honk, n: 3 }); }
  if (!P.told) { P.told = true; this.events.push({ type: 'hit', who: o.type, speed: 1.6, x: o.x, z: o.z, o }); }
  // a lane only goes so far: out of it, or in a junction, it's held to its lane no longer. The driver's out, and it's a real car being pushed
  const got = Math.hypot(o.x - P.x, o.z - P.z); P.x = o.x; P.z = o.z;
  P.jam = got < P.vc*dt*0.4 ? P.jam + dt : 0;
  const G = G0();
  if ((o.jc || P.jam > 0.2 || P.vc > 6) && P.vc > 0.15 && !o.service && !o.wreck && !o.hideBody && !(o.argue > 0) && !((o.y || 0) > 0.5) && G) {
    const v = promote(G, o), st = v && G.player.dropped.find(q => q.veh === v)?.st;
    if (st) { throwCar(v, st, P.vc*dx, P.vc*dz, 0); P.o = st; }
  }
  return true;
}
Vehicle.prototype.pressTraffic = press;
const vu = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) { this._cdt = dt; return vu.call(this, dt, inp, traffic); };
// your own auto: the same lean, then its bump as it was
const au = PlayerAuto.prototype.update;
PlayerAuto.prototype.update = function (dt, inp, traffic) { this._cdt = dt; return au.call(this, dt, inp, traffic); };
PlayerAuto.prototype.collideTraffic = function (traffic) {
  const hx = Math.cos(this.th), hz = Math.sin(this.th);
  const mine = [[1.0, 0.5], [0.0, 0.7], [-0.95, 0.7]].map(([o, r]) => [this.x + hx*o, this.z + hz*o, r]);
  traffic.near(this.x, this.z, 9, (o) => {
    if (o.isPlayer || o.T === undefined || Math.abs((o.y || 0) - this.agent.y) > 2) return;
    const T = o.T, n = Math.max(1, Math.round(T.L/T.W));
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : -T.L/2 + T.W/2 + (T.L - T.W)*k/(n - 1), ox = o.x + o.hx*off, oz = o.z + o.hz*off, orr = T.W/2 + 0.05;
      for (const [mx, mz, mr] of mine) {
        const dx = mx - ox, dz = mz - oz, d = Math.hypot(dx, dz), rr = mr + orr;
        if (d >= rr || d < 1e-4) continue;
        const nx = dx/d, nz = dz/d, depth = rr - d, myMass = 520, oMass = T.mass;
        if (press.call(this, o, T, nx, nz, depth, myMass, oMass, traffic)) return;
        const share = oMass/(myMass + oMass);
        this.x += nx*depth*share; this.z += nz*depth*share;
        const vx = hx*this.v, vz = hz*this.v, ovx = o.hx*o.v, ovz = o.hz*o.v, rel = (vx - ovx)*nx + (vz - ovz)*nz;
        if (rel < 0) {
          const imp = -rel, dv = imp*share*1.1, nvx = vx + nx*dv, nvz = vz + nz*dv;
          this.v = nvx*hx + nvz*hz;
          o.v = Math.max(0, o.v - imp*(1 - share)*0.8);
          o.angry = 6;
          if (T.two && imp > 3.0 && !o.fallen) { o.fallen = 3.5; this.events.push({ type: 'knock', who: 'two', speed: imp, x: o.x, z: o.z }); }
          else if (imp > 1.5) this.events.push({ type: 'hit', who: o.type, speed: imp, x: o.x, z: o.z });
          if (!(o.honkT > 0)) { o.honkT = 2.5; traffic.honks.push({ x: o.x, z: o.z, kind: T.honk, n: 2 }); }
        }
        return;
      }
    }
  });
};
// (something much lighter you're still driving through: out of the way, no more cost to you)
Vehicle.prototype.shoveTraffic = function (o, dx, dz) { if (o.parked) return; shift(o, dx, dz); };
