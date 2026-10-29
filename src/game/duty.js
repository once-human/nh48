// On duty: drive an ambulance or a police vehicle and you get its calls.
//  · 108: someone collapsed or hurt somewhere in the city. Siren on, get there, stop beside them (they're loaded),
//    then get them to the nearest real hospital, fast and smooth: the pay depends on both.
//  · Police: a chain snatcher fleeing on a scooter. Chase him down and stay alongside until he goes down; he's
//    arrested and you're paid.
// Traffic ahead pulls over while your siren is on.
import { Vehicle, specOf } from '../vehicles/vehicle.js';
import { wrapAngle, clamp } from '../core/util.js';
import { Driver } from '../vehicles/driver.js';
import FAMOUS from '../world/famous.json';

const HOSPITALS = ['Sassoon Hospital', 'KEM Hospital', 'Ruby Hall Clinic', 'Jehangir Hospital', 'Deenanath Mangeshkar Hospital', 'Bharati Vidyapeeth'];
const PAY = { amb: 650, pol: 800 };

export class Duty {
  constructor(G) { this.g = G; this.call = null; this.waitT = 6; this.streak = 0; }
  get kind() { const v = this.g.player.cur; return this.g.player.onFoot || !v ? null : v.serviceKind || null; }
  update(dt) {
    const G = this.g, P = G.player, k = this.kind;
    if (!k) { if (this.call) this.end(null); this.waitT = 6; G.dutySiren = 0; return; }
    // your siren (H): on or off, call or no call; traffic ahead pulls over while it's on
    const v0 = P.cur, sOn = !!v0.sirenOn && Math.abs(v0.v) > 0.5;
    if (k === 'amb') G.audio.ambSiren && G.audio.ambSiren(v0.sirenOn ? 1 : 0, { x: v0.x, z: v0.z });
    else { G.dutySiren = v0.sirenOn ? 1 : 0; if (G.free) { G.audio.sirenAt = { x: v0.x, z: v0.z }; G.audio.siren(v0.sirenOn ? 1 : 0, 0); } }
    if (sOn && (this.yT = (this.yT || 0) - dt) <= 0) {
      this.yT = 0.5; const hx = Math.cos(v0.th), hz = Math.sin(v0.th);
      G.traffic.near(v0.x + hx * 14, v0.z + hz * 14, 16, (o) => { if (!o.T || o.jc || o.isPlayer || o.service) return; const rx = o.x - v0.x, rz = o.z - v0.z, al = rx * hx + rz * hz; if (al < 0 || al > 30) return; const sd = -rx * hz + rz * hx; o.latT = o.lat + (sd > 0 ? 1 : -1) * 1.4; o.v = Math.min(o.v, 3); });
    }
    // calls only come to a vehicle you signed in for; a stolen one gets nothing (unless there's a patient in the back)
    if (!this.call) { if (P.cur.legit && (this.waitT -= dt) <= 0) this.newCall(k); return; }
    const C = this.call; C.t += dt;
    const v = P.cur;
    if (k === 'amb') this.ambTick(C, dt); else this.polTick(C, dt);
    if (C.limit && C.t > C.limit) { G.hud.toast('Too late', C.lateMsg || 'The call has gone to someone else', 'bad', 3.2); this.end(false); }
  }
  // a road point 250–700 m off, out of sight
  spot(minR = 250, maxR = 700) {
    const G = this.g, P = G.player, W = G.W;
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * 6.283, r = minR + Math.random() * (maxR - minR), n = W.graph.nearest(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r, 60, e => e.rank >= 2);
      if (!n) continue;
      const t = W.graph.at(n.e, n.s); return { x: t[0], z: t[1], e: n.e, s: n.s, th: Math.atan2(t[3], t[2]), name: n.e.name || 'a side road' };
    }
    return null;
  }
  // you've stolen an ambulance with someone already in the back: get them to a hospital
  patientAboard() {
    const G = this.g, v = G.player.cur || G.player;
    const hs = HOSPITALS.map(n => FAMOUS.find(f => f.name === n)).filter(Boolean).sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z));
    const h = hs[0] || { x: v.x, z: v.z, name: 'Sassoon Hospital' };
    this.call = { kind: 'amb', stage: 'hosp', t: 0, h, crit: true, dmg0: 0, limit: 60 + Math.hypot(h.x - v.x, h.z - v.z) / 8, stolen: true, lateMsg: 'You took too long. They didn’t make it' };
    G.setWaypoint({ x: h.x, z: h.z, name: h.name, gig: true });
  }
  newCall(k) {
    const G = this.g, S = this.spot(k === 'amb' ? 250 : 180, k === 'amb' ? 750 : 450);
    if (!S) { this.waitT = 4; return; }
    if (k === 'amb') {
      // the patient on the kerb, a couple of people round them
      const side = Math.random() < 0.5 ? 1 : -1, lat = side * (S.e.w / 2 + 0.8);
      const x = S.x + -Math.sin(S.th) * lat, z = S.z + Math.cos(S.th) * lat;
      const kit = G.W.kit, look = kit ? kit.randomLook({ next: Math.random, chance: (q) => Math.random() < q, range: (a, b) => a + Math.random() * (b - a), pick: (a) => a[Math.floor(Math.random() * a.length)], int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), weighted: null }, {}) : null;
      const p = look && G.people.spawnAt(look, x, z, 'kaka'); if (!p) { this.waitT = 4; return; }
      const crit = Math.random() < 0.4;
      p.fallen = 1e6; p.ko = true; p.unconscious = true; p.inj = { sev: crit ? 'critical' : 'ko', t: 0 }; p.crew = true; p.duty = true;
      G.people.gather && G.people.gather(x, z, 3, 'vehicle');
      if (crit && G.blood) G.blood.spill(x, z, 0.6, 40);
      this.call = { kind: 'amb', stage: 'pickup', t: 0, p, x, z, limit: crit ? 170 : 260, crit, lateMsg: crit ? 'They didn’t make it' : 'Another ambulance got there first' };
      G.setWaypoint({ x, z, name: '108: patient', gig: true });
      G.hud.toast('108 call', `${crit ? 'Accident victim, bleeding' : 'Man collapsed'} on ${S.name}. H for the siren, go`, 'bad', 4);
    } else {
      // the snatcher: off on a scooter, a lady shouting behind him
      const v = new Vehicle(G.W, G.scene, G.vmats, 'scooter', [0.05, 0.05, 0.06]);
      v.reset(S.x, S.z, S.th); v.y = G.W.surf.height(S.x, S.z); v.spec = { ...specOf('scooter'), acc: 3.4, vTop: 18 };
      G.traffic.extra = G.traffic.extra || []; G.traffic.extra.push(v.agent);
      const far = this.spot(600, 1100);
      this.call = { kind: 'pol', stage: 'chase', t: 0, v, dest: far || { x: S.x + 900, z: S.z }, limit: 150, near: 0, routeT: 0, lateMsg: 'He got away into the lanes' };
      G.hud.toast('Control room', `Chain snatching on ${S.name}: black scooter, heading out. Catch him`, 'bad', 4);
    }
  }
  ambTick(C, dt) {
    const G = this.g, P = G.player, v = P.cur;
    if (C.stage === 'pickup') {
      if (!G.people.list.includes(C.p)) { this.end(false); return; }
      const d = Math.hypot(C.x - v.x, C.z - v.z);
      if (d < 9 && Math.abs(v.v) < 1.2) { C.load = (C.load || 0) + dt; if (C.load > 2.5) {
        const i = G.people.list.indexOf(C.p); if (i >= 0) { if (C.p.body) C.p.body.release(); G.people.list.splice(i, 1); }
        const hs = HOSPITALS.map(n => FAMOUS.find(f => f.name === n)).filter(Boolean).sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z));
        const h = hs[0] || { x: v.x, z: v.z, name: 'Sassoon Hospital' };
        C.stage = 'hosp'; C.h = h; C.t = 0; C.limit = 60 + Math.hypot(h.x - v.x, h.z - v.z) / 8; C.dmg0 = v.dmg || 0; C.lateMsg = 'You took too long. They didn’t make it';
        G.setWaypoint({ x: h.x, z: h.z, name: h.name, gig: true });
        G.hud.toast('Patient on board', `To ${h.name}. Fast, and smooth: every knock hurts them`, 'meter', 3.4);
      } } else C.load = 0;
    } else if (C.stage === 'hosp') {
      const d = Math.hypot(C.h.x - v.x, C.h.z - v.z);
      if (d < 35 && Math.abs(v.v) < 1.5) {
        const rough = Math.max(0, (v.dmg || 0) - C.dmg0), quick = clamp(1 - C.t / C.limit, 0, 1);
        const pay = Math.round(PAY.amb * (0.6 + quick * 0.8) * (1 - Math.min(0.6, rough * 4)) + (C.crit ? 300 : 0));
        this.streak++; G.stats.money += pay; G.saveStats && G.saveStats(); G.audio.cash && G.audio.cash();
        G.hud.toast(`Delivered · ₹${pay}`, rough > 0.05 ? 'They made it, bruised by the ride' : 'They made it. Good driving', 'good', 3.4);
        this.end(true);
      }
    }
  }
  polTick(C, dt) {
    const G = this.g, W = G.W, P = G.player, me = P.cur, v = C.v;
    // the snatcher rides for the edge of the city, faster when you're on him
    const d = Math.hypot(me.x - v.x, me.z - v.z), want = d < 40 ? 15 : 10;
    if (!C.drv) C.drv = new Driver(v, G, { lane: 1.0, signals: false, emergency: true });
    C.drv.goTo(C.dest.x, C.dest.z); C.drv.update(dt, want);
    if (!C.seen && d < 160) { C.seen = true; G.setWaypoint(null); }
    if (!C.seen) G.setWaypoint({ x: v.x, z: v.z, name: 'The snatcher', gig: true });
    G.story && G.story.showMarker ? G.story.showMarker(v.x, v.z) : null;
    C.near = d < 6 ? C.near + dt : Math.max(0, C.near - dt * 0.5);
    if (C.near > 1.8) {
      const pay = PAY.pol + Math.round(Math.max(0, C.limit - C.t) * 3);
      this.streak++; G.stats.money += pay; G.saveStats && G.saveStats(); G.audio.cash && G.audio.cash();
      G.hud.toast(`Caught him · ₹${pay}`, 'He goes down off the scooter; the chain is back with the lady', 'good', 3.6);
      this.end(true);
    }
    if (Math.hypot(v.x - C.dest.x, v.z - C.dest.z) < 30 || d > 400) { G.hud.toast('He got away', 'Lost him in the lanes', 'bad', 3); this.end(false); }
  }
  end(ok) {
    const G = this.g, C = this.call;
    if (C && C.v) { if (C.v.root.parent) C.v.root.parent.remove(C.v.root); const ex = G.traffic.extra || [], k = ex.indexOf(C.v.agent); if (k >= 0) ex.splice(k, 1); }
    if (C && C.p && C.stage === 'pickup') { const i = G.people.list.indexOf(C.p); if (i >= 0 && ok === null) { if (C.p.body) C.p.body.release(); G.people.list.splice(i, 1); } }
    if (ok === false) this.streak = 0;
    G.dutySiren = 0; G.story && G.story.hideMarker && G.story.hideMarker();
    if (C) G.setWaypoint(null);
    this.call = null; this.waitT = ok ? 10 : 15;
  }
  objective() {
    const C = this.call, k = this.kind; if (!k) return null;
    const P = this.g.player;
    if (!C) return P.cur && !P.cur.legit ? { main: k === 'amb' ? 'Stolen ambulance' : 'Stolen police vehicle', sub: 'No calls will come to it. Lose it, or lose them' } : { main: k === 'amb' ? '108 · on duty' : 'Home Guard · on patrol', sub: 'Waiting for a call…' };
    const left = C.limit ? Math.max(0, Math.ceil(C.limit - C.t)) : 0;
    if (C.kind === 'amb') return C.stage === 'pickup' ? { main: '108 · get to the patient', sub: `${Math.round(Math.hypot(C.x - P.x, C.z - P.z))} m · ${left} s${C.crit ? ' · bleeding' : ''}`, urgent: left < 30 } : { main: `108 · to ${C.h.name}`, sub: `${Math.round(Math.hypot(C.h.x - P.x, C.h.z - P.z))} m · ${left} s · drive smooth`, urgent: left < 30 };
    return { main: 'Police · catch the snatcher', sub: `${Math.round(Math.hypot(C.v.x - P.x, C.v.z - P.z))} m · stay alongside him · ${left} s`, urgent: left < 30 };
  }
}
