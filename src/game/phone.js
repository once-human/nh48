// Your phone (T). You start with a keypad brick: a green LCD, texts, contacts, calls and Snake.
// A mobile or electronics shop sells a smartphone (no brand on it): apps for chats, UPI, Zwiggy, your
// homes and garage, the map and the camera. Once you have it there is no going back to the brick.
// Everything that lands as an SMS on the HUD also lands in the phone's inbox, and the story sends its
// texts here (G.phone.push).
import { fmt } from './shops.js';
import { levelOf, ASKS } from './date.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hhmm = (h) => { const H = Math.floor(h || 0), M = Math.floor(((h || 0) % 1) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// smartphone apps: [id, name, colour, svg path]
const APPS = [
  ['chats', 'Chats', '#25c26e', '<path d="M5 18.5 6.2 15A7.5 7.5 0 1 1 9 17.8z"/>'],
  ['contacts', 'Contacts', '#8e8e93', '<circle cx="12" cy="9" r="3.4"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>'],
  ['upi', 'UPI', '#5b3fd6', '<path d="M8 5 5 19M13 5l-3 14M15 9h4l-1 6h-4"/>'],
  ['zwiggy', 'Zwiggy', '#fc7d1a', '<path d="M12 3a6 6 0 0 0-6 6c0 4.5 6 11 6 11s6-6.5 6-11a6 6 0 0 0-6-6z"/><circle cx="12" cy="9" r="2"/>'],
  ['homes', 'Homes', '#e0a100', '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>'],
  ['garage', 'Garage', '#3a7bd5', '<path d="M5 15h14l-1.6-5H6.6z"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>'],
  ['shift', 'Rides', '#111111', '<path d="M4 15h16v3H4z"/><path d="M6 15l2-6h8l2 6"/>'],
  ['weather', 'Weather', '#2f8fe6', '<circle cx="9" cy="10" r="3.4"/><path d="M8 18h9a3 3 0 0 0 0-6 4.5 4.5 0 0 0-8.4 1.6A2.3 2.3 0 0 0 8 18z"/>'],
  ['story', 'Tasks', '#ff8a1f', '<path d="M6 4v16M6 5h11l-2.5 4L17 13H6"/>'],
  ['snake', 'Snake', '#2d6a2d', '<path d="M6 17h6a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/><circle cx="17.5" cy="5" r="1"/>'],
];
const DOCK = [
  ['call', 'Phone', '#30c75a', '<path d="M7 4h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2L16 12.5l4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2z"/>'],
  ['map', 'Maps', '#4cb050', '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14"/>'],
  ['camera', 'Camera', '#55565b', '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>'],
  ['msgs', 'Messages', '#2fa3f5', '<path d="M4 6h16v10H9l-5 4z"/>'],
];
const KP_MENU = [['msgs', 'Messages'], ['story', 'Tasks'], ['contacts', 'Contacts'], ['snake', 'Snake'], ['clock', 'Clock'], ['about', 'Upgrade']];

