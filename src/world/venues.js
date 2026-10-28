// Pune's real nightlife, checked: the clubs and pubs on Pune Police's list of licensed pubs and discos (RTI,
// June 2024) and the venues confirmed at The Mills (Raja Bahadur Mill compound) and around the city, each
// at its own map pin. The open map data has most of them but files many as "food" or "service", so the game
// never made them clubs. As a tile streams in, every venue here gets a club storefront on the building at its
// pin (added if the data has none, moved if it's on the wrong building). Places the data invents are dropped.
// x, z: metres on the game map (the pins in data/pune/pins.json.gz)
import { cmRing } from './geo.js';

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

export function fixVenues(D) {
  if (!D.shops || !D.shopNames || !D.buildings) return;
  // drop what isn't real
  D.shops = D.shops.filter(s => !NOT_REAL.has(D.shopNames[s[3]] && D.shopNames[s[3]][0]));
  if (D.pins) D.pins = D.pins.filter(p => !NOT_REAL.has(p[0]));
  let cents = null;
  const used = new Set(D.shops.map(s => s[0] * 4096 + s[1] * 64 + s[2]));
  for (const [name, mr, x, z] of NIGHTLIFE) {
    cents = cents || D.buildings.map(B => { const p = cmRing(B[1]); return { c: centroid(p), p }; });
    // the building at the pin (its centre within 35 m), in this tile
    let bi = -1, bd = 35 * 35;
    cents.forEach((b, i) => { const d = (b.c[0] - x) ** 2 + (b.c[1] - z) ** 2; if (d < bd) { bd = d; bi = i; } });
    if (bi < 0) continue;
    // the data's own storefront for it, if any (by name), on any building in the tile
    const key = norm(name).slice(0, 8);
    let si = D.shops.findIndex(s => { const n = D.shopNames[s[3]]; return n && norm(n[0]).startsWith(key); });
    let ni;
    if (si >= 0) { ni = D.shops[si][3]; Object.assign(D.shopNames[ni], { 0: name, 1: mr, 2: 'bar' }); }
    else { ni = D.shopNames.length; D.shopNames.push([name, mr, 'bar', '']); }
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
export function fixPins(list) { return list.filter(p => !NOT_REAL.has(p[0])); }
