// Traffic drives sideways the way a vehicle can: by steering while it rolls. A lane change, a swerve round a slow
// one, an edge aside for your horn used to move a vehicle straight sideways at a fixed rate, stopped or not, its nose
// still pointing down the road (they slid left and right like a cursor, and a stopped one could crab out of a jam).
// Now how far it can move across the road is tied to how far it moves along it, and it turns its nose into the move
// (and out again). Never past the kerb onto the footpath: its own width is kept on the carriageway.
//
// Blocked (you've stopped in front of it, or a wreck, or a fallen bike) it does what a driver does: backs up a little
// if there's room behind, then pulls out round you while creeping forward, back and forth again if one go isn't
// enough, on the far side of you if this side's taken; never into the vehicles round it.
import { Traffic } from '@orig/traffic/traffic.js';

const MAXD = 0.32;          // the most yaw a lane change turns the nose (rad)
const step = Traffic.prototype.step;
Traffic.prototype.step = function (v, dt) {
  if (!(dt > 0) || !v.T) return step.call(this, v, dt);
  if (v._dy) { v.yaw -= v._dy; }              // (the nose turn from last frame off, the sim's own heading back)
  const s0 = v.s, lat0 = v.lat, l0 = v.l, jc0 = v.jc;
  step.call(this, v, dt);
  let dy = 0;
  if (!v.jc && !jc0 && v.l === l0 && v.alive) {
    const T = v.T, e = v.l.e, two = !!T.two;
    // the carriageway with this vehicle's width on it (the far side allowed only to squeeze past, as the sim does)
    const hi = Math.max(0.3, e.w/2 - T.W/2 - 0.12), lo = -hi;
    const ds = v.s - s0;
    // how far across it may have moved: about a third of the way along for a car, half for a two-wheeler, a little
    // even stopped (a rider walks it over), none for a car standing still
    const k = two ? 0.5 : 0.34, room = Math.abs(ds)*k + (two ? 0.15*dt : 0);
    let dl = v.lat - lat0;
    if (Math.abs(dl) > room) dl = Math.sign(dl)*room;
    if (v._out) dl = manoeuvre(this, v, dt, lat0, lo, hi);
    let lat = Math.max(lo, Math.min(hi, lat0 + dl));
    if (v.latT !== undefined) v.latT = Math.max(lo, Math.min(hi, v.latT));
    if (lat !== v.lat) { const m = lat - v.lat; v.lat = lat; v.x += v.hz*m; v.z -= v.hx*m; }
    // the nose into the move: (hz, -hx) is +lat (the driver's left), so moving that way turns it left
    const sp = (v.s - s0)/dt, lv = (v.lat - lat0)/dt;
    const want = Math.abs(lv) > 0.01 ? Math.max(-MAXD, Math.min(MAXD, -Math.atan(lv/(Math.sign(sp || 1)*Math.max(0.4, Math.abs(sp)))))) : 0;
    v._dyS = (v._dyS || 0) + (want - (v._dyS || 0))*Math.min(1, dt*6);
    dy = v._dyS;
    if (!v._out && Math.abs(v.x - this.cam.x) < 90 && Math.abs(v.z - this.cam.z) < 90) watch(this, v, dt);     // (near you: that's where it's seen)
  } else v._dyS = 0, v._out = null;
  v._dy = dy; v.yaw += dy;
};

// what's in front of it, and whether it's something that won't move (you, stopped; a wreck; a fallen bike)
function blocker(TR, v) {
  const ob = TR.scan(v, 0, 7);
  if (!ob || ob.gap > 2.6) return null;
  const a = ob.agent;
  const still = a.isPlayer ? Math.abs(a.v || 0) < 0.4 : a.wreck || a.fallen > 0 || (a.parked && !a.T);
  return still ? ob : null;
}
function watch(TR, v, dt) {
  const ob = v.v < 0.35 ? blocker(TR, v) : null;
  v._blk = ob ? (v._blk || 0) + dt : Math.max(0, (v._blk || 0) - dt*2);
  if (ob) v.stuck = 0;                         // (not the sim's own unjamming: that drives through you)
  if (v._blk < 1.4 + (v.id % 7)*0.15) return;
  const side = pickSide(TR, v, ob);
  v._blk = 0;
  if (side === 0) { v._blk = -4; return; }     // boxed in: wait (and honk) a while, then look again
  v._out = { phase: backRoom(TR, v) > 0.6 ? 'back' : 'out', side, n: 0, d: 0, ob: ob.agent, target: v.lat + ob.side + side*(v.T.W/2 + halfW(ob.agent) + 0.35) };
}
const halfW = (a) => (a.W ?? a.T?.W ?? 1.8)/2;
// which way round: past its right (toward the middle of the road) first, as people overtake here, else its left
function pickSide(TR, v, ob) {
  const e = v.l.e, hi = Math.max(0.3, e.w/2 - v.T.W/2 - 0.12);
  for (const side of [-1, 1]) {
    const t = v.lat + ob.side + side*(v.T.W/2 + halfW(ob.agent) + 0.35);
    if (t < -hi || t > hi) continue;
    const o2 = TR.scan(v, t - v.lat, 9);
    if (!o2 || o2.agent === ob.agent || o2.gap > 4) return side;
  }
  return 0;
}
// how far it can back up before the one behind it
function backRoom(TR, v) {
  let room = 3;
  TR.near(v.x - v.hx*4, v.z - v.hz*4, 6, (o) => {
    if (o === v) return;
    const rx = o.x - v.x, rz = o.z - v.z, al = rx*v.hx + rz*v.hz, sd = -rx*v.hz + rz*v.hx;
    if (al >= 0) return;
    const ow = o.W ?? o.T?.W ?? 0.8, oL = o.L ?? o.T?.L ?? 2;
    if (Math.abs(sd) > v.T.W/2 + ow/2 + 0.2) return;
    room = Math.min(room, -al - v.T.L/2 - oL/2 - 0.4);
  });
  return room;
}
// back a little, then out round it creeping forward; again if that wasn't enough. Returns the move across the road.
function manoeuvre(TR, v, dt, lat0, lo, hi) {
  const O = v._out, T = v.T, two = !!T.two, target = Math.max(lo, Math.min(hi, O.target)), left = target - lat0;
  v.stuck = 0;
  if (Math.abs(left) < 0.08 || O.n > 4) { v._out = null; v.latT = target; return left; }
  if (O.phase === 'back') {
    const sp = two ? 0.9 : 1.3, d = sp*dt;
    if (backRoom(TR, v) < 0.15 || O.d > (two ? 1.2 : 2.2)) { O.phase = 'out'; O.d = 0; return 0; }
    v.s = Math.max(0.1, v.s - d); O.d += d; v.v = 0;
    TR.place(v, 0);
    // reversing with the wheel over, the tail swings away from where it's heading next: a little of the move now
    return Math.sign(left)*Math.min(Math.abs(left), d*(two ? 0.45 : 0.28));
  }
  // out: forward at a crawl, steering round, as long as there's room in front where it's heading
  const ahead = TR.scan(v, Math.sign(left)*Math.min(Math.abs(left), T.W/2), 4);
  if (ahead && ahead.gap < 0.3) { O.phase = 'back'; O.d = 0; O.n++; return 0; }
  const sp = two ? 1.6 : 1.2, d = sp*dt;
  v.s += d; v.v = sp; O.d += d;
  TR.place(v, 0);
  v.latT = target;
  return Math.sign(left)*Math.min(Math.abs(left), d*(two ? 0.6 : 0.45));
}
