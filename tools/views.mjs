// Multi-view screenshots in one browser session.
// usage: node tools/views.mjs <outDir> <query> "name:x,z,y,yaw,pitch[,hour]" ...
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [outDir, query, ...views] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl',
    '--disable-dev-shm-usage', `--window-size=${W},${H}`, ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`] : [])],
  protocolTimeout: 900000,
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => { const t = m.text(); if (!/GPU stall|GL Driver/.test(t)) logs.push(`[${m.type()}] ${t.slice(0, 2000)}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${process.env.PORT || 8848}/test.html?test&${query}`, { waitUntil: 'load', timeout: 300000 });
try { await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 600000, polling: 500 }); } catch (e) { logs.push('[harness] timeout'); }
const err = await page.evaluate('window.__error');
if (err) logs.push('[error] ' + err);
logs.push(`[harness] loaded in ${(Date.now() - t0) / 1000}s`);
for (const v of views) {
  const [name, spec] = v.split(':');
  const a = spec.split(',').map(Number);
  await page.evaluate(`(() => { __nh.setView(${a[0]}, ${a[1]}, ${a[2]}, ${a[3]}, ${a[4]}); ${a.length > 5 ? `__nh.setHour(${a[5]});` : ''} })()`);
  await page.evaluate('new Promise(r => { let n = 0; const f = () => (++n > 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })');
  await page.evaluate("document.getElementById('loading') && (document.getElementById('loading').hidden = true)");
  const st = await page.evaluate('__nh.stats()');
  await page.screenshot({ path: `${outDir}/${name}.png` });
  logs.push(`[view] ${name} ${JSON.stringify(st)}`);
}
console.log(logs.join('\n'));
await browser.close();
