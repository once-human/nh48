// How the law actually finds you (police.js does the chasing):
//  · Witnesses call it in, after a while: someone who saw it gets their phone out (10–30 s). Scare them off, or be
//    gone, and the call never comes. Nobody saw it: nobody's looking.
//  · A description, not a radar: the police are after what you looked like (your shirt, or your vehicle and its
//    plate). Change clothes, change vehicles, hop in an auto: they look straight past you unless they're close.
//  · Cameras at the big junctions read plates: a red light is an e-challan; a wanted or stolen plate is a sighting.
//  · Radio chatter, quiet and crackly, telling you what they know.
//  · Safe places: indoors, at home, in a crowd, the search cools faster.
//  · Arrest: cuffed, a booking card, a night in the lock-up for anything serious, bail, a court date (skip it and
//    there's a warrant).
//  · Catching you: on foot they tackle; at a checkpoint the stinger shreds your tyres; jeeps box you in; and at a
//    Manhunt for a violent crime, armed QRT who fire a warning shot first.
import * as THREE from 'three';
import FAMOUS from '../world/famous.json';
import { fmtRupees } from '../core/util.js';
import { playerName } from '../people/characters.js';

const hex = (c) => c ? '#' + c.getHexString() : '';
const NAMES = { scooter: 'scooter', scooterP: 'scooter', bike: 'motorcycle', bikeP: 'motorcycle', auto: 'auto', hatch: 'hatchback', sedan: 'sedan', suv: 'SUV', taxi: 'taxi', tempo: 'tempo', bus: 'bus', cycle: 'cycle' };
function colourName(c) {
  if (!c) return '';
  const r = c.r, g = c.g, b = c.b, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 0.06) return 'black'; if (mn > 0.6) return 'white'; if (mx - mn < 0.08) return mx > 0.3 ? 'grey' : 'dark grey';
  if (r >= g && r >= b) return g > r * 0.6 ? (g > r * 0.85 ? 'yellow' : 'orange') : b > r * 0.6 ? 'pink' : 'red';
  if (g >= r && g >= b) return b > g * 0.75 ? 'teal' : 'green';
  return r > b * 0.6 ? 'purple' : 'blue';
}

export class Law {
  constructor(G, police) {
    this.g = G; this.p = police; this.calls = []; this.radioT = 0; this.court = police.court || null;
    this.cams = null; this.flats = new Set();
    const el = this.radioEl = document.createElement('div'); el.className = 'radio-feed'; el.hidden = true;
    (document.getElementById('ui') || document.body).appendChild(el);
  }
  // ---------------------------------------------------------------- what you look like to them
  descNow() {
    const P = this.g.player;
    if (P.onFoot || !P.cur) return { key: 'foot:' + hex(P.look && P.look.top), text: `on foot, ${colourName(P.look && P.look.top)} ${P.look && P.look.female ? 'top' : 'shirt'}` };
    const v = P.cur, col = v.paint ? new THREE.Color().setRGB(Math.sqrt(v.paint[0]), Math.sqrt(v.paint[1]), Math.sqrt(v.paint[2])) : null;
    const plate = v === P.auto ? this.p.plate : v.plate || '';
    return { key: `${v.type}:${plate}:${hex(col)}`, text: `${colourName(col)} ${NAMES[v.type] || v.type}${plate ? ', ' + plate : ''}`, plate };
  }
  setDesc() { this.desc = this.descNow(); }
  // do they recognise you? Up close always; further off only if you still match what they're looking for
  matches(d) { if (!this.desc || d < 12) return true; return this.descNow().key === this.desc.key; }

