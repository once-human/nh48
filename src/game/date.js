// Talking to people, and where it can lead.
//
// Who: in a club, café or restaurant, people of the other gender from your character who are up for
// a chat have a small heart over them. Everyone has a language (Marathi, Hindi or English, from who
// they are and where they're from), a vibe (shy, witty, chill, serious, flirty), a job, the part of
// Pune they live in, and two things they love. They speak out loud, in their language.
//
// How it goes, in stages (the hearts show their interest):
//   knowing    who they are: ask what they do, where they live, talk about this place. They ask
//              you things back, and how you answer matters (honest, funny, or a lie that may not land)
//   better     what they're into (talk about it and they light up), share something real about you
//   spark      teasing (the witty love it, the shy get flustered, the serious roll their eyes),
//              compliments (too early reads as a line), a drink, a dance, and their number
// Your charm (outfit for the area, mood, teeth and skin, a drink or two but not five) moves every
// roll, and repeating yourself works less each time. Push too hard and they walk off.
//
// Then: ask to meet from Jhola → People. They pick a real café near you and wait at a table; be
// late and they say so (very late, they leave). Dates go deeper: their day, something real about
// you, their dreams, teasing, plans, ordering for both, a gift, holding hands. Affection builds
// Met → Talking → Dating; ask them to be your partner (they can say not yet). A partner lifts your
// mood every day and your confidence (charm), texts you good mornings and tips, warns you about
// nakabandis, sends food when you're starving, and one day might say it first. Disappear for days
// and they get upset (you'll have to make up); get someone else's number and it may reach them.
import { hearts } from '../ui/icons.js';
import { RNG } from '../core/util.js';
import { castAs, castByName } from '../people/cast.js';
import { fmt } from './shops.js';
import EN from './date/en.json';
import HI from './date/hi.json';
import MR from './date/mr.json';
import TX from './date/texts.json';
import { KbNav } from '../ui/kbnav.js';

const L10N = { en: EN, hi: HI, mr: MR };
export const LANG_LABEL = { en: 'English', hi: 'Hindi', mr: 'Marathi' };
const TOPICS = ['music', 'food', 'travel', 'cricket', 'movies', 'fitness', 'books', 'bikes', 'gaming', 'art'];
const TOPIC_LABEL = { music: 'Talk about music', food: 'Talk about Pune food', travel: 'Talk about travelling', cricket: 'Talk cricket', movies: 'Talk about films',
  fitness: 'Talk about working out', books: 'Talk about books', bikes: 'Talk about bikes and rides', gaming: 'Talk about games', art: 'Talk about art' };
export const JOBS = ['UX designer', 'software engineer', 'medical student', 'CA articleship', 'architect', 'dance teacher', 'home baker', 'MBA student'];
export const AREAS = ['Kothrud', 'Baner', 'Camp', 'Sadashiv Peth', 'Viman Nagar', 'Aundh'];
const VIBES = ['shy', 'witty', 'chill', 'serious', 'flirty'];
const PERSONA_LANG = { kaka: 'mr', ajoba: 'mr', dada: 'mr', kaku: 'mr', aaji: 'mr', tai: 'mr', bhaiya: 'hi', collegeboy: 'hi', aunty: 'hi', collegegirl: 'hi', kpguy: 'en', kpgirl: 'en' };
const OLDER = new Set(['kaka', 'ajoba', 'kaku', 'aaji', 'aunty']);
const TEASES = ['Tease them about their dancing', 'Bet they put ketchup on misal', 'Guess they’re a Kothrud person', 'Tell them they look like trouble', 'Say their drink order is suspicious', 'Ask if they always look this serious'];
const LEVELS = [[0, 'Met'], [15, 'Talking'], [40, 'Dating'], [101, 'Partner']];
export const levelOf = (c) => c.partner ? 'Partner' : LEVELS.filter(l => c.aff >= l[0]).pop()[1];
// {for a woman speaking|for a man speaking}
const g = (s, f) => String(s).replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (m, a, b) => (f ? a : b));

