// A two-wheeler knocked over falls like one. It used to be laid on its side in a single frame (lifted 30 cm off the
// road so it didn't sink), its rider still sat on it, and stood up again just as suddenly 3.5 s later.
// Now it's a solid body of its own (beta/vehicles/bikebody.js) from the moment it's hit: the blow and the speed it was
// doing send it over however they send it. Barely touched, it tips slowly onto its side; knocked at speed it goes
// down and slides on its side, grinding to a stop; hit at one end it spins round as it goes; hit hard it's rolled
// right over, and stopped dead from the front it goes end over end over the bars. The rider comes off and goes down on the road beside it (people/falls.js throws them
// along). Then they get up, walk back to it, haul it upright and ride on; one who's out cold or has walked off
// leaves it lying there.
import * as THREE from 'three';
import { Traffic } from '@orig/traffic/traffic.js';
import { makeBody, stepBody, lie } from '../vehicles/bikebody.js';

const G0 = () => window.__nhAskG;
const _e = new THREE.Euler(), _up = new THREE.Quaternion();
const step = Traffic.prototype.step;
Traffic.prototype.step = function (v, dt) {
  if (v.T && v.T.two && v.fallen > 0 && !v._tp && dt > 0) start(this, v);
  if (v._tp) { tick(this, v, dt); if (v._tp && v._tp.hold) { v.fallen = Math.max(v.fallen, 0.5); } }
  return step.call(this, v, dt);
};

