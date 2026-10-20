// Final image: one direct render, no post-processing passes. Neutral tone mapping keeps colours as
// authored (clean and saturated, no grey film), antialiasing comes from the canvas (MSAA) on the
// presets that can afford it. No bloom, no vignette, no screen-space AO: they cost the most GPU time
// and were what made the city look washed out.
import * as THREE from 'three';

export class Post {
  constructor(renderer, scene, camera, q) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.q = q;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.exposure = 1;
  }
  setSize(w, h) { this.renderer.setSize(w, h, false); }
  setExposure(e) { this.renderer.toneMappingExposure = e; this.exposure = e; }
  render() { this.renderer.render(this.scene, this.camera); }
}
