// What a supercar does that nothing else in Pune does. Work it hard and lift off, shift or launch, and flames spit from
// the pipes, each with its own crack, never in step, by the drive mode and how hard it's been worked. And what it costs: slides wear tyres away, an
// ordinary car's in half a minute of sliding, a supercar's in over a minute, and a flat one lets go sooner.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';

// each pipe's mouth in the vehicle's own space ([across, up, along]); a fourth value: one pipe, on that side, not a pair.
// The two big bikes as well: the superbike's short can on the right, the Bullet's long silencer. A stock Bullet mostly
// pops on the overrun, and only now and then shows a little flame; a superbike in its Sport mode crackles, in Road hardly,
// in Rain never
const PORTS = { super: [0.4, 0.5, -2.31], sports: [0.14, 0.42, -2.3], superbike: [0.2, 0.563, -0.64, 1], bullet: [0.21, 0.465, -0.87, 1] };
const TAME = { sports: 0.55, superbike: 0.7, bullet: 0.22 };
// The flames are what a real car's are: afterfire. Fuel that didn't burn in the engine lights in the hot pipe when you
// lift off at high revs, on a shift, off the line. It's a short tongue from the pipe, a hand to a forearm long, that
// stays ON the pipe (it's gas leaving at speed and burnt out within a tenth of a second, not smoke left hanging in the
// road behind), orange and yellow from the soot in it with only a small blue root at the lip when it's burning hot and
// clean, and gone in two or three frames. On the overrun they come as a crackle: a run of bangs close together, each
// smaller than the last as the pipe clears, and only some of them show fire at all (most in the track mode, few in the
// road one). Each crack sounds with its own flash.
const N = 220;
let tex = null, pool = null;
function flameTex() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.75)'); g.addColorStop(0.65, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (tex = t);
}
function poolOf(G) {
  if (pool) return pool;
  const m = new THREE.MeshBasicMaterial({ map: flameTex(), color: 0xffffff, toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m, N); mesh.frustumCulled = false; mesh.count = 0;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N*3), 3); mesh.renderOrder = 6;
  return (pool = { mesh, p: [], k: 0, m4: new THREE.Matrix4(), s: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), live: 0 });
}
// what afterfire looks like: a ragged ball of flame that bursts out of the pipe, swells and rolls as it burns and is gone:
// bright yellow in the middle where it's hottest, orange round it, a deep red at its edge as it goes out. (Many puffs
// lie over one another and add up: each is dim, so the heart of it comes to yellow and its edge stays orange.) A clean,
// straight, blue-white jet is nitrous or a jet engine, not this
const RAMP = [[1.7, 1.2, 0.42], [1.55, 0.78, 0.14], [1.2, 0.4, 0.06], [0.6, 0.13, 0.02], [0.12, 0.02, 0.004]];
function ramp(t, o, i, a) {
  const u = Math.min(3.999, Math.max(0, t)*4), k = Math.floor(u), f = u - k, A = RAMP[k], B = RAMP[k + 1];
  o[i] = (A[0] + (B[0] - A[0])*f)*a; o[i + 1] = (A[1] + (B[1] - A[1])*f)*a; o[i + 2] = (A[2] + (B[2] - A[2])*f)*a;
}
const _pq = new THREE.Quaternion();
// The fire belongs to the pipe. Every puff lives in the car's own space (the mesh rides on the car's body, where the
// pipes are), so it comes out of the pipe and stays on it at any speed, drawn exactly where the car is drawn. Worked
// out in the road's space it trailed a frame behind the car: a metre or two back at speed.
function puff(Pl, v, P, s, big, hot, sp) {
  if (Pl.mesh.parent !== v.tilt) { v.tilt.add(Pl.mesh); for (const q of Pl.p) if (q) q.life = q.max; }
  const q = Pl.p[Pl.k] || (Pl.p[Pl.k] = {}); Pl.k = (Pl.k + 1)%N;
  // (it bursts out of the pipe's mouth every which way within a cone and the air stops it in a forearm's length; each
  // puff starts small and swells as it burns. sp: a spark, a bit of glowing carbon thrown clear, which falls)
  const cone = (Math.random() - 0.5)*0.75, lift = (Math.random() - 0.35)*0.5, out = sp ? 7 + Math.random()*7 : (2.6 + Math.random()*4.4)*(0.75 + big*0.4);
  Object.assign(q, { x: P[2] + 0.02, y: P[1] + (Math.random() - 0.5)*0.04, z: s*P[0] + (Math.random() - 0.5)*0.05, vx: -out*Math.cos(cone), vy: out*lift*(sp ? 0.5 : 0.35), vz: out*Math.sin(cone)*(sp ? 0.6 : 0.5),
    life: 0, max: sp ? 0.16 + Math.random()*0.22 : (0.07 + Math.random()*0.09)*(0.8 + big*0.3), sz: sp ? 0.012 + Math.random()*0.008 : (0.045 + Math.random()*0.04)*(0.8 + big*0.35), ph: Math.random()*6.283, fr: 30 + Math.random()*50, hot, sp: !!sp, tu: (Math.random() - 0.5)*5, tv: (Math.random() - 0.5)*5 });
}
function tickPool(dt) {
  const S = pool, G = window.__nhAskG, cam = G && G.camera; if (!S || !cam || !S.mesh.parent) return;
  // (facing you, from inside the car's own turn and lean)
  S.mesh.parent.getWorldQuaternion(_pq); S.q.copy(_pq).invert().multiply(cam.quaternion);
  const col = S.mesh.instanceColor.array; let n = 0;
  const V = G.player && G.player.cur, wind = V && S.mesh.parent === V.tilt ? Math.abs(V.v || 0) : 0;
  for (const q of S.p) {
    if (!q || q.life >= q.max) continue;
    q.life += dt; if (q.life >= q.max) continue;
    const t = q.life/q.max;
    if (q.sp) {
      // a spark: thrown clear, slowed a little by the air, falling, going dull
      q.vx = q.vx*(1 - 2.5*dt) - wind*0.6*dt; q.vz *= 1 - 2.5*dt; q.vy -= 9.8*dt;
      q.x += q.vx*dt; q.y += q.vy*dt; q.z += q.vz*dt;
      S.s.set(q.sz, q.sz, q.sz); S.m4.compose(S.v.set(q.x, q.y, q.z), S.q, S.s); S.mesh.setMatrixAt(n, S.m4);
      ramp(0.15 + t*0.6, col, n*3, (1 - t)*1.6); n++; continue;
    }
    // (the fire leaves the pipe and the air stops it; it rolls and wanders as it burns, rises a little with its own heat,
    // and the wind of the car's speed leans it back)
    const dr = Math.max(0, 1 - 11*dt);
    q.vx = q.vx*dr - wind*0.7*dt; q.vz = q.vz*dr + q.tu*dt; q.vy = q.vy*dr + (1.8 + q.tv)*dt;
    q.x += q.vx*dt; q.y += q.vy*dt; q.z += q.vz*dt;
    const fl = 0.7 + 0.3*Math.sin(q.ph + q.life*q.fr), sc = q.sz*(0.7 + t*3.2)*fl;
    S.s.set(sc, sc, sc); S.m4.compose(S.v.set(q.x, q.y, q.z), S.q, S.s); S.mesh.setMatrixAt(n, S.m4);
    ramp(q.hot > 0.5 ? t*0.9 : 0.06 + t*0.9, col, n*3, (1 - t*t)*fl*0.6); n++;
  }
  S.mesh.count = n; S.live = n; S.mesh.instanceMatrix.needsUpdate = true; S.mesh.instanceColor.needsUpdate = true;
}
function rig(G) { poolOf(G); return { t: 0, q: [], on: 0, big: 1, held: 0, launched: false, em: 0, gear0: 0, hot: 0 }; }
// one bang: its crack (always), and its flash at the pipes if this one shows (z: how big, 0 to about 1.4)
function fire(v, F, A, B) {
  const z = B.z;
  if (B.flame) { F.on = 0.02 + Math.random()*0.02 + z*0.012; F.big = z; F.lag = Math.random() < 0.35 ? 0.01 + Math.random()*0.015 : 0; F.hot = 0; F.spk = Math.random() < 0.3 + z*0.4 ? 1 + Math.floor(Math.random()*(2 + z*3)) : 0; }
  if (A && A.noiseBurst) { const k = 0.45 + z*0.5; A.noiseBurst(0.04 + z*0.02, 420 + Math.random()*480, 0.8, (0.09 + Math.random()*0.06)*k); A.noiseBurst(0.014, 2300 + Math.random()*900, 1.4, 0.04*k); }
}
const upd = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) {
  const r = upd.call(this, dt, inp, traffic), G = window.__nhAskG, S = this.spec;
  // (once a frame, however many vehicles there are. Once for each of them, the fire went at two or three times your speed and
  // came out ahead of the car)
  if (pool && pool.live && dt > 0 && pool.at !== G?.renderer?.info?.render?.frame) { pool.at = G?.renderer?.info?.render?.frame; tickPool(dt); }
  if (this.W.playerVeh !== this || dt <= 0) return r;
  // ---- a slide wears the tyres; the back ones first
  if (!S.two && this.wheels && (this.skidL || 0) > 0.3) {
    this._wear = (this._wear || 0) + dt*this.skidL*(PORTS[this.type] ? 0.013 : 0.03);
    if (this._wear >= 1) {
      this._wear = 0.5;
      const w = this.wheels.filter(q => q.x < 0 && !(this._flats && this._flats.has(q)))[Math.random() < 0.5 ? 0 : 1] || this.wheels.find(q => !(this._flats && this._flats.has(q)));
      if (w && this.flatWheel) { this.flatWheel(w); G?.hud?.toast?.('Tyre', 'One of your tyres is gone', 'bad', 2); }
    }
  }
  const P = PORTS[this.type]; if (!P) return r;
  // ---- the flames: unburnt fuel lighting in a hot pipe. It takes work to get there: revs held with your foot in it, a good
  // while in the calmest mode (a tap gives nothing at all, and it wants real speed), hardly any in the wildest, which runs
  // so rich it spits on every lift and shift and now and then with your foot flat. How big by the same reckoning.
  const F = this._fl || (this._fl = rig(G)), thr = inp.throttle || 0, sp = Math.abs(this.v), rpm = this.rpm || 0, pops = this.modePops ?? 1;
  const calm = pops < 0.3, wild = pops > 1;
  F.t += dt;
  if (thr > 0.7) F.held += dt;
  F.work = Math.max(0, Math.min(1, (F.work || 0) + (thr > 0.7 ? dt*(0.25 + rpm)*(calm ? 0.55 : wild ? 1.8 : 1) : -dt*0.5)));
  F.size = (calm ? 0.65 : wild ? 1.3 : 1)*(0.7 + F.work*0.5);
  const lift = (this._thr0 ?? 0) > 0.7 && thr < 0.15;
  // a run of bangs: close together, each smaller than the one before; show: how many of them show fire; a 911 does it
  // a good deal less than a Lamborghini
  const tame = TAME[this.type] ?? 1;
  if (this.modePops === 0) { this._thr0 = thr; return r; }
  const go = (t, n, show, z0 = 1) => { let z = z0*F.size*tame*(0.85 + Math.random()*0.3); for (; n > 0; n--) { F.q.push({ t, z, flame: Math.random() < show*tame, hot: Math.random() < (wild ? 0.5 : 0.2)*F.work ? 1 : 0 }); t += 0.045 + Math.random()*0.1; z *= 0.72 + Math.random()*0.2; } };
  if (lift && !F.q.length) {
    F.over = true;
    if (calm) { if (sp > 30 && rpm > 0.5 && F.work > 0.55) go(F.t + 0.06, 1 + Math.floor(Math.random()*2), 0.25, 0.6); }
    else if (wild) { if (rpm > 0.4 || F.held > 0.3) go(F.t + 0.04, 4 + Math.floor(rpm*5 + Math.random()*3), 0.8, 0.8 + rpm*0.4); }
    else if (sp > 10 && rpm > 0.5 && F.work > 0.2) go(F.t + 0.05, 2 + Math.floor(rpm*3 + Math.random()*2), 0.45, 0.6 + rpm*0.3);
  }
  // pulling away flat out, in anything but the calmest
  if (!calm && thr > 0.9 && sp < 4 && !this.reverse && !F.launched && F.held > (wild ? 0.15 : 0.4)) { F.launched = true; go(F.t, wild ? 2 : 1, wild ? 0.9 : 0.5, 0.9); }
  // an upshift under power: the one crack as the spark's cut
  if (this.gear > F.gear0 && thr > 0.7) { if (wild) go(F.t, 1, 0.9, 0.7 + rpm*0.4); else if (!calm && rpm > 0.6 && F.work > 0.5) go(F.t, 1, 0.35, 0.6); }
  F.gear0 = this.gear;
  if (thr < 0.2) { F.launched = false; F.held = 0; }
  // (your foot back in it: the fuel's burning in the engine again, and the crackle stops)
  if (thr > 0.4 && F.over) { F.over = false; F.q.length = 0; }
  this._thr0 = thr;
  while (F.q.length && F.q[0].t <= F.t) fire(this, F, G?.audio, F.q.shift());
  if (F.on > 0) {
    F.on -= dt; F.em += dt*(300 + F.big*200);
    const Pl = poolOf(G);
    while (F.em >= 1) { F.em -= 1; for (const s2 of P[3] ? [P[3]] : [-1, 1]) if (s2 < 0 || P[3] || F.on > (F.lag || 0)) puff(Pl, this, P, s2, F.big, F.hot); }
    for (; F.spk > 0; F.spk--) puff(Pl, this, P, P[3] || (Math.random() < 0.5 ? -1 : 1), F.big, 0, true);
    Pl.live = Math.max(Pl.live, 1);
  }
  return r;
};
