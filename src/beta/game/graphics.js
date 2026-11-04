// /beta's graphics settings and its Auto. The whole picture takes Auto, Light, Low, Medium, High, Very High or Ultra; each
// setting takes Auto or any of six real values.
// Auto starts from what the PC is, and while you play, when frames drop, it works out whether the graphics card or the
// processor is holding things up and takes one step off the setting that's costing the most there, checks that it
// helped (puts it back and tries the next one if it didn't), and gives steps back when there's room. MSAA is the
// exception: Auto sets it from how powerful the PC is, and frame drops never touch it.
const NAMES = ['Light', 'Low', 'Medium', 'High', 'Very High', 'Ultra'];
const pct = (v) => Math.round(v*100) + '%';
const onOff = (v, f) => (v ? f(v) : 'Off');
const M = (v) => v + ' m';
const look = (G) => G.gfx ? G.gfx.C.post : null;
const fx = (C, o) => { Object.assign(C.post.fx, o); };
// A setting: six levels, what it costs (w: how heavy, side: what it loads) and what it does. `style` ones are the look
// itself: Auto picks them once, from the PC, and never changes how the picture is painted while you play.
export const SETTINGS = [
  { group: 'Image' },
  { id: 'res', label: 'Render scale', sub: 'Pixels drawn, against your screen', side: 'gpu', w: 3, val: [.6, .75, 1, 1.25, 1.5, 2], fmt: pct, apply: (G, v) => { G.perf.pr = v; G.applyPixelRatio(v); } },
  { id: 'msaa', label: 'Anti-aliasing', sub: 'MSAA. Auto goes by your PC, not your frame rate', fixed: true, val: [0, 0, 2, 4, 8, 16], fmt: (v) => (v ? 'MSAA ' + v + 'x' : 'Off'), apply: (G, v, C) => { const m = Math.min(v, G.renderer.capabilities.maxSamples); if (C.post.q.samples !== m) { C.post.q.samples = m; C.post.setSize(window.innerWidth, window.innerHeight); } } },
  { id: 'aniso', label: 'Texture filtering', sub: 'Anisotropic, for surfaces at a low angle', side: 'gpu', w: 1, val: [1, 2, 4, 8, 16, 16], fmt: (v) => (v > 1 ? v + 'x AF' : 'Trilinear'), apply: (G, v) => G.setAniso(v) },
  { group: 'Look' },
  { id: 'shade', label: 'Lighting model', sub: 'From two painted tones to physically based light', style: true, val: [[0, 0], [0, 1], [.22, 1], [.5, 1], [.8, 1], [1, 1]], fmt: (v) => (!v[1] ? 'Flat cel' : ['Two-tone', 'Soft paint', 'Paint + PBR', 'PBR', 'Full PBR'][[0, .22, .5, .8, 1].indexOf(v[0])]), apply: (G, v, C) => { C.PU.uReal.value = v[0]; C.PU.uMarks.value = v[1]; } },
  { id: 'ink', label: 'Ink lines', sub: 'Depth and colour edges, drawn over the frame', style: true, val: [[0, 1], [1, 1], [2, .85], [2, .5], [1, .22], [0, 0]], fmt: (v) => (v[1] === 0 ? 'Off' : ['1 pass', '2 passes', '3 passes'][v[0]] + ' · ' + pct(v[1])), apply: (G, v, C) => { C.post.U.inkQ.value = v[0]; C.post.U.inkS.value = v[1]; } },
  { id: 'paper', label: 'Paper finish', sub: 'Grain, specks, brush strokes and the torn edge', style: true, val: [1, 1, 1, .55, .2, 0], fmt: (v) => onOff(v, pct), apply: (G, v, C) => { C.post.U.paper.value = v; } },
  { id: 'grade', label: 'Tone mapping', sub: 'From poster colour to a film curve', style: true, val: [0, 0, .12, .45, .8, 1], fmt: (v) => (v === 0 ? 'Poster' : v === 1 ? 'ACES filmic' : 'Filmic ' + pct(v)), apply: (G, v, C) => { C.post.U.film.value = v; } },
  { id: 'aerial', label: 'Aerial perspective', sub: 'The air between you and what is far off', side: 'gpu', w: .5, val: [0, 0, .35, .7, 1, 1.25], fmt: (v) => onOff(v, pct), apply: (G, v, C) => { C.post.U.aerial.value = v; } },
  { group: 'Shadows' },
  { id: 'shadows', label: 'Shadow map', sub: 'Resolution', side: 'gpu', w: 4, val: [0, 1024, 2048, 3072, 4096, 8192], fmt: (v) => (v ? v + ' px' : 'Off'), apply: (G, v) => { const m = Math.min(v, G.renderer.capabilities.maxTextureSize); G.swapShadows(m > 0, m || 1024); } },
  { id: 'sfilter', label: 'Shadow filter', sub: 'PCF taps, and how soft the edge is', side: 'gpu', w: 2, val: [[2, 1], [2, 1], [4, 1.4], [8, 2], [16, 3], [32, 4.5]], fmt: (v) => v[0] + '-tap PCF', apply: (G, v, C) => { C.PU.uTaps.value = v[0]; C.PU.uSoft.value = v[1]; } },
  { id: 'sdist', label: 'Shadow distance', sub: 'How far from you things cast one', side: 'gpu', w: 2, val: [70, 95, 95, 130, 180, 260], fmt: M, apply: (G, v, C) => { if (C.post.shadows) C.post.shadows.reach(v); } },
  { group: 'Post-processing' },
  { id: 'ao', label: 'Ambient occlusion', sub: 'SSAO samples, at this share of the resolution', side: 'gpu', w: 3, val: [[0, .5], [0, .5], [8, .5], [16, .5], [32, .75], [64, 1]], fmt: (v) => (v[0] ? v[0] + ' spp · ' + pct(v[1]) : 'Off'), apply: (G, v, C) => fx(C, { ao: v[0], aoScale: v[1] }) },
  { id: 'gi', label: 'Bounce light', sub: 'SSGI rays per pixel: sunlit walls lighting what is near', side: 'gpu', w: 3, val: [0, 0, 0, 0, 8, 16], fmt: (v) => onOff(v, x => x + ' rays'), apply: (G, v, C) => fx(C, { rays: v }) },
  { id: 'ssr', label: 'Reflections', sub: 'Screen-space ray steps, on glass, paint and wet road', side: 'gpu', w: 3, val: [[0, .5], [0, .5], [0, .5], [16, .5], [32, .5], [64, 1]], fmt: (v) => (v[0] ? v[0] + ' steps · ' + pct(v[1]) : 'Off'), apply: (G, v, C) => fx(C, { ssr: v[0], ssrScale: v[1] }) },
  { id: 'bloom', label: 'Bloom', sub: 'Blur chain length', side: 'gpu', w: 1, val: [0, 0, 3, 4, 5, 6], fmt: (v) => onOff(v, x => x + ' mips'), apply: (G, v, C) => fx(C, { bloom: v }) },
  { id: 'shafts', label: 'Sun shafts', sub: 'Radial samples', side: 'gpu', w: 1, val: [0, 0, 0, 32, 64, 128], fmt: (v) => onOff(v, x => x + ' samples'), apply: (G, v, C) => fx(C, { shafts: v }) },
  { id: 'dof', label: 'Depth of field', sub: 'Bokeh samples, for what is far behind you', side: 'gpu', w: 1, val: [0, 0, 0, 0, 8, 24], fmt: (v) => onOff(v, x => x + ' samples'), apply: (G, v, C) => fx(C, { dof: v }) },
  { id: 'mb', label: 'Motion blur', sub: 'Samples, from the camera moving', side: 'gpu', w: 1, val: [0, 0, 0, 0, 6, 16], fmt: (v) => onOff(v, x => x + ' samples'), apply: (G, v, C) => fx(C, { mb: v }) },
  { group: 'World' },
  { id: 'dist', label: 'View distance', sub: 'How much of the city is built around you', side: 'both', w: 2, val: [260, 360, 520, 720, 1000, 1400], fmt: M, apply: (G, v) => G.W.streamer.setRadius(v) },
  { id: 'geo', label: 'World geometry', sub: 'Walls, kerbs and roads close up. Applies to what gets built as you move', fixed: true, val: [0, 0, 1, 1, 2, 2], fmt: (v) => ['Standard', 'Structured', 'Every window and stone'][v], apply: (G, v) => { if (G.W && G.W.painter) { G.W.painter.rich = v; G.W.painter.geoAt = (G.W.painter.geoAt || 0) + 1; } } },
  { id: 'sdetail', label: 'Stall detail', sub: 'How far stalls get their full models', side: 'gpu', w: 2, val: [20, 35, 60, 90, 140, 220], fmt: M, apply: (G, v) => { if (G.W && G.W.stallNear) G.W.stallNear(v); } },
  { id: 'vdist', label: 'Vehicle detail', sub: 'How far the full models go', side: 'gpu', w: 3, val: [15, 30, 50, 80, 120, 200], fmt: M, apply: (G, v) => G.setVehicleDetail(v) },
  { id: 'trees', label: 'Trees', sub: 'Full trees to, then any trees to', side: 'gpu', w: 3, val: [[14, 60, 300], [26, 100, 450], [50, 180, 700], [90, 320, 1100], [130, 480, 1500], [200, 700, 2000]], fmt: (v) => v[1] + ' m / ' + v[2] + ' m', apply: (G, v) => { const T = G.W.trees; if (T) { T.nearR = v[0]; T.midR = v[1]; T.R = v[2]; T.lastX = 1e9; } } },
  { id: 'grass', label: 'Grass', sub: 'How far it is drawn', side: 'gpu', w: 2, val: [0, .35, .7, 1, 1.4, 2], fmt: (v) => (v ? Math.round(v*64) + ' m' : 'Off'), apply: (G, v) => { if (G.W.grass) G.W.grass.level = v; } },
  { id: 'bodies', label: 'Skinned bodies', sub: 'How many, and how close the 50k-triangle ones are', side: 'both', w: 3, val: [[16, 0], [32, 6], [64, 12], [96, 22], [96, 40], [96, 70]], fmt: (v) => v[0] + ' · ' + v[1] + ' m', apply: (G, v) => { if (G.skin) { G.skin.max = v[0]; G.skin.hiR = v[1]; } } },
  { id: 'people', label: 'Pedestrians', sub: 'On the streets', side: 'cpu', w: 3, val: [60, 90, 130, 170, 220, 280], fmt: (v) => String(v), apply: (G, v) => { if (G.people) G.people.max = Math.min(v, G.people.cap - 120); } },
  { id: 'traffic', label: 'Traffic', sub: 'Vehicles on the roads', side: 'cpu', w: 3, val: [40, 70, 100, 130, 170, 220], fmt: (v) => String(v), apply: (G, v) => { if (G.traffic) G.traffic.max = v; } },
];
const ALL = SETTINGS.filter(s => s.id);
const TOP = 5, AUTO_TOP = 4;                              // (Auto stops at Very High: Ultra is yours to ask for)
const CAPS = [30, 60, 90, 120, 144, 165, 240, 0], COUNTERS = ['Off', 'FPS', 'FPS and frame time', 'Full'];
const KEY = 'nh48_beta_gfx2';
const BASE = { discrete: 3, integrated: 2, weak: 1, soft: 0 };

