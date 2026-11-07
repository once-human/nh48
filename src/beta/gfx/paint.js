// /beta's look: the experiment's painted street, for all of Pune and the whole game. No three.js lighting on the
// city: every surface paints itself in the one pass that draws it, lit by the game's own sky (the sun, the sky's
// fill, the haze, night) so the clock, the weather and the seasons all still show.
//  - the sun lands in two tones with a brushed edge, and the shadows (three's own shadow map, the one the trees,
//    cars and people cast into) have the same brushed edge
//  - each kind of surface draws its own marks: brick courses, pavers, plaster patches, shutter ribs, tiles, tin
//  - dry-brush streaks everywhere, grey pencil hatching in the shade, crossed where it's darkest; all worked out on
//    the surface itself and re-sized with distance, so it stays put when you move and never shrinks into noise
//  - at night the windows light up one by one, the shops glow until they shut, the lamps and kandils burn
//  - far off, the game's own haze (thinner with height, warm towards the sun)
// The colours are worked out as painted (sRGB) and written out the way three's own materials are (tone-mapped,
// linear), so what's still drawn with three's materials (trees, cars, people) sits in the same picture; gfx/post.js
// then inks the edges and lays it on paper.
//
// Materials here:
//   paint.world / paint.cut / paint.shutter   the painted city's own geometry (world/geom.js's compact format)
//   paint.ground() paint.facade() paint.roof() paint.prop() paint.water()   for what the game still builds with
//   its old builders (props, hills, compound walls, landmarks): the same paint, reading their attributes
import * as THREE from 'three';
import { U as GU } from '@orig/gfx/materials.js';
import { STYLE_PARAMS } from '@orig/gfx/pbr.js';

// shared by every painted material: set once a frame (Paint.update), every surface follows
export const PU = {
  sunDir: { value: new THREE.Vector3(-0.55, 0.62, -0.56).normalize() },
  sunCol: { value: new THREE.Vector3(1.07, 1.02, 0.93) },
  shadeCol: { value: new THREE.Vector3(0.5, 0.53, 0.62) },
  sunLc: { value: new THREE.Vector3(3, 3, 3) },
  skyCol: { value: new THREE.Vector3(0.7, 0.8, 0.88) },
  fogCol: { value: new THREE.Color(0.6, 0.65, 0.7) },
  fogDensity: { value: 0.0012 },
  shadowTex: { value: null },
  shadowMat: { value: new THREE.Matrix4() },
  shadowTexel: { value: 1 / 2048 },
  shadowOn: { value: 0 },
  pScale: { value: 800 },
  dpr: { value: 1 },
  tNoise: { value: null },
  dayK: { value: 1 },
  uStyle: { value: STYLE_PARAMS.map(p => new THREE.Vector4(p[0], p[1], p[2], p[3])) },
  uStyle2: { value: STYLE_PARAMS.map(p => new THREE.Vector4(p[4], p[5], p[7], p[8])) },
  uTime: GU.uTime, uNight: GU.uNight, uWindowLit: GU.uWindowLit, uShopsOpen: GU.uShopsOpen, uWet: GU.uWet,
  uReal: { value: 0 }, uMarks: { value: 1 }, uTaps: { value: 2 }, uSoft: { value: 1 },
  tLamp: { value: null }, lampC: { value: new THREE.Vector4(0, 0, 1/256, 0) }, lampY: { value: 0 }, headP: { value: new THREE.Vector4() }, headD: { value: new THREE.Vector4(1, 0, 0, .85) }, headS: { value: new THREE.Vector4() },
};
// the light of lamps and your own headlight or torch on a surface (gfx/lamps.js keeps it up to date)
export const LAMP = `uniform sampler2D tLamp; uniform vec4 lampC, headP, headD, headS; uniform float lampY;
vec3 lampAt(vec3 w, vec3 n){ vec3 c = vec3(0.); if (lampC.w > 0.) { vec2 q = (w.xz - lampC.xy)*lampC.z + .5;
    c = vec3(1., .72, .44)*.95*texture(tLamp, q).r*(.5 + .5*max(n.y, 0.))*(1. - smoothstep(8., 13., w.y - lampY))*lampC.w; }
  if (headP.w > 0.) { float both = step(.5, headS.w); for (float s = -1.; s < 1.5; s += 2.) { if (s > 0. && both < .5) break;
      // (a car throws two beams, one from each lamp, a little toed out: up close they're two pools, far off they meet)
      vec3 o = headP.xyz + headS.xyz*s*both, d = w - o; float r = length(d); d /= r; vec3 a = normalize(headD.xyz + headS.xyz*s*both*.05);
      c += vec3(1., .93, .78)*headP.w*(both > .5 ? 1.9 : 3.)*smoothstep(headD.w, headD.w + .1, dot(d, a))*max(dot(n, -d), .2)/(1. + r*r*.035); } }
  return c; }
// sunlight on something pale: the sun can go up to 1.25, so white went past the top and lost its carving. Bright colours are
// eased into what's left instead, keeping their hue; everything darker than the knee is untouched
vec3 sunRoll(vec3 c){ float m = max(c.r, max(c.g, c.b)); if (m <= .72) return c; float t = min((m - .72)/.6, 1.); return c*(.72 + .24*(1. - pow(1. - t, 1.5)))/m; }
`;

