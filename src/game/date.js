// Talking to people (in a club, a café, at a bar). You pick what to say; how it lands depends on
// what you wear and where (style), your mood, your respect, how much you've had to drink, and
// whether you're being a creep about it (asking for a number on the first line doesn't work).
// Go well and they dance with you, then give you their number; a few game hours later they text
// to meet at a real café nearby, and if you turn up, it's a date. Anyone can talk to anyone.
import { RNG } from '../core/util.js';
import { fmt } from './shops.js';

const OPEN = {
  club: [['Shouting over the music', 'Hey! This DJ is actually good, no?'], ['A smile', 'Hi.'], ['Sizing you up', 'You look like you come here often.']],
  cafe: [['Looking up from a book', 'Oh, hi.'], ['Polite', 'Is this seat taken? No, sorry, go ahead.']],
};
const CHOICES = [
  { id: 'compliment', label: 'Compliment their outfit', base: 18, needStyle: true },
  { id: 'pune', label: 'Start the misal debate (Katakirr vs Bedekar)', base: 14 },
  { id: 'dance', label: 'Ask them to dance', base: 10, club: true, min: 20 },
  { id: 'drink', label: 'Offer to buy them a drink', base: 16, cost: 500 },
  { id: 'joke', label: 'Tell the one about Pune’s afternoon shop closing', base: 12 },
  { id: 'number', label: 'Ask for their number', base: 0, min: 55 },
  { id: 'leave', label: 'Say bye', base: 0 },
];
const REPLY = {
  good: { compliment: 'Haha, thank you! You’re not bad yourself.', pune: 'Okay, finally someone with opinions. Bedekar, obviously.', dance: 'Okay, one song. Let’s go.', drink: 'Sure, I’ll have whatever you’re having.', joke: '1 to 4 PM, the city sleeps. So true.' },
  meh: { compliment: 'Oh. Thanks, I guess.', pune: 'I don’t really eat misal…', dance: 'Maybe later.', drink: 'I’m good, thanks.', joke: 'Heh.' },
  bad: { compliment: 'Okay, that’s a bit much.', pune: 'Can we not talk about food?', dance: 'No, thanks.', drink: 'No. Really, no.', joke: '…' },
};

