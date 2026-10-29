// Materials: three.js Lambert/Standard materials with small shader injections
// (texture arrays for ground + facades, tint masks, night window lights, paint channels).
import * as THREE from 'three';

// uniforms shared by every custom material, driven by the time-of-day system
export const U = {
  uTime: { value: 0 },
  uNight: { value: 0 },          // 0 day .. 1 full night
  uDay: { value: 1 },
  uSkyRefl: { value: new THREE.Color(0.55, 0.65, 0.78) },
  uWindowLit: { value: 0.0 },    // fraction of windows lit (evening ramps up)
  uShopsOpen: { value: 1.0 },    // shutters up 1 .. down 0 (late night)
  uWind: { value: 1.0 },
  uWet: { value: 0.0 },           // rain on the roads: 0 dry .. 1 soaked (gfx/weather.js)
};

function inject(shader, decl, vertexMain, fragDecl, fragMap) {
  if (decl) shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + decl);
  if (vertexMain) shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + vertexMain);
  if (fragDecl) shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + fragDecl);
  if (fragMap) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', fragMap);
}

export function groundMaterial(tex) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tGround = { value: tex };
    inject(sh,
      'attribute vec2 guv; attribute float glayer; attribute float gshade;\nvarying vec2 vGuv; varying float vLayer; varying float vShade;',
      'vGuv = guv; vLayer = glayer; vShade = gshade;',
      'uniform highp sampler2DArray tGround;\nvarying vec2 vGuv; varying float vLayer; varying float vShade;',
      `vec4 gt = texture(tGround, vec3(vGuv, vLayer));
       vec4 gm = texture(tGround, vec3(vGuv * 0.131 + vec2(0.37, 0.71), vLayer));
       float lm = dot(gm.rgb, vec3(0.3333));
       diffuseColor.rgb *= gt.rgb * mix(0.8, 1.22, smoothstep(0.1, 0.7, lm)) * vShade;`);
  };
  m.customProgramCacheKey = () => 'md-ground';
  return m;
}

export function facadeMaterial(tex) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tFacade = { value: tex };
    sh.uniforms.uNight = U.uNight;
    sh.uniforms.uDay = U.uDay;
    sh.uniforms.uSkyRefl = U.uSkyRefl;
    sh.uniforms.uWindowLit = U.uWindowLit;
    inject(sh,
      'attribute vec2 fuv; attribute float flayer; attribute vec3 ftint; attribute float fseed;\nvarying vec2 vFuv; varying float vFL; varying vec3 vTint; varying float vSeed; varying float vWY;',
      'vFuv = fuv; vFL = flayer; vTint = ftint; vSeed = fseed; vWY = (modelMatrix * vec4(transformed, 1.0)).y;',
      `uniform highp sampler2DArray tFacade; uniform float uNight; uniform float uDay; uniform vec3 uSkyRefl; uniform float uWindowLit;
       varying vec2 vFuv; varying float vFL; varying vec3 vTint; varying float vSeed; varying float vWY;
       float mdHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      `vec4 ft = texture(tFacade, vec3(vFuv, vFL));
       float paintM = smoothstep(0.62, 0.92, ft.a);
       float glassM = 1.0 - smoothstep(0.1, 0.28, abs(ft.a - 0.5));
       vec3 fc = mix(ft.rgb, ft.rgb * vTint, paintM);
       float ao = mix(0.58, 1.0, smoothstep(0.12, 1.9, vWY));
       diffuseColor.rgb *= fc * ao * mix(1.0, 0.45, glassM * uDay);
       vec3 vd = normalize(vViewPosition);
       float fres = pow(1.0 - clamp(abs(dot(vd, normalize(vNormal))), 0.0, 1.0), 2.2);
       vec2 cell = floor(vFuv);
       float h = mdHash(cell + vec2(vSeed * 37.0, vFL * 3.1));
       float lit = step(1.0 - uWindowLit, h);
       vec3 lampCol = mix(vec3(1.0, 0.66, 0.36), vec3(0.82, 0.9, 1.0), step(0.45, mdHash(cell * 1.7 + vSeed * 11.0)));
       totalEmissiveRadiance += glassM * (uSkyRefl * (0.05 + 0.42 * fres) * uDay + lampCol * lit * uNight * 1.15);`);
  };
  m.customProgramCacheKey = () => 'md-facade';
  return m;
}

// vertex-coloured props; optional emissive channel (vertex attr `glow`) that lights up at night
export function propMaterial(opts = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.uNight;
    inject(sh,
      'attribute float glow;\nvarying float vGlow;',
      'vGlow = glow;',
      'uniform float uNight; varying float vGlow;',
      '#include <map_fragment>\n totalEmissiveRadiance += vColor.rgb * vGlow * (0.15 + uNight * 2.2);');
  };
  m.customProgramCacheKey = () => 'md-prop' + (opts.side || 0);
  return m;
}

// Paint channels for instanced vehicles / people:
// attr `paint`: 0 fixed vertex colour, 1 x instanceColor, 2 x aColB, 3 x aColC
const PAINT_DECL = 'attribute float paint; attribute vec3 aColB; attribute vec3 aColC;';
const PAINT_COLOR = `
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
  vColor = vec4(1.0);
#endif
#ifdef USE_COLOR
  vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
  float pc1 = 1.0 - step(0.5, abs(paint - 1.0));
  float pc2 = 1.0 - step(0.5, abs(paint - 2.0));
  float pc3 = 1.0 - step(0.5, abs(paint - 3.0));
  vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, pc1);
  vColor.rgb *= mix(vec3(1.0), aColB, pc2);
  vColor.rgb *= mix(vec3(1.0), aColC, pc3);
