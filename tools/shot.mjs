// Headless Chrome harness: open a page, wait for window.__shotReady (or timeout), screenshot, dump console.
// usage: node tools/shot.mjs <url> <out.png> [width] [height] [waitMs] [evalJS]
import puppeteer from 'puppeteer-core';
const [url, out, w = '1280', h = '720', waitMs = '60000', evalJs = ''] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
         '--enable-webgl', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage', `--window-size=${w},${h}`,
         ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`] : [])],
  protocolTimeout: 600000,
});
const page = await browser.newPage();
const TOUCH = !!process.env.TOUCH;
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1, hasTouch: TOUCH, isMobile: TOUCH, isLandscape: +w > +h });
if (TOUCH) await page.emulateMediaFeatures([{ name: 'pointer', value: 'coarse' }]).catch(() => {});
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
page.on('requestfailed', r => logs.push(`[requestfailed] ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 300000 });
try {
  await page.waitForFunction('window.__shotReady === true', { timeout: +waitMs, polling: 250 });
} catch (e) { logs.push('[harness] timeout waiting for __shotReady'); }
if (evalJs) { try { const r = await page.evaluate(evalJs); if (r !== undefined) logs.push('[eval] ' + JSON.stringify(r)); } catch (e) { logs.push('[eval-error] ' + e.message); } }
await page.screenshot({ path: out });
logs.push(`[harness] total ${(Date.now() - t0) / 1000}s`);
console.log(logs.join('\n'));
await browser.close();
