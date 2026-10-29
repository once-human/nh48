// Blood on the road: a dark, irregular pool that spreads under someone badly hurt (slowly, then stops), stays a few
// minutes after they've been taken away, then dries and fades. A small pool of decals, reused.
import * as THREE from 'three';

const N = 14;
export class Blood {
  constructor(scene, W) {
    this.W = W; this.list = []; this.k = 0;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a0303, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    for (let i = 0; i < N; i++) {
      // an irregular blob, not a circle
      const pts = [], n = 18;
      for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, r = 0.75 + Math.random() * 0.35 + (j % 5 === 0 ? 0.25 : 0); pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts)); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat.clone()); m.visible = false; m.receiveShadow = true; m.renderOrder = 1;
      scene.add(m);
      this.list.push({ m, t: 0, r: 0, max: 0, life: 0, x: 0, z: 0 });
    }
  }
  // size: the pool it grows to (m); grow: seconds to reach it
  spill(x, z, size = 0.6, grow = 25) {
    const b = this.list[this.k = (this.k + 1) % N];
    b.x = x; b.z = z; b.t = 0; b.max = size; b.grow = grow; b.life = 240 + Math.random() * 60;
    b.m.position.set(x, this.W.surf.height(x, z) + 0.012, z); b.m.rotation.y = Math.random() * 6.28; b.m.scale.setScalar(0.05); b.m.visible = true;
    return b;
  }
  update(dt) {
    for (const b of this.list) {
      if (!b.m.visible) continue;
      b.t += dt;
      const s = b.max * Math.min(1, Math.sqrt(b.t / b.grow));
      b.m.scale.setScalar(Math.max(0.05, s));
      // fresh and wet, then darker and drier, then gone
      const fade = b.t > b.life - 40 ? Math.max(0, (b.life - b.t) / 40) : 1;
      b.m.material.opacity = 0.88 * fade; b.m.material.roughness = b.t > 90 ? 0.7 : 0.25;
      if (b.t >= b.life) b.m.visible = false;
    }
  }
}
