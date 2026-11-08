// Being hit by what you're driving, the way it goes. How a body moves is settled by what hits it and how fast. A low car takes
// the legs and the body wraps onto the bonnet, then it goes on up the glass and over, lower and further the faster you were
// going, and comes down behind or beside you (wrap, roof vault). Something tall and flat-fronted, a bus, a tempo, an auto,
// takes them in the middle and they go down in front of it, and if it doesn't stop it goes over them (forward projection, run
// over). The front corner spins them off to the side (fender vault). A two-wheeler knocks them down and loses a lot of its
// own speed to do it. Nobody goes up high: the height comes from the shape of the car, and the speed they leave with is capped.
// They go over the car's real outline, so nobody passes through it, and walls stop them. Whoever's lying in the road is under
// you, not pushed out of your way: each axle goes over them with a bump you feel.
import * as THREE from 'three';
import { People } from '@orig/people/peds.js';
import { baseOf } from '../vehicles/models.js';
import { tickVoice } from '../game/voices.js';

const G0 = 9.81, HIP = 0.9, FLAT = 0.2, MARGIN = 0.3;
const TALL = new Set(['bus', 'tempo', 'auto', 'bolero']);
const out = (p) => p.hidden || p.pax || p.rideOf || p.lift || p.seat || p.seated || p.mode === 'inside' || p.ctl || p.fixed || p._vetalBody;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t*t*(3 - 2*t); };
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the height of the vehicle's top at u (+1 its nose, -1 its tail): bonnet, glass, roof, down at the back
function topAt(u, H, tall) {
  if (tall) return H;
  const hood = H*0.66, edge = H*0.56;
  if (u > 0.3) return edge + (hood - edge)*(1 - u)/0.7;
  if (u > -0.1) return hood + (H - hood)*(0.3 - u)/0.4;
  if (u > -0.6) return H;
  return H - (H - hood*0.95)*(-0.6 - u)/0.4;
}
const heightOf = (V, S) => { if (S._hgt) return S._hgt; let h = 1.4; try { const b = V.box(); h = b.max.y - b.min.y; } catch (e) { /* the usual */ } return (S._hgt = Math.max(0.9, h)); };

const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _p = new THREE.Vector3();
// (people/crowd.js: the body turned about its hips, on top of where it's standing)
window.__nhTum = (holder, p) => {
  const h = p._hit; if (!h || !h.draw) return;
  _a.set(h.nx, 0, h.nz); _q.setFromAxisAngle(_a, h.draw);
  holder.quaternion.premultiply(_q);
  _p.set(0, HIP, 0).applyQuaternion(_q);
  holder.position.x -= _p.x; holder.position.y += HIP - _p.y; holder.position.z -= _p.z;
};

