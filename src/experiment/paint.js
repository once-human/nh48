// /experiment: the painted look, from scratch. No three.js lighting at all: every surface paints itself in the one
// pass that draws it.
//  - the sun lands in two tones with a brushed edge, and the shadows have the same brushed edge
//  - each kind of surface draws its own marks: brick courses, pavers, plaster patches, shutter ribs, planks
//  - dry-brush streaks everywhere, grey pencil hatching in the shade, crossed in the darkest places. All of it is
//    worked out in world space on the axis the surface faces, re-sized with distance like a mipmap, so it stays
//    put when you move and never shrinks into noise
//  - the far distance goes into a pale haze
// Then one cheap pass over the frame: ink lines from the depth (drawn twice, like a quick sketch), the sky, and
// the paper it's painted on, torn at the edges.
import * as THREE from 'three';

// shared by every material: change once, every surface follows
export const U = {
  sunDir: { value: new THREE.Vector3(-0.55, 0.62, -0.56).normalize() },
  sunCol: { value: new THREE.Vector3(1.07, 1.02, 0.93) },
  shadeCol: { value: new THREE.Vector3(0.5, 0.53, 0.62) },
  fogCol: { value: new THREE.Vector3(0.79, 0.84, 0.86) },
  fogR: { value: new THREE.Vector2(45, 330) },
  shadowTex: { value: null },
  shadowMat: { value: new THREE.Matrix4() },
  shadowTexel: { value: 1 / 2048 },
  shadowOn: { value: 1 },
  hatchOn: { value: 1 },
  paintOn: { value: 1 },
  pScale: { value: 800 },
  dpr: { value: 1 },
  time: { value: 0 },
  crowdTex: { value: null },
  map: { value: null },
  tNoise: { value: null },
};

const HEAD = `precision highp float; precision highp int; precision highp sampler2D;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix; uniform vec3 cameraPosition;
`;

const NOISE = `
float h12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(7.1,3.3); a*=.5; } return s; }
vec2 rot(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x+s*p.y,-s*p.x+c*p.y); }
float lum(vec3 c){ return dot(c,vec3(.3,.59,.11)); }
`;

