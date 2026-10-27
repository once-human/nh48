// Every real business on the map can be walked into (F at its door). What it does depends on what
// it is: the category from the map (food, salon, clothes...) and its name (a "Misal" place serves
// misal, a "Biryani House" biryani, an Udupi place dosas, a "Brewing Co" at night is a club).
// About twenty kinds of shop logic, reused across six thousand real storefronts:
//   eat & drink   tapri · misal / vada pav · thali · biryani · South Indian · Chinese · pizza &
//                 burgers · café · bakery · sweets · juice & mastani · ice cream · bar / club
//   look          barber / salon · clothes (anyone can wear anything) · shoes
//   health        pharmacy · clinic / hospital · gym
//   money         bank / ATM · jeweller (gold, at a price that moves) · lottery at the kirana
//   things        kirana · mobile shop · electronics · bookshop · florist · paan
//   vehicles      showroom (buy one) · garage (tune your auto, stickers, sell a "found" vehicle) ·
//                 petrol / CNG pump · travel agent (rent a scooter)
//   places        police chowki (pay challans, turn yourself in) · lodge (sleep) · estate agent
// Prices follow the area: Koregaon Park costs more than Kasba Peth.
import * as THREE from 'three';
import { KbNav } from '../ui/kbnav.js';
import { clamp, RNG } from '../core/util.js';
import { ITEMS, describe } from './life.js';
import { Vehicle, specOf } from '../vehicles/vehicle.js';
import { tierOf, TIER_MUL, TIER_LABEL, servicesFor } from './brands.js';
import SHOPL from './shop_lines.json';
import { venueKey, nightOf } from '../world/interiors.js';

// each kind of shop gets its own look of buying screen (style.css .shop[data-ui=...])
const UI_OF = { tapri: 'menu', misal: 'menu', thali: 'menu', biryani: 'menu', southindian: 'menu', chinese: 'menu', fastfood: 'fast', food: 'menu', cafe: 'cafe', bakery: 'cafe', sweets: 'menu', juice: 'menu', icecream: 'cafe',
  bar: 'neon', bank: 'teller', jeweller: 'gold', clinic: 'clinic', pharmacy: 'clinic', optician: 'clinic', dealer: 'dealer', garage: 'garage', fuel: 'garage', chowki: 'chowki', property: 'gold', estate: 'gold' };
const r10 = (v) => Math.max(10, Math.round(v / 10) * 10);
export const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const col = (h) => new THREE.Color(h).convertSRGBToLinear();

// ---------------------------------------------------------------- which logic a storefront gets
export function kindOf(name, cat) {
  const n = (name || '').toLowerCase();
  if (cat === 'police') return 'chowki';
  if (/\b(honda|bajaj|hero|tvs|suzuki|yamaha|maruti|hyundai|toyota|kia|mahindra|tata motors|royal enfield|ather|ola electric|skoda|volkswagen|renault|nissan|mg motor)\b|showroom|automobiles?\b|\bmotors\b/.test(n)) return 'dealer';
  if (/garage|service (centre|center|station)|auto ?works|motor ?works|tyres?|puncture|mechanic|auto parts|spares|car care|car wash/.test(n)) return 'garage';
  if (/estate|propert|realt|developers?\b|builders?\b|housing\b|homes\b/.test(n)) return 'estate';
  if (/\bgym\b|fitness|crossfit|yoga/.test(n)) return 'gym';
  if (/lodge|\binn\b|residency|guest ?house|hostel/.test(n)) return 'lodge';
  if (/paan|\bpan shop|pan house|tambakhu/.test(n)) return 'paan';
  if (/flower|florist|phool/.test(n)) return 'florist';
  if (/\bpub\b|brew|lounge|club|tavern|beer|bar\b|bar &|bistro|taproom|social/.test(n) || cat === 'bar') return 'bar';
  if (/mastani|juice|lassi|shake|falooda/.test(n)) return 'juice';
  if (/amruttulya|\bchai\b|\btea\b|tapri|cutting/.test(n)) return 'tapri';
  if (/misal|vada ?pav|wada ?pav|batata vada/.test(n)) return 'misal';
  if (/biryani|biriyani|\bdum\b|kebab|mughlai|tandoor/.test(n)) return 'biryani';
  if (/udupi|dosa|idli|madras|south indian|vaishali|rupali|sagar/.test(n)) return 'southindian';
  if (/chinese|momo|hakka|szechuan|wok|noodle/.test(n)) return 'chinese';
  if (/pizza|burger|domino|mcdon|kfc|subway|fries|wrap/.test(n)) return 'fastfood';
  if (/thali|bhojan|khanaval|khanawal|bhojanalay|thaali/.test(n)) return 'thali';
  const C = { salon: 'barber', clothes: 'clothes', shoes: 'shoes', cafe: 'cafe', bakery: 'bakery', sweets: 'sweets', icecream: 'icecream',
    pharmacy: 'pharmacy', clinic: 'clinic', grocery: 'kirana', mobile: 'mobile', electronics: 'electronics', jewellery: 'jeweller',
    bank: 'bank', atm: 'bank', books: 'books', travel: 'travel', food: 'food', hotel: 'food', optician: 'optician' };
  return C[cat] || null;
}

export const KIND_INFO = {
  tapri: ['Tapri', 'टपरी', 'food'], misal: ['Misal & vada pav', 'मिसळ', 'food'], thali: ['Thali house', 'थाळी', 'food'], biryani: ['Biryani', 'बिर्याणी', 'food'],
  southindian: ['South Indian', 'उडपी', 'food'], chinese: ['Indo-Chinese', 'चायनीज', 'food'], fastfood: ['Pizza & burgers', 'फास्ट फूड', 'food'],
  food: ['Restaurant', 'हॉटेल', 'food'], cafe: ['Café', 'कॅफे', 'food'], bakery: ['Bakery', 'बेकरी', 'food'], sweets: ['Sweet mart', 'मिठाई', 'food'],
  juice: ['Juice & mastani', 'ज्यूस', 'food'], icecream: ['Ice cream', 'आईस्क्रीम', 'food'], bar: ['Bar & club', 'बार', 'night'],
  barber: ['Salon', 'सलून', 'look'], clothes: ['Clothes', 'कपडे', 'look'], shoes: ['Footwear', 'चपला', 'look'], optician: ['Optician', 'चष्मा', 'look'],
  pharmacy: ['Medical store', 'मेडिकल', 'health'], clinic: ['Clinic', 'दवाखाना', 'health'], gym: ['Gym', 'व्यायामशाळा', 'health'],
  bank: ['Bank & ATM', 'बँक', 'money'], jeweller: ['Jeweller', 'सराफ', 'money'], kirana: ['Kirana', 'किराणा', 'things'], mobile: ['Mobile shop', 'मोबाईल', 'things'],
  electronics: ['Electronics', 'इलेक्ट्रॉनिक्स', 'things'], books: ['Bookshop', 'पुस्तके', 'things'], florist: ['Florist', 'फुले', 'things'], paan: ['Paan', 'पान', 'things'],
  dealer: ['Vehicle showroom', 'शोरूम', 'vehicle'], garage: ['Garage', 'गॅरेज', 'vehicle'], fuel: ['Petrol & CNG', 'पेट्रोल पंप', 'vehicle'], travel: ['Travels', 'ट्रॅव्हल्स', 'vehicle'],
  chowki: ['Police chowki', 'पोलीस चौकी', 'place'], lodge: ['Lodge', 'लॉज', 'place'], estate: ['Estate agent', 'इस्टेट', 'place'],
};
// opening hours, Pune style: [opens, closes] (hours, may run past midnight), and the share of places of
// that kind that stay open late into the night (a 24-hour chemist, a biryani place till 2). Around 40% of
// the city is open after 11 PM: a little livelier than the real thing, it's a game
const HOURS = {
  tapri: [6, 23, 0.45], misal: [7, 22.5, 0.2], thali: [11, 22.5, 0.15], biryani: [12, 23.5, 0.6], southindian: [7, 22, 0.15], chinese: [12, 23.5, 0.5],
  fastfood: [11, 23.5, 0.55], food: [11, 23.5, 0.45], cafe: [9, 23, 0.45], bakery: [7, 22, 0.2], sweets: [8, 22, 0.1], juice: [11, 23.5, 0.4], icecream: [11, 23.5, 0.45],
  bar: [18, 25.5, 1], barber: [9, 21.5, 0.05], clothes: [10.5, 21.5, 0.08], shoes: [10.5, 21.5, 0.05], optician: [10.5, 21, 0], pharmacy: [8, 23, 0.5],
  clinic: [9, 21, 0.25], gym: [5.5, 22, 0.15], jeweller: [10.5, 20.5, 0], kirana: [7, 22, 0.3], mobile: [10.5, 21.5, 0.1],
  electronics: [10.5, 21, 0], books: [10, 21, 0], florist: [7, 21.5, 0.2], paan: [10, 24, 0.7], dealer: [10, 20, 0], garage: [9, 20.5, 0.1],
  fuel: [6, 23, 0.7], travel: [9, 21, 0.1], estate: [10, 20, 0],
};
const ALWAYS = new Set(['chowki', 'lodge', 'hospital']);
const hhmm = (h) => { h = ((h % 24) + 24) % 24; const H = Math.floor(h), M = Math.round((h - H) * 60); return `${H % 12 || 12}${M ? ':' + String(M).padStart(2, '0') : ''} ${H < 12 ? 'AM' : 'PM'}`; };
// is this place open at this hour? {open, opens}. A place that stays open late does so every night.
export function openNow(ctx, hour) {
  if (!ctx || ALWAYS.has(ctx.kind) || ctx.atm) return { open: true };
  const H = HOURS[ctx.kind];
  if (!H) return { open: true };
  const [o, c, late] = H;
  const seed = Math.abs(Math.sin((ctx.x || 0) * 12.9898 + (ctx.z || 0) * 78.233) * 43758.5453) % 1;
  const lateOne = seed < late;
  const close = lateOne ? (ctx.kind === 'pharmacy' || ctx.kind === 'fuel' || ctx.kind === 'paan' ? 30 : Math.max(c, 26)) : c;   // 30 = round the clock
  if (close >= 30) return { open: true };
  const h = hour < 6 ? hour + 24 : hour;
  const open = h >= o && h < close;
  return { open, opens: hhmm(o) };
}

