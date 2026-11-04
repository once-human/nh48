// gfx/textures.js for /beta: all the game's own, but the dust along the kerbs is grey road dust (the game's sand colour
// glowed orange against the darker tar).
export * from '@orig/gfx/textures.js';
import { makeDecalTexture as gameDecals, DECAL } from '@orig/gfx/textures.js';

export function makeDecalTexture() {
  const d = gameDecals(), t = d.tex, c = t.image, x = c.getContext && c.getContext('2d');
  if (!x) return d;
  const C = 128, N = 4, ox = (DECAL.dust%N)*C, oy = Math.floor(DECAL.dust/N)*C, g = x.createLinearGradient(0, oy, 0, oy + C);
  g.addColorStop(0, 'rgba(112,108,100,0.42)'); g.addColorStop(.5, 'rgba(112,108,100,0.14)'); g.addColorStop(1, 'rgba(112,108,100,0)');
  x.clearRect(ox, oy, C, C); x.fillStyle = g; x.fillRect(ox, oy, C, C); t.needsUpdate = true;
  return d;
}
