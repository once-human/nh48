// Pune's real nightlife, checked: the clubs and pubs on Pune Police's list of licensed pubs and discos (RTI,
// June 2024) and the venues confirmed at The Mills (Raja Bahadur Mill compound) and around the city, each
// at its own map pin. The open map data has most of them but files many as "food" or "service", so the game
// never made them clubs. As a tile streams in, every venue here gets a club storefront on the building at its
// pin (added if the data has none, moved if it's on the wrong building). Places the data invents are dropped.
// x, z: metres on the game map (the pins in data/pune/pins.json.gz)
import { cmRing } from './geo.js';
import LM from './landmarks.json';
import FAMOUS from './famous.json';

export const NIGHTLIFE = [
  // The Mills, Raja Bahadur Mill Road (Sangamwadi)
  ['2BHK Diner & Key Club', '2BHK डायनर अँड की क्लब', 608, -602],
  ['Millers The Luxury Club', 'मिलर्स', 585, -564],
  ['Dimora Dance & Kitchen', 'डिमोरा', 585, -617],
  ['The Game Palacio', 'द गेम पॅलासिओ', 629, -736],
  ['Bira Taproom', 'बीरा टॅपरूम', 638, -660],
  ['Drama 9', 'ड्रामा ९', 641, -668],
  // Sheraton Grand Pune, Raja Bahadur Motilal Road
  ['Toyroom', 'टॉयरूम', 656, -325],
  // Koregaon Park, Kalyani Nagar, Mundhwa
  ['High Spirits', 'हाय स्पिरिट्स', 4255, -1371],
  ['The Westin Club', 'द वेस्टिन क्लब', 4339, -1335],
  ['Orilla', 'ओरिला', 5031, -1251],
  ['Cosie', 'कोझी', 4674, -1183],
  ['Penthouze', 'पेंटहाउझ', 3666, -955],
  ['Elrow', 'एलरो', 4903, -1945],
  ['SWIG', 'स्विग', 3043, -1413],
  ['Effingut Brewerkz', 'एफिंगट', 3587, -774],
  ['Oak Lounge', 'ओक लाउंज', 4778, -585],
  ['Elephant & Co.', 'एलिफंट अँड को.', 3800, -2193],
  // Camp
  ['1000 Oaks', '१००० ओक्स', 1575, 1806],
  ['Effingut', 'एफिंगट', 1521, 1168],
  // Senapati Bapat Road
  ['JW Marriott Club', 'जेडब्ल्यू मॅरियट क्लब', -3742, -592],
  // Baner, Balewadi
  ['1BHK Superbar', '1BHK सुपरबार', -9872, -4497],
  ['Elephant & Co.', 'एलिफंट अँड को.', -8934, -4139],
  ['Coastal Culture', 'कोस्टल कल्चर', -9350, -4565],
  ['SWIG Bar & Eatery', 'स्विग', -9554, -4704],
  ['Effingut', 'एफिंगट', -9437, -4485],
];
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
  for (const [name, mr, x, z, kind] of [...NIGHTLIFE, ...FAMOUS.filter(f => f.kind).map(f => [f.name, f.mr || f.name, f.x, f.z, f.kind])]) {
    if (rect && (x < rect[0] - 40 || x > rect[2] + 40 || z < rect[1] - 40 || z > rect[3] + 40)) continue;   // not in this tile
    cents = cents || D.buildings.map(B => { const p = cmRing(B[1]); return { c: centroid(p), p }; });
    // the building at the pin (its centre within 35 m), in this tile
    let bi = -1, bd = 35 * 35;
    cents.forEach((b, i) => { const d = (b.c[0] - x) ** 2 + (b.c[1] - z) ** 2; if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) continue;
    // the data's own storefront for it, if any (by name), on any building in the tile
    const key = norm(name).slice(0, 8);
    let si = D.shops.findIndex(s => { const n = D.shopNames[s[3]]; return n && norm(n[0]).startsWith(key); });
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
export function fixPins(list) {
  const out = list.filter(p => !NOT_REAL.has(p[0]));
  // Pune's famous places, checked against OpenStreetMap, as stars on the map
  // (the city's own pin for the same place becomes the star, at OSM's spot; never two stars for one place)
  const key = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 7);
  for (const f of FAMOUS) {
    const k = key(f.name), fx = Math.round(f.x * 100), fz = Math.round(f.z * 100);
    const same = out.find(p => key(p[0]) === k && Math.hypot(p[3] - fx, p[4] - fz) < 30000);
    if (same) { same[0] = f.name; if (f.mr) same[1] = f.mr; same[2] = 'landmark'; same[3] = fx; same[4] = fz; }
    else out.push([f.name, f.mr || '', 'landmark', fx, fz, 1]);
  }
  return out;
}
