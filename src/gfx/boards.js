// Shop boards. A shared atlas of generic boards per district (Deccan college strip, peths, Camp,
// Koregaon Park, station area, residential lanes) plus small per-chunk atlases for real places
// from OpenStreetMap, rendered under GTA-style parody names. Boards are bilingual the way
// Maharashtra requires (Marathi in Devanagari, never smaller than the other script) with a few
// designs: classic flex, modern backlit ACP, chain-brand boards, banks and chemists.
import * as THREE from 'three';
import { RNG } from '../core/util.js';

// [english, marathi, category]  (trad = Marathi-first traditional board)
const POOLS = {
  deccan: [
    ['Brew Theory', 'ब्रू थिअरी', 'cafe'], ['Chai Katta', 'चहा कट्टा', 'cafe'], ['Urban Thread', 'अर्बन थ्रेड', 'clothes'],
    ['Galaxy Mobiles', 'गॅलॅक्सी मोबाईल्स', 'mobile'], ['FC Print Hub', 'एफसी प्रिंट हब', 'books'], ['Shabari Pure Veg', 'शबरी प्युअर व्हेज', 'food'],
    ['Momo Mania', 'मोमो मेनिया', 'food'], ['Deccan Opticians', 'डेक्कन ऑप्टिशियन्स', 'optician'], ['Mastani House', 'मस्तानी हाउस', 'icecream'],
    ['Book Adda', 'बुक अड्डा', 'books'], ['Sneaker Street', 'स्नीकर स्ट्रीट', 'shoes'], ['Café Chaloo', 'कॅफे चालू', 'cafe'],
    ['Pune Waffle Co.', 'पुणे वॅफल कं.', 'cafe'], ['Kulkarni Classes', 'कुलकर्णी क्लासेस', 'generic'], ['Juice Junction', 'ज्यूस जंक्शन', 'icecream'],
    ['Denim Lab', 'डेनिम लॅब', 'clothes'], ['Gadget Guru', 'गॅजेट गुरू', 'electronics'], ['The Bombay Sandwich', 'द बॉम्बे सँडविच', 'food'],
    ['Glow Salon', 'ग्लो सलून', 'salon'], ['Hotel Shrimant', 'हॉटेल श्रीमंत', 'food'], ['Starbeans Coffee', 'स्टारबीन्स कॉफी', 'cafe', 'brand'],
    ["McDougal's", 'मॅकडूगल्स', 'food', 'brand'], ['Café Coffee Daily', 'कॅफे कॉफी डेली', 'cafe', 'brand'], ['Chitre Bandhu', 'चित्रे बंधू', 'sweets', 'brand'],
  ],
  peth: [
    ['Shree Ganesh Sweets', 'श्री गणेश स्वीट्स', 'sweets', 'trad'], ['Sagar Amruttulya', 'सागर अमृततुल्य', 'cafe', 'trad'],
    ['Mangalmurti Saree Centre', 'मंगलमूर्ती साडी सेंटर', 'clothes', 'trad'], ['Chandulal Saraf', 'चंदुलाल सराफ', 'jewellery', 'trad'],
    ['Om Kirana Bhandar', 'ओम किराणा भांडार', 'grocery', 'trad'], ['Shriram Hardware', 'श्रीराम हार्डवेअर', 'hardware', 'trad'],
    ['Anand Pustakalay', 'आनंद पुस्तकालय', 'books', 'trad'], ['Mauli Phool Bhandar', 'माऊली फूल भांडार', 'generic', 'trad'],
    ['Vitthal Rakhumai Bhojanalay', 'विठ्ठल रखुमाई भोजनालय', 'food', 'trad'], ['Kalpana Misal', 'कल्पना मिसळ', 'food', 'trad'],
    ['Joshi Vadapav', 'जोशी वडापाव', 'food', 'trad'], ['Puja Sahitya Bhandar', 'पूजा साहित्य भांडार', 'generic', 'trad'],
    ['Morya Electricals', 'मोरया इलेक्ट्रिकल्स', 'electronics', 'trad'], ['Swami Samarth Jewellers', 'स्वामी समर्थ ज्वेलर्स', 'jewellery', 'trad'],
    ['Gurukrupa Xerox', 'गुरुकृपा झेरॉक्स', 'books', 'trad'], ['Rajmudra Tailors', 'राजमुद्रा टेलर्स', 'clothes', 'trad'],
    ['Peshwai Paithani', 'पेशवाई पैठणी', 'clothes', 'trad'], ['Amrut Dairy', 'अमृत डेअरी', 'grocery', 'trad'],
    ['Sahyadri Bakery', 'सह्याद्री बेकरी', 'bakery', 'trad'], ['Vijay Medical', 'विजय मेडिकल', 'pharmacy'],
    ['PN Gadkari Jewellers', 'पु. ना. गडकरी ज्वेलर्स', 'jewellery', 'brand'], ['Kosmos Sahakari Bank', 'कॉसमॉस सहकारी बँक', 'bank'],
  ],
  camp: [
    ['Irani Café Kohinoor', 'इराणी कॅफे कोहिनूर', 'cafe'], ['Royal Bakery', 'रॉयल बेकरी', 'bakery'], ['East Street Shoes', 'ईस्ट स्ट्रीट शूज', 'shoes'],
    ['Faroukh Perfumes', 'फारुख परफ्युम्स', 'generic'], ['Bombay Tailors', 'बॉम्बे टेलर्स', 'clothes'], ['Main Street Opticals', 'मेन स्ट्रीट ऑप्टिकल्स', 'optician'],
    ['Cake Walk', 'केक वॉक', 'bakery'], ['Al-Karim Biryani', 'अल-करीम बिर्याणी', 'food'], ['Sassanian Bakery', 'ससानियन बेकरी', 'bakery'],
    ['Fashion Lane', 'फॅशन लेन', 'clothes'], ['Camp Footwear', 'कॅम्प फूटवेअर', 'shoes'], ['Parsee Dairy Farm', 'पारसी डेअरी फार्म', 'grocery'],
    ['Mumbai Chicken Centre', 'मुंबई चिकन सेंटर', 'grocery'], ['Kayaani Bakery', 'कयानी बेकरी', 'bakery', 'brand'],
    ['Batta Shoes', 'बाटा शूज', 'shoes', 'brand'], ["Domingo's Pizza", 'डोमिंगोज पिझ्झा', 'food', 'brand'], ['Apolo Pharmacy', 'अपोलो फार्मसी', 'pharmacy', 'brand'],
  ],
  kp: [
    ['The Leaf Bistro', 'द लीफ बिस्ट्रो', 'cafe'], ['Lane 7 Brewing', 'लेन ७ ब्रूइंग', 'bar'], ['Sunbird Café', 'सनबर्ड कॅफे', 'cafe'],
    ['Banyan Boutique', 'बनियन बुटीक', 'clothes'], ['Zen Garden Spa', 'झेन गार्डन स्पा', 'salon'], ['Organic Basket', 'ऑरगॅनिक बास्केट', 'grocery'],
    ['Pasta Street', 'पास्ता स्ट्रीट', 'food'], ['Bakehouse 9', 'बेकहाउस ९', 'bakery'], ['The Green Room', 'द ग्रीन रूम', 'bar'],
    ['Café Mango Tree', 'कॅफे मँगो ट्री', 'cafe'], ['Sushi Dojo', 'सुशी डोजो', 'food'], ['Art Lane Gallery', 'आर्ट लेन गॅलरी', 'generic'],
    ['Wine & Dine', 'वाइन अँड डाइन', 'bar'], ['Peacock Kitchen', 'पीकॉक किचन', 'food'], ['Germane Bakery', 'जर्मेन बेकरी', 'bakery', 'brand'],
    ['Blue Toucan Coffee', 'ब्लू टूकन कॉफी', 'cafe', 'brand'], ['Effin Hops', 'एफिन हॉप्स', 'bar', 'brand'],
  ],
  station: [
    ['Hotel Neelam Lodging', 'हॉटेल नीलम लॉजिंग', 'hotel'], ['Hotel Sangam Lodge', 'हॉटेल संगम लॉज', 'hotel'], ['Prasanna Travels', 'प्रसन्न ट्रॅव्हल्स', 'travel'],
    ['Konkan Tours', 'कोकण टूर्स', 'travel'], ['Station Mobile Point', 'स्टेशन मोबाईल पॉइंट', 'mobile'], ['Hotel Annapurna', 'हॉटेल अन्नपूर्णा', 'food'],
    ['Luggage House', 'लगेज हाउस', 'generic'], ['Shivneri Restaurant', 'शिवनेरी रेस्टॉरंट', 'food'], ['24x7 Medical', '२४ तास मेडिकल', 'pharmacy'],
    ['Express Chai', 'एक्सप्रेस चहा', 'cafe'], ['HDCF Bank', 'एचडीसीएफ बँक', 'bank'], ['Rashtriya State Bank', 'राष्ट्रीय स्टेट बँक', 'bank'],
    ['KFG Chicken', 'केएफजी चिकन', 'food', 'brand'],
  ],
  residential: [
    ['Om Sai Medical', 'ओम साई मेडिकल', 'pharmacy'], ['Laxmi Kirana Stores', 'लक्ष्मी किराणा स्टोअर्स', 'grocery', 'trad'], ['Smile Dental Clinic', 'स्माईल डेंटल क्लिनिक', 'clinic'],
    ['Fresh Laundry', 'फ्रेश लाँड्री', 'generic'], ['Amrut Milk Parlour', 'अमृत मिल्क पार्लर', 'grocery'], ['Style Cut Salon', 'स्टाईल कट सलून', 'salon'],
    ['Gokul Dairy', 'गोकुळ डेअरी', 'grocery', 'trad'], ['Ajinkya Stationery', 'अजिंक्य स्टेशनरी', 'books'], ['Kalyani Hardware', 'कल्याणी हार्डवेअर', 'hardware'],
    ['Pooja Fruits', 'पूजा फ्रुट्स', 'grocery', 'trad'], ['Jiyo Store', 'जियो स्टोअर', 'mobile', 'brand'], ['Kotaq Bank', 'कोटक बँक', 'bank'],
  ],
  riverside: [
    ['Ganga Flowers', 'गंगा फुले', 'generic', 'trad'], ['Riverside Chai', 'रिव्हरसाइड चहा', 'cafe'], ['Omkar Puja Sahitya', 'ओंकार पूजा साहित्य', 'generic', 'trad'],
    ['Sangam Snacks', 'संगम स्नॅक्स', 'food'],
  ],
};
const DIST_POOL = ['deccan', 'peth', 'camp', 'kp', 'station', 'residential', 'riverside'];
const ADS = [
  ['Swapnatla Ghar', 'स्वप्नातलं घर', '2 & 3 BHK • Sahyadri Heights • Possession 2027', 0],
  ['Gurukul Academy', 'गुरुकुल अकॅडमी', 'MPSC • UPSC 2027 batch — admissions open', 1],
  ['Laxmi Silk', 'लक्ष्मी सिल्क', 'Wedding Sarees • Paithani • Since 1962', 2],
  ['Chakka Masale', 'चक्का मसाले', 'चवीला पुणेरी • Kanda Lasun Masala', 3],
  ['Swoggy', 'स्वॉगी', 'Food in 15 min. Even in Pune traffic.', 4],
  ['Deccan Queen Jewellers', 'डेक्कन क्वीन ज्वेलर्स', 'Diwali offers on making charges', 5],
  ['NH48 Motors', 'एनएच४८ मोटर्स', 'New electric autos • Zero down payment', 6],
  ['Rapidoo', 'रॅपिडू', 'Bike taxi • ₹10 off your first ride', 7],
];

