// A street fight, the whole of it. Click punches (jab, cross, hook, then an uppercut and one to the body if you keep
// going); hold the right button and your guard comes up: most of a blow lands on your arms, and one blocked just as
// you raised it is a parry (they stagger, and your next one lands harder). Right button and a click together is a
// shove if they're on top of you, a front kick if they're a step away. Someone on the ground gets a kick or a stamp,
// and a body gets moved. Running into a punch puts your weight behind it. Punching tires you: a few too many and
// they're slower and softer, and a guard that takes too much breaks.
// Hands: with the torch (or anything that isn't for hitting) in your right hand, the left does all the work, jab,
// hook, uppercut, body shot, from your guard. The arm, leg and chest moves that aren't in the clips are put on the
// body here, after the clip's pose, so either hand can throw any of them.
import * as THREE from 'three';
import { Brawl, MOVES } from '@orig/people/fight.js';
import { Pilot } from '@orig/game/pilot.js';
import { ikArm, bendBone } from '@orig/people/humans.js';
import { ARMS } from '@orig/game/arms.js';

const GUARD = 40, Y_UP = new THREE.Vector3(0, 1, 0);
const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// moves put on the body here (side: which hand or foot), and the ones from the clips with a new weight
const PROC = {
  jab: { dur: 0.42, hit: 0.17, dmg: 9, reach: 1.2, push: 0.2 },
  hookP: { dur: 0.6, hit: 0.3, dmg: 18, reach: 1.15, push: 0.5, down: 0.35 },
  upper: { dur: 0.62, hit: 0.3, dmg: 20, reach: 1.05, push: 0.45, down: 0.5 },
  body: { dur: 0.5, hit: 0.22, dmg: 12, reach: 1.15, push: 0.3, wind: true },
  kick: { dur: 0.72, hit: 0.36, dmg: 14, reach: 1.6, push: 0.4, down: 1, leg: true },
  stomp: { dur: 0.78, hit: 0.44, dmg: 18, reach: 1.3, push: 0.1, down: 1, leg: true },
  front: { dur: 0.72, hit: 0.33, dmg: 15, reach: 1.75, push: 1.3, down: 0.3, leg: true },
};
const LUNGE = { clip: 'cross', speed: 1.15, dur: 0.72, hit: 0.34, dmg: 21, reach: 1.7, push: 1.1, down: 0.55 };
const COST = { jab: 0.1, punch: 0.1, cross: 0.12, hook: 0.16, hookP: 0.16, upper: 0.17, body: 0.12, kick: 0.18, stomp: 0.2, front: 0.2, lunge: 0.22, shove: 0.1 };

// which arm each clip throws, read off the clip (how far each arm's bones swing)
const swing = (clip, side) => {
  let m = 0;
  for (const t of clip.tracks) {
    if (!t.name.endsWith('.quaternion') || !new RegExp(`(upperarm|lowerarm)_${side}\\.`).test(t.name)) continue;
    const v = t.values, n = v.length/4;
    for (let i = 0; i < n; i += 2) for (let j = i + 2; j < n; j += 2) { const d = Math.abs(v[i*4]*v[j*4] + v[i*4 + 1]*v[j*4 + 1] + v[i*4 + 2]*v[j*4 + 2] + v[i*4 + 3]*v[j*4 + 3]); m = Math.max(m, 2*Math.acos(Math.min(1, d))); }
  }
  return m;
};
let HANDS = null;
function hands(kit) {
  if (HANDS || !kit || !kit.clips) return HANDS || {};
  HANDS = {};
  for (const n of ['punch', 'cross', 'hook']) { const c = kit.clips[n]; if (c) { const l = swing(c, 'l'), r = swing(c, 'r'); HANDS[n] = l > r*1.2 ? 'l' : r > l*1.2 ? 'r' : 'both'; } }
  return HANDS;
}
// the right hand has something in it that isn't for hitting with
function rightBusy(G) {
  const P = G.player, L = G.lights, A = G.arms;
  if (L && L.torchOn && L.tm && L.tm.visible && P.onFoot) return 'torch';
  const W = A && A.held && ARMS[A.held];
  if (A && A.held && !(W && W.melee)) return A.held;
  return null;
}

