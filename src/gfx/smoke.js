// Smoke, fire and the odd explosion: a small pool of soft sprites (no textures to load), shared by everything
// that burns. Damaged engines trail grey smoke, wrecks pour black smoke with flames, a blast is a fireball, a
// flash and a rolling cloud.
import * as THREE from 'three';

function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Smoke {
  constructor(scene, n = 160) {
    const tex = puffTexture();
    this.scene = scene;
    this.list = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: 0x777777, fog: true });
      const s = new THREE.Sprite(m); s.visible = false;        // in the scene only while it's a live puff
      this.list.push({ s, m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size0: 1, size1: 2, op: 0.5, fire: false });
    }
    this.k = 0;
    this.light = new THREE.PointLight(0xffa040, 0, 40, 2); scene.add(this.light); this.flash = 0;
  }
  // kind: 'smoke' (grey), 'black', 'fire'
  emit(x, y, z, kind = 'smoke', spread = 0.3) {
    const p = this.list[this.k = (this.k + 1) % this.list.length], R = Math.random;
    const fire = kind === 'fire';
    p.s.position.set(x + (R() - 0.5) * spread, y, z + (R() - 0.5) * spread);
    p.vx = (R() - 0.5) * 0.6; p.vz = (R() - 0.5) * 0.6; p.vy = fire ? 1.8 + R() * 1.2 : 0.9 + R() * 0.8;
    p.life = 0; p.max = fire ? 0.45 + R() * 0.35 : kind === 'black' ? 2.6 + R() * 1.6 : 1.6 + R() * 1.0;
    p.size0 = fire ? 0.5 + R() * 0.4 : 0.5 + R() * 0.3; p.size1 = fire ? 0.2 : kind === 'black' ? 3.4 + R() * 1.5 : 2.2 + R();
    p.op = fire ? 0.95 : kind === 'black' ? 0.75 : 0.45;
    p.fire = fire;
    p.m.color.setHex(fire ? (R() < 0.5 ? 0xffa53a : 0xff6a1a) : kind === 'black' ? 0x1b1b1b : 0x8a8a88);
    p.m.blending = fire ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.s.visible = true; if (!p.s.parent) this.scene.add(p.s);
  }
  explode(x, y, z) {
    for (let i = 0; i < 46; i++) this.emit(x, y + Math.random() * 1.2, z, 'fire', 2.6);
    for (let i = 0; i < 40; i++) this.emit(x, y + 0.5 + Math.random(), z, 'black', 2.2);
    this.light.position.set(x, y + 2, z); this.flash = 1;
  }
  update(dt) {
    for (const p of this.list) {
      if (!p.s.visible) continue;
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) { p.s.visible = false; p.m.opacity = 0; this.scene.remove(p.s); continue; }
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.vy *= p.fire ? 1 : 0.995;
      const sz = p.size0 + (p.size1 - p.size0) * Math.sqrt(t);
      p.s.scale.set(sz, sz, 1);
      p.m.opacity = p.op * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
    }
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 1.6); this.light.intensity = this.flash * 600; }
  }
}
