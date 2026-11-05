// Two views, on foot and in a vehicle alike: third person or first person, C (or V) to switch. The game had three in a
// vehicle (chase, far chase, seat): the far one was only a distance, and the FOV setting already does that. Each view is
// remembered on its own, so you're back on foot the way you walk and back at the wheel the way you drive.
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
R.update = function (dt, p) {
  // in a vehicle you're drawn in both views; from the seat only your head is cut away (skin.js)
  if (p && p.human && !p.onFoot) p.human._fp = this.mode === 2;
  // a helmet is its own piece over the head: from inside it, it's the whole view, so it isn't drawn while it's your eyes
  const X = p && p.human && p.human.xtra, hm = X && X.helm;
  if (hm) { const fp = !!p.human._fp; if (fp && hm.visible) { hm.visible = false; hm.userData.fpHid = true; } else if (!fp && hm.userData.fpHid) { hm.visible = true; hm.userData.fpHid = false; } }
  if (!this._pl) { this._pl = true; const v = load(); this.mode = v.drive === 2 ? 2 : 0; this.footFP = !!v.foot; }
  return upd.call(this, dt, p);
};
R.drag = function (dx, dy) {
  if (this.footMode && this.footFP) { this.footYaw += dx*0.006; this.footPitch = clamp(this.footPitch + dy*0.004, -1.25, 1.3); this.orbitT = 1.2; return; }
  return drag.call(this, dx, dy);
};
// first person on foot: your own eyes, a little in front of the face. You're still there: only your head isn't drawn
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
  this.setFov(dt, 66 + Math.abs(p.v)*0.6);
  this.applyShake(dt);
};
