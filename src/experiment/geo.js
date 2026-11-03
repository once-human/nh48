// /experiment: a small geometry builder. Everything in the street is pushed into a few big buffers (one draw per
// buffer), and every vertex carries the colour and the kind of surface it is, so the shader can paint it.
// Faces are wound from the normal you ask for, so nothing comes out inside out.
import * as THREE from 'three';

export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// surface kinds (the shader's pattern switch reads these)
export const K = { plaster: 0, brick: 1, road: 2, paver: 3, kerb: 4, tiles: 5, shutter: 6, wood: 7, glass: 8, leaf: 9, plain: 10, tin: 11, stone: 12, inside: 13, sign: 14, cloth: 15, paint: 16 };

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();

export class Builder {
  // extra: { name: size } per-vertex attributes taken from the current state, e.g. { pla: 3 }
  constructor(extra = {}, uv = false) {
    this.P = []; this.N = []; this.C = []; this.Kd = []; this.U = uv ? [] : null;
    this.ex = {}; this.st = { c: [1, 1, 1], k: 0, uv: [0, 0, 1, 1] };
    for (const a in extra) { this.ex[a] = { size: extra[a], d: [] }; this.st[a] = extra[a] === 1 ? 0 : new Array(extra[a]).fill(0); }
  }
  set(o) { Object.assign(this.st, o); return this; }
  col(h) { this.st.c = typeof h === 'number' ? hex(h) : h; return this; }
  kind(k) { this.st.k = k; return this; }
  vert(p, n, u, v) {
    this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]);
    this.C.push(this.st.c[0], this.st.c[1], this.st.c[2]); this.Kd.push(this.st.k);
    if (this.U) this.U.push(u || 0, v || 0);
    for (const a in this.ex) { const e = this.ex[a], s = this.st[a]; if (e.size === 1) e.d.push(s); else e.d.push(...s); }
  }
  // a triangle facing roughly along `want` (swapped if it doesn't)
  tri(p0, p1, p2, want, t0, t1, t2) {
    _a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); _b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    _n.crossVectors(_a, _b).normalize();
    if (want && _n.x * want[0] + _n.y * want[1] + _n.z * want[2] < 0) { [p1, p2] = [p2, p1]; [t1, t2] = [t2, t1]; _n.negate(); }
    const n = want ? want : [_n.x, _n.y, _n.z];
    this.vert(p0, n, ...(t0 || [])); this.vert(p1, n, ...(t1 || [])); this.vert(p2, n, ...(t2 || []));
  }
  // corners in order around the quad; uv from st.uv [u0,v0,u1,v1] mapped corner by corner
  quad(p0, p1, p2, p3, want) {
    const [u0, v0, u1, v1] = this.st.uv;
    this.tri(p0, p1, p2, want, [u0, v0], [u1, v0], [u1, v1]);
    this.tri(p0, p2, p3, want, [u0, v0], [u1, v1], [u0, v1]);
  }
  // axis-aligned box; skip: a string of faces to leave out ('px nx py ny pz nz')
  box(x0, y0, z0, x1, y1, z1, skip = '') {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
    if (!skip.includes('px')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    if (!skip.includes('nx')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    if (!skip.includes('py')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    if (!skip.includes('ny')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    if (!skip.includes('pz')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    if (!skip.includes('nz')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  }
  // any three geometry, placed by a matrix (normals follow)
  geo(g, m) {
    const gg = g.index ? g.toNonIndexed() : g;
    if (m) gg.applyMatrix4(m);
    const p = gg.attributes.position, n = gg.attributes.normal, uv = gg.attributes.uv;
    for (let i = 0; i < p.count; i++) this.vert([p.getX(i), p.getY(i), p.getZ(i)], [n.getX(i), n.getY(i), n.getZ(i)], uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    g.dispose(); if (gg !== g) gg.dispose();
  }
  sphere(cx, cy, cz, rx, ry, rz, w = 10, h = 7, theta = Math.PI) {
    this.geo(new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, theta), M(cx, cy, cz, 0, 0, 0, rx, ry, rz));
  }
  // a tapered tube from a to b
  limb(a, b, r0, r1 = r0, seg = 8, caps = true) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, !caps);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    this.geo(g, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  }
  cyl(x, y, z, r0, r1, h, seg = 10, rx = 0, ry = 0, rz = 0, sx = 1, sz = 1) {
    this.geo(new THREE.CylinderGeometry(r1, r0, h, seg, 1), M(x, y, z, rx, ry, rz, sx, 1, sz));
  }
  rbox(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { this.geo(new THREE.BoxGeometry(w, h, d), M(x, y, z, rx, ry, rz)); }
  get count() { return this.P.length / 3; }
  geometry(G = new THREE.BufferGeometry()) {
    G.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    G.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    G.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    G.setAttribute('kind', new THREE.Float32BufferAttribute(this.Kd, 1));
    if (this.U) G.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    for (const a in this.ex) G.setAttribute(a, new THREE.Float32BufferAttribute(this.ex[a].d, this.ex[a].size));
    G.computeBoundingSphere(); G.computeBoundingBox();
    return G;
  }
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
export function M(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}
