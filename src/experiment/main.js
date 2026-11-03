// /experiment: a painted street, from scratch, and a stress test of it. Nothing from the game is loaded: the street,
// the crowd, the traffic and the look are all made here. Walk it, then turn the people and the traffic up and
// watch what it costs.
import * as THREE from 'three';
import { U, paintMaterial, paintNoise, Sun, Post } from './paint.js';
import { buildStreet, FRONT, ROAD } from './street.js';
import { Crowd } from './people.js';
import { Traffic } from './traffic.js';
import { signAtlas } from './signs.js';

const Q = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const $ = (id) => document.getElementById(id);
const say = (m) => { const e = $('ld-msg'); if (e) e.textContent = m; };
const tick = () => new Promise((r) => requestAnimationFrame(() => r()));

async function fonts() {
  const F = [
    ['Archivo', 'archivo-latin-standard-normal.woff2', '100 900'],
    ['Yatra One', 'yatra-one-devanagari-400-normal.woff2'], ['Yatra One', 'yatra-one-latin-400-normal.woff2'],
    ['Rozha One', 'rozha-one-devanagari-400-normal.woff2'], ['Rozha One', 'rozha-one-latin-400-normal.woff2'],
    ['Mukta', 'mukta-devanagari-600-normal.woff2', '600'], ['Mukta', 'mukta-latin-600-normal.woff2', '600'],
    ['Kalam', 'kalam-devanagari-400-normal.woff2'], ['Kalam', 'kalam-latin-400-normal.woff2'],
  ];
  await Promise.all(F.map(async ([fam, file, weight]) => {
    try { const f = new FontFace(fam, `url(/assets/fonts/${file})`, weight ? { weight } : {}); await f.load(); document.fonts.add(f); } catch (e) { /* the boards fall back to the system's fonts */ }
  }));
}

