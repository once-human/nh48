// Dates that go somewhere. Asking someone out (or them asking you) picks what you'll do from who they are, the
// hour and how well you know each other, at a real place near you that's open: a chai or a coffee (a table
// inside, as before), dinner, a walk in a garden, a film, bowling, or a ride on your bike. For the ones outside
// they wait at the gate or the door, on their phone; they wave when they see you, and then they're with you:
// walking beside you wherever you go, on the back of your two-wheeler or in the seat next to you, in through any
// door you take (a table for two if the place has them). Buy something with them there and you pay for both.
// A garden walk is talk as you go; a ride is how you ride it (the shy hate you flooring it, the flirty love it).
// T talks to them any time. Say bye and they wave and head off; leave them standing and they're gone, and hurt.
import { People } from '@orig/people/peds.js';
import { Crowd } from '@orig/people/crowd.js';
import { Dates } from '@orig/game/date.js';
import { Shops, openNow } from '@orig/game/shops.js';
import { Interiors } from '@orig/world/interiors.js';
import { castAs, castByName } from '@orig/people/cast.js';
import { specOf } from '@orig/vehicles/vehicle.js';

let O = null;                     // the outing on now
export const outing = () => O;
const G_ = () => window.__nhAskG;
const KINDS = {
  chai:   { in: true,  kinds: ['cafe', 'bakery', 'juice', 'icecream', 'sweets'], label: 'a chai' },
  dinner: { in: true,  kinds: ['food'], label: 'dinner', aff: 35, hours: [19, 23.5] },
  garden: { in: false, kinds: ['park'], label: 'a walk', hours: [6, 19.5] },
  film:   { in: false, kinds: ['cinema'], label: 'a film', aff: 22, hours: [11, 22.5] },
  bowl:   { in: false, kinds: ['gaming'], label: 'bowling', aff: 15, hours: [11, 22.5] },
  ride:   { in: false, kinds: ['park', 'landmark', 'temple'], label: 'a ride', aff: 30, hours: [7, 22] },
};
// who'd pick what
const TASTE = { shy: { chai: 3, garden: 3, film: 2 }, witty: { bowl: 3, film: 2, chai: 1 }, flirty: { ride: 3, dinner: 3, bowl: 1 }, serious: { garden: 3, chai: 2, dinner: 1 }, chill: { chai: 2, garden: 2, ride: 2, film: 1, bowl: 1 } };
const SMS = {
  garden: [['Walk in {place}? Meet me at the gate.', 'चल {place} ला फिरायला? गेटवर भेट.', '{place} chalein ghoomne? Gate pe milo.']],
  film:   [['Film at {place}? Meet me outside.', '{place} ला पिक्चर? बाहेर भेटू.', '{place} mein movie? Bahar milte hain.']],
  bowl:   [['Bowling at {place}. Loser buys, outside in a bit?', '{place} ला बोलिंग? हरेल तो पैसे देईल!', '{place} pe bowling? Haarega woh pay karega!']],
  ride:   [['Take me for a ride? Pick me up at {place}.', 'मला राईडला ने ना. {place} जवळ ये.', 'Ride pe le chalo na. {place} ke paas aao.']],
};
const L_IDX = { en: 0, mr: 1, hi: 2 };
const fakeRoom = (place) => ({ R: { peds: [], tpl: 'cafe', seats: [] }, outside: true, ctx: { name: place.name } });

