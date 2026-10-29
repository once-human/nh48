// NH48, entry point. Stage 1 boot: renderer + post-processing, asset loading with honest progress,
// the streamed PBR city, and a free camera for checking the world. Gameplay plugs in on top.
import * as THREE from 'three';
import './game/keys.js';            // key rebinding: its listener goes first
import { Loader, stripToArray, bitmapTexture, upgradeArray } from './core/assets.js';
import { buildWorld, updateWorldMaterials } from './world/world.js';
import { updateProps } from './world/propsChunk.js';
import { Sky } from './gfx/sky.js';
import { Post } from './gfx/post.js';
import { U } from './gfx/materials.js';
import { installAtmosphere } from './gfx/atmos.js';
import { runTreeLab, runPeopleLab, runCarLab } from './lab.js';
import { vehicleMaterials } from './vehicles/vehmat.js';
import { PlayerAuto } from './vehicles/player.js';
import { Traffic } from './traffic/traffic.js';
import { CameraRig } from './game/camera.js';
import { Input } from './game/input.js';
import { Game } from './game/game.js';
import { Pilot } from './game/pilot.js';
import { HumanKit } from './people/humans.js';
import { AnimalKit } from './people/animals.js';
import { MetroTrains } from './world/metroTrains.js';
import { TileManager, cityFromBase } from './world/tiles.js';
import * as Save from './game/save.js';
import { fixPins } from './world/venues.js';

export const QUALITY = {
  // for old laptops and office PCs: 75% resolution, no shadows or grass, a shorter view, thinner crowds
  lite: { name: 'lite', pixelRatio: 0.75, shadows: false, shadowSize: 0, msaa: false, texMax: 512, boardRes: 1, signScale: 1,
    streamRadius: 260, streamBudget: 2, grassRange: 0, grassCap: 0, treeNearRange: 18, treeMidRange: 70, treeFarRange: 380, treeNearCap: 60, treeMidCap: 400, treeFarCap: 2500, leafCell: 256, impostorCell: 128, propRange: 80, far: 1000, traffic: 40, peds: 60 },
  low: { name: 'low', pixelRatio: 1.0, shadows: false, shadowSize: 0, msaa: false, texMax: 512, boardRes: 1, signScale: 1,
    streamRadius: 360, streamBudget: 2, grassRange: 22, grassCap: 2200, treeNearRange: 28, treeMidRange: 100, treeFarRange: 600, treeNearCap: 100, treeMidCap: 700, treeFarCap: 5000, leafCell: 256, impostorCell: 128, propRange: 110, far: 1400, traffic: 70, peds: 110 },
  med: { name: 'med', pixelRatio: 1.5, shadows: true, shadowSize: 2048, msaa: true, texMax: 1024, boardRes: 1, signScale: 1,
    streamRadius: 520, streamBudget: 2.5, grassRange: 42, grassCap: 6500, treeNearRange: 60, treeMidRange: 210, treeFarRange: 1100, treeNearCap: 300, treeMidCap: 2000, treeFarCap: 11000, crowdRange: 60, leafCell: 512, impostorCell: 256, propRange: 170, far: 2200, traffic: 130, peds: 190 },
  high: { name: 'high', pixelRatio: 2, shadows: true, shadowSize: 2048, msaa: true, texMax: 1024, boardRes: 1, signScale: 1,
    streamRadius: 720, streamBudget: 3, grassRange: 60, grassCap: 12000, treeNearRange: 110, treeMidRange: 320, treeFarRange: 1500, treeNearCap: 700, treeMidCap: 3800, treeFarCap: 16000, crowdRange: 75, leafCell: 512, impostorCell: 256, propRange: 240, far: 3000, traffic: 170, peds: 260 },
};

const params = new URLSearchParams(location.search);
const EXPO = +(params.get('expo') || 1.0);
export const TEST = params.has('test');
// all of Pune, streamed in 4 km tiles: the default whenever the build carries the tiles (?city=classic for the
// old central map)
let PUNE = params.get('city') === 'pune';

