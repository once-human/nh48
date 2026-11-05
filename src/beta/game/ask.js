// Stop someone on the street and ask (Z; nothing over anyone's head, there are too many people for that). Nobody chats
// with every stranger, so this is what you'd really stop a passer-by in Pune for: the way to your waypoint; with none and
// hungry, somewhere to eat; otherwise where you are. Everyone has their own way with a stranger, kept for as long as
// they're around: some don't even look at you, some shake their head and walk off, some point and say "that way", most
// tell you, some tell you everything, and the kind ones, with their bike or car close by, offer to drop you (Y to hop
// on; they won't wait all day). Under that, what they know of you: the police after you, your karma, what this street
// saw you do, having hit them, the hour, being asked twice. The directions come off the real road graph: the first
// turn, left or right, the road it's onto, a landmark at it, and how far.
import { People } from '@orig/people/peds.js';
import { MENUS } from '@orig/game/shops.js';
import { specOf } from '@orig/vehicles/vehicle.js';
import { Pilot } from '@orig/game/pilot.js';

// F is the one key for what's in front of you: a vehicle, a shop, a door, a pump, an animal. With two at once, the
// closer one (a vehicle needs you right at it, a shop's door is a few steps off)
Pilot.prototype.fPick = function (near) {
  const o = this.onFoot ? this.offer : null;
  if (!o) return near ? 'shop' : null;
  if (!near) return 'offer';
  const d = near.x !== undefined ? Math.hypot(near.x - this.x, near.z - this.z) : 1.5;
  return d + 0.4 < (o.dist ?? 1) ? 'shop' : 'offer';
};

const wrap = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a < -Math.PI) a += 2*Math.PI; return a; };
const round = (d) => d < 100 ? Math.max(10, Math.round(d/10)*10) : d < 1000 ? Math.round(d/50)*50 : Math.round(d/100)*100;
const km = (d) => d < 1000 ? `${round(d)} m` : `${(round(d)/1000).toFixed(1)} km`;
const kmMr = (d) => d < 1000 ? `${round(d)} मीटर` : `${(round(d)/1000).toFixed(1)} किलोमीटर`;
const SIDE = { left: ['डावीकडे', 'left'], right: ['उजवीकडे', 'right'] };
const one = (rng, a) => a[Math.floor(rng.next()*a.length)];
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// whoever you're facing, before whoever happens to be nearest: how far round you'd have to turn counts for more than
// a step's difference in distance (a crowded club: the one in front of you, not the one at your elbow)
export function facing(x, z, th, px, pz, reach) {
  const dx = px - x, dz = pz - z, d = Math.hypot(dx, dz);
  if (d > reach) return 1e9;
  const a = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - th), Math.cos(Math.atan2(dz, dx) - th)));
  if (a > 1.0 && d > 0.75) return 1e9;
  return a*2.4 + d;
}
export function who(ppl, P) {
  if (!P.onFoot) return null;
  let best = null, bs = 1e9;
  for (const p of ppl.list) {
    if (p.hidden || p.corpse || p.dead || p.ko || p.fallen > 0 || p.pax || p.rideOf || p.lift || p.mode === 'fight' || p.mode === 'flee' || p.mode === 'chase' || p.mode === 'inside') continue;
    const sc = facing(P.x, P.z, P.th, p.x, p.z, 2.8);
    if (sc < bs) { bs = sc; best = p; }
  }
  return best;
}
const hungry = (G) => { const s = G.life?.s; return s && typeof s.hunger === 'number' && s.hunger < 0.35; };

