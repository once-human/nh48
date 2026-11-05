// /beta's people, on the new renderer: every body the game makes is still a real rig with its real clips, IK and
// props (so walking, punching, holding an umbrella, sitting on a bike all come from the game as they always did), but
// the game's meshes are never drawn. Each frame the bones of whoever's close go into one texture, and each part of a
// person (body, shirt, trousers, hair...) is one instanced draw that reads them. Those closest get a smoother body.
import * as THREE from 'three';
const _hp = new THREE.Vector3();
// where your head is (w 1 once it's found): any camera inside it, your own eyes, doesn't draw it; every other one does
const HEAD = { value: new THREE.Vector4() };
import { PU, LAMP, PCF } from '../gfx/paint.js';
import { RNG } from '@orig/core/util.js';
import { Wardrobe, buildCloth, dress } from './wardrobe.js';

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
const RIGID_VS = `precision highp float; in vec3 position, normal; in float sway; in vec4 iM0, iM1, iM2, iM3; in vec3 iCol; uniform mat4 viewMatrix, projectionMatrix; uniform float uTime;
out vec3 vN, vW, vB, vC; out vec2 vU; out float vZ; flat out int vS;
void main(){ mat4 M = mat4(iM0, iM1, iM2, iM3); vec4 w = M*vec4(position, 1.); if (sway > 0.) { float ph = uTime*2.6 + M[3].x*1.7 + M[3].z*1.3; w.xz += vec2(sin(ph), cos(ph*.8))*sway*.022; } vW = w.xyz; vN = mat3(M)*normal; vB = position; vC = iCol; vU = vec2(0.); vS = -1; vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;

const SHADOW_VS = `precision highp float; precision highp sampler2D; in vec3 position; in vec4 skinIndex, skinWeight; in float iSlot; uniform sampler2D tSkin; uniform mat4 viewMatrix, projectionMatrix;
mat4 bone(int s, float f){ int x = int(f)*3; vec4 a = texelFetch(tSkin, ivec2(x, s), 0), b = texelFetch(tSkin, ivec2(x + 1, s), 0), c = texelFetch(tSkin, ivec2(x + 2, s), 0);
  return mat4(a.x, b.x, c.x, 0., a.y, b.y, c.y, 0., a.z, b.z, c.z, 0., a.w, b.w, c.w, 1.); }
void main(){ int s = int(iSlot + .5); mat4 M = bone(s, skinIndex.x)*skinWeight.x + bone(s, skinIndex.y)*skinWeight.y + bone(s, skinIndex.z)*skinWeight.z + bone(s, skinIndex.w)*skinWeight.w; gl_Position = projectionMatrix*viewMatrix*M*vec4(position, 1.); }`;
const SHADOW_RIGID = `precision highp float; in vec3 position; in vec4 iM0, iM1, iM2, iM3; uniform mat4 viewMatrix, projectionMatrix; void main(){ gl_Position = projectionMatrix*viewMatrix*mat4(iM0, iM1, iM2, iM3)*vec4(position, 1.); }`;
const SHADOW_FS = `precision highp float; out vec4 o; void main(){ o = vec4(0.); }`;
const COMMON = `precision highp float; precision highp sampler2D; precision highp sampler2DShadow;
in vec3 vN, vW, vB, vC; in vec2 vU; in float vZ; flat in int vS; out vec4 o;
uniform sampler2D tSkin, tMap, tNoise; uniform vec3 cameraPosition; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform vec3 sunDir, sunCol, shadeCol, fogCol; uniform float shadowTexel, shadowOn, fogDensity, dayK;
uniform vec4 uHead;
${LAMP}
vec4 LK(int i){ return texelFetch(tSkin, ivec2(${LOOK} + i, vS), 0); }
// seated in a car: nothing of you below the car's floor (the legs would show under the body). And a camera looking out
// from inside your head (your own eyes, first person) sees out past it: for that camera alone the head, hair, helmet and
// glasses above the neck aren't drawn. Every other view of you (a mirror, a cutscene, someone else) has the whole head.
bool inHead(vec4 h){ return h.w > .5 && distance(cameraPosition, h.xyz) < .45; }
bool seatClip(){ if (vS < 0) return inHead(uHead) && vW.y > uHead.y && length(vW.xz - uHead.xz) < .22;
  vec4 c = LK(10); if (c.w > .5 && vW.y < c.x) return true; vec4 h = LK(11); return inHead(h) && ((vW.y > h.y && length(vW.xz - h.xz) < .2) || distance(vW, cameraPosition) < .17); }
