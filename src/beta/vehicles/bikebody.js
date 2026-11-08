// A two-wheeler going over as the solid thing it is. It used to tip about its tyres to one fixed angle, the same way
// every time, whatever had happened to it. Now it's a rigid body made of the points it's built from (both tyres round
// their rims, the bar ends, the floorboard or the pegs and engine, the seat, the tail, the lamp), heaviest where the
// engine is, falling under its own weight and touching the road only where those points do. So it falls however the
// blow and its own speed send it: a slow tip onto its side when it's barely touched; down and sliding on its side when
// it's knocked at speed; spun round when it's hit at one end; rolled right over, or end over end over the front when it
// stops dead, when it's hit hard; and it comes to rest on whatever it ends up lying on (the bar end and the side
// panel, the tank and the peg, upside down on its bars and seat), rocking a little first. On its tyres it rolls along
// and won't go sideways; on its side, steel and plastic grind on tar.
//
// The points stay a rigid shape by shape matching: each step every point moves freely and is stopped by the road, then
// the shape is put back where it best fits them (its centre and its turn); that's what turns a push at one point into
// the whole thing moving and turning.
import * as THREE from 'three';

const DT = 1/120, G = 9.8;
const MU_SIDE = 0.5, MU_ROLL = 0.03, MU_TYRE = 0.95;

// [x forward, y up, z right, weight, 1 for the bottoms of the tyres]
function rim(out, x, R, side, m) {
  for (const a of [0, 1.047, 2.094, 3.1416, 4.189, 5.236]) out.push([x + R*Math.sin(a), R - R*Math.cos(a), 0, m, a === 0 ? 1 : 0]);
  out.push([x, R, side, m*0.5, 0], [x, R, -side, m*0.5, 0]);
}
const SHAPES = {
  scooter() {
    const p = []; rim(p, 0.66, 0.25, 0.06, 0.6); rim(p, -0.62, 0.25, 0.06, 0.6);
    for (const s of [-1, 1]) p.push(
      [0.62, 1.01, 0.39*s, 0.5, 0],          // grips
      [0.6, 0.62, 0.21*s, 1, 0],             // apron
      [0.4, 0.28, 0.18*s, 1, 0], [-0.25, 0.28, 0.18*s, 1, 0],   // floorboard
      [-0.45, 0.5, 0.21*s, 2, 0], [-0.8, 0.5, 0.19*s, 1, 0]);   // rear body
    p.push([-0.45, 0.79, 0, 1, 0], [-0.89, 0.54, 0, 0.5, 0], [0.74, 0.96, 0, 0.5, 0], [-0.4, 0.38, 0, 6, 0]);
    return p;
  },
  bike() {
    const p = []; rim(p, 0.78, 0.3, 0.06, 0.6); rim(p, -0.6, 0.3, 0.06, 0.6);
    for (const s of [-1, 1]) p.push(
      [0.63, 1.07, 0.37*s, 0.5, 0],          // grips
      [0.2, 0.9, 0.16*s, 1, 0],              // tank
      [0.07, 0.5, 0.17*s, 2, 0],             // engine
      [-0.05, 0.36, 0.25*s, 0.5, 0],         // pegs
      [-0.3, 0.7, 0.15*s, 1, 0]);            // side covers
    p.push([-0.3, 0.36, 0.26, 0.6, 0], [-0.3, 0.95, 0, 1, 0], [-0.7, 0.83, 0, 0.5, 0], [0.82, 1.0, 0, 0.5, 0], [0.07, 0.5, 0, 7, 0]);
    return p;
  },
  cycle() {
    const p = []; rim(p, 0.5, 0.34, 0.03, 0.4); rim(p, -0.5, 0.34, 0.03, 0.4);
    for (const s of [-1, 1]) p.push([0.44, 0.99, 0.3*s, 0.4, 0], [0.05, 0.25, 0.15*s, 0.3, 0]);
    p.push([-0.27, 0.9, 0, 0.6, 0], [0.05, 0.32, 0, 1, 0], [0.1, 0.62, 0, 0.6, 0]);
    return p;
  },
};
export const shapeOf = (type) => /^cycle/.test(type) ? 'cycle' : /^(bike|bullet|superbike)/.test(type) ? 'bike' : 'scooter';

const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();

