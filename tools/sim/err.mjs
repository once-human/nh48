import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('ERR', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 1000 }).catch(() => {});
console.log(await page.evaluate(() => { const g = window.__game; let r = { ready: window.__shotReady, err: window.__error && String(window.__error) }; try { g.player.exit(g.traffic, true); const P = g.player; const ok = g.interiors.enter({ kind: 'bar', name: 'Test club', x: P.x, z: P.z, door: {} }); const ok2 = g.interiors.enter({ kind: 'bar', name: 'again', x: P.x, z: P.z, door: {} }); g.interiors.exit(); r.enter = ok; r.second = ok2; r.after = [Math.round(P.x), Math.round(P.z)]; r.inside = g.interiors.inside; } catch (e) { r.e = e.message; } return r; }));
await browser.close();
