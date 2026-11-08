// Falling like a body does, worked out, not played. Whoever goes down (hit by what you drive, punched, shot, shoved)
// becomes eighteen points with weight, the hips, chest, head, every shoulder, elbow, wrist, hip, knee, ankle and toe,
// held to each other by their bones: knees and elbows bend only the way they bend and never fold shut, the spine
// gives a little, the head is heavy on the neck. Gravity has them, the road scrapes them to a stop, walls stop them,
// and what hit them is solid: the front of the car takes the legs, the bonnet and glass carry the body up and over as
// they rise under it, a flat-fronted bus throws them on ahead. Every bone of the body (and the fingers, going limp)
// follows those points. So no fall is a clip: the same hit on the same step goes the same way every time (fixed steps,
// no dice), but a step later, an arm swinging the other way, a kerb under one foot, and it's another fall.
// When they get up, the body goes from where it lies into the getting-up (over onto their back first if they're face down).
import * as THREE from 'three';
import { People } from '@orig/people/peds.js';
import { Crowd } from '@orig/people/crowd.js';

const DT = 1/120, ITER = 4, G0 = 9.81, OUT = 0.6, MU = 0.35;
// the points, and the bone each one is (3 is the top of the head: no bone starts there)
const NAMES = ['pelvis', 'spine_03', 'Head', null, 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r'];
const N = NAMES.length;
const MASS = [4, 4, 2, 0.5, 1.5, 1, 0.5, 1.5, 1, 0.5, 3, 2, 1, 0.3, 3, 2, 1, 0.3];
const RAD = [0.1, 0.12, 0.1, 0.08, 0.06, 0.045, 0.04, 0.06, 0.045, 0.04, 0.08, 0.06, 0.05, 0.03, 0.08, 0.06, 0.05, 0.03];
// [a, b, how stiff]: the hips and the chest are each one piece, the spine between them gives, the neck less
const LINKS = [[0, 1, 1], [0, 10, 1], [0, 14, 1], [10, 14, 1], [1, 4, 1], [1, 7, 1], [4, 7, 1], [1, 10, 0.3], [1, 14, 0.3], [4, 10, 0.1], [7, 14, 0.1], [4, 14, 0.1], [7, 10, 0.1],
  [1, 2, 1], [2, 3, 1], [1, 3, 0.6], [4, 2, 0.35], [7, 2, 0.35],
  [4, 5, 1], [5, 6, 1], [7, 8, 1], [8, 9, 1],
  [10, 11, 1], [11, 12, 1], [12, 13, 1], [11, 13, 1], [14, 15, 1], [15, 16, 1], [16, 17, 1], [15, 17, 1]];
// [a, b, nearest they come]: an elbow, a knee don't close all the way, the chin doesn't go through the chest, legs
// and arms don't pass through each other or the body
const APART = [[4, 6, 0.17], [7, 9, 0.17], [10, 12, 0.36], [14, 16, 0.36], [3, 0, 0.5], [11, 15, 0.13], [12, 16, 0.12], [5, 0, 0.14], [8, 0, 0.14], [6, 1, 0.08], [9, 1, 0.08], [2, 10, 0.3], [2, 14, 0.3]];

const V3 = THREE.Vector3, _a = new V3(), _b = new V3(), _c = new V3(), _X = new V3(), _Y = new V3(), _Z = new V3(), _f = new V3(), _l = new V3();
const _M = new THREE.Matrix4(), _Mi = new THREE.Matrix4(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _s = new V3();
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t*t*(3 - 2*t); };
const pt = (R, i, o) => o.set(R.p[i*3], R.p[i*3 + 1], R.p[i*3 + 2]);

// a frame from a direction and a way round: y along the bone, x as near the reference as it can be (no twist added)
function frame(out, y, xRef) {
  _Y.copy(y); if (_Y.lengthSq() < 1e-10) _Y.set(0, 1, 0); _Y.normalize();
  _X.copy(xRef).addScaledVector(_Y, -xRef.dot(_Y));
  if (_X.lengthSq() < 1e-8) { _X.set(1, 0, 0).addScaledVector(_Y, -_Y.x); if (_X.lengthSq() < 1e-8) _X.set(0, 0, 1).addScaledVector(_Y, -_Y.z); }
  _X.normalize(); _Z.crossVectors(_X, _Y);
  _M.makeBasis(_X, _Y, _Z); return out.setFromRotationMatrix(_M);
}
const xOf = (q, o) => o.set(1, 0, 0).applyQuaternion(q);

// every frame the bones are posed from: [bone, how it's found]
const FR = {};
const fp = new THREE.Quaternion(), fc = new THREE.Quaternion(), fh = new THREE.Quaternion(), fx = new V3(), fy = new V3(), t1 = new V3(), t2 = new V3();
function frames(R, out) {
  const P = (i, o) => pt(R, i, o);
  // hips: up the spine, across from the right hip to the left; the chest: up to the neck, across the shoulders
  frame(fp, P(1, t1).sub(P(0, t2)), P(10, fx).sub(P(14, fy)));
  const xp = xOf(fp, new V3());
  frame(fc, P(2, t1).sub(P(1, t2)), P(4, fx).sub(P(7, fy)));
  const xc = xOf(fc, new V3());
  frame(fh, P(3, t1).sub(P(2, t2)), xc);
  out.pelvis = fp.clone(); out.spine_03 = fc.clone(); out.Head = fh.clone();
  out.spine_01 = fp.clone().slerp(fc, 1/3); out.spine_02 = fp.clone().slerp(fc, 2/3); out.neck_01 = fc.clone().slerp(fh, 0.5);
  const limb = (a, b, ref, name) => { const q = frame(new THREE.Quaternion(), P(b, t1).sub(P(a, t2)), ref); out[name] = q; return xOf(q, new V3()); };
  for (const [s, o] of [['l', 0], ['r', 3]]) {
    const xu = limb(4 + o, 5 + o, xc, 'upperarm_' + s); limb(5 + o, 6 + o, xu, 'lowerarm_' + s);
    const lo = s === 'l' ? 0 : 4, xt = limb(10 + lo, 11 + lo, xp, 'thigh_' + s), xk = limb(11 + lo, 12 + lo, xt, 'calf_' + s); limb(12 + lo, 13 + lo, xk, 'foot_' + s);
  }
  return out;
}
const ORDER = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
const FINGERS = ['index', 'middle', 'ring', 'pinky', 'thumb'];

const bone = (H, n) => (H._rb || (H._rb = {}))[n] !== undefined ? H._rb[n] : (H._rb[n] = H.root.getObjectByName(n) || null);
// a hand gone limp: the fingers fall half closed, each its own amount (from the fist in the punch clip's first pose)
function fistOf(H) {
  if (H._fist !== undefined) return H._fist;
  H._fist = null;
  const a = H.actions && (H.actions.punch || H.actions.block), clip = a && a.getClip && a.getClip();
  if (!clip) return null;
  const F = {};
  for (const tr of clip.tracks) { const m = /^(.*)\.quaternion$/.exec(tr.name); if (m && /^(index|middle|ring|pinky|thumb)_0[1-3]_[lr]$/.test(m[1])) F[m[1]] = new THREE.Quaternion().fromArray(tr.values, 0); }
  return (H._fist = F);
}

export function ragOn(p) { return !!(p && p._rag); }
// start: the points where the body's bones are this moment, moving as the body was
export function startRag(p, o = {}) {
  const H = (o.H && o.H.root ? o.H : null) || (p.body && p.body.H); if (!H || !H.root) return null;
  H.holder.updateMatrixWorld(true);
  const R = { p: new Float64Array(N*3), q: new Float64Array(N*3), t: 0, acc: 0, still: 0, sleep: false, off: {}, car: null, gy: new Float64Array(N), out: -1, kmh: o.kmh || 0 };
  const hb = bone(H, 'Head');
  for (let i = 0; i < N; i++) {
    const n = NAMES[i], b = n ? bone(H, n) : null;
    if (b) _a.setFromMatrixPosition(b.matrixWorld);
    else if (hb) { hb.matrixWorld.decompose(_b, _q, _s); _a.setFromMatrixPosition(hb.matrixWorld).add(_c.set(0, 0.19, 0).applyQuaternion(_q)); }
    else return null;
    R.p[i*3] = _a.x; R.p[i*3 + 1] = _a.y; R.p[i*3 + 2] = _a.z;
  }
  R.len = LINKS.map(([a, b]) => Math.hypot(R.p[a*3] - R.p[b*3], R.p[a*3 + 1] - R.p[b*3 + 1], R.p[a*3 + 2] - R.p[b*3 + 2]));
  // how each bone sits in its frame, so the body keeps its own shape as the points move
  const F = frames(R, {});
  for (const n of ORDER) { const b = bone(H, n); if (!b) continue; b.matrixWorld.decompose(_b, _q, _s); R.off[n] = F[n].clone().invert().multiply(_q); }
  // moving as they were: their walk, and whatever push there is (more of it the higher up: a shove at the chest tips them)
  const vx = o.vx || 0, vz = o.vz || 0, push = o.push, base = H.holder.position.y;
  for (let i = 0; i < N; i++) {
    let ux = vx, uy = o.vy || 0, uz = vz;
    if (push) { const h = Math.max(0, Math.min(1.7, R.p[i*3 + 1] - base))/1.4; ux += push[0]*(0.25 + h); uz += push[1]*(0.25 + h); uy += (push[2] || 0)*h; }
    R.q[i*3] = R.p[i*3] - ux*DT; R.q[i*3 + 1] = R.p[i*3 + 1] - uy*DT; R.q[i*3 + 2] = R.p[i*3 + 2] - uz*DT;
  }
  // limp: the knees give a touch forward, so nobody stands there stiff as a post until something knocks them
  const fwd = _f.set(Math.cos(o.yaw ?? p.yaw ?? 0), 0, Math.sin(o.yaw ?? p.yaw ?? 0));
  for (const k of [11, 15]) { R.p[k*3] += fwd.x*0.03; R.p[k*3 + 2] += fwd.z*0.03; }
  if (o.V) { const V = o.V; R.car = { V, S: o.S, H: o.carH || 1.4, tall: !!o.tall, top: o.top, x: V.x, z: V.z, th: V.th }; }
  p._rag = R; p._slide = null;
  return R;
}
// sat astride something (a rider coming off): the hips at the seat, thighs forward, shins down to the pegs, leaning
// into the bars, and every point moving at (vx, vy, vz)
export function seatRag(R, x, z, yaw, y, vx, vy, vz) {
  const P = R.p, f = [Math.cos(yaw), Math.sin(yaw)], px = P[0], py = P[1], pz = P[2];
  // (the body as it stood may not face the machine's way yet: turned to it first, about the hips)
  const bx = (P[39] + P[51] - P[36] - P[48])/2, bz = (P[41] + P[53] - P[38] - P[50])/2, d = Math.hypot(bx, bz) > 1e-4 ? yaw - Math.atan2(bz, bx) : 0, cd = Math.cos(d), sd = Math.sin(d);
  const at = (i) => { const x0 = P[i*3] - px, z0 = P[i*3 + 2] - pz; return [x0*cd - z0*sd, P[i*3 + 1] - py, x0*sd + z0*cd]; };
  const set = (i, a, b, c) => { P[i*3] = a; P[i*3 + 1] = b; P[i*3 + 2] = c; };
  const lean = 0.3, cl = Math.cos(lean), sl = Math.sin(lean);
  // the upper body: its own shape about the hips, tipped forward
  for (let i = 1; i <= 9; i++) { const [dx, dy, dz] = at(i), a = dx*f[0] + dz*f[1], sx = dx - a*f[0], sz = dz - a*f[1]; const a2 = a*cl + dy*sl, y2 = dy*cl - a*sl; set(i, x + sx + a2*f[0], y + y2, z + sz + a2*f[1]); }
  for (const [h, k, an, b] of [[10, 11, 12, 13], [14, 15, 16, 17]]) {
    const [hx, hy, hz] = at(h), Lt = Math.hypot(P[k*3] - P[h*3], P[k*3 + 1] - P[h*3 + 1], P[k*3 + 2] - P[h*3 + 2]), Lc = Math.hypot(P[an*3] - P[k*3], P[an*3 + 1] - P[k*3 + 1], P[an*3 + 2] - P[k*3 + 2]);
    const bo = at(b), ao = at(an), Hx = x + hx, Hy = y + hy, Hz = z + hz;
    const Kx = Hx + f[0]*Lt*0.86, Ky = Hy - Lt*0.51, Kz = Hz + f[1]*Lt*0.86;
    const Ax = Kx - f[0]*Lc*0.26, Ay = Ky - Lc*0.97, Az = Kz - f[1]*Lc*0.26;
    set(h, Hx, Hy, Hz); set(k, Kx, Ky, Kz); set(an, Ax, Ay, Az); set(b, Ax + bo[0] - ao[0], Ay + bo[1] - ao[1], Az + bo[2] - ao[2]);
  }
  set(0, x, y, z);
  R.len = LINKS.map(([a, b]) => Math.hypot(P[a*3] - P[b*3], P[a*3 + 1] - P[b*3 + 1], P[a*3 + 2] - P[b*3 + 2]));
  for (let i = 0; i < N; i++) { R.q[i*3] = P[i*3] - vx*DT; R.q[i*3 + 1] = P[i*3 + 1] - vy*DT; R.q[i*3 + 2] = P[i*3 + 2] - vz*DT; }
  R.sleep = false; R.still = 0;
}
// every point given its own speed (f(i) -> [vx, vy, vz])
export function velRag(R, f) {
  for (let i = 0; i < N; i++) { const [vx, vy, vz] = f(i); R.q[i*3] = R.p[i*3] - vx*DT; R.q[i*3 + 1] = R.p[i*3 + 1] - vy*DT; R.q[i*3 + 2] = R.p[i*3 + 2] - vz*DT; }
  R.sleep = false; R.still = 0;
}
// a wheel, a kick: a push on the points near (x, z)
export function kickRag(p, x, z, vx, vy, vz, r = 0.8) {
  const R = p._rag; if (!R) return;
  R.sleep = false; R.still = 0;
  for (let i = 0; i < N; i++) { const d = Math.hypot(R.p[i*3] - x, R.p[i*3 + 2] - z); if (d > r) continue; const k = 1 - d/r; R.q[i*3] -= vx*k*DT; R.q[i*3 + 1] -= vy*k*DT; R.q[i*3 + 2] -= vz*k*DT; }
}

// ---- the physics: a fixed step, the same every time
function carAt(R, k) {
  const C = R.car, V = C.V; return [C.x + (V.x - C.x)*k, C.z + (V.z - C.z)*k, C.th + Math.atan2(Math.sin(V.th - C.th), Math.cos(V.th - C.th))*k];
}
function step(R, W) {
  const p = R.p, q = R.q;
  // moving on, falling, a little air
  for (let i = 0; i < N; i++) {
    const j = i*3;
    for (let c = 0; c < 3; c++) { const x = p[j + c], v = (x - q[j + c])*0.999; q[j + c] = x; p[j + c] = x + v + (c === 1 ? -G0*DT*DT : 0); }
  }
  // what hit them, where it is this step
  const C = R.car;
  let cx, cz, th, hx, hz, fr, L2, W2, gy, cvx, cvz;
  if (C) {
    [cx, cz, th] = carAt(R, R.sub); hx = Math.cos(th); hz = Math.sin(th); fr = Math.sign(C.V.v || 1); L2 = C.S.L/2; W2 = C.S.W/2;
    gy = C.gy; cvx = (C.V.v || 0)*hx*DT; cvz = (C.V.v || 0)*hz*DT;
  }
  for (let it = 0; it < ITER; it++) {
    for (let k = 0; k < LINKS.length; k++) {
      const [a, b, s] = LINKS[k], A = a*3, B = b*3, dx = p[B] - p[A], dy = p[B + 1] - p[A + 1], dz = p[B + 2] - p[A + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
      const wa = 1/MASS[a], wb = 1/MASS[b], e = (d - R.len[k])/d/(wa + wb)*s;
      p[A] += dx*e*wa; p[A + 1] += dy*e*wa; p[A + 2] += dz*e*wa; p[B] -= dx*e*wb; p[B + 1] -= dy*e*wb; p[B + 2] -= dz*e*wb;
    }
    for (const [a, b, m] of APART) {
      const A = a*3, B = b*3, dx = p[B] - p[A], dy = p[B + 1] - p[A + 1], dz = p[B + 2] - p[A + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
      if (d >= m) continue;
      const wa = 1/MASS[a], wb = 1/MASS[b], e = (d - m)/d/(wa + wb);
      p[A] += dx*e*wa; p[A + 1] += dy*e*wa; p[A + 2] += dz*e*wa; p[B] -= dx*e*wb; p[B + 1] -= dy*e*wb; p[B + 2] -= dz*e*wb;
    }
    // knees bend forward, elbows back: the way the body faces, from its hips and its chest
    pt(R, 1, _a).sub(pt(R, 0, _b)); pt(R, 10, _c).sub(pt(R, 14, _l)); _f.crossVectors(_c, _a).normalize();
    for (const [h, k, ft] of [[10, 11, 12], [14, 15, 16]]) {
      const m = (p[h*3] + p[ft*3])/2, my = (p[h*3 + 1] + p[ft*3 + 1])/2, mz = (p[h*3 + 2] + p[ft*3 + 2])/2;
      const dd = (p[k*3] - m)*_f.x + (p[k*3 + 1] - my)*_f.y + (p[k*3 + 2] - mz)*_f.z;
      if (dd < 0.015) { const e = 0.015 - dd; p[k*3] += _f.x*e; p[k*3 + 1] += _f.y*e; p[k*3 + 2] += _f.z*e; }
    }
    pt(R, 2, _a).sub(pt(R, 1, _b)); pt(R, 4, _c).sub(pt(R, 7, _l)); _f.crossVectors(_c, _a).normalize();
    for (const [s, e2, h] of [[4, 5, 6], [7, 8, 9]]) {
      const m = (p[s*3] + p[h*3])/2, my = (p[s*3 + 1] + p[h*3 + 1])/2, mz = (p[s*3 + 2] + p[h*3 + 2])/2;
      const dd = (p[e2*3] - m)*_f.x + (p[e2*3 + 1] - my)*_f.y + (p[e2*3 + 2] - mz)*_f.z;
      if (dd > -0.01) { const e = dd + 0.01; p[e2*3] -= _f.x*e; p[e2*3 + 1] -= _f.y*e; p[e2*3 + 2] -= _f.z*e; }
    }
  }
  for (let i = 0; i < N; i++) {
    const j = i*3, r = RAD[i];
    // the car: solid from the road to its outline (bonnet, glass, roof), pushed out the nearest way, and it drags
    // whatever lies on it towards its own speed
    if (C && R.carOn) {
      const rx = p[j] - cx, rz = p[j + 2] - cz, la = rx*hx + rz*hz, lc = -rx*hz + rz*hx, l2 = L2 + r, w2 = W2 + r;
      if (Math.abs(la) < l2 && Math.abs(lc) < w2) {
        const top = gy + C.top(fr*la/L2) + r;
        if (p[j + 1] < top && p[j + 1] > gy - 0.2) {
          const dTop = top - p[j + 1], dF = l2 - fr*la, dB = l2 + fr*la, dS = w2 - Math.abs(lc), m = Math.min(dTop, dF, dB, dS);
          if (m === dTop) {
            // the push it takes to keep them on top of it is all the grip there is: cloth on paint and glass slides
            // (friction is a share of that push, never a hold), so a body the car's going faster than slides up the
            // glass and over, and one on the bonnet when you brake goes on off the front
            const vy0 = p[j + 1] - q[j + 1];
            p[j + 1] = top;
            let vx = p[j] - q[j], vz = p[j + 2] - q[j + 2], vy = p[j + 1] - q[j + 1];
            if (vy < 0) vy = 0;
            const jn = Math.max(0, vy - vy0), rx = vx - cvx, rz = vz - cvz, rl = Math.hypot(rx, rz);
            if (rl > 1e-9) { const k = Math.min(rl, MU*jn)/rl; vx -= rx*k; vz -= rz*k; }
            q[j] = p[j] - vx; q[j + 1] = p[j + 1] - vy; q[j + 2] = p[j + 2] - vz;
          } else if (m === dF) { p[j] += hx*fr*dF; p[j + 2] += hz*fr*dF; }
          else if (m === dB) { p[j] -= hx*fr*dB; p[j + 2] -= hz*fr*dB; }
          else { const sg = Math.sign(lc) || 1; p[j] += -hz*sg*dS; p[j + 2] += hx*sg*dS; }
        }
      }
    }
    // the road: they don't go into it, they scrape along it
    const g = R.gy[i] + r;
    if (p[j + 1] < g) {
      p[j + 1] = g;
      let vx = p[j] - q[j], vz = p[j + 2] - q[j + 2], vy = p[j + 1] - q[j + 1];
      if (vy < 0) vy = 0;                         // (a body doesn't bounce: it lands and stays)
      const v = Math.hypot(vx, vz), dv = 0.75*G0*DT*DT*1.6;
      if (v > dv) { vx -= vx/v*dv; vz -= vz/v*dv; } else { vx = 0; vz = 0; }
      q[j] = p[j] - vx; q[j + 1] = p[j + 1] - vy; q[j + 2] = p[j + 2] - vz;
    }
  }
}
export function tick(R, dt, W) {
  // the ground under each point, and walls, once a frame (they're not moving)
  const surf = W && W.surf, col = W && W.collision;
  for (let i = 0; i < N; i++) {
    const j = i*3; if (surf) R.gy[i] = surf.height(R.p[j], R.p[j + 2]);
    if (col && R.p[j + 1] - R.gy[i] < 2.2) { const r = col.resolve(R.p[j], R.p[j + 2], RAD[i] + 0.05); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { R.p[j] += r.nx*r.depth; R.p[j + 2] += r.nz*r.depth; const vn = (R.p[j] - R.q[j])*r.nx + (R.p[j + 2] - R.q[j + 2])*r.nz; if (vn < 0) { R.q[j] += vn*r.nx*1.3; R.q[j + 2] += vn*r.nz*1.3; } } }
  }
  const C = R.car;
  if (C) {
    C.gy = surf ? surf.height(C.V.x, C.V.z) : 0;
    // the car's in it while they're up off the road on it, or in the first moment; once they're down it goes over them
    R.carOn = R.t < 3 && (R.t < 0.25 || R.p[1] - R.gy[0] > 0.42);
    if (R.t >= 3) R.car = null;
  }
  R.acc = Math.min(R.acc + dt, DT*8);
  const n = Math.floor(R.acc/DT);
  for (let s = 0; s < n; s++) { R.sub = (s + 1)/n; step(R, W); }
  R.acc -= n*DT; R.t += n*DT;
  if (C && R.car) { C.x = C.V.x; C.z = C.V.z; C.th = C.V.th; }
  // still: asleep (moves again if something pushes it)
  let mx = 0; for (let i = 0; i < N*3; i++) mx = Math.max(mx, Math.abs(R.p[i] - R.q[i]));
  R.still = mx/DT < 0.12 && n > 0 ? R.still + dt : n > 0 ? 0 : R.still;
  if ((R.still > 0.5 && R.t > 1) || R.t > 9) R.sleep = true;
}

// ---- the bones, from the points (after the clip's pose: whatever the clip doesn't move, the fingers, keep its pose)
export function pose(p, H) {
  const R = p._rag; H.holder.updateMatrixWorld(true);
  const w = R.out < 0 ? 1 : 1 - smooth((performance.now() - R.out)/(OUT*1000));
  const F = frames(R, FR);
  for (const n of ORDER) {
    const b = bone(H, n), O = R.off[n]; if (!b || !O) continue;
    b.parent.matrixWorld.decompose(_b, _pq, _s);
    _q.copy(F[n]).multiply(O); _pq.invert().multiply(_q);
    b.quaternion.slerp(_pq, w);
    if (n === 'pelvis') { _Mi.copy(b.parent.matrixWorld).invert(); _a.set(R.p[0], R.p[1], R.p[2]).applyMatrix4(_Mi); b.position.lerp(_a, w); }
    b.updateMatrixWorld(true);
  }
  // the hands go limp: half closed, each finger its own way
  const fist = fistOf(H);
  if (fist) for (const s of ['l', 'r']) for (let f = 0; f < 5; f++) for (let k = 1; k <= 3; k++) {
    const n = FINGERS[f] + '_0' + k + '_' + s, b = bone(H, n), Fq = fist[n]; if (!b || !Fq) continue;
    b.quaternion.slerp(Fq, (0.3 + 0.08*f + (p.id || 0)%3*0.05)*w);
  }
}

// ---- when they get up: their feet the way they lie, over onto their back the while
function letGo(p) {
  const R = p._rag; if (R.out >= 0) return;
  R.out = performance.now();
  const hx = R.p[0] - R.p[6], hz = R.p[2] - R.p[8];
  if (Math.hypot(hx, hz) > 0.05) { p.yaw = Math.atan2(hz, hx); p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw); }
  p.x = R.p[0]; p.z = R.p[2];
}

const upd = People.prototype.update;
People.prototype.update = function (dt, ...rest) {
  const r = upd.call(this, dt, ...rest);
  if (dt > 0) for (const p of this.list) {
    const R = p._rag; if (!R) continue;
    if (p.hidden || p._drag || p._wake || p.rideOf) { p._rag = null; continue; }
    if (R.out >= 0) { if (performance.now() - R.out > OUT*1000) p._rag = null; continue; }
    // up again (not the dead or the out cold): from where they lie into the clip. Nobody gets up while they're still
    // going (in the air, rolling, sliding): only once the body's come to rest
    if (!R.sleep && R.t < 7 && !p.corpse && p.fallen > 0) p.fallen = Math.max(p.fallen, 1.4);
    if (!(p.fallen > 1.3) && !p.corpse) { letGo(p); continue; }
    if (!R.sleep) tick(R, dt, this.W);
    p.x = R.p[0]; p.z = R.p[2]; p.liftY = 0;
  }
  return r;
};
const post = Crowd.prototype.postPed;
Crowd.prototype.postPed = function (p, H, dt) {
  if (p._rag && !(p._drag || p._wake)) { pose(p, H); return; }
  return post && post.call(this, p, H, dt);
};
