// The trial room (clothes, shoes) and the salon chair (hair): pick something and you see it on
// yourself straight away, the camera turned round to face you. Buy it and keep it on, or step
// out and you're back in what you came in with. Labelled Men's / Women's / Unisex; anyone can
// wear anything, and the street will react (people/areas.js, life.style).
import * as THREE from 'three';
import { CLOTHES, SHOES, fmt, applyWear } from './shops.js';
import { TIER_MUL } from './brands.js';
import { KbNav } from '../ui/kbnav.js';

const WHO = { M: 'Men’s', W: 'Women’s', U: 'Unisex' };
const r10 = (v) => Math.max(10, Math.round(v / 10) * 10);
const HAIR_M = [['hair_simpleparted', 'Side parting', 150], ['hair_buzzed', 'Army cut', 120]];
const HAIR_F = [['hair_long', 'Long, blow-dried', 700], ['hair_buns', 'Juda (bun)', 350], ['pony', 'Ponytail', 250], ['braid', 'Choti (plait)', 300], ['hair_buzzedfemale', 'Pixie cut', 600]];
const COLOURS = [[0x0d0b0a, 'Natural black', 400], [0x2a1a12, 'Dark brown', 650], [0x4a1a1a, 'Burgundy', 750], [0x6b4a2a, 'Caramel highlights', 1200]];

