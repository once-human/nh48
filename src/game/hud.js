// HUD and menus (DOM): earnings, fare meter, speedo, minimap with route, passenger lines,
// street names, toasts, touch controls, title screen, pause menu, full map.
import { clamp, fmtRupees, isTouch } from '../core/util.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.root.innerHTML = '';
    this.root.appendChild(el('div', 'vignette'));
    this.build();
    this.toasts = [];
    this.lastStreet = null;
    this.minimapScale = 1.15;   // px per metre
  }

  build() {
    const R = this.root;
    // --- top-left earnings
    this.earn = el('div', 'hud card earn', `
      <div class="earn-row"><span class="rupee" id="h-money">₹0</span></div>
      <div class="earn-sub"><span id="h-rides">0 rides</span><span class="dot">·</span><span id="h-rating">★ –</span></div>`);
    // --- top-centre objective
    this.obj = el('div', 'hud objective', '<div class="obj-main" id="h-obj"></div><div class="obj-sub" id="h-obj-sub"></div>');
    // --- minimap
    this.mapWrap = el('div', 'hud minimap');
    this.mmCanvas = el('canvas'); this.mmCanvas.width = 220; this.mmCanvas.height = 220;
    this.mapWrap.appendChild(this.mmCanvas);
    this.mapWrap.appendChild(el('div', 'mm-n', 'N'));
    // --- buttons (camera, pause)
    this.btns = el('div', 'hud topbtns');
    this.camBtn = el('button', 'iconbtn', '<span aria-hidden="true">◐</span><span class="sr">Change camera</span>');
    this.camBtn.title = 'Change camera (C)';
    this.mapBtn = el('button', 'iconbtn', '<span aria-hidden="true">⌖</span><span class="sr">Open map</span>');
    this.mapBtn.title = 'Map (M)';
    this.pauseBtn = el('button', 'iconbtn', '<span aria-hidden="true">❚❚</span><span class="sr">Pause</span>');
    this.pauseBtn.title = 'Pause (Esc)';
    this.btns.append(this.camBtn, this.mapBtn, this.pauseBtn);
    this.camBtn.onclick = () => this.game.rig.setMode(this.game.rig.mode + 1);
    this.mapBtn.onclick = () => this.game.toggleMap();
    this.pauseBtn.onclick = () => this.game.togglePause();
    // --- meter + speedo
    this.meter = el('div', 'hud meterbox', `
      <div class="meter-flag" id="h-flag"><span>FOR HIRE</span></div>
      <div class="meter">
        <div class="meter-lbl"><span lang="mr">मीटर</span><span>FARE</span></div>
        <div class="led" id="h-fare">– – –</div>
        <div class="meter-row"><span class="led small" id="h-km">0.0</span><span class="unit">km</span><span class="led small" id="h-time">0:00</span></div>
      </div>
      <div class="speedo"><span class="spd" id="h-speed">0</span><span class="unit">km/h</span><span class="gear" id="h-gear">N</span></div>`);
    // --- dialogue + street
    this.street = el('div', 'hud street', '<div class="st-mr" id="h-st-mr"></div><div class="st-en" id="h-st-en"></div>');
    this.dialog = el('div', 'hud dialog', '<div class="dl-who" id="h-dl-who"></div><div class="dl-line" id="h-dl-line"></div><div class="dl-tr" id="h-dl-tr"></div>');
    this.toastWrap = el('div', 'hud toasts');
    this.lift = el('div', 'hud liftwarn', 'TWO WHEELS!');
    R.append(this.earn, this.obj, this.mapWrap, this.btns, this.meter, this.street, this.dialog, this.toastWrap, this.lift);
    this.$ = (id) => document.getElementById(id);
    // --- touch controls
    if (isTouch) this.buildTouch();
    // --- overlays
    this.buildTitle();
    this.buildPause();
    this.buildBigMap();
    this.setPlaying(false);
  }

  buildTouch() {
    const T = this.game.input.touch;
    const pad = el('div', 'touch');
    const mk = (cls, label, sr, onDown, onUp) => {
      const b = el('button', 'tbtn ' + cls, `<span aria-hidden="true">${label}</span><span class="sr">${sr}</span>`);
      const down = (e) => { e.preventDefault(); b.classList.add('on'); onDown(); this.game.audio.start(); };
      const up = (e) => { e.preventDefault(); b.classList.remove('on'); onUp(); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      return b;
    };
    const left = mk('t-left', '◀', 'Steer left', () => (T.left = 1), () => (T.left = 0));
    const right = mk('t-right', '▶', 'Steer right', () => (T.right = 1), () => (T.right = 0));
    const gas = mk('t-gas', 'GO', 'Accelerate', () => (T.gas = 1), () => (T.gas = 0));
    const brake = mk('t-brake', 'BRAKE', 'Brake or reverse', () => (T.brake = 1), () => (T.brake = 0));
    const horn = mk('t-horn', 'पीं', 'Horn', () => (T.horn = true), () => (T.horn = false));
    pad.append(left, right, horn, brake, gas);
    this.root.appendChild(pad);
    this.touchPad = pad;
  }

  buildTitle() {
    const t = el('div', 'overlay title');
    t.innerHTML = `
      <div class="title-inner">
        <div class="t-mark" lang="mr">मीटर डाउन</div>
        <div class="t-name">METER DOWN</div>
        <p class="t-tag">Drive a Pune auto through Deccan, FC Road and JM Road. Pick up passengers, go by meter, survive the traffic.</p>
        <div class="t-btns">
          <button class="btn primary" id="t-shift">Start shift</button>
          <button class="btn" id="t-roam">Free roam</button>
        </div>
        <div class="t-keys">${isTouch ? 'Steer with ◀ ▶, hold GO to drive, BRAKE to stop (hold to reverse). Tap पीं to honk.' :
          '<b>W / ↑</b> accelerate · <b>S / ↓</b> brake & reverse · <b>A D / ← →</b> steer · <b>Space</b> handbrake · <b>H</b> horn · <b>C</b> camera · <b>M</b> map · <b>R</b> back on road · <b>Esc</b> pause'}</div>
        <div class="t-fine">Map data © OpenStreetMap contributors (ODbL). All shop names are fictional.</div>
        <div class="rotate-hint">Turn your phone sideways for the best view.</div>
      </div>`;
    this.root.appendChild(t);
    this.title = t;
    t.querySelector('#t-shift').onclick = () => this.game.startPlay(true);
    t.querySelector('#t-roam').onclick = () => this.game.startPlay(false);
  }

  buildPause() {
    const p = el('div', 'overlay pause');
    p.hidden = true;
    p.innerHTML = `
      <div class="panel">
        <div class="p-head"><span class="p-title">Paused</span><span class="p-mr" lang="mr">थांबा</span></div>
        <div class="p-grid">
          <button class="btn primary" id="p-resume">Resume</button>
          <button class="btn" id="p-map">Map</button>
        </div>
        <div class="p-sec">
          <div class="p-lbl">Time of day</div>
          <div class="seg" id="p-time">
            <button data-h="8.5">Morning</button><button data-h="15.75">Afternoon</button><button data-h="17.85">Sunset</button><button data-h="21">Night</button>
          </div>
        </div>
        <div class="p-sec">
          <div class="p-lbl">Graphics</div>
          <div class="seg" id="p-q"><button data-q="low">Low</button><button data-q="med">Medium</button><button data-q="high">High</button></div>
          <div class="p-note" id="p-qnote"></div>
        </div>
        <div class="p-sec">
          <label class="p-lbl" for="p-vol">Sound</label>
          <input type="range" id="p-vol" min="0" max="1" step="0.05">
        </div>
        <div class="p-sec keys">${isTouch ? '' : '<b>W/↑</b> go · <b>S/↓</b> brake/reverse · <b>A/D</b> steer · <b>Space</b> handbrake · <b>H</b> horn · <b>C</b> camera · <b>B</b> look back · <b>R</b> back on road'}</div>
        <div class="p-grid">
          <button class="btn" id="p-title">End shift</button>
        </div>
        <div class="t-fine">Map data © OpenStreetMap contributors (ODbL)</div>
      </div>`;
    this.root.appendChild(p);
    this.pause = p;
    p.querySelector('#p-resume').onclick = () => this.game.togglePause(false);
    p.querySelector('#p-map').onclick = () => { this.game.togglePause(false); this.game.toggleMap(true); };
    p.querySelector('#p-title').onclick = () => this.game.endShift();
    p.querySelectorAll('#p-time button').forEach(b => b.onclick = () => { this.game.setHour(parseFloat(b.dataset.h)); this.syncPause(); });
    p.querySelectorAll('#p-q button').forEach(b => b.onclick = () => { this.game.setQuality(b.dataset.q); this.syncPause(); });
    const vol = p.querySelector('#p-vol');
    vol.oninput = () => this.game.audio.setVolume(parseFloat(vol.value));
  }
  syncPause() {
    const g = this.game;
    this.pause.querySelectorAll('#p-q button').forEach(b => b.classList.toggle('on', b.dataset.q === g.qualityName));
    this.pause.querySelector('#p-vol').value = g.audio.volume;
    this.pause.querySelector('#p-qnote').textContent = g.qualityNote || '';
    const h = g.hour;
    this.pause.querySelectorAll('#p-time button').forEach(b => b.classList.toggle('on', Math.abs(parseFloat(b.dataset.h) - h) < 1.2));
  }

  buildBigMap() {
    const m = el('div', 'overlay bigmap');
    m.hidden = true;
    m.innerHTML = '<div class="bm-head"><span>Deccan · FC Road · JM Road</span><button class="btn small" id="bm-close">Close</button></div>';
    this.bmCanvas = el('canvas', 'bm-canvas');
    m.appendChild(this.bmCanvas);
    this.root.appendChild(m);
    this.bigmap = m;
    m.querySelector('#bm-close').onclick = () => this.game.toggleMap(false);
  }

  setPlaying(on) {
    const show = (e, v) => { if (e) e.hidden = !v; };
    for (const e of [this.earn, this.obj, this.mapWrap, this.btns, this.meter, this.street, this.dialog, this.toastWrap, this.lift, this.touchPad]) show(e, on);
    this.title.hidden = on;
    this.dialog.classList.remove('show');
    this.street.classList.remove('show');
  }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    const g = this.game, p = g.player;
    const kmh = Math.abs(p.v) * 3.6;
    this.$('h-speed').textContent = Math.round(kmh);
    this.$('h-gear').textContent = p.reverse ? 'R' : p.v < 0.2 && p.throttle < 0.1 ? 'N' : String(p.gear);
    this.$('h-money').textContent = fmtRupees(g.stats.money);
    this.$('h-rides').textContent = g.stats.rides + (g.stats.rides === 1 ? ' ride' : ' rides');
    this.$('h-rating').textContent = g.stats.rides ? '★ ' + g.stats.rating.toFixed(1) : '★ –';
    const ride = g.rides && g.rides.current;
    const flag = this.$('h-flag');
    if (ride && ride.state === 'onboard') {
      this.$('h-fare').textContent = '₹' + Math.round(ride.fare);
      this.$('h-km').textContent = (ride.dist / 1000).toFixed(1);
      const t = Math.max(0, Math.floor(ride.elapsed));
      this.$('h-time').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
      flag.classList.add('down'); flag.firstElementChild.textContent = 'METER DOWN';
    } else {
      this.$('h-fare').textContent = '– – –';
      this.$('h-km').textContent = '0.0'; this.$('h-time').textContent = '0:00';
      flag.classList.remove('down'); flag.firstElementChild.textContent = g.rides && g.rides.enabled ? 'FOR HIRE' : 'FREE ROAM';
    }
    this.lift.classList.toggle('show', p.lift > 0.08 && !p.tipped);
    // objective
    const o = g.objective();
    this.$('h-obj').textContent = o.main;
    this.$('h-obj-sub').textContent = o.sub || '';
    this.obj.classList.toggle('urgent', !!o.urgent);
    // toasts
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.life -= dt;
      if (t.life < 0.35) t.el.classList.add('out');
      if (t.life <= 0) { t.el.remove(); this.toasts.splice(i, 1); }
    }
    if (this.dialogT > 0) { this.dialogT -= dt; if (this.dialogT <= 0) this.dialog.classList.remove('show'); }
    if (this.streetT > 0) { this.streetT -= dt; if (this.streetT <= 0) this.street.classList.remove('show'); }
    this.drawMinimap();
    if (!this.bigmap.hidden) this.drawBigMap();
  }

  toast(main, sub = '', kind = 'info', life = 2.6) {
    const t = el('div', 'toast ' + kind, `<div class="tt-main">${main}</div>${sub ? `<div class="tt-sub">${sub}</div>` : ''}`);
    this.toastWrap.appendChild(t);
    this.toasts.push({ el: t, life });
    while (this.toasts.length > 3) { const o = this.toasts.shift(); o.el.remove(); }
  }
  say(who, line, tr, life = 4.2) {
    this.$('h-dl-who').textContent = who;
    this.$('h-dl-line').textContent = line;
    this.$('h-dl-tr').textContent = tr || '';
    this.dialog.classList.add('show');
    this.dialogT = life;
  }
  showStreet(mr, en) {
    if (!en || en === this.lastStreet) return;
    this.lastStreet = en;
    this.$('h-st-mr').textContent = mr || '';
    this.$('h-st-en').textContent = en;
    this.street.classList.add('show');
    this.streetT = 3.5;
  }

  // ---------------------------------------------------------------- minimap
  drawMinimap() {
    const g = this.game, p = g.player, mm = g.minimap;
    if (!mm) return;
    const c = this.mmCanvas, x = c.getContext('2d');
    const S = c.width, r = S / 2;
    x.clearRect(0, 0, S, S);
    x.save();
    x.beginPath(); x.arc(r, r, r - 6, 0, Math.PI * 2); x.clip();
    x.fillStyle = '#1c1b18'; x.fillRect(0, 0, S, S);
    const sc = this.minimapScale * (1 - Math.min(0.35, Math.abs(p.v) / 40));
    const rot = -p.th - Math.PI / 2;     // forward points up
    x.translate(r, r + 18);
    x.rotate(rot);
    x.scale(sc / mm.ppm, sc / mm.ppm);
    x.translate(-(p.x - mm.x0) * mm.ppm, -(p.z - mm.z0) * mm.ppm);
    x.drawImage(mm.canvas, 0, 0);
    // route
    const route = g.rides && g.rides.routePts;
    if (route && route.length > 3) {
      x.strokeStyle = '#f3b808'; x.lineWidth = 7 * mm.ppm / sc * 0.55; x.lineJoin = 'round'; x.lineCap = 'round';
      x.beginPath();
      for (let k = 0; k < route.length; k += 2) {
        const X = (route[k] - mm.x0) * mm.ppm, Z = (route[k + 1] - mm.z0) * mm.ppm;
        k ? x.lineTo(X, Z) : x.moveTo(X, Z);
      }
      x.stroke();
    }
    // markers
    const marks = g.rides ? g.rides.markers() : [];
    for (const m of marks) {
      const X = (m.x - mm.x0) * mm.ppm, Z = (m.z - mm.z0) * mm.ppm;
      x.save(); x.translate(X, Z); x.rotate(-rot); x.scale(mm.ppm / sc, mm.ppm / sc);
      if (m.kind === 'pax') {
        x.fillStyle = '#3ddc84'; x.strokeStyle = '#0f0e0c'; x.lineWidth = 2;
        x.beginPath(); x.arc(0, 0, 7, 0, Math.PI * 2); x.fill(); x.stroke();
        x.fillStyle = '#0f0e0c'; x.font = '700 10px "Baloo 2"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('₹', 0, 1);
      } else {
        x.fillStyle = '#ff3d24'; x.strokeStyle = '#fff'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(0, -12); x.lineTo(8, 2); x.lineTo(-8, 2); x.closePath(); x.fill(); x.stroke();
      }
      x.restore();
    }
    x.restore();
    // edge arrows for off-map markers
    for (const m of marks) {
      const dx = m.x - p.x, dz = m.z - p.z;
      const d = Math.hypot(dx, dz);
      const px = (dx * Math.cos(rot) - dz * Math.sin(rot)) * sc, pz = (dx * Math.sin(rot) + dz * Math.cos(rot)) * sc + 18;
      if (Math.hypot(px, pz) < r - 14) continue;
      const a = Math.atan2(pz, px);
      x.fillStyle = m.kind === 'pax' ? '#3ddc84' : '#ff3d24';
      x.save(); x.translate(r + Math.cos(a) * (r - 14), r + Math.sin(a) * (r - 14)); x.rotate(a);
      x.beginPath(); x.moveTo(8, 0); x.lineTo(-5, -6); x.lineTo(-5, 6); x.closePath(); x.fill();
      x.restore();
      void d;
    }
    // player arrow
    x.save(); x.translate(r, r + 18);
    x.fillStyle = '#f3b808'; x.strokeStyle = '#0f0e0c'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -10); x.lineTo(7, 7); x.lineTo(0, 3); x.lineTo(-7, 7); x.closePath(); x.fill(); x.stroke();
    x.restore();
    // north marker position on the ring
    const n = this.mapWrap.querySelector('.mm-n');
    const na = rot - Math.PI / 2;
    n.style.transform = `translate(${Math.cos(na) * (r - 8)}px, ${Math.sin(na) * (r - 8)}px)`;
  }

  drawBigMap() {
    const g = this.game, mm = g.minimap, c = this.bmCanvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#16150f'; x.fillRect(0, 0, w, h);
    const sc = Math.min(w / mm.canvas.width, h / mm.canvas.height);
    const ox = (w - mm.canvas.width * sc) / 2, oy = (h - mm.canvas.height * sc) / 2;
    x.drawImage(mm.canvas, ox, oy, mm.canvas.width * sc, mm.canvas.height * sc);
    const T = (X, Z) => [ox + (X - mm.x0) * mm.ppm * sc, oy + (Z - mm.z0) * mm.ppm * sc];
    // play area frame
    const pl = g.W.play;
    const [a0, b0] = T(pl.x0, pl.z0), [a1, b1] = T(pl.x1, pl.z1);
    x.strokeStyle = 'rgba(243,184,8,0.5)'; x.setLineDash([6, 6]); x.lineWidth = 1.5; x.strokeRect(a0, b0, a1 - a0, b1 - b0); x.setLineDash([]);
    // labels
    x.font = '600 12px "Baloo 2"'; x.textAlign = 'center';
    for (const l of mm.labels) {
      const [X, Y] = T(l.x, l.z);
      x.fillStyle = 'rgba(15,14,12,0.7)'; const tw = x.measureText(l.t).width + 8; x.fillRect(X - tw / 2, Y - 9, tw, 15);
      x.fillStyle = '#f4ecd9'; x.fillText(l.t, X, Y + 3);
    }
    const route = g.rides && g.rides.routePts;
    if (route && route.length > 3) {
      x.strokeStyle = '#f3b808'; x.lineWidth = 3.5; x.beginPath();
      for (let k = 0; k < route.length; k += 2) { const [X, Y] = T(route[k], route[k + 1]); k ? x.lineTo(X, Y) : x.moveTo(X, Y); }
      x.stroke();
    }
    for (const m of (g.rides ? g.rides.markers() : [])) {
      const [X, Y] = T(m.x, m.z);
      x.fillStyle = m.kind === 'pax' ? '#3ddc84' : '#ff3d24';
      x.beginPath(); x.arc(X, Y, 6, 0, Math.PI * 2); x.fill();
    }
    const p = g.player;
    const [PX, PY] = T(p.x, p.z);
    x.save(); x.translate(PX, PY); x.rotate(p.th + Math.PI / 2);
    x.fillStyle = '#f3b808'; x.strokeStyle = '#000'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -11); x.lineTo(8, 8); x.lineTo(0, 4); x.lineTo(-8, 8); x.closePath(); x.fill(); x.stroke();
    x.restore();
  }
}