// how the sun's shadow is read: a couple of filtered looks (the painted hard edge), or a disc of them, softer with every setting
export const PCF = `uniform int uTaps; uniform float uSoft, uReal;
float shadowPCF(vec3 s){ if (uTaps <= 2) return .5*(texture(shadowTex, vec3(s.xy + vec2(-.6, .3)*shadowTexel, s.z)) + texture(shadowTex, vec3(s.xy + vec2(.6, -.3)*shadowTexel, s.z)));
  float a = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))))*6.2832, r = 0.; for (int i = 0; i < uTaps; i++) { float q = sqrt((float(i) + .5)/float(uTaps)), th = a + float(i)*2.39996; r += texture(shadowTex, vec3(s.xy + vec2(cos(th), sin(th))*q*uSoft*shadowTexel, s.z)); } return r/float(uTaps); }
// the sun on a surface: two tones with a brushed edge when painted, the plain cosine when it isn't
float sunOn(float ndl, float e, float a, float b){ return mix(smoothstep(a, b, ndl + e), clamp(ndl*1.2, 0., 1.), uReal); }
float shadeOf(float sh, float e){ return mix(smoothstep(.3, .7, sh + e), sh, uReal); }
`;

const NOISE = `
float h12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y); }
vec2 rot(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x+s*p.y,-s*p.x+c*p.y); }
float lum(vec3 c){ return dot(c,vec3(.3,.59,.11)); }
`;

// ---------------------------------------------------------------- vertex: each format into the same varyings
// vW world position, vN normal, vC colour as painted, vK kind, vA (wear, seed), vU the surface's own 2D (metres:
// along the wall and up it, or across the ground), vZ distance in view
const VS = `
#if defined(FMT_WORLD)
in vec3 pcol; in float pkind; in vec2 paux; in vec2 puv;
#elif defined(FMT_GROUND)
in vec2 guv; in float glayer; in float gshade;
#elif defined(FMT_FACADE)
in vec2 fuv; in vec2 fedge; in vec3 ftint; in vec4 fstyle; in vec2 ftan; in float ftop;
#elif defined(FMT_ROOF)
in vec2 ruv; in float rlayer; in vec3 rtint;
#elif defined(FMT_PROP)
in float glow;
#endif
out vec3 vW; out vec3 vN; out vec3 vC; flat out float vK; out vec2 vA; out vec2 vU; out float vZ;
#if defined(FMT_FACADE)
flat out vec4 vSt; out float vFH;
#endif
vec3 toPaint(vec3 lin){ return pow(max(lin, vec3(0.)), vec3(1./2.2)); }
// the old builders' layers as the paint's kinds
float groundKind(float l){
  int L = int(l + .5);
  if (L == 0) return 2.; if (L == 1 || L == 9) return 28.; if (L == 2) return 3.; if (L == 3) return 18.; if (L == 4 || L == 8) return 20.;
  if (L == 5 || L == 6) return 21.; if (L == 7 || L == 23 || L == 24) return 19.; if (L == 10) return 33.; if (L == 20) return 4.; if (L == 21 || L == 22) return 17.;
  return 19.;
}
vec3 groundCol(float k){
  int K = int(k + .5);
  if (K == 2) return vec3(.36,.36,.37); if (K == 28) return vec3(.42,.41,.4); if (K == 3) return vec3(.62,.56,.5); if (K == 18) return vec3(.66,.63,.58);
  if (K == 20) return vec3(.55,.45,.34); if (K == 21) return vec3(.47,.56,.3); if (K == 33) return vec3(.55,.52,.48); if (K == 4) return vec3(.85,.8,.7);
  if (K == 17) return vec3(.7,.68,.64); return vec3(.64,.62,.58);
}
float wallKind(float l){
  int L = int(l + .5);
  if (L <= 2 || L == 4 || L == 5) return 0.; if (L == 3) return 19.; if (L == 6) return 24.; if (L == 7) return 18.; if (L == 8) return 1.;
  if (L == 9 || L == 10) return 12.; if (L == 11 || L == 12) return 6.; if (L == 13) return 11.; if (L == 14) return 25.; if (L == 15) return 5.;
  if (L == 16) return 7.; return 26.;
}
vec3 wallBase(float k){
  int K = int(k + .5);
  if (K == 1) return vec3(.66,.36,.27); if (K == 12) return vec3(.55,.5,.45); if (K == 6) return vec3(.6,.62,.62); if (K == 11) return vec3(.66,.64,.6);
  if (K == 25) return vec3(.3,.3,.31); if (K == 5) return vec3(.72,.36,.25); if (K == 7) return vec3(.42,.3,.2); if (K == 24) return vec3(.8,.8,.8);
  return vec3(.82,.8,.76);
}
void main(){
  vec3 p = position, n = normal;
  vC = vec3(1.); vK = 10.; vA = vec2(.3, 0.); vU = vec2(0.);
#if defined(FMT_WORLD)
  vC = pcol; vK = pkind; vA = paux; vU = puv * (1./32.);
#elif defined(FMT_GROUND)
  vK = groundKind(glayer); vC = groundCol(vK) * gshade; vU = guv; vA = vec2(.45, fract(glayer * .37));
#elif defined(FMT_FACADE)
  float lk = wallKind(fstyle.y);
  vK = lk; vU = fuv; vSt = fstyle; vFH = fuv.y;
  vec3 tint = toPaint(ftint);
  vC = (lk == 0. || lk == 24. || lk == 19. || lk == 26.) ? tint : mix(wallBase(lk), tint, .2);
  vA = vec2(fstyle.y == 4. || fstyle.y == 5. ? .75 : .35, (fstyle.x*16. + mod(fstyle.w, 8.))/255.);
  if (fstyle.x != 7. && fstyle.x != 11. && fstyle.x != 13. && mod(floor(fstyle.z / 2.), 2.) < .5 && lk == 0.) vK = 31.;
#elif defined(FMT_ROOF)
  vK = rlayer == 15. ? 5. : rlayer == 14. ? 25. : rlayer == 13. ? 11. : 26.; vC = vK == 5. ? vec3(.72,.36,.25) : toPaint(rtint) * (vK == 25. ? .45 : .85); vU = ruv; vA = vec2(.5, 0.);
#elif defined(FMT_PROP)
  vK = glow > .01 ? 30. : 10.;
  vec3 pc = vec3(1.);
  #ifdef USE_COLOR
  pc = color;
  #endif
  #ifdef USE_INSTANCING_COLOR
  pc *= instanceColor;
  #endif
  vC = toPaint(pc); vA = vec2(.3, glow);
#elif defined(FMT_WATER)
  vK = 22.; vC = vec3(.2,.3,.27);
#elif defined(FMT_SHUTTER)
  vK = 6.; vC = vec3(.6,.63,.65); vA = vec2(.55, 0.); vU = uv * vec2(3., 2.6);
#endif
  vec4 wp = vec4(p, 1.);
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp; n = mat3(instanceMatrix) * n;
#endif
  wp = modelMatrix * wp;
  vW = wp.xyz; vN = mat3(modelMatrix) * n;
#if defined(FMT_SHUTTER)
  vU.x += wp.x + wp.z;
#endif
  vec4 vp = viewMatrix * wp;
  vZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}`;

