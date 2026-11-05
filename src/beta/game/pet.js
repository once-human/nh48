// With the animals, hands on: F at a dog and you walk up to it, squat down on your heels (feet flat, a forearm on
// your knee) and stroke its head and down its neck, or hold the biscuit out under its nose until it's taken; at a
// cow with a banana you hold it up to her mouth, and without one you fold your hands to her, head bowed. (It was a
// pick-up bend or a nod wherever you happened to be standing, the hand nowhere near the animal.)
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Strays } from '@orig/people/strays.js';
import { Game } from '@orig/game/game.js';
import { ikArm } from '@orig/people/humans.js';
import { ikLeg } from './fists.js';
import { grip } from '../vehicles/fit.js';

const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bone = (H, n) => (H._pb || (H._pb = {}))[n] || (H._pb[n] = H.root.getObjectByName(n));
const HEAD = { dog: 'Bone003', cat: 'Bone003', cow: 'Head' };     // (the loader drops the dots: Bone.003 in the file)
const _hd = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3(), _r = new THREE.Vector3(), _k = new THREE.Vector3();
const _ft = [new THREE.Vector3(), new THREE.Vector3()], _fq = [new THREE.Quaternion(), new THREE.Quaternion()], _pq = new THREE.Quaternion(), _q = new THREE.Quaternion();
function turn(b, axis, ang) {
  if (!b || !b.parent || !ang) return;
  b.parent.getWorldQuaternion(_pq).invert();
  b.quaternion.premultiply(_q.setFromAxisAngle(_t.copy(axis).applyQuaternion(_pq), ang));
}
// where the animal's head is now (its model's head bone when it's drawn, else from where it stands)
function headOf(G, a, out) {
  const kind = a.kind || (a.cow ? 'cow' : 'dog'), m = G.fauna && G.fauna.models && G.fauna.models.get(a);
  const b = m && m.holder.visible && m.root.getObjectByName(HEAD[kind] || 'Head');
  if (b) { m.root.updateMatrixWorld(true); return b.getWorldPosition(out); }
  const f = kind === 'cow' ? 1.0 : kind === 'cat' ? 0.2 : 0.35, y = kind === 'cow' ? 1.25 : kind === 'cat' ? 0.25 : 0.45;
  return out.set(a.x + Math.cos(a.yaw || 0)*f, y, a.z + Math.sin(a.yaw || 0)*f);
}

