// What a supercar does that nothing else in Pune does. Lift off at high revs, blip it, or launch it hard, and one to three
// flames spit from the pipes, each with its own crack, never in step. And what it costs: slides wear tyres away, an
// ordinary car's in half a minute of sliding, a supercar's in over a minute, and a flat one lets go sooner.
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';

const PORTS = { super: [0.4, 0.5, -2.31], sports: [0.14, 0.42, -2.3] };
let tex = null;
function flameTex() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d');
  const g = x.createRadialGradient(118, 16, 1, 104, 16, 104);
  g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.22, 'rgba(150,190,255,0.95)'); g.addColorStop(0.4, 'rgba(255,170,60,0.85)'); g.addColorStop(0.75, 'rgba(235,70,10,0.3)'); g.addColorStop(1, 'rgba(90,10,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 32);
  return (tex = new THREE.CanvasTexture(c));
}
function rig(v, P) {
  const m = new THREE.MeshBasicMaterial({ map: flameTex(), color: 0xffffff, toneMapped: false, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  const g = new THREE.PlaneGeometry(0.62, 0.17).translate(-0.31, 0, 0), L = [];
  for (const s of [-1, 1]) for (const a of [0, Math.PI/2]) { const q = new THREE.Mesh(g, m); q.position.set(P[2], P[1], s*P[0]); q.rotation.x = a; q.visible = false; q.frustumCulled = false; v.tilt.add(q); L.push(q); }
  return { L, t: 0, q: [], on: 0, held: 0, launched: false };
}
function fire(v, F, A) {
  F.on = 0.05 + Math.random()*0.07;
  const s1 = 0.65 + Math.random()*0.8, s2 = 0.65 + Math.random()*0.8;
  F.L.forEach((q, i) => { q.visible = true; const s = i < 2 ? s1 : s2; q.scale.set(s, 0.8 + Math.random()*0.6, 1); });
  if (A && A.noiseBurst) { A.noiseBurst(0.05, 480 + Math.random()*520, 0.8, 0.14 + Math.random()*0.1); A.noiseBurst(0.018, 2300 + Math.random()*900, 1.4, 0.05); }
}
const upd = Vehicle.prototype.update;
Vehicle.prototype.update = function (dt, inp, traffic) {
  const r = upd.call(this, dt, inp, traffic), G = window.__nhAskG, S = this.spec;
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
  // ---- the flames
  const F = this._fl || (this._fl = rig(this, P)), thr = inp.throttle || 0, sp = Math.abs(this.v), rpm = this.rpm || 0;
  F.t += dt;
  if (thr > 0.7) F.held += dt;
  const lift = (this._thr0 ?? 0) > 0.7 && thr < 0.15;
  if (lift && (rpm > 0.55 || (sp < 2 && F.held < 0.5))) { let t = F.t + 0.03; for (let n = 1 + Math.floor(Math.random()*3); n > 0; n--) { F.q.push(t); t += 0.07 + Math.random()*0.12; } }
  if (thr > 0.9 && sp < 4 && !this.reverse && !F.launched && F.held > 0.12) { F.launched = true; F.q.push(F.t, F.t + 0.09 + Math.random()*0.1); }
  if (thr < 0.2) { F.launched = false; F.held = 0; }
  this._thr0 = thr;
  while (F.q.length && F.q[0] <= F.t) { F.q.shift(); fire(this, F, G?.audio); }
  if (F.on > 0 && (F.on -= dt) <= 0) for (const q of F.L) q.visible = false;
  return r;
};
