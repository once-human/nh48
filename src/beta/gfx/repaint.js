// /beta's paint for everything else: whatever the game makes with three's stock materials (signs, decals, props with their
// own colours, animals, the metro, the far city, rooms...) compiles to this instead of three's lighting. The material
// itself stays what the game made, so its colour, opacity, glow and textures go on working as the game sets them.
import * as THREE from 'three';
import { PU, LAMP } from './paint.js';

export const inside = { value: 0 };           // (in a room: the sun has no say)

const VS = `#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <skinning_pars_vertex>
varying vec3 vN, vW; varying float vZ;
#ifdef MASK
varying vec2 vMaskUV;
#endif
void main(){
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
#ifdef PAINT_LIT
#include <emissivemap_pars_fragment>
uniform vec3 emissive, sunDir, sunCol, shadeCol; uniform sampler2D tNoise; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform float shadowTexel, shadowOn, dayK, uInside;
${LAMP}
#ifdef STANDARD
uniform float roughness, metalness;
#endif
float shadowAt(vec3 w, vec3 n){ vec4 s = shadowMat*vec4(w + n*(.05 + .002*vZ), 1.); if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  float z = s.z - .0006; return .5*(texture(shadowTex, vec3(s.xy + vec2(-.6, .3)*shadowTexel, z)) + texture(shadowTex, vec3(s.xy + vec2(.6, -.3)*shadowTexel, z))); }
#endif
void main(){
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
  vec3 b = c;
  float e = texture2D(tNoise, gl_FragCoord.xy*.11/16.).r - .5;
  if (uInside > .5) {
    c = b*(.72 + .28*n.y)*vec3(1., .97, .9);
  } else {
    float ndl = dot(n, sunDir), lit = smoothstep(.0, .14, ndl + e*.12);
    float sh = (shadowOn > .5 && lit > 0.) ? smoothstep(.3, .7, shadowAt(vW, n) + e*.3) : 1., L = lit*sh*dayK;
    c = mix(b*shadeCol*(.92 + .16*max(n.y, 0.)) + b*.04*dayK, b*sunCol, L) + b*lampAt(vW, n);
#ifdef STANDARD
    // what shines catches the sky at a glance; metal is mostly that
    vec3 V = normalize(cameraPosition - vW); float g = 1. - roughness, fr = pow(1. - max(dot(n, V), 0.), 3.), sky = smoothstep(-.2, .7, reflect(-V, n).y);
    c = mix(c, fogCol*(.5 + .7*sky), clamp(fr*g*g, 0., .8));
    c = mix(c, b*(.25 + 1.1*sky) + b*sunCol*smoothstep(.9, .99, dot(reflect(-V, n), sunDir))*g, metalness*.8);
#endif
    float h = smoothstep(.5, .72, fract((gl_FragCoord.x + gl_FragCoord.y)*.17 + e*.9))*(1. - L)*(1. - smoothstep(10., 34., vZ)); c = mix(c, c*.72, h*.55);
  }
  c += totalEmissiveRadiance;
#endif
#ifdef USE_FOG
  float f = fogDensity*vZ; c = mix(c, fogCol, 1. - exp(-f*f));
#endif
  gl_FragColor = vec4(c, diffuseColor.a);
}`;

function paint(m, sh) {
  const lit = m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial, head = (lit ? '#define PAINT_LIT\n' : '') + (sh.uniforms.tMask ? '#define MASK\n' : '');
  sh.vertexShader = head + VS; sh.fragmentShader = head + FS;
  Object.assign(sh.uniforms, { sunDir: PU.sunDir, sunCol: PU.sunCol, shadeCol: PU.shadeCol, fogCol: PU.fogCol, fogDensity: PU.fogDensity, tNoise: PU.tNoise, shadowTex: PU.shadowTex, shadowMat: PU.shadowMat, shadowTexel: PU.shadowTexel, shadowOn: PU.shadowOn, dayK: PU.dayK, uInside: inside, tLamp: PU.tLamp, lampC: PU.lampC, lampY: PU.lampY, headP: PU.headP, headD: PU.headD });
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
