// /beta's flyovers: the game's decks, ramps and piers (world/flyover.js: same heights, same pier spots and sizes, so
// driving on them and into them is unchanged), drawn again with what a Pune flyover has:
//   a box girder under a wider slab (the wings overhang it), a drip lip on the slab's edge
//   crash barriers with the sloped New Jersey face and a steel rail on posts
//   edge lines, dashed lanes, an expansion joint across the road over each pier
//   eight-sided piers on a footing, a hammerhead cap that tapers down, bearings under the girder
//   ramp walls in panels with a coping on top
import * as THREE from 'three';
import { Flyovers } from '@orig/world/flyover.js';

const CELL = 40, BIN = 400;
const CONCRETE = [0.66, 0.65, 0.62], CONCRETE_D = [0.5, 0.49, 0.47], CONCRETE_L = [0.72, 0.71, 0.68], ASPHALT = [0.2, 0.2, 0.21];
const PAINT = [0.9, 0.9, 0.87], JOINT = [0.1, 0.1, 0.11], STEEL = [0.55, 0.56, 0.58], PAD = [0.15, 0.15, 0.16];
const PARAPET_H = 0.95, DECK_T = 1.1;

Flyovers.prototype.build = function (scene, mats) {
  const cbs = new Map();
  let cb = null;
  // half a million boxes for all of Pune, kept until you come near each piece: held as plain floats, not an
  // object and a matrix for every box (that alone was 130 MB of the heap from the title screen on)
  const rec = () => {
    let a = new Float32Array(15*64), n = 0;
    return {
      addGeo: (g, m, col) => {
        if (n + 15 > a.length) { const b = new Float32Array(a.length*2); b.set(a); a = b; }
        const e = m.elements; a[n] = e[0]; a[n + 1] = e[1]; a[n + 2] = e[2]; a[n + 3] = e[4]; a[n + 4] = e[5]; a[n + 5] = e[6]; a[n + 6] = e[8]; a[n + 7] = e[9]; a[n + 8] = e[10]; a[n + 9] = e[12]; a[n + 10] = e[13]; a[n + 11] = e[14];
        a[n + 12] = col[0]; a[n + 13] = col[1]; a[n + 14] = col[2]; n += 15;
      },
      ops() {
        const d = a.slice(0, n); a = null;
        return { *[Symbol.iterator]() { const m = new THREE.Matrix4(), col = [0, 0, 0]; for (let i = 0; i < d.length; i += 15) { m.set(d[i], d[i + 3], d[i + 6], d[i + 9], d[i + 1], d[i + 4], d[i + 7], d[i + 10], d[i + 2], d[i + 5], d[i + 8], d[i + 11], 0, 0, 0, 1); col[0] = d[i + 12]; col[1] = d[i + 13]; col[2] = d[i + 14]; yield [box, m, col]; } } };
      },
    };
  };
  const at = (x, z) => { const k = Math.floor(x / BIN) + ',' + Math.floor(z / BIN); let c = cbs.get(k); if (!c) cbs.set(k, c = rec()); cb = c; };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), E = new THREE.Euler();
  const put = (x, y, z, sx, sy, sz, ry, col) => { Q.setFromAxisAngle(Y, ry); M4.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); cb.addGeo(box, M4, col); };
  // along the deck piece: centre (mx, mh, mz), offset across n, up, and a box in the piece's own frame
  let mx = 0, mz = 0, mh = 0, nx = 0, nz = 0;
  const seg = (off, y, sx, sy, sz, col) => { M4.compose(V.set(mx + nx*off, mh + y, mz + nz*off), Q, S.set(sx, sy, sz)); cb.addGeo(box, M4, col); };
  this.pgrid = new Map();
  for (const dk of this.decks) {
    const P = dk.pts, H = dk.h, n = P.length / 2, hw = dk.hw, w = dk.w, gw = w*0.58;
    let run = 0;
    for (let i = 0; i < n - 1; i++) {
      const ax = P[2*i], az = P[2*i + 1], bx = P[2*i + 2], bz = P[2*i + 3], ha = H[i], hb = H[i + 1];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-6, Lx = L + 0.05;
      mx = (ax + bx) / 2; mz = (az + bz) / 2; mh = (ha + hb) / 2; nx = -dz / L; nz = dx / L;
      at(mx, mz);
      Q.setFromEuler(E.set(0, Math.atan2(-dz, dx), Math.atan2(hb - ha, L), 'YXZ'));
      // the slab, the girder under it, and the slab's lip
      seg(0, -0.14, Lx, 0.28, w, CONCRETE);
      if (mh > 1.2) {
        seg(0, -0.28 - (DECK_T - 0.28)/2, Lx, DECK_T - 0.28, gw, CONCRETE_D);
        for (const sd of [-1, 1]) seg(sd*(gw/2 + 0.25), -0.38, Lx, 0.2, 0.5, CONCRETE_D);    // the haunch where the wing meets the girder
        for (const sd of [-1, 1]) seg(sd*(hw - 0.04), -0.34, Lx, 0.12, 0.08, CONCRETE_L);    // drip lip
      }
      // road
      seg(0, 0.01, Lx, 0.02, w - 0.9, ASPHALT);
      for (const sd of [-1, 1]) seg(sd*(hw - 0.75), 0.024, Lx, 0.02, 0.15, PAINT);           // edge lines
      if (i % 2 === 0) {
        const lanes = Math.max(1, Math.round((w - 1.5) / 3.3));
        for (let k = 1; k < lanes; k++) seg(-hw + 0.75 + k*(w - 1.5)/lanes, 0.025, L*0.5, 0.02, 0.12, PAINT);
      }
      // the barrier: wide foot, sloped face, narrow top, then a rail on posts
      for (const sd of [-1, 1]) {
        const o = sd*(hw - 0.2);
        seg(o, 0.14, Lx, 0.28, 0.4, CONCRETE);
        seg(o + sd*0.04, 0.28 + 0.2, Lx, 0.4, 0.28, CONCRETE);
        seg(o + sd*0.07, 0.68 + 0.12, Lx, 0.24, 0.18, CONCRETE_L);
        seg(o + sd*0.07, PARAPET_H + 0.1, Lx, 0.06, 0.07, STEEL);
        if (i % 2 === 0) seg(o + sd*0.07, PARAPET_H + 0.04, 0.06, 0.12, 0.06, STEEL);
        if (mh < 4.6 && mh > 0.4) {          // ramp walls down to the ground, in panels, with a coping
          const ow = sd*(hw - 0.12);
          seg(ow, -mh/2, Lx, mh, 0.3, i & 1 ? CONCRETE_D : [0.53, 0.52, 0.5]);
          seg(ow + sd*0.04, -0.06, Lx, 0.12, 0.38, CONCRETE);
        }
      }
      run += L;
    }
    // piers every ~30 m where the deck is high (the same spots and sizes as the game's)
    let acc = 15;
    for (let i = 0; i < n - 1; i++) {
      const ax = P[2*i], az = P[2*i + 1], bx = P[2*i + 2], bz = P[2*i + 3];
      const L = Math.hypot(bx - ax, bz - az); acc += L;
      if (acc < 30) continue;
      acc = 0;
      const h = H[i];
      if (h < 4.6) continue;
      at(ax, az);
      const ry = Math.atan2(-(bz - az), bx - ax), pw = Math.min(3.2, w*0.35), top = h - DECK_T;
      put(ax, 0.15, az, 2.4, 0.3, pw + 1.1, ry, CONCRETE_D);                                // footing
      put(ax, top/2, az, 1.3, top, pw, ry, CONCRETE);                                        // the column, with its corners cut:
      put(ax, top/2, az, 0.95, top - 0.05, pw + 0.3, ry, CONCRETE);                           //   eight sides
      put(ax, top - 0.55, az, 1.5, 0.4, w*0.55, ry, CONCRETE);                                // the cap, tapering down
      put(ax, top - 0.2, az, 1.8, 0.3, w*0.85, ry, CONCRETE_L);
      const ca = Math.cos(ry), sa = -Math.sin(ry);
      for (const sd of [-1, 1]) put(ax - sa*sd*gw*0.3, top - 0.02, az + ca*sd*gw*0.3, 0.5, 0.06, 0.5, ry, PAD);   // bearings
      // the expansion joint over the pier, across the road
      Q.setFromAxisAngle(Y, ry); M4.compose(V.set(ax, h + 0.026, az), Q, S.set(0.12, 0.02, w - 0.9)); cb.addGeo(box, M4, JOINT);
      const pr = { x: ax, z: az, r: Math.max(0.8, pw / 2) };
      this.piers.push(pr);
      const key = Math.floor(ax / CELL) + ',' + Math.floor(az / CELL);
      if (!this.pgrid.has(key)) this.pgrid.set(key, []);
      this.pgrid.get(key).push(pr);
    }
  }
  this.parts = [];
  this.scene = scene; this.mat = mats.prop;
  for (const [k, c] of cbs) { const [i, j] = k.split(',').map(Number); this.parts.push({ ops: c.ops(), mesh: null, x: (i + 0.5)*BIN, z: (j + 0.5)*BIN }); }
  this.lastX = 1e9; this.lastZ = 1e9;
};
