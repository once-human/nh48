// /beta's vehicles, on the new renderer. Same shapes, same paint channels and lamps the game gives every car, bike and
// bus, and the same instanced meshes it fills in (so all its parking, traffic and garage code just works), through a
// painted shader instead of the game's: poster colour in two tones, pencil in the shade, the sky and street along the
// body as brushed bands, a sun glint on paint and chrome, lit glass, tyres matte, lamps that burn at night.
import * as THREE from 'three';
import { PU, LAMP, PCF, DITHER } from '../gfx/paint.js';

// (aDis: a vehicle handing over from one of its versions to the next. Each pixel has its own number (DITHER); the one
// going drops those under .x, the one coming keeps those under 1 - .y, so between them every pixel's drawn once.
// Nothing set, it's (0, 0): all of it)
const VS = `attribute float glow; attribute float paint;
#ifdef USE_INSTANCING
attribute vec3 aColB, aColC; attribute vec2 aLamp, aDis;
#endif
uniform vec2 uLamp; varying vec2 vLp, vDs; varying vec3 vNL;
#ifdef FADE
varying float vFd;
#endif
varying vec3 vN, vW, vC, vL; varying float vG, vP, vZ;
void main(){
#ifdef USE_INSTANCING
  vLp = aLamp + uLamp; vDs = aDis;
#else
  vLp = uLamp; vDs = vec2(0.);
#endif
  vec3 base = color;
#ifdef USE_INSTANCING_COLOR
  if (paint > .5 && paint < 1.5) base *= instanceColor;
#endif
#ifdef USE_INSTANCING
  if (paint > 1.5 && paint < 2.5) base *= aColB; else if (paint > 2.5 && paint < 3.5) base *= aColC;
  mat4 M = modelMatrix*instanceMatrix;
#ifdef FADE
  vFd = length((M*vec4(0., 0., 0., 1.)).xz - cameraPosition.xz);
#endif
#else
  mat4 M = modelMatrix;
#endif
  vC = base; vG = glow; vP = paint; vL = position; vNL = normal;
  vec4 w = M*vec4(position, 1.); vW = w.xyz; vN = mat3(M)*normal;
  vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const GLASS_VS = `varying vec3 vN, vW, vC, vL; varying float vG, vP, vZ;
