// The jhola (E). You stop where you are; the camera comes round to your face, the street dims and goes quiet, and
// your cloth jhola lies open beside you, block-printed cotton, your things inside it at whatever angle they fell.
// Point at one and it lifts, with a paper tag in your handwriting: what it is, how many, what it does. Click to
// use it. Along the bottom, how you are, as things: your heartbeat (it races and weakens when you're hurt, and
// your breathing is in it when you're out of breath), a water bottle as full as you are, a cutting-chai glass for
// your energy, a steel tiffin for your hunger. Labels sewn on the bag take you to your diary and the rest.
import { ITEMS, describe } from '../game/life.js';
import { itemArt, photo } from './itemArt.js';
import { bagOrder } from '../game/bag.js';
import { cotton, lining, kraft, url, real } from './materials2d.js';

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MR = { water: 'पाण्याची बाटली', tiffin: 'डबा', vadapav: 'वडापाव', biscuit: 'पार्ले-जी', banana: 'केळी', chikki: 'चिक्की', medkit: 'औषधाची पेटी', painkiller: 'गोळ्या', ors: 'ओआरएस',
  energy: 'एनर्जी ड्रिंक', coldcoffee: 'कोल्ड कॉफी', bakarwadi: 'बाकरवडी', barfi: 'बर्फी', shrewsbury: 'श्रुजबेरी', gajra: 'गजरा', book: 'पुस्तक', lottery: 'लॉटरी', torch: 'टॉर्च', beer: 'बिअर' };
// where each thing landed in the bag: a loose scatter, the same every time for the same thing
const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

