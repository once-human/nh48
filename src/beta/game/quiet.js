// The small things. When you're just walking and nothing's asked of you the screen lets go after a while, and comes back
// when you stop. People near you are in the middle of their own lives: you catch the half of a phone call, never meant for
// you, and it goes. Nobody's talking to you and nothing comes of it. (Written by hand. No quest in any of it.)
import { HUD } from '@orig/ui/hud.js';
import { Traffic } from '@orig/traffic/traffic.js';
import { MetroTrains } from '@orig/world/metroTrains.js';

// [what they say, what it means, who says it: m, f or either; when: d day, n night, m morning, e evening, or any]
const LINES = [
  ['Ho ho, jevlo mi. Nahi, kharach jevlo.', 'Yes yes, I ate. No, I really did.', 'm'],
  ['Ho ga Aai, jevle mi. Tu jevlis ka?', 'Yes Aai, I ate. Did you?', 'f'],
  ['Tu kuthe aahes? Nahi, mi pan tithech aahe.', 'Where are you? No, I am there too.'],
  ['Pudhchya mahinyat nakki bhetu.', 'We will definitely meet next month.'],
  ['Kahi nahi re, asach phone kela.', 'Nothing, I just called.'],
  ['Mi theek aahe. Tu sang.', 'I am fine. You tell me.'],
  ['Tyala sang, mi ragavlo nahi.', 'Tell him I am not angry.', 'm'],
  ['Tila sang, mi ragavle nahi.', 'Tell her I am not angry.', 'f'],
  ['Ghari gelyavar phone kar.', 'Call when you get home.'],
  ['Itka kay mahag zala re sagla.', 'How did everything get so expensive.'],
  ['Aaj pan late. Rojachach aahe.', 'Late again today. It is every day now.'],
  ['Chal na, ek chaha gheu.', 'Come on, one chai.'],
  ['Ti aata Bangalore la aste.', 'She is in Bangalore now.'],
  ['Aata kay, baghu.', 'Well. We will see.'],
  ['Tya gharat aata dusre lok rahtat.', 'Other people live in that house now.'],
  ['Baba astana asa navhta.', 'It was not like this when Baba was around.'],
  ['Mala kahi problem nahi. Kharach.', 'I have no problem with it. Really.'],
  ['Sunday la bhetuya. Ya nahi, pudhchya.', 'Let us meet Sunday. Not this one, the next.'],
  ['Aai, ikde paus nahi. Tikde?', 'Aai, no rain here. There?'],
  ['Mi nighalo. Bas, pochtoch aahe.', 'I have left. Almost there.', 'm'],
  ['Mi nighale. Bas, pochtech aahe.', 'I have left. Almost there.', 'f'],
  ['Bro, I will call you back. Nahi, kharach.', 'Bro, I will call you back. No, really.'],
  ['Manager la sangitla, pan to aikatach nahi.', 'I told the manager. He just does not listen.'],
  ['EMI kapla aaj.', 'The EMI went out today.'],
  ['Bhaji ghetli ka? Kothimbir visarlas na.', 'Did you get the vegetables? You forgot the coriander, no.', 0, 'e'],
  ['Aaj hawa chhan aahe na.', 'Nice air today, no.', 0, 'e'],
  ['Thamb, ithech basu thoda.', 'Wait, let us sit here a bit.', 0, 'e'],
  ['Aaj walk la nahi yet mi, gudgha dukhtoy.', 'Not coming for the walk today, my knee hurts.', 0, 'm'],
  ['Pohe sample?', 'The poha is finished?', 0, 'm'],
  ['Zop aata. Udya bolu.', 'Go to sleep. We will talk tomorrow.', 0, 'n'],
  ['Kahi nahi, zop yet navhti.', 'Nothing, I just could not sleep.', 0, 'n'],
  ['Shevatchi bus geli vatta.', 'I think the last bus has gone.', 0, 'n'],
];
const part = (h) => h >= 5 && h < 10.5 ? 'm' : h >= 17 && h < 21 ? 'e' : h >= 21 || h < 5 ? 'n' : 'd';
const heard = new Set();
function overhear(G, dt) {
  const Q = G._oh || (G._oh = { t: 18 + Math.random()*20 });
  if ((Q.t -= dt) > 0) return;
  Q.t = 4;
  const P = G.player, F = P && P.onFoot && P.foot;
  if (!F || G.state !== 'play' || (G.police && G.police.heat > 0) || (G.interiors && G.interiors.inside) || G.talkUI?.cur) return;
  let who = null, best = 7;
  for (const p of G.people.list) { if (!p || p.cop || p.pax || p.fallen > 0 || p.mode === 'chase' || p.mode === 'fight' || p.hidden || p.fixed) continue; const d = Math.hypot(p.x - F.x, p.z - F.z); if (d < best) { best = d; who = p; } }
  if (!who) return;
  const fem = who.look ? !!who.look.female : !!who.female, at = part(G.hour ?? 12);
  const L = LINES.filter(l => !heard.has(l[0]) && (!l[2] || (l[2] === 'f') === fem) && (!l[3] || l[3] === at));
  if (!L.length) { heard.clear(); return; }
  const l = L[Math.floor(Math.random()*L.length)]; heard.add(l[0]);
  G.hud.say('', l[0], l[1], 3.6, true);
  Q.t = 35 + Math.random()*70;       // (not all the time: it's something you happen to catch)
}
const upd = HUD.prototype.update;
HUD.prototype.update = function (dt) {
  const r = upd.call(this, dt), G = this.game, P = G && G.player;
  if (!P || !this.root) return r;
  // ---- just walking: after a while the screen fades back; it returns when you stop, or when anything wants you
  const F = P.onFoot && P.foot, moving = F && (F.v || 0) > 0.6, busy = !F || G.state !== 'play' || (G.police && G.police.heat > 0) || G.hud?.map?.open;
  this._walkT = !busy && moving ? (this._walkT || 0) + dt : Math.max(0, (this._walkT || 0) - dt*40);
  const q = this._walkT > 14;
  if (q !== this._q) { this._q = q; this.root.classList.toggle('walking', q); }
  if (dt > 0) overhear(G, dt);
  return r;
};
// ---- the buses and the metro keep their hours: PMPML about half past five till eleven, the Metro six till ten. At night the road's your own
const pick = Traffic.prototype.pickType;
Traffic.prototype.pickType = function (link) {
  const h = window.__nhAskG?.hour ?? 12; let t = pick.call(this, link);
  if (t === 'bus' && (h < 5.5 || h >= 23)) for (let i = 0; i < 6 && t === 'bus'; i++) t = pick.call(this, link);
  return t === 'bus' && (h < 5.5 || h >= 23) ? 'hatch' : t;
};
const mt = MetroTrains.prototype.update;
MetroTrains.prototype.update = function (dt, cam) {
  const h = window.__nhAskG?.hour ?? 12, off = h < 6 || h >= 22;
  if (off !== !!this._off) { this._off = off; if (off) { this._all = this.trains; for (const T of this.trains) for (const m of T.cars || []) m.visible = false; this.trains = []; } else if (this._all) this.trains = this._all; }
  return mt.call(this, dt, cam);
};