function choose(D, ct) {
  const G = D.g, P = G.player, h = G.hour || 0, near = G.shops.nearby(P.x, P.z, 1600);
  const taste = TASTE[ct.vibe] || TASTE.chill, opts = [];
  for (const [k, K] of Object.entries(KINDS)) {
    if (K.aff && (ct.aff || 0) < K.aff) continue;
    if (K.hours && (h < K.hours[0] || h > K.hours[1])) continue;
    const pl = near.filter(s => K.kinds.includes(s.kind) && (() => { try { const o = openNow(s, h); return !o || o.open; } catch { return true; } })());
    if (!pl.length) continue;
    opts.push([k, pl[Math.min(pl.length - 1, D.rng.int(0, 3))], (taste[k] || 0.5) + (k === 'chai' ? 0.5 : 0)]);
  }
  if (!opts.length) return null;
  let r = D.rng.next()*opts.reduce((a, o) => a + o[2], 0);
  for (const o of opts) if ((r -= o[2]) <= 0) return o;
  return opts[0];
}
function plan(D, ct, theyAsked) {
  const G = D.g, c = choose(D, ct);
  if (!c) return null;
  const [kind, place] = c, K = KINDS[kind];
  const now = G.clock || 0;
  if (K.in) {
    // a table inside: the way it always went (date.js onEnter seats them)
    D.pending = { ct, place, until: now + 2, gone: now + 3.5 };
    D.sms(ct, theyAsked ? 't_askout' : 't_yes', 'On your map', { place: place.name });
  } else {
    O = { ct, place, kind, until: now + 2, gone: now + 3.5, p: null, met: false, ride: false, far: 0, walkT: 0, talks: 0, paid: 0, dist: 0, rideT: 0 };
    const row = SMS[kind][0], i = L_IDX[ct.lang || 'en'] ?? 0;
    G.hud.sms(ct.name, row[i].replace('{place}', place.name), '', [i ? row[0].replace('{place}', place.name) : '', 'On your map'].filter(Boolean).join(' · '));
  }
  G.setWaypoint({ x: place.x, z: place.z, name: `${K.label[0].toUpperCase() + K.label.slice(1)} with ${ct.name}: ${place.name}` });
  return kind;
}

const ask = Dates.prototype.askToMeet;
Dates.prototype.askToMeet = function (ct) {
  if (ct.done || (ct.upset && this.rng.next() < 0.5) || O || this.pending) return ask.call(this, ct);
  if (this.rng.next() < 0.18 && !ct.partner) { this.sms(ct, 't_busy'); return true; }
  const k = plan(this, ct, false);
  if (!k) return ask.call(this, ct);
  return true;
};
const inv = Dates.prototype.invite;
Dates.prototype.invite = function (ct) {
  if (O || this.pending) return;
  if (!plan(this, ct, true)) return inv.call(this, ct);
};

// they're here, outside: a body at the gate, on their phone
function spawn(G) {
  const ct = O.ct, pl = O.place, ppl = G.people, kit = G.W.kit;
  const e = G.W.graph.edges[0];
  const p = ppl.make(e, 1, 1, { female: !!ct.female, mode: 'fixed', adult: true });
  let x = pl.x + 0.9, z = pl.z + 0.9;
  const r = G.W.collision.resolve(x, z, 0.3); if (r && r.kind !== 3) { x += r.nx*r.depth; z += r.nz*r.depth; }
  Object.assign(p, { fixed: true, mode: 'fixed', x, z, yaw: Math.atan2(pl.z - z, pl.x - x) + Math.PI, anim: 'phone', idle: 'phone', onRoad: false, v: 0 });
  p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
  p.persona = ct.female ? 'collegegirl' : 'collegeboy';
  const cm = castByName(ct.name, ct.female); if (cm && kit) castAs(p, cm, kit);
  else if (kit) { const L = kit.randomLook({ next: Math.random, chance: q => Math.random() < q, range: (a, b) => a + Math.random()*(b - a), pick: a => a[Math.floor(Math.random()*a.length)], int: (a, b) => a + Math.floor(Math.random()*(b - a + 1)) }, { female: !!ct.female }); p.look = L; }
  p.name = ct.name; p.dateWith = true; p.interest = 60; p.outing = true;
  p.prof = { lang: ct.lang || 'en', vibe: ct.vibe || 'chill', likes: ct.likes, job: ct.job ?? 0, area: ct.area ?? 0, picky: 0.4, known: { job: true, likes: true, area: true, vibe: true }, asked: { ask_job: 1, ask_area: 1, ask_fun: 1 } };
  p._room = fakeRoom(pl);
  ct.dateNow = true; ct.late = (G.clock || 0) > O.until;
  O.p = p;
}
function end(G, how) {
  if (!O) return;
  const o = O, p = o.p, ct = o.ct; O = null;
  if (o.pil) o.pil.rideOf.rich = false;
  ct.dateNow = false; ct.lastSeen = G.clock || 0; ct.missed = false;
  if (how === 'left') {
    ct.aff = Math.max(0, ct.aff - 10); ct.upset = true;
    const i = L_IDX[ct.lang || 'en'] ?? 0, t = ['You just left me standing there?', 'मला तिथेच सोडून गेलास?', 'Mujhe wahin chhod ke chale gaye?'][i];
    G.hud.sms(ct.name, t, '', i ? 'You just left me standing there?' : 'They went home, hurt');
  } else if (how === 'bye' && ct.aff > 55 && !ct.upset) G.hud.toast(`A hug from ${ct.name}`, 'Before they head home', 'good', 2.4);
  if (p) {
    p.hidden = false; p.anim = 'wave'; p.idle = 'wave'; p.v = 0; p.dateWith = false;
    setTimeout(() => G.people.remove(p), how === 'left' ? 0 : 2600);
  }
}

