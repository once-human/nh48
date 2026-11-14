// Puneri /beta, entry point: the game's own boot (src/main.js), wired to the new look. Everything that decides what
// happens is the game's own code; what's different here is how it's drawn (src/beta/gfx, src/beta/world) and that
// /beta keeps its own saves, starts you on foot with no auto of your own, and has no story.
import './people/clippose.js';       // every pose built on a body starts from the clip's, every frame (no spinning)
import './game/guard.js';         // the terminal's hold on the keyboard: before every other key listener
import * as THREE from 'three';
import { inside } from './gfx/repaint.js';
import './world/fixes.js';
import './core/storage.js';         // /beta's saves and settings live apart from the game's (first, before anything reads them)
import './gfx/legacy.js';           // the look for everything still drawn with three's materials (before any is made)
import '@orig/gfx/painted.js';
import '@orig/game/keys.js';        // key rebinding: its listener goes first
import { Loader, bitmapTexture } from '@orig/core/assets.js';
import { buildWorld, updateWorldMaterials } from '@orig/world/world.js';
import { updateProps } from '@orig/world/propsChunk.js';
import { Sky } from '@orig/gfx/sky.js';
import { Post } from './gfx/post.js';
import { cpuLaps } from './gfx/gpuclock.js';
import { Paint } from './gfx/paint.js';
import { painter, paintLod } from './world/buildings.js';
import { betaGame, betaTitle } from './game/beta.js';
import { U } from '@orig/gfx/materials.js';
import { installAtmosphere } from '@orig/gfx/atmos.js';
import { vehicleMaterials } from './vehicles/vehmat.js';
import * as VM from './vehicles/models.js';
import './vehicles/physics.js';
import './vehicles/tyres.js';
import './vehicles/twowheel.js';      // two-wheelers lean to turn, each its own way
import './vehicles/steerfront.js';    // the bars, fork and front wheel turn with the steering
import './vehicles/damage.js';        // dents where it's hit, holes where it's shot, flat tyres, fire from the engine
import './game/solid.js';
import './vehicles/glassbreak.js';    // door and back glass shatter and fall as bits, a windscreen cracks where it's struck
import './vehicles/crash.js';          // crashes by weight and speed: the heavier carries on, the lighter is thrown
import './vehicles/parts.js';         // a car comes apart where it's hit: doors spring and swing or tear off, the bonnet pops and flies up, what comes off tumbles
import './vehicles/crawl.js';         // never stuck: a crawl either way whatever state it's in
import './vehicles/brakes.js';        // each vehicle's own brakes; ABS, traction control and drive modes only where they're real
import './vehicles/exotic.js';
import './gfx/rainspray.js';          // the mist tyres throw up off a wet road        // a supercar's flames; slides wear tyres away
import './vehicles/auto3w.js';        // an auto corners on two wheels, and goes over, instead of sliding
import './vehicles/wheels.js';        // wheels that go round and turn
import './vehicles/details.js';       // springs and wheel travel, the rising wing, wipers, the wheel in your hands, discs, a cold start
import './game/radio.js';          // the car radio: live stations, through the car's own speakers
import './game/cabin.js';          // in a car the world goes behind glass, horns clear; the door lets it back in
import './game/pistol.js';         // a katta on the Z wheel from the start
import './vehicles/lamps.js';         // brake and reverse lamps that answer the pedals, yours and everyone's
import './vehicles/potholes.js';      // potholes jolt each kind of vehicle its own way
import './gfx/blood.js';              // blood pools from the body, under the head and chest, and spreads as blood does
import './people/stalls.js';          // stall keepers keep to their stalls
import './people/walls.js';           // nobody walks through a building
import './game/meow.js';              // a cat's meow
import './traffic/rates.js';
import './traffic/spacing.js';
import './traffic/steer.js';
import './traffic/topple.js';
import './traffic/temper.js';
import './traffic/brain.js';            // every driver their own person: how close, how fast, where across the road, signals, junctions
import './game/inputfix.js';           // Alt no longer steals the keyboard; double-tap forward to sprint, leaving Space free
import './traffic/pool.js';           // a vehicle the traffic lets go is wiped before it's handed out again
import './game/prompt2.js';
import './game/ask.js';           // what people tell you: the way, food, where you are, a lift
import './game/outing.js';
import './game/talk.js';          // T at anyone: talk
import './game/attend.js';        // who you talk to stays sat / goes back to what they were doing
import './game/hands.js';
import './game/fists.js';
import './game/climb.js';          // up and over: hands planted on the ledge, the feet up the face, a knee onto the top
import './game/vault.js';          // Space at a car: a hand on the bonnet, the hip slid across, down the far side (after climb.js)
import './game/crouch.js';
import './game/mirror.js';
import './world/mirrors.js';         // the shops' mirrors reflect          // a pose in a shop's mirror, a different one each time          // Ctrl standing still: crouch (on the move it's still the roll)
import './game/pursuit.js';
import './game/wanted.js';          // someone else wanted: a hit and run on you sends a marshal (and a jeep) after the vehicle         // a cop who saw you go into a shop comes in after you
import './world/staff.js';
import './world/walkin.js';
import { install as shopIn } from './world/shopin.js'; shopIn();   // shops walked into where they stand (after every other patch, so it's the first to see F)
import './world/busy.js';
import './world/pins.js';
import './draw/alive.js';
import './people/bodies.js';        // people, cows and dogs take up room: round each other, vehicles, poles, you
import './people/around.js';        // whatever's in the way, people go round it
import './people/runover.js';        // being hit by what you're driving, and being driven over
import './people/grudge.js';         // whoever you hit goes for the body that hit them (Vetal: not for you in someone else)
import './people/doors.js';          // into a shop and out again through its door
import './draw/falls.js';
import './vehicles/throwoff.js';     // off your own two-wheeler in a crash, and it goes over on its side
import './people/motion.js';         // the body's own weight on every clip: arms swing behind, the trunk leans and catches itself, breathing, everyone's own gait
import './people/inspect.js';        // someone lying in the street: a passer-by kneels, feels for a pulse, shakes their shoulder, rings for help
import './draw/fauna.js';
import './vehicles/mount.js';
import './vehicles/cardoor.js';
import './vehicles/getout.js';
import './vehicles/haul.js';          // an auto's, a tempo's, a bus's driver hauled out before you take it
import './vehicles/busdoors.js';
import './vehicles/busboards.js';     // PMPML route boards: a real route's number and destination
import './world/fade.js';             // street furniture fades in and out at the edge of its range
import './world/stopnames.js';        // each bus shelter's own stop name on its board
import './game/medics.js';            // paramedics wait while you're dragging the one they came for
import './game/quiet.js';             // walking and nothing's going on: the screen gets out of the way; what you overhear; service hours
import './game/dash.js';              // the car's lights on the speedometer; a continuous tyre squeal
import './game/engines.js';           // every vehicle its own engine (a bicycle its freewheel), yours and the street's
import './game/voices.js';            // overheard chatter and muttering quieter than talk aimed at you
import './vehicles/cabinfit.js';    // the cabin kept inside each car's own shell
import './vehicles/footdown.js';    // a foot down on the road when a two-wheeler stops
import './people/cyclists.js';        // cyclists close by: real people, pedalling
import './people/cows.js';            // cows amble across the road, not jump; trot, not sprint
import './vehicles/wrecks.js';      // a vehicle you got out of goes on smoking and burning
import './world/shutters.js';      // shutters that roll, with the rattle, and board lights that go with them
import './world/flyovers.js';
import './world/hills.js';
import './game/seat.js';
import './game/view.js';           // first or third person, on foot and driving     // vehicles as boxes on four wheels
import './game/stride.js';        // lean into turns and starts, feet on the ground under them, knees on landing
import './game/pet.js';           // down by a dog to stroke it or feed it, a banana up to a cow, namaskar to her
import './game/sfx.js';           // the small sounds of doing things: switches, knobs, a holster, paying, the metro gate, eating
import './game/garagefx.js';      // the garage at work: the wrench, the spray gun, the hammer, a test rev, the horn tried out
import './game/eat.js';           // what you buy to eat or drink, in your hand: the cutting glass, the vada pav, the plate
import './game/popless.js';       // out of a vehicle with no scene for it: eased from the seat, not a jump
import './game/wreckage.js';         // everything in the street can be knocked down: by what you drive, a kick, a round
import './vehicles/knockover.js';    // a parked scooter or bike goes over when it's kicked, shot or driven into
import { PU } from './gfx/paint.js';
import { PlayerAuto } from '@orig/vehicles/player.js';
import { Traffic } from '@orig/traffic/traffic.js';
import { CameraRig } from '@orig/game/camera.js';
import { Input } from '@orig/game/input.js';
import { Game } from '@orig/game/game.js';
import { Pilot } from '@orig/game/pilot.js';
import { HumanKit } from '@orig/people/humans.js';
import { AnimalKit } from '@orig/people/animals.js';
import { MetroTrains } from './world/metroTrains.js';
import { TileManager, cityFromBase } from '@orig/world/tiles.js';
import * as Save from '@orig/game/save.js';
import { fixPins } from '@orig/world/venues.js';
import { Streamer } from '@orig/world/index.js';
import { Actors } from './draw/actors.js';
import { Shadows } from './gfx/shadows.js';
import { paintSky } from './gfx/paintsky.js';
import { Lamps } from './gfx/lamps.js';
import { trackBodies } from './draw/skin.js';
import { Graphics, bootTier } from './game/graphics.js';
import { view } from './world/view.js';
import { Pace } from './game/pace.js';
import { DRIVE, longDrive, driveButton } from './drive/longdrive.js';
import { emptyMap, countryWorld } from './drive/country.js';
import { quiet } from './drive/strip.js';

