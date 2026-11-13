// The lamps at the back say what the driver's doing, yours and everyone's: the red ones a dim tail lamp after dark and
// bright the moment the brakes go on (and held on, stopped at a signal), the white one only in reverse; the small amber
// ones stay as they are. Nobody in it, it's dark. Drawn in the vehicle shader (beta/vehicles/vehmat.js) from a
// brake/reverse pair: per instance for the traffic, per draw for the one-off vehicles (yours, your own auto, ones left
// standing).
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { PlayerAuto } from '@orig/vehicles/player.js';
import { Traffic } from '@orig/traffic/traffic.js';

const G0 = () => window.__nhAskG;
// [brake, reverse] for a vehicle you could be driving: -1 when nobody's in it
function stateOf(v) {
  const G = G0(), P = G && G.player;
  const driven = P && !P.onFoot && P.cur === v;
  // a police jeep, an ambulance: someone's driving it, and it brakes like the traffic does
  if (!driven && v.service) return v._lampSvc || (v._lampSvc = [0, 0]);
  if (!driven) return v._lampHeld || (v._lampHeld = [-1, 0]);
  const brk = (v.brake || 0) > 0.1 && !v.reverse || (Math.abs(v.v || 0) < 0.3 && (v.brake || 0) > 0.05) ? 1 : 0;
  return [brk, v.reverse ? 1 : 0];
}
function hook(mesh, v) {
  if (!mesh || mesh._lampHook) return;
  mesh._lampHook = true;
  const b0 = mesh.onBeforeRender, a0 = mesh.onAfterRender;
  mesh.onBeforeRender = function (r, sc, cam, geo, m, g) {
    b0 && b0.call(this, r, sc, cam, geo, m, g);
    const u = m && m.uniforms && m.uniforms.uLamp; if (!u) return;
    const L = stateOf(v); u.value.set(L[0], L[1]); m.uniformsNeedUpdate = true;
    // (its headlamps: yours go by your switch, coming up and dying away with it)
    const G = G0(), P = G && G.player, h = m.uniforms.uHd; if (h) { if (P && !P.onFoot && P.cur === v) h.value.set(G.lights ? G.lights.hk ?? 1 : 1, 1); else h.value.set(1, 0); }
  };
  mesh.onAfterRender = function (r, sc, cam, geo, m, g) {
    a0 && a0.call(this, r, sc, cam, geo, m, g);
    const u = m && m.uniforms && m.uniforms.uLamp; if (!u) return;
    u.value.set(0, 0); m.uniformsNeedUpdate = true;
    if (m.uniforms.uHd) m.uniforms.uHd.value.set(1, 0);
  };
}
const vs = Vehicle.prototype.sync;
Vehicle.prototype.sync = function (dt = 0) {
  hook(this.bodyMesh, this);
  if (this.service && dt > 0) {
    const sp = Math.abs(this.v || 0), want = (this._spL ?? sp) - sp > 1.2*dt || sp < 0.3;
    this._brkT = want ? 0.4 : Math.max(0, (this._brkT || 0) - dt); this._spL = sp;
    (this._lampSvc || (this._lampSvc = [0, 0]))[0] = this._brkT > 0 ? 1 : 0;
  }
  return vs.call(this, dt);
};
const as = PlayerAuto.prototype.sync;
PlayerAuto.prototype.sync = function (dt = 0) { hook(this.bodyMesh, this); return as.call(this, dt); };

// the traffic: brakes on when it slows hard or stands (held on a moment, so they don't flicker), none on a wreck
const step = Traffic.prototype.step;
Traffic.prototype.step = function (v, dt) {
  const v0 = v.v || 0, r = step.call(this, v, dt);
  if (dt > 0) {
    const sp = v.v || 0, want = !v.wreck && !v.parked && ((v0 - sp)/dt > 1.2 || sp < 0.3);
    v._brkT = want ? 0.4 : Math.max(0, (v._brkT || 0) - dt);
    v._brk = v.wreck ? -1 : v._brkT > 0 ? 1 : 0;
    // turning at the next junction: the indicator on, from about 35 m before it till they're round; moving across to
    // pass something or into another lane, on for that and a moment after; each car blinking in its own time, not the
    // whole street together (a fifth of drivers never bother; an auto's driver sticks a hand out instead, so nothing)
    const n = v.next, len = v.l && v.l.e ? v.l.e.len : 0, left = len - (v.s || 0), h = ((v.id || 0)*2654435761 >>> 0), lazy = h%5 === 0;
    const turn = n && Math.abs(n.turn || 0) > 0.5 && Math.abs(n.turn) < 2.6 ? Math.sign(n.turn) : 0;
    const dl = (v.latT ?? v.lat ?? 0) - (v.lat ?? 0);
    let ind = 0;
    if (!lazy && !v.wreck && turn && (v.jc || left < 35)) ind = turn > 0 ? 2 : 1;
    else if (!lazy && !v.wreck && !v.jc && Math.abs(dl) > 0.45 && (v.v || 0) > 1.2) { ind = dl > 0 ? 1 : 2; v._indH = 1.2; v._indS = ind; }
    else if ((v._indH = Math.max(0, (v._indH || 0) - dt)) > 0) ind = v._indS || 0;
    v._ind = ind ? -(ind + (h%997)/997*0.9) : 0;
  }
  return r;
};
