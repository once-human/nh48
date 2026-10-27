// Your lights. L switches the headlight of whatever you're driving (it comes on by itself at dusk until
// you touch it, and stays the way you left it after that), and on foot it switches the torch from your
// jhola: a cone from your chest, forward. The torch can be lost (beaten up, arrested): buy another at a
// kirana or an electronics shop. Both lights live in the scene from the start (intensity 0 when off),
// so switching never recompiles a shader.
import * as THREE from 'three';
import { keyLabel } from './keys.js';

export class Lights {
  constructor(G) {
    this.g = G;
    this.head = null;            // null: automatic (on at night), true / false: your choice
    this.torchOn = false;
    const t = this.torch = new THREE.SpotLight(0xfff0d6, 0, 26, 0.42, 0.55, 1.4);
    t.castShadow = false;
    G.scene.add(t, t.target);
    const el = document.createElement('div');
    el.className = 'lamp-ind'; el.hidden = true;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    this._ind = '';
  }
  hasTorch() { return this.g.life.has('torch'); }
  headOn(night) { return this.head === null ? night > 0.2 : this.head; }
  // L: headlight in a vehicle, the torch on foot
  toggle() {
    const G = this.g, P = G.player;
    if (!P.onFoot) {
      const night = G.sky.state ? G.sky.state.night : 0;
      this.head = !this.headOn(night);
      G.hud.toast(this.head ? 'Headlight on' : 'Headlight off', '', 'info', 1.2);
      G.audio.blip?.();
      return;
    }
    this.setTorch(!this.torchOn);
  }
  setTorch(on) {
    const G = this.g;
    if (on && !this.hasTorch()) { G.hud.toast('No torch', 'A kirana or an electronics shop sells one', 'info', 2.2); this.torchOn = false; return 'No torch in your jhola'; }
    this.torchOn = !!on;
    G.audio.blip?.();
    return this.torchOn ? 'Torch on' : 'Torch off';
  }
  // the torch is gone (beaten, robbed, taken at the chowki)
  lose(why) {
    const G = this.g;
    if (!G.life.take('torch')) return;
    this.torchOn = false;
    G.hud.toast('Your torch is gone', why || 'Buy another at a kirana', 'bad', 3);
  }
  update(dt, night) {
    const G = this.g, P = G.player;
    // headlight of whatever you drive (one shared light, see Pilot.switchTo)
    const hl = P.headlight;
    if (hl) hl.intensity = !P.onFoot && this.headOn(night) ? 24 * Math.max(night, 0.35) : 0;
    // torch: chest high, pointing where you face
    const t = this.torch, on = this.torchOn && P.onFoot && this.hasTorch();
    if (this.torchOn && !this.hasTorch()) this.torchOn = false;
    t.intensity = on ? 9 + night * 9 : 0;
    if (on) {
      const F = P.foot, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw), y = (F.y || 0) + 1.25;
      t.position.set(F.x + fx * 0.3, y, F.z + fz * 0.3);
      t.target.position.set(F.x + fx * 9, y - 1.6, F.z + fz * 9);
      t.target.updateMatrixWorld();
    }
    // the HUD chip
    const ind = !P.onFoot ? (this.headOn(night) ? 'head' : '') : on ? 'torch' : '';
    if (ind !== this._ind) {
      this._ind = ind;
      this.el.hidden = !ind;
      this.el.innerHTML = ind === 'head'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6c-4 0-6 2.7-6 6s2 6 6 6h2V6z"/><path d="M15 8h6M15 12h6M15 16h6"/></svg><span>Lights</span><span class="kbd">' + keyLabel('L') + '</span>'
        : ind === 'torch' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l-2 6H9z"/><path d="M9 9h6v12H9z"/><path d="M12 13v2"/></svg><span>Torch</span><span class="kbd">' + keyLabel('L') + '</span>' : '';
    }
  }
}
