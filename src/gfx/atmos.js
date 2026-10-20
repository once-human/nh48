// Atmosphere: replaces three.js fog with aerial perspective. Distant things fade into the sky's
// horizon colour (exactly the colour the sky dome shows there), the haze thins with height, and
// looking towards the sun the haze picks up a warm glow. It runs in every material's fog step, so
// nothing else has to know about it and it costs a few instructions per pixel.
//
// three applies fog after tone mapping and the sRGB conversion, so the sky code hands the fog the
// already tone-mapped horizon colour (see Sky.update) and everything is mixed in display space.
import * as THREE from 'three';

let installed = false;
export function installAtmosphere() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = `#ifdef USE_FOG
  varying vec3 vFogView;
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
  vFogView = mvPosition.xyz;
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogView;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
  {
    float fd = length(vFogView);
    vec3 rv = vFogView / max(fd, 1e-4);
    // world-space ray direction (view rotation transposed) for the height falloff
    vec3 rw = (vec4(rv, 0.0) * viewMatrix).xyz;
    const float FALL = 0.0042;                       // haze halves every ~165 m of height
    float ry = rw.y * fd;
    float hf = exp(-FALL * max(cameraPosition.y, 0.0)) * (abs(ry) > 0.05 ? (1.0 - exp(-FALL * ry)) / (FALL * ry) : 1.0);
    #ifdef FOG_EXP2
      float od = fogDensity * max(fd - 12.0, 0.0) * hf;
      float fogFactor = 1.0 - exp(-od);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, fd);
    #endif
    vec3 fc = fogColor;
    #if defined( RE_Direct ) && NUM_DIR_LIGHTS > 0
      // sun glow in the haze (warm, from the sun light's own hue)
      vec3 lc = directionalLights[0].color;
      float lm = max(max(lc.r, lc.g), max(lc.b, 1e-3));
      float sa = max(dot(rv, directionalLights[0].direction), 0.0);
      fc = mix(fc, sqrt(lc / lm), pow(sa, 6.0) * 0.32 * clamp(lm * 0.25, 0.0, 1.0));
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fc, fogFactor);
  }
#endif`;
}

// three's NeutralToneMapping in JS, so the fog colour can match what the sky dome shows on screen
export function neutralTone(c, exposure = 1, out = new THREE.Color()) {
  let r = c.r * exposure, g = c.g * exposure, b = c.b * exposure;
  const start = 0.8 - 0.04, desat = 0.15;
  const x = Math.min(r, g, b);
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  r -= off; g -= off; b -= off;
  const peak = Math.max(r, g, b);
  if (peak >= start) {
    const d = 1 - start;
    const np = 1 - d * d / (peak + d - start);
    const s = np / peak;
    r *= s; g *= s; b *= s;
    const t = 1 - 1 / (desat * (peak - np) + 1);
    r += (np - r) * t; g += (np - g) * t; b += (np - b) * t;
  }
  return out.setRGB(Math.max(0, r), Math.max(0, g), Math.max(0, b));
}