export class Trial {
  constructor(G) {
    this.g = G; this.open = false;
    const el = document.createElement('div');
    el.className = 'trial'; el.hidden = true;
    el.innerHTML = `<div class="tr-head"><div class="sh-k"></div><div class="sh-t"></div></div>
      <div class="tr-filters"></div><div class="tr-list"></div>
      <div class="tr-buy"><div class="tr-sel"><b></b><small></small></div><button class="tr-go"></button></div>
      <div class="sh-msg"></div><div class="sh-foot"><span></span><span><span class="kbd">↑↓</span> try on · <span class="kbd">Enter</span> buy · <span class="kbd">A</span><span class="kbd">D</span> filter · <span class="kbd" data-k="F">F</span> step out</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => {
      const f = e.target.closest('[data-f]'); if (f) { this.filter = f.dataset.f; this.render(); return; }
      const it = e.target.closest('[data-i]'); if (it) { this.pick(+it.dataset.i); return; }
      if (e.target.closest('.tr-go')) this.buy();
    });
    this.nav = new KbNav(el.querySelector('.tr-list'), '.tr-item', (b) => this.pick(+b.dataset.i));
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'Escape' || e.code === 'KeyF') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); e.stopImmediatePropagation(); if (this.sel >= 0) this.buy(); return; }
      if (this.mode === 'clothes' && /^(KeyA|KeyD|ArrowLeft|ArrowRight)$/.test(e.code)) {
        e.preventDefault(); e.stopImmediatePropagation();
        const F = ['all', 'M', 'W', 'U'], k = (F.indexOf(this.filter) + (/D|Right/.test(e.code) ? 1 : 3)) % 4;
        this.filter = F[k]; this.nav.i = -1; this.render(); return;
      }
      const m = /^Digit(\d)$/.exec(e.code);
      if (m) { const b = this.nav.items()[(+m[1] || 10) - 1]; if (b) { this.nav.i = (+m[1] || 10) - 1; this.pick(+b.dataset.i); } return; }
      this.nav.key(e);
    }, true);
  }
  get life() { return this.g.life; }
  // mode: 'clothes' | 'shoes' | 'salon'
  show(ctx, mode, sub) {
    const G = this.g, P = G.player;
    this.ctx = ctx; this.mode = mode; this.sub = sub; this.open = true; this.sel = -1;
    this.filter = mode === 'clothes' ? (ctx.tier === 'women' ? 'W' : ctx.tier === 'men' ? 'M' : 'all') : 'all';
    this.saved = cloneLook(P.look);
    G.state = 'shop'; G.rig.preview = true;
    this.el.querySelector('.sh-k').textContent = mode === 'salon' ? 'Salon chair' : mode === 'shoes' ? 'Footwear' : 'Trial room';
    this.el.querySelector('.sh-t').textContent = ctx.name;
    this.msg('');
    this.nav.i = -1;
    this.build();
    this.render();
    this.el.hidden = false;
  }
  build() {
    const L = this.life, P = this.g.player, mul = this.g.shops.priceMul(this.ctx.x, this.ctx.z) * (this.ctx.tier === 'brand' ? 1.35 : this.ctx.tier === 'ethnic' ? 1.2 : this.ctx.tier === 'premium' ? TIER_MUL.premium : this.ctx.tier === 'local' ? TIER_MUL.local : 1);
    const ethnic = (p) => p.cut && (p.cut[3] === 1 || p.cut[3] === 2);
    this.items = [];
    if (this.mode === 'clothes') {
      for (const [id, name, note, base, patch, who] of CLOTHES) {
        const kind = ethnic(patch) ? 'ethnic' : patch.top !== undefined ? 'tops' : patch.bottom !== undefined ? 'bottoms' : 'extras';
        if (this.sub && kind !== this.sub) continue;
        if (this.ctx.tier === 'ethnic' && kind !== 'ethnic') continue;
        this.items.push({ id, name, note, price: r10(base * mul), patch, who, swatch: patch.top ?? patch.bottom, own: L.s.wardrobe.includes(id) });
      }
    } else if (this.mode === 'shoes') {
      for (const [id, name, note, base, hex] of SHOES) this.items.push({ id: 'shoe_' + id, name, note, price: r10(base * mul), patch: { shoe: hex }, who: 'U', swatch: hex, own: L.s.wardrobe.includes('shoe_' + id) });
    } else {
      const fem = P.look.female, H = fem ? HAIR_F : HAIR_M;
      for (const [style, name, base] of H) this.items.push({ id: style, name, note: 'Cut and styled', price: r10(base * mul), patch: { style }, who: 'U', swatch: 0x2a201a });
      if (!fem) this.items.push({ id: 'beard', name: P.look.beard ? 'Clean shave' : 'Beard, trimmed and lined', note: 'Razor and alum', price: r10(90 * mul), patch: { beard: !P.look.beard }, who: 'M', swatch: 0x15110f });
      for (const [hex, name, base] of COLOURS) this.items.push({ id: 'col' + hex, name: `Colour: ${name}`, note: 'Lasts till you change it', price: r10(base * mul), patch: { hair: hex }, who: 'U', swatch: hex });
      this.items.push({ id: 'champi', name: 'Champi (head massage)', note: 'Ten minutes of bliss: energy and mood', price: r10(180 * mul), patch: {}, who: 'U', swatch: 0xd9a066, fx: () => L.apply({ energy: 0.15, mood: 0.1 }) });
      if (this.ctx.tier === 'premium') this.items.push({ id: 'keratin', name: 'Keratin treatment', note: 'Silky for weeks: charm up', price: r10(4500 * mul / TIER_MUL.premium), patch: {}, who: 'U', swatch: 0x8a6a4d, fx: () => { L.s.charmBoost = Math.min(0.25, (L.s.charmBoost || 0) + 0.07); } });
    }
  }
  render() {
    const f = this.el.querySelector('.tr-filters');
    f.innerHTML = this.mode === 'clothes' ? [['all', 'All'], ['M', 'Men’s'], ['W', 'Women’s'], ['U', 'Unisex']].map(([k, l]) => `<button data-f="${k}" aria-pressed="${k === this.filter}">${l}</button>`).join('') : '';
    const list = this.el.querySelector('.tr-list');
    list.innerHTML = this.items.map((it, i) => (this.filter === 'all' || it.who === this.filter || it.who === 'U' && this.filter !== 'all' && false) && (this.filter === 'all' || it.who === this.filter) ?
      `<button class="tr-item${i === this.sel ? ' on' : ''}" data-i="${i}"><i style="background:#${new THREE.Color(it.swatch).getHexString()}"></i><span><b>${it.name}</b><small>${this.mode === 'clothes' ? WHO[it.who] + ' · ' : ''}${it.note}</small></span><em>${it.own ? 'Yours' : fmt(it.price)}</em></button>` : '').join('');
    const it = this.items[this.sel], go = this.el.querySelector('.tr-go');
    this.el.querySelector('.tr-sel b').textContent = it ? it.name : 'Pick something to try on';
    this.el.querySelector('.tr-sel small').textContent = it ? (it.own ? 'Already yours' : `${fmt(it.price)}`) : 'You’ll see it on yourself right away';
    go.disabled = !it; go.textContent = it ? (it.own ? 'Wear it' : `Buy and wear · ${fmt(it.price)}`) : 'Buy';
    this.el.querySelector('.sh-foot span').textContent = `Cash ${fmt(this.g.stats.money)}`;
    this.nav.paint();
  }
  pick(i) {
    const G = this.g, P = G.player, it = this.items[i];
    if (!it) return;
    this.sel = i;
    const L = cloneLook(this.saved);
    applyPatch(L, it.patch);
    Object.assign(P.look, L);
    G.W.kit.applyLook(P.human, P.look);
    P.human.play(this.mode === 'salon' ? 'idle' : 'yes', { once: this.mode !== 'salon', restart: true });
    this.render();
    this.msg(this.mode === 'clothes' && !P.look.female && it.patch.cut && it.patch.cut[3] === 2 ? 'It suits you. Pune will have opinions' : '');
  }
  buy() {
    const G = this.g, L = this.life, it = this.items[this.sel];
    if (!it) return;
    if (!it.own && !G.shops.spend(it.price)) { this.msg(`Not enough cash for ${fmt(it.price)}`); return; }
    if (it.fx) { it.fx(); G.shops.speak?.(this.ctx.kind, 'order'); this.msg('Aah. That was good', true); this.render(); return; }
    if (!it.own && this.mode !== 'salon') { L.s.wardrobe.push(it.id); it.own = true; }
    G.shops.wear(it.patch);                 // commits the look and saves it
    this.saved = cloneLook(G.player.look);
    if (this.mode === 'salon') L.change('mood', 0.04);
    G.shops.speak?.(this.ctx.kind, 'order');
    this.msg(this.mode === 'salon' ? 'Done. Have a look' : 'Bought. You’re wearing it', true);
    this.render();
  }
  msg(t, good) { const m = this.el.querySelector('.sh-msg'); m.textContent = t || ''; m.classList.toggle('good', !!good); }
  close() {
    const G = this.g, P = G.player;
    this.open = false; this.el.hidden = true; G.rig.preview = false;
    // anything not bought comes off
    Object.assign(P.look, this.saved); G.W.kit.applyLook(P.human, P.look);
    if (G.state === 'shop') G.state = 'play';
    if (G.interiors && G.interiors.cur && G.interiors.cur.seat) G.interiors.stand();
  }
}
function cloneLook(L) { return { ...L, top: L.top.clone(), bottom: L.bottom.clone(), shoe: L.shoe.clone(), hair: L.hair.clone(), skin: L.skin.clone(), cut: L.cut.clone(), patCol: L.patCol ? L.patCol.clone() : null, hatCol: L.hatCol ? L.hatCol.clone() : null }; }
function applyPatch(L, p) {
  const c = (h) => new THREE.Color(h).convertSRGBToLinear();
  if (p.top !== undefined) L.top = c(p.top);
  if (p.bottom !== undefined) L.bottom = c(p.bottom);
  if (p.shoe !== undefined) L.shoe = c(p.shoe);
  if (p.hair !== undefined) L.hair = c(p.hair);
  if (p.cut) L.cut = new THREE.Vector4(...p.cut);
  if (p.style) L.style = p.style;
  if (p.beard !== undefined) L.beard = p.beard;
  applyWear(L, p);
}
