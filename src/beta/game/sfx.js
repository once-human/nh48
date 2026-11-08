// The small sounds of doing things, each made the way the thing makes it (no beeps standing in for everything):
// the headlight stalk's two-stage plastic click; a torch's slide switch, a firm clack on and a softer one off; the drive
// mode knob's detent and the cluster's soft note (higher for the sportier ones); a pistol out of the waistband (leather,
// then the slide's metal), a knife's ring, a lathi's swish and knock, a pistol's dry click when it's empty, and a shot's
// crack off the buildings with the brass tinkling down after; paying: coins counted into a palm, notes flicked off a
// wad, or a UPI tap on the phone and the shop's soundbox beeping; the metro: the token's beep on the reader and the
// flaps swinging open; a bus: the conductor's punch through the ticket; something put in your jhola, a rustle;
// eating: a bite, a crunch for the crisp ones, a slurp off a hot cutting glass, a swallow. Never twice the same.
import { Audio } from '@orig/game/audio.js';
import { Lights } from '@orig/game/lights.js';
import { Arms, ARMS } from '@orig/game/arms.js';
import { Shops } from '@orig/game/shops.js';
import { Transit } from '@orig/game/transit.js';
import { Life } from '@orig/game/life.js';

const R = Math.random, J = (a, b) => a + (b - a)*R();
let NB = null;
function nbuf(ctx) { if (NB && NB.ctx === ctx) return NB.b; const n = ctx.sampleRate*2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = R()*2 - 1; NB = { ctx, b }; return b; }
const out = (A) => A.bus ? A.bus('fx') : A.ctx.destination;
// a burst of filtered air: the stuff of clicks, rustles and cracks
function hiss(A, t, len, f, q, vol, type = 'bandpass', f1) {
  const ctx = A.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = nbuf(ctx); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + len); fl.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.004, len*0.2)); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  s.connect(fl); fl.connect(g); g.connect(out(A)); s.start(t, R()*1.5); s.stop(t + len + 0.02);
}
// a struck thing ringing: a few partials, not in tune with each other (metal), dying fast
function ring(A, t, f, len, vol, parts = [1, 2.76, 5.4]) {
  const ctx = A.ctx;
  parts.forEach((m, k) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f*m*J(0.99, 1.01);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol/(1 + k*0.8), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0004, t + len/(1 + k*0.5));
    o.connect(g); g.connect(out(A)); o.start(t); o.stop(t + len + 0.02);
  });
}
function tone(A, t, f, len, vol, type = 'sine', f1) {
  const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + len);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  o.connect(g); g.connect(out(A)); o.start(t); o.stop(t + len + 0.02);
}
const go = (A, fn) => { if (!A || !A.ctx) return; try { fn(A.ctx.currentTime + 0.005); } catch (e) { /* silent */ } };

