// Close-up people: the nearest pedestrians and the traffic police are drawn as animated, dressed
// humans (HumanKit); everyone further away stays a cheap instanced figure from peds.js. A small
// pool of skinned bodies is re-dressed and handed from person to person as you move.
import * as THREE from 'three';
import { clamp, RNG } from '../core/util.js';
import { ikArm, leanRider } from './humans.js';
import { hasUmbrella, umbrellaColor, umbrellaGeo, umbrellaMat, umbrellaKind } from './umbrella.js';
const _sh = new THREE.Vector3(), _tg = new THREE.Vector3(), _pl = new THREE.Vector3(), _hd = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _q = new THREE.Quaternion(), _v = new THREE.Vector3();
// where the hands go: the handlebar grips (vehicle frame, as you hold them), by model
const GRIPS = { auto: [0.72, 1.07, 0.33], scooter: [0.62, 1.0, 0.3], bike: [0.6, 1.08, 0.34] };
// everyone within this many metres is a fully dressed, animated person (by quality); riders within FULL * 0.7
const FULL = { lite: 25, low: 32, med: 40, high: 48 };
// the seated clips put the hips this far behind the body's origin
const HIPS = 0.31;
// how far a rider leans into the bars (radians): a motorcycle, a scooter, an auto; a pillion a little
const LEAN = { bike: 0.5, scooter: 0.36, auto: 0.24, pillion: 0.14 };
const _ax = new THREE.Vector3(), _pq = new THREE.Quaternion(), _dq = new THREE.Quaternion();
function bend(bone, axisWorld, angle) {
  if (!bone || !bone.parent) return;
  bone.parent.getWorldQuaternion(_pq);
  _ax.copy(axisWorld).applyQuaternion(_pq.invert());
  bone.quaternion.premultiply(_dq.setFromAxisAngle(_ax, angle));
}
let UGEO = null;

const RANGE = 48;            // metres from the camera
const NAT = { walk: 1.25, jog: 3.0 };

// how someone walks: the office crowd walks formal at rush hour, kakus and aunties often carry the shopping
function walkFor(p, people) { void people; return 'walk'; }   // one walk for everyone (the formal-walk clip faces the wrong way)
// someone standing around doesn't hold one pose: the phone, a chat, a sip of chai, arms folded, a nod
const IDLES = { young: ['phone', 'phone', 'talk', 'idle', 'arms_folded'], old: ['idle', 'arms_folded', 'talk', 'idle'], any: ['idle', 'talk', 'phone', 'arms_folded'] };
function idleFor(p) {
  const now = performance.now() / 1000;
  if (!p.idleUntil || now > p.idleUntil) {
    const set = /aaji|ajoba/.test(p.persona || '') ? IDLES.old : /college|kp|dada|tai/.test(p.persona || '') ? IDLES.young : IDLES.any;
    p.idleNow = p.idle === 'phone' && Math.random() < 0.5 ? 'phone' : set[Math.floor(Math.random() * set.length)];
    p.idleUntil = now + 25 + Math.random() * 40;                       // one pose for a good while, not a new one every few seconds
  }
  return p.idleNow;
}
export class Crowd {
  constructor(people, kit, scene, W, quality) {
    this.people = people; this.kit = kit; this.scene = scene; this.W = W;
    this.rain = 0;
    this.setQuality(quality);
    this.pool = [];
    this.t = 0;
    // build the pool up front: creating a skinned body mid-game is a visible hitch
    // a starter set up front (the rest are made as more people come close)
    const pre = Math.min(this.cap, quality.name === 'lite' ? 22 : 40);
    if (kit) { for (let i = 0; i < Math.ceil(pre * 0.6); i++) this.makeSkin(false); for (let i = 0; i < Math.ceil(pre * 0.45); i++) this.makeSkin(true); }
  }
  // a radius, not a count: everyone near you is a real person; the cap is only a safety net for a packed crowd
  setQuality(q) { this.range = FULL[q.name] || 40; this.cap = q.name === 'lite' ? 40 : q.name === 'low' ? 60 : 110; if (this.traffic) this.traffic.richR = this.range * 0.7; }
  makeSkin(female) {
    const kit = this.kit;
    const look = kit.randomLook(new RNG(this.pool.length + 1), { female });
    const H = kit.create(look);
    H.holder.visible = false;          // in the scene only while it's someone (a hidden body's ~60 bones still cost every frame)
    const accs = [];
    H.root.traverse(o => { if (o.isSkinnedMesh && !o.name.startsWith('body')) accs.push(o); });
    const s = { H, female, p: null, accs, dtAcc: 0 };
    s.release = () => { if (s.p) s.p.body = null; s.p = null; H.holder.visible = false; if (H.holder.parent) this.scene.remove(H.holder); if (s.umb) s.umb.visible = false; };
    this.pool.push(s);
    return s;
  }
  dress(s, look) {
    this.kit.applyLook(s.H, look);
  }

