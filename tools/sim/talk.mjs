import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,450'], protocolTimeout: 900000 });
const page = await browser.newPage();
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 600000, polling: 500 });
const r = await page.evaluate(() => {
  const g = window.__game, out = [];
  const ps = g.people.list.filter(p => p.persona).slice(0, 8);
  for (const p of ps) { g.people.lineT = 0; g.people.speakAs('chat', p); out.push([p.persona, p.female, document.getElementById('h-sub-who').textContent, document.getElementById('h-sub-line').textContent]); }
  g.police.say('stop_signal'); out.push(document.getElementById('h-sub-line').textContent);
  const per = {}; for (const p of g.people.list) if (p.persona) per[p.persona] = (per[p.persona] || 0) + 1;
  out.push(per);
  return out;
});
console.log(JSON.stringify(r, null, 0)); console.log(logs.join('\n'));
await browser.close();
