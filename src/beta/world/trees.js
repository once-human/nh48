// /beta's trees: the game's species, grown as it grows them (rain tree, gulmohar, peepal, neem...), with their real
// branches and leaves, and its trunks in the collision. Drawn through painted shaders of their own: leaves dabbed on in
// light and shade with the light falling across each crown, bark in pencil, a breeze. Past the mid range, one cheap
// painted crown per tree instead of the game's pictures of trees.
import * as THREE from 'three';
import { TreeField as GameTrees } from '@orig/world/trees.js';
import { U } from '@orig/gfx/materials.js';
import { PU } from '../gfx/paint.js';

const CHUNK = `precision highp float; precision highp sampler2DShadow;
varying vec3 vN, vW, vC; varying vec2 vU; varying float vZ, vH;
uniform sampler2D tMap, tNoise; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; uniform vec3 sunDir, sunCol, shadeCol, fogCol, uTint; uniform float shadowTexel, shadowOn, fogDensity, dayK;
float nz(vec2 p){ return texture2D(tNoise, p/16.).r; }
float shadowAt(vec3 w, vec3 n){ vec4 s = shadowMat*vec4(w + n*(.15 + .003*vZ), 1.); if (s.x < 0. || s.x > 1. || s.y < 0. || s.y > 1. || s.z > 1.) return 1.;
  float z = s.z - .0009; return .5*(texture(shadowTex, vec3(s.xy + vec2(-.8, .4)*shadowTexel, z)) + texture(shadowTex, vec3(s.xy + vec2(.8, -.4)*shadowTexel, z))); }
`;
const VS = `uniform float uTime, uWind; varying vec3 vN, vW, vC; varying vec2 vU; varying float vZ, vH;
void main(){ mat4 M = modelMatrix*instanceMatrix; vec3 p = position; vec3 o = (M*vec4(0., 0., 0., 1.)).xyz; float ph = o.x*.31 + o.z*.23, sw = (sin(uTime*1.1 + ph + p.y*.4) + .5*sin(uTime*2.3 + ph*1.7 + p.x))*uWind*.012*p.y*(LEAFY);
  p.x += sw; p.z += sw*.6; vec4 w = M*vec4(p, 1.); vW = w.xyz; vN = mat3(M)*normal; vC = COL; vU = uv; vH = position.y; vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const LEAF_FS = CHUNK + `void main(){
  vec4 t = texture2D(tMap, vU); if (t.a < .45) discard;
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  vec3 b = t.rgb*vC*1.15;
  float e = nz(vW.xz*.9 + vW.y*.7) - .5, ndl = dot(n, sunDir), lit = smoothstep(-.05, .22, ndl + e*.5);
  float sh = (shadowOn > .5 && lit > 0.) ? smoothstep(.25, .7, shadowAt(vW, n) + e*.35) : 1., L = lit*sh*dayK;
  // dabs of paint: a dark hollow under the crown, warm top, each clump a little its own colour
  b *= .78 + .5*nz(vW.xz*.23 + vW.y*.17);
  vec3 c = mix(b*shadeCol*vec3(.7, .85, .8)*(.75 + .25*smoothstep(0., 8., vH)) + vec3(.008, .016, .01)*dayK, b*sunCol*vec3(1.1, 1.04, .84), L);
  float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;
const BARK_FS = CHUNK + `void main(){
  vec3 n = normalize(vN), b = texture2D(tMap, vU*vec2(1., 1.)).rgb*uTint*1.25; float e = nz(gl_FragCoord.xy*.1) - .5, ndl = dot(n, sunDir), lit = smoothstep(.0, .14, ndl + e*.14);
  float sh = (shadowOn > .5 && lit > 0.) ? smoothstep(.3, .7, shadowAt(vW, n) + e*.3) : 1., L = lit*sh*dayK;
  b *= .84 + .32*nz(vec2(vU.x*18., vU.y*2.));          // long furrows
  vec3 c = mix(b*shadeCol + vec3(.015)*dayK, b*sunCol, L);
  float h = smoothstep(.5, .72, fract((gl_FragCoord.x + gl_FragCoord.y)*.17 + e*.9))*(1. - L)*(1. - smoothstep(12., 45., vZ)); c = mix(c, c*.68, h*.65);
  float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;
const LEAF_SHADOW_VS = `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position, 1.); }`;
const LEAF_SHADOW_FS = `varying vec2 vU; uniform sampler2D tMap; void main(){ if (texture2D(tMap, vU).a < .45) discard; }`;
const FAR_VS = `attribute vec4 iPos; attribute vec3 iTint; varying vec3 vN, vC; varying float vZ;
void main(){ float a = fract(iPos.x*.37 + iPos.z*.71)*6.283, c = cos(a), s = sin(a); vec3 p = position*iPos.w; p = vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
  vN = vec3(c*normal.x + s*normal.z, normal.y, -s*normal.x + c*normal.z); vC = color.g > color.r ? color*iTint : color; vec4 v = viewMatrix*vec4(p + iPos.xyz, 1.); vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const FAR_FS = `precision highp float; varying vec3 vN, vC; varying float vZ; uniform vec3 sunDir, sunCol, shadeCol, fogCol; uniform float fogDensity, dayK;
void main(){ float n = dot(normalize(vN), sunDir); vec3 c = mix(vC*shadeCol*.8, vC*sunCol, smoothstep(.02, .38, n)*dayK); float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;

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
    const un = (extra) => Object.assign({}, PU, { uTime: U.uTime, uWind: U.uWind, tNoise: PU.tNoise }, extra);
    this.paintLeaf = new THREE.ShaderMaterial({ vertexShader: VS.replace('LEAFY', '1.').replace('COL', 'color'), fragmentShader: LEAF_FS, uniforms: un({ tMap: { value: this.leafMat.map } }), vertexColors: true, side: THREE.DoubleSide });
    this.leafShadow = new THREE.ShaderMaterial({ vertexShader: LEAF_SHADOW_VS, fragmentShader: LEAF_SHADOW_FS, uniforms: { tMap: this.paintLeaf.uniforms.tMap }, side: THREE.DoubleSide, colorWrite: false });
    this.arch.forEach((A, k) => {
      const S = this.sets[k], m = this.barkMats[k];
      const bark = new THREE.ShaderMaterial({ vertexShader: VS.replace('LEAFY', '.25').replace('COL', 'vec3(1.)'), fragmentShader: BARK_FS, uniforms: un({ tMap: { value: m.map }, uTint: { value: m.color.clone() } }) });
      S.nb.material = S.mb.material = bark; S.nl.material = S.ml.material = this.paintLeaf;
      S.nl.customDepthMaterial = S.ml.customDepthMaterial = this.leafShadow;
      for (const m of [S.nb, S.nl, S.mb, S.ml]) m.shadowStill = true;
    });
    this.bb.visible = false;
    const G = farCrown(), cap = 4000;
    G.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(cap*4), 4).setUsage(THREE.DynamicDrawUsage)); G.setAttribute('iTint', new THREE.InstancedBufferAttribute(new Float32Array(cap*3), 3).setUsage(THREE.DynamicDrawUsage)); G.instanceCount = 0;
    this.farMesh = new THREE.Mesh(G, new THREE.ShaderMaterial({ vertexShader: FAR_VS, fragmentShader: FAR_FS, uniforms: PU, vertexColors: true })); this.farMesh.frustumCulled = false; this.farMesh.cap = cap; scene.add(this.farMesh);
    this.R = 700; this.fx = 1e9; this.fz = 1e9;
  }
  sharpenLeaves() { super.sharpenLeaves(); this.paintLeaf.uniforms.tMap.value = this.leafMat.map; }
  update(cx, cz, force = false) {
    if (this.lastX === 1e9) this.fx = 1e9;
    this.farR = 0;                                        // (the game's far pictures: never filled)
    super.update(cx, cz, force);
    if (!force && Math.hypot(cx - this.fx, cz - this.fz) < 30) return;
    this.fx = cx; this.fz = cz;
    const c = this.cell, r = Math.ceil(this.R/c), gx = Math.floor(cx/c), gz = Math.floor(cz/c), M = this.farMesh, A = M.geometry.attributes.iPos, T = M.geometry.attributes.iTint, m0 = this.midR - 20, R = this.R; let n = 0;
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
