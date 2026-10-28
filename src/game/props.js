// Six homes you can buy, priced like the real thing for their street (late-2026 guesses from
// listing prices per square foot; treat them as ballpark): a 1 RK in Sadashiv Peth up to a
// bungalow on Boat Club Road. Live in one (sleep, wardrobe, your vehicles kept there) or rent it out. Each pays rent every game day (scaled so a home pays for itself in a
// couple of weeks of play, not thirty years), and the homes are somewhere to sleep, change clothes
// and keep your vehicles. They show on the map (house pins) and in the backpack's "Own" tab, with
// a For Sale board on the street. Buy at the place itself, or from any estate agent.
import { fmt } from './shops.js';

export const PROPERTIES = [
  { id: 'rk', name: '1 RK, Sadashiv Peth', kind: 'Studio', area: 'Sadashiv Peth', price: 2800000, rent: 3000, sqft: 260,
    blurb: 'One room and a kitchen in an old wada lane. Temple bells at six, the best misal two lanes away.' },
  { id: '1bhk', name: '1 BHK flat, Erandwane', kind: 'Flat', area: 'Erandwane', price: 6800000, rent: 6500, sqft: 560,
    blurb: 'Second floor of a 90s society. A balcony, a gas pipeline, a watchman who knows everyone.' },
  { id: '2bhk', name: '2 BHK flat, Model Colony', kind: 'Flat', area: 'Model Colony', price: 14500000, rent: 13000, sqft: 950,
    blurb: 'Third floor, lift, covered parking, a balcony over a gulmohar.' },
  { id: '3bhk', name: '3 BHK flat, Koregaon Park', kind: 'Flat', area: 'Koregaon Park', price: 32000000, rent: 28000, sqft: 1650,
    blurb: 'Leafy lane, cafés downstairs, a society gym and a pool nobody uses.' },
  { id: 'rowhouse', name: 'Row house, Prabhat Road', kind: 'House', area: 'Prabhat Road', price: 52000000, rent: 42000, sqft: 2400,
    blurb: 'Three floors, a terrace, a little garden in front. Old Pune money on a quiet lane.' },
  { id: 'bungalow', name: 'Bungalow, Boat Club Road', kind: 'Bungalow', area: 'Boat Club Road', price: 120000000, rent: 100000, sqft: 4800,
    blurb: 'A garden, a gate, a watchman and a mango tree. The address people lower their voice for.' },
];

