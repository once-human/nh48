// Scenes that play in the living city: the traffic keeps moving, the rain keeps falling, people keep walking,
// and you can drag the mouse (or move it, with the pointer locked) to look around while the scene plays out.
// You don't steer; the scene moves you (walking where it needs you), the people in it act and speak, and the
// camera works like a camera operator who lets you turn your head. Cinema bars, subtitles, hold Space to skip.
//
// A scene: { title?, sub?, shots: [{ dur, cam(cs) -> { x, y, z, lx, ly, lz, fov?, cut? }, enter?(cs), update?(cs, dt),
// lines?: [[t, who, mr, en]], until?(cs) }], start?(cs), end?(cs), skip?(cs) }
import { clamp } from '../core/util.js';

export class Cutscene {
  constructor(G) {
    this.g = G; this.on = false; this.yaw = 0; this.pitch = 0;
    const el = this.el = document.createElement('div'); el.className = 'cine'; el.hidden = true;
    el.innerHTML = '<i class="cb t"></i><i class="cb b"></i><div class="ct"><b></b><small></small></div><div class="cs">Hold <span class="kbd">Space</span> to skip · drag to look around</div>';
    (document.getElementById('ui') || document.body).appendChild(el);
    // drag to look (when the pointer isn't locked)
    let drag = null;
    addEventListener('pointerdown', (e) => { if (this.on) drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('pointermove', (e) => { if (!this.on || !drag) return; this.drag(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('pointerup', () => { drag = null; });
  }
  drag(dx, dy) { this.yaw = clamp(this.yaw - dx * 0.0035, -1.2, 1.2); this.pitch = clamp(this.pitch - dy * 0.0035, -0.55, 0.55); }
  play(sc) {
    const G = this.g, P = G.player;
    if (this.on) this.end(true);
    this.sc = sc; this.on = true; this.i = -1; this.holdT = 0; this.yaw = 0; this.pitch = 0; this.cp = null;
    P.frozen = true;
    this.el.hidden = false; this.el.classList.remove('out'); void this.el.offsetWidth; this.el.classList.add('in');
    G.hud && G.hud.root && G.hud.root.classList.add('in-cine');
    const T = this.el.querySelector('.ct');
    if (sc.title) { T.querySelector('b').textContent = sc.title; T.querySelector('small').textContent = sc.sub || ''; T.classList.remove('show'); void T.offsetWidth; T.classList.add('show'); }
    sc.start && sc.start(this);
    this.next();
  }
  next() {
    this.i++;
    const sh = this.sc.shots[this.i];
    if (!sh) { this.end(); return; }
    this.t = 0; this.li = 0; this.cutNext = true;
    sh.enter && sh.enter(this);
  }
  end(silent) {
    if (!this.on) return;
    const G = this.g, P = G.player, sc = this.sc;
    this.on = false; P.frozen = false; P.puppet = null;
    this.el.classList.remove('in'); this.el.classList.add('out'); setTimeout(() => { if (!this.on) this.el.hidden = true; }, 600);
    G.hud && G.hud.root && G.hud.root.classList.remove('in-cine');
    if (G.camera.fov !== this.fov0 && this.fov0) { G.camera.fov = this.fov0; G.camera.updateProjectionMatrix(); }
    if (G.rig) G.rig.inited = false;
    if (!silent) sc.end && sc.end(this);
  }
  // who speaks, and the subtitle (the scene's own people by their story names)
  line(who, mr, en) {
    const G = this.g, name = this.sc.names && this.sc.names[who] || (G.story && G.story.name ? G.story.name(who) : who);
    G.hud.say(who === 'you' ? (G.playerName || 'You') : name, mr, en === mr ? '' : en, 4.2);
  }
  update(dt) {
    if (!this.on) return;
    const G = this.g, sh = this.sc.shots[this.i];
    if (!sh) return;
    // hold Space to skip the whole scene (it still ends the way it would have: everyone where they belong)
    if (G.input.key('Space')) { this.holdT += dt; if (this.holdT > 0.7) { this.sc.skip && this.sc.skip(this); this.end(); return; } } else this.holdT = 0;
    this.t += dt;
    sh.update && sh.update(this, dt);
    const L = sh.lines || [];
    while (this.li < L.length && this.t >= L[this.li][0]) { const [, who, mr, en] = L[this.li++]; this.line(who, mr, en); }
    if (this.t >= sh.dur && (!sh.until || sh.until(this))) this.next();
  }
  // after the camera rig: the shot's camera, eased between shots unless it cuts, with your look on top
  camera(cam, dt) {
    if (!this.on) return;
    const sh = this.sc.shots[this.i]; if (!sh || !sh.cam) return;
    const c = sh.cam(this);
    if (!this.fov0) this.fov0 = cam.fov;
    const k = this.cutNext || c.cut || !this.cp ? 1 : 1 - Math.exp(-dt * (c.ease || 3));
    this.cutNext = false;
    const p = this.cp || (this.cp = { ...c });
    for (const q of ['x', 'y', 'z', 'lx', 'ly', 'lz']) p[q] += (c[q] - p[q]) * k;
    // you turn your head: around the camera, within a natural range, and it drifts back when you let go
    if (!this._drag) { this.yaw *= Math.exp(-dt * 0.35); this.pitch *= Math.exp(-dt * 0.35); }
    const dx = p.lx - p.x, dy = p.ly - p.y, dz = p.lz - p.z, d = Math.hypot(dx, dz) || 1;
    const a = Math.atan2(dz, dx) + this.yaw, el = Math.atan2(dy, d) + this.pitch;
    cam.position.set(p.x, p.y, p.z);
    cam.lookAt(p.x + Math.cos(a) * Math.cos(el) * 10, p.y + Math.sin(el) * 10, p.z + Math.sin(a) * Math.cos(el) * 10);
    const f = c.fov || this.fov0;
    if (Math.abs(cam.fov - f) > 0.05) { cam.fov += (f - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  }
}