async function main() {
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(1); renderer.autoClear = false; renderer.info.autoReset = false;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // the paint is already in screen colour
  const gl = renderer.getContext();
  const gpuName = () => { const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };
  const weak = coarse || /Intel|Mesa|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(gpuName());   // integrated or mobile: no MSAA to start with
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, .1, 900); camera.rotation.order = 'YXZ';

  say('Mixing the paints'); await fonts(); await tick();
  const matWorld = paintMaterial(), matSign = paintMaterial({ map: true }), matPeople = paintMaterial({ people: true }), matCars = paintMaterial({ vehicle: true });
  U.map.value = signAtlas(); U.tNoise.value = paintNoise();
  say('Laying the street'); await tick();
  const street = buildStreet(matWorld, matSign);
  for (const m of street.meshes) { m.userData.prepass = true; scene.add(m); }   // walls: depth first, so the paint runs once a pixel
  say('Filling it with people'); await tick();
  const crowd = new Crowd(6000, matPeople); U.crowdTex.value = crowd.tex;
  for (const m of crowd.meshes) { m.renderOrder = -1; scene.add(m); }   // people and traffic first: they hide the most
  const traffic = new Traffic(600, matCars);
  for (const k in traffic.meshes) { traffic.meshes[k].renderOrder = -1; scene.add(traffic.meshes[k]); }
  const casters = new Set([...street.meshes.slice(0, -1), crowd.near, ...Object.values(traffic.meshes)]);
  const sun = new Sun(coarse ? 1024 : weak ? 1536 : 2048), post = new Post(renderer); post.prepass = Q.get('prepass') !== '0';

  // ---------------------------------------------------------------- settings (the panel and the address both set them)
  const set = {
    people: +(Q.get('people') ?? (coarse ? 600 : 1500)), cars: +(Q.get('cars') ?? (coarse ? 100 : 220)), res: +(Q.get('res') ?? (coarse ? 70 : weak ? 85 : 100)),
    shadows: Q.get('shadows') !== '0', ink: Q.get('ink') !== '0', pencil: Q.get('pencil') !== '0', paint: Q.get('look') !== 'plain', msaa: Q.has('msaa') ? Q.get('msaa') !== '0' : !weak,
  };
  const P = crowd.player;
  P.x = +(Q.get('x') ?? -5.6); P.z = +(Q.get('z') ?? 40);
  let yaw = +(Q.get('yaw') ?? 0), pitch = +(Q.get('pitch') ?? -.08), dist = 3.4;
  crowd.setCount(set.people, P.z); traffic.setCount(set.cars, P.z);

  // ---------------------------------------------------------------- the panel
  const hud = $('hud');
  const bind = (id, key, fmt, apply) => {
    const el = $(id), out = el.parentElement.querySelector('output');
    if (el.type === 'checkbox') { el.checked = set[key]; el.onchange = () => { set[key] = el.checked; apply && apply(); }; }
    else { el.value = set[key]; out.textContent = fmt(set[key]); el.oninput = () => { set[key] = +el.value; out.textContent = fmt(set[key]); apply && apply(); }; }
  };
  bind('s-people', 'people', (v) => v.toLocaleString('en-IN'), () => crowd.setCount(set.people, P.z));
  bind('s-cars', 'cars', (v) => v, () => traffic.setCount(set.cars, P.z));
  bind('s-res', 'res', (v) => v + '%', resize);
  for (const k of ['shadows', 'ink', 'pencil', 'paint', 'msaa']) bind('t-' + k, k, null, resize);
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !e.target.closest('input')) hud.classList.toggle('hide'); });

  // ---------------------------------------------------------------- size
  let bw = 0, bh = 0;
  function resize() {
    const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, 2) * set.res / 100;
    bw = Math.max(2, Math.round(w * pr)); bh = Math.max(2, Math.round(h * pr));
    renderer.setSize(bw, bh, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
    post.targets(bw, bh, set.msaa ? 4 : 0);
    U.pScale.value = bh / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    U.dpr.value = post.U.dpr.value = Math.max(1, bh / 900);
    U.shadowOn.value = set.shadows ? 1 : 0; U.hatchOn.value = set.pencil ? 1 : 0; U.paintOn.value = set.paint ? 1 : 0;
    post.U.inkOn.value = post.U.paperOn.value = set.ink ? 1 : 0;
  }
  window.addEventListener('resize', resize); resize();

  // ---------------------------------------------------------------- walking
  const keys = new Set();
  window.addEventListener('keydown', (e) => { if (!e.target.closest('input')) keys.add(e.code); });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  const look = (dx, dy) => { yaw -= dx * .0028; pitch = Math.max(-1.1, Math.min(.5, pitch - dy * .0028)); };
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { if (canvas.requestPointerLock && !document.pointerLockElement) canvas.requestPointerLock(); drag = { x: e.clientX, y: e.clientY }; }
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (document.pointerLockElement === canvas) look(e.movementX, e.movementY);
    else if (drag && e.buttons) { look(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; }
  });
  window.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => { dist = Math.max(1.6, Math.min(9, dist * (1 + Math.sign(e.deltaY) * .1))); }, { passive: true });
  // touch: the left half is a stick, the right half looks
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, lk = { id: null, x: 0, y: 0 };
  canvas.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) { if (t.clientX < innerWidth / 2 && stick.id === null) Object.assign(stick, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 }); else if (lk.id === null) Object.assign(lk, { id: t.identifier, x: t.clientX, y: t.clientY }); } e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) { if (t.identifier === stick.id) { stick.x = Math.max(-1, Math.min(1, (t.clientX - stick.ox) / 50)); stick.y = Math.max(-1, Math.min(1, (t.clientY - stick.oy) / 50)); } else if (t.identifier === lk.id) { look((t.clientX - lk.x) * 1.4, (t.clientY - lk.y) * 1.4); lk.x = t.clientX; lk.y = t.clientY; } } e.preventDefault(); }, { passive: false });
  const tend = (e) => { for (const t of e.changedTouches) { if (t.identifier === stick.id) Object.assign(stick, { id: null, x: 0, y: 0 }); if (t.identifier === lk.id) lk.id = null; } };
  canvas.addEventListener('touchend', tend); canvas.addEventListener('touchcancel', tend);

  const demo = Q.has('demo'), prof = Q.has('prof'); window.__prof = {};
  function walk(dt) {
    let f = 0, r = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) r += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) r -= 1;
    f -= stick.y; r += stick.x; if (demo) f = .6;
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(f, r) > 1.3;
    const m = Math.min(1, Math.hypot(f, r)), want = m > .05 ? (run ? 4.6 : 1.5) * m : 0;
    P.spd += (want - P.spd) * Math.min(1, dt * 6);
    if (m > .05) {
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const mx = (fx * f + rx * r) / m, mz = (fz * f + rz * r) / m;
      let d = Math.atan2(mx, mz) - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * Math.min(1, dt * 10);
    }
    P.x += Math.sin(P.yaw) * P.spd * dt; P.z += Math.cos(P.yaw) * P.spd * dt;
    P.x = Math.max(-(FRONT - .35), Math.min(FRONT - .35, P.x)); P.z = Math.max(-380, Math.min(380, P.z));
    // the camera, over your shoulder
    const py = Math.abs(P.x) > ROAD ? .15 : 0, tx = P.x, ty = py + 1.55, tz = P.z;
    camera.rotation.set(pitch, yaw, 0);
    const bx = Math.sin(yaw) * Math.cos(pitch), by = -Math.sin(pitch), bz = Math.cos(yaw) * Math.cos(pitch);
    camera.position.set(tx + bx * dist + Math.cos(yaw) * .35, Math.max(.4, ty + by * dist + .15), tz + bz * dist - Math.sin(yaw) * .35);
    camera.position.x = Math.max(-(FRONT - .25), Math.min(FRONT - .25, camera.position.x));
    camera.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- the GPU's own clock, where the browser has it
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const queries = []; let gpuMs = 0, gpuHas = false;
  function gpuBegin() { if (!tq || queries.length > 3) return null; const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); return q; }
  function gpuEnd(q) { if (!q) return; gl.endQuery(tq.TIME_ELAPSED_EXT); queries.push(q); }
  // ?prof: each pass on its own clock instead (window.__prof)
  const pq = [];
  const pBegin = (lbl) => { if (!prof || !tq) return; const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); pq.push([lbl, q]); };
  const pEnd = () => { if (prof && tq) gl.endQuery(tq.TIME_ELAPSED_EXT); };
  function gpuPoll() {
    while (pq.length && gl.getQueryParameter(pq[0][1], gl.QUERY_RESULT_AVAILABLE)) {
      const [l, q] = pq.shift(), P2 = window.__prof; if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; P2[l] = P2[l] === undefined ? ms : P2[l] * .9 + ms * .1; }
      gl.deleteQuery(q);
    }
    while (queries.length && gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = queries.shift(); if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; gpuMs = gpuHas ? gpuMs * .9 + ms * .1 : ms; gpuHas = true; }
      gl.deleteQuery(q);
    }
  }

  // ---------------------------------------------------------------- the frame
  const obstacles = [];
  let last = performance.now(), t = 0, fps = 60, cpu = 0, frameMs = 16.7, shown = 0;
  const stat = { fps: $('st-fps'), ms: $('st-ms'), gpu: $('st-gpu'), cpu: $('st-cpu'), draws: $('st-draws'), tris: $('st-tris'), ppl: $('st-ppl'), veh: $('st-veh'), res: $('st-res') };
  const frames = [];
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); frameMs = frameMs * .92 + (now - last) * .08; last = now; t += dt;
    const c0 = performance.now();
    gpuPoll(); const q = prof ? null : gpuBegin();
    renderer.info.reset();
    U.time.value = t;
    walk(dt);
    crowd.update(dt, t, camera, obstacles);
    obstacles.push(P.x, P.z);
    traffic.update(dt, t, P.z, obstacles);
    if (set.shadows) { pBegin('shadow'); sun.update(camera); sun.render(renderer, scene, casters); pEnd(); }
    pBegin('scene'); post.render(scene, camera, prof ? () => { pEnd(); pBegin('post'); } : null); pEnd();
    gpuEnd(q);
    cpu = cpu * .9 + (performance.now() - c0) * .1;
    if (frames.lastT) frames.push([now, now - frames.lastT]); frames.lastT = now; if (frames.length > 2000) frames.splice(0, 1000);
    if (now - shown > 250) {
      shown = now; fps = 1000 / frameMs;
      const I = renderer.info.render;
      stat.fps.textContent = fps.toFixed(0); stat.ms.textContent = frameMs.toFixed(1);
      stat.gpu.textContent = gpuHas ? gpuMs.toFixed(1) : '—'; stat.cpu.textContent = cpu.toFixed(1);
      stat.draws.textContent = I.calls; stat.tris.textContent = (I.triangles / 1e6).toFixed(2) + 'M';
      stat.ppl.textContent = `${crowd.n.toLocaleString('en-IN')} · ${crowd.shown[0]} near`; stat.veh.textContent = traffic.n;
      stat.res.textContent = `${bw}×${bh}`;
      $('fpsbar').style.width = Math.min(100, fps / 60 * 100) + '%';
      $('fpsbar').className = fps >= 50 ? 'ok' : fps >= 30 ? 'meh' : 'bad';
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- the stress test: step the crowd and traffic up, time each step
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function bench() {
    const btn = $('bench'), out = $('bench-out'); btn.disabled = true; out.innerHTML = '';
    const steps = [[250, 50], [500, 100], [1000, 200], [2000, 300], [3000, 400], [4500, 500], [6000, 600]];
    const rows = [];
    for (const [p, c] of steps) {
      set.people = p; set.cars = c; $('s-people').value = p; $('s-cars').value = c;
      $('s-people').dispatchEvent(new Event('input')); $('s-cars').dispatchEvent(new Event('input'));
      btn.textContent = `testing ${p.toLocaleString('en-IN')} people…`;
      await wait(1200); const t0 = performance.now(); gpuMs = 0; gpuHas = false; await wait(2500);
      const f = frames.filter((x) => x[0] > t0).map((x) => x[1]).sort((a, b) => a - b);
      const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length), p95 = f[Math.floor(f.length * .95)] || avg;
      const row = { people: p, vehicles: c, fps: +(1000 / avg).toFixed(1), ms: +avg.toFixed(1), p95: +p95.toFixed(1), gpu: gpuHas ? +gpuMs.toFixed(1) : null, draws: renderer.info.render.calls, tris: renderer.info.render.triangles };
      rows.push(row);
      out.insertAdjacentHTML('beforeend', `<tr><td>${p.toLocaleString('en-IN')}</td><td>${c}</td><td class="${row.fps >= 50 ? 'ok' : row.fps >= 30 ? 'meh' : 'bad'}">${row.fps}</td><td>${row.p95}</td><td>${row.gpu ?? '—'}</td><td>${(row.tris / 1e6).toFixed(1)}M</td></tr>`);
    }
    window.__bench = { gpu: gpuName(), size: [bw, bh], rows };
    console.log('bench', JSON.stringify(window.__bench));
    btn.disabled = false; btn.textContent = 'run the stress test again';
  }
  $('bench').onclick = bench;
  $('st-gpuname').textContent = gpuName().replace(/ANGLE \(|\)$/g, '').split(',').slice(0, 2).join(',');

  // build every program now, so the first frame doesn't stall
  say('Painting'); await tick();
  walk(0); crowd.update(0, 0, camera, obstacles); traffic.update(0, 0, P.z, obstacles);
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* compiles on first sight */ }
  $('loading').classList.add('done');
  window.__ready = true;
  requestAnimationFrame((n) => { last = n; frame(n); });
  if (Q.has('bench')) setTimeout(bench, 1500);
}

main().catch((e) => { console.error(e); say('Could not start: ' + (e && e.message || e)); });
