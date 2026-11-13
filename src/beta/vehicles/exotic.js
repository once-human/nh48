// What a supercar does that nothing else in Pune does. Work it hard and lift off, shift or launch, and flames spit from
// the pipes, each with its own crack, never in step, by the drive mode and how hard it's been worked. And what it costs: slides wear tyres away, an
// ordinary car's in half a minute of sliding, a supercar's in over a minute, and a flat one lets go sooner.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';

const PORTS = { super: [0.4, 0.5, -2.31], sports: [0.14, 0.42, -2.3] };
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
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N*3), 3); G.scene.add(mesh);
  return (pool = { mesh, p: [], k: 0, m4: new THREE.Matrix4(), s: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), live: 0 });
}
// a small blue root at the lip, then yellow, orange, a deep red, going out. (Many puffs lie over one another and add up:
// each is dim, so the middle of the flame comes to a bright yellow and its edge stays orange, never a white ball)
const RAMP = [[0.5, 0.75, 1.7], [1.5, 1.05, 0.32], [1.35, 0.6, 0.1], [0.8, 0.2, 0.03], [0.22, 0.04, 0.005]];
function ramp(t, o, i, a) {
  const u = Math.min(3.999, Math.max(0, t)*4), k = Math.floor(u), f = u - k, A = RAMP[k], B = RAMP[k + 1];
  o[i] = (A[0] + (B[0] - A[0])*f)*a; o[i + 1] = (A[1] + (B[1] - A[1])*f)*a; o[i + 2] = (A[2] + (B[2] - A[2])*f)*a;
}
const _w = new THREE.Vector3();
function puff(Pl, v, P, s, big, hot) {
  v.tilt.updateWorldMatrix(true, false);
  _w.set(P[2], P[1], s*P[0]).applyMatrix4(v.tilt.matrixWorld);
  // (that matrix is from when it was last drawn: at 300 km/h the pipe's a metre or more on from there)
  if (v.root) { _w.x += v.x - v.root.position.x; _w.z += v.z - v.root.position.z; }
  const hx = Math.cos(v.th), hz = Math.sin(v.th);
  const q = Pl.p[Pl.k] || (Pl.p[Pl.k] = {}); Pl.k = (Pl.k + 1)%N;
  // (out along the pipe at a jet's pace and stopped by the air in a couple of hand's lengths; hot: how blue its root is)
  const out = (5 + Math.random()*6)*(0.7 + big*0.45), a = (Math.random() - 0.5)*0.16, up = Math.random()*0.08 - 0.03, bx = -(hx - hz*a), bz = -(hz + hx*a);
  Object.assign(q, { x: _w.x, y: _w.y, z: _w.z, vx: bx*out, vy: up*out, vz: bz*out, v, x0: v.x, z0: v.z, life: 0, max: (0.035 + Math.random()*0.05)*(0.75 + big*0.35), sz: (0.05 + Math.random()*0.035)*(0.8 + big*0.3), ph: Math.random()*6.283, fr: 40 + Math.random()*60, hot });
}
function tickPool(dt) {
  const S = pool, G = window.__nhAskG, cam = G && G.camera; if (!S || !cam) return;
  S.q.copy(cam.quaternion);
  const col = S.mesh.instanceColor.array; let n = 0;
  for (const q of S.p) {
    if (!q || q.life >= q.max) continue;
    q.life += dt; if (q.life >= q.max) continue;
    // (it goes with the car, as the pipe does: what moves is the gas along the pipe, quickly, and the air stops it)
    const dr = Math.max(0, 1 - 16*dt), V = q.v;
    q.vx *= dr; q.vz *= dr; q.vy = q.vy*dr + 0.6*dt;
    if (V) { q.x += V.x - q.x0; q.z += V.z - q.z0; q.x0 = V.x; q.z0 = V.z; }
    q.x += q.vx*dt; q.y += q.vy*dt; q.z += q.vz*dt;
    const t = q.life/q.max, fl = 0.78 + 0.22*Math.sin(q.ph + q.life*q.fr), sc = q.sz*(0.75 + t*1.5)*fl;
    S.s.set(sc, sc, sc); S.m4.compose(S.v.set(q.x, q.y, q.z), S.q, S.s); S.mesh.setMatrixAt(n, S.m4);
    // (the blue root only on a hot, clean one, and only in the first moment of it)
    ramp(q.hot > 0.5 ? t*0.95 : 0.2 + t*0.75, col, n*3, (1 - t*t)*fl*0.55); n++;
  }
  S.mesh.count = n; S.live = n; S.mesh.instanceMatrix.needsUpdate = true; S.mesh.instanceColor.needsUpdate = true;
}
function rig(G) { poolOf(G); return { t: 0, q: [], on: 0, big: 1, held: 0, launched: false, em: 0, gear0: 0, hot: 0 }; }
// one bang: its crack (always), and its flash at the pipes if this one shows (z: how big, 0 to about 1.4)
function fire(v, F, A, B) {
  const z = B.z;
  if (B.flame) { F.on = 0.028 + Math.random()*0.03 + z*0.012; F.big = z; F.lag = Math.random() < 0.35 ? 0.012 + Math.random()*0.02 : 0; F.hot = B.hot; }
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
  const tame = this.type === 'sports' ? 0.55 : 1;
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
    F.on -= dt; F.em += dt*(260 + F.big*160);
    const Pl = poolOf(G);
    while (F.em >= 1) { F.em -= 1; for (const s2 of [-1, 1]) if (s2 < 0 || F.on > (F.lag || 0)) puff(Pl, this, P, s2, F.big, F.hot); }
    Pl.live = Math.max(Pl.live, 1);
  }
  return r;
};
