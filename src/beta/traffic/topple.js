// A two-wheeler knocked over falls like one. It used to be laid on its side in a single frame (lifted 30 cm off the
// road so it didn't sink), its rider still sat on it, and stood up again just as suddenly 3.5 s later.
// Now it goes over about its tyres, slowly at first and faster as it goes (the way anything top-heavy falls),
// away from whatever hit it, hits the road and rocks a little; it's shoved along the way it was hit and slides on its
// side, grinding to a stop. The rider comes off and goes down on the road beside it (people/falls.js throws them
// along). Then they get up, walk back to it, haul it upright and ride on; one who's out cold or has walked off
// leaves it lying there.
import { Traffic } from '@orig/traffic/traffic.js';

const G0 = () => window.__nhAskG;
const LIE = 1.36;            // lying on its side, on the bar end and the peg
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
  else TR.near(v.x, v.z, 6, (o) => { if (o === v || !(Math.abs(o.v || 0) > hv)) return; hx = o.hx ?? 1; hz = o.hz ?? 0; hv = Math.abs(o.v); hitX = o.x; hitZ = o.z; });
  // it falls away from the hit: the side of it the hit came from (+roll tips it to its right, (-hz, hx))
  const rel = (hitX - v.x)*(-v.hz) + (hitZ - v.z)*v.hx; let side = rel > 0 ? -1 : 1;
  const H = v._hit; v._hit = null;                     // (the blow itself, when you know it: beta/vehicles/crash.js)
  const across = H ? H.vx*(-v.hz) + H.vz*v.hx : 0;
  if (H) { side = Math.abs(across) > 0.4 ? Math.sign(across) : (Math.random() < 0.5 ? -1 : 1); hv = Math.hypot(H.vx, H.vz); }
  const push = H ? Math.min(1, 9/(hv || 1)) : Math.min(6, hv*0.45)/(hv || 1);
  v._tp = {
    side, th: (v.roll || 0) + side*0.08, w: side*(0.6 + Math.min(2, hv*0.15)),
    vx: v.hx*(v.v || 0)*0.6 + (H ? H.vx*push : hx*hv*push), vz: v.hz*(v.v || 0)*0.6 + (H ? H.vz*push : hz*hv*push),
    down: false, t: 0, rider: null, up: 0,
  };
  v.v = 0;
  throwRider(G, v, side);
}
// the rider off and onto the road on the side it's going over
function throwRider(G, v, side) {
  const kit = G && G.W && G.W.kit, ppl = G && G.people; if (!kit || !ppl) return;
  const rng = { next: Math.random, chance: (q) => Math.random() < q, range: (a, b) => a + Math.random()*(b - a), pick: (a) => a[Math.floor(Math.random()*a.length)], int: (a, b) => a + Math.floor(Math.random()*(b - a + 1)) };
  const look = kit.randomLook(rng, { female: Math.random() < 0.15, helmet: v.type !== 'cycle' });
  if (v.colB) look.top = look.top.setRGB(v.colB[0], v.colB[1], v.colB[2]);
  const rx = -v.hz*side, rz = v.hx*side, x = v.x + rx*0.7, z = v.z + rz*0.7;
  const p = ppl.spawnAt(look, x, z, ppl.pickPersona ? ppl.pickPersona(look.female, x, z) : 'dada');
  if (!p) return;
  p.fallen = 2.2; p.yaw = Math.atan2(v.hz, v.hx); p.hx = v.hx; p.hz = v.hz;
  v._tp.rider = p; v._tp.rx = v._tp.vx*0.85; v._tp.rz = v._tp.vz*0.85;     // (they go along the road with it, a bit short of it)
  v._tp.empty = true;              // drawn without its baked rider while it's down
}
function tick(TR, v, dt) {
  const S = v._tp; S.t += dt;
  if (!S.down) {
    // an inverted pendulum about the contact line: th'' = g/h sin th
    S.w += 9.8/0.62*Math.sin(S.th)*dt;
    S.th += S.w*dt;
    if (Math.abs(S.th) >= LIE) { S.th = Math.sign(S.th)*LIE; S.w = -S.w*0.22; S.down = true; S.bounce = Math.abs(S.w); }
  } else if (!S.lift) {
    // a rock on the bar end, settling: its weight takes it on over onto that side (it had the sign the wrong way: the
    // weight swung it back up through upright and over onto the other side, and back, rocking for ever)
    S.w += Math.sign(S.th)*12*dt; S.th += S.w*dt;
    if (Math.abs(S.th) > LIE) { S.th = Math.sign(S.th)*LIE; S.w = 0; }
  }
  // sliding: on its tyres while it's still going over, on its side once it's down (steel and plastic on tar)
  const mu = S.down ? 5.5 : 1.2, sp = Math.hypot(S.vx, S.vz);
  if (sp > 0.01) {
    const k = Math.max(0, sp - mu*dt)/sp; S.vx *= k; S.vz *= k;
    const dx = S.vx*dt, dz = S.vz*dt;
    // along its link and across it, so the lane position stays true when it rides on
    if (v.l && !v.jc) {
      v.s += dx*v.hx + dz*v.hz;
      const e = v.l.e, lim = e.w/2 - 0.3;
      v.lat = Math.max(-lim, Math.min(lim, v.lat + dx*v.hz - dz*v.hx));
      if (v.l.e.len) v.s = Math.max(0.5, Math.min(v.l.e.len - 0.5, v.s));
    }
    v.x += dx; v.z += dz;
    const W = TR.W, r = W && W.collision && W.collision.resolve(v.x, v.z, 0.45);
    if (r) { v.x += r.nx*r.depth; v.z += r.nz*r.depth; S.vx *= 0.3; S.vz *= 0.3; }
  }
  // the rider back to it: up, over, and haul it upright; then on and away
  const p = S.rider, G = G0();
  if (p && S.rx !== undefined) {
    const q = Math.hypot(S.rx, S.rz);
    if (q > 0.05 && p.fallen > 0) { const k = Math.max(0, q - 6*dt)/q; S.rx *= k; S.rz *= k; p.x += S.rx*dt; p.z += S.rz*dt; } else S.rx = undefined;
  }
  const L = G && G.people && G.people.list;
  const there = p && L && L.includes(p);
  if (!S.lift && S.t > 2.4) {
    if (!there || p.ko || p.dead || p.corpse) { S.hold = true; return; }        // nobody's coming for it
    if (!(p.fallen > 0)) {
      // to the side its wheels are on (it went over the other way), where you get hold of the bars. (They walk there and
      // stop a metre short of where they're headed, as anyone walking up to something does: within 1.3 m of the bars
      // they've arrived. It asked for 0.9, which they never got to, so nobody ever picked a bike up)
      const gx = v.x + v.hz*S.side*0.7, gz = v.z - v.hx*S.side*0.7, d = Math.hypot(gx - p.x, gz - p.z);
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
    const grav = 9.8/0.62*Math.sin(a)*S.mass, musc = a > 0.3 ? Lp.push*Lp.str*15.8 : 0;
    Lp.w += (musc - grav - Lp.w*2.5)*dt;
    if (a < 0.3) Lp.w = Math.max(Lp.w*0.9, a*2.5);                     // (steadying it the last of the way)
    a = Math.max(0, Math.min(LIE, a - Lp.w*dt)); if (a >= LIE) Lp.w = Math.max(0, Lp.w);
    S.th = Math.sign(S.th || 1)*a;
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

