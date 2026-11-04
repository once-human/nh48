// /beta's people, on the new renderer: every body the game makes is still a real rig with its real clips, IK and
// props (so walking, punching, holding an umbrella, sitting on a bike all come from the game as they always did), but
// the game's meshes are never drawn. Each frame the bones of whoever's close go into one texture, and each part of a
// person (body, shirt, trousers, hair...) is one instanced draw that reads them. Those closest get a smoother body.
import * as THREE from 'three';
import { PU, LAMP } from '../gfx/paint.js';
import { RNG } from '@orig/core/util.js';

const TEX_W = 256, LOOK = 200, SLOTS = 96, CAST2 = 45*45;

// (called right after the kit is made: it must see every body from the first one)
export function trackBodies(kit) {
  const make = kit.create.bind(kit);
  kit.makeRaw = make; kit.bodies = new Set();
  kit.create = (look) => { const H = make(look), d = H.dispose; kit.bodies.add(H); H.dispose = () => { kit.bodies.delete(H); if (d) d(); }; return H; };
}

const VS = `precision highp float; precision highp sampler2D;
in vec3 position, normal, bp; in vec4 skinIndex, skinWeight; in vec2 uv; in float iSlot; in vec3 iCol;
uniform sampler2D tSkin; uniform mat4 viewMatrix, projectionMatrix;
out vec3 vN, vW, vB, vC; out vec2 vU; out float vZ; flat out int vS;
mat4 bone(int s, float f){ int x = int(f)*3; vec4 a = texelFetch(tSkin, ivec2(x, s), 0), b = texelFetch(tSkin, ivec2(x + 1, s), 0), c = texelFetch(tSkin, ivec2(x + 2, s), 0);
  return mat4(a.x, b.x, c.x, 0., a.y, b.y, c.y, 0., a.z, b.z, c.z, 0., a.w, b.w, c.w, 1.); }
void main(){ int s = int(iSlot + .5); vS = s;
  mat4 M = bone(s, skinIndex.x)*skinWeight.x + bone(s, skinIndex.y)*skinWeight.y + bone(s, skinIndex.z)*skinWeight.z + bone(s, skinIndex.w)*skinWeight.w;
  vec4 w = M*vec4(position, 1.); vW = w.xyz; vN = mat3(M)*normal; vB = bp; vC = iCol; vU = uv;
  vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const RIGID_VS = `precision highp float; in vec3 position, normal; in vec4 iM0, iM1, iM2, iM3; in vec3 iCol; uniform mat4 viewMatrix, projectionMatrix;
