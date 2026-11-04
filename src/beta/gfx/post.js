// /beta's final picture: the frame is drawn into a picture of its own (with its depth), then one pass over it puts
// the experiment's sketch on top: ink lines from the depth, drawn twice like a quick sketch, and where colours
// change; the sky (the game's own dome) brushed on side to side; the paper it's painted on, grain, specks, torn at
// the edges. The game's drunk blur and double vision are in the same pass.
// Same face to the game as gfx/post.js: target(), setSize(), setExposure(), render(), .drunk, .fxaa (so the game's
// shader warm-ups draw into the same kind of picture the game does), .paint (the old "experimental graphics"
// switch, which /beta doesn't need: it's always painted).
import * as THREE from 'three';
import { PU } from './paint.js';

const VS = `in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const FS = `precision highp float; precision highp sampler2D;
in vec2 vUv; out vec4 o;
uniform sampler2D tCol, tDep, tNoise; uniform vec2 res; uniform float dpr, cnear, cfar, time, drunk, inkQ; uniform vec2 dOff;
float h12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
vec2 rot(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x+s*p.y,-s*p.x+c*p.y); }
float lum(vec3 c){ return dot(c,vec3(.3,.59,.11)); }
float nR(vec2 p){ return texture(tNoise, p*(1./16.)).r; }
float nG(vec2 p){ return texture(tNoise, p*(1./64.)).g; }
float fb2(vec2 p){ return nR(p)*.62 + nG(p*4.)*.38; }
float lz(vec2 uv){ float d = texture(tDep, uv).r; return cnear*cfar/(cfar - d*(cfar - cnear)); }
// the picture is tone-mapped and linear: as painted (sRGB) for the marks
vec3 enc(vec3 c){ c = max(c, vec3(0.)); return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
vec3 col(vec2 uv){ return enc(texture(tCol, uv).rgb); }
// how much the surface bends at uv: the second difference of 1/z (flat on flat things, whatever the angle)
float crease(vec2 uv, float r){ vec2 px = r/res; float z = lz(uv), l = lz(uv - vec2(px.x, 0.)), rr = lz(uv + vec2(px.x, 0.)), u = lz(uv + vec2(0., px.y)), d = lz(uv - vec2(0., px.y));
  float iz = 1./z; float e = (abs(1./l + 1./rr - 2.*iz) + abs(1./u + 1./d - 2.*iz))*z; return smoothstep(.012 + .0016*z, .03 + .0032*z, e); }
void main(){
  vec2 uv = vUv, px = 1./res, fp = gl_FragCoord.xy/dpr;
  vec2 wob = (vec2(nR(fp*.09), nR(fp*.09 + 9.)) - .5)*px*2.4*dpr;
  float d0 = texture(tDep, uv).r;
  bool sky = d0 >= .99999;
  vec3 c = col(uv + wob*.6);
  if (sky) c *= 1. + (nR(rot(fp, .35)/vec2(18., 1.6)) - .5)*.07;          // brushed on, side to side
  else {
    float z = lz(uv);
    float e = crease(uv + wob*.6, 1.*dpr), ec = 0.;
    if (inkQ >= 1. && z < 38.) {
      vec3 a = col(uv - vec2(px.x, 0.)*dpr), b = col(uv + vec2(px.x, 0.)*dpr), u2 = col(uv + vec2(0., px.y)*dpr), dd = col(uv - vec2(0., px.y)*dpr);
      ec = smoothstep(.13, .3, abs(lum(a) - lum(b)) + abs(lum(u2) - lum(dd)))*.5;
    }
    float brk = smoothstep(.2, .45, nR(fp*.05 + 2.));
    vec3 ink = mix(c*.4, vec3(.14, .12, .13), .6);
    float fade = 1. - smoothstep(35., inkQ >= 3. ? 220. : 140., z);
    c = mix(c, ink, max(e, ec*(1. - smoothstep(10., 38., z)))*(.5 + .4*brk)*fade);
    if (inkQ >= 2.) { vec2 w2 = (vec2(nR(fp*.035 + 20.), nR(fp*.035 + 31.)) - .5)*px*5.*dpr; float e2 = crease(uv + w2, .8*dpr); c = mix(c, ink, e2*.28*step(.5, nR(fp*.04 + 8.))*fade); }
  }
  if (drunk > 0.) {
    vec2 q = vUv - .5; float r = dot(q, q);
    vec3 bb = col(uv + dOff);
    vec3 bl = (col(uv + vec2(.004, 0.)) + col(uv - vec2(.004, 0.)) + col(uv + vec2(0., .004)) + col(uv - vec2(0., .004)))*.25;
    c = mix(mix(c, bl, drunk*.6), bb, .38*drunk);
    c *= 1. - r*1.4*drunk;
  }
  // poster paint: the colours a little stronger than life (the dull ones most), a little more contrast
  float cl = lum(c), cs = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(cl), c, 1.16 + .2*(1. - smoothstep(.0, .5, cs)));
  c = clamp(c, 0., 1.); c = mix(c, c*c*(3. - 2.*c), .32);
  // the paper
  float pap = fb2(fp*.35)*.8 + h12(floor(fp/1.5))*.2; c *= .955 + pap*.075;
  float speck = step(.995, h12(floor(fp/1.6) + 5.)); c = mix(c, c*.78, speck*.5);
  vec2 v = uv - .5; c *= 1. - dot(v, v)*.28;
  float asp = res.x/res.y, dd2 = min(min(uv.x, 1. - uv.x)*asp, min(uv.y, 1. - uv.y)); float rn = fb2(fp*.012)*.7 + nR(fp*.08)*.3;
  float m = smoothstep(0., .006, dd2 - .014 - (rn - .5)*.03);
  vec3 paper = vec3(.95, .925, .86)*(.97 + pap*.05);
  c = mix(paper, c, m);
  o = vec4(c, 1.);
}`;

export class Post {
  constructor(renderer, scene, camera, q, paint, sky) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.q = q; this.paintLook = paint; this.sky = sky;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.exposure = 1;
    this.fxaa = true;                       // (the game's warm-ups draw into target(), like the game does)
    this.paint = { on: false, set: async () => {}, setSize() {} };
    this.drunk = 0; this.t = 0;
    this.U = { tCol: { value: null }, tDep: { value: null }, tNoise: PU.tNoise, res: { value: new THREE.Vector2() }, dpr: { value: 1 }, cnear: { value: 0.1 }, cfar: { value: 1000 },
      time: { value: 0 }, drunk: { value: 0 }, inkQ: { value: 2 }, dOff: { value: new THREE.Vector2() } };
    this.mat = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.U, glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) { this.renderer.setSize(w, h, false); if (this.rt) { this.rt.depthTexture.dispose(); this.rt.dispose(); this.rt = null; } }
  setExposure(e) { this.renderer.toneMappingExposure = e; this.exposure = e; }
  // the picture the final pass reads. Flagged as an XR target so three tone-maps into it exactly as it would onto the
  // screen (the painted city writes the same way): the final pass inks and encodes
  target() {
    if (this.rt) return this.rt;
    const R = this.renderer, v = R.getDrawingBufferSize(new THREE.Vector2());
    const dt = new THREE.DepthTexture(v.x, v.y, THREE.UnsignedIntType); dt.minFilter = dt.magFilter = THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(v.x, v.y, { type: THREE.HalfFloatType, samples: (this.q && this.q.samples) || 0, depthTexture: dt, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rt.isXRRenderTarget = true;
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.U.tCol.value = this.rt.texture; this.U.tDep.value = dt; this.U.res.value.set(v.x, v.y);
    return this.rt;
  }
  render(dt = 0.016) {
    const R = this.renderer, cam = this.camera, U = this.U;
    if (this.beforeDraw) this.beforeDraw(dt || 0.016, cam);
    this.paintLook.update(this.sky, cam, this.scene);
    if (this.shadows) this.shadows.render(this.shadowFocus(), cam.getWorldDirection(this._f || (this._f = new THREE.Vector3())));
    const rt = this.target();
    R.setRenderTarget(rt); R.render(this.scene, cam);
    this.t += dt || 0.016;
    const d = this.drunk || 0;
    if (d >= 0.35) {
      const k = Math.min(1, (d - 0.35) / 0.6);
      U.drunk.value = k; U.dOff.value.set(Math.sin(this.t * 0.7) * 0.012 * k, Math.cos(this.t * 0.53) * 0.006 * k);
    } else U.drunk.value = 0;
    U.dpr.value = R.getPixelRatio(); U.cnear.value = cam.near; U.cfar.value = cam.far; U.time.value = this.t;
    R.setRenderTarget(null); R.render(this.qs, this.qc);
  }
}