export const SFX = {
  stalk: (A) => go(A, (t) => { hiss(A, t, 0.012, J(2200, 2600), 3, 0.22); hiss(A, t + J(0.022, 0.034), 0.014, J(1500, 1800), 3, 0.18); tone(A, t + 0.03, 120, 0.03, 0.03); }),
  torch: (A, on) => go(A, (t) => { hiss(A, t, 0.008, on ? 3400 : 2600, 4, 0.2); hiss(A, t + 0.012, 0.02, on ? 1900 : 1500, 2.5, on ? 0.2 : 0.12); hiss(A, t + 0.03, 0.03, 5000, 1, 0.03, 'highpass'); }),
  detent: (A, i, n) => go(A, (t) => { hiss(A, t, 0.01, J(2800, 3300), 5, 0.2); ring(A, t, 1900, 0.04, 0.03); const f = 520*Math.pow(1.19, i) * (i === n - 1 && n > 2 ? 0.75 : 1); tone(A, t + 0.06, f, 0.22, 0.05); tone(A, t + 0.06, f*2.01, 0.12, 0.012); }),
  draw: (A, id, gun, cut) => go(A, (t) => {
    if (!id) { hiss(A, t, 0.22, 1200, 0.8, 0.07, 'bandpass', 700); return; }                    // (put away)
    if (gun) { hiss(A, t, 0.16, 900, 0.9, 0.1, 'bandpass', 2200); ring(A, t + 0.2, 2300, 0.05, 0.08, [1, 2.3]); hiss(A, t + 0.2, 0.01, 4000, 3, 0.25); hiss(A, t + 0.28, 0.012, 3200, 3, 0.2); return; }
    if (cut) { hiss(A, t, 0.2, 3000, 2, 0.08, 'bandpass', 7000); ring(A, t + 0.17, 3900, 0.6, 0.05, [1, 2.4, 4.1]); return; }
    hiss(A, t, 0.25, 500, 0.7, 0.12, 'bandpass', 1400); tone(A, t + 0.24, 210, 0.08, 0.06);
  }),
  dry: (A) => go(A, (t) => { hiss(A, t, 0.008, 3600, 5, 0.28); ring(A, t, 2700, 0.035, 0.06, [1, 2.1]); hiss(A, t + 0.05, 0.01, 2400, 4, 0.12); }),
  // the shot's crack and its echo, and the brass coming down
  shot: (A) => go(A, (t) => {
    hiss(A, t, 0.05, 2500, 0.5, 0.9, 'highpass'); hiss(A, t, 0.3, 400, 0.6, 0.4, 'lowpass', 120);
    const e = J(0.09, 0.16); hiss(A, t + e, 0.4, 900, 0.6, 0.14, 'lowpass', 250); hiss(A, t + e*2.4, 0.6, 600, 0.5, 0.06, 'lowpass', 180);
    let c = t + J(0.45, 0.6); for (let k = 0; k < 3 + Math.floor(R()*2); k++) { ring(A, c, J(4800, 6200), 0.12, 0.05/(1 + k*0.6), [1, 1.73, 2.9]); c += J(0.07, 0.16)/(1 + k*0.3); }
  }),
  coins: (A) => go(A, (t) => { let c = t; for (let k = 0; k < 2 + Math.floor(R()*3); k++) { ring(A, c, J(2300, 3400), J(0.12, 0.25), J(0.05, 0.09), [1, 2.62, 4.3]); c += J(0.05, 0.14); } }),
  notes: (A) => go(A, (t) => { let c = t; for (let k = 0; k < 1 + Math.floor(R()*3); k++) { hiss(A, c, 0.05, J(2500, 3800), 1.6, 0.12); hiss(A, c + 0.01, 0.07, 6000, 0.7, 0.03, 'highpass'); c += J(0.09, 0.16); } }),
  upi: (A) => go(A, (t) => { hiss(A, t, 0.008, 2000, 4, 0.08); tone(A, t + 0.02, 160, 0.06, 0.04, 'square'); const s = t + J(0.7, 1.1); tone(A, s, 1568, 0.12, 0.07, 'square'); tone(A, s + 0.14, 2093, 0.22, 0.07, 'square'); }),
  metro: (A) => go(A, (t) => { tone(A, t, 1760, 0.09, 0.08, 'square'); tone(A, t + 0.12, 1760, 0.09, 0.07, 'square'); hiss(A, t + 0.3, 0.32, 400, 0.7, 0.12, 'bandpass', 1400); tone(A, t + 0.6, 90, 0.1, 0.1); }),
  punch: (A) => go(A, (t) => { ring(A, t, 1400, 0.06, 0.08, [1, 2.2]); hiss(A, t, 0.03, 2400, 2, 0.18); hiss(A, t + J(0.25, 0.4), 0.12, 3000, 1.2, 0.08, 'bandpass', 2000); }),
  jhola: (A) => go(A, (t) => { hiss(A, t, J(0.18, 0.3), J(900, 1400), 0.6, 0.06, 'bandpass', J(500, 800)); if (R() < 0.6) hiss(A, t + J(0.12, 0.2), 0.12, 1800, 0.8, 0.04); }),
  // eating: a bite (a crunch for the crisp ones), a sip or a slurp, and a swallow
  bite: (A, crisp) => go(A, (t) => {
    const n = crisp ? 6 + Math.floor(R()*4) : 2 + Math.floor(R()*2);
    let c = t; for (let k = 0; k < n; k++) { hiss(A, c, J(0.008, 0.02), J(crisp ? 2200 : 900, crisp ? 5200 : 2200), 1.5, J(0.04, 0.09)); c += J(0.008, 0.03); }
    for (let k = 0; k < 3; k++) hiss(A, t + 0.35 + k*J(0.3, 0.42), 0.12, 500, 0.8, 0.03, 'lowpass');                     // chewing
  }),
  sip: (A, hot) => go(A, (t) => {
    if (hot) hiss(A, t, J(0.22, 0.35), 900, 2, 0.08, 'bandpass', 2200); else hiss(A, t, 0.2, 700, 1.2, 0.04, 'lowpass');
    const s = t + J(0.45, 0.6); tone(A, s, 200, 0.09, 0.07, 'sine', 85); hiss(A, s, 0.06, 300, 1, 0.04, 'lowpass');
  }),
  spoon: (A) => go(A, (t) => ring(A, t, J(3600, 4400), 0.15, 0.03, [1, 2.7])),
};
const AU = () => window.__nhAskG && window.__nhAskG.audio;