#endif
`;
export function paintable(mat, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + PAINT_DECL)
      .replace('#include <color_vertex>', PAINT_COLOR);
  };
  mat.customProgramCacheKey = () => 'md-paint-' + key;
  return mat;
}

export function glowMaterial(color) {
  // emissive bits (lamp heads, tail lights): brighter at night
  const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  m.userData.base = new THREE.Color(color);
  return m;
}

export function waterMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x3e5a4c, roughness: 0.12, metalness: 0.0, transparent: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uSkyRefl = U.uSkyRefl;
    sh.uniforms.uNight = U.uNight;
    inject(sh, 'varying vec3 vWP;', 'vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      `uniform float uTime; uniform vec3 uSkyRefl; uniform float uNight; varying vec3 vWP;
       float wh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
       float wn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
         return mix(mix(wh(i),wh(i+vec2(1,0)),f.x), mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),f.x), f.y); }`,
      `float w1 = wn(vWP.xz * 0.35 + vec2(uTime * 0.12, uTime * 0.05));
       float w2 = wn(vWP.xz * 1.3 - vec2(uTime * 0.21, -uTime * 0.17));
       float hy = smoothstep(0.62, 0.8, wn(vWP.xz * 0.06 + vec2(uTime * 0.008, 0.0)));   // water hyacinth mats
       diffuseColor.rgb = mix(vec3(0.16, 0.22, 0.17) * (0.8 + 0.4 * w1), vec3(0.16, 0.34, 0.1) * (0.8 + 0.3 * w2), hy);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
       float e = 0.6;
       float nx = wn(vWP.xz * 0.9 + vec2(uTime * 0.3, 0.0)) - wn(vWP.xz * 0.9 + vec2(uTime * 0.3 + e, 0.0));
       float nz = wn(vWP.xz * 0.9 + vec2(0.0, uTime * 0.22)) - wn(vWP.xz * 0.9 + vec2(0.0, uTime * 0.22 + e));
       normal = normalize(normal + (viewMatrix * vec4(nx * 0.35, 0.0, nz * 0.35, 0.0)).xyz);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
       float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
       totalEmissiveRadiance += uSkyRefl * fr * 0.55 * (1.0 - uNight * 0.85);`);
  };
  m.customProgramCacheKey = () => 'md-water';
  return m;
}
