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
const RATE = [0, 0, 0, 3.5, 5, 2.5, 3, 3];
function third(R_, dt, p, k) {
  const S = R_._tp || (R_._tp = { q: new Float64Array(9), o: new Float64Array(9), T: new Float64Array(9), f: new Float64Array(9), t: 1, yaw: 0, pull: 1, roll: 0, acc: 0, yr: 0, pv: 0, pth: 0, kind: '', live: false, since: 9, ph: 0, hh: 0, rev: 0, ax: 0, ay: 0, az: 0, vx: 0, vz: 0, rx: 0, rz: 0 });
  const T = S.T, cam = R_.cam, W = R_.W, veh = k === 'chase', sp = Math.abs(p.v || 0);
  const fresh = S.kind !== k || !S.live || !R_.inited;
  let yawWant, yawK;
  p.setCockpit && p.setCockpit(false);
  R_.setNear(veh ? 0.3 : 0.1);
  // a knock: the view jumps back and opens for a moment, and settles
  R_._punch = dmp(R_._punch || 0, 0, 5, dt);
  if (veh) {
    R_.footMode = false;
    const th = p.th, big = p.camDist || 0, g = 1 - Math.exp(-sp/20), V = p.cur, v = p.v || 0;
    if (dt > 0 && !fresh) { S.acc = dmp(S.acc, cl((v - S.pv)/dt, -14, 9), 4, dt); S.yr = dmp(S.yr, cl(wrapA(th - S.pth)/dt, -3, 3), 5, dt); } else { S.acc = 0; S.yr = 0; }
    S.pv = v; S.pth = th;
    // backing up: after a moment the camera comes round to the front and looks back over the car, at what you're
    // reversing towards; forward again, or stopped a while, and it comes back
    S.rev = cl(S.rev + (v < -1.2 ? dt : v > 0.6 ? -dt*3 : sp < 0.2 ? -dt*0.5 : 0), 0, 1.3);
    const back = (S.rev > 0.7) !== !!R_.lookBack;
    const slip = v > 4 ? Math.atan2((V && V.vl) || 0, v) : 0;
    T[0] = p.x + Math.cos(th)*0.6; T[1] = (p.y || 0) + 1.25; T[2] = p.z + Math.sin(th)*0.6;
    T[3] = 5.3 + 1.1*g + big + cl(S.acc*0.035, -0.4, 0.3) + R_._punch*0.3;
    // (lower and looking further up the road the faster you go: that's most of what speed looks like)
    T[4] = 0.95 + 0.06*g + R_.pitchOff*4 + big*0.35;
    T[5] = cl(S.yr*sp*0.022, -0.5, 0.5); T[6] = 1.6 + 1.2*g; T[7] = 0.35 + cl(S.acc*0.012, -0.1, 0.06);
    T[8] = 60 + 9*(1 - Math.exp(-sp/24)) + cl(S.acc*0.3, -1.5, 2.5) + R_._punch*6;
    yawWant = th + (back ? Math.PI : cl(slip, -0.6, 0.6)*0.55 + cl(S.yr*0.1, -0.16, 0.16));
    if (R_.orbitT > 0) { R_.orbitT -= dt; yawK = R_.lookBack ? 10 : 0; }
    else { R_.pitchOff = dmp(R_.pitchOff, 0, 2.5, dt); yawK = R_.lookBack ? 10 : back ? 3.2 : (1.3 + Math.min(2.4, sp*0.1))*Math.min(1, sp/3)*Math.min(1, S.since/1.2); }
  } else {
    S.rev = 0;
    if (!R_.footMode) { R_.footMode = true; R_.footYaw = S.live ? S.yaw : p.th; R_.footPitch = 0.22; }
    if (R_.orbitT > 0) R_.orbitT -= dt; else if (sp > 1.0) R_.footYaw += wrapA(p.th - R_.footYaw)*(1 - Math.exp(-0.9*dt));
    const pv = k === 'mirror', pitch = pv ? 0.08 : R_.footPitch, dist = pv ? 2.3 : 3.6 + Math.min(1.2, sp*0.12);
    T[0] = p.x; T[1] = (p.y || 0) + (pv ? 1.15 : 1.5); T[2] = p.z;
    T[3] = dist*Math.cos(pitch); T[4] = dist*Math.sin(pitch); T[5] = pv ? 0 : 0.35; T[6] = 0; T[7] = 0;
    T[8] = 58 + Math.min(sp, 27.8)*0.8 + R_._punch*5;
    yawWant = pv ? p.th + Math.PI + 0.35 : R_.footYaw + (R_.lookBack ? Math.PI : 0); yawK = pv ? 5 : S.kind === 'mirror' || S.since < 0.5 ? 9 : 45;
  }
  // the point it circles, steadied: it goes with what it follows at that thing's own speed (so it never falls behind,
  // however fast), and only the little shakes on top of that (a car's body working on its springs, a step, a kerb)
  // are smoothed away. Followed rigidly, every one of those shook the whole picture
  if (!fresh && dt > 0 && Math.hypot(T[0] - S.rx, T[2] - S.rz) < 8) {
    const kv = 1 - Math.exp(-8*dt), ka = 1 - Math.exp(-(veh ? 14 : 18)*dt);
    S.vx += ((T[0] - S.rx)/dt - S.vx)*kv; S.vz += ((T[2] - S.rz)/dt - S.vz)*kv;
    S.ax += S.vx*dt; S.az += S.vz*dt; S.ax += (T[0] - S.ax)*ka; S.az += (T[2] - S.az)*ka;
    S.ay = Math.abs(T[1] - S.ay) > 3 ? T[1] : S.ay + (T[1] - S.ay)*(1 - Math.exp(-(veh ? 7 : 10)*dt));
    for (let i = 3; i < 8; i++) S.f[i] += (T[i] - S.f[i])*(1 - Math.exp(-(veh ? RATE[i] : 60)*dt));
  } else { S.ax = T[0]; S.ay = T[1]; S.az = T[2]; S.vx = S.vz = 0; for (let i = 3; i < 8; i++) S.f[i] = T[i]; }
  S.rx = T[0]; S.rz = T[2]; T[0] = S.ax; T[1] = S.ay; T[2] = S.az; for (let i = 3; i < 8; i++) T[i] = S.f[i];
  // a change of what it's circling: it carries on from where it is and settles over a second. Only a real jump in place
  // (a teleport, waking somewhere else, coming back from your own eyes) starts afresh
  if (fresh) {
    if (S.live && R_.inited && Math.hypot(S.q[0] - T[0], S.q[2] - T[2]) < 40) { for (let i = 0; i < 9; i++) S.o[i] = S.q[i] - T[i]; S.t = 0; }
    else { S.o.fill(0); S.t = 1; S.yaw = yawWant; S.pull = 1; S.roll = 0; }
    S.kind = k; S.since = 0; S.live = true; R_.inited = true;
  }
  S.since += dt; if (S.t < 1) S.t = Math.min(1, S.t + dt/1.05);
  const e = 1 - ease(S.t), q = S.q;
  for (let i = 0; i < 9; i++) q[i] = T[i] + S.o[i]*e;
  if (yawK > 0) S.yaw += wrapA(yawWant - S.yaw)*(1 - Math.exp(-yawK*dt));
  R_.yaw = S.yaw;
  const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
  // walls, buses and cars close behind, and anything else solid it would end up inside (a stall, a shelter, a tree):
  // in towards you quickly, back out gently, and behind a vehicle UP as it comes in, over the roof, so what's close
  // behind you is in the picture and not in the way of it
  const fx = q[0] - cy*q[3], fz = q[2] - sy*q[3], tw = W.collision.ray(q[0], q[2], fx, fz), tv = R_.vehicleRay(q[0], q[2], fx, fz), t = Math.min(tw, tv);
  let want = t < 1 ? Math.max(veh ? 0.12 : 0.15, t*0.9) : 1;
  { const r = W.collision.resolve(q[0] - cy*q[3]*S.pull, q[2] - sy*q[3]*S.pull, 0.3); if (r && r.depth > 0 && r.kind !== 3 && r.kind !== 4) want = Math.min(want, Math.max(veh ? 0.12 : 0.15, S.pull - 0.1)); }
  S.pull = dmp(S.pull, want, want < S.pull ? 30 : 3.5, dt);
  const cx = q[0] - cy*q[3]*S.pull, cz = q[2] - sy*q[3]*S.pull;
  const camY = q[1] + q[4]*(veh ? 1 : Math.max(0.4, S.pull)) + (veh ? 2.5*(1 - S.pull)*(1 - S.pull) + 0.9*(1 - S.pull) : 0);
  cam.position.set(cx, camY, cz); cam.up.set(0, 1, 0);
  R_.pos.copy(cam.position);
  R_.look.set(q[0] + cy*q[6]*S.pull - sy*q[5], q[1] + q[7], q[2] + sy*q[6]*S.pull + cy*q[5]);
  cam.lookAt(R_.look);
  S.roll = dmp(S.roll, veh ? cl(-S.yr*sp*0.0013, -0.035, 0.035) : 0, 3, dt);
  if (Math.abs(S.roll) > 1e-4) cam.rotateZ(S.roll);
  if (veh && sp > 24) { S.ph += dt*(26 + sp*0.35); const a = Math.min(0.011, (sp - 24)*0.0004); cam.position.y += Math.sin(S.ph)*Math.sin(S.ph*0.37 + 1)*a; cam.position.x += Math.sin(S.ph*0.71 + 2)*a*0.5*sy; cam.position.z -= Math.sin(S.ph*0.71 + 2)*a*0.5*cy; }
  // on foot and standing, the camera is in someone's hands: it's never quite dead still
  if (!veh && sp < 1.5) { S.hh += dt; const a = 1 - sp/1.5; cam.rotateY(Math.sin(S.hh*1.45)*0.0022*a); cam.rotateX(Math.sin(S.hh*1.93 + 1)*0.0016*a); }
  R_.setFov(dt, q[8]);
  R_.applyShake(dt);
}
// a shake is a blow rolling through the camera and dying away, not a rattle: it moves smoothly, a little each way and a
// little round, harder the harder the knock
const shake0 = R.shake;
R.shake = function (a) { this._punch = Math.min(1, (this._punch || 0) + a*1.6); return shake0.call(this, a); };
R.applyShake = function (dt) {
  const cam = this.cam, a = this.shakeAmp;
  if (a > 0.001) {
    const t = this._st = (this._st || 0) + dt, n = (f, o) => Math.sin(t*f + o)*0.6 + Math.sin(t*f*2.3 + o*1.7)*0.4;
    cam.position.x += n(31, 0)*a*0.11; cam.position.y += n(37, 2)*a*0.11;
    cam.rotateZ(n(27, 4)*a*0.03); cam.rotateX(n(23, 5)*a*0.012);
    this.shakeAmp *= Math.exp(-dt*5);
  }
  // a few drinks in: the world sways gently
  if (this.drunk > 0.05) {
    this.swayT = (this.swayT || 0) + dt;
    const k = Math.min(1, this.drunk);
    cam.rotateZ(Math.sin(this.swayT*0.9)*0.035*k); cam.rotateX(Math.sin(this.swayT*0.63 + 1)*0.015*k);
  }
};
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
