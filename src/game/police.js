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
import { Vehicle, specOf } from '../vehicles/vehicle.js';
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
  pickpocket: { amt: 3000, name: 'Pickpocketing (theft)', law: 'BNS s.303' },
  stolengoods: { amt: 10000, name: 'Carrying stolen property', law: 'BNS s.317' },
  racing:    { amt: 5000, name: 'Racing on a public road', law: 'MV Act s.189' },
};
// what you're wanted for decides what the marshals shout and what you're booked under when caught
const SERIOUS = new Set(['theft', 'assault', 'hurt', 'hitrun', 'fled', 'pickpocket']);
const CHARGE_ORDER = ['assault', 'hitrun', 'theft', 'pickpocket', 'hurt', 'fled', 'disobey'];
const TOW = { two: 200, three: 200, four: 400, fine: 500 };   // towing charges + no-parking fine
const SPEED_LIMIT = 50;                                         // km/h on city arterials
const COP_NAMES = ['Havaldar Shinde', 'Havaldar Jadhav', 'PSI Kulkarni', 'Havaldar Pawar', 'Havaldar Gaikwad', 'ASI Deshmukh', 'Havaldar More', 'PSI Patil', 'Havaldar Sawant', 'Havaldar Kamble'];
const STOP_LINE = { signal: 'stop_signal', helmet: 'stop_helmet', wrong: 'stop_wrong', speed: 'stop_speed', horn: 'stop_horn', check: 'stop_check', rash: 'stop_speed', suspended: 'stop_check', theft: 'caught_theft', assault: 'caught_assault', hurt: 'caught_hurt', hitrun: 'caught_hitrun', fled: 'caught_fled', disobey: 'caught_disobey', pickpocket: 'caught_pickpocket' };

