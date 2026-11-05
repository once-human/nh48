// Street furniture (lamps, poles, signals, the stalls' near and far models) fades in and out at the edge of its range
// instead of popping. The game re-culls each set every 6 m you move and anything past the line simply wasn't there,
// so a row of lamp posts appeared a few at a time as you drove, and a stall changed model in a blink at 60 m. Now each
// set takes in everything a little past its range (more than one re-cull's worth) and its shader thins it out over the
// last stretch by distance from the camera, pixel by pixel; where a near model hands over to a far one the far one
// fills in exactly the pixels the near one leaves (beta/gfx/paint.js DITHER), so nothing doubles or goes missing.
import * as THREE from 'three';
import { InstancedSet } from '@orig/world/props.js';

const MARGIN = 9;          // (more than the 6 m between re-culls)
const band = (r) => Math.min(14, Math.max(4, r*0.12));
// a set's own copy of its material, with the fade: the game's stock ones go through beta/gfx/repaint.js (FADE); the
// vehicles' (parked rows) are /beta's own shader (beta/vehicles/vehmat.js), copied with every uniform still shared
function fadeOf(src, U) {
  if (src.isShaderMaterial) {
    const c = new THREE.ShaderMaterial({ vertexShader: src.vertexShader, fragmentShader: src.fragmentShader, uniforms: Object.assign({}, src.uniforms, { uFade: U }), defines: Object.assign({}, src.defines, { FADE: '' }),
      vertexColors: src.vertexColors, side: src.side, transparent: src.transparent, depthWrite: src.depthWrite, blending: src.blending });
    c.onBeforeRender = src.onBeforeRender; c.color = src.color; c.roughness = src.roughness; c.metalness = src.metalness;
    return c;
  }
  const c = src.clone(), key = src.customProgramCacheKey ? src.customProgramCacheKey() : '';
  c._fadeU = U; c.customProgramCacheKey = () => key + '|fade';
  return c;
}
const upd = InstancedSet.prototype.update;
InstancedSet.prototype.update = function (cx, cz, fr) {
  const M = this.mesh;
  if (!this._fadeU && M.material && !Array.isArray(M.material)) { this._fadeU = { value: new THREE.Vector4() }; M.material = fadeOf(M.material, this._fadeU); }
  const r = this.range, m = this.minRange;
  if (this._fadeU) this._fadeU.value.set(m > 0 ? m : 0, band(m || 60), r, r > 5000 ? 1 : band(r));
  this.range = r + MARGIN; this.minRange = m > 0 ? Math.max(0, m - band(m) - MARGIN) : 0;
  try { return upd.call(this, cx, cz, fr); } finally { this.range = r; this.minRange = m; }
};
