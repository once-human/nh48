// walk into a club at night, talk to someone, get their number, meet at a café, ask them out
import puppeteer from 'puppeteer-core';
const [, , out] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], protocolTimeout: 600000 });
const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 650 });
const logs = []; page.on('pageerror', e => logs.push('ERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
await page.goto('http://127.0.0.1:8848/test.html?test&play=1&q=low&frames=1&hour=23', { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction('window.__shotReady === true || window.__error', { timeout: 400000, polling: 500 });
const r = await page.evaluate(async () => {
  const g = window.__game, P = g.player, D = g.date, o = {};
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  P.exit(g.traffic, true);
  for (let i = 0; i < 3; i++) await frame();
  g.stats.money = 50000; g.life.s.mood = 0.9;
  o.enter = g.interiors.enter({ kind: 'bar', name: 'High Spirits', mr: '', x: P.x, z: P.z, door: {}, flag: 'brand' });
  for (let i = 0; i < 6; i++) await frame();
  const R = g.interiors.cur.R;
  o.style = R.style; o.size = [R.W, R.D]; o.peds = R.peds.length; o.hearts = R.hearts.length;
  const p = R.peds.find(q => D.eligible(q) && q.name);
  o.who = p && [p.name, p.female, P.look.female];
  // stand next to them: does F offer the chat?
  P.foot.x = p.x + 1.5; P.foot.z = p.z;
  o.near = g.interiors.near(P.foot.x, P.foot.z)?.label;
  D.talk(p, g.interiors.cur);
  o.opts0 = D.opts.map(q => q.label);
  const pick = (id) => { const i = D.opts.findIndex(q => q.id === id || q.topic === id); if (i >= 0) D.pick(i); return document.querySelector('.tk-line').textContent + ' | ' + document.querySelector('.tk-how').textContent; };
  o.l = [pick('job')];
  const P0 = D.profile(p);
  for (let k = 0; k < 6 && D.cur; k++) { const like = D.opts.find(q => q.topic && P0.likes.includes(q.topic)); o.l.push(like ? pick(like.id) : pick('drink')); }
  if (D.cur) o.l.push(pick('dance'));
  o.interest = p.interest;
  p.interest = D.cur ? (D.cur.interest = 90) : 90;
  if (!D.cur) D.talk(p, g.interiors.cur), D.cur.interest = 90;
  D.render();
  o.numberLine = pick('number');
  o.contacts = (g.life.s.contacts || []).map(c => [c.name, c.aff, c.met]);
  await new Promise(r => setTimeout(r, 2300));
  o.stateAfter = g.state;
  g.interiors.exit();
  for (let i = 0; i < 4; i++) await frame();
  o.outside = P.x < 30000;
  // people tab + guide render
  g.bag.show('ppl'); o.pplRows = document.querySelectorAll('.jh-body .jh-row').length; o.pplText = document.querySelector('.jh-body').textContent.slice(0, 120);
  g.bag.tab = 'guide'; g.bag.render(); o.guideSecs = document.querySelectorAll('.gd-sec').length;
  g.bag.close();
  // ask to meet, walk into the café, the date is at a table
  const ct = g.life.s.contacts[0];
  if (ct) {
    const near = g.shops.nearby(P.x, P.z, 1400).filter(s => s.kind === 'cafe');
    o.cafes = near.length;
    D.rng.next = () => 0.5;   // not busy
    o.meet = D.askToMeet(ct); o.pending = D.pending && D.pending.place.name;
    if (D.pending) {
      const pl = D.pending.place;
      o.enter2 = g.interiors.enter({ ...pl, door: {} });
      D.onEnter(g.interiors.cur.R, g.interiors.cur.ctx || pl);
      for (let i = 0; i < 4; i++) await frame();
      const dp = g.interiors.cur.R.peds.find(q => q.dateWith);
      o.dateAt = !!dp;
      if (dp) {
        P.foot.x = dp.x + 1.2; P.foot.z = dp.z; o.near2 = g.interiors.near(P.foot.x, P.foot.z)?.label;
        D.talk(dp, g.interiors.cur); o.mode = D.cur.mode; o.dopts = D.opts.map(q => q.label);
        const dl = [];
        ct.aff = 75; D.render();
        for (const id of ['day', 'share', 'plan', 'hand', 'ask']) dl.push(pick(id));
        o.dl = dl; o.partner = ct.partner; o.aff = ct.aff;
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }
  return o;
});
await page.screenshot({ path: out });
console.log(JSON.stringify(r, null, 1)); console.log(logs.slice(0, 6).join('\n'));
await browser.close();
