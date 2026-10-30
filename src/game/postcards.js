// Postcards: the game photographs Pune itself. When you're somewhere (the streets round you built and lit), it
// quietly takes a picture of the landmark nearby from a little way off and up, of the neighbourhood down its
// road, and of where your mission is: by day, 16:9, with the game's own renderer. They're kept in this browser
// (IndexedDB) and used by the map's place card and the missions. Somewhere you haven't been has no picture yet.
import * as THREE from 'three';

const W_ = 640, H_ = 360, DB = 'nh48_postcards', ST = 'pc';
function idb() {
  return new Promise((res) => {
    try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }
    catch (e) { res(null); }
  });
}

export class Postcards {
  constructor(G) {
    this.g = G; this.mem = new Map(); this.t = 2;
    this.db = idb().then(db => {
      if (!db) return null;
      try { const tx = db.transaction(ST, 'readonly'), s = tx.objectStore(ST), rq = s.openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { if (!this.mem.has(c.key)) this.mem.set(c.key, c.value); c.continue(); } }; } catch (e) { /* */ }
      return db;
    });
  }
  get(key) { return this.mem.get(key) || null; }
  put(key, url) {
    this.mem.set(key, url);
    this.db.then(db => { if (!db) return; try { db.transaction(ST, 'readwrite').objectStore(ST).put(url, key); } catch (e) { /* full */ } });
  }
  // is (x, z) built round you right now (close enough that the streets and buildings are there)
  near(x, z, r = 260) { const P = this.g.player; return Math.hypot(x - P.x, z - P.z) < r; }
  // take one: from (fx, fy, fz) looking at (lx, ly, lz)
  shoot(key, fx, fy, fz, lx, ly, lz) {
    const G = this.g, R = G.renderer; if (!R || !G.scene) return null;
    try {
      if (!this.rt) {
        this.rt = new THREE.WebGLRenderTarget(W_, H_, { samples: 4 });
        this.rt.isXRRenderTarget = true; this.rt.texture.colorSpace = THREE.SRGBColorSpace; this.rt.texture.internalFormat = 'RGBA8';
        this.cam = new THREE.PerspectiveCamera(48, W_ / H_, 0.5, 4000);
        this.buf = new Uint8Array(W_ * H_ * 4);
        this.cv = document.createElement('canvas'); this.cv.width = W_; this.cv.height = H_;
        this.cx = this.cv.getContext('2d'); this.img = this.cx.createImageData(W_, H_);
      }
      const C = this.cam; C.position.set(fx, fy, fz); C.lookAt(lx, ly, lz); C.updateMatrixWorld(); C.updateProjectionMatrix();
      const prev = R.getRenderTarget();
      R.setRenderTarget(this.rt); R.render(G.scene, C); R.setRenderTarget(prev);
      R.readRenderTargetPixels(this.rt, 0, 0, W_, H_, this.buf);
      const D = this.img.data, W4 = W_ * 4;
      for (let y = 0; y < H_; y++) D.set(this.buf.subarray((H_ - 1 - y) * W4, (H_ - y) * W4), y * W4);
      for (let i = 3; i < D.length; i += 4) D[i] = 255;
      this.cx.putImageData(this.img, 0, 0);
      // a touch of finish: a soft vignette, like a lens
      const g = this.cx.createRadialGradient(W_ / 2, H_ / 2, H_ * 0.35, W_ / 2, H_ / 2, W_ * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
      this.cx.fillStyle = g; this.cx.fillRect(0, 0, W_, H_);
      const url = this.cv.toDataURL('image/jpeg', 0.8);
      this.put(key, url);
      return url;
    } catch (e) { return null; }
  }
  road(x, z, r = 80) { const W = this.g.W, n = W.graph.nearest(x, z, r); if (!n) return null; const t = W.graph.at(n.e, n.s); return { x: t[0], z: t[1], dx: t[2], dz: t[3] }; }
  ground(x, z) { const s = this.g.W.surf; try { return s.height(x, z) || 0; } catch (e) { return 0; } }
  // a landmark: from a road a little way off it, raised, the whole building in the frame
  landmark(L) {
    const size = Math.max(L.w || 40, L.d || 40), R = Math.min(170, size * 0.62 + 28);
    let best = null;
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, x = L.x + Math.cos(a) * R, z = L.z + Math.sin(a) * R, n = this.g.W.graph.nearest(x, z, 45);
      if (n && (!best || n.d < best.d)) best = { x, z, d: n.d };
    }
    if (!best || !this.near(best.x, best.z)) return null;
    const gy = this.ground(best.x, best.z), ly = this.ground(L.x, L.z);
    return this.shoot('lm:' + L.id, best.x, gy + 8 + size * 0.1, best.z, L.x, ly + Math.min(14, 4 + size * 0.05), L.z);
  }
  // a neighbourhood, or any point: down the nearest road from a first-floor window
  street(key, x, z, look) {
    const r = this.road(x, z, 120); if (!r || !this.near(r.x, r.z)) return null;
    const gy = this.ground(r.x, r.z);
    if (look) return this.shoot(key, r.x, gy + 5, r.z, look.x, this.ground(look.x, look.z) + 3, look.z);
    const L = Math.hypot(r.dx, r.dz) || 1;
    return this.shoot(key, r.x - r.dx / L * 6, gy + 5.5, r.z - r.dz / L * 6, r.x + r.dx / L * 70, gy + 2.5, r.z + r.dz / L * 70);
  }
  areaAt(x, z) {
    const subs = (this.g.hud && this.g.hud.suburbs) || []; let best = null, bd = 1500 * 1500;
    for (const s of subs) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
    return best;
  }
  landmarkAt(x, z, r = 150) { return (this.g.W.landmarks || []).find(L => Math.hypot(L.x - x, L.z - z) < Math.max(r, Math.max(L.w || 0, L.d || 0) * 0.6)) || null; }
  // the best picture of a place on the map: its landmark, else its neighbourhood; taken now if you're near
  forPlace(p) {
    const L = this.landmarkAt(p.x, p.z);
    if (L) return this.get('lm:' + L.id) || (this.ok() ? this.landmark(L) : null);
    const a = this.areaAt(p.x, p.z), key = a ? 'ar:' + a.n : null;
    if (!key) return null;
    return this.get(key) || (this.ok() && this.near(p.x, p.z) ? this.street(key, p.x, p.z) : null);
  }
  ok() { const G = this.g; return !(G.interiors && G.interiors.inside) && !(G.cut && G.cut.on); }
  // every few seconds while you play, by day: anything round you that hasn't had its picture taken
  update(dt) {
    const G = this.g; if ((this.t -= dt) > 0) return; this.t = 3;
    if (G.state !== 'play' || !this.ok() || (G.jhola && G.jhola.on) || (G.phone && G.phone.on)) return;
    const h = G.hour; if (h < 7.2 || h > 18.3) return;
    const P = G.player;
    for (const L of G.W.landmarks || []) if (!this.mem.has('lm:' + L.id) && Math.hypot(L.x - P.x, L.z - P.z) < 240) { this.landmark(L); return; }
    const a = this.areaAt(P.x, P.z); if (a && !this.mem.has('ar:' + a.n) && Math.hypot(a.x - P.x, a.z - P.z) < 900) { this.street('ar:' + a.n, P.x, P.z); return; }
    const S = G.story, m = S && S.on && S.mission && S.mission(), t = m && S.target && S.target();
    // the mission's place: from the road some way back towards you, looking at it
    if (m && t && !this.mem.has('m:' + m.id)) { const d = Math.hypot(t.x - P.x, t.z - P.z); if (d < 160 && d > 8) { const ux = (t.x - P.x) / d, uz = (t.z - P.z) / d; this.street('m:' + m.id, t.x - ux * 28, t.z - uz * 28, t); } }
  }
}
