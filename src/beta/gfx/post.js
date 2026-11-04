// /beta's final picture. The frame is drawn into a picture of its own (with its depth, and in its alpha how much each
// surface mirrors), then, as far as the graphics settings ask: ambient occlusion and bounced light worked out from the
// depth, screen-space reflections, bloom, sun shafts, and one last pass that puts it together: depth of field, motion
// blur, the air between you and things, the tone curve, the ink, the paper. Light is flat poster and ink; Ultra is a
// physically lit film frame; everything between walks from one to the other.
// Same face to the game as gfx/post.js: target(), setSize(), setExposure(), render(), .drunk, .fxaa (so the game's
// shader warm-ups draw into the same kind of picture the game does), .paint (the old "experimental graphics"
// switch, which /beta doesn't need: it's always painted).
import * as THREE from 'three';
import { PU } from './paint.js';

const VS = `in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const HEAD = `precision highp float; precision highp sampler2D; in vec2 vUv; out vec4 o;\n`;
const DEPTH = `uniform sampler2D tDep; uniform mat4 proj, invProj; uniform vec2 res;
vec3 vp(vec2 uv){ vec4 p = invProj*vec4(uv*2. - 1., texture(tDep, uv).r*2. - 1., 1.); return p.xyz/p.w; }
// the surface's normal from the depth, from whichever neighbours belong to it
vec3 vn(vec2 uv, vec3 P){ vec2 px = 1./res; vec3 l = vp(uv - vec2(px.x, 0.)), r = vp(uv + vec2(px.x, 0.)), d = vp(uv - vec2(0., px.y)), u = vp(uv + vec2(0., px.y));
  vec3 dx = abs(l.z - P.z) < abs(r.z - P.z) ? P - l : r - P, dy = abs(d.z - P.z) < abs(u.z - P.z) ? P - d : u - P; return normalize(cross(dx, dy)); }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(.06711056, .00583715)))); }
