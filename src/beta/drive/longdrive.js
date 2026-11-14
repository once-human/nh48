// Long Drive: a mode of its own, on its own page load (?drive), so none of Pune is downloaded or built for it. One road
// through open country (drive/country.js), no one else on it, nothing to do but drive: your choice of car, the radio,
// the time of day and the weather of free roam, and everything the car itself does (its handling, its crashes, its
// damage, its glass). You're always in it: there's no getting out, and the car is changed from the menu, not the
// terminal (which isn't here). If it burns out, the drive is over, and you pick again.
import { SPECS } from '@orig/vehicles/vehicle.js';
import { Pilot } from '@orig/game/pilot.js';
import { strip } from './strip.js';

export const DRIVE = new URLSearchParams(location.search).has('drive');
const KEY = 'nh48_drive_car';
// what you can take (the terminal's names for them, and their types)
const CARS = [['swift', 'hatch'], ['wagonr', 'wagonr'], ['alto', 'alto'], ['dzire', 'sedan'], ['city', 'city'], ['eclass', 'lux'], ['creta', 'suv'], ['nexon', 'nexon'],
  ['xuv700', 'xuv'], ['scorpio', 'scorpio'], ['fortuner', 'fortuner'], ['bolero', 'bolero'], ['thar', 'jeep'], ['innova', 'innova'], ['ertiga', 'ertiga'], ['911', 'sports'],
  ['huracan', 'super'], ['zx10r', 'superbike'], ['classic350', 'bullet'], ['commuter', 'bike'], ['activa', 'scooter'], ['rickshaw', 'auto'], ['ace', 'tempo']];
const nameOf = (t) => (SPECS[t] && (SPECS[t].model || SPECS[t].name)) || t;
const topOf = (t) => (SPECS[t] && SPECS[t].vTop ? Math.round(SPECS[t].vTop*3.6) + ' km/h' : '');
const chosen = () => { try { const k = localStorage.getItem(KEY); if (CARS.some(c => c[0] === k)) return k; } catch (e) { /* none */ } return 'creta'; };
const choose = (k) => { try { localStorage.setItem(KEY, k); } catch (e) { /* this time only */ } };
const go = (on) => { const u = new URL(location.href); if (on) u.searchParams.set('drive', '1'); else u.searchParams.delete('drive'); location.href = u.toString(); };

const CSS = `
body.drive #t-roam, body.drive #t-free, body.drive #t-who, body.drive #t-wipe, body.drive #t-live, body.drive #t-drive, body.drive #t-stats { display: none !important; }
.ld-cars { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 14px; max-height: 46vh; overflow: auto; padding-right: 4px; }
.ld-car { text-align: left; background: #1d1f24; color: #e9e4d8; border: 1px solid #2e3138; border-radius: 12px; padding: 10px 12px; cursor: pointer; font: inherit; }
.ld-car b { display: block; font-size: 14px; } .ld-car small { opacity: .65; font-size: 12px; }
.ld-car:hover { border-color: #6b6f78; } .ld-car.on { background: #efe6cf; color: #1b1c20; border-color: #efe6cf; }
.ld-pick { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; background: rgba(8, 9, 12, .62); }
.ld-pick > div { width: min(760px, calc(100vw - 32px)); background: #15161a; color: #e9e4d8; border-radius: 18px; padding: 20px 22px; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.ld-pick h3 { margin: 0 0 2px; font-size: 20px; } .ld-pick p { margin: 0; opacity: .7; }
.ld-pick .ld-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
`;

// a grid of the cars, the chosen one picked out
function grid(onPick) {
  const g = document.createElement('div'); g.className = 'ld-cars';
  const sel = chosen();
  for (const [k, t] of CARS) {
    const b = document.createElement('button'); b.className = 'ld-car' + (k === sel ? ' on' : ''); b.dataset.k = k;
    b.innerHTML = `<b>${nameOf(t)}</b><small>${topOf(t)}</small>`;
    b.onclick = () => { choose(k); g.querySelectorAll('.ld-car').forEach(q => q.classList.toggle('on', q === b)); onPick && onPick(k); };
    g.appendChild(b);
  }
  return g;
}

