import puppeteer from 'puppeteer-core';
const q = process.argv[2] || 'high';
const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', headless: 'new',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'], protocolTimeout: 900000 });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('[pageerror] ' + e.message));
await page.goto(`http://127.0.0.1:8848/test.html?test&play=roam&q=${q}`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__game && window.__game.state === "play"', { timeout: 300000, polling: 300 });
await new Promise(r => setTimeout(r, 25000));
const r = await page.evaluate(() => {
  const g = window.__game, R = g.renderer, S = g.scene;
  const info = { calls: R.info.render.calls, tris: R.info.render.triangles, geo: R.info.memory.geometries, tex: R.info.memory.textures, prog: R.info.programs.length };
  const by = {}; let vis = 0;
  S.traverse(o => { if (!o.isMesh && !o.isInstancedMesh && !o.isPoints && !o.isLine && !o.isSprite) return; let p = o, ok = true; while (p) { if (p.visible === false) { ok = false; break; } p = p.parent; } if (!ok) return; vis++;
    const k = (o.parent && o.parent.name && !/^Mesh$/.test(o.parent.name) ? o.parent.name : '') + '/' + (o.name || o.userData.kind || (o.material && o.material.name) || o.type) + (o.isInstancedMesh ? '[I]' : '') + '/' + (o.geometry?.attributes?.position?.count || 0); const n = o.isInstancedMesh ? o.count : 1; by[k] = by[k] || [0, 0, 0]; by[k][0]++; by[k][1] += n; by[k][2] += (o.geometry && o.geometry.index ? o.geometry.index.count / 3 : (o.geometry?.attributes?.position?.count || 0) / 3) * n; });
  const top = Object.entries(by).sort((a, b) => b[1][2] - a[1][2]).slice(0, 30).map(([k, v]) => `${k}: meshes ${v[0]} inst ${v[1]} tris ${Math.round(v[2] / 1000)}k`);
  const big = []; S.traverse(o => { const n = o.geometry?.attributes?.position?.count || 0; if (n > 200000) { const W = window.__W; const owner = Object.keys(W).filter(k => { try { return W[k] === o || (W[k] && (W[k].mesh === o || W[k].group === o)); } catch (e) { return false; } }); big.push({ n, name: o.name, mat: o.material && (o.material.name || o.material.type), parent: o.parent && (o.parent.name || o.parent.type), owner, ud: Object.keys(o.userData) }); } });
  return { big, info, vis, q: g.quality.name, pr: R.getPixelRatio(), top, peds: g.people.list.length, cars: g.traffic.list.length, built: window.__W.streamer.built.size || window.__W.streamer.built.length };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
