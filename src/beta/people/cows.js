// A cow moves like a cow. Wandering out to lie in the road it was put there in one frame (and back on the verge in
// one frame when it got up): it now walks there, across the road at an amble, turning to face where it's going and
// back along the road when it's there. And one that's shooed off or follows you goes at a cow's trot (a patch on
// people/strays.js in tools/build-beta.mjs), not at a street dog's sprint with its slow walk played five times over.
import { People } from '@orig/people/peds.js';
import { Strays } from '@orig/people/strays.js';

const AMBLE = 0.32, TURN = 0.7;          // across the road (m/s), and how fast it turns (rad/s)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const place = People.prototype.placeAnimal;
People.prototype.placeAnimal = function (a) {
  if (!(a.cow || a.kind === 'cow')) return place.call(this, a);
  // (by the clock, not per call: she's placed several times a frame whenever anything nudges her)
  const t = performance.now(), dt = Math.min(0.1, Math.max(0, (t - (a._tS ?? t))/1000)), L = a.lat; a._tS = t;
  // (put on another street, out of sight: there at once, already facing along it. Nothing else moves her faster than she walks.)
  if (a._latS === undefined || a._eS !== a.e) { a._latS = L; a._eS = a.e; a._yawS = undefined; }
  const gap = L - a._latS;
  // a cow walks where she faces: she turns first, on the spot, and only sets off when she's looking the way she's going.
  // (She went on walking while she turned, so she drifted sideways, and backwards for seconds after every change of mind.)
  const a0 = a._al ?? 1, step = Math.sign(gap)*Math.min(Math.abs(gap), AMBLE*a0*dt);
  a._latS += step;
  a.lat = a._latS;
  place.call(this, a);
  a.lat = L;
  // facing: across while it's crossing (toward +lat is (hz, -hx) of the road), along the road otherwise; turned to,
  // not snapped
  const hx = Math.cos(a.yaw), hz = Math.sin(a.yaw);
  let want = a.yaw;
  if (Math.abs(gap) > 0.05) { const s = Math.sign(gap), rx = hz*a.dir*s, rz = -hx*a.dir*s; want = Math.atan2(rz, rx); }
  if (a._yawS === undefined) a._yawS = want;
  const d = wrap(want - a._yawS);
  a._yawS = wrap(a._yawS + Math.sign(d)*Math.min(Math.abs(d), TURN*dt));
  a.yaw = a._yawS; a.hx = Math.cos(a.yaw); a.hz = Math.sin(a.yaw);
  const c = Math.max(0, Math.cos(wrap(want - a._yawS)));
  a._al = c*c*c*c;                                       // (how much of a step she'll take: none till she's nearly round)
  a._cross = Math.abs(gap) > 0.05;                       // (crossing, she isn't also going along: peds.js)
};

// a cow let go after following you or being shooed off: back to its road from where it actually is (it was put
// straight back on its old spot across the road): the offset it stands at is worked out, and it ambles back from there
const TMP = new Float64Array(4);
const rel = Strays.prototype.release;
Strays.prototype.release = function (a) {
  const x = a.x, z = a.z;
  rel.call(this, a);
  if (!(a.cow || a.kind === 'cow')) return;
  const g = this.g && this.g.W && this.g.W.graph;
  if (!a.e || !g || !g.at) return;
  g.at(a.e, a.s, TMP);
  const off = (x - TMP[0])*TMP[3] - (z - TMP[1])*TMP[2];          // (+lat is (hz, -hx) of the road)
  a._latS = off; a._eS = a.e;
};
