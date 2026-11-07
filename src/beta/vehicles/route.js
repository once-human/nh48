// The way to a vehicle's door, round it and never through it. You walk to a corner and along the side if the straight
// line would cross the car, whichever way round is shorter and clear; a long way round you jog it, and any key you
// press on the way calls it off. (Every way in uses this: car doors, autos and buses, two-wheelers, the driver's cab.)
import { Pilot } from '@orig/game/pilot.js';
import { free } from './mount.js';

const hits = (a0, r0, a1, r1, A, R) => {
  let t0 = 0, t1 = 1;
  for (const [p, d, h] of [[a0, a1 - a0, A], [r0, r1 - r0, R]]) {
    if (Math.abs(d) < 1e-6) { if (Math.abs(p) >= h) return false; continue; }
    let u = (-h - p)/d, v = (h - p)/d;
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    if (t0 >= t1) return false;
  }
  return true;
};

// the points to walk through on the way to `to` (not counting it), and how far it all is; null if there's no way round
export function routeTo(P, traffic, src, S, to) {
  const F = P.foot, hx = src.hx ?? Math.cos(src.th), hz = src.hz ?? Math.sin(src.th);
  const al = (x, z) => (x - src.x)*hx + (z - src.z)*hz, ac = (x, z) => -(x - src.x)*hz + (z - src.z)*hx;
  const L = (S && S.L) || 4, W = (S && S.W) || 1.7;
  const tA = al(to.x, to.z), tR = ac(to.x, to.z);
  // (a spot right against the vehicle, as by a bike's seat, isn't inside the box you walk round)
  const A = Math.min(L/2 + 0.2, Math.max(Math.abs(tA) - 0.03, L/2)), R = Math.min(W/2 + 0.2, Math.max(Math.abs(tR) - 0.03, W/2));
  const N = [{ x: F.x, z: F.z }, { x: to.x, z: to.z }];
  const direct = Math.hypot(to.x - F.x, to.z - F.z);
  if (!hits(al(F.x, F.z), ac(F.x, F.z), tA, tR, A, R)) return { route: [], len: direct };
  for (const a of [-1, 1]) for (const r of [-1, 1]) {
    const ca = a*(L/2 + 0.62), cr = r*(W/2 + 0.62), x = src.x + hx*ca - hz*cr, z = src.z + hz*ca + hx*cr;
    if (free(P, traffic, x, z, src)) N.push({ x, z });
  }
  const clear = (p, q) => {
    if (hits(al(p.x, p.z), ac(p.x, p.z), al(q.x, q.z), ac(q.x, q.z), A, R)) return false;
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    for (let s = 0.6; s < d - 0.4; s += 0.8) if (!free(P, traffic, p.x + (q.x - p.x)*s/d, p.z + (q.z - p.z)*s/d, src)) return false;
    return true;
  };
  // shortest way through the corners
  const dist = N.map(() => Infinity), from = N.map(() => -1), seen = N.map(() => false);
  dist[0] = 0;
  for (let n = 0; n < N.length; n++) {
    let u = -1;
    for (let i = 0; i < N.length; i++) if (!seen[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break;
    seen[u] = true;
    for (let i = 0; i < N.length; i++) {
      if (seen[i]) continue;
      const d = dist[u] + Math.hypot(N[i].x - N[u].x, N[i].z - N[u].z);
      if (d < dist[i] && clear(N[u], N[i])) { dist[i] = d; from[i] = u; }
    }
  }
  if (dist[1] === Infinity) return null;
  const route = [];
  for (let i = from[1]; i > 0; i = from[i]) route.unshift(N[i]);
  return { route, len: dist[1] };
}

// start walking it: M is whichever scene's state, `goal` its last point (the puppet it would have walked to straight)
export function setRoute(P, M, r, goal) {
  M.route = r ? r.route.slice() : []; M.goal = goal; M.jog = !!r && r.len > 3.5;
  P.puppet = M.route[0] || goal;
  P.puppet.jog = M.jog;
  return r ? r.len : Math.hypot(goal.x - P.foot.x, goal.z - P.foot.z);
}
// how long that takes, with a little to spare
export const walkTime = (M, len) => len/(M.jog ? 2.4 : 1.3) + 1.6;
// on along it, each frame of the walk
export function follow(P, M) {
  const F = P.foot, r = M.route;
  if (r && r.length && Math.hypot(F.x - r[0].x, F.z - r[0].z) < 0.6) { r.shift(); P.puppet = r[0] || M.goal; }
  // the last steps to the door you walk
  if (P.puppet) P.puppet.jog = M.jog && (r && r.length > 0 || Math.hypot(F.x - M.goal.x, F.z - M.goal.z) > 1.3);
}
// never got there (a wall, a crowd): you don't slide the rest of the way
export const tooFar = (P, goal) => Math.hypot(P.foot.x - goal.x, P.foot.z - goal.z) > 0.9;

// a key pressed since you set off calls it off (one you were already holding doesn't)
const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
export function calledOff(P, M) {
  const I = P._footInput; if (!I) return false;
  if (!M.held) { M.held = new Set(KEYS.filter(k => I.key(k))); return false; }
  for (const k of KEYS) {
    if (!I.key(k)) M.held.delete(k);
    else if (!M.held.has(k)) return true;
  }
  return false;
}
const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, input, ...a) { this._footInput = input; return upd.call(this, dt, input, ...a); };
