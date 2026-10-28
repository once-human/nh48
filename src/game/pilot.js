// The player: on foot or driving. Walk, jog or sprint around the city, take your own auto, any
// parked scooter/bike/car, or pull a driver out of their vehicle (they won't be happy). The rest
// of the game talks to this object as "the player", it forwards to whatever you're driving.
import * as THREE from 'three';
import { Vehicle, specOf } from '../vehicles/vehicle.js';
import { flyResolve } from '../world/flyover.js';
import { clamp, damp, dampAngle, wrapAngle, RNG } from '../core/util.js';
import { lookOf, savedCharacter } from '../people/characters.js';
import { ikArm } from '../people/humans.js';
// handlebar grips in each vehicle's own frame: [forward, up, half width]
const GRIPS = { auto: [0.72, 1.07, 0.33], scooter: [0.62, 1.0, 0.3], bike: [0.6, 1.08, 0.34], cycle: [0.44, 1.0, 0.28] };
const _grip = new THREE.Vector3(), _pole = new THREE.Vector3();
import { WATER_Y } from '../world/groundChunk.js';
const SWIM_Y = WATER_Y - 1.0;      // holder height while swimming: head and shoulders above the water

const WALK = 1.55, JOG = 3.4, SPRINT = 6.2;
// where you sit (vehicle-local: x forward, y up, z to the right; Indian cars are right-hand drive)
const SEATS = { auto: [0.36, 0.8, 0], hatch: [-0.2, 0.57, 0.36], sedan: [-0.55, 0.56, 0.36], taxi: [-0.55, 0.56, 0.36], suv: [-0.3, 0.7, 0.38], tempo: [0.75, 0.95, 0.32] };
function seatFor(veh, S, isAuto) {
  if (S.two) return [S.seat ? S.seat[0] : -0.3, S.seat ? S.seat[1] : 0.8, 0];
  if (isAuto) return SEATS.auto;
  if (veh.type === 'bus') return [S.L / 2 - 1.2, 1.25, 0.75];
  return SEATS[veh.type] || null;
}
const SHOUTS = [
  ['Arre, gaadi kyon cheen rahe ho?!', 'Hey, why are you taking my vehicle?!'],
  ['Thamba! Maazi gaadi aahe ti!', 'Stop! That’s my vehicle!'],
  ['Police la bolavto aata!', 'I’m calling the police!'],
  ['Kay chalu aahe he?!', 'What is going on?!'],
  ['Abey, utar neeche!', 'Hey, get down from there!'],
];

export class Pilot {
  constructor({ W, scene, vmats, kit, auto, hud, audio }) {
    this.W = W; this.scene = scene; this.vmats = vmats; this.kit = kit;
    this.auto = auto; this.hud = hud; this.audio = audio;
    this.rng = new RNG(99);
    this.mode = 'auto';
    this.cur = auto;
    this.dropped = [];             // vehicles you left on the street (incl. your auto when on foot)
    this.npcs = [];                // drivers you pulled out, storming off
    this.events = [];
    this.foot = { x: 0, z: 0, y: 0, yaw: 0, v: 0, vx: 0, vz: 0, anim: 'idle', agent: { x: 0, z: 0, hx: 1, hz: 0, v: 0, W: 0.6, L: 0.6, isPlayer: true } };
    this.offer = null; this.offerT = 0; this.busy = 0;
    this.hp = 100; this.hurtT = 99; this.act = null; this.ko = false;
    if (kit) {
      const sv = savedCharacter();
      this.setLook(lookOf(sv));
    }
    this.parkGrid = null;
  }
  // ---------------------------------------------------------------- facade
  get onFoot() { return this.mode === 'foot'; }
  get x() { return this.onFoot ? this.foot.x : this.cur.x; }
  get z() { return this.onFoot ? this.foot.z : this.cur.z; }
  get y() { return this.onFoot ? this.foot.y : this.cur.y || 0; }
  get th() { return this.onFoot ? this.foot.yaw : this.cur.th; }
  get v() { return this.onFoot ? this.foot.v : this.cur.v; }
  get rpm() { return this.onFoot ? 0 : this.cur.rpm; }
  get gear() { return this.onFoot ? 0 : this.cur.gear; }
  get throttle() { return this.onFoot ? 0 : this.cur.throttle; }
  get reverse() { return this.onFoot ? false : this.cur.reverse; }
  get lift() { return this.onFoot ? 0 : this.cur.lift || 0; }
  get tipped() { return this.onFoot ? 0 : this.cur.tipped || 0; }
  get onFootpath() { return this.onFoot ? true : this.cur.onFootpath; }
  get root() { return this.onFoot ? this.human.holder : this.cur.root; }
  get tilt() { return this.cur.tilt; }
  get headlight() { return this.cur.headlight; }
  get agent() { return this.onFoot ? this.foot.agent : this.cur.agent; }
  get spec() { return this.onFoot ? null : this.cur === this.auto ? specOf('auto') : this.cur.spec; }
  get inAuto() { return this.cur === this.auto && !this.onFoot; }
  // your own auto or anyone else's: the shift runs in whichever auto you're driving
  get inAnyAuto() { return !this.onFoot && (this.cur === this.auto || (this.cur && this.cur.type === 'auto')); }
  get cockpitEye() { return this.onFoot ? null : this.cur.cockpitEye || null; }
  get camDist() { const s = this.spec; return s ? Math.max(0, s.L - 2.7) * 0.75 : -2; }
  setCockpit(on) {
    if (this.onFoot) return;
    if (this.cur.setCockpit) this.cur.setCockpit(on);
    this.cockpitOn = on;
    // you are the one at the wheel: the vehicle's stand-in driver never shows, and your own body hides
    // only in the driver's-seat view (its head would sit on the camera)
    if (this.human) {
      if (this.cur === this.auto) this.auto.driver.visible = false;
      this.human.holder.visible = !!this.riderShown && !on;
    }
  }
  setPassengers(n, s) { const v = this.onFoot ? this.auto : this.cur; if (v && v.setPassengers) v.setPassengers(n, s); else this.auto.setPassengers(0); }
  reset(x, z, th) {
    if (this.mode !== 'auto') this.switchTo(this.auto);
    this.auto.reset(x, z, th);
  }
  vehicleLabel() {
    if (this.onFoot) return 'On foot';
    const s = this.spec;
    return `${s.model} · ${s.name}`;
  }

