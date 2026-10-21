// More ways to make money, straight and otherwise.
//   Businesses   buy a vada pav stall, a chai tapri, an auto fleet, a xerox and cyber café, an
//                ironing and laundry shop, a cloud kitchen, a PG near the colleges or a café in
//                Koregaon Park from any estate agent. Takings land in your bank every morning;
//                some days are bad, festivals are good, and you can sell up any time.
//   Chop shops   some garages buy a vehicle with no questions asked (about 15% of what it's worth).
//                Drive a stolen one in and the mechanic makes an offer. The owner may still report it.
//   Pickpocket   G next to someone on foot. Behind them and in a crowd works best; get caught and
//                they shout, fight, and if a cop hears it you're wanted (BNS s.303).
//   Parcels      late at night "Bhai" texts: pick up a parcel and drop it across town, no questions.
//                Good money; if the police stop you while you carry it, it's stolen property (BNS s.317).
//   Races        after 11 pm someone texts a race: be at the start in a vehicle, pay the entry, beat
//                the time to the finish and take double. Racing on a public road is MV Act s.189.
import { RNG } from '../core/util.js';
import { fmt } from './shops.js';

export const BUSINESSES = [
  { id: 'chai', name: 'Chai tapri at a bus stop', price: 80000, day: 700, note: 'Cutting chai and bun maska from 6 am' },
  { id: 'vadapav', name: 'Vada pav stall near a college', price: 150000, day: 1300, note: 'Students, lunch rush, exam weeks are gold' },
  { id: 'laundry', name: 'Ironing and laundry shop', price: 120000, day: 650, note: 'Steady, boring, never closes' },
  { id: 'xerox', name: 'Xerox and cyber café', price: 300000, day: 1100, note: 'Forms, printouts, exam season rush' },
  { id: 'autos', name: 'Auto fleet: three rickshaws on daily rent', price: 450000, day: 1400, note: 'Drivers pay ₹500 a day each, minus repairs' },
  { id: 'kitchen', name: 'Cloud kitchen in Baner', price: 800000, day: 3000, note: 'Biryani and thalis on the delivery apps' },
  { id: 'pg', name: 'Paying guest house in Viman Nagar', price: 6000000, day: 9000, note: 'Twelve beds, students and freshers' },
  { id: 'cafe', name: 'Café in Koregaon Park', price: 4000000, day: 12000, note: 'Weekends pay for the weekdays' },
];
const VALUE = { scooter: 85000, bike: 110000, moto: 110000, hatch: 650000, sedan: 900000, suv: 1600000, auto: 280000, truck: 1200000, tempo: 700000 };
const BHAI = ['Bhai', 'Pappu Bhai', 'Dada (unknown number)', 'Sheru'];

export class Hustle {
  constructor(G) { this.g = G; this.rng = new RNG(6262); this.offer = null; this.job = null; this.race = null; this.pingT = 120; }
  get life() { return this.g.life; }
  get owned() { return this.life.s.biz || (this.life.s.biz = []); }

  // ---------------------------------------------------------------- businesses
  agentItems(out) {
    for (const b of BUSINESSES) {
      const own = this.owned.includes(b.id);
      out.push({ label: b.name, note: own ? `Yours · about ${fmt(b.day)} a day · sell for ${fmt(Math.round(b.price * 0.85))}` : `${b.note} · about ${fmt(b.day)} a day`, price: own ? 0 : b.price, tag: own ? 'owned' : '',
        act: () => own ? this.sell(b) : this.buy(b) });
    }
  }
  buy(b) {
    const G = this.g, L = this.life;
    if (!G.shops.spend(b.price, true)) return false;
    this.owned.push(b.id); L.change('respect', 3); L.save();
    G.hud.flash(b.name, 'It’s yours. Takings go to your bank every morning');
    return 'Bought. The keys and the books are yours';
  }
  sell(b) {
    const G = this.g, L = this.life;
    L.s.biz = this.owned.filter(x => x !== b.id);
    G.stats.money += Math.round(b.price * 0.85); G.saveStats(); G.audio.cash(); L.save();
    return `Sold for ${fmt(Math.round(b.price * 0.85))}`;
  }
  // every morning: what each place made yesterday
  daily() {
    const G = this.g, L = this.life;
    if (!this.owned.length) return;
    let tot = 0; const notes = [];
    for (const id of this.owned) {
      const b = BUSINESSES.find(x => x.id === id); if (!b) continue;
      const r = this.rng.next();
      let k = 0.7 + this.rng.next() * 0.6;
      if (r < 0.08) { k = 0.2; notes.push(`${b.name.split(' ')[0]}: a bad day`); }
      else if (r > 0.94) { k = 1.8; notes.push(`${b.name.split(' ')[0]}: a festival rush`); }
      tot += Math.round(b.day * k);
    }
    L.s.bank = (L.s.bank || 0) + tot; L.s.tally.bizEarned = (L.s.tally.bizEarned || 0) + tot; L.save();
    G.hud.sms('Your businesses', `Yesterday’s takings: ${fmt(tot)}, deposited.${notes.length ? ' ' + notes.join(', ') + '.' : ''}`, fmt(tot), `Bank ${fmt(L.s.bank)}`);
  }

