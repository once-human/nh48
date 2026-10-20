// Soak test: run the simulation for a while without rendering (player cruising), report CPU ms per
// frame for the update work, errors, and traffic health (stuck vehicles, overlaps with parked cars).
import puppeteer from 'puppeteer-core';
const url = process.argv[2];
const seconds = +(process.argv[3] || 60);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 500 });
const logs = [];
page.on('console', m => { if (m.type() !== 'log') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + e.stack));
await page.goto(url, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__game && window.__game.state === "play"', { timeout: 300000, polling: 300 });
await page.evaluate(() => { window.__perf.n = 0; window.__perf.upd = 0; window.__perf.worst = 0; });
const t0 = Date.now();
const samples = [];
while (Date.now() - t0 < seconds * 1000) {
  await new Promise(r => setTimeout(r, 5000));
  samples.push(await page.evaluate(() => {
    const g = __game, T = g.traffic;
    let stuck = 0, inParked = 0;
    for (const v of T.list) {
      if (v.stuck > 3) stuck++;
      if (!v.T.two) for (const s of T.staticsNear || []) { const dx = v.x - s.x, dz = v.z - s.z; if (Math.abs(dx * s.hx + dz * s.hz) < s.L / 2 && Math.abs(-dx * s.hz + dz * s.hx) < s.W / 2) inParked++; }
    }
    const P = __perf;
    return { t: Math.round(g.t), n: T.list.length, peds: g.people.list.length, stuck, inParked, ms: +(P.upd / Math.max(1, P.n)).toFixed(2), worst: +P.worst.toFixed(1), frames: P.n,
      player: [Math.round(g.player.x), Math.round(g.player.z), +g.player.v.toFixed(1)] };
  }));
}
console.log(samples.map(s => JSON.stringify(s)).join('\n'));
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
