// Chase / far chase / driver's-seat cameras with lag, speed FOV, wall avoidance and shake.
import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, wrapAngle } from '../core/util.js';

const _eye = new THREE.Vector3(), _tgt = new THREE.Vector3(), _up = new THREE.Vector3();

export class CameraRig {
  constructor(camera, W) {
    this.cam = camera; this.W = W;
    this.mode = 0;              // 0 chase, 1 far chase, 2 driver's seat
    this.yaw = 0; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.orbit = 0; this.orbitT = 0; this.pitchOff = 0;
    this.shakeAmp = 0; this.fov = 62;
    this.lookBack = false;
    this.inited = false;
    this.traffic = null;        // set by main: lets the chase camera dodge buses and trucks
  }
  setMode(m) { this.mode = m % 3; this.inited = false; }
  shake(a) { this.shakeAmp = Math.min(0.6, this.shakeAmp + a); }
  drag(dx, dy) {
    if (this.footMode) { this.footYaw += dx * 0.006; this.footPitch = clamp(this.footPitch + dy * 0.004, -0.25, 0.9); this.orbitT = 1.2; return; }
    this.orbit = clamp(this.orbit + dx * 0.006, -Math.PI, Math.PI); this.pitchOff = clamp(this.pitchOff + dy * 0.004, -0.3, 0.6); this.orbitT = 1.6;
  }
  // on foot: a shoulder camera you turn with the mouse; it drifts back behind you as you walk
  updateFoot(dt, p) {
    const cam = this.cam;
    p.setCockpit && p.setCockpit(false);
    this.setNear(0.1);
    if (!this.footMode) { this.footMode = true; this.footYaw = p.th; this.footPitch = 0.22; this.pos.set(p.x - Math.cos(p.th) * 3.5, p.y + 2.2, p.z - Math.sin(p.th) * 3.5); }
    if (this.orbitT > 0) this.orbitT -= dt;
    else if (Math.abs(p.v) > 1.0) this.footYaw = dampAngle(this.footYaw, p.th, 0.9, dt);
    const yaw = this.footYaw + (this.lookBack ? Math.PI : 0), pitch = this.footPitch;
    const dist = 3.6 + Math.min(1.2, Math.abs(p.v) * 0.12);
    const tx = p.x, tz = p.z, ty = p.y + 1.5;
    let cx = tx - Math.cos(yaw) * dist * Math.cos(pitch), cz = tz - Math.sin(yaw) * dist * Math.cos(pitch);
    const tw = this.W.collision.ray(tx, tz, cx, cz), tv = this.vehicleRay(tx, tz, cx, cz);
    const t = Math.min(tw, tv);
    if (t < 1) { const k = Math.max(0.15, t * 0.9); cx = tx + (cx - tx) * k; cz = tz + (cz - tz) * k; }
    const cy = ty + dist * Math.sin(pitch) * (t < 1 ? Math.max(0.4, t) : 1);
    this.pos.x = damp(this.pos.x, cx, 12, dt); this.pos.z = damp(this.pos.z, cz, 12, dt); this.pos.y = damp(this.pos.y, cy, 10, dt);
    cam.position.copy(this.pos);
    cam.up.set(0, 1, 0);
    // look slightly to the right of the head, over the shoulder
    this.look.set(tx + Math.sin(yaw) * -0.35, ty, tz + Math.cos(yaw) * 0.35);
    cam.lookAt(this.look);
    this.setFov(dt, 58 + Math.abs(p.v) * 0.8);
    this.applyShake(dt);
  }

