// The body's own weight, on top of every clip. A clip is the same every time; a body isn't. So on everyone close by
// (and on you) the clip's pose is only where the muscles are aiming, and the body under it has mass:
//  - arms are pendulums: start, stop or turn and they swing behind and settle; the head nods with a sudden stop
//  - the trunk is held up by a spring: it leans into a turn, forward as they set off, back as they pull up, and a
//    bump (someone walking into them, a car coming past too close) tips them and they catch themselves
//  - uphill they lean into it, downhill they sit back
//  - everyone breathes (faster, deeper after running), and standing about they shift their weight from foot to foot
//  - everyone walks their own way: the old stoop, some swing their arms and some hardly do, some sway at the hips,
//    some bounce; someone hurt favours the bad leg
// Nothing here is played: it's all worked out each frame from how they're really moving.
import * as THREE from 'three';
import { Crowd } from '@orig/people/crowd.js';
import { Pilot } from '@orig/game/pilot.js';

const V3 = THREE.Vector3, _ax = new V3(), _v = new V3(), _s = new V3(), _pq = new THREE.Quaternion(), _r = new THREE.Quaternion();
const UP = new V3(0, 1, 0);
const OLD = { aaji: 1, ajoba: 1, kaka: 0.4, kaku: 0.4, aunty: 0.3 };
const bone = (H, n) => (H._mb || (H._mb = {}))[n] !== undefined ? H._mb[n] : (H._mb[n] = H.root.getObjectByName(n) || null);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// a turn about a world axis, on top of the bone's pose
function turn(b, ax, az, ay, ang) {
  if (!b || !b.parent || !ang) return;
  b.parent.matrixWorld.decompose(_v, _pq, _s);
  _ax.set(ax, ay, az).normalize().applyQuaternion(_pq.invert());
  b.quaternion.premultiply(_r.setFromAxisAngle(_ax, ang));
}
// a spring with a little give: x'' = -k x - c x' + f
const spring = (s, f, k, c, dt) => { s.v += (f - k*s.x - c*s.v)*dt; s.x += s.v*dt; if (!(Math.abs(s.x) < 2)) { s.x = 0; s.v = 0; } };
const S0 = () => ({ x: 0, v: 0 });

// who they are, in how they move (the same person always the same)
function traitsOf(p) {
  const h = ((p.id || 0)*2654435761 >>> 0)/4294967296, h2 = ((p.id || 0)*40503 + 17 >>> 0)%1000/1000, h3 = ((p.id || 0)*9973 + 5 >>> 0)%1000/1000;
  const old = OLD[p.persona] || 0, fem = !!(p.look && p.look.female);
  return { stoop: old*(0.16 + h*0.1) + (h2 - 0.5)*0.05, swing: clamp(0.55 + h*0.55 - old*0.2, 0.35, 1.15), sway: (fem ? 0.05 + h2*0.05 : h2*0.02), bounce: h3*0.035, breathe: 0.22 + h3*0.08, side: h2 < 0.5 ? 1 : -1 };
}
// the arms hanging still: the idle clip's first pose (what a swing is measured from)
function hangOf(H) {
  if (H._hang !== undefined) return H._hang;
  H._hang = null;
  const a = H.actions && H.actions.idle, clip = a && a.getClip && a.getClip(); if (!clip) return null;
  const o = {}; for (const tr of clip.tracks) { const m = /^(upperarm_[lr]|lowerarm_[lr])\.quaternion$/.exec(tr.name); if (m) o[m[1]] = new THREE.Quaternion().fromArray(tr.values, 0); }
  return (H._hang = o);
}

// the state of one body's weight
function stateOf(o) { return o._mo || (o._mo = { x: undefined, z: undefined, vx: 0, vz: 0, ax: 0, az: 0, yaw: 0, tf: S0(), ts: S0(), af: S0(), as: S0(), hd: S0(), ex: 0, t: Math.random()*10, slope: 0, sk: 0, bend: 0 }); }