// the headlight stalk and the torch's switch, in place of the plain beep
const toggle = Lights.prototype.toggle;
Lights.prototype.toggle = function (...a) {
  const A = this.g.audio, b = A && A.blip, onFoot = this.g.player.onFoot;
  if (A) A.blip = () => onFoot ? SFX.torch(A, !this.torchOn) : SFX.stalk(A);
  try { return toggle.apply(this, a); } finally { if (A) A.blip = b; }
};
const setTorch = Lights.prototype.setTorch;
Lights.prototype.setTorch = function (on, ...a) {
  const A = this.g.audio, b = A && A.blip;
  if (A && A.blip === b) A.blip = () => SFX.torch(A, !!on);
  try { return setTorch.call(this, on, ...a); } finally { if (A) A.blip = b; }
};
// the drive mode knob (after dash.js has turned it)
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyO' || e.repeat) return;
  const G = window.__nhAskG, P = G && G.player, v = P && !P.onFoot && P.cur; if (!v || G.state !== 'play') return;
  const H = v._has; if (!H || !H.modes) return;
  setTimeout(() => SFX.detent(G.audio, v.driveMode || 0, H.modes.length), 0);
});
// out of the waistband, and the empty click
const equip = Arms.prototype.equip;
Arms.prototype.equip = function (id, ...a) {
  const was = this.held, r = equip.call(this, id, ...a);
  const W = this.held && ARMS[this.held];
  if (this.held !== was && this.held !== 'torch') SFX.draw(this.g.audio, this.held, !!(W && W.gun), !!(W && W.cut));
  return r;
};
const use = Arms.prototype.use;
Arms.prototype.use = function (...a) {
  const A = this.g.audio, s = this.life && this.life.s, n0 = s ? s.ammo : 0, b = A && A.blip;
  if (A) A.blip = () => SFX.dry(A);
  let r; try { r = use.apply(this, a); } finally { if (A) A.blip = b; }
  if (s && s.ammo < n0) SFX.shot(A);
  return r;
};
// paying
let PAY = null, AMT = 0;
Audio.prototype.cash = function () {
  if (PAY === 'metro') return SFX.metro(this);
  if (PAY === 'bus') return SFX.punch(this);
  if (AMT > 0 && AMT <= 20) return SFX.coins(this);
  if (AMT > 20 && R() < 0.35) return SFX.upi(this);
  if (AMT > 20) { SFX.notes(this); if (R() < 0.4) setTimeout(() => SFX.coins(this), 260); return; }
  SFX.notes(this);
};
const spend = Shops.prototype.spend;
Shops.prototype.spend = function (price, ...a) { const w = AMT; AMT = price || 0; try { return spend.call(this, price, ...a); } finally { AMT = w; } };
const travel = Transit.prototype.travel;
Transit.prototype.travel = function (to, fare, minutes, what, ...a) {
  const w = PAY; PAY = /^bus/i.test(what || '') ? 'bus' : 'metro';
  try { return travel.call(this, to, fare, minutes, what, ...a); } finally { PAY = w; }
};
// into the jhola
const add = Life.prototype.add;
Life.prototype.add = function (...a) { const G = window.__nhAskG; if (G && G.state === 'play' && G.life === this) SFX.jhola(AU()); return add.apply(this, a); };