export class Jhola {
  constructor(G) {
    this.g = G; this.on = false; this.t = 0;
    const el = this.el = document.createElement('div'); el.className = 'jl'; el.hidden = true;
    el.innerHTML = `<div class="jl-dim"></div>
      <div class="jl-bag"><div class="jl-cloth"></div><div class="jl-in"><div class="jl-items"></div></div><div class="jl-strap l"></div><div class="jl-strap r"></div>
        <button class="jl-pocket" data-go="phone"><img alt=""><i class="flap"></i><span>फोन · T</span></button>
        <div class="jl-labels"><button data-go="diary"><b>दैनंदिनी</b>Diary · J</button><button data-go="own"><b>माझं</b>Owned</button><button data-go="near"><b>जवळ</b>Nearby</button><button data-go="guide"><b>माहिती</b>Guide</button></div>
        <div class="jl-tag" hidden><i class="jl-hole"></i><b></b><span class="mr"></span><span class="q"></span><p></p><em>click to use</em></div></div>
      <div class="jl-tray"><figure class="jl-v hb"><canvas width="360" height="120"></canvas><figcaption>हृदय · <span></span></figcaption></figure>
        <figure class="jl-v bo"><canvas width="90" height="180"></canvas><figcaption>पाणी · <span></span></figcaption></figure>
        <figure class="jl-v ch"><canvas width="90" height="130"></canvas><figcaption>चहा · <span></span></figcaption></figure>
        <figure class="jl-v tf"><canvas width="120" height="150"></canvas><figcaption>डबा · <span></span></figcaption></figure></div>
      <div class="jl-keys">E close · J diary · click a thing to use it</div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    const cot = real('cloth') || `url(${url(cotton())})`, rc = real('cloth');
    el.querySelector('.jl-cloth').style.backgroundImage = cot; el.style.setProperty('--cot', cot);
    // inside: the same cloth, wrong side out, in the bag's own shadow
    el.querySelector('.jl-in').style.backgroundImage = rc ? `linear-gradient(rgba(44,30,16,.8), rgba(22,14,6,.88)), ${rc}` : `url(${url(lining())})`;
    el.querySelector('.jl-tag').style.backgroundImage = real('kraft') || `url(${url(kraft())})`;
    el.addEventListener('pointerover', (e) => { const b = e.target.closest('.jl-it'); if (b) this.tagFor(b); });
    el.addEventListener('pointerout', (e) => { const b = e.target.closest('.jl-it'); if (b && !b.contains(e.relatedTarget)) this.tagFor(null); });
    el.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]'); if (go) { const k = go.dataset.go; this.close(); if (k === 'diary') G.diary && G.diary.open(); else if (k === 'phone') G.phone && G.phone.open(); else G.bag && G.bag.show(k); return; }
      const b = e.target.closest('.jl-it'); if (b) this.use(b.dataset.id, b);
    });
    addEventListener('keydown', (e) => {
      if (!this.on) return;
      if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
      else if (e.code === 'KeyJ') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); G.diary && G.diary.open(); }
    }, true);
  }
  open() {
    const G = this.g, P = G.player;
    if (this.on || G.state !== 'play') return;
    this.on = true; G.state = 'shop'; this.t = 0;
    G.audio.updateEngine?.(0, 0, false); G.audio.playerHorn?.(false); G.audio.hush?.(true);
    G.releaseMouse?.();
    const c = G.camera;
    this.from = { x: c.position.x, y: c.position.y, z: c.position.z, fov: c.fov };
    this.foot = P.onFoot;
    if (P.onFoot && P.human) P.human.play('idle', { fade: 0.3 });
    this.fill();
    // the phone in the side pocket: the brick, or the smartphone once you've got one
    { const im = this.el.querySelector('.jl-pocket img'), u = photo(G.phone && G.phone.smart ? 'phone' : 'keypad'); im.hidden = !u; if (u) im.src = u; }
    this.el.hidden = false; this.el.classList.remove('out'); void this.el.offsetWidth; this.el.classList.add('in');
    G.hud && G.hud.root && G.hud.root.classList.add('in-jl');
  }
  close() {
    if (!this.on) return;
    const G = this.g;
    this.on = false; this.tagFor(null); G.hud && G.hud.root && G.hud.root.classList.remove('in-jl');
    this.el.classList.remove('in'); this.el.classList.add('out'); setTimeout(() => { if (!this.on) this.el.hidden = true; }, 280);
    if (G.state === 'shop') G.state = 'play';
    G.audio.hush?.(false);
    if (this.from && Math.abs(G.camera.fov - this.from.fov) > 0.01) { G.camera.fov = this.from.fov; G.camera.updateProjectionMatrix(); }
    if (G.rig) G.rig.inited = false;
    G.life.save(); G.lockMouse?.();
  }
  // your things, where they fell: a loose scatter in the bag, several of a thing lying on top of each other
  fill() {
    const G = this.g, s = G.life.s, ids = bagOrder(G), box = this.el.querySelector('.jl-items');
    const n = ids.length, cols = n <= 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.max(1, Math.ceil(n / cols));
    box.innerHTML = ids.map((id, i) => {
      const h = hash(id), c = i % cols, r = Math.floor(i / cols);
      const x = (c + 0.5) / cols * 100 + ((h % 13) - 6) * 0.9, y = (r + 0.5) / rows * 100 + (((h >> 4) % 11) - 5) * 1.1, rot = ((h >> 8) % 46) - 23;
      const k = Math.min(3, s.inv[id] || 1), on = ITEMS[id].tool && G.lights && G.lights.torchOn;
      const copies = Array.from({ length: k }, (_, j) => `<img alt="" src="${itemArt(id, 256)}" style="transform:translate(${j * 9}px,${-j * 7}px) rotate(${j * 9 - 4}deg)">`).join('');
      return `<button class="jl-it${on ? ' on' : ''}" data-id="${id}" style="left:${x}%;top:${y}%;--r:${rot}deg;z-index:${Math.round(y)}">${copies}</button>`;
    }).join('') || '<p class="jl-empty">Empty. A kirana sells water, Parle-G and bananas; any eatery will pack you a parcel.</p>';
  }
  tagFor(b) {
    const T = this.el.querySelector('.jl-tag');
    if (!b) { T.hidden = true; return; }
    const id = b.dataset.id, it = ITEMS[id], s = this.g.life.s; if (!it) return;
    const on = it.tool && this.g.lights && this.g.lights.torchOn;
    T.querySelector('b').textContent = it.name; T.querySelector('.mr').textContent = MR[id] || '';
    T.querySelector('.q').textContent = (s.inv[id] || 0) > 1 ? `× ${s.inv[id]}` : '';
    T.querySelector('p').textContent = it.tool ? (on ? 'On. Click to switch it off.' : 'Click to switch it on.') : it.feed ? (it.feed === 'dog' ? 'Eat it, or feed a street dog.' : 'Eat it, or feed a cow.') : describe(it.use);
    T.querySelector('em').textContent = it.tool ? '' : 'click to use';
    const bag = this.el.querySelector('.jl-bag').getBoundingClientRect(), r = b.getBoundingClientRect();
    T.style.left = Math.min(bag.width - 250, r.right - bag.left - 12) + 'px'; T.style.top = Math.max(10, r.top - bag.top - 40) + 'px';
    T.hidden = false;
  }
  use(id, b) {
    const G = this.g, it = ITEMS[id]; if (!it) return;
    if (it.feed && G.strays) { const an = G.strays.near(G.player.x, G.player.z, 2.5); if (an && an.kind === it.feed) { this.close(); G.strays.interact(an); return; } }
    const msg = G.life.use(id);
    if (b) { b.classList.add('used'); }
    if (msg) G.hud.toast(it.name, msg, 'good', 2);
    setTimeout(() => { if (this.on) { this.fill(); this.tagFor(null); } }, 260);
  }
  // every frame (from game.frame): the camera round to your face, and the things in the tray, alive
  update(dt) {
    if (!this.on) return;
    const G = this.g, P = G.player, c = G.camera;
    this.t += dt;
    if (this.foot) {
      const F = P.foot, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw), rx = -fz, rz = fx, y = (F.y || 0);
      // in front of you and a little to your right, low, so you stand in the left third with the bag beside you
      const tx = F.x + fx * 2.5 + rx * 0.55, tz = F.z + fz * 2.5 + rz * 0.55, ty = y + 1.45;
      const k = 1 - Math.exp(-dt * 4.5), p = c.position;
      p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.z += (tz - p.z) * k;
      const lx = F.x - rx * 1.05, lz = F.z - rz * 1.05;
      c.lookAt(lx, y + 1.12, lz);
      if (Math.abs(c.fov - 42) > 0.1) { c.fov += (42 - c.fov) * k; c.updateProjectionMatrix(); }
      if (P.human) { P.human.holder.visible = true; P.human.mixer.update(dt); }
    }
    if ((this._vt = (this._vt || 0) - dt) <= 0) { this._vt = 1 / 30; this.vitals(); }
  }
  // a photo from assets/items, once it has loaded (null until then, and the painted one draws)
  pic(id) {
    const c = this._pics || (this._pics = {});
    if (!(id in c)) { const u = photo(id); c[id] = null; if (u) { const im = new Image(); im.src = u; c[id] = im; } }
    const im = c[id]; return im && im.complete && im.naturalWidth ? im : null;
  }
  vitals() {
    const G = this.g, P = G.player, s = G.life.s, el = this.el, t = this.t;
    const hp = Math.max(0, Math.min(1, (P.hp ?? 100) / G.life.hpMax)), st = P.stam ?? 1;
    // the heartbeat: a monitor trace, faster and weaker when you're hurt; your breathing (out of breath) under it
    { const cv = el.querySelector('.hb canvas'), x = cv.getContext('2d'), W = cv.width, H = cv.height;
      const bpm = Math.round(68 + (1 - hp) * 46 + (1 - st) * 52), amp = 0.35 + 0.65 * hp;
      x.fillStyle = '#071108'; x.fillRect(0, 0, W, H);
      x.strokeStyle = 'rgba(80,255,150,.08)'; x.lineWidth = 1; for (let X = 0; X < W; X += 20) { x.beginPath(); x.moveTo(X, 0); x.lineTo(X, H); x.stroke(); } for (let Y = 0; Y < H; Y += 20) { x.beginPath(); x.moveTo(0, Y); x.lineTo(W, Y); x.stroke(); }
      const beat = 60 / bpm, col = hp < 0.3 ? '#ff4b3e' : '#4dff9a';
      x.strokeStyle = col; x.lineWidth = 2.2; x.shadowColor = col; x.shadowBlur = 8; x.beginPath();
      for (let X = 0; X < W; X++) {
        const time = t - (W - X) / 120, ph = ((time % beat) + beat) % beat / beat;
        let v = 0;
        if (ph < 0.08) v = Math.sin(ph / 0.08 * Math.PI) * 0.12;                 // P
        else if (ph > 0.14 && ph < 0.16) v = -0.15; else if (ph >= 0.16 && ph < 0.2) v = 1; else if (ph >= 0.2 && ph < 0.24) v = -0.3;   // QRS
        else if (ph > 0.34 && ph < 0.5) v = Math.sin((ph - 0.34) / 0.16 * Math.PI) * 0.25;   // T
        v = v * amp + Math.sin(time * (1.2 + (1 - st) * 3.5)) * 0.06 * (0.3 + (1 - st));      // breathing
        const Y = H * 0.58 - v * H * 0.38; X ? x.lineTo(X, Y) : x.moveTo(X, Y);
      }
      x.stroke(); x.shadowBlur = 0;
      x.fillStyle = col; x.font = '700 22px Teko, Inter, sans-serif'; x.textAlign = 'right'; x.fillText(`♥ ${bpm}`, W - 10, 26);
      el.querySelector('.hb span').textContent = `${Math.round(P.hp ?? 100)} / ${G.life.hpMax}`; }
    // the water bottle: as full as you are, the water sloshing a little
    { const cv = el.querySelector('.bo canvas'), x = cv.getContext('2d'), W = cv.width, H = cv.height, f = Math.max(0, Math.min(1, s.thirst));
      x.clearRect(0, 0, W, H);
      const ph = this.pic('water');
      if (ph) {
        // the real bottle; the water in it tinted down to your level, the rest clear plastic
        x.drawImage(ph, (W - H) / 2, 0, H, H);
        x.save(); x.globalCompositeOperation = 'source-atop';
        const top = H * 0.97 - f * H * 0.8, wob = Math.sin(t * 2.4) * 2.5;
        x.fillStyle = 'rgba(232,240,248,.5)'; x.fillRect(0, H * 0.1, W, Math.max(0, top - H * 0.1));
        const g = x.createLinearGradient(0, top, 0, H); g.addColorStop(0, 'rgba(110,180,240,.5)'); g.addColorStop(1, 'rgba(30,100,190,.55)');
        x.fillStyle = g; x.beginPath(); x.moveTo(0, top + wob); x.quadraticCurveTo(W / 2, top - wob, W, top + wob); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, top + wob - 1, W, 2);
        x.restore();
        el.querySelector('.bo span').textContent = Math.round(f * 100) + '%';
      } else {
      const body = () => { x.beginPath(); x.moveTo(34, 8); x.lineTo(56, 8); x.lineTo(56, 26); x.quadraticCurveTo(76, 34, 76, 56); x.lineTo(76, 166); x.quadraticCurveTo(76, 174, 68, 174); x.lineTo(22, 174); x.quadraticCurveTo(14, 174, 14, 166); x.lineTo(14, 56); x.quadraticCurveTo(14, 34, 34, 26); x.closePath(); };
      x.save(); body(); x.clip();
      x.fillStyle = 'rgba(200,225,240,.18)'; x.fillRect(0, 0, W, H);
      const top = 174 - f * 140, wob = Math.sin(t * 2.4) * 2.5;
      const g = x.createLinearGradient(0, top, 0, 174); g.addColorStop(0, 'rgba(120,190,240,.85)'); g.addColorStop(1, 'rgba(40,120,200,.9)');
      x.fillStyle = g; x.beginPath(); x.moveTo(0, top + wob); x.quadraticCurveTo(W / 2, top - wob, W, top + wob); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();
      x.fillStyle = '#1a6fbf'; x.fillRect(14, 104, 62, 34); x.fillStyle = '#fff'; x.font = '700 11px Inter, sans-serif'; x.textAlign = 'center'; x.fillText('1 L', 45, 125);
      x.restore();
      x.strokeStyle = 'rgba(230,245,255,.6)'; x.lineWidth = 1.5; body(); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(20, 50, 5, 110);
      x.fillStyle = '#1e5fa8'; x.fillRect(32, 0, 26, 12);
      el.querySelector('.bo span').textContent = Math.round(f * 100) + '%'; } }
    // the cutting chai: the glass as full as your energy, steam when it's hot
    { const cv = el.querySelector('.ch canvas'), x = cv.getContext('2d'), W = cv.width, H = cv.height, f = Math.max(0, Math.min(1, s.energy));
      x.clearRect(0, 0, W, H);
      const glass = () => { x.beginPath(); x.moveTo(16, 40); x.lineTo(74, 40); x.lineTo(66, 124); x.lineTo(24, 124); x.closePath(); };
      x.save(); glass(); x.clip();
      x.fillStyle = 'rgba(220,230,235,.15)'; x.fillRect(0, 0, W, H);
      const top = 124 - f * 78; const g = x.createLinearGradient(0, top, 0, 124); g.addColorStop(0, '#d7a46a'); g.addColorStop(1, '#8a5326');
      x.fillStyle = g; x.fillRect(0, top, W, H); x.fillStyle = 'rgba(240,215,170,.8)'; x.fillRect(0, top, W, 3);
      for (let i = 0; i < 7; i++) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(20 + i * 8, 40, 2, 84); }
      x.restore();
      x.strokeStyle = 'rgba(235,245,250,.55)'; x.lineWidth = 1.5; glass(); x.stroke();
      if (f > 0.25) { x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 3; for (let k = 0; k < 3; k++) { x.beginPath(); for (let y = 36; y > 2; y -= 2) { const X = 30 + k * 15 + Math.sin(y * 0.18 + t * 2 + k) * 4; y === 36 ? x.moveTo(X, y) : x.lineTo(X, y); } x.stroke(); } }
      el.querySelector('.ch span').textContent = Math.round(f * 100) + '%'; }
    // the tiffin: three steel tiers, the top one open, as full as you are fed
    { const cv = el.querySelector('.tf canvas'), x = cv.getContext('2d'), W = cv.width, H = cv.height, f = Math.max(0, Math.min(1, s.hunger));
      x.clearRect(0, 0, W, H);
      const ph = this.pic('tiffin');
      if (ph) {
        // the real dabba; the tiers you've eaten through gone dull, from the top down
        x.drawImage(ph, (W - H) / 2, 0, H, H);
        x.save(); x.globalCompositeOperation = 'source-atop';
        const e = (1 - f) * H * 0.9; x.fillStyle = 'rgba(14,10,6,.55)'; x.fillRect(0, 0, W, e);
        const g = x.createLinearGradient(0, e, 0, H); g.addColorStop(0, 'rgba(255,190,90,.22)'); g.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = g; x.fillRect(0, e, W, H - e);
        x.restore();
        el.querySelector('.tf span').textContent = f < 0.2 ? 'hungry' : Math.round(f * 100) + '%';
      } else {
      const steel = (y, h) => { const g = x.createLinearGradient(14, 0, 106, 0); g.addColorStop(0, '#7d848b'); g.addColorStop(0.35, '#eef1f3'); g.addColorStop(0.6, '#b5bcc2'); g.addColorStop(1, '#646b72'); x.fillStyle = g; x.beginPath(); x.roundRect(14, y, 92, h, 6); x.fill(); x.strokeStyle = 'rgba(0,0,0,.25)'; x.stroke(); };
      steel(104, 34); steel(70, 34); steel(40, 30);
      x.fillStyle = '#5a6168'; x.beginPath(); x.ellipse(60, 40, 46, 9, 0, 0, 6.283); x.fill();
      x.save(); x.beginPath(); x.ellipse(60, 40, 42, 7.5, 0, 0, 6.283); x.clip();
      const g = x.createRadialGradient(56, 38, 2, 60, 40, 44); g.addColorStop(0, '#f4c35a'); g.addColorStop(1, '#c47a1e');
      x.globalAlpha = 0.25 + f * 0.75; x.fillStyle = g; x.fillRect(18, 32, 84 * Math.max(0.15, f), 16); x.restore(); x.globalAlpha = 1;
      x.strokeStyle = '#8d949b'; x.lineWidth = 4; x.beginPath(); x.moveTo(20, 60); x.quadraticCurveTo(60, 14 - 0, 100, 60); x.stroke();
      el.querySelector('.tf span').textContent = f < 0.2 ? 'hungry' : Math.round(f * 100) + '%'; } }
  }
}
