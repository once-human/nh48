// Any vehicle the player can take: scooters, motorcycles, bicycles, hatchbacks, sedans, SUVs,
// taxis, tempos and the city bus. Same arcade core as the auto, tuned per class from real-world
// figures (top speed, 0–60 feel, braking, turning circle), slowed by load, footpaths and potholes.
import * as THREE from 'three';
import { buildScooter, buildBike, buildCycle, buildCar, buildBus, buildTempo, buildAuto, PAINTS } from './models.js';
import { buildCarCockpit } from './cockpit.js';
import { clamp, lerp, wrapAngle } from '../core/util.js';
import { lin } from '../world/geo.js';

// vTop m/s (flat out), acc m/s² at standstill, brake m/s², drag coefficient (per v²), wheelbase,
// max steer (rad), grip (m/s² lateral), gears: upshift speeds (empty = CVT/electric)
export const SPECS = {
  scooter: { name: 'Scooter', model: 'Activa-style 110 cc', vTop: 24.5, acc: 2.5, brake: 6.8, drag: 0.0029, wb: 1.28, steerMax: 0.7, mu: 7.8, gears: [], two: true, mass: 190, L: 1.85, W: 0.75, seat: [-0.3, 0.8], honk: 'scooter', helmet: true },
  scooterP: { alias: 'scooter' },
  bike: { name: 'Motorcycle', model: 'commuter 125 cc', vTop: 28.5, acc: 3.1, brake: 7.2, drag: 0.0026, wb: 1.3, steerMax: 0.65, mu: 8.2, gears: [5.5, 10, 15, 20], two: true, mass: 200, L: 2.0, W: 0.78, seat: [-0.28, 0.95], honk: 'scooter', helmet: true },
  bikeP: { alias: 'bike' },
  cycle: { name: 'Bicycle', model: 'Hero-style roadster', vTop: 7.5, acc: 1.1, brake: 4.2, drag: 0.012, wb: 1.0, steerMax: 0.75, mu: 6.5, gears: [], two: true, mass: 90, L: 1.75, W: 0.6, seat: [-0.25, 0.95], honk: 'bell' },
  hatch: { name: 'Hatchback', model: 'Swift-style 1.2 petrol', vTop: 44, acc: 3.4, brake: 8.0, drag: 0.0011, wb: 2.45, steerMax: 0.58, mu: 8.6, gears: [6.5, 12, 18, 25], mass: 950, L: 3.65, W: 1.6, honk: 'car' },
  sedan: { name: 'Sedan', model: 'compact sedan, 1.2 petrol', vTop: 46, acc: 3.2, brake: 8.0, drag: 0.001, wb: 2.56, steerMax: 0.56, mu: 8.6, gears: [6.5, 12, 18, 25], mass: 1100, L: 4.0, W: 1.7, honk: 'car' },
  taxi: { name: 'Taxi', model: 'compact sedan, CNG', vTop: 40, acc: 2.6, brake: 7.5, drag: 0.0012, wb: 2.56, steerMax: 0.56, mu: 8.4, gears: [6.5, 12, 18, 25], mass: 1150, L: 4.0, W: 1.7, honk: 'car' },
  suv: { name: 'SUV', model: 'Creta-style 1.5 diesel', vTop: 48, acc: 3.3, brake: 8.2, drag: 0.0012, wb: 2.6, steerMax: 0.55, mu: 8.4, gears: [6.5, 12, 18, 25, 32], mass: 1600, L: 4.5, W: 1.8, honk: 'car' },
  auto: { name: 'Auto rickshaw', model: 'Bajaj RE-style 4-stroke', vTop: 18.6, acc: 2.35, brake: 6.2, drag: 0.0025, wb: 2.0, steerMax: 0.62, mu: 6.8, gears: [4.8, 9.4, 13.8], mass: 520, L: 2.7, W: 1.4, honk: 'auto' },
  tempo: { name: 'Tempo', model: 'Ace-style mini truck', vTop: 21, acc: 1.7, brake: 6.0, drag: 0.0022, wb: 2.1, steerMax: 0.6, mu: 7.0, gears: [5, 9.5, 14.5], mass: 1400, L: 3.8, W: 1.55, honk: 'tempo' },
  bus: { name: 'PMPML bus', model: '12 m CNG city bus', vTop: 18.5, acc: 1.05, brake: 4.5, drag: 0.0028, wb: 5.4, steerMax: 0.58, mu: 6.0, gears: [4, 8, 12.5], mass: 11000, L: 11.4, W: 2.55, honk: 'bus' },
};
export function specOf(type) { const s = SPECS[type]; return s && s.alias ? SPECS[s.alias] : s; }

