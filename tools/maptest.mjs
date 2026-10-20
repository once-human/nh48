// Map screen test: open the game, open the map at a view, sample tile progress, screenshot.
// usage: node tools/maptest.mjs <out.png> <x> <z> <ppm> [dpr] [waitMs]
import puppeteer from 'puppeteer-core';
const [out, x, z, ppm, dpr = '1', wait = '15000'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: +dpr });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
await page.goto(`http://127.0.0.1:${process.env.PORT || 8848}/test.html?test&q=low&play=roam`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__game && window.__game.state === "play"', { timeout: 600000, polling: 500 });
const r = await page.evaluate(async (x, z, ppm, wait) => {
  const g = window.__game, ms = g.hud.mapScreen;
  g.toggleMap(true);
  ms.view = { x, z, ppm }; ms.target = null;
  const samples = [];
  const t0 = performance.now();
  while (performance.now() - t0 < wait) {
    await new Promise(r => setTimeout(r, 1000));
    samples.push([g.city.cache.size, g.city.queue.length, g.city.stats ? { ...g.city.stats } : null]);
  }
  return { samples, err: window.__mapErr || null };
}, +x, +z, +ppm, +wait);
await page.screenshot({ path: out });
console.log(JSON.stringify(r));
console.log(logs.filter(l => !/GPU stall|GL Driver|parallel_shader|404/.test(l)).slice(0, 12).join('\n'));
await browser.close();
