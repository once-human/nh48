// The menu's other rooms, drawn inside the jhola's panel: Missions (the story chapter by chapter, side jobs and
// things to do, the one you pick in full, its act, what it's worth and where) and Stats (you: name, level,
// how your body is, who you are and how Pune sees you, the law, money, your record, what you own).
import { savedCharacter } from '../people/characters.js';
import { assetVersion, versioned } from '../core/assets.js';
import { g } from './glyphs.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rs = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const km = (m) => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m / 10) * 10 + ' m';
export const ACTS = { 0: ['उपोद्घात', 'Prologue', 'Back in Pune after Blink10 fell apart. A bus at night, the rain, and Bapu Kaka waiting.'],
  1: ['भाग १', 'Homecoming', 'The monsoon. Ten thousand rupees, an auto that isn’t yours, a police notice, and Aai.'],
  2: ['भाग २', 'Bappa', 'Ganeshotsav. The city at its loudest, and people who want something from you.'],
  3: ['भाग ३', 'Nine Nights', 'Navratri. The money starts to make sense, and so does who’s behind it.'],
  4: ['भाग ४', 'Lights', 'Diwali. Everything you chose comes to your door.'],
  5: ['भाग ५', 'Winter', 'The end of the year. What you do with what you know.'] };
// a picture for a chapter: assets/missions/<id>.webp when there is one, else your own photos from it
// a picture for a chapter: the game's own shot of where it happens (postcards.js), once you've been there
let PC = null;
const pic = (id) => { const u = 'assets/missions/' + id + '.webp'; return assetVersion(u) ? versioned(u) : PC ? PC.get('m:' + id) : null; };
const SIDE = [
  { k: 'side', id: 'rides', title: 'Auto rides', sub: 'Turn the meter on, anywhere', body: 'Drive your auto and passengers wave you down. A good ride, on the meter, is money, a better rating and a little respect.', how: 'Get in your auto. Hail-waving passengers show on the minimap.' },
  { k: 'side', id: 'delivery', title: 'Deliveries', sub: 'DropKart orders', body: 'Pick up from a restaurant, drop at a door. Quick money between rides, and the riders at the counters talk.', how: 'Your phone pings with orders once you’re signed up.' },
  { k: 'side', id: 'help', title: 'Street help', sub: 'Someone always needs a hand', body: 'A fender-bender, a stalled scooter, a lost aaji. Stop and help and the neighbourhood remembers.', how: 'Look for people waving on the street.' },
  { k: 'act', id: 'gym', title: 'Gym', sub: 'Fitness', body: 'Train and your health goes up, and your punches land harder.', how: 'Any gym on the map.' },
  { k: 'act', id: 'photo', title: 'Photo walk', sub: 'K takes a picture', body: 'Shoot the city. Your photos go into your missions, chapter by chapter.', how: 'Press K anywhere.' },
  { k: 'act', id: 'club', title: 'Night out', sub: 'Clubs and bars', body: 'Music, a drink, people to meet. Don’t drive home.', how: 'Clubs open late, in KP and on the highway.' },
  { k: 'act', id: 'gold', title: 'Gold', sub: 'Jewellers', body: 'Buy gold when the rate is low, sell when it’s high. It moves every hour.', how: 'Any jeweller on the map.' },
];

