// CPU profile of one simulated game frame by subsystem (no rendering inside the measured loop).
// usage: node tools/prof.mjs "<query>" [iterations]
import puppeteer from 'puppeteer-core';
const query = process.argv[2] || 'q=low&play=roam';
const iters = +(process.argv[3] || 200);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto(`http://127.0.0.1:${process.env.PORT || 8848}/test.html?test&${query}`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__game && window.__perf && window.__game.state === "play"', { timeout: 300000, polling: 300 });
const r = await page.evaluate((iters) => {
  const g = window.__game, T = {};
  const wrap = (obj, name, label) => {
    if (!obj || typeof obj[name] !== 'function') return;
    const f = obj[name].bind(obj);
    obj[name] = (...a) => { const t0 = performance.now(); const r = f(...a); T[label] = (T[label] || 0) + performance.now() - t0; return r; };
  };
  wrap(g.traffic, 'update', 'traffic');
  wrap(g.people, 'update', 'people');
  wrap(g.people, 'render', 'people.render');
  wrap(g.people, 'populateStalls', 'p.stalls'); wrap(g.people, 'spawnOne', 'p.spawn'); wrap(g.people, 'step', 'p.step'); wrap(g.people, 'stepAnimal', 'p.animal');
  wrap(g.traffic, 'spawn', 't.spawn');
  wrap(g.police, 'update', 'police');
  wrap(g.rides, 'update', 'rides');
  wrap(g.rig, 'update', 'camera');
  wrap(g.player, 'update', 'player');
  wrap(g.crowd, 'update', 'crowd');
  wrap(g.fauna, 'update', 'fauna');
  wrap(g.hud, 'update', 'hud');
  wrap(g.audio, 'updateEngine', 'audio');
  wrap(g, 'afterRender', 'afterRender');
  let tot = 0, worst = 0, wi = -1; const all = [];
  const snap = () => Object.assign({}, T);
  let worstParts = null; const slow = {}; let slowN = 0;
  for (let k = 0; k < iters; k++) {
    const before = snap();
    const t0 = performance.now();
    g.fixed(1 / 60); g.fixed(1 / 60); g.frame(1 / 30);
    const d = performance.now() - t0; tot += d; all.push(d);
    if (d > worst) { worst = d; wi = k; worstParts = {}; for (const [kk, v] of Object.entries(T)) { const dv = v - (before[kk] || 0); if (dv > 1) worstParts[kk] = +dv.toFixed(1); } }
    if (d > 8 && k > 10) { for (const [kk, v] of Object.entries(T)) { const dv = v - (before[kk] || 0); if (dv > 2) slow[kk] = (slow[kk] || 0) + 1; } slowN++; }
  }
  all.sort((a, b) => a - b);
  const per = {}; for (const [k, v] of Object.entries(T)) per[k] = +(v / iters).toFixed(2);
  return { avgFrame: +(tot / iters).toFixed(2), p50: +all[iters >> 1].toFixed(1), p95: +all[Math.floor(iters * 0.95)].toFixed(1), worst: +worst.toFixed(1), worstAt: wi, worstParts, slowN, slow, per, traffic: g.traffic.list.length, peds: g.people.list.length };
}, iters);
console.log(JSON.stringify(r));
await browser.close();
