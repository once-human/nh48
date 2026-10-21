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
  setSize(w, h) { this.renderer.setSize(w, h, false); if (this.rt) { this.rt.dispose(); this.rt = null; } }
  setExposure(e) { this.renderer.toneMappingExposure = e; this.exposure = e; }
  // drunk > 0.35: one extra full-screen pass for double vision and a soft blur (only while drunk)
  render() {
    const R = this.renderer, d = this.drunk || 0;
    if (d < 0.35) { R.render(this.scene, this.camera); return; }
    if (!this.rt) {
      const v = R.getDrawingBufferSize(new THREE.Vector2());
      this.rt = new THREE.WebGLRenderTarget(v.x, v.y, { type: THREE.HalfFloatType, samples: this.q && this.q.msaa ? 4 : 0 });
      if (!this.quad) {
        this.qmat = new THREE.ShaderMaterial({
          uniforms: { tex: { value: null }, uOff: { value: new THREE.Vector2() }, uAmt: { value: 0 }, uTime: { value: 0 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
          fragmentShader: `uniform sampler2D tex; uniform vec2 uOff; uniform float uAmt; uniform float uTime; varying vec2 vUv;
            void main(){
              vec2 c = vUv - 0.5; float r = dot(c, c);
              vec4 a = texture2D(tex, vUv);
              vec4 b = texture2D(tex, vUv + uOff);
              vec4 bl = (texture2D(tex, vUv + vec2(0.004, 0.)) + texture2D(tex, vUv - vec2(0.004, 0.)) + texture2D(tex, vUv + vec2(0., 0.004)) + texture2D(tex, vUv - vec2(0., 0.004))) * 0.25;
              vec4 col = mix(mix(a, bl, uAmt * 0.6), b, 0.38 * uAmt);
              col.rgb *= 1.0 - r * 1.4 * uAmt;
              gl_FragColor = vec4(col.rgb, 1.0);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
          depthTest: false, depthWrite: false, toneMapped: true,
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.qmat);
        this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
        this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      }
    }
    this.t = (this.t || 0) + 0.016;
    const k = Math.min(1, (d - 0.35) / 0.6);
    this.qmat.uniforms.uAmt.value = k;
    this.qmat.uniforms.uOff.value.set(Math.sin(this.t * 0.7) * 0.012 * k, Math.cos(this.t * 0.53) * 0.006 * k);
    this.qmat.uniforms.tex.value = this.rt.texture;
    R.setRenderTarget(this.rt); R.render(this.scene, this.camera);
    R.setRenderTarget(null); R.render(this.qscene, this.qcam);
  }
}