out vec3 vN, vW, vB, vC; out vec2 vU; out float vZ; flat out int vS;
void main(){ mat4 M = mat4(iM0, iM1, iM2, iM3); vec4 w = M*vec4(position, 1.); vW = w.xyz; vN = mat3(M)*normal; vB = position; vC = iCol; vU = vec2(0.); vS = 0; vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;

const SHADOW_VS = `precision highp float; precision highp sampler2D; in vec3 position; in vec4 skinIndex, skinWeight; in float iSlot; uniform sampler2D tSkin; uniform mat4 viewMatrix, projectionMatrix;
mat4 bone(int s, float f){ int x = int(f)*3; vec4 a = texelFetch(tSkin, ivec2(x, s), 0), b = texelFetch(tSkin, ivec2(x + 1, s), 0), c = texelFetch(tSkin, ivec2(x + 2, s), 0);
  return mat4(a.x, b.x, c.x, 0., a.y, b.y, c.y, 0., a.z, b.z, c.z, 0., a.w, b.w, c.w, 1.); }
void main(){ int s = int(iSlot + .5); mat4 M = bone(s, skinIndex.x)*skinWeight.x + bone(s, skinIndex.y)*skinWeight.y + bone(s, skinIndex.z)*skinWeight.z + bone(s, skinIndex.w)*skinWeight.w; gl_Position = projectionMatrix*viewMatrix*M*vec4(position, 1.); }`;
const SHADOW_RIGID = `precision highp float; in vec3 position; in vec4 iM0, iM1, iM2, iM3; uniform mat4 viewMatrix, projectionMatrix; void main(){ gl_Position = projectionMatrix*viewMatrix*mat4(iM0, iM1, iM2, iM3)*vec4(position, 1.); }`;
const SHADOW_FS = `precision highp float; out vec4 o; void main(){ o = vec4(0.); }`;
const COMMON = `precision highp float; precision highp sampler2D; precision highp sampler2DShadow;
in vec3 vN, vW, vB, vC; in vec2 vU; in float vZ; flat in int vS; out vec4 o;
uniform sampler2D tSkin, tMap, tNoise; uniform vec3 cameraPosition; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform vec3 sunDir, sunCol, shadeCol, fogCol; uniform float shadowTexel, shadowOn, fogDensity, dayK;
${LAMP}
vec4 LK(int i){ return texelFetch(tSkin, ivec2(${LOOK} + i, vS), 0); }
float nz(vec2 p){ return texture(tNoise, p/16.).r; }
// a little height on the surface, seen as light: folds, weave, pores
vec3 bump(vec3 n, vec3 w, float h){ vec3 sx = dFdx(w), sy = dFdy(w), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1); return normalize(abs(det)*n - sign(det)*(dFdx(h)*r1 + dFdy(h)*r2)); }
float shadowAt(vec3 w, vec3 n){ vec4 s = shadowMat*vec4(w + n*(.05 + .002*vZ), 1.); if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  float z = s.z - .0006; return .5*(texture(shadowTex, vec3(s.xy + vec2(-.6, .3)*shadowTexel, z)) + texture(shadowTex, vec3(s.xy + vec2(.6, -.3)*shadowTexel, z))); }
// two tones with a brushed edge, a warm glow where the light turns on skin, grey pencil in the shade, the rim the sky leaves
vec3 paint(vec3 b, vec3 n, vec3 w, float sss){
  float e = nz(gl_FragCoord.xy*.11) - .5, ndl = dot(n, sunDir), lit = smoothstep(.0, .14, ndl + e*.12);
  float sh = (shadowOn > .5 && lit > 0.) ? smoothstep(.3, .7, shadowAt(w, n) + e*.3) : 1., L = lit*sh*dayK;
  vec3 cl = b*sunCol, cs = b*shadeCol*(.92 + .16*max(n.y, 0.)) + vec3(.02)*dayK;
  cs += b*vec3(.2, .075, .04)*sss*smoothstep(-.35, .05, ndl);
  vec3 c = mix(cs, cl, L) + b*lampAt(w, n);
  float h = smoothstep(.5, .72, fract((gl_FragCoord.x + gl_FragCoord.y)*.17 + e*.9))*(1. - L)*(1. - smoothstep(10., 34., vZ));
  c = mix(c, c*.7, h*.6);
  float f = fogDensity*vZ; return mix(c, fogCol, 1. - exp(-f*f));
}
vec3 N(){ vec3 n = normalize(vN); return gl_FrontFacing ? n : -n; }
`;
// the body: skin from the model's own texture, the clothes it shows at the cuffs and collar, nothing under the cloth
const BODY = COMMON + `void main(){
  vec3 tex = texture(tMap, vU).rgb, p = vB, top = LK(0).rgb, bot = LK(1).rgb, uSkin = LK(2).rgb, shoe = LK(3).rgb; vec4 cut = LK(4), sty = LK(5), fit = LK(7), arms = LK(8), bd = LK(9);
  float ax = abs(p.x), hip = bd.x, neck = bd.y; const vec3 REF = vec3(.40, .18, .085);
  float l = dot(tex, vec3(.3, .55, .15))/dot(REF, vec3(.3, .55, .15));
  vec3 skin = uSkin*mix(vec3(l), tex/REF, .42); skin = mix(vec3(dot(skin, vec3(.3, .55, .15))), skin, .74);
  vec3 col = skin; float cloth = 0.; bool arm = ax > arms.x && p.y > bd.z; float t = (ax - arms.x)/(arms.y - arms.x);
  if (arm) { if (t < arms.w) { col = top; cloth = 1.; } }
  else if (p.y > neck) col = skin;
  else if (p.y > hip) { col = top; cloth = 1.; bool tuck = cut.y > .9 && (cut.w < 1.5 || cut.w > 2.5);
    if (tuck && p.y < fit.x) col = p.y > fit.x - .022 && cut.w < 1.5 ? bot*.42 : bot;
    if (p.z > 0. && p.y > neck - .07 - cut.z*.05 && ax < (p.y - (neck - .07 - cut.z*.05))*.9 + .012) { col = skin; cloth = 0.; } }
  else { col = p.y > cut.y*hip ? top : bot; cloth = 1.;
    if (cut.w > 1.5 && cut.w < 2.5 && p.y < cut.y*hip) col = mix(bot, top, step(.5, fract(p.y*3.))*.12);
    if (cut.w > 2.5 && p.y < sty.y*hip) { col = skin; cloth = 0.; }
    if (p.y < bd.w) col = shoe; }
  bool torsoIn = !arm && p.y > (cut.y > .9 && (cut.w < 1.5 || cut.w > 2.5) ? fit.x + .03 : hip + .03) && p.y < neck - .045;
  if (p.y > neck - .11 && ax > .07 && t < .22) torsoIn = false;
  bool armIn = arm && t < arms.w - .07 && t > .22, legIn = p.y < hip - .03 && p.y > bd.w + .03 && (cut.w < 2.5 || p.y > sty.y*hip + .03), footIn = p.y < bd.w - .015;
  if (torsoIn || armIn || legIn || footIn) discard;
  vec3 n = N(); float near = 1. - smoothstep(1.5, 7., vZ);
  if (cloth > .5) col *= .92;
  else {
    float pore = nz(p.xy*vec2(95., 110.) + p.z*80.)*.6 + nz(p.yz*vec2(40., 52.))*.4;
    col *= 1. + (pore - .5)*.12*near; n = bump(n, vW, pore*.0016*near);
    vec3 V = normalize(cameraPosition - vW); float sp = pow(max(dot(n, normalize(V + sunDir)), 0.), 22.);
    o = vec4(paint(col, n, vW, 1.) + sunCol*col*sp*.28*dayK*(1. - smoothstep(0., 22., vZ)), 1.); return;
  }
  o = vec4(paint(col, n, vW, 1. - cloth), 1.); }`;
// the clothes: cut and patterned by where they sit on the body; a weave and soft folds up close
const CLOTH = COMMON + `uniform float uWhich; void main(){
  vec3 p = vB, col = vC, pc = LK(6).rgb; vec4 sty = LK(5), fit = LK(7), arm = LK(8); float pt = sty.x;
  if (uWhich > 1.5 && uWhich < 2.5 && sty.y > .01 && p.y < sty.y*fit.w) discard;
  if (uWhich < .5 && abs(p.x) > arm.x && p.y > arm.z && (abs(p.x) - arm.x)/(arm.y - arm.x) > arm.w + .012) discard;
  if (uWhich < .5 && p.y < fit.x - (fit.z > .5 && fit.z < 2.5 ? .06 : .015)) discard;
  if (uWhich > .5 && uWhich < 1.5 && (fit.z > .5 && fit.z < 1.5 && p.y > fit.y + .04)) discard;
  if (uWhich < .5 || uWhich > 2.5) {
    if (pt > .5 && pt < 1.5) col = mix(col, pc, step(.5, fract(p.y*16.)));
    else if (pt > 1.5 && pt < 2.5) col = mix(col, pc, (step(.5, fract(p.x*11.)) + step(.5, fract(p.y*11.)))*.33);
    else if (pt > 3.5 && pt < 4.5) { vec2 g = fract(vec2(p.x + p.z, p.y)*22.) - .5; col = mix(col, pc, step(length(g), .17)); }
    else if (pt > 4.5 && pt < 5.5) { col = mix(col, pc, step(abs(p.x), .065)*step(0., p.z)*step(p.y, 1.47)); if (abs(abs(p.x) - .07) < .008 && p.z > 0.) col *= .55; }
    else if (pt > 5.5) col = mix(col, pc, step(1.22, p.y));
  } else if ((pt > 2.5 && pt < 3.5) || sty.z > .5) {
    float n = fract(sin(dot(floor(vec2(p.x*260. + p.y*260., p.y*90.)), vec2(127.1, 311.7)))*43758.5453);
    col *= .9 + n*.16; col = mix(col, col*1.35, smoothstep(.03, .12, p.z)*smoothstep(.45, .75, p.y)*.5);
  }
  float near = 1. - smoothstep(3., 11., vZ), close = 1. - smoothstep(1.5, 6., vZ), ax = abs(p.x), f = nz(vec2(p.x + p.z*.7, p.y*.4)*5.)*.65 + nz(vec2(p.x - p.z*.5, p.y*.9)*13.)*.35, s = 0.;
  // long soft folds down the body, and where it bends the cloth bunches across: at the waist, under the arms, the elbows, the knees
  if (uWhich > .5 && uWhich < 1.5) {
    f += .6*(smoothstep(.09, .0, abs(p.y - .5)) + smoothstep(.1, .0, abs(p.y - fit.y + .14)))*nz(vec2(ax*8., p.y*30.));
    s = max(step(abs(p.z), .0035)*step(.5, fract(p.y*130.)), smoothstep(.004, .0, abs(p.y - fit.y + .045))*step(.4, fract((p.x + p.z)*150.)));
    s = max(s, smoothstep(.004, .0, abs(p.x))*step(.0, p.z)*step(p.y, fit.y - .05)*step(fit.y - .22, p.y));       // the fly
  } else if (uWhich < .5 || uWhich > 2.5) {
    bool sl = ax > arm.x && p.y > arm.z; float t = (ax - arm.x)/(arm.y - arm.x);
    if (sl) { f += .7*smoothstep(.1, .0, abs(t - .5))*nz(vec2(t*6., p.y*38.)); s = smoothstep(.012, .0, abs(t - arm.w + .03))*step(.4, fract((p.y + p.z)*150.)); }
    else {
      f += .6*smoothstep(.17, .0, p.y - fit.x)*nz(vec2(ax*7., p.y*34.));                                         // bunched at the waist
      f += .5*smoothstep(.09, .0, ax - arm.x + .02)*smoothstep(.2, .0, abs(p.y - arm.z + .1))*nz(vec2(p.y*30., p.z*25.)); // under the arm
      if (uWhich < .5) { float hem = fit.x - (fit.z > .5 && fit.z < 2.5 ? .06 : .015); s = smoothstep(.0035, .0, abs(p.y - hem - .014))*step(.4, fract((p.x + p.z)*150.)); }
    }
  }
  col *= .9 + .2*f;
  col *= 1. + near*.05*(sin(p.y*1100.) + sin((p.x + p.z)*1100.));                       // the weave
  col *= 1. - .32*s*close;
  o = vec4(paint(col, bump(normalize(vN), vW, f*.009*near), vW, 0.), 1.); }`;
const SHOE = COMMON + `void main(){ vec3 c = vC, n = N(); float near = 1. - smoothstep(1.5, 7., vZ); if (vB.y < .028) c *= .3; c *= .94 + .1*nz(vB.xz*30.);
  if (vB.y > .05 && vB.z > .02 && abs(vB.x) < .4) c = mix(c, min(c*1.5 + .08, vec3(1.)), smoothstep(.02, .0, abs(fract(vB.z*38.) - .5))*near*.55);   // the laces
  float l = smoothstep(.034, .03, abs(vB.y - .034)); c *= 1. - .25*l*near; o = vec4(paint(c, bump(n, vW, nz(vB.xz*60.)*.001*near), vW, 0.), 1.); }`;
const HAIR = COMMON + `void main(){ vec3 c = texture(tMap, vU).rgb*vC*1.2, n = N(); float st = fract(vU.x*90. + nz(vU*40.)*.8); c *= .82 + .36*smoothstep(.3, .7, st); n = bump(n, vW, st*.004*(1. - smoothstep(1.5, 8., vZ)));
  float sh = pow(max(dot(n, normalize(sunDir + vec3(0., .4, 0.))), 0.), 14.)*.2; o = vec4(paint(c + sh*vec3(.75, .68, .6), n, vW, 0.), 1.); }`;
const EYES = COMMON + `void main(){ o = vec4(paint(texture(tMap, vU).rgb, N(), vW, 0.) + .04, 1.); }`;
const PLAIN = COMMON + `void main(){ o = vec4(paint(vC, N(), vW, 0.), 1.); }`;

const v3 = new THREE.Vector3(), n3 = new THREE.Matrix3();

// one smoothing split: each triangle into four, the new points lifted onto the curve the normals describe
function subdivide(A) {
  const { pos, nor, uv, bp, si, sw, idx } = A, nv0 = pos.length/3, edge = new Map();
  const P = [...pos], Nn = [...nor], U = [...uv], B = [...bp], SI = [...si], SW = [...sw], I = [];
  const mid = (a, b) => {
    const k = a < b ? a*2097152 + b : b*2097152 + a; let m = edge.get(k); if (m !== undefined) return m;
    m = P.length/3; edge.set(k, m);
    const pa = [pos[a*3], pos[a*3 + 1], pos[a*3 + 2]], pb = [pos[b*3], pos[b*3 + 1], pos[b*3 + 2]], na = [nor[a*3], nor[a*3 + 1], nor[a*3 + 2]], nb = [nor[b*3], nor[b*3 + 1], nor[b*3 + 2]];
    let da = 0, db = 0; const c = [0, 0, 0]; for (let i = 0; i < 3; i++) { c[i] = (pa[i] + pb[i])*.5; da += (c[i] - pa[i])*na[i]; db += (c[i] - pb[i])*nb[i]; }
    let nx = na[0] + nb[0], ny = na[1] + nb[1], nz = na[2] + nb[2]; const l = Math.hypot(nx, ny, nz) || 1;
    for (let i = 0; i < 3; i++) P.push(c[i] - (da*na[i] + db*nb[i])*.35);
    Nn.push(nx/l, ny/l, nz/l); U.push((uv[a*2] + uv[b*2])*.5, (uv[a*2 + 1] + uv[b*2 + 1])*.5);
    for (let i = 0; i < 3; i++) B.push((bp[a*3 + i] + bp[b*3 + i])*.5);
    const W = new Map(); for (let i = 0; i < 4; i++) { W.set(si[a*4 + i], (W.get(si[a*4 + i]) || 0) + sw[a*4 + i]*.5); W.set(si[b*4 + i], (W.get(si[b*4 + i]) || 0) + sw[b*4 + i]*.5); }
    const top = [...W.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4); let s = 0; for (const t of top) s += t[1];
    for (let i = 0; i < 4; i++) { SI.push(top[i] ? top[i][0] : 0); SW.push(top[i] ? top[i][1]/(s || 1) : 0); }
    return m;
  };
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); I.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); }
  return { pos: P, nor: Nn, uv: U, bp: B, si: SI, sw: SW, idx: I, nv0 };
}
function arrays(o, kit, k) {
  const g = o.geometry, pa = g.attributes.position, na = g.attributes.normal, n = pa.count, bm = o.bindMatrix, pos = new Array(n*3), nor = new Array(n*3), uv = new Array(n*2), bp = new Array(n*3), si = new Array(n*4), sw = new Array(n*4);
  n3.getNormalMatrix(bm); const ub = g.attributes.bpos, uva = g.attributes.uv, isBody = o.name.startsWith('body'), bind = kit.bindM && kit.bindM[k];
  for (let i = 0; i < n; i++) {
    v3.fromBufferAttribute(pa, i);
    if (ub) { bp[i*3] = ub.getX(i); bp[i*3 + 1] = ub.getY(i); bp[i*3 + 2] = ub.getZ(i); }
    else if (isBody && bind) { const q = v3.clone().applyMatrix4(bind); bp[i*3] = q.x; bp[i*3 + 1] = q.y; bp[i*3 + 2] = q.z; }
    else { bp[i*3] = v3.x; bp[i*3 + 1] = v3.y; bp[i*3 + 2] = v3.z; }
    v3.applyMatrix4(bm); pos[i*3] = v3.x; pos[i*3 + 1] = v3.y; pos[i*3 + 2] = v3.z;
    v3.fromBufferAttribute(na, i).applyMatrix3(n3).normalize(); nor[i*3] = v3.x; nor[i*3 + 1] = v3.y; nor[i*3 + 2] = v3.z;
    uv[i*2] = uva ? uva.getX(i) : 0; uv[i*2 + 1] = uva ? uva.getY(i) : 0;
    for (let c = 0; c < 4; c++) { si[i*4 + c] = g.attributes.skinIndex.getComponent(i, c); sw[i*4 + c] = g.attributes.skinWeight.getComponent(i, c); }
  }
  const idx = g.index ? Array.from(g.index.array) : Array.from({ length: n }, (_, i) => i);
  return { pos, nor, uv, bp, si, sw, idx };
}

