// Pune's hills (tools/bake_hills.py): Vetal Tekdi, the ARAI hill, Chaturshringi, Parvati, Taljai, Baner, Pashan,
// Katraj. The streets stay level; the hills rise only where nothing is built, a few dozen metres back.
//   near  every streamed 1 km tile carries an 8 m height grid: a mesh while the tile is loaded, and the
//         height under wheels and feet (Surfaces.height adds it)
//   far   base.json's 64 m field, eroded so it never pokes above the near grid: the hills on the horizon
import * as THREE from 'three';

const HILL_LAYER = 25;            // the ground shader's hillside: dry grass, scrub, bare laterite on the steep bits
const SINK = 0.08;                // the foot of a hill dips just under the ground so the seam doesn't flicker

function decode(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const q = new Uint16Array(u.buffer), h = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) h[i] = q[i] * 0.1;
  return h;
}

export class Hills {
  constructor(W, scene) {
    this.W = W; this.tiles = new Map();
    this.group = new THREE.Group(); this.group.name = 'hills'; scene.add(this.group);
    const F = W.M.hills;
    if (F) {
      const [S, nx, nz, x0, z0, b] = F;
      const m = this.mesh(x0, z0, S, nx, nz, decode(b), -0.25);
      if (m) { m.name = 'hills-far'; this.group.add(m); }
    }
  }
  addTile(D, rect, tag) {
    if (!D.hill) return;
    const [S, n, b] = D.hill, h = decode(b);
    const t = { x0: rect[0], z0: rect[1], S, n, h, tag };
    t.mesh = this.mesh(t.x0, t.z0, S, n, n, h, 0);
    if (t.mesh) this.group.add(t.mesh);
    this.tiles.set(Math.floor(rect[0] / 1000 + 0.5) + ',' + Math.floor(rect[1] / 1000 + 0.5), t);
  }
  removeTile(tag) {
    for (const [k, t] of this.tiles) {
      if (t.tag !== tag) continue;
      if (t.mesh) { this.group.remove(t.mesh); t.mesh.geometry.dispose(); }
      this.tiles.delete(k);
    }
  }
  // metres above the city's level at (x, z); 0 off the hills or where the tile isn't loaded
  height(x, z) {
    const t = this.tiles.get(Math.floor(x / 1000) + ',' + Math.floor(z / 1000));
    if (!t) return 0;
    const n = t.n, fx = (x - t.x0) / t.S, fz = (z - t.z0) / t.S;
    const i = Math.max(0, Math.min(n - 2, Math.floor(fx))), j = Math.max(0, Math.min(n - 2, Math.floor(fz)));
    const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fz - j)), h = t.h, k = j * n + i;
    const a = h[k], b = h[k + 1], c = h[k + n], d = h[k + n + 1];
    if (a + b + c + d === 0) return 0;
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  // a grid mesh over the cells that have any height; vertices shared, normals from the slopes
  mesh(x0, z0, S, nx, nz, h, yOff) {
    const used = new Int32Array(nx * nz).fill(-1);
    const cells = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      if (h[k] > 0.05 || h[k + 1] > 0.05 || h[k + nx] > 0.05 || h[k + nx + 1] > 0.05) cells.push(k);
    }
    if (!cells.length) return null;
    const P = [], N = [], UV = [], idx = [];
    let c = 0;
    const vert = (k) => {
      if (used[k] >= 0) return used[k];
      const i = k % nx, j = (k - i) / nx, x = x0 + i * S, z = z0 + j * S;
      const hl = h[j * nx + Math.max(0, i - 1)], hr = h[j * nx + Math.min(nx - 1, i + 1)];
      const hu = h[Math.max(0, j - 1) * nx + i], hd = h[Math.min(nz - 1, j + 1) * nx + i];
      let ax = -(hr - hl) / (2 * S), az = -(hd - hu) / (2 * S); const l = Math.hypot(ax, 1, az);
      P.push(x, h[k] + 0.15 - SINK + yOff, z); N.push(Math.round(ax / l * 127), Math.round(127 / l), Math.round(az / l * 127)); UV.push(x, z);
      return (used[k] = c++);
    };
    for (const k of cells) {
      const a = vert(k), b = vert(k + 1), d = vert(k + nx), e = vert(k + nx + 1);
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(N), 3, true));
    g.setAttribute('guv', new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute('glayer', new THREE.BufferAttribute(new Uint8Array(c).fill(HILL_LAYER), 1));
    g.setAttribute('gshade', new THREE.BufferAttribute(new Uint8Array(c).fill(200), 1, true));
    g.setIndex(new THREE.BufferAttribute(c > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, this.W.mats.ground);
    m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false;
    return m;
  }
}
