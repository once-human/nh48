// Talk to anyone (F at them; nothing over anyone's head). What you can say depends on where you are: out on the street
// the way, food, where you are, the area, the weather, a lift, a compliment, chai money, a Puneri jab, asking them out;
// in a café or a club a seat, what's good, a chat, chatting them up (that's dating, Dates in game/date.js); in a shop
// what's good, a discount. How they take it is theirs: their own way with strangers (ask.js attitude), your karma and
// charm, the police after you, what they remember of you. Their answers are in Marathi with the English under it.
import { People } from '@orig/people/peds.js';
import { KbNav } from '@orig/ui/kbnav.js';
import { CAST } from '@orig/people/cast.js';
import { who } from './ask.js';

const one = (rng, a) => a[Math.floor(rng.next()*a.length)];
const WHO = { kaka: 'Kaka', ajoba: 'Ajoba', dada: 'Dada', kaku: 'Kaku', aaji: 'Aaji', tai: 'Tai', bhaiya: 'Bhaiya', collegeboy: 'A college guy', collegegirl: 'A college girl', aunty: 'Aunty', kpguy: 'A KP guy', kpgirl: 'A KP girl' };
const OLD = new Set(['kaka', 'ajoba', 'kaku', 'aaji', 'aunty']);
const MOOD = { curt: 'short with you', normal: 'polite', eager: 'chatty', kind: 'warm' };
const WARM = { curt: 0, normal: 1, eager: 2, kind: 3 };

// [Marathi, English] by how they're taking you: cold, fine, warm
const LINES = {
  area: {
    old: [[['काय सांगायचं? सगळं बदललं.', 'What\'s there to say? It\'s all changed.']], [['पूर्वी इथे शांत होतं. आता नुसती गर्दी.', 'It used to be quiet here. Now it\'s just crowds.']], [['आमचं लहानपण इथेच गेलं. वाडे होते, अंगण होतं. आता इमारती.', 'I grew up right here. There were wadas, courtyards. Now it\'s buildings.']]],
    young: [[['ठीक आहे. जाऊ दे.', 'It\'s fine. Leave it.']], [['मस्त आहे, पण पार्किंग कधीच मिळत नाही.', 'It\'s nice, but you\'ll never find parking.']], [['भारी आहे! रात्री उशिरापर्यंत जाग असते, खायला काही ना काही मिळतं.', 'It\'s great! Stays awake late, you always find something to eat.']]],
  },
  weather: {
    rain: [['हं.', 'Hm.'], ['पाऊस थांबतच नाही.', 'The rain just won\'t stop.'], ['पावसात भजी आणि चहा, बस!', 'Rain, bhaji and chai, that\'s all you need!']],
    hot: [['हं, ऊन आहे.', 'Hm, it\'s hot.'], ['ऊन किती आहे! दुपारी बाहेर पडू नका.', 'So hot! Don\'t go out in the afternoon.'], ['या उन्हात कोकम सरबत प्या, बरं वाटेल.', 'Have kokum sarbat in this heat, you\'ll feel better.']],
    night: [['रात्र झाली, घरी जा.', 'It\'s night, go home.'], ['उशीर झाला. जपून जा.', 'It\'s late. Go carefully.'], ['रात्रीचं पुणे वेगळंच असतं, नाही?', 'Pune at night is something else, isn\'t it?']],
    fine: [['हं.', 'Hm.'], ['आज हवा छान आहे.', 'Nice weather today.'], ['अशी हवा असली की फिरायला मजा येते.', 'Weather like this, it\'s fun to just roam.']],
  },
  compliment: [['हं. काय हवंय?', 'Hm. What do you want?'], ['धन्यवाद.', 'Thank you.'], ['अरे वा! धन्यवाद, तुमचाही दिवस छान जावो.', 'Oh wow! Thank you, have a nice day yourself.']],
  money: [['काम करा जरा!', 'Go do some work!'], ['सुट्टे नाहीत.', 'No change on me.'], ['घ्या, चहा प्या.', 'Here, have a chai.']],
  jab: [['काय म्हणालात? परत बोलून दाखवा!', 'What did you say? Say that again!'], ['तोंड सांभाळून बोला.', 'Mind your mouth.'], ['हाहा, पुणेरी आहात खरे!', 'Haha, you really are Puneri!']],
  askout: { no: [['काय? नाही!', 'What? No!'], ['नको, धन्यवाद.', 'No, thank you.'], ['आज नाही. पुन्हा कधीतरी.', 'Not today. Some other time.']], yes: [['बरं... हा माझा नंबर.', 'Okay... here\'s my number.'], ['चालेल! नंबर घ्या.', 'Sure! Take my number.']] },
  seat: [['नाही, कोणीतरी येणार आहे.', 'No, someone\'s coming.'], ['बसा ना.', 'Go ahead, sit.'], ['बसा, बसा! एकटेच?', 'Sit, sit! On your own?']],
  good: [['मेनू बघा.', 'Look at the menu.'], ['इथे चहा चांगला मिळतो.', 'The chai\'s good here.'], ['काहीही घ्या, सगळंच छान आहे! मी तर रोज येतो.', 'Take anything, it\'s all good! I come every day.']],
  chat: [['हं.', 'Hm.'], ['हो, बरं चाललंय. तुमचं?', 'Yes, going well. You?'], ['आज दिवसभर काम होतं, आता जरा निवांत. तुम्ही?', 'Work all day, now a little time off. You?']],
  shop: [['घ्यायचं असेल तर सांगा.', 'Tell me if you\'re buying.'], ['सगळं ताजं आहे.', 'Everything\'s fresh.'], ['हे बघा, आजच आलंय. तुमच्यासाठी खास.', 'Look, this came in today. Just for you.']],
  discount: [['फिक्स रेट. पाटी वाचा.', 'Fixed price. Read the board.'], ['नाही हो, परवडत नाही.', 'No, I can\'t afford to.'], ['बरं, पुढच्या वेळी बघू.', 'Okay, next time we\'ll see.']],
};