`;
// ambient occlusion by a spiral of samples round each point; with rays on, each one that lands brings back a little of
// the colour it landed on (the light bounced off a sunny wall)
const AO_FS = HEAD + DEPTH + `uniform sampler2D tCol; uniform int samples, rays; uniform float radius;
void main(){
  float d0 = texture(tDep, vUv).r; if (d0 >= .99999) { o = vec4(0., 0., 0., 1.); return; }
  vec3 P = vp(vUv), n = vn(vUv, P), bounce = vec3(0.); float z = -P.z, pr = radius*proj[1][1]*.5/z, a0 = ign(gl_FragCoord.xy)*6.2832, occ = 0.;
  if (pr*res.y < 1.) { o = vec4(0., 0., 0., 1.); return; }
  for (int i = 0; i < samples; i++) {
    float t = (float(i) + .5)/float(samples), th = a0 + float(i)*2.39996; vec2 uv = vUv + vec2(cos(th)*res.y/res.x, sin(th))*pr*t;
    if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) continue;
    vec3 v = vp(uv) - P; float dv = dot(v, v), nv = dot(v, n)/sqrt(max(dv, 1e-5));
    float w = max(nv - .08, 0.)*smoothstep(radius*radius*2., radius*radius*.25, dv);
    occ += w; if (i < rays) bounce += texture(tCol, uv).rgb*w;
  }
  o = vec4(bounce/float(max(rays, 1)), clamp(1. - occ/float(samples)*2.6, 0., 1.));
}`;
const BLUR_FS = HEAD + `uniform sampler2D tAO, tDep; uniform vec2 dir; uniform float cnear, cfar;
float lz(vec2 uv){ float d = texture(tDep, uv).r; return cnear*cfar/(cfar - d*(cfar - cnear)); }
void main(){ float z = lz(vUv), W = 1.; vec4 s = texture(tAO, vUv);
  for (int i = 1; i <= 3; i++) for (int j = -1; j <= 1; j += 2) { vec2 q = vUv + dir*float(i*j); float w = (1. - float(i)*.2)*exp(-abs(lz(q) - z)/(.03*z + .02)); s += texture(tAO, q)*w; W += w; }
  o = s/W; }`;
// reflections: walk along the mirrored ray through the depth; what it hits is what the surface shows, and past the
// picture it shows the sky. The alpha of the picture says how much each surface mirrors
const SSR_FS = HEAD + DEPTH + `uniform sampler2D tCol; uniform int steps; uniform mat4 camWorld; uniform vec3 skyCol, fogCol; uniform float dayK;
void main(){
  float d0 = texture(tDep, vUv).r, mirror = 1. - texture(tCol, vUv).a; if (d0 >= .99999 || mirror < .01) { o = vec4(0.); return; }
  vec3 P = vp(vUv), n = vn(vUv, P), V = normalize(P), Rd = reflect(V, n); float fres = .04 + .96*pow(1. - max(dot(-V, n), 0.), 5.), z = -P.z, amt = clamp(mirror*(.12 + 1.9*fres), 0., 1.);
  vec3 Rw = mat3(camWorld)*Rd; vec3 c = mix(fogCol, skyCol*(.3 + .7*dayK), smoothstep(-.02, .35, Rw.y));
  if (Rd.z < .15) {
    float st = (2.5 + z*.05)*(.6 + .8*ign(gl_FragCoord.xy)), g = 1.12; vec3 p = P + n*.03, last = p; vec2 hit = vec2(-1.);
    for (int i = 0; i < steps; i++) { last = p; p += Rd*st; st *= g; vec4 q = proj*vec4(p, 1.); vec2 uv = q.xy/q.w*.5 + .5; if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1. || p.z > -.3) break;
      float sz = vp(uv).z, dz = sz - p.z;
      if (dz > 0. && dz < st*2.5 + .25) { vec3 a = last, b = p; for (int k = 0; k < 5; k++) { vec3 m = (a + b)*.5; vec4 qm = proj*vec4(m, 1.); vec2 um = qm.xy/qm.w*.5 + .5; if (vp(um).z > m.z) b = m; else a = m; } vec4 qb = proj*vec4(b, 1.); hit = qb.xy/qb.w*.5 + .5; break; } }
    if (hit.x >= 0. && texture(tDep, hit).r < .99999) { vec2 e = smoothstep(vec2(0.), vec2(.08), hit)*smoothstep(vec2(0.), vec2(.08), 1. - hit); c = mix(c, texture(tCol, hit).rgb, e.x*e.y); }
  }
  o = vec4(c, amt); }`;
// bright things bleed: down the chain, then back up it
const BRIGHT_FS = HEAD + `uniform sampler2D tCol; uniform vec2 px; float lum(vec3 c){ return dot(c, vec3(.3, .59, .11)); }
void main(){ vec3 c = (texture(tCol, vUv + px*vec2(-.5,-.5)).rgb + texture(tCol, vUv + px*vec2(.5,-.5)).rgb + texture(tCol, vUv + px*vec2(-.5,.5)).rgb + texture(tCol, vUv + px*vec2(.5,.5)).rgb)*.25; float l = lum(c), k = smoothstep(.78, 1.35, l); o = vec4(min(c, vec3(6.))*k, 1.); }`;
const DOWN_FS = HEAD + `uniform sampler2D tCol; uniform vec2 px;
void main(){ vec3 a = texture(tCol, vUv).rgb*.25; for (int i = 0; i < 4; i++) { vec2 s = vec2(i < 2 ? -1. : 1., (i == 0 || i == 2) ? -1. : 1.); a += texture(tCol, vUv + px*s).rgb*.125; a += texture(tCol, vUv + px*s*2.).rgb*.0625; } o = vec4(a, 1.); }`;
const UP_FS = HEAD + `uniform sampler2D tCol; uniform vec2 px; void main(){ vec3 a = texture(tCol, vUv).rgb*4.; for (int i = -1; i <= 1; i += 2) { a += texture(tCol, vUv + vec2(px.x*float(i), 0.)).rgb*2.; a += texture(tCol, vUv + vec2(0., px.y*float(i))).rgb*2.; a += texture(tCol, vUv + px*float(i)).rgb; a += texture(tCol, vUv + px*vec2(float(i), -float(i))).rgb; } o = vec4(a/16., 1.); }`;
// shafts of sun: from each point walk towards the sun on the screen, counting how much open sky there is
const SHAFT_FS = HEAD + `uniform sampler2D tDep; uniform vec2 sun; uniform int samples; float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(.06711056, .00583715)))); }
void main(){ vec2 d = (sun - vUv)/float(samples)*.85, p = vUv + d*ign(gl_FragCoord.xy); float s = 0., w = 1., W = 0.; for (int i = 0; i < samples; i++) { s += step(.99999, texture(tDep, p).r)*w; W += w; w *= .975; p += d; } float r = length((vUv - sun)*vec2(1.6, 1.)); o = vec4(vec3(s/W*exp(-r*1.6)), 1.); }`;

const FS = HEAD + `uniform sampler2D tCol, tDep, tNoise, tAO, tSSR, tBloom, tShaft; uniform vec2 res, dOff; uniform float dpr, cnear, cfar, time, drunk, inkQ, inkS, paper, film, aerial, bloomK, shaftK, focus, dofR; uniform int dofN, mbN, useAO, useSSR; uniform vec3 fogCol, sunCol, skyCol; uniform mat4 reproj, invVP; uniform float dayK;
float h12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
vec2 rot(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x+s*p.y,-s*p.x+c*p.y); }
float lum(vec3 c){ return dot(c,vec3(.3,.59,.11)); }
float nR(vec2 p){ return texture(tNoise, p*(1./16.)).r; }
float nG(vec2 p){ return texture(tNoise, p*(1./64.)).g; }
float fb2(vec2 p){ return nR(p)*.62 + nG(p*4.)*.38; }
float lz(vec2 uv){ float d = texture(tDep, uv).r; return cnear*cfar/(cfar - d*(cfar - cnear)); }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(.06711056, .00583715)))); }
// the picture is tone-mapped and linear: as painted (sRGB) for the marks
vec3 enc(vec3 c){ c = max(c, vec3(0.)); return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
vec3 col(vec2 uv){ return enc(texture(tCol, uv).rgb); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x + .03))/(x*(2.43*x + .59) + .14), 0., 1.); }
// how much the surface bends at uv: the second difference of 1/z (flat on flat things, whatever the angle). It has to
// bend more the further off it is: a kerb's small step shouldn't break into dashes between the pixels at 30 m
float crease(vec2 uv, float r){ vec2 px = r/res; float z = lz(uv), l = lz(uv - vec2(px.x, 0.)), rr = lz(uv + vec2(px.x, 0.)), u = lz(uv + vec2(0., px.y)), d = lz(uv - vec2(0., px.y));
  float iz = 1./z; float e = (abs(1./l + 1./rr - 2.*iz) + abs(1./u + 1./d - 2.*iz))*z; return smoothstep(.012 + .0016*z, .03 + .0032*z, e); }
