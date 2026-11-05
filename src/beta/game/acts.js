// Your body, where the clips stop short: everything here is the mocap clips the game has (lying at the end of the
// fall, the get-up, the stagger) slowed and held, with moves made on the bones over them, eased in and out like
// getting on a two-wheeler. While one plays it has your body (pilot.act), so nothing else picks a clip over it.
//   shudder     going into someone: the body you've just taken stiffens, a tremor through it, and settles
//   wake up     coming back to your own body: lying there, the head rolls, the slow get-up (a hand to the head when
//               one's free, the head hanging), then a sway on your feet before it's yours again. Thrown out, it's
//               longer: a stumble halfway up, and a heavier sway
//   thrown out  the one you're in fights you off: a jerk, both hands to the head, they stagger back and go down
//   drag (Z)    anyone out cold (your own body too): walk up to their head, crouch, hands under the arms, lift the
//               shoulders off the ground and walk backwards, bent, the heels scraping; Z again to lower them down
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { ikArm } from '@orig/people/humans.js';
import { ikLeg } from './fists.js';
import { UP, bone, smooth, bell, turn, turnHeld, shiftPelvis, worldOf, axes, safe, dizzyPose } from './dizzy.js';

const f = new THREE.Vector3(), r = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), tg = new THREE.Vector3(), pole = new THREE.Vector3(), cd = new THREE.Vector3();
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));

