// Physically based city materials: ground (roads, footpaths, soil, grass, kerbs), building facades
// (procedural windows with fake interiors, shop fronts, weathering) and roofs. All of them sample
// Poly Haven CC0 PBR sets packed into texture arrays (albedo / normal / AO-rough-metal).
import * as THREE from 'three';
import { U } from './materials.js';

// ---------------------------------------------------------------- shared GLSL
const NOISE = `
float nhHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float nhNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(nhHash(i), nhHash(i + vec2(1, 0)), f.x), mix(nhHash(i + vec2(0, 1)), nhHash(i + vec2(1, 1)), f.x), f.y); }
float nhFbm(vec2 p) { return nhNoise(p) * 0.5 + nhNoise(p * 2.03 + 7.1) * 0.3 + nhNoise(p * 4.1 + 3.3) * 0.2; }
mat3 nhTangentFrame(vec3 eye, vec3 N, vec2 uv) {
  vec3 q0 = dFdx(eye), q1 = dFdy(eye); vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y;
  float det = max(dot(T, T), dot(B, B)); float s = det == 0.0 ? 0.0 : inversesqrt(det);
  return mat3(T * s, B * s, N);
}
`;

function patch(mat, key, fn) {
  mat.onBeforeCompile = (sh) => fn(sh);
  mat.customProgramCacheKey = () => key;
  return mat;
}
function rep(src, find, add, before = false) {
  if (!src.includes(find)) throw new Error('shader chunk missing: ' + find);
  return src.replace(find, before ? add + '\n' + find : find + '\n' + add);
}

// ---------------------------------------------------------------- ground
// layer table (must match tools/pack_textures.py GROUND order):
// 0 asphalt_01, 1 asphalt_02, 2 interlocking pavers, 3 square pavers, 4 park dirt, 5 leafy grass,
// 6 grass path, 7 dirty concrete, 8 forest ground, 9 damaged road, 10 rubble stone
export const GL = { asphalt: 0, asphaltOld: 1, pavers: 2, tiles: 3, dirt: 4, grass: 5, verge: 6, concrete: 7, earth: 8, broken: 9, rubble: 10,
  kerbPaint: 20, kerbPlain: 21, median: 22, bridge: 23, compound: 24 };
const GROUND_SCALE = [3.6, 3.6, 1.7, 2.2, 3.4, 2.6, 3.2, 3.0, 3.2, 3.2, 3.0];
const GROUND_NORMAL = [0.45, 0.5, 1.1, 0.9, 0.9, 0.7, 0.8, 0.6, 0.9, 0.7, 1.0];

