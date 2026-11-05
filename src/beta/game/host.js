// Inside someone else (Vetal): their body, not yours. Their health, hunger, thirst, energy and stamina are what the
// vitals show, and two more rings come up beside them while you're in someone: their mood and how much they've had to
// drink. All of it comes from who they are and the hour (a bhaiya at four in the afternoon has been on his feet since
// seven; a Koregaon Park regular at midnight has had a few) and lives on while you're in them: you get hungry in
// their stomach. Their jhola is theirs: what someone like them carries (a constable's lathi, an aaji's medicines, an
// office-goer's tiffin), always the same for the same person. Yours is all put back when you go home, and nothing of
// theirs is ever saved over yours.
import { Jhola } from '@orig/ui/jhola.js';

const SWAP = ['hunger', 'thirst', 'energy', 'mood', 'drunk', 'inv', 'quick'];
// what each kind of person carries: [item, chance, count]
const BAG = {
  kaka: [['water', 0.6, 1], ['tiffin', 0.5, 1], ['banana', 0.2, 1], ['lottery', 0.25, 1]],
  kaku: [['water', 0.5, 1], ['biscuit', 0.5, 1], ['banana', 0.4, 1], ['gajra', 0.35, 1], ['painkiller', 0.25, 1]],
  ajoba: [['painkiller', 0.7, 2], ['ors', 0.4, 1], ['biscuit', 0.4, 1], ['book', 0.3, 1], ['water', 0.5, 1]],
  aaji: [['painkiller', 0.75, 2], ['ors', 0.4, 1], ['biscuit', 0.6, 1], ['banana', 0.4, 2], ['gajra', 0.3, 1]],
  dada: [['vadapav', 0.4, 1], ['lottery', 0.3, 2], ['beer', 0.3, 1], ['water', 0.3, 1]],
  bhaiya: [['tiffin', 0.7, 1], ['water', 0.8, 1], ['biscuit', 0.4, 1], ['torch', 0.3, 1]],
  collegeboy: [['coldcoffee', 0.4, 1], ['chikki', 0.3, 1], ['book', 0.3, 1], ['energy', 0.3, 1], ['water', 0.5, 1]],
  collegegirl: [['book', 0.5, 1], ['chikki', 0.3, 1], ['spray', 0.25, 1], ['coldcoffee', 0.3, 1], ['water', 0.6, 1]],
  kpguy: [['coldcoffee', 0.5, 1], ['energy', 0.3, 1], ['beer', 0.25, 1], ['water', 0.4, 1]],
  kpgirl: [['spray', 0.35, 1], ['coldcoffee', 0.4, 1], ['gajra', 0.1, 1], ['water', 0.5, 1]],
  tai: [['tiffin', 0.5, 1], ['spray', 0.3, 1], ['painkiller', 0.25, 1], ['water', 0.6, 1]],
  aunty: [['shrewsbury', 0.2, 1], ['barfi', 0.15, 1], ['banana', 0.3, 1], ['gajra', 0.3, 1], ['water', 0.5, 1]],
  cop: [['lathi', 1, 1], ['water', 0.8, 1], ['tiffin', 0.5, 1], ['torch', 0.6, 1]],
};
const MOOD = { kaka: 0.6, kaku: 0.65, ajoba: 0.7, aaji: 0.75, dada: 0.5, bhaiya: 0.6, collegeboy: 0.7, collegegirl: 0.7, kpguy: 0.7, kpgirl: 0.7, tai: 0.6, aunty: 0.68, cop: 0.5 };
const OLD = new Set(['ajoba', 'aaji']);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// the same numbers for the same person, every time
const rnd = (id, k) => { let h = (Math.abs(id | 0) + 1)*2654435761 ^ k*40503; h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^ (h >>> 16)) >>> 0)/4294967296; };

