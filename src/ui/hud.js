// NH48 interface: title (city select), in-game HUD, pause sheet, full map and the phone notice.
// Desktop first. The HUD sits in the corners with no boxes where text alone reads — location
// top-left, wallet top-right, map bottom-left, the vehicle bottom-right, prompts and subtitles
// bottom-centre, toasts under the objective.
import { fmtRupees, isTouch } from '../core/util.js';
import { MapScreen, CATS, drawPin, drawArrow, drawFlag, fmtDist } from './map.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const STONE = '<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M4 22a16 16 0 0 1 32 0v26H4z" fill="#F4F1EA"/><path d="M4 22a16 16 0 0 1 32 0z" fill="#F2B705"/><rect x="4" y="44" width="32" height="4" fill="#C9C4B8"/></svg>';
const ICON = {
  cam: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="4" width="13" height="9" rx="2"/><path d="M5.5 4l1-2h3l1 2"/><circle cx="8" cy="8.5" r="2.4"/></svg>',
  map: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 3.5l4-1.5 5 2 4-1.5v10l-4 1.5-5-2-4 1.5z"/><path d="M5.5 2v10.5M10.5 4v10.5"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>',
};
const AREA_NAMES = ['Deccan', 'Peth', 'Camp', 'Koregaon Park', 'Station', 'Pune', 'Riverside'];

