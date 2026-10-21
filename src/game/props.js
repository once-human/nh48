// Six places you can buy, priced like the real thing for their street (late-2026 guesses from
// listing prices per square foot; treat them as ballpark): a chai tapri licence on FC Road up to a
// bungalow on Boat Club Road. Each pays rent every game day (scaled so a home pays for itself in a
// couple of weeks of play, not thirty years), and the homes are somewhere to sleep, change clothes
// and keep your vehicles. They show on the map (house pins) and in the backpack's "Own" tab, with
// a For Sale board on the street. Buy at the place itself, or from any estate agent.
import { fmt } from './shops.js';

export const PROPERTIES = [
  { id: 'tapri', name: 'Chai tapri licence, FC Road', area: 'Deccan Gymkhana', price: 450000, rent: 1500, home: false, sqft: 40,
    blurb: 'A corner stall outside a college gate. Students, cutting chai, cash every day.' },
  { id: 'rk', name: '1 RK, Sadashiv Peth', area: 'Sadashiv Peth', price: 2800000, rent: 3000, home: true, sqft: 260,
    blurb: 'One room and a kitchen in an old wada lane. Temple bells at six.' },
  { id: 'gala', name: 'Shop gala, Laxmi Road', area: 'Budhwar Peth', price: 6500000, rent: 15000, home: false, sqft: 180,
    blurb: 'A ground-floor shop on Pune’s busiest shopping street. Rent it to a saree shop.' },
  { id: '2bhk', name: '2 BHK, Model Colony', area: 'Model Colony', price: 14500000, rent: 13000, home: true, sqft: 950,
    blurb: 'Third floor, lift, covered parking, a balcony over a gulmohar.' },
  { id: '3bhk', name: '3 BHK, Koregaon Park Lane 6', area: 'Koregaon Park', price: 32000000, rent: 28000, home: true, sqft: 1650,
    blurb: 'Leafy lane, cafés downstairs, a society gym. KP living.' },
  { id: 'bungalow', name: 'Bungalow, Boat Club Road', area: 'Boat Club Road', price: 120000000, rent: 100000, home: true, sqft: 4800,
    blurb: 'Old-money Pune: a garden, a gate, a watchman and a mango tree.' },
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
  label(p) { return this.owned(p) ? `${p.name} · yours` : `For sale: ${p.name} · ${fmt(p.price)}`; }
  // at the place itself
  items(out, p) {
    const G = this.g, L = this.life;
    if (!this.owned(p)) {
      out.push({ label: `Buy it, ${fmt(p.price)}`, note: `${p.sqft} sq ft · rent ${fmt(p.rent)} a day${p.home ? ' · a home: sleep, wardrobe, garage' : ''}. Cash and bank together`, price: p.price, act: () => this.buy(p) });
      return;
    }
    if (p.home) {
      out.push({ label: 'Sleep till morning', note: 'Full energy and health, wake at 7 AM', price: 0, act: () => { G.shops.close(); G.sleep(); return ''; } });
      out.push({ label: 'Have a home-cooked meal', note: 'Varan bhaat, toop, limbu. Free', price: 0, act: () => { L.apply({ hunger: 0.6, thirst: 0.3, mood: 0.06 }); return 'Aai would approve'; } });
      out.push({ label: 'Wardrobe', note: `${L.s.wardrobe.filter(w => !w.startsWith('shoe_')).length} outfits, open your backpack (E) to change`, price: 0, act: () => { G.shops.close(); G.bag && G.bag.show('wear'); return ''; } });
      const missing = L.s.vehicles.filter(v => !G.player.dropped.some(d => d.veh.owned && d.veh.owned.id === v.id) && !(G.player.cur && G.player.cur.owned && G.player.cur.owned.id === v.id));
      for (const v of missing) out.push({ label: `Bring out your ${v.type}`, note: 'From the parking downstairs', price: 0, act: () => { G.shops.respawnOwned(v, p); return 'It’s outside'; } });
    }
    out.push({ label: `Sell it, ${fmt(Math.round(p.price * 0.92))}`, note: 'A buyer is ready; the broker keeps 8%', price: 0, act: () => this.sell(p) });
  }
  // at an estate agent: everything on the market
  agentItems(out) {
    for (const p of this.list) {
      const own = this.owned(p);
      out.push({ label: p.name, note: own ? 'Yours' : `${fmt(p.price)} · ${p.sqft} sq ft · rent ${fmt(p.rent)}/day, tap to see it on the map`, price: 0, tag: own ? 'owned' : '',
        act: () => { this.g.setWaypoint({ x: p.x, z: p.z, name: p.name }); return `Waypoint set: ${p.name}. The For Sale board is on the footpath`; } });
    }
  }
  buy(p) {
    const G = this.g, L = this.life;
    if (!G.shops.spend(p.price, true)) return false;
    L.s.props.push(p.id); L.change('respect', 6 + Math.round(Math.log10(p.price) - 5) * 3); L.save();
    G.hud.flash(p.name, 'It’s yours. Rent arrives every morning.');
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
    for (const p of this.list) if (this.owned(p)) tot += p.rent;
    if (L.s.bank > 0) { const int = Math.round(L.s.bank * 0.004); L.s.bank += int; if (int) G.hud.sms('Bank', `Interest credited: ${fmt(int)}`, fmt(int), `Balance ${fmt(L.s.bank)}`); }
    if (!tot) return;
    L.s.bank += tot; L.s.tally.rentEarned += tot; L.save();
    G.hud.sms('Rent', `Your tenants paid ${fmt(tot)} into your bank account.`, fmt(tot), 'Withdraw at any bank or ATM');
  }
  markers() { return this.list.map(p => ({ x: p.x, z: p.z, kind: 'prop', label: this.owned(p) ? 'Home' : 'For sale', owned: this.owned(p) })); }
}