export function groundMaterial(T) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  return patch(m, 'nh-ground', (sh) => {
    Object.assign(sh.uniforms, { tGAlb: { value: T.groundAlb }, tGNrm: { value: T.groundNrm }, tGArm: { value: T.groundArm },
      uGScale: { value: GROUND_SCALE }, uGNorm: { value: GROUND_NORMAL }, uNight: U.uNight, uWet: U.uWet });
    sh.vertexShader = rep(sh.vertexShader, '#include <common>', `attribute vec2 guv; attribute float glayer; attribute float gshade;
      varying vec2 vGuv; varying float vLayer; varying float vShade; varying vec3 vWP; varying float vUp;`);
    sh.vertexShader = rep(sh.vertexShader, '#include <project_vertex>', `vGuv = guv; vLayer = glayer; vShade = gshade; vUp = normalize(mat3(modelMatrix) * objectNormal).y;
      vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = rep(sh.fragmentShader, '#include <common>', `uniform highp sampler2DArray tGAlb, tGNrm, tGArm;
      uniform float uGScale[11]; uniform float uGNorm[11]; uniform float uNight; uniform float uWet;
      varying vec2 vGuv; varying float vLayer; varying float vShade; varying vec3 vWP; varying float vUp;
      ${NOISE}
      float gLayer; vec2 gUV; vec4 gArm; float gPaint;`);
    // albedo: anti-tiled sampling (two scales blended by noise) + macro variation; kerb paint
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      float L = floor(vLayer + 0.5);
      gPaint = 0.0;
      float baseL = L;
      if (L >= 19.5) baseL = 7.0;                      // kerbs, medians: concrete
      if (L > 22.5 && L < 23.5) baseL = 0.0;           // bridge decks: asphalt
      if (L > 23.5) {                                  // building compounds: concrete / tiles / pavers / bare soil patches
        float r = nhNoise(vWP.xz * 0.021 + 11.0) + (nhNoise(vWP.xz * 0.45) - 0.5) * 0.06;
        baseL = r < 0.44 ? 7.0 : r < 0.62 ? 3.0 : r < 0.72 ? 2.0 : r < 0.95 ? 6.0 : 4.0;   // mostly concrete and tiles, some garden, little bare soil
      }
      float hillT = 0.0;
      if (L > 24.5) {                                  // Pune's hills after the rains: dry grass, scrub, red laterite and rock on the steep bits
        float r = nhNoise(vWP.xz * 0.013 + 4.0) + (nhNoise(vWP.xz * 0.21) - 0.5) * 0.12;
        float steep = 1.0 - vUp;
        baseL = steep > 0.34 ? 10.0 : steep > 0.2 ? 8.0 : r < 0.5 ? 6.0 : r < 0.8 ? 5.0 : 8.0;
        hillT = 1.0;
      }
      int li = int(baseL);
      float sc = uGScale[li];
      vec2 uv1 = vGuv / sc;
      vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * vGuv / (sc * 1.37) + vec2(0.31, 0.77);
      float blendN = smoothstep(0.35, 0.65, nhNoise(vWP.xz * 0.07));
      vec4 a1 = texture(tGAlb, vec3(uv1, baseL)), a2 = texture(tGAlb, vec3(uv2, baseL));
      vec4 alb = mix(a1, a2, blendN);
      gLayer = baseL; gUV = mix(uv1, uv2, step(0.5, blendN));
      gArm = mix(texture(tGArm, vec3(uv1, baseL)), texture(tGArm, vec3(uv2, baseL)), blendN);
      // roads: blend fresh and old asphalt in large patches, tyre-darkened lanes, dusty edges
      if (baseL < 1.5) {
        float patchN = nhFbm(vWP.xz * 0.025);
        vec4 old = texture(tGAlb, vec3(uv1 * 0.93, 1.0));
        alb = mix(alb, old, smoothstep(0.45, 0.62, patchN));
        // keep the fine grain, lose most of the crack lines (they read as dirty and busy)
        vec3 avgA = textureLod(tGAlb, vec3(uv1, baseL), 9.0).rgb;
        alb.rgb = mix(avgA, alb.rgb, 0.42);
        alb.rgb *= mix(0.93, 1.06, nhNoise(vWP.xz * 0.35)) * 1.9;   // a touch lighter than real asphalt (reads cleaner)
      }
      // open ground: dusty soil with patchy grass and leaf litter
      if (baseL > 3.5 && baseL < 4.5) {
        float g = smoothstep(0.42, 0.68, nhFbm(vWP.xz * 0.11 + 1.7));
        vec4 v = texture(tGAlb, vec3(vGuv / 3.2, 6.0));
        alb = mix(alb, v, g);
      }
      if (baseL > 7.5 && baseL < 8.5) {
        float g = smoothstep(0.4, 0.7, nhFbm(vWP.xz * 0.09));
        alb = mix(alb, texture(tGAlb, vec3(vGuv / 2.6, 5.0)), g * 0.8);
      }
      float macro = mix(0.86, 1.1, nhFbm(vWP.xz * 0.045 + 3.0));
      vec3 col = alb.rgb * macro;
      if (hillT < 0.5 && baseL > 4.5 && baseL < 5.5) col *= vec3(0.74, 1.06, 0.62);   // lawns and parks: green after the monsoon
      if (hillT > 0.5) {                               // golden October grass, greener in the folds, a rust tint on the bare ground
        float dry = smoothstep(0.3, 0.75, nhFbm(vWP.xz * 0.006 + 9.0));
        col *= mix(vec3(0.98, 1.04, 0.86), vec3(1.16, 1.02, 0.72), dry);
        if (baseL > 7.5) col *= vec3(1.12, 0.94, 0.84);
      }
      if (L > 19.5 && L < 20.5) {      // black & yellow kerb paint (alternating 0.6 m blocks)
        float band = step(0.5, fract(vGuv.x / 1.2));
        vec3 paint = mix(vec3(0.03, 0.03, 0.03), vec3(0.85, 0.62, 0.05), band);
        float worn = smoothstep(0.25, 0.6, nhNoise(vGuv * 3.0));
        col = mix(col, paint * (0.75 + 0.35 * alb.r), 0.85 * worn + 0.1);
        gPaint = 1.0;
      } else if (L > 21.5 && L < 22.5) {   // median: whitewash with grime
        col = mix(col, vec3(0.85), 0.35);
      }
      diffuseColor.rgb *= col * vShade;
      // wet: the ground darkens and turns glossy, and puddles collect in the low spots
      float wetM = uWet * smoothstep(0.3, 0.8, vUp);
      float puddle = wetM * smoothstep(0.56, 0.74, nhNoise(vWP.xz * 0.16)) * step(L, 9.5);
      diffuseColor.rgb *= 1.0 - 0.34 * wetM - 0.18 * puddle;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `
      float roughnessFactor = clamp(gArm.g * 1.05, 0.35, 1.0);
      if (gPaint > 0.5) roughnessFactor = 0.6;
      roughnessFactor = mix(roughnessFactor, 0.2, wetM * 0.8);
      roughnessFactor = mix(roughnessFactor, 0.04, puddle);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', 'float metalnessFactor = 0.0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      {
        vec3 mapN = texture(tGNrm, vec3(gUV, gLayer)).xyz * 2.0 - 1.0;
        mapN.xy *= uGNorm[int(gLayer)];
        mat3 tbn = nhTangentFrame(-vViewPosition, normal, gUV);
        normal = normalize(tbn * mapN);
      }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `
      float ambientOcclusion = mix(1.0, gArm.r, 0.45);
      reflectedLight.indirectDiffuse *= ambientOcclusion;
      reflectedLight.indirectSpecular *= ambientOcclusion;`);
  });
}

