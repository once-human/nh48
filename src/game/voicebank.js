// The voice bank (tools/voice_bank.py, voiced in tools/puneri_voice_bank.ipynb): the street, the police by role, the
// control-room radio, vendors, paramedics and you. A line is picked by who's speaking, what's happening and what's
// around them (rain, summer heat, late night, festival days), played from where they stand, and subtitled.
import VB from './voice_bank_lines.json';

const NAME = { kaka: 'Kaka', ajoba: 'Ajoba', dada: 'Dada', collegeboy: 'College boy', kaku: 'Kaku', aaji: 'Aaji', tai: 'Tai', collegegirl: 'College girl', bhaiya: 'Bhaiya', aunty: 'Aunty', kpguy: 'KP', kpgirl: 'KP' };
const ROLE_NAME = { traffic: 'Traffic police', beat: 'Beat marshal', patrol: 'Patrol', qrt: 'QRT' };
// the old street scenarios → the bank's moments
export const MOMENT = { dodge: 'nearmiss', honk: 'honked', bump: 'bumped', shoved: 'bumped', fall: 'knocked', hit: 'knocked', crowd: 'crash', greet: 'greet', chat: 'chat', mutter: 'mutter',
  respect: 'respect', nice: 'respect', scared: 'fearyou', odd: 'fearyou', flee: 'flee', fight: 'taunt', kind: 'hurt' };
const pick = (n) => Math.floor(Math.random() * n);

