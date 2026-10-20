// Evaluate an expression returning a data URL (or {name: dataURL}) and save PNG(s).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [url, expr, outPrefix] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], protocolTimeout: 600000 });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true', { timeout: 300000, polling: 300 });
const r = await page.evaluate(expr);
const out = typeof r === 'string' ? { img: r } : r;
for (const [k, v] of Object.entries(out)) {
  const b64 = v.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(`${outPrefix}_${k}.png`, Buffer.from(b64, 'base64'));
  console.log('wrote', `${outPrefix}_${k}.png`);
}
await browser.close();
