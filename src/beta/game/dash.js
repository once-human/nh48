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

// the squeal: a resonant band of tyre noise and a thin tone inside it, always running, its level and pitch following the slide
Audio.prototype.squeal = function (level, sp, slip) {
  const ctx = this.ctx; if (!ctx || !this.noise || (level <= 0.05 && !this._sqOn)) return;
  this._sqOn = level > 0.05;
  if (!this._sq) {
    const nz = ctx.createBufferSource(); nz.buffer = this.noise; nz.loop = true;
    const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    a.type = 'bandpass'; a.Q.value = 9; b.type = 'bandpass'; b.Q.value = 6; o.type = 'triangle'; og.gain.value = 0.035; g.gain.value = 0; lfo.frequency.value = 17; lg.gain.value = 26;
    nz.connect(a).connect(g); nz.connect(b).connect(g); o.connect(og).connect(g); lfo.connect(lg).connect(o.frequency);
    g.connect(this.bus('traffic')); nz.start(); o.start(); lfo.start();
    this._sq = { a, b, g, o };
  }
  const t = ctx.currentTime, Q = this._sq, f = 980 + 620*Math.min(1, (slip || 0) + level*0.5) + Math.min(260, sp*6);
  Q.a.frequency.setTargetAtTime(f, t, 0.08); Q.b.frequency.setTargetAtTime(f*1.62, t, 0.08); Q.o.frequency.setTargetAtTime(f, t, 0.08);
  // (it dies away by itself if nobody says otherwise: you got out, you paused)
  const G = Q.g.gain; G.cancelScheduledValues(t); G.setTargetAtTime(level > 0.05 ? (0.05 + 0.2*level)*Math.min(1, sp/14) : 0, t, level > 0.05 ? 0.05 : 0.14); G.setTargetAtTime(0, t + 0.25, 0.14);
};