export function acts(G) {
  const P = () => G.player;
  const ground = (x, z) => G.W?.surf ? G.W.surf.height(x, z) : 0;
  let sc = null, drag = null;

  // ---------------------------------------------------------------- scenes: steps one after another, holding the body
  function run(steps, onDone) {
    if (sc) { const S = sc; sc = null; S.onDone && S.onDone(false); }
    const Pl = P(), A = { kind: 'scene', t: 0, dur: 1e9, move: true, vx: 0, vz: 0 };
    Pl.act = A; Pl.frozen = true;
    sc = { steps, i: 0, t: 0, A, onDone };
    steps[0].enter && steps[0].enter(Pl.human);
  }
  function finish(S, ok) {
    if (sc === S) sc = null;
    const Pl = P(); if (Pl.act === S.A) Pl.act = null; Pl.frozen = false;
    if (ok && Pl.human) Pl.human.play('idle', { fade: 0.6 });
    S.onDone && S.onDone(ok);
  }
  function scene(Pl, dt) {
    const S = sc; if (!S) return;
    if (Pl.act !== S.A || !Pl.onFoot) { finish(S, false); return; }     // a punch landed, or you're in a vehicle
    const H = Pl.human; let st = S.steps[S.i];
    S.t += dt;
    if (st.pose) st.pose(H, S.t, dt);
    if (st.until ? st.until(H, S.t) : S.t >= st.dur) {
      st.exit && st.exit(H);
      S.i++; S.t = 0;
      if (S.i >= S.steps.length) { finish(S, true); return; }
      st = S.steps[S.i]; st.enter && st.enter(H);
    }
  }
  const yaw = () => P().foot.yaw;
  const clipDone = (H, n) => { const x = H.actions[n]; return !x || x.time >= x.getClip().duration - 0.03; };
  // lying where you are: straight into the end of the fall, no fall
  function lieDown(H) {
    const x = H.play('death', { once: true, fade: 0 }); if (!x) return;
    H.mixer.stopAllAction(); x.reset(); x.setLoop(THREE.LoopOnce, 1); x.clampWhenFinished = true; x.play(); x.time = x.getClip().duration; H.cur = x; H.mixer.update(0);
  }
  // a hand to the head, whichever is free (a hand holding you up off the ground stays there)
  function handToHead(H, w) {
    const hd = bone(H, 'Head'); if (!hd || w <= 0.01) return;
    const F = P().foot, gy = ground(F.x, F.z);
    axes(F.yaw, f, r);
    for (const s of ['r', 'l']) {
      const h = worldOf(H, 'hand_' + s, a); if (!h) continue;
      const k = w*smooth((h.y - gy - 0.25)/0.2); if (k <= 0.02) continue;
      hd.getWorldPosition(tg).addScaledVector(f, 0.13).addScaledVector(UP, 0.05).addScaledVector(r, s === 'r' ? 0.03 : -0.03);
      pole.copy(r).multiplyScalar(s === 'r' ? 0.8 : -0.8).addScaledVector(UP, -0.6);
      safe(() => ikArm(H, s, tg, pole, k));
      return;
    }
  }

  // going into someone
  function shudder(done) {
    run([{ dur: 1.2, enter: (H) => H.play('idle', { fade: 0.2 }), pose: (H, t) => {
      axes(yaw(), f, r);
      const w = bell(t, 0, 0.15, 0.6, 1.2), tr = Math.sin(t*Math.PI*2*9)*(1 - t/1.2)*w;
      ['spine_01', 'spine_02', 'spine_03'].forEach((n, i) => { const x = bone(H, n); turn(x, r, 0.05*w); turn(x, f, 0.03*tr*(i + 1)/2); });
      turn(bone(H, 'neck_01'), r, 0.08*w); turn(bone(H, 'Head'), UP, 0.06*tr);
      // the arms tense, a little out from the body
      turn(bone(H, 'upperarm_l'), f, 0.12*w); turn(bone(H, 'upperarm_r'), f, -0.12*w);
    } }], done);
  }
  // getting up: hard (thrown out) is slower, with a stumble and a heavier sway; fromLying: already down (the stagger)
  function wakeSteps(hard, fromLying) {
    const sp = hard ? 0.55 : 0.72; let stb = 0, D = null;
    const steps = [];
    steps.push({ dur: hard ? 1.1 : 0.5, enter: fromLying ? null : lieDown, pose: (H, t) => {
      // the eyes open; the head rolls on the ground
      const n = worldOf(H, 'neck_01', a), h = worldOf(H, 'Head', b); if (!n || !h) return;
      turn(bone(H, 'Head'), c.copy(h).sub(n).normalize(), 0.25*Math.sin(t*1.6)*bell(t, 0, 0.3, 0.7, 1.1)*(hard ? 1 : 0.5));
    } });
    steps.push({ enter: (H) => { H.play('getup', { once: true, fade: 0.45, speed: sp }); stb = 0; }, until: (H) => clipDone(H, 'getup'), pose: (H, t) => {
      const x = H.actions.getup, u = x ? x.time/x.getClip().duration : 1;
      axes(yaw(), f, r);
      // halfway up, thrown out: it nearly goes; they hold there, swaying, then on
      if (hard && x) {
        if (!stb && u > 0.46) stb = t;
        const s = stb ? bell(t - stb, 0, 0.12, 0.45, 0.8) : 0;
        x.timeScale = sp*(1 - 0.9*s);
        turn(bone(H, 'spine_02'), f, 0.12*s*Math.sin((t - stb)*5));
      }
      turn(bone(H, 'neck_01'), r, -0.22*bell(u, 0.12, 0.3, 0.7, 0.95));
      handToHead(H, bell(u, 0.4, 0.55, 0.78, 0.94)*(hard ? 0.95 : 0.65));
    } });
    steps.push({ dur: hard ? 1.6 : 1.1, enter: (H) => { H.play('idle', { fade: 0.5 }); D = { t: 0, dur: hard ? 1.6 : 1.1, ph: Math.random()*6, sev: hard ? 1.1 : 0.5, hand: 'r' }; },
      pose: (H, t) => { D.t = t; dizzyPose(H, D, yaw()); } });
    return steps;
  }
  function wakeUp(hard, done) { run(wakeSteps(hard, false), done); }
  // the one you're in throws you out: a jerk, both hands to the head, a stagger back and down
  function throwSteps() {
    let D = null;
    return [
      { dur: 1.5, enter: (H) => { H.play('idle', { fade: 0.15 }); D = { t: 0, dur: 1.6, ph: Math.random()*6, sev: 1.3, hand: 'both' }; }, pose: (H, t) => {
        axes(yaw(), f, r);
        const j = bell(t, 0, 0.06, 0.12, 0.4);
        turn(bone(H, 'spine_02'), r, 0.28*j); turn(bone(H, 'Head'), r, 0.22*j);
        D.t = t; dizzyPose(H, D, yaw());
      } },
      { enter: (H) => H.play('knockback', { once: true, fade: 0.2, speed: 0.8 }), until: (H) => clipDone(H, 'knockback') },
      { dur: 0.6 },
    ];
  }
  function thrownOut(done) { run(throwSteps(), done); }
  // fought off at the door: thrown back into yourself, down, and up again slowly
  function foughtOff(done) { run([...throwSteps(), ...wakeSteps(true, true)], done); }
  // the one you're leaving: dizzy for a moment before you're out (D carries on in them after: wake.js)
  function dizzyOut(D, secs, done) {
    run([{ dur: secs, enter: (H) => H.play('idle', { fade: 0.2 }), pose: (H, t, dt) => { D.t += dt; dizzyPose(H, D, yaw()); } }], done);
  }

  // ---------------------------------------------------------------- dragging
  let snd = null;
  function scrape(k) {
    const au = G.audio; if (!au || !au.ctx || !au.master) return;
    const C = au.ctx;
    if (!snd) {
      // grit under a heel: noise, band-passed, broken up by a slower noise (the heel catching and slipping)
      const n = C.sampleRate*2, buf = C.createBuffer(1, n, C.sampleRate), d = buf.getChannelData(0);
      let lp = 0, g = 0;
      for (let i = 0; i < n; i++) { lp += (Math.random()*2 - 1 - lp)*0.5; if (i % 220 === 0) g = 0.35 + Math.random()*0.65*(Math.random() < 0.3 ? 1 : 0.5); d[i] = lp*g; }
      const s = C.createBufferSource(); s.buffer = buf; s.loop = true;
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.6;
      const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260;
      const gn = C.createGain(); gn.gain.value = 0;
      s.connect(bp); bp.connect(hp); hp.connect(gn); gn.connect(au.master); s.start();
      snd = { gn, bp };
    }
    const t = C.currentTime;
    snd.gn.gain.setTargetAtTime(0.16*k, t, 0.08); snd.bp.frequency.setTargetAtTime(1100 + 500*k, t, 0.1);
  }
  const bodyOf = (p) => p && p.body && p.body.H;
  // their lying shape (wake.js measures it), turned to where they are
  const at = (p, L, out) => { const cy = Math.cos(p.yaw || 0), sy = Math.sin(p.yaw || 0); return out.set(p.x + L.x*cy - L.z*sy, 0, p.z + L.x*sy + L.z*cy); };
  function grab(p) {
    if (drag || sc) return false;
    const Pl = P(), A = { kind: 'drag', t: 0, dur: 1e9, move: true, vx: 0, vz: 0 };
    Pl.act = A;
    p._drag = { w: 0, theta: 0, ph: 0 };
    drag = { p, A, ph: 'reach', t: 0, crouch: 0, hw: 0, feet: new THREE.Vector3(), p0: null, th0: 0 };
    return true;
  }
  function letGo() { if (drag && drag.ph !== 'drop' && drag.ph !== 'reach') { drag.ph = 'drop'; drag.t = 0; drag.th0 = drag.p._drag.theta; drag.c0 = drag.crouch; } else if (drag) stopDrag(); }
  function stopDrag() {
    if (!drag) return;
    const Pl = P(); if (Pl.act === drag.A) Pl.act = null;
    if (drag.p) drag.p._drag = null;
    drag = null; scrape(0);
    Pl.human?.play('idle', { fade: 0.5 });
  }
  function dragTick(dt) {
    if (!drag) return;
    const Pl = P(), F = Pl.foot, d = drag, p = d.p, D = p._drag, A = d.A;
    if (!Pl.onFoot || Pl.act !== A || p.hidden || !G.people.list.includes(p) || !(p.fallen > 0) || !D) { stopDrag(); return; }
    p.fallen = Math.max(p.fallen, 4); p.v = 0;
    d.t += dt;
    if (!D.loc) { A.vx = A.vz = 0; if (d.t > 1.5) stopDrag(); return; }
    const L = D.loc, armW = at(p, L.arm, a), feetW = at(p, L.feet, b);
    const toYaw = (x, z, k) => { F.yaw += wrap(Math.atan2(z - F.z, x - F.x) - F.yaw)*Math.min(1, dt*k); };
    if (d.ph === 'reach') {
      // round to their head
      const ax = armW.x - feetW.x, az = armW.z - feetW.z, al = Math.hypot(ax, az) || 1;
      const sx = armW.x + ax/al*0.55, sz = armW.z + az/al*0.55, ex = sx - F.x, ez = sz - F.z, e = Math.hypot(ex, ez);
      const sp = Math.min(0.95, e*1.6);
      A.vx += ((e > 0.05 ? ex/e*sp : 0) - A.vx)*Math.min(1, dt*6); A.vz += ((e > 0.05 ? ez/e*sp : 0) - A.vz)*Math.min(1, dt*6);
      if (e > 0.5) toYaw(sx, sz, 8); else toYaw(armW.x, armW.z, 6);
      if ((e < 0.08 && Math.abs(wrap(Math.atan2(armW.z - F.z, armW.x - F.x) - F.yaw)) < 0.15) || d.t > 3) { d.ph = 'grab'; d.t = 0; A.vx = A.vz = 0; d.feet.copy(feetW); }
      return;
    }
    if (d.ph === 'grab') {
      // down on your haunches, hands in under their arms
      A.vx = A.vz = 0; toYaw(armW.x, armW.z, 6);
      d.crouch = smooth(d.t/0.6); d.hw = smooth((d.t - 0.3)/0.6);
      if (d.t >= 1.1) { d.ph = 'lift'; d.t = 0; d.p0 = { x: p.x, z: p.z, yaw: p.yaw || 0 }; d.feet.copy(feetW); }
      return;
    }
    // the rope: you hold their shoulders, their heels trail behind along the line from you
    const fx = d.feet.x - F.x, fz = d.feet.z - F.z, fl = Math.hypot(fx, fz) || 1, ux = fx/fl, uz = fz/fl;
    const gy = ground(p.x, p.z), rise = (F.y + 0.6) - (gy + L.arm.y);
    const thT = Math.asin(Math.max(0, Math.min(0.75, rise/L.len)));
    const place = (w) => {
      const th = D.theta, len = L.len*Math.cos(th);
      const hx = F.x + ux*0.52, hz = F.z + uz*0.52, nfx = hx + ux*len, nfz = hz + uz*len;
      const yawT = Math.atan2(-uz, -ux) - Math.atan2(L.arm.z - L.feet.z, L.arm.x - L.feet.x);
      const cy = Math.cos(yawT), sy = Math.sin(yawT), ox = nfx - (L.feet.x*cy - L.feet.z*sy), oz = nfz - (L.feet.x*sy + L.feet.z*cy);
      if (w >= 1) { p.x = ox; p.z = oz; p.yaw = yawT; }
      else { p.x = d.p0.x + (ox - d.p0.x)*w; p.z = d.p0.z + (oz - d.p0.z)*w; p.yaw = d.p0.yaw + wrap(yawT - d.p0.yaw)*w; }
      d.feet.set(nfx, 0, nfz);
      if (p.anchor) { p.anchor.x = p.x; p.anchor.z = p.z; }
    };
    toYaw(d.feet.x, d.feet.z, 6);
    if (d.ph === 'lift') {
      const w = smooth(d.t/0.8); D.w = w; D.theta = thT*w; d.crouch = 1 - 0.45*w; d.hw = 1;
      A.vx = A.vz = 0; place(w);
      if (d.t >= 0.8) { d.ph = 'drag'; d.t = 0; }
      return;
    }
    if (d.ph === 'drag') {
      // you can only pull: backwards, or round to the side (they swing round behind you); never push
      const k = (...cs) => cs.some(x => G.input?.key(x)) && !G.talkUI?.cur;
      const fw = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0), sd = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
      let mx = 0, mz = 0;
      if (fw || sd) {
        G.camera.getWorldDirection(cd); const cy = Math.atan2(cd.z, cd.x);
        mx = Math.cos(cy)*fw - Math.sin(cy)*sd; mz = Math.sin(cy)*fw + Math.cos(cy)*sd; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        const to = mx*ux + mz*uz; if (to > 0) { mx -= ux*to; mz -= uz*to; }
      }
      const sp = 0.8*(Pl.stam > 0.1 ? 1 : 0.6);
      A.vx += (mx*sp - A.vx)*Math.min(1, dt*3); A.vz += (mz*sp - A.vz)*Math.min(1, dt*3);
      const v = Math.hypot(A.vx, A.vz);
      D.ph += dt*v*7; D.w = 1; D.theta += (thT - D.theta)*Math.min(1, dt*4); d.crouch = 0.55; d.hw = 1;
      place(1);
      scrape(Math.min(1, v/0.6));
      return;
    }
    if (d.ph === 'drop') {
      // down again: their shoulders to the ground, then your hands out, then up
      A.vx *= 0.8; A.vz *= 0.8;
      D.theta = d.th0*(1 - smooth(d.t/0.7)); D.w = 1 - smooth((d.t - 0.35)/0.6);
      d.hw = 1 - smooth((d.t - 0.5)/0.45);
      d.crouch = d.t < 0.45 ? d.c0 + (1 - d.c0)*smooth(d.t/0.45) : 1 - smooth((d.t - 0.6)/0.6);
      place(1); scrape(0);
      if (d.t >= 1.25) stopDrag();
    }
  }
  function dragPose(Pl, H) {
    const d = drag, F = Pl.foot, A = d.A, v = Math.hypot(A.vx, A.vz);
    axes(F.yaw, f, r);
    // the clip: walking up to them, then backwards steps (the walk run in reverse) while you pull
    if (d.ph === 'reach') H.play(v > 0.15 ? 'walk' : 'idle', { fade: 0.3, speed: v > 0.15 ? Math.max(0.5, v/1.25) : 1 });
    else H.play(v > 0.08 ? 'walk' : 'idle', { fade: 0.35, speed: v > 0.08 ? -Math.max(0.45, v/0.85) : 1 });
    const k = d.crouch;
    if (k > 0.005) {
      const feet = {}; for (const s of ['l', 'r']) { const x = worldOf(H, 'foot_' + s, new THREE.Vector3()); if (x) feet[s] = x; }
      shiftPelvis(H, tg.set(0, -0.36*k, 0).addScaledVector(f, -0.1*k));
      turn(bone(H, 'spine_01'), r, -0.28*k); turn(bone(H, 'spine_02'), r, -0.22*k); turn(bone(H, 'spine_03'), r, -0.12*k);
      turnHeld(bone(H, 'neck_01'), r, 0.18*k); turnHeld(bone(H, 'Head'), r, -0.2*k);       // (the head stays up, the eyes on them)
      for (const s of ['l', 'r']) if (feet[s]) { pole.copy(f).addScaledVector(UP, 0.1).addScaledVector(r, s === 'r' ? 0.25 : -0.25); safe(() => ikLeg(H, s, feet[s], pole, 1)); }
    }
    // hands under their arms
    const NH = bodyOf(d.p);
    if (d.hw > 0.01 && NH) {
      const na = worldOf(NH, 'upperarm_l', a), nb = worldOf(NH, 'upperarm_r', b);
      if (na && nb) {
        const rightIsL = (na.x - nb.x)*r.x + (na.z - nb.z)*r.z > 0;
        for (const [s, q] of [['r', rightIsL ? na : nb], ['l', rightIsL ? nb : na]]) {
          tg.copy(q).addScaledVector(UP, -0.05).addScaledVector(f, 0.04);
          pole.copy(r).multiplyScalar(s === 'r' ? 0.9 : -0.9).addScaledVector(UP, -0.4).addScaledVector(f, -0.2);
          safe(() => ikArm(H, s, tg, pole, d.hw));
        }
      }
    }
  }

  // ---------------------------------------------------------------- on your body every frame, after the clip
  const upd = Pilot.prototype.updateFoot;
  Pilot.prototype.updateFoot = function (dt, ...rest) {
    const out = upd.call(this, dt, ...rest);
    if (this === G.player && this.human) {
      if (sc) scene(this, dt);
      else if (drag && this.act === drag.A) dragPose(this, this.human);
    }
    return out;
  };

  return {
    shudder, wakeUp, thrownOut, foughtOff, dizzyOut, grab, letGo, stopDrag, dragTick,
    get busy() { return !!sc; }, get dragging() { return drag ? drag.p : null; },
    cancel() { if (sc) finish(sc, false); },
  };
}
