// Falling like a body does, worked out, not played, and built as a body is built. Whoever goes down (hit by what you
// drive, punched, shot, shoved, thrown off a scooter) becomes a skeleton with its weight where a body's weight is:
// the hips and the chest are each one solid piece (a pelvis, a ribcage: they don't fold, flatten or turn inside out),
// joined by a spine that bends forward further than back, a little to the side and twists only so far; the head sits
// on a neck with its own range; a thigh swings from the hip forward a long way, back a little, out more than in; an
// arm from the shoulder nearly anywhere but into the chest; knees and elbows are hinges, one way only, never past
// straight and never shut. The trunk is heavy and the limbs light, so a fall is the trunk's and the arms and legs
// follow it, they don't throw it about. Gravity has it, the road takes it without giving it back (no bounce: what
// lands stays landed, and slides with the grip cloth has on tar), the flailing dies away once it's down, walls stop
// it, and what hit it is solid: the car's front takes the legs, the bonnet and glass carry the body up and over as
// they rise under it. Every bone of the body (and the fingers, going limp) follows. The same hit on the same step goes
// the same way every time (fixed steps, no dice); a step later, an arm the other way, a kerb under one foot, and it's
// another fall. When they get up, the body goes from where it lies into the getting-up.
import * as THREE from 'three';
import { People } from '@orig/people/peds.js';
import { Crowd } from '@orig/people/crowd.js';