export class Skin {
  constructor(kit, scene) {
    this.kit = kit; this.scene = scene; this.max = 64; this.hiR = 12; this.n = 0; this.frame = 0;
    this.data = new Float32Array(TEX_W*SLOTS*4);
    this.tex = new THREE.DataTexture(this.data, TEX_W, SLOTS, THREE.RGBAFormat, THREE.FloatType); this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter; this.tex.generateMipmaps = false; this.tex.needsUpdate = true;
    this.parts = { m: new Map(), f: new Map() }; this.rigid = new Map(); this.prog = new Map();
    for (const k of ['m', 'f']) this.buildBody(k);
  }
  material(type, map) {
    const key = type + (map ? map.uuid : '');
    let m = this.prog.get(key); if (m) return m;
    const fs = { body: BODY, cloth0: CLOTH, cloth1: CLOTH, cloth2: CLOTH, cloth3: CLOTH, shoe: SHOE, hair: HAIR, eyes: EYES, plain: PLAIN }[type];
    const un = Object.assign({}, PU, { tSkin: { value: this.tex }, tMap: { value: map || null } }); if (type.startsWith('cloth')) un.uWhich = { value: +type[5] };
    m = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: un, glslVersion: THREE.GLSL3, side: /cloth/.test(type) ? THREE.DoubleSide : THREE.FrontSide });
    if (type === 'cloth0' || type === 'hair') { m.polygonOffset = true; m.polygonOffsetFactor = type === 'hair' ? -2 : -1; m.polygonOffsetUnits = type === 'hair' ? -6 : -2; }
    if (type === 'plain') { m.polygonOffset = true; m.polygonOffsetFactor = -3; m.polygonOffsetUnits = -8; }
    this.prog.set(key, m); return m;
  }
  typeOf(n) { return n.startsWith('body') ? 'body' : n.startsWith('eyes') ? 'eyes' : n.startsWith('hair') || n.startsWith('face') ? 'hair' : n === 'cloth_pants' ? 'cloth1' : n === 'cloth_shoes' ? 'shoe' : n === 'cloth_saree' ? 'cloth2' : n === 'cloth_kurta' ? 'cloth3' : n.startsWith('cloth') ? 'cloth0' : 'plain'; }
  buildBody(k) {
    const K = this.kit, H = K.makeRaw(K.randomLook(new RNG(7), { female: k === 'f' }));
    H.holder.updateMatrixWorld(true);
    H.holder.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const type = this.typeOf(o.name), map = type === 'body' ? K.maps[k] : type === 'hair' ? K.hairMat[k] : type === 'eyes' ? o.material.map : null;
      const A = arrays(o, K, k), rec = { lo: this.mesh(A, type, map) };
      if (/^(body|cloth|hair)/.test(type)) rec.sh = this.shadowOf(rec.lo);
      if (['body', 'cloth0', 'cloth1', 'cloth2', 'cloth3', 'shoe', 'hair'].includes(type)) rec.hi = this.mesh(subdivide(A), type, map);
      this.parts[k].set(o.name, rec);
    });
  }
  mesh(A, type, map) {
    const g = new THREE.InstancedBufferGeometry(), F = (a, n) => g.setAttribute(n[0], new THREE.BufferAttribute(new Float32Array(a), n[1]));
    F(A.pos, ['position', 3]); F(A.nor, ['normal', 3]); F(A.uv, ['uv', 2]); F(A.bp, ['bp', 3]); F(A.si, ['skinIndex', 4]); F(A.sw, ['skinWeight', 4]);
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(A.idx), 1));
    g.setAttribute('iSlot', new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array(SLOTS*3), 3).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const m = new THREE.Mesh(g, this.material(type, map)); m.frustumCulled = false; m.visible = false; m.renderOrder = -2; m.fill = 0; this.scene.add(m);
    return m;
  }
  // who's close enough to cast does it with the plain body, in a mesh only the shadow pass draws
  shadowOf(lo) {
    const g = new THREE.InstancedBufferGeometry(), L = lo.geometry; for (const n of ['position', 'skinIndex', 'skinWeight']) g.setAttribute(n, L.attributes[n]); g.setIndex(L.index);
    g.setAttribute('iSlot', new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage)); g.instanceCount = 0;
    const m = new THREE.Mesh(g, lo.material); m.frustumCulled = false; m.visible = false; m.fill = 0; m.castShadow = true; m.shadowOnly = true; m.layers.set(8);
    m.customDepthMaterial = this.shadowMat || (this.shadowMat = new THREE.RawShaderMaterial({ vertexShader: SHADOW_VS, fragmentShader: SHADOW_FS, uniforms: { tSkin: { value: this.tex } }, glslVersion: THREE.GLSL3, side: THREE.DoubleSide, colorWrite: false }));
    this.scene.add(m); return m;
  }
  rigidOf(geo) {
    let r = this.rigid.get(geo.uuid); if (r) return r;
    const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal); if (geo.index) g.setIndex(geo.index);
    const cap = 48; for (let i = 0; i < 4; i++) g.setAttribute('iM' + i, new THREE.InstancedBufferAttribute(new Float32Array(cap*4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array(cap*3), 3).setUsage(THREE.DynamicDrawUsage)); g.instanceCount = 0;
    if (!this.rigidMat) { const un = Object.assign({}, PU, { tSkin: { value: this.tex }, tMap: { value: null } }); this.rigidMat = new THREE.RawShaderMaterial({ vertexShader: RIGID_VS, fragmentShader: PLAIN, uniforms: un, glslVersion: THREE.GLSL3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 }); }
    const m = new THREE.Mesh(g, this.rigidMat); m.frustumCulled = false; m.visible = false; m.renderOrder = -2; m.cap = cap; m.fill = 0; this.scene.add(m);
    m.castShadow = true; m.customDepthMaterial = this.rigidShadow || (this.rigidShadow = new THREE.RawShaderMaterial({ vertexShader: SHADOW_RIGID, fragmentShader: SHADOW_FS, glslVersion: THREE.GLSL3, side: THREE.DoubleSide, colorWrite: false }));
    this.rigid.set(geo.uuid, m); return m;
  }
  // what a body is made of: the game's meshes go on a layer no camera looks at
  scan(H) {
    H._sk = []; H._rg = [];
    H.holder.traverse((o) => { if (o.isSkinnedMesh) { o.layers.set(5); H._sk.push(o); } else if (o.isMesh) { o.layers.set(5); if (o.geometry.attributes.normal) H._rg.push(o); } });
  }
  update(camera, playerH) {
    const K = this.kit, cx = camera.position.x, cz = camera.position.z, near = [];
    camera.getWorldDirection(v3); const fx = v3.x, fz = v3.z;
    this.frame++;
    for (const H of K.bodies) {
      if (!H._sk || this.frame%45 === 0) this.scan(H);
      if (!H.holder.visible) continue;
      let o = H.holder, on = true; while (o.parent) { o = o.parent; if (!o.visible) { on = false; break; } } if (!on || !o.isScene) continue;
      const p = H.holder.position, dx = p.x - cx, dz = p.z - cz, d2 = dx*dx + dz*dz;
      if (d2 > 25 && dx*fx + dz*fz < -3) continue;       // behind you
      H._d2 = H === playerH ? -1 : d2; near.push(H);
    }
    near.sort((a, b) => a._d2 - b._d2);
    for (const M of this.parts.m.values()) { M.lo.fill = 0; if (M.hi) M.hi.fill = 0; if (M.sh) M.sh.fill = 0; } for (const M of this.parts.f.values()) { M.lo.fill = 0; if (M.hi) M.hi.fill = 0; if (M.sh) M.sh.fill = 0; } for (const r of this.rigid.values()) r.fill = 0;
    const D = this.data, n = Math.min(near.length, this.max, SLOTS), hi2 = this.hiR*this.hiR;
    for (let s = 0; s < n; s++) {
      const H = near[s], k = H.look && H.look.female ? 'f' : 'm', row = s*TEX_W*4;
      H.holder.updateWorldMatrix(true, true);
      const sk = H.body.skeleton; sk.update(); const m = sk.boneMatrices, nb = Math.min(sk.bones.length, Math.floor(LOOK/3));
      for (let b = 0; b < nb; b++) { const i = b*16, o = row + b*12; D[o] = m[i]; D[o + 1] = m[i + 4]; D[o + 2] = m[i + 8]; D[o + 3] = m[i + 12]; D[o + 4] = m[i + 1]; D[o + 5] = m[i + 5]; D[o + 6] = m[i + 9]; D[o + 7] = m[i + 13]; D[o + 8] = m[i + 2]; D[o + 9] = m[i + 6]; D[o + 10] = m[i + 10]; D[o + 11] = m[i + 14]; }
      const u = H.mat.userData, O = row + LOOK*4, col = (i, c) => { D[O + i*4] = c.r; D[O + i*4 + 1] = c.g; D[O + i*4 + 2] = c.b; }, vec = (i, q) => { D[O + i*4] = q.x; D[O + i*4 + 1] = q.y; D[O + i*4 + 2] = q.z; D[O + i*4 + 3] = q.w; };
      col(0, u.top); col(1, u.bottom); col(2, u.skin); col(3, u.shoe); vec(4, u.cut); vec(5, H.style); col(6, H.pat); vec(7, H.fit); vec(8, H.arm); vec(9, u.body);
      for (const o of H._sk) {
        if (!o.visible) continue;
        const R = this.parts[k].get(o.name); if (!R) continue;
        const P = (H._d2 < hi2 && R.hi) ? R.hi : R.lo, c = o.material.color, A = P.geometry.attributes, j = P.fill++; if (j >= SLOTS) continue;
        A.iSlot.array[j] = s; A.iCol.array[j*3] = c.r; A.iCol.array[j*3 + 1] = c.g; A.iCol.array[j*3 + 2] = c.b;
        if (R.sh && H._d2 < CAST2) R.sh.geometry.attributes.iSlot.array[R.sh.fill++] = s;
      }
      for (const o of H._rg) {
        let on = o.visible, q = o.parent; while (on && q && q !== H.holder) { on = q.visible; q = q.parent; } if (!on) continue;
        const r = this.rigidOf(o.geometry), j = r.fill++; if (j >= r.cap) continue;
        const A = r.geometry.attributes, E = o.matrixWorld.elements, c = o.material.color || { r: .5, g: .5, b: .5 };
        for (let i = 0; i < 4; i++) { const a = A['iM' + i].array; a[j*4] = E[i*4]; a[j*4 + 1] = E[i*4 + 1]; a[j*4 + 2] = E[i*4 + 2]; a[j*4 + 3] = E[i*4 + 3]; }
        A.iCol.array[j*3] = c.r; A.iCol.array[j*3 + 1] = c.g; A.iCol.array[j*3 + 2] = c.b;
      }
    }
    this.n = n; this.tex.needsUpdate = n > 0;
    const done = (P) => { const c = Math.min(P.fill, P.cap || SLOTS); P.visible = c > 0; if (!c) return; P.geometry.instanceCount = c; const A = P.geometry.attributes; if (A.iCol) A.iCol.needsUpdate = true; if (A.iSlot) A.iSlot.needsUpdate = true; else for (let i = 0; i < 4; i++) A['iM' + i].needsUpdate = true; };
    for (const M of [this.parts.m, this.parts.f]) for (const R of M.values()) { done(R.lo); if (R.hi) done(R.hi); if (R.sh) done(R.sh); }
    for (const r of this.rigid.values()) done(r);
    return near.slice(0, n);
  }
}
