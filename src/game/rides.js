// Passengers and fares. People wave you down, you stop, they say where; the meter runs at the
// Pune RTA tariff (₹30 for the first 1.5 km, ₹20/km after, revised 1 Sept 2026). Drive well, get tipped.
import * as THREE from 'three';
import { RNG, clamp, lerp } from '../core/util.js';
import PAX from './pax_lines.json';
const PERS_M = ['kaka', 'ajoba', 'dada', 'bhaiya', 'collegeboy'], PERS_F = ['kaku', 'aaji', 'tai', 'aunty', 'collegegirl'];

// No cap: a long ride is a long fare. Midnight to 5 am is 25% extra inside PMC/PCMC limits.
export const TARIFF = { base: 30, baseKm: 1.5, perKm: 20, night: 1.25 };
export const isNight = (hour) => hour >= 0 && hour < 5;
export function fareFor(meters, hour = 12) {
  const km = meters / 1000;
  const f = km <= TARIFF.baseKm ? TARIFF.base : TARIFF.base + (km - TARIFF.baseKm) * TARIFF.perKm;
  return f * (isNight(hour) ? TARIFF.night : 1);
}

// passenger lines: [romanised line, English gloss]
const L = {
  hail: [['Kaka, {d} yenar ka?', 'Uncle, will you come to {d}?'], ['Bhaiya, {d} chaloge?', 'Brother, will you go to {d}?'],
    ['{d}. Meter ne chala ha!', '{d}. And go by the meter!'], ['Dada, {d} la sodhal ka?', 'Bro, can you drop me at {d}?'],
    ['{d}, lavkar please. Late hotay.', '{d}, quickly please. I am late.'], ['Meter taka, {d} la chala.', 'Put the meter down, to {d}.']],
  crash: [['Arre baba! Haluu chalva!', 'Oh my! Drive slowly!'], ['Kay karta kaka?!', 'What are you doing, uncle?!'], ['Aai ga!', 'Oh mother!'], ['Bhai, jaan lena hai kya?', 'Want to kill me, brother?']],
  bump: [['Speed breaker disla nahi ka?', 'Didn’t you see the speed breaker?'], ['Haluu! Paath dukhte maajhi.', 'Slowly! My back hurts.'], ['Khadda! Khadda!', 'Pothole! Pothole!']],
  lift: [['Arre arre arre!', 'Whoa whoa whoa!'], ['Don chaakavar chalavtay ka?!', 'Driving on two wheels, are we?!']],
  tip: [['AAI GA!', 'OH MOTHER!'], ['Mi utarto ithech!', 'I am getting off right here!']],
  footpath: [['Footpath var kashala?', 'Why on the footpath?'], ['Lok chaltat tithe, kaka!', 'People walk there, uncle!']],
  wrong: [['Ulta ka chalavtay?', 'Why are you driving the wrong way?'], ['One-way aahe na ha!', 'This is a one-way!']],
  late: [['Kaka, ajun kiti vel?', 'Uncle, how much longer?'], ['Shortcut ghya na!', 'Take a shortcut!'], ['Meeting suru zali asel...', 'My meeting must have started…']],
  ped: [['Arre, manus hota to!', 'Hey, that was a person!'], ['Bagha jara!', 'Watch it!']],
  near: [['Ithech thambva.', 'Stop right here.'], ['Ha, ithe ithe!', 'Yes, here, here!'], ['Pudhe gate pashi.', 'Up ahead, by the gate.']],
  happy: [['Mast chalavli! Thank you.', 'Great driving! Thank you.'], ['Chhan! Theva sutte.', 'Lovely! Keep the change.']],
  meh: [['Theek aahe. Ghya.', 'Alright. Here.'], ['Hmm. Paise ghya.', 'Hmm. Take the money.']],
  angry: [['Punha tumchya auto madhe nahi basnaar!', 'Never sitting in your auto again!'], ['Ekdam kharab!', 'Absolutely terrible!']],
};
const NAMES_F = ['Mrs. Kulkarni', 'Sneha', 'Priya', 'Deshpande aaji', 'Ananya', 'Neha', 'Meera', 'Gauri'];
const NAMES_M = ['Aditya', 'Joshi kaka', 'Rohan', 'Sameer', 'Patil saheb', 'Omkar', 'Farhan'];
L.gaveup = [['Bas, mi dusri rickshaw gheto.', 'Forget it, I\u2019ll take another auto.']];
L.board = [['Chala.', 'Let’s go.'], ['Thank you dada.', 'Thanks bro.'], ['Haan, chalo.', 'Yes, let’s go.']];
// a few lines change with the speaker's gender in Marathi
const FEM = { 'Mi utarto ithech!': 'Mi utarte ithech!', 'Bas, mi dusri rickshaw gheto.': 'Bas, mi dusri rickshaw ghete.' };

