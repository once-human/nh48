import { icon } from './icons.js';
// NH48 interface: title (city select), in-game HUD, pause sheet, full map and the phone notice.
// Desktop first. The HUD sits in the corners with no boxes where text alone reads, location
// top-left, wallet top-right, map bottom-left, the vehicle bottom-right, prompts and subtitles
// bottom-centre, toasts under the objective.
import { settingsHTML, bindSettings, syncSettings } from '../game/settings.js';
import * as THREE from 'three';
import { fmtRupees, isTouch } from '../core/util.js';
import { MapScreen, CATS, drawPin, drawArrow, drawFlag, fmtDist } from './map.js';
import { SKINS, HAIRS, HAIR_COLS, OUTFITS, lookOf, normalise, savedCharacter, saveCharacter } from '../people/characters.js';

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
function clock(h, h24) {
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  if (h24) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
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
      <div class="hp" id="h-hp" hidden><i></i></div>
      <div class="vitals" id="h-vit" hidden></div>
      <div class="heat" id="h-heat" hidden><span class="pips"><i></i><i></i><i></i></span><span id="h-heat-t">Wanted</span></div>`);
    this.zoneEl = el('div', 'h zone', '<i></i><b id="h-zone-t"></b><span id="h-zone-s"></span>');
    this.zoneEl.hidden = true;
    this.smsWrap = el('div', 'h smsbox');
    this.stopEl = el('div', 'stop glass');
    this.stopEl.hidden = true;
    this.stopEl.setAttribute('role', 'dialog'); this.stopEl.setAttribute('aria-label', 'Police stop');
    this.hurtEl = el('div', 'hurtov');
    this.flashEl = el('div', 'flashov', '<div class="fl-in"><div class="fl-t"></div><div class="fl-s"></div></div>');
    this.flashEl.hidden = true;
    this.placeEl = el('div', 'h placecard', '<div class="pc-k">Landmark</div><div class="pc-t" id="h-pc-t"></div><div class="pc-mr" lang="mr" id="h-pc-mr"></div><div class="pc-s" id="h-pc-s"></div>');
    this.placeEl.hidden = true;
    this.obj = el('div', 'h obj', '<div class="obj-main" id="h-obj"></div><div class="obj-sub" id="h-obj-sub"></div>');
    this.mm = el('div', 'h mm');
    this.mmCanvas = el('canvas'); this.mmCanvas.width = 432; this.mmCanvas.height = 432;
    this.mm.append(this.mmCanvas, el('div', 'mm-n', 'N'), el('div', 'mm-hint', '<span class="kbd">M</span> map'));
    // the minimap opens the big map
    this.mm.style.pointerEvents = 'auto'; this.mm.style.cursor = 'pointer';
    this.mm.title = 'Open the map (M)';
    this.mm.addEventListener('click', () => this.game.toggleMap(true));
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
      <div class="rpm" id="h-rpm"><i></i></div>
      <div class="fuel" id="h-fuel"><span id="h-fuel-k">CNG</span><i><b></b></i><em id="h-dmg" hidden></em></div>`);
    this.lower = el('div', 'h lower', `
      <div class="glass prompt" id="h-prompt"><span class="kbd" id="h-prompt-k">F</span><span id="h-prompt-t"></span></div>
      <div class="subt" id="h-sub"><div class="who" id="h-sub-who"></div><div class="line" id="h-sub-line"></div><div class="tr" id="h-sub-tr"></div></div>`);
    this.toastWrap = el('div', 'h toasts');
    // health, food, water, energy: always on screen, just above the minimap
    // the four vitals: rings like an activity watch, a bold glyph in each
    const VG = {
      h: '<path d="M12 20.3 4.6 13.2A4.9 4.9 0 0 1 12 6.9a4.9 4.9 0 0 1 7.4 6.3Z"/>',
      f: '<path d="M7 3v7a2 2 0 0 0 1.5 1.9V21h2v-9.1A2 2 0 0 0 12 10V3h-1.4v6h-1V3H8.4v6h-1V3Zm8.6 0c-1.8 0-2.6 2.7-2.6 6 0 1.6.9 2.7 2 3V21h2V3Z"/>',
      w: '<path d="M12 2.8s-6.2 7-6.2 11.3a6.2 6.2 0 0 0 12.4 0C18.2 9.8 12 2.8 12 2.8Z"/>',
      e: '<path d="M13.6 2 5 13.4h6l-1.4 8.6 8.8-11.6h-6.1Z"/>',
    };
    const C = 2 * Math.PI * 15;
    this.vit = el('div', 'h vit', ['h:Health', 'f:Hunger', 'w:Thirst', 'e:Energy'].map(k => { const [c, n] = k.split(':');
      return `<span class="v-${c}" title="${n}"><svg viewBox="0 0 36 36"><circle class="tr" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0"/></svg><svg class="gl" viewBox="0 0 24 24">${VG[c]}</svg></span>`; }).join(''));
    this.vitC = C;
    this.nerd = el('div', 'h nerd', 'E jhola · Tab status · F3 stats');
    this.corner = el('div', 'h corner');
    const mkBtn = (icon, label, fn) => { const b = el('button', 'ibtn', `${ICON[icon]}<span class="sr">${label}</span>`); b.title = label; b.onclick = fn; return b; };
    this.corner.append(mkBtn('pause', 'Pause (Esc)', () => this.game.togglePause()));
    R.append(this.scrim, this.hurtEl, this.vit, this.nerd, this.loc, this.wallet, this.placeEl, this.obj, this.mm, this.zoneEl, this.dash, this.lower, this.toastWrap, this.smsWrap, this.stopEl, this.flashEl);
    this.$ = (id) => document.getElementById(id);
    this.$money = this.$('h-money'); this.$speed = this.$('h-speed'); this.$gear = this.$('h-gear'); this.$rpm = this.$('h-rpm');
    this.buildTitle();
    this.buildPause();
    this.buildBigMap();
    this.setPlaying(false);
    if (isTouch && Math.min(innerWidth, innerHeight) < 720) this.buildPhoneNotice();
  }

  // ---------------------------------------------------------------- title
  buildTitle() {
    const t = el('div', 'ov title');
    t.innerHTML = `
      <div class="t-col">
        <div class="t-brand">${STONE}<span class="t-word">NH48</span><span class="t-ed">Pune</span></div>
        <div class="t-hero">
          <div class="t-kicker"><span lang="mr">पुणे</span> · Deccan to Koregaon Park</div>
          <h1>The city is <em>open</em>.</h1>
          <p>Every real street, every real shop (with a wink), the Mills at midnight and the peths at noon. Your auto is waiting. Drive it, fill it, or leave it and walk.</p>
        </div>
        <div class="t-start">
          <button class="btn primary t-go" id="t-roam">Start <span class="kbd">↵</span></button>
          <button class="t-who" id="t-who" hidden><span class="t-who-sw"></span><span class="t-who-t"><b></b><small>Change character</small></span></button>
        </div>
        <div class="t-stats" id="t-stats"></div>
        <div class="t-cities"><span class="on"><canvas width="240" height="96" id="c-pune"></canvas><b>Pune</b><i>Live</i></span><span><b>Bengaluru</b><i>Later</i></span><span><b>Mumbai</b><i>Later</i></span></div>
        <div class="t-foot">
          <span class="keys">
            <span><span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> drive / walk</span>
            <span><span class="kbd">Space</span> handbrake · jump / climb</span><span><span class="kbd">F</span> get in / out · shops · talk</span><span><span class="kbd">Click</span> punch</span><span><span class="kbd">C</span> roll</span><span><span class="kbd">E</span> backpack</span>
            <span><span class="kbd">H</span> horn</span><span><span class="kbd">C</span> camera (driving)</span><span><span class="kbd">M</span> map</span><span><span class="kbd">Esc</span> pause</span>
          </span>
          <span>Map data © OpenStreetMap contributors (ODbL), Overture Maps Foundation. Businesses are parodies.</span>
        </div>
      </div>`;
    this.root.appendChild(t);
    this.title = t;
    t.querySelector('#t-roam').onclick = () => this.game.begin();
    t.querySelector('#t-who').onclick = () => this.showPicker(() => this.syncTitle());
    this.drawCityArt(t.querySelector('#c-pune'));
    this.syncTitle();
  }
  syncTitle() {
    const t = this.title; if (!t) return;
    const sv = savedCharacter();
    const who = t.querySelector('#t-who');
    who.hidden = !sv;
    if (sv) {
      const o = OUTFITS[sv.female ? 'f' : 'm'].find(x => x.id === sv.outfit) || OUTFITS.m[0];
      who.querySelector('b').textContent = `Playing as ${sv.name}`;
      who.querySelector('.t-who-sw').style.background = '#' + o.top.toString(16).padStart(6, '0');
      t.querySelector('#t-roam').firstChild.textContent = 'Start ';
    }
    const S = this.game.stats;
    t.querySelector('#t-stats').innerHTML = S ? `<span><b>${fmtRupees(S.money)}</b> in your pocket</span><span><b>${S.rides || 0}</b> rides done</span>${S.rating ? `<span><b>${S.rating.toFixed(1)}★</b> rating</span>` : ''}` : '';
  }
  hasCharacter() { return !!savedCharacter(); }
  // ---------------------------------------------------------------- character picker
  showPicker(done) {
    if (!this.picker) this.buildPicker();
    const P = this.picker;
    P.sel = normalise(savedCharacter() || {});
    P.done = done;
    P.el.hidden = false; this.pickerOpen = true;
    P.el.querySelector('#pk-name').value = P.sel.name;
    this.renderPicker();
    P.run = true; P.loop();
  }
  buildPicker() {
    const m = el('div', 'ov picker');
    m.innerHTML = `
      <div class="pk-l">
        <div class="pk-h"><span class="t-ed">Who are you?</span><h2>Make your character</h2><p>Nobody else in the city looks like you. Change it any time from the menu.</p></div>
        <label class="pk-f"><span>Name</span><input id="pk-name" maxlength="18" autocomplete="off" spellcheck="false" placeholder="Your name"></label>
        <div class="pk-f"><span>You are</span><div class="seg wide pk-g"><button data-g="m">A man</button><button data-g="f">A woman</button></div></div>
        <div class="pk-f"><span>Hair</span><div class="pk-chips" id="pk-hair"></div></div>
        <div class="pk-f"><span>Hair colour</span><div class="pk-sw" id="pk-hc"></div></div>
        <div class="pk-f"><span>Clothes</span><div class="pk-chips" id="pk-out"></div></div>
        <div class="pk-f"><span>Skin tone</span><div class="pk-sw" id="pk-skin"></div></div>
        <div class="pk-go"><button class="btn primary" id="pk-ok">Play</button><button class="btn" id="pk-x">Back</button></div>
      </div>
      <div class="pk-r"><canvas class="pk-cv"></canvas><div class="pk-name"></div><div class="pk-say"></div><div class="pk-hint">Drag to turn</div></div>`;
    this.root.appendChild(m);
    const P = this.picker = { el: m, cv: m.querySelector('.pk-cv'), yaw: 0.35, run: false };
    const nameIn = m.querySelector('#pk-name');
    nameIn.addEventListener('keydown', e => e.stopPropagation(), true);
    nameIn.oninput = () => { P.sel.name = nameIn.value.replace(/[^\p{L}\p{M} .'-]/gu, '').slice(0, 18); this.renderPicker(true); };
    m.querySelectorAll('.pk-g button').forEach(b => b.onclick = () => {
      const f = b.dataset.g === 'f';
      if (f === P.sel.female) return;
      const wasDefault = !P.sel.name || P.sel.name === (P.sel.female ? 'Ananya' : 'Aarav');
      P.sel.female = f; P.sel.hair = ''; P.sel.outfit = '';
      if (wasDefault) { P.sel.name = f ? 'Ananya' : 'Aarav'; nameIn.value = P.sel.name; }
      P.sel = normalise(P.sel);
      this.renderPicker(); this.pickerVoice();
    });
    m.querySelector('#pk-ok').onclick = () => {
      if (!P.sel.name.trim()) { nameIn.focus(); nameIn.classList.add('bad'); return; }
      P.sel.name = P.sel.name.trim();
      saveCharacter(P.sel);
      this.game.player.setLook(lookOf(P.sel));
      this.game.playerName = P.sel.name;
      this.closePicker(); if (P.done) P.done();
    };
    m.querySelector('#pk-x').onclick = () => this.closePicker();
    let drag = null;
    P.cv.addEventListener('pointerdown', e => { drag = e.clientX; P.cv.setPointerCapture(e.pointerId); });
    P.cv.addEventListener('pointermove', e => { if (drag !== null) { P.yaw += (e.clientX - drag) * 0.012; drag = e.clientX; } });
    P.cv.addEventListener('pointerup', () => { drag = null; });
    // a small separate renderer for the preview
    const R = new THREE.WebGLRenderer({ canvas: P.cv, antialias: true, alpha: true });
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.95;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a3226, 1.6));
    const key = new THREE.DirectionalLight(0xfff0dc, 1.9); key.position.set(2, 3, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2); rim.position.set(-2.5, 2, -2); scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.75, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    Object.assign(P, { R, scene, cam, clock: new THREE.Clock(), H: null, key: '' });
    P.loop = () => {
      if (!P.run) return;
      requestAnimationFrame(P.loop);
      const w = P.cv.clientWidth, h = P.cv.clientHeight;
      if (w && h && (P.w !== w || P.h !== h)) { P.w = w; P.h = h; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      const dt = Math.min(0.05, P.clock.getDelta());
      const tall = 1.85, dist = tall / 2 / Math.tan(cam.fov * Math.PI / 360) * (cam.aspect < 0.7 ? 1.45 / cam.aspect * 0.7 : 1.25);
      cam.position.set(0, 1.0, dist); cam.lookAt(0, 0.92, 0);
      if (P.H) { P.H.mixer.update(dt); P.H.holder.rotation.y = P.yaw - Math.PI / 2; }
      R.render(scene, cam);
    };
  }
  // switching man / woman: the new you says something
  pickerVoice() {
    const P = this.picker, A = this.game.audio, f = P.sel.female;
    const LINES = f ? [['pk_f0', 'Okay Pune. Let’s see what you’ve got.'], ['pk_f1', 'Chal, the city’s waiting.'], ['pk_f2', 'Yeah. This feels like me.'], ['pk_f3', 'FC Road, here I come.']]
      : [['pk_m0', 'Right. Let’s go, Pune.'], ['pk_m1', 'Chal bhai, kaam pe chalte hain.'], ['pk_m2', 'This one. Definitely this one.'], ['pk_m3', 'Koregaon Park tonight? Let’s see.']];
    P.vi = ((P.vi ?? -1) + 1) % LINES.length;
    const [id, text] = LINES[P.vi];
    const say = P.el.querySelector('.pk-say'); say.textContent = text; say.classList.remove('on'); void say.offsetWidth; say.classList.add('on');
    if (A && A.raw && !A.raw['v_' + id]) return;
    if (A && !A.voice(id, 1, 0, false, 2)) setTimeout(() => A.voice(id, 1, 0, false, 2), 250);
  }
  renderPicker(nameOnly) {
    const P = this.picker, m = P.el, S = P.sel, g = S.female ? 'f' : 'm';
    m.querySelector('#pk-ok').textContent = S.name.trim() ? `Play as ${S.name.trim()}` : 'Play';
    m.querySelector('.pk-name').textContent = S.name.trim();
    m.querySelector('#pk-name').classList.remove('bad');
    if (nameOnly) return;
    m.querySelectorAll('.pk-g button').forEach(b => b.classList.toggle('on', (b.dataset.g === 'f') === !!S.female));
    const chips = (id, list, key) => {
      const box = m.querySelector(id); box.innerHTML = '';
      for (const it of list) { const b = el('button', 'pk-chip' + (it.id === S[key] ? ' on' : ''), it.name); b.onclick = () => { S[key] = it.id; this.renderPicker(); }; box.appendChild(b); }
    };
    const sw = (id, list, key) => {
      const box = m.querySelector(id); box.innerHTML = '';
      for (const it of list) { const b = el('button', 'pk-s' + (it.id === S[key] ? ' on' : ''), `<i style="background:#${it.hex.toString(16).padStart(6, '0')}"></i>${it.name}`); b.onclick = () => { S[key] = it.id; this.renderPicker(); }; box.appendChild(b); }
    };
    chips('#pk-hair', HAIRS[g], 'hair'); chips('#pk-out', OUTFITS[g], 'outfit');
    sw('#pk-hc', HAIR_COLS, 'hairCol'); sw('#pk-skin', SKINS, 'skin');
    const key = [S.female, S.hair, S.hairCol, S.outfit, S.skin].join('/');
    const kit = this.game.W.kit;
    if (kit && key !== P.key) {
      const gChanged = !P.H || !!P.H.look.female !== !!S.female;
      P.key = key;
      if (gChanged) {
        if (P.H) { P.scene.remove(P.H.holder); P.H.dispose(); }
        P.H = kit.create(lookOf(S));
        P.H.holder.traverse(o => { o.frustumCulled = false; });
        P.scene.add(P.H.holder);
        P.H.play('idle', { fade: 0 });
      } else kit.applyLook(P.H, lookOf(S));
    }
  }
  closePicker() {
    const P = this.picker; if (!P) return;
    P.run = false; P.el.hidden = true; this.pickerOpen = false;
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
      <p>It isn’t optimised for phones yet, controls are basic and it may run slowly. If you have a laptop or desktop, open this link there.</p>
      <button class="btn primary" id="ph-ok">Play anyway</button></div>`);
    this.root.appendChild(n);
    n.querySelector('#ph-ok').onclick = () => n.remove();
  }

  // ---------------------------------------------------------------- pause
  pausePane(id) {
    this.pause.querySelectorAll('.side .nav').forEach(b => b.classList.toggle('on', b.dataset.pane === id));
    this.pause.querySelectorAll('.pane').forEach(q => q.classList.toggle('on', q.dataset.pane === id));
    this.pause.querySelector('.panes').scrollTop = 0;
  }
  buildPause() {
    const p = el('div', 'ov pause');
    p.hidden = true;
    p.innerHTML = `
      <div class="sheet two" role="dialog" aria-label="Paused">
        <nav class="side">
          <div class="who"><b id="p-who">Paused</b><small>NH48 · Pune <span lang="mr">पुणे</span></small></div>
          <button class="nav on" data-pane="home"><i style="--c:#ffb224"></i>Home</button>
          <button class="nav" data-pane="av"><i style="--c:#5e9eff"></i>Display and sound</button>
          <button class="nav" data-pane="game"><i style="--c:#30d17a"></i>Gameplay</button>
          <button class="nav" data-pane="ctrl"><i style="--c:#bf8cff"></i>Controls</button>
          <button class="nav" data-pane="ch"><i style="--c:#ff6159"></i>E-challans</button>
          <button class="nav" data-pane="me"><i style="--c:#a1a1aa"></i>Character and save</button>
        </nav>
        <div class="panes">
          <section class="pane on" data-pane="home">
            <h2>Paused</h2>
            <div class="hero-acts"><button class="btn primary big" id="p-resume">Resume</button><button class="btn big" id="p-map">Map</button><button class="btn big" id="p-guide">Guide</button></div>
            <div class="gt">Time of day</div>
            <div class="seg wide" id="p-time"><button data-h="8.5">Morning</button><button data-h="13">Noon</button><button data-h="17.85">Sunset</button><button data-h="21.5">Night</button></div>
            <div class="note">Esc or Resume puts you straight back in the game.</div>
          </section>
          <section class="pane" data-pane="av">
            <h2>Display and sound</h2>
            <div class="gt">Graphics</div>
            <div class="group"><div class="row"><div class="rl">Quality<small id="p-qnote"></small></div><div class="rc"><div class="seg" id="p-q"><button data-q="low">Low</button><button data-q="med">Medium</button><button data-q="high">High</button></div></div></div>
              <div class="row"><div class="rl">Sound</div><div class="rc"><input type="range" id="p-vol" min="0" max="1" step="0.05"></div></div></div>
            <div class="gt">Camera and voices</div>
            ${settingsHTML('av')}
          </section>
          <section class="pane" data-pane="game"><h2>Gameplay</h2>${settingsHTML('game')}</section>
          <section class="pane" data-pane="ctrl"><h2>Controls</h2>
            <div class="gt">Driving</div><div class="group"><div class="row"><div class="rl">Accelerate, brake, hold to reverse</div><div class="rc k"><span class="kbd">W</span><span class="kbd">S</span></div></div><div class="row"><div class="rl">Steer</div><div class="rc k"><span class="kbd">A</span><span class="kbd">D</span></div></div><div class="row"><div class="rl">Handbrake</div><div class="rc k"><span class="kbd">Space</span></div></div><div class="row"><div class="rl">Horn</div><div class="rc k"><span class="kbd">H</span></div></div><div class="row"><div class="rl">Change camera</div><div class="rc k"><span class="kbd">C</span></div></div><div class="row"><div class="rl">Look back</div><div class="rc k"><span class="kbd">B</span></div></div><div class="row"><div class="rl">Back on the road</div><div class="rc k"><span class="kbd">R</span></div></div><div class="row"><div class="rl">Get out</div><div class="rc k"><span class="kbd">F</span></div></div></div><div class="gt">On foot</div><div class="group"><div class="row"><div class="rl">Walk</div><div class="rc k"><span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span></div></div><div class="row"><div class="rl">Sprint</div><div class="rc k"><span class="kbd">Shift</span></div></div><div class="row"><div class="rl">Walk slowly</div><div class="rc k"><span class="kbd">Alt</span></div></div><div class="row"><div class="rl">Jump, or climb the wall you face</div><div class="rc k"><span class="kbd">Space</span></div></div><div class="row"><div class="rl">Roll</div><div class="rc k"><span class="kbd">C</span></div></div><div class="row"><div class="rl">Punch (keep clicking: jab, cross, hook)</div><div class="rc k"><span class="kbd">Click</span></div></div><div class="row"><div class="rl">Talk, walk in, get in or take a vehicle</div><div class="rc k"><span class="kbd">F</span></div></div><div class="row"><div class="rl">Pickpocket (risky)</div><div class="rc k"><span class="kbd">G</span></div></div></div><div class="gt">Anytime</div><div class="group"><div class="row"><div class="rl">Jhola: eat, drink, use what you carry</div><div class="rc k"><span class="kbd">E</span></div></div><div class="row"><div class="rl">Your status</div><div class="rc k"><span class="kbd">Tab</span></div></div><div class="row"><div class="rl">Map, waypoints, rickshaw, metro, bus</div><div class="rc k"><span class="kbd">M</span></div></div><div class="row"><div class="rl">Accept an offer on your phone</div><div class="rc k"><span class="kbd">Y</span></div></div><div class="row"><div class="rl">Answer the police</div><div class="rc k"><span class="kbd">1</span><span class="kbd">4</span></div></div><div class="row"><div class="rl">Camera distance</div><div class="rc k"><span class="kbd">V</span></div></div><div class="row"><div class="rl">Close any menu, or pause</div><div class="rc k"><span class="kbd">Esc</span></div></div><div class="row"><div class="rl">Performance stats</div><div class="rc k"><span class="kbd">F3</span></div></div></div>
          </section>
          <section class="pane" data-pane="ch" id="p-ch"><h2>E-challans</h2>
            <div class="group"><div class="row"><div class="rl"><b class="ch-amt num" id="p-ch-amt">₹0</b><small id="p-ch-note">Nothing pending</small></div><div class="rc"><button class="btn" id="p-ch-pay">Pay all</button></div></div></div>
            <ul class="ch-list" id="p-ch-list"></ul>
          </section>
          <section class="pane" data-pane="me"><h2>Character and save</h2>
            <div class="group">
              <div class="row"><div class="rl">Character<small>Your look, hair and name</small></div><div class="rc"><button class="btn" id="p-char">Change</button></div></div>
              <div class="row"><div class="rl">Title screen<small>Your game is saved</small></div><div class="rc"><button class="btn" id="p-title">Quit to title</button></div></div>
            </div>
            <div class="gt">Start over</div>
            <div class="group danger"><div class="row"><div class="rl">Wipe everything<small>Money back to ₹5,000; vehicles, outfits, property, fines, people and where you are</small></div><div class="rc"><button class="btn bad" id="p-reset">Start over</button></div></div>
              <div class="confirm" id="p-reset-c" hidden><b>Sure? This can’t be undone.</b><button class="btn bad" id="p-reset-y">Yes, wipe it</button><button class="btn" id="p-reset-n">Keep playing</button></div></div>
            <div class="fine">Map data © OpenStreetMap contributors (ODbL); buildings and places from Overture Maps Foundation (ODbL, CDLA-Permissive-2.0), including Google Open Buildings and Microsoft footprints. All business names are fictional parodies of real places. People and animals: Quaternius (CC0). Voices: Kokoro-82M (Apache-2.0) and Piper mr_IN, trained on Google’s crowdsourced Marathi speech (OpenSLR 64, CC BY-SA 4.0). Sounds: Freesound (CC0). Fines follow the MV Act as reported for Pune and may be out of date.</div>
          </section>
        </div>
      </div>`;
    p.querySelectorAll('.side .nav').forEach(b => b.onclick = () => this.pausePane(b.dataset.pane));
    this.root.appendChild(p);
    this.pause = p;
    p.addEventListener('click', (e) => { if (e.target === p) this.game.togglePause(false); });
    p.querySelector('#p-resume').onclick = () => { this.game.togglePause(false); this.game.lockMouse?.(); this.game.goFullscreen?.(); };
    p.querySelector('#p-guide').onclick = () => { this.game.togglePause(false); this.game.bag.show('guide'); this.game.lockMouse?.(); };
    p.querySelector('#p-map').onclick = () => { this.game.togglePause(false); this.game.toggleMap(true); };
    p.querySelector('#p-title').onclick = () => { this.game.endShift(); this.syncTitle(); };
    p.querySelector('#p-char').onclick = () => this.showPicker();
    p.querySelector('#p-reset').onclick = () => { p.querySelector('#p-reset-c').hidden = false; p.querySelector('#p-reset').hidden = true; };
    p.querySelector('#p-reset-n').onclick = () => { p.querySelector('#p-reset-c').hidden = true; p.querySelector('#p-reset').hidden = false; };
    p.querySelector('#p-reset-y').onclick = () => this.game.resetAll();
    p.querySelectorAll('#p-time button').forEach(b => b.onclick = () => { this.game.setHour(parseFloat(b.dataset.h)); this.syncPause(); });
    p.querySelectorAll('#p-q button').forEach(b => b.onclick = () => { this.game.setQuality(b.dataset.q); this.syncPause(); });
    p.querySelector('#p-ch-pay').onclick = () => { if (this.game.police) this.game.police.payDues(); this.syncPause(); };
    bindSettings(p, this.game);
    const vol = p.querySelector('#p-vol');
    vol.oninput = () => this.game.audio.setVolume(parseFloat(vol.value));
  }
  syncPause() {
    const pw = this.pause && this.pause.querySelector('#p-who'); if (pw) { const sv = savedCharacter(); pw.textContent = sv ? sv.name : 'Paused'; }
    const g = this.game;
    this.pause.querySelectorAll('#p-q button').forEach(b => b.classList.toggle('on', b.dataset.q === g.qualityName));
    this.pause.querySelector('#p-vol').value = g.audio.volume;
    syncSettings(this.pause, g);
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
    for (const e of [this.scrim, this.loc, this.wallet, this.obj, this.mm, this.dash, this.lower, this.toastWrap, this.smsWrap, this.nerd, this.vit]) e.hidden = !on;
    if (!on) { this.zoneEl.hidden = true; this.stopEl.hidden = true; }
    if (on) this.root.appendChild(this.corner); else this.corner.remove();
    this.title.hidden = on;
    this.$('h-sub').classList.remove('show');
    this.setMode();
  }
  setMode() { this.$('h-mode').textContent = this.game.rides && this.game.rides.enabled ? 'On shift' : 'Free roam'; }

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
    this.$('h-clock').textContent = clock(g.hour, g.settings && g.settings.clock24);
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
    // fuel and damage of whatever you're driving
    if (!foot && p.cur) {
      const v = p.cur, f = v.fuel ?? 1, fe = this.$('h-fuel');
      fe.querySelector('b').style.width = Math.round(f * 100) + '%';
      fe.classList.toggle('low', f < 0.15);
      const S = p.spec || {}, k = S.name === 'Bicycle' ? '' : (p.inAuto || v.type === 'taxi' || v.type === 'bus') ? 'CNG' : 'Petrol';
      if (this._fk !== k) { this._fk = k; this.$('h-fuel-k').textContent = k; fe.hidden = !k; }
      const dm = this.$('h-dmg'), dmg = v.dmg || 0;
      dm.hidden = dmg < 0.08; if (dmg >= 0.08) dm.textContent = `Body ${Math.round((1 - dmg) * 100)}%`;
    }
    // the vitals strip
    if (g.life && (this._vitT = (this._vitT || 0) - dt) <= 0) {
      this._vitT = 0.25;
      const L = g.life.s, vals = [(p.hp ?? 100) / g.life.hpMax, L.hunger, L.thirst, L.energy];
      this.vit.querySelectorAll(':scope > span').forEach((sp, i) => { const v = Math.max(0, Math.min(1, vals[i])); sp.querySelector('.fg').setAttribute('stroke-dashoffset', (this.vitC * (1 - v)).toFixed(1)); sp.classList.toggle('low', v < 0.2); sp.title = `${['Health', 'Hunger', 'Thirst', 'Energy'][i]} ${Math.round(v * 100)}%`; });
      this.vit.hidden = !!this.inPlace && false;
    }
    // health: on foot, while hurt or in a fight
    const hp = p.hp ?? 100, hpEl = this.$('h-hp');
    const hpMax = g.life ? g.life.hpMax : 100;
    const showHp = (p.onFoot || (p.spec && p.spec.two)) && (hp < hpMax - 0.5 || (g.brawl && g.brawl.active > 0));
    if (!hpEl.hidden) hpEl.hidden = true;
    if (false && showHp) { hpEl.firstElementChild.style.width = Math.round(hp / hpMax * 100) + '%'; hpEl.classList.toggle('low', hp < 30); }
    // area name (nearest suburb within ~900 m, else the district)
    this.areaT -= dt;
    if (this.areaT <= 0 && !this.inPlace) {
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
    const subs = this.game.settings ? this.game.settings.subs : 'both';
    if (subs === 'off') return;
    if (subs === 'line') tr = '';
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
  // inside a shop: the location card names the place; the minimap would only show empty fields
  enterPlace(ctx) {
    this.inPlace = true;
    this.$('h-street').textContent = ctx.name; this.$('h-street-mr').textContent = ctx.mr || '';
    this.$('h-area').textContent = 'Inside'; this.mm.hidden = true;
  }
  leavePlace() { this.inPlace = false; this.mm.hidden = false; this.areaT = 0; this.lastStreet = null; }
  setLockHint(on) {
    if (!this.lockEl) { this.lockEl = el('div', 'h lockhint', 'Click or press any key to take the camera · Esc for the menu'); this.root.appendChild(this.lockEl); }
    if (this.lockEl.hidden === on) this.lockEl.hidden = !on;
  }
  // low health: the screen edges go red and pulse with your heartbeat
  lowHealth(f) {
    if (!this.lowEl) { this.lowEl = el('div', 'lowhp'); this.root.appendChild(this.lowEl); }
    const k = Math.max(0, Math.min(1, (0.45 - f) / 0.4));
    if (Math.abs((this._lowK || 0) - k) > 0.02) { this._lowK = k; this.lowEl.style.opacity = k.toFixed(2); this.lowEl.classList.toggle('beat', k > 0.45); }
    if (k > 0.45 && (this._hbT = (this._hbT || 0) - 1 / 60) <= 0) { this._hbT = 0.85 - k * 0.25; this.game.audio.heartbeat?.(k); }
  }
  hurt() { const H = this.hurtEl; H.classList.remove('go'); void H.offsetWidth; H.classList.add('go'); }
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
    // canvas px per metre: zooms out with speed, and shows more once you've got your eyes sorted
    const sc = this.mmScale * k * (1 - Math.min(0.45, Math.abs(p.v) / 32)) * (g.life && g.life.s.glasses ? 0.78 : 1);
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
    const marks = [...(g.rides ? g.rides.markers() : []), ...(g.police ? g.police.markers() : []), ...(g.props ? g.props.markers() : [])];
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

