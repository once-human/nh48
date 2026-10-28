// Street furniture and greenery: trees (instanced, LOD), street lamps, electric poles with
// sagging cables, signals, bus shelters, tea stalls & handcarts, compound walls, the
// Metro Line 2 viaduct, street-name boards and festival banners.
import * as THREE from 'three';
import { ColorBuilder, GroundBuilder, FacadeBuilder, QuadBuilder, cmRing, walkLine, polyLength, lin } from './geo.js';
import { G, F } from '../gfx/textures.js';
import { RNG, hash1 } from '../core/util.js';
import { propMaterial, glowMaterial, U } from '../gfx/materials.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S3 = new THREE.Vector3(), EUL = new THREE.Euler();
export function compose(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0, out = M4) {
  EUL.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(EUL);
  return out.compose(V.set(x, y, z), Q, S3.set(sx, sy, sz));
}
// rotation about y that maps local +x onto direction (dx, dz)
export const yawX = (dx, dz) => Math.atan2(-dz, dx);

// foliage: keep the soft outward normals on both faces + gentle wind sway
export function foliage(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        #else
          float ph = 0.0;
        #endif
        float sw = max(0.0, transformed.y - 2.5) * 0.012;
        transformed.x += sin(uTime * 1.3 + ph + transformed.y * 0.4) * sw;
        transformed.z += cos(uTime * 1.1 + ph * 1.3) * sw * 0.7;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
      'float faceDirection = gl_FrontFacing ? 1.0 : -1.0;\nvec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;');
  };
  mat.customProgramCacheKey = () => 'md-foliage-' + key;
  return mat;
}

