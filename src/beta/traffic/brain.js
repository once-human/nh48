// Every vehicle in the traffic has a driver of its own. They used to be one driver copied a few hundred times: the same
// gap to the one in front, the same pull away, the same place across the road, the same stop at the same line. Now each
// is rolled when it appears (from its own number, so it's the same person all the way down the road) and their kind of
// vehicle leans them one way or another: auto drivers pushy and all over the road, bus drivers bullies, cabs brisk,
// two-wheelers afraid of nothing, cyclists and tempos slow at the kerb, the big saloons smooth and proper.
//
//   how they drive    how close they sit behind you, how hard they pull away and brake, how fast they want to go
//   where they drive  slow ones keep left, quick ones sit out toward the middle; held up, two-wheelers thread between
//                     the queue to the front of a red, and a car pulls out round a slow one (a hoot first; the slow one
//                     often moves over for it)
//   signals           each stops where they stop (some on the line, bikes a nose over it), some go on the others' amber
//                     when their own green is next, each takes their own moment to get going on green and the
//                     impatient ones behind are on the horn the instant it changes; a siren behind and the front row
//                     moves through the red out of its way
//   looking ahead     a good driver eases off when the one in front of the one in front brakes, and when brake lamps
//                     come on; everyone leaves more room for someone on foot or a cow
//   junctions         with no signal: look for what's coming across, creep to the edge, go when there's a gap. The
//                     bigger and pushier go first, the timid wait longer, nobody waits for ever
//   small things      autos and cabs pull in to the kerb for a fare now and then and rejoin; slower in the rain, the
//                     careful ones slower at night and the reckless ones faster
//
// The sim's own rules stay as they are (traffic.js: following, signals, weaving) and the layers over it keep the last
// word on where a vehicle can physically be (spacing.js, steer.js). This only decides what each driver wants.
// Hooks called from traffic.js step (tools/build-beta.mjs): brainSpeed, brainSee, brainSig; v._bPref, v._bCreep.
import { Traffic } from '@orig/traffic/traffic.js';

