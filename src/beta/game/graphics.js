// /beta's graphics settings and its Auto. Every setting takes Auto, Lite, Low, Medium or High; so does the whole picture.
// Auto starts from what the PC is, and while you play, when frames drop, it works out whether the graphics card or the
// processor is holding things up and takes one step off the setting that's costing the most there, checks that it
// helped (puts it back and tries the next one if it didn't), and gives steps back when there's room. MSAA is the
// exception: Auto sets it from how powerful the PC is, and frame drops never touch it.
const NAMES = ['Lite', 'Low', 'Medium', 'High'];
const pct = (v) => Math.round(v*100) + '%';
export const SETTINGS = [
  { id: 'res', label: 'Resolution', sub: 'Of your screen', side: 'gpu', w: 3, val: [.6, .75, 1, 1.5], fmt: pct, apply: (G, v) => { G.perf.pr = v; G.applyPixelRatio(v); } },
  { id: 'msaa', label: 'Edge smoothing (MSAA)', sub: 'Auto goes by your PC, not your frame rate', fixed: true, val: [0, 0, 2, 4], fmt: (v) => (v ? v + 'x' : 'Off'), apply: (G, v, C) => { if (C.post.q.samples !== v) { C.post.q.samples = v; C.post.setSize(window.innerWidth, window.innerHeight); } } },
  { id: 'shadows', label: 'Shadows', sub: 'Their sharpness', side: 'gpu', w: 4, val: [0, 1024, 1536, 2048], fmt: (v) => (v ? v + ' px' : 'Off'), apply: (G, v) => G.swapShadows(v > 0, v || 1024) },
  { id: 'ink', label: 'Ink lines', sub: 'How much of the sketch is drawn', side: 'gpu', w: 1, val: [0, 1, 2, 3], fmt: (v) => ['Outlines', 'And colour edges', 'Drawn twice', 'Drawn twice, further'][v], apply: (G, v, C) => { C.post.U.inkQ.value = v; } },
  { id: 'trees', label: 'Trees', sub: 'How far the full trees and then any trees go', side: 'gpu', w: 3, val: [[14, 60, 300], [26, 100, 450], [50, 180, 700], [90, 320, 1100]], fmt: (v) => v[1] + ' m, then ' + v[2] + ' m', apply: (G, v) => { const T = G.W.trees; if (T) { T.nearR = v[0]; T.midR = v[1]; T.R = v[2]; T.lastX = 1e9; } } },
  { id: 'grass', label: 'Grass', sub: 'How much of it', side: 'gpu', w: 2, val: [0, .35, .7, 1], fmt: (v) => (v ? pct(v) : 'Off'), apply: (G, v) => { if (G.W.grass) G.W.grass.level = v; } },
  { id: 'dist', label: 'View distance', sub: 'How much of the city is built around you', side: 'both', w: 2, val: [260, 360, 520, 720], fmt: (v) => v + ' m', apply: (G, v) => G.W.streamer.setRadius(v) },
  { id: 'bodies', label: 'Detailed people', sub: 'How many have full bodies, and how close the finest ones are', side: 'both', w: 3, val: [[16, 0], [32, 6], [64, 12], [96, 22]], fmt: (v) => v[0] + ', finest to ' + v[1] + ' m', apply: (G, v) => { if (G.skin) { G.skin.max = v[0]; G.skin.hiR = v[1]; } } },
  { id: 'people', label: 'People', sub: 'On the streets', side: 'cpu', w: 3, val: [60, 90, 130, 170], fmt: (v) => String(v), apply: (G, v) => { if (G.people) G.people.max = Math.min(v, G.people.cap - 120); } },
  { id: 'traffic', label: 'Traffic', sub: 'On the roads', side: 'cpu', w: 3, val: [40, 70, 100, 130], fmt: (v) => String(v), apply: (G, v) => { if (G.traffic) G.traffic.max = v; } },
];
const KEY = 'nh48_beta_graphics';
const BASE = { discrete: 3, integrated: 2, weak: 1, soft: 0 };