function gpuClass() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/SwiftShader|llvmpipe|softpipe|Software|Microsoft Basic/i.test(r)) return 'soft';
    if (/HD Graphics(?! [6-9]\d\d)|Mali-[GT]?\d{1,2}\b|Adreno \(TM\) [2-5]\d\d|PowerVR|Vivante/i.test(r) && !/UHD|Iris|Arc/i.test(r)) return 'weak';
    if (/Intel|UHD|Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d+ Graphics|Mali|Adreno|Apple/i.test(r) && !/Arc/i.test(r)) return 'integrated';
    return 'discrete';
  } catch (e) { return 'unknown'; }
}
const GPU = gpuClass();
function pickQuality() {
  const q = params.get('q');
  if (q && QUALITY[q]) return { ...QUALITY[q] };
  try { const s = localStorage.getItem('nh48_quality'); if (s && QUALITY[s]) return { ...QUALITY[s] }; } catch (e) { /* storage blocked */ }
  if (GPU === 'soft') return { ...QUALITY.lite };
  if (GPU === 'weak') return { ...QUALITY.low };
  // laptop graphics (Intel UHD / Iris, Radeon Vega): Medium's look at the screen's own resolution with a
  // lighter shadow map, grass and crowd, so it holds a steady frame rate instead of swinging between 30 and 60
  if (GPU === 'integrated') return { ...QUALITY.med, pixelRatio: 1.0, shadowSize: 1024, grassRange: 32, grassCap: 3800, treeNearRange: 45, treeMidRange: 170,
    treeNearCap: 200, treeMidCap: 1400, treeFarCap: 8000, streamRadius: 440, streamBudget: 2, propRange: 140, traffic: 100, peds: 150 };
  return { ...QUALITY.med };
}

const ASSETS = {
  map: 'assets/map.gz.txt',
  // the ground and wall textures start small (a quarter size, 0.2 MB) and are swapped for the sharp ones once
  // you're playing
  gAlb: 'assets/tex/ground_alb_lo.webp', gNrm: 'assets/tex/ground_nrm_lo.webp', gArm: 'assets/tex/ground_arm_lo.webp',
  wAlb: 'assets/tex/wall_alb_lo.webp', wNrm: 'assets/tex/wall_nrm_lo.webp', wArm: 'assets/tex/wall_arm_lo.webp',
  bark: 'assets/tex/bark_brown_02_diff.webp', barkN: 'assets/tex/bark_brown_02_nor.webp', palm: 'assets/tex/palm_bark_diff.webp',
  // models ship gzipped
  peopleM: 'assets/people/people_m.glb.gz', peopleF: 'assets/people/people_f.glb.gz',
  animals: { dog: 'assets/animals/dog.glb.gz', cat: 'assets/animals/cat.glb.gz', cow: 'assets/animals/cow.glb.gz', kite: 'assets/animals/kite.glb.gz' },
};
const SOUNDS = ['horn_car', 'horn_beep', 'horn_truck', 'horn_truck_short', 'dog_bark', 'dog_bark2', 'crow', 'cow_moo', 'temple_bells',
  'auto_start', 'car_idle', 'diesel_idle', 'amb_street', 'amb_auto_ride', 'amb_traffic'];