const DT = 1/120, ITER = 8, G0 = 9.81, OUT = 0.6, MU = 0.35, GRIP = 0.7;
// the points: the bones' own joints, and (18, 19) one in front of the hips and one on the breastbone, which make the
// pelvis and the ribcage solid pieces with a front and a back
const NAMES = ['pelvis', 'spine_03', 'Head', null, 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', null, null];
const N = NAMES.length;
// kg, roughly a 65 kg person: the trunk is most of it
const MASS = [10, 12, 5, 1, 2, 1.3, 0.5, 2, 1.3, 0.5, 7, 3.5, 1, 0.3, 7, 3.5, 1, 0.3, 3, 3];
const RAD = [0.11, 0.13, 0.1, 0.08, 0.06, 0.045, 0.04, 0.06, 0.045, 0.04, 0.08, 0.06, 0.05, 0.03, 0.08, 0.06, 0.05, 0.03, 0.08, 0.09];
const W_ = MASS.map(m => 1/m);
// [a, b, how stiff]: bones (and the solid pieces' braces)
const LINKS = [
  [0, 10, 1], [0, 14, 1], [10, 14, 1], [0, 18, 1], [10, 18, 1], [14, 18, 1],          // the pelvis
  [1, 4, 1], [1, 7, 1], [4, 7, 1], [1, 19, 1], [4, 19, 1], [7, 19, 1],                // the ribcage
  [0, 1, 1],                                                                           // the spine
  [1, 2, 1], [2, 3, 1], [1, 3, 0.15],                                                  // the neck, the head
  [4, 5, 1], [5, 6, 1], [7, 8, 1], [8, 9, 1],                                          // arms
  [10, 11, 1], [11, 12, 1], [12, 13, 1], [11, 13, 0.6], [14, 15, 1], [15, 16, 1], [16, 17, 1], [15, 17, 0.6]];
// [a, b, nearest they come]: the limbs don't pass through the body or each other
const APART = [[6, 1, 0.1], [9, 1, 0.1], [6, 0, 0.12], [9, 0, 0.12], [5, 0, 0.15], [8, 0, 0.15], [6, 19, 0.08], [9, 19, 0.08], [6, 2, 0.12], [9, 2, 0.12],
  [11, 15, 0.14], [12, 16, 0.12], [13, 17, 0.1], [2, 10, 0.35], [2, 14, 0.35], [3, 0, 0.5], [11, 1, 0.22], [15, 1, 0.22], [12, 0, 0.2], [16, 0, 0.2]];
// [a, b, furthest apart]: limp legs stay together (the muscle and the cloth between them, the trousers, the sari): the
// knees and the feet go the same way, one a little behind or beside the other, never one off to each side. If they
// went down mid-stride, the legs come together over the first half second, they don't snap
const TOGETHER = [[11, 15, 0.3], [12, 16, 0.36], [13, 17, 0.4]];

const V3 = THREE.Vector3, _a = new V3(), _b = new V3(), _c = new V3(), _X = new V3(), _Y = new V3(), _Z = new V3(), _f = new V3();
const _M = new THREE.Matrix4(), _Mi = new THREE.Matrix4(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _s = new V3();
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t*t*(3 - 2*t); };
const pt = (R, i, o) => o.set(R.p[i*3], R.p[i*3 + 1], R.p[i*3 + 2]);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// a frame from a direction and a way round: y along the bone, x as near the reference as it can be (no twist added)
function frame(out, y, xRef) {
  _Y.copy(y); if (_Y.lengthSq() < 1e-10) _Y.set(0, 1, 0); _Y.normalize();
  _X.copy(xRef).addScaledVector(_Y, -xRef.dot(_Y));
  if (_X.lengthSq() < 1e-8) { _X.set(1, 0, 0).addScaledVector(_Y, -_Y.x); if (_X.lengthSq() < 1e-8) _X.set(0, 0, 1).addScaledVector(_Y, -_Y.z); }
  _X.normalize(); _Z.crossVectors(_X, _Y);
  _M.makeBasis(_X, _Y, _Z); return out.setFromRotationMatrix(_M);
}
const xOf = (q, o) => o.set(1, 0, 0).applyQuaternion(q);

// a solid piece's axes: X to its left, Z to its front, Y up through it (Z x X)
const bd = new V3();
function basis(R, o, l, r, fr, X, Y, Z) {
  pt(R, l, X).sub(pt(R, r, bd)); X.lengthSq() > 1e-10 ? X.normalize() : X.set(1, 0, 0);
  pt(R, fr, Z).sub(pt(R, o, bd)); Z.addScaledVector(X, -Z.dot(X)); Z.lengthSq() > 1e-10 ? Z.normalize() : Z.set(0, 0, 1);
  Y.crossVectors(Z, X);
}
const Xp = new V3(), Yp = new V3(), Zp = new V3(), Xc = new V3(), Yc = new V3(), Zc = new V3();

// every frame the bones are posed from: [bone, how it's found]
const FR = {};
const fp = new THREE.Quaternion(), fc = new THREE.Quaternion(), fh = new THREE.Quaternion(), t1 = new V3(), t2 = new V3();
const fXp = new V3(), fYp = new V3(), fZp = new V3(), fXc = new V3(), fYc = new V3(), fZc = new V3();
function frames(R, out) {
  const P = (i, o) => pt(R, i, o);
  // the pelvis and the ribcage as the solid pieces they are
  basis(R, 0, 10, 14, 18, fXp, fYp, fZp); frame(fp, fYp, fXp);
  const xp = xOf(fp, new V3());
  basis(R, 1, 4, 7, 19, fXc, fYc, fZc); frame(fc, fYc, fXc);
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

// the two front points, from the hips and the shoulders as they are (Z = left x up: the way the body faces)
function fronts(R) {
  const P = R.p;
  for (const [o, l, r, up, at] of [[0, 10, 14, 1, 18], [1, 4, 7, 2, 19]]) {
    pt(R, l, _a).sub(pt(R, r, _b)); pt(R, up, _c).sub(pt(R, o, _b));
    _f.crossVectors(_a, _c); if (_f.lengthSq() < 1e-10) _f.set(1, 0, 0); _f.normalize();
    P[at*3] = P[o*3] + _f.x*0.12; P[at*3 + 1] = P[o*3 + 1] + _f.y*0.12; P[at*3 + 2] = P[o*3 + 2] + _f.z*0.12;
  }
}
const togetherFrom = (R) => { const P = R.p; R.tog = TOGETHER.map(([a, b, m]) => Math.max(m, Math.hypot(P[a*3] - P[b*3], P[a*3 + 1] - P[b*3 + 1], P[a*3 + 2] - P[b*3 + 2]))); };
const lengths = (R) => { const P = R.p; R.len = LINKS.map(([a, b]) => Math.hypot(P[a*3] - P[b*3], P[a*3 + 1] - P[b*3 + 1], P[a*3 + 2] - P[b*3 + 2])); };

export function ragOn(p) { return !!(p && p._rag); }
// start: the points where the body's bones are this moment, moving as the body was
export function startRag(p, o = {}) {
  const H = (o.H && o.H.root ? o.H : null) || (p.body && p.body.H); if (!H || !H.root) return null;
  H.holder.updateMatrixWorld(true);
  const R = { p: new Float64Array(N*3), q: new Float64Array(N*3), t: 0, acc: 0, still: 0, sleep: false, off: {}, car: null, gy: new Float64Array(N).fill(-1e9), out: -1, kmh: o.kmh || 0 };
  const hb = bone(H, 'Head');
  for (let i = 0; i < 18; i++) {
    const n = NAMES[i], b = n ? bone(H, n) : null;
    if (b) _a.setFromMatrixPosition(b.matrixWorld);
    else if (hb) { hb.matrixWorld.decompose(_b, _q, _s); _a.setFromMatrixPosition(hb.matrixWorld).add(_c.set(0, 0.19, 0).applyQuaternion(_q)); }
    else return null;
    R.p[i*3] = _a.x; R.p[i*3 + 1] = _a.y; R.p[i*3 + 2] = _a.z;
  }
  fronts(R); lengths(R); togetherFrom(R);
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
  // the knees give a touch, so nobody goes over stiff as a post
  const fwd = _f.set(Math.cos(o.yaw ?? p.yaw ?? 0), 0, Math.sin(o.yaw ?? p.yaw ?? 0));
  for (const k of [11, 15]) { R.p[k*3] += fwd.x*0.03; R.p[k*3 + 2] += fwd.z*0.03; }
  settle(R);
  if (o.V) {
    // how much of its speed it gives them: a car or a bus barely notices a person (it carries them at its own speed), a
    // scooter with its rider is only three or four times their weight and gives them less of its own
    const V = o.V, S = o.S || {}, M = o.M || S.mass || (S.two ? 260 : 1200);
    R.car = { V, S, H: o.carH || 1.4, tall: !!o.tall, top: o.top, x: V.x, z: V.z, th: V.th, k: M/(M + 65) };
  }
  p._rag = R; p._slide = null;
  return R;
}
// a body taken from a pose its joints don't allow (mid-stride, an arm behind the back) is put inside its limits before
// it moves: the correction carries the points, it doesn't throw them (that was the first-frame kick and flail)
function settle(R) {
  const p = R.p, q = R.q, s0 = Float64Array.from(p);
  solve(R, ITER*3);
  for (let i = 0; i < p.length; i++) q[i] += p[i] - s0[i];
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
  for (let i = 1; i <= 9; i++) { const [dx, dy, dz] = at(i), a = dx*f[0] + dz*f[1], sx = dx - a*f[0], sz = dz - a*f[1]; const a2 = a*cl + dy*sl, y2 = dy*cl - a*sl; set(i, x + sx + a2*f[0], y + y2, z + sz + a2*f[1]); }
  for (const [h, k, an, b] of [[10, 11, 12, 13], [14, 15, 16, 17]]) {
    const [hx, hy, hz] = at(h), Lt = Math.hypot(P[k*3] - P[h*3], P[k*3 + 1] - P[h*3 + 1], P[k*3 + 2] - P[h*3 + 2]), Lc = Math.hypot(P[an*3] - P[k*3], P[an*3 + 1] - P[k*3 + 1], P[an*3 + 2] - P[k*3 + 2]);
    const bo = at(b), ao = at(an), Hx = x + hx, Hy = y + hy, Hz = z + hz;
    const Kx = Hx + f[0]*Lt*0.86, Ky = Hy - Lt*0.51, Kz = Hz + f[1]*Lt*0.86;
    const Ax = Kx - f[0]*Lc*0.26, Ay = Ky - Lc*0.97, Az = Kz - f[1]*Lc*0.26;
    set(h, Hx, Hy, Hz); set(k, Kx, Ky, Kz); set(an, Ax, Ay, Az); set(b, Ax + bo[0] - ao[0], Ay + bo[1] - ao[1], Az + bo[2] - ao[2]);
  }
  set(0, x, y, z);
  fronts(R); lengths(R); togetherFrom(R); settle(R);
  for (let i = 0; i < N; i++) { R.q[i*3] = P[i*3] - vx*DT; R.q[i*3 + 1] = P[i*3 + 1] - vy*DT; R.q[i*3 + 2] = P[i*3 + 2] - vz*DT; }
  R.sleep = false; R.still = 0;
}
// every point given its own speed (f(i) -> [vx, vy, vz])
export function velRag(R, f) {
  for (let i = 0; i < N; i++) { const [vx, vy, vz] = f(Math.min(i, 17) === i ? i : i === 18 ? 0 : 1); R.q[i*3] = R.p[i*3] - vx*DT; R.q[i*3 + 1] = R.p[i*3 + 1] - vy*DT; R.q[i*3 + 2] = R.p[i*3 + 2] - vz*DT; }
  R.sleep = false; R.still = 0;
}
// a wheel, a kick: a push on the points near (x, z)
export function kickRag(p, x, z, vx, vy, vz, r = 0.8) {
  const R = p._rag; if (!R) return;
  R.sleep = false; R.still = 0;
  for (let i = 0; i < N; i++) { const d = Math.hypot(R.p[i*3] - x, R.p[i*3 + 2] - z); if (d > r) continue; const k = 1 - d/r; R.q[i*3] -= vx*k*DT; R.q[i*3 + 1] -= vy*k*DT; R.q[i*3 + 2] -= vz*k*DT; }
}

// ---- the joints. Each moves the two ends towards where the joint allows, shared by their weight
function moveTo(p, a, b, tx, ty, tz, k) {
  const j = b*3, dx = (tx - p[j])*k, dy = (ty - p[j + 1])*k, dz = (tz - p[j + 2])*k, wa = W_[a], wb = W_[b], s = 1/(wa + wb);
  p[j] += dx*wb*s; p[j + 1] += dy*wb*s; p[j + 2] += dz*wb*s;
  const i = a*3; p[i] -= dx*wa*s; p[i + 1] -= dy*wa*s; p[i + 2] -= dz*wa*s;
}
// b from a, in a piece's axes (X, Y, Z), kept inside its range: forward/back from the rest direction (down for a
// limb, up for the spine and neck) within [s0, s1], sideways (out, by side: +1 the left) within [l0, l1]
const cd_ = new V3();
function cone(p, a, b, X, Y, Z, side, down, s0, s1, l0, l1, k) {
  const i = a*3, j = b*3;
  cd_.set(p[j] - p[i], p[j + 1] - p[i + 1], p[j + 2] - p[i + 2]);
  const L = cd_.length(); if (L < 1e-6) return;
  cd_.multiplyScalar(1/L);
  const lx = side*cd_.dot(X), ly = (down ? -1 : 1)*cd_.dot(Y), lz = cd_.dot(Z);
  const sag = Math.atan2(lz, ly), lat = Math.asin(clamp(lx, -1, 1));
  const s2 = clamp(sag, s0, s1), l2 = clamp(lat, l0, l1);
  if (s2 === sag && l2 === lat) return;
  const cl = Math.cos(l2), ox = side*Math.sin(l2), oy = (down ? -1 : 1)*cl*Math.cos(s2), oz = cl*Math.sin(s2);
  moveTo(p, a, b, p[i] + (X.x*ox + Y.x*oy + Z.x*oz)*L, p[i + 1] + (X.y*ox + Y.y*oy + Z.y*oz)*L, p[i + 2] + (X.z*ox + Y.z*oy + Z.z*oz)*L, k);
}
// a hinge (knee, elbow): c from b turns only about the axis (ref, square to the upper bone), one way (dir), from just
// short of straight to its fullest bend; the end beyond it (a foot) goes with it
const ht = new V3(), ha = new V3(), hn = new V3(), hs = new V3();
function hinge(p, a, b, c, ref, dir, kMax, k, tail = -1) {
  const i = a*3, j = b*3, m = c*3;
  ht.set(p[j] - p[i], p[j + 1] - p[i + 1], p[j + 2] - p[i + 2]); if (ht.lengthSq() < 1e-10) return; ht.normalize();
  ha.copy(ref).addScaledVector(ht, -ref.dot(ht)); if (ha.lengthSq() < 0.06) return; ha.normalize();
  hn.crossVectors(ht, ha);
  hs.set(p[m] - p[j], p[m + 1] - p[j + 1], p[m + 2] - p[j + 2]); const L = hs.length(); if (L < 1e-6) return; hs.multiplyScalar(1/L);
  const st = hs.dot(ht), sn = hs.dot(hn)*dir, sa = hs.dot(ha);
  const bend = Math.atan2(sn, st), b2 = clamp(bend, 0.03, kMax);
  if (b2 === bend && Math.abs(sa) < 0.02) return;
  const cb = Math.cos(b2), sb = Math.sin(b2)*dir;
  const tx = p[j] + (ht.x*cb + hn.x*sb)*L, ty = p[j + 1] + (ht.y*cb + hn.y*sb)*L, tz = p[j + 2] + (ht.z*cb + hn.z*sb)*L;
  const ox = p[m], oy = p[m + 1], oz = p[m + 2];
  moveTo(p, b, c, tx, ty, tz, k);
  if (tail >= 0) { const q = tail*3; p[q] += p[m] - ox; p[q + 1] += p[m + 1] - oy; p[q + 2] += p[m + 2] - oz; }
}
// turn the points of a piece about an axis through a point
const rq = new THREE.Quaternion(), rv = new V3();
function turnSet(p, set, ox, oy, oz, axis, ang) {
  rq.setFromAxisAngle(axis, ang);
  for (const i of set) { const j = i*3; rv.set(p[j] - ox, p[j + 1] - oy, p[j + 2] - oz).applyQuaternion(rq); p[j] = ox + rv.x; p[j + 1] = oy + rv.y; p[j + 2] = oz + rv.z; }
}
const PELVIS = [10, 14, 18], CHEST = [4, 7, 19], sx_ = new V3(), sp_ = new V3(), sc_ = new V3(), sw_ = new V3();
function joints(R, k) {
  const p = R.p;
  basis(R, 0, 10, 14, 18, Xp, Yp, Zp);
  // the spine: the chest from the hips forward to 0.9 rad, back 0.4, to the side 0.45
  cone(p, 0, 1, Xp, Yp, Zp, 1, false, -0.4, 0.9, -0.45, 0.45, k);
  basis(R, 1, 4, 7, 19, Xc, Yc, Zc);
  // each piece stays square to the spine between them (a ribcage doesn't lie down on its own spine), and the chest
  // twists on the hips no more than 0.5 rad either way
  sw_.set(p[3] - p[0], p[4] - p[1], p[5] - p[2]).normalize();
  for (const [Y, set, o] of [[Yc, CHEST, 1], [Yp, PELVIS, 0]]) {
    const ang = Math.acos(clamp(Y.dot(sw_), -1, 1)), lim = o ? 0.35 : 0.3;
    if (ang > lim) { sx_.crossVectors(Y, sw_); if (sx_.lengthSq() > 1e-10) { sx_.normalize(); turnSet(p, set, p[o*3], p[o*3 + 1], p[o*3 + 2], sx_, (ang - lim)*k); } }
  }
  basis(R, 0, 10, 14, 18, Xp, Yp, Zp); basis(R, 1, 4, 7, 19, Xc, Yc, Zc);
  sp_.copy(Xp).addScaledVector(sw_, -Xp.dot(sw_)); sc_.copy(Xc).addScaledVector(sw_, -Xc.dot(sw_));
  if (sp_.lengthSq() > 1e-8 && sc_.lengthSq() > 1e-8) {
    sp_.normalize(); sc_.normalize();
    const tw = Math.atan2(_f.crossVectors(sp_, sc_).dot(sw_), sp_.dot(sc_)), t2 = clamp(tw, -0.5, 0.5);
    if (tw !== t2) { const e = (t2 - tw)*k*0.5; turnSet(p, CHEST, p[3], p[4], p[5], sw_, e); turnSet(p, PELVIS, p[0], p[1], p[2], sw_, -e); }
  }
  basis(R, 0, 10, 14, 18, Xp, Yp, Zp); basis(R, 1, 4, 7, 19, Xc, Yc, Zc);
  // the neck and the head on it
  cone(p, 1, 2, Xc, Yc, Zc, 1, false, -0.5, 0.7, -0.5, 0.5, k);
  cone(p, 2, 3, Xc, Yc, Zc, 1, false, -0.7, 1.0, -0.7, 0.7, k);
  // hips: a thigh forward to 2.1 rad (knee to chest), back 0.4, out 0.55 (limp, not a split), across 0.2
  cone(p, 10, 11, Xp, Yp, Zp, 1, true, -0.4, 2.1, -0.2, 0.55, k);
  cone(p, 14, 15, Xp, Yp, Zp, -1, true, -0.4, 2.1, -0.2, 0.55, k);
  // shoulders: up and forward nearly overhead, back 1 rad, out to the side and up, across the chest 0.4
  cone(p, 4, 5, Xc, Yc, Zc, 1, true, -1.0, 3.0, -0.4, 1.7, k);
  cone(p, 7, 8, Xc, Yc, Zc, -1, true, -1.0, 3.0, -0.4, 1.7, k);
  // knees bend back to 2.5 rad, elbows forward to 2.6, neither past straight
  hinge(p, 10, 11, 12, Xp, -1, 2.5, k, 13); hinge(p, 14, 15, 16, Xp, -1, 2.5, k, 17);
  hinge(p, 4, 5, 6, Xc, 1, 2.6, k); hinge(p, 7, 8, 9, Xc, 1, 2.6, k);
}

// ---- the physics: a fixed step, the same every time
function carAt(R, k) {
  const C = R.car, V = C.V; return [C.x + (V.x - C.x)*k, C.z + (V.z - C.z)*k, C.th + Math.atan2(Math.sin(V.th - C.th), Math.cos(V.th - C.th))*k];
}
const vm = [0, 0, 0];
function solve(R, n) {
  const p = R.p;
  for (let it = 0; it < n; it++) {
    for (let k = 0; k < LINKS.length; k++) {
      const [a, b, s] = LINKS[k], A = a*3, B = b*3, dx = p[B] - p[A], dy = p[B + 1] - p[A + 1], dz = p[B + 2] - p[A + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
      const wa = W_[a], wb = W_[b], e = (d - R.len[k])/d/(wa + wb)*s;
      p[A] += dx*e*wa; p[A + 1] += dy*e*wa; p[A + 2] += dz*e*wa; p[B] -= dx*e*wb; p[B + 1] -= dy*e*wb; p[B + 2] -= dz*e*wb;
    }
    for (const [a, b, m] of APART) {
      const A = a*3, B = b*3, dx = p[B] - p[A], dy = p[B + 1] - p[A + 1], dz = p[B + 2] - p[A + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
      if (d >= m) continue;
      const wa = W_[a], wb = W_[b], e = (d - m)/d/(wa + wb);
      p[A] += dx*e*wa; p[A + 1] += dy*e*wa; p[A + 2] += dz*e*wa; p[B] -= dx*e*wb; p[B + 1] -= dy*e*wb; p[B + 2] -= dz*e*wb;
    }
    for (let k = 0; k < TOGETHER.length; k++) {
      const [a, b] = TOGETHER[k], A = a*3, B = b*3, dx = p[B] - p[A], dy = p[B + 1] - p[A + 1], dz = p[B + 2] - p[A + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
      if (d <= R.tog[k]) continue;
      const wa = W_[a], wb = W_[b], e = (d - R.tog[k])/d/(wa + wb)*0.35;
      p[A] += dx*e*wa; p[A + 1] += dy*e*wa; p[A + 2] += dz*e*wa; p[B] -= dx*e*wb; p[B + 1] -= dy*e*wb; p[B + 2] -= dz*e*wb;
    }
    joints(R, 0.5);
    // the road, inside the solve, so the bones are never left holding a point under it
    for (let i = 0; i < N; i++) { const g = R.gy[i] + RAD[i]; if (p[i*3 + 1] < g) p[i*3 + 1] = g; }
  }
}
function step(R) {
  const p = R.p, q = R.q;
  // moving on, falling, a little air
  for (let i = 0; i < N; i++) {
    const j = i*3;
    for (let c = 0; c < 3; c++) { const x = p[j + c], v = (x - q[j + c])*0.998; q[j + c] = x; p[j + c] = x + v + (c === 1 ? -G0*DT*DT : 0); }
  }
  for (let k = 0; k < TOGETHER.length; k++) R.tog[k] = Math.max(TOGETHER[k][2], R.tog[k] - 0.7*DT);
  // what hit them, where it is this step
  const C = R.car;
  let cx, cz, th, hx, hz, fr, L2, W2, gy, cvx, cvz;
  if (C) {
    [cx, cz, th] = carAt(R, R.sub); hx = Math.cos(th); hz = Math.sin(th); fr = Math.sign(C.V.v || 1); L2 = C.S.L/2; W2 = C.S.W/2;
    gy = C.gy; cvx = (C.V.v || 0)*hx*DT; cvz = (C.V.v || 0)*hz*DT;
  }
  solve(R, ITER);
  let touching = 0;
  for (let i = 0; i < N; i++) {
    const j = i*3, r = RAD[i];
    // the car: solid from the road to its outline (bonnet, glass, roof). A point is put back outside it on the side it
    // came in from, and it moves off that side no faster than that side is moving: being put back never throws
    // anything (a body caught half inside the car's outline on the frame it was hit came out of it at tens of metres a
    // second, which is what sent people flying sky-high off a touch)
    if (C && R.carOn) {
      const rx = p[j] - cx, rz = p[j + 2] - cz, la = rx*hx + rz*hz, lc = -rx*hz + rz*hx, l2 = L2 + r, w2 = W2 + r;
      if (Math.abs(la) < l2 && Math.abs(lc) < w2) {
        const top = gy + C.top(fr*la/L2) + r;
        if (p[j + 1] < top && p[j + 1] > gy - 0.2) {
          // where it was against the car a step ago
          const qx = q[j] - cx + cvx, qz = q[j + 2] - cz + cvz, la0 = qx*hx + qz*hz, lc0 = -qx*hz + qz*hx, top0 = gy + C.top(clamp(fr*la0/L2, -1, 1)) + r;
          const dTop = top - p[j + 1], dF = l2 - fr*la, dB = l2 + fr*la, dS = w2 - Math.abs(lc);
          let face;
          if (q[j + 1] >= top0 - 0.03 || dTop < 0.06) face = 0;                      // on the top (came down on it, or rode up it)
          else if (fr*la0 >= l2 - 0.02) face = 1;                                     // in at the front
          else if (Math.abs(lc0) >= w2 - 0.02) face = 3;                              // in at the side
          else if (-fr*la0 >= l2 - 0.02) face = 2;
          else { const m = Math.min(dF, dB, dS*1.6); face = m === dF ? 1 : m === dB ? 2 : 3; }
          let vx = p[j] - q[j], vy = p[j + 1] - q[j + 1], vz = p[j + 2] - q[j + 2], nx = 0, ny = 0, nz = 0, d = 0, us = 0;
          const ck = C.k, cs = Math.hypot(cvx, cvz);
          if (face === 0) {
            // carried up as the bonnet and the glass rise under them (the surface's own rise, not the distance it was put
            // back), and the glass and the bonnet give as a body lands on them: less than all of it
            ny = 1; d = dTop; us = Math.min(Math.max(0, top - top0)*0.45, (0.12*cs/DT + 0.25)*DT);
          } else if (face === 1) { nx = hx*fr; nz = hz*fr; d = dF; us = cs*ck*0.82; }
          else if (face === 2) { nx = -hx*fr; nz = -hz*fr; d = dB; us = 0; }
          else { const sg = Math.sign(lc) || 1; nx = -hz*sg; nz = hx*sg; d = dS; us = 0; }
          p[j] += nx*d; p[j + 1] += ny*d; p[j + 2] += nz*d;
          const vn = vx*nx + vy*ny + vz*nz, jn = Math.max(0, us - vn);
          vx += nx*jn; vy += ny*jn; vz += nz*jn;
          // its grip on them along its surface: cloth on paint and glass, as much as the push it gives
          const rx2 = vx - cvx*ck, rz2 = vz - cvz*ck, rn = rx2*nx + rz2*nz, tx = rx2 - rn*nx, tz = rz2 - rn*nz, tl = Math.hypot(tx, tz);
          if (tl > 1e-9) { const k = Math.min(tl, MU*(jn + (face === 3 ? Math.min(d, cs)*0.3 : 0)))/tl; vx -= tx*k; vz -= tz*k; }
          q[j] = p[j] - vx; q[j + 1] = p[j + 1] - vy; q[j + 2] = p[j + 2] - vz;
        }
      }
    }
    // the road: what's on it stays on it (nothing it gave back as it was pushed up out of it), and slides with the
    // grip cloth has on tar till it stops
    const g = R.gy[i] + r;
    if (p[j + 1] <= g + 0.004) {
      touching++;
      if (p[j + 1] < g) p[j + 1] = g;
      let vx = p[j] - q[j], vz = p[j + 2] - q[j + 2], vy = p[j + 1] - q[j + 1];
      if (vy > 0) vy = 0;
      const v = Math.hypot(vx, vz), dv = GRIP*G0*DT*DT;
      if (v > dv) { vx -= vx/v*dv; vz -= vz/v*dv; } else { vx = 0; vz = 0; }
      q[j] = p[j] - vx; q[j + 1] = p[j + 1] - vy; q[j + 2] = p[j + 2] - vz;
    }
  }
  // a body's own damping: its limbs move with it more than against it (muscle, cloth, the joints' own stiffness), and
  // much more so once it's down on the road
  let M = 0; vm[0] = vm[1] = vm[2] = 0;
  for (let i = 0; i < N; i++) { const j = i*3, m = MASS[i]; M += m; vm[0] += (p[j] - q[j])*m; vm[1] += (p[j + 1] - q[j + 1])*m; vm[2] += (p[j + 2] - q[j + 2])*m; }
  vm[0] /= M; vm[1] /= M; vm[2] /= M;
  // the two legs go together: what one does, the other mostly follows
  for (const [a, b] of TOGETHER) for (let c = 0; c < 3; c++) {
    const A = a*3 + c, B = b*3 + c, va = p[A] - q[A], vb = p[B] - q[B], m = (va + vb)/2;
    q[A] = p[A] - (m + (va - m)*0.95); q[B] = p[B] - (m + (vb - m)*0.95);
  }
  const keep = touching >= 6 ? 0.93 : touching >= 2 ? 0.965 : 0.988;
  // lying on the road and hardly moving: it stops (the joints and the road nudging each other a hair every step was a
  // body that twitched for seconds)
  if (touching >= 5 && Math.hypot(vm[0], vm[1], vm[2])/DT < 0.25) { for (let i = 0; i < N*3; i++) { const c = i%3, v = p[i] - q[i]; q[i] = p[i] - (vm[c] + (v - vm[c])*keep)*0.6; } return; }
  for (let i = 0; i < N; i++) {
    const j = i*3;
    for (let c = 0; c < 3; c++) { const v = p[j + c] - q[j + c], rel = v - vm[c]; q[j + c] = p[j + c] - (vm[c] + rel*keep); }
  }
}
export function tick(R, dt, W) {
  // the ground under each point, and walls, once a frame (they're not moving)
  const surf = W && W.surf, col = W && W.collision;
  for (let i = 0; i < N; i++) {
    const j = i*3; if (surf) R.gy[i] = surf.height(R.p[j], R.p[j + 2]);
    if (col && R.p[j + 1] - R.gy[i] < 2.2) { const r = col.resolve(R.p[j], R.p[j + 2], RAD[i] + 0.05); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) { R.p[j] += r.nx*r.depth; R.p[j + 2] += r.nz*r.depth; const vn = (R.p[j] - R.q[j])*r.nx + (R.p[j + 2] - R.q[j + 2])*r.nz; if (vn < 0) { R.q[j] += vn*r.nx; R.q[j + 2] += vn*r.nz; } } }
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
  for (let s = 0; s < n; s++) { R.sub = (s + 1)/n; step(R); }
  R.acc -= n*DT; R.t += n*DT;
  if (C && R.car) { C.x = C.V.x; C.z = C.V.z; C.th = C.V.th; }
  // still: asleep (moves again if something pushes it)
  let mv = 0; for (let i = 0; i < N; i++) mv += Math.hypot(R.p[i*3] - R.q[i*3], R.p[i*3 + 1] - R.q[i*3 + 1], R.p[i*3 + 2] - R.q[i*3 + 2]);
  mv /= N;
  R.still = mv/DT < 0.12 && n > 0 ? R.still + dt : n > 0 ? 0 : R.still;
  if ((R.still > 0.3 && R.t > 0.8) || R.t > 7) R.sleep = true;
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

// ---- when they get up: their feet the way they lie
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
