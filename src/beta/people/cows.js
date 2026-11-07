// A cow moves like a cow: slowly, straight ahead, along the side of the road, and that's all. She doesn't cross it, nothing
// pushes her about, and she doesn't push anything either. If there's something in front of her she stops, and when she next
// sets off it's the other way, turning round on the spot first. (She used to be shoved out of whatever she overlapped, a
// parked car or a shop's edge, every frame, and told to wander across the road, so she went sideways until she reached the
// shops and shook against them.) One that's shooed off or follows you goes at a cow's trot (a patch on people/strays.js in
// tools/build-beta.mjs), and stays where that leaves her.
import { People } from '@orig/people/peds.js';
import { Strays } from '@orig/people/strays.js';

const TURN = 0.7;          // how fast she turns (rad/s)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const place = People.prototype.placeAnimal;
const hitsAt = (P, x, z, r) => { const C = P.W && P.W.collision, res = C && C.resolve(x, z, r); return !!(res && res.depth > 0.01); };
People.prototype.placeAnimal = function (a) {
  if (!(a.cow || a.kind === 'cow')) return place.call(this, a);
  // (by the clock, not per call: she's placed more than once in some frames)
  const t = performance.now(), dt = Math.min(0.1, Math.max(0, (t - (a._tS ?? t))/1000)); a._tS = t;
  // put on another street, out of sight: somewhere clear on it, already facing along it
  if (a._eS !== a.e) {
    a._eS = a.e; a._yawS = undefined;
    for (let k = 0; k < 8; k++) { place.call(this, a); if (!hitsAt(this, a.x, a.z, 1.1)) break; a.s = Math.max(2, Math.min(a.e.len - 2, a.s + (k%2 ? -1 : 1)*(k + 1)*2.5)); }
  }
  place.call(this, a);
  // along the road, the way she's headed; turned to, not snapped, and she takes no steps till she's nearly round
  const want = a.yaw;
  if (a._yawS === undefined) a._yawS = want;
  const d = wrap(want - a._yawS);
  a._yawS = wrap(a._yawS + Math.sign(d)*Math.min(Math.abs(d), TURN*dt));
  a.yaw = a._yawS; a.hx = Math.cos(a.yaw); a.hz = Math.sin(a.yaw);
  const c = Math.max(0, Math.cos(wrap(want - a._yawS)));
  a._al = c*c*c*c;
  // something in front of her: she stops, and goes the other way next
  if (a.moving && !a.free && a._al > 0.9 && hitsAt(this, a.x + a.hx*1.5, a.z + a.hz*1.5, 0.35)) { a.moving = false; a.rest = 2 + Math.random()*6; a.dir = -a.dir; }
};

// a cow let go after following you or being shooed off: she carries on from where she actually is
const TMP = new Float64Array(4);
const rel = Strays.prototype.release;
Strays.prototype.release = function (a) {
  const x = a.x, z = a.z;
  rel.call(this, a);
  if (!(a.cow || a.kind === 'cow')) return;
  const g = this.g && this.g.W && this.g.W.graph;
  if (!a.e || !g || !g.at) return;
  g.at(a.e, a.s, TMP);
  a.lat = (x - TMP[0])*TMP[3] - (z - TMP[1])*TMP[2];              // (+lat is (hz, -hx) of the road)
  a._eS = a.e;
};
