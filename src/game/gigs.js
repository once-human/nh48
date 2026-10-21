// Zwiggy deliveries: take an order at a restaurant's counter (or, with a smartphone, accept one that
// pings you: Y), carry it to a flat somewhere across town on whatever you're riding (or on foot,
// if you like a challenge), and get paid on the doorstep, base + per km, a tip if it's still hot.
// The drop is a real street; the customer's name and area come from where it is.
import { RNG } from '../core/util.js';
import { fmt } from './shops.js';

const NAMES = ['Aditi', 'Rohan', 'Sneha', 'Kunal', 'Priya', 'Omkar', 'Neha', 'Siddharth', 'Rutuja', 'Aniket', 'Mrunal', 'Varun', 'Gauri', 'Tejas', 'Isha', 'Mr. Joshi', 'Mrs. Kulkarni', 'Parth', 'Shruti', 'Mihir'];
const FLATS = ['Flat 304', 'Flat 12, B wing', 'Row house 7', 'Flat 501', 'Bungalow no. 3', 'Flat 2, ground floor', 'Flat 902', 'Room 14 (PG)'];

export class Gigs {
  constructor(G) { this.g = G; this.rng = new RNG(8181); this.job = null; this.offer = null; this.pingT = 40; }
  get life() { return this.g.life; }
  // a drop 0.5–2.5 km away, on an ordinary residential street
  pickDrop(x, z) {
    const G = this.g.W.graph, r = this.rng;
    for (let t = 0; t < 80; t++) {
      const e = G.edges[r.int(0, G.edges.length - 1)];
      if (e.rank < 1 || e.rank > 3 || e.restricted || e.len < 20) continue;
      const p = G.at(e, e.len / 2), d = Math.hypot(p[0] - x, p[1] - z);
      if (d < 500 || d > 2500) continue;
      const lat = e.w / 2 + 1.2;
      const street = G.names[e.name] ? G.names[e.name][0] : '';
      const area = this.g.people.areas.at(p[0], p[1]);
      return { x: p[0] + p[3] * lat, z: p[1] - p[2] * lat, street, area: area ? area.name : '', d };
    }
    return null;
  }
  startAt(shop) {
    const G = this.g, P = G.player;
    const drop = this.pickDrop(shop.x, shop.z);
    if (!drop) { G.hud.toast('No orders right now', 'Try another place', 'warn', 2.4); return; }
    const km = drop.d * 1.3 / 1000;
    const pay = Math.round((28 + km * 14) / 5) * 5;
    const limit = drop.d * 1.3 / 6.5 + 70;            // seconds: about 23 km/h door to door
    this.job = { from: shop.name, to: drop, pay, limit, t: 0, who: this.rng.pick(NAMES), flat: this.rng.pick(FLATS), state: 'drop' };
    G.setWaypoint({ x: drop.x, z: drop.z, name: `Zwiggy: ${this.job.who}`, gig: true });
    G.hud.toast(`Order from ${shop.name}`, `${this.job.flat}, ${drop.street || drop.area} · ${fmt(pay)} · ${Math.ceil(limit / 60)} min for a tip`, 'meter', 4);
    void P;
  }
  // a ping on your phone: pick up from a food place near you, then deliver
  ping() {
    const G = this.g, P = G.player;
    const shops = G.shops.nearby(P.x, P.z, 700).filter(s => ['misal', 'thali', 'biryani', 'southindian', 'chinese', 'fastfood', 'cafe', 'bakery', 'sweets', 'food', 'tapri'].includes(s.kind) && s.d > 60);
    if (!shops.length) return;
    const s = shops[Math.min(shops.length - 1, this.rng.int(0, 4))];
    this.offer = { shop: s, t: 14 };
    G.hud.sms('Zwiggy', `New order: pick up at ${s.name} (${Math.round(s.d)} m). Press Y to accept.`, '', 'Ignore it and it goes to someone else');
    G.audio.chime?.();
  }
  accept() {
    const G = this.g, o = this.offer;
    if (!o) return;
    this.offer = null;
    this.job = { state: 'pickup', shop: o.shop, t: 0 };
    G.setWaypoint({ x: o.shop.x, z: o.shop.z, name: `Pick up: ${o.shop.name}`, gig: true });
    G.hud.toast('Order accepted', `Pick up at ${o.shop.name}`, 'meter', 3);
  }
  update(dt, input) {
    const G = this.g, P = G.player, L = this.life;
    if (this.offer) { this.offer.t -= dt; if (input.took('KeyY')) this.accept(); else if (this.offer.t <= 0) this.offer = null; }
    if (!this.job && L.s.phone && L.s.zwiggy && !(G.rides && G.rides.enabled) && G.state === 'play') {
      this.pingT -= dt;
      if (this.pingT <= 0) { this.pingT = this.rng.range(50, 110); if (!this.offer) this.ping(); }
    }
    const J = this.job;
    if (!J) return;
    J.t += dt;
    if (J.state === 'pickup') {
      if (Math.hypot(J.shop.x - P.x, J.shop.z - P.z) < 14 && Math.abs(P.v) < 2) { this.job = null; this.startAt(J.shop); G.hud.toast('Picked up', 'Now get it there hot', 'meter', 2.2); }
      return;
    }
    const d = Math.hypot(J.to.x - P.x, J.to.z - P.z);
    if (d < 14 && Math.abs(P.v) < 2.2) this.complete();
    else if (J.t > J.limit * 3) { this.job = null; G.setWaypoint(null); G.hud.toast('Order cancelled', `${J.who} gave up and ordered somewhere else`, 'bad', 3.4); L.change('respect', -1); }
  }
  complete() {
    const G = this.g, J = this.job, L = this.life;
    const onTime = J.t <= J.limit;
    const tip = onTime ? Math.round(this.rng.range(10, 45) / 5) * 5 : 0;
    const pay = Math.round(J.pay * (onTime ? 1 : 0.75));
    G.stats.money += pay + tip; G.saveStats(); G.audio.cash();
    L.s.tally.deliveries++; L.change('respect', 0.4); L.change('mood', 0.03);
    this.job = null; G.setWaypoint(null);
    G.hud.toast(`Delivered to ${J.who} · +${fmt(pay)}${tip ? ` · ${fmt(tip)} tip` : ''}`, onTime ? 'Still hot. Five stars' : 'Late, the food was cold', 'money', 3.6);
  }
  objective() {
    const J = this.job;
    if (!J) return null;
    if (J.state === 'pickup') return { main: `Pick up at ${J.shop.name}`, sub: 'Zwiggy order · follow the blue route' };
    const left = Math.max(0, J.limit - J.t);
    return { main: `Deliver to ${J.who}, ${J.flat}`, sub: `${J.to.street || J.to.area} · ${fmt(J.pay)}${left > 0 ? ` · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} for the tip` : ' · late'}`, urgent: left < 30 };
  }
}
