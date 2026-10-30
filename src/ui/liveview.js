// The map's place card, live: a small, low-resolution view of the spot you picked, the camera slowly circling it.
// Near you it's the real game (the street built and running: cars, people, the light of the hour). Further off,
// where the city isn't built yet, it's a model: the map itself laid flat and every building on it raised to its
// height, fetched from that piece of Pune's map. Rendered small and often, so it opens at once and costs little.
import * as THREE from 'three';
import { cmRing } from '../world/geo.js';
import { fetchJSONgz } from '../world/tiles.js';

const W_ = 384, H_ = 216, R_ = 230, NEAR = 240;

export class LiveView {
  constructor(G) { this.g = G; this.on = false; this.a = 0; this.t = 0; }
  init() {
    if (this.rt) return;
    this.rt = new THREE.WebGLRenderTarget(W_, H_, { samples: 4 });
    this.rt.isXRRenderTarget = true; this.rt.texture.colorSpace = THREE.SRGBColorSpace; this.rt.texture.internalFormat = 'RGBA8';
    this.cam = new THREE.PerspectiveCamera(38, W_ / H_, 1, 5000);
    this.buf = new Uint8Array(W_ * H_ * 4);
    // the model's own little world: a dark ground, soft sky light, a low warm sun, a touch of haze
    const sc = this.sc = new THREE.Scene();
    sc.background = new THREE.Color(0x0d0e11); sc.fog = new THREE.Fog(0x0d0e11, R_ * 1.4, R_ * 3.2);
    sc.add(new THREE.HemisphereLight(0xdfe6f2, 0x2a241c, 1.1));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.1); sun.position.set(-0.6, 1, 0.35); sc.add(sun);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(R_ * 2, R_ * 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2; sc.add(this.ground);
    this.gcv = document.createElement('canvas'); this.gcv.width = this.gcv.height = 1024;
    this.gtex = new THREE.CanvasTexture(this.gcv); this.gtex.colorSpace = THREE.SRGBColorSpace; this.gtex.anisotropy = 4;
    this.ground.material.map = this.gtex;
    this.bmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
    this.bmesh = null;
  }
  // start showing p (anything with x, z) in this canvas
  show(p, canvas) {
    const G = this.g; if (!p || !canvas) { this.stop(); return; }
    this.init();
    if (this.on && this.p && Math.abs(this.p.x - p.x) < 0.5 && Math.abs(this.p.z - p.z) < 0.5) { if (canvas.width !== W_) { canvas.width = W_; canvas.height = H_; } this.cv = canvas; this.cx = canvas.getContext("2d"); this.img = this.cx.createImageData(W_, H_); return; }     // (the card redrawn, same place)
    if (canvas.width !== W_ || canvas.height !== H_) { canvas.width = W_; canvas.height = H_; }     // (the picture fills its frame)
    this.p = p; this.cv = canvas; this.cx = canvas.getContext('2d'); this.img = this.cx.createImageData(W_, H_);
    this.on = true; this.live = false; this.a = Math.atan2(G.player.z - p.z, G.player.x - p.x) + 0.6; this.t = 0;
    this.real = Math.hypot(p.x - G.player.x, p.z - G.player.z) < NEAR && !(G.interiors && G.interiors.inside);
    // far off: the city streams in there behind the menu (game.peek); the model stands in until it's built
    G.peek = this.real ? null : { x: p.x, z: p.z };
    if (!this.real) this.build(p);
  }
  stop() { this.on = false; this.p = null; this.cv = null; this.g.peek = null; }
  // is the real street built at p yet
  ready(p) { const I = this.g.W.index; try { const ci = I.chunkOf(p.x, p.z); const c = ci >= 0 ? I.chunks[ci] : null; return !!(c && c.built && !this.g.W.streamer.pendingAdd.some(q => q.c === c)); } catch (e) { return false; } }
  // the model: the map's picture underfoot, the buildings raised
  async build(p) {
    const G = this.g, key = Math.round(p.x) + ',' + Math.round(p.z); this.key = key;
    if (this.bmesh) { this.sc.remove(this.bmesh); this.bmesh.geometry.dispose(); this.bmesh = null; }
    this.paintGround(p); this.groundT = 3;
    const tiles = G.W.tiles ? G.W.tiles.list.filter(T => G.W.tiles.dist(T, p.x, p.z) < R_) : [];
    const rings = [];
    for (const T of tiles) {
      let B = null;
      if (T.state === 'live' && T.bN) B = G.W.M.buildings.slice(T.bOff, T.bOff + T.bN);
      else { try { const D = T.data || await fetchJSONgz(G.W.tiles.url(T)); B = D.buildings; } catch (e) { B = null; } }
      if (this.key !== key) return;
      for (const b of B || []) rings.push(b);
    }
    if (this.key !== key) return;
    this.bmesh = this.extrude(rings, p);
    if (this.bmesh) this.sc.add(this.bmesh);
  }
  paintGround(p) {
    const M = this.g.hud && this.g.hud.mapScreen, x = this.gcv.getContext('2d'), S = this.gcv.width, k = S / (2 * R_);
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#16181c'; x.fillRect(0, 0, S, S);
    if (M && M.drawRaster) { x.setTransform(k, 0, 0, k, -(p.x - R_) * k, -(p.z - R_) * k); try { M.drawRaster(x, p.x, p.z, R_, k); } catch (e) { /* */ } x.setTransform(1, 0, 0, 1, 0, 0); }
    // darker, so the buildings carry it
    x.fillStyle = 'rgba(10,11,13,.35)'; x.fillRect(0, 0, S, S);
    this.gtex.needsUpdate = true;
  }
  extrude(list, p) {
    const pos = [], col = [], c = new THREE.Color();
    let n = 0;
    for (const b of list) {
      const r = cmRing(b[1]); if (r.length < 6) continue;
      let cx = 0, cz = 0; const m = r.length / 2; for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; } cx /= m; cz /= m;
      if (Math.hypot(cx - p.x, cz - p.z) > R_ * 0.98) continue;
      if (++n > 6000) break;
      const h = Math.max(3.5, (b[2] || 1) * 3.3), pts = [];
      for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i] - p.x, r[i + 1] - p.z));
      if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 0.01) pts.pop();
      // a warm limestone-to-plaster range, a little different building to building
      const v = ((Math.abs(cx * 7.13 + cz * 3.71) | 0) % 100) / 100;
      c.setHSL(0.08 + v * 0.04, 0.12 + v * 0.1, 0.55 + v * 0.18);
      const roof = c.clone().multiplyScalar(1.12);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], q = pts[(i + 1) % pts.length];
        pos.push(a.x, 0, a.y, q.x, 0, q.y, q.x, h, q.y, a.x, 0, a.y, q.x, h, q.y, a.x, h, a.y);
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
      }
      let tri; try { tri = THREE.ShapeUtils.triangulateShape(pts, []); } catch (e) { tri = []; }
      for (const t of tri) for (const i of t) { pos.push(pts[i].x, h, pts[i].y); col.push(roof.r, roof.g, roof.b); }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, this.bmat); mesh.material.side = THREE.DoubleSide;
    return mesh;
  }
  // every frame while the card is open: round a little more, a picture at ~24 a second
  update(dt) {
    if (!this.on || !this.cv || !this.cv.isConnected) { if (this.on && this.cv && !this.cv.isConnected) this.stop(); return; }
    this.a += dt * 0.16;
    if (!this.real && this.groundT > 0) { this.groundT -= dt; if ((this.gAcc = (this.gAcc || 0) + dt) > 0.4) { this.gAcc = 0; this.paintGround(this.p); } }     // the map pictures arriving
    if ((this.t -= dt) > 0) return; this.t = 1 / 24;
    const G = this.g, R = G.renderer, C = this.cam, p = this.p;
    if (!this.real && G.peek && this.ready(p)) { this.real = true; this.live = true; }
    if (this.real) {
      const gy = G.W.surf ? (G.W.surf.height(p.x, p.z) || 0) : 0, d = 95;
      C.position.set(p.x + Math.cos(this.a) * d, gy + 55, p.z + Math.sin(this.a) * d); C.lookAt(p.x, gy + 4, p.z);
    } else {
      const d = R_ * 0.78; C.position.set(Math.cos(this.a) * d, R_ * 0.5, Math.sin(this.a) * d); C.lookAt(0, 6, 0);
    }
    C.updateMatrixWorld(); C.updateProjectionMatrix();
    const prev = R.getRenderTarget(), ex = R.toneMappingExposure;
    if (!this.real) R.toneMappingExposure = 1;
    if (this.live && R.shadowMap.enabled && ((this.n = (this.n || 0) + 1) % 12 === 1)) R.shadowMap.needsUpdate = true;     // (the shadows over there, not round you)
    R.setRenderTarget(this.rt); R.render(this.real ? G.scene : this.sc, C); R.setRenderTarget(prev); R.toneMappingExposure = ex;
    R.readRenderTargetPixels(this.rt, 0, 0, W_, H_, this.buf);
    const D = this.img.data, W4 = W_ * 4;
    for (let y = 0; y < H_; y++) D.set(this.buf.subarray((H_ - 1 - y) * W4, (H_ - y) * W4), y * W4);
    for (let i = 3; i < D.length; i += 4) D[i] = 255;
    this.cx.putImageData(this.img, 0, 0);
  }
}
