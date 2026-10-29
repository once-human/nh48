// The inventory (E). The street stays where it is, dimmed, and the camera comes round behind you so you stand
// in the left third; over it a dark glass panel. Along the top the tabs (Q / E): Inventory, Map, Missions, Stats,
// Settings. Down the left what you're wearing, slot by slot (head, face, torso, legs, feet, back). In the middle
// your things in a grid, filtered by kind along the top, each a real photograph (or, for clothes, the game's
// own garment shot on a mannequin in the studio), with a weight bar under it. On the right the one you picked:
// a big picture, what it is, what it does, Use and Drop. Right-click for more (assign to a quick slot, inspect);
// drag a thing onto the quick bar at the bottom and 1 to 5 use it while you play.
import * as THREE from 'three';
import { ITEMS, describe } from '../game/life.js';
import { itemArt, photo } from './itemArt.js';
import { bagOrder } from '../game/bag.js';
import { CLOTHES, SHOES, applyWear, fmt } from '../game/shops.js';
import { Studio } from '../game/studio.js';
import { real } from './materials2d.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const col = (h) => new THREE.Color(h).convertSRGBToLinear();
// what a thing weighs (kg), and what a jhola holds before it cuts into your shoulder
const KG = { water: 1, tiffin: 0.8, vadapav: 0.25, biscuit: 0.1, banana: 0.6, chikki: 0.2, medkit: 0.9, painkiller: 0.02, ors: 0.03, energy: 0.3, coldcoffee: 0.4,
  bakarwadi: 0.3, barfi: 0.5, shrewsbury: 0.4, gajra: 0.05, book: 0.3, lottery: 0.01, torch: 0.25, beer: 0.6 };
const CAP = 12;
const TABS = [['inv', 'Inventory'], ['map', 'Map'], ['missions', 'Missions'], ['stats', 'Stats'], ['settings', 'Settings']];
// the kinds along the top of the grid, each with a little picture of one of them
// (weapons: none yet, the shelf is ready; hacking gear will go under tools)
const CATS = [['all', 'All'], ['food', 'Food & drink', 'vadapav'], ['med', 'Medical', 'medkit'], ['tool', 'Tools', 'torch'], ['weap', 'Weapons'], ['wear', 'Clothing'], ['misc', 'Misc', 'keys']];
const catOf = (id) => {
  const it = ITEMS[id]; if (!it) return 'misc';
  if (it.tool) return 'tool';
  const u = it.use || {};
  if (u.hp && !u.hunger) return 'med';
  if (u.hunger || u.thirst || u.energy || u.drunk) return 'food';
  return 'misc';
};
const KIND = { food: 'Food & drink', med: 'Medical', tool: 'Tool', weap: 'Weapon', wear: 'Clothing', misc: 'Misc' };
const EFFECT = { hunger: 'Food', thirst: 'Water', energy: 'Energy', mood: 'Mood', hp: 'Health', drunk: 'Drunk' };
// a garment's kind from its shop entry: what part of you it covers, and how the studio frames it
function pieceOf(p, shoe) {
  if (shoe) return { slot: 'feet', frame: 'shoe', label: 'Footwear' };
  const w = Array.isArray(p.cut) ? p.cut[3] : p.cutW;
  if (w === 2) return { slot: 'torso', frame: 'saree', label: 'Saree' };
  if (w === 1) return { slot: 'torso', frame: 'long', label: 'Kurta' };
  if (p.top === undefined && p.bottom !== undefined) return { slot: 'legs', frame: 'bottom', label: 'Bottoms' };
  return { slot: 'torso', frame: 'top', label: 'Top' };
}
const MANNEQUIN = 0x7d8086;

