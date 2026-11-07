// The small things a real vehicle does, mostly the one you're driving:
//  - the body on its springs: the nose dives under the brakes and squats under power, by how soft the car is, and as
//    you come to a stop it rocks back once and settles; the wheels stay on the road while the body moves on them
//  - the 911's spoiler (the lip on its engine lid) rises at speed, and under hard braking from high speed, with a
//    soft whirr; it goes back down when you're slow again (the Huracán's is part of its tail: it doesn't move)
//  - the wipers sweep when it rains, faster in a storm, and park when it stops
//  - the steering wheel turns in your hands seen from outside too, not only from the seat
//  - your head turns into a corner a little before the car does
//  - the brake discs glow after hard stops from high speed, and cool over a few seconds
//  - a car that's been standing breathes white vapour from its exhaust for the first half minute after you start it
//  - indicators: , for left, . for right, both together for the hazards. A soft tick-tock, and they cancel themselves once you've
//    turned the wheel that way and straightened up again
//  - launch control: hold the brake or the handbrake, floor it, let the brake go
//  - heat haze over the exhaust once you've worked the engine: it shows when you slow down or stop, and takes a few
//    minutes to go. A sports car's shimmers a little even idling
// (The wipers and the wing are vertices of the body, beta/vehicles/models.js marks which: the car gets its own copy
// of its model before they move, the way dents do, beta/vehicles/damage.js.)
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { Pilot } from '@orig/game/pilot.js';
import { bendBone } from '@orig/people/humans.js';
import { baseOf } from './models.js';
import { HAZE } from '../gfx/post.js';

const G0 = () => window.__nhAskG;
const mine = (v) => { const P = G0() && G0().player; return !!P && !P.onFoot && P.cur === v; };
const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const now = () => performance.now();

// ---------------------------------------------------------------- launch control
// hold the brake (or the handbrake) and floor it from a standstill: the revs come up to the launch point and bounce
// there, and it waits. Let the brake go with the throttle still down and it goes: harder off the line than you'd
// manage on your own, quick shifts, no bog. A bike's front comes up on it. (Defined before the springs, so they
// feel the launch and the tail squats.)
const lu = Vehicle.prototype.update, _li = {};
Vehicle.prototype.update = function (dt, inp, traffic) {
  if (!inp || !(dt > 0) || this.type === 'cycle' || !mine(this)) { if (this._lc) this._lc = null; return lu.call(this, dt, inp, traffic); }
  const L = this._lc || (this._lc = { hold: 0, go: 0, wl: 0 }), thr = inp.throttle || 0, held = (inp.brake || 0) > 0.5 || !!inp.handbrake, S = this.spec;
  if (thr > 0.7 && held && Math.abs(this.v || 0) < 0.6 && !this.reverse) {
    if (!L.hold) L.rpm = this.rpm || 0.2;
    L.hold += dt; L.go = 0;
    {   // (held from the first frame: brake and throttle together would otherwise nudge it back and forth)
      // nothing reaches the road: the handbrake holds it (so it doesn't creep, and the brake isn't taken as asking for reverse)
      const r = lu.call(this, dt, Object.assign(_li, inp, { throttle: 0, brake: 0, handbrake: true }), traffic);
      this.v = 0; this.throttle = 1;
      const tgt = (S.gears && S.gears.length ? 0.62 : 0.5) + 0.035*Math.sin(now()*0.052);
      L.rpm += (tgt - L.rpm)*Math.min(1, dt*6); this.rpm = L.rpm;
      if (!L.armed && L.hold > 0.5) { L.armed = true; const A = G0() && G0().audio; A && A.tone && A.tone('sine', [880], 0.03, 0.012); }
      wheelie(this, L, dt);
      return r;
    }
  } else {
    if (L.armed && !held && thr > 0.7 && Math.abs(this.v || 0) < 1) L.go = 2.6;
    L.hold = 0; L.armed = false;
  }
  const r = lu.call(this, dt, inp, traffic);
  if (L.go > 0) {
    if (thr < 0.5 || (inp.brake || 0) > 0.3 || inp.handbrake || this.reverse) L.go = 0;
    else {
      L.go -= dt;
      // strongest off the line, easing out over the last second; and nothing past what the car could reach anyway
      const k = Math.min(1, L.go/1), room = Math.max(0, 1 - Math.pow(Math.max(0, this.v)/(S.vTop*(this.powerMul ?? 1)), 3));
      this.v += S.acc*(this.accMul || 1)*0.3*k*room*dt;
      if (this.shiftT > 0.07) this.shiftT = 0.07;
    }
  }
  wheelie(this, L, dt);
  return r;
};
function wheelie(v, L, dt) {
  if (!v.spec.two) return;
  const big = v.type === 'superbike' ? 1 : /bike/.test(baseOf(v.type)) ? 0.6 : 0.25;
  const want = L.go > 0 ? 0.2*big*Math.min(1, L.go/1.4)*Math.max(0, 1 - Math.abs(v.v || 0)/20) : 0;
  L.wl += (want - L.wl)*Math.min(1, dt*(want > L.wl ? 3 : 2.4));
  if (L.wl > 0.001) v.wheelie = Math.max(v.wheelie || 0, L.wl);
}