// Q0, at (ox, oy, oz) (the point on the road between the tyres, as it's drawn), moving at vel and turning at om (world)
export function makeBody(type, Q0, ox, oy, oz, vel, om) {
  const pts = SHAPES[shapeOf(type)](), n = pts.length;
  let M = 0, cx = 0, cy = 0, cz = 0;
  for (const [x, y, z, m] of pts) { M += m; cx += x*m; cy += y*m; cz += z*m; }
  cx /= M; cy /= M; cz /= M;
  const B = { n, M, m: new Float64Array(n), r: new Float64Array(n*3), tyre: new Uint8Array(n), p: new Float64Array(n*3), q: new Float64Array(n*3),
    cl: [cx, cy, cz], Q: Q0.clone(), ox, oy, oz, t: 0, calm: 0, rest: false, acc: 0 };
  const c = _w.set(cx, cy, cz).applyQuaternion(Q0).add(_v.set(ox, oy, oz)), C = [c.x, c.y, c.z]; B.c = C.slice();
  for (let i = 0; i < n; i++) {
    const [x, y, z, m, ty] = pts[i];
    B.m[i] = m; B.tyre[i] = ty;
    B.r[i*3] = x - cx; B.r[i*3 + 1] = y - cy; B.r[i*3 + 2] = z - cz;
    _v.set(B.r[i*3], B.r[i*3 + 1], B.r[i*3 + 2]).applyQuaternion(Q0);
    const vx = vel[0] + om[1]*_v.z - om[2]*_v.y, vy = vel[1] + om[2]*_v.x - om[0]*_v.z, vz = vel[2] + om[0]*_v.y - om[1]*_v.x;
    B.p[i*3] = C[0] + _v.x; B.p[i*3 + 1] = C[1] + _v.y; B.p[i*3 + 2] = C[2] + _v.z;
    B.q[i*3] = B.p[i*3] - vx*DT; B.q[i*3 + 1] = B.p[i*3 + 1] - vy*DT; B.q[i*3 + 2] = B.p[i*3 + 2] - vz*DT;
  }
  return B;
}

// the shape put back where it best fits its points: the centre, and the turn closest to how they lie
// (Müller et al., "A Robust Method to Extract the Rotational Part of Deformations")
function match(B) {
  const { n, m, r, p, M } = B;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += p[i*3]*m[i]; cy += p[i*3 + 1]*m[i]; cz += p[i*3 + 2]*m[i]; }
  cx /= M; cy /= M; cz /= M;
  const A = [0, 0, 0, 0, 0, 0, 0, 0, 0];            // column j = sum m (p - c) r_j
  for (let i = 0; i < n; i++) {
    const dx = (p[i*3] - cx)*m[i], dy = (p[i*3 + 1] - cy)*m[i], dz = (p[i*3 + 2] - cz)*m[i];
    for (let j = 0; j < 3; j++) { const rj = r[i*3 + j]; A[j*3] += dx*rj; A[j*3 + 1] += dy*rj; A[j*3 + 2] += dz*rj; }
  }
  const Q = B.Q;
  for (let it = 0; it < 8; it++) {
    const { x, y, z, w } = Q;
    const R = [1 - 2*(y*y + z*z), 2*(x*y + z*w), 2*(x*z - y*w),  2*(x*y - z*w), 1 - 2*(x*x + z*z), 2*(y*z + x*w),  2*(x*z + y*w), 2*(y*z - x*w), 1 - 2*(x*x + y*y)];
    let ox = 0, oy = 0, oz = 0, d = 0;
    for (let j = 0; j < 3; j++) {
      const r0 = R[j*3], r1 = R[j*3 + 1], r2 = R[j*3 + 2], a0 = A[j*3], a1 = A[j*3 + 1], a2 = A[j*3 + 2];
      ox += r1*a2 - r2*a1; oy += r2*a0 - r0*a2; oz += r0*a1 - r1*a0; d += r0*a0 + r1*a1 + r2*a2;
    }
    const s = 1/(Math.abs(d) + 1e-9); ox *= s; oy *= s; oz *= s;
    const ang = Math.hypot(ox, oy, oz); if (ang < 1e-9) break;
    _q.setFromAxisAngle(_v.set(ox/ang, oy/ang, oz/ang), ang); Q.premultiply(_q).normalize();
  }
  for (let i = 0; i < n; i++) {
    _v.set(r[i*3], r[i*3 + 1], r[i*3 + 2]).applyQuaternion(Q);
    p[i*3] = cx + _v.x; p[i*3 + 1] = cy + _v.y; p[i*3 + 2] = cz + _v.z;
  }
  B.c = [cx, cy, cz];
}

