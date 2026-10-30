// Any vehicle the player can take: scooters, motorcycles, bicycles, hatchbacks, sedans, SUVs,
// taxis, tempos and the city bus. Same arcade core as the auto, tuned per class from real-world
// figures (top speed, 0–60 feel, braking, turning circle), slowed by load, footpaths and potholes.
import * as THREE from 'three';
import { bumpsAt } from '../world/groundChunk.js';
import { flyResolve, flyTrack, flyHeight } from '../world/flyover.js';
import { buildScooter, buildBike, buildCycle, buildCar, buildBus, buildTempo, buildAuto, PAINTS, wheelsOf } from './models.js';
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
  // the rare ones: Koregaon Park on a Saturday night, Baner's high street, a Bullet at every chai stop
  lux: { name: 'Luxury sedan', model: 'E-Class-style 2.0 turbo petrol', vTop: 70, acc: 6.2, brake: 9.6, drag: 0.0004, wb: 2.94, steerMax: 0.55, mu: 9.6, gears: [8, 14, 20, 27, 34, 42, 52], mass: 1800, L: 4.92, W: 1.85, honk: 'car' },
  jeep: { name: '4x4', model: 'Thar-style 2.2 diesel 4x4', vTop: 42, acc: 3.4, brake: 7.6, drag: 0.0014, wb: 2.45, steerMax: 0.6, mu: 7.9, gears: [6, 11, 17, 24, 32], mass: 1750, L: 3.98, W: 1.82, honk: 'car' },
  sports: { name: 'Sports coupé', model: '911-style 3.0 flat-six', vTop: 82, acc: 8.8, brake: 10.8, drag: 0.00026, wb: 2.45, steerMax: 0.56, mu: 10.8, gears: [10, 17, 25, 33, 42, 52, 64], mass: 1500, L: 4.52, W: 1.85, honk: 'car' },
  super: { name: 'Supercar', model: 'Huracán-style 5.2 V10', vTop: 90, acc: 10.5, brake: 11.5, drag: 0.0002, wb: 2.62, steerMax: 0.55, mu: 11.6, gears: [11, 19, 28, 38, 49, 62, 76], mass: 1420, L: 4.52, W: 1.93, honk: 'car' },
  superbike: { name: 'Superbike', model: 'ZX-10R-style 1000 cc', vTop: 83, acc: 11.5, brake: 10.5, drag: 0.00055, wb: 1.45, steerMax: 0.55, mu: 11.2, gears: [11, 19, 27, 36, 46, 58], two: true, mass: 210, L: 2.1, W: 0.75, seat: [-0.2, 0.86], honk: 'scooter', helmet: true },
  bullet: { name: 'Bullet', model: 'Classic 350-style thumper', vTop: 31, acc: 3.3, brake: 6.9, drag: 0.0026, wb: 1.39, steerMax: 0.62, mu: 8.3, gears: [6, 11, 17, 23], two: true, mass: 195, L: 2.15, W: 0.8, seat: [-0.25, 0.85], honk: 'scooter', helmet: true },
  bus: { name: 'PMPML bus', model: '12 m CNG city bus', vTop: 18.5, acc: 1.05, brake: 4.5, drag: 0.0028, wb: 5.4, steerMax: 0.58, mu: 6.0, gears: [4, 8, 12.5], mass: 11000, L: 11.4, W: 2.55, honk: 'bus' },
};
export function specOf(type) { const s = SPECS[type]; return s && s.alias ? SPECS[s.alias] : s; }