// x, z where they are; yaw the way they face; moving: on their feet and going about normally; walkPh: the walk clip's phase
function weigh(o, H, dt, x, z, yaw, opt) {
  if (!(dt > 0) || !H || !H.root) return;
  const M = stateOf(o), T = o._mt || (o._mt = opt.you ? { stoop: 0, swing: 1, sway: 0.02, bounce: 0.012, breathe: 0.24, side: 1 } : traitsOf(o));
  if (M.x === undefined || Math.hypot(x - M.x, z - M.z) > 3) { M.x = x; M.z = z; M.vx = M.vz = 0; M.ax = M.az = 0; }
  const nvx = (x - M.x)/dt, nvz = (z - M.z)/dt; M.x = x; M.z = z;
  const k = Math.min(1, dt*10), ovx = M.vx, ovz = M.vz;
  M.vx += (nvx - M.vx)*k; M.vz += (nvz - M.vz)*k;
  M.ax += (clamp((M.vx - ovx)/dt, -9, 9) - M.ax)*Math.min(1, dt*8); M.az += (clamp((M.vz - ovz)/dt, -9, 9) - M.az)*Math.min(1, dt*8);
  const fx = Math.cos(yaw), fz = Math.sin(yaw), sx = -fz, sz = fx, sp = Math.hypot(M.vx, M.vz);
  const aF = M.ax*fx + M.az*fz, aS = M.ax*sx + M.az*sz;
  M.t += dt;
  // tiring and getting your breath back
  M.ex = clamp(M.ex + (sp > 4.2 ? dt/9 : sp > 2.2 ? dt/30 : -dt/(sp < 0.3 ? 14 : 30)), 0, 1);
  // the trunk on its spring: pushed by how they speed up, slow down and turn (and any bump), held up by the legs
  spring(M.tf, aF*0.022 + (M.kf || 0), 70, 9, dt); spring(M.ts, aS*0.02 + (M.ks || 0), 70, 9, dt); M.kf = M.ks = 0;
  // the arms and the head: pendulums, swinging behind what the body does
  spring(M.af, -aF*0.06, 38, 5, dt); spring(M.as, -aS*0.05, 38, 5, dt); spring(M.hd, -aF*0.018, 90, 10, dt);
  // the ground ahead: up or down (every few frames)
  if ((M.sk = (M.sk + 1) % 6) === 0 && opt.surf && sp > 0.5) { const h0 = opt.surf.height(x, z), h1 = opt.surf.height(x + M.vx/sp*0.8, z + M.vz/sp*0.8); M.slope += (clamp((h1 - h0)/0.8, -0.5, 0.5) - M.slope)*0.5; }
  else if (sp <= 0.5) M.slope *= 0.95;
  H.holder.updateMatrixWorld(true);
  const pAx = fz, pAz = -fx, rAx = sz, rAz = -sx;            // (turning about these leans forward, to the side)
  const s1 = bone(H, 'spine_01'), s2 = bone(H, 'spine_02'), s3 = bone(H, 'spine_03'), nk = bone(H, 'neck_01'), hd = bone(H, 'Head');
  const moving = opt.moving, ph = opt.walkPh;
  // posture: the stoop of age (the head comes up again to see ahead), and leaning into a slope
  const stoop = T.stoop + (moving ? M.slope*0.35 : 0);
  turn(s2, pAx, pAz, 0, stoop*0.6); turn(s3, pAx, pAz, 0, stoop*0.4); turn(nk, pAx, pAz, 0, -stoop*0.7);
  // the trunk's spring
  turn(s1, pAx, pAz, 0, clamp(M.tf.x, -0.35, 0.45)); turn(s1, rAx, rAz, 0, clamp(M.ts.x, -0.35, 0.35));
  // breathing: the chest rises and the shoulders with it, faster and deeper the more out of breath
  const br = Math.sin(M.t*Math.PI*2*(T.breathe + M.ex*0.55))*(0.012 + M.ex*0.035);
  turn(s3, pAx, pAz, 0, -br);
  if (moving && ph !== undefined) {
    const w = Math.sin(ph*Math.PI*2);
    // the hips' sway shows in the shoulders going the other way; a bounce in the step; a bad leg favoured
    turn(s3, 0, 0, 1, -w*T.sway*Math.min(1, sp));
    turn(s2, pAx, pAz, 0, Math.abs(w)*T.bounce);
    if (o.limp > 0) { const st = Math.max(0, w*T.side); turn(s1, rAx, rAz, 0, st*0.14); turn(s1, pAx, pAz, 0, st*0.06); }
  } else if (!moving || sp < 0.2) {
    // standing: the weight goes from one foot to the other now and then, the body over it
    const sh = Math.sin(M.t*0.9 + (o.id || 0))*0.5 + Math.sin(M.t*0.37 + (o.id || 0)*2)*0.5;
    turn(s1, rAx, rAz, 0, sh*0.035); turn(nk, rAx, rAz, 0, -sh*0.02);
  }
  // the arms: how much this person swings them, and the pendulum on top
  const hang = opt.swing !== false && hangOf(H);
  if (hang && moving) for (const n of ['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r']) { const b = bone(H, n), q = hang[n]; if (b && q) { _r.copy(b.quaternion); b.quaternion.copy(q).slerp(_r, T.swing); } }
  for (const n of ['upperarm_l', 'upperarm_r']) { const b = bone(H, n); turn(b, pAx, pAz, 0, -clamp(M.af.x, -0.6, 0.6)); turn(b, rAx, rAz, 0, clamp(M.as.x, -0.5, 0.5)*(n.endsWith('l') ? 1 : 1)); }
  turn(hd, pAx, pAz, 0, clamp(M.hd.x, -0.25, 0.25));
  // you, out of breath after a long run, stopped: bent over, hands down near the knees, head up
  if (opt.you) {
    const want = 0;                                  // (Onkar: it read as old, not winded. Off)
    M.bend += (want - M.bend)*Math.min(1, dt*(want ? 2.5 : 1.8));
    if (M.ex < 0.35) M.bend *= 0.9;
    if (M.bend > 0.01) {
      const b = M.bend;
      turn(s1, pAx, pAz, 0, b*0.45); turn(s2, pAx, pAz, 0, b*0.3); turn(nk, pAx, pAz, 0, -b*0.45); turn(hd, pAx, pAz, 0, -b*0.25);
      for (const n of ['upperarm_l', 'upperarm_r']) turn(bone(H, n), pAx, pAz, 0, b*0.5);
    }
  }
}

