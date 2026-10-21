// smoke test: every kind of shop renders its menu; buy a few things; open the bag tabs
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1100,650'], protocolTimeout: 600000 });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 650 });
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 500 });
const r = await page.evaluate(async () => {
  const g = window.__game, out = { kinds: {}, errs: [] };
  g.stats.money = 2e8;
  const kinds = ['tapri','misal','thali','biryani','southindian','chinese','fastfood','food','cafe','bakery','sweets','juice','icecream','bar','barber','clothes','shoes','optician','pharmacy','clinic','gym','bank','jeweller','kirana','mobile','electronics','books','florist','paan','dealer','garage','fuel','travel','chowki','lodge','estate'];
  for (const k of kinds) {
    try { const ctx = { kind: k, name: 'Test ' + k, x: g.player.x, z: g.player.z, cat: k }; const it = g.shops.items(ctx); out.kinds[k] = it.length;
      g.shops.show(ctx); for (let i = 0; i < Math.min(3, it.length); i++) g.shops.buy(i); g.shops.close(); } catch (e) { out.errs.push(k + ': ' + e.message); }
  }
  try { for (const p of g.props.list) { const o = []; g.props.items(o, p); out.props = (out.props || 0) + o.length; } g.props.buy(g.props.list[1]); } catch (e) { out.errs.push('props ' + e.message); }
  for (const m of ['clothes','shoes','salon']) { try { g.player.exit(g.traffic, true); g.trial.show({ kind: 'clothes', name: 'T', x: g.player.x, z: g.player.z, tier: 'all' }, m); g.trial.pick(1); g.trial.buy(); g.trial.close(); } catch (e) { out.errs.push('trial ' + m + ' ' + e.message); } }
  for (const [k, t] of [['clinic','dental'],['clinic','skin'],['clinic','lab'],['clinic','hospital'],['optician','chain'],['optician','premium'],['barber','premium'],['gym','premium']]) { try { const it = g.shops.items({ kind: k, tier: t, name: 'X', x: g.player.x, z: g.player.z }); out.kinds[k + ':' + t] = it.length; it[1] && it[1].act && it[1].act(); } catch (e) { out.errs.push(k + t + ' ' + e.message); } }
  for (const t of ['bag','me','wear','own','near']) { try { g.bag.show(t); g.bag.close(); } catch (e) { out.errs.push('bag ' + t + ' ' + e.message); } }
  try { g.club.enter({ name: 'Club', x: g.player.x, z: g.player.z }); g.club.act('dance'); g.club.act('talk'); g.club.leave(); } catch (e) { out.errs.push('club ' + e.message); }
  try { g.gigs.startAt({ name: 'Test misal', x: g.player.x, z: g.player.z }); out.gig = g.objective().main; } catch (e) { out.errs.push('gig ' + e.message); }
  out.near = g.shops.nearby(g.player.x, g.player.z, 400).slice(0, 6).map(x => x.kind + ':' + x.name);
  out.money = g.stats.money; out.life = g.life.s.inv; out.props = g.props.list.length;
  return out;
});
console.log(JSON.stringify(r)); console.log(logs.slice(0, 10).join('\n'));
await page.screenshot({ path: process.argv[2] || 'shops.png' });
await browser.close();
