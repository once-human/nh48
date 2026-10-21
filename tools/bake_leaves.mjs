// The leaf atlas, painted once here instead of in every player's browser at load: runs the game headless,
// takes the 256 px-cell atlas it paints, and writes it as raw RGBA (gzipped) to assets/tex/leaves_256.rgba.gz
import puppeteer from 'puppeteer-core';
import fs from 'fs'; import zlib from 'zlib';
const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8848/test.html?test&q=high&noleafcache', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__W && window.__W.trees && window.__W.trees.leafMat', { timeout: 300000, polling: 300 });
const r = await page.evaluate(() => { const im = window.__W.trees.leafMat.map.image; let s = ''; const d = im.data; for (let i = 0; i < d.length; i += 32768) s += String.fromCharCode.apply(null, d.subarray(i, i + 32768)); return { w: im.width, h: im.height, b64: btoa(s) }; });
const raw = Buffer.from(r.b64, 'base64');
const out = Buffer.concat([Buffer.from(new Uint32Array([r.w, r.h]).buffer), raw]);
fs.writeFileSync('assets/tex/leaves_256.rgba.gz', zlib.gzipSync(out, { level: 9 }));
console.log(r.w, r.h, raw.length, '->', fs.statSync('assets/tex/leaves_256.rgba.gz').size);
await browser.close();