// ---------------------------------------------------------------- fragment
const FS = NOISE + `
uniform vec3 sunDir, sunCol, shadeCol, sunLc, skyCol, fogCol; uniform float fogDensity, dayK;
uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform float shadowTexel, shadowOn, pScale, dpr;
uniform sampler2D tNoise;
uniform float uTime, uNight, uWindowLit, uShopsOpen, uWet;
${LAMP}
uniform vec4 uStyle[15], uStyle2[15];
in vec3 vW; in vec3 vN; in vec3 vC; flat in float vK; in vec2 vA; in vec2 vU; in float vZ;
#if defined(FMT_FACADE)
flat in vec4 vSt; in float vFH;
#endif
out vec4 fragColor;
float nR(vec2 p){ return texture(tNoise, p*(1./16.)).r; }
float nG(vec2 p){ return texture(tNoise, p*(1./64.)).g; }
float gl1(float x, float w){ float d = min(fract(x), 1. - fract(x)); return 1. - smoothstep(w*.5, w, d); }
float hatch(vec2 q, float sp){ return texture(tNoise, q*(1./(sp*32.))).b; }
float streak(vec2 q, float k){ return texture(tNoise, q/(vec2(8., 7.68)*k)).a; }

float gEmit;        // light of its own (windows at night, lamps, signs): not shaded, not hatched
float gGlass;       // how much of this is glass (reflects the sky by day)

// windows painted on a wall (back walls, the old builders' walls): style s, wall position u (along) h (up)
vec3 paintedWindows(vec3 c, float st, float seed, bool grille, vec2 u, float wear, float near){
  int s = int(st + .5);
  vec4 S = uStyle[s], S2 = uStyle2[s];
  float fh = S.x, gh = S.y, ww = S.z, wh = S.w, sp = S2.x, sill = S2.y;
  if (ww < .1) return c;
  float h = u.y - .15;
  float fl = h < gh ? 0. : 1. + floor((h - gh) / fh);
  float y0 = fl < .5 ? 0. : gh + (fl - 1.) * fh;
  float yy = h - y0;
  float cell = floor(u.x / sp), ux = fract(u.x / sp) * sp - sp * .5;
  float hc = h12(vec2(cell, fl) + seed * 7.);
  if (hc < .12) return c;                                  // a blank bay now and then
  float w2 = ww * .5 * (.9 + .2 * hc);
  float inX = step(abs(ux), w2), inY = step(sill, yy) * step(yy, sill + wh);
  float win = inX * inY;
  float fr = max(1. - smoothstep(.0, .07, abs(abs(ux) - w2)) , 1. - smoothstep(.0, .07, min(abs(yy - sill), abs(yy - sill - wh)))) * step(abs(ux), w2 + .07) * step(sill - .07, yy) * step(yy, sill + wh + .07);
  // the sill's shadow and a grime streak under it
  float under = step(abs(ux), w2 + .08) * smoothstep(sill, sill - .06, yy) * step(sill - .9, yy);
  c *= 1. - under * (.08 + .12 * wear) * (1. - smoothstep(sill - .9, sill - .05, yy) * .5);
  // a chajja's shadow line over it
  c *= 1. - .25 * step(abs(ux), w2 + .25) * smoothstep(sill + wh + .35, sill + wh + .18, yy) * step(sill + wh + .1, yy);
  if (win > .5) {
    float lit = step(1. - uWindowLit, h12(vec2(cell * 1.7, fl * 3.1) + seed));
    vec3 g = vec3(.2, .3, .33) * (.8 + .4 * h12(vec2(cell, fl * 2.)));
    // panes: a mullion, the curtain behind
    float mull = 1. - smoothstep(.02, .04, abs(ux));
    g = mix(g, vec3(.55, .5, .42), step(.55, h12(vec2(cell, fl) + 3.)) * smoothstep(.3, .0, abs(ux + w2 * .5)) * .5);
    g = mix(g, skyCol * .8, (1. - uNight) * .35 * smoothstep(.35, .7, fract((ux + yy) * .7 + hc)));
    if (grille) g = mix(g, vec3(.12), max(gl1(ux * 8., .25), gl1(yy * 4., .3)) * near * .8);
    c = mix(g, vec3(.2, .16, .12), mull * .8);
    vec3 lamp = mix(vec3(1., .72, .42), vec3(.86, .93, 1.), step(.5, h12(vec2(cell * 3.3, fl))));
    gEmit = lit * uNight;
    c = mix(c, lamp * (.85 + .2 * h12(vec2(cell, fl * 5.))), gEmit);
    gGlass = 1. - gEmit;
  } else c = mix(c, c * .62, fr * near);
  return c;
}

// the colour of the surface itself, with its marks drawn in
vec3 surface(int k, vec3 c, vec3 w, vec2 u, vec3 n, float wear, float seed, float near){
  if (k == 0 || k == 31) {                                   // plaster: repainted patches, damp at the foot, rain streaks
    c *= .93 + .12*smoothstep(.44, .56, nR(u*.55 + c.r*9.));
    c *= 1. - .12*wear*nG(vec2(u.x*5., u.y*.3))*near;
    c *= 1. - wear*.22*smoothstep(.55, .9, nR(vec2(u.x*.9, u.y*.12) + seed*13.))*smoothstep(1.5, 5., u.y);
    c *= mix(.7, 1., smoothstep(.15, 1.1 + wear*.6, u.y));
    if (k == 31) { float sb = floor(seed*255. + .5); c = paintedWindows(c, floor(sb/16.), mod(sb, 8.), mod(floor(sb/8.), 2.) > .5, u, wear, near); }
  } else if (k == 1) {                                       // brick: courses, a stagger, every brick its own fired colour
    vec2 g = u*vec2(1./.23, 1./.077); g.x += step(.5, fract(g.y*.5))*.5;
    vec2 id = floor(g); float hb = h12(id);
    c *= .78 + .36*hb; c = mix(c, c*vec3(.8,.7,.75), step(.86, fract(hb*7.31))*.6);
    float m = max(gl1(g.x, .07), gl1(g.y, .16))*near;
    c = mix(c, vec3(.72, .68, .62), m*.75);
    c *= mix(.75, 1., smoothstep(.1, 1., u.y));
  } else if (k == 2 || k == 28) {                            // road: tar patches, wheel polish, an old patch job
    c = mix(vec3(lum(c)), c, .3);                            // (tar is grey: the dust on it shouldn't read as an orange glow along the kerb)
    c *= .9 + .2*smoothstep(.4, .6, nR(w.xz*vec2(.35, .08)));
    c *= .93 + .12*nG(w.xz*vec2(3., .25));
    if (k == 28) { float pt = smoothstep(.55, .6, nR(w.xz*.21 + 4.)); c = mix(c, c*vec3(.82,.8,.78), pt); c *= 1. - .25*smoothstep(.72, .78, nR(w.xz*.6))*near; }
  } else if (k == 3) {                                       // interlocking pavers, some sunk, some missing
    vec2 g = w.xz*vec2(1./.22, 1./.11); g.x += step(.5, fract(g.y*.5))*.5;
    float hb = h12(floor(g));
    c *= .86 + .2*hb;
    c *= 1. - .32*near*max(gl1(g.x, .08), gl1(g.y, .14));
    c = mix(c, vec3(.42,.36,.3), step(.965, hb)*.8);
  } else if (k == 4) {                                       // kerb, painted black and yellow
    c = mix(vec3(.12,.12,.13), vec3(.9, .74, .2), step(.5, fract(u.x*.5 + .25)));
    c *= 1. - .2*nR(u*3.)*wear;
  } else if (k == 5) {                                       // Mangalore tiles, row on row, the odd new one
    float r = fract(u.y*3.2), cc = floor(u.x*4.5 + step(.5, fract(u.y*1.6))*.5);
    float hb = h12(vec2(cc, floor(u.y*3.2)));
    c *= .78 + .3*hb; c = mix(c, c*vec3(.7,.75,.7), step(.8, hb)*.4*wear);
    c *= mix(1., .58, near*smoothstep(.72, .98, r)); c *= 1. - .18*near*gl1(u.x*4.5, .12);
  } else if (k == 6) {                                       // rolling shutter: ribs, rust at the foot, a lock
    c *= .8 + .25*(.5 + .5*sin(u.y*78.))*near + .12*(1. - near);
    c = mix(c, vec3(.42,.3,.22), wear*.5*smoothstep(.6, .0, fract(u.y/2.6))*nR(u*4.));
  } else if (k == 7) {                                       // planks
    float pl = u.x*6.5; c *= .82 + .3*h12(vec2(floor(pl), 3.)); c *= 1. - .45*near*gl1(pl, .08);
  } else if (k == 8) {                                       // glass: deep, a stroke of sky across it, lit at night
    float d = fract((u.x*.55 + u.y)*.8 + seed*3.);
    c = mix(c, skyCol*.9, smoothstep(.05, .1, d)*smoothstep(.3, .24, d)*.6*(1. - uNight));
    gGlass = 1.;
    float lit = step(1. - uWindowLit, fract(seed*13.7 + .31));
    vec3 lamp = mix(vec3(1., .72, .42), vec3(.86, .93, 1.), step(.5, fract(seed*7.1)));
    gEmit = lit*uNight; c = mix(c, lamp*.85, gEmit*.9);
  } else if (k == 9) {                                       // leaves: dabs
    c *= .7 + .55*(nR(w.xz*2.3 + w.y*1.7)*.6 + nG(w.xy*5.1 - w.z*3.)*.4);
  } else if (k == 11) {                                      // corrugated tin, rusting
    c *= .82 + .22*(.5 + .5*sin(u.x*40.))*near + .11*(1. - near);
    c = mix(c, vec3(.5,.3,.18), wear*.55*smoothstep(.45, .75, nR(u*1.3 + seed*9.)));
  } else if (k == 12) {                                      // basalt blocks
    vec2 g = u*vec2(2., 3.2); g.x += step(.5, fract(g.y*.5))*.5;
    c *= .82 + .3*h12(floor(g)); c *= 1. - .45*near*max(gl1(g.x, .05), gl1(g.y, .07));
  } else if (k == 13) {                                      // inside a shop: lit while it's open
    c *= .9 + .1*nR(u*3.);
    gEmit = uShopsOpen*(.35 + .65*uNight);
    c = mix(c*.55, c*1.05, gEmit);
  } else if (k == 14) {                                      // a painted advert: blocks of colour, a line of big letters
    vec2 q = fract(u*vec2(.31, .5) + seed);
    c = mix(c, vec3(.96,.94,.88), step(.62, q.y)*.85);
    c = mix(c, vec3(.1,.1,.12), step(.68, q.y)*step(q.y, .86)*step(.5, h12(floor(u*vec2(3.5, 1.6)) + seed*9.))*.85);
    c *= 1. - .25*wear*nR(u*2.);
  } else if (k == 15) {                                      // cloth
    c *= .9 + .12*nG(u*14. + seed*9.) + .06*sin(u.x*30. + seed*20.);
  } else if (k == 17) {                                      // a plain kerb, chipped
    c *= .9 + .15*h12(floor(u*vec2(1.5, 4.))); c *= 1. - .2*wear*nR(u*5.);
  } else if (k == 18) {                                      // square tiles
    vec2 g = u/.3; c *= .9 + .14*h12(floor(g)); c *= 1. - .25*near*max(gl1(g.x, .05), gl1(g.y, .05));
  } else if (k == 19 || k == 26) {                           // concrete: shuttering marks, cracks, stains
    c *= .9 + .16*nR(u*.8 + seed*5.);
    c *= 1. - .14*near*gl1(u.y/1.2, .02);
    c *= 1. - wear*.25*smoothstep(.6, .85, nR(u*.35 + 7.));
  } else if (k == 20) {                                      // earth
    c *= .78 + .35*nR(w.xz*.7) + .1*nG(w.xz*4.);
  } else if (k == 21) {                                      // grass, worn to earth in places
    float b = nR(w.xz*.45);
    c = mix(c, vec3(.55,.46,.34), smoothstep(.62, .78, b)*.8);
    c *= .78 + .3*nG(w.xz*3.1);
  } else if (k == 22) {                                      // water
    float r = nR(w.xz*vec2(.25, 1.2) + vec2(uTime*.05, 0.));
    c = mix(c, skyCol*.75, smoothstep(.55, .75, r)*.5*(1. - uNight*.8));
    gGlass = .6;
  } else if (k == 23) {                                      // a glass curtain wall: the grid, floors lit at night
    vec2 g = vec2(u.x/1.5, u.y/3.6);
    float frm = max(gl1(g.x, .06), gl1(g.y, .05));
    float fl = floor(g.y), bay = floor(g.x);
    float d = fract((u.x*.3 + u.y*.6)*.25 + seed*3.);
    c = mix(c, skyCol, .25 + .35*smoothstep(.1, .3, d)*smoothstep(.6, .4, d));
    gGlass = 1. - frm;
    float lit = step(1. - uWindowLit*.9, h12(vec2(floor(bay/3.), fl) + seed*11.));
    gEmit = lit*uNight*(1. - frm);
    c = mix(c, vec3(.92,.95,1.)*.8, gEmit);
    c = mix(c, vec3(.18,.19,.2), frm*.85);
  } else if (k == 24) {                                      // cladding panels
    vec2 g = vec2(u.x/1.22, u.y/.61);
    c *= 1. - .3*near*max(gl1(g.x, .03), gl1(g.y, .05));
    c *= .95 + .08*h12(floor(g));
  } else if (k == 25) {                                      // tar-felt roof
    c *= .85 + .3*nR(u*.6 + seed*3.); c = mix(c, c*1.35, smoothstep(.7, .9, nR(u*.2 + 5.))*.5);
  } else if (k == 27) {                                      // blue tarp, creased
    c *= .88 + .2*nR(u*vec2(1.5, 3.)) + .08*sin(u.x*9. + nR(u)*6.);
  } else if (k == 29) {                                      // marble: veins
    c *= .95 + .08*sin((u.x + u.y*1.6)*3. + nR(u*.8)*7.);
  } else if (k == 30) {                                      // a lamp, a kandil, a tube light: its own light
    gEmit = .55 + .45*uNight;
    c = mix(c*.85, min(c*1.6 + .1, vec3(1.25)), uNight);
  } else if (k == 32) {                                      // a Sintex tank: ribs round it, a pale water line
    c *= .85 + .3*(.5 + .5*sin(u.y*18.))*near + .15*(1. - near);
  } else if (k == 33) {                                      // gravel, rubble
    c *= .75 + .45*nG(w.xz*6.) + .1*nR(w.xz);
  } else if (k == 34) {                                      // road paint, worn through
    c = mix(c, vec3(.42,.42,.42), smoothstep(.45, .7, nR(w.xz*1.7))*.6);
  } else if (k == 35) {                                      // a stain: paan, oil, a wet patch
    c *= .75 + .25*nR(w.xz*3.);
  } else if (k == 36) {                                      // painted steel
    c *= .88 + .18*nR(u*2.);
    c = mix(c, vec3(.42,.28,.2), wear*.4*smoothstep(.6, .85, nR(u*3. + seed*5.)));
  } else if (k == 37 || k == 39) {                           // grilles and nets: drawn by their holes (the cut pass)
    c *= .9 + .2*nR(u*4.);
  } else if (k == 38) {                                      // rangoli
    vec2 q = u; float r = length(q), a = atan(q.y, q.x);
    float petals = .5 + .5*cos(a*8. + seed*6.28);
    float ring = floor(r*10. + petals*1.2);
    vec3 pal[5] = vec3[5](vec3(.95,.25,.3), vec3(.98,.75,.1), vec3(.2,.6,.95), vec3(.25,.75,.35), vec3(.98,.98,.95));
    c = pal[int(mod(ring + floor(seed*5.), 5.))];
    c = mix(c, vec3(.98,.97,.94), gl1(r*10. + petals*1.2, .12)*.8);
  } else if (k == 40) {                                      // washing, packets: printed cloth, folds
    c *= .88 + .14*nG(u*12. + seed*7.) + .05*sin(u.y*24.);
  } else if (k == 41) {                                      // a shop's stock on its shelves: rows of packets, boxes, jars
    float tr = floor(floor(seed*255. + .5)/16.);
    vec2 g = vec2(u.x*5., u.y*2.5);
    float shelf = gl1(g.y, .14);
    vec2 id = floor(vec2(g.x*(1. + h12(vec2(floor(g.y), tr))), g.y));
    float hb = h12(id + tr*3.1);
    vec3 pk = .5 + .5*cos(6.283*(hb + vec3(0., .33, .67)) + tr);
    pk = mix(pk, vec3(.92,.88,.78), step(.7, h12(id*1.3))*.6);
    if (tr == 4. || tr == 12.) pk = mix(pk, pk*.6, .3);
    if (tr == 5.) pk = mix(vec3(.85,.68,.28), vec3(1.,.9,.6), hb);
    c = mix(pk*.9, vec3(.42,.3,.2), shelf*.9);
    gEmit = uShopsOpen*(.25 + .55*uNight);
  }
  return c;
}

${PCF}
uniform float uMarks;
// the sun's shadow: filtered reads, nudged by a brushed wobble
float shadowAt(vec3 w, vec3 n, float e){
  vec4 s = shadowMat * vec4(w + n*(.05 + .002*vZ), 1.);
  if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  vec2 j = vec2(e, -e)*2.6*shadowTexel*(1. - uReal);
  return shadowPCF(vec3(s.xy + j, s.z - .0006));
}

void main(){
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 w = vW; int k = int(vK + .5);
  vec3 an = abs(n);
  vec2 u = vU;
#if defined(FMT_PROP) || defined(FMT_WATER)
  u = an.y > max(an.x, an.z) ? w.xz : (an.x > an.z ? vec2(w.z, w.y) : vec2(w.x, w.y));
#endif
#if defined(FMT_GROUND)
  if (an.y > .5) u = w.xz;
#endif
#if defined(CUT)
  // what's left of a grille, a railing, a net, the washing: holes cut by pattern
  {
    float s = vA.y*255.;
    bool keep = true;
    if (k == 37) {
      int pat = int(mod(s, 8.));
      vec2 q = u;
      float bar = gl1(q.x/.11, .2), rail = max(gl1(q.y/.32, .1), gl1((q.y - .05)/.95, .06));
      float m = max(bar, rail);
      if (pat == 1 || pat == 5) m = max(m, gl1((q.x + q.y)/.32, .09)*step(.5, fract(q.y/.64)));                // diagonals
      if (pat == 2 || pat == 6) { vec2 cc = fract(q/vec2(.32, .32)) - .5; m = max(m, 1. - smoothstep(.02, .04, abs(length(cc) - .16))); }  // rings
      if (pat == 3) m = max(gl1(q.x/.08, .25), gl1(q.y/.6, .08));
      if (pat == 4 || pat == 7) { vec2 cc = fract(q/vec2(.22, .44)) - .5; m = max(m, 1. - smoothstep(.02, .035, abs(abs(cc.x) + abs(cc.y)*.5 - .25))); }  // diamonds
      keep = m > .5;
    } else if (k == 38) keep = length(u) < .4;
    else if (k == 39) keep = max(gl1(u.x/.06, .3), gl1(u.y/.06, .3)) > .5 || nR(u*2.) > .82;
    if (!keep) discard;
  }
#endif
  float near = 1. - smoothstep(18., 55., vZ);
  gEmit = 0.; gGlass = 0.;
  vec3 base = surface(k, vC, w, u, n, vA.x, vA.y, near);
  float e = nR(u*1.7 + w.y*.6)*.6 + nG(u*6.3 - w.y*2.)*.4 - .5;
  // the light, in two tones with a brushed edge
  float ndl = dot(n, sunDir);
  float paintE = e*(1. - uReal), lit = sunOn(ndl, paintE*.14, .0, .1);
  float sh = (shadowOn > .5 && lit > 0.) ? shadeOf(shadowAt(w, n, e), paintE*.3) : 1.;
  float L = lit*sh*dayK;
  vec3 cl = sunRoll(base*sunCol);
  vec3 cs = base*shadeCol*mix(.92 + .16*max(n.y, 0.), .74 + .42*max(n.y, 0.) + .12*max(-n.y, 0.), uReal) + vec3(.025, .03, .045)*dayK;
  vec3 c = mix(cs, cl, L);
  c += base*lampAt(w, n);
  // glass takes the sky by day
  c = mix(c, mix(c, skyCol*.85, .25), gGlass*(1. - uNight)*(1. - L*.5));
  // wet: the ground darkens, takes the sky in its puddles
  if (uWet > 0. && an.y > .6 && (k == 2 || k == 28 || k == 3 || k == 18 || k == 19 || k == 20 || k == 33 || k == 17)) {
    float pud = smoothstep(.58, .64, nR(w.xz*.22 + 3.) + (k == 20 || k == 28 ? .08 : 0.));
    c *= 1. - .3*uWet;
    c = mix(c, skyCol*(.55 + .2*nR(w.xz*vec2(.5, 3.))), pud*uWet*.75);
  }
  // the marks, sized for the screen: far surfaces get the same strokes drawn bigger (two sizes blended)
  float lv = max(log2(max(vZ/pScale*3.*dpr/.016, 1e-3)), 0.), i0 = floor(lv), fr = fract(lv), k0 = exp2(i0), k1 = k0*2.;
  float T = mix(streak(u, k0), streak(u, k1), fr);
  c *= 1. + (mix(.5, T, 1. - smoothstep(150., 380., vZ)) - .5)*.22*(1. - gEmit)*uMarks*(1. - uReal*.8);
  if (vZ < 230. && gEmit < .5 && uMarks > .5 && uReal < .99) {
    // grey pencil in the shade: one way where it's shaded, crossed where it's darkest
    float shade = 1. - L, h = 0.;
    if (shade > .35) {
      vec2 a = rot(u, .78);
      h = mix(hatch(a, .05*k0), hatch(a, .05*k1), fr);
      float deep = shade*smoothstep(.0, -.35, ndl + e*.1);
      if (deep > .45 || dayK < .3) { vec2 bb = rot(u, -.62) + 17.; h = max(h, mix(hatch(bb, .056*k0), hatch(bb, .056*k1), fr)); }
      h *= 1. - smoothstep(90., 230., vZ);
    }
    vec3 pencil = vec3(.36, .37, .41)*mix(.35, 1., dayK);
    c = mix(c, c*.55 + pencil*.25, h*.55*(1. - gEmit)*(1. - uReal));
    if (L > .5 && an.y < .5 && vZ < 70.) {
      vec2 fq = vec2(u.x, u.y*.02);
      float hf = mix(hatch(fq, .03*k0), hatch(fq, .03*k1), fr)*L*.35*(1. - smoothstep(25., 70., vZ));
      c = mix(c, c*.82, hf*.5*(1. - uReal));
    }
  }
  // out the way three's materials write (tone-mapped, linear), then the game's haze over it
  vec3 o = pow(max(c, vec3(0.)), vec3(2.2));
  float fd = length(w - cameraPosition);
  vec3 rw = (w - cameraPosition)/max(fd, 1e-4);
  const float FALL = .0042;
  float ry = rw.y*fd;
  float hf = exp(-FALL*max(cameraPosition.y, 0.))*(abs(ry) > .05 ? (1. - exp(-FALL*ry))/(FALL*ry) : 1.);
  float od = fogDensity*max(fd - 12., 0.)*hf;
  float ff = 1. - exp(-od);
  vec3 fc = fogCol;
  float lm = max(max(sunLc.r, sunLc.g), max(sunLc.b, 1e-3));
  float sa = max(dot(rw, sunDir), 0.);
  fc = mix(fc, sqrt(sunLc/lm), pow(sa, 6.)*.32*clamp(lm*.25, 0., 1.));
  // how much this surface mirrors, for the reflections pass: glass, standing water, a little from a road
  float mir = gGlass*.34 + (an.y > .6 && (k == 2 || k == 28) ? .012 + .75*uWet : (an.y > .6 ? .55*uWet : 0.));
  fragColor = vec4(mix(o, fc, ff), 1. - clamp(mir*(1. - ff), 0., .95));
}`;

