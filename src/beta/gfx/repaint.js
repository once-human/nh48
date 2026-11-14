// /beta's paint for everything else: whatever the game makes with three's stock materials (signs, decals, props with their
// own colours, animals, the metro, the far city, rooms...) compiles to this instead of three's lighting. The material
// itself stays what the game made, so its colour, opacity, glow and textures go on working as the game sets them.
import * as THREE from 'three';
import { PU, LAMP, PCF, DITHER } from './paint.js';

export const inside = { value: 0 };           // (in a room: the sun has no say)

const VS = `#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <skinning_pars_vertex>
varying vec3 vN, vW; varying float vZ;
#ifdef MASK
varying vec2 vMaskUV;
#endif
#ifdef GLOW
attribute float aGlow; varying float vGlow;
#endif
#ifdef FADE
varying float vFd;
#endif
#ifdef POTHOLE
attribute vec4 aPotA, aPotP, aPotB, aPotS; attribute float aPotQ; varying vec4 vPotA, vPotP, vPotB, vPotS; varying float vPotQ;
#endif
void main(){
#ifdef POTHOLE
  vPotA = aPotA; vPotP = aPotP; vPotB = aPotB; vPotS = aPotS; vPotQ = aPotQ;
#endif
#if defined(FADE) && defined(USE_INSTANCING)
  vFd = length((modelMatrix*instanceMatrix*vec4(0., 0., 0., 1.)).xz - cameraPosition.xz);
#endif
#ifdef GLOW
  vGlow = aGlow;
#endif
#include <uv_vertex>
#include <color_vertex>
#ifdef MASK
  vMaskUV = uv;
#endif
  vec3 objectNormal = vec3(normal), transformed = vec3(position);
#include <skinbase_vertex>
#include <skinnormal_vertex>
#include <skinning_vertex>
  vec4 p = vec4(transformed, 1.);
#ifdef USE_INSTANCING
  p = instanceMatrix*p; objectNormal = mat3(instanceMatrix)*objectNormal;
#endif
  vec4 w = modelMatrix*p; vW = w.xyz; vN = mat3(modelMatrix)*objectNormal; vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v;
}`;
const FS = `precision highp sampler2DShadow;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
uniform vec3 diffuse; uniform float opacity;
uniform vec3 fogCol; uniform float fogDensity;
varying vec3 vN, vW; varying float vZ;
#ifdef MASK
uniform sampler2D tMask; varying vec2 vMaskUV;
#endif
#ifdef GLOW
varying float vGlow;
#endif
#ifdef PAINT_LIT
#include <emissivemap_pars_fragment>
uniform vec3 emissive, sunDir, sunCol, shadeCol; uniform sampler2D tNoise; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform float shadowTexel, shadowOn, dayK, uInside;
${LAMP}
#ifdef STANDARD
uniform float roughness, metalness;
#endif
${PCF}
float shadowAt(vec3 w, vec3 n){ vec4 s = shadowMat*vec4(w + n*(.05 + .002*vZ), 1.); if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  return shadowPCF(vec3(s.xy, s.z - .0006)); }
#endif
#ifdef FADE
uniform vec4 uFade; varying float vFd;
${DITHER}
#endif
#ifdef POTHOLE
// a pothole, on the skin laid over it (beta/world/potholes.js): follow the eye's ray down into the bowl and paint what it lands on.
// The outline is the same sum of waves the wheels feel, so the floor and its walls meet the skin's edge exactly
varying vec4 vPotA, vPotP, vPotB, vPotS; varying float vPotQ; uniform float uWet; uniform vec3 skyCol;
// (its edge crumbles in: a few centimetres bitten out of it here and there, finer than the outline the wheels feel)
float potE(vec2 l){ float a = atan(l.y, l.x + 1e-6); float bite = texture2D(tNoise, vec2(a*1.9 + vPotB.z*.37, vPotB.w*.29)).r*.6 + texture2D(tNoise, vec2(a*5.3 + vPotB.w*.11, vPotB.z*.17)).g*.4;
  return vPotS.x*(1. + vPotA.x*sin(2.*a + vPotP.x) + vPotA.y*sin(3.*a + vPotP.y) + vPotA.z*sin(4.*a + vPotP.z) + vPotA.w*sin(5.*a + vPotP.w) + vPotB.x*sin(7.*a + vPotB.y))*(1. - .09*bite); }
vec2 potL(vec3 p){ vec2 d = p.xz - vPotB.zw; return vec2(d.x*vPotS.z + d.y*vPotS.w, (-d.x*vPotS.w + d.y*vPotS.z)/vPotQ); }
float potF(vec3 p){ vec2 l = potL(p); return length(l)/potE(l); }
float potStone(vec2 q){ vec2 i = floor(q), f = fract(q); float m = 0.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), r = texture2D(tNoise, (i + g + .5)/16.).rg; float k = texture2D(tNoise, (i + g + 3.5)/16.).b, d = length(g + r - f); m = max(m, (.42 + .3*k - d)*step(.35, k)); } return max(m, 0.); }
// broken pieces of the top layer lying in the bottom: flat-topped, a couple of centimetres thick, each its own
float potChunk(vec2 q){ vec2 i = floor(q), f = fract(q); float best = 9., k = 0.; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), r = texture2D(tNoise, (i + g + 7.5)/16.).rg; float d = max(abs(g.x + r.x - f.x), abs(g.y + r.y - f.y)*1.3); if (d < best) { best = d; k = texture2D(tNoise, (i + g + 11.5)/16.).b; } } return step(.62, k)*(1. - smoothstep(.3, .36, best)); }
float potFloor(vec3 p){ float f = potF(p); if (f >= 1.) return .05;
  // a step down through the tar (3 cm, nearly sheer), then the brown base falling away to the floor, stones and slabs on it
  float tar = min(.035, vPotS.y*.4), ledge = 1. - smoothstep(.955, 1., f), g = f*f*f*f*f*f, base = (1. - g);
  return -tar*ledge - (vPotS.y - tar)*base*(1. - smoothstep(.82, .97, f)) + base*(.018*potStone(p.xz*34.) + .012*potStone(p.xz*13.) + .022*potChunk(p.xz*9.)); }
#endif
void main(){
#ifdef FADE
  { float h = ditherH(), i = uFade.x > 0. ? clamp((vFd - uFade.x + uFade.y)/uFade.y, 0., 1.) : 1., o = clamp((vFd - uFade.z + uFade.w)/uFade.w, 0., 1.); if (h >= i || h < o) discard; }
#endif
#ifdef MASK
  if (texture2D(tMask, vMaskUV).r > .5) discard;
#endif
  vec4 diffuseColor = vec4(diffuse, opacity);
#include <map_fragment>
#include <color_fragment>
#include <alphamap_fragment>
#include <alphatest_fragment>
  vec3 c = diffuseColor.rgb;
#ifdef PAINT_LIT
  vec3 totalEmissiveRadiance = emissive;
#include <emissivemap_fragment>
#ifdef FLAT_SHADED
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
#else
  vec3 n = normalize(vN);
#ifdef DOUBLE_SIDED
  if (!gl_FrontFacing) n = -n;
#endif
#endif
#ifdef POTHOLE
  vec3 rd = normalize(vW - cameraPosition), hit = vW; float tMax = (vPotS.y + .02)/max(-rd.y, .03), t0 = 0., t1 = tMax;
  for (int i = 1; i <= 14; i++) { float t = tMax*float(i)/14.; vec3 q = vW + rd*t; if (q.y < potFloor(q)) { t1 = t; break; } t0 = t; }
  for (int i = 0; i < 5; i++) { float t = (t0 + t1)*.5; vec3 q = vW + rd*t; if (q.y < potFloor(q)) t1 = t; else t0 = t; }
  hit = vW + rd*t1;
  float dp = clamp(-hit.y/vPotS.y, 0., 1.), ep = .006, Fh = potFloor(hit);
  n = normalize(vec3(potFloor(hit - vec3(ep, 0., 0.)) - potFloor(hit + vec3(ep, 0., 0.)), 2.*ep, potFloor(hit - vec3(0., 0., ep)) - potFloor(hit + vec3(0., 0., ep))));
  float stn = potStone(hit.xz*34.) + potStone(hit.xz*13.)*.7, grain = texture2D(tNoise, hit.xz*2.3).r*.6 + texture2D(tNoise, hit.xz*.71).g*.4, chk = potChunk(hit.xz*9.);
  // down the hole: the tar's broken edge, its black layer and the pale line under it, the brown base course, dirt and stones at the bottom
  float tarD = min(.035, vPotS.y*.4)/vPotS.y;
  // (lighter than the road round it, as a real one is: the broken stone and the dust in it catch the light)
  c = dp < .08 ? vec3(.44, .42, .39) : dp < tarD ? vec3(.2, .2, .2) : dp < tarD + .06 ? vec3(.47, .44, .39) : mix(vec3(.4, .35, .28), vec3(.36, .32, .27), smoothstep(tarD, .86, dp));
  c *= .85 + .3*grain; c = mix(c, vec3(.5, .48, .44)*(.85 + .3*grain), smoothstep(.04, .16, stn)*smoothstep(.55, .85, dp)*.7);
  c = mix(c, vec3(.2, .2, .2)*(.9 + .2*grain), chk*smoothstep(.6, .8, dp));     // (a broken slab of tar down there)
  // rain stands in it: a still pool across the bottom, the sky in it, darker round its edge
  float pool = clamp(uWet, 0., 1.)*vPotS.y*.55, lev = -vPotS.y + pool;
  if (pool > .004 && hit.y < lev) { float tw = (lev - vW.y)/rd.y; vec3 wp = vW + rd*tw; float fr = pow(1. - max(-rd.y, 0.), 4.);
    c = mix(vec3(.13, .12, .1), skyCol*.55, .25 + .6*fr)*(1. - .3*smoothstep(.4, 1., potF(wp))); hit = wp; n = vec3(0., 1., 0.); dp = clamp(-hit.y/vPotS.y, 0., 1.); }
  // the rim's shadow: from where the ray landed, does the way to the sun clear the outline?
  vec3 sq = hit + sunDir*(-hit.y/max(sunDir.y, .08)); float potSun = 1. - smoothstep(.97, 1.03, potF(sq));
  c *= .72 + .28*(1. - dp)*(1. - dp);  // (a shallow hole: the sky's light reaches the bottom, only a little less of it)
#endif
  vec3 b = c;
  float e = texture2D(tNoise, gl_FragCoord.xy*.11/16.).r - .5;
  if (uInside > .5) {
    c = b*(.72 + .28*n.y)*vec3(1., .97, .9);
  } else {
    float pe = e*(1. - uReal), ndl = dot(n, sunDir), lit = sunOn(ndl, pe*.12, .0, .14);
    float sh = (shadowOn > .5 && lit > 0.) ? shadeOf(shadowAt(vW, n), pe*.3) : 1., L = lit*sh*dayK;
#ifdef POTHOLE
    L *= potSun;
#endif
    c = mix(b*shadeCol*(.92 + .16*max(n.y, 0.)) + b*.04*dayK, sunRoll(b*sunCol), L) + b*lampAt(vW, n);
#ifdef STANDARD
    // what shines catches the sky at a glance; metal is mostly that
    vec3 V = normalize(cameraPosition - vW); float g = 1. - roughness, fr = pow(1. - max(dot(n, V), 0.), 3.), sky = smoothstep(-.2, .7, reflect(-V, n).y);
    c = mix(c, fogCol*(.5 + .7*sky), clamp(fr*g*g, 0., .8));
    c = mix(c, b*(.25 + 1.1*sky) + b*sunCol*smoothstep(.9, .99, dot(reflect(-V, n), sunDir))*g, metalness*.8);
#endif
    float h = smoothstep(.5, .72, fract((gl_FragCoord.x + gl_FragCoord.y)*.17 + e*.9))*(1. - L)*(1. - smoothstep(10., 34., vZ)); c = mix(c, c*.72, h*.55*(1. - uReal));
  }
#ifdef POTHOLE
  if (any(isnan(c)) || any(isinf(c))) c = vec3(.2);
#endif
#ifdef GLOW
  totalEmissiveRadiance *= vGlow;           // a shop's board goes dark with its shutter (world/shutters.js)
  // (a white board at full strength burnt out the lettering on it: what's brightest is held back, colours stay as they were)
  { float y = dot(totalEmissiveRadiance, vec3(.2126, .7152, .0722)); if (y > .45) totalEmissiveRadiance *= (.45 + (y - .45)*.3)/y; }
#endif
  c += totalEmissiveRadiance;
#endif
#ifdef USE_FOG
  float f = fogDensity*vZ; c = mix(c, fogCol, 1. - exp(-f*f));
#endif
  gl_FragColor = vec4(c, diffuseColor.a);
}`;

