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
  ['*', S('game/story.js'), S('beta/game/story.js')],
  ['*', S('game/tutorial.js'), S('beta/game/tutorial.js')],
  ['*', S('game/home.js'), S('beta/game/home.js')],
];
// a line in a game file swapped as it's bundled: only for what a module swap can't reach. Fails the build if the line has moved
const PATCHES = {
  // compound walls along the roads: not Pune, Onkar wants them gone. Neither drawn nor solid (the city's edge wall is separate)
  [S('world/index.js')]: [["for (const w of D.walls) put('walls', at(w[0] / 100, w[1] / 100), cmRing(w));", "/* /beta: no compound walls */"]],
  [S('world/world.js')]: [
    ["for (const B of M.buildings) W.collision.addRing(cmRing(B[1]), 0);", "for (const B of M.buildings) buildingSolid(B, cmRing(B[1]), W.collision);"],
    ["import { cmRing", "import { buildingSolid } from '../beta/world/solids.js';\nimport { cmRing"]],
  [S('world/tiles.js')]: [["for (let j = 0; j < D.walls.length; j += 60) {", "for (let j = 0; j < 0; j += 60) {"],
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
    ["index.chunks[ci].extras.push({ kind: 'banner', x, z, fx, fz, s: rng.int(0, W.signs.banners.length - 1) });", "index.chunks[ci].extras.push({ kind: 'banner', x, z, fx, fz, s: rng.int(0, W.signs.banners.length - 1) }); (W.solid || (W.solid = makeSolids(W))).board('banner', x, z, fx, fz, collision);"]],
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
  [S('vehicles/vehicle.js')]: [
    ["case 'bike': case 'bikeP': case 'bullet': case 'superbike': return buildBike({ parked: true });", "case 'bike': case 'bikeP': return buildBike({ parked: true }); case 'bullet': case 'superbike': return buildBike({ parked: true, kind: type });"],
    ["    const hF = this.heightAt(this.x + hx * half, this.z + hz * half), hR = this.heightAt(this.x - hx * half, this.z - hz * half);\n    const jolt = Math.max(Math.abs(hF - this.prevH[0]), Math.abs(hR - this.prevH[1]));", "    const gr = this.ground(hx, hz, sp), hF = gr.f, hR = gr.r, jolt = gr.jolt;"],
    ["this.onFootpath = this.deck < 0 && !W.surf.isRoad(this.x, this.z);", "this.onFootpath = this.deck < 0 && gr.off > 0.5;"],
    ["-clamp(this.latAcc * 0.01, -0.06, 0.06);", "-clamp(this.latAcc * 0.01, -0.06, 0.06) + gr.roll;"],
    ["import { buildScooter, buildBike, buildCycle, buildCar, buildBus, buildTempo, buildAuto, PAINTS, wheelsOf } from './models.js';", "import { buildScooter, buildBike, buildCycle, buildCar, buildBus, buildTempo, buildAuto, PAINTS, wheelsOf, VARIANTS, baseOf } from './models.js';"],
    ["default: return buildCar('hatch');", "default: return VARIANTS[type] ? buildCar(type, { interior: true }) : buildCar('hatch');"],
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
  [S('game/keys.js')]: [
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
  [S('ui/hud.js')]: [["this.nerd = el('div', 'h nerd', 'E jhola · J diary · F3 stats');", "this.nerd = el('div', 'h nerd', 'Q jhola · I phone · J diary · F3 stats');"]],
  [S('game/guide.js')]: [["['F', 'Interact, enter, get in or out'], ['E', 'Jhola'],", "['F', 'Walk in, counters, pet'], ['E', 'Get in or out of a vehicle'], ['T', 'Talk to someone'], ['Q', 'Jhola'],"], ["['T', 'Phone'],", "['I', 'Phone'],"], ["['V', 'Camera (anytime)'],", "['C', 'First or third person'],"]],
  [S('game/pilot.js')]: [
    // slowed on foot (dazed after Vetal: beta/game/powers.js sets slowMul)
    ["const target = (fw || sd) ? (F.swim ? (run ? 2.1 : 1.35) : run ? SPRINT * (this.sprintMul ? this.sprintMul() : 1) : k('AltLeft') ? WALK : JOG) : 0;", "const target = ((fw || sd) ? (F.swim ? (run ? 2.1 : 1.35) : run ? SPRINT * (this.sprintMul ? this.sprintMul() : 1) : k('AltLeft') ? WALK : JOG) : 0) * (this.slowMul ? this.slowMul() : 1) * (this.crouchMul ? this.crouchMul() : 1);"],
    // knocked down by a vehicle only if it's coming at you: walking into the back of a scooter riding away from you
    // (or alongside one) is a bump, not being run over (it counted its speed, not which way it was going)
    ["if ((o.v || 0) > 3.5 && !this.downT) {", "if (!this.downT && ((o.hx * (o.v || 0) - F.vx) * rx + (o.hz * (o.v || 0) - F.vz) * rz) / (Math.hypot(rx, rz) || 1) > 3.5) {"],
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
    // eat here or parcel: only where there's food (a chowki has a bench, not a kitchen)
    ["const dineIn = !!(ctx.inside && ctx.spot === 'counter'", "const dineIn = !!(MENUS[k] && ctx.inside && ctx.spot === 'counter'"],
    // the door's prompt only right at the shutter, facing it; a map pin (a temple, a chowki) only close to it
    ["let best = null, bd = P.onFoot ? 2.6 : 0;", "let best = null, bd = P.onFoot ? 1.8 : 0; const fyx = Math.cos(P.foot ? P.foot.yaw : P.th), fyz = Math.sin(P.foot ? P.foot.yaw : P.th);"],
    ["        if (dd < bd) { const inf = this.infoOf(d); if (inf) { bd = dd; best = inf; } }", "        if (dd < bd && (d.nx === undefined || -(fyx * d.nx + fyz * d.nz) > 0.25)) { const inf = this.infoOf(d); if (inf) { bd = dd; best = inf; } }"],
    ["if (dd > (big ? 16 : 7) || (best && dd >= bd)) continue;", "if (dd > (big ? 9 : 3.5) || (best && dd >= bd)) continue;"],
  ],
  // a one-off gesture (a wave as they pass) is upper body too: the legs keep walking under it
  [S('people/crowd.js')]: [
    // a cyclist: on the saddle, no helmet, hands on the flat bar, sitting up more than on a motorbike (beta/people/cyclists.js pedals)
    ["const GRIPS = { auto: [0.72, 1.07, 0.33], scooter: [0.62, 1.0, 0.3], bike: [0.6, 1.08, 0.34] };", "const GRIPS = { auto: [0.72, 1.07, 0.33], scooter: [0.62, 1.0, 0.3], bike: [0.6, 1.08, 0.34], cycle: [0.44, 1.0, 0.28] };"],
    ["const LEAN = { bike: 0.5, scooter: 0.36, auto: 0.24, pillion: 0.14 };", "const LEAN = { bike: 0.5, scooter: 0.36, auto: 0.24, pillion: 0.14, cycle: 0.3 };"],
    ["base = /^bike/.test(o.type) ? 'bike' : /^auto/.test(o.type) ? 'auto' : 'scooter';", "base = /^bike/.test(o.type) ? 'bike' : /^auto/.test(o.type) ? 'auto' : /^cycle/.test(o.type) ? 'cycle' : 'scooter';"],
    ["const seats = two ? [[bike ? 0.0 : 0.04, 0, false, bike ? 0.95 : 0.8]]", "const cyc = /^cycle/.test(o.type), seats = two ? [[bike ? 0.0 : cyc ? 0.1 : 0.04, 0, false, bike ? 0.95 : cyc ? 0.92 : 0.8]]"],
    ["helmet: two && i === 0 && o.type !== 'scooterP' });", "helmet: two && i === 0 && o.type !== 'scooterP' && !cyc });"],
    // someone a power is lit on (Vetal going into them, Brahmarakshas reading them) keeps a real body however far off:
    // the glow is on the body, and the crowd used to hand a far one's body to someone nearer a moment later
    ["const R0 = this.range || RANGE, r = p.cop || p.ctl || p.story ? R0 + 14 : R0;", "const lit = p._lit > performance.now() - 600, R0 = this.range || RANGE, r = lit ? 1e9 : p.cop || p.ctl || p.story ? R0 + 14 : R0;"],
    ["if (d < r) cand.push([d - (p.cop || p.ctl ? 12 : 0) + (seen ? 0 : 15), p]);", "if (d < r) cand.push([d - (p.cop || p.ctl ? 12 : 0) - (lit ? 1e5 : 0) + (seen ? 0 : 15), p]);"],
    ["if (mv > 0.3 && !once && !LOCO.has(name)) {", "if (mv > 0.3 && (!once || UPPER.has(name)) && !LOCO.has(name)) {"],
    // after each person's clip: where they look (beta/draw/alive.js)
    // someone being dragged or waking up is posed every frame, seen or not (behind you, they were posed every few
    // frames and your hands, holding them, jumped between where they were and where they'd been)
    ["if (seen ? (dd < 30 ||", "if (p._drag || p._wake ? true : seen ? (dd < 30 ||"],
    ["H.mixer.update(Math.min(s.dtAcc, 0.25)); s.dtAcc = 0; upd = true; }", "H.mixer.update(Math.min(s.dtAcc, 0.25)); s.dtAcc = 0; upd = true; if (this.postPed && dd < 40) this.postPed(p, H, dt); }"]],
  // animals: the walk follows how far they really move (no gliding when the game moves them, no 2.6x cap when they run)
  [S('people/animals.js')]: [
    ["      const lie = !a.moving && a.kind !== 'cow' && !a.cow;\n      m.play(a.moving ? (a.cow ? 'WalkSlow' : 'Walk') : 'Idle', a.moving ? (a.cow ? 0.9 : Math.min(2.6, Math.max(1, a.v / 1.1))) : 1);",
     "      const q = m._lx === undefined ? 0 : Math.hypot(a.x - m._lx, a.z - m._lz); m._lx = a.x; m._lz = a.z;\n      if (q < 3 && dt > 0) m._v = (m._v || 0) + (q / dt - (m._v || 0)) * Math.min(1, dt * 6);\n      const mv = m._v || 0, walking = mv > 0.12, cowS = a.cow || a.kind === 'cow', slow = cowS && mv < 0.9;\n      if (walking && mv > 2.4) { m._ph = (m._ph || 0) + dt * mv * 2.2; m.holder.position.y += Math.abs(Math.sin(m._ph)) * Math.min(0.07, (mv - 2.4) * 0.02); }\n      const lie = !walking && a.kind !== 'cow' && !a.cow;\n      m.play(walking ? (slow ? 'WalkSlow' : 'Walk') : 'Idle', walking ? Math.max(0.45, mv / (cowS ? (slow ? 0.7 : 1.1) : a.kind === 'cat' ? 0.6 : 0.95)) : 1);"],
  ],
  // a cow goes at a cow's pace, shooed off or following you (beta/people/cows.js)
  [S('people/strays.js')]: [
    ["      if (sp > 0) {", "      if (a.kind === 'cow' || a.cow) sp = Math.min(sp, 2.2);\n      if (sp > 0) {"],
  ],
  [S('people/fight.js')]: [
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
    // the pad's Y is the camera, as C is (V is Vetal)
    ["edge(3, 'KeyV');", "edge(3, 'KeyC');"],
  ],
  [S('game/game.js')]: [
    // the weapons wheel open: the mouse picks on the wheel, the view stays where it was
    ["document.addEventListener('mousemove', (e) => { if (locked() && this.state === 'play') {", "document.addEventListener('mousemove', (e) => { if (locked() && this.state === 'play' && !(this.arms && this.arms.wheelOn)) {"],
    // V is Vetal now (C is the camera)
    ["if (this.input.took('KeyV')) this.rig.setMode(this.rig.mode + 1);", ""],
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
  [S('people/peds.js')]: [
    ["if (d < r && pv > 2) {", "if (pv > 2 && (this.vehTouches ? this.vehTouches(a, player) : d < r)) {"],
  ],
  // parked vehicles solid over their real length and width: a chain of circles as wide as the vehicle from bumper to
  // bumper (a parked scooter was one 0.45 m circle in its middle: you walked through its nose and its tail)
  [S('traffic/parked.js')]: [
    ["const pick = (a) => rng.pick(a).map(lin);", "const pick = (a) => rng.pick(a).map(lin);\n  const chain = (x, z, hx, hz, L, Wd) => { const r = Wd / 2, n = Math.max(1, Math.ceil((L - Wd) / (r * 0.8)) + 1), out = []; for (let i = 0; i < n; i++) { const o = n === 1 ? 0 : -(L / 2 - r) + (L - 2 * r) * i / (n - 1); out.push(W.collision.addCircle(x + hx * o, z + hz * o, r, 2)); } return out; };"],
    ["rec.circles.push(W.collision.addCircle(x + tx * 1.1, z + tz * 1.1, 0.85, 2), W.collision.addCircle(x - tx * 1.1, z - tz * 1.1, 0.85, 2));", "rec.circles.push(...chain(x, z, tx, tz, { hatch: 3.65, sedan: 4.0, suv: 4.5 }[k], { hatch: 1.62, sedan: 1.72, suv: 1.82 }[k]));"],
    ["rec.circles.push(W.collision.addCircle(px, pz, 0.45, 2));", "rec.circles.push(...chain(px, pz, hx, hz, k === 'bike' ? 2.0 : 1.85, 0.62));"],
    ["rec.circles.push(W.collision.addCircle(px, pz, 0.8, 2), W.collision.addCircle(px - tx * 0.9, pz - tz * 0.9, 0.7, 2));", "rec.circles.push(...chain(px, pz, -tx, -tz, 2.7, 1.38));"],
  ],
  // the police (beta/game/pursuit.js has the rest): they actually chase. Faster the higher the heat; quicker to react;
  // they go where you're going to be, not where you were a second ago; at three stars and up they ram you off the road
  // instead of following politely; a vehicle counts as caught when you're slow beside one of them (or boxed in by two),
  // not only at a crawl; on foot they run as fast as a fit constable does, and keep it up longer
  [S('game/police.js')]: [
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
    // cyclists close by are real people too (beta/people/cyclists.js): an empty cycle to seat them on, and the cycle in
    // the list of what gets real riders up close
    ["scooterE: buildScooter({ helmet: true, noRider: true }), bikeE: buildBike({ helmet: true, noRider: true }),", "scooterE: buildScooter({ helmet: true, noRider: true }), bikeE: buildBike({ helmet: true, noRider: true }), cycleE: buildCycle({ noRider: true }),"],
    ["for (const k of [...TYPE_NAMES, 'scooterE', 'bikeE', 'autoE'])", "for (const k of [...TYPE_NAMES, 'scooterE', 'bikeE', 'autoE', 'cycleE'])"],
    ["/^(scooter|bike|auto)/.test(v.type) && !(v.fallen > 0);", "/^(scooter|bike|auto|cycle)/.test(v.type) && !(v.fallen > 0);"],
    ["bullet: buildBike({ helmet: true }), superbike: buildBike({ helmet: true }),", "bullet: buildBike({ helmet: true, kind: 'bullet' }), superbike: buildBike({ helmet: true, kind: 'superbike' }),"],
    // the models inside the types (beta/vehicles/models.js VARIANTS): their own spawn share, bodies and time-of-day mix
    ["import { buildAuto, buildScooter, buildBike, buildCar, buildBus, buildTempo, buildCycle, buildLow, PAINTS } from '../vehicles/models.js';", "import { buildAuto, buildScooter, buildBike, buildCar, buildBus, buildTempo, buildCycle, buildLow, PAINTS, VARIANTS, addVariantTypes, baseOf } from '../vehicles/models.js';"],
    ["const TYPE_NAMES = Object.keys(TYPES);", "addVariantTypes(TYPES); const TYPE_NAMES = Object.keys(TYPES);"],
    ["tempo: buildTempo(), bus: buildBus(),", "tempo: buildTempo(), bus: buildBus(), ...Object.fromEntries(Object.keys(VARIANTS).map(k => [k, buildCar(k)])),"],
    // a car you're getting into: the one built for you stands in its place (beta/vehicles/cardoor.js)
    ["const seated = v.wreck || (v.rich", "if (v.hideBody) continue; const seated = v.wreck || (v._tp && v._tp.empty) || (v.rich"],
    // a two-wheeler going over: its roll and how high its middle sits as it falls (beta/traffic/topple.js)
    ["const roll = v.fallen > 0 ? 1.3 : v.roll;", "const roll = v.fallen > 0 ? (v._tp ? v._tp.th : 1.3) : v.roll;"],
    ["p.set(v.rx ?? v.x, (v.y || 0) + (v.fallen > 0 ? 0.3 : 0), v.rz ?? v.z);", "p.set(v.rx ?? v.x, (v.y || 0) + (v.fallen > 0 ? (v._tp ? 0.3 * Math.min(1, Math.abs(v._tp.th) / 1.36) : 0.3) : 0), v.rz ?? v.z);"],
    ["tot += t.w * (mix[k] ?? 1);", "tot += t.w * (mix[k] ?? mix[baseOf(k)] ?? 1);"],
    // the far model of the empty two-wheeler / auto (real riders up close, a wreck) is that vehicle without its baked
    // rider, not a car: buildLow('scooterE') fell through to the car box, so a scooter past the detail range drew as a car
    ["const lowGeo = buildLow(k);", "const lowGeo = /E$/.test(k) ? buildLow(k.slice(0, -1), true) : buildLow(k);"],
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