#ifdef FADE
varying float vFd;
#endif
void main(){
#ifdef USE_INSTANCING
  mat4 M = modelMatrix*instanceMatrix;
#ifdef FADE
  vFd = length((M*vec4(0., 0., 0., 1.)).xz - cameraPosition.xz);
#endif
#else
  mat4 M = modelMatrix;
#endif
  vL = position; vC = vec3(1.); vG = 0.; vP = 0.; vec4 w = M*vec4(position, 1.); vW = w.xyz; vN = mat3(M)*normal; vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const CHUNK = `precision highp float; precision highp sampler2DShadow;
varying vec3 vN, vW, vC, vL; varying float vG, vP, vZ;
uniform sampler2D tNoise; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform vec3 sunDir, sunCol, shadeCol, skyCol, fogCol, uTint; uniform float shadowTexel, shadowOn, fogDensity, dayK, uNight, uRough, uMetal, uClear; uniform vec2 uHd;
float nz(vec2 p){ return texture2D(tNoise, p/16.).r; }
#ifdef FADE
uniform vec4 uFade; varying float vFd;
${DITHER}
#define FADE_OUT { float h = ditherH(), i = uFade.x > 0. ? clamp((vFd - uFade.x + uFade.y)/uFade.y, 0., 1.) : 1., o = clamp((vFd - uFade.z + uFade.w)/uFade.w, 0., 1.); if (h >= i || h < o) discard; }
#else
#define FADE_OUT
#endif
${LAMP}
${PCF}
float shadowAt(vec3 w, vec3 n){ vec4 s = shadowMat*vec4(w + n*(.05 + .002*vZ), 1.); if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  return shadowPCF(vec3(s.xy, s.z - .0006)); }
`;
const FS = CHUNK + `varying vec2 vLp, vDs; varying vec3 vNL; uniform vec3 uInd; uniform float uTime;
${DITHER.replace('ditherH', 'disH')}
void main(){
  FADE_OUT
  if (vDs.x + vDs.y > 0.) { float h = disH(); if (h < vDs.x || h >= 1. - vDs.y) discard; }
  vec3 n = normalize(vN), V = normalize(cameraPosition - vW), b = vC; float matte = vG < -.5 ? 1. : 0., painted = abs(vP - 1.) < .5 ? 1. : 0.;
  float glassy = step(3.5, vP), e = (nz(gl_FragCoord.xy*.11) - .5)*(1. - uReal), ndl = dot(n, sunDir), lit = sunOn(ndl, e*.1, .0, .13), sh = (shadowOn > .5 && lit > 0.) ? shadeOf(shadowAt(vW, n), e*.3) : 1., L = lit*sh*dayK;
  // the cabin's finishes (beta/vehicles/cockpit.js), laid on the face each part shows: carbon weave in a 2x2 twill, its
  // tows catching the light by which way they run (-2); quilted leather, diamonds sewn in with the seams sunk (-3);
  // open-pore wood, the grain along the piece (-4); brushed aluminium (-5); suede (-6); perforated leather (-7); the fine
  // grain moulded into a dashboard's plastic (-8)
  if (vP < -1.5) {
    vec3 an = abs(vNL); vec2 q = an.x > an.y && an.x > an.z ? vL.zy : an.y > an.z ? vL.xz : vL.xy;
    if (vP > -2.5) { vec2 u = q*150., cc = floor(u), ff = fract(u); float w = step(mod(cc.x + cc.y, 4.), 1.5), lk = abs(dot(normalize(cameraPosition - vW), vec3(.7, .2, .7)));
      b *= mix(.55 + .4*sin(3.1416*ff.x)*(.6 + .6*(1. - lk)), .7 + .55*sin(3.1416*ff.y)*(.6 + .6*lk), w); }
    else if (vP > -3.5) { vec2 u = q*15.; float d1 = abs(fract(u.x + u.y) - .5), d2 = abs(fract(u.x - u.y) - .5), m = .5 - max(d1, d2);
      b *= mix(.45, 1., smoothstep(.0, .05, m))*(.88 + .24*smoothstep(.0, .25, m)); }
    else if (vP > -4.5) { float g = sin(q.y*95. + q.x*6. + nz(q*vec2(2., 30.))*9.); b *= .72 + .34*smoothstep(-.6, 1., g) - .12*step(.82, nz(q*vec2(9., 260.))); }
    else if (vP > -5.5) b *= .82 + .32*nz(vec2(q.x*700., q.y*2.5));
    else if (vP > -6.5) b *= .8 + .35*nz(q*900.);
    else if (vP > -7.5) { vec2 f = fract(q*190.) - .5; b *= .55 + .45*smoothstep(.14, .2, length(f)); }
    else b *= .86 + .2*nz(q*1500.) + .06*nz(q*240.);
  }
  // grime low down on the body, a little wear
  float grime = (1. - smoothstep(.15, .7, vW.y))*(.6 + .6*nz(vL.xz*9.))*(1. - matte)*step(-1.5, vP);
  b = mix(b, b*vec3(.62, .56, .48), grime*.4);
  if (matte > .5) b *= .9 + .2*nz(vL.xy*60.);
  vec3 c = mix(b*shadeCol*(.92 + .16*max(n.y, 0.)) + vec3(.022)*dayK, b*sunCol, L) + b*lampAt(vW, n);
  if (matte < .5) {
    // the world along the body: sky above a hard horizon, the road below, brushed on
    vec3 R = reflect(-V, n); float hz = smoothstep(-.02, .06, R.y + e*.08), fres = pow(1. - max(dot(n, V), 0.), 3.);
    vec3 env = mix(vec3(.13, .12, .115)*(.4 + dayK*.6), skyCol*(.3 + .7*dayK)*(1.1 - R.y*.4), hz);
    float gloss = (1. - uRough)*(.5 + .5*painted), amt = gloss*(.1 + .55*fres) + uMetal*.35 + glassy*(.06 + .75*fres);
    c = mix(c, env, clamp(amt, 0., .85));
    float s = pow(max(dot(R, sunDir), 0.), 40.*(1.2 - uRough) + 8.)*gloss*1.6*sh*dayK; c += sunCol*smoothstep(.25, .6, s);
  }
  float h = smoothstep(.5, .72, fract((gl_FragCoord.x + gl_FragCoord.y)*.17 + e*.9))*(1. - L)*(1. - smoothstep(10., 40., vZ)); c = mix(c, c*.7, h*.55*(1. - uReal));
  // lamps. At the back (behind the middle): the red ones a dim tail lamp after dark and bright on the brakes (vLp.x:
  // 1 braking, 0 driving, -1 nobody in it, so dark), the white one only in reverse (vLp.y); the amber ones as they were
  if (vG > 0.) {
    float k = .25 + uNight*3.;
    bool rear = vL.x < 0.;
    bool amber = vC.r > .8 && vC.g > .1 && vC.g < .6 && vC.b < .12;      // (the models' amber is (1, .26, 0), the bus's a touch redder; red's green is ~0)
    bool rd = rear && vG > .45 && vC.r > .5 && vC.g < .3 && vC.b < .3;
    if (rd) k = vLp.x < -.5 ? 0. : uNight*.45 + max(vLp.x, 0.)*(1.5 + uNight*1.1);
    else if (rear && vG > .1 && vG < .2 && vC.r > .8 && vC.g > .8 && vC.b > .75) k = max(vLp.y, 0.)*(9. + uNight*12.);
    else if (amber) k = 0.;     // (amber is the indicators, front and back: dark until they blink. They used to burn steadily with the lights)
    // the indicators (yours: beta/vehicles/details.js): every amber lamp on that side, front, back and the repeater on
    // the wing, on with the blink and dark between, whatever it was doing before (uInd: left, right, the blink)
    // the traffic's own indicators (beta/vehicles/lamps.js: aLamp.y -1 left, -2 right)
    // (-1 to -1.9 left, -2 to -2.9 right: the fraction is that car's own place in the blink)
    float ti = vLp.y < -1.95 ? 2. : vLp.y < -.5 ? 1. : 0., tph = ti > 1.5 ? (-vLp.y - 2.)/.9 : (-vLp.y - 1.)/.9;
    if (amber && ti > .5 && ((ti < 1.5) == (vL.z < 0.))) { float bl = step(.5, fract(uTime*1.4 + tph)); k = bl*(4.5 + uNight*5.); c *= mix(.45, 1., bl); }
    if (amber && (vL.z < 0. ? uInd.x : uInd.y) > .5) { k = uInd.z*(4.5 + uNight*5.); c *= mix(.45, 1., uInd.z); }      // (between blinks the lens is dull plastic)
    // the lamps at the front are on when the driver has them on (uHd.x, 0 to 1 as they come up; nobody in it: dark). The
    // one you're driving (uHd.y) shows lit by day too when you've switched it on, as a real lamp does
    if (!rear && !amber) k = vLp.x < -.5 ? 0. : mix(k, max(k, 2.2), uHd.y)*uHd.x;
    // (a tail lamp is a deep red however bright: its own tint scaled up went pink)
    c += (rd ? vec3(1., .015, .008) : vC)*vG*k;
  }
  float f = fogDensity*vZ, mir = matte > .5 ? 0. : (glassy*.72 + painted*(.3 - .22*grime) + (1. - painted)*(1. - glassy)*.18); gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1. - clamp(mir, 0., .95)); }`;
// glass: dark with the sky across it, a brushed streak, someone's shape behind it left to the imagination
const GLASS_FS = CHUNK + `void main(){
  FADE_OUT
  vec3 n = normalize(vN), V = normalize(cameraPosition - vW); if (!gl_FrontFacing) n = -n;
  vec3 R = reflect(-V, n); float e = nz(gl_FragCoord.xy*.09) - .5, hz = smoothstep(-.05, .12, R.y + e*.1), fres = .25 + .75*pow(1. - max(dot(n, V), 0.), 2.5);
  vec3 env = mix(vec3(.1, .1, .1)*(.3 + .7*dayK), skyCol*(.25 + .75*dayK)*1.1, hz), c = mix(uTint, env, clamp(fres*(.75 + .25*step(.2, fract(vW.x*1.3 + vW.z*1.1 + vW.y*2.1 + e))), 0., .9));
  float s = pow(max(dot(R, sunDir), 0.), 90.)*dayK; c += sunCol*smoothstep(.3, .7, s);
  // clear glass is clear looked down through, and a mirror of the sky looked across; a film's dark whichever way
  // (a car's glass: lightly tinted looked straight through, so you see who's in it and the cabin, and more and more a
  // mirror of the sky the more it's looked along; a film from the garage is dark whichever way)
  float k = clamp((fres - .25)/.75, 0., 1.), al = mix(mix(.62, .9, k), mix(.3, .86, k), uClear);
  float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), al); }`;

function mat(fs, vs, opts = {}) {
  const uniforms = Object.assign({}, PU, { uTint: { value: new THREE.Color(opts.tint ?? 0x15191d).convertSRGBToLinear() }, uRough: { value: opts.rough ?? .38 }, uMetal: { value: opts.metal ?? .1 } });
  uniforms.uLamp = { value: new THREE.Vector2() }; uniforms.uHd = { value: new THREE.Vector2(1, 0) }; uniforms.uInd = { value: new THREE.Vector3() }; uniforms.uClear = { value: opts.clear ? 1 : 0 };
  // (glass you see through: a supercar's engine lid, an auto's screen)
  const m = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, vertexColors: !opts.glass, side: opts.glass ? THREE.DoubleSide : THREE.FrontSide, transparent: !!opts.glass, depthWrite: !opts.glass });
  // every instanced body drawn with this needs its lamps' per-instance state: a model that came without (a parked
  // row, a door cut out of a body, a copy) gets one that's all zero (its tail lamps as any car's at night)
  if (!opts.glass) m.onBeforeRender = (r, sc, cam, geo, obj) => {
    if (!obj.isInstancedMesh) return;
    const A = geo.attributes.aLamp, n = Math.max(1, obj.instanceMatrix.count);
    if (!A || (A._zero && A.count < n)) { const Z = new THREE.InstancedBufferAttribute(new Float32Array(n*2), 2); Z._zero = true; geo.setAttribute('aLamp', Z); }
  };
  m.color = new THREE.Color(opts.tint ?? 0xffffff); m.roughness = opts.rough ?? .38; m.metalness = opts.metal ?? .1;
  return m;
}
export function vehicleMaterials() {
  return { body: mat(FS, VS, { rough: .38, metal: .1 }), solid: mat(FS, VS, { rough: .6, metal: .05 }), glass: mat(GLASS_FS, GLASS_VS, { glass: true, clear: true }), glassI: mat(GLASS_FS, GLASS_VS, { glass: true, clear: true }) };
}
// A car's glass seen from inside (beta/vehicles/cockpit.js): from out there the windows are the body's own glossy panels,
// from your seat they were holes. This is the inside of them: nearly clear, a green-grey tint, more of the sky and the
// cabin in it the flatter you look across it; dust and smears that light up when the sun's in front of you; on the
// windscreen the two arcs the wipers keep cleaner, with a streak at their edge, and the tinted band across its top; on
// the rear glass the demister's lines. Drawn on the inside faces only, after everything solid, writing no depth.
const CG_VS = `varying vec3 vN, vW, vL, vNL;
void main(){ vL = position; vNL = normal; vec4 w = modelMatrix*vec4(position, 1.); vW = w.xyz; vN = mat3(modelMatrix)*normal; gl_Position = projectionMatrix*viewMatrix*w; }`;
const CG_FS = `precision highp float;
uniform sampler2D tNoise; uniform vec3 sunDir, sunCol, skyCol, uTint; uniform float dayK, uNight; uniform vec4 uWip; uniform vec3 uBand;
varying vec3 vN, vW, vL, vNL;
float nz(vec2 p){ return texture2D(tNoise, p/16.).r; }
void main(){
  vec3 n = normalize(vN), V = normalize(cameraPosition - vW); if (dot(n, V) < 0.) n = -n;
  float c = max(dot(n, V), 0.), fres = pow(1. - c, 5.);
  vec3 R = reflect(-V, n), an = abs(vNL); vec2 q = an.x > an.z ? vL.zy : vL.xy;
  float wind = step(.35, vNL.x)*uBand.z, rearG = step(vNL.x, -.35)*uBand.z;
  float d = nz(q*23.)*.55 + nz(q*71. + 3.1)*.3 + nz(q*190.)*.15, dust = smoothstep(.4, .95, d)*.9 + .1, wip = 0.;
  if (wind > .5) for (int i = 0; i < 2; i++) {
    float r = length(vec2(vL.z - (i == 0 ? uWip.y : uWip.z), (vL.y - uWip.x)*1.7));
    if (r < uWip.w && vL.y > uWip.x) { dust *= .35; wip += step(.47, abs(fract(r*55.) - .5))*.2; }
    wip += smoothstep(.014, 0., abs(r - uWip.w))*.7*step(uWip.x, vL.y);
  }
  float glare = pow(max(dot(-V, sunDir), 0.), 5.)*dayK;
  vec3 env = mix(vec3(.04, .038, .035), skyCol*(.2 + .5*dayK), smoothstep(-.15, .5, R.y));
  float a = .035 + .5*fres + (dust*.05 + wip*.06)*(1. + 7.*glare);
  vec3 col = mix(uTint, env, .55) + sunCol*glare*(dust*.6 + wip)*.9;
  // (the shade band across the top of the windscreen: a faint grey-green, as the real ones are. It was a dark blue bar)
  if (wind > .5) { float b = smoothstep(uBand.x, uBand.y, vL.y); col = mix(col, vec3(.07, .1, .1), b*.5); a = max(a, b*.16); }
  if (rearG > .5) { float l = step(fract(vL.y*30.), .05)*step(abs(vL.z), uWip.w*.9); col = mix(col, vec3(.3, .1, .04), l); a = max(a, l*.75); }
  gl_FragColor = vec4(col, clamp(a, 0., .85)); }`;
export function cabinGlass(o = {}) {
  const uniforms = Object.assign({}, PU, { uTint: { value: new THREE.Color(o.tint ?? 0x1c2624).convertSRGBToLinear() }, uWip: { value: new THREE.Vector4(...(o.wip || [0, 0, 0, 0])) }, uBand: { value: new THREE.Vector3(...(o.band || [9, 10, 0])) } });
  return new THREE.ShaderMaterial({ vertexShader: CG_VS, fragmentShader: CG_FS, uniforms, transparent: true, depthWrite: false, side: o.side ?? THREE.BackSide });
}
const FIN = new Map();
export function finishMaterial(key, rough, metal) { if (!FIN.has(key)) FIN.set(key, mat(FS, VS, { rough, metal })); return FIN.get(key); }
const TINT = new Map();
export function tintMaterial(level) { if (!TINT.has(level)) TINT.set(level, mat(GLASS_FS, GLASS_VS, { glass: true, tint: [0x15191d, 0x0b0d10, 0x060708, 0x020203][level] || 0x15191d })); return TINT.get(level); }