// pre-rendered map image used by the minimap and the full map
export function buildMinimap(W) {
  const M = W.M;
  const vis = M.meta.vis.map(v => v / 100);
  const ppm = 0.6;
  const w = Math.ceil((vis[2] - vis[0]) * ppm), h = Math.ceil((vis[3] - vis[1]) * ppm);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const T = (X, Z) => [(X - vis[0]) * ppm, (Z - vis[1]) * ppm];
  x.fillStyle = '#2b2924'; x.fillRect(0, 0, w, h);
  const poly = (rings, fill) => {
    x.beginPath();
    for (const r of rings) {
      for (let k = 0; k < r.length; k += 2) { const [X, Y] = T(r[k] / 100, r[k + 1] / 100); k ? x.lineTo(X, Y) : x.moveTo(X, Y); }
      x.closePath();
    }
    x.fillStyle = fill; x.fill('evenodd');
  };
  const col = { grass: '#33452b', soil: '#5a3a2a', scrub: '#3a4230', plaza: '#3a3936', compound: '#2f2d28', median: '#3b4a2f', pavers: '#45413a' };
  for (const [kind, polys] of M.ground) if (col[kind]) for (const [ci, rings] of polys) poly(rings, col[kind]);
  for (const [ci, rings] of M.water) poly(rings, '#24485c');
  for (const b of M.buildings) poly([b[1]], b[8] ? '#5c5144' : '#504a40');
  for (const [kind, polys] of M.ground) if (kind === 'asphalt' || kind === 'concrete' || kind === 'bridge_road') for (const [ci, rings] of polys) poly(rings, kind === 'asphalt' ? '#c9c2b2' : '#9e978a');
  // labels: main road names + a few landmarks
  const labels = [];
  const seen = new Set();
  for (const e of W.graph.edges) {
    const nm = W.graph.names[e.name];
    if (!nm || !nm[0] || e.rank < 4 || e.len < 80 || seen.has(nm[0])) continue;
    seen.add(nm[0]);
    const t = W.graph.at(e, e.len / 2);
    labels.push({ t: nm[0], x: t[0], z: t[1] });
  }
  for (const p of M.pois) if (/College|Gymkhana|Rangmandir|Station|Talav|Garden|Udyan|Park/.test(p[0]) && labels.length < 40) labels.push({ t: p[0], x: p[2] / 100, z: p[3] / 100 });
  return { canvas: c, ppm, x0: vis[0], z0: vis[1], labels };
}
