// Streaming hitch test: drives a virtual camera along a straight line at a given speed (m/s),
// calling the chunk streamer and the tree/grass/prop updates exactly as the game does each frame,
// and reports how long that work took per frame (no rendering, so this is pure CPU cost).
// usage: node tools/hitch.mjs <x> <z> <dirDeg> <speed> <seconds> [q]
import puppeteer from 'puppeteer-core';
const [x0, z0, dir, speed, secs, q = 'med'] = process.argv.slice(2).map((v, i) => i < 5 ? +v : v);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto(`http://127.0.0.1:${process.env.PORT || 8848}/test.html?test&fly&q=${q}&at=${x0},${z0},3,0,0`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 600000, polling: 500 });
const r = await page.evaluate(async ({ x0, z0, dir, speed, secs }) => {
  const W = window.__W, S = W.streamer;
  const a = dir * Math.PI / 180, dx = Math.cos(a), dz = Math.sin(a);
  const frames = Math.round(secs * 60), out = [];
  let x = x0, z = z0, propT = 0, treeT = 0, grassT = 0, instT = 0;
  const props = [], stream = [];
  S.stats.worst = 0;
  const built0 = S.stats.built;
  for (let f = 0; f < frames; f++) {
    x += dx * speed / 60; z += dz * speed / 60;
    const t0 = performance.now();
    S.update(x, z, { x: dx, z: dz });
    const t1 = performance.now();
    propT -= 1 / 60;
    if (propT <= 0) {
      const a = performance.now(); W.trees.update(x, z); const b = performance.now(); W.grass?.update(x, z); const c = performance.now();
      for (const s of W.instSets) s.update(x, z);
      const d = performance.now();
      props.push(d - a); treeT = Math.max(treeT, b - a); grassT = Math.max(grassT, c - b); instT = Math.max(instT, d - c);
      propT = 0.2;
    }
    out.push(performance.now() - t0); stream.push(t1 - t0);
  }
  out.sort((p, q) => p - q);
  const pct = (p) => +out[Math.min(out.length - 1, Math.floor(out.length * p))].toFixed(2);
  return { frames, built: S.stats.built - built0, chunkTimes: (S.times || []).slice(-12), p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: +out[out.length - 1].toFixed(1),
    over8: out.filter(v => v > 8).length, over16: out.filter(v => v > 16).length,
    streamMax: +Math.max(...stream).toFixed(1), maxSlice: +(S.stats.maxSlice || 0).toFixed(1), maxSliceAt: S.stats.maxSliceAt,
    propsMax: +Math.max(...props).toFixed(1), treeMax: +treeT.toFixed(1), grassMax: +grassT.toFixed(1), instMax: +instT.toFixed(1) };
}, { x0, z0, dir, speed, secs });
console.log(JSON.stringify(r));
await browser.close();