// a ride: they're the second body on your seat
function pillion(G, veh) {
  const t = veh.type, bike = /bike|bullet|superbike/.test(t), side = !!O.ct.female && !bike && O.ct.vibe !== 'flirty' && (O.ct.job % 3 === 0);
  const px = { x: veh.x, z: veh.z, y: veh.y || 0, yaw: veh.th, hx: Math.cos(veh.th), hz: Math.sin(veh.th), roll: veh.lean || 0, pitch: veh.pitch || 0, type: bike ? 'bikeP' : 'scooterP', rich: true, id: 7777 };
  O.pil = { id: 9e7 + 1, look: O.p.look, female: !!O.ct.female, rideOf: px, seat: [bike ? -0.38 : -0.44, 0], seatY: (bike ? 0.97 : 0.84) - 0.62, sideSaddle: side, seatIdx: 1, drvX: 0, x: veh.x, z: veh.z, yaw: 0, v: 0, mode: 'ride', persona: O.p.persona, name: O.ct.name };
}
const riders = Crowd.prototype.riders;
Crowd.prototype.riders = function () {
  const out = riders.call(this);
  if (O && O.pil && O.pil.rideOf.rich) {
    const R = O.pil, o = R.rideOf, hx = o.hx, hz = o.hz;
    R.x = o.x + hx*R.seat[0]; R.z = o.z + hz*R.seat[0]; R.yaw = Math.atan2(hz, hx); R.y = o.y;
    out.push(R);
  }
  return out;
};

