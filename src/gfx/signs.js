// Sign atlas: shop boards, Puneri patya, flex banners, billboards, street name boards, number plates.
// All names are fictional; the patya lines are the well-known Pune shop-sign genre.
import * as THREE from 'three';
import { RNG } from '../core/util.js';

export const SHOP_NAMES = [
  ['श्री गणेश स्वीट्स', 'Sweets & Farsan'], ['सागर अमृततुल्य', 'Special Chaha'], ['जय भवानी अमृततुल्य', 'Chaha • Coffee'],
  ['श्री साई मेडिकल', 'Medical & General Stores'], ['ओम किराणा भांडार', 'Kirana • Grains • Oil'], ['कल्पना मिसळ हाऊस', 'Puneri Misal • Pav Bhaji'],
  ['आई तुळजाभवानी वडापाव', 'Vadapav • Bhaji'], ['मोरया इलेक्ट्रिकल्स', 'Fans • Lights • Repairs'], ['स्वामी समर्थ ज्वेलर्स', 'Gold & Silver'],
  ['शिवराज मोबाईल शॉपी', 'Mobiles • Recharge • Covers'], ['मंगलमूर्ती साडी सेंटर', 'Paithani • Silk • Cotton'], ['विठ्ठल रखुमाई भोजनालय', 'Shuddha Shakahari Thali'],
  ['देशपांडे क्लासेस', 'SSC • HSC • JEE'], ['राजमुद्रा टेलर्स', 'Gents & Ladies Tailor'], ['गुरुकृपा झेरॉक्स', 'Xerox • Print • Lamination'],
  ['सह्याद्री बेकरी', 'Fresh Bread • Toast • Khari'], ['आनंद पुस्तकालय', 'Books • Stationery'], ['श्रीराम हार्डवेअर', 'Hardware & Paints'],
  ['माऊली फूल भांडार', 'Flowers • Haar • Gajra'], ['चैतन्य पराठा हाऊस', 'Paratha • Lassi'], ['अन्नपूर्णा मेस', 'Lunch • Dinner • Tiffin'],
  ['यशवंत ऑप्टिकल्स', 'Spectacles • Eye Test'], ['कोकण मेवा', 'Kokum • Amba Poli • Cashew'], ['पुणेरी पान', 'Meetha Pan • Masala'],
];
export const SHOP_EN = [
  ['Hotel Shabari', 'Pure Veg Restaurant'], ['Deccan Opticians', 'Since 1978'], ['New Bombay Tailors', 'Suits • Shirts • Alterations'],
  ['Kumar Footwear', 'Kolhapuri • Sports • Formal'], ['Pathfinder Classes', 'MPSC • UPSC • Banking'], ['Prime Mobile Gallery', 'Smartphones • Accessories'],
  ['Joshi Medicals', '24 Hours'], ['Fergusson Xerox Centre', 'Print • Bind • Scan'], ['Royal Dry Cleaners', 'Laundry • Dry Clean'],
  ['Shiv Sagar Juice Centre', 'Fresh Juice • Milkshakes'], ['Annapurna Mess', 'Unlimited Thali ₹140'], ['Puneri Misal Corner', 'Tari • Rassa • Pav'],
  ['Spice Route Cafe', 'Chai • Snacks • Wi-Fi'], ['Bake n Shake', 'Cakes • Pastries'], ['Deccan Cyber Point', 'Online Forms • Printing'],
  ['Om Sai Travels', 'Bus • Car Rental • Tickets'], ['Saraswati Stationery', 'Books • Art Supplies'], ['Gandharva Music House', 'Harmonium • Tabla • Guitar'],
  ['Kulkarni Dental Clinic', 'Dr. A. Kulkarni BDS'], ['Vrindavan Sweets', 'Pedha • Barfi • Shrikhand'], ['Laxmi Hardware', 'Tools • Pipes • Paint'],
  ['Maratha Chicken Centre', 'Fresh Chicken • Mutton'], ['Hotel Vaibhav', 'Family Restaurant'], ['Om Opticals', 'Eye Wear'],
];
export const PATYA = [
  ['आमची कुठेही', 'शाखा नाही.'],
  ['बेल एकदाच वाजवावी.', 'आम्ही बहिरे नाही.'],
  ['दुपारी १ ते ४', 'दुकान बंद राहील.'],
  ['येथे गाडी लावू नये.', 'हवा सोडण्यात येईल.'],
  ['उधारी मागू नये.', 'अपमान होईल.'],
  ['पत्ता विचारू नये.', 'आम्हालाही माहीत नाही.'],
  ['सुट्टे पैसे', 'आणावेत.'],
  ['गेटसमोर गाडी लावल्यास', 'टायर पंक्चर केले जाईल.'],
  ['कुत्र्यापासून', 'सावधान!'],
  ['येथे थुंकू नये.', 'आज्ञेवरून'],
  ['मोबाईलवर बोलत', 'आत येऊ नये.'],
  ['कृपया शांतता राखा.', 'परीक्षा चालू आहे.'],
  ['येथे सल्ला', 'मोफत मिळत नाही.'],
  ['घंटी वाजवून', 'पळून जाऊ नये.'],
  ['गेट उघडे दिसल्यास', 'बंद करण्याची तसदी घ्यावी.'],
  ['वाद घालायचा असल्यास', 'आधी वेळ ठरवावी.'],
  ['भिंतीवर जाहिरात लावणाऱ्याचे', 'नाव फोटोसह छापले जाईल.'],
  ['येथे क्रिकेट खेळू नये.', 'काच फुटल्यास भरपाई.'],
  ['कृपया हॉर्न वाजवू नये.', 'आम्हाला ऐकू येते.'],
  ['लिफ्ट बंद आहे.', 'जिने चढा, तब्येत सुधारा.'],
  ['चपला बाहेर काढाव्यात.', 'जबाबदारी आमची नाही.'],
];
export const BANNERS = [
  ['भाऊंना', 'वाढदिवसाच्या हार्दिक शुभेच्छा!', 0],
  ['दसऱ्याच्या', 'हार्दिक शुभेच्छा', 1],
  ['शुभ दीपावली', 'सर्व पुणेकरांना', 2],
  ['नवरात्रोत्सव २०२६', 'नवचैतन्य मित्र मंडळ', 1],
  ['आमदार चषक', 'टेनिस बॉल क्रिकेट स्पर्धा', 3],
  ['स्वच्छ पुणे', 'सुंदर पुणे', 4],
  ['वाहतुकीचे नियम पाळा', 'हेल्मेट वापरा • सिग्नल पाळा', 5],
  ['दादांना', 'वाढदिवसाच्या हार्दिक शुभेच्छा!', 0],
];
export const ADS = [
  ['स्वप्नातलं घर', '2 & 3 BHK • Sahyadri Heights • Possession 2027', 0],
  ['Gurukul Academy', 'MPSC • UPSC 2027 batch, admissions open', 1],
  ['लक्ष्मी सिल्क', 'Wedding Sarees • Paithani • Since 1962', 2],
  ['Chakka Masale', 'चवीला पुणेरी • Kanda Lasun Masala', 3],
  ['Vahini Chai', 'Pune cha chaha. Kadak.', 4],
  ['Deccan Queen Jewellers', 'Diwali offers on gold making charges', 5],
  ['Sinhagad Trek Club', 'Weekend treks • Rajgad • Torna', 6],
  ['FC Road Food Fest', 'Misal • Vadapav • Mastani • This Sunday', 7],
];
export const STREETS = [
  ['फर्ग्युसन कॉलेज रस्ता', 'F. C. Road'], ['जंगली महाराज रस्ता', 'J. M. Road'], ['कर्वे रस्ता', 'Karve Road'],
  ['प्रभात रस्ता', 'Prabhat Road'], ['भांडारकर रस्ता', 'Bhandarkar Road'], ['घोले रस्ता', 'Ghole Road'],
  ['आपटे रस्ता', 'Apte Road'], ['टिळक रस्ता', 'Tilak Road'], ['लक्ष्मी रस्ता', 'Laxmi Road'],
  ['गणेशखिंड रस्ता', 'Ganeshkhind Road'], ['डेक्कन जिमखाना', 'Deccan Gymkhana'], ['शिवाजीनगर', 'Shivajinagar'],
  ['संभाजी पूल', 'Lakdi Pul'], ['बालगंधर्व', 'Balgandharva'], ['गुडलक चौक', 'Goodluck Chowk'], ['ज्ञानेश्वर पादुका चौक', 'Paduka Chowk'],
];

