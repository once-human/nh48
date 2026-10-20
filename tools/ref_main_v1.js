// Meter Down — a Pune auto-rickshaw game. Entry point: renderer, loading, world, main loop.
import * as THREE from 'three';
import { loadMapJSON } from './world/mapdata.js';
import { buildWorld, updateWorldMaterials } from './world/world.js';
import { updateProps } from './world/props.js';
import { Sky } from './gfx/sky.js';
import { U } from './gfx/materials.js';
import { isTouch } from './core/util.js';
import { vehicleMaterials } from './vehicles/vehmat.js';
import { PlayerAuto } from './vehicles/player.js';
import { Traffic } from './traffic/traffic.js';
import { CameraRig } from './game/camera.js';
import { Input } from './game/input.js';
import { Game } from './game/game.js';

export const QUALITY = {
  low: { name: 'low', tex: 256, signScale: 0.5, shadows: false, shadowSize: 0, pixelRatio: 0.85, aa: false, viewDist: 380, detailDist: 170,
    treeNear: 260, treeNearRange: 95, treeCardRange: 0, treeFar: 1400, treeFarRange: 430, leafCards: false, propRange: 110, traffic: 70, peds: 50 },
  med: { name: 'med', tex: 512, signScale: 0.5, shadows: true, shadowSize: 1024, pixelRatio: 1.0, aa: true, viewDist: 540, detailDist: 250,
    treeNear: 450, treeNearRange: 140, treeCardRange: 95, treeFar: 2200, treeFarRange: 580, leafCards: true, propRange: 170, traffic: 140, peds: 90 },
  high: { name: 'high', tex: 512, signScale: 1, shadows: true, shadowSize: 2048, pixelRatio: 1.5, aa: true, viewDist: 720, detailDist: 340,
    treeNear: 800, treeNearRange: 185, treeCardRange: 130, treeFar: 3200, treeFarRange: 760, leafCards: true, propRange: 230, traffic: 170, peds: 140 },
};

const params = new URLSearchParams(location.search);
export const TEST = params.has('test');
const NORENDER = params.has('norender');

// Rough GPU class from the (unmasked) renderer string. Integrated laptop GPUs get Medium without
// MSAA; very old / software renderers start on Low. The in-game frame-rate watcher adjusts after that.
function gpuClass() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/SwiftShader|llvmpipe|softpipe|Software|Microsoft Basic/i.test(r)) return 'soft';
    if (/HD Graphics(?! [6-9]\d\d)|Mali-[GT]?\d{1,2}\b|Adreno \(TM\) [2-5]\d\d|PowerVR|Vivante/i.test(r) && !/UHD|Iris|Arc/i.test(r)) return 'weak';
    if (/Intel|UHD|Iris|Radeon\(TM\) Graphics|Radeon Graphics|Vega \d+ Graphics|Mali|Adreno/i.test(r) && !/Arc/i.test(r)) return 'integrated';
    return 'discrete';
  } catch (e) { return 'unknown'; }
}
const GPU = gpuClass();
function pickQuality() {
  const q = params.get('q');
  if (q && QUALITY[q]) return QUALITY[q];
  try { const s = localStorage.getItem('md_quality'); if (s && QUALITY[s]) return QUALITY[s]; } catch (e) { /* storage blocked */ }
  if (isTouch || GPU === 'soft' || GPU === 'weak') return QUALITY.low;
  if (GPU === 'integrated') return { ...QUALITY.med, aa: false };
  return QUALITY.med;
}

async function main() {
  const quality = pickQuality();
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.aa, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.3, 2600);
  const fill = document.getElementById('ld-fill'), msg = document.getElementById('ld-msg');
  const progress = async (text, f) => {
    if (msg) msg.textContent = text;
    if (fill) fill.style.width = Math.round(f * 100) + '%';
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  };

  await progress('Unfolding the map of Pune', 0.04);
  const M = await loadMapJSON();
  const W = await buildWorld(M, renderer, scene, quality, progress);
  const sky = new Sky(renderer, scene);
  sky.setShadows(quality.shadows, quality.shadowSize);
  W.sky = sky;
  const vmats = vehicleMaterials();
  const player = new PlayerAuto(W, scene, vmats);
  const traffic = new Traffic(W, scene, vmats, quality);
  traffic.player = player;
  const rig = new CameraRig(camera, W);
  rig.traffic = traffic;
  const input = new Input(canvas);
  const game = new Game({ W, scene, camera, renderer, sky, player, traffic, rig, input, quality, params, QUALITY, vmats });
  await game.init(progress);

  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  await progress('Ready', 1);
  document.getElementById('loading').classList.add('done');

  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 12);
  const inView = (x, z) => { sphere.center.set(x, 4, z); return frustum.intersectsSphere(sphere); };
  game.inView = inView;
  let last = performance.now(), acc = 0, propTimer = 0, frames = 0;
  const STEP = 1 / 60;
  const perf = window.__perf = { n: 0, upd: 0, rnd: 0, worst: 0 };
  function frame(now) {
    const t0 = performance.now();
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (TEST) dt = 1 / 30;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) { game.fixed(STEP); acc -= STEP; steps++; }
    if (steps >= 6) acc = 0;
    game.frame(dt);
    U.uTime.value += dt;
    sky.update(game.hour, game.focus(), dt);
    updateWorldMaterials(W);
    camera.updateMatrixWorld();
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pv);
    W.chunks.update(camera.position, quality.viewDist * game.viewScale, quality.detailDist * game.viewScale);
    propTimer -= dt;
    if (propTimer <= 0) { updateProps(W, camera.position.x, camera.position.z, inView); propTimer = 0.2; }
    const t1 = performance.now();
    if (!NORENDER) renderer.render(scene, camera);
    const t2 = performance.now();
    perf.n++; perf.upd += t1 - t0; perf.rnd += t2 - t1; perf.worst = Math.max(perf.worst, t1 - t0);
    game.afterRender(dt, now);
    frames++;
    if (TEST && game.testDone(frames)) {
      window.__stats = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures,
        traffic: traffic.list.length, player: { x: +player.x.toFixed(1), z: +player.z.toFixed(1), v: +player.v.toFixed(2), th: +player.th.toFixed(2) }, ...game.testInfo() };
      window.__shotReady = true;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__W = W; window.__cam = camera; window.__game = game;
  // debug: triangle budget by material in the current view
  window.__tris = () => {
    const out = {};
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    scene.traverseVisible((o) => {
      if (!o.isMesh && !o.isLineSegments) return;
      const g = o.geometry; if (!g) return;
      const tri = (g.index ? g.index.count : g.attributes.position.count) / 3;
      let n = 1;
      if (o.isInstancedMesh) n = o.count;
      else { if (!g.boundingSphere) g.computeBoundingSphere(); const s = g.boundingSphere.clone().applyMatrix4(o.matrixWorld); if (!fr.intersectsSphere(s)) return; }
      const k = (o.material.customProgramCacheKey && o.material.customProgramCacheKey() !== '' ? o.material.customProgramCacheKey() : o.material.type) + (o.isInstancedMesh ? ' [inst]' : '');
      out[k] = out[k] || { tris: 0, draws: 0 };
      out[k].tris += Math.round(tri * n); out[k].draws++;
    });
    return out;
  };
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  const msg = document.getElementById('ld-msg');
  if (msg) { msg.className = 'ld-err'; msg.textContent = 'Could not start: ' + (e && e.message ? e.message : e); }
  window.__shotReady = true;
});