// models are built once per type (taking a vehicle used to rebuild its whole mesh on the spot)
const MODELS = new Map();
function modelFor(type) {
  if (!MODELS.has(type)) MODELS.set(type, wheelsOf(() => buildModel(type)));
  return MODELS.get(type);
}
function buildModel(type) {
  switch (type) {
    case 'scooter': case 'scooterP': return buildScooter({ parked: true });
    case 'bike': case 'bikeP': case 'bullet': case 'superbike': return buildBike({ parked: true });
    case 'cycle': return buildCycle({ parked: true });
    case 'hatch': case 'sedan': case 'suv': case 'taxi': case 'lux': case 'jeep': case 'sports': case 'super': return buildCar(type, { interior: true });
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
  if (type === 'super' || type === 'sports') return pick([[1, 0.55, 0], [0.75, 0.02, 0.02], [0.95, 0.75, 0.02], [0.02, 0.02, 0.025], [0.02, 0.35, 0.12], [0.9, 0.9, 0.9]]).map(lin);
  if (type === 'lux') return pick([[0.02, 0.02, 0.025], [0.85, 0.85, 0.85], [0.3, 0.31, 0.33], [0.05, 0.08, 0.2]]).map(lin);
  if (type === 'jeep') return pick([[0.55, 0.05, 0.03], [0.05, 0.05, 0.05], [0.85, 0.85, 0.83], [0.25, 0.3, 0.2]]).map(lin);
  if (specOf(type).two) return pick(PAINTS.two);
  return pick(PAINTS.car);
}

// a police or emergency vehicle: solid to everyone (traffic, you), not 'the player'
export function makeService(v, mass) {
  v.service = true; v.agent.isPlayer = false; v.agent.service = true;
  v.agent.T = { L: v.spec.L, W: v.spec.W, mass: mass || v.spec.mass || 1500, two: !!v.spec.two, honk: 'car' };
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
    // one GPU copy of each model, shared by every vehicle of that type (a fresh clone per vehicle
    // was a big upload, and a hitch, every time you took one)
    if (!m.shared) {
      m.shared = m.body.clone();
      m.shared.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3));
      m.shared.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array([1, 1, 1]), 3));
    }
    body.geometry = m.shared;
    body.setMatrixAt(0, new THREE.Matrix4());
    body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false;
    this.paint = paint || [0.6, 0.6, 0.6];
    body.instanceColor.setXYZ(0, this.paint[0], this.paint[1], this.paint[2]);
    this.tilt.add(body);
    this.bodyMesh = body;
    this.wheels = m.wh || [];
    if (m.glass && m.glass.attributes.position.count) {
      const g = new THREE.Mesh(m.glass, vmats.glass);
      this.tilt.add(g); this.glassMesh = g;          // (window film from the garage swaps its material)
    }
    // driver's-seat view: cars get a real interior (dashboard, turning wheel, live cluster)
    if (['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super'].includes(type)) {
      this.cockpit = buildCarCockpit(type, vmats);
      this.tilt.add(this.cockpit.group);
      this.cockpitEye = this.cockpit.eye;
    } else if (S.two) this.cockpitEye = [S.seat[0] + 0.14, S.seat[1] + 0.74, 0];
    else if (type === 'bus') this.cockpitEye = [S.L / 2 - 0.85, 2.35, 0.75];
    else if (type === 'tempo') this.cockpitEye = [1.05, 1.6, 0.32];
    // no light of its own: adding a light to the scene makes three.js recompile every shader (a
    // multi-second freeze on the spot). The player's single headlight moves to whatever you drive.
    this.headlight = null;
    scene.add(this.root);
    const n = Math.max(1, Math.round(S.L / S.W));
    this.circles = [];
    for (let k = 0; k < n; k++) this.circles.push([n === 1 ? 0 : -S.L / 2 + S.W / 2 + (S.L - S.W) * k / (n - 1), S.W / 2 + 0.04]);
    this.agent = { x: 0, z: 0, hx: 1, hz: 0, v: 0, W: S.W, L: S.L, isPlayer: true };
    this.service = false;
    this.events = [];
    this.reset(0, 0, 0);
  }
  reset(x, z, th) {
    this.deck = -1;
    Object.assign(this, { x, z, th, v: 0, vl: 0, w: 0, steer: 0, y: 0, vy: 0, pitch: 0, roll: 0, lean: 0, lift: 0, tipped: 0,
      gear: 1, rpm: 0.15, shiftT: 0, reverse: false, revT: 0, throttle: 0, brake: 0, prevH: [0, 0], onFootpath: false, load: 0 });
    this.sync();
  }
  setCockpit(on) { this.inCockpit = on; if (this.cockpit) this.cockpit.group.visible = true; }   // the cabin shows from outside too, through the glass
  get gearCount() { return this.spec.gears.length + 1; }

  heightAt(x, z) {
    const W = this.W;
    let h = W.surf.height(x, z);
    for (const b of bumpsAt(W, x, z)) {
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      const along = dx * ca + dz * sa, across = -dx * sa + dz * ca;
      if (Math.abs(across) < b.w / 2 + 0.2 && Math.abs(along) < 0.55) h = Math.max(h, 0.1 * Math.cos(along / 0.55 * Math.PI / 2) ** 2);
    }
    for (const p of W.potholeNear || []) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) h -= 0.07 * (1 - d / p.r); }
    return flyHeight(this, x, z, h);
  }

  update(dt, inp, traffic) {
    const W = this.W, S = this.spec;
    this.events.length = 0;
    if (!this._potT || (this._potT -= dt) <= 0) { this._potT = 0.5; W.potholeNear = W.potholes.filter(p => Math.abs(p.x - this.x) < 40 && Math.abs(p.z - this.z) < 40); }
    const thr = clamp(inp.throttle, 0, 1), brk = clamp(inp.brake, 0, 1);
    this.throttle = thr; this.brake = brk;
    if (!this.reverse && this.v < 0.3 && brk > 0.5 && thr < 0.1) { this.revT += dt; if (this.revT > 0.35) this.reverse = true; }
    else if (!(brk > 0.5)) this.revT = 0;
    if (this.reverse && thr > 0.1) this.reverse = false;
    // ---- longitudinal
    const v = this.v;
    let a;
    if (this.reverse) {
      // two-wheelers back up slowly, walked back with the feet
      a = (S.two ? -0.7 : -1.8) * brk;
      if (v < (S.two ? -0.9 : -3.2)) a = Math.max(a, 0);
      if (brk < 0.1) a = -v * 2;
    } else {
      const load = 1 + this.load * 0.1;
      const vTop = S.vTop * (this.powerMul ?? 1);
      const n2o = this.boost ? 1.3 : 1;                                   // nitrous (the garage): harder, and past the usual top speed
      let eng = thr * S.acc * (this.accMul || 1) * Math.min(1.1, this.powerMul ?? 1) / load * Math.max(0, 1 - Math.pow(Math.max(0, v) / (vTop * n2o), 3));
      if (this.boost && thr > 0.1) eng += 3.2;
      if (this.shiftT > 0) { this.shiftT -= dt; eng *= 0.3; }
      a = eng - brk * S.brake * (this.brakeMul || 1) * Math.sign(v || 1);
      if (v < 0) a += brk * S.brake * 2;
    }
    const foot = this.onFootpath ? (S.two ? 0.25 : 0.9) * (this.offroad ? 0.35 : 1) : 0;          // (off-road tyres: kerbs and dirt barely slow you)
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
    // grip: the tyres (the garage), and the road: wet in the rain, worse off the tarmac
    const wet = (W.wet || 0) * (this.rainTyre ? 0.3 : 1);
    const mu = (inp.handbrake ? S.mu * 0.6 : S.mu) * (this.gripMul || 1) * (1 - wet * 0.25) * (this.onFootpath && !this.offroad ? 0.85 : 1);
    const latDemand = sp * Math.abs(wT);
    let slide = 0;
    if (latDemand > mu && sp > 0.5) { const k = mu / latDemand; slide = 1 - k; wT *= lerp(1, k, 0.7); }
    // drifting: past ~25 km/h a flick of the handbrake (or, in the fast ones, a bootful of throttle in a corner)
    // breaks the back loose; it keeps sliding, the turn carries on its own, opposite lock catches it, and it
    // scrubs speed. The faster you go in, the bigger and longer the slide. Not on two wheels.
    const ease = (this.driftEase || 1) * (1 + wet * 0.8);             // drift tyres (and a wet road) let go sooner and slide longer
    const kick = !S.two && sp > 7 / ease && (inp.handbrake && Math.abs(inp.steer) > 0.2 || (thr > 0.85 && slide > 0.12 / ease && S.acc * (this.accMul || 1) > 5.5 / ease));
    const caught = Math.abs(this.vl) < 1.1 / ease || sp < 5;
    this.drift = clamp((this.drift || 0) + (kick ? dt * 3.5 : -dt * (caught ? 3 : 0.45 / ease)), 0, 1);
    const D = this.drift;
    if (D > 0) wT += Math.sign(this.w || inp.steer || 1) * D * Math.min(1.1, sp / 22) * 0.55 * (1 - Math.max(0, -Math.sign(this.w) * inp.steer) * 0.9);
    this.w += (wT - this.w) * Math.min(1, dt * (S.two ? 8 : lerp(10, 2.6, D)));
    this.th = wrapAngle(this.th + this.w * dt);
    this.vl += ((slide * 0.4 + D * 0.55) * this.v * Math.sign(this.w) - this.vl) * Math.min(1, dt * lerp(3, 0.9, D));
    if (D > 0) { this.v -= Math.sign(this.v) * Math.abs(this.vl) * 0.32 * D * dt; if (Math.abs(this.vl) > 2) this.events.push({ type: 'drift', amount: Math.abs(this.vl), sp }); }
    this.latAcc = this.v * this.w;
    // ---- integrate
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    this.x += (hx * this.v - hz * this.vl) * dt; this.z += (hz * this.v + hx * this.vl) * dt;
    flyTrack(this);
    this.collideStatic();
    if (traffic && !(this.deck >= 0 && this.y > 2.2)) this.collideTraffic(traffic);
    // ---- suspension
    const half = S.wb / 2;
    const hF = this.heightAt(this.x + hx * half, this.z + hz * half), hR = this.heightAt(this.x - hx * half, this.z - hz * half);
    const jolt = Math.max(Math.abs(hF - this.prevH[0]), Math.abs(hR - this.prevH[1]));
    if (jolt > 0.05 && sp > 2.5) { const soft = this.soft ?? 1; this.vy += jolt * sp * (S.two ? 0.7 : 0.45) * soft; this.events.push({ type: 'bump', strength: jolt * sp * soft }); }   // (soft: lifted suspension from the garage)
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
      const res = flyResolve(this, cx, cz, r);
      if (!res) continue;
      this.x += res.nx * res.depth; this.z += res.nz * res.depth;
      const vx = hx * this.v - hz * this.vl, vz = hz * this.v + hx * this.vl;
      const vn = vx * res.nx + vz * res.nz;
      if (vn < 0) {
        const hard = Math.min(1, Math.max(0, (-vn - 3) / 9));           // a crunch, not a bounce
        const nvx = vx - res.nx * vn, nvz = vz - res.nz * vn;
        this.v = (nvx * hx + nvz * hz) * (1 - hard * 0.6); this.vl = (-nvx * hz + nvz * hx) * 0.4;
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
      // (a police or emergency vehicle bumps into you too, and you into it: they're solid both ways)
      if ((o.isPlayer && !this.service) || o === this.agent || o.T === undefined && !o.parked) return;
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
              // every vehicle can be wrecked, but only by you (the police nudging through traffic used to set half the city smoking)
              if (this.W.playerVeh === this) knock(o, imp, T.two ? 0.016 : 0.012);
              if (T.two && imp > 3.0 && !o.fallen) { o.fallen = 3.5; this.events.push({ type: 'knock', who: 'two', speed: imp, x: o.x, z: o.z }); }
              else if (imp > 1.5) this.events.push({ type: 'hit', who: o.type, speed: imp, x: o.x, z: o.z, o });
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
    this.tilt.position.set(0, this.y + idle - (this.lower || 0), 0);
    this.tilt.rotation.set(this.lean, 0, this.pitch, 'YXZ');
    if (this.inCockpit && this.cockpit) this.cockpit.update(this.steer, Math.abs(this.v) * 3.6, this.gear, this.rpm);
  }
  // borrow the one shared headlight (see Pilot.switchTo)
  takeHeadlight(light) {
    const S = this.spec;
    if (light.userData.base == null) light.userData.base = light.color.getHex();
    light.color.setHex(this.lightCol || light.userData.base);          // xenon from the garage
    light.position.set(S.L / 2 - 0.1, 0.8, 0);
    light.target.position.set(S.L / 2 + 12, 0, 0);
    this.tilt.add(light, light.target);
    this.headlight = light;
  }
  dispose() {
    this.root.parent?.remove(this.root);
    this.bodyMesh.dispose();                   // the model geometry is shared; only the instance goes
    if (this.bodyMesh.userData.ownGeo) this.bodyMesh.geometry.dispose();     // (a resprayed auto has its own copy)
    if (this.cockpit) this.cockpit.group.traverse(o => { if (o.material && o.material.map && o.material.map.isCanvasTexture) o.material.map.dispose(); });
  }
}

// one knock to a vehicle: counted once per impact (not every frame the two are touching), nothing for a bump
// under ~15 km/h, and never more than a fifth of it in one go: they're sturdy. k: how much a hit costs
export function knock(v, imp, k) {
  const now = performance.now() / 1000;
  if (imp < 4 || (v._kT || 0) > now) return;
  v._kT = now + 0.7;
  v.dmg = Math.min(1, (v.dmg || 0) + Math.min(0.2, (imp - 4) * k * (v.armorMul ?? 1)));
}
