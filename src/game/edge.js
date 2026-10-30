// The edge of the city, without a wall: Pune doesn't let you leave. Near the city limit a monsoon mist comes up off
// the ghats, thicker the further you push, with a headwind that slows you and leans you back towards town; drive on
// into the white and you come out of it facing the city again, a little way inside, and a Puneri board tells you
// what every Punekar knows. (The baked wall along the outline is still there, behind the mist, for safety.)
const LINES = [['पुणे इथेच संपतं.', 'Pune ends here. Beyond it is just “outside Pune”.'], ['पुढे काही नाही. खरंच.', 'There’s nothing further. Really. We checked.'],
  ['परत फिरा. चहा थंड होतोय.', 'Turn back. Your chai is getting cold.'], ['पुण्याबाहेर जाणं इतकं सोपं नाही.', 'Leaving Pune is not that easy.']];

export class CityEdge {
  constructor(G) {
    this.g = G; this.t = 0; this.d = 1e9; this.n = [0, 0]; this.k = 0; this.cool = 0; this.line = 0;
    const o = G.W.M.meta.outlineXZ || [];
    this.o = o.map(p => [p[0] / 100, p[1] / 100]);
    const el = this.el = document.createElement('div'); el.className = 'edge-mist'; el.innerHTML = '<i></i><div class="edge-card" hidden><b lang="mr"></b><span></span></div>';
    (document.getElementById('ui') || document.body).appendChild(el);
  }
  inside(x, z) {
    let c = false; const P = this.o;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[i], [bx, bz] = P[j]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c; }
    return c;
  }
  // how far the city limit is, and which way is back into town
  measure(x, z) {
    let bd = 1e9, bn = [0, 0]; const P = this.o;
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2)), px = ax + ex * t, pz = az + ez * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; bn = [(x - px) / (d || 1), (z - pz) / (d || 1)]; }
    }
    if (!this.inside(x, z)) { bn = [-bn[0], -bn[1]]; bd = -bd; }        // (outside: still pointing back in)
    this.d = bd; this.n = bn;
  }
  update(dt) {
    const G = this.g, P = G.player;
    if (!this.o.length || G.state !== 'play' || (G.interiors && G.interiors.inside)) { this.fade(0, dt); return; }
    this.t -= dt; this.cool -= dt;
    if (this.t <= 0) { this.t = 0.25; this.measure(P.x, P.z); }
    const k = Math.max(0, Math.min(1, (150 - this.d) / 125));             // 0 at 150 m from the limit, 1 at 25 m
    this.fade(k, dt);
    if (k <= 0) return;
    // the headwind: slower, and leaning back towards town
    const v = !P.onFoot && P.cur, back = Math.atan2(this.n[1], this.n[0]);
    if (v) {
      v.v *= 1 - Math.min(0.9, k * k * 1.6) * dt;
      let da = back - v.th; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > Math.PI / 2) v.th += Math.sign(da) * k * k * 0.35 * dt;
    }
    // into the white: out again, facing the city
    if (this.d < 25 && this.cool <= 0) this.turnBack(back);
  }
  turnBack(back) {
    const G = this.g, P = G.player, n = this.n;
    const sp = G.safeDrop(P.x + n[0] * (65 - this.d), P.z + n[1] * (65 - this.d)) || { x: P.x + n[0] * 65, z: P.z + n[1] * 65, th: back };
    let th = sp.th ?? back; if (Math.cos(th - back) < 0) th += Math.PI;            // whichever way along the road faces town
    if (P.onFoot) P.teleportFoot(sp.x, sp.z, th, G.traffic);
    else { const v = P.cur, keep = Math.min(Math.abs(v.v), 12); if (v === P.auto) P.reset(sp.x, sp.z, th); else v.reset(sp.x, sp.z, th); v.v = keep; }
    G.rig.inited = false;
    this.cool = 6; this.white = 1.6;
    const [mr, en] = LINES[this.line++ % LINES.length], c = this.el.querySelector('.edge-card');
    c.querySelector('b').textContent = mr; c.querySelector('span').textContent = en; c.hidden = false;
    clearTimeout(this._ct); this._ct = setTimeout(() => { c.hidden = true; }, 4200);
    G.audio.whoosh && G.audio.whoosh(0.6);
  }
  fade(k, dt) {
    if (this.white > 0) { this.white -= dt; k = Math.max(k, Math.min(1, this.white)); }
    const o = Math.round(k * 100) / 100;
    if (o !== this._o) { this._o = o; this.el.style.setProperty('--m', o); this.el.classList.toggle('on', o > 0.01); }
  }
}