function paint(m, sh) {
  const lit = m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial, head = (lit ? '#define PAINT_LIT\n' : '') + (sh.uniforms.tMask ? '#define MASK\n' : '') + (m.userData.glow ? '#define GLOW\n' : '') + (m._fadeU ? '#define FADE\n' : '') + (m.userData.pothole ? '#define POTHOLE\n' : '');
  sh.vertexShader = head + VS; sh.fragmentShader = head + FS;
  Object.assign(sh.uniforms, { uReal: PU.uReal, uTaps: PU.uTaps, uSoft: PU.uSoft, sunDir: PU.sunDir, sunCol: PU.sunCol, shadeCol: PU.shadeCol, fogCol: PU.fogCol, fogDensity: PU.fogDensity, tNoise: PU.tNoise, shadowTex: PU.shadowTex, shadowMat: PU.shadowMat, shadowTexel: PU.shadowTexel, shadowOn: PU.shadowOn, dayK: PU.dayK, uInside: inside, tLamp: PU.tLamp, lampC: PU.lampC, lampY: PU.lampY, headP: PU.headP, headD: PU.headD, headS: PU.headS, headK: PU.headK, uWet: PU.uWet, skyCol: PU.skyCol });
  if (m._fadeU) sh.uniforms.uFade = m._fadeU;
}
const stock = (m) => m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial || m.isLineBasicMaterial;

// three asks each material for onBeforeCompile just before it builds the shader: the game's own runs first (it may
// add what the far city's mask needs), then the shader becomes ours. A game patch that chains the one before it comes
// back through here, which the _in flag lets through.
Object.defineProperty(THREE.Material.prototype, 'onBeforeCompile', {
  configurable: true,
  set(f) { this._own = f; },
  get() {
    return this._wrap || (this._wrap = (sh, r) => {
      if (this._in) return; this._in = true;
      try { if (this._own) this._own(sh, r); if (stock(this)) paint(this, sh); } finally { this._in = false; }
    });
  },
});
