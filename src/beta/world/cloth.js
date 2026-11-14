// An umbrella's canopy torn off its ribs: cloth, not a lid. Hit hard (a car into a cobbler's umbrella or a fruit
// cart's, or into someone walking under theirs in the rain) the cloth comes away from the frame, goes up turned inside
// out on the blow, fills and tumbles on the air, drifts on the wind as it comes down, and lies crumpled where it lands.
// A car passing close lifts it and drags it along a little. The bare frame is its own thing (world/smash.js for the
// street's, a stick here for one out of a hand). Each cloth is a small net of points held at their lengths (it can't
// stretch, it can fold), pushed by the air across its own surface, so a flat sheet falls slowly and an edge-on one drops.
// A few at a time: the oldest one lying still goes when another is torn.
import * as THREE from 'three';

const NR = 5, NS = 16, N = 1 + NR*NS, MAX = 10, G = 9.81, SUB = 1/90;
const at = (i, j) => i === 0 ? 0 : 1 + (i - 1)*NS + ((j % NS) + NS) % NS;
// the net: one fan of triangles round the middle, then rings; drawn on both faces (the second set of points is the
// underside, its normals turned over)
const TRI = [];
for (let j = 0; j < NS; j++) TRI.push(0, at(1, j + 1), at(1, j));
for (let i = 1; i < NR; i++) for (let j = 0; j < NS; j++) TRI.push(at(i, j), at(i, j + 1), at(i + 1, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
const IDX = new Uint16Array(TRI.length*2);
for (let k = 0; k < TRI.length; k += 3) { IDX.set([TRI[k], TRI[k + 1], TRI[k + 2]], k); IDX.set([TRI[k] + N, TRI[k + 2] + N, TRI[k + 1] + N], TRI.length + k); }
// what holds it together: along each rib, round each ring, and across each panel both ways
const PAIR = [];
for (let i = 1; i <= NR; i++) for (let j = 0; j < NS; j++) {
  PAIR.push(at(i - 1, j), at(i, j)); PAIR.push(at(i, j), at(i, j + 1));
  if (i < NR) { PAIR.push(at(i, j), at(i + 1, j + 1)); PAIR.push(at(i, j + 1), at(i + 1, j)); }
  if (i + 2 <= NR) PAIR.push(at(i, j), at(i + 2, j));
}
const cloths = [], sticks = [];
let stdMat = null, wT = 0;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
const hsh = (n) => { const s = Math.sin(n*12.9898 + 78.233)*43758.5453; return s - Math.floor(s); };
const ask = () => window.__nhAskG;
const groundAt = (x, z) => { const g = ask(), W = g && g.W; try { return W && W.surf ? W.surf.height(x, z) : 0; } catch (e) { return 0; } };

function drop(c) {
  if (c.dead) return; c.dead = true;
  c.mesh.parent && c.mesh.parent.remove(c.mesh); c.mesh.geometry.dispose();
  if (c.ownMat) c.mesh.material.dispose();
  const i = cloths.indexOf(c); if (i >= 0) cloths.splice(i, 1);
}
export function dropCloth(c) { if (c) drop(c); }

// o: scene, mat (the street's own, with colour and glow per point) or none, top (Vector3: the canopy's crown),
// q (how it stood), R, drop (crown to rim), col [r, g, b] (linear), vel (Vector3), keep (stays until taken away)
export function tearCloth(o) {
  if (cloths.length >= MAX) { const old = cloths.find(c => c.sleep > 1) || cloths[0]; drop(old); }
  const P = new Float32Array(N*3), Q = new Float32Array(N*3), rest = new Float32Array(PAIR.length/2), off = new Float32Array(N);
  const q = o.q || _q.identity(), seed = o.top.x*1.7 + o.top.z*2.3;
  const spin = (hsh(seed) - 0.5)*5, lift = 2.2 + hsh(seed + 1)*1.6;
  for (let i = 0; i <= NR; i++) for (let j = 0; j < (i ? NS : 1); j++) {
    const w = i/NR, a = j/NS*6.2832, k = at(i, j)*3;
    _a.set(Math.cos(a)*w*o.R, -o.drop*Math.pow(w, 1.5), Math.sin(a)*w*o.R);
    P[k] = _a.x; P[k + 1] = _a.y; P[k + 2] = _a.z;
  }
  for (let k = 0; k < PAIR.length; k += 2) { const a = PAIR[k]*3, b = PAIR[k + 1]*3; rest[k/2] = Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]); }
  const dt = 1/60;
  for (let n = 0; n < N; n++) {
    const k = n*3; _a.set(P[k], P[k + 1], P[k + 2]);
    const w = Math.hypot(_a.x, _a.z)/o.R;
    // off the ribs rim first: the edge goes up past the crown (inside out), the whole of it turning
    _b.set(-_a.z*spin, lift*(0.55 + 0.9*w) + (hsh(seed + n) - 0.5)*1.2, _a.x*spin).applyQuaternion(q);
    _a.applyQuaternion(q).add(o.top);
    P[k] = _a.x; P[k + 1] = _a.y; P[k + 2] = _a.z;
    const f = 0.75 + hsh(seed + n*3)*0.35;
    Q[k] = _a.x - (o.vel.x*f + _b.x)*dt; Q[k + 1] = _a.y - (o.vel.y + _b.y)*dt; Q[k + 2] = _a.z - (o.vel.z*f + _b.z)*dt;
    off[n] = 0.012 + hsh(seed + n*7)*0.05*(hsh(seed + n*11) > 0.6 ? 2.2 : 1);       // (it doesn't lie ironed flat: folds stand up off the road)
  }
  const g = new THREE.BufferGeometry(), pos = new Float32Array(N*6), nor = new Float32Array(N*6), col = new Float32Array(N*6);
  const c0 = o.col || [0.02, 0.02, 0.02];
  for (let n = 0; n < N; n++) { const s = 0.92 + hsh(seed + n*5)*0.12; col.set([c0[0]*s, c0[1]*s, c0[2]*s], n*3); col.set([c0[0]*s*0.72, c0[1]*s*0.72, c0[2]*s*0.72], (N + n)*3); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(N*2), 1));
  g.setIndex(new THREE.BufferAttribute(IDX, 1));
  const mat = o.mat || stdMat || (stdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.name = 'cloth';
  o.scene.add(mesh);
  const c = { mesh, P, Q, rest, off, nrm: new Float32Array(N*3), t: 0, acc: 0, sleep: 0, keep: !!o.keep, gy: groundAt(o.top.x, o.top.z), seed, dead: false };
  cloths.push(c); normals(c); upload(c);
  return c;
}

