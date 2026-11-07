// Bodies take up room. People step round each other instead of walking through (a crowd at a stall stands shoulder
// to shoulder, not inside one another); a cow is half a tonne that people walk round; cows and dogs don't walk into
// cars, autos, parked scooters, poles or each other (they stop, or edge round), and you can't walk through them either.
// (Nothing kept anyone apart but walls: a cow walked through the traffic, people stood inside each other.)
import { People } from '@orig/people/peds.js';

const R_PED = 0.26;                         // a person, shoulder to shoulder
const TMP = [0, 0, 0, 0];
// an animal as circles along its length: [offset along it, radius] (a cow ~2.1 m nose to tail, ~0.65 m across the belly)
const SHAPE = { cow: [[0.72, 0.3], [0.12, 0.33], [-0.5, 0.31]], dog: [[0.12, 0.26]], cat: [[0, 0.16]] };
const shapeOf = (a) => SHAPE[a.cow ? 'cow' : a.kind || 'dog'] || SHAPE.dog;

// move an animal by (dx, dz): along its path and across it if it's on one, straight if it's loose (following you)
function shove(P, a, dx, dz) {
  if (a.free || !a.e) { a.x += dx; a.z += dz; return; }
  P.g.at(a.e, a.s, TMP);
  a.s += dx*TMP[2] + dz*TMP[3];
  const dl = dx*TMP[3] - dz*TMP[2];
  a.lat += dl;
  // (a cow ambles to where it's told, beta/people/cows.js: a push moves her at once and she gives up going that way. It only
  // moved where she was going, so the wall went on pushing frame after frame until she shot off down the road.)
  if (a._latS !== undefined) { a._latS += dl; a.lat = a._latS; }
  if (a.e.len) a.s = Math.max(0.5, Math.min(a.e.len - 0.5, a.s));
  P.placeAnimal(a);
}
// move a person by (dx, dz) the way they're being moved: the walkers' sidestep offset (it eases back), others bodily
function nudge(p, dx, dz) {
  if (p.mode === 'walk' || p.mode === 'cross') { p.dodgeX += dx; p.dodgeZ += dz; }
  else if (p.mode === 'stand' && p.anchor) { p.anchor.x += dx; p.anchor.z += dz; p.x += dx; p.z += dz; }
  else { p.x += dx; p.z += dz; }
}
const still = (p) => p.hidden || p.fixed || p.pax || p.ctl || p.dead || p.corpse || p.seated || p.mode === 'inside' || p.rideOf || p.lift || p.duty;

// how far a circle at (cx, cz) radius r is into your vehicle's box: [depth, nx, nz] (normal out of the box), or null
function intoBox(V, L, W, cx, cz, r) {
  const hx = Math.cos(V.th), hz = Math.sin(V.th), rx = cx - V.x, rz = cz - V.z;
  const al = rx*hx + rz*hz, ac = -rx*hz + rz*hx;
  const qa = Math.max(-L/2, Math.min(L/2, al)), qc = Math.max(-W/2, Math.min(W/2, ac));
  let da = al - qa, dc = ac - qc, d = Math.hypot(da, dc);
  if (d >= r) return null;
  if (d < 1e-4) {            // the middle inside the box: out through the nearest side
    const pa = L/2 - Math.abs(al), pc = W/2 - Math.abs(ac);
    if (pa < pc) { da = Math.sign(al) || 1; dc = 0; d = -pa; } else { da = 0; dc = Math.sign(ac) || 1; d = -pc; }
    return [r - d, da*hx - dc*hz, da*hz + dc*hx];
  }
  da /= d; dc /= d;
  return [r - d, da*hx - dc*hz, da*hz + dc*hx];
}
// your vehicle has hit this animal: its body (the circles above) touches the vehicle's box
People.prototype.vehTouches = function (a, player) {
  const V = player.cur, S = player.spec; if (!V || !S) return false;
  const hx = Math.cos(a.yaw || 0), hz = Math.sin(a.yaw || 0);
  for (const [o, r] of shapeOf(a)) if (intoBox(V, S.L || 4, S.W || 1.7, a.x + hx*o, a.z + hz*o, r + 0.04)) return true;
  return false;
};

