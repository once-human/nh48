// You, as a person in Pune: hunger, thirst, energy and mood that move slowly with the clock (gently:
// a full stomach lasts most of a game day), plus the things that change how the city treats you:
//   respect   street cred: rides well driven, deliveries, fights won, property owned (and lost when
//             you're beaten up). High respect: people greet you, the dadas think twice.
//   karma     feeding strays and cows, helping out (+); hitting people, stealing, running people
//             over (−). Low karma and people avoid you, cops are stricter, aajis mutter.
//   style     what you wear against where you are: a crisp shirt in KP, a kurta in the peths. A man
//             in a saree is fine by the game, the street will have opinions.
//   fitness   from the gym: more health, harder punches.
//   drunk     from the bar: the camera sways and the police will notice if you drive.
// Plus what you carry (the backpack), what you own (vehicles, property, outfits) and your bank.
// Saved under nh48_life.
import { safeStorage, clamp } from '../core/util.js';

const KEY = 'nh48_life';
// per game hour (1 game hour = 3 real minutes)
const DECAY = { hunger: 1 / 30, thirst: 1 / 24, energy: 1 / 30 };

// things you can carry: name, what it does when you use it
export const ITEMS = {
  water: { name: 'Water bottle', use: { thirst: 0.45 }, note: 'Bisleri-style, 1 litre' },
  tiffin: { name: 'Parcel meal', use: { hunger: 0.45, mood: 0.03 }, note: 'Packed from a restaurant' },
  vadapav: { name: 'Vada pav (parcel)', use: { hunger: 0.3, mood: 0.03 }, note: 'Still warm' },
  biscuit: { name: 'Parle-G', use: { hunger: 0.08 }, note: 'Or feed a street dog (F near one)', feed: 'dog' },
  banana: { name: 'Bananas', use: { hunger: 0.15 }, note: 'Or feed a cow (F near one)', feed: 'cow' },
  chikki: { name: 'Lonavala chikki', use: { hunger: 0.12, energy: 0.05 } },
  medkit: { name: 'First-aid kit', use: { hp: 60 }, note: 'Used automatically if you’re about to be knocked out' },
  painkiller: { name: 'Painkiller strip', use: { hp: 25 } },
  ors: { name: 'ORS sachet', use: { thirst: 0.35, hp: 8 } },
  energy: { name: 'Energy drink', use: { energy: 0.35, thirst: 0.15 } },
  coldcoffee: { name: 'Cold coffee (to go)', use: { energy: 0.2, thirst: 0.2, mood: 0.03 } },
  bakarwadi: { name: 'Bakarwadi box', gift: 40, use: { hunger: 0.15, mood: 0.05 }, note: 'Offer it to a passenger: a bigger tip' },
  barfi: { name: 'Amba barfi box', gift: 50, use: { hunger: 0.12, mood: 0.06 }, note: 'A gift passengers love' },
  shrewsbury: { name: 'Shrewsbury biscuits', gift: 45, use: { hunger: 0.15, mood: 0.05 }, note: 'The Pune gift. Passengers tip more' },
  gajra: { name: 'Mogra gajra', gift: 20, use: { mood: 0.08 }, note: 'Smells of summer evenings' },
  book: { name: 'Paperback novel', use: { mood: 0.08, energy: -0.02 } },
  lottery: { name: 'Lottery ticket', note: 'Scratch it from the bag', scratch: true },
  torch: { name: 'Torch', note: 'Lights the way after dark. L to switch it on or off', tool: true },
  roses: { name: 'A dozen roses', note: 'Give them on a date', gift: 0, use: { mood: 0.02 } },
  dogfood: { name: 'Dog food pouch', note: 'Feed a street dog (F near one): it follows you all evening', feed: 'dog' },
  beer: { name: 'Beer (pint)', use: { drunk: 0.3, thirst: 0.1, mood: 0.05 } },
};

