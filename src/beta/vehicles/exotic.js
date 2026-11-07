// What a supercar does that nothing else in Pune does. Work it hard and lift off, shift or launch, and flames spit from
// the pipes, each with its own crack, never in step, by the drive mode and how hard it's been worked. And what it costs: slides wear tyres away, an
// ordinary car's in half a minute of sliding, a supercar's in over a minute, and a flat one lets go sooner.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';

const PORTS = { super: [0.4, 0.5, -2.31], sports: [0.14, 0.42, -2.3] };
// The flames are fire, not a picture of one: each bang throws out a stream of little burning puffs from the pipe that leave at
// speed, slow, swell and rise as they burn: blue-white at the lip, yellow, orange, then a dull red going out, each flickering
// on its own, with a few sparks going further. They're left in the air behind the car, the way a real one is.
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
// white-blue at the lip, then yellow, orange, a deep red, going out
const RAMP = [[2.2, 2.6, 3.4], [3.2, 2.5, 1.2], [3, 1.3, 0.25], [1.7, 0.4, 0.05], [0.5, 0.08, 0.01]];
function ramp(t, o, i, a) {
  const u = Math.min(3.999, Math.max(0, t)*4), k = Math.floor(u), f = u - k, A = RAMP[k], B = RAMP[k + 1];
  o[i] = (A[0] + (B[0] - A[0])*f)*a; o[i + 1] = (A[1] + (B[1] - A[1])*f)*a; o[i + 2] = (A[2] + (B[2] - A[2])*f)*a;
}
const _w = new THREE.Vector3();
function puff(Pl, v, P, s, big) {
  v.tilt.updateWorldMatrix(true, false);
  _w.set(P[2], P[1], s*P[0]).applyMatrix4(v.tilt.matrixWorld);
  // (that matrix is from when it was last drawn: at 300 km/h the pipe's a metre or more on from there)
  if (v.root) { _w.x += v.x - v.root.position.x; _w.z += v.z - v.root.position.z; }
  const hx = Math.cos(v.th), hz = Math.sin(v.th), fv = v.v || 0, lv = v.vl || 0, cx = hx*fv - hz*lv, cz = hz*fv + hx*lv;
  const q = Pl.p[Pl.k] || (Pl.p[Pl.k] = {}); Pl.k = (Pl.k + 1)%N;
  const out = (5 + Math.random()*11)*big, a = (Math.random() - 0.5)*0.24, up = Math.random()*0.16 - 0.03, bx = -(hx - hz*a), bz = -(hz + hx*a);
  Object.assign(q, { x: _w.x, y: _w.y, z: _w.z, vx: cx + bx*out, vy: up*out + 0.25, vz: cz + bz*out, cx, cz, life: 0, max: (0.07 + Math.random()*0.16)*(0.8 + big*0.4), sz: (0.07 + Math.random()*0.08)*(0.8 + big*0.35), ph: Math.random()*6.283, fr: 30 + Math.random()*50 });
}
function tickPool(dt) {
  const S = pool, G = window.__nhAskG, cam = G && G.camera; if (!S || !cam) return;
  S.q.copy(cam.quaternion);
  const col = S.mesh.instanceColor.array; let n = 0;
  for (const q of S.p) {
    if (!q || q.life >= q.max) continue;
    q.life += dt; if (q.life >= q.max) continue;
    const dr = Math.max(0, 1 - 7*dt);                        // (it leaves fast and the air stops it; what's left is carried with the car for a moment)
    q.vx = (q.vx - q.cx)*dr + q.cx*(1 - 2.5*dt); q.vz = (q.vz - q.cz)*dr + q.cz*(1 - 2.5*dt); q.cx *= 1 - 2.5*dt; q.cz *= 1 - 2.5*dt; q.vy += 2.2*dt;
    q.x += q.vx*dt; q.y += q.vy*dt; q.z += q.vz*dt;
    const t = q.life/q.max, fl = 0.72 + 0.28*Math.sin(q.ph + q.life*q.fr), sc = q.sz*(0.55 + t*2.2)*fl;
    S.s.set(sc, sc, sc); S.m4.compose(S.v.set(q.x, q.y, q.z), S.q, S.s); S.mesh.setMatrixAt(n, S.m4);
    ramp(t*0.95, col, n*3, (1 - t*t)*fl); n++;
  }
  S.mesh.count = n; S.live = n; S.mesh.instanceMatrix.needsUpdate = true; S.mesh.instanceColor.needsUpdate = true;
}
function rig(G) { poolOf(G); return { t: 0, q: [], on: 0, big: 1, held: 0, launched: false, em: 0, gear0: 0 }; }
function fire(v, F, A) {
  // a bang: a stream for a moment, one pipe often a beat ahead of the other
  const z = F.size ?? 1; F.on = (0.05 + Math.random()*0.08)*(0.7 + z*0.3); F.big = (0.7 + Math.random()*0.8)*z; F.lag = Math.random()*0.03;
  if (A && A.noiseBurst) { A.noiseBurst(0.05, 480 + Math.random()*520, 0.8, 0.14 + Math.random()*0.1); A.noiseBurst(0.018, 2300 + Math.random()*900, 1.4, 0.05); }
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
  const go = (t, n, p) => { for (; n > 0; n--) { if (Math.random() < p) F.q.push(t); t += 0.07 + Math.random()*0.12; } };
  if (lift) {
    if (calm) { if (sp > 30 && rpm > 0.42 && F.work > 0.55) go(F.t + 0.05, 1 + Math.floor(Math.random()*2), 0.75); }
    else if (wild) { if (rpm > 0.35 || F.held > 0.06) go(F.t + 0.03, 2 + Math.floor(Math.random()*5), 1); }
    else if (sp > 13 && rpm > 0.55 && F.work > 0.25) go(F.t + 0.03, 1 + Math.floor(Math.random()*3), 0.85);
  }
  // pulling away flat out, in anything but the calmest
  if (!calm && thr > 0.9 && sp < 4 && !this.reverse && !F.launched && F.held > (wild ? 0.12 : 0.35)) { F.launched = true; go(F.t, wild ? 3 : 1, 1); }
  // an upshift under power
  if (this.gear > F.gear0 && thr > 0.7) { if (wild) go(F.t, 2 + Math.floor(Math.random()*2), 1); else if (!calm && rpm > 0.6 && F.work > 0.5) go(F.t, 1, 0.5); else if (calm && sp > 34 && F.work > 0.7) go(F.t, 1, 0.2); }
  F.gear0 = this.gear;
  // the wildest, foot flat and high up the revs: it can't burn it all
  if (wild && thr > 0.9 && rpm > 0.72 && Math.random() < dt*0.9) go(F.t, 1, 1);
  if (thr < 0.2) { F.launched = false; F.held = 0; }
  this._thr0 = thr;
  while (F.q.length && F.q[0] <= F.t) { F.q.shift(); fire(this, F, G?.audio); }
  if (F.on > 0) {
    F.on -= dt; F.em += dt*420;
    const Pl = poolOf(G);
    while (F.em >= 1) { F.em -= 1; for (const s of [-1, 1]) if (s < 0 || F.on > (F.lag || 0)*0.5) puff(Pl, this, P, s, F.big); }
    Pl.live = Math.max(Pl.live, 1);
  }
  return r;
};