// ---------------------------------------------------------------- the mouse's right button, held
let RMB = false;
addEventListener('mousedown', (e) => { if (e.button === 2 && document.pointerLockElement) RMB = true; });
addEventListener('mouseup', (e) => { if (e.button === 2) RMB = false; });
addEventListener('blur', () => { RMB = false; });

// ---------------------------------------------------------------- choosing the move
const pickTarget = Brawl.prototype.pickTarget;
// someone on the ground in front of you (out cold, knocked down, or worse)
Brawl.prototype.downAt = function () {
  const F = this.P.foot, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
  let best = null, bs = 1e9;
  for (const p of this.people.list) {
    if (p.hidden || p.pax || !(p.fallen > 0)) continue;
    const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz);
    if (d > 2 || d < 1e-3) continue;
    const c = (dx*fx + dz*fz)/d; if (c < 0.3 && d > 0.7) continue;
    const s = d*(1.6 - c); if (s < bs) { bs = s; best = p; }
  }
  return best;
};
Brawl.prototype.attack = function (special) {
  const P = this.P, G = this.g, F = P.foot;
  if (!special && G.arms && G.arms.use()) return;            // spray, fire (arms.js)
  let tg = pickTarget.call(this);
  const S = G.strays;
  if (!special && S && !tg) { const a = S.near(F.x + Math.cos(F.yaw)*0.9, F.z + Math.sin(F.yaw)*0.9, 1.5); if (a && a.kind === 'cow') { S.namaskar(a); return; } }
  if (!tg || tg.veh || tg.fallen > 0) { const d = this.downAt(); if (d) tg = d; }
  const H = hands(G.W && G.W.kit), busy = rightBusy(G), tired = (this.stam ?? 1) < 0.25;
  if (this.comboT <= 0) this.combo = 0;
  let name, side = null, M;
  if (tg && !tg.veh && tg.fallen > 0) name = this.rng.next() < 0.5 ? 'stomp' : 'kick', side = 'r';
  else if (special) {
    const d = tg && !tg.veh ? Math.hypot(tg.x - F.x, tg.z - F.z) : 9;
    name = d < 1.05 ? 'shove' : 'front'; side = 'r';
  } else if (F.v > 4.2 && !busy && !tired && !(G.arms && G.arms.held)) name = 'lunge';
  else if (busy) {
    // one hand free: the left throws everything
    const SET = ['jab', 'jab', 'hookP', 'upper', 'body'];
    name = SET[this.combo % SET.length]; side = 'l';
    this.combo = (this.combo + 1) % SET.length;
  } else if (G.arms && G.arms.held) {
    // a lathi, a bat, a knife: the clip swings it
    const SET = ['punch', 'cross', 'hook'];
    name = SET[this.combo % SET.length]; this.combo = (this.combo + 1) % SET.length;
  } else {
    // both hands: the three from the clips, then an uppercut with the other hand from the hook, then one to the body
    const SET = ['punch', 'cross', 'hook', 'upper', 'body'];
    name = SET[this.combo % SET.length]; this.combo = (this.combo + 1) % SET.length;
    const hk = H.hook === 'l' ? 'r' : 'l';
    if (name === 'upper') side = hk;
    if (name === 'body') side = hk === 'l' ? 'r' : 'l';
  }
  this.comboT = 0.95;
  const base = name === 'shove' ? MOVES.push : name === 'lunge' ? LUNGE : PROC[name] || MOVES[name];
  M = { ...(G.arms && !PROC[name] ? G.arms.meleeOf(base) : base) };
  // tired: slower and softer; straight after a parry: harder
  let mul = tired ? 0.7 : 1, sp = tired ? 0.8 : 1;
  if (this.counterT > 0) { mul *= 1.5; this.counterT = 0; }
  M.dmg *= mul;
  const dur = M.dur/sp, hit = M.hit/sp;
  this.stam = Math.max(0, (this.stam ?? 1) - (COST[name] || 0.12)); this.restT = 0;
  P.act = { kind: 'atk', name, t: 0, dur, hit, M, target: tg, done: false, side, proc: !!PROC[name] && !PROC[name].leg, leg: !!(PROC[name] && PROC[name].leg) };
  if (PROC[name]) P.human.play('idle', { fade: 0.12 });
  else P.human.play(M.clip, { once: true, fade: 0.06, speed: M.speed*sp, restart: true });
  G.audio.whoosh?.(PROC[name] && PROC[name].leg ? 0.6 : 0.5);
};