function normals(c) {
  const P = c.P, M = c.nrm; M.fill(0);
  for (let k = 0; k < TRI.length; k += 3) {
    const a = TRI[k]*3, b = TRI[k + 1]*3, d = TRI[k + 2]*3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[a], vy = P[d + 1] - P[a + 1], vz = P[d + 2] - P[a + 2];
    const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
    M[a] += nx; M[a + 1] += ny; M[a + 2] += nz; M[b] += nx; M[b + 1] += ny; M[b + 2] += nz; M[d] += nx; M[d + 1] += ny; M[d + 2] += nz;
  }
  for (let k = 0; k < N*3; k += 3) { const l = Math.hypot(M[k], M[k + 1], M[k + 2]) || 1; M[k] /= l; M[k + 1] /= l; M[k + 2] /= l; }
}
function upload(c) {
  const g = c.mesh.geometry, p = g.attributes.position.array, n = g.attributes.normal.array;
  p.set(c.P, 0); p.set(c.P, N*3); n.set(c.nrm, 0);
  for (let k = 0; k < N*3; k++) n[N*3 + k] = -c.nrm[k];
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
}
function sim(c, h, wx, wz) {
  const P = c.P, Q = c.Q, M = c.nrm, off = c.off, gy = c.gy;
  let fast = 0, on = 0; const dmp = c.down ? 0.86 : 1;                    // (down, it comes to rest: wet cloth on a road doesn't shiver)
  for (let n = 0; n < N; n++) {
    const k = n*3;
    const up = P[k + 1] - gy, d = up < 0.3 ? dmp : 1;
    let vx = (P[k] - Q[k])/h*d, vy = (P[k + 1] - Q[k + 1])/h*d, vz = (P[k + 2] - Q[k + 2])/h*d;
    // the air: hard across the cloth's face (it's a sail), hardly at all along it; and gusty up off the ground
    const gust = up > 0.12 ? 1 + 0.6*Math.sin(c.t*2.3 + n*0.7 + c.seed) : 0.15;
    const ux = wx*gust - vx, uy = -vy, uz = wz*gust - vz, un = ux*M[k] + uy*M[k + 1] + uz*M[k + 2];
    const kn = Math.min(0.9, 7*h), kt = 0.35*h;
    vx += M[k]*un*kn + ux*kt; vy += M[k + 1]*un*kn + uy*kt - G*h; vz += M[k + 2]*un*kn + uz*kt;
    Q[k] = P[k]; Q[k + 1] = P[k + 1]; Q[k + 2] = P[k + 2];
    P[k] += vx*h; P[k + 1] += vy*h; P[k + 2] += vz*h;
    const fl = gy + off[n];
    if (P[k + 1] < fl) { on++; P[k + 1] = fl; Q[k + 1] = fl; Q[k] += (P[k] - Q[k])*0.55; Q[k + 2] += (P[k + 2] - Q[k + 2])*0.55; }   // (wet road holds it)
    const s = vx*vx + vy*vy + vz*vz; if (s > fast) fast = s;
  }
  for (let it = 0; it < 2; it++) for (let k = 0; k < PAIR.length; k += 2) {
    const a = PAIR[k]*3, b = PAIR[k + 1]*3, r = c.rest[k/2];
    const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6;
    // it won't stretch; it folds almost freely
    const f = (d - r)/d*(d > r ? 0.5 : 0.04);
    P[a] += dx*f; P[a + 1] += dy*f; P[a + 2] += dz*f; P[b] -= dx*f; P[b + 1] -= dy*f; P[b + 2] -= dz*f;
  }
  c.down = on > N*0.55;
  return fast;
}

