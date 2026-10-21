// take a car from traffic and time the frames around it (finds what makes getting in heavy)
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,450'], protocolTimeout: 600000 });
const page = await browser.newPage(); await page.setViewport({ width: 800, height: 450 });
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message));
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 500 });
const r = await page.evaluate(async () => {
  const g = window.__game, P = g.player, out = {};
  const frame = () => new Promise(r => requestAnimationFrame(() => r(performance.now())));
  const part = async (label) => { let t2 = await frame(); const f = []; for (let i = 0; i < 3; i++) { const n = await frame(); f.push(+(n - t2).toFixed(0)); t2 = n; } out[label] = f; };
  await part('inAuto');
  const o = g.traffic.list.find(v => v.type === 'sedan' || v.type === 'hatch') || g.traffic.list[0];
  P.teleportFoot(o.x + 3, o.z, 0, g.traffic);
  await part('onFoot');
  P.enter({ kind: 'traffic', o }, g.traffic);
  await part('inCar');
  out.npcs = P.npcs.length; out.marshals = g.police.marshals.length;
  for (const n of P.npcs) n.H.holder.visible = false; await part('noNpc');
  for (const m of g.police.marshals) { m.veh.root.visible = false; if (m.H) m.H.holder.visible = false; } await part('noMarshal');
  P.cur.root.visible = false; await part('noCar');
  P.human.holder.visible = false; await part('noHuman');
  const R = g.renderer; out.info = { calls: R.info.render.calls, tris: R.info.render.triangles };
  return out;
});
console.log(JSON.stringify(r)); console.log(logs.join('\n'));
await browser.close();
