// The car radio (U): real stations playing now, the way a car in Pune would have them on: today's Bollywood chart,
// club mixes for a night drive, the 2010s, the slow ones for the rain, Indian electronic. U goes to the next one, and
// after the last, off. Between them a breath of static while it tunes.
// It sounds like what it's coming out of: an auto's one small speaker is thin and a little rough, a hatchback's
// doors are plain, an SUV has some bass, and a luxury car or a supercar is full and wide and deep. Step out and
// leave it on and you hear it from outside, through the glass, fainter as you walk away.
// (Plain MP3 streams play as they are; an HLS one gets hls.js from the CDN the first time. A car with the garage's
// DJ box has the dhol as its first station. These are other people's live stations: fine while we build, but a
// public release needs their permission or our own music.)
import { baseOf } from '../vehicles/models.js';
import { keyOf } from '@orig/game/keys.js';

const UBER = 'https://drive.uber.radio/uber/';
const STATIONS = [
  { name: 'Mirchi Top 20', sub: 'the biggest songs this week', url: UBER + 'bollywoodnow/icecast.audio' },
  { name: 'Bollywood Dance', sub: 'club mixes, for the night', url: UBER + 'bollywooddance/icecast.audio' },
  { name: 'Bollywood 2010s', sub: 'the ones you grew up on', url: UBER + 'bollywood2010s/icecast.audio' },
  { name: 'Mirchi Love', sub: 'the slow ones, for the rain', url: UBER + 'bollywoodlove/icecast.audio' },
  { name: 'Bombay Beats', sub: 'Indian electronic, chill', url: 'https://strmreg.1.fm/bombaybeats_mobile_mp3' },
];
// what the speakers make of it: high-pass, low-pass, bass and treble shelves, a mid bump, how hard it's driven, the level
const SPK = {
  tinny: { hp: 420, lp: 3400, bass: 0, treb: -8, mid: [1500, 6], drive: 0.45, vol: 0.75 },
  basic: { hp: 120, lp: 7500, bass: 1.5, treb: -3, mid: [2400, 2], drive: 0.1, vol: 0.85 },
  good: { hp: 55, lp: 12500, bass: 4, treb: 0, mid: [2800, 0], drive: 0, vol: 0.92 },
  prem: { hp: 28, lp: 19000, bass: 6.5, treb: 3, mid: [3200, -1.5], drive: 0, vol: 1 },
};
const kindOf = (v) => {
  if (!v || !v.spec || v.spec.two) return null;
  const b = baseOf(v.type);
  if (/^(auto|tempo)/.test(b) || v.inAuto) return 'tinny';
  if (/^(lux|super|sports)$/.test(b)) return 'prem';
  if (/^(suv|xuv|fortuner|scorpio|innova|city|sedan|nexon|jeep|ertiga|bolero)$/.test(b)) return 'good';
  return 'basic';
};

let hlsP = null;
const loadHls = () => hlsP || (hlsP = new Promise((res, rej) => {
  if (window.Hls) return res(window.Hls);
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'; s.async = true;
  s.onload = () => res(window.Hls); s.onerror = () => { hlsP = null; rej(new Error('hls.js')); }; document.head.appendChild(s);
}));

const G0 = () => window.__nhAskG;
const R = window.__nhRadio = { car: null, i: -1, el: null, hls: null, nodes: null, list: STATIONS, dj: false };      // (on window for the console)

