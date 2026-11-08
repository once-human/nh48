// Someone lying in the street doesn't lie there unnoticed for long: your own body while you're away in someone else,
// a person knocked out, someone who's died. After a little while one of the passers-by goes over, gets down on one
// knee beside them, two fingers to the neck for a pulse, a hand on the shoulder to shake them ("ओ, काका? ऐकू येतंय
// का?"), looks round at whoever's watching, and gets up; most of them then phone for help, a few just stand and stare,
// and in a while they go on. Others gather round to watch (game/peds.js gather). It's only looking: nobody's done
// anything, nothing is anyone's crime.
import * as THREE from 'three';
import { People } from '@orig/people/peds.js';
import { Crowd } from '@orig/people/crowd.js';
import { ikArm } from '@orig/people/humans.js';
import { ikLeg } from '../game/fists.js';
import { UP, bone, smooth, turn, shiftPelvis, worldOf, axes, safe } from '../game/dizzy.js';

const f = new THREE.Vector3(), r = new THREE.Vector3(), tg = new THREE.Vector3(), pole = new THREE.Vector3(), d = new THREE.Vector3(), ft = new THREE.Vector3();
const KNEEL = 7.2;                        // s: down, pulse, shake, a look round, up
// where on them: the neck (and the shoulder just below it), from the body as it lies
function neckOf(b, out) {
  const R = b._rag;
  if (R && R.p) { out.set(R.p[0] + (R.p[6] - R.p[0])*0.2, 0.12 + (b.y || 0), R.p[2] + (R.p[8] - R.p[2])*0.2); return out; }
  const y = b.yaw || 0; return out.set(b.x + Math.cos(y)*0.55, 0.12 + (b.y || 0), b.z + Math.sin(y)*0.55);
}
const down = (b) => b && !b.hidden && b.fallen > 0 && (b._vetalBody || b.unconscious || b.corpse) && !b._medic && !b._drag && !b.duty;

const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...rest) {
  const out = upd.call(this, dt, player, ...rest);
  try { look(this, dt, player); } catch (e) { /* nobody comes */ }
  return out;
};
function look(P, dt, player) {
  // those already at it
  for (const p of P.list) {
    const I = p._insp; if (!I) continue;
    const b = I.b;
    if (!P.list.includes(b) || !down(b) || p.hidden || p.fallen > 0 || p.ko || (I.ph !== 'go' && p.mode !== 'watch')) { end(p); continue; }
    if (I.ph === 'go') { if ((I.t += dt) > 30) end(p); continue; }
    I.t += dt;
    if (I.ph === 'kneel' && I.t >= KNEEL) {
      I.ph = 'after'; I.t = 0;
      // most ring for help; some just stand there looking
      if (Math.random() < 0.65) p.act = { kind: 'react', clip: 'phone', speed: 1, t: 0, dur: 8 + Math.random()*5 };
      else p.anim = Math.random() < 0.5 ? 'arms_folded' : 'idle';
      p.wait = 10 + Math.random()*10;
    }
  }
  if ((P._inspT = (P._inspT || 0) - dt) > 0) return;
  P._inspT = 1.5;
  const px = player ? player.x : 0, pz = player ? player.z : 0;
  for (const b of P.list) {
    if (!down(b) || Math.abs(b.x - px) > 70 || Math.abs(b.z - pz) > 70) continue;
    b._dnT = (b._dnT || 0) + 1.5;
    if (b._dnT < 6 || (b._seen || 0) >= (b._vetalBody ? 2 : 1)) continue;
    if (P.list.some(q => q._insp && q._insp.b === b) || Math.random() > 0.4) continue;
    // the nearest one walking by
    let w = null, bd = 28;
    for (const q of P.list) {
      if (q === b || q.cop || q.pax || q.hidden || q.fallen > 0 || q.ko || q.ctl || q.duty || q.act || q._insp || q.fixed || q.rideOf || q.mode !== 'walk') continue;
      const dd = Math.hypot(q.x - b.x, q.z - b.z); if (dd < bd) { bd = dd; w = q; }
    }
    if (!w) continue;
    b._seen = (b._seen || 0) + 1;
    const n = neckOf(b, tg), yb = b._rag && b._rag.p ? Math.atan2(b._rag.p[2] - b._rag.p[8], b._rag.p[0] - b._rag.p[6]) : (b.yaw || 0);
    // beside them, at the shoulder, on whichever side is nearer
    const sx = -Math.sin(yb), sz = Math.cos(yb), side = ((w.x - n.x)*sx + (w.z - n.z)*sz) >= 0 ? 1 : -1;
    const kx = n.x + sx*side*0.62 - Math.cos(yb)*0.1, kz = n.z + sz*side*0.62 - Math.sin(yb)*0.1;
    w._insp = { b, ph: 'go', t: 0 };
    w.anchor = null;
    P.goTo(w, kx, kz, (q) => {
      if (!q._insp) return;
      const c = neckOf(b, tg);
      q.mode = 'watch'; q.watch = { x: c.x, z: c.z }; q.wait = KNEEL + 25; q.v = 0; q.anim = 'idle';
      q.yaw = Math.atan2(c.z - q.z, c.x - q.x);
      q._insp.ph = 'kneel'; q._insp.t = 0;
      if (P.speakAs) setTimeout(() => { try { P.speakAs('crowd', q, 0.7); } catch (e) { /* quiet */ } }, 2500);
    }, false);
  }
}
function end(p) { const I = p._insp; p._insp = null; if (I && I.ph === 'go' && p.mode === 'free') { p.mode = 'walk'; } }