const CAT_STYLE = {
  cafe: ['modern', '#1f1a17', '#f3e9dc', '#c8873a'], food: ['flex', '#b3121b', '#ffe7a1', '#ffd23f'], sweets: ['flex', '#f2c230', '#5a1a0c', '#b3121b'],
  bakery: ['modern', '#f7efe2', '#5a3317', '#c8873a'], bank: ['bank', '#0f4c8a', '#ffffff', '#f2a900'], atm: ['bank', '#0f4c8a', '#ffffff', '#f2a900'],
  pharmacy: ['medical', '#ffffff', '#1e6b3a', '#1fa34a'], clinic: ['medical', '#ffffff', '#0f4c8a', '#e23a3a'], clothes: ['modern', '#111111', '#ffffff', '#e8b04a'],
  shoes: ['modern', '#ffffff', '#111111', '#d6202a'], jewellery: ['flex', '#6a1f2b', '#ffdca8', '#f2c230'], mobile: ['modern', '#0d3b66', '#ffffff', '#ffd23f'],
  books: ['flex', '#1e6b3a', '#fff6d8', '#f2c230'], hotel: ['flex', '#16324f', '#ffffff', '#f2c230'], bar: ['modern', '#0b0b0d', '#f2c230', '#8a6cf0'],
  grocery: ['flex', '#e86a1a', '#ffffff', '#1e6b3a'], hardware: ['flex', '#2b7a8c', '#ffffff', '#f2c230'], salon: ['modern', '#f5d6df', '#3a1020', '#b3125a'],
  optician: ['modern', '#ffffff', '#0f4c8a', '#0f4c8a'], electronics: ['modern', '#141f33', '#ffffff', '#33a1fd'], travel: ['flex', '#0f4c8a', '#ffffff', '#f2c230'],
  police: ['bank', '#0b3d91', '#ffffff', '#e8b923'],
  icecream: ['modern', '#fff2f5', '#b3125a', '#f28fb0'], generic: ['flex', '#f7f1e1', '#0f4c8a', '#b3121b'],
};
const FLEX_BG = [['#b3121b', '#ffe7a1'], ['#f2c230', '#2a1a0c'], ['#0f4c8a', '#ffffff'], ['#1e6b3a', '#fff6d8'], ['#ffffff', '#b3121b'],
  ['#161616', '#f2c230'], ['#e86a1a', '#ffffff'], ['#6a1f2b', '#ffdca8'], ['#f7f1e1', '#0f4c8a'], ['#2b7a8c', '#ffffff']];
