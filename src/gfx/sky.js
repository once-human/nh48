// Sky dome, clouds, sun/moon and the time-of-day light for Pune (18.52 N) in late October.
// The look follows Slow Roads: a saturated blue sky that pales into a soft haze at the horizon,
// soft wispy clouds, bright low-contrast light. Clouds are baked once into a tiling texture (a
// few texture reads per sky pixel at runtime instead of noise maths), and the fog is given the
// exact on-screen horizon colour so far streets melt into the sky (see atmos.js).
import * as THREE from 'three';
import { lerp, smoothstep } from '../core/util.js';
import { U } from './materials.js';
import { neutralTone } from './atmos.js';

const DEG = Math.PI / 180;
const LAT = 18.52 * DEG;
const DECL = -10.9 * DEG;              // solar declination around 19 October
const SOLAR_OFFSET = -20 / 60;         // IST -> local solar time (longitude + equation of time)

export function sunDirection(hourIST, out = new THREE.Vector3()) {
  const st = hourIST + SOLAR_OFFSET;
  const H = (st - 12) * 15 * DEG;
  const sinAlt = Math.sin(LAT) * Math.sin(DECL) + Math.cos(LAT) * Math.cos(DECL) * Math.cos(H);
  const alt = Math.asin(sinAlt);
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(DECL) * Math.cos(LAT)); // from south, +west
  const c = Math.cos(alt);
  out.set(-Math.sin(az) * c, Math.sin(alt), Math.cos(az) * c);
  return { dir: out, alt: alt / DEG };
}

// Keyframes by sun altitude (degrees). Colours are linear RGB (sRGB hex in the comments).
// zen/hor: sky; sun: sunlight colour, si: its intensity (π = surface shows its albedo);
// sky/gnd: ambient from above/below, ai: ambient intensity; cl/cs: lit/shaded cloud colours;
// fog: haze density per metre; exp: exposure.
const K = (alt, zen, hor, sun, si, sky, gnd, ai, cl, cs, fog, exp) => ({ alt, zen, hor, sun, si, sky, gnd, ai, cl, cs, fog, exp });
const KEYS = [
  K(-14, [0.003, 0.006, 0.02], [0.05, 0.04, 0.045], [0.42, 0.52, 0.8], 0.22, [0.12, 0.15, 0.25], [0.06, 0.05, 0.045], 0.25, [0.06, 0.06, 0.075], [0.025, 0.025, 0.035], 0.0016, 1.1),
  K(-5, [0.02, 0.04, 0.13], [0.3, 0.19, 0.2], [0.45, 0.5, 0.78], 0.26, [0.25, 0.25, 0.38], [0.1, 0.08, 0.07], 0.3, [0.5, 0.28, 0.25], [0.08, 0.08, 0.14], 0.0016, 1.15),
  K(1.5, [0.07, 0.14, 0.4], [0.95, 0.5, 0.27], [1.0, 0.5, 0.24], 2.4, [0.58, 0.52, 0.6], [0.45, 0.32, 0.22], 0.42, [1.0, 0.62, 0.42], [0.36, 0.3, 0.42], 0.0014, 1.0),
  K(9, [0.06, 0.2, 0.56], [0.78, 0.66, 0.52], [1.0, 0.78, 0.55], 2.9, [0.66, 0.66, 0.74], [0.6, 0.47, 0.34], 0.5, [1.0, 0.9, 0.78], [0.5, 0.55, 0.68], 0.0011, 1.0),
  K(25, [0.035, 0.18, 0.66], [0.52, 0.67, 0.88], [1.0, 0.93, 0.84], 3.1, [0.66, 0.7, 0.8], [0.58, 0.5, 0.4], 0.52, [1.0, 1.0, 1.0], [0.6, 0.67, 0.82], 0.0009, 1.0),
  K(60, [0.028, 0.16, 0.69], [0.46, 0.63, 0.86], [1.0, 0.97, 0.92], 3.2, [0.66, 0.71, 0.82], [0.58, 0.51, 0.42], 0.52, [1.0, 1.0, 1.0], [0.62, 0.69, 0.84], 0.0008, 1.0),
];

