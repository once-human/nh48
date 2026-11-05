// The street's people, made on the bones where no clip will do:
//   coming round   the one Vetal has just left: dizzy where they stand, a small shake of the head, they look at their
//                  hands, look round, mutter (Marathi, and what it means), and then each as they are: the old rest a
//                  while, hands on knees, before going on; a dada rounds on whoever's nearest; the rest walk off unsure
//   startled       a rustle behind them or a stone landing near: the head whips round first, the body follows
//   dragged        hauled by the armpits: the body comes up off the ground from the heels, the head lolls back, the
//                  arms hang and trail
//   lying          anyone down a while stays down when the crowd hands them a new body (they don't fall again)
// Their clocks run here every frame; the poses go on in the crowd's postPed, after the clip (so they need no dt).
import * as THREE from 'three';
import { Crowd } from '@orig/people/crowd.js';
import { ikArm } from '@orig/people/humans.js';
import { ikLeg } from './fists.js';
import { UP, bone, smooth, bell, turn, turnHeld, shiftPelvis, worldOf, axes, safe, dizzyPose } from './dizzy.js';

const OLD = new Set(['ajoba', 'aaji']);
const LINES = {
  any: [['मला काय झालं?', 'What happened to me?'], ['डोकं गरगरतंय…', 'My head is spinning…'], ['काहीतरी विचित्र झालं…', 'Something strange happened…']],
  here: { m: ['मी इथे कसा आलो?', 'How did I get here?'], f: ['मी इथे कशी आले?', 'How did I get here?'] },
  old: [['देवा रे… हे काय झालं?', 'Oh God… what was that?']],
  cop: [['ड्युटीवर डुलकी लागली की काय?', 'Did I doze off on duty?']],
  dada: [['ए! काय केलंस रे मला?', 'Hey! What did you do to me?']],
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const f = new THREE.Vector3(), r = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), tg = new THREE.Vector3(), pole = new THREE.Vector3(), q = new THREE.Quaternion();

