// Distant city: every building as a plain prism (inset a little so the detailed chunk building,
// when present, hides it completely) plus a map-textured ground plane that is discarded wherever a
// detailed chunk is built. Gives the full skyline to the horizon and removes streaming pop-in.
import * as THREE from 'three';
import { cmRing } from './geo.js';
import { buildingHeight, signedArea, offsetRing, BASE } from './buildingsChunk.js';
import { hash1 } from '../core/util.js';

// rough far-away wall colours per style (sRGB)
const STYLE_COL = [[0.86, 0.82, 0.72], [0.8, 0.82, 0.84], [0.82, 0.72, 0.58], [0.9, 0.86, 0.78], [0.86, 0.8, 0.66], [0.6, 0.57, 0.52],
  [0.6, 0.6, 0.58], [0.7, 0.7, 0.7], [0.95, 0.75, 0.5], [0.55, 0.65, 0.72], [0.62, 0.58, 0.52], [0.55, 0.52, 0.48], [0.62, 0.58, 0.52],
  [0.2, 0.2, 0.22], [0.66, 0.42, 0.32]];
const lin = (c) => Math.pow(c, 2.2);

export function buildFarCity(W) {
  const { M, index, scene } = W;
  const SUPER = 4;
  const groups = new Map();
  const get = (ci) => {
    const c = index.chunks[ci];
    const key = Math.floor(c.i / SUPER) + ',' + Math.floor(c.j / SUPER);
    let g = groups.get(key);
    if (!g) groups.set(key, g = { p: [], n: [], c: [], i: [], v: 0 });
    return g;
  };
  for (let bi = 0; bi < M.buildings.length; bi++) {
    const B = M.buildings[bi];
    const style = B[3];
    if (style === 7) continue;
    const p0 = cmRing(B[1]);
    const n = p0.length / 2;
    if (n < 3 || B[0] < 0 || B[0] >= index.chunks.length) continue;
    const area = signedArea(p0), sgn = area > 0 ? 1 : -1;
    if (Math.abs(area) < 12) continue;
    const normals = new Float64Array(p0.length);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = p0[2 * j] - p0[2 * i], dz = p0[2 * j + 1] - p0[2 * i + 1], L = Math.hypot(dx, dz) || 1;
      normals[2 * i] = sgn * dz / L; normals[2 * i + 1] = -sgn * dx / L;
    }
    const p = offsetRing(p0, normals, -0.35);
    const top = BASE + buildingHeight(B).H - 0.3;
    const g = get(B[0]);
    const h = hash1(bi * 31 + 7);
    const base = STYLE_COL[style] || STYLE_COL[0];
    const wc = base.map(v => lin(Math.min(1, v * (0.88 + h * 0.18))));
    const rc = [lin(0.52 + h * 0.1), lin(0.5 + h * 0.1), lin(0.48 + h * 0.08)];
    // walls
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = p[2 * i], az = p[2 * i + 1], bx = p[2 * j], bz = p[2 * j + 1];
      const nx = normals[2 * i], nz = normals[2 * i + 1];
      const v = g.v;
      g.p.push(ax, 0, az, bx, 0, bz, bx, top, bz, ax, top, az);
      for (let k = 0; k < 4; k++) g.n.push(nx, 0, nz);
      const dark = [wc[0] * 0.55, wc[1] * 0.55, wc[2] * 0.55];
      g.c.push(...dark, ...dark, ...wc, ...wc);
      const fd = -(bz - az) * nx + (bx - ax) * nz;
      if (fd > 0) g.i.push(v, v + 1, v + 2, v, v + 2, v + 3); else g.i.push(v, v + 2, v + 1, v, v + 3, v + 2);
      g.v += 4;
    }
    // roof (fan triangulation is fine for the mostly convex footprints; earcut via THREE for others)
    const pts2 = [];
    for (let i = 0; i < n; i++) pts2.push(new THREE.Vector2(p[2 * i], p[2 * i + 1]));
    const tris = THREE.ShapeUtils.triangulateShape(pts2, []);
    const v0 = g.v;
    for (let i = 0; i < n; i++) { g.p.push(p[2 * i], top, p[2 * i + 1]); g.n.push(0, 1, 0); g.c.push(...rc); }
    for (const t of tris) {
      const a = t[0], b = t[1], c = t[2];
      // make it face up: cross((b-a),(c-a)).y must be > 0 in a right-handed x/z with y up -> (dz1*dx2 - dx1*dz2) > 0
      const dx1 = p[2 * b] - p[2 * a], dz1 = p[2 * b + 1] - p[2 * a + 1], dx2 = p[2 * c] - p[2 * a], dz2 = p[2 * c + 1] - p[2 * a + 1];
      if (dz1 * dx2 - dx1 * dz2 > 0) g.i.push(v0 + a, v0 + b, v0 + c); else g.i.push(v0 + a, v0 + c, v0 + b);
    }
    g.v += n;
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const meshes = [];
  for (const g of groups.values()) {
    if (!g.v) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
    geo.setIndex(g.v > 65535 ? new THREE.Uint32BufferAttribute(g.i, 1) : new THREE.Uint16BufferAttribute(g.i, 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat);
    m.matrixAutoUpdate = false; m.updateMatrix();
    m.receiveShadow = true;
    scene.add(m);
    meshes.push(m);
  }
  W.farCity = meshes;
  buildFarGround(W);
}