// The streamer, taught two things about the painted city (when it builds, never what):
//  - when it builds everything at once (loading screens, arriving somewhere) the buildings are drawn right there,
//    not handed to the workers (warm and buildNow can't wait for them)
//  - while a chunk waits for its drawing from the workers, the rest of the frame's budget isn't spent spinning on it
function hookStreamer(paint) {
  const P = Streamer.prototype;
  if (P.betaHooked) return;
  P.betaHooked = true;
  for (const k of ['warm', 'buildNow']) {
    const f = P[k];
    P[k] = function (...a) { if (k === 'warm') paintLod(a[0], a[1]); paint.sync++; try { return f.apply(this, a); } finally { paint.sync--; } };
  }
  // world/index.js's update, with one change: a chunk waiting on the workers ends this frame's building
  P.update = function (x, z, viewDir, hold) {
    const I = this.W.index, half = I.size * 0.71;
    const t0 = performance.now();
    const far = (c) => Math.hypot(c.cx - x, c.cz - z) - half > this.keep && (!hold || Math.hypot(c.cx - hold.x, c.cz - hold.z) - half > this.keep);
    for (const c of this.built) if (far(c)) this.disposeChunk(c);
    if (this.job && far(this.job.c)) this.cancelJob();
    if (this.pendingAdd.length) {
      const p = this.pendingAdd[0];
      p.kids[p.i++].visible = true;
      if (p.i >= p.kids.length) { this.pendingAdd.shift(); this.W.farGround?.set(p.c, true); }
    }
    paintLod(x, z);
    let slices = 0;
    this.W.paintWait = false;
    while (performance.now() - t0 < this.budgetMs) {
      if (!this.job) {
        // round you first; then, turn about, where you're headed (main.js sets lead when you're moving)
        const L = this.lead; this._alt = !this._alt;
        const c = L && this._alt ? this.pickNext(L.x, L.z, viewDir) || this.pickNext(x, z, viewDir) : this.pickNext(x, z, viewDir) || (L && this.pickNext(L.x, L.z, viewDir));
        if (!c) break;
        this.startJob(c);
      }
      const s0 = performance.now();
      const st = this.job.it.next();
      const sl = performance.now() - s0;
      this.job.ms += sl;
      if (sl > (this.stats.maxSlice || 0)) { this.stats.maxSlice = sl; this.stats.maxSliceAt = this.job.stage + ':' + (this.W.sliceLabel || ''); }
      slices++;
      if (st.done) this.reveal(this.finishJob(), false);
      else if (this.W.paintWait) { this.W.paintWait = false; break; }
    }
    const spent = performance.now() - t0;
    this.stats.slices = slices;
    this.stats.worst = Math.max(this.stats.worst * 0.995, spent);
    return (this.missing || 0) + (this.job ? 1 : 0) + this.pendingAdd.length;
  };
}