function pick(rng, arr) { return arr[Math.floor(rng.next() * arr.length)]; }

export class Rides {
  constructor(game) {
    this.g = game; this.W = game.W; this.rng = new RNG(2026);
    this.enabled = true;
    this.offers = [];
    this.current = null;
    this.routePts = null;
    this.cool = 0;
    this.dests = this.buildDestinations();
    this.lineCool = 0;
    // world markers: beacon at the destination, a floating rupee over waiting passengers
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 20, 1, true), beaconMat);
    this.beacon.visible = false;
    game.scene.add(this.beacon);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x3ddc84, toneMapped: false });
    this.pinGeo = new THREE.OctahedronGeometry(0.35, 0);
    this.pins = [0, 1, 2].map(() => { const m = new THREE.Mesh(this.pinGeo, pinMat); m.visible = false; game.scene.add(m); return m; });
  }

  buildDestinations() {
    const W = this.W, out = [];
    const good = /College|School|Hospital|Mandir|Ganpati|Ganapati|Chowk|Theatre|Rangmandir|Talkies|Library|Station|Garden|Udyan|Park|Gymkhana|Peth|Police|Post Office|Multiplex|Market|Bazaar|Hall|Hostel|Bank/i;
    for (const p of W.M.pois) {
      const [name, mr, x, z, kind, ei, par] = p;
      if (!good.test(name) || name.length > 34) continue;
      if (!/^[A-Z]/.test(name)) continue;
      const e = W.graph.edges[ei];
      if (!e) continue;
      out.push({ name, mr, x: x / 100, z: z / 100, e, s: par * e.len });
    }
    return out;
  }

  markers() {
    const m = [];
    for (const o of this.offers) m.push({ kind: 'pax', x: o.p.x, z: o.p.z });
    if (this.current && this.current.state === 'onboard') m.push({ kind: 'dest', x: this.current.dest.x, z: this.current.dest.z });
    return m;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) { for (const o of this.offers) this.g.people.remove(o.p); this.offers = []; this.current = null; this.routePts = null; }
  }

  // ---------------------------------------------------------------- offers
  spawnOffer() {
    const P = this.g.player, G = this.W.graph, rng = this.rng;
    for (let t = 0; t < 25; t++) {
      const e = G.edges[Math.floor(rng.next() * G.edges.length)];
      if (e.rank < 2 || e.rank > 5 || e.len < 25) continue;
      const s = rng.range(8, e.len - 8);
      const tmp = G.at(e, s);
      const d = Math.hypot(tmp[0] - P.x, tmp[1] - P.z);
      if (d < 70 || d > 330) continue;
      if (this.offers.some(o => Math.hypot(o.p.x - tmp[0], o.p.z - tmp[1]) < 60)) continue;
      // stand at the kerb (left side for two-way roads, either side for one-ways)
      const side = e.oneway ? (rng.chance(0.5) ? 1 : -1) : 1;
      const p = this.g.people.spawnPassenger(e, s, side);
      p.lat = side * (e.w / 2 + 0.25); p.latT = p.lat;
      this.g.people.place(p);
      // who's waving: their own way of talking, and the kind of place they're usually going
      const persona = pick(rng, p.female ? PERS_F : PERS_M);
      const who = PAX._who[persona];
      p.persona = persona;
      const dest = this.pickDest(tmp[0], tmp[1], who && new RegExp(who.dest, 'i'));
      if (!dest) { this.g.people.remove(p); return; }
      this.offers.push({ p, dest, fem: !!p.female, persona, name: who ? pick(rng, who.names) : pick(rng, p.female ? NAMES_F : NAMES_M), t: 0, life: rng.range(110, 200) });
      return;
    }
  }
  pickDest(x, z, like) {
    let best = null;
    for (let t = 0; t < 40; t++) {
      const d = this.dests[Math.floor(this.rng.next() * this.dests.length)];
      const dist = Math.hypot(d.x - x, d.z - z);
      if (like && t < 25 && !like.test(d.name)) continue;
      if (dist > 450 && dist < 1900) return d;
      if (!best || Math.abs(dist - 900) < Math.abs(Math.hypot(best.x - x, best.z - z) - 900)) best = d;
    }
    return best;
  }

  update(dt) {
    if (!this.enabled) return;
    const g = this.g, P = g.player;
    this.lineCool -= dt;
    // keep 3 offers around while empty
    if (!this.current) {
      this.cool -= dt;
      if (this.offers.length < 3 && this.cool <= 0) { this.spawnOffer(); this.cool = 2; }
    }
    // expire far / old offers
    for (let i = this.offers.length - 1; i >= 0; i--) {
      const o = this.offers[i];
      o.t += dt;
      const d = Math.hypot(o.p.x - P.x, o.p.z - P.z);
      if ((o.t > o.life && d > 60) || d > 480) { g.people.remove(o.p); this.offers.splice(i, 1); }
    }
    // pick-up
    if (!this.current) {
      for (const o of this.offers) {
        const d = Math.hypot(o.p.x - P.x, o.p.z - P.z);
        if (!P.inAnyAuto) continue;                  // only an auto picks up passengers
        if (d < 7.5 && Math.abs(P.v) < 1.6 && !P.tipped) { this.board(o); break; }
        if (d < 25 && !o.greeted && Math.abs(P.v) < 7) {
          o.greeted = true;
          const hl = o.persona && PAX[o.persona] && PAX[o.persona].hail;
          if (hl) {
            const [, roman, en] = hl[0];
            g.hud.say(o.name, `${roman} · ${o.dest.name}`, `${en} (${o.dest.name})`);
            this.voice(null, 0, o.fem, o.p, `q_${o.persona}_hail0`);
          } else {
            const [l, tr] = pick(this.rng, L.hail);
            g.hud.say(o.name, l.replace('{d}', o.dest.name), tr.replace('{d}', o.dest.name));
            this.voice('call', this.rng.int(0, 2), o.fem, o.p);
          }
        }
      }
    }
    const c = this.current;
    if (c && c.state === 'boarding') {
      c.t += dt;
      if (c.t > 1.1) { c.state = 'onboard'; P.setPassengers(1); g.audio.chime(); g.hud.toast('METER DOWN', `To ${c.dest.name}`, 'meter', 2.2); }
    }
    if (c && c.state === 'onboard' && !P.inAnyAuto) {
      // you walked off mid-ride: the passenger waits, then gives up
      c.outT = (c.outT || 0) + dt;
      if (c.outT > 25 && !c.gaveUp) {
        c.gaveUp = true;
        this.speak(c, 'gaveup', 0);
        P.setPassengers(0);
        this.current = null;
        this.stats && (this.stats.cancelled = (this.stats.cancelled || 0) + 1);
        g.stats.starSum += 1; g.stats.rides += 1; g.stats.rating = g.stats.starSum / g.stats.rides;
      }
    } else if (c && c.state === 'onboard') {
      c.outT = 0;
      c.elapsed += dt;
      c.dist += Math.abs(P.v) * dt;
      c.fare = fareFor(c.dist, g.hour);
      // reroute every few seconds
      c.rt -= dt;
      if (c.rt <= 0) { this.reroute(); c.rt = 2.5; }
      // complaints
      if (P.onFootpath && Math.abs(P.v) > 2) { c.mood -= dt * 0.025; this.line('footpath', 0.4 * dt); }
      if (c.elapsed > c.limit && !c.lateSaid) { c.lateSaid = true; this.line('late', 1); }
      if (c.elapsed > c.limit) c.mood -= dt * 0.004;
      const dd = Math.hypot(c.dest.x - P.x, c.dest.z - P.z);
      if (dd < 60 && !c.nearSaid) { c.nearSaid = true; this.line('near', 1); }
      // small talk on the way, if you're not scaring them
      c.chatT -= dt;
      if (c.chatT <= 0 && c.chats < 2 && c.mood > 0.6 && dd > 150 && this.lineCool <= 0) { c.chatT = 22 + this.rng.range(0, 15); c.chats++; this.line('chat', 1); }
      if (dd < 13 && Math.abs(P.v) < 1.8 && !P.tipped) this.dropOff();
    }
    // markers
    this.beacon.visible = !!(c && c.state === 'onboard');
    if (this.beacon.visible) {
      this.beacon.position.set(c.dest.x, 30, c.dest.z);
      this.beacon.material.opacity = 0.18 + 0.1 * Math.sin(performance.now() / 300) + (1 - g.W.sky.state.night) * 0.05;
    }
    this.pins.forEach((m, i) => {
      const o = this.offers[i];
      m.visible = !!o && !this.current;
      if (o) { m.position.set(o.p.x, 2.55 + Math.sin(performance.now() / 260 + i) * 0.12, o.p.z); m.rotation.y += dt * 2; }
    });
  }

  board(o) {
    const g = this.g;
    this.offers.splice(this.offers.indexOf(o), 1);
    // remaining waving passengers stop waving
    for (const x of this.offers) g.people.remove(x.p);
    this.offers = [];
    g.people.remove(o.p);
    const P = g.player;
    this.current = { state: 'boarding', t: 0, dest: o.dest, name: o.name, fem: o.fem, persona: o.persona, fare: TARIFF.base, dist: 0, elapsed: 0, mood: 1, rt: 0, limit: 60, chats: 0, chatT: 10 + this.rng.range(0, 10) };
    this.reroute(true);
    const c = this.current;
    c.limit = 45 + (c.routeLen || 1000) / 6.2;
    this.speak(this.current, 'board', -1, 3);
    void P;
  }
  reroute(first) {
    const g = this.g, P = g.player, G = this.W.graph, c = this.current;
    const from = G.nearest(P.x, P.z, 60, e => e.rank >= 2);
    if (!from) return;
    const to = { e: c.dest.e, s: c.dest.s };
    const r = G.route(from, to, false) || G.route(from, to, true);
    if (!r) return;
    this.routePts = G.routePolyline(r, from, to);
    if (first) c.routeLen = r.cost;
  }
  dropOff() {
    const g = this.g, c = this.current;
    const fare = Math.round(c.fare);
    const onTime = c.elapsed <= c.limit;
    const mood = clamp(c.mood + (onTime ? 0.1 : -0.15), 0, 1.1);
    const stars = clamp(Math.round(1 + mood * 4.2), 1, 5);
    let tip = mood > 0.85 ? Math.round(fare * (onTime ? 0.2 : 0.1) / 5) * 5 + 5 : mood > 0.6 ? 5 : 0;
    // a speaker, leopard seat covers, a box of bakarwadi offered on the way: it all adds up
    const L = g.life, U = L ? L.s.upg : {};
    if (tip) tip = Math.round(tip * (1 + (U.speaker ? 0.15 : 0) + (U.seat ? 0.05 : 0)) / 5) * 5;
    if (L && mood > 0.5) {
      const gift = ['shrewsbury', 'barfi', 'bakarwadi', 'gajra'].find(id => L.has(id));
      if (gift) { L.take(gift); const extra = { shrewsbury: 45, barfi: 50, bakarwadi: 40, gajra: 20 }[gift]; tip += extra; g.hud.toast('You offered them something sweet', `+₹${extra} on the tip, and a smile`, 'good', 2.6); }
      L.change('respect', stars >= 5 ? 0.5 : 0); L.change('mood', 0.02);
    }
    g.stats.money += fare + tip;
    g.stats.rides += 1;
    g.stats.starSum += stars;
    g.stats.rating = g.stats.starSum / g.stats.rides;
    g.audio.cash();
    g.hud.toast(`+₹${fare}${tip ? ` · ₹${tip} tip` : ''}`, '★'.repeat(stars) + '☆'.repeat(5 - stars) + `  ${(c.dist / 1000).toFixed(1)} km`, 'money', 3.4);
    const kind = mood > 0.8 ? 'happy' : mood > 0.45 ? 'meh' : 'angry';
    this.speak(c, kind, -1, 3.5);
    g.player.setPassengers(0);
    this.current = null; this.routePts = null;
    this.cool = 3;
    g.saveStats();
  }

  // ---------------------------------------------------------------- reactions (from game events)
  line(kind, prob = 1) {
    const c = this.current;
    if (!c || c.state !== 'onboard' || this.lineCool > 0 || this.rng.next() > prob) return;
    this.speak(c, kind, -1);
    this.lineCool = 3.5;
  }
  // subtitle + recorded voice (male / female version of the same line)
  // the passenger's own line for this moment (persona voice), never the same one twice in a row
  speak(c, kind, i, life = 4.5) {
    const arr = c.persona && PAX[c.persona] && PAX[c.persona][kind];
    if (arr && arr.length) {
      let k = i >= 0 && i < arr.length ? i : Math.floor(this.rng.next() * arr.length);
      this.last = this.last || {};
      if (arr.length > 1 && this.last[kind] === k) k = (k + 1) % arr.length;
      this.last[kind] = k;
      const [, roman, en] = arr[k];
      if (!this.voice(null, 0, c.fem, null, `q_${c.persona}_${kind}${k}`) && kind === 'chat') return;
      this.g.hud.say(c.name, roman, en, life);
      return;
    }
    if (!L[kind]) return;
    const j = i >= 0 && i < L[kind].length ? i : this.rng.int(0, L[kind].length - 1);
    const [l0, tr] = L[kind][j];
    const l = c.fem && FEM[l0] ? FEM[l0] : l0;
    this.g.hud.say(c.name, l, tr, life);
    this.voice(kind, j, c.fem);
  }
  voice(kind, i, fem, src, id) {
    const A = this.g.audio, P = this.g.player;
    let vol = 0.95, pan = 0;
    if (src) { const d = Math.hypot(src.x - P.x, src.z - P.z); vol = Math.min(1, 14 / (d + 6)); }
    return A.voice(id || `p_${kind}${i}_${fem ? 'f' : 'm'}`, vol, pan, false, /_chat\d+$/.test(id || '') ? 0 : /_(crash|bump|near|footpath|wrong|ped|late)\d+$/.test(id || '') ? 1 : 2);
  }
  onEvent(ev) {
    const c = this.current;
    if (!c || c.state !== 'onboard') return;
    if (ev.type === 'crash') { c.mood -= Math.min(0.35, ev.speed * 0.05); this.line('crash'); }
    else if (ev.type === 'hit' || ev.type === 'knock') { c.mood -= 0.15; this.line('crash'); }
    else if (ev.type === 'bump' && ev.strength > 0.5) { c.mood -= Math.min(0.15, ev.strength * 0.05); this.line('bump', 0.7); }
    else if (ev.type === 'lift') { c.mood -= 0.08; this.line('lift'); }
    else if (ev.type === 'tip') { c.mood -= 0.6; this.lineCool = 0; this.line('tip'); }
    else if (ev.type === 'pedHit') { c.mood -= 0.3; this.lineCool = 0; this.line('ped'); }
    else if (ev.type === 'wrongway') { c.mood -= 0.05; this.line('wrong', 0.6); }
  }
}