void main(){
  vec2 uv = vUv, px = 1./res, fp = gl_FragCoord.xy/dpr;
  vec2 wob = (vec2(nR(fp*.09), nR(fp*.09 + 9.)) - .5)*px*2.4*dpr*paper;
  float d0 = texture(tDep, uv).r, z0 = lz(uv);
  bool sky = d0 >= .99999;
  vec3 L = texture(tCol, uv + wob*.6).rgb;
  // the lens: things out of focus open up into discs; the camera's own movement smears the frame
  if (dofN > 0) { float coc = clamp((z0 - focus - 25.)/380., 0., 1.)*dofR; if (coc > .6) { vec3 a = L; float W = 1., a0 = ign(gl_FragCoord.xy)*6.28; for (int i = 0; i < dofN; i++) { float t = sqrt((float(i) + .5)/float(dofN)), th = a0 + float(i)*2.39996; vec2 q = uv + vec2(cos(th), sin(th))*t*coc*px; float zq = lz(q), w = zq > focus - 1. ? 1. : .12; a += texture(tCol, q).rgb*w; W += w; } L = a/W; } }
  if (mbN > 0 && z0 > focus + 1.5) { vec4 pw = invVP*vec4(uv*2. - 1., (sky ? 1. : d0)*2. - 1., 1.); pw /= pw.w; vec4 pr = reproj*pw; vec2 vel = uv - pr.xy/pr.w*.5 - .5; float vl = length(vel); if (vl > .001) { vel *= min(1., .05/vl); vec3 a = L; float jit = ign(gl_FragCoord.xy); for (int i = 0; i < mbN; i++) a += texture(tCol, uv - vel*(float(i) + jit)/float(mbN)).rgb; L = a/float(mbN + 1); } }
  if (!sky) {
    if (useSSR > 0) { vec4 r = texture(tSSR, uv); L = mix(L, r.rgb, r.a); }
    if (useAO > 0) { vec4 a = texture(tAO, uv); float k = a.a; L = L*mix(1., k, 1. - min(1., lum(L)*.2)) + a.rgb*(.15 + L)*.35*dayK; }
    if (aerial > 0.) { float ff = 1. - exp(-z0*.0005*aerial); L = mix(L, fogCol*(.8 + .1*dayK), ff); }
  }
  if (bloomK > 0.) L += texture(tBloom, uv).rgb*bloomK;
  if (shaftK > 0.) L += texture(tShaft, uv).r*sunCol*shaftK*dayK;
  vec3 c = enc(L);
  if (sky) c *= 1. + (nR(rot(fp, .35)/vec2(18., 1.6)) - .5)*.07*paper;     // brushed on, side to side
  else if (inkS > 0.) {
    float z = z0;
    float e = crease(uv + wob*.6, 1.*dpr), ec = 0.;
    if (inkQ >= 1. && z < 38.) {
      vec3 a = col(uv - vec2(px.x, 0.)*dpr), b = col(uv + vec2(px.x, 0.)*dpr), u2 = col(uv + vec2(0., px.y)*dpr), dd = col(uv - vec2(0., px.y)*dpr);
      ec = smoothstep(.13, .3, abs(lum(a) - lum(b)) + abs(lum(u2) - lum(dd)))*.5;
    }
    float brk = smoothstep(.2, .45, nR(fp*.05 + 2.));
    vec3 ink = mix(c*.4, vec3(.14, .12, .13), .6);
    float fade = 1. - smoothstep(35., inkQ >= 3. ? 220. : 140., z);
    c = mix(c, ink, max(e, ec*(1. - smoothstep(10., 38., z)))*(.5 + .4*brk)*fade*inkS);
    if (inkQ >= 2.) { vec2 w2 = (vec2(nR(fp*.035 + 20.), nR(fp*.035 + 31.)) - .5)*px*5.*dpr; float e2 = crease(uv + w2, .8*dpr); c = mix(c, ink, e2*.28*step(.5, nR(fp*.04 + 8.))*fade*inkS); }
  }
  if (drunk > 0.) {
    vec2 q = vUv - .5; float r = dot(q, q);
    vec3 bb = col(uv + dOff);
    vec3 bl = (col(uv + vec2(.004, 0.)) + col(uv - vec2(.004, 0.)) + col(uv + vec2(0., .004)) + col(uv - vec2(0., .004)))*.25;
    c = mix(mix(c, bl, drunk*.6), bb, .38*drunk);
    c *= 1. - r*1.4*drunk;
  }
  // poster paint: the colours a little stronger than life (the dull ones most), a little more contrast. Film: a real tone curve through the same light
  vec3 pst = c; float cl = lum(pst), cs = max(pst.r, max(pst.g, pst.b)) - min(pst.r, min(pst.g, pst.b));
  pst = mix(vec3(cl), pst, 1.16 + .2*(1. - smoothstep(.0, .5, cs)));
  pst = clamp(pst, 0., 1.); pst = mix(pst, pst*pst*(3. - 2.*pst), .32);
  if (film > 0.) { vec3 lin = pow(max(c, vec3(0.)), vec3(2.2)); lin = mix(vec3(lum(lin)), lin, 1.14); vec3 fl = enc(aces(lin*.92)); fl += (h12(gl_FragCoord.xy + fract(time)*91.) - .5)*.012; c = mix(pst, fl, film); } else c = pst;
  // the paper
  if (paper > 0.) { float pap = fb2(fp*.35)*.8 + h12(floor(fp/1.5))*.2; c *= 1. + (.955 + pap*.075 - 1.)*paper;
    float speck = step(.995, h12(floor(fp/1.6) + 5.)); c = mix(c, c*.78, speck*.5*paper); }
  vec2 v = uv - .5; c *= 1. - dot(v, v)*.28*max(paper, film);
  if (paper > .75) { float asp = res.x/res.y, dd2 = min(min(uv.x, 1. - uv.x)*asp, min(uv.y, 1. - uv.y)); float rn = fb2(fp*.012)*.7 + nR(fp*.08)*.3;
    float m = smoothstep(0., .006, dd2 - .014 - (rn - .5)*.03); float pap = fb2(fp*.35)*.8 + h12(floor(fp/1.5))*.2;
    vec3 sheet = vec3(.95, .925, .86)*(.97 + pap*.05); c = mix(sheet, c, m); }
  o = vec4(c, 1.);
}`;
const raw = (fs, uniforms) => new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, blending: THREE.NoBlending });

export class Post {
  constructor(renderer, scene, camera, q, paint, sky) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.q = q; this.paintLook = paint; this.sky = sky;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.exposure = 1;
    this.fxaa = true;                       // (the game's warm-ups draw into target(), like the game does)
    this.paint = { on: false, set: async () => {}, setSize() {} };
    this.drunk = 0; this.t = 0;
    // what the graphics settings ask for (gfx settings write these)
    this.fx = { ao: 0, aoScale: .5, rays: 0, ssr: 0, ssrScale: .5, bloom: 0, shafts: 0, dof: 0, mb: 0 };
    const res = { value: new THREE.Vector2() }, proj = { value: new THREE.Matrix4() }, invProj = { value: new THREE.Matrix4() };
    this.res = res; this.proj = proj; this.invProj = invProj;
    this.tDep = { value: null }; this.tColU = { value: null };
    this.U = { tCol: this.tColU, tDep: this.tDep, tNoise: PU.tNoise, res, dpr: { value: 1 }, cnear: { value: 0.1 }, cfar: { value: 1000 }, time: { value: 0 }, drunk: { value: 0 }, inkQ: { value: 2 }, inkS: { value: 1 }, paper: { value: 1 }, film: { value: 0 }, aerial: { value: 0 }, bloomK: { value: 0 }, shaftK: { value: 0 }, focus: { value: 8 }, dofR: { value: 8 }, dofN: { value: 0 }, mbN: { value: 0 }, useAO: { value: 0 }, useSSR: { value: 0 }, tAO: { value: null }, tSSR: { value: null }, tBloom: { value: null }, tShaft: { value: null }, dOff: { value: new THREE.Vector2() }, fogCol: PU.fogCol, sunCol: PU.sunCol, skyCol: PU.skyCol, dayK: PU.dayK, reproj: { value: new THREE.Matrix4() }, invVP: { value: new THREE.Matrix4() } };
    this.mat = raw(FS, this.U);
    const dep = { tDep: this.tDep, proj, invProj, res };
    this.aoM = raw(AO_FS, { ...dep, tCol: this.tColU, samples: { value: 16 }, rays: { value: 0 }, radius: { value: 1.3 } });
    this.blurM = raw(BLUR_FS, { tAO: { value: null }, tDep: this.tDep, dir: { value: new THREE.Vector2() }, cnear: this.U.cnear, cfar: this.U.cfar });
    this.ssrM = raw(SSR_FS, { ...dep, tCol: this.tColU, steps: { value: 16 }, camWorld: { value: new THREE.Matrix4() }, skyCol: PU.skyCol, fogCol: PU.fogCol, dayK: PU.dayK });
    this.brM = raw(BRIGHT_FS, { tCol: this.tColU, px: { value: new THREE.Vector2() } });
    this.downM = raw(DOWN_FS, { tCol: { value: null }, px: { value: new THREE.Vector2() } });
    this.upM = raw(UP_FS, { tCol: { value: null }, px: { value: new THREE.Vector2() } });
    this.upM.blending = THREE.CustomBlending; this.upM.blendSrc = THREE.OneFactor; this.upM.blendDst = THREE.OneFactor;
    this.shM = raw(SHAFT_FS, { tDep: this.tDep, sun: { value: new THREE.Vector2() }, samples: { value: 32 } });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rts = {}; this.prevVP = new THREE.Matrix4(); this.vp = new THREE.Matrix4();
  }
  setSize(w, h) { this.renderer.setSize(w, h, false); if (this.rt) { this.rt.depthTexture.dispose(); this.rt.dispose(); this.rt = null; } this.freeFx(); }
  freeFx() { for (const k in this.rts) { const r = this.rts[k]; if (Array.isArray(r)) r.forEach(x => x.dispose()); else r.dispose(); } this.rts = {}; }
  setExposure(e) { this.renderer.toneMappingExposure = e; this.exposure = e; }
  // the picture the final pass reads. Flagged as an XR target so three tone-maps into it exactly as it would onto the
  // screen (the painted city writes the same way): the final pass inks and encodes
  target() {
    if (this.rt) return this.rt;
    const R = this.renderer, v = R.getDrawingBufferSize(new THREE.Vector2());
    const dt = new THREE.DepthTexture(v.x, v.y, THREE.UnsignedIntType); dt.minFilter = dt.magFilter = THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(v.x, v.y, { type: THREE.HalfFloatType, samples: Math.min((this.q && this.q.samples) || 0, R.capabilities.maxSamples), depthTexture: dt, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rt.isXRRenderTarget = true;
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.tColU.value = this.rt.texture; this.tDep.value = dt; this.res.value.set(v.x, v.y);
    return this.rt;
  }
  fxTarget(key, scale, type = THREE.HalfFloatType) {
    const v = this.res.value, w = Math.max(1, Math.round(v.x*scale)), h = Math.max(1, Math.round(v.y*scale)); let r = this.rts[key];
    if (r && r.width === w && r.height === h) return r; if (r) r.dispose();
    r = this.rts[key] = new THREE.WebGLRenderTarget(w, h, { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); r.texture.colorSpace = THREE.LinearSRGBColorSpace;
    return r;
  }
  pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.qs, this.qc); }
  bloomChain(levels) {
    const v = this.res.value, chain = [];
    for (let i = 0; i < levels; i++) chain.push(this.fxTarget('b' + i, 1/2**(i + 1)));
    this.brM.uniforms.px.value.set(1/v.x, 1/v.y); this.pass(this.brM, chain[0]);
    for (let i = 1; i < levels; i++) { this.downM.uniforms.tCol.value = chain[i - 1].texture; this.downM.uniforms.px.value.set(1/chain[i - 1].width, 1/chain[i - 1].height); this.pass(this.downM, chain[i]); }
    const au = this.renderer.autoClear; this.renderer.autoClear = false;
    for (let i = levels - 1; i > 0; i--) { this.upM.uniforms.tCol.value = chain[i].texture; this.upM.uniforms.px.value.set(1/chain[i].width, 1/chain[i].height); this.pass(this.upM, chain[i - 1]); }
    this.renderer.autoClear = au;
    return chain[0].texture;
  }
  render(dt = 0.016) {
    const R = this.renderer, cam = this.camera, U = this.U, F = this.fx;
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
    this.proj.value.copy(cam.projectionMatrix); this.invProj.value.copy(cam.projectionMatrixInverse);
    const indoors = this.indoors && this.indoors();
    // ambient occlusion and bounced light
    U.useAO.value = F.ao > 0 ? 1 : 0;
    if (F.ao > 0) {
      const a = this.fxTarget('ao', F.aoScale), b = this.fxTarget('aoB', F.aoScale); this.aoM.uniforms.samples.value = F.ao; this.aoM.uniforms.rays.value = F.rays; this.pass(this.aoM, a);
      this.blurM.uniforms.tAO.value = a.texture; this.blurM.uniforms.dir.value.set(1.5/a.width, 0); this.pass(this.blurM, b);
      this.blurM.uniforms.tAO.value = b.texture; this.blurM.uniforms.dir.value.set(0, 1.5/a.height); this.pass(this.blurM, a);
      U.tAO.value = a.texture;
    }
    U.useSSR.value = F.ssr > 0 ? 1 : 0;
    if (F.ssr > 0) { const s = this.fxTarget('ssr', F.ssrScale); this.ssrM.uniforms.steps.value = F.ssr; this.ssrM.uniforms.camWorld.value.copy(cam.matrixWorld); this.pass(this.ssrM, s); U.tSSR.value = s.texture; }
    U.bloomK.value = F.bloom > 0 ? (this.bloomK ?? .5) : 0;
    if (F.bloom > 0) U.tBloom.value = this.bloomChain(F.bloom);
    U.shaftK.value = 0;
    if (F.shafts > 0 && !indoors) {
      const S = this._sv || (this._sv = new THREE.Vector3()), dy = PU.dayK.value; S.copy(PU.sunDir.value).multiplyScalar(cam.far*.5).add(cam.position).project(cam);
      const front = (this._f2 || (this._f2 = new THREE.Vector3())).copy(PU.sunDir.value).dot(cam.getWorldDirection(this._f));
      if (front > .05 && dy > .05) { const sh = this.fxTarget('shaft', .5, THREE.UnsignedByteType); this.shM.uniforms.sun.value.set(S.x*.5 + .5, S.y*.5 + .5); this.shM.uniforms.samples.value = F.shafts; this.pass(this.shM, sh); U.tShaft.value = sh.texture; U.shaftK.value = .42*Math.min(1, front*2); }
    }
    U.dofN.value = F.dof; U.mbN.value = F.mb;
    if (F.dof > 0 && this.focusAt) { const f = this.focusAt(); U.focus.value += (f - U.focus.value)*Math.min(1, (dt || .016)*5); U.dofR.value = 5*U.dpr.value; }
    if (F.mb > 0) { this.vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); U.invVP.value.copy(this.vp).invert(); U.reproj.value.copy(this.prevVP); this.prevVP.copy(this.vp); }
    this.pass(this.mat, null);
  }
}