// ---------------------------------------------------------------- vertex
const VS = HEAD + `
in vec3 position; in vec3 normal; in vec3 color; in float kind;
#ifdef USE_MAP
in vec2 uv; out vec2 vUv;
#endif
#ifdef PEOPLE
in vec3 pla; in vec4 iPos; in vec4 iAnim;
uniform sampler2D crowdTex;
vec4 ct(int id, int k){ int t = id*8 + k; return texelFetch(crowdTex, ivec2(t & 63, t >> 6), 0); }
#endif
#ifdef VEHICLE
in vec2 vsa; in vec4 iPos; in vec3 iCol0; in vec3 iCol1; in float iMask;
#endif
out vec3 vW; out vec3 vN; out vec3 vC; flat out float vK; out float vZ;
invariant gl_Position;
void main(){
  vec3 p = position, n = normal, c = color;
#ifdef PEOPLE
  int id = int(iAnim.z + .5);
  vec4 b = ct(id, 6);                                   // texels: shirt, lower, skin, hair, acc, acc2, body
  int mask = int(b.r*255.+.5) | (int(b.g*255.+.5) << 8);
  float hgt = .6 + b.b*.6, girth = .8 + b.a*.5;
  int slot = int(pla.x+.5), limb = int(pla.y+.5), acc = int(pla.z + (pla.z < 0. ? -.5 : .5));
  bool show = acc == 0 || (acc > 0 ? (mask & acc) != 0 : (mask & -acc) == 0);
  if (slot > 0) c = ct(id, slot - 1).rgb;
  // wider in the body, not in the head
  float bw = mix(1., girth, smoothstep(1.52, 1.4, p.y));
  p.x *= bw; p.z *= mix(1., girth, .5*smoothstep(1.52, 1.4, p.y));
  float ph = iAnim.x, amp = iAnim.y, sw = sin(ph)*amp;
  if (limb > 0) {
    vec3 pv; float an;
    if (limb == 1) { pv = vec3(-.09*bw, .9, 0.); an = sw*.5; }
    else if (limb == 2) { pv = vec3(.09*bw, .9, 0.); an = -sw*.5; }
    else if (limb == 3) { pv = vec3(-.2*bw, 1.4, 0.); an = -sw*.42 + (1.-amp)*.04*sin(ph*.3); }
    else { pv = vec3(.2*bw, 1.4, 0.); an = sw*.42; }
    float cs = cos(an), sn = sin(an);
    vec3 q = p - pv; p = pv + vec3(q.x, cs*q.y - sn*q.z, sn*q.y + cs*q.z);
    n = vec3(n.x, cs*n.y - sn*n.z, sn*n.y + cs*n.z);
  }
  p.y += abs(cos(ph))*.03*amp + (1.-amp)*.006*sin(ph*.5);
  p *= hgt;
  if (!show) p = vec3(0., -9., 0.);
  float cy = cos(iPos.w), sy = sin(iPos.w);
  p = vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z); n = vec3(cy*n.x + sy*n.z, n.y, -sy*n.x + cy*n.z);
  vec3 w = p + iPos.xyz;
#elif defined(VEHICLE)
  int slot = int(vsa.x+.5), acc = int(vsa.y+.5), mask = int(iMask+.5);
  if (slot == 1) c = iCol0; else if (slot == 2) c = iCol1;
  if (acc > 0 && (mask & acc) == 0) p = vec3(0., -9., 0.);
  float cy = cos(iPos.w), sy = sin(iPos.w);
  p = vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z); n = vec3(cy*n.x + sy*n.z, n.y, -sy*n.x + cy*n.z);
  vec3 w = p + iPos.xyz;
#else
  vec3 w = (modelMatrix * vec4(p, 1.)).xyz;
  n = mat3(modelMatrix) * n;
#endif
#ifdef USE_MAP
  vUv = uv;
#endif
  vW = w; vN = n; vC = c; vK = kind;
  vec4 vp = viewMatrix * vec4(w, 1.);
  vZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}`;

