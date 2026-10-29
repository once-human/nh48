// Police: Pune traffic rules and what happens when you break them.
//  · Mostly e-challans, signal cameras, speed cameras, helmet cameras. They arrive later as an SMS
//    and pile up as pending dues (like the real thing), which you pay from the pause menu.
//  · Sometimes the traffic police at a junction wave you over. Stop, and you get a conversation:
//    pay, plead, argue or offer "chai-pani", each with odds that depend on the officer, on whether
//    you were actually right, and on your record. Drive off and the challan doubles.
//  · Theft is different: beat marshals on motorcycles come looking (heat 1–3), chase you through
//    the streets and, if they catch you, it's the chowki.
//  · Leave a vehicle on a main road and the tow van takes it. Your auto ends up at the chowki.
// Fines follow the Motor Vehicles Act as amended in 2019, as applied in Pune (see FINES).
import * as THREE from 'three';
import { Vehicle, specOf, makeService } from '../vehicles/vehicle.js';
import { ikArm, leanRider, RIDER_HIPS, RIDER_LEAN } from '../people/humans.js';
import { buildPoliceJeep } from '../vehicles/emodels.js';
import { Law } from './law.js';
import { Driver } from '../vehicles/driver.js';
import { clamp, wrapAngle, RNG, safeStorage, fmtRupees } from '../core/util.js';
import LINES from './lines.json';
import { POLICE_MUL } from './settings.js';
import STREET from './street_lines.json';
// street people's lines, flattened to the same shape as lines.json: [label, voice, lang, text, roman, english]
for (const [pid, P] of Object.entries(STREET._personas)) {
  for (const [sc, arr] of Object.entries(STREET[pid] || {})) arr.forEach(([deva, roman, en], i) => { LINES[`s_${pid}_${sc}${i}`] = [P.label, P.voice, P.lang, deva, roman, en]; });
}
export { STREET };

export const FINES = {
  signal:    { amt: 500, repeat: 1500, name: 'Jumping a red signal', law: 'MV Act s.177/184' },
  helmet:    { amt: 1000, name: 'Riding without a helmet', law: 'MV Act s.194D' },
  wrong:     { amt: 1000, name: 'Driving the wrong way', law: 'MV Act s.184' },
  speed:     { amt: 1000, car: 2000, heavy: 4000, name: 'Over-speeding', law: 'MV Act s.183' },
  horn:      { amt: 1000, repeat: 2000, name: 'Honking in a silence zone', law: 'MV Act s.194F' },
  disobey:   { amt: 2000, name: 'Ignoring a police signal', law: 'MV Act s.179' },
  rash:      { amt: 1000, name: 'Rash driving', law: 'MV Act s.184' },
  suspended: { amt: 10000, name: 'Driving while disqualified', law: 'MV Act s.182' },
  check:     { amt: 0, name: 'Nakabandi document check', law: '' },
  theft:     { amt: 5000, name: 'Vehicle theft', law: 'BNS s.303' },
  bribe:     { amt: 5000, name: 'Attempt to bribe a public servant', law: 'Prevention of Corruption Act s.8' },
  noparking: { amt: 500, name: 'No parking (towed)', law: 'MV Act s.177' },
  obstruct:  { amt: 500, name: 'Obstructing a public servant', law: 'BNS s.221' },
  assault:   { amt: 10000, name: 'Assaulting a public servant', law: 'BNS s.121' },
  drunk:     { amt: 10000, name: 'Drunk driving', law: 'MV Act s.185' },
  nuisance:  { amt: 1200, name: 'Public nuisance / brawling', law: 'Maharashtra Police Act s.110' },
  hurt:      { amt: 5000, name: 'Voluntarily causing hurt', law: 'BNS s.115' },
  hitrun:    { amt: 5000, name: 'Hit and run: not stopping after hitting someone', law: 'MV Act s.134/187' },
  fled:      { amt: 3000, name: 'Escaping from lawful custody', law: 'BNS s.262' },
  murder:    { amt: 50000, name: 'Murder', law: 'BNS s.103' },
  blast:     { amt: 25000, name: 'Mischief by fire or explosive', law: 'BNS s.326' },
  court:     { amt: 2000, name: 'Fine imposed by the court', law: 'Judicial order' },
  pickpocket: { amt: 3000, name: 'Pickpocketing (theft)', law: 'BNS s.303' },
  stolengoods: { amt: 10000, name: 'Carrying stolen property', law: 'BNS s.317' },
  racing:    { amt: 5000, name: 'Racing on a public road', law: 'MV Act s.189' },
};
// what you're wanted for decides what the marshals shout and what you're booked under when caught
const SERIOUS = new Set(['theft', 'assault', 'hurt', 'hitrun', 'fled', 'pickpocket', 'murder', 'blast']);
const CHARGE_ORDER = ['murder', 'blast', 'assault', 'hitrun', 'theft', 'pickpocket', 'hurt', 'fled', 'disobey'];
const TOW = { two: 200, three: 200, four: 400, fine: 500 };   // towing charges + no-parking fine
const SPEED_LIMIT = 50;                                         // km/h on city arterials
const COP_NAMES = ['Havaldar Shinde', 'Havaldar Jadhav', 'PSI Kulkarni', 'Havaldar Pawar', 'Havaldar Gaikwad', 'ASI Deshmukh', 'Havaldar More', 'PSI Patil', 'Havaldar Sawant', 'Havaldar Kamble'];
const STOP_LINE = { signal: 'stop_signal', helmet: 'stop_helmet', wrong: 'stop_wrong', speed: 'stop_speed', horn: 'stop_horn', check: 'stop_check', rash: 'stop_speed', suspended: 'stop_check', theft: 'caught_theft', assault: 'caught_assault', hurt: 'caught_hurt', hitrun: 'caught_hitrun', fled: 'caught_fled', disobey: 'caught_disobey', pickpocket: 'caught_pickpocket', murder: 'caught_assault', blast: 'caught_assault' };

export class Police {
  constructor(game) {
    this.g = game; this.W = game.W;
    this.rng = new RNG(4848);
    this.dues = [];                // pending e-challans {what, amt, where, at}
    this.history = [];             // last few challans for the menu
    this.record = {};              // offences on your record by kind
    this.licence = { until: 0 };   // suspended until this many game-hours
    this.heat = 0; this.pts = 0; this.unseenT = 0; this.lastSeen = null; this.charges = new Set();
    this.stop = null;
    this.sms = [];                 // delayed messages {t, fn}
    this.marshals = [];
    this.cool = {};                // per-offence cooldowns
    this.plate = 'MH 12 RN 4821';
    this.load();
    this.setupCops();
    this.setupCameras();
    this.setupZones();
    this.chowkis = (this.W.M.pois || []).filter(p => p[4] === 'police').map(p => ({ name: p[0], x: p[2] / 100, z: p[3] / 100 }));
    this.zone = null;
    this.law = new Law(this.g, this);
  }

  // ---------------------------------------------------------------- persistence
  load() {
    const st = safeStorage();
    try { const s = st && JSON.parse(st.getItem('nh48_police') || 'null'); if (s) { this.dues = s.dues || []; this.record = s.record || {}; this.licence = s.licence || { until: 0 }; this.history = s.history || []; } } catch (e) { /* ignore */ }
  }
  save() {
    const st = safeStorage();
    if (st) try { st.setItem('nh48_police', JSON.stringify({ dues: this.dues, record: this.record, licence: this.licence, history: this.history.slice(-8) })); } catch (e) { /* ignore */ }
  }
  get duesTotal() { return this.dues.reduce((s, d) => s + d.amt, 0); }
  get suspended() { return this.g.clock < this.licence.until || this.duesTotal > 10000; }
  suspendedLeft() { return Math.max(0, this.licence.until - this.g.clock); }

