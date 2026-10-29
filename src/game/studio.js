// A little photo studio off to the side of the city: a copy of someone (you, as you're dressed) on a plain
// backdrop under soft key, fill and rim lights, drawn into a picture with the game's own renderer. The
// character screen keeps one open and turns you as you drag; the police mugshot takes one frame of it.
import * as THREE from 'three';

export class Studio {
  constructor(G, w, h, opts = {}) {
    this.g = G; this.w = w; this.h = h; this.opts = opts;
    const sc = this.sc = new THREE.Scene();
    sc.background = new THREE.Color(opts.bg ?? 0x16181d);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x3a3630, opts.hemi ?? 1.15));
    const key = new THREE.DirectionalLight(0xfff3e2, 1.7); key.position.set(1.4, 2.6, 2.8); sc.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-2.4, 1.4, 1.8); sc.add(fill);
    const rim = new THREE.DirectionalLight(0xffc58a, opts.rim ?? 1.1); rim.position.set(-1.2, 2.2, -2.6); sc.add(rim);
    if (opts.floor !== false) {
      const fl = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.9 }));
      fl.rotation.x = -Math.PI / 2; sc.add(fl); this.floor = fl;
    }
    this.cam = new THREE.PerspectiveCamera(opts.fov ?? 24, w / h, 0.1, 30);
    // tone-mapped and encoded exactly as on the screen (an XR-flagged target), read back as plain bytes
    this.rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
    this.rt.isXRRenderTarget = true; this.rt.texture.colorSpace = THREE.SRGBColorSpace; this.rt.texture.internalFormat = 'RGBA8';
    this.buf = new Uint8Array(w * h * 4);
    this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.img = this.ctx.createImageData(w, h);
    this.yaw = 0;
  }
  // who stands there: a look (they're built fresh from it, so what you've just put on shows)
  dress(look) {
    const kit = this.g.player.kit; if (!kit || !look) return;
    this.undress();
    const H = this.H = kit.create({ ...look, acc: null, helmet: false });
    this.sc.add(H.holder);
    H.play(this.opts.clip || 'idle', { fade: 0 }); H.mixer.update(0.05);
  }
  undress() { if (this.H) { this.sc.remove(this.H.holder); this.H.dispose(); this.H = null; } }
  // frame: 'full' (head to toe) or 'head' (head and shoulders)
  shoot(frame = 'full', t = 0) {
    const G = this.g, R = G.renderer, H = this.H; if (!H) return this.canvas;
    H.holder.rotation.y = -Math.PI / 2 + this.yaw;           // facing the camera (+z), turned by your drag
    if (t) H.mixer.update(t);
    this.sc.updateMatrixWorld(true);
    const hd = H.root.getObjectByName('Head'), hp = new THREE.Vector3(0, 1.6, 0); if (hd) hd.getWorldPosition(hp);
    const C = this.cam;
    if (frame === 'head') { C.fov = 26; C.position.set(hp.x, hp.y - 0.05, hp.z + 1.6); C.lookAt(hp.x, hp.y - 0.17, hp.z); }
    else { C.fov = this.opts.fov ?? 24; const mid = hp.y * 0.53; C.position.set(0, mid + 0.25, 5.4); C.lookAt(0, mid, 0); }
    C.aspect = this.w / this.h; C.updateProjectionMatrix(); C.updateMatrixWorld();
    const prev = R.getRenderTarget(), ex = R.toneMappingExposure;
    R.toneMappingExposure = 1; R.setRenderTarget(this.rt); R.render(this.sc, C); R.setRenderTarget(prev); R.toneMappingExposure = ex;
    R.readRenderTargetPixels(this.rt, 0, 0, this.w, this.h, this.buf);
    const D = this.img.data, W4 = this.w * 4;
    for (let y = 0; y < this.h; y++) D.set(this.buf.subarray((this.h - 1 - y) * W4, (this.h - y) * W4), y * W4);
    this.ctx.putImageData(this.img, 0, 0);
    return this.canvas;
  }
  dispose() { this.undress(); this.rt.dispose(); }
}
