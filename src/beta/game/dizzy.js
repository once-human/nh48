// Dizzy, made on the bones (there's no clip for it): the ground goes out from under them. The hips sink and drift in
// a slow circle, the knees give to take it (the feet stay where they were planted), the spine leans with the sway and
// slumps, the head lolls a beat behind the body, and the right hand comes up to the forehead. It eases in, holds, and
// eases out back into whatever they were doing. For you (Vetal, leaving someone) and for the street's people
// (the one you've just left comes round like this).
import * as THREE from 'three';
import { Crowd } from '@orig/people/crowd.js';
import { bendBone, ikArm } from '@orig/people/humans.js';
import { ikLeg } from './fists.js';

const UP = new THREE.Vector3(0, 1, 0), f = new THREE.Vector3(), r = new THREE.Vector3(), d = new THREE.Vector3(), a = new THREE.Vector3(), pole = new THREE.Vector3(), knee = new THREE.Vector3();
const bone = (H, n) => (H._ab || (H._ab = {}))[n] || (H._ab[n] = H.root.getObjectByName(n));
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x*x*(3 - 2*x); };

// D: { t, dur } kept by the caller; returns false once it's over
export function dizzyPose(H, D, dt, yaw) {
  if (!H || !H.root) return false;
  D.t += dt;
  const t = D.t, dur = D.dur;
  const pel = bone(H, 'pelvis');
  if (t >= dur) { if (pel && D.p0) pel.position.copy(D.p0); return false; }
  const w = smooth(t/0.18)*smooth((dur - t)/0.35);
  f.set(Math.cos(yaw), 0, Math.sin(yaw)); r.crossVectors(f, UP);          // r: to their right
  const ph = t*Math.PI*2*0.8 + (D.ph || 0);
  H.root.updateMatrixWorld(true);
  // where the feet are now: they stay there
  if (!D.feet) {
    D.feet = {};
    for (const s of ['l', 'r']) { const b = bone(H, 'foot_' + s); if (b) D.feet[s] = b.getWorldPosition(new THREE.Vector3()); }
    if (pel) D.p0 = pel.position.clone();
  }
  // the hips: down, and round in a slow circle
  if (pel && pel.parent && D.p0) {
    pel.position.copy(D.p0); H.root.updateMatrixWorld(true);
    pel.getWorldPosition(a);
    d.set(0, 0, 0).addScaledVector(UP, -0.075*w).addScaledVector(r, 0.04*w*Math.sin(ph)).addScaledVector(f, 0.025*w*Math.cos(ph));
    a.add(d); pel.parent.worldToLocal(a); pel.position.copy(a);
    H.root.updateMatrixWorld(true);
  }
  // the spine leans with it, a little behind, and slumps forward
  ['spine_01', 'spine_02', 'spine_03'].forEach((n, i) => { const b = bone(H, n); if (!b) return; bendBone(b, f, 0.055*w*Math.sin(ph - 0.35 - i*0.3)); bendBone(b, r, -0.045*w); });
  // the head lolls, further behind still
  const nk = bone(H, 'neck_01'), hd = bone(H, 'Head') || bone(H, 'head');
  H.root.updateMatrixWorld(true);
  if (nk) { bendBone(nk, f, 0.15*w*Math.sin(ph - 1.0)); bendBone(nk, r, -0.1*w); }
  if (hd) { bendBone(hd, f, 0.12*w*Math.sin(ph - 1.5)); bendBone(hd, r, -(0.07 + 0.05*Math.cos(ph))*w); }
  H.root.updateMatrixWorld(true);
  // the knees give, the feet stay put
  pole.copy(f).multiplyScalar(1).addScaledVector(UP, 0.1);
  for (const s of ['l', 'r']) if (D.feet[s]) { knee.copy(pole).addScaledVector(r, s === 'l' ? -0.15 : 0.15); try { ikLeg(H, s, D.feet[s], knee, w); } catch (e) { /* no legs here */ } }
  // and a hand to the forehead
  const hw = smooth((t - 0.04)/0.28)*w;
  if (hd && hw > 0.01) {
    hd.getWorldPosition(a); a.addScaledVector(f, 0.14).addScaledVector(UP, 0.06).addScaledVector(r, 0.02);
    pole.copy(r).multiplyScalar(0.8).addScaledVector(UP, -0.6);
    try { ikArm(H, 'r', a, pole, hw); } catch (e) { /* no arm here */ }
  }
  return true;
}

// the street's people: p.dizzy = { t: 0, dur } and they go through it where they stand
const post = Crowd.prototype.postPed;
Crowd.prototype.postPed = function (p, H, dt) {
  const out = post ? post.call(this, p, H, dt) : undefined;
  if (p.dizzy && H) { if (!dizzyPose(H, p.dizzy, dt, p.yaw ?? 0)) p.dizzy = null; }
  return out;
};