export class Phone {
  constructor(G) {
    this.g = G; this.on = false; this.stack = []; this.sel = 0;
    const el = this.el = document.createElement('div');
    el.className = 'hand'; el.hidden = true;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.badge = document.createElement('div');
    this.badge.className = 'ph-badge'; this.badge.hidden = true;
    (document.getElementById('ui') || document.body).appendChild(this.badge);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (b) { this.sel = +b.dataset.i; this.ok(); return; }
      if (e.target.closest('[data-back]')) this.back();
    });
    window.addEventListener('keydown', (e) => this.key(e), true);
    // every HUD SMS also lands in the inbox
    const hud = G.hud;
    if (hud && hud.sms && !hud._smsPhone) {
      const orig = hud.sms.bind(hud); hud._smsPhone = true;
      hud.sms = (app, body, amt = '', foot = '') => { this.store(app, body + (foot ? ` ${foot}` : '')); return orig(app, body, amt, foot); };
    }
  }
  get L() { return this.g.life; }
  get s() { return this.g.life.s; }
  get smart() { return !!this.s.phone; }
  get inbox() { return this.s.inbox || (this.s.inbox = []); }
  unread() { return this.inbox.filter(m => !m.read).length + (this.s.contacts || []).filter(c => c.ask && !c.done).length; }
  store(from, text) {
    this.inbox.unshift({ from, text, t: this.g.clock || 0, h: this.g.hour || 0, read: false });
    if (this.inbox.length > 60) this.inbox.length = 60;
    this.syncBadge();
  }
  // a text from someone (the story uses this): a buzz, a line on the HUD, the inbox
  push(from, text) {
    this.store(from, text);
    const G = this.g;
    G.audio && G.audio.blip && (G.audio.blip(), setTimeout(() => G.audio.blip(), 140));
    G.hud.toast(from, text.length > 70 ? text.slice(0, 68) + '...' : text, 'info', 3.2);
    if (this.on) this.render();
  }
  syncBadge() {
    const n = this.unread();
    this.badge.hidden = !n || this.on;
    this.badge.innerHTML = `<span class="kbd">T</span>${this.smart ? 'Phone' : 'Phone'} · ${n} new`;
  }

  // ------------------------------------------------------------------ open, close, keys
  toggle() { if (this.on) this.close(); else this.open(); }
  open() {
    const G = this.g;
    if (G.state !== 'play' || this.on) return;
    // the world doesn't stop: it slows to a thirtieth, and goes quiet and muffled, while you're on your phone
    this.on = true; G.timeWarp = 1 / 30; G.audio.muffle?.(true);
    this.stack = []; this.sel = 0; this.cur = this.smart ? 'home' : 'standby';
    G.audio.updateEngine?.(0, 0, false);
    this.el.hidden = false; this.el.className = 'hand ' + (this.smart ? 'smart' : 'kp');
    if (this.smart) G.releaseMouse?.();
    this.render(); this.syncBadge();
    this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
    G.audio.blip?.();
  }
  close() {
    const G = this.g;
    if (!this.on) return;
    this.stopSnake();
    this.on = false; this.el.hidden = true;
    G.timeWarp = 1; G.audio.muffle?.(false);
    G.lockMouse?.(); this.L.save(); this.syncBadge();
  }
  go(id, arg) { this.stack.push([this.cur, this.sel, this.arg]); this.cur = id; this.arg = arg; this.sel = 0; this.render(); this.g.audio.blip?.(); }
  back() {
    if (this.cur === 'snake' && this.sn && this.sn.run) { this.stopSnake(); }
    if (!this.stack.length) { this.close(); return; }
    [this.cur, this.sel, this.arg] = this.stack.pop(); this.render();
  }
  key(e) {
    if (!this.on) {
      if (e.code === 'KeyT' && this.g.state === 'play' && !e.repeat && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.open(); }
      return;
    }
    const c = e.code;
    e.preventDefault(); e.stopImmediatePropagation();
    if (this.cur === 'snake' && this.sn && this.sn.run) {
      const d = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], Digit2: [0, -1], Digit8: [0, 1], Digit4: [-1, 0], Digit6: [1, 0] }[c];
      if (d) { const sn = this.sn; if (d[0] !== -sn.dir[0] || d[1] !== -sn.dir[1]) sn.next = d; return; }
    }
    if (c === 'KeyT' || c === 'Escape') { if (c === 'Escape' && this.stack.length) this.back(); else this.close(); return; }
    if (c === 'Backspace' || c === 'KeyQ') { this.back(); return; }
    const n = this.items.length; if (!n) { if (c === 'Enter' || c === 'KeyF' || c === 'Space') this.ok(); return; }
    const cols = this.cols || 1;
    if (c === 'ArrowDown' || c === 'KeyS') this.sel = Math.min(n - 1, this.sel + cols);
    else if (c === 'ArrowUp' || c === 'KeyW') this.sel = Math.max(0, this.sel - cols);
    else if (c === 'ArrowRight' || c === 'KeyD') this.sel = Math.min(n - 1, this.sel + 1);
    else if (c === 'ArrowLeft' || c === 'KeyA') this.sel = Math.max(0, this.sel - 1);
    else if (c === 'Enter' || c === 'KeyF' || c === 'Space') { this.ok(); return; }
    else if (/^Digit[1-9]$/.test(c)) { const k = +c.slice(5) - 1; if (k < n) { this.sel = k; this.ok(); } return; }
    else return;
    this.g.audio.blip?.();
    this.render();
  }
  ok() { const it = this.items[this.sel]; if (it && it.act) { const r = it.act(); if (r !== false && this.on) this.render(); } }

  // ------------------------------------------------------------------ content
  contacts() { return (this.s.contacts || []).slice().sort((a, b) => (b.partner - a.partner) || b.aff - a.aff); }
  contactItems(c) {
    const G = this.g, out = [], pend = G.date.pending;
    if (c.ask && ASKS[c.ask.q]) ASKS[c.ask.q].forEach((o, i) => out.push({ t: `Reply: ${o[0]}`, act: () => { G.date.reply(c, i); this.syncBadge(); } }));
    if (!c.done) out.push({ t: `Call ${c.name}`, s: c.calledDay === Math.floor((G.clock || 0) / 24) ? 'You spoke today' : 'Hear how they are', act: () => { this.close(); G.date.call(c); return false; } });
    if (!c.done) out.push({ t: pend && pend.ct === c ? 'On the way to meet you' : 'Ask to meet', s: 'They pick a café nearby', act: () => { if (pend && pend.ct === c) return; if (G.date.askToMeet(c)) { this.close(); return false; } } });
    return out;
  }
  thread(name) { return this.inbox.filter(m => m.from === name); }
  build() {
    const G = this.g, s = this.s, cur = this.cur;
    let items = [], title = '', body = '';
    this.cols = 1;
    if (cur === 'standby') {
      items = [{ t: 'Menu', act: () => this.go('menu') }];
    } else if (cur === 'menu') {
      title = 'Menu';
      items = KP_MENU.map(([id, t]) => ({ t: id === 'msgs' && this.unread() ? `${t} (${this.unread()})` : t, act: () => this.go(id) }));
    } else if (cur === 'home') {
      this.cols = 4;
      items = [...APPS, ...DOCK].map(([id, t, col, svg]) => ({ id, t, col, svg, act: () => this.app(id) }));
    } else if (cur === 'msgs' || cur === 'chats') {
      title = cur === 'chats' ? 'Chats' : 'Messages';
      const people = this.contacts().filter(c => c.ask || cur === 'chats');
      for (const c of people) items.push({ t: c.name, s: c.ask ? 'Waiting for your reply' : `${levelOf(c)} · met at ${c.met}`, dot: !!c.ask, av: c.name, act: () => this.go('contact', c.name) });
      const senders = [];
      for (const m of this.inbox) if (!senders.includes(m.from)) senders.push(m.from);
      for (const f of senders) { const th = this.thread(f), un = th.filter(m => !m.read).length; items.push({ t: f, s: th[0].text, dot: un > 0, av: f, act: () => this.go('read', f) }); }
      if (!items.length) body = `<p class="ph-empty">No messages yet.</p>`;
    } else if (cur === 'read') {
      title = this.arg;
      const th = this.thread(this.arg); th.forEach(m => { m.read = true; }); this.syncBadge();
      body = `<div class="ph-thread">${th.slice().reverse().map(m => `<div class="ph-bub"><p>${esc(m.text)}</p><small>${DAYS[Math.floor(m.t / 24) % 7] || ''} ${hhmm(m.h)}</small></div>`).join('')}</div>`;
    } else if (cur === 'contacts' || cur === 'call') {
      title = cur === 'call' ? 'Recents' : 'Contacts';
      // your people (family, and everyone the story brings into your life) first, then the people you've met
      // around Pune, with a line between them
      const story = [['Aai', 'Home · Sadashiv Peth'], ['Bapu Kaka', 'The auto stand · Shaniwar Wada'], ...(this.s.storyContacts || [])];
      story.forEach(([n, sub], i) => items.push({ t: n, s: sub, av: n, sec: i === 0 ? 'Your people' : null, act: () => this.go('read', n) }));
      this.contacts().forEach((c, i) => items.push({ t: c.name, s: c.done ? 'Blocked you' : `${levelOf(c)} · met at ${c.met}`, av: c.name, sec: i === 0 ? 'Met around Pune' : null, act: () => this.go('contact', c.name) }));
      if (items.length === story.length) body = `<p class="ph-empty">Nobody saved yet. In a café or a club, people with a small heart over them are up for a chat: get them talking, then ask for their number.</p>`;
    } else if (cur === 'contact') {
      const c = this.contacts().find(q => q.name === this.arg);
      title = this.arg;
      if (c) {
        const hearts = Math.max(0, Math.min(5, Math.round(c.aff / 20)));
        body = `<div class="ph-card"><span class="ph-av big">${esc(c.name.charAt(0))}</span><b>${esc(c.name)}</b><small>${esc(levelOf(c))} · ${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)}</small><small>Met at ${esc(c.met)}${c.upset ? ' · upset with you' : ''}</small></div>`;
        if (c.ask && ASKS[c.ask.q]) { const m = G.date.text(c, 't_q_' + c.ask.q, { place: c.sawAt }); body += `<div class="ph-thread"><div class="ph-bub"><p>${esc(m.t)}</p></div></div>`; }
        items = this.contactItems(c);
      }
    } else if (cur === 'snake') {
      title = 'Snake';
      body = `<canvas class="ph-snake" width="168" height="120"></canvas><p class="ph-hint">${this.sn && this.sn.dead ? `Score ${this.sn.score} · best ${s.snakeHi || 0}` : `Best ${s.snakeHi || 0}`} · arrows or 2 4 6 8</p>`;
      if (!(this.sn && this.sn.run)) items = [{ t: this.sn && this.sn.dead ? 'Play again' : 'Play', act: () => { this.startSnake(); } }];
    } else if (cur === 'clock') {
      title = 'Clock';
      const day = Math.floor((G.clock || 0) / 24);
      body = `<div class="ph-big">${hhmm(G.hour)}</div><p class="ph-hint">Day ${day + 1} in Pune · ${DAYS[day % 7]}</p>`;
    } else if (cur === 'about') {
      title = 'Upgrade';
      body = `<p class="ph-empty">This brick does calls, texts and Snake. Any mobile or electronics shop sells a smartphone: chats, UPI, Zwiggy, your homes and garage. Once you switch, you won't go back.</p>`;
      items = [{ t: 'Find a mobile shop', act: () => { const m = G.shops.nearby(G.player.x, G.player.z, 2000).find(x => x.kind === 'mobile' || x.kind === 'electronics'); if (m) { G.setWaypoint({ x: m.x, z: m.z, name: m.name }); this.close(); return false; } G.hud.toast('None close by', 'Try the map', 'info', 2); } }];
    } else if (cur === 'upi') {
      title = 'UPI';
      const dues = G.police.duesTotal || 0;
      body = `<div class="ph-bal"><small>Cash on you</small><b>${fmt(G.stats.money)}</b><small>Bank</small><b>${fmt(s.bank || 0)}</b>${s.gold ? `<small>Gold</small><b>${s.gold} g</b>` : ''}</div>`;
      items.push({ t: dues ? `Pay e-challans · ${fmt(dues)}` : 'No pending e-challans', s: G.police.suspended ? 'Licence suspended until you pay' : 'MahaTraffic', act: dues ? () => { G.police.payDues(); } : null });
      if ((s.bank || 0) > 0) items.push({ t: 'Move ₹5,000 from bank to cash', s: 'Like an ATM, without the queue', act: () => { const a = Math.min(5000, s.bank); s.bank -= a; G.stats.money += a; G.saveStats(); G.audio.cash(); this.L.save(); } });
      if (G.stats.money >= 5000) items.push({ t: 'Move ₹5,000 from cash to bank', s: 'Safer than your pocket', act: () => { G.stats.money -= 5000; s.bank = (s.bank || 0) + 5000; G.saveStats(); G.audio.cash(); this.L.save(); } });
    } else if (cur === 'zwiggy') {
      title = 'Zwiggy';
      const o = this.order;
      body = o ? `<p class="ph-empty">${esc(o.what)} is on its way. About ${Math.max(1, Math.ceil(o.left / 30))} min.</p>` : `<p class="ph-empty">Hungry? Order to wherever you are. Or work for us: orders ping you, Y accepts.</p>`;
      if (!o) for (const [what, price, fx] of [['Misal pav from Katakirr', 180, { hunger: 0.6, mood: 0.05 }], ['Veg thali', 240, { hunger: 0.8, mood: 0.04 }], ['Chicken biryani', 320, { hunger: 0.85, mood: 0.06 }], ['Cold coffee and a sandwich', 210, { hunger: 0.35, thirst: 0.35 }]])
        items.push({ t: what, s: `${fmt(price)} · delivered in about 2 min`, act: () => { if (!G.shops.spend(price)) { G.hud.toast('Not enough cash', '', 'warn', 2); return; } this.order = { what, fx, left: 70 + Math.random() * 50 }; G.hud.toast('Order placed', `${what}, on its way`, 'good', 2.4); } });
      items.push({ t: s.zwiggy ? 'Delivery partner: on' : 'Delivery partner: off', s: 'Order pings while you roam', act: () => { s.zwiggy = !s.zwiggy; this.L.save(); } });
    } else if (cur === 'homes') {
      title = 'Homes';
      const own = G.props.list.filter(p => G.props.owned(p));
      for (const p of own) items.push({ t: p.name, s: G.props.rentedOut(p) ? `Rented out · ${fmt(p.rent)} a day` : 'Sleep, eat, keep your vehicles', act: () => { G.setWaypoint({ x: p.x, z: p.z, name: p.name }); this.close(); return false; } });
      if (!own.length) { body = `<p class="ph-empty">No homes yet. Six are for sale across the city.</p>`; for (const p of G.props.list) items.push({ t: p.name, s: `${p.kind} · ${fmt(p.price)}`, act: () => { G.setWaypoint({ x: p.x, z: p.z, name: p.name }); this.close(); return false; } }); }
    } else if (cur === 'garage') {
      title = 'Garage';
      items.push({ t: 'Your auto', s: G.police.towedAt ? `Towed to ${G.police.towedAt.name}` : 'Find it', act: () => { const a = G.police.towedAt || { x: G.player.auto.x, z: G.player.auto.z }; G.setWaypoint({ x: a.x, z: a.z, name: 'Your auto' }); this.close(); return false; } });
      for (const v of s.vehicles) { const w = G.jhola.whereVeh(v); items.push({ t: `${v.type} · ${v.plate}`, s: w ? 'Parked. Find it' : 'In storage at your home', act: w ? () => { G.setWaypoint({ x: w.x, z: w.z, name: 'Your ' + v.type }); this.close(); return false; } : null }); }
    } else if (cur === 'shift') {
      title = 'Rides';
      const R = G.rides;
      body = `<div class="ph-bal"><small>Status</small><b>${R.enabled ? 'On shift' : 'Off shift'}</b><small>Earned today</small><b>${fmt(G.stats.today || G.stats.shiftEarn || 0)}</b></div><p class="ph-empty">Get into any auto to go on shift. People waving for a ride show green on the map.</p>`;
    } else if (cur === 'story') {
      title = 'Tasks';
      if (G.free) body = `<p class="ph-empty">Free roam. The story waits for you in Story mode.</p>`;
      else { const rs = G.story.summary(); body = rs.length ? `<p class="ph-hint">Part One · Dark Store</p>` : `<p class="ph-empty">Part One, <b>Dark Store</b>, is on its way. Pune is yours till then.</p>`; for (const r of rs) items.push({ t: r.t, s: r.s, dot: r.cur, act: null }); }
    } else if (cur === 'weather') {
      title = 'Pune';
      const h = G.hour || 12, m = new Date().getMonth(), rain = m >= 5 && m <= 8, hot = m >= 2 && m <= 4;
      const t = Math.round((rain ? 26 : hot ? 33 : 29) - 6 * Math.cos((h - 3) / 24 * 6.283) * (rain ? 0.5 : 1) - (h < 6 || h > 21 ? 3 : 0));
      body = `<div class="ph-big">${t}°</div><p class="ph-hint">${rain ? 'Monsoon. Showers on and off, carry the umbrella' : hot ? 'Hot and dry. Nimbu paani weather' : h > 18 || h < 6 ? 'Clear night. Pleasant' : 'Clear skies'}</p><p class="ph-hint">Sunrise 6:30 · Sunset 18:15</p>`;
    }
    return { items, title, body };
  }
  app(id) {
    const G = this.g;
    if (id === 'map') { this.close(); G.toggleMap(true); return false; }
    if (id === 'camera') { this.close(); G.photo && G.photo.open(); return false; }
    this.go(id);
  }

  render() {
    if (!this.on) return;
    const G = this.g, { items, title, body } = this.build();
    this.items = items;
    if (this.sel >= items.length) this.sel = Math.max(0, items.length - 1);
    const clock = hhmm(G.hour);
    if (!this.smart) {
      // the brick: green LCD, soft keys, a keypad
      let scr = '';
      if (this.cur === 'standby') scr = `<div class="kp-top"><span class="kp-sig"><i></i><i></i><i></i><i></i></span><span class="kp-bat"><i></i><i></i><i></i></span></div><div class="kp-op">PUNE NET</div><div class="kp-clock">${clock}</div>${this.unread() ? `<div class="kp-note">${this.unread()} new message${this.unread() > 1 ? 's' : ''}</div>` : ''}`;
      else scr = `<div class="kp-title">${esc(title)}</div>${body}<div class="kp-list">${items.map((it, i) => `${it.sec ? `<div class="kp-sec">${esc(it.sec)}</div>` : ''}<div class="kp-row${i === this.sel ? ' sel' : ''}" data-i="${i}"><span>${i + 1}</span>${esc(it.t)}</div>`).join('')}</div>`;
      this.el.innerHTML = `<div class="kp-body"><div class="kp-ear"></div><div class="kp-lcd">${scr}</div>
        <div class="kp-soft"><span data-i="${this.sel}">${this.cur === 'standby' ? 'Menu' : 'Select'}</span><span data-back>${this.cur === 'standby' ? 'Close' : 'Back'}</span></div>
        <div class="kp-pad"><div class="kp-nav"><i></i></div><div class="kp-keys">${['1', '2 abc', '3 def', '4 ghi', '5 jkl', '6 mno', '7 pqrs', '8 tuv', '9 wxyz', '*', '0 ⎵', '#'].map(k => `<b>${k.split(' ')[0]}<small>${k.split(' ')[1] || ''}</small></b>`).join('')}</div></div>
        <div class="kp-help">↑↓ Enter · ⌫ back · T close</div></div>`;
    } else {
      let scr;
      if (this.cur === 'home') {
        const grid = items.slice(0, APPS.length), dock = items.slice(APPS.length);
        const ic = (it, i) => `<button class="sp-app${i === this.sel ? ' sel' : ''}" data-i="${i}"><i style="background:${it.col}"><svg viewBox="0 0 24 24">${it.svg}</svg>${(it.id === 'chats' || it.id === 'msgs') && this.unread() ? `<em>${this.unread()}</em>` : ''}</i><span>${esc(it.t)}</span></button>`;
        scr = `<div class="sp-wall"><div class="sp-date">${DAYS[Math.floor((G.clock || 0) / 24) % 7]} · Pune</div><div class="sp-grid">${grid.map((it, i) => ic(it, i)).join('')}</div><div class="sp-dock">${dock.map((it, i) => ic(it, i + APPS.length)).join('')}</div></div>`;
      } else {
        scr = `<div class="sp-page"><div class="sp-head"><button data-back>‹</button><b>${esc(title)}</b></div><div class="sp-scroll">${body}${items.map((it, i) => `${it.sec ? `<div class="sp-sec">${esc(it.sec)}</div>` : ''}<button class="sp-row${i === this.sel ? ' sel' : ''}${it.act ? '' : ' off'}" data-i="${i}">${it.av ? `<span class="ph-av">${esc(String(it.av).charAt(0))}</span>` : ''}<span class="nm"><b>${esc(it.t)}</b>${it.s ? `<small>${esc(it.s)}</small>` : ''}</span>${it.dot ? '<em></em>' : ''}</button>`).join('')}</div></div>`;
      }
      this.el.innerHTML = `<div class="sp-body"><div class="sp-screen"><span class="sp-island"></span><div class="sp-status"><b>${clock}</b><span class="sp-ic"><i></i><i></i><i></i><i></i><u></u></span></div>${scr}<div class="sp-home" data-back></div></div></div>
        <div class="sp-help">Arrows, Enter · ⌫ back · T close</div>`;
    }
    this.el.querySelector('.sel')?.scrollIntoView?.({ block: 'nearest' });
    if (this.cur === 'snake') this.drawSnake();
  }

  // ------------------------------------------------------------------ Snake
  startSnake() {
    this.sn = { body: [[8, 6], [7, 6], [6, 6]], dir: [1, 0], next: [1, 0], food: [14, 6], score: 0, run: true, dead: false, acc: 0 };
    this.render();
  }
  stopSnake() { if (this.sn) this.sn.run = false; }
  snakeTick() {
    const sn = this.sn, W = 21, H = 15;
    sn.dir = sn.next;
    const h = [(sn.body[0][0] + sn.dir[0] + W) % W, (sn.body[0][1] + sn.dir[1] + H) % H];
    if (sn.body.some(b => b[0] === h[0] && b[1] === h[1])) {
      sn.run = false; sn.dead = true;
      if (sn.score > (this.s.snakeHi || 0)) { this.s.snakeHi = sn.score; this.L.save(); }
      this.g.audio.tone?.('square', [220, 110], 0.25, 0.08);
      this.render(); return;
    }
    sn.body.unshift(h);
    if (h[0] === sn.food[0] && h[1] === sn.food[1]) {
      sn.score += 7; this.g.audio.blip?.();
      do { sn.food = [Math.floor(Math.random() * W), Math.floor(Math.random() * H)]; } while (sn.body.some(b => b[0] === sn.food[0] && b[1] === sn.food[1]));
    } else sn.body.pop();
    this.drawSnake();
  }
  drawSnake() {
    const cv = this.el.querySelector('.ph-snake'); if (!cv) return;
    const x = cv.getContext('2d'), sn = this.sn, k = 8, smart = this.smart;
    x.fillStyle = smart ? '#0e1a0e' : '#a9bb8a'; x.fillRect(0, 0, cv.width, cv.height);
    const ink = smart ? '#7ee07e' : '#1d2a17';
    x.strokeStyle = ink; x.lineWidth = 1; x.strokeRect(0.5, 0.5, cv.width - 1, cv.height - 1);
    if (!sn) { x.fillStyle = ink; x.font = 'bold 14px monospace'; x.textAlign = 'center'; x.fillText('SNAKE', 84, 64); return; }
    x.fillStyle = ink;
    for (const [bx, by] of sn.body) x.fillRect(bx * k + 1, by * k + 1, k - 1, k - 1);
    x.fillRect(sn.food[0] * k + 2, sn.food[1] * k + 2, k - 3, k - 3);
    x.font = 'bold 10px monospace'; x.textAlign = 'right'; x.fillText(String(sn.score).padStart(4, '0'), cv.width - 4, 10);
  }

  update(dt) {
    // the Zwiggy order on its way
    if (this.order) {
      this.order.left -= dt;
      if (this.order.left <= 0) {
        const o = this.order; this.order = null;
        this.L.apply(o.fx);
        this.store('Zwiggy', `Delivered: ${o.what}. Rate your order?`);
        this.g.hud.toast('Your Zwiggy order is here', `${o.what}. Eaten on the spot`, 'good', 3);
      }
    }
    if (this.on && this.cur === 'snake' && this.sn && this.sn.run) {
      this.sn.acc += dt;
      const step = Math.max(0.065, 0.14 - this.sn.score * 0.0012);
      while (this.sn.acc > step && this.sn.run) { this.sn.acc -= step; this.snakeTick(); }
    }
    if ((this._bt = (this._bt || 0) + dt) > 1) { this._bt = 0; this.syncBadge(); }
  }
}