async function main() {
  // Start over asked for a clean slate on this load
  try { if (sessionStorage.getItem('nh48_wipe')) { Save.wipe(); sessionStorage.removeItem('nh48_wipe'); } } catch (e) { /* ignore */ }
  if (!document.createElement('canvas').getContext('webgl2')) throw new Error('This browser has no WebGL 2. Puneri needs a recent Chrome, Edge, Firefox or Safari.');
  const quality = pickQuality();
  installAtmosphere();
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !!quality.msaa, powerPreference: 'high-performance', stencil: false, depth: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // the shadow map is redrawn every other frame (the sun moves slowly; people and cars at 30 updates a second look
  // the same), which takes a big share of the GPU's work off half the frames
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false;
  // If the GPU driver resets (out of memory, a too-long frame) the browser drops the WebGL context
  // and the canvas goes black. Recover: remember where the player was, then reload into the same spot.
  let ctxGame = null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    try { ctxGame?.saveResume(); } catch (err) { /* ignore */ }
    const m = document.getElementById('ld-msg'), ld = document.getElementById('loading');
    if (ld) { ld.classList.remove('done'); ld.hidden = false; }
    if (m) m.textContent = 'Graphics driver reset, reloading where you were…';
    setTimeout(() => location.reload(), 1200);
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, quality.far);

  const fill = document.getElementById('ld-fill'), msg = document.getElementById('ld-msg');
  let shownF = 0;
  const progress = async (text, f) => {
    if (text && msg) msg.textContent = text;
    if (text) (window.__boot || (window.__boot = [])).push([text, Math.round(performance.now())]);
    if (f != null) { shownF = Math.max(shownF, f); if (fill) fill.style.width = Math.round(shownF * 100) + '%'; }
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  };

  // ---- downloads (0 .. 0.6 of the bar)
  let manifest = {};
  try { manifest = JSON.parse(document.getElementById('manifest').textContent); } catch (e) { /* dev */ }
  const loader = new Loader((f) => { shownF = Math.max(shownF, f * 0.6); if (fill) fill.style.width = Math.round(shownF * 100) + '%'; });
  if (!params.has('city') && manifest['assets/pune/base.json.gz']) PUNE = true;
  if (PUNE) ASSETS.map = 'assets/pune/base.json.gz';
  for (const v of Object.values(ASSETS)) for (const u of typeof v === 'string' ? [v] : Object.values(v)) loader.expect(u, manifest[u] || 1e6);
  const sndUrl = (n) => `assets/snd/${n}.mp3`;
  loader.expect('assets/voices_pk.mp3', manifest['assets/voices_pk.mp3'] || 1e5);
  const VOICE_BIN = 'assets/voices.mp3';
  await progress('Downloading Pune', 0.01);
  const sounds = {};
  const sndJob = Promise.all([(async () => {
    // the character screen's lines (a few KB) come with the game, so the menu speaks from the start
    try { const b = await loader.bytes('assets/voices_pk.mp3'), idx = manifest.__voices || {}; for (const [id, [off, len, pk]] of Object.entries(idx)) if (pk === 3) sounds['v_' + id] = b.buffer.slice(b.byteOffset + off, b.byteOffset + off + len); } catch (e) { /* silent */ }
  })()]);
  // the leaves, painted ahead of time (saves painting them here, the slowest part of the old load)
  const leavesJob = params.has('noleafcache') ? Promise.resolve(null) : loader.bytes('assets/tex/leaves_256.rgba.gz').then(async (b) => {
    const u = new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    const [w, h] = new Uint32Array(u.buffer, 0, 2); return { w, h, data: u.subarray(8) };
  }).catch(() => null);
  const [M, gAlb, gNrm, gArm, wAlb, wNrm, wArm, bark, barkN, palm] = await Promise.all([
    PUNE ? loader.bytes(ASSETS.map).then(async (b) => cityFromBase(JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()))) : loader.json(ASSETS.map), loader.bitmap(ASSETS.gAlb), loader.bitmap(ASSETS.gNrm), loader.bitmap(ASSETS.gArm),
    loader.bitmap(ASSETS.wAlb), loader.bitmap(ASSETS.wNrm), loader.bitmap(ASSETS.wArm),
    loader.bitmap(ASSETS.bark), loader.bitmap(ASSETS.barkN), loader.bitmap(ASSETS.palm)]);
  await sndJob;
  let kit = null;
  try { const [gm, gf] = await Promise.all([loader.gltf(ASSETS.peopleM), loader.gltf(ASSETS.peopleF)]); kit = new HumanKit(gm, gf); } catch (e) { console.warn('people models failed', e); }
  let animalKit = null;
  try {
    const ents = Object.entries(ASSETS.animals);
    const gl = await Promise.all(ents.map(([, u]) => loader.gltf(u).catch(() => null)));
    animalKit = new AnimalKit(Object.fromEntries(ents.map(([k], i) => [k, gl[i]])));
  } catch (e) { console.warn('animal models failed', e); }
  await progress('Preparing materials', 0.62);
  const tm = quality.texMax;
  const T = {
    groundAlb: stripToArray(gAlb, { srgb: true, maxSize: tm, anisotropy: 8 }), groundNrm: stripToArray(gNrm, { maxSize: tm, anisotropy: 8 }), groundArm: stripToArray(gArm, { maxSize: tm }),
    wallAlb: stripToArray(wAlb, { srgb: true, maxSize: tm }), wallNrm: stripToArray(wNrm, { maxSize: tm }), wallArm: stripToArray(wArm, { maxSize: tm }),
    bark: bitmapTexture(bark), barkN: bitmapTexture(barkN, { srgb: false }), palm: bitmapTexture(palm),
    leaves: await leavesJob,
  };
  for (const b of [gAlb, gNrm, gArm, wAlb, wNrm, wArm]) b.close?.();
  if (params.get('lab') === 'people' && kit) return runPeopleLab(renderer, quality, kit, params, animalKit);
  if (params.get('lab') === 'cars') return runCarLab(renderer, quality, params);
  if (params.get('lab') === 'trees') { renderer.info.autoReset = false; return runTreeLab(renderer, quality, T, params); }

  const W = await buildWorld(M, T, renderer, scene, quality, (t, f) => progress(t, 0.62 + f * 0.2));
  const sky = new Sky(renderer, scene);
  sky.setShadows(quality.shadows, quality.shadowSize);
  W.sky = sky;
  const post = new Post(renderer, scene, camera, quality);
  window.__W = W; window.__updateProps = updateProps; window.__U = U;

  if (PUNE) {
    // the tiles around where you'll start: your saved spot, or Shaniwar Wada for a new game (FC Road with ?spawn)
    let sx = -1013, sz = 700;
    if (params.has('spawn')) { sx = -2450; sz = 1100; }
    if (params.has('fly') && params.get('at')) { const a = params.get('at').split(',').map(Number); sx = a[0]; sz = a[1]; }
    try { if (params.has('fly')) throw 0; const sp = Save.startPoint(Save.load()); if (sp) { sx = sp.x; sz = sp.z; } } catch (e) { /* new game */ }
    try { const r = JSON.parse(sessionStorage.getItem('nh48_resume') || 'null'); if (r) { sx = r.x; sz = r.z; } } catch (e) { /* none */ }
    W.tiles = new TileManager(W);
    await progress('Loading this part of Pune', 0.83);
    await W.tiles.warm(sx, sz, 300, (k, n) => { shownF = Math.max(shownF, 0.83 + 0.03 * k / n); if (fill) fill.style.width = Math.round(shownF * 100) + '%'; });
  }
  if (params.has('fly')) return runFly({ W, renderer, scene, camera, sky, post, quality, progress });

  // ---- gameplay
  try { W.trains = new MetroTrains(W, scene, M); } catch (e) { console.warn('metro trains', e); }
  const vmats = vehicleMaterials();
  for (const m of Object.values(vmats)) sky.reflective(m);
  const auto = new PlayerAuto(W, scene, vmats);
  const player = new Pilot({ W, scene, vmats, kit, auto });
  W.kit = kit; W.animalKit = animalKit;
  const traffic = new Traffic(W, scene, vmats, quality);
  traffic.player = player;
  const rig = new CameraRig(camera, W);
  rig.traffic = traffic;
  const input = new Input(canvas);
  const game = new Game({ W, scene, camera, renderer, sky, player, traffic, rig, input, quality, params, QUALITY, vmats, post, sounds });
  ctxGame = game;
  window.__game = game;
  W.cityMap = game.city;
  W.tiles?.attachGame(game);
  // voices never hold up the start: the street voices first, a few seconds in, then the shopkeepers' and the
  // people-you-talk-to packs one after another (the city around you gets the bandwidth first)
  {
    const idx = manifest.__voices || {}, bg = new Loader(() => {});
    const pack = (url, k) => bg.bytes(url).then((b) => { for (const [id, [off, len, pk]] of Object.entries(idx)) if ((pk || 0) === k) game.audio.raw['v_' + id] = b.buffer.slice(b.byteOffset + off, b.byteOffset + off + len); }).catch(() => { /* subtitles still show */ });
    // the main roads of all Pune for the map's street names (left out of the start)
    if (W.tiles) setTimeout(() => bg.bytes('assets/pune/base_map.json.gz').then(async (b) => {
      const d = JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
      W.cityMap && W.cityMap.setCoarse(d.coarse, d.cwater);
    }).catch(() => { /* names fill in as you go */ }), 6000);
    // every shop and place in Pune onto the map (names and spots only, about a megabyte)
    if (W.tiles) setTimeout(() => bg.bytes('assets/pune/pins.json.gz').then(async (b) => {
      const list = JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
      W.cityMap && W.cityMap.addPins(fixPins(list));
    }).catch(() => { /* the map fills in as you go */ }), 9000);
    // the voice lines (about 40 MB in all) aren't downloaded up front any more: each clip is fetched the first
    // time someone says it (a ranged read from its pack), so the game stays light in memory
    game.voiceRemote = { idx, urls: [VOICE_BIN, 'assets/voices_k.mp3', 'assets/voices_d.mp3', 'assets/voices_pk.mp3', 'assets/voices_vb.mp3'] }; void pack;
  }
  await game.init(progress);
  if (game.audio && game.voiceRemote) game.audio.remote = game.voiceRemote;
  // warm the chunks around the start before the first frame
  await progress('Building the streets', 0.86);
  const sx = player.x, sz = player.z;
  W.streamer.warm(sx, sz, Math.min(170, quality.streamRadius), (k, n) => { shownF = Math.max(shownF, 0.86 + 0.1 * k / n); if (fill) fill.style.width = Math.round(shownF * 100) + '%'; });
  updateProps(W, sx, sz); W.fly?.update?.(sx, sz);
  sky.update(game.hour, game.focus(), 0);
  // shaders: compiled in the background while you're on the title screen; the city shows once they're in
  let compiled = TEST;
  const compileJob = Promise.all([game.warming, renderer.compileAsync(scene, camera)]).catch(() => {}).then(() => { compiled = true; document.getElementById('gl')?.classList.remove('warming'); });
  if (TEST) await compileJob;
  else document.getElementById('gl')?.classList.add('warming');
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    post.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  onResize();
  await progress('Ready', 1);
  document.getElementById('loading').classList.add('done');
  // the map, sharp everywhere: the 2 km pictures of all of Pune, then the 1 km ones around you
  if (W.tiles && W.cityMap) setTimeout(() => { const P = game.player; W.cityMap.prefetch(1, P.x, P.z); W.cityMap.prefetch(2, P.x, P.z, 5000); }, 12000);
  setTimeout(() => { try { W.trees.sharpenLeaves(); } catch (e) { /* keep the soft ones */ } }, 2500);
  // after the first frame: the sounds, then the sharp ground and wall textures (one at a time, so the first
  // seconds of play aren't fighting them for the network)
  (async () => {
    const bg = new Loader(() => {});
    await Promise.all(SOUNDS.map(async (n) => { try { const b = await bg.bytes(sndUrl(n)); game.audio.addRaw(n, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch (e) { /* plays without it */ } }));
    for (const [k, url] of [['groundAlb', 'ground_alb'], ['groundNrm', 'ground_nrm'], ['groundArm', 'ground_arm'], ['wallAlb', 'wall_alb'], ['wallNrm', 'wall_nrm'], ['wallArm', 'wall_arm']]) {
      try { const b = await bg.bitmap(`assets/tex/${url}.webp`); upgradeArray(T[k], b, { maxSize: quality.texMax }); b.close?.(); } catch (e) { /* stays soft */ }
    }
  })();

  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 12);
  const inView = (x, z) => { sphere.center.set(x, 4, z); return frustum.intersectsSphere(sphere); };
  game.inView = inView;
  let last = performance.now(), acc = 0, propT = 0, frames = 0, dtS = 1 / 60;
  const STEP = 1 / 60;
  // F3: performance overlay
  const perfBox = document.createElement('div');
  perfBox.className = 'dev'; perfBox.hidden = !params.has('perf');
  document.getElementById('ui').appendChild(perfBox);
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); perfBox.hidden = !perfBox.hidden; } });
  const pf = { t: 0, n: 0, worst: 0, cpu: 0, gpuish: 0, hitch: 0 };
  const fwd = new THREE.Vector3();
  const perf = window.__perf = { n: 0, upd: 0, rnd: 0, worst: 0 };
  // watchdog: a frame that throws must not stop the game (the screen would freeze or go black). A run of
  // failures, or a camera/player gone to NaN, or a city that never comes back: reload where you were
  let bad = 0, lastGood = null, emptyT = 0;
  function frame(now) {
    try { frame1(now); bad = 0; } catch (err) {
      console.warn('frame', err);
      if (++bad < 90) requestAnimationFrame(frame);
      else { try { game.saveResume(); } catch (e2) { /* ignore */ } location.reload(); }
      return;
    }
    // sanity: NaN anywhere in the camera or the player puts you back where you last were fine
    const p = player, c = camera.position;
    if (!Number.isFinite(p.x + p.z + c.x + c.y + c.z)) {
      if (lastGood) { try { p.teleportFoot ? p.teleportFoot(lastGood.x, lastGood.z, lastGood.th, traffic) : null; } catch (e3) { /* below */ } }
      if (!Number.isFinite(p.x + p.z)) { try { game.saveResume(); } catch (e2) { /* ignore */ } location.reload(); }
    } else if ((frames & 63) === 0) lastGood = { x: p.x, z: p.z, th: p.th || 0 };
    // the city around you gone (a tile failed to load, chunks dropped): fetch it again; still nothing: reload
    if (game.state === 'play' && W.streamer && W.streamer.built.size === 0) {
      emptyT += 1 / 60;
      if (emptyT > 4 && emptyT < 4.02 && W.tiles) { W.tiles.ensure?.(p.x, p.z, 650).catch?.(() => {}); }
      if (emptyT > 20) { try { game.saveResume(); } catch (e2) { /* ignore */ } location.reload(); }
    } else emptyT = 0;
  }
  function frame1(now) {
    const t0 = performance.now();
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // frame pacing: small wobbles in frame time (16, 17, 15, 18 ms) are smoothed so motion doesn't judder;
    // a real hitch still counts in full so nothing drifts from the clock
    dtS = Math.abs(dt - dtS) < 0.012 ? dtS + (dt - dtS) * 0.2 : dt;
    dt = dtS;
    if (TEST) dt = 1 / 30;
    renderer.info.reset();
    // tests can simulate several frames per rendered frame (?simx=4), software GL is slow
    const simx = TEST ? Math.max(1, parseInt(params.get('simx') || '1')) : 1;
    let simDone = false;
    for (let k = 0; k < simx; k++) {
      // simulate exactly this frame's time, in equal sub-steps no longer than 1/60 s: a fixed 1/60 step
      // against a display that doesn't tick at exactly 60 Hz gives some frames no step and some two,
      // which reads as jitter at speed
      const nsub = Math.min(6, Math.max(1, Math.ceil(dt / STEP - 1e-3))), h = dt / nsub;
      for (let s = 0; s < nsub; s++) game.fixed(h);
      game.frame(dt);
      if (k < simx - 1) { frames++; if (game.testDone(frames)) { simDone = true; break; } }
    }
    U.uTime.value += dt;
    const focus = game.focus();
    // indoors the light is the room's own, not the time of day outside (a club stays dark)
    sky.update(game.lightHour ? game.lightHour() : game.hour, focus, dt);
    renderer.toneMappingExposure *= EXPO;
    if (game.weather && !(game.interiors && game.interiors.inside)) game.weather.apply(dt, sky, scene, renderer, camera);
    U.uShopsOpen.value = game.hour > 22.8 || game.hour < 8.5 ? 0.25 : 1;
    updateWorldMaterials(W);
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    camera.getWorldDirection(fwd);
    W.tiles?.update(dt, focus.x, focus.z);
    W.streamer.update(focus.x, focus.z, fwd);
    W.nearBoards.update(camera.position.x, camera.position.z, dt);
    W.trains?.update(dt, camera.position);
    propT -= dt;
    if (propT <= 0) { updateProps(W, camera.position.x, camera.position.z); W.fly?.update?.(camera.position.x, camera.position.z); propT = 0.2; }
    const t1 = performance.now();
    // the map covers the screen, and while paused the last frame just sits there (blurred by CSS): no rendering at all
    // shadows every other frame when you're still; every frame when you're moving (a stale shadow judders against you)
    if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = (frames & 1) === 0 || Math.abs(player.onFoot ? (player.foot.v || 0) : (player.v || 0)) > 1.2;
    if (compiled && game.state !== 'map' && !(game.state === 'pause' && !game.livePause && (game.pauseFrames = (game.pauseFrames || 0) + 1) > 2)) post.render(dt);
    const t2 = performance.now();
    perf.n++; perf.upd += t1 - t0; perf.rnd += t2 - t1; perf.worst = Math.max(perf.worst, t1 - t0);
    if (!perfBox.hidden) {
      const ft = dt * 1000;
      pf.t += dt; pf.n++; pf.worst = Math.max(pf.worst, ft); pf.cpu += t2 - t0; if (ft > 33) pf.hitch++;
      if (pf.t >= 0.5) {
        const i = renderer.info, st = W.streamer.stats;
        perfBox.textContent = `${(pf.n / pf.t).toFixed(0)} fps · worst ${pf.worst.toFixed(0)} ms · hitches ${pf.hitch}\n` +
          `cpu ${(pf.cpu / pf.n).toFixed(1)} ms/frame · ${quality.name} · ${GPU} · res ${renderer.getPixelRatio().toFixed(2)}x\n` +
          `${i.render.calls} draws · ${(i.render.triangles / 1e6).toFixed(2)}M tris · ${i.memory.geometries} geos · ${i.memory.textures} tex\n` +
          `stream: ${W.streamer.built.size} chunks · last ${st.ms.toFixed(0)} ms (sliced) · peak/frame ${st.worst.toFixed(1)} ms`;
        pf.t = 0; pf.n = 0; pf.worst = 0; pf.cpu = 0; pf.hitch = 0;
      }
    }
    game.afterRender(dt, now);
    frames++;
    if (TEST && (simDone || game.testDone(frames))) {
      window.__stats = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures,
        traffic: traffic.list.length, player: { x: +player.x.toFixed(1), z: +player.z.toFixed(1), v: +player.v.toFixed(2), th: +player.th.toFixed(2) }, ...game.testInfo() };
      window.__shotReady = true;
    }
    requestAnimationFrame(frame);
  }
  window.__nh = {
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, chunks: W.streamer.built.size, traffic: traffic.list.length }),
    setView: () => {}, setHour: (h) => game.setHour(h), play: (shift) => game.startPlay(!!shift), game,
  };
  requestAnimationFrame(frame);
}

