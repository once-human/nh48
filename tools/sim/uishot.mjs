import puppeteer from 'puppeteer-core';
const [, , out, what] = process.argv;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], protocolTimeout: 600000 });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 650 });
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 500 });
await page.evaluate((what) => { const g = window.__game; const [k, a] = what.split(':');
  if (k === 'shop') g.shops.show({ kind: a, name: 'Shree Krishna Misal House', mr: 'श्रीकृष्ण मिसळ', x: g.player.x, z: g.player.z });
  if (k === 'bag') g.bag.show(a);
  if (k === 'trial') { g.player.exit(g.traffic, true); g.trial.show({ kind: 'clothes', name: 'Saudaminee Handloom', x: g.player.x, z: g.player.z, tier: 'all' }, a); g.trial.pick(2); }
  if (k === 'menu') g.shops.show({ kind: a, name: 'Shree Krishna Misal House', mr: 'श्रीकृष्ण मिसळ', x: g.player.x, z: g.player.z, tier: 'local' }); if (k === 'pause') g.togglePause(true); if (k === 'club') g.club.enter({ name: 'High Spirits Social', x: 0, z: 0 }); }, what);
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: out });
await browser.close();
