// /beta's graphics settings and its Auto. The whole picture is Auto, Lite, Low, Medium, High, Very High, Ultra or Custom.
// A named one sets every row below to a value of its own and the rows show that value. Touch any row and it's Custom,
// because that isn't one of the set layouts any more; a row in Custom can be a value of yours or Auto.
// What the names are for (a 1080p screen):
//   Lite       4 GB of RAM, a weak processor, no graphics card. As smooth as that can be, whatever it takes
//   Low        8 GB, an i3, integrated graphics: a steady 30 at the least
//   Medium     16 GB, an i3, integrated graphics: 30 to 60 (on an 8 GB i3-1115G4 too)
//   High       8-16 GB, a 4 GB card, an 11th gen i5 or later: 60, constantly (20 to 30 on that i3)
//   Very High  16 GB, an 8 GB card, 12th gen or later: 60
//   Ultra      looks first
// Auto starts from what the PC is, and while you play, when frames drop or stutter (a slow PC, or something else running
// on it), works out whether the graphics card or the processor is holding things up and takes steps off what's costing
// the most for the least you'd notice, checks that helped, and gives steps back slowly when there's room. Frame rate first
// and looks second: under 30 it comes down at once, past each setting's floor if it has to; from 30 to 45 it gives up only
// what's above a floor, so the streets don't empty and the picture doesn't blur to hold a number you can't feel; about 60
// is the aim, and from 51 up there's room to give something back. What's far off (how far the city's built and seen,
// trees, stalls, vehicles, the crowds) is the last thing it gives up and the first it gives back.
const NAMES = ['Lite', 'Low', 'Medium', 'High', 'Very High', 'Ultra'];
const pct = (v) => Math.round(v*100) + '%';
// the screen's own height in pixels (the window's, times the screen's scaling), and the pixel ratio that draws h rows
const screenH = () => Math.round((window.innerHeight || 720)*(window.devicePixelRatio || 1));
const prFor = (h) => Math.max(0.2, Math.min(4, h/Math.max(1, window.innerHeight || 720)));
// (a window resized or moved to another screen: the same number of rows as before)
let _resG = null;
window.addEventListener('resize', () => { const G = _resG; if (G && G.resH && G.renderer) { const pr = prFor(G.resH); if (Math.abs(pr - G.renderer.getPixelRatio()) > 0.005) { G.perf.pr = pr; G.applyPixelRatio(pr); } } });
const onOff = (v, f) => (v ? f(v) : 'Off');
const M = (v) => v + ' m';
const fx = (C, o) => { Object.assign(C.post.fx, o); };
// A setting: its values (val), which of them each name uses (at: Lite to Ultra), what it costs (side: what it loads; w: how
// readily Auto gives it up, frame time back for what you'd see go; floor: as far as it goes unless it's under 30) and what
// it does. `style` ones are the look itself and `fixed` ones are slow to change: Auto picks them once
// from the PC and leaves them alone while you play.
export const SETTINGS = [
  { group: 'Image' },
  // the picture's own height in pixels, whatever the window or the screen's scaling (720p is 720 rows drawn, stretched to
  // fill the window), the way games set it: below your screen's own it's softer and quicker, above it's sharper and slower
  { id: 'res', label: 'Resolution', sub: 'Pixels drawn, top to bottom. Your screen is ' + screenH() + 'p', side: 'gpu', w: 2.2, floor: 2, val: [360, 480, 540, 720, 900, 1080, 1440, 2160], at: [2, 3, 4, 5, 6, 7], fmt: (v) => (v === 2160 ? '4K' : v === 1440 ? '1440p (2K)' : v + 'p') + (Math.abs(v - screenH()) < 2 ? ' · native' : ''), apply: (G, v) => { G.resH = v; const pr = prFor(v); G.perf.pr = pr; G.applyPixelRatio(pr); } },
  { id: 'msaa', label: 'Anti-aliasing', sub: 'MSAA. Auto goes by your PC, not your frame rate', fixed: true, val: [0, 2, 4, 8, 16], at: [0, 0, 0, 2, 3, 4], fmt: (v) => (v ? 'MSAA ' + v + 'x' : 'Off'), apply: (G, v, C) => { const m = Math.min(v, G.renderer.capabilities.maxSamples); if (C.post.q.samples !== m) { C.post.q.samples = m; C.post.setSize(window.innerWidth, window.innerHeight); } } },
  { id: 'aniso', label: 'Texture filtering', sub: 'Anisotropic, for surfaces at a low angle', fixed: true, val: [1, 2, 4, 8, 16], at: [0, 1, 2, 3, 4, 4], fmt: (v) => (v > 1 ? v + 'x AF' : 'Trilinear'), apply: (G, v) => G.setAniso(v) },
  { group: 'Look' },
  { id: 'shade', label: 'Lighting model', sub: 'From two painted tones to physically based light', style: true, val: [[0, 0], [0, 1], [.22, 1], [.5, 1], [.8, 1], [1, 1]], at: [0, 1, 2, 3, 4, 5], fmt: (v) => (!v[1] ? 'Flat cel' : ['Two-tone', 'Soft paint', 'Paint + PBR', 'PBR', 'Full PBR'][[0, .22, .5, .8, 1].indexOf(v[0])]), apply: (G, v, C) => { C.PU.uReal.value = v[0]; C.PU.uMarks.value = v[1]; } },
  { id: 'ink', label: 'Ink lines', sub: 'Depth and colour edges, drawn over the frame', style: true, val: [[0, 0], [0, 1], [1, .22], [1, .85], [1, 1], [2, .5], [2, .85]], at: [1, 4, 3, 5, 2, 0], fmt: (v) => (v[1] === 0 ? 'Off' : ['1 pass', '2 passes', '3 passes'][v[0]] + ' · ' + pct(v[1])), apply: (G, v, C) => { C.post.U.inkQ.value = v[0]; C.post.U.inkS.value = v[1]; } },
  { id: 'paper', label: 'Paper finish', sub: 'Grain, specks, brush strokes and the torn edge', style: true, val: [0, .2, .55, 1], at: [3, 3, 3, 2, 1, 0], fmt: (v) => onOff(v, pct), apply: (G, v, C) => { C.post.U.paper.value = v; } },
  { id: 'tear', label: 'Torn paper edge', sub: 'A decoration round the screen. Yours to turn on', style: true, val: [0, 1], at: [0, 0, 0, 0, 0, 0], fmt: (v) => (v ? 'On' : 'Off'), apply: (G, v, C) => { C.post.U.tear.value = v; } },
  { id: 'grade', label: 'Tone mapping', sub: 'From poster colour to a film curve', style: true, val: [0, .12, .45, .8, 1], at: [0, 0, 1, 2, 3, 4], fmt: (v) => (v === 0 ? 'Poster' : v === 1 ? 'ACES filmic' : 'Filmic ' + pct(v)), apply: (G, v, C) => { C.post.U.film.value = v; } },
  { id: 'aerial', label: 'Aerial perspective', sub: 'The air between you and what is far off', side: 'gpu', w: 0.5, val: [0, .35, .7, 1, 1.25], at: [0, 0, 1, 2, 3, 4], fmt: (v) => onOff(v, pct), apply: (G, v, C) => { C.post.U.aerial.value = v; } },
  { group: 'Shadows' },
  { id: 'shadows', label: 'Shadow map', sub: 'Resolution', side: 'gpu', w: 1.5, floor: 1, val: [0, 1024, 2048, 3072, 4096, 8192], at: [0, 1, 2, 3, 4, 5], fmt: (v) => (v ? v + ' px' : 'Off'), apply: (G, v) => { const m = Math.min(v, G.renderer.capabilities.maxTextureSize); G.swapShadows(m > 0, m || 1024); } },
  { id: 'sfilter', label: 'Shadow filter', sub: 'PCF taps, and how soft the edge is', side: 'gpu', w: 3, val: [[2, 1], [4, 1.4], [8, 2], [16, 3], [32, 4.5]], at: [0, 0, 0, 1, 2, 4], fmt: (v) => v[0] + '-tap PCF', apply: (G, v, C) => { C.PU.uTaps.value = v[0]; C.PU.uSoft.value = v[1]; } },
  { id: 'sdist', far: true, label: 'Shadow distance', sub: 'How far from you things cast one', side: 'gpu', w: 2.5, val: [70, 95, 130, 180, 260], at: [0, 1, 1, 2, 3, 4], fmt: M, apply: (G, v, C) => { if (C.post.shadows) C.post.shadows.reach(v); } },
  { group: 'Post-processing' },
  { id: 'ao', label: 'Ambient occlusion', sub: 'SSAO samples, at this share of the resolution', side: 'gpu', w: 3.5, val: [[0, .5], [8, .5], [16, .5], [32, .75], [64, 1]], at: [0, 0, 1, 2, 3, 4], fmt: (v) => (v[0] ? v[0] + ' spp · ' + pct(v[1]) : 'Off'), apply: (G, v, C) => fx(C, { ao: v[0], aoScale: v[1] }) },
  { id: 'gi', label: 'Bounce light', sub: 'SSGI rays per pixel: sunlit walls lighting what is near', side: 'gpu', w: 4, val: [0, 8, 16], at: [0, 0, 0, 0, 1, 2], fmt: (v) => onOff(v, x => x + ' rays'), apply: (G, v, C) => fx(C, { rays: v }) },
  { id: 'ssr', label: 'Reflections', sub: 'Screen-space ray steps, on glass, paint and wet road', side: 'gpu', w: 4, val: [[0, .5], [16, .5], [32, .5], [64, 1]], at: [0, 0, 0, 1, 2, 3], fmt: (v) => (v[0] ? v[0] + ' steps · ' + pct(v[1]) : 'Off'), apply: (G, v, C) => fx(C, { ssr: v[0], ssrScale: v[1] }) },
  { id: 'bloom', label: 'Bloom', sub: 'Blur chain length', side: 'gpu', w: 1.5, val: [0, 3, 4, 5, 6], at: [0, 0, 1, 2, 3, 4], fmt: (v) => onOff(v, x => x + ' mips'), apply: (G, v, C) => fx(C, { bloom: v }) },
  { id: 'shafts', label: 'Sun shafts', sub: 'Radial samples', side: 'gpu', w: 3, val: [0, 32, 64, 128], at: [0, 0, 0, 1, 2, 3], fmt: (v) => onOff(v, x => x + ' samples'), apply: (G, v, C) => fx(C, { shafts: v }) },
  { id: 'dof', label: 'Depth of field', sub: 'Bokeh samples, for what is far behind you', side: 'gpu', w: 3, val: [0, 8, 24], at: [0, 0, 0, 0, 1, 2], fmt: (v) => onOff(v, x => x + ' samples'), apply: (G, v, C) => fx(C, { dof: v }) },
  { group: 'World' },
  { id: 'dist', far: true, label: 'View distance', sub: 'How much of the city is built around you', side: 'both', w: 2, floor: 1, val: [220, 360, 520, 720, 1000, 1400], at: [0, 1, 2, 3, 4, 5], fmt: M, apply: (G, v) => G.W.streamer.setRadius(v) },
  // how far you see at all: past the built streets it's the far city, the river and the hills. Only Lite cuts it short;
  // from High up whatever you look at is on screen, the far side of Pune included
  { id: 'sight', far: true, label: 'Sight distance', sub: 'How far you can see the city, past what is built', side: 'gpu', w: 0.6, floor: 2, val: [1000, 1800, 2600, 6000, 9000, 14000], at: [0, 1, 2, 3, 4, 5], fmt: (v) => (v >= 1000 ? (v/1000) + ' km' : v + ' m'), apply: (G, v) => { const c = G.camera; if (c && c.far !== v) { c.far = v; c.updateProjectionMatrix(); } } },
  { id: 'geo', label: 'World geometry', sub: 'Walls, kerbs and roads close up. Applies to what gets built as you move', fixed: true, val: [0, 1, 2], at: [0, 0, 1, 1, 2, 2], fmt: (v) => ['Standard', 'Structured', 'Every window and stone'][v], apply: (G, v) => { if (G.W && G.W.painter) { G.W.painter.rich = v; G.W.painter.geoAt = (G.W.painter.geoAt || 0) + 1; } } },
  { id: 'sdetail', far: true, label: 'Stall detail', sub: 'How far stalls get their full models', side: 'gpu', w: 3, val: [25, 60, 90, 140, 200, 300], at: [0, 1, 2, 3, 4, 5], fmt: M, apply: (G, v) => { if (G.W && G.W.stallNear) G.W.stallNear(v); } },
  { id: 'vdist', far: true, label: 'Vehicle detail', sub: 'How far the full models go', side: 'gpu', w: 2.5, val: [15, 22, 30, 45, 70, 110], at: [0, 1, 2, 3, 4, 5], fmt: M, apply: (G, v) => G.setVehicleDetail(v) },
  { id: 'trees', far: true, label: 'Trees', sub: 'Full trees to, then lighter trees to', side: 'gpu', w: 2.5, floor: 1, val: [[15, 180], [40, 400], [70, 520], [110, 900], [160, 1200], [240, 1600]], at: [0, 1, 2, 3, 4, 5], fmt: (v) => v[0] + ' m / ' + v[1] + ' m', apply: (G, v) => { const T = G.W.trees; if (T) { T.nearR = v[0]; T.midR = v[1]; T.R = 0; T.lastX = 1e9; } } },
  { id: 'grass', far: true, label: 'Grass', sub: 'How far it is drawn', side: 'gpu', w: 2.5, val: [0, .35, .7, 1, 1.4, 2], at: [0, 1, 2, 3, 4, 5], fmt: (v) => (v ? Math.round(v*64) + ' m' : 'Off'), apply: (G, v) => { if (G.W.grass) G.W.grass.level = v; } },
  { id: 'bodies', far: true, label: 'Skinned bodies', sub: 'How many people and riders are real, fully detailed bodies and how far out (a street at High, two or three at Very High), and how close the 50k-triangle ones are', side: 'both', w: 2.5, floor: 1, val: [[8, 0, 40, 20, 4], [32, 6, 55, 28, 14], [64, 12, 80, 45, 22], [96, 22, 125, 75, 32], [128, 40, 190, 115, 46], [160, 70, 270, 160, 60]], at: [0, 1, 2, 3, 4, 5], fmt: (v) => v[0] + ' people · to ' + v[2] + ' m', apply: (G, v) => { if (G.skin) { G.skin.max = v[0]; G.skin.hiR = v[1]; } if (G.crowd) { G.crowd.range = v[2]; G.crowd.cap = v[0] + 24; } if (G.traffic) { G.traffic.richR = v[3]; G.traffic.richN = v[4]; } } },
  { id: 'people', far: true, label: 'Pedestrians', sub: 'On the streets', side: 'cpu', w: 1.5, floor: 1, val: [30, 90, 130, 170, 220, 280], at: [0, 1, 2, 3, 4, 5], fmt: (v) => String(v), apply: (G, v) => { if (G.people) G.people.max = Math.min(v, G.people.cap - 120); } },
  { id: 'traffic', far: true, label: 'Traffic', sub: 'Vehicles on the roads', side: 'cpu', w: 1.5, floor: 1, val: [20, 70, 100, 130, 170, 220], at: [0, 1, 2, 3, 4, 5], fmt: (v) => String(v), apply: (G, v) => { if (G.traffic) G.traffic.max = v; } },
];
const ALL = SETTINGS.filter(s => s.id);
const AUTO_TOP = 4;                                       // (Auto stops at Very High: Ultra is yours to ask for)
const CAPS = [30, 60, 90, 120, 144, 165, 240, 0], COUNTERS = ['Off', 'FPS', 'FPS and frame time', 'Full'];
const PACE_ON = 'Steady: every picture stays on screen the same length of time, at the quickest even rate your PC holds (60, 30, 20), so motion is smooth. Off would show more frames a second on the counter, each as soon as it is ready, but unevenly: that is the judder you see when turning or driving',
  PACE_OFF = 'Off: each picture is shown the moment it is ready. More frames a second on the counter, but some stay up longer than others, which shows as judder when turning or driving. Steady would hold an even rate (60, 30, 20) for smooth motion, with fewer frames';