// ---------------------------------------------------------------- facades
// wall layers (tools/pack_textures.py WALL order)
export const WL = { plaster: 0, stucco: 1, beige: 2, concrete: 3, worn: 4, damaged: 5, cladding: 6, tiles: 7, brick: 8,
  rubble: 9, sandstone: 10, shutter: 11, rustyShutter: 12, tin: 13, bitumen: 14, clayTiles: 15, wood: 16, slab: 17 };
const WALL_SCALE = [2.6, 2.4, 2.6, 3.0, 2.6, 2.8, 2.2, 1.4, 2.2, 3.0, 2.6, 2.4, 2.4, 2.0, 3.0, 2.4, 1.8, 3.0];
const WALL_TINT = [1, 1, 1, 0.6, 1, 1, 1, 0.25, 0.1, 0, 0.15, 1, 0, 0.3, 0, 0, 0.2, 0.3];

// style table: fh (floor height), gh (ground floor height), win w, win h, spacing, sill,
// frame colour index, grill chance, shape (0 rect, 1 round arch, 2 pointed arch, 3 strip, 4 curtain wall)
export const STYLE_PARAMS = [
  /* 0 apartment */   [3.05, 3.2, 1.2, 1.25, 2.9, 0.85, 0, 0.55, 0],
  /* 1 commercial */  [3.4, 4.0, 2.4, 1.6, 3.2, 0.75, 1, 0.15, 3],
  /* 2 old (wada) */  [3.1, 3.4, 0.9, 1.35, 2.3, 0.75, 2, 0.75, 1],
  /* 3 bungalow */    [3.2, 3.2, 1.4, 1.4, 3.6, 0.8, 0, 0.35, 0],
  /* 4 institution */ [3.7, 3.8, 1.5, 1.8, 3.3, 0.9, 0, 0.3, 0],
  /* 5 heritage */    [4.6, 4.8, 1.2, 2.3, 3.2, 0.9, 2, 0.0, 2],
  /* 6 shed */        [2.8, 2.9, 0.9, 0.9, 4.5, 1.2, 1, 0.6, 0],
  /* 7 canopy */      [3.0, 3.0, 0.0, 0.0, 9.0, 1.0, 0, 0.0, 0],
  /* 8 temple */      [3.4, 3.8, 0.7, 1.0, 3.5, 1.2, 2, 0.0, 1],
  /* 9 glass */       [3.6, 4.4, 2.8, 2.6, 3.0, 0.3, 3, 0.0, 4],
  /* 10 church */     [5.0, 5.0, 1.1, 3.0, 3.4, 1.2, 2, 0.0, 2],
  /* 11 fort */       [4.0, 4.0, 0.0, 0.0, 9.0, 1.0, 2, 0.0, 0],
  /* 12 station */    [4.4, 4.8, 1.4, 2.4, 3.4, 0.9, 1, 0.0, 1],
  /* 13 pyramid */    [3.6, 3.6, 0.0, 0.0, 9.0, 1.0, 3, 0.0, 0],
  /* 14 brick */      [4.2, 4.4, 1.1, 2.4, 3.0, 1.0, 2, 0.0, 1],
];