function graph(A) {
  if (R.nodes) return R.nodes;
  const ctx = A.ctx, el = R.el = new window.Audio(); el.crossOrigin = 'anonymous'; el.preload = 'none';
  const src = ctx.createMediaElementSource(el), f = (type) => { const b = ctx.createBiquadFilter(); b.type = type; return b; };
  const hp = f('highpass'), bass = f('lowshelf'), mid = f('peaking'), treb = f('highshelf'), lp = f('lowpass'), shell = f('lowpass');
  bass.frequency.value = 95; treb.frequency.value = 8500; mid.Q.value = 0.9; hp.Q.value = 0.8; lp.Q.value = 0.7; shell.frequency.value = 20000;
  const shaper = ctx.createWaveShaper(), out = ctx.createGain(); out.gain.value = 0;
  src.connect(hp).connect(bass).connect(mid).connect(treb).connect(lp).connect(shaper).connect(shell).connect(out).connect(A.bus('music'));
  R.nodes = { ctx, hp, bass, mid, treb, lp, shaper, shell, out };
  return R.nodes;
}
function voice(N, k) {
  const S = SPK[k], t = N.ctx.currentTime;
  N.hp.frequency.setTargetAtTime(S.hp, t, 0.05); N.lp.frequency.setTargetAtTime(S.lp, t, 0.05);
  N.bass.gain.setTargetAtTime(S.bass, t, 0.05); N.treb.gain.setTargetAtTime(S.treb, t, 0.05);
  N.mid.frequency.setTargetAtTime(S.mid[0], t, 0.05); N.mid.gain.setTargetAtTime(S.mid[1], t, 0.05);
  // a cheap speaker driven hard: the peaks rounded off
  const n = 1024, c = new Float32Array(n), d = S.drive; for (let i = 0; i < n; i++) { const x = i/(n - 1)*2 - 1; c[i] = d > 0 ? Math.tanh(x*(1 + d*4))/Math.tanh(1 + d*4) : x; }
  N.shaper.curve = c; N.kind = k;
}
function stopStream() {
  if (R.hls) { try { R.hls.destroy(); } catch (e) { /* gone */ } R.hls = null; }
  if (R.el) { R.el.pause(); R.el.removeAttribute('src'); try { R.el.load(); } catch (e) { /* fine */ } }
  if (R.dj) { const M = G0() && G0().modfx; if (M && M.djOn) M.music(false); R.dj = false; }
}
async function tune(st) {
  const G = G0(), A = G.audio, N = graph(A);
  stopStream();
  if (st.dj) { R.dj = true; G.modfx.music(true); return; }
  A.noiseBurst && A.noiseBurst(0.45, 2600, 0.35, 0.035);              // (the static between stations)
  const my = R.tok = {}, el = R.el;
  try {
    // an HLS stream through hls.js wherever the browser can take it (Chrome says it plays HLS itself and then
    // doesn't); the browser's own player for plain streams, and for HLS where there's no MediaSource (an iPhone)
    const hlsUrl = /\.m3u8(\?|$)/.test(st.url), Hls = hlsUrl && window.MediaSource ? await loadHls().catch(() => null) : null; if (R.tok !== my) return;
    if (Hls && Hls.isSupported()) { const h = R.hls = new Hls({ lowLatencyMode: false, maxBufferLength: 20 }); h.loadSource(st.url); h.attachMedia(el);
      h.on(Hls.Events.ERROR, (e, d) => { if (d.fatal && R.tok === my) { G.hud.toast(st.name, 'No signal', 'warn', 1.8); stopStream(); } }); }
    else el.src = st.url;
    await el.play();
  } catch (e) { if (R.tok === my) G.hud.toast(st.name, 'No signal', 'warn', 1.8); }
}
function next() {
  const G = G0(), P = G.player, v = P.cur, A = G.audio; if (!A || !A.ctx) return;
  const k = kindOf(v);
  if (!k) { G.hud.toast('No radio', 'Not on this one', 'info', 1.4); return; }
  if (R.car !== v) { off(); R.car = v; R.i = -1; R.list = v.dj ? [{ name: 'Dhol', sub: 'The DJ box', dj: true }, ...STATIONS] : STATIONS; }
  R.i++;
  if (R.i >= R.list.length) { off(); G.hud.toast('Radio off', '', 'info', 1.2); return; }
  const st = R.list[R.i], N = graph(A); voice(N, k);
  G.hud.toast(st.name, st.sub + ' · U for the next', 'info', 2.4);
  tune(st);
}
function off() { stopStream(); R.tok = null; R.i = -1; if (R.nodes) R.nodes.out.gain.setTargetAtTime(0, R.nodes.ctx.currentTime, 0.08); R.car = null; }

addEventListener('keydown', (e) => {
  if (e.code !== keyOf('music') || e.repeat) return;
  const G = G0(); if (!G || G.state !== 'play' || !G.player || G.player.onFoot) return;
  e.stopImmediatePropagation(); next();
}, true);
// every frame: as loud as it should be from where you are
const tick = () => {
  requestAnimationFrame(tick);
  const G = G0(), N = R.nodes; if (!N || !G || !R.car) return;
  const P = G.player, v = R.car, t = N.ctx.currentTime, S = SPK[N.kind] || SPK.basic;
  const F = P.onFoot ? P.foot : P.cur, d = F ? Math.hypot(F.x - v.x, F.z - v.z) : 0;
  if (v.dead || d > 90) { off(); return; }            // (gone, or left far behind: it's off)
  let g = S.vol*0.55, cut = 20000;
  if (P.onFoot || P.cur !== v) { g *= Math.max(0, 1 - d/32)**2*0.6; cut = 900; }
  if (G.state !== 'play') g = 0;
  N.out.gain.setTargetAtTime(R.dj ? 0 : g, t, 0.12); N.shell.frequency.setTargetAtTime(cut, t, 0.15);
};
requestAnimationFrame(tick);
