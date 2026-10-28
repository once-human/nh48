// Things that happen if you're in the right place at the right time.
//  · The Light and Sound show inside Shaniwar Wada, 7:15 to 7:45 in the evening: the walls wash in colour
//    and the fort tells its own story (sit on the lawn, or stand on a plinth).
//  · Over Parvati, between 3 and 3:50 in the morning, something hangs in the sky. Get close and it leaves.
import * as THREE from 'three';
import LM from '../world/landmarks.json';
import { SW } from '../world/landmarks.js';

const SHOW = [
  [0.00, [0.9, 0.5, 0.1], 'मी शनिवारवाडा.', 'I am Shaniwar Wada.'],
  [0.09, [0.95, 0.75, 0.2], 'शनिवारी माझा पाया घातला गेला, म्हणून मी शनिवारवाडा.', 'My foundation was laid on a Saturday in 1730. So, Shaniwar Wada.'],
  [0.20, [0.9, 0.25, 0.1], 'थोरले बाजीराव. चाळीस वर्षं, एकही लढाई हरले नाहीत.', 'Bajirao the First. Forty years, and never lost a battle.'],
  [0.32, [0.2, 0.4, 0.95], 'इथून पेशव्यांनी अटकेपार झेंडे लावले.', 'From these rooms, the Peshwas carried their flags past Attock.'],
  [0.44, [0.55, 0.15, 0.7], 'सात मजली महाल. हजारी कारंजं. सोन्याचे कळस.', 'A palace seven storeys tall. A fountain of a thousand jets. Golden spires.'],
  [0.56, [0.6, 0.0, 0.0], '१७७३. सोळा वर्षांचा नारायणराव. याच भिंतींच्या आत.', '1773. Narayanrao, sixteen. Inside these walls.'],
  [0.64, [0.35, 0.0, 0.0], '"काका, मला वाचवा!"', '"Uncle, save me!"'],
  [0.74, [1.0, 0.35, 0.05], '१८२८. आग सात दिवस जळत राहिली.', '1828. A fire burned for seven days.'],
  [0.86, [0.9, 0.85, 0.7], 'उरल्या फक्त भिंती आणि जोती. आणि मी.', 'What remained: the walls, the plinths. And me.'],
  [0.95, [1.0, 0.6, 0.15], 'आजही उभा आहे. पुण्याचा साक्षीदार.', 'Still standing. Pune’s witness.'],
];
const S0 = 19.25, S1 = 19.75;

export class Eggs {
  constructor(G) {
    this.g = G;
    this.sw = LM.find(l => l.id === 'shaniwar');
    this.pv = LM.find(l => l.id === 'parvati');
    this.cue = -1; this.washes = null; this.ufo = null; this.ufoGone = -1;
  }
  get s() { const s = this.g.life.s; return s.eggs || (s.eggs = {}); }
  swP(u, v, y = 0) { const L = this.sw, c = Math.cos(L.rot), s = Math.sin(L.rot); return new THREE.Vector3(L.x + u * c + v * s, y, L.z + u * s - v * c); }

