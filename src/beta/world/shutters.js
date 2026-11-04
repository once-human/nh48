// Rolling shutters that roll. When a shop opens or shuts with the clock its shutter goes up or comes down over a few
// seconds, rattling if you're near enough to hear it, and the shop's board light goes with it: lit while it's open,
// fading as the shutter comes down, dark once it's shut. (setShutters, patched in build-beta.mjs, only says where
// each should end up; this moves them.)
import * as THREE from 'three';
import { People } from '@orig/people/peds.js';
import { NearBoards } from '@orig/gfx/boards.js';

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
    if (S.lit !== S.seen) { if (!S.lit) for (const r of S.list) if (r.door) r.door._sh = r; S.lit = S.seen; glow(C); }
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
    glow(C);
    S.moving = any;
  }
}
const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...a) {
  const out = upd.call(this, dt, player, ...a), G = this._G;
  if (G && G.W && G.W.streamer) step(G, Math.min(dt, 0.1), player.x, player.z);
  return out;
};

// the boards drawn up close carry the same light as the ones on the chunk
const nbUpd = NearBoards.prototype.update;
NearBoards.prototype.update = function (...a) {
  const out = nbUpd.apply(this, a), g = this.geo;
  if (!this._glow) { this._glow = true; this.mat.userData.glow = true; this.mat.customProgramCacheKey = () => 'glow'; this.mat.needsUpdate = true; }
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