export function facadeMaterial(T) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  const sp = STYLE_PARAMS.map(p => new THREE.Vector4(p[0], p[1], p[2], p[3]));
  const sp2 = STYLE_PARAMS.map(p => new THREE.Vector4(p[4], p[5], p[6], p[7]));
  const sp3 = STYLE_PARAMS.map(p => p[8]);
  return patch(m, 'nh-facade', (sh) => {
    Object.assign(sh.uniforms, { tWAlb: { value: T.wallAlb }, tWNrm: { value: T.wallNrm }, tWArm: { value: T.wallArm },
      uWScale: { value: WALL_SCALE }, uWTint: { value: WALL_TINT }, uSP: { value: sp }, uSP2: { value: sp2 }, uSP3: { value: sp3 },
      uNight: U.uNight, uDay: U.uDay, uWindowLit: U.uWindowLit, uShopsOpen: U.uShopsOpen, uTime: U.uTime });
    sh.vertexShader = rep(sh.vertexShader, '#include <common>', `
      attribute vec2 fuv; attribute vec2 fedge; attribute vec3 ftint; attribute vec4 fstyle; attribute vec2 ftan; attribute float ftop;
      varying vec2 vFuv; varying vec2 vEdge; varying vec3 vTint; varying vec4 vStyle; varying vec3 vTanW; varying float vTop; varying vec3 vWP;`);
    sh.vertexShader = rep(sh.vertexShader, '#include <project_vertex>', `
      vFuv = fuv; vEdge = fedge; vTint = ftint; vStyle = fstyle; vTop = ftop;
      vTanW = vec3(ftan.x, 0.0, ftan.y);
      vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = rep(sh.fragmentShader, '#include <common>', `
      uniform highp sampler2DArray tWAlb, tWNrm, tWArm;
      uniform float uWScale[18]; uniform float uWTint[18];
      uniform vec4 uSP[15]; uniform vec4 uSP2[15]; uniform float uSP3[15];
      uniform float uNight, uDay, uWindowLit, uShopsOpen, uTime;
      varying vec2 vFuv; varying vec2 vEdge; varying vec3 vTint; varying vec4 vStyle; varying vec3 vTanW; varying float vTop; varying vec3 vWP;
      ${NOISE}
      vec2 fUV; float fLayer; vec4 fArm; float fGlass; float fFrame; vec3 fEmit; float fMetal; float fRough; vec2 fWinN;
      // fake room behind a window: ray from the glass into a box (x: -w/2..w/2, y: 0..h, z: 0..-d)
      vec3 nhRoom(vec2 p, vec3 rd, float w, float h, float d, float seed, float lit) {
        vec3 ro = vec3(p, 0.0);
        float tx = rd.x > 0.0 ? (w * 0.5 - ro.x) / rd.x : (-w * 0.5 - ro.x) / rd.x;
        float ty = rd.y > 0.0 ? (h - ro.y) / rd.y : (0.0 - ro.y) / rd.y;
        float tz = (-d - ro.z) / min(rd.z, -1e-3);
        float t = min(tx, min(ty, tz));
        vec3 hit = ro + rd * t;
        vec3 wallC = mix(vec3(0.72, 0.68, 0.6), vec3(0.62, 0.7, 0.72), step(0.5, fract(seed * 7.3)));
        wallC = mix(wallC, vec3(0.78, 0.7, 0.52), step(0.75, fract(seed * 3.1)));
        vec3 c;
        if (t == tz) c = wallC * 0.95;                                   // back wall
        else if (t == tx) c = wallC * 0.8;                               // side walls
        else if (rd.y > 0.0) c = vec3(0.86) ;                            // ceiling
        else c = vec3(0.42, 0.34, 0.28);                                   // floor
        // furniture blob on the back wall (cupboard / TV / bookshelf)
        if (t == tz && abs(hit.x - (fract(seed * 13.7) - 0.5) * w * 0.5) < w * 0.18 && hit.y < h * 0.62) c *= vec3(0.55, 0.45, 0.38);
        // tube light on the ceiling at night
        float tube = (t == ty && rd.y > 0.0) ? smoothstep(0.08, 0.0, abs(hit.z + d * 0.5)) : 0.0;
        float depthShade = 1.0 - clamp(t / (d * 2.2), 0.0, 0.55);
        vec3 lightC = mix(vec3(1.0, 0.92, 0.78), vec3(0.95, 1.0, 1.05), step(0.4, fract(seed * 5.9)));
        vec3 dayLit = c * depthShade * 0.55;
        vec3 nightLit = c * depthShade * lightC * 0.8 + tube * lightC * 1.4;
        return mix(dayLit * (1.0 - uNight * 0.9), nightLit, lit * uNight);
      }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      int style = int(vStyle.x + 0.5);
      float layer = floor(vStyle.y + 0.5);
      // per-wall constants arrive interpolated and can wobble in the last bits across a triangle;
      // hashing a wobbly value gives per-pixel noise, so snap them back to their exact values first
      float flags = floor(vStyle.z + 0.5); float seed = floor(vStyle.w + 0.5);
      bool shopEdge = mod(flags, 2.0) > 0.5;
      bool blank = mod(floor(flags / 2.0), 2.0) > 0.5;
      bool trim = mod(floor(flags / 4.0), 2.0) > 0.5;
      bool tallGround = mod(floor(flags / 8.0), 2.0) > 0.5;
      float u = vFuv.x, h = vFuv.y;
      float fwU = fwidth(u);                        // metres per pixel (taken outside any branch)
      int li = int(layer);
      float sc = uWScale[li];
      fUV = vec2(u, h) / sc + vec2(seed * 0.37, 0.0);
      fLayer = layer;
      vec4 alb = texture(tWAlb, vec3(fUV, layer));
      fArm = texture(tWArm, vec3(fUV, layer));
      vec3 tint = mix(vec3(1.0), vTint, uWTint[li]);
      vec3 wall = alb.rgb * tint;
      fGlass = 0.0; fFrame = 0.0; fEmit = vec3(0.0); fMetal = 0.0; fRough = fArm.g; fWinN = vec2(0.0);

      vec4 P = uSP[style]; vec4 P2 = uSP2[style]; float shape = uSP3[style];
      float fh = P.x, gh = P.y, ww = P.z, wh = P.w, spacing = P2.x, sill = P2.y;
      float topH = floor(vTop * 100.0 + 0.5) / 100.0;  // building wall height
      float e0 = floor(vEdge.x * 100.0 + 0.5) / 100.0;
      float x = u - e0, L = floor(vEdge.y * 100.0 + 0.5) / 100.0;
      float n = max(1.0, floor(L / spacing + 0.2));
      float cell = L / n;
      float col = clamp(floor(x / cell), 0.0, n - 1.0);
      float xin = x - (col + 0.5) * cell;
      float fl = h < gh ? -1.0 : floor((h - gh) / fh);
      float yin = h < gh ? h : h - gh - fl * fh;
      float nFloors = floor((topH - gh - 0.8) / fh) + 1.0;
      float winSeed = nhHash(vec2(col + seed * 17.0 + e0 * 0.71, fl * 1.37 + seed * 0.13));
      bool upper = fl >= 0.0 && fl < nFloors && h < topH - 0.75;
      // ---- windows on upper floors
      if (!blank && !trim && ww > 0.0 && upper && L > 1.6) {
        float hw = min(ww * 0.5, cell * 0.38);
        float y0 = sill, y1 = sill + wh;
        float inX = hw - abs(xin), inY = min(yin - y0, y1 - yin);
        float archTop = 0.0;
        if (shape > 0.5 && shape < 2.5) {               // arched heads
          float cy = y1 - hw; float r = hw;
          if (yin > cy) { float dd = length(vec2(xin, (yin - cy) * (shape > 1.5 ? 0.75 : 1.0))); inY = min(inY, r - dd); }
        }
        if (shape > 3.5) { hw = cell * 0.47; inX = hw - abs(xin); y0 = 0.15; y1 = fh - 0.1; inY = min(yin - y0, y1 - yin); }
        if (shape > 2.5 && shape < 3.5) { hw = cell * 0.45; inX = hw - abs(xin); }
        float frameW = shape > 3.5 ? 0.05 : 0.07;
        if (inX > 0.0 && inY > 0.0) {
          if (inX < frameW || inY < frameW) {
            fFrame = 1.0;
          } else {
            fGlass = 1.0;
            // mullion in the middle of wide windows
            if (abs(xin) < 0.03 && hw > 0.55) fFrame = 1.0;
          }
        }
        // sill + rain stains under the window
        float under = y0 - yin;
        if (abs(xin) < hw + 0.08 && under > 0.0 && under < 0.09) wall *= 0.8;
        if (abs(xin) < hw * 0.9 && under > 0.09 && under < 1.6) {
          float streak = nhNoise(vec2(xin * 9.0 + col * 3.1, fl));
          wall *= 1.0 - (1.0 - under / 1.6) * 0.28 * streak;
        }
        // iron grills (common on Pune windows)
        if (fGlass > 0.5 && winSeed < P2.w && fwU * 7.0 < 0.25) {
          float gx = abs(fract(xin * 7.0) - 0.5), gy = abs(fract(yin * 3.3) - 0.5);
          if (gx < 0.06 || gy < 0.035) { fFrame = 1.0; fGlass = 0.0; fMetal = 0.6; }
        }
        fWinN = vec2(xin / max(hw, 0.1), (yin - y0) / max(y1 - y0, 0.1));
      }
      // ---- ground floor: shop fronts on street edges, otherwise doors / small windows
      if (!blank && !trim && h < gh - 0.05 && L > 2.0) {
        if (shopEdge) {
          float sw = 3.6;
          float ns = max(1.0, floor(L / sw));
          float sc2 = L / ns;
          float si = floor(x / sc2);
          float sx = x - (si + 0.5) * sc2;
          float shopSeed = nhHash(vec2(si + seed * 31.0, 7.0));
          float open = step(shopSeed, 0.85) * uShopsOpen;
          float ph = gh - 0.85;                      // fascia/sign zone above
          if (abs(sx) < sc2 * 0.5 - 0.18 && h < ph) {
            if (open > 0.5 && fwU > 0.035) {
              vec3 c = vec3(0.5, 0.47, 0.42);
              wall = c * mix(0.32, 0.15, uNight);
              fEmit = c * (0.08 + uNight * 0.42) * (0.75 + 0.25 * shopSeed);
              fRough = 0.85;
            } else if (open > 0.5) {
              // open shop: a real little room behind the opening (interior mapping) with shelves of goods
              vec3 tW = normalize(vTanW);
              vec3 nW = normalize(cross(tW, vec3(0.0, 1.0, 0.0)));
              vec3 rd = normalize(vWP - cameraPosition);
              vec3 rl = vec3(dot(rd, tW), rd.y, dot(rd, nW));
              if (rl.z > 0.0) rl.z = -rl.z;
              float rw = sc2 - 0.36, rh = ph, rdp = 3.2 + shopSeed * 2.0;
              vec3 ro = vec3(sx, h, 0.0);
              float tx = rl.x > 0.0 ? (rw * 0.5 - ro.x) / rl.x : (-rw * 0.5 - ro.x) / rl.x;
              float ty = rl.y > 0.0 ? (rh - ro.y) / rl.y : (0.0 - ro.y) / rl.y;
              float tz = (-rdp - ro.z) / min(rl.z, -1e-3);
              float t = min(tx, min(ty, tz));
              vec3 hit = ro + rl * t;
              vec3 c;
              float along = t == tz ? hit.x : hit.z;
              if (t == tz || t == tx) {
                // shelves of goods; blocks are ~35 x 40 cm and fade to their average when they get
                // smaller than a couple of pixels (no shimmering)
                float row = hit.y / 0.42, shelfY = fract(row);
                vec2 q = vec2(along / 0.36, row);
                vec2 cid = floor(q);
                vec3 prod = 0.22 + 0.5 * vec3(nhHash(cid + shopSeed * 13.0), nhHash(cid + 2.7 + shopSeed), nhHash(cid + 5.1));
                prod = mix(prod, vec3(dot(prod, vec3(0.333))), 0.35 + 0.4 * step(0.6, shopSeed));
                float item = step(0.1, fract(q.x)) * step(0.1, shelfY) * step(shelfY, 0.84 - 0.25 * nhHash(cid + 9.0)) * step(0.15, nhHash(cid + 4.4));
                vec3 wallC = mix(vec3(0.72, 0.7, 0.66), vec3(0.62, 0.7, 0.74), step(0.5, fract(shopSeed * 7.7)));
                vec3 detail = mix(mix(wallC * 0.8, prod, item), vec3(0.62, 0.6, 0.56), step(0.88, shelfY));
                float fw = max(fwidth(q.x), fwidth(q.y));
                c = mix(detail, mix(wallC * 0.8, vec3(0.45, 0.42, 0.38), 0.6), smoothstep(0.25, 0.7, fw));
                if (hit.y > rh - 0.6 || hit.y < 0.2) c = wallC;
              } else if (rl.y > 0.0) {
                c = vec3(0.7) + smoothstep(0.05, 0.0, abs(fract(hit.z * 0.5) - 0.5)) * 1.1 * step(abs(hit.x), rw * 0.3);   // ceiling + tube lights
              } else {
                vec2 tile = floor(vec2(hit.x, hit.z) / 0.6);
                c = vec3(0.5, 0.47, 0.43) * (0.9 + 0.1 * mod(tile.x + tile.y, 2.0));
              }
              // counter across the front half metre
              if (t == ty && rl.y < 0.0 && hit.z > -1.2 && abs(hit.x) < rw * 0.35) c = vec3(0.45, 0.32, 0.22);
              float shade = 1.0 - clamp(-hit.z / (rdp * 2.0), 0.0, 0.45);
              c *= shade;
              // far away the room collapses to its average colour (no sparkle)
              c = mix(c, vec3(0.5, 0.47, 0.42), smoothstep(0.012, 0.035, fwidth(x)));
              wall = c * mix(0.32, 0.15, uNight);
              fEmit = c * (0.08 + uNight * 0.42) * (0.75 + 0.25 * shopSeed);
              fRough = 0.85;
              // rolled-up shutter box at the top of the opening
              if (h > ph - 0.28) { wall = vec3(0.42, 0.44, 0.45); fEmit = vec3(0.0); fMetal = 0.5; fRough = 0.5; }
            } else {
              // rolling shutter (painted or rusty)
              float sl = shopSeed > 0.92 ? 12.0 : 11.0;
              vec2 suv = vec2(sx, h) / 2.4;
              vec4 sa = texture(tWAlb, vec3(suv, sl));
              vec3 shutterC = mix(vec3(0.55, 0.6, 0.62), vec3(0.32, 0.45, 0.55), step(0.5, fract(shopSeed * 9.1)));
              wall = sa.rgb * (sl > 11.5 ? vec3(1.0) : shutterC * 1.2);
              fUV = suv; fLayer = sl; fMetal = 0.5; fRough = 0.55;
            }
          } else if (h > ph - 0.05 && h < gh - 0.1) {
            wall *= 0.92;     // fascia band (sign boards are geometry)
          }
        } else if (style != 7 && style != 11) {
          // residential ground floor: one door per edge + small windows
          float door = abs(x - L * 0.5);
          if (door < 0.55 && h < 2.15 && h > 0.15) { wall = vec3(0.32, 0.22, 0.14) * (0.85 + 0.3 * nhNoise(vec2(x * 4.0, h))); fRough = 0.7; }
          else if (L > 4.0 && abs(xin) < 0.55 && h > 1.0 && h < 2.1 && abs(x - L * 0.5) > 1.2) fGlass = 1.0;
        }
      }
      // ---- weathering: monsoon streaks from the top, splash at the plinth, corner grime
      float streaks = nhNoise(vec2(u * 2.3, h * 0.12 + seed * 5.0)) * smoothstep(topH - 4.0, topH, h + 2.0 * nhNoise(vec2(u * 0.7, 3.0)));
      wall *= 1.0 - streaks * 0.22;
      wall *= mix(0.72, 1.0, smoothstep(0.1, 0.9, h));
      float edgeD = min(x, L - x);
      wall *= mix(0.86, 1.0, smoothstep(0.0, 0.35, edgeD));
      wall *= mix(0.92, 1.06, nhFbm(vec2(u * 0.12, h * 0.1) + seed));
      vec3 fcol = wall;
      vec3 frameC = vec3(0.85, 0.85, 0.82);
      float fi = P2.z;
      if (fi > 0.5 && fi < 1.5) frameC = vec3(0.6, 0.62, 0.64);       // aluminium
      if (fi > 1.5 && fi < 2.5) frameC = vec3(0.24, 0.16, 0.1);       // wood
      if (fi > 2.5) frameC = vec3(0.12, 0.13, 0.14);                  // dark mullions
      if (fFrame > 0.5) { fcol = frameC * (fMetal > 0.5 ? 0.45 : 1.0); fRough = 0.5; }
      if (fGlass > 0.5) {
        // dark glass: interior + sky reflection (specular from env map handles the reflection)
        vec3 tW = normalize(vTanW);
        vec3 nW = normalize(cross(tW, vec3(0.0, 1.0, 0.0)));
        vec3 rd = normalize(vWP - cameraPosition);
        vec3 rl = vec3(dot(rd, tW), rd.y, dot(rd, nW));
        if (rl.z > 0.0) rl.z = -rl.z;
        float lit = step(1.0 - uWindowLit, winSeed);
        float roomW = shape > 3.5 ? cell : max(ww, 1.0) * 1.8;
        vec3 farRoom = vec3(0.07) * (1.0 - uNight) + vec3(0.9, 0.74, 0.52) * lit * uNight * 0.75;
        vec3 room = farRoom;
        if (fwU < 0.05) {     // far away the room would be averaged out anyway: skip the ray march
          room = nhRoom(vec2(fWinN.x * roomW * 0.4, (fWinN.y) * (fh - 0.3)), rl, roomW, fh - 0.3, 3.5, winSeed, lit);
          // curtains in half the windows
          float curtain = step(0.45, fract(winSeed * 11.0)) * smoothstep(0.15, 0.1, abs(abs(fWinN.x) - 0.75));
          vec3 curtainC = mix(vec3(0.75, 0.6, 0.45), vec3(0.55, 0.25, 0.25), step(0.5, fract(winSeed * 23.0)));
          room = mix(room, curtainC * (0.4 + lit * uNight * 0.8), curtain * 0.85);
          room = mix(room, farRoom, smoothstep(0.02, 0.05, fwU));
        }
        fcol = room * (shape > 3.5 ? 0.6 : 1.0);
        fEmit += room * lit * uNight * 0.5;
        fRough = 0.06; fMetal = 0.0;
      }
      diffuseColor.rgb *= fcol;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(fRough, 0.04, 1.0);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', 'float metalnessFactor = fMetal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      if (fGlass < 0.5 && fFrame < 0.5) {
        vec3 mapN = texture(tWNrm, vec3(fUV, fLayer)).xyz * 2.0 - 1.0;
        mat3 tbn = nhTangentFrame(-vViewPosition, normal, fUV);
        normal = normalize(tbn * mapN);
      }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += fEmit;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `
      float ambientOcclusion = mix(1.0, fArm.r, 0.7 * (1.0 - fGlass));
      reflectedLight.indirectDiffuse *= ambientOcclusion;`);
  });
}

