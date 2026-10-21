import puppeteer from 'puppeteer-core';
const [x, z, th, secs = '30', out = 'fly.png', steerK = '0'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=960,540'], protocolTimeout: 900000 });
const page = await browser.newPage(); await page.setViewport({ width: 960, height: 540 });
const logs = []; page.on('console', m => { const t = m.text(); if (/error|fly|Error/i.test(t)) logs.push(t); }); page.on('pageerror', e => logs.push('ERR ' + e.message));
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&drive=0.01&simx=12', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 600000, polling: 500 });
const err = await page.evaluate('window.__error'); if (err) { console.log('ERROR', err); process.exit(1); }
const r = await page.evaluate(async (x, z, th, secs, steerK) => {
  const g = window.__game, P = g.player, F = g.W.fly;
  P.reset(x, z, th); g.W.streamer.warm && g.W.streamer.warm(x, z, 200);
  g.test.drive = 1e9; g.test.brakeAfter = 1e9; g.test.steer = 0;
  const samples = [];
  const t0 = performance.now();
  while (performance.now() - t0 < secs * 1000) {
    await new Promise(r => setTimeout(r, 400));
    // steer along the deck when on it
    if (P.cur.deck >= 0 && +steerK) { const q = F.probe(P.x, P.z, P.cur.deck); const s = q.s; const dir = Math.atan2(s.bz - s.az, s.bx - s.ax); let e = dir - P.th; e = Math.atan2(Math.sin(e), Math.cos(e)); g.test.steer = Math.max(-1, Math.min(1, e * 2.5 - q.lat * 0.2)); }
    samples.push([g.t.toFixed(0), P.x.toFixed(1), P.z.toFixed(1), (P.cur.y || 0).toFixed(2), P.cur.deck, P.v.toFixed(1)].join(' '));
  }
  return samples;
}, +x, +z, +th, +secs, steerK);
console.log(r.join('\n')); console.log(logs.slice(0, 10).join('\n'));
await page.screenshot({ path: out });
await browser.close();