  // ---------------------------------------------------------------- per tick
  update(dt, inp, traffic, input, camYaw) {
    this.events.length = 0;
    this.busy = Math.max(0, this.busy - dt);
    if (this.onFoot) this.updateFoot(dt, input, traffic, camYaw);
    else {
      this.cur.update(dt, inp, traffic);
      for (const e of this.cur.events) this.events.push(e);
      if (this.riderShown) { this.placeRider(); if (this.human && !this.cockpitOn && !this.human.holder.visible) this.human.holder.visible = true; }
      else if (this.human) this.human.holder.visible = false;     // never left standing on the road
    }
    if (this.onFoot && this.human && !this.human.holder.visible) this.human.holder.visible = true;
    // vehicles left behind settle and stay solid
    for (const d of this.dropped) if (d.veh !== this.cur && d.veh.sync) d.veh.sync(0);
    this.updateNpcs(dt);
    // what can I get into?
    this.offerT -= dt;
    if (this.offerT <= 0) { this.offerT = 0.15; this.offer = this.findOffer(traffic); }
    if (input.took('KeyF') && this.busy <= 0) {
      // a vehicle right next to you wins; otherwise the shop / pump / home you're at
      if (!(this.onFoot && this.offer) && this.useHook && this.useHook()) { /* walked in */ }
      else if (this.onFoot && this.offer) this.enter(this.offer, traffic);
      else if (!this.onFoot) this.exit(traffic);
    }
  }

