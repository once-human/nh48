// Looking in a shop's mirror: you turn to the glass and strike a pose, a different one each time (never the same one
// twice running): hands on your hips, a tug at the collar, a hand back through your hair, turned side-on looking back
// over your shoulder, a flex, pointing at yourself, arms folded, a cuff straightened. (It was a nod, every time.)
// The point and the folded arms are the rig's own clips; the rest are made on the standing clip, bone by bone.
import * as THREE from 'three';
import { Interiors } from '@orig/world/interiors.js';
import { Pilot } from '@orig/game/pilot.js';
import { ikArm } from '@orig/people/humans.js';
import { UP, bone, smooth, bell, turn, worldOf } from './dizzy.js';
import { grip } from '../vehicles/fit.js';

const POSES = ['hips', 'collar', 'hair', 'side', 'flex', 'point', 'folded', 'cuff'];
const CLIP = { point: 'point', folded: 'arms_folded' };
const D = 3.4;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const f = new THREE.Vector3(), rt = new THREE.Vector3(), sh = [new THREE.Vector3(), new THREE.Vector3()], mid = new THREE.Vector3();
const tg = new THREE.Vector3(), pole = new THREE.Vector3(), a = new THREE.Vector3();
let last = -1;

const use = Interiors.prototype.use;
Interiors.prototype.use = function (s) {
  if (!s || s.kind !== 'mirror') return use.call(this, s);
  use.call(this, s);                                   // (what you look like to the place: its toast)
  const P = this.g.player; if (!P.onFoot || !P.human) return;
  let k; do k = Math.floor(Math.random()*POSES.length); while (k === last); last = k;
  // the glass is on the wall a metre on from where you stand (world/interiors.js: the boutique's mirror on its +x wall)
  P._mir = { pose: POSES[k], t: 0, yaw: Math.atan2(0, 1), side: Math.random() < 0.5 ? 1 : -1 };
  // in first person your own head isn't drawn (it's your eyes): the camera steps back for the look, and in after
  const rig = this.g.rig; if (rig && rig.footFP) { rig.footFP = false; P._mir.fp = rig; }
  P.act = { kind: 'hurt', t: 0, dur: D };
  P.human.play(CLIP[POSES[k]] || 'idle', { fade: 0.3, restart: true });
};

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...rest) {
  const M = this._mir;
  if (!M) return upd.call(this, dt, ...rest);
  const F = this.foot, H = this.human;
  if (!this.onFoot || !H || !this.act || this.act.kind !== 'hurt' || this.downT > 0) { if (M.fp) M.fp.footFP = true; this._mir = null; return upd.call(this, dt, ...rest); }
  M.t += dt;
  // to the glass (side-on: turned most of the way off it)
  const want = M.yaw + (M.pose === 'side' ? M.side*1.0*smooth(M.t/0.7) : 0);
  F.yaw += wrap(want - F.yaw)*Math.min(1, dt*6);
  const out = upd.call(this, dt, ...rest);
  if (M.t >= D) { if (M.fp) M.fp.footFP = true; this._mir = null; H.play('idle', { fade: 0.4 }); return out; }
  pose(H, F, M);
  return out;
};