export class Dates {
  constructor(G) {
    this.g = G; this.rng = new RNG(3434); this.cur = null;
    const el = document.createElement('div');
    el.className = 'shop glass talk'; el.hidden = true;
    el.innerHTML = `<div class="sh-head"><div class="sh-k">Talking</div><div class="sh-t tk-name"></div><div class="tk-hearts"></div>
      <div class="sh-say"><b class="tk-line"></b><span class="tk-how"></span></div></div><div class="sh-list tk-opts"></div><div class="sh-msg"></div>
      <div class="sh-foot"><span></span><span><span class="kbd">1–7</span> choose · <span class="kbd">Esc</span> leave</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => { const b = e.target.closest('.sh-item'); if (b && !b.disabled) this.pick(+b.dataset.i); });
    window.addEventListener('keydown', (e) => {
      if (!this.cur) return;
      if (e.code === 'Escape' || e.code === 'KeyF') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
      const m = /^Digit(\d)$/.exec(e.code); if (m) this.pick(+m[1] - 1);
    }, true);
  }
  get life() { return this.g.life; }
  talk(p, room) {
    const G = this.g;
    if (p.walkedOff) { G.hud.toast(`${p.name} isn’t interested`, 'Let it go', 'info', 2); return; }
    const club = room.R.tpl === 'club';
    this.cur = { p, club, interest: p.interest ?? 10, used: {}, room };
    p.anim = club ? 'dance' : 'talk';
    G.state = 'shop';
    this.el.querySelector('.tk-name').textContent = p.name;
    const o = this.rng.pick(OPEN[club ? 'club' : 'cafe']);
    this.say(o[1], o[0]);
    this.render();
    this.el.hidden = false;
  }
  say(line, how) { this.el.querySelector('.tk-line').textContent = `“${line}”`; this.el.querySelector('.tk-how').textContent = how || ''; }
  render() {
    const c = this.cur, L = this.life;
    const h = Math.max(0, Math.min(5, Math.round(c.interest / 20)));
    this.el.querySelector('.tk-hearts').textContent = '♥'.repeat(h) + '♡'.repeat(5 - h);
    const list = this.el.querySelector('.tk-opts');
    this.opts = CHOICES.filter(q => (!q.club || c.club));
    list.innerHTML = '';
    this.opts.forEach((q, i) => {
      const b = document.createElement('button'); b.className = 'sh-item'; b.dataset.i = i;
      const locked = q.min && c.interest < q.min;
      b.disabled = !!locked || (q.cost && this.g.stats.money < q.cost);
      b.innerHTML = `<span class="n">${i + 1}</span><span class="nm"><b></b><small></small></span><span class="pr"></span>`;
      b.querySelector('b').textContent = q.label;
      b.querySelector('small').textContent = locked ? 'Not yet. Get to know them first' : c.used[q.id] ? 'You already tried that' : '';
      b.querySelector('.pr').textContent = q.cost ? fmt(q.cost) : '';
      list.appendChild(b);
    });
    void L;
  }
  pick(i) {
    const G = this.g, c = this.cur, q = this.opts && this.opts[i];
    if (!c || !q) return;
    if (q.id === 'leave') return this.close();
    if (q.min && c.interest < q.min) return;
    const L = this.life.s, st = this.life.style();
    if (q.id === 'number') return this.askNumber();
    if (q.cost) { if (!G.shops.spend(q.cost)) return; L.drunk = Math.min(1.2, L.drunk + 0.15); }
    // how it lands
    let chance = 0.2 + this.life.charm * 0.6 + (L.karma > 20 ? 0.05 : 0) - (c.used[q.id] ? 0.3 : 0);
    if (q.id === 'compliment' && st.odd) chance += 0.05;           // a bold outfit is a conversation starter
    if (q.cost) chance += 0.15;
    const r = this.rng.next();
    const tone = r < chance ? 'good' : r < chance + 0.25 ? 'meh' : 'bad';
    c.used[q.id] = true;
    c.interest += tone === 'good' ? q.base + 6 : tone === 'meh' ? 2 : -18;
    this.say(REPLY[tone][q.id] || '…', tone === 'good' ? 'They’re smiling' : tone === 'meh' ? 'Polite, not much more' : 'That didn’t land');
    if (tone === 'good' && q.id === 'dance') { c.p.facePlayer = true; G.interiors.dance(true); G.life.apply({ mood: 0.08 }); }
    if (tone === 'good') G.life.apply({ mood: 0.03 });
    if (c.interest < 0) { c.p.walkedOff = true; this.say('Okay, I’m going to find my friends.', 'They walk off'); setTimeout(() => this.close(), 1600); }
    c.p.interest = c.interest;
    this.render();
  }
  askNumber() {
    const G = this.g, c = this.cur, L = this.life;
    const ok = this.rng.next() < 0.35 + c.interest / 150;
    if (!ok) { c.interest -= 12; this.say('Haha, maybe next time.', 'Not tonight'); c.p.interest = c.interest; this.render(); return; }
    const contact = { name: c.p.name, female: c.p.female, persona: c.p.persona, met: c.room.ctx.name, t: G.clock, trust: 1 };
    L.s.contacts = (L.s.contacts || []).filter(x => x.name !== contact.name).concat([contact]);
    L.change('mood', 0.12); L.change('respect', 1); L.save();
    this.say('Okay, here. Text me, don’t be weird about it.', `${c.p.name} put their number in your phone`);
    c.p.walkedOff = true;
    // they'll text about meeting up
    G.later(this.rng.range(60, 200), () => this.invite(contact));
    setTimeout(() => this.close(), 1800);
  }
  invite(contact) {
    const G = this.g, P = G.player;
    const cafes = G.shops.nearby(P.x, P.z, 1500).filter(s => s.kind === 'cafe');
    const place = cafes[Math.min(cafes.length - 1, this.rng.int(0, 3))];
    if (!place) return;
    const at = Math.ceil(G.hour + 2) % 24;
    this.pending = { contact, place, hour: at, until: (G.clock || 0) + 6 };
    G.hud.sms(contact.name, `Hey, it’s ${contact.name} from ${contact.met}! Coffee at ${place.name} around ${at % 12 || 12} ${at < 12 ? 'AM' : 'PM'}?`, '', 'It’s on your map (yellow pin)');
    G.setWaypoint({ x: place.x, z: place.z, name: `Date: ${place.name}` });
  }
  // walked into the café with a date pending: they're at a table
  onEnter(R, ctx) {
    const d = this.pending, G = this.g;
    if (!d || ctx.name !== d.place.name) return;
    if ((G.clock || 0) > d.until) { this.pending = null; G.hud.sms(d.contact.name, 'You didn’t show. Cool.', '', ''); return; }
    const seat = R.seats.find(s => !s.used && !s.salon);
    if (!seat) return;
    seat.used = true;
    const p = R.peds[R.peds.length - 1];
    if (p) { p.x = seat.x; p.z = seat.z; p.yaw = seat.yaw; p.anim = 'sit_talk'; p.name = d.contact.name; p.interest = 60; p.dateWith = true; }
    G.hud.toast(`${d.contact.name} is here`, 'At a table. Go and say hi (F)', 'good', 3);
    this.pending = null;
    d.contact.trust++; this.life.change('mood', 0.1); this.life.save();
  }
  close() {
    const G = this.g;
    if (!this.cur) return;
    this.cur = null; this.el.hidden = true;
    if (G.state === 'shop') G.state = 'play';
  }
}
