// Nobody walks through a wall. People on foot keep to a line along the footpath a set distance out from the middle of
// the road, worked out from the road's width alone, and nothing ever checked it against the buildings: wherever a
// building's outline comes out over the footpath (most of the peths, half of the old bazaars), they walked in one
// wall and out of the other. Now, near you, each one on a footpath is kept out of the buildings: the line they walk
// is moved in toward the kerb until it's clear of the wall (down onto the road's edge if the building comes right to
// it), and anyone too close to a wall is eased off it, the way you'd step round a corner, not through it.
import { People } from '@orig/people/peds.js';
import { Collision } from '@orig/world/mapdata.js';

const T = [0, 0, 0, 0], NEAR = 140, R = 0.32;
const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...rest) {
  const r = upd.call(this, dt, player, ...rest);
  const C = this.W && this.W.collision, S = this.W && this.W.surf, IN = window.__nhAskG && window.__nhAskG.interiors;
  if (!C || !S || !player || (IN && IN.inside)) return r;
  const rev = Collision.rev;
  for (const p of this.list) {
    if (p.hidden || p.pax || p.fixed || p.rideOf || p.lift || p.corpse || p.mode === 'inside' || p.seat) continue;
    if (Math.abs(p.x - player.x) > NEAR || Math.abs(p.z - player.z) > NEAR) continue;
    const onLine = !!p.e && (p.mode === 'walk' || p.mode === 'stand' && !p.anchor);
    // (exactly where they were last found clear, and checked the same way, with nothing new put there since: still clear)
    if (p._wX === p.x && p._wZ === p.z && p._wL === onLine && p._wV === rev) continue;
    let ux = 0, uz = 0, atLine = false, moved = false;         // (the line's sideways: lat grows along it)
    const line = () => { if (atLine) return; atLine = true; this.g.at(p.e, Math.max(0, Math.min(p.e.len, p.s)), T); ux = T[3]; uz = -T[2]; };
    // inside a building: in toward the road, a step at a time, to the first clear spot
    if (onLine && S.inBuilding(p.x, p.z)) {
      moved = true; line();
      const sg = Math.sign(p.lat) || 1, lo = Math.max(0, p.e.w/2 - 0.3);
      for (let L = Math.abs(p.lat) - 0.3; L >= lo - 0.29; L -= 0.3) {
        const l = sg*Math.max(lo, L), x = T[0] + ux*l, z = T[1] + uz*l;
        if (!S.inBuilding(x, z) || Math.abs(l) <= lo) { p.x += (x - (T[0] + ux*p.lat)); p.z += (z - (T[1] + uz*p.lat)); p.lat = l; break; }
      }
    }
    // against a wall: off it
    const res = C.resolve(p.x, p.z, R);
    if (res && res.kind === 0) {
      p.x += res.nx*res.depth; p.z += res.nz*res.depth;
      if (onLine) { line(); p.lat += (res.nx*ux + res.nz*uz)*res.depth; }
    } else if (!res && !moved) { p._wX = p.x; p._wZ = p.z; p._wL = onLine; p._wV = rev; }
  }
  return r;
};
