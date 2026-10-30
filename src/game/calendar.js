// The calendar: what day it is in the game, and what that means for the city. Free roam runs on today's real date;
// a story starts on its own date (the monsoon, before Ganeshotsav) and moves on a day per game day. Weekdays matter
// (offices empty and roads lighter on a Sunday morning, clubs packed Friday to Sunday) and so do Pune's festivals:
// Ganeshotsav's ten days fill the peths at night, Diwali fills the markets, the Palkhi slows the city.
// Festival dates are 2026's (Hindu festivals move with the lunar calendar); other years reuse them approximately.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_MR = ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// [month (0-11), first day, days long, name, Marathi, how it changes the city]
const FEST = [
  [0, 26, 1, 'Republic Day', 'प्रजासत्ताक दिन', { traffic: 0.8, crowd: 1.1 }],
  [1, 19, 1, 'Shiv Jayanti', 'शिवजयंती', { traffic: 0.9, crowd: 1.4, procession: true }],
  [2, 4, 1, 'Holi', 'होळी', { traffic: 0.7, crowd: 1.3 }],
  [2, 19, 1, 'Gudi Padwa', 'गुढीपाडवा', { traffic: 0.9, crowd: 1.3, procession: true }],
  [7, 15, 1, 'Independence Day', 'स्वातंत्र्य दिन', { traffic: 0.8, crowd: 1.1 }],
  [8, 14, 11, 'Ganeshotsav', 'गणेशोत्सव', { traffic: 1.25, crowd: 1.8, procession: true, night: true }],
  [9, 11, 9, 'Navratri', 'नवरात्र', { traffic: 1.1, crowd: 1.3, night: true }],
  [9, 20, 1, 'Dussehra', 'दसरा', { traffic: 1.0, crowd: 1.4 }],
  [10, 6, 6, 'Diwali', 'दिवाळी', { traffic: 1.3, crowd: 1.6, market: true, night: true }],
  [11, 25, 1, 'Christmas', 'नाताळ', { traffic: 1.0, crowd: 1.2, night: true }],
  [11, 31, 1, 'New Year’s Eve', 'वर्षअखेर', { traffic: 1.2, crowd: 1.5, night: true, clubs: 2 }],
];

export class Calendar {
  constructor(G) { this.g = G; }
  // the date it is in the game right now
  date() {
    const G = this.g, day = Math.floor((G.clock || 0) / 24), s = G.life && G.life.s;
    let d0;
    if (G.free) { d0 = this._free || (this._free = new Date()); d0 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()); }
    else { if (s && !s.cal0) s.cal0 = Date.UTC(new Date().getFullYear(), 6, 12); d0 = new Date(s ? s.cal0 : Date.UTC(2026, 6, 12)); d0 = new Date(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()); }
    return new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + day);
  }
  // a story act can move the calendar on to its festival
  setDate(month, dayOfMonth) {
    const G = this.g, s = G.life && G.life.s; if (!s) return;
    const day = Math.floor((G.clock || 0) / 24), y = this.date().getFullYear();
    s.cal0 = Date.UTC(y, month, dayOfMonth) - day * 864e5;
  }
  weekday() { return this.date().getDay(); }
  weekend() { const w = this.weekday(); return w === 0 || w === 6; }
  festival() {
    const d = this.date();
    for (const [m, a, n, name, mr, fx] of FEST) { const start = new Date(d.getFullYear(), m, a), end = new Date(d.getFullYear(), m, a + n); if (d >= start && d < end) return { name, mr, ...fx }; }
    return null;
  }
  label() { const d = this.date(); return { day: DAYS[d.getDay()].slice(0, 3), dayLong: DAYS[d.getDay()], dayMr: DAYS_MR[d.getDay()], date: `${d.getDate()} ${MONTHS[d.getMonth()]}`, fest: this.festival() }; }
  // how busy the roads are: a quiet Sunday morning, a Saturday evening out, a festival
  trafficMul(hour) {
    const w = this.weekday(), f = this.festival();
    let k = w === 0 ? (hour < 12 ? 0.6 : 0.95) : w === 6 ? (hour < 11 ? 0.85 : 1.08) : 1;
    if (f) k *= f.traffic * (f.night && (hour > 18 || hour < 1) ? 1.1 : 1);
    return k;
  }
  crowdMul(hour) {
    const w = this.weekday(), f = this.festival();
    let k = (w === 0 || w === 6) && hour > 16 ? 1.2 : 1;
    if (f) k *= f.night ? (hour > 17 || hour < 2 ? f.crowd : 1 + (f.crowd - 1) * 0.4) : f.crowd;
    return k;
  }
  // clubs and bars: dead on a Monday, packed Friday and Saturday night
  clubMul() { const w = this.weekday(), f = this.festival(); return (f && f.clubs) || [1.1, 0.5, 0.6, 0.7, 0.85, 1.5, 1.7][w]; }
}
