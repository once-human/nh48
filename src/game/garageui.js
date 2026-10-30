// The garage, on its own screen: your vehicle in the bay in the middle (drag to walk round it, scroll to come
// closer; each category swings the camera to the part it's about), the categories down the left, one category's
// options on the right. Point at an option and the vehicle wears it; click and it goes on the build sheet; the
// numbers (top speed, 0 to 60, stopping, grip, toughness) and what the RTO would say move as you build. Pay once and
// the lot gets fitted. The bay (repairs, a service, a wash, insurance, a nitrous refill, papers) works on the spot.
// Any vehicle: yours keep it, one you've taken keeps it while it's yours to drive (or get it papers at the kind of
// garage that does that). Not a rental, and not a government vehicle.
import * as THREE from 'three';
import { g } from '../ui/glyphs.js';
import { fmt, STICKERS } from './shops.js';
import { modsOf, applyMods, statsOf, illegalOf, classOf, sameCol, COLOURS, NEON, HORNS, FINISH, RIMS, LIVERY, FLAPS, PATYA, EXHAUST, FANCY } from '../vehicles/mods.js';

const r10 = (v) => Math.max(10, Math.round(v / 10) * 10);
const F_OF = { auto: 1, cycle: 0.3, scooter: 0.8, scooterP: 0.8, bike: 0.9, bikeP: 0.9, bullet: 1.2, hatch: 4, sedan: 4.5, taxi: 4, suv: 5, jeep: 5, lux: 9, sports: 14, super: 20, tempo: 2.2, bus: 8 };
const VALUE = { cycle: 7500, scooter: 84000, bike: 96000, bullet: 215000, hatch: 690000, sedan: 880000, suv: 1590000, jeep: 1650000, lux: 7900000, sports: 19500000, super: 39000000, taxi: 700000, auto: 280000, tempo: 700000, bus: 4000000 };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = (p) => `rgb(${p.map(c => Math.round(Math.pow(Math.min(1, Math.max(0, c)), 1 / 2.2) * 255)).join(',')})`;
// where each category points the camera: yaw round the vehicle (0 = its nose), height, distance
const VIEW = { bay: [0.7, 0.35, 1], paint: [0.75, 0.3, 1], livery: [1.57, 0.12, 0.95], rims: [1.25, 0.05, 0.75], body: [2.4, 0.3, 1], windows: [0.9, 0.2, 0.9], plates: [3.14, 0.1, 0.8],
  stickers: [3.14, 0.15, 0.8], engine: [2.6, 0.2, 0.9], turbo: [2.8, 0.15, 0.85], ecu: [0.5, 0.3, 0.95], nitro: [2.9, 0.1, 0.85], brakes: [1.0, 0.03, 0.7], tyres: [1.2, 0.03, 0.7],
  susp: [1.57, -0.05, 0.95], armor: [0.6, 0.25, 1], lights: [0.25, 0.12, 0.85], neon: [1.0, -0.12, 1], beacon: [0.6, 0.65, 1], exhaust: [3.0, 0.06, 0.7], horn: [0.2, 0.15, 0.8],
  sound: [2.2, 0.3, 0.9], interior: [0.4, 0.5, 0.55], cam: [0.3, 0.45, 0.6], hydro: [1.57, -0.02, 1] };

