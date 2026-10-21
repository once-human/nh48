// Pune Metro and PMPML buses: the cheap way across the city.
//   Metro  walk up to a station (the stairs under an elevated station, or the entrance kiosk of
//          an underground one on the Purple Line) and press F: pick a station on the line; change at
//          District Court between Purple and Aqua. ₹10 to ₹35 by distance; a few minutes pass.
//   Bus    at any PMPML stop, F: the real routes that stop there (81, 94, 283, 5, 256, 333, 114...),
//          then where to get off. ₹10 for every 5 km stage. Slower than the metro (the wait, the
//          traffic), much cheaper than an auto. Stops with no listed route get the local buses.
// Both drop you on foot at the station or stop; whatever you were driving stays where you left it.
import { RNG } from '../core/util.js';
import { fmt } from './shops.js';
import { KbNav } from '../ui/kbnav.js';
import T from './transit.json';

const metroFare = (km) => km <= 2 ? 10 : km <= 4 ? 15 : km <= 8 ? 20 : km <= 12 ? 25 : km <= 18 ? 30 : 35;
const busFare = (km) => Math.min(120, 10 * Math.max(1, Math.ceil(km / 5)));
const INTERCHANGE = 'District Court';

export class Transit {
  constructor(G) {
    this.g = G; this.rng = new RNG(7171); this.open = false;
    const play = G.W.M.meta.play.map(v => v / 100), pad = 40;
    const inMap = (s) => s.x > play[0] - pad && s.x < play[2] + pad && s.z > play[1] - pad && s.z < play[3] + pad;
    this.lines = T.metro.map(l => ({ ...l, stations: l.stations.map((s, i) => ({ ...s, i, line: l.id, here: inMap(s) })) }));
    this.stops = (G.W.M.buses || []).map(b => ({ x: b[0] / 100, z: b[1] / 100, name: b[3] || 'Bus stop', mr: b[4] || '' }));
    this.routes = T.bus.map(r => ({ ...r, stops: r.stops.filter(inMap) })).filter(r => r.stops.length >= 2);
    const el = document.createElement('div');
    el.className = 'shop glass transit'; el.hidden = true;
    el.innerHTML = `<div class="sh-head"><div class="sh-k tr-k"></div><div class="sh-t tr-t"></div><div class="sh-mr tr-mr" lang="mr"></div><div class="tr-sub"></div></div>
      <div class="sh-list tr-list"></div><div class="sh-msg"></div>
      <div class="sh-foot"><span class="tr-cash"></span><span><span class="kbd">1–9</span> or <span class="kbd">↑↓</span> <span class="kbd">Enter</span> · <span class="kbd">F</span> leave</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    this.nav = new KbNav(el.querySelector('.tr-list'), '.sh-item');
    el.addEventListener('click', (e) => { const b = e.target.closest('.sh-item'); if (b && !b.disabled) this.pick(+b.dataset.i); });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'Escape' || e.code === 'KeyF') { e.preventDefault(); e.stopImmediatePropagation(); if (this.back) { const b = this.back; this.back = null; b(); } else this.close(); return; }
      const m = /^Digit(\d)$/.exec(e.code); if (m) { this.pick((+m[1] || 10) - 1); return; }
      this.nav.key(e);
    }, true);
  }
  // the station or stop you're standing at
  near(x, z) {
    let best = null, bd = 1e9;
    for (const l of this.lines) for (const s of l.stations) {
      if (!s.here) continue;
      const d = Math.hypot(s.x - x, s.z - z), r = s.ug ? 9 : 26;
      if (d < r && d < bd) { bd = d; best = { kind: 'metro', s, line: l, name: `${s.name} metro`, x: s.x, z: s.z }; }
    }
    if (best) return best;
    for (const s of this.stops) { const d = Math.hypot(s.x - x, s.z - z); if (d < 7 && d < bd) { bd = d; best = { kind: 'bus', s, name: `${s.name} bus stop`, x: s.x, z: s.z }; } }
    return best;
  }
  label(n) { return n.kind === 'metro' ? `${n.s.name} · ${n.line.name}${n.line.open ? '' : ' (not open yet)'} · F` : `${n.s.name} · PMPML bus stop · F`; }
  show(n) {
    const G = this.g;
    this.open = true; G.state = 'shop'; this.n = n; this.back = null;
    if (n.kind === 'metro') this.metroMenu(n); else this.busMenu(n);
    this.el.hidden = false;
  }
  head(k, t, mr, sub, color) {
    const E = this.el;
    E.querySelector('.tr-k').textContent = k; E.querySelector('.tr-t').textContent = t; E.querySelector('.tr-mr').textContent = mr || '';
    E.querySelector('.tr-sub').textContent = sub || ''; E.style.setProperty('--line', color || '#d1495b');
    E.querySelector('.tr-cash').textContent = `Cash ${fmt(this.g.stats.money)}`;
  }
  list(items) {
    this.items = items;
    const L = this.el.querySelector('.tr-list'); L.innerHTML = '';
    items.forEach((it, i) => {
      const b = document.createElement('button'); b.className = 'sh-item'; b.dataset.i = i; b.disabled = !!it.disabled;
      b.innerHTML = `<span class="n">${i < 9 ? i + 1 : ''}</span><span class="nm"><b></b><small></small></span><span class="pr"></span>`;
      b.querySelector('b').textContent = it.label; b.querySelector('small').textContent = it.note || ''; b.querySelector('.pr').textContent = it.price ? fmt(it.price) : it.right || '';
      if (it.color) b.style.borderLeft = `4px solid ${it.color}`;
      L.appendChild(b);
    });
    this.nav.i = -1; this.nav.paint();
  }
  // ---------------------------------------------------------------- metro
  metroMenu(n) {
    const G = this.g, here = n.s, line = n.line;
    this.head('Pune Metro · ' + line.name, here.name, here.mr, line.open ? `${here.ug ? 'Underground' : 'Elevated'} station · 6 am to 11 pm · ₹10 to ₹35` : 'This line isn’t open yet', line.color);
    if (!line.open) { this.list([{ label: 'Line 3 isn’t running yet', note: 'Hinjewadi to Shivajinagar, opening soon', disabled: true }]); return; }
    if (G.hour >= 23 || G.hour < 6) { this.list([{ label: 'Station closed', note: 'Metro runs 6 am to 11 pm. Take an auto', disabled: true }]); return; }
    const dests = [];
    for (const l of this.lines) {
      if (!l.open) continue;
      for (const s of l.stations) {
        if (!s.here || (l.id === line.id && s.i === here.i) || (s.name === here.name)) continue;
        const km = this.metroKm(here, line, s, l);
        if (km === null) continue;
        dests.push({ s, l, km, change: l.id !== line.id });
      }
    }
    dests.sort((a, b) => (a.l.id !== line.id) - (b.l.id !== line.id) || a.km - b.km);
    this.list(dests.map(d => ({ label: d.s.name, note: `${d.l.name}${d.change ? ` · change at ${INTERCHANGE}` : ''} · ${d.km.toFixed(1)} km · about ${Math.round(this.metroMin(d.km, d.change))} min`, price: metroFare(d.km), color: d.l.color,
      act: () => this.travel(d.s, metroFare(d.km), this.metroMin(d.km, d.change), `${d.l.name} to ${d.s.name}`) })));
  }
  lineKm(l, a, b) { let k = 0; const S = l.stations; for (let i = Math.min(a, b); i < Math.max(a, b); i++) k += Math.hypot(S[i + 1].x - S[i].x, S[i + 1].z - S[i].z); return k / 1000; }
  metroKm(a, la, b, lb) {
    if (la.id === lb.id) return this.lineKm(la, a.i, b.i);
    const ia = la.stations.find(s => s.name === INTERCHANGE), ib = lb.stations.find(s => s.name === INTERCHANGE);
    if (!ia || !ib) return null;
    return this.lineKm(la, a.i, ia.i) + this.lineKm(lb, ib.i, b.i);
  }
  metroMin(km, change) { return km / 33 * 60 + 4 + (change ? 5 : 0); }
  // ---------------------------------------------------------------- buses
  busMenu(n) {
    const G = this.g, here = n.s;
    this.head('PMPML bus stop', here.name, here.mr, '₹10 for every 5 km · buses every 10 to 20 minutes', '#e05a2b');
    const passing = this.routes.map(r => ({ r, i: r.stops.findIndex(s => Math.hypot(s.x - here.x, s.z - here.z) < 80) })).filter(o => o.i >= 0 && o.i < o.r.stops.length - 1);
    const items = passing.map(({ r, i }) => ({ label: `Route ${r.ref}`, note: r.name, right: `${r.stops.length - 1 - i} stops`, act: () => this.busStops(here, r, i) }));
    items.push({ label: 'Local buses', note: 'Any stop within a few km, one change on the way', right: 'More', act: () => this.busLocal(here) });
    if (G.hour >= 23.5 || G.hour < 5) items.unshift({ label: 'No buses this late', note: 'First bus around 5 am. Take an auto', disabled: true });
    this.list(items);
  }
  busStops(here, r, i) {
    this.back = () => this.busMenu(this.n);
    this.head(`Route ${r.ref}`, r.name, '', 'Where do you get off? · Esc to go back', '#e05a2b');
    const out = [];
    for (let k = i + 1; k < r.stops.length; k++) {
      const s = r.stops[k], km = Math.hypot(s.x - here.x, s.z - here.z) * 1.3 / 1000;
      out.push({ label: s.name, note: `${k - i} stops · ${km.toFixed(1)} km · about ${Math.round(this.busMin(km))} min`, price: busFare(km), act: () => this.travel(s, busFare(km), this.busMin(km), `Bus ${r.ref} to ${s.name}`) });
    }
    this.list(out.slice(0, 20));
  }
  busLocal(here) {
    this.back = () => this.busMenu(this.n);
    this.head('Local buses', here.name, '', 'One change on the way · Esc to go back', '#e05a2b');
    const c = this.stops.map(s => ({ s, d: Math.hypot(s.x - here.x, s.z - here.z) })).filter(o => o.d > 600 && o.d < 7000 && o.s.name !== here.name);
    const seen = new Set(), out = [];
    for (const o of c.sort((a, b) => a.d - b.d)) { if (seen.has(o.s.name)) continue; seen.add(o.s.name); const km = o.d * 1.3 / 1000; out.push({ label: o.s.name, note: `${km.toFixed(1)} km · about ${Math.round(this.busMin(km) + 8)} min with the change`, price: busFare(km), act: () => this.travel(o.s, busFare(km), this.busMin(km) + 8, `Buses to ${o.s.name}`) }); }
    this.list(out.slice(0, 24));
  }
  busMin(km) { return km / 16 * 60 + 6 + this.rng.range(0, 8); }
  // ---------------------------------------------------------------- the ride
  travel(to, fare, minutes, what) {
    const G = this.g, P = G.player;
    if (G.fastTravelBlock) { const why = G.fastTravelBlock(); if (why) { this.msg(why); return; } }
    if (G.W.tiles && !this._arriving) {
      if (G.stats.money < fare) { this.msg(`You need ${fmt(fare)}`); return; }
      this._arriving = true; this.close();
      const km = Math.hypot(to.x - P.x, to.z - P.z) * 1.3 / 1000;
      G.hud.curtain(true, what, km);
      const go = Promise.race([G.W.tiles.ensure(to.x, to.z, 650, (f) => G.hud.curtainProgress(f)), new Promise(r => setTimeout(r, 15000))]);
      go.catch(() => {}).then(() => { G.hud.curtainProgress(1); try { this.travel(to, fare, minutes, what); } catch (e) { console.warn('arrive', e); } })
        .finally(() => { this._arriving = false; setTimeout(() => G.hud.curtain(false), 300); });
      return;
    }
    if (!G.shops.spend(fare)) { this.msg(`You need ${fmt(fare)}`); return; }
    const spot = G.safeDrop(to.x, to.z);
    if (!spot) { this.msg('Can’t get off there'); return; }
    this.close();
    P.teleportFoot(spot.x, spot.z, spot.th, G.traffic);
    const h = minutes / 60; G.hour = (G.hour + h) % 24; G.clock = (G.clock || 0) + h;
    G.W.activity && G.W.activity.setHour && G.W.activity.setHour(G.hour);
    G.W.streamer.warm(P.x, P.z, Math.min(260, G.quality.streamRadius || 260));
    G.traffic.prefill(P.x, P.z);
    G.setWaypoint(null);
    G.life && G.life.change && G.life.change('karma', 0.2);
    G.hud.flash(to.name, `${what} · ${fmt(fare)} · ${Math.round(minutes)} min`);
  }
  msg(t) { this.el.querySelector('.sh-msg').textContent = t || ''; }
  pick(i) { const it = this.items && this.items[i]; if (!it || it.disabled || !it.act) return; it.act(); }
  close() { this.open = false; this.el.hidden = true; this.back = null; if (this.g.state === 'shop') this.g.state = 'play'; }
}
