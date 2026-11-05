// Getting into a car like you'd have to. You walk the whole way to its door, however far you were standing. The
// driver's door up against a wall or another car: you go round to the other one and climb across. Locked (about
// half the parked cars, and some drivers who see you coming): an elbow through the window first, glass on the
// road. A locked parked car has no key in it either: you lean in under the steering and wire it, a few sparks,
// then it catches.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { bendBone, ikArm } from '@orig/people/humans.js';
import { free } from './mount.js';

const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _r = new THREE.Vector3();
const hash = (x, z) => { const s = Math.sin(x*12.9898 + z*78.233)*43758.5453; return s - Math.floor(s); };

const enter = Pilot.prototype.enter;
Pilot.prototype.enter = function (offer, traffic) {
  const was = this.entering;
  const out = enter.call(this, offer, traffic);
  const E = this.entering;
  if (!E || E === was || E.cd) return out;
  E.cd = true;
  const src = E.src, hx = src.hx ?? Math.cos(src.th), hz = src.hz ?? Math.sin(src.th);
  // the driver's door blocked: the passenger door (the same spot across the car), and over the gear stick
  if (!free(this, traffic, E.door.x, E.door.z, src)) {
    const vx = E.door.x - src.x, vz = E.door.z - src.z, al = vx*hx + vz*hz, la = -vx*hz + vz*hx;
    const p = { x: src.x + hx*al + hz*la, z: src.z + hz*al - hx*la };
    if (free(this, traffic, p.x, p.z, src)) { E.door = p; this.puppet = p; E.pass = true; E.hold = 0.65; }
  }
  // locked
  E.locked = offer.kind === 'parked' ? hash(src.x, src.z) < 0.55 : offer.kind === 'traffic' ? Math.random() < 0.3 : false;
  E.wire = E.locked && offer.kind === 'parked';
  const F = this.foot;
  E.max = Math.max(1.6, Math.hypot(E.door.x - F.x, E.door.z - F.z)/1.5 + 0.5);
  E.real = 0;
  return out;
};

// glass on the road
const shards = [];
function smash(P, E) {
  const A = P.audio;
  if (A) {
    A.noiseBurst?.(0.16, 4800, 0.9, 0.7);
    for (let i = 0; i < 7; i++) A.tone?.('triangle', [2400 + Math.random()*2200], 0.05, 0.06, 0, 0.04 + i*0.035 + Math.random()*0.03);
  }
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xbfd6dc, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.8 });
  const geo = new THREE.BoxGeometry(0.035, 0.004, 0.025);
  const y = (E.src.y || 0) + 1.05, dx = E.door.x - E.src.x, dz = E.door.z - E.src.z, d = Math.hypot(dx, dz) || 1;
  for (let i = 0; i < 28; i++) {
    const s = new THREE.Mesh(geo, m);
    s.position.set(E.door.x - dx/d*0.4, y, E.door.z - dz/d*0.4);
    s.userData.v = new THREE.Vector3(dx/d*(0.5 + Math.random()*1.5) + (Math.random() - 0.5), Math.random()*1.4, dz/d*(0.5 + Math.random()*1.5) + (Math.random() - 0.5));
    s.userData.w = (Math.random() - 0.5)*20;
    g.add(s);
  }
  P.scene.add(g);
  shards.push({ g, t: 0, ground: E.src.y || 0, geo, m });
}
const doors = Pilot.prototype.tickDoors;
Pilot.prototype.tickDoors = function (dt) {
  doors.call(this, dt);
  // the opening shows once the door is off the body, and goes as it shuts
  if (this.doors) for (const D of this.doors) if (D.hole) D.hole.visible = D.pivot.rotation.y > 0.06;
  for (let i = shards.length - 1; i >= 0; i--) {
    const S = shards[i]; S.t += dt;
    for (const s of S.g.children) {
      const v = s.userData.v;
      if (s.position.y > S.ground + 0.01) { v.y -= 9.8*dt; s.position.addScaledVector(v, dt); s.rotation.x += s.userData.w*dt; s.rotation.z += s.userData.w*0.7*dt; }
      if (s.position.y <= S.ground + 0.01) { s.position.y = S.ground + 0.01; v.set(0, 0, 0); s.rotation.x = 0; s.rotation.z = 0; }
    }
    if (S.t > 25) { S.g.parent && S.g.parent.remove(S.g); S.geo.dispose(); S.m.dispose(); shards.splice(i, 1); }
  }
};