  // ---------------------------------------------------------------- chop shop
  isChop(ctx) { let h = 0; for (const c of ctx.name || '') h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 3 === 0; }
  garageItems(out, ctx) {
    const G = this.g, P = G.player, v = !P.onFoot && P.cur;
    if (!v || !v.stolen) return;
    const price = Math.round((VALUE[v.type] || 100000) * 0.15 / 100) * 100;
    if (!this.isChop(ctx)) { out.unshift({ label: 'Sell this vehicle', note: 'He looks at the number plate, then at you', price: 0, disabled: 'Not here' }); return; }
    out.unshift({ label: 'Sell it, no questions asked', note: `The mechanic strips it tonight · the owner may still report it`, price: 0, tag: 'job',
      act: () => {
        P.abandon(G.traffic, true);
        G.stats.money += price; G.saveStats(); G.audio.cash();
        this.life.change('karma', -5); this.life.s.tally.chopped = (this.life.s.tally.chopped || 0) + 1;
        if (this.rng.next() < 0.2) G.later(30 + this.rng.next() * 60, () => G.police.raiseHeat(1, 'The owner traced the vehicle to the garage', 'theft'));
        return `Cash in hand: ${fmt(price)}`;
      } });
  }

  // ---------------------------------------------------------------- pickpocketing
  pickpocket() {
    const G = this.g, P = G.player, L = this.life;
    if (!P.onFoot || G.interiors.inside) return;
    let best = null, bd = 1.5;
    for (const p of G.people.list) { if (p.cop || p.mode === 'fight') continue; const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < bd) { bd = d; best = p; } }
    if (!best) { G.hud.toast('Nobody close enough', 'Get right next to someone (G)', 'info', 1.6); return; }
    const p = best;
    const behind = Math.cos(Math.atan2(P.z - p.z, P.x - p.x) - (p.yaw || 0)) < -0.2;
    let crowd = 0; for (const q of G.people.list) if (Math.hypot(q.x - P.x, q.z - P.z) < 6) crowd++;
    const chance = 0.35 + (behind ? 0.25 : 0) + Math.min(0.2, crowd * 0.03) - (L.s.drunk > 0.5 ? 0.2 : 0);
    if (this.rng.next() < chance) {
      const rich = /^kp/.test(p.persona || ''), amt = Math.round(this.rng.range(rich ? 300 : 40, rich ? 1800 : 600) / 10) * 10;
      G.stats.money += amt; G.saveStats(); L.change('karma', -4); L.s.tally.pickpocketed = (L.s.tally.pickpocketed || 0) + 1;
      G.hud.toast(`+${fmt(amt)}`, behind ? 'Clean. They didn’t feel a thing' : 'They didn’t notice. This time', 'money', 2.4);
      if (this.rng.next() < 0.25) G.later(8 + this.rng.next() * 12, () => G.people.speakAs && G.people.speakAs('scared', p, 1, 0));
    } else {
      L.change('karma', -2);
      G.hud.toast('Caught!', 'They grabbed your wrist. “Chor! Chor!”', 'bad', 2.6);
      G.people.speakAs && G.people.speakAs('fight', p, 1, 0);
      if (this.rng.next() < 0.5) G.people.startFight(p, P); else G.people.flee(p, P.x, P.z, 18);
      const cop = G.police.copSeeing && G.police.copSeeing(P.x, P.z, 60);
      if (cop || this.rng.next() < 0.3) G.police.raiseHeat(1, cop ? 'A cop saw you pickpocketing' : 'Someone called 112 about a pickpocket', 'pickpocket');
    }
  }

  // ---------------------------------------------------------------- night texts: parcels and races
  pickPoint(x, z, min, max, rank = 1) {
    const Gr = this.g.W.graph;
    for (let t = 0; t < 80; t++) {
      const e = Gr.edges[this.rng.int(0, Gr.edges.length - 1)];
      if (e.rank < rank || e.restricted || e.len < 30) continue;
      const p = Gr.at(e, e.len / 2), d = Math.hypot(p[0] - x, p[1] - z);
      if (d < min || d > max) continue;
      return { x: p[0], z: p[1], name: Gr.names[e.name] ? Gr.names[e.name][0] : '', e };
    }
    return null;
  }
  ping() {
    // parcel runs and race invites come through apps: a keypad phone doesn't get them
    if (!this.g.life.s.phone) return;
    const G = this.g, P = G.player, h = G.hour;
    if (this.job || this.race || this.offer) return;
    if (h >= 23 || h < 3) {
      if (this.rng.next() < 0.5) {
        const start = this.pickPoint(P.x, P.z, 300, 1200, 4), fin = start && this.pickPoint(start.x, start.z, 1500, 2600, 3);
        if (!fin) return;
        const entry = this.rng.pick([1000, 2000, 5000]);
        this.offer = { kind: 'race', start, fin, entry, t: 25 };
        G.hud.sms('Unknown number', `Race tonight. Start ${start.name || 'near you'}, finish ${fin.name || 'across town'}. ${fmt(entry)} to enter, winner takes ${fmt(entry * 2)}. Y if you're in.`, '', 'Racing on a public road: MV Act s.189');
        return;
      }
    }
    if (h >= 21 || h < 4) {
      const pick = this.pickPoint(P.x, P.z, 400, 1200), drop = pick && this.pickPoint(pick.x, pick.z, 1500, 3500);
      if (!drop) return;
      const pay = Math.round(this.rng.range(3000, 9000) / 500) * 500;
      this.offer = { kind: 'parcel', pick, drop, pay, t: 25, who: this.rng.pick(BHAI) };
      G.hud.sms(this.offer.who, `Ek parcel pohochva. ${pick.name || 'Near you'} la ghe, ${drop.name || 'across town'} la de. ${fmt(pay)}. Kahi vicharaycha naahi. Y?`, '', 'A parcel, no questions. If police stop you with it: BNS s.317');
    }
  }
  accept() {
    const G = this.g, o = this.offer;
    this.offer = null;
    if (o.kind === 'parcel') { this.job = { ...o, state: 'pick', t: 0 }; G.setWaypoint({ x: o.pick.x, z: o.pick.z, name: 'Pick up the parcel', gig: true }); G.hud.toast('Parcel run', 'Pick it up first. Keep away from nakabandis', 'warn', 3); }
    else { this.race = { ...o, state: 'go', t: 0 }; G.setWaypoint({ x: o.start.x, z: o.start.z, name: 'Race start', gig: true }); G.hud.toast('Race', `Be at the start in a vehicle. Entry ${fmt(o.entry)}`, 'warn', 3); }
  }
  update(dt, input) {
    const G = this.g, P = G.player, L = this.life;
    if (G.state !== 'play') return;
    if (input.took('KeyG')) this.pickpocket();
    if (this.offer) { this.offer.t -= dt; if (!(G.gigs && G.gigs.offer) && input.took('KeyY')) this.accept(); else if (this.offer && this.offer.t <= 0) this.offer = null; }
    if ((this.pingT -= dt) <= 0) { this.pingT = this.rng.range(150, 320); if (!G.interiors.inside) this.ping(); }
    const J = this.job;
    if (J) {
      J.t += dt;
      if (J.state === 'pick' && Math.hypot(J.pick.x - P.x, J.pick.z - P.z) < 12) { J.state = 'carry'; J.t = 0; G.setWaypoint({ x: J.drop.x, z: J.drop.z, name: 'Drop the parcel', gig: true }); G.hud.toast('Got the parcel', 'Don’t open it. Don’t get stopped', 'warn', 2.6); }
      else if (J.state === 'carry') {
        // stopped by the police with it on you
        if (G.police.stop && !J.checked) {
          J.checked = true;
          if (this.rng.next() < 0.55) {
            this.job = null; G.setWaypoint(null);
            G.police.charge('stolengoods', 10000, 'Carrying stolen property (a parcel)');
            G.hud.toast('They opened the parcel', 'Stolen phones. Carrying stolen property, BNS s.317 · ₹10,000', 'bad', 4);
            L.change('respect', -3);
            G.later(20, () => G.hud.sms(J.who, 'Parcel gela? Tujhyakadun vasool karto.', '', 'You lost his parcel'));
            return;
          }
        }
        if (Math.hypot(J.drop.x - P.x, J.drop.z - P.z) < 12) {
          this.job = null; G.setWaypoint(null);
          G.stats.money += J.pay; G.saveStats(); G.audio.cash(); L.change('karma', -3);
          L.s.tally.parcels = (L.s.tally.parcels || 0) + 1;
          G.hud.toast(`+${fmt(J.pay)}`, 'Someone took the parcel without a word', 'money', 3);
        } else if (J.t > 900) { this.job = null; G.setWaypoint(null); G.hud.sms(J.who, 'Khup ushir. Visar.', '', 'The parcel run is off'); }
      }
    }
    const R = this.race;
    if (R) {
      R.t += dt;
      if (R.state === 'go') {
        if (Math.hypot(R.start.x - P.x, R.start.z - P.z) < 25 && !P.onFoot && Math.abs(P.v) < 3) {
          if (!G.shops.spend(R.entry)) { this.race = null; G.setWaypoint(null); return; }
          const dist = Math.hypot(R.fin.x - R.start.x, R.fin.z - R.start.z) * 1.35;
          R.par = dist / ((P.cur && /hatch|suv|sedan/.test(P.cur.type) ? 17 : 15) * this.rng.range(0.92, 1.08));
          R.state = 'count'; R.t = 0;
          G.hud.flash('3 · 2 · 1', `Get to ${R.fin.name || 'the finish'} in ${Math.round(R.par)} s`);
        } else if (R.t > 600) { this.race = null; G.setWaypoint(null); }
      } else if (R.state === 'count' && R.t > 3) { R.state = 'race'; R.t = 0; G.setWaypoint({ x: R.fin.x, z: R.fin.z, name: 'Race finish', gig: true }); G.audio.whistle && G.audio.whistle(); }
      else if (R.state === 'race') {
        if (Math.hypot(R.fin.x - P.x, R.fin.z - P.z) < 18) {
          const won = R.t <= R.par;
          this.race = null; G.setWaypoint(null);
          if (won) { G.stats.money += R.entry * 2; G.saveStats(); G.audio.cash(); L.change('respect', 3); L.s.tally.racesWon = (L.s.tally.racesWon || 0) + 1; }
          G.hud.toast(won ? `You won · +${fmt(R.entry * 2)}` : 'Too slow', `${Math.round(R.t)} s against ${Math.round(R.par)} s`, won ? 'money' : 'bad', 3.4);
        } else if (R.t > R.par * 2.5) { this.race = null; G.setWaypoint(null); G.hud.toast('Race over', 'They finished long ago. Entry gone', 'bad', 2.6); }
      }
    }
  }
  objective() {
    const J = this.job, R = this.race;
    if (R) {
      if (R.state === 'go') return { main: 'Get to the race start', sub: `${R.start.name || ''} · in a vehicle · entry ${fmt(R.entry)}` };
      if (R.state === 'count') return { main: 'Ready…', sub: '', urgent: true };
      const left = R.par - R.t;
      return { main: `Race to ${R.fin.name || 'the finish'}`, sub: left > 0 ? `${Math.ceil(left)} s to beat` : 'Behind the time', urgent: true };
    }
    if (J) return J.state === 'pick' ? { main: 'Pick up the parcel', sub: J.pick.name || '' } : { main: 'Drop the parcel', sub: `${J.drop.name || ''} · ${fmt(J.pay)} · avoid the police`, urgent: true };
    return null;
  }
}
