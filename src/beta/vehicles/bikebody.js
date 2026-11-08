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
import { carSpec, baseOf } from './models.js';

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

// A car, an auto, a tempo and a bus are built the same way, from the numbers their bodies are drawn from: the tyres
// where they touch the road, the outsides of the wheels, the bumpers' corners low down, the sills, the belt line and
// the shoulders at the screen, the roof's corners, and the weight low in the middle: the engine where it sits (under
// the bonnet, behind an auto's seat, at a bus's back), the floor and the axles. So each sits on its own tyres, rolls
// over its own shoulders and comes to rest on its own roof. A car's weight is low and its tyres wide apart; an auto's
// one front wheel leaves it a narrow triangle to stand on, so it goes over at a push; a bus is wide and heavy at the
// floor and all but never does.
function carShape(type) {
  const S = carSpec(type), k = baseOf(type), hl = S.L/2, hw = S.W/2, xw = hl - S.overhang, tw = hw - 0.12, R = S.R, H = S.H, belt = S.beltY, sill = S.sill;
  const xf0 = hl - S.hood, rw = hw*0.74, deck = belt - (S.tail > 0.3 ? 0.03 : 0.06), p = [];
  // (where the engine is: under the bonnet; behind the seats in the coupé; in the middle of the supercar)
  const ex = k === 'sports' ? -hl + 0.75 : k === 'super' ? -0.65 : xf0 + S.hood*0.45;
  for (const x of [xw, -xw]) for (const s of [-1, 1]) p.push([x, 0, s*tw, 0.8, 1], [x, R, s*(hw - 0.01), 0.3, 0], [x + R*0.85, R*0.5, s*tw, 0.15, 0], [x - R*0.85, R*0.5, s*tw, 0.15, 0]);
  for (const s of [-1, 1]) p.push(
    [hl - 0.04, sill + 0.12, s*(hw - 0.1), 0.6, 0], [-hl + 0.04, sill + 0.12, s*(hw - 0.1), 0.6, 0],        // the bumpers' corners
    [0, sill, s*(hw - 0.04), 0.8, 0],                                                                        // the sills
    [hl - 0.08, belt - 0.06, s*(hw - 0.08), 0.5, 0], [xf0, belt, s*hw, 0.5, 0], [0, belt, s*hw, 0.5, 0], [-hl + 0.08, deck, s*(hw - 0.08), 0.5, 0],
    [S.roofF, H - 0.02, s*rw, 0.4, 0], [(S.roofF + S.roofR)/2, H, s*rw, 0.4, 0], [S.roofR, H - 0.03, s*rw, 0.4, 0]);
  p.push([ex, 0.45, 0, 6, 0], [-0.15, sill + 0.1, 0, 6, 0]);
  return p;
}
function autoShape() {
  const p = [[1.0, 0, 0, 0.8, 1], [1.0, 0.21, 0.07, 0.2, 0], [1.0, 0.21, -0.07, 0.2, 0], [1.21, 0.1, 0, 0.1, 0]];
  for (const s of [-1, 1]) p.push(
    [-0.98, 0, s*0.58, 0.8, 1], [-0.98, 0.21, s*0.66, 0.3, 0],
    [1.3, 0.35, s*0.3, 0.5, 0], [1.25, 0.95, s*0.36, 0.4, 0],                                // the nose and the dash
    [0.5, 0.3, s*0.6, 0.6, 0], [-1.35, 0.3, s*0.62, 0.6, 0],                                 // the floor's edges
    [0.5, 0.75, s*0.6, 0.5, 0], [-0.3, 0.74, s*0.66, 0.5, 0], [-1.35, 0.74, s*0.66, 0.5, 0], // the tub
    [0.75, 1.72, s*0.62, 0.3, 0], [-0.3, 1.75, s*0.66, 0.3, 0], [-1.3, 1.7, s*0.66, 0.3, 0]); // the canopy
  p.push([-0.96, 0.32, 0, 5, 0], [-0.2, 0.3, 0, 4, 0]);
  return p;
}
function tempoShape() {
  const p = [];
  for (const x of [1.25, -1.2]) for (const s of [-1, 1]) p.push([x, 0, s*0.625, 0.8, 1], [x, 0.32, s*0.76, 0.3, 0]);
  for (const s of [-1, 1]) p.push(
    [1.88, 0.45, s*0.72, 0.6, 0], [1.85, 1.0, s*0.74, 0.4, 0], [1.6, 1.85, s*0.68, 0.4, 0], [0.9, 1.85, s*0.7, 0.4, 0], [0.9, 0.45, s*0.74, 0.5, 0],   // the cab
    [-1.88, 0.6, s*0.76, 0.6, 0], [-1.88, 1.15, s*0.77, 0.4, 0], [-0.5, 1.15, s*0.77, 0.3, 0], [0.85, 1.15, s*0.77, 0.3, 0], [-0.5, 0.6, s*0.76, 0.5, 0]);   // the bed
  p.push([1.1, 0.5, 0, 6, 0], [-0.3, 0.55, 0, 6, 0]);
  return p;
}
function busShape() {
  const p = [];
  for (const x of [3.3, -2.7]) for (const s of [-1, 1]) p.push([x, 0, s*1.025, 1, 1], [x, 0.5, s*1.27, 0.4, 0]);
  for (const s of [-1, 1]) for (const x of [5.65, 0, -5.65]) p.push([x, 0.42, s*1.26, 0.6, 0], [x, 1.3, s*1.27, 0.5, 0], [x*0.99, 3.12, s*1.2, 0.4, 0]);
  for (const s of [-1, 1]) for (const x of [2.8, -2.8]) p.push([x, 3.15, s*1.22, 0.3, 0]);
  p.push([0, 0.6, 0, 14, 0], [-4.8, 0.8, 0, 8, 0]);
  return p;
}
export const isTwo = (type) => /^(cycle|bike|bullet|superbike|scooter)/.test(type);
export function shapePts(type) {
  if (isTwo(type)) return SHAPES[shapeOf(type)]();
  return /^auto/.test(type) ? autoShape() : /^tempo/.test(type) ? tempoShape() : /^bus/.test(type) ? busShape() : carShape(type);
}
// What it takes to put it over: its weight's height, how far its weight is from the edge it stands on (the line
// through its tyres on that side, or for an auto the line from its front wheel to a back one), and how hard it is to
// turn about that edge. Per kilo, so it's the same sum whatever it weighs.
const TIPS = new Map();
export function tipOf(type) {
  let T = TIPS.get(type); if (T) return T;
  const pts = shapePts(type);
  let M = 0, cx = 0, cy = 0, cz = 0;
  for (const [x, y, z, m] of pts) { M += m; cx += x*m; cy += y*m; cz += z*m; }
  cx /= M; cy /= M; cz /= M;
  let kg = 0; for (const [, y, z, m] of pts) kg += m*((y - cy)**2 + (z - cz)**2); kg /= M;
  const hull = pts.filter(q => q[4]).map(q => [q[0], q[2]]).sort((a, b) => Math.atan2(a[1] - cz, a[0] - cx) - Math.atan2(b[1] - cz, b[0] - cx));
  T = { h: cy, kg2: kg, cx, cz, hull, L: Math.max(...pts.map(q => Math.abs(q[0]))), W: Math.max(...pts.map(q => Math.abs(q[2]))) };
  TIPS.set(type, T);
  return T;
}
// the edge it would go over toward side s (+1 its right): the hull's side the line across it meets, how far the weight
// is from it, and where on it
export function edgeOf(T, s) {
  const { hull, cx, cz } = T, n = hull.length;
  for (let i = 0; i < n; i++) {
    const a = hull[i], b = hull[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1];
    // where the line from the weight straight across (x = cx, z going s) crosses this edge
    if (Math.abs(ex) < 1e-6) continue;
    const t = (cx - a[0])/ex; if (t < 0 || t > 1) continue;
    const z = a[1] + ez*t; if ((z - cz)*s <= 0) continue;
    const L = Math.hypot(ex, ez), d = Math.abs((cx - a[0])*ez - (cz - a[1])*ex)/L;
    return { d, x: cx, z };
  }
  return { d: T.W*0.8, x: cx, z: cz + s*T.W*0.8 };
}