// ---------------------------------------------------------------- a stick: a bare frame, or a whole umbrella let go of
// o: scene, mesh, p, q, v, tilt (how far over it lies, rad), lift
export function dropStick(o) {
  if (sticks.length >= MAX) { const s = sticks.shift(); s.mesh.parent && s.mesh.parent.remove(s.mesh); s.own && s.mesh.material.dispose(); }
  o.mesh.position.copy(o.p); o.mesh.quaternion.copy(o.q || _q.identity()); o.scene.add(o.mesh);
  const sd = o.p.x + o.p.z;
  sticks.push({ mesh: o.mesh, v: o.v.clone(), w: new THREE.Vector3(hsh(sd) - 0.5, (hsh(sd + 1) - 0.5)*0.5, hsh(sd + 2) - 0.5).normalize(), ws: 3 + hsh(sd + 3)*5, tilt: o.tilt ?? 1.5, lift: o.lift ?? 0.02, t: 0, still: 0, own: !!o.own });
}
function stickStep(s, dt) {
  const m = s.mesh, gy = groundAt(m.position.x, m.position.z) + s.lift;
  s.t += dt;
  if (s.still > 0.6) return;
  s.v.y -= G*dt; m.position.addScaledVector(s.v, dt);
  if (s.ws > 0.01) { _q.setFromAxisAngle(s.w, s.ws*dt); m.quaternion.premultiply(_q); }
  if (m.position.y <= gy) {
    m.position.y = gy;
    if (s.v.y < -1.2) s.v.y *= -0.3; else s.v.y = 0;
    s.v.x *= Math.max(0, 1 - 6*dt); s.v.z *= Math.max(0, 1 - 6*dt); s.ws *= Math.max(0, 1 - 8*dt);
    // over onto its side, the way it was already going
    _a.set(0, 1, 0).applyQuaternion(m.quaternion); const hl = Math.hypot(_a.x, _a.z);
    if (hl < 1e-3) _a.set(1, 0, 0); else _a.set(_a.x/hl, 0, _a.z/hl);
    _b.set(_a.x*Math.sin(s.tilt), Math.cos(s.tilt), _a.z*Math.sin(s.tilt));
    _q2.setFromUnitVectors(UP, _b);
    m.quaternion.rotateTowards(_q2, 7*dt);
    if (s.v.lengthSq() < 0.01 && m.quaternion.angleTo(_q2) < 0.02) s.still += dt;
  }
}

