// Stop someone on the street and ask. Nobody chats with every stranger, so this is the one thing you'd really ask a
// passer-by in Pune: the way. What you get depends on what you're after (your waypoint; if you've none and you're hungry,
// food; otherwise where you are), on who they are and on what they know of you: a wanted face, a street that remembers
// what you did there, the hour, the same person asked twice. The directions come off the real road graph: the first turn,
// left or right, the road it's onto, a landmark at it, and how far.
import { People } from '@orig/people/peds.js';
import { MENUS } from '@orig/game/shops.js';

const wrap = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
const round = (d) => d < 100 ? Math.max(10, Math.round(d/10)*10) : d < 1000 ? Math.round(d/50)*50 : Math.round(d/100)*100;
const km = (d) => d < 1000 ? `${round(d)} m` : `${(round(d)/1000).toFixed(1)} km`;
const kmMr = (d) => d < 1000 ? `${round(d)} मीटर` : `${(round(d)/1000).toFixed(1)} किलोमीटर`;
const SIDE = { left: ['डावीकडे', 'left'], right: ['उजवीकडे', 'right'] };

function who(ppl, P) {
  if (!P.onFoot) return null;
  const fx = Math.cos(P.th), fz = Math.sin(P.th); let best = null, bd = 2.3;
  for (const p of ppl.list) {
    if (p.hidden || p.corpse || p.dead || p.ko || p.fallen > 0 || p.pax || p.rideOf || p.mode === 'fight' || p.mode === 'flee' || p.mode === 'chase' || p.mode === 'inside') continue;
    const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
    if (d < bd && (dx*fx + dz*fz)/Math.max(d, 1e-3) > 0.35) { bd = d; best = p; }
  }
  return best;
}
const hungry = (G) => { const s = G.life?.s; return s && typeof s.hunger === 'number' && s.hunger < 0.35; };

People.prototype.askLabel = function (P, G) {
  const p = (this._ask = who(this, P));
  if (!p) return null;
  return G.waypoint ? `Ask the way to ${G.waypoint.name || 'your waypoint'}` : hungry(G) ? 'Ask where to eat' : 'Ask where you are';
};

// the way from here to (x, z), as you'd say it
function directions(G, P, x, z) {
  const Gr = G.W.graph, from = Gr.nearest(P.x, P.z, 80), to = Gr.nearest(x, z, 250);
  const r = from && to && (Gr.route(from, to, true) || Gr.route(from, to, false));
  if (!r) return null;
  const f = Gr.routePolyline(r, from, to); f.push(x, z);
  const pts = [[P.x, P.z]]; for (let i = 0; i < f.length; i += 2) pts.push([f[i], f[i + 1]]);
  const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = s[s.length - 1], at = (d) => { d = Math.max(0, Math.min(total, d)); let i = 1; while (i < s.length - 1 && s[i] < d) i++; const k = (d - s[i - 1])/Math.max(1e-6, s[i] - s[i - 1]); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0])*k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1])*k]; };
  const head = (d0, d1) => { const a = at(d0), b = at(d1); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const first = wrap(head(0, Math.min(20, total)) - P.th);
  // the first real turn: the heading 12 m before and after a point differs by more than 40 degrees
  const turns = [];
  for (let d = 20; d < total - 15 && turns.length < 2; d += 4) {
    const t = wrap(head(d, d + 12) - head(d - 12, d));
    if (Math.abs(t) > 0.7) { turns.push({ d, side: t > 0 ? 'right' : 'left', pt: at(d + 15) }); d += 30; }
  }
  return { total, first, turns };
}
const roadAt = (G, x, z) => { const e = G.W.graph.nearest(x, z, 25), n = e && G.W.graph.names?.[e.e?.name]; return n && n[0] || null; };
const markAt = (G, x, z, r = 70) => { let best = null, bd = r; for (const q of G.city?.places || []) { if (q.c !== 'landmark') continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q.n; } } return best; };

