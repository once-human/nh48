// Keyboard, gamepad and touch input folded into one smoothed control state.
import { clamp } from '../core/util.js';

export class Input {
  constructor(target) {
    this.keys = new Set();
    this.touch = { left: 0, right: 0, gas: 0, brake: 0, steer: null, horn: false };
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: false, horn: false };
    this.pressed = new Set();      // edge-triggered actions this frame
    this.steerKb = 0;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) { this.keys.add(e.code); return; }
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      // Ctrl is the roll key: stop Ctrl+S / D / A / F etc. doing browser things mid-fight (the browser
      // still owns Ctrl+W / T / N, which no page can block)
      if (e.ctrlKey && e.code.startsWith('Key') && !['KeyC', 'KeyV', 'KeyX', 'KeyR'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => this.keys.clear());
    this.gpPrev = {};
  }
  key(...codes) { return codes.some(c => this.keys.has(c)); }
  took(code) { return this.pressed.has(code); }
  poll(dt) {
    const k = this.key.bind(this);
    let thr = k('KeyW', 'ArrowUp') ? 1 : 0;
    let brk = k('KeyS', 'ArrowDown') ? 1 : 0;
    const left = k('KeyA', 'ArrowLeft'), right = k('KeyD', 'ArrowRight');
    // keyboard steering ramps so taps make small corrections
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    const rate = target === 0 ? 5 : (Math.sign(target) !== Math.sign(this.steerKb) ? 6 : 2.6);
    this.steerKb += clamp(target - this.steerKb, -rate * dt, rate * dt);
    let steer = this.steerKb;
    let hand = k('Space');
    let horn = k('KeyH');
    // touch
    const T = this.touch;
    if (T.gas) thr = Math.max(thr, T.gas);
    if (T.brake) brk = Math.max(brk, T.brake);
    if (T.steer !== null) steer = T.steer;
    else if (T.left || T.right) {
      this._tSteer = (this._tSteer || 0) + clamp((T.right - T.left) - (this._tSteer || 0), -2.4 * dt, 2.4 * dt);
      steer = this._tSteer;
    } else this._tSteer = 0;
    if (T.horn) horn = true;
    // gamepad (standard mapping)
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.12) steer = Math.sign(ax) * Math.pow((Math.abs(ax) - 0.12) / 0.88, 1.4);
      const rt = gp.buttons[7]?.value || 0, lt = gp.buttons[6]?.value || 0;
      thr = Math.max(thr, rt, gp.buttons[0]?.pressed && !this.pressAsHorn ? 0 : 0);
      brk = Math.max(brk, lt);
      if (gp.buttons[1]?.pressed) hand = true;
      if (gp.buttons[0]?.pressed) horn = true;
      const edge = (i, code) => { const p = !!gp.buttons[i]?.pressed; if (p && !this.gpPrev[i]) this.pressed.add(code); this.gpPrev[i] = p; };
      edge(3, 'KeyV'); edge(9, 'Escape'); edge(8, 'KeyM'); edge(2, 'KeyR');
      break;
    }
    if (!this.enabled) { thr = 0; brk = 0; steer = 0; hand = false; horn = false; }
    Object.assign(this.state, { throttle: thr, brake: brk, steer: clamp(steer, -1, 1), handbrake: hand, horn });
    return this.state;
  }
  endFrame() { this.pressed.clear(); }
}