// what the keeper says when you walk in: [roman, English]
const HELLO = {
  tapri: [['Bola, cutting ki full?', 'Cutting or a full glass?']], misal: [['Kiti tikhat? Kat extra?', 'How spicy? Extra kat?']],
  thali: [['Basa, taat lavto.', 'Sit, I’ll lay out a plate.']], biryani: [['Full ya half, boss?', 'Full or half, boss?']],
  southindian: [['Ek masala dosa? Sambar refill free.', 'A masala dosa? Sambar refills are free.']], chinese: [['Dry ya gravy?', 'Dry or gravy?']],
  fastfood: [['Hi, welcome! Dine in or takeaway?', 'Hi, welcome! Dine in or takeaway?']], food: [['Kaay deu? Aaj misal special aahe.', 'What can I get you? Misal’s the special today.']],
  cafe: [['Hey! What can I get you today?', 'Hey! What can I get you today?']], bakery: [['Garam aahe, aataach aala.', 'It’s hot, just out of the oven.']],
  sweets: [['Bakarwadi taaji aahe.', 'The bakarwadi is fresh.']], juice: [['Mastani ghya, Pune special!', 'Have a mastani, a Pune special!']],
  icecream: [['Kuthla flavour?', 'Which flavour?']], bar: [['Welcome! Table ya bar counter?', 'Welcome! A table or the bar counter?']],
  barber: [['Basa, kasa kapu?', 'Sit down. How shall I cut it?']], clothes: [['Size kaay? Trial room tikde.', 'What size? Trial room is that side.']],
  shoes: [['Size kiti? Ghalun bagha.', 'What size? Try them on.']], optician: [['Doley tapasu ka?', 'Shall I check your eyes?']],
  pharmacy: [['Prescription aahe?', 'Do you have a prescription?']], clinic: [['Doctor aat aahet, basa.', 'The doctor’s in, have a seat.']],
  gym: [['Aaj leg day aahe, bhau!', 'It’s leg day today, bro!']], bank: [['Token ghya, counter teen.', 'Take a token, counter three.']],
  jeweller: [['Aajcha bhaav board var aahe.', 'Today’s rate is on the board.']], kirana: [['Bola, kaay pahije?', 'Tell me, what do you need?']],
  mobile: [['Recharge ki navin phone?', 'A recharge or a new phone?']], electronics: [['EMI available aahe.', 'EMI is available.']],
  books: [['Navin aali aahet tikde.', 'New arrivals over there.']], florist: [['Gajra ghya, taaja aahe.', 'Take a gajra, it’s fresh.']],
  paan: [['Meetha ki saadha?', 'Sweet or plain?']], dealer: [['Test drive ghya, sir!', 'Take a test drive, sir!']],
  garage: [['Kaay problem aahe gaadit?', 'What’s wrong with the vehicle?']], fuel: [['Kiti cha bharu?', 'How much shall I fill?']],
  travel: [['Kuthe jaycha aahe?', 'Where do you want to go?']], chowki: [['Kaay takrar aahe?', 'What’s the complaint?']],
  lodge: [['Room pahije? ID dakhva.', 'Need a room? Show your ID.']], estate: [['Budget kaay aahe?', 'What’s your budget?']],
};

// ---------------------------------------------------------------- menus
// food item: [name, note, price, effects, carry (item id into the bag instead of eating now)]
export const F = {
  chai: ['Cutting chai', 'Half a glass, extra sugar', 15, { thirst: 0.12, energy: 0.1 }],
  fullchai: ['Full chai', 'Strong, with ginger', 25, { thirst: 0.2, energy: 0.15 }],
  bunmaska: ['Bun maska', 'Soft bun, a slab of butter', 35, { hunger: 0.15 }],
  vadapav: ['Vada pav', 'With fried chilli and chutney', 22, { hunger: 0.22, mood: 0.02 }],
  cheesevp: ['Cheese vada pav', 'The college upgrade', 45, { hunger: 0.27, mood: 0.03 }],
  vpparcel: ['Vada pav parcel (2)', 'For later, goes in your bag', 45, {}, ['vadapav', 2]],
  bhaji: ['Kanda bhaji', 'Onion fritters, a plate', 40, { hunger: 0.18 }],
  misal: ['Misal pav', 'Spicy sprout curry, farsan, two pav', 110, { hunger: 0.45, thirst: -0.05, mood: 0.04 }],
  misalx: ['Misal, extra tikhat', 'For the brave. Ask for kat', 120, { hunger: 0.45, thirst: -0.12, mood: 0.06 }],
  poha: ['Kanda poha', 'With sev and lemon', 45, { hunger: 0.25 }],
  taak: ['Masala taak', 'Spiced buttermilk', 30, { thirst: 0.3 }],
  sabudana: ['Sabudana khichdi', 'Fasting food, still delicious', 70, { hunger: 0.3 }],
  thali: ['Maharashtrian thali', 'Unlimited: bhakri, pitla, usal, rice, aamti', 280, { hunger: 1, thirst: 0.1, mood: 0.08 }],
  puranpoli: ['Puran poli', 'With a spoon of ghee', 70, { hunger: 0.25, mood: 0.04 }],
  nonvegthali: ['Kolhapuri mutton thali', 'Tambda and pandhra rassa', 420, { hunger: 1, mood: 0.1 }],
  biryani: ['Chicken dum biryani', 'With salan and raita', 290, { hunger: 0.8, mood: 0.06 }],
  vegbiryani: ['Veg biryani', 'Paneer, vegetables, saffron rice', 220, { hunger: 0.7 }],
  kebab: ['Seekh kebab plate', 'Four kebabs, green chutney', 260, { hunger: 0.45 }],
  dosa: ['Masala dosa', 'Crisp, with sambar and chutney', 120, { hunger: 0.4 }],
  idli: ['Idli sambar', 'Three idlis', 75, { hunger: 0.3 }],
  spdp: ['SPDP', 'Sev potato dahi puri, FC Road legend', 95, { hunger: 0.25, mood: 0.05 }],
  filter: ['Filter coffee', 'Frothy, in a davara', 45, { thirst: 0.12, energy: 0.18 }],
  noodles: ['Hakka noodles', 'Veg or chicken', 190, { hunger: 0.5 }],
  manchurian: ['Gobi manchurian (dry)', 'Very red, very good', 180, { hunger: 0.4 }],
  momos: ['Steamed momos', 'Eight, with fiery chutney', 130, { hunger: 0.3 }],
  pizza: ['Margherita pizza', 'Medium', 349, { hunger: 0.6, mood: 0.04 }],
  burger: ['Aloo tikki burger', 'And fries', 189, { hunger: 0.45 }],
  cola: ['Cola', 'Chilled can', 60, { thirst: 0.3 }],
  coldcoffee: ['Cold coffee', 'Thick, with ice cream', 220, { thirst: 0.3, energy: 0.15, mood: 0.04 }],
  cappu: ['Cappuccino', 'Single origin, apparently', 240, { energy: 0.25, thirst: 0.1 }],
  sandwich: ['Bombay sandwich', 'Grilled, with green chutney', 190, { hunger: 0.35 }],
  pasta: ['Penne arrabbiata', 'KP prices', 450, { hunger: 0.5, mood: 0.04 }],
  brownie: ['Walnut brownie', 'Warm, with ice cream', 240, { hunger: 0.15, mood: 0.08 }],
  cctogo: ['Cold coffee to go', 'Goes in your bag', 230, {}, ['coldcoffee', 1]],
  shrewsbury: ['Shrewsbury biscuits, 500 g', 'The famous Camp box, a gift', 360, {}, ['shrewsbury', 1]],
  khari: ['Khari', 'Flaky, for chai', 60, { hunger: 0.1 }],
  mawacake: ['Mawa cake', 'Irani café style', 45, { hunger: 0.12, mood: 0.03 }],
  puff: ['Veg puff', 'Hot from the oven', 30, { hunger: 0.15 }],
  bakarwadi: ['Bakarwadi, 250 g', 'Crisp and spicy-sweet, a gift box', 170, {}, ['bakarwadi', 1]],
  barfi: ['Amba barfi box', 'Mango barfi, a gift', 260, {}, ['barfi', 1]],
  modak: ['Ukadiche modak (5)', 'Steamed, with ghee', 200, { hunger: 0.25, mood: 0.1 }],
  shrikhand: ['Amrakhand', 'Mango shrikhand, a bowl', 90, { hunger: 0.15, mood: 0.06 }],
  mastani: ['Mango mastani', 'Milkshake, ice cream, dry fruit', 160, { thirst: 0.35, hunger: 0.1, mood: 0.08 }],
  sugarcane: ['Ganna juice', 'Sugarcane, with lemon and ginger', 30, { thirst: 0.35, energy: 0.08 }],
  lassi: ['Lassi', 'Sweet, thick, malai on top', 70, { thirst: 0.3, hunger: 0.08 }],
  kokum: ['Kokum sharbat', 'Cools you down', 40, { thirst: 0.35 }],
  kulfi: ['Matka kulfi', 'Kesar pista', 70, { mood: 0.05, thirst: 0.05 }],
  sundae: ['Sitaphal ice cream', 'Custard apple, seasonal', 120, { mood: 0.08 }],
  beer: ['Pint of beer', 'Craft lager, on tap', 350, { drunk: 0.3, thirst: 0.1, mood: 0.06 }],
  cocktail: ['Cocktail', 'Something with kokum and gin', 650, { drunk: 0.4, mood: 0.1 }],
  mocktail: ['Mocktail', 'Virgin mojito', 280, { thirst: 0.3, mood: 0.04 }],
  nachos: ['Loaded nachos', 'Bar food', 380, { hunger: 0.35 }],
  water: ['Water bottle', 'One litre, goes in your bag', 20, {}, ['water', 1]],
  maggi: ['Cheese Maggi', 'Hostel-night classic', 70, { hunger: 0.25, mood: 0.04 }],
};
export const MENUS = {
  tapri: ['chai', 'fullchai', 'bunmaska', 'vadapav', 'bhaji', 'water'],
  misal: ['misal', 'misalx', 'vadapav', 'cheesevp', 'vpparcel', 'poha', 'taak', 'chai'],
  thali: ['thali', 'nonvegthali', 'puranpoli', 'sabudana', 'taak', 'water'],
  biryani: ['biryani', 'vegbiryani', 'kebab', 'cola', 'water'],
  southindian: ['dosa', 'idli', 'spdp', 'filter', 'water'],
  chinese: ['noodles', 'manchurian', 'momos', 'cola'],
  fastfood: ['pizza', 'burger', 'cola', 'water'],
  cafe: ['coldcoffee', 'cappu', 'sandwich', 'pasta', 'brownie', 'cctogo'],
  bakery: ['shrewsbury', 'khari', 'mawacake', 'puff', 'chai'],
  sweets: ['bakarwadi', 'barfi', 'modak', 'shrikhand'],
  juice: ['mastani', 'sugarcane', 'lassi', 'kokum'],
  icecream: ['kulfi', 'sundae', 'mastani'],
  bar: ['beer', 'cocktail', 'mocktail', 'nachos', 'water'],
};
// a plain "hotel" (Pune for restaurant) serves what its neighbourhood eats
export const AREA_FOOD = { polished: ['pasta', 'burger', 'coldcoffee', 'sandwich', 'brownie', 'water'], peth: ['thali', 'misal', 'poha', 'sabudana', 'taak', 'chai'],
  station: ['biryani', 'thali', 'vadapav', 'chai', 'water'], college: ['vadapav', 'maggi', 'spdp', 'coldcoffee', 'chai', 'water'], camp: ['biryani', 'kebab', 'mawacake', 'chai', 'cola'] };
