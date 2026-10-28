// Puneri patya: the city's famous passive-aggressive signboards. Twenty-four of them hang beside shop
// doors all over Pune (the same board turns up in more than one lane, as they do). Walk up to one to read
// it; find all twenty-four and you're an asal Punekar.
import * as THREE from 'three';

export const PATYA = [
  ['दुपारी १ ते ४ बेल वाजवू नये.', 'Do not ring the bell between 1 and 4. Obviously.'],
  ['येथे गाडी लावल्यास हवा सोडली जाईल.', 'Park here and we let the air out. Both tyres.'],
  ['पत्ता विचारू नये. आम्हालाही माहीत नाही.', 'Do not ask for directions. We do not know either.'],
  ['सुट्टे पैसे नाहीत. विचारू नये.', 'No change. Asking will not make change appear.'],
  ['उधारी बंद. कायमची.', 'Credit stopped. Permanently.'],
  ['सल्ला फुकट मिळेल, सामान नाही.', 'Advice is free. Goods are not.'],
  ['येथे थुंकल्यास फोटो फेसबुकवर टाकला जाईल.', 'Spit here and your photo goes on Facebook.'],
  ['दुकान वेळेवर उघडेल. वेळ आमची.', 'We open on time. Our time.'],
  ['कृपया शांतता राखा. येथे पुणेकर राहतात.', 'Please keep quiet. Punekars live here.'],
  ['फोनवर बोलत आत येऊ नये. आधी ते संपवा.', 'Do not walk in on the phone. Finish that first.'],
  ['विकलेला माल परत घेतला जाणार नाही.', 'Goods once sold will not be taken back. Or discussed.'],
  ['येथे भांडण फक्त मराठीत होईल.', 'Arguments here in Marathi only.'],
  ['नो पार्किंग. म्हणजे नो पार्किंग.', 'No parking. That means no parking.'],
  ['पाणी मागू नये. हे हॉटेल नाही.', 'Do not ask for water. This is not a hotel.'],
  ['दार ढकलू नये, ओढावे. सूचना वाचाव्यात.', 'Pull, do not push. Learn to read signs.'],
  ['आमची कोठेही शाखा नाही.', 'We have no branches anywhere. Anywhere.'],
  ['भाव करू नये. ही मंडई नाही.', 'Do not bargain. This is not the mandai.'],
  ['कुत्र्यापासून सावध. मालकापासून जास्त.', 'Beware of the dog. Beware of the owner more.'],
  ['कचरा टाकणाऱ्याचे नाव या फलकावर लिहिले जाईल.', 'Litter here and your name goes on this board.'],
  ['रविवारी दुकान बंद. का, ते विचारू नये.', 'Closed on Sundays. Do not ask why.'],
  ['रांगेत या. पुण्यात रांग पवित्र आहे.', 'Join the queue. In Pune the queue is sacred.'],
  ['वाय-फाय नाही. एकमेकांशी बोला.', 'No Wi-Fi. Talk to each other.'],
  ['गेटसमोर गाडी लावल्यास गाडी आमची.', 'Park at the gate and the vehicle is ours.'],
  ['इथे फक्त चहा. कॉफी आहे का, विचारू नये.', 'Only chai here. Do not ask for coffee.'],
];
const EVERY = 13;               // about one shop door in this many carries a patya
const hash = (n) => { let h = (n | 0) * 2654435761; h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return h >>> 0; };

export class Patya {
  constructor(G) {
    this.g = G; this.boards = new Map(); this.t = 0;
    this.geo = new THREE.PlaneGeometry(1.25, 0.78);
    this.mats = [];
  }
  get found() { const s = this.g.life.s; return s.patya || (s.patya = []); }
  mat(i) {
    if (this.mats[i]) return this.mats[i];
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320;
    const x = cv.getContext('2d'), [mr, en] = PATYA[i];
    x.fillStyle = i % 3 === 0 ? '#fff6d8' : '#f8f6ef'; x.fillRect(0, 0, 512, 320);
    x.strokeStyle = '#a3161a'; x.lineWidth = 12; x.strokeRect(14, 14, 484, 292);
    x.fillStyle = '#a3161a'; x.textAlign = 'center'; x.textBaseline = 'middle';
    // Marathi, wrapped onto two lines if it is long
    const words = mr.split(' '); let l1 = mr, l2 = '';
    x.font = '800 46px Mukta, sans-serif';
    if (x.measureText(mr).width > 440) { const h = Math.ceil(words.length / 2); l1 = words.slice(0, h).join(' '); l2 = words.slice(h).join(' '); }
    if (l2) { x.fillText(l1, 256, 105); x.fillText(l2, 256, 162); } else x.fillText(l1, 256, 130);
    x.fillStyle = '#1b1b1b'; x.font = '600 21px Inter, sans-serif';
    x.fillText(en.length > 46 ? en.slice(0, 44) + '...' : en, 256, 236);
    x.fillStyle = '#7a7a7a'; x.font = '600 15px Inter, sans-serif'; x.fillText('- व्यवस्थापन', 400, 276);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return (this.mats[i] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 }));
  }
  update(dt) {
    const G = this.g, P = G.player;
    if ((this.t -= dt) > 0) return;
    this.t = 0.5;
    const st = G.W.streamer, live = new Set();
    for (const c of st.built) {
      if (!c.doors) continue;
      for (const d of c.doors) {
        if (d.shop < 0) continue;
        const h = hash(d.shop + 7919);
        if (h % EVERY) continue;
        const dd = Math.hypot(d.x - P.x, d.z - P.z);
        if (dd > 140) continue;
        live.add(d.shop);
        let b = this.boards.get(d.shop);
        if (!b) {
          const i = (h >>> 8) % PATYA.length, tx = -d.nz, tz = d.nx;
          const m = new THREE.Mesh(this.geo, this.mat(i));
          const x = d.x - d.nx * 0.19 + tx * 1.7, z = d.z - d.nz * 0.19 + tz * 1.7;
          m.position.set(x, G.W.surf.height(d.x, d.z) + 2.0, z); m.rotation.y = Math.atan2(d.nx, d.nz);
          G.scene.add(m);
          b = { m, i, x, z }; this.boards.set(d.shop, b);
        }
        if (dd < 18 && Math.hypot(b.x - P.x, b.z - P.z) < 3.6) this.read(b.i);
      }
    }
    for (const [k, b] of this.boards) if (!live.has(k)) { G.scene.remove(b.m); this.boards.delete(k); }
  }
  read(i) {
    const G = this.g, f = this.found;
    if (this._last === i && G.t - this._lastT < 20) return;
    this._last = i; this._lastT = G.t;
    const [mr, en] = PATYA[i], fresh = !f.includes(i);
    if (fresh) { f.push(i); G.life.save(); G.audio.blip?.(); }
    G.hud.toast(fresh ? `Puneri patya ${f.length}/${PATYA.length}` : 'Puneri patya', `${mr} · ${en}`, fresh ? 'good' : 'info', 4);
    if (fresh && f.length === PATYA.length) {
      G.stats.money += 24000; G.saveStats(); G.life.change('respect', 10); G.audio.cash();
      G.hud.flash('Asal Punekar', 'All twenty-four patyas read. ₹24,000 and the city’s respect. You may now put up your own.');
    }
  }
}
