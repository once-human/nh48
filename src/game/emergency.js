// 108 and 100: when someone's down, a vehicle's burning or there's been a bad crash, help comes. An ambulance (a
// white van, red stripe, flashing lights, siren) is sent from a few hundred metres off, drives there through the
// traffic (cars pull over), stops, the paramedics load whoever's down (to Sassoon) and it leaves. For a death or
// a blast a police Bolero comes too, parks across the scene, and stays a while.
import * as THREE from 'three';
import { Vehicle, specOf } from '../vehicles/vehicle.js';
import { clamp, wrapAngle } from '../core/util.js';
import { buildAmbulance, buildPoliceJeep } from '../vehicles/emodels.js';

const th0 = (st) => st.th;
export class Emergency {
  constructor(G) { this.g = G; this.list = []; this.cool = 0; }
  // called by the brain when something happens
  dispatch(kind, x, z, victim) {
    const G = this.g;
    if (this.list.length >= 3 || !G.W.graph) return;
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
    v.tilt.add(md.group);
    v.spec = { ...specOf(amb ? 'tempo' : 'suv'), acc: 3.2, vTop: 19, mass: amb ? 3200 : 2100, L: md.dims.L, W: md.dims.W };
    const n = Math.max(1, Math.round(md.dims.L / md.dims.W));
    v.circles = []; for (let k = 0; k < n; k++) v.circles.push([-md.dims.L / 2 + md.dims.W / 2 + (md.dims.L - md.dims.W) * k / (n - 1), md.dims.W / 2 + 0.04]);
    v.agent.L = md.dims.L; v.agent.W = md.dims.W;
    const light = new THREE.PointLight(0xff2020, 0, 22, 2); light.position.set(0.5, 3, 0); v.tilt.add(light);
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
    let siren = 0, pan = 0;
    for (const R of this.list) {
      const v = R.v; R.t += dt;
      // the bar: red and blue in turns, the off lenses showing between
      const flash = Math.floor(R.t * 6) % 2 === 0, Lg = R.md.lights;
      Lg.red.visible = flash; Lg.redOff.visible = !flash; Lg.blue.visible = !flash; Lg.blueOff.visible = flash;
      if (Lg.red2) { Lg.red2.visible = !flash; Lg.red2Off.visible = flash; }
      // wheels roll and the fronts steer; the crew breathe only when you're near enough to see
      for (const w of R.md.wheels) { w.spin.rotation.z -= (v.v || 0) * dt / w.r; if (w.front) w.steer.rotation.y = -(v.steer || 0); }
      const near = Math.hypot(v.x - P.x, v.z - P.z) < 70;
      if (near) for (const c of R.crew) if (c.H.holder.visible) c.H.mixer.update(dt);
      this.crewOut(R);
      const night = G.sky && G.sky.state ? G.sky.state.night : 0;
      R.light.intensity = night > 0.2 ? 40 * night : 0; R.light.color.setHex(flash ? 0xff2020 : (R.type === 'police' ? 0x2050ff : 0xff6060));
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
      if (R.state !== 'scene' || R.type === 'police') { const dd = Math.hypot(v.x - P.x, v.z - P.z); const lv = clamp(1.3 - dd / 220, 0, 1); if (lv > siren) { siren = lv; pan = clamp((v.x - P.x) / 80, -1, 1); G.emSirenAt = { x: v.x, z: v.z }; } }
    }
    for (const R of this.list.filter(q => q.state === 'gone')) { this.crewIn(R); for (const c of R.crew) c.H.dispose && c.H.dispose(); R.v.root.parent && R.v.root.parent.remove(R.v.root); const ex = G.traffic.extra || []; const k = ex.indexOf(R.v.agent); if (k >= 0) ex.splice(k, 1); }
    this.list = this.list.filter(q => q.state !== 'gone');
    G.emSiren = siren; G.emPan = pan;
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
    const M = R.medics, mid = { x: (M[0].x + (M[1] || M[0]).x) / 2, z: (M[0].z + (M[1] || M[0]).z) / 2 };
    // the two walk side by side, the stretcher between them; one at each end when carrying
    const walk = (tx, tz, sp, pair) => {
      let done = true;
      M.forEach((p, i) => {
        const dx = tx - mid.x, dz = tz - mid.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
        const ox = pair ? ux * (i ? -1.05 : 1.05) : -uz * (i ? 0.5 : -0.5), oz = pair ? uz * (i ? -1.05 : 1.05) : ux * (i ? 0.5 : -0.5);
        const gx = tx + ox, gz = tz + oz, ex = gx - p.x, ez = gz - p.z, e = Math.hypot(ex, ez);
        if (e > 0.15) { const st = Math.min(e, sp * dt); p.x += ex / e * st; p.z += ez / e * st; p.v = sp; p.yaw = Math.atan2(uz, ux); p.anim = null; done = false; }
        else { p.v = 0; }
      });
      return done;
    };
    if (q) { q.fallen = Math.max(q.fallen, 999); }
    if (R.ph === 'out') {
      if (q && walk(q.x, q.z, 1.6, false)) { R.ph = 'treat'; R.pt = 0; for (const p of M) { p.anim = 'crouch'; p.yaw = Math.atan2(q.z - p.z, q.x - p.x); } }
      R.str.position.set(mid.x, 0.35, mid.z);
    } else if (R.ph === 'treat') {
      R.pt += dt;
      if (R.pt > 6) { R.ph = 'carry'; for (const p of M) p.anim = null; if (Math.hypot(P.x - v.x, P.z - v.z) < 50) G.hud.toast(q && q.corpse ? 'Taken away' : 'Taken to Sassoon', q && q.corpse ? 'They cover the body and lift it. Police will want to know who did it' : 'The paramedics lift them onto the stretcher', 'info', 3); }
    } else if (R.ph === 'carry') {
      const arrived = walk(rear.x, rear.z, 1.1, true);
      const yaw = Math.atan2(rear.z - mid.z, rear.x - mid.x);
      R.str.position.set(mid.x, 0.78, mid.z); R.str.rotation.set(0, -yaw, 0);
      if (q) { q.x = mid.x; q.z = mid.z; q.liftY = 0.8; q.yaw = yaw; }
      if (arrived || Math.hypot(mid.x - rear.x, mid.z - rear.z) < 0.6) {
        R.ph = 'loaded';
        if (q) { const i = G.people.list.indexOf(q); if (i >= 0) { if (q.body) q.body.release(); G.people.list.splice(i, 1); } }
        R.str.parent && R.str.parent.remove(R.str); R.str = null;
        this.crewIn(R); R.medics = null;
        G.later(2, () => { if (R.state === 'scene') this.leave(R); });
      }
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
  // driving like a trained driver with a siren: on the route, keeping left in the lane, slowing for bends, weaving
  // round what's stopped, braking for people, traffic ahead pulling over; never through anything (blocked: back up
  // and turn, like a person would)
  drive(R, tx, tz, want, dt) {
    const G = this.g, W = G.W, v = R.v;
    R.routeT -= dt;
    if (R.routeT <= 0) {
      R.routeT = 1.5; R.route = null;
      const a = W.graph.nearest(v.x, v.z, 40), b = W.graph.nearest(tx, tz, 60);
      if (a && b) { const r = W.graph.route(a, b, true); if (r) R.route = W.graph.routePolyline(r, a, b); }
    }
    let ax = tx, az = tz, bendAhead = 0;
    const hx = Math.cos(v.th), hz = Math.sin(v.th);
    if (R.route && R.route.length >= 4 && Math.hypot(v.x - tx, v.z - tz) > 20) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < R.route.length; i += 2) { const q = (R.route[i] - v.x) ** 2 + (R.route[i + 1] - v.z) ** 2; if (q < bd) { bd = q; bi = i; } }
      const look = Math.min(R.route.length - 2, bi + 2 * Math.max(1, Math.round((7 + Math.abs(v.v) * 0.7) / 8)));
      ax = R.route[look]; az = R.route[look + 1];
      // keep left of the road's middle (Indian roads), a car's width over
      const sx = R.route[Math.min(R.route.length - 2, look + 2)] - ax, sz = R.route[Math.min(R.route.length - 1, look + 3)] - az, sl = Math.hypot(sx, sz) || 1;
      ax += (sz / sl) * 1.6; az += (-sx / sl) * 1.6;
      // how sharp the road turns ahead: slow down for it
      const far = Math.min(R.route.length - 2, look + 6);
      bendAhead = Math.abs(wrapAngle(Math.atan2(R.route[far + 1] - az, R.route[far] - ax) - v.th));
    }
    // what's in the way ahead: weave to a side gap, else wait behind it; people on the road: stop
    let block = 99, off = 0;
    const blocked = (lat) => {
      let b = 99;
      G.traffic.near(v.x + hx * 8, v.z + hz * 8, 11, (o) => {
        if (o === v.agent || (!o.T && !o.parked)) return;
        const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz, ac = -rx * hz + rz * hx, w = (o.T ? o.T.W : o.W || 1.8) / 2 + (R.md.dims.W / 2) + 0.3;
        if (al > 1 && al < 16 && Math.abs(ac - lat) < w) b = Math.min(b, al);
      });
      for (const p of G.people.list) { if (!p.onRoad && !(p.fallen > 0)) continue; const rx = p.x - v.x, rz = p.z - v.z, al = rx * hx + rz * hz, ac = -rx * hz + rz * hx; if (al > 1 && al < 12 && Math.abs(ac - lat) < 1.6) b = Math.min(b, al); }
      return b;
    };
    if ((R.scanT = (R.scanT || 0) - dt) <= 0) {
      R.scanT = 0.2; block = blocked(0); R.block = block; R.off = 0;
      if (block < 14) for (const c of [2.2, -2.2, 3.4, -3.4]) if (blocked(c) > 15) { R.off = c; break; }
    }
    block = R.block ?? 99; off = R.off || 0;
    ax += -hz * off; az += hx * off;
    if ((R.yieldT = (R.yieldT || 0) - dt) <= 0 && R.state !== 'scene') {
      R.yieldT = 0.5;
      G.traffic.near(v.x + hx * 16, v.z + hz * 16, 18, (o) => { if (!o.T || o.jc || o.isPlayer) return; const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz; if (al < 0 || al > 34) return; const side = -rx * hz + rz * hx; o.latT = o.lat + (side > 0 ? 1 : -1) * 1.4; o.v = Math.min(o.v, 3); });
    }
    const diff = wrapAngle(Math.atan2(az - v.z, ax - v.x) - v.th);
    let target = want * (bendAhead > 0.9 ? 0.45 : bendAhead > 0.45 ? 0.7 : 1);
    if (!off && block < 14) target = Math.min(target, Math.max(0, (block - 4) * 0.8));
    const inp = { throttle: 0, brake: 0, steer: clamp(diff * 2.0, -1, 1), handbrake: false };
    if (R.revT > 0) {
      R.revT -= dt; inp.brake = 1; inp.steer = -R.revSteer; v.reverse = true;
      if (R.revT <= 0) v.reverse = false;
    } else {
      v.reverse = false;
      if (want === 0) { inp.handbrake = true; inp.brake = 1; v.update(dt, inp, G.traffic); return; }      // parked at the scene
      if (v.v < target) inp.throttle = Math.abs(diff) < 0.4 ? 0.85 : 0.5;
      if (v.v > target + 1 || target === 0) { inp.brake = v.v > target + 4 ? 1 : 0.5; inp.throttle = 0; }
      if (want > 0 && Math.abs(v.v) < 0.4 && (target < 0.5 || inp.throttle > 0.3)) R.stuckT += dt; else R.stuckT = Math.max(0, R.stuckT - dt);
      if (R.stuckT > 3) { R.stuckT = 0; R.revT = 1.3; R.revSteer = inp.steer || 1; R.block = 99; }
    }
    v.update(dt, inp, G.traffic);
  }
}