  updateFoot(dt, input, traffic, camYaw) {
    const F = this.foot, k = (...c) => input.key(...c);
    let fw = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
    let sd = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
    const len = Math.hypot(fw, sd) || 1;
    fw /= len; sd /= len;
    const run = k('ShiftLeft', 'ShiftRight');
    const target = (fw || sd) ? (F.swim ? (run ? 2.1 : 1.35) : run ? SPRINT * (this.sprintMul ? this.sprintMul() : 1) : k('AltLeft') ? WALK : JOG) : 0;
    const cy = camYaw ?? F.yaw;
    let dx = Math.cos(cy) * fw - Math.sin(cy) * sd, dz = Math.sin(cy) * fw + Math.cos(cy) * sd;
    // drunk: you can't quite walk straight
    const dk = this.drunk ? this.drunk() : 0;
    if (dk > 0.45 && (fw || sd)) { this._stag = (this._stag || 0) + dt; const w = Math.sin(this._stag * 1.7) * Math.sin(this._stag * 0.61) * (dk - 0.45) * 1.6; const c = Math.cos(w), s0 = Math.sin(w); const nx = dx * c - dz * s0; dz = dx * s0 + dz * c; dx = nx; }
    // throwing a punch, flinching or lying on the road: you don't walk (a roll carries you)
    const A = this.act, held = this.ko || this.downT > 0 || this.seated || (A && A.kind !== 'roll');
    const tvx = held ? 0 : dx * target, tvz = held ? 0 : dz * target;
    const acc = target > F.v ? 10 : 14;
    if (A && A.kind === 'roll') { F.vx = A.vx; F.vz = A.vz; }
    else { F.vx = damp(F.vx, tvx, held ? 20 : acc, dt); F.vz = damp(F.vz, tvz, held ? 20 : acc, dt); }
    F.v = Math.hypot(F.vx, F.vz);
    if (F.v > 0.2 && !A) F.yaw = dampAngle(F.yaw, Math.atan2(F.vz, F.vx), 10, dt);
    // jump (Space) or, facing a compound wall, climb over it
    const FLY = this.W.fly;
    const groundY = () => (F.deck >= 0 && FLY ? FLY.heightOn(F.deck, F.x, F.z) : this.W.surf.height(F.x, F.z));
    if (F.climb) { this.stepClimb(dt); return; }
    // in the river: swim, and climb out wherever you reach the bank
    if (F.swim && !F.climb && (fw || sd)) {
      const ax = F.x + Math.cos(F.yaw) * 0.8, az = F.z + Math.sin(F.yaw) * 0.8;
      if (!this.W.surf.isWater(ax, az) && !this.W.surf.inBuilding(ax, az)) { this.startClimb(Math.cos(F.yaw), Math.sin(F.yaw), this.W.surf.height(ax, az)); return; }
    }
    if (input.took('Space') && !F.air && !this.downT && !A && !F.swim) {
      const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
      const wall = this.W.collision.resolve(F.x + fx * 0.45, F.z + fz * 0.45, 0.32);
      if (wall && wall.kind === 5 && (fx * -wall.nx + fz * -wall.nz) > 0.5) this.startClimb(-wall.nx, -wall.nz);
      else { F.air = true; F.vy = 3.4; this.human.play('jump_start', { once: true, fade: 0.08 }); this.events.push({ type: 'jump' }); }
      if (F.climb) return;
    }
    if (F.air) { F.vx *= 1 - dt * 0.15; F.vz *= 1 - dt * 0.15; }   // little air control
    const px0 = F.x, pz0 = F.z;
    F.x += F.vx * dt; F.z += F.vz * dt;
    // walls, poles, parked vehicles, trees (in the air you clear scooters, stalls and bollards)
    for (let it = 0; it < 2; it++) {
      const res = flyResolve({ W: this.W, deck: F.deck ?? -1 }, F.x, F.z, 0.3);
      if (res && !(F.air && res.kind === 2 && F.y - groundY() > 0.55) && !(F.swim && res.kind === 4)) { F.x += res.nx * res.depth; F.z += res.nz * res.depth; }
    }
    // traffic: get shoved / knocked down
    if (traffic) traffic.near(F.x, F.z, 6, (o) => {
      if (o.isPlayer || !o.T && !o.parked) return;
      const T = o.T || { L: o.L, W: o.W };
      const rx = F.x - o.x, rz = F.z - o.z;
      const al = rx * o.hx + rz * o.hz, ac = -rx * o.hz + rz * o.hx;
      const hl = T.L / 2 + 0.3, hw = T.W / 2 + 0.3;
      if (Math.abs(al) > hl || Math.abs(ac) > hw) return;
      // push out along the shallower axis
      const pa = hl - Math.abs(al), pc = hw - Math.abs(ac);
      if (pa < pc) { const s = Math.sign(al) || 1; F.x += o.hx * s * pa; F.z += o.hz * s * pa; }
      else { const s = Math.sign(ac) || 1; F.x += -o.hz * s * pc; F.z += o.hx * s * pc; }
      if ((o.v || 0) > 3.5 && !this.downT) {
        this.downT = 3.2;
        this.events.push({ type: 'gotHit', speed: o.v, who: o.type });
        this.human.play('knockback', { once: true, fade: 0.08 });
        o.angry = 6;
      }
    });
    // footpath height
    const FL = this.W.fly;
    F.deck = FL ? FL.track(F.x, F.z, F.deck ?? -1, F.y) : -1;
    const wet = F.deck < 0 && this.W.surf.isWater(F.x, F.z);
    let gy = wet ? SWIM_Y : F.deck >= 0 ? FL.heightOn(F.deck, F.x, F.z) : this.W.surf.height(F.x, F.z);
    // no walking up walls: on foot you step up a stair's height at most (steps and ramps rise a little at a
    // time); anything taller holds you back, and walking off something high is a fall, not a glide down
    if (!F.air && !F.swim && !wet && gy > F.y + 0.55) {
      F.x = px0; F.z = pz0; F.vx = F.vz = 0; F.v = 0;
      F.deck = FL ? FL.track(F.x, F.z, F.deck ?? -1, F.y) : -1;
      gy = F.deck >= 0 ? FL.heightOn(F.deck, F.x, F.z) : this.W.surf.height(F.x, F.z);
      if (gy > F.y + 0.55) F.y = gy;                 // the ground came up under you (a hill streamed in): stand on it
    } else if (!F.air && !F.swim && !wet && gy < F.y - 0.8) { F.air = true; F.vy = 0; }
    // stepped off the bank: you drop into the river
    if (wet && !F.swim && !F.air && F.y > gy + 0.3) { F.air = true; F.vy = 0.5; F.splash = true; }
    F.swim = wet && !F.air;
    if (F.air) {
      F.vy -= 9.8 * dt; F.y += F.vy * dt;
      if (F.y <= gy && F.vy < 0) {
        F.y = gy; F.air = false;
        if (wet) { this.landT = 0; F.vy = 0; F.swim = true; this.audio?.thud?.(0.5); this.audio?.whoosh?.(1); this.events.push({ type: 'splash' }); }
        else this.landT = 0.35, this.human.play('jump_land', { once: true, fade: 0.06 });
        if (F.vy < -7.5 && !wet) { this.downT = 2.2; this.human.play('knockback', { once: true, fade: 0.08 }); this.events.push({ type: 'gotHit', speed: -F.vy, who: 'fall' }); }
        F.vy = 0;
      }
    } else F.y = damp(F.y, gy, 18, dt);
    Object.assign(F.agent, { x: F.x, z: F.z, hx: Math.cos(F.yaw), hz: Math.sin(F.yaw), v: F.v });
    // animation
    if (this.downT > 0) {
      this.downT -= dt;
      F.vx *= 0.9; F.vz *= 0.9;
      if (this.downT < 1.4 && this.human.cur !== this.human.actions.getup) this.human.play('getup', { once: true, fade: 0.2 });
      if (this.downT <= 0) { this.downT = 0; this.ko = false; this.human.play('idle'); }
    } else if (this.seated) {
      // sitting at a table, in a salon chair, or dancing (world/interiors.js chose the clip)
    } else if (F.swim) {
      this.human.play(F.v > 0.3 ? 'swim' : 'swim_idle', { fade: 0.25, speed: F.v > 0.3 ? clamp(F.v / 1.3, 0.7, 1.5) : 1 });
    } else if (this.act) {
      // a punch, a roll or a flinch (people/fight.js plays the clip)
    } else if (F.air) {
      if (F.vy < 1.5 && this.human.cur === this.human.actions.jump_start) this.human.play('jump_loop', { fade: 0.15 });
    } else if ((this.landT = (this.landT || 0) - dt) > 0) {
      // finishing the landing
    } else {
      const a = F.v < 0.25 ? 'idle' : F.v < 2.2 ? 'walk' : F.v < 4.6 ? 'jog' : 'sprint';
      const nat = { idle: 1, walk: 1.25, jog: 3.2, sprint: 5.6 }[a];
      this.human.play(a, { speed: a === 'idle' ? 1 : clamp(F.v / nat, 0.6, 1.6) });
    }
    const H = this.human;
    H.holder.position.set(F.x, F.y, F.z);
    H.holder.rotation.set(0, -F.yaw, 0);
    H.mixer.update(dt);
    if (this.postPose) this.postPose(H, dt);
  }