// the road: nothing goes through it; what's on it rubs (rolls along on a tyre that's under it, grinds otherwise)
function road(B, gy, rub) {
  const { n, p, q, tyre } = B;
  let fx = 0, fz = 0, up = 0;
  if (rub) { _v.set(1, 0, 0).applyQuaternion(B.Q); fx = _v.x; fz = _v.z; const h = Math.hypot(fx, fz) || 1; fx /= h; fz /= h; up = _w.set(0, 1, 0).applyQuaternion(B.Q).y; }
  for (let i = 0; i < n; i++) {
    const pen = gy - p[i*3 + 1]; if (pen <= 0) continue;
    const vy = p[i*3 + 1] - q[i*3 + 1];
    p[i*3 + 1] = gy;
    if (!rub) { if (q[i*3 + 1] < gy) q[i*3 + 1] = gy; continue; }
    q[i*3 + 1] = gy + (vy < 0 ? vy*0.12 : 0);            // a little bounce, no more
    const dx = p[i*3] - q[i*3], dz = p[i*3 + 2] - q[i*3 + 2];
    if (tyre[i] && up > 0.55) {
      // rolling: along the tyre almost free, across it held
      const a = dx*fx + dz*fz, sx = dx - a*fx, sz = dz - a*fz, ka = Math.max(0, 1 - MU_ROLL*pen/(Math.abs(a) + 1e-9)), sl = Math.hypot(sx, sz), ks = Math.max(0, 1 - MU_TYRE*pen/(sl + 1e-9));
      q[i*3] = p[i*3] - (a*ka*fx + sx*ks); q[i*3 + 2] = p[i*3 + 2] - (a*ka*fz + sz*ks);
    } else {
      const d = Math.hypot(dx, dz), k = Math.max(0, 1 - MU_SIDE*pen/(d + 1e-9));
      q[i*3] = p[i*3] - dx*k; q[i*3 + 2] = p[i*3 + 2] - dz*k;
    }
  }
}

// on by dt. gy: the road under it; wall(x, z): how far to push it out of a wall, or null
export function stepBody(B, dt, gy, wall) {
  if (B.rest) return;
  B.acc = Math.min(B.acc + dt, DT*8);
  const { n, p, q } = B;
  while (B.acc >= DT) {
    B.acc -= DT; B.t += DT;
    for (let i = 0; i < n*3; i++) { const v = (p[i] - q[i])*0.9995; q[i] = p[i]; p[i] += v; }
    for (let i = 1; i < n*3; i += 3) p[i] -= G*DT*DT;
    for (let k = 0; k < 3; k++) { road(B, gy, true); match(B); }
  }
  // a wall: out of it, and most of the way it was going stopped
  const r = wall && wall(B.c[0], B.c[2]);
  if (r && r.depth > 0) for (let i = 0; i < n; i++) {
    p[i*3] += r.nx*r.depth; p[i*3 + 2] += r.nz*r.depth;
    q[i*3] = p[i*3] - (p[i*3] - q[i*3] - r.nx*r.depth)*0.3; q[i*3 + 2] = p[i*3 + 2] - (p[i*3 + 2] - q[i*3 + 2] - r.nz*r.depth)*0.3;
  }
  if (r && r.depth > 0) { B.c[0] += r.nx*r.depth; B.c[2] += r.nz*r.depth; }
  // where it's drawn from: the point between the tyres
  _v.set(B.cl[0], B.cl[1], B.cl[2]).applyQuaternion(B.Q);
  B.ox = B.c[0] - _v.x; B.oy = B.c[1] - _v.y; B.oz = B.c[2] - _v.z;
  // still: lying where it ended up
  // (by how far it's moved and turned since last time: the points themselves keep a millimetre's give against the road)
  const L = B.last || (B.last = { c: B.c.slice(), Q: B.Q.clone() });
  const mv = (Math.hypot(B.c[0] - L.c[0], B.c[1] - L.c[1], B.c[2] - L.c[2]) + L.Q.angleTo(B.Q)*0.6)/Math.max(dt, 1e-4);
  L.c[0] = B.c[0]; L.c[1] = B.c[1]; L.c[2] = B.c[2]; L.Q.copy(B.Q);
  B.calm = mv < 0.05 ? B.calm + dt : 0;
  if ((B.calm > 0.4 && B.t > 0.6) || B.t > 9) B.rest = true;
}

// how far over it is (0 upright, pi upside down), and which way its top points on the road
export function lie(B) {
  const u = _v.set(0, 1, 0).applyQuaternion(B.Q), h = Math.hypot(u.x, u.z) || 1;
  return { ang: Math.acos(Math.max(-1, Math.min(1, u.y))), ux: u.x/h, uz: u.z/h };
}
