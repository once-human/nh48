// The light that isn't the sun: one small map of where every street lamp's pool falls around you, redrawn as you go, and
// one cone for your headlight or torch. Every painted surface looks it up once. (The GLSL is LAMP in gfx/paint.js.)
import * as THREE from 'three';
import { PU } from './paint.js';
import { U as GU } from '@orig/gfx/materials.js';

const N = 256, SIZE = 256, R = 15, STEP = 30, SPILL = 5.5;

// an open shop lights the pavement in front of it: bright at the door, gone in a few metres, nothing behind the wall.
// A lifted shutter is the one the game scaled to nothing (it decides who's open, this only reads it)
const isUp = (a, i) => a[i*16] === 0 && a[i*16 + 2] === 0;
export function shopSpill(d, x0, z0, k, r) {
  const nx = Math.sin(r.ry), nz = Math.cos(r.ry), tx = nz, tz = -nx, hw = r.w/2 + 1.4, cu = (r.x - x0)*k, cv = (r.z - z0)*k, m = (hw + SPILL)*k;
  if (cu < -m || cv < -m || cu > N + m || cv > N + m) return;
  for (let j = Math.max(1, Math.ceil(cv - m)), je = Math.min(N - 2, Math.floor(cv + m)); j <= je; j++) for (let i = Math.max(1, Math.ceil(cu - m)), ie = Math.min(N - 2, Math.floor(cu + m)); i <= ie; i++) {
    const dx = (i - cu)/k, dz = (j - cv)/k, out = dx*nx + dz*nz, al = Math.abs(dx*tx + dz*tz); if (out < .05 || out > SPILL || al > hw) continue;
    const q = 1 - out/SPILL, e = Math.min(1, (hw - al)/1.4), o = j*N + i, n = d[o] + 150*q*q*e; d[o] = n > 255 ? 255 : n;
  }
}
const p = new THREE.Vector3(), t = new THREE.Vector3();

export class Lamps {
  constructor(G) {
    this.G = G; this.d = new Uint8Array(N*N); this.x = 1e9; this.z = 1e9; this.count = -1; this.shops = -1; this.shopT = 0;
    const T = this.tex = new THREE.DataTexture(this.d, N, N, THREE.RedFormat, THREE.UnsignedByteType); T.minFilter = T.magFilter = THREE.LinearFilter; T.unpackAlignment = 1; T.needsUpdate = true;
    PU.tLamp.value = T;
  }
  draw(cx, cz) {
    const d = this.d, ls = this.G.W.lampPositions || [], night = GU.uNight.value; d.fill(0);
    this.x = cx; this.z = cz; this.count = ls.length;
    const x0 = cx - SIZE/2, z0 = cz - SIZE/2, k = N/SIZE, r = R*k, r2 = r*r;
    for (const l of ls) {
      const u = (l[0] - x0)*k, v = (l[1] - z0)*k; if (u < -r || v < -r || u > N + r || v > N + r) continue;
      // no two lamps quite the same, and they don't all come on together: one street's sooner than the next, and the odd
      // old tube can't make up its mind
      const h1 = ((l[0]*7.3 + l[1]*3.1) % 1 + 1) % 1, h2 = ((l[0]*2.9 - l[1]*5.7) % 1 + 1) % 1;
      if (night < 0.03 + h2*0.5) continue;
      let a = 170 + h1*85;
      if (h2 > 0.93 && Math.random() < 0.42) { a *= 0.12 + Math.random()*0.3; }
      for (let j = Math.max(1, Math.ceil(v - r)), je = Math.min(N - 2, Math.floor(v + r)); j <= je; j++) for (let i = Math.max(1, Math.ceil(u - r)), ie = Math.min(N - 2, Math.floor(u + r)); i <= ie; i++) {
        const q = 1 - ((i - u)*(i - u) + (j - v)*(j - v))/r2; if (q <= 0) continue;
        const o = j*N + i, n = d[o] + a*q*q; d[o] = n > 255 ? 255 : n;
      }
    }
    this.shops = this.eachShop((r) => shopSpill(d, x0, z0, k, r));
    this.tex.needsUpdate = true;
    PU.lampC.value.set(cx, cz, 1/SIZE, 0);
  }
  eachShop(fn) {
    const built = this.G.W.streamer?.built; let n = 0; if (!built) return n;
    for (const c of built) { const S = c.shutters; if (!S) continue; const a = S.im.instanceMatrix.array; S.list.forEach((r, i) => { if (isUp(a, i)) { n++; if (fn) fn(r); } }); }
    return n;
  }
  // shops open and shut with the clock, and new streets load in: look every couple of seconds
  shopsMoved(night) {
    const t = performance.now(); if (night <= .01 || t < this.shopT) return false;
    this.shopT = t + 2000; return this.eachShop() !== this.shops;
  }
  update() {
    const G = this.G, P = G.player, night = GU.uNight.value; if (!P) return;
    const F = P.onFoot ? P.foot : P, cx = F.x, cz = F.z, C = PU.lampC.value;
    const step = Math.floor(night*16), tick = performance.now();
    // (redrawn too as dusk comes on, lamp by lamp, and a few times a second if a tired tube's flickering near you)
    let flick = false;
    if (night > .3 && tick > (this.flT || 0)) { this.flT = tick + 120 + Math.random()*520; for (const l of G.W.lampPositions || []) if (Math.abs(l[0] - cx) < 50 && Math.abs(l[1] - cz) < 50 && ((l[0]*2.9 - l[1]*5.7) % 1 + 1) % 1 > 0.93) { flick = true; break; } }
    if (night > .01 && (flick || step !== this.nStep || Math.hypot(cx - this.x, cz - this.z) > STEP || (G.W.lampPositions || []).length !== this.count || this.shopsMoved(night))) { this.nStep = step; this.draw(Math.round(cx/4)*4, Math.round(cz/4)*4); }
    C.w = (G.interiors && G.interiors.inside) ? 0 : night;
    PU.lampY.value = F.y || 0;
    // your own light: whichever of the two is on, as the game aims it
    // (a bicycle has none; a car, a bus or a tempo two, one from each housing; a two-wheeler or an auto one)
    const S = !P.onFoot && P.spec, cycle = S && S.name === 'Bicycle';
    const L = G.lights && G.lights.torch && G.lights.torch.intensity > 0 ? G.lights.torch : !cycle && P.headlight && P.headlight.intensity > 0 ? P.headlight : null;
    if (L && !(G.interiors && G.interiors.inside)) {
      L.getWorldPosition(p); L.target.getWorldPosition(t); t.sub(p).normalize();
      PU.headP.value.set(p.x, p.y, p.z, L === P.headlight ? 1.5 : 1); PU.headD.value.set(t.x, t.y, t.z, Math.cos(L.angle));
      const pair = L === P.headlight && S && !S.two && S.name !== 'Auto rickshaw', h = pair ? S.W*.36 : 0, l = Math.hypot(t.x, t.z) || 1;
      PU.headS.value.set(-t.z/l*h, 0, t.x/l*h, pair ? 1 : 0);
    } else PU.headP.value.w = 0;
  }
}