// [radians per m/s² of pitch, natural frequency]: a supercar barely moves, an SUV or a jeep nods
const SPRING = { super: [0.0028, 13], sports: [0.0032, 12], superbike: [0.0042, 12], bike: [0.0048, 11], scooter: [0.005, 10], cycle: [0.002, 12],
  lux: [0.0048, 9], suv: [0.0066, 8], jeep: [0.0072, 7.5], fortuner: [0.0066, 8], scorpio: [0.007, 7.5], xuv: [0.0062, 8], bus: [0.0034, 6.5], tempo: [0.005, 7], auto: [0.0062, 8] };
const springOf = (v) => SPRING[baseOf(v.type)] || [0.0056, 9.5];

const upd = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) {
  const v0 = this.v || 0, r = upd.call(this, dt, inp, traffic);
  if (!(dt > 0)) return r;
  const S = this._sus || (this._sus = { p: 0, pv: 0, a: 0 }), [K, w] = springOf(this), h = Math.min(dt, 0.05);
  // (how hard it's slowing or speeding, smoothed a touch: one frame's jolt isn't a dive)
  const a = Math.max(-14, Math.min(10, ((this.v || 0) - v0)/dt));
  S.a += (a - S.a)*Math.min(1, h*14);
  const want = Math.max(-0.055, Math.min(0.032, S.a*K));
  S.pv += (-w*w*(S.p - want) - 2*0.42*w*S.pv)*h; S.p += S.pv*h;
  if (!isFinite(S.p)) { S.p = S.pv = 0; }
  if (mine(this)) { details(this, h, inp); }
  else if (this._wing && this._wing.k > 0) wing(this, h);
  return r;
};

const sync = Vehicle.prototype.sync;
Vehicle.prototype.sync = function (dt = 0) {
  const r = sync.call(this, dt), S = this._sus;
  if (S && this.tilt) {
    this.tilt.rotation.z += S.p;
    // the wheels stay down on the road while the body pitches and rolls over them
    const F = this._wh4, roll = this.spec && !this.spec.two ? (this.lean || 0) : 0;
    if (F) for (const q of F.list) q.steer.position.y = q.W.y - S.p*q.W.x + roll*q.W.z;
  }
  // the wheel in your hands, seen through the glass
  const C = this.cockpit;
  if (C && C.spin && !this.inCockpit && C.group && C.group.visible) C.spin.rotation.z = (this.steer || 0)*7.5;
  if (this._disc) discGlow(this);
  return r;
};

let warned = false;
function details(v, h, inp) {
  try {
    if (v.moving && v.moving.wing) wing(v, h);
    if (v.moving && v.moving.wipers) wipe(v, h);
    if (v._wh4) brakes(v, h, inp);
    vapour(v, h);
  } catch (e) { if (!warned) { warned = true; console.warn('details', e); } }
}

// ---------------------------------------------------------------- the rear wing
function shift(v, R, dy) {
  const D = v.own(), A = D.body.attributes.position;
  for (let i = R.v0; i < R.v1; i++) A.array[i*3 + 1] += dy;
  A.needsUpdate = true;
}
function wing(v, h) {
  const R = v.moving && v.moving.wing; if (!R) return;
  const W = v._wing || (v._wing = { k: 0, t: 0, off: 0 }), sp = Math.abs(v.v || 0);
  const hard = (v.brake || 0) > 0.6 && sp > 24;
  if (mine(v)) W.t = sp > 30 || hard ? 1 : sp < 20 ? 0 : W.t;
  else W.t = sp < 20 ? 0 : W.t;
  if (W.k === W.t) return;
  if (W.t !== W.last) { W.last = W.t; const A = G0() && G0().audio; A && A.tone && A.tone('sine', W.t ? [150, 178] : [178, 150], 0.7, 0.018); }
  W.k = W.t > W.k ? Math.min(W.t, W.k + h/0.9) : Math.max(W.t, W.k - h/1.1);
  const off = R.lift*sm(W.k);
  shift(v, R, off - W.off); W.off = off;
}

