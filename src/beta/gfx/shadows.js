// /beta's sun shadows, its own: one map of what stands still (the city and its trees), drawn only when you've walked far
// enough or the sun has moved, and each frame a copy of it with just what moves (people, vehicles, animals) drawn on
// top. Everything draws into them with the plainest shader that holds its shape; what has one of its own (leaves with
// their holes, people on their bones) sets it as customDepthMaterial, as it would for three.
import * as THREE from 'three';
import { PU } from './paint.js';

const STILL = 6, MOVES = 7, FAR = 700, STEP = 24;
const STILL_ROOT = /^(chunk|landmark|hills)/;
const VS = `#include <common>
#include <skinning_pars_vertex>
void main(){ vec3 transformed = vec3(position);
#include <skinbase_vertex>
#include <skinning_vertex>
  vec4 p = vec4(transformed, 1.);
#ifdef USE_INSTANCING
  p = instanceMatrix*p;
#endif
  gl_Position = projectionMatrix*modelViewMatrix*p; }`;
const SIDES = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
const BIAS = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
const v = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3();

function target(size, compare) {
  const d = new THREE.DepthTexture(size, size, THREE.UnsignedIntType); d.minFilter = d.magFilter = compare ? THREE.LinearFilter : THREE.NearestFilter; if (compare) d.compareFunction = THREE.LessEqualCompare;
  return new THREE.WebGLRenderTarget(size, size, { format: THREE.RedFormat, depthTexture: d, depthBuffer: true, generateMipmaps: false });
}

export class Shadows {
  constructor(renderer, scene, sky, size) {
    this.R = renderer; this.scene = scene; this.sky = sky; this.on = true; this.size = size; this.dirty = true; this.still = []; this.moving = []; this.mats = new Map(); this.frame = 0; this.seen = 0;
    this.stage = new THREE.Scene(); this.stage.children = scene.children; this.stage.matrixWorldAutoUpdate = false;   // (the same things, without the lights)
    scene.matrixWorldAutoUpdate = false;                  // (render() brings them up to date, once a frame)
    this.half = 95; this.cam = new THREE.OrthographicCamera(-95, 95, 95, -95, 1, FAR);
    this.c = new THREE.Vector3(1e9, 0, 1e9); this.sd = new THREE.Vector3(0, 1, 0); this.M = new THREE.Matrix4();
  }
  set(on, size) { this.on = on; if (size !== this.size) { this.size = size; this.free(); } this.dirty = true; }
  reach(h) { if (h === this.half) return; this.half = h; const C = this.cam; C.left = C.bottom = -h; C.right = C.top = h; C.updateProjectionMatrix(); this.dirty = true; }
  free() { if (this.a) { for (const t of [this.a, this.b]) { t.depthTexture.dispose(); t.dispose(); } this.a = this.b = null; } }
  depth(m) {
    if (m.customDepthMaterial) return m.customDepthMaterial;
    const f = Array.isArray(m.material) ? m.material[0] : m.material, side = SIDES[f.side], inst = !!m.isInstancedMesh, ic = !!(inst && m.instanceColor), k = side*8 + (inst ? 1 : 0) + (ic ? 2 : 0) + (m.isSkinnedMesh ? 4 : 0);
    let d = this.mats.get(k); if (!d) { d = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: 'void main(){}', side, colorWrite: false, toneMapped: false, fog: false }); this.mats.set(k, d); } return d;
  }
  // who casts, walking only what's being shown. Tree meshes are in the list of still things by their tag
  walk(o, list) {
    if (!o.visible) return;
    if (o.isMesh && o.castShadow && (o.shadowOnly || (o.layers.isEnabled(0) && !o.layers.isEnabled(5))) && o.material && (Array.isArray(o.material) || o.material.visible)) {
      // (one thing somewhere: left out when it's nowhere near the map. Instances and people hold their own places)
      const e = o.matrixWorld.elements; if (o.isInstancedMesh || o.customDepthMaterial || (Math.abs(e[12] - this.c.x) < this.half + 15 && Math.abs(e[14] - this.c.z) < this.half + 15)) list.push(o);
    }
    const c = o.children; for (let i = 0; i < c.length; i++) this.walk(c[i], list);
  }
  draw(list, layer, rt) {
    const R = this.R, cam = this.cam; cam.layers.set(layer);
    for (let i = 0; i < list.length; i++) { const m = list[i]; m._real = m.material; m.material = this.depth(m); m.layers.enable(layer); }
    const was = R.autoClear; R.autoClear = false; R.setRenderTarget(rt); if (layer === STILL) R.clear(false, true, false);
    R.render(this.stage, cam);
    R.autoClear = was;
    for (let i = 0; i < list.length; i++) { const m = list[i]; m.material = m._real; m._real = null; m.layers.disable(layer); }
  }
  isStill(c) { return STILL_ROOT.test(c.name) || c.shadowStill; }
  // (called once a frame just before the picture; it leaves the render target for the caller to set)
  render(focus, forward) {
    this.scene.updateMatrixWorld();
    if (!this.on || !this.sky.state) { PU.shadowOn.value = 0; return; }
    const R = this.R, S = this.scene, kids = S.children, ld = this.sky.state.lightDir;
    if (!this.a) { this.a = target(this.size, false); this.b = target(this.size, true); this.dirty = true; R.initRenderTarget(this.a); R.initRenderTarget(this.b); }
    const list = this.moving; list.length = 0;
    for (let i = 0; i < kids.length; i++) if (!this.isStill(kids[i])) this.walk(kids[i], list);
    if (++this.frame%30 === 0) { let n = 0; const t = []; for (const c of kids) if (this.isStill(c)) this.walk(c, t), n += t.length, t.length = 0; if (n !== this.seen) { this.seen = n; this.dirty = true; } }
    const fx = focus.x + forward.x*25, fz = focus.z + forward.z*25;
    if (Math.hypot(fx - this.c.x, fz - this.c.z) > STEP || this.sd.dot(ld) < .999985) this.dirty = true;
    if (this.dirty) {
      this.dirty = false; this.sd.copy(ld); this.c.set(fx, focus.y || 0, fz);
      const C = this.cam; C.position.copy(this.c).addScaledVector(this.sd, 220); C.lookAt(this.c); C.updateMatrixWorld();
      // onto the map's own grid, so its pixels never slide under the shadows from one drawing to the next
      const e = C.matrixWorld.elements, tx = 2*this.half/this.size; r.set(e[0], e[1], e[2]); u.set(e[4], e[5], e[6]);
      const a = C.position.dot(r), b = C.position.dot(u); C.position.addScaledVector(r, Math.round(a/tx)*tx - a).addScaledVector(u, Math.round(b/tx)*tx - b); C.updateMatrixWorld(); C.matrixWorldInverse.copy(C.matrixWorld).invert();
      this.M.copy(BIAS).multiply(C.projectionMatrix).multiply(C.matrixWorldInverse);
      const still = this.still; still.length = 0;
      for (let i = 0; i < kids.length; i++) if (this.isStill(kids[i])) this.walk(kids[i], still);
      this.draw(still, STILL, this.a); this.draws = still.length; this.count = (this.count || 0) + 1;
    }
    R.copyTextureToTexture(this.a.depthTexture, this.b.depthTexture);
    if (list.length) this.draw(list, MOVES, this.b);
    PU.shadowTex.value = this.b.depthTexture; PU.shadowMat.value = this.M; PU.shadowTexel.value = 1/this.size; PU.shadowOn.value = 1;
  }
}