function markColor(m) {
  if (m.kind === 'pax') return '#33d17a';
  if (m.kind === 'cop') return '#5aa2ff';
  if (m.kind === 'marshal') return (performance.now() / 250 | 0) % 2 ? '#ff4b3e' : '#4b7bff';
  return '#f2b705';
}
function clock(h) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  const ap = hh >= 12 ? 'PM' : 'AM';
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ap}`;
}

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.root.innerHTML = '';
    this.toasts = [];
    this.lastStreet = null;
    this.mmScale = 1.25;      // px per metre at standstill
    this.areaT = 0;
    this.suburbs = (game.W.M.pois || []).filter(p => p[4] === 'suburb').map(p => ({ n: p[0], x: p[2] / 100, z: p[3] / 100 }));
    this.build();
  }

  build() {
    const R = this.root;
    this.scrim = el('div', 'scrim');
    this.loc = el('div', 'h loc', `
      <div class="loc-area cap"><i class="tick"></i><span id="h-area">Deccan</span></div>
      <div class="loc-street" id="h-street">FC Road</div>
      <div class="loc-mr" lang="mr" id="h-street-mr"></div>
      <div class="loc-time"><span id="h-clock">4:30 PM</span><i class="dot"></i><span id="h-mode">Free roam</span></div>`);
    this.wallet = el('div', 'h wallet', `
      <div class="money num"><span class="cur">₹</span><span id="h-money">0</span></div>
      <div class="sub" id="h-rides"></div>
      <div class="dues" id="h-dues" hidden></div>
      <div class="lic" id="h-lic" hidden></div>
      <div class="heat" id="h-heat" hidden><span class="pips"><i></i><i></i><i></i></span><span id="h-heat-t">Wanted</span></div>`);
    this.zoneEl = el('div', 'h zone', '<i></i><b id="h-zone-t"></b><span id="h-zone-s"></span>');
    this.zoneEl.hidden = true;
    this.smsWrap = el('div', 'h smsbox');
    this.stopEl = el('div', 'stop glass');
    this.stopEl.hidden = true;
    this.stopEl.setAttribute('role', 'dialog'); this.stopEl.setAttribute('aria-label', 'Police stop');
    this.flashEl = el('div', 'flashov', '<div class="fl-in"><div class="fl-t"></div><div class="fl-s"></div></div>');
    this.flashEl.hidden = true;
    this.placeEl = el('div', 'h placecard', '<div class="pc-k">Landmark</div><div class="pc-t" id="h-pc-t"></div><div class="pc-mr" lang="mr" id="h-pc-mr"></div><div class="pc-s" id="h-pc-s"></div>');
    this.placeEl.hidden = true;
    this.obj = el('div', 'h obj', '<div class="obj-main" id="h-obj"></div><div class="obj-sub" id="h-obj-sub"></div>');
    this.mm = el('div', 'h mm');
    this.mmCanvas = el('canvas'); this.mmCanvas.width = 432; this.mmCanvas.height = 432;
    this.mm.append(this.mmCanvas, el('div', 'mm-n', 'N'));
    this.gps = el('div', 'mm-gps', '<span id="h-gps-t">Destination</span><b id="h-gps-d"></b>');
    this.gps.hidden = true;
    this.mm.appendChild(this.gps);
    this.dash = el('div', 'h dash', `
      <div class="glass fare" id="h-fare-box" hidden>
        <div class="cap"><span>Meter</span><b id="h-flag" class="idle">FOR HIRE</b></div>
        <span class="f num" id="h-fare">₹–</span><span class="k num" id="h-km">0.0 km</span><span class="t num" id="h-time">0:00</span>
      </div>
      <div class="lift" id="h-lift">TWO WHEELS</div>
      <div class="veh cap"><span id="h-veh">Bajaj RE · Auto rickshaw</span></div>
      <div class="speed"><span class="v num" id="h-speed">0</span><span class="u"><span class="gear" id="h-gear">N</span><span class="unit">KM/H</span></span></div>
      <div class="rpm" id="h-rpm"><i></i></div>`);
    this.lower = el('div', 'h lower', `
      <div class="glass prompt" id="h-prompt"><span class="kbd" id="h-prompt-k">F</span><span id="h-prompt-t"></span></div>
      <div class="subt" id="h-sub"><div class="who" id="h-sub-who"></div><div class="line" id="h-sub-line"></div><div class="tr" id="h-sub-tr"></div></div>`);
    this.toastWrap = el('div', 'h toasts');
    this.corner = el('div', 'h corner');
    const mkBtn = (icon, label, fn) => { const b = el('button', 'ibtn', `${ICON[icon]}<span class="sr">${label}</span>`); b.title = label; b.onclick = fn; return b; };
    this.corner.append(mkBtn('cam', 'Camera (C)', () => this.game.rig.setMode(this.game.rig.mode + 1)), mkBtn('map', 'Map (M)', () => this.game.toggleMap()),
      mkBtn('pause', 'Pause (Esc)', () => this.game.togglePause()));
    R.append(this.scrim, this.loc, this.wallet, this.placeEl, this.obj, this.mm, this.zoneEl, this.dash, this.lower, this.toastWrap, this.smsWrap, this.stopEl, this.flashEl);
    this.$ = (id) => document.getElementById(id);
    this.$money = this.$('h-money'); this.$speed = this.$('h-speed'); this.$gear = this.$('h-gear'); this.$rpm = this.$('h-rpm');
    this.buildTitle();
    this.buildPause();
    this.buildBigMap();
    this.setPlaying(false);
    if (isTouch && Math.min(innerWidth, innerHeight) < 720) this.buildPhoneNotice();
  }

  // ---------------------------------------------------------------- title / city select
  buildTitle() {
    const t = el('div', 'ov title');
    t.innerHTML = `
      <div class="t-col">
        <div class="t-brand">${STONE}<span class="t-word">NH48</span><span class="t-ed">Pune edition</span></div>
        <div class="t-hero">
          <h1>The city is <em>open</em>.</h1>
          <p>Deccan to Koregaon Park, mapped street by street. Drive anything, follow the rules or don’t, and the city remembers.</p>
        </div>
        <div class="cities" role="radiogroup" aria-label="City">
          <button class="city on" role="radio" aria-checked="true" id="c-pune"><canvas width="360" height="172"></canvas><span class="badge">Live</span>
            <span class="meta"><span class="nm">Pune <span lang="mr">पुणे</span></span><span class="ds">Deccan to Koregaon Park</span></span></button>
          <button class="city soon" role="radio" aria-checked="false" aria-disabled="true"><span class="art"></span><span class="badge">Soon</span>
            <span class="meta"><span class="nm">Bengaluru <span lang="kn">ಬೆಂಗಳೂರು</span></span><span class="ds">Coming later</span></span></button>
          <button class="city soon" role="radio" aria-checked="false" aria-disabled="true"><span class="art"></span><span class="badge">Soon</span>
            <span class="meta"><span class="nm">Mumbai <span lang="mr">मुंबई</span></span><span class="ds">Coming later</span></span></button>
        </div>
        <div class="t-actions">
          <button class="btn primary" id="t-roam">Play free roam <span class="kbd">↵</span></button>
          <button class="btn" id="t-shift">Start an auto shift</button>
        </div>
        <div class="t-foot">
          <span class="keys">
            <span><span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> drive</span>
            <span><span class="kbd">Space</span> handbrake</span><span><span class="kbd">H</span> horn</span>
            <span><span class="kbd">F</span> get out / take a vehicle</span><span><span class="kbd">C</span> camera</span><span><span class="kbd">M</span> map</span><span><span class="kbd">Esc</span> pause</span>
          </span>
          <span>Map data © OpenStreetMap contributors (ODbL) and Overture Maps Foundation. Businesses are fictional parodies.</span>
        </div>
      </div>`;
    this.root.appendChild(t);
    this.title = t;
    t.querySelector('#t-shift').onclick = () => this.game.startPlay(true);
    t.querySelector('#t-roam').onclick = () => this.game.startPlay(false);
    this.drawCityArt(t.querySelector('#c-pune canvas'));
  }
  drawCityArt(cv) {
    const city = this.game.city;
    if (!city) return;
    const x = cv.getContext('2d');
    const cx = city.x0 + (city.x1 - city.x0) * 0.49, cz = city.z0 + (city.z1 - city.z0) * 0.5;
    const ppm = cv.width / ((city.x1 - city.x0) * 0.62);
    const draw = () => {
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = '#101216'; x.fillRect(0, 0, cv.width, cv.height);
      x.save(); x.translate(cv.width / 2, cv.height / 2); x.globalAlpha = 0.92;
      city.drawTiles(x, cx, cz, ppm, 0, Math.hypot(cv.width, cv.height) / 2);
      x.restore();
      const gr = x.createLinearGradient(0, 0, 0, cv.height);
      gr.addColorStop(0, 'rgba(16,18,22,0)'); gr.addColorStop(1, 'rgba(16,18,22,.65)');
      x.fillStyle = gr; x.fillRect(0, 0, cv.width, cv.height);
    };
    draw(); city.pump(400); draw();
  }

  buildPhoneNotice() {
    const n = el('div', 'ov phone', `<div class="glass card" role="dialog" aria-labelledby="ph-t">
      <h3 id="ph-t">NH48 is made for computers</h3>
      <p>It isn’t optimised for phones yet — controls are basic and it may run slowly. If you have a laptop or desktop, open this link there.</p>
      <button class="btn primary" id="ph-ok">Play anyway</button></div>`);
    this.root.appendChild(n);
    n.querySelector('#ph-ok').onclick = () => n.remove();
  }

  // ---------------------------------------------------------------- pause
  buildPause() {
    const p = el('div', 'ov pause');
    p.hidden = true;
    p.innerHTML = `
      <div class="sheet" role="dialog" aria-label="Paused">
        <h2>Paused <span lang="mr">थांबा</span></h2>
        <div class="row2"><button class="btn primary" id="p-resume">Resume</button><button class="btn" id="p-map">Map</button></div>
        <div class="sec" id="p-ch"><div class="cap">E-challans</div>
          <div class="ch-row"><div><div class="ch-amt num" id="p-ch-amt">₹0</div><div class="note" id="p-ch-note">Nothing pending</div></div>
          <button class="btn" id="p-ch-pay">Pay all</button></div>
          <ul class="ch-list" id="p-ch-list"></ul></div>
        <div class="sec"><div class="cap">Time of day</div>
          <div class="seg" id="p-time"><button data-h="8.5">Morning</button><button data-h="13">Noon</button><button data-h="17.85">Sunset</button><button data-h="21.5">Night</button></div></div>
        <div class="sec"><div class="cap">Graphics</div>
          <div class="seg" id="p-q"><button data-q="low">Low</button><button data-q="med">Medium</button><button data-q="high">High</button></div>
          <div class="note" id="p-qnote"></div></div>
        <div class="sec"><label class="cap" for="p-vol">Sound</label><input type="range" id="p-vol" min="0" max="1" step="0.05"></div>
        <div class="sec"><div class="cap">Controls</div>
          <div class="keylist">
            <span class="k"><span class="kbd">W</span><span class="kbd">S</span></span><span>Accelerate · brake, hold to reverse</span>
            <span class="k"><span class="kbd">A</span><span class="kbd">D</span></span><span>Steer</span>
            <span class="k"><span class="kbd">Space</span></span><span>Handbrake</span>
            <span class="k"><span class="kbd">H</span></span><span>Horn</span>
            <span class="k"><span class="kbd">C</span><span class="kbd">B</span></span><span>Camera · look back</span>
            <span class="k"><span class="kbd">R</span></span><span>Back on the road</span>
            <span class="k"><span class="kbd">F</span></span><span>Get out · get in or take a vehicle</span>
            <span class="k"><span class="kbd">Shift</span></span><span>Sprint (on foot)</span>
            <span class="k"><span class="kbd">1</span><span class="kbd">4</span></span><span>Answer the police</span>
          </div></div>
        <button class="btn" id="p-title">Quit to title</button>
        <div class="fine">Map data © OpenStreetMap contributors (ODbL); buildings and places from Overture Maps Foundation (ODbL, CDLA-Permissive-2.0), including Google Open Buildings and Microsoft footprints. All business names are fictional parodies of real places. People and animals: Quaternius (CC0). Voices: Kokoro-82M (Apache-2.0) and Piper mr_IN, trained on Google’s crowdsourced Marathi speech (OpenSLR 64, CC BY-SA 4.0). Sounds: Freesound (CC0). Fines follow the MV Act as reported for Pune and may be out of date.</div>
      </div>`;
    this.root.appendChild(p);
    this.pause = p;
    p.addEventListener('click', (e) => { if (e.target === p) this.game.togglePause(false); });
    p.querySelector('#p-resume').onclick = () => this.game.togglePause(false);
    p.querySelector('#p-map').onclick = () => { this.game.togglePause(false); this.game.toggleMap(true); };
    p.querySelector('#p-title').onclick = () => this.game.endShift();
    p.querySelectorAll('#p-time button').forEach(b => b.onclick = () => { this.game.setHour(parseFloat(b.dataset.h)); this.syncPause(); });
    p.querySelectorAll('#p-q button').forEach(b => b.onclick = () => { this.game.setQuality(b.dataset.q); this.syncPause(); });
    p.querySelector('#p-ch-pay').onclick = () => { if (this.game.police) this.game.police.payDues(); this.syncPause(); };
    const vol = p.querySelector('#p-vol');
    vol.oninput = () => this.game.audio.setVolume(parseFloat(vol.value));
  }
  syncPause() {
    const g = this.game;
    this.pause.querySelectorAll('#p-q button').forEach(b => b.classList.toggle('on', b.dataset.q === g.qualityName));
    this.pause.querySelector('#p-vol').value = g.audio.volume;
    this.pause.querySelector('#p-qnote').textContent = g.qualityNote || '';
    const h = g.hour;
    this.pause.querySelectorAll('#p-time button').forEach(b => b.classList.toggle('on', Math.abs(parseFloat(b.dataset.h) - h) < 1.5));
    const pol = g.police;
    if (pol) {
      const tot = pol.duesTotal;
      this.$('p-ch-amt').textContent = fmtRupees(tot);
      this.$('p-ch-note').textContent = tot ? `${pol.dues.length} pending${pol.suspended ? ' · licence suspended' : ''}` : pol.suspended ? 'Licence suspended' : 'Nothing pending';
      this.$('p-ch-pay').disabled = !tot;
      const ul = this.$('p-ch-list');
      ul.innerHTML = '';
      for (const d of pol.history.slice(-4).reverse()) {
        const li = el('li', d.paid ? 'paid' : '');
        li.append(el('span', '', ''), el('b', 'num', fmtRupees(d.amt)));
        li.firstChild.textContent = `${d.what} · ${d.where}`;
        ul.appendChild(li);
      }
    }
  }

  buildBigMap() {
    this.mapScreen = new MapScreen(this.game, this.root, this.game.city);
    this.bigmap = this.mapScreen.el;
  }

  setPlaying(on) {
    for (const e of [this.scrim, this.loc, this.wallet, this.obj, this.mm, this.dash, this.lower, this.toastWrap, this.smsWrap]) e.hidden = !on;
    if (!on) { this.zoneEl.hidden = true; this.stopEl.hidden = true; }
    if (on) this.root.appendChild(this.corner); else this.corner.remove();
    this.title.hidden = on;
    this.$('h-sub').classList.remove('show');
    this.$('h-mode').textContent = this.game.rides && this.game.rides.enabled ? 'Auto shift' : 'Free roam';
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.game, p = g.player;
    // vehicle cluster only while driving
    const foot = !!p.onFoot;
    this.dash.classList.toggle('foot', foot);
    const vl = p.vehicleLabel ? p.vehicleLabel() : 'Bajaj RE \u00b7 Auto rickshaw';
    if (vl !== this._vl) { this._vl = vl; this.$('h-veh').textContent = vl; }
    const kmh = Math.abs(p.v) * 3.6;
    this.$speed.textContent = Math.round(kmh);
    const gear = p.reverse ? 'R' : p.v < 0.2 && p.throttle < 0.1 ? 'N' : String(p.gear);
    if (this.$gear.textContent !== gear) { this.$gear.textContent = gear; this.$gear.classList.toggle('r', gear === 'R'); }
    this.$rpm.firstElementChild.style.width = Math.round(Math.min(1, p.rpm || 0) * 100) + '%';
    this.$rpm.classList.toggle('hi', (p.rpm || 0) > 0.92);
    const money = fmtRupees(g.stats.money).replace('₹', '');
    if (this.$money.textContent !== money) {
      if (this.$money.textContent && this.$money.textContent !== '0') { this.$money.parentElement.classList.remove('flash'); void this.$money.offsetWidth; this.$money.parentElement.classList.add('flash'); }
      this.$money.textContent = money;
    }
    this.$('h-rides').textContent = g.stats.rides ? `${g.stats.rides} ${g.stats.rides === 1 ? 'ride' : 'rides'} · ★ ${g.stats.rating.toFixed(1)}` : '';
    this.$('h-clock').textContent = clock(g.hour);
    if (this.pcT > 0) { this.pcT -= dt; if (this.pcT <= 0) this.placeEl.classList.remove('show'); if (this.pcT < -0.5) this.placeEl.hidden = true; }
    // fare meter only on a shift
    const shift = g.rides && g.rides.enabled;
    this.$('h-fare-box').hidden = !shift;
    if (shift) {
      const ride = g.rides.current, flag = this.$('h-flag');
      if (ride && ride.state === 'onboard') {
        this.$('h-fare').textContent = '₹' + Math.round(ride.fare);
        this.$('h-km').textContent = (ride.dist / 1000).toFixed(1) + ' km';
        const t = Math.max(0, Math.floor(ride.elapsed));
        this.$('h-time').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
        flag.textContent = 'METER DOWN'; flag.classList.remove('idle');
      } else {
        this.$('h-fare').textContent = '₹–'; this.$('h-km').textContent = '0.0 km'; this.$('h-time').textContent = '0:00';
        flag.textContent = 'FOR HIRE'; flag.classList.add('idle');
      }
    }
    this.$('h-lift').classList.toggle('show', p.lift > 0.08 && !p.tipped);
    // area name (nearest suburb within ~900 m, else the district)
    this.areaT -= dt;
    if (this.areaT <= 0) {
      this.areaT = 1;
      let best = null, bd = 900 * 900;
      for (const s of this.suburbs) { const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2; if (d < bd) { bd = d; best = s; } }
      this.$('h-area').textContent = best ? best.n.replace(/ Peth$/, ' Peth') : AREA_NAMES[g.W.index.district(p.x, p.z)] || 'Pune';
    }
    // objective
    const o = g.objective();
    this.$('h-obj').textContent = o.main || '';
    this.$('h-obj-sub').textContent = o.sub || '';
    this.obj.classList.toggle('urgent', !!o.urgent);
    // gps chip
    const dest = g.rides && g.rides.current && g.rides.routeLeft;
    const wpLeft = !dest && g.waypoint && g.nav ? g.nav.left : 0;
    this.gps.hidden = !dest && !wpLeft;
    this.gps.classList.toggle('wp', !dest && !!wpLeft);
    if (dest) { this.$('h-gps-t').textContent = 'Destination'; this.$('h-gps-d').textContent = fmtDist(dest); }
    else if (wpLeft) { this.$('h-gps-t').textContent = g.waypoint.name || 'Waypoint'; this.$('h-gps-d').textContent = fmtDist(wpLeft); }
    // landmark arrival cards
    this.lmT = (this.lmT || 0) - dt;
    if (this.lmT <= 0 && g.state === 'play') {
      this.lmT = 1;
      this.lmSeen = this.lmSeen || new Map();
      const now = performance.now();
      for (const l of g.city.places) {
        if (l.c !== 'landmark') continue;
        if ((l.x - p.x) ** 2 + (l.z - p.z) ** 2 > 70 * 70) continue;
        if (now - (this.lmSeen.get(l.n) || -1e9) < 600000) continue;
        this.lmSeen.set(l.n, now);
        this.placeCard(l);
        break;
      }
    }
    // timed bits
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.life -= dt;
      if (t.life < 0.35) t.el.classList.add('out');
      if (t.life <= 0) { t.el.remove(); this.toasts.splice(i, 1); }
    }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.$('h-sub').classList.remove('show'); }
    if (this.promptT > 0) { this.promptT -= dt; if (this.promptT <= 0) this.$('h-prompt').classList.remove('show'); }
    this.drawMinimap(dt);
    if (!this.mapScreen.hidden) this.mapScreen.draw(dt);
    else g.city.pump(1.5);
  }

  toast(main, sub = '', kind = 'info', life = 3) {
    const t = el('div', 'glass toast ' + kind, `<div class="tt-main"></div>${sub ? '<div class="tt-sub"></div>' : ''}`);
    t.querySelector('.tt-main').textContent = main;
    if (sub) t.querySelector('.tt-sub').textContent = sub;
    this.toastWrap.appendChild(t);
    this.toasts.push({ el: t, life });
    while (this.toasts.length > 3) { const o = this.toasts.shift(); o.el.remove(); }
  }
  // subtitles: speaker, line as spoken, English translation
  say(who, line, tr, life = 4.5) {
    this.$('h-sub-who').textContent = who || '';
    this.$('h-sub-line').textContent = line || '';
    this.$('h-sub-tr').textContent = tr || '';
    this.$('h-sub').classList.add('show');
    this.subT = life;
  }
  prompt(key, text, life = 0.25) {
    this.$('h-prompt-k').textContent = key;
    this.$('h-prompt-t').textContent = text;
    this.$('h-prompt').classList.add('show');
    this.promptT = life;
  }
  showStreet(mr, en) {
    if (!en || en === this.lastStreet) return;
    this.lastStreet = en;
    this.loc.classList.add('fade');
    clearTimeout(this._stT);
    this._stT = setTimeout(() => {
      this.$('h-street').textContent = en;
      this.$('h-street-mr').textContent = mr || '';
      this.loc.classList.remove('fade');
    }, 220);
  }
  // wanted level 0–3; `seen` = a marshal has eyes on you; frac = how close they are to giving up
  setHeat(level, seen, frac) {
    const h = this.$('h-heat');
    h.hidden = !level;
    if (!level) return;
    h.querySelectorAll('.pips i').forEach((p, i) => p.classList.toggle('on', i < level));
    h.classList.toggle('seen', !!seen);
    this.$('h-heat-t').textContent = seen ? 'Police on you' : 'Searching';
  }
  setLicence(suspended, hoursLeft, dues) {
    const d = this.$('h-dues'), l = this.$('h-lic');
    d.hidden = !dues;
    if (dues) d.textContent = `${fmtRupees(dues)} challans pending`;
    l.hidden = !suspended;
    if (suspended) l.textContent = hoursLeft > 0 ? `Licence suspended · ${Math.ceil(hoursLeft)} h` : 'Licence suspended · pay dues';
  }
  setZone(z) {
    const key = z ? z.kind + z.text + z.sub : '';
    if (key === this._zoneKey) return;
    this._zoneKey = key;
    this.zoneEl.hidden = !z;
    if (!z) return;
    this.zoneEl.className = 'h zone ' + z.kind;
    this.$('h-zone-t').textContent = z.text; this.$('h-zone-s').textContent = z.sub || '';
  }
  // phone-style notification (e-challans, towing, news)
  sms(app, body, amt = '', foot = '') {
    const c = el('div', 'glass sms', `<div class="sm-h"><span class="sm-app"></span><span class="sm-now">now</span></div><div class="sm-b"></div>${amt ? '<div class="sm-amt num"></div>' : ''}${foot ? '<div class="sm-f"></div>' : ''}`);
    c.querySelector('.sm-app').textContent = app;
    c.querySelector('.sm-b').textContent = body;
    if (amt) c.querySelector('.sm-amt').textContent = amt;
    if (foot) c.querySelector('.sm-f').textContent = foot;
    this.smsWrap.prepend(c);
    while (this.smsWrap.children.length > 2) this.smsWrap.lastChild.remove();
    setTimeout(() => c.classList.add('out'), 7600);
    setTimeout(() => c.remove(), 8000);
  }
  // police stop: the officer's line, the offence and your options (keys 1–4 or click)
  openStop(o) {
    const S = this.stopEl;
    S.className = 'stop glass';
    S.innerHTML = `<div class="st-head"><span class="st-who"></span><span class="st-off"></span>${o.amt ? '<span class="st-amt num"></span>' : ''}</div>
      <div class="st-line"></div><div class="st-tr"></div><div class="st-opts"></div><div class="st-foot"></div>`;
    S.querySelector('.st-who').textContent = o.who;
    S.querySelector('.st-off').textContent = o.kind + (o.law ? ` · ${o.law}` : '');
    if (o.amt) S.querySelector('.st-amt').textContent = o.amt;
    S.querySelector('.st-line').textContent = `“${o.line}”`;
    S.querySelector('.st-tr').textContent = o.tr;
    S.querySelector('.st-foot').textContent = o.foot;
    const box = S.querySelector('.st-opts');
    o.opts.forEach((op, i) => {
      const b = el('button', 'st-opt', `<span class="kbd">${i + 1}</span><span class="o-t"></span><span class="o-s"></span>`);
      b.querySelector('.o-t').textContent = op.t; b.querySelector('.o-s').textContent = op.s;
      b.onclick = () => o.onPick(i);
      box.appendChild(b);
    });
    S.hidden = false;
    this.lower.classList.add('dim');
  }
  stopResult(res, sub, kind, line, tr) {
    const S = this.stopEl;
    S.classList.add('done', kind);
    if (line) { S.querySelector('.st-line').textContent = `“${line}”`; S.querySelector('.st-tr').textContent = tr; }
    const box = S.querySelector('.st-opts');
    box.innerHTML = '<div class="st-res"><div class="r-t"></div><div class="r-s"></div></div><button class="btn small st-go">Continue <span class="kbd">↵</span></button>';
    box.querySelector('.r-t').textContent = res; box.querySelector('.r-s').textContent = sub;
    box.querySelector('.st-go').onclick = () => this.game.police && this.game.police.stop && this.game.police.finishTalk();
  }
  closeStop() { this.stopEl.hidden = true; this.lower.classList.remove('dim'); }
  // full-screen moment (arrest): fades in and out
  // small lower-left card when you pass a landmark (never covers the screen)
  placeCard(l) {
    this.$('h-pc-t').textContent = l.n; this.$('h-pc-mr').textContent = l.mr || ''; this.$('h-pc-s').textContent = l.blurb || '';
    this.placeEl.hidden = false; void this.placeEl.offsetWidth; this.placeEl.classList.add('show');
    this.pcT = 6;
  }
  flash(title, sub) {
    const F = this.flashEl;
    F.querySelector('.fl-t').textContent = title; F.querySelector('.fl-s').textContent = sub;
    F.hidden = false; F.classList.remove('go'); void F.offsetWidth; F.classList.add('go');
    clearTimeout(this._flT); this._flT = setTimeout(() => { F.hidden = true; }, 4200);
  }

  // ---------------------------------------------------------------- minimap (heading-up, drawn from the shared map tiles)
  drawMinimap() {
    const g = this.game, p = g.player, city = g.city;
    if (!city) return;
    const c = this.mmCanvas, x = c.getContext('2d');
    const S = c.width, r = S / 2;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#101216'; x.fillRect(0, 0, S, S);
    const k = S / 216;                 // canvas px per css px
    const sc = this.mmScale * k * (1 - Math.min(0.45, Math.abs(p.v) / 32));     // canvas px per metre, zooms out with speed
    const rot = -p.th - Math.PI / 2;
    const cy = r + 34 * k;             // player sits below centre: more road ahead
    x.save(); x.translate(r, cy);
    city.drawTiles(x, p.x, p.z, sc, rot, S * 0.95);
    // world-space overlays
    x.rotate(rot); x.scale(sc, sc); x.translate(-p.x, -p.z);
    const line = (pts, col, w) => {
      if (!pts || pts.length < 4) return;
      x.lineJoin = 'round'; x.lineCap = 'round';
      x.beginPath(); for (let i = 0; i < pts.length; i += 2) i ? x.lineTo(pts[i], pts[i + 1]) : x.moveTo(pts[i], pts[i + 1]);
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = (w + 3) * k / sc; x.stroke();
      x.strokeStyle = col; x.lineWidth = w * k / sc; x.stroke();
    };
    line(g.nav && g.nav.pts, '#5fd0ff', 5);
    line(g.rides && g.rides.routePts, '#f2b705', 5);
    x.restore();
    // screen-space markers (kept upright)
    const toS = (X, Z) => { const dx = X - p.x, dz = Z - p.z; return [r + (dx * Math.cos(rot) - dz * Math.sin(rot)) * sc, cy + (dx * Math.sin(rot) + dz * Math.cos(rot)) * sc]; };
    const lim = r - 14 * k;
    const inView = (X, Y) => Math.abs(X - r) < lim && Math.abs(Y - r) < lim;
    const vr = S / sc;
    for (const l of city.placesNear(p.x, p.z, vr)) {
      if (l.c !== 'landmark' && l.c !== 'police' && l.c !== 'fuel' && l.c !== 'hospital') continue;
      const [X, Y] = toS(l.x, l.z); if (!inView(X, Y)) continue;
      const [, col, gl] = CATS[l.c];
      drawPin(x, X, Y, col, gl, (l.c === 'landmark' ? 8 : 6.5) * k);
    }
    const marks = [...(g.rides ? g.rides.markers() : []), ...(g.police ? g.police.markers() : [])];
    if (g.waypoint) marks.push({ kind: 'wp', x: g.waypoint.x, z: g.waypoint.z });
    for (const m of marks) {
      let [X, Y] = toS(m.x, m.z);
      const edge = !inView(X, Y);
      if (edge) {
        if (m.kind === 'marshal' || m.kind === 'cop') continue;
        const f = lim / Math.max(Math.abs(X - r), Math.abs(Y - r)); X = r + (X - r) * f; Y = r + (Y - r) * f;
      }
      if (m.kind === 'wp') { if (edge) drawPin(x, X, Y, '#5fd0ff', null, 6 * k); else { x.save(); x.scale(k, k); drawFlag(x, X / k, Y / k); x.restore(); } continue; }
      drawPin(x, X, Y, markColor(m), m.kind === 'tow' ? 'A' : null, (m.kind === 'marshal' ? 6 : 7) * k);
    }
    drawArrow(x, r, cy, 0, k);
    const n = this.mm.querySelector('.mm-n');
    const na = rot - Math.PI / 2, R2 = 216 / 2 - 14;
    const nx = Math.cos(na), nz = Math.sin(na), f = R2 / Math.max(Math.abs(nx), Math.abs(nz));
    n.style.transform = `translate(${(nx * f).toFixed(1)}px, ${(nz * f).toFixed(1)}px)`;
  }
}