function sampleKeys(alt) {
  if (alt <= KEYS[0].alt) return KEYS[0];
  if (alt >= KEYS[KEYS.length - 1].alt) return KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (alt >= a.alt && alt <= b.alt) {
      const t = (alt - a.alt) / (b.alt - a.alt);
      const o = {};
      for (const k of Object.keys(a)) o[k] = Array.isArray(a[k]) ? a[k].map((v, j) => lerp(v, b[k][j], t)) : lerp(a[k], b[k], t);
      return o;
    }
  }
  return KEYS[0];
}

// ---------------------------------------------------------------- cloud bake (once, at start)
// R: wispy streaks (cirrus), G: soft puffs (fair-weather cumulus). Periodic noise so it tiles.
const BAKE_FS = `
precision highp float;
varying vec2 vUv;
const float P = 8.0;
float h21(vec2 p) { p = mod(p, P); p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  vec2 a = mod(i, per), b = mod(i + 1.0, per);
  return mix(mix(h21(a + per), h21(vec2(b.x, a.y) + per), f.x), mix(h21(vec2(a.x, b.y) + per), h21(b + per), f.x), f.y);
}
float fbm(vec2 p, float per) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * vn(p, per); p *= 2.0; per *= 2.0; a *= 0.5; } return s; }
void main() {
  vec2 p = vUv * P;
  // domain-warped, stretched noise for streaky wisps
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0), P), fbm(p + vec2(5.2, 1.3), P));
  float w = fbm(p * vec2(1.0, 1.0) + q * 2.2, P);
  float wisp = smoothstep(0.48, 0.78, w) * (0.55 + 0.45 * fbm(p * 2.0 + 7.0, P * 2.0));
  float puff = fbm(p * 1.0 + q * 0.8 + 3.7, P);
  puff = smoothstep(0.5, 0.8, puff);
  gl_FragColor = vec4(wisp, puff, w, 1.0);
}`;

function bakeClouds(renderer) {
  const size = 1024;
  const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, depthBuffer: false });
  rt.texture.anisotropy = 4;
  const mat = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: BAKE_FS, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const sc = new THREE.Scene(); sc.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(sc, cam);
  renderer.setRenderTarget(prev);
  mat.dispose(); quad.geometry.dispose();
  return rt;
}

