// Final image: one direct render, no post-processing passes. Neutral tone mapping keeps colours as
// authored (clean and saturated, no grey film), antialiasing comes from the canvas (MSAA) on the
// presets that can afford it. No bloom, no vignette, no screen-space AO: they cost the most GPU time
// and were what made the city look washed out.
// Laptop graphics (q.fxaa): the canvas's 4x MSAA was a third of the whole frame there (every tree leaf and
// blade of grass written four times over), so the edges are smoothed after the frame instead, in the one
// pass that also tone-maps: only pixels on an edge are touched, so signs and textures stay as sharp.
import * as THREE from 'three';

export class Post {
  constructor(renderer, scene, camera, q) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.q = q;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.exposure = 1;
    this.fxaa = !!(q && q.fxaa);
  }
  setSize(w, h) { this.renderer.setSize(w, h, false); if (this.rt) { this.rt.dispose(); this.rt = null; } }
  setExposure(e) { this.renderer.toneMappingExposure = e; this.exposure = e; }
  // the picture the final pass reads. Flagged as an XR target so three tone-maps into it exactly as it does onto
  // the screen (lights and screens that skip tone mapping still do): the final pass only smooths and encodes
  target() {
    if (this.rt) return this.rt;
    const R = this.renderer, v = R.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(v.x, v.y, { type: THREE.HalfFloatType, samples: this.q && this.q.msaa ? 4 : 0, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.rt.isXRRenderTarget = true;
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.makeQuad();
    this.qmat.uniforms.uInv.value.set(1 / v.x, 1 / v.y);
    return this.rt;
  }
  makeQuad() {
    if (this.quad) return;
    this.qmat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, uOff: { value: new THREE.Vector2() }, uAmt: { value: 0 }, uInv: { value: new THREE.Vector2() }, uAA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `uniform sampler2D tex; uniform vec2 uOff; uniform float uAmt; uniform vec2 uInv; uniform float uAA; varying vec2 vUv;
        vec3 F(vec2 p) { return texture2D(tex, p).rgb; }
        // brightness roughly as the eye sees it (the picture is already tone-mapped, still linear)
        float L(vec3 c) { return sqrt(max(dot(c, vec3(0.299, 0.587, 0.114)), 0.0)); }
        vec3 fxaa(vec2 p) {
          vec3 m = F(p);
          vec3 nw = F(p + vec2(-1., -1.) * uInv), ne = F(p + vec2(1., -1.) * uInv), sw = F(p + vec2(-1., 1.) * uInv), se = F(p + vec2(1., 1.) * uInv);
          float lm = L(m), lnw = L(nw), lne = L(ne), lsw = L(sw), lse = L(se);
          float lo = min(lm, min(min(lnw, lne), min(lsw, lse))), hi = max(lm, max(max(lnw, lne), max(lsw, lse)));
          if (hi - lo < max(0.0312, hi * 0.125)) return m;          // not an edge: untouched
          vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), (lnw + lsw) - (lne + lse));
          float red = max((lnw + lne + lsw + lse) * 0.03125, 0.0078125);
          dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -8.0, 8.0) * uInv;
          vec3 a = 0.5 * (F(p + dir * (1.0 / 3.0 - 0.5)) + F(p + dir * (2.0 / 3.0 - 0.5)));
          vec3 b = a * 0.5 + 0.25 * (F(p - dir * 0.5) + F(p + dir * 0.5));
          float lb = L(b);
          return (lb < lo || lb > hi) ? a : b;
        }
        void main(){
          vec3 col = uAA > 0.5 ? fxaa(vUv) : F(vUv);
          if (uAmt > 0.0) {
            vec2 c = vUv - 0.5; float r = dot(c, c);
            vec3 b = F(vUv + uOff);
            vec3 bl = (F(vUv + vec2(0.004, 0.)) + F(vUv - vec2(0.004, 0.)) + F(vUv + vec2(0., 0.004)) + F(vUv - vec2(0., 0.004))) * 0.25;
            col = mix(mix(col, bl, uAmt * 0.6), b, 0.38 * uAmt);
            col *= 1.0 - r * 1.4 * uAmt;
          }
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.qmat);
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  // drunk > 0.35: double vision and a soft blur in the final pass (only while drunk)
  render() {
    const R = this.renderer, d = this.drunk || 0;
    if (d < 0.35 && !this.fxaa) { R.render(this.scene, this.camera); return; }
    const rt = this.target();
    const U = this.qmat.uniforms;
    if (d >= 0.35) {
      this.t = (this.t || 0) + 0.016;
      const k = Math.min(1, (d - 0.35) / 0.6);
      U.uAmt.value = k;
      U.uOff.value.set(Math.sin(this.t * 0.7) * 0.012 * k, Math.cos(this.t * 0.53) * 0.006 * k);
    } else U.uAmt.value = 0;
    U.uAA.value = this.fxaa ? 1 : 0;
    U.tex.value = rt.texture;
    R.setRenderTarget(rt); R.render(this.scene, this.camera);
    R.setRenderTarget(null); R.render(this.qscene, this.qcam);
  }
}
