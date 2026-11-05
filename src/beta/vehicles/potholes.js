// What a pothole does to what drives through it. It was a 7 cm cone under every wheel alike. Now each wheel drops by
// what the hole is (beta/world/potholes.js: its own outline and depth) and what the wheel is: a scooter's little wheel
// goes right down into it and slams the far edge, a bus's big one rolls over half of it. And each kind takes it its own
// way: a two-wheeler's bars kick and it loses speed (a cycle most), an auto's single front wheel drops in and the nose
// dives, a car thumps and a hard enough hit at speed can do a tyre (two of those and it's flat, beta/vehicles/
// damage.js), a bus or a tempo sways and hardly slows. An auto runs on three wheels here: one in front.
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { clamp } from '@orig/core/util.js';
import { baseOf } from './models.js';
import { potWhere, potShape } from '../world/potholes.js';

const WHEEL = { scooter: 0.22, bike: 0.3, cycle: 0.34, auto: 0.2, tempo: 0.3, bus: 0.5, suv: 0.36, jeep: 0.38 };
const V = Vehicle.prototype;
V.potDip = function (x, z) {
  const L = this.W.potholeNear; if (!L || !L.length) return 0;
  const R = this._wR ?? (this._wR = WHEEL[baseOf(this.type)] ?? 0.31);
  let dip = 0;
  for (const p of L) {
    const w = potWhere(p, x, z); if (!w) continue;
    const s = potShape(p), e = w[1], max = Math.min(s.dep, R - Math.sqrt(Math.max(0, R*R - e*e)));
    const t = clamp(w[0]/(R*0.6 + 0.03), 0, 1);
    dip = Math.max(dip, max*t*t*(3 - 2*t));
  }
  return dip;
};
// the wheels on the ground (as beta/vehicles/physics.js has them), and what each one meets
const ground = V.ground;
V.ground = function (hx, hz, sp) {
  const S = this.spec, base = baseOf(this.type), auto = base === 'auto';
  if (!auto && !(this.W.potholeNear && this.W.potholeNear.length)) { this._inPot = null; return ground.call(this, hx, hz, sp); }
  const half = S.wb/2, tw = S.two ? 0 : S.W*0.41, px = -hz, pz = hx, W = this.W;
  const pts = S.two ? [[half, 0], [-half, 0]] : [[half, auto ? 0 : tw], [half, auto ? 0 : -tw], [-half, tw], [-half, -tw]];
  const h = [], prev = this._wh, was = this._inPot || [], now = []; let off = 0;
  for (const [u, s] of pts) {
    const x = this.x + hx*u + px*s, z = this.z + hz*u + pz*s;
    h.push(this.heightAt(x, z) - (this.sag ? this.sag[h.length] || 0 : 0)); if (!W.surf.isRoad(x, z)) off++;
    let hit = null; for (const p of W.potholeNear || []) if (potWhere(p, x, z)) { hit = p; break; }
    now.push(hit);
  }
  this._inPot = now;
  // a wheel just gone in: the knock, by how deep and how fast
  for (let i = 0; i < now.length; i++) {
    const p = now[i]; if (!p || p === was[i] || sp < 2) continue;
    if (auto && i === 1) continue;                                   // (the same one front wheel)
    const s = potShape(p), k = clamp(s.dep/0.08, 0.3, 1.4)*Math.min(1.4, sp/11), front = i < (S.two ? 1 : 2), sg = Math.random() < 0.5 ? -1 : 1;
    if (S.two) {
      this.v *= 1 - (base === 'cycle' ? 0.1 : base === 'scooter' ? 0.07 : 0.05)*k*(front ? 1 : 0.5);
      if (front) this.th += sg*0.025*k;                                   // the bars kick
      this.vy -= 0.5*k;
    } else if (auto) {
      this.v *= 1 - 0.05*k*(front ? 1 : 0.6); this.vy -= 0.7*k*(front ? 1 : 0.5);
      if (front) this.th += sg*0.012*k;
    } else if (base === 'bus' || base === 'tempo') {
      this.v *= 1 - 0.012*k; this.vy -= 0.25*k;
    } else {
      this.v *= 1 - 0.025*k*(front ? 1 : 0.6); this.vy -= 0.45*k;
      if (front) this.th += sg*0.006*k;
    }
    // hard enough, fast enough: the tyre takes it (two like that and it's gone)
    if (sp > 13 && s.dep > 0.06 && this.hurtTyre && this.wheels) {
      const [u, sd] = pts[i], w = this.wheels.find(q => Math.sign(q.x) === Math.sign(u) && (S.two || auto && front || Math.sign(q.z) === Math.sign(sd)));
      if (w) this.hurtTyre(w, 0.3*k*(S.two ? 1.2 : 1));
    }
    this.events.push({ type: 'bump', strength: k*sp*0.25 });
  }
  let jolt = 0, climb = 0;
  const lead = this.v >= 0 ? (S.two ? [0] : [0, 1]) : (S.two ? [1] : [2, 3]);
  if (prev && prev.length === h.length) for (let i = 0; i < h.length; i++) { const d = h[i] - prev[i]; jolt = Math.max(jolt, Math.abs(d)*(S.two ? 1 : 0.8)); if (lead.includes(i) && d > 0.07) climb = Math.max(climb, d); }
  this._wh = h;
  if (climb && sp > 1.2) this.v *= 1 - Math.min(0.3, climb*(S.two ? 0.9 : 1.6)*Math.min(1, sp/8));
  const f = S.two ? h[0] : (h[0] + h[1])/2, r = S.two ? h[1] : (h[2] + h[3])/2;
  const roll = S.two ? 0 : -Math.atan2((h[2] - h[3])/2 + (auto ? 0 : (h[0] - h[1])/2), tw*2)*0.9;
  return { f, r, jolt, off: off/pts.length, roll };
};
