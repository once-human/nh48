// Doing several things at once with the keys.
//  · Alt is "walk slowly", and in a browser on Windows letting go of Alt opens the window's menu bar: the page then
//    loses the keyboard until you press something else, so the next key you pressed (often the one you were already
//    holding) did nothing. While you're playing, Alt no longer reaches the browser.
//  · Sprint without Shift: tap forward twice and hold it, and you sprint until you let go. Many keyboards can't
//    report Shift + W + Space together (or Shift + W + A + Space): the third or fourth key is simply never sent, so a
//    jump while sprinting never arrived. Sprinting on forward alone leaves Space free.
import { Input } from '@orig/game/input.js';
import { guard } from './guard.js';

const playing = () => { const G = window.__nhAskG; return G && G.state === 'play' && !guard.on; };
for (const t of ['keydown', 'keyup']) window.addEventListener(t, (e) => { if ((e.code === 'AltLeft' || e.code === 'AltRight') && playing()) e.preventDefault(); });

const FWD = ['KeyW', 'ArrowUp'], RUN = 'ShiftLeft';
const key = Input.prototype.key, poll = Input.prototype.poll;
Input.prototype.poll = function (dt) {
  const G = window.__nhAskG, on = FWD.some(c => this.keys.has(c)), now = performance.now();
  if (on && !this._fwdWas) { if (now - (this._fwdUp || 0) < 260 && now - (this._fwdDn || 0) < 480 && G && G.player && G.player.onFoot) this._run = true; this._fwdDn = now; }
  if (!on) { if (this._fwdWas) this._fwdUp = now; this._run = false; }
  if (this._run && !(G && G.player && G.player.onFoot)) this._run = false;
  this._fwdWas = on;
  return poll.call(this, dt);
};
Input.prototype.key = function (...codes) { return key.apply(this, codes) || (this._run === true && codes.includes(RUN)); };