  // spare bodies made in the browser's idle time, so turning round never waits on one being built mid-frame
  warm() {
    if (this._warm || !this.kit || !window.requestIdleCallback) return;
    const want = Math.min(this.cap, Math.round(this.cap * 0.75)), free = this.pool.filter(q => !q.p);
    if (this.pool.length >= want || free.length >= 6) return;
    this._warm = requestIdleCallback((d) => {
      this._warm = null;
      if (d.timeRemaining() < 6) return;
      const f = this.pool.filter(q => !q.p && q.female).length, m = this.pool.filter(q => !q.p && !q.female).length;
      this.makeSkin(f < m * 0.7);
    }, { timeout: 4000 });
  }
  update(dt, cx, cz) {
    if (!this.kit) return;
    this.warm();
    this.t -= dt;
    // a vehicle just came close enough for real riders: seat them now, not at the next quarter-second (the baked
    // figures stay until they're seated, so nobody blinks out); one that's gone back to baked figures lets go at once
    const T = this.traffic;
    if (T && this.t > 0.05) for (const o of T.list) if (o.rich && (!o._riders || o._riders.some(r => !r.body))) { this.t = 0; break; }
    for (const s of this.pool) if (s.p && s.p.rideOf && !s.p.rideOf.rich) s.release();
    if (this.t <= 0) { this.t = 0.25; this.assign(cx, cz); }
    for (const s of this.pool) if (s.p) this.drive(s, dt, cx, cz);
  }
  // people riding the close, slow two-wheelers and autos (traffic.js marks them rich): one pseudo-person per seat
  riders() {
    const T = this.traffic, out = [];
    if (!T || !this.kit) return out;
    for (const o of T.list) {
      if (!o.rich) { o._riders = null; continue; }
      if (!o._riders) {
        const two = !/^auto/.test(o.type), pil = /P$/.test(o.type), rng = { next: Math.random, chance: (q) => Math.random() < q, range: (a, b) => a + Math.random() * (b - a), pick: (a) => a[Math.floor(Math.random() * a.length)], int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), weighted: null };
        // the seats as the models have them (x along, height of the seat; the body sits 0.62 below the seat, like yours)
        const bike = /^bike/.test(o.type);
        // [hips x, z, side-saddle, seat height] in the vehicle's frame: the hips on the seat, not behind it
        const seats = two ? [[bike ? 0.0 : 0.04, 0, false, bike ? 0.95 : 0.8]] : [[0.22, 0, false, 0.8]];
        if (pil) seats.push([bike ? -0.38 : -0.44, 0, o.type === 'scooterP', bike ? 0.97 : 0.84]);
        o._riders = seats.map(([a, b, side, sy], i) => {
          const female = i === 1 ? (side ? Math.random() < 0.75 : Math.random() < 0.2) : Math.random() < 0.15;
          const look = this.kit.randomLook(rng, { female, helmet: two && i === 0 && o.type !== 'scooterP' });
          // dressed as the baked figure was (its shirt is the vehicle's colB, helmet / hair colC): no change of clothes up close
          if (o.colB) look.top = look.top.setRGB(o.colB[0], o.colB[1], o.colB[2]);
          if (!two) look.bottom = look.top.clone().multiplyScalar(0.9);
          else if (i === 1 && side && female) { look.bottom = look.top.clone().multiplyScalar(0.85); look.cut = look.cut.clone().set(0.3, 1, 0.9, 2); }
          if (o.colC) { if (look.acc === 'helmet') look.helmetCol = look.top.clone().setRGB(o.colC[0], o.colC[1], o.colC[2]); else if (i === 1) look.hair = look.top.clone().setRGB(o.colC[0], o.colC[1], o.colC[2]); }
          return { id: (o.id || 0) * 4 + i + 1e7, look, female, rideOf: o, seat: [a, b], seatY: sy - 0.62, sideSaddle: side, seatIdx: i, drvX: seats[0][0], x: o.x, z: o.z, yaw: 0, v: 0, mode: 'ride', persona: female ? 'tai' : 'dada' };
        });
      }
      for (const r of o._riders) { const hx = o.hx ?? Math.cos(o.yaw || 0), hz = o.hz ?? Math.sin(o.yaw || 0); r.x = o.x + hx * r.seat[0] - hz * r.seat[1]; r.z = o.z + hz * r.seat[0] + hx * r.seat[1]; r.yaw = Math.atan2(hz, hx); r.y = o.y || 0; out.push(r); }
    }
    return out;
  }
  assign(cx, cz) {
    const cand = [];
    for (const r of this.riders()) cand.push([-50, r]);          // the riders right next to you always get a body
    for (const p of this.people.list) {
      if (p.hidden || !p.look) continue;
      const d = Math.hypot(p.x - cx, p.z - cz);
      const R0 = this.range || RANGE, r = p.cop || p.ctl || p.story ? R0 + 14 : R0;
      // everyone inside the radius (nearest first); the ones you can see win only if the safety cap bites
      const seen = !this.inView || d < 8 || this.inView(p.x, p.z);
      if (d < r) cand.push([d - (p.cop || p.ctl ? 12 : 0) + (seen ? 0 : 15), p]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const want = new Set(cand.slice(0, this.cap).map(c => c[1]));
    for (const s of this.pool) if (s.p && (!want.has(s.p) || s.p.hidden)) s.release();
    let made = 0;
    for (const p of want) {
      if (p.body) continue;
      const fem = !!p.look.female;
      let s = this.pool.find(q => !q.p && q.female === fem);
      // a new body is a few ms: at most two per tick so a crowd arriving never stutters
      // (nearest first, the ones on screen before the ones behind you; someone right beside you can't wait)
      const urgent = Math.abs(p.x - cx) + Math.abs(p.z - cz) < 12;
      if (!s && this.pool.length < this.cap + 8 && (made < 2 || (urgent && made < 4))) { s = this.makeSkin(fem); made++; }
      if (!s) continue;
      this.dress(s, p.look);
      if (p.kid) s.H.root.scale.setScalar(p.look.scale * 0.7);
      s.p = p; p.body = s;
      s.cur = null; s.lx = undefined; s.vel = p.v || 0;
      s.H.holder.visible = true; if (!s.H.holder.parent) this.scene.add(s.H.holder);
    }
  }
  animFor(p, vel) {
    if (p.rideOf) return [p.sideSaddle ? 'sit' : 'drive', 1];
    if (p.fallen > 0) return p.ko ? [p.fallen > 1.6 ? 'death' : 'getup', 1, true] : [p.fallen > 1.3 ? 'knockback' : 'getup', 1, true];
    if (p.act) return [p.act.clip, p.act.speed || 1, true];
    if (p.mode === 'fight') return p.v > 2.2 ? ['jog', clamp(p.v / NAT.jog, 0.7, 1.4)] : p.v > 0.2 ? ['walk', 1.3] : [p.fightT < 1.6 ? 'no' : 'idle', 1.3];
    if (p.anim) return [p.anim, 1];
    if (p.react > 0 && p.reactAnim) return [p.reactAnim, 1, p.reactAnim === 'hit'];
    if (p.angry > 0) return ['no', 1];
    if (p.pax) return ['wave', 1];
    if (p.cop && (vel ?? p.v) < 0.3 && p.mode !== 'chase') return [(performance.now() / 1000 + p.id % 17) % 14 < 4 ? 'wave' : 'arms_folded', 1];
    const v = vel ?? p.v;
    if (v < 0.25 && (p.mode === 'stand' || p.mode === 'watch' || p.v < 0.15 || v < 0.12)) return [idleFor(p), 1];
    if (v > 2.2) return ['jog', clamp(v / NAT.jog, 0.6, 1.5)];
    return [walkFor(p, this.people), clamp(v / NAT.walk, 0.55, 1.5)];
  }
  drive(s, dt, cx, cz) {
    const p = s.p, H = s.H;
    // riders follow their vehicle every frame (not only when bodies are handed out), so they ride smoothly with it
    if (p.rideOf) {
      // on the seat as the vehicle is drawn: its smoothed position, heading, lean and pitch (so they ride with it)
      const o = p.rideOf, yaw = o.ryaw ?? o.yaw ?? Math.atan2(o.hz, o.hx);
      _e.set(o.fallen > 0 ? 1.3 : (o.roll || 0), -yaw, o.pitch || 0, 'YXZ'); _q.setFromEuler(_e);
      _v.set(p.seat[0] + (p.sideSaddle ? 0 : HIPS), (p.seatY ?? 0.2) + (p.sideSaddle ? 0.04 : 0), p.seat[1] - (p.sideSaddle ? HIPS : 0)).applyQuaternion(_q);
      p.x = (o.rx ?? o.x) + _v.x; p.z = (o.rz ?? o.z) + _v.z; p.yaw = yaw; p.y = o.y || 0;
      H.holder.position.set(p.x, p.y + _v.y, p.z);
      H.holder.quaternion.copy(_q); if (p.sideSaddle) H.holder.rotateY(Math.PI / 2);   // (p.side is a pedestrian's side of the road, not side-saddle)
    } else {
      H.holder.position.set(p.x, this.W.surf.height(p.x, p.z) + (p.liftY || 0), p.z);
      H.holder.rotation.set(0, -p.yaw, 0);
    }
    // how fast they're really moving over the ground (the walk follows it, so feet never slide)
    if (!p.rideOf) { const m = s.lx === undefined ? 0 : Math.hypot(p.x - s.lx, p.z - s.lz); if (m < 3 && dt > 0) s.vel = (s.vel || 0) + (m / dt - (s.vel || 0)) * Math.min(1, dt * 8); s.lx = p.x; s.lz = p.z; }
    const [name, speed, once] = this.animFor(p, s.vel);
    // a new punch or flinch restarts its clip even if the last one was the same
    const restart = p.actId !== s.actId; s.actId = p.actId;
    H.play(name, { speed, once, fade: p.act || p.mode === 'fight' ? 0.08 : 0.25, restart: restart && !!p.act });
    // people further away animate at half rate
    // cheaper the further and the less seen: full rate close up, half rate past 30 m, a quarter off-screen;
    // shadows only from the people near you
    s.dtAcc += dt;
    const dd = Math.abs(p.x - cx) + Math.abs(p.z - cz), seen = !this.inView || dd < 8 || this.inView(p.x, p.z);
    s.k = ((s.k || 0) + 1) & 3;
    // off-screen and not close: no animation at all (it catches up the moment they're in view)
    let upd = false;
    if (seen ? (dd < 30 || (s.k & 1) === 0) : (dd < 12 && s.k === 0)) { H.mixer.update(Math.min(s.dtAcc, 0.25)); s.dtAcc = 0; upd = true; }
    // riders' hands: on the grips (the driver), round the rider's waist (a pillion astride)
    // (only on a frame the clip has just posed: the bend goes on top of the clip's pose, never on top of itself)
    if (p.rideOf && upd && (seen || dd < 12) && dd < 70) {
      const o = p.rideOf, base = /^bike/.test(o.type) ? 'bike' : /^auto/.test(o.type) ? 'auto' : 'scooter';
      const g = p.seatIdx === 0 ? GRIPS[base] : !p.sideSaddle ? [p.drvX + 0.04, (p.seatY ?? 0.2) + 0.62 + 0.22, 0.16] : null;
      if (g) {
        H.holder.updateMatrixWorld(true);
        // lean into the bars from the lower back, head up to watch the road
        const lean = p.seatIdx === 0 ? LEAN[base] : LEAN.pillion, side = _sh.set(0, 0, 1).applyQuaternion(_q);
        leanRider(H, side, lean);
        const ox = o.rx ?? o.x, oy = o.y || 0, oz = o.rz ?? o.z;
        for (const sd of [1, -1]) {
          _tg.set(g[0], g[1], g[2] * sd).applyQuaternion(_q); _tg.x += ox; _tg.y += oy; _tg.z += oz;
          _pl.set(-0.2, -0.7, sd).applyQuaternion(_q);
          ikArm(H, sd > 0 ? 'r' : 'l', _tg, _pl, 1);
        }
      }
    }
    // hands on something (a stretcher's handles, a patient): the arms reach for it, on top of whatever clip is playing
    if (p.hands && (seen || dd < 12)) {
      H.holder.updateMatrixWorld(true);
      const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw);
      p.hands.forEach((t, i) => { if (!t) return; const sd = i ? -1 : 1; _tg.set(t.x, t.y, t.z); _pl.set(-fz * sd * 0.6, -0.8, fx * sd * 0.6).normalize(); ikArm(H, sd > 0 ? 'r' : 'l', _tg, _pl, 1); });
    }
    // a constable's lathi, in the right hand
    if (p.lathi) {
      if (!s.lathi) { const g = new THREE.CylinderGeometry(0.014, 0.016, 0.95, 6); g.translate(0, -0.3, 0); s.lathi = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.7 })); }
      const hand = H.root.getObjectByName('hand_r');
      if (hand && s.lathi.parent !== hand) { hand.add(s.lathi); s.lathi.position.set(0, 0.06, 0.02); s.lathi.rotation.set(Math.PI / 2, 0, 0); s.lathi.scale.setScalar(1 / (H.root.scale.x || 1)); }
      s.lathi.visible = true;
    } else if (s.lathi) s.lathi.visible = false;
    // in the rain: the umbrella up in the right hand, held at the chest, the canopy over the head
    const umb = this.rain > 0.2 && !p.rideOf && !(p.fallen > 0) && !p.act && p.mode !== 'fight' && dd < 60 && (seen || dd < 12) && hasUmbrella(p);
    if (umb) {
      if (!s.umb) { s.umb = new THREE.Mesh(umbrellaGeo(0), umbrellaMat()); s.umb.castShadow = true; this.scene.add(s.umb); }
      if (s.umbFor !== p) { s.umbFor = p; s.umb.material.color.setHex(umbrellaColor(p)); s.umb.geometry = umbrellaGeo(umbrellaKind(p)); }
      H.holder.updateMatrixWorld(true);
      const up = H.root.getObjectByName('upperarm_r'), hand = H.root.getObjectByName('hand_r');
      if (up && hand) {
        const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), rx = -fz, rz = fx;
        up.getWorldPosition(_sh);
        _tg.set(_sh.x + fx * 0.22 - rx * 0.12, _sh.y - 0.26, _sh.z + fz * 0.22 - rz * 0.12);
        _pl.set(rx * 0.6, -0.8, rz * 0.6).normalize();
        ikArm(H, 'r', _tg, _pl, 1);
        hand.getWorldPosition(_hd);
        s.umb.position.copy(_hd);
        // tipped a touch into the walk (and the wind)
        s.umb.rotation.set(0, 0, 0); s.umb.rotateOnWorldAxis(_pl.set(rx, 0, rz), (p.v || 0) > 0.3 ? -0.12 : -0.04);
        s.umb.visible = true;
      }
    } else if (s.umb) s.umb.visible = false;
    const sh = dd < 22;
    if (s.sh !== sh) { s.sh = sh; H.root.traverse(o => { if (o.isMesh) o.castShadow = sh; }); }
    const vis = seen || dd < 12;
    if (vis !== H.holder.visible) { H.holder.visible = vis; if (vis) { if (!H.holder.parent) this.scene.add(H.holder); } else if (H.holder.parent) this.scene.remove(H.holder); }
  }
}
