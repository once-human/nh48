// The backpack (E): what you carry, how you're doing, what you wear, what you own, and what's
// around you. "Nearby" is how you find things: every real shop, café, bar, ATM, pump and chowki
// within walking distance, grouped by what they do, with a tap to set a waypoint. Tab opens "Me".
import { ITEMS, describe } from './life.js';
import { KIND_INFO, fmt, lookFromJSON } from './shops.js';
import { PROPERTIES } from './props.js';

const TABS = [['bag', 'Bag'], ['me', 'Me'], ['wear', 'Wardrobe'], ['own', 'Owned'], ['near', 'Nearby']];
const GROUPS = [['food', 'Food & drink'], ['night', 'Night'], ['look', 'Look'], ['health', 'Health'], ['money', 'Money'], ['things', 'Shopping'], ['vehicle', 'Vehicles'], ['place', 'Places']];

export class Bag {
  constructor(G) {
    this.g = G; this.tab = 'bag'; this.group = 'food';
    const el = document.createElement('div');
    el.className = 'bag glass'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Backpack');
    el.innerHTML = `<div class="bg-tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-t="${k}">${l}</button>`).join('')}</div>
      <div class="bg-body"></div><div class="sh-msg" aria-live="polite"></div>
      <div class="sh-foot"><span class="sh-wallet"></span><span><span class="kbd">E</span> close</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]'); if (t) { this.tab = t.dataset.t; this.render(); return; }
      const g = e.target.closest('[data-g]'); if (g) { this.group = g.dataset.g; this.render(); return; }
      const b = e.target.closest('[data-act]'); if (b && !b.disabled) this.act(b.dataset.act, b.dataset.arg);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'Escape' || e.code === 'KeyE' || (e.code === 'Tab' && this.tab === 'me')) { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
    }, true);
  }
  get life() { return this.g.life; }
  show(tab) {
    const G = this.g;
    if (G.state !== 'play') return;
    if (tab) this.tab = tab;
    this.open = true; G.state = 'shop';
    G.audio.updateEngine?.(0, 0, false);
    this.el.hidden = false; this.msg('');
    this.render();
  }
  close() { this.open = false; this.el.hidden = true; if (this.g.state === 'shop') this.g.state = 'play'; this.life.save(); }
  msg(t) { this.el.querySelector('.sh-msg').textContent = t || ''; }
  render() {
    const G = this.g, L = this.life, s = L.s;
    this.el.querySelectorAll('.bg-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === this.tab));
    const B = this.el.querySelector('.bg-body');
    let h = '';
    const row = (label, note, right, act, arg, dis) => `<button class="sh-item" ${act ? `data-act="${act}"` : ''} ${arg !== undefined ? `data-arg="${arg}"` : ''} ${dis || !act ? 'disabled' : ''}><span class="n"></span><span class="nm"><b>${esc(label)}</b><small>${esc(note || '')}</small></span><span class="pr">${esc(right || '')}</span></button>`;
    if (this.tab === 'bag') {
      const ids = Object.keys(s.inv).filter(k => s.inv[k] > 0 && ITEMS[k]);
      if (!ids.length) h += `<p class="bg-empty">Empty. Kirana shops sell water, Parle-G and bananas; food places do parcels.</p>`;
      for (const id of ids) { const it = ITEMS[id]; h += row(`${it.icon} ${it.name} ×${s.inv[id]}`, it.note || describe(it.use), it.scratch ? 'Scratch' : it.use ? 'Use' : '', 'use', id); }
      if (s.vehicles.length) h += `<div class="bg-sub">Keys</div>` + s.vehicles.map(v => row(`🔑 ${cap(v.type)} · ${v.plate}`, 'Owned, see the Owned tab', '', null)).join('');
      if (s.gold) h += row(`🪙 Gold, ${s.gold} g`, `Worth about ${fmt(s.gold * G.shops.goldRate() * 0.97)} at a jeweller`, '', null);
    } else if (this.tab === 'me') {
      const P = G.player, st = L.style(), re = L.reaction();
      const bar = (label, v, note, warn) => `<div class="bg-meter${warn ? ' warn' : ''}"><span>${label}</span><i><b style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></b></i><small>${esc(note)}</small></div>`;
      const sgn = (v) => `<div class="bg-meter sgn"><i><b style="left:${v < 0 ? 50 + v / 2 : 50}%;width:${Math.abs(v) / 2}%" class="${v < 0 ? 'neg' : ''}"></b></i></div>`;
      h += `<div class="bg-meters">
        ${bar('Health', (P.hp ?? 100) / L.hpMax, `${Math.round(P.hp ?? 100)} / ${L.hpMax}`, (P.hp ?? 100) < 30)}
        ${bar('Food', s.hunger, s.hunger < 0.2 ? 'Hungry, eat something' : s.hunger > 0.8 ? 'Full' : 'Fine', s.hunger < 0.2)}
        ${bar('Water', s.thirst, s.thirst < 0.2 ? 'Thirsty' : 'Fine', s.thirst < 0.2)}
        ${bar('Energy', s.energy, s.energy < 0.2 ? 'Exhausted, sleep or chai' : 'Fine', s.energy < 0.2)}
        ${bar('Mood', s.mood, s.mood > 0.75 ? 'Great' : s.mood < 0.3 ? 'Low' : 'Okay')}
        ${bar('Style here', st.score, st.odd ? 'Turning heads (and tongues)' : st.score > 0.85 ? 'You fit right in' : 'Could dress for the area better')}
        ${bar('Fitness', s.fitness / 40, `+${Math.round(s.fitness)} max health · hit ${Math.round((L.punchMul - 1) * 100)}% harder`)}
        <div class="bg-two"><div><span>Respect</span>${sgn(s.respect)}<small>${s.respect > 25 ? 'People know you' : s.respect < -10 ? 'People laugh at you' : 'Nobody special yet'} (${Math.round(s.respect)})</small></div>
        <div><span>Karma</span>${sgn(s.karma)}<small>${s.karma > 20 ? 'Aajis bless you' : s.karma < -20 ? 'People cross the road' : 'Neutral'} (${Math.round(s.karma)})</small></div></div>
        ${s.drunk > 0.2 ? `<p class="bg-warn">${s.drunk > 0.6 ? 'Drunk' : 'Tipsy'}: driving now is a ₹10,000 fine if stopped.</p>` : ''}
        <p class="bg-read">How Pune reads you: <b>${{ respect: 'respected local', scared: 'trouble, keep away', odd: 'that one in the unusual outfit', drunk: 'had a few', nice: 'well turned out' }[re] || 'just another Punekar'}</b></p></div>`;
      h += `<div class="bg-sub">Record</div><div class="bg-facts">
        <span>Cash</span><b>${fmt(G.stats.money)}</b><span>Bank</span><b>${fmt(s.bank)}</b>
        <span>Rides</span><b>${G.stats.rides}${G.stats.rides ? ` · ★ ${G.stats.rating.toFixed(1)}` : ''}</b><span>Deliveries</span><b>${s.tally.deliveries}</b>
        <span>Fights won</span><b>${s.tally.fightsWon}</b><span>Knocked out</span><b>${s.tally.knockedOut}</b>
        <span>Strays fed</span><b>${s.tally.fed}</b><span>Rent earned</span><b>${fmt(s.tally.rentEarned)}</b>
        <span>Challans due</span><b>${fmt(G.police.duesTotal)}</b><span>Wanted</span><b>${G.police.heat ? '★'.repeat(G.police.heat) : 'No'}</b></div>`;
    } else if (this.tab === 'wear') {
      const own = s.wardrobe;
      if (!own.length) h += `<p class="bg-empty">Nothing bought yet. Any clothes shop on the map sells shirts, kurtas, sarees, anyone can wear anything.</p>`;
      h += row('Your original outfit', 'What you started in', 'Wear', 'wear', '__orig');
      for (const id of own) if (!id.startsWith('shoe_')) h += row(cap(id.replace(/_/g, ' ')), 'Bought', 'Wear', 'wear', id);
    } else if (this.tab === 'own') {
      h += `<div class="bg-sub">Property</div>`;
      for (const p of G.props.list) { const mine = G.props.owned(p); h += row(`${mine ? '🏠' : '🪧'} ${p.name}`, mine ? `Yours · rent ${fmt(p.rent)} a day` : `${fmt(p.price)} · ${p.sqft} sq ft · rent ${fmt(p.rent)}/day`, 'Show', 'wp', `p:${p.id}`); }
      h += `<div class="bg-sub">Vehicles</div>`;
      if (!s.vehicles.length) h += `<p class="bg-empty">None yet besides your auto. Showrooms (Honda, Bajaj, Maruti...) sell scooters to SUVs.</p>`;
      for (const v of s.vehicles) h += row(`${cap(v.type)} · ${v.plate}`, this.whereVeh(v) ? 'Parked, tap to find it' : 'In storage: “bring it out” at one of your homes', this.whereVeh(v) ? 'Find' : '', this.whereVeh(v) ? 'wp' : null, `v:${v.id}`);
      h += row('Your auto', G.police.towedAt ? `Towed to ${G.police.towedAt.name}` : 'Your living', 'Find', 'wp', 'auto');
    } else if (this.tab === 'near') {
      h += `<div class="bg-chips">${GROUPS.map(([k, l]) => `<button data-g="${k}" aria-pressed="${k === this.group}">${l}</button>`).join('')}</div>`;
      const P = G.player, list = G.shops.nearby(P.x, P.z, 900).filter(x => (KIND_INFO[x.kind] || [])[2] === this.group).slice(0, 40);
      if (this.group === 'place') for (const p of G.props.list) list.push({ name: p.name, kind: 'estate', x: p.x, z: p.z, d: Math.hypot(p.x - P.x, p.z - P.z), prop: true });
      list.sort((a, b) => a.d - b.d);
      if (!list.length) h += `<p class="bg-empty">Nothing of this kind close by. Try the map (M) and search.</p>`;
      list.forEach((x, i) => { G._nearCache = G._nearCache || []; G._nearCache[i] = x; h += row(x.name, x.prop ? 'Property for sale' : `${KIND_INFO[x.kind][0]}${x.mr ? ' · ' + x.mr : ''}`, x.d < 1000 ? `${Math.round(x.d)} m` : `${(x.d / 1000).toFixed(1)} km`, 'goto', i); });
    }
    B.innerHTML = h;
    this.el.querySelector('.sh-wallet').textContent = `Cash ${fmt(G.stats.money)}${s.bank ? ` · Bank ${fmt(s.bank)}` : ''}`;
  }
  whereVeh(v) {
    const P = this.g.player;
    const d = P.dropped.find(q => q.veh.owned && q.veh.owned.id === v.id);
    return d ? d.veh : P.cur && P.cur.owned && P.cur.owned.id === v.id ? P.cur : null;
  }
  act(a, arg) {
    const G = this.g, L = this.life;
    if (a === 'use') {
      const it = ITEMS[arg];
      if (it && it.feed && G.strays) { const a = G.strays.near(G.player.x, G.player.z, 2.5); if (a && a.kind === it.feed) { this.close(); G.strays.interact(a); return; } }
      this.msg(L.use(arg)); this.render(); return;
    }
    if (a === 'wear') {
      const P = G.player;
      if (arg === '__orig') { L.s.look = null; const base = G.baseLook(); Object.assign(P.look, base); G.W.kit.applyLook(P.human, P.look); this.msg('Back in your own clothes'); return; }
      G.shops.wearById(arg); this.msg('Changed'); return;
    }
    if (a === 'wp') {
      let t = null;
      if (arg === 'auto') t = G.police.towedAt || { x: G.player.auto.x, z: G.player.auto.z, name: 'Your auto' };
      else if (arg.startsWith('p:')) { const p = G.props.list.find(q => q.id === arg.slice(2)); if (p) t = { x: p.x, z: p.z, name: p.name }; }
      else if (arg.startsWith('v:')) { const v = this.whereVeh(L.s.vehicles.find(q => q.id === arg.slice(2))); if (v) t = { x: v.x, z: v.z, name: 'Your ' + v.spec.name.toLowerCase() }; }
      if (t) { G.setWaypoint({ x: t.x, z: t.z, name: t.name || 'Waypoint' }); this.close(); }
      return;
    }
    if (a === 'goto') { const x = G._nearCache && G._nearCache[+arg]; if (x) { G.setWaypoint({ x: x.x, z: x.z, name: x.name }); this.close(); } }
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export { PROPERTIES, lookFromJSON };