export function people(G) {
  const ppl = () => G.people;
  const nameOf = (p) => p.name || G.talkUI?.nameOf?.(p) || (p.female ? 'A woman' : 'A man');
  const near = (p, m = 25) => Math.hypot(p.x - G.player.x, p.z - G.player.z) < m;
  const say = (p, [mr, en]) => { if (near(p)) G.hud?.say?.(nameOf(p), mr, en, 3.6); };

  // ---------------------------------------------------------------- coming round
  // o: { D (a dizzy already going, carried on), sev, hops, delay (seconds lying/getting up first), female }
  function wake(p, o = {}) {
    const sev = o.sev ?? 1, Dd = Math.min(6.5, 2.6 + 0.8*(o.hops || 0));
    const D = o.D || { t: 0, ph: Math.random()*6 };
    Object.assign(D, { dur: Dd, sev, hand: 'r' });
    const kind = p.cop || p.police ? 'cop' : p.persona === 'dada' ? 'dada' : OLD.has(p.persona) ? 'old' : 'walk';
    const end = Dd + 3.6 + (kind === 'old' ? 3.4 : 0);
    p._wake = { t: D.t - (o.delay || 0), D, Dd, end, kind, said: false, female: !!o.female };
    p.mode = 'watch'; p.watch = { x: p.x + Math.cos(p.yaw || 0)*3, z: p.z + Math.sin(p.yaw || 0)*3 }; p.wait = 1e6;
    p.anim = null; p.angry = 0; p.react = 0; p.v = 0;
  }
  function wakeTick(p, W, dt) {
    W.t += dt;
    p.angry = 0; p.v = 0; if (p.mode !== 'watch') { p.mode = 'watch'; p.wait = 1e6; }
    if (!W.said && W.t > W.Dd*0.45) {
      W.said = true;
      const pool = W.kind === 'cop' ? LINES.cop : W.kind === 'old' ? [...LINES.old, ...LINES.any] : [...LINES.any, LINES.here[W.female ? 'f' : 'm']];
      say(p, pool[Math.abs(p.id || 0) % pool.length]);
    }
    if (W.t < W.end) return;
    p._wake = null;
    const P = ppl();
    if (W.kind === 'dada') {
      // rounds on whoever's nearest
      let o = null, bd = 10;
      for (const x of P.list) { if (x === p || x.hidden || x.fallen > 0) continue; const d = Math.hypot(x.x - p.x, x.z - p.z); if (d < bd) { bd = d; o = x; } }
      if (o) { P.watch(p, o.x, o.z, 4); p.watch.follow = o; p.angry = 5; say(p, LINES.dada[0]); return; }
    }
    p.limp = Math.max(p.limp || 0, W.kind === 'old' ? 25 : 12);          // unsure on their feet for a while
    p.wait = 0; p.mode = 'stand';
    try { P.backToPath(p); } catch (e) { p.mode = 'walk'; }
  }
  function wakePose(p, H, W) {
    const t = W.t, yaw = p.yaw ?? 0, Dd = W.Dd;
    axes(yaw, f, r);
    // dizzy where they stand, a hand to the forehead
    W.D.t = t; if (t < W.D.dur) dizzyPose(H, W.D, yaw);
    const hd = bone(H, 'Head'), nk = bone(H, 'neck_01'), s3 = bone(H, 'spine_03');
    // a small shake of the head, early
    turn(hd, UP, 0.1*Math.sin(t*Math.PI*2*2.3)*bell(t, 0.25, 0.55, 1.1, 1.5));
    // then they look at their hands
    const s = t - (Dd - 0.4), hw = bell(s, 0, 0.7, 1.5, 2.2);
    if (hw > 0.01 && s3) {
      s3.getWorldPosition(a);
      turn(nk, r, -0.18*hw); turn(hd, r, -0.3*hw);
      for (const sd of ['l', 'r']) {
        tg.copy(a).addScaledVector(f, 0.3).addScaledVector(UP, -0.14).addScaledVector(r, sd === 'r' ? 0.11 : -0.11);
        pole.copy(r).multiplyScalar(sd === 'r' ? 0.7 : -0.7).addScaledVector(UP, -0.7);
        safe(() => ikArm(H, sd, tg, pole, hw));
      }
    }
    // and round, left, then right
    const s2 = t - (Dd + 1.6), lw = bell(s2, 0, 0.4, 1.6, 2.0);
    if (lw > 0.01) { const ang = 0.55*Math.sin(Math.PI*s2/1.0)*lw; turn(s3, UP, -0.25*ang); turn(nk, UP, -0.3*ang); turn(hd, UP, -0.45*ang); }
    // the old: a rest, hands on their knees, before they go on
    const s4 = t - (Dd + 3.4), rw = W.kind === 'old' ? bell(s4, 0, 0.9, 2.5, 3.4) : 0;
    if (rw > 0.01) {
      if (!W.rf) { W.rf = {}; for (const sd of ['l', 'r']) { const v = worldOf(H, 'foot_' + sd, new THREE.Vector3()); if (v) W.rf[sd] = v; } }
      shiftPelvis(H, a.set(0, -0.11*rw, 0).addScaledVector(f, -0.07*rw));
      ['spine_01', 'spine_02', 'spine_03'].forEach((n) => turn(bone(H, n), r, -0.2*rw));
      turn(hd, r, 0.25*rw);                                     // (the head comes up to see ahead)
      for (const sd of ['l', 'r']) {
        const k = worldOf(H, 'calf_' + sd, b); if (!k) continue;
        tg.copy(k).addScaledVector(f, 0.05).addScaledVector(UP, 0.03);
        pole.copy(r).multiplyScalar(sd === 'r' ? 0.8 : -0.8).addScaledVector(f, -0.3);
        safe(() => ikArm(H, sd, tg, pole, rw));
      }
      pole.copy(f).addScaledVector(UP, 0.1);
      for (const sd of ['l', 'r']) if (W.rf[sd]) safe(() => ikLeg(H, sd, W.rf[sd], pole, rw));
    }
  }

  // ---------------------------------------------------------------- startled
  function startle(p, x, z) {
    p._startle = { t: 0, x, z };
    ppl().watch(p, x, z, 3 + Math.random());
    p.react = 0; p.anim = null;
  }
  function startleTick(p, S, dt) {
    S.t += dt;
    // the whip round: quicker than a look, slowing as they come to face it
    if (S.t > 0.12 && S.t < 0.9) p.yaw += wrap(Math.atan2(S.z - p.z, S.x - p.x) - p.yaw)*Math.min(1, dt*7);
    if (S.t > 1.8) p._startle = null;
  }
  function startlePose(p, H, S) {
    const yaw = p.yaw ?? 0, rel = Math.max(-1.3, Math.min(1.3, wrap(Math.atan2(S.z - p.z, S.x - p.x) - yaw)));
    axes(yaw, f, r);
    // a flinch: shoulders back and up for a moment
    const fl = bell(S.t, 0, 0.06, 0.18, 0.6);
    turn(bone(H, 'spine_03'), r, 0.14*fl); turn(bone(H, 'spine_02'), r, 0.06*fl);
    // the head gets there first
    const hw = bell(S.t, 0, 0.1, 1.0, 1.8);
    turn(bone(H, 'spine_03'), UP, -0.2*rel*hw); turn(bone(H, 'neck_01'), UP, -0.3*rel*hw); turn(bone(H, 'Head'), UP, -0.45*rel*hw);
  }

  // ---------------------------------------------------------------- dragged (acts.js runs the one doing the dragging)
  // p._drag: { w (0 to 1), theta (how far up off the ground), ph (the step), loc (their lying shape, measured once) }
  const mid = (H, n1, n2, out) => { const x = worldOf(H, n1, a), y = worldOf(H, n2, b); return x && y ? out.copy(x).add(y).multiplyScalar(0.5) : null; };
  function measure(p, H, D) {
    H.holder.updateMatrixWorld(true);
    const o = H.holder.position, yaw = p.yaw ?? 0, cy = Math.cos(-yaw), sy = Math.sin(-yaw);
    const loc = (v) => { const x = v.x - o.x, z = v.z - o.z; return { x: x*cy - z*sy, z: x*sy + z*cy, y: v.y - o.y }; };
    const arm = mid(H, 'upperarm_l', 'upperarm_r', c); if (!arm) return;
    const L = { arm: loc(arm) };
    const ft = mid(H, 'foot_l', 'foot_r', c); if (!ft) return; L.feet = loc(ft);
    L.len = Math.hypot(L.arm.x - L.feet.x, L.arm.z - L.feet.z) || 1.2;
    D.loc = L;
  }
  function dragPose(p, H) {
    const D = p._drag;
    if (!D.loc) { measure(p, H, D); return; }
    const w = D.w || 0; if (w <= 0.001) return;
    const Hd = H.holder;
    // up off the ground from the heels, the shoulders to where the hands are
    const ft = mid(H, 'foot_l', 'foot_r', new THREE.Vector3()), am = mid(H, 'upperarm_l', 'upperarm_r', new THREE.Vector3());
    if (!ft || !am) return;
    // the line from their heels to their shoulders from the shape measured once, turned to where they lie (from the
    // live bones it swung about whenever the clip shifted them, and the lift went round with it)
    const L = D.loc, ly = p.yaw ?? 0, lx = L.arm.x - L.feet.x, lz = L.arm.z - L.feet.z;
    const dir = new THREE.Vector3(lx*Math.cos(ly) - lz*Math.sin(ly), 0, lx*Math.sin(ly) + lz*Math.cos(ly)).normalize(), ax = new THREE.Vector3().crossVectors(dir, UP).normalize();
    const th = D.theta || 0;
    // (lifted from where the crowd stood them this frame; if nothing has stood them again since last frame's lift, from
    // where they were before it, so the lift never adds up)
    const hs = Hd.userData._lift;
    if (hs && Hd.quaternion.equals(hs.q) && Hd.position.equals(hs.p)) { Hd.quaternion.copy(hs.q0); Hd.position.copy(hs.p0); Hd.updateMatrixWorld(true); ft.copy(hs.ft); }
    const q0 = Hd.quaternion.clone(), p0 = Hd.position.clone(), ft0 = ft.clone();
    if (th > 0.001) {
      q.setFromAxisAngle(ax, th);
      Hd.position.sub(ft).applyQuaternion(q).add(ft);
      Hd.quaternion.premultiply(q);
      Hd.updateMatrixWorld(true);
    }
    Hd.userData._lift = { q: Hd.quaternion.clone(), p: Hd.position.clone(), q0, p0, ft: ft0 };
    // the head falls back, swaying with the steps
    const ph = D.ph || 0;
    turnHeld(bone(H, 'neck_01'), ax, -0.55*th - 0.05*Math.sin(ph)*w);
    turnHeld(bone(H, 'Head'), ax, -0.35*th + 0.04*Math.sin(ph + 0.8)*w);
    // the arms hang, trailing a little
    const gy = G.W?.surf ? G.W.surf.height(p.x, p.z) : 0, mid2 = mid(H, 'upperarm_l', 'upperarm_r', c);
    for (const sd of ['l', 'r']) {
      const sh = worldOf(H, 'upperarm_' + sd, a); if (!sh || !mid2) continue;
      const out = b.set(sh.x - mid2.x, 0, sh.z - mid2.z).normalize();
      tg.copy(sh).addScaledVector(dir, -0.3).addScaledVector(out, 0.08); tg.y = Math.max(gy + 0.06, sh.y - 0.5);
      pole.copy(out).multiplyScalar(0.6).addScaledVector(UP, -0.3).addScaledVector(dir, -0.3);
      safe(() => ikArm(H, sd, tg, pole, w));
    }
  }

  // ---------------------------------------------------------------- lying: no second fall
  function lyingFix(p, H) {
    if (!(p.fallen > 1.6 && (p.ko || p.corpse)) || !p._downAt || performance.now() - p._downAt < 3000) return;
    const a2 = H.cur; if (!a2 || (a2 !== H.actions.death && a2 !== H.actions.knockback)) return;
    const dur = a2.getClip().duration; if (a2.time >= dur - 0.05) return;
    H.mixer.stopAllAction(); a2.reset(); a2.setLoop(THREE.LoopOnce, 1); a2.clampWhenFinished = true; a2.play(); a2.time = dur; H.mixer.update(0);
  }

  // ---------------------------------------------------------------- the crowd's hook (put on now, after every module's
  // own: draw/alive.js replaces it outright when it loads, which is after this file's)
  const prev = Crowd.prototype.postPed;
  Crowd.prototype.postPed = function (p, H, dt) {
    if (!p._wake && !p._drag && !p._startle && prev) prev.call(this, p, H, dt);
    lyingFix(p, H);
    if (p._drag) dragPose(p, H);
    if (p._wake && p._wake.t >= 0) wakePose(p, H, p._wake);
    if (p._startle) startlePose(p, H, p._startle);
  };
  function tick(dt) {
    const L = ppl()?.list; if (!L) return;
    const now = performance.now();
    for (const p of L) {
      if (p.fallen > 1.6 && (p.ko || p.corpse)) { if (!p._downAt) p._downAt = now; } else if (p._downAt) p._downAt = 0;
      if (p._wake) wakeTick(p, p._wake, dt);
      if (p._startle) startleTick(p, p._startle, dt);
    }
  }
  return { wake, startle, tick, nameOf };
}
