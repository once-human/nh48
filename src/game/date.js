// Talking to people, and where it can lead. In a club (or at a café table) you walk up to someone
// (the people open to it glance at you and get a small heart) and choose what to say. Everyone has
// a job and things they're into; ask what they do and you learn what they like, and talking about
// that lands far better. How it goes also depends on your charm (outfit for the area, mood, a clean
// smile, a drink or two but not five), and on how picky they are. They answer out loud.
// Get far enough and they dance with you, then give you their number. From the jhola's People
// tab you can ask to meet; they pick a real café nearby. Dates build affection: Met → Talking →
// Dating → Partner (you have to ask, and they can say not yet). A partner lifts your mood every
// day, texts you tips, sends food when you're starving, and makes you more confident. Ignore them
// for days and they'll tell you; get a number from someone else and they may find out.
// By default you talk to people of the other gender from your character.
import { RNG } from '../core/util.js';
import { fmt } from './shops.js';
import DL from './date_lines.json';
import { KbNav } from '../ui/kbnav.js';

const TOPICS = ['music', 'food', 'travel', 'cricket', 'movies', 'fitness'];
const TOPIC_LABEL = { music: 'Talk about the music', food: 'Talk about Pune food', travel: 'Talk about travelling', cricket: 'Talk cricket', movies: 'Talk about films', fitness: 'Talk about working out' };
const LEVELS = [[0, 'Met'], [15, 'Talking'], [40, 'Dating'], [101, 'Partner']];
export const levelOf = (c) => c.partner ? 'Partner' : LEVELS.filter(l => c.aff >= l[0]).pop()[1];

