// Close-up people: the nearest pedestrians and the traffic police are drawn as animated, dressed
// humans (HumanKit); everyone further away stays a cheap instanced figure from peds.js. A small
// pool of skinned bodies is re-dressed and handed from person to person as you move.
import * as THREE from 'three';
import { clamp, RNG } from '../core/util.js';
import { ikArm } from './humans.js';
import { hasUmbrella, umbrellaColor, umbrellaGeo, umbrellaMat } from './umbrella.js';
const _sh = new THREE.Vector3(), _tg = new THREE.Vector3(), _pl = new THREE.Vector3(), _hd = new THREE.Vector3();
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
    this.cap = quality.name === 'lite' ? 18 : quality.name === 'low' ? 27 : quality.name === 'med' ? 50 : 72; this.range = (quality.crowdRange || RANGE) * 1.8;
    this.pool = [];
    this.t = 0;
    // build the pool up front: creating a skinned body mid-game is a visible hitch
    // a starter set up front (the rest are made as more people come close)
    const pre = Math.min(this.cap, 26);
    if (kit) { for (let i = 0; i < Math.ceil(pre * 0.65); i++) this.makeSkin(false); for (let i = 0; i < Math.ceil(pre * 0.45); i++) this.makeSkin(true); }
  }
  setQuality(q) { this.cap = q.name === 'lite' ? 18 : q.name === 'low' ? 27 : q.name === 'med' ? 50 : 72; this.range = (q.crowdRange || RANGE) * 1.8; }
  makeSkin(female) {
    const kit = this.kit;
    const look = kit.randomLook(new RNG(this.pool.length + 1), { female });
    const H = kit.create(look);
    H.holder.visible = false;
    this.scene.add(H.holder);
    const accs = [];
    H.root.traverse(o => { if (o.isSkinnedMesh && !o.name.startsWith('body')) accs.push(o); });
    const s = { H, female, p: null, accs, dtAcc: 0 };
    s.release = () => { if (s.p) s.p.body = null; s.p = null; H.holder.visible = false; if (s.umb) s.umb.visible = false; };
    this.pool.push(s);
    return s;
  }
  dress(s, look) {
    this.kit.applyLook(s.H, look);
  }

  update(dt, cx, cz) {
    if (!this.kit) return;
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
        const seats = two ? [[bike ? -0.33 : -0.35, 0, false, bike ? 0.95 : 0.8]] : [[0.31, 0, false, 0.8]];
        if (pil) seats.push([bike ? -0.62 : -0.72, 0, o.type === 'scooterP', bike ? 0.97 : 0.84]);
        o._riders = seats.map(([a, b, side, sy], i) => {
          const female = i === 1 ? (side ? Math.random() < 0.75 : Math.random() < 0.2) : Math.random() < 0.15;
          const look = this.kit.randomLook(rng, { female, helmet: two && i === 0 && o.type !== 'scooterP' });
          // dressed as the baked figure was (its shirt is the vehicle's colB, helmet / hair colC): no change of clothes up close
          if (o.colB) look.top = look.top.setRGB(o.colB[0], o.colB[1], o.colB[2]);
          if (!two) look.bottom = look.top.clone().multiplyScalar(0.9);
          else if (i === 1 && side && female) { look.bottom = look.top.clone().multiplyScalar(0.85); look.cut = look.cut.clone().set(0.3, 1, 0.9, 2); }
          if (o.colC) { if (look.acc === 'helmet') look.helmetCol = look.top.clone().setRGB(o.colC[0], o.colC[1], o.colC[2]); else if (i === 1) look.hair = look.top.clone().setRGB(o.colC[0], o.colC[1], o.colC[2]); }
          return { id: (o.id || 0) * 4 + i + 1e7, look, female, rideOf: o, seat: [a, b], seatY: sy - 0.62, sideSaddle: side, x: o.x, z: o.z, yaw: 0, v: 0, mode: 'ride', persona: female ? 'tai' : 'dada' };
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
      const R0 = this.range || RANGE, r = p.cop || p.ctl ? R0 + 14 : R0;
      // the people you can actually see come first; behind the camera only the very close
      const seen = !this.inView || d < 6 || this.inView(p.x, p.z);
      if (d < r) cand.push([d - (p.cop || p.ctl ? 12 : 0) + (seen ? 0 : 30), p]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const want = new Set(cand.slice(0, this.cap).map(c => c[1]));
    for (const s of this.pool) if (s.p && (!want.has(s.p) || s.p.hidden)) s.release();
    for (const p of want) {
      if (p.body) continue;
      const fem = !!p.look.female;
      let s = this.pool.find(q => !q.p && q.female === fem);
      if (!s && this.pool.length < this.cap + 4) s = this.makeSkin(fem);
      if (!s) continue;
      this.dress(s, p.look);
      if (p.kid) s.H.root.scale.setScalar(p.look.scale * 0.7);
      s.p = p; p.body = s;
      s.cur = null;
      s.H.holder.visible = true;
    }
  }
  animFor(p) {
    if (p.rideOf) return [p.sideSaddle ? 'sit' : 'drive', 1];
    if (p.fallen > 0) return p.ko ? [p.fallen > 1.6 ? 'death' : 'getup', 1, true] : [p.fallen > 1.3 ? 'knockback' : 'getup', 1, true];
    if (p.act) return [p.act.clip, p.act.speed || 1, true];
    if (p.mode === 'fight') return p.v > 2.2 ? ['jog', clamp(p.v / NAT.jog, 0.7, 1.4)] : p.v > 0.2 ? ['walk', 1.3] : [p.fightT < 1.6 ? 'no' : 'idle', 1.3];
    if (p.anim) return [p.anim, 1];
    if (p.react > 0 && p.reactAnim) return [p.reactAnim, 1, p.reactAnim === 'hit'];
    if (p.angry > 0) return ['no', 1];
    if (p.pax) return ['wave', 1];
    if (p.cop) return [(performance.now() / 1000 + p.id % 17) % 14 < 4 ? 'wave' : 'arms_folded', 1];
    if (p.mode === 'stand' || p.mode === 'watch' || p.v < 0.15) return [idleFor(p), 1];
    if (p.v > 2.2) return ['jog', clamp(p.v / NAT.jog, 0.7, 1.4)];
    return [walkFor(p, this.people), clamp(p.v / NAT.walk, 0.7, 1.4)];
  }
  drive(s, dt, cx, cz) {
    const p = s.p, H = s.H;
    // riders follow their vehicle every frame (not only when bodies are handed out), so they ride smoothly with it
    if (p.rideOf) { const o = p.rideOf, hx = o.hx ?? Math.cos(o.yaw || 0), hz = o.hz ?? Math.sin(o.yaw || 0);
      p.x = o.x + hx * p.seat[0] - hz * p.seat[1]; p.z = o.z + hz * p.seat[0] + hx * p.seat[1]; p.yaw = Math.atan2(hz, hx); p.y = o.y || 0; }
    const y = p.rideOf ? (p.y || 0) + (p.seatY ?? 0.2) + (p.sideSaddle ? 0.04 : 0) : this.W.surf.height(p.x, p.z);
    H.holder.position.set(p.x, y, p.z);
    H.holder.rotation.set(0, -p.yaw + (p.rideOf && p.sideSaddle ? Math.PI / 2 : 0), 0);   // (p.side is a pedestrian's side of the road, not side-saddle)
    const [name, speed, once] = this.animFor(p);
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
    if (seen ? (dd < 30 || (s.k & 1) === 0) : (dd < 12 && s.k === 0)) { H.mixer.update(Math.min(s.dtAcc, 0.25)); s.dtAcc = 0; }
    // in the rain: the umbrella up in the right hand, held at the chest, the canopy over the head
    const umb = this.rain > 0.2 && !p.rideOf && !(p.fallen > 0) && !p.act && p.mode !== 'fight' && dd < 60 && (seen || dd < 12) && hasUmbrella(p);
    if (umb) {
      if (!s.umb) { UGEO = UGEO || umbrellaGeo(); s.umb = new THREE.Mesh(UGEO, umbrellaMat()); s.umb.castShadow = true; this.scene.add(s.umb); }
      if (s.umbFor !== p) { s.umbFor = p; s.umb.material.color.setHex(umbrellaColor(p)); }
      H.holder.updateMatrixWorld(true);
      const up = H.root.getObjectByName('upperarm_r'), hand = H.root.getObjectByName('hand_r');
      if (up && hand) {
        const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), rx = -fz, rz = fx;
        up.getWorldPosition(_sh);
        _tg.set(_sh.x + fx * 0.24 - rx * 0.12, _sh.y - 0.2, _sh.z + fz * 0.24 - rz * 0.12);
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
    H.holder.visible = seen || dd < 12;
  }
}