export class Police {
  constructor(game) {
    this.g = game; this.W = game.W;
    this.rng = new RNG(4848);
    this.dues = [];                // pending e-challans {what, amt, where, at}
    this.history = [];             // last few challans for the menu
    this.record = {};              // offences on your record by kind
    this.licence = { until: 0 };   // suspended until this many game-hours
    this.heat = 0; this.unseenT = 0; this.lastSeen = null; this.charges = new Set();
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
      if (d < 18 && Math.abs(P.v) < 0.8) { s.phase = 'approach'; P.busy = 999; }
      else if (d > 65 || s.t > 16) {
        // drove off: the number is noted, the challan grows (and if it's stolen, word gets out)
        this.say('stop_ignored', cop);
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
        { id: 'bribe', t: 'Offer chai-pani', s: `${fmtRupees(s.bribe)} in hand, quietly` },
      ];
      if (serious) s.opts[2] = { id: 'run', t: P.onFoot ? 'Run for it' : 'Floor it', s: 'They will chase you' };
    }
    G.hud.openStop({
      who: cop.name, kind: (s.kind === 'check' && s.found ? FINES[s.found].name : FINES[s.kind].name) + (s.kind !== 'disobey' && this.charges.has('disobey') && serious ? ' + ignoring a police signal' : ''), law: FINES[s.kind].law,
      amt: s.kind === 'check' && !s.found ? '' : fmtRupees(total), line: LINES[line][4], tr: LINES[line][5], opts: s.opts,
      foot: `${dues ? `Pending challans ${fmtRupees(dues)}` : 'No pending challans'} · ${this.suspended ? 'Licence suspended' : 'Licence valid'} · ${fmtRupees(G.stats.money)} on you`,
      onPick: (i) => this.choose(i),
    });
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
        const paid = this.charge(s.kind, s.total);
        res = paid >= s.total ? `Paid ${fmtRupees(s.total)}` : `Paid ${fmtRupees(paid)}, ${fmtRupees(s.total - paid)} pending`;
        sub = 'Receipt on SMS. Your record notes it.';
        if (s.found === 'suspended') sub = 'Driving while suspended. Your record looks worse.';
        if (s.kind === 'helmet' && !firstTime) this.suspend(24, 'Second helmet offence');
        G.audio.cash();
      }
    } else if (o.id === 'plead') {
      const chance = theft ? 0.08 : (firstTime ? 0.45 : 0.15) * (0.5 + cop.mood) - (this.duesTotal > 0 ? 0.12 : 0) - (s.found ? 0.3 : 0);
      if (r < chance) {
        line = 'r_plead_ok'; res = theft ? 'Let off with a warning' : 'Let off with a warning'; sub = theft ? 'The vehicle stays with them. You walk.' : 'He waves you on. Don’t push your luck.'; kind = 'meter';
        if (theft) { this.confiscate(); this.heat = 0; this.clearMarshals(); this.clearCharges(); }
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
    } else if (o.id === 'bribe') {
      if (G.stats.money < s.bribe) { line = 'r_plead_no'; res = 'You don’t have it'; sub = `You fumble for ${fmtRupees(s.bribe)} you don’t have. He writes the challan.`; this.charge(s.kind, s.total); kind = 'warn'; }
      else if (cop.corrupt && r < 0.9) {
        line = cop.bribes > 0 ? 'r_bribe_more' : 'r_bribe_ok';
        G.stats.money -= s.bribe; cop.bribes++;
        res = `${fmtRupees(s.bribe)} changes hands`; sub = cop.bribes > 1 ? 'He remembers you. The rate goes up every time.' : 'No receipt, obviously.'; kind = 'warn';
        if (theft) { this.confiscate(); this.heat = 0; this.clearMarshals(); this.clearCharges(); sub = s.kind === 'theft' ? 'The vehicle stays with him. You walk away.' : 'The case never gets written. You walk away.'; }
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
    if (ev.type === 'carjack') this.raiseHeat(this.copSeeing(ev.x, ev.z, 70) ? 2 : 1, 'Vehicle theft, the owner is calling it in', 'theft');
    if (ev.type === 'stoleParked' && this.rng.next() < 0.4) this.later(18 + this.rng.next() * 25, () => { if (P.cur === ev.veh && !P.onFoot) this.raiseHeat(1, 'The owner reported their ' + ev.name + ' stolen', 'theft'); });
    if (ev.type === 'pedHit' && !P.onFoot) {
      const cop = this.copSeeing(P.x, P.z, 50);
      if (cop && !this.stop) this.beginStop(cop, 'rash', {});
      // nobody in uniform saw it, but someone on the footpath took the number
      else if (!cop && (ev.speed || 0) > 4 && this.rng.next() < 0.35) this.later(6 + this.rng.next() * 10, () => this.raiseHeat(1, 'Hit and run: a witness took your number', 'hitrun'));
    }
  }
  raiseHeat(n, why, charge = 'theft') {
    const G = this.g;
    if (G.free) return;
    const was = this.heat;
    if (charge) this.charges.add(charge);
    this.heat = Math.min(3, this.heat + n);
    this.unseenT = 0;
    this.lastSeen = { x: G.player.x, z: G.player.z };
    if (this.heat > was) { G.hud.toast(this.heat === 1 ? 'Police alerted' : 'More police on the way', `${why} · ${FINES[this.topCharge()].name}, ${FINES[this.topCharge()].law}`, 'bad', 3.6); G.audio.siren(0.001, 0); }
  }
  topCharge() { return CHARGE_ORDER.find(c => this.charges.has(c)) || 'theft'; }
  clearCharges() { this.charges.clear(); }
  clearMarshals() { for (const m of this.marshals) m.dispose(); this.marshals = []; }
  updateHeat(dt) {
    const G = this.g, P = G.player;
    const want = this.heat === 0 ? 0 : this.heat === 1 ? 1 : this.heat === 2 ? 2 : 3;
    // spawn/despawn
    if (this.marshals.length < want && (this._spT = (this._spT || 0) - dt) <= 0) { this._spT = 4; this.spawnMarshal(); }
    let seen = false, nearest = 1e9, sirenPan = 0;
    for (let i = this.marshals.length - 1; i >= 0; i--) {
      const m = this.marshals[i];
      m.update(dt);
      const d = Math.hypot(m.veh.x - P.x, m.veh.z - P.z);
      if (m.sees) { seen = true; this.lastSeen = { x: P.x, z: P.z }; }
      if (d < nearest) { nearest = d; this.sirenAt = { x: m.veh.x, z: m.veh.z }; const hx = Math.cos(P.th), hz = Math.sin(P.th); sirenPan = clamp((-(m.veh.x - P.x) * hz + (m.veh.z - P.z) * hx) / (d || 1), -1, 1); }
      if ((this.heat === 0 && d > 90) || d > 520) { m.dispose(); this.marshals.splice(i, 1); continue; }
      // caught?
      if (this.heat > 0 && !this.stop && m.stunT <= 0) {
        const slow = P.onFoot ? d < 2.6 : (d < 6 && Math.abs(P.v) < 2.2);
        m.catchT = slow ? (m.catchT || 0) + dt : 0;
        if (m.catchT > (P.onFoot ? 0.4 : 1.2)) this.caught(m);
      }
    }
    const pl = this.heat > 0 && this.marshals.length ? clamp(1.4 - nearest / 160, 0, 1) : 0, em = G.emSiren || 0;
    G.audio.sirenAt = em > pl ? G.emSirenAt : this.sirenAt;
    G.audio.siren(Math.max(pl, em), em > pl ? G.emPan || 0 : sirenPan);
    if (this.heat > 0) {
      if (seen) this.unseenT = 0; else this.unseenT += dt;
      const need = 25 + this.heat * 12;
      if (this.unseenT > need) {
        this.heat--; this.unseenT = 0;
        if (this.heat === 0) { G.hud.toast('You lost them', 'The police have given up, for now', 'meter', 3); this.say('m_lost', null, true); this.clearCharges(); }
        else G.hud.toast('Fewer police looking', '', 'info', 2);
      }
      G.hud.setHeat(this.heat, seen, this.heat ? 1 - this.unseenT / need : 0);
    } else G.hud.setHeat(0);
  }
  spawnMarshal() {
    const G = this.g, P = G.player, W = this.W;
    const near = this.lastSeen || { x: P.x, z: P.z };
    for (let k = 0; k < 40; k++) {
      const a = this.rng.next() * Math.PI * 2, r = 85 + this.rng.next() * 70;
      const x = near.x + Math.cos(a) * r, z = near.z + Math.sin(a) * r;
      const e = W.graph.nearest(x, z, 30, e => e.rank >= 2);
      if (!e) continue;
      const t = W.graph.at(e.e, e.s);
      if (G.inView && G.inView(t[0], t[1]) && k < 30) continue;
      this.marshals.push(new Marshal(this, t[0], t[1], Math.atan2(P.z - t[1], P.x - t[0])));
      return;
    }
  }
  caught(m) {
    const G = this.g;
    const kind = this.topCharge();
    m.cop.name = 'Beat marshal';
    this.stop = { cop: m.cop, kind, fine: FINES[kind].amt + (this.charges.has('disobey') && kind !== 'disobey' ? FINES.disobey.amt : 0), phase: 'talk', t: 0, info: {} };
    m.cop.marshal = m;
    G.player.busy = 999;
    this.openTalk();
  }
  confiscate() {
    const P = this.g.player;
    if (P.cur && P.cur !== P.auto && !P.onFoot) P.abandon(this.g.traffic, true);
  }
  arrest(why, extra, kind) {
    const G = this.g, P = G.player;
    kind = kind || (this.stop && SERIOUS.has(this.stop.kind) ? this.stop.kind : this.topCharge());
    const fine = (this.stop && this.stop.kind === kind ? this.stop.total || FINES[kind].amt : FINES[kind].amt) + (extra ? 5000 : 0);
    this.charge(kind, fine, `Bail after arrest: ${FINES[kind].name}`);
    G.date && G.date.event('arrest', fine);
    if (G.lights && G.rng.chance(0.5)) G.lights.lose('Kept at the chowki with your other things');
    this.clearCharges();
    this.heat = 0; this.unseenT = 0; this.clearMarshals();
    const ch = this.nearestChowki(P.x, P.z);
    this.later(0.6, () => {
      G.hud.flash(`Taken to ${ch.name}`, `${FINES[kind].name} (${FINES[kind].law}). ${why}. Released on bail · ${fmtRupees(fine)}`);
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
    const L = LINES[id];
    if (!L) return;
    const G = this.g, P = G.player;
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
    for (const m of this.marshals) out.push({ x: m.veh.x, z: m.veh.z, kind: 'marshal' });
    if (this.towedAt) out.push({ x: this.towedAt.x, z: this.towedAt.z, kind: 'tow' });
    // your own auto, wherever you left it
    const P = this.g.player;
    if (!this.towedAt && P && P.auto && (P.onFoot || P.cur !== P.auto)) out.push({ x: P.auto.x, z: P.auto.z, kind: 'tow', label: 'Your auto' });
    return out;
  }
}

// ---------------------------------------------------------------- a beat marshal on a motorcycle
const KHAKI = 0x9b8456;
class Marshal {
  constructor(police, x, z, th) {
    const G = police.g, W = police.W;
    this.P = police; this.G = G; this.W = W;
    this.veh = new Vehicle(W, G.scene, G.vmats, 'bike', [0.92, 0.92, 0.9]);
    this.veh.reset(x, z, th);
    this.veh.y = W.surf.height(x, z);
    // police bikes are ridden hard: quicker off the line, higher top speed
    // and they shove through traffic rather than wait in it (mass), nudging vehicles aside
    this.veh.spec = { ...specOf('bike'), acc: 4.8, vTop: 31, mu: 9, mass: 40000 };
    this.cop = { name: 'Beat marshal', x, z, mood: police.rng.next() * 0.6, corrupt: police.rng.chance(0.35), bribes: 0, busyT: 0, post: { x, z } };
    this.stunT = 0; this.routeT = 0; this.route = null; this.stuckT = 0; this.revT = 0; this.sees = false; this.spotT = 0;
    // rider: khaki uniform, white helmet
    if (W.kit) {
      const look = W.kit.randomLook(police.rng, { role: 'police' });
      look.top = new THREE.Color(KHAKI).convertSRGBToLinear(); look.bottom = look.top.clone().multiplyScalar(0.92);
      look.acc = 'helmet';
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
    this.agent = this.veh.agent;
    G.traffic.extra = G.traffic.extra || [];
    G.traffic.extra.push(this.agent);
  }
  get x() { return this.veh.x; }
  get z() { return this.veh.z; }
  update(dt) {
    const G = this.G, W = this.W, P = G.player, v = this.veh, police = this.P;
    this.stunT -= dt;
    const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz);
    // can we see the player?
    this.sees = police.heat > 0 && (d < 22 || (d < 75 && this.los(P.x, P.z)));
    if (this.sees && !this.wasSeeing && this.spotT <= 0 && d < 60) { police.say(Math.random() < 0.75 ? 'spot_' + police.topCharge() : 'm_spot2', this); this.spotT = 12; }
    this.spotT -= dt;
    this.wasSeeing = this.sees;
    const target = police.heat > 0 ? (this.sees ? { x: P.x, z: P.z } : police.lastSeen || { x: P.x, z: P.z }) : { x: v.x + Math.cos(v.th) * 50, z: v.z + Math.sin(v.th) * 50 };
    // steer along a road route; straight at the player when close
    this.routeT -= dt;
    if (this.routeT <= 0) {
      this.routeT = 1.3;
      const G2 = W.graph;
      const a = G2.nearest(v.x, v.z, 40), b = G2.nearest(target.x, target.z, 60);
      this.route = null;
      if (a && b) { const r = G2.route(a, b, true); if (r) this.route = G2.routePolyline(r, a, b); }
    }
    let ax = target.x, az = target.z;
    const close = d < 28 && this.sees;
    if (!close && this.route && this.route.length >= 4) {
      // closest point on the route, then look ahead ~10 m
      let bi = 0, bd = 1e9;
      for (let i = 0; i < this.route.length; i += 2) { const q = (this.route[i] - v.x) ** 2 + (this.route[i + 1] - v.z) ** 2; if (q < bd) { bd = q; bi = i; } }
      const look = Math.min(this.route.length - 2, bi + 2 * Math.max(1, Math.round((6 + Math.abs(v.v) * 0.6) / 8)));
      ax = this.route[look]; az = this.route[look + 1];
    } else if (close) {
      // pull alongside, a little to the player's right
      const S = P.spec || { W: 0.6 };
      ax = P.x + Math.cos(P.th) * 1.5 - Math.sin(P.th) * (S.W / 2 + 1.1);
      az = P.z + Math.sin(P.th) * 1.5 + Math.cos(P.th) * (S.W / 2 + 1.1);
    }
    // weave: if the way ahead is blocked, aim for a gap to one side; cars ahead pull over for the siren
    const hx = Math.cos(v.th), hz = Math.sin(v.th);
    if (!close) {
      const blocked = (lat) => {
        let b = false;
        G.traffic.near(v.x + hx * 7, v.z + hz * 7, 9, (o) => {
          if (b || o === v.agent || (!o.T && !o.parked)) return;
          const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz, ac = -rx * hz + rz * hx;
          const w = (o.T ? o.T.W : o.W) / 2 + 0.55;
          if (al > 0.4 && al < 12 && Math.abs(ac - lat) < w) b = true;
        });
        return b;
      };
      let off = 0;
      if (blocked(0)) for (const c of [1.3, -1.3, 2.4, -2.4, 3.4, -3.4]) if (!blocked(c)) { off = c; break; }
      this.off = (this.off || 0) + (off - (this.off || 0)) * Math.min(1, dt * 3);
      ax += -hz * this.off * 1.6; az += hx * this.off * 1.6;
      if (police.heat > 0 && (this.yieldT = (this.yieldT || 0) - dt) <= 0) {
        this.yieldT = 0.5;
        G.traffic.near(v.x + hx * 12, v.z + hz * 12, 14, (o) => {
          if (!o.T || o.jc || o.isPlayer) return;
          const rx = o.x - v.x, rz = o.z - v.z, al = rx * hx + rz * hz;
          if (al < 0 || al > 26 || Math.random() > 0.7) return;
          const side = -rx * hz + rz * hx;
          o.latT = o.lat + (side > 0 ? 1 : -1) * 1.3;
        });
      }
    }
    const want = Math.atan2(az - v.z, ax - v.x);
    const diff = wrapAngle(want - v.th);
    const inp = { throttle: 0, brake: 0, steer: clamp(diff * 2.4, -1, 1), handbrake: false };
    const tgtSpeed = this.stunT > 0 ? 0 : close ? Math.abs(P.v) + clamp((d - 2.2) * 0.9, 0, 5) : police.heat > 0 ? 20 : 8;
    // always a little throttle: a bike only turns while it's rolling
    if (this.stunT <= 0 && v.v < tgtSpeed) inp.throttle = Math.abs(diff) < 0.4 ? 1 : Math.abs(diff) < 1.2 ? 0.7 : 0.45;
    if (v.v > tgtSpeed + 1.5 || (Math.abs(diff) > 1.0 && v.v > 7)) { inp.brake = 1; inp.throttle = 0; }
    // unstick: back up a little with the wheel the other way
    if (inp.throttle > 0.3 && Math.abs(v.v) < 0.4) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
    if (this.stuckT > 1.5) { this.revT = 1.0; this.stuckT = 0; this.stucks = (this.stucks || 0) + 1; }
    // still wedged after a couple of tries: slip through the traffic for a moment
    if (this.stucks >= 2) { this.ghostT = 1.6; this.stucks = 0; }
    this.ghostT = (this.ghostT || 0) - dt;
    if (this.revT > 0) {
      this.revT -= dt; inp.throttle = 0; inp.brake = 1; inp.steer = -inp.steer; v.reverse = true;
      if (this.revT <= 0) v.reverse = false;
    } else if (v.reverse) v.reverse = false;
    v.update(dt, inp, this.ghostT > 0 ? null : G.traffic);
    for (const e of v.events) if (e.type === 'crash' || e.type === 'scrape' || e.type === 'hit') this.lastHit = e.type + ':' + (e.kind ?? e.who);
    // squeeze past: anything we're overlapping edges sideways
    G.traffic.near(v.x, v.z, 3.5, (o) => {
      if (!o.T || o.isPlayer || o.jc) return;
      const rx = o.x - v.x, rz = o.z - v.z;
      if (rx * rx + rz * rz > 6.5) return;
      const side = -rx * hz + rz * hx;
      o.latT = o.lat + (side > 0 ? 1 : -1) * 1.4;
    });
    v.y = v.y || W.surf.height(v.x, v.z);
    this.cop.x = v.x; this.cop.z = v.z;
    // lights flash, rider sits
    const t = performance.now() / 1000;
    this.lightR.visible = Math.sin(t * 14) > 0; this.lightB.visible = !this.lightR.visible;
    if (this.H) {
      v.tilt.updateWorldMatrix(true, false);
      const p = new THREE.Vector3(-0.33, 0.95 - 0.62, 0).applyMatrix4(v.tilt.matrixWorld);
      this.H.holder.position.copy(p);
      this.H.holder.rotation.set(0, -v.th, 0);
      this.H.holder.rotateX(v.lean || 0);
      this.H.mixer.update(dt);
    }
  }
  los(x, z) { return this.W.collision.ray(this.veh.x, this.veh.z, x, z) > 0.97; }
  dispose() {
    const G = this.G;
    this.veh.dispose();
    if (this.H) { G.scene.remove(this.H.holder); this.H.dispose(); }
    const ex = G.traffic.extra; if (ex) { const i = ex.indexOf(this.agent); if (i >= 0) ex.splice(i, 1); }
  }
}
