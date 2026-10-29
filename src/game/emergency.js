// 108 and 100: when someone's down, a vehicle's burning or there's been a bad crash, help comes. An ambulance (a
// white van, red stripe, flashing lights, siren) is sent from a few hundred metres off, drives there through the
// traffic (cars pull over), stops, the paramedics load whoever's down (to Sassoon) and it leaves. For a death or
// a blast a police Bolero comes too, parks across the scene, and stays a while.
import * as THREE from 'three';
import { Vehicle, specOf } from '../vehicles/vehicle.js';
import { clamp, wrapAngle } from '../core/util.js';

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
  spawn(type, x, z, victim) {
    const G = this.g, W = G.W, P = G.player;
    if (this.list.length >= 3 || G.state === 'title') return;
    // start on a road 220–360 m from the scene, out of your view
    let st = null;
    for (let k = 0; k < 30 && !st; k++) {
      const a = Math.random() * 6.283, r = 220 + Math.random() * 140, n = W.graph.nearest(x + Math.cos(a) * r, z + Math.sin(a) * r, 60, (e) => e.rank >= 3);
      if (!n) continue;
      const t = W.graph.at(n.e, Math.max(0, Math.min(n.e.len, n.s)));
      if (G.inView && G.inView(t[0], t[1]) && Math.hypot(t[0] - P.x, t[1] - P.z) < 200) continue;
      st = { x: t[0], z: t[1], th: Math.atan2(t[3], t[2]) };
    }
    if (!st) return;
    const amb = type === 'ambulance';
    const v = new Vehicle(W, G.scene, G.vmats, amb ? 'tempo' : 'suv', amb ? [0.95, 0.95, 0.93] : [0.93, 0.93, 0.95]);
    v.reset(st.x, st.z, st.th); v.y = W.surf.height(st.x, st.z);
    v.spec = { ...specOf(amb ? 'tempo' : 'suv'), acc: 3.6, vTop: 22, mass: 30000 };
    // lights: a bar on the roof, red and blue (the ambulance gets a red stripe down the side too)
    const lg = new THREE.BoxGeometry(0.22, 0.12, 0.5), y = amb ? 2.35 : 1.95;
    const r = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })), b = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: amb ? 0xff6060 : 0x2050ff, toneMapped: false }));
    r.position.set(0.2, y, 0.3); b.position.set(0.2, y, -0.3); v.tilt.add(r, b);
    if (amb) for (const sd of [1, -1]) { const s = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 0.02), new THREE.MeshBasicMaterial({ color: 0xc81e1e })); s.position.set(-0.1, 1.05, sd * 0.79); v.tilt.add(s); }
    const R = { type, v, r, b, x, z, victim, state: 'go', t: 0, routeT: 0, route: null, stuckT: 0 };
    G.traffic.extra = G.traffic.extra || []; G.traffic.extra.push(v.agent);
    this.list.push(R);
  }
  update(dt) {
    const G = this.g, P = G.player;
    let siren = 0, pan = 0;
    for (const R of this.list) {
      const v = R.v; R.t += dt;
      const flash = Math.floor(R.t * 6) % 2 === 0;
      R.r.visible = R.state !== 'gone' && flash; R.b.visible = R.state !== 'gone' && !flash;
      let tx = R.x, tz = R.z, want = 16;
      const d = Math.hypot(v.x - R.x, v.z - R.z);
      if (R.state === 'go' && d < 14) { R.state = 'scene'; R.t = 0; }
      if (R.state === 'scene') {
        want = 0;
        if (R.type === 'ambulance' && R.t > 7 && R.victim && !R.loaded) {
          R.loaded = true; const q = R.victim, i = G.people.list.indexOf(q);
          if (i >= 0) { if (q.body) q.body.release(); G.people.list.splice(i, 1); }
          if (Math.hypot(P.x - v.x, P.z - v.z) < 40) G.hud.toast(q.corpse ? 'Taken away' : 'Taken to Sassoon', q.corpse ? 'The ambulance takes the body. Police will want to know who did it' : 'The paramedics load them into the ambulance', 'info', 3);
        }
        if (R.t > (R.type === 'police' ? 45 : 14)) { R.state = 'leave'; R.t = 0; const a = Math.random() * 6.283; R.lx = v.x + Math.cos(a) * 400; R.lz = v.z + Math.sin(a) * 400; }
      }
      if (R.state === 'leave') { tx = R.lx; tz = R.lz; want = 13; if (R.t > 50 || (Math.hypot(v.x - P.x, v.z - P.z) > 180 && !(G.inView && G.inView(v.x, v.z)))) R.state = 'gone'; }
      if (R.state === 'gone') continue;
      this.drive(R, tx, tz, want, dt);
      if (R.state !== 'scene' || R.type === 'police') { const dd = Math.hypot(v.x - P.x, v.z - P.z); const lv = clamp(1.3 - dd / 220, 0, 1); if (lv > siren) { siren = lv; pan = clamp((v.x - P.x) / 80, -1, 1); G.emSirenAt = { x: v.x, z: v.z }; } }
    }
    for (const R of this.list.filter(q => q.state === 'gone')) { R.v.root.parent && R.v.root.parent.remove(R.v.root); const ex = G.traffic.extra || []; const k = ex.indexOf(R.v.agent); if (k >= 0) ex.splice(k, 1); }
    this.list = this.list.filter(q => q.state !== 'gone');
    G.emSiren = siren; G.emPan = pan;
  }
  // like the marshals: follow a road route, weave round what's blocking, cars ahead pull over for the siren
  drive(R, tx, tz, want, dt) {
    const G = this.g, W = G.W, v = R.v;
    R.routeT -= dt;
    if (R.routeT <= 0) {
      R.routeT = 1.5; R.route = null;
      const a = W.graph.nearest(v.x, v.z, 40), b = W.graph.nearest(tx, tz, 60);
      if (a && b) { const r = W.graph.route(a, b, true); if (r) R.route = W.graph.routePolyline(r, a, b); }
    }
    let ax = tx, az = tz;
    if (R.route && R.route.length >= 4 && Math.hypot(v.x - tx, v.z - tz) > 25) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < R.route.length; i += 2) { const q = (R.route[i] - v.x) ** 2 + (R.route[i + 1] - v.z) ** 2; if (q < bd) { bd = q; bi = i; } }
      const look = Math.min(R.route.length - 2, bi + 2 * Math.max(1, Math.round((8 + Math.abs(v.v) * 0.6) / 8)));
      ax = R.route[look]; az = R.route[look + 1];
    }
    const hx = Math.cos(v.th), hz = Math.sin(v.th);
    if ((R.yieldT = (R.yieldT || 0) - dt) <= 0 && R.state !== 'scene') {
      R.yieldT = 0.5;
      G.traffic.near(v.x + hx * 14, v.z + hz * 14, 16, (o) => { if (!o.T || o.jc || o.isPlayer) return; const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz; if (al < 0 || al > 30) return; const side = -rx * hz + rz * hx; o.latT = o.lat + (side > 0 ? 1 : -1) * 1.4; o.v = Math.min(o.v, 3); });
    }
    const diff = wrapAngle(Math.atan2(az - v.z, ax - v.x) - v.th);
    const inp = { throttle: 0, brake: 0, steer: clamp(diff * 2.2, -1, 1), handbrake: false };
    if (v.v < want) inp.throttle = Math.abs(diff) < 0.5 ? 1 : 0.55;
    if (v.v > want + 1.5 || (Math.abs(diff) > 1.1 && v.v > 6) || want === 0) { inp.brake = 1; inp.throttle = 0; }
    if (inp.throttle > 0.3 && Math.abs(v.v) < 0.4) R.stuckT += dt; else R.stuckT = Math.max(0, R.stuckT - dt);
    if (R.stuckT > 2.5) { R.ghost = 2; R.stuckT = 0; }
    R.ghost = (R.ghost || 0) - dt;
    v.update(dt, inp, R.ghost > 0 ? null : G.traffic);
  }
}
