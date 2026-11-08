// A vehicle shows what's happened to it, where it happened. Damage was one number: past a point the paint went sooty
// and it smoked, the same all over whichever way you'd hit it, and a shot at a car did nothing to it at all. Now:
//   - a hit dents it where it struck, pushed in the way the blow came, as deep and as wide as the blow was hard (a
//     knock at a signal a dimple in the bumper, a wall at speed the whole corner folded in), the glass with it; the
//     dents stay, and add up, until a garage fixes it (garage repair puts the panels back)
//   - a shot leaves a hole where it went in (a star in the glass), and a little dent round it; one into a tyre lets it
//     down: that corner sags onto the rim, it drags and pulls to that side, and it limps. A big hit on a wheel bends it.
//   - a car you shoot at in traffic stops, and whoever's driving gets out and runs; it's left there, a real car, holed
//   - it smokes from the engine (the bonnet of a car, the back of an auto or a bus): white steam from the radiator first,
//     grey, then black when it's the oil; and when it catches, the fire starts at the engine and spreads along it
// Each vehicle gets its own copy of its model the first time it's dented (they share one until then).
import * as THREE from 'three';
import { Vehicle } from '@orig/vehicles/vehicle.js';
import { Game } from '@orig/game/game.js';
import { Arms, ARMS } from '@orig/game/arms.js';
import { clamp } from '@orig/core/util.js';
import { baseOf } from './models.js';
import { tyreOnRay } from './wheels.js';

const V = Vehicle.prototype;
const now = () => performance.now()/1000;

