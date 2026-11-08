// The traffic keeps the vehicles it lets go (out of range, taken by you, towed) and hands the same objects out again
// as new ones, setting only the fields it knows about. Everything else on them stayed: a two-wheeler that went over
// (traffic/topple.js) came back as a car still falling, drawn on its side and sliding about; a burnt-out one came back
// a wreck; one you'd got into came back invisible. A vehicle going back in the pool is now wiped of all of it: what
// the game and the beta modules hang on them (_tp, _dy, _out, hideBody, argue, the damage, the wreck), so the next
// one out is new.
import { Traffic } from '@orig/traffic/traffic.js';

// Gone from the street-finding grid at once, too, not at the next frame's rebuild. A car hit hard enough to become a real
// one (beta/vehicles/crash.js, damage.js promote) left its traffic self in the grid for the rest of the frame, so the
// next physics step (or the next car it was thrown into) met it again and made a second real car of it: two of the same
// car, one on top of the other
function unGrid(TR, v) {
  const g = TR.grid, c = TR.cell; if (!g || !c) return;
  const ci = Math.floor(v.x/c), cj = Math.floor(v.z/c), out = (l) => { const k = l ? l.indexOf(v) : -1; if (k < 0) return false; l.splice(k, 1); return true; };
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (out(g.get((ci + di)*73856 + cj + dj))) return;
  for (const l of g.values()) if (out(l)) return;
}
const despawn = Traffic.prototype.despawn;
Traffic.prototype.despawn = function (i) {
  const v = this.list[i];
  despawn.call(this, i);
  if (!v) return;
  unGrid(this, v);
  for (const k of Object.keys(v)) if (k[0] === '_') delete v[k];
  v.hideBody = false; v._sh = null; v._hit = null; v._hitT = 0; v.argue = 0; v.wreck = false; v.dmg = 0; v.fallen = 0; v.roll = 0; v.pitch = 0; v.angry = 0;
  v.drv = null; v.pre = null;
};
