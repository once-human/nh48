// Trees: eight Pune street-tree species grown at load with ez-tree (MIT) using our own leaf atlas,
// three levels of detail — full branches + leaf cards near, a lighter build in the middle distance,
// and camera-facing impostors (albedo + normal rendered at load) out to the horizon. All instanced.
import * as THREE from 'three';
import { Tree } from '../../node_modules/@dgreenheck/ez-tree/src/lib/tree.js';
import TreeOptions from '../../node_modules/@dgreenheck/ez-tree/src/lib/options.js';
import { LEAF, makeLeafAtlas } from '../gfx/foliage.js';
import { U } from '../gfx/materials.js';
import { hash1 } from '../core/util.js';

const UP = { x: 0, y: 1, z: 0 };
// map tree kinds: 0 rain, 1 gulmohar, 2 peepal, 3 neem, 4 ashoka, 5 coconut, 6 banyan, 7 mango
export const SPECIES = [
  // rain tree: short trunk, huge limbs arcing out and down into a flat-topped umbrella
  { name: 'rain', leaf: LEAF.rain, H: 15, bark: 0xc4baa8, trunkR: 0.45,
    opts: { seed: 101, branch: { levels: 3, length: { 0: 15, 1: 24, 2: 12, 3: 5 }, radius: { 0: 2.4, 1: 0.62, 2: 0.6, 3: 0.6 },
      children: { 0: 7, 1: 5, 2: 4 }, angle: { 1: 70, 2: 50, 3: 38 }, start: { 1: 0.7, 2: 0.25, 3: 0.15 },
      sections: { 0: 6, 1: 8, 2: 5, 3: 3 }, segments: { 0: 10, 1: 6, 2: 4, 3: 3 }, taper: { 0: 0.5, 1: 0.6, 2: 0.7, 3: 0.75 },
      gnarliness: { 0: 0.03, 1: 0.12, 2: 0.2, 3: 0.12 }, twist: { 0: 0, 1: 0.15, 2: 0, 3: 0 }, force: { direction: UP, strength: -0.011 } },
      leaves: { count: 11, size: 3.6, sizeVariance: 0.3, angle: 40, start: 0.1 } } },
  // gulmohar: smaller umbrella, fine foliage
  { name: 'gulmohar', leaf: LEAF.gulmohar, H: 10, bark: 0xb8b0a2, trunkR: 0.3,
    opts: { seed: 202, branch: { levels: 3, length: { 0: 12, 1: 18, 2: 9, 3: 4 }, radius: { 0: 1.6, 1: 0.62, 2: 0.6, 3: 0.6 },
      children: { 0: 6, 1: 5, 2: 4 }, angle: { 1: 68, 2: 48, 3: 35 }, start: { 1: 0.5, 2: 0.2, 3: 0.15 },
      sections: { 0: 6, 1: 7, 2: 5, 3: 3 }, segments: { 0: 8, 1: 5, 2: 4, 3: 3 }, taper: { 0: 0.55, 1: 0.6, 2: 0.7, 3: 0.75 },
      gnarliness: { 0: 0.05, 1: 0.16, 2: 0.2, 3: 0.1 }, force: { direction: UP, strength: -0.012 } },
      leaves: { count: 10, size: 3.4, sizeVariance: 0.3, angle: 45, start: 0.1 } } },
  // peepal: tall rounded crown on a buttressed trunk
  { name: 'peepal', leaf: LEAF.peepal, H: 14, bark: 0xc0b6a6, trunkR: 0.5,
    opts: { seed: 303, branch: { levels: 3, length: { 0: 20, 1: 17, 2: 9, 3: 4 }, radius: { 0: 2.3, 1: 0.6, 2: 0.6, 3: 0.6 },
      children: { 0: 9, 1: 5, 2: 4 }, angle: { 1: 52, 2: 45, 3: 40 }, start: { 1: 0.32, 2: 0.2, 3: 0.15 },
      sections: { 0: 9, 1: 6, 2: 5, 3: 3 }, segments: { 0: 10, 1: 6, 2: 4, 3: 3 }, taper: { 0: 0.6, 1: 0.65, 2: 0.7, 3: 0.75 },
      gnarliness: { 0: 0.08, 1: 0.15, 2: 0.2, 3: 0.1 }, force: { direction: UP, strength: 0.002 } },
      leaves: { count: 10, size: 3.2, sizeVariance: 0.3, angle: 45, start: 0.15 } } },
  // neem: oval crown, dark furrowed trunk
  { name: 'neem', leaf: LEAF.neem, H: 11, bark: 0x9a9082, trunkR: 0.32,
    opts: { seed: 404, branch: { levels: 3, length: { 0: 16, 1: 15, 2: 8, 3: 4 }, radius: { 0: 1.7, 1: 0.6, 2: 0.6, 3: 0.6 },
      children: { 0: 8, 1: 5, 2: 4 }, angle: { 1: 48, 2: 42, 3: 38 }, start: { 1: 0.38, 2: 0.2, 3: 0.15 },
      sections: { 0: 8, 1: 6, 2: 5, 3: 3 }, segments: { 0: 8, 1: 5, 2: 4, 3: 3 }, taper: { 0: 0.65, 1: 0.65, 2: 0.7, 3: 0.75 },
      gnarliness: { 0: 0.06, 1: 0.16, 2: 0.2, 3: 0.12 }, force: { direction: UP, strength: 0.004 } },
      leaves: { count: 10, size: 3.1, sizeVariance: 0.3, angle: 50, start: 0.12 } } },
  // ashoka (Polyalthia): a narrow green column of drooping leaves
  { name: 'ashoka', leaf: LEAF.ashoka, H: 12, bark: 0x8a8076, trunkR: 0.2,
    opts: { seed: 505, type: 'evergreen', branch: { levels: 2, length: { 0: 40, 1: 6, 2: 2.5 }, radius: { 0: 0.9, 1: 0.35, 2: 0.5 },
      children: { 0: 55, 1: 3 }, angle: { 1: 100, 2: 40 }, start: { 1: 0.12, 2: 0.2 },
      sections: { 0: 12, 1: 3, 2: 2 }, segments: { 0: 7, 1: 3, 2: 3 }, taper: { 0: 0.9, 1: 0.7, 2: 0.7 },
      gnarliness: { 0: 0.0, 1: 0.08, 2: 0.08 }, force: { direction: UP, strength: 0.0 } },
      leaves: { count: 5, size: 3.0, sizeVariance: 0.25, angle: 25, start: 0.0 } } },
  null, // coconut palm: custom
  // banyan: massive, very wide, aerial roots
  { name: 'banyan', leaf: LEAF.banyan, H: 15, bark: 0xbdb3a3, trunkR: 1.0, roots: true,
    opts: { seed: 707, branch: { levels: 3, length: { 0: 14, 1: 28, 2: 12, 3: 5 }, radius: { 0: 3.4, 1: 0.6, 2: 0.6, 3: 0.6 },
      children: { 0: 8, 1: 5, 2: 4 }, angle: { 1: 74, 2: 52, 3: 40 }, start: { 1: 0.45, 2: 0.2, 3: 0.15 },
      sections: { 0: 6, 1: 9, 2: 5, 3: 3 }, segments: { 0: 12, 1: 6, 2: 4, 3: 3 }, taper: { 0: 0.5, 1: 0.6, 2: 0.7, 3: 0.75 },
      gnarliness: { 0: 0.05, 1: 0.12, 2: 0.18, 3: 0.12 }, force: { direction: UP, strength: -0.006 } },
      leaves: { count: 10, size: 3.6, sizeVariance: 0.3, angle: 40, start: 0.12 } } },
  // mango: dense dark dome
  { name: 'mango', leaf: LEAF.mango, H: 10, bark: 0x8e8478, trunkR: 0.35,
    opts: { seed: 808, branch: { levels: 3, length: { 0: 10, 1: 14, 2: 8, 3: 4 }, radius: { 0: 1.8, 1: 0.65, 2: 0.6, 3: 0.6 },
      children: { 0: 8, 1: 5, 2: 4 }, angle: { 1: 55, 2: 48, 3: 40 }, start: { 1: 0.5, 2: 0.2, 3: 0.15 },
      sections: { 0: 6, 1: 6, 2: 4, 3: 3 }, segments: { 0: 8, 1: 5, 2: 4, 3: 3 }, taper: { 0: 0.6, 1: 0.6, 2: 0.7, 3: 0.75 },
      gnarliness: { 0: 0.06, 1: 0.16, 2: 0.22, 3: 0.12 }, force: { direction: UP, strength: -0.004 } },
      leaves: { count: 11, size: 3.2, sizeVariance: 0.3, angle: 45, start: 0.1 } } },
];
const PALM = { name: 'coconut', leaf: LEAF.palm, H: 11, trunkR: 0.2 };