const inter = Strays.prototype.interact;
Strays.prototype.interact = function (a) {
  const G = this.g, L = G.life, P = G.player, dog = a.kind === 'dog';
  const feed = dog ? L.has('dogfood') || L.has('biscuit') : L.has('banana');
  inter.call(this, a);
  if (!P.onFoot || !P.human) return;
  start(P, a, dog ? 'dog' : 'cow', dog ? (feed ? 'feed' : 'pet') : (feed ? 'feed' : 'namaskar'));
};
function start(P, a, kind, how) {
  const D = { pet: 2.6, feed: 2.4, namaskar: 1.9, touch: 2.5 }[how];
  P._pet = { a, kind, how, t: 0, D, go: true, goT: 0 };
  // it stands for you while you're at it
  if (!(a.free && a.free.mode === 'follow')) { a.rest = Math.max(a.rest || 0, D + 2.5); a.moving = false; }
  P.act = { kind: 'hurt', t: 0, dur: D + 1.6 };           // (ended early once the pose is done: below)
  P.human.play('idle', { fade: 0.25, restart: false });
}
// F right by an animal (the game's own pet: a crouch clip with an arm waved at its back): the same, by hand.
// A cow you touch for luck the way it's done: your fingers to her forehead, then to your own
Game.prototype.petAnimal = function (a) {
  const P = this.player, F = P.foot, H = P.human;
  if (!P.onFoot || !H) return;
  if (this.rep) this.rep.good(a.x, a.z, 0.35);          // the lane notices who's kind to its dogs
  F.vx = F.vz = 0;
  a.petT = 3.2; a.petPh = 0; a.petX = F.x; a.petZ = F.z;
  const cow = a.cow || a.kind === 'cow';
  start(P, a, cow ? 'cow' : a.kind === 'cat' ? 'cat' : 'dog', cow ? 'touch' : 'pet');
  if (a.kind === 'cat') this.later(0.9, () => this.audio && this.audio.purr && this.audio.purr());
  else if (!cow) this.later(0.9, () => this.audio && this.audio.bark && this.audio.bark(0.25));
};

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...rest) {
  const S = this._pet, F = this.foot, G = window.__nhAskG;
  if (!S || !G) return upd.call(this, dt, ...rest);
  if (!this.onFoot || this.downT || !this.act || this.act.kind !== 'hurt' || F.air || F.swim) { this._pet = null; return upd.call(this, dt, ...rest); }
  const a = S.a, H = this.human, cow = S.kind === 'cow';
  headOf(G, a, _hd);
  // up to it first: a few steps until you're close enough to reach (squatting by a dog, an arm's length from a cow)
  const want = cow ? 0.85 : S.kind === 'cat' ? 0.45 : 0.5, dx = _hd.x - F.x, dz = _hd.z - F.z, d = Math.hypot(dx, dz), face = Math.atan2(dz, dx);
  if (S.go) {
    S.goT += dt;
    if (d > want + 0.04 && S.goT < 2.5) {
      // an unhurried walk, the clip's own pace (feet don't slide)
      const s = Math.min(1.0*dt, d - want);
      F.x += dx/d*s; F.z += dz/d*s;
      H.play('walk', { fade: 0.2, speed: 0.8 });
    } else { S.go = false; H.play('idle', { fade: 0.3 }); }
    this.act.t = 0;
  }
  F.yaw += wrap(face - F.yaw)*Math.min(1, dt*(S.go ? 10 : 6));
  upd.call(this, dt, ...rest);
  if (S.go) return;
  S.t += dt;
  const t = S.t, D = S.D;
  if (t >= D) { this._pet = null; this.act = null; H.play('idle', { fade: 0.3 }); return; }
  const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
  _r.set(-fz, 0, fx);
  H.root.updateMatrixWorld(true);

  if (S.kind !== 'cow') {
    // down on your heels and back up
    const c = sm(t/0.5)*(1 - sm((t - (D - 0.55))/0.5));
    for (let i = 0; i < 2; i++) { const fb = bone(H, i ? 'foot_r' : 'foot_l'); if (fb) { fb.getWorldPosition(_ft[i]); fb.getWorldQuaternion(_fq[i]); } }
    H.holder.position.y -= (S.kind === 'cat' ? 0.5 : 0.44)*c;
    H.root.updateMatrixWorld(true);
    turn(bone(H, 'spine_01'), _r, -0.4*c); turn(bone(H, 'spine_02'), _r, -0.26*c);
    turn(bone(H, 'neck_01'), _r, 0.3*c);                 // the head up to look at the dog
    H.root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const sd = i ? 'r' : 'l', fb = bone(H, 'foot_' + sd); if (!fb) continue;
      // the knees forward and a little apart
      _p.set(fx, 0.3, fz).addScaledVector(_r, i ? 0.35 : -0.35);
      ikLeg(H, sd, _ft[i], _p, 1);
      fb.parent.getWorldQuaternion(_pq).invert(); fb.quaternion.copy(_pq.multiply(_fq[i]));
    }
    H.root.updateMatrixWorld(true);
    // the left forearm across the left knee
    const kn = bone(H, 'calf_l');
    if (kn) { kn.getWorldPosition(_k); _t.copy(_k).addScaledVector(_r, 0.06).add(_p.set(fx*0.12, 0.06, fz*0.12)); ikArm(H, 'l', _t, _p.set(-fx*0.2, -1, -fz*0.2).addScaledVector(_r, -0.6), c*0.9); }
    // the right hand to the dog: over its head and down its neck, or still under its nose with the biscuit
    const h = sm((t - 0.35)/0.4)*(1 - sm((t - (D - 0.75))/0.35));
    if (h > 0.01) {
      const ax = Math.cos(a.yaw || 0), az = Math.sin(a.yaw || 0);
      if (S.how === 'pet') {
        const s = 0.5 - 0.5*Math.cos((t - 0.35)*2*Math.PI*1.3);     // head to neck and back, a stroke and a bit
        const L = S.kind === 'cat' ? 0.6 : 1;                        // (a cat's a smaller stroke)
        _t.set(_hd.x - ax*(0.02 + 0.16*s*L), _hd.y + 0.09*L - 0.03*s, _hd.z - az*(0.02 + 0.16*s*L));
      } else _t.set(_hd.x + ax*0.13, _hd.y - 0.06, _hd.z + az*0.13);
      ikArm(H, 'r', _t, _p.set(fx*0.1, -1, fz*0.1).addScaledVector(_r, 0.6), h);
      grip(H, 'r', -0.85*h);                                 // the hand open and flat
    }
  } else if (S.how === 'feed') {
    // the banana up to her mouth, leaning in a little
    const h = sm(t/0.45)*(1 - sm((t - (D - 0.5))/0.45));
    turn(bone(H, 'spine_02'), _r, -0.12*h); H.root.updateMatrixWorld(true);
    const ax = Math.cos(a.yaw || 0), az = Math.sin(a.yaw || 0);
    _t.set(_hd.x + ax*0.28, Math.max(0.9, _hd.y - 0.2), _hd.z + az*0.28);
    ikArm(H, 'r', _t, _p.set(fx*0.1, -1, fz*0.1).addScaledVector(_r, 0.7), h);
  } else if (S.how === 'touch') {
    // the fingers to her forehead, a moment there, then to your own forehead, and down
    const up = sm(t/0.5), on = sm((t - 1.0)/0.45), down = sm((t - (D - 0.5))/0.45), h = up*(1 - down);
    turn(bone(H, 'spine_02'), _r, -0.1*h*(1 - on)); turn(bone(H, 'neck_01'), _r, -0.18*on*(1 - down));
    H.root.updateMatrixWorld(true);
    const ax = Math.cos(a.yaw || 0), az = Math.sin(a.yaw || 0), hd = bone(H, 'Head');
    _k.set(_hd.x + ax*0.12, _hd.y + 0.12, _hd.z + az*0.12);                 // her forehead
    if (hd) { hd.getWorldPosition(_t); _t.add(_p.set(fx*0.14, 0.06, fz*0.14)); _k.lerp(_t, on); }   // yours
    _t.copy(_k);
    ikArm(H, 'r', _t, _p.set(-fx*0.2*on, -1, -fz*0.2*on).addScaledVector(_r, 0.8), h);
    grip(H, 'r', -0.8*h);
  } else {
    // namaskar: palms together in front of the chest, the head and shoulders bowed to her
    const h = sm(t/0.4)*(1 - sm((t - (D - 0.45))/0.4));
    turn(bone(H, 'spine_03'), _r, -0.16*h); turn(bone(H, 'neck_01'), _r, -0.28*h);
    H.root.updateMatrixWorld(true);
    const s3 = bone(H, 'spine_03');
    if (s3) {
      s3.getWorldPosition(_k).add(_p.set(fx*0.24, 0.1, fz*0.24));
      for (const [sd, o] of [['l', -0.03], ['r', 0.03]]) { ikArm(H, sd, _t.copy(_k).addScaledVector(_r, o), _p.set(-fx*0.3, -1, -fz*0.3).addScaledVector(_r, sd === 'l' ? -0.9 : 0.9), h); grip(H, sd, -0.95*h); }
    }
  }
  H.root.updateMatrixWorld(true);
};