class Talk {
  constructor(G) {
    this.g = G; this.cur = null;
    const el = document.createElement('div');
    el.className = 'shop glass talk'; el.hidden = true;
    el.innerHTML = `<div class="sh-head"><div class="sh-k tk-k">Talking</div><div class="sh-t tk-name"></div><div class="tk-meta"><span class="tk-job"></span></div>
      <div class="tk-bubble"><b class="tk-line"></b><span class="tk-tr"></span><span class="tk-how"></span></div></div><div class="sh-list tk-opts"></div><div class="sh-msg"></div>
      <div class="sh-foot"><span></span><span><span class="kbd">1–9</span> or <span class="kbd">↑↓</span> <span class="kbd">Enter</span> · <span class="kbd">F</span> leave</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => { const b = e.target.closest('.sh-item'); if (b && !b.disabled) this.pick(+b.dataset.i); });
    addEventListener('keydown', (e) => {
      if (!this.cur) return;
      if (e.code === 'Escape' || e.code === 'KeyF') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
      const m = /^Digit(\d)$/.exec(e.code); if (m) { e.preventDefault(); e.stopImmediatePropagation(); this.pick(+m[1] - 1); return; }
      this.nav.key(e);
    }, true);
    this.nav = new KbNav(el.querySelector('.tk-opts'), '.sh-item');
  }
  // the street: whoever is right in front of you
  street(P) {
    const G = this.g, ppl = G.people, p = P.onFoot && !G.interiors?.inside && who(ppl, P);
    if (!p || this.cur || (this._t || 0) > performance.now()) return false;
    this._t = performance.now() + 800;
    return this.open(p, null);
  }
  open(p, room) {
    const G = this.g, ppl = G.people, P = G.player, name = this.nameOf(p);
    const sub = (mr, en, t = 4) => G.hud.say(name, mr, en, t);
    const att = ppl.gate ? ppl.gate(p, P, G, sub) : 'normal';
    if (!att) return true;                          // that was all they had for you
    this.cur = { p, room, att, used: {} };
    G.state = 'shop';
    const hi = WARM[att] >= 2 ? one(ppl.rng, [['हां, बोला?', 'Yes, tell me?'], ['नमस्कार! काय हवंय?', 'Namaskar! What do you need?']]) : att === 'curt' ? ['काय?', 'What?'] : ['हां?', 'Yes?'];
    this.say(...hi);
    this.render(); this.el.hidden = false;
    return true;
  }
  nameOf(p) { return p.name || (p.cop ? 'Havaldar' : WHO[p.persona] || (p.female ? 'A woman' : 'A man')); }
  say(mr, en) { this.el.querySelector('.tk-line').textContent = mr ? `“${mr}”` : ''; this.el.querySelector('.tk-tr').textContent = en || ''; }
  ctx() { const c = this.cur, R = c.room && c.room.R; return !R ? 'street' : /club|cafe|food|restaurant|bar/.test(R.tpl || '') ? 'venue' : 'shop'; }
  options() {
    const c = this.cur, G = this.g, p = c.p, D = G.date, o = [], where = this.ctx();
    const dateable = D && !p.cop && (p.name ? D.eligible(p) : (!!p.female !== !!G.player.look.female && !OLD.has(p.persona)));
    if (where === 'street') {
      if (G.waypoint) o.push({ id: 'way', label: `Ask the way to ${G.waypoint.name || 'your waypoint'}` });
      o.push({ id: 'food', label: 'Where can I get something to eat?' }, { id: 'where', label: 'Where am I?' }, { id: 'area', label: 'What\'s this area like?' }, { id: 'weather', label: 'Talk about the weather' });
      if (G.waypoint && !p.cop) o.push({ id: 'lift', label: `Going towards ${G.waypoint.name || 'there'}? Could you drop me?` });
      if (!p.cop) o.push({ id: 'compliment', label: 'Pay them a compliment' }, { id: 'money', label: 'Ask for ₹20 for a chai' }, { id: 'jab', label: 'Make a Puneri jab' });
    } else if (where === 'venue') {
      o.push({ id: 'seat', label: 'Is this seat free?' }, { id: 'good', label: 'What\'s good here?' }, { id: 'chat', label: 'How\'s your day going?' });
    } else o.push({ id: 'shop', label: 'What\'s good here?' }, { id: 'discount', label: 'Any discount?' });
    if (dateable) o.push({ id: 'askout', label: c.room ? 'Chat them up' : 'Ask them out' });
    o.push({ id: 'bye', label: 'Leave it' });
    return o;
  }
  render() {
    const c = this.cur, p = c.p;
    this.el.querySelector('.tk-k').textContent = this.ctx() === 'street' ? 'Stopped someone' : 'Talking';
    this.el.querySelector('.tk-name').textContent = this.nameOf(p);
    this.el.querySelector('.tk-job').textContent = MOOD[c.att] || '';
    this.opts = this.options();
    const list = this.el.querySelector('.tk-opts'); list.innerHTML = '';
    this.opts.forEach((q, i) => {
      const b = document.createElement('button'); b.className = 'sh-item'; b.dataset.i = i; b.disabled = !!c.used[q.id] && q.id !== 'bye';
      b.innerHTML = `<span class="n">${i + 1}</span><span class="nm"><b></b><small></small></span><span class="pr"></span>`;
      b.querySelector('b').textContent = q.label; b.querySelector('small').textContent = c.used[q.id] ? 'Already asked' : '';
      list.appendChild(b);
    });
    this.nav.paint();
  }
  // how warm they are to this, 0 cold to 2 warm: their way, your karma and charm, the hour
  warmth(extra = 0) {
    const c = this.cur, G = this.g, k = G.life?.s?.karma || 0, ch = G.life?.charm ?? 0.5;
    const w = WARM[c.att] - 0.4 + k/60 + (ch - 0.5) + extra + (G.people.rng.next() - 0.5)*0.8;
    return w < 0.6 ? 0 : w < 1.8 ? 1 : 2;
  }
  pick(i) {
    const c = this.cur; if (!c) return;
    const q = this.opts && this.opts[i]; if (!q) return;
    if (q.id === 'bye') { this.close(); return; }
    if (c.used[q.id]) return;
    c.used[q.id] = true;
    const G = this.g, ppl = G.people, p = c.p, P = G.player, rng = ppl.rng, L = G.life;
    let said = false, last = null; const say = (mr, en) => { said = true; last = [mr, en]; this.say(mr, en); };
    p.act = { clip: 'talk', t: 0, dur: 2.4 };
    switch (q.id) {
      case 'way': case 'food': case 'where': case 'lift': ppl.answer(p, P, G, q.id, c.att, say); if (ppl.lift && ppl.lift.p === p) { this.close(); if (last) G.hud.say(this.nameOf(p), last[0], last[1], 5); return; } break;
      case 'area': say(...LINES.area[OLD.has(p.persona) ? 'old' : 'young'][this.warmth()][0]); break;
      case 'weather': { const k = G.weather?.kind || '', h = G.hour ?? 12, W = /rain|storm/.test(k) ? 'rain' : h >= 21 || h < 5 ? 'night' : h > 11 && h < 16 && !/cloud|fog|haze/.test(k) ? 'hot' : 'fine'; say(...LINES.weather[W][this.warmth()]); break; }
      case 'compliment': { const w = this.warmth(0.2); say(...LINES.compliment[w]); if (w === 2) L?.change?.('mood', 0.03); break; }
      case 'money': { const w = this.warmth(-0.8); say(...LINES.money[w]); if (w === 2) { G.stats.money += 20; L?.change?.('respect', -1); } break; }
      case 'jab': {
        const w = this.warmth(-0.5); say(...LINES.jab[w]);
        if (w === 0) { p.angry = 5; p.grudge = 15; L?.change?.('karma', -1); if (G.brawl && rng.next() < 0.35) { this.close(); ppl.startFight?.(p, P); return; } }
        if (w === 2) L?.change?.('respect', 1);
        break;
      }
      case 'askout': {
        const D = G.date;
        if (c.room && p.name) { const room = c.room; this.close(); D.talk(p, room); return; }
        const ok = rng.next() < 0.08 + (L?.charm ?? 0.5)*0.3 + (WARM[c.att] - 1)*0.08 + (G.life?.s?.karma || 0)/300;
        if (!ok) { const w = this.warmth(-0.6); say(...LINES.askout.no[w]); if (w === 0) { this.close(); ppl.flee(p, P.x, P.z, 8); return; } break; }
        say(...one(rng, LINES.askout.yes));
        this.addContact(p);
        break;
      }
      default: say(...(LINES[q.id] || LINES.chat)[this.warmth()]);
    }
    if (!said) this.say('', '');
    this.render();
  }
  // a number on the street: they go into your phone like anyone you met in a café
  addContact(p) {
    const G = this.g, D = G.date, L = G.life; if (!D) return;
    const taken = new Set((D.contacts || []).map(c => c.name)), pool = CAST[p.female ? 'f' : 'm'].filter(c => !taken.has(c.name));
    if (!p.name && pool.length) p.name = pool[Math.floor(G.people.rng.next()*pool.length)].name;
    if (!p.name) return;
    const P = D.profile(p), area = (G.hud?.suburbs || []).reduce((a, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); return d < a.d ? { d, n: q.n } : a; }, { d: 1e9, n: 'the street' }).n;
    const ct = { name: p.name, female: !!p.female, lang: P.lang, vibe: P.vibe, likes: P.likes, job: P.job, area: P.area, met: area, aff: 10, t: G.clock || 0, lastSeen: G.clock || 0, partner: false };
    L.s.contacts = D.contacts.filter(x => x.name !== ct.name).concat([ct]);
    L.change('mood', 0.1); L.save?.();
    this.el.querySelector('.tk-how').textContent = `${p.name} is in your phone. Jhola → People to text them`;
    G.later?.(G.people.rng.next()*100 + 50, () => D.sms(ct, 't_hi', 'Ask to meet from Jhola → People'));
  }
  close() {
    const c = this.cur; if (!c) return;
    this.cur = null; this.el.hidden = true; this.el.querySelector('.tk-how').textContent = '';
    if (c.p.mode === 'watch') c.p.wait = 1.2;
    if (this.g.state === 'shop') this.g.state = 'play';
  }
}

// made once the game is up (ask.js keeps the game on the people as _G)
const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...a) {
  const G = this._G;
  if (G && !G.talkUI) G.talkUI = new Talk(G);
  return upd.call(this, dt, player, ...a);
};
