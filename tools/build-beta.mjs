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
  // C switches first and third person (on foot too, V still does); rolling moves to Q
  [S('game/keys.js')]: [
    ["{ id: 'roll', label: 'Roll; camera when driving', group: 'Do', def: 'KeyC' }", "{ id: 'roll', label: 'Roll', group: 'Do', def: 'KeyQ' }"],
    ["{ id: 'cam', label: 'Change camera', group: 'Vehicle', def: 'KeyV' }", "{ id: 'cam', label: 'First or third person', group: 'Move', def: 'KeyC' }"],
    // F is for vehicles only; V walks in, talks, pets, fuels: a car parked by a shop no longer hides the shop
    ["{ id: 'use', label: 'Talk, walk in, get in or out', group: 'Do', def: 'KeyF' },", "{ id: 'use', label: 'Get in or out of a vehicle', group: 'Do', def: 'KeyF' }, { id: 'visit', label: 'Walk in, talk, pet, fuel up', group: 'Do', def: 'KeyV' },"],
  ],
  [S('game/pilot.js')]: [
    ["      if (!(this.onFoot && this.offer) && this.useHook && this.useHook()) { /* walked in */ }\n      else if (this.onFoot && this.offer) this.enter(this.offer, traffic);", "      if (this.onFoot && this.offer && this.offer.kind !== 'pet') this.enter(this.offer, traffic);"],
    ["    if (input.took('KeyF') && this.busy <= 0) {", "    if (input.took('KeyV') && this.busy <= 0) { if (this.onFoot && this.offer && this.offer.kind === 'pet') this.enter(this.offer, traffic); else if (this.useHook) this.useHook(); }\n    if (input.took('KeyF') && this.busy <= 0) {"],
    ["'Pet the dog', key: 'F' });", "'Pet the dog', key: 'V' });"],
  ],
  [S('game/shops.js')]: [["if (e.code === 'Escape' || e.code === 'KeyF' || e.code === 'KeyE') {", "if (e.code === 'Escape' || e.code === 'KeyF' || e.code === 'KeyV' || e.code === 'KeyE') {"]],
  [S('people/fight.js')]: [["if (input.took('KeyC') && !busyDown", "if (input.took('KeyQ') && !busyDown"]],
  [S('game/game.js')]: [
    ["if (this.state === 'play' && !this.player.onFoot && this.input.took('KeyC')) this.rig.setMode(this.rig.mode + 1);", "if (this.state === 'play' && this.input.took('KeyC')) this.rig.toggleView(this.player.onFoot);"],
    ["      if (P.offer && P.onFoot) this.hud.prompt(P.offer.key, P.offer.label, 0.3);\n      else if (sl && this.state === 'play') this.hud.prompt('F', sl, 0.3);", "      if (P.offer && P.onFoot) { this.hud.prompt(P.offer.key, P.offer.label, 0.3); if (sl && this.state === 'play') this.hud.prompt2('V', sl, 0.3); }\n      else if (sl && this.state === 'play') this.hud.prompt('V', sl, 0.3);"],
  ],
  [S('traffic/traffic.js')]: [["bullet: buildBike({ helmet: true }), superbike: buildBike({ helmet: true }),", "bullet: buildBike({ helmet: true, kind: 'bullet' }), superbike: buildBike({ helmet: true, kind: 'superbike' }),"]],
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