// ---------------------------------------------------------------- instanced sets with distance culling
// items added while InstancedSet.tag is set belong to that tile
export class InstancedSet {
  constructor(scene, geo, mat, capacity, range, opts = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = !!opts.cast;
    this.mesh.receiveShadow = opts.receive !== false;
    this.capacity = capacity;
    this.range = range;
    this.minRange = opts.minRange || 0;
    this.items = [];          // {x, z, m: Float32Array(16), c: [r,g,b]}
    this.hasColor = !!opts.color;
    if (this.hasColor) this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    scene.add(this.mesh);
  }
  add(x, z, matrix, color) {
    const m = new Float32Array(16);
    matrix.toArray(m);
    const it = { x, z, m, c: color || null, off: false, tag: InstancedSet.tag };
    this.items.push(it);
    return it;
  }
  removeTag(tag) { this.items = this.items.filter(it => it.tag !== tag); }
  update(cx, cz, fr) {
    const arr = this.mesh.instanceMatrix.array;
    const col = this.hasColor ? this.mesh.instanceColor.array : null;
    let n = 0;
    const r2 = this.range * this.range, m2 = this.minRange * this.minRange;
    for (const it of this.items) {
      if (it.off) continue;
      const dx = it.x - cx, dz = it.z - cz, d2 = dx * dx + dz * dz;
      if (d2 > r2 || d2 < m2) continue;
      if (fr && !fr(it.x, it.z)) continue;
      arr.set(it.m, n * 16);
      if (col && it.c) { col[n * 3] = it.c[0]; col[n * 3 + 1] = it.c[1]; col[n * 3 + 2] = it.c[2]; }
      if (++n >= this.capacity) break;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (col) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- tree geometry
export const TREE = [
  // rain tree: broad umbrella
  { trunkH: 4.2, trunkR: 0.32, crownY: 6.2, crownR: 6.0, crownH: 2.6, blobs: 9, spread: 1.0, green: [0.24, 0.36, 0.13], cards: 46, flat: 0.55 },
  // gulmohar: wide, feathery, lighter
  { trunkH: 3.4, trunkR: 0.26, crownY: 5.2, crownR: 5.0, crownH: 2.4, blobs: 8, spread: 1.0, green: [0.33, 0.45, 0.16], cards: 40, flat: 0.6 },
  // peepal: rounded, dense
  { trunkH: 3.0, trunkR: 0.45, crownY: 6.4, crownR: 4.6, crownH: 4.2, blobs: 10, spread: 0.8, green: [0.2, 0.34, 0.12], cards: 40, flat: 0.9 },
  // neem
  { trunkH: 2.6, trunkR: 0.24, crownY: 4.8, crownR: 3.4, crownH: 3.0, blobs: 7, spread: 0.8, green: [0.26, 0.38, 0.14], cards: 30, flat: 0.85 },
  // ashoka (Polyalthia): tall narrow column
  { trunkH: 1.2, trunkR: 0.14, crownY: 5.5, crownR: 1.3, crownH: 9.5, blobs: 7, spread: 0.3, green: [0.12, 0.26, 0.08], cards: 18, flat: 3.5, column: true },
  // coconut palm
  { palm: true, trunkH: 9.5, trunkR: 0.18, green: [0.3, 0.42, 0.14] },
  // banyan: huge, aerial roots
  { trunkH: 3.6, trunkR: 0.75, crownY: 7.0, crownR: 8.0, crownH: 4.5, blobs: 13, spread: 1.0, green: [0.18, 0.32, 0.11], cards: 60, flat: 0.6, roots: true },
  // mango: dense dark dome
  { trunkH: 2.2, trunkR: 0.3, crownY: 4.6, crownR: 3.8, crownH: 3.6, blobs: 8, spread: 0.85, green: [0.14, 0.27, 0.09], cards: 34, flat: 0.95 },
];

function noiseDisplace(geo, amt, seed) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = hash1(Math.round(x * 13 + seed) * 31 + Math.round(y * 17) * 7 + Math.round(z * 11));
    const k = 1 + (h - 0.5) * amt;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export function makeTree(spec, seed) {
  const rng = new RNG(seed);
  const trunk = new ColorBuilder(), crown = new ColorBuilder(), cards = new QuadBuilder(), far = new ColorBuilder();
  const bark = [0.32, 0.27, 0.22];
  if (spec.palm) {
    // curved segmented trunk
    let x = 0, z = 0;
    const lean = rng.range(0.4, 1.2);
    const segs = 7;
    for (let k = 0; k < segs; k++) {
      const y0 = spec.trunkH * k / segs, h = spec.trunkH / segs;
      const t = k / segs;
      const nx = lean * t * t;
      const g = new THREE.CylinderGeometry(spec.trunkR * (1 - t * 0.25), spec.trunkR * (1 - t * 0.2), h * 1.02, 6);
      trunk.addGeo(g, compose(nx, y0 + h / 2, 0, 0, 1, 1, 1, 0, -lean * 0.12 * t), [0.42, 0.37, 0.3]);
      x = nx;
    }
    // fronds as arched strips
    const top = spec.trunkH;
    for (let f = 0; f < 11; f++) {
      const a = f / 11 * Math.PI * 2 + rng.range(-0.2, 0.2);
      const len = rng.range(3.0, 4.0);
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        pts.push([x + Math.cos(a) * len * t, top + Math.sin(t * Math.PI * 0.8) * 1.1 - t * t * 1.8, Math.sin(a) * len * t]);
      }
      for (let k = 0; k < 6; k++) {
        const [ax, ay, az] = pts[k], [bx, by, bz] = pts[k + 1];
        const w = 0.55 * Math.sin((k + 0.5) / 6 * Math.PI) + 0.1;
        const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
        const c = spec.green.map(v => v * rng.range(0.85, 1.15));
        const v0 = crown.v(ax - px, ay, az - pz, 0, 1, 0, ...c), v1 = crown.v(bx - px, by, bz - pz, 0, 1, 0, ...c);
        const v2 = crown.v(bx + px, by - 0.05, bz + pz, 0, 1, 0, ...c), v3 = crown.v(ax + px, ay - 0.05, az + pz, 0, 1, 0, ...c);
        crown.i.push(v0, v1, v2, v0, v2, v3);
      }
    }
    far.addGeo(new THREE.CylinderGeometry(spec.trunkR, spec.trunkR, spec.trunkH, 4), compose(0.5, spec.trunkH / 2, 0), [0.42, 0.37, 0.3]);
    far.addGeo(new THREE.ConeGeometry(3.2, 1.5, 6), compose(0.8, spec.trunkH, 0, 0, 1, -1, 1), spec.green);
    return { trunk: trunk.build(), crown: crown.build(), cards: null, far: far.build(), radius: spec.trunkR + 0.1 };
  }
  // trunk + main branches
  const tg = new THREE.CylinderGeometry(spec.trunkR * 0.7, spec.trunkR, spec.trunkH, 7);
  trunk.addGeo(tg, compose(0, spec.trunkH / 2, 0), bark);
  const nb = spec.column ? 0 : 4;
  for (let k = 0; k < nb; k++) {
    const a = k / nb * Math.PI * 2 + rng.range(-0.4, 0.4);
    const len = (spec.crownY - spec.trunkH) * 1.4 + 1;
    const g = new THREE.CylinderGeometry(spec.trunkR * 0.35, spec.trunkR * 0.6, len, 5);
    g.translate(0, len / 2, 0);
    const tilt = rng.range(0.5, 0.9) * (spec.flat < 0.8 ? 1 : 0.6);
    const m = new THREE.Matrix4().makeRotationY(-a).multiply(new THREE.Matrix4().makeRotationZ(-tilt));
    m.setPosition(0, spec.trunkH * 0.92, 0);
    trunk.addGeo(g, m, bark);
  }
  if (spec.column) {
    const g = new THREE.CylinderGeometry(spec.trunkR * 0.5, spec.trunkR, spec.crownY + spec.crownH * 0.4, 5);
    trunk.addGeo(g, compose(0, (spec.crownY + spec.crownH * 0.4) / 2, 0), bark);
  }
  if (spec.roots) {
    for (let k = 0; k < 10; k++) {
      const a = rng.range(0, 6.28), r = rng.range(1.5, spec.crownR * 0.7);
      const h = spec.crownY - 0.8;
      trunk.addGeo(new THREE.CylinderGeometry(0.05, 0.07, h, 3), compose(Math.cos(a) * r, h / 2, Math.sin(a) * r), [0.4, 0.34, 0.28]);
    }
  }
  // crown: dark inner blobs + clumps of leaf cards with spherical normals (soft volumetric look)
  const blobs = [];
  const cc = [0, spec.crownY, 0];
  const crR = [spec.crownR, spec.column ? spec.crownH * 0.5 : spec.crownH * 0.6, spec.crownR];
  for (let k = 0; k < spec.blobs; k++) {
    let bx, by, bz, s;
    if (spec.column) {
      const t = k / (spec.blobs - 1);
      by = spec.crownY - spec.crownH * 0.35 + t * spec.crownH * 0.9;
      const w = spec.crownR * (1 - t * 0.75);
      bx = rng.range(-0.15, 0.15); bz = rng.range(-0.15, 0.15); s = [w, spec.crownH / spec.blobs * 1.3, w];
    } else {
      const a = rng.range(0, 6.28), r = Math.sqrt(rng.next()) * spec.crownR * 0.62 * spec.spread;
      bx = Math.cos(a) * r; bz = Math.sin(a) * r;
      by = spec.crownY + rng.range(-0.35, 0.35) * spec.crownH - (r / spec.crownR) * spec.crownH * 0.25;
      const rs = rng.range(0.42, 0.6) * spec.crownR;
      s = [rs, rs * spec.flat * rng.range(0.85, 1.15), rs];
    }
    blobs.push([bx, by, bz, s]);
    const g = noiseDisplace(new THREE.IcosahedronGeometry(1, 1), 0.35, k * 13 + seed);
    const m = compose(bx, by, bz, rng.range(0, 6), s[0] * 0.78, s[1] * 0.78, s[2] * 0.78);
    const base = crown.c;
    crown.addGeo(g, m, [1, 1, 1]);
    for (let v = base; v < crown.c; v++) {
      const y = crown.p[v * 3 + 1];
      const t = Math.min(1, Math.max(0, (y - (spec.crownY - spec.crownH * 0.5)) / spec.crownH));
      const k2 = (0.42 + 0.4 * t) * rng.range(0.92, 1.08);
      crown.col[v * 3] = lin(Math.min(1, spec.green[0] * k2)); crown.col[v * 3 + 1] = lin(Math.min(1, spec.green[1] * k2)); crown.col[v * 3 + 2] = lin(Math.min(1, spec.green[2] * k2));
      // spherical normals from the crown centre
      const nx = (crown.p[v * 3] - cc[0]) / crR[0], ny = (y - cc[1]) / crR[1] + 0.3, nz = (crown.p[v * 3 + 2] - cc[2]) / crR[2];
      const L = Math.hypot(nx, ny, nz) || 1;
      crown.n[v * 3] = nx / L; crown.n[v * 3 + 1] = ny / L; crown.n[v * 3 + 2] = nz / L;
    }
  }
  const perBlob = Math.max(4, Math.round(spec.cards * 2.2 / spec.blobs));
  for (const b of blobs) {
    for (let k = 0; k < perBlob; k++) {
      const u = rng.range(0, 6.28), v = rng.range(-0.45, 1.0);
      const dx = Math.cos(u) * Math.cos(v), dy = Math.sin(v), dz = Math.sin(u) * Math.cos(v);
      const rr = rng.range(0.6, 1.02);
      const cx = b[0] + dx * b[3][0] * rr, cy = b[1] + dy * b[3][1] * rr, cz = b[2] + dz * b[3][2] * rr;
      const size = rng.range(1.5, 2.5) * (spec.column ? 0.55 : 1) * Math.min(1.25, 0.6 + spec.crownR * 0.12);
      let nx = dx + rng.range(-0.7, 0.7), ny = dy + rng.range(-0.5, 0.9), nz = dz + rng.range(-0.7, 0.7);
      let L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      let tx = -nz, ty = 0, tz = nx;
      const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const roll = rng.range(0, 6.28), cr = Math.cos(roll), sr = Math.sin(roll);
      let bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
      const t2x = tx * cr + bx * sr, t2y = ty * cr + by * sr, t2z = tz * cr + bz * sr;
      const b2x = -tx * sr + bx * cr, b2y = -ty * sr + by * cr, b2z = -tz * sr + bz * cr;
      const h = size / 2;
      const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, c2]) => [cx + (t2x * a + b2x * c2) * h, cy + (t2y * a + b2y * c2) * h, cz + (t2z * a + b2z * c2) * h]);
      const N = P.map(p => {
        const ex = (p[0] - cc[0]) / crR[0], ey = (p[1] - cc[1]) / crR[1] + 0.35, ez = (p[2] - cc[2]) / crR[2];
        const l = Math.hypot(ex, ey, ez) || 1;
        return [ex / l, ey / l, ez / l];
      });
      cards.quadN(P, N, 0, 0, 1, 1);
    }
  }
  // far LOD: one squashed blob + stick
  far.addGeo(new THREE.CylinderGeometry(spec.trunkR * 0.7, spec.trunkR, spec.crownY, 4), compose(0, spec.crownY / 2, 0), bark);
  const fg = new THREE.IcosahedronGeometry(1, 0);
  const fs = spec.column ? [spec.crownR, spec.crownH * 0.55, spec.crownR] : [spec.crownR * 0.8, spec.crownH * 0.6, spec.crownR * 0.8];
  far.addGeo(fg, compose(0, spec.crownY + (spec.column ? spec.crownH * 0.1 : 0), 0, 0, ...fs), spec.green.map(v => v * 0.9));
  return { trunk: trunk.build(), crown: crown.build(), cards: cards.build(), far: far.build(), radius: spec.trunkR + 0.15 };
}

