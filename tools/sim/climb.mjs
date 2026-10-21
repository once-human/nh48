// on-foot jump + climb check: node tools/sim/climb.mjs out x z yaw
import puppeteer from 'puppeteer-core';
const [out, x, z, yaw] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=960,540'], protocolTimeout: 900000 });
const page = await browser.newPage(); await page.setViewport({ width: 960, height: 540 });
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message));
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1&simx=2', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 600000, polling: 500 });
const r = await page.evaluate(async (x, z, yaw) => {
  const g = window.__game, P = g.player;
  P.teleportFoot(x, z, yaw, g.traffic); g.W.streamer.warm(x, z, 120);
  const wait = (s) => new Promise(res => { const t0 = g.t; const f = () => (g.t - t0 >= s ? res() : requestAnimationFrame(f)); f(); });
  await wait(0.5);
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  const wall = g.W.collision.resolve(P.foot.x + fx * 0.45, P.foot.z + fz * 0.45, 0.32);
  const out = { wall: wall && wall.kind, y0: P.foot.y };
  g.input.pressed.add('Space');
  const ys = [];
  for (let i = 0; i < 12; i++) { await wait(0.2); ys.push([+P.foot.x.toFixed(2), +P.foot.z.toFixed(2), +P.foot.y.toFixed(2), !!P.foot.climb, !!P.foot.air]); }
  out.ys = ys;
  return out;
}, +x, +z, +yaw);
console.log(JSON.stringify(r)); console.log(logs.join('\n'));
await page.screenshot({ path: out });
await browser.close();
