// Off your own two-wheeler. Ride into something hard enough, or have something hit you, and you don't stay sat on it:
// the machine stops (or is knocked away) under you and you go on with the speed you had, off the seat as a body of
// your own (people/ragdoll.js), astride for the first instant, over the bars if you went in front-on, rolling and
// sliding down the road till you stop, and you get up only once you've stopped. The scooter or the bike goes over on
// its side away from you, slides on its side grinding to a halt, and lies there till you go back and get on it again.
import { Pilot } from '@orig/game/pilot.js';
import { startRag, seatRag } from '../people/ragdoll.js';

const LIE = 1.36, G0 = 9.8;
const velOf = (v) => { const c = Math.cos(v.th), s = Math.sin(v.th); return [(v.v || 0)*c - (v.vl || 0)*s, (v.v || 0)*s + (v.vl || 0)*c]; };

const upd = Pilot.prototype.update;
Pilot.prototype.update = function (dt, inp, traffic, ...rest) {
  const V0 = !this.onFoot ? this.cur : null, two = V0 && V0 !== this.auto && V0.spec && V0.spec.two;
  const before = two ? velOf(V0) : null, th0 = two ? V0.th : 0;
  const out = upd.call(this, dt, inp, traffic, ...rest);
  if (two && dt > 0 && this.cur === V0 && !this.onFoot && !this._out && !this._cx && !this.act && !this.frozen) {
    const after = velOf(V0), sp0 = Math.hypot(before[0], before[1]), dv = Math.hypot(after[0] - before[0], after[1] - before[1]);
    // (a jump of heading with no blow is a teleport, a reset: not a crash)
    const turned = Math.abs(Math.atan2(Math.sin(V0.th - th0), Math.cos(V0.th - th0))) > 1.2 && dv > sp0*1.5;
    if (sp0 > 3 && dv > 5.2 && !turned) { try { thrown(this, V0, before, after, dv, traffic); } catch (e) { console.warn('throwoff', e); } }
  }
  // the machine you came off, going over and sliding
  const D = this._down2;
  if (D && dt > 0) tip(this, D, dt);
  return out;
};

function thrown(P, V, before, after, dv, traffic) {
  const H = P.human, hx = Math.cos(V.th), hz = Math.sin(V.th);
  const x = V.x - hx*0.15, z = V.z - hz*0.15, gy = P.W.surf ? P.W.surf.height(x, z) : 0, seat = (V.y || 0) + (/^bike/.test(V.type) ? 0.92 : 0.85);
  // which way it goes over: away from the blow's sideways part, else whichever way it was leaning
  const lat = (after[0] - before[0])*-hz + (after[1] - before[1])*hx, side = Math.abs(lat) > 0.6 ? Math.sign(lat) : Math.sign(V.lean || 0.001);
  P.exit(traffic, true);
  if (!P.onFoot) return;
  P._unpop = null;
  const F = P.foot; F.x = x; F.z = z; F.y = gy; F.yaw = V.th; F.vx = F.vz = 0; F.v = 0;
  P.downT = 3 + Math.min(6, dv*0.3);
  P.events.push({ type: 'gotHit', speed: dv*0.8, who: 'fall', x, z });
  // you go on as you were going (the machine's stopped or been knocked away under you), a little up off the seat
  const R = H && startRag(P, { H, yaw: V.th });
  if (R) { seatRag(R, x, z, V.th, gy + seat, before[0]*0.95 + (after[0] - before[0])*0.25, 0.8 + Math.min(1.6, dv*0.08), before[1]*0.95 + (after[1] - before[1])*0.25); P._fall = null; }
  // the machine: over on its side, carrying on with what it had after the blow
  V.v = 0; V.vl = 0;
  P._down2 = { V, side: -side || 1, th: (V.lean || 0) + (-side || 1)*0.1, w: (-side || 1)*(0.8 + Math.min(2, dv*0.12)), vx: after[0], vz: after[1], down: false };
}

function tip(P, D, dt) {
  const V = D.V;
  if (!P.onFoot && P.cur === V) { P._down2 = null; return; }                       // (back on it: it's stood up as you ride)
  if (!P.dropped.some(d => d.veh === V)) { P._down2 = null; return; }
  if (!D.down) {
    D.w += G0/0.62*Math.sin(D.th)*dt; D.th += D.w*dt;
    if (Math.abs(D.th) >= LIE) { D.th = Math.sign(D.th)*LIE; D.w = 0; D.down = true; P.audio?.thud?.(0.5); }
  }
  // on its tyres while it goes over, on its side once it's down (steel and plastic on tar)
  const mu = D.down ? 5.5 : 1.2, sp = Math.hypot(D.vx, D.vz);
  if (sp > 0.01) {
    const k = Math.max(0, sp - mu*dt)/sp; D.vx *= k; D.vz *= k;
    V.x += D.vx*dt; V.z += D.vz*dt;
    const r = P.W.collision && P.W.collision.resolve(V.x, V.z, 0.45);
    if (r && r.depth > 0) { V.x += r.nx*r.depth; V.z += r.nz*r.depth; D.vx *= 0.3; D.vz *= 0.3; }
    const d = P.dropped.find(q => q.veh === V); if (d && d.st) { d.st.x = V.x; d.st.z = V.z; }
  }
  V.lean = D.th;
  V.sync && V.sync(0);
}
