// How full a place is depends on when you walk in. The roads, the footpaths and the clubs already follow the day
// and the festivals (game/calendar.js); this does the same for the rooms: an eatery full at lunch and dinner and
// half empty at four, a gym packed before work and after it and empty at noon, a bar that only fills after nine,
// shops busiest in the evening and on Sundays, a bank's queue in the morning, a clinic's in the evening. Weekends
// and festivals add to it (Diwali fills the shops).
import { Interiors } from '@orig/world/interiors.js';

const within = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;
function mul(tpl, h, w, f) {
  const wk = w === 0 || w === 6;
  let k = 1;
  switch (tpl) {
    case 'cafe': case 'eatery':
      k = within(h, 12, 14.5) ? 1.35 : within(h, 19.5, 22.5) ? 1.45 : within(h, 8, 10.5) ? 0.95 : within(h, 15, 18) ? 0.6 : within(h, 22.5, 6) ? 0.35 : 0.8;
      if (wk) k *= 1.2; break;
    case 'pub':
      k = h >= 21 || h < 1 ? 1.3 : h >= 19 ? 0.85 : 0.35; break;
    case 'club':
      k = 1; break;                                         // (the dance floor follows the night of the week below)
    case 'shop': case 'boutique': case 'showroom':
      k = within(h, 17, 21.5) ? 1.35 : within(h, 10, 13) ? 0.75 : 0.9;
      if (w === 0) k *= 1.25;
      if (f && f.market) k *= 1.7; break;
    case 'gym':
      k = within(h, 6, 9.5) ? 1.6 : within(h, 17.5, 21.5) ? 1.5 : within(h, 11, 16) ? 0.35 : 0.8;
      if (w === 0) k *= 0.55; break;
    case 'salon':
      k = within(h, 10, 13) ? 0.8 : within(h, 17, 21) ? 1.3 : 1;
      if (w === 0) k *= 1.5; break;
    case 'bank':
      k = w === 0 ? 0 : within(h, 10, 13) ? 1.4 : 0.8;
      if (w === 6) k *= 0.7; break;
    case 'clinic':
      k = within(h, 18, 21.5) ? 1.5 : within(h, 9, 12) ? 1.1 : 0.6; break;
    case 'office':
      k = wk ? 0.2 : within(h, 10, 18.5) ? 1 : 0.3; break;
    default: k = 1;
  }
  if (f && f.crowd && tpl !== 'office' && tpl !== 'bank') k *= Math.sqrt(f.crowd);
  return k;
}

const populate = Interiors.prototype.populate;
Interiors.prototype.populate = function (R, ctx) {
  const G = this.g, C = G.calendar;
  if (!C || !R) return populate.call(this, R, ctx);
  const h = G.hour || 0, w = C.weekday(), f = C.festival(), k = mul(R.tpl, h, w, f);
  const n0 = R.customers, d0 = R.dancers, l0 = R.lifters;
  if (n0) R.customers = Math.max(R.tpl === 'bank' && k === 0 ? 0 : 1, Math.round(n0*k));
  if (d0) R.dancers = Math.max(3, Math.round(d0*Math.min(1.5, C.clubMul())));
  if (l0) R.lifters = Math.max(1, Math.min(l0, Math.round(l0*k)));
  try { return populate.call(this, R, ctx); }
  finally { R.customers = n0; R.dancers = d0; R.lifters = l0; }
};
