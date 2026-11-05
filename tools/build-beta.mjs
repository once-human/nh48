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
  [S('world/tiles.js')]: [["for (let j = 0; j < D.walls.length; j += 60) {", "for (let j = 0; j < 0; j += 60) {"]],
  [S('world/propsChunk.js')]: [["for (const w of M.walls) {", "for (const w of []) {"]],
  [S('world/props.js')]: [["for (const w of M.walls) {", "for (const w of []) {"]],
  // the four-wheel ground of beta/vehicles/physics.js
  [S('vehicles/vehicle.js')]: [
    ["case 'bike': case 'bikeP': case 'bullet': case 'superbike': return buildBike({ parked: true });", "case 'bike': case 'bikeP': return buildBike({ parked: true }); case 'bullet': case 'superbike': return buildBike({ parked: true, kind: type });"],
    ["    const hF = this.heightAt(this.x + hx * half, this.z + hz * half), hR = this.heightAt(this.x - hx * half, this.z - hz * half);\n    const jolt = Math.max(Math.abs(hF - this.prevH[0]), Math.abs(hR - this.prevH[1]));", "    const gr = this.ground(hx, hz, sp), hF = gr.f, hR = gr.r, jolt = gr.jolt;"],
    ["this.onFootpath = this.deck < 0 && !W.surf.isRoad(this.x, this.z);", "this.onFootpath = this.deck < 0 && gr.off > 0.5;"],
    ["-clamp(this.latAcc * 0.01, -0.06, 0.06);", "-clamp(this.latAcc * 0.01, -0.06, 0.06) + gr.roll;"],
  ],
  // C switches first and third person; rolling is Ctrl; the jhola is Q; vehicles are E
  [S('game/keys.js')]: [
    ["{ id: 'bag', label: 'Jhola', group: 'Menus', def: 'KeyE' },", "{ id: 'bag', label: 'Jhola', group: 'Menus', def: 'KeyQ' },"],
    ["{ id: 'roll', label: 'Roll; camera when driving', group: 'Do', def: 'KeyC' }", "{ id: 'roll', label: 'Roll', group: 'Do', def: 'ControlLeft' }"],
    ["{ id: 'punch', label: 'Punch (click works too)',", "{ id: 'punch', label: 'Punch (click works too; hold right-click to block)',"],
    ["{ id: 'cam', label: 'Change camera', group: 'Vehicle', def: 'KeyV' }", "{ id: 'cam', label: 'First or third person', group: 'Move', def: 'KeyC' }, { id: 'vetal', label: 'Vetal: hold on someone to take them over, tap to go home', group: 'Powers', def: 'KeyV' }, { id: 'brahma', label: 'Brahmarakshas: read the person you face', group: 'Powers', def: 'KeyO' }, { id: 'munja', label: 'Munja: everyone near, through walls', group: 'Powers', def: 'Period' }"],
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
  [S('game/guide.js')]: [["['F', 'Interact, enter, get in or out'], ['E', 'Jhola'],", "['F', 'Walk in, counters, pet'], ['E', 'Get in or out of a vehicle'], ['T', 'Talk to someone'], ['Q', 'Jhola'],"], ["['T', 'Phone'],", "['I', 'Phone'],"], ["['V', 'Camera (anytime)'],", "['C', 'First or third person'],"]],
  [S('game/pilot.js')]: [
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
  ],
  // talk to anyone: no hearts over strangers any more (yours keep theirs: blue in your phone, black your partner), and
  // anyone with a name in a room can be talked to; it opens the talk (beta/game/talk.js), chatting them up leads to dating
  // each footprint keeps its storeys, so flying stops at a wall but clears the roof (bldTop, beta/game/commands.js flight)
  [S('world/mapdata.js')]: [
    ["      const rec = { rings: [r], bb: [x0, z0, x1, z1], tag };", "      const rec = { rings: [r], bb: [x0, z0, x1, z1], tag, top: (B.y || 0) + (B[2] || 1)*3.2 + 1.4 };"],
    ["  inBuilding(x, z) { return this.test(this.bld, x, z); }", "  inBuilding(x, z) { return this.test(this.bld, x, z); }\n  bldTop(x, z) { const l = this.bld.get(this.chunkOf(x, z)); let t = -1; if (l) for (const p of l) { if (x < p.bb[0] || x > p.bb[2] || z < p.bb[1] || z > p.bb[3]) continue; if (p.top > t && pointInRings(x, z, p.rings)) t = p.top; } return t; }"],
  ],
  [S('world/interiors.js')]: [
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
  [S('people/crowd.js')]: [["if (mv > 0.3 && !once && !LOCO.has(name)) {", "if (mv > 0.3 && (!once || UPPER.has(name)) && !LOCO.has(name)) {"],
    // after each person's clip: where they look (beta/draw/alive.js)
    ["H.mixer.update(Math.min(s.dtAcc, 0.25)); s.dtAcc = 0; upd = true; }", "H.mixer.update(Math.min(s.dtAcc, 0.25)); s.dtAcc = 0; upd = true; if (this.postPed && dd < 40) this.postPed(p, H, dt); }"]],
  // animals: the walk follows how far they really move (no gliding when the game moves them, no 2.6x cap when they run)
  [S('people/animals.js')]: [
    ["      const lie = !a.moving && a.kind !== 'cow' && !a.cow;\n      m.play(a.moving ? (a.cow ? 'WalkSlow' : 'Walk') : 'Idle', a.moving ? (a.cow ? 0.9 : Math.min(2.6, Math.max(1, a.v / 1.1))) : 1);",
     "      const q = m._lx === undefined ? 0 : Math.hypot(a.x - m._lx, a.z - m._lz); m._lx = a.x; m._lz = a.z;\n      if (q < 3 && dt > 0) m._v = (m._v || 0) + (q / dt - (m._v || 0)) * Math.min(1, dt * 6);\n      const mv = m._v || 0, walking = mv > 0.12, cowS = a.cow || a.kind === 'cow', slow = cowS && mv < 0.9;\n      if (walking && mv > 2.4) { m._ph = (m._ph || 0) + dt * mv * 2.2; m.holder.position.y += Math.abs(Math.sin(m._ph)) * Math.min(0.07, (mv - 2.4) * 0.02); }\n      const lie = !walking && a.kind !== 'cow' && !a.cow;\n      m.play(walking ? (slow ? 'WalkSlow' : 'Walk') : 'Idle', walking ? Math.max(0.45, mv / (cowS ? (slow ? 0.7 : 1.1) : a.kind === 'cat' ? 0.6 : 0.95)) : 1);"],
  ],
  [S('people/fight.js')]: [
    ["if (input.took('KeyC') && !busyDown", "if ((input.took('ControlLeft') || input.took('ControlRight')) && !busyDown"],
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
    // V is Vetal now (C is the camera)
    ["if (this.input.took('KeyV')) this.rig.setMode(this.rig.mode + 1);", ""],
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
    ["const fl = S.sill + 0.06, xb = -hl + 0.55, xd = xf0 - 0.55;", "const fl = S.sill + 0.06, xb = -hl + 0.55, xd = xf0 - 0.55, kS = Math.min(1, (S.H - (kind === 'sports' || kind === 'super' ? 0.24 : 0.15) - fl) / 1.2);"],
    ["const back = new THREE.BoxGeometry(0.12, 0.62, 0.46); back.rotateZ(0.2); back.translate(xs - 0.36, fl + 0.68, zs);", "const back = new THREE.BoxGeometry(0.12, 0.62 * kS, 0.46); back.rotateZ(0.2); back.translate(xs - 0.36, fl + 0.36 + 0.32 * kS, zs);"],
    ["bx(xs - 0.5, fl + 1.02, zs - 0.13, xs - 0.4, fl + 1.2, zs + 0.13, CLOTH);", "bx(xs - 0.5, fl + 0.36 + 0.66 * kS, zs - 0.13, xs - 0.4, fl + 0.36 + 0.84 * kS, zs + 0.13, CLOTH);"],
    ["if (S.L > 3.8) { bx(xb + 0.05, fl + 0.2, -hw + 0.15, xb + 0.55, fl + 0.36, hw - 0.15, CLOTH); bx(xb - 0.02, fl + 0.36, -hw + 0.15, xb + 0.1, fl + 0.95, hw - 0.15, CLOTH); }", "if (S.L > 3.8 && kind !== 'sports' && kind !== 'super') { const xr = Math.max(xb, S.roofR - 0.45), yt = Math.min(fl + 0.95, S.H - 0.32); bx(xr + 0.05, fl + 0.2, -hw + 0.15, xr + 0.55, fl + 0.36, hw - 0.15, CLOTH); bx(xr - 0.02, fl + 0.36, -hw + 0.15, xr + 0.1, yt, hw - 0.15, CLOTH); }"],
    ["b2 = new THREE.Vector3(Math.min(xf0 - 0.6, xf0 - (H - belt) * 0.9), H - 0.08,", "b2 = new THREE.Vector3(Math.min(xf0 - 0.3, S.roofF - 0.04), H - 0.1,"],
    ["const mx = xf0 - 0.42;", "const mx = Math.min(xf0 - 0.42, S.roofF - 0.12);"],
  ],
  [S('traffic/traffic.js')]: [
    ["bullet: buildBike({ helmet: true }), superbike: buildBike({ helmet: true }),", "bullet: buildBike({ helmet: true, kind: 'bullet' }), superbike: buildBike({ helmet: true, kind: 'superbike' }),"],
    // the models inside the types (beta/vehicles/models.js VARIANTS): their own spawn share, bodies and time-of-day mix
    ["import { buildAuto, buildScooter, buildBike, buildCar, buildBus, buildTempo, buildCycle, buildLow, PAINTS } from '../vehicles/models.js';", "import { buildAuto, buildScooter, buildBike, buildCar, buildBus, buildTempo, buildCycle, buildLow, PAINTS, VARIANTS, addVariantTypes, baseOf } from '../vehicles/models.js';"],
    ["const TYPE_NAMES = Object.keys(TYPES);", "addVariantTypes(TYPES); const TYPE_NAMES = Object.keys(TYPES);"],
    ["tempo: buildTempo(), bus: buildBus(),", "tempo: buildTempo(), bus: buildBus(), ...Object.fromEntries(Object.keys(VARIANTS).map(k => [k, buildCar(k)])),"],
    ["tot += t.w * (mix[k] ?? 1);", "tot += t.w * (mix[k] ?? mix[baseOf(k)] ?? 1);"],
    ["x -= t.w * (mix[k] ?? 1);", "x -= t.w * (mix[k] ?? mix[baseOf(k)] ?? 1);"],
  ],
  [S('vehicles/vehicle.js')]: [
    ["import { buildScooter, buildBike, buildCycle, buildCar, buildBus, buildTempo, buildAuto, PAINTS, wheelsOf } from './models.js';", "import { buildScooter, buildBike, buildCycle, buildCar, buildBus, buildTempo, buildAuto, PAINTS, wheelsOf, VARIANTS, baseOf } from './models.js';"],
    ["default: return buildCar('hatch');", "default: return VARIANTS[type] ? buildCar(type, { interior: true }) : buildCar('hatch');"],
    ["if (['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super'].includes(type)) {", "if (['hatch', 'sedan', 'suv', 'taxi', 'lux', 'jeep', 'sports', 'super'].includes(baseOf(type))) {"],
    ["export function defaultPaint(type, rng) {", "export function defaultPaint(type, rng) {\n  type = baseOf(type);"],
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
