// one load, many quick checks: rooms, police charges, menus, fares, guide
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], protocolTimeout: 90000 });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 650 });
const errs = []; page.on('console', m => { if (m.text().startsWith('step')) console.log(m.text()); }); page.on('pageerror', e => errs.push('ERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1&hour=20', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 150000, polling: 1000 }).catch(() => {});
const r = await page.evaluate(async () => { window.__o = {};
  const g = window.__game, P = g.player, o = {};
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const step = async (name, fn) => { console.log('step', name); try { o[name] = await fn(); window.__o[name] = o[name]; } catch (e) { o[name] = 'FAIL ' + e.message + ' ' + (e.stack || '').split('\n')[1]; } };
  P.exit(g.traffic, true); for (let i = 0; i < 3; i++) await frame();
  for (const [kind, name] of [['clothes', 'Westside'], ['optician', 'Lenskart'], ['shoes', 'Bata'], ['kirana', 'D-Mart'], ['food', 'The Bombay Bistro'], ['bank', 'HDFC Bank'], ['clinic', 'Ruby Hall Hospital']]) {
    await step(kind, async () => { const ok = g.interiors.enter({ kind, name, x: P.x, z: P.z, door: {} }); for (let i = 0; i < 3; i++) await frame(); const R = g.interiors.cur.R; const res = [ok, R.style, R.W + 'x' + R.D, (R.signs || []).length, R.peds.length]; g.interiors.exit(); for (let i = 0; i < 2; i++) await frame(); return res.join(' '); });
  }
  await step('menus', async () => { g.shops.show({ kind: 'kirana', name: 'Om Kirana', x: P.x, z: P.z }); const a = g.state; g.closeMenus(); g.bag.show('guide'); const secs = document.querySelectorAll('.gd-sec').length; g.closeMenus(); return [a, g.state, secs].join(' '); });
  await step('police', async () => { const pol = g.police; pol.raiseHeat(1, 'test', 'hurt'); pol.raiseHeat(1, 'test2', 'assault'); const top = pol.topCharge(); for (let i = 0; i < 30; i++) await frame(); if (pol.marshals[0]) pol.caught(pol.marshals[0]); const k = pol.stop && pol.stop.kind; const txt = document.querySelector('.stop') ? document.querySelector('.stop').textContent.slice(0, 160) : ''; if (pol.stop) pol.choose(0); for (let i = 0; i < 20; i++) await frame(); return [top, k, txt, pol.heat, [...pol.charges].join(',')].join(' | '); });
  await step('fare', () => [g.fastTravelCost(P.x + 20000, P.z), g.hour].join(' '));
  return o;
});
console.log(JSON.stringify(r, null, 1)); console.log(errs.slice(0, 8).join('\n'));
await browser.close();