export class GarageUI {
  constructor(G) {
    this.g = G; this.open = false; this.queue = new Map(); this.cat = 'bay'; this.focus = -1;
    this.cam = { yaw: 0.7, pitch: 0.3, dist: 1, dy: 0, dp: 0, dz: 1 };
    const el = this.el = document.createElement('div');
    el.className = 'gx'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Garage');
    el.innerHTML = `<div class="gx-l"><header class="gx-top"><div class="gx-k">${g('wrench')}<span>Garage · गॅरेज</span></div><div class="gx-t"></div><div class="gx-veh"><b></b><span></span></div><div class="gx-chips"></div></header><nav class="gx-cats"></nav></div>
      <section class="gx-r"><div class="gx-oh"><div class="gx-oi"></div><div><h3></h3><p></p></div></div><div class="gx-ol"></div>
        <div class="gx-sheet"><div class="gx-sh"><b>Build sheet</b><button class="gx-clear" type="button">Clear</button></div><div class="gx-sl"></div><div class="gx-tot"><span></span><b></b></div><button class="gx-fit" type="button"></button></div></section>
      <div class="gx-stats"></div><div class="gx-msg" aria-live="polite"></div>
      <div class="gx-hint"><span>${mouse('l')} drag to walk round</span><span>${mouse('m')} closer</span><span><span class="kbd">↑↓</span> options</span><span><span class="kbd">←→</span> categories</span><span><span class="kbd">Enter</span> add / fit</span><span><span class="kbd">F</span> leave</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    el.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]'); if (c) { this.setCat(c.dataset.cat); return; }
      const o = e.target.closest('[data-o]'); if (o && !o.disabled) { this.pick(+o.dataset.o); return; }
      const x = e.target.closest('[data-x]'); if (x) { this.queue.delete(x.dataset.x); this.render(); this.preview(); return; }
      if (e.target.closest('.gx-clear')) { this.queue.clear(); this.render(); this.preview(); return; }
      if (e.target.closest('.gx-fit')) this.fit();
    });
    el.addEventListener('pointerover', (e) => { const o = e.target.closest('[data-o]'); if (o) { this.hover = +o.dataset.o; this.preview(); this.paintStats(); } });
    el.addEventListener('pointerout', (e) => { const o = e.target.closest('[data-o]'); if (o && !o.contains(e.relatedTarget)) { this.hover = null; this.preview(); this.paintStats(); } });
    el.addEventListener('input', (e) => { if (e.target.closest('.gx-cc')) this.customColour(); });
    // drag on the open space to walk round the vehicle; the wheel comes closer
    let drag = null;
    el.addEventListener('pointerdown', (e) => { if (e.target !== el) return; drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => { if (!drag) return; this.cam.dy -= (e.clientX - drag.x) * 0.006; this.cam.dp = Math.max(-0.35, Math.min(0.9, this.cam.dp + (e.clientY - drag.y) * 0.004)); drag = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', () => { drag = null; });
    el.addEventListener('wheel', (e) => { if (e.target.closest('.gx-l, .gx-r')) return; e.preventDefault(); this.cam.dz = Math.max(0.5, Math.min(1.5, this.cam.dz * (e.deltaY > 0 ? 1.08 : 0.93))); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      const c = e.code, stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (e.target && e.target.type === 'range' && /Arrow/.test(c)) return;
      if (c === 'Escape' || c === 'KeyF') { stop(); this.close(); return; }
      if (c === 'ArrowDown' || c === 'ArrowUp' || c === 'KeyS' || c === 'KeyW') { stop(); const n = this.opts.length; if (!n) return; let i = this.focus; do { i = (i + (c === 'ArrowDown' || c === 'KeyS' ? 1 : n - 1)) % n; } while (this.opts[i].off && i !== this.focus); this.focus = i; this.hover = i; this.render(); this.preview(); return; }
      if (c === 'ArrowLeft' || c === 'ArrowRight' || c === 'KeyA' || c === 'KeyD') { stop(); const ids = this.cats.map(q => q.id), k = ids.indexOf(this.cat); this.setCat(ids[(k + (c === 'ArrowRight' || c === 'KeyD' ? 1 : ids.length - 1)) % ids.length]); return; }
      if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') { stop(); if (this.focus >= 0 && this.opts[this.focus]) this.pick(this.focus); else this.fit(); return; }
      if (c === 'Backspace') { stop(); this.queue.clear(); this.render(); this.preview(); }
    }, true);
  }
  get life() { return this.g.life; }

  // ---------------------------------------------------------------- opening
  show(ctx) {
    const G = this.g, P = G.player;
    const d = P.onFoot ? P.dropped.find(q => Math.hypot(q.veh.x - ctx.x, q.veh.z - ctx.z) < 16) : null;
    const here = !P.onFoot ? P.cur : d ? d.veh : P.auto;
    this.ctx = ctx; this.here = here; this.queue.clear(); this.hover = null; this.focus = -1;
    this.isAuto = here === P.auto; this.type = this.isAuto ? 'auto' : here ? here.type : 'auto'; this.cl = classOf(this.type);
    this.gov = !!(here && (here.service || here.serviceKind));
    this.rental = !!(here && here.owned && here.owned.rental);
    this.mine = this.isAuto || !!(here && here.owned && !here.owned.rental);
    this.base = here && !this.gov ? modsOf(G, here) : null;
    this.mul = G.shops.priceMul(ctx.x, ctx.z);
    this.open = true; G.state = 'shop'; G.audio.updateEngine?.(0, 0, false);
    P.hideBody = true; this.fov0 = G.camera.fov;
    this.el.querySelector('.gx-t').textContent = ctx.name;
    this.cat = 'bay'; this.setView('bay', true); this.cam.dz = 1;
    this.msg(''); this.render(); this.preview();
    this.el.hidden = false; this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
    G.shops.speak?.('garage', 'hello');
  }
  close() {
    const G = this.g;
    this.open = false; this.el.hidden = true; this.queue.clear(); this.hover = null;
    this.preview();                                   // back to what's really on it
    G.player.hideBody = false;
    if (this.fov0) { G.camera.fov = this.fov0; G.camera.updateProjectionMatrix(); }
    G.rig.inited = false;
    if (G.state === 'shop') G.state = 'play';
  }
  setCat(id) { this.cat = id; this.focus = -1; this.hover = null; this.setView(id); this.render(); this.preview(); this.el.querySelector('.gx-ol').scrollTop = 0; }
  setView(id, snap) { const v = VIEW[id] || VIEW.bay; this.goal = { yaw: v[0], pitch: v[1], dist: v[2] }; this.cam.dy = 0; this.cam.dp = 0; if (snap) Object.assign(this.cam, { yaw: v[0], pitch: v[1], dist: v[2] }); }

  // ---------------------------------------------------------------- what's on offer
  // categories: { id, name, icon, group, cur (what's on it now), blurb, opts }; an option: { name, note, price, is(d), set(d),
  // ill (what the police would call it), off (why not), sw (a swatch), slot (one per slot on the sheet), job (done now, not queued) }
  catalogue() {
    const G = this.g, L = this.life, cl = this.cl, type = this.type, here = this.here, m = this.base || {}, U = L.s.upg || {};
    const F = F_OF[type] || 3, $ = (b) => r10(b * F * Math.max(0.9, this.mul * 0.9)), car = cl === 'car', two = cl === 'two', cyc = cl === 'cycle', big = car || cl === 'tempo' || cl === 'bus';
    const C = [];
    const cat = (id, name, icon, group, cur, blurb, opts, when = true) => { if (when) C.push({ id, name, icon, group, cur, blurb, opts }); };
    const ex = (slot, name, note, price, is, set, o = {}) => ({ slot, name, note, price, is, set, ...o });
    const tog = (key, name, note, price, o = {}) => ({ slot: key, name, note, price, toggle: key, is: (d) => !!d[key], set: (d) => { d[key] = d[key] ? 0 : 1; }, ...o });
    // the bay: jobs done on the spot
    const bay = [];
    if (here) {
      const dmg = here.dmg || 0, base = { auto: 6500, cycle: 600, scooter: 4200, bike: 5200, hatch: 38000, sedan: 46000, taxi: 42000, suv: 62000, tempo: 30000, bus: 90000 }[type] || 20000;
      const cost = m.ins ? 0 : r10(Math.max(250, base * dmg) * Math.max(0.9, this.mul * 0.85));
      bay.push({ job: true, name: dmg > 0.02 ? `Repair${m.ins ? ' (insured)' : ''}` : 'No damage', note: dmg > 0.02 ? `Body at ${Math.round((1 - dmg) * 100)}%. Dents out, panels, alignment` : 'Runs like new', price: dmg > 0.02 ? cost : 0, off: dmg > 0.02 ? '' : 'Nothing to fix', icon: 'wrench',
        act: () => { if (cost && !G.shops.spend(cost, true)) return false; if (m.ins) m.ins--; here.dmg = 0; return 'Fixed. Like new'; } });
      const svc = r10(({ auto: 900, scooter: 750, bike: 850, cycle: 150 }[type] || 4500) * Math.max(0.9, this.mul * 0.85));
      bay.push({ job: true, name: 'General service', note: cyc ? 'Chain oiled, brakes tightened, tyres pumped' : 'Oil, filters, brakes, chain. Small dents knocked out', price: svc, icon: 'drop', act: () => { if (!G.shops.spend(svc, true)) return false; here.dmg = Math.max(0, (here.dmg || 0) - 0.15); return 'Serviced'; } });
      const day = Math.floor((G.clock || 0) / 24), wash = r10(250 * Math.max(0.6, F * 0.4) * this.mul);
      if (this.isAuto) bay.push({ job: true, name: 'Wash and polish', note: L.s.washed === day ? 'Already shining today' : 'Passengers tip a little more today', price: wash, off: L.s.washed === day ? 'Done today' : '', icon: 'drop', act: () => { if (!G.shops.spend(wash)) return false; L.s.washed = day; return 'Shining'; } });
      if (this.base && !cyc) bay.push({ job: true, name: 'Insurance, three claims', note: m.ins ? `${m.ins} free repairs left` : 'The next three repairs here are on the house', price: $(5000), off: m.ins ? 'Covered' : '', icon: 'shield', act: () => { if (!G.shops.spend($(5000), true)) return false; m.ins = 3; return 'Insured. Drive like nobody’s watching'; } });
      if (m.nitro) bay.push({ job: true, name: 'Refill the nitrous', note: `Bottle at ${Math.round((m.n2o || 0) * 10)}%`, price: $(900), off: (m.n2o || 0) >= 9.9 ? 'Full' : '', icon: 'nitro', act: () => { if (!G.shops.spend($(900))) return false; m.n2o = 10; return 'Full bottle. Hold Shift'; } });
      // a vehicle that isn't yours: papers, or cash for it, at the kind of garage that asks nothing
      if (!this.mine && !this.gov && here.stolen) {
        const chop = G.hustle && G.hustle.isChop(this.ctx), v0 = VALUE[type] || 100000;
        const papers = r10(v0 * 0.12);
        bay.push({ job: true, name: 'New papers in your name', note: chop ? 'A fresh chassis stamp, an RC in your name, new plates. It’s yours now. −karma' : 'He looks at the plate, then at you. Not here', price: papers, off: chop ? '' : 'Not here', icon: 'receipt', act: () => this.papers(papers) });
        const sell = Math.round(v0 * 0.15 / 100) * 100;
        bay.push({ job: true, name: 'Sell it, no questions', note: chop ? 'Stripped for parts tonight. The owner may still trace it' : 'Not this garage', price: 0, cash: sell, off: chop ? '' : 'Not here', icon: 'cash', act: () => this.sell(sell) });
      }
    }
    cat('bay', 'The bay', 'wrench', 'Bay', here ? `Body ${Math.round((1 - (here.dmg || 0)) * 100)}%` : '—', this.gov ? 'A government vehicle: the mechanic will fix it, nothing else' : this.rental ? 'A rental: repairs only. The travels would notice anything else' : 'Repairs, a service, insurance; done while you wait', bay);
    if (!this.base) return C;
    // ---- looks
    const paintNow = m.paint ? (COLOURS.find(c => sameCol(c[1], m.paint)) || ['Custom'])[0] : 'Factory';
    const fin = FINISH.find(f => f[0] === (m.finish || 'gloss'));
    cat('paint', 'Respray', 'spray', 'Looks', cl === 'auto' ? paintNow : `${paintNow}${fin && fin[0] !== 'gloss' ? ', ' + fin[1].toLowerCase() : ''}`,
      cl === 'auto' ? 'The yellow on your auto, in anything you like. The RTO likes black and yellow' : 'Two coats and a polish. Changes your description, too: cops looking for a colour look past you',
      [...COLOURS.map(([n, c]) => ex('paint', n, 'Respray', $(2500), (d) => sameCol(d.paint, c), (d) => { d.paint = c.slice(); }, { sw: css(c), ill: cl === 'auto' && n !== 'Pune yellow' ? 'Off the permit colours' : '' })),
        ...(car || cl === 'tempo' ? FINISH.map(([k, n, r, me]) => ex('finish', n, k === 'gloss' ? 'What it came with' : k === 'matte' ? 'Flat, no shine: shows every scratch' : k === 'chrome' ? 'A mirror on wheels. Pune will stare' : k === 'metal' ? 'Flakes that catch the sun' : k === 'mirror' ? 'Wet-look clear coat' : 'Soft sheen', k === 'gloss' ? 0 : $(k === 'chrome' ? 9000 : 3000), (d) => (d.finish || 'gloss') === k, (d) => { d.finish = k; }, { chip: true, finishK: k })) : [])]);
    cat('livery', 'Livery', 'brush', 'Looks', LIVERY[m.livery || 0], 'Painted by hand down both sides' + (two ? ' of the tank' : ''),
      LIVERY.map((n, i) => ex('livery', n, i === 0 ? 'Plain' : i === 3 ? 'Maharashtra’s Warli folk art: the tarpa dance in white' : i === 4 ? 'The border of a Paithani sari: peacocks in gold' : i === 8 ? 'Flowers, borders, a nazar eye: highway truck art' : 'Hand-painted', i ? $(i >= 3 && i <= 4 || i === 8 ? 4500 : 3000) : 0, (d) => (d.livery || 0) === i, (d) => { d.livery = i; })), !cyc);
    cat('rims', 'Wheels', 'rim', 'Looks', RIMS[m.rims || 0], 'Rims to change the whole stance',
      RIMS.map((n, i) => ex('rims', n, i ? (i === 6 ? 'Painted to match the body' : 'Alloy, balanced and fitted') : 'What it came with', i ? $(cyc ? 2000 : 4000) : 0, (d) => (d.rims || 0) === i, (d) => { d.rims = i; })));
    const body = [];
    if (car) { body.push(ex('spoiler', 'No spoiler', '', 0, (d) => !d.spoiler, (d) => { d.spoiler = 0; }), ex('spoiler', 'Lip spoiler', 'A small lip on the boot', $(2500), (d) => d.spoiler === 1, (d) => { d.spoiler = 1; }), ex('spoiler', 'GT wing', 'Big, on stands. Mostly for show', $(7000), (d) => d.spoiler === 2, (d) => { d.spoiler = 2; })); body.push(tog('kit', 'Body kit', 'Front splitter, side skirts, rear diffuser', $(6000))); }
    if (big || cl === 'auto') body.push(tog('rack', 'Roof carrier', cl === 'auto' ? 'For luggage: station runs pay better' : 'For the luggage on a trip to Konkan', $(1500)));
    if (car || cl === 'tempo') body.push(tog('bullbar', 'Bull bar', 'Chrome guard on the nose: less damage head-on. Banned on cars in India', $(4000), { ill: 'Bull bar' }));
    if (big || cl === 'auto') { body.push(ex('flaps', 'No mud flaps', '', 0, (d) => d.flaps == null || d.flaps === '', (d) => { d.flaps = ''; })); FLAPS.forEach((t, i) => body.push(ex('flaps', `Mud flaps: ${t}`, 'Painted rubber behind the back wheels', $(400), (d) => d.flaps === i, (d) => { d.flaps = i; }))); }
    if (cl === 'auto') { body.push(ex('patya', 'No board', '', 0, (d) => d.patya == null || d.patya === '', (d) => { d.patya = ''; })); PATYA.forEach((t, i) => body.push(ex('patya', `Board: ${t}`, 'A Puneri board on the back, for everyone stuck behind you', 350, (d) => d.patya === i, (d) => { d.patya = i; }))); body.push(tog('curtain', 'Rain curtains', 'Rolled up over the sides; down in the monsoon, passengers stay dry and tip', 900)); }
    if (two) { body.push(tog('crash', 'Crash guards', 'Steel loops either side: less damage when it goes down', $(1800))); body.push(tog('saddle', 'Saddle bags', 'Leather, either side of the back wheel', $(2200))); }
    if (cyc) body.push(tog('basket', 'Front basket', 'For the vegetables', 250));
    cat('body', 'Body', 'body', 'Looks', [m.spoiler ? 'Spoiler' : '', m.kit ? 'Kit' : '', m.rack ? 'Carrier' : '', m.bullbar ? 'Bull bar' : '', m.crash ? 'Guards' : '', m.saddle ? 'Bags' : '', m.basket ? 'Basket' : ''].filter(Boolean).join(' · ') || 'Stock', 'What bolts on outside', body, body.length > 0);
    cat('windows', 'Window film', 'window', 'Looks', ['Clear', 'Light', 'Dark', 'Limo black'][m.tint || 0], 'Sun film. The Supreme Court banned it on Indian cars in 2012; the police still peel it off',
      ['Clear glass', 'Light film', 'Dark film', 'Limo black'].map((n, i) => ex('tint', n, i ? 'Nobody sees in. Cool inside' : 'What the law wants', i ? $(800 + i * 400) : 0, (d) => (d.tint || 0) === i, (d) => { d.tint = i; }, { ill: i ? 'Tinted windows' : '' })), big);
    const plates = [ex('plates', 'Stock plates', 'What it came with', 0, (d) => !d.vip && !d.fancy && !d.hsrp, (d) => { d.vip = ''; d.fancy = ''; d.hsrp = 0; })];
    plates.push(ex('plates', 'High-security plate (HSRP)', 'Aluminium, a chrome hologram, laser-etched: mandatory in Maharashtra. Cops wave you on more often', cl === 'auto' ? 590 : two ? 531 : 879, (d) => !!d.hsrp && !d.vip && !d.fancy, (d) => { d.hsrp = 1; d.vip = ''; d.fancy = ''; }));
    plates.push(ex('plates', 'VIP number', 'A 000-something number from the RTO auction. +respect wherever you park', $(25000), (d) => !!d.vip, (d) => { d.vip = d.vip || this.vipNo(); d.fancy = ''; }));
    FANCY.forEach(([w, n]) => plates.push(ex('plates', `Fancy plate: ${w}`, `${n}, painted so it reads “${w}”. Very Maharashtra, very illegal`, $(1200), (d) => d.fancy === w, (d) => { d.fancy = w; d.vip = ''; }, { ill: 'Fancy number plate' })));
    cat('plates', 'Number plates', 'numplate', 'Looks', m.fancy ? m.fancy : m.vip ? 'VIP' : m.hsrp ? 'HSRP' : 'Stock', 'Front and back', plates, !cyc);
    if (this.isAuto) cat('stickers', 'Rear sticker', 'star', 'Looks', STICKERS[U.sticker || 0], 'Painted on the back of your auto', STICKERS.map((t, i) => ex('sticker', t, 'Hand-lettered', r10(300 * this.mul), () => (U.sticker || 0) === i, () => {}, { sticker: i, isU: () => (U.sticker || 0) === i })));
    // ---- performance
    const st = [6000, 14000, 26000];
    if (cyc) cat('engine', 'Gears', 'piston', 'Performance', m.gears ? '7-speed' : 'Single speed', 'Up the hills to Katraj without getting off', [ex('gears', 'Single speed', '', 0, (d) => !d.gears, (d) => { d.gears = 0; }), ex('gears', '7-speed gear kit', 'Derailleur, shifters: 20% faster on the flat', 4500, (d) => !!d.gears, (d) => { d.gears = 1; })]);
    else cat('engine', 'Engine', 'piston', 'Performance', `Stage ${m.engine || 0}`, 'Tuned, remapped, breathing better: a higher top speed',
      [0, 1, 2, 3].map(i => ex('engine', i ? `Stage ${i} tune` : 'Stock engine', i ? `+${i * 8}% top speed` : 'As it left the factory', (base) => i <= (base.engine || 0) ? 0 : st.slice(base.engine || 0, i).reduce((a, b) => a + $(b), 0), (d) => (d.engine || 0) === i, (d) => { d.engine = i; })));
    cat('turbo', 'Turbo', 'turbo', 'Performance', m.turbo ? 'Fitted' : 'None', 'Pulls 18% harder off the line', [ex('turbo', 'No turbo', '', 0, (d) => !d.turbo, (d) => { d.turbo = 0; }), ex('turbo', 'Turbo kit', 'Spools up with a whistle', $(18000), (d) => !!d.turbo, (d) => { d.turbo = 1; })], !cyc);
    const ecu = [ex('ecu', 'Stock map', 'Factory fuel and timing', 0, (d) => !d.ecu, (d) => { d.ecu = ''; }), ex('ecu', 'Eco remap', 'A third more kilometres on a tank, a little slower', $(3500), (d) => d.ecu === 'eco', (d) => { d.ecu = 'eco'; }), ex('ecu', 'Sport remap', 'Sharper throttle, a bit more top end, thirstier', $(5500), (d) => d.ecu === 'sport', (d) => { d.ecu = 'sport'; })];
    if (car && type !== 'taxi') ecu.push(tog('cng', 'CNG kit, RTO-approved', 'A cylinder in the boot, endorsed on your RC: fills at ₹92/kg instead of petrol, goes further', $(14000)));
    cat('ecu', 'ECU & fuel', 'chip', 'Performance', [m.ecu === 'eco' ? 'Eco' : m.ecu === 'sport' ? 'Sport' : 'Stock', m.cng ? 'CNG' : ''].filter(Boolean).join(' · '), 'How it burns its fuel', ecu, !cyc);
    cat('nitro', 'Nitrous', 'nitro', 'Performance', m.nitro ? `${Math.round((m.n2o || 0) * 10)}% left` : 'None', 'A bottle of N₂O: hold Shift for ten seconds of madness. Refills at any garage',
      [ex('nitro', 'No nitrous', '', 0, (d) => !d.nitro, (d) => { d.nitro = 0; }), ex('nitro', 'Nitrous kit', 'Past your top speed, flames out the back', $(cl === 'auto' ? 22000 : 30000), (d) => !!d.nitro, (d) => { d.nitro = 1; d.n2o = 10; })], !cyc);
    cat('brakes', 'Brakes', 'disc', 'Performance', ['Stock', 'Street', 'Sport'][m.brakes || 0], 'Shorter stops, for Pune’s sudden U-turns',
      ['Stock brakes', 'Street brakes', 'Sport brakes'].map((n, i) => ex('brakes', n, i ? `Stops ${i * 15}% shorter` : '', (base) => i <= (base.brakes || 0) ? 0 : [0, 4000, 9000].slice((base.brakes || 0) + 1, i + 1).reduce((a, b) => a + $(b), 0), (d) => (d.brakes || 0) === i, (d) => { d.brakes = i; })));
    cat('tyres', 'Tyres', 'tyre', 'Performance', m.bulletproof ? 'Bulletproof' : m.tyres ? 'Grip' : 'Stock', 'Rubber for the monsoon',
      [tog('tyres', 'Grip tyres', 'Corners harder, wet or dry', $(5000)), ...(cyc ? [] : [tog('bulletproof', 'Bulletproof tyres', 'Run-flat: the spikes at a nakabandi don’t stop you', $(15000))])]);
    cat('susp', 'Suspension', 'spring', 'Performance', ({ '-1': 'Lifted', 0: 'Stock', 1: 'Lowered', 2: 'Slammed' })[m.lower || 0], 'Ride height. Pune has a speed breaker every hundred metres',
      [[-1, 'Lifted', 'Sits higher: potholes and breakers barely felt', 7000], [0, 'Stock height', 'Back to factory', 0], [1, 'Lowered', '3.5 cm lower, a little more grip', 6000], [2, 'Slammed', '7 cm lower. Breakers will scrape the floor', 11000]].map(([lv, n, note, b]) => ex('susp', n, note, b ? $(b) : 0, (d) => (d.lower || 0) === lv, (d) => { d.lower = lv; })), !two && !cyc);
    cat('armor', 'Armour', 'shield', 'Performance', `${(m.armor || 0) * 20}%`, 'Steel plate behind the panels',
      [0, 1, 2, 3].map(i => ex('armor', i ? `Armour, level ${i}` : 'No armour', i ? `${i * 20}% less damage from crashes` : '', (base) => i <= (base.armor || 0) ? 0 : [8000, 16000, 28000].slice(base.armor || 0, i).reduce((a, b) => a + $(b), 0), (d) => (d.armor || 0) === i, (d) => { d.armor = i; })), !cyc);
    // ---- lights and sound
    cat('lights', 'Lights', 'beam', 'Lights & sound', [m.xenon ? 'Xenon' : 'Stock', m.fogs ? 'fogs' : ''].filter(Boolean).join(' + '), 'See the potholes before you find them',
      [tog('xenon', cyc ? 'LED lamp' : 'Xenon headlights', 'Cold white, reaches further', $(2500)), ...(cyc ? [] : [tog('fogs', 'Fog lamps', 'Yellow, low down: for the ghats in the monsoon', $(1800))])]);
    cat('neon', 'Neon', 'bulb', 'Lights & sound', m.neon ? (NEON.find(n => n[1] === m.neon) || ['On'])[0] : 'None', 'Light under the body, all night',
      [ex('neon', 'No neon', '', 0, (d) => !d.neon, (d) => { d.neon = 0; }), ...NEON.map(([n, c]) => ex('neon', `${n} neon`, 'Glows on the road under you', $(3500), (d) => d.neon === c, (d) => { d.neon = c; }, { sw: '#' + c.toString(16).padStart(6, '0') }))], !cyc);
    cat('beacon', 'Roof lights', 'beacon', 'Lights & sound', m.beacon === 'red' ? 'Laal batti' : m.beacon ? 'Strobes' : 'None', 'N to switch on. Traffic ahead pulls over for you. The police won’t',
      [ex('beacon', 'Nothing on the roof', '', 0, (d) => !d.beacon, (d) => { d.beacon = ''; }), ex('beacon', 'Red beacon (laal batti)', 'The VIP light. Banned for everyone but emergency vehicles since May 2017', $(6000), (d) => d.beacon === 'red', (d) => { d.beacon = 'red'; }, { ill: 'Red beacon' }), ex('beacon', 'Blue-white strobes', 'Flash like an escort vehicle', $(4500), (d) => d.beacon === 'strobe', (d) => { d.beacon = 'strobe'; }, { ill: 'Flashing lights' })], !two && !cyc);
    cat('exhaust', 'Exhaust', 'exhaust', 'Lights & sound', (EXHAUST.find(e => e[0] === (m.exhaust || '')) || EXHAUST[0])[1], 'The sound it makes',
      EXHAUST.map(([k, n]) => ex('exhaust', n, k === '' ? 'Quiet, legal' : k === 'sport' ? 'Deeper, a little louder, still legal' : k === 'dhak' ? 'The Bullet thump, pops when you lift off. Pune police crush these under road rollers' : 'Pops and spits fire on the overrun. Heads turn, cops too', k === '' ? 0 : $(k === 'sport' ? 4000 : k === 'dhak' ? 3500 : 12000), (d) => (d.exhaust || '') === k, (d) => { d.exhaust = k; }, { ill: k === 'dhak' || k === 'flame' ? 'Modified silencer' : '' })), !cyc);
    cat('horn', 'Horn', 'horn', 'Lights & sound', (HORNS.find(h => h[1] === (m.horn || '')) || HORNS[0])[0], 'H. Use it like a Punekar',
      HORNS.map(([n, k], i) => ex('horn', n, i ? 'Multi-tone and pressure horns are banned; the street hears it anyway' : 'What it came with', i ? r10([0, 1200, 2200, 3500][i] * Math.max(0.9, this.mul * 0.9)) : 0, (d) => (d.horn || '') === k, (d) => { d.horn = k; }, { ill: i ? 'Pressure / multi-tone horn' : '' })), !cyc);
    cat('sound', 'Music system', 'speaker', 'Lights & sound', m.dj ? 'DJ box' : 'None', 'U to play. Stand still and the footpath starts dancing',
      [ex('dj', 'No system', '', 0, (d) => !d.dj, (d) => { d.dj = 0; }), ex('dj', 'DJ box', 'Two 12-inch subs and a horn tweeter, dhol-tasha on a loop', $(cl === 'auto' ? 9000 : 6000), (d) => !!d.dj, (d) => { d.dj = 1; })], !two && !cyc);
    // ---- inside and gadgets
    const inside = [tog('ganpati', 'Ganpati on the dashboard', 'A small brass Bappa. +karma, passengers notice', 251), tog('nimbu', 'Nimbu-mirchi', 'Lemon and seven chillies, to keep the evil eye off', 30), tog('dice', 'Fuzzy dice', 'Hanging off the mirror', 199),
      ex('led', 'No LED strip', '', 0, (d) => !d.led, (d) => { d.led = 0; }), ...[['Pink', 0xff2f9d], ['Blue', 0x2f7dff]].map(([n, c]) => ex('led', `${n} LED strip`, 'Inside the roof: night passengers tip a little more', $(1500), (d) => d.led === c, (d) => { d.led = c; }, { sw: '#' + c.toString(16).padStart(6, '0') })),
      tog('seat', 'Leopard seat covers', 'Passengers tip 5% more (they say they don’t)', $(1800))];
    if (this.isAuto) inside.push(tog('meter', 'Digital fare meter', 'Passengers trust it: tips 4% more', 4500));
    cat('interior', 'Inside', 'seat', 'Inside & gadgets', [m.ganpati ? 'Bappa' : '', m.nimbu ? 'Nimbu' : '', m.dice ? 'Dice' : '', m.seat ? 'Leopard' : ''].filter(Boolean).join(' · ') || 'Bare', 'What rides with you', inside, !two && !cyc);
    cat('cam', two ? 'Helmet cam' : 'Dashcam', 'cam', 'Inside & gadgets', m.dashcam ? 'Recording' : 'None', 'Footage for when it’s your word against theirs',
      [tog('dashcam', two ? 'Helmet cam' : 'Dashcam', 'Records everything ahead: a cop who stops you for a light you didn’t jump has to believe it', $(two ? 900 : 1100))], !cyc);
    cat('hydro', 'Hydraulics', 'hydro', 'Inside & gadgets', m.hydro ? 'Fitted' : 'None', 'G to make it jump. Absolutely pointless, absolutely brilliant',
      [ex('hydro', 'Stock springs', '', 0, (d) => !d.hydro, (d) => { d.hydro = 0; }), ex('hydro', 'Hydraulic kit', 'Pumps on every corner: hop on a keypress', $(cl === 'auto' ? 16000 : 20000), (d) => !!d.hydro, (d) => { d.hydro = 1; })], !two && !cyc);
    return C;
  }
  vipNo() { const A = 'ABCDEFGHJKLMNPRSTUVWXYZ', r = () => A[Math.floor(Math.random() * A.length)]; return `MH12 ${r()}${r()} 000${1 + Math.floor(Math.random() * 9)}`; }

  // ---------------------------------------------------------------- the build
  // the mods with everything on the sheet (and the option you're pointing at)
  draft(withHover = true) {
    const d = JSON.parse(JSON.stringify(this.base || {}));
    for (const q of this.queue.values()) q.set(d);
    if (withHover && this.hover != null) { const o = this.opts && this.opts[this.hover]; if (o && !o.job && !o.off) { if (o.toggle) { if (!!d[o.toggle] === !!(this.base || {})[o.toggle] && !d[o.toggle]) o.set(d); } else o.set(d); } }
    return d;
  }
  priceOf(o) { return typeof o.price === 'function' ? o.price(this.base || {}) : o.price; }
  pick(i) {
    const o = this.opts[i]; if (!o || o.off) return;
    this.focus = i;
    if (o.job) { const r = o.act(); if (r === false) { this.msg('Not enough money', 'bad'); return; } this.after(); if (r) this.msg(r, 'good'); if (this.open) this.render(); return; }
    if (o.sticker != null) { const L = this.life, U = L.s.upg; if ((U.sticker || 0) === o.sticker) return; this.queue.set('sticker', { label: `Sticker: ${o.name}`, price: this.priceOf(o), set: () => {}, run: () => { U.sticker = o.sticker; }, cat: this.cat }); this.render(); return; }
    const key = this.cat + '.' + o.slot, base = this.base || {};
    if (o.toggle) {
      const has = !!base[o.toggle], queued = this.queue.has(key);
      if (queued) this.queue.delete(key);
      else this.queue.set(key, { label: (has ? 'Remove: ' : '') + o.name, price: has ? 0 : this.priceOf(o), set: (d) => { d[o.toggle] = has ? 0 : 1; if (o.toggle === 'nitro' && !has) d.n2o = 10; }, ill: has ? '' : o.ill, cat: this.cat });
    } else if (o.is(base)) this.queue.delete(key);
    else if (this.queue.has(key) && o.is(this.draft(false))) this.queue.delete(key);
    else this.queue.set(key, { label: o.name, price: this.priceOf(o), set: o.set, ill: o.ill, cat: this.cat });
    this.hover = null; this.render(); this.preview();
  }
  customColour() {
    const q = (n) => +this.el.querySelector(`.gx-cc [name=${n}]`).value;
    const c = new THREE.Color().setHSL(q('h') / 360, q('s') / 100, q('l') / 100), p = [c.r, c.g, c.b].map(v => Math.round(Math.pow(v, 2.2) * 1000) / 1000);
    const F = F_OF[this.type] || 3, price = r10(3200 * F * Math.max(0.9, this.mul * 0.9));
    this.queue.set('paint.paint', { label: 'Custom colour', price, set: (d) => { d.paint = p.slice(); }, ill: this.cl === 'auto' ? 'Off the permit colours' : '', cat: 'paint', sw: css(p) });
    this.el.querySelector('.gx-cc i').style.background = css(p);
    this.preview(); this.renderSheet(); this.paintStats();
  }
  total() { let t = 0; for (const q of this.queue.values()) t += q.price || 0; return t; }
  fit() {
    const G = this.g, L = this.life, here = this.here, m = this.base;
    if (!this.queue.size || !m) return;
    const t = this.total();
    if (t && !G.shops.spend(t, true)) { this.msg(`Short of ${fmt(t)}, cash and bank together`, 'bad'); return; }
    const before = JSON.parse(JSON.stringify(m)), n = this.queue.size;
    for (const q of this.queue.values()) { q.set(m); if (q.run) q.run(); }
    // what some of it means beyond the vehicle
    if (m.ganpati && !before.ganpati) L.change('karma', 2);
    if (m.nimbu && !before.nimbu) L.change('mood', 0.03);
    if (m.vip && !before.vip) L.change('respect', 2);
    if (m.horn === 'truck') L.s.upg.horn = 1; if (m.seat) L.s.upg.seat = 1;
    if (m.paint && !this.isAuto && here.owned) { const rec = (L.s.vehicles || []).find(q => q.id === here.owned.id); if (rec) rec.col = m.paint.slice(); }
    this.queue.clear(); this.after();
    G.audio.cash?.(); G.shops.speak?.('garage', 'order');
    this.msg(n === 1 ? 'Fitted. Have a look' : `${n} jobs done. Have a look`, 'good');
    if (illegalOf(m, this.type).length > illegalOf(before, this.type).length) this.g.hud.toast('Not road-legal', 'A havaldar who notices can fine you ₹5,000 for each alteration, and take it off', 'warn', 3.6);
    this.render();
  }
  // after anything's changed on the real vehicle: on it, saved, and shown in the bay
  after() {
    const G = this.g, here = this.here;
    if (here && this.base) applyMods(G, here);
    if (this.isAuto) G.applyUpgrades();
    this.life.save(); G.saveStats?.();
    const I = G.interiors; if (I && I.cur && I.cur.R.tpl === 'garage') I.garageShow();
    this.preview();
  }
  papers(price) {
    const G = this.g, L = this.life, v = this.here;
    if (!G.shops.spend(price, true)) return false;
    const id = 'v' + Date.now().toString(36);
    v.stolen = false; v.owned = { id }; v.plate = G.player.randomPlate(); v.helmet = true;
    L.s.vehicles.push({ id, type: v.type, col: (v.paint || [0.5, 0.5, 0.5]).slice(), plate: v.plate });
    (L.s.mods || (L.s.mods = {}))[id] = v._tmpMods || {}; v._tmpMods = null;
    L.change('karma', -5);
    if (Math.random() < 0.15) G.later?.(60 + Math.random() * 120, () => G.police.raiseHeat(1, 'The RTO flagged a re-stamped chassis number', 'theft'));
    this.mine = true; this.base = modsOf(G, v);
    return `It’s yours: ${v.plate}. Don’t ask where the old plates went`;
  }
  sell(cash) {
    const G = this.g, P = G.player, v = this.here, L = this.life;
    if (!P.onFoot && P.cur === v) P.exit(G.traffic, true);
    const d = P.dropped.find(q => q.veh === v); if (d) P.removeDropped(d, G.traffic);
    v.dispose(); G.stats.money += cash; G.audio.cash?.(); G.saveStats();
    L.change('karma', -5); L.s.tally.chopped = (L.s.tally.chopped || 0) + 1;
    if (Math.random() < 0.2) G.later?.(30 + Math.random() * 60, () => G.police.raiseHeat(1, 'The owner traced the vehicle to the garage', 'theft'));
    const I = G.interiors; if (I && I.cur && I.cur.R.live) { I.cur.R.live.dispose(); I.cur.R.live = null; }
    this.close(); G.hud.toast(`Sold for ${fmt(cash)}`, 'It was never here', 'warn', 3);
    return '';
  }

  // ---------------------------------------------------------------- drawing
  render() {
    const cats = this.cats = this.catalogue(), here = this.here, G = this.g;
    if (!cats.find(c => c.id === this.cat)) this.cat = 'bay';
    const C = cats.find(c => c.id === this.cat);
    this.opts = C ? C.opts : [];
    // the vehicle
    const nm = !here ? 'Nothing in the bay' : this.isAuto ? 'Your auto' : (this.mine ? 'Your ' : '') + here.spec.name.toLowerCase();
    this.el.querySelector('.gx-veh b').textContent = nm.charAt(0).toUpperCase() + nm.slice(1);
    this.el.querySelector('.gx-veh span').textContent = here ? (this.isAuto ? G.police.plate : here.plate || '') + (here.spec ? ` · ${here.spec.model}` : '') : 'Park it outside and come in';
    const ill = illegalOf(this.draft(false), this.type);
    this.el.querySelector('.gx-chips').innerHTML = [
      this.gov ? `<span class="gx-chip red">${g('lock')}Government vehicle</span>` : this.rental ? `<span class="gx-chip">${g('lock')}Rental</span>` : !this.mine && here ? `<span class="gx-chip amber">${g('warn')}Not yours · mods go with it</span>` : here ? `<span class="gx-chip green">${g('check')}Yours</span>` : '',
      ill.length ? `<span class="gx-chip red">${g('warn')}${ill.length} illegal</span>` : this.base ? `<span class="gx-chip green">${g('check')}RTO clean</span>` : ''].join('');
    // categories
    let grp = '', h = '';
    for (const c of cats) {
      if (c.group !== grp) { grp = c.group; h += `<div class="gx-g">${grp}</div>`; }
      const q = [...this.queue.values()].filter(x => x.cat === c.id).length;
      h += `<button type="button" class="gx-c${c.id === this.cat ? ' on' : ''}" data-cat="${c.id}">${g(c.icon, 'gx-ci')}<span><b>${esc(c.name)}</b><small>${esc(c.cur || '')}</small></span>${q ? `<em>${q}</em>` : ''}</button>`;
    }
    this.el.querySelector('.gx-cats').innerHTML = h;
    // the options
    this.el.querySelector('.gx-oi').innerHTML = C ? g(C.icon) : '';
    this.el.querySelector('.gx-oh h3').textContent = C ? C.name : '';
    this.el.querySelector('.gx-oh p').textContent = C ? C.blurb : '';
    const d = this.draft(false), base = this.base || {}, U = this.life.s.upg || {};
    let o = '';
    if (this.cat === 'paint') {
      o += '<div class="gx-sws">';
      this.opts.forEach((q, i) => { if (!q.sw) return; const fitted = q.is(base), sel = q.is(d); o += `<button type="button" class="gx-sw${sel ? ' on' : ''}${fitted ? ' fit' : ''}${i === this.focus ? ' kb' : ''}" data-o="${i}" title="${esc(q.name)}" style="--c:${q.sw}"><i></i><span>${esc(q.name)}</span></button>`; });
      o += '</div>';
      const cq = this.queue.get('paint.paint');
      o += `<div class="gx-cc"><div class="gx-cch"><i style="background:${cq && cq.sw ? cq.sw : '#888'}"></i><b>Custom colour</b><small>Any shade you can name</small></div><label>Hue<input type="range" name="h" min="0" max="360" value="200"></label><label>Saturation<input type="range" name="s" min="0" max="100" value="70"></label><label>Lightness<input type="range" name="l" min="4" max="85" value="40"></label></div>`;
      if (this.opts.some(q => q.chip)) { o += '<div class="gx-fh">Finish</div><div class="gx-fins">'; this.opts.forEach((q, i) => { if (!q.chip) return; o += `<button type="button" class="gx-fin fin-${q.finishK}${q.is(d) ? ' on' : ''}${i === this.focus ? ' kb' : ''}" data-o="${i}"><i></i><b>${esc(q.name)}</b><small>${q.is(base) ? 'On it' : this.priceOf(q) ? fmt(this.priceOf(q)) : 'Free'}</small></button>`; }); o += '</div>'; }
    } else {
      this.opts.forEach((q, i) => {
        const fitted = q.job ? false : q.sticker != null ? q.isU() : q.is(base), sel = q.job ? false : q.sticker != null ? this.queue.has('sticker') && this.queue.get('sticker').label.endsWith(q.name) : q.is(d);
        const p = this.priceOf(q), tag = q.off ? q.off : fitted && sel ? 'Fitted' : sel ? 'On the sheet' : q.job ? (q.cash ? `+${fmt(q.cash)}` : p ? fmt(p) : 'Free') : fitted ? 'Remove' : p ? fmt(p) : 'Free';
        o += `<button type="button" class="gx-o${sel ? ' on' : ''}${fitted ? ' fit' : ''}${q.job ? ' job' : ''}${i === this.focus ? ' kb' : ''}" data-o="${i}"${q.off ? ' disabled' : ''}>${q.sw ? `<i class="gx-dot" style="background:${q.sw}"></i>` : q.icon ? g(q.icon, 'gx-oic') : `<i class="gx-tick">${sel ? g('check') : ''}</i>`}<span class="gx-on"><b>${esc(q.name)}</b><small>${esc(q.note || '')}</small>${q.ill ? `<span class="gx-ill">${g('warn')}Challan risk · ${esc(q.ill)}</span>` : ''}</span><em>${esc(tag)}</em></button>`;
      });
      if (!this.opts.length) o = '<div class="gx-empty">Nothing here for this one</div>';
    }
    this.el.querySelector('.gx-ol').innerHTML = o;
    const kb = this.el.querySelector('.gx-ol .kb'); if (kb) kb.scrollIntoView({ block: 'nearest' });
    this.renderSheet(); this.paintStats();
  }
  renderSheet() {
    const G = this.g, L = this.life;
    const rows = [...this.queue.entries()].map(([k, q]) => `<div class="gx-row">${q.sw ? `<i class="gx-dot" style="background:${q.sw}"></i>` : ''}<span>${esc(q.label)}${q.ill ? ` <b class="gx-r-ill">${g('warn')}</b>` : ''}</span><em>${q.price ? fmt(q.price) : 'Free'}</em><button type="button" data-x="${k}" aria-label="Remove">×</button></div>`).join('');
    this.el.querySelector('.gx-sl').innerHTML = rows || '<div class="gx-none">Pick something: it goes on the sheet and on the vehicle</div>';
    const t = this.total(), have = G.stats.money + (L.s.bank || 0);
    this.el.querySelector('.gx-tot span').textContent = `Cash ${fmt(G.stats.money)}${L.s.bank ? ` · bank ${fmt(L.s.bank)}` : ''}`;
    this.el.querySelector('.gx-tot b').textContent = this.queue.size ? fmt(t) : '';
    const b = this.el.querySelector('.gx-fit');
    b.disabled = !this.queue.size || (!G.free && t > have);
    b.textContent = !this.queue.size ? 'Nothing to fit' : !G.free && t > have ? `Short of ${fmt(t - have)}` : `Pay and fit · ${t ? fmt(t) : 'Free'}`;
    this.el.querySelector('.gx-sheet').classList.toggle('has', this.queue.size > 0);
  }
  paintStats() {
    const el = this.el.querySelector('.gx-stats');
    if (!this.here || !this.base) { el.innerHTML = ''; return; }
    const a = statsOf(this.type, this.base), b = statsOf(this.type, this.draft(true));
    const row = (icon, name, va, vb, frac, txt, better) => {
      const fa = Math.max(0.03, Math.min(1, frac(va))), fb = Math.max(0.03, Math.min(1, frac(vb))), d = vb - va, up = better(d) > 0;
      return `<div class="gx-st">${g(icon)}<span class="gx-sn">${name}</span><span class="gx-bar"><i style="width:${Math.min(fa, fb) * 100}%"></i>${d ? `<u class="${up ? 'up' : 'dn'}" style="left:${Math.min(fa, fb) * 100}%;width:${Math.abs(fb - fa) * 100}%"></u>` : ''}</span><b class="${d ? (up ? 'up' : 'dn') : ''}">${txt(vb)}</b></div>`;
    };
    const ill = illegalOf(this.draft(true), this.type);
    el.innerHTML = row('bolt', 'Top speed', a.top, b.top, v => v / 200, v => `${v} km/h`, d => d)
      + row('run', `0–${b.to}`, a.t0, b.t0, v => 1 - v / 26, v => v >= 99 ? '—' : `${v.toFixed(1)} s`, d => -d)
      + row('disc', `Stops from ${b.to}`, a.stop, b.stop, v => 1 - v / 40, v => `${v.toFixed(1)} m`, d => -d)
      + row('tyre', 'Grip', a.grip, b.grip, v => v / 1.05, v => `${v.toFixed(2)} g`, d => d)
      + row('shield', 'Toughness', a.tough, b.tough, v => (v - 70) / 160, v => `${v}%`, d => d)
      + `<div class="gx-rto ${ill.length ? 'bad' : 'ok'}">${g(ill.length ? 'warn' : 'check')}<span>${ill.length ? `${ill.map(q => q[1]).join(', ')}: up to ${fmt(5000 * Math.min(3, ill.length))} if a havaldar stops you, and it comes off` : 'Road-legal. Nothing for the traffic police to say'}</span></div>`
      + (b.n2o ? `<div class="gx-keys"><span class="kbd">Shift</span> nitrous${this.draft(true).hydro ? ' · <span class="kbd">G</span> hop' : ''}${this.draft(true).beacon ? ' · <span class="kbd">N</span> roof lights' : ''}${this.draft(true).dj ? ' · <span class="kbd">U</span> music' : ''}</div>` : (() => { const d = this.draft(true), k = [d.hydro ? '<span class="kbd">G</span> hop' : '', d.beacon ? '<span class="kbd">N</span> roof lights' : '', d.dj ? '<span class="kbd">U</span> music' : ''].filter(Boolean); return k.length ? `<div class="gx-keys">${k.join(' · ')}</div>` : ''; })());
  }
  msg(t, kind) { const m = this.el.querySelector('.gx-msg'); m.textContent = t || ''; m.className = 'gx-msg' + (kind ? ' ' + kind : '') + (t ? ' show' : ''); clearTimeout(this._mt); if (t) this._mt = setTimeout(() => m.classList.remove('show'), 2600); }

  // ---------------------------------------------------------------- the vehicle in the bay
  live() { const I = this.g.interiors; return I && I.cur && I.cur.R.tpl === 'garage' ? I.cur.R.live : null; }
  preview() {
    const v = this.live(); if (!v || !this.here) return;
    const G = this.g, U = this.life.s.upg || {}, q = this.queue.get('sticker');
    const sticker = this.isAuto ? STICKERS[q ? +STICKERS.indexOf(q.label.replace('Sticker: ', '')) : (U.sticker || 0)] || STICKERS[0] : null;
    applyMods(G, v, { mods: this.open ? this.draft(true) : this.base || {}, sticker, dmg: this.here.dmg || 0, auto: this.isAuto });
  }
  // the camera, every frame while it's open: round the vehicle, eased towards the category's view
  update(dt) {
    if (!this.open) return;
    const v = this.live(), G = this.g, cam = G.camera; if (!v) return;
    const k = Math.min(1, dt * 4), go = this.goal || { yaw: 0.7, pitch: 0.3, dist: 1 };
    for (const p of ['yaw', 'pitch', 'dist']) this.cam[p] += (go[p] - this.cam[p]) * k;
    const S = v.spec, Lv = S.L, R = G.interiors.cur.R;
    const yaw = (v.th || 0) - this.cam.yaw + this.cam.dy, pitch = Math.max(-0.1, Math.min(1.1, this.cam.pitch + this.cam.dp));
    const dist = (Lv * 1.05 + 2.6) * this.cam.dist * this.cam.dz;
    const tx = v.x, ty = (v.y || 0) + (S.two ? 0.6 : Math.min(1.1, 0.45 + Lv * 0.07)), tz = v.z;
    let x = tx + Math.cos(yaw) * Math.cos(pitch) * dist, y = ty + Math.sin(pitch) * dist + 0.2, z = tz + Math.sin(yaw) * Math.cos(pitch) * dist;
    // inside the walls
    const pad = 0.35; x = Math.max(R.O.x - R.W / 2 + pad, Math.min(R.O.x + R.W / 2 - pad, x)); z = Math.max(R.O.z + pad, Math.min(R.O.z + R.D - pad, z)); y = Math.max(0.35, Math.min(R.H - 0.3, y));
    cam.position.set(x, y, z); cam.up.set(0, 1, 0); cam.lookAt(tx, ty, tz);
    // a wall in the way brings the camera in: a wider lens keeps the whole vehicle in frame
    const got = Math.hypot(x - tx, y - ty, z - tz), want = Math.hypot(dist, 0.2);
    const fov = Math.min(68, 2 * Math.atan(Math.tan(21 * Math.PI / 180) * want / Math.max(0.5, got)) * 180 / Math.PI);
    this._fov = this._fov ? this._fov + (fov - this._fov) * k : fov;
    if (Math.abs(cam.fov - this._fov) > 0.05) { cam.fov = this._fov; cam.updateProjectionMatrix(); }
  }
}
// the mouse icons from the map's bottom bar
function mouse(b) { return `<svg class="gx-mouse" viewBox="0 0 16 22" aria-hidden="true"><rect x="1" y="1" width="14" height="20" rx="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1v8" stroke="currentColor" stroke-width="1.4"/>${b === 'l' ? '<path d="M8 1.6a6.4 6.4 0 0 0-6.4 6.4V9H8z" fill="#f1e6cf"/>' : '<rect x="6.6" y="4" width="2.8" height="4.5" rx="1.4" fill="#f1e6cf"/>'}</svg>`; }
