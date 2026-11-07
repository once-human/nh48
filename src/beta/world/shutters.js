// Rolling shutters that roll. When a shop opens or shuts with the clock its shutter goes up or comes down over a few
// seconds, rattling if you're near enough to hear it, and the shop's board light goes with it: lit while it's open,
// fading as the shutter comes down, dark once it's shut. (setShutters, patched in build-beta.mjs, only says where
// each should end up; this moves them.)
import * as THREE from 'three';
import { People } from '@orig/people/peds.js';
import { NearBoards } from '@orig/gfx/boards.js';
import { glowSafe } from './buildings.js';
import { U as GU } from '@orig/gfx/materials.js';

const SECS = 3.5, HEAR = 40;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const sm = (k) => k*k*(3 - 2*k);

// the light of each board on a chunk, from its shop's shutter (a board with no shutter of its own stays lit)
function glow(C) {
  const G = C.glow; if (!G || !C.shutters) return;
  const byDoor = G.byDoor || (G.byDoor = new Map(C.shutters.list.filter(r => r.door).map(r => [r.door, r])));
  for (const b of G.recs) {
    const r = byDoor.get(b.door), a = G[b.o ? 'o' : 's']; if (!a) continue;
    const v = r ? sm(r.k ?? 1) : 1;
    if (a.array[b.v] === v) continue;
    a.array.fill(v, b.v, b.v + 4); a.needsUpdate = true;
  }
}
// The light over an open shop: most have a white tube on the fascia above the shutter, some a warm one, a few a coloured
// LED strip (pink, blue, green), and some none. It's on while the shop is open and goes off as the shutter comes down,
// a pale bar by day and the brightest thing on the street at night, the way a car's lamps are.
const TUBE = new THREE.BoxGeometry(1, 1, 1), tubes = new Set();
const TUBE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
const hashR = (x, z) => { const h = Math.sin(x*12.9898 + z*78.233)*43758.5453; return h - Math.floor(h); };
const TINTS = [[0.82, 0.93, 1], [1, 0.78, 0.5], [1, 0.32, 0.62], [0.32, 0.86, 1], [0.42, 1, 0.55], [0.45, 0.52, 1]];
function tubesFor(C) {
  const S = C.shutters, par = S.im.parent; if (!par) return null;
  const has = S.list.map(r => hashR(r.x, r.z) < 0.78);
  const n = has.filter(Boolean).length; if (!n) return (S.tubes = { im: null });
  const im = new THREE.InstancedMesh(TUBE, TUBE_MAT, n); im.frustumCulled = false; im.castShadow = im.receiveShadow = false;
  const c = new THREE.Color(), recs = [];
  S.list.forEach((r, i) => {
    if (!has[i]) return;
    const h = hashR(r.z, r.x), t = h < 0.62 ? 0 : h < 0.8 ? 1 : 2 + Math.floor((h - 0.8)/0.05);
    const T = TINTS[Math.min(5, t)]; c.setRGB(T[0], T[1], T[2]);
    im.setColorAt(recs.length, c);
    recs.push({ r, w: r.w*(t < 2 ? 0.55 + hashR(r.x + 1, r.z)*0.25 : 0.92), led: t >= 2 });
  });
  S.tubes = { im, recs }; par.add(im); tubes.add(im);
  // (drawn only when the street they're on is in view)
  placeTubes(S, true); im.computeBoundingSphere(); im.frustumCulled = true;
  return S.tubes;
}
function placeTubes(S, all) {
  const T = S.tubes; if (!T || !T.im) return;
  T.recs.forEach((q, i) => {
    const r = q.r, v = all ? 1 : sm(r.k ?? 1), nx = Math.sin(r.ry), nz = Math.cos(r.ry);
    if (v < 0.02) { T.im.setMatrixAt(i, ZERO); return; }
    const o = q.led ? 0.1 : 0.07;
    _p.set(r.x + nx*o, r.y + r.h + (q.led ? -0.06 : -0.14), r.z + nz*o); _q.setFromEuler(_e.set(0, r.ry, 0));
    _s.set(q.w, (q.led ? 0.03 : 0.045)*v, (q.led ? 0.02 : 0.045)*v);
    T.im.setMatrixAt(i, _m.compose(_p, _q, _s));
  });
  T.im.instanceMatrix.needsUpdate = true;
}
// brighter as it gets dark (overbright at night so it blooms where there's bloom, as the lamps do)
function tubeLight() {
  const k = 0.95 + GU.uNight.value*2.4;
  TUBE_MAT.color.setScalar(k);
  for (const im of tubes) if (!im.parent || !im.parent.parent) { im.dispose(); im.parent && im.parent.remove(im); tubes.delete(im); }
}
// a steel shutter on its rails: a long rattle, a clank at the end
function rattle(G, r, up) {
  const A = G.audio; if (!A || !A.noiseBurst) return;
  const at = { x: r.x, z: r.z };
  A.noiseBurst(SECS*0.9, up ? 900 : 700, 1.4, 0.18, at);
  A.noiseBurst(SECS*0.9, 2400, 3, 0.06, at);
  setTimeout(() => A.noiseBurst(0.18, 300, 1.2, 0.3, at), SECS*1000*0.92);
}
function step(G, dt, px, pz) {
  for (const C of G.W.streamer.built) {
    const S = C.shutters; if (!S) continue;
    if (!S.tubes && tubesFor(C)) placeTubes(S);
    if (S.lit !== S.seen) { if (!S.lit) for (const r of S.list) if (r.door) r.door._sh = r; S.lit = S.seen; glow(C); placeTubes(S); }
    if (!S.moving) continue;
    let any = false;
    S.list.forEach((r, i) => {
      if (r.k === r.t || r.k === undefined) return;
      if (!r.rolling) { r.rolling = true; if (Math.hypot(r.x - px, r.z - pz) < HEAR) rattle(G, r, r.t > r.k); }
      r.k = r.t > r.k ? Math.min(r.t, r.k + dt/SECS) : Math.max(r.t, r.k - dt/SECS);
      if (r.k === r.t) r.rolling = false; else any = true;
      // rolled up into its box at the top: the bottom edge rises, the steel above it is in the box
      const down = 1 - r.k;
      if (down < 0.002) { S.im.setMatrixAt(i, ZERO); return; }
      _p.set(r.x, r.y + r.h*(1 - down), r.z); _q.setFromEuler(_e.set(0, r.ry, 0)); _s.set(r.w, r.h*down, 1);
      S.im.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    S.im.instanceMatrix.needsUpdate = true;
    glow(C); placeTubes(S);
    S.moving = any;
  }
}
const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...a) {
  const out = upd.call(this, dt, player, ...a), G = this._G;
  if (G && G.W && G.W.streamer) { step(G, Math.min(dt, 0.1), player.x, player.z); tubeLight(); }
  return out;
};

// the boards drawn up close carry the same light as the ones on the chunk
const nbUpd = NearBoards.prototype.update;
NearBoards.prototype.update = function (...a) {
  const out = nbUpd.apply(this, a), g = this.geo;
  if (!this._glow) { this._glow = true; this.mat.userData.glow = true; this.mat.customProgramCacheKey = () => 'glow'; glowSafe(this.mat); this.mat.needsUpdate = true; }
  let A = g.attributes.aGlow;
  if (!A) { A = new THREE.BufferAttribute(new Float32Array(this.pos.length/3).fill(1), 1).setUsage(THREE.DynamicDrawUsage); g.setAttribute('aGlow', A); }
  let q = 0, ch = false;
  for (const r of this.want || []) {
    if (this.slotOf.get(r) === undefined) continue;
    const s = r.door && r.door._sh, v = s ? sm(s.k ?? 1) : 1;
    if (A.array[q*4] !== v) { A.array.fill(v, q*4, q*4 + 4); ch = true; }
    q++;
  }
  if (ch) A.needsUpdate = true;
  return out;
};