// bank 2 (the street, redone): its subtitles load in the background, a few hundred KB
export const MOMENT2 = { dodge: 'nearmiss', honk: 'honked', bump: 'bumped', shoved: 'bumped', fight: 'taunt', greet: 'greet', chat: 'chat', mutter: 'mutter', respect: 'respect', nice: 'respect', scared: 'fearyou', odd: 'fearyou', crowd: 'crash' };
export class VoiceBank {
  constructor(G) { this.g = G; this.last = {}; fetch('assets/voice_bank2_lines.json').then(r => r.ok ? r.json() : null).then(t => { this.t2 = t; }).catch(() => {}); }
  // bank 2: who they are, the moment; idle chatter becomes the weather or the hour's talk, or a Puneri patya, now and then
  street2(p, scen) {
    const T = this.t2 && this.t2[p.persona]; if (!T) return false;
    let mom = MOMENT2[scen]; if (!mom) return false;
    if (mom === 'chat') { const G = this.g, h = G.hour ?? 12, m = new Date().getMonth(), r = Math.random();
      if (G.weather && G.weather.cur && G.weather.cur.rain > 0.25 && r < 0.6) mom = 'rain'; else if ((h >= 22 || h < 5) && r < 0.5) mom = 'night';
      else if (m >= 2 && m <= 4 && h >= 12 && h < 17 && r < 0.5) mom = 'heat'; else if ((m === 7 || m === 8) && r < 0.4) mom = 'fest'; else if (r < 0.25) mom = 'patya'; }
    const L = T[mom]; if (!L || !L.length) return false;
    let i = pick(L.length); const key = 'v2' + p.persona + mom; if (this.last[key] === i) i = (i + 1) % L.length; this.last[key] = i;
    const id = `vb2_${p.persona}_${mom}_${i}`;
    return this.play(id, p, NAME[p.persona] || 'Passer-by', L[i][0], L[i][1], { pri: mom === 'nearmiss' || mom === 'bumped' || mom === 'taunt' ? 1 : 0 });
  }
  has(id) { const R = this.g.audio && this.g.audio.remote; return !!(R && R.idx && R.idx[id]); }
  // what's around: rain, a summer afternoon, late night, the festival weeks (Ganeshotsav, Diwali)
  ctx() {
    return 'base';       // (the context versions just tacked a phrase on the end: off until the bank is redone)
    // eslint-disable-next-line no-unreachable
    const G = this.g, h = G.hour ?? 12, m = new Date().getMonth();
    if (G.weather && G.weather.cur && G.weather.cur.rain > 0.25) return 'rain';
    if (h >= 22 || h < 5) return 'night';
    if (m >= 2 && m <= 4 && h >= 12 && h < 17) return 'heat';
    if (m === 8 || m === 9) return 'fest';
    return 'base';
  }
  // play a clip from (x, z) (or as yourself / over the radio), with its subtitle
  play(id, src, who, sub, en, o = {}) {
    if (!this.has(id)) return false;
    const A = this.g.audio, pri = o.pri ?? 1;
    const ok = src ? A.at(src.x, src.z, () => A.voice(id, o.vol ?? 1, 0, !!o.radio, pri), 1.6) : A.voice(id, o.vol ?? 1, 0, !!o.radio, pri);
    if (ok && sub && !o.quiet) this.g.hud.say(who, sub, en === sub ? '' : en, o.life ?? 3.6);
    return ok;
  }
  // a street person: persona, moment (bank or old scenario name), where; hard = the angrier take
  street(p, moment, o = {}) {
    const per = p && p.persona; moment = MOMENT[moment] || moment;
    const L = VB.personas[per]; if (!L || !VB.st[moment]) return false;
    const lang = L[0], lines = VB.st[moment][lang]; if (!lines) return false;
    let n = pick(lines.length); const key = per + moment; if (this.last[key] === n) n = (n + 1) % lines.length; this.last[key] = n;
    const takes = VB.sttakes[moment], tk = takes > 1 ? (o.hard ? 1 : 0) : -1;
    let c = VB.stctx[moment] ? (o.ctx || this.ctx()) : 'base';
    const idOf = (cc) => `vb_st_${per}_${moment}_${cc}_${n}` + (tk >= 0 ? `_${tk}` : '');
    if (!this.has(idOf(c))) c = 'base';
    const [s, e] = lines[n], f = c !== 'base' && VB.ctx[c] ? VB.ctx[c][lang] : null;
    return this.play(idOf(c), p, NAME[per] || 'Passer-by', f ? `${s} ${f[0]}` : s, f ? `${e} ${f[1]}` : e, o);
  }
  // the police, by role and moment (wave, docs, fine, pleadno, pleadok, bribehint, bribeok, bribeno, counter, chase, tackle, cuffs, warn)
  police(role, moment, src, o = {}) {
    role = VB.roles[role] ? role : 'traffic';
    const lang = VB.roles[role], lines = VB.po[moment] && VB.po[moment][lang]; if (!lines) return false;
    const n = pick(lines.length), c = this.ctx();
    let id = `vb_po_${role}_${moment}_${c}_${n}`; if (!this.has(id)) id = `vb_po_${role}_${moment}_base_${n}`;
    return this.play(id, src, ROLE_NAME[role], lines[n][0], lines[n][1], { pri: 2, ...o });
  }
  // the control room: a template about the nearest of its places (and a vehicle, when it's about one)
  radio(tpl, x, z, veh) {
    const G = this.g, P = this.placeAt(x, z); if (P < 0) return false;
    const has = (vi) => ['m', 'w'].map(g => `vb_radio_${tpl}_${P}_${vi}_${g}`).find(id => this.has(id));
    const vi = VB.radio[tpl].includes('{v}') ? (veh ?? 2 * pick(5)) : 0, id = has(vi);
    if (!id) return false;
    const t = VB.radio[tpl].replace('{p}', VB.places[P]).replace('{v}', VB.veh[vi]);
    void G; return this.play(id, null, 'Control room', t, t, { radio: true, vol: 0.55, pri: 1, quiet: true });
  }
  placeAt(x, z) {
    if (!this._pl) {
      const G = this.g, A = G.people.areas.list, F = G.W.landmarks || [];
      this._pl = VB.places.map((nm, i) => { const k = nm.toLowerCase(); const a = A.find(q => q.name.toLowerCase().includes(k) || k.includes(q.name.toLowerCase())) || F.find(q => q.name && q.name.toLowerCase().includes(k)); return a ? { i, x: a.x, z: a.z } : null; }).filter(Boolean);
    }
    let best = -1, bd = 1.6e6;
    for (const q of this._pl) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; best = q.i; } }
    return best;
  }
  vendor(kind, src, d) {
    const K = ['tea', 'paan', 'vadapav', 'fruit', 'flowers', 'juice'][kind] || 'tea', lines = VB.vd[K], n = pick(lines.length), id = `vb_vd_${K}_${n}_${pick(2)}`;
    if (!this.has(id)) return false;
    this.g.audio.callAt(id, src.x, src.z, Math.max(0.35, Math.min(1, 1.1 - d / 60)));
    if (d < 13) this.g.hud.say(['Chaha', 'Paanwala', 'Vadapav', 'Phalwala', 'Phoolwali', 'Rasvanti'][kind] || 'Vendor', lines[n][0], lines[n][1], 2.6);
    return true;
  }
  medic(n, src, female) { const L = VB.med[n]; return L && this.play(`vb_med_${female ? 'w' : 'm'}_${n}`, src, 'Paramedic', L[0], L[1], { pri: 1 }); }
  // you: hurt, effort, fall, sorry, traffic, greet, thanks, haggle, flee, caught, cheer, tired
  you(moment, hard) {
    const G = this.g, fem = !!(G.player.look && G.player.look.female), L = VB.you[moment]; if (!L) return false;
    if ((this._youT || 0) > G.t) return false; this._youT = G.t + 1.2;
    return this.play(`vb_you_${fem ? 'saee' : 'sid'}_${moment}_${hard ? 1 : 0}`, null, '', L[0], L[1], { pri: 1, quiet: true, vol: 0.85 });
  }
}
