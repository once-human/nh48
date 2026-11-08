// A Splendor or a Bullet is started with your foot. The right foot comes off the peg, up on to the lever, and stamps it
// down through the engine's compression; it catches, or it doesn't and you kick again (cold, it can take three or four,
// and a Bullet's big single is the worst of them). And a manual stalls the way a manual does when nobody's working the
// clutch for you: pulling away hard on a cold engine in its first seconds, or stamping on the brakes to a dead stop.
// It dies with a lurch and a shudder, and you start it again (kick it again).
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { keyOf } from '@orig/game/keys.js';
import { ikLeg } from '../game/fists.js';
import { kindOf, stopSound } from './starter.js';

const KICK = 0.8;                     // s per kick: up on to the lever, down, back
const G0 = () => window.__nhAskG;
export const kickable = (v) => { const k = kindOf(v); return k === 'bike' || k === 'single'; };
const MANUAL = new Set(['car', 'diesel', 'bike', 'single', 'auto']), AUTO_BOX = new Set(['lux', 'fortuner', 'xuv', 'innova', 'city']);
const manual = (v) => MANUAL.has(kindOf(v)) && !AUTO_BOX.has(v.type);

// the kicks: how many it takes, and the sound of each (the lever, the engine turning over against it, the catch)
export function kickStart(v, cold) {
  const single = kindOf(v) === 'single', R = Math.random;
  const n = cold ? 1 + Math.floor(R()*(single ? 4 : 3)) : (R() < (single ? 0.5 : 0.25) ? 2 : 1);
  v._kick = { n, t: 0 }; v._crank = n*KICK; v._off = false;
  const A = G0() && G0().audio; if (!A || !A.ctx) return;
  try {
    const ctx = A.ctx, out = A.bus ? A.bus('fx') : ctx.destination, t0 = ctx.currentTime + 0.02;
    const knock = (t, f, vol, len) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f*1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + len*0.6); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0006, t + len); o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.02); };
    const clank = (t, vol) => { const n2 = Math.ceil(ctx.sampleRate*0.06), b = ctx.createBuffer(1, n2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n2; i++) d[i] = (R()*2 - 1)*Math.exp(-i/(n2*0.15)); const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 3; g.gain.value = vol; s.connect(bp); bp.connect(g); g.connect(out); s.start(t); };
    for (let i = 0; i < n; i++) {
      const t = t0 + i*KICK + 0.32, last = i === n - 1;
      clank(t - 0.18, 0.12);                                           // (the foot on the lever)
      for (let k = 0; k < 3; k++) knock(t + k*0.07, (single ? 42 : 55) + R()*8, (single ? 0.32 : 0.24)*(1 - k*0.28), 0.1);
      if (last) { knock(t + 0.24, single ? 46 : 60, single ? 0.34 : 0.22, 0.18); knock(t + 0.24 + (single ? 0.2 : 0.11), single ? 44 : 58, single ? 0.28 : 0.18, 0.16); }
      else clank(t + 0.3, 0.07);                                       // (the lever springing back up)
    }
  } catch (e) { /* silent */ }
}

// the right leg doing it
const _t = new THREE.Vector3(), _pole = new THREE.Vector3(), PEG = new THREE.Vector3(), TOP = new THREE.Vector3(), BOT = new THREE.Vector3();
const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const prd = Pilot.prototype.placeRider;
Pilot.prototype.placeRider = function () {
  prd.call(this);
  const v = this.riderShown, H = this.human, K = v && v._kick;
  if (!K || !H || !v.tilt) return;
  const dt = Math.min(0.1, (performance.now() - (K.at || performance.now()))/1000); K.at = performance.now();
  K.t += dt;
  if (K.t >= K.n*KICK) { v._kick = null; return; }
  const u = (K.t%KICK)/KICK, single = kindOf(v) === 'single';
  // (the lever's on the right, behind the peg: its top when it's up, the bottom of its swing)
  PEG.set(-0.05, 0.33, 0.2); TOP.set(-0.2, single ? 0.62 : 0.55, 0.24); BOT.set(-0.34, 0.22, 0.24);
  let p;
  if (u < 0.3) p = _t.copy(PEG).lerp(TOP, sm(u/0.3)).setY(PEG.y + (TOP.y - PEG.y)*sm(u/0.3) + Math.sin(Math.PI*u/0.3)*0.08);
  else if (u < 0.5) p = _t.copy(TOP).lerp(BOT, sm((u - 0.3)/0.2));            // the stamp
  else p = _t.copy(BOT).lerp(PEG, sm((u - 0.5)/0.5));
  p.applyMatrix4(v.tilt.matrixWorld);
  const fx = Math.cos(v.th), fz = Math.sin(v.th);
  _pole.set(fx + fz*0.2, 0.5, fz - fx*0.2);
  H.holder.updateMatrixWorld(true);
  ikLeg(H, 'r', p, _pole, sm(Math.min(1, K.t/0.15, (K.n*KICK - K.t)/0.2)));
};

// stalling
let told = 0;
function stall(v) {
  if (v._off || v._crank > 0) return;
  v._off = true; v.rpm = 0; v._kick = null;
  v.v *= 0.4;                                                          // (the lurch as it dies)
  const G = G0(), A = G && G.audio; stopSound(A, v);
  if (G && told < 2) { told++; const k = String(keyOf('engine') || '').replace(/^Key/, ''); G.hud.toast('Stalled', kickable(v) ? `Press ${k} and kick it again` : `Press ${k} to start it again`, 'info', 2.4); }
}
const vu = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) {
  const P = G0() && G0().player, mine = P && !P.onFoot && P.cur === this;
  const v0 = Math.abs(this.v || 0), r = vu.call(this, dt, inp, traffic);
  if (!mine || !inp || this._off || this._crank > 0 || !manual(this) || !(dt > 0)) return r;
  const v1 = Math.abs(this.v || 0), thr = inp.throttle || 0;
  // pulling away hard from a standstill while it's still cold
  if (v0 < 0.4 && thr > 0.75 && !this._pulled) { this._pulled = true; if (this._coldT > 14 && Math.random() < 0.35) stall(this); }
  if (v1 > 3) this._pulled = false;
  // a panic stop to dead still (no clutch in)
  if ((inp.brake || 0) > 0.85 && v0 > 0.3 && v1 < 0.05) { if ((this._brkFrom || 0) > 5 && Math.random() < 0.25) stall(this); this._brkFrom = 0; }
  else if (!((inp.brake || 0) > 0.85)) this._brkFrom = v1;
  return r;
};
