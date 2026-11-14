// A car's glass breaks, each kind the way it does. The windows in the doors and the back glass are toughened: hit hard
// enough and the whole pane goes at once, into hundreds of small blunt bits that burst out, fall and scatter on the
// road (the opening is then an opening: you see in, and the wind's in the car). The windscreen is laminated, two sheets
// on a film: it doesn't fall out, it cracks, lines running out from where it was struck and rings round it, and each
// blow after that adds its own. What breaks it is what dents the car there: a crash by how hard and how close, a
// roll onto the roof, a bullet (which stars a windscreen and drops a door glass).
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';

const G0 = () => window.__nhAskG;
const V = Vehicle.prototype, _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
const cl = (v, a, b) => v < a ? a : v > b ? b : v;

// the panes: the pieces of the glass that hang together, each with where it is and which way it faces
function panesOf(g, P0) {
  const n = g.attributes.position.count, I = g.index ? g.index.array : null, nt = (I ? I.length : n)/3, N = g.attributes.normal.array;
  const up = new Int32Array(n); for (let i = 0; i < n; i++) up[i] = i;
  const root = (i) => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
  const join = (a, b) => { a = root(a); b = root(b); if (a !== b) up[a] = b; };
  const at = new Map();
  for (let i = 0; i < n; i++) { const k = Math.round(P0[i*3]*400) + ',' + Math.round(P0[i*3 + 1]*400) + ',' + Math.round(P0[i*3 + 2]*400), o = at.get(k); if (o === undefined) at.set(k, i); else join(i, o); }
  const vi = (t, c) => I ? I[t*3 + c] : t*3 + c;
  for (let t = 0; t < nt; t++) { join(vi(t, 0), vi(t, 1)); join(vi(t, 0), vi(t, 2)); }
  const by = new Map();
  for (let t = 0; t < nt; t++) {
    const r = root(vi(t, 0)); let p = by.get(r);
    if (!p) by.set(r, p = { tris: [], verts: new Set(), min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], n: [0, 0, 0], area: 0, gone: false });
    p.tris.push(t);
    _a.fromArray(P0, vi(t, 0)*3); _b.fromArray(P0, vi(t, 1)*3); _c.fromArray(P0, vi(t, 2)*3);
    p.area += _n.subVectors(_b, _a).cross(_s.subVectors(_c, _a)).length()/2;
    for (let c = 0; c < 3; c++) { const v = vi(t, c); p.verts.add(v); for (let k = 0; k < 3; k++) { const x = P0[v*3 + k]; if (x < p.min[k]) p.min[k] = x; if (x > p.max[k]) p.max[k] = x; p.n[k] += N[v*3 + k]; } }
  }
  const out = [];
  for (const p of by.values()) {
    if (p.area < 0.03) continue;                                   // (a sliver, a lamp's cover: not a window)
    const l = Math.hypot(p.n[0], p.n[1], p.n[2]) || 1; p.n = [p.n[0]/l, p.n[1]/l, p.n[2]/l];
    p.c = [(p.min[0] + p.max[0])/2, (p.min[1] + p.max[1])/2, (p.min[2] + p.max[2])/2];
    p.wind = p.n[0] > 0.3 && p.c[0] > 0;                           // (facing forward, ahead of the middle: the windscreen)
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------- the bits
const NB = 420;
let bits = null;
function pool(G) {
  if (bits) return bits;
  const m = new THREE.MeshBasicMaterial({ color: 0xd4ece6, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m, NB); mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 5; G.scene.add(mesh);
  return (bits = { mesh, p: [], k: 0, live: 0, on: false, last: 0 });
}
function step(now) {
  const S = bits; if (!S) return;
  const dt = Math.min(0.1, (now - S.last)/1000); S.last = now;
  let n = 0;
  for (const q of S.p) {
    if (!q || q.life >= q.max) continue;
    q.life += dt; if (q.life >= q.max) continue;
    if (!q.rest) {
      q.vy -= 9.81*dt; q.x += q.vx*dt; q.y += q.vy*dt; q.z += q.vz*dt; q.a += q.w*dt;
      if (q.y < q.gy + 0.006) {
        // onto the road: a small hop or two, a skitter, and it lies there
        q.y = q.gy + 0.006;
        if (q.vy < -1.2) { q.vy *= -0.22; q.vx *= 0.55; q.vz *= 0.55; q.w *= 0.5; } else { q.rest = true; q.flat = true; }
      }
    }
    const t = q.life/q.max, sc = q.sz*(t > 0.8 ? (1 - t)/0.2 : 1);
    if (q.flat) _q.setFromAxisAngle(_n.set(1, 0, 0), -Math.PI/2); else _q.setFromAxisAngle(_n.set(q.ax, q.ay, q.az), q.a);
    _m.compose(_a.set(q.x, q.y, q.z), _q, _s.set(sc, sc, sc)); S.mesh.setMatrixAt(n++, _m);
  }
  S.mesh.count = n; S.mesh.instanceMatrix.needsUpdate = true; S.live = n;
  if (n > 0) requestAnimationFrame(step); else S.on = false;
}
function burst(G, v, pn, g) {
  const S = pool(G), P = g.attributes.position.array, I = g.index ? g.index.array : null, M = v.tilt.matrixWorld, surf = G.W && G.W.surf;
  v.tilt.updateWorldMatrix(true, false);
  const hx = Math.cos(v.th), hz = Math.sin(v.th), cvx = hx*(v.v || 0) - hz*(v.vl || 0), cvz = hz*(v.v || 0) + hx*(v.vl || 0);
  _n.set(pn.n[0], pn.n[1], pn.n[2]).transformDirection(M); const ox = _n.x, oy = _n.y, oz = _n.z;
  const count = Math.round(cl(pn.area*150, 30, 110));
  for (let i = 0; i < count; i++) {
    const t = pn.tris[Math.floor(Math.random()*pn.tris.length)], vi = (c) => (I ? I[t*3 + c] : t*3 + c)*3;
    let u = Math.random(), w = Math.random(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    const a = vi(0), b = vi(1), c = vi(2);
    _a.set(P[a] + (P[b] - P[a])*u + (P[c] - P[a])*w, P[a + 1] + (P[b + 1] - P[a + 1])*u + (P[c + 1] - P[a + 1])*w, P[a + 2] + (P[b + 2] - P[a + 2])*u + (P[c + 2] - P[a + 2])*w).applyMatrix4(M);
    const q = S.p[S.k] || (S.p[S.k] = {}); S.k = (S.k + 1)%NB;
    const out = (Math.random() < 0.7 ? 1 : -0.4)*(0.4 + Math.random()*2.2);        // (most of it outward; some falls into the car)
    Object.assign(q, { x: _a.x, y: _a.y, z: _a.z, vx: cvx*0.85 + ox*out + (Math.random() - 0.5)*1.4, vy: oy*out + Math.random()*1.3 - 0.2, vz: cvz*0.85 + oz*out + (Math.random() - 0.5)*1.4,
      gy: surf ? surf.height(_a.x, _a.z) : 0, life: 0, max: 5 + Math.random()*4, sz: 0.012 + Math.random()*0.018, a: Math.random()*6.28, w: (Math.random() - 0.5)*24, ax: Math.random() - 0.5, ay: Math.random() - 0.5, az: Math.random() - 0.5 || 1, rest: false, flat: false });
    const l = Math.hypot(q.ax, q.ay, q.az) || 1; q.ax /= l; q.ay /= l; q.az /= l;
  }
  if (!S.on) { S.on = true; S.last = performance.now(); requestAnimationFrame(step); }
}
function sound(G, v, big) {
  const A = G.audio, c = G.camera; if (!A || !A.noiseBurst || !c) return;
  const d = Math.hypot(v.x - c.position.x, v.z - c.position.z); if (d > 60) return;
  const k = big*Math.max(0.15, 1 - d/60);
  if (big >= 1) {
    A.noiseBurst(0.07, 5200 + Math.random()*900, 1.1, 0.24*k); A.noiseBurst(0.2, 2900, 0.7, 0.13*k);
    for (let i = 0; i < 7; i++) setTimeout(() => A.noiseBurst(0.025, 6200 + Math.random()*2600, 7, 0.07*k*(1 - i/9)), 90 + i*70 + Math.random()*60);
  } else { A.noiseBurst(0.035, 4300 + Math.random()*800, 3, 0.2*k); A.noiseBurst(0.05, 1500, 1.2, 0.09*k); }
}

// ---------------------------------------------------------------- what a blow does to the glass
function hook(v) {
  const m = v.glassMesh; if (!m || m._crkHook) return; m._crkHook = true;
  const b0 = m.onBeforeRender, a0 = m.onAfterRender;
  m.onBeforeRender = function (r, sc, cam, geo, mat, grp) {
    b0 && b0.call(this, r, sc, cam, geo, mat, grp);
    const u = mat && mat.uniforms && mat.uniforms.uCrk, C = v._gb ? v._gb.cracks : null; if (!u || !C || !C.length) return;
    for (let i = 0; i < 3; i++) { const c = C[i]; if (c) u.value[i].set(c.x, c.y, c.z, c.w); else u.value[i].w = 0; }
    mat.uniformsNeedUpdate = true; this._crkOn = true;
  };
  m.onAfterRender = function (r, sc, cam, geo, mat, grp) {
    a0 && a0.call(this, r, sc, cam, geo, mat, grp);
    if (!this._crkOn) return; this._crkOn = false;
    const u = mat && mat.uniforms && mat.uniforms.uCrk; if (u) { for (let i = 0; i < 3; i++) u.value[i].w = 0; mat.uniformsNeedUpdate = true; }
  };
}
function hitGlass(v, lx, ly, lz, r, depth) {
  const D = v._dg, G = G0(); if (!D || !D.glass || !D.g0 || !G) return;
  const S = v._gb && v._gb.geo === D.glass ? v._gb : (v._gb = { geo: D.glass, panes: panesOf(D.glass, D.g0), cracks: [] });
  for (const pn of S.panes) {
    if (pn.gone) continue;
    const cx = cl(lx, pn.min[0], pn.max[0]), cy = cl(ly, pn.min[1], pn.max[1]), cz = cl(lz, pn.min[2], pn.max[2]), d = Math.hypot(cx - lx, cy - ly, cz - lz);
    if (d >= r) continue;
    const f = 1 - d*d/(r*r), push = depth*f*f;
    if (pn.wind) {
      if (push < 0.012) continue;
      // a new crack where it was struck, wider the harder; the three worst are kept
      S.cracks.push({ x: cx, y: cy, z: cz, w: cl(0.2 + push*3.2, 0.22, 0.8) }); S.cracks.sort((a, b) => b.w - a.w); S.cracks.length = Math.min(3, S.cracks.length);
      hook(v); sound(G, v, 0.6);
    } else if (push >= 0.02) {
      pn.gone = true;
      const g = D.glass, n = g.attributes.position.count;
      let A = g.attributes.aGone; if (!A) { A = new THREE.BufferAttribute(new Float32Array(n), 1); g.setAttribute('aGone', A); }
      for (const i of pn.verts) A.array[i] = 1;
      A.needsUpdate = true; g.attributes.position.needsUpdate = true;        // (the inside of the pane goes with it: beta/vehicles/cockpit.js)
      try { burst(G, v, pn, g); } catch (e) { /* no bits: the pane's still gone */ }
      sound(G, v, 1);
    }
  }
}
const dent0 = V.dent;
V.dent = function (lx, ly, lz, nx, ny, nz, r, depth) {
  const out = dent0.call(this, lx, ly, lz, nx, ny, nz, r, depth);
  try { hitGlass(this, lx, ly, lz, r, depth); } catch (e) { console.warn('glass', e); }
  return out;
};