const upd = People.prototype.update;
People.prototype.update = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), G = this._G;
  if (!O || !G || !G.player) return out;
  const P = G.player, now = G.clock || 0, D = G.date, I = G.interiors;
  if (!O.p) {
    if (now > O.gone) { const ct = O.ct; O = null; ct.aff = Math.max(0, ct.aff - 12); ct.upset = true; D.sms(ct, 't_angry', 'You were too late. They left'); return out; }
    if (Math.hypot(P.x - O.place.x, P.z - O.place.z) < 90) spawn(G);
    return out;
  }
  const p = O.p, F = P.foot;
  if (O.inside) return out;
  // on a ride with you: keep their seat with the machine
  if (!P.onFoot && O.ride) {
    const v = P.cur;
    if (O.pil) { const o = O.pil.rideOf; o.x = v.x; o.z = v.z; o.y = v.y || 0; o.yaw = v.th; o.hx = Math.cos(v.th); o.hz = Math.sin(v.th); o.roll = v.lean || 0; o.pitch = v.pitch || 0; }
    p.x = v.x; p.z = v.z;
    const sp = Math.abs(v.v || 0);
    O.dist += sp*dt;
    if ((O.rideT -= dt) <= 0) {
      O.rideT = 4;
      const kmh = sp*3.6, ct = O.ct, vb = ct.vibe;
      if (kmh > 75 && (vb === 'shy' || vb === 'serious')) { ct.aff = Math.max(0, ct.aff - 2); G.hud.toast(`${ct.name}: “Slow down!”`, 'They’re holding on tight', 'warn', 2); }
      else if (kmh > 70 && (vb === 'flirty' || vb === 'witty')) { ct.aff = Math.min(100, ct.aff + 1); G.hud.toast(`${ct.name}: “Faster!”`, 'They’re loving it', 'good', 1.8); }
      if (O.dist > 500*(1 + (O.legs || 0)) && (O.legs || 0) < 6) { O.legs = (O.legs || 0) + 1; ct.aff = Math.min(100, ct.aff + 2); }
    }
    return out;
  }
  if (P.onFoot && O.ride) {
    // off again: beside you
    O.ride = false; p.hidden = false; if (O.pil) O.pil.rideOf.rich = false; O.pil = null;
    p.x = F.x + Math.sin(F.yaw)*0.9; p.z = F.z - Math.cos(F.yaw)*0.9;
  }
  const dx = F.x - p.x, dz = F.z - p.z, d = Math.hypot(dx, dz);
  if (!O.met) {
    if (d < 3.2) {
      O.met = true; p.anim = 'wave'; p.idle = 'wave';
      setTimeout(() => { if (O && O.p === p) { p.anim = 'idle'; p.idle = 'idle'; } }, 1500);
      D.twoTiming(O.ct); D.heardOf(O.ct, O.place.name);
      G.hud.toast(`${O.ct.name} is here`, `They’re with you now. T to talk${O.kind === 'ride' ? '. Get on your bike' : ''}`, 'good', 3);
    }
    return out;
  }
  // getting into something: they get on with you
  if (!P.onFoot) {
    const v = P.cur, S = v && (v === P.auto ? specOf('auto') : v.spec);
    if (v && Math.hypot(v.x - p.x, v.z - p.z) < 7) {
      if (S && S.two && v.type === 'cycle') { /* not on a cycle */ }
      else {
        O.ride = true; p.hidden = true;
        if (S && S.two) pillion(G, v);
        G.hud.toast(S && S.two ? `${O.ct.name} gets on behind you` : `${O.ct.name} gets in`, '', 'info', 1.8);
        return out;
      }
    }
  }
  // walking with you: at your left shoulder
  const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
  const tx = F.x + fz*0.85 - fx*0.25, tz = F.z - fx*0.85 - fz*0.25;
  const ex = tx - p.x, ez = tz - p.z, ed = Math.hypot(ex, ez);
  if (d > 30) { p.x = F.x - fx*1.5; p.z = F.z - fz*1.5; }
  else if (ed > 0.2 && P.onFoot && !I.inside) {
    const sp = Math.min(ed*2.4, Math.max(1.3, Math.hypot(F.vx || 0, F.vz || 0) + 0.6), 5.5), st = Math.min(ed, sp*dt);
    p.x += ex/ed*st; p.z += ez/ed*st;
    const r = G.W.collision.resolve(p.x, p.z, 0.28); if (r && r.kind !== 3) { p.x += r.nx*r.depth; p.z += r.nz*r.depth; }
    const want = Math.atan2(ez, ex); let dy = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)); p.yaw += dy*Math.min(1, dt*8);
    p.v = sp; p.anim = null;
  } else {
    p.v = 0; p.anim = 'idle'; p.idle = 'idle';
    const want = Math.atan2(dz, dx); let dy = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)); p.yaw += dy*Math.min(1, dt*3);
  }
  p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
  // left behind
  O.far = d > 40 && P.onFoot ? O.far + dt : !P.onFoot && !O.ride ? O.far + dt*0.5 : 0;
  if (O.far > 20) { end(G, 'left'); return out; }
  // a walk in the garden: the talk as you go
  if (O.kind === 'garden' && d < 4 && Math.hypot(F.x - O.place.x, F.z - O.place.z) < 80 && O.talks < 5) {
    O.walkT += dt;
    if (O.walkT > 22) {
      O.walkT = 0; O.talks++;
      const l = D.line(p, ['date_day', 'date_share', 'laugh', 'date_plan', 'date_deep'][Math.min(4, O.talks - 1)]);
      O.ct.aff = Math.min(100, O.ct.aff + 3);
      G.hud.toast(l.t ? `${O.ct.name}: “${l.t}”` : `${O.ct.name} tells you about their week`, l.en && l.en !== l.t ? l.en : 'A walk and a talk', 'good', 4);
    }
  }
  return out;
};