const AREA_MUL = { polished: 1.55, camp: 1.15, college: 0.92, peth: 0.88, station: 0.92, colony: 1.05, city: 1 };

// clothes anyone can buy (top / bottom colours, sleeve, kurta, saree)
// [id, name, note, price, look patch, who it's cut for: M men's, W women's, U unisex] (anyone can wear anything)
// [id, name, note, base price, patch, who]. A patch can set: top, bottom (colours), cut [sleeve, hem, neck, kind
// 0 western / 1 kurta / 2 saree / 3 skirt or dress], pat (1 stripes, 2 checks, 4 print, 5 open jacket over patCol,
// 6 colour block), patCol, hem (skirt length, 0.06 floor to 0.75 mini), denim, hat, hatCol, shades.
// The more distinctive the piece, the more it costs.
const T = (sleeve, neck = 0.4) => [sleeve, 1, neck, 0];
export const CLOTHES = [
  // the basics
  ['tee_white', 'Basic tee, white', 'The one everyone owns', 399, { top: 0xf4f2ee, cut: T(0.38, 0.3), pat: 0 }, 'U'],
  ['tee_black', 'Basic tee, black', 'Goes with everything', 449, { top: 0x1f2024, cut: T(0.38, 0.3), pat: 0 }, 'U'],
  ['tee_grey', 'Basic tee, heather grey', 'Soft cotton', 449, { top: 0x8e9093, cut: T(0.38, 0.3), pat: 0 }, 'U'],
  ['tee_red', 'T-shirt, red', 'Half sleeves', 499, { top: 0xbf3f3a, cut: T(0.38, 0.3), pat: 0 }, 'U'],
  ['tee_mustard', 'T-shirt, mustard', 'Half sleeves', 549, { top: 0xe0b23a, cut: T(0.38, 0.3), pat: 0 }, 'U'],
  ['jeans_blue', 'Jeans, indigo', 'Slim fit', 1599, { bottom: 0x2c3e66, denim: true, cutW: 0 }, 'U'],
  ['jeans_black', 'Jeans, black', 'Slim fit', 1599, { bottom: 0x1b1c1f, denim: true, cutW: 0 }, 'U'],
  ['track_navy', 'Track pants, navy', 'Morning walk on Vetal hill', 699, { bottom: 0x1d2a4a, denim: false, cutW: 0 }, 'U'],
  // shirts and knits
  ['shirt_white', 'Linen shirt, white', 'Full sleeves, crisp', 1290, { top: 0xf2f0ea, cut: T(0.95, 0.5), pat: 0 }, 'M'],
  ['shirt_blue', 'Oxford shirt, sky blue', 'Full sleeves', 1190, { top: 0x8fb3d9, cut: T(0.95, 0.5), pat: 0 }, 'M'],
  ['shirt_check', 'Flannel shirt, red and black check', 'Weekend in Mulshi', 1690, { top: 0x9c1f26, cut: T(0.95, 0.5), pat: 2, patCol: 0x141414 }, 'U'],
  ['shirt_check_blue', 'Flannel shirt, blue check', 'Soft brushed cotton', 1690, { top: 0x2f4f7a, cut: T(0.95, 0.5), pat: 2, patCol: 0xe9e6dd }, 'U'],
  ['tee_breton', 'Breton stripe tee', 'Navy and white, very French', 1290, { top: 0xf2efe8, cut: T(0.8, 0.3), pat: 1, patCol: 0x1d2a4a }, 'U'],
  ['tee_stripe_black', 'Striped tee, black and white', 'Bold stripes', 1190, { top: 0xf2efe8, cut: T(0.38, 0.3), pat: 1, patCol: 0x16161a }, 'U'],
  ['polo_green', 'Polo, bottle green', 'Half sleeves', 899, { top: 0x2f5d45, cut: T(0.4, 0.6), pat: 0 }, 'U'],
  ['hoodie_grey', 'Hoodie, grey', 'For the two cold weeks in December', 1799, { top: 0x7d8085, cut: T(1, 0.2), pat: 0 }, 'U'],
  ['hoodie_black', 'Oversized hoodie, black', 'Streetwear, Koregaon Park approved', 2490, { top: 0x18181b, cut: T(1, 0.2), pat: 0 }, 'U'],
  ['tee_graphic', 'Graphic print tee', 'Loud, in a good way', 1490, { top: 0x2b2d42, cut: T(0.38, 0.3), pat: 4, patCol: 0xffb224 }, 'U'],
  ['top_floral', 'Top, floral print', 'Short sleeves, light cotton', 999, { top: 0xe5989b, cut: T(0.3, 0.7), pat: 4, patCol: 0xf4f1ea }, 'W'],
  ['top_polka', 'Polka dot top, black', 'White dots, a little retro', 1490, { top: 0x16161a, cut: T(0.3, 0.7), pat: 4, patCol: 0xf4f1ea }, 'W'],
  ['top_white', 'Top, white linen', 'Sleeveless', 799, { top: 0xf4f1ea, cut: T(0.05, 0.8), pat: 0 }, 'W'],
  ['top_cami_black', 'Camisole, black', 'Sleeveless, satin', 1290, { top: 0x141416, cut: T(0.0, 0.9), pat: 0 }, 'W'],
  ['top_block', 'Colour-block top, cream and rust', 'Statement shoulders', 1890, { top: 0xc8553d, cut: T(0.4, 0.6), pat: 6, patCol: 0xf2e6cf }, 'W'],
  // jackets: an open jacket over a tee or shirt
  ['jkt_denim', 'Denim jacket over a white tee', 'The classic', 3490, { top: 0x3e5f8a, cut: T(0.95, 0.4), pat: 5, patCol: 0xf4f2ee }, 'U'],
  ['jkt_bomber', 'Bomber jacket, olive', 'Over a black tee', 3990, { top: 0x4b5320, cut: T(0.95, 0.4), pat: 5, patCol: 0x1f2024 }, 'U'],
  ['jkt_varsity', 'Varsity jacket, maroon', 'Cream sleeves and yoke', 5490, { top: 0x6e1423, cut: T(0.95, 0.4), pat: 6, patCol: 0xf2e6cf }, 'U'],
  ['blazer_navy', 'Blazer, navy', 'Over a white shirt, for the office on Baner Road', 7990, { top: 0x1d2a4a, cut: T(0.98, 0.6), pat: 5, patCol: 0xf2f0ea }, 'M'],
  ['blazer_beige', 'Blazer, camel', 'Over a white camisole', 6990, { top: 0xb08a5a, cut: T(0.98, 0.6), pat: 5, patCol: 0xf4f1ea }, 'W'],
  ['jkt_leather', 'Leather jacket, black', 'Real leather, real attitude', 12990, { top: 0x101012, cut: T(0.98, 0.5), pat: 5, patCol: 0x8e9093 }, 'U'],
  ['suit_charcoal', 'Designer suit, charcoal', 'Jacket and trousers, white shirt. For weddings and boardrooms', 24990, { top: 0x2b2d31, bottom: 0x2b2d31, cut: T(0.98, 0.6), pat: 5, patCol: 0xf4f2ee, denim: false, cutW: 0 }, 'M'],
  // trousers
  ['jeans_light', 'Jeans, light wash', 'Faded just right', 1990, { bottom: 0x6b85a8, denim: true, cutW: 0 }, 'U'],
  ['chinos_khaki', 'Chinos, khaki', 'Office-ready', 1399, { bottom: 0x9c8a66, denim: false, cutW: 0 }, 'M'],
  ['cargo_olive', 'Cargo pants, olive', 'All the pockets', 1790, { bottom: 0x4b5320, denim: false, cutW: 0 }, 'U'],
  ['joggers_black', 'Joggers, black', 'Comfy, slim', 1290, { bottom: 0x16161a, denim: false, cutW: 0 }, 'U'],
  ['trousers_white', 'Trousers, white', 'Summer linen', 2490, { bottom: 0xf2f0ea, denim: false, cutW: 0 }, 'U'],
  // skirts and dresses
  ['skirt_denim', 'Denim mini skirt', 'With anything', 1490, { bottom: 0x3e5f8a, cutW: 3, hem: 0.7, denim: true }, 'W'],
  ['skirt_black', 'Black mini skirt', 'A party staple', 1290, { bottom: 0x16161a, cutW: 3, hem: 0.72, denim: false }, 'W'],
  ['skirt_pleated', 'Pleated midi skirt, sage', 'Below the knee, flowy', 1990, { bottom: 0x8fa98a, cutW: 3, hem: 0.42, denim: false }, 'W'],
  ['skirt_satin', 'Satin slip skirt, champagne', 'Midi length, a little shine', 2990, { bottom: 0xd8c3a5, cutW: 3, hem: 0.38, denim: false }, 'W'],
  ['dress_lbd', 'Little black dress', 'Sleeveless, above the knee', 3990, { top: 0x141416, bottom: 0x141416, cut: [0.0, 1, 0.8, 3], hem: 0.66, pat: 0, denim: false }, 'W'],
  ['dress_sun', 'Floral sundress', 'Pink with white flowers, for Sunday brunch', 2990, { top: 0xe58fa5, bottom: 0xe58fa5, cut: [0.1, 1, 0.8, 3], hem: 0.5, pat: 4, patCol: 0xf4f1ea, denim: false }, 'W'],
  ['dress_wrap', 'Wrap dress, emerald', 'Midi, three-quarter sleeves', 4490, { top: 0x14614a, bottom: 0x14614a, cut: [0.7, 1, 0.9, 3], hem: 0.42, pat: 0, denim: false }, 'W'],
  ['dress_sequin', 'Sequin party dress, silver', 'For the big night at a club', 18990, { top: 0xc9ccd3, bottom: 0xc9ccd3, cut: [0.0, 1, 0.9, 3], hem: 0.68, pat: 4, patCol: 0xf4f6fa, denim: false }, 'W'],
  ['gown_red', 'Evening gown, red', 'Floor-length. Heads will turn', 24990, { top: 0xa3122a, bottom: 0xa3122a, cut: [0.0, 1, 0.9, 3], hem: 0.07, pat: 0, denim: false }, 'W'],
  // accessories
  ['cap_black', 'Baseball cap, black', 'Brim forward, always', 699, { hat: true, hatCol: 0x18181b }, 'U'],
  ['cap_white', 'Baseball cap, white', 'Clean', 699, { hat: true, hatCol: 0xeeeeee }, 'U'],
  ['shades_aviator', 'Aviator sunglasses', 'Gold-ish frames', 2490, { shades: true }, 'U'],
  ['shades_designer', 'Designer sunglasses', 'The logo is tiny, the price isn’t', 8990, { shades: true }, 'U'],
  ['no_cap', 'Take off the cap', '', 0, { hat: false }, 'U'],
  ['no_shades', 'Take off the sunglasses', '', 0, { shades: false }, 'U'],
  // traditional
  ['kurta_white', 'Kurta pyjama, white', 'Cotton, for Ganpati and weddings', 1499, { top: 0xf4f1ea, bottom: 0xf4f1ea, cut: [0.95, 0.55, 0.7, 1], pat: 0, denim: false }, 'M'],
  ['kurta_saffron', 'Kurta, saffron', 'With white pyjama', 1699, { top: 0xf28f3b, bottom: 0xf4f1ea, cut: [0.95, 0.55, 0.7, 1], pat: 0, denim: false }, 'M'],
  ['kurti_teal', 'Kurti and salwar, teal', 'Everyday cotton', 1299, { top: 0x2e86ab, bottom: 0xf4f1ea, cut: [0.45, 0.55, 0.8, 1], pat: 0, denim: false }, 'W'],
  ['kurti_pink', 'Kurti and salwar, rani pink', 'Festive', 1599, { top: 0xd1495b, bottom: 0x2f2f33, cut: [0.85, 0.55, 0.8, 1], pat: 0, denim: false }, 'W'],
  ['saree_paithani', 'Paithani saree, purple and gold', 'The real thing (well, almost)', 8999, { top: 0x7b2cbf, bottom: 0x6a24a6, cut: [0.3, 1, 0.9, 2], pat: 0, denim: false }, 'W'],
  ['saree_nauvari', 'Nauvari saree, green', 'Nine yards, Maharashtrian style', 4999, { top: 0x386641, bottom: 0x2f5636, cut: [0.3, 1, 0.9, 2], pat: 0, denim: false }, 'W'],
  ['saree_red', 'Cotton saree, red', 'Everyday', 1999, { top: 0xc1121f, bottom: 0xa50f1a, cut: [0.3, 1, 0.9, 2], pat: 0, denim: false }, 'W'],
];
export const SHOES = [
  ['kolhapuri', 'Kolhapuri chappal', 'Hand-made leather', 899, 0x8a5a2b],
  ['sneakers', 'White sneakers', 'Stay white for one day', 2799, 0xe8e6e0],
  ['formals', 'Formal shoes, black', 'Polished', 2199, 0x15120f],
  ['sports', 'Running shoes, grey', 'For the Vetal hill climb', 2499, 0x7d8085],
];
const STICKERS = ['आई तुझा आशीर्वाद', 'बाबांची कृपा', 'हॉर्न ओके प्लीज', 'पुणे तिथे काय उणे', 'जय महाराष्ट्र', 'सद्गुरू कृपा', 'मी पुणेकर'];
export const DEALER = [
  ['cycle', 'Bicycle (roadster)', 'Hero-style, a bell and a carrier', 7500],
  ['scooter', 'Scooter 110 cc', 'Activa-style; the family vehicle', 84000],
  ['bike', 'Motorcycle 125 cc', 'Commuter, 60 km/l', 96000],
  ['hatch', 'Hatchback', 'Swift-style 1.2 petrol', 690000],
  ['sedan', 'Compact sedan', 'Dzire-style', 880000],
  ['suv', 'SUV', 'Creta-style 1.5 diesel', 1590000],
];
const PAINTS = [[0.78, 0.1, 0.1], [0.92, 0.92, 0.9], [0.1, 0.12, 0.16], [0.18, 0.32, 0.62], [0.55, 0.57, 0.6], [0.85, 0.55, 0.1]];

