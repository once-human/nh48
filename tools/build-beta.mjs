// Build /beta (Puneri, with the new look) into dist/beta/index.html. Run after tools/build.mjs: it shares that
// build's dist/assets (map tiles, fonts, models, voices) and reads its manifest from dist/index.html or dist/test.html.
//
// The game in /beta is the game: every file under src/ is bundled as it is. Only what draws the city is swapped,
// at build time, for the new look (src/beta), and never anything that decides what happens:
//   - src/world/world.js gets the new buildings and ground builders (they produce the same shop doors, shutters
//     and boards the game reads, from the same map data; collision never came from the drawing), and the painted
//     materials in place of the old ground, wall, roof, prop and water ones
//   - the story is left out (src/beta/game/story.js answers "no story" to everything that asks)
//   - the first-minutes tutorial skips the auto steps (there's no auto of your own in /beta)
// A file under src/beta can still reach any original with '@orig/<path under src>'.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dev = process.argv.includes('--dev');
const t0 = Date.now();
const S = (p) => path.join(root, 'src', p);
const V = { three: '0.186.1', pp: '6.39.5', n8ao: '2.0.1' };
const IMPORTS = {
  three: `https://cdn.jsdelivr.net/npm/three@${V.three}/build/three.module.min.js`,
  'three/addons/': `https://cdn.jsdelivr.net/npm/three@${V.three}/examples/jsm/`,
  'three/examples/jsm/': `https://cdn.jsdelivr.net/npm/three@${V.three}/examples/jsm/`,
  postprocessing: `https://cdn.jsdelivr.net/npm/postprocessing@${V.pp}/build/index.js`,
  n8ao: `https://cdn.jsdelivr.net/npm/n8ao@${V.n8ao}/dist/N8AO.js`,
};
if (process.env.NH_LOCAL) {
  IMPORTS.three = '/nm/three/build/three.module.js';
  IMPORTS['three/addons/'] = IMPORTS['three/examples/jsm/'] = '/nm/three/examples/jsm/';
  IMPORTS.postprocessing = '/nm/postprocessing/build/index.js';
  IMPORTS.n8ao = '/nm/n8ao/dist/N8AO.js';
}