// what lands: on a body it moves it; kicking someone who's down costs you more than a fair fight
const land = Brawl.prototype.landPlayer;
Brawl.prototype.landPlayer = function (A) {
  const q = A.target, G = this.g, F = this.P.foot;
  if (q && !q.veh && q.corpse) {
    const dx = q.x - F.x, dz = q.z - F.z, d = Math.hypot(dx, dz) || 1;
    if (d > A.M.reach + 0.3) return;
    q.x += dx/d*0.22; q.z += dz/d*0.22;
    G.audio.thud?.(0.3); G.rig?.shake?.(0.05);
    if (!q._kicked) { q._kicked = true; G.life?.change('karma', -3); this.started(q); }
    return;
  }
  const was = q && !q.veh && q.fallen > 0;
  land.call(this, A);
  if (was && G.life) G.life.change('karma', -1);
  // a blow to the body winds them: they stand there a moment longer
  if (A.M.wind && q && !q.veh && q.stun > 0) q.stun += 0.35;
};

// ---------------------------------------------------------------- guard, parry, the guard breaking
const hurt = Brawl.prototype.hurtPlayer;
Brawl.prototype.hurtPlayer = function (dmg, sx, sz) {
  const P = this.P, F = P.foot, G = this.g;
  if (this.guarding && P.onFoot && !P.ko && !(P.downT > 0)) {
    const dx = sx - F.x, dz = sz - F.z, d = Math.hypot(dx, dz) || 1, c = (dx*Math.cos(F.yaw) + dz*Math.sin(F.yaw))/d;
    if (c > 0.2) {
      // who threw it
      let by = null, bd = 0.5;
      for (const p of this.people.list) { const e = Math.hypot(p.x - sx, p.z - sz); if (e < bd && p.act && p.act.kind === 'atk') { bd = e; by = p; } }
      const shove = by && by.act.M === MOVES.push;
      if (!shove && this.guardT < 0.22 && by) {
        // a parry: their arm knocked aside, them off balance
        by.stun = 0.75; by.act = { kind: 'hurt', clip: 'hit', speed: 1, t: 0, dur: 0.5 }; by.actId = (by.actId || 0) + 1; by.atkT = Math.max(by.atkT || 0, 1);
        this.counterT = 1.1; this.active = 0.01;
        G.audio.thud?.(0.45); G.rig?.shake?.(0.06);
        return true;
      }
      if (!shove) {
        this.guardHp = (this.guardHp ?? GUARD) - dmg; P.hurtT = 0; this.active = 0.01;
        P.hp = Math.max(1, P.hp - dmg*0.15);
        F.x -= dx/d*0.1; F.z -= dz/d*0.1;
        G.audio.thud?.(0.3); G.rig?.shake?.(0.04 + dmg/300);
        this.blockT = 0.18;
        if (this.guardHp > 0) return true;
        // too much: the guard goes, and the rest gets through
        this.guardHp = 0; this.breakT = 1.4; this.guarding = false; dmg *= 0.6;
      } else {
        // shoved through your guard: it comes down for a moment
        this.breakT = 0.6; this.guarding = false;
        F.x -= dx/d*0.45; F.z -= dz/d*0.45;
      }
    }
  }
  return hurt.call(this, dmg, sx, sz);
};