export class Jhola {
  constructor(G) {
    this.g = G; this.on = false; this.t = 0; this.tab = 'inv'; this.cat = 'all'; this.sel = null; this.orb = 0;
    this.renders = new Map(); this.queue = [];
    const el = this.el = document.createElement('div'); el.className = 'iv'; el.hidden = true;
    el.innerHTML = `<div class="iv-dim"></div>
      <div class="iv-panel">
        <nav class="iv-tabs"><div class="iv-tabrow"><span class="kbd">Q</span>${TABS.map(([k, n]) => `<button data-tab="${k}">${n}</button>`).join('')}<span class="kbd">E</span></div><span class="iv-when"></span></nav>
        <div class="iv-equip"></div>
        <div class="iv-stage" title="Drag to turn"></div>
        <section class="iv-inv">
          <div class="iv-cats">${CATS.map(([k, n, pic]) => `<button data-cat="${k}"><i class="ic" data-ic="${k}">${pic ? `<img alt="" src="${itemArt(pic, 96)}">` : ''}</i><span>${n}</span></button>`).join('')}</div>
          <div class="iv-grid"></div>
          <div class="iv-wt"><span></span><div class="bar"><i></i></div></div>
        </section>
        <aside class="iv-det"></aside>
        <div class="iv-cond"></div>
        <section class="iv-stats" hidden>
          <div class="iv-vit"><figure class="jl-v hb"><canvas width="360" height="120"></canvas><figcaption>Heart · <span></span></figcaption></figure>
            <figure class="jl-v bo"><canvas width="90" height="180"></canvas><figcaption>Water · <span></span></figcaption></figure>
            <figure class="jl-v ch"><canvas width="90" height="130"></canvas><figcaption>Energy · <span></span></figcaption></figure>
            <figure class="jl-v tf"><canvas width="120" height="150"></canvas><figcaption>Food · <span></span></figcaption></figure></div>
          <div class="iv-sbars"></div>
        </section>
        <div class="iv-keys"><span><span class="kbd">Drag</span>Quick slot</span><span><span class="kbd">F</span>Use</span><span><span class="kbd">R</span>Drop</span><span><span class="kbd">Esc</span>Back</span></div>
      </div>
      <div class="iv-ctx" hidden></div>
      <div class="iv-insp" hidden></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    // the quick bar lives on the HUD (you use it while you play); the inventory shows it too, to drop things on
    const qb = this.qb = document.createElement('div'); qb.className = 'iv-qb';
    qb.innerHTML = [1, 2, 3, 4, 5].map(k => `<div class="iv-q" data-q="${k - 1}"><span class="kbd">${k}</span><img alt="" hidden><b></b></div>`).join('');
    (document.getElementById('hud') || document.body).appendChild(qb);
    this.paintQuick();

    el.addEventListener('click', (e) => {
      const tb = e.target.closest('[data-tab]'); if (tb) { this.goTab(tb.dataset.tab); return; }
      const ct = e.target.closest('[data-cat]'); if (ct) { this.cat = ct.dataset.cat; this.paint(); return; }
      const eq = e.target.closest('[data-eq]'); if (eq) { this.cat = 'wear'; const k = eq.dataset.k; if (k) this.sel = k; this.paint(); return; }
      const cx = e.target.closest('[data-cx]'); if (cx) { this.ctxDo(cx.dataset.cx, cx.dataset.arg); return; }
      const bt = e.target.closest('[data-do]'); if (bt) { if (bt.dataset.do === 'use') this.useSel(); else if (bt.dataset.do === 'drop') this.dropSel(); return; }
      if (!e.target.closest('.iv-ctx')) this.ctx(null);
      if (e.target.closest('.iv-insp')) { this.inspect(null); return; }
    });
    el.addEventListener('dblclick', (e) => { const sl = e.target.closest('.iv-slot[data-k]'); if (sl) { this.sel = sl.dataset.k; this.useSel(); } });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); const sl = e.target.closest('.iv-slot[data-k]'); if (sl) { this.select(sl.dataset.k); this.ctx(sl.dataset.k, e.clientX, e.clientY); } else this.ctx(null); });
    // pick up a thing and drag it onto a quick slot; a click without moving just picks it
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const sl = e.target.closest('.iv-slot[data-k]');
      if (sl) { this.drag = { k: sl.dataset.k, x: e.clientX, y: e.clientY, on: false }; return; }
      if (e.target.closest('.iv-stage')) this.turn = { x: e.clientX, o: this.orb };
    });
    addEventListener('pointermove', (e) => {
      if (this.turn) { this.orb = this.turn.o + (e.clientX - this.turn.x) * 0.008; return; }
      const d = this.drag; if (!d) return;
      if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
        d.on = true; const en = this.entry(d.k);
        const gh = this.ghost = document.createElement('img'); gh.className = 'iv-ghost'; gh.src = en ? en.img || '' : ''; document.body.appendChild(gh);
        this.qb.classList.add('drop');
      }
      if (d.on) {
        this.ghost.style.transform = `translate(${e.clientX - 40}px, ${e.clientY - 40}px)`;
        const q = document.elementFromPoint(e.clientX, e.clientY); const t = q && q.closest && q.closest('.iv-q');
        for (const s of this.qb.children) s.classList.toggle('hot', s === t);
      }
    });
    addEventListener('pointerup', (e) => {
      this.turn = null;
      const d = this.drag; this.drag = null; if (!d) return;
      if (!d.on) { this.select(d.k); return; }
      this.ghost && this.ghost.remove(); this.ghost = null; this.qb.classList.remove('drop');
      for (const s of this.qb.children) s.classList.remove('hot');
      const q = document.elementFromPoint(e.clientX, e.clientY); const t = q && q.closest && q.closest('.iv-q');
      if (t) this.assign(d.k, +t.dataset.q);
    });
    this.qb.addEventListener('contextmenu', (e) => { const t = e.target.closest('.iv-q'); if (t && this.on) { e.preventDefault(); this.assign(null, +t.dataset.q); } });

    addEventListener('keydown', (e) => {
      const c = e.code;
      // 1 to 5 while you play: whatever is on that quick slot
      if (!this.on) {
        const m = /^Digit([1-5])$/.exec(c);
        if (m && !e.repeat && G.state === 'play' && !(G.phone && G.phone.on) && !(G.police && G.police.stop && G.police.stop.phase === 'talk') && !(G.cut && G.cut.on)) {
          const ae = document.activeElement; if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
          const k = (G.life.s.quick || [])[+m[1] - 1]; if (k) { e.preventDefault(); this.quickUse(k); }
        }
        return;
      }
      const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (!this.el.querySelector('.iv-insp').hidden && (c === 'Escape' || c === 'Space' || c === 'Enter')) { stop(); this.inspect(null); return; }
      if (!this.el.querySelector('.iv-ctx').hidden && c === 'Escape') { stop(); this.ctx(null); return; }
      if (c === 'Escape' || c === 'Tab') { stop(); this.close(); return; }
      if (c === 'KeyQ' || c === 'KeyE') { stop(); const i = TABS.findIndex(t => t[0] === this.tab); this.goTab(TABS[(i + (c === 'KeyE' ? 1 : TABS.length - 1)) % TABS.length][0]); return; }
      if (c === 'KeyJ') { stop(); this.goTab('missions'); return; }
      if (this.tab !== 'inv') return;
      if (c === 'KeyF' || c === 'Enter') { stop(); this.useSel(); return; }
      if (c === 'KeyR') { stop(); this.dropSel(); return; }
      if (c === 'KeyI' || c === 'Space') { stop(); if (this.sel) this.inspect(this.sel); return; }
      const m = /^Digit([1-5])$/.exec(c); if (m) { stop(); if (this.sel) this.assign(this.sel, +m[1] - 1); return; }
      const mv = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6, KeyA: -1, KeyD: 1, KeyW: -6, KeyS: 6 }[c];
      if (mv) { stop(); const L = this.list(), i = Math.max(0, L.findIndex(x => x.k === this.sel)), j = Math.max(0, Math.min(L.length - 1, i + mv)); if (L[j]) this.select(L[j].k); }
    }, true);
  }

  // ------------------------------------------------------------------ what you have, as slots
  entries() {
    const G = this.g, s = G.life.s, P = G.player, out = [];
    const smart = !!(G.phone && G.phone.smart);
    out.push({ k: 'phone', cat: 'tool', name: smart ? 'Smartphone' : 'Nokia keypad phone', kind: 'Utility item', kg: smart ? 0.2 : 0.09, img: itemArt(smart ? 'phone' : 'keypad', 256),
      desc: smart ? 'Your phone. Calls, texts, maps, Zwiggy, the camera.' : 'The brick. Texts, calls, contacts and Snake. It has survived three falls off the auto.', use: 'Open', fixed: true });
    const nv = (s.vehicles || []).length;
    out.push({ k: 'keys', cat: 'misc', name: 'Keys', kind: 'Keys', kg: 0.08 + nv * 0.04, img: itemArt('keys', 256), n: nv + 1,
      desc: `Your auto${nv ? ` and ${nv} more vehicle${nv > 1 ? 's' : ''}` : ''}, and the house key on the same ring.`, use: 'Show vehicles', fixed: true });
    for (const id of bagOrder(G)) {
      const it = ITEMS[id], u = it.use || {}, on = it.tool && G.lights && G.lights.torchOn;
      const effects = Object.entries(u).filter(([k]) => EFFECT[k]).map(([k, v]) => `${EFFECT[k]} ${v > 0 ? '+' : '−'}${k === 'hp' ? Math.abs(v) : Math.round(Math.abs(v) * 100) + '%'}`);
      out.push({ k: id, id, cat: catOf(id), name: it.name, kind: it.gift ? 'Gift · ' + KIND[catOf(id)] : KIND[catOf(id)], kg: KG[id] ?? 0.2, n: s.inv[id], img: itemArt(id, 256),
        desc: [it.note, it.feed ? (it.feed === 'dog' ? 'Eat it, or feed a street dog.' : 'Eat it, or feed a cow.') : '', !it.tool && !it.scratch ? describe(u) : ''].filter(Boolean).join(' · '),
        effects, use: it.tool ? (on ? 'Switch off' : 'Switch on') : it.scratch ? 'Scratch' : u.thirst && !u.hunger ? 'Drink' : u.hunger ? 'Eat' : 'Use', on });
    }
    // clothes: what you started in, and everything you've bought
    const base = G.baseLook && G.baseLook();
    if (base) out.push({ k: 'w:__orig', w: '__orig', cat: 'wear', name: 'Your own clothes', kind: 'Clothing · Outfit', kg: 0.9, img: this.shot('w:__orig', () => base, 'top', 'top'),
      desc: 'What you came back to Pune in.', use: 'Wear' });
    for (const w of s.wardrobe || []) {
      const c = CLOTHES.find(q => q[0] === w), sh = w.startsWith('shoe_') && SHOES.find(q => 'shoe_' + q[0] === w);
      if (!c && !sh) continue;
      const pc = pieceOf(c ? c[4] : {}, !!sh), worn = this.wearing(c ? c[4] : { shoe: sh[4] });
      out.push({ k: 'w:' + w, w, cat: 'wear', name: c ? c[1] : sh[1], kind: 'Clothing · ' + pc.label + (worn ? ' · wearing' : ''), kg: sh ? 0.8 : pc.frame === 'saree' ? 0.7 : 0.35,
        img: this.shot('w:' + w, () => this.lookWith(c ? c[4] : { shoe: sh[4] }, c ? c[5] : 'U'), pc.frame, pc.frame === 'shoe' ? 'shoe' : pc.frame === 'bottom' ? 'bottom' : 'top'),
        desc: c ? c[2] : sh[2], use: worn ? 'Wearing' : 'Wear', worn });
    }
    return out;
  }
  list() { const all = this._all || (this._all = this.entries()); return this.cat === 'all' ? all : all.filter(e => e.cat === this.cat); }
  entry(k) { return (this._all || this.entries()).find(e => e.k === k) || null; }
  // the player's look with one garment on it (for its picture)
  lookWith(p, who) {
    const P = this.g.player, L = { ...P.look };
    if (who === 'W') L.female = true; else if (who === 'M') L.female = false;
    if (p.top !== undefined) L.top = col(p.top);
    if (p.bottom !== undefined) L.bottom = col(p.bottom);
    if (p.shoe !== undefined) L.shoe = col(p.shoe);
    if (p.cut) L.cut = new THREE.Vector4(...p.cut);
    applyWear(L, p);
    return L;
  }
  wearing(p) {
    const L = this.g.player.look || {}, same = (a, h) => a && a.getHex && a.getHex() === col(h).getHex();
    if (p.shoe !== undefined) return same(L.shoe, p.shoe);
    return (p.top === undefined || same(L.top, p.top)) && (p.bottom === undefined || same(L.bottom, p.bottom));
  }

  // ------------------------------------------------------------------ clothes, shot in the studio on a grey mannequin
  // only the garment keeps its colour; skin, hair and everything else goes the mannequin's grey
  shot(key, lookFn, frame, keep) {
    const r = this.renders.get(key); if (r) return r;
    if (!this.queue.some(q => q.key === key)) this.queue.push({ key, lookFn, frame, keep });
    return null;
  }
  renderOne() {
    const job = this.queue.shift(); if (!job) return;
    const G = this.g;
    try {
      if (!this.studio) { this.studio = new Studio(G, 320, 320, { bg: null, floor: false }); }
      const g = col(MANNEQUIN), L = { ...job.lookFn() };
      L.skin = g; L.hair = g; L.beard = false; L.bindi = false;
      if (job.keep !== 'head') { L.glasses = false; L.shades = false; L.hat = false; }
      if (job.keep !== 'top') { if (!(L.cut && L.cut.w >= 1 && job.keep === 'bottom')) L.top = g; }
      if (job.keep !== 'bottom' && !(L.cut && L.cut.w >= 1)) L.bottom = g;
      if (job.keep !== 'shoe') L.shoe = g;
      this.studio.yaw = job.frame === 'shoe' ? 0 : 0.42;
      this.studio.dress(L);
      const cv = this.studio.shoot(job.frame);
      this.studio.undress();
      const url = trim(cv);
      this.renders.set(job.key, url);
      for (const im of this.el.querySelectorAll(`img[data-r="${CSS.escape(job.key)}"]`)) { im.src = url; im.hidden = false; }
      for (const im of this.qb.querySelectorAll(`img[data-r="${CSS.escape(job.key)}"]`)) { im.src = url; im.hidden = false; }
      if (this._all) { const e = this._all.find(x => x.k === job.key || x.r === job.key); if (e) e.img = url; }
    } catch (e) { this.renders.set(job.key, ''); }
  }
  // what you're wearing now, a piece at a time (for the slots down the left)
  wornShot(piece) {
    const L = this.g.player.look; if (!L) return null;
    const hx = (c) => (c && c.getHex ? c.getHex().toString(16) : '-');
    const sig = [piece, hx(L.top), hx(L.bottom), hx(L.shoe), L.cut ? L.cut.toArray().join(',') : '', L.pat || 0, hx(L.patCol), L.denim ? 1 : 0, L.female ? 1 : 0, L.glasses ? 1 : 0, L.shades ? 1 : 0, L.hat ? 1 : 0].join('|');
    const frame = piece === 'feet' ? 'shoe' : piece === 'legs' ? 'bottom' : piece === 'head' || piece === 'face' ? 'head' : L.cut && L.cut.w === 2 ? 'saree' : L.cut && L.cut.w === 1 ? 'long' : 'top';
    const keep = piece === 'feet' ? 'shoe' : piece === 'legs' ? 'bottom' : piece === 'head' || piece === 'face' ? 'head' : 'top';
    return { key: 'now:' + sig, url: this.shot('now:' + sig, () => ({ ...L }), frame, keep) };
  }

  // ------------------------------------------------------------------ open / close
  open() {
    const G = this.g, P = G.player;
    if (this.on || G.state !== 'play') return;
    this.on = true; G.state = 'shop'; this.t = 0; this.tab = 'inv'; this.orb = 0;
    G.audio.updateEngine?.(0, 0, false); G.audio.playerHorn?.(false); G.audio.hush?.(true);
    G.releaseMouse?.();
    const c = G.camera;
    this.from = { x: c.position.x, y: c.position.y, z: c.position.z, fov: c.fov };
    this.foot = P.onFoot;
    if (P.onFoot && P.human) P.human.play('idle', { fade: 0.3 });
    this._all = null; this.paint();
    this.el.hidden = false; this.el.classList.remove('out'); void this.el.offsetWidth; this.el.classList.add('in');
    this.qb.classList.add('open');
    G.hud && G.hud.root && G.hud.root.classList.add('in-jl');
  }
  close() {
    if (!this.on) return;
    const G = this.g;
    this.on = false; this.ctx(null); this.inspect(null); G.hud && G.hud.root && G.hud.root.classList.remove('in-jl');
    this.qb.classList.remove('open');
    this.el.classList.remove('in'); this.el.classList.add('out'); setTimeout(() => { if (!this.on) this.el.hidden = true; }, 240);
    if (G.state === 'shop') G.state = 'play';
    G.audio.hush?.(false);
    if (this.from && Math.abs(G.camera.fov - this.from.fov) > 0.01) { G.camera.fov = this.from.fov; G.camera.updateProjectionMatrix(); }
    if (G.rig) G.rig.inited = false;
    G.life.save(); G.lockMouse?.();
    this.paintQuick();
  }
  goTab(k) {
    const G = this.g;
    if (k === 'map') { this.close(); G.toggleMap && G.toggleMap(); return; }
    if (k === 'missions') { this.close(); G.diary && G.diary.open(); return; }
    if (k === 'settings') { this.close(); G.togglePause && G.togglePause(); return; }
    this.tab = k; this.paint();
  }

  // ------------------------------------------------------------------ drawing it
  paint() {
    const G = this.g, s = G.life.s, el = this.el, P = G.player;
    const hh = Math.floor(G.hour || 0), mm = String(Math.floor(((G.hour || 0) % 1) * 60)).padStart(2, '0'), day = Math.floor((G.clock || 0) / 24);
    el.querySelector('.iv-when').innerHTML = `<span class="cap">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day % 7]} · Day ${day + 1}</span><b class="num">${String(hh).padStart(2, '0')}:${mm}</b>`;
    this.paintCond();
    for (const b of el.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === this.tab);
    const stats = this.tab === 'stats';
    el.querySelector('.iv-inv').hidden = stats; el.querySelector('.iv-det').hidden = stats; el.querySelector('.iv-stats').hidden = !stats;
    el.querySelector('.iv-keys').hidden = stats; el.querySelector('.iv-cond').hidden = stats;
    // what you're wearing
    const L = P.look || {};
    const eq = [['head', 'Head', L.hat], ['face', 'Face', L.glasses || L.shades], ['torso', 'Torso', 1], ['legs', 'Legs', !(L.cut && L.cut.w === 2)], ['feet', 'Feet', 1], ['back', 'Back', 1]];
    el.querySelector('.iv-equip').innerHTML = eq.map(([k, n, has]) => {
      if (k === 'back') return `<button class="iv-eq" data-eq="back"><i class="jhola-sw"></i><span>${n}</span></button>`;
      const w = has ? this.wornShot(k) : null;
      return `<button class="iv-eq${has ? '' : ' empty'}" data-eq="${k}">${w ? `<img alt="" data-r="${esc(w.key)}" ${w.url ? `src="${w.url}"` : 'hidden'}>` : ''}<span>${n}</span></button>`;
    }).join('');
    const sw = el.querySelector('.jhola-sw'); if (sw) sw.style.backgroundImage = real('cloth') || 'none';
    if (stats) { this.paintStats(); return; }
    // the kinds
    const all = this._all || (this._all = this.entries());
    for (const b of el.querySelectorAll('[data-cat]')) { const k = b.dataset.cat; b.classList.toggle('on', k === this.cat); b.classList.toggle('none', k !== 'all' && !all.some(e => e.cat === k)); }
    { const ic = el.querySelector('[data-ic="all"]'); if (!ic.firstChild) ic.innerHTML = ['vadapav', 'water', 'keys', 'torch'].map(i => `<img alt="" src="${itemArt(i, 64)}">`).join(''); ic.classList.add('quad'); }
    { const ic = el.querySelector('[data-ic="wear"]'), w = this.wornShot('torso'); if (w) ic.innerHTML = `<img alt="" data-r="${esc(w.key)}" ${w.url ? `src="${w.url}"` : 'hidden'}>`; }
    // the grid: a full page of slots, the empty ones dark
    const items = this.list();
    if (!items.some(e => e.k === this.sel)) this.sel = items[0] ? items[0].k : null;
    const cells = Math.max(24, Math.ceil(items.length / 6) * 6);
    const q = s.quick || [];
    let h = '';
    for (let i = 0; i < cells; i++) {
      const e = items[i];
      if (!e) { h += '<div class="iv-slot empty"></div>'; continue; }
      const qi = q.indexOf(e.k);
      h += `<button class="iv-slot${e.k === this.sel ? ' sel' : ''}${e.on ? ' lit' : ''}${e.worn ? ' worn' : ''}" data-k="${esc(e.k)}">
        <img alt="" draggable="false" data-r="${esc(e.k)}" ${e.img ? `src="${e.img}"` : 'hidden'}>${e.n > 1 ? `<b class="n">${e.n}</b>` : ''}${qi >= 0 ? `<i class="qn">${qi + 1}</i>` : ''}${e.worn ? '<i class="wn">ON</i>' : ''}</button>`;
    }
    el.querySelector('.iv-grid').innerHTML = h;
    // the weight on your shoulder
    const kg = all.reduce((a, e) => a + (e.cat === 'wear' && e.worn ? 0 : e.kg * (e.id ? e.n || 1 : 1)), 0);
    el.querySelector('.iv-wt span').textContent = `${kg.toFixed(1)} / ${CAP} kg`;
    el.querySelector('.iv-wt i').style.width = Math.min(100, kg / CAP * 100) + '%';
    el.querySelector('.iv-wt').classList.toggle('over', kg > CAP);
    this.paintDet();
  }
  paintDet() {
    const D = this.el.querySelector('.iv-det'), e = this.entry(this.sel);
    if (!e) { D.innerHTML = this.cat === 'weap' ? `<p class="iv-none">No weapons.<br><small>Nothing to carry here yet.</small></p>` : `<p class="iv-none">Nothing here.<br><small>A kirana sells water, Parle-G and bananas; any eatery will pack you a parcel.</small></p>`; return; }
    const noUse = e.use === 'Wearing', noDrop = e.fixed || e.cat === 'wear';
    D.innerHTML = `<header><div><h3>${esc(e.name)}</h3><p>${esc(e.kind)}</p></div><small>${e.kg < 1 ? Math.round(e.kg * 1000) + ' g' : e.kg.toFixed(1) + ' kg'}</small></header>
      <div class="iv-big"><img alt="" data-r="${esc(e.k)}" ${e.img ? `src="${e.img}"` : 'hidden'}></div>
      ${e.n > 1 ? `<p class="iv-cnt">× ${e.n} in your jhola</p>` : ''}
      <p class="iv-desc">${esc(e.desc)}</p>
      ${e.effects && e.effects.length ? `<div class="iv-fx">${e.effects.map(f => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
      <div class="iv-acts"><button class="st-opt iv-btn use" data-do="use" ${noUse ? 'disabled' : ''}><span class="kbd">F</span><span class="o-t">${esc(e.use)}</span></button><button class="st-opt iv-btn" data-do="drop" ${noDrop ? 'disabled' : ''}><span class="kbd">R</span><span class="o-t">Drop</span></button></div>`;
  }
  paintStats() {
    const G = this.g, s = G.life.s, P = G.player, L = G.life;
    const bar = (n, v, lo, hi, signed) => `<div class="iv-sb"><div><b>${n}</b><span>${signed ? (v > 25 ? hi : v < -15 ? lo : 'Nobody special') : Math.round(v * 100) + '%'}</span></div><div class="t${signed ? ' mid' : ''}"><i style="${signed ? `left:${50 + Math.max(-50, Math.min(50, v / 2))}%` : `width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`}"></i></div></div>`;
    const T = s.tally || {};
    this.el.querySelector('.iv-sbars').innerHTML = `${bar('Mood', s.mood)}${bar('Stamina', P.stam ?? 1)}${bar('Respect', s.respect || 0, 'People laugh at you', 'People know you', true)}${bar('Karma', s.karma || 0, 'People cross the road', 'Aajis bless you', true)}
      <dl>${[['Fitness', `+${Math.round(s.fitness || 0)} health`], ['Health', `${Math.round(P.hp ?? 100)} / ${L.hpMax}`], ['Rides', G.stats.rides || 0], ['Deliveries', T.deliveries || 0], ['Fights won', T.fightsWon || 0], ['Strays fed', T.fed || 0], ['Bank', fmt(s.bank || 0)]].map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`;
  }
  // how you are, at a glance, under your feet: the body, then how Pune sees you
  paintCond() {
    const G = this.g, s = G.life.s, P = G.player, L = G.life, el = this.el.querySelector('.iv-cond'); if (!el) return;
    const bar = (n, v, txt) => { const f = Math.max(0, Math.min(1, v)); return `<div class="ic-b${f < 0.2 ? ' low' : ''}"><small>${n}</small><i><b style="width:${Math.round(f * 100)}%"></b></i><span>${txt ?? Math.round(f * 100) + '%'}</span></div>`; };
    const lean = (n, v, lo, hi) => `<div class="ic-l"><small>${n}</small><i><b style="left:${50 + Math.max(-50, Math.min(50, v / 2))}%"></b></i><span>${v > 25 ? hi : v < -15 ? lo : 'Nobody special'}</span></div>`;
    let st = null; try { st = L.style && L.style(); } catch (e) { /* not here */ }
    el.innerHTML = `<div class="ic-h"><span class="st-who">Condition</span></div>
      ${bar('Health', (P.hp ?? 100) / L.hpMax, `${Math.round(P.hp ?? 100)}`)}${bar('Food', s.hunger)}${bar('Water', s.thirst)}${bar('Energy', s.energy)}${bar('Stamina', P.stam ?? 1)}${bar('Mood', s.mood)}
      <div class="ic-h"><span class="st-who">Standing</span></div>
      ${lean('Respect', s.respect || 0, 'Laughed at', 'Known')}${lean('Karma', s.karma || 0, 'Avoided', 'Blessed')}
      <div class="ic-chips"><span><small>Style here</small>${st ? (st.odd ? 'Bold' : st.score > 0.85 ? 'Spot on' : st.score > 0.65 ? 'Fine' : 'Off') : '–'}</span><span><small>Fitness</small>+${Math.round(s.fitness || 0)}</span>${s.drunk > 0.15 ? `<span><small>Drink</small>${s.drunk > 0.6 ? 'Drunk' : 'Tipsy'}</span>` : ''}</div>`;
  }
  select(k) { this.sel = k; for (const b of this.el.querySelectorAll('.iv-slot[data-k]')) b.classList.toggle('sel', b.dataset.k === k); this.paintDet(); }

  // ------------------------------------------------------------------ doing things with them
  act(k, quiet) {
    const G = this.g, e = this.entry(k); if (!e) return;
    if (k === 'phone') { if (this.on) this.close(); G.phone && G.phone.open(); return; }
    if (k === 'keys') { if (this.on) this.close(); G.bag && G.bag.show('own'); return; }
    if (e.w) {
      const P = G.player;
      if (e.w === '__orig') { G.life.s.look = null; const base = G.baseLook(); if (base) { Object.assign(P.look, base); G.W.kit.applyLook(P.human, P.look); } }
      else G.shops.wearById(e.w);
      G.life.save(); G.hud.toast('Changed', e.name, 'good', 1.5);
      this._all = null; if (this.on) this.paint(); this.paintQuick(); return;
    }
    const it = ITEMS[e.id]; if (!it) return;
    if (!(G.life.s.inv[e.id] > 0)) { G.hud.toast(it.name, 'None left', 'warn', 1.5); return; }
    if (it.feed && G.strays) { const an = G.strays.near(G.player.x, G.player.z, 2.5); if (an && an.kind === it.feed) { if (this.on) this.close(); G.strays.interact(an); return; } }
    const msg = G.life.use(e.id);
    if (msg) G.hud.toast(it.name, msg, 'good', 2);
    this._all = null;
    if (this.on) { const sl = this.el.querySelector(`.iv-slot[data-k="${CSS.escape(k)}"]`); if (sl) sl.classList.add('used'); setTimeout(() => { if (this.on) this.paint(); }, quiet ? 0 : 220); }
    this.paintQuick();
  }
  useSel() { const e = this.entry(this.sel); if (e && e.use !== 'Wearing') this.act(this.sel); }
  dropSel() {
    const G = this.g, e = this.entry(this.sel); if (!e || e.fixed || e.cat === 'wear' || !e.id) return;
    const s = G.life.s; if (!(s.inv[e.id] > 0)) return;
    s.inv[e.id]--; if (!s.inv[e.id]) delete s.inv[e.id];
    G.life.save(); G.hud.toast('Dropped', e.name, 'info', 1.4);
    this._all = null; this.paint(); this.paintQuick();
  }
  quickUse(k) {
    const e = this.entry(k);
    if (!e) { this.g.hud.toast('Quick slot', 'Nothing of that left', 'warn', 1.4); return; }
    this.act(k, true);
  }
  assign(k, i) {
    const s = this.g.life.s, q = s.quick = (s.quick || [null, null, null, null, null]).slice(0, 5);
    while (q.length < 5) q.push(null);
    if (k) { const j = q.indexOf(k); if (j >= 0) q[j] = null; }
    q[i] = k; this.g.life.save();
    this.paintQuick(); if (this.on) this.paint();
  }
  paintQuick() {
    if (!this.g.life || !this.g.player) return;     // (built before the save is loaded; drawn on the first frame)
    const q = this.g.life.s.quick || [], all = this._all || this.entries();
    let any = false;
    [...this.qb.children].forEach((d, i) => {
      const k = q[i], e = k && all.find(x => x.k === k), im = d.querySelector('img'), b = d.querySelector('b');
      d.classList.toggle('none', !!k && !e);
      if (k) { any = true; const src = e ? e.img : k.startsWith('w:') ? this.renders.get(k) : itemArt(k, 128); im.dataset.r = k; if (src) { im.src = src; im.hidden = false; } else im.hidden = true; }
      else { im.hidden = true; im.removeAttribute('src'); }
      b.textContent = e && e.n > 1 ? e.n : '';
    });
    this.qb.classList.toggle('some', any);
    this._qsig = JSON.stringify([q, this.g.life.s.inv]);
  }

  // ------------------------------------------------------------------ the right-click menu and the close look
  ctx(k, x, y) {
    const C = this.el.querySelector('.iv-ctx');
    if (!k) { C.hidden = true; return; }
    const e = this.entry(k); if (!e) return;
    const noDrop = e.fixed || e.cat === 'wear';
    C.innerHTML = `<div class="iv-cx-h"><img alt="" src="${e.img || ''}"><b>${esc(e.name)}</b></div>
      <button data-cx="use" ${e.use === 'Wearing' ? 'disabled' : ''} class="first">${esc(e.use)}</button>
      <div class="iv-cx-q"><span>Assign to quick slot</span><div>${[1, 2, 3, 4, 5].map(n => `<button data-cx="q" data-arg="${n - 1}">${n}</button>`).join('')}</div></div>
      <button data-cx="drop" ${noDrop ? 'disabled' : ''}>Drop</button><button data-cx="inspect">Inspect</button><button data-cx="cancel">Cancel</button>`;
    C.hidden = false;
    const r = C.getBoundingClientRect();
    C.style.left = Math.min(innerWidth - r.width - 10, x) + 'px'; C.style.top = Math.min(innerHeight - r.height - 10, y) + 'px';
    this.ctxK = k;
  }
  ctxDo(a, arg) {
    const k = this.ctxK; this.ctx(null);
    if (a === 'use') { this.sel = k; this.useSel(); }
    else if (a === 'q') this.assign(k, +arg);
    else if (a === 'drop') { this.sel = k; this.dropSel(); }
    else if (a === 'inspect') this.inspect(k);
  }
  inspect(k) {
    const I = this.el.querySelector('.iv-insp');
    if (!k) { I.hidden = true; I.onpointermove = null; return; }
    const e = this.entry(k); if (!e) return;
    I.innerHTML = `<div class="iv-in-card"><div class="iv-in-pic"><img alt="" src="${e.img || ''}"></div>
      <div class="iv-in-tx"><h3>${esc(e.name)}</h3><p class="k">${esc(e.kind)} · ${e.kg < 1 ? Math.round(e.kg * 1000) + ' g' : e.kg.toFixed(1) + ' kg'}</p><p>${esc(e.desc)}</p>
      ${e.effects && e.effects.length ? `<div class="iv-fx">${e.effects.map(f => `<span>${esc(f)}</span>`).join('')}</div>` : ''}<small>Move the mouse to turn it · Esc to put it back</small></div></div>`;
    I.hidden = false;
    const pic = I.querySelector('.iv-in-pic img');
    I.onpointermove = (ev) => { const x = ev.clientX / innerWidth - 0.5, y = ev.clientY / innerHeight - 0.5; pic.style.transform = `perspective(900px) rotateY(${x * 34}deg) rotateX(${-y * 22}deg) scale(1.02)`; };
  }

  // ------------------------------------------------------------------ every frame (from game.frame)
  update(dt) {
    const G = this.g;
    if (!G.life || !G.player) return;
    { const pl = G.state === 'play' && !(G.cut && G.cut.on) && !(G.phone && G.phone.on); if (pl !== this._pl) { this._pl = pl; this.qb.classList.toggle('play', pl); } }
    if (!this.on) {
      // the quick bar keeps up with what you buy and eat
      if ((this._qt = (this._qt || 0) - dt) <= 0) { this._qt = 0.5; const sig = JSON.stringify([G.life.s.quick || [], G.life.s.inv]); if (sig !== this._qsig) { this._all = null; this.paintQuick(); } }
      if (this.queue.length && G.state === 'play') this.renderOne();
      return;
    }
    const P = G.player, c = G.camera;
    this.t += dt;
    if (this.queue.length) this.renderOne();
    if (this.foot) {
      const F = P.foot, y = (F.y || 0);
      // behind you and off to one side, low and far enough for head to toe; you stand in the left third
      const th = F.yaw + Math.PI + 0.55 + this.orb, d = 3.3;
      const tx = F.x + Math.cos(th) * d, tz = F.z + Math.sin(th) * d, ty = y + 1.2;
      const k = 1 - Math.exp(-dt * 4.5), p = c.position;
      p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.z += (tz - p.z) * k;
      const vx = F.x - p.x, vz = F.z - p.z, vl = Math.hypot(vx, vz) || 1, rx = -vz / vl, rz = vx / vl;
      const fov = 40, off = 0.5 * Math.tan(fov * Math.PI / 360) * c.aspect * vl;
      c.lookAt(F.x + rx * off, y + 0.95, F.z + rz * off);
      if (Math.abs(c.fov - fov) > 0.1) { c.fov += (fov - c.fov) * k; c.updateProjectionMatrix(); }
      if (P.human) { P.human.holder.visible = true; P.human.mixer.update(dt); }
    }
    if ((this._ct = (this._ct || 0) - dt) <= 0) { this._ct = 0.5; this.paintCond(); }
    if (this.tab === 'stats' && (this._vt = (this._vt || 0) - dt) <= 0) { this._vt = 1 / 30; this.vitals(); }
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
      const beat = 60 / bpm, cl = hp < 0.3 ? '#ff4b3e' : '#4dff9a';
      x.strokeStyle = cl; x.lineWidth = 2.2; x.shadowColor = cl; x.shadowBlur = 8; x.beginPath();
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
      x.fillStyle = cl; x.font = '700 22px Teko, Inter, sans-serif'; x.textAlign = 'right'; x.fillText(`♥ ${bpm}`, W - 10, 26);
      el.querySelector('.hb span').textContent = `${Math.round(P.hp ?? 100)} / ${G.life.hpMax}`; }
    // the water bottle: the real one, the water in it down to your level
    { const cv = el.querySelector('.bo canvas'), x = cv.getContext('2d'), W = cv.width, H = cv.height, f = Math.max(0, Math.min(1, s.thirst));
      x.clearRect(0, 0, W, H);
      const ph = this.pic('water');
      if (ph) {
        x.drawImage(ph, (W - H) / 2, 0, H, H);
        x.save(); x.globalCompositeOperation = 'source-atop';
        const top = H * 0.97 - f * H * 0.8, wob = Math.sin(t * 2.4) * 2.5;
        x.fillStyle = 'rgba(232,240,248,.5)'; x.fillRect(0, H * 0.1, W, Math.max(0, top - H * 0.1));
        const g = x.createLinearGradient(0, top, 0, H); g.addColorStop(0, 'rgba(110,180,240,.5)'); g.addColorStop(1, 'rgba(30,100,190,.55)');
        x.fillStyle = g; x.beginPath(); x.moveTo(0, top + wob); x.quadraticCurveTo(W / 2, top - wob, W, top + wob); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(0, top + wob - 1, W, 2);
        x.restore();
      }
      el.querySelector('.bo span').textContent = Math.round(f * 100) + '%'; }
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
    // the dabba: the real one, the tiers you've eaten through gone dull from the top
    { const cv = el.querySelector('.tf canvas'), x = cv.getContext('2d'), W = cv.width, H = cv.height, f = Math.max(0, Math.min(1, s.hunger));
      x.clearRect(0, 0, W, H);
      const ph = this.pic('tiffin');
      if (ph) {
        x.drawImage(ph, (W - H) / 2, 0, H, H);
        x.save(); x.globalCompositeOperation = 'source-atop';
        const e = (1 - f) * H * 0.9; x.fillStyle = 'rgba(14,10,6,.55)'; x.fillRect(0, 0, W, e);
        x.restore();
      }
      el.querySelector('.tf span').textContent = f < 0.2 ? 'hungry' : Math.round(f * 100) + '%'; }
  }
}

// a studio shot cut down to what's in it, centred in a square with a little air round it
function trim(cv) {
  const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return cv.toDataURL('image/png');
  const w = x1 - x0 + 1, h = y1 - y0 + 1, S = Math.round(Math.max(w, h) * 1.08), o = document.createElement('canvas');
  o.width = o.height = S; o.getContext('2d').drawImage(cv, x0, y0, w, h, (S - w) / 2, (S - h) / 2, w, h);
  return o.toDataURL('image/png');
}