const KEY = 'nh48_beta_gfx3', OLD = 'nh48_beta_gfx2';
const saved = () => { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) return j; const o = JSON.parse(localStorage.getItem(OLD) || 'null'); if (o) return { preset: o.preset, cap: o.cap, counter: o.counter }; } catch (e) { /* no storage */ } return {}; };
// where Auto starts on this PC: by its graphics, its memory and its processor (the browser reports memory up to 8 GB)
export function hardwareTier(gpu) {
  const gb = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 4;
  if (gpu === 'soft' || gpu === 'none' || gb <= 4) return 0;
  if (gpu === 'weak') return cores > 4 ? 1 : 0;
  if (gpu === 'discrete') return gb < 8 || cores <= 4 ? 2 : 3;
  return cores <= 2 ? 0 : 1;                              // integrated: Low, and it earns its way up
}
// what the world is built for when it loads: the name you chose, or what Auto starts at
export function bootTier(gpu) { const p = saved().preset; return typeof p === 'number' ? p : hardwareTier(gpu); }

export class Graphics {
  constructor(G, C) {
    this.G = G; this.C = C; this.base = hardwareTier(C.gpu); _resG = G;
    this.auto = {}; for (const s of ALL) this.auto[s.id] = s.at[this.base];
    this.preset = 'auto'; this.pin = {}; this.cap = 144; this.counter = 0; this.pace = 1;
    const j = saved(); if (j.preset !== undefined) this.preset = j.preset; if (j.pin) this.pin = j.pin; if (j.cap !== undefined) this.cap = j.cap; if (j.counter !== undefined) this.counter = j.counter; if (j.steady !== undefined) this.pace = j.steady;
    G.fpsCap = this.cap; this.fN = 0; this.fT = 0; this.fW = 0;
    this.acc = 0; this.n = 0; this.cpu = 0; this.spikes = 0; this.low = 0; this.high = 0; this.wait = 8; this.blocked = {}; this.trial = null; this.was = {};
    G.afterRender = () => {};                            // (the game's own adaptive resolution: this replaces it)
    G.gfxTick = (dt, cpu) => this.tick(dt, cpu);
    this.applyAll();
  }
  // which of a setting's values is in use. A name's own; yours in Custom; Auto's otherwise
  level(id) { const n = typeof this.preset === 'number' ? this.preset : -1; if (n >= 0) return ALL.find(s => s.id === id).at[n]; const p = this.pin[id]; return p !== undefined ? p : this.auto[id]; }
  applyOne(s) { const v = s.val[this.level(s.id)]; if (this.was[s.id] === v) return; this.was[s.id] = v; try { s.apply(this.G, v, this.C); } catch (e) { console.warn('graphics', s.id, e); } }
  tier() { return typeof this.preset === 'number' ? this.preset : this.preset === 'custom' ? Math.round(this.level('people')*5/6) : this.base; }
  applyAll() { for (const s of ALL) this.applyOne(s); this.G.qualityName = ['lite', 'low', 'med', 'high', 'high', 'high'][this.tier()]; this.sync(); }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ preset: this.preset, pin: this.pin, cap: this.cap, counter: this.counter, steady: this.pace })); } catch (e) { /* private window */ } }
  choose(id, v) {
    if (id === 'cap') { this.cap = this.G.fpsCap = +v; this.save(); this.sync(); return; }
    if (id === 'counter') { this.counter = +v; this.save(); this.sync(); return; }
    if (id === 'pace') { this.pace = +v; if (this.G.pace) this.G.pace.on = !!this.pace; this.save(); this.sync(); return; }
    if (id === 'all') {
      if (v === 'custom') { if (this.preset !== 'custom') { const now = {}; for (const s of ALL) now[s.id] = this.level(s.id); this.pin = now; this.preset = 'custom'; } }
      else { this.preset = v === 'auto' ? 'auto' : +v; this.pin = {}; }
    } else {
      // any one row changed: it isn't a set layout now. Everything stays where it was, and this row changes
      if (this.preset !== 'custom') { const now = {}; for (const s of ALL) now[s.id] = this.level(s.id); this.pin = now; this.preset = 'custom'; }
      if (v === 'auto') delete this.pin[id]; else this.pin[id] = +v;
    }
    this.trial = null; this.wait = 6; this.low = this.high = 0; this.save(); this.applyAll();
  }
  free(s, now) { return !s.fixed && !s.style && this.pin[s.id] === undefined && !(this.blocked[s.id] > now); }
  // a step off what gives the most back for the least you'd notice, on the side that's short. Returns the setting, or nothing left to take
  stepDown(side, now, bad) {
    const score = (s) => s.w*this.auto[s.id]/Math.max(1, s.val.length - 1), mine = (q) => q.side === side || q.side === 'both', above = (q) => this.auto[q.id] > (q.floor || 0);
    const pick = (f) => ALL.filter(s => s.w && this.free(s, now) && this.auto[s.id] > 0 && f(s)).sort((a, b) => score(b) - score(a))[0];
    // seeing far is performance, not looks: everything near goes first (to its floor, then past it if it has to), and only
    // when there's nothing else left does anything far off go, and that last of all
    const near = (q) => !q.far;
    const s = pick(q => near(q) && mine(q) && above(q)) || pick(q => near(q) && above(q)) || (bad && pick(near)) ||
      pick(q => mine(q) && above(q)) || pick(above) || (bad && (pick(mine) || pick(() => true))); if (!s) return null;
    if (s.id === 'res' && !this.resProbe) this.resProbe = { gpu: this.C.post.clock?.total || 0, at: this.auto.res, left: 4 };
    this.auto[s.id]--; this.applyOne(s); return s;
  }
  // a look each second at how it's going. Smooth comes first: down quickly when frames are short or stuttering, up slowly
  tick(dt, cpuMs) {
    const G = this.G;
    this.counterTick(dt, cpuMs);
    if (G.state !== 'play' || dt > .5 || typeof this.preset === 'number') return;
    this.acc += dt; this.n++; this.cpu += cpuMs; if (dt > .05) this.spikes++;
    if (this.acc < 1) return;
    const fps = this.n/this.acc, cpu = this.cpu/this.n, gpu = this.C.post.clock?.total || 0, share = gpu ? (cpu > gpu ? .9 : .3) : cpu/(1000/fps), now = performance.now(), spikes = this.spikes;
    const want = this.cap > 0 ? Math.min(60, this.cap) : 60;
    this.acc = 0; this.n = 0; this.cpu = 0; this.spikes = 0;
    if ((this.wait -= 1) > 0) return;
    // the picture got smaller and the graphics card is hardly any quicker: pixels weren't what it was short of, so have them back
    const Pb = this.resProbe;
    if (Pb && --Pb.left <= 0) { this.resProbe = null; if (Pb.gpu && gpu > Pb.gpu*.88) { this.auto.res = Pb.at; this.blocked.res = now + 600000; this.applyOne(ALL.find(q => q.id === 'res')); this.wait = 2; this.sync(); return; } }
    const T = this.trial;
    if (T && --T.left <= 0) {
      this.trial = null;
      if (T.dir < 0 && fps < T.fps*1.05 && fps >= Math.min(30, want*.9) && fps < want*.75) { this.auto[T.s.id]++; this.blocked[T.s.id] = now + 120000; this.applyOne(T.s); this.wait = 2; this.sync(); return; }   // didn't help: it wasn't this
      if (T.dir > 0 && (fps < want*.75 || spikes >= 3)) { this.auto[T.s.id]--; this.blocked[T.s.id] = now + 300000; this.applyOne(T.s); this.wait = 3; this.sync(); return; }           // too much: back, and leave it a while
    }
    // under 30 isn't playable: down at once and hard. Between 30 and 45 it can wait a few seconds and go gently. About 60 is the aim
    // (one bad second is a hitch, the city loading say, not the settings: it has to stay bad)
    // (held to an even 30 by game/pace.js reads as 29.9 some seconds: that's a steady rate, not one under 30)
    const P = G.pace, even = P && P.on && P.n > 1, hard = Math.min(30, want*.9), bad = fps < hard - (even ? 1.5 : 0); this.under = bad ? (this.under || 0) + 1 : 0;
    const down = this.under >= 2;
    this.low = fps < want*.75 || spikes >= 4 ? this.low + 1 : 0;
    this.high = fps >= want*.85 && !spikes ? this.high + 1 : 0;
    if (down || (this.low >= 5 && !bad)) {
      const side = share > .8 ? 'cpu' : 'gpu', steps = down ? (fps < hard*.6 ? 3 : 2) : 1;
      this.low = 0; let s = null;
      for (let i = 0; i < steps; i++) s = this.stepDown(side, now, this.under >= 3) || s;
      if (!s) return;
      this.trial = steps === 1 ? { s, fps, dir: -1, left: 3 } : null; this.wait = down ? 2 : 3; this.sync();
    } else if (this.high >= 25) {
      this.high = 0;
      const after = (q) => q.w*(this.auto[q.id] + 1)/Math.max(1, q.val.length - 1);   // (the one that would be the last to go again)
      // (and back up, the far ones first: they were the last to go)
      const s = ALL.filter(q => q.w && this.free(q, now) && this.auto[q.id] < q.at[AUTO_TOP] && !(q.side === 'cpu' && share > .5)).sort((a, b) => (b.far ? 1 : 0) - (a.far ? 1 : 0) || after(a) - after(b))[0];
      if (!s) return;
      this.auto[s.id]++; this.applyOne(s); this.trial = { s, fps, dir: 1, left: 5 }; this.wait = 2; this.sync();
    }
  }
  sync() {
    const r = this.root; if (!r) return;
    const on = (el, v) => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
    on(r.querySelector('[data-g="all"]'), this.preset);
    for (const s of ALL) {
      const shown = this.preset === 'auto' ? 'auto' : typeof this.preset === 'number' ? this.level(s.id) : this.pin[s.id] ?? 'auto';
      on(r.querySelector(`[data-g="${s.id}"]`), shown);
      r.querySelector(`[data-now="${s.id}"]`).textContent = s.sub + ' · now ' + s.fmt(s.val[this.level(s.id)]);
    }
    on(r.querySelector('[data-g="cap"]'), this.cap); on(r.querySelector('[data-g="counter"]'), this.counter); on(r.querySelector('[data-g="pace"]'), this.pace);
    r.querySelector('[data-now="pace"]').textContent = this.pace ? PACE_ON : PACE_OFF;
  }
  // the frame counter, in a corner. Runs whatever the preset
  counterTick(dt, cpu) {
    if (!this.counter) { if (this.fpsEl) this.fpsEl.hidden = true; return; }
    if (!this.fpsEl) { const e = this.fpsEl = document.createElement('div'); e.id = 'fps-counter'; document.body.appendChild(e); }
    // (by the clock on the wall, from one picture to the next: the game's own step of time is evened out over six frames,
    // never counts a frame as longer than 0.4 s and slows with slow motion, so a bad stretch read better than it was)
    { const t = performance.now(), was = this._ct; this._ct = t; if (was) dt = (t - was)/1000; if (dt > 5) { this.fN = 0; this.fT = 0; this.fW = 0; this.fC = 0; return; } }
    this.fpsEl.hidden = false; this.fN++; this.fT += dt; this.fW = Math.max(this.fW, dt); this.fC = (this.fC || 0) + cpu;
    if (this.fT < .5) return;
    const R = this.G.renderer, i = R.info, fps = this.fN/this.fT, ms = this.fT/this.fN*1000, l = [`${fps < 10 ? fps.toFixed(1) : fps.toFixed(0)} FPS`];
    if (this.counter >= 2) l.push(`${ms.toFixed(1)} ms · worst ${(this.fW*1000).toFixed(0)} ms`);
    if (this.counter >= 3) { const v = R.getDrawingBufferSize(this._v || (this._v = new (this.C.Vector2)())); l.push(`CPU ${(this.fC/this.fN).toFixed(1)} ms · ${v.x}x${v.y}`, `${i.render.calls} draws · ${(i.render.triangles/1e6).toFixed(2)}M tris`, this.C.post.clock?.text() || '', this.preset === 'auto' ? 'Auto' : this.preset === 'custom' ? 'Custom' : NAMES[this.preset]); }
    this.fpsEl.textContent = l.join('\n'); this.fN = 0; this.fT = 0; this.fW = 0; this.fC = 0;
  }
  // the Settings page: sections of its own (Graphics, Audio, Game), the same rows the rest of the menu uses
  install() {
    const pane = document.querySelector('section.pane[data-pane="set"]'); if (!pane) return;
    const seg = (id, names) => `<div class="seg" data-g="${id}"><button data-v="auto">Auto</button>${names.map((n, i) => `<button data-v="${i}">${n}</button>`).join('')}</div>`;
    const list = (id, pairs) => `<div class="seg" data-g="${id}">${pairs.map(([v, n]) => `<button data-v="${v}">${n}</button>`).join('')}</div>`;
    const row = (l, sub, c, nowId) => `<div class="row g-row"><div class="rl">${l}<small ${nowId ? `data-now="${nowId}"` : ''}>${sub}</small></div><div class="rc">${c}</div></div>`;
    const g = document.createElement('div'); g.className = 'group settings-gfx';
    g.innerHTML = row('Graphics', 'The whole picture. Auto fits it to your PC and what else is running, smooth first. Change anything below and it\'s Custom', seg('all', NAMES).replace('</div>', '<button data-v="custom">Custom</button></div>')) +
      '<div class="g-head">Display</div>' +
      row('Frame rate limit', 'Your screen\'s refresh rate is the most any browser will show', list('cap', CAPS.map(v => [v, v ? v + ' FPS' : 'No limit']))) +
      row('Frame pacing', PACE_ON, list('pace', [[1, 'Steady'], [0, 'Off']]), 'pace') +
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
