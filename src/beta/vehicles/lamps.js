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
  };
  mesh.onAfterRender = function (r, sc, cam, geo, m, g) {
    a0 && a0.call(this, r, sc, cam, geo, m, g);
    const u = m && m.uniforms && m.uniforms.uLamp; if (!u) return;
    u.value.set(0, 0); m.uniformsNeedUpdate = true;
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
  }
  return r;
};
