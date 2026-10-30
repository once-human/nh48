// What you hold: weapons and tools in your hand, the quick slots, and the wheel (hold Z: the world slows, push the
// mouse towards a slot, let go and it's in your hand). Grounded, not an arsenal: a bamboo lathi, a cricket bat, a
// kitchen knife, pepper spray (legal), and from under a chop shop's counter a country-made pistol, a katta (the
// Arms Act: carrying one is a serious matter if the police find it on you). Keys and the torch can be held too.
import * as THREE from 'three';
import { g as glyph } from '../ui/glyphs.js';

export const ARMS = {
  lathi: { name: 'Bamboo lathi', melee: 1.8, reach: 0.5, note: 'Long reach. Every havaldar carries one' },
  bat: { name: 'Cricket bat', melee: 2.1, reach: 0.45, note: 'Kashmir willow. For cricket, officially' },
  knife: { name: 'Kitchen knife', melee: 2.6, reach: 0.1, cut: true, note: 'Draw it and it’s a crime' },
  spray: { name: 'Pepper spray', spray: true, note: 'Legal. Three metres, five seconds of tears' },
  katta: { name: 'Katta (country pistol)', gun: true, dmg: 75, range: 38, illegal: true, note: 'Six rounds. Illegal: Arms Act, s.25' },
};
// things that may go on the quick slots (things you hold, not snacks)
export const HOLDABLE = new Set([...Object.keys(ARMS), 'torch', 'keys', 'umbrella']);