// ---------------------------------------------------------------- the shops
export class Shops {
  constructor(G) {
    this.g = G; this.rng = new RNG(5151);
    this.names = G.W.index ? G.W.index.shopNames : [];
    this.near = null; this.scanT = 0;
    this.places = [];
    // places from the map that aren't storefronts: pumps, chowkis, hospitals
    const M = G.W.M;
    for (const p of M.places || []) {
      const k = p[2] === 'fuel' ? 'fuel' : p[2] === 'police' ? 'chowki' : p[2] === 'hospital' ? 'clinic' : null;
      if (k) this.places.push({ x: p[3] / 100, z: p[4] / 100, kind: k, name: parodyFuel(p[0], k), mr: p[1] || '' });
    }
    this.build();
    this.goldBase = 11800;            // ₹ per gram, 24 carat: a guess for late 2026, moves daily
  }
  get life() { return this.g.life; }
  // the business at a door
  infoOf(door) {
    const n = this.names[door.shop];
    if (!n) return null;
    const kind = kindOf(n[0], n[2]);
    if (!kind) return null;
    return { name: n[0], mr: n[1], cat: n[2], kind, x: door.x, z: door.z, door, tier: tierOf(kind, n[0], n[3]) };
  }
  priceMul(x, z, tier) {
    const a = this.g.people.areas.at(x, z);
    const k = this.life.s.karma > 30 ? 0.95 : 1;
    // charm gets you a better price (a smile, a bit of chat), the brand on the board a worse one
    const c = 1 - Math.max(0, this.life.charm - 0.5) * 0.12;
    return (AREA_MUL[a ? a.kind : 'city'] || 1) * k * c * (tier ? TIER_MUL[tier] || 1 : 1);
  }
  // nearest thing you could walk into
  scan() {
    const P = this.g.player, st = this.g.W.streamer, I = this.g.interiors;
    if (I && I.inside) { const sp = I.near(P.x, P.z); this.near = sp ? { kind: 'ispot', s: sp, name: sp.label } : null; return; }
    let best = null, bd = P.onFoot ? 2.6 : 0;
    if (P.onFoot) for (const c of st.built) {
      if (!c.doors || Math.abs(c.cx - P.x) > 120 || Math.abs(c.cz - P.z) > 120) continue;
      for (const d of c.doors) {
        if (d.shop < 0) continue;
        const dd = Math.hypot(d.x - P.x, d.z - P.z);
        if (dd < bd) { const inf = this.infoOf(d); if (inf) { bd = dd; best = inf; } }
      }
    }
    // pumps work from the driver's seat; chowkis and hospitals on foot
    for (const p of this.places) {
      const dd = Math.hypot(p.x - P.x, p.z - P.z);
      const r = p.kind === 'fuel' ? 16 : 10;
      if (dd < r && (P.onFoot || (p.kind === 'fuel' && Math.abs(P.v) < 1.2)) && (!best || dd < bd + 4)) { best = { ...p, door: null }; bd = dd; }
    }
    const tr = P.onFoot && this.g.transit && this.g.transit.near(P.x, P.z);
    if (tr && (!best || Math.hypot(tr.x - P.x, tr.z - P.z) < bd + 3)) { best = tr; bd = 3; }
    const prop = this.g.props && this.g.props.near(P.x, P.z, P.onFoot ? 7 : 0);
    if (prop) best = { kind: 'property', name: prop.name, prop, x: prop.x, z: prop.z };
    // a dog or a cow right next to you
    const an = P.onFoot && this.g.strays && this.g.strays.near(P.x, P.z, 1.9);
    if (an && (!best || Math.hypot(an.x - P.x, an.z - P.z) < 1.4)) best = { kind: 'animal', a: an, name: an.kind, x: an.x, z: an.z };
    this.near = best;
  }
  update(dt) {
    if ((this.scanT -= dt) <= 0) { this.scanT = 0.2; this.scan(); }
  }
  // F pressed: walk in (returns true if it took the key)
  tryUse() {
    if (!this.near || this.open) return false;
    this.scanT = 0;                  // look again next frame: what's in front of you has changed
    if (this.near.kind === 'animal') { this.g.strays.interact(this.near.a); this.scanT = 0.5; return true; }
    if (this.near.kind === 'metro' || this.near.kind === 'bus') { this.g.transit.show(this.near); return true; }
    const I = this.g.interiors;
    if (this.near.kind === 'ispot') { I.use(this.near.s); this.scanT = 0.3; return true; }
    // shut for the night (or not open yet): the shutter's down
    const oh = this.near.door && openNow(this.near, this.g.hour);
    if (oh && !oh.open) { this.g.hud.toast(`${this.near.name} is closed`, `Opens at ${oh.opens}`, 'info', 2.4); this.scanT = 0.6; return true; }
    // a storefront with a room behind it: walk in (a club at night wants its cover charge first)
    if (I && I.templateOf(this.near.kind) && this.near.door) {
      const covers = this.g.life.s.covers || {};
      const club = this.near.kind === 'bar' && this.isClub(this.near) && (this.g.hour >= 20.5 || this.g.hour < 1.5) && covers[venueKey(this.near)] !== nightOf(this.g);
      if (!club) { const ctx = this.near; if (I.enter(ctx)) { this.g.date && this.g.date.onEnter(I.cur.R, ctx); return true; } }
    }
    this.show(this.near);
    return true;
  }
  label() {
    const n = this.near;
    if (!n) return null;
    if (n.kind === 'property') return this.g.props.label(n.prop);
    if (n.kind === 'animal') return this.g.strays.label(n.a);
    if (n.kind === 'metro' || n.kind === 'bus') return this.g.transit.label(n);
    if (n.kind === 'ispot') return n.s.label;
    const oh = n.door && openNow(n, this.g.hour);
    if (oh && !oh.open) return `${n.name} · Closed, opens ${oh.opens}`;
    if (this.g.interiors && this.g.interiors.templateOf(n.kind) && n.door) return `Go into ${n.name} · ${KIND_INFO[n.kind][0]}`;
    const K = KIND_INFO[n.kind];
    return `${n.name} · ${K ? K[0] : ''}`;
  }