export class Life {
  constructor(G) {
    this.g = G;
    this.s = Object.assign({
      hunger: 0.85, thirst: 0.85, energy: 0.9, mood: 0.7, respect: 0, karma: 0, fitness: 0, drunk: 0,
      inv: { water: 1, biscuit: 2, torch: 1 }, bank: 0, gold: 0, props: [], vehicles: [], wardrobe: [], look: null, upg: {}, phone: false, zwiggy: false,
      tally: { deliveries: 0, fightsWon: 0, knockedOut: 0, fed: 0, meals: 0, rentEarned: 0 }, lastRentDay: -1,
    }, this.load() || {});
    // older saves start with a torch too
    if (!this.s.torchGiven) { this.s.torchGiven = 1; if (!this.s.inv.torch) this.s.inv.torch = 1; }
    // karma and respect used to swing hard: a save from then is brought to where the slower rules would have it
    if (!this.s.repSlow) { this.s.repSlow = 1; this.s.karma = Math.round((this.s.karma || 0) * 0.35); this.s.respect = Math.round((this.s.respect || 0) * 0.35); }
    this.warned = {};
    this.saveT = 0;
  }
  load() { const st = safeStorage(); try { return st ? JSON.parse(st.getItem(KEY) || 'null') : null; } catch (e) { return null; } }
  save() { const st = safeStorage(); if (st) try { st.setItem(KEY, JSON.stringify(this.s)); } catch (e) { /* ignore */ } }

