// Street scenes in game mode (people, traffic, parked rows at the given hour).
// usage: node tools/sim/scene.mjs <outDir> "name:x,z,headingRad,hour" ...
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [outDir, ...views] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,720'], protocolTimeout: 1800000 });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message));
page.on('console', m => { const t = m.text(); if (/error/i.test(t) && !/GPU stall/.test(t)) logs.push(t.slice(0, 300)); });
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&drive=0&frames=1&simx=2', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 600000, polling: 500 });
for (const v of views) {
  const [name, spec] = v.split(':'); const [x, z, th, hour] = spec.split(',').map(Number);
  const info = await page.evaluate(async (x, z, th, hour, process_env_FOOT) => {
    const g = window.__game, P = g.player;
    g.setHour(hour); g.W.activity.setHour(hour); g.traffic.hour = hour;
    P.reset(x, z, th); if (process_env_FOOT) P.teleportFoot(x, z, th, g.traffic); g.W.streamer.warm && g.W.streamer.warm(x, z, 250);
    // fresh crowd and traffic for this place and hour
    g.people.list = g.people.list.filter(p => p.fixed || p.pax); g.people.actT = 0;
    for (let i = g.traffic.list.length - 1; i >= 0; i--) g.traffic.despawn(i);
    g.traffic.prefill(x, z);
    for (let k = 0; k < 40; k++) g.people.update(0.1, P, null);
    const t0 = g.t; while (g.t - t0 < 1.5) await new Promise(r => requestAnimationFrame(r));
    return { peds: g.people.list.length, target: g.people.target, act: +g.people.actHere.toFixed(1), night: +g.people.nightHere.toFixed(2), traffic: g.traffic.list.length };
  }, x, z, th, hour, !!process.env.FOOT);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`${name} ${JSON.stringify(info)}`);
}
console.log(logs.join('\n'));
await browser.close();
