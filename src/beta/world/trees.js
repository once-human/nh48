// /beta's trees: the game's TreeField keeps its data and its trunks in the collision (logic), and never draws. What's
// drawn is this: one instanced painted tree, a detailed one close by and a cheap one further out, one draw each.
import * as THREE from 'three';
import { TreeField as GameTrees } from '@orig/world/trees.js';
import { PU } from '../gfx/paint.js';

const VS = `in vec3 position, normal, color; in vec4 iPos; in vec3 iTint; uniform mat4 viewMatrix, projectionMatrix; out vec3 vN, vC; out float vZ;
void main(){ float a = fract(iPos.x*.37 + iPos.z*.71)*6.283, c = cos(a), s = sin(a); vec3 p = position*iPos.w; p = vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
  vN = vec3(c*normal.x + s*normal.z, normal.y, -s*normal.x + c*normal.z); vC = color.g > color.r ? color*iTint : color;
  vec4 v = viewMatrix*vec4(p + iPos.xyz, 1.); vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const FS = `precision highp float; in vec3 vN, vC; in float vZ; out vec4 o; uniform vec3 sunDir, sunCol, shadeCol, fogCol; uniform float fogDensity;
void main(){ float n = dot(normalize(vN), sunDir); vec3 c = vC*(shadeCol*.8 + sunCol*smoothstep(.02, .38, n)*.85); float f = fogDensity*vZ; o = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;

function part(g, col, m) {
  g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(m); g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count*3);
  for (let i = 0; i < p.count; i++) { const k = col === 'leaf' ? .75 + .25*Math.sin(p.getY(i)*2.1 + p.getX(i)*3.3) : 1; if (col === 'leaf') { c[i*3] = .16*k; c[i*3 + 1] = .3*k; c[i*3 + 2] = .09*k; } else { c[i*3] = .21; c[i*3 + 1] = .14; c[i*3 + 2] = .09; } }
  return { p: p.array, n: n.array, c };
}
function merge(parts) {
  const len = parts.reduce((a, q) => a + q.p.length, 0), P = new Float32Array(len), N = new Float32Array(len), C = new Float32Array(len); let o = 0;
  for (const q of parts) { P.set(q.p, o); N.set(q.n, o); C.set(q.c, o); o += q.p.length; }
  const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return g;
}
const at = (x, y, z, sx, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
const nearTree = () => merge([part(new THREE.CylinderGeometry(.09, .17, 3.4, 6), 'trunk', at(0, 1.7, 0, 1)),
  ...[[0, 4.3, 0, 1.9], [1.1, 3.7, .3, 1.25], [-1, 3.8, -.5, 1.35], [.2, 3.6, 1.1, 1.15], [-.3, 5.3, -.2, 1.2]].map(([x, y, z, s]) => part(new THREE.IcosahedronGeometry(1, 1), 'leaf', at(x, y, z, s, s*.82, s)))]);
const farTree = () => merge([part(new THREE.CylinderGeometry(.1, .17, 3, 3), 'trunk', at(0, 1.5, 0, 1)), part(new THREE.IcosahedronGeometry(1, 0), 'leaf', at(0, 4.2, 0, 2.3, 2, 2.3))]);

function field(geo, cap, scene) {
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(cap*4), 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('iTint', new THREE.InstancedBufferAttribute(new Float32Array(cap*3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.instanceCount = 0;
  const mat = new THREE.RawShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: PU, glslVersion: THREE.GLSL3 });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.cap = cap; scene.add(m); return m;
}
const TINT = [[1, 1.05, .9], [.82, 1.1, .85], [1.2, 1.05, .7], [.9, .9, 1], [1.1, 1.2, .8], [.72, .95, .75]];

export class TreeField extends GameTrees {
  constructor(W, scene, renderer, quality, tex) {
    const n0 = scene.children.length;
    super(W, scene, renderer, quality, tex);
    for (let i = n0; i < scene.children.length; i++) scene.children[i].visible = false;     // the game's own trees: data only
    this.near = field(nearTree(), 500, scene); this.far = field(farTree(), 3000, scene);
    this.R = Math.min(quality.treeFarRange || 600, 520); this.nearD = 85;
    this.drawX = 1e9; this.drawZ = 1e9;
  }
  sharpenLeaves() {}
  update(cx, cz, force = false) {
    if (this.lastX === 1e9) force = true;
    if (!force && Math.hypot(cx - this.drawX, cz - this.drawZ) < 8) return;
    this.lastX = this.drawX = cx; this.lastZ = this.drawZ = cz;
    const c = this.cell, r = Math.ceil(this.R/c), gx = Math.floor(cx/c), gz = Math.floor(cz/c), N = this.near, F = this.far;
    const nP = N.geometry.attributes.iPos, nT = N.geometry.attributes.iTint, fP = F.geometry.attributes.iPos, fT = F.geometry.attributes.iTint;
    let a = 0, b = 0;
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const l = this.grid.get((gx + i) + ',' + (gz + j)); if (!l) continue;
      for (const t of l) {
        const x = this.x[t], z = this.z[t], d = Math.hypot(x - cx, z - cz); if (d > this.R) continue;
        const near = d < this.nearD; if (near ? a >= N.cap : b >= F.cap) continue;
        const A = near ? nP.array : fP.array, T = near ? nT.array : fT.array, o = near ? a++ : b++, K = TINT[(this.k[t] + t)%TINT.length];
        A[o*4] = x; A[o*4 + 1] = this.y[t] || 0; A[o*4 + 2] = z; A[o*4 + 3] = Math.max(.7, this.s[t]*1.35); T[o*3] = K[0]; T[o*3 + 1] = K[1]; T[o*3 + 2] = K[2];
      }
    }
    N.geometry.instanceCount = a; F.geometry.instanceCount = b; nP.needsUpdate = nT.needsUpdate = fP.needsUpdate = fT.needsUpdate = true;
  }
}