float nz(vec2 p){ return texture(tNoise, p/16.).r; }
// a little height on the surface, seen as light: folds, weave, pores
vec3 bump(vec3 n, vec3 w, float h){ vec3 sx = dFdx(w), sy = dFdy(w), r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1); return normalize(abs(det)*n - sign(det)*(dFdx(h)*r1 + dFdy(h)*r2)); }
${PCF}
float shadowAt(vec3 w, vec3 n){ vec4 s = shadowMat*vec4(w + n*(.05 + .002*vZ), 1.); if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  return shadowPCF(vec3(s.xy, s.z - .0006)); }
// two tones with a brushed edge, a warm glow where the light turns on skin, grey pencil in the shade, the rim the sky leaves
vec3 paint(vec3 b, vec3 n, vec3 w, float sss){
  float e = (nz(gl_FragCoord.xy*.11) - .5)*(1. - uReal), ndl = dot(n, sunDir), lit = sunOn(ndl, e*.12, .0, .14);
  float sh = (shadowOn > .5 && lit > 0.) ? shadeOf(shadowAt(w, n), e*.3) : 1., L = lit*sh*dayK;
  vec3 cl = sunRoll(b*sunCol), cs = b*shadeCol*(.92 + .16*max(n.y, 0.)) + vec3(.02)*dayK;
  cs += b*vec3(.2, .075, .04)*sss*smoothstep(-.35, .05, ndl);
  vec3 c = mix(cs, cl, L) + b*lampAt(w, n);
  float h = smoothstep(.5, .72, fract((gl_FragCoord.x + gl_FragCoord.y)*.17 + e*.9))*(1. - L)*(1. - smoothstep(10., 34., vZ));
  c = mix(c, c*.7, h*.6*(1. - uReal));
  float f = fogDensity*vZ; return mix(c, fogCol, 1. - exp(-f*f));
}
vec3 N(){ vec3 n = normalize(vN); return gl_FrontFacing ? n : -n; }
`;
// the body: skin from the model's own texture, the clothes it shows at the cuffs and collar, nothing under the cloth
const BODY = COMMON + `void main(){ if (seatClip()) discard;
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
const CLOTH = COMMON + `uniform float uWhich; void main(){ if (seatClip()) discard;
  vec3 p = vB, col = vC, pc = LK(6).rgb; vec4 sty = LK(5), fit = LK(7), arm = LK(8); float pt = sty.x, ck = sty.w;
  if (ck > .5 && uWhich < .5) pt = 0.;                     // (a blouse, or the shoulders of a kurta: the same plain cloth)
  if (ck > 1.5 && uWhich < .5 && fit.z > .5 && fit.z < 1.5) { float u = fract(atan(p.z, p.x)/6.2832 + 1.), t = (.427 - p.y + .9)/.912, nr = 1. - smoothstep(3., 16., vZ); if (ck < 2.5) { vec2 g = fract(vec2(u*42. + floor(t*18.)*.5, t*18.)) - .5; col = mix(col, pc, step(length(g), .17)*.8*nr); } else if (ck < 3.5) col = mix(col, pc, step(.72, fract(u*34.))*.65); else { vec2 g = fract(vec2(u*70., t*30.)) - .5; col = mix(col, pc, step(abs(g.x) + abs(g.y), .22)*.6*nr); } }
  // sarees, kurtas, a pallu, a dupatta: one length of one cloth, with its border woven in
  if (vU.x > 1.2 || uWhich > 1.5) {
    bool band = vU.x > 1.2; float near0 = 1. - smoothstep(3., 16., vZ), t = vU.y, fold = nz(vec2(vU.x*7. + t*2., t*5.))*.6 + nz(vec2(vU.x*19., t*11.))*.4;
    vec3 zari = ck > .5 ? pc : vec3(.8, .6, .22), c2 = col;
    if (band) { float u = abs(vU.x - 2.)*2.; c2 = mix(c2, zari, smoothstep(.86, .875, u)); c2 = mix(c2, zari*.75, smoothstep(.77, .78, u)*(1. - smoothstep(.80, .81, u))); c2 = mix(c2, zari, smoothstep(.93, .94, t));
      if (ck > 1.5 && ck < 2.5) { vec2 g = fract(vec2(vU.x*9., t*22.)) - .5; c2 = mix(c2, zari, step(length(g), .15)*.8*near0); } else if (ck > 2.5 && ck < 3.5) c2 = mix(c2, col*.72, step(.5, fract(vU.x*14.))*.7); else if (ck > 3.5) { vec2 g = fract(vec2(vU.x*16. + floor(t*32.)*.5, t*32.)) - .5; c2 = mix(c2, zari*.85, step(length(g), .2)*.45*near0); }
      c2 *= .84 + .16*sin(vU.x*58. + fold*3.) + .22*fold; }
    else if (uWhich > 2.5) { // a kurta: the hem and cuffs bordered, a side slit
      float ang = atan(p.z, p.x), side = min(abs(ang), abs(abs(ang) - 3.1416));
      if (t > .74 && side < .004 + (t - .74)*.035) discard;
      c2 = mix(c2, pc*.9 + zari*.2, smoothstep(.955, .96, t)); c2 = mix(c2, zari*.8, smoothstep(.93, .935, t)*(1. - smoothstep(.942, .948, t)));
      if (ck > 1.5 && ck < 2.5) { vec2 g = fract(vec2(vU.x*42. + floor(t*18.)*.5, t*18.)) - .5; c2 = mix(c2, pc, step(length(g), .17)*.8*near0); } else if (ck > 2.5 && ck < 3.5) c2 = mix(c2, pc, step(.72, fract(vU.x*34.))*.65); else if (ck > 3.5) { vec2 g = fract(vec2(vU.x*70., t*30.)) - .5; c2 = mix(c2, pc, step(abs(g.x) + abs(g.y), .22)*.6*near0); }
      c2 *= .9 + .24*fold;
    } else { // a saree's body: pleats falling, a woven border at the foot
      float ang = atan(p.z, p.x), fr = smoothstep(.95, .15, abs(ang - 1.57));
      c2 *= .95 + .1*sin(ang*30.)*fr*smoothstep(.02, .15, t);
      c2 = mix(c2, zari, smoothstep(.955, .96, t)); c2 = mix(c2, zari*.75, smoothstep(.93, .933, t)*(1. - smoothstep(.942, .945, t)));
      if (ck > 1.5 && ck < 2.5) { vec2 g = fract(vec2(vU.x*38. + floor(t*15.)*.5, t*15.)) - .5; c2 = mix(c2, zari, step(length(g), .1)*.7*near0*step(t, .88)); } else if (ck > 2.5 && ck < 3.5) c2 = mix(c2, col*.72, step(.5, fract(vU.x*56.))*.6*step(t, .9)); else if (ck > 3.5) { vec2 g = fract(vec2(vU.x*72. + floor(t*34.)*.5, t*34.)) - .5; c2 = mix(c2, zari*.85, step(length(g), .17)*.4*near0*step(t, .9)); }
      c2 *= .92 + .22*fold;
    }
    c2 *= 1. + near0*.04*sin(vU.y*900.);
    o = vec4(paint(c2, bump(N(), vW, fold*.012*near0), vW, 0.), 1.); return;
  }
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
const SHOE = COMMON + `void main(){ if (seatClip()) discard; vec3 c = vC, n = N(); float near = 1. - smoothstep(1.5, 7., vZ); if (vB.y < .028) c *= .3; c *= .94 + .1*nz(vB.xz*30.);
  if (vB.y > .05 && vB.z > .02 && abs(vB.x) < .4) c = mix(c, min(c*1.5 + .08, vec3(1.)), smoothstep(.02, .0, abs(fract(vB.z*38.) - .5))*near*.55);   // the laces
  float l = smoothstep(.034, .03, abs(vB.y - .034)); c *= 1. - .25*l*near; o = vec4(paint(c, bump(n, vW, nz(vB.xz*60.)*.001*near), vW, 0.), 1.); }`;
const HAIR = COMMON + `void main(){ if (seatClip()) discard; vec3 c = texture(tMap, vU).rgb*vC*1.2, n = N(); float st = fract(vU.x*90. + nz(vU*40.)*.8); c *= .82 + .36*smoothstep(.3, .7, st); n = bump(n, vW, st*.004*(1. - smoothstep(1.5, 8., vZ)));
  float sh = pow(max(dot(n, normalize(sunDir + vec3(0., .4, 0.))), 0.), 14.)*.2; o = vec4(paint(c + sh*vec3(.75, .68, .6), n, vW, 0.), 1.); }`;
const EYES = COMMON + `void main(){ if (seatClip()) discard; o = vec4(paint(texture(tMap, vU).rgb, N(), vW, 0.) + .04, 1.); }`;
const PLAIN = COMMON + `void main(){ if (seatClip()) discard; o = vec4(paint(vC, N(), vW, 0.), 1.); }`;
// hair built round the skull: strands run down it, a sheen rides across them
const HAIR2 = COMMON + `void main(){ if (seatClip()) discard; vec3 p = vB, n = N(), V = normalize(cameraPosition - vW); float ang = atan(p.x, p.z), near = 1. - smoothstep(2., 16., vZ), str = nz(vec2(ang*26., p.y*1.6))*.5 + nz(vec2(ang*71., p.y*3.))*.5;
  vec3 c = vC*(.72 + .52*str); vec3 T = normalize(cross(n, vec3(cos(ang), 0., -sin(ang)))); float sh = pow(sqrt(max(0., 1. - pow(dot(T, normalize(V + sunDir)), 2.))), 34.)*(.35 + .65*str);
  o = vec4(paint(c, n, vW, 0.) + (vC*.8 + vec3(.05))*sh*.42*sunCol*dayK, 1.); }`;
const SOFT = COMMON + `void main(){ if (seatClip()) discard; vec3 p = vB; float f = nz(vec2(p.x*9. + p.z*5., p.y*7.))*.6 + nz(vec2(p.x*27., p.y*19.))*.4, near = 1. - smoothstep(3., 14., vZ); o = vec4(paint(vC*(.86 + .26*f), bump(N(), vW, f*.012*near), vW, 0.), 1.); }`;

const v3 = new THREE.Vector3(), n3 = new THREE.Matrix3(), _m1 = new THREE.Matrix4();

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

// a preview's light: a soft key from the front and above, the game's own sun and shade colours, no shadow map, fog,
// street lamps or headlight (those belong to the street); uEnc: colours encoded for the page (sRGB) when drawn straight to it
function studioLight() {
  return { sunDir: { value: new THREE.Vector3(0.45, 0.7, 0.55).normalize() }, sunCol: { value: new THREE.Vector3(1.07, 1.02, 0.93) }, shadeCol: { value: new THREE.Vector3(0.5, 0.53, 0.62) },
    fogDensity: { value: 0 }, shadowOn: { value: 0 }, dayK: { value: 1 }, uNight: { value: 0 }, uWet: { value: 0 },
    lampC: { value: new THREE.Vector4(0, 0, 1/256, 0) }, headP: { value: new THREE.Vector4() }, tLamp: { value: null }, uEnc: { value: 0 } };
}
const ENC = `
uniform float uEnc;
vec3 encS(vec3 c){ c = max(c, vec3(0.)); return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
void main(){ main0(); if (uEnc > .5) o.rgb = encS(o.rgb); }`;

export class Skin {
  constructor(kit, scene) {
    this.kit = kit; this.scene = scene; this.max = 64; this.hiR = 12; this.n = 0; this.frame = 0;
    this.data = new Float32Array(TEX_W*SLOTS*4);
    this.tex = new THREE.DataTexture(this.data, TEX_W, SLOTS, THREE.RGBAFormat, THREE.FloatType); this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter; this.tex.generateMipmaps = false; this.tex.needsUpdate = true;
    this.parts = { m: new Map(), f: new Map() }; this.rigid = new Map(); this.prog = new Map();
    for (const k of ['m', 'f']) this.buildBody(k);
    // every other scene, as it starts to draw, gets its bodies drawn by a view of this (drawFor)
    const me = this; THREE.Scene.prototype.onBeforeRender = function (r, s, cam) { me.drawFor(this, r, cam); };
  }
  material(type, map) {
    const key = type + (map ? map.uuid : '');
    let m = this.prog.get(key); if (m) return m;
    const fs = { body: BODY, cloth0: CLOTH, cloth1: CLOTH, cloth2: CLOTH, cloth3: CLOTH, shoe: SHOE, hair: HAIR, eyes: EYES, plain: PLAIN }[type];
    const un = Object.assign({}, PU, this.uOver, { tSkin: { value: this.tex }, tMap: { value: map || null }, uHead: HEAD }); if (type.startsWith('cloth')) un.uWhich = { value: +type[5] };
    m = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: this.fsOf(fs), uniforms: un, glslVersion: THREE.GLSL3, side: /cloth/.test(type) ? THREE.DoubleSide : THREE.FrontSide });
    if (type === 'cloth0' || type === 'hair') { m.polygonOffset = true; m.polygonOffsetFactor = type === 'hair' ? -2 : -1; m.polygonOffsetUnits = type === 'hair' ? -6 : -2; }
    if (type === 'plain') { m.polygonOffset = true; m.polygonOffsetFactor = -3; m.polygonOffsetUnits = -8; }
    this.prog.set(key, m); return m;
  }
  fsOf(fs) { return fs; }
  // ---- the same bodies anywhere else: the character preview, the outfit studio, the phone's camera
  // Any other scene with a body in it gets a view of this renderer: the same fitted clothes, the same cut and shading,
  // the same hair and dress, drawn into that scene, from that scene's camera (and with a light of its own, not the
  // street's: no shadow map or fog or lamps from wherever you happen to be standing). Before, those screens showed
  // the game's raw body meshes, cloth poking through and coloured differently, so you didn't look like yourself.
  view(scene) {
    const V = Object.create(this);
    Object.assign(V, { scene, only: scene, fsOf: (fs) => fs.replace('void main(){', 'void main0(){') + ENC, n: 0, frame: 0, prog: new Map(), rigid: new Map(), rigidMats: null, rigidMat: null, shadowMat: null, uOver: studioLight() });
    V.data = new Float32Array(TEX_W*SLOTS*4);
    V.tex = new THREE.DataTexture(V.data, TEX_W, SLOTS, THREE.RGBAFormat, THREE.FloatType); V.tex.minFilter = V.tex.magFilter = THREE.NearestFilter; V.tex.generateMipmaps = false; V.tex.needsUpdate = true;
    V.parts = { m: new Map(), f: new Map() };
    for (const k of ['m', 'f']) for (const [name, R] of this.parts[k]) V.parts[k].set(name, { lo: V.twin(R.lo), hi: R.hi ? V.twin(R.hi) : null });
    return V;
  }
  // a part's mesh for a view: the same geometry (shared, uploaded once per renderer), its own slots and material
  twin(M) {
    const S = M.geometry, g = new THREE.InstancedBufferGeometry();
    for (const n in S.attributes) if (n !== 'iSlot' && n !== 'iCol') g.setAttribute(n, S.attributes[n]);
    g.setIndex(S.index);
    g.setAttribute('iSlot', new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array(SLOTS*3), 3).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const m = new THREE.Mesh(g, this.material(M.userData.type, M.userData.map)); m.frustumCulled = false; m.visible = false; m.renderOrder = -2; m.fill = 0; this.scene.add(m);
    return m;
  }
  // called as any scene but the game's starts to draw: if it has bodies, its view draws them
  drawFor(sc, renderer, camera) {
    if (sc === this.scene) return;
    const views = this.views || (this.views = new Map());
    let V = views.get(sc);
    if (!V) {
      let any = false;
      for (const H of this.kit.bodies) { let o = H.holder; while (o.parent) o = o.parent; if (o === sc) { any = true; break; } }
      if (!any) return;
      V = this.view(sc); views.set(sc, V);
    }
    // straight onto the page the colours are encoded as the game's last pass encodes them; into a picture, left linear
    V.uOver.uEnc.value = renderer.getRenderTarget() ? 0 : 1;
    V.update(camera, null);
  }
  typeOf(n) { return n.startsWith('body') ? 'body' : n.startsWith('eyes') ? 'eyes' : n.startsWith('hair') || n.startsWith('face') ? 'hair' : n === 'cloth_pants' ? 'cloth1' : n === 'cloth_shoes' ? 'shoe' : n === 'cloth_saree' ? 'cloth2' : n === 'cloth_kurta' ? 'cloth3' : n.startsWith('cloth') ? 'cloth0' : 'plain'; }
  buildBody(k) {
    const K = this.kit, H = K.makeRaw(K.randomLook(new RNG(7), { female: k === 'f' })), all = new Map(); let sk = null;
    H.holder.updateMatrixWorld(true);
    H.holder.traverse((o) => { if (o.isSkinnedMesh) { all.set(o.name, arrays(o, K, k)); sk = sk || o; } });
    // the new cloth is cut against the body as it stands in its bind pose
    const bones = H.body.skeleton.bones, inv = H.body.skeleton.boneInverses, bodyA = all.get('body_' + k), bindY = (n) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(inv[bones.findIndex(b => b.name === n)]).invert());
    const neck = bindY('neck_01').y, hip = bindY('pelvis').y; let cz = -1e9, bz = 1e9, foot = 1e9;
    for (let i = 0; i < bodyA.pos.length; i += 3) { const y = bodyA.pos[i + 1], x = bodyA.pos[i]; foot = Math.min(foot, y); if (Math.abs(x) < .12 && y > neck - .35 && y < neck - .1) { cz = Math.max(cz, bodyA.pos[i + 2]); bz = Math.min(bz, bodyA.pos[i + 2]); } }
    const U = { hip, neck, foot, knee: bindY('calf_l').y, chest: cz, back: bz, shX: Math.abs(bindY('upperarm_l').x) + .06 };
    const made = buildCloth(H, k, all, { bones, boneInv: inv }, U);
    for (const n in made) all.set(n, made[n]);
    this.boneNames = bones.map(b => b.name);
    (this.ward || (this.ward = {}))[k] = new Wardrobe(this, k, all, bones, inv, U);
    const mapOf = { body: K.maps[k], hair: K.hairMat[k] };
    H.holder.traverse((o) => { if (o.isSkinnedMesh && o.name.startsWith('eyes')) mapOf.eyes = o.material.map; });
    for (const [name, A] of all) {
      const type = name === 'x_pallu' || name === 'x_dupatta' ? 'cloth2' : this.typeOf(name), map = mapOf[type] || null;
      const rec = { lo: this.mesh(A, type, map) };
      if (/^(body|cloth)/.test(type)) rec.sh = this.shadowOf(rec.lo);
      if (['body', 'cloth0', 'cloth1', 'cloth2', 'cloth3', 'shoe', 'hair'].includes(type)) rec.hi = this.mesh(subdivide(A), type, map);
      this.parts[k].set(name, rec);
    }
  }
  mesh(A, type, map) {
    const g = new THREE.InstancedBufferGeometry(), F = (a, n) => g.setAttribute(n[0], new THREE.BufferAttribute(new Float32Array(a), n[1]));
    F(A.pos, ['position', 3]); F(A.nor, ['normal', 3]); F(A.uv, ['uv', 2]); F(A.bp, ['bp', 3]); F(A.si, ['skinIndex', 4]); F(A.sw, ['skinWeight', 4]);
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(A.idx), 1));
    g.setAttribute('iSlot', new THREE.InstancedBufferAttribute(new Float32Array(SLOTS), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array(SLOTS*3), 3).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const m = new THREE.Mesh(g, this.material(type, map)); m.frustumCulled = false; m.visible = false; m.renderOrder = -2; m.fill = 0; this.scene.add(m);
    m.userData.type = type; m.userData.map = map;
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
    const cap = SLOTS; for (let i = 0; i < 4; i++) g.setAttribute('iM' + i, new THREE.InstancedBufferAttribute(new Float32Array(cap*4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array(cap*3), 3).setUsage(THREE.DynamicDrawUsage)); g.instanceCount = 0;
    if (!this.rigidMats) { this.rigidMats = {}; for (const [kn, fs] of [['plain', PLAIN], ['hair', HAIR2], ['cloth', SOFT]]) { const un = Object.assign({}, PU, this.uOver, { tSkin: { value: this.tex }, tMap: { value: null }, uHead: HEAD }); this.rigidMats[kn] = new THREE.RawShaderMaterial({ vertexShader: RIGID_VS, fragmentShader: this.fsOf(fs), uniforms: un, glslVersion: THREE.GLSL3, side: THREE.DoubleSide }); } this.rigidMat = this.rigidMats.plain; }
    if (false) { const un = {}; this.rigidMat = new THREE.RawShaderMaterial({ vertexShader: RIGID_VS, fragmentShader: PLAIN, uniforms: un, glslVersion: THREE.GLSL3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 }); }
    if (geo.attributes.sway) g.setAttribute('sway', geo.attributes.sway);
    const m = new THREE.Mesh(g, this.rigidMats[geo.userData.kind] || this.rigidMat); m.frustumCulled = false; m.visible = false; m.renderOrder = -2; m.cap = cap; m.fill = 0; this.scene.add(m);
    m.castShadow = true; m.customDepthMaterial = this.rigidShadow || (this.rigidShadow = new THREE.RawShaderMaterial({ vertexShader: SHADOW_RIGID, fragmentShader: SHADOW_FS, glslVersion: THREE.GLSL3, side: THREE.DoubleSide, colorWrite: false }));
    this.rigid.set(geo.uuid, m); return m;
  }
  // what a body is made of: the game's meshes go on a layer no camera looks at (not a power's glow on them: that's
  // drawn as it is, game/aura.js; this rescan every 45 frames used to hide it half a second after it came on)
  scan(H) {
    H._sk = []; H._rg = [];
    H.holder.traverse((o) => { if (o.userData.aura) return; if (o.isSkinnedMesh) { o.layers.set(5); H._sk.push(o); } else if (o.isMesh) { o.layers.set(5); if (o.geometry.attributes.normal) H._rg.push(o); } });
  }
  update(camera, playerH) {
    const K = this.kit, cx = camera.position.x, cz = camera.position.z, near = [];
    if (!this.only) HEAD.value.w = 0;
    camera.getWorldDirection(v3); const fx = v3.x, fz = v3.z;
    this.frame++;
    for (const H of K.bodies) {
      if (!H._sk || this.frame%45 === 0) this.scan(H);
      if (!H.holder.visible) continue;
      let o = H.holder, on = true; while (o.parent) { o = o.parent; if (!o.visible) { on = false; break; } } if (!on || !o.isScene) continue;
      if (o !== (this.only || this.scene)) continue;          // (a body in another scene, a preview's, is drawn by that scene's view)
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
      // who they are (never you as yourself: you chose your own look; in someone else (Vetal) you're dressed as they are)
      const W_ = this.ward[k]; let D_ = null;
      if (W_ && !(H.look && H.look.player)) { if (H._wl !== H.look) { H._wl = H.look; H._w = dress(H, W_); } D_ = H._w; for (const [i, S] of W_.builds[D_.build]) { _m1.fromArray(m, i*16).multiply(S); _m1.toArray(m, i*16); } }
      for (let b = 0; b < nb; b++) { const i = b*16, o = row + b*12; D[o] = m[i]; D[o + 1] = m[i + 4]; D[o + 2] = m[i + 8]; D[o + 3] = m[i + 12]; D[o + 4] = m[i + 1]; D[o + 5] = m[i + 5]; D[o + 6] = m[i + 9]; D[o + 7] = m[i + 13]; D[o + 8] = m[i + 2]; D[o + 9] = m[i + 6]; D[o + 10] = m[i + 10]; D[o + 11] = m[i + 14]; }
      const u = H.mat.userData, O = row + LOOK*4, col = (i, c) => { D[O + i*4] = c.r; D[O + i*4 + 1] = c.g; D[O + i*4 + 2] = c.b; }, vec = (i, q) => { D[O + i*4] = q.x; D[O + i*4 + 1] = q.y; D[O + i*4 + 2] = q.z; D[O + i*4 + 3] = q.w; };
      col(0, u.top); col(1, u.bottom); col(2, u.skin); col(3, u.shoe); vec(4, u.cut); vec(5, H.style); col(6, H.pat); vec(7, H.fit); vec(8, H.arm); vec(9, u.body); D[O + 40] = H._clipY ?? 0; D[O + 43] = H._clipY === undefined ? 0 : 1; D[O + 47] = 0;
      if (H === playerH) { const hb = H._hb || (H._hb = H.body.skeleton.getBoneByName('Head') || H.body.skeleton.bones.find(q => /head/i.test(q.name))); if (hb) { hb.getWorldPosition(_hp); const hm = H.holder.matrixWorld.elements; H._headOff = { x: _hp.x - hm[12], y: _hp.y - hm[13], z: _hp.z - hm[14] }; D[O + 44] = _hp.x; D[O + 45] = _hp.y - 0.03; D[O + 46] = _hp.z; D[O + 47] = 1; HEAD.value.set(_hp.x, _hp.y - 0.03, _hp.z, 1); } }
      if (D_ && D_.clothK) { D[O + 23] = D_.clothK; col(6, D_.pat); }
      const helmeted = H.xtra && H.xtra.helm && H.xtra.helm.visible, topC = u.top;
      for (const o of H._sk) {
        if (!o.visible) continue;
        if (D_ && o.name.startsWith('hair') && o.name !== 'hair_beard' && !helmeted) continue;                                // (their own hair is drawn below)
        const R = this.parts[k].get(o.name); if (!R) continue;
        const P = (H._d2 < hi2 && R.hi) ? R.hi : R.lo, c = o.material.color, A = P.geometry.attributes, j = P.fill++; if (j >= SLOTS) continue;
        const one = D_ && (o.name === 'cloth_kurta' || o.name === 'cloth_saree') ? topC : c;                                  // (one cloth, one colour)
        A.iSlot.array[j] = s; A.iCol.array[j*3] = one.r; A.iCol.array[j*3 + 1] = one.g; A.iCol.array[j*3 + 2] = one.b;
        if (R.sh && H._d2 < CAST2) R.sh.geometry.attributes.iSlot.array[R.sh.fill++] = s;
      }
      if (D_) {
        for (const X of D_.cloth) { const R = this.parts[k].get(X.n); if (!R) continue; const P = (H._d2 < hi2 && R.hi) ? R.hi : R.lo, A = P.geometry.attributes, j = P.fill++; if (j >= SLOTS) continue; const c = X.c || topC; A.iSlot.array[j] = s; A.iCol.array[j*3] = c.r; A.iCol.array[j*3 + 1] = c.g; A.iCol.array[j*3 + 2] = c.b; if (R.sh && H._d2 < CAST2) R.sh.geometry.attributes.iSlot.array[R.sh.fill++] = s; }
        const put = (g, b, c) => { const r = this.rigidOf(g), j = r.fill++; if (j >= r.cap) return; const A = r.geometry.attributes, o = b*16; for (let i = 0; i < 4; i++) { const a = A['iM' + i].array; a[j*4] = m[o + i*4]; a[j*4 + 1] = m[o + i*4 + 1]; a[j*4 + 2] = m[o + i*4 + 2]; a[j*4 + 3] = m[o + i*4 + 3]; } A.iCol.array[j*3] = c.r; A.iCol.array[j*3 + 1] = c.g; A.iCol.array[j*3 + 2] = c.b; };
        if (!helmeted && D_.hair && W_.hair[D_.hair]) put(W_.hair[D_.hair], W_.headB, D_.hairCol);
        for (const it of D_.items) { if (helmeted && it.b === W_.headB && it.g.userData.kind !== 'hair' && it.g.index && it.g.index.count > 3000) continue; put(it.g, it.b, it.c); }
      }
      for (const o of H._rg) {
        if (D_ && H.xtra && (o === H.xtra.pony || o === H.xtra.braid || o === H.xtra.cap || o === H.xtra.glasses || o === H.xtra.lens)) continue;      // (theirs are drawn above)
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