// ---------------------------------------------------------------- its own model, dented
V.own = function () {
  const B = this.bodyMesh;
  if (this._dg && B.geometry === this._dg.view) return this._dg;
  // (a two-wheeler draws its body as two meshes over one set of vertices, the front end turning with the bars,
  // beta/vehicles/steerfront.js: the copy is of all of it, and each mesh draws its own triangles of the copy)
  const F = this._fr, W4 = this._wh4, body = (F ? F.full : W4 ? W4.src : B.geometry).clone();
  let view = body;
  if (F) {
    const on = (src) => { const g = new THREE.BufferGeometry(); for (const k of Object.keys(body.attributes)) g.setAttribute(k, body.attributes[k]); g.setIndex(src.index); g.boundingSphere = body.boundingSphere; return g; };
    view = on(B.geometry); F.mesh.geometry = on(F.mesh.geometry); if (F.stand) F.stand.geometry = on(F.stand.geometry); for (const w of F.wh || []) w.m.geometry = on(w.m.geometry);
  }
  // (a car's wheels are drawn the same way: beta/vehicles/wheels.js)
  if (W4) {
    const on = (src) => { const g = new THREE.BufferGeometry(); for (const k of Object.keys(body.attributes)) g.setAttribute(k, body.attributes[k]); g.setIndex(src.index); g.boundingSphere = src.boundingSphere; return g; };
    view = on(B.geometry); for (const w of W4.list) w.m.geometry = on(w.m.geometry);
  }
  B.geometry = view; B.userData.ownGeo = true;
  let glass = null;
  if (this.glassMesh && this.glassMesh.geometry.attributes.position.count) { glass = this.glassMesh.geometry.clone(); this.glassMesh.geometry = glass; }
  this._dg = { body, view, glass, b0: Float32Array.from(body.attributes.position.array), g0: glass ? Float32Array.from(glass.attributes.position.array) : null };
  return this._dg;
};
V.box = function () {
  if (!this._bb) { const g = this.bodyMesh.geometry; if (!g.boundingBox) g.computeBoundingBox(); this._bb = g.boundingBox.clone(); }
  return this._bb;
};
const inWheel = (wh, x, y, z, pad = 0.02) => { for (const w of wh) if ((x - w.x)**2 + (y - w.y)**2 < (w.r + pad)**2 && Math.abs(z - w.z) < w.w/2 + 0.03) return w; return null; };
// push the panels round (lx, ly, lz) in along (nx, ny, nz), deepest in the middle, nothing past r; never more than
// 30 cm from where the panel was made, and never the tyres and wheels (their own damage is below)
V.dent = function (lx, ly, lz, nx, ny, nz, r, depth) {
  const D = this.own(), wh = this.wheels || [];
  for (const [g, g0] of [[D.body, D.b0], [D.glass, D.g0]]) {
    if (!g) continue;
    const a = g.attributes.position.array; let hit = false;
    for (let i = 0; i < a.length; i += 3) {
      const x = a[i], y = a[i + 1], z = a[i + 2], dx = x - lx, dy = (y - ly)*0.85, dz = z - lz, d2 = dx*dx + dy*dy + dz*dz;
      if (d2 >= r*r || inWheel(wh, x, y, z)) continue;
      const f = 1 - d2/(r*r), k = depth*f*f*(0.85 + 0.3*Math.sin(x*37 + z*23 + y*17));      // (metal folds, it doesn't press smooth)
      let px = x + nx*k, py = y + ny*k, pz = z + nz*k;
      const ox = px - g0[i], oy = py - g0[i + 1], oz = pz - g0[i + 2], o = Math.hypot(ox, oy, oz);
      if (o > 0.3) { const s = 0.3/o; px = g0[i] + ox*s; py = g0[i + 1] + oy*s; pz = g0[i + 2] + oz*s; }
      a[i] = px; a[i + 1] = py; a[i + 2] = pz; hit = true;
    }
    if (hit) { g.attributes.position.needsUpdate = true; g.computeVertexNormals(); D.dented = true; }
  }
  // the damage you're shown is the damage you can see: how far the panels are from where they were made, all round
  // the body (not the tyres), three times over (a fender pushed in a hand's width is about a tenth; a car stoved in
  // down one side is most of the way to gone). Crashes no longer count on their own (knock() skips a body that dents)
  const a = D.body.attributes.position.array, g0 = D.b0; let sum = 0, n = 0;
  const Rw = this.moving && this.moving.wing, w0 = Rw ? Rw.v0*3 : -1, w1 = Rw ? Rw.v1*3 : -1;      // (a raised spoiler isn't a bent panel)
  for (let i = 0; i < a.length; i += 3) { if (i >= w0 && i < w1 || inWheel(wh, g0[i], g0[i + 1], g0[i + 2])) continue; n++; sum += Math.min(0.3, Math.hypot(a[i] - g0[i], a[i + 1] - g0[i + 1], a[i + 2] - g0[i + 2])); }
  const M = n ? sum/n/0.3 : 0, dM = M - (this._dM || 0);
  // (by how it's built, and a two-wheeler is small enough that one knock moves most of it: that's not most of the way to gone)
  if (dM > 0) { this._dM = M; this.dmg = Math.min(0.97, (this.dmg || 0) + dM*3*toughOf(this.type)*(this.spec && this.spec.two ? 0.35 : 1)); }
};
V.dentDmg = true;
// how a tyre looks let down: the rubber under the rim squashed down onto the road and bulging out at the sides (you
// can see it across the street), and the longer it's driven on, the more of it torn away, a chunk at a time, till the
// rim's running bare. (The rubber is the model's matte part of the wheel; worked from the shape it was made with.)
const RIM_R = 0.64, SECT = 12;
V.tyreLook = function (w) {
  const D = this.own(), g = D.body, a = g.attributes.position.array, b0 = D.b0, gl = g.attributes.glow && g.attributes.glow.array;
  if (!gl) return;
  const sh = Math.min(1, w._shred || 0), R = w.r, rim = R*RIM_R;
  if (!w._torn) { let h = Math.abs(Math.floor(w.x*97 + w.z*41)) + 7; w._torn = [...Array(SECT).keys()].sort(() => ((h = h*16807 % 2147483647)/2147483647) - 0.5); }
  const nT = Math.round(sh*SECT);
  for (let i = 0, k = 0; i < a.length; i += 3, k++) {
    if (gl[k] > -0.5) continue;
    const x = b0[i], y = b0[i + 1], z = b0[i + 2], dx = x - w.x, dy = y - w.y;
    if (dx*dx + dy*dy > (R + 0.03)**2 || Math.abs(z - w.z) > w.w/2 + 0.04) continue;
    const rr = Math.hypot(dx, dy) || 1e-4;
    if (rr <= rim) continue;
    const sec = Math.floor((Math.atan2(dy, dx) + Math.PI)/(2*Math.PI)*SECT) % SECT;
    let r2, zz;
    if (w._torn.indexOf(sec) < nT) { r2 = rim*0.96; zz = w.z + (z - w.z)*0.5; }          // rubber gone: the rim bare there
    else { const low = Math.max(0, -dy/rr); r2 = rim + (rr - rim)*(1 - 0.72*Math.pow(low, 1.3)); zz = w.z + (z - w.z)*(1 + 0.34*low*low + 0.1*sh); }
    a[i] = w.x + dx/rr*r2; a[i + 1] = w.y + dy/rr*r2; a[i + 2] = zz;
  }
  g.attributes.position.needsUpdate = true; g.computeVertexNormals();
};
// a tyre let down (or a wheel bent): its bottom flattened onto the rim, that corner of the car down on it
V.flatWheel = function (w) {
  if (!w || this.noFlat || !this.wheels || !this.wheels.includes(w)) return;      // (bulletproof tyres from the garage)
  const D = this.own(), a = D.body.attributes.position.array;
  this._flats = this._flats || new Set(); if (this._flats.has(w)) return; this._flats.add(w);
  void a; w._shred = w._shred || 0; this.tyreLook(w);
  // which corner it is to the wheels on the ground (beta/vehicles/physics.js ground(): front right, front left, back
  // right, back left; a two-wheeler front, back)
  const S = this.spec, sag = w.r*0.32;
  this.sag = this.sag || (S.two ? [0, 0] : [0, 0, 0, 0]);
  if (S.two) this.sag[w.x > 0 ? 0 : 1] += sag;
  else { const f = w.x > 0 ? 0 : 2; if (Math.abs(w.z) < 0.15) { this.sag[f] += sag/2; this.sag[f + 1] += sag/2; } else this.sag[f + (w.z > 0 ? 0 : 1)] += sag; }
  this.flatSide = (this.flatSide || 0) + Math.sign(w.z)*(w.x > 0 ? 1.4 : 1);
  this.flatN = (this.flatN || 0) + 1;
};
// a tyre takes a knock or a round and holds, up to a point: two good hits on a wheel, or two rounds in the tyre, and
// it's gone (returns true when this one finished it)
V.hurtTyre = function (w, k) {
  if (!w || this.noFlat || (this._flats && this._flats.has(w))) return false;
  const hp = (this._thp || (this._thp = new Map())), left = (hp.has(w) ? hp.get(w) : 1) - k*(TYRES[this.type] ?? 1.15);
  hp.set(w, left);
  if (left > 0) return false;
  this.flatWheel(w); return true;
};
// a flat drags, and pulls to its side; the speed goes (the rim on the road)
const upd = V.update;
V.update = function (dt, inp, traffic) {
  if (this.flatN && dt > 0) {
    const v = this.v || 0, sp = Math.abs(v);
    this.th += (this.flatSide || 0)*0.045*Math.min(1, sp/6)*Math.sign(v)*dt;
    this.v -= Math.sign(v)*Math.min(sp, this.flatN*(0.5 + 0.004*v*v)*dt);
  }
  const r = upd.call(this, dt, inp, traffic);
  if (this.flatN && dt > 0) rims(this, dt); else if (this._grind) grind(this, 0);
  return r;
};
// ---------------------------------------------------------------- on the rims: sparks and the grind of steel on tar
// sparks: hot streaks thrown back off the rim where it meets the road, white-hot as they leave it, cooling through
// amber to a dull red as they fall, gone in a third of a second; and where the steel grinds on the tar, flame: a
// flickering amber tongue at the contact, licking back and up off it
const SPK = 360, FLM = 90;
let spk = null;
function flameTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 40, 2, 32, 34, 30);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.25, 'rgba(255,170,60,0.9)'); g.addColorStop(0.6, 'rgba(230,80,10,0.45)'); g.addColorStop(1, 'rgba(120,20,0,0)');
  x.fillStyle = g; x.beginPath(); x.ellipse(32, 36, 22, 28, 0, 0, 6.283); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sparks() {
  if (spk) return spk;
  const G = window.__nhAskG; if (!G || !G.scene) return null;
  const g = new THREE.BoxGeometry(0.016, 0.016, 0.12);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.InstancedMesh(g, m, SPK); mesh.frustumCulled = false; mesh.count = 0;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SPK*3), 3); G.scene.add(mesh);
  const fm = new THREE.MeshBasicMaterial({ map: flameTex(), color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const flame = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1.4).translate(0, 0.45, 0), fm, FLM); flame.frustumCulled = false; flame.count = 0;
  flame.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FLM*3), 3); G.scene.add(flame);
  spk = { mesh, flame, p: [], f: [], k: 0, kf: 0, m4: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), z: new THREE.Vector3(0, 0, 1), t: 0 };
  return spk;
}
function emitSpark(x, y, z, vx, vy, vz) {
  const S = sparks(); if (!S) return;
  const p = S.p[S.k] || (S.p[S.k] = {}); S.k = (S.k + 1) % SPK;
  Object.assign(p, { x, y, z, vx, vy, vz, life: 0, max: 0.2 + Math.random()*0.28 });
}
function emitFlame(x, y, z, vx, vz) {
  const S = sparks(); if (!S) return;
  const p = S.f[S.kf] || (S.f[S.kf] = {}); S.kf = (S.kf + 1) % FLM;
  Object.assign(p, { x, y, z, vx, vz, life: 0, max: 0.1 + Math.random()*0.14, sz: 0.1 + Math.random()*0.1, sp: Math.random()*6.283 });
}
// white-hot, yellow, amber, red: what a spark of steel goes through as it cools
const HOT = [[3.2, 2.9, 2.2], [2.8, 1.9, 0.6], [2.2, 0.95, 0.15], [1.1, 0.25, 0.03]];
function heat(t, out, i) {
  const u = Math.min(2.999, Math.max(0, t)*3), k = Math.floor(u), f = u - k, A = HOT[k], B = HOT[k + 1];
  out[i] = A[0] + (B[0] - A[0])*f; out[i + 1] = A[1] + (B[1] - A[1])*f; out[i + 2] = A[2] + (B[2] - A[2])*f;
}
function tickSparks(dt) {
  const S = spk; if (!S) return;
  let n = 0;
  const col = S.mesh.instanceColor.array;
  for (const p of S.p) {
    if (!p || p.life >= p.max) continue;
    p.life += dt; p.vy -= 9.8*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
    if (p.y < 0.01 && p.vy < 0) { p.y = 0.01; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }      // (a skip off the road)
    if (p.life >= p.max) continue;
    S.v.set(p.vx, p.vy, p.vz); const sp = S.v.length() || 1;
    S.q.setFromUnitVectors(S.z, S.v.multiplyScalar(1/sp));
    const k = 1 - p.life/p.max; S.s.set(1, 1, 0.5 + Math.min(2.8, sp*0.14)*k);
    S.m4.compose(S.v.set(p.x, p.y, p.z), S.q, S.s); S.mesh.setMatrixAt(n, S.m4); heat(p.life/p.max, col, n*3); n++;
  }
  S.mesh.count = n; S.mesh.instanceMatrix.needsUpdate = true; S.mesh.instanceColor.needsUpdate = true;
  // the flames face the camera, flicker, and go up and back as they burn out
  const G = window.__nhAskG, cam = G && G.camera, fc = S.flame.instanceColor.array; let m = 0;
  if (cam) S.q.copy(cam.quaternion);
  for (const p of S.f) {
    if (!p || p.life >= p.max) continue;
    p.life += dt; if (p.life >= p.max) continue;
    p.x += p.vx*dt; p.z += p.vz*dt; p.y += 0.7*dt;
    const t = p.life/p.max, fl = 0.75 + 0.25*Math.sin(p.sp + p.life*70), sc = p.sz*(0.6 + t*1.1)*fl;
    S.s.set(sc*(1 - 0.3*t), sc*(1 + 0.4*t), sc);
    S.m4.compose(S.v.set(p.x, p.y, p.z), S.q, S.s); S.flame.setMatrixAt(m, S.m4);
    heat(0.25 + t*0.75, fc, m*3); const a = (1 - t)*0.85; fc[m*3] *= a; fc[m*3 + 1] *= a; fc[m*3 + 2] *= a; m++;
  }
  S.flame.count = m; S.flame.instanceMatrix.needsUpdate = true; S.flame.instanceColor.needsUpdate = true;
}
function rims(v, dt) {
  const G = window.__nhAskG, sp = Math.abs(v.v || 0);
  if (G && G.player && G.player.cur === v && !G.player.onFoot) grind(v, sp); else if (v._grind) grind(v, 0);
  if (sp > 2.5 && v._flats) {
    const hx = Math.cos(v.th), hz = Math.sin(v.th), y0 = v.y || 0, dir = Math.sign(v.v);
    for (const w of v._flats) {
      { const was = Math.round((w._shred || 0)*SECT); w._shred = Math.min(1, (w._shred || 0) + sp*dt/320); if (Math.round(w._shred*SECT) !== was) v.tyreLook(w); }
      v._sa = (v._sa || 0) + dt*Math.min(110, sp*5.5);
      v._fa = (v._fa || 0) + dt*Math.min(40, sp*2.2);
      const fx = v.x + hx*w.x - hz*w.z, fz = v.z + hz*w.x + hx*w.z;
      while (v._fa >= 1) { v._fa -= 1; emitFlame(fx + (Math.random() - 0.5)*0.08, y0 + 0.02, fz + (Math.random() - 0.5)*0.08, -hx*dir*sp*0.25, -hz*dir*sp*0.25); }
      while (v._sa >= 1) {
        v._sa -= 1;
        const x = v.x + hx*w.x - hz*w.z, z = v.z + hz*w.x + hx*w.z, R = Math.random;
        emitSpark(x, y0 + 0.04, z, -hx*dir*sp*(0.3 + R()*0.4) + (R() - 0.5)*2, 1 + R()*2.5, -hz*dir*sp*(0.3 + R()*0.4) + (R() - 0.5)*2);
      }
    }
  }
  tickSparks(dt);
}
// the grind: steel on tar, a harsh rasp that rises with the speed and screams under it, louder the more rims are down
function grind(v, sp) {
  const G = window.__nhAskG, A = G && G.audio, ctx = A && A.ctx; if (!ctx) return;
  let N = v._grind;
  if (!N && sp > 0.5) {
    const len = ctx.sampleRate*2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random()*2 - 1; last = last*0.6 + w*0.4; d[i] = (Math.random() < 0.002 ? w*3 : 0) + w*0.6 + last*0.4; }
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const hi = ctx.createBiquadFilter(); hi.type = 'bandpass'; hi.frequency.value = 3400; hi.Q.value = 2.2;
    const lo = ctx.createBiquadFilter(); lo.type = 'bandpass'; lo.frequency.value = 900; lo.Q.value = 4;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(hi); src.connect(lo); hi.connect(g); lo.connect(g); g.connect(A.bus ? A.bus('fx') : ctx.destination); src.start();
    N = v._grind = { src, g, hi, lo };
  }
  if (!N) return;
  const t = ctx.currentTime, lv = sp > 0.5 ? Math.min(0.35, 0.05 + sp*0.012)*Math.min(2, v.flatN || 1)/1.4 : 0;
  N.g.gain.setTargetAtTime(lv, t, 0.08);
  N.hi.frequency.setTargetAtTime(2600 + sp*70, t, 0.1);
  if (!lv && sp <= 0.5 && !(v.flatN > 0)) { N.g.gain.setTargetAtTime(0, t, 0.05); setTimeout(() => { try { N.src.stop(); } catch (e) { /* gone */ } }, 300); v._grind = null; }
}
// all of it put right (the garage: damage back to nothing)
V.mend = function () {
  const D = this._dg;
  if (D && this.bodyMesh.geometry === D.view) {
    D.body.attributes.position.array.set(D.b0); D.body.attributes.position.needsUpdate = true;
    // (what moves on its own stays where it is: the 911's spoiler, beta/vehicles/details.js)
    if (this.reWing) this.reWing();
    D.body.computeVertexNormals(); D.dented = false;
    if (D.glass) { D.glass.attributes.position.array.set(D.g0); D.glass.attributes.position.needsUpdate = true; D.glass.computeVertexNormals(); }
  }
  if (this._grind) grind(this, 0);
  if (this._flats) for (const w of this._flats) { w._shred = 0; }
  this._flats = null; this._thp = null; this.sag = null; this.flatN = 0; this.flatSide = 0; this._dM = 0;
  if (this._holes) { for (const h of this._holes) h.parent && h.parent.remove(h); this._holes = null; }
};