// buy something with them there: one for them too
const spend = Shops.prototype.spend;
Shops.prototype.spend = function (price, ...a) {
  const ok = spend.call(this, price, ...a);
  if (!ok || !O || !O.met || O._pay || !(price > 0) || price > 6000 || O.paid >= 4 || (this.g.date && this.g.date.cur)) return ok;     // (ordering for both at the table is already for both)
  const P = this.g.player, p = O.p;
  if (!O.ride && Math.hypot(P.x - p.x, P.z - p.z) > 6 && !O.inside) return ok;
  O._pay = true;
  const two = spend.call(this, price, ...a);
  O._pay = false;
  if (two) {
    O.paid++; O.ct.aff = Math.min(100, O.ct.aff + (O.kind === 'film' || O.kind === 'bowl' ? 6 : 4));
    this.g.later(0.6, () => this.g.hud.toast(`One for ${O ? O.ct.name : 'them'} too`, `₹${price} more · they smile`, 'good', 2.2));
  }
  return ok;
};

// T on the street (game/talk.js) finds them; the chat is the date's
const talk = Dates.prototype.talk;
Dates.prototype.talk = function (p, room) {
  return talk.call(this, p, room || p._room || fakeRoom({ name: 'here' }));
};
// a chat ended: only a goodbye ends the outing
const close = Dates.prototype.close;
Dates.prototype.close = function (bye, keep) {
  const c = this.cur, G = this.g;
  const ours = O && c && c.p === O.p && !O.inside;
  if (ours && !bye) {
    // (date.js treats any end of the chat as goodbye: keep them with you)
    const ct = O.ct, p = O.p, up = ct.upset;
    ct.upset = true;                      // (and no "reached home" text yet)
    const r = close.call(this, bye, keep);
    ct.upset = up; ct.dateNow = true; p.walkedOff = false; p.dateWith = true;
    return r;
  }
  const r = close.call(this, bye, keep);
  if (ours && bye) end(G, 'bye');
  return r;
};

// in through a door together: a table for two if there is one
const onEnter = Dates.prototype.onEnter;
Dates.prototype.onEnter = function (R, ctx) {
  if (O && O.met && !O.ride && O.p) {
    O.inside = true; O.p.hidden = true;
    this.pending = { ct: O.ct, place: { name: ctx.name, x: ctx.x, z: ctx.z }, until: 1e12, gone: 1e12 };
    if (O.kind === 'film' && ctx.kind === 'cinema') O.ct.aff = Math.min(100, O.ct.aff + 5);
  }
  return onEnter.call(this, R, ctx);
};
const exit = Interiors.prototype.exit;
Interiors.prototype.exit = function (...a) {
  const r = exit.call(this, ...a), G = this.g;
  if (O && O.inside) {
    O.inside = false;
    const ct = O.ct;
    if (this.g.date && this.g.date.pending && this.g.date.pending.ct === ct) this.g.date.pending = null;
    if (!ct.dateNow && O.p) {
      // the date ended at the table: they left from there
      const p = O.p; O.p = null; G.people.remove(p); O = null;
    } else if (O.p) {
      const F = G.player.foot; O.p.hidden = false; O.p.x = F.x - Math.cos(F.yaw)*1.2; O.p.z = F.z - Math.sin(F.yaw)*1.2;
      ct.dateNow = true;
    }
  }
  return r;
};