const SIGN_BG = [
  ['#B3121B', '#FFE7A1'], ['#F2C230', '#2A1A0C'], ['#0F4C8A', '#FFFFFF'], ['#1E6B3A', '#FFF6D8'], ['#FFFFFF', '#B3121B'],
  ['#161616', '#F2C230'], ['#E86A1A', '#FFFFFF'], ['#6A1F2B', '#FFDCA8'], ['#F7F1E1', '#0F4C8A'], ['#2B7A8C', '#FFFFFF'],
];
const DEV_FONTS = ['800 {s}px "Mukta"', '400 {s}px "Yatra One"', '400 {s}px "Rozha One"'];
const LAT_FONTS = ['800 {s}px "Mukta"', '400 {s}px "Rozha One"', '600 {s}px "Teko"'];
const f = (tpl, s) => tpl.replace('{s}', s);

function fitText(ctx, text, fontTpl, maxW, maxH) {
  let s = maxH;
  ctx.font = f(fontTpl, s);
  let w = ctx.measureText(text).width;
  if (w > maxW) {
    s = Math.max(8, Math.floor(s * maxW / w));
    ctx.font = f(fontTpl, s);
    w = ctx.measureText(text).width;
    while (s > 8 && w > maxW) { s -= 2; ctx.font = f(fontTpl, s); w = ctx.measureText(text).width; }
  }
  return s;
}