// ---------------------------------------------------------------- crashes
// (a 911 is the toughest thing on the road for its size, a carbon tub close behind, a big luxury saloon well built; a bus
// is a bus. Tyres go a little before the body does)
const TOUGH = { sports: 0.2, super: 0.24, superbike: 0.22, bullet: 0.4, bike: 0.45, bikeP: 0.45, scooter: 0.6, scooterP: 0.6, cycle: 0.6, bus: 0.35, lux: 0.42, jeep: 0.55, fortuner: 0.5, scorpio: 0.55, xuv: 0.55, tempo: 0.6, city: 0.65, nexon: 0.6 }, TYRES = { super: 0.5, sports: 0.55, superbike: 0.55, lux: 0.9, jeep: 0.9, bus: 0.7 };
// (how much of a blow gets through: the quicker and better built, the less. Everything else takes a little under what it did)
export const toughOf = (type) => TOUGH[type] ?? TOUGH[baseOf(type)] ?? 0.75;
const P = V, bounce = P.bounce;
P.bounce = function (res, ox, oz) {
  const imp = bounce.call(this, res, ox, oz);
  // (by what it felt, not the speed it met at: a bus through a cycle gets nothing; and what it takes goes up with the
  // square of that, as the energy does: 20 km/h a scratch, 50 a real knock, 100 most of the car)
  const felt = this._dv ?? imp;
  if (felt > 3.5 && imp > 0 && res.lx !== undefined && this.bodyMesh && !this.dead && !((this._dT || 0) > now())) {
    this._dT = now() + 0.25;
    this.dmg = Math.min(0.97, (this.dmg || 0) + felt*felt*0.0009*(this.armorMul ?? 1)*(toughOf(this.type)));
    const hx = Math.cos(this.th), hz = Math.sin(this.th), nlx = res.nx*hx + res.nz*hz, nlz = -res.nx*hz + res.nz*hx;
    const bb = this.box(), ly = bb.min.y + (bb.max.y - bb.min.y)*(this.spec.two ? 0.5 : 0.36);
    const r = clamp(0.35 + felt*0.035, 0.35, 0.95)*(this.spec.two ? 0.6 : 1), depth = Math.min(0.28, (felt - 3)*0.022*Math.sqrt(toughOf(this.type)));
    try { this.dent(res.lx, ly, res.lz, nlx, -0.12, nlz, r, depth); } catch (e) { /* drawn as it was */ }
    // a big one on a wheel bends it
    if (felt > 6 && this.wheels) { const w = this.wheels.find(q => Math.hypot(q.x - res.lx, q.z - res.lz) < q.r + 0.45); if (w) this.hurtTyre(w, (felt - 5)*0.085); }
  }
  return imp;
};