// a lighter build for the middle distance: one branch level less, bigger and fewer leaf cards
function midOptions(o) {
  const m = JSON.parse(JSON.stringify(o));
  const L = m.branch.levels;
  m.leaves.billboard = 'single';
  if (L >= 3) {
    m.branch.levels = L - 1;
    m.branch.length[L - 1] = (m.branch.length[L - 1] || 4) + (m.branch.length[L] || 0) * 0.6;
    m.leaves.count = Math.round(m.leaves.count * 1.3);
    m.leaves.size *= 1.7;
  } else {
    m.leaves.size *= 1.5; m.leaves.count = Math.max(2, Math.round(m.leaves.count * 0.8));
  }
  for (const k of Object.keys(m.branch.segments)) m.branch.segments[k] = Math.max(3, Math.round(m.branch.segments[k] * 0.6));
  for (const k of Object.keys(m.branch.sections)) m.branch.sections[k] = Math.max(2, Math.round(m.branch.sections[k] * 0.6));
  return m;
}

function grow(opts) {
  const o = new TreeOptions();
  o.copy(opts);
  o.bark.textured = false;
  if (!opts.leaves.billboard) o.leaves.billboard = 'double';
  const t = new Tree(o);
  t.generate();
  const b = t.branchesMesh.geometry, l = t.leavesMesh.geometry;
  t.branchesMesh.material.dispose(); t.leavesMesh.material.dispose();
  return { b, l };
}

