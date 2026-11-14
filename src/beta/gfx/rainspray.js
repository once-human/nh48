// Road spray. On a wet road every tyre that's rolling throws up a fine mist behind it, the way it does on a highway in the
// rain: little at a crawl, a grey veil hanging behind a car at speed, a thick cloud off a bus or a truck. It comes off the
// back of each rear tyre, is carried along a little with the vehicle and thrown up and back, slows in the air, swells and
// thins out, and drifts down. At night a vehicle's tail lamps colour the mist close behind it red. Yours and everything
// moving within 70 m of you; nothing at all on a dry road. One draw for all of it.
import * as THREE from 'three';
import { Pilot } from '@orig/game/pilot.js';
import { U } from '@orig/gfx/materials.js';

const MAX = 2400, NEAR = 70;
const pos = new Float32Array(MAX*3), vel = new Float32Array(MAX*3), age = new Float32Array(MAX), life = new Float32Array(MAX), size = new Float32Array(MAX), red = new Float32Array(MAX);
let mesh = null, geo = null, k = 0, live = 0, acc = new Map();

function make(scene) {
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const a = new Float32Array(MAX*3);                  // (age as a share of its life, its full size, the red in it)
  geo.setAttribute('aInfo', new THREE.BufferAttribute(a, 3).setUsage(THREE.DynamicDrawUsage));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 400 }, uNight: U.uNight },
    vertexShader: `attribute vec3 aInfo; varying float vA; varying float vR; varying float vN; uniform float uScale; uniform float uNight;
      void main() {
        vec4 mv = modelViewMatrix*vec4(position, 1.); gl_Position = projectionMatrix*mv;
        float t = aInfo.x, s = aInfo.y*(0.25 + 0.75*sqrt(t));
        gl_PointSize = t >= 1. ? 0. : clamp(s*uScale/max(0.3, -mv.z), 1., 512.);
        vA = (1. - t)*smoothstep(0., 0.12, t)*0.22; vR = aInfo.z*(1. - t)*uNight; vN = uNight;
      }`,
    fragmentShader: `varying float vA; varying float vR; varying float vN;
      void main() {
        vec2 c = gl_PointCoord*2. - 1.; float d = dot(c, c); if (d > 1.) discard;
        float a = vA*(1. - d)*(1. - d);
        vec3 col = mix(vec3(.78, .8, .82), vec3(.1, .11, .13), vN*.85) + vec3(.9, .05, .03)*vR;
        gl_FragColor = vec4(col, a);
      }`,
  });
  mesh = new THREE.Points(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.name = 'road-spray';
  scene.add(mesh);
}
// a vehicle's two rear tyres, rolling at v on a wet road: how much they throw up this step
function from(id, x, y, z, th, v, L, Wd, big, tail, wet, dt) {
  const sp = Math.abs(v); if (sp < 4) return;
  const rate = Math.min(220, (sp - 3)*(sp - 3)*0.35*wet*(big ? 2.2 : 1));
  let a = (acc.get(id) || 0) + rate*dt, n = Math.floor(a); acc.set(id, a - n);
  const hx = Math.cos(th), hz = Math.sin(th), back = -L/2 + (big ? 1.1 : 0.75), sgn = v >= 0 ? 1 : -1;
  for (; n > 0; n--) {
    const s = n & 1 ? 1 : -1, w = Wd/2 - 0.25, i = k; k = (k + 1)%MAX;
    const R = Math.random, along = back - 0.3 - R()*0.4;
    pos[i*3] = x + hx*along - hz*w*s + (R() - 0.5)*0.3; pos[i*3 + 1] = y + 0.15 + R()*0.2; pos[i*3 + 2] = z + hz*along + hx*w*s + (R() - 0.5)*0.3;
    // (carried on with the vehicle a little, thrown up and back off the tread, and out to the side)
    const f = 0.35 + R()*0.25, up = 0.8 + R()*1.4 + sp*0.04, bk = 1 + R()*2, out = (R() - 0.3)*1.2*s;
    vel[i*3] = hx*(v*f - sgn*bk) - hz*out; vel[i*3 + 1] = up; vel[i*3 + 2] = hz*(v*f - sgn*bk) + hx*out;
    age[i] = 0; life[i] = 0.7 + R()*0.9 + Math.min(1, sp/30)*0.6; size[i] = (0.7 + R()*0.9)*(big ? 1.6 : 1)*(0.6 + Math.min(1, sp/25)*0.6); red[i] = tail && sgn > 0 ? 0.5 + R()*0.4 : 0;
  }
  live = MAX;
}
function step(G, dt) {
  const W = G.W, wet = G.weather ? G.weather.wet || 0 : 0, cam = G.camera, P = G.player;
  if (!mesh) { if (wet < 0.2) return; make(G.scene); }
  if (wet >= 0.2 && cam && !(G.interiors && G.interiors.inside)) {
    const cx = cam.position.x, cz = cam.position.z, night = U.uNight.value > 0.3;
    const wetAt = (x, z) => W.surf.isRoad(x, z) ? (wet - 0.15)/0.85 : 0;
    const v = !P.onFoot && P.cur;
    if (v && Math.hypot(v.x - cx, v.z - cz) < NEAR) { const S = v.spec || {}, wt = wetAt(v.x, v.z); if (wt > 0) from('me', v.x, v.y || 0, v.z, v.th, v.v || 0, S.L || 4, S.W || 1.7, /bus|tempo|truck/.test(v.type || ''), night, wt, dt); }
    const T = G.traffic;
    if (T) for (const o of T.list) {
      if (!o.alive || o.isPlayer || !o.T || Math.abs(o.x - cx) > NEAR || Math.abs(o.z - cz) > NEAR) continue;
      const wt = wetAt(o.x, o.z); if (wt <= 0) continue;
      from(o.id ?? o, o.rx ?? o.x, o.y || 0, o.rz ?? o.z, o.ryaw ?? o.yaw ?? 0, o.v || 0, o.T.L || 4, o.T.W || 1.7, /bus|tempo|truck/.test(o.type || ''), night, wt, dt);
    }
  }
  if (!live) return;
  // the air: slows it hard, it hangs, then settles
  const drag = Math.exp(-dt*2.6), I = geo.attributes.aInfo.array; let any = false;
  for (let i = 0; i < MAX; i++) {
    if (age[i] >= life[i]) { I[i*3] = 1; continue; }
    any = true; age[i] += dt;
    vel[i*3] *= drag; vel[i*3 + 2] *= drag; vel[i*3 + 1] = vel[i*3 + 1]*drag - 1.6*dt;
    pos[i*3] += vel[i*3]*dt; pos[i*3 + 1] += vel[i*3 + 1]*dt; pos[i*3 + 2] += vel[i*3 + 2]*dt;
    I[i*3] = Math.min(1, age[i]/life[i]); I[i*3 + 1] = size[i]*(1 + age[i]*1.8); I[i*3 + 2] = red[i];
  }
  if (!any) live = 0;
  geo.attributes.position.needsUpdate = true; geo.attributes.aInfo.needsUpdate = true;
  if (cam && G.renderer) { const h = G.renderer.getDrawingBufferSize(_v).y; mesh.material.uniforms.uScale.value = h*0.5*cam.projectionMatrix.elements[5]; }
}
const _v = new THREE.Vector2();
// once a frame, after you've moved (the game's own step for the player runs every frame)
const upd = Pilot.prototype.update;
Pilot.prototype.update = function (dt, ...a) {
  const out = upd.call(this, dt, ...a), G = window.__nhAskG;
  if (G && G.state === 'play' && dt > 0) { try { step(G, dt); } catch (e) { /* (never stop the game over a mist) */ } }
  return out;
};