  // ---------------------------------------------------------------- the city's enforcement
  setupCops() {
    // officers at some signalised junctions (placed by the game); give each one a temperament
    const r = new RNG(77);
    this.cops = (this.g.cops || []).map((c, i) => Object.assign(c, {
      id: i, name: COP_NAMES[i % COP_NAMES.length], mood: r.next(), corrupt: r.chance(0.45), bribes: 0, busyT: 0, post: { x: c.x, z: c.z },
    }));
  }
  setupCameras() {
    // speed cameras on long arterial stretches, spread out
    const G = this.W.graph, r = new RNG(1212);
    const cand = G.edges.filter(e => e.rank >= 5 && e.len > 140);
    this.speedCams = [];
    for (let k = 0; k < 400 && this.speedCams.length < 16; k++) {
      const e = r.pick(cand);
      if (!e) break;
      const t = G.at(e, e.len / 2);
      if (this.speedCams.some(c => Math.hypot(c.x - t[0], c.z - t[1]) < 600)) continue;
      this.speedCams.push({ x: t[0], z: t[1], hx: t[2], hz: t[3], limit: SPEED_LIMIT, cool: 0, name: G.names[e.name] ? G.names[e.name][0] : '' });
    }
  }
  setupZones() {
    // silence zones: 100 m around hospitals (Noise Pollution Rules, 2000)
    this.quiet = (this.W.M.pois || []).filter(p => p[4] === 'hospital' && /hospital|rugnalaya|sassoon|ruby|jehangir|medical/i.test(p[0]))
      .map(p => ({ name: p[0].replace(/ Pvt\.? Ltd\.?/i, ''), x: p[2] / 100, z: p[3] / 100, r: 100 }));
  }
  nearestChowki(x, z) {
    let best = null, bd = 1e12;
    for (const c of this.chowkis) { const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < bd) { bd = d; best = c; } }
    return best || { name: 'Deccan Gymkhana Police Chowki', x: this.g.start.x, z: this.g.start.z };
  }
  whereName(x, z) {
    const near = this.W.graph.nearest(x, z, 40);
    const nm = near && this.W.graph.names[near.e.name];
    return nm && nm[0] ? nm[0] : 'Pune';
  }
  copSeeing(x, z, r = 45) {
    let best = null, bd = r;
    for (const c of this.cops) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd && c.busyT <= 0) { bd = d; best = c; } }
    return best;
  }

  // ---------------------------------------------------------------- offences
  fineFor(kind) {
    const F = FINES[kind], S = this.g.player.spec;
    let amt = F.amt;
    if (kind === 'speed' && S) amt = S.two || this.g.player.inAuto ? F.amt : S.L > 5 ? F.heavy : F.car;
    if (F.repeat && (this.record[kind] || 0) > 0) amt = F.repeat;
    return amt;
  }
  // a rule was broken at (x, z). Cop nearby → maybe a stop. Camera → e-challan later. Else nothing.
  offence(kind, x, z, info = {}) {
    if (this.g.free) return;                 // free roam: no cops after you
    if (this.stop || (this.cool[kind] || 0) > 0) return;
    const P = this.g.player;
    if (P.onFoot) return;
    // Pune reality: most offences go unnoticed. A havaldar right there may stop you, or just blow the
    // whistle and wave you on; cameras only watch the big junctions. At most one challan every ~2 minutes.
    this.cool[kind] = kind === 'helmet' ? 90 : 45;
    const quiet = (this.lastChallanT ?? -1e9) > this.g.t - 120;
    const cop = info.cop !== false && this.copSeeing(x, z, info.copRange || 30);
    const pm = POLICE_MUL[this.g.settings?.police] ?? 1;
    if (cop && !quiet && this.rng.next() < (info.stopChance ?? 0.45) * pm) { this.lastChallanT = this.g.t; this.beginStop(cop, kind, info); return; }
    if (cop && this.rng.next() < 0.6) { this.g.hud.toast('Whistle!', `${cop.name} waved you on. Next time it's a challan.`, 'warn', 2.4); this.g.audio.whistle && this.g.audio.whistle(); return; }
    if (!quiet && (cop || this.rng.next() < (info.camChance ?? 0) * pm)) { this.lastChallanT = this.g.t; this.eChallan(kind, x, z, cop ? 'noted by the traffic police' : info.how || 'caught on camera'); }
    else if (info.missed) this.g.hud.toast(info.missed[0], info.missed[1], 'warn', 2.2);
  }
  eChallan(kind, x, z, how, extra = 0) {
    const P = this.g.player, veh = P.cur;
    const amt = this.fineFor(kind) + extra;
    const stolen = !!(veh && veh.stolen);
    const plate = stolen ? veh.plate : this.plate;
    const where = this.whereName(x, z);
    const delay = 5 + this.rng.next() * 9;
    this.later(delay, () => {
      const H = this.g.hud;
      if (stolen) { H.sms('MahaTraffic', `E-challan ${fmtRupees(amt)} for ${FINES[kind].name.toLowerCase()} at ${where} was sent to ${plate}, the vehicle’s real owner.`, '', 'Not your problem. Very much theirs.'); return; }
      this.addDue(kind, amt, where);
      H.sms('MahaTraffic', `E-challan issued to ${plate}: ${FINES[kind].name}, ${where} (${how}).`, fmtRupees(amt), 'Pending, pay from the menu');
      this.g.audio.fine();
    });
  }
  addDue(kind, amt, where) {
    const d = { what: FINES[kind].name, kind, amt, where, at: this.g.clock };
    this.dues.push(d); this.history.push(d);
    this.record[kind] = (this.record[kind] || 0) + 1;
    if (this.duesTotal > 10000) this.g.hud.toast('Licence suspended', 'Over ₹10,000 in unpaid challans. Pay them from the menu to drive legally again.', 'bad', 4);
    this.save();
  }
  payDues() {
    const tot = this.duesTotal, S = this.g.stats;
    if (!tot) return false;
    if (S.money < tot) { this.g.hud.toast('Not enough money', `You need ${fmtRupees(tot)} to clear your challans`, 'warn', 2.6); return false; }
    S.money -= tot; this.dues = []; this.save(); this.g.saveStats();
    this.g.audio.cash();
    this.g.hud.toast(`Paid ${fmtRupees(tot)} in challans`, 'All clear on MahaTraffic', 'meter', 3);
    return true;
  }
  // take money now; whatever can't be paid becomes a pending challan
  charge(kind, amt, label) {
    const S = this.g.stats;
    const now = Math.min(S.money, amt);
    S.money -= now;
    if (amt > now) this.addDue(kind, amt - now, 'on-the-spot (unpaid part)');
    else { this.record[kind] = (this.record[kind] || 0) + 1; this.history.push({ what: label || FINES[kind].name, kind, amt, where: 'on the spot', at: this.g.clock, paid: true }); this.save(); }
    this.g.saveStats();
    return now;
  }
  suspend(hours, why) {
    this.licence.until = Math.max(this.licence.until, this.g.clock + hours);
    this.save();
    this.g.hud.toast('Licence suspended', `${why} · ${Math.round(hours)} game-hours. No fares until then.`, 'bad', 4.2);
    if (this.g.rides && this.g.rides.enabled) this.g.rides.setEnabled(false);
  }
  later(t, fn) { this.sms.push({ t, fn }); }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const G = this.g, P = G.player;
    for (const k in this.cool) this.cool[k] -= dt;
    for (const c of this.cops) c.busyT -= dt;
    for (let i = this.sms.length - 1; i >= 0; i--) { const s = this.sms[i]; s.t -= dt; if (s.t <= 0) { this.sms.splice(i, 1); s.fn(); } }
    this.checkCameras(dt);
    this.checkZones(dt);
    if (this.stop) this.updateStop(dt);
    if (!G.free) this.law.update(dt);
    if (this.grab) this.grabTick(dt);
    this.updateHeat(dt);
    this.updateTowing(dt);
    // licence chip
    if (this._lsT === undefined || (this._lsT -= dt) <= 0) { this._lsT = 1; G.hud.setLicence(this.suspended, this.suspendedLeft(), this.duesTotal); }
    // random nakabandi at night: a cop flags down a passing vehicle for a document check
    if (!this.stop && !P.onFoot && Math.abs(P.v) > 2 && G.sky.state && G.sky.state.night > 0.5 && (this.cool.check || 0) <= 0) {
      const cop = this.copSeeing(P.x, P.z, 18);
      if (cop) { this.cool.check = 60; if (this.rng.next() < 0.3) this.beginStop(cop, 'check', {}); }
    }
    // riding without a helmet past an officer
    if (!this.stop && !P.onFoot && P.spec && P.spec.helmet && P.cur && !P.cur.helmet && Math.abs(P.v) > 1.5 && (this.cool.helmet || 0) <= 0) {
      const cop = this.copSeeing(P.x, P.z, 22);
      if (cop) this.offence('helmet', P.x, P.z, { stopChance: 0.7 });
    }
  }

  checkCameras(dt) {
    const G = this.g, P = G.player;
    let warn = null;
    for (const c of this.speedCams) {
      c.cool -= dt;
      const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz);
      if (d > 170 || P.onFoot) continue;
      const ahead = (dx * Math.cos(P.th) + dz * Math.sin(P.th)) / (d || 1);
      if (ahead > 0.5) warn = { text: 'Speed camera', sub: `${c.limit} km/h`, d };
      const kmh = Math.abs(P.v) * 3.6;
      if (d < 22 && kmh > c.limit * 1.1 && c.cool <= 0) {
        c.cool = 45;
        this.offence('speed', P.x, P.z, { cop: false, camChance: 1, how: `${Math.round(kmh)} km/h in a ${c.limit} zone, speed camera` });
      }
    }
    this.camWarn = warn;
  }
  checkZones(dt) {
    const G = this.g, P = G.player;
    if ((this._zT = (this._zT || 0) - dt) > 0) return;
    this._zT = 0.5;
    let z = null;
    for (const q of this.quiet) if (Math.abs(q.x - P.x) < q.r && Math.abs(q.z - P.z) < q.r && Math.hypot(q.x - P.x, q.z - P.z) < q.r) { z = q; break; }
    this.zone = z;
    // a speed camera ahead matters more than the zone you're in
    G.hud.setZone(this.camWarn ? { text: this.camWarn.text, sub: this.camWarn.sub, kind: 'cam' } : z ? { text: 'Silence zone', sub: z.name.length > 26 ? 'Hospital' : z.name, kind: 'quiet' } : null);
  }
  // the player honked (called while the horn is held)
  honked() {
    if (!this.zone || this.stop) return;
    const P = this.g.player;
    this.offence('horn', P.x, P.z, { copRange: 70, stopChance: 0.9, missed: ['Silence zone', 'Hospital nearby, no honking here'] });
  }

  // ---------------------------------------------------------------- traffic stops
  holding() { const p = this.stop && this.stop.phase; return p === 'approach' || p === 'talk' || p === 'result'; }
  beginStop(cop, kind, info) {
    const G = this.g, P = G.player;
    cop.busyT = 999;
    const fine = kind === 'check' ? 0 : this.fineFor(kind);
    this.stop = { cop, kind, fine, phase: 'wave', t: 0, info, amber: !!info.amber, whistleT: 0 };
    if (cop.ped) { cop.ped.ctl = true; cop.ped.anim = 'wave'; }
    G.audio.whistle();
    this.say('stop_wave', cop);
  }
  updateStop(dt) {
    const G = this.g, P = G.player, s = this.stop, cop = s.cop, ped = cop.ped;
    s.t += dt;
    const d = Math.hypot(P.x - cop.x, P.z - cop.z);
    if (s.phase === 'wave') {
      if (ped) { ped.yaw = Math.atan2(P.z - ped.z, P.x - ped.x); ped.anim = 'wave'; }
      s.whistleT -= dt;
      if (s.whistleT <= 0 && d < 70) { s.whistleT = 2.6; G.audio.whistle(); }
      G.hud.prompt('!', d < 18 ? 'Stop here, the officer is walking over' : 'Traffic police waving you over, stop next to him', 0.3);
      if (d < 18 && Math.abs(P.v) < 0.8) { s.phase = 'approach'; }
      else if (d > 65 || s.t > 16) {
        // drove off: the number is noted, the challan grows (and if it's stolen, word gets out)
        this.say('stop_ignored', cop); this.g.rep && this.g.rep.deed('fled', P.x, P.z);
        if (s.kind !== 'check') this.eChallan(s.kind, cop.x, cop.z, 'you drove off when stopped', FINES.disobey.amt);
        if (P.cur && P.cur.stolen) { this.raiseHeat(1, 'Ran from the police in a stolen vehicle', 'theft'); this.charges.add('disobey'); }
        else G.hud.toast('Drove off from a police stop', `Number noted. Expect an extra ${fmtRupees(FINES.disobey.amt)} on the challan.`, 'bad', 3.2);
        this.endStop();
      }
      return;
    }
    if (s.phase === 'approach') {
      // walk to the driver's side
      const S = P.spec || { W: 0.6 };
      const side = S.two ? -1 : 1;
      const tx = P.x + (-Math.sin(P.th)) * (S.W / 2 + 0.75) * side, tz = P.z + Math.cos(P.th) * (S.W / 2 + 0.75) * side;
      if (ped) {
        const dx = tx - ped.x, dz = tz - ped.z, dd = Math.hypot(dx, dz);
        if (dd > 0.4 && s.t < 30) { const sp = Math.min(dd, 1.6 * dt * 1.4); ped.x += dx / dd * sp; ped.z += dz / dd * sp; ped.yaw = Math.atan2(dz, dx); ped.anim = 'walk'; ped.v = 1.6; cop.x = ped.x; cop.z = ped.z; return; }
        ped.yaw = Math.atan2(P.z - ped.z, P.x - ped.x); ped.anim = 'talk'; ped.v = 0;
      }
      s.phase = 'talk'; s.t = 0;
      this.openTalk();
      return;
    }
    // you can always just leave: drive off or walk away mid-conversation. It's fleeing a police stop, and they react
    if ((s.phase === 'approach' || s.phase === 'talk') && (Math.hypot(P.x - cop.x, P.z - cop.z) > 8 || Math.abs(P.v || 0) > 3 || (P.onFoot && (P.foot.v || 0) > 3))) {
      G.hud.closeStop(); P.busy = 0;
      this.say('m_spot2', cop);
      const serious = SERIOUS.has(s.kind);
      if (serious || cop.marshal) { this.raiseHeat(1, 'Fled from a police stop', 'disobey'); if (cop.marshal) cop.marshal.stunT = 1.5; this.law.setDesc(); this.law.radioDesc(); }
      else { if (s.kind !== 'check') this.eChallan(s.kind, cop.x, cop.z, 'you drove off when stopped', FINES.disobey.amt); G.hud.toast('You left mid-stop', `He noted your number. Expect an extra ${fmtRupees(FINES.disobey.amt)} on the challan.`, 'bad', 3); }
      if (ped) s.phase = 'leave'; else this.stop = null;
      return;
    }
    if (s.phase === 'talk' || s.phase === 'result') {
      if (ped) ped.yaw = Math.atan2(P.z - ped.z, P.x - ped.x);
      const inp = G.input;
      if (s.phase === 'talk') { for (let k = 1; k <= s.opts.length; k++) if (inp.took('Digit' + k) || inp.took('Numpad' + k)) { this.choose(k - 1); break; } }
      else if (inp.took('Enter') || inp.took('NumpadEnter') || inp.took('Space') || (s.t > 7)) this.finishTalk();
      return;
    }
    if (s.phase === 'leave') {
      if (ped) {
        const dx = cop.post.x - ped.x, dz = cop.post.z - ped.z, dd = Math.hypot(dx, dz);
        if (dd > 0.3) { const sp = Math.min(dd, 1.5 * dt); ped.x += dx / dd * sp; ped.z += dz / dd * sp; ped.yaw = Math.atan2(dz, dx); ped.anim = 'walk'; cop.x = ped.x; cop.z = ped.z; return; }
        ped.anim = null; ped.ctl = false; ped.x = cop.post.x; ped.z = cop.post.z;
      }
      cop.x = cop.post.x; cop.z = cop.post.z;
      cop.busyT = 25;
      this.stop = null;
    }
  }
  openTalk() {
    const G = this.g, P = G.player, s = this.stop, cop = s.cop;
    const stolen = P.cur && P.cur.stolen;
    // what the officer finds once he looks at you
    if (stolen && s.kind !== 'theft') { s.kind = 'theft'; s.fine = FINES.theft.amt; }
    else if (this.suspended && s.kind !== 'theft') { s.found = 'suspended'; if (s.kind === 'check') { s.kind = 'suspended'; s.fine = 0; } }
    const line = this.say(STOP_LINE[s.kind] || 'stop_check', cop) || 'stop_check';
    const dues = this.duesTotal;
    const total = s.fine + (s.found === 'suspended' ? FINES.suspended.amt : 0);
    s.total = total;
    const priceUp = cop.corrupt && cop.bribes > 0;
    const serious = SERIOUS.has(s.kind);
    s.bribe = serious ? (s.kind === 'assault' ? 5000 : 2000) : priceUp ? Math.min(1000, 200 + cop.bribes * 300) : 200;
    if (s.kind === 'check' && !s.found) {
      s.opts = [{ id: 'show', t: 'Show your licence', s: 'Everything’s in order' }];
    } else {
      s.opts = [
        { id: 'pay', t: serious ? 'Go quietly' : 'Pay the fine', s: serious ? `Bail ${fmtRupees(total)}${stolen ? ' · vehicle returned' : ''}` : `${fmtRupees(total)} by UPI on the e-challan machine` },
        { id: 'plead', t: 'Plead', s: serious ? (s.kind === 'theft' ? '“Saheb, galti jhali…”' : s.kind === 'hitrun' ? '“Saheb, ghabarlo hoto, thaambaycha hota…”' : '“Saheb, tyaane aadhi suru kela…”') : '“Saheb, pehli vel aahe, passenger la ushir hotoy…”' },
        { id: 'argue', t: s.kind === 'signal' ? '“It was still amber!”' : 'Argue', s: s.kind === 'signal' ? 'Only works if it really was' : '“Mi kahi kela nahi!”' },
        { id: 'bribe', t: 'Offer chai-pani', s: (cop.corrupt ? this.rng.next() < 0.75 : this.rng.next() < 0.25) ? 'He keeps glancing at your wallet' : 'He looks like he goes by the book' },
      ];
      if (serious) s.opts[2] = { id: 'run', t: P.onFoot ? 'Run for it' : 'Floor it', s: 'They will chase you' };
    }
    s.view = {
      who: cop.name, rank: cop.marshal ? (cop.marshal.role === 'qrt' ? 'QRT, Pune Police' : cop.marshal.jeep ? 'Patrol, Pune Police' : 'Beat Marshal, Pune Police') : 'Traffic Police, Pune', mood: cop.mood, kind: (s.kind === 'check' && s.found ? FINES[s.found].name : FINES[s.kind].name) + (s.kind !== 'disobey' && this.charges.has('disobey') && serious ? ' + ignoring a police signal' : ''), law: FINES[s.kind].law,
      amt: s.kind === 'check' && !s.found ? '' : fmtRupees(total), line: LINES[line][4], tr: LINES[line][5], opts: s.opts,
      foot: `${dues ? `Pending challans ${fmtRupees(dues)}` : 'No pending challans'} · ${this.suspended ? 'Licence suspended' : 'Licence valid'} · ${fmtRupees(G.stats.money)} on you`,
    };
    G.hud.openStop({ ...s.view, onPick: (i) => this.choose(i) });
    s.phase = 'talk';
  }
  choose(i) {
    const G = this.g, s = this.stop, cop = s.cop, P = G.player;
    if (!s || s.phase !== 'talk') return;
    const o = s.opts[i];
    if (!o) return;
    const r = this.rng.next();
    let res = '', sub = '', line = null, kind = 'info';
    const theft = SERIOUS.has(s.kind);
    const firstTime = !(this.record[s.kind] > 0);
    if (o.id === 'show') {
      line = 'r_clear'; res = 'All in order'; sub = 'He hands your licence back and waves you on.';
    } else if (o.id === 'pay') {
      line = theft ? 'm_caught' : 'r_pay';
      if (theft) { this.arrest('Went quietly'); res = 'Taken to the chowki'; sub = `${FINES[s.kind].name}. Bail ${fmtRupees(s.total)}.${s.kind === 'theft' ? ' The vehicle goes back to its owner.' : ''}`; kind = 'bad'; }
      else {
        const paid = this.charge(s.kind, s.total); G.rep && G.rep.deed('paid', P.x, P.z);
        res = paid >= s.total ? `Paid ${fmtRupees(s.total)}` : `Paid ${fmtRupees(paid)}, ${fmtRupees(s.total - paid)} pending`;
        sub = 'Receipt on SMS. Your record notes it.';
        if (s.found === 'suspended') sub = 'Driving while suspended. Your record looks worse.';
        if (s.kind === 'helmet' && !firstTime) this.suspend(24, 'Second helmet offence');
        G.audio.cash();
      }
    } else if (o.id === 'plead') {
      const chance = theft ? 0.08 : (firstTime ? 0.45 : 0.15) * (0.5 + cop.mood) - (this.duesTotal > 0 ? 0.12 : 0) - (s.found ? 0.3 : 0) + (G.rep ? G.rep.standing(P.x, P.z) * 0.18 : 0);
      if (r < chance) {
        line = 'r_plead_ok'; res = theft ? 'Let off with a warning' : 'Let off with a warning'; sub = theft ? 'The vehicle stays with them. You walk.' : 'He waves you on. Don’t push your luck.'; kind = 'meter';
        if (theft) { this.confiscate(); this.heat = 0; this.pts = 0; this.clearMarshals(); this.clearCharges(); }
      } else {
        line = 'r_plead_no';
        if (theft) { this.arrest('Pleading didn’t work'); res = 'Taken to the chowki'; sub = `Bail ${fmtRupees(s.total)}.`; kind = 'bad'; }
        else { const paid = this.charge(s.kind, s.total); res = 'He wasn’t moved'; sub = `Paid ${fmtRupees(paid)}${paid < s.total ? ', rest pending' : ''}.`; kind = 'warn'; }
      }
    } else if (o.id === 'argue') {
      // arguing works when you were actually right (amber), and rarely otherwise
      const chance = s.amber ? 0.75 : 0.08 * (0.5 + cop.mood);
      if (r < chance) { line = 'r_argue_ok'; res = s.amber ? 'You were right' : 'He let it go'; sub = s.amber ? 'It was amber when you crossed. He knows it.' : 'Lucky. He’s in a good mood.'; kind = 'meter'; }
      else {
        line = 'r_argue_no';
        cop.mood = Math.max(0, cop.mood - 0.25);
        const dues = this.duesTotal;
        const want = s.total + dues;
        const paid = this.charge(s.kind, s.total);
        if (dues && G.stats.money >= dues) { G.stats.money -= dues; this.dues = []; this.save(); }
        res = 'That made it worse'; sub = `Full fine${dues ? ' and your pending challans' : ''}: ${fmtRupees(want)}${paid < s.total ? ' (part pending)' : ''}.`; kind = 'bad';
      }
    } else if (o.id === 'bribe' && !s.neg) {
      // how much? his price is hidden: what the charge is worth to him, his mood, how often you've done this
      const base = Math.max(200, s.total || 500) * (theft ? 2.2 : 1);
      s.neg = { R: cop.corrupt ? base * (0.35 + (1 - cop.mood) * 0.45) * (1 + cop.bribes * 0.4) : Infinity, tries: 0 };
      const r50 = (x) => Math.max(100, Math.round(x / 50) * 50);
      s.opts = [0.25, 0.5, 0.85, 1.3].map(k => ({ id: 'offer', amt: r50(base * k), t: fmtRupees(r50(base * k)), s: k < 0.3 ? '“Saheb, chai-pani…”' : k < 0.6 ? 'Folded, under the licence' : k < 1 ? '“Adjust kara na, saheb”' : 'More than the fine, to make it go away' }));
      s.opts.push({ id: 'back', t: 'Never mind', s: 'Pay the fine properly instead' });
      G.hud.openStop({ ...s.view, line: 'Bol. Kiti?', tr: 'Go on. How much?', opts: s.opts, onPick: (i) => this.choose(i), mood: cop.mood, neg: true });
      G.vb && G.vb.police(cop.marshal ? cop.marshal.role : 'traffic', 'bribehint', cop.ped || cop, { quiet: true });
      return;
    } else if (o.id === 'back') {
      s.neg = null; const paid = this.charge(s.kind, s.total); res = `Paid ${fmtRupees(paid)}`; sub = 'Properly, with a receipt. He looks almost disappointed.'; line = 'r_pay'; G.audio.cash();
    } else if (o.id === 'offer' || o.id === 'counter_yes') {
      const amt = o.amt, N = s.neg;
      if (G.stats.money < amt) { line = 'r_plead_no'; res = 'You don’t have it'; sub = `You fumble for ${fmtRupees(amt)} you don’t have. He writes the challan.`; this.charge(s.kind, s.total); kind = 'warn'; }
      else if (!isFinite(N.R)) {
        // an honest one
        line = 'r_bribe_no'; res = 'Booked for offering a bribe'; sub = `Prevention of Corruption Act. ${fmtRupees(5000)} penalty, licence suspended.`; kind = 'bad';
        this.charge('bribe', 5000, 'Attempt to bribe a public servant'); this.suspend(24, 'Bribery attempt');
        if (theft) this.arrest('Tried to bribe the officer', true);
      } else if (amt >= N.R || o.id === 'counter_yes') {
        G.stats.money -= amt; cop.bribes++; G.rep && G.rep.deed('bribe', P.x, P.z);
        if (this.rng.next() < 0.1) { this.charge(s.kind, s.total); line = 'r_bribe_more'; res = 'He took it, and booked you anyway'; sub = `${fmtRupees(amt)} gone, and the full challan. Welcome to Pune.`; kind = 'bad'; }
        else {
          line = cop.bribes > 1 ? 'r_bribe_more' : 'r_bribe_ok'; res = `${fmtRupees(amt)} changes hands`; sub = cop.bribes > 1 ? 'He remembers you. The rate goes up every time.' : 'No receipt, obviously.'; kind = 'warn';
          if (theft) { this.confiscate(); this.heat = 0; this.pts = 0; this.clearMarshals(); this.clearCharges(); sub = 'The case never gets written. You walk away.'; }
          if (this.rng.next() < 0.12) this.later(25 + this.rng.next() * 40, () => { G.hud.sms('Pune Mirror', `Video of a policeman taking cash at ${this.whereName(cop.x, cop.z)} goes viral. Constable suspended; the driver traced.`, fmtRupees(s.total + 1000), 'Challan + penalty, pending'); this.addDue(s.kind, s.total + 1000, 'traced from a viral video'); });
        }
      } else if (amt >= N.R * 0.6 && !N.tries) {
        // close: he names his number
        N.tries = 1; const c = Math.max(amt + 100, Math.round(N.R / 50) * 50);
        s.opts = [{ id: 'counter_yes', amt: c, t: `Pay ${fmtRupees(c)}`, s: 'His number, final' }, { id: 'back', t: 'Too much', s: 'Pay the fine instead' }];
        G.vb && G.vb.police(cop.marshal ? cop.marshal.role : 'traffic', 'counter', cop.ped || cop, { quiet: true });
        G.hud.openStop({ ...s.view, line: `Itna nahi chalega. ${c}. Bas.`, tr: `That won’t do. ${c}. That’s it.`, opts: s.opts, onPick: (i) => this.choose(i), mood: cop.mood, neg: true });
        return;
      } else {
        // insulting
        cop.mood = Math.max(0, cop.mood - 0.3); line = 'r_bribe_no';
        const book = this.rng.next() < 0.4;
        this.charge(s.kind, s.total); if (book) this.charge('bribe', 2000, 'Attempt to bribe a public servant');
        res = book ? 'Insulted, and booked for it' : 'He’s insulted'; sub = book ? 'Full fine plus a bribery penalty.' : `Full fine, ${fmtRupees(s.total)}, and a long look at your face.`; kind = 'bad';
      }
      s.neg = null;
    } else if (o.id === 'bribe') {
      if (G.stats.money < s.bribe) { line = 'r_plead_no'; res = 'You don’t have it'; sub = `You fumble for ${fmtRupees(s.bribe)} you don’t have. He writes the challan.`; this.charge(s.kind, s.total); kind = 'warn'; }
      else if (cop.corrupt && r < 0.9) {
        line = cop.bribes > 0 ? 'r_bribe_more' : 'r_bribe_ok';
        G.stats.money -= s.bribe; cop.bribes++; G.rep && G.rep.deed('bribe', P.x, P.z);
        res = `${fmtRupees(s.bribe)} changes hands`; sub = cop.bribes > 1 ? 'He remembers you. The rate goes up every time.' : 'No receipt, obviously.'; kind = 'warn';
        if (theft) { this.confiscate(); this.heat = 0; this.pts = 0; this.clearMarshals(); this.clearCharges(); sub = s.kind === 'theft' ? 'The vehicle stays with him. You walk away.' : 'The case never gets written. You walk away.'; }
        // someone on the footpath had their phone out
        if (this.rng.next() < 0.12) this.later(25 + this.rng.next() * 40, () => {
          G.hud.sms('Pune Mirror', `Video of a ${s.kind === 'theft' ? 'beat marshal' : 'traffic constable'} taking cash at ${this.whereName(cop.x, cop.z)} goes viral. Constable suspended; the driver traced.`, fmtRupees(s.total + 1000), 'Challan + penalty added');
          this.addDue(s.kind, s.total + 1000, 'traced from a viral video');
        });
      } else {
        line = 'r_bribe_no';
        res = 'Booked for offering a bribe'; sub = `Prevention of Corruption Act. ${fmtRupees(5000)} penalty, licence suspended.`; kind = 'bad';
        this.charge('bribe', 5000, 'Attempt to bribe a public servant');
        this.suspend(24, 'Bribery attempt');
        if (theft) this.arrest('Tried to bribe the marshal', true);
      }
    } else if (o.id === 'run') {
      line = 'm_spot2'; res = 'You bolt'; sub = 'Lose them, or it gets worse.'; kind = 'bad';
      this.raiseHeat(1, 'Ran from an arrest', 'fled');
      if (s.cop.marshal) s.cop.marshal.stunT = 2.5;
      G.hud.closeStop();
      this.say(line, cop);
      P.busy = 0;
      if (s.cop.ped) s.phase = 'leave'; else this.stop = null;
      return;
    }
    if (line) line = this.say(line, cop) || line;
    s.phase = 'result'; s.t = 0;
    G.hud.stopResult(res, sub, kind, LINES[line] ? LINES[line][4] : '', LINES[line] ? LINES[line][5] : '');
    this.save(); G.saveStats();
  }
  finishTalk() {
    const s = this.stop;
    this.g.hud.closeStop();
    this.g.player.busy = 0.3;
    if (s.cop.marshal) { this.stop = null; return; }
    s.phase = 'leave';
  }
  endStop() {
    const s = this.stop;
    if (!s) return;
    if (s.cop.ped) { const pd = s.cop.ped; pd.ctl = false; pd.anim = null; if (s.cop.post) { pd.x = s.cop.post.x; pd.z = s.cop.post.z; s.cop.x = pd.x; s.cop.z = pd.z; } }
    s.cop.busyT = 30;
    this.stop = null;
    this.g.player.busy = 0;
  }

  // ---------------------------------------------------------------- theft, heat, beat marshals
  onEvent(ev) {
    const G = this.g, P = G.player;
    if (ev.type === 'carjack') { const cop = this.copSeeing(ev.x, ev.z, 70); if (cop) { this.raiseHeat(2, 'Vehicle theft in front of a cop', 'theft'); this.law.setDesc(); } else this.later(1.5, () => this.law.report(1, 'Vehicle theft, the owner is calling it in', 'theft', ev.x, ev.z, { direct: true })); }
    if (ev.type === 'stoleParked' && this.rng.next() < 0.4) this.later(18 + this.rng.next() * 25, () => { ev.veh.reported = true; if (P.cur === ev.veh && !P.onFoot) { this.raiseHeat(1, 'The owner reported their ' + ev.name + ' stolen', 'theft'); this.law.setDesc(); this.law.radioDesc(); } });
    if (ev.type === 'pedHit' && !P.onFoot) {
      const cop = this.copSeeing(P.x, P.z, 50);
      if (cop && !this.stop) this.beginStop(cop, 'rash', {});
      // nobody in uniform saw it, but someone on the footpath took the number
      else if (!cop && (ev.speed || 0) > 4) this.law.report(1, 'Hit and run', 'hitrun', ev.x, ev.z, { victim: ev.p });
    }
  }
  raiseHeat(n, why, charge = 'theft') {
    const G = this.g;
    if (G.free) return;
    const was = this.heat;
    if (charge) this.charges.add(charge);
    // heat is points underneath (0–100), the level is what they add up to: a pickpocket gets you Noticed, a killing
    // Pursuit, and only a run of it all a Manhunt; the closer to the top, the less each new thing adds
    // heat counts crimes while they're on you (a killing weighs more): 1 gets you Noticed, 3 Wanted, 7 Pursuit,
    // 15 Nakabandi, 25 Manhunt
    const add = n <= 1 ? 1 : n === 2 ? 1.5 : 2.5;
    this.pts = Math.min(30, (this.pts || 0) + add);
    this.heat = levelOf(this.pts);
    this.unseenT = 0;
    this.lastSeen = { x: G.player.x, z: G.player.z };
    if (this.heat > was) { G.hud.toast(`${LEVELS[this.heat]}`, `${why} · ${FINES[this.topCharge()].name}, ${FINES[this.topCharge()].law}`, 'bad', 3.6); G.audio.siren(0.001, 0); }
  }
  topCharge() { return CHARGE_ORDER.find(c => this.charges.has(c)) || 'theft'; }
  clearCharges() { this.charges.clear(); }
  clearMarshals() { for (const m of this.marshals) m.dispose(); this.marshals = []; }
  updateHeat(dt) {
    const G = this.g, P = G.player;
    // who comes, by level: Noticed (a beat marshal), Wanted (two), Pursuit (two and a patrol jeep), Nakabandi
    // (checkpoints at the junctions ahead too), Manhunt (more of everyone)
    // more crimes within a level bring more of them, not a higher level
    const H = this.heat, extra = Math.min(2, Math.floor(((this.pts || 0) - HEAT_AT[H]) / 2));
    const wantBikes = [0, 1, 2, 2, 3, 4][H] + (H ? extra : 0), wantJeeps = [0, 0, 0, 1, 1, 2][H] + (H >= 3 ? Math.min(1, extra) : 0);
    const bikes = this.marshals.filter(m => !m.jeep).length, jeeps = this.marshals.length - bikes;
    if ((this._spT = (this._spT || 0) - dt) <= 0 && (bikes < wantBikes || jeeps < wantJeeps)) { this._spT = 4; this.spawnMarshal(jeeps < wantJeeps && (bikes >= wantBikes || this.rng.chance(0.5)) ? 'jeep' : 'bike'); }
    this.nakabandi(dt);
    let seen = false, nearest = 1e9, sirenPan = 0;
    for (let i = this.marshals.length - 1; i >= 0; i--) {
      const m = this.marshals[i];
      m.update(dt);
      const d = m.catchDist();
      if (m.sees) { seen = true; this.lastSeen = { x: P.x, z: P.z }; }
      if (m.pursuing && m.mode === 'drive' && d < nearest) { nearest = d; this.sirenAt = { x: m.veh.x, z: m.veh.z }; const hx = Math.cos(P.th), hz = Math.sin(P.th); sirenPan = clamp((-(m.veh.x - P.x) * hz + (m.veh.z - P.z) * hx) / (d || 1), -1, 1); }
      if ((this.heat === 0 && d > 90) || d > 520) { m.dispose(); this.marshals.splice(i, 1); continue; }
      // caught?
      if (this.heat > 0 && !this.stop && !this.grab && m.stunT <= 0) {
        const slow = P.onFoot ? d < 2.6 : (d < 6 && Math.abs(P.v) < 2.2);
        m.catchT = slow ? (m.catchT || 0) + dt : 0;
        if (m.catchT > (P.onFoot ? 0.4 : 1.2)) this.caught(m);
      }
    }
    let pl = this.heat > 0 && nearest < 1e8 ? clamp(1.4 - nearest / 160, 0, 1) : 0; const em = G.emSiren || 0;
    if (G.dutySiren && G.dutySiren > pl) { pl = G.dutySiren; this.sirenAt = { x: G.player.x, z: G.player.z }; }     // your own siren, on police duty
    G.audio.sirenAt = em > pl ? G.emSirenAt : this.sirenAt;
    G.audio.siren(Math.max(pl, em), em > pl ? G.emPan || 0 : sirenPan);
    if (this.heat > 0) {
      // out of sight they search (where you were last seen, then the roads round it, wider and wider); only when a
      // level's whole search has turned up nothing do they ease off one level, and start searching again at that one
      if (seen) this.unseenT = 0; else this.unseenT += dt * this.law.coolMul();
      const was = this.heat, hold = SEARCH[was] || 40;
      if (!seen && this.unseenT > hold) { this.pts = was > 1 ? HEAT_AT[was - 1] : 0; this.unseenT = 0; }
      this.heat = levelOf(this.pts || 0);
      if (this.heat < was) {
        if (this.heat === 0) { G.hud.toast('You lost them', 'The police have given up, for now', 'meter', 3); this.say('m_lost', null, true); this.clearCharges(); }
        else G.hud.toast(LEVELS[this.heat], 'Fewer of them looking', 'info', 2);
      }
      // the ring: full while they see you, the search running down while they don't
      if (this.heat > 0) G.hud.setHeat(this.heat, seen, seen ? 1 : 1 - this.unseenT / (SEARCH[this.heat] || 40), LEVELS[this.heat], this.marshals.length + (this.naka ? 1 : 0));
      else G.hud.setHeat(0);
    } else G.hud.setHeat(0);
  }
  // checkpoints (nakabandi): barricades across a junction on the road ahead of you, a jeep and constables with lathis;
  // squeeze through the gap at speed or get stopped
  nakabandi(dt) {
    const G = this.g, P = G.player, W = this.W;
    if (this.heat < 4) { this.clearNaka(); return; }
    if (this.naka && Math.hypot(this.naka.x - P.x, this.naka.z - P.z) > 450) this.clearNaka();
    if (this.naka || (this._nkT = (this._nkT || 0) - dt) > 0) { if (this.naka) this.nakaTick(dt); return; }
    this._nkT = 6;
    const hx = Math.cos(P.th || 0), hz = Math.sin(P.th || 0);
    const n = W.graph.nearest(P.x + hx * 160, P.z + hz * 160, 60, e => e.rank >= 3);
    if (!n) return;
    const t = W.graph.at(n.e, n.s), rx = -t[3], rz = t[2], hw = n.e.w / 2;
    if (G.inView && G.inView(t[0], t[1]) && Math.hypot(t[0] - P.x, t[1] - P.z) < 120) return;
    const tag = 7.7e6 + Math.floor(this.rng.next() * 1e5), group = new THREE.Group(), stripes = Marshal.stripes || (Marshal.stripes = (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d', { willReadFrequently: true });
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f2f2f2' : '#d42020'; x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16, 32); x.lineTo(i * 16 - 16, 32); x.fill(); }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 });
    })());
    // two barricades from either kerb, a gap in the middle a vehicle can just get through
    const C = W.collision; C.tag = tag;
    for (const sd of [1, -1]) {
      const a0 = sd * hw, a1 = sd * 1.4, ax = t[0] + rx * a0, az = t[1] + rz * a0, bx = t[0] + rx * a1, bz = t[1] + rz * a1;
      const L = Math.hypot(bx - ax, bz - az), bar = new THREE.Mesh(new THREE.BoxGeometry(L, 0.32, 0.12), stripes);
      bar.position.set((ax + bx) / 2, 0.85, (az + bz) / 2); bar.rotation.y = -Math.atan2(bz - az, bx - ax); group.add(bar);
      for (const f of [0, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a2c30 })); leg.position.set(f ? bx : ax, 0.45, f ? bz : az); leg.rotation.y = bar.rotation.y; group.add(leg); }
      C.addSeg(ax, az, bx, bz, 2);
    }
    C.tag = 0;
    const jeep = buildPoliceJeep(); jeep.group.position.set(t[0] + rx * (hw + 2.4) + t[2] * 6, W.surf.height(t[0], t[1]), t[1] + rz * (hw + 2.4) + t[3] * 6); jeep.group.rotation.y = -Math.atan2(t[3], t[2]); group.add(jeep.group);
    G.scene.add(group);
    const cops = [];
    for (const sd of [1, -1]) {
      const look = W.kit ? W.kit.randomLook(this.rng, { role: 'police' }) : null; if (!look) continue;
      const p = G.people.spawnAt(look, t[0] + rx * sd * (hw - 0.6) - t[2] * 1.5, t[1] + rz * sd * (hw - 0.6) - t[3] * 1.5, 'kaka'); if (!p) continue;
      p.cop = true; p.crew = true; p.fixed = true; p.lathi = true; p.mode = 'stand'; p.wait = 1e9; p.anchor = { x: p.x, z: p.z, fx: t[0], fz: t[1] }; p.anim = null;
      cops.push(p);
    }
    this.naka = { x: t[0], z: t[1], group, tag, cops, lights: jeep.lights, t: 0 };
    G.vb && G.vb.radio(6, t[0], t[1]);
    G.hud.toast('Nakabandi ahead', 'Checkpoints going up on the roads around you', 'bad', 3.2);
  }
  nakaTick(dt) {
    const N = this.naka, G = this.g, P = G.player;
    N.t += dt; const f = Math.sin(N.t * 14) > 0; N.lights.red.visible = f; N.lights.redOff.visible = !f; N.lights.blue.visible = !f; N.lights.blueOff.visible = f;
    // stopped at the barricade: that's you caught; through the gap at speed: the stinger
    const d = Math.hypot(N.x - P.x, N.z - P.z);
    if (d < 4 && !P.onFoot && Math.abs(P.v) > 4 && P.cur) this.law.flatten(P.cur, 'The stinger at the nakabandi shredded your tyres');
    if (d < 7 && Math.abs(P.v || 0) < 1.5 && !this.stop && N.cops[0]) { const m = this.marshals[0]; if (m) this.caught(m); }
  }
  clearNaka() {
    const N = this.naka; if (!N) return;
    const G = this.g, L = G.people.list;
    G.scene.remove(N.group); this.W.collision.removeTag(N.tag, [N.x - 30, N.z - 30, N.x + 30, N.z + 30]);
    for (const p of N.cops) { const i = L.indexOf(p); if (i >= 0) { if (p.body) p.body.release(); L.splice(i, 1); } }
    this.naka = null;
  }
  roleFor(kind) {
    const violent = ['assault', 'murder', 'hitrun', 'blast'].some(c => this.charges.has(c));
    if (kind === 'jeep' && this.heat >= 5 && violent) return 'qrt';
    if ([...this.charges].every(c => TRAFFIC_CH.has(c)) && this.charges.size) return 'traffic';
    return 'beat';
  }
  spawnMarshal(kind = 'bike') {
    const G = this.g, P = G.player, W = this.W;
    const near = this.lastSeen || { x: P.x, z: P.z };
    for (let k = 0; k < 40; k++) {
      const a = this.rng.next() * Math.PI * 2, r = (this.heat <= 1 ? 55 : 85) + this.rng.next() * (this.heat <= 1 ? 45 : 70);
      const x = near.x + Math.cos(a) * r, z = near.z + Math.sin(a) * r;
      const e = W.graph.nearest(x, z, 30, e => e.rank >= 2);
      if (!e) continue;
      const t = W.graph.at(e.e, e.s);
      if (G.inView && G.inView(t[0], t[1]) && k < 30) continue;
      this.marshals.push(new Marshal(this, t[0], t[1], Math.atan2(P.z - t[1], P.x - t[0]), kind, this.roleFor(kind)));
      return;
    }
  }
  caught(m) {
    const G = this.g, P = G.player;
    const kind = this.topCharge();
    // after a chase, or for anything serious: hands on you, no talking. You can try to wrench free (harder the more
    // of them there are); otherwise it's the cuffs. Only a minor matter gets a conversation
    if ((this.heat >= 2 || ['murder', 'assault', 'hitrun', 'blast'].some(c => this.charges.has(c))) && !this.grab) {
      this.grab = { m, t: 0, need: 4 + this.marshals.reduce((n, u) => n + (u.catchDist() < 10 ? 2 : 0), 0), got: 0 };
      P.busy = 999; G.hud.grab && G.hud.grab(true, 0); G.audio.thud && G.audio.thud(0.5); G.vb && G.vb.you('caught', true);
      this.law.radio('Hands on the suspect.');
      return;
    }

    m.cop.name = 'Beat marshal';
    this.stop = { cop: m.cop, kind, fine: FINES[kind].amt + (this.charges.has('disobey') && kind !== 'disobey' ? FINES.disobey.amt : 0), phase: 'talk', t: 0, info: {} };
    m.cop.marshal = m;
    G.player.busy = 0;
    this.openTalk();
  }
  // the grab: mash F for three seconds to break free; fail and they cuff you
  grabTick(dt) {
    const G = this.g, P = G.player, R = this.grab; if (!R) return;
    R.t += dt;
    if (G.input.took('KeyF')) { R.got++; G.audio.thud && G.audio.thud(0.15); }
    G.hud.grab && G.hud.grab(true, Math.min(1, R.got / R.need), 1 - R.t / 3);
    if (R.got >= R.need) {
      this.grab = null; P.busy = 0; G.hud.grab && G.hud.grab(false);
      R.m.stunT = 3; for (const q of R.m.foot) { q.fallen = 1.8; } this.raiseHeat(1, 'Broke free from arrest', 'fled');
      G.hud.toast('You wrench free', 'Shoved him off. Run!', 'meter', 2.2); G.vb && G.vb.you('flee', true); return;
    }
    if (R.t > 3) {
      this.grab = null; G.hud.grab && G.hud.grab(false);
      // what happens now depends on what you did: a beating if you fought them, then the cuffs
      if (this.charges.has('assault') || this.heat >= 4) { P.hp = Math.max(8, (P.hp ?? 100) - 18); G.audio.punch?.(); G.rig && G.rig.shake(0.4); G.hud.toast('Lathi charge', 'They don’t ask twice when you’ve fought them', 'bad', 2.6); }
      this.arrest(this.heat >= 3 ? 'Caught after a chase' : 'Caught');
    }
  }
  confiscate() {
    const P = this.g.player;
    if (P.cur && P.cur !== P.auto && !P.onFoot) P.abandon(this.g.traffic, true);
  }
  arrest(why, extra, kind) {
    const G = this.g, P = G.player;
    kind = kind || (this.stop && SERIOUS.has(this.stop.kind) ? this.stop.kind : this.topCharge());
    const fine = (this.stop && this.stop.kind === kind ? this.stop.total || FINES[kind].amt : FINES[kind].amt) + (extra ? 5000 : 0);
    const list = [...new Set([kind, ...this.charges])].filter(c => FINES[c]).map(c => ({ name: FINES[c].name, law: FINES[c].law }));
    const serious = SERIOUS.has(kind);
    this.charge(kind, fine, `Bail after arrest: ${FINES[kind].name}`);
    G.date && G.date.event('arrest', fine);
    if (G.lights && G.rng.chance(0.5)) G.lights.lose('Kept at the chowki with your other things');
    this.clearCharges();
    this.heat = 0; this.pts = 0; this.unseenT = 0; this.clearMarshals(); this.clearNaka();
    const ch = this.nearestChowki(P.x, P.z);
    // the cuffs first: hands behind your back, the click, a hand on your shoulder
    G.cuffT = 2.6; P.busy = 999; G.audio.cuffs ? G.audio.cuffs() : G.audio.thud && G.audio.thud(0.3);
    this.law.radio(`Suspect in custody. Bringing them to ${ch.name}.`);
    this.later(2.6, () => {
      // booked: a card, a night in the lock-up for anything serious, a court date
      const court = serious ? this.law.setCourt(list) : 'None, fine paid';
      this.law.booking({ chowki: ch.name, charges: list, bail: fine, night: serious, court });
      if (serious && G.setHour) { G.clock = (Math.floor((G.clock || 0) / 24) + 1) * 24 + 9; G.setHour(9); }
      G.hud.flash(`Taken to ${ch.name}`, `${FINES[kind].name} (${FINES[kind].law}). ${why}. ${serious ? 'A night in the lock-up, then out' : 'Out'} on bail · ${fmtRupees(fine)}`);
      // you walk out of the chowki; your auto has been brought round
      if (P.cur && P.cur !== P.auto && !P.onFoot) P.abandon(G.traffic, true);
      const spot = this.kerbSpot(ch.x, ch.z);
      P.teleportFoot(spot.x + spot.nx * 2.2, spot.z + spot.nz * 2.2, spot.th, G.traffic);
      P.moveAuto(spot.x, spot.z, spot.th, G.traffic);
      if (this.stop) { G.hud.closeStop(); this.endStop(); }
      P.busy = 0.5;
    });
  }
  kerbSpot(x, z) {
    const G = this.W.graph;
    const near = G.nearest(x, z, 120, e => e.rank >= 2) || G.nearest(x, z, 400);
    const t = G.at(near.e, Math.min(near.e.len - 2, Math.max(2, near.s)));
    const lat = near.e.w / 2 - 1.0;
    return { x: t[0] + t[3] * lat, z: t[1] - t[2] * lat, th: Math.atan2(t[3], t[2]), nx: t[3], nz: -t[2] };
  }

  // ---------------------------------------------------------------- towing
  updateTowing(dt) {
    const G = this.g, P = G.player;
    if ((this._twT = (this._twT || 0) - dt) > 0) return;
    this._twT = 1;
    for (const d of [...P.dropped]) {
      if (d.towed || d.safe) continue;            // safe: the parking spot by Shaniwar Wada you start from
      const v = d.veh, S = G.stand;
      if (S && Math.hypot(v.x - S.x, v.z - S.z) < 14) continue;   // the auto stand by the Wada is always legal
      const far = Math.hypot(v.x - P.x, v.z - P.z) > 75;
      let illegal = false;
      if (this.W.surf.isRoad(v.x, v.z)) {
        const near = this.W.graph.nearest(v.x, v.z, 12);
        if (near && near.e.rank >= 4) illegal = true;
      }
      d.illegalT = illegal && far && !(G.inView && G.inView(v.x, v.z)) ? (d.illegalT || 0) + 1 : 0;
      if (d.illegalT > 40) this.tow(d);
    }
  }
  tow(d) {
    const G = this.g, P = G.player, v = d.veh;
    const where = this.whereName(v.x, v.z);
    if (v !== P.auto) { P.removeDropped(d, G.traffic); v.dispose(); return; }
    const ch = this.nearestChowki(v.x, v.z);
    const spot = this.kerbSpot(ch.x, ch.z);
    P.moveAuto(spot.x, spot.z, spot.th, G.traffic);
    const dd = P.dropped.find(q => q.veh === P.auto);
    if (dd) dd.towed = { fee: TOW.three + TOW.fine, at: ch.name };
    this.towedAt = { x: spot.x, z: spot.z, name: ch.name };
    G.hud.sms('Pune Traffic Police', `Your auto ${this.plate} was towed from ${where} (no parking). Collect it at ${ch.name}.`, fmtRupees(TOW.three + TOW.fine), `${fmtRupees(TOW.three)} towing + ${fmtRupees(TOW.fine)} fine · marked on your map`);
  }
  // returns true if the player may take the towed vehicle (pays the release fee)
  release(d) {
    const fee = d.towed.fee;
    this.charge('noparking', fee, 'Towing + no-parking fine');
    d.towed = null; this.towedAt = null;
    this.g.audio.cash();
    this.g.hud.toast(`Paid ${fmtRupees(fee)}, auto released`, 'Park on the side lanes next time', 'meter', 3);
    return true;
  }

  // ---------------------------------------------------------------- voices
  say(id, who, radio = false, pri) {
    // police lines have variants (id, id.1, id.2): pick one so the same stop doesn't sound canned
    if (LINES[id + '.1']) { const n = LINES[id + '.2'] ? 3 : 2, k = Math.floor(this.rng.next() * n); if (k) id = id + '.' + k; }
    const G = this.g, P = G.player;
    // the voice bank: the same moment, said by this officer's kind of police (traffic, marshal, patrol, QRT)
    const vm = VBM[id] || (/^spot_/.test(id) ? 'chase' : null);
    if (G.vb && vm && !radio) { const src0 = who && (who.ped || who.veh || who); const role = who && who.marshal ? who.marshal.role : who && who.role ? who.role : 'traffic'; if (src0 && src0.x !== undefined && G.vb.police(role, vm, src0)) return id; }
    const L = LINES[id];
    if (!L) return;
    let vol = 1, pan = 0;
    const src = who && (who.ped || who.veh || who);
    if (src && src.x !== undefined && !radio) {
      const dx = src.x - P.x, dz = src.z - P.z, d = Math.hypot(dx, dz);
      vol = clamp(14 / (d + 8), 0.25, 1);
      pan = clamp((-dx * Math.sin(P.th) + dz * Math.cos(P.th)) / (d || 1), -1, 1) * 0.6;
    }
    // street chatter waits its turn; reactions don't talk over each other; police get through
    if (pri === undefined) pri = id.startsWith('s_') ? (/_(fall|hit|fight|flee|carjack_\w+)\d+$/.test(id) ? 1 : 0)
      : /^(sh|f)\d/.test(id) ? 1 : /^(d|h|c|b)\d/.test(id) ? 0 : 2;
    const spoken = src && src.x !== undefined && !radio ? G.audio.at(src.x, src.z, () => G.audio.voice(id, 1, 0, radio, pri), 1.6) : G.audio.voice(id, vol, pan, radio, pri);
    if (!spoken) return null;
    G.hud.say(L[0] === 'Traffic police' && who && who.name ? who.name : L[0], L[4], L[5], 4.2);
    return id;
  }
  markers() {
    const out = [];
    if (this.stop && this.stop.phase === 'wave') out.push({ x: this.stop.cop.x, z: this.stop.cop.z, kind: 'cop' });
    for (const m of this.marshals) { if (m.mode !== 'foot') out.push({ x: m.veh.x, z: m.veh.z, kind: 'marshal' }); for (const q of m.foot) out.push({ x: q.x, z: q.z, kind: 'footcop' }); }
    if (this.naka) out.push({ x: this.naka.x, z: this.naka.z, kind: 'naka', label: 'Nakabandi' });
    if (this.towedAt) out.push({ x: this.towedAt.x, z: this.towedAt.z, kind: 'tow' });
    // your own auto, wherever you left it
    const P = this.g.player;
    if (!this.towedAt && P && P.auto && (P.onFoot || P.cur !== P.auto)) out.push({ x: P.auto.x, z: P.auto.z, kind: 'tow', label: 'Your auto' });
    return out;
  }
}

