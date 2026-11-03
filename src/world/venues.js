// Fixes as a tile streams in. Bars, pubs and clubs come only from tools/venues.py, at their listed coordinates; here a famous
// place (src/world/famous.json) gets its storefront on the building at its pin, and places the data invents are dropped.
import { cmRing } from './geo.js';
import LM from './landmarks.json';
import FAMOUS from './famous.json';

// in the open data, but not real places (or not what they're labelled as)
const NOT_REAL = new Set(['The Mills Sociable', 'Themillspune']);

function centroid(ring) { let x = 0, z = 0; const n = ring.length / 2; for (let k = 0; k < ring.length; k += 2) { x += ring[k]; z += ring[k + 1]; } return [x / n, z / n]; }
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// landmarks moved to their real site after the map was baked: the generic boxes standing there are flattened
// to a speck (kept, so the tile's building numbering doesn't shift) so the real model stands alone
const MOVED = ['station'].map(id => LM.find(l => l.id === id)).filter(Boolean);
function clearSites(D) {
  for (const L of MOVED) {
    const c = Math.cos(L.rot), s = Math.sin(L.rot);
    for (const B of D.buildings) {
      const p = cmRing(B[1]); if (p.length < 6) continue;
      const [x, z] = centroid(p), dx = x - L.x, dz = z - L.z, u = dx * c + dz * s, v = dx * s - dz * c;
      if (Math.abs(u) < L.w / 2 + 4 && Math.abs(v) < L.d / 2 + 4) { const X = Math.round(x * 100), Z = Math.round(z * 100); B[1] = [X, Z, X + 5, Z, X, Z + 5]; }
    }
  }
}
export function fixVenues(D, rect) {
  if (D.buildings) clearSites(D);
  if (!D.shops || !D.shopNames || !D.buildings) return;
  // drop what isn't real
  D.shops = D.shops.filter(s => !NOT_REAL.has(D.shopNames[s[3]] && D.shopNames[s[3]][0]));
  if (D.pins) D.pins = D.pins.filter(p => !NOT_REAL.has(p[0]));
  let cents = null;
  const used = new Set(D.shops.map(s => s[0] * 4096 + s[1] * 64 + s[2]));
  for (const [name, mr, x, z, kind] of FAMOUS.filter(f => f.kind).map(f => [f.name, f.mr || f.name, f.x, f.z, f.kind])) {
    if (rect && (x < rect[0] - 40 || x > rect[2] + 40 || z < rect[1] - 40 || z > rect[3] + 40)) continue;   // not in this tile
    cents = cents || D.buildings.map(B => { const p = cmRing(B[1]); return { c: centroid(p), p }; });
    // the building at the pin (its centre within 35 m), in this tile
    let bi = -1, bd = 35 * 35;
    cents.forEach((b, i) => { const d = (b.c[0] - x) ** 2 + (b.c[1] - z) ** 2; if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) continue;
    // the data's own storefront for it, if any (by name), on any building in the tile
    const key = norm(name);                                          // (the whole name: "Vaishali Medical" is not Vaishali)
    let si = D.shops.findIndex(s => { const n = D.shopNames[s[3]]; return n && norm(n[0]) === key; });
    if (si >= 0 && D.shops[si][4] === 3) continue;                   // placed from its coordinates (tools/venues.py): it's right
    let ni;
    if (si >= 0) { ni = D.shops[si][3]; Object.assign(D.shopNames[ni], { 0: name, 1: mr, 2: kind || 'bar' }); }
    else { ni = D.shopNames.length; D.shopNames.push([name, mr, kind || 'bar', '']); }
    if (si >= 0 && D.shops[si][0] === bi) continue;                  // already on the right building
    // its board on the building's longest wall, in a free slot
    const ring = cents[bi].p;
    let edge = 0, el = 0;
    for (let k = 0, e = 0; k + 3 < ring.length; k += 2, e++) { const l = Math.hypot(ring[k + 2] - ring[k], ring[k + 3] - ring[k + 1]); if (l > el) { el = l; edge = e; } }
    let slot = 0; while (used.has(bi * 4096 + edge * 64 + slot) && slot < 8) slot++;
    used.add(bi * 4096 + edge * 64 + slot);
    if (si >= 0) { D.shops[si][0] = bi; D.shops[si][1] = edge; D.shops[si][2] = slot; }
    else D.shops.push([bi, edge, slot, ni, 2]);
  }
}
// the city-wide map pins: drop what isn't real
const SAME_PLACE = {
  'Katakirr Misal': 'Katakirrr', 'Chitale Bandhu': 'Chitale Bandhu Mithaiwale', 'SP’s Biryani House': "SP's Biryani",
  'Pataleshwar Caves': 'Pataleshwar cave temple', 'ISKCON NVCC': 'ISKCON NVCC Temple', 'Guruji Talim Ganpati': 'Guruji Talim',
  'Empress Garden': 'Empress Botanical Garden', 'Rajiv Gandhi Zoo': 'Rajiv Gandhi Zoological Park', 'Omkareshwar Temple': 'Omkareshwar Mandir',
  'National War Memorial': 'National War Memorial Southern Command', 'Amanora Mall': 'Amanora Town Center Mall', 'Abhiruchi Mall': 'Abhiruchi Mall and Multiplex',
  'Swargate Bus Stand': 'Swargate MSRTC Bus Stand', 'Mahatma Phule Mandai': 'Mahatma Fule Market', 'E-Square': 'E-Square Multiplex',
  'City Pride Satara Road': 'City Pride Multiplex', 'Shivsrushti': 'Shivsrushti Historical Theme Park Pune', 'World Trade Center Pune': 'World Trade Center',
  'Pimpri-Chinchwad Science Park': 'Pimpri Chinchwad Science Centre',
};
export function fixPins(list) {
  const out = list.filter(p => !NOT_REAL.has(p[0]));
  // Pune's famous places, checked against OpenStreetMap, as stars on the map
  // (the city's own pin for the same place becomes the star, at OSM's spot; never two stars for one place)
  // (the whole name, or a name in SAME_PLACE: "Swargate Police Station" is not Swargate Bus Stand)
  const full = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, ''), byName = new Map();
  for (const p of out) { const k = full(p[0]); if (byName.has(k)) byName.get(k).push(p); else byName.set(k, [p]); }
  for (const f of FAMOUS) {
    const fx = Math.round(f.x * 100), fz = Math.round(f.z * 100);
    const within = (n) => (byName.get(full(n)) || []).find(p => Math.hypot(p[3] - fx, p[4] - fz) < 30000);
    const same = within(f.name) || (SAME_PLACE[f.name] && within(SAME_PLACE[f.name]));
    if (same) { same[0] = f.name; if (f.mr) same[1] = f.mr; same[2] = /^(club|pub|lounge|restobar)$/.test(f.kind) ? f.kind : 'landmark'; same[3] = fx; same[4] = fz; }
    else out.push([f.name, f.mr || '', 'landmark', fx, fz, 1]);
  }
  return out;
}