class Packer {
  constructor(W, H) { this.W = W; this.H = H; this.x = 0; this.y = 0; this.rowH = 0; }
  alloc(w, h) {
    if (this.x + w > this.W) { this.x = 0; this.y += this.rowH + 2; this.rowH = 0; }
    if (this.y + h > this.H) return null;
    const r = [this.x, this.y, w, h];
    this.x += w + 2; this.rowH = Math.max(this.rowH, h);
    return r;
  }
}

export async function ensureFonts() {
  const tests = ['800 32px "Mukta"', '600 32px "Mukta"', '400 32px "Rozha One"', '400 32px "Yatra One"', '600 32px "Teko"'];
  try {
    await Promise.all(tests.flatMap(t => [document.fonts.load(t, 'अआ पुणे'), document.fonts.load(t, 'Aa12₹')]));
  } catch (e) { /* fall back to system fonts */ }
}

export function makeSignAtlas(scale = 1) {
  const W = 4096 * scale, H = 2048 * scale;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.scale(scale, scale);
  const pk = new Packer(4096, 2048);
  const rng = new RNG(2026);
  const out = { shops: [], patya: [], banners: [], ads: [], streets: [], plates: [], plateWhite: [], bus: [], metro: null };
  const uv = (r) => ({ u0: r[0] / 4096, v0: 1 - (r[1] + r[3]) / 2048, u1: (r[0] + r[2]) / 4096, v1: 1 - r[1] / 2048, w: r[2], h: r[3] });

  // --- shop boards 448x112 (4:1)
  const shops = [...SHOP_NAMES.map(s => [...s, 'mr']), ...SHOP_EN.map(s => [...s, 'en'])];
  for (let i = 0; i < shops.length; i++) {
    const [name, sub, lang] = shops[i];
    const r = pk.alloc(448, 112); if (!r) break;
    const [bg, fg] = SIGN_BG[i % SIGN_BG.length];
    x.save(); x.translate(r[0], r[1]);
    const g = x.createLinearGradient(0, 0, 0, 112);
    g.addColorStop(0, bg); g.addColorStop(1, shade(bg, -0.18));
    x.fillStyle = g; x.fillRect(0, 0, 448, 112);
    x.strokeStyle = fg; x.globalAlpha = 0.5; x.lineWidth = 3; x.strokeRect(5, 5, 438, 102); x.globalAlpha = 1;
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    const ft = lang === 'mr' ? DEV_FONTS[i % 3] : LAT_FONTS[i % 2];
    fitText(x, name, ft, 410, 62);
    x.fillText(name, 224, 46);
    x.font = '600 20px "Mukta"';
    let s2 = 20; while (s2 > 9 && x.measureText(sub).width > 400) { s2--; x.font = `600 ${s2}px "Mukta"`; }
    x.fillText(sub, 224, 91);
    // phone strip
    x.globalAlpha = 0.85; x.font = '600 14px "Teko"'; x.textAlign = 'right';
    x.fillText('☎ 020-25' + rng.int(10, 99) + ' ' + rng.int(1000, 9999), 436, 16);
    x.globalAlpha = 1;
    // weathering
    dirty(x, 448, 112, rng, 0.18);
    x.restore();
    out.shops.push(uv(r));
  }
  // --- puneri patya 256x128 (white board, red/black text)
  for (let i = 0; i < PATYA.length; i++) {
    const r = pk.alloc(256, 128); if (!r) break;
    x.save(); x.translate(r[0], r[1]);
    x.fillStyle = '#F6F3EA'; x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#9B1C1C'; x.lineWidth = 4; x.strokeRect(6, 6, 244, 116);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#9B1C1C';
    fitText(x, PATYA[i][0], '800 {s}px "Mukta"', 226, 36); x.fillText(PATYA[i][0], 128, 46);
    x.fillStyle = '#1A1A1A';
    fitText(x, PATYA[i][1], '800 {s}px "Mukta"', 226, 32); x.fillText(PATYA[i][1], 128, 86);
    dirty(x, 256, 128, rng, 0.12);
    x.restore();
    out.patya.push(uv(r));
  }
  // --- street name boards 512x128 (blue, white text)
  for (let i = 0; i < STREETS.length; i++) {
    const r = pk.alloc(512, 128); if (!r) break;
    x.save(); x.translate(r[0], r[1]);
    x.fillStyle = '#1D4F91'; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = '#FFFFFF'; x.lineWidth = 4; x.strokeRect(7, 7, 498, 114);
    x.fillStyle = '#FFFFFF'; x.textAlign = 'center'; x.textBaseline = 'middle';
    fitText(x, STREETS[i][0], '800 {s}px "Mukta"', 470, 48); x.fillText(STREETS[i][0], 256, 48);
    fitText(x, STREETS[i][1], '600 {s}px "Mukta"', 470, 34); x.fillText(STREETS[i][1], 256, 96);
    x.restore();
    out.streets.push(uv(r));
  }
  // --- number plates 160x40 : MH 12 XX 1234 (yellow commercial, white private)
  for (let i = 0; i < 48; i++) {
    const r = pk.alloc(160, 40); if (!r) break;
    const yellow = i < 24;
    x.save(); x.translate(r[0], r[1]);
    x.fillStyle = yellow ? '#F2C80F' : '#F4F4F0'; x.fillRect(0, 0, 160, 40);
    x.strokeStyle = '#111'; x.lineWidth = 2; x.strokeRect(2, 2, 156, 36);
    x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    const txt = `MH 12 ${L[rng.int(0, L.length - 1)]}${L[rng.int(0, L.length - 1)]} ${rng.int(1000, 9999)}`;
    fitText(x, txt, '600 {s}px "Teko"', 150, 36); x.fillText(txt, 80, 23);
    x.restore();
    (yellow ? out.plates : out.plateWhite).push(uv(r));
  }
  pk.x = 0; pk.y += pk.rowH + 4; pk.rowH = 0;
  // --- flex banners 640x192
  for (let i = 0; i < BANNERS.length; i++) {
    const r = pk.alloc(640, 192); if (!r) break;
    const [a, b, kind] = BANNERS[i];
    x.save(); x.translate(r[0], r[1]);
    const pal = [['#FF6A00', '#B3121B'], ['#F2C230', '#E8501E'], ['#3B0A57', '#E2156B'], ['#0B6E4F', '#F2C230'], ['#0E7C3A', '#2E86C1'], ['#1D4F91', '#E8E8E8']][kind];
    const g = x.createLinearGradient(0, 0, 640, 192); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);
    x.fillStyle = g; x.fillRect(0, 0, 640, 192);
    // radiating rays (classic flex look)
    x.globalAlpha = 0.12; x.fillStyle = '#fff';
    for (let k = 0; k < 18; k++) { x.beginPath(); x.moveTo(110, 96); x.arc(110, 96, 700, k * 0.35, k * 0.35 + 0.15); x.fill(); }
    x.globalAlpha = 1;
    if (kind === 0) {
      // generic leader silhouette (not a real person) with garland
      x.fillStyle = '#F7F1E8'; x.beginPath(); x.arc(110, 80, 46, 0, 6.28); x.fill();
      x.fillStyle = '#2B2B2B'; x.beginPath(); x.arc(110, 64, 34, Math.PI, 0); x.fill();
      x.fillStyle = '#FFFFFF'; x.fillRect(58, 120, 104, 72);
      x.strokeStyle = '#F29C11'; x.lineWidth = 9; x.beginPath(); x.arc(110, 126, 40, 0.2, Math.PI - 0.2); x.stroke();
    } else if (kind === 2) {
      // akash kandil + diya
      x.fillStyle = '#FFD24A'; star(x, 110, 90, 54, 26, 8); x.fill();
      x.fillStyle = '#C0392B'; star(x, 110, 90, 32, 16, 8); x.fill();
    } else if (kind === 3) {
      x.fillStyle = '#fff'; x.beginPath(); x.arc(110, 96, 50, 0, 6.28); x.fill();
      x.strokeStyle = '#C0392B'; x.lineWidth = 4; x.beginPath(); x.arc(110, 96, 50, -0.8, 0.8); x.stroke(); x.beginPath(); x.arc(110, 96, 50, 2.3, 3.9); x.stroke();
    } else {
      x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(110, 96, 58, 0, 6.28); x.fill();
      x.fillStyle = pal[1]; x.font = '400 64px "Rozha One"'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(kind === 1 ? 'ॐ' : kind === 4 ? '♻' : '⚠', 110, 100);
    }
    x.fillStyle = '#FFFFFF'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
    fitText(x, a, '400 {s}px "Rozha One"', 420, 74); x.fillText(a, 410, 70);
    x.fillStyle = '#FFF2B0';
    fitText(x, b, '800 {s}px "Mukta"', 440, 44); x.fillText(b, 410, 142);
    x.shadowColor = 'transparent';
    dirty(x, 640, 192, rng, 0.1);
    x.restore();
    out.banners.push(uv(r));
  }
  // --- billboards 768x384
  for (let i = 0; i < ADS.length; i++) {
    const r = pk.alloc(768, 384); if (!r) break;
    const [a, b, kind] = ADS[i];
    x.save(); x.translate(r[0], r[1]);
    const pals = [['#0B3954', '#E0FF4F'], ['#8B1E3F', '#F4D35E'], ['#5B2A86', '#F7B32B'], ['#B33F00', '#FFE8C2'], ['#0F5132', '#F2E9CF'], ['#1B1B1B', '#E7C873'], ['#2E5E4E', '#F0E6D2'], ['#C1121F', '#FFF3D6']];
    const [bg, fg] = pals[kind];
    const g = x.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, shade(bg, 0.12)); g.addColorStop(1, shade(bg, -0.2));
    x.fillStyle = g; x.fillRect(0, 0, 768, 384);
    // abstract product art
    x.globalAlpha = 0.9;
    if (kind === 0) { // building
      x.fillStyle = '#F2EFE6';
      for (let k = 0; k < 3; k++) x.fillRect(470 + k * 90, 120 - k * 30, 80, 264 + k * 30);
      x.fillStyle = '#8FB8DE';
      for (let k = 0; k < 3; k++) for (let j = 0; j < 9; j++) x.fillRect(482 + k * 90, 140 - k * 30 + j * 26, 56, 14);
    } else if (kind === 4 || kind === 7) { // cup / plate
      x.fillStyle = '#F5F5F0'; x.beginPath(); x.ellipse(600, 240, 110, 36, 0, 0, 6.28); x.fill();
      x.fillStyle = '#C47A2C'; x.beginPath(); x.ellipse(600, 222, 80, 24, 0, 0, 6.28); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 6;
      for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(570 + k * 30, 180); x.bezierCurveTo(550 + k * 30, 140, 600 + k * 30, 120, 580 + k * 30, 80); x.stroke(); }
    } else if (kind === 6) { // fort hills
      x.fillStyle = '#3E6B48'; x.beginPath(); x.moveTo(420, 384); x.lineTo(560, 170); x.lineTo(640, 230); x.lineTo(720, 140); x.lineTo(768, 200); x.lineTo(768, 384); x.fill();
      x.fillStyle = '#C9A66B'; x.fillRect(690, 150, 40, 30);
    } else { // jewellery / silk drape
      x.fillStyle = fg; x.beginPath(); x.arc(600, 200, 110, 0, 6.28); x.fill();
      x.fillStyle = bg; x.beginPath(); x.arc(600, 200, 70, 0, 6.28); x.fill();
    }
    x.globalAlpha = 1;
    x.fillStyle = fg; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    const isDev = /[ऀ-ॿ]/.test(a);
    fitText(x, a, isDev ? '400 {s}px "Rozha One"' : '800 {s}px "Mukta"', 440, 92);
    x.fillText(a, 34, 150);
    x.fillStyle = '#FFFFFF';
    const words = b.split(' ');
    let line = '', ly = 220;
    x.font = '600 30px "Mukta"';
    for (const w of words) {
      if (x.measureText(line + w).width > 420) { x.fillText(line, 36, ly); ly += 38; line = ''; }
      line += w + ' ';
    }
    x.fillText(line, 36, ly);
    dirty(x, 768, 384, rng, 0.14);
    x.restore();
    out.ads.push(uv(r));
  }
  // --- PMPML-ish bus stop panel & metro station board
  {
    const r = pk.alloc(512, 128);
    x.save(); x.translate(r[0], r[1]);
    x.fillStyle = '#2E7D32'; x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 54px "Mukta"'; x.fillText('बस थांबा', 256, 52);
    x.font = '600 30px "Mukta"'; x.fillText('BUS STOP', 256, 102);
    x.restore(); out.bus.push(uv(r));
  }
  {
    const r = pk.alloc(768, 128);
    x.save(); x.translate(r[0], r[1]);
    x.fillStyle = '#F4F4F4'; x.fillRect(0, 0, 768, 128);
    x.fillStyle = '#1E9AD6'; x.fillRect(0, 100, 768, 28);
    x.fillStyle = '#0D2C54'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 46px "Mukta"'; x.fillText('पुणे मेट्रो  •  PUNE METRO', 384, 54);
    x.restore(); out.metro = uv(r);
  }
  {
    // rear-canvas sticker on autos: "Aai tujha aashirvaad" (Mother, your blessing)
    const r = pk.alloc(512, 104);
    x.save(); x.translate(r[0], r[1]);
    x.fillStyle = '#0c0b0a'; x.fillRect(0, 0, 512, 104);
    x.fillStyle = '#F2C230'; x.textAlign = 'center'; x.textBaseline = 'middle';
    fitText(x, 'आई तुझा आशीर्वाद', '400 {s}px "Yatra One"', 470, 70); x.fillText('आई तुझा आशीर्वाद', 256, 54);
    x.restore(); out.sticker = uv(r);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;              // clamped to what the GPU supports; keeps signs readable at an angle
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  out.tex = tex;
  out.canvas = c;
  return out;
}

function star(x, cx, cy, R, r, n) {
  x.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const a = k * Math.PI / n - Math.PI / 2, rr = k % 2 ? r : R;
    k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = k < 0 ? 0 : 255, p = Math.abs(k);
  r = Math.round((t - r) * p) + r; g = Math.round((t - g) * p) + g; b = Math.round((t - b) * p) + b;
  return `rgb(${r},${g},${b})`;
}

function dirty(x, w, h, rng, amt) {
  // dust & sun-fade so boards don't look freshly printed
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(255,250,235,${amt * 0.6})`); g.addColorStop(1, `rgba(60,50,40,${amt})`);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 6; k++) {
    x.fillStyle = `rgba(40,30,20,${amt * 0.6})`;
    x.fillRect(rng.range(0, w), 0, rng.range(1, 3), h * rng.range(0.3, 1));
  }
}
