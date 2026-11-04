// The light that isn't the sun: one small map of where every street lamp's pool falls around you, redrawn as you go, and
// one cone for your headlight or torch. Every painted surface looks it up once. (The GLSL is LAMP in gfx/paint.js.)
import * as THREE from 'three';
import { PU } from './paint.js';
import { U as GU } from '@orig/gfx/materials.js';

const N = 256, SIZE = 256, R = 15, STEP = 30;
const p = new THREE.Vector3(), t = new THREE.Vector3();

export class Lamps {
  constructor(G) {
    this.G = G; this.d = new Uint8Array(N*N); this.x = 1e9; this.z = 1e9; this.count = -1;
    const T = this.tex = new THREE.DataTexture(this.d, N, N, THREE.RedFormat, THREE.UnsignedByteType); T.minFilter = T.magFilter = THREE.LinearFilter; T.unpackAlignment = 1; T.needsUpdate = true;
    PU.tLamp.value = T;
  }
  draw(cx, cz) {
    const d = this.d, ls = this.G.W.lampPositions || []; d.fill(0);
    this.x = cx; this.z = cz; this.count = ls.length;
    const x0 = cx - SIZE/2, z0 = cz - SIZE/2, k = N/SIZE, r = R*k, r2 = r*r;
    for (const l of ls) {
      const u = (l[0] - x0)*k, v = (l[1] - z0)*k; if (u < -r || v < -r || u > N + r || v > N + r) continue;
      const a = 170 + (((l[0]*7.3 + l[1]*3.1) % 1 + 1) % 1)*85;      // no two lamps quite the same
      for (let j = Math.max(1, Math.ceil(v - r)), je = Math.min(N - 2, Math.floor(v + r)); j <= je; j++) for (let i = Math.max(1, Math.ceil(u - r)), ie = Math.min(N - 2, Math.floor(u + r)); i <= ie; i++) {
        const q = 1 - ((i - u)*(i - u) + (j - v)*(j - v))/r2; if (q <= 0) continue;
        const o = j*N + i, n = d[o] + a*q*q; d[o] = n > 255 ? 255 : n;
      }
    }
    this.tex.needsUpdate = true;
    PU.lampC.value.set(cx, cz, 1/SIZE, 0);
  }
  update() {
    const G = this.G, P = G.player, night = GU.uNight.value; if (!P) return;
    const F = P.onFoot ? P.foot : P, cx = F.x, cz = F.z, C = PU.lampC.value;
    if (night > .01 && (Math.hypot(cx - this.x, cz - this.z) > STEP || (G.W.lampPositions || []).length !== this.count)) this.draw(Math.round(cx/4)*4, Math.round(cz/4)*4);
    C.w = (G.interiors && G.interiors.inside) ? 0 : night;
    PU.lampY.value = F.y || 0;
    // your own light: whichever of the two is on, as the game aims it
    const L = G.lights && G.lights.torch && G.lights.torch.intensity > 0 ? G.lights.torch : P.headlight && P.headlight.intensity > 0 ? P.headlight : null;
    if (L && !(G.interiors && G.interiors.inside)) { L.getWorldPosition(p); L.target.getWorldPosition(t); t.sub(p).normalize(); PU.headP.value.set(p.x, p.y, p.z, L === P.headlight ? 1.5 : 1); PU.headD.value.set(t.x, t.y, t.z, Math.cos(L.angle)); }
    else PU.headP.value.w = 0;
  }
}