// importer (or '*' for any importer outside src/beta) -> original module -> its /beta stand-in
const SWAPS = [
  ['*', S('gfx/textures.js'), S('beta/gfx/textures.js')],
  ['*', S('world/landmarks.js'), S('beta/world/landmarks.js')],
  ['*', S('world/props.js'), S('beta/world/props.js')],
  [S('world/world.js'), S('world/propsChunk.js'), S('beta/world/propsChunk.js')],
  [S('world/world.js'), S('world/buildingsChunk.js'), S('beta/world/buildings.js')],
  [S('world/world.js'), S('world/groundChunk.js'), S('beta/world/ground.js')],
  [S('world/world.js'), S('gfx/pbr.js'), S('beta/gfx/pbr.js')],
  [S('world/world.js'), S('gfx/materials.js'), S('beta/gfx/materials.js')],
  [S('world/world.js'), S('world/trees.js'), S('beta/world/trees.js')],
  [S('world/world.js'), S('world/farCity.js'), S('beta/world/farCity.js')],
  [S('world/world.js'), S('world/grass.js'), S('beta/world/grass.js')],
  ['*', S('vehicles/vehmat.js'), S('beta/vehicles/vehmat.js')],
  ['*', S('vehicles/models.js'), S('beta/vehicles/models.js')],
  [S('vehicles/vehicle.js'), S('vehicles/cockpit.js'), S('beta/vehicles/cockpit.js')],
  ['*', S('game/story.js'), S('beta/game/story.js')],
  ['*', S('game/tutorial.js'), S('beta/game/tutorial.js')],
  ['*', S('game/home.js'), S('beta/game/home.js')],
];
// a line in a game file swapped as it's bundled: only for what a module swap can't reach. Fails the build if the line has moved
const PATCHES = {
  // the tyres' squeal is one continuous sound now (beta/game/dash.js), not a burst every few frames
  [S('game/modfx.js')]: [["if (this.edge('KeyU') && v.dj) this.music(!this.djOn);", ""], ["if ((this._sqT = (this._sqT || 0) - 1 / 60) <= 0) { this._sqT = 0.09; G.audio.noiseBurst?.(0.12, 2400 + Math.random() * 600, 6, Math.min(0.22, ev.amount * 0.03)); }", ""]],
  // a postcard is a second full render and a stop-the-world read of its pixels: taken only when you're not moving fast, never mid-drive
  // the gun fires the Rounds in your jhola too (they were a separate count it never looked at): any there are
  // loaded into it the moment the loaded ones run out
  [S('game/arms.js')]: [["const s = this.life.s; if (!(s.ammo > 0)) {", "const s = this.life.s; if (!(s.ammo > 0) && s.inv && s.inv.ammo > 0) { s.ammo = (s.ammo || 0) + s.inv.ammo; s.inv.ammo = 0; }\n      if (!(s.ammo > 0)) {"]],
  // headlights come up and die away as a filament does (a quarter of a second on, half a second off), never a snap.
  // How far along they are (hk, 0 to 1) is what the beam on the road and the lamp's own glass go by (beta/gfx/lamps.js,
  // beta/vehicles/lamps.js)
  [S('game/lights.js')]: [["if (hl) hl.intensity = !P.onFoot && this.headOn(night) ? 24 * Math.max(night, 0.35) : 0;", "if (hl) { const w = !P.onFoot && this.headOn(night) ? 1 : 0, k0 = this.hk || 0; let k = k0 + (w - k0) * Math.min(1, dt * (w ? 9 : 4.5)); if (k < 0.004) k = 0; else if (k > 0.996) k = 1; this.hk = k; hl.intensity = 24 * Math.max(night, 0.35) * k; }"]],
  [S('game/postcards.js')]: [["if (G.state !== 'play' || !this.ok() || (G.jhola && G.jhola.on) || (G.phone && G.phone.on)) return;", "if (G.state !== 'play' || !this.ok() || (G.jhola && G.jhola.on) || (G.phone && G.phone.on) || (!G.player.onFoot && Math.abs(G.player.cur.v || 0) > 2.5)) return;"],
    // while you play, a postcard no longer holds the game while it's taken (a third of a second to a whole second, each new
    // neighbourhood and landmark you walked into): the shaders its view needs are got ready in the background the first
    // time, the picture comes back when the graphics card has it instead of everything waiting on it, and it's packed as
    // a JPEG off the frame. With the map open it's taken at once, as before
    ["const prev = R.getRenderTarget();", "if (G.state === 'play') { this.quiet(key); return null; }\n      this.gen = (this.gen || 0) + 1;\n      const prev = R.getRenderTarget();"],
    ["  road(x, z, r = 80) {", `  quiet(key) {
    if (this.busy) return; this.busy = true;
    const G = this.g, R = G.renderer, C = this.cam, gen = this.gen = (this.gen || 0) + 1;
    const into = (f) => { const prev = R.getRenderTarget(); R.setRenderTarget(this.rt); try { return f(); } finally { R.setRenderTarget(prev); } };
    const still = () => gen === this.gen && G.state === 'play' && this.ok() && this.near(C.position.x, C.position.z);
    (async () => {
      // (again whenever something of a new kind has turned up in the city since: its shader for this view isn't made yet)
      if (this.warm !== R.info.programs.length) { await into(() => R.compileAsync(G.scene, C)); this.warm = R.info.programs.length; }
      if (!still()) return;
      into(() => R.render(G.scene, C));
      await R.readRenderTargetPixelsAsync(this.rt, 0, 0, W_, H_, this.buf);
      if (gen !== this.gen) return;
      const D = this.img.data, W4 = W_ * 4;
      for (let y = 0; y < H_; y++) D.set(this.buf.subarray((H_ - 1 - y) * W4, (H_ - y) * W4), y * W4);
      for (let i = 3; i < D.length; i += 4) D[i] = 255;
      this.cx.putImageData(this.img, 0, 0);
      const g = this.cx.createRadialGradient(W_ / 2, H_ / 2, H_ * 0.35, W_ / 2, H_ / 2, W_ * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
      this.cx.fillStyle = g; this.cx.fillRect(0, 0, W_, H_);
      const blob = await new Promise((res) => this.cv.toBlob(res, 'image/jpeg', 0.8));
      const url = blob && await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(blob); });
      if (url) this.put(key, url);
    })().catch(() => {}).finally(() => { this.busy = false; });
  }
  road(x, z, r = 80) {`]],
  [S('game/garageui.js')]: [["[tog('xenon', cyc ? 'LED lamp' : 'Xenon headlights', 'Cold white, reaches further', $(2500)), ...(cyc ? [] : [", "[...(cyc ? [] : [tog('xenon', 'Xenon headlights', 'Cold white, reaches further', $(2500)), "], ["(this.mine ? 'Your ' : '') + here.spec.name.toLowerCase();", "(this.mine ? 'Your ' : '') + (here.spec.real || here.spec.name);"]],
  [S('ui/jhola.js')]: [["if (this.queue.length && G.state === 'play') this.renderOne();", "if (this.queue.length && G.state === 'play' && (G.player.onFoot || Math.abs(G.player.cur.v || 0) < 2.5)) this.renderOne();"], ["name: 'Your ' + (v.spec && v.spec.name ? v.spec.name.toLowerCase() : 'vehicle') }", "name: 'Your ' + (v.spec ? v.spec.real || v.spec.name || 'vehicle' : 'vehicle') }"]],
  // compound walls along the roads: not Pune, Onkar wants them gone. Neither drawn nor solid (the city's edge wall is separate)
  [S('world/index.js')]: [["import TRANSIT from", "import { letGo, freeze } from '../beta/world/view.js';\nimport TRANSIT from"],
    ["g.traverse(o => { if (o.isMesh || o.isLine) { o.matrixAutoUpdate = false; o.updateMatrix(); } });", "g.traverse(o => { if (o.isMesh || o.isLine) { o.matrixAutoUpdate = false; o.updateMatrix(); if (!o.isInstancedMesh && o.geometry) letGo(o.geometry); } }); freeze(g);"],
    ["for (const w of D.walls) put('walls', at(w[0] / 100, w[1] / 100), cmRing(w));", "/* /beta: no compound walls */"]],
  [S('world/world.js')]: [
    ["for (const B of M.buildings) W.collision.addRing(cmRing(B[1]), 0);", "for (const B of M.buildings) buildingSolid(B, cmRing(B[1]), W.collision);"],
    ["import { cmRing", "import { buildingSolid } from '../beta/world/solids.js';\nimport { cmRing"]],
  [S('world/tiles.js')]: [["for (let j = 0; j < D.walls.length; j += 60) {", "for (let j = 0; j < 0; j += 60) {"],
    // leaving a district behind, its walls and kerbs are taken out of the collision a strip at a time. All at once it was
    // twenty thousand cells gone through in one frame: a tenth of a second and more, every couple of kilometres you travelled
    ["W.collision.removeTag(tag, T.rect);\n    yield 'd4';", "{ const r = T.rect, x1 = r[2] + 60; for (let x = r[0] - 60; x <= x1; x += 40) { W.collision.removeTag(tag, [x + 60, r[1], Math.min(x + 39, x1) - 60, r[3]]); yield 'd3'; } }\n    yield 'd4';"],
    // a petrol pump's canopy is a roof on columns: you go in under it (beta/world/solids.js buildingSolid)
    ["for (const B of D.buildings.slice(k, k + 160)) C.addRing(cmRing(B[1]), 0);", "for (const B of D.buildings.slice(k, k + 160)) buildingSolid(B, cmRing(B[1]), C);"],
    // stalls solid in their own shape, not a 0.9 m circle (beta/world/solids.js)
    ["import { cmRing } from './geo.js';", "import { cmRing } from './geo.js';\nimport { makeSolids, buildingSolid } from '../beta/world/solids.js';"],
    ["for (const s of D.stalls) C.addCircle(s[0] / 100, s[1] / 100, 0.9, 2);", "{ const SO = W.solid || (W.solid = makeSolids(W)); for (const s of D.stalls) SO.stall(s, C); }"]],
  [S('world/propsChunk.js')]: [["for (const w of M.walls) {", "for (const w of []) {"],
    // stalls, bus shelters, street-name boards and banner frames solid in their own shapes (beta/world/solids.js)
    ["import { RNG, hash1 } from '../core/util.js';", "import { RNG, hash1 } from '../core/util.js';\nimport { makeSolids } from '../beta/world/solids.js';"],
    ["for (const b of M.buses) collision.addCircle(b[0] / 100, b[1] / 100, 0.9, 2);", "const SO = W.solid || (W.solid = makeSolids(W)); for (const b of M.buses) SO.bus(b, collision);"],
    ["for (const s of M.stalls) collision.addCircle(s[0] / 100, s[1] / 100, 0.9, 2);", "for (const s of M.stalls) SO.stall(s, collision);"],
    // a Metro pier stands on a 2.4 m square plinth (beta/world/propsChunk.js draws it): solid to its corners, not a 1 m circle
    ["      collision.addCircle(x, z, 1.0, 2);\n    }, 10);", "      { const ry = -Math.atan2(dx, -dz) + Math.PI / 2, c = Math.cos(ry), s = Math.sin(ry); collision.addRing([[-1.2, -1.2], [1.2, -1.2], [1.2, 1.2], [-1.2, 1.2]].flatMap(([u, v]) => [x + u * c - v * s, z + u * s + v * c]), 2); }\n    }, 10);"],
    ["        collision.addCircle(x, z, 0.12, 2);", "        (W.solid || (W.solid = makeSolids(W))).board('street', x, z, fx, fz, collision);"],
    ["index.chunks[ci].extras.push({ kind: 'banner', x, z, fx, fz, s: rng.int(0, W.signs.banners.length - 1) });", "index.chunks[ci].extras.push({ kind: 'banner', x, z, fx, fz, s: rng.int(0, W.signs.banners.length - 1) }); (W.solid || (W.solid = makeSolids(W))).board('banner', x, z, fx, fz, collision);"],
    // every lamp, pole and signal known by where it stands, with what's drawn and solid of it, so it can be knocked down (beta/world/smash.js)
    ["import { addLandmarks, buildLandmark } from './landmarks.js';", "import { addLandmarks, buildLandmark } from './landmarks.js';\nimport { smash } from '../beta/world/smash.js';"],
    ["    W.lampSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)));\n    collision.addCircle(x, z, 0.16, 2);\n    W.lampPositions.push([x + dx * 1.75, z + dz * 1.75, tag]);", "    { const L = [x + dx * 1.75, z + dz * 1.75, tag]; smash(W).reg('lamp', x, z, yawX(dx, dz), { items: [[W.lampSet, W.lampSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)))]], cols: [collision.addCircle(x, z, 0.16, 2)], lamp: L }); W.lampPositions.push(L); }"],
    ["    byRoad.get(p[2]).push({ x, z, d: p[3] });\n    collision.addCircle(x, z, 0.14, 2);", "    byRoad.get(p[2]).push({ x, z, d: p[3], c: collision.addCircle(x, z, 0.14, 2) });"],
    ["      W.poleSet.add(a.x, a.z, compose(a.x, 0.15, a.z, yawX(-dirz, dirx)));", "      smash(W).reg('pole', a.x, a.z, yawX(-dirz, dirx), { items: [[W.poleSet, W.poleSet.add(a.x, a.z, compose(a.x, 0.15, a.z, yawX(-dirz, dirx)))]], cols: [a.c] });"],
    ["    W.sigSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)));\n    collision.addCircle(x, z, 0.14, 2);\n    W.signalHeads.push({ node: nmap ? nmap[s[3]] : s[3], x, z, dx, dz, bulbs: [], tag });", "    { const H = { node: nmap ? nmap[s[3]] : s[3], x, z, dx, dz, bulbs: [], tag }; smash(W).reg('signal', x, z, yawX(dx, dz), { items: [[W.sigSet, W.sigSet.add(x, z, compose(x, 0.15, z, yawX(dx, dz)))]], cols: [collision.addCircle(x, z, 0.14, 2)], head: H }); W.signalHeads.push(H); }"]],
  [S('world/props.js')]: [["for (const w of M.walls) {", "for (const w of []) {"]],
  // the four-wheel ground of beta/vehicles/physics.js
  // your own body on the minimap and the big map while you're away in someone (beta/game/powers.js: G.extraMarks)
  [S('game/hud.js')]: [
    ["const marks = g.rides ? g.rides.markers() : [];", "const marks = (g.rides ? g.rides.markers() : []).concat(g.extraMarks ? g.extraMarks() : []);"],
    ["      if (m.kind === 'pax') {", "      if (m.kind === 'body') {\n        x.fillStyle = '#b26bff'; x.strokeStyle = '#fff'; x.lineWidth = 2;\n        x.beginPath(); x.arc(0, 0, 7, 0, Math.PI * 2); x.fill(); x.stroke();\n        x.fillStyle = '#fff'; x.beginPath(); x.arc(0, -2.5, 2, 0, Math.PI * 2); x.fill(); x.fillRect(-2.5, 0.5, 5, 4);\n      } else if (m.kind === 'pax') {"],
    ["x.fillStyle = m.kind === 'pax' ? '#3ddc84' : '#ff3d24';", "x.fillStyle = m.kind === 'body' ? '#b26bff' : m.kind === 'pax' ? '#3ddc84' : '#ff3d24';"],
    ["for (const m of (g.rides ? g.rides.markers() : [])) {", "for (const m of (g.rides ? g.rides.markers() : []).concat(g.extraMarks ? g.extraMarks() : [])) {"],
    ["x.fillStyle = m.kind === 'pax' ? '#3ddc84' : '#ff3d24';", "x.fillStyle = m.kind === 'body' ? '#b26bff' : m.kind === 'pax' ? '#3ddc84' : '#ff3d24';"],
    ["      x.beginPath(); x.arc(X, Y, 6, 0, Math.PI * 2); x.fill();", "      x.beginPath(); x.arc(X, Y, m.kind === 'body' ? 8 : 6, 0, Math.PI * 2); x.fill();\n      if (m.kind === 'body') { x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); x.font = '700 12px \"Baloo 2\"'; x.textAlign = 'left'; const t = 'Your body'; x.fillStyle = 'rgba(15,14,12,0.75)'; x.fillRect(X + 11, Y - 9, x.measureText(t).width + 8, 17); x.fillStyle = '#e6d2ff'; x.fillText(t, X + 15, Y + 4); }"],
  ],
  [S('game/camera.js')]: [
    // any auto's seat looks down over the dash the same way (not just your own)
    ["const pitch = (p.inAuto ? -0.17 : -0.035)", "const pitch = (p.inAnyAuto ? -0.17 : -0.035)"],
    ["this.setFov(dt, (p.inAuto ? 78 : 70) + speed * 0.3);", "this.setFov(dt, (p.inAnyAuto ? 78 : 70) + Math.min(speed, 27.8) * 0.3);"],
    // (the view widens with speed up to 100 km/h and no further: past that it was all fisheye)
    // (the view from behind a vehicle sits closer, and going fast it draws back a little and widens a little, then no more:
    // it used to go back 7 cm and open two-thirds of a degree for every metre a second, without end to the first)
    ["this.setFov(dt, 60 + speed * 0.65);", "this.setFov(dt, 60 + 9 * (1 - Math.exp(-speed / 24)));"],
    ["const dist = (far ? 8.6 : 6.2) + speed * 0.07 + big;", "const dist = (far ? 8.6 : 5.3) + 1.1 * (1 - Math.exp(-speed / 20)) + big;"],
    ["const height = (far ? 3.3 : 2.45) + speed * 0.015 + this.pitchOff * 4 + big * 0.35;", "const height = (far ? 3.3 : 2.2) + 0.22 * (1 - Math.exp(-speed / 20)) + this.pitchOff * 4 + big * 0.35;"],
    ["this.setFov(dt, 58 + Math.abs(p.v) * 0.8);", "this.setFov(dt, 58 + Math.min(Math.abs(p.v), 27.8) * 0.8);"]],
  [S('game/audio.js')]: [
    // (nobody in particular: a good bit quieter, and a longer breath before the next. Someone you've just done something to: a little quieter)
    ["if (pri === 0 && this.voiceEnd && now < this.voiceEnd + 2.5) return false;", "if (pri === 0 && this.voiceEnd && now < this.voiceEnd + 9) return false;"],
    ["let v; try { v = this.play('v_' + id, { vol: 0.95 * vol,", "let v; try { v = this.play('v_' + id, { vol: 0.95 * vol * (pri === 0 ? 0.75 : pri === 1 ? 0.95 : 1),"],
    // (the smallest buffer the browser can manage leaves the audio thread no room at all: a heavy frame and the sound breaks up. A few
    // hundredths of a second more can't be heard)
    ["const ctx = this.ctx = new AC();", "const ctx = this.ctx = new AC({ latencyHint: 0.06 });"],
    // (up is up: told so once, not sixty times a second)
    ["L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }", "if (!this._upSet) { this._upSet = true; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; } }"],
  ],
  [S('vehicles/vehicle.js')]: [
    // (the drive mode, for the cluster: beta/vehicles/brakes.js names it)
    ["this.cockpit.update(this.steer, Math.abs(this.v) * 3.6, this.gear, this.rpm);", "this.cockpit.update(this.steer, Math.abs(this.v) * 3.6, this.gear, this.rpm, 0, this._modeName || '');"],
    // the moving bits of the body (wipers, the rear wing) by their vertices, for beta/vehicles/details.js
    ["this.wheels = m.wh || [];", "this.wheels = m.wh || []; this.moving = m.moving || null;"],
    // the nose goes down under brakes and up under power: a spring on the body now (beta/vehicles/details.js), so here
    // only the road's own slope
    ["this.pitch += (Math.atan2(hF - hR, S.wb) - clamp(a * 0.006, -0.025, 0.025) - this.pitch) * Math.min(1, dt * 12);", "this.pitch += (Math.atan2(hF - hR, S.wb) - this.pitch) * Math.min(1, dt * 12);"],
    // a body that dents counts its damage by its dents (beta/vehicles/damage.js), not twice
    ["if (imp < 4 || (v._kT || 0) > now) return;", "if (imp < 4 || (v._kT || 0) > now || v.dentDmg) return;"],
    // the wheel's drop into a pothole is the hole's and the wheel's own (beta/vehicles/potholes.js)
    ["for (const p of W.potholeNear || []) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) h -= 0.07 * (1 - d / p.r); }", "if (this.potDip) h -= this.potDip(x, z); else for (const p of W.potholeNear || []) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) h -= 0.07 * (1 - d / p.r); }"],
    // an auto off the street has the driver's seat view your own has (it had none: the inside view fell back to behind)
    ["    else if (type === 'tempo') this.cockpitEye = [1.05, 1.6, 0.32];", "    else if (type === 'tempo') this.cockpitEye = [1.05, 1.6, 0.32];\n    else if (type === 'auto') this.cockpitEye = [0.3, 1.49, 0];"],
    ["case 'bike': case 'bikeP': case 'bullet': case 'superbike': return buildBike({ parked: true });", "case 'bike': case 'bikeP': return buildBike({ parked: true }); case 'bullet': case 'superbike': return buildBike({ parked: true, kind: type });"],
    ["    const hF = this.heightAt(this.x + hx * half, this.z + hz * half), hR = this.heightAt(this.x - hx * half, this.z - hz * half);\n    const jolt = Math.max(Math.abs(hF - this.prevH[0]), Math.abs(hR - this.prevH[1]));", "    const gr = this.ground(hx, hz, sp), hF = gr.f, hR = gr.r, jolt = gr.jolt;"],
    ["this.onFootpath = this.deck < 0 && !W.surf.isRoad(this.x, this.z);", "this.onFootpath = this.deck < 0 && gr.off > 0.5;"],
    ["-clamp(this.latAcc * 0.01, -0.06, 0.06);", "-clamp(this.latAcc * 0.01, -0.06, 0.06) + gr.roll;"],
    ["import { buildScooter, buildBike, buildCycle, buildCar, buildBus, buildTempo, buildAuto, PAINTS, wheelsOf } from './models.js';", "import { buildScooter, buildBike, buildCycle, buildCar, buildBus, buildTempo, buildAuto, PAINTS, wheelsOf, VARIANTS, baseOf } from './models.js';"],
    ["default: return buildCar('hatch');", "default: return VARIANTS[type] ? buildCar(type, { interior: true }) : buildCar('hatch');"],
    ["this.cockpitEye = this.cockpit.eye;", "this.cockpitEye = this.cockpit.eye; this.fitCabin && this.fitCabin();"],
    ["if (['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super'].includes(type)) {", "if (['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super'].includes(baseOf(type))) {"],
    ["export function defaultPaint(type, rng) {", "export function defaultPaint(type, rng) {\n  type = baseOf(type);"],
    // a car corners on its tyres (beta/vehicles/tyres.js); two-wheelers keep the leaning model below
    ["    // ---- steering (bicycle model, less lock at speed)\n", "    const sp = Math.abs(this.v);          // (read below the steering too: the suspension's jolts)\n    if (!S.two && this.tyres) this.tyres(dt, inp, thr); else if (S.two && this.twoWheel) this.twoWheel(dt, inp, thr); else {\n    // ---- steering (bicycle model, less lock at speed)\n"],
    // a two-wheeler leans as beta/vehicles/twowheel.js works out (its own limits), and a superbike's front can come up
    ["const leanT = S.two ? clamp(Math.atan(this.latAcc / 9.81), -0.6, 0.6)", "const leanT = S.two ? (this.bikeLean !== undefined ? this.bikeLean : clamp(Math.atan(this.latAcc / 9.81), -0.6, 0.6))"],
    ["this.lean += (leanT - this.lean) * Math.min(1, dt * 6);", "this.lean += (leanT - this.lean) * Math.min(1, dt * (S.two && this.bikeLean !== undefined ? 30 : 6));"],
    ["this.tilt.position.set(0, this.y + idle - (this.lower || 0), 0);\n    this.tilt.rotation.set(this.lean, 0, this.pitch, 'YXZ');", "this.tilt.position.set(0, this.y + idle - (this.lower || 0) + (this.wheelie ? Math.sin(this.wheelie) * this.spec.wb * 0.5 : 0), 0);\n    this.tilt.rotation.set(this.lean, 0, this.pitch + (this.wheelie || 0), 'YXZ');"],
    ["    this.latAcc = this.v * this.w;\n", "    }\n    this.latAcc = this.v * this.w;\n"],
    // (a car's handbrake is the locked back wheels in tyres.js, not a flat drag on top)
    ["if (inp.handbrake) a -= Math.sign(v) * (S.two ? 3.5 : 4.5);", "if (inp.handbrake && (S.two || !this.tyres)) a -= Math.sign(v) * (S.two ? 3.5 : 4.5);"],
  ],
  // C switches first and third person; rolling is Ctrl; the jhola is Q; vehicles are E
  // the Fixed list: what isn't one key (launch control, the hazards both ways) and the keys that can't move
  [S('game/settings.js')]: [
    ['<div class="row"><div class="rl">Performance stats</div><div class="rc"><span class="kbd">F3</span></div></div></div>', '<div class="row"><div class="rl">Performance stats</div><div class="rc"><span class="kbd">F3</span></div></div><div class="row"><div class="rl">Launch control: from a stop, hold the brake or handbrake, floor it, let the brake go</div><div class="rc"><span class="kbd">S</span><span class="kbd">W</span></div></div><div class="row"><div class="rl">Hazard lights, the other way: both indicators at once</div><div class="rc"><span class="kbd">,</span><span class="kbd">.</span></div></div><div class="row"><div class="rl">Fly (on foot, free roam): double-tap</div><div class="rc"><span class="kbd">Space</span></div></div><div class="row"><div class="rl">Time of day (free roam)</div><div class="rc"><span class="kbd">[</span><span class="kbd">]</span></div></div><div class="row"><div class="rl">Terminal</div><div class="rc"><span class="kbd">&#96;</span><span class="kbd">/</span></div></div></div>'],
  ],
  [S('game/keys.js')]: [
    // everything the beta adds, in the list (Pause > Controls) and rebindable like the rest
    ["{ id: 'lookback', label: 'Look back', group: 'Vehicle', def: 'KeyB' },", "{ id: 'lookback', label: 'Look back (on foot: Brahmarakshas, hold on someone)', group: 'Vehicle', def: 'KeyB' },"],
    ["{ id: 'beacon', label: 'Roof lights (beacon, strobes)', group: 'Vehicle', def: 'KeyN' },", "{ id: 'beacon', label: 'Roof lights (on foot: Munja, hold to see everyone near)', group: 'Vehicle', def: 'KeyN' },"],
    ["{ id: 'music', label: 'Music system', group: 'Vehicle', def: 'KeyU' },", "{ id: 'music', label: 'Radio: next station, then off', group: 'Vehicle', def: 'KeyU' }, { id: 'indl', label: 'Left indicator (cancels itself after the turn)', group: 'Vehicle', def: 'Comma' }, { id: 'indr', label: 'Right indicator', group: 'Vehicle', def: 'Period' }, { id: 'hazard', label: 'Hazard lights', group: 'Vehicle', def: 'Semicolon' }, { id: 'engine', label: 'Engine on or off (off a few minutes: a cold start)', group: 'Vehicle', def: 'Quote' }, { id: 'mode', label: 'Drive mode (cars that have them)', group: 'Vehicle', def: 'KeyO' }, { id: 'arms', label: 'Weapons wheel (hold); drag someone out cold', group: 'Do', def: 'KeyZ' }, { id: 'diary', label: 'Missions, diary', group: 'Menus', def: 'KeyJ' },"],
    ["{ id: 'bag', label: 'Jhola', group: 'Menus', def: 'KeyE' },", "{ id: 'bag', label: 'Jhola', group: 'Menus', def: 'KeyQ' },"],
    ["{ id: 'roll', label: 'Roll; camera when driving', group: 'Do', def: 'KeyC' }", "{ id: 'roll', label: 'Roll', group: 'Do', def: 'ControlLeft' }"],
    ["{ id: 'punch', label: 'Punch (click works too)',", "{ id: 'punch', label: 'Punch (click works too; hold right-click to block)',"],
    ["{ id: 'cam', label: 'Change camera', group: 'Vehicle', def: 'KeyV' }", "{ id: 'cam', label: 'First or third person', group: 'Move', def: 'KeyC' }, { id: 'vetal', label: 'Vetal: hold on someone to take them over, tap to go home', group: 'Powers', def: 'KeyV' }"],
    // F for what's in front of you (shops, doors, counters, pumps, animals), E for vehicles (in, out, take one),
    // T to talk to anyone (beta/game/talk.js); the phone moves to I
    ["{ id: 'use', label: 'Talk, walk in, get in or out', group: 'Do', def: 'KeyF' },", "{ id: 'use', label: 'Walk in, counters, pet, fuel up', group: 'Do', def: 'KeyF' }, { id: 'vehicle', label: 'Get in or out of a vehicle', group: 'Do', def: 'KeyE' }, { id: 'talk', label: 'Talk to someone (ask them out too)', group: 'Do', def: 'KeyT' },"],
    ["{ id: 'phone', label: 'Phone', group: 'Menus', def: 'KeyT' },", "{ id: 'phone', label: 'Phone', group: 'Menus', def: 'KeyI' },"],
  ],
  [S('game/phone.js')]: [
    ["if (e.code === 'KeyT' && this.g.state === 'play'", "if (e.code === 'KeyI' && this.g.state === 'play'"],
    ["if (c === 'KeyT' || c === 'Escape')", "if (c === 'KeyI' || c === 'Escape')"],
    ['this.badge.innerHTML = `<span class="kbd">T</span>', 'this.badge.innerHTML = `<span class="kbd">I</span>'],
  ],
  // the strip of keys along the bottom: the jhola is Q now (E is vehicles), I the phone
  // (the character preview and the outfit studio draw bodies through beta/draw/skin.js's views, as the game does)
  [S('ui/hud.js')]: [["else if (e.code === 'Enter') { e.preventDefault(); vis()[this.tSel || 0]?.click(); }", "else if (e.code === 'Enter' && !e.repeat && performance.now() - (this.game._titleAt || 0) > 500) { e.preventDefault(); vis()[this.tSel || 0]?.click(); }"], ["this.nerd = el('div', 'h nerd', 'E jhola · J diary · F3 stats');", "this.nerd = el('div', 'h nerd', 'Q jhola · I phone · J diary · F3 stats');"]],
  [S('game/guide.js')]: [["['F', 'Interact, enter, get in or out'], ['E', 'Jhola'],", "['F', 'Walk in, counters, pet'], ['E', 'Get in or out of a vehicle'], ['T', 'Talk to someone'], ['Q', 'Jhola'],"], ["['T', 'Phone'],", "['I', 'Phone'],"], ["['V', 'Camera (anytime)'],", "['C', 'First or third person'],"]],
  [S('game/pilot.js')]: [
    // (which vehicle it was, for a hit and run: beta/game/wanted.js)
    ["this.events.push({ type: 'gotHit', speed: o.v, who: o.type });", "this.events.push({ type: 'gotHit', speed: o.v, who: o.type, o });"],
    // knocked down by the traffic: down for as long as it was hard, and what hit you is known (beta/draw/falls.js throws you)
    ["this.downT = 3.2;", "this.downT = 3.2 + Math.min(5, Math.abs(o.v || 0)*0.25); this._hitBy = o;"],
    // a jump as high as you can (about half a metre standing, a little more off a run), and a fall that hurts by its
    // height: under three metres you take it in your knees; above, you're down and hurt, the more the higher; from
    // ten metres or so on to the road it kills you (into the river it's a splash)
    ["else { F.air = true; F.vy = 3.4;", "else { F.air = true; F.vy = 3.0 + Math.min(0.9, (F.v || 0)*0.13);"],
    ["if (F.vy < -7.5 && !wet) { this.downT = 2.2;", "if (F.vy < -7.5 && !wet) { const fh = F.vy*F.vy/19.6; if (fh > 7) this.hp = (this.hp ?? 100) - (fh - 7)*14; this.downT = 2.2 + Math.min(4, (fh - 2.9)*0.5);"],
    // the walk to a door: a long way round the car you jog (beta/vehicles/route.js)
    ["(pup && c[0] === 'AltLeft')", "(pup && !pup.jog && c[0] === 'AltLeft')"],
    // you go over with the auto when it goes over (and up with it on two wheels)
    ["H.holder.rotateX(v.lean || 0);", "H.holder.rotateX(v.lean || (/^auto/.test(v.type || 'auto') ? v.tilt.rotation.x : 0));"],
    // prompts name the vehicle: its real model, not its body type
    ["S.two ? `Get on the ${S.name.toLowerCase()}` : `Get in the ${S.name.toLowerCase()}`", "S.two ? `Mount ${S.real || S.name}` : `Get in the ${S.real || S.name}`"],
    ["label: `Take the parked ${S.name.toLowerCase()}`", "label: `Take the parked ${S.real || S.name}`"],
    ["label: `Take the ${specOf(o.type).name.toLowerCase()} from its driver`", "label: `Take the ${specOf(o.type).real || specOf(o.type).name} from its driver`"],
    ["name: veh.spec.name.toLowerCase(), x: r.x", "name: veh.spec.real || veh.spec.name, x: r.x"],
    // a parked ride taken: off the parked rows now, not once the camera's gone 6 m (two of it drawn till then)
    ["      for (const it of r.items) it.off = true;\n", "      for (const it of r.items) it.off = true;\n      this.W._propX = undefined; if (window.__post && window.__post.shadows) window.__post.shadows.dirty = true;\n"],
    // slowed on foot (dazed after Vetal: beta/game/powers.js sets slowMul)
    ["const target = (fw || sd) ? (F.swim ? (run ? 2.1 : 1.35) : run ? SPRINT * (this.sprintMul ? this.sprintMul() : 1) : k('AltLeft') ? WALK : JOG) : 0;", "const target = ((fw || sd) ? (F.swim ? (run ? 2.1 : 1.35) : run ? SPRINT * (this.sprintMul ? this.sprintMul() : 1) : k('AltLeft') ? WALK : JOG) : 0) * (this.slowMul ? this.slowMul() : 1) * (this.crouchMul ? this.crouchMul() : 1);"],
    // knocked down by a vehicle only if it's coming at you: walking into the back of a scooter riding away from you
    // (or alongside one) is a bump, not being run over (it counted its speed, not which way it was going)
    ["if ((o.v || 0) > 3.5 && !this.downT) {", "if (!this.downT && (o.v || 0) > 2.5 && (o.hx * o.v * rx + o.hz * o.v * rz) / (Math.hypot(rx, rz) || 1) > 2.5) {"],
    // sat in a chair you're not pushed out of it (a salon chair, the jhula: solid now, beta interiors)
    ["if (res && !(F.air && res.kind === 2 && F.y - groundY() > 0.55) && !(F.swim && res.kind === 4)) {", "if (res && !this.seated && !(F.air && res.kind === 2 && F.y - groundY() > 0.55) && !(F.swim && res.kind === 4)) {"],
    // a scene that moves you itself (beta/game/acts.js: dragging someone, walking up to them) sets the pace, as a roll does
    ["    if (A && A.kind === 'roll') { F.vx = A.vx; F.vz = A.vz; }", "    if (A && (A.kind === 'roll' || A.move)) { F.vx = A.vx || 0; F.vz = A.vz || 0; }"],
    // standing about a while: arms folded, the phone out (beta/draw/alive.js picks it)
    ["      const a = F.v < 0.25 ? 'idle' : F.v < 2.2 ? 'walk' : F.v < 4.6 ? 'jog' : 'sprint';", "      const a = F.v < 0.25 ? (this._fid || 'idle') : F.v < 2.2 ? 'walk' : F.v < 4.6 ? 'jog' : 'sprint';"],
    ["      this.human.play(a, { speed: a === 'idle' ? 1 : clamp(F.v / nat, 0.6, 1.6) });", "      this.human.play(a, { speed: !nat || a === 'idle' ? 1 : clamp(F.v / nat, 0.6, 1.6) });"],
    // you never vanish: from the driver's seat too your body stays, only the head is cut (beta/draw/skin.js)
    ["this.human.holder.visible = !!this.riderShown && !on;", "this.human.holder.visible = !!this.riderShown; this.human._fp = on;"],
    ["if (this.human && !this.cockpitOn && !this.human.holder.visible)", "if (this.human && !this.human.holder.visible)"],
    ["this.human.holder.visible = !this.cockpitOn;", "this.human.holder.visible = true;"],
    ["import { carSpec } from '../vehicles/models.js';", "import { carSpec, VARIANTS } from '../vehicles/models.js';"],
    ["const CAR_DOOR = new Set(['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super']);", "const CAR_DOOR = new Set(['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super', ...Object.keys(VARIANTS)]);"],
    ["      if (!(this.onFoot && this.offer) && this.useHook && this.useHook()) { /* walked in */ }\n      else if (this.onFoot && this.offer) this.enter(this.offer, traffic);\n      else if (!this.onFoot) this.exit(traffic);", "      if (this.onFoot && this.offer && this.offer.kind === 'pet') this.enter(this.offer, traffic);\n      else if (this.useHook) this.useHook();"],
    ["    if (input.took('KeyF') && this.busy <= 0) {", "    if (input.took('KeyE') && this.busy <= 0) { if (this.onFoot && this.offer && this.offer.kind !== 'pet') this.enter(this.offer, traffic); else if (!this.onFoot) this.exit(traffic); }\n    if (input.took('KeyF') && this.busy <= 0) {"],
    ["const consider = (d, o) => { if (d < bd) { bd = d; best = o; } };", "const consider = (d, o) => { if (d < bd) { bd = d; best = o; o.dist = d; } };"],
    // the car you walked up to and opened is the one you drive (beta/vehicles/cardoor.js built it as the door opened),
    // and whoever was at its wheel you've already hauled out
    ["      veh = new Vehicle(this.W, this.scene, this.vmats, r.kind, r.col);", "      veh = offer.pre || new Vehicle(this.W, this.scene, this.vmats, r.kind, r.col);"],
    ["      veh = new Vehicle(this.W, this.scene, this.vmats, o.type, o.col);", "      veh = offer.pre || new Vehicle(this.W, this.scene, this.vmats, o.type, o.col);"],
    ["      const dr = this.spawnAngryDriver(o);", "      const dr = offer.drv !== undefined ? offer.drv : this.spawnAngryDriver(o);"],
  ],
  // talk to anyone: no hearts over strangers any more (yours keep theirs: blue in your phone, black your partner), and
  // anyone with a name in a room can be talked to; it opens the talk (beta/game/talk.js), chatting them up leads to dating
  // each footprint keeps its storeys, so flying stops at a wall but clears the roof (bldTop, beta/game/commands.js flight)
  [S('world/mapdata.js')]: [
    ["      const rec = { rings: [r], bb: [x0, z0, x1, z1], tag };", "      const rec = { rings: [r], bb: [x0, z0, x1, z1], tag, top: (B.y || 0) + (B[2] || 1)*3.2 + 1.4 };"],
    ["  inBuilding(x, z) { return this.test(this.bld, x, z); }", "  inBuilding(x, z) { return this.test(this.bld, x, z); }\n  bldTop(x, z) { const l = this.bld.get(this.chunkOf(x, z)); let t = -1; if (l) for (const p of l) { if (x < p.bb[0] || x > p.bb[2] || z < p.bb[1] || z > p.bb[3]) continue; if (p.top > t && pointInRings(x, z, p.rings)) t = p.top; } return t; }"],
  ],
  [S('world/interiors.js')]: [
    // the plate goes on the table you're at: its floor and its height (a shop where it stands is on its own floor, a
    // juice bar's ledge is higher than a table; beta/world/shopin.js gives the seat its table's height)
    ["m.position.set(tx, FLOOR + 0.79, tz); food.position.set(tx, FLOOR + 0.8, tz);", "const FY = C.floorY ?? FLOOR, TY = C.seat.tableH ?? 0.79; m.position.set(tx, FY + TY, tz); food.position.set(tx, FY + TY + 0.01, tz);"],
    ["rest = new THREE.Vector3(tx, FLOOR + 0.86, tz)", "rest = new THREE.Vector3(tx, (C.floorY ?? FLOOR) + (C.seat.tableH ?? 0.79) + 0.07, tz)"],
    // a bank's counter has real glass over it: clear panes in a steel frame, the tellers seen through them
    ["      box(B, 0, 1.75, D - 2, W * 0.7, 1.4, 0.04, 0xcfe2ec);   // glass partition", "      { const np = Math.max(3, Math.floor(W * 0.7 / 2.4)); for (let i = 0; i <= np; i++) box(B, (i - np / 2) * (W * 0.7 / np), 1.75, D - 2, 0.05, 1.4, 0.05, 0x9aa0a6); box(B, 0, 2.47, D - 2, W * 0.7, 0.05, 0.06, 0x9aa0a6);\n        const gm = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 1.36, 0.012), new THREE.MeshStandardMaterial({ color: 0xe4f1f6, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, depthWrite: false })); gm.position.set(O.x, 1.75 + FLOOR, O.z + D - 2); gm.renderOrder = 2; R.dyn.push(gm); }"],
    // the mirrors are real (beta/world/mirrors.js): each one's glass, where it is, which way it faces
    ["const solid = (cx, cz, sx, sz, kind = 0) =>", "const mir = (cx, cy, cz, w, h, ry) => (R.mirrors || (R.mirrors = [])).push({ x: O.x + cx, y: cy + FLOOR, z: O.z + cz, w, h, ry });\n    const solid = (cx, cz, sx, sz, kind = 0) =>"],
    ["box(B, W / 2 - 0.05, 1.4, D - 2, 0.04, 2.2, 1.2, 0xbcd0dc);", "box(B, W / 2 - 0.05, 1.4, D - 2, 0.04, 2.2, 1.2, 0xbcd0dc); mir(W / 2 - 0.075, 1.4, D - 2, 1.2, 2.2, -Math.PI / 2);"],
    ["box(B, x, 1.75, D - 0.05, 1.2, 1.5, 0.04, 0xcfe0ea);", "box(B, x, 1.75, D - 0.05, 1.2, 1.5, 0.04, 0xcfe0ea); mir(x, 1.75, D - 0.075, 1.2, 1.5, Math.PI);"],
    ["box(B, x, 1.7, D - 0.05, 1.0, 1.25, 0.04, 0xbcd0dc);", "box(B, x, 1.7, D - 0.05, 1.0, 1.25, 0.04, 0xbcd0dc); mir(x, 1.7, D - 0.075, 1.0, 1.25, Math.PI);"],
    ["box(B, 0, 1.65, D - 0.05, W - 2, 1.0, 0.04, 0xbcd0dc);", "box(B, 0, 1.65, D - 0.05, W - 2, 1.0, 0.04, 0xbcd0dc); mir(0, 1.65, D - 0.075, W - 2, 1.0, Math.PI);"],
    ["box(B, -W / 2 + 0.03, 1.5, D / 2, 0.03, 2.2, D * 0.7, 0xbcd0dc);", "box(B, -W / 2 + 0.03, 1.5, D / 2, 0.03, 2.2, D * 0.7, 0xbcd0dc); mir(-W / 2 + 0.05, 1.5, D / 2, D * 0.7, 2.2, Math.PI / 2);"],
    // everything in a room you'd walk into is solid in its own footprint: counters, cases, racks, shelves, tables,
    // machines, the bar (only some had a solid() of their own). What's under your shins (rugs, floor) or over your
    // head (lights, boards, the ceiling) isn't, nor a chair or stool (you're sat in those)
    ["      b.addGeo(UNIT, m, hex(col));\n    };", "      b.addGeo(UNIT, m, hex(col));\n      const y0 = cy - sy / 2, y1 = cy + sy / 2;\n      if (y1 > 0.15 && y0 < 1.2 && Math.max(sx, sz) >= 0.2 && Math.min(sx, sz) >= 0.03 && !(sx <= 0.62 && sz <= 0.62 && y1 <= 1.15)) {\n        const cs = Math.cos(ry), sn = Math.sin(ry), q = (a, c) => [O.x + cx + a * cs + c * sn, O.z + cz - a * sn + c * cs];\n        C.addRing([...q(-sx / 2, -sz / 2), ...q(sx / 2, -sz / 2), ...q(sx / 2, sz / 2), ...q(-sx / 2, sz / 2)], 2);\n      }\n    };"],
    // a Pune bakery, not a café with a counter: glass cases down both sides (khari, toast, nankatai, puffs, cream
    // rolls), jars of biscuits on top, the bread on the shelves behind the till, a lit cake fridge, two tables
    ["else if (k === 'bakery') { aes = pick(['bakery', 'pastel', 'heritage']); layout = 'counter'; }", "else if (k === 'bakery') { aes = pick(['bakery', 'heritage', 'local']); layout = 'bakery'; scale = 0.8; }"],
    ["      } else if (lay === 'lounge') {", `      } else if (lay === 'bakery') {
        const goods = [0xd9a35b, 0xe8c27a, 0xc98a3a, 0xf0e0b0, 0xf2d8a0, 0xb8742e, 0xfaf3e3];
        const lenC = Math.min(D - 4.2, 6), z0 = 1.8, zc = z0 + lenC / 2;
        for (const s of [-1, 1]) {
          const x = s * (W / 2 - 0.75);
          box(B, x, 0.45, zc, 0.8, 0.9, lenC, S.counter || 0xe8e4dc); solid(x, zc, 0.8, lenC);
          box(GL, x, 1.12, zc, 0.78, 0.44, lenC - 0.04, 0xf6efe0);
          let i = 0;
          for (let z = z0 + 0.25; z < z0 + lenC - 0.2; z += 0.36) box(B, x, 0.93, z, 0.6, 0.05, 0.28, goods[(i++ * 5 + (s > 0 ? 2 : 0)) % goods.length]);
          for (let z = z0 + 0.3; z < z0 + lenC - 0.2; z += 0.45) { box(B, x, 1.48, z, 0.16, 0.28, 0.16, 0xe8e0c8); box(B, x, 1.64, z, 0.17, 0.04, 0.17, 0xc8302a); }
          for (let z = z0 + 0.8; z < z0 + lenC; z += 1.6) browse(x - s * 0.9, z);
        }
        shelf(0, D - 0.35, Math.min(W - 3, 8), false, 5, 2.4, [0xd9a35b, 0xc98a3a, 0xfaf3e3, 0xe8c27a, 0xf2d8a0, 0xb8742e]);
        box(GL, W / 2 - 1.2, 0.95, D - 1.0, 0.9, 1.9, 0.7, 0xfff4e6); solid(W / 2 - 1.2, D - 1.0, 0.9, 0.7);
        table2(-1.6, 1.4); table2(1.6, 1.4);
      } else if (lay === 'lounge') {`],
    // a mark only over people you know: a small dot for a contact, blue for someone you could see, black for your partner
    ["      if (!p.name || (G.date && G.date.blocked(p)) || !(p.dateWith || G.date && G.date.eligible(p))) continue;", "      if (!p.name || (G.date && G.date.blocked(p)) || (!p.dateWith && this.heartKind(p) === 'new')) continue;"],
    ["if (!p.name || p.walkedOff || !(p.dateWith || D && D.eligible(p)) || (C.seat && !p.dateWith)) continue;", "if (!p.name || p.walkedOff || !p.dateWith) continue;"],
  ],
  [S('game/shops.js')]: [
    // what a shop is, the same inside as its board says outside: a listing's own category decides it when that's a
    // definite trade (a "Sagar Hair Cutting Salon" is a barber's, not a tapri for the cutting or an Udupi for the Sagar;
    // "Samsung Service Centre" listed as mobiles isn't a garage, "Hero Mobiles" isn't a showroom, "Dental Fitness Clinic"
    // isn't a gym, "Shivanjali Acupuncture" isn't a puncture shop). A few names say it better than the category: a hotel
    // chain's rooms, a study library or a gaming café filed under books, a paan shop or a florist filed under grocery.
    // A name that says salon is a salon whatever it's filed under (a food listing's "spa cuisine" isn't)
    ["  if (cat === 'police') return 'chowki';\n", "  if (cat === 'police') return 'chowki';\n  if (/\\boyo\\b|collection o\\b|treebo|fabhotel/.test(n)) return 'lodge';\n  if (cat === 'books' && /library|abhyasika|अभ्यासिका|vachanalay|वाचनालय|reading room|study ?(?:room|centre|center|hall)/.test(n)) return 'library';\n  if (cat === 'books' && /gaming|game ?zone|arcade/.test(n)) return 'gaming';\n  if (cat in TRUST_CAT && !(cat === 'grocery' && /paan|\\bpan shop|pan house|tambakhu|flower|florist|phool/.test(n))) return TRUST_CAT[cat];\n  if (/\\bhair|salon|saloon|barber|unisex|beauty ?parlou?r|(?:men'?s|gents|ladies) ?parlou?r|nail (?:art|studio|bar)/.test(n) || (!/food|hotel|cafe/.test(cat || '') && /\\bspa\\b|massage/.test(n))) return 'barber';\n"],
    ["export function kindOf(name, cat) {", "const TRUST_CAT = { salon: 'barber', clothes: 'clothes', shoes: 'shoes', pharmacy: 'pharmacy', clinic: 'clinic', mobile: 'mobile', electronics: 'electronics', jewellery: 'jeweller', bank: 'bank', atm: 'bank', books: 'books', optician: 'optician', travel: 'travel', gym: 'gym', garage: 'garage', grocery: 'kirana' };\nexport function kindOf(name, cat) {"],
    ["|tyres?|puncture|mechanic|", "|tyres?|\\bpuncture|mechanic|"],
    ["if (/mastani|juice|lassi|shake|falooda/.test(n)) return 'juice';", "if (/mastani|juice|\\blassi|shake|falooda/.test(n)) return 'juice';"],
    // (and the names that said the wrong thing: cutting chai, not a haircut; a juice bar isn't a bar; Sagar is a name
    // half Pune has, not only an Udupi; body builders are a gym)
    ["if (/amruttulya|\\bchai\\b|\\btea\\b|tapri|cutting/.test(n)) return 'tapri';", "if (/amruttulya|\\bchai\\b|\\btea\\b|tapri|cutting (?:chai|tea)/.test(n)) return 'tapri';"],
    ["if (/\\bpub\\b|brew|lounge|club|tavern|beer|bar\\b|bar &|bistro|taproom|social/.test(n) || cat === 'bar') return 'bar';", "if (!/juice|mastani|lassi|shake|falooda|salad|snack|chocolate/.test(n) && (/\\bpub\\b|brew|lounge|club|tavern|beer|bar\\b|bar &|bistro|taproom|social/.test(n) || cat === 'bar')) return 'bar';"],
    ["if (/udupi|dosa|idli|madras|south indian|vaishali|rupali|sagar/.test(n)) return 'southindian';", "if (/udupi|dosa|idli|madras (?:cafe|café|hotel)|south indian|vaishali|rupali|sagar (?:hotel|restaurant|pure veg|veg|udupi|cafe)/.test(n)) return 'southindian';"],
    ["if (/estate|propert|realt|developers?\\b|builders?\\b|housing\\b|homes\\b/.test(n)) return 'estate';", "if (/estate|propert|realt|developers?\\b|(?<!body ?)builders?\\b|housing\\b|homes\\b/.test(n)) return 'estate';"],
    ["name: 'Your ' + S.name.toLowerCase() });", "name: 'Your ' + (S.real || S.name) });"],
    // eat here or parcel: only where there's food (a chowki has a bench, not a kitchen)
    ["const dineIn = !!(ctx.inside && ctx.spot === 'counter'", "const dineIn = !!(MENUS[k] && ctx.inside && ctx.spot === 'counter'"],
    // the door's prompt only right at the shutter, facing it; a map pin (a temple, a chowki) only close to it
    ["let best = null, bd = P.onFoot ? 2.6 : 0;", "let best = null, bd = P.onFoot ? 1.8 : 0; const fyx = Math.cos(P.foot ? P.foot.yaw : P.th), fyz = Math.sin(P.foot ? P.foot.yaw : P.th);"],
    ["        if (dd < bd) { const inf = this.infoOf(d); if (inf) { bd = dd; best = inf; } }", "        if (dd < bd && (d.nx === undefined || -(fyx * d.nx + fyz * d.nz) > 0.25)) { const inf = this.infoOf(d); if (inf) { bd = dd; best = inf; } }"],
    ["if (dd > (big ? 16 : 7) || (best && dd >= bd)) continue;", "if (dd > (big ? 9 : 3.5) || (best && dd >= bd)) continue;"],
  ],
  // a one-off gesture (a wave as they pass) is upper body too: the legs keep walking under it
  // an arm reached for its target by going back up the whole body from each bone, several times over; the body's up to date
  // by then, so it's read off instead, and only the arm brought up to date after
  [S('people/humans.js')]: [
    ["bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);", "bone.matrixWorld.decompose(_ikV, _wq, _ikS); bone.parent.matrixWorld.decompose(_ikV, _pq, _ikS);"],
    ["function aim(bone, from, to) {", "const _ikV = new THREE.Vector3(), _ikS = new THREE.Vector3();\nfunction aim(bone, from, to) {"],
    ["  R.updateMatrixWorld(true);\n  _q0.copy(u.quaternion); _q1.copy(l.quaternion);\n  u.getWorldPosition(_a); l.getWorldPosition(_b); h.getWorldPosition(_c);", "  if (!H._fresh) R.updateMatrixWorld(true);\n  _q0.copy(u.quaternion); _q1.copy(l.quaternion);\n  _a.setFromMatrixPosition(u.matrixWorld); _b.setFromMatrixPosition(l.matrixWorld); _c.setFromMatrixPosition(h.matrixWorld);"],
    ["  l.getWorldPosition(_b); h.getWorldPosition(_c);\n  aim(l,", "  _b.setFromMatrixPosition(l.matrixWorld); _c.setFromMatrixPosition(h.matrixWorld);\n  aim(l,"],
    ["l.quaternion.slerpQuaternions(_q1, l.quaternion.clone(), w); }\n  R.updateMatrixWorld(true);\n}", "l.quaternion.slerpQuaternions(_q1, l.quaternion.clone(), w); }\n  u.updateMatrixWorld(true);\n}"],
  ],
  [S('people/crowd.js')]: [
    // (a street you drive into fills with real people at once: bodies are handed out four a tick, eight for those right by
    // you. At two a tick the ones in front of your car were still the far-off figures for seconds)
    ["if (!s && this.pool.length < this.cap + 8 && (made < 2 || (urgent && made < 4)))", "if (!s && this.pool.length < this.cap + 8 && (made < 4 || (urgent && made < 8)))"],
    ["if (this.t <= 0) { this.t = 0.25; this.assign(cx, cz); }", "if (this.t <= 0) { this.t = 0.12; this.assign(cx, cz); }"],
    // a Bullet's rider sits it as a motorbike's does (it was given a scooter's seat, so it was never made a real rider)
    ["const bike = /^bike/.test(o.type);", "const bike = /^(bike|bullet)/.test(o.type);"],
    // thrown by a vehicle: braced while in the air (the hit turns them about the hips: beta/people/runover.js), and the
    // clip only takes them down once they've landed. Both at once twisted them through the road
    ["    if (p.fallen > 0) return p.ko ?", "    if (p._hit && p._hit.lt < 0 && !p._hit.axle) return ['knockback', 0.0001, true];\n    if (p.fallen > 0) return p.ko ?"],
    // someone getting out of a vehicle (people/fight.js bail): eased from the seat to where they stand
    ["H.holder.rotation.set(0, -p.yaw, 0);", "H.holder.rotation.set(0, -p.yaw, 0);\n      if (p._out) { const u = Math.min(1, (performance.now() - p._out.t0)/600), e = 1 - u*u*(3 - 2*u); if (u >= 1) p._out = null; else { H.holder.position.x += p._out.dx*e; H.holder.position.y += p._out.dy*e; H.holder.position.z += p._out.dz*e; } }"],
    // smooth up to 45 m, half rate to 100 m; a frame someone isn't animated, their bones go back to the clip's pose
    // (beta/people/clippose.js), so whatever's built on it (hands on the grips, a lean) is rebuilt on that, never on itself
    ["if (p.rideOf && upd && (seen || dd < 12) && dd < 70) {", "if (p.rideOf && (seen || dd < 12) && dd < 70) {"],
    // a cyclist: on the saddle, no helmet, hands on the flat bar, sitting up more than on a motorbike (beta/people/cyclists.js pedals)
    ["const GRIPS = { auto: [0.72, 1.07, 0.33], scooter: [0.62, 1.0, 0.3], bike: [0.6, 1.08, 0.34] };", "const GRIPS = { auto: [0.72, 1.07, 0.33], scooter: [0.62, 1.0, 0.3], bike: [0.6, 1.08, 0.34], cycle: [0.44, 1.0, 0.28] };"],
    ["const LEAN = { bike: 0.5, scooter: 0.36, auto: 0.24, pillion: 0.14 };", "const LEAN = { bike: 0.5, scooter: 0.36, auto: 0.24, pillion: 0.14, cycle: 0.3 };"],
    ["base = /^bike/.test(o.type) ? 'bike' : /^auto/.test(o.type) ? 'auto' : 'scooter';", "base = /^(bike|bullet)/.test(o.type) ? 'bike' : /^auto/.test(o.type) ? 'auto' : /^cycle/.test(o.type) ? 'cycle' : 'scooter';"],
    ["const seats = two ? [[bike ? 0.0 : 0.04, 0, false, bike ? 0.95 : 0.8]]", "const cyc = /^cycle/.test(o.type), seats = two ? [[bike ? 0.0 : cyc ? 0.1 : 0.04, 0, false, bike ? 0.95 : cyc ? 0.92 : 0.8]]"],
    ["helmet: two && i === 0 && o.type !== 'scooterP' });", "helmet: two && i === 0 && o.type !== 'scooterP' && !cyc });"],
    // someone a power is lit on (Vetal going into them, Brahmarakshas reading them) keeps a real body however far off:
    // the glow is on the body, and the crowd used to hand a far one's body to someone nearer a moment later
    ["const R0 = this.range || RANGE, r = p.cop || p.ctl || p.story ? R0 + 14 : R0;", "const lit = p._lit > performance.now() - 600, R0 = this.range || RANGE, r = lit ? 1e9 : p.fallen > 0 || p._rag ? R0 + 45 : p.cop || p.ctl || p.story ? R0 + 14 : R0;"],
    ["if (d < r) cand.push([d - (p.cop || p.ctl ? 12 : 0) + (seen ? 0 : 15), p]);", "if (d < r) cand.push([d - (p.cop || p.ctl ? 12 : 0) - (lit ? 1e5 : 0) + (seen ? 0 : 15), p]);"],
    ["if (mv > 0.3 && !once && !LOCO.has(name)) {", "if (mv > 0.3 && (!once || UPPER.has(name)) && !LOCO.has(name)) {"],
    // after each person's clip: where they look (beta/draw/alive.js)
    // someone being dragged or waking up is posed every frame, seen or not (behind you, they were posed every few
    // frames and your hands, holding them, jumped between where they were and where they'd been)
    ["if (seen ? (dd < 30 || (dd < 70 ?", "if (p._drag || p._wake ? true : seen ? (dd < 45 || (dd < 100 ?"],
    ["H.mixer.update(Math.min(s.dtAcc, 0.25)); s.dtAcc = 0; upd = true; }", "H.mixer.update(Math.min(s.dtAcc, 0.25)); s.dtAcc = 0; upd = true; } else H.mixer.rest && H.mixer.rest();\n    if (this.postPed && (dd < 40 || p._rag)) this.postPed(p, H, dt);"]],
  // animals: the walk follows how far they really move (no gliding when the game moves them, no 2.6x cap when they run)
  [S('people/animals.js')]: [
    // (what's down lies down: beta/people/runover.js)
    ["      m.holder.rotation.set(0, -yaw, roll);\n", "      m.holder.rotation.set(0, -yaw, roll);\n      if (a.dead || a._lying) window.__nhDown(m, a, dt);\n"],
    ["      m.mixer.update(d < 60 ? dt : dt);", "      if (a._arag) window.__nhARag(m, a, dt, this.W); else if (!(a.dead && a._lying && a._lying.ang > 1.2)) m.mixer.update(dt);"],
    ["      const lie = !a.moving && a.kind !== 'cow' && !a.cow;\n      m.play(a.moving ? (a.cow ? 'WalkSlow' : 'Walk') : 'Idle', a.moving ? (a.cow ? 0.9 : Math.min(2.6, Math.max(1, a.v / 1.1))) : 1);",
     "      const q = m._lx === undefined ? 0 : Math.hypot(a.x - m._lx, a.z - m._lz); m._lx = a.x; m._lz = a.z;\n      if (q < 3 && dt > 0) m._v = (m._v || 0) + (q / dt - (m._v || 0)) * Math.min(1, dt * 6);\n      const cowS = a.cow || a.kind === 'cow', mv = cowS ? Math.min(m._v || 0, 1.3) : m._v || 0, walking = mv > 0.12, slow = cowS && mv < 0.9;\n      if (walking && mv > 2.4) { m._ph = (m._ph || 0) + dt * mv * 2.2; m.holder.position.y += Math.abs(Math.sin(m._ph)) * Math.min(0.07, (mv - 2.4) * 0.02); }\n      const lie = !walking && a.kind !== 'cow' && !a.cow;\n      m.play(walking ? (slow ? 'WalkSlow' : 'Walk') : 'Idle', walking ? Math.max(0.45, mv / (cowS ? (slow ? 0.7 : 1.1) : a.kind === 'cat' ? 0.6 : 0.95)) : 1);"],
  ],
  // a cow goes at a cow's pace, shooed off or following you (beta/people/cows.js)
  [S('people/strays.js')]: [
    // (a cow keeps to the side of the road: no wandering across it, walking sideways to get there and back. beta/people/cows.js)
    ["if (a.kind === 'cow' && !f && !a.inRoad && this.rng.next() < dt * 0.004 &&", "if (false &&"],
    ["      if (sp > 0) {", "      if (a.kind === 'cow' || a.cow) sp = Math.min(sp, 1.1);\n      if (sp > 0) {"],
  ],
  [S('people/fight.js')]: [
    // a driver getting out to have words: out of the seat and through the door, not standing there from nowhere
    // (people/crowd.js eases them by p._out)
    ["    const p = ppl.spawnAt(look, x, z, persona);\n    if (!p) return;", "    const p = ppl.spawnAt(look, x, z, persona);\n    if (!p) return;\n    if (!knocked) { const k = o.T.two ? 0.55 : 0.62; p._out = { t0: performance.now(), dx: (o.x - x)*k, dy: o.T.two ? 0.25 : 0.3, dz: (o.z - z)*k }; }"],
    ["if (input.took('KeyC') && !busyDown", "if ((input.took('ControlLeft') || input.took('ControlRight')) && !busyDown && !(P.act && P.act.move)"],
    // Ctrl standing still crouches (beta/game/crouch.js); moving, it's the roll the way you're going
    ["&& !(P.act && P.act.kind === 'roll')) this.roll(input);", "&& !(P.act && P.act.kind === 'roll')) { if (F.v < 0.5 && !P.act && P.crouchKey) P.crouchKey(); else { if (P.crouchOff) P.crouchOff(); this.roll(input); } }"],
    // whoever rode it comes off as themselves, not someone new: the riders the crowd had seated on it (crowd.js riders)
    ["    const look = kit.randomLook(this.rng, { female: this.rng.chance(o.T.two ? 0.15 : 0.25), helmet: o.T.two && o.type !== 'cycle', avoid: P.look });\n    if (o.colB) look.top = look.top.setRGB(o.colB[0], o.colB[1], o.colB[2]);",
     "    const R0 = o._riders && o._riders[0], R1 = o._riders && o._riders[1];\n    const look = R0 ? R0.look : kit.randomLook(this.rng, { female: this.rng.chance(o.T.two ? 0.15 : 0.25), helmet: o.T.two && o.type !== 'cycle', avoid: P.look });\n    if (!R0 && o.colB) look.top = look.top.setRGB(o.colB[0], o.colB[1], o.colB[2]);"],
    ["      const look2 = kit.randomLook(this.rng, { female: o.type === 'scooterP' ? this.rng.chance(0.75) : this.rng.chance(0.2), avoid: P.look });",
     "      const look2 = R1 ? R1.look : kit.randomLook(this.rng, { female: o.type === 'scooterP' ? this.rng.chance(0.75) : this.rng.chance(0.2), avoid: P.look });"],
  ],
  // shutters roll instead of jumping: each keeps where it should be (t) and where it is (k); the first two calls on a
  // chunk (built, then put in step with the clock) set it straight, later ones leave the rolling to beta/world/shutters.js
  [S('world/buildingsChunk.js')]: [
    ["  S.list.forEach((r, i) => {\n    if (r.door && open(r.door)) { S.im.setMatrixAt(i, ZERO); return; }", "  S.seen = (S.seen || 0) + 1;\n  S.list.forEach((r, i) => {\n    r.t = r.door && open(r.door) ? 1 : 0;\n    if (S.seen > 2 && r.k !== undefined) { if (r.k !== r.t) S.moving = true; return; }\n    r.k = r.t;\n    if (r.t) { S.im.setMatrixAt(i, ZERO); return; }"],
  ],
  [S('world/landmarks.js')]: [
    // the Shaniwar Wada plaque's board clear of /beta's stone blocks (they stand up to 2.6 cm proud; it was 2 cm out)
    ["B.board(pu, 1.25, pv - 0.27, 2.8, 1.5,", "B.board(pu, 1.25, pv - 0.3, 2.8, 1.5,"],
  ],
  [S('game/input.js')]: [
    // (your keys win: a stick resting off centre, or something that only calls itself a gamepad, took the wheel off you and held it)
    ["if (Math.abs(ax) > 0.12) steer = ", "if (Math.abs(ax) > 0.12 && !left && !right) steer = "],
    // (a little quicker to the wheel: holding a key took nearly half a second to ask for all the lock)
    ["(Math.sign(target) !== Math.sign(this.steerKb) ? 6 : 2.6)", "(Math.sign(target) !== Math.sign(this.steerKb) ? 7 : 3.4)"],
    // the pad's Y is the camera, as C is (V is Vetal)
    ["edge(3, 'KeyV');", "edge(3, 'KeyC');"],
  ],
  [S('game/game.js')]: [
    // blood from the body where it comes to rest, not from where they were hit (beta/gfx/blood.js)
    ["else if (ev.type === 'pedDied' && this.blood) this.blood.spill(ev.x, ev.z, 0.9, 30);", "else if (ev.type === 'pedDied' && this.blood) this.blood.spill(ev.x, ev.z, 0.9, 30, ev.p);"],
    ["this.blood.spill(ev.p.x, ev.p.z, sev === 'dead' ? 1.1 : sev === 'critical' ? 0.85 : 0.35, sev === 'ko' ? 15 : 40);", "this.blood.spill(ev.p.x, ev.p.z, sev === 'dead' ? 1.1 : sev === 'critical' ? 0.85 : 0.35, sev === 'ko' ? 15 : 40, ev.p);"],
    // burning: no cry every half second (it was an 'ah, ah, ah' for as long as you stood in it): one, at the blast
    ["this.hud.hurt && this.hud.hurt(); this.vb && this.vb.you('hurt', n > 25);", "this.hud.hurt && this.hud.hurt(); if (n > 25) this.vb && this.vb.you('hurt', true);"],
    // the driver you hit stays in till the car's stopped, then gets out (it brakes along its lane: traffic.js patch)
    ["    o.argue = 22; o.v = 0;\n    this.later(1.4, () => {", "    o.argue = 22;\n    const go = () => {"],
    ["        this.later(12, () => { if (o.argue > 0) { if (this.people.list.includes(p)) this.people.remove(p); o.argue = 0; } });\n      });\n    });\n  }", "        this.later(12, () => { if (o.argue > 0) { if (this.people.list.includes(p)) this.people.remove(p); o.argue = 0; } });\n      });\n    };\n    const wait = (n) => this.later(n ? 0.2 : 0.8, () => { if (Math.abs(o.v || 0) > 0.3 && n < 50) wait(n + 1); else go(); });\n    wait(0);\n  }"],
    // (the blow itself is beta/people/runover.js: not a wall any more)
    ["v.v = 0; v.vl = 0; this.rig.shake(Math.min(0.9, ev.speed * 0.08)); this.audio.crash(1);\n        knock(v, ev.speed + 2, 0.012);", "this.rig.shake(Math.min(0.9, ev.speed * 0.05)); this.audio.crash(Math.min(1, 0.3 + ev.speed * 0.03));"],
    ["kmh > 25 ? 'She\u2019s hurt, your vehicle\u2019s wrecked, and a crowd is forming fast' : 'She barely moved. Your bumper did. Everyone is staring'", "ev.how === 'dead' ? 'She\u2019s dead, your front\u2019s gone, and a crowd is forming fast' : ev.how === 'down' ? 'She\u2019s down, your front\u2019s gone, and a crowd is forming fast' : 'She\u2019s hurt. So is your bumper. Everyone is staring'"],
    // Enter on "Quit to title" is one key press, and it went on to the title screen, where Enter starts the story: you left
    // free roam and were straight into story mode. The title only listens to a fresh press, a moment after it's up.
    ["if (this.state === 'title' && (e.code === 'Enter' || e.code === 'Space') && !(this.hud.pickerOpen)) this.begin();", "if (this.state === 'title' && (e.code === 'Enter' || e.code === 'Space') && !e.repeat && !e.defaultPrevented && performance.now() - (this._titleAt || 0) > 500 && !(this.hud.pickerOpen)) this.begin();"],
    ["this.hud.toast(S.name, `${S.model} \\u00b7 top speed", "this.hud.toast(S.real || S.name, `${S.model} \\u00b7 top speed"],
    // quitting to the title always gets there: each step on its own (one that throws was leaving you stuck in the game)
    ["    this.togglePause(false);\n    if (this.free) this.leaveFree();\n    this.state = 'title';\n    this.rides.setEnabled(false);\n    this.hud.setPlaying(false);\n    this.audio.updateEngine(0, 0, false);\n    this.saveStats();", "    const tryIt = (f) => { try { f(); } catch (e) { console.warn('quit to title', e); } };\n    tryIt(() => this.togglePause(false)); if (this.free) tryIt(() => this.leaveFree());\n    this.state = 'title'; this._titleAt = performance.now(); if (this.input && this.input.keys) tryIt(() => document.exitPointerLock && document.exitPointerLock());\n    tryIt(() => this.rides.setEnabled(false)); tryIt(() => this.hud.setPlaying(false)); tryIt(() => this.audio.updateEngine(0, 0, false)); tryIt(() => this.saveStats());\n    if (this.hud && this.hud.title) this.hud.title.hidden = false;"],
    // a driver who got out to have words goes back to their own door and gets in; one who can't get there in time
    // tries again, and is only gone (in, and away) when you're not looking, never in front of you
    ["this.people.goTo(p, o.x, o.z, (q) => { this.people.remove(q); o.argue = 0; o.angry = 4; });\n        this.later(12, () => { if (o.argue > 0) { if (this.people.list.includes(p)) this.people.remove(p); o.argue = 0; } });", "const back = (n) => { const hx = o.hx ?? Math.cos(o.th || 0), hz = o.hz ?? Math.sin(o.th || 0), sw = (o.spec && o.spec.W ? o.spec.W / 2 : 0.85) + 0.45; o.argue = Math.max(o.argue || 0, 13);\n        this.people.goTo(p, o.x - hz * sw, o.z + hx * sw, (q) => { this.people.remove(q); o.argue = 0; o.angry = 4; });\n        this.later(12, () => { if (!this.people.list.includes(p)) { o.argue = 0; return; } if (!(o.argue > 0) && n > 0) return; const C = this.crowd, d = Math.hypot(p.x - this.player.x, p.z - this.player.z), unseen = d > 75 || (C && C.inView && !C.inView(p.x, p.z) && d > 10); if (unseen || n >= 8) { if (unseen) this.people.remove(p); else { p.busy = 0; p.anim = null; this.people.backToPath && this.people.backToPath(p); } o.argue = 0; } else back(n + 1); }); };\n        back(0);"],
    // the weapons wheel open: the mouse picks on the wheel, the view stays where it was
    ["document.addEventListener('mousemove', (e) => { if (locked() && this.state === 'play') {", "document.addEventListener('mousemove', (e) => { if (locked() && this.state === 'play' && !(this.arms && this.arms.wheelOn)) {"],
    // V is Vetal now (C is the camera)
    ["if (this.input.took('KeyV')) this.rig.setMode(this.rig.mode + 1);", ""],
    // back on the road: hold R for 3 s (a tap was too easy to hit by mistake); the HUD shows it filling
    ["if (this.input.took('KeyR') && P.tipped === 0 && !P.onFoot) this.backOnRoad();", "this.input.took('KeyR'); if (this.input.key('KeyR') && P.tipped === 0 && !P.onFoot && this.state === 'play') { this._rHold = (this._rHold || 0) + dt; this.hud.prompt2 && this.hud.prompt2('R', `Back on the road… ${Math.max(0, 3 - this._rHold).toFixed(1)} s`, 0.15); if (this._rHold >= 3) { this._rHold = -1e9; this.backOnRoad(); } } else this._rHold = 0;"],
    // B looks back from a vehicle; on foot it's Brahmarakshas
    ["this.rig.lookBack = this.input.key('KeyB');", "this.rig.lookBack = !this.player.onFoot && this.input.key('KeyB');"],
    // the jhola on Q (E is vehicles now)
    ["if (e.code === 'KeyE' && this.state === 'play' && !e.repeat) { e.preventDefault(); this.jhola.open(); }", "if (e.code === 'KeyQ' && this.state === 'play' && !e.repeat) { e.preventDefault(); this.jhola.open(); }"],
    ["['Escape', 'KeyE', 'KeyJ', 'Tab', 'KeyF', 'KeyM', 'KeyP', 'KeyK'].includes(e.code)", "['Escape', 'KeyE', 'KeyQ', 'KeyJ', 'Tab', 'KeyF', 'KeyM', 'KeyP', 'KeyK'].includes(e.code)"],
    ["player.useHook = () => this.shops.tryUse();", "player.useHook = () => this.shops.tryUse(); player.shopNear = () => this.shops.near; this.people._G = window.__nhAskG = this;"],
    ["if (this.state === 'play' && !this.player.onFoot && this.input.took('KeyC')) this.rig.setMode(this.rig.mode + 1);", "if (this.state === 'play' && this.input.took('KeyC')) this.rig.toggleView(this.player.onFoot);"],
    ["      if (P.offer && P.onFoot) this.hud.prompt(P.offer.key, P.offer.label, 0.3);\n      else if (sl && this.state === 'play') this.hud.prompt('F', sl, 0.3);\n      else if (!P.onFoot && Math.abs(P.v) < 1 && this.state === 'play') this.hud.prompt('F',", "      if (P.offer && P.onFoot) { const pet = P.offer.kind === 'pet'; this.hud.prompt(pet ? 'F' : 'E', P.offer.label, 0.3); if (sl && !pet && this.state === 'play') this.hud.prompt2('F', sl, 0.3); }\n      else if (sl && this.state === 'play') this.hud.prompt('F', sl, 0.3);\n      else if (!P.onFoot && Math.abs(P.v) < 1 && this.state === 'play') this.hud.prompt('E',"],
  ],
  // the cabin inside /beta's bodies (they're not main's shapes): seats scaled under each roof, the rear bench under the
  // roof's back (none in the two-seaters), pillars and mirror under the roof's front edge
  [S('vehicles/cockpit.js')]: [
    // the drive mode on the cluster, in its colour (a Huracan's STRADA green, SPORT amber, CORSA red; Eco green, and so on)
    ["const draw = (kmh, gear, rpm, night) => {", "const draw = (kmh, gear, rpm, night, mode = '') => {"],
    ["const key = k * 100 + gear * 10 + Math.round(rpm * 9);", "const key = k * 100 + gear * 10 + Math.round(rpm * 9) + '|' + mode;"],
    ["    ctx.fillText(gear > 0 ? String(gear) : 'N', 22, 104);\n", "    ctx.fillText(gear > 0 ? String(gear) : 'N', 22, 104);\n    if (mode) { const M = String(mode).toUpperCase(), col = /CORSA|TRACK|RACE|ZOOM|POWER|SPORT\\+/.test(M) ? '#ff4a3d' : /SPORT|ANIMA|DYNAMIC/.test(M) ? '#ffb020' : /ECO|ZIP|RAIN|WET|4L/.test(M) ? '#3ddc84' : '#cfd8e3'; ctx.textAlign = 'right'; ctx.font = '700 15px ui-monospace, Menlo, Consolas, monospace'; ctx.fillStyle = col; ctx.fillText(M, 300, 22); ctx.fillRect(300 - ctx.measureText(M).width, 27, ctx.measureText(M).width, 2); }\n"],
    ["    update(steer, kmh, gear, rpm, night) {", "    update(steer, kmh, gear, rpm, night, mode) {"],
    ["      draw(kmh, gear, rpm, night);", "      draw(kmh, gear, rpm, night, mode);"],
    // the steering wheel's hub, so it turns with your hands in third person too (beta/vehicles/details.js)
    ["    group, eye: [xf0 - 1.25, belt + 0.19, DRIVER_Z],", "    group, spin, eye: [xf0 - 1.25, belt + 0.19, DRIVER_Z],"],
    // the cabin's there from the moment the car is (it only came on when the camera changed view, so a first time in had
    // no seats, wheel or dash)
    ["group.visible = false;", "group.visible = true;"],
    // the door card, armrest and pull belong to the door: they hang off it when it opens (beta/vehicles/cardoor.js), and
    // only what's behind the door's shut line stays with the cabin. They used to stay put as a wall in the doorway.
    ["import { carSpec } from './models.js';", "import { carSpec, doorOf } from './models.js';"],
    ["const c = new ColorBuilder(), CLOTH =", "let c = new ColorBuilder(); const CLOTH ="],
    ["bx(xb, fl, zi - sd * 0.05, xd, belt - 0.02, zi, TRIM);", "const D = doorOf(kind), d0 = Math.max(xb, D.x0 + 0.015), d1 = Math.min(xd, D.x1 - 0.02), dc = new ColorBuilder(), c0 = c; if (d0 > xb) bx(xb, fl, zi - sd * 0.05, d0 - 0.01, belt - 0.02, zi, TRIM); if (d1 < xd) bx(d1 + 0.01, fl, zi - sd * 0.05, xd, belt - 0.02, zi, TRIM); c = dc; bx(d0, D.y0 + 0.01, zi - sd * 0.05, d1, belt - 0.02, zi, TRIM);"],
    ["bx(xf0 - 1.55, belt - 0.32, zi - sd * 0.13, xf0 - 0.85, belt - 0.26, zi - sd * 0.04, SOFT.concat([0, MATTE]));", "bx(Math.max(xf0 - 1.55, d0), belt - 0.32, zi - sd * 0.13, Math.min(xf0 - 0.85, d1), belt - 0.26, zi - sd * 0.04, SOFT.concat([0, MATTE]));"],
    ["bx(xf0 - 0.4, belt - 0.05, zi - sd * 0.12, xf0 - 0.1, belt + 0.02, zi, TRIM);", "if (xf0 - 0.1 >= D.x1) c = c0; bx(xf0 - 0.4, belt - 0.05, zi - sd * 0.12, xf0 - 0.1, belt + 0.02, zi, TRIM); c = c0; { const tm = new THREE.Mesh(dc.build(), mats.solid); group.add(tm); (group.userData.trim || (group.userData.trim = {}))[sd] = tm; }"],
    // the wheel turns the way you steer, about three times the tyres, and eases there instead of snapping
    ["spin.rotation.z = steer * 7.5;", "spin.userData.s = (spin.userData.s || 0) + (-steer * 3.2 - (spin.userData.s || 0)) * 0.14; spin.rotation.z = spin.userData.s;"],
    ["const fl = S.sill + 0.06, xb = -hl + 0.55, xd = xf0 - 0.55;", "const fl = S.sill + 0.06, xb = -hl + 0.55, xd = xf0 - 0.55, kS = Math.min(1, (S.H - (kind === 'sports' || kind === 'super' ? 0.24 : 0.15) - fl) / 1.2);"],
    ["const back = new THREE.BoxGeometry(0.12, 0.62, 0.46); back.rotateZ(0.2); back.translate(xs - 0.36, fl + 0.68, zs);", "const back = new THREE.BoxGeometry(0.12, 0.62 * kS, 0.46); back.rotateZ(0.2); back.translate(xs - 0.36, fl + 0.36 + 0.32 * kS, zs);"],
    ["bx(xs - 0.5, fl + 1.02, zs - 0.13, xs - 0.4, fl + 1.2, zs + 0.13, CLOTH);", "bx(xs - 0.5, fl + 0.36 + 0.66 * kS, zs - 0.13, xs - 0.4, fl + 0.36 + 0.84 * kS, zs + 0.13, CLOTH);"],
    ["if (S.L > 3.8) { bx(xb + 0.05, fl + 0.2, -hw + 0.15, xb + 0.55, fl + 0.36, hw - 0.15, CLOTH); bx(xb - 0.02, fl + 0.36, -hw + 0.15, xb + 0.1, fl + 0.95, hw - 0.15, CLOTH); }", "if (S.L > 3.8 && kind !== 'sports' && kind !== 'super') { const xr = Math.max(xb, S.roofR - 0.45), yt = Math.min(fl + 0.95, S.H - 0.32); bx(xr + 0.05, fl + 0.2, -hw + 0.15, xr + 0.55, fl + 0.36, hw - 0.15, CLOTH); bx(xr - 0.02, fl + 0.36, -hw + 0.15, xr + 0.1, yt, hw - 0.15, CLOTH); }"],
    ["b2 = new THREE.Vector3(Math.min(xf0 - 0.6, xf0 - (H - belt) * 0.9), H - 0.08,", "b2 = new THREE.Vector3(Math.min(xf0 - 0.3, S.roofF - 0.04), H - 0.1,"],
    ["const mx = xf0 - 0.42;", "const mx = Math.min(xf0 - 0.42, S.roofF - 0.12);"],
  ],
  // your vehicle hits an animal when its box meets the animal's body (beta/people/bodies.js), not anywhere within 1.9 m
  // of a cow's middle (a bike stopped a metre short of her counted as running her over)
  // a shopkeeper shuts up and goes when you're not looking, not in a blink while you're stood at the counter
  [S('people/brain.js')]: [
    ["if (far || (k.kind === 'shop' && !open) || (k.kind === 'watch' && h > 6.5 && h < 21)) {", "const seen = !far && G.crowd && G.crowd.inView && Math.hypot(k.p.x - P.x, k.p.z - P.z) < 60 && (G.crowd.inView(k.p.x, k.p.z) || Math.hypot(k.p.x - P.x, k.p.z - P.z) < 10);\n      if (far || !seen && ((k.kind === 'shop' && !open) || (k.kind === 'watch' && h > 6.5 && h < 21))) {"],
  ],
  [S('people/peds.js')]: [
    // an animal hit by traffic: dead or hurt by how fast, not a roll of the dice
    ["const dead = kmh > 35 || (kmh > 20 && this.rng.next() < 0.4);", "const dead = kmh >= 30;"],
    // nobody comes out of thin air where you're looking: the groups outside shops and clubs, and the stall vendors,
    // only ever appear out of view (they stand still, so they can't walk in from far off like the rest)
    ["avoidView(gx, gz) && Math.hypot(gx - px, gz - pz) < 110) return;", "avoidView(gx, gz)) return;"],
    ["avoidView(gx, gz) && Math.hypot(gx - px, gz - pz) < 110) continue;", "avoidView(gx, gz)) continue;"],
    ["if (d > 110 || d < 30 || (this.g_inView && this.g_inView(x, z) && d < 100)) continue;", "if (d > 110 || d < 30 || (this.g_inView && this.g_inView(x, z))) continue;"],
    // people are seen from far off and never come out of thin air: in view, they start out at 200-270 m (a figure in the
    // crowd) and walk in; out of view, close by as before. They stay till nearly 300 m (340 while you can see them), and
    // there are a few more of them, so the street round you is as busy as it was with the bigger ring
    ["if ((far > 150 && !(avoidView && avoidView(p.x, p.z) && far < 230)) || p.dead)", "if ((far > 290 && !(avoidView && avoidView(p.x, p.z) && far < 340)) || p.dead)"],
    ["avoidView(x, z) && Math.hypot(x - px, z - pz) < 110 : null;\n      const p = this.spawnOne(px, pz, urgent ? 30 : 40, this.rng.chance(0.65) ? 95 : 140, hidden);", "avoidView(x, z) && Math.hypot(x - px, z - pz) < 200 : null;\n      const p = !urgent && this.rng.chance(0.3) ? this.spawnOne(px, pz, 200, 270, null) : this.spawnOne(px, pz, urgent ? 30 : 40, this.rng.chance(0.65) ? 95 : 140, hidden);"],
    ["this.target = Math.round(this.max * clamp(", "this.target = Math.round(this.max * 1.3 * clamp("],
    ["this._near = [...this.g.gridQuery(px, pz, 160)]", "this._near = [...this.g.gridQuery(px, pz, 280)]"],
    // (a cow hit: beta/people/runover.js. She walks a good part of the time, and doesn't stand half a minute at a stretch)
    ["if (a.cow) { this.events.push({ type: 'cowHit', a, speed: pv, x: a.x, z: a.z }); a.rest = 20; a.moving = false; }", "if (a.cow) { /* */ }"],
    ["a.rest = a.moving ? this.rng.range(4, 15) : this.rng.range(10, 60); }", "a.rest = a.cow ? (a.moving ? this.rng.range(12, 40) : this.rng.range(4, 18)) : a.moving ? this.rng.range(4, 15) : this.rng.range(10, 60); }"],
    // (beta/people/runover.js has what happens when you hit someone; this only saw it once they were within a metre of your middle)
    ["if (d < 1.15 && pv > 2.0) {", "if (false) {"],
    // (people talk to you less for no reason)
    ["this.chatT = this.rng.range(14, 32);", "this.chatT = this.rng.range(34, 75);"],
    ["if (this.rng.next() < (sc === 'greet' ? 0.3 : 0.5) && this.speakAs(sc, p, 1, 6)) {", "if (this.rng.next() < (sc === 'greet' ? 0.1 : 0.2) && this.speakAs(sc, p, 1, 14)) {"],
    ["if (best) this.speakAs('mutter', best, 0.8, 5);", "if (best) this.speakAs('mutter', best, 0.35, 14);"],
    // a cow is in no hurry
    ["      a.s += a.dir * sp * dt;", "      if (a.cow) sp = Math.min(sp, a.hurtT > 0 ? 1.5 : 0.72)*(a._al ?? 1);\n      a.s += a.dir * sp * dt;"],
    // who started it, so a witness can say (beta/game/pursuit.js)
    ["if (this.brain && foe && foe.foot) this.brain.incident('fight', p.x, p.z, { byYou: false });", "if (this.brain && foe && foe.foot) this.brain.incident('fight', p.x, p.z, { byYou: false, foe, p });"],
    // (the stall list changes as map tiles come and go: an old index can point past its end, which threw and dropped the whole frame)
    ["if (Math.hypot(st[0] / 100 - px, st[1] / 100 - pz) > 220) { this.stallsUsed.delete(k); }", "if (!st || Math.hypot(st[0] / 100 - px, st[1] / 100 - pz) > 220) { this.stallsUsed.delete(k); }"],
    ["if (d < r && pv > 2) {", "if (pv > 2 && (this.vehTouches ? this.vehTouches(a, player) : d < r)) {"],
    // only into a shop that's open: not through a shutter that's down (d._sh is its shutter, beta/world/shutters.js)
    ["        if (d.n > 1) continue;", "        if (d.n > 1 || (d._sh && (d._sh.k ?? 1) < 0.95)) continue;"],
    // into a shop and out again through its door (beta/people/doors.js), not gone at the step and back out of nowhere
    ["this.goTo(p, d.x, d.z, (q) => { q.mode = 'inside'; q.hidden = true; q.door = d; q.wait = this.rng.range(6, 35); });", "this.goTo(p, d.x, d.z, (q) => { q.mode = 'inside'; q.door = d; q.wait = this.rng.range(6, 35); if (this.thruDoor) this.thruDoor(q, d, true); else q.hidden = true; });"],
    ["const d = p.door; p.hidden = false; p.door = null; if (d) d.n--;", "const d = p.door; p.hidden = false; p.door = null; if (d) d.n--;\n        if (d && this.thruDoor) { this.thruDoor(p, d, false); return; }"],
  ],
  // parked vehicles solid over their real length and width: a chain of circles as wide as the vehicle from bumper to
  // bumper (a parked scooter was one 0.45 m circle in its middle: you walked through its nose and its tail)
  [S('traffic/parked.js')]: [
    // a parked car faces the way the traffic goes on its side of the road (Pune drives on the left: the kerb on its
    // left), and sits in against the kerb, not out in the road: slid towards it till its kerb side is a hand's width off
    ["      const rec = add(k, x, z, tx, tz, pick(PAINTS.car));\n      rec.circles.push(W.collision.addCircle(x + tx * 1.1, z + tz * 1.1, 0.85, 2), W.collision.addCircle(x - tx * 1.1, z - tz * 1.1, 0.85, 2));\n      rec.static = { x, z, hx: tx, hz: tz,",
     "      const sd = side ? -side : 1, ix = -tz * (side || 0), iz = tx * (side || 0);\n      let x1 = x, z1 = z; if (side && W.surf.isRoad(x, z)) for (let d = 0; d <= 3; d += 0.25) if (!W.surf.isRoad(x + ix * (d + 1.15), z + iz * (d + 1.15))) { x1 = x + ix * d; z1 = z + iz * d; break; }\n      { const x = x1, z = z1, hx = tx * sd, hz = tz * sd;\n      const rec = add(k, x, z, hx, hz, pick(PAINTS.car));\n      rec.circles.push(W.collision.addCircle(x + tx * 1.1, z + tz * 1.1, 0.85, 2), W.collision.addCircle(x - tx * 1.1, z - tz * 1.1, 0.85, 2));\n      rec.static = { x, z, hx, hz,"],
    ["      statics.push(rec.static);\n      continue;\n    }", "      statics.push(rec.static); }\n      continue;\n    }"],
    // further off, the same vehicle with less in it instead of a few boxes (beta/vehicles/lod.js): it doesn't change as you
    // come up to it. Its shadow and glass stay on; a parked one stands still, so its shadow goes in the still map
    ["import { RNG } from '../core/util.js';", "import { RNG } from '../core/util.js';\nimport { reduced } from '../beta/vehicles/lod.js';"],
    ["const sF = new InstancedSet(scene, low, vmats.body, capFar, far, { minRange: near, color: true });", "const sF = new InstancedSet(scene, low, vmats.body, capFar, far, { minRange: near, color: true, cast: quality.shadows }); const sM = new InstancedSet(scene, reduced(geoNear, .12), vmats.body, cap, near*2.3, { minRange: near, color: true, cast: quality.shadows }); sM.lvl = 1; sF.lvl = 2; sN.mesh.shadowStill = sM.mesh.shadowStill = sF.mesh.shadowStill = true;"],
    ["for (const s of [sN, sF]) {", "for (const s of [sN, sM, sF]) {"],
    ["sets[k] = { sN, sF, sG };", "sets[k] = { sN, sM, sF, sG };"],
    ["items: [S.sN.add(x, z, m, col), S.sF.add(x, z, m, col)]", "items: [S.sN.add(x, z, m, col), S.sM.add(x, z, m, col), S.sF.add(x, z, m, col)]"],
    ["all.push(S.sN, S.sF);", "all.push(S.sN, S.sM, S.sF);"],
    ["sG = new InstancedSet(scene, glassGeo, vmats.glassI || vmats.glass, cap, near, {});", "{ sG = new InstancedSet(scene, glassGeo, vmats.glassI || vmats.glass, cap + capFar, far, {}); sG.keep = true; }"],
    ["mk('scooter', kinds.scooter, null, buildLow('scooter', true), 520, 1100);", "mk('scooter', kinds.scooter, null, reduced(kinds.scooter, .25, false), 520, 1100);"],
    ["mk('bike', kinds.bike, null, buildLow('bike', true), 260, 520);", "mk('bike', kinds.bike, null, reduced(kinds.bike, .25, false), 260, 520);"],
    ["mk(c, kinds[c].body, kinds[c].glass, buildLow(c), 60, 120);", "mk(c, kinds[c].body, kinds[c].glass, reduced(kinds[c].body, .25, false), 60, 120);"],
    ["mk('auto', kinds.auto.body, kinds.auto.glass, buildLow('auto'), 80, 120);", "mk('auto', kinds.auto.body, kinds.auto.glass, reduced(kinds.auto.body, .25, false), 80, 120);"],
    ["const pick = (a) => rng.pick(a).map(lin);", "const pick = (a) => rng.pick(a).map(lin);\n  const chain = (x, z, hx, hz, L, Wd) => { const r = Wd / 2, n = Math.max(1, Math.ceil((L - Wd) / (r * 0.8)) + 1), out = []; for (let i = 0; i < n; i++) { const o = n === 1 ? 0 : -(L / 2 - r) + (L - 2 * r) * i / (n - 1); out.push(W.collision.addCircle(x + hx * o, z + hz * o, r, 2)); } return out; };"],
    ["rec.circles.push(W.collision.addCircle(x + tx * 1.1, z + tz * 1.1, 0.85, 2), W.collision.addCircle(x - tx * 1.1, z - tz * 1.1, 0.85, 2));", "rec.circles.push(...chain(x, z, tx, tz, { hatch: 3.65, sedan: 4.0, suv: 4.5 }[k], { hatch: 1.62, sedan: 1.72, suv: 1.82 }[k])); for (const c of rec.circles) c.rec = rec;"],
    ["rec.circles.push(W.collision.addCircle(px, pz, 0.45, 2));", "rec.circles.push(...chain(px, pz, hx, hz, k === 'bike' ? 2.0 : 1.85, 0.62)); for (const c of rec.circles) c.rec = rec;"],
    ["rec.circles.push(W.collision.addCircle(px, pz, 0.8, 2), W.collision.addCircle(px - tx * 0.9, pz - tz * 0.9, 0.7, 2));", "rec.circles.push(...chain(px, pz, -tx, -tz, 2.7, 1.38)); for (const c of rec.circles) c.rec = rec;"],
  ],
  // the police (beta/game/pursuit.js has the rest): they actually chase. Faster the higher the heat; quicker to react;
  // they go where you're going to be, not where you were a second ago; at three stars and up they ram you off the road
  // instead of following politely; a vehicle counts as caught when you're slow beside one of them (or boxed in by two),
  // not only at a crawl; on foot they run as fast as a fit constable does, and keep it up longer
  [S('game/police.js')]: [
    // (a unit sent after someone else: beta/game/wanted.js builds on the same rider and bike)
    ["class Marshal {", "export class Marshal {"],
    // they look for you a good while longer before easing off, and there are more of them from the first star up
    ["const SEARCH = [0, 40, 60, 90, 120, 160];", "const SEARCH = [0, 70, 110, 170, 260, 400];"],
    ["wantBikes = [0, 1, 2, 2, 3, 4][H]", "wantBikes = [0, 2, 3, 3, 4, 5][H]"],
    ["wantJeeps = [0, 0, 0, 1, 1, 2][H]", "wantJeeps = [0, 0, 1, 1, 2, 2][H]"],
    ["want = (pursuing ? (this.jeep ? 16 : 18) : 11) * this.skill.top;", "want = (pursuing ? (this.jeep ? [16, 18, 20, 23, 25, 26][police.heat] : [18, 21, 23, 25, 27, 28][police.heat]) : 11) * this.skill.top;"],
    ["if (!this.skill) this.skill = { lag: 0.7 + police.rng.next() * 1.1, top: 0.82 + police.rng.next() * 0.2 };", "if (!this.skill) this.skill = { lag: 0.35 + police.rng.next() * 0.6, top: 0.9 + police.rng.next() * 0.12 };"],
    ["      tx = ls.x; tz = ls.z;", "      tx = ls.x; tz = ls.z;\n      if (this.sees && !P.onFoot) { const ld = Math.min(2.5, d / 18), pv = P.v || 0; tx += Math.cos(P.th) * pv * ld; tz += Math.sin(P.th) * pv * ld; }"],
    ["      if (this.sees && !P.onFoot && d < 18 && Math.abs(P.v) < 5) {", "      if (this.sees && !P.onFoot && police.heat >= 3 && d < 28 && Math.abs(P.v) >= 5) {\n        const S = P.spec || { L: 4, W: 1.8 }, fx = Math.cos(P.th), fz = Math.sin(P.th), sd = ((v.x - P.x) * -fz + (v.z - P.z) * fx) >= 0 ? 1 : -1; close = true;\n        tx = P.x - fx * (S.L || 4) * 0.3 - fz * sd * (S.W || 1.8) * 0.35; tz = P.z - fz * (S.L || 4) * 0.3 + fx * sd * (S.W || 1.8) * 0.35;\n        want = Math.abs(P.v) + 5;\n      } else if (this.sees && !P.onFoot && d < 18 && Math.abs(P.v) < 5) {"],
    ["this.drv.o.emergency = !!pursuing; this.drv.o.signals = !pursuing;", "const hot = pursuing && (this.P.heat >= 3 || (this.sees && Math.hypot(G.player.x - v.x, G.player.z - v.z) < 70)); this.drv.o.emergency = !!pursuing; this.drv.o.signals = !hot; this.drv.o.careful = hot && this.P.heat <= 2;"],
    ["const slow = P.onFoot ? d < 2.6 : (d < 6 && Math.abs(P.v) < 2.2);", "const slow = P.onFoot ? d < 2.6 : ((d < 7 && Math.abs(P.v) < 3) || (this.heat >= 2 && d < 9 && Math.abs(P.v) < 4.5 && this.marshals.filter(u => u.catchDist() < 12).length >= 2));"],
    ["if (m.catchT > (P.onFoot ? 0.4 : 1.2)) this.caught(m);", "if (m.catchT > (P.onFoot ? 0.4 : 1.0)) this.caught(m);"],
    ["p.runSp = 4.2 + police.rng.next() * 0.6; p.chaseT = 0;", "p.runSp = [5.2, 5.2, 5.5, 5.8, 6.1, 6.3][police.heat] + police.rng.next() * 0.5; p.chaseT = -14;"],
    ["r = (this.heat <= 1 ? 55 : 85) + this.rng.next() * (this.heat <= 1 ? 45 : 70);", "r = (this.heat <= 1 ? 40 : 70) + this.rng.next() * (this.heat <= 1 ? 40 : 60);"],
    ["this._spT = 4;", "this._spT = this.marshals.length ? 3.5 : 1.5;"],
  ],
  // anyone driving by vehicles/driver.js (the police, the ambulance): keeps up with what's in front instead of
  // dropping back to a gap as if it were standing still; passes slow traffic (not only stopped) when on an emergency,
  // a two-wheeler through the gaps between lanes; red lights obeyed unless chasing hard, crossed slowly at low heat
  [S('vehicles/driver.js')]: [
    ["let gap = 99, still = false, person = false;", "let gap = 99, still = false, person = false, ov = 0, isPlayer = false;"],
    ["if (al > 0.5 && al < look && Math.abs(ac - lat) < wHalf + ow && al < gap) { gap = al; still = Math.abs(o.v || 0) < 0.6; }", "if (al > 0.5 && al < look && Math.abs(ac - lat) < wHalf + ow && al < gap) { gap = al; still = Math.abs(o.v || 0) < 0.6; ov = (o.v || 0) * ((o.hx ?? 1) * hx + (o.hz ?? 0) * hz); isPlayer = !!o.isPlayer; }"],
    ["return { gap, still, person };", "return { gap, still, person, ov: person ? 0 : ov, isPlayer };"],
    ["target = Math.min(target, Math.max(0, (H.gap - 3.2) * 0.9));", "target = Math.min(target, Math.max(0, Math.max(0, H.ov || 0) + (H.gap - 3.2) * 0.9));"],
    ["if (H.still && !H.person && this.waitT > (o.emergency ? 0.8 : 2.5) && this.shiftT <= 0) for (const s of [2.6, -2.6]) {", "if (!H.person && !H.isPlayer && this.shiftT <= 0 && ((H.still && this.waitT > (o.emergency ? 0.3 : 2.5)) || (o.emergency && H.gap < 14 && (H.ov || 0) < want - 2))) for (const s of (v.spec.two ? [1.4, -1.4, 2.6, -2.6] : [2.6, -2.6])) {"],
    ["if (o.signals && !o.emergency && G.traffic.signals) {", "if (o.careful && !o.signals && G.traffic.signals) { const n = W.graph.nearest(v.x + hx * 14, v.z + hz * 14, 10), node = n && W.graph.nodes[n.s < n.e.len / 2 ? n.e.a : n.e.b]; if (node && node.signal && Math.hypot(node.x - v.x, node.z - v.z) < 24 && G.traffic.signals.stateForAngle(node.i, v.th) === 'r') target = Math.min(target, 6); }\n    if (o.signals && G.traffic.signals) {"],
  ],
  [S('traffic/traffic.js')]: [
    // the riders drawn as real people are the nearest ones, not the first 14 in the list: in thick traffic a scooter
    // right beside you lost its place to one 40 m off and went by with its baked, low-detail rider on it
    ["    let nr = 0;\n    for (const v of this.list) {\n      // every two-wheeler and auto within the radius (no speed or count limit; 14 at most, a safety net)\n      const R = this.richR || 28;\n      const near = (v.x - cx) * (v.x - cx) + (v.z - cz) * (v.z - cz) < R * R && /^(scooter|bike|auto)/.test(v.type) && !(v.fallen > 0);\n      v.rich = near && nr < 14 ? (nr++, true) : false;\n    }",
     "    { const R = this.richR || 28, cand = this._rc || (this._rc = []); cand.length = 0;\n      for (const v of this.list) { v.rich = false; const d2 = (v.x - cx) * (v.x - cx) + (v.z - cz) * (v.z - cz); if (d2 < R * R && /^(scooter|bike|bullet|auto|cycle)/.test(v.type) && !(v.fallen > 0)) { v._rd = d2; cand.push(v); } }\n      cand.sort((a, b) => a._rd - b._rd); for (let i = 0; i < cand.length && i < (this.richN || 14); i++) cand[i].rich = true; }"],
    // a car you've hit pulls up under its own brakes, along its lane (it used to stop dead on the spot), and only
    // then is it standing there with its driver out (game.js fenderBender waits for it)
    ["if (v.argue > 0) { v.argue -= dt; v.v = 0; return; }", "if (v.argue > 0 && !(v.v > 0.3)) { v.argue -= dt; v.v = 0; return; }"],
    ["let vDes = SPEED_BY_RANK[e.rank] * v.vMul;", "let vDes = v.argue > 0 ? 0 : SPEED_BY_RANK[e.rank] * v.vMul;"],
    // a vehicle you can see appears no nearer than 220 m (it used to be 140: a car arriving out of nothing down the road)
    ["const hidden = avoidView ? (x, z) => avoidView(x, z) && Math.hypot(x - px, z - pz) < 140 : null;\n        this.spawn(px + hx * look", "const hidden = avoidView ? (x, z) => avoidView(x, z) && Math.hypot(x - px, z - pz) < 220 : null;\n        this.spawn(px + hx * look"],
    ["const hidden = avoidView ? (x, z) => avoidView(x, z) && Math.hypot(x - px, z - pz) < 140 : null;\n        this.spawn(px, pz,", "const hidden = avoidView ? (x, z) => avoidView(x, z) && Math.hypot(x - px, z - pz) < 220 : null;\n        this.spawn(px, pz,"],
    ["import { TRAFFIC, curve } from '../world/activity.js';", "import { TRAFFIC, curve } from '../world/activity.js';\nimport { view, ranged } from '../beta/world/view.js';\nimport { reduced } from '../beta/vehicles/lod.js';\nimport { visOf } from '../beta/draw/skin.js';"],
    // a rider getting their full body (or giving it back) fades in over half a second: through it the vehicle is drawn
    // without its baked rider and with it, the baked one dropping exactly the pixels the real one has (vehmat.js aDis)
    ["const I = this.inst[seated ? v.type.replace(/P$/, '') + 'E' : v.type] || this.inst[v.type];", "let fv = 1; for (const r of v._riders || []) if (r.body && r.body.H) fv = Math.min(fv, visOf(r.body.H, performance.now()));\n      const hand = fv < 0.999 && !v.wreck && !(v._tp && v._tp.empty) && !!this.inst[v.type.replace(/P$/, '') + 'E'];\n      const I0 = this.inst[seated || hand ? v.type.replace(/P$/, '') + 'E' : v.type] || this.inst[v.type];"],
    // a bus or a tempo keeps its full model a good deal further out (it's big: its detail was missing until right up close)
    // (and it hands over from one version to the next over the last few metres before the line, both drawn, one
    // thinning out pixel by pixel where the other fills in: beta/vehicles/vehmat.js aDis)
    ["const far = (v.x - cx) * (v.x - cx) + (v.z - cz) * (v.z - cz) > L2;", "if (!view.sees(v.x, v.z, 35, 12)) continue;\n      const dd = (v.x - cx) * (v.x - cx) + (v.z - cz) * (v.z - cz), LK = L2 * (v.type === 'bus' || v.type === 'tempo' ? 6.25 : 1), lv0 = dd > LK * 5.3 ? 2 : dd > LK ? 1 : 0;\n      const lvs = [[lv0, 0, 0]]; if (lv0 < 2) { const b = Math.sqrt(lv0 ? LK * 5.3 : LK), W = Math.max(4, b * 0.15), t = (Math.sqrt(dd) - b + W) / W; if (t > 0) { lvs[0][1] = t; lvs.push([lv0 + 1, 0, 1 - t]); } }\n      if (hand && this.inst[v.type]) lvs.push([lv0, Math.max(fv, lvs[0][1]), 0, this.inst[v.type]]);"],
    // only what's in the view is drawn (beta/world/view.js), only what's in use uploaded, and an empty list not visited at all
    ["        mesh.count = n;\n        mesh.instanceMatrix.needsUpdate = true;\n        mesh.instanceColor.needsUpdate = true;\n        mesh.geometry.attributes.aColB.needsUpdate = true;\n        mesh.geometry.attributes.aColC.needsUpdate = true;", "        mesh.count = n; mesh.visible = n > 0; if (!n) continue;\n        ranged(mesh.instanceMatrix, n); ranged(mesh.instanceColor, n); ranged(mesh.geometry.attributes.aColB, n);\n        ranged(mesh.geometry.attributes.aColC, n);"],
    ["if (I.glass) { I.glass.count = I.n; I.glass.instanceMatrix.needsUpdate = true; }", "if (I.glass) { I.glass.count = I.ng; I.glass.visible = I.ng > 0; if (I.ng) ranged(I.glass.instanceMatrix, I.ng); }"],
    // brake and reverse lamps per car (beta/vehicles/lamps.js, beta/vehicles/vehmat.js)
    ["      body.geometry.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));", "      body.geometry.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));\n      body.geometry.setAttribute('aLamp', new THREE.InstancedBufferAttribute(new Float32Array(c * 2), 2));\n      body.geometry.setAttribute('aDis', new THREE.InstancedBufferAttribute(new Float32Array(c * 2), 2));"],
    ["      lowGeo.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));", "      lowGeo.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3));\n      lowGeo.setAttribute('aLamp', new THREE.InstancedBufferAttribute(new Float32Array(c * 2), 2));\n      lowGeo.setAttribute('aDis', new THREE.InstancedBufferAttribute(new Float32Array(c * 2), 2));"],
    ["      mesh.geometry.attributes.aColC.setXYZ(i, v.colC[0] * dk, v.colC[1] * dk, v.colC[2] * dk);", "      mesh.geometry.attributes.aColC.setXYZ(i, v.colC[0] * dk, v.colC[1] * dk, v.colC[2] * dk);\n      if (mesh.geometry.attributes.aLamp) mesh.geometry.attributes.aLamp.setXY(i, v._brk || 0, v._ind || 0);\n      if (mesh.geometry.attributes.aDis) mesh.geometry.attributes.aDis.setXY(i, dA, dB);"],
    ["        ranged(mesh.geometry.attributes.aColC, n);", "        ranged(mesh.geometry.attributes.aColC, n);\n        if (mesh.geometry.attributes.aLamp) ranged(mesh.geometry.attributes.aLamp, n);\n        if (mesh.geometry.attributes.aDis) ranged(mesh.geometry.attributes.aDis, n);"],
    // cyclists close by are real people too (beta/people/cyclists.js): an empty cycle to seat them on, and the cycle in
    // the list of what gets real riders up close
    ["scooterE: buildScooter({ helmet: true, noRider: true }), bikeE: buildBike({ helmet: true, noRider: true }),", "scooterE: buildScooter({ helmet: true, noRider: true }), bikeE: buildBike({ helmet: true, noRider: true }), cycleE: buildCycle({ noRider: true }), bulletE: buildBike({ helmet: true, kind: 'bullet', noRider: true }),"],
    ["for (const k of [...TYPE_NAMES, 'scooterE', 'bikeE', 'autoE'])", "for (const k of [...TYPE_NAMES, 'scooterE', 'bikeE', 'autoE', 'cycleE', 'bulletE'])"],
    ["bullet: buildBike({ helmet: true }), superbike: buildBike({ helmet: true }),", "bullet: buildBike({ helmet: true, kind: 'bullet' }), superbike: buildBike({ helmet: true, kind: 'superbike' }),"],
    // the models inside the types (beta/vehicles/models.js VARIANTS): their own spawn share, bodies and time-of-day mix
    ["import { buildAuto, buildScooter, buildBike, buildCar, buildBus, buildTempo, buildCycle, buildLow, PAINTS } from '../vehicles/models.js';", "import { buildAuto, buildScooter, buildBike, buildCar, buildBus, buildTempo, buildCycle, buildLow, PAINTS, VARIANTS, addVariantTypes, baseOf } from '../vehicles/models.js';"],
    ["const TYPE_NAMES = Object.keys(TYPES);", "addVariantTypes(TYPES); const TYPE_NAMES = Object.keys(TYPES);"],
    ["tempo: buildTempo(), bus: buildBus(),", "tempo: buildTempo({ driver: true }), bus: buildBus({ driver: true }), ...Object.fromEntries(Object.keys(VARIANTS).map(k => [k, buildCar(k, { driver: true })])),"],
    // every car on the road has someone driving it (beta/vehicles/models.js addDriver)
    ["hatch: buildCar('hatch'), sedan: buildCar('sedan'), suv: buildCar('suv'), taxi: buildCar('taxi'),\n      lux: buildCar('lux'), jeep: buildCar('jeep'), sports: buildCar('sports'), super: buildCar('super'),", "hatch: buildCar('hatch', { driver: true }), sedan: buildCar('sedan', { driver: true }), suv: buildCar('suv', { driver: true }), taxi: buildCar('taxi', { driver: true }),\n      lux: buildCar('lux', { driver: true }), jeep: buildCar('jeep', { driver: true }), sports: buildCar('sports', { driver: true }), super: buildCar('super', { driver: true }),"],
    // a car you're getting into: the one built for you stands in its place (beta/vehicles/cardoor.js)
    ["const seated = v.wreck || (v.rich", "if (v.hideBody) continue; const seated = v.wreck || (v._tp && v._tp.empty) || (v.rich"],
    // and drawn empty only once the real riders are actually being drawn on it (beta/draw/skin.js marks them)
    ["v._riders.every(r => r.body));", "v._riders.every(r => r.body && r.body.H && performance.now() - (r.body.H._drawnT || 0) < 250));"],
    // a two-wheeler going over: drawn however its body lies as it falls, slides and is hauled back up (beta/traffic/topple.js)
    ["q.setFromEuler(e);", "q.setFromEuler(e); if (v._tp && v._tp.Q) q.copy(v._tp.Q);"],
    ["p.set(v.rx ?? v.x, (v.y || 0) + (v.fallen > 0 ? 0.3 : 0), v.rz ?? v.z);", "if (v._tp && v._tp.Q) p.set(v._tp.ox, v._tp.oy, v._tp.oz); else p.set(v.rx ?? v.x, (v.y || 0) + (v.fallen > 0 ? 0.3 : 0), v.rz ?? v.z);"],
    ["tot += t.w * (mix[k] ?? 1);", "tot += t.w * (mix[k] ?? mix[baseOf(k)] ?? 1);"],
    // the far model of the empty two-wheeler / auto (real riders up close, a wreck) is that vehicle without its baked
    // rider, not a car: buildLow('scooterE') fell through to the car box, so a scooter past the detail range drew as a car
    ["const lowGeo = buildLow(k);", "const lowGeo = reduced(m.body, /^(bus|tempo)/.test(k) ? .4 : .25, false);"],
    ["this.inst[k] = { body, glass, low, cap: c, n: 0, nl: 0 };", "const midGeo = reduced(m.body, /^(bus|tempo)/.test(k) ? .18 : .12), mid = new THREE.InstancedMesh(midGeo, mats.body, c); mid.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(c * 3).fill(1), 3);\n      for (const a of ['aColB', 'aColC', 'aLamp', 'aDis']) if (lowGeo.attributes[a]) midGeo.setAttribute(a, lowGeo.attributes[a].clone());\n      mid.castShadow = quality.shadows; mid.receiveShadow = true; mid.frustumCulled = false; mid.count = 0; scene.add(mid);\n      this.inst[k] = { body, glass, low, mid, cap: c, n: 0, nl: 0, nm: 0, ng: 0 };"],
    ["const mesh = far ? I.low : I.body;", "for (const [lv, dA, dB, Ix] of lvs) { const I = Ix || I0;\n      const mesh = lv === 2 ? I.low : lv === 1 ? I.mid : I.body;"],
    ["const i = far ? I.nl : I.n;", "const i = lv === 2 ? I.nl : lv === 1 ? I.nm : I.n;"],
    ["for (const [mesh, n] of [[I.body, I.n], [I.low, I.nl]]) {", "for (const [mesh, n] of [[I.body, I.n], [I.mid, I.nm], [I.low, I.nl]]) {"],
    ["low.castShadow = false;", "low.castShadow = quality.shadows;"],
    ["if (far) I.nl++;\n      else { if (I.glass) I.glass.setMatrixAt(i, m); I.n++; }", "if (I.glass && dB === 0 && !Ix) I.glass.setMatrixAt(I.ng++, m);\n      if (lv === 2) I.nl++; else if (lv === 1) I.nm++; else I.n++;\n      }"],
    ["this.inst[k].nl = 0;", "this.inst[k].nl = 0; this.inst[k].nm = 0; this.inst[k].ng = 0;"],
    ["x -= t.w * (mix[k] ?? 1);", "x -= t.w * (mix[k] ?? mix[baseOf(k)] ?? 1);"],
  ],
};
const swapPlugin = {
  name: 'beta-swap',
  setup(b) {
    b.onLoad({ filter: /\.js$/ }, (a) => {
      const list = PATCHES[a.path]; if (!list) return undefined;
      let src = fs.readFileSync(a.path, 'utf8');
      for (const [from, to] of list) { if (!src.includes(from)) throw new Error('build-beta: patch no longer fits ' + a.path + ': ' + from); src = src.replace(from, to); }
      return { contents: src, loader: 'js' };
    });
    b.onResolve({ filter: /^@orig\// }, (a) => ({ path: S(a.path.slice(6)) }));
    b.onResolve({ filter: /^\.\.?\// }, (a) => {
      if (!a.importer || a.importer.startsWith(S('beta') + path.sep)) return undefined;
      const abs = path.resolve(path.dirname(a.importer), a.path);
      for (const [imp, from, to] of SWAPS) if (abs === from && (imp === '*' || imp === a.importer)) return { path: to };
      return undefined;
    });
    // ez-tree imports its bundled bark/leaf images from ./textures; the game brings its own
    b.onResolve({ filter: /^\.\/textures$/ }, (a) => (a.importer.includes('ez-tree') ? { path: S('gfx/eztreeStub.js') } : undefined));
  },
};
const common = { bundle: true, minify: !dev, write: false, legalComments: 'none', target: ['es2022', 'chrome100', 'safari16', 'firefox110'], logLevel: 'warning', define: { 'process.env.NODE_ENV': '"production"' } };
// the city's buildings are generated in a worker: its own small bundle, carried in the page as text
const wres = await esbuild.build({ ...common, entryPoints: [S('beta/world/worker.js')], format: 'iife' });
const workerJs = wres.outputFiles[0].text;
const res = await esbuild.build({
  ...common, entryPoints: [S('beta/main.js')], format: 'esm',
  external: ['three', 'three/addons/*', 'three/examples/jsm/*', 'postprocessing', 'n8ao'], plugins: [swapPlugin],
});
const js = res.outputFiles[0].text;

// the main build's manifest (asset sizes, voice offsets, versions): /beta reads the same files
const dist = path.join(root, 'dist');
const mainPage = ['index.html', 'test.html'].map(f => path.join(dist, f)).filter(f => fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes('id="manifest"'))[0];
if (!mainPage) throw new Error('build-beta: run tools/build.mjs first (no dist/index.html or dist/test.html with a manifest)');
const mainHtml = fs.readFileSync(mainPage, 'utf8');
const mm = mainHtml.match(/<script id="manifest" type="application\/json">([\s\S]*?)<\/script>/);
const manifest = mm[1];
const fontCss = (mainHtml.match(/@font-face\{[^}]*\}/g) || []).join('\n');

const tpl = fs.readFileSync(S('page.html'), 'utf8');
const css = fs.readFileSync(S('style.css'), 'utf8') + fs.readFileSync(S('beta/beta.css'), 'utf8');
const body = tpl
  .replace('<title>Puneri</title>', '')
  .replace('/*FONTS*/', () => fontCss)
  .replace('/*CSS*/', () => css)
  .replace('<!--IMPORTMAP-->', () => `<script type="importmap">${JSON.stringify({ imports: IMPORTS })}</script>`)
  .replace('/*MANIFEST*/', () => manifest)
  .replace('/*JS*/', () => js.replace(/<\/script/gi, '<\\/script'));
const ICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52"><path d="M4 22a16 16 0 0 1 32 0v26H4z" fill="#F4F1EA"/><path d="M4 22a16 16 0 0 1 32 0z" fill="#F2B705"/><rect x="4" y="44" width="32" height="4" fill="#C9C4B8"/><path d="M8 40 30 18M12 44 34 22" stroke="#171411" stroke-width="2"/></svg>')}`;
const HEAD = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<base href="/"><title>Puneri · beta</title><meta name="robots" content="noindex">'
  + `<meta name="description" content="Puneri, rebuilt: all of Pune drawn in pencil and ink."><meta name="theme-color" content="#101216"><link rel="icon" href="${ICON}">`;
const worker = `<script id="beta-worker" type="text/js-worker">${workerJs.replace(/<\/script/gi, '<\\/script')}</script>`;
const out = path.join(dist, 'beta');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="en"><head>${HEAD}<style>:root{color-scheme:dark}body{margin:0}[hidden]{display:none!important}</style></head><body>${worker}${body}</body></html>`);
console.log(`beta built in ${Date.now() - t0}ms  page ${(body.length / 1024).toFixed(0)}KB (js ${(js.length / 1024).toFixed(0)}KB, worker ${(workerJs.length / 1024).toFixed(0)}KB)`);