// scale to height H (metres), remap leaf UVs into the atlas cell, give the leaves soft spherical
// normals around the crown and a wind weight; returns geometry pair + crown size
function finish(g, H, cellUV, roots) {
  const bb = new THREE.Box3().setFromBufferAttribute(g.b.attributes.position);
  bb.union(new THREE.Box3().setFromBufferAttribute(g.l.attributes.position));
  const s = H / Math.max(1e-3, bb.max.y);
  g.b.scale(s, s, s); g.l.scale(s, s, s);
  bb.min.multiplyScalar(s); bb.max.multiplyScalar(s);
  // bark uv: around x2, along: per section (ez-tree alternates 0/1)
  const buv = g.b.attributes.uv;
  for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) * 2, buv.getY(i) * 1.5);
  // clearance: drop leaf cards hanging below head height (street trees are pruned)
  clearUnder(g.l, Math.max(3.0, H * 0.24));
  const lp = g.l.attributes.position, luv = g.l.attributes.uv;
  const lb = new THREE.Box3().setFromBufferAttribute(lp);
  const c = lb.getCenter(new THREE.Vector3()), r = lb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const nrm = new Float32Array(lp.count * 3), wind = new Float32Array(lp.count);
  const pad = 0.004;
  for (let i = 0; i < lp.count; i++) {
    luv.setXY(i, cellUV.u0 + pad + luv.getX(i) * (cellUV.su - 2 * pad), cellUV.v0 + pad + luv.getY(i) * (cellUV.sv - 2 * pad));
    const x = (lp.getX(i) - c.x) / Math.max(0.5, r.x), y = (lp.getY(i) - c.y) / Math.max(0.5, r.y) + 0.35, z = (lp.getZ(i) - c.z) / Math.max(0.5, r.z);
    const L = Math.hypot(x, y, z) || 1;
    nrm[i * 3] = x / L; nrm[i * 3 + 1] = y / L; nrm[i * 3 + 2] = z / L;
    wind[i] = Math.min(1, Math.max(0, lp.getY(i) / H));
  }
  // crown self-shadowing: cards near the crown core and low in the crown are darker
  const col = new Float32Array(lp.count * 3);
  for (let i = 0; i < lp.count; i += 4) {
    let mx = 0, my = 0, mz = 0;
    for (let k = 0; k < 4 && i + k < lp.count; k++) { mx += lp.getX(i + k) / 4; my += lp.getY(i + k) / 4; mz += lp.getZ(i + k) / 4; }
    const rr = Math.hypot((mx - c.x) / Math.max(0.5, r.x), (my - c.y) / Math.max(0.5, r.y), (mz - c.z) / Math.max(0.5, r.z));
    const hy = (my - lb.min.y) / Math.max(0.5, lb.max.y - lb.min.y);
    const ao = (0.5 + 0.5 * Math.min(1, Math.max(0, (rr - 0.25) / 0.75))) * (0.82 + 0.18 * hy);
    for (let k = 0; k < 4 && i + k < lp.count; k++) { const y = lp.getY(i + k); const g2 = ao * (0.94 + 0.06 * Math.min(1, (y - my + 1) / 2)); col.set([g2, g2, g2], (i + k) * 3); }
  }
  g.l.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.l.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.l.setAttribute('wind', new THREE.BufferAttribute(wind, 1));
  g.crownLow = lb.min.y + (lb.max.y - lb.min.y) * 0.15;
  pruneLow(g.b, Math.max(2.6, H * 0.2), 1.4);
  if (roots) addRoots(g, bb, H);
  const bw = new Float32Array(g.b.attributes.position.count);
  for (let i = 0; i < bw.length; i++) bw[i] = Math.min(1, Math.max(0, g.b.attributes.position.getY(i) / H - 0.25)) * 0.5;
  g.b.setAttribute('wind', new THREE.BufferAttribute(bw, 1));
  g.b.computeBoundingSphere(); g.l.computeBoundingSphere();
  return { b: g.b, l: g.l, W: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), H: bb.max.y, cx: (bb.max.x + bb.min.x) / 2 };
}