const SKY_VS = `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FS = `
uniform vec3 uSun, uMoon, uZen, uHor, uSunCol, uCloudL, uCloudS;
uniform float uTime, uNight, uSunVis, uCover, uEnv;
uniform vec3 uGnd;
uniform sampler2D tCloud;
varying vec3 vDir;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float hp = max(h, 0.0);
  float sd = max(dot(d, uSun), 0.0);
  // gradient: pale hazy horizon -> deep blue overhead; slightly brighter towards the sun
  vec3 col = mix(uHor, uZen, pow(hp, 0.46));
  col = mix(col, uHor * 1.05, exp(-hp * 14.0) * 0.55);
  col += uSunCol * (pow(sd, 4.0) * 0.07 + pow(sd, 32.0) * 0.18 + pow(sd, 400.0) * 0.6) * uSunVis;
  if (h < 0.0) col = uHor * mix(1.0, 0.92, smoothstep(0.0, -0.2, h));
  // for reflections and ambient light the lower half is the city's ground, not more sky
  if (uEnv > 0.5 && h < 0.0) col = mix(uHor * 0.6, uGnd, smoothstep(0.0, -0.12, h));
  // moon + stars
  float md = max(dot(d, uMoon), 0.0);
  col = mix(col, vec3(0.9, 0.92, 1.0), smoothstep(0.99935, 0.9996, md) * uNight);
  col += vec3(0.5, 0.6, 0.9) * pow(md, 80.0) * 0.08 * uNight;
  float cover = 0.0;
  if (h > 0.0) {
    vec2 sp = d.xz / (h + 0.05) * 150.0;
    float st = step(0.9966, h21(floor(sp))) * smoothstep(0.08, 0.3, h);
    float tw = 0.65 + 0.35 * sin(uTime * 2.3 + h21(floor(sp) + 3.0) * 40.0);
    col += vec3(st * tw) * 0.9 * uNight * smoothstep(0.38, 0.0, length(fract(sp) - 0.5));
    // clouds on a flat layer: wisps drift faster than the puffs; sample a little towards the sun
    // to light the sunward edges
    vec2 uv = d.xz / (h + 0.08);
    vec2 sunUV = normalize(uSun.xz + 1e-4) * 0.006;
    vec2 w1 = uv * 0.055 + vec2(uTime * 0.0009, uTime * 0.0003);
    vec2 w2 = uv * 0.035 + vec2(uTime * 0.0005, -uTime * 0.0002) + 0.37;
    vec4 c1 = texture2D(tCloud, w1);
    vec4 c2 = texture2D(tCloud, w2);
    float c1s = texture2D(tCloud, w1 - sunUV).r;
    float c2s = texture2D(tCloud, w2 - sunUV).g;
    float horizonFade = smoothstep(0.0, 0.16, h);
    float a1 = c1.r * 0.85 * uCover;
    float a2 = smoothstep(0.1, 0.9, c2.g) * 0.95 * uCover * smoothstep(0.02, 0.3, h + 0.1);
    float lit1 = clamp(0.62 + (c1.r - c1s) * 5.0, 0.0, 1.0);
    float lit2 = clamp(0.55 + (c2.g - c2s) * 4.0 - c2.g * 0.25, 0.0, 1.0);
    vec3 cc1 = mix(uCloudS, uCloudL, lit1);
    vec3 cc2 = mix(uCloudS, uCloudL, lit2);
    // near the sun clouds glow; far away they melt into the haze
    cc1 += uSunCol * pow(sd, 10.0) * 0.35 * uSunVis; cc2 += uSunCol * pow(sd, 10.0) * 0.25 * uSunVis;
    cc1 = mix(uHor, cc1, horizonFade * 0.85 + 0.15); cc2 = mix(uHor, cc2, horizonFade * 0.85 + 0.15);
    col = mix(col, cc2, a2 * horizonFade);
    col = mix(col, cc1, a1 * horizonFade);
    cover = max(a1, a2) * horizonFade;
  }
  // sun disc on top (hidden behind thick cloud)
  float disc = smoothstep(0.99962, 0.99978, sd);
  col += uSunCol * disc * 30.0 * uSunVis * (1.0 - cover * 0.85);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.clouds = bakeClouds(renderer);
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, 1, 0) },
      uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
      uCloudL: { value: new THREE.Color() }, uCloudS: { value: new THREE.Color() },
      uTime: U.uTime, uNight: U.uNight, uSunVis: { value: 1 }, uCover: { value: 1 }, uEnv: { value: 0 }, uGnd: { value: new THREE.Color(0.1, 0.09, 0.08) }, tCloud: { value: this.clouds.texture },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = false;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xaabbcc, 0x443322, 0.6);
    scene.add(this.hemi);
    scene.fog = new THREE.FogExp2(0xa0a8b0, 0.001);

    // reflections (glass, paint): the sky without clouds or sun, rebuilt only when the light changes a lot
    this.envUniforms = { ...this.uniforms, uCover: { value: 0 }, uSunVis: { value: 0 }, uEnv: { value: 1 } };
    const envMat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.envUniforms, side: THREE.BackSide, depthWrite: false, fog: false });
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), envMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.envMats = new Set();       // shiny things (paint, glass) get their own full-strength reflections
    this.hour = 15.75;
    this.state = null;
    this.shadowRange = 70;
    this._c = new THREE.Color(); this._ld = new THREE.Vector3(); this._moon = new THREE.Vector3();
  }

  setShadows(on, size) {
    this.sun.castShadow = on;
    if (on) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      const r = this.shadowRange;
      const c = this.sun.shadow.camera;
      c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 500;
      c.updateProjectionMatrix();
    }
  }

  update(hour, focus, dt) {
    this.hour = hour;
    const { dir, alt } = sunDirection(hour);
    const k = sampleKeys(alt);
    const night = smoothstep(1.5, -7, alt);
    U.uNight.value = night;
    U.uDay.value = 1 - night;
    // windows light up from dusk, most go dark after ~23:30
    const late = hour > 23.4 || hour < 5 ? 0.18 : hour > 22 ? 0.45 : 0.62;
    U.uWindowLit.value = smoothstep(4, -3, alt) * late;
    const sunVis = smoothstep(-1.2, 1.0, alt);
    const moon = this._moon.set(-dir.x * 0.6, Math.abs(dir.y) + 0.45, -dir.z * 0.6).normalize();
    const u = this.uniforms;
    u.uSun.value.copy(dir);
    u.uMoon.value.copy(moon);
    u.uZen.value.setRGB(...k.zen);
    u.uHor.value.setRGB(...k.hor);
    u.uSunCol.value.setRGB(...k.sun);
    u.uCloudL.value.setRGB(...k.cl);
    u.uCloudS.value.setRGB(...k.cs);
    u.uSunVis.value = sunVis;
    u.uGnd.value.setRGB(k.gnd[0] * 0.28, k.gnd[1] * 0.28, k.gnd[2] * 0.28).multiplyScalar(0.4 + 0.6 * (k.si / 3.2));
    U.uSkyRefl.value.setRGB(k.hor[0] * 0.6 + k.zen[0] * 0.4, k.hor[1] * 0.6 + k.zen[1] * 0.4, k.hor[2] * 0.6 + k.zen[2] * 0.4);

    // light: sun by day, moon at night
    const lightDir = alt > -2 ? this._ld.copy(dir) : this._ld.copy(moon);
    if (lightDir.y < 0.06) lightDir.y = 0.06;
    lightDir.normalize();
    this.sun.color.setRGB(...k.sun);
    this.sun.intensity = alt > -2 ? k.si * sunVis : k.si;
    this.hemi.color.setRGB(...k.sky);
    this.hemi.groundColor.setRGB(...k.gnd);
    this.hemi.intensity = Math.PI * k.ai;        // three divides ambient by π
    this.renderer.toneMappingExposure = k.exp;
    // haze = the horizon colour exactly as the sky shows it on screen (tone mapped)
    neutralTone(u.uHor.value, k.exp, this.scene.fog.color);
    this.scene.fog.density = k.fog;
    this.state = { alt, night, dir: dir.clone(), lightDir: lightDir.clone() };

    if (focus) {
      // shadow camera follows the player, snapped to texels to avoid shimmering
      const r = this.shadowRange;
      const sz = this.sun.shadow.mapSize.x || 1024;
      const texel = (2 * r) / sz;
      const fx = Math.round(focus.x / texel) * texel, fz = Math.round(focus.z / texel) * texel;
      this.sun.target.position.set(fx, 0, fz);
      this.sun.position.set(fx + lightDir.x * 220, lightDir.y * 220, fz + lightDir.z * 220);
      this.sun.target.updateMatrixWorld();
    }
    this.dome.position.set(focus ? focus.x : 0, 0, focus ? focus.z : 0);
    const bucket = alt > 25 ? 0 : alt > 10 ? 1 : alt > 3 ? 2 : alt > -2 ? 3 : alt > -8 ? 4 : 5;
    if (bucket !== this.envBucket) { this.envBucket = bucket; this.rebuildEnv(); }
  }

  // a material that should reflect the sky at its own envMapIntensity (scene.environment's
  // intensity is kept low because it also feeds the soft ambient light of everything else)
  reflective(m) {
    this.envMats.add(m);
    if (this.envRT) { if (!m.envMap) m.needsUpdate = true; m.envMap = this.envRT.texture; }
    return m;
  }
  rebuildEnv() {
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 400);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.35;
    for (const m of this.envMats) { if (!m.envMap) m.needsUpdate = true; m.envMap = this.envRT.texture; }
    if (old) old.dispose();
  }
}
