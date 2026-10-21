// take a car from traffic and time the frames around it
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=800,450'], protocolTimeout: 600000 });
const page = await browser.newPage(); await page.setViewport({ width: 800, height: 450 });
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message));
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 500 });
const r = await page.evaluate(async () => {
  const g = window.__game, P = g.player, out = {};
  const o = g.traffic.list.find(v => v.type === 'sedan' || v.type === 'hatch') || g.traffic.list[0];
  P.teleportFoot(o.x + 3, o.z, 0, g.traffic);
  const frame = () => new Promise(r => requestAnimationFrame(() => r(performance.now())));
  await frame(); let t = await frame();
  const t0 = performance.now(); P.enter({ kind: 'traffic', o }, g.traffic); out.enterMs = +(performance.now() - t0).toFixed(1);
  const fr = []; for (let i = 0; i < 12; i++) { const n = await frame(); fr.push(+(n - t).toFixed(0)); t = n; }
  out.frames = fr; out.veh = P.vehicleLabel(); out.sub = document.getElementById('h-sub-line').textContent; out.who = document.getElementById('h-sub-who').textContent;
  out.lights = 0; g.scene.traverse(x => { if (x.isLight) out.lights++; });
  const R = g.renderer; out.info = { calls: R.info.render.calls, tris: R.info.render.triangles, progs: R.info.programs.length, geos: R.info.memory.geometries, tex: R.info.memory.textures };
  out.camMode = g.rig.mode; out.cockpit = !!P.cockpitOn; out.state = g.state; out.heat = g.police.heat; out.marshals = g.police.marshals.length;
  // time 5 more frames with the angry driver and marshals removed, to see who is heavy
  for (const n of P.npcs) n.H.holder.visible = false;
  let t2 = await frame(); const fr2 = []; for (let i = 0; i < 4; i++) { const n = await frame(); fr2.push(+(n - t2).toFixed(0)); t2 = n; } out.noNpc = fr2;
  for (const m of g.police.marshals) { m.veh.root.visible = false; if (m.H) m.H.holder.visible = false; }
  const fr3 = []; for (let i = 0; i < 4; i++) { const n = await frame(); fr3.push(+(n - t2).toFixed(0)); t2 = n; } out.noMarshal = fr3;
  P.cur.root.visible = false;
  const fr4 = []; for (let i = 0; i < 4; i++) { const n = await frame(); fr4.push(+(n - t2).toFixed(0)); t2 = n; } out.noCar = fr4;
  return out;
});
console.log(JSON.stringify(r)); console.log(logs.join('\n'));
await browser.close();