export class Graphics {
  constructor(G, C) {
    this.G = G; this.C = C; this.base = BASE[C.gpu] ?? 2;
    this.auto = {}; for (const s of ALL) this.auto[s.id] = this.base;
    this.auto.msaa = C.gpu === 'discrete' ? 3 : 0;       // set once, from the hardware
    this.preset = 'auto'; this.pin = {}; this.cap = 144; this.counter = 0;
    try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); if (j.preset !== undefined) this.preset = j.preset; if (j.pin) this.pin = j.pin; if (j.cap !== undefined) this.cap = j.cap; if (j.counter !== undefined) this.counter = j.counter; } catch (e) { /* no storage: defaults */ }
    G.fpsCap = this.cap; this.fN = 0; this.fT = 0; this.fW = 0;
    this.acc = 0; this.n = 0; this.cpu = 0; this.low = 0; this.high = 0; this.wait = 8; this.blocked = {}; this.trial = null; this.was = {};
    G.afterRender = () => {};                            // (the game's own adaptive resolution: this replaces it)
    G.gfxTick = (dt, cpu) => this.tick(dt, cpu);
    this.applyAll();
  }
  level(id) { const p = this.pin[id]; if (p !== undefined) return p; if (this.preset !== 'auto') return this.preset; return this.auto[id]; }
  applyOne(s) { const v = s.val[this.level(s.id)]; if (this.was[s.id] === v) return; this.was[s.id] = v; try { s.apply(this.G, v, this.C); } catch (e) { console.warn('graphics', s.id, e); } }
  applyAll() { for (const s of ALL) this.applyOne(s); const l = this.preset === 'auto' ? this.base : this.preset; this.G.qualityName = ['lite', 'low', 'med', 'high', 'high', 'high'][l]; this.sync(); }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ preset: this.preset, pin: this.pin, cap: this.cap, counter: this.counter })); } catch (e) { /* private window */ } }
  choose(id, v) {
    if (id === 'cap') { this.cap = this.G.fpsCap = +v; this.save(); this.sync(); return; }
    if (id === 'counter') { this.counter = +v; this.save(); this.sync(); return; }
    if (id === 'all') { this.preset = v === 'auto' ? 'auto' : +v; this.pin = {}; }
    else if (v === 'auto') delete this.pin[id]; else this.pin[id] = +v;
    this.trial = null; this.wait = 6; this.low = this.high = 0; this.save(); this.applyAll();
  }
  free(s, now) { return !s.fixed && !s.style && this.pin[s.id] === undefined && !(this.blocked[s.id] > now); }
  // a two-second look at how it's going
  tick(dt, cpuMs) {
    const G = this.G;
    this.counterTick(dt, cpuMs);
    if (G.state !== 'play' || dt > .5 || this.preset !== 'auto') return;
    this.acc += dt; this.n++; this.cpu += cpuMs;
    if (this.acc < 2) return;
    const fps = this.n/this.acc, cpu = this.cpu/this.n, share = cpu/(1000/fps), now = performance.now();
    this.acc = 0; this.n = 0; this.cpu = 0;
    this.wait -= 2; if (this.wait > 0) return;
    const T = this.trial;
    if (T && --T.left <= 0) {
      this.trial = null;
      if (T.dir < 0 && fps < T.fps*1.05 && fps < 50) { this.auto[T.s.id]++; this.blocked[T.s.id] = now + 120000; this.applyOne(T.s); this.wait = 4; this.sync(); return; }     // didn't help: it wasn't this
      if (T.dir > 0 && fps < 52) { this.auto[T.s.id]--; this.blocked[T.s.id] = now + 180000; this.applyOne(T.s); this.wait = 4; this.sync(); return; }                        // too much: back, and leave it a while
    }
    this.low = fps < 48 ? this.low + 1 : 0;
    this.high = fps >= 58 ? this.high + 1 : 0;
    if (this.low >= 2) {
      const side = share > .6 ? 'cpu' : 'gpu', score = (s) => s.w*this.auto[s.id];
      const pick = (f) => ALL.filter(s => this.free(s, now) && this.auto[s.id] > 0 && f(s)).sort((a, b) => score(b) - score(a))[0];
      const s = pick(q => q.side === side || q.side === 'both') || pick(() => true);
      this.low = 0; if (!s) return;
      this.auto[s.id]--; this.applyOne(s); this.trial = { s, fps, dir: -1, left: 2 }; this.wait = 4; this.sync();
    } else if (this.high >= 10) {
      this.high = 0;
      const s = ALL.filter(q => this.free(q, now) && this.auto[q.id] < AUTO_TOP && !(q.side === 'cpu' && share > .5)).sort((a, b) => a.w*this.auto[a.id] - b.w*this.auto[b.id])[0];
      if (!s) return;
      this.auto[s.id]++; this.applyOne(s); this.trial = { s, fps, dir: 1, left: 3 }; this.wait = 4; this.sync();
    }
  }
  sync() {
    const r = this.root; if (!r) return;
    const on = (el, v) => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
    on(r.querySelector('[data-g="all"]'), this.preset);
    for (const s of ALL) {
      on(r.querySelector(`[data-g="${s.id}"]`), this.pin[s.id] ?? 'auto');
      r.querySelector(`[data-now="${s.id}"]`).textContent = s.sub + ' · now ' + s.fmt(s.val[this.level(s.id)]);
    }
    on(r.querySelector('[data-g="cap"]'), this.cap); on(r.querySelector('[data-g="counter"]'), this.counter);
  }
  // the frame counter, in a corner. Runs whatever the preset
  counterTick(dt, cpu) {
    if (!this.counter) { if (this.fpsEl) this.fpsEl.hidden = true; return; }
    if (!this.fpsEl) { const e = this.fpsEl = document.createElement('div'); e.id = 'fps-counter'; document.body.appendChild(e); }
    this.fpsEl.hidden = false; this.fN++; this.fT += dt; this.fW = Math.max(this.fW, dt); this.fC = (this.fC || 0) + cpu;
    if (this.fT < .5) return;
    const R = this.G.renderer, i = R.info, fps = this.fN/this.fT, ms = this.fT/this.fN*1000, l = [`${fps.toFixed(0)} FPS`];
    if (this.counter >= 2) l.push(`${ms.toFixed(1)} ms · worst ${(this.fW*1000).toFixed(0)} ms`);
    if (this.counter >= 3) { const v = R.getDrawingBufferSize(this._v || (this._v = new (this.C.Vector2)())); l.push(`CPU ${(this.fC/this.fN).toFixed(1)} ms · ${v.x}x${v.y}`, `${i.render.calls} draws · ${(i.render.triangles/1e6).toFixed(2)}M tris`, this.preset === 'auto' ? 'Auto' : NAMES[this.preset]); }
    this.fpsEl.textContent = l.join('\n'); this.fN = 0; this.fT = 0; this.fW = 0; this.fC = 0;
  }
  // the Settings page: sections of its own (Graphics, Audio, Game), the same rows the rest of the menu uses
  install() {
    const pane = document.querySelector('section.pane[data-pane="set"]'); if (!pane) return;
    const seg = (id, names) => `<div class="seg" data-g="${id}"><button data-v="auto">Auto</button>${names.map((n, i) => `<button data-v="${i}">${n}</button>`).join('')}</div>`;
    const list = (id, pairs) => `<div class="seg" data-g="${id}">${pairs.map(([v, n]) => `<button data-v="${v}">${n}</button>`).join('')}</div>`;
    const row = (l, sub, c, nowId) => `<div class="row g-row"><div class="rl">${l}<small ${nowId ? `data-now="${nowId}"` : ''}>${sub}</small></div><div class="rc">${c}</div></div>`;
    const g = document.createElement('div'); g.className = 'group settings-gfx';
    g.innerHTML = row('Graphics', 'The whole picture. Auto fits it to your PC as you play, up to Very High', seg('all', NAMES)) +
      '<div class="g-head">Display</div>' +
      row('Frame rate limit', 'Your screen\'s refresh rate is the most any browser will show', list('cap', CAPS.map(v => [v, v ? v + ' FPS' : 'No limit']))) +
      row('Frame counter', 'In the corner of the screen', list('counter', COUNTERS.map((n, i) => [i, n]))) +
      SETTINGS.map(s => s.group ? `<div class="g-head">${s.group}</div>` : row(s.label, s.sub, seg(s.id, s.val.map(s.fmt)), s.id)).join('');
    this.root = g;
    g.querySelectorAll('.seg').forEach(el => el.querySelectorAll('button').forEach(b => { b.onclick = () => this.choose(el.dataset.g, b.dataset.v); }));
    const chev = (r) => `<svg viewBox="0 0 24 24"><path d="${r ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    g.querySelectorAll('.seg').forEach(sg => {   // the menu's arrows, as on every other row
      const step = (d) => { const bs = [...sg.querySelectorAll('button')], k = bs.findIndex(b => b.classList.contains('on')); bs[(Math.max(0, k) + d + bs.length)%bs.length].click(); };
      const L = document.createElement('i'), R = document.createElement('i'); L.className = 'pz-arr l'; R.className = 'pz-arr r'; L.innerHTML = chev(0); R.innerHTML = chev(1);
      L.onclick = () => step(-1); R.onclick = () => step(1); sg.prepend(L); sg.append(R); sg._step = step;
      sg.closest('.row').addEventListener('click', (e) => { if (e.target === sg.closest('.row') || e.target.closest('.rl')) step(1); });
    });
    const q = pane.querySelector('#p-q'); if (q) q.closest('.group').style.display = 'none';
    // file what's there under the sections
    const sec = { graphics: [g], audio: [], game: [] }, map = { World: 'game', Picture: 'graphics', Sound: 'audio', Game: 'game', Version: 'game' }; let cur = null;
    for (const e of [...pane.children]) { if (e.tagName === 'H2') continue; if (e.classList.contains('gt')) { cur = map[e.textContent.trim()] || 'game'; if (cur === 'graphics' || cur === 'audio') { e.remove(); continue; } } if (cur && e !== g) sec[cur].push(e); }
    const tabs = document.createElement('div'); tabs.className = 'seg g-tabs'; tabs.innerHTML = '<button data-t="graphics">Graphics</button><button data-t="audio">Audio</button><button data-t="game">Game</button>';
    pane.querySelector('h2').after(tabs);
    const box = {}; for (const k in sec) { box[k] = document.createElement('div'); box[k].className = 'g-sec'; for (const e of sec[k]) box[k].appendChild(e); pane.appendChild(box[k]); }
    const show = (t) => { for (const k in box) box[k].hidden = k !== t; tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); };
    tabs.querySelectorAll('button').forEach(b => { b.onclick = () => show(b.dataset.t); });
    tabs._step = (d) => { const o = ['graphics', 'audio', 'game'], k = o.indexOf(tabs.querySelector('.on').dataset.t); show(o[(k + d + 3)%3]); };
    show('graphics'); this.sync();
  }
}
