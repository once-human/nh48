// click Start like a player would (fresh profile) and report what happens
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://127.0.0.1:8848/test.html';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,720'], protocolTimeout: 900000 });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
const logs = []; page.on('pageerror', e => logs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').slice(0, 600))); page.on('response', r => { if (r.status() === 404) logs.push('404 ' + r.url()); }); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game && window.__game.state === 'title' && document.getElementById('t-roam'), { timeout: 600000, polling: 1000 });
await new Promise(r => setTimeout(r, 3000));
await page.screenshot({ path: process.argv[3] + '_0.png' });
await page.click('#t-roam');
await new Promise(r => setTimeout(r, 6000));
const st = await page.evaluate(() => ({ state: window.__game && window.__game.state, picker: !!document.querySelector('.picker') && !document.querySelector('.picker').hidden }));
await page.screenshot({ path: process.argv[3] + '_1.png' });
console.log(JSON.stringify(st));
if (st.picker) {
  await page.click('#pk-ok');
  await new Promise(r => setTimeout(r, 5000));
  const st2 = await page.evaluate(() => ({ state: window.__game.state, char: localStorage.getItem('nh48_char'), inAuto: window.__game.player.inAuto, shift: window.__game.rides.enabled }));
  console.log('after Play as:', JSON.stringify(st2));
  await new Promise(r => setTimeout(r, 15000));
  console.log('later:', JSON.stringify(await page.evaluate(() => ({ t: window.__game.t, shift: window.__game.rides.enabled, mode: document.getElementById('h-mode').textContent }))));
  await page.screenshot({ path: process.argv[3] + '_2.png' });
}
console.log(logs.join('\n'));
await browser.close();