  // ---------------------------------------------------------------- what's on offer
  items(ctx) {
    const G = this.g, L = this.life, P = this.g.player, k = ctx.kind;
    const tierPrices = ['barber', 'gym'].includes(k) || ctx.tier === 'chain' || ctx.tier === 'premium';
    const mul = this.priceMul(ctx.x, ctx.z, tierPrices && !['clinic', 'optician'].includes(k) ? ctx.tier : null);
    const out = [];
    const area = G.people.areas.at(ctx.x, ctx.z), ak = area ? area.kind : 'city';
    const pay = (price, fn) => () => { if (!this.spend(price)) return false; return fn(); };
    const dineIn = !!(ctx.inside && ctx.spot === 'counter' && G.interiors && G.interiors.cur && G.interiors.cur.R.seats.length);
    if (dineIn) out.push({ label: ctx.parcel ? 'Parcel: on' : 'Parcel: off', note: ctx.parcel ? 'Everything gets packed for your bag' : 'You eat here at a table. Switch to take it with you', price: 0, tag: 'job', act: () => { ctx.parcel = !ctx.parcel; return ctx.parcel ? 'Packing it to go' : 'Eating here'; } });
    const food = (id) => {
      const [name, note, base, eff, carry] = F[id];
      const price = r10(base * mul);
      out.push({ label: name, note, price, act: pay(price, () => {
        if (carry) { L.add(carry[0], carry[1]); return `${name}, in your bag`; }
        if (dineIn && ctx.parcel && !eff.drunk) { L.add('tiffin'); return `${name} packed, in your bag`; }
        if (dineIn) return G.interiors.serve(name, eff);
        if (ctx.inside && G.interiors && G.interiors.cur) { G.player.human.play('drink', { once: true, restart: true }); G.player.act = { kind: 'hurt', t: 0, dur: 1.4 }; }
        L.apply(eff); L.s.tally.meals++;
        return `${name}: ${describe(eff)}`;
      }) });
    };
    const night = G.hour >= 20.5 || G.hour < 3;
    switch (k) {
      case 'tapri': case 'misal': case 'thali': case 'biryani': case 'southindian': case 'chinese': case 'fastfood': case 'cafe': case 'bakery': case 'sweets': case 'juice': case 'icecream':
        for (const id of MENUS[k]) food(id);
        if (['misal', 'thali', 'biryani', 'southindian', 'chinese', 'fastfood', 'cafe', 'bakery', 'sweets', 'food'].includes(k)) this.gigItem(out, ctx);
        break;
      case 'food':
        for (const id of AREA_FOOD[ak] || ['thali', 'misal', 'vadapav', 'chai', 'water']) food(id);
        this.gigItem(out, ctx);
        break;
      case 'bar': {
        const club = this.isClub(ctx);
        if (ctx.inside) { for (const id of MENUS.bar) food(id); break; }
        if (club && night) {
          const cover = r10(1500 * mul / 1.3);
          out.push({ label: 'Cover charge, on the dance floor', note: 'Includes one drink. Dance off the day', price: cover, act: pay(cover, () => { const cv = G.life.s.covers || (G.life.s.covers = {}); for (const k in cv) if (cv[k] < nightOf(G) - 1) delete cv[k]; cv[venueKey(ctx)] = nightOf(G); this.close(); if (G.interiors.enter(ctx)) G.date && G.date.onEnter(G.interiors.cur.R, ctx); return ''; }) });
        } else if (club) out.push({ label: 'Club night', note: 'Opens at 8:30 PM, come back later', price: 0, disabled: 'Opens 8:30 PM' });
        for (const id of MENUS.bar) food(id);
        if (G.hour >= 1.5 && G.hour < 11) { out.length = 0; out.push({ label: 'Closed', note: 'Last call was at 1:30 AM. Pune rules.', price: 0, disabled: 'Closed' }); }
        break;
      }
      case 'barber': this.barber(out, mul); break;
      case 'clothes': this.clothes(out, mul * (ctx.tier === 'brand' ? 1.35 : ctx.tier === 'ethnic' ? 1.2 : 1), ctx.sub, ctx.tier); break;
      case 'shoes': for (const [id, name, note, base, hex] of SHOES) { const price = r10(base * mul); const own = L.s.wardrobe.includes('shoe_' + id);
        out.push({ label: name, note: own ? 'Yours, wear them' : note, price: own ? 0 : price, tag: own ? 'owned' : '', act: () => { if (!own && !this.spend(price)) return false; if (!own) L.s.wardrobe.push('shoe_' + id); this.wear({ shoe: hex }); L.s.upg.shoes = 1; return `Wearing ${name.toLowerCase()}`; } }); }
        break;
      case 'optician': case 'clinic': {
        const tier = ctx.tier || tierOf(k, ctx.name, '');
        const area = this.priceMul(ctx.x, ctx.z) * (k === 'clinic' ? TIER_MUL[tier] || 1 : 1);
        for (const [label, note, base, fx] of servicesFor(k, tier, G)) { const price = base ? r10(base * area) : 0; out.push({ label, note, price, act: () => { if (price && !this.spend(price)) return false; return fx(); } }); }
        break;
      }
      case 'pharmacy':
        for (const [id, base] of [['medkit', 220], ['painkiller', 40], ['ors', 25], ['water', 20]]) { const price = r10(base * mul); out.push({ label: ITEMS[id].name, note: ITEMS[id].note || describe(ITEMS[id].use), price, act: pay(price, () => { L.add(id); return `${ITEMS[id].name}, in your bag`; }) }); }
        break;
      case 'gym': {
        const price = r10(250 * mul);
        const gain = ctx.tier === 'premium' ? 4 : 3;
        out.push({ label: ctx.tier === 'premium' ? 'Session with a trainer' : 'Day pass: workout', note: `+${gain} max health, harder punches (now ${L.hpMax})`, price, disabled: L.s.energy < 0.2 ? 'Too tired' : L.s.fitness >= 40 ? 'Peak fitness' : '', act: pay(price, () => { L.change('fitness', gain); L.apply({ energy: -0.15, hunger: -0.08, thirst: -0.1, mood: 0.05 }); if (G.interiors && G.interiors.cur) { G.player.human.play('crouch', { restart: true }); G.player.act = { kind: 'hurt', t: 0, dur: 2.5 }; } return `Workout done. Max health ${L.hpMax}`; }) });
        out.push({ label: 'Protein shake', note: 'Chocolate, allegedly', price: r10(180 * mul), act: pay(r10(180 * mul), () => { L.apply({ hunger: 0.2, thirst: 0.15 }); return 'Gains'; }) });
        break;
      }
      case 'bank': this.bank(out); break;
      case 'jeweller': this.jeweller(out); break;
      case 'kirana':
        for (const [id, base] of [['water', 20], ['biscuit', 10], ['banana', 60], ['chikki', 40], ['energy', 110], ['lottery', 50], ['torch', 250]]) { const price = r10(base * (mul > 1 ? 1.1 : 1)); out.push({ label: ITEMS[id].name, note: ITEMS[id].note || describe(ITEMS[id].use), price, act: pay(price, () => { L.add(id); return `${ITEMS[id].name}, in your bag`; }) }); }
        break;
      case 'mobile':
        if (!L.s.phone) out.push({ label: 'Smartphone', note: 'Get delivery orders on the go (Zwiggy partner app)', price: r10(11999 * mul / 1.2), act: pay(r10(11999 * mul / 1.2), () => { L.s.phone = true; L.s.zwiggy = true; return 'New phone. Zwiggy orders will ping you, Y to accept'; }) });
        else out.push({ label: L.s.zwiggy ? 'Zwiggy orders: on' : 'Zwiggy orders: off', note: 'Toggle delivery pings', price: 0, act: () => { L.s.zwiggy = !L.s.zwiggy; return L.s.zwiggy ? 'Orders on' : 'Orders off'; } });
        out.push({ label: 'Prepaid recharge, 28 days', note: 'Unlimited calls, 2 GB a day', price: 299, act: pay(299, () => { L.change('mood', 0.02); return 'Recharged'; }) });
        break;
      case 'electronics':
        out.push({ label: 'LED torch', note: 'Bright, rechargeable. L switches it on', price: r10(450 * mul), act: pay(r10(450 * mul), () => { L.add('torch'); return 'In your jhola'; }) });
        out.push({ label: 'Speaker system for your auto', note: 'Bollywood on the go: passengers tip 15% more', price: r10(3500 * mul), tag: L.s.upg.speaker ? 'owned' : '', disabled: L.s.upg.speaker ? 'Fitted' : '', act: pay(r10(3500 * mul), () => { L.s.upg.speaker = 1; return 'Fitted. Passengers love it'; }) });
        out.push({ label: 'Dashcam', note: 'Argue a challan with evidence: better odds', price: r10(4999 * mul), tag: L.s.upg.dashcam ? 'owned' : '', disabled: L.s.upg.dashcam ? 'Fitted' : '', act: pay(r10(4999 * mul), () => { L.s.upg.dashcam = 1; return 'Dashcam on. The police argue less'; }) });
        if (!L.s.phone) out.push({ label: 'Smartphone', note: 'Unlocks delivery orders on the go', price: r10(12999 * mul / 1.2), act: pay(r10(12999 * mul / 1.2), () => { L.s.phone = true; L.s.zwiggy = true; return 'New phone. Zwiggy orders will ping you'; }) });
        break;
      case 'books':
        out.push({ label: 'Paperback novel', note: 'Something to read at a tapri', price: r10(350 * mul), act: pay(r10(350 * mul), () => { L.add('book'); return 'In your bag'; }) });
        out.push({ label: 'Pune: a city guide', note: 'Every landmark marked; +respect for knowing your city', price: r10(499 * mul), disabled: L.s.upg.guide ? 'Read it' : '', act: pay(r10(499 * mul), () => { L.s.upg.guide = 1; L.change('respect', 2); return 'You know the city better than most'; }) });
        break;
      case 'florist':
        out.push({ label: 'Mogra gajra', note: 'A gift, passengers smile', price: r10(40 * mul), act: pay(r10(40 * mul), () => { L.add('gajra'); return 'In your bag'; }) });
        out.push({ label: 'Marigold garland for the auto', note: 'For luck. +karma', price: r10(80 * mul), act: pay(r10(80 * mul), () => { L.change('karma', 2); return 'Your auto looks festive'; }) });
        break;
      case 'paan':
        out.push({ label: 'Meetha paan', note: 'Gulkand, coconut, no tobacco', price: r10(40 * mul), act: pay(r10(40 * mul), () => { L.apply({ mood: 0.05 }); return 'Sweet. Don’t spit on the road'; }) });
        out.push({ label: 'Soda', note: 'Lemon soda, fizzy', price: r10(30 * mul), act: pay(r10(30 * mul), () => { L.apply({ thirst: 0.25 }); return 'Refreshing'; }) });
        break;
      case 'dealer': this.dealer(out, ctx); break;
      case 'garage': this.garage(out, ctx, mul); this.g.hustle && this.g.hustle.garageItems(out, ctx); break;
      case 'fuel': this.fuel(out); break;
      case 'travel':
        out.push({ label: 'Rent a scooter, 24 hours', note: 'Delivered right here, helmet included', price: r10(450 * mul), act: pay(r10(450 * mul), () => { this.spawnOwned('scooter', PAINTS[this.rng.int(0, 5)], ctx, true); return 'Your rental scooter is outside'; }) });
        out.push({ label: 'Shivneri to Mumbai', note: 'Other cities are coming', price: 0, disabled: 'Coming soon' });
        out.push({ label: 'Lonavala day trip', note: 'The ghats are coming', price: 0, disabled: 'Coming soon' });
        break;
      case 'chowki': this.chowki(out); break;
      case 'lodge': {
        const price = r10(1200 * mul);
        out.push({ label: 'A room for the night', note: 'Sleep till 7 AM: full energy, +health', price, act: pay(price, () => { this.close(); G.sleep(); return ''; }) });
        food('chai');
        break;
      }
      case 'estate': this.g.props.agentItems(out); this.g.hustle && this.g.hustle.agentItems(out); break;
      case 'property': this.g.props.items(out, ctx.prop); break;
    }
    return out;
  }
  isClub(ctx) { const a = this.g.people.areas.at(ctx.x, ctx.z); return /club|lounge|social|brew|pub/i.test(ctx.name) || (a && a.kind === 'polished'); }
  hello(kind) { return HELLO[kind] ? this.rng.pick(HELLO[kind]) : null; }
  // the keeper says it out loud (shop_lines.json), never the same line twice in a row
  speak(kind, sc) {
    const arr = SHOPL[kind] && SHOPL[kind][sc];
    if (!arr || !arr.length) return;
    this.lastLine = this.lastLine || {};
    let i = this.rng.int(0, arr.length - 1);
    if (arr.length > 1 && this.lastLine[kind + sc] === i) i = (i + 1) % arr.length;
    this.lastLine[kind + sc] = i;
    const [, roman, en] = arr[i];
    if (this.g.audio.voice('k_' + kind + '_' + sc + i, 1, 0, false, 1)) this.g.hud.say(kind === 'bar' ? 'Bartender' : kind === 'chowki' ? 'Havaldar' : kind === 'bank' ? 'Cashier' : 'Shopkeeper', roman, roman === en ? '' : en, 3.2);
  }
  gigItem(out, ctx) {
    const G = this.g;
    if (!G.gigs || G.gigs.job || (G.rides && G.rides.current)) return;
    out.push({ label: 'Deliver an order for them', note: 'Zwiggy: a parcel to a flat nearby, paid on delivery', price: 0, tag: 'job', act: () => { this.close(); G.gigs.startAt(ctx); return ''; } });
  }
  barber(out, mul) {
    const L = this.life, P = this.g.player, look = P.look, fem = look.female;
    const H = (label, note, base, patch) => { const price = r10(base * mul); out.push({ label, note, price, act: () => { if (!this.spend(price)) return false; this.wear(patch); L.change('mood', 0.04); return label; } }); };
    if (fem) { H('Long, blow-dried', 'Salon finish', 700, { style: 'hair_long' }); H('Juda (bun)', 'Neat, for the heat', 350, { style: 'hair_buns' }); H('Pixie cut', 'Short and bold', 600, { style: 'hair_buzzedfemale' }); }
    else { H('Regular cutting', 'Side parting, a bit of oil', 150, { style: 'hair_simpleparted' }); H('Army cut', 'Short all over', 120, { style: 'hair_buzzed' });
      H(look.beard ? 'Clean shave' : 'Grow a beard (well, a trim)', look.beard ? 'Razor and alum' : 'Shaped and lined', 90, { beard: !look.beard }); }
    if (this.ctx && this.ctx.tier === 'premium') {
      const kp = r10(4500 * mul / 1.9); out.push({ label: 'Keratin treatment', note: 'Silky for weeks: charm up', price: kp, act: () => { if (!this.spend(kp)) return false; L.s.charmBoost = Math.min(0.25, (L.s.charmBoost || 0) + 0.07); return 'Your hair has never looked like this'; } });
    }
    H('Hair colour: burgundy', 'A touch of red', 550, { hair: 0x4a1a1a });
    H('Hair colour: natural black', 'Back to basics', 400, { hair: 0x0d0b0a });
    const c = r10(180 * mul); out.push({ label: 'Champi (head massage)', note: 'Ten minutes of bliss: +energy, +mood', price: c, act: () => { if (!this.spend(c)) return false; L.apply({ energy: 0.15, mood: 0.1 }); return 'Bliss'; } });
  }
  clothes(out, mul, sub, tier) {
    const L = this.life;
    const kindOfC = (p) => p.cut && p.cut[3] >= 1 ? 'ethnic' : p.top !== undefined ? 'tops' : 'bottoms';
    const WHO = { M: 'Men’s', W: 'Women’s', U: 'Unisex' };
    for (const [id, name, note0, base, patch, who] of CLOTHES) {
      if (sub && kindOfC(patch) !== sub) continue;
      // what this kind of store stocks
      if (tier === 'women' && who === 'M') continue;
      if (tier === 'men' && who === 'W') continue;
      if (tier === 'ethnic' && kindOfC(patch) !== 'ethnic') continue;
      const note = `${WHO[who]} · ${note0}`;
      const own = L.s.wardrobe.includes(id), price = r10(base * mul);
      out.push({ label: name, note: own ? 'In your wardrobe, wear it' : note, price: own ? 0 : price, tag: own ? 'owned' : '', act: () => {
        if (!own && !this.spend(price)) return false;
        if (!own) L.s.wardrobe.push(id);
        this.wear(patch);
        const P = this.g.player, odd = !P.look.female && patch.cut && patch.cut[3] === 2;
        return odd ? `Wearing the ${name.toLowerCase()}. Pune will have opinions` : `Wearing the ${name.toLowerCase()}`;
      } });
    }
  }
  bank(out) {
    const L = this.life, S = this.g.stats;
    const dep = (n) => () => { const v = n === 'all' ? S.money : Math.min(n, S.money); if (v <= 0) return 'Nothing to deposit'; S.money -= v; L.s.bank += v; this.g.saveStats(); return `Deposited ${fmt(v)} · balance ${fmt(L.s.bank)}`; };
    const wd = (n) => () => { const v = n === 'all' ? L.s.bank : Math.min(n, L.s.bank); if (v <= 0) return 'Nothing to withdraw'; L.s.bank -= v; S.money += v; this.g.saveStats(); return `Withdrew ${fmt(v)} · balance ${fmt(L.s.bank)}`; };
    out.push({ label: `Balance ${fmt(L.s.bank)}`, note: 'Cash in the bank can’t be stolen when you’re knocked out. 0.4% interest a day', price: 0, disabled: ' ' });
    out.push({ label: 'Deposit ₹1,000', price: 0, act: dep(1000) }, { label: 'Deposit ₹10,000', price: 0, act: dep(10000) }, { label: 'Deposit everything', price: 0, act: dep('all') });
    out.push({ label: 'Withdraw ₹1,000', price: 0, act: wd(1000) }, { label: 'Withdraw ₹10,000', price: 0, act: wd(10000) }, { label: 'Withdraw everything', price: 0, act: wd('all') });
  }
  goldRate() {
    // a slow daily drift plus hourly noise around the base: buy low, sell high
    const d = (this.g.clock || 0) / 24, h = Math.floor(this.g.clock || 0);
    const n = Math.sin(d * 1.7) * 0.05 + Math.sin(d * 0.37 + 2) * 0.07 + (((h * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.02;
    return Math.round(this.goldBase * (1 + n));
  }
  jeweller(out) {
    const L = this.life, S = this.g.stats, rate = this.goldRate(), sell = Math.round(rate * 0.97);
    out.push({ label: `Today: ${fmt(rate)}/g · buy back ${fmt(sell)}/g`, note: `You hold ${L.s.gold} g (worth ${fmt(L.s.gold * sell)}). The rate moves every hour`, price: 0, disabled: ' ' });
    for (const g of [1, 10]) out.push({ label: `Buy ${g} g gold coin`, note: '24 carat, hallmarked', price: rate * g, act: () => { if (!this.spend(rate * g)) return false; L.s.gold += g; return `You own ${L.s.gold} g of gold`; } });
    for (const g of [1, 10]) out.push({ label: `Sell ${g} g`, price: 0, disabled: L.s.gold < g ? 'Not enough' : '', act: () => { L.s.gold -= g; S.money += sell * g; this.g.audio.cash(); this.g.saveStats(); return `Sold for ${fmt(sell * g)}`; } });
  }
  dealer(out, ctx) {
    const L = this.life;
    for (const [type, name, note, price] of DEALER) {
      out.push({ label: name, note: `${note} · on-road price`, price, act: () => {
        if (!this.spend(price, true)) return false;
        this.spawnOwned(type, PAINTS[this.rng.int(0, PAINTS.length - 1)], ctx);
        L.change('respect', type === 'suv' || type === 'sedan' ? 5 : 2);
        return `Your new ${name.toLowerCase()} is parked outside. Keys are in your bag`;
      } });
    }
  }
  garage(out, ctx, mul) {
    const L = this.life, P = this.g.player, U = L.s.upg;
    // repairs: whatever you came in on, or your auto parked outside (real workshop rates)
    const here = !P.onFoot ? P.cur : (P.dropped.find(d => Math.hypot(d.veh.x - ctx.x, d.veh.z - ctx.z) < 16) || {}).veh;
    if (here) {
      const isAuto = here === P.auto, type = isAuto ? 'auto' : here.type;
      const base = { auto: 6500, cycle: 600, scooter: 4200, bike: 5200, hatch: 38000, sedan: 46000, taxi: 42000, suv: 62000, tempo: 30000, bus: 90000 }[type] || 20000;
      const dmg = here.dmg || 0, name = isAuto ? 'your auto' : 'the ' + here.spec.name.toLowerCase();
      const cost = r10(Math.max(250, base * dmg) * Math.max(0.9, mul * 0.85));
      out.push({ label: dmg > 0.02 ? `Repair ${name}` : `${name.charAt(0).toUpperCase() + name.slice(1)}: no damage`, note: dmg > 0.02 ? `Body and engine at ${Math.round((1 - dmg) * 100)}%. Dents, alignment, the works` : 'Runs like new', price: dmg > 0.02 ? cost : 0, disabled: dmg > 0.02 ? '' : ' ',
        act: () => { if (!this.spend(cost)) return false; here.dmg = 0; return `Fixed. ${isAuto ? 'Your auto' : 'It'} runs like new`; } });
      const svc = r10(({ auto: 900, scooter: 750, bike: 850, cycle: 150 }[type] || 4500) * Math.max(0.9, mul * 0.85));
      out.push({ label: 'General service', note: 'Oil, filters, brakes, chain. Small dents knocked out', price: svc, act: () => { if (!this.spend(svc)) return false; here.dmg = Math.max(0, (here.dmg || 0) - 0.15); return 'Serviced'; } });
      if (!isAuto && here.bodyMesh && here.owned) {
        const rp = r10((here.spec.two ? 3500 : 22000) * mul);
        out.push({ label: 'Repaint', note: 'A new colour for your own vehicle', price: rp, act: () => { if (!this.spend(rp)) return false; const c = PAINTS[this.rng.int(0, PAINTS.length - 1)]; here.paint = c; here.bodyMesh.instanceColor.setXYZ(0, c[0], c[1], c[2]); here.bodyMesh.instanceColor.needsUpdate = true; const rec = L.s.vehicles.find(v => v.id === here.owned.id); if (rec) rec.col = c; return 'Fresh paint'; } });
      }
    }
    const eng = U.engine || 0;
    if (eng < 2) { const price = r10((eng ? 14000 : 6000) * mul); out.push({ label: `Engine tune, stage ${eng + 1}`, note: `Your auto: +${eng ? 16 : 8}% top speed`, price, act: () => { if (!this.spend(price)) return false; U.engine = eng + 1; this.g.applyUpgrades(); return 'Your auto pulls harder now'; } }); }
    if (!U.horn) { const price = r10(1200 * mul); out.push({ label: 'Pressure horn', note: 'People jump out of the way from further', price, act: () => { if (!this.spend(price)) return false; U.horn = 1; return 'Loud. Very loud'; } }); }
    if (!U.seat) { const price = r10(1800 * mul); out.push({ label: 'Leopard-print seat covers', note: 'Passengers tip 5% more (they say they don’t)', price, act: () => { if (!this.spend(price)) return false; U.seat = 1; return 'Classy'; } }); }
    const sp = r10(300 * mul);
    STICKERS.forEach((t, i) => { if ((U.sticker || 0) !== i) out.push({ label: `Rear sticker: ${t}`, note: 'Painted on the back of your auto', price: sp, act: () => { if (!this.spend(sp)) return false; U.sticker = i; this.g.applyUpgrades(); return 'New sticker'; } }); });
    // a vehicle that isn't yours, right here: no questions asked
    const v = !P.onFoot && P.cur && P.cur.stolen ? P.cur : (P.dropped.find(d => d.veh.stolen && Math.hypot(d.veh.x - ctx.x, d.veh.z - ctx.z) < 14) || {}).veh;
    if (v) {
      const base = (DEALER.find(d => d[0] === v.type) || [0, 0, 0, 60000])[3];
      const offer = r10(base * 0.08 * (0.8 + this.rng.next() * 0.4));
      out.push({ label: `Sell the ${v.spec.name.toLowerCase()} you came with`, note: 'Cash, no papers, no questions. −karma', price: 0, tag: 'job', act: () => {
        if (!P.onFoot && P.cur === v) P.exit(this.g.traffic, true);
        const d = P.dropped.find(q => q.veh === v); if (d) P.removeDropped(d, this.g.traffic);
        v.dispose(); this.g.stats.money += offer; this.g.audio.cash(); this.g.saveStats(); L.change('karma', -4);
        return `Sold for ${fmt(offer)}. It was never here`;
      } });
    }
  }
  fuel(out) {
    const P = this.g.player, L = this.life;
    const v = !P.onFoot ? P.cur : P.auto;
    const isAuto = v === P.auto, cng = isAuto || v.type === 'taxi' || v.type === 'bus';
    const fuel = v.fuel ?? 1, need = 1 - fuel;
    const tank = isAuto ? 8 : v.spec.two ? 5 : 35, per = cng ? 92 : 106;          // kg of CNG or litres of petrol; ₹ per unit
    const cost = Math.max(10, Math.round(need * tank * per));
    out.push({ label: `Fill up ${cng ? 'CNG' : 'petrol'}, ${isAuto ? 'your auto' : v.spec.name.toLowerCase()}`, note: `Tank at ${Math.round(fuel * 100)}% · ${cng ? '₹92/kg' : '₹106/litre'}`, price: cost, disabled: need < 0.03 ? 'Full' : '', act: () => { if (!this.spend(cost)) return false; v.fuel = 1; if (isAuto) L.s.autoFuel = 1; return 'Tank full'; } });
    out.push({ label: 'Air in the tyres', note: 'Free, the guy smiles', price: 0, act: () => { L.change('karma', 0.5); return 'Pressure checked'; } });
    out.push({ label: 'Water bottle', note: 'From the pump’s kiosk', price: 20, act: () => { if (!this.spend(20)) return false; L.add('water'); return 'In your bag'; } });
  }
  chowki(out) {
    const G = this.g, pol = G.police;
    const dues = pol.duesTotal;
    out.push({ label: dues ? `Pay pending challans (${pol.dues.length})` : 'No pending challans', note: dues ? 'Clears your record and your licence' : 'Clean record. The havaldar nods', price: dues, disabled: dues ? '' : ' ', act: () => { if (G.stats.money < dues) { this.msg('Not enough cash'); return false; } pol.payDues(); return 'All paid. Drive carefully'; } });
    if (pol.heat > 0) { const f = 2000 * pol.heat; out.push({ label: 'Turn yourself in', note: 'Pay the fine, they stop looking for you', price: f, act: () => { if (!this.spend(f)) return false; pol.heat = 0; pol.clearMarshals(); return 'Fine paid. Don’t do it again'; } }); }
    out.push({ label: 'Report a lost wallet', note: 'They write it down. That’s all', price: 0, act: () => 'An FIR, in triplicate' });
  }

  // ---------------------------------------------------------------- doing it
  spend(price, bankToo = false) {
    const S = this.g.stats, L = this.life;
    if (S.money >= price) { S.money -= price; this.g.saveStats(); this.g.audio.cash?.(); return true; }
    if (bankToo && S.money + L.s.bank >= price) { const fromBank = price - S.money; S.money = 0; L.s.bank -= fromBank; this.g.saveStats(); this.g.audio.cash?.(); return true; }
    this.msg(bankToo ? `Not enough money, cash and bank together are short of ${fmt(price)}` : `Not enough cash for ${fmt(price)}${L.s.bank >= price ? ' (it’s in the bank)' : ''}`);
    return false;
  }
  // change what you're wearing (kept across reloads)
  wear(patch) {
    const P = this.g.player, L = this.life, look = P.look;
    if (patch.top !== undefined) look.top = col(patch.top);
    if (patch.bottom !== undefined) look.bottom = col(patch.bottom);
    if (patch.shoe !== undefined) look.shoe = col(patch.shoe);
    if (patch.hair !== undefined) look.hair = col(patch.hair);
    if (patch.cut) look.cut = new THREE.Vector4(...patch.cut);
    if (patch.style) look.style = patch.style;
    if (patch.beard !== undefined) look.beard = patch.beard;
    applyWear(look, patch);
    this.g.W.kit.applyLook(P.human, look);
    L.s.look = lookToJSON(look);
    L.save();
  }
  wearById(id) {
    const c = CLOTHES.find(q => q[0] === id);
    if (c) this.wear(c[4]);
    const sh = SHOES.find(q => 'shoe_' + q[0] === id);
    if (sh) this.wear({ shoe: sh[4] });
  }
  // one of your vehicles, brought out (at home)
  respawnOwned(rec, at) {
    const G = this.g, P = G.player;
    const spot = G.safeDrop(at.x, at.z) || at;
    const v = new Vehicle(G.W, G.scene, G.vmats, rec.type, rec.col);
    v.reset(spot.x, spot.z, spot.th || 0); v.y = G.W.surf.height(spot.x, spot.z);
    v.plate = rec.plate; v.helmet = true; v.fuel = rec.fuel ?? 1; v.owned = { id: rec.id };
    P.addDropped(v, G.traffic);
  }
  spawnOwned(type, paint, ctx, rental = false) {
    const G = this.g, P = G.player, L = this.life;
    const spot = G.safeDrop(ctx.x, ctx.z) || { x: ctx.x, z: ctx.z, th: 0 };
    const v = new Vehicle(G.W, G.scene, G.vmats, type, paint);
    const S = specOf(type), off = S.W / 2 + 0.3;
    const e = spot.e;
    let x = spot.x, z = spot.z, th = spot.th;
    if (e) { const n = G.W.graph.nearest(spot.x, spot.z, 30, q => q === e); if (n) { const t = G.W.graph.at(e, n.s); th = Math.atan2(t[3], t[2]); const side = Math.sign((spot.x - t[0]) * t[3] - (spot.z - t[1]) * t[2]) || 1; const lat = e.w / 2 - off; x = t[0] + t[3] * lat * side; z = t[1] - t[2] * lat * side; } }
    v.reset(x, z, th); v.y = G.W.surf.height(x, z);
    v.plate = P.randomPlate(); v.helmet = true; v.fuel = 1;
    const id = 'v' + Date.now().toString(36);
    v.owned = { id, rental, until: rental ? (G.clock || 0) + 24 : 0 };
    if (!rental) L.s.vehicles.push({ id, type, col: paint, plate: v.plate });
    L.save();
    P.addDropped(v, G.traffic);
    G.setWaypoint({ x, z, name: 'Your ' + S.name.toLowerCase() });
  }

  // ---------------------------------------------------------------- the panel
  build() {
    const el = document.createElement('div');
    el.className = 'shop glass'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Shop');
    el.innerHTML = `<div class="sh-head"><div class="sh-k"></div><div class="sh-t"></div><div class="sh-mr" lang="mr"></div>
      <div class="sh-say"><b></b><span></span></div></div><div class="sh-list"></div><div class="sh-msg" aria-live="polite"></div>
      <div class="sh-foot"><span class="sh-wallet"></span><span><span class="kbd">1–9</span> or <span class="kbd">↑↓</span> <span class="kbd">Enter</span> · <span class="kbd" data-k="F">F</span> leave</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => { const b = e.target.closest('.sh-item'); if (b && !b.disabled) this.buy(+b.dataset.i); });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'Escape' || e.code === 'KeyF' || e.code === 'KeyE') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
      const m = /^Digit(\d)$/.exec(e.code);
      if (m) { const i = (+m[1] || 10) - 1; this.buy(i); return; }
      this.nav.key(e);
    }, true);
    this.nav = new KbNav(el.querySelector('.sh-list'), '.sh-item');
  }
  show(ctx) {
    const G = this.g;
    if (G.trial && !ctx.list && ['clothes', 'shoes', 'barber'].includes(ctx.kind)) { G.trial.show(ctx, ctx.kind === 'barber' ? 'salon' : ctx.kind === 'shoes' ? 'shoes' : 'clothes', ctx.sub); return; }
    this.ctx = ctx; this.open = true;
    G.state = 'shop'; G.audio.updateEngine?.(0, 0, false);
    const K = ctx.kind === 'property' ? ['Property', 'मालमत्ता'] : KIND_INFO[ctx.kind];
    const tl = ctx.tier && ['optician', 'clinic', 'barber', 'gym', 'clothes'].includes(ctx.kind) ? TIER_LABEL[ctx.tier] : null;
    this.el.querySelector('.sh-k').textContent = `${tl || K[0]} · ${K[1]}`;
    this.el.querySelector('.sh-t').textContent = ctx.name;
    this.el.dataset.ui = UI_OF[ctx.kind] || 'list';
    this.el.querySelector('.sh-mr').textContent = ctx.mr && ctx.mr !== K[1] ? ctx.mr : '';
    const hello = HELLO[ctx.kind] ? HELLO[ctx.kind][0] : ctx.prop ? [ctx.prop.blurb, ''] : ['', ''];
    this.el.querySelector('.sh-say b').textContent = hello[0] ? `“${hello[0]}”` : '';
    this.el.querySelector('.sh-say span').textContent = hello[1] && hello[1] !== hello[0] ? hello[1] : '';
    this.msg('');
    this.nav.i = -1;
    this.render();
    this.el.hidden = false;
    this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
  }
  render() {
    const list = this.el.querySelector('.sh-list');
    this.cur = this.items(this.ctx);
    list.innerHTML = '';
    this.cur.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'sh-item' + (it.tag ? ' ' + it.tag : '');
      b.dataset.i = i;
      b.disabled = !!it.disabled;
      b.innerHTML = `<span class="n">${i < 9 ? i + 1 : ''}</span><span class="nm"><b></b><small></small></span><span class="pr"></span>`;
      b.querySelector('b').textContent = it.label;
      b.querySelector('small').textContent = it.note || '';
      b.querySelector('.pr').textContent = it.disabled && it.disabled.trim() ? it.disabled : it.price ? fmt(it.price) : it.tag === 'owned' ? 'Wear' : it.tag === 'job' ? 'Go' : it.disabled ? '' : 'Free';
      list.appendChild(b);
    });
    const L = this.life;
    this.nav.paint();
    this.el.querySelector('.sh-wallet').textContent = `Cash ${fmt(this.g.stats.money)}${L.s.bank ? ` · Bank ${fmt(L.s.bank)}` : ''}`;
  }
  buy(i) {
    const it = this.cur && this.cur[i];
    if (!it || it.disabled || !it.act) return;
    const r = it.act();
    if (r === false) return;
    if (this.ctx && it.price && ['menu', 'cafe', 'fast', 'neon'].includes(UI_OF[this.ctx.kind])) this.speak(this.ctx.kind, 'order');
    if (!this.open) return;
    if (r) this.msg(r, true);
    this.render();
  }
  msg(t, good) { const m = this.el.querySelector('.sh-msg'); m.textContent = t || ''; m.classList.toggle('good', !!good); }
  close() {
    if (!this.open) return;
    this.open = false; this.el.hidden = true;
    if (this.g.state === 'shop') this.g.state = 'play';
    this.life.save();
    this.scanT = 0.6;
  }
  // places to show on the map / in the backpack's "Nearby" list
  nearby(x, z, r = 600) {
    const out = [], st = this.g.W.streamer, seen = new Set();
    for (const c of st.built) {
      if (!c.doors) continue;
      for (const d of c.doors) {
        if (d.shop < 0 || seen.has(d.shop)) continue;
        const dd = Math.hypot(d.x - x, d.z - z);
        if (dd > r) continue;
        const inf = this.infoOf(d);
        if (!inf) continue;
        seen.add(d.shop);
        out.push({ ...inf, d: dd });
      }
    }
    for (const p of this.places) { const dd = Math.hypot(p.x - x, p.z - z); if (dd < r * 2) out.push({ ...p, d: dd }); }
    out.sort((a, b) => a.d - b.d);
    return out;
  }
}

function parodyFuel(n, k) {
  if (k !== 'fuel') return n;
  return n.replace(/Hindustan Petroleum|\bHP\b/i, 'Hindustaan Petrolium').replace(/Bharat Petroleum|BPCL/i, 'Bhaarat Petrolium').replace(/Indian Oil|IOCL/i, 'Indiyan Oyl').replace(/\bShell\b/i, 'Shel').replace(/MNGL/i, 'MahaGas') || 'Petrol pump';
}
export function lookToJSON(L) {
  const h = (c) => '#' + c.clone().convertLinearToSRGB().getHexString();
  return { top: h(L.top), bottom: h(L.bottom), shoe: h(L.shoe), hair: h(L.hair), cut: [L.cut.x, L.cut.y, L.cut.z, L.cut.w], style: L.style, beard: !!L.beard,
    pat: L.pat || 0, patCol: L.patCol ? h(L.patCol) : null, hem: L.hem || 0, denim: !!L.denim, hat: !!L.hat, hatCol: L.hatCol ? h(L.hatCol) : null, shades: !!L.shades };
}
export function lookFromJSON(L, j) {
  if (!j) return L;
  const c = (h) => new THREE.Color(h).convertSRGBToLinear();
  L.top = c(j.top); L.bottom = c(j.bottom); L.shoe = c(j.shoe); L.hair = c(j.hair); L.cut = new THREE.Vector4(...j.cut); L.style = j.style; L.beard = j.beard;
  L.pat = j.pat || 0; L.patCol = j.patCol ? c(j.patCol) : null; L.hem = j.hem || 0; L.denim = !!j.denim; L.hat = !!j.hat; L.hatCol = j.hatCol ? c(j.hatCol) : null; L.shades = !!j.shades;
  return L;
}

// the newer clothing fields: patterns, jackets, skirts and dresses, denim, caps, sunglasses
export function applyWear(L, p) {
  const c = (h) => new THREE.Color(h).convertSRGBToLinear();
  if (p.top !== undefined) { L.pat = p.pat || 0; L.patCol = p.patCol !== undefined ? c(p.patCol) : null; }
  if (p.pat !== undefined) L.pat = p.pat;
  if (p.patCol !== undefined) L.patCol = c(p.patCol);
  if (p.denim !== undefined) L.denim = p.denim;
  if (p.hem !== undefined) L.hem = p.hem;
  if (p.cutW !== undefined) { L.cut = L.cut.clone(); L.cut.w = p.cutW; if (p.cutW !== 1) L.cut.y = 1; }
  if (p.hat !== undefined) L.hat = p.hat;
  if (p.hatCol !== undefined) L.hatCol = c(p.hatCol);
  if (p.shades !== undefined) L.shades = p.shades;
}
