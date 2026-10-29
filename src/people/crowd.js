// Close-up people: the nearest pedestrians and the traffic police are drawn as animated, dressed
// humans (HumanKit); everyone further away stays a cheap instanced figure from peds.js. A small
// pool of skinned bodies is re-dressed and handed from person to person as you move.
import * as THREE from 'three';
import { clamp, RNG } from '../core/util.js';

const RANGE = 48;            // metres from the camera
const NAT = { walk: 1.25, jog: 3.0 };

// how someone walks: the office crowd walks formal at rush hour, kakus and aunties often carry the shopping
function walkFor(p, people) {
  if (p.walkClip === undefined) {
    const h = people && people.act ? people.act._h || 12 : 12, rush = (h > 8 && h < 10.5) || (h > 17 && h < 20);
    const R = (p.id % 100) / 100;
    p.walkClip = /kaku|aunty|aaji|tai/.test(p.persona || '') && R < 0.35 ? 'carry' : /kpguy|kpgirl|dada|collegegirl/.test(p.persona || '') && rush && R < 0.5 ? 'walk_formal' : 'walk';
  }
  return p.walkClip;
}
// someone standing around doesn't hold one pose: the phone, a chat, a sip of chai, arms folded, a nod
const IDLES = { young: ['phone', 'phone', 'talk', 'idle', 'yes', 'arms_folded'], old: ['idle', 'arms_folded', 'talk', 'no', 'idle'], any: ['idle', 'talk', 'phone', 'arms_folded', 'drink', 'yes'] };
function idleFor(p) {
  const now = performance.now() / 1000;
  if (!p.idleUntil || now > p.idleUntil) {
    const set = /aaji|ajoba/.test(p.persona || '') ? IDLES.old : /college|kp|dada|tai/.test(p.persona || '') ? IDLES.young : IDLES.any;
    p.idleNow = p.idle === 'phone' && Math.random() < 0.5 ? 'phone' : set[Math.floor(Math.random() * set.length)];
    p.idleUntil = now + 6 + Math.random() * 10;
  }
  return p.idleNow;
}
export class Crowd {
  constructor(people, kit, scene, W, quality) {
    this.people = people; this.kit = kit; this.scene = scene; this.W = W;
    this.cap = quality.name === 'lite' ? 10 : quality.name === 'low' ? 15 : quality.name === 'med' ? 28 : 40; this.range = quality.crowdRange || RANGE;
    this.pool = [];
    this.t = 0;
    // build the pool up front: creating a skinned body mid-game is a visible hitch
    if (kit) { for (let i = 0; i < Math.ceil(this.cap * 0.65); i++) this.makeSkin(false); for (let i = 0; i < Math.ceil(this.cap * 0.45); i++) this.makeSkin(true); }
  }
  setQuality(q) { this.cap = q.name === 'lite' ? 10 : q.name === 'low' ? 15 : q.name === 'med' ? 28 : 40; this.range = q.crowdRange || RANGE; }
  makeSkin(female) {
    const kit = this.kit;
    const look = kit.randomLook(new RNG(this.pool.length + 1), { female });
    const H = kit.create(look);
    H.holder.visible = false;
    this.scene.add(H.holder);
    const accs = [];
    H.root.traverse(o => { if (o.isSkinnedMesh && !o.name.startsWith('body')) accs.push(o); });
    const s = { H, female, p: null, accs, dtAcc: 0 };
    s.release = () => { if (s.p) s.p.body = null; s.p = null; H.holder.visible = false; };
    this.pool.push(s);
    return s;
  }
  dress(s, look) {
    this.kit.applyLook(s.H, look);
  }

  update(dt, cx, cz) {
    if (!this.kit) return;
    this.t -= dt;
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
        const seats = two ? [[0, 0, false]] : [[0.32, 0, false]];
        if (pil) seats.push([o.type === 'scooterP' ? -0.36 : -0.3, 0, o.type === 'scooterP']);
        o._riders = seats.map(([a, b, side], i) => {
          const female = i === 1 ? (side ? Math.random() < 0.75 : Math.random() < 0.2) : Math.random() < 0.15;
          const look = this.kit.randomLook(rng, { female, helmet: two && i === 0 && o.type !== 'scooterP' });
          if (!two) { look.top = look.top.setRGB(0.42, 0.36, 0.22); look.bottom = look.top.clone().multiplyScalar(0.9); }
          return { id: (o.id || 0) * 4 + i + 1e7, look, female, rideOf: o, seat: [a, b], side, x: o.x, z: o.z, yaw: 0, v: 0, mode: 'ride', persona: female ? 'tai' : 'dada' };
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
    if (p.rideOf) return [p.side ? 'sit' : 'drive', 1];
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
    const y = p.rideOf ? (p.y || 0) + (p.side ? 0.38 : 0) : this.W.surf.height(p.x, p.z);
    H.holder.position.set(p.x, y, p.z);
    H.holder.rotation.set(0, -p.yaw + (p.side ? Math.PI / 2 : 0), 0);
    const [name, speed, once] = this.animFor(p);
    // a new punch or flinch restarts its clip even if the last one was the same
    const restart = p.actId !== s.actId; s.actId = p.actId;
    H.play(name, { speed, once, fade: p.act || p.mode === 'fight' ? 0.08 : 0.25, restart: restart && !!p.act });
    // people further away animate at half rate
    s.dtAcc += dt;
    const far = Math.abs(p.x - cx) + Math.abs(p.z - cz) > 30;
    if (!far || s.flip) { H.mixer.update(s.dtAcc); s.dtAcc = 0; }
    s.flip = !s.flip;
  }
}