export class Dates {
  constructor(G) {
    this.g = G; this.rng = new RNG(3434); this.cur = null;
    const el = document.createElement('div');
    el.className = 'shop glass talk'; el.hidden = true;
    el.innerHTML = `<div class="sh-head"><div class="sh-k tk-k">Talking</div><div class="sh-t tk-name"></div><div class="tk-meta"><span class="tk-hearts"></span><span class="tk-job"></span></div>
      <div class="tk-bubble"><b class="tk-line"></b><span class="tk-tr"></span><span class="tk-how"></span></div></div><div class="sh-list tk-opts"></div><div class="sh-msg"></div>
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
  // who you'd talk to: young-ish people of the other gender from your character
  eligible(p) { return !!p && !p.walkedOff && !!p.female !== !!this.g.player.look.female && !OLDER.has(p.persona); }
  profile(p) {
    if (p.prof) return p.prof;
    // one of the cast: the same person every time (their language, vibe, likes, job, area, how picky)
    const cm = p.cast && castByName(p.cast, p.female);
    if (cm) {
      const a = cm.likes[0], b = cm.likes[1] === a ? (a + 3) % TOPICS.length : cm.likes[1];
      return (p.prof = { lang: cm.lang, vibe: VIBES[cm.vibe], likes: [TOPICS[a], TOPICS[b]], job: Math.floor(cm.job * JOBS.length), area: Math.floor(cm.area * AREAS.length), picky: cm.picky, known: {}, asked: {} });
    }
    const r = this.rng, likes = [r.pick(TOPICS)]; let b = r.pick(TOPICS); if (b === likes[0]) b = TOPICS[(TOPICS.indexOf(b) + 3) % TOPICS.length]; likes.push(b);
    let lang = PERSONA_LANG[p.persona] || r.pick(['en', 'hi', 'mr']);
    if (r.next() < 0.25) lang = r.pick(['en', 'hi', 'mr']);
    return (p.prof = { lang, vibe: r.pick(VIBES), likes, job: r.int(0, JOBS.length - 1), area: r.int(0, AREAS.length - 1), picky: r.range(0.25, 0.75), known: {}, asked: {} });
  }
  // one line from them: text in their language (romanised), the English, and the voice
  line(p, key, i, lang) {
    const P = p.prof || this.profile(p), L = lang || P.lang, arr = L10N[L][key] || EN[key];
    if (!arr || !arr.length) return { t: '', en: '' };
    if (i === undefined) { i = this.rng.int(0, arr.length - 1); const k = p.name + key; if (arr.length > 1 && this.last === k + i) i = (i + 1) % arr.length; this.last = k + i; }
    i = Math.min(i, arr.length - 1);
    const row = arr[i], f = !!p.female;
    this.g.audio.voice(`d_${f ? 'f' : 'm'}_${L}_${key}${i}`, 1, 0, false, 2);
    return Array.isArray(row) ? { t: g(row[1], f), en: g(row[2], f) } : { t: g(row, f), en: '' };
  }
  text(ct, key, vars = {}) {
    const T = TX[ct.lang || 'en'] || TX.en, arr = T[key] || TX.en[key];
    const row = arr[this.rng.int(0, arr.length - 1)], f = ct.female;
    const fill = (s) => g(s, f).replace(/\{name\}/g, ct.name).replace(/\{place\}/g, vars.place || ct.met || '');
    return Array.isArray(row) ? { t: fill(row[0]), en: fill(row[1]) } : { t: fill(row), en: '' };
  }
  sms(ct, key, hint = '', vars) {
    const m = this.text(ct, key, vars);
    this.g.hud.sms(ct.name, m.t, '', [m.en, hint].filter(Boolean).join(' · '));
  }
  // a phone call: they pick up (or don't), say something in their own voice, and it warms things a little
  call(ct) {
    const G = this.g, L = this.life;
    if (ct.done) { G.hud.toast(`${ct.name} has blocked you`, 'The call doesn’t go through', 'bad', 2.4); return; }
    const day = Math.floor((G.clock || 0) / 24), h = G.hour;
    const busy = (h > 1 && h < 7.5) || this.rng.next() < (ct.upset ? 0.55 : ct.partner ? 0.1 : 0.25);
    G.hud.sms(ct.name, 'Calling…', '', 'Keypad or not, it rings');
    G.later(2.2, () => {
      if (busy) { G.hud.sms(ct.name, h > 1 && h < 7.5 ? 'No answer. They’re asleep.' : 'No answer.', '', 'Try later, or text to meet'); return; }
      const cm = castByName(ct.name, ct.female);
      const p = { name: ct.name, female: ct.female, cast: cm ? cm.name : undefined, prof: { lang: ct.lang || 'en', vibe: ct.vibe || 'chill', likes: ct.likes || [], job: ct.job ?? 0, area: ct.area ?? 0, picky: 0.4, known: {}, asked: {} } };
      const key = ct.upset ? 'upset' : ct.partner ? 'partner_miss' : ct.aff > 40 ? 'date_day' : 'date_hi';
      const m = this.line(p, key);
      G.hud.sms(ct.name, m.t, '', [m.en, 'On a call'].filter(Boolean).join(' · '));
      if (ct.calledDay !== day) { ct.calledDay = day; ct.aff = Math.min(100, ct.aff + (ct.upset ? 1 : 3)); ct.missed = false; L.change('mood', 0.05); L.save(); }
    });
  }
  stage(c) { const v = c.mode === 'date' ? c.contact.aff : c.interest; return c.mode === 'date' ? (c.contact.partner ? 'partner' : 'date') : v < 25 ? 'knowing' : v < 55 ? 'better' : 'spark'; }

  // ---------------------------------------------------------------- a conversation
  talk(p, room) {
    const G = this.g, L = this.life;
    if (p.walkedOff) { G.hud.toast(`${p.name} isn’t interested`, 'Let it go', 'info', 2); return; }
    const P = this.profile(p);
    const contact = this.contacts.find(c => c.name === p.name && c.dateNow);
    // someone you're seeing is in the same room and sees you chatting up somebody else
    if (!contact) for (const q of room.R.peds || []) {
      if (q === p || !q.cast) continue;
      const ct = this.contacts.find(c => c.name === q.cast && c.aff >= 30);
      if (ct && Math.hypot(q.x - p.x, q.z - p.z) < 14) { this.caught(ct, 'saw'); q.walkedOff = true; break; }
    }
    const mode = contact ? 'date' : 'meet';
    const tpl = room.R.tpl;
    this.cur = { p, room, mode, contact, club: tpl === 'club', interest: p.interest ?? 0, used: {}, turn: 0, q: null, teases: 0 };
    G.state = 'shop';
    let first;
    if (mode === 'date') {
      const ct = contact;
      if (ct.late) { first = this.line(p, 'date_late'); ct.aff = Math.max(0, ct.aff - 8); ct.late = false; }
      else if (ct.upset) first = this.line(p, 'upset');
      else first = this.line(p, ct.partner ? 'partner_hi' : 'date_hi');
    } else if (p.interest === undefined) {
      // first impressions: how you look here, how you seem, how picky they are
      const guarded = this.rng.next() < 0.15 + P.picky * 0.4 - L.charm * 0.35 + (L.s.drunk > 0.6 ? 0.3 : 0);
      this.cur.interest = guarded ? 0 : Math.round(6 + L.charm * 12 - P.picky * 6);
      first = this.line(p, guarded ? 'open_guarded' : tpl === 'club' ? 'open_club' : tpl === 'cafe' ? 'open_cafe' : 'open_food');
    } else first = this.line(p, 'meh');
    this.say(first, mode === 'date' ? (contact.upset ? 'They’re upset with you' : 'They’re happy to see you') : '');
    this.render();
    this.el.hidden = false;
  }
  say(l, how) {
    const B = this.el;
    B.querySelector('.tk-line').textContent = l && l.t ? `“${l.t}”` : '';
    B.querySelector('.tk-tr').textContent = l && l.en && l.en !== l.t ? l.en : '';
    B.querySelector('.tk-how').textContent = how || '';
  }
  // what you can say now, from what you know and how far it's gone
  options() {
    const c = this.cur, P = this.profile(c.p), L = this.life, G = this.g, o = [];
    if (c.q) return this.answers(c.q);
    if (c.mode === 'date') {
      const ct = c.contact;
      if (ct.upset) return [
        { id: 'sorry', label: 'Apologise properly. No excuses', base: 0 },
        { id: 'explain', label: 'Explain what happened', base: 0 },
        { id: 'brush', label: 'Brush it off', base: 0 },
      ];
      o.push({ id: 'day', label: 'Ask about their day', base: 6 });
      if (ct.partner) o.push({ id: 'miss', label: 'Tell them you missed them', base: 8 });
      o.push({ id: 'share', label: 'Tell them something real about yourself', base: 8, min: 15 });
      o.push({ id: 'deep', label: 'Ask what they really want from life', base: 10, min: 30 });
      o.push({ id: 'dtease', label: 'Tease them a little', base: 6 });
      o.push({ id: 'plan', label: ct.partner ? 'Plan something for the weekend' : 'Make plans for next time', base: 8, min: 20 });
      if (!c.used.order) o.push({ id: 'order', label: 'Order for both of you', base: 6, cost: 450 });
      const gift = ['gajra', 'shrewsbury', 'barfi', 'bakarwadi', 'book', 'roses'].find(id => L.has(id));
      if (gift && !c.used.gift) o.push({ id: 'gift', label: `Give them the ${gift === 'gajra' ? 'gajra' : gift === 'book' ? 'book' : gift === 'roses' ? 'roses' : 'sweets'}`, base: 14, gift });
      if (!c.used.hand) o.push({ id: 'hand', label: 'Hold their hand', base: 8, min: 35 });
      if (ct.partner && !c.used.future) o.push({ id: 'future', label: 'Talk about the future', base: 8, min: 80 });
      if (ct.partner && !ct.saidLove) o.push({ id: 'love', label: 'Say “I love you”', base: 0, min: 88 });
      if (!ct.partner) o.push({ id: 'ask', label: 'Ask them to be your partner', base: 0, min: 70 });
      o.push({ id: 'bye', label: 'Call it a night', base: 0 });
      return o.slice(0, 8);
    }
    const st = this.stage(c);
    if (!P.known.job) o.push({ id: 'job', label: 'Ask what they do', base: 6 });
    if (!P.known.area) o.push({ id: 'area', label: 'Ask where they live', base: 5 });
    if (!c.used.place) o.push({ id: 'place', label: c.club ? 'Talk about the music here' : 'Talk about this place', base: 5 });
    // things to talk about: theirs first once you know them
    const pool = TOPICS.filter(t => !c.used['t_' + t]);
    const pickT = P.known.likes ? P.likes.filter(t => pool.includes(t)).slice(0, 1) : [];
    while (pickT.length < (st === 'knowing' ? 1 : 2) && pool.length) { const t = pool.splice(this.rng.int(0, pool.length - 1), 1)[0]; if (!pickT.includes(t)) pickT.push(t); }
    for (const t of pickT) o.push({ id: 't_' + t, topic: t, label: TOPIC_LABEL[t] + (P.known.likes && P.likes.includes(t) ? ' (they love this)' : ''), base: 6 });
    if (st !== 'knowing') o.push({ id: 'share', label: 'Share something real about yourself', base: 8 });
    o.push({ id: 'tease', label: c.teaseLabel || (c.teaseLabel = this.rng.pick(TEASES)), base: 8 });
    o.push({ id: 'compliment', label: 'Compliment them', base: 8 });
    if (c.club && !c.used.drink) o.push({ id: 'drink', label: 'Buy them a drink', base: 10, cost: 600 });
    if (c.club && !c.danced) o.push({ id: 'dance', label: 'Ask them to dance', base: 10, min: 28 });
    o.push({ id: 'number', label: 'Ask for their number', base: 0, min: 50 }, { id: 'bye', label: 'Say bye', base: 0 });
    return o.slice(0, 8);
  }
  // they asked you something: what you could say back
  answers(q) {
    const G = this.g, L = this.life;
    if (q === 'ask_job') {
      const a = [];
      if (G.stats.rides > 0) a.push({ id: 'a_honest', label: '“I drive an auto. Meter, passengers, the works.”' });
      if (L.s.tally && L.s.tally.deliveries > 0) a.push({ id: 'a_honest', label: '“I deliver food for Zwiggy.”' });
      if ((L.s.props || []).length) a.push({ id: 'a_honest', label: '“I own a bit of property.”' });
      a.push({ id: 'a_honest', label: '“Still figuring it out, honestly.”' });
      a.push({ id: 'a_lie', label: '“Startup founder. Stealth mode.”' });
      a.push({ id: 'a_funny', label: '“Guess.”' });
      return a.slice(0, 4);
    }
    if (q === 'ask_area') {
      const P = this.cur.p.prof, mine = AREAS[P.area], other = AREAS[(P.area + 2 + this.rng.int(0, 3)) % AREAS.length];
      return [{ id: 'a_area', area: mine, label: `“${mine}.”` }, { id: 'a_area', area: other, label: `“${other}.”` }, { id: 'a_funny', label: '“Wherever my auto takes me.”' }, { id: 'a_honest', label: '“Close by. Walking distance.”' }];
    }
    return [
      { id: 'a_fun', topic: 'bikes', label: '“Long rides on the expressway.”' }, { id: 'a_fun', topic: 'food', label: '“Eating my way through Camp.”' },
      { id: 'a_fun', topic: 'cricket', label: '“Cricket on Sundays.”' }, { id: 'a_fun', topic: 'kind', label: '“Feeding the strays near my building.”' },
      { id: 'a_funny', label: '“Honestly? Sleeping.”' },
    ].sort(() => this.rng.next() - 0.5).slice(0, 4);
  }
  render() {
    const c = this.cur, L = this.life, P = this.profile(c.p);
    const v = c.mode === 'date' ? c.contact.aff : c.interest;
    const h = Math.max(0, Math.min(5, Math.round(v / 20)));
    const st = this.stage(c);
    this.el.querySelector('.tk-k').textContent = c.q ? 'They ask you' : (st === 'date' ? `On a date · ${levelOf(c.contact)}` : { knowing: 'Getting to know them', better: 'Getting along', spark: 'Sparks', partner: 'Your partner' }[st]);
    this.el.querySelector('.tk-name').textContent = c.p.name;
    this.el.querySelector('.tk-hearts').innerHTML = hearts(h);
    const bits = [LANG_LABEL[P.lang]];
    if (P.known.job) bits.push(JOBS[P.job]);
    if (P.known.area) bits.push(AREAS[P.area]);
    if (P.known.likes) bits.push('into ' + P.likes.join(' and '));
    if (P.known.vibe) bits.push(P.vibe);
    this.el.querySelector('.tk-job').textContent = bits.join(' · ');
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
      b.querySelector('small').textContent = locked ? (q.id === 'number' ? 'Get to know them a bit first' : q.id === 'ask' ? 'You’re not there yet' : q.id === 'love' ? 'Not yet' : 'Too soon') : '';
      b.querySelector('.pr').textContent = q.cost ? fmt(q.cost) : '';
      list.appendChild(b);
    });
    this.nav.paint();
  }
  // a roll: base odds from charm and pickiness, then the vibe, then how much you've repeated yourself
  roll(extra = 0) { const L = this.life, P = this.cur.p.prof; return this.rng.next() < 0.2 + L.charm * 0.55 - (P.picky - 0.5) * 0.4 + extra; }
  pick(i) {
    const G = this.g, c = this.cur, q = this.opts && this.opts[i];
    if (!c || !q || (q.min && (c.mode === 'date' ? c.contact.aff : c.interest) < q.min)) return;
    if (c.q) return this.answer(q);
    if (q.id === 'bye') return this.close(true);
    if (q.cost && G.stats.money < q.cost) return;
    if (c.mode === 'date') return this.datePick(q);
    if (q.id === 'number') return this.askNumber();
    const L = this.life, P = this.profile(c.p), p = c.p, v = P.vibe;
    const rep = c.used[q.id] ? 0.3 : 0;
    let line = null, how = '', gain = 0;
    c.turn++;
    switch (q.id) {
      case 'job': P.known.job = true; P.known.likes = true; line = this.line(p, 'job', P.job); gain = 6; how = `They’re into ${P.likes[0]} and ${P.likes[1]}`; break;
      case 'area': P.known.area = true; line = this.line(p, 'area', P.area); gain = 4; how = AREAS[P.area]; break;
      case 'place': line = this.line(p, c.club ? 'place_club' : c.room.R.tpl === 'cafe' ? 'place_cafe' : 'place_food'); gain = 5; how = 'Small talk, but it’s going'; break;
      case 'share': {
        const ok = this.roll((v === 'serious' || v === 'shy' ? 0.3 : 0.05) - rep);
        line = this.line(p, ok ? 'deep' : 'meh'); gain = ok ? 12 : 1; how = ok ? 'They open up too' : 'They didn’t quite know what to do with that';
        if (ok) P.known.vibe = true;
        break;
      }
      case 'tease': {
        c.teases++; c.teaseLabel = null; P.known.vibe = true;
        const early = c.interest < 15 ? -0.2 : 0, bonus = { witty: 0.35, flirty: 0.25, chill: 0.1, shy: -0.15, serious: -0.25 }[v];
        const ok = this.roll(bonus + early - rep - (c.teases > 2 ? 0.2 : 0));
        if (ok) { line = this.line(p, v === 'witty' && this.rng.next() < 0.6 ? 'tease_back' : 'laugh'); gain = v === 'witty' ? 14 : 10; how = v === 'witty' ? 'They give it right back. Sparks' : 'They’re laughing'; }
        else if (v === 'shy') { line = this.line(p, 'flustered'); gain = 3; how = 'Flustered. Go gentler'; }
        else { line = this.line(p, 'unimpressed'); gain = -8; how = 'That didn’t land'; }
        break;
      }
      case 'compliment': {
        const tooSoon = c.turn <= 2 || c.interest < 15;
        const ok = this.roll((v === 'flirty' ? 0.25 : v === 'shy' ? 0.15 : v === 'witty' ? -0.1 : 0) - (tooSoon ? 0.3 : 0) - rep);
        if (ok) { line = this.line(p, v === 'shy' ? 'flustered' : 'compliment_ok'); gain = 9; how = v === 'shy' ? 'They’re blushing' : 'They’re smiling'; }
        else { line = this.line(p, 'compliment_cheesy'); gain = tooSoon ? -4 : 0; how = tooSoon ? 'Too soon. It read as a line' : 'Nice, but they’ve heard it before'; }
        break;
      }
      case 'drink': {
        const ok = this.roll(0.25 - (P.picky > 0.6 ? 0.1 : 0));
        if (ok && G.shops.spend(q.cost)) { line = this.line(p, 'drink_yes'); gain = 10; L.s.drunk = Math.min(1.2, L.s.drunk + 0.1); how = 'Drinks in hand'; }
        else { line = this.line(p, 'drink_no'); gain = 0; how = 'No harm in asking'; }
        break;
      }
      case 'dance': {
        const ok = this.roll((v === 'shy' ? -0.15 : v === 'flirty' ? 0.2 : 0.05) - rep);
        if (ok) { line = this.line(p, 'dance_yes'); gain = 12; c.danced = true; G.interiors.dance(true); L.apply({ mood: 0.08 }); how = 'On the floor together'; }
        else { line = this.line(p, 'dance_no'); gain = -2; how = 'Not yet'; }
        break;
      }
      default:
        if (q.topic) {
          const likes = P.likes.includes(q.topic);
          if (likes) { line = this.line(p, 'likes_' + q.topic); gain = 14 - (rep ? 6 : 0); how = 'Now they’re talking'; P.known.likes = true; }
          else { line = this.line(p, 'topic_meh'); gain = v === 'chill' ? 1 : -2; how = 'Not their thing'; }
        }
    }
    c.used[q.id] = true;
    c.interest = Math.min(100, c.interest + gain);
    if (gain > 6) L.apply({ mood: 0.02 });
    this.say(line, how);
    if (c.interest < 0) return this.walkOff();
    p.interest = c.interest;
    // now and then they ask you something back
    if (!c.q && c.turn >= 2 && this.rng.next() < 0.4) {
      const qs = ['ask_job', 'ask_area', 'ask_fun'].filter(k => !P.asked[k]);
      if (qs.length) { const k = this.rng.pick(qs); P.asked[k] = true; setTimeout(() => { if (this.cur === c && !c.q) { c.q = k; this.say(this.line(p, k), 'Your answer matters'); this.render(); } }, 1700); }
    }
    this.render();
  }
  // your answer to their question
  answer(a) {
    const c = this.cur, p = c.p, P = p.prof, v = P.vibe;
    let line, gain = 0, how = '';
    if (a.id === 'a_honest') { line = this.line(p, v === 'witty' || v === 'flirty' ? 'good' : 'honest'); gain = v === 'serious' || v === 'shy' ? 12 : 6; how = 'Honesty landed'; }
    else if (a.id === 'a_lie') { const caught = this.rng.next() < (v === 'serious' ? 0.65 : 0.35); line = this.line(p, caught ? 'liar' : 'good'); gain = caught ? -10 : 5; how = caught ? 'They don’t buy it' : 'They bought it. For now'; }
    else if (a.id === 'a_funny') { const ok = v === 'witty' || v === 'flirty' || (v === 'chill' && this.rng.next() < 0.5); line = this.line(p, ok ? 'funny' : 'unimpressed'); gain = ok ? 10 : -4; how = ok ? 'They liked that' : 'They wanted a real answer'; }
    else if (a.id === 'a_area') { const same = a.area === AREAS[P.area]; line = this.line(p, same ? 'good' : 'meh'); gain = same ? 12 : 3; how = same ? `Same area! ${a.area}` : ''; }
    else if (a.id === 'a_fun') { const hit = P.likes.includes(a.topic) || (a.topic === 'bikes' && P.likes.includes('travel')) || a.topic === 'kind'; line = this.line(p, hit ? 'good' : 'meh'); gain = hit ? 12 : 2; how = hit ? (a.topic === 'kind' ? 'That melted them a little' : 'Turns out you have that in common') : ''; }
    c.q = null;
    c.interest = Math.min(100, c.interest + gain); p.interest = c.interest;
    this.say(line, how);
    if (c.interest < 0) return this.walkOff();
    this.render();
  }
  walkOff() { const c = this.cur; c.p.walkedOff = true; c.p.interest = c.interest; this.say(this.line(c.p, 'walkoff'), 'They walk off'); setTimeout(() => { if (this.cur === c) this.close(); }, 1800); }
  askNumber() {
    const G = this.g, c = this.cur, L = this.life, p = c.p, P = p.prof;
    const ok = this.rng.next() < 0.22 + c.interest / 130 + (L.charm - 0.5) * 0.3 + (P.vibe === 'flirty' ? 0.1 : P.vibe === 'serious' ? -0.05 : 0) + (c.danced ? 0.08 : 0);
    if (!ok) { c.interest -= 10; p.interest = c.interest; this.say(this.line(p, 'number_no'), 'Not tonight'); this.render(); return; }
    const contact = { name: p.name, female: !!p.female, lang: P.lang, vibe: P.vibe, likes: P.likes, job: P.job, area: P.area, met: c.room.ctx.name, aff: 12, t: G.clock || 0, lastSeen: G.clock || 0, partner: false };
    const had = this.contacts.find(x => x.partner);
    this.life.s.contacts = this.contacts.filter(x => x.name !== contact.name).concat([contact]);
    L.change('mood', 0.12); L.change('respect', 1); L.save();
    this.say(this.line(p, 'number_yes'), `${p.name} is in your phone. Jhola → People to text them`);
    p.walkedOff = true;
    if (had && this.rng.next() < 0.35) G.later(this.rng.range(40, 120), () => this.caught(had, 'heard'));
    else G.later(this.rng.range(50, 160), () => this.sms(contact, 't_hi', 'Ask to meet from Jhola → People'));
    setTimeout(() => { if (this.cur === c) this.close(); }, 2000);
  }
  // ---------------------------------------------------------------- dates
  datePick(q) {
    const G = this.g, c = this.cur, L = this.life, ct = c.contact, p = c.p, v = ct.vibe || 'chill';
    let line = null, how = '', gain = 0;
    const rep = c.used[q.id] ? 0.35 : 0;
    const ok = (x = 0) => this.rng.next() < 0.45 + L.charm * 0.45 + x - rep;
    c.used[q.id] = true;
    switch (q.id) {
      case 'sorry': { const y = ok(0.15); line = this.line(p, y ? 'makeup' : 'stillupset'); if (y) { ct.upset = false; gain = 6; how = 'Forgiven'; } else { gain = -3; how = 'Still hurt. Try again another day'; } break; }
      case 'explain': { const y = ok(-0.05); line = this.line(p, y ? 'makeup' : 'stillupset'); if (y) { ct.upset = false; gain = 3; how = 'They get it'; } else { gain = -5; how = 'Sounded like an excuse'; } break; }
      case 'brush': line = this.line(p, 'stillupset'); gain = -12; how = 'That made it worse'; break;
      case 'day': line = this.line(p, 'date_day'); gain = ok() ? 6 : 2; how = 'You listen'; break;
      case 'miss': line = this.line(p, 'partner_miss'); gain = 6; how = 'They melt a bit'; break;
      case 'share': { const y = ok(v === 'serious' || v === 'shy' ? 0.15 : 0); line = this.line(p, y ? 'date_share' : 'meh'); gain = y ? 9 : 1; how = y ? 'They lean in' : 'Maybe too much, too soon'; break; }
      case 'deep': line = this.line(p, 'date_deep'); gain = 10; how = 'They trust you with that'; break;
      case 'dtease': { const y = ok({ witty: 0.25, flirty: 0.2, chill: 0.05, shy: -0.1, serious: -0.2 }[v]); line = this.line(p, y ? 'date_tease' : 'unimpressed'); gain = y ? 8 : -4; how = y ? 'Playful' : 'Not in the mood for that'; break; }
      case 'plan': line = this.line(p, 'date_plan'); gain = 8; how = 'Plans made'; break;
      case 'order': if (!G.shops.spend(q.cost)) return; L.apply({ hunger: 0.4, thirst: 0.25, mood: 0.05 }); line = this.line(p, 'date_order'); gain = 6; how = 'You eat together'; break;
      case 'gift': L.take(q.gift); line = this.line(p, 'gift'); gain = 14; how = 'They love it'; break;
      case 'hand': { const y = ok(v === 'shy' ? -0.15 : 0.05); line = this.line(p, y ? 'hand_yes' : 'hand_no'); gain = y ? 10 : -4; how = y ? 'They hold on' : 'Not yet'; break; }
      case 'future': line = this.line(p, 'partner_future'); gain = 8; how = 'Big plans'; break;
      case 'love': {
        const y = this.rng.next() < 0.55 + (ct.aff - 88) / 25;
        line = this.line(p, y ? 'love_yes' : 'love_notyet');
        if (y) { ct.saidLove = true; gain = 6; L.change('mood', 0.3); how = 'They said it back'; G.hud.flash(`You and ${ct.name}`, 'They love you too'); }
        else { gain = 0; how = 'They need time. That’s okay'; }
        break;
      }
      case 'ask': {
        const yes = this.rng.next() < 0.35 + (ct.aff - 70) / 40 + L.charm * 0.3;
        line = this.line(p, yes ? 'partner_yes' : 'partner_no');
        if (yes) { ct.partner = true; ct.aff = Math.max(ct.aff, 80); L.change('respect', 3); L.change('mood', 0.25); how = 'You’re together'; G.hud.flash(`You and ${ct.name}`, 'Partners. Mood and confidence up every day, and they’ve got your back'); }
        else { ct.aff -= 6; how = 'Not yet. Give it time'; }
        break;
      }
    }
    ct.aff = Math.max(0, Math.min(100, ct.aff + gain)); ct.lastSeen = G.clock || 0;
    if (gain > 0) L.apply({ mood: 0.03 });
    this.say(line, how);
    this.render();
  }
  // found out you're seeing someone else: hurt, angrier the closer you were, and a second time is the end
  caught(ct, how) {
    const L = this.life;
    ct.caught = (ct.caught || 0) + 1;
    ct.aff = Math.max(0, ct.aff - (ct.partner ? 35 : 22));
    ct.upset = true;
    const over = ct.caught >= 2 || (ct.partner && ct.aff < 45) || ct.aff < 15;
    if (over) {
      const was = ct.partner; ct.partner = false; ct.done = true; ct.aff = Math.min(ct.aff, 5);
      this.sms(ct, 't_breakup', was ? 'They found out. You broke up' : 'They found out. They’ve blocked you');
      L.change('mood', was ? -0.4 : -0.15); L.change('respect', -2);
    } else this.sms(ct, 't_jealous', how === 'saw' ? `${ct.name} saw you with someone else` : 'They found out about the others');
    L.save();
  }
  // every date with one person while you're seeing others is a chance someone finds out (Pune is small)
  twoTiming(withCt) {
    const others = this.contacts.filter(c => c !== withCt && !c.done && (c.partner || c.aff >= 40));
    if (!others.length) return;
    const risk = 0.1 + 0.07 * (others.length - 1) + (withCt.partner ? 0 : 0.05);
    for (const c of others) if (this.rng.next() < risk * (c.partner ? 1.6 : 1)) this.g.later(this.rng.range(30, 200), () => this.caught(c, 'heard'));
  }
  // ask a contact to meet: they choose a real café or restaurant near you
  askToMeet(ct) {
    const G = this.g, P = G.player;
    if (ct.done) { this.g.hud.toast(`${ct.name} has blocked you`, 'That’s over', 'bad', 2.6); return false; }
    if (ct.upset && this.rng.next() < 0.5) { this.sms(ct, 't_angry'); return true; }
    const places = G.shops.nearby(P.x, P.z, 1400).filter(s => ['cafe', 'icecream', 'juice', 'bakery'].includes(s.kind) || (ct.aff > 40 && ['biryani', 'thali', 'food', 'southindian'].includes(s.kind)));
    if (!places.length) { G.hud.toast('Nowhere to meet nearby', 'Head somewhere with cafés first', 'warn', 2.6); return false; }
    const place = places[Math.min(places.length - 1, this.rng.int(0, 3))];
    if (this.rng.next() < 0.18 && !ct.partner) { this.sms(ct, 't_busy'); return true; }
    this.pending = { ct, place, until: (G.clock || 0) + 2, gone: (G.clock || 0) + 3.5 };
    this.sms(ct, 't_yes', 'On your map', { place: place.name });
    G.setWaypoint({ x: place.x, z: place.z, name: `Meet ${ct.name}: ${place.name}` });
    return true;
  }
  // walked into the place with a date pending: they're at a table (late: they say so; very late: gone)
  onEnter(R, ctx) {
    const d = this.pending, G = this.g;
    if (!d || ctx.name !== d.place.name) return;
    this.pending = null;
    const now = G.clock || 0;
    if (now > d.gone) { d.ct.aff = Math.max(0, d.ct.aff - 12); d.ct.upset = true; this.sms(d.ct, 't_angry', 'You were too late. They left'); return; }
    d.ct.late = now > d.until;
    // a table to yourselves: whoever was sitting there gets up and goes
    const tables = new Map();
    for (const s of R.seats) if (!s.salon && !s.wait && s.table) { const k = s.table.x.toFixed(2) + ',' + s.table.z.toFixed(2); if (!tables.has(k)) tables.set(k, []); tables.get(k).push(s); }
    let pick = null, best = 1e9;
    for (const ss of tables.values()) { if (ss.length < 2) continue; const n = ss.filter(s => s.used).length; if (n < best) { best = n; pick = ss; } }
    const seat = pick ? pick[0] : R.seats.find(s => !s.used && !s.salon && !s.wait);
    if (!seat) return;
    if (pick) for (const s of pick) {
      for (const q of (R.peds || []).slice()) if (Math.hypot(q.x - s.x, q.z - s.z) < 0.35) { G.people.remove(q); R.peds.splice(R.peds.indexOf(q), 1); }
      s.used = s !== pick[1];      // the seat across stays free for you
    }
    seat.used = true;
    this.twoTiming(d.ct);
    const p = G.interiors.addPerson(seat.x, seat.z, seat.yaw, 'sit_talk', d.ct.female);
    // your seat: the one kept free at their table, nearest to them
    const mine = pick ? pick.filter(q => q !== seat && !q.used).sort((a, b) => Math.hypot(a.x - seat.x, a.z - seat.z) - Math.hypot(b.x - seat.x, b.z - seat.z))[0] : null;
    if (p && mine) p.dateSeat = mine;
    if (p) { const cm = castByName(d.ct.name, d.ct.female); if (cm) { castAs(p, cm, G.W.kit); G.interiors.markHearts?.(G.interiors.cur.R); } p.name = d.ct.name; p.interest = 60; p.prof = { lang: d.ct.lang || 'en', vibe: d.ct.vibe || 'chill', likes: d.ct.likes, job: d.ct.job ?? 0, area: d.ct.area ?? 0, picky: 0.4, known: { job: true, likes: true, area: true, vibe: true }, asked: { ask_job: 1, ask_area: 1, ask_fun: 1 } }; p.dateWith = true; d.ct.dateNow = true; }
    G.hud.toast(`${d.ct.name} is here`, 'At a table. Go and say hi (F)', 'good', 3);
  }
  close(bye) {
    const G = this.g, c = this.cur;
    if (!c) return;
    if (c.mode === 'date') {
      const ct = c.contact;
      if (bye) this.say(this.line(c.p, 'date_bye'));
      ct.dateNow = false; c.p.walkedOff = true; ct.lastSeen = G.clock || 0; ct.missed = false;
      if (ct.aff > 30 && !ct.upset) G.later(this.rng.range(30, 90), () => this.sms(ct, 't_afterdate'));
    }
    if (G.interiors && G.interiors.cur && G.interiors.cur.dancing) G.interiors.dance(false);
    this.cur = null; this.el.hidden = true;
    if (G.state === 'shop') G.state = 'play';
  }
  // ---------------------------------------------------------------- what relationships do, over time
  update(dt) {
    const G = this.g, L = this.life;
    if ((this.tick = (this.tick || 0) - dt) > 0) return;
    this.tick = 30;
    const now = G.clock || 0, hour = G.hour;
    let partner = null;
    for (const ct of this.contacts) {
      const days = (now - (ct.lastSeen || now)) / 24;
      if (ct.partner) {
        partner = ct;
        L.apply({ mood: 0.01 });
        if (L.s.hunger < 0.12 && (!ct.fedT || now - ct.fedT > 12)) { ct.fedT = now; L.add('tiffin'); this.sms(ct, 't_food', 'A parcel meal is in your jhola'); }
        if (G.police.heat > 0 && (!ct.nakaT || now - ct.nakaT > 6) && this.rng.next() < 0.2) { ct.nakaT = now; this.sms(ct, 't_naka'); }
        if (hour > 7.5 && hour < 9.5 && ct.mornDay !== Math.floor(now / 24) && this.rng.next() < 0.5) { ct.mornDay = Math.floor(now / 24); this.sms(ct, 't_morning'); }
        if ((!ct.tipT || now - ct.tipT > 30) && this.rng.next() < 0.08) { ct.tipT = now; this.sms(ct, 't_tip'); }
        if (days > 4 && !ct.upset) { ct.upset = true; this.sms(ct, 't_angry', 'They’re upset. Meet them and make it right'); }
      }
      if (days > 2.5 && !ct.missed) { ct.missed = true; this.sms(ct, 't_miss', 'Ask to meet from Jhola → People'); }
      if (days > 5) { ct.aff = Math.max(0, ct.aff - 0.6); if (ct.partner && ct.aff < 25) { ct.partner = false; ct.upset = false; this.sms(ct, 't_breakup', 'You broke up'); L.change('mood', -0.3); } }
      if (days < 1) ct.missed = false;
    }
    L.s.partnerConf = partner ? 0.06 : 0;
  }
}
