// The menu's other rooms, drawn inside the jhola's panel: Missions (the story chapter by chapter, side jobs and
// things to do, the one you pick in full, its act, what it's worth and where) and Stats (you: name, level,
// how your body is, who you are and how Pune sees you, the law, money, your record, what you own).
import { savedCharacter } from '../people/characters.js';
import { assetVersion, versioned } from '../core/assets.js';

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
    <em>${x.cur && dist != null ? km(dist) : x.done ? '✓' : x.locked ? '' : ''}</em></button>`;
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
      <div class="rm-card"><div class="rm-k">Worth</div><div class="rm-rw"><span><b>+${xpGain}</b><small>XP</small></span>${x.done ? '<span><b>Done</b><small>chapter</small></span>' : ''}</div></div>
      <div class="rm-card"><div class="rm-k">Details</div><dl class="rm-dl"><dt>From</dt><dd>${esc(who)}</dd><dt>Where</dt><dd>${esc(x.cur && t ? t.name : x.done ? 'Done' : '—')}</dd><dt>Level</dt><dd>${m.act * 2 + 1}</dd><dt>Type</dt><dd>Main story</dd></dl>
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
export function statsRoom(J) {
  const G = J.g, L = G.life, s = L.s, P = G.player, T = s.tally || {}, lv = L.level ? L.level() : { L: 1, xp: 0, from: 0, to: 300 };
  const sv = savedCharacter(), name = (sv && sv.name) || G.playerName || 'You';
  const area = document.getElementById('h-area')?.textContent || 'Pune', street = document.getElementById('h-street')?.textContent || '';
  const home = G.props && G.props.list ? G.props.list.filter(p => G.props.owned(p)) : [];
  // what kind of Punekar you've turned out to be
  const tags = [];
  if ((G.stats.rides || 0) >= 10) tags.push('Auto-wala'); if ((T.deliveries || 0) >= 10) tags.push('Delivery partner'); if ((T.fightsWon || 0) >= 5) tags.push('Street fighter');
  if ((T.fed || 0) >= 8) tags.push('Feeds the strays'); if ((s.karma || 0) > 25) tags.push('Good soul'); if ((s.karma || 0) < -25) tags.push('Trouble'); if ((s.respect || 0) > 40) tags.push('Known face');
  if (home.length) tags.push('Owns a home'); if ((s.wardrobe || []).length >= 5) tags.push('Dresses up'); if ((T.racesWon || 0) > 0) tags.push('Racer'); if ((s.gold || 0) >= 10) tags.push('Buys gold');
  if (!tags.length) tags.push('Just back in Pune');
  const bar = (n, v, c, txt) => { const f = Math.max(0, Math.min(1, v)); return `<div class="rs-b" style="--c:${c}"><span>${n}</span><i><b style="width:${(f * 100).toFixed(1)}%"></b></i><em>${txt ?? Math.round(f * 100) + ' / 100'}</em></div>`; };
  let st = null; try { st = L.style && L.style(); } catch (e) { /* */ }
  const tile = (k, val, note, f) => `<div class="rs-t"><b lang="mr">${WORD[k][0]}</b><span>${WORD[k][1]}</span><strong class="num">${val}</strong><small>${esc(note)}</small><i><b style="width:${Math.max(0, Math.min(100, f * 100)).toFixed(0)}%"></b></i></div>`;
  const rp = s.respect || 0, ka = s.karma || 0;
  // how each neighbourhood you've been in takes you
  const subs = (G.hud && G.hud.suburbs) || [], seen = [];
  if (G.rep && subs.length) {
    const cur = subs.reduce((b, q) => (q.x - P.x) ** 2 + (q.z - P.z) ** 2 < (b ? (b.x - P.x) ** 2 + (b.z - P.z) ** 2 : 1e18) ? q : b, null);
    const scored = subs.map(q => { const v = G.rep.at(q.x, q.z); return { q, w: v.good + v.bad, sd: G.rep.standing(q.x, q.z) }; }).filter(o => o.w > 0.05 || o.q === cur).sort((a, b) => (b.q === cur) - (a.q === cur) || b.w - a.w).slice(0, 7);
    for (const o of scored) seen.push(o);
  }
  const repRow = (o) => { const v = o.sd, w = v > 0.45 ? 'One of ours' : v > 0.15 ? 'Liked' : v < -0.45 ? 'Trouble' : v < -0.15 ? 'Wary' : 'Neutral'; return `<div class="rs-rep"><span>${esc(o.q.n)}</span><i><b style="left:${50 + v * 50}%"></b></i><em class="${v > 0.15 ? 'g' : v < -0.15 ? 'r' : ''}">${w}</em></div>`; };
  const pol = G.police || {}, heat = pol.heat || 0, dues = pol.duesTotal || 0;
  const vehicles = s.vehicles || [];
  return `<section class="rm rm-stats">
    <div class="rm-col rs-1">
      <div class="rm-k">Player</div>
      <div class="rs-me"><div class="rs-por">${J.portrait() ? `<img alt="" src="${J.portrait()}">` : ''}</div>
        <div class="rs-who"><h2>${esc(name)} <button class="rs-edit" data-rename title="Change your name and look">Edit</button></h2>
          <div class="rs-lv"><b>Level ${lv.L}</b><span>${(lv.xp - lv.from).toLocaleString('en-IN')} / ${(lv.to - lv.from).toLocaleString('en-IN')} XP</span><i><b style="width:${((lv.xp - lv.from) / Math.max(1, lv.to - lv.from) * 100).toFixed(1)}%"></b></i></div>
          <dl class="rm-dl"><dt>Now</dt><dd>${esc(street ? street + ', ' + area : area)}</dd><dt>Home</dt><dd>${esc(home[0] ? home[0].name : 'Sadashiv Peth, with Aai')}</dd></dl></div></div>
      <div class="rm-k">Playstyle</div><div class="rs-tags">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <div class="rm-k">Body</div>
      ${bar('Health', (P.hp ?? 100) / L.hpMax, '#ff375f', `${Math.round(P.hp ?? 100)} / ${L.hpMax}`)}${bar('Food', s.hunger, '#ffb224')}${bar('Water', s.thirst, '#40c8ff')}${bar('Energy', s.energy, '#a8e43a')}${bar('Stamina', P.stam ?? 1, '#30e0b0')}${bar('Mood', s.mood, '#c58cff')}${bar('Drunk', s.drunk || 0, '#e8c27a')}
    </div>
    <div class="rm-col rs-2">
      <div class="rm-k">Personality</div>
      <div class="rs-tiles">${tile('respect', Math.round(rp), rp > 40 ? 'People listen to you' : rp > 10 ? 'Some know your name' : rp < -10 ? 'People laugh at you' : 'Nobody yet', (rp + 100) / 200)}
        ${tile('karma', Math.round(ka), ka > 25 ? 'Aajis bless you' : ka > 5 ? 'Mostly good' : ka < -25 ? 'People cross the road' : ka < -5 ? 'Bit of a worry' : 'Even', (ka + 100) / 200)}
        ${tile('style', st ? Math.round(st.score * 100) : '–', st ? (st.odd ? 'Bold, here' : st.score > 0.85 ? 'Spot on for here' : st.score > 0.65 ? 'Fine for here' : 'Off for here') : '', st ? st.score : 0)}
        ${tile('fitness', '+' + Math.round(s.fitness || 0), (s.fitness || 0) > 20 ? 'Strong' : (s.fitness || 0) > 5 ? 'Getting there' : 'The gym helps', Math.min(1, (s.fitness || 0) / 50))}</div>
      <div class="rm-k">Reputation <small>how people take you, area by area</small></div>
      <div class="rs-reps">${seen.length ? seen.map(repRow).join('') : '<p class="rm-p">Nobody has made up their mind about you yet.</p>'}</div>
      <div class="rm-k">Law</div>
      <div class="rs-law"><div class="rs-stars">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= heat ? 'on' : ''}">★</i>`).join('')}<span>${heat ? 'Wanted' : 'Not wanted'}</span></div>
        <div class="rs-mini"><span><small>E-challans</small><b>${(pol.history || []).length}</b></span><span><small>Unpaid</small><b>${rs(dues)}</b></span><span><small>Licence</small><b class="${pol.suspended ? 'r' : 'g'}">${pol.suspended ? 'Suspended' : 'Valid'}</b></span></div></div>
    </div>
    <div class="rm-col rs-3">
      <div class="rm-k">Money</div>
      <div class="rs-money"><span><small>Cash</small><b class="num">${rs(G.stats.money)}</b></span><span><small>Bank</small><b class="num">${rs(s.bank)}</b></span><span><small>Gold</small><b class="num">${s.gold || 0} g</b></span></div>
      <div class="rm-k">Record</div>
      <div class="rs-rec"><span><small>Rides</small><b>${G.stats.rides || 0}</b>${G.stats.rides ? `<em>★ ${(G.stats.rating || 0).toFixed(1)}</em>` : ''}</span><span><small>Deliveries</small><b>${T.deliveries || 0}</b></span><span><small>Fights won</small><b>${T.fightsWon || 0}</b></span><span><small>Strays fed</small><b>${T.fed || 0}</b></span><span><small>Knocked out</small><b>${T.knockedOut || 0}</b></span><span><small>Meals</small><b>${T.meals || 0}</b></span></div>
      <div class="rm-k">Homes</div>
      <div class="rs-own">${home.length ? home.map(p => `<div class="rs-o"><b>${esc(p.name)}</b><small>${G.props.rentedOut && G.props.rentedOut(p) ? `Rented out · ${rs(p.rent)} a day` : 'You live here'}</small></div>`).join('') : '<p class="rm-p">None yet. Six are for sale, from a 1 RK in Sadashiv Peth up.</p>'}</div>
      <div class="rm-k">Vehicles</div>
      <div class="rs-veh"><div class="rs-v"><i style="background:#1b1d14"></i><b>The stand’s auto</b><small>Bapu Kaka’s stand</small></div>${vehicles.map(v => `<div class="rs-v"><i style="background:#${(v.col >>> 0).toString(16).padStart(6, '0')}"></i><b>${esc(String(v.type || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()))}</b><small>${esc(v.plate || '')}${v.fuel != null ? ` · fuel ${Math.round(v.fuel * 100)}%` : ''}</small></div>`).join('')}</div>
    </div></section>`;
}