// ---------------------------------------------------------------- fragment
// The marks come out of one small tiling texture (paintNoise below), so a stroke costs one read, not a dozen hashes:
//   r smooth noise (16 cells a tile), g fine noise (64), b pencil lines (32 a tile, wavering, broken), a dry-brush streaks
const FS = HEAD + NOISE + `
uniform vec3 sunDir, sunCol, shadeCol, fogCol; uniform vec2 fogR;
uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform float shadowTexel, shadowOn, hatchOn, paintOn, pScale, dpr;
uniform sampler2D tNoise;
#ifdef USE_MAP
uniform sampler2D map; in vec2 vUv;
#endif
in vec3 vW; in vec3 vN; in vec3 vC; flat in float vK; in float vZ;
out vec4 fragColor;
float nR(vec2 p){ return texture(tNoise, p*(1./16.)).r; }     // like vn(p): one cell per unit
float nG(vec2 p){ return texture(tNoise, p*(1./64.)).g; }
float gl1(float x, float w){ float d = min(fract(x), 1. - fract(x)); return 1. - smoothstep(w*.5, w, d); }

// the colour of the surface itself, with its marks drawn in
vec3 surface(int k, vec3 c, vec3 w, vec2 u, float near){
  if (k == 0) {                                           // plaster / limewash: repainted patches, a vertical brush, the plinth
    c *= .93 + .12*smoothstep(.44, .56, nR(u*.55 + c.r*9.));
    c *= 1. - .1*nG(vec2(u.x*5., u.y*.35))*near;
    c *= mix(.72, 1., smoothstep(.15, 1.1, w.y));
  } else if (k == 1) {                                    // brick: courses, a stagger, every brick its own fired colour
    vec2 g = u*vec2(1./.23, 1./.077); g.x += step(.5, fract(g.y*.5))*.5;
    vec2 id = floor(g); float hb = h12(id);
    c *= .78 + .36*hb; c = mix(c, c*vec3(.8,.7,.75), step(.86, fract(hb*7.31))*.6);
    float m = max(gl1(g.x, .07), gl1(g.y, .16))*near;
    c = mix(c, vec3(.74, .7, .64), m*.8);
    c *= mix(.75, 1., smoothstep(.1, 1., w.y));
  } else if (k == 2) {                                    // road: tar patches, the wheel lines, a faded centre line
    c *= .9 + .2*smoothstep(.4, .6, nR(w.xz*vec2(.35, .08)));
    c *= .94 + .1*nG(w.xz*vec2(3., .25));
    float ln = (1. - smoothstep(.06, .09, abs(w.x)))*step(.45, fract(w.z/6.));
    c = mix(c, vec3(.86, .85, .8), ln*.5);
  } else if (k == 3) {                                    // pavers
    vec2 g = vec2(w.x, w.z)*vec2(1./.4, 1./.2); g.x += step(.5, fract(g.y*.5))*.5;
    c *= .9 + .18*h12(floor(g));
    c *= 1. - .3*near*max(gl1(g.x, .07), gl1(g.y, .12));
  } else if (k == 4) {                                    // kerb, painted in yellow dashes
    c = mix(vec3(.72, .7, .66), vec3(.88, .7, .2), step(.5, fract(w.z*.5 + .25)));
  } else if (k == 5) {                                    // Mangalore tiles, row on row
    float r = fract(w.y*5.2); c *= .82 + .3*h12(vec2(floor(u.x*4.), floor(w.y*5.2)));
    c *= mix(1., .62, near*smoothstep(.75, .98, r));
  } else if (k == 6) {                                    // rolling shutter
    c *= .8 + .25*(.5 + .5*sin(w.y*78.))*near + .12*(1. - near);
  } else if (k == 7) {                                    // planks
    float pl = u.x*6.5; c *= .82 + .3*h12(vec2(floor(pl), 3.)); c *= 1. - .45*near*gl1(pl, .08);
  } else if (k == 8) {                                    // painted glass: deep blue-green, one pale stroke of sky across it
    float d = fract((u.x*.55 + u.y)*.8 + h12(floor(u*.6))*.7);
    c = mix(c, vec3(.66, .78, .8), smoothstep(.05, .1, d)*smoothstep(.3, .24, d)*.75);
  } else if (k == 9) {                                    // leaves: dabs
    c *= .7 + .55*(nR(w.xz*2.3 + w.y*1.7)*.6 + nG(w.xy*5.1 - w.z*3.)*.4);
  } else if (k == 11) {                                   // corrugated tin
    c *= .82 + .22*(.5 + .5*sin(u.x*40.))*near + .11*(1. - near);
  } else if (k == 12) {                                   // basalt blocks
    vec2 g = u*vec2(2., 3.2); g.x += step(.5, fract(g.y*.5))*.5;
    c *= .82 + .3*h12(floor(g)); c *= 1. - .45*near*max(gl1(g.x, .05), gl1(g.y, .07));
  } else if (k == 15) {                                   // cloth and skin
    c *= .95 + .08*nG(w.xy*14. + w.z*9.);
  }
  return c;
}

// the sun's shadow: two filtered reads, nudged by a brushed wobble
float shadowAt(vec3 w, vec3 n, float e){
  vec4 s = shadowMat * vec4(w + n*.05, 1.);
  if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  vec2 j = vec2(e, -e)*2.6*shadowTexel;
  float z = s.z - .0012;
  return .5*(texture(shadowTex, vec3(s.xy + j + vec2(-.6, .3)*shadowTexel, z)) + texture(shadowTex, vec3(s.xy + j + vec2(.6, -.3)*shadowTexel, z)));
}
// pencil lines at spacing sp (lines along y, so they're set by q.x)
float hatch(vec2 q, float sp){ return texture(tNoise, q*(1./(sp*32.))).b; }
float streak(vec2 q, float k){ return texture(tNoise, q/(vec2(8., 7.68)*k)).a; }

void main(){
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 w = vW; int k = int(vK + .5);
  // the surface's own 2D: walls stroked up and down, the ground across
  vec3 an = abs(n);
  vec2 u = an.y > max(an.x, an.z) ? w.xz : (an.x > an.z ? vec2(w.z, w.y) : vec2(w.x, w.y));
  float near = 1. - smoothstep(18., 55., vZ);
  vec3 base = vC;
#ifdef USE_MAP
  base = texture(map, vUv).rgb;
#endif
  base = surface(k, base, w, u, near);
  float e = nR(u*1.7 + w.y*.6)*.6 + nG(u*6.3 - w.y*2.)*.4 - .5;
  if (paintOn < .5) {                                    // plain, for comparing what the paint costs
    float d = max(dot(n, sunDir), 0.) * (shadowOn > .5 ? shadowAt(w, n, 0.) : 1.);
    vec3 c = base*(.45 + .65*d);
    fragColor = vec4(mix(c, fogCol, smoothstep(fogR.x, fogR.y, vZ)*.9), 1.); return;
  }
  // the light, in two tones with a brushed edge
  float ndl = dot(n, sunDir);
  float lit = smoothstep(.0, .1, ndl + e*.14);
  float sh = (shadowOn > .5 && lit > 0.) ? smoothstep(.3, .7, shadowAt(w, n, e) + e*.3) : 1.;
  float L = lit*sh;
  vec3 cl = base*sunCol;
  vec3 cs = base*shadeCol*(.92 + .16*max(n.y, 0.)) + vec3(.025, .03, .045);
  vec3 c = mix(cs, cl, L);
  if (k == 13) c = mix(c, base*1.05, .7);                 // lit from inside (shop interiors)
  if (k == 8) c = mix(c, base, .35);
  // the marks, sized for the screen: far surfaces get the same strokes drawn bigger (two sizes blended)
  float lv = max(log2(max(vZ/pScale*3.*dpr/.016, 1e-3)), 0.), i0 = floor(lv), fr = fract(lv), k0 = exp2(i0), k1 = k0*2.;
  // dry brush along the face
  float T = mix(streak(u, k0), streak(u, k1), fr);
  c *= 1. + (mix(.5, T, 1. - smoothstep(150., 380., vZ)) - .5)*.22;
  if (hatchOn > .5 && vZ < 230.) {
    // grey pencil in the shade: one way where it's shaded, crossed where it's darkest (faces turned from the sun)
    float shade = 1. - L, h = 0.;
    if (shade > .35) {
      vec2 a = rot(u, .78);
      h = mix(hatch(a, .05*k0), hatch(a, .05*k1), fr);
      float deep = shade*smoothstep(.0, -.35, ndl + e*.1);
      if (deep > .45) { vec2 bb = rot(u, -.62) + 17.; h = max(h, mix(hatch(bb, .056*k0), hatch(bb, .056*k1), fr)); }
      h *= 1. - smoothstep(90., 230., vZ);
    }
    vec3 pencil = vec3(.36, .37, .41);
    c = mix(c, c*.55 + pencil*.25, h*.55);
    // and fine vertical pencil on lit walls, near
    if (L > .5 && an.y < .5 && vZ < 70.) {
      vec2 fq = vec2(u.x, u.y*.02);
      float hf = mix(hatch(fq, .03*k0), hatch(fq, .03*k1), fr)*L*.35*(1. - smoothstep(25., 70., vZ));
      c = mix(c, c*.82, hf*.5);
    }
  }
  // the haze
  c = mix(c, fogCol, smoothstep(fogR.x, fogR.y, vZ)*.92);
  fragColor = vec4(c, 1.);
}`;