// ---------------------------------------------------------------- shots
const hole = { g: new THREE.CircleGeometry(0.03, 9), star: new THREE.CircleGeometry(0.075, 7) };
const holeM = new THREE.MeshBasicMaterial({ color: 0x0b0b0b, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const starM = new THREE.MeshBasicMaterial({ color: 0xe8eef2, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3(), _l = new THREE.Vector3();
// how tall the traffic's vehicles are, for where a shot meets them
const tall = (o) => { const T = o.T || {}; return T.two ? 1.3 : o.type === 'bus' ? 3.1 : o.type === 'tempo' ? 2.3 : o.type === 'auto' ? 1.75 : /suv|jeep/.test(o.type || '') ? 1.8 : 1.5; };
// the ray against a box L x W x H on the ground at (x, y, z) heading th: how far along it goes in, or -1
function boxHit(o3, d3, x, y, z, th, L, W, H) {
  const c = Math.cos(th), s = Math.sin(th), dx = o3.x - x, dz = o3.z - z;
  const ox = dx*c + dz*s, oz = -dx*s + dz*c, oy = o3.y - y, vx = d3.x*c + d3.z*s, vz = -d3.x*s + d3.z*c, vy = d3.y;
  let t0 = 0, t1 = 1e9;
  for (const [p, v, lo, hi] of [[ox, vx, -L/2, L/2], [oy, vy, 0, H], [oz, vz, -W/2, W/2]]) {
    if (Math.abs(v) < 1e-9) { if (p < lo || p > hi) return -1; continue; }
    let a = (lo - p)/v, b = (hi - p)/v; if (a > b) { const t = a; a = b; b = t; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1;
  }
  return t0;
}
const use = Arms.prototype.use;
Arms.prototype.use = function (...args) {
  const G = this.g, Pl = G.player, W = this.held && ARMS[this.held];
  if (!W || !W.gun || !Pl || !Pl.onFoot || !(this.life.s.ammo > 0)) return use.apply(this, args);
  const C = G.camera, F = Pl.foot;
  C.getWorldPosition(_o); C.getWorldDirection(_d);
  // the nearest vehicle the shot meets: one left in the street (a real one) or one in the traffic
  let best = null, bt = 1e9;
  for (const q of Pl.dropped || []) { const v = q.veh; if (!v || v.dead || !v.root || !v.root.visible) continue; const t = boxHit(_o, _d, v.x, v.y || 0, v.z, v.th, v.spec.L + 0.2, v.spec.W + 0.2, 3.2); if (t >= 0 && t < bt) { bt = t; best = { v }; } }
  const T = G.traffic;
  if (T) T.near(F.x, F.z, W.range + 4, (o) => { if (!o.alive || o.wreck || o.isPlayer || !o.T) return; const t = boxHit(_o, _d, o.x, o.y || 0, o.z, Math.atan2(o.hz ?? 0, o.hx ?? 1), o.T.L, o.T.W, tall(o)); if (t >= 0 && t < bt) { bt = t; best = { o }; } });
  if (!best) return use.apply(this, args);
  const hx = _o.x + _d.x*bt, hz = _o.z + _d.z*bt, dv = Math.hypot(hx - F.x, hz - F.z);
  if (dv > W.range) return use.apply(this, args);
  // whoever's behind it is safe: the vehicle takes the round (they're out of the line while the shot's worked out)
  const hid = [];
  for (const p of G.people.list) { if (p.hidden) continue; const d = Math.hypot(p.x - F.x, p.z - F.z); if (d > dv + 0.3) { p.hidden = true; hid.push(p); } }
  let r;
  try { r = use.apply(this, args); } finally { for (const p of hid) p.hidden = false; }
  try { shotAt(G, best, _o, _d); } catch (e) { console.warn('shot', e); }
  return r;
};
function shotAt(G, best, o3, d3) {
  let v = best.v;
  if (best.o) {
    const o = best.o, T = o.T;
    if (T.two) {
      // a rider shot at goes over (and runs, if they can)
      o.fallen = Math.max(o.fallen || 0, 3.5); o.angry = 0;
      return;
    }
    v = promote(G, o);
    if (!v) return;
  }
  v.root.updateMatrixWorld(true);
  ray.set(o3, d3); ray.far = 80;
  const hits = ray.intersectObjects([v.bodyMesh, v.glassMesh].filter(Boolean), false);
  const tyre = tyreOnRay(v, ray, hits.length ? hits[0].distance : 80);
  if (tyre) { if (v.hurtTyre(tyre, 0.55) && G.hud && G.hud.toast && G.player.cur === v) G.hud.toast('Tyre', 'One of your tyres is gone', 'bad', 2); return; }
  if (!hits.length) return;
  const h = hits[0], m = h.object;
  m.worldToLocal(_l.copy(h.point));
  _n.copy(h.face ? h.face.normal : new THREE.Vector3(0, 1, 0));
  const glass = m === v.glassMesh, wheel = !glass && v.wheels && inWheel(v.wheels, _l.x, _l.y, _l.z, 0.04);
  if (wheel) { if (v.hurtTyre(wheel, 0.55) && G.hud && G.hud.toast && G.player.cur === v) G.hud.toast('Tyre', 'One of your tyres is gone', 'bad', 2); }
  else v.dent(_l.x, _l.y, _l.z, -_n.x, -_n.y, -_n.z, 0.1, 0.025);
  // the hole (a star in glass)
  const dm = new THREE.Mesh(glass ? hole.star : hole.g, glass ? starM : holeM);
  dm.position.copy(_l).addScaledVector(_n, 0.004); dm.lookAt(_l.clone().add(_n)); dm.matrixAutoUpdate = false; dm.updateMatrix();
  m.parent.add(dm); (v._holes || (v._holes = [])).push(dm);
  if (v._holes.length > 40) { const old = v._holes.shift(); old.parent && old.parent.remove(old); }
  // into the engine it's worse
  const S = v.spec, eng = engineAt(v);
  v.dmg = Math.min(0.97, (v.dmg || 0) + (Math.abs(_l.x - eng[0]) < 0.9 ? 0.07 : 0.02));
  G.audio && G.audio.at && G.audio.at(v.x, v.z, () => G.audio.thud && G.audio.thud(0.35));
  if (S && G.smoke) G.smoke.emit(h.point.x, h.point.y, h.point.z, 'smoke', 0.05);
}
// a car in the traffic, shot at: it stops where it is, the driver's out and running, and it's a real car now (left there)
export function promote(G, o) {
  const Pl = G.player;
  if ((o.y || 0) > 0.5) return null;                                     // (up on a flyover: not worth the trouble)
  const v = new Vehicle(Pl.W, Pl.scene, Pl.vmats, o.type, o.col);
  v.reset(o.x, o.z, Math.atan2(o.hz ?? 0, o.hx ?? 1)); v.v = 0;
  v.plate = Pl.randomPlate ? Pl.randomPlate() : v.plate; v.dmg = o.dmg || 0;
  v.sync && v.sync(0);
  // the driver stays in while it's thrown and spun, and gets out once it's come to rest, at its door wherever it ended
  // up (the traffic one goes back to the pool, so what they need of it is kept here)
  const who = { T: o.T, type: o.type, colB: o.colB && o.colB.slice(), colC: o.colC && o.colC.slice(), x: o.x, z: o.z, hx: o.hx ?? 1, hz: o.hz ?? 0 };
  const idx = G.traffic.list.indexOf(o); if (idx >= 0) G.traffic.despawn(idx);
  Pl.addDropped(v, G.traffic);
  let lx = v.x, lz = v.z, n = 0;
  const out = () => {
    const moved = Math.hypot(v.x - lx, v.z - lz); lx = v.x; lz = v.z;
    if (moved > 0.04 && ++n < 60) { G.later(0.2, out); return; }
    who.x = v.x; who.z = v.z; if (v.th !== undefined) { who.hx = Math.cos(v.th); who.hz = Math.sin(v.th); }
    const dr = Pl.spawnAngryDriver ? Pl.spawnAngryDriver(who, 'bump') : null;
    if (dr && G.people && G.people.flee) { dr.angry = 0; dr.grudge = 0; G.people.flee(dr, Pl.x, Pl.z, 35); }
  };
  if (G.later) G.later(0.4, out); else out();
  return v;
}

// ---------------------------------------------------------------- smoke and fire
// where the engine is (along it, how high): a car's under the bonnet, an auto's and a bus's at the back, a tempo's
// under the cab, a two-wheeler's low in the middle
function engineAt(v) {
  const S = v.spec || {}, L = S.L || 3, t = v.type;
  if (S.two) return [0.05, 0.5];
  if (t === 'auto' || t === 'bus') return [-L/2 + (t === 'bus' ? 0.9 : 0.55), t === 'bus' ? 1.3 : 0.7];
  if (t === 'tempo') return [L/2 - 0.7, 0.9];
  return [L/2 - 0.75, 0.85];
}
Game.prototype.smokeFrom = function (v, dt) {
  const d = v.dmg || 0;
  if (d < 0.45) return;
  v._smT = (v._smT || 0) - dt;
  if (v._smT > 0) return;
  v._smT = d > 0.95 ? 0.04 : d > 0.75 ? 0.07 : 0.16 - (d - 0.45)*0.2;
  const th = v.th ?? Math.atan2(v.hz || 0, v.hx || 1), hx = Math.cos(th), hz = Math.sin(th), y0 = v.y || 0, L = (v.spec && v.spec.L) || 3;
  const [ex, ey] = engineAt(v), R = Math.random, at = (a, s) => [v.x + hx*a - hz*s, v.z + hz*a + hx*s];
  // from the bonnet's seams: steam, then grey, then black
  const [x, z] = at(ex + (R() - 0.5)*0.5, (R() - 0.5)*0.6);
  this.smoke.emit(x, y0 + ey, z, d > 0.75 ? 'black' : 'steam', 0.25 + (d - 0.45)*0.5);
  if (d > 0.95) {
    // burning: from the engine first, then along it toward the other end as it takes hold
    const f = clamp((d - 0.95)/0.05, 0, 1), back = -Math.sign(ex || 1), n = 1 + Math.floor(f*3.99);
    const k = Math.floor(R()*n), a = ex + back*L*0.85*(k/4), [fx, fz] = at(a + (R() - 0.5)*0.4, (R() - 0.5)*0.8);
    this.smoke.emit(fx, y0 + ey*0.85, fz, 'fire', 0.45);
    if (R() < 0.5) this.smoke.emit(fx, y0 + ey + 0.4, fz, 'black', 0.5);
  }
};
// put right at the garage (damage to nothing), and gone up in flames (crumpled all over)
const paint = Game.prototype.paintDamage;
Game.prototype.paintDamage = function (v) {
  if (v && !v.dead && (v.dmg || 0) < 0.02 && (v._dg && v._dg.dented || v.flatN || v._holes) && v.mend) v.mend();      // (only once there's something to put right: every frame, it put the spoiler back down)
  return paint.call(this, v);
};
const boom = Game.prototype.explode;
Game.prototype.explode = function (v) {
  const r = boom.call(this, v);
  try {
    if (v.dent) { const bb = v.box(), S = v.spec; for (let i = 0; i < 7; i++) { const a = (Math.random() - 0.5)*S.L, s = (Math.random() < 0.5 ? -1 : 1)*S.W/2, y = bb.min.y + Math.random()*(bb.max.y - bb.min.y); v.dent(a, y, s, 0, -0.3, -Math.sign(s), 0.6, 0.12); } }
    if (v.wheels) for (const w of v.wheels) v.flatWheel(w);
  } catch (e) { /* drawn as it was */ }
  return r;
};