const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();

// Q0, at (ox, oy, oz) (the point on the road between the tyres, as it's drawn), moving at vel and turning at om (world)
export function makeBody(type, Q0, ox, oy, oz, vel, om) {
  const B = makePts(shapePts(type), Q0, ox, oy, oz, vel, om);
  if (!isTwo(type)) { const T = tipOf(type); B.reach = Math.max(0, T.L - T.W); B.rad = T.W*0.95; B.tmax = 25; }
  return B;
}
// any solid thing from its points ([x, y, z, weight, 1 for a tyre's foot]), (ox, oy, oz) where its own (0, 0, 0) is
export function makePts(pts, Q0, ox, oy, oz, vel, om) {
  const n = pts.length;
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
  const { n, p, q, tyre } = B, gh = B.gh;
  let fx = 0, fz = 0, up = 0;
  if (rub) { _v.set(1, 0, 0).applyQuaternion(B.Q); fx = _v.x; fz = _v.z; const h = Math.hypot(fx, fz) || 1; fx /= h; fz /= h; up = _w.set(0, 1, 0).applyQuaternion(B.Q).y; }
  for (let i = 0; i < n; i++) {
    const g = gh ? gh[i] : gy, pen = g - p[i*3 + 1]; if (pen <= 0) continue;
    const vy = p[i*3 + 1] - q[i*3 + 1];
    if (-vy/DT > B.imp) { B.imp = -vy/DT; B.impI = i; }        // (how hard it came down, and where on it)
    p[i*3 + 1] = g;
    if (!rub) { if (q[i*3 + 1] < gy) q[i*3 + 1] = gy; continue; }
    q[i*3 + 1] = g + (vy < 0 ? vy*0.12 : 0);             // a little bounce, no more
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

// on by dt. gy: the road under it (a height, or the height at (x, z) under each of its points); wall(x, z): how far
// to push it out of a wall, or null
export function stepBody(B, dt, gy, wall) {
  if (B.rest) return;
  B.acc = Math.min(B.acc + dt, DT*8);
  const { n, p, q } = B;
  B.imp = 0; B.impI = -1; B.wallHit = 0;
  if (typeof gy === 'function') { const gh = B.gh || (B.gh = new Float64Array(n)); for (let i = 0; i < n; i++) gh[i] = gy(p[i*3], p[i*3 + 2]); }
  while (B.acc >= DT) {
    B.acc -= DT; B.t += DT;
    for (let i = 0; i < n*3; i++) { const v = (p[i] - q[i])*0.9995; q[i] = p[i]; p[i] += v; }
    for (let i = 1; i < n*3; i += 3) p[i] -= G*DT*DT;
    for (let k = 0; k < 3; k++) { road(B, gy, true); match(B); }
  }
  // something long (a car, a bus): along its length, the nose, the middle and the tail each out of a wall; what's going
  // into it stops, what's going along it scrapes
  if (B.reach && wall) {
    _v.set(1, 0, 0).applyQuaternion(B.Q); const h = Math.hypot(_v.x, _v.z), fx = h > 0.2 ? _v.x/h : 0, fz = h > 0.2 ? _v.z/h : 0;
    for (const u of h > 0.2 ? [B.reach, 0, -B.reach] : [0]) {
      const r = wall(B.c[0] + fx*u, B.c[2] + fz*u); if (!r || !(r.depth > 0) || r.kind === 3 || r.kind === 4) continue;
      let vx = 0, vz = 0; for (let i = 0; i < n; i++) { vx += p[i*3] - q[i*3]; vz += p[i*3 + 2] - q[i*3 + 2]; } vx /= n; vz /= n;
      const vn = vx*r.nx + vz*r.nz, sx = vn < 0 ? -vn*r.nx : 0, sz = vn < 0 ? -vn*r.nz : 0, tx = vx + sx, tz = vz + sz;
      B.wallHit = Math.max(B.wallHit, -vn/DT);
      for (let i = 0; i < n; i++) {
        const dx = p[i*3] - q[i*3] + sx - tx*0.1, dz = p[i*3 + 2] - q[i*3 + 2] + sz - tz*0.1;
        p[i*3] += r.nx*r.depth; p[i*3 + 2] += r.nz*r.depth; q[i*3] = p[i*3] - dx; q[i*3 + 2] = p[i*3 + 2] - dz;
      }
      B.c[0] += r.nx*r.depth; B.c[2] += r.nz*r.depth;
    }
  }
  // a wall: out of it, and most of the way it was going stopped
  const r = !B.reach && wall && wall(B.c[0], B.c[2]);
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
  if ((B.calm > 0.4 && B.t > 0.6) || B.t > (B.tmax || 9)) B.rest = true;
}
// how fast it's going (its middle), m/s
export function bodyVel(B) {
  const { n, p, q, m, M } = B; let vx = 0, vy = 0, vz = 0;
  for (let i = 0; i < n; i++) { vx += (p[i*3] - q[i*3])*m[i]; vy += (p[i*3 + 1] - q[i*3 + 1])*m[i]; vz += (p[i*3 + 2] - q[i*3 + 2])*m[i]; }
  return [vx/M/DT, vy/M/DT, vz/M/DT];
}
// a blow to it as it moves or lies: vel more on its middle, om more turning (world), and it's moving again
export function kickBody(B, vel, om = [0, 0, 0]) {
  const { n, p, q, c } = B;
  for (let i = 0; i < n; i++) {
    const rx = p[i*3] - c[0], ry = p[i*3 + 1] - c[1], rz = p[i*3 + 2] - c[2];
    q[i*3] -= (vel[0] + om[1]*rz - om[2]*ry)*DT; q[i*3 + 1] -= (vel[1] + om[2]*rx - om[0]*rz)*DT; q[i*3 + 2] -= (vel[2] + om[0]*ry - om[1]*rx)*DT;
  }
  B.rest = false; B.calm = 0; B.t = Math.min(B.t, 1); B.last = null;
}
// where its point i is on the thing as it's built (x forward, y up, z right)
export function ptOf(B, i) { return [B.r[i*3] + B.cl[0], B.r[i*3 + 1] + B.cl[1], B.r[i*3 + 2] + B.cl[2]]; }

// how far over it is (0 upright, pi upside down), and which way its top points on the road
export function lie(B) {
  const u = _v.set(0, 1, 0).applyQuaternion(B.Q), h = Math.hypot(u.x, u.z) || 1;
  return { ang: Math.acos(Math.max(-1, Math.min(1, u.y))), ux: u.x/h, uz: u.z/h };
}