  update(dt, p) {
    if (p.onFoot) return this.updateFoot(dt, p);
    if (this.footMode) { this.footMode = false; this.inited = false; }
    const cam = this.cam;
    const th = p.th;
    if (this.orbitT > 0) this.orbitT -= dt; else { this.orbit = damp(this.orbit, 0, 2.5, dt); this.pitchOff = damp(this.pitchOff, 0, 2.5, dt); }
    const speed = Math.abs(p.v);
    const E = p.cockpitEye;
    if (this.mode === 2 && E) {
      // driver's seat: eyes above the seat; the view rides on the body (roll, pitch, wheel lift, tip-over)
      p.setCockpit(true);
      this.setNear(0.05);
      const m = p.tilt.matrixWorld;
      p.tilt.updateWorldMatrix(true, false);
      const yaw = this.orbit + (this.lookBack ? Math.PI : 0);
      const pitch = (p.inAuto ? -0.17 : -0.09) + this.pitchOff * 0.6;
      const ex = E[0] - (this.lookBack ? 0.1 : 0), ey = E[1], ez = E[2];
      _eye.set(ex, ey, ez).applyMatrix4(m);
      _tgt.set(ex + Math.cos(yaw) * Math.cos(pitch) * 10, ey + Math.sin(pitch) * 10, ez + Math.sin(yaw) * Math.cos(pitch) * 10).applyMatrix4(m);
      _up.set(0, 1, 0).transformDirection(m);
      cam.position.copy(_eye);
      cam.up.copy(_up);
      cam.lookAt(_tgt);
      this.setFov(dt, (p.inAuto ? 78 : 70) + speed * 0.3);
      this.applyShake(dt);
      return;
    }
    p.setCockpit(false);
    this.setNear(0.3);
    const far = this.mode === 1;
    const big = p.camDist || 0;
    // framing like Slow Roads: the vehicle sits low in the frame with the road opening up ahead
    const dist = (far ? 8.6 : 6.2) + speed * 0.07 + big;
    const height = (far ? 3.3 : 2.45) + speed * 0.015 + this.pitchOff * 4 + big * 0.35;
    if (!this.inited) { this.yaw = th; this.inited = true; this.pos.set(p.x - Math.cos(th) * dist, p.y + height, p.z - Math.sin(th) * dist); }
    // heading lag: the camera swings behind the auto smoothly
    this.yaw = dampAngle(this.yaw, th, speed > 0.5 ? 3.2 : 1.6, dt);
    const yaw = this.yaw + this.orbit + (this.lookBack ? Math.PI : 0);
    const tx = p.x + Math.cos(th) * (0.6 + speed * 0.06), tz = p.z + Math.sin(th) * (0.6 + speed * 0.06), ty = p.y + 1.25;
    let cx = tx - Math.cos(yaw) * dist, cz = tz - Math.sin(yaw) * dist;
    // keep the camera out of buildings, and out of buses / trucks / cars parked on our tail
    const tw = this.W.collision.ray(tx, tz, cx, cz);
    const tv = this.vehicleRay(tx, tz, cx, cz);
    const t = Math.min(tw, tv);
    if (t < 1) { const k = Math.max(0.22, t * 0.9); cx = tx + (cx - tx) * k; cz = tz + (cz - tz) * k; }
    const cy = ty + height - 1.25 + (t < 1 ? (tv < tw ? 1.1 : 0.6) * (1 - t) : 0);
    this.pos.x = damp(this.pos.x, cx, 9, dt); this.pos.z = damp(this.pos.z, cz, 9, dt); this.pos.y = damp(this.pos.y, cy, 6, dt);
    cam.position.copy(this.pos);
    cam.up.set(0, 1, 0);
    this.look.set(tx + Math.cos(th) * 1.6, ty + 0.35, tz + Math.sin(th) * 1.6);
    cam.lookAt(this.look);
    this.setFov(dt, 60 + speed * 0.65);
    this.applyShake(dt);
  }
  setNear(n) {
    if (this.cam.near !== n) { this.cam.near = n; this.cam.updateProjectionMatrix(); }
  }
  // first hit of the segment a→b against padded vehicle footprints (two-wheelers and people ignored)
  vehicleRay(ax, az, bx, bz) {
    const T = this.traffic;
    if (!T) return 1;
    const dx = bx - ax, dz = bz - az;
    let best = 1;
    T.near((ax + bx) / 2, (az + bz) / 2, Math.hypot(dx, dz) / 2 + 7, (o) => {
      if (!o.T || o.isPlayer || o.T.two) return;
      const hx = o.hx, hz = o.hz, L2 = o.T.L / 2 + 0.45, W2 = o.T.W / 2 + 0.45;
      const rx = ax - o.x, rz = az - o.z;
      // slab test in the vehicle's frame
      let t0 = 0, t1 = 1;
      for (let k = 0; k < 2; k++) {
        const s0 = k ? -rx * hz + rz * hx : rx * hx + rz * hz;
        const d = k ? -dx * hz + dz * hx : dx * hx + dz * hz;
        const h = k ? W2 : L2;
        if (Math.abs(d) < 1e-6) { if (Math.abs(s0) > h) return; continue; }
        let ta = (-h - s0) / d, tb = (h - s0) / d;
        if (ta > tb) { const q = ta; ta = tb; tb = q; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) return;
      }
      if (t0 < best) best = t0;
    });
    return best;
  }
  setFov(dt, f) {
    this.fov = damp(this.fov, f, 3, dt);
    if (Math.abs(this.cam.fov - this.fov) > 0.05) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
  applyShake(dt) {
    if (this.shakeAmp > 0.001) {
      const a = this.shakeAmp;
      this.cam.position.x += (Math.random() - 0.5) * a * 0.3;
      this.cam.position.y += (Math.random() - 0.5) * a * 0.3;
      this.cam.rotateZ((Math.random() - 0.5) * a * 0.04);
      this.shakeAmp *= Math.exp(-dt * 6);
    }
  }
}