// ---------------------------------------------------------------- wipers
const _ax = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Vector3();
function wipe(v, h) {
  const G = G0(), rain = G && G.weather && G.weather.cur ? G.weather.cur.rain || 0 : 0;
  const S = v._wipe || (v._wipe = { ph: 0, on: false, rest: null });
  if (rain > 0.15) S.on = true;
  if (!S.on && !S.ph) return;
  const D = v.own(), A = D.body.attributes.position, N = D.body.attributes.normal;
  if (!S.rest) S.rest = v.moving.wipers.map(w => ({ w, p: A.array.slice(w.v0*3, w.v1*3), n: N.array.slice(w.v0*3, w.v1*3) }));
  // a sweep and back in 1.1 s in a storm, 1.5 s in rain, with a rest at the bottom between them in light rain
  const T = rain > 0.75 ? 1.1 : 1.5, rest = rain > 0.75 ? 0 : rain > 0.4 ? 0.35 : 1.2;
  S.ph += h/(T + rest);
  if (S.ph >= 1) { S.ph = rain > 0.15 ? S.ph % 1 : 0; if (rain <= 0.15) S.on = false; }
  const f = Math.min(1, S.ph*(T + rest)/T), ang = 1.5*(1 - Math.cos(f*Math.PI*2))/2;
  for (const { w, p, n } of S.rest) {
    const u = w.up, L = Math.hypot(u[0], u[1]) || 1;
    _ax.set(u[1]/L, -u[0]/L, 0); _q.setFromAxisAngle(_ax, ang*(w.sg || 1));
    for (let i = 0; i < p.length; i += 3) {
      _p.set(p[i] - w.at[0], p[i + 1] - w.at[1], p[i + 2] - w.at[2]).applyQuaternion(_q);
      const o = w.v0*3 + i; A.array[o] = _p.x + w.at[0]; A.array[o + 1] = _p.y + w.at[1]; A.array[o + 2] = _p.z + w.at[2];
      _p.set(n[i], n[i + 1], n[i + 2]).applyQuaternion(_q); N.array[o] = _p.x; N.array[o + 1] = _p.y; N.array[o + 2] = _p.z;
    }
  }
  A.needsUpdate = N.needsUpdate = true;
}

// ---------------------------------------------------------------- brake discs
const DISC = new THREE.CylinderGeometry(1, 1, 0.024, 24); DISC.rotateX(Math.PI/2);
function brakes(v, h, inp) {
  const sp = Math.abs(v.v || 0), b = Math.max(v.brake || 0, inp ? inp.brake || 0 : 0);
  if (!v._disc) {
    v._disc = v._wh4.list.map(q => {
      const m = new THREE.Mesh(DISC, new THREE.MeshBasicMaterial({ color: 0x1c1c1e, fog: true }));
      const r = q.W.r*0.56; m.scale.set(r, r, 1); m.position.z = -Math.sign(q.W.z || 1)*0.05;
      q.steer.add(m); return { m, heat: 0, front: q.front };
    });
  }
  // the heat goes in with how hard and how fast you brake, mostly at the front, and leaves over a few seconds
  for (const d of v._disc) { d.heat += (b > 0.2 && !v.reverse ? b*sp*sp*0.00018*(d.front ? 1.25 : 0.7) : 0)*h - d.heat*0.16*h; d.heat = Math.min(1.2, Math.max(0, d.heat)); }
}
const _c = new THREE.Color();
function discGlow(v) {
  for (const d of v._disc) {
    const g = Math.max(0, d.heat - 0.3)/0.9, e = g*g;
    _c.setRGB(0.11 + e*2.4, 0.11 + e*0.55, 0.12 + e*0.05);
    d.m.material.color.copy(_c);
  }
}
const disp = Vehicle.prototype.dispose;
Vehicle.prototype.dispose = function () { if (this._disc) for (const d of this._disc) d.m.material.dispose(); return disp.call(this); };

