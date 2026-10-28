// Photo mode (K, or Pause → Photo mode): the city holds still, the HUD goes, and the camera is yours.
//   drag to look around · scroll to zoom · W A S D to move · Q E down and up · ← → time of day
//   Space takes the picture: a JPEG with a small NH48 card (where you are) in the corner, saved to downloads
import { keyState } from './keys.js';

const MAX_R = 70;          // how far the camera may wander from you (m)

export class PhotoMode {
  constructor(G) {
    this.g = G; this.on = false;
    this.c = { x: 0, y: 0, z: 0 }; this.yaw = 0; this.pitch = 0.25; this.dist = 9;
    const el = document.createElement('div');
    el.className = 'photo-ui'; el.hidden = true;
    el.innerHTML = `<div class="ph-bar glass"><b>Photo mode</b><span>Drag to look · scroll to zoom · <span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span> move · <span class="kbd">Q</span><span class="kbd">E</span> height · <span class="kbd">←</span><span class="kbd">→</span> time · <span class="kbd">H</span> hide this</span><button class="btn primary ph-shoot">Take photo <span class="kbd">Space</span></button><button class="btn ph-exit">Done <span class="kbd">Esc</span></button></div><div class="ph-flash"></div>`;
    (document.getElementById('ui') || document.body).appendChild(el);
    this.el = el;
    el.querySelector('.ph-shoot').onclick = () => this.shoot();
    el.querySelector('.ph-exit').onclick = () => this.close();
    this.keys = new Set();
    window.addEventListener('keydown', (e) => {
      if (keyState.capturing) return;
      if (!this.on) {
        if (e.code === 'KeyK' && this.g.state === 'play' && !e.repeat) { e.preventDefault(); this.open(); }
        return;
      }
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape' || e.code === 'KeyK') { this.close(); return; }
      if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { this.shoot(); return; }
      if (e.code === 'KeyH' && !e.repeat) { this.el.querySelector('.ph-bar').hidden = !this.el.querySelector('.ph-bar').hidden; return; }
      this.keys.add(e.code);
    }, true);
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); }, true);
    const cv = G.renderer.domElement;
    let drag = null;
    cv.addEventListener('mousedown', (e) => { if (this.on) drag = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mouseup', () => { drag = null; });
    window.addEventListener('mousemove', (e) => {
      if (!this.on || !drag) return;
      this.yaw -= (e.clientX - drag.x) * 0.005; this.pitch = Math.max(-0.35, Math.min(1.45, this.pitch + (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('wheel', (e) => { if (!this.on) return; e.preventDefault(); this.dist = Math.max(1.6, Math.min(60, this.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  }
  open() {
    const G = this.g;
    if (G.state !== 'play' || this.on) return;
    this.on = true; G.state = 'photo';
    const f = G.focus(), cam = G.camera.position;
    this.c = { x: f.x, y: (f.y || 0) + 1.4, z: f.z };
    this.dist = Math.max(3, Math.min(30, Math.hypot(cam.x - f.x, cam.y - this.c.y, cam.z - f.z)));
    this.yaw = Math.atan2(cam.x - f.x, cam.z - f.z);
    this.pitch = Math.max(-0.2, Math.min(1.2, Math.asin(Math.max(-1, Math.min(1, (cam.y - this.c.y) / this.dist)))));
    this.home = { x: f.x, z: f.z };
    G.releaseMouse && G.releaseMouse();
    G.audio && G.audio.updateEngine && G.audio.updateEngine(0, 0, false);
    document.getElementById('ui')?.classList.add('photo');
    this.el.hidden = false; this.el.querySelector('.ph-bar').hidden = false;
  }
  close() {
    const G = this.g;
    if (!this.on) return;
    this.on = false; this.keys.clear();
    document.getElementById('ui')?.classList.remove('photo');
    this.el.hidden = true;
    if (G.state === 'photo') G.state = 'play';
    if (G.rig) G.rig.inited = false;
    G.lockMouse && G.lockMouse();
  }
  update(dt) {
    if (!this.on) return;
    const G = this.g, k = this.keys, sp = 10 * dt * (k.has('ShiftLeft') ? 3 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = -fz, rz = fx;
    let mx = 0, mz = 0;
    if (k.has('KeyW')) { mx += fx; mz += fz; } if (k.has('KeyS')) { mx -= fx; mz -= fz; }
    if (k.has('KeyD')) { mx -= rx; mz -= rz; } if (k.has('KeyA')) { mx += rx; mz += rz; }
    this.c.x += mx * sp; this.c.z += mz * sp;
    if (k.has('KeyE')) this.c.y += sp * 0.6; if (k.has('KeyQ')) this.c.y -= sp * 0.6;
    const dx = this.c.x - this.home.x, dz = this.c.z - this.home.z, d = Math.hypot(dx, dz);
    if (d > MAX_R) { this.c.x = this.home.x + dx / d * MAX_R; this.c.z = this.home.z + dz / d * MAX_R; }
    const ground = G.W.surf.height(this.c.x, this.c.z);
    this.c.y = Math.max(ground + 0.3, Math.min(ground + 80, this.c.y));
    if (k.has('ArrowRight')) G.setHour((G.hour + dt * 1.5) % 24);
    if (k.has('ArrowLeft')) G.setHour((G.hour - dt * 1.5 + 24) % 24);
    const cp = Math.cos(this.pitch), cam = G.camera;
    let x = this.c.x + Math.sin(this.yaw) * cp * this.dist, z = this.c.z + Math.cos(this.yaw) * cp * this.dist, y = this.c.y + Math.sin(this.pitch) * this.dist;
    y = Math.max(G.W.surf.height(x, z) + 0.25, y);
    cam.position.set(x, y, z);
    cam.lookAt(this.c.x, this.c.y, this.c.z);
  }
  // the picture: the frame as rendered, a small card in the corner
  shoot() {
    const G = this.g;
    try { G.post.render(0); } catch (e) { /* the frame already on screen will do */ }
    const src = G.renderer.domElement, W = src.width, H = src.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.drawImage(src, 0, 0);
    const s = Math.max(1, H / 900), pad = 28 * s;
    const area = document.getElementById('h-area')?.textContent || 'Pune', street = document.getElementById('h-street')?.textContent || '';
    const where = street && street !== area ? `${street}, ${area}` : area;
    x.save();
    x.font = `800 ${30 * s}px Archivo, Inter, system-ui, sans-serif`;
    const t1 = 'NH48: Pune', w1 = x.measureText(t1).width;
    x.font = `600 ${17 * s}px Inter, system-ui, sans-serif`;
    const w2 = x.measureText(where).width, bw = Math.max(w1, w2) + 70 * s, bh = 86 * s, bx = pad, by = H - pad - bh;
    x.fillStyle = 'rgba(12,13,16,.62)';
    x.beginPath(); x.roundRect(bx, by, bw, bh, 16 * s); x.fill();
    // the milestone
    x.translate(bx + 18 * s, by + 18 * s); x.scale(s, s);
    x.fillStyle = '#F4F1EA'; x.beginPath(); x.moveTo(4, 22); x.arc(20, 22, 16, Math.PI, 0); x.lineTo(36, 48); x.lineTo(4, 48); x.closePath(); x.fill();
    x.fillStyle = '#F2B705'; x.beginPath(); x.moveTo(4, 22); x.arc(20, 22, 16, Math.PI, 0); x.closePath(); x.fill();
    x.restore();
    x.fillStyle = '#F4F1EA'; x.textBaseline = 'alphabetic';
    x.font = `800 ${30 * s}px Archivo, Inter, system-ui, sans-serif`; x.fillText(t1, bx + 60 * s, by + 40 * s);
    x.fillStyle = 'rgba(244,241,234,.78)'; x.font = `600 ${17 * s}px Inter, system-ui, sans-serif`; x.fillText(where, bx + 60 * s, by + 66 * s);
    x.textAlign = 'right'; x.fillStyle = 'rgba(244,241,234,.8)'; x.font = `700 ${16 * s}px Inter, system-ui, sans-serif`;
    x.fillText('nh48.vercel.app', W - pad, H - pad);
    const fl = this.el.querySelector('.ph-flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    const name = 'NH48 Pune ' + where.replace(/[^\w ,.-]+/g, '').slice(0, 40) + '.jpg';
    cv.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      G.hud && G.hud.toast && G.hud.toast('Photo saved', 'In your downloads. Tag it #NH48Pune', 'info', 2.6);
    }, 'image/jpeg', 0.92);
  }
}
