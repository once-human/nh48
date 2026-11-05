// Dizzy, made on the bones (there's no clip for it): the ground goes out from under them. The hips sink and drift in
// a slow circle, the knees give to take it (the feet stay where they were planted, and when the sway carries too far
// one foot steps out to catch it), the spine leans with the sway and slumps, the head lolls a beat behind the body,
// a hand comes up to the forehead (or both to the head, when it hurts) and, when it's bad, the other arm goes out
// for balance. It eases in, holds, and eases out back into whatever they were doing. Used for you (Vetal, leaving
// someone, getting up) and for the street's people (the one you've just left comes round like this).
// Also the bone tools the other made-on-the-bones moves share (acts.js, wake.js).
import * as THREE from 'three';
import { ikArm } from '@orig/people/humans.js';
import { ikLeg } from './fists.js';

export const UP = new THREE.Vector3(0, 1, 0);
export const bone = (H, n) => (H._ab || (H._ab = {}))[n] || (H._ab[n] = H.root.getObjectByName(n));
export const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x*x*(3 - 2*x); };
// up over a..b, held, down over c..d
export const bell = (x, a, b, c, d) => smooth((x - a)/Math.max(1e-4, b - a))*smooth((d - x)/Math.max(1e-4, d - c));

const _pq = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _ax = new THREE.Vector3(), _a = new THREE.Vector3();
// turn a bone about a world axis, on top of whatever it's doing (several turns on one bone add up, unlike bendBone)
export function turn(b, axis, ang) {
  if (!b || !b.parent || !ang) return;
  b.parent.getWorldQuaternion(_pq);
  _ax.copy(axis).applyQuaternion(_pq.invert()).normalize();
  b.quaternion.premultiply(_dq.setFromAxisAngle(_ax, ang));
  b.updateMatrixWorld(true);
}
// move the hips by a world offset (the clip set them this frame; this goes on top)
export function shiftPelvis(H, d) {
  const pel = bone(H, 'pelvis'); if (!pel || !pel.parent) return;
  H.root.updateMatrixWorld(true);
  pel.getWorldPosition(_a).add(d); pel.parent.worldToLocal(_a); pel.position.copy(_a);
  H.root.updateMatrixWorld(true);
}
export const worldOf = (H, n, out) => { const b = bone(H, n); return b ? b.getWorldPosition(out) : null; };
// facing (f) and right (r) for a heading
export function axes(yaw, f, r) { f.set(Math.cos(yaw), 0, Math.sin(yaw)); r.crossVectors(f, UP); }
export const safe = (fn) => { try { fn(); } catch (e) { /* a body without that limb */ } };

const f = new THREE.Vector3(), r = new THREE.Vector3(), d = new THREE.Vector3(), a = new THREE.Vector3(), pole = new THREE.Vector3(), tg = new THREE.Vector3();

