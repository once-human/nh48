// Over the bonnet: Space with a car right in front of you and you vault it, the way anyone in a hurry does. Two
// steps in, a hand down flat on the bonnet, the hip turned and slid across it, the legs swung over together, and down
// on your feet on the far side, still moving. Only over a car you could really get over (a hatchback, a sedan, a
// supercar, not a bus, an auto or a tall jeep), only across it (not end to end), and only if there's room to land.
// (It rides on the climb's way in: the on-foot update hands over to stepClimb while it lasts.)
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { ikArm } from '@orig/people/humans.js';
import { carSpec } from '../vehicles/models.js';
import { free } from '../vehicles/mount.js';
import { grip } from '../vehicles/fit.js';

const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const NOT = /bus|pmpml|tempo|truck|auto|rickshaw|tractor|cycle|scooter|bike|activa|classic|zx|moped/;
const _t = new THREE.Vector3(), _p = new THREE.Vector3();

// what's within reach in front of you that can be vaulted: its box, how high its bonnet is, where you'd go in and out
function find(P, traffic) {
  const F = P.foot, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw);
  let best = null;
  const test = (o, x, z, hx, hz, L, W, kind) => {
    if (!kind || NOT.test(kind)) return;
    let S; try { S = carSpec(kind); } catch (e) { return; }
    const top = S && S.beltY; if (!top || top > 1.2) return;
    // the ray along where you face, through the box (slabs)
    const rx = F.x - x, rz = F.z - z, a0 = rx*hx + rz*hz, c0 = -rx*hz + rz*hx, da = fx*hx + fz*hz, dc = -fx*hz + fz*hx;
    let s0 = -1e9, s1 = 1e9;
    for (const [p, d, h] of [[a0, da, L/2], [c0, dc, W/2]]) {
      if (Math.abs(d) < 1e-6) { if (Math.abs(p) > h) return; continue; }
      let u = (-h - p)/d, v = (h - p)/d; if (u > v) [u, v] = [v, u];
      s0 = Math.max(s0, u); s1 = Math.min(s1, v);
    }
    if (s0 > s1 || s0 < 0.05 || s0 > 1.1 || s1 - s0 > 2.3) return;       // (in reach, and across it, not end to end)
    if (best && best.s0 < s0) return;
    best = { o, s0, s1, top };
  };
  if (traffic) traffic.near(F.x, F.z, 5, (o) => {
    if (o.parked) { const v = o.veh; test(o, o.x, o.z, o.hx, o.hz, o.L, o.W, v && (v.type || v.kind)); }
    else if (o.T && !o.T.two) test(o, o.x, o.z, o.hx, o.hz, o.T.L, o.T.W, o.type);
  });
  for (const dd of P.dropped || []) { const v = dd.veh; if (v && v.spec && !v.spec.two) test(v, v.x, v.z, Math.cos(v.th), Math.sin(v.th), v.spec.L, v.spec.W, v.type); }
  if (!best) return null;
  // somewhere to come down on the far side
  const lx = F.x + fx*(best.s1 + 0.5), lz = F.z + fz*(best.s1 + 0.5);
  if (!free(P, traffic, lx, lz, best.o)) return null;
  return best;
}

const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, input, traffic, camYaw) {
  const F = this.foot;
  if (F && !F.climb && !F.air && !F.swim && !this.downT && !this.act && !this.seated && !this.ko && input && input.pressed && input.pressed.has('Space')) {
    const b = find(this, traffic);
    if (b) {
      input.took('Space');
      const g = this.W.surf.height(F.x, F.z);
      F.climb = { vault: true, t: 0, x0: F.x, z0: F.z, y0: F.y, g, fx: Math.cos(F.yaw), fz: Math.sin(F.yaw), s0: b.s0, s1: b.s1, top: b.top, v0: Math.max(2.2, F.v || 0) };
      F.vx = F.vz = 0; F.v = 0;
      this.human.play('jump_start', { once: true, fade: 0.08, speed: 1.3 });
      this.events.push({ type: 'jump' });
    }
  }
  return upd.call(this, dt, input, traffic, camYaw);
};

const step = Pilot.prototype.stepClimb;
Pilot.prototype.stepClimb = function (dt) {
  const F = this.foot, C = F.climb, H = this.human;
  if (!C || !C.vault) return step.call(this, dt);
  C.t += dt;
  // the run in to the side of it, then over (the hip on the bonnet), then down
  const tA = Math.max(0.1, (C.s0 - 0.3)/C.v0), tB = 0.55, T = tA + tB;
  const g = C.g, top = C.top;
  let s, y = g, twist = 0, plant = 0;
  if (C.t < tA) { const u = C.t/tA; s = (C.s0 - 0.3)*u; y = g + 0.25*u*u; }
  else if (C.t < T) {
    const u = (C.t - tA)/tB, e = sm(u);
    s = C.s0 - 0.3 + (C.s1 - C.s0 + 0.75)*e;
    // the feet go up to about the bonnet's height less a hip, sliding across, and come down the far side
    y = g + 0.25 + (top - 0.3)*Math.sin(Math.PI*Math.min(1, u*1.05));
    twist = Math.sin(Math.PI*u)*1.15; plant = u < 0.7 ? Math.min(1, u*6) : Math.max(0, (1 - u)/0.3);
    if (!C.loop && u > 0.2) { H.play('jump_loop', { fade: 0.12 }); C.loop = true; }
  } else {
    // on your feet the other side, carrying on
    F.climb = null; F.air = true; F.vy = 0;
    F.vx = C.fx*C.v0*0.8; F.vz = C.fz*C.v0*0.8;
    return;
  }
  F.x = C.x0 + C.fx*s; F.z = C.z0 + C.fz*s; F.y = Math.max(y, this.W.surf.height(F.x, F.z));
  Object.assign(F.agent, { x: F.x, z: F.z, y: F.deck >= 0 ? F.y : 0, hx: C.fx, hz: C.fz, v: 0 });
  H.holder.position.set(F.x, F.y, F.z);
  // (side on to the bonnet as you slide across it)
  H.holder.rotation.set(0, -F.yaw - twist, 0);
  H.mixer.update(dt);
  if (this.postPose) this.postPose(H, dt);
  // the right hand down flat on the bonnet where you went over
  if (plant > 0) {
    H.holder.updateMatrixWorld(true);
    const px = C.x0 + C.fx*(C.s0 + 0.25), pz = C.z0 + C.fz*(C.s0 + 0.25);
    _t.set(px, g + top + 0.04, pz);
    _p.set(0, -1, 0);
    ikArm(H, 'r', _t, _p, plant);
    grip(H, 'r', 0.2*plant);
  }
};
