// The player's auto-rickshaw: arcade physics tuned to feel like a Bajaj RE — slow to pick up,
// turns on a coin, lifts a rear wheel if you corner too hard, and tips over if you insist.
import * as THREE from 'three';
import { flyResolve, flyTrack, flyHeight } from '../world/flyover.js';
import { buildAuto, addRider } from './models.js';
import { ColorBuilder } from '../world/geo.js';
import { clamp, lerp, wrapAngle, RNG } from '../core/util.js';

const WB = 2.0, TRACK = 1.16, R_WHEEL = 0.21;
const V_TOP = 18.6;            // ~67 km/h flat out; ~55–60 in practice (drag), less with passengers
const GEARS = [0, 4.8, 9.4, 13.8, 99];
const LIFT = 4.6, TIP = 8.2;   // lateral acceleration (m/s^2) for wheel lift / tip over

export class PlayerAuto {
  constructor(W, scene, mats) {
    this.W = W;
    this.root = new THREE.Group();
    this.tilt = new THREE.Group();       // roll/pitch/bounce
    this.root.add(this.tilt);
    scene.add(this.root);
    const m = buildAuto({ solid: true, sepShield: true, sepBar: true });
    this.bodyMesh = new THREE.Mesh(m.body, mats.solid);
    this.bodyMesh.castShadow = true; this.bodyMesh.receiveShadow = true;
    this.glassMesh = new THREE.Mesh(m.glass, mats.glass);
    // clear windshield: faint tint + sky reflection, so the road shows through from the driver's seat
    const shieldMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6, depthWrite: false });
    this.shieldMesh = new THREE.Mesh(m.shield, shieldMat);
    this.shieldMesh.renderOrder = 3;
    this.tilt.add(this.bodyMesh, this.glassMesh, this.shieldMesh);
    // handlebar on its own pivot: turns with the front wheel (and the driver's hands go with it)
    this.barPivot = new THREE.Group();
    this.barPivot.position.set(...m.barPivot);
    this.barAxis = new THREE.Vector3(...m.barAxis).normalize();
    this.barMesh = new THREE.Mesh(m.bar, mats.solid);
    this.barMesh.castShadow = true;
    this.barPivot.add(this.barMesh);
    this.tilt.add(this.barPivot);
    // wheels
    const wg = new ColorBuilder();
    wg.addGeo(new THREE.CylinderGeometry(1, 1, 1, 16), new THREE.Matrix4().makeRotationX(Math.PI / 2).multiply(new THREE.Matrix4().makeScale(R_WHEEL, 0.12, R_WHEEL)), [0.06, 0.06, 0.06]);
    wg.addGeo(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.Matrix4().makeRotationX(Math.PI / 2).multiply(new THREE.Matrix4().makeScale(R_WHEEL * 0.55, 0.13, R_WHEEL * 0.55)), [0.6, 0.6, 0.62]);
    for (let k = 0; k < 6; k++) wg.addGeo(new THREE.BoxGeometry(0.03, 0.14, R_WHEEL * 0.9), new THREE.Matrix4().makeRotationZ(k * Math.PI / 3), [0.45, 0.45, 0.47]);
    const wheelGeo = wg.build();
    this.wheels = m.wheels.map(w => {
      const steer = new THREE.Group();
      steer.position.set(w.x, w.y, w.z);
      const mesh = new THREE.Mesh(wheelGeo, mats.solid);
      mesh.castShadow = true;
      steer.add(mesh);
      this.tilt.add(steer);
      return { ...w, steer, mesh };
    });
    // driver + passengers
    const db = new ColorBuilder();
    addRider(db, 0.32, 0.8, 0, { lean: 0.08, shirt: [0.92, 0.9, 0.84], pants: [0.24, 0.2, 0.18], handX: 0.72, handY: 1.07, handW: 0.33, footX: 0.66, footY: 0.42 });
    this.driver = new THREE.Mesh(db.build(), mats.solid);
    this.driver.castShadow = true;
    this.tilt.add(this.driver);
    // driver's-seat view: only arms, hands and knees (the head would sit on the camera)
    const da = new ColorBuilder();
    addRider(da, 0.32, 0.8, 0, { lean: 0.08, shirt: [0.78, 0.76, 0.7], pants: [0.24, 0.2, 0.18], handX: 0.72, handY: 1.07, handW: 0.33, footX: 0.66, footY: 0.42, noUpper: true });
    this.driverArms = new THREE.Mesh(da.build(), mats.solid);
    this.driverArms.visible = false;
    this.driverArms.position.set(-m.barPivot[0], -m.barPivot[1], -m.barPivot[2]);
    this.barPivot.add(this.driverArms);
    this.paxMeshes = [];
    for (let k = 0; k < 2; k++) {
      const pb = new ColorBuilder();
      addRider(pb, -1.02, 0.94, k ? 0.28 : -0.24, { lean: -0.05, shirt: [0.8, 0.3, 0.3], handX: -0.75, handY: 1.0, handW: 0.25, footX: -0.62, footY: 0.36 });
      const pm = new THREE.Mesh(pb.build(), mats.solid);
      pm.castShadow = true; pm.visible = false;
      this.tilt.add(pm);
      this.paxMeshes.push(pm);
    }
    // rear sticker "आई तुझा आशीर्वाद": its own sharp texture (in the shared sign atlas it bled and
    // blurred as soon as the chase camera pulled back at speed)
    {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 208;
      const x = c.getContext('2d');
      const T = 'आई तुझा आशीर्वाद';
      const paint = () => {
        x.fillStyle = '#0c0b0a'; x.fillRect(0, 0, 1024, 208);
        x.fillStyle = '#F2C230'; x.textAlign = 'center'; x.textBaseline = 'middle';
        let fs = 140; x.font = `400 ${fs}px "Yatra One", "Mukta", sans-serif`;
        while (x.measureText(T).width > 940 && fs > 40) { fs -= 4; x.font = `400 ${fs}px "Yatra One", "Mukta", sans-serif`; }
        x.fillText(T, 512, 112);
      };
      paint();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paint(); tex.needsUpdate = true; });
      const st = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.08 }));
      st.position.set(-1.452, 1.1, 0);
      st.rotation.y = -Math.PI / 2;
      this.tilt.add(st);
    }
    this.headlight = new THREE.SpotLight(0xfff1d0, 0, 60, 0.55, 0.5, 1.3);
    this.headlight.position.set(1.3, 0.75, 0);
    this.headlight.target.position.set(12, 0, 0);
    this.tilt.add(this.headlight, this.headlight.target);

    this.agent = { x: 0, z: 0, hx: 1, hz: 0, v: 0, W: 1.4, L: 2.7, isPlayer: true };
    this.cockpitEye = [0.3, 1.49, 0];
    this.rng = new RNG(7);
    this.reset(0, 0, 0);
    this.events = [];          // impacts, bumps, tipovers, etc. for game + audio
  }

  reset(x, z, th) {
    this.deck = -1;
    Object.assign(this, {
      x, z, th, v: 0, vl: 0, w: 0, steer: 0, y: 0, vy: 0, pitch: 0, roll: 0, lift: 0, liftT: 0,
      gear: 1, rpm: 0.15, shiftT: 0, reverse: false, revT: 0, tipped: 0, tipSide: 1, tipAng: 0, latAcc: 0,
      surf: 0, wheelSpin: 0, prevH: [0, 0, 0], shake: 0, throttle: 0, brake: 0, odometer: 0, onFootpath: false,
    });
    this.sync();
  }
  setCockpit(on) {
    if (this.cockpit === on) return;
    this.cockpit = on;
    this.driver.visible = !on;
    this.driverArms.visible = on;
  }
  setPassengers(n, shirts) {
    this.paxMeshes.forEach((m, k) => {
      m.visible = k < n;
      if (shirts && shirts[k]) {
        // recolour the torso via vertex colours of the passenger mesh (cheap: material colour tint)
      }
    });
  }

  heightAt(x, z) {
    const W = this.W;
    let h = W.surf.height(x, z);
    // speed breakers
    for (const b of W.bumps) {
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
      const ca = Math.cos(b.ang), sa = Math.sin(b.ang);
      const along = dx * ca + dz * sa, across = -dx * sa + dz * ca;
      if (Math.abs(across) < b.w / 2 + 0.2 && Math.abs(along) < 0.55) h = Math.max(h, 0.1 * Math.cos(along / 0.55 * Math.PI / 2) ** 2);
    }
    for (const p of W.potholeNear || []) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r) h -= 0.07 * (1 - d / p.r);
    }
    return flyHeight(this, x, z, h);
  }

  update(dt, inp, traffic) {
    const W = this.W;
    this.events.length = 0;
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    const rx = -hz, rz = hx;      // right vector (+z local)
    // potholes near us (cache)
    if (!this._potT || (this._potT -= dt) <= 0) {
      this._potT = 0.5;
      W.potholeNear = W.potholes.filter(p => Math.abs(p.x - this.x) < 40 && Math.abs(p.z - this.z) < 40);
    }
    if (this.tipped > 0) return this.updateTipped(dt);

    // ---- inputs
    const thr = clamp(inp.throttle, 0, 1), brk = clamp(inp.brake, 0, 1);
    this.throttle = thr; this.brake = brk;
    // reverse engage: hold brake at standstill
    if (!this.reverse && this.v < 0.3 && brk > 0.5 && thr < 0.1) { this.revT += dt; if (this.revT > 0.35) this.reverse = true; }
    else if (!(brk > 0.5)) this.revT = 0;
    if (this.reverse && (thr > 0.1 || (brk < 0.1 && Math.abs(this.v) < 0.2))) this.reverse = thr > 0.1 ? false : this.reverse;
    if (this.reverse && thr > 0.1 && this.v > -0.3) this.reverse = false;

    // ---- longitudinal
    let a = 0;
    const v = this.v;
    if (this.reverse) {
      a = -2.2 * brk;
      if (v < -3.6) a = Math.max(a, 0);
      if (brk < 0.1) a = -v * 2;
    } else {
      // torque falls off towards the top of 4th; passengers and luggage make it slower to pull
      const load = 1 + (this.load || 0) * 0.12;
      let eng = thr * 2.35 / load * Math.max(0, 1 - Math.pow(Math.max(0, v) / V_TOP, 3));
      if (this.shiftT > 0) { this.shiftT -= dt; eng *= 0.25; }
      a = eng - brk * 6.2 * Math.sign(v || 1);
      if (v < 0) a += brk * 6.2 * 2;     // brake while rolling back
    }
    const drag = 0.13 + 0.0025 * v * v + (this.onFootpath ? 0.5 : 0);
    a -= Math.sign(v) * drag;
    if (inp.handbrake) a -= Math.sign(v) * 4.2;
    this.v = v + a * dt;
    if (Math.abs(this.v) < 0.05 && thr < 0.05 && !this.reverse) this.v = 0;
    // gears (for sound + shift dips)
    const g = this.v < GEARS[1] ? 1 : this.v < GEARS[2] ? 2 : this.v < GEARS[3] ? 3 : 4;
    if (g > this.gear) this.shiftT = 0.22;
    this.gear = g;
    const lo = GEARS[g - 1], hi = Math.min(GEARS[g], V_TOP);
    const targetRpm = this.reverse ? 0.4 + Math.abs(this.v) / 4 : lerp(0.18, 1.0, clamp((Math.max(0, this.v) - lo) / (hi - lo + 0.01), 0, 1)) * (0.75 + thr * 0.25) + thr * 0.12;
    this.rpm += (Math.min(1.1, targetRpm) - this.rpm) * Math.min(1, dt * 7);

    // ---- steering
    const sp = Math.abs(this.v);
    const maxSteer = 0.62 / (1 + sp * sp / 30);
    const target = clamp(inp.steer, -1, 1) * maxSteer;
    const rate = (Math.abs(target) < Math.abs(this.steer) ? 3.2 : 2.2);
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    let wT = this.v * Math.tan(this.steer) / WB;
    if (inp.handbrake && sp > 4) wT *= 1.45;
    // grip limit (autos tip before they slide; this mostly matters with the handbrake)
    const mu = inp.handbrake ? 5.0 : 8.5;
    const latDemand = sp * Math.abs(wT);
    let slide = 0;
    if (latDemand > mu && sp > 0.5) { const k = mu / latDemand; slide = (1 - k); wT *= lerp(1, k, 0.6); }
    this.w += (wT - this.w) * Math.min(1, dt * 10);
    this.th = wrapAngle(this.th + this.w * dt);
    // lateral slip decays
    this.vl += (slide * this.v * Math.sign(this.w) * 0.35 - this.vl) * Math.min(1, dt * 3);

    // ---- tipping
    this.latAcc = this.v * this.w;
    const la = Math.abs(this.latAcc);
    const liftTarget = la > LIFT ? clamp((la - LIFT) * 0.11, 0, 0.36) : 0;
    this.lift += (liftTarget - this.lift) * Math.min(1, dt * (liftTarget > this.lift ? 7 : 4));
    if (la > TIP) { this.liftT += dt; if (this.liftT > 0.45) { this.tipOver(Math.sign(this.latAcc)); return; } }
    else this.liftT = Math.max(0, this.liftT - dt * 2);
    if (liftTarget > 0.05 && !this._liftWarned) { this.events.push({ type: 'lift' }); this._liftWarned = true; }
    if (liftTarget === 0) this._liftWarned = false;

    // ---- integrate position
    const nhx = Math.cos(this.th), nhz = Math.sin(this.th);
    const dx = (nhx * this.v + -nhz * this.vl) * dt, dz = (nhz * this.v + nhx * this.vl) * dt;
    this.x += dx; this.z += dz;
    this.odometer += Math.hypot(dx, dz);

    // ---- collisions with the city
    flyTrack(this);
    this.collideStatic();
    if (traffic && !(this.deck >= 0 && this.y > 2.2)) this.collideTraffic(traffic);

    // ---- suspension & terrain
    const fx = this.x + nhx * 1.0, fz = this.z + nhz * 1.0;
    const rlx = this.x - nhx * 0.98 - (-nhz) * 0.58, rlz = this.z - nhz * 0.98 - nhx * 0.58;
    const rrx = this.x - nhx * 0.98 + (-nhz) * 0.58, rrz = this.z - nhz * 0.98 + nhx * 0.58;
    const hF = this.heightAt(fx, fz), hL = this.heightAt(rlx, rlz), hR = this.heightAt(rrx, rrz);
    // jolts from kerbs / breakers / potholes
    const jolt = Math.max(Math.abs(hF - this.prevH[0]), Math.abs(hL - this.prevH[1]), Math.abs(hR - this.prevH[2]));
    if (jolt > 0.05 && sp > 2.5) {
      this.vy += jolt * sp * 0.55;
      this.events.push({ type: 'bump', strength: jolt * sp });
    }
    this.prevH = [hF, hL, hR];
    this.onFootpath = !this.W.surf.isRoad(this.x, this.z);
    const hT = (hF + (hL + hR) / 2) / 2;
    this.vy += ((hT - this.y) * 160 - this.vy * 14) * dt;
    this.y += this.vy * dt;
    const pitchT = Math.atan2(hF - (hL + hR) / 2, WB) - clamp(a * 0.008, -0.03, 0.03);
    this.pitch += (pitchT - this.pitch) * Math.min(1, dt * 12);
    const rollT = Math.atan2(hL - hR, TRACK) - clamp(this.latAcc * 0.012, -0.08, 0.08);
    this.roll += (rollT - this.roll) * Math.min(1, dt * 10);
    this.sync(dt);
  }

  collideStatic() {
    const W = this.W;
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    const circles = [[1.0, 0.48], [0.0, 0.7], [-0.95, 0.7]];
    for (let it = 0; it < 2; it++) {
      for (const [o, r] of circles) {
        const cx = this.x + hx * o, cz = this.z + hz * o;
        const res = flyResolve(this, cx, cz, r);
        if (!res) continue;
        this.x += res.nx * res.depth; this.z += res.nz * res.depth;
        // velocity in world, remove normal component
        const vx = hx * this.v - hz * this.vl, vz = hz * this.v + hx * this.vl;
        const vn = vx * res.nx + vz * res.nz;
        if (vn < 0) {
          const k = 1.15;
          const nvx = vx - res.nx * vn * k, nvz = vz - res.nz * vn * k;
          this.v = nvx * hx + nvz * hz;
          this.vl = -nvx * hz + nvz * hx;
          this.vl *= 0.5;
          if (-vn > 2.2) this.events.push({ type: 'crash', speed: -vn, kind: res.kind, x: cx, z: cz });
          else if (-vn > 0.6) this.events.push({ type: 'scrape', speed: -vn, kind: res.kind });
          if (res.kind === 3) this.events.push({ type: 'boundary' });
        }
      }
    }
  }

  collideTraffic(traffic) {
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    const mine = [[1.0, 0.5], [0.0, 0.7], [-0.95, 0.7]].map(([o, r]) => [this.x + hx * o, this.z + hz * o, r]);
    traffic.near(this.x, this.z, 9, (o) => {
      if (o.isPlayer || o.T === undefined) return;
      const T = o.T;
      const n = Math.max(1, Math.round(T.L / T.W));
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? 0 : -T.L / 2 + T.W / 2 + (T.L - T.W) * k / (n - 1);
        const ox = o.x + o.hx * off, oz = o.z + o.hz * off, orr = T.W / 2 + 0.05;
        for (const [mx, mz, mr] of mine) {
          const dx = mx - ox, dz = mz - oz, d = Math.hypot(dx, dz), rr = mr + orr;
          if (d >= rr || d < 1e-4) continue;
          const nx = dx / d, nz = dz / d, depth = rr - d;
          const myMass = 520, oMass = T.mass;
          const share = oMass / (myMass + oMass);
          this.x += nx * depth * share; this.z += nz * depth * share;
          // relative velocity along normal
          const vx = hx * this.v, vz = hz * this.v;
          const ovx = o.hx * o.v, ovz = o.hz * o.v;
          const rel = (vx - ovx) * nx + (vz - ovz) * nz;
          if (rel < 0) {
            const imp = -rel;
            // we lose speed in proportion to their mass
            const dv = imp * share * 1.1;
            const nvx = vx + nx * dv, nvz = vz + nz * dv;
            this.v = nvx * hx + nvz * hz;
            o.v = Math.max(0, o.v - imp * (1 - share) * 0.8);
            o.angry = 6;
            if (T.two && imp > 3.0 && !o.fallen) { o.fallen = 3.5; this.events.push({ type: 'knock', who: 'two', speed: imp, x: o.x, z: o.z }); }
            else if (imp > 1.5) this.events.push({ type: 'hit', who: o.type, speed: imp, x: o.x, z: o.z });
            if (!(o.honkT > 0)) { o.honkT = 2.5; traffic.honks.push({ x: o.x, z: o.z, kind: T.honk, n: 2 }); }   // once per bump, not every frame of contact
          }
          return;
        }
      }
    });
  }

  tipOver(side) {
    this.tipped = 3.2;
    this.tipSide = side;
    this.events.push({ type: 'tip', speed: Math.abs(this.v) });
  }
  updateTipped(dt) {
    this.tipped -= dt;
    // slide to a stop on the side
    this.v *= Math.exp(-dt * 2.5);
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    this.x += hx * this.v * dt; this.z += hz * this.v * dt;
    this.collideStatic();
    const t = this.tipped;
    const target = t > 0.7 ? 1.32 : 0;
    this.tipAng += (target - this.tipAng) * Math.min(1, dt * (t > 0.7 ? 6 : 4));
    if (this.tipped <= 0) {
      this.tipped = 0; this.tipAng = 0; this.v = 0; this.w = 0; this.lift = 0; this.liftT = 0;
      this.events.push({ type: 'recovered' });
    }
    this.sync(dt);
  }

  sync(dt = 0) {
    const hx = Math.cos(this.th), hz = Math.sin(this.th);
    this.agent.x = this.x; this.agent.z = this.z; this.agent.hx = hx; this.agent.hz = hz; this.agent.v = Math.abs(this.v);
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.set(0, -this.th, 0);
    // idle shiver of a single-cylinder engine
    const t = performance.now() / 1000;
    const shiver = (this.v === 0 && this.tipped === 0) ? Math.sin(t * 95) * 0.0035 + Math.sin(t * 61) * 0.002 : Math.sin(t * 140) * 0.0012;
    const tipRoll = -this.tipAng * this.tipSide;      // falls to the outside of the turn
    this.tilt.position.set(0, this.y + shiver + this.lift * 0.5 + Math.abs(tipRoll) * 0.45, 0);
    // roll about the forward axis (x), pitch about the right axis (z)
    this.tilt.rotation.set(this.roll - this.lift * Math.sign(this.latAcc) + tipRoll, 0, this.pitch, 'YXZ');
    // wheels: spin + steer
    if (dt) this.wheelSpin += this.v * dt / R_WHEEL;
    for (const w of this.wheels) {
      w.mesh.rotation.z = -this.wheelSpin;
      if (w.front) w.steer.rotation.y = -this.steer;
    }
    this.barPivot.quaternion.setFromAxisAngle(this.barAxis, -this.steer);
  }
}