function pose(H, F, M) {
  const t = M.t, w = bell(t, 0.15, 0.75, D - 0.7, D - 0.1);
  if (w < 0.005) return;
  H.root.updateMatrixWorld(true);
  // forward from the way you face; right from your own shoulders, square to it (each hand on its own side)
  f.set(Math.cos(F.yaw), 0, Math.sin(F.yaw));
  if (!worldOf(H, 'upperarm_l', sh[0]) || !worldOf(H, 'upperarm_r', sh[1])) return;
  rt.subVectors(sh[1], sh[0]); rt.y = 0; rt.addScaledVector(f, -rt.dot(f));
  if (rt.lengthSq() < 1e-6) return; rt.normalize();
  mid.addVectors(sh[0], sh[1]).multiplyScalar(0.5);
  const arm = (sd, target, pl, k = w) => ikArm(H, sd, target, pl, k);
  const SIDES = [['l', -1, 0], ['r', 1, 1]];
  // a hand on its hip: the heel of it on the top of the pelvis, fingers forward, the elbow out and back
  const hip = (sd, sg) => {
    if (!worldOf(H, 'thigh_' + sd, a)) return;
    tg.copy(a).addScaledVector(UP, 0.1).addScaledVector(rt, sg*0.09).addScaledVector(f, -0.03);
    pole.copy(rt).multiplyScalar(sg).addScaledVector(f, -0.6);
    arm(sd, tg, pole); grip(H, sd, 0.25*w);
  };
  switch (M.pose) {
    case 'hips': {
      turn(bone(H, 'spine_02'), rt, 0.07*w); turn(bone(H, 'neck_01'), rt, 0.06*w);          // chest out, chin up
      H.root.updateMatrixWorld(true);
      for (const [sd, sg] of SIDES) hip(sd, sg);
      break;
    }
    case 'collar': {
      turn(bone(H, 'neck_01'), rt, 0.12*w); H.root.updateMatrixWorld(true);
      const tug = Math.max(0, Math.sin((t - 0.8)*7))*0.025;
      for (const [sd, sg] of SIDES) {
        tg.copy(mid).addScaledVector(f, 0.11).addScaledVector(rt, sg*0.075); tg.y -= 0.06 - tug;
        pole.copy(rt).multiplyScalar(sg).addScaledVector(UP, -0.7);
        arm(sd, tg, pole); grip(H, sd, 0.7*w);
      }
      break;
    }
    case 'hair': {
      // the right hand from the forehead back over the top, twice; the head tipped into it
      turn(bone(H, 'neck_01'), rt, 0.1*w); H.root.updateMatrixWorld(true);
      if (!worldOf(H, 'Head', a)) break;
      const s = 0.5 - 0.5*Math.cos(Math.max(0, t - 0.6)*Math.PI*1.1);
      tg.copy(a).addScaledVector(UP, 0.15 - 0.03*s).addScaledVector(f, 0.09 - 0.2*s).addScaledVector(rt, 0.03);
      pole.copy(rt).addScaledVector(UP, 0.5);
      arm('r', tg, pole); grip(H, 'r', 0.3*w);
      hip('l', -1);
      break;
    }
    case 'side': {
      // the body's turned off the glass (above); the head and chest come back round to it, the far hand on the hip
      const k = M.side*smooth(t/0.7)*w;
      turn(bone(H, 'spine_03'), UP, k*0.25); turn(bone(H, 'neck_01'), UP, k*0.35); turn(bone(H, 'Head'), UP, k*0.3);
      H.root.updateMatrixWorld(true);
      if (M.side > 0) hip('r', 1); else hip('l', -1);
      break;
    }
    case 'flex': {
      // both arms up, elbows out at the shoulders' height, fists by the ears
      turn(bone(H, 'spine_02'), rt, 0.05*w); H.root.updateMatrixWorld(true);
      for (const [sd, sg, i] of SIDES) {
        tg.copy(sh[i]).addScaledVector(rt, sg*0.24).addScaledVector(UP, 0.22).addScaledVector(f, 0.04);
        pole.copy(rt).multiplyScalar(sg).addScaledVector(UP, -1);
        arm(sd, tg, pole); grip(H, sd, 1.0*w);
      }
      break;
    }
    case 'point': case 'folded': {
      // the clip does the arms: a little lean back and the chin up with it, a nod to yourself
      turn(bone(H, 'spine_02'), rt, 0.05*w); turn(bone(H, 'neck_01'), rt, (0.08 - 0.06*Math.max(0, Math.sin((t - 1.2)*5)))*w);
      break;
    }
    case 'cuff': {
      // the left forearm up across the front, the right hand at its wrist pulling the cuff straight, eyes on it
      turn(bone(H, 'neck_01'), rt, -0.22*w); H.root.updateMatrixWorld(true);
      tg.copy(mid).addScaledVector(f, 0.3).addScaledVector(rt, -0.02); tg.y -= 0.12;
      pole.copy(rt).multiplyScalar(-1).addScaledVector(UP, -0.6);
      arm('l', tg, pole); grip(H, 'l', 0.3*w);
      if (!worldOf(H, 'hand_l', a)) break;
      const tug = Math.max(0, Math.sin((t - 0.9)*6))*0.03;
      tg.copy(a).addScaledVector(rt, 0.05 + tug).addScaledVector(f, -0.02); tg.y += 0.02;
      pole.copy(rt).addScaledVector(UP, -0.8);
      arm('r', tg, pole); grip(H, 'r', 0.6*w);
      break;
    }
  }
  H.root.updateMatrixWorld(true);
}
