// In and out of a shop through its door. Someone popping into a shop used to vanish on the step outside it, and came
// back out of nowhere on the same step half a minute later. Now they walk in over the threshold, into the shop, and
// only then are they inside (out of sight, with no body); coming out, they step out of the shop's dark onto the
// footpath and carry on. (The door is a point a little out from the shop front; d.nx, d.nz face the street.)
//   A shop you can walk into yourself (world/shopin.js: the door has the shop's cell) is a room they walk into too:
// through the open front, up to the counter or a shelf, and they stand there in plain sight while they're inside,
// then walk back out the way they came.
import { People } from '@orig/people/peds.js';

const IN = 0.95, OUT = 0.35, SP = 1.15;
// a point of the cell (u along the front from its left, d inward negative) in the world, and back
const at = (S, u, d) => { const F = S.F, U = S.a + u; return [F.ax + F.tx * U + F.nx * d, F.az + F.tz * U + F.nz * d]; };
const local = (S, x, z) => { const F = S.F, dx = x - F.ax, dz = z - F.az; return [dx * F.tx + dz * F.tz - S.a, dx * F.nx + dz * F.nz]; };
const walkIn = (d) => { const S = d && d.cell; return S && S.F && S.plan && S.hole && S.hole.on ? S : null; };

People.prototype.thruDoor = function (p, d, entering) {
  // (going in: only through a front that's open; coming out of one they went into: the way they came, whatever
  // the shutter's doing)
  const S = entering ? walkIn(d) : p._inCell && d && d.cell && d.cell.F ? d.cell : null;
  let pts;
  if (S) {
    // in by the doorway (the part of the open front nearest them), up to where they'll stand; out the same way
    const P = S.plan, [u] = local(S, p.x, p.z), du = Math.max(P.door[0] + 0.3, Math.min(P.door[1] - 0.3, u));
    if (entering) {
      const b = P.browse.length ? P.browse[(Math.random() * P.browse.length) | 0] : P.spot ? [P.spot.u, P.spot.d + 0.3] : [P.w / 2, -0.8];
      const tu = Math.max(0.35, Math.min(P.w - 0.35, b[0] + (Math.random() - 0.5) * 0.5)), td = Math.min(-0.4, b[1]);
      pts = [[p.x, p.z], at(S, du, 0.3), at(S, du, -0.35), at(S, tu, td)];
    } else pts = [[p.x, p.z], at(S, du, -0.35), at(S, du, 0.3), [d.x + d.nx * OUT, d.z + d.nz * OUT]];
  } else {
    pts = entering ? [[p.x, p.z], [d.x - d.nx * IN, d.z - d.nz * IN]] : [[d.x - d.nx * IN, d.z - d.nz * IN], [d.x + d.nx * OUT, d.z + d.nz * OUT]];
  }
  p._inCell = false;
  p._thru = { pts, i: 0, t: 0, T: legT(pts, 0), entering, d, cell: !!(S && entering) };
  p.hidden = false; p.x = pts[0][0]; p.z = pts[0][1]; p.v = SP; face(p, pts, 0);
};
const legT = (pts, i) => Math.max(0.15, Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) / SP);
function face(p, pts, i) { const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1]; if (Math.hypot(dx, dz) < 1e-3) return; p.yaw = Math.atan2(dz, dx); p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw); }
const step = People.prototype.step;
People.prototype.step = function (p, dt, ...a) {
  const S = p._thru;
  if (!S) return step.call(this, p, dt, ...a);
  // knocked down, grabbed, in a fight on the way: off the doorstep and back to whatever's happening
  if (p.fallen > 0 || p.ko || p.dead || p.lift || p.mode === 'fight' || p.ctl) { p._thru = null; p._inCell = false; if (p.mode === 'inside') { if (S.entering && S.d) S.d.n--; p.door = null; p.mode = 'walk'; this.backToPath(p); } return step.call(this, p, dt, ...a); }
  S.t += dt;
  const A = S.pts[S.i], B = S.pts[S.i + 1], k = Math.min(1, S.t / S.T);
  p.x = A[0] + (B[0] - A[0]) * k; p.z = A[1] + (B[1] - A[1]) * k; p.v = SP;
  if (k < 1) return;
  if (S.i + 2 < S.pts.length) { S.i++; S.t = 0; S.T = legT(S.pts, S.i); face(p, S.pts, S.i); return; }
  p._thru = null;
  // in a room you can see into: standing there, facing the counter, till they've done
  if (S.cell) { p.v = 0; p._inCell = true; const F = S.d.cell.F; p.yaw = Math.atan2(-F.nz, -F.nx); p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw); return; }
  if (S.entering) { p.hidden = true; p.v = 0; }
  else { p.v = 0; this.backToPath(p); }
};
