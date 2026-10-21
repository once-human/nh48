// CPU profile of the load (headless): top functions by self time. node tools/boot_profile.mjs
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const cdp = await page.target().createCDPSession();
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
await page.goto('http://127.0.0.1:8848/', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__boot && window.__boot.some(b => b[0] === "Ready")', { timeout: 300000, polling: 200 });
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
for (const [id, us] of counts) { const n = byId.get(id), f = n.callFrame; const k = `${f.functionName || '(anon)'} ${f.url.split('/').pop().split('?')[0]}:${f.lineNumber}`; self.set(k, (self.get(k) || 0) + us); }
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [k, us] of top) console.log(String(Math.round(us / 1000)).padStart(6), 'ms', k);
await browser.close();