function clearUnder(geo, minY) {
  const p = geo.attributes.position, idx = geo.index.array;
  const keep = [];
  for (let t = 0; t < idx.length; t += 6) {
    let cy = 0;
    for (let k = 0; k < 6; k++) cy += p.getY(idx[t + k]) / 6;
    if (cy >= minY) for (let k = 0; k < 6; k++) keep.push(idx[t + k]);
  }
  geo.setIndex(keep);
}

// remove limb triangles that hang below head height away from the trunk
function pruneLow(geo, minY, trunkClear) {
  const p = geo.attributes.position, idx = geo.index.array;
  const keep = [];
  for (let t = 0; t < idx.length; t += 3) {
    let cy = 0, cx = 0, cz = 0;
    for (let k = 0; k < 3; k++) { cy += p.getY(idx[t + k]) / 3; cx += p.getX(idx[t + k]) / 3; cz += p.getZ(idx[t + k]) / 3; }
    if (cy < minY && Math.hypot(cx, cz) > trunkClear) continue;
    keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  geo.setIndex(keep);
}

// banyan aerial roots: thin vertical columns hanging from the outer limbs
function addRoots(g, bb, H) {
  const parts = [g.b];
  for (let k = 0; k < 14; k++) {
    const a = hash1(k * 13.1) * Math.PI * 2, rr = (0.25 + hash1(k * 7.7) * 0.5) * (bb.max.x - bb.min.x) * 0.45;
    const h = Math.max(2.5, (g.crownLow || H * 0.4) + hash1(k * 3.3) * 1.2);
    const cyl = new THREE.CylinderGeometry(0.04 + hash1(k) * 0.08, 0.06 + hash1(k) * 0.1, h, 4, 1, true);
    cyl.translate(Math.cos(a) * rr, h / 2, Math.sin(a) * rr);
    cyl.deleteAttribute('uv'); cyl.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cyl.attributes.position.count * 2), 2));
    parts.push(cyl);
  }
  const merged = mergeSimple(parts);
  g.b.dispose();
  g.b = merged;
}
function mergeSimple(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), I = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    P.set(g.attributes.position.array.subarray(0, n * 3), ov * 3);
    N.set(g.attributes.normal.array.subarray(0, n * 3), ov * 3);
    if (g.attributes.uv) UV.set(g.attributes.uv.array.subarray(0, n * 2), ov * 2);
    if (g.index) for (let k = 0; k < g.index.count; k++) I[oi++] = g.index.array[k] + ov;
    else for (let k = 0; k < n; k++) I[oi++] = ov + k;
    ov += n;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(P, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  m.setIndex(new THREE.BufferAttribute(I, 1));
  return m;
}