export class Dates {
  constructor(G) {
    this.g = G; this.rng = new RNG(3434); this.cur = null;
    const el = document.createElement('div');
    el.className = 'shop glass talk'; el.hidden = true;
    el.innerHTML = `<div class="sh-head"><div class="sh-k tk-k">Talking</div><div class="sh-t tk-name"></div><div class="tk-meta"><span class="tk-hearts"></span><span class="tk-job"></span></div>
      <div class="tk-bubble"><b class="tk-line"></b><span class="tk-how"></span></div></div><div class="sh-list tk-opts"></div><div class="sh-msg"></div>
      <div class="sh-foot"><span class="tk-charm"></span><span><span class="kbd">1–8</span> or <span class="kbd">↑↓</span> <span class="kbd">Enter</span> · <span class="kbd">F</span> leave</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => { const b = e.target.closest('.sh-item'); if (b && !b.disabled) this.pick(+b.dataset.i); });
    window.addEventListener('keydown', (e) => {
      if (!this.cur) return;
      if (e.code === 'Escape' || e.code === 'KeyF') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
      const m = /^Digit(\d)$/.exec(e.code); if (m) { this.pick(+m[1] - 1); return; }
      this.nav.key(e);
    }, true);
    this.nav = new KbNav(el.querySelector('.tk-opts'), '.sh-item');
  }
  get life() { return this.g.life; }
  get contacts() { return this.life.s.contacts || (this.life.s.contacts = []); }
  // who you'd talk to: the other gender from your character
  eligible(p) { return !!p && !p.walkedOff && !!p.female !== !!this.g.player.look.female; }
  profile(p) {
    if (p.prof) return p.prof;
    const r = this.rng, likes = [r.pick(TOPICS)]; let b = r.pick(TOPICS); if (b === likes[0]) b = TOPICS[(TOPICS.indexOf(b) + 1) % TOPICS.length]; likes.push(b);
    return (p.prof = { likes, job: r.int(0, DL.job.length - 1), picky: r.range(0.25, 0.75), known: false });
  }
  voice(p, key, i) {
    const arr = DL[key]; if (!arr) return '';
    if (i === undefined) { i = this.rng.int(0, arr.length - 1); const k = (p.id || 0) + key; if (arr.length > 1 && this.last === k + i) i = (i + 1) % arr.length; this.last = k + i; }
    this.g.audio.voice(`d_${p.female ? 'f' : 'm'}_${key}${i}`, 1, 0, false, 2);
    return arr[i];
  }

  // ---------------------------------------------------------------- a conversation
  talk(p, room) {
    const G = this.g;
    if (p.walkedOff) { G.hud.toast(`${p.name} isn’t interested`, 'Let it go', 'info', 2); return; }
    const contact = this.contacts.find(c => c.name === p.name && c.dateNow);
    const mode = contact ? 'date' : 'meet';
    this.cur = { p, room, mode, contact, club: room.R.tpl === 'club', interest: p.interest ?? 8, used: {}, turn: 0 };
    this.profile(p);
    G.state = 'shop';
    this.el.querySelector('.tk-k').textContent = mode === 'date' ? `On a date · ${levelOf(contact)}` : this.cur.club ? 'Talking' : 'Chatting';
    this.el.querySelector('.tk-name').textContent = p.name;
    this.say(mode === 'date' ? this.voice(p, 'date_hi') : this.voice(p, 'open'), mode === 'date' ? 'They’re happy to see you' : '');
    this.render();
    this.el.hidden = false;
  }
  say(line, how) { this.el.querySelector('.tk-line').textContent = line ? `“${line}”` : ''; this.el.querySelector('.tk-how').textContent = how || ''; }
  options() {
    const c = this.cur, P = this.profile(c.p), L = this.life, o = [];
    if (c.mode === 'date') {
      const ct = c.contact;
      o.push({ id: 'day', label: 'Ask about their day', base: 10 }, { id: 'share', label: 'Tell them something real about yourself', base: 12 }, { id: 'plan', label: 'Make plans for the weekend', base: 10, min: 25 });
      o.push({ id: 'order', label: 'Order for both of you', base: 8, cost: 450 });
      const gift = ['gajra', 'shrewsbury', 'barfi', 'bakarwadi', 'book'].find(id => L.has(id));
      if (gift) o.push({ id: 'gift', label: `Give them the ${gift === 'gajra' ? 'gajra' : gift === 'book' ? 'book' : 'sweets'}`, base: 16, gift });
      o.push({ id: 'hand', label: 'Hold their hand', base: 14, min: 40 });
      if (!ct.partner) o.push({ id: 'ask', label: 'Ask them to be your partner', base: 0, min: 70 });
      o.push({ id: 'bye', label: 'Call it a night', base: 0 });
      return o;
    }
    if (!P.known) o.push({ id: 'job', label: 'Ask what they do', base: 8 });
    // two things to talk about: one of theirs if you've learnt it
    const pool = TOPICS.filter(t => !c.used[t]);
    const pick = P.known && pool.includes(P.likes[0]) ? [P.likes[0]] : [];
    while (pick.length < 2 && pool.length) { const t = pool.splice(this.rng.int(0, pool.length - 1), 1)[0]; if (!pick.includes(t)) pick.push(t); }
    for (const t of pick) o.push({ id: 't_' + t, topic: t, label: TOPIC_LABEL[t] + (P.known && P.likes.includes(t) ? ' (they love this)' : ''), base: 6 });
    o.push({ id: 'compliment', label: 'Compliment them', base: 12 });
    if (c.club) o.push({ id: 'drink', label: 'Buy them a drink', base: 14, cost: 600 }, { id: 'dance', label: 'Ask them to dance', base: 12, min: 22 });
    o.push({ id: 'number', label: 'Ask for their number', base: 0, min: 55 }, { id: 'bye', label: 'Say bye', base: 0 });
    return o;
  }
  render() {
    const c = this.cur, L = this.life, P = this.profile(c.p);
    const v = c.mode === 'date' ? c.contact.aff : c.interest;
    const h = Math.max(0, Math.min(5, Math.round(v / 20)));
    this.el.querySelector('.tk-hearts').textContent = '♥'.repeat(h) + '♡'.repeat(5 - h);
    this.el.querySelector('.tk-job').textContent = P.known ? `${DL.job[P.job].split('.')[0].replace(/^I('m| work in| design)/, s => s)} · into ${P.likes.join(' and ')}` : '';
    this.el.querySelector('.tk-charm').textContent = `Your charm ${Math.round(L.charm * 100)}%${L.s.drunk > 0.15 && L.s.drunk < 0.5 ? ' · a drink in, confident' : L.s.drunk >= 0.7 ? ' · too drunk' : ''}`;
    this.opts = this.options();
    const list = this.el.querySelector('.tk-opts');
    list.innerHTML = '';
    this.opts.forEach((q, i) => {
      const b = document.createElement('button'); b.className = 'sh-item'; b.dataset.i = i;
      const locked = q.min && v < q.min;
      b.disabled = !!locked || (q.cost && this.g.stats.money < q.cost);
      b.innerHTML = `<span class="n">${i + 1}</span><span class="nm"><b></b><small></small></span><span class="pr"></span>`;
      b.querySelector('b').textContent = q.label;
      b.querySelector('small').textContent = locked ? (q.id === 'number' ? 'Get to know them a bit first' : q.id === 'ask' ? 'You’re not there yet' : 'Not yet') : '';
      b.querySelector('.pr').textContent = q.cost ? fmt(q.cost) : '';
      list.appendChild(b);
    });
    this.nav.paint();
  }
  pick(i) {
    const G = this.g, c = this.cur, q = this.opts && this.opts[i];
    if (!c || !q || (q.min && (c.mode === 'date' ? c.contact.aff : c.interest) < q.min)) return;
    if (q.id === 'bye') return this.close(true);
    if (q.cost && !G.shops.spend(q.cost)) return;
    if (c.mode === 'date') return this.datePick(q);
    if (q.id === 'number') return this.askNumber();
    const L = this.life, P = this.profile(c.p), p = c.p;
    // how it lands
    let chance = 0.22 + L.charm * 0.55 - (P.picky - 0.5) * 0.4 - (c.used[q.id] ? 0.35 : 0) + (q.cost ? 0.15 : 0);
    if (q.topic) chance += P.likes.includes(q.topic) ? 0.4 : -0.1;
    if (q.id === 'compliment' && c.turn === 0) chance -= 0.15;            // straight in with a compliment reads as a line
    const r = this.rng.next(), tone = r < chance ? 'good' : r < chance + 0.3 ? 'meh' : 'bad';
    c.used[q.id] = true; if (q.topic) c.used[q.topic] = true; c.turn++;
    let line, how;
    if (q.id === 'job') { P.known = true; line = this.voice(p, 'job', P.job); how = `They’re into ${P.likes[0]} and ${P.likes[1]}`; c.interest += 6; }
    else if (q.topic && tone === 'good') { line = this.voice(p, 'likes_' + q.topic); how = 'Now they’re talking'; }
    else if (q.id === 'compliment' && tone === 'good') line = this.voice(p, 'compliment');
    else if (q.id === 'drink' && tone !== 'bad') { line = this.voice(p, 'drink'); L.s.drunk = Math.min(1.2, L.s.drunk + 0.1); }
    else if (q.id === 'dance') { line = this.voice(p, tone === 'good' ? 'dance_yes' : 'dance_no'); if (tone === 'good') { G.interiors.dance(true); L.apply({ mood: 0.08 }); c.interest += 8; } }
    else line = this.voice(p, tone);
    if (q.id !== 'job') c.interest += tone === 'good' ? q.base + (q.topic && P.likes.includes(q.topic) ? 12 : 4) : tone === 'meh' ? 2 : -16;
    this.say(line, how || (tone === 'good' ? 'They’re smiling' : tone === 'meh' ? 'Polite, nothing more' : 'That didn’t land'));
    if (tone === 'good') L.apply({ mood: 0.02 });
    if (c.interest < 0) { p.walkedOff = true; this.say(this.voice(p, 'walkoff'), 'They walk off'); setTimeout(() => this.close(), 1800); }
    p.interest = c.interest;
    this.render();
  }
  askNumber() {
    const G = this.g, c = this.cur, L = this.life, p = c.p;
    const ok = this.rng.next() < 0.3 + c.interest / 140 + (L.charm - 0.5) * 0.3;
    if (!ok) { c.interest -= 12; p.interest = c.interest; this.say(this.voice(p, 'number_no'), 'Not tonight'); this.render(); return; }
    const P = this.profile(p);
    const contact = { name: p.name, female: !!p.female, likes: P.likes, job: P.job, met: c.room.ctx.name, aff: 10, t: G.clock || 0, lastSeen: G.clock || 0, partner: false, look: p.look ? { top: '#' + p.look.top.clone().convertLinearToSRGB().getHexString(), skin: '#' + p.look.skin.clone().convertLinearToSRGB().getHexString() } : null };
    const had = this.contacts.find(x => x.partner);
    this.life.s.contacts = this.contacts.filter(x => x.name !== contact.name).concat([contact]);
    L.change('mood', 0.12); L.change('respect', 1); L.save();
    this.say(this.voice(p, 'number_yes'), `${p.name} is in your phone. Jhola → People to text them`);
    p.walkedOff = true;
    // a partner may hear about it
    if (had && this.rng.next() < 0.35) G.later(this.rng.range(40, 120), () => { had.aff = Math.max(0, had.aff - 18); G.hud.sms(had.name, DL.text_angry[1], '', 'Affection down'); this.g.audio.voice(`d_${had.female ? 'f' : 'm'}_text_angry1`, 0.8, 0, false, 1); });
    else G.later(this.rng.range(50, 160), () => G.hud.sms(contact.name, `Hey, it’s ${contact.name} from ${contact.met} :)`, '', 'Ask to meet from Jhola → People'));
    setTimeout(() => this.close(), 2000);
  }
  // ---------------------------------------------------------------- dates
  datePick(q) {
    const G = this.g, c = this.cur, L = this.life, ct = c.contact, p = c.p;
    let line = '', how = '', gain = 0;
    const chance = 0.45 + L.charm * 0.45 - (c.used[q.id] ? 0.4 : 0);
    const good = this.rng.next() < chance;
    c.used[q.id] = true;
    switch (q.id) {
      case 'day': line = this.voice(p, 'date_day'); gain = good ? 6 : 2; how = 'You listen'; break;
      case 'share': line = good ? this.voice(p, 'date_share') : this.voice(p, 'meh'); gain = good ? 9 : 1; how = good ? 'They lean in' : 'Maybe too much, too soon'; break;
      case 'plan': line = this.voice(p, 'date_plan'); gain = 8; how = 'Plans made'; break;
      case 'order': L.apply({ hunger: 0.4, thirst: 0.25, mood: 0.05 }); line = this.voice(p, 'good'); gain = 6; how = 'You eat together'; break;
      case 'gift': L.take(q.gift); line = this.voice(p, 'compliment', 0); gain = 14; how = 'They love it'; break;
      case 'hand': line = good ? this.voice(p, 'date_hand') : this.voice(p, 'meh'); gain = good ? 10 : -4; how = good ? 'They hold on' : 'Not yet'; break;
      case 'ask': {
        const yes = this.rng.next() < 0.35 + (ct.aff - 70) / 40 + L.charm * 0.3;
        line = this.voice(p, yes ? 'partner_ask_yes' : 'partner_ask_no');
        if (yes) { ct.partner = true; ct.aff = Math.max(ct.aff, 80); L.change('respect', 3); L.change('mood', 0.25); how = 'You’re together'; G.hud.flash(`You and ${ct.name}`, 'Partners. Mood lifts every day, they’ve got your back'); }
        else { ct.aff -= 6; how = 'Not yet. Give it time'; }
        break;
      }
    }
    ct.aff = Math.max(0, Math.min(100, ct.aff + gain)); ct.lastSeen = G.clock || 0;
    if (gain > 0) L.apply({ mood: 0.03 });
    this.say(line, how);
    this.render();
  }
  // ask a contact to meet: they choose a real café or restaurant near you
  askToMeet(ct) {
    const G = this.g, P = G.player;
    const places = G.shops.nearby(P.x, P.z, 1400).filter(s => ['cafe', 'icecream', 'juice', 'bakery'].includes(s.kind) || (ct.aff > 40 && ['biryani', 'thali', 'food'].includes(s.kind)));
    if (!places.length) { G.hud.toast('Nowhere to meet nearby', 'Head somewhere with cafés first', 'warn', 2.6); return false; }
    const place = places[Math.min(places.length - 1, this.rng.int(0, 3))];
    const busy = this.rng.next() < 0.18 && !ct.partner;
    if (busy) { G.hud.sms(ct.name, 'Can’t today, sorry! Tomorrow?', '', ''); return true; }
    this.pending = { ct, place, until: (G.clock || 0) + 3 };
    G.hud.sms(ct.name, `Yes! ${place.name}, in an hour?`, '', 'On your map');
    G.setWaypoint({ x: place.x, z: place.z, name: `Meet ${ct.name}: ${place.name}` });
    return true;
  }
  // walked into the place with a date pending: they're at a table
  onEnter(R, ctx) {
    const d = this.pending, G = this.g;
    if (!d || ctx.name !== d.place.name) return;
    this.pending = null;
    if ((G.clock || 0) > d.until) { d.ct.aff = Math.max(0, d.ct.aff - 10); G.hud.sms(d.ct.name, DL.text_angry[0], '', 'You were too late'); return; }
    const seat = R.seats.find(s => !s.used && !s.salon);
    if (!seat) return;
    seat.used = true;
    const p = G.interiors.addPerson(seat.x, seat.z, seat.yaw, 'sit_talk', d.ct.female);
    if (p) { p.name = d.ct.name; p.interest = 60; p.prof = { likes: d.ct.likes, job: d.ct.job, picky: 0.4, known: true }; p.dateWith = true; d.ct.dateNow = true; }
    G.hud.toast(`${d.ct.name} is here`, 'At a table. Go and say hi (F)', 'good', 3);
  }
  close(bye) {
    const G = this.g, c = this.cur;
    if (!c) return;
    if (c.mode === 'date') { if (bye) this.say(this.voice(c.p, 'date_bye')); c.contact.dateNow = false; c.p.walkedOff = true; }
    this.cur = null; this.el.hidden = true;
    if (G.state === 'shop') G.state = 'play';
  }
  // ---------------------------------------------------------------- every game hour: what relationships do
  update(dt) {
    const G = this.g, L = this.life;
    if ((this.tick = (this.tick || 0) - dt) > 0) return;
    this.tick = 30;
    const now = G.clock || 0;
    for (const ct of this.contacts) {
      const days = (now - (ct.lastSeen || now)) / 24;
      if (ct.partner) {
        L.apply({ mood: 0.01 });
        if (L.s.hunger < 0.12 && !ct.fedT || (ct.fedT && now - ct.fedT > 12 && L.s.hunger < 0.12)) { ct.fedT = now; L.add('tiffin'); G.hud.sms(ct.name, 'You haven’t eaten, have you. I dropped a dabba with your watchman. Eat.', '', 'A parcel meal is in your jhola'); }
        if (G.police.heat > 0 && this.rng.next() < 0.15) G.hud.sms(ct.name, 'There’s a nakabandi near the chowk. Be careful.', '', '');
      }
      if (days > 2.5 && !ct.missed) { ct.missed = true; G.hud.sms(ct.name, DL.text_miss[ct.partner ? 0 : 1], '', 'Ask to meet from Jhola → People'); this.g.audio.voice(`d_${ct.female ? 'f' : 'm'}_text_miss${ct.partner ? 0 : 1}`, 0.7, 0, false, 1); }
      if (days > 5) { ct.aff = Math.max(0, ct.aff - 0.6); if (ct.partner && ct.aff < 25) { ct.partner = false; G.hud.sms(ct.name, 'I think we should stop seeing each other. Take care.', '', 'You broke up'); L.change('mood', -0.3); } }
      if (days < 1) ct.missed = false;
    }
  }
}