// how this person is with strangers: their own, then pushed by your karma and the hour
export function attitude(ppl, p, G) {
  if (p.cop) return ppl.rng.next() < 0.5 ? 'curt' : 'normal';
  if (!p._att0) {
    const r = ppl.rng.next();
    p._att0 = r < 0.1 ? 'ignore' : r < 0.2 ? 'walkaway' : r < 0.42 ? 'curt' : r < 0.74 ? 'normal' : r < 0.9 ? 'eager' : 'kind';
  }
  const k = G.life?.s?.karma || 0, h = G.hour ?? 12, late = h >= 22 || h < 5, R = ppl.rng.next();
  let a = p._att0;
  if (k < -20 && R < Math.min(0.7, -k/80)) a = R < 0.3 ? 'ignore' : 'walkaway';
  else if (k > 20 && (a === 'curt' || a === 'normal') && R < Math.min(0.5, k/100)) a = R < 0.2 ? 'kind' : 'eager';
  if (late && R < 0.35) a = p.female ? 'walkaway' : a === 'kind' ? 'eager' : a === 'normal' ? 'curt' : a;
  return a;
}

// the way from here to (x, z), as you'd say it
export function directions(G, P, x, z) {
  const Gr = G.W.graph, from = Gr.nearest(P.x, P.z, 80), to = Gr.nearest(x, z, 250);
  const r = from && to && (Gr.route(from, to, true) || Gr.route(from, to, false));
  if (!r) return null;
  const f = Gr.routePolyline(r, from, to); f.push(x, z);
  const pts = [[P.x, P.z]]; for (let i = 0; i < f.length; i += 2) pts.push([f[i], f[i + 1]]);
  const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = s[s.length - 1], at = (d) => { d = Math.max(0, Math.min(total, d)); let i = 1; while (i < s.length - 1 && s[i] < d) i++; const k = (d - s[i - 1])/Math.max(1e-6, s[i] - s[i - 1]); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0])*k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1])*k]; };
  const head = (d0, d1) => { const a = at(d0), b = at(d1); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
  const first = wrap(head(0, Math.min(20, total)) - P.th);
  // a real turn: the heading 12 m before and after a point differs by more than 40 degrees
  const turns = [];
  for (let d = 20; d < total - 15 && turns.length < 2; d += 4) {
    const t = wrap(head(d, d + 12) - head(d - 12, d));
    if (Math.abs(t) > 0.7) { turns.push({ d, side: t > 0 ? 'right' : 'left', pt: at(d + 15) }); d += 30; }
  }
  return { total, first, turns, ahead: at(Math.min(30, total)) };
}
export const roadAt = (G, x, z) => { const e = G.W.graph.nearest(x, z, 25), n = e && G.W.graph.names?.[e.e?.name]; return n && n[0] || null; };
export const markAt = (G, x, z, r = 70) => { let best = null, bd = r; for (const q of G.city?.places || []) { if (q.c !== 'landmark') continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best; };
// a parked bike or car of theirs, close to them
export function rideNear(G, p) {
  let best = null, bd = 22;
  for (const r of G.W.parkedList || []) { if (r.taken) continue; const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < bd) { bd = d; best = r; } }
  return best;
}

