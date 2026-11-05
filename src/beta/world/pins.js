// A place on the map is in a building, and you go in through that building's front, not from wherever you stand within a
// few metres of the map's dot (which put "Go into the temple" in the middle of the road). Each place gets a door: if its
// dot is inside a footprint, the nearest point of that footprint's wall; if it's just outside one, the wall it's up
// against; a dot in the open with nothing near (a roadside shrine) is its own door. You're offered it standing at
// the door, and F walks you in through it. Gardens and grounds stay open from their edge, as they are.
import { Shops } from '@orig/game/shops.js';

const DIRS = Array.from({ length: 24 }, (_, i) => [Math.cos(i/24*Math.PI*2), Math.sin(i/24*Math.PI*2)]);
const OPEN = new Set(['park', 'zoo']);
const REACH = 2.6;

function doorOf(S, p, now) {
  if (p._door && (!p._door.loose || now - p._door.t < 3000)) return p._door;
  const inB = (x, z) => S.bldTop(x, z) > -1;
  let best = null;
  if (inB(p.x, p.z)) {
    // out from the inside to the nearest wall
    for (const [dx, dz] of DIRS) for (let r = 0.4; r < 30; r += 0.4) if (!inB(p.x + dx*r, p.z + dz*r)) { if (!best || r < best.r) best = { r, x: p.x + dx*(r + 0.35), z: p.z + dz*(r + 0.35) }; break; }
  } else {
    // the wall it stands against
    for (const [dx, dz] of DIRS) for (let r = 0.4; r < 12; r += 0.4) if (inB(p.x + dx*r, p.z + dz*r)) { if (!best || r < best.r) best = { r, x: p.x + dx*Math.max(0, r - 0.35), z: p.z + dz*Math.max(0, r - 0.35) }; break; }
  }
  p._door = best ? { x: best.x, z: best.z, t: now } : { x: p.x, z: p.z, t: now, loose: true };
  return p._door;
}

const scan = Shops.prototype.scan;
Shops.prototype.scan = function () {
  const G = this.g, CM = G.W.cityMap, S = G.W.surf, P = G.player;
  if (!CM || !CM.placesNear || !S || !S.bldTop || !P.onFoot) return scan.call(this);
  const orig = CM.placesNear, now = performance.now();
  CM.placesNear = function (x, z, r) {
    const out = [];
    for (const p of orig.call(this, x, z, r + 30)) {
      if (OPEN.has(p.c)) { if (Math.hypot(p.x - x, p.z - z) < 10) out.push(p); continue; }
      const d = doorOf(S, p, now);
      if (Math.hypot(d.x - x, d.z - z) > REACH) continue;
      // (its distance is measured from the door; the door goes with it so F walks you in there)
      out.push({ ...p, x: d.x, z: d.z, _src: p, _d: d });
    }
    return out;
  };
  try { scan.call(this); } finally { CM.placesNear = orig; }
  const n = this.near;
  if (n && n.pin && !n.door && !OPEN.has(n.cat)) n.door = { x: n.x, z: n.z };
};