// coconut palm: leaning, ringed trunk + 16 arched fronds textured with the frond cell
function growPalm(cellUV, lod) {
  const H = PALM.H, segs = lod ? 6 : 12, sides = lod ? 5 : 8;
  const lean = 1.2;
  const tp = [], tn = [], tuv = [], ti = [];
  const spine = (t) => [lean * t * t, H * t, 0];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, [x, y, z] = spine(t);
    const r = PALM.trunkR * (1.25 - 0.3 * t) * (i === 0 ? 1.3 : 1);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      tp.push(x + Math.cos(a) * r, y, z + Math.sin(a) * r); tn.push(Math.cos(a), 0, Math.sin(a)); tuv.push(j / sides, t * H / 0.8);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    ti.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const b = new THREE.BufferGeometry();
  b.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); b.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3));
  b.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2)); b.setIndex(ti);
  b.setAttribute('wind', new THREE.BufferAttribute(new Float32Array(tp.length / 3).map((_, i) => tp[i * 3 + 1] / H * 0.3), 1));
  const [hx, hy, hz] = spine(1);
  const lp = [], ln = [], luv = [], li = [], lw = [];
  const fronds = lod ? 12 : 20, fs = lod ? 5 : 10;
  for (let f = 0; f < fronds; f++) {
    const a = f / fronds * Math.PI * 2 + hash1(f * 3.1) * 0.3;
    const len = 5.4 + hash1(f * 5.3) * 1.4;
    const rise = f % 4 === 0 ? 1.1 : f % 4 === 1 ? 0.7 : 0.35;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    const base = lp.length / 3;
    for (let k = 0; k <= fs; k++) {
      const t = k / fs;
      const d = len * t, y = hy + rise * Math.sin(t * Math.PI * 0.7) * 1.6 - t * t * 2.6;
      const w = 1.25 * Math.sin(Math.PI * Math.min(1, 0.12 + t)) + 0.15;
      const cx = hx + dx * d, cz = hz + dz * d;
      lp.push(cx - px * w, y - 0.1 * w, cz - pz * w, cx + px * w, y - 0.1 * w, cz + pz * w);
      const ny = 1, nx = dx * 0.3, nz = dz * 0.3, L = Math.hypot(nx, ny, nz);
      ln.push(nx / L, ny / L, nz / L, nx / L, ny / L, nz / L);
      luv.push(cellUV.u0 + 0.004 + t * (cellUV.su - 0.008), cellUV.v0 + 0.004, cellUV.u0 + 0.004 + t * (cellUV.su - 0.008), cellUV.v0 + cellUV.sv - 0.004);
      lw.push(t, t);
      if (k < fs) { const v = base + k * 2; li.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); }
    }
  }
  const l = new THREE.BufferGeometry();
  l.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); l.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3));
  l.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2)); l.setAttribute('wind', new THREE.Float32BufferAttribute(lw, 1)); l.setIndex(li);
  l.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(lp.length).fill(1), 3));
  b.computeBoundingSphere(); l.computeBoundingSphere();
  return { b, l, W: 13, H: H + 1.6, cx: lean };
}