// ---------------------------------------------------------------- small prop prototypes
export function buildProto() {
  const P = {};
  // street lamp: tapered pole with arm and LED head
  {
    const b = new ColorBuilder();
    b.addGeo(new THREE.CylinderGeometry(0.07, 0.13, 8.0, 7), compose(0, 4.0, 0), [0.42, 0.44, 0.46]);
    b.addGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 5), compose(0.85, 8.0, 0, 0, 1, 1, 1, 0, Math.PI / 2 - 0.25), [0.42, 0.44, 0.46]);
    b.addGeo(new THREE.BoxGeometry(0.65, 0.12, 0.3), compose(1.75, 8.15, 0), [0.3, 0.3, 0.32]);
    b.addGeo(new THREE.BoxGeometry(0.5, 0.03, 0.22), compose(1.75, 8.08, 0), [1.0, 0.92, 0.8], 1.0);
    b.addGeo(new THREE.BoxGeometry(0.4, 0.5, 0.16), compose(0, 1.2, 0.12), [0.55, 0.55, 0.5]);
    P.lamp = b.build();
  }
  // cement electric pole with crossarm + transformer-ish box on some
  {
    const b = new ColorBuilder();
    b.addGeo(new THREE.BoxGeometry(0.2, 8.5, 0.16), compose(0, 4.25, 0), [0.62, 0.61, 0.58]);
    b.addGeo(new THREE.BoxGeometry(1.6, 0.1, 0.1), compose(0, 7.9, 0), [0.25, 0.25, 0.27]);
    for (const o of [-0.7, -0.25, 0.25, 0.7]) b.addGeo(new THREE.CylinderGeometry(0.04, 0.05, 0.14, 5), compose(o, 8.0, 0), [0.85, 0.85, 0.8]);
    b.addGeo(new THREE.BoxGeometry(0.35, 0.5, 0.25), compose(0, 5.2, 0.2), [0.35, 0.36, 0.36]);
    // coils of extra cable everyone leaves on poles
    b.addGeo(new THREE.TorusGeometry(0.28, 0.035, 4, 10), compose(0.0, 6.2, 0.12, 0, 1, 1, 1, Math.PI / 2), [0.08, 0.08, 0.08]);
    P.pole = b.build();
  }
  // traffic signal: pole + head (3 lamps) facing +x
  {
    const b = new ColorBuilder();
    b.addGeo(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), compose(0, 1.7, 0), [0.15, 0.15, 0.16]);
    b.addGeo(new THREE.BoxGeometry(0.3, 1.0, 0.35), compose(0.05, 3.25, 0), [0.1, 0.1, 0.1]);
    // black/yellow striped base band
    for (let k = 0; k < 3; k++) b.addGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.25, 6), compose(0, 0.25 + k * 0.5, 0), k % 2 ? [0.1, 0.1, 0.1] : [0.9, 0.72, 0.1]);
    P.signal = b.build();
    P.bulb = new THREE.CircleGeometry(0.11, 10);
  }
  // bus shelter (open, steel)
  {
    const b = new ColorBuilder();
    for (const o of [-2.2, 2.2]) b.addGeo(new THREE.BoxGeometry(0.1, 2.6, 0.1), compose(o, 1.3, -0.6), [0.35, 0.5, 0.4]);
    for (const o of [-2.2, 2.2]) b.addGeo(new THREE.BoxGeometry(0.1, 2.4, 0.1), compose(o, 1.2, 0.6), [0.35, 0.5, 0.4]);
    b.addGeo(new THREE.BoxGeometry(5.0, 0.08, 1.8), compose(0, 2.62, 0, 0, 1, 1, 1, 0.08), [0.2, 0.45, 0.32]);
    b.addGeo(new THREE.BoxGeometry(4.4, 1.6, 0.05), compose(0, 1.4, -0.62), [0.75, 0.78, 0.8]);
    b.addGeo(new THREE.BoxGeometry(4.0, 0.08, 0.45), compose(0, 0.5, -0.35), [0.6, 0.6, 0.62]);
    P.bus = b.build();
  }
  // tea stall (tapri): cabin, tin roof, kettle on stove, glasses
  {
    const b = new ColorBuilder();
    b.addGeo(new THREE.BoxGeometry(2.2, 1.0, 1.2), compose(0, 0.5, 0), [0.55, 0.36, 0.2]);
    b.addGeo(new THREE.BoxGeometry(2.2, 1.2, 0.06), compose(0, 1.6, -0.57), [0.75, 0.2, 0.15]);
    b.addGeo(new THREE.BoxGeometry(0.06, 1.2, 1.2), compose(-1.07, 1.6, 0), [0.7, 0.68, 0.6]);
    b.addGeo(new THREE.BoxGeometry(0.06, 1.2, 1.2), compose(1.07, 1.6, 0), [0.7, 0.68, 0.6]);
    b.addGeo(new THREE.BoxGeometry(2.6, 0.05, 1.7), compose(0, 2.25, 0.15, 0, 1, 1, 1, 0.1), [0.55, 0.57, 0.6]);
    b.addGeo(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8), compose(0.5, 1.15, 0.1), [0.75, 0.75, 0.78]);
    b.addGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 8), compose(0.5, 1.03, 0.1), [0.15, 0.25, 0.6], 0.6);
    for (let k = 0; k < 5; k++) b.addGeo(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 6), compose(-0.6 + k * 0.1, 1.05, 0.35), [0.85, 0.75, 0.55]);
    b.addGeo(new THREE.BoxGeometry(1.4, 0.08, 0.35), compose(0, 0.4, 1.0), [0.4, 0.3, 0.2]);   // bench
    P.stall0 = b.build();
  }
  // paan shop: narrow cabin with hanging colourful sachets
  {
    const b = new ColorBuilder();
    b.addGeo(new THREE.BoxGeometry(1.4, 2.2, 1.2), compose(0, 1.1, 0), [0.2, 0.45, 0.35]);
    b.addGeo(new THREE.BoxGeometry(1.2, 0.9, 0.05), compose(0, 1.45, 0.61), [0.12, 0.1, 0.08]);
    const cols = [[0.9, 0.2, 0.2], [0.95, 0.75, 0.1], [0.2, 0.5, 0.9], [0.9, 0.9, 0.9], [0.2, 0.7, 0.3]];
    for (let k = 0; k < 14; k++) b.addGeo(new THREE.BoxGeometry(0.06, 0.5, 0.01), compose(-0.6 + k * 0.09, 1.65, 0.66), cols[k % 5]);
    b.addGeo(new THREE.BoxGeometry(1.7, 0.05, 1.5), compose(0, 2.25, 0.1), [0.55, 0.55, 0.6]);
    P.stall1 = b.build();
  }
  // vada pav cart: handcart with glass box, gas stove, wheels
  {
    const b = new ColorBuilder();
    b.addGeo(new THREE.BoxGeometry(1.8, 0.1, 0.9), compose(0, 0.8, 0), [0.6, 0.6, 0.62]);
    for (const [x, z] of [[-0.7, -0.45], [-0.7, 0.45], [0.7, -0.45], [0.7, 0.45]]) b.addGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 10), compose(x, 0.28, z, 0, 1, 1, 1, Math.PI / 2), [0.1, 0.1, 0.1]);
    b.addGeo(new THREE.BoxGeometry(0.9, 0.45, 0.7), compose(-0.35, 1.08, 0), [0.75, 0.85, 0.85]);
    b.addGeo(new THREE.CylinderGeometry(0.35, 0.25, 0.15, 10), compose(0.5, 0.95, 0), [0.25, 0.25, 0.25]);
    b.addGeo(new THREE.BoxGeometry(0.08, 1.4, 0.08), compose(0.85, 1.5, 0.4), [0.4, 0.4, 0.4]);
    b.addGeo(new THREE.BoxGeometry(1.0, 0.03, 0.8), compose(0.6, 2.2, 0.2), [0.9, 0.3, 0.1]);
    P.stall2 = b.build();
  }
  // fruit cart: pyramid of fruit
  {
    const b = new ColorBuilder();
    b.addGeo(new THREE.BoxGeometry(2.0, 0.12, 1.0), compose(0, 0.8, 0), [0.45, 0.32, 0.2]);
    for (const [x, z] of [[-0.8, -0.5], [-0.8, 0.5], [0.8, -0.5], [0.8, 0.5]]) b.addGeo(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10), compose(x, 0.3, z, 0, 1, 1, 1, Math.PI / 2), [0.1, 0.1, 0.1]);
    const fruit = [[0.9, 0.55, 0.05], [0.85, 0.12, 0.1], [0.35, 0.65, 0.15], [0.95, 0.8, 0.15]];
    const sph = new THREE.IcosahedronGeometry(0.075, 0);
    let k = 0;
    for (let layer = 0; layer < 3; layer++) {
      const nx = 7 - layer * 2, nz = 3 - layer;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const c = fruit[Math.floor(i / Math.max(1, nx / 4)) % 4];
        b.addGeo(sph, compose(-0.75 + layer * 0.11 + i * 0.22, 0.95 + layer * 0.15, -0.3 + layer * 0.11 + j * 0.22, 0, 1.4, 1.4, 1.4), c);
        k++;
      }
    }
    P.stall3 = b.build();
  }
  // flower stall baskets
  {
    const b = new ColorBuilder();
    for (let k = 0; k < 4; k++) {
      b.addGeo(new THREE.CylinderGeometry(0.35, 0.25, 0.25, 8), compose(-0.6 + (k % 2) * 1.0, 0.35, (k > 1 ? 0.5 : -0.2)), [0.65, 0.5, 0.3]);
      b.addGeo(new THREE.SphereGeometry(0.3, 8, 4, 0, 6.29, 0, 1.4), compose(-0.6 + (k % 2) * 1.0, 0.45, (k > 1 ? 0.5 : -0.2)), [[1, 0.6, 0.05], [0.95, 0.95, 0.9], [0.9, 0.15, 0.3], [1, 0.8, 0.1]][k]);
    }
    b.addGeo(new THREE.BoxGeometry(1.8, 0.04, 1.6), compose(0, 2.0, 0.15), [0.2, 0.4, 0.75]);
    for (const [x, z] of [[-0.85, -0.6], [0.85, -0.6], [-0.85, 0.9], [0.85, 0.9]]) b.addGeo(new THREE.BoxGeometry(0.05, 2.0, 0.05), compose(x, 1.0, z), [0.5, 0.4, 0.3]);
    P.stall4 = b.build();
  }
  // sugarcane juice cart
  {
    const b = new ColorBuilder();
    b.addGeo(new THREE.BoxGeometry(1.8, 0.9, 1.0), compose(0, 0.75, 0), [0.15, 0.55, 0.3]);
    b.addGeo(new THREE.BoxGeometry(0.6, 0.6, 0.5), compose(0.4, 1.5, 0), [0.75, 0.75, 0.8]);
    b.addGeo(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12), compose(0.4, 1.5, 0.3, 0, 1, 1, 1, Math.PI / 2), [0.2, 0.2, 0.2]);
    for (let k = 0; k < 8; k++) b.addGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 4), compose(-0.6 + k * 0.03, 1.7, -0.3, 0, 1, 1, 1, 0.12), [0.55, 0.65, 0.25]);
    P.stall5 = b.build();
  }
  // street name board on two posts (board quad separate)
  {
    const b = new ColorBuilder();
    for (const o of [-1.15, 1.15]) b.addGeo(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 5), compose(o, 1.45, 0), [0.35, 0.35, 0.35]);
    b.addGeo(new THREE.BoxGeometry(2.5, 0.68, 0.05), compose(0, 2.55, -0.04), [0.1, 0.25, 0.5]);
    P.streetBoard = b.build();
  }
  // bamboo banner frame
  {
    const b = new ColorBuilder();
    for (const o of [-1.7, 1.7]) b.addGeo(new THREE.CylinderGeometry(0.04, 0.05, 3.2, 5), compose(o, 1.6, 0), [0.7, 0.58, 0.35]);
    P.bannerFrame = b.build();
  }
  return P;
}