People.prototype.ask = function (P, G) {
  const p = this._ask && who(this, P) === this._ask ? this._ask : who(this, P);
  if (!p || (this._askT || 0) > performance.now()) return false;
  this._askT = performance.now() + 1500;
  const name = p.cop ? 'Havaldar' : p.female ? 'Lady' : 'Man', say = (mr, en, t = 6) => G.hud.say(name, mr, en, t);
  const look = (x, z, t) => { this.watch(p, x, z, t); p.yaw = Math.atan2(z - p.z, x - p.x); };
  look(P.x, P.z, 3);
  const mem = (this.mem && this.mem.get(p.id)) || {}, now = performance.now(), heat = G.police?.heat || 0;
  const rep = this.rep ? this.rep.at(p.x, p.z) : { bad: 0, good: 0 }, h = G.hour ?? 12, late = h >= 22.5 || h < 5, rnd = this.rng.next();
  // what they know of you first
  if (mem.hit) { if (this.rng.next() < 0.5) { this.flee(p, P.x, P.z, 20); say('तू? लांब राहा माझ्यापासून!', 'You? Keep away from me!'); } else { p.angry = 4; p.grudge = 12; say('आधी मारलं, आता पत्ता विचारतोय?', 'First you hit me, now you want directions?'); } return true; }
  if (heat >= 2 && !p.cop) { say('पोलीस तुम्हालाच शोधतायत ना? जा इथून.', 'Aren\'t the police looking for you? Go away.'); this.flee(p, P.x, P.z, 10); return true; }
  if (p.cop && heat >= 1) { say('पत्ता नंतर. आधी इकडे या.', 'Directions later. Come here first.'); return true; }
  if (mem.asked && now - mem.askedT < 60000) { say('आत्ताच सांगितलं ना! लक्ष कुठे असतं?', 'I just told you! Where is your mind?'); return true; }
  if (rep.bad > 3 && rnd < 0.6) { say('तुम्हाला काही सांगायचं नाही.', 'I\'ve nothing to tell you.'); return true; }
  if (rnd < (late ? 0.3 : 0.12) && !(rep.good > 2)) {
    const no = [['मला नाही माहीत.', 'I don\'t know.'], ['घाईत आहे, दुसऱ्याला विचारा.', 'I\'m in a hurry, ask someone else.'], ['पाटी वाचता येत नाही का?', 'Can\'t you read the signboard?']];
    const [mr, en] = no[Math.floor(this.rng.next()*no.length)]; say(mr, en); return true;
  }
  this.remember(p, 'asked'); const m = this.mem.get(p.id); m.askedT = now;
  const pre = late ? ['एवढ्या रात्री? जपून जा. ', 'At this hour? Go carefully. '] : rep.good > 2 ? ['तुमच्यासाठी काहीही. ', 'For you, anything. '] : ['', ''];
  // where to: the waypoint, else food when you're hungry, else just where you are
  let x, z, what;
  if (G.waypoint) { x = G.waypoint.x; z = G.waypoint.z; what = G.waypoint.name || 'there'; }
  else if (hungry(G)) {
    const s = (G.shops?.nearby?.(P.x, P.z, 900) || []).filter(q => MENUS[q.kind]).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    if (!s) { say(pre[0] + 'इथे जवळ खायला काही नाही.', pre[1] + 'Nothing to eat around here.'); return true; }
    x = s.x; z = s.z; what = s.name || 'a place to eat';
  } else {
    const area = G.hud?.suburbs?.reduce((a, q) => { const d = Math.hypot(q.x - P.x, q.z - P.z); return d < a.d ? { d, n: q.n } : a; }, { d: 1e9, n: null }).n;
    const road = roadAt(G, P.x, P.z), mark = markAt(G, P.x, P.z, 1500);
    let mr = `${pre[0]}हा ${road || 'रस्ता'}${area ? ', ' + area : ''}.`, en = `${pre[1]}This is ${road || 'the road'}${area ? ', ' + area : ''}.`;
    if (mark) { const q = G.city.places.find(o => o.n === mark), d = Math.hypot(q.x - P.x, q.z - P.z), rel = wrap(Math.atan2(q.z - P.z, q.x - P.x) - P.th);
      const dir = Math.abs(rel) < 0.6 ? ['समोर', 'ahead'] : Math.abs(rel) > 2.4 ? ['मागे', 'behind you'] : rel > 0 ? SIDE.right : SIDE.left;
      mr += ` ${mark} ${dir[0]}, ${kmMr(d)}.`; en += ` ${mark} is ${dir[1]}, ${km(d)}.`; look(q.x, q.z, 2.5); }
    say(mr, en); p.act = { clip: 'wave', t: 0, dur: 1.6 }; return true;
  }
  const D = directions(G, P, x, z);
  if (!D) { say(pre[0] + 'तिकडे रस्ता नाही माहीत मला.', pre[1] + `I don't know a road to ${what}.`); return true; }
  if (D.total < 60) { say('हे काय, इथेच तर आहे!', `${what}? It's right here!`); return true; }
  const parts = [[], []];
  if (Math.abs(D.first) > 2.4) parts[0].push('आधी मागे फिरा'), parts[1].push('turn back first');
  const t0 = D.turns[0];
  if (!t0) { parts[0].push(`सरळ जा, ${kmMr(D.total)}`); parts[1].push(`straight on, ${km(D.total)}`); }
  else {
    const road = roadAt(G, t0.pt[0], t0.pt[1]), mark = markAt(G, t0.pt[0], t0.pt[1]);
    parts[0].push(`सरळ ${kmMr(t0.d)}, मग ${mark ? mark + 'पाशी ' : ''}${SIDE[t0.side][0]} वळा${road ? ', ' + road : ''}`);
    parts[1].push(`straight about ${km(t0.d)}, then ${SIDE[t0.side][1]}${mark ? ' at ' + mark : ''}${road ? ' onto ' + road : ''}`);
    const t1 = D.turns[1];
    if (t1) { parts[0].push(`पुढे परत ${SIDE[t1.side][0]}`); parts[1].push(`then ${SIDE[t1.side][1]} again`); }
    parts[1].push(`${km(D.total)} in all`); parts[0].push(`एकूण ${kmMr(D.total)}`);
    look(t0.pt[0], t0.pt[1], 2.5);
  }
  if (D.total > 3000) { parts[0].push('लांब आहे, रिक्षा करा'); parts[1].push('it\'s a long way, take an auto'); }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  say(pre[0] + parts[0].join('. ') + '.', pre[1] + cap(parts[1].join(', ')) + '.', 7.5);
  p.act = { clip: 'wave', t: 0, dur: 1.6 };
  return true;
};
