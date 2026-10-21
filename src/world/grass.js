// Grass and weeds near the camera (the Slow Roads trick): open ground, parks, verges, scrub,
// bare soil, medians, gets little alpha-cut tufts scattered when its chunk is built, and one
// instanced mesh shows the ones within a few tens of metres, swaying in the wind and shrinking
// to nothing at the edge of the radius so they never pop. Far away the ground texture does the work.
import * as THREE from 'three';
import { U } from '../gfx/materials.js';
import { RNG } from '../core/util.js';
import { pointInRings } from './mapdata.js';

// tufts per square metre by ground kind; t: 0 lush grass, 1 dry grass, 2 weeds
const KINDS = {
  grass: { d: 0.9, t: [0, 0, 0, 1] },
  scrub: { d: 0.55, t: [1, 1, 2, 0] },
  soil: { d: 0.1, t: [1, 2, 2] },
  median: { d: 0.25, t: [0, 1, 2] },
  compound: { d: 0.04, t: [1, 2] },
};
const MAX_PER_CHUNK = 7000;

// scatter tufts over a chunk's open ground (called from the chunk builder; yields between polygons)
export function* scatterTufts(C) {
  const out = [];
  const rng = new RNG(4242 + C.ci);
  for (const g of C.ground) {
    const K = KINDS[g.kind];
    if (!K) continue;
    const o = g.rings[0];
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (let k = 0; k < o.length; k += 2) { x0 = Math.min(x0, o[k]); x1 = Math.max(x1, o[k]); z0 = Math.min(z0, o[k + 1]); z1 = Math.max(z1, o[k + 1]); }
    const n = Math.min(MAX_PER_CHUNK - out.length / 4, Math.round((x1 - x0) * (z1 - z0) * K.d));
    for (let k = 0; k < n; k++) {
      const x = rng.range(x0, x1), z = rng.range(z0, z1);
      if (!pointInRings(x, z, g.rings)) continue;
      // clumpy: thin out with a cheap noise so it reads as patches, not a carpet
      const cl = Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2.0) * Math.sin(z * 0.27 + Math.sin(x * 0.13) * 2.0);
      if (cl < -0.35 && rng.chance(0.7)) continue;
      out.push(x, z, K.t[rng.int(0, K.t.length - 1)], rng.range(0.7, 1.35));
    }
    if (out.length / 4 >= MAX_PER_CHUNK) break;
    yield;
  }
  C.tufts = new Float32Array(out);
}