// one 256² tile of everything the brush and the pencil need (see FS)
export function paintNoise() {
  const N = 256, d = new Uint8Array(N * N * 4);
  let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const sm = (t) => t * t * (3 - 2 * t);
  const lattice = (gx, gy) => { const L = new Float32Array(gx * gy); for (let i = 0; i < L.length; i++) L[i] = rnd(); return (x, y) => {
    const fx = x / N * gx, fy = y / N * gy, i = Math.floor(fx), j = Math.floor(fy), tx = sm(fx - i), ty = sm(fy - j);
    const at = (a, b) => L[((a % gx + gx) % gx) + ((b % gy + gy) % gy) * gx];
    return (at(i, j) * (1 - tx) + at(i + 1, j) * tx) * (1 - ty) + (at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx) * ty; }; };
  const r = lattice(16, 16), g = lattice(64, 64), wob = lattice(4, 8), brk = lattice(32, 3), st1 = lattice(16, 256), st2 = lattice(48, 512);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const o = (y * N + x) * 4;
    d[o] = r(x, y) * 255; d[o + 1] = g(x, y) * 255;
    // pencil: 32 wavering lines a tile, each breaking off along its length
    const dd = x / 8 + (wob(x, y) - .5) * .8, li = ((Math.floor(dd) % 32) + 32) % 32;
    const l = Math.abs(dd - Math.floor(dd) - .5) * 2, line = 1 - sm(Math.min(1, Math.max(0, (l - .1) / .24)));
    const keep = brk(li * 8 + 4, y) > .36 ? 1 : 0;
    d[o + 2] = line * keep * 255;
    d[o + 3] = (st1(x, y) * .6 + st2(x, y) * .4) * 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

const DEPTH_FS = `precision highp float; out vec4 o; void main(){ o = vec4(1.); }`;

export function paintMaterial(opts = {}) {
  const defines = {};
  if (opts.people) defines.PEOPLE = '';
  if (opts.vehicle) defines.VEHICLE = '';
  if (opts.map) defines.USE_MAP = '';
  const m = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, defines, glslVersion: THREE.GLSL3 });
  m.depthMat = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: DEPTH_FS, uniforms: U, defines, glslVersion: THREE.GLSL3, colorWrite: false });
  return m;
}

