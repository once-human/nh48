// Up and over, like a body does it: the hands go up to the ledge and stay planted there while you haul yourself up,
// the feet walking up the face of it; once the edge is at your waist the arms straighten and push, you fold over the
// top and a knee comes up onto it, then you're up and over. Out of the river the same, onto the bank. (The game's
// climb clip is a short scramble that ran once and froze while the body slid up the wall.)
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { ikArm, bendBone } from '@orig/people/humans.js';
import { ikLeg } from './fists.js';
import { grip } from '../vehicles/fit.js';

const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k*k*(3 - 2*k); };
const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _r = new THREE.Vector3(), _f = new THREE.Vector3();

const start = Pilot.prototype.startClimb;
Pilot.prototype.startClimb = function (nx, nz, topY) {
  start.call(this, nx, nz, topY);
  // the scramble keeps going under the hands and feet (they're placed on the wall below)
  if (this.human) this.human.play('climb', { fade: 0.12, speed: 0.9 });
};

const step = Pilot.prototype.stepClimb;
Pilot.prototype.stepClimb = function (dt) {
  const F = this.foot, C = F.climb, H = this.human;
  step.call(this, dt);
  if (!C || !H || !F.climb) return;
  const t = C.t, T1 = 0.85*Math.max(1, (C.top - C.y0)/1.8), T2 = T1 + 0.4;
  const fx = C.nx, fz = C.nz, rx = -fz, rz = fx;
  // the wall's face and its top edge, from where you started
  const face = 0.3, edgeX = C.x0 + fx*face, edgeZ = C.z0 + fz*face;
  const rel = C.top - F.y;                        // how far the edge is above your feet now
  H.root.updateMatrixWorld(true);
  // the body: into the wall while hanging, folded over the top as you come up onto it
  const u = Math.min(1, t/T1), mantle = sm((u - 0.62)/0.3)*(1 - sm((t - T1)/(T2 - T1)));
  const lean = 0.22*(1 - mantle) + 0.62*mantle;
  _r.set(rx, 0, rz);
  const s1 = H.root.getObjectByName('spine_01'), s3 = H.root.getObjectByName('spine_03'), nk = H.root.getObjectByName('neck_01');
  if (s1) bendBone(s1, _r, -lean*0.55); if (s3) bendBone(s3, _r, -lean*0.4); if (nk) bendBone(nk, _r, lean*0.45);
  H.root.updateMatrixWorld(true);
  // the hands: up to the edge, planted there; they push down once it's at your waist and let go as you stand
  const reach = sm(t/0.18), let_go = sm((t - T1 - 0.05)/0.25), hw = Math.max(0, Math.min(1, (rel - 0.45)/0.2));
  const wH = reach*(1 - let_go)*(rel > 0.45 ? 1 : hw);
  if (wH > 0.01) for (const [sd, o] of [['l', -0.21], ['r', 0.21]]) {
    _t.set(edgeX + fx*0.05 + rx*o, C.top + 0.02, edgeZ + fz*0.05 + rz*o);
    // elbows out and back while hanging, behind the hands once you're pushing down on them
    const push = rel < 1.0;
    _p.set(rx*(sd === 'l' ? -0.7 : 0.7) - fx*(push ? 0.9 : 0.2), push ? 0.4 : -0.6, rz*(sd === 'l' ? -0.7 : 0.7) - fz*(push ? 0.9 : 0.2));
    ikArm(H, sd, _t, _p, wH); grip(H, sd, wH*0.7);
  }
  // the feet: walking up the face, one then the other; at the top the right knee comes up onto the edge
  if (t < T1) {
    const climbW = 1 - sm((u - 0.7)/0.2);
    for (const [sd, o, ph] of [['l', -0.12, 0], ['r', 0.12, Math.PI]]) {
      const lift = Math.max(0, Math.sin(t*7.5 + ph));
      const yF = Math.min(C.top - 0.15, F.y + 0.18 + lift*0.32);
      _t.set(C.x0 + fx*(face - 0.06) + rx*o, yF, C.z0 + fz*(face - 0.06) + rz*o);
      _p.set(fx, 0.4, fz);
      if (climbW > 0.01) ikLeg(H, sd, _t, _p, climbW);
    }
  }
  const knee = sm((u - 0.72)/0.22)*(1 - sm((t - T1 - 0.1)/0.25));
  if (knee > 0.01) {
    _t.set(edgeX + fx*0.12 + rx*0.1, C.top + 0.06, edgeZ + fz*0.12 + rz*0.1);
    _p.set(fx, 0.6, fz);
    ikLeg(H, 'r', _t, _p, knee);
  }
};
