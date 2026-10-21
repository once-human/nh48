// screenshot the HUD at a retina scale to check text sharpness
import puppeteer from 'puppeteer-core';
const out = process.argv[2] || 'hud.png', dpr = +(process.argv[3] || 2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], protocolTimeout: 600000 });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 620, deviceScaleFactor: dpr });
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=med&frames=1', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 500 });
await page.evaluate(() => { const g = window.__game; g.hud.toast('Test toast', 'A subline of text', 'info', 30); g.hud.say('Kaka', 'Arre, kaay chaalu aahe?', 'What is going on?', 30); });
await new Promise(r => setTimeout(r, 3000));
await page.screenshot({ path: out });
await browser.close();