// a push on someone standing or walking: they tip with it and catch themselves (ix, iz: the push, m/s)
window.__nhNudge = (o, ix, iz) => { const M = stateOf(o), y = o.yaw || 0, fx = Math.cos(y), fz = Math.sin(y); M.tf.v += (ix*fx + iz*fz)*1.4; M.ts.v += (ix*-fz + iz*fx)*1.4; };

// ---- everyone on the street with a body
const post = Crowd.prototype.postPed;
Crowd.prototype.postPed = function (p, H, dt) {
  if (!(p.rideOf || p._rag || p.fallen > 0 || p.ko || p._drag || p._wake || p.seated || p.sit)) {
    const busy = p.act && !/^(react|hurt)$/.test(p.act.kind);
    const wa = H.actions && (H.actions.walk || H.actions.jog), cur = H.cur && H.cur.name ? H.cur.name : H.cur;
    const loco = !busy && !p.anim && (cur === 'walk' || cur === 'jog' || cur === undefined || cur === null || /walk|jog/.test(String(cur)));
    const ph = wa && wa.getClip ? (wa.time/(wa.getClip().duration || 1)) : undefined;
    weigh(p, H, dt, p.x, p.z, p.yaw || 0, { moving: loco && (p.body ? (p.body.vel || 0) > 0.3 : (p.v || 0) > 0.3), walkPh: ph, surf: this.W && this.W.surf, swing: !busy && !p.hands && !p.lathi });
  }
  return post && post.call(this, p, H, dt);
};

// ---- you
const foot = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const out = foot.call(this, dt, ...a), F = this.foot, H = this.human;
  if (!F || !H || this.act || this.downT > 0 || this.seated || F.climb || F.swim || !this.onFoot) return out;
  const G = window.__nhAskG;
  if (G && G.brawl && (G.brawl.active > 0 || G.brawl.guarding)) return out;
  const wa = H.actions && (F.v > 4.6 ? H.actions.sprint : F.v > 2.2 ? H.actions.jog : H.actions.walk);
  weigh(this, H, dt, F.x, F.z, F.yaw, { moving: F.v > 0.25 && !F.air, walkPh: wa && wa.getClip ? wa.time/(wa.getClip().duration || 1) : undefined, surf: this.W && this.W.surf, you: true, swing: false });
  return out;
};
