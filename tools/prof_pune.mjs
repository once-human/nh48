// Where the time goes while the streamed city loads and you move across it (?city=pune).
// usage: node tools/prof_pune.mjs [seconds]
import puppeteer from 'puppeteer-core';
const secs = +(process.argv[2] || 40);
const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
page.on('pageerror', e => console.log('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
page.on('console', m => { if (/tile|warn|error/i.test(m.text())) console.log('[console] ' + m.text().slice(0, 200)); });
await page.evaluateOnNewDocument(() => {
  window.__long = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
});
const t0 = Date.now();
await page.goto(`http://127.0.0.1:8848/test.html?test&city=pune&play=roam&q=low`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__game && window.__game.state === "play"', { timeout: 300000, polling: 300 });
console.log('boot to play', (Date.now() - t0) / 1000, 's');
const r = await page.evaluate(async (secs) => {
  const g = window.__game, W = window.__W, TM = W.tiles, T = {};
  const add = (k, v) => { T[k] = T[k] || [0, 0, 0]; T[k][0] += v; T[k][1]++; T[k][2] = Math.max(T[k][2], v); };
  // per integrate step
  const integ = TM.integrate.bind(TM);
  TM.integrate = function* (Tl) { const it = integ(Tl); let k = 0; while (true) { const a = performance.now(); const r = it.next(); add('step' + k++, performance.now() - a); if (r.done) return; yield; } };
  const wrap = (o, n, l) => { if (!o || !o[n]) return; const f = o[n].bind(o); o[n] = (...a) => { const s = performance.now(); const r = f(...a); add(l, performance.now() - s); return r; }; };
  wrap(TM, 'refresh', 'refresh'); const dj = TM.dropJob.bind(TM); TM.dropJob = function* (Tl) { const it = dj(Tl); let k = 0; while (true) { const a = performance.now(); const r = it.next(); add('drop' + k++, performance.now() - a); if (r.done) return; yield; } };
  wrap(W.cityMap, 'renderTile', 'map.renderTile');
  wrap(W.streamer, 'buildChunk', 'chunk.build'); wrap(W.streamer, 'update', 'streamer.update');
  wrap(g, 'frame', 'game.frame');
  window.__long.length = 0;
  // walk/drive east across tiles
  const P = g.player; const x0 = P.x, z0 = P.z;
  const steps = secs * 4;
  for (let i = 0; i < steps; i++) {
    const x = x0 + i * (6000 / steps);
    if (P.onFoot) { P.foot.x = x; P.foot.z = z0; } else { P.cur.x = x; P.cur.z = z0; }
    await new Promise(r => setTimeout(r, 250));
  }
  const out = {}; for (const [k, v] of Object.entries(T)) out[k] = `n${v[1]} tot${Math.round(v[0])} max${Math.round(v[2])}`;
  return { out, long: window.__long.slice().sort((a, b) => b - a).slice(0, 25), nlong: window.__long.length, live: TM.list.filter(t => t.state === 'live').length };
}, secs);
console.log(JSON.stringify(r, null, 1));
await browser.close();