export class Arms {
  constructor(G) {
    this.g = G; this.held = null; this.wheelOn = false; this.sel = -1; this.aim = [0, 0];
    const el = this.el = document.createElement('div'); el.className = 'wheel'; el.hidden = true;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.cross = document.createElement('div'); this.cross.className = 'xhair'; this.cross.hidden = true; (document.getElementById('hud') || document.body).appendChild(this.cross);
    addEventListener('keydown', (e) => { if (e.code === 'KeyZ' && !e.repeat && G.state === 'play' && G.player.onFoot) { e.preventDefault(); this.openWheel(); } });
    addEventListener('keyup', (e) => { if (e.code === 'KeyZ' && this.wheelOn) this.closeWheel(true); });
    addEventListener('mousemove', (e) => { if (!this.wheelOn) return; const r = this.el.getBoundingClientRect(); const dx = document.pointerLockElement ? (this.aim[0] += e.movementX) : e.clientX - (r.left + r.width / 2), dy = document.pointerLockElement ? (this.aim[1] += e.movementY) : e.clientY - (r.top + r.height / 2); this.pick(dx, dy); });
  }
  get life() { return this.g.life; }
  slots() { const q = (this.life.s.quick || []).slice(0, 5); while (q.length < 5) q.push(null); return q; }
  // ---------------------------------------------------------------- the wheel
  openWheel() {
    const G = this.g; this.wheelOn = true; this.aim = [0, 0]; this.sel = -1; G.timeWarp = 0.25; G.audio.slowmo?.(1);
    const S = this.slots(), n = 6, R = 150;
    const seg = (i) => { const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n, a1 = a0 + Math.PI * 2 / n, r0 = 62, r1 = R; const p = (r, a) => `${(R + Math.cos(a) * r).toFixed(1)},${(R + Math.sin(a) * r).toFixed(1)}`; return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`; };
    const items = [null, ...S];          // the top one is your bare hands
    this.items = items;
    this.el.innerHTML = `<svg viewBox="0 0 ${R * 2} ${R * 2}">${items.map((_, i) => `<path class="wh-s" data-i="${i}" d="${seg(i)}"/>`).join('')}</svg>` +
      items.map((id, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2, x = 50 + Math.cos(a) * 35, y = 50 + Math.sin(a) * 35, it = id && (ARMS[id] || this.life.constructor.ITEM?.(id)); return `<div class="wh-i" style="left:${x}%;top:${y}%">${glyph(id ? (ARMS[id] ? (ARMS[id].gun ? 'burst' : ARMS[id].spray ? 'drop' : 'fist') : id === 'torch' ? 'bulb' : id === 'keys' ? 'key' : 'bag') : 'fist')}<small>${id ? (ARMS[id] ? ARMS[id].name : id[0].toUpperCase() + id.slice(1)) : 'Unarmed'}</small>${id && ARMS[id] && ARMS[id].gun ? `<em>${this.life.s.ammo || 0} rounds</em>` : ''}</div>`; }).join('') +
      `<div class="wh-c"><b>${this.held ? (ARMS[this.held] ? ARMS[this.held].name : this.held) : 'Unarmed'}</b><span>Move the mouse · let go of Z</span></div>`;
    this.el.hidden = false; this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
  }
  pick(dx, dy) {
    if (Math.hypot(dx, dy) < 30) return;
    const a = Math.atan2(dy, dx) + Math.PI / 2, n = 6, i = ((Math.round(a / (Math.PI * 2 / n)) % n) + n) % n;
    if (i === this.sel) return;
    this.sel = i; for (const p of this.el.querySelectorAll('.wh-s')) p.classList.toggle('on', +p.dataset.i === i);
    const id = this.items[i]; this.el.querySelector('.wh-c b').textContent = id ? (ARMS[id] ? ARMS[id].name : id) : 'Unarmed';
    this.g.audio.blip?.();
  }
  closeWheel(apply) {
    const G = this.g; this.wheelOn = false; this.el.hidden = true; G.timeWarp = 1; G.audio.slowmo?.(0);
    if (apply && this.sel >= 0) this.equip(this.items[this.sel]);
  }
  // ---------------------------------------------------------------- in your hand
  equip(id) {
    const G = this.g;
    if (id && !(this.life.s.inv[id] > 0)) { G.hud.toast('Not in your jhola', '', 'info', 1.4); return; }
    if (this.held === 'torch' && id !== 'torch' && G.lights) G.lights.setTorch(false);
    this.held = id || null;
    if (id === 'torch' && G.lights) { G.lights.setTorch(true); this.mesh(null); return; }
    this.mesh(id);
    if (id && ARMS[id] && ARMS[id].illegal) G.hud.toast('Careful', 'Anyone who sees that in your hand will call it in', 'warn', 2);
    if (id && ARMS[id] && (ARMS[id].cut || ARMS[id].gun)) { const P = G.player; G.police && G.police.law && G.police.law.report(1, `Drew a ${ARMS[id].gun ? 'pistol' : 'knife'} in public`, 'assault', P.x, P.z); G.people && G.people.list.forEach(p => { if (Math.hypot(p.x - P.x, p.z - P.z) < 14 && p.flee !== undefined && !p.cop) p.flee = 5; }); }
  }
  mesh(id) {
    const H = this.g.player.human; if (!H) return;
    if (this.m) { this.m.parent && this.m.parent.remove(this.m); this.m = null; }
    if (!id) return;
    const g = new THREE.Group(), M = (c, r = 0.6, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const add = (geo, mat, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); };
    if (id === 'lathi') add(new THREE.CylinderGeometry(0.016, 0.018, 1.35, 8), M(0xb08a4a), 0, 0, 0.45, Math.PI / 2);
    else if (id === 'bat') { add(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 8), M(0x2a2a2a, 0.8), 0, 0, 0.05, Math.PI / 2); add(new THREE.BoxGeometry(0.1, 0.035, 0.55), M(0xe6cfa0, 0.55), 0, 0, 0.48); }
    else if (id === 'knife') { add(new THREE.BoxGeometry(0.025, 0.02, 0.1), M(0x1b1c1f), 0, 0, 0.03); add(new THREE.BoxGeometry(0.03, 0.004, 0.15), M(0xd8dde2, 0.2, 0.9), 0, 0, 0.15); }
    else if (id === 'spray') add(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 10), M(0xc4161c, 0.4), 0, 0.03, 0.02);
    else if (id === 'katta') { add(new THREE.BoxGeometry(0.03, 0.09, 0.04), M(0x3a2a1a, 0.7), 0, -0.03, 0); add(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), M(0x2a2a2e, 0.35, 0.8), 0, 0.02, 0.08, Math.PI / 2); }
    else if (id === 'keys') { add(new THREE.TorusGeometry(0.02, 0.004, 6, 14), M(0xc9ced6, 0.3, 0.9), 0, 0, 0.02); for (const a of [-0.4, 0.3]) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.05), M(0xd4af37, 0.3, 0.9)); k.position.set(Math.sin(a) * 0.02, -0.02, 0.05); k.rotation.y = a; g.add(k); } }
    else add(new THREE.BoxGeometry(0.06, 0.06, 0.06), M(0x8a6a4a), 0, 0, 0.03);
    const hand = H.root.getObjectByName('hand_r'); if (!hand) return;
    hand.add(g); g.position.set(0, 0.05, 0.03); g.scale.setScalar(1 / (H.root.scale.x || 1)); this.m = g;
  }
  // the fight's move, changed by what you're holding (fight.js)
  meleeOf(M) { const W = this.held && ARMS[this.held]; if (!W || !W.melee) return M; return { ...M, dmg: M.dmg * W.melee, reach: M.reach + W.reach, push: M.push * 1.3, cut: W.cut }; }
  // a click with something that isn't for hitting: spray it, fire it. true = handled
  use() {
    const G = this.g, P = G.player, W = this.held && ARMS[this.held]; if (!W || !P.onFoot) return false;
    const F = P.foot, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
    if (W.spray) {
      let n = 0;
      for (const p of G.people.list) { const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz); if (d < 3.2 && (dx * fx + dz * fz) > 0.6 * d && !p.hidden) { p.fallen = Math.max(p.fallen || 0, 4.5); p.react = 4; p.reactAnim = 'no'; n++; } }
      G.audio.noiseBurst?.(0.5, 3000, 1, 0.3); if (n) G.hud.toast('Pepper spray', n > 1 ? `${n} people coughing` : 'They’re down, eyes streaming', 'info', 1.6);
      return true;
    }
    if (W.gun) {
      const s = this.life.s; if (!(s.ammo > 0)) { G.audio.blip?.(); G.hud.toast('Click', 'No rounds left', 'warn', 1.2); return true; }
      s.ammo--;
      // where the camera looks: the nearest person within a few degrees of it, in range and in sight
      const C = G.camera, dir = new THREE.Vector3(); C.getWorldDirection(dir); const flat = Math.hypot(dir.x, dir.z) || 1, ax = dir.x / flat, az = dir.z / flat;
      let best = null, bd = 1e9;
      for (const p of G.people.list) { if (p.hidden || p.fallen > 0) continue; const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz); if (d > W.range || d < 0.5) continue; const cos = (dx * ax + dz * az) / d; if (cos < 0.985) continue; if (G.W.collision.ray && G.W.collision.ray(F.x, F.z, p.x, p.z) < 0.97) continue; if (d < bd) { bd = d; best = p; } }
      G.audio.boom?.(0.35); G.rig.shake?.(0.25); P.human && P.human.play('punch', { once: true, restart: true, speed: 2 });
      if (best) G.people.hurt(best, W.dmg, F.x, F.z, { push: 0.8, down: 1 }, true);
      // a shot in the city: everyone runs, and it's a serious matter
      for (const p of G.people.list) if (Math.hypot(p.x - F.x, p.z - F.z) < 45 && p.flee !== undefined && !p.cop) p.flee = 8;
      G.police && G.police.raiseHeat(best ? 3 : 2, best ? 'Shot someone' : 'Shots fired', best ? 'hurt' : 'assault');
      return true;
    }
    return false;
  }
  update() {
    const G = this.g, P = G.player, W = this.held && ARMS[this.held];
    if (this.held && !(this.life.s.inv[this.held] > 0) && this.held !== 'torch') { this.held = null; this.mesh(null); }
    if (this.m) this.m.visible = P.onFoot;
    this.cross.hidden = !(W && W.gun && P.onFoot && G.state === 'play');
  }
}
