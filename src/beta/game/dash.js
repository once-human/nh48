// The car's own lights on the speedometer: only what this vehicle really has. ABS (lit, pulsing while it works), TCS, its
// drive mode (O changes it), the handbrake and the headlights. A WagonR shows no ABS, a cycle shows nothing at all. And
// the sound of rubber: one continuous squeal following how hard the tyres are sliding, not a train of pops.
import { HUD } from '@orig/ui/hud.js';
import { Audio } from '@orig/game/audio.js';
import { has } from '../vehicles/brakes.js';

const upd = HUD.prototype.update;
HUD.prototype.update = function (dt) {
  const r = upd.call(this, dt);
  const G = this.game, P = G && G.player; if (!P || !this.dash) return r;
  if (!this._sys) {
    const el = document.createElement('div'); el.className = 'sys'; el.id = 'h-sys';
    el.innerHTML = '<span data-k="abs">ABS</span><span data-k="tcs">TCS</span><span data-k="mode"></span><span data-k="hb" class="red">P</span><span data-k="lt">LIGHTS</span>';
    const rpm = this.dash.querySelector('.rpm'); rpm ? rpm.after(el) : this.dash.appendChild(el);
    this._sys = {}; for (const c of el.children) this._sys[c.dataset.k] = c; this._sysEl = el;
  }
  const v = !P.onFoot && P.cur, S = v && v.spec, C = this._sys;
  if (!v || !S || S.name === 'Bicycle') { this._sysEl.hidden = true; return r; }
  this._sysEl.hidden = false;
  const H = v._has || (v._has = has(v.type)), set = (c, show, on) => { if (c._s !== show) { c._s = show; c.hidden = !show; } if (c._o !== on) { c._o = on; c.classList.toggle('on', !!on); } };
  set(C.abs, H.abs, v.absOn); set(C.tcs, H.tcs, v.tcsOn);
  const m = H.modes ? H.modes[v.driveMode || 0] : '';
  if (C.mode._t !== m) { C.mode._t = m; C.mode.textContent = m; }
  set(C.mode, !!m, false);
  set(C.hb, true, v.hbOn); set(C.lt, true, P.headlight && P.headlight.intensity > 0);
  return r;
};
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyO' || e.repeat) return;
  const G = window.__nhAskG, P = G && G.player, v = P && !P.onFoot && P.cur; if (!v || G.state !== 'play') return;
  const H = v._has || (v._has = has(v.type)); if (!H.modes) return;
  v.driveMode = ((v.driveMode || 0) + 1) % H.modes.length; G.hud.toast?.('Drive mode', H.modes[v.driveMode], 'info', 1.2);
});

// the squeal: tyre noise through two narrow bands with a thin tone inside, always running, its level and pitch following
// the slide. Each vehicle's own: narrow tyres sing high, a supercar's wide ones low and throaty, a bus groans; worn ones
// are dull and each set is a little off from the next. Never steady: rubber sticks and lets go, so it flutters. On dirt
// there's no singing at all, only scrub.
const tyreOf = (v) => {
  if (v._ty) return v._ty;
  const S = v.spec, w = v._es2 ?? (v._es2 = Math.random());
  const size = Math.max(0, Math.min(1, (S.W - 0.6)/1.4)), heavy = S.mass > 5000 ? 0.45 : 1;
  return (v._ty = { f: (1500 - 640*size)*heavy*(0.9 + w*0.2), q: 5 + w*5, tone: S.name === 'Bicycle' ? 0.008 : 0.02 + 0.03*(1 - w), lv: S.name === 'Bicycle' ? 0.25 : S.two ? 0.6 : 1 });
};
Audio.prototype.squeal = function (level, sp, slip, v) {
  const ctx = this.ctx; if (!ctx || !this.noise || (level <= 0.05 && !this._sqOn)) return;
  this._sqOn = level > 0.05;
  if (!this._sq) {
    const nz = ctx.createBufferSource(); nz.buffer = this.noise; nz.loop = true;
    const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    a.type = 'bandpass'; b.type = 'bandpass'; o.type = 'triangle'; og.gain.value = 0.03; g.gain.value = 0; lfo.frequency.value = 17; lg.gain.value = 26;
    nz.connect(a).connect(g); nz.connect(b).connect(g); o.connect(og).connect(g); lfo.connect(lg).connect(o.frequency);
    g.connect(this.bus('traffic')); nz.start(); o.start(); lfo.start();
    this._sq = { a, b, g, o, og, wob: 0 };
  }
  const t = ctx.currentTime, Q = this._sq, T = v ? tyreOf(v) : { f: 1100, q: 8, tone: 0.03, lv: 1 }, dirt = v && !v.W.surf.isRoad(v.x, v.z);
  // (a walk, not a wave: it wanders and jumps as the rubber grabs)
  Q.wob = Q.wob*0.93 + (Math.random() - 0.5)*0.11;
  const f = (T.f + 620*Math.min(1, (slip || 0) + level*0.5) + Math.min(240, sp*6))*(1 + Q.wob*0.25)*(dirt ? 0.35 : 1);
  Q.a.Q.setTargetAtTime(dirt ? 0.7 : T.q, t, 0.1); Q.b.Q.setTargetAtTime(dirt ? 0.5 : T.q*0.65, t, 0.1); Q.og.gain.setTargetAtTime(dirt ? 0 : T.tone, t, 0.1);
  Q.a.frequency.setTargetAtTime(f, t, 0.05); Q.b.frequency.setTargetAtTime(f*1.62, t, 0.05); Q.o.frequency.setTargetAtTime(f, t, 0.05);
  // (it dies away by itself if nobody says otherwise: you got out, you paused)
  const G = Q.g.gain; G.cancelScheduledValues(t);
  G.setTargetAtTime(level > 0.05 ? (0.05 + 0.2*level)*Math.min(1, sp/14)*T.lv*(1 + Q.wob*0.9) : 0, t, level > 0.05 ? 0.04 : 0.14); G.setTargetAtTime(0, t + 0.25, 0.14);
};