// cars: [{ x, z, vx, vz }] (world/smash.js tick)
export function clothStep(dt, cars) {
  if (!cloths.length && !sticks.length) return;
  const g = ask(), cam = g && g.camera, rain = (g && g.weather && g.weather.cur && g.weather.cur.rain) || 0;
  wT += dt;
  const ws = 0.9 + 1.6*Math.min(1, +rain || 0), wa = 0.7 + Math.sin(wT*0.11)*0.9, wx = Math.cos(wa)*ws*(1 + 0.5*Math.sin(wT*0.9)), wz = Math.sin(wa)*ws*(1 + 0.5*Math.sin(wT*0.9));
  for (let i = cloths.length - 1; i >= 0; i--) {
    const c = cloths[i]; c.t += dt;
    const P = c.P, mx = P[0], mz = P[2];
    // a car going by close: its draught has the cloth up again
    if (cars && c.sleep > 0.2) for (const v of cars) {
      const sp = Math.hypot(v.vx || 0, v.vz || 0); if (sp < 4) continue;
      const dx = mx - v.x, dz = mz - v.z; if (dx*dx + dz*dz > 6.5) continue;
      for (let n = 0; n < N; n++) { const k = n*3, f = (0.02 + hsh(c.seed + n + c.t)*0.05)/60; c.Q[k] -= (v.vx || 0)*f; c.Q[k + 2] -= (v.vz || 0)*f; c.Q[k + 1] -= sp*f*(0.6 + hsh(n + c.t)); }
      c.sleep = 0; c.down = false; break;
    }
    if (c.sleep > 1.2) {
      if (!c.keep && cam && c.t > 70 && Math.hypot(mx - cam.position.x, mz - cam.position.z) > 45) drop(c);
      else if (!c.keep && c.t > 240) drop(c);
      continue;
    }
    c.gy = groundAt(mx, mz);
    c.acc = Math.min(c.acc + dt, SUB*4);
    let fast = 0, did = false;
    while (c.acc >= SUB) { c.acc -= SUB; fast = Math.max(fast, sim(c, SUB, wx, wz)); did = true; }
    if (!did) continue;
    normals(c); upload(c);
    if (c.down && c.t > 1) c.sleep += dt*0.6; else c.sleep = 0;
  }
  for (let i = sticks.length - 1; i >= 0; i--) {
    const s = sticks[i]; stickStep(s, dt);
    if (s.t > 70 && cam && Math.hypot(s.mesh.position.x - cam.position.x, s.mesh.position.z - cam.position.z) > 45 || s.t > 240) { s.mesh.parent && s.mesh.parent.remove(s.mesh); s.own && s.mesh.material.dispose(); sticks.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- the umbrella in someone's hand (people/crowd.js)
// Knocked down by a car, the umbrella's gone from their hand: its cloth torn off and away on the air, the bare frame
// (the shaft, the ribs sprung up inside out) dropped where they were hit. Shoved over or punched down, it's only
// dropped, whole. Either way they get up without it and walk on in the rain.
const KIND = [{ r: 0.5, h: 0.24, ribs: 8, shaft: 0.74 }, { r: 0.62, h: 0.22, ribs: 8, shaft: 0.82 }, { r: 0.43, h: 0.2, ribs: 6, shaft: 0.62 }];
const FRAME = [];
let frameMat = null;
function frameGeo(kind, src) {
  if (FRAME[kind]) return FRAME[kind];
  const K = KIND[kind], top = K.shaft + 0.06, cut = 7*K.ribs*4*6;                   // (the canopy's the first of it: people/umbrella.js)
  const g = new THREE.BufferGeometry(), P = src.attributes.position.array.slice(cut*3), Nn = src.attributes.normal.array.slice(cut*3);
  const pos = [...P], nor = [...Nn];
  // the ribs, sprung up past the crown
  for (let k = 0; k < K.ribs; k++) {
    const a = k/K.ribs*6.2832 + 0.1, len = K.r*0.98, up = 0.1 + hsh(k + kind*9)*0.2*(k % 3 ? 1 : -1.6);
    const r = new THREE.CylinderGeometry(0.004, 0.004, len, 3); r.translate(0, len/2, 0);
    _a.set(Math.cos(a)*Math.cos(up), Math.sin(up), Math.sin(a)*Math.cos(up)).normalize();
    r.applyQuaternion(_q.setFromUnitVectors(UP, _a)); r.translate(0, top, 0);
    const q = r.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return (FRAME[kind] = g);
}
window.__nhUmbDrop = (crowd, p, umb) => {
  try {
    if (p._noUmb === p.id) return;
    p._noUmb = p.id;
    const kind = Math.max(0, KIND.findIndex(K => Math.abs(K.shaft + 0.06 - (umb.geometry.boundingBox || (umb.geometry.computeBoundingBox(), umb.geometry.boundingBox)).max.y + 0.07) < 0.03)), K = KIND[kind];
    const thrown = p.dodge > 0 ? Math.hypot(p.dodgeVX || 0, p.dodgeVZ || 0) : 0, hard = thrown > 1.6 || p.corpse || p.ko;
    const dx = thrown ? p.dodgeVX : Math.cos(p.yaw || 0)*0.6, dz = thrown ? p.dodgeVZ : Math.sin(p.yaw || 0)*0.6, scene = umb.parent || crowd.scene;
    const c = umb.material.color, q = umb.quaternion.clone();
    if (hard) {
      const top = new THREE.Vector3(0, K.shaft + 0.06, 0).applyQuaternion(q).add(umb.position);
      tearCloth({ scene, top, q, R: K.r, drop: K.h, col: [c.r, c.g, c.b], vel: new THREE.Vector3(dx*1.5, 2 + Math.min(4, thrown*0.5), dz*1.5) });
      frameMat = frameMat || new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.45, metalness: 0.5 });
      const m = new THREE.Mesh(frameGeo(kind, umb.geometry), frameMat); m.castShadow = true;
      dropStick({ scene, mesh: m, p: umb.position.clone(), q, v: new THREE.Vector3(dx*0.9, 1.5 + thrown*0.2, dz*0.9), tilt: 1.5, lift: 0.03 });
    } else {
      const m = new THREE.Mesh(umb.geometry, umb.material.clone()); m.castShadow = true;
      dropStick({ scene, mesh: m, p: umb.position.clone(), q, v: new THREE.Vector3(dx, 1.2, dz), tilt: 0.84, lift: 0.04, own: true });
    }
  } catch (e) { console.warn('umbrella', e); }
};