  // experience: what you've lived through here, counted from what you've done (so every old save has it too):
  // the story, rides and deliveries, fights won, strays fed, races, homes bought. Levels get further apart
  xp() {
    const G = this.g, s = this.s, T = s.tally || {}, st = s.story1 || {};
    return Math.round((st.m || 0) * 250 + Math.max(0, st.step || 0) * 25 + ((G.stats && G.stats.rides) || 0) * 20 + (T.deliveries || 0) * 15 + (T.parcels || 0) * 10
      + (T.fightsWon || 0) * 10 + (T.fed || 0) * 5 + (T.racesWon || 0) * 40 + (s.props || []).length * 150 + (T.studied || 0) * 40 + (T.movies || 0) * 10 + (T.games || 0) * 5);
  }
  level() {
    const xp = this.xp(), need = (L) => 150 * (L - 1) * L;     // level 2 at 300, 3 at 900, 5 at 3,000, 8 at 8,400
    let L = 1; while (xp >= need(L + 1)) L++;
    return { L, xp, from: need(L), to: need(L + 1) };
  }
  get hpMax() { return 100 + Math.round(this.s.fitness); }
  change(k, d) {
    const s = this.s;
    if (k === 'respect' || k === 'karma') {
      // who you are changes slowly: any one thing moves it only a little, and only a few points a minute can move
      // at all (a bad afternoon dents it; it takes a habit to really change it)
      const now = this.g.t || 0, R = this._rb || (this._rb = {}), B = R[k] || (R[k] = { v: 4, t: now });
      B.v = Math.min(4, B.v + Math.max(0, now - B.t) * (4 / 60)); B.t = now;
      const dd = Math.sign(d) * Math.min(Math.abs(d) * 0.35, B.v); B.v -= Math.abs(dd);
      s[k] = clamp(s[k] + dd, -100, 100);
    }
    else if (k === 'fitness') s[k] = clamp(s[k] + d, 0, 40);
    else if (k === 'hp') { const P = this.g.player; P.hp = clamp((P.hp ?? 100) + d, 0, this.hpMax); }
    else if (k in s) s[k] = clamp(s[k] + d, 0, k === 'drunk' ? 1.2 : 1);
  }
  apply(eff) { for (const [k, v] of Object.entries(eff || {})) this.change(k, v); }
  has(id, n = 1) { return (this.s.inv[id] || 0) >= n; }
  add(id, n = 1) { this.s.inv[id] = (this.s.inv[id] || 0) + n; this.save(); }
  take(id, n = 1) { if (!this.has(id, n)) return false; this.s.inv[id] -= n; if (this.s.inv[id] <= 0) delete this.s.inv[id]; this.save(); return true; }
  // use something from the backpack; returns what happened
  use(id) {
    const it = ITEMS[id];
    if (!it || !this.has(id)) return '';
    if (it.scratch) { this.take(id); return this.scratch(); }
    if (it.tool) return this.g.lights ? this.g.lights.setTorch(!this.g.lights.torchOn) : '';
    if (!it.use) return it.feed === 'dog' ? 'Find a street dog and press F' : '';     // (dog food: for the dogs)
    this.take(id);
    this.apply(it.use);
    return `${it.name}: ${describe(it.use)}`;
  }
  scratch() {
    const r = Math.random(), G = this.g;
    let won = 0;
    if (r < 0.004) won = 50000; else if (r < 0.03) won = 2000; else if (r < 0.12) won = 200; else if (r < 0.3) won = 50;
    if (won) { G.stats.money += won; G.audio.cash(); G.saveStats(); this.change('mood', won >= 2000 ? 0.3 : 0.05); return `Lottery: you won ₹${won.toLocaleString('en-IN')}!`; }
    this.change('mood', -0.02);
    return 'Lottery: better luck next time';
  }
  // what you wear against where you are (0 off, 1 spot on), and whether it turns heads
  style() {
    const P = this.g.player, L = P.look;
    if (!L) return { score: 0.6, odd: false };
    const area = this.g.people.areas.at(P.x, P.z);
    const kind = area ? area.kind : 'city';
    const saree = L.cut.w > 1.5, kurta = !saree && L.cut.y < 0.9, western = !saree && !kurta;
    const odd = !L.female && saree;              // the street notices; the game doesn't mind
    let score = 0.6;
    if (kind === 'polished') score = western ? 0.9 : kurta ? 0.6 : 0.5;
    else if (kind === 'peth' || kind === 'colony') score = kurta || saree ? 0.9 : 0.65;
    else if (kind === 'college') score = western ? 0.85 : 0.55;
    if ((this.s.upg.shoes || 0) > 0) score += 0.05;
    if (this.s.pressed === Math.floor((this.g.clock || 0) / 24)) score += 0.08;      // ironed today
    if (this.s.upg.chain) score += 0.06;                                                // a gold chain
    if (this.s.shades && (kind === 'polished' || kind === 'college')) score += this.s.shades === 'premium' ? 0.1 : 0.06;
    return { score: clamp(score, 0, 1), odd };
  }
  // how a stranger reads you: 'respect' greeting, 'scared', 'odd' look, 'nice' look, or nothing
  reaction() {
    const s = this.s, st = this.style();
    if (s.karma < -25 || (s.respect > 40 && s.karma < -5)) return 'scared';
    if (st.odd) return 'odd';
    if (s.drunk > 0.45) return 'drunk';
    if (s.respect > 25 && s.karma >= 0) return 'respect';
    if (st.score > 0.85 && s.mood > 0.4) return 'nice';
    return null;
  }

