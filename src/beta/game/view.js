// Two views, on foot and in a vehicle alike: third person or first person, C (or V) to switch. The game had three in a
// vehicle (chase, far chase, seat): the far one was only a distance, and the FOV setting already does that. Each view is
// remembered on its own, so you're back on foot the way you walk and back at the wheel the way you drive.
import * as THREE from 'three';
import { CameraRig } from '@orig/game/camera.js';
import { clamp } from '@orig/core/util.js';

const KEY = 'nh48b_view';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
const save = (R) => { try { localStorage.setItem(KEY, JSON.stringify({ foot: R.footFP ? 1 : 0, drive: R.mode })); } catch (e) { /* private window */ } };
const R = CameraRig.prototype, upd = R.update, updFoot = R.updateFoot, drag = R.drag;

// 0 third person, 2 first person (the driver's seat); asked for the next one, it's the other
R.setMode = function (m) { m = ((m % 3) + 3) % 3; this.mode = m === 1 ? 2 : m; this.inited = false; if (this._pl) save(this); };
R.toggleView = function (onFoot) {
  if (onFoot) { this.footFP = !this.footFP; this.inited = false; save(this); }
  else this.setMode(this.mode + 1);
};
// ---------------------------------------------------------------- the camera behind you, one for everything
// On foot and behind a vehicle it's the same camera: it circles a point (your chest, or just ahead of the car's middle)
// at a distance and a height, facing a way. Getting into a car doesn't change cameras: the point it circles goes from
// you to the car, it draws back to the car's distance over a second, and it stays facing the way it was. It comes
// round behind the car only as the car pulls away (stood still it stays where you left it, and wherever you've turned
// it with the mouse). Nothing is ever flown through, so nothing ever goes dark on the way.
// Behind a vehicle it does what a chase camera on a good racing game does: follows the way the car is GOING more than
// the way it points, so a slide shows as the car turning in front of you; eases back a little under power and in under
// the brakes; looks a little into the bend and leans a degree or two with it; trembles faintly at real speed.
const ease = (t) => t*t*t*(t*(t*6 - 15) + 10);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dmp = (a, b, k, dt) => a + (b - a)*(1 - Math.exp(-k*dt));
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const kind = (R_, p) => p.onFoot ? (R_.preview ? 'mirror' : R_.footFP && !p.seated ? 'eyes' : 'foot') : R_.mode === 2 && p.cockpitEye ? 'seat' : 'chase';
const own = (k) => k === 'eyes' || k === 'seat';
// what it's asked for (T), in this order: the point circled (x, y, z), how far back, how far above, the look's shift to
// the side, ahead and up from that point, the width of the view
function third(R_, dt, p, k) {
  const S = R_._tp || (R_._tp = { q: new Float64Array(9), o: new Float64Array(9), T: new Float64Array(9), t: 1, yaw: 0, pull: 1, roll: 0, acc: 0, yr: 0, pv: 0, pth: 0, kind: '', live: false, since: 9, ph: 0, y: null });
  const T = S.T, cam = R_.cam, W = R_.W, veh = k === 'chase', sp = Math.abs(p.v || 0);
  let yawWant, yawK;
  p.setCockpit && p.setCockpit(false);
  R_.setNear(veh ? 0.3 : 0.1);
  if (veh) {
    R_.footMode = false;
    const th = p.th, big = p.camDist || 0, g = 1 - Math.exp(-sp/20), V = p.cur;
    if (dt > 0 && S.live && S.kind === k) { S.acc = dmp(S.acc, cl(((p.v || 0) - S.pv)/dt, -14, 9), 4, dt); S.yr = dmp(S.yr, cl(wrapA(th - S.pth)/dt, -3, 3), 5, dt); } else { S.acc = 0; S.yr = 0; }
    S.pv = p.v || 0; S.pth = th;
    const slip = (p.v || 0) > 4 ? Math.atan2((V && V.vl) || 0, p.v) : 0;
    T[0] = p.x + Math.cos(th)*0.6; T[1] = (p.y || 0) + 1.25; T[2] = p.z + Math.sin(th)*0.6;
    T[3] = 5.3 + 1.1*g + big + cl(S.acc*0.035, -0.4, 0.3);
    T[4] = 0.95 + 0.22*g + R_.pitchOff*4 + big*0.35;
    T[5] = cl(S.yr*sp*0.022, -0.5, 0.5); T[6] = 1.6; T[7] = 0.35;
    T[8] = 60 + 9*(1 - Math.exp(-sp/24)) + cl(S.acc*0.3, -1.5, 2.5);
    yawWant = th + cl(slip, -0.6, 0.6)*0.55 + (R_.lookBack ? Math.PI : 0);
    if (R_.orbitT > 0) { R_.orbitT -= dt; yawK = R_.lookBack ? 10 : 0; }
    else { R_.pitchOff = dmp(R_.pitchOff, 0, 2.5, dt); yawK = R_.lookBack ? 10 : (1.3 + Math.min(2.4, sp*0.1))*Math.min(1, sp/3)*Math.min(1, S.since/1.2); }
  } else {
    if (!R_.footMode) { R_.footMode = true; R_.footYaw = S.live ? S.yaw : p.th; R_.footPitch = 0.22; }
    if (R_.orbitT > 0) R_.orbitT -= dt; else if (sp > 1.0) R_.footYaw += wrapA(p.th - R_.footYaw)*(1 - Math.exp(-0.9*dt));
    const pv = k === 'mirror', pitch = pv ? 0.08 : R_.footPitch, dist = pv ? 2.3 : 3.6 + Math.min(1.2, sp*0.12);
    T[0] = p.x; T[1] = (p.y || 0) + (pv ? 1.15 : 1.5); T[2] = p.z;
    T[3] = dist*Math.cos(pitch); T[4] = dist*Math.sin(pitch); T[5] = pv ? 0 : 0.35; T[6] = 0; T[7] = 0;
    T[8] = 58 + Math.min(sp, 27.8)*0.8;
    yawWant = pv ? p.th + Math.PI + 0.35 : R_.footYaw + (R_.lookBack ? Math.PI : 0); yawK = pv ? 5 : S.kind === 'mirror' || S.since < 0.5 ? 9 : 45;
  }
  // a change of what it's circling: it carries on from where it is and settles over a second. Only a real jump in place
  // (a teleport, waking somewhere else, coming back from your own eyes) starts afresh
  if (S.kind !== k || !S.live || !R_.inited) {
    if (S.live && R_.inited && Math.hypot(S.q[0] - T[0], S.q[2] - T[2]) < 40) { for (let i = 0; i < 9; i++) S.o[i] = S.q[i] - T[i]; S.t = 0; }
    else { S.o.fill(0); S.t = 1; S.yaw = yawWant; S.pull = 1; S.y = null; S.roll = 0; }
    S.kind = k; S.since = 0; S.live = true; R_.inited = true;
  }
  S.since += dt; if (S.t < 1) S.t = Math.min(1, S.t + dt/1.05);
  const e = 1 - ease(S.t), q = S.q;
  for (let i = 0; i < 9; i++) q[i] = T[i] + S.o[i]*e;
  if (yawK > 0) S.yaw += wrapA(yawWant - S.yaw)*(1 - Math.exp(-yawK*dt));
  R_.yaw = S.yaw;
  const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  // walls, and buses and cars close behind: in towards you quickly, back out gently (it never jumps)
  const fx = q[0] - cy*q[3], fz = q[2] - sy*q[3], tw = W.collision.ray(q[0], q[2], fx, fz), tv = R_.vehicleRay(q[0], q[2], fx, fz), t = Math.min(tw, tv);
  const want = t < 1 ? Math.max(veh ? 0.22 : 0.15, t*0.9) : 1;
  S.pull = dmp(S.pull, want, want < S.pull ? 30 : 3.5, dt);
  const cx = q[0] - cy*q[3]*S.pull, cz = q[2] - sy*q[3]*S.pull;
  const yTo = q[1] + q[4]*(veh ? 1 : Math.max(0.4, S.pull)) + (veh ? (tv < tw ? 1.1 : 0.6)*(1 - S.pull) : 0);
  S.y = S.y === null || Math.abs(yTo - S.y) > 3 ? yTo : dmp(S.y, yTo, 12, dt);
  cam.position.set(cx, S.y, cz); cam.up.set(0, 1, 0);
  R_.pos.copy(cam.position);
  R_.look.set(q[0] + cy*q[6] - sy*q[5], q[1] + q[7], q[2] + sy*q[6] + cy*q[5]);
  cam.lookAt(R_.look);
  S.roll = dmp(S.roll, veh ? cl(-S.yr*sp*0.0013, -0.035, 0.035) : 0, 3, dt);
  if (Math.abs(S.roll) > 1e-4) cam.rotateZ(S.roll);
  if (veh && sp > 24) { S.ph += dt*(26 + sp*0.35); const a = Math.min(0.011, (sp - 24)*0.0004); cam.position.y += Math.sin(S.ph)*Math.sin(S.ph*0.37 + 1)*a; cam.position.x += Math.sin(S.ph*0.71 + 2)*a*0.5*sy; cam.position.z -= Math.sin(S.ph*0.71 + 2)*a*0.5*cy; }
  R_.setFov(dt, q[8]);
  R_.applyShake(dt);
}
R.update = function (dt, p) {
  // in a vehicle you're drawn whole in both views (from the seat the camera's in your head, and sees out past it: skin.js)
  if (p && p.human && !p.onFoot) p.human._fp = this.mode === 2;
  if (!this._pl) { this._pl = true; const v = load(); this.mode = v.drive === 2 ? 2 : 0; this.footFP = !!v.foot; }
  const k = kind(this, p), cam = this.cam;
  let r;
  if (own(k)) { r = upd.call(this, dt, p); if (this._tp) this._tp.live = false; }
  else { if (p.human && p.onFoot) p.human._fp = false; if (this._fpWas) { this._fpWas = false; this.footPitch = clamp(this.footPitch, -0.25, 0.9); } r = third(this, dt, p, k); }
  // to your own eyes or the driver's seat and back, the camera travels there (a short, quick move in and out)
  const B = this._bl || (this._bl = { t: 1, dur: 1, has: false, kind: '', p: new THREE.Vector3(), q: new THREE.Quaternion(), f: 60, lp: new THREE.Vector3(), lq: new THREE.Quaternion(), lf: 60 });
  if (k !== B.kind) {
    const was = B.kind; B.kind = k;
    if ((own(was) || own(k)) && B.has && dt > 0 && B.lp.distanceTo(cam.position) < 40) { B.p.copy(B.lp); B.q.copy(B.lq); B.f = B.lf; B.t = 0; B.dur = 0.5; }
  }
  if (B.t < 1) {
    B.t = Math.min(1, B.t + dt/B.dur); const e = ease(B.t);
    cam.position.lerpVectors(B.p, cam.position, e); cam.quaternion.slerpQuaternions(B.q, cam.quaternion, e);
    const f = B.f + (this.fov - B.f)*e; if (Math.abs(cam.fov - f) > 0.02) { cam.fov = f; cam.updateProjectionMatrix(); }
  }
  B.lp.copy(cam.position); B.lq.copy(cam.quaternion); B.lf = cam.fov; B.has = true;
  return r;
};
R.drag = function (dx, dy) {
  // (behind a vehicle the mouse turns the camera itself: it stays where you put it till you drive on)
  if (!this.footMode && this.mode !== 2 && this._tp && this._tp.live) { this._tp.yaw += dx*0.006; this.pitchOff = clamp(this.pitchOff + dy*0.004, -0.3, 0.6); this.orbitT = 1.6; return; }
  if (this.footMode && this.footFP) { this.footYaw += dx*0.006; this.footPitch = clamp(this.footPitch + dy*0.004, -1.25, 1.3); this.orbitT = 1.2; return; }
  return drag.call(this, dx, dy);
};
// first person on foot: your own eyes, a little in front of the face. You're all there, head too: only the camera in it
// sees out past it (skin.js); a mirror, anyone else, sees your whole head
R.updateFoot = function (dt, p) {
  const H = p.human, fp = this.footFP && !this.preview && !p.seated;
  if (H) H._fp = fp;
  if (!fp) { if (this._fpWas) { this._fpWas = false; this.footPitch = clamp(this.footPitch, -0.25, 0.9); } return updFoot.call(this, dt, p); }
  const cam = this.cam;
  p.setCockpit && p.setCockpit(false);
  this.setNear(0.05);
  if (!this.footMode) { this.footMode = true; this.footYaw = p.th; this.footPitch = 0; }
  if (!this._fpWas) { this._fpWas = true; this.footPitch = 0.05; }
  const yaw = this.footYaw + (this.lookBack ? Math.PI : 0), pitch = this.footPitch, cy = Math.cos(yaw), sy = Math.sin(yaw);
  // a walk's gentle rise and fall, none standing still
  this._bob = (this._bob || 0) + dt*Math.min(9, Math.abs(p.v)*1.9);
  const bob = Math.sin(this._bob*2)*Math.min(0.035, Math.abs(p.v)*0.006);
  // a neck turns so far: past that, your body comes round with your look
  const F = p.foot;
  // (not while you're dragging someone: you keep facing them, and look round)
  if (F && !this.lookBack && !(p.act && p.act.kind === 'drag')) { const d = Math.atan2(Math.sin(this.footYaw - F.yaw), Math.cos(this.footYaw - F.yaw)); if (Math.abs(d) > 0.85) F.yaw += d - Math.sign(d)*0.85; }
  // your eyes are in your head, wherever the walk or the run has it (skin.js finds it each frame), just ahead of the face
  const o = H && H._headOff, hy = H ? H.holder.position.y : (p.y || 0);
  if (o) { const s = this._eo || (this._eo = { x: o.x, y: o.y, z: o.z }), k = Math.min(1, dt*14); s.x += (o.x - s.x)*k; s.y += (o.y - s.y)*k; s.z += (o.z - s.z)*k; }
  const e = this._eo, fw = 0.11;
  const ex = e ? p.x + e.x + cy*fw : p.x + cy*0.16, ez = e ? p.z + e.z + sy*fw : p.z + sy*0.16, ey = e ? hy + e.y + 0.08 : (p.y || 0) + (p.crouch ? 1.05 : 1.62) + bob;
  this.pos.set(ex, ey, ez); cam.position.copy(this.pos); cam.up.set(0, 1, 0);
  const cp = Math.cos(pitch);
  this.look.set(ex + cy*cp, ey - Math.sin(pitch), ez + sy*cp); cam.lookAt(this.look);
  this.setFov(dt, 66 + Math.min(Math.abs(p.v), 27.8)*0.6);
  this.applyShake(dt);
};