People.prototype.struck = function (p, V, S, player, sp, fx, fz, al, ac) {
  // the same hit always goes the same way: what happens is settled by how fast, by what (its weight, how tall and flat
  // its front is) and where on its front it caught them, never by a roll of the dice
  const base = baseOf(V.type || 'auto'), two = !!S.two, tall = TALL.has(base) || TALL.has(V.type) || !V.spec, kmh = sp*3.6;
  const wide = Math.abs(ac)/(S.W/2 + MARGIN), side = Math.sign(ac) || 1, sx = -fz*side, sz = fx*side;
  // (km/h at which it kills, and at which it's critical: a tall flat front is worse than a bonnet, a two-wheeler far less)
  const [kD, kC, kK] = two ? [80, 55, 32] : tall ? [45, 32, 18] : [62, 45, 25];
  const dead = kmh >= kD, ko = dead || kmh >= kK, crit = !dead && kmh >= kC;
  p._down = true; p._slide = null;      // (draw/falls.js has nothing to add to this)
  p.fallen = dead || ko ? 1e6 : 3 + kmh*0.12; p.ko = ko; p.corpse = dead; p.unconscious = ko && !dead; p.v = 0; p.dodge = 0; p.steerT = 0;
  p.inj = { sev: dead ? 'dead' : crit ? 'critical' : ko ? 'ko' : 'knock', t: 0 };
  if (!ko) p.limp = 40 + kmh*2;
  this.remember(p, dead ? 'dead' : 'hit');
  this.events.push({ type: 'pedHit', p, speed: sp, x: p.x, z: p.z, sev: dead ? 'dead' : ko ? 'ko' : 'knock' });
  // how they leave: the share of your speed they take, what's added to the side, how they lift and turn
  const cap = Math.min(sp, 26);
  let along, lat, vy, spin;
  if (two) { along = 0.62*cap; lat = 0.12*cap*side; vy = Math.min(1.5, 0.4 + cap*0.05); spin = 2 + cap*0.15; }
  else if (tall) { along = 0.92*Math.min(cap, 17); lat = 0.08*cap*side; vy = 0.5; spin = 4; }
  else if (wide > 0.72) { along = 0.42*cap; lat = (0.22*cap + 0.8)*side; vy = Math.min(1.6, 0.5 + cap*0.05); spin = 3 + cap*0.2; }
  else if (kmh < 14) { along = 0.85*cap; lat = 0.1*cap*side; vy = 0.3; spin = 3; }
  else { along = Math.min(0.62*cap, 15); lat = 0.07*cap*side; vy = Math.min(1.4, 0.5 + cap*0.04); spin = 2.2 + cap*0.1; }
  p._hit = { x0: p.x, z0: p.z, x: p.x, z: p.z, y: HIP, vy, vx: fx*along + sx*lat, vz: fz*along + sz*lat, nx: -fz, nz: fx, ang: 0, spin, fx, fz, t: 0, lt: -1, bounce: 1, tall, yaw0: p.yaw, yaw: Math.atan2(fz, fx), H: heightOf(V, S), V, S, two, axle: 0 };
  // what it costs you: the weight of a person against yours
  const M = (S.mass || 1000) + (two ? 75 : 0), share = 75/(M + 75);
  const lost = Math.min(Math.abs(V.v)*share*1.2, Math.abs(V.v)); V.v -= Math.sign(V.v)*lost;
  if (two) { V.w = (V.w || 0) + side*Math.min(0.8, sp*0.04); }
  if (kmh > 18 && V.dent && !two) { try { const bb = V.box(), ly = bb.min.y + (bb.max.y - bb.min.y)*0.42; V.dent(S.L/2*Math.sign(V.v || 1), ly, ac, Math.sign(V.v || 1), -0.1, 0, 0.32, Math.min(0.07, kmh*0.0008)); } catch (e) { /* drawn as it was */ } }
};