  // over a compound wall: hands on top, swing up (0.9 s), over and drop down the other side
  startClimb(nx, nz, topY) {
    const F = this.foot;
    F.climb = { t: 0, x0: F.x, z0: F.z, y0: F.y, nx, nz, top: topY !== undefined ? topY : F.y + 1.8 };
    F.swim = false;
    F.vx = F.vz = 0; F.v = 0;
    F.yaw = Math.atan2(nz, nx);
    this.human.play('climb', { once: true, fade: 0.1, speed: 1.15 });
    this.events.push({ type: 'climb' });
  }
  stepClimb(dt) {
    const F = this.foot, C = F.climb, H = this.human;
    C.t += dt;
    const T1 = 0.85 * Math.max(1, (C.top - C.y0) / 1.8), T2 = T1 + 0.4;
    if (C.t < T1) {           // up the face of the wall
      const u = C.t / T1, e = u * u * (3 - 2 * u);
      F.y = C.y0 + (C.top - C.y0) * e;
      F.x = C.x0 + C.nx * 0.25 * e; F.z = C.z0 + C.nz * 0.25 * e;
    } else if (C.t < T2) {    // over the top
      const u = (C.t - T1) / (T2 - T1);
      F.x = C.x0 + C.nx * (0.25 + 0.75 * u); F.z = C.z0 + C.nz * (0.25 + 0.75 * u);
      F.y = C.top + Math.sin(u * Math.PI) * 0.08;
    } else {                  // drop down the far side
      F.climb = null; F.air = true; F.vy = 0.5;
      F.vx = C.nx * 1.2; F.vz = C.nz * 1.2;
      H.play('jump_loop', { fade: 0.15 });
    }
    Object.assign(F.agent, { x: F.x, z: F.z, hx: Math.cos(F.yaw), hz: Math.sin(F.yaw), v: 0 });
    H.holder.position.set(F.x, F.y, F.z);
    H.holder.rotation.set(0, -F.yaw, 0);
    H.mixer.update(dt);
  }