// the far door hangs on the other side: the same door, mirrored across the car
const openDoor = Pilot.prototype.openDoor;
Pilot.prototype.openDoor = function (src, kind) {
  const D = openDoor.call(this, src, kind), E = this.entering;
  // the dark of the cabin stays where the door was, on the car (it swung out with the door, so the car's own painted
  // door showed behind the one opening: two doors). Just proud of the body, so the painted one is covered once it moves
  const hole = D.hole, g = hole && hole.parent;
  if (g) {
    const stay = new THREE.Group(); stay.position.copy(D.pivot.position);
    g.remove(hole); stay.add(hole); hole.position.z = 0.035; hole.scale.set(1.04, 1.03, 1);
    hole.visible = false; D.pivot.parent.add(stay); D.stay = stay;
  }
  if (E && E.pass && E.src === src) {
    const m = new THREE.Group(); m.scale.z = -1;
    D.root.remove(D.pivot); if (D.stay) { D.root.remove(D.stay); m.add(D.stay); } m.add(D.pivot); D.root.add(m);
  }
  return D;
};

const tick = Pilot.prototype.tickEnter;
Pilot.prototype.tickEnter = function (dt) {
  const E = this.entering, F = this.foot, H = this.human;
  if (!E.cd) return tick.call(this, dt);
  E.real += dt;
  const near = Math.hypot(F.x - E.door.x, F.z - E.door.z) < 0.45;
  // all the way to the door, not giving up at a second and a half
  if (E.phase === 'walk' && !near && E.real < E.max) E.t = Math.min(E.t, 1.5);
  const at = near || E.t > 1.6 || E.real >= E.max;
  const face = () => { F.yaw = Math.atan2(E.src.z - F.z, E.src.x - F.x); H.holder.rotation.set(0, -F.yaw, 0); };
  if (E.phase === 'walk' && at && E.locked && !E.broke) {
    E.phase = 'smash'; E.ts = 0; this.puppet = null; face();
    H.play('hook', { once: true, fade: 0.08, restart: true, speed: 1.15 });
    if (E.offer.kind === 'traffic') { E.offer.o.v = 0; E.offer.o.argue = 6; }
  }
  if (E.phase === 'smash') {
    E.ts += dt;
    if (E.ts > 0.3 && !E.broke) { E.broke = true; smash(this, E); this.events.push({ type: 'glass', x: E.door.x, z: E.door.z }); }
    if (E.ts > 0.8) { E.phase = 'walk'; E.t = 9; }
    return;
  }
  if (E.phase === 'wire') {
    E.tw += dt;
    lean(this, E, 0.75, true);
    if (Math.random() < dt*6) this.audio?.noiseBurst?.(0.03, 3200 + Math.random()*1500, 5, 0.22);
    if (E.tw > 2.4) { E.wire = false; E.phase = 'open'; E.t2 = 0.44; this.audio?.ignition?.(); }
    return;
  }
  if (E.phase === 'open') {
    // past the door: the wires under the steering first, or over to the driver's seat
    if (E.wire && E.t2 > 0.3) { E.phase = 'wire'; E.tw = 0; this.hud?.toast?.('Hotwiring', 'no key in this one', 'info', 2.2); return; }
    if (E.pass && E.hold > 0 && E.t2 > 0.3) { E.hold -= dt; E.t2 -= dt; lean(this, E, 1 - E.hold/0.65, false); }
  }
  return tick.call(this, dt);
};

// bent in at the open door: the body forward into the cabin, the hands down under the dash (wiring) or on the seat
function lean(P, E, k, wire) {
  const H = P.human, F = P.foot; if (!H) return;
  const w = Math.min(1, k*3);
  const dx = E.src.x - F.x, dz = E.src.z - F.z, d = Math.hypot(dx, dz) || 1;
  _r.set(-dz/d, 0, dx/d);
  H.root.updateMatrixWorld(true);
  const sp = H.root.getObjectByName('spine_01'), sp3 = H.root.getObjectByName('spine_03');
  if (sp) bendBone(sp, _r, -0.55*w);
  if (sp3) bendBone(sp3, _r, -0.25*w);
  H.root.updateMatrixWorld(true);
  const y = (E.src.y || 0) + (wire ? 0.55 : 0.6);
  for (const s of ['l', 'r']) {
    const o = (s === 'l' ? 1 : -1)*0.13, j = wire ? Math.sin(E.tw*9 + (s === 'l' ? 0 : 2))*0.03 : 0;
    _t.set(F.x + dx/d*0.75 + _r.x*o + j, y + j, F.z + dz/d*0.75 + _r.z*o);
    _p.set(_r.x*(s === 'l' ? 1 : -1), -1, _r.z*(s === 'l' ? 1 : -1));
    ikArm(H, s, _t, _p, w);
  }
}
