// On your feet like a body is: you lean into a turn as hard as the turn is (a sprint round a corner banks you over,
// a stroll hardly at all), forward as you set off and back as you pull up, the head staying level through it; each
// foot comes down on the ground under it, so up a kerb or a step the leading foot lands on the top and the hips sink
// to let the trailing one reach; and you come down from a jump into your knees, deeper the harder you land, on the
// move as well as standing. (The clips are made on flat ground and the body was set on the ground's height under
// your middle: the feet hung in the air off a kerb's edge and went into the step in front.) The people near you
// put their feet on the kerb and the step the same way.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Crowd } from '@orig/people/crowd.js';
import { ikLeg } from './fists.js';

const ON = ['idle', 'walk', 'jog', 'sprint', 'jump_land', 'arms_folded', 'phone'];
const Y = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
const _ft = [new THREE.Vector3(), new THREE.Vector3()], _fq = [new THREE.Quaternion(), new THREE.Quaternion()];
const _pole = new THREE.Vector3();
const bone = (H, n) => (H._sb || (H._sb = {}))[n] || (H._sb[n] = H.root.getObjectByName(n));
const damp = (a, b, k, dt) => a + (b - a)*(1 - Math.exp(-k*dt));
// turn a bone about a world axis (not bendBone: that undoes a bend made earlier this frame by someone else)
function turn(b, axis, ang) {
  if (!b || !b.parent) return;
  b.parent.getWorldQuaternion(_pq).invert();
  b.quaternion.premultiply(_q.setFromAxisAngle(_a.copy(axis).applyQuaternion(_pq), ang));
}

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...rest) {
  const F = this.foot, wasAir = F.air, vy0 = F.vy || 0, vx0 = F.vx || 0, vz0 = F.vz || 0;
  upd.call(this, dt, ...rest);
  const H = this.human; if (!H || !this.onFoot || dt <= 0) return;
  const S = this._st || (this._st = { ax: 0, az: 0, lx: 0, lz: 0, dip: 0, dv: 0, o: [0, 0], dr: 0 });
  const cur = H.cur, loco = !F.climb && !F.swim && !this.seated && !this.downT && !this.act && !this.ko &&
    ON.some((n) => H.actions[n] && H.actions[n] === cur);

  // ---- the lean: the body's up tips toward where it's being pushed (the turn's pull, speeding up, pulling up)
  const ax = (F.vx - vx0)/dt, az = (F.vz - vz0)/dt;
  S.ax = damp(S.ax, loco && !F.air ? ax : 0, 7, dt); S.az = damp(S.az, loco && !F.air ? az : 0, 7, dt);
  const am = Math.hypot(S.ax, S.az), cap = 0.03 + 0.11*Math.min(1, F.v/5.6);     // (an upright runner: a lean, never a hunch)
  let tx = 0, tz = 0;
  if (am > 0.05) { const th = Math.min(cap, Math.atan(am/9.8)*0.55); tx = S.ax/am*th; tz = S.az/am*th; }
  S.lx = damp(S.lx, tx, loco ? 9 : 14, dt); S.lz = damp(S.lz, tz, loco ? 9 : 14, dt);
  const th = Math.hypot(S.lx, S.lz);

  // ---- the landing: down into the knees and back up
  if (wasAir && !F.air && !F.swim && !F.climb && !this.downT) { S.dv = Math.max(S.dv, Math.min(0.17, Math.max(0.035, -vy0*0.03))); S.dip = 0; }
  if (S.dv > 0) { S.dip += dt; if (S.dip > 0.42) S.dv = 0; }
  // quick down (the knees give), slower back up (the legs push you up again)
  const k = S.dip/0.42, dip = S.dv > 0 ? S.dv*(k < 0.24 ? Math.sin(k/0.24*Math.PI/2) : Math.cos((k - 0.24)/0.76*Math.PI/2)**2) : 0;

  if (th < 1e-3 && !loco && dip <= 0 && Math.abs(S.dr) < 1e-3) return;
  H.root.updateMatrixWorld(true);

  // ---- feet on the ground under them
  let drop = 0, any = false;
  const off = [0, 0];
  if (loco && !F.air) {
    const FL = this.W.fly, deck = F.deck ?? -1;
    for (let i = 0; i < 2; i++) {
      const fb = bone(H, i ? 'foot_r' : 'foot_l'); if (!fb) continue;
      fb.getWorldPosition(_ft[i]); fb.getWorldQuaternion(_fq[i]);
      const gy = deck >= 0 && FL ? FL.heightOn(deck, _ft[i].x, _ft[i].z) : this.W.surf.height(_ft[i].x, _ft[i].z);
      // eased, so a foot crossing a kerb's edge in the air rises over it rather than jumping onto it
      S.o[i] = damp(S.o[i], Math.max(-0.32, Math.min(0.32, gy - F.y)), 16, dt);
      off[i] = S.o[i];
      if (Math.abs(off[i]) > 0.012) any = true;
    }
  } else S.o[0] = S.o[1] = 0;
  // (the hips sink only for a real step or kerb under one foot, and not much on the run: on rough ground a runner
  // stays tall, they don't go along crouched)
  const step = Math.abs(off[0] - off[1]) > 0.06, want = any && step ? Math.max(F.v > 2.2 ? -0.07 : -0.16, Math.min(0, off[0], off[1])) : 0;
  S.dr = damp(S.dr, want, 14, dt); drop = S.dr;
  if (drop < -1e-3 && !any) { any = true; for (let i = 0; i < 2; i++) { const fb = bone(H, i ? 'foot_r' : 'foot_l'); if (fb) { fb.getWorldPosition(_ft[i]); fb.getWorldQuaternion(_fq[i]); } } }
  if (dip > 0 && !any) for (let i = 0; i < 2; i++) { const fb = bone(H, i ? 'foot_r' : 'foot_l'); if (fb) { fb.getWorldPosition(_ft[i]); fb.getWorldQuaternion(_fq[i]); } }

  // the whole body tips about the feet; the head comes back most of the way to level
  if (th > 1e-3) {
    _ax.set(S.lz, 0, -S.lx).normalize();                 // up x push: tips the up vector toward the push
    H.holder.quaternion.premultiply(_q.setFromAxisAngle(_ax, th));
  }
  H.holder.position.y += drop - dip;
  H.root.updateMatrixWorld(true);
  if (th > 1e-3) {
    turn(bone(H, 'neck_01'), _ax, -th*0.3); turn(bone(H, 'Head'), _ax, -th*0.25);
    turn(bone(H, 'spine_03'), _ax, -th*0.12);
    H.root.updateMatrixWorld(true);
  }
  if (any || dip > 0) {
    const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
    for (let i = 0; i < 2; i++) {
      const side = i ? 'r' : 'l', fb = bone(H, 'foot_' + side); if (!fb) continue;
      _ft[i].y += off[i];
      _pole.set(fx, 0.15, fz);
      ikLeg(H, side, _ft[i], _pole, 1);
      // the foot keeps the way it was set on the ground
      fb.parent.getWorldQuaternion(_pq).invert();
      fb.quaternion.copy(_pq.multiply(_fq[i]));
    }
    H.root.updateMatrixWorld(true);
  }
};