const upd = People.prototype.update;
People.prototype.update = function (dt, player, avoidView) {
  upd.call(this, dt, player, avoidView);
  if (!player || dt <= 0) return;
  const px = player.x, pz = player.z, RAD = 45;
  // ---- people round each other (a grid of 1 m cells, only near you)
  const near = [];
  for (const p of this.list) if (!still(p) && Math.abs(p.x - px) < RAD && Math.abs(p.z - pz) < RAD) near.push(p);
  const cell = new Map(), key = (x, z) => (Math.floor(x) & 0xffff) << 16 | (Math.floor(z) & 0xffff);
  near.forEach((p, i) => { p._bi = i; const k = key(p.x, p.z); const c = cell.get(k); if (c) c.push(p); else cell.set(k, [p]); });
  const D = R_PED*2;
  for (const p of near) {
    const cx = Math.floor(p.x), cz = Math.floor(p.z);
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
      const c = cell.get(((cx + ix) & 0xffff) << 16 | ((cz + iz) & 0xffff)); if (!c) continue;
      for (const q of c) {
        if (q._bi <= p._bi) continue;                    // each pair once
        const dx = q.x - p.x, dz = q.z - p.z, d2 = dx*dx + dz*dz;
        if (d2 >= D*D) continue;
        let d = Math.sqrt(d2), nx, nz;
        if (d < 1e-4) { const a = (p._bi*2.399) % 6.283; nx = Math.cos(a); nz = Math.sin(a); d = 0; } else { nx = dx/d; nz = dz/d; }
        // gently: a step aside over a few frames, not a shove (someone lying on the road isn't moved)
        const push = Math.min(D - d, 0.4)*Math.min(1, dt*9)*0.5;
        if (!(p.fallen > 0)) nudge(p, -nx*push, -nz*push);
        if (!(q.fallen > 0)) nudge(q, nx*push, nz*push);
      }
    }
  }
  // ---- the animals: against people, vehicles, poles and walls, each other, and you
  const T = this.traffic || (window.__nhAskG && window.__nhAskG.traffic), W = this.W, P = player.onFoot ? player : null;
  const an = this.animals.filter((a) => !a.dead && !a.gone && Math.abs(a.x - px) < RAD && Math.abs(a.z - pz) < RAD);
  for (const a of an) {
    const hx = Math.cos(a.yaw || 0), hz = Math.sin(a.yaw || 0), sh = shapeOf(a);
    for (const [o, r] of sh) {
      const cx = a.x + hx*o, cz = a.z + hz*o;
      // people walk round it (it doesn't move for them)
      const k0x = Math.floor(cx), k0z = Math.floor(cz);
      for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
        const c = cell.get(((k0x + ix) & 0xffff) << 16 | ((k0z + iz) & 0xffff)); if (!c) continue;
        for (const p of c) {
          const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), m = r + R_PED;
          if (d >= m || d < 1e-4 || p.fallen > 0) continue;
          nudge(p, dx/d*(m - d)*Math.min(1, dt*12), dz/d*(m - d)*Math.min(1, dt*12));
        }
      }
      // you can't walk through it either (your body, 0.26 across the shoulders, against hers)
      if (P && P.foot) {
        const F = P.foot, dx = F.x - cx, dz = F.z - cz, d = Math.hypot(dx, dz), m = r + R_PED;
        if (d < m && d > 1e-4) { F.x += dx/d*(m - d); F.z += dz/d*(m - d); }
      }
      // nor ride through her: rolling slowly into a cow stops you against her body; a dog or a cat is nudged aside
      if (!player.onFoot && player.cur && player.spec) {
        const V = player.cur, S = player.spec, hit = intoBox(V, S.L || 4, S.W || 1.7, cx, cz, r);
        if (hit) {
          const [dep, nx, nz] = hit;
          if (a.cow) {
            V.x -= nx*dep; V.z -= nz*dep;
            const into = (V.v || 0)*(Math.cos(V.th)*nx + Math.sin(V.th)*nz);
            if (into > 0) V.v = 0;
          } else shove(this, a, nx*dep, nz*dep);
        }
      }
      // poles, walls, parked two-wheelers and cars: edged round
      const res = W.collision.resolve(cx, cz, r);
      if (res && res.depth > 0.01) { shove(this, a, res.nx*res.depth, res.nz*res.depth); if (a.moving && !a.free) { a.moving = false; a.rest = 2 + Math.random()*4; } }
    }
    // the traffic: a vehicle's box. An animal walking into one stops (and turns back now and then); one stood in a
    // vehicle's way is pushed clear of it rather than through it
    if (T) T.near(a.x, a.z, 5, (o) => {
      if (o.isPlayer || o.wreck && !o.T) return;
      const L = (o.T ? o.T.L : o.L) || 4, Wd = (o.T ? o.T.W : o.W) || 1.8, ohx = o.hx ?? Math.cos(o.yaw || 0), ohz = o.hz ?? Math.sin(o.yaw || 0);
      for (const [off, r] of sh) {
        const cx = a.x + hx*off - o.x, cz = a.z + hz*off - o.z;
        const al = cx*ohx + cz*ohz, ac = -cx*ohz + cz*ohx;
        const hl = L/2 + r, hw = Wd/2 + r;
        if (Math.abs(al) >= hl || Math.abs(ac) >= hw) continue;
        const pa = hl - Math.abs(al), pc = hw - Math.abs(ac);
        let dx, dz;
        if (pa < pc) { const s = Math.sign(al) || 1; dx = ohx*s*pa; dz = ohz*s*pa; } else { const s = Math.sign(ac) || 1; dx = -ohz*s*pc; dz = ohx*s*pc; }
        shove(this, a, dx*Math.min(1, dt*14), dz*Math.min(1, dt*14));
        if (a.moving && !a.free && (dx*hx + dz*hz) < 0) { a.moving = false; a.rest = 2 + Math.random()*5; if (Math.random() < 0.4) a.dir = -a.dir; }
        break;
      }
    });
  }
  // and each other (a dog doesn't walk through a cow)
  for (let i = 0; i < an.length; i++) for (let j = i + 1; j < an.length; j++) {
    const a = an[i], b = an[j], dx = b.x - a.x, dz = b.z - a.z;
    if (Math.abs(dx) > 2.5 || Math.abs(dz) > 2.5) continue;
    const ra = a.cow ? 0.7 : 0.3, rb = b.cow ? 0.7 : 0.3, d = Math.hypot(dx, dz), m = ra + rb;
    if (d >= m || d < 1e-4) continue;
    const push = (m - d)*Math.min(1, dt*8), wa = a.cow && !b.cow ? 0.1 : b.cow && !a.cow ? 0.9 : 0.5;
    shove(this, a, -dx/d*push*wa, -dz/d*push*wa); shove(this, b, dx/d*push*(1 - wa), dz/d*push*(1 - wa));
  }
};