export class Props {
  constructor(G) {
    this.g = G;
    this.list = [];
    const A = G.people.areas.list;
    for (const p of PROPERTIES) {
      const a = A.find(q => q.name === p.area);
      if (!a) continue;
      // on a quiet street near the area's centre, on the footpath (deterministic per property)
      const ang = (p.id.charCodeAt(0) * 37 + p.id.length * 11) % 360 * Math.PI / 180;
      const spot = G.safeDrop(a.x + Math.cos(ang) * 120, a.z + Math.sin(ang) * 120);
      if (spot) this.list.push({ ...p, x: spot.x, z: spot.z, th: spot.th });
    }
  }
  get life() { return this.g.life; }
  owned(p) { return this.life.s.props.includes(p.id); }
  near(x, z, r) {
    let best = null, bd = r;
    for (const p of this.list) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  label(p) { return this.owned(p) ? `Your home · ${p.name}` : `For sale: ${p.name} · ${fmt(p.price)}`; }
  // at the place itself
  items(out, p) {
    const G = this.g, L = this.life;
    if (!this.owned(p)) {
      out.push({ label: `Buy it for ${fmt(p.price)}`, note: `${p.kind} · ${p.sqft} sq ft · stamp duty and registration included. Cash and bank together`, price: p.price, act: () => this.buy(p) });
      out.push({ label: 'Look around', note: p.blurb, price: 0, disabled: ' ' });
      return;
    }
    const rented = this.rentedOut(p);
    if (!rented) {
      out.push({ label: 'Sleep till morning', note: 'Full energy and health, wake at 7 AM. Saves you a lodge', price: 0, act: () => { G.shops.close(); G.sleep(); return ''; } });
      out.push({ label: 'Eat at home', note: 'Varan bhaat, toop, limbu. Free: the kitchen is stocked', price: 0, act: () => { L.apply({ hunger: 0.7, thirst: 0.2, mood: 0.06 }); return 'Aai would approve'; } });
      out.push({ label: 'Water from the filter', note: 'A glass now and a bottle for the road. Free', price: 0, act: () => { L.apply({ thirst: 0.6 }); L.add('water'); return 'A bottle in your jhola'; } });
      out.push({ label: 'Wardrobe', note: 'Change into anything you own', price: 0, act: () => { G.shops.close(); G.bag && G.bag.show('wear'); return ''; } });
      const missing = L.s.vehicles.filter(v => !G.player.dropped.some(d => d.veh.owned && d.veh.owned.id === v.id) && !(G.player.cur && G.player.cur.owned && G.player.cur.owned.id === v.id));
      for (const v of missing) out.push({ label: `Bring out your ${v.type}`, note: 'From the parking downstairs', price: 0, act: () => { G.shops.respawnOwned(v, p); return 'It’s outside'; } });
      // park what you own (and rode here) in the garage: safe from towing, theft and the rain
      for (const d of G.player.dropped) {
        const o = d.veh.owned; if (!o || o.rental || d.veh === G.player.cur || Math.hypot(d.veh.x - p.x, d.veh.z - p.z) > 45) continue;
        const rec = L.s.vehicles.find(q => q.id === o.id); if (!rec) continue;
        out.push({ label: `Park your ${rec.type} in the garage`, note: `${rec.plate} · safe from tow trucks and thieves`, price: 0, act: () => { rec.fuel = d.veh.fuel; G.player.removeDropped(d, G.traffic); d.veh.dispose(); L.save(); return 'Locked away downstairs'; } });
      }
      out.push({ label: `Rent it out for ${fmt(p.rent)} a day`, note: 'Tenants move in. You can’t sleep here while they do', price: 0, act: () => { L.s.rented = (L.s.rented || []).concat([p.id]); L.save(); return 'Tenants found. Rent goes to your bank every morning'; } });
    } else out.push({ label: 'Ask the tenants to leave', note: `They pay ${fmt(p.rent)} a day. Move back in yourself`, price: 0, act: () => { L.s.rented = (L.s.rented || []).filter(q => q !== p.id); L.save(); return 'They’ll be out by tonight. It’s yours again'; } });
    out.push({ label: `Sell it for ${fmt(Math.round(p.price * 0.92))}`, note: 'A buyer is ready; the broker keeps 8%', price: 0, act: () => this.sell(p) });
  }
  rentedOut(p) { return (this.life.s.rented || []).includes(p.id); }
  // at an estate agent: everything on the market
  agentItems(out) {
    for (const p of this.list) {
      const own = this.owned(p);
      out.push({ label: p.name, note: own ? 'Yours' : `${p.kind} · ${fmt(p.price)} · ${p.sqft} sq ft. Shows it on your map`, price: 0, tag: own ? 'owned' : '',
        act: () => { this.g.setWaypoint({ x: p.x, z: p.z, name: p.name }); return `Waypoint set: ${p.name}. The For Sale board is on the footpath`; } });
    }
  }
  buy(p) {
    const G = this.g, L = this.life;
    if (!G.shops.spend(p.price, true)) return false;
    L.s.props.push(p.id); L.change('respect', 6 + Math.round(Math.log10(p.price) - 5) * 3); L.save();
    G.hud.flash(p.name, 'It’s yours. Sleep here, keep your clothes and vehicles here, or rent it out.');
    return `Bought. Welcome home`;
  }
  sell(p) {
    const G = this.g, L = this.life;
    L.s.props = L.s.props.filter(q => q !== p.id);
    G.stats.money += Math.round(p.price * 0.92); G.saveStats(); G.audio.cash(); L.save();
    return `Sold for ${fmt(Math.round(p.price * 0.92))}`;
  }
  payRent() {
    const G = this.g, L = this.life;
    let tot = 0;
    for (const p of this.list) if (this.owned(p) && this.rentedOut(p)) tot += p.rent;
    if (L.s.bank > 0) { const int = Math.round(L.s.bank * 0.004); L.s.bank += int; if (int) G.hud.sms('Bank', `Interest credited: ${fmt(int)}`, fmt(int), `Balance ${fmt(L.s.bank)}`); }
    // society maintenance on every home you own: a share of its value per day, and more per home the more you hold
    const own = this.list.filter(p => this.owned(p));
    if (own.length) {
      const mult = 1 + 0.2 * (own.length - 1);
      const fee = Math.round(own.reduce((a, p) => a + p.price * 0.00008, 0) * mult / 10) * 10;
      let left = fee; const fromBank = Math.min(L.s.bank || 0, left); L.s.bank -= fromBank; left -= fromBank;
      const fromCash = Math.min(G.stats.money, left); G.stats.money -= fromCash; left -= fromCash; G.saveStats();
      if (left > 0) { L.change('mood', -0.05); G.hud.sms('Society', `Maintenance of ${fmt(fee)} is overdue on your ${own.length > 1 ? own.length + ' homes' : 'home'}. ${fmt(left)} unpaid.`, fmt(fee), 'Pay up or the secretary will talk'); }
      else G.hud.sms('Society', `Maintenance for ${own.length > 1 ? own.length + ' homes' : own[0].name}: ${fmt(fee)} debited.`, fmt(fee), own.length > 1 ? `${Math.round((mult - 1) * 100)}% extra for owning ${own.length}` : 'Lift, watchman, water tanker');
      L.save();
    }
    if (!tot) return;
    L.s.bank += tot; L.s.tally.rentEarned += tot; L.save();
    G.hud.sms('Rent', `Your tenants paid ${fmt(tot)} into your bank account.`, fmt(tot), 'Withdraw at any bank or ATM');
  }
  markers() { return this.list.map(p => ({ x: p.x, z: p.z, kind: 'prop', label: this.owned(p) ? 'Home' : 'For sale', owned: this.owned(p) })); }
}
