import * as THREE from 'three';
import { PlayerAuto } from '../../src/vehicles/player.js';
const mats = { solid: new THREE.MeshBasicMaterial(), glass: new THREE.MeshBasicMaterial(), body: new THREE.MeshBasicMaterial() };
const W = { surf: { height: () => 0, isRoad: () => true }, bumps: [], potholes: [], collision: { resolve: () => null } };
const scene = new THREE.Scene();
const p = new PlayerAuto(W, scene, mats);
function run(label, secs, inp, cb) {
  const dt = 1 / 60;
  for (let t = 0; t < secs; t += dt) { p.update(dt, typeof inp === 'function' ? inp(t) : inp, null); if (cb) cb(t); }
  console.log(label.padEnd(34), 'v=', (p.v * 3.6).toFixed(1), 'km/h  gear', p.gear, ' th', p.th.toFixed(2), ' lat', p.latAcc.toFixed(2), ' lift', p.lift.toFixed(2), ' tipped', p.tipped > 0);
}
p.reset(0, 0, 0);
let t40 = null;
run('accel 0-10s full throttle', 10, { throttle: 1, brake: 0, steer: 0 }, (t) => { if (t40 === null && p.v * 3.6 >= 40) t40 = t; });
console.log('  time to 40 km/h:', t40 && t40.toFixed(2), 's');
run('brake 2s', 2, { throttle: 0, brake: 1, steer: 0 });
p.reset(0, 0, 0);
run('accel to ~30 (4s)', 4, { throttle: 1, brake: 0, steer: 0 });
let maxLat = 0, tipped = false;
run('full right lock at speed 2s', 2, { throttle: 0.5, brake: 0, steer: 1 }, () => { maxLat = Math.max(maxLat, Math.abs(p.latAcc)); if (p.tipped) tipped = true; });
console.log('  max lateral acc', maxLat.toFixed(2), 'tipped', tipped);
p.reset(0, 0, 0);
run('accel 3s', 3, { throttle: 1, brake: 0, steer: 0 });
maxLat = 0; tipped = false;
run('half right at speed 3s', 3, { throttle: 0.6, brake: 0, steer: 0.5 }, () => { maxLat = Math.max(maxLat, Math.abs(p.latAcc)); if (p.tipped) tipped = true; });
console.log('  max lateral acc', maxLat.toFixed(2), 'tipped', tipped);
p.reset(0, 0, 0);
run('crawl 1.5s', 1.5, { throttle: 0.5, brake: 0, steer: 0 });
maxLat = 0;
run('full lock at crawl 4s', 4, { throttle: 0.3, brake: 0, steer: 1 }, () => { maxLat = Math.max(maxLat, Math.abs(p.latAcc)); });
console.log('  max lateral acc', maxLat.toFixed(2), ' radius ~', (p.v / Math.max(0.01, Math.abs(p.w))).toFixed(1), 'm');
p.reset(0, 0, 0);
run('reverse: hold brake 3s', 3, { throttle: 0, brake: 1, steer: 0 });