function modelFor(type) {
  switch (type) {
    case 'scooter': case 'scooterP': return buildScooter({ parked: true });
    case 'bike': case 'bikeP': return buildBike({ parked: true });
    case 'cycle': return buildCycle();
    case 'hatch': case 'sedan': case 'suv': case 'taxi': return buildCar(type, { interior: true });
    case 'tempo': return buildTempo();
    case 'auto': return buildAuto({ withWheels: true });
    case 'bus': return buildBus();
    default: return buildCar('hatch');
  }
}
export function defaultPaint(type, rng) {
  const pick = (a) => a[Math.floor(rng.next() * a.length)].map(lin);
  if (type === 'taxi') return [lin(0.96), lin(0.96), lin(0.95)];
  if (type === 'bus') return [1, 1, 1];
  if (type === 'auto') return [lin(0.12), lin(0.12), lin(0.12)];
  if (type === 'tempo') return pick(PAINTS.tempo);
  if (specOf(type).two) return pick(PAINTS.two);
  return pick(PAINTS.car);
}

export class Vehicle {
  constructor(W, scene, vmats, type, paint) {
    this.W = W; this.type = type; this.spec = specOf(type);
    this.kind = this.spec.two ? 'two' : type === 'bus' ? 'bus' : 'car';
    const S = this.spec;
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();
    this.root.add(this.tilt);
    const m = modelFor(type);
    // single-instance InstancedMesh so the shared paintable vehicle material works unchanged
    const body = new THREE.InstancedMesh(m.body, vmats.body, 1);
    body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
    body.geometry = body.geometry.clone();
    body.geometry.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3));
    body.geometry.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3));
    body.setMatrixAt(0, new THREE.Matrix4());
    body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false;
    this.paint = paint || [0.6, 0.6, 0.6];
    body.instanceColor.setXYZ(0, this.paint[0], this.paint[1], this.paint[2]);
    this.tilt.add(body);
    this.bodyMesh = body;
    if (m.glass && m.glass.attributes.position.count) {
      const g = new THREE.Mesh(m.glass, vmats.glass);
      this.tilt.add(g);
    }
    // driver's-seat view: cars get a real interior (dashboard, turning wheel, live cluster)
    if (['hatch', 'sedan', 'suv', 'taxi'].includes(type)) {
      this.cockpit = buildCarCockpit(type, vmats);
      this.tilt.add(this.cockpit.group);
      this.cockpitEye = this.cockpit.eye;
    } else if (S.two) this.cockpitEye = [S.seat[0] + 0.14, S.seat[1] + 0.74, 0];
    else if (type === 'bus') this.cockpitEye = [S.L / 2 - 0.85, 2.35, 0.75];
    else if (type === 'tempo') this.cockpitEye = [1.05, 1.6, 0.32];
    this.headlight = new THREE.SpotLight(0xfff1d0, 0, 55, 0.5, 0.5, 1.3);
    this.headlight.position.set(S.L / 2 - 0.1, 0.8, 0);
    this.headlight.target.position.set(S.L / 2 + 12, 0, 0);
    this.tilt.add(this.headlight, this.headlight.target);
    scene.add(this.root);
    const n = Math.max(1, Math.round(S.L / S.W));
    this.circles = [];
    for (let k = 0; k < n; k++) this.circles.push([n === 1 ? 0 : -S.L / 2 + S.W / 2 + (S.L - S.W) * k / (n - 1), S.W / 2 + 0.04]);
    this.agent = { x: 0, z: 0, hx: 1, hz: 0, v: 0, W: S.W, L: S.L, isPlayer: true };
    this.events = [];
    this.reset(0, 0, 0);
  }
  reset(x, z, th) {
    Object.assign(this, { x, z, th, v: 0, vl: 0, w: 0, steer: 0, y: 0, vy: 0, pitch: 0, roll: 0, lean: 0, lift: 0, tipped: 0,
      gear: 1, rpm: 0.15, shiftT: 0, reverse: false, revT: 0, throttle: 0, brake: 0, prevH: [0, 0], onFootpath: false, load: 0 });
    this.sync();
  }
  setCockpit(on) { this.inCockpit = on; if (this.cockpit) this.cockpit.group.visible = on; }
  get gearCount() { return this.spec.gears.length + 1; }

  heightAt(x, z) {
    const W = this.W;
    let h = W.surf.height(x, z);
    for (const b of W.bumps) {
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      const along = dx * ca + dz * sa, across = -dx * sa + dz * ca;
      if (Math.abs(across) < b.w / 2 + 0.2 && Math.abs(along) < 0.55) h = Math.max(h, 0.1 * Math.cos(along / 0.55 * Math.PI / 2) ** 2);
    }
    for (const p of W.potholeNear || []) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) h -= 0.07 * (1 - d / p.r); }
    return h;
  }

  update(dt, inp, traffic) {
    const W = this.W, S = this.spec;
    this.events.length = 0;
    if (!this._potT || (this._potT -= dt) <= 0) { this._potT = 0.5; W.potholeNear = W.potholes.filter(p => Math.abs(p.x - this.x) < 40 && Math.abs(p.z - this.z) < 40); }
    const thr = clamp(inp.throttle, 0, 1), brk = clamp(inp.brake, 0, 1);
    this.throttle = thr; this.brake = brk;
    if (!this.reverse && this.v < 0.3 && brk > 0.5 && thr < 0.1) { this.revT += dt; if (this.revT > 0.35 && !S.two) this.reverse = true; }
    else if (!(brk > 0.5)) this.revT = 0;
    if (this.reverse && thr > 0.1) this.reverse = false;
    // ---- longitudinal
    const v = this.v;
    let a;
    if (this.reverse) {
      a = -1.8 * brk;
      if (v < -3.2) a = Math.max(a, 0);
      if (brk < 0.1) a = -v * 2;
    } else {
      const load = 1 + this.load * 0.1;
      let eng = thr * S.acc / load * Math.max(0, 1 - Math.pow(Math.max(0, v) / S.vTop, 3));
      if (this.shiftT > 0) { this.shiftT -= dt; eng *= 0.3; }
      a = eng - brk * S.brake * Math.sign(v || 1);
      if (v < 0) a += brk * S.brake * 2;
    }
    const foot = this.onFootpath ? (S.two ? 0.25 : 0.9) : 0;
    a -= Math.sign(v) * (0.12 + S.drag * v * v + foot);
    if (inp.handbrake) a -= Math.sign(v) * (S.two ? 3.5 : 4.5);
    this.v = v + a * dt;
    if (Math.abs(this.v) < 0.05 && thr < 0.05 && !this.reverse) this.v = 0;
    // gears (sound, shift dips, HUD)
    const G = S.gears;
    let g = 1;
    for (let k = 0; k < G.length; k++) if (this.v > G[k]) g = k + 2;
    if (g > this.gear && G.length) this.shiftT = 0.18;
    this.gear = g;
    const lo = g > 1 ? G[g - 2] : 0, hi = g <= G.length ? G[g - 1] : S.vTop;
    const t = clamp((Math.max(0, this.v) - lo) / Math.max(0.5, hi - lo), 0, 1);
    const targetRpm = this.reverse ? 0.4 + Math.abs(this.v) / 4 : G.length ? lerp(0.22, 1.0, t) * (0.78 + thr * 0.22) + thr * 0.08 : 0.2 + Math.min(1, this.v / S.vTop) * 0.7 + thr * 0.12;
    this.rpm += (Math.min(1.1, targetRpm) - this.rpm) * Math.min(1, dt * 7);
    // ---- steering (bicycle model, less lock at speed)
    const sp = Math.abs(this.v);
    const maxSteer = S.steerMax / (1 + sp * sp / (S.two ? 90 : 55));
    const target = clamp(inp.steer, -1, 1) * maxSteer;
    const rate = Math.abs(target) < Math.abs(this.steer) ? 3.4 : 2.4;
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    let wT = this.v * Math.tan(this.steer) / S.wb;
    if (inp.handbrake && sp > 4 && !S.two) wT *= 1.4;
    const mu = inp.handbrake ? S.mu * 0.6 : S.mu;
    const latDemand = sp * Math.abs(wT);
    let slide = 0;
    if (latDemand > mu && sp > 0.5) { const k = mu / latDemand; slide = 1 - k; wT *= lerp(1, k, 0.7); }
    this.w += (wT - this.w) * Math.min(1, dt * (S.two ? 8 : 10));
    this.th = wrapAngle(this.th + this.w * dt);
    this.vl += (slide * this.v * Math.sign(this.w) * 0.4 - this.vl) * Math.min(1, dt * 3);
    this.latAcc = this.v * this.w;
    // ---- integrate
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    this.x += (hx * this.v - hz * this.vl) * dt; this.z += (hz * this.v + hx * this.vl) * dt;
    this.collideStatic();
    if (traffic) this.collideTraffic(traffic);
    // ---- suspension
    const half = S.wb / 2;
    const hF = this.heightAt(this.x + hx * half, this.z + hz * half), hR = this.heightAt(this.x - hx * half, this.z - hz * half);
    const jolt = Math.max(Math.abs(hF - this.prevH[0]), Math.abs(hR - this.prevH[1]));
    if (jolt > 0.05 && sp > 2.5) { this.vy += jolt * sp * (S.two ? 0.7 : 0.45); this.events.push({ type: 'bump', strength: jolt * sp }); }
    this.prevH = [hF, hR];
    this.onFootpath = !W.surf.isRoad(this.x, this.z);
    this.vy += (((hF + hR) / 2 - this.y) * 160 - this.vy * 14) * dt;
    this.y += this.vy * dt;
    this.pitch += (Math.atan2(hF - hR, S.wb) - clamp(a * 0.006, -0.025, 0.025) - this.pitch) * Math.min(1, dt * 12);
    // two-wheelers lean into turns; cars roll a little outwards
    const leanT = S.two ? clamp(Math.atan(this.latAcc / 9.81), -0.6, 0.6) : -clamp(this.latAcc * 0.01, -0.06, 0.06);
    this.lean += (leanT - this.lean) * Math.min(1, dt * 6);
    this.sync(dt);
  }

  collideStatic() {
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    for (let it = 0; it < 2; it++) for (const [o, r] of this.circles) {
      const cx = this.x + hx * o, cz = this.z + hz * o;
      const res = this.W.collision.resolve(cx, cz, r);
      if (!res) continue;
      this.x += res.nx * res.depth; this.z += res.nz * res.depth;
      const vx = hx * this.v - hz * this.vl, vz = hz * this.v + hx * this.vl;
      const vn = vx * res.nx + vz * res.nz;
      if (vn < 0) {
        const nvx = vx - res.nx * vn * 1.15, nvz = vz - res.nz * vn * 1.15;
        this.v = nvx * hx + nvz * hz; this.vl = (-nvx * hz + nvz * hx) * 0.5;
        if (-vn > 2.2) this.events.push({ type: 'crash', speed: -vn, kind: res.kind, x: cx, z: cz });
        else if (-vn > 0.6) this.events.push({ type: 'scrape', speed: -vn, kind: res.kind });
      }
    }
  }
  collideTraffic(traffic) {
    const S = this.spec;
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    const mine = this.circles.map(([o, r]) => [this.x + hx * o, this.z + hz * o, r]);
    traffic.near(this.x, this.z, S.L / 2 + 8, (o) => {
      if (o.isPlayer || o === this.agent || o.T === undefined && !o.parked) return;
      const T = o.T || { L: o.L, W: o.W, mass: 1000, two: false };
      const n = Math.max(1, Math.round(T.L / T.W));
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? 0 : -T.L / 2 + T.W / 2 + (T.L - T.W) * k / (n - 1);
        const ox = o.x + o.hx * off, oz = o.z + o.hz * off, orr = T.W / 2 + 0.05;
        for (const [mx, mz, mr] of mine) {
          const dx = mx - ox, dz = mz - oz, d = Math.hypot(dx, dz), rr = mr + orr;
          if (d >= rr || d < 1e-4) continue;
          const nx = dx / d, nz = dz / d, depth = rr - d;
          const share = o.parked ? 1 : T.mass / (S.mass + T.mass);
          this.x += nx * depth * share; this.z += nz * depth * share;
          const vx = hx * this.v, vz = hz * this.v;
          const ovx = o.hx * (o.v || 0), ovz = o.hz * (o.v || 0);
          const rel = (vx - ovx) * nx + (vz - ovz) * nz;
          if (rel < 0) {
            const imp = -rel;
            const dv = imp * share * 1.1;
            const nvx = vx + nx * dv, nvz = vz + nz * dv;
            this.v = nvx * hx + nvz * hz;
            if (!o.parked) {
              o.v = Math.max(0, o.v - imp * (1 - share) * 0.8);
              o.angry = 6;
              if (T.two && imp > 3.0 && !o.fallen) { o.fallen = 3.5; this.events.push({ type: 'knock', who: 'two', speed: imp, x: o.x, z: o.z }); }
              else if (imp > 1.5) this.events.push({ type: 'hit', who: o.type, speed: imp, x: o.x, z: o.z });
              if (!(o.honkT > 0)) { o.honkT = 2.5; traffic.honks.push({ x: o.x, z: o.z, kind: T.honk, n: 2 }); }   // once per bump, not every frame of contact
            } else if (imp > 2.2) this.events.push({ type: 'crash', speed: imp, kind: 2, x: o.x, z: o.z });
          }
          return;
        }
      }
    });
  }

  sync(dt = 0) {
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    Object.assign(this.agent, { x: this.x, z: this.z, hx, hz, v: Math.abs(this.v) });
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.set(0, -this.th, 0);
    const idle = this.v === 0 ? Math.sin(performance.now() / 1000 * (this.spec.two ? 70 : 40)) * 0.0015 : 0;
    this.tilt.position.set(0, this.y + idle, 0);
    this.tilt.rotation.set(this.lean, 0, this.pitch, 'YXZ');
    if (this.inCockpit && this.cockpit) this.cockpit.update(this.steer, Math.abs(this.v) * 3.6, this.gear, this.rpm);
  }
  dispose() {
    this.root.parent?.remove(this.root);
    this.bodyMesh.geometry.dispose();
  }
}