export const QUALITY = {
  // for old laptops and office PCs: 75% resolution, no shadows or grass, a shorter view, thinner crowds
  lite: { name: 'lite', pixelRatio: 0.75, shadows: false, shadowSize: 0, msaa: false, texMax: 512, boardRes: 1, signScale: 1,
    streamRadius: 260, streamBudget: 2, grassRange: 0, grassCap: 0, treeNearRange: 29, treeMidRange: 182, treeFarRange: 380, treeNearCap: 150, treeMidCap: 1600, treeFarCap: 2500, leafCell: 256, impostorCell: 128, propRange: 136, far: 1000, traffic: 40, peds: 60 },
  low: { name: 'low', pixelRatio: 1.0, shadows: false, shadowSize: 0, msaa: false, texMax: 512, boardRes: 1, signScale: 1,
    streamRadius: 360, streamBudget: 2, grassRange: 22, grassCap: 2200, treeNearRange: 45, treeMidRange: 260, treeFarRange: 600, treeNearCap: 250, treeMidCap: 2800, treeFarCap: 5000, leafCell: 256, impostorCell: 128, propRange: 187, far: 1400, traffic: 70, peds: 110 },
  med: { name: 'med', pixelRatio: 1.5, shadows: true, shadowSize: 2048, msaa: true, texMax: 1024, boardRes: 1, signScale: 1,
    streamRadius: 520, streamBudget: 2.5, grassRange: 42, grassCap: 6500, treeNearRange: 96, treeMidRange: 546, treeFarRange: 1100, treeNearCap: 750, treeMidCap: 8000, treeFarCap: 11000, crowdRange: 60, leafCell: 512, impostorCell: 256, propRange: 289, far: 2200, traffic: 130, peds: 190 },
  high: { name: 'high', pixelRatio: 2, shadows: true, shadowSize: 2048, msaa: true, texMax: 1024, boardRes: 1, signScale: 1,
    streamRadius: 720, streamBudget: 3, grassRange: 60, grassCap: 12000, treeNearRange: 176, treeMidRange: 832, treeFarRange: 1500, treeNearCap: 1750, treeMidCap: 15200, treeFarCap: 16000, crowdRange: 75, leafCell: 512, impostorCell: 256, propRange: 408, far: 3000, traffic: 170, peds: 260 },
};

const params = new URLSearchParams(location.search);
const EXPO = +(params.get('expo') || 1.0);
const STUDIO_SKY = new THREE.Color(0xffffff), STUDIO_GND = new THREE.Color(0x3a3630);      // (game/studio.js's fill)
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
// the stress test's rule: one pass a pixel at screen resolution, no MSAA
for (const k in QUALITY) { QUALITY[k].pixelRatio = Math.min(1, QUALITY[k].pixelRatio); QUALITY[k].msaa = false; QUALITY[k].shadows = true; QUALITY[k].shadowSize = QUALITY[k].shadowSize || 1024; QUALITY[k].grassRange = 64; QUALITY[k].grassCap = 40000; QUALITY[k].treeNearCap = 1600; QUALITY[k].treeMidCap = 7000; QUALITY[k].traffic = 220; QUALITY[k].impostorCell = 128; }
function pickQuality() {
  const q = params.get('q');
  if (q && QUALITY[q]) return { ...QUALITY[q] };
  // the world is built for the graphics you chose (or where Auto starts on this PC), not for the graphics card alone
  const tier = bootTier(GPU);
  if (tier < 2) return { ...QUALITY[tier ? 'low' : 'lite'] };
  // laptop graphics (Intel UHD / Iris, Radeon Vega): Medium's look at the screen's own resolution with a
  // lighter shadow map, grass and crowd, so it holds a steady frame rate instead of swinging between 30 and 60
  // (and the edges smoothed after the frame rather than by 4x MSAA, which alone was a third of the frame there)
  if (GPU === 'integrated') return { ...QUALITY.med, msaa: false, fxaa: true, pixelRatio: 1.0, shadowSize: 1024, grassRange: 32, grassCap: 3800, treeNearRange: 72, treeMidRange: 442,
    treeNearCap: 200, treeMidCap: 1400, treeFarCap: 8000, streamRadius: 440, streamBudget: 2, propRange: 140, traffic: 100, peds: 150 };
  return { ...QUALITY.med };
}