export class Graphics {
  constructor(G, C) {
    this.G = G; this.C = C; this.base = BASE[C.gpu] ?? 2;
    this.auto = {}; for (const s of SETTINGS) this.auto[s.id] = this.base;
    this.auto.msaa = C.gpu === 'discrete' ? 3 : 0;       // set once, from the hardware
    this.preset = 'auto'; this.pin = {};
    try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); if (j.preset) this.preset = j.preset; if (j.pin) this.pin = j.pin; } catch (e) { /* no storage: defaults */ }
    this.acc = 0; this.n = 0; this.cpu = 0; this.low = 0; this.high = 0; this.wait = 8; this.blocked = {}; this.trial = null; this.was = {};
    G.afterRender = () => {};                            // (the game's own adaptive resolution: this replaces it)
    G.gfxTick = (dt, cpu) => this.tick(dt, cpu);
    this.applyAll();
  }
  level(id) { const p = this.pin[id]; if (p !== undefined) return p; if (this.preset !== 'auto') return this.preset; return this.auto[id]; }
  applyOne(s) { const v = s.val[this.level(s.id)]; if (this.was[s.id] === v) return; this.was[s.id] = v; try { s.apply(this.G, v, this.C); } catch (e) { console.warn('graphics', s.id, e); } }
  applyAll() { for (const s of SETTINGS) this.applyOne(s); const l = this.preset === 'auto' ? this.base : this.preset; this.G.qualityName = ['lite', 'low', 'med', 'high'][l]; this.sync(); }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ preset: this.preset, pin: this.pin })); } catch (e) { /* private window */ } }
  choose(id, v) {
    if (id === 'all') { this.preset = v === 'auto' ? 'auto' : +v; this.pin = {}; }
    else if (v === 'auto') delete this.pin[id]; else this.pin[id] = +v;
    this.trial = null; this.wait = 6; this.low = this.high = 0; this.save(); this.applyAll();
  }
  free(s, now) { return !s.fixed && this.pin[s.id] === undefined && !(this.blocked[s.id] > now); }
  // a two-second look at how it's going
  tick(dt, cpuMs) {
    const G = this.G;
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
      const pick = (f) => SETTINGS.filter(s => this.free(s, now) && this.auto[s.id] > 0 && f(s)).sort((a, b) => score(b) - score(a))[0];
      const s = pick(q => q.side === side || q.side === 'both') || pick(() => true);
      this.low = 0; if (!s) return;
      this.auto[s.id]--; this.applyOne(s); this.trial = { s, fps, dir: -1, left: 2 }; this.wait = 4; this.sync();
    } else if (this.high >= 10) {
      this.high = 0;
      const s = SETTINGS.filter(q => this.free(q, now) && this.auto[q.id] < 3 && !(q.side === 'cpu' && share > .5)).sort((a, b) => a.w*this.auto[a.id] - b.w*this.auto[b.id])[0];
      if (!s) return;
      this.auto[s.id]++; this.applyOne(s); this.trial = { s, fps, dir: 1, left: 3 }; this.wait = 4; this.sync();
    }
  }
  sync() {
    const r = this.root; if (!r) return;
    const on = (el, v) => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
    on(r.querySelector('[data-g="all"]'), this.preset);
    for (const s of SETTINGS) {
      on(r.querySelector(`[data-g="${s.id}"]`), this.pin[s.id] ?? 'auto');
      r.querySelector(`[data-now="${s.id}"]`).textContent = s.sub + ' · now ' + s.fmt(s.val[this.level(s.id)]);
    }
  }
  // the Settings page: sections of its own (Graphics, Audio, Game), the same rows the rest of the menu uses
  install() {
    const pane = document.querySelector('section.pane[data-pane="set"]'); if (!pane) return;
    const seg = (id, all) => `<div class="seg" data-g="${id}"><button data-v="auto">Auto</button>${NAMES.map((n, i) => `<button data-v="${i}">${n}</button>`).join('')}</div>`;
    const row = (l, sub, c, nowId) => `<div class="row g-row"><div class="rl">${l}<small ${nowId ? `data-now="${nowId}"` : ''}>${sub}</small></div><div class="rc">${c}</div></div>`;
    const g = document.createElement('div'); g.className = 'group settings-gfx';
    g.innerHTML = row('Graphics', 'Auto fits it to your PC as you play', seg('all')) + SETTINGS.map(s => row(s.label, s.sub, seg(s.id), s.id)).join('');
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