const update = Brawl.prototype.update;
Brawl.prototype.update = function (dt, input) {
  const P = this.P, G = this.g, F = P.foot;
  hook(G);
  this.restT = (this.restT || 0) + dt;
  this.stam = Math.min(1, (this.stam ?? 1) + dt*(this.restT > 0.6 ? 0.35 : 0.06));
  this.guardHp = Math.min(GUARD, (this.guardHp ?? GUARD) + dt*((P.hurtT || 0) > 1 ? 12 : 0));
  this.counterT = (this.counterT || 0) - dt; this.breakT = (this.breakT || 0) - dt; this.blockT = (this.blockT || 0) - dt;
  const free = P.onFoot && !P.ko && !(P.downT > 0) && F && !F.climb && !F.air && !F.swim && G.state === 'play';
  const was = this.guarding;
  this.guarding = free && RMB && !(this.breakT > 0) && !P.act;
  this.guardT = this.guarding ? (was ? this.guardT + dt : 0) : 0;
  // right button and a click: a shove or a front kick
  if (free && RMB && !(this.breakT > 0) && !P.act && (input.took('Mouse0') || input.took('KeyX'))) { this.guarding = false; this.attack(true); }
  update.call(this, dt, input);
  // running into a punch: your weight goes with it
  const A = P.act;
  if (A && A.kind === 'atk' && A.name === 'lunge' && A.t < A.hit && F) { const k = 1 - A.t/A.hit; F.x += Math.cos(F.yaw)*dt*4.2*k; F.z += Math.sin(F.yaw)*dt*4.2*k; }
};

// with your guard up you walk (no sprinting) and keep facing whoever you're fighting
const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, input, traffic, camYaw) {
  const B = window.__nhAskG && window.__nhAskG.brawl;
  if (!B || !B.guarding || !input || !input.key) return upd.call(this, dt, input, traffic, camYaw);
  const q = Object.create(input);
  q.key = (...c) => c.includes('ShiftLeft') || c.includes('ShiftRight') ? false : c.includes('AltLeft') ? true : input.key(...c);
  const out = upd.call(this, dt, q, traffic, camYaw), F = this.foot;
  const t = pickTarget.call(B);
  if (F && t && !t.veh) { F.yaw += wrap(Math.atan2(t.z - F.z, t.x - F.x) - F.yaw)*Math.min(1, dt*10); this.human.holder.rotation.set(0, -F.yaw, 0); }
  return out;
};