const BRAND = {
  'Starbeans Coffee': ['#0b5a3a', '#ffffff', 'circle'], "McDougal's": ['#c8102e', '#ffc72c', 'arch'], 'Café Coffee Daily': ['#7b1f2b', '#ffffff', 'bean'],
  'Chitre Bandhu': ['#f4c430', '#7b1f0f', 'none'], "Domingo's Pizza": ['#0b5ea8', '#ffffff', 'tile'], 'KFG Chicken': ['#b5121b', '#ffffff', 'stripe'],
  'Batta Shoes': ['#d6202a', '#ffffff', 'none'], 'Apolo Pharmacy': ['#0f7b5f', '#ffffff', 'cross'], 'Kayaani Bakery': ['#f2ead8', '#2a2018', 'none'],
  'Germane Bakery': ['#1d3b2a', '#f6e7c1', 'none'], 'Blue Toucan Coffee': ['#13294b', '#ffffff', 'circle'], 'Effin Hops': ['#121212', '#f2b632', 'none'],
  'Jiyo Store': ['#0a2885', '#ffffff', 'circle'], 'PN Gadkari Jewellers': ['#5b0f1a', '#f2d17a', 'none'],
};

const F = {
  disp: (w, s, st = 'normal') => `${w} ${st} ${s}px "Archivo", "Inter", system-ui, sans-serif`,
  ui: (w, s) => `${w} ${s}px "Inter", system-ui, sans-serif`,
  dev: (w, s) => `${w} ${s}px "Mukta", "Nirmala UI", sans-serif`,
  devTrad: ['800 {s}px "Mukta"', '400 {s}px "Yatra One"', '400 {s}px "Rozha One"', '700 {s}px "Tiro Devanagari Marathi"'],
};
// largest font size (<= maxH) whose text fits maxW. Width grows ~linearly with size, so one
// measurement gives a close guess; the old 1 px-at-a-time loop cost up to ~100 measurements per
// line and made each chunk's sign atlas take tens of milliseconds.
function fit(ctx, text, font, maxW, maxH) {
  let s = Math.floor(maxH);
  ctx.font = font(s);
  let w = ctx.measureText(text).width;
  if (w > maxW) {
    s = Math.max(8, Math.floor(s * maxW / w));
    ctx.font = font(s);
    w = ctx.measureText(text).width;
    while (s > 8 && w > maxW) { s -= 1; ctx.font = font(s); w = ctx.measureText(text).width; }
  }
  return s;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// draw one board into ctx at (0,0) size w x h
export function drawBoard(ctx, w, h, shop, rng) {
  const [en, mr, cat, kind] = shop;
  const cs = CAT_STYLE[cat] || CAT_STYLE.generic;
  let design = kind === 'trad' ? 'flex-trad' : kind === 'brand' ? 'brand' : cs[0];
  ctx.save();
  ctx.textBaseline = 'middle';
  if (design === 'brand' && BRAND[en]) {
    const [bg, fg, logo] = BRAND[en];
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    let x0 = h * 0.18;
    if (logo !== 'none') {
      const r = h * 0.34, cx = h * 0.5, cy = h * 0.5;
      ctx.fillStyle = fg;
      if (logo === 'circle' || logo === 'bean') { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.fill(); }
      else if (logo === 'arch') { ctx.lineWidth = h * 0.12; ctx.strokeStyle = fg; ctx.beginPath(); ctx.arc(cx - r * 0.45, cy + r * 0.6, r * 0.5, Math.PI, 0); ctx.arc(cx + r * 0.45, cy + r * 0.6, r * 0.5, Math.PI, 0); ctx.stroke(); }
      else if (logo === 'cross') { ctx.fillRect(cx - r * 0.25, cy - r, r * 0.5, r * 2); ctx.fillRect(cx - r, cy - r * 0.25, r * 2, r * 0.5); }
      else if (logo === 'tile') { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); ctx.restore(); }
      else if (logo === 'stripe') { for (let k = 0; k < 3; k++) ctx.fillRect(cx - r + k * r * 0.75, cy - r, r * 0.4, r * 2); }
      x0 = h * 1.0;
    }
    ctx.fillStyle = fg;
    fit(ctx, en, (s) => F.disp(800, s), w - x0 - h * 0.2, h * 0.5);
    ctx.fillText(en, x0, h * 0.4);
    fit(ctx, mr, (s) => F.dev(700, s), w - x0 - h * 0.2, h * 0.34);
    ctx.globalAlpha = 0.85; ctx.fillText(mr, x0, h * 0.77); ctx.globalAlpha = 1;
  } else if (design === 'flex-trad' || design === 'flex') {
    const [bg, fg] = design === 'flex' ? [cs[1], cs[2]] : FLEX_BG[rng.int(0, FLEX_BG.length - 1)];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -0.2));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = shade(bg, 0.35); ctx.lineWidth = Math.max(2, h * 0.04); ctx.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
    ctx.fillStyle = fg; ctx.textAlign = 'center';
    const tpl = F.devTrad[rng.int(0, F.devTrad.length - 1)];
    const big = design === 'flex-trad' ? mr : en, small = design === 'flex-trad' ? en : mr;
    // Marathi is never smaller than English on the same board
    const bigFont = design === 'flex-trad' ? (s) => tpl.replace('{s}', s) : (s) => F.disp(800, s);
    fit(ctx, big, bigFont, w * 0.9, h * 0.56);
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowOffsetY = h * 0.02; ctx.shadowBlur = h * 0.03;
    ctx.fillText(big, w / 2, h * 0.42);
    ctx.shadowColor = 'transparent';
    fit(ctx, small, design === 'flex-trad' ? (s) => F.ui(700, s) : (s) => F.dev(700, s), w * 0.86, h * (design === 'flex-trad' ? 0.24 : 0.36));
    ctx.fillText(small, w / 2, h * 0.79);
  } else if (design === 'bank') {
    ctx.fillStyle = cs[1]; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = cs[3]; ctx.fillRect(0, h * 0.84, w, h * 0.16);
    ctx.fillStyle = cs[2]; ctx.textAlign = 'left';
    fit(ctx, en, (s) => F.disp(800, s), w * 0.62, h * 0.42);
    ctx.fillText(en, h * 0.25, h * 0.32);
    fit(ctx, mr, (s) => F.dev(700, s), w * 0.62, h * 0.4);
    ctx.fillText(mr, h * 0.25, h * 0.62);
  } else if (design === 'medical') {
    ctx.fillStyle = cs[1]; ctx.fillRect(0, 0, w, h);
    const r = h * 0.32, cx = h * 0.55, cy = h * 0.5;
    ctx.fillStyle = cs[3]; ctx.fillRect(cx - r * 0.33, cy - r, r * 0.66, r * 2); ctx.fillRect(cx - r, cy - r * 0.33, r * 2, r * 0.66);
    ctx.fillStyle = cs[2]; ctx.textAlign = 'left';
    fit(ctx, mr, (s) => F.dev(800, s), w - h * 1.3, h * 0.5);
    ctx.fillText(mr, h * 1.1, h * 0.38);
    fit(ctx, en.toUpperCase(), (s) => F.disp(700, s, 'expanded'), w - h * 1.3, h * 0.3);
    ctx.fillText(en.toUpperCase(), h * 1.1, h * 0.76);
  } else {    // modern backlit ACP
    ctx.fillStyle = cs[1]; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = cs[3]; ctx.fillRect(0, 0, h * 0.09, h);
    ctx.fillStyle = cs[2]; ctx.textAlign = 'left';
    const tracking = en.length < 14 ? 'expanded' : 'normal';
    fit(ctx, en, (s) => F.disp(750, s, tracking), w - h * 0.6, h * 0.46);
    ctx.fillText(en, h * 0.32, h * 0.38);
    fit(ctx, mr, (s) => F.dev(600, s), w - h * 0.6, h * 0.46);
    ctx.globalAlpha = 0.9; ctx.fillText(mr, h * 0.32, h * 0.76); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export async function ensureBoardFonts() {
  const tests = [F.disp(800, 32), F.disp(700, 32, 'expanded'), F.ui(700, 32), F.dev(700, 32), F.dev(800, 32), F.dev(600, 32),
    '400 32px "Yatra One"', '400 32px "Rozha One"', '700 32px "Tiro Devanagari Marathi"'];
  try { await Promise.all(tests.flatMap(t => [document.fonts.load(t, 'अआ पुणे'), document.fonts.load(t, 'Aa12₹')])); } catch (e) { /* system fallback */ }
}

export class Boards {
  constructor(quality) {
    this.res = quality.boardRes || 1;               // 1: 512x128 boards, 0.5: 256x64
    const bw = Math.round(512 * this.res), bh = Math.round(128 * this.res);
    this.bw = bw; this.bh = bh;
    const cols = 8, rows = 12;     // 4 rows of fallback boards + 8 rows of billboard ads
    const cv = document.createElement('canvas');
    cv.width = cols * bw; cv.height = rows * bh;
    const ctx = cv.getContext('2d');
    const rng = new RNG(4848);
    this.slots = {};
    let k = 0;
    const uvOf = (i) => {
      const cx = i % cols, cy = Math.floor(i / cols);
      return { u0: (cx * bw + 2) / cv.width, u1: ((cx + 1) * bw - 2) / cv.width, v0: 1 - ((cy + 1) * bh - 2) / cv.height, v1: 1 - (cy * bh + 2) / cv.height };
    };
    for (const key of DIST_POOL) {
      this.slots[key] = [];
      for (const shop of POOLS[key].slice(0, 4)) {     // fallback only: real shops come from the map
        const cx = k % cols, cy = Math.floor(k / cols);
        ctx.save(); ctx.translate(cx * bw, cy * bh);
        drawBoard(ctx, bw, bh, shop, rng);
        ctx.restore();
        this.slots[key].push(uvOf(k)); k++;
      }
    }
    // billboard ads: 4x2 board cells each, two per band of rows
    this.ads = [];
    let row = Math.ceil(k / cols);
    ADS.forEach((a, i) => {
      const cx = (i % 2) * 4, cy = row + Math.floor(i / 2) * 2;
      if (cy + 2 > rows) return;
      ctx.save(); ctx.translate(cx * bw, cy * bh);
      drawAd(ctx, bw * 4, bh * 2, a);
      ctx.restore();
      this.ads.push({ u0: (cx * bw + 2) / cv.width, u1: ((cx + 4) * bw - 2) / cv.width, v0: 1 - ((cy + 2) * bh - 2) / cv.height, v1: 1 - (cy * bh + 2) / cv.height });
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.tex = tex;
    this.canvas = cv;
  }
  generic(district, rng) {
    const pool = this.slots[DIST_POOL[district] || 'residential'];
    // a few chain boards anywhere
    if (rng.chance(0.06)) { const any = this.slots.deccan; return any[rng.int(0, any.length - 1)]; }
    return pool[rng.int(0, pool.length - 1)];
  }
  ad(k) { return this.ads[k % this.ads.length]; }
  // Per-chunk atlas of every shop board in the chunk (real places under parody names, plus the
  // invented ones for frontages no dataset knows), drawn small: past ~35 m a board is only
  // ~100 px wide on screen. Boards close to the camera are redrawn sharp by NearBoards.
  *chunkAtlas(C, shopsOf, names) {
    const list = [];
    for (const bi of C.bld) { const m = shopsOf(bi); if (m) for (const s of m.values()) list.push(s); }
    const out = { tex: null, map: new Map(), get: (s) => out.map.get(s) };
    if (!list.length) return out;
    const bw = BASE_W, bh = BASE_H, cols = 8, rows = Math.ceil(list.length / cols);
    const cv = document.createElement('canvas');
    cv.width = cols * bw; cv.height = rows * bh;
    const ctx = cv.getContext('2d');
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      const cx = k % cols, cy = Math.floor(k / cols);
      ctx.save(); ctx.translate(cx * bw, cy * bh);
      ctx.beginPath(); ctx.rect(0, 0, bw, bh); ctx.clip();
      drawBoard(ctx, bw, bh, names[s[3]] || EMPTY, boardRng(s));
      ctx.restore();
      if (k & 1) yield;
      out.map.set(s, { local: true, u0: (cx * bw + 1) / cv.width, u1: ((cx + 1) * bw - 1) / cv.width, v0: 1 - ((cy + 1) * bh - 1) / cv.height, v1: 1 - (cy * bh + 1) / cv.height });
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    tex.onUpdate = () => { cv.width = cv.height = 1; };      // the GPU copy is all we need
    out.tex = tex;
    return out;
  }
}

const BASE_W = 96, BASE_H = 24;
const EMPTY = ['', '', 'generic', ''];
// same colours/fonts for a board whether it is drawn small (chunk atlas) or sharp (NearBoards)
const boardRng = (s) => new RNG(s[0] * 7919 + s[1] * 131 + s[2] * 17 + 1);

// Sharp versions of the boards around the camera: a fixed 2048x2048 atlas of 256x64 cells that is
// filled a few boards per frame, and one small mesh of quads laid 1.5 cm in front of the blurry
// chunk-atlas boards. Memory stays fixed however dense the street is.
const NCW = 256, NCH = 64, NCOLS = 8, NROWS = 32, NCAP = NCOLS * NROWS;
export class NearBoards {
  constructor(renderer, scene, baseMat, names, radius = 36) {
    this.renderer = renderer; this.names = names; this.R = radius;
    const cv = document.createElement('canvas');
    cv.width = NCW * NCOLS; cv.height = NCH * NROWS;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    tex.onUpdate = () => { cv.width = cv.height = 1; };
    this.tex = tex;
    this.scratch = document.createElement('canvas');
    this.scratch.width = NCW; this.scratch.height = NCH;
    this.sctx = this.scratch.getContext('2d');
    this.stex = new THREE.CanvasTexture(this.scratch);
    this.stex.colorSpace = THREE.SRGBColorSpace;
    this.mat = baseMat.clone();
    this.mat.map = tex; this.mat.emissiveMap = tex;
    this.mat.polygonOffsetFactor = -2; this.mat.polygonOffsetUnits = -4;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(NCAP * 12); this.nrm = new Float32Array(NCAP * 12); this.uv = new Float32Array(NCAP * 8);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint16Array(NCAP * 6);
    for (let q = 0; q < NCAP; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.chunks = new Map();           // ci -> { cx, cz, recs }
    this.slotOf = new Map();           // rec -> slot
    this.recOf = new Array(NCAP).fill(null);
    this.lastUse = new Float64Array(NCAP);
    this.ready = false; this.t = 0; this.dirty = false; this.want = [];
  }
  addChunk(ci, cx, cz, recs) { if (recs.length) this.chunks.set(ci, { cx, cz, recs }); }
  dropChunk(ci) {
    const c = this.chunks.get(ci);
    if (!c) return;
    for (const r of c.recs) { const sl = this.slotOf.get(r); if (sl !== undefined) { this.slotOf.delete(r); this.recOf[sl] = null; } }
    this.chunks.delete(ci); this.dirty = true;
  }
  update(x, z, dt) {
    if (!this.ready) { this.renderer.initTexture(this.tex); this.ready = true; }
    this.t += dt;
    const now = performance.now();
    if (this.t > 0.2) {                // re-pick the boards that deserve to be sharp
      this.t = 0;
      const R = this.R, R2 = R * R, list = [];
      for (const c of this.chunks.values()) {
        if (Math.abs(c.cx - x) > R + 150 || Math.abs(c.cz - z) > R + 150) continue;
        for (const r of c.recs) { const d = (r.mx - x) ** 2 + (r.mz - z) ** 2; if (d < R2) list.push([d, r]); }
      }
      list.sort((a, b) => a[0] - b[0]);
      this.want = list.slice(0, NCAP - 16).map(e => e[1]);
      for (const r of this.want) { const sl = this.slotOf.get(r); if (sl !== undefined) this.lastUse[sl] = now; }
      this.dirty = true;
    }
    // draw up to 2 missing boards per frame, nearest first
    let drawn = 0;
    for (const r of this.want) {
      if (drawn >= 2) break;
      if (this.slotOf.has(r)) continue;
      let sl = this.recOf.indexOf(null);
      if (sl < 0) { let best = Infinity; for (let i = 0; i < NCAP; i++) if (this.lastUse[i] < best) { best = this.lastUse[i]; sl = i; } this.slotOf.delete(this.recOf[sl]); }
      const ctx = this.sctx;
      ctx.clearRect(0, 0, NCW, NCH);
      drawBoard(ctx, NCW, NCH, this.names[r.s[3]] || EMPTY, boardRng(r.s));
      const cx = sl % NCOLS, cy = Math.floor(sl / NCOLS);
      this.renderer.copyTextureToTexture(this.stex, this.tex, null, new THREE.Vector2(cx * NCW, cy * NCH));
      this.recOf[sl] = r; this.slotOf.set(r, sl); this.lastUse[sl] = now;
      drawn++; this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    let q = 0;
    const W = NCW * NCOLS, H = NCH * NROWS, o = 0.015;
    for (const r of this.want) {
      const sl = this.slotOf.get(r);
      if (sl === undefined) continue;
      const cx = sl % NCOLS, cy = Math.floor(sl / NCOLS);
      const u0 = (cx * NCW + 1.5) / W, u1 = ((cx + 1) * NCW - 1.5) / W;
      const v0 = (cy * NCH + 1.5) / H, v1 = ((cy + 1) * NCH - 1.5) / H;
      const ua = r.ltr ? u0 : u1, ub = r.ltr ? u1 : u0;
      const ox = r.nx * o, oz = r.nz * o;
      this.pos.set([r.x0 + ox, r.y0, r.z0 + oz, r.x1 + ox, r.y0, r.z1 + oz, r.x1 + ox, r.y1, r.z1 + oz, r.x0 + ox, r.y1, r.z0 + oz], q * 12);
      for (let k = 0; k < 4; k++) this.nrm.set([r.nx, 0, r.nz], q * 12 + k * 3);
      this.uv.set([ua, v0, ub, v0, ub, v1, ua, v1], q * 8);
      q++;
    }
    const g = this.geo;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.uv.needsUpdate = true;
    g.setDrawRange(0, q * 6);
  }
}

function drawAd(ctx, w, h, a) {
  const [en, mr, sub, k] = a;
  const pal = [['#0d3b66', '#faf0ca', '#f4d35e'], ['#1b1b1e', '#ffffff', '#ff6b35'], ['#7b1f2b', '#fff3e0', '#f2c230'], ['#f4a259', '#1b1b1e', '#bc4b51'],
    ['#fc8019', '#ffffff', '#3d0c02'], ['#2a1b3d', '#f8e9a1', '#d4af37'], ['#0b6e4f', '#ffffff', '#f2c230'], ['#f7b801', '#111111', '#111111']][k % 8];
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, pal[0]); g.addColorStop(1, shade(pal[0], -0.3));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.arc(w * 0.86, h * 0.5, h * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal[1]; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  fit(ctx, mr, (s) => F.dev(800, s), w * 0.66, h * 0.32); ctx.fillText(mr, w * 0.05, h * 0.27);
  fit(ctx, en, (s) => F.disp(800, s, 'expanded'), w * 0.66, h * 0.24); ctx.fillText(en, w * 0.05, h * 0.55);
  fit(ctx, sub, (s) => F.ui(600, s), w * 0.7, h * 0.12); ctx.globalAlpha = 0.9; ctx.fillText(sub, w * 0.05, h * 0.8);
  ctx.restore();
}