// ---------------------------------------------------------------- materials
function windPatch(mat, key, leaves) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; attribute float wind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
        #else
          float ph = 0.0;
        #endif
        float sw = wind * uWind;
        transformed.x += (sin(uTime * 1.1 + ph) * 0.18 + sin(uTime * 2.7 + ph * 1.7 + position.y * 0.5) * 0.06) * sw;
        transformed.z += (cos(uTime * 0.9 + ph * 1.3) * 0.14) * sw;
        ${leaves ? 'transformed += normal * sin(uTime * 4.0 + ph + position.x * 2.0 + position.z * 1.7) * 0.04 * sw;' : ''}`);
    if (leaves) {
      // keep the soft crown normals on both faces; a little light bleeding through the leaves
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
        'float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.06;');
    }
  };
  mat.customProgramCacheKey = () => 'nh-tree-' + key;
  return mat;
}

// ---------------------------------------------------------------- impostors
function renderImpostors(renderer, arch, mats, cell = 256) {
  const n = arch.length;
  const opts = { type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
  const rtA = new THREE.WebGLRenderTarget(cell * n, cell, opts);
  const rtN = new THREE.WebGLRenderTarget(cell * n, cell, opts);
  rtA.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const albedoLeaf = new THREE.MeshBasicMaterial({ map: mats.leafMap, alphaTest: 0.45, side: THREE.DoubleSide });
  const nrmMat = (map) => new THREE.ShaderMaterial({
    uniforms: { map: { value: map } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; varying vec3 vN; varying vec2 vUv; void main(){ ${map ? 'if (texture2D(map, vUv).a < 0.45) discard;' : ''} gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, 1.0); }`,
  });
  const nrmBark = nrmMat(null), nrmLeaf = nrmMat(mats.leafMap);
  const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.autoClear;
  const prevVP = renderer.getViewport(new THREE.Vector4()), prevSC = renderer.getScissor(new THREE.Vector4()), prevST = renderer.getScissorTest();
  renderer.autoClear = false;
  const cams = [];
  for (const pass of ['a', 'n']) {
    renderer.setRenderTarget(pass === 'a' ? rtA : rtN);
    renderer.setClearColor(pass === 'a' ? new THREE.Color(0.16, 0.22, 0.1) : new THREE.Color(0.5, 0.5, 1.0), 0);
    renderer.clear(true, true, true);
    arch.forEach((A, i) => {
      const g = A.near;
      const barkA = pass === 'a' ? new THREE.MeshBasicMaterial({ map: A.palm ? mats.palmMap : mats.barkMap, color: A.bark || 0xffffff }) : nrmBark;
      const mb = new THREE.Mesh(g.b, barkA), ml = new THREE.Mesh(g.l, pass === 'a' ? albedoLeaf : nrmLeaf);
      scene.add(mb, ml);
      const half = Math.max(A.W, A.H) / 2 * 1.04;
      const cam = new THREE.OrthographicCamera(-half, half, A.H * 1.02, A.H * 1.02 - 2 * half, 0.1, 200);
      cam.position.set(A.cx || 0, 0, 80); cam.lookAt(A.cx || 0, 0, 0);
      cam.position.y = 0; cam.updateMatrixWorld();
      cams[i] = { half, top: A.H * 1.02 };
      renderer.setViewport(i * cell, 0, cell, cell);
      renderer.setScissor(i * cell, 0, cell, cell);
      renderer.setScissorTest(true);
      renderer.render(scene, cam);
      scene.remove(mb, ml);
      if (pass === 'a') barkA.dispose();
    });
  }
  renderer.setRenderTarget(prevRT);
  renderer.setViewport(prevVP); renderer.setScissor(prevSC); renderer.setScissorTest(prevST);
  renderer.setClearColor(prevClear, prevAlpha);
  renderer.autoClear = prevAuto;
  rtA.texture.needsUpdate = true;
  return { albedo: rtA.texture, normal: rtN.texture, frames: cams, rtA, rtN };
}

