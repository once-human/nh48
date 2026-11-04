// Small things that make people look alive. Everyone's head moves: they glance about now and then, and look at you
// when you come close (the old for longer, everyone when the police are after you), then look away again. And you:
// stand still a while and you fold your arms, or get your phone out, until you move again.
import * as THREE from 'three';
import { Crowd } from '@orig/people/crowd.js';
import { Pilot } from '@orig/game/pilot.js';
import { bendBone } from '@orig/people/humans.js';

const Y = new THREE.Vector3(0, 1, 0);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const OLD = new Set(['kaka', 'ajoba', 'kaku', 'aaji', 'aunty']);
const BUSY = new Set(['talk', 'phone', 'sit_talk', 'dance', 'drink', 'eat', 'pray', 'wave']);
const bone = (H, n) => (H._ab || (H._ab = {}))[n] || (H._ab[n] = H.root.getObjectByName(n));

Crowd.prototype.postPed = function (p, H, dt) {
  if (p.rideOf || p.fallen > 0 || p.ko || p.mode === 'fight' || p.mode === 'flee' || p.act) return;
  const G = window.__nhAskG, P = G && G.player; if (!P) return;
  const L = p._lk || (p._lk = { a: 0, want: 0, t: Math.random()*4, hold: 0 });
  L.t -= dt;
  const dx = P.x - p.x, dz = P.z - p.z, d = Math.hypot(dx, dz), rel = wrap(Math.atan2(dz, dx) - (p.yaw ?? 0));
  const wanted = G.police && G.police.heat > 0;
  // you, close and where they can see you: a look (longer from the old, from everyone if you're wanted)
  if (d < (wanted ? 12 : 5) && Math.abs(rel) < 1.9 && L.hold <= 0 && L.t <= 0 && !BUSY.has(p.anim)) {
    if (Math.random() < (wanted ? 0.9 : OLD.has(p.persona) ? 0.7 : 0.45)) L.hold = (OLD.has(p.persona) ? 3 : 1.6) + Math.random()*1.5;
    L.t = 3 + Math.random()*4;
  }
  if (L.hold > 0) { L.hold -= dt; L.want = Math.max(-1.1, Math.min(1.1, rel)); if (L.hold <= 0) L.want = 0; }
  else if (L.t <= 0) {
    // a glance about, then back
    L.want = L.want ? 0 : (Math.random() - 0.5)*1.4;
    L.t = L.want ? 0.8 + Math.random()*1.4 : 3 + Math.random()*6;
  }
  L.a += (L.want - L.a)*Math.min(1, dt*4);
  if (Math.abs(L.a) < 0.01) return;
  const hd = bone(H, 'Head'), nk = bone(H, 'neck_01');
  H.root.updateMatrixWorld(true);
  if (nk) bendBone(nk, Y, -L.a*0.35);
  if (hd) bendBone(hd, Y, -L.a*0.65);
};

// you, standing about (pilot.js plays it in place of idle: PATCHES)
const FIDGET = ['arms_folded', 'phone', 'arms_folded'];
const upd = Pilot.prototype.updateFoot;
Pilot.prototype.updateFoot = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), F = this.foot, H = this.human;
  if (!H) return out;
  const G = window.__nhAskG, still = F && F.v < 0.1 && !this.act && !this.seated && !F.air && !F.swim && !this.downT && !(G && G.brawl && (G.brawl.active > 0 || G.brawl.guarding)) && !this._walk;
  this._idleT = still ? (this._idleT || 0) + dt : 0;
  if (this._idleT > 8 && !this._fid) { this._fid = FIDGET[Math.floor(Math.random()*FIDGET.length)]; this._fidT = 5 + Math.random()*5; }
  if (this._fid) {
    this._fidT -= dt;
    if (!still || this._fidT <= 0) { this._fid = null; if (still) this._idleT = 2; }
  }
  return out;
};
