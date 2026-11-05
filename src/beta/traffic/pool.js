// The traffic keeps the vehicles it lets go (out of range, taken by you, towed) and hands the same objects out again
// as new ones, setting only the fields it knows about. Everything else on them stayed: a two-wheeler that went over
// (traffic/topple.js) came back as a car still falling, drawn on its side and sliding about; a burnt-out one came back
// a wreck; one you'd got into came back invisible. A vehicle going back in the pool is now wiped of all of it: what
// the game and the beta modules hang on them (_tp, _dy, _out, hideBody, argue, the damage, the wreck), so the next
// one out is new.
import { Traffic } from '@orig/traffic/traffic.js';

const despawn = Traffic.prototype.despawn;
Traffic.prototype.despawn = function (i) {
  const v = this.list[i];
  despawn.call(this, i);
  if (!v) return;
  for (const k of Object.keys(v)) if (k[0] === '_') delete v[k];
  v.hideBody = false; v.argue = 0; v.wreck = false; v.dmg = 0; v.fallen = 0; v.roll = 0; v.pitch = 0; v.angry = 0;
  v.drv = null; v.pre = null;
};
