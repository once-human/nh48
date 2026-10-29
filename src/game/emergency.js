// 108 and 100: when someone's down, a vehicle's burning or there's been a bad crash, help comes. An ambulance (a
// white van, red stripe, flashing lights, siren) is sent from a few hundred metres off, drives there through the
// traffic (cars pull over), stops, the paramedics load whoever's down (to Sassoon) and it leaves. For a death or
// a blast a police Bolero comes too, parks across the scene, and stays a while.
import * as THREE from 'three';
import { Vehicle, specOf, makeService } from '../vehicles/vehicle.js';
import { clamp, wrapAngle } from '../core/util.js';
import { buildAmbulance, buildPoliceJeep } from '../vehicles/emodels.js';
import { Driver } from '../vehicles/driver.js';

const th0 = (st) => st.th;
export class Emergency {
  constructor(G) { this.g = G; this.list = []; this.cool = 0; G.later && G.later(1.5, () => this.prewarm()); }
  // build and compile the ambulance, the jeep and a constable once, at the start (the first one used to freeze the game)
  prewarm() {
    const G = this.g; if (!G.renderer || this._warm) return; this._warm = true;
    try {
      const g = new THREE.Group(); g.position.set(G.camera.position.x, -40, G.camera.position.z);
      g.add(buildAmbulance().group, buildPoliceJeep().group);
      if (G.W.kit) { const H = G.W.kit.create(G.W.kit.randomLook({ next: Math.random, chance: (q) => Math.random() < q, range: (a, b) => a + Math.random() * (b - a), pick: (a) => a[0], int: (a) => a, weighted: null }, { role: 'police' })); g.add(H.holder); this._warmH = H; }
      G.scene.add(g); G.renderer.compile(G.scene, G.camera);
      G.later(0.5, () => { G.scene.remove(g); });
    } catch (e) { /* not critical */ }
  }
  // called by the brain when something happens
  dispatch(kind, x, z, victim) {
    const G = this.g;
    if (this.list.length >= 3 || !G.W.graph) return;
    if (G.vb && (kind === 'down' || kind === 'blast')) G.later(2, () => G.vb.radio(4, x, z));
    if (kind === 'down' || kind === 'blast') this.later(kind === 'blast' ? 10 : 18 + Math.random() * 12, () => this.spawn('ambulance', x, z, victim));
    if ((victim && victim.corpse) || kind === 'blast') this.later(26 + Math.random() * 14, () => this.spawn('police', x, z, null));
  }
  later(s, f) { this.g.later(s, f); }
  spawn(type, x, z, victim, tries = 0) {
    const G = this.g, W = G.W, P = G.player;
    if (this.list.length >= 3 || G.state === 'title') return;
    // start on a road 220–360 m from the scene, out of your view
    // start on a road a few hundred metres off, out of your view; if the streets that far haven't loaded, closer in,
    // on any road, still out of sight
    let st = null;
    for (let k = 0; k < 60 && !st; k++) {
      const wide = k < 30, a = Math.random() * 6.283, r = wide ? 220 + Math.random() * 140 : 90 + Math.random() * 120;
      const n = W.graph.nearest(x + Math.cos(a) * r, z + Math.sin(a) * r, wide ? 60 : 90, wide ? (e) => e.rank >= 3 : (e) => e.rank >= 2);
      if (!n) continue;
      const t = W.graph.at(n.e, Math.max(0, Math.min(n.e.len, n.s)));
      if (G.inView && G.inView(t[0], t[1]) && Math.hypot(t[0] - P.x, t[1] - P.z) < (wide ? 200 : 160)) continue;
      st = { x: t[0], z: t[1], th: Math.atan2(t[3], t[2]) };
    }
    if (!st) { if (tries < 6) this.later(5, () => this.spawn(type, x, z, victim, tries + 1)); return; }      // the roads aren't there yet: soon
    const amb = type === 'ambulance';
    const v = new Vehicle(W, G.scene, G.vmats, amb ? 'tempo' : 'suv', [0.95, 0.95, 0.93]);
    v.reset(st.x, st.z, th0(st)); v.y = W.surf.height(st.x, st.z);
    // its own model (a 108 van, a police jeep) in place of the stock body
    for (const c of v.tilt.children) c.visible = false;
    const md = amb ? buildAmbulance() : buildPoliceJeep();
    v.tilt.add(md.group); v.md = md;
    v.spec = { ...specOf(amb ? 'tempo' : 'suv'), acc: 3.2, vTop: 19, mass: amb ? 3200 : 2100, L: md.dims.L, W: md.dims.W };
    const n = Math.max(1, Math.round(md.dims.L / md.dims.W));
    v.circles = []; for (let k = 0; k < n; k++) v.circles.push([-md.dims.L / 2 + md.dims.W / 2 + (md.dims.L - md.dims.W) * k / (n - 1), md.dims.W / 2 + 0.04]);
    v.agent.L = md.dims.L; v.agent.W = md.dims.W; makeService(v);
    const light = null;                // (a real light here made three.js recompile every shader: the freeze when one spawned)
    // the crew, seated and fully dressed: two constables in khaki, or the 108 pilot and the EMT in navy
    const crew = [];
    if (W.kit) for (const [sx, sy, sz, role] of md.seats) {
      const rng = { next: Math.random, chance: (q) => Math.random() < q, range: (a, b) => a + Math.random() * (b - a), pick: (a) => a[Math.floor(Math.random() * a.length)], int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), weighted: null };
      const look = amb ? W.kit.randomLook(rng, { female: role === 'mate' && Math.random() < 0.35, dress: 'modern' }) : W.kit.randomLook(rng, { role: 'police' });
      if (amb) { look.top = new THREE.Color(0x24345a).convertSRGBToLinear(); look.bottom = new THREE.Color(0x1e2433).convertSRGBToLinear(); look.cut = new THREE.Vector4(0.42, 1, 0.6, 0); }
      const H = W.kit.create(look);
      H.holder.position.set(sx - 0.05, sy - 0.62, sz);
      v.tilt.add(H.holder);
      H.play(role === 'driver' ? 'drive' : 'sit');
      crew.push({ H, look, role, x: sx, z: sz });
    }
    const R = { type, v, md, light, crew, x, z, victim, state: 'go', t: 0, routeT: 0, route: null, stuckT: 0, out: [] };
    G.traffic.extra = G.traffic.extra || []; G.traffic.extra.push(v.agent);
    this.list.push(R);
  }
  update(dt) {
    const G = this.g, P = G.player;
    let siren = 0, pan = 0, amb = 0, ambAt = null;
    for (const R of this.list) {
      const v = R.v; R.t += dt;
      // the bar: red and blue in turns, the off lenses showing between
      const on = R.state === 'go' || R.state === 'scene', flash = on && Math.floor(R.t * 6) % 2 === 0, Lg = R.md.lights;
      Lg.red.visible = flash; Lg.redOff.visible = !flash; Lg.blue.visible = on && !flash; Lg.blueOff.visible = !(on && !flash);
      if (Lg.red2) { Lg.red2.visible = on && !flash; Lg.red2Off.visible = !(on && !flash); }
      // wheels roll and the fronts steer; the crew breathe only when you're near enough to see
      for (const w of R.md.wheels) { w.spin.rotation.z -= (v.v || 0) * dt / w.r; if (w.front) w.steer.rotation.y = -(v.steer || 0); }
      const near = Math.hypot(v.x - P.x, v.z - P.z) < 70;
      if (near) for (const c of R.crew) if (c.H.holder.visible) c.H.mixer.update(dt);
      this.crewOut(R);
      const night = G.sky && G.sky.state ? G.sky.state.night : 0;
      void night;
      let tx = R.x, tz = R.z, want = 14;
      const d = Math.hypot(v.x - R.x, v.z - R.z);
      // pull up beside the scene (or as close as the street lets it, if it's been stuck near it a while)
      if (d < (R.bestD ?? 1e9) - 1) { R.bestD = d; R.nearT = 0; } else R.nearT = (R.nearT || 0) + (d < 45 ? dt : 0);
      if (R.state === 'go' && (d < 16 || R.nearT > 4)) { R.state = 'scene'; R.t = 0; }
      if (R.state === 'go' && d < 60) want = 6;
      if (R.state === 'scene') {
        want = 0;
        if (R.type === 'ambulance') this.paramedics(R, dt);
        else if (R.t > 45) this.leave(R);
      }
      if (R.state === 'leave') { tx = R.lx; tz = R.lz; want = 12; if (R.t > 50 || (Math.hypot(v.x - P.x, v.z - P.z) > 180 && !(G.inView && G.inView(v.x, v.z)))) R.state = 'gone'; }
      if (R.state === 'gone') continue;
      this.drive(R, tx, tz, want, dt);
      // the siren only on the way (at the scene the lights stay on, quiet; going back it's just a vehicle)
      if (R.state === 'go') { const dd = Math.hypot(v.x - P.x, v.z - P.z), lv = clamp(1.3 - dd / 220, 0, 1);
        if (R.type === 'ambulance') { if (lv > amb) { amb = lv; ambAt = { x: v.x, z: v.z }; } }
        else if (lv > siren) { siren = lv; pan = clamp((v.x - P.x) / 80, -1, 1); G.emSirenAt = { x: v.x, z: v.z }; } }
    }
    for (const R of this.list.filter(q => q.state === 'gone')) { this.crewIn(R); for (const c of R.crew) c.H.dispose && c.H.dispose(); R.v.root.parent && R.v.root.parent.remove(R.v.root); const ex = G.traffic.extra || []; const k = ex.indexOf(R.v.agent); if (k >= 0) ex.splice(k, 1); }
    this.list = this.list.filter(q => q.state !== 'gone');
    G.emSiren = siren; G.emPan = pan;
    G.audio && G.audio.ambSiren && G.audio.ambSiren(amb, ambAt);
  }
  // at the scene the crew get out: the constables stand guard over it, the paramedics go to whoever's down and
  // kneel by them until they're loaded; when it's time to go they get back in
  crewOut(R) {
    const G = this.g, ppl = G.people, v = R.v;
    if (R.type === 'police' && R.state === 'scene' && R.t > 1.6 && !R.isOut && ppl) {
      R.isOut = true;
      const hx = Math.cos(v.th), hz = Math.sin(v.th);
      R.crew.forEach((c, i) => {
        const sd = c.z > 0 ? 1 : -1;
        const x = v.x + hx * c.x - hz * sd * 1.4, z = v.z + hz * c.x + hx * sd * 1.4;
        const p = ppl.spawnAt(c.look, x, z, R.type === 'police' ? 'kaka' : 'bhaiya');
        if (!p) return;
        c.H.holder.visible = false;
        p.fixed = false; p.crew = true; if (R.type === 'police') p.cop = true;
        const q = R.victim && !R.victim.hidden ? R.victim : null;
        if (R.type === 'ambulance' && q) {
          const a = Math.random() * 6.283;
          ppl.goTo(p, q.x + Math.cos(a) * 0.8, q.z + Math.sin(a) * 0.8, (w) => { w.mode = 'watch'; w.watch = { x: q.x, z: q.z }; w.wait = 30; w.anim = 'crouch'; w.v = 0; });
        } else {
          const a = i * 2.4 + Math.random(), tx = R.x + Math.cos(a) * 3, tz = R.z + Math.sin(a) * 3;
          ppl.goTo(p, tx, tz, (w) => { w.mode = 'watch'; w.watch = { x: R.x, z: R.z }; w.wait = 60; w.anim = null; w.v = 0; });
        }
        R.out.push(p);
      });
    }
    if (R.isOut && (R.state === 'leave' || R.state === 'gone')) this.crewIn(R);
  }
  leave(R) { const v = R.v; R.state = 'leave'; R.t = 0; const a = Math.random() * 6.283; R.lx = v.x + Math.cos(a) * 400; R.lz = v.z + Math.sin(a) * 400; }
  // the paramedics: out of the back with the stretcher, to whoever's down, kneel and treat them, lift them on,
  // carry them back, load up, doors shut, go
  paramedics(R, dt) {
    const G = this.g, ppl = G.people, v = R.v, P = G.player;
    const hx = Math.cos(v.th), hz = Math.sin(v.th), rear = { x: v.x - hx * (R.md.dims.L / 2 + 0.9), z: v.z - hz * (R.md.dims.L / 2 + 0.9) };
    const q = R.victim && G.people.list.includes(R.victim) ? R.victim : null;
    R.ph = R.ph || 'wait';
    if (R.ph === 'wait' && R.t > 1.2) {
      if (!q) { this.leave(R); return; }
      R.ph = 'out'; R.medics = [];
      R.crew.forEach((c, i) => {
        const p = ppl.spawnAt(c.look, rear.x - hz * (i ? 0.45 : -0.45), rear.z + hx * (i ? 0.45 : -0.45), 'bhaiya');
        if (!p) return;
        c.H.holder.visible = false; p.fixed = false; p.crew = true; p.ctl = true; p.mode = 'stand'; p.v = 0;
        R.medics.push(p); R.out.push(p);
      });
      R.isOut = true;
      R.str = this.stretcher(); G.scene.add(R.str);
    }
    if (!R.medics || !R.medics.length) { if (R.ph !== 'wait') this.leave(R); return; }
    const M = R.medics, A = M[0], B = M[1] || M[0];
    // the stretcher between them by its handles, carried along the way they're walking (one at each end)
    const carry = (cx, cz, yaw, y) => {
      R.str.position.set(cx, y, cz); R.str.rotation.set(0, -yaw, 0);
      const c = Math.cos(yaw), s2 = Math.sin(yaw), h = (lx, lz) => ({ x: cx + lx * c - lz * s2, y: y + 0.02, z: cz + lx * s2 + lz * c });
      A.hands = [h(1.12, 0.3), h(1.12, -0.3)]; B.hands = [h(-1.12, -0.3), h(-1.12, 0.3)];
      return [h(1.45, 0), h(-1.45, 0)];
    };
    const step = (p, gx, gz, sp, face) => { const ex = gx - p.x, ez = gz - p.z, e = Math.hypot(ex, ez); if (e > 0.1) { const st = Math.min(e, sp * dt); p.x += ex / e * st; p.z += ez / e * st; p.v = sp; } else p.v = 0; p.yaw = face ?? Math.atan2(ez, ex); p.anim = null; return e < 0.15; };
    if (q) { q.fallen = Math.max(q.fallen, 999); }
    if (R.ph === 'out' || R.ph === 'carry') {
      // the pair walk to the goal (the patient, or back to the doors) with the stretcher at the waist
      const goal = R.ph === 'out' ? { x: q ? q.x - Math.cos(R.ay || 0) * 1.6 : rear.x, z: q ? q.z - Math.sin(R.ay || 0) * 1.6 : rear.z } : rear;
      R.mid = R.mid || { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
      const ex = goal.x - R.mid.x, ez = goal.z - R.mid.z, e = Math.hypot(ex, ez), yaw = e > 0.3 ? Math.atan2(ez, ex) : (R.myaw ?? 0);
      R.myaw = R.myaw === undefined ? yaw : R.myaw + Math.atan2(Math.sin(yaw - R.myaw), Math.cos(yaw - R.myaw)) * Math.min(1, dt * 3);
      if (e > 0.25) { const st = Math.min(e, (R.ph === 'carry' ? 1.0 : 1.4) * dt); R.mid.x += ex / e * st; R.mid.z += ez / e * st; }
      const [fa, fb] = carry(R.mid.x, R.mid.z, R.myaw, 0.78);
      step(A, fa.x, fa.z, 2, R.myaw); step(B, fb.x, fb.z, 2, R.myaw);
      if (R.ph === 'carry' && q) { q.x = R.mid.x; q.z = R.mid.z; q.liftY = 0.86; q.yaw = R.myaw; }
      if (e < 0.3) {
        if (R.ph === 'out') { R.ph = 'treat'; R.pt = 0; G.vb && G.vb.medic(Math.random() < 0.5 ? 4 : 0, A, false); }
        else {
          R.ph = 'loaded';
          if (q) { const i = G.people.list.indexOf(q); if (i >= 0) { if (q.body) q.body.release(); G.people.list.splice(i, 1); } }
          R.str.parent && R.str.parent.remove(R.str); R.str = null; for (const p of M) p.hands = null;
          this.crewIn(R); R.medics = null;
          G.audio.thud && G.audio.thud(0.4); G.vb && G.vb.medic(5, A, false);
          G.later(2, () => { if (R.state === 'scene') this.leave(R); });
        }
      }
      if (R.ph === 'out' && !R.ay && q) R.ay = Math.atan2(q.z - rear.z, q.x - rear.x);
    } else if (R.ph === 'treat') {
      // the stretcher down beside them; both kneel at the patient, hands on them
      R.pt += dt;
      const yaw = R.ay || 0, c = Math.cos(yaw), s2 = Math.sin(yaw);
      R.str.position.set(q.x - c * 1.2 - s2 * 0.0, 0.22, q.z - s2 * 1.2); R.str.rotation.set(0, -yaw + Math.PI / 2, 0);
      [[A, 0.7], [B, -0.7]].forEach(([p, side]) => {
        step(p, q.x - s2 * side, q.z + c * side, 1.2, Math.atan2(q.z - p.z, q.x - p.x));
        p.anim = 'crouch'; p.hands = [{ x: q.x + (Math.random() - 0.5) * 0.02, y: (G.W.surf.height(q.x, q.z)) + 0.28, z: q.z }, { x: q.x + c * 0.25, y: G.W.surf.height(q.x, q.z) + 0.3, z: q.z + s2 * 0.25 }];
      });
      if (R.pt > 6) { R.ph = 'lift'; R.pt = 0; G.vb && G.vb.medic(3, A, false); if (Math.hypot(P.x - v.x, P.z - v.z) < 50) G.hud.toast(q && q.corpse ? 'Taken away' : 'Taken to Sassoon', q && q.corpse ? 'They cover the body and lift it. Police will want to know who did it' : 'The paramedics lift them onto the stretcher', 'info', 3); }
    } else if (R.ph === 'lift') {
      // onto the stretcher, and up: from a crouch at the handles to standing with it at the waist
      R.pt += dt; const k = Math.min(1, R.pt / 1.6), yaw = R.ay || 0;
      R.mid = { x: q.x, z: q.z }; R.myaw = yaw;
      const [fa, fb] = carry(q.x, q.z, yaw, 0.25 + 0.53 * k);
      step(A, fa.x, fa.z, 1.5, yaw); step(B, fb.x, fb.z, 1.5, yaw);
      A.anim = B.anim = k < 0.55 ? 'crouch' : null;
      q.liftY = 0.3 + 0.56 * k; q.yaw = yaw;
      if (k >= 1) { R.ph = 'carry'; G.vb && G.later(1.5, () => G.vb.medic(7, B, true)); }
    }
  }
  stretcher() {
    const g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.6 }), metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.3 });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.08, 0.56), white); g.add(bed);
    for (const z of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), metal); r.rotation.z = Math.PI / 2; r.position.set(0, -0.02, z); g.add(r); }
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.45), white); pil.position.set(0.75, 0.07, 0); g.add(pil);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.58), new THREE.MeshStandardMaterial({ color: 0xd42020 })); strap.position.set(-0.2, 0.01, 0); g.add(strap);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  crewIn(R) {
    if (!R.isOut) return;
    R.isOut = false;
    const L = this.g.people && this.g.people.list;
    for (const p of R.out) { if (p.body) p.body.release(); const i = L ? L.indexOf(p) : -1; if (i >= 0) L.splice(i, 1); }
    R.out = [];
    for (const c of R.crew) c.H.holder.visible = true;
  }
  // the driving itself: see vehicles/driver.js (route, lanes, bends, obstacles, people, getting unstuck)
  drive(R, tx, tz, want, dt) {
    const G = this.g;
    if (!R.drv) R.drv = new Driver(R.v, G, { lane: 1.6, emergency: true });
    R.drv.o.emergency = R.state === 'go';
    R.drv.goTo(tx, tz);
    R.drv.update(dt, want);
  }
}