// before anything: what they know of you, and whether they'll talk to a stranger at all. Returns their attitude, or
// null when that was the end of it (they've said their piece, run, or not even looked at you)
People.prototype.gate = function (p, P, G, say) {
  const rng = this.rng;
  const look = (x, z, t) => { this.watch(p, x, z, t); p.yaw = Math.atan2(z - p.z, x - p.x); };
  const mem = (this.mem && this.mem.get(p.id)) || {}, now = performance.now(), heat = G.police?.heat || 0, karma = G.life?.s?.karma || 0;
  const rep = this.rep ? this.rep.at(p.x, p.z) : { bad: 0, good: 0 }, h = G.hour ?? 12, late = h >= 22.5 || h < 5;
  // what they know of you first
  if (mem.hit) {
    look(P.x, P.z, 2);
    if (rng.next() < 0.5) { this.flee(p, P.x, P.z, 20); say(one(rng, ['तू? लांब राहा माझ्यापासून!', 'परत तूच? जा!']), 'You? Keep away from me!'); }
    else { p.angry = 4; p.grudge = 12; say('आधी मारलं, आता पत्ता विचारतोय?', 'First you hit me, now you want directions?'); }
    return null;
  }
  if (heat >= 2 && !p.cop) { look(P.x, P.z, 1.5); say(one(rng, ['पोलीस तुम्हालाच शोधतायत ना? जा इथून.', 'माझं नाव घेऊ नका. जा.']), 'Aren\'t the police after you? Go, leave me out of it.'); this.flee(p, P.x, P.z, 10); return null; }
  if (p.cop && heat >= 1) { look(P.x, P.z, 4); say('पत्ता नंतर. आधी इकडे या.', 'Directions later. Come here first.'); return null; }
  if ((rep.bad > 3 || karma < -40) && rng.next() < 0.6) { look(P.x, P.z, 1.5); say('तुमच्याबद्दल ऐकलंय मी. काही सांगायचं नाही.', 'I\'ve heard about you. I\'ve nothing to tell you.'); p.anim = 'no'; return null; }

  const att = attitude(this, p, G);
  // the ones who won't: no look at all, or a shake of the head and off
  if (att === 'ignore') return null;
  if (att === 'walkaway') {
    look(P.x, P.z, 0.8); p.anim = 'no';
    if (rng.next() < 0.6) say(one(rng, ['नको, नको.', 'मला वेळ नाही.', 'घाईत आहे.']), one(rng, ['No, no.', 'I don\'t have time.', 'I\'m in a hurry.']), 3);
    setTimeout(() => { if (p.mode === 'watch') this.flee(p, P.x, P.z, 6); }, 900);
    return null;
  }
  look(P.x, P.z, 30);
  return att;
};
// one thing asked: the way (to your waypoint), food, where you are, or a lift
People.prototype.answer = function (p, P, G, what, att, say) {
  const rng = this.rng, now = performance.now(), h = G.hour ?? 12, late = h >= 22.5 || h < 5;
  const look = (x, z, t) => { this.watch(p, x, z, t); p.yaw = Math.atan2(z - p.z, x - p.x); };
  const mem = (this.mem && this.mem.get(p.id)) || {};
  if (mem['t_' + what] && now - mem['t_' + what] < 60000) { say(one(rng, ['आत्ताच सांगितलं ना! लक्ष कुठे असतं?', 'किती वेळा सांगू?']), 'I just told you! Where is your mind?'); return true; }
  if (what === 'way' && rng.next() < (late ? 0.15 : 0.05) && att !== 'kind' && att !== 'eager') { say('पाटी वाचता येत नाही का?', 'Can\'t you read the signboard?'); return true; }
  this.remember(p, 'asked'); this.mem.get(p.id)['t_' + what] = now;
  const pre = late && att !== 'curt' ? ['एवढ्या रात्री? जपून जा. ', 'At this hour? Go carefully. '] : att === 'eager' || att === 'kind' ? one(rng, [['हां, सांगतो. ', 'Yes, I\'ll tell you. '], ['अरे, सोपं आहे. ', 'Oh, that\'s easy. '], ['बघा, ', 'Look, ']]) : ['', ''];
  // where to: the waypoint, else food when you're hungry, else just where you are
  let x, z;
  const topic = what;
  if ((topic === 'way' || topic === 'lift') && G.waypoint) { x = G.waypoint.x; z = G.waypoint.z; what = G.waypoint.name || 'there'; }
  else if (topic === 'food') {
    const s = (G.shops?.nearby?.(P.x, P.z, 900) || []).filter(q => MENUS[q.kind] && q.x !== undefined)[0];
    if (!s) { say(pre[0] + 'इथे जवळ खायला काही नाही.', pre[1] + 'Nothing to eat round here.'); return true; }
    x = s.x; z = s.z; what = s.name || 'a place to eat';
  } else {
    const area = (G.hud?.suburbs || []).reduce((a, q) => { const d = Math.hypot(q.x - P.x, q.z - P.z); return d < a.d ? { d, n: q.n } : a; }, { d: 1e9, n: null }).n;
    const road = roadAt(G, P.x, P.z), q = markAt(G, P.x, P.z, att === 'curt' ? 400 : 1500);
    if (att === 'curt') { say(road ? `${road}.` : `${area || 'पुणे'}.`, road ? `${road}.` : `${area || 'Pune'}.`, 3); return true; }
    let mr = `${pre[0]}हा ${road || 'रस्ता'}${area ? ', ' + area : ''}.`, en = `${pre[1]}This is ${road || 'the road'}${area ? ', ' + area : ''}.`;
    if (q) { const d = Math.hypot(q.x - P.x, q.z - P.z), rel = wrap(Math.atan2(q.z - P.z, q.x - P.x) - P.th);
      const dir = Math.abs(rel) < 0.6 ? ['समोर', 'ahead'] : Math.abs(rel) > 2.4 ? ['मागे', 'behind you'] : rel > 0 ? SIDE.right : SIDE.left;
      mr += ` ${q.n} ${dir[0]}, ${kmMr(d)}.`; en += ` ${q.n} is ${dir[1]}, ${km(d)}.`; setTimeout(() => look(q.x, q.z, 2), 700); p.act = { clip: 'wave', t: 0, dur: 1.6 }; }
    say(mr, en); return true;
  }
  const D = directions(G, P, x, z);
  if (!D) { say(pre[0] + 'तिकडे जायचा रस्ता नाही माहीत मला.', pre[1] + `I don't know the way to ${what}.`); return true; }
  if (D.total < 60) { say(one(rng, ['हे काय, इथेच तर आहे!', 'इथेच. समोर बघा.']), `${cap(what)}? It's right here!`); return true; }
  const t0 = D.turns[0], toward = t0 ? t0.pt : D.ahead;
  setTimeout(() => look(toward[0], toward[1], 2.2), 600); p.act = { clip: 'wave', t: 0, dur: 1.6 };
  // "that way": the arm, a word, done
  if (att === 'curt') {
    const back = Math.abs(D.first) > 2.4;
    say(back ? 'मागे. तिकडे.' : D.total < 300 ? 'इथेच, पुढे.' : 'तिकडे.', back ? 'Back that way.' : D.total < 300 ? 'Just up there.' : 'That way.', 3);
    return true;
  }
  // the kind ones: their bike or car is right here, and it's a fair way
  if ((att === 'kind' || (topic === 'lift' && att === 'eager' && rng.next() < 0.4)) && D.total > 500 && G.transit && !this.lift) {
    const r = rideNear(G, p);
    if (r) { offerLift(this, G, p, r, { x, z, name: what }, D.total, say); return true; }
  }
  if (topic === 'lift') { say(...one(rng, [['माझी गाडी नाही इथे. रिक्षा करा.', 'My vehicle isn\'t here. Take an auto.'], ['मी उलट्या बाजूला चाललोय.', 'I\'m going the other way.'], ['सॉरी, जमणार नाही.', 'Sorry, can\'t do it.']])); return true; }
  const parts = [[], []];
  if (Math.abs(D.first) > 2.4) parts[0].push('आधी मागे फिरा'), parts[1].push('turn back first');
  if (!t0) { parts[0].push(`सरळ जा, ${kmMr(D.total)}`); parts[1].push(`straight on, ${km(D.total)}`); }
  else {
    const road = roadAt(G, t0.pt[0], t0.pt[1]), mk = markAt(G, t0.pt[0], t0.pt[1]);
    parts[0].push(`सरळ ${kmMr(t0.d)}, मग ${mk ? mk.n + 'पाशी ' : ''}${SIDE[t0.side][0]} वळा${road ? ', ' + road : ''}`);
    parts[1].push(`straight about ${km(t0.d)}, then ${SIDE[t0.side][1]}${mk ? ' at ' + mk.n : ''}${road ? ' onto ' + road : ''}`);
    const t1 = D.turns[1];
    if (t1 && att !== 'normal') { const r1 = roadAt(G, t1.pt[0], t1.pt[1]); parts[0].push(`पुढे परत ${SIDE[t1.side][0]}${r1 ? ', ' + r1 : ''}`); parts[1].push(`then ${SIDE[t1.side][1]}${r1 ? ' onto ' + r1 : ''}`); }
    parts[0].push(`एकूण ${kmMr(D.total)}`); parts[1].push(`${km(D.total)} in all`);
  }
  if (D.total > 3000) { parts[0].push('लांब आहे, रिक्षा करा'); parts[1].push('it\'s a long way, take an auto'); }
  if (att === 'eager') { const [m, e] = one(rng, [['चुकलात तर परत कोणालाही विचारा', 'if you get lost, ask anyone again'], ['सिग्नलला लक्ष ठेवा', 'watch the signal there'], ['तिथे गेलात की कळेल', 'you\'ll know it when you see it']]); parts[0].push(m); parts[1].push(e); }
  say(pre[0] + parts[0].join('. ') + '.', pre[1] + cap(parts[1].join(', ')) + '.', 7.5);
  return true;
};