// down on one knee beside them, the hand to the neck, then the shoulder; a look round; up
const post = Crowd.prototype.postPed;
Crowd.prototype.postPed = function (p, H, dt) {
  const r0 = post ? post.call(this, p, H, dt) : undefined;
  const I = p._insp;
  if (!I || I.ph !== 'kneel' || !H) return r0;
  const t = I.t, k = smooth(t/0.9)*(1 - smooth((t - (KNEEL - 1))/1));
  if (k < 0.01) return r0;
  safe(() => kneel(p, H, I, t, k));
  return r0;
};
function kneel(p, H, I, t, k) {
  H.root.updateMatrixWorld(true);
  axes(p.yaw || 0, f, r);
  const fl = worldOf(H, 'foot_l', new THREE.Vector3()), fr = worldOf(H, 'foot_r', new THREE.Vector3());
  // down: the hips drop, the left foot planted ahead, the right knee to the ground behind it
  shiftPelvis(H, d.set(0, -0.5*k, 0).addScaledVector(f, -0.05*k));
  if (fl) { ft.copy(fl).addScaledVector(f, 0.18*k); pole.copy(f).addScaledVector(UP, 0.3); ikLeg(H, 'l', ft, pole, 1); }
  if (fr) { ft.copy(fr).addScaledVector(f, -0.32*k); ft.y += 0.04*k; pole.copy(f).addScaledVector(UP, -0.6); ikLeg(H, 'r', ft, pole, 1); }
  // over them: the back bends, the head looks down at them; later up and round at whoever's there
  const lookUp = smooth((t - 5)/0.6)*(1 - smooth((t - 6.2)/0.5));
  turn(bone(H, 'spine_01'), r, -0.3*k); turn(bone(H, 'spine_02'), r, -0.22*k); turn(bone(H, 'spine_03'), r, -0.1*k);
  turn(bone(H, 'neck_01'), r, (-0.2 + 0.45*lookUp)*k); turn(bone(H, 'Head'), UP, 0.5*lookUp*Math.sin(t*1.3)*k);
  H.root.updateMatrixWorld(true);
  // the right hand: to the neck for a pulse (still), then the shoulder (shaking it), then back to the knee
  const n = neckOf(I.b, tg);
  const pulse = smooth((t - 0.8)/0.6)*(1 - smooth((t - 3.4)/0.4)), shake = smooth((t - 3.5)/0.4)*(1 - smooth((t - 5)/0.4));
  if (pulse + shake > 0.01) {
    const yb = I.b._rag && I.b._rag.p ? Math.atan2(I.b._rag.p[2] - I.b._rag.p[8], I.b._rag.p[0] - I.b._rag.p[6]) : (I.b.yaw || 0);
    const sh = Math.sin(t*14)*0.035*shake;
    tg.set(n.x - Math.cos(yb)*0.2*shake + f.x*sh, n.y + 0.04 + 0.03*shake, n.z - Math.sin(yb)*0.2*shake + f.z*sh);
    pole.copy(r).multiplyScalar(0.8).addScaledVector(UP, -0.5);
    ikArm(H, 'r', tg, pole, (pulse + shake)*k);
  }
  // the left resting on the raised knee
  const kn = worldOf(H, 'calf_l', d);
  if (kn) { tg.copy(kn).addScaledVector(UP, 0.06); pole.copy(r).multiplyScalar(-0.9).addScaledVector(UP, -0.3); ikArm(H, 'l', tg, pole, 0.85*k); }
}