const clamp = (x, a, b) => x < a ? a : x > b ? b : x, lerp = (a, b, t) => a + (b - a)*t;
function h01(id, k) {
  let x = ((id >>> 0) ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
}
const endNode = (g, l) => l.e.fly ? (l.dir > 0 ? l.e.B : l.e.A) : g.nodes[l.dir > 0 ? l.e.b : l.e.a];

// the kind of driver a vehicle tends to have: [aggression, lane discipline, skill]
function lean(v, T) {
  const t = v.type;
  if (T.honk === 'bell') return [0.25, 0.3, 0.5];
  if (/^super|^sports/.test(t)) return [0.85, 0.5, 0.8];
  if (T.two) return [0.66, 0.25, 0.6];
  if (T.honk === 'auto') return [0.7, 0.15, 0.55];
  if (T.honk === 'bus') return [0.78, 0.5, 0.7];
  if (T.honk === 'tempo') return [0.38, 0.4, 0.5];
  if (/taxi/.test(t)) return [0.66, 0.4, 0.75];
  if (/^lux/.test(t) || T.mass >= 1790) return [0.4, 0.8, 0.8];
  return [0.47, 0.55, 0.6];
}
function roll(TR, v) {
  const base = v.T, id = v.id || 0, r = (k) => h01(id, k), two = !!base.two, auto = base.honk === 'auto', bus = base.honk === 'bus';
  const [mA, mD, mS] = lean(v, base);
  const aggr = clamp(mA + (r(1) + r(2) - 1)*0.4, 0, 1), disc = clamp(mD + (r(3) - 0.5)*0.5, 0, 1), skill = clamp(mS + (r(4) - 0.5)*0.6, 0.1, 1);
  const pat = clamp(1 - aggr*0.75 + (r(5) - 0.5)*0.5, 0, 1);
  const T = Object.create(base);
  T._own = true;
  T.T = base.T*lerp(1.32, 0.62, aggr); T.s0 = base.s0*lerp(1.25, 0.8, aggr);
  T.A = base.A*lerp(0.82, 1.22, aggr); T.B = base.B*lerp(0.92, 1.12, aggr);
  T.agile = base.agile*lerp(0.6, 1.5, aggr*(1 - disc*0.5));
  v.T = T;
  v.vMul = (v._bV ?? (v._bV = v.vMul))*lerp(0.9, 1.1, aggr);
  v.redRunner = r(6) < aggr*(two || auto ? 0.32 : 0.09);
  const sr = clamp((v.vMul - 0.7)/0.6, 0, 1);
  const pref = base.honk === 'bell' ? 0.95 : bus ? 0.45 : clamp(0.85 - 0.6*sr + (two ? 0.12 : 0) + (r(7) - 0.5)*0.35*(1 - disc), 0.1, 0.93);
  v._b = {
    aggr, disc, skill, pat,
    push: Math.pow((base.mass || 1000)/1000, 0.35)*(0.7 + aggr*0.6),              // who goes first where nobody has to
    react: lerp(1.5, 0.2, aggr*0.55 + skill*0.45)*(bus ? 1.4 : 1),                // getting going on green (s)
    jump: two || auto ? aggr*aggr*3.2 : aggr > 0.7 ? (aggr - 0.7)*3.2 : 0,        // going this long before their green
    wait: 1.4 + pat*3.6,                                                           // at a junction, before nosing in anyway
    kerb: (auto || /taxi/.test(v.type)) && r(8) < 0.7, kerbT0: 12 + r(9)*70,
  };
  v._bPref = pref;
  v._bCreep = Math.min(2.6, two ? 0.7 + aggr*2.1 : aggr*1.7*(1 - disc));
}
function hoot(TR, v, n) {
  if (TR.time - (v._bHk || -9) < 2.2) return;
  v._bHk = TR.time; TR.honks.push({ x: v.x, z: v.z, kind: v.T.honk, n });
}

// ------------------------------------------------------------------ how fast they want to go (before following)
Traffic.prototype.brainSpeed = function (v, vDes, dt) {
  const p = v._b; if (!p) return vDes;
  const wet = this.W.wet || 0, hr = this.hour;
  if (wet > 0.05) vDes *= 1 - wet*(0.07 + 0.2*(1 - p.aggr));
  if (hr < 5.5 || hr > 21.5) vDes *= 0.93 + p.aggr*0.15;
  v._bDes = vDes;
  if (v.jc) return vDes;
  const e = v.l.e, node = endNode(this.graph, v.l);
  if (!node) return vDes;
  const remain = e.len - Math.min(node.jr, e.len*0.45) - v.s;
  // --- a fare at the kerb: over to the left, stop a few seconds, off again
  const K = v._bKerb;
  if (K) {
    const hi = Math.max(0.6, e.w/2 - 0.55);
    v.latT = hi;
    if (K.ph === 0) {
      if (hi - v.lat < 0.45) K.ph = 1;
      else if ((K.t0 -= dt) < 0 || remain < 14) { v._bKerb = null; v._bKerbT = 20; return vDes; }
      return Math.min(vDes, 1.3 + (hi - v.lat)*2.2);
    }
    v.stuck = 0;
    if ((K.t -= dt) <= 0) { v._bKerb = null; v._bKerbT = 35 + h01(v.id, 11 + (this.time | 0))*80; }
    return v.v > 1 ? v.v*0.75 : 0;
  }
  if (p.kerb && (v._bKerbT = (v._bKerbT ?? p.kerbT0) - dt) <= 0) {
    if (!e.fly && e.rank >= 2 && e.rank <= 5 && remain > 45 && v.s > 15 && v.v > 3 && !(this.yieldTo) && !(v.argue > 0)) v._bKerb = { ph: 0, t: 3 + h01(v.id, 13 + (this.time | 0))*6, t0: 9 };
    else v._bKerbT = 4;
  }
  // --- a junction with no signal: what's coming across?
  if (!node.signal && !e.fly && remain < 6 + v.v*v.v*0.2 && remain > -1 && (node.deg || (node.out ? node.out.length : 0)) >= 3) {
    if ((v._bJT = (v._bJT || 0) - dt) <= 0) { v._bJT = 0.18; v._bJC = crossing(this, v, node, p, e.rank); }
    if (v._bJC) {
      const w = v._bJW = (v._bJW || 0) + dt;
      if (w < p.wait) vDes = Math.min(vDes, Math.sqrt(5.2*Math.max(0, remain - 0.6)) + (w > p.wait*0.5 ? 0.7 : 0));     // to the edge, then creeping
      else { vDes = Math.min(vDes, 2.6); if (w > p.wait + 4) v._bJW = 0; }                                          // waited long enough: nose in
    } else if (v._bJW > 0) v._bJW = Math.max(0, v._bJW - dt*2);
  } else if (v._bJW) v._bJW = 0;
  return vDes;
};
// is something about to cross the junction ahead that this driver gives way to?
function crossing(TR, v, node, p, rank) {
  let hit = false;
  const jr = node.jr || 3, turnR = v.next && v.next.turn > 0.6, need = 2.7 - p.aggr*1.3;
  TR.near(node.x, node.z, jr + 14, (o) => {
    if (hit || o === v || !o.T || o.wreck || o.parked || Math.abs((o.y || 0) - (v.y || 0)) > 2) return;
    const ov = Math.abs(o.v || 0); if (ov < 1.2) return;
    const ohx = o.hx ?? 1, ohz = o.hz ?? 0, dot = ohx*v.hx + ohz*v.hz;
    if (dot > 0.6) return;                                 // going my way: following deals with it
    if (dot < -0.6 && !turnR) return;                      // coming the other way: only matters turning right across it
    const dx = node.x - o.x, dz = node.z - o.z, d = Math.hypot(dx, dz), toward = dx*ohx + dz*ohz;
    if (toward < -jr*0.5) return;                          // through and leaving
    if (!o.jc && toward < d*0.7) return;                   // not headed for this junction
    const ork = o.l && o.l.e ? o.l.e.rank : rank, tO = Math.max(0, d - jr)/ov;
    if (!o.jc && ork < rank && !o.isPlayer) return;        // from a smaller road: it waits for me
    if (tO > need + (ork > rank ? 1.1 : 0)) return;                                 // a gap they'll take
    const op = o._b ? o._b.push : 1.15;
    if (!o.jc && tO > 0.5 && (p.push > op*1.25 || (p.push > op*0.8 && tO > need*0.6 && (v.id > (o.id || 0)) && p.aggr > 0.6))) return;    // "it'll stop"
    hit = true;
  });
  return hit;
}

// ------------------------------------------------------------------ what they see ahead
// (called with the thing in their path; returns its speed as this driver reckons it, the room to it in this._bGap)
Traffic.prototype.brainSee = function (v, ob, vo) {
  const p = v._b, a = ob.agent; let gap = ob.gap;
  v._bLs = ob.side;
  if (p) {
    if (!a.T && !a.parked) { if (gap > 0.3) gap = Math.max(0.25, gap - 0.5 - (1 - p.aggr)*1.2); }      // on foot, a cow: room
    else if (a.T && vo > 1) {
      const l2 = a._bLead;
      if (l2 && l2 !== v && l2.alive !== false && a._bLg < 12 && (l2.v || 0) < vo - 1.5) vo -= (vo - (l2.v || 0))*0.5*p.skill;   // the one beyond is slowing
      if (a._brk > 0) vo -= p.skill;                                                                                         // brake lamps
      if (vo < 0) vo = 0;
    }
  }
  this._bGap = gap;
  return vo;
};

// ------------------------------------------------------------------ the signal as this driver takes it
Traffic.prototype.brainSig = function (v, st, node, ob, dt) {
  const p = v._b; if (!p) return st;
  const was = v._bSL === v.l ? v._bSt : undefined;
  v._bSL = v.l; v._bSt = st;
  if (st === 'g') {
    if (was === 'r' && v.v < 0.6) {
      const queued = ob && ob.gap < 8;
      v._bReact = p.react*(queued ? 0.35 : 1);
      if (queued && h01(v.id, 17 + (this.time | 0)) > p.pat*0.9) hoot(this, v, p.pat < 0.3 ? 2 : 1);       // "chalo!"
    }
    if (v._bReact > 0) { v._bReact -= dt; return 'r'; }
    return st;
  }
  if (v._bReact) v._bReact = 0;
  if (st === 'a') return p.aggr > 0.62 && v.l.e.len - v.s < 14 + v.v*1.6 ? 'g' : st;      // "it's still amber"
  const s = this.signals.j.get(node.i);
  if (s && p.jump > 0) {
    const nx = s.phases[(s.cur + 1) % s.phases.length], left = s.green + s.amber + s.allRed - s.t;
    if (left < p.jump && nx.links.has(v.l.e.i*2 + (v.l.dir > 0 ? 1 : 0))) return 'g';     // theirs is next and the others are stopping
  }
  const Y = this.yieldTo;
  if (Y && v.v < 2.5) {                                                                   // a siren behind them at a red: out of its way
    const dx = v.x - Y.x, dz = v.z - Y.z, al = dx*Y.hx + dz*Y.hz;
    if (al > 2 && al < 32 && Math.abs(-dx*Y.hz + dz*Y.hx) < 7 && v.hx*Y.hx + v.hz*Y.hz > 0.4) return 'g';
  }
  return st;
};

// ------------------------------------------------------------------ where across the road
const step = Traffic.prototype.step;
Traffic.prototype.step = function (v, dt) {
  if (v.T && !v.T._own && v.alive !== false) roll(this, v);
  v._bLead = null; v._bLg = 999;
  step.call(this, v, dt);
  const p = v._b;
  if (!p || !(dt > 0) || v.jc || v._out || v._bKerb || v.wreck || v.fallen > 0 || v.argue > 0 || !v.alive) return;
  if ((v._bT = (v._bT ?? h01(v.id, 21)*0.4) - dt) > 0) return;
  v._bT = 0.3 + h01(v.id, 22)*0.2;
  think(this, v, p);
};
function think(TR, v, p) {
  const T = v.T, e = v.l.e, hw = e.w/2 - 0.55, lo = e.oneway ? -hw : 0.45, hi = e.oneway ? hw : Math.max(0.6, hw);
  if (hi - lo < 0.3) return;
  const two = !!T.two, look = 7 + v.v*2.4;
  // asked to move over by the one behind: a little to the left if it's free
  if (v._bGive) {
    v._bGive = 0;
    const nl = Math.min(hi, v.lat + 0.9);
    if (nl - v.lat > 0.3) { const o2 = TR.scan(v, nl - v.lat, look); if (!o2 || o2.gap > 6) v.latT = nl; }
    return;
  }
  const lead = v._bLead, gap = v._bLg;
  if (!lead || lead.isPlayer && !two) return;              // (you in the way: temper.js and steer.js deal with that)
  const lv = Math.abs(lead.v || 0), des = v._bDes || 8, queue = lv < 1.5;
  if (!(gap < (two ? 7 : 11) && (queue || lv < des*(0.45 + 0.35*p.aggr)))) return;
  if (!two) {
    if (queue && !(lead._bKerb || lead.dwell > 0 || lead.parked)) return;       // a car in a queue stays in it (unless it's a stopped auto or bus)
    if (TR.rng.next() > 0.35 + p.aggr*(1 - p.disc*0.5)) return;
  }
  const ow = (lead.W ?? lead.T?.W ?? 1)/2, side = v._bLs || 0, half = T.W/2 + ow + 0.3, stepW = T.W + 0.35;
  // past its right first (the way people overtake here), then its left, then further over
  const c0 = v.lat + side - half, c1 = v.lat + side + half;
  let best = null, bestS = gap + (two ? 2.2 : 7);
  for (let k = 0; k < 4; k++) {
    const nl = k === 0 ? c0 : k === 1 ? c1 : k === 2 ? v.lat - stepW : v.lat + stepW;
    if (nl < lo || nl > hi || Math.abs(nl - v.lat) < 0.2) continue;
    if (!two && k > 1) break;
    const o2 = TR.scan(v, nl - v.lat, look + 8);
    const s = (o2 ? o2.gap : 50) - Math.abs(nl - v.lat)*0.6 + (k === 0 && !queue ? 1.5 : 0);
    if (s > bestS) { bestS = s; best = nl; }
  }
  if (best !== null) {
    v.latT = best; v._bT = 0.9;
    if (!queue && !two && TR.rng.next() < 0.6 - p.pat*0.4) hoot(TR, v, 1);     // a pip before pulling out
  } else if (!queue && lead._b && !lead._bKerb && p.pat < 0.6) {
    hoot(TR, v, 1);                                                             // can't get by: on the horn, and it may move over
    if (lead._b.aggr < 0.75) lead._bGive = 1;
  }
}