// one 256² tile of everything the brush and the pencil need
//   r smooth noise (16 cells a tile), g fine noise (64), b pencil lines (32 a tile, wavering, broken), a dry-brush streaks
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

function mat(defines, opts = {}) {
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: PU, defines, glslVersion: THREE.GLSL3, ...opts });
  m.isPaint = true;
  return m;
}

// the compact geometry the painted city's builders make (world/geom.js pack()), as a three.js geometry
export function packGeo(pk) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pk.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(pk.nor, 3, true));
  g.setAttribute('pcol', new THREE.BufferAttribute(pk.col, 3, true));
  g.setAttribute('pkind', new THREE.BufferAttribute(pk.kind, 1, false));
  g.setAttribute('paux', new THREE.BufferAttribute(pk.aux, 2, true));
  g.setAttribute('puv', new THREE.BufferAttribute(pk.uv, 2, false));
  g.setIndex(new THREE.BufferAttribute(pk.idx, 1));
  const b = pk.box;
  g.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return g;
}

const _c = new THREE.Color(), _v = new THREE.Vector3();
export class Paint {
  constructor(renderer) {
    this.renderer = renderer;
    this.sync = 0;
    PU.tNoise.value = paintNoise();
    // until the sun's shadow map exists (the first frame, the game's shader warm-ups, shadows off) the shader still
    // needs a depth texture that compares: a 1x1 one, cleared to "far" (all lit)
    const nd = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType); nd.compareFunction = THREE.LessEqualCompare;
    this.noShadow = new THREE.WebGLRenderTarget(1, 1, { depthTexture: nd, depthBuffer: true });
    const was = renderer.getRenderTarget(); renderer.setRenderTarget(this.noShadow); renderer.clear(true, true, false); renderer.setRenderTarget(was);
    PU.shadowTex.value = nd;
    this.world = mat({ FMT_WORLD: '' });
    this.cut = mat({ FMT_WORLD: '', CUT: '' }, { side: THREE.DoubleSide });
    this.shutter = mat({ FMT_SHUTTER: '' });
    paint = this;
  }
  ground() { return mat({ FMT_GROUND: '' }); }
  facade() { return mat({ FMT_FACADE: '' }); }
  roof() { return mat({ FMT_ROOF: '' }); }
  prop(opts = {}) { return mat({ FMT_PROP: '' }, { vertexColors: true, ...opts }); }
  water() { return mat({ FMT_WATER: '' }); }
  // the game's sky, as paint: run before each frame is drawn
  update(sky, camera, scene) {
    const R = this.renderer;
    if (sky && sky.sun) {
      const s = sky.sun, h = sky.hemi;
      _v.copy(s.position).sub(s.target.position).normalize();
      PU.sunDir.value.copy(_v);
      const ex = R.toneMappingExposure || 1, PI = Math.PI;
      const amb = h ? [h.color.r * h.intensity / PI, h.color.g * h.intensity / PI, h.color.b * h.intensity / PI] : [0.3, 0.3, 0.35];
      const sun = [s.color.r * s.intensity / PI, s.color.g * s.intensity / PI, s.color.b * s.intensity / PI];
      const up = Math.max(0, Math.min(1, _v.y * 4 + 0.15));
      const tm = (x) => Math.min(1.25, Math.pow(Math.max(0, x), 1 / 2.2));
      const nf = GU.uNight.value;
      PU.shadeCol.value.set(tm(amb[0] * ex * 1.15) * 0.85 + nf*.07, tm(amb[1] * ex * 1.15) * 0.85 + nf*.09, tm(amb[2] * ex * 1.15) * 0.85 + nf*.17);
      PU.sunCol.value.set(tm((amb[0] + sun[0] * 0.8 * up) * ex), tm((amb[1] + sun[1] * 0.8 * up) * ex), tm((amb[2] + sun[2] * 0.8 * up) * ex));
      PU.sunLc.value.set(s.color.r * s.intensity, s.color.g * s.intensity, s.color.b * s.intensity);
      PU.dayK.value = Math.max(0, Math.min(1, (s.intensity * up) / 1.2));
      const sm = s.castShadow && s.shadow && s.shadow.map;
      if (sm && sm.depthTexture) {
        PU.shadowTex.value = sm.depthTexture;
        PU.shadowMat.value = s.shadow.matrix;
        PU.shadowTexel.value = 1 / (s.shadow.mapSize.x || 2048);
        PU.shadowOn.value = R.shadowMap.enabled ? 1 : 0;
      } else { PU.shadowTex.value = this.noShadow.depthTexture; PU.shadowOn.value = 0; }
    }
    if (scene && scene.fog) {
      PU.fogCol.value.copy(scene.fog.color);
      PU.fogDensity.value = scene.fog.density !== undefined ? scene.fog.density : 0.001;
      _c.copy(scene.fog.color);
      PU.skyCol.value.set(Math.pow(_c.r, 1 / 2.2), Math.pow(_c.g, 1 / 2.2), Math.pow(_c.b, 1 / 2.2));
    }
    PU.dpr.value = R.getPixelRatio();
    const v = R.getDrawingBufferSize(_v2);
    PU.pScale.value = camera && camera.isPerspectiveCamera ? v.y / (2 * Math.tan(camera.fov * Math.PI / 360)) / PU.dpr.value : 800;
  }
}
const _v2 = new THREE.Vector2();
// the one Paint (made by main.js before the world is built; the builders and the material swaps reach it here)
export let paint = null;

// the same few pixels for everyone, in a fine even scatter: a near model fading out over a band at the edge of its range
// leaves exactly the pixels the far one fading in takes (keep h above the fade on one side, below it on the other), so
// nothing's ever drawn twice or missing while one swaps for the other
export const DITHER = `float ditherH(){ return fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))); }`;
