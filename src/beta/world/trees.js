// /beta's trees: the game's species, grown as it grows them (rain tree, gulmohar, peepal, neem...), with their real
// branches and leaves, and its trunks in the collision. Drawn through painted shaders of their own: leaves dabbed on in
// light and shade with the light falling across each crown, bark in pencil, a breeze. Past the mid range, one cheap
// painted crown per tree instead of the game's pictures of trees.
import * as THREE from 'three';
import { TreeField as GameTrees } from '@orig/world/trees.js';
import { U } from '@orig/gfx/materials.js';
import { hash1 } from '@orig/core/util.js';
import { PU, LAMP, PCF, DITHER } from '../gfx/paint.js';

// near trees hand over to the mid ones, and the mid ones to the far crowns, over a band of distance (from the camera,
// per tree), pixel by pixel: the one going keeps the pixels above the fade, the one coming those below (DITHER), so
// nothing pops, doubles or leaves a gap. uLodF: the near edge and its band, the mid edge and its band
const LODF = `uniform vec4 uLodF; varying float vFd;
${DITHER}
float lodK(float e, float b){ return clamp((vFd - e + b)/b, 0., 1.); }
#if defined(LOD_NEAR)
#define LOD_OUT if (ditherH() < lodK(uLodF.x, uLodF.y)) discard;
#elif defined(LOD_MID)
#define LOD_OUT { float h = ditherH(); if (h >= lodK(uLodF.x, uLodF.y) || h < lodK(uLodF.z, uLodF.w)) discard; }
#elif defined(LOD_FAR)
#define LOD_OUT if (ditherH() >= lodK(uLodF.z, uLodF.w)) discard;
#else
#define LOD_OUT
#endif`;
const CHUNK = `precision highp float; precision highp sampler2DShadow;
varying vec3 vN, vW, vC; varying vec2 vU; varying float vZ, vH;
uniform sampler2D tMap, tNoise; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform vec3 sunDir, sunCol, shadeCol, fogCol, uTint; uniform float shadowTexel, shadowOn, fogDensity, dayK;
${LAMP}
float nz(vec2 p){ return texture2D(tNoise, p/16.).r; }
${PCF}
${LODF}
float shadowAt(vec3 w, vec3 n){ vec4 s = shadowMat*vec4(w + n*(.15 + .003*vZ), 1.); if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  return shadowPCF(vec3(s.xy, s.z - .0009)); }
`;
const VS = `uniform float uTime, uWind; varying vec3 vN, vW, vC; varying vec2 vU; varying float vZ, vH, vFd;
void main(){ mat4 M = modelMatrix*instanceMatrix; vec3 p = position; vec3 o = (M*vec4(0., 0., 0., 1.)).xyz; vFd = length(o.xz - cameraPosition.xz); float ph = o.x*.31 + o.z*.23, sw = (sin(uTime*1.1 + ph + p.y*.4) + .5*sin(uTime*2.3 + ph*1.7 + p.x))*uWind*.012*p.y*(LEAFY);
  p.x += sw; p.z += sw*.6; vec4 w = M*vec4(p, 1.); vW = w.xyz; vN = mat3(M)*normal; vC = COL; vU = uv; vH = position.y; vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const LEAF_FS = CHUNK + `void main(){
  LOD_OUT
  vec4 t = texture2D(tMap, vU); if (t.a < .45) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 b = t.rgb*vC*1.15;
  float e = nz(vW.xz*.9 + vW.y*.7) - .5, ndl = dot(n, sunDir), lit = mix(smoothstep(-.05, .22, ndl + e*.5), smoothstep(-.35, .75, ndl + e*.25), uReal);
  float sh = (shadowOn > .5 && lit > 0.) ? mix(smoothstep(.25, .7, shadowAt(vW, n) + e*.35), shadowAt(vW, n), uReal) : 1., L = lit*sh*dayK;
  // dabs of paint: a dark hollow under the crown, warm top, each clump a little its own colour
  b *= .78 + .5*nz(vW.xz*.23 + vW.y*.17);
  vec3 c = mix(b*shadeCol*vec3(.7, .85, .8)*(.75 + .25*smoothstep(0., 8., vH)) + vec3(.008, .016, .01)*dayK, b*sunCol*vec3(1.1, 1.04, .84), L) + b*lampAt(vW, n)*.8;
  float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;
const BARK_FS = CHUNK + `void main(){
  LOD_OUT
  vec3 n = normalize(vN), b = texture2D(tMap, vU*vec2(1., 1.)).rgb*uTint*1.25; float e = (nz(gl_FragCoord.xy*.1) - .5)*(1. - uReal), ndl = dot(n, sunDir), lit = sunOn(ndl, e*.14, .0, .14);
  float sh = (shadowOn > .5 && lit > 0.) ? shadeOf(shadowAt(vW, n), e*.3) : 1., L = lit*sh*dayK;
  b *= .84 + .32*nz(vec2(vU.x*18., vU.y*2.));          // long furrows
  vec3 c = mix(b*shadeCol + vec3(.015)*dayK, b*sunCol, L) + b*lampAt(vW, n);
  float h = smoothstep(.5, .72, fract((gl_FragCoord.x + gl_FragCoord.y)*.17 + e*.9))*(1. - L)*(1. - smoothstep(12., 45., vZ)); c = mix(c, c*.68, h*.65*(1. - uReal));
  float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;
const LEAF_SHADOW_VS = `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position, 1.); }`;
const LEAF_SHADOW_FS = `varying vec2 vU; uniform sampler2D tMap; void main(){ if (texture2D(tMap, vU).a < .45) discard; }`;
const FAR_VS = `attribute vec4 iPos; attribute vec3 iTint; varying vec3 vN, vC; varying float vZ, vFd;
void main(){ vFd = length(iPos.xz - cameraPosition.xz); float a = fract(iPos.x*.37 + iPos.z*.71)*6.283, c = cos(a), s = sin(a); vec3 p = position*iPos.w; p = vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
  vN = vec3(c*normal.x + s*normal.z, normal.y, -s*normal.x + c*normal.z); vC = color.g > color.r ? color*iTint : color; vec4 v = viewMatrix*vec4(p + iPos.xyz, 1.); vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const FAR_FS = `precision highp float; varying vec3 vN, vC; varying float vZ; uniform vec3 sunDir, sunCol, shadeCol, fogCol; uniform float fogDensity, dayK;
${LODF}
void main(){ LOD_OUT float n = dot(normalize(vN), sunDir); vec3 c = mix(vC*shadeCol*.8, vC*sunCol, smoothstep(.02, .38, n)*dayK); float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;

function farCrown() {
  const parts = [[new THREE.CylinderGeometry(.09, .16, 2.8, 4), .21, .14, .09, new THREE.Matrix4().makeTranslation(0, 1.4, 0)],
    [new THREE.IcosahedronGeometry(1, 1), .17, .31, .1, new THREE.Matrix4().compose(new THREE.Vector3(0, 4, 0), new THREE.Quaternion(), new THREE.Vector3(2.4, 1.9, 2.4))]];
  const P = [], N = [], C = [];
  for (const [g0, r, gg, b, m] of parts) { const g = g0.index ? g0.toNonIndexed() : g0; g.applyMatrix4(m); g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(r, gg, b); } }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return g;
}
const TINT = [[1, 1.05, .9], [.82, 1.1, .85], [1.2, 1.05, .7], [.9, .9, 1], [1.1, 1.2, .8], [.72, .95, .75], [1, 1, 1], [.9, 1.1, .9]];

export class TreeField extends GameTrees {
  constructor(W, scene, renderer, quality, tex) {
    super(W, scene, renderer, quality, tex);
    this.uLodF = { value: new THREE.Vector4(20, 6, 100, 18) };
    const un = (extra) => Object.assign({}, PU, { uTime: U.uTime, uWind: U.uWind, tNoise: PU.tNoise, uLodF: this.uLodF }, extra);
    const NEAR = { LOD_NEAR: '' }, MID = { LOD_MID: '' };
    this.paintLeaf = new THREE.ShaderMaterial({ vertexShader: VS.replace('LEAFY', '1.').replace('COL', 'color'), fragmentShader: LEAF_FS, uniforms: un({ tMap: { value: this.leafMat.map } }), defines: NEAR, vertexColors: true, side: THREE.DoubleSide });
    const leafMid = new THREE.ShaderMaterial({ vertexShader: this.paintLeaf.vertexShader, fragmentShader: LEAF_FS, uniforms: un({ tMap: this.paintLeaf.uniforms.tMap }), defines: MID, vertexColors: true, side: THREE.DoubleSide });
    this.leafShadow = new THREE.ShaderMaterial({ vertexShader: LEAF_SHADOW_VS, fragmentShader: LEAF_SHADOW_FS, uniforms: { tMap: this.paintLeaf.uniforms.tMap }, side: THREE.DoubleSide, colorWrite: false });
    this.arch.forEach((A, k) => {
      const S = this.sets[k], m = this.barkMats[k];
      const bv = VS.replace('LEAFY', '.25').replace('COL', 'vec3(1.)'), bu = un({ tMap: { value: m.map }, uTint: { value: m.color.clone() } });
      S.nb.material = new THREE.ShaderMaterial({ vertexShader: bv, fragmentShader: BARK_FS, uniforms: bu, defines: NEAR });
      S.mb.material = new THREE.ShaderMaterial({ vertexShader: bv, fragmentShader: BARK_FS, uniforms: Object.assign({}, bu), defines: MID });
      S.nl.material = this.paintLeaf; S.ml.material = leafMid;
      S.nl.customDepthMaterial = S.ml.customDepthMaterial = this.leafShadow;
      for (const m of [S.nb, S.nl, S.mb, S.ml]) m.shadowStill = true;
    });
    this.bb.visible = false;
    const G = farCrown(), cap = 4000;
    G.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(cap*4), 4).setUsage(THREE.DynamicDrawUsage)); G.setAttribute('iTint', new THREE.InstancedBufferAttribute(new Float32Array(cap*3), 3).setUsage(THREE.DynamicDrawUsage)); G.instanceCount = 0;
    this.farMesh = new THREE.Mesh(G, new THREE.ShaderMaterial({ vertexShader: FAR_VS, fragmentShader: FAR_FS, uniforms: Object.assign({}, PU, { uLodF: this.uLodF }), defines: { LOD_FAR: '' }, vertexColors: true })); this.farMesh.frustumCulled = false; this.farMesh.cap = cap; scene.add(this.farMesh);
    // (two kinds of tree only: the full one close, the lighter real one out to the distance; the blob crowns are off)
    this.R = 0; this.farMesh.visible = false; this.fx = 1e9; this.fz = 1e9;
  }
  // near and mid sets, refilled every 3 m: each tree in the one its distance says, and in both through the band where
  // one fades into the other (with a little over the 3 m either way, so the shader always has what it needs)
  nearMid(cx, cz, force, Bn) {
    if (!force && Math.hypot(cx - this.lastX, cz - this.lastZ) < 3) return;
    this.lastX = cx; this.lastZ = cz;
    const { nearR, midR, cell } = this, M = 4, nOut = nearR + M, mIn = Math.max(0, nearR - Bn - M), mOut = midR + M;
    const cnt = this.sets.map(() => [0, 0]), m = this.m4, Q = this.q4, V = this.v3, S = this.s3, E = this.e3;
    const i0 = Math.floor((cx - mOut)/cell), i1 = Math.floor((cx + mOut)/cell), j0 = Math.floor((cz - mOut)/cell), j1 = Math.floor((cz + mOut)/cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.grid.get(i + ',' + j); if (!l) continue;
      for (const t of l) {
        const d = Math.hypot(this.x[t] - cx, this.z[t] - cz); if (d >= mOut) continue;
        const k = this.k[t], s = this.s[t], set = this.sets[k], c = cnt[k];
        E.set(0, this.r[t], 0); Q.setFromEuler(E);
        const sx = s*(0.92 + hash1(t*3.3)*0.16), sy = s*(0.9 + hash1(t*5.1)*0.2);
        m.compose(V.set(this.x[t], 0.12 + this.y[t], this.z[t]), Q, S.set(sx, sy, sx));
        if (d < nOut && c[0] < set.nb.instanceMatrix.count) { m.toArray(set.nb.instanceMatrix.array, c[0]*16); m.toArray(set.nl.instanceMatrix.array, c[0]*16); c[0]++; }
        if (d > mIn && c[1] < set.mb.instanceMatrix.count) { m.toArray(set.mb.instanceMatrix.array, c[1]*16); m.toArray(set.ml.instanceMatrix.array, c[1]*16); c[1]++; }
      }
    }
    this.sets.forEach((set, k) => {
      set.nb.count = set.nl.count = cnt[k][0]; set.mb.count = set.ml.count = cnt[k][1];
      for (const mm of [set.nb, set.nl, set.mb, set.ml]) mm.instanceMatrix.needsUpdate = true;
    });
  }
  sharpenLeaves() { super.sharpenLeaves(); this.paintLeaf.uniforms.tMap.value = this.leafMat.map; }
  update(cx, cz, force = false) {
    if (this.lastX === 1e9) this.fx = 1e9;
    this.farR = 0;                                        // (the game's far pictures: never filled)
    const Bn = Math.min(8, Math.max(3, this.nearR*0.3)), Bm = Math.min(24, Math.max(8, this.midR*0.12));
    this.uLodF.value.set(this.nearR, Bn, this.midR, Bm);
    this.nearMid(cx, cz, force, Bn);
    if (!this.R) return;
    if (!force && Math.hypot(cx - this.fx, cz - this.fz) < 30) return;
    this.fx = cx; this.fz = cz;
    const c = this.cell, r = Math.ceil(this.R/c), gx = Math.floor(cx/c), gz = Math.floor(cz/c), M = this.farMesh, A = M.geometry.attributes.iPos, T = M.geometry.attributes.iTint, m0 = this.midR - Bm - 32, R = this.R; let n = 0;
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const l = this.grid.get((gx + i) + ',' + (gz + j)); if (!l) continue;
      for (const t of l) {
        const d = Math.hypot(this.x[t] - cx, this.z[t] - cz); if (d > R || d < m0 || n >= M.cap) continue;
        const K = TINT[this.k[t]%TINT.length], ar = this.arch[this.k[t]];
        A.array[n*4] = this.x[t]; A.array[n*4 + 1] = this.y[t] || 0; A.array[n*4 + 2] = this.z[t]; A.array[n*4 + 3] = this.s[t]*(ar.H || 10)/6;
        T.array[n*3] = K[0]; T.array[n*3 + 1] = K[1]; T.array[n*3 + 2] = K[2]; n++;
      }
    }
    M.geometry.instanceCount = n; A.needsUpdate = T.needsUpdate = true;
  }
}
