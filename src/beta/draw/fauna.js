// Animals that do more than walk. The models only come with an idle and a walk, so the rest is put on their bones
// after the clip: a dog's tail wags (hard when it's your friend or being petted, up when it's after you, tucked when
// it runs off), it sniffs the ground standing about, drops its chest and growls when it's close to biting, and a
// bite is a lunge and a snap of the head (you flinch). Cows graze, head down, for long spells, and swish their tails.
// Cats keep their tail up and swaying. Anything close turns its head to watch you.
import * as THREE from 'three';
import { Fauna } from '@orig/people/animals.js';

const Y = new THREE.Vector3(0, 1, 0), _r = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the dog and cat rigs (same skeleton): chest, neck, head, tail root to tip
const RIG = {
  dog: { chest: 'Bone.001', neck: 'Bone.002', head: 'Bone.003', tail: ['Bone.004', 'Bone.005', 'Bone.006'] },
  cat: { chest: 'Bone.001', neck: 'Bone.002', head: 'Bone.003', tail: ['Bone.004', 'Bone.005', 'Bone.006'] },
  cow: { chest: 'Torso', neck: 'Neck', head: 'Head', tail: ['Tail1', 'Tail2', 'Tail3'] },
};
// turn a bone by one or two world-axis turns on top of the clip's pose (never on top of last frame's turn)
const _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _ax = new THREE.Vector3();
function bend(b, a1, t1, a2, t2) {
  if (!b || !b.parent) return;
  const u = b.userData;
  if (u.fq && b.quaternion.equals(u.fq)) b.quaternion.copy(u.fb); else (u.fb || (u.fb = new THREE.Quaternion())).copy(b.quaternion);
  b.parent.getWorldQuaternion(_pq).invert();
  if (t1) b.quaternion.premultiply(_rq.setFromAxisAngle(_ax.copy(a1).applyQuaternion(_pq), t1));
  if (a2 && t2) b.quaternion.premultiply(_rq.setFromAxisAngle(_ax.copy(a2).applyQuaternion(_pq), t2));
  (u.fq || (u.fq = new THREE.Quaternion())).copy(b.quaternion);
}
const bone = (m, n) => (m._fb || (m._fb = {}))[n] !== undefined ? m._fb[n] : (m._fb[n] = m.root.getObjectByName(n) || null);

const update = Fauna.prototype.update;
Fauna.prototype.update = function (dt, cx, cz) {
  update.call(this, dt, cx, cz);
  if (!this.kit) return;
  const G = window.__nhAskG, P = G && G.player;
  for (const [a, m] of this.models) {
    if (!m.holder.visible) continue;
    const kind = a.kind || (a.cow ? 'cow' : 'dog'), R = RIG[kind]; if (!R) continue;
    const d = Math.abs(a.x - cx) + Math.abs(a.z - cz); if (d > 45) continue;
    const S = a._fx || (a._fx = { t: Math.random()*10, sniff: 0, sniffT: 3 + Math.random()*8, look: 0, bite: 0, pb: 0 });
    S.t += dt;
    const f = a.free, mode = f && f.mode;
    _r.set(-Math.sin(a.yaw), 0, Math.cos(a.yaw));
    m.root.updateMatrixWorld(true);
    // a bite just happened (people/strays.js resets its clock): lunge and snap, and you flinch
    if (f && f.bite > S.pb + 1) {
      S.bite = 0.38;
      if (P && P.onFoot && !P.act) { P.act = { kind: 'hurt', t: 0, dur: 0.3 }; P.human.play('hit', { once: true, fade: 0.06, restart: true }); }
      G.audio.bark?.(1); G.audio.thud?.(0.15);
    }
    S.pb = f ? f.bite || 0 : 0;
    // standing about: a dog sniffs the ground, a cow grazes for long spells
    if (!a.moving && !mode && (S.sniffT -= dt) <= 0) { S.sniff = S.sniff ? 0 : 1; S.sniffT = S.sniff ? (kind === 'cow' ? 8 + Math.random()*12 : 1.5 + Math.random()*2.5) : 4 + Math.random()*10; }
    if (a.moving || mode) S.sniff = 0;
    S.sn = (S.sn || 0) + ((S.sniff ? 1 : 0) - (S.sn || 0))*Math.min(1, dt*2.5);
    // watching you, when you're close
    let want = 0;
    if (P) { const dx = P.x - a.x, dz = P.z - a.z, pd = Math.hypot(dx, dz), rel = wrap(Math.atan2(dz, dx) - a.yaw); if (pd < (kind === 'cow' ? 5 : 4) && Math.abs(rel) < 2 && !S.sniff) want = Math.max(-0.9, Math.min(0.9, rel)); }
    S.look += (want - S.look)*Math.min(1, dt*3);
    const neck = bone(m, R.neck), head = bone(m, R.head), chest = bone(m, R.chest);
    // chasing close: chest down, head low, ready to go
    const close = mode === 'chase' && P && Math.hypot(P.x - a.x, P.z - a.z) < 2.6;
    S.cr = (S.cr || 0) + ((close ? 1 : 0) - (S.cr || 0))*Math.min(1, dt*4);
    let bk = 0;
    if (S.bite > 0) { S.bite -= dt; const k = 1 - S.bite/0.38; bk = Math.sin(Math.PI*k); m.holder.position.x += Math.cos(a.yaw)*0.28*bk; m.holder.position.z += Math.sin(a.yaw)*0.28*bk; m.holder.updateMatrixWorld(true); }
    if (chest) bend(chest, _r, -0.18*S.cr);
    bend(neck, _r, -(kind === 'cow' ? 0.9 : 0.6)*S.sn - 0.25*S.cr + 0.35*bk, Y, -S.look*0.45);
    bend(head, _r, -(kind === 'cow' ? 0.3 : 0.35)*S.sn - 0.5*bk, Y, -S.look*0.4);
    // the tail
    const happy = a.petT > 0 || a.wag > 0 || mode === 'follow';
    let amp, rate, lift;
    if (kind === 'cow') { amp = 0.35; rate = 2.2 + Math.sin(S.t*0.3); lift = 0; }
    else if (kind === 'cat') { amp = 0.18; rate = 1.4; lift = 0.6; }
    else if (mode === 'flee') { amp = 0.05; rate = 6; lift = -0.7; }
    else if (mode === 'chase') { amp = 0.12; rate = 5; lift = 0.6; }
    else if (happy) { amp = 0.6; rate = 14; lift = 0.4; }
    else { amp = 0.22; rate = 5; lift = 0.1; }
    const sw = Math.sin(S.t*rate)*amp;
    R.tail.forEach((n, i) => bend(bone(m, n), Y, sw*(0.6 + i*0.25), _r, i === 0 ? lift : 0));
  }
};
