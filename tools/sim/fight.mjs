// quick fight check: get out, punch the nearest person a few times, let them hit back
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,450'], protocolTimeout: 600000 });
const page = await browser.newPage(); await page.setViewport({ width: 800, height: 450 });
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) logs.push('404 ' + r.url()); });
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 500 });
const r = await page.evaluate(async () => {
  const g = window.__game, P = g.player, out = {};
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  P.exit(g.traffic, true);
  for (let i = 0; i < 3; i++) await frame();
  const per = g.people.list.filter(p => !p.pax && !p.cop && !p.hidden && !p.kid).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
  per.persona = 'dada';
  P.teleportFoot(per.x - 1.0, per.z, 0, g.traffic);
  const key = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
  const log = [];
  for (let i = 0; i < 40; i++) {
    if (i % 4 === 0) key('KeyX');
    await frame();
    log.push([P.act && P.act.name, per.mode, Math.round(per.hp ?? -1), Math.round(P.hp)].join(','));
  }
  out.log = log.filter((v, i, a) => v !== a[i - 1]);
  out.persona = per.persona; out.active = g.brawl.active;
  return out;
});
console.log(JSON.stringify(r)); console.log(logs.slice(0, 10).join('\n'));
await browser.close();