// D: { t, dur, ph, sev (1 ordinary, 2 very bad), hand: 'r' | 'both' | null }, its t kept by the caller (real seconds).
// Returns false once it's over.
export function dizzyPose(H, D, yaw, wMul = 1) {
  if (!H || !H.root) return false;
  const t = D.t, dur = D.dur, sev = D.sev ?? 1;
  if (t >= dur) return false;
  // slow in, slow out
  const w = smooth(t/Math.min(0.5, dur*0.3))*smooth((dur - t)/Math.min(0.8, dur*0.4))*wMul, A = w*sev;
  axes(yaw, f, r);
  const ph = t*Math.PI*2*0.55 + (D.ph || 0), sw = Math.sin(ph);
  H.root.updateMatrixWorld(true);
  // where the feet are when it starts: they stay there (unless a step moves one)
  if (!D.feet) {
    D.feet = {};
    for (const s of ['l', 'r']) { const p = worldOf(H, 'foot_' + s, new THREE.Vector3()); if (p) D.feet[s] = p; }
    D.stepT = 0; D.step = null;
  }
  // the hips: down, and round in a slow circle
  d.set(0, 0, 0).addScaledVector(UP, -0.07*A).addScaledVector(r, 0.05*A*sw).addScaledVector(f, 0.03*A*Math.cos(ph));
  shiftPelvis(H, d);
  // the spine leans with it, a little behind, and slumps forward
  ['spine_01', 'spine_02', 'spine_03'].forEach((n, i) => { const b = bone(H, n); turn(b, f, 0.06*A*Math.sin(ph - 0.35 - i*0.3)); turn(b, r, -0.05*A); });
  // the head lolls, further behind still
  const nk = bone(H, 'neck_01'), hd = bone(H, 'Head') || bone(H, 'head');
  turn(nk, f, 0.16*A*Math.sin(ph - 1.0)); turn(nk, r, -0.1*A);
  turn(hd, f, 0.13*A*Math.sin(ph - 1.5)); turn(hd, r, -(0.06 + 0.05*Math.cos(ph))*A);
  // a step to catch the sway: when it carries far to one side, that foot goes out under it (not too often)
  if (D.lastStep === undefined) D.lastStep = t;
  if (!D.step && sev >= 0.9 && w > 0.6 && t - D.lastStep > 1.4 && Math.abs(sw) > 0.93) {
    const s = sw > 0 ? 'r' : 'l', from = D.feet[s];
    if (from) { D.step = { s, t0: t, from: from.clone(), to: from.clone().addScaledVector(r, (sw > 0 ? 1 : -1)*0.11*sev).addScaledVector(f, (Math.random() - 0.5)*0.08) }; D.lastStep = t; }
  }
  if (D.step) {
    const S = D.step, u = (t - S.t0)/0.42;
    D.feet[S.s].lerpVectors(S.from, S.to, smooth(u)); D.feet[S.s].y = S.from.y + Math.sin(Math.PI*Math.min(1, u))*0.07;
    if (u >= 1) { D.feet[S.s].y = S.from.y; D.step = null; }
  }
  // the knees give, the feet stay put
  pole.copy(f).addScaledVector(UP, 0.1);
  for (const s of ['l', 'r']) if (D.feet[s]) { tg.copy(pole).addScaledVector(r, s === 'l' ? -0.15 : 0.15); safe(() => ikLeg(H, s, D.feet[s], tg, w)); }
  // a hand to the forehead (both to the head when it hurts)
  const hw = smooth((t - 0.15)/0.6)*w, hand = D.hand === undefined ? 'r' : D.hand;
  if (hd && hw > 0.01 && hand) {
    hd.getWorldPosition(a);
    if (hand === 'both') for (const s of ['l', 'r']) {
      tg.copy(a).addScaledVector(r, s === 'r' ? 0.1 : -0.1).addScaledVector(f, 0.04).addScaledVector(UP, 0.05);
      pole.copy(r).multiplyScalar(s === 'r' ? 0.9 : -0.9).addScaledVector(UP, -0.4).addScaledVector(f, 0.3);
      safe(() => ikArm(H, s, tg, pole, hw));
    } else {
      tg.copy(a).addScaledVector(f, 0.14).addScaledVector(UP, 0.06).addScaledVector(r, 0.02);
      pole.copy(r).multiplyScalar(0.8).addScaledVector(UP, -0.6);
      safe(() => ikArm(H, 'r', tg, pole, hw));
    }
  }
  // when it's bad, the free arm goes out for balance, against the sway
  const bw = w*Math.max(0, Math.min(1, (sev - 1.05)/0.5));
  if (bw > 0.01 && hand !== 'both') {
    const sh = worldOf(H, 'upperarm_l', a);
    if (sh) {
      tg.copy(sh).addScaledVector(r, -0.5 - 0.12*sw).addScaledVector(UP, -0.28 + 0.06*sw).addScaledVector(f, 0.12);
      pole.copy(UP).multiplyScalar(-0.5).addScaledVector(f, -0.6);
      safe(() => ikArm(H, 'l', tg, pole, bw));
    }
  }
  return true;
}