// ---------------------------------------------------------------- roofs (flat concrete / bitumen, clay tiles)
export function roofMaterial(T) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  return patch(m, 'nh-roof', (sh) => {
    Object.assign(sh.uniforms, { tWAlb: { value: T.wallAlb }, tWNrm: { value: T.wallNrm }, tWArm: { value: T.wallArm }, uWScale: { value: WALL_SCALE } });
    sh.vertexShader = rep(sh.vertexShader, '#include <common>', `attribute vec2 ruv; attribute float rlayer; attribute vec3 rtint;
      varying vec2 vRuv; varying float vRL; varying vec3 vRT; varying vec3 vWP;`);
    sh.vertexShader = rep(sh.vertexShader, '#include <project_vertex>', 'vRuv = ruv; vRL = rlayer; vRT = rtint; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = rep(sh.fragmentShader, '#include <common>', `uniform highp sampler2DArray tWAlb, tWNrm, tWArm; uniform float uWScale[18];
      varying vec2 vRuv; varying float vRL; varying vec3 vRT; varying vec3 vWP; ${NOISE} vec2 rUV; vec4 rArm;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `
      float L = floor(vRL + 0.5);
      rUV = vRuv / uWScale[int(L)];
      vec4 a = texture(tWAlb, vec3(rUV, L));
      rArm = texture(tWArm, vec3(rUV, L));
      vec3 c = a.rgb * vRT;
      c *= mix(0.75, 1.08, nhFbm(vWP.xz * 0.15));          // water stains, moss patches
      c = mix(c, c * vec3(0.7, 0.75, 0.6), smoothstep(0.6, 0.8, nhNoise(vWP.xz * 0.08)) * step(L, 14.5));
      diffuseColor.rgb *= c;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(rArm.g, 0.4, 1.0);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      { vec3 mapN = texture(tWNrm, vec3(rUV, floor(vRL + 0.5))).xyz * 2.0 - 1.0;
        normal = normalize(nhTangentFrame(-vViewPosition, normal, rUV) * mapN); }`);
  });
}