  update(dt) {
    const G = this.g, s = this.s, P = G.player;
    const h = dt * G.timeScale;                       // game hours this frame
    const busy = P.onFoot ? 1 + Math.min(1, P.v / 6) * 0.6 : 0.8;    // walking and running make you hungrier
    s.hunger = clamp(s.hunger - DECAY.hunger * h * busy, 0, 1);
    s.thirst = clamp(s.thirst - DECAY.thirst * h * busy * (G.hour > 11 && G.hour < 17 ? 1.25 : 1), 0, 1);
    s.energy = clamp(s.energy - DECAY.energy * h * (G.hour > 23 || G.hour < 5 ? 1.5 : 1), 0, 1);
    s.drunk = Math.max(0, s.drunk - h * 0.35);
    if (s.charmBoost) s.charmBoost = Math.max(0, s.charmBoost - h * 0.004);     // a facial or a whitening wears off over days
    if (P.onFoot && P.foot.swim) { s.energy = clamp(s.energy - h * 0.25, 0, 1); s.thirst = Math.min(1, s.thirst + h * 0.02); }
    s.mood = clamp(s.mood + (0.6 - s.mood) * h * 0.08 - (s.hunger < 0.2 ? h * 0.05 : 0), 0, 1);
    // empty stomach or dry throat: health slowly goes (never all at once)
    // an empty stomach or a dry throat wears your health down; at zero you pass out (hospital)
    if (s.hunger < 0.08 || s.thirst < 0.08) {
      const starving = s.hunger <= 0 || s.thirst <= 0;
      P.hp -= dt * (starving ? 0.7 : 0.18);
      if (P.hp <= 0 && !P.ko && G.blackout) G.blackout(s.thirst <= 0 ? 'thirst' : 'hunger');
      else if (P.hp < 1) P.hp = 1;
    }
    this.warn('hunger', s.hunger, 'Pet bhuk lagli', 'You’re getting hungry, a vada pav or a thali would do it (F at any food place, or E for your bag)');
    this.warn('thirst', s.thirst, 'Ghasa korda padla', 'You’re thirsty, water, a chai, a juice');
    this.warn('energy', s.energy, 'Thakla aahes', 'You’re tired, sleep at your home or a lodge, or a strong chai');
    // first-aid kit saves you from a knockout
    if (P.hp < 12 && this.has('medkit') && !P.ko) { this.take('medkit'); P.hp = Math.min(this.hpMax, P.hp + 60); G.hud.toast('First-aid kit used', 'Patched up, +60 health', 'info', 2.4); }
    // rent from what you own, once a game day
    const day = Math.floor((G.clock || 0) / 24);
    if (s.lastRentDay < 0) s.lastRentDay = day;
    if (day > s.lastRentDay && G.props) { s.lastRentDay = day; G.props.payRent(); G.hustle && G.hustle.daily(); G.shops && G.shops.daily && G.shops.daily(); G.gym && G.gym.daily(day); }
    if ((this.saveT -= dt) <= 0) { this.saveT = 5; this.save(); }
  }
  warn(k, v, title, sub) {
    if (v < 0.2 && !this.warned[k]) { this.warned[k] = true; this.g.hud.toast(title, sub, 'warn', 4); }
    if (v > 0.35) this.warned[k] = false;
  }
  // charm: how you come across when you talk to someone (dates, tips, a better price). A clean
  // smile, good skin, the right clothes, a good mood; a drink or two loosens you up, more is a mess.
  get charm() {
    const s = this.s, st = this.style(), d = s.drunk;
    const drink = d > 0.15 && d < 0.5 ? 0.12 : d >= 0.7 ? -0.22 : 0;
    return clamp(0.35 + (st.score - 0.6) * 0.5 + (s.mood - 0.5) * 0.25 + (s.charmBoost || 0) + (s.partnerConf || 0) + drink + Math.max(0, s.respect) / 400, 0, 1);
  }
  // tiredness, hunger and drink as gameplay
  get sprintMul() { const s = this.s; return (s.energy < 0.15 ? 0.75 : 1) * (s.hunger < 0.08 ? 0.85 : 1) * (s.drunk > 0.6 ? 0.85 : 1); }
  // a man hits harder (built stronger), and the gym adds to anyone
  get punchMul() { return (this.g && this.g.player && this.g.player.look && !this.g.player.look.female ? 1.35 : 1) + (this.s.fit ? this.s.fit.str / 55 : this.s.fitness / 80); }     // (gym strength)
}

function describe(eff) {
  const out = [];
  const lab = { hunger: 'food', thirst: 'water', energy: 'energy', mood: 'mood', hp: 'health', drunk: 'tipsy' };
  for (const [k, v] of Object.entries(eff || {})) {
    if (k === 'hp') out.push(`+${v} health`);
    else if (k === 'drunk') out.push('a bit tipsy');
    else out.push(`${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${lab[k] || k}`);
  }
  return out.join(', ');
}
export { describe };