// the people walking and standing near you: the same feet on the ground under them (within 18 m, on a frame their
// clip has just posed; the hips' drop every frame, since the body is put back where the crowd puts it each frame)
const PED = /^(idle|walk|jog|sprint|talk|phone|arms_folded|carry)/;
const dr = Crowd.prototype.drive;
Crowd.prototype.drive = function (s, dt, cx, cz) {
  dr.call(this, s, dt, cx, cz);
  const p = s.p, H = s.H;
  if (!p || !H || p.rideOf || p.fallen > 0 || p.ko || p.act || p.lift || p.liftY || p.hands || p.dead || p.corpse) { if (s._st) s._st = null; return; }
  if (Math.abs(p.x - cx) + Math.abs(p.z - cz) > 18) { if (s._st) s._st = null; return; }
  const cl = H.cur && H.cur.getClip && H.cur.getClip().name;
  if (!cl || !PED.test(cl)) { if (s._st) s._st = null; return; }
  const S = s._st || (s._st = { o: [0, 0], dr: 0, mt: -1 });
  const posed = H.mixer.time !== S.mt; S.mt = H.mixer.time;
  if (posed) {
    H.root.updateMatrixWorld(true);
    const y0 = H.holder.position.y;
    for (let i = 0; i < 2; i++) {
      const fb = bone(H, i ? 'foot_r' : 'foot_l'); if (!fb) return;
      fb.getWorldPosition(_ft[i]); fb.getWorldQuaternion(_fq[i]);
      S.o[i] = damp(S.o[i], Math.max(-0.3, Math.min(0.3, this.W.surf.height(_ft[i].x, _ft[i].z) - y0)), 16, dt);
    }
    S.dr = damp(S.dr, Math.min(0, S.o[0], S.o[1]), 14, dt);
  }
  if (Math.abs(S.o[0]) < 0.012 && Math.abs(S.o[1]) < 0.012 && S.dr > -0.004) return;
  H.holder.position.y += S.dr;
  if (!posed) return;
  H.root.updateMatrixWorld(true);
  const fx = Math.cos(p.yaw || 0), fz = Math.sin(p.yaw || 0);
  for (let i = 0; i < 2; i++) {
    const side = i ? 'r' : 'l', fb = bone(H, 'foot_' + side);
    _ft[i].y += S.o[i];
    ikLeg(H, side, _ft[i], _pole.set(fx, 0.15, fz), 1);
    fb.parent.getWorldQuaternion(_pq).invert(); fb.quaternion.copy(_pq.multiply(_fq[i]));
  }
  H.root.updateMatrixWorld(true);
};