// the loading screen's gone once it has faded: left see-through it kept its 90 px blur and five big blended layers
// animating under the whole game, each frame
const loaded = () => { const ld = document.getElementById('loading'); ld.classList.add('done'); setTimeout(() => { if (ld.classList.contains('done')) ld.classList.add('gone'); }, 2000); };
const ASSETS = {
  map: 'assets/map.gz.txt',
  // the ground and wall textures start small (a quarter size, 0.2 MB) and are swapped for the sharp ones once
  // you're playing
  bark: 'assets/tex/bark_brown_02_diff.webp', barkN: 'assets/tex/bark_brown_02_nor.webp', palm: 'assets/tex/palm_bark_diff.webp',
  // models ship gzipped
  peopleM: 'assets/people/people_m.glb.gz', peopleF: 'assets/people/people_f.glb.gz',
  animals: { dog: 'assets/animals/dog.glb.gz', cat: 'assets/animals/cat.glb.gz', cow: 'assets/animals/cow.glb.gz', kite: 'assets/animals/kite.glb.gz' },
};
const SOUNDS = ['horn_car', 'horn_beep', 'horn_truck', 'horn_truck_short', 'dog_bark', 'dog_bark2', 'crow', 'cow_moo', 'temple_bells',
  'auto_start', 'car_idle', 'diesel_idle', 'amb_auto_ride'];

