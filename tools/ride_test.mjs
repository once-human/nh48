// Logic test: start a shift, teleport next to a waving passenger, check boarding,
// teleport to the destination, check drop-off + payment. Runs without rendering.
import puppeteer from 'puppeteer-core';
const url = process.argv[2];
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], protocolTimeout: 600000 });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 500 });
const logs = [];
page.on('console', m => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + e.stack));
await page.goto(url, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__game && window.__game.state === "play"', { timeout: 300000, polling: 300 });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ev = (f) => page.evaluate(f);
await wait(3000);
console.log('offers', await ev(() => __game.rides.offers.map(o => ({ dest: o.dest.name, d: Math.round(Math.hypot(o.p.x - __game.player.x, o.p.z - __game.player.z)) }))));
// teleport next to the first offer
await ev(() => { const o = __game.rides.offers[0]; const P = __game.player; P.reset(o.p.x + 3, o.p.z + 1, P.th); });
await wait(2500);
console.log('after stop', await ev(() => ({ cur: __game.rides.current && { state: __game.rides.current.state, dest: __game.rides.current.dest.name, limit: Math.round(__game.rides.current.limit), route: __game.rides.routePts && __game.rides.routePts.length } })));
// drive a bit (simulate distance) then teleport to destination
await ev(() => { const c = __game.rides.current; c.dist = 2300; });
await ev(() => { const c = __game.rides.current; const P = __game.player; P.reset(c.dest.x, c.dest.z, P.th); });
await wait(2500);
console.log('after drop', await ev(() => ({ cur: !!__game.rides.current, stats: __game.stats })));
console.log('dialog', await ev(() => document.getElementById('h-dl-line').textContent + ' / ' + document.getElementById('h-dl-tr').textContent));
console.log('toasts', await ev(() => [...document.querySelectorAll('.toast')].map(t => t.textContent)));
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