// ---------------------------------------------------------------- the body: guard, punches and kicks after the clip
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _e = new THREE.Vector3();
const _n = new THREE.Vector3(), _s = new THREE.Vector3(), _g = new THREE.Vector3(), _k = new THREE.Vector3(), _p = new THREE.Vector3(), _h = new THREE.Vector3();
const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _q0 = new THREE.Quaternion(), _q1 = new THREE.Quaternion();
const bone = (H, n) => (H._fb || (H._fb = {}))[n] || (H._fb[n] = H.root.getObjectByName(n));
function aim(b, from, to) {
  _q.setFromUnitVectors(from.normalize(), to.normalize());
  b.getWorldQuaternion(_wq); b.parent.getWorldQuaternion(_pq);
  b.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
  b.updateMatrixWorld(true);
}
// the leg as ikArm does the arm: hip, knee, foot, the knee pushed toward the pole
function ikLeg(H, side, target, pole, w) {
  const u = bone(H, 'thigh_' + side), l = bone(H, 'calf_' + side), f = bone(H, 'foot_' + side);
  if (!u || !l || !f || w <= 0) return;
  H.root.updateMatrixWorld(true);
  _q0.copy(u.quaternion); _q1.copy(l.quaternion);
  u.getWorldPosition(_a); l.getWorldPosition(_b); f.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _t.copy(target).sub(_a);
  const d = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, _t.length())); _t.setLength(d);
  const cosA = (l1*l1 + d*d - l2*l2)/(2*l1*d), sinA = Math.sqrt(Math.max(0, 1 - cosA*cosA));
  const dir = _e.copy(_t).normalize(), s2 = _k.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize();
  _p.copy(dir).multiplyScalar(cosA*l1).addScaledVector(s2, sinA*l1);        // the knee, from the hip
  aim(u, _h.copy(_b).sub(_a), _g.copy(_p));
  l.getWorldPosition(_b); f.getWorldPosition(_c);
  aim(l, _h.copy(_c).sub(_b), _g.copy(_t).add(_a).sub(_b));
  if (w < 1) { u.quaternion.slerpQuaternions(_q0, u.quaternion.clone(), w); l.quaternion.slerpQuaternions(_q1, l.quaternion.clone(), w); }
  H.root.updateMatrixWorld(true);
}
const bez = (o, a, b, c, k) => { const m = 1 - k; return o.set(a.x*m*m + 2*b.x*m*k + c.x*k*k, a.y*m*m + 2*b.y*m*k + c.y*k*k, a.z*m*m + 2*b.z*m*k + c.z*k*k); };
// where a hand rests with the guard up: fists by the chin, elbows in
function guardAt(H, side, fp, out) {
  const N = bone(H, 'neck_01'); if (!N) return null;
  N.getWorldPosition(out);
  const sx = side === 'r' ? 1 : -1;
  out.addScaledVector(_f, fp ? 0.36 : 0.3).addScaledVector(_r, sx*(fp ? 0.15 : 0.11)).y -= fp ? 0.16 : 0.06;
  return out;
}
const _G2 = new THREE.Vector3(), _S2 = new THREE.Vector3(), _M2 = new THREE.Vector3(), _pole = new THREE.Vector3(), _ax = new THREE.Vector3();
function pose(G, H, dt) {
  const P = G.player, B = G.brawl; if (!B || !P.onFoot) return;
  const A = P.act, F = P.foot;
  const clip = A && A.kind === 'atk' && !A.proc && !A.leg;
  let want = 0;
  if (!(P.ko || P.downT > 0) && !(A && (A.kind === 'roll' || A.kind === 'hurt'))) want = B.guarding ? 1 : 0;
  if (clip) want = 0;
  B._gw = (B._gw || 0) + (want - (B._gw || 0))*Math.min(1, dt*(want > (B._gw || 0) ? 12 : 8));
  if (B._gw < 0.01 && !(A && (A.proc || A.leg))) return;
  if (B._gw < 0.01 && A && A.leg && !A.proc) { /* kicks only: arms stay with the clip */ }
  _f.set(Math.cos(F.yaw), 0, Math.sin(F.yaw)); _r.set(-_f.z, 0, _f.x);
  const torch = rightBusy(G) === 'torch', fp = !!H._fp;
  const u = A && A.kind === 'atk' ? A.t/A.dur : 0, hk = A ? A.hit/A.dur : 0.4;
  const e = !A ? 0 : u < hk ? sm(u/hk) : 1 - sm((u - hk)/(1 - hk)*1.15);
  // the chest turns into a punch and leans a little into it, and back from a kick
  if (A && A.proc && A.side) {
    const sp = bone(H, 'spine_03'), s1 = bone(H, 'spine_01');
    if (sp) bendBone(sp, Y_UP, (A.side === 'l' ? -1 : 1)*0.32*e);
    if (s1) bendBone(s1, _ax.copy(_r), -(A.name === 'body' ? 0.22 : 0.1)*e);
  } else if (A && A.leg) {
    const s1 = bone(H, 'spine_01'); if (s1) bendBone(s1, _ax.copy(_r), (A.name === 'stomp' ? 0.06 : 0.16)*e);
  }
  // a blow on the guard knocks the hands back an instant
  const jolt = B.blockT > 0 ? B.blockT/0.18*0.06 : 0;
  for (const side of ['l', 'r']) {
    if (side === 'r' && torch) continue;
    if (!guardAt(H, side, fp, _G2)) return;
    _G2.addScaledVector(_f, -jolt);
    const sx = side === 'r' ? 1 : -1;
    const sh = bone(H, 'upperarm_' + side); if (!sh) continue;
    if (A && A.proc && A.side === side) {
      sh.getWorldPosition(_s);
      // from where the hand is: your guard if it's up, else where the clip has it hanging
      if (B._gw < 0.5) { const hb = bone(H, 'hand_' + side); if (hb) hb.getWorldPosition(_G2); }
      const q = A.target && !A.target.veh ? A.target : null;
      if (A.name === 'jab' || A.name === 'body') {
        // straight out at their face, or at their middle
        if (q) _S2.set(q.x, F.y + (A.name === 'body' ? 1.05 : 1.5), q.z).sub(_s); else _S2.copy(_f).setY(A.name === 'body' ? -0.5 : -0.05);
        _S2.normalize().multiplyScalar(0.62).add(_s);
        _M2.copy(_G2).lerp(_S2, 0.5);
        _pole.copy(_r).multiplyScalar(sx*0.6).setY(-0.8);
      } else if (A.name === 'hookP') {
        // round from the side: the elbow up, the fist sweeping in to the jaw
        _S2.copy(_s).addScaledVector(_f, 0.45).addScaledVector(_r, -sx*0.12); _S2.y += 0.06;
        _M2.copy(_s).addScaledVector(_f, 0.12).addScaledVector(_r, sx*0.5);
        _pole.copy(_r).multiplyScalar(sx*0.3).addScaledVector(_f, -0.3).setY(0.9);
      } else {
        // the uppercut: down by the hip, then up under the chin
        _S2.copy(_s).addScaledVector(_f, 0.36).addScaledVector(_r, -sx*0.08); _S2.y += 0.1;
        _M2.copy(_s).addScaledVector(_f, 0.15).addScaledVector(_r, sx*0.05); _M2.y -= 0.5;
        _pole.copy(_r).multiplyScalar(sx*0.3).addScaledVector(_f, 0.2).setY(-1);
      }
      const back = u >= hk;
      if (back) _t.copy(_S2).lerp(_G2, 1 - e); else bez(_t, _G2, _M2, _S2, e);
      ikArm(H, side, _t, _pole, Math.min(1, u*7, (1 - u)*5 + B._gw));
    } else {
      _pole.copy(_r).multiplyScalar(sx*0.5).addScaledVector(_f, -0.1).setY(-1);
      // the other hand comes up to cover the face while one punches
      ikArm(H, side, _G2, _pole, Math.max(B._gw, A && A.proc ? 0.7*e : 0));
    }
  }
  if (A && A.leg) {
    const hip = bone(H, 'thigh_r'), ft = bone(H, 'foot_r'); if (!hip || !ft) return;
    hip.getWorldPosition(_s); ft.getWorldPosition(_n);          // the foot where the clip has it
    const q = A.target && !A.target.veh ? A.target : null, gy = F.y;
    if (A.name === 'front') {
      _S2.copy(_s).addScaledVector(_f, 0.85); _S2.y = _s.y + 0.05;
      _M2.copy(_s).addScaledVector(_f, 0.32); _M2.y = _s.y - 0.28;
      _pole.copy(_f).setY(0.4);
    } else {
      // at their body on the ground
      if (q) _S2.set(q.x, gy + 0.16, q.z); else _S2.copy(_s).addScaledVector(_f, 0.6).setY(gy + 0.16);
      const fl = _g.copy(_S2).sub(_s).setY(0), dd = fl.length(); if (dd > 0.75) _S2.addScaledVector(fl, (0.75 - dd)/dd);
      if (A.name === 'stomp') { _M2.copy(_s).addScaledVector(_f, 0.3); _M2.y = _s.y - 0.3; _pole.copy(_f).setY(0.6); }
      else { _M2.copy(_s).addScaledVector(_f, -0.4); _M2.y = gy + 0.3; _pole.copy(_f).setY(0.25); }
    }
    const back = u >= hk;
    if (back) _t.copy(_S2).lerp(_n, 1 - e); else bez(_t, _n, _M2, _S2, sm(u/hk));
    ikLeg(H, 'r', _t, _pole, Math.min(1, e*3, (1 - u)*5));
  }
}
// after the clip's pose and your head turning (game.js lookPose), before anything is drawn
let hooked = false;
const hook = (G) => {
  if (hooked || !G.player || !G.player.lookPose) return;
  hooked = true;
  const lp = G.player.lookPose;
  G.player.lookPose = (H, dt) => { lp(H, dt); pose(G, H, dt); };
};