// landed: straight into the lying pose, at once (the turn in the air comes off in the same frame: unwinding it while
// the clip lay them down took them through the road)
function lieNow(p) {
  const H = p.body && p.body.H; if (!H || !H.play) return;
  const a = H.play(p.ko ? 'death' : 'knockback', { once: true, fade: 0, restart: true });
  if (a && a.getClip) a.time = a.getClip().duration*0.97;
}
function flying(P, p, dt, V, S) {
  const h = p._hit, C = P.W && P.W.collision; h.t += dt;
  if (h.lt < 0) {
    h.vy -= G0*dt; h.y += h.vy*dt; h.x += h.vx*dt; h.z += h.vz*dt;
    // turned about the hips by the blow, to flat at most: braced while in the air (crowd.js holds the clip), no somersaults
    h.ang = Math.min(Math.PI/2, h.ang + h.spin*dt);
    // what they hit's outline, if they're still over it: they ride up it, they don't go through it
    const O = h.V;
    if (O && O === V && O.x !== undefined) {
      const hx = Math.cos(O.th), hz = Math.sin(O.th), rx = h.x - O.x, rz = h.z - O.z, la = rx*hx + rz*hz, lc = -rx*hz + rz*hx, W2 = S.W/2 + 0.2, L2 = S.L/2 + 0.15;
      if (Math.abs(lc) < W2 && Math.abs(la) < L2) {
        const top = topAt(Math.sign(O.v || 1)*la/(S.L/2), h.H, h.tall) + 0.14;
        if (h.tall) { const fr = Math.sign(O.v || 1); h.x = O.x + hx*fr*L2*1.001 + (lc*-hz); h.z = O.z + hz*fr*L2*1.001 + (lc*hx); }   // (a flat front has nothing to ride up: it carries them)
        else if (h.y <= top) {
          // on it: the bonnet, the glass, the roof carry them as a ramp would (up at the speed the surface rises under
          // them, the same at any frame rate), and its friction drags them towards its own speed
          const fr = Math.sign(O.v || 1), u = fr*la/(S.L/2), dTop = (topAt(u + 0.02, h.H, false) - topAt(u - 0.02, h.H, false))/0.04;
          const va = h.vx*hx + h.vz*hz, rel = va - (O.v || 0), rise = dTop*fr*rel/(S.L/2);
          h.y = top; h.vy = Math.max(h.vy, Math.min(7, rise));
          const pull = (1 - Math.exp(-dt*2.6))*-rel; h.vx += hx*pull; h.vz += hz*pull;
        }
      }
    }
    if (h.y <= FLAT) {
      h.y = FLAT;
      if (h.bounce > 0 && h.vy < -2.6) { h.bounce--; h.vy *= -0.24; h.vx *= 0.72; h.vz *= 0.72; h.spin *= 0.4; }
      else { h.vy = 0; h.lt = 0; h.show = 0; lieNow(p); }
    }
  } else {
    // on the ground: scraping to a stop, and settling as they lie (the clip takes the body down as this turn comes off)
    const v = Math.hypot(h.vx, h.vz), dv = 0.85*G0*dt; if (v > dv) { h.x += h.vx*dt; h.z += h.vz*dt; h.vx -= h.vx/v*dv; h.vz -= h.vz/v*dv; } else { h.vx = h.vz = 0; }
    h.lt += dt; h.show = 0;
  }
  // a wall's a wall
  if (C) { const r = C.resolve(h.x, h.z, 0.28); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { h.x += r.nx*r.depth; h.z += r.nz*r.depth; const vn = h.vx*r.nx + h.vz*r.nz; if (vn < 0) { h.vx -= 1.25*vn*r.nx; h.vz -= 1.25*vn*r.nz; h.vx *= 0.55; h.vz *= 0.55; } } }
  // turned to the way they're going, quickly (they don't get a say)
  const k = Math.min(1, h.t/0.14); p.yaw = h.yaw0 + wrapA(h.yaw - h.yaw0)*smooth(k);
  p.x = h.x; p.z = h.z;
  const wa = h.lt < 0 ? 1 : (h.show ?? 1);
  // (hips at h.y while the turn's on; as it comes off, the clip's own lying pose takes over at the ground)
  p.liftY = wa*(h.y - HIP);
  const a0 = h.ang; h._a = a0; const drawn = h.lt < 0 ? a0 : a0*wa; h.draw = drawn;
  if (h.lt >= 0.55 && !(Math.hypot(h.vx, h.vz) > 0.1)) {
    p.liftY = 0;
    if (p.mode === 'walk' || p.mode === 'cross') { p.dodgeX = (p.dodgeX || 0) + h.x - h.x0; p.dodgeZ = (p.dodgeZ || 0) + h.z - h.z0; }
    else if (p.anchor) { p.anchor.x = h.x; p.anchor.z = h.z; }
    p._hit = null;
  }
}

// a wheel going over someone on the ground
function overBody(P, p, V, S, player, sp, dt) {
  const hx = Math.cos(V.th), hz = Math.sin(V.th), rx = p.x - V.x, rz = p.z - V.z, al = rx*hx + rz*hz, ac = -rx*hz + rz*hx, s = Math.sign(V.v || 1);
  if (Math.abs(ac) > S.W/2 + 0.2 || Math.abs(al) > S.L/2 + 1 + sp*dt) { p._ovF = p._ovR = false; p._ovL = undefined; return; }
  const u = al*s, wb = (S.wb || S.L*0.6)/2, last = p._ovL ?? u; p._ovL = u;
  const axle = (i, at) => {
    if (!(last > at && u <= at)) return;
    // how much of a lift a body gives: a car's spring takes most of it, a two-wheeler's doesn't
    const kick = S.two ? 0.85 : (S.mass || 1000) > 5000 ? 0.1 : 0.42, bump = Math.min(1, 0.5 + sp*0.05);
    if (V.vy !== undefined) V.vy += kick*bump;
    V.v -= Math.sign(V.v)*Math.min(Math.abs(V.v), (S.two ? 0.9 : (S.mass || 1000) > 5000 ? 0.05 : 0.28));
    if (S.two) V.w = (V.w || 0) + (ac >= 0 ? 1 : -1)*0.25;
    const G = window.__nhAskG; G?.audio?.thud?.(Math.min(0.5, 0.18 + sp*0.012));
    // and what it does to them
    if (!p.corpse) {
      const kmh = sp*3.6, heavy = (S.mass || 1000) > 3000, dead = kmh >= (S.two ? 40 : heavy ? 8 : 22) || (p.inj && p.inj.sev === 'critical' && kmh >= 10);
      p.ko = true; p.unconscious = !dead; p.corpse = dead; p.fallen = 1e6; p.inj = { sev: dead ? 'dead' : 'critical', t: 0 };
      if (dead) P.events.push({ type: 'pedDied', p, x: p.x, z: p.z });
    }
    // dragged a little and rolled by it
    if (!p._hit) { const fx = hx*s, fz = hz*s; p._hit = { x0: p.x, z0: p.z, x: p.x, z: p.z, y: FLAT, vy: 0, vx: fx*Math.min(sp*0.2, 2.5), vz: fz*Math.min(sp*0.2, 2.5), nx: -fz, nz: fx, ang: 0, spin: 0, fx, fz, t: 1, lt: 0.6, bounce: 0, yaw0: p.yaw, yaw: p.yaw, H: 1, V, S, axle: 1, show: 0 }; }
  };
  axle(0, wb); axle(1, -wb);
}