  // ---------------------------------------------------------------- Light and Sound
  makeWashes() {
    const G = this.g, L = this.sw, mk = (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    const ws = [];
    // the gate block's inner face and the north wall either side of it, seen from inside
    const add = (u, v, w, h) => { const m = mk(w, h), p = this.swP(u, v, h / 2 + 0.1); m.position.copy(p); m.rotation.y = -L.rot + Math.PI; G.scene.add(m); ws.push(m); };
    add(SW.GU, SW.GV + 9.2, SW.GW + 0.8, 17.6);
    add(SW.GU - 30, SW.V0 + 0.15, 40, 10.8); add(SW.GU + 32, SW.V0 + 0.15, 42, 10.8);
    // a glow on each plinth, like the floodlights on the real ones
    for (const [u, v, w, d] of SW.plinths) { const m = mk(w * 0.9, d * 0.9), p = this.swP(u, v, 1.2); m.position.copy(p); m.rotation.x = -Math.PI / 2; m.rotation.z = -L.rot; G.scene.add(m); ws.push(m); }
    this.washes = ws;
  }
  dropWashes() { if (!this.washes) return; for (const m of this.washes) { this.g.scene.remove(m); m.geometry.dispose(); m.material.dispose(); } this.washes = null; }
  show(dt) {
    const G = this.g, h = G.hour, P = G.player;
    const [u, v] = (() => { const L = this.sw, dx = P.x - L.x, dz = P.z - L.z, c = Math.cos(L.rot), s = Math.sin(L.rot); return [dx * c + dz * s, dx * s - dz * c]; })();
    const inside = u > SW.U0 - 4 && u < SW.U1 + 4 && v > SW.V0 - 2 && v < SW.V1 + 4;
    const on = h >= S0 && h < S1 && inside;
    if (!on) { if (this.washes) this.dropWashes(); this.cue = -1; return; }
    if (!this.washes) { this.makeWashes(); G.hud.toast('Light and Sound show', 'Shaniwar Wada tells its own story. Find a spot on the lawn', 'info', 3.4); }
    const t = (h - S0) / (S1 - S0);
    let k = -1; for (let i = 0; i < SHOW.length; i++) if (t >= SHOW[i][0]) k = i;
    const [, col, mr, en] = SHOW[k];
    if (k !== this.cue) {
      this.cue = k;
      G.hud.say && G.hud.say('शनिवारवाडा', mr, en, 9);
      // the drum: a low thud and its echo
      G.audio.tone?.('sine', [70, 45], 0.9, 0.35); G.audio.tone?.('sine', [70, 45], 0.9, 0.18, 0, 0.45);
      if (k === SHOW.length - 1 && !this.s.lightshow) { this.s.lightshow = 1; G.life.change('mood', 0.12); G.life.save(); }
    }
    const pulse = 0.55 + 0.25 * Math.sin(G.t * (k === 6 ? 9 : 1.4)), fl = k === 7 ? 0.7 + 0.3 * Math.sin(G.t * 23) * Math.sin(G.t * 7) : 1;
    for (let i = 0; i < this.washes.length; i++) {
      const m = this.washes[i], plinth = i >= 3;
      m.material.color.setRGB(col[0], col[1], col[2]);
      m.material.opacity = (plinth ? 0.22 : 0.34) * pulse * fl;
    }
  }

  // ---------------------------------------------------------------- the thing over Parvati
  makeUfo() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(9, 28, 10), new THREE.MeshStandardMaterial({ color: 0x8a8f98, metalness: 0.9, roughness: 0.25, emissive: 0x111418 }));
    hull.scale.set(1, 0.22, 1); g.add(hull);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9effe6, transparent: true, opacity: 0.75, toneMapped: false }));
    dome.position.y = 1.2; g.add(dome);
    const lights = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); l.position.set(Math.cos(a) * 8.6, 0, Math.sin(a) * 8.6); g.add(l); lights.push(l); }
    const beam = new THREE.Mesh(new THREE.ConeGeometry(7, 52, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9effe6, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    beam.position.y = -26; g.add(beam);
    g.userData = { lights, beam };
    return g;
  }
  ufoTick(dt) {
    const G = this.g, h = G.hour, P = G.player, L = this.pv;
    const day = Math.floor((G.clock || 0) / 24);
    const win = h >= 3 && h < 3.84 && this.ufoGone !== day;
    const d = Math.hypot(P.x - L.x, P.z - L.z);
    if (!this.ufo) {
      if (!win || d > 1400) return;
      const u = this.ufo = this.makeUfo(); u.position.set(L.x, (L.y || 0) + 95, L.z); G.scene.add(u);
      this.ufoT = 0; this.ufoLeave = 0;
    }
    const u = this.ufo, D = u.userData;
    this.ufoT += dt;
    u.rotation.y += dt * 0.8;
    D.lights.forEach((l, i) => l.material.color.setHSL(((this.ufoT * 0.5 + i / 12) % 1), 1, 0.6));
    if (!this.ufoLeave) {
      u.position.y = (L.y || 0) + 95 + Math.sin(this.ufoT * 0.9) * 3;
      u.position.x = L.x + Math.sin(this.ufoT * 0.21) * 12;
      D.beam.material.opacity = 0.08 + 0.06 * Math.sin(this.ufoT * 3);
      if (d < 260 || !win) {
        this.ufoLeave = 1; this.ufoGone = day; D.beam.visible = false;
        if (d < 900) {
          G.audio.tone?.('sawtooth', [180, 2400], 1.4, 0.12); G.rig && G.rig.shake && G.rig.shake(0.4);
          const first = !this.s.ufo; this.s.ufo = (this.s.ufo || 0) + 1; G.life.save();
          G.later?.(1.2, () => G.hud.toast(first ? 'Did you see that?' : 'Again?', first ? 'Over Parvati, at 3 in the morning. Nobody will believe you' : 'It keeps coming back to Parvati', 'info', 4));
        }
      }
    } else {
      this.ufoLeave += dt;
      u.position.y += dt * (40 + this.ufoLeave * this.ufoLeave * 260);
      u.position.x += dt * this.ufoLeave * 120;
      if (this.ufoLeave > 3) { G.scene.remove(u); u.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); this.ufo = null; }
    }
  }

  update(dt) {
    if (this.sw) this.show(dt);
    if (this.pv) this.ufoTick(dt);
  }
}