function start(TR, v) {
  const G = G0(), P = G && G.player;
  // what hit it: your vehicle if it's right there, else whatever's closest and moving
  let hx = 0, hz = 0, hv = 0, hitX = v.x, hitZ = v.z;
  if (P && !P.onFoot && P.cur && Math.hypot(P.cur.x - v.x, P.cur.z - v.z) < 6) { hx = Math.cos(P.cur.th); hz = Math.sin(P.cur.th); hv = Math.abs(P.cur.v || 0); hitX = P.cur.x; hitZ = P.cur.z; }
  // (you, on foot, right beside it: it was your shove, and it goes over the way you shoved it. It used to take the
  // nearest moving vehicle for what hit it, and fell whichever way that happened to be going)
  else if (P && P.onFoot && P.foot && Math.hypot(P.foot.x - v.x, P.foot.z - v.z) < 3.2) { const F = P.foot, d = Math.hypot(v.x - F.x, v.z - F.z) || 1; hx = (v.x - F.x)/d; hz = (v.z - F.z)/d; hv = 2.6; hitX = F.x; hitZ = F.z; }
  else TR.near(v.x, v.z, 6, (o) => { if (o === v || !(Math.abs(o.v || 0) > hv)) return; hx = o.hx ?? 1; hz = o.hz ?? 0; hv = Math.abs(o.v); hitX = o.x; hitZ = o.z; });
  // it falls away from the hit: the side of it the hit came from (+roll tips it to its right, (-hz, hx))
  const rel = (hitX - v.x)*(-v.hz) + (hitZ - v.z)*v.hx; let side = rel > 0 ? -1 : 1;
  const H = v._hit; v._hit = null;                     // (the blow itself, when you know it: beta/vehicles/crash.js)
  const across = H ? H.vx*(-v.hz) + H.vz*v.hx : 0;
  if (H) { side = Math.abs(across) > 0.4 ? Math.sign(across) : (Math.random() < 0.5 ? -1 : 1); hv = Math.hypot(H.vx, H.vz); }
  const push = H ? Math.min(1, 9/(hv || 1)) : Math.min(6, hv*0.45)/(hv || 1);
  // how it goes: its own speed (the rider's weight leaving it), the shove, and the turn the blow puts into it
  const own = v.v || 0, bx0 = H ? H.vx*push : hx*hv*push, bz0 = H ? H.vz*push : hz*hv*push;
  const fx = v.hx, fz = v.hz, rx = -fz, rz = fx;                                  // forward, and its right (+roll falls that way)
  const ahead = (H ? H.vx : hx*hv)*fx + (H ? H.vz : hz*hv)*fz, acr = (H ? H.vx : hx*hv)*rx + (H ? H.vz : hz*hv)*rz;
  const along = Math.max(-1, Math.min(1, (hitX - v.x)*fx + (hitZ - v.z)*fz)), jit = () => 0.85 + Math.random()*0.3;
  const hard = Math.max(0, hv - 8);
  let roll = side*(0.6 + Math.min(2, hv*0.15) + Math.min(4.5, hard*0.35))*jit();      // over onto its side; rolled right over when it's hard
  let yawW = Math.max(-4.5, Math.min(4.5, -acr*along*0.9)) + (Math.random() - 0.5)*0.6;  // hit at one end: spun round
  let pitchW = 0;                                                               // stopped dead from the front: over the bars
  if (ahead < -3 && Math.abs(along) > 0.2 && along > 0) pitchW = Math.min(5, (-ahead - 3)*0.3 + Math.max(0, own)*0.12)*jit();
  const vy = Math.min(2.2, hard*0.18 + pitchW*0.15);
  const vel = [fx*own*0.6 + bx0, vy, fz*own*0.6 + bz0];
  const om = [fx*roll - rx*pitchW, yawW, fz*roll - rz*pitchW];
  _e.set((v.roll || 0) + side*0.08, -(v.ryaw ?? v.yaw), v.pitch + (v.slope || 0), 'YXZ');
  const Q0 = new THREE.Quaternion().setFromEuler(_e), ox = v.rx ?? v.x, oz = v.rz ?? v.z;
  v.x = ox; v.z = oz; v.offX = v.offZ = 0;
  v._tp = { side, B: makeBody(v.type, Q0, ox, v.y || 0, oz, vel, om), Q: Q0.clone(), ox, oy: v.y || 0, oz, th: 0, down: false, t: 0, rider: null, up: 0 };
  const bx = H ? H.vx : hx*hv, bz = H ? H.vz : hz*hv;
  v.v = 0;
  throwRider(G, v, side, own, bx, bz);
}
// the rider off: they keep the speed they were riding at when the machine stops under them (over the bars, if it was
// a front-on stop), and what hit them adds its own; from the seat, astride, a body of their own from there
// (people/ragdoll.js). How badly they're hurt is how hard it was, the same as anyone hit (people/runover.js)
function throwRider(G, v, side, own = 0, bx = 0, bz = 0) {
  const kit = G && G.W && G.W.kit, ppl = G && G.people; if (!kit || !ppl) return;
  const rng = { next: Math.random, chance: (q) => Math.random() < q, range: (a, b) => a + Math.random()*(b - a), pick: (a) => a[Math.floor(Math.random()*a.length)], int: (a, b) => a + Math.floor(Math.random()*(b - a + 1)) };
  const look = kit.randomLook(rng, { female: Math.random() < 0.15, helmet: v.type !== 'cycle' });
  if (v.colB) look.top = look.top.setRGB(v.colB[0], v.colB[1], v.colB[2]);
  const x = v.x - v.hx*0.15, z = v.z - v.hz*0.15;
  const p = ppl.spawnAt(look, x, z, ppl.pickPersona ? ppl.pickPersona(look.female, x, z) : 'dada');
  if (!p) return;
  const yaw = Math.atan2(v.hz, v.hx), hit = Math.hypot(bx, bz), kmh = Math.max(hit, Math.abs(own)*0.6)*3.6;
  // the blow goes into them about as much as into the machine (they're most of the weight on it), less at a glance
  const vx = v.hx*own*0.85 + bx*0.6 - v.hz*side*0.5, vz = v.hz*own*0.85 + bz*0.6 + v.hx*side*0.5, vy = 0.25 + Math.min(0.7, kmh*0.01);
  const surf = G.W && G.W.surf, gy = surf ? surf.height(x, z) : 0;
  p._throw = { x, z, yaw, y: gy + (/^bike/.test(v.type) ? 0.92 : v.type === 'cycle' ? 0.95 : 0.85), vx, vy, vz };
  const dead = kmh >= 75, ko = dead || kmh >= 40, crit = !dead && kmh >= 55;
  p.fallen = dead || ko ? 1e6 : 4 + kmh*0.15; p.ko = ko; p.corpse = dead; p.unconscious = ko && !dead; p.v = 0;
  p.inj = { sev: dead ? 'dead' : crit ? 'critical' : ko ? 'ko' : 'knock', t: 0 }; if (!ko) p.limp = 30 + kmh*2;
  p.yaw = yaw; p.hx = v.hx; p.hz = v.hz;
  v._tp.rider = p;
  v._tp.empty = true;              // drawn without its baked rider while it's down
}
function tick(TR, v, dt) {
  const S = v._tp; S.t += dt;
  v.offX = v.offZ = 0;
  if (!S.down) S.hold = true;                                   // (down till it's stopped, however long that takes)
  if (!S.down) {
    // falling, rolling, sliding: the body on its own (along its link and across it, so the lane position stays true
    // when it rides on)
    const B = S.B, W = TR.W;
    stepBody(B, dt, v.y || 0, W && W.collision ? (x, z) => W.collision.resolve(x, z, 0.45) : null);
    const dx = B.ox - v.x, dz = B.oz - v.z;
    if (v.l && !v.jc) {
      v.s += dx*v.hx + dz*v.hz;
      const e = v.l.e, lim = e.w/2 - 0.3;
      v.lat = Math.max(-lim, Math.min(lim, v.lat + dx*v.hz - dz*v.hx));
      if (v.l.e.len) v.s = Math.max(0.5, Math.min(v.l.e.len - 0.5, v.s));
    }
    v.x = B.ox; v.z = B.oz;
    S.Q.copy(B.Q); S.ox = B.ox; S.oy = B.oy; S.oz = B.oz;
    if (B.rest) {
      // lying as it ended up: how far over (the rider hauls it back from there) and which side its wheels are
      const L0 = lie(B); S.down = true; S.th = S.a0 = Math.max(0.05, L0.ang); S.ux = L0.ux; S.uz = L0.uz;
      S.Qrest = B.Q.clone(); S.oyRest = B.oy; S.B = null;
    }
  }
  // the rider back to it: up, over, and haul it upright; then on and away
  const p = S.rider, G = G0();
  if (p && S.rx !== undefined) {
    const q = Math.hypot(S.rx, S.rz);
    if (q > 0.05 && p.fallen > 0) { const k = Math.max(0, q - 6*dt)/q; S.rx *= k; S.rz *= k; p.x += S.rx*dt; p.z += S.rz*dt; } else S.rx = undefined;
  }
  const L = G && G.people && G.people.list;
  const there = p && L && L.includes(p);
  if (!S.lift && S.down && S.t > 2.4) {
    if (!there || p.ko || p.dead || p.corpse) { S.hold = true; return; }        // nobody's coming for it
    if (!(p.fallen > 0)) {
      // to the side its wheels are on (it went over the other way), where you get hold of the bars. (They walk there and
      // stop a metre short of where they're headed, as anyone walking up to something does: within 1.3 m of the bars
      // they've arrived. It asked for 0.9, which they never got to, so nobody ever picked a bike up)
      const gx = v.x - (S.ux ?? -v.hz*S.side)*0.7, gz = v.z - (S.uz ?? v.hx*S.side)*0.7, d = Math.hypot(gx - p.x, gz - p.z);
      if (d > 1.3 && !((S.walkT = (S.walkT || 0) + dt) > 12)) { p.mode = 'chase'; p.chase = { x: gx, z: gz }; p.runSp = 1.4; S.hold = true; return; }
      S.lift = true; S.liftT = 0; S.hold = true;
    } else { S.hold = true; return; }
  }
  if (S.lift) {
    S.liftT += dt;
    // hauled up by a person, worked out: they heave, its weight pulls it back down (hardest when it's lying, nothing
    // when it's upright: the way anything top-heavy is), and if they haven't the strength the first go gets it part way
    // and it sags back; they let go, get their breath, take a better hold and heave harder. A strong one does it in one
    // go, a big motorbike takes most people two or three; once it's most of the way up they just steady it upright.
    if (!S.lp) { const h = (((p && p.id) || 7)*2654435761 >>> 0)/4294967296; S.lp = { str: 0.82 + h*0.55, w: 0, tries: 0, rest: 0, bt: 0, push: 0 }; S.mass = /^bike/.test(v.type) ? 1.3 : v.type === 'cycle' ? 0.35 : 1; }
    const Lp = S.lp; let a = Math.abs(S.th);
    if (Lp.rest > 0) { Lp.rest -= dt; Lp.push = Math.max(0, Lp.push - dt*4); }
    else {
      Lp.bt += dt; Lp.push = Math.min(1, Lp.bt/0.4);
      if (Lp.bt > 1.5 && a > 0.3) { Lp.bt = 0; Lp.rest = 0.5 + Math.random()*0.5; Lp.tries++; Lp.str *= 1.14; if (p) window.__nhNudge?.(p, -p.hx*0.8, -p.hz*0.8); }
    }
    const grav = 9.8/0.62*Math.sin(Math.min(a, 1.5708))*S.mass, musc = a > 0.3 ? Lp.push*Lp.str*15.8 : 0;
    Lp.w += (musc - grav - Lp.w*2.5)*dt;
    if (a < 0.3) Lp.w = Math.max(Lp.w*0.9, a*2.5);                     // (steadying it the last of the way)
    a = Math.max(0, Math.min(S.a0, a - Lp.w*dt)); if (a >= S.a0) Lp.w = Math.max(0, Lp.w);
    S.th = a;
    // from however it was lying to stood on its tyres, the way the lane goes
    const u = 1 - a/S.a0;
    _e.set(0, -(v.ryaw ?? v.yaw), v.pitch + (v.slope || 0), 'YXZ'); _up.setFromEuler(_e);
    S.Q.copy(S.Qrest).slerp(_up, u); S.ox = v.x; S.oz = v.z; S.oy = S.oyRest + ((v.y || 0) - S.oyRest)*u;
    const k = a < 0.03 || S.liftT > 14 ? 1 : 0;
    if (p && L && L.includes(p)) { p.chase = null; p.mode = 'stand'; p.v = 0; p.anim = a > 0.45 && Lp.push > 0.2 ? 'pickup' : 'idle'; p.yaw = Math.atan2(v.z - p.z, v.x - p.x); p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw); }      // (bent to it, hauling; or stood, getting their breath)
    if (k >= 1) {
      // on it and off: the rider's back on the machine (the baked one), the person who walked to it gone
      if (p && L && L.includes(p)) G.people.remove(p);
      v._tp = null; v.fallen = 0; v.roll = 0; v.angry = 8;
      return;
    }
  }
}

