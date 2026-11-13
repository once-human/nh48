// The footpath's own sellers, as things that stand there and can be knocked over: a fruit seller's handcart (an
// umbrella in it, as often as not), a cobbler's pitch under his umbrella. Where each is and how it looks comes from the
// painter (world/footpath.js, with the close-up drawing of the street); here each is made from its own model, into
// one mesh for each quarter of the chunk (shown and hidden with that quarter's close-up drawing, as they were when they
// were painted into it), each thing a known run of it so it can be taken out when it's knocked over (world/smash.js),
// and solid in its own shape. Put back with the street, as it was, unless it's been knocked over, in which case it
// stays where it fell until the street's been left a while.
import * as THREE from 'three';
import { boundsSliced, drain } from '@orig/world/geo.js';
import { compose } from '@orig/world/props.js';
import { vendorGeo } from './props.js';
import { smash } from './smash.js';

const _m = new THREE.Matrix4();
const cellOf = (L, x, z) => (x > L.cx ? 1 : 0) + (z > L.cz ? 2 : 0);
// a box w x d (local x along ry) round (x, z) offset (ox, oz), as its four corners
function ring(x, z, ry, ox, oz, w, d) {
  const c = Math.cos(ry), s = Math.sin(ry), P = (u, v) => [x + (u + ox)*c + (v + oz)*s, z - (u + ox)*s + (v + oz)*c];
  return [...P(-w/2, -d/2), ...P(w/2, -d/2), ...P(w/2, d/2), ...P(-w/2, d/2)];
}
export function vendIn(L, list, tag) {
  const W = L.W, X = smash(W), C = W.collision;
  if (!list || !list.length || !W.mats || !W.mats.prop) return null;
  // (each quarter's mesh is filled in one pass over plain lists of numbers, sized beforehand. The game's builder takes a
  // model a number at a time into lists that grow as they go: a street of handcarts held a frame for a tenth of a second
  // when its close-up drawing came)
  const nv = [0, 0, 0, 0], ni = [0, 0, 0, 0], regs = [];
  const put = (k, kind, geo, x, y, z, ry, sol, extra) => {
    const n = geo.attributes.position.count, m = geo.index ? geo.index.count : n;
    const e = { k, kind, geo, x, y, z, ry, v0: nv[k], i0: ni[k], i1: ni[k] + m, sol, extra };
    nv[k] += n; ni[k] += m; regs.push(e); return e;
  };
  for (const d of list) {
    const k = cellOf(L, d.x, d.z);
    if (d.k === 'cart') {
      const cart = put(k, 'cart', vendorGeo('cart', d.v), d.x, d.y, d.z, d.ry, [['r', ring(d.x, d.z, d.ry, 0, 0, 1.86, 0.98)], ['r', ring(d.x, d.z, d.ry, -1.15, 0, 0.5, 0.8)]]);
      if (d.u >= 0) cart.link = put(k, 'umbC', vendorGeo('umbC', d.u), d.x, d.y + 0.72, d.z, d.ry, []);
    } else if (d.k === 'cob') {
      put(k, 'cob', vendorGeo('cob', d.v), d.x, d.y, d.z, d.ry, [['r', ring(d.x, d.z, d.ry, 0, 0, 0.62, 0.4)], ['r', ring(d.x, d.z, d.ry, 0, 0.6, 0.34, 0.3)]]);
      put(k, 'umbS', vendorGeo('umbS', d.u), d.ux, d.y, d.uz, d.ry, [['c', d.ux, d.uz, 0.13]]);
    }
  }
  const A = [0, 1, 2, 3].map(k => nv[k] ? { p: new Float32Array(nv[k]*3), n: new Float32Array(nv[k]*3), c: new Float32Array(nv[k]*3), g: new Float32Array(nv[k]), i: new (nv[k] > 65535 ? Uint32Array : Uint16Array)(ni[k]) } : null);
  for (const e of regs) {
    const a = A[e.k], G = e.geo.attributes, P = G.position.array, N = G.normal.array, Cc = G.color && G.color.array, Gl = G.glow && G.glow.array, n = G.position.count;
    const m = compose(e.x, e.y, e.z, e.ry, 1, 1, 1, 0, 0, _m).elements;
    for (let k = 0, o = e.v0*3; k < n; k++, o += 3) {
      const x = P[k*3], y = P[k*3 + 1], z = P[k*3 + 2], u = N[k*3], v = N[k*3 + 1], w = N[k*3 + 2];
      a.p[o] = m[0]*x + m[4]*y + m[8]*z + m[12]; a.p[o + 1] = m[1]*x + m[5]*y + m[9]*z + m[13]; a.p[o + 2] = m[2]*x + m[6]*y + m[10]*z + m[14];
      const nx = m[0]*u + m[4]*v + m[8]*w, ny = m[1]*u + m[5]*v + m[9]*w, nz = m[2]*u + m[6]*v + m[10]*w, l = Math.hypot(nx, ny, nz) || 1;
      a.n[o] = nx/l; a.n[o + 1] = ny/l; a.n[o + 2] = nz/l;
    }
    if (Cc) a.c.set(Cc.subarray(0, n*3), e.v0*3); else a.c.fill(1, e.v0*3, (e.v0 + n)*3);
    if (Gl) a.g.set(Gl.subarray(0, n), e.v0);
    const I = e.geo.index && e.geo.index.array;
    if (I) for (let k = 0; k < I.length; k++) a.i[e.i0 + k] = e.v0 + I[k]; else for (let k = 0; k < n; k++) a.i[e.i0 + k] = e.v0 + k;
  }
  const meshes = [];
  for (let k = 0; k < 4; k++) {
    const a = A[k]; if (!a) { meshes.push(null); continue; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(a.n, 3)); g.setAttribute('color', new THREE.BufferAttribute(a.c, 3)); g.setAttribute('glow', new THREE.BufferAttribute(a.g, 1));
    g.setIndex(new THREE.BufferAttribute(a.i, 1)); drain(boundsSliced(g));
    const m = new THREE.Mesh(g, W.mats.prop); m.geometry.userData.shared = true;
    m.castShadow = m.receiveShadow = true; m.matrixAutoUpdate = false; m.name = 'vend';
    (L.cells[k].main || L.g).add(m); meshes.push(m);
  }
  // solid while they're here, with the rest of the footpath's (they go when its tag does)
  const t0 = C.tag; C.tag = tag;
  try {
    for (const e of regs) {
      const cols = [];
      for (const q of e.sol) { if (q[0] === 'r') cols.push(...C.addRingR(q[1], 2)); else cols.push(C.addCircle(q[1], q[2], q[3], 2)); }
      e.r = X.reg(e.kind, e.x, e.z, e.ry, { y: e.y, geo: e.geo, cols, draw: [meshes[e.k] && e.i1 > e.i0 ? [meshes[e.k], e.i0, e.i1] : null] });
    }
  } finally { C.tag = t0; }
  for (const e of regs) if (e.link) e.r.link = [e.link.r];
  return { meshes, kill() { X.unmesh(...meshes); for (const m of meshes) if (m) { m.parent && m.parent.remove(m); m.geometry.dispose(); } } };
}