// ---------------------------------------------------------------- the sun's shadow map
export class Sun {
  constructor(size = 2048) {
    this.size = size;
    this.cam = new THREE.OrthographicCamera(-90, 90, 90, -90, 1, 500);
    this.make(size);
    this._c = new THREE.Vector3(); this._m = new THREE.Matrix4();
    this.bias = new THREE.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
  }
  make(size) {
    if (this.rt) this.rt.dispose();
    const dt = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
    dt.minFilter = dt.magFilter = THREE.LinearFilter; dt.compareFunction = THREE.LessEqualCompare;
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthTexture: dt, depthBuffer: true, format: THREE.RedFormat, type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    U.shadowTex.value = dt; U.shadowTexel.value = 1 / size;
  }
  // centre the map a little ahead of the camera; move it only in whole texels so the edges don't crawl
  update(camera) {
    const half = this.cam.right, d = U.sunDir.value;
    const f = camera.getWorldDirection(this._c); f.y = 0; f.normalize();
    const cx = camera.position.x + f.x * half * 0.6, cz = camera.position.z + f.z * half * 0.6;
    const cam = this.cam;
    cam.position.set(cx + d.x * 200, d.y * 200, cz + d.z * 200);
    cam.up.set(0, 1, 0); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld();
    // snap in light space
    const t = (2 * half) / this.size, inv = cam.matrixWorldInverse;
    const o = new THREE.Vector3(0, 0, 0).applyMatrix4(inv);
    const sx = o.x - Math.round(o.x / t) * t, sy = o.y - Math.round(o.y / t) * t;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    cam.position.addScaledVector(right, sx).addScaledVector(up, sy); cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    U.shadowMat.value.copy(this.bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
  }
  render(renderer, scene, casters) {
    const keep = [];
    scene.traverse(o => { if (o.isMesh || o.isPoints) { keep.push([o, o.material, o.visible]); if (casters.has(o) && o.material.depthMat) o.material = o.material.depthMat; else o.visible = false; } });
    renderer.setRenderTarget(this.rt); renderer.setClearColor(0xffffff, 1); renderer.clear();
    renderer.render(scene, this.cam);
    for (const [o, m, v] of keep) { o.material = m; o.visible = v; }
  }
}

const _keep = [];
function swapDepth(scene, on) {
  if (on) { _keep.length = 0; scene.traverse((o) => { if (o.isMesh && o.userData.prepass && o.material.depthMat) { _keep.push(o, o.material); o.material = o.material.depthMat; } }); }
  else { for (let i = 0; i < _keep.length; i += 2) _keep[i].material = _keep[i + 1]; _keep.length = 0; }
}

// ---------------------------------------------------------------- after the frame: ink, sky, paper
const POST_VS = `in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const POST_FS = `precision highp float; precision highp sampler2D;
in vec2 vUv; out vec4 o;
uniform sampler2D tCol, tDep; uniform vec2 res; uniform float dpr, cnear, cfar, inkOn, paperOn, time;
uniform mat4 invVP; uniform vec3 camPos, fogCol, sunDir; uniform sampler2D tNoise;
${NOISE}
float nR(vec2 p){ return texture(tNoise, p*(1./16.)).r; }
float nG(vec2 p){ return texture(tNoise, p*(1./64.)).g; }
float fb2(vec2 p){ return nR(p)*.62 + nG(p*4.)*.38; }
float lz(vec2 uv){ float d = texture(tDep, uv).r; return cnear*cfar/(cfar - d*(cfar - cnear)); }
vec3 col(vec2 uv){ return texture(tCol, uv).rgb; }
// how much the surface bends at uv: the second difference of 1/z (flat on flat things, whatever the angle)
float crease(vec2 uv, float r){ vec2 px = r/res; float z = lz(uv), l = lz(uv - vec2(px.x, 0.)), rr = lz(uv + vec2(px.x, 0.)), u = lz(uv + vec2(0., px.y)), d = lz(uv - vec2(0., px.y));
  float iz = 1./z; float e = (abs(1./l + 1./rr - 2.*iz) + abs(1./u + 1./d - 2.*iz))*z; return smoothstep(.012, .03, e); }
vec3 sky(vec3 d, vec2 fp){
  float t = clamp(d.y, 0., 1.);
  vec3 c = mix(fogCol, vec3(.43, .62, .84), pow(t, .55));
  vec2 q = d.xz/(d.y + .1);
  float cl = fb2(q*.55 + vec2(time*.003, 0.)); cl = smoothstep(.56, .78, cl)*smoothstep(.02, .2, d.y);
  c = mix(c, vec3(.96, .96, .94), cl*.8);
  float s = max(dot(d, sunDir), 0.);
  c = mix(c, vec3(1., .98, .9), pow(s, 60.)*.5);
  c *= 1. + (nR(rot(fp, .35)/vec2(18., 1.6)) - .5)*.07;            // brushed on, side to side
  return c;
}
void main(){
  vec2 uv = vUv, px = 1./res, fp = gl_FragCoord.xy/dpr;
  vec2 wob = (vec2(nR(fp*.09), nR(fp*.09 + 9.)) - .5)*px*2.4*dpr;
  float d0 = texture(tDep, uv).r;
  vec3 c;
  if (d0 >= .99999) { vec4 p = invVP*vec4(uv*2. - 1., 1., 1.); vec3 dir = normalize(p.xyz/p.w - camPos); c = sky(dir, fp); }
  else c = col(uv + wob*.6);
  if (inkOn > .5) {
    float z = lz(uv);
    float e = crease(uv + wob*.6, 1.*dpr);
    vec2 w2 = (vec2(nR(fp*.035 + 20.), nR(fp*.035 + 31.)) - .5)*px*5.*dpr; float e2 = crease(uv + w2, .8*dpr);
    vec3 a = col(uv - vec2(px.x, 0.)*dpr), b = col(uv + vec2(px.x, 0.)*dpr), u2 = col(uv + vec2(0., px.y)*dpr), dd = col(uv - vec2(0., px.y)*dpr);
    float ec = smoothstep(.13, .3, abs(lum(a) - lum(b)) + abs(lum(u2) - lum(dd)))*.5*(d0 < .99999 ? 1. : 0.);
    float brk = smoothstep(.2, .45, nR(fp*.05 + 2.));
    vec3 ink = mix(c*.4, vec3(.14, .12, .13), .6);
    float fade = 1. - smoothstep(35., 140., z);
    c = mix(c, ink, max(e, ec)*(.5 + .4*brk)*fade);
    c = mix(c, ink, e2*.28*step(.5, nR(fp*.04 + 8.))*fade);
  }
  if (paperOn > .5) {
    float pap = fb2(fp*.35)*.8 + h12(floor(fp/1.5))*.2; c *= .955 + pap*.075;
    float speck = step(.995, h12(floor(fp/1.6) + 5.)); c = mix(c, c*.78, speck*.5);
    vec2 v = uv - .5; c *= 1. - dot(v, v)*.28;
    float asp = res.x/res.y, dd2 = min(min(uv.x, 1. - uv.x)*asp, min(uv.y, 1. - uv.y)); float rn = fb2(fp*.012)*.7 + nR(fp*.08)*.3;
    float m = smoothstep(0., .006, dd2 - .014 - (rn - .5)*.03);
    vec3 paper = vec3(.95, .925, .86)*(.97 + pap*.05);
    c = mix(paper, c, m);
  }
  o = vec4(c, 1.);
}`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer; this.size = new THREE.Vector2(); this.samples = 4; this.prepass = true;
    this.U = { tCol: { value: null }, tDep: { value: null }, res: { value: new THREE.Vector2() }, dpr: { value: 1 }, cnear: { value: .1 }, cfar: { value: 900 }, inkOn: { value: 1 }, paperOn: { value: 1 }, time: U.time,
      invVP: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, fogCol: U.fogCol, sunDir: U.sunDir, tNoise: U.tNoise };
    this.mat = new THREE.RawShaderMaterial({ vertexShader: POST_VS, fragmentShader: POST_FS, uniforms: this.U, glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  targets(w, h, samples) {
    if (this.rt && this.size.x === w && this.size.y === h && this.samples === samples) return;
    if (this.rt) { this.rt.depthTexture.dispose(); this.rt.dispose(); }
    this.size.set(w, h); this.samples = samples;
    const dt = new THREE.DepthTexture(w, h, THREE.UnsignedIntType); dt.minFilter = dt.magFilter = THREE.NearestFilter;
    this.rt = new THREE.WebGLRenderTarget(w, h, { depthTexture: dt, depthBuffer: true, samples, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.U.tCol.value = this.rt.texture; this.U.tDep.value = dt; this.U.res.value.set(w, h);
  }
  render(scene, camera, mid) {
    const R = this.renderer, U2 = this.U;
    R.setRenderTarget(this.rt); R.setClearColor(0x000000, 1); R.clear();
    if (this.prepass) { swapDepth(scene, true); R.render(scene, camera); swapDepth(scene, false); }
    R.render(scene, camera);
    if (mid) mid();
    U2.cnear.value = camera.near; U2.cfar.value = camera.far;
    U2.invVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    U2.camPos.value.copy(camera.position);
    R.setRenderTarget(null); R.render(this.qs, this.qc);
  }
}
