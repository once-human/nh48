// walk into a shop of a given kind and screenshot the room
import puppeteer from 'puppeteer-core';
const [, , out, kind, hour] = process.argv;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], protocolTimeout: 600000 });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 650 });
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.goto(`http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1&hour=${hour || 13}`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 500 });
const r = await page.evaluate(async (kind) => {
  const g = window.__game, P = g.player;
  P.exit(g.traffic, true);
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  for (let i = 0; i < 3; i++) await frame();
  const ok = g.interiors.enter({ kind, name: 'Shree Krishna ' + kind, mr: '', x: P.x, z: P.z, door: {} });
  P.foot.x += 0; P.foot.z += 0.6;
  for (let i = 0; i < 12; i++) await frame();
  const sp = g.interiors.cur.R.spots.map(s => s.label);
  const c = g.camera.position, R = g.interiors.cur.R;
  return { ok, spots: sp, peds: R.peds.length, near: g.shops.label(), cam: [c.x - R.O.x, c.y, c.z - R.O.z].map(v => +v.toFixed(2)), p: [P.x - R.O.x, P.y, P.z - R.O.z].map(v => +v.toFixed(2)), vis: R.group.visible, far: g.camera.far, hidden: !P.human.holder.visible, mode: P.mode, state: g.state };
}, kind);
await new Promise(r => setTimeout(r, 2500));
await page.screenshot({ path: out });
console.log(JSON.stringify(r)); console.log(logs.slice(0, 6).join('\n'));
await browser.close();
