// Corrections to the baked map's places where OpenStreetMap / Overture have them wrong or missing, applied
// to a tile's data as it streams in. The Mills (Raja Bahadur Mill compound, Sangamwadi Road) is a collective
// of clubs and restaurants in one old mill: every venue in it gets a storefront there, as the club it is.
import { cmRing } from './geo.js';

// x, z in metres (world), as on the map
const FIX = [
  { name: 'Toyroom Club', mr: 'टॉयरूम क्लब', kind: 'bar', at: [636, -598], move: true },          // it's inside The Mills, not up the road
  { name: 'The Mills Sociable', mr: 'द मिल्स सोशिएबल', kind: 'bar', at: [624.4, -586.0] },     // no storefront in the data at all
  { name: 'Bacchus Diner & Club', kind: 'bar' },                                              // a club, filed as a restaurant
  { name: '2BHK Diner & Key', rename: '2BHK Diner & Key Club' },
  { name: 'Dimora Dance & Kitchen', mr: 'डिमोरा', kind: 'bar', at: [584.6, -616.7] },
  { name: 'Cinco', mr: 'सिंको', kind: 'bar', at: [651.5, -600.1] },
];

function centroid(ring) { let x = 0, z = 0; const n = ring.length / 2; for (let k = 0; k < ring.length; k += 2) { x += ring[k]; z += ring[k + 1]; } return [x / n, z / n]; }
// the building nearest a spot (within r m), and its longest wall to put the board on
function nearestBuilding(D, x, z, r = 45, skip) {
  let best = -1, bd = r * r, ring = null;
  D.buildings.forEach((B, i) => {
    if (skip && skip.has(i)) return;
    const p = cmRing(B[1]), [cx, cz] = centroid(p), d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) { bd = d; best = i; ring = p; }
  });
  if (best < 0) return null;
  let edge = 0, el = 0;
  for (let k = 0, e = 0; k + 3 < ring.length; k += 2, e++) { const l = Math.hypot(ring[k + 2] - ring[k], ring[k + 3] - ring[k + 1]); if (l > el) { el = l; edge = e; } }
  return { bi: best, edge };
}

export function fixVenues(D) {
  if (!D.shops || !D.shopNames || !D.buildings) return;
  const t = D.tile ? D.tile : null; void t;
  const used = new Set(D.shops.map(s => s[0] * 4096 + s[1] * 64 + s[2]));
  for (const F of FIX) {
    let ni = D.shopNames.findIndex(n => n[0] === F.name);
    const si = ni >= 0 ? D.shops.findIndex(s => s[3] === ni) : -1;
    if (ni >= 0) {
      const N = D.shopNames[ni];
      if (F.rename) N[0] = F.rename;
      if (F.kind) { N[2] = F.kind; if (F.kind === 'bar' && !/बार|क्लब/.test(N[1])) N[1] = F.mr || 'बार'; }
      if (F.mr) N[1] = F.mr;
    }
    if (!F.at) continue;
    const [x, z] = F.at;
    // only for the tile that holds the spot
    const inTile = D.buildings.some(B => { const p = cmRing(B[1]); return Math.abs(p[0] - x) < 60 && Math.abs(p[1] - z) < 60; });
    if (!inTile) continue;
    if (si >= 0 && !F.move) continue;                                  // already has a storefront where it belongs
    const nb = nearestBuilding(D, x, z);
    if (!nb) continue;
    let slot = 0; while (used.has(nb.bi * 4096 + nb.edge * 64 + slot) && slot < 8) slot++;
    used.add(nb.bi * 4096 + nb.edge * 64 + slot);
    if (ni < 0) { ni = D.shopNames.length; D.shopNames.push([F.name, F.mr || 'बार', F.kind || 'bar', '']); }
    if (si >= 0) { D.shops[si][0] = nb.bi; D.shops[si][1] = nb.edge; D.shops[si][2] = slot; }
    else D.shops.push([nb.bi, nb.edge, slot, ni, 2]);
  }
  if (D.pins) fixPins(D.pins);
}
// the map's pins (per tile, and the city-wide list): moved venues move, the compound is called what Pune calls it
export function fixPins(list) {
  for (const p of list) {
    for (const F of FIX) if (F.move && p[0].startsWith(F.name)) { p[3] = Math.round(F.at[0] * 100); p[4] = Math.round(F.at[1] * 100); }
    if (p[0] === 'Raja Bahadur Motilal Poona Mills') { p[0] = 'The Mills (Raja Bahadur Mill)'; p[1] = 'द मिल्स'; }
  }
  return list;
}