// top-down map texture of the whole area: roads, water, greens, compounds
function buildFarGround(W) {
  const { M, index, scene } = W;
  const x0 = index.x0, z0 = index.z0, sx = index.ncx * index.size, sz = index.ncz * index.size;
  const res = 2.5;                                     // metres per pixel
  const cw = Math.min(4096, Math.ceil(sx / res)), ch = Math.min(4096, Math.ceil(sz / res));
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  const KC = { compound: '#8a7f6e', asphalt: '#4a4a4b', concrete: '#6a6863', pavers: '#857a6d', grass: '#5b6b3c', soil: '#8a7253', scrub: '#5f6740',
    plaza: '#7d7a73', median: '#8a8a84', bridge_road: '#4a4a4b', bridge_sw: '#7a7670' };
  ctx.fillStyle = KC.compound; ctx.fillRect(0, 0, cw, ch);
  const draw = (rings, col) => {
    ctx.beginPath();
    for (const r of rings) {
      for (let k = 0; k < r.length; k += 2) {
        const px = (r[k] / 100 - x0) / sx * cw, py = (r[k + 1] / 100 - z0) / sz * ch;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fillStyle = col; ctx.fill('evenodd');
  };
  for (const [kind, polys] of M.ground) { if (kind === 'compound') continue; for (const [, rings] of polys) draw(rings, KC[kind] || KC.compound); }
  for (const [, rings] of M.water) draw(rings, '#3c4a4c');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // built-chunk mask: 1 texel per chunk, discard where a detailed chunk exists
  const mask = new Uint8Array(index.ncx * index.ncz);
  const maskTex = new THREE.DataTexture(mask, index.ncx, index.ncz, THREE.RedFormat, THREE.UnsignedByteType);
  maskTex.magFilter = maskTex.minFilter = THREE.NearestFilter;
  maskTex.unpackAlignment = 1;
  maskTex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tMask = { value: maskTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMaskUV;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMaskUV = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tMask; varying vec2 vMaskUV;')
      .replace('void main() {', 'void main() {\n if (texture2D(tMask, vMaskUV).r > 0.5) discard;');
  };
  mat.customProgramCacheKey = () => 'nh-farground';
  const geo = new THREE.PlaneGeometry(sx, sz, 1, 1);
  geo.rotateX(-Math.PI / 2);
  // PlaneGeometry uv: (0,1) at top-left (-x, -z after rotation); flipY canvas texture maps v=1 to canvas top (z0)
  const plane = new THREE.Mesh(geo, mat);
  plane.position.set(x0 + sx / 2, -0.05, z0 + sz / 2);
  plane.receiveShadow = true;
  plane.matrixAutoUpdate = false; plane.updateMatrix();
  scene.add(plane);
  // the mask's row 0 must be the chunk row at z0 (top of the canvas = v 1)
  W.farGround = { plane, mask, maskTex, set: (c, on) => { mask[c.i + (index.ncz - 1 - c.j) * index.ncx] = on ? 255 : 0; maskTex.needsUpdate = true; } };
}