// ---------------------------------------------------------------- a cold start
let puffTex = null;
function tex() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (puffTex = new THREE.CanvasTexture(c));
}
const puffs = [];
const COLD = 180e3;                  // standing three minutes or more: a cold engine
function vapour(v, h) {
  const t = now();
  // (first driven in a while: the engine's cold)
  if (v._lastRun === undefined || t - v._lastRun > COLD) v._coldT = 28;
  v._lastRun = t;
  if (!(v._coldT > 0) || v.type === 'cycle') return;
  v._coldT -= h;
  const k = Math.min(1, v._coldT/28), rate = (0.6 + 3.2*k*k)*(Math.abs(v.v || 0) < 2 ? 1 : 0.5);
  v._puffA = (v._puffA || 0) + rate*h;
  while (v._puffA >= 1) { v._puffA -= 1; emit(v, 0.6 + 0.5*k); }
}
const _w = new THREE.Vector3();
function emit(v, big) {
  const G = G0(); if (!G || !G.scene || !v.tilt) return;
  let q = puffs.find(p => p.life >= p.max);
  if (!q) { if (puffs.length >= 40) return; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(), color: 0xeeeeea, transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = 2; G.scene.add(s); q = { s, life: 1, max: 0 }; puffs.push(q); }
  const S = v.spec || {}, L = S.L || 4, Wd = S.W || 1.7, low = /^(super|sports)$/.test(baseOf(v.type)), side = low && Math.random() < 0.5 ? -1 : 1;
  v.tilt.updateWorldMatrix(true, false);
  _w.set(-L/2 - 0.06, S.two ? 0.35 : 0.3, side*Wd*0.27).applyMatrix4(v.tilt.matrixWorld);
  const hx = Math.cos(v.th), hz = Math.sin(v.th), sp = v.v || 0;
  Object.assign(q, { x: _w.x, y: _w.y, z: _w.z, vx: hx*sp*0.6 - hx*0.45 + (Math.random() - 0.5)*0.12, vy: 0.18 + Math.random()*0.12, vz: hz*sp*0.6 - hz*0.45 + (Math.random() - 0.5)*0.12, life: 0, max: 1.6 + Math.random()*1.1, sz: 0.14*big, a: 0.26*big });
}
let lastF = -1;
function tickPuffs() {
  const G = G0(), f = G && G.renderer ? G.renderer.info.render.frame : 0;
  if (f === lastF) return; lastF = f;
  const h = 1/60;
  for (const q of puffs) {
    if (q.life >= q.max) { q.s.visible = false; continue; }
    q.life += h; const t = q.life/q.max;
    q.vx *= 1 - 1.5*h; q.vz *= 1 - 1.5*h; q.vy += 0.05*h;
    q.x += q.vx*h; q.y += q.vy*h; q.z += q.vz*h;
    q.s.visible = true; q.s.position.set(q.x, q.y, q.z);
    const sc = q.sz*(1 + t*5.5); q.s.scale.set(sc, sc, 1);
    q.s.material.opacity = q.a*Math.pow(1 - t, 1.6)*Math.min(1, t*8);
  }
}

// ---------------------------------------------------------------- your head, into the corner
const _up = new THREE.Vector3(0, 1, 0);
const place = Pilot.prototype.placeRider;
Pilot.prototype.placeRider = function () {
  const r = place.call(this), v = this.riderShown, H = this.human;
  tickPuffs();
  if (!v || !H || v.inCockpit || !H.body || !H.body.skeleton) return r;
  const B = H._lookB || (H._lookB = { head: H.body.skeleton.getBoneByName('Head'), neck: H.body.skeleton.getBoneByName('Neck'), y: 0 });
  // where you're about to go: the wheel you've put on, and how hard it's turning
  const want = Math.max(-0.5, Math.min(0.5, (v.steer || 0)*1.4 + (v.latAcc || 0)*0.012))*(Math.abs(v.v || 0) > 0.5 ? 1 : 0.4);
  B.y += (want - B.y)*Math.min(1, (1/60)*5);
  if (Math.abs(B.y) < 0.004) return r;
  if (B.neck) bendBone(B.neck, _up, -B.y*0.4);
  if (B.head) bendBone(B.head, _up, -B.y*0.6);
  return r;
};
// (puffs left in the air when you get out still drift and go)
const pu = Pilot.prototype.update;
Pilot.prototype.update = function (...a) { const r = pu.apply(this, a); if (this.onFoot) tickPuffs(); return r; };