// on Pune's own title: the way in
export function driveButton() {
  const poll = () => {
    const f = document.querySelector('#t-live') || document.querySelector('#t-free'); if (!f) { setTimeout(poll, 400); return; }
    if (document.querySelector('#t-drive')) return;
    const b = document.createElement('button'); b.className = 'pz-i'; b.id = 't-drive'; b.textContent = 'Long Drive';
    b.title = 'One road through open country, no end to it. Just you and the car';
    b.onclick = () => go(true); f.after(b);
  };
  poll();
}

export function longDrive(G) {
  const P = G.player, W = G.W, C = W.country;
  G.driveMode = true; window.__nhDrive = true;
  document.body.classList.add('drive');
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  // no one else here: no one walking, nothing else on the road
  for (const o of [G.people, G.traffic]) if (o) Object.defineProperty(o, 'max', { get: () => 0, set: () => {}, configurable: true });
  // the title shows the road where you'll start
  try { P.reset(C.start.x, C.start.z, C.start.th); G.rig && (G.rig.inited = false); } catch (e) { /* stays */ }
  // the title: this mode's, with the cars to choose from
  const title = () => {
    const t = document.querySelector('.ttl'); if (!t) { setTimeout(title, 300); return; }
    const h = t.querySelector('.ttl-head');
    if (h) { h.querySelector('.pz-k').textContent = 'Puneri'; h.querySelector('b').textContent = 'Long Drive'; const mr = h.querySelector('.ttl-mr'); if (mr) mr.textContent = 'लाँग ड्राइव्ह'; const sb = h.querySelector('.ttl-sub'); if (sb) sb.textContent = 'One road through open country, no end to it. Pick what you drive, put the radio on, and go.'; }
    const nav = t.querySelector('.pz-menu'); if (!nav || nav.querySelector('#t-go')) return;
    const a = document.createElement('button'); a.className = 'pz-i sel'; a.id = 't-go'; a.textContent = 'Drive'; a.onclick = () => begin();
    const b = document.createElement('button'); b.className = 'pz-i'; b.id = 't-pune'; b.textContent = 'Back to Pune'; b.onclick = () => go(false);
    nav.prepend(b); nav.prepend(a);
    nav.after(grid());
  };
  title();
  // the menu's other name for the mode
  const sm = G.hud && G.hud.setMode;
  if (sm) G.hud.setMode = function (...a) { const r = sm.apply(this, a); const m = document.getElementById('h-mode'); if (m) m.textContent = 'Long Drive'; return r; };

  // ---- the car: taken away and another put in its place, where it stood and facing the same way
  let car = null, footT = 0, over = false, first = true;
  function swap(k) {
    const T = G.traffic, old = P.onFoot ? null : P.cur;
    const x = old ? old.x : P.x, z = old ? old.z : P.z, th = old ? old.th : (P.th || 0);
    if (old) {
      P._swap = true; try { P.exit(T, true); } finally { P._swap = false; }
      const d = P.dropped.find(q => q.veh === old); if (d) P.removeDropped(d, T);
      if (old === P.auto) { if (old.root) old.root.visible = false; } else { try { old.dispose(); } catch (e) { /* gone */ } }
    }
    G.sh.exec(`drive ${k}`, true);
    const v = P.onFoot ? null : P.cur;
    if (v) { v.reset(x, z, th); v.y = W.surf.height(x, z); v.v = 0; car = v; }
    if (G.rig) G.rig.inited = false;
  }
  // a drive from the start of the road
  function begin() {
    over = false; pending = true;
    G.beginFree();
  }
  let pending = false;
  const sp = G.startPlay.bind(G);
  G.startPlay = (...a) => {
    const r = sp(...a);
    if (pending && G.state === 'play') {
      pending = false;
      try { strip(G); } catch (e) { console.warn('strip', e); }
      try { P.reset(C.start.x, C.start.z, C.start.th); } catch (e) { /* where it is */ }
      swap(chosen());
      if (first) { first = false; G.setHour?.(17.2); }
      setTimeout(() => G.hud?.toast?.('Long Drive', 'Esc for the menu, where you can change the car', 'info', 5), 1200);
    }
    return r;
  };
  // ---- in the car, always: E does nothing here, and if you're thrown off a bike you're back on it in a moment
  const ex = Pilot.prototype.exit;
  Pilot.prototype.exit = function (traffic, force, ...a) {
    if (window.__nhDrive && !force && !this._swap) { G.hud?.toast?.('Long Drive', 'You stay in the car here. Change it from the menu (Esc)', 'info', 3); return; }
    return ex.call(this, traffic, force, ...a);
  };
  const fr = G.frame.bind(G);
  G.frame = (dt) => {
    const r = fr(dt);
    if (G.state === 'play' && !over) {
      if (P.onFoot && car && !car.dead) { if ((footT += dt) > 2.5) { footT = 0; const d = P.dropped.find(q => q.veh === car); if (d) { try { P.enter({ kind: 'dropped', d, now: true }, G.traffic); } catch (e) { /* next time */ } if (G.rig) G.rig.inited = false; } } }
      else footT = 0;
    }
    return r;
  };
  // ---- burnt out: the drive's over
  const boom = G.explode.bind(G);
  G.explode = (v, ...a) => {
    const r = boom(v, ...a);
    if (v === car && !over) {
      over = true;
      setTimeout(() => { try { G.endShift(); } catch (e) { /* stays */ } try { P.reset(C.start.x, C.start.z, C.start.th); } catch (e) { /* */ } G.hud?.toast?.('Burnt out', 'That was the end of that one. Pick a car and go again', 'warn', 6); }, 4500);
    }
    return r;
  };
  // ---- the menu: change the car without stopping
  const menu = () => {
    const p = G.hud && G.hud.pause, nav = p && p.querySelector('.pz-menu'); if (!nav) { setTimeout(menu, 400); return; }
    if (nav.querySelector('#p-car')) return;
    const b = document.createElement('button'); b.className = 'pz-i'; b.id = 'p-car'; b.textContent = 'Change car';
    b.onclick = () => picker();
    const res = nav.querySelector('#p-resume'); if (res) res.after(b); else nav.prepend(b);
    for (const id of ['#p-title']) { const q = nav.querySelector(id); if (q) q.textContent = 'End the drive'; }
  };
  menu();
  // everything a drive doesn't use, taken down (drive/strip.js): now, and again as each drive starts (some of the game
  // finishes setting itself up after the title is up)
  try { strip(G); } catch (e) { console.warn('strip', e); }
  function picker() {
    const o = document.createElement('div'); o.className = 'ld-pick';
    const box = document.createElement('div'); box.innerHTML = '<h3>Change car</h3><p>The new one goes where this one is, facing the same way.</p>';
    let pick = chosen();
    box.appendChild(grid((k) => { pick = k; }));
    const row = document.createElement('div'); row.className = 'ld-row';
    const ok = document.createElement('button'); ok.className = 'btn'; ok.textContent = 'Drive this';
    const no = document.createElement('button'); no.className = 'btn'; no.textContent = 'Keep this one';
    row.append(no, ok); box.appendChild(row); o.appendChild(box); document.body.appendChild(o);
    const close = () => o.remove();
    no.onclick = close; o.onclick = (e) => { if (e.target === o) close(); };
    ok.onclick = () => { close(); if (G.state === 'pause') G.togglePause(false); swap(pick); };
  }
}