function grassAtlas() {
  const W = 768, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const rng = new RNG(77);
  const cell = (ci, cols, n, hMin, hMax, wid) => {
    const ox = ci * 256;
    for (let k = 0; k < n; k++) {
      const bx = ox + 20 + rng.next() * 216, h = H * rng.range(hMin, hMax), lean = rng.range(-0.35, 0.35) * h;
      const c = cols[rng.int(0, cols.length - 1)];
      const g = x.createLinearGradient(0, H, 0, H - h);
      g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
      x.fillStyle = g;
      const w = rng.range(wid * 0.6, wid * 1.3);
      x.beginPath();
      x.moveTo(bx - w, H);
      x.quadraticCurveTo(bx - w * 0.4 + lean * 0.3, H - h * 0.55, bx + lean, H - h);
      x.quadraticCurveTo(bx + w * 0.4 + lean * 0.3, H - h * 0.55, bx + w, H);
      x.closePath();
      x.fill();
    }
  };
  // lush (park lawns, watered verges)
  cell(0, [['#2f5a1c', '#8fbf4a'], ['#3a6a22', '#a6cc5a'], ['#2a4f18', '#7aad3c']], 70, 0.45, 0.95, 5);
  // dry October grass (Pune's open plots after the monsoon)
  cell(1, [['#5f6a2a', '#c9c27a'], ['#6f7330', '#d8cf8c'], ['#55602a', '#b9b56a']], 60, 0.4, 0.92, 4.5);
  // weeds: broader leaves, a few seed heads
  cell(2, [['#35501f', '#7d9a3e'], ['#40552a', '#93a856']], 26, 0.25, 0.7, 9);
  x.fillStyle = '#e8e2c8';
  for (let k = 0; k < 14; k++) { const px = 512 + 20 + rng.next() * 216, py = H * rng.range(0.25, 0.55); x.beginPath(); x.arc(px, py, rng.range(2, 4), 0, 6.283); x.fill(); }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// one tuft: three crossed cards; normals lean upward so the tuft takes light like the ground does
function tuftGeometry() {
  const P = [], N = [], UV = [], I = [], C = [];
  const w = 0.55, h = 0.62;
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3, cx = Math.cos(a) * w, cz = Math.sin(a) * w;
    const b = P.length / 3;
    P.push(-cx, 0, -cz, cx, 0, cz, cx, h, cz, -cx, h, -cz);
    for (let j = 0; j < 4; j++) N.push(0, 1, 0);
    UV.push(0, 0, 1, 0, 1, 1, 0, 1);
    C.push(0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 1, 1, 1, 1, 1, 1);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  return g;
}

export class GrassField {
  constructor(W, scene, quality) {
    this.W = W;
    this.R = quality.grassRange ?? 34;
    const cap = quality.grassCap ?? 5000;
    this.on = this.R > 0 && cap > 0;
    if (!this.on) return;
    const geo = tuftGeometry();
    this.aCell = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    geo.setAttribute('aCell', this.aCell);
    const mat = new THREE.MeshLambertMaterial({ map: grassAtlas(), vertexColors: true, alphaTest: 0.5, alphaToCoverage: !!quality.msaa, side: THREE.DoubleSide });
    const R = this.uR = { value: this.R };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uR = R;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCell; uniform float uTime; uniform float uWind; uniform float uR;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vec2((aCell + uv.x) / 3.0, uv.y);\n#endif')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 iP = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float dC = distance(iP.xz, cameraPosition.xz);
          float fade = smoothstep(uR, uR * 0.72, dC);           // shrink away at the edge of the radius
          transformed *= fade;
          float ph = iP.x * 0.37 + iP.z * 0.23;
          float sway = (sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.9) * 0.25) * uWind;
          transformed.x += sway * 0.09 * uv.y; transformed.z += sway * 0.06 * uv.y;`);
    };
    mat.customProgramCacheKey = () => 'nh-grass';
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.cap = cap;
    this.lastX = 1e9; this.lastZ = 1e9;
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.tint = new THREE.Color();
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
  }
  update(cx, cz, force) {
    if (!this.on) return;
    if (!force && Math.hypot(cx - this.lastX, cz - this.lastZ) < 2) return;
    this.lastX = cx; this.lastZ = cz;
    const R = this.R, R2 = R * R;
    const I = this.W.index;
    const { m, q, e, v, s } = this;
    const arr = this.mesh.instanceMatrix.array, col = this.mesh.instanceColor.array, cell = this.aCell.array;
    let n = 0;
    const i0 = Math.floor((cx - R - I.x0) / I.size), i1 = Math.floor((cx + R - I.x0) / I.size);
    const j0 = Math.floor((cz - R - I.z0) / I.size), j1 = Math.floor((cz + R - I.z0) / I.size);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= I.ncx || j >= I.ncz) continue;
      const C = I.chunks[i + j * I.ncx];
      if (!C.built || !C.tufts) continue;
      const T = C.tufts;
      for (let k = 0; k < T.length && n < this.cap; k += 4) {
        const dx = T[k] - cx, dz = T[k + 1] - cz;
        if (dx * dx + dz * dz > R2) continue;
        const sc = T[k + 3];
        e.set(0, (T[k] * 7.13 + T[k + 1] * 3.7) % 6.283, 0); q.setFromEuler(e);
        m.compose(v.set(T[k], 0.16, T[k + 1]), q, s.set(sc, sc * (0.85 + (k % 7) * 0.05), sc));
        m.toArray(arr, n * 16);
        const hue = ((T[k] * 13.7 + T[k + 1] * 5.3) % 1 + 1) % 1;
        const b = 0.85 + hue * 0.3;
        col[n * 3] = b; col[n * 3 + 1] = b; col[n * 3 + 2] = b * (0.92 + hue * 0.1);
        cell[n] = T[k + 2];
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.aCell.needsUpdate = true;
  }
}