// ---------------------------------------------------------------- indicators
const BLINK = 353;                   // ms on, ms off: 85 a minute
function indOf(v) { return v._ind || (v._ind = { s: 0, haz: false, t0: 0, peak: 0, ph: -1 }); }
function indKeys(P, input) {
  const v = P.cur; if (!v || !input || !input.took) return;
  const I = indOf(v), t = now();
  // , and . together (within a third of a second) for the hazards: / is the terminal's
  const press = (s) => {
    if (I.last && I.last.s === -s && t - I.last.t < 320) { I.haz = !I.haz; I.s = I.last.was; I.last = null; I.t0 = t; I.ph = -1; return; }
    I.last = { s, t, was: I.s };
    I.s = I.s === s ? 0 : s; I.peak = 0; if (!I.haz) { I.t0 = t; I.ph = -1; }
  };
  if (input.took('Comma')) press(-1);
  if (input.took('Period')) press(1);
}
function indTick(v) {
  const I = v._ind; if (!I || (!I.s && !I.haz)) return;
  // turned that way and back: off (the wheel's own cancelling cam)
  if (I.s) { const st = (v.steer || 0)*I.s; I.peak = Math.max(I.peak, st); if (I.peak > 0.16 && st < 0.04) { I.s = 0; I.peak = 0; } }
  const ph = Math.floor((now() - I.t0)/BLINK) % 2;
  if (ph !== I.ph) { I.ph = ph; const A = G0() && G0().audio; if (A && A.tone && (I.s || I.haz)) A.tone('sine', [ph ? 980 : 1240], 0.022, 0.022); }
}
const _iv = new THREE.Vector3();
function indHook(v) {
  const mesh = v.bodyMesh; if (!mesh || mesh._indHook) return;
  mesh._indHook = true;
  const b0 = mesh.onBeforeRender, a0 = mesh.onAfterRender;
  mesh.onBeforeRender = function (r, sc, cam, geo, m, g) {
    b0 && b0.call(this, r, sc, cam, geo, m, g);
    const u = m && m.uniforms && m.uniforms.uInd, I = v._ind; if (!u || !I || (!I.s && !I.haz)) return;
    const on = Math.floor((now() - I.t0)/BLINK) % 2 === 0 ? 1 : 0;
    u.value.copy(_iv.set(I.s < 0 || I.haz ? 1 : 0, I.s > 0 || I.haz ? 1 : 0, on)); m.uniformsNeedUpdate = true;
  };
  mesh.onAfterRender = function (r, sc, cam, geo, m, g) {
    a0 && a0.call(this, r, sc, cam, geo, m, g);
    const u = m && m.uniforms && m.uniforms.uInd; if (u && (u.value.x || u.value.y)) { u.value.set(0, 0, 0); m.uniformsNeedUpdate = true; }
  };
}
const pu2 = Pilot.prototype.update;
Pilot.prototype.update = function (dt, inp, traffic, input, ...a) {
  const r = pu2.call(this, dt, inp, traffic, input, ...a), v = this.cur;
  if (!this.onFoot && v && v.bodyMesh) { try { indKeys(this, input); indHook(v); indTick(v); } catch (e) { if (!warned) { warned = true; console.warn('details', e); } } }
  return r;
};

// ---------------------------------------------------------------- heat haze
function haze(v, h) {
  if (v.type === 'cycle') return;
  const sp = Math.abs(v.v || 0), thr = Math.max(0, v.throttle || 0), low = /^(super|sports)$/.test(baseOf(v.type));
  // hot from hard running (the throttle high, the revs up), cooling over three or four minutes
  v._hot = Math.min(1, Math.max(0, (v._hot || 0) + h*(thr*(v.rpm || 0.5)*(sp > 2 ? 0.03 : 0.008)) - h*0.0045));
  const G = G0(), rain = (G && G.weather && G.weather.cur && G.weather.cur.rain) || 0;
  // at speed it's blown flat behind the car and you don't see it
  const k = (Math.max(v._hot, low ? 0.22 : 0.06))*(1 - Math.min(1, Math.max(0, (sp - 3)/9)))*(1 - 0.75*rain);
  if (k < 0.02 || HAZE.length) return;
  const S = v.spec || {}, L = S.L || 4, Wd = S.W || 1.7;
  v.tilt.updateWorldMatrix(true, false);
  _hz.set(-L/2 - 0.12, S.two ? 0.4 : 0.34, (low ? 0 : 0.27)*Wd).applyMatrix4(v.tilt.matrixWorld);
  HAZE.push({ x: _hz.x, y: _hz.y, z: _hz.z, k: Math.min(1, k)*(low ? 1 : 0.8) });
}
const _hz = new THREE.Vector3();
const pu3 = Pilot.prototype.update;
Pilot.prototype.update = function (dt, ...a) {
  const r = pu3.call(this, dt, ...a), v = this.cur;
  if (!this.onFoot && v && v.tilt) { try { haze(v, Math.min(0.1, dt || 0.016)); } catch (e) { if (!warned) { warned = true; console.warn('details', e); } } }
  return r;
};