// ---------------------------------------------------------------- build all props
export function buildProps(M, W) {
  const { scene, chunks, mats, collision, signs, quality } = W;
  const P = buildProto();
  W.proto = P;
  const rng = new RNG(777);
  const sets = [];
  W.instSets = sets;
  const q = quality;

  // --- trees
  const treeMats = {
    trunk: propMaterial(),
    crown: foliage(new THREE.MeshLambertMaterial({ vertexColors: true }), 'crown'),
    cards: foliage(new THREE.MeshLambertMaterial({ map: W.tex.leaf, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xd8e0c8 }), 'cards'),
    far: foliage(new THREE.MeshLambertMaterial({ vertexColors: true }), 'far'),
  };
  W.treeMats = treeMats;
  const kinds = TREE.map((spec, k) => makeTree(spec, 100 + k));
  const counts = new Array(TREE.length).fill(0);
  for (const t of M.trees) counts[t[2]]++;
  const tSets = kinds.map((g, k) => ({
    trunk: new InstancedSet(scene, g.trunk, treeMats.trunk, Math.min(counts[k], q.treeNear), q.treeNearRange, { cast: q.shadows }),
    crown: new InstancedSet(scene, g.crown, treeMats.crown, Math.min(counts[k], q.treeNear), q.treeNearRange, { cast: q.shadows, color: true }),
    cards: g.cards && q.leafCards ? new InstancedSet(scene, g.cards, treeMats.cards, Math.min(counts[k], q.treeNear), q.treeCardRange, { cast: q.shadows, color: true }) : null,
    far: new InstancedSet(scene, g.far, treeMats.far, Math.min(counts[k], q.treeFar), q.treeFarRange, { minRange: q.treeNearRange, color: true }),
  }));
  const mtx = new THREE.Matrix4();
  for (const t of M.trees) {
    const x = t[0] / 100, z = t[1] / 100, k = t[2], s = t[3];
    const ry = hash1(t[0] * 7 + t[1]) * 6.28;
    compose(x, 0.15, z, ry, s, s * (0.9 + hash1(t[1]) * 0.2), s, 0, 0, mtx);
    const tint = 0.85 + hash1(t[0] + t[1] * 3) * 0.3;
    const c = [tint * (0.95 + hash1(t[0]) * 0.15), tint, tint * (0.9 + hash1(t[1]) * 0.1)];
    const S = tSets[k];
    S.trunk.add(x, z, mtx); S.crown.add(x, z, mtx, c); if (S.cards) S.cards.add(x, z, mtx, c); S.far.add(x, z, mtx, c);
    collision.addCircle(x, z, kinds[k].radius * s, 1);
  }
  for (const S of tSets) sets.push(S.trunk, S.crown, S.far, ...(S.cards ? [S.cards] : []));

  // --- lamps
  const lampSet = new InstancedSet(scene, P.lamp, mats.prop, 700, q.propRange, { cast: q.shadows });
  sets.push(lampSet);
  W.lampPositions = [];
  for (const l of M.lamps) {
    const x = l[0] / 100, z = l[1] / 100, a = l[2];
    // pole stands at the kerb, arm reaches over the road: arm points along -side normal; stored angle is the arm direction
    const dx = Math.cos(a), dz = Math.sin(a);     // arm direction, over the road
    lampSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)));
    collision.addCircle(x, z, 0.16, 2);
    W.lampPositions.push([x + dx * 1.75, z + dz * 1.75]);
  }

  // --- electric poles + wires
  const poleSet = new InstancedSet(scene, P.pole, mats.prop, 600, q.propRange, { cast: q.shadows });
  sets.push(poleSet);
  const byRoad = new Map();
  for (const p of M.poles) {
    const x = p[0] / 100, z = p[1] / 100;
    if (!byRoad.has(p[2])) byRoad.set(p[2], []);
    byRoad.get(p[2]).push({ x, z, d: p[3] });
    collision.addCircle(x, z, 0.14, 2);
  }
  const wires = new Map();
  for (const list of byRoad.values()) {
    list.sort((a, b) => a.d - b.d);
    for (let k = 0; k < list.length; k++) {
      const a = list[k];
      const nb = list[k + 1];
      const dirx = nb ? nb.x - a.x : 1, dirz = nb ? nb.z - a.z : 0;
      poleSet.add(a.x, a.z, compose(a.x, 0.15, a.z, yawX(-dirz, dirx)));
      if (!nb) continue;
      const L = Math.hypot(nb.x - a.x, nb.z - a.z);
      if (L > 55) continue;
      const ci = chunks.chunkOf(a.x, a.z);
      if (ci < 0) continue;
      if (!wires.has(ci)) wires.set(ci, []);
      const arr = wires.get(ci);
      const ux = -(nb.z - a.z) / L, uz = (nb.x - a.x) / L;
      for (const o of [-0.7, -0.25, 0.25, 0.7, 0.0]) {
        const y0 = o === 0 ? 6.4 : 8.08;
        const sag = 0.35 + L * 0.012 + (o === 0 ? 0.4 : 0);
        let px = a.x + ux * o, pz = a.z + uz * o, py = y0 + 0.15;
        for (let s = 1; s <= 6; s++) {
          const t = s / 6;
          const qx = a.x + (nb.x - a.x) * t + ux * o, qz = a.z + (nb.z - a.z) * t + uz * o;
          const qy = y0 + 0.15 - 4 * sag * t * (1 - t);
          arr.push(px, py, pz, qx, qy, qz);
          px = qx; py = qy; pz = qz;
        }
      }
    }
  }
  const wireMat = new THREE.LineBasicMaterial({ color: 0x141414 });
  for (const [ci, arr] of wires) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    chunks.add(ci, new THREE.LineSegments(g, wireMat), 'detail');
  }

  // --- signals: poles + bulbs (bulb states driven by traffic)
  const sigSet = new InstancedSet(scene, P.signal, mats.prop, Math.max(1, M.signals.length), q.propRange * 1.5, { cast: q.shadows });
  sets.push(sigSet);
  const bulbMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const bulbs = new THREE.InstancedMesh(P.bulb, bulbMat, Math.max(1, M.signals.length * 3));
  bulbs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(M.signals.length * 3 * 3 + 3), 3);
  bulbs.frustumCulled = false;
  scene.add(bulbs);
  W.signalHeads = [];
  let bi = 0;
  for (const s of M.signals) {
    const x = s[0] / 100, z = s[1] / 100, a = s[2];
    const dx = Math.cos(a), dz = Math.sin(a);       // facing oncoming traffic
    sigSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)));
    collision.addCircle(x, z, 0.14, 2);
    const head = { node: s[3], x, z, dx, dz, bulbs: [] };
    for (let k = 0; k < 3; k++) {
      const m = compose(x + dx * 0.24, 0.15 + 3.55 - k * 0.3, z + dz * 0.24, Math.atan2(dx, dz));
      bulbs.setMatrixAt(bi, m);
      head.bulbs.push(bi++);
    }
    W.signalHeads.push(head);
  }
  bulbs.count = bi;
  W.signalBulbs = bulbs;

  // --- static per-chunk props: bus shelters, stalls, boards, banners, walls, metro
  const cbs = new Map(), sbs = new Map(), gbs = new Map(), fbs = new Map();
  const CB = (ci) => { let b = cbs.get(ci); if (!b) cbs.set(ci, b = new ColorBuilder()); return b; };
  const SB = (ci) => { let b = sbs.get(ci); if (!b) sbs.set(ci, b = new QuadBuilder()); return b; };
  const GBf = (ci) => { let b = gbs.get(ci); if (!b) gbs.set(ci, b = new GroundBuilder()); return b; };
  const FBf = (ci) => { let b = fbs.get(ci); if (!b) fbs.set(ci, b = new FacadeBuilder()); return b; };
  const mm = new THREE.Matrix4();

  for (const b of M.buses) {
    const x = b[0] / 100, z = b[1] / 100, a = b[2];
    const ci = chunks.chunkOf(x, z); if (ci < 0) continue;
    const dx = Math.cos(a), dz = Math.sin(a);
    // shelter's open side faces the road: local -z is the back panel
    const ry = Math.atan2(dx, dz);
    CB(ci).addGeo(P.bus, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
    const s = signs.bus[0];
    const fx = Math.cos(ry), fz = -Math.sin(ry);
    const bx = x - Math.sin(ry) * 0.0, bz = z;
    SB(ci).quad([x - fx * 1.1, 2.75, z - fz * 1.1], [x + fx * 1.1, 2.75, z + fz * 1.1], [x + fx * 1.1, 3.3, z + fz * 1.1], [x - fx * 1.1, 3.3, z - fz * 1.1],
      [Math.sin(ry), 0, Math.cos(ry)], s.u0, s.v0, s.u1, s.v1);
    collision.addCircle(x, z, 0.9, 2);
  }
  for (const s of M.stalls) {
    const x = s[0] / 100, z = s[1] / 100, a = s[2], t = s[3];
    const ci = chunks.chunkOf(x, z); if (ci < 0) continue;
    const proto = P['stall' + t] || P.stall0;
    // front of stall (+z local) faces the road direction a
    CB(ci).addGeo(proto, compose(x, 0.15, z, Math.atan2(Math.cos(a), Math.sin(a)), 1, 1, 1, 0, 0, mm), [1, 1, 1]);
    collision.addCircle(x, z, 0.9, 2);
    if (t === 0 && rng.chance(0.6)) {
      // banner on the tapri
      const sh = signs.shops[rng.int(0, 2)];
      const ry = Math.atan2(Math.cos(a), Math.sin(a));
      const fx = Math.cos(ry), fz = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry);
      const cx = x + nx * 0.6, cz = z + nz * 0.6;
      SB(ci).quad([cx - fx * 1.1, 1.75, cz - fz * 1.1], [cx + fx * 1.1, 1.75, cz + fz * 1.1], [cx + fx * 1.1, 2.3, cz + fz * 1.1], [cx - fx * 1.1, 2.3, cz - fz * 1.1],
        [nx, 0, nz], sh.u0, sh.v0, sh.u1, sh.v1);
    }
  }

  // street name boards + banners at main junctions
  const STREET_IDX = { 'FC Road': 0, 'JM Road': 1, 'Karve Road': 2, 'Prabhat Road': 3, 'Bhandarkar Road': 4, 'Ghole Road': 5, 'Apte Road': 6,
    'Tilak Road': 7, 'Laxmi Road': 8, 'Ganeshkhind Road': 9, 'Lakdi Pul (Sambhaji Bridge)': 12 };
  const tmp = [0, 0, 0, 0];
  let banners = 0;
  for (const n of W.graph.nodes) {
    if (n.deg < 3 || n.maxRank < 3 || n.portal) continue;
    // pick the highest ranked incident edge with a known name
    let best = null;
    for (const l of [...n.out, ...n.inc]) {
      const nm = W.graph.names[l.e.name]?.[0];
      if (nm && STREET_IDX[nm] !== undefined && (!best || l.e.rank > best.e.rank)) best = l;
    }
    if (best && rng.chance(0.7)) {
      const e = best.e;
      const fromA = e.a === n.i;
      W.graph.at(e, fromA ? Math.min(e.len, n.jr + 4) : Math.max(0, e.len - n.jr - 4), tmp);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = e.w / 2 + Math.max(0.8, e.sw * 0.5);
      const x = tmp[0] + tmp[3] * off * side, z = tmp[1] - tmp[2] * off * side;
      const ci = chunks.chunkOf(x, z);
      if (ci >= 0 && !W.surf.isRoad(x, z)) {
        const fx = fromA ? -tmp[2] : tmp[2], fz = fromA ? -tmp[3] : tmp[3];   // face traffic coming toward the junction
        const ry = Math.atan2(-fx, -fz);
        CB(ci).addGeo(P.streetBoard, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
        const s = signs.streets[STREET_IDX[W.graph.names[e.name][0]]];
        const ux = Math.cos(ry), uz = -Math.sin(ry), nx = -fx, nz = -fz;
        const cx = x + nx * 0.0, cz = z + nz * 0.0;
        const ltr = (ux * nz - uz * nx) > 0;
        SB(ci).quad([cx - ux * 1.22, 2.23, cz - uz * 1.22], [cx + ux * 1.22, 2.23, cz + uz * 1.22], [cx + ux * 1.22, 2.87, cz + uz * 1.22], [cx - ux * 1.22, 2.87, cz - uz * 1.22],
          [nx, 0, nz], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
        collision.addCircle(x, z, 0.12, 2);
      }
    }
    if ((n.signal || rng.chance(0.15)) && banners < 80) {
      const l = n.out[0] || n.inc[0];
      if (!l) continue;
      const e = l.e;
      const fromA = e.a === n.i;
      W.graph.at(e, fromA ? Math.min(e.len, n.jr + 7) : Math.max(0, e.len - n.jr - 7), tmp);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = e.w / 2 + Math.max(1.0, e.sw * 0.6);
      const x = tmp[0] + tmp[3] * off * side, z = tmp[1] - tmp[2] * off * side;
      const ci = chunks.chunkOf(x, z);
      if (ci < 0 || W.surf.isRoad(x, z)) continue;
      const fx = fromA ? -tmp[2] : tmp[2], fz = fromA ? -tmp[3] : tmp[3];
      const ry = Math.atan2(-fx, -fz);
      CB(ci).addGeo(P.bannerFrame, compose(x, 0.15, z, ry, 1, 1, 1, 0, 0, mm), [1, 1, 1]);
      const s = signs.banners[rng.int(0, signs.banners.length - 1)];
      const ux = Math.cos(ry), uz = -Math.sin(ry), nx = -fx, nz = -fz;
      const ltr = (ux * nz - uz * nx) > 0;
      SB(ci).quad([x - ux * 1.65, 1.9, z - uz * 1.65], [x + ux * 1.65, 1.9, z + uz * 1.65], [x + ux * 1.65, 2.9, z + uz * 1.65], [x - ux * 1.65, 2.9, z - uz * 1.65],
        [nx, 0, nz], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
      // back side (plain) so it isn't see-through
      SB(ci).quad([x - ux * 1.65, 1.9, z - uz * 1.65], [x + ux * 1.65, 1.9, z + uz * 1.65], [x + ux * 1.65, 2.9, z + uz * 1.65], [x - ux * 1.65, 2.9, z - uz * 1.65],
        [-nx, 0, -nz], s.u0, s.v0, s.u0 + 0.001, s.v0 + 0.001);
      banners++;
    }
  }

  // compound walls: plaster + coping + gate pillars
  const WALL_PAL = [[0.96, 0.92, 0.8], [0.98, 0.88, 0.6], [0.95, 0.8, 0.78], [0.85, 0.85, 0.82], [0.8, 0.88, 0.94], [0.97, 0.97, 0.94], [0.9, 0.75, 0.5]];
  const wallH = 1.65, base = 0.15;
  for (const w of M.walls) {
    const p = cmRing(w);
    const ci = chunks.chunkOf(p[0], p[1]); if (ci < 0) continue;
    const fb = FBf(ci);
    const tint = WALL_PAL[Math.floor(hash1(w[0] + w[1]) * WALL_PAL.length)];
    const seed = hash1(w[0]);
    let u = 0;
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.05) continue;
      const nx = (bz - az) / L, nz = -(bx - ax) / L;
      const t = 0.1;
      fb.quad(ax + nx * t, az + nz * t, bx + nx * t, bz + nz * t, base, base + wallH, nx, nz, u / 3, (u + L) / 3, 0, 1, F.cwall, tint, seed);
      fb.quad(ax - nx * t, az - nz * t, bx - nx * t, bz - nz * t, base, base + wallH, -nx, -nz, u / 3, (u + L) / 3, 0, 1, F.cwall, tint, seed);
      // coping
      const y = base + wallH;
      const c0 = fb.v(ax + nx * 0.14, y, az + nz * 0.14, 0, 1, 0, 0, 0, F.parapet, tint, seed);
      const c1 = fb.v(bx + nx * 0.14, y, bz + nz * 0.14, 0, 1, 0, L / 3, 0, F.parapet, tint, seed);
      const c2 = fb.v(bx - nx * 0.14, y, bz - nz * 0.14, 0, 1, 0, L / 3, 0.05, F.parapet, tint, seed);
      const c3 = fb.v(ax - nx * 0.14, y, az - nz * 0.14, 0, 1, 0, 0, 0.05, F.parapet, tint, seed);
      const cy = ((bz + nz * 0.14) - (az + nz * 0.14)) * ((ax - nx * 0.14) - (ax + nx * 0.14)) - ((bx + nx * 0.14) - (ax + nx * 0.14)) * ((az - nz * 0.14) - (az + nz * 0.14));
      if (cy >= 0) fb.i.push(c0, c1, c2, c0, c2, c3); else fb.i.push(c0, c2, c1, c0, c3, c2);
      u += L;
      collision.addSeg(ax, az, bx, bz, 5);
    }
    // gate pillars at both ends
    const ends = [[p[0], p[1], p[2], p[3]], [p[p.length - 2], p[p.length - 1], p[p.length - 4], p[p.length - 3]]];
    for (const [ex, ez, ox, oz] of ends) {
      const L = Math.hypot(ox - ex, oz - ez) || 1;
      const dx = (ox - ex) / L, dz = (oz - ez) / L;
      const cx = ex + dx * 0.2, cz = ez + dz * 0.2;
      const r = 0.22;
      const sq = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([a, b]) => [cx + dx * a - dz * b, cz + dz * a + dx * b]);
      for (let k = 0; k < 4; k++) {
        const [ax, az] = sq[k], [bx, bz] = sq[(k + 1) % 4];
        const L2 = Math.hypot(bx - ax, bz - az) || 1;
        let nx = (bz - az) / L2, nz = -(bx - ax) / L2;
        if ((ax + bx) / 2 * 0 + nx * ((ax + bx) / 2 - cx) + nz * ((az + bz) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
        fb.quad(ax, az, bx, bz, base, base + wallH + 0.35, nx, nz, 0, 0.15, 0, 1.1, F.cwall, tint.map(v => v * 0.92), seed);
      }
      fb.poly([[sq[0][0], sq[0][1], sq[1][0], sq[1][1], sq[2][0], sq[2][1], sq[3][0], sq[3][1]]], base + wallH + 0.35, F.parapet, 1, tint, seed);
    }
  }

  // metro viaduct (Line 2 operational, Line 3 under construction)
  const piers = [];
  for (const [constr, line] of M.metro) {
    const p = cmRing(line);
    const L = polyLength(p);
    if (L < 20) continue;
    const deckTop = 12.6, deckBot = 11.2;
    // deck pieces
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k], az = p[k + 1], bx = p[k + 2], bz = p[k + 3];
      const sl = Math.hypot(bx - ax, bz - az);
      if (sl < 0.2) continue;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (constr === 1 && hash1(Math.round(mx) * 7 + Math.round(mz)) < 0.35) continue;   // gaps on the line under construction
      const ci = chunks.chunkOf(mx, mz); if (ci < 0) continue;
      const g = GBf(ci);
      const nx = (bz - az) / sl, nz = -(bx - ax) / sl;
      const hw = 2.5, bw = 1.5;
      // sides (trapezoid girder), top, bottom, parapets
      const seg = (o0, y0, o1, y1, face) => {
        const v0 = g.v(ax + nx * o0, y0, az + nz * o0, nx * face, 0.0, nz * face, 0, 0, G.deck, 0.9);
        const v1 = g.v(bx + nx * o0, y0, bz + nz * o0, nx * face, 0.0, nz * face, sl / 6, 0, G.deck, 0.9);
        const v2 = g.v(bx + nx * o1, y1, bz + nz * o1, nx * face, 0.0, nz * face, sl / 6, 0.4, G.deck, 0.9);
        const v3 = g.v(ax + nx * o1, y1, az + nz * o1, nx * face, 0.0, nz * face, 0, 0.4, G.deck, 0.9);
        // winding: compare with face direction
        const cx = -(bz - az), cz = (bx - ax);
        if ((cx * nx + cz * nz) * face >= 0) g.i.push(v0, v1, v2, v0, v2, v3); else g.i.push(v0, v2, v1, v0, v3, v2);
      };
      seg(bw, deckBot, hw, deckTop, 1); seg(-bw, deckBot, -hw, deckTop, -1);
      seg(hw, deckTop, hw, deckTop + 1.3, 1); seg(-hw, deckTop, -hw, deckTop + 1.3, -1);
      g.poly([[ax + nx * bw, az + nz * bw, bx + nx * bw, bz + nz * bw, bx - nx * bw, bz - nz * bw, ax - nx * bw, az - nz * bw]], deckBot, G.deck, 6, 0.6, true);
      g.poly([[ax + nx * hw, az + nz * hw, bx + nx * hw, bz + nz * hw, bx - nx * hw, bz - nz * hw, ax - nx * hw, az - nz * hw]], deckTop + 0.02, G.deck, 6, 0.75);
    }
    // piers every ~28 m (skip if the twin track already has one close by)
    walkLine(p, 28, (x, z, dx, dz) => {
      for (const q2 of piers) if (Math.hypot(q2[0] - x, q2[1] - z) < 9) return;
      piers.push([x, z]);
      const ci = chunks.chunkOf(x, z); if (ci < 0) return;
      const g = GBf(ci);
      const cyl = 0.9;
      const N = 10;
      const ring = [];
      for (let k = 0; k <= N; k++) ring.push(x + Math.cos(k / N * 6.283) * cyl, z + Math.sin(k / N * 6.283) * cyl);
      g.wall(ring, 0, 11.0, G.deck, 3, 4, -1, 0.92);
      g.box(x, 10.2, z, 6.5, 1.2, 2.2, yawX(dz, -dx) * -1, G.deck, 3, 0.9);
      collision.addCircle(x, z, cyl + 0.1, 2);
    }, 10);
  }
  // metro stations: glassy boxes on the viaduct
  for (const [name, line] of M.mstations) {
    const p = cmRing(line);
    const L = polyLength(p);
    if (L < 40) continue;
    const ax = p[0], az = p[1], bx = p[p.length - 2], bz = p[p.length - 1];
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    const nx = dz, nz = -dx;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const ci = chunks.chunkOf(cx, cz); if (ci < 0) continue;
    const fb = FBf(ci);
    const hl = Math.min(70, L / 2 + 5), hw = 11;
    const corners = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([a, b]) => [cx + dx * a + nx * b, cz + dz * a + nz * b]);
    const tint = [0.95, 0.95, 0.97];
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % 4];
      const l = Math.hypot(x1 - x0, z1 - z0);
      let ox = (z1 - z0) / l, oz = -(x1 - x0) / l;
      if (ox * ((x0 + x1) / 2 - cx) + oz * ((z0 + z1) / 2 - cz) < 0) { ox = -ox; oz = -oz; }
      fb.quad(x0, z0, x1, z1, 8.5, 11.0, ox, oz, 0, l / 3, 0, 1, F.com2, tint, 0.3);
      fb.quad(x0, z0, x1, z1, 13.6, 18.5, ox, oz, 0, l / 3, 0, 1.6, F.glass0, tint, 0.3);
    }
    const ring = corners.flat();
    fb.poly([ring], 18.5, F.roof, 6, tint, 0.3);
    fb.poly([ring], 8.5, F.plain, 6, [0.6, 0.6, 0.6], 0.3, true);
    // name board
    const s = signs.metro;
    const sb = SB(ci);
    for (const side of [1, -1]) {
      const fx = cx + nx * (hw + 0.05) * side, fz = cz + nz * (hw + 0.05) * side;
      const ltr = (dx * nz * side - dz * nx * side) > 0;
      sb.quad([fx - dx * 9, 18.6, fz - dz * 9], [fx + dx * 9, 18.6, fz + dz * 9], [fx + dx * 9, 20.1, fz + dz * 9], [fx - dx * 9, 20.1, fz - dz * 9],
        [nx * side, 0, nz * side], ltr ? s.u0 : s.u1, s.v0, ltr ? s.u1 : s.u0, s.v1);
    }
  }

  for (const [ci, b] of cbs) if (!b.empty) { const m = new THREE.Mesh(b.build(), mats.prop); m.castShadow = q.shadows; m.receiveShadow = true; chunks.add(ci, m, 'detail'); }
  for (const [ci, b] of sbs) if (!b.empty) { const m = new THREE.Mesh(b.build(), mats.sign); m.receiveShadow = true; chunks.add(ci, m, 'detail'); }
  for (const [ci, b] of gbs) if (!b.empty) { const m = new THREE.Mesh(b.build(), mats.ground); m.castShadow = true; m.receiveShadow = true; chunks.add(ci, m); }
  for (const [ci, b] of fbs) if (!b.empty) { const m = new THREE.Mesh(b.build(), mats.facade); m.castShadow = q.shadows; m.receiveShadow = true; chunks.add(ci, m, 'detail'); }

  // playable boundary (soft wall)
  const pl = W.play;
  collision.addSeg(pl.x0, pl.z0, pl.x1, pl.z0, 3); collision.addSeg(pl.x1, pl.z0, pl.x1, pl.z1, 3);
  collision.addSeg(pl.x1, pl.z1, pl.x0, pl.z1, 3); collision.addSeg(pl.x0, pl.z1, pl.x0, pl.z0, 3);
  // river banks + bridge parapets block vehicles
  for (const [ci, line] of M.banks) collision.addLine(cmRing(line), 4);
  for (const [ci, line] of M.rails) collision.addLine(cmRing(line), 4);
}

export function updateProps(W, cx, cz, frustumTest) {
  for (const s of W.instSets) s.update(cx, cz, frustumTest);
}

InstancedSet.tag = 0;
