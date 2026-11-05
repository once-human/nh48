// Someone you talk to, doing something. Sat down (on a chair, a sofa, a bench, the floor at a temple): they stay sat,
// facing the way the seat faces, and turn to you from the waist, the neck and the eyes, as far as a body turns that way
// (draw/alive.js does the turning), never the whole body round on the seat. On their feet (dancing, at the bar, behind a
// counter, waiting at a spot): they turn to you, not in a snap, and when you're done they turn back and carry on with
// what they were doing, where they were doing it. Walking somewhere: they stop, turn, and go on their way after.
import { People } from '@orig/people/peds.js';

const SEATED = /^(sit|lie|sleep|squat|pray|crouch)/;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// sat (or lying) somewhere: the body stays as it is
export const seated = (p) => !!p && (p.seated || SEATED.test(p.anim || '') || (p.fixed && SEATED.test(p.idle || '')));
// on the move: nothing to come back to but the path
const MOVING = new Set(['walk', 'cross', 'flee', 'fight', 'chase', 'watch', 'free', 'follow', 'inside']);

const watch = People.prototype.watch;
People.prototype.watch = function (p, x, z, secs, ...a) {
  if (seated(p)) {
    const A = p.attend || (p.attend = { yaw: p.yaw, anim: p.anim, idle: p.idle });
    A.x = x; A.z = z; A.t = secs;
    return;
  }
  if (!p._was && !MOVING.has(p.mode)) p._was = { mode: p.mode, anim: p.anim, idle: p.idle, anchor: p.anchor, anchorNext: p.anchorNext, wait: p.wait, yaw: p.yaw };
  // (whatever snaps their yaw round straight after this is undone on the next update: they turn, at a body's pace)
  if (p._yaw0 === undefined) p._yaw0 = p.yaw;
  return watch.call(this, p, x, z, secs, ...a);
};
// back to it: what they were doing, facing the way they faced
const back = People.prototype.backToPath;
People.prototype.backToPath = function (p) {
  const w = p._was;
  if (!w) return back.call(this, p);
  p._was = null;
  p.mode = w.mode; p.anim = w.anim; p.idle = w.idle; p.anchor = w.anchor; p.anchorNext = w.anchorNext; p.wait = Math.max(w.wait || 0, 6);
  p.watch = null; p.turnBack = w.yaw;
};

const upd = People.prototype.update;
People.prototype.update = function (dt, ...a) {
  for (const p of this.list) if (p._yaw0 !== undefined) { p.yaw = p._yaw0; p._yaw0 = undefined; }
  const out = upd.call(this, dt, ...a);
  const G = window.__nhAskG, talking = G && G.talkUI && G.talkUI.cur && G.talkUI.cur.p;
  for (const p of this.list) {
    const A = p.attend;
    if (A) {
      // sat still: the seat's way, the sitting pose; only the look (draw/alive.js) is yours
      p.yaw = A.yaw; p.anim = A.anim; p.idle = A.idle; p.v = 0;
      if (talking !== p) A.t = Math.min(A.t, 1.2);
      A.t -= dt;
      if (A.t <= 0) p.attend = null;
    }
    if (p.turnBack !== undefined) {
      const d = wrap(p.turnBack - p.yaw);
      if (Math.abs(d) < 0.02 || MOVING.has(p.mode) || (p.anchor && p.anchor.fx !== undefined)) p.turnBack = undefined;
      else p.yaw += d*Math.min(1, dt*3.5);
    }
  }
  return out;
};
