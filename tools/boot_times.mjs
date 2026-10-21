// How long each loading stage takes (headless, local server): node tools/boot_times.mjs
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
const t0 = Date.now();
await page.goto('http://127.0.0.1:8848/' + (process.argv[2] || ''), { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__boot && window.__boot.some(b => b[0] === "Ready")', { timeout: 300000, polling: 200 });
const b = await page.evaluate(() => window.__boot);
let prev = 0; for (const [t, ms] of b) { console.log(String(ms - prev).padStart(6), 'ms  ->', t); prev = ms; }
console.log('total', Date.now() - t0, 'ms');
await browser.close();