const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...rest) {
  const V = player && !player.onFoot ? player.cur : null, S = player && player.spec;
  const overhead = V && V.deck >= 0 && player.y > 2.2;
  if (V && S && dt > 0 && !overhead) {
    const vx = (V.v || 0)*Math.cos(V.th) - (V.vl || 0)*Math.sin(V.th), vz = (V.v || 0)*Math.sin(V.th) + (V.vl || 0)*Math.cos(V.th), sp = Math.hypot(vx, vz);
    if (sp > 1.4) {
      const hx = Math.cos(V.th), hz = Math.sin(V.th), s = Math.sign(V.v || 1), reach = sp*dt + 0.05, RAD = S.L + reach + 2, L2 = S.L/2 + MARGIN, W2 = S.W/2 + MARGIN, fx = vx/sp, fz = vz/sp;
      for (const p of this.list) {
        if (Math.abs(p.x - V.x) > RAD || Math.abs(p.z - V.z) > RAD || out(p)) continue;
        if (p._hit && p._hit.lt < 0) continue;
        if (p.fallen > 1.6 || p.corpse) { overBody(this, p, V, S, player, sp, dt); continue; }
        if (p.fallen > 0) continue;
        const rx = p.x - V.x, rz = p.z - V.z, al = (rx*hx + rz*hz)*s, ac = -rx*hz + rz*hx;
        if (Math.abs(ac) < W2 && al < L2 && al > -L2 - reach) this.struck(p, V, S, player, sp, fx, fz, al, ac);
      }
    }
  }
  const r = upd.call(this, dt, player, ...rest);
  if (dt > 0) for (const p of this.list) if (p._hit) flying(this, p, dt, V, S);
  const G = window.__nhAskG; if (G) tickVoice(G);
  return r;
};

