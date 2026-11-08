// The car radio (U): real stations playing now, the way a car in Pune would have them on: today's Bollywood chart,
// club mixes for a night drive, the 2010s, the 2000s bangers, the slow ones for the rain, Marathi, Punjabi, hip-hop,
// a London station with DJs live (the Fred again.. lane), Indian electronic. U goes to the next one, and after the
// last, off. Between them a breath of static while it tunes.
// It sounds like it's playing in the car you're sitting in: the speakers (an auto's one small one thin and rough and
// out in the open air, a hatchback's doors plain, an SUV with some bass, a luxury car or a supercar full and deep),
// a little glue on it like a mastered track, and the cabin itself, the sound coming back off the glass and the roof,
// a short close room round you. Open the door and the room opens with it. Step out and leave it on and you hear it
// from outside, through the glass, fainter as you walk away, clearer with the door open.
// (Plain MP3 streams play as they are; an HLS one gets hls.js from the CDN the first time. A car with the garage's
// DJ box has the dhol as its first station. These are other people's live stations: fine while we build, but a
// public release needs their permission or our own music.)
import { baseOf } from '../vehicles/models.js';
import { keyOf } from '@orig/game/keys.js';

const UBER = 'https://drive.uber.radio/uber/';
const STATIONS = [
  { name: 'Mirchi Top 20', sub: 'the biggest songs this week', url: UBER + 'bollywoodnow/icecast.audio' },
  { name: 'Bollywood Dance', sub: 'club mixes, for the night', url: UBER + 'bollywooddance/icecast.audio' },
  { name: 'Mirchi Love', sub: 'the slow ones, for the rain', url: UBER + 'bollywoodlove/icecast.audio' },
  { name: 'Bollywood 2000s', sub: 'the 90s and 2000s bangers', url: UBER + 'bollywood2000s/icecast.audio' },
  { name: 'Maayboli Marathi', sub: 'Marathi, all day', url: 'https://stream.zeno.fm/48kybvzrwfeuv' },
  { name: 'BritAsia Punjabi', sub: 'Punjabi hits', url: 'https://s4.radio.co/sfefce156f/listen' },
  { name: '100 Hip Hop & RnB', sub: 'hip-hop, non-stop', url: 'https://streaming.shoutcast.com/100-hip-hop-and-rnb-fm' },
  { name: 'NTS London', sub: 'DJs live from London', url: 'https://streams.radiomast.io/nts1' },
  { name: 'Bombay Beats', sub: 'Indian electronic, chill', url: 'https://strmreg.1.fm/bombaybeats_mobile_mp3' },
];
// (every one of these lets the page take its sound through Web Audio (CORS): one that doesn't plays silent here)
// what the speakers and the car make of it: high-pass, low-pass, bass and treble shelves, the sub under it, a mid bump,
// how hard it's driven, how much it's squeezed together, how much of the cabin you hear, the level
const SPK = {
  tinny: { hp: 480, lp: 3200, bass: -2, sub: 0, treb: -9, mid: [1400, 7], drive: 0.5, comp: 0, room: 0.03, vol: 0.72 },
  basic: { hp: 110, lp: 8000, bass: 2, sub: 0.5, treb: -2, mid: [2400, 1.5], drive: 0.08, comp: 0.4, room: 0.12, vol: 0.86 },
  good: { hp: 45, lp: 14000, bass: 2.5, sub: 1, treb: 0.5, mid: [2800, -0.5], drive: 0, comp: 0.5, room: 0.16, vol: 0.93 },
  // (a good system is clean, not loud in the low end: a touch of warmth, the top open, the track left as it was mixed)
  prem: { hp: 28, lp: 20000, bass: 2, sub: 0.5, treb: 1.5, mid: [3200, -1], drive: 0, comp: 0.35, room: 0.2, vol: 1 },
};
// how far the door's open, 0 shut to 1 wide (beta/vehicles/cardoor.js keeps the doors that are swinging in P.doors)
export const doorOpen = (P, v) => { let o = 0; if (P && v) for (const R of P.doors || []) if (R.veh === v) o = Math.max(o, Math.min(1, (R.ang || 0)/1.18)); return o; };
export const kindOf = (v) => {
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
  const hp = f('highpass'), bass = f('lowshelf'), sub = f('peaking'), mid = f('peaking'), treb = f('highshelf'), lp = f('lowpass'), shell = f('lowpass');
  bass.frequency.value = 110; sub.frequency.value = 55; sub.Q.value = 1.1; treb.frequency.value = 8500; mid.Q.value = 0.9; hp.Q.value = 0.8; lp.Q.value = 0.7; shell.frequency.value = 20000;
  // glue: the peaks brought in a little and the whole lifted, like a track off the desk
  const comp = ctx.createDynamicsCompressor(); comp.knee.value = 12; comp.attack.value = 0.008; comp.release.value = 0.18;
  const make = ctx.createGain();
  // the cabin: the sound back off the glass, the roof and the dash, a few bounces inside the first 12 ms, each from its
  // own side and a little duller than the dry (a handful of delays: a reverb was too heavy here and broke the sound up)
  const wet = ctx.createGain(), dry = ctx.createGain(), dull = f('lowpass'); wet.gain.value = 0; dull.frequency.value = 6500; dull.Q.value = 0.5;
  make.connect(dull);
  for (const [ms, pan, a] of [[2.3, -0.7, 0.55], [3.9, 0.65, 0.45], [6.1, -0.35, 0.33], [8.6, 0.45, 0.25], [11.7, -0.15, 0.18]]) {
    const d = ctx.createDelay(0.05), p = ctx.createStereoPanner(), g = ctx.createGain(); d.delayTime.value = ms/1000; p.pan.value = pan; g.gain.value = a;
    dull.connect(d).connect(g).connect(p).connect(wet);
  }
  // and nothing past full scale, ever: a brick wall just under it
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  const shaper = ctx.createWaveShaper(), out = ctx.createGain(); out.gain.value = 0;
  src.connect(hp).connect(bass).connect(sub).connect(mid).connect(treb).connect(lp).connect(shaper).connect(comp).connect(make);
  make.connect(dry).connect(shell); wet.connect(shell);
  shell.connect(lim).connect(out).connect(A.bus('music'));
  R.nodes = { ctx, hp, bass, sub, mid, treb, lp, shaper, comp, make, wet, dry, shell, lim, out };
  return R.nodes;
}
function voice(N, k) {
  const S = SPK[k], t = N.ctx.currentTime;
  N.sub.gain.setTargetAtTime(S.sub, t, 0.05);
  N.comp.threshold.setTargetAtTime(-8 - 10*S.comp, t, 0.05); N.comp.ratio.setTargetAtTime(1 + 1.5*S.comp, t, 0.05); N.make.gain.setTargetAtTime(1, t, 0.05);
  N.room = S.room;
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

// a tap of U is the next station (on letting go); held for a second it's off, whatever was on
let held = null;
addEventListener('keydown', (e) => {
  if (e.code !== keyOf('music')) return;
  const G = G0(); if (!G || G.state !== 'play' || !G.player || G.player.onFoot) return;
  e.stopImmediatePropagation(); if (e.repeat || held) return;
  held = { done: false, t: setTimeout(() => { held.done = true; if (R.car || R.i >= 0) { off(); G.hud.toast('Radio off', 'hold U', 'info', 1.2); } }, 900) };
}, true);
addEventListener('keyup', (e) => {
  if (e.code !== keyOf('music') || !held) return;
  clearTimeout(held.t); const was = held; held = null;
  const G = G0(); if (was.done || !G || G.state !== 'play' || !G.player || G.player.onFoot) return;
  e.stopImmediatePropagation(); next();
}, true);
// every frame: as loud as it should be from where you are
const tick = () => {
  requestAnimationFrame(tick);
  const G = G0(), N = R.nodes; if (!N || !G || !R.car) return;
  const P = G.player, v = R.car, t = N.ctx.currentTime, S = SPK[N.kind] || SPK.basic;
  const F = P.onFoot ? P.foot : P.cur, d = F ? Math.hypot(F.x - v.x, F.z - v.z) : 0;
  if (v.dead || d > 90) { off(); return; }            // (gone, or left far behind: it's off)
  // the door: open, the cabin's less of a room inside and the music gets out to you outside
  const door = doorOpen(P, v);
  let g = S.vol*0.55, cut = 20000, room = N.room || 0;
  if (P.onFoot || P.cur !== v) { g *= Math.max(0, 1 - d/32)**2*(0.6 + 0.9*door); cut = 900 + 7000*door*door; room *= 0.3; }
  else room *= 1 - 0.6*door;
  if (G.state !== 'play') g = 0;
  N.out.gain.setTargetAtTime(R.dj ? 0 : g, t, 0.12); N.shell.frequency.setTargetAtTime(cut, t, 0.15);
  N.wet.gain.setTargetAtTime(room*1.6, t, 0.1); N.dry.gain.setTargetAtTime(1 - room*0.4, t, 0.1);
};
requestAnimationFrame(tick);