// ---- free camera for checking the world: ?fly&at=x,z,height,yawDeg,pitchDeg&hour=16.5
async function runFly({ W, renderer, scene, camera, sky, post, quality, progress }) {
  const canvas = renderer.domElement;
  const fill = document.getElementById('ld-fill');
  const start = (params.get('at') || '-2530,380,2,0,-4').split(',').map(Number);
  const cam = { x: start[0], z: start[1], y: start[2] ?? 2, yaw: (start[3] || 0) * Math.PI / 180, pitch: (start[4] || 0) * Math.PI / 180 };
  let hour = +(params.get('hour') || 16.5);
  const keys = new Set();
  addEventListener('keydown', (e) => { keys.add(e.code); });
  addEventListener('keyup', (e) => { keys.delete(e.code); });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    cam.yaw -= (e.clientX - drag.x) * 0.004; cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch - (e.clientY - drag.y) * 0.004));
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  const placeCamera = () => { camera.position.set(cam.x, cam.y, cam.z); camera.rotation.set(cam.pitch, cam.yaw, 0, 'YXZ'); camera.updateMatrixWorld(); };
  placeCamera();
  const warmR = Math.min(260, quality.streamRadius);
  W.streamer.warm(cam.x, cam.z, warmR, (k, n) => { if (fill) fill.style.width = Math.round((0.82 + 0.16 * k / n) * 100) + '%'; });
  updateProps(W, cam.x, cam.z);
  sky.update(hour, camera.position, 0);
  await progress('Compiling shaders', 0.99);
  await renderer.compileAsync(scene, camera);
  const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); post.setSize(window.innerWidth, window.innerHeight); };
  window.addEventListener('resize', onResize);
  onResize();
  await progress('Ready', 1);
  document.getElementById('loading').classList.add('done');
  const dev = document.createElement('div');
  dev.className = 'dev';
  if (!TEST) document.getElementById('ui').appendChild(dev);
  let pending = 0;
  window.__nh = {
    setView: async (x, z, y, yawDeg, pitchDeg) => { Object.assign(cam, { x, z, y, yaw: yawDeg * Math.PI / 180, pitch: pitchDeg * Math.PI / 180 }); placeCamera(); if (W.tiles) await W.tiles.warm(x, z, 300); W.streamer.warm(x, z, warmR); updateProps(W, x, z); },
    setHour: (h) => { hour = h; },
    pending: () => pending,
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures, chunks: W.streamer.built.size }),
  };
  let last = performance.now(), propT = 0, frames = 0, fpsAcc = 0, fpsN = 0;
  const fwd = new THREE.Vector3();
  function frame(now) {
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (TEST) dt = 1 / 30;
    renderer.info.reset();
    const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 60 : 14) * dt;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    if (keys.has('KeyW')) { cam.x += fx * sp; cam.z += fz * sp; }
    if (keys.has('KeyS')) { cam.x -= fx * sp; cam.z -= fz * sp; }
    if (keys.has('KeyA')) { cam.x += fz * sp; cam.z -= fx * sp; }
    if (keys.has('KeyD')) { cam.x -= fz * sp; cam.z += fx * sp; }
    if (keys.has('KeyE')) cam.y += sp;
    if (keys.has('KeyQ')) cam.y = Math.max(0.6, cam.y - sp);
    if (keys.has('BracketRight')) hour = (hour + dt * 1.5) % 24;
    if (keys.has('BracketLeft')) hour = (hour - dt * 1.5 + 24) % 24;
    placeCamera();
    U.uTime.value += dt;
    sky.update(hour, camera.position, dt);
    renderer.toneMappingExposure *= EXPO;
    U.uShopsOpen.value = hour > 22.8 || hour < 8.5 ? 0.25 : 1;
    updateWorldMaterials(W);
    camera.getWorldDirection(fwd);
    pending = W.streamer.update(cam.x, cam.z, fwd);
    W.nearBoards.update(cam.x, cam.z, dt);
    propT -= dt;
    if (propT <= 0) { updateProps(W, cam.x, cam.z); propT = 0.25; }
    post.render(dt);
    frames++; fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) {
      const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
      const i = renderer.info;
      dev.textContent = `NH48 fly · ${quality.name} · ${GPU}\n${fps.toFixed(0)} fps · ${i.render.calls} calls · ${(i.render.triangles / 1e6).toFixed(2)}M tris\n` +
        `chunks ${W.streamer.built.size} · queue ${pending} · last ${W.streamer.stats.ms.toFixed(1)} ms\n` +
        `x ${cam.x.toFixed(0)} z ${cam.z.toFixed(0)} · ${Math.floor(hour)}:${String(Math.floor(hour % 1 * 60)).padStart(2, '0')}\nWASD fly · Q/E down/up · Shift fast · [ ] time`;
    }
    if (TEST && frames >= 3 && (pending === 0 || frames > 600)) window.__shotReady = true;
    if (W.tiles && W.tiles.update) W.tiles.update(dt, cam.x, cam.z);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  const m = document.getElementById('ld-msg');
  if (m) { m.className = 'ld-err'; m.textContent = 'Something went wrong while loading: ' + (e && e.message ? e.message : e); }
  window.__error = String(e && e.stack || e);
});
