// The jhola (E): what you carry, how you're doing, what you wear, what you own, and what's around.
// "Nearby" is how you find things: every real shop, café, bar, ATM, pump and chowki within walking
// distance, grouped by what they do, plus the homes for sale; tap one and it's on your map.
// Tab opens straight to "Me".
import { ITEMS, describe } from './life.js';
import { KIND_INFO, fmt, lookFromJSON } from './shops.js';
import { PROPERTIES } from './props.js';
import { icon, ITEM_ICON } from '../ui/icons.js';
import { KbNav } from '../ui/kbnav.js';
import { guideHTML } from './guide.js';
import { BUSINESSES as BIZ } from './hustle.js';
import { levelOf } from './date.js';

const TABS = [['bag', 'Bag', 'झोळी'], ['me', 'Me', 'मी'], ['wear', 'Wardrobe', 'कपडे'], ['own', 'Owned', 'माझं'], ['near', 'Nearby', 'जवळ'], ['ppl', 'People', 'लोक'], ['guide', 'Guide', 'माहिती']];
const GROUPS = [['food', 'Food'], ['night', 'Night'], ['look', 'Look'], ['health', 'Health'], ['money', 'Money'], ['things', 'Shops'], ['vehicle', 'Vehicles'], ['place', 'Places'], ['homes', 'Homes for sale']];
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dist = (d) => d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`;

export class Bag {
  constructor(G) {
    this.g = G; this.tab = 'bag'; this.group = 'food';
    const el = document.createElement('div');
    el.className = 'jhola'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Backpack');
    el.innerHTML = `<div class="jh-top"><div class="jh-title"><b>Jhola</b><span lang="mr">झोळी</span></div><div class="jh-money"></div></div>
      <div class="jh-tabs" role="tablist">${TABS.map(([k, l, m]) => `<button role="tab" data-t="${k}"><b>${l}</b><span lang="mr">${m}</span></button>`).join('')}</div>
      <div class="jh-body"></div><div class="jh-msg" aria-live="polite"></div>
      <div class="jh-foot"><span><span class="kbd">A</span><span class="kbd">D</span> tabs · <span class="kbd">↑↓</span> <span class="kbd">Enter</span> use</span><span><span class="kbd">E</span> close · <span class="kbd">Tab</span> me</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    this.nav = new KbNav(el.querySelector('.jh-body'), '.jh-item, .jh-row[data-act], .jh-chips.sel button, .gd-sec > summary');
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]'); if (t) { this.tab = t.dataset.t; this.msg(''); this.render(); return; }
      const g = e.target.closest('[data-g]'); if (g) { this.group = g.dataset.g; this.render(); return; }
      const b = e.target.closest('[data-act]'); if (b && !b.disabled) this.act(b.dataset.act, b.dataset.arg);
    });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'Escape' || e.code === 'KeyE' || (e.code === 'Tab' && this.tab === 'me')) { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
      else if (e.code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); this.tab = 'me'; this.render(); }
      else if (/^(KeyA|KeyD|ArrowLeft|ArrowRight|KeyQ)$/.test(e.code)) {
        e.preventDefault(); e.stopImmediatePropagation();
        const k = TABS.findIndex(t => t[0] === this.tab), n = TABS.length;
        this.tab = TABS[(k + (/D|Right/.test(e.code) ? 1 : n - 1)) % n][0]; this.nav.i = -1; this.msg(''); this.render();
      } else this.nav.key(e);
    }, true);
  }
  get life() { return this.g.life; }
  show(tab) {
    const G = this.g;
    if (G.state !== 'play') return;
    if (tab) this.tab = tab;
    this.open = true; G.state = 'shop'; this.nav.i = -1;
    G.audio.updateEngine?.(0, 0, false);
    this.el.hidden = false; this.msg('');
    this.render();
    this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
  }
  close() { this.open = false; this.el.hidden = true; if (this.g.state === 'shop') this.g.state = 'play'; this.life.save(); }
  msg(t, good) { const m = this.el.querySelector('.jh-msg'); m.textContent = t || ''; m.classList.toggle('good', !!good); }
  row(ic, label, note, right, act, arg, cls = '') {
    return `<button class="jh-row ${cls}" ${act ? `data-act="${act}"` : 'disabled'} ${arg !== undefined ? `data-arg="${esc(arg)}"` : ''}>${icon(ic)}<span class="nm"><b>${esc(label)}</b><small>${esc(note || '')}</small></span><span class="go">${esc(right || '')}</span></button>`;
  }
  render() {
    const G = this.g, L = this.life, s = L.s;
    this.el.querySelectorAll('.jh-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === this.tab));
    this.el.querySelector('.jh-money').innerHTML = `<span><small>Cash</small><b>${fmt(G.stats.money)}</b></span>${s.bank ? `<span><small>Bank</small><b>${fmt(s.bank)}</b></span>` : ''}${s.gold ? `<span><small>Gold</small><b>${s.gold} g</b></span>` : ''}`;
    const B = this.el.querySelector('.jh-body');
    let h = '';
    if (this.tab === 'bag') {
      const ids = Object.keys(s.inv).filter(k => s.inv[k] > 0 && ITEMS[k]);
      if (!ids.length) h += `<p class="jh-empty">Nothing in here. A kirana sells water, Parle-G and bananas; any eatery will pack you a parcel.</p>`;
      else {
        h += '<div class="jh-grid">';
        for (const id of ids) {
          const it = ITEMS[id];
          h += `<button class="jh-item" data-act="use" data-arg="${id}" title="${esc(it.note || describe(it.use))}">${icon(ITEM_ICON[id] || 'parcel')}<b>${esc(it.name)}</b><small>${esc(it.scratch ? 'Scratch it' : it.feed ? (it.feed === 'dog' ? 'Eat, or feed a dog' : 'Eat, or feed a cow') : describe(it.use))}</small><i>${s.inv[id]}</i></button>`;
        }
        h += '</div>';
      }
      if (s.vehicles.length) h += `<div class="jh-sub">Keys</div>` + s.vehicles.map(v => this.row('key', `${cap(v.type)}`, v.plate, '', null)).join('');
    } else if (this.tab === 'me') {
      const P = G.player, st = L.style(), re = L.reaction(), hp = (P.hp ?? 100) / L.hpMax;
      const ring = (ic, label, v, note) => {
        const c = 2 * Math.PI * 22, low = v < 0.25;
        return `<div class="jh-ring${low ? ' low' : ''}"><svg class="rg" viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" class="bg"/><circle cx="26" cy="26" r="22" class="fg" stroke-dasharray="${(c * Math.max(0, Math.min(1, v))).toFixed(1)} ${c.toFixed(1)}"/></svg>${icon(ic)}<b>${label}</b><small>${esc(note)}</small></div>`;
      };
      const scale = (label, v, lo, hi) => `<div class="jh-scale"><div class="lab"><b>${label}</b><span>${v > 25 ? hi[0] : v < -15 ? lo[0] : 'Nobody special'}</span></div><div class="bar"><i style="left:${50 + v / 2}%"></i></div><div class="ends"><span>${lo[1]}</span><span>${hi[1]}</span></div></div>`;
      h += `<div class="jh-rings">
        ${ring('health', 'Health', hp, `${Math.round(P.hp ?? 100)} / ${L.hpMax}`)}
        ${ring('food', 'Food', s.hunger, s.hunger < 0.2 ? 'Hungry' : s.hunger > 0.8 ? 'Full' : `${Math.round(s.hunger * 100)}%`)}
        ${ring('water', 'Water', s.thirst, s.thirst < 0.2 ? 'Thirsty' : `${Math.round(s.thirst * 100)}%`)}
        ${ring('energy', 'Energy', s.energy, s.energy < 0.2 ? 'Exhausted' : `${Math.round(s.energy * 100)}%`)}
        ${ring('mood', 'Mood', s.mood, s.mood > 0.75 ? 'Great' : s.mood < 0.3 ? 'Low' : 'Okay')}</div>
        <div class="jh-read"><span>How Pune sees you</span><b>${{ respect: 'A respected local', scared: 'Trouble. Keep away', odd: 'The one in the unusual outfit', drunk: 'Had a few', nice: 'Well turned out' }[re] || 'Just another Punekar'}</b></div>
        <div class="jh-scales">${scale('Respect', s.respect, ['People laugh at you', 'Nobody'], ['People know you', 'Respected'])}${scale('Karma', s.karma, ['People cross the road', 'Bad'], ['Aajis bless you', 'Good'])}</div>
        <div class="jh-chips"><span><small>Style here</small><b>${st.odd ? 'Bold' : st.score > 0.85 ? 'Spot on' : st.score > 0.65 ? 'Fine' : 'Off'}</b></span><span><small>Fitness</small><b>+${Math.round(s.fitness)} health</b></span><span><small>Drink</small><b>${s.drunk > 0.6 ? 'Drunk' : s.drunk > 0.2 ? 'Tipsy' : 'Sober'}</b></span><span><small>Wanted</small><b>${G.police.heat ? '★'.repeat(G.police.heat) : 'No'}</b></span></div>
        <div class="jh-sub">Record</div>
        <div class="jh-stats">${[['Rides', `${G.stats.rides}${G.stats.rides ? ` · ★ ${G.stats.rating.toFixed(1)}` : ''}`], ['Deliveries', s.tally.deliveries], ['Fights won', s.tally.fightsWon], ['Knocked out', s.tally.knockedOut], ['Strays fed', s.tally.fed], ['Meals', s.tally.meals], ['Rent earned', fmt(s.tally.rentEarned)], ['Challans due', fmt(G.police.duesTotal)]].map(([a, b]) => `<span><small>${a}</small><b>${b}</b></span>`).join('')}</div>`;
    } else if (this.tab === 'wear') {
      const own = s.wardrobe.filter(w => !w.startsWith('shoe_'));
      h += this.row('shirt', 'What you started in', 'Your own clothes', 'Wear', 'wear', '__orig');
      for (const id of own) h += this.row('shirt', cap(id.replace(/_/g, ' ')), 'Bought', 'Wear', 'wear', id);
      for (const id of s.wardrobe.filter(w => w.startsWith('shoe_'))) h += this.row('shirt', cap(id.slice(5).replace(/_/g, ' ')), 'Footwear', 'Wear', 'wear', id);
      if (!own.length) h += `<p class="jh-empty">Nothing bought yet. Any clothes shop sells shirts, kurtas and sarees, and anyone can wear anything.</p>`;
    } else if (this.tab === 'own') {
      const homes = G.props.list.filter(p => G.props.owned(p));
      h += `<div class="jh-sub">Homes</div>`;
      if (!homes.length) h += `<p class="jh-empty">You don’t own a home yet. Six are for sale, from a 1 RK in Sadashiv Peth to a Boat Club Road bungalow. They’re on your map as house pins, and under Nearby, Homes for sale.</p>`;
      for (const p of homes) h += this.row('home', p.name, G.props.rentedOut(p) ? `Rented out · ${fmt(p.rent)} a day` : 'You live here: sleep, change, keep your vehicles', 'Show', 'wp', `p:${p.id}`);
      const biz = (s.biz || []).map(id => (G.hustle && BIZ.find(b => b.id === id))).filter(Boolean);
      h += `<div class="jh-sub">Businesses</div>`;
      if (!biz.length) h += `<p class="jh-empty">No businesses yet. Any estate agent sells a chai tapri, a vada pav stall, an auto fleet, a cloud kitchen, a PG or a café. Takings land in your bank every morning.</p>`;
      for (const b of biz) h += this.row('coin', b.name, `About ${fmt(b.day)} a day, into your bank`, '', null);
      h += `<div class="jh-sub">Vehicles</div>`;
      h += this.row('auto', 'Your auto', G.police.towedAt ? `Towed to ${G.police.towedAt.name}` : `Fuel ${Math.round((G.player.auto.fuel ?? 1) * 100)}% · body ${Math.round((1 - (G.player.auto.dmg || 0)) * 100)}%`, 'Find', 'wp', 'auto');
      for (const v of s.vehicles) { const w = this.whereVeh(v); h += this.row('scooter', `${cap(v.type)} · ${v.plate}`, w ? 'Parked. Tap to find it' : 'In storage. Bring it out at one of your homes', w ? 'Find' : '', w ? 'wp' : null, `v:${v.id}`); }
      if (!s.vehicles.length) h += `<p class="jh-empty">Showrooms (Honda, Bajaj, Maruti and the rest) sell everything from a cycle to an SUV.</p>`;
    } else if (this.tab === 'ppl') {
      const cs = (s.contacts || []).slice().sort((a, b) => (b.partner - a.partner) || b.aff - a.aff);
      if (!cs.length) h += `<p class="jh-empty">Nobody in your phone yet. In a club or a café, people with a small heart over them are up for a chat. Get them talking, then ask for their number.</p>`;
      const pend = G.date.pending;
      for (const c of cs) {
        const hearts = Math.max(0, Math.min(5, Math.round(c.aff / 20)));
        const lvl = levelOf(c), days = Math.max(0, Math.floor(((G.clock || 0) - (c.lastSeen || 0)) / 24));
        const note = `${lvl} · ${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)} · met at ${c.met}${days >= 2 ? ` · not seen in ${days} days` : ''}`;
        h += this.row(c.partner ? 'health' : 'phone', c.name, note, pend && pend.ct === c ? 'On the way' : 'Ask to meet', pend && pend.ct === c ? null : 'meet', c.name, c.partner ? 'partner' : '');
      }
      if (cs.length) h += `<p class="jh-empty">They pick a café nearby. Be there within a few hours. Bring a gajra, sweets or a book if you have one.</p>`;
    } else if (this.tab === 'guide') {
      h += `<div class="guide">${guideHTML()}</div>`;
    } else if (this.tab === 'near') {
      h += `<div class="jh-chips sel">${GROUPS.map(([k, l]) => `<button data-g="${k}" aria-pressed="${k === this.group}">${l}</button>`).join('')}</div>`;
      const P = G.player;
      let list;
      if (this.group === 'homes') list = G.props.list.map(p => ({ name: p.name, note: `${p.kind} · ${fmt(p.price)} · ${p.sqft} sq ft${G.props.owned(p) ? ' · yours' : ''}`, x: p.x, z: p.z, d: Math.hypot(p.x - P.x, p.z - P.z), ic: 'home' }));
      else list = G.shops.nearby(P.x, P.z, 900).filter(x => (KIND_INFO[x.kind] || [])[2] === this.group).slice(0, 40).map(x => ({ name: x.name, note: `${KIND_INFO[x.kind][0]}${x.mr ? ' · ' + x.mr : ''}`, x: x.x, z: x.z, d: x.d, ic: 'pin' }));
      list.sort((a, b) => a.d - b.d);
      this.nearList = list;
      if (!list.length) h += `<p class="jh-empty">Nothing like that close by. Search the map (M).</p>`;
      list.forEach((x, i) => { h += this.row(x.ic, x.name, x.note, dist(x.d), 'goto', i); });
    }
    B.innerHTML = h;
    this.nav.paint();
  }
  whereVeh(v) {
    if (!v) return null;
    const P = this.g.player;
    const d = P.dropped.find(q => q.veh.owned && q.veh.owned.id === v.id);
    return d ? d.veh : P.cur && P.cur.owned && P.cur.owned.id === v.id ? P.cur : null;
  }
  act(a, arg) {
    const G = this.g, L = this.life;
    if (a === 'use') {
      const it = ITEMS[arg];
      if (it && it.feed && G.strays) { const an = G.strays.near(G.player.x, G.player.z, 2.5); if (an && an.kind === it.feed) { this.close(); G.strays.interact(an); return; } }
      this.msg(L.use(arg), true); this.render(); return;
    }
    if (a === 'wear') {
      const P = G.player;
      if (arg === '__orig') { L.s.look = null; const base = G.baseLook(); if (base) { Object.assign(P.look, base); G.W.kit.applyLook(P.human, P.look); } this.msg('Back in your own clothes', true); return; }
      G.shops.wearById(arg); this.msg('Changed', true); return;
    }
    if (a === 'wp') {
      let t = null;
      if (arg === 'auto') t = G.police.towedAt || { x: G.player.auto.x, z: G.player.auto.z, name: 'Your auto' };
      else if (arg.startsWith('p:')) { const p = G.props.list.find(q => q.id === arg.slice(2)); if (p) t = { x: p.x, z: p.z, name: p.name }; }
      else if (arg.startsWith('v:')) { const v = this.whereVeh(L.s.vehicles.find(q => q.id === arg.slice(2))); if (v) t = { x: v.x, z: v.z, name: 'Your ' + v.spec.name.toLowerCase() }; }
      if (t) { G.setWaypoint({ x: t.x, z: t.z, name: t.name || 'Waypoint' }); this.close(); }
      return;
    }
    if (a === 'meet') { const c = (L.s.contacts || []).find(q => q.name === arg); if (c && G.date.askToMeet(c)) this.close(); return; }
    if (a === 'goto') { const x = this.nearList && this.nearList[+arg]; if (x) { G.setWaypoint({ x: x.x, z: x.z, name: x.name }); this.close(); } }
  }
}
export { PROPERTIES, lookFromJSON };