export function missionsRoom(J) {
  PC = J.g.postcards || null; J.mloc = null;
  const G = J.g, S = G.story, st = S ? S.st : { m: 0, step: -1 }, ms = S && S.list ? S.list() : [];
  const filt = J.mfilt || 'all';
  const items = [];
  ms.forEach((m, i) => { if (i <= st.m + 2) items.push({ k: 'main', i, m, id: 'm:' + i, done: i < st.m, cur: i === st.m, locked: i > st.m }); });
  for (const x of SIDE) items.push({ ...x, id: 's:' + x.id });
  if (!J.msel || !items.some(x => x.id === J.msel)) J.msel = 'm:' + Math.min(st.m, Math.max(0, ms.length - 1));
  const t = S && S.target ? S.target() : null, P = G.player, dist = t ? Math.hypot(t.x - P.x, t.z - P.z) : null;
  const thumb = (x) => {
    if (x.k !== 'main') return `<i class="mr-th txt">${esc(x.title.charAt(0))}</i>`;
    const u = pic(x.m.id), ph = !u && (G.life.s.photos || []).filter(p => p.m === x.i).slice(-1)[0];
    return u || ph ? `<i class="mr-th" style="background-image:url(${u || ph.url})"></i>` : `<i class="mr-th txt" lang="mr">${esc((x.m.mr || x.m.title).slice(0, 2))}</i>`;
  };
  const row = (x) => `<button class="mr-it${x.id === J.msel ? ' sel' : ''}${x.locked ? ' locked' : ''}${x.done ? ' done' : ''}" data-msel="${x.id}">${thumb(x)}
    <span><b>${esc(x.locked ? 'Locked' : x.k === 'main' ? x.m.title : x.title)}</b><small>${x.k === 'main' ? esc(x.m.act ? `Act ${x.m.act} · ${ACTS[x.m.act][1]}` : 'Prologue') : esc(x.sub)}</small></span>
    <em>${x.cur && dist != null ? km(dist) : x.done ? g('flag', 'dn') : x.locked ? g('shield', 'lk') : ''}</em></button>`;
  const groups = [['main', 'Main story'], ['side', 'Side jobs'], ['act', 'Activities']].filter(([k]) => filt === 'all' || filt === k);
  const left = `<div class="rm-chips">${[['all', 'All'], ['main', 'Main story'], ['side', 'Side jobs'], ['act', 'Activities']].map(([k, n]) => `<button class="${filt === k ? 'on' : ''}" data-mf="${k}">${n}</button>`).join('')}</div>
    <div class="rm-scroll">${groups.map(([k, n]) => { const L = items.filter(x => x.k === k); return L.length ? `<div class="rm-h">${n}</div>${L.map(row).join('')}` : ''; }).join('')}</div>`;
  const x = items.find(q => q.id === J.msel);
  let mid = '', right = '';
  if (x && x.k === 'main' && !x.locked) {
    const m = x.m, a = ACTS[m.act] || ['', '', ''];
    const tx = []; for (const q of m.texts || []) { const v = q.fn ? q.fn() : [q]; for (const r of v) tx.push(r); }
    const steps = (m.steps || []).filter(s => !s.flash && !s.scene).map((s, k) => ({ t: typeof s.obj === 'function' ? s.obj() : s.obj, sub: s.sub, done: x.done || (x.cur && k < st.step), now: x.cur && k === st.step }));
    const u = pic(m.id), phs = (G.life.s.photos || []).filter(p => p.m === x.i).slice(-3);
    // where it happens, shown live (the map's live view): the current step's place, else the first place it names
    let loc = x.cur && t ? t : null;
    if (!loc) for (const sp of m.steps || []) { const w = sp.where; if (!w) continue; try { const r = typeof w === 'function' ? w() : w; if (r && isFinite(r.x)) { loc = r; break; } } catch (e) { /* */ } }
    J.mloc = loc;
    const who = tx[0] ? S.name(tx[0][0]) : (m.steps[0] && m.steps[0].who && typeof m.steps[0].who === 'string' ? S.name(m.steps[0].who) : '—');
    const inAct = ms.filter(q => q.act === m.act), doneInAct = inAct.filter(q => ms.indexOf(q) < st.m).length;
    const xpGain = 250 + steps.length * 25;
    mid = `<div class="rm-k">Main story · ${m.act ? 'Act ' + m.act : 'Prologue'}</div><h2>${esc(m.title)} <span lang="mr">${esc(m.mr || '')}</span></h2>
      ${tx.slice(0, 2).map(q => `<p class="rm-msg"><b>${esc(S.name(q[0]))}</b>${esc(q[2] || q[1])}</p>`).join('')}
      ${loc ? `<div class="rm-pic live"><canvas width="320" height="180"></canvas><span class="rm-pic-l"><i></i>${esc(loc.name || 'Live')}</span></div>${phs.length ? `<div class="rm-photos">${phs.map(p => `<img alt="" src="${p.url}">`).join('')}</div>` : ''}`
        : `<div class="rm-pic${u || phs.length ? '' : ' none'}">${u ? `<img alt="" src="${u}">` : phs.length ? phs.map(p => `<img alt="" src="${p.url}">`).join('') : `<span lang="mr">${esc(m.mr || m.title)}</span>`}</div>`}
      <div class="rm-k">Objectives</div><ul class="rm-obj">${steps.map(s => `<li class="${s.done ? 'done' : s.now ? 'now' : ''}"><i></i><span>${esc(s.t)}${s.now && s.sub ? `<small>${esc(s.sub)}</small>` : ''}</span>${s.now && dist != null ? `<em>${km(dist)}</em>` : ''}</li>`).join('')}</ul>`;
    right = `<div class="rm-card rm-act"><small>${esc(a[0])}</small><h3>${m.act ? 'Act ' + m.act : 'Prologue'} · ${esc(a[1])}</h3>
        <div class="rm-prog"><span>${doneInAct} / ${inAct.length} chapters</span><i><b style="width:${inAct.length ? doneInAct / inAct.length * 100 : 0}%"></b></i></div><p>${esc(a[2])}</p></div>
      <div class="rm-card"><div class="rm-k">Worth</div><div class="rm-rw"><span>${g('rank')}<b>+${xpGain}</b><small>XP</small></span>${x.done ? `<span>${g('flag')}<b>Done</b><small>Chapter</small></span>` : ''}</div></div>
      <div class="rm-card"><div class="rm-k">Details</div><div class="rm-det"><div>${g('user')}<span>From</span><b>${esc(who)}</b></div><div>${g('pin')}<span>Where</span><b>${esc(loc && loc.name ? loc.name : '—')}</b></div><div>${g('rank')}<span>Level</span><b>${m.act * 2 + 1}</b></div><div>${g('flag')}<span>Type</span><b>Main story</b></div></div>
        ${x.cur && t ? '<button class="rm-btn" data-mtrack><span>Show on map</span><span class="kbd">M</span></button>' : ''}</div>`;
  } else if (x && x.k === 'main') {
    mid = `<div class="rm-k">Main story</div><h2>Locked</h2><p class="rm-p">Finish ${esc(ms[st.m] ? ms[st.m].title : 'this chapter')} first. Your phone rings when the next one starts.</p>`;
  } else if (x) {
    mid = `<div class="rm-k">${x.k === 'side' ? 'Side job' : 'Activity'}</div><h2>${esc(x.title)}</h2><p class="rm-p">${esc(x.body)}</p><div class="rm-pic none"><span>${esc(x.title)}</span></div>`;
    right = `<div class="rm-card"><div class="rm-k">How</div><p>${esc(x.how)}</p></div>`;
  }
  return `<section class="rm rm-miss"><div class="rm-col rm-l">${left}</div><div class="rm-col rm-m">${mid}</div><div class="rm-r">${right}</div></section>`;
}