export function hostBody(G) {
  let real = null, cur = null, stam0 = 1, who = null;
  const mem = new Map();                        // id → their state, kept for if you come back to them
  const kindOf = (p) => p.cop || p.police ? 'cop' : p.persona || 'kaka';

  // how someone is right now, from who they are and the hour
  function vitalsFor(p) {
    const k = kindOf(p), id = p.id || 0, h = G.hour ?? 12, j = (n) => (rnd(id, n) - 0.5)*0.16;
    const meals = [8.5, 13.5, 20.5], since = Math.min(...meals.map(m => (h - m + 24) % 24));
    const night = h >= 22 || h < 5, aft = h >= 13 && h < 17;
    let energy = night ? 0.35 : h < 11 ? 0.85 : aft ? 0.6 : 0.65;
    if (OLD.has(k)) energy -= 0.1; if (k === 'bhaiya' && aft) energy -= 0.15; if (/college|kp/.test(k) && night) energy += 0.2;
    let drunk = 0;
    if (/kp/.test(k) && (h >= 21 || h < 3)) drunk = 0.2 + rnd(id, 7)*0.45;
    else if (k === 'dada' && (h >= 20 || h < 3)) drunk = rnd(id, 7) < 0.5 ? rnd(id, 8)*0.45 : 0;
    else if (k === 'kaka' && h >= 21 && rnd(id, 7) < 0.2) drunk = 0.3;
    let mood = (MOOD[k] ?? 0.6) + j(3);
    if (p.angry > 0 || p.grudge > 0) mood = 0.25; else if (p.mode === 'flee') mood = 0.2; else if (p.fallen > 0) mood = 0.3;
    if (G.weather?.cur && /rain|storm/i.test(G.weather.cur)) mood -= 0.08;
    return {
      hunger: clamp01(0.95 - since*0.11 + j(1)), thirst: clamp01(0.8 - (aft ? 0.15 : 0) - rnd(id, 2)*0.25 + j(4)), energy: clamp01(energy + j(5)),
      mood: clamp01(mood), drunk: Math.min(1, drunk),
      stam: OLD.has(k) ? 0.5 + j(6) : k === 'cop' || k === 'dada' ? 0.95 : 0.85 + j(6),
    };
  }
  function bagFor(p) {
    const k = kindOf(p), id = p.id || 0, h = G.hour ?? 12, inv = {};
    (BAG[k] || BAG.kaka).forEach(([it, ch, n], i) => {
      if (it === 'tiffin' && (h < 7 || h > 15)) return;            // the lunch is eaten by the evening
      if (it === 'torch' && h > 6 && h < 18 && k !== 'cop') return;
      if (it === 'beer' && h > 6 && h < 19) return;
      if (rnd(id, 20 + i) < ch) inv[it] = n > 1 ? 1 + Math.floor(rnd(id, 40 + i)*n) : 1;
    });
    return inv;
  }

  // ---------------------------------------------------------------- in and out
  function enter(p, P) {
    const L = G.life; if (!L) return;
    if (!real) { real = {}; for (const k of SWAP) real[k] = L.s[k]; stam0 = P.stam ?? 1; }
    else if (cur) leave(P);                    // a hop: the last one keeps how they were
    const v = mem.get(p.id) || Object.assign(vitalsFor(p), { inv: bagFor(p), quick: [] });
    cur = v; who = p;
    for (const k of SWAP) L.s[k] = k === 'inv' ? v.inv : k === 'quick' ? v.quick : v[k];
    P.stam = v.stam;
    if (G.jhola) { G.jhola._all = null; G.jhola.paintQuick?.(); }
  }
  // you're leaving them: what they're like now goes back with them
  function leave(P) {
    const L = G.life; if (!L || !cur) return;
    for (const k of SWAP) cur[k] = L.s[k];
    cur.stam = P.stam ?? cur.stam;
    if (who) mem.set(who.id, cur);
    cur = null; who = null;
  }
  function home(P) {
    const L = G.life; leave(P);
    if (L && real) { for (const k of SWAP) L.s[k] = real[k]; P.stam = stam0; real = null; L.save(); }
    if (G.jhola) { G.jhola._all = null; G.jhola.paintQuick?.(); }
  }
  // nothing of theirs is saved over yours
  const L0 = G.life;
  if (L0) {
    const save = L0.save.bind(L0);
    L0.save = () => {
      if (!real) return save();
      const s = L0.s, theirs = {}; for (const k of SWAP) { theirs[k] = s[k]; s[k] = real[k]; }
      try { save(); } finally { for (const k of SWAP) s[k] = theirs[k]; }
    };
  }

  // ---------------------------------------------------------------- the two extra rings: mood and drink
  const GL = {
    m: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-3.1 5.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Zm6.2 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8ZM7.4 13.3h9.2a4.6 4.6 0 0 1-9.2 0Z"/>',
    d: '<path fill-rule="evenodd" d="M6 4h10v2.5h1.6A2.4 2.4 0 0 1 20 8.9v4.2a2.4 2.4 0 0 1-2.4 2.4H16v3A1.5 1.5 0 0 1 14.5 20h-7A1.5 1.5 0 0 1 6 18.5Zm10 4.5v5h1.4a.6.6 0 0 0 .6-.6V9.1a.6.6 0 0 0-.6-.6Z"/>',
  };
  const css = document.createElement('style');
  css.textContent = '.vit .v-md { color: #ff7ac8; } .vit .v-dk { color: #e0b07a; } .vit .v-md[hidden], .vit .v-dk[hidden] { display: none !important; }';
  document.head.appendChild(css);
  let rings = null;
  function mount() {
    const Hd = G.hud; if (!Hd || !Hd.vit || !Hd._vitEls) { setTimeout(mount, 500); return; }
    const C = Hd.vitC || 2*Math.PI*15;
    const mk = (c, n) => { const sp = document.createElement('span'); sp.className = 'v-' + c; sp.title = n; sp.hidden = true;
      sp.innerHTML = `<svg viewBox="0 0 36 36"><circle class="tr" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg><svg class="gl" viewBox="0 0 24 24">${GL[c[0]]}</svg>`;
      Hd.vit.appendChild(sp); return { sp, fg: sp.querySelector('.fg'), C }; };
    rings = { md: mk('md', 'Their mood'), dk: mk('dk', 'How much they\'ve had to drink') };
  }
  mount();
  let rt = 0;
  function draw(dt) {
    if (!rings || (rt -= dt) > 0) return; rt = 0.25;
    const on = !!real, s = G.life?.s || {};
    // their mood only in someone else; how much has been drunk for anyone, you too, whenever there's any in you
    for (const [k, v] of [['md', s.mood ?? 0.6], ['dk', Math.min(1, s.drunk || 0)]]) {
      const R = rings[k], show = on || (k === 'dk' && v > 0.02); if (R.sp.hidden === show) R.sp.hidden = !show;
      if (k === 'dk') { const t = on ? 'How much they\'ve had to drink' : 'How much you\'ve had to drink'; if (R.sp.title !== t) R.sp.title = t; }
      if (show) { const o = (R.C*(1 - clamp01(v))).toFixed(1); if (R.fg._o !== o) { R.fg._o = o; R.fg.setAttribute('stroke-dashoffset', o); } }
    }
    if (rings.md.sp.classList.contains('low') !== (on && (s.mood ?? 1) < 0.2)) rings.md.sp.classList.toggle('low');
  }

  // ---------------------------------------------------------------- their jhola
  const J = Jhola.prototype, entries = J.entries, act = J.act, paint = J.paint, upd = J.update;
  J.entries = function () {
    const out = entries.call(this);
    if (!real) return out;
    const nm = who ? (G.talkUI?.nameOf?.(who) || 'Their') : 'Their';
    return out.filter(e => e.cat !== 'wear').map(e => e.k === 'phone' ? { ...e, name: 'Their phone', desc: 'Locked. You don\'t know the code, and their face won\'t open it for you.', use: 'Locked' }
      : e.k === 'keys' ? { ...e, n: 1, name: 'Their keys', desc: `A house key and a scooter key on a ring. ${nm === 'Their' ? 'Not' : nm + '’s, not'} yours.`, use: 'Look' } : e);
  };
  J.act = function (k, quiet) {
    if (real && (k === 'phone' || k === 'keys')) { G.hud?.toast?.(k === 'phone' ? 'Their phone' : 'Their keys', k === 'phone' ? 'Locked' : 'Not yours to use', 'info', 2); return; }
    return act.call(this, k, quiet);
  };
  J.paint = function () {
    const r2 = paint.apply(this, arguments);
    const t = this.el && this.el.querySelector('.iv-ttl b');
    if (t) t.textContent = real && who ? `${G.talkUI?.nameOf?.(who) || 'Their'}’s jhola` : 'Jhola';
    return r2;
  };
  // in the jhola you see yourself from the front: first person's cut-away head is put back while it's open
  J.update = function (dt) {
    const P = G.player;
    if (this.on && P && P.human && P.human._fp) P.human._fp = false;
    return upd.call(this, dt);
  };

  return {
    enter, leave, home, draw, vitalsFor, bagFor,
    get on() { return !!real; }, get who() { return who; },
    mem,
  };
}