  // ---------------------------------------------------------------- witnesses
  // a crime at (x, z): a cop or a unit right there sees it (heat now); otherwise a witness may call it in
  report(n, why, charge, x, z, o = {}) {
    const G = this.g, P = G.player, pol = this.p;
    if (G.free) return;
    const sawCop = pol.copSeeing(x, z, 45) || pol.marshals.some(m => Math.hypot(m.veh.x - x, m.veh.z - z) < 55 && G.W.collision.ray(m.veh.x, m.veh.z, x, z) > 0.97);
    if (sawCop || o.direct) { pol.raiseHeat(n, why, charge); this.setDesc(); this.radioDesc(); return; }
    if (this.calls.length >= 3) return;
    // who saw it: close, with a clear line, not out cold, not one of the police
    let best = null, bd = 30;
    for (const q of G.people.list) {
      if (q.hidden || q.fallen > 0 || q.cop || q.crew || q.calling || q === o.victim) continue;
      const d = Math.hypot(q.x - x, q.z - z); if (d > bd) continue;
      if (G.W.collision.ray(q.x, q.z, x, z) < 0.97) continue;
      best = q; bd = d;
    }
    if (!best) return;
    const t = 10 + Math.random() * 20;
    best.calling = { t, n, why, charge, x, z, desc: this.descNow() };
    best.act = { clip: 'phone', t: 0, dur: t + 2 }; best.mode = 'watch'; best.watch = { x: P.x, z: P.z }; best.wait = t + 2; best.anim = 'phone';
    this.calls.push(best);
    const vb = G.vb; if (vb) { vb.street(best, 'calling'); if (o.victim && charge === 'pickpocket') G.later(0.4, () => vb.street(o.victim, 'thief', { pri: 2 })); }
    G.hud.toast('Someone’s on the phone', 'A witness is calling 112. Get away, or get to them first', 'warn', 3);
  }
  callsTick(dt) {
    const G = this.g, P = G.player;
    for (let i = this.calls.length - 1; i >= 0; i--) {
      const q = this.calls[i], C = q.calling;
      if (!C || !G.people.list.includes(q) || q.fallen > 0) { this.calls.splice(i, 1); if (q) q.calling = null; continue; }
      // you walk up to them: most hang up and back off (the tough ones don't)
      if (P.onFoot && Math.hypot(P.x - q.x, P.z - q.z) < 3 && !C.faced) {
        C.faced = true;
        if (Math.random() < 0.65) { G.vb && G.vb.street(q, 'hangup', { pri: 2 }); q.calling = null; q.act = null; q.anim = null; this.calls.splice(i, 1); G.people.flee && G.people.flee(q, P.x, P.z, 18); G.hud.toast('They hang up', 'The phone goes back in the pocket. They back away', 'meter', 2.4); continue; }
      }
      C.t -= dt;
      if (C.t <= 0) {
        this.calls.splice(i, 1); q.calling = null;
        this.p.raiseHeat(C.n, `${C.why} · a witness called 112`, C.charge);
        this.desc = C.desc; this.p.lastSeen = { x: C.x, z: C.z };
        this.radioDesc();
      }
    }
  }
  // ---------------------------------------------------------------- cameras at the big junctions
  setupCams() {
    const G = this.g, S = G.traffic && G.traffic.signals; if (!S) return;
    this.cams = [];
    for (const i of S.j.keys()) { const n = G.W.graph.nodes[i]; if (n && n.maxRank >= 4 && (i % 3) === 0) this.cams.push({ n, cool: 0 }); }
  }
  camsTick(dt) {
    const G = this.g, P = G.player, pol = this.p;
    if (!this.cams || (this._cT = (this._cT || 0) - dt) <= 0) { if (!this.cams || this._camN !== G.traffic.signals.j.size) { this.setupCams(); this._camN = G.traffic.signals.j.size; } this._cT = 0.25; } else return;
    if (P.onFoot || !P.cur) return;
    for (const c of this.cams) {
      c.cool -= 0.25;
      const d = Math.hypot(c.n.x - P.x, c.n.z - P.z); if (d > 16 || c.cool > 0) continue;
      c.cool = 20;
      const where = pol.whereName(c.n.x, c.n.z), dsc = this.descNow();
      // a red light, read off the plate
      if (Math.abs(P.v) > 5 && G.traffic.signals.stateForAngle(c.n.i, P.th) === 'r') pol.eChallan('signal', c.n.x, c.n.z, 'ANPR camera, red light');
      // a plate they're looking for
      if ((pol.heat > 0 && this.desc && dsc.plate && this.desc.plate === dsc.plate) || (P.cur.stolen && P.cur.reported)) {
        pol.lastSeen = { x: P.x, z: P.z }; pol.unseenT = 0;
        if (!pol.heat) pol.raiseHeat(1, 'A camera read the stolen plate', 'theft');
        this.radio(`ANPR hit at ${where}: ${dsc.text}. Units, respond.`); G.vb && G.vb.radio(8, c.n.x, c.n.z);
      }
    }
  }
  // ---------------------------------------------------------------- radio
  radio(text) {
    const el = this.radioEl;
    el.innerHTML = `<b>📻 Control</b><span></span>`; el.querySelector('span').textContent = text;
    el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    this.radioT = 6;
    this.g.audio.squelch && this.g.audio.squelch();
  }
  radioDesc() {
    const pol = this.p, d = this.desc || this.descNow(), L = pol.lastSeen || this.g.player;
    if (this.g.vb) this.g.vb.radio(d.key.startsWith('foot') ? 1 : 2, L.x, L.z);
    const lvl = ['', 'Noticed', 'Wanted', 'Pursuit', 'Nakabandi', 'Manhunt'][pol.heat] || '';
    this.radio(`${lvl ? lvl + ': ' : ''}suspect ${d.text}, last seen ${pol.whereName(L.x, L.z)}.`);
  }
  radioTick(dt) {
    if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) this.radioEl.hidden = true; }
    const pol = this.p;
    // every so often while they're looking: what they know
    if (pol.heat > 0 && (this._rT = (this._rT || 18) - dt) <= 0) {
      this._rT = 22 + Math.random() * 18;
      const lines = [() => this.radioDesc(), () => this.radio(`${pol.marshals.length} units on it. ${pol.naka ? 'Nakabandi in place.' : ''}`),
        () => this.radio(this.matches(99) ? `Eyes open for the ${this.desc ? this.desc.text : 'suspect'}.` : `No sign of the ${this.desc ? this.desc.text : 'suspect'}. They may have switched.`)];
      lines[Math.floor(Math.random() * lines.length)]();
    }
  }
  // ---------------------------------------------------------------- safe places: how much faster the search cools
  coolMul() {
    const G = this.g, P = G.player;
    let m = 1;
    if (G.interiors && G.interiors.inside) m *= 3;
    if (this.desc && !this.matches(99)) m *= 1.6;
    let n = 0; for (const q of G.people.list) if (!q.hidden && Math.abs(q.x - P.x) < 18 && Math.abs(q.z - P.z) < 18) n++;
    if (n >= 10 && P.onFoot) m *= 1.7;
    const home = this.home || (this.home = G.people.areas.list.find(a => a.name === 'Sadashiv Peth')); if (home && Math.hypot(home.x - P.x, home.z - P.z) < 40) m *= 3;
    return m;
  }

  // ---------------------------------------------------------------- catching you
  // on foot: a constable close behind you, running, brings you down
  tackleTick(dt) {
    const G = this.g, P = G.player, pol = this.p;
    if (!P.onFoot || pol.stop || P.downT > 0) return;
    for (const m of pol.marshals) for (const q of m.foot) {
      const d = Math.hypot(q.x - P.x, q.z - P.z);
      if (d < 1.15 && (P.foot.v || 0) > 2.4 && (q.tackleT = (q.tackleT || 0) - dt) <= 0 && ((q.tackleT = 2.5), Math.random() < 0.45)) {
        P.downT = 2.4; if (P.human) P.human.play('knockback', { once: true, fade: 0.05 }); G.vb && (G.vb.police(m.role, 'tackle', q) || 0); G.vb && G.later(0.5, () => G.vb.you('fall', true)); G.rig && G.rig.shake(0.5); G.audio.thud && G.audio.thud(0.7);
        G.hud.toast('Tackled', 'Down on the road with a knee in your back', 'bad', 2.4);
        G.later(1.2, () => { if (!pol.stop && pol.heat > 0) pol.caught(m); });
        return;
      }
    }
  }
  // the checkpoint's stinger, and tyres shot out: the vehicle limps
  flatten(v, why) {
    if (!v || v.flat > 0) return;
    v.flat = 40; this.g.hud.toast('Tyres gone', why, 'bad', 3); this.g.audio.thud && this.g.audio.thud(0.6);
  }
  // a jeep alongside your rear quarter at speed: the box-in (it spins you)
  pitTick(dt) {
    const G = this.g, P = G.player, pol = this.p;
    if (P.onFoot || !P.cur || pol.heat < 4 || Math.abs(P.v) < 7) return;
    for (const m of pol.marshals) {
      if (!m.jeep || m.mode !== 'drive' || (m.pitT = (m.pitT || 0) - dt) > 0) continue;
      const v = m.veh, rx = v.x - P.x, rz = v.z - P.z, hx = Math.cos(P.th), hz = Math.sin(P.th), al = rx * hx + rz * hz, ac = -rx * hz + rz * hx;
      if (al < -0.5 && al > -3.2 && Math.abs(ac) < 2.4) {
        m.pitT = 10; const sd = Math.sign(ac) || 1;
        P.cur.th += -sd * 0.9; P.cur.v *= 0.45; G.rig && G.rig.shake(0.6); G.audio.crash && G.audio.crash(0.6);
        G.hud.toast('Boxed in', 'The jeep clipped your back corner and spun you', 'bad', 2.6);
      }
    }
  }
  // armed QRT, only at a Manhunt for something violent: a warning shot first, then they aim (tyres if you're in a vehicle)
  armedTick(dt) {
    const G = this.g, P = G.player, pol = this.p;
    const violent = pol.charges.has('assault') || pol.charges.has('murder') || pol.charges.has('hitrun') || pol.charges.has('blast');
    if (pol.heat < 5 || !violent || pol.stop) return;
    for (const m of pol.marshals) {
      if (m.role !== 'qrt' || !m.sees) continue;
      const src = m.mode === 'foot' && m.foot[0] ? m.foot[0] : m.veh, d = Math.hypot(src.x - P.x, src.z - P.z);
      if (d > 40 || (m.shotT = (m.shotT || 0) - dt) > 0) continue;
      m.shotT = m.warned ? 2.2 + Math.random() * 1.5 : 3;
      this.shot(src);
      if (!m.warned) { m.warned = true; G.vb && G.vb.police('qrt', 'warn', src); G.hud.toast('Warning shot', '“Ruk ja! Nahi toh goli chalegi!”', 'bad', 3); this.radio('QRT: warning shot fired. Suspect not stopping.'); continue; }
      const hit = Math.random() < (P.onFoot ? 0.22 : 0.3) * (1 - d / 60);
      if (!hit) continue;
      if (P.onFoot) { P.hp = Math.max(1, (P.hp ?? 100) - 18); G.hud.hurt && G.hud.hurt(); G.hud.toast('Hit', 'A round in the leg. You can barely run', 'bad', 3); P.limpT = 30; }
      else this.flatten(P.cur, 'They shot out your tyres');
    }
  }
  shot(src) {
    const G = this.g;
    G.audio.at(src.x, src.z, () => G.audio.gunshot ? G.audio.gunshot() : G.audio.boom && G.audio.boom());
    if (G.smoke) G.smoke.emit(src.x, 1.4, src.z, 'smoke', 0.1);
  }

  // ---------------------------------------------------------------- arrest: cuffs, the booking, the lock-up, a court date
  // a real mugshot: you, as you are right now, from the front, against the station's height chart
  mugshot() {
    // taken at the chowki, not in the street: you as you were brought in (your face, your hair, the clothes you were
    // wearing, the helmet off), square to the camera against the station's plain wall, under flat light. A copy of
    // you is posed in a little studio of its own and drawn once, off-screen
    const G = this.g, P = G.player, R = G.renderer, kit = P.kit, look = P.look || (P.human && P.human.look);
    if (!kit || !look) return null;
    let H = null, rt = null;
    const W = 240, Hh = 300;
    try {
      H = kit.create({ ...look, acc: null, hat: false, helmet: false });
      const sc = new THREE.Scene(); sc.background = new THREE.Color(0.6, 0.58, 0.54);
      sc.add(new THREE.HemisphereLight(0xffffff, 0x7a746c, 1.5));
      const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(0.5, 2.4, 3); sc.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(-2, 1.4, 2); sc.add(fill);
      H.holder.rotation.y = -Math.PI / 2;                      // facing the camera (+z)
      sc.add(H.holder);
      H.play('idle', { fade: 0 }); H.mixer.update(0.05);
      sc.updateMatrixWorld(true);
      const hd = H.root.getObjectByName('Head'), hp = new THREE.Vector3(0, 1.55 * (look.scale || 1), 0); if (hd) hd.getWorldPosition(hp);
      const cam = new THREE.PerspectiveCamera(26, W / Hh, 0.1, 20);
      cam.position.set(hp.x, hp.y - 0.05, hp.z + 1.6); cam.lookAt(hp.x, hp.y - 0.17, hp.z); cam.updateMatrixWorld();
      // tone-mapped and colour-encoded exactly as on the screen (an XR-flagged target), stored as plain bytes
      rt = new THREE.WebGLRenderTarget(W, Hh, { samples: 4 });
      rt.isXRRenderTarget = true; rt.texture.colorSpace = THREE.SRGBColorSpace; rt.texture.internalFormat = 'RGBA8';
      const prev = R.getRenderTarget(), ex = R.toneMappingExposure;
      R.toneMappingExposure = 1; R.setRenderTarget(rt); R.render(sc, cam); R.setRenderTarget(prev); R.toneMappingExposure = ex;
      const buf = new Uint8Array(W * Hh * 4); R.readRenderTargetPixels(rt, 0, 0, W, Hh, buf);
      const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
      const img = x.createImageData(W, Hh), D = img.data;
      for (let y = 0; y < Hh; y++) { D.set(buf.subarray((Hh - 1 - y) * W * 4, (Hh - y) * W * 4), y * W * 4); }     // (rows come bottom-up)
      for (let i = 3; i < D.length; i += 4) D[i] = 255;
      x.putImageData(img, 0, 0);
      // the height chart on the wall behind
      x.strokeStyle = 'rgba(30, 30, 30, .5)'; x.fillStyle = 'rgba(30, 30, 30, .7)'; x.font = '9px monospace';
      for (let i = 0; i < 12; i++) { const y = 18 + i * 22; x.beginPath(); x.moveTo(0, y); x.lineTo(i % 2 ? 10 : 18, y); x.moveTo(240, y); x.lineTo(i % 2 ? 230 : 222, y); x.stroke(); if (!(i % 2)) x.fillText(String(190 - i * 5), 20, y + 3); }
      return c.toDataURL('image/jpeg', 0.88);
    } catch (e) { return null; } finally {
      if (H) { if (H.holder.parent) H.holder.parent.remove(H.holder); H.dispose(); }
      if (rt) rt.dispose();
    }
  }
  booking(o) {
    const G = this.g, el = document.createElement('div'), shot = this.mugshot();
    el.className = 'booking';
    const me = `${G.playerName || playerName() || (G.player.look && G.player.look.female ? 'Saee' : 'Sid')} Kale`;
    el.innerHTML = `<div class="bk-card"><div class="bk-top"><span class="bk-badge">पुणे पोलीस · PUNE POLICE</span><span class="bk-no">FIR ${Math.floor(1000 + Math.random() * 8999)}/${new Date().getFullYear()}</span></div>
      <div class="bk-body"><div class="bk-mug">${shot ? `<img class="bk-photo" src="${shot}" alt="">` : '<div class="bk-sil"></div>'}<div class="bk-board">${me.toUpperCase()}<br>${o.chowki.toUpperCase()}</div></div>
      <div class="bk-info"><b>${me}</b><span>${o.chowki}</span><ul>${o.charges.map(c => `<li><em>${c.law}</em>${c.name}</li>`).join('')}</ul>
      <div class="bk-row"><span>Bail</span><b>${fmtRupees(o.bail)}</b></div>${o.night ? '<div class="bk-row"><span>Custody</span><b>Overnight in the lock-up</b></div>' : ''}
      <div class="bk-row"><span>Court</span><b>${o.court}</b></div></div></div><div class="bk-stamp">BOOKED</div></div>`;
    (document.getElementById('ui') || document.body).appendChild(el);
    G.audio.thud && G.audio.thud(0.8);
    setTimeout(() => el.classList.add('out'), 6200); setTimeout(() => el.remove(), 6800);
  }
  setCourt(charges) {
    const G = this.g, day = Math.floor((G.clock || 0) / 24) + 2;
    this.court = { day, at: day * 24 + 11, charges, done: false };
    this.p.court = this.court; this.p.save && this.p.save();
    const d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day % 7];
    G.hud.sms('District Court, Shivajinagar', `Summons: appear on ${d}, 11 am, Shivajinagar court. Skip it and a warrant goes out.`, '', 'It’s on your map');
    return `${d}, 11 am · Shivajinagar`;
  }
  courtTick(dt) {
    const G = this.g, C = this.court, P = G.player; if (!C || C.done) return;
    const c = G.people.areas.list.find(a => a.name === 'Shivajinagar');
    // in court on the day, between 10 and 5: the hearing
    if (c && Math.floor((G.clock || 0) / 24) === C.day && G.hour > 10 && G.hour < 17 && Math.hypot(c.x - P.x, c.z - P.z) < 60 && P.onFoot) {
      C.done = true; this.p.court = null;
      const fine = 2000 + C.charges.length * 1500, ok = Math.random() < 0.35;
      if (ok) G.hud.flash('Acquitted', 'Weak witnesses, a tired judge. Case dismissed.');
      else { this.p.charge('court', fine, 'Court fine'); G.hud.flash('Fined by the court', `${fmtRupees(fine)} and a warning on your record.`); }
      this.p.save && this.p.save(); return;
    }
    if ((G.clock || 0) > C.at + 8) { C.done = true; this.p.court = null; this.p.raiseHeat(1, 'You skipped court: a warrant is out', 'fled'); this.radio('Non-bailable warrant issued. Pick them up on sight.'); this.p.save && this.p.save(); }
  }

  update(dt) {
    this.callsTick(dt); this.camsTick(dt); this.radioTick(dt); this.tackleTick(dt); this.pitTick(dt); this.armedTick(dt); this.courtTick(dt);
    const P = this.g.player; if (P.cur && P.cur.flat > 0) P.cur.flat -= dt;
  }
}