// ---------------------------------------------------------------- stats
const WORD = { respect: ['मान', 'Respect'], karma: ['पुण्य', 'Karma'], style: ['थाट', 'Style'], fitness: ['ताकद', 'Fitness'] };
const VNAME = { auto: 'Auto rickshaw', scooter: 'Scooter', bike: 'Motorcycle', cycle: 'Bicycle', hatch: 'Hatchback', sedan: 'Sedan', suv: 'SUV', taxi: 'Taxi', tempo: 'Tempo', bus: 'Bus' };
export function statsRoom(J) {
  const G = J.g, L = G.life, s = L.s, P = G.player, T = s.tally || {}, lv = L.level ? L.level() : { L: 1, xp: 0, from: 0, to: 300 };
  const sv = savedCharacter(), name = (sv && sv.name) || G.playerName || 'You';
  const area = document.getElementById('h-area')?.textContent || 'Pune', street = document.getElementById('h-street')?.textContent || '';
  const home = G.props && G.props.list ? G.props.list.filter(p => G.props.owned(p)) : [];
  const tags = [];
  if ((G.stats.rides || 0) >= 10) tags.push('Auto-wala'); if ((T.deliveries || 0) >= 10) tags.push('Delivery partner'); if ((T.fightsWon || 0) >= 5) tags.push('Street fighter');
  if ((T.fed || 0) >= 8) tags.push('Feeds the strays'); if ((s.karma || 0) > 25) tags.push('Good soul'); if ((s.karma || 0) < -25) tags.push('Trouble'); if ((s.respect || 0) > 40) tags.push('Known face');
  if (home.length) tags.push('Owns a home'); if ((s.wardrobe || []).length >= 5) tags.push('Dresses up'); if ((T.racesWon || 0) > 0) tags.push('Racer'); if ((s.gold || 0) >= 10) tags.push('Buys gold');
  if (!tags.length) tags.push('Just back in Pune', 'Explorer');
  const bar = (ic, n, v, c, txt) => { const f = Math.max(0, Math.min(1, v)); return `<div class="rs-b">${g(ic)}<span>${n}</span><i><b style="width:${(f * 100).toFixed(1)}%;background:${c}"></b></i><em>${txt ?? Math.round(f * 100) + ' / 100'}</em></div>`; };
  let st = null; try { st = L.style && L.style(); } catch (e) { /* */ }
  const rp = s.respect || 0, ka = s.karma || 0;
  const tile = (ic, label, val, note, f, c) => `<div class="rs-t">${g(ic)}<span>${label}</span><strong style="color:${c}">${val}</strong><small>${esc(note)}</small><i><b style="width:${Math.max(0, Math.min(100, f * 100)).toFixed(0)}%;background:${c}"></b></i></div>`;
  const subs = (G.hud && G.hud.suburbs) || [], seen = [];
  if (G.rep && subs.length) {
    const cur = subs.reduce((b, q) => (q.x - P.x) ** 2 + (q.z - P.z) ** 2 < (b ? (b.x - P.x) ** 2 + (b.z - P.z) ** 2 : 1e18) ? q : b, null);
    for (const o of subs.map(q => { const v = G.rep.at(q.x, q.z); return { q, w: v.good + v.bad, sd: G.rep.standing(q.x, q.z) }; }).filter(o => o.w > 0.05 || o.q === cur).sort((a, b) => (b.q === cur) - (a.q === cur) || b.w - a.w).slice(0, 7)) seen.push(o);
  }
  const repRow = (o) => { const v = o.sd, w = v > 0.45 ? 'One of ours' : v > 0.15 ? 'Liked' : v < -0.45 ? 'Trouble' : v < -0.15 ? 'Low' : 'Neutral', c = v > 0.15 ? '#3ddc84' : v < -0.15 ? '#ff5a5f' : '#4a9dff';
    return `<div class="rs-rep"><span>${esc(o.q.n)}</span><i><b style="width:${Math.max(6, (v + 1) * 50).toFixed(0)}%;background:${c}"></b></i><em style="color:${c}">${w}</em></div>`; };
  const pol = G.police || {}, heat = pol.heat || 0, dues = pol.duesTotal || 0;
  const veh = [{ type: 'auto', name: 'The stand’s auto', fuel: G.player && G.player.cur && G.player.cur.type === 'auto' ? G.player.cur.fuel : null, hp: G.player && G.player.cur && G.player.cur.type === 'auto' ? G.player.cur.hp : null },
    ...(s.vehicles || []).map(v => ({ type: v.type, paint: Array.isArray(v.col) ? v.col : null, name: VNAME[v.type] || v.type, fuel: v.fuel, plate: v.plate }))];
  const pct = (v) => v == null ? '–' : Math.round((v > 1.5 ? v / 100 : v) * 100) + '%';
  const vCard = (v) => { const r = J.vehShot(v.type, v.paint); return `<div class="rs-v"><div class="rs-vi">${r.url ? `<img alt="" src="${r.url}">` : `<img alt="" data-r="${esc(r.key)}" hidden>`}</div><b>${esc(v.name)}</b><div class="rs-vs">${g('fuel', '', '#ffb224')}<span>${pct(v.fuel)}</span>${g('wrench', '', '#9aa0aa')}<span>${pct(v.hp)}</span></div></div>`; };
  const tl = (ic, label, val, extra = '', vc = '') => `<div class="rs-tl">${g(ic)}<small>${label}</small><b${vc ? ` style="color:${vc}"` : ''}>${val}</b>${extra}</div>`;
  const por = J.portrait(), pc = G.postcards;
  const homes = home.length ? home.map(p => ({ n: p.name, at: p.area || '', cur: !(G.props.rentedOut && G.props.rentedOut(p)), note: G.props.rentedOut && G.props.rentedOut(p) ? `Rented out · ${rs(p.rent)} a day` : '' })) : [{ n: 'Aai’s house', at: 'Sadashiv Peth', cur: true, note: '' }];
  const homeImg = (h) => { const u = pc && (pc.get('ar:' + h.at) || pc.get('ar:Sadashiv Peth')); return u ? `<img alt="" src="${u}">` : g('home'); };
  return `<section class="rm rm-stats rf">
    <div class="rf-card rs-1">
      <h4>Player</h4>
      <div class="rs-me"><div class="rs-por">${por ? `<img alt="" src="${por}">` : ''}</div>
        <div class="rs-who"><div class="rs-nm"><h2>${esc(name)}</h2><button class="rs-edit" data-rename title="Change name and look">${g('pencil')}</button></div>
          <div class="rs-lvl">Level ${lv.L}</div><div class="rs-xpl">${(lv.xp - lv.from).toLocaleString('en-IN')} / ${(lv.to - lv.from).toLocaleString('en-IN')} XP</div>
          <i class="rs-xp"><b style="width:${((lv.xp - lv.from) / Math.max(1, lv.to - lv.from) * 100).toFixed(1)}%"></b></i>
          <div class="rs-box"><div>${g('pin', '', '#f1ece2')}<span><small>Current location</small><b>${esc(street ? street + ', ' + area : area)}</b></span></div><div>${g('home')}<span><small>Home</small><b>${esc(homes[0].at || 'Pune')}</b></span></div></div>
          <p class="rs-q">“Back in Pune with ten thousand rupees and an auto that isn’t mine.”</p></div></div>
      <h4>Playstyle</h4><div class="rs-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <h4>Body status</h4>
      ${bar('heart', 'Health', (P.hp ?? 100) / L.hpMax, '#ff4d5e', `${Math.round(P.hp ?? 100)} / ${L.hpMax}`)}${bar('food', 'Food', s.hunger, '#ff8a3d')}${bar('drop', 'Water', s.thirst, '#3ea8ff')}${bar('bolt', 'Energy', s.energy, '#ffd23f')}${bar('run', 'Stamina', P.stam ?? 1, '#f1ece2')}${bar('smile', 'Mood', s.mood, '#3ddc84')}${bar('glass', 'Drunk', s.drunk || 0, '#e8b04a')}
    </div>
    <div class="rf-card rs-2">
      <h4>Personality</h4>
      <div class="rs-tiles">${tile('pagdi', 'Respect', Math.round(rp), rp > 40 ? 'People listen to you.' : rp > 10 ? 'Some know your name.' : rp < -10 ? 'People laugh at you.' : 'Nobody knows you yet.', (rp + 100) / 200, '#ffb224')}
        ${tile('lotus', 'Karma', Math.round(ka), ka > 25 ? 'Aajis bless you.' : ka > 5 ? 'Mostly good.' : ka < -25 ? 'People cross the road.' : ka < -5 ? 'A bit of a worry.' : 'Even, so far.', (ka + 100) / 200, '#4a9dff')}
        ${tile('shirt', 'Style', st ? Math.round(st.score * 100) : '–', st ? (st.odd ? 'Bold, round here.' : st.score > 0.85 ? 'You got a look.' : st.score > 0.65 ? 'Fine for here.' : 'Off for here.') : '', st ? st.score : 0, '#ff5a5f')}
        ${tile('dumbbell', 'Fitness', Math.round(s.fitness || 0), (s.fitness || 0) > 20 ? 'Strong.' : (s.fitness || 0) > 5 ? 'Getting there.' : 'Hit the gym.', Math.min(1, (s.fitness || 0) / 50), '#3ddc84')}</div>
      <h4>Reputation</h4><p class="rs-sub">How people see you across Pune.</p>
      <div class="rs-reps">${seen.length ? seen.map(repRow).join('') : '<p class="rm-p">Nobody has made up their mind about you yet.</p>'}</div>
      <h4>Law &amp; legal record</h4>
      <div class="rs-law"><span>Wanted level</span><div class="rs-stars">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= heat ? 'on' : ''}">${g('star', '', k <= heat ? '#ffd23f' : 'rgba(255,255,255,.18)')}</i>`).join('')}</div><b>${heat} / 5</b><button class="rf-btn" data-goto="challans">View history <span class="kbd">H</span></button></div>
      <div class="rs-grid">${tl('receipt', 'Total challans', (pol.history || []).length)}${tl('card', 'Driving licence', pol.suspended ? 'Suspended' : `${g('check')} Valid`, '', pol.suspended ? '#ff5a5f' : '#3ddc84')}${tl('shield', 'Unpaid fines', rs(dues), '', dues ? '#ff8b7d' : '')}</div>
    </div>
    <div class="rs-3">
      <div class="rf-card"><h4>Money</h4><div class="rs-grid">${tl('cash', 'Cash', rs(G.stats.money))}${tl('bank', 'Bank', rs(s.bank))}${tl('gold', 'Gold', (s.gold || 0) + ' g', '', '#ffc83d')}</div></div>
      <div class="rf-card"><h4>Records</h4><div class="rs-grid four">${tl('auto', 'Rides completed', G.stats.rides || 0, G.stats.rides ? `<em>${g('star')}${(G.stats.rating || 0).toFixed(1)} avg</em>` : '')}${tl('bag', 'Deliveries', T.deliveries || 0)}${tl('fist', 'Fights won', T.fightsWon || 0)}${tl('paw', 'Strays fed', T.fed || 0)}</div></div>
      <div class="rf-card"><div class="rf-h"><h4>Owned properties</h4><button class="rf-btn" data-goto="own">Manage <span class="kbd">P</span></button></div>
        ${homes.map(h => `<div class="rs-home"><div class="rs-hi">${homeImg(h)}</div><span><b>${esc(h.n)}</b><small>${g('pin', '', '#9aa0aa')}${esc(h.note || h.at)}</small></span>${h.cur ? '<em>Current</em>' : ''}</div>`).join('')}</div>
      <div class="rf-card"><div class="rf-h"><h4>Owned vehicles</h4><button class="rf-btn" data-goto="own">Manage <span class="kbd">V</span></button></div><div class="rs-veh">${veh.slice(0, 3).map(vCard).join('')}</div></div>
    </div></section>`;
}