function billboardMaterial(imp, n, sizes) {
  const m = new THREE.MeshStandardMaterial({ map: imp.albedo, normalMap: imp.normal, alphaTest: 0.45, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCells = { value: n };
    sh.uniforms.uSizes = { value: sizes };     // per species: half width, bottom, top (in metres)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute float aCell; uniform float uCells; uniform vec3 uSizes[8];`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = vec2((aCell + uv.x) / uCells, uv.y);
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv = vec2((aCell + uv.x) / uCells, uv.y);
      #endif`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 0.0, 1.0);')
      .replace('#include <project_vertex>', `
        vec3 iC = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float iS = length(instanceMatrix[0].xyz);
        vec3 toCam = cameraPosition - iC; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-4, 0.0, 0.0));
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
        vec3 sz = uSizes[int(aCell + 0.5)];
        vec3 wp = iC + right * (position.x * 2.0 * sz.x * iS) + vec3(0.0, 1.0, 0.0) * mix(sz.y, sz.z, position.y) * iS;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <defaultnormal_vertex>', `
        vec3 iC0 = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 tc = cameraPosition - iC0; tc.y = 0.0; tc = normalize(tc + vec3(1e-4, 0.0, 0.0));
        vec3 transformedNormal = normalize((viewMatrix * vec4(tc, 0.0)).xyz);`)
      .replace('#include <worldpos_vertex>', '')
      .replace('#include <shadowmap_vertex>', '');
  };
  m.customProgramCacheKey = () => 'nh-tree-billboard';
  return m;
}

// ---------------------------------------------------------------- field
// archetypes + materials + impostors (shared by the field and the tree lab view)
export function createTreeKit(renderer, quality, tex) {
  const atlas = makeLeafAtlas(quality.leafCell || 512);
  const barkMap = tex.bark, palmMap = tex.palm;
  const mats = { leafMap: atlas.tex, barkMap, palmMap };
  const arch = [];
  for (let k = 0; k < 8; k++) {
    const S = SPECIES[k];
    const cell = atlas.uv(S ? S.leaf : PALM.leaf);
    if (!S) {
      const near = growPalm(cell, 0), mid = growPalm(cell, 1);
      arch[k] = { name: PALM.name, palm: true, near, mid, W: near.W, H: near.H, cx: near.cx, trunkR: PALM.trunkR, bark: 0xb0a490 };
      continue;
    }
    const near = finish(grow(S.opts), S.H, cell, S.roots);
    const mid = finish(grow(midOptions(S.opts)), S.H, cell, S.roots);
    arch[k] = { name: S.name, near, mid, W: near.W, H: near.H, cx: near.cx, trunkR: S.trunkR, bark: S.bark };
  }
  const bark = (map, key) => windPatch(new THREE.MeshStandardMaterial({ map, normalMap: tex.barkN || null, roughness: 0.92, metalness: 0 }), key, false);
  const barkMats = arch.map((A) => { const m = bark(A.palm ? palmMap : barkMap, 'bark'); m.color.setHex(A.bark); return m; });
  const leafMat = windPatch(new THREE.MeshStandardMaterial({ map: atlas.tex, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.78, metalness: 0 }), 'leaf', true);
  const imp = renderImpostors(renderer, arch, mats, quality.impostorCell || 256);
  const sizes = arch.map((A, i) => new THREE.Vector3(imp.frames[i].half, imp.frames[i].top - 2 * imp.frames[i].half, imp.frames[i].top));
  const bbMat = billboardMaterial(imp, 8, sizes);
  return { atlas, arch, barkMats, leafMat, imp, bbMat };
}

export class TreeField {
  constructor(W, scene, renderer, quality, tex) {
    this.W = W; this.q = quality;
    const kit = createTreeKit(renderer, quality, tex);
    Object.assign(this, kit);
    // per-tree data, bucketed in a 64 m grid
    const T = W.M.trees;
    const n = T.length;
    this.n = n;
    this.x = new Float32Array(n); this.z = new Float32Array(n); this.k = new Uint8Array(n); this.s = new Float32Array(n); this.r = new Float32Array(n);
    this.cell = 64;
    this.grid = new Map();
    const counts = new Array(8).fill(0);
    for (let i = 0; i < n; i++) {
      const t = T[i];
      const x = t[0] / 100, z = t[1] / 100, k = t[2];
      this.x[i] = x; this.z[i] = z; this.k[i] = k; this.s[i] = t[3] * (0.85 + hash1(i * 1.7) * 0.3); this.r[i] = hash1(t[0] * 7 + t[1]) * 6.283;
      counts[k]++;
      const key = Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell);
      let l = this.grid.get(key); if (!l) this.grid.set(key, l = []); l.push(i);
      W.collision.addCircle(x, z, this.arch[k].trunkR * this.s[i] + 0.1, 1);
    }
    // instanced meshes
    const mk = (geo, mat, cap, cast) => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, cap));
      m.count = 0; m.frustumCulled = false; m.castShadow = cast; m.receiveShadow = true;
      scene.add(m); return m;
    };
    const capNear = quality.treeNearCap || 260, capMid = quality.treeMidCap || 1600;
    this.sets = this.arch.map((A, k) => ({
      nb: mk(A.near.b, this.barkMats[k], Math.min(counts[k], capNear), quality.shadows),
      nl: mk(A.near.l, this.leafMat, Math.min(counts[k], capNear), quality.shadows),
      mb: mk(A.mid.b, this.barkMats[k], Math.min(counts[k], capMid), quality.shadows),
      ml: mk(A.mid.l, this.leafMat, Math.min(counts[k], capMid), quality.shadows),
    }));
    const quad = new THREE.PlaneGeometry(1, 1, 1, 1);
    quad.translate(0, 0.5, 0);
    const capFar = Math.min(n, quality.treeFarCap || 9000);
    this.bb = new THREE.InstancedMesh(quad, this.bbMat, capFar);
    this.bbCell = new THREE.InstancedBufferAttribute(new Float32Array(capFar), 1);
    quad.setAttribute('aCell', this.bbCell);
    this.bb.count = 0; this.bb.frustumCulled = false; this.bb.castShadow = false; this.bb.receiveShadow = false;
    scene.add(this.bb);
    this.nearR = quality.treeNearRange || 55; this.midR = quality.treeMidRange || 170; this.farR = quality.treeFarRange || 900;
    this.m4 = new THREE.Matrix4(); this.q4 = new THREE.Quaternion(); this.v3 = new THREE.Vector3(); this.s3 = new THREE.Vector3(); this.e3 = new THREE.Euler();
    this.lastX = 1e9; this.lastZ = 1e9;
  }
  update(cx, cz, force = false) {
    if (!force && Math.hypot(cx - this.lastX, cz - this.lastZ) < 3) return;
    this.lastX = cx; this.lastZ = cz;
    const { nearR, midR, farR, cell } = this;
    const n2 = nearR * nearR, m2 = midR * midR, f2 = farR * farR;
    const cnt = this.sets.map(() => [0, 0]);
    let fb = 0;
    const capFar = this.bb.instanceMatrix.count;
    const i0 = Math.floor((cx - farR) / cell), i1 = Math.floor((cx + farR) / cell);
    const j0 = Math.floor((cz - farR) / cell), j1 = Math.floor((cz + farR) / cell);
    const m = this.m4, Q = this.q4, V = this.v3, S = this.s3, E = this.e3;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const l = this.grid.get(i + ',' + j);
      if (!l) continue;
      for (const t of l) {
        const dx = this.x[t] - cx, dz = this.z[t] - cz, d2 = dx * dx + dz * dz;
        if (d2 > f2) continue;
        const k = this.k[t], s = this.s[t];
        if (d2 < m2) {
          const lod = d2 < n2 ? 0 : 1;
          const set = this.sets[k];
          const c = cnt[k];
          const mb = lod ? set.mb : set.nb, ml = lod ? set.ml : set.nl;
          if (c[lod] >= mb.instanceMatrix.count) continue;
          E.set(0, this.r[t], 0); Q.setFromEuler(E);
          const sx = s * (0.92 + hash1(t * 3.3) * 0.16), sy = s * (0.9 + hash1(t * 5.1) * 0.2);
          m.compose(V.set(this.x[t], 0.12, this.z[t]), Q, S.set(sx, sy, sx));
          m.toArray(mb.instanceMatrix.array, c[lod] * 16);
          m.toArray(ml.instanceMatrix.array, c[lod] * 16);
          c[lod]++;
          if (d2 < m2 * 0.72) continue;     // short overlap band with the impostors avoids a hard pop
        }
        if (fb >= capFar || d2 < m2 * 0.72) continue;
        m.makeScale(s, s, s); m.setPosition(this.x[t], 0.12, this.z[t]);
        m.toArray(this.bb.instanceMatrix.array, fb * 16);
        this.bbCell.array[fb] = k;
        fb++;
      }
    }
    this.sets.forEach((set, k) => {
      set.nb.count = set.nl.count = cnt[k][0];
      set.mb.count = set.ml.count = cnt[k][1];
      for (const mm of [set.nb, set.nl, set.mb, set.ml]) mm.instanceMatrix.needsUpdate = true;
    });
    this.bb.count = fb;
    this.bb.instanceMatrix.needsUpdate = true;
    this.bbCell.needsUpdate = true;
  }
}