// ---------------------------------------------------------------- a beat marshal on a motorcycle
const _g = new THREE.Vector3(), _pl = new THREE.Vector3();
const LEVELS = ['', 'Noticed', 'Wanted', 'Pursuit', 'Nakabandi', 'Manhunt'];
// the old police line ids → the voice bank's moments
const VBM = { stop_wave: 'wave', stop_check: 'docs', stop_helmet: 'docs', stop_signal: 'fine', stop_speed: 'fine', stop_wrong: 'fine', stop_horn: 'fine', r_pay: 'fine', r_plead_no: 'pleadno', r_plead_ok: 'pleadok', r_bribe_ok: 'bribeok', r_bribe_more: 'bribeok', r_bribe_no: 'bribeno', m_spot2: 'chase', m_caught: 'cuffs', cop_fight: 'chase', r_argue_no: 'pleadno', r_argue_ok: 'pleadok', r_clear: 'pleadok' };
// who comes for what: traffic police (hi-vis vests) for the road, beat marshals for street crime, armed QRT in black
// at a Manhunt for something violent
const TRAFFIC_CH = new Set(['signal', 'speed', 'rash', 'helmet', 'horn', 'disobey', 'suspended', 'wrongway']);
function dressRole(look, role) {
  if (role === 'traffic') { look.top = new THREE.Color(0xd9f03a).convertSRGBToLinear(); look.pat = 1; look.patCol = new THREE.Color(0xc8ccd0).convertSRGBToLinear(); }
  else if (role === 'qrt') { look.top = new THREE.Color(0x272b24).convertSRGBToLinear(); look.bottom = new THREE.Color(0x22261f).convertSRGBToLinear(); look.cut = new THREE.Vector4(0.92, 1, 0.6, 0); look.acc = 'helmet'; look.helmetCol = new THREE.Color(0x111111); look.helmetBand = false; }
}
// the points each level starts at
const HEAT_AT = [0, 1, 3, 7, 15, 25];
// how long (s) they keep searching at each level once they've lost sight of you, before easing off a level (and
// searching again at that one); hiding indoors, in a crowd, or not looking like the description runs it down faster
const SEARCH = [0, 40, 60, 90, 120, 160];
const levelOf = (p) => HEAT_AT.filter((t, i) => i > 0 && p >= t).length;
// a police unit: a beat marshal on a motorcycle, or a patrol jeep with two constables. They drive like trained
// drivers (left of the lane, slowing for bends, stopping at red when they're not chasing anyone, braking for
// people, never through traffic), chase with the siren when they've seen you, and get out and run after you
// when you're on foot (a lathi in hand)
class Marshal {
  constructor(police, x, z, th, kind = 'bike', role = 'beat') {
    const G = police.g, W = police.W;
    this.P = police; this.G = G; this.W = W; this.kind = kind; this.role = role; this.jeep = kind === 'jeep'; this.mode = 'drive'; this.foot = [];
    this.veh = new Vehicle(W, G.scene, G.vmats, this.jeep ? 'suv' : 'bike', [0.92, 0.92, 0.9]);
    this.veh.reset(x, z, th);
    this.veh.y = W.surf.height(x, z);
    this.veh.spec = this.jeep ? { ...specOf('suv'), acc: 3.0, vTop: 24 } : { ...specOf('bike'), acc: 4.2, vTop: 27, mu: 9 };
    if (this.jeep) { this.initJeep(police); return; }
    this.cop = { name: 'Beat marshal', x, z, mood: police.rng.next() * 0.6, corrupt: police.rng.chance(0.35), bribes: 0, busyT: 0, post: { x, z } };
    this.stunT = 0; this.routeT = 0; this.route = null; this.stuckT = 0; this.revT = 0; this.sees = false; this.spotT = 0;
    // rider: khaki uniform, white helmet
    if (W.kit) {
      const look = W.kit.randomLook(police.rng, { role: 'police' });
      // a crisp light-khaki shirt, long sleeves, darker trousers, black shoes: reads as a cop from across the road
      look.top = new THREE.Color(0xc9ae76).convertSRGBToLinear(); look.bottom = new THREE.Color(0x6a5735).convertSRGBToLinear();
      look.cut = new THREE.Vector4(0.92, 1, 0.6, 0); look.shoe = new THREE.Color(0x111111);
      look.acc = 'helmet'; look.helmetCol = new THREE.Color(0xf2f2ee).convertSRGBToLinear(); look.helmetBand = true;
      dressRole(look, role);
      this.H = W.kit.create(look);
      this.H.acc.color.set(0xf2f2f2);
      G.scene.add(this.H.holder);
      this.H.play('drive');
    }
    // red/blue light bar
    const lg = new THREE.BoxGeometry(0.1, 0.07, 0.34);
    this.lightR = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
    this.lightB = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: 0x2050ff, toneMapped: false }));
    this.lightR.position.set(-0.85, 1.12, 0.1); this.lightB.position.set(-0.85, 1.12, -0.1);
    this.lightR.scale.z = this.lightB.scale.z = 0.5;
    this.veh.tilt.add(this.lightR, this.lightB);
    this.lightR.scale.z = this.lightB.scale.z = 0.8;
    // a POLICE board on the carrier box behind the rider
    if (!Marshal.board) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#1d3f8f'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#ffd23a'; x.fillRect(0, 84, 256, 12);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 30px Mukta, sans-serif'; x.fillText('पोलीस', 128, 30); x.font = '800 30px Inter, Arial, sans-serif'; x.fillText('POLICE', 128, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      Marshal.board = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
    }
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.42), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
    box.position.set(-0.98, 0.95, 0); this.veh.tilt.add(box);
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), Marshal.board); bd.position.set(-1.155, 0.95, 0); bd.rotation.y = -Math.PI / 2; this.veh.tilt.add(bd);
    for (const sd of [1, -1]) { const sb = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.12), Marshal.board); sb.position.set(-0.98, 0.95, sd * 0.212); sb.rotation.y = sd > 0 ? 0 : Math.PI; this.veh.tilt.add(sb); }
    makeService(this.veh);
    this.agent = this.veh.agent;
    G.traffic.extra = G.traffic.extra || [];
    G.traffic.extra.push(this.agent);
  }
  get x() { return this.veh.x; }
  get z() { return this.veh.z; }
  initJeep(police) {
    const G = this.G, W = this.W, v = this.veh;
    for (const c of v.tilt.children) c.visible = false;
    const md = this.md = buildPoliceJeep(); v.tilt.add(md.group); v.md = md;
    v.spec.L = md.dims.L; v.spec.W = md.dims.W; v.agent.L = md.dims.L; v.agent.W = md.dims.W; makeService(v);
    this.cop = { name: 'Patrol', x: v.x, z: v.z, mood: police.rng.next() * 0.6, corrupt: police.rng.chance(0.3), bribes: 0, busyT: 0, post: { x: v.x, z: v.z } };
    this.stunT = 0; this.routeT = 0; this.route = null; this.stuckT = 0; this.revT = 0; this.sees = false; this.spotT = 0;
    this.crew = [];
    if (W.kit) for (const [sx, sy, sz] of md.seats) {
      const look = W.kit.randomLook(police.rng, { role: 'police' }); dressRole(look, this.role); const H = W.kit.create(look);
      H.holder.position.set(sx - 0.05, sy - 0.62, sz); v.tilt.add(H.holder); H.play('drive');
      this.crew.push({ H, look });
    }
    this.agent = v.agent; G.traffic.extra = G.traffic.extra || []; G.traffic.extra.push(this.agent);
  }
  // how close any of us is to you (on the bike / in the jeep, or on foot)
  catchDist() {
    const P = this.G.player;
    let d = this.mode === 'foot' ? 1e9 : Math.hypot(this.veh.x - P.x, this.veh.z - P.z);
    for (const p of this.foot) d = Math.min(d, Math.hypot(p.x - P.x, p.z - P.z));
    return d;
  }
  update(dt) {
    const G = this.G, W = this.W, P = G.player, v = this.veh, police = this.P;
    this.stunT -= dt;
    const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz);
    const eye = this.mode === 'foot' && this.foot[0] ? this.foot[0] : v;
    const de = Math.hypot(P.x - eye.x, P.z - eye.z);
    // they're looking for a description: close up they know you, further off only if you still look like it
    this.sees = police.heat > 0 && (de < 22 || (de < 75 && this.W.collision.ray(eye.x, eye.z, P.x, P.z) > 0.97)) && police.law.matches(de);
    if (this.sees) police.law.setDesc();
    if (this.sees && !this.wasSeeing && this.spotT <= 0 && de < 60) { police.say(Math.random() < 0.75 ? 'spot_' + police.topCharge() : 'm_spot2', this); this.spotT = 12; }
    this.spotT -= dt;
    this.wasSeeing = this.sees;
    const pursuing = this.pursuing = police.heat > 0 && (this.sees || police.unseenT < 20);
    if (this.mode === 'foot') { this.footTick(dt); this.animate(dt, false); return; }
    // you're on foot and they've seen you close: out of the saddle (or the jeep) and after you
    // (close, or as close as the road gets them: you're off it, or they've come to a stop)
    const offRoad = P.onFoot && !W.surf.isRoad(P.x, P.z);
    if (police.heat > 0 && P.onFoot && this.stunT <= 0 && ((this.sees && (d < 45 || (d < 75 && (offRoad || Math.abs(v.v) < 1.5)))) || d < 18)) { this.dismount(); return; }
    let tx, tz, want, close = false;
    // each of them has their own reactions and nerve: they go where they last saw you a moment ago (a sudden turn and
    // they overshoot), and only as fast as they're willing to ride
    if (!this.skill) this.skill = { lag: 0.7 + police.rng.next() * 1.1, top: 0.82 + police.rng.next() * 0.2 };
    const trail = this.trail || (this.trail = []); trail.push({ x: P.x, z: P.z, t: police.g.t || 0 });
    while (trail.length > 2 && (police.g.t || 0) - trail[1].t > this.skill.lag) trail.shift();
    if (police.heat > 0) {
      let ls = this.sees ? trail[0] : police.lastSeen || { x: P.x, z: P.z };
      // got to where you were last seen and you're not there: each of them sweeps the streets round it, further out
      // the longer it takes (a fresh sighting, from them, a witness or a camera, brings them straight back)
      if (this.sees) this.srch = null;
      else {
        const c = police.lastSeen || ls, there = Math.hypot(v.x - c.x, v.z - c.z) < 20 || this.srch;
        if (there && (!this.srch || this.srch.of !== c || Math.hypot(v.x - this.srch.x, v.z - this.srch.z) < 15 || (this.srch.t -= dt) < 0)) {
          const r = 40 + Math.min(220, police.unseenT * 2.5), a = police.rng.next() * Math.PI * 2;
          this.srch = { of: c, x: c.x + Math.cos(a) * r * (0.5 + police.rng.next() * 0.5), z: c.z + Math.sin(a) * r * (0.5 + police.rng.next() * 0.5), t: 18 };
        }
        if (this.srch) ls = this.srch;
      }
      tx = ls.x; tz = ls.z;
      want = (pursuing ? (this.jeep ? 16 : 18) : 11) * this.skill.top;
      // close behind you and you've slowed down: up alongside, on your right, to wave you over
      if (this.sees && !P.onFoot && d < 18 && Math.abs(P.v) < 5) {
        const S = P.spec || { W: 0.6 }; close = true;
        tx = P.x + Math.cos(P.th) * 1.5 - Math.sin(P.th) * (S.W / 2 + 1.2); tz = P.z + Math.sin(P.th) * 1.5 + Math.cos(P.th) * (S.W / 2 + 1.2);
        want = Math.abs(P.v) + clamp((d - 2.5) * 0.9, 0, 5);
      }
    } else { tx = v.x + Math.cos(v.th) * 60; tz = v.z + Math.sin(v.th) * 60; want = 8; }
    if (this.stunT > 0) want = 0;
    this.drive(tx, tz, want, dt, close, pursuing);
    this.cop.x = v.x; this.cop.z = v.z;
    this.animate(dt, pursuing);
  }
  // the lights only with the siren (a patrol just drives); the rider / crew posed
  animate(dt, on) {
    const v = this.veh, t = performance.now() / 1000, flash = Math.sin(t * 14) > 0;
    if (this.jeep) {
      const Lg = this.md.lights; Lg.red.visible = on && flash; Lg.redOff.visible = !(on && flash); Lg.blue.visible = on && !flash; Lg.blueOff.visible = !(on && !flash);
      for (const w of this.md.wheels) { w.spin.rotation.z -= (v.v || 0) * dt / w.r; if (w.front) w.steer.rotation.y = -(v.steer || 0); }
      if (Math.hypot(v.x - this.G.player.x, v.z - this.G.player.z) < 70) for (const c of this.crew) if (c.H.holder.visible) c.H.mixer.update(dt);
      return;
    }
    this.lightR.visible = on && flash; this.lightB.visible = on && !flash;
    if (this.H && this.H.holder.visible) {
      v.tilt.updateWorldMatrix(true, false);
      const p = new THREE.Vector3(0.0 + RIDER_HIPS, 0.95 - 0.62, 0).applyMatrix4(v.tilt.matrixWorld);
      this.H.holder.position.copy(p);
      this.H.holder.rotation.set(0, -v.th, 0);
      this.H.holder.rotateX(v.lean || 0);
      this.H.mixer.update(dt);
      this.H.holder.updateMatrixWorld(true);
      const m = v.tilt.matrixWorld;
      leanRider(this.H, _pl.set(0, 0, 1).transformDirection(m), RIDER_LEAN.bike);
      for (const sd of [1, -1]) { _g.set(0.6, 1.08, 0.34 * sd).applyMatrix4(m); _pl.set(-0.2, -0.7, sd).transformDirection(m); ikArm(this.H, sd > 0 ? 'r' : 'l', _g, _pl, 1); }
    }
  }
  drive(tx, tz, want, dt, close, pursuing) {
    const G = this.G, W = this.W, v = this.veh;
    // on the roads like anyone with sense (vehicles/driver.js); only pulling up alongside you is done by hand
    if (!close) {
      if (!this.drv) this.drv = new Driver(v, G, { lane: this.jeep ? 1.6 : 1.2 });
      this.drv.o.emergency = !!pursuing; this.drv.o.signals = !pursuing; this.drv.o.offroadEnd = pursuing && G.player.onFoot;
      this.drv.goTo(tx, tz); this.drv.update(dt, want);
      v.y = v.y || W.surf.height(v.x, v.z);
      return;
    }
    this.routeT -= dt;
    if (this.routeT <= 0) { this.routeT = 1.3; this.route = null; const a = W.graph.nearest(v.x, v.z, 40), b = W.graph.nearest(tx, tz, 60); if (a && b) { const r = W.graph.route(a, b, true); if (r) this.route = W.graph.routePolyline(r, a, b); } }
    const hx = Math.cos(v.th), hz = Math.sin(v.th);
    let ax = tx, az = tz, bend = 0;
    if (!close && this.route && this.route.length >= 4) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < this.route.length; i += 2) { const q = (this.route[i] - v.x) ** 2 + (this.route[i + 1] - v.z) ** 2; if (q < bd) { bd = q; bi = i; } }
      const look = Math.min(this.route.length - 2, bi + 2 * Math.max(1, Math.round((6 + Math.abs(v.v) * 0.6) / 8)));
      ax = this.route[look]; az = this.route[look + 1];
      const nx = this.route[Math.min(this.route.length - 2, look + 2)] - ax, nz = this.route[Math.min(this.route.length - 1, look + 3)] - az, nl = Math.hypot(nx, nz) || 1;
      ax += (nz / nl) * (this.jeep ? 1.6 : 1.2); az += (-nx / nl) * (this.jeep ? 1.6 : 1.2);        // keep left
      const far = Math.min(this.route.length - 2, look + 6); bend = Math.abs(wrapAngle(Math.atan2(this.route[far + 1] - az, this.route[far] - ax) - v.th));
      // not chasing anyone: the signal is obeyed like anyone else
      if (!pursuing && G.traffic.signals) {
        const n = W.graph.nearest(v.x + hx * 14, v.z + hz * 14, 10);
        const node = n && W.graph.nodes[n.s < n.e.len / 2 ? n.e.a : n.e.b];
        if (node && node.signal && Math.hypot(node.x - v.x, node.z - v.z) < 22 && Math.hypot(node.x - v.x, node.z - v.z) > 6 && G.traffic.signals.stateForAngle(node.i, v.th) === 'r') want = 0;
      }
    }
    // what's in front: a gap to one side, else wait behind; people in the road: stop
    if ((this.scanT = (this.scanT || 0) - dt) <= 0) {
      this.scanT = 0.2;
      const blocked = (lat) => {
        let b = 99;
        G.traffic.near(v.x + hx * 7, v.z + hz * 7, 10, (o) => { if (o === v.agent || (!o.T && !o.parked) || o.isPlayer) return; const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz, ac = -rx * hz + rz * hx, w = (o.T ? o.T.W : o.W || 1.8) / 2 + (this.jeep ? 1.2 : 0.6); if (al > 0.8 && al < 14 && Math.abs(ac - lat) < w) b = Math.min(b, al); });
        for (const p of G.people.list) { if (p.hidden || p.cop || p.crew) continue; const rx = p.x - v.x, rz = p.z - v.z, al = rx * hx + rz * hz, ac = -rx * hz + rz * hx; if (al > 0.5 && al < 11 && Math.abs(ac - lat) < (this.jeep ? 1.7 : 1.2)) b = Math.min(b, al); }
        return b;
      };
      this.block = close ? 99 : blocked(0); this.off = 0;
      if (this.block < 12) for (const c of this.jeep ? [2.2, -2.2] : [1.3, -1.3, 2.4, -2.4]) if (blocked(c) > 13) { this.off = c; break; }
    }
    ax += -hz * (this.off || 0) * 1.4; az += hx * (this.off || 0) * 1.4;
    if (pursuing && (this.yieldT = (this.yieldT || 0) - dt) <= 0) {
      this.yieldT = 0.5;
      G.traffic.near(v.x + hx * 12, v.z + hz * 12, 14, (o) => { if (!o.T || o.jc || o.isPlayer) return; const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz; if (al < 0 || al > 26 || Math.random() > 0.7) return; const side = -rx * hz + rz * hx; o.latT = o.lat + (side > 0 ? 1 : -1) * 1.3; });
    }
    let target = want * (bend > 0.9 ? 0.45 : bend > 0.45 ? 0.7 : 1);
    if (!this.off && (this.block ?? 99) < 12) target = Math.min(target, Math.max(0, (this.block - 3.5) * 0.9));
    const diff = wrapAngle(Math.atan2(az - v.z, ax - v.x) - v.th);
    const inp = { throttle: 0, brake: 0, steer: clamp(diff * (this.jeep ? 2.0 : 2.4), -1, 1), handbrake: false };
    if (this.revT > 0) { this.revT -= dt; inp.brake = 1; inp.steer = -(this.revSteer || 1); v.reverse = true; if (this.revT <= 0) v.reverse = false; }
    else {
      v.reverse = false;
      // a bike only turns while it's rolling: a little throttle always
      if (v.v < target) inp.throttle = Math.abs(diff) < 0.4 ? 1 : Math.abs(diff) < 1.2 ? 0.7 : (this.jeep ? 0.5 : 0.45);
      if (v.v > target + 1.2 || target === 0) { inp.brake = v.v > target + 4 ? 1 : 0.6; inp.throttle = 0; }
      if (want > 0 && target > 0.5 && Math.abs(v.v) < 0.4) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
      if (this.stuckT > 2.2) { this.stuckT = 0; this.revT = 1.1; this.revSteer = inp.steer || 1; this.block = 99; }
    }
    v.update(dt, inp, G.traffic);
    for (const e of v.events) if (e.type === 'crash' || e.type === 'scrape' || e.type === 'hit') this.lastHit = e.type + ':' + (e.kind ?? e.who);
    v.y = v.y || W.surf.height(v.x, v.z);
  }
  // out and after you: the marshal (helmet on, lathi out), or the jeep's two constables
  dismount() {
    const G = this.G, v = this.veh, P = G.player, police = this.P;
    this.mode = 'foot'; v.v = 0;
    const hx = Math.cos(v.th), hz = Math.sin(v.th);
    const crew = this.jeep ? this.crew.map(c => c.look) : [this.H ? this.H.look : null];
    crew.forEach((look, i) => {
      if (!look) return;
      const sd = i ? -1 : 1, x = v.x - hz * sd * 1.3, z = v.z + hx * sd * 1.3;
      const p = G.people.spawnAt(look, x, z, 'kaka'); if (!p) return;
      p.cop = true; p.crew = true; p.fixed = false; p.lathi = true; p.mode = 'chase'; p.chase = P; p.runSp = 4.2 + police.rng.next() * 0.6; p.chaseT = 0; p.unit = this; p.anim = null;
      this.foot.push(p);
    });
    if (this.H) this.H.holder.visible = false;
    for (const c of this.crew || []) c.H.holder.visible = false;
    police.say('m_spot2', this);
  }
  // after you on foot; back to the vehicle once you've got away in one (or they've lost you)
  footTick(dt) {
    const G = this.G, P = G.player, v = this.veh, police = this.P;
    let near = 1e9; for (const p of this.foot) near = Math.min(near, Math.hypot(p.x - P.x, p.z - P.z));
    const lost = police.heat === 0 || (!P.onFoot && near > 22) || near > 90;
    this.backT = lost ? (this.backT || 0) + dt : 0;
    const L = G.people.list;
    for (let i = this.foot.length - 1; i >= 0; i--) {
      const p = this.foot[i];
      if (!L.includes(p) || p.fallen > 0) { if (!L.includes(p)) this.foot.splice(i, 1); continue; }
      if (this.backT > 3) { p.chase = { x: v.x, z: v.z }; p.runSp = 2.6; if (Math.hypot(p.x - v.x, p.z - v.z) < 1.8) { if (p.body) p.body.release(); L.splice(L.indexOf(p), 1); this.foot.splice(i, 1); } }
      else p.chase = P;
    }
    if (!this.foot.length) { this.mode = 'drive'; this.backT = 0; if (this.H) this.H.holder.visible = true; for (const c of this.crew || []) c.H.holder.visible = true; }
  }
  los(x, z) { return this.W.collision.ray(this.veh.x, this.veh.z, x, z) > 0.97; }
  dispose() {
    const G = this.G, L = G.people.list;
    for (const p of this.foot) { const i = L.indexOf(p); if (i >= 0) { if (p.body) p.body.release(); L.splice(i, 1); } }
    this.foot = [];
    this.veh.dispose();
    if (this.H) { G.scene.remove(this.H.holder); this.H.dispose(); }
    for (const c of this.crew || []) c.H.dispose && c.H.dispose();
    const ex = G.traffic.extra; if (ex) { const i = ex.indexOf(this.agent); if (i >= 0) ex.splice(i, 1); }
  }
}
