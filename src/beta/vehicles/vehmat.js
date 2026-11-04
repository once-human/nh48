// /beta's vehicles, on the new renderer. Same shapes, same paint channels and lamps the game gives every car, bike and
// bus, and the same instanced meshes it fills in (so all its parking, traffic and garage code just works), through a
// painted shader instead of the game's: poster colour in two tones, pencil in the shade, the sky and street along the
// body as brushed bands, a sun glint on paint and chrome, lit glass, tyres matte, lamps that burn at night.
import * as THREE from 'three';
import { PU, LAMP } from '../gfx/paint.js';

const VS = `attribute float glow; attribute float paint;
#ifdef USE_INSTANCING
attribute vec3 aColB, aColC;
#endif
varying vec3 vN, vW, vC, vL; varying float vG, vP, vZ;
void main(){
  vec3 base = color;
#ifdef USE_INSTANCING_COLOR
  if (paint > .5 && paint < 1.5) base *= instanceColor;
#endif
#ifdef USE_INSTANCING
  if (paint > 1.5 && paint < 2.5) base *= aColB; else if (paint > 2.5) base *= aColC;
  mat4 M = modelMatrix*instanceMatrix;
#else
  mat4 M = modelMatrix;
#endif
  vC = base; vG = glow; vP = paint; vL = position;
  vec4 w = M*vec4(position, 1.); vW = w.xyz; vN = mat3(M)*normal;
  vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const GLASS_VS = `varying vec3 vN, vW, vC, vL; varying float vG, vP, vZ;
void main(){
#ifdef USE_INSTANCING
  mat4 M = modelMatrix*instanceMatrix;
#else
  mat4 M = modelMatrix;
#endif
  vL = position; vC = vec3(1.); vG = 0.; vP = 0.; vec4 w = M*vec4(position, 1.); vW = w.xyz; vN = mat3(M)*normal; vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const CHUNK = `precision highp float; precision highp sampler2DShadow;
varying vec3 vN, vW, vC, vL; varying float vG, vP, vZ;
uniform sampler2D tNoise; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform vec3 sunDir, sunCol, shadeCol, skyCol, fogCol, uTint; uniform float shadowTexel, shadowOn, fogDensity, dayK, uNight, uRough, uMetal;
float nz(vec2 p){ return texture2D(tNoise, p/16.).r; }
${LAMP}
float shadowAt(vec3 w, vec3 n){ vec4 s = shadowMat*vec4(w + n*(.05 + .002*vZ), 1.); if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  float z = s.z - .0006; return .5*(texture(shadowTex, vec3(s.xy + vec2(-.6, .3)*shadowTexel, z)) + texture(shadowTex, vec3(s.xy + vec2(.6, -.3)*shadowTexel, z))); }
`;
const FS = CHUNK + `void main(){
  vec3 n = normalize(vN), V = normalize(cameraPosition - vW), b = vC; float matte = vG < -.5 ? 1. : 0., painted = abs(vP - 1.) < .5 ? 1. : 0.;
  float e = nz(gl_FragCoord.xy*.11) - .5, ndl = dot(n, sunDir), lit = smoothstep(.0, .13, ndl + e*.1), sh = (shadowOn > .5 && lit > 0.) ? smoothstep(.3, .7, shadowAt(vW, n) + e*.3) : 1., L = lit*sh*dayK;
  // grime low down on the body, a little wear
  float grime = (1. - smoothstep(.15, .7, vW.y))*(.6 + .6*nz(vL.xz*9.))*(1. - matte);
  b = mix(b, b*vec3(.62, .56, .48), grime*.4);
  if (matte > .5) b *= .9 + .2*nz(vL.xy*60.);
  vec3 c = mix(b*shadeCol*(.92 + .16*max(n.y, 0.)) + vec3(.022)*dayK, b*sunCol, L) + b*lampAt(vW, n);
  if (matte < .5) {
    // the world along the body: sky above a hard horizon, the road below, brushed on
    vec3 R = reflect(-V, n); float hz = smoothstep(-.02, .06, R.y + e*.08), fres = pow(1. - max(dot(n, V), 0.), 3.);
    vec3 env = mix(vec3(.13, .12, .115)*(.4 + dayK*.6), skyCol*(.3 + .7*dayK)*(1.1 - R.y*.4), hz);
    float gloss = (1. - uRough)*(.5 + .5*painted), amt = gloss*(.1 + .55*fres) + uMetal*.35;
    c = mix(c, env, clamp(amt, 0., .85));
    float s = pow(max(dot(R, sunDir), 0.), 40.*(1.2 - uRough) + 8.)*gloss*1.6*sh*dayK; c += sunCol*smoothstep(.25, .6, s);
  }
  float h = smoothstep(.5, .72, fract((gl_FragCoord.x + gl_FragCoord.y)*.17 + e*.9))*(1. - L)*(1. - smoothstep(10., 40., vZ)); c = mix(c, c*.7, h*.55);
  if (vG > 0.) c += vC*vG*(.25 + uNight*3.);
  float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;
// glass: dark with the sky across it, a brushed streak, someone's shape behind it left to the imagination
const GLASS_FS = CHUNK + `void main(){
  vec3 n = normalize(vN), V = normalize(cameraPosition - vW); if (!gl_FrontFacing) n = -n;
  vec3 R = reflect(-V, n); float e = nz(gl_FragCoord.xy*.09) - .5, hz = smoothstep(-.05, .12, R.y + e*.1), fres = .25 + .75*pow(1. - max(dot(n, V), 0.), 2.5);
  vec3 env = mix(vec3(.1, .1, .1)*(.3 + .7*dayK), skyCol*(.25 + .75*dayK)*1.1, hz), c = mix(uTint, env, clamp(fres*(.75 + .25*step(.2, fract(vW.x*1.3 + vW.z*1.1 + vW.y*2.1 + e))), 0., .9));
  float s = pow(max(dot(R, sunDir), 0.), 90.)*dayK; c += sunCol*smoothstep(.3, .7, s);
  float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;

function mat(fs, vs, opts = {}) {
  const uniforms = Object.assign({}, PU, { uTint: { value: new THREE.Color(opts.tint ?? 0x15191d).convertSRGBToLinear() }, uRough: { value: opts.rough ?? .38 }, uMetal: { value: opts.metal ?? .1 } });
  const m = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, vertexColors: !opts.glass, side: opts.glass ? THREE.DoubleSide : THREE.FrontSide });
  m.color = new THREE.Color(opts.tint ?? 0xffffff); m.roughness = opts.rough ?? .38; m.metalness = opts.metal ?? .1;
  return m;
}
export function vehicleMaterials() {
  return { body: mat(FS, VS, { rough: .38, metal: .1 }), solid: mat(FS, VS, { rough: .6, metal: .05 }), glass: mat(GLASS_FS, GLASS_VS, { glass: true }), glassI: mat(GLASS_FS, GLASS_VS, { glass: true }) };
}
const FIN = new Map();
export function finishMaterial(key, rough, metal) { if (!FIN.has(key)) FIN.set(key, mat(FS, VS, { rough, metal })); return FIN.get(key); }
const TINT = new Map();
export function tintMaterial(level) { if (!TINT.has(level)) TINT.set(level, mat(GLASS_FS, GLASS_VS, { glass: true, tint: [0x15191d, 0x0b0d10, 0x060708, 0x020203][level] || 0x15191d })); return TINT.get(level); }