  // ---------------------------------------------------------------- getting in and out
  buildParkGrid() {
    this.parkGrid = new Map();
    for (const r of this.W.parkedList || []) {
      const key = Math.floor(r.x / 20) + ',' + Math.floor(r.z / 20);
      let l = this.parkGrid.get(key); if (!l) this.parkGrid.set(key, l = []);
      l.push(r);
    }
  }
  findOffer(traffic) {
    if (!this.onFoot || this.downT > 0) return null;
    const F = this.foot;
    let best = null, bd = 1e9;
    const consider = (d, o) => { if (d < bd) { bd = d; best = o; } };
    // own auto + vehicles you left
    for (const d of this.dropped) {
      const v = d.veh, S = v === this.auto ? specOf('auto') : v.spec;
      const dist = this.distToBox(F.x, F.z, v.x, v.z, Math.cos(v.th), Math.sin(v.th), S.L, S.W);
      if (dist < 1.6) consider(dist, { kind: 'dropped', d, label: d.towed ? `Pay ₹${d.towed.fee} and take your auto` : v === this.auto ? 'Get in your auto' : S.two ? `Get on the ${S.name.toLowerCase()}` : `Get in the ${S.name.toLowerCase()}`, key: 'F' });
    }
    // parked vehicles
    if (!this.parkGrid) this.buildParkGrid();
    const i0 = Math.floor(F.x / 20), j0 = Math.floor(F.z / 20);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const l = this.parkGrid.get(i + ',' + j);
      if (l) for (const r of l) {
        if (r.taken) continue;
        const S = specOf(r.kind);
        const dist = this.distToBox(F.x, F.z, r.x, r.z, r.hx, r.hz, S.L, S.W);
        if (dist < 1.3) consider(dist + 0.2, { kind: 'parked', r, label: `Take the parked ${S.name.toLowerCase()}`, key: 'F' });
      }
    }
    // traffic: slow or stopped vehicles can be taken from their driver
    if (traffic) traffic.near(F.x, F.z, 8, (o) => {
      if (!o.T || o.isPlayer || o.parked || o.fallen > 0) return;
      const dist = this.distToBox(F.x, F.z, o.x, o.z, o.hx, o.hz, o.T.L, o.T.W);
      if (dist < 1.4 && o.v < 3.5) consider(dist + 0.4, { kind: 'traffic', o, label: `Take the ${specOf(o.type).name.toLowerCase()} from its driver`, key: 'F' });
    });
    return best;
  }
  distToBox(px, pz, cx, cz, hx, hz, L, W) {
    const rx = px - cx, rz = pz - cz;
    const a = Math.abs(rx * hx + rz * hz) - L / 2, c = Math.abs(-rx * hz + rz * hx) - W / 2;
    return Math.hypot(Math.max(0, a), Math.max(0, c));
  }

  enter(offer, traffic) {
    let veh = null;
    if (offer.kind === 'dropped') {
      if (offer.d.towed && this.onRelease && !this.onRelease(offer.d)) return;
      veh = offer.d.veh;
      this.removeDropped(offer.d, traffic);
    } else if (offer.kind === 'parked') {
      const r = offer.r;
      r.taken = true;
      for (const it of r.items) it.off = true;
      for (const c of r.circles) c.off = true;
      if (r.static && traffic.statics) { const i = traffic.statics.indexOf(r.static); if (i >= 0) traffic.statics.splice(i, 1); traffic.staticsT = 0; }
      veh = new Vehicle(this.W, this.scene, this.vmats, r.kind, r.col);
      veh.reset(r.x, r.z, Math.atan2(r.hz, r.hx));
      veh.y = this.W.surf.height(r.x, r.z);
      // about half the parked two-wheelers have a helmet hanging off the mirror
      veh.helmet = ((Math.abs(r.x * 7.31 + r.z * 3.17) | 0) % 2) === 0;
      veh.stolen = true; veh.plate = this.randomPlate();
      this.events.push({ type: 'stoleParked', veh, name: veh.spec.name.toLowerCase(), x: r.x, z: r.z });
    } else if (offer.kind === 'traffic') {
      const o = offer.o;
      veh = new Vehicle(this.W, this.scene, this.vmats, o.type, o.col);
      veh.reset(o.x, o.z, Math.atan2(o.hz, o.hx));
      veh.v = 0;
      veh.helmet = false;                       // the rider keeps theirs
      veh.stolen = true; veh.plate = this.randomPlate();
      const idx = traffic.list.indexOf(o);
      if (idx >= 0) traffic.despawn(idx);
      this.spawnAngryDriver(o);
      this.events.push({ type: 'carjack', who: o.type, x: o.x, z: o.z });
    }
    if (!veh) return;
    this.switchTo(veh);
    this.busy = 0.6;
    this.audio?.blip?.();
  }
  randomPlate() {
    const L = 'ABCDEFGHJKLMNPRSTUVWXYZ', r = this.rng;
    return `MH 12 ${L[r.int(0, L.length - 1)]}${L[r.int(0, L.length - 1)]} ${r.int(1000, 9999)}`;
  }
  exit(traffic, force = false) {
    const veh = this.cur;
    if (this.onFoot) return;
    if (Math.abs(veh.v) > 2.5 && !force) { this.hud?.toast('Slow down first', 'You can only get out below ~9 km/h', 'warn', 1.6); return; }
    const S = veh === this.auto ? specOf('auto') : veh.spec;
    const hx = Math.cos(veh.th), hz = Math.sin(veh.th);
    // Indian cars are right-hand drive: out of the right door; off a two-wheeler to the left
    const side = S.two ? -1 : 1;
    const off = S.W / 2 + 0.55;
    let px = veh.x + (-hz) * off * side, pz = veh.z + hx * off * side;
    if (this.W.collision.resolve(px, pz, 0.3)) { px = veh.x - (-hz) * off * side; pz = veh.z - hx * off * side; }
    veh.v = 0; veh.throttle = 0;
    if (veh === this.auto) { this.auto.driver.visible = false; this.auto.driverArms.visible = false; }
    this.addDropped(veh, traffic);
    this.mode = 'foot';
    this.hideRider();
    const onDeck = veh.deck >= 0 && this.W.fly;
    Object.assign(this.foot, { x: px, z: pz, y: onDeck ? this.W.fly.heightOn(veh.deck, px, pz) : this.W.surf.height(px, pz), deck: onDeck ? veh.deck : -1, yaw: veh.th, v: 0, vx: 0, vz: 0 });
    this.human.holder.visible = true;
    this.setAcc(this.look.acc);
    this.human.play('idle', { fade: 0.1 });
    this.busy = 0.5;
    this.events.push({ type: 'exit' });
  }
  switchTo(veh) {
    // one headlight for the player, moved between vehicles (never a new light in the scene)
    const L = this.auto.headlightShared || (this.auto.headlightShared = this.auto.headlight);
    if (veh === this.auto) { if (L.parent !== this.auto.tilt) { L.position.set(1.3, 0.75, 0); L.target.position.set(12, 0, 0); this.auto.tilt.add(L, L.target); } }
    else if (veh.takeHeadlight) veh.takeHeadlight(L);
    this.cur = veh;
    if (veh === this.auto) { this.auto.cockpit = undefined; this.auto.setCockpit(false); }
    this.mode = veh === this.auto ? 'auto' : 'veh';
    const S = veh === this.auto ? specOf('auto') : veh.spec;
    // you stay you: on a two-wheeler (with a helmet if there is one), at the wheel of an auto or car
    const seat = this.human ? seatFor(veh, S, veh === this.auto || veh.type === 'auto') : null;
    if (seat) this.showRider(veh, seat); else this.hideRider();
    if (veh === this.auto && this.human) this.auto.driver.visible = false;
    if (this.human) this.human.holder.visible = !!seat;
    this.events.push({ type: 'enter', vehicle: veh });
  }
  showRider(veh, seat) {
    this.riderShown = veh; this.seat = seat;
    const S = veh === this.auto ? specOf('auto') : veh.spec;
    this.setAcc(S.helmet && veh.helmet ? 'helmet' : this.look.acc);
    this.human.play('drive', { fade: 0.1 });
    this.placeRider();
  }
  hideRider() { this.riderShown = null; }
  placeRider() {
    const v = this.riderShown, H = this.human;
    const seat = this.seat || [-0.3, 0.8, 0];
    v.tilt.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(seat[0] - 0.05, seat[1] - 0.62, seat[2] || 0).applyMatrix4(v.tilt.matrixWorld);
    H.holder.position.copy(p);
    H.holder.rotation.set(0, -v.th, 0);
    H.root.rotation.x = 0;
    H.holder.rotateX(v.lean || 0);
    H.mixer.update(1 / 60);
    // hands on the handlebar (the grips each model's rider uses), elbows out and down
    const g = GRIPS[v === this.auto ? 'auto' : v.type];
    if (g) {
      const m = v.tilt.matrixWorld;
      for (const sd of [1, -1]) {
        _grip.set(g[0], g[1], g[2] * sd).applyMatrix4(m);
        _pole.set(-0.2, -0.7, sd).transformDirection(m);
        ikArm(H, sd > 0 ? 'r' : 'l', _grip, _pole, 1);
      }
    }
  }
  setAcc(name) { this.human.setAcc(name || null); }
  // become someone else (the character picker): same place, same vehicle, new body
  setLook(look) {
    const kit = this.kit;
    if (!kit) return;
    const old = this.human;
    this.look = look; kit.player = look;
    this.human = kit.create(look);
    this.scene.add(this.human.holder);
    if (old) { this.human.holder.visible = old.holder.visible; this.human.holder.position.copy(old.holder.position); this.human.holder.rotation.copy(old.holder.rotation); this.scene.remove(old.holder); old.dispose(); }
    else this.human.holder.visible = false;
    if (this.riderShown) this.showRider(this.riderShown, this.seat);
    else if (!this.onFoot && this.cur) {
      // already in a vehicle when the body arrived (a resumed game starts at the wheel): sit in it
      const veh = this.cur, S = veh === this.auto ? specOf('auto') : veh.spec;
      const seat = seatFor(veh, S, veh === this.auto || veh.type === 'auto');
      if (seat) { this.showRider(veh, seat); this.human.holder.visible = !this.cockpitOn; if (veh === this.auto) this.auto.driver.visible = false; }
    } else this.human.play('idle');
  }
  addDropped(veh, traffic) {
    const S = veh === this.auto ? specOf('auto') : veh.spec;
    const st = { x: veh.x, z: veh.z, hx: Math.cos(veh.th), hz: Math.sin(veh.th), v: 0, W: S.W, L: S.L, parked: true };
    const d = { veh, st };
    if (traffic && traffic.statics) { traffic.statics.push(st); traffic.staticsT = 0; }
    this.dropped.push(d);
    // keep at most a few abandoned vehicles around (yours, bought or rented, always stay)
    const spare = (q) => q.veh !== this.auto && !q.veh.owned;
    while (this.dropped.filter(spare).length > 4) {
      const old = this.dropped.find(spare);
      this.removeDropped(old, traffic);
      old.veh.dispose();
    }
  }
  removeDropped(d, traffic) {
    const i = this.dropped.indexOf(d);
    if (i >= 0) this.dropped.splice(i, 1);
    if (traffic && traffic.statics) { const j = traffic.statics.indexOf(d.st); if (j >= 0) traffic.statics.splice(j, 1); traffic.staticsT = 0; }
  }

  // the police take the vehicle you're on; you're left standing next to it
  abandon(traffic, confiscate) {
    const veh = this.cur;
    if (this.onFoot || veh === this.auto) return;
    this.exit(traffic, true);
    const d = this.dropped.find(q => q.veh === veh);
    if (d) this.removeDropped(d, traffic);
    if (confiscate) veh.dispose();
  }
  teleportFoot(x, z, th, traffic = null) {
    if (!this.onFoot) this.exit(traffic, true);
    Object.assign(this.foot, { x, z, y: this.W.surf.height(x, z), deck: -1, yaw: th || 0, v: 0, vx: 0, vz: 0 });
  }
  // move your auto (towed, or brought round to the chowki)
  moveAuto(x, z, th, traffic) {
    if (this.cur === this.auto && !this.onFoot) { this.auto.reset(x, z, th); return; }
    let d = this.dropped.find(q => q.veh === this.auto);
    if (!d) { this.addDropped(this.auto, traffic); d = this.dropped.find(q => q.veh === this.auto); }
    this.auto.reset(x, z, th);
    if (this.auto.driver) { this.auto.driver.visible = false; this.auto.driverArms.visible = false; }
    Object.assign(d.st, { x, z, hx: Math.cos(th), hz: Math.sin(th) });
    if (traffic) traffic.staticsT = 0;
  }

  // ---------------------------------------------------------------- the driver you pulled out
  spawnAngryDriver(o) {
    if (!this.kit) return;
    // the same person who was riding it: their shirt and helmet colours carry over from the traffic model
    const two = o.T && o.T.two, shown = two || o.type === 'auto';
    const look = this.kit.randomLook(this.rng, { female: shown ? false : this.rng.chance(0.25), helmet: two && o.type !== 'cycle', avoid: this.look });
    if (shown && o.colB) look.top = new THREE.Color(o.colB[0], o.colB[1], o.colB[2]);
    if (o.type === 'auto') look.bottom = new THREE.Color(0.62, 0.55, 0.4);                // auto drivers: khaki uniform
    const side = o.T && o.T.two ? -1 : 1;
    const x = o.x + (-o.hz) * (o.T.W / 2 + 0.7) * side, z = o.z + o.hx * (o.T.W / 2 + 0.7) * side;
    const cls = o.type === 'auto' ? 'auto' : two ? 'two' : 'car';
    // they become one of the people on the street (a pooled body: no new mesh, no hitch), with a
    // grudge: come back on foot and they may well square up
    if (this.makePed) {
      const persona = cls === 'auto' ? this.rng.pick(['kaka', 'dada', 'bhaiya']) : this.pickPersona ? this.pickPersona(look.female, x, z) : (look.female ? 'tai' : 'dada');
      const p = this.makePed(look, x, z, persona);
      if (p) {
        p.react = 2.6; p.reactAt = { x: o.x, z: o.z }; p.reactAnim = 'no'; p.angry = 3; p.grudge = 40;
        if (this.speakAs) this.speakAs('carjack_' + cls, p);
        return;
      }
    }
    const H = this.kit.create(look);
    if (two && o.colC && H.acc) H.acc.color.setRGB(o.colC[0], o.colC[1], o.colC[2]);
    H.holder.position.set(x, this.W.surf.height(x, z), z);
    this.scene.add(H.holder);
    H.play('no', { fade: 0.1 });
    // what they shout depends on what you took: their scooter, their car, their rickshaw
    const pool = cls === 'auto' ? ['kaka', 'dada', 'bhaiya'] : look.female ? ['kaku', 'tai', 'aunty', 'collegegirl'] : cls === 'car' ? ['kaka', 'ajoba', 'dada', 'bhaiya', 'collegeboy'] : ['kaka', 'ajoba', 'dada', 'bhaiya', 'collegeboy'];
    if (this.speakAs) this.speakAs('carjack_' + cls, { x, z, female: look.female, persona: this.rng.pick(pool) });
    else if (this.speak) this.speak(this.rng.pick(['sh1', 'sh2', 'sh3', 'sh4', 'sh5']), { x, z });
    else { const [line, tr] = this.rng.pick(SHOUTS); this.hud?.say('Driver', line, tr, 3.6); }
    this.npcs.push({ H, x, z, t: 0, yaw: Math.atan2(this.foot.z - z, this.foot.x - x) });
  }
  updateNpcs(dt) {
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      n.t += dt;
      if (n.t < 2.6) {
        n.yaw = dampAngle(n.yaw, Math.atan2(this.z - n.z, this.x - n.x), 6, dt);
        if (n.t > 1.4 && n.H.cur !== n.H.actions.punch && Math.hypot(this.x - n.x, this.z - n.z) < 4) n.H.play('punch', { fade: 0.15 });
      } else {
        if (n.H.cur !== n.H.actions.jog) n.H.play('jog', { fade: 0.3 });
        n.x += Math.cos(n.yaw) * 3 * dt; n.z += Math.sin(n.yaw) * 3 * dt;
        const res = this.W.collision.resolve(n.x, n.z, 0.3);
        if (res) { n.x += res.nx * res.depth; n.z += res.nz * res.depth; n.yaw += 1.2; }
        if (n.t > 2.6 && n.t < 2.7) n.yaw += Math.PI;
      }
      n.H.holder.position.set(n.x, this.W.surf.height(n.x, n.z), n.z);
      n.H.holder.rotation.set(0, -n.yaw, 0);
      n.H.mixer.update(dt);
      if (n.t > 14) { this.scene.remove(n.H.holder); n.H.dispose(); this.npcs.splice(i, 1); }
    }
  }
}
