// The footpath's own sellers, as things that stand there and can be knocked over: a fruit seller's handcart (an
// umbrella in it, as often as not), a cobbler's pitch under his umbrella. Where each is and how it looks comes from the
// painter (world/footpath.js, with the close-up drawing of the street); here each is made from its own model, into
// one mesh for each quarter of the chunk (shown and hidden with that quarter's close-up drawing, as they were when they
// were painted into it), each thing a known run of it so it can be taken out when it's knocked over (world/smash.js),
// and solid in its own shape. Put back with the street, as it was, unless it's been knocked over, in which case it
// stays where it fell until the street's been left a while.
import * as THREE from 'three';
import { ColorBuilder } from '@orig/world/geo.js';
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
  const cbs = [0, 1, 2, 3].map(() => new ColorBuilder()), regs = [];
  const put = (k, kind, geo, x, y, z, ry, sol, extra) => {
    const cb = cbs[k], i0 = cb.i.length;
    cb.addGeo(geo, compose(x, y, z, ry, 1, 1, 1, 0, 0, _m), [1, 1, 1]);
    const e = { k, kind, geo, x, y, z, ry, i0, i1: cb.i.length, sol, extra };
    regs.push(e); return e;
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
  const meshes = [];
  for (let k = 0; k < 4; k++) {
    if (cbs[k].empty) { meshes.push(null); continue; }
    const m = new THREE.Mesh(cbs[k].build(), W.mats.prop); m.geometry.userData.shared = true;
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