// ---- a cow. Half a tonne, and she doesn't get out of the way. Slowly you stop against her (people/bodies.js). Harder, you shove
// her and she goes off hurt, and it's cost your front. Fast, her legs go from under her: she comes up over the bonnet, you lose
// a good share of your speed and most of your front, and she lands on her side, dead if you were going hard enough. Everything
// that dies lies down the same way, a dog or a cat too, turning over rather than appearing on its side.
const COW_M = 420, DOWN = { cow: [0.75, -0.42], dog: [0.28, -0.2], cat: [0.18, -0.13] };
const TMP4 = new Float64Array(4), _qa = new THREE.Quaternion(), _ax = new THREE.Vector3(), _pv = new THREE.Vector3();
window.__nhDown = (m, a, dt) => {
  if (a.dead && !a._lying && !(a._thrown && a._thrown.stagger)) a._lying = { ang: 0, to: Math.PI/2, side: Math.random() < 0.5 ? -1 : 1 };
  const d = a._lying; if (!d) return;
  if (!a.dead && !a._thrown && !d.up) { d.up = true; d.to = 0; }
  const k = Math.min(1, (d.up ? 2.2 : 3.4)*dt); d.ang += (d.to - d.ang)*k*(d.up ? 1 : 1.4); d.ang = Math.min(d.ang, Math.PI/2);
  if (d.up && d.ang < 0.02) { a._lying = null; return; }
  const [c, low] = DOWN[a.cow ? 'cow' : a.kind || 'dog'] || DOWN.dog, yaw = a.yaw || 0;
  _ax.set(Math.cos(yaw), 0, Math.sin(yaw)); _qa.setFromAxisAngle(_ax, d.ang*d.side);
  m.holder.quaternion.premultiply(_qa); _pv.set(0, c, 0).applyQuaternion(_qa);
  const w = Math.sin(Math.min(1, d.ang/(Math.PI/2))*Math.PI/2);
  m.holder.position.x -= _pv.x; m.holder.position.z -= _pv.z; m.holder.position.y += c - _pv.y + low*w + (a._thrown ? a._thrown.y : 0);
};
People.prototype.hitCow = function (a, V, S, player, sp, fx, fz) {
  const kmh = sp*3.6, M = S.mass || 1000, two = !!S.two, big = M > 5000, before = V.v;
  // what you lose is the weight of her against yours, and it's not all of her at once at speed: her legs go first
  // (a dog weighs 25 kg and a cat 4: it's them that goes, you hardly feel it)
  const AM = a.cow ? COW_M : a.kind === 'cat' ? 4 : 25, share = (kmh > 45 ? 0.6 : 0.9)*AM/(M + AM), dv = Math.abs(V.v)*share;
  V.v -= Math.sign(V.v)*dv; V.vl = (V.vl || 0)*(1 - share);
  const off = (a.x - V.x)*-Math.sin(V.th) + (a.z - V.z)*Math.cos(V.th), sd = off >= 0 ? 1 : -1;      // (which side of your nose she was)
  if (two) V.w = (V.w || 0) - sd*Math.min(1.6, sp*0.06);
  V.dmg = Math.min(0.97, (V.dmg || 0) + dv*dv*0.004*(big ? 0.3 : 1)*(V.armorMul ?? 1));
  if (V.dent && a.cow) { try { const bb = V.box(), ly = bb.min.y + (bb.max.y - bb.min.y)*0.5; V.dent(S.L/2*Math.sign(before || 1), ly, 0, Math.sign(before || 1), -0.15, 0, Math.min(0.95, 0.45 + kmh*0.005), Math.min(0.25, 0.04 + kmh*0.0018)); } catch (e) { /* drawn as it was */ } }
  const small = !a.cow, down = small ? kmh > 15 : kmh > 42, dead = small ? kmh >= 30 : kmh >= 62 || (big && kmh >= 35);
  const lift = small ? Math.min(2.4, kmh*0.03) : big || two ? 0 : Math.min(2.1, Math.max(0, (kmh - 42)*0.035)), away = small ? Math.min(sp*0.9, 16) : Math.min(sp*(lift > 0.5 ? 0.42 : 0.78), 12);
  a.dead = true; a.moving = false; a.v = 0; a.rest = 25; a._dead = dead;
  a._thrown = { x: a.x, z: a.z, y: 0, vy: lift, vx: fx*away, vz: fz*away, t: 0, V, S, H: heightOf(V, S), tall: big || TALL.has(baseOf(V.type || 'auto')), down, dead, up: down && !dead ? (small ? 4 : 15) : 0, stagger: !down };
  if (down) a._lying = { ang: 0.01, to: Math.PI/2, side: -sd };
  if (a.cow) this.events.push({ type: 'cowHit', a, speed: sp, x: a.x, z: a.z, how: dead ? 'dead' : down ? 'down' : 'hurt', kmh });
  else { a.hurtT = dead ? 0 : 8; this.events.push({ type: 'animalHit', a, dead, x: a.x, z: a.z }); }
};
function cowFly(P, a, dt, V, S) {
  const f = a._thrown, C = P.W && P.W.collision; f.t += dt;
  f.vy -= G0*dt; f.y += f.vy*dt; f.x += f.vx*dt; f.z += f.vz*dt;
  const O = f.V;
  if (O && O === V && !f.tall) { const hx = Math.cos(O.th), hz = Math.sin(O.th), rx = f.x - O.x, rz = f.z - O.z, la = rx*hx + rz*hz, lc = -rx*hz + rz*hx; if (Math.abs(lc) < S.W/2 + 0.5 && Math.abs(la) < S.L/2 + 0.6 && f.vy !== 0) { const top = topAt(Math.sign(O.v || 1)*la/(S.L/2), f.H, false) - 0.35; if (f.y < top && f.down) { f.y = top; f.vy = Math.max(f.vy, 0.4); } } }
  if (f.y <= 0) { f.y = 0; f.vy = 0; const v = Math.hypot(f.vx, f.vz), dv = 6.5*dt; if (v > dv) { f.vx -= f.vx/v*dv; f.vz -= f.vz/v*dv; } else { f.vx = f.vz = 0; } }
  if (C) { const r = C.resolve(f.x, f.z, 0.55); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { f.x += r.nx*r.depth; f.z += r.nz*r.depth; f.vx *= 0.3; f.vz *= 0.3; } }
  a.x = f.x; a.z = f.z;
  if (f.y === 0 && !f.vx && !f.vz) {
    if (f.dead) { a._dead = true; a._thrown = null; return; }
    if (f.up > 0) { f.up -= dt; if (f.up > 0) return; }
    // back on her feet, and off, hurt
    a._thrown = null; a.dead = false; a.hurtT = 9; a.moving = true; a.dir = -a.dir; a.rest = 10;
    if (a.e && P.g && P.g.at) { P.g.at(a.e, a.s, TMP4); a.s = Math.max(2, Math.min(a.e.len - 2, a.s + (a.x - TMP4[0])*TMP4[2] + (a.z - TMP4[1])*TMP4[3])); P.g.at(a.e, a.s, TMP4); a.lat = (a.x - TMP4[0])*TMP4[3] - (a.z - TMP4[1])*TMP4[2]; }
  }
}
const SHAPE = [[0.72, 0.3], [0.12, 0.33], [-0.5, 0.31]], SMALL_DOG = [[0.3, 0.16], [-0.25, 0.16]], SMALL_CAT = [[0.12, 0.1], [-0.12, 0.1]];
const up2 = People.prototype.update;
People.prototype.update = function (dt, player, ...rest) {
  const V = player && !player.onFoot ? player.cur : null, S = player && player.spec;
  if (V && S && dt > 0 && !(V.deck >= 0 && player.y > 2.2)) {
    const vx = (V.v || 0)*Math.cos(V.th) - (V.vl || 0)*Math.sin(V.th), vz = (V.v || 0)*Math.sin(V.th) + (V.vl || 0)*Math.cos(V.th), sp = Math.hypot(vx, vz);
    if (sp > 4.2) {
      const hx = Math.cos(V.th), hz = Math.sin(V.th), s = Math.sign(V.v || 1), reach = sp*dt + 0.05, RAD = S.L + reach + 3;
      for (const a of this.animals) {
        const pet = a.kind === 'dog' || a.kind === 'cat';
        if (!(a.cow || pet) || a.gone || a.free || Math.abs(a.x - V.x) > RAD || Math.abs(a.z - V.z) > RAD) continue;
        if (a._thrown || (pet && a.dead)) continue;
        const ax = Math.cos(a.yaw || 0), az = Math.sin(a.yaw || 0);
        for (const [o, r] of a.cow ? SHAPE : a.kind === 'cat' ? SMALL_CAT : SMALL_DOG) {
          const rx = a.x + ax*o - V.x, rz = a.z + az*o - V.z, al = (rx*hx + rz*hz)*s, ac = -rx*hz + rz*hx;
          if (Math.abs(ac) < S.W/2 + r && al < S.L/2 + r && al > -S.L/2 - reach) {
            // (one that's down already is a bump you go over, not a wall)
            if (a.dead) { if (!(a._ovT > performance.now())) { a._ovT = performance.now() + 1200; if (V.vy !== undefined) V.vy += S.two ? 1.6 : (S.mass || 1000) > 5000 ? 0.3 : 1.1; V.v *= S.two ? 0.72 : 0.94; window.__nhAskG?.audio?.thud?.(0.5); } }
            else this.hitCow(a, V, S, player, sp, vx/sp, vz/sp);
            break;
          }
        }
      }
    }
  }
  const res = up2.call(this, dt, player, ...rest);
  if (dt > 0) for (const a of this.animals) if (a._thrown) cowFly(this, a, dt, V, S);
  return res;
};