// ---------------------------------------------------------------- a lift from someone kind
export function offerLift(ppl, G, p, r, to, dist, say0) {
  const S = specOf(r.kind), two = !!S.two, say = say0 || ((mr, en, t = 5) => G.hud.say(p.female ? 'Lady' : 'Man', mr, en, t));
  say(two ? 'मी तिकडेच चाललोय. बसा मागे, सोडतो तुम्हाला.' : 'मी तिकडेच चाललोय. चला, गाडीत बसा, सोडतो.', two ? 'I\'m going that way. Get on the back, I\'ll drop you.' : 'I\'m going that way. Come, get in, I\'ll drop you.', 5);
  r.taken = true; p.lift = true;
  ppl.lift = { p, r, to, dist, two, t: 0, phase: 'walk', said: false };
  ppl.goTo(p, r.x, r.z, () => { if (ppl.lift && ppl.lift.p === p) { ppl.lift.phase = 'wait'; ppl.lift.t = 0; } });
}
function endLift(ppl, G, leave) {
  const L = ppl.lift; if (!L) return; ppl.lift = null;
  L.r.taken = false; L.p.lift = false;
  if (leave) { const P = G.player; ppl.flee(L.p, P.x, P.z, 8); }
}
function hopOn(ppl, G) {
  const L = ppl.lift, P = G.player; if (!L || L.phase !== 'wait') return;
  const mins = L.dist/1000/(L.two ? 24 : 20)*60 + 2;
  ppl.lift = null; L.p.lift = false; ppl.remove?.(L.p);       // they ride off with you; their bike goes with them
  G.transit.travel({ x: L.to.x, z: L.to.z, name: L.to.name }, 0, mins, L.two ? 'On the back of a stranger\'s bike' : 'A lift from a stranger');
  setTimeout(() => G.hud.say(L.p.female ? 'Lady' : 'Man', 'हे घ्या, आलं. सांभाळून जा!', 'Here you are. Take care!', 4), 1800);
  G.life?.change?.('karma', 0.3); void P;
}
const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...a) {
  const out = upd.call(this, dt, player, ...a), G = this._G, L = this.lift;
  if (G && L) {
    L.t += dt;
    const d = Math.hypot(player.x - L.r.x, player.z - L.r.z);
    if (!this.list.includes(L.p) || Math.hypot(player.x - L.p.x, player.z - L.p.z) > 45 || !player.onFoot) endLift(this, G, false);
    else if (L.phase === 'walk' && L.t > 25) { L.phase = 'wait'; L.t = 0; }
    else if (L.phase === 'wait') {
      this.watch(L.p, player.x, player.z, 1);
      if (d < 4.5) G.hud.prompt2?.('Y', L.two ? 'Get on the back' : 'Get in', 0.3);
      if (L.t > 16 && !L.said) { L.said = true; G.hud.say(L.p.female ? 'Lady' : 'Man', 'येताय ना? मला उशीर होतोय.', 'Coming? I\'m getting late.', 3.5); }
      if (L.t > 26) { G.hud.say(L.p.female ? 'Lady' : 'Man', 'चला, मला निघायला हवं. जपून जा.', 'Right, I have to go. Take care.', 3.5); endLift(this, G, true); }
    }
  }
  return out;
};
addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const G = window.__nhAskG; if (!G || G.state !== 'play' || /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  if (e.code === 'KeyY' && G.people.lift) hopOn(G.people, G);
});
