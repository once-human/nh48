// Your lights. L switches the headlight of whatever you're driving (it comes on by itself at dusk until
// you touch it, and stays the way you left it after that), and on foot it switches the torch from your
// jhola: a cone from your chest, forward. The torch can be lost (beaten up, arrested): buy another at a
// kirana or an electronics shop. Both lights live in the scene from the start (intensity 0 when off),
// so switching never recompiles a shader.
import * as THREE from 'three';
import { ikArm } from '../people/humans.js';
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
    // in the bottom-centre stack, above the F prompt, so it never sits on top of anything
    const low = G.hud && G.hud.lower;
    if (low) low.prepend(el); else (document.getElementById('hud') || document.body).appendChild(el);
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
  // a real torch in your right hand while it's on, the arm raised to point it where you look
  torchMesh(on) {
    const P = this.g.player, H = P.human;
    if (!H) return;
    if (!this.tm) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5, metalness: 0.4 }));
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.022, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x2a2a2d, roughness: 0.4, metalness: 0.6 }));
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
      body.rotation.x = Math.PI / 2; head.rotation.x = Math.PI / 2; head.position.z = 0.12; lens.position.z = 0.152;
      g.add(body, head, lens); this.tm = g; this.tmLens = lens;
    }
    const hand = H.root.getObjectByName('hand_r');
    if (hand && this.tm.parent !== hand) { hand.add(this.tm); this.tm.position.set(0, 0.06, 0.04); this.tm.scale.setScalar(1 / (H.root.scale.x || 1)); }
    this.tm.visible = !!on && P.onFoot;
    this.tmLens.material.color.setHex(on ? 0xfff2d0 : 0x333333);
    if (!on || !P.onFoot) { P.torchArm = null; return; }
    // raise the arm toward the look direction (after the walk cycle has posed the body)
    const C = this.g.camera, dir = this._dir2 || (this._dir2 = new THREE.Vector3()), tgt = this._tg || (this._tg = new THREE.Vector3()), pole = this._po || (this._po = new THREE.Vector3());
    P.torchArm = (H2) => {
      C.getWorldDirection(dir);
      const F = P.foot, sh = H2.root.getObjectByName('upperarm_r'); if (!sh) return;
      sh.getWorldPosition(tgt);
      const flat = Math.hypot(dir.x, dir.z) || 1, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
      // only in front of you: the arm can't point behind your back (your head and body turn for that)
      if ((dir.x * fx + dir.z * fz) / flat < -0.1) { dir.set(fx, dir.y, fz); }
      tgt.addScaledVector(dir, 0.55); tgt.y -= 0.12;
      pole.set(-fz, -0.8, fx).normalize();
      ikArm(H2, 'r', tgt, pole, 0.85);
      this.tm.lookAt(tgt.x + dir.x * 5, tgt.y + dir.y * 5, tgt.z + dir.z * 5);
    };
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
    this.torchMesh(on);
    if (on) {
      // the beam comes out of the torch in your hand and goes where you look (the camera), not just where you face
      const C = G.camera, dir = this._dir || (this._dir = new THREE.Vector3()), hp = this._hp || (this._hp = new THREE.Vector3());
      C.getWorldDirection(dir);
      if (this.tm && this.tm.parent) this.tm.getWorldPosition(hp); else { const F = P.foot; hp.set(F.x, (F.y || 0) + 1.25, F.z); }
      t.position.copy(hp);
      t.target.position.set(hp.x + dir.x * 10, hp.y + dir.y * 10 - 0.8, hp.z + dir.z * 10);
      t.target.updateMatrixWorld();
    }
    // the HUD chip
    // only the torch gets a chip (on foot, while it's on); everyone knows how their headlights work
    const ind = P.onFoot && on && !G.interiors?.inside ? 'torch' : '';
    if (ind !== this._ind) {
      this._ind = ind;
      this.el.hidden = !ind;
      this.el.innerHTML = ind === 'head'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6c-4 0-6 2.7-6 6s2 6 6 6h2V6z"/><path d="M15 8h6M15 12h6M15 16h6"/></svg><span>Lights</span><span class="kbd">' + keyLabel('L') + '</span>'
        : ind === 'torch' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l-2 6H9z"/><path d="M9 9h6v12H9z"/><path d="M12 13v2"/></svg><span>Torch</span><span class="kbd">' + keyLabel('L') + '</span>' : '';
    }
  }
}
