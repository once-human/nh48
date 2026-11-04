// /beta's sky: the game's hours and weather set its colours, as they always did. Painted: the blue in broad bands laid on
// side to side, clouds with a lit side and a shade side and a brushed edge, a flat sun with a ring round it, a moon
// with its shadow, stars as little crosses.
import { PU } from './paint.js';

const FS = `uniform vec3 uSun, uMoon, uZen, uHor, uSunCol, uCloudL, uCloudS; uniform float uTime, uNight, uSunVis, uCover; uniform sampler2D tCloud, tNoise; varying vec3 vDir;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x*p.y); }
void main(){
  vec3 d = normalize(vDir); float h = d.y, hp = max(h, 0.), sd = max(dot(d, uSun), 0.), md = max(dot(d, uMoon), 0.), az = atan(d.x, d.z);
  float br = texture2D(tNoise, vec2(az*.9, h*7.)).r*.65 + texture2D(tNoise, vec2(az*3.1, h*29.)).r*.35;
  float t = pow(hp, .46) + (br - .5)*.09, s = floor(t*8.)/8.;
  vec3 col = mix(uHor, uZen, mix(t, s + .0625, .6));
  col = mix(col, uHor*1.05, exp(-hp*14.)*.55);
  if (h < 0.) col = uHor*mix(1., .92, smoothstep(0., -.2, h));
  float rim = sd + (br - .5)*.012;
  col += uSunCol*(pow(sd, 5.)*.08 + smoothstep(.962, .974, rim)*.05 + smoothstep(.988, .993, rim)*.09)*uSunVis;
  col += vec3(.5, .6, .9)*smoothstep(.985, .995, md + (br - .5)*.01)*.05*uNight;
  float cover = 0.;
  if (h > 0.) {
    vec2 sp = d.xz/(h + .05)*150., f = fract(sp) - .5, id = floor(sp); float on = step(.9966, h21(id))*smoothstep(.08, .3, h), tw = .65 + .35*sin(uTime*2.3 + h21(id + 3.)*40.);
    col += vec3(on*tw)*uNight*max(smoothstep(.07, .0, abs(f.x))*smoothstep(.34, .0, abs(f.y)), smoothstep(.07, .0, abs(f.y))*smoothstep(.34, .0, abs(f.x)));
    vec2 uv = d.xz/(h + .08), sun = normalize(uSun.xz + 1e-4)*.008, w1 = uv*.055 + vec2(uTime*.0009, uTime*.0003), w2 = uv*.035 + vec2(uTime*.0005, -uTime*.0002) + .37;
    vec4 c1 = texture2D(tCloud, w1), c2 = texture2D(tCloud, w2); float ed = (br - .5)*.16, fade = smoothstep(.0, .16, h);
    float a1 = smoothstep(.3, .36, c1.r*uCover + ed)*step(.02, uCover), a2 = smoothstep(.4, .46, c2.g*uCover + ed)*step(.02, uCover);
    float l1 = smoothstep(-.015, .02, c1.r - texture2D(tCloud, w1 - sun).r + ed*.2), l2 = smoothstep(-.015, .02, c2.g - texture2D(tCloud, w2 - sun).g + ed*.2);
    vec3 glow = uSunCol*pow(sd, 10.)*.3*uSunVis, k1 = mix(uCloudS, uCloudL, l1) + glow, k2 = mix(uCloudS, uCloudL, l2*.8) + glow;
    k1 = mix(uHor, k1, fade*.85 + .15); k2 = mix(uHor, k2, fade*.85 + .15);
    col = mix(col, k2, a2*fade); col = mix(col, k1, a1*fade); cover = max(a1, a2)*fade;
  }
  // the moon, with the dark of it cut by a second disc; the sun last
  float mo = smoothstep(.99925, .9995, md), mc = smoothstep(.99925, .9995, max(dot(d, normalize(uMoon + vec3(.012, .004, -.008))), 0.));
  col = mix(col, vec3(.93, .95, 1.), mo*(1. - mc*.92)*uNight*(1. - cover));
  col += uSunCol*smoothstep(.99955, .99972, sd + (br - .5)*.00012)*16.*uSunVis*(1. - cover*.9);
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function paintSky(sky) {
  const m = sky.dome.material;
  m.uniforms.tNoise = PU.tNoise; m.fragmentShader = FS; m.needsUpdate = true;
}