async function main() {
  // Start over asked for a clean slate on this load
  try { if (sessionStorage.getItem('nh48_wipe')) { Save.wipe(); sessionStorage.removeItem('nh48_wipe'); } } catch (e) { /* ignore */ }
  if (!document.createElement('canvas').getContext('webgl2')) throw new Error('This browser has no WebGL 2. Puneri needs a recent Chrome, Edge, Firefox or Safari.');
  const quality = pickQuality();
  if (params.has('fxaa')) { quality.fxaa = params.get('fxaa') === '1'; if (quality.fxaa && !params.has('msaa')) quality.msaa = false; }
  installAtmosphere();
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: params.has('msaa') ? params.get('msaa') === '1' : !!quality.msaa, powerPreference: 'high-performance', stencil: false, depth: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = false;                 // (gfx/shadows.js draws the sun's own)
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // the shadow map is redrawn every other frame (the sun moves slowly; people and cars at 30 updates a second look
  // the same), which takes a big share of the GPU's work off half the frames
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.info.autoReset = false;
  // three asks the driver for each shader's error log the first time it's used, and that call waits for the compile to
  // finish: a stall in the middle of a frame every time a new material comes on screen. Only for looking for bugs
  renderer.debug.checkShaderErrors = params.has('shaders');
  // If the GPU driver resets (out of memory, a too-long frame) the browser drops the WebGL context
  // and the canvas goes black. Recover: remember where the player was, then reload into the same spot.
  let ctxGame = null;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    try { ctxGame?.saveResume(); } catch (err) { /* ignore */ }
    const m = document.getElementById('ld-msg'), ld = document.getElementById('loading');
    if (ld) { ld.classList.remove('done', 'gone'); ld.hidden = false; }
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
  // (Long Drive: none of Pune, and no animals)
  if (DRIVE) { delete ASSETS.map; ASSETS.animals = {}; }
  else if (!params.has('city') && manifest['assets/pune/base.json.gz']) PUNE = true;
  if (PUNE) ASSETS.map = 'assets/pune/base.json.gz';
  for (const v of Object.values(ASSETS)) for (const u of typeof v === 'string' ? [v] : Object.values(v)) loader.expect(u, manifest[u] || 1e6);
  const sndUrl = (n) => `assets/snd/${n}.mp3`;
  loader.expect('assets/voices_pk.mp3', manifest['assets/voices_pk.mp3'] || 1e5);
  const VOICE_BIN = 'assets/voices.mp3';
  { const tips = [['दुपारी १ ते ४ दुकान बंद राहील.', 'Shops shut 1 to 4. It is the law of Pune'], ['पुणे तिथे काय उणे', 'What can Pune possibly lack?'], ['येथे सल्ला मिळणार नाही.', 'No advice given here. Unless you ask. Then a lot'], ['मिसळ: तर्री मागू नये, मिळेल.', 'Misal: don’t ask for more tarri. It’s coming'], ['Loading the speed breakers', 'Every hundred metres, as in real life'], ['Warming up the vada pav', 'Garam, with the green chutney'], ['हॉर्न वाजवू नका', 'Don’t honk. Everyone honks']];
    let k = Math.floor(Math.random() * tips.length); const tip = document.getElementById('ld-tip');
    const show = () => { if (!tip) return; tip.classList.remove('in'); setTimeout(() => { const [mr, en] = tips[k++ % tips.length]; tip.innerHTML = `<b>${mr}</b><span>${en}</span>`; tip.classList.add('in'); }, 260); };
    show(); const iv = setInterval(() => { if (document.getElementById('loading')?.classList.contains('done')) clearInterval(iv); else show(); }, 3600); }
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
  const [M, bark, barkN, palm] = await Promise.all([
    DRIVE ? Promise.resolve(emptyMap()) : PUNE ? loader.bytes(ASSETS.map).then(async (b) => cityFromBase(JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()))) : loader.json(ASSETS.map),
    loader.bitmap(ASSETS.bark), loader.bitmap(ASSETS.barkN), loader.bitmap(ASSETS.palm)]);
  await sndJob;
  let kit = null;
  try { const [gm, gf] = await Promise.all([loader.gltf(ASSETS.peopleM), loader.gltf(ASSETS.peopleF)]); kit = new HumanKit(gm, gf); trackBodies(kit); } catch (e) { console.warn('people models failed', e); }
  let animalKit = null;
  try {
    const ents = Object.entries(ASSETS.animals);
    const gl = await Promise.all(ents.map(([, u]) => loader.gltf(u).catch(() => null)));
    animalKit = new AnimalKit(Object.fromEntries(ents.map(([k], i) => [k, gl[i]])));
  } catch (e) { console.warn('animal models failed', e); }
  await progress('Preparing materials', 0.62);
  const tm = quality.texMax;
  const T = {
    bark: bitmapTexture(bark), barkN: bitmapTexture(barkN, { srgb: false }), palm: bitmapTexture(palm),
    leaves: await leavesJob,
  };

  // the new look's materials exist before the world is built (its builders draw with them)
  const paint = new Paint(renderer);
  window.__paint = paint;
  hookStreamer(paint);
  const W = await buildWorld(M, T, renderer, scene, quality, (t, f) => progress(t, 0.62 + f * 0.2));
  if (DRIVE) countryWorld(W, scene);
  const sky = new Sky(renderer, scene);
  W.sky = sky;
  paintSky(sky);
  const post = new Post(renderer, scene, camera, quality, paint, sky);
  // with the after-frame smoothing the city is drawn into the pass's picture, whose shaders differ from the screen's:
  // every precompile (loading screen, police, ambulance, people) builds those, so none compile mid-game
  if (post.fxaa) {
    const compile = renderer.compile.bind(renderer);
    renderer.compile = (s, c, t) => { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(post.target()); try { return compile(s, c, t); } finally { renderer.setRenderTarget(prev); } };
  }
  window.__THREE = THREE; window.__VM = VM; window.__W = W; window.__updateProps = updateProps; window.__U = U; window.__post = post;

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
  if (!DRIVE) try { W.trains = new MetroTrains(W, scene, M); } catch (e) { console.warn('metro trains', e); }
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
  betaGame(game);
  W.tiles?.attachGame(game);
  // (the map only exists once game.init has run: what's downloaded before then waits for it)
  let cityUp; const cityReady = new Promise((r) => { cityUp = r; });
  // voices never hold up the start: the street voices first, a few seconds in, then the shopkeepers' and the
  // people-you-talk-to packs one after another (the city around you gets the bandwidth first)
  {
    const idx = manifest.__voices || {}, bg = new Loader(() => {});
    const pack = (url, k) => bg.bytes(url).then((b) => { for (const [id, [off, len, pk]] of Object.entries(idx)) if ((pk || 0) === k) game.audio.raw['v_' + id] = b.buffer.slice(b.byteOffset + off, b.byteOffset + off + len); }).catch(() => { /* subtitles still show */ });
    // the main roads of all Pune for the map's street names (left out of the start)
    game.preloads = game.preloads || [];
    if (W.tiles) game.preloads.push(bg.bytes('assets/pune/base_map.json.gz').then(async (b) => {
      const d = JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
      await cityReady; W.cityMap.setCoarse(d.coarse, d.cwater); W.farGround?.water(d.cwater);
    }).catch(() => { /* names fill in as you go */ }));
    // every shop and place in Pune onto the map (names and spots only, about a megabyte)
    if (W.tiles) game.preloads.push(bg.bytes('assets/pune/pins.json.gz').then(async (b) => {
      const list = JSON.parse(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
      await cityReady; W.cityMap.allPins(fixPins(list));
    }).catch(() => { /* the map fills in as you go */ }));
    // the voice lines (about 40 MB in all) aren't downloaded up front any more: each clip is fetched the first
    // time someone says it (a ranged read from its pack), so the game stays light in memory
    game.voiceRemote = { idx, urls: [VOICE_BIN, 'assets/voices_k.mp3', 'assets/voices_d.mp3', 'assets/voices_pk.mp3', 'assets/voices_vb.mp3', 'assets/voices_vb2.mp3'] }; void pack;
  }
  // (Long Drive: each of the street's systems silenced the moment it exists, at every step of the setting up)
  if (DRIVE) quiet(game);
  await game.init(DRIVE ? async (t, f) => { quiet(game); return progress(t, f); } : progress);
  betaTitle(game);
  if (DRIVE) longDrive(game); else driveButton(game);
  { const actors = new Actors(game, scene); const lamps = new Lamps(game); post.beforeDraw = (dt, cam) => { actors.update(dt, cam); lamps.update(); inside.value = game.interiors && game.interiors.inside ? 1 : 0; }; post.streamer = W.streamer; post.shadows = new Shadows(renderer, scene, sky, 2048); post.focusAt = () => { const f = post.shadowFocus(); return Math.max(2, camera.position.distanceTo(f.position || (f.root && f.root.position) || f)); }; post.indoors = () => inside.value > .5; post.shadowFocus = () => (game.player.onFoot ? game.player.foot : game.player); game.swapShadows = (on, size) => post.shadows.set(on, size); game.shadowsOn = () => post.shadows.on; }
  // (not a texture whose picture has been let go once it reached the card, like the shop boards' atlases: sent again, it'd
  // send one blank pixel, and every board went black with no name on it)
  game.setAniso = (v) => { const a = Math.min(v, renderer.capabilities.getMaxAnisotropy()); THREE.Texture.DEFAULT_ANISOTROPY = a; const seen = new Set(), one = (t) => { if (t && t.isTexture && !seen.has(t) && t !== PU.tNoise.value && !t.isDepthTexture && !(t.image && t.image.width <= 1 && t.image.height <= 1)) { seen.add(t); if (t.anisotropy !== a) { t.anisotropy = a; t.needsUpdate = true; } } }; scene.traverse(o => { const m = o.material; if (!m) return; for (const q of Array.isArray(m) ? m : [m]) { one(q.map); if (q.uniforms && q.uniforms.tMap) one(q.uniforms.tMap.value); } }); };
  game.setVehicleDetail = (d) => { traffic.lodDist = d; const P = W.parked; if (P) for (const s of P.sets) { if (s.keep) continue; if (s.lvl === 1) { s.minRange = d; s.range = d*2.3; } else if (s.lvl === 2) s.minRange = d*2.3; else s.range = d; } updateProps(W, camera.position.x, camera.position.z); };
  if (W.trees) W.trees.cam = camera;
  sky.dome.renderOrder = 30;                          // (the sky last, only where nothing else has drawn: it was first, painted under everything)
  game.gfx = new Graphics(game, { gpu: GPU, post, PU, Vector2: THREE.Vector2 }); game.gfx.install();
  cityUp();
  if (game.audio && game.voiceRemote) game.audio.remote = game.voiceRemote;
  // warm the chunks around the start before the first frame
  await progress('Building the streets', 0.86);
  const sx = player.x, sz = player.z;
  if (W.country) W.country.warm(sx, sz);
  W.streamer.warm(sx, sz, Math.min(170, quality.streamRadius), (k, n) => { shownF = Math.max(shownF, 0.86 + 0.06 * k / n); if (fill) fill.style.width = Math.round(shownF * 100) + '%'; });
  // and their drawings, made on the workers meanwhile
  await painter.settle((k, n) => { shownF = Math.max(shownF, 0.92 + 0.04 * k / n); if (fill) fill.style.width = Math.round(shownF * 100) + '%'; });
  updateProps(W, sx, sz); W.fly?.update?.(sx, sz);
  sky.update(game.hour, game.focus(), 0);
  // shaders: compiled in the background while you're on the title screen; the city shows once they're in
  let compiled = TEST;
  const compileJob = Promise.all([game.warming, renderer.compileAsync(scene, camera)]).catch(() => {}).then(() => { compiled = true; document.getElementById('gl')?.classList.remove('warming'); });
  // everything heavy happens behind the loading screen, so the game opens smooth: the shaders, the sounds, the
  // sharp textures and leaves, the city map and its places, the police and ambulance models, the people's bodies
  if (!TEST) {
    await progress('Getting the city ready', 0.965);
    await Promise.all(SOUNDS.map(async (n) => { try { const b = await new Loader(() => {}).bytes(sndUrl(n)); game.audio.addRaw(n, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch (e) { /* plays without it */ } }));
    game.texUpgraded = true;
    try { W.trees.sharpenLeaves(); } catch (e) { /* keep the soft ones */ }
    await progress('Getting the people ready', 0.975);
    if (!DRIVE && game.crowd && game.crowd.prebuild) game.crowd.prebuild();
    if (!DRIVE) try { game.emergency && game.emergency.prewarm && game.emergency.prewarm(); } catch (e) { /* not critical */ }
    await Promise.all(game.preloads || []);
    await progress('Compiling the graphics', 0.985);
    await compileJob;
    // and once more for what was just built (the police, the ambulance, the people)
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* compiles on first use */ }
  }
  if (TEST) await compileJob;
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    post.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  onResize();
  await progress('Ready', 1);
  loaded();
  // the map, sharp everywhere: the 2 km pictures of all of Pune, then the 1 km ones around you
  if (W.tiles && W.cityMap) setTimeout(() => { const P = game.player; W.cityMap.prefetch(1, P.x, P.z); W.cityMap.prefetch(2, P.x, P.z, 5000); }, 12000);
  if (TEST) setTimeout(() => { try { W.trees.sharpenLeaves(); } catch (e) { /* keep the soft ones */ } }, 2500);
  // after the first frame: the sounds, then the sharp ground and wall textures (one at a time, so the first
  // seconds of play aren't fighting them for the network)
  (async () => {
    const bg = new Loader(() => {});
    if (game.texUpgraded) return;               // (done during loading)
    await Promise.all(SOUNDS.map(async (n) => { try { const b = await bg.bytes(sndUrl(n)); game.audio.addRaw(n, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch (e) { /* plays without it */ } }));
  })();

  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 12);
  const inView = (x, z) => { sphere.center.set(x, 4, z); return frustum.intersectsSphere(sphere); };
  game.inView = inView;
  let last = performance.now(), acc = 0, propT = 0, frames = 0, dtI = 0; const dtH = [1/60, 1/60, 1/60, 1/60, 1/60, 1/60];
  // (half a sixtieth: at 100 km/h a car goes 23 cm a step, not 46, so what it meets is found before it's half inside it)
  const STEP = 1 / 120;
  // F3: performance overlay
  const perfBox = document.createElement('div');
  perfBox.className = 'dev'; perfBox.hidden = !params.has('perf');
  document.getElementById('ui').appendChild(perfBox);
  addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); perfBox.hidden = !perfBox.hidden; } });
  const pf = { t: 0, n: 0, worst: 0, cpu: 0, gpuish: 0, hitch: 0 };
  const fwd = new THREE.Vector3();
  const perf = window.__perf = { n: 0, upd: 0, rnd: 0, worst: 0 };
  const laps = cpuLaps([['traffic', traffic, 'update'], ['people', game.people, 'update'], ['police', game.police, 'update'], ['player', player, 'update'], ['streamer', W.streamer, 'update'], ['tiles', W.tiles, 'update'], ['trains', W.trains, 'update'], ['trees', W.trees, 'update'], ['boards', W.nearBoards, 'update'], ['hud', game.hud, 'update'], ['crowd', game.crowd, 'update']]);
  // watchdog: a frame that throws must not stop the game (the screen would freeze or go black). A run of
  // failures, or a camera/player gone to NaN, or a city that never comes back: reload where you were
  let bad = 0, lastGood = null, emptyT = 0;
  const pace = game.pace = new Pace(); let workMs = 8;
  if (game.gfx && game.gfx.pace !== undefined) pace.on = !!game.gfx.pace;
  function frame(now) {
    // (every picture up for the same number of the screen's ticks: game/pace.js. Your frame limit is the least of them)
    if (!pace.tick(now, game.fpsCap, Math.max(workMs, post.clock?.total || 0), game.state === 'play')) { requestAnimationFrame(frame); return; }
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
    if (game.state === 'play' && !DRIVE && W.streamer && W.streamer.built.size === 0) {
      emptyT += 1 / 60;
      if (emptyT > 4 && emptyT < 4.02 && W.tiles) { W.tiles.ensure?.(p.x, p.z, 650).catch?.(() => {}); }
      if (emptyT > 20) { try { game.saveResume(); } catch (e2) { /* ignore */ } location.reload(); }
    } else emptyT = 0;
  }
  function frame1(now) {
    const t0 = performance.now();
    // The world runs in real time whatever the frame rate. A frame that took a fifth of a second moves everything on by a
    // fifth of a second (worked out in pieces of a tenth at most, below, so nothing takes one great stride). It used to
    // count for a tenth and no more: on a PC drawing five or eight frames a second the whole city ran at half speed,
    // people, traffic, fire and falls, which is a slower game for a slower PC. Fewer frames, never a slower world.
    // (Past 0.4 s it's a freeze, a street arriving: that isn't caught up)
    let dt = Math.min(0.4, (now - last) / 1000);
    last = now;
    // the step of time each frame is the average of the last six frames' real lengths. A frame's own length is only
    // known once it's over, so stepping by the one before went wrong exactly when frames come short, long, short, long
    // (a PC between 30 and 60 a second on a 60 Hz screen): the picture that stayed up long had moved by the short
    // one's time, and the other way round, which is twice the judder there need be. And after a freeze the catching up
    // is spread over six frames, not thrown into one. Every millisecond is still counted once: nothing drifts from the clock
    dtH[dtI = (dtI + 1)%6] = dt; dt = (dtH[0] + dtH[1] + dtH[2] + dtH[3] + dtH[4] + dtH[5])/6;
    // the world in slow motion (the phone out: 1/60th speed, everything still moving); UI keeps real time
    const real = dt;
    if (game.timeWarp && game.timeWarp !== 1) dt *= game.timeWarp;
    if (TEST) dt = 1 / 30;
    renderer.info.reset();
    // tests can simulate several frames per rendered frame (?simx=4), software GL is slow.
    // A long frame is the game worked out more than once, a tenth of a second or less each time
    const simx = TEST ? Math.max(1, parseInt(params.get('simx') || '1')) : Math.max(1, Math.ceil(real / 0.1 - 1e-6));
    const dp = TEST ? dt : dt / simx;
    game.realDt = TEST ? real : real / simx;
    let simDone = false;
    for (let k = 0; k < simx; k++) {
      // simulate exactly this frame's time, in equal sub-steps no longer than 1/60 s: a fixed 1/60 step
      // against a display that doesn't tick at exactly 60 Hz gives some frames no step and some two,
      // which reads as jitter at speed
      const nsub = Math.min(10, Math.max(1, Math.ceil(dp / STEP - 1e-3))), h = dp / nsub;
      for (let s = 0; s < nsub; s++) game.fixed(h);
      game.frame(dp);
      if (TEST && k < simx - 1) { frames++; if (game.testDone(frames)) { simDone = true; break; } }
    }
    U.uTime.value += dt;
    const focus = game.focus();
    // indoors the light is the room's own, not the time of day outside (a club stays dark)
    sky.update(game.lightHour ? game.lightHour() : game.hour, focus, dt);
    renderer.toneMappingExposure *= EXPO;
    if (game.weather && !(game.interiors && game.interiors.inside)) game.weather.apply(dt, sky, scene, renderer, camera);
    // the jhola's studio light: the same at any hour, the sky's light becomes the studio's soft fill and the city drops back behind you
    { const st = game.jhola ? game.jhola.lit || 0 : 0;
      if (st > 0.001) {
        sky.sun.intensity *= 1 - 0.85 * st;
        sky.hemi.intensity += (1.15 - sky.hemi.intensity) * st; sky.hemi.color.lerp(STUDIO_SKY, st); sky.hemi.groundColor.lerp(STUDIO_GND, st);
        renderer.toneMappingExposure += (1 - renderer.toneMappingExposure) * st;
        scene.environmentIntensity = 0.35 * (1 - 0.5 * st); game._studioWas = true;
      } else if (game._studioWas) { scene.environmentIntensity = 0.35; game._studioWas = false; } }     // (sky.js's value)
    U.uShopsOpen.value = game.hour > 22.8 || game.hour < 8.5 ? 0.25 : 1;
    updateWorldMaterials(W);
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    camera.getWorldDirection(fwd);
    const hold = game.peeking ? game.player.root.position : null;      // (the map looking somewhere else: you stay built)
    // where you'll be in a few seconds: the map and the streets there are loaded ahead of you, so even a supercar at
    // 350 km/h never sees one appear (from how fast the camera's really going, smoothed, up to 450 m out)
    const LV = game._lead || (game._lead = { x: focus.x, z: focus.z, vx: 0, vz: 0, p: { x: 0, z: 0 } });
    if (dt > 0 && dt < 0.25) { const k = Math.min(1, dt*2), jx = (focus.x - LV.x)/dt, jz = (focus.z - LV.z)/dt; if (Math.hypot(jx, jz) < 160) { LV.vx += (jx - LV.vx)*k; LV.vz += (jz - LV.vz)*k; } }
    LV.x = focus.x; LV.z = focus.z;
    const spd = Math.hypot(LV.vx, LV.vz), T = spd > 8 ? Math.min(4.5, 450/spd) : 0;
    LV.p.x = focus.x + LV.vx*T; LV.p.z = focus.z + LV.vz*T;
    const ahead = hold || (T > 0 ? LV.p : null);
    W.streamer.lead = T > 0 ? LV.p : null;
    W.tiles?.update(dt, focus.x, focus.z, ahead);
    W.streamer.base ??= W.streamer.budgetMs;
    W.streamer.budgetMs = hold ? Math.max(12, W.streamer.base) : W.streamer.base*(1 + Math.min(1.5, spd/60));      // (the menus are up, or you're going fast: build faster)
    W.streamer.update(focus.x, focus.z, fwd, ahead);
    if (W.country) W.country.update(focus.x, focus.z);
    W.nearBoards.update(camera.position.x, camera.position.z, dt);
    W.trains?.update(dt, camera.position);
    propT -= dt;
    // (the view swung more than about 10 degrees since the lists were filled: fill them now)
    view.set(camera); if (view.swung > .015) { propT = 0; }
    if (propT <= 0) { view.swung = 0; updateProps(W, camera.position.x, camera.position.z); W.fly?.update?.(camera.position.x, camera.position.z); propT = 0.2; }
    const t1 = performance.now();
    // the map covers the screen, and while paused the last frame just sits there (blurred by CSS): no rendering at all
    if (compiled && game.state !== 'map' && !(game.state === 'pause' && !game.livePause && (game.pauseFrames = (game.pauseFrames || 0) + 1) > 2) && !(game.menuFreeze && game.state === 'shop' && (game.pauseFrames = (game.pauseFrames || 0) + 1) > 2)) post.render(dt);
    const t2 = performance.now();
    if (game.gfxTick) game.gfxTick(dt, t2 - t0);
    workMs += (t2 - t0 - workMs)*.1;
    perf.n++; perf.upd += t1 - t0; perf.rnd += t2 - t1; perf.worst = Math.max(perf.worst, t1 - t0);
    if (!perfBox.hidden) {
      const ft = dt * 1000;
      pf.t += dt; pf.n++; pf.worst = Math.max(pf.worst, ft); pf.cpu += t2 - t0; pf.upd = (pf.upd || 0) + t1 - t0; pf.rnd = (pf.rnd || 0) + t2 - t1; if (ft > 33) pf.hitch++;
      if (pf.t >= 0.5) {
        const i = renderer.info, st = W.streamer.stats;
        perfBox.textContent = `${(pf.n / pf.t).toFixed(0)} fps · worst ${pf.worst.toFixed(0)} ms · hitches ${pf.hitch}\n` +
          `${post.clock.text()}\ncpu game ${(pf.upd / pf.n).toFixed(1)} · draw calls ${(pf.rnd / pf.n).toFixed(1)} ms: ${laps.text(pf.n)}\n` +
          `cpu ${(pf.cpu / pf.n).toFixed(1)} ms/frame · ${quality.name} · ${GPU} · res ${renderer.getPixelRatio().toFixed(2)}x\n` +
          `${i.render.calls} draws · ${(i.render.triangles / 1e6).toFixed(2)}M tris · ${i.memory.geometries} geos · ${i.memory.textures} tex\n` +
          `stream: ${W.streamer.built.size} chunks · last ${st.ms.toFixed(0)} ms (sliced) · peak/frame ${st.worst.toFixed(1)} ms`;
        pf.t = 0; pf.n = 0; pf.worst = 0; pf.cpu = 0; pf.upd = 0; pf.rnd = 0; pf.hitch = 0;
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
  W.streamer.warm(cam.x, cam.z, warmR, (k, n) => { if (fill) fill.style.width = Math.round((0.82 + 0.1 * k / n) * 100) + '%'; });
  await painter.settle((k, n) => { if (fill) fill.style.width = Math.round((0.92 + 0.06 * k / n) * 100) + '%'; });
  updateProps(W, cam.x, cam.z);
  sky.update(hour, camera.position, 0);
  await progress('Compiling shaders', 0.99);
  await renderer.compileAsync(scene, camera);
  const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); post.setSize(window.innerWidth, window.innerHeight); };
  window.addEventListener('resize', onResize);
  onResize();
  await progress('Ready', 1);
  loaded();
  const dev = document.createElement('div');
  dev.className = 'dev';
  if (!TEST) document.getElementById('ui').appendChild(dev);
  let pending = 0;
  window.__nh = {
    setView: async (x, z, y, yawDeg, pitchDeg) => { Object.assign(cam, { x, z, y, yaw: yawDeg * Math.PI / 180, pitch: pitchDeg * Math.PI / 180 }); placeCamera(); if (W.tiles) await W.tiles.warm(x, z, 300); W.streamer.warm(x, z, warmR); await painter.settle(); updateProps(W, x, z); },
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
    // (the view swung more than about 10 degrees since the lists were filled: fill them now)
    view.set(camera); if (view.swung > .015) { propT = 0; }
    if (propT <= 0) { view.swung = 0; updateProps(W, cam.x, cam.z); propT = 0.25; }
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
