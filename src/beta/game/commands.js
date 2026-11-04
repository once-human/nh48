// Free roam's terminal, on / or `. Nothing it does can reach your own game: saves are shut for as long as free roam runs,
// and rates, spawns and the rest all go back when you leave it.
import { Shell, Terminal, plain } from './console.js';
import { Vehicle, SPECS, specOf, defaultPaint } from '@orig/vehicles/vehicle.js';
import { TYPES } from '@orig/traffic/traffic.js';
import { WEATHERS } from '@orig/gfx/weather.js';
import { ITEMS } from '@orig/game/life.js';
import { lin } from '@orig/world/geo.js';
import { SETTINGS } from './graphics.js';

// what you'd call them, to what the game calls them. The game's own names stay "911-style" and so on: no badges on anything
const NICK = {
  porsche: 'sports', '911': 'sports', carrera: 'sports', lamborghini: 'super', lambo: 'super', huracan: 'super', mercedes: 'lux', merc: 'lux', eclass: 'lux', benz: 'lux',
  thar: 'jeep', creta: 'suv', swift: 'hatch', dzire: 'sedan', activa: 'scooter', hero: 'cycle', splendor: 'bike', ninja: 'superbike', zx10r: 'superbike', re: 'bullet', enfield: 'bullet',
  rickshaw: 'auto', pmpml: 'bus', ace: 'tempo', cab: 'taxi',
};
const COLOURS = { red: '#c8181a', white: '#eeeeea', black: '#101216', silver: '#a9acb0', grey: '#60646a', blue: '#1c3f9e', navy: '#0e1c44', green: '#14613a', yellow: '#f0c414', orange: '#e8650e', lime: '#8fd11c', purple: '#4c2178', pink: '#d84f8c', gt: '#b7bcc2', verde: '#7bbf1a', arancio: '#ef6a10', rosso: '#b30e12', teal: '#0f7f80' };
const paintOf = (s) => {
  const h = COLOURS[String(s).toLowerCase()] || String(s), m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) throw new Error(`no colour "${s}". Names: ${Object.keys(COLOURS).join(', ')}, or #rrggbb`);
  const n = parseInt(m[1], 16); return [lin((n >> 16 & 255)/255), lin((n >> 8 & 255)/255), lin((n & 255)/255)];
};
const HEAT = [0, 1, 3, 7, 15, 25];
const fmt = (v) => {
  if (v === undefined) return 'undefined'; if (v === null) return 'null';
  if (typeof v === 'function') return `ƒ ${v.name || 'anonymous'}(${v.length})`;
  if (typeof v === 'number') return String(+v.toFixed(4));
  if (typeof v !== 'object') return JSON.stringify(v);
  if (v.isVector3) return `Vector3(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
  if (Array.isArray(v)) return `Array(${v.length}) [${v.slice(0, 8).map(q => typeof q === 'object' && q ? '{…}' : fmt(q)).join(', ')}${v.length > 8 ? ', …' : ''}]`;
  const keys = Object.keys(v), name = v.constructor && v.constructor.name;
  return `${name && name !== 'Object' ? name + ' ' : ''}{ ${keys.slice(0, 10).map(k => { const q = v[k]; return k + ': ' + (typeof q === 'object' && q ? '…' : typeof q === 'function' ? 'ƒ' : fmt(q)); }).join(', ')}${keys.length > 10 ? `, … ${keys.length} keys` : ''} }`;
};

export function freeTerminal(G) {
  const sh = new Shell(), STORE = 'nh48_console', keep = (() => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; } })();
  sh.userAlias = keep.alias || {};
  const binds = keep.bind || {}, autoexec = keep.autoexec || [];
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify({ alias: sh.userAlias, bind: binds, autoexec })); } catch (e) { /* private window */ } };
  const P = () => G.player, T = () => G.traffic, W = () => G.W;
  const St = { god: false, noclip: false, fuel: false, hourLock: null, scale: 1, fly: null, watches: [], timers: [], spawned: [], rates: {}, baseW: null, baseMax: 0, hud: false, wasFree: true, foot: 1 };
  let armed = false;

  // ------------------------------------------------------------ places and things to point at
  let places = null;
  const allPlaces = () => {
    if (places) return places;
    const out = [], seen = new Set(), add = (n, x, z, c) => { if (!n) return; const k = n.toLowerCase(); out.push({ n, l: k, x, z, c }); seen.add(k); };
    for (const s of G.hud?.suburbs || []) add(s.n, s.x, s.z, 'area');
    for (const p of G.city?.places || []) add(p.n, p.x, p.z, p.c);
    return (places = out);
  };
  const search = (q, max = 40) => {
    q = q.toLowerCase().trim(); if (!q) return [];
    const a = [], b = [];
    for (const p of allPlaces()) { if (p.l.startsWith(q)) a.push(p); else if (p.l.includes(q)) b.push(p); }
    const px = P().x, pz = P().z, d = (p) => (p.c === 'area' ? 0 : p.c === 'landmark' ? 1 : 2)*1e9 + Math.hypot(p.x - px, p.z - pz);
    return [...a.sort((m, n) => d(m) - d(n)), ...b.sort((m, n) => d(m) - d(n))].slice(0, max);
  };
  const vehType = (s) => { const k = String(s).toLowerCase(), t = NICK[k] || k; if (!SPECS[t]) throw new Error(`no vehicle "${s}". See: roster`); return t; };
  const nearest = (type) => { let best = null, bd = 1e18; for (const o of T().list) { if (type && o.type !== type) continue; const d = (o.x - P().x)**2 + (o.z - P().z)**2; if (d < bd) { bd = d; best = o; } } return best; };
  // a point from words: x z, ~dx ~dz (from you), ^right ^forward (the way you face), @type (the nearest of them), @wp, or a name
  let found = [];
  function target(a) {
    const s = a[0];
    if (s === '@wp') { const w = G.waypoint; if (!w) throw new Error('no waypoint set'); return { x: w.x, z: w.z, name: w.name }; }
    if (s[0] === '@') { const t = vehType(s.slice(1)), o = nearest(t); if (!o) throw new Error(`no ${t} in traffic right now. Try: rate ${t} 200; traffic flush`); return { x: o.x, z: o.z, name: 'nearest ' + t, keep: true }; }
    if (s[0] === '#') { const p = found[+s.slice(1)]; if (!p) throw new Error('nothing at that number. Run: find <name>'); return { x: p.x, z: p.z, name: p.n, safe: true }; }
    const num = (v, base) => { const r = v[0] === '~'; const n = r ? (v.length > 1 ? +v.slice(1) : 0) : +v; return Number.isFinite(n) ? (r ? base + n : n) : NaN; };
    if (s[0] === '^' && a[1] && a[1][0] === '^') { const c = Math.cos(P().th), n = Math.sin(P().th), R = +a[0].slice(1) || 0, F = +a[1].slice(1) || 0; return { x: P().x + c*F - n*R, z: P().z + n*F + c*R, name: 'relative' }; }
    if (a.length >= 2 && !Number.isNaN(num(a[0], 0)) && !Number.isNaN(num(a[1], 0))) return { x: num(a[0], P().x), z: num(a[1], P().z), name: `${a[0]} ${a[1]}` };
    const hit = search(a.join(' '), 1)[0];
    if (!hit) throw new Error(`nothing called "${a.join(' ')}". Try: find ${a.join(' ')}`);
    return { x: hit.x, z: hit.z, name: hit.n, safe: true };
  }
  async function go(t) {
    const far = Math.hypot(t.x - P().x, t.z - P().z) > 300, Wd = W();
    if (far && Wd.tiles) {
      const was = G.state; G.state = 'shop'; G.hud.curtain?.(true, t.name || 'Teleporting', 0);
      try { await Promise.race([Wd.tiles.ensure(t.x, t.z, 650, (f) => G.hud.curtainProgress?.(f)), new Promise(r => setTimeout(r, 15000))]); }
      finally { G.state = was; G.hud.curtain?.(false); }
    }
    let x = t.x, z = t.z, th = P().th;
    if (t.safe) { const s = G.safeDrop(x, z); if (s) { x = s.x; z = s.z; th = s.th ?? th; } }
    if (P().onFoot) P().teleportFoot(x, z, th, T());
    else { const v = P().cur; v.reset(x, z, th); v.y = Wd.surf.height(x, z); v.deck = -1; }
    if (G.rig) G.rig.inited = false;
    if (far) { Wd.streamer.warm(P().x, P().z, Math.min(260, G.quality?.streamRadius || 260)); T().prefill(P().x, P().z); }
    return { x, z };
  }

  // ------------------------------------------------------------ vehicles
  function make(type, paint, ahead = 7, side = 0) {
    const Pl = P(), c = Math.cos(Pl.th), n = Math.sin(Pl.th), x = Pl.x + c*ahead - n*side, z = Pl.z + n*ahead + c*side;
    const col = paint || defaultPaint(type, { next: Math.random });
    const v = new Vehicle(W(), G.scene, G.vmats, type, col);
    v.reset(x, z, Pl.th); v.y = W().surf.height(x, z); v.plate = Pl.randomPlate(); v.helmet = true; v.fuel = 1;
    v.owned = { id: 'test' + St.spawned.length, rental: true, until: 1e12 };    // (kept: the game only tidies away what isn't yours)
    Pl.addDropped(v, T());
    St.spawned.push(v);
    return v;
  }
  function removeSpawned() {
    let n = 0;
    for (const v of St.spawned.splice(0)) {
      const Pl = P();
      if (!Pl.onFoot && Pl.cur === v) Pl.exit(T(), true);
      const d = Pl.dropped.find(q => q.veh === v);
      if (d) Pl.removeDropped(d, T());
      try { v.dispose(); } catch (e) { /* gone */ }
      n++;
    }
    return n;
  }
  const baseW = () => { if (!St.baseW) { St.baseW = {}; for (const k in TYPES) St.baseW[k] = TYPES[k].w; } return St.baseW; };
  const applyRates = () => { const B = baseW(); for (const k in TYPES) TYPES[k].w = B[k]*(St.rates[k] ?? St.rates['*'] ?? 1); };
  const share = () => { const B = baseW(); let tot = 0; for (const k in TYPES) tot += TYPES[k].w; const o = {}; for (const k in TYPES) o[k] = tot ? TYPES[k].w/tot : 0; o._b = B; return o; };
  const flush = () => { const t = T(); for (let i = t.list.length - 1; i >= 0; i--) t.despawn(i); t.prefill(P().x, P().z); };

  // ------------------------------------------------------------ live object paths
  const roots = () => ({ G, W: W(), P: P(), T: T(), V: P().onFoot ? null : P().cur, L: G.life, gfx: G.gfx, TYPES, SPECS });
  const walk = (path) => {
    const seg = path.split('.'); let o = roots()[seg[0]], parent = null, key = seg[0];
    if (!(seg[0] in roots())) throw new Error(`no root "${seg[0]}". Roots: ${Object.keys(roots()).join(' ')}`);
    for (let i = 1; i < seg.length; i++) { if (o === null || o === undefined) throw new Error(`${seg.slice(0, i).join('.')} is ${o}`); parent = o; key = seg[i]; o = o[key]; }
    return { value: o, parent, key };
  };
  const pathType = (cur) => {
    const i = cur.lastIndexOf('.');
    if (i < 0) return Object.keys(roots()).map(v => ({ v: v + '.', note: 'root' })).filter(x => x.v.toLowerCase().startsWith(cur.toLowerCase()));
    let o; try { o = walk(cur.slice(0, i)).value; } catch (e) { return []; }
    if (o === null || typeof o !== 'object' && typeof o !== 'function') return [];
    const keys = new Set(); for (let q = o; q && q !== Object.prototype; q = Object.getPrototypeOf(q)) for (const k of Object.getOwnPropertyNames(q)) keys.add(k);
    const pre = cur.slice(i + 1).toLowerCase(), out = [];
    for (const k of keys) {
      if (!k.toLowerCase().startsWith(pre) || k === 'constructor') continue;
      let q; try { q = o[k]; } catch (e) { continue; }
      const obj = q && typeof q === 'object';
      out.push({ v: cur.slice(0, i + 1) + k + (obj ? '.' : ''), note: typeof q === 'function' ? 'ƒ' : obj ? (q.constructor?.name || 'object') : fmt(q) });
      if (out.length > 200) break;
    }
    return out.sort((a, b) => a.v < b.v ? -1 : 1);
  };
  pathType.own = true;
  const lit = (s) => { if (s === 'true') return true; if (s === 'false') return false; if (s === 'null') return null; if (s !== '' && Number.isFinite(+s)) return +s; return s; };

  // ------------------------------------------------------------ what completes what
  sh.type('vehicle', () => [...Object.keys(SPECS).filter(k => !SPECS[k].alias).map(v => ({ v, note: `${SPECS[v].model} · ${Math.round(SPECS[v].vTop*3.6)} km/h` })), ...Object.keys(NICK).map(v => ({ v, note: '→ ' + NICK[v] }))]);
  sh.type('rate', () => ['*', ...Object.keys(TYPES)].map(v => ({ v, note: v === '*' ? 'everything' : `now ${(St.rates[v] ?? 1)}×` })).concat(Object.keys(NICK).map(v => ({ v, note: '→ ' + NICK[v] }))));
  const placeT = (cur) => /^[~^@#\d-]/.test(cur) ? [] : (cur ? search(cur, 400) : allPlaces().filter(p => p.c === 'area').sort((a, b) => a.l < b.l ? -1 : 1)).map(p => ({ v: p.n, note: p.c + ' · ' + Math.round(Math.hypot(p.x - P().x, p.z - P().z)) + ' m' }));
  placeT.own = true; placeT.span = true;
  sh.type('place', placeT);
  sh.type('at', () => ['@wp', ...Object.keys(TYPES).map(k => '@' + k)].map(v => ({ v, note: v === '@wp' ? 'waypoint' : 'nearest in traffic' })));
  sh.type('path', pathType);
  sh.type('cmd', () => [...sh.cmds.values()].map(c => ({ v: c.name, note: c.about })));
  sh.type('weather', () => Object.keys(WEATHERS));
  sh.type('paint', () => Object.keys(COLOURS));
  sh.type('item', () => Object.keys(ITEMS).map(v => ({ v, note: ITEMS[v].name })));
  sh.type('stat', () => Object.keys(G.life?.s || {}).filter(k => typeof G.life.s[k] === 'number').map(v => ({ v, note: fmt(G.life.s[v]) })));
  sh.type('spec', () => { const v = P().onFoot ? null : P().cur; return v ? Object.keys(v.spec).filter(k => typeof v.spec[k] === 'number').map(k => ({ v: k, note: fmt(v.spec[k]) })) : []; });
  sh.type('setting', () => SETTINGS.filter(s => s.id).map(s => ({ v: s.id, note: s.label })).concat([{ v: 'reset', note: 'back to the preset' }]));
  sh.type('preset', () => ['auto', 'lite', 'low', 'medium', 'high', 'veryhigh', 'ultra']);
  sh.type('onoff', () => ['on', 'off']);
  sh.type('flow', () => [{ v: 'flush', note: 'clear the road and fill it again' }, { v: 'density', note: 'how many at once' }, { v: 'stop', note: 'everyone stands' }, { v: 'go', note: 'and off again' }, { v: 'census', note: 'what is out there now' }]);
  sh.type('key', () => ['F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'KeyG', 'KeyB', 'KeyN', 'KeyV', 'Digit1', 'Digit2', 'Digit3']);
  const onoff = (a, cur) => a === undefined ? !cur : a === 'on' || a === '1' || a === 'true';
  const say = (s, c) => sh.print(s, c);
  const tail = (raw, skip) => raw.trim().split(/\s+/).slice(skip).join(' ').replace(/^(["'])(.*)\1$/, '$2');   // (what's left of a line, as a command)

  // ------------------------------------------------------------ commands: finding your way
  sh.reg('help [command:cmd]', 'every command, or one in detail', ([c]) => {
    if (c) { const k = sh.find(c); if (!k) throw new Error('no such command'); say(plain(k.sig), 'ok'); say(k.about); if (k.more) for (const l of k.more) say('  ' + l, 'dim'); return; }
    const grp = {}; for (const k of sh.cmds.values()) (grp[k.group || 'other'] = grp[k.group || 'other'] || []).push(k);
    for (const g in grp) { say(g, 'head'); sh.table(grp[g].map(k => [k.name, k.about])); }
    say('Tab completes from the live game. ; chains commands. help <command> for detail.', 'dim');
  }, { group: 'shell', also: ['?'] });
  sh.reg('clear', 'empty this window', () => term.clear(), { group: 'shell', also: ['cls'] });
  sh.reg('close', 'put the terminal away (Esc)', () => term.hide(), { group: 'shell' });
  sh.reg('alias <name:str> [command:str...]', 'your own command, kept for next time', ([n, ...r], f, raw) => {
    if (!r.length) { delete sh.userAlias[n]; say(`alias ${n} removed`); persist(); return; }
    sh.userAlias[n] = tail(raw, 2); persist(); say(`${n} = ${sh.userAlias[n]}`, 'ok');
  }, { group: 'shell', more: ['alias lambo-test spawn lambo --paint=verde --drive; time 18:30; weather clear'] });
  sh.reg('bind [key:key] [command:str...]', 'run a command on a key. No arguments lists them', ([k, ...r], f, raw) => {
    if (!k) { const e = Object.entries(binds); if (!e.length) say('nothing bound'); else sh.table(e); return; }
    if (!r.length) { delete binds[k]; persist(); say(`${k} unbound`); return; }
    binds[k] = tail(raw, 2); persist(); say(`${k} → ${binds[k]}`, 'ok');
  }, { group: 'shell', more: ['Keys are KeyboardEvent codes: F2, KeyG, Digit1. bind F2 "spawn super --drive"'] });
  sh.reg('autoexec [command:str...]', 'run commands whenever free roam starts. "autoexec clear" empties it', (a, f, raw) => {
    if (!a.length) { if (!autoexec.length) say('nothing'); else autoexec.forEach((l, i) => say(`${i}  ${l}`)); return; }
    if (a[0] === 'clear') { autoexec.length = 0; persist(); say('emptied'); return; }
    autoexec.push(tail(raw, 1)); persist(); say(`added: ${autoexec[autoexec.length - 1]}`, 'ok');
  }, { group: 'shell' });
  sh.reg('repeat <n:int> <command:str...>', 'the same command n times', async ([n, ...r], f, raw) => {
    const c = tail(raw, 2); if (!r.length) return;
    for (let i = 0; i < Math.min(+n, 200); i++) await sh.exec(c, true);
  }, { group: 'shell' });
  sh.reg('after <seconds:num> <command:str...>', 'run a command later, on game frames', ([s], f, raw) => { St.timers.push({ t: +s, c: tail(raw, 2) }); say(`in ${s} s`); }, { group: 'shell' });
  sh.reg('history', 'what you have typed', () => term.hist.slice(-30).forEach(l => say(l)), { group: 'shell' });

  // ------------------------------------------------------------ the world's live objects
  sh.reg('get <path:path>', 'read anything in the running game', ([p]) => say(`${p} = ${fmt(walk(p).value)}`), { group: 'live', more: ['Roots: G (game) W (world) P (player) T (traffic) V (what you drive) L (life) gfx TYPES SPECS', 'get T.list.length', 'get V.spec.vTop'] });
  sh.reg('set <path:path> <value:str>', 'write anything in the running game', ([p, v]) => { const r = walk(p); if (!r.parent) throw new Error('that is a root'); const was = r.parent[r.key]; r.parent[r.key] = lit(v); say(`${p}: ${fmt(was)} → ${fmt(r.parent[r.key])}`, 'ok'); }, { group: 'live', more: ['set T.max 200', 'set P.foot.v 12'] });
  sh.reg('call <path:path> [args:str...]', 'call a function in the running game', ([p, ...a]) => { const r = walk(p); if (typeof r.value !== 'function') throw new Error('not a function'); say(fmt(r.value.apply(r.parent, a.map(lit)))); }, { group: 'live' });
  sh.reg('ls <path:path>', 'what an object has in it', ([p]) => {
    const o = walk(p).value; if (o === null || typeof o !== 'object') { say(fmt(o)); return; }
    sh.table(Object.keys(o).slice(0, 200).map(k => { let q; try { q = o[k]; } catch (e) { q = '?'; } return [k, typeof q, fmt(q).slice(0, 90)]; }));
  }, { group: 'live' });
  sh.reg('watch [path:path]', 'pin a live value to the readout. No argument clears them', ([p]) => { if (!p) { St.watches.length = 0; say('cleared'); return; } walk(p); St.watches.push(p); say(`watching ${p}`, 'ok'); }, { group: 'live' });
  sh.reg('js <code:str...>', 'run JavaScript with G W P T V L in scope', (a, f, raw) => {
    const r = roots(), code = raw.replace(/^js\s+/, ''), keys = ['G', 'W', 'P', 'T', 'V', 'L'];
    let fn; try { fn = new Function(...keys, `return (${code});`); } catch (e) { fn = new Function(...keys, code); }
    say(fmt(fn(...keys.map(k => r[k]))));
  }, { group: 'live', more: ['js T.list.filter(o => o.type === "super").length'] });

  // ------------------------------------------------------------ vehicles
  sh.reg('roster', 'every vehicle: what it is, how fast, how common, how many are out', () => {
    const live = {}; for (const o of T().list) live[o.type] = (live[o.type] || 0) + 1;
    const s = share(), rows = [];
    for (const k of Object.keys(SPECS)) {
      const S = SPECS[k]; if (S.alias) continue;
      const pct = TYPES[k] ? (s[k]*100).toFixed(s[k] < .01 ? 2 : 1) + '%' : '-';
      rows.push([k, S.name, S.model, Math.round(S.vTop*3.6) + ' km/h', pct, St.rates[k] !== undefined ? St.rates[k] + '×' : '', TYPES[k] ? live[k] || 0 : '-', Object.keys(NICK).filter(n => NICK[n] === k).slice(0, 3).join(' ')]);
    }
    sh.table(rows, ['type', 'name', 'model', 'top', 'spawn', 'rate', 'live', 'also']);
    say('spawn is the base chance on an ordinary road: neighbourhoods and the hour change it too.', 'dim');
  }, { group: 'vehicles' });
  sh.reg('spawn <vehicle:vehicle> [count:int] [--paint:paint] [--drive]', 'put a vehicle in front of you', ([t, n], f) => {
    const type = vehType(t), count = Math.min(Math.max(1, +n || 1), 24), paint = f.paint ? paintOf(f.paint) : null; let v;
    for (let i = 0; i < count; i++) v = make(type, paint, 7 + Math.floor(i/4)*7, (i % 4 - 1.5)*(count > 1 ? 3.2 : 0));
    say(`${count} × ${SPECS[type].name} (${SPECS[type].model})`, 'ok');
    if (f.drive) { const d = P().dropped.find(q => q.veh === v); if (!P().onFoot) P().exit(T(), true); P().enter({ kind: 'dropped', d, now: true }, T()); if (G.rig) G.rig.inited = false; }
  }, { group: 'vehicles', more: ['spawn lambo --paint=verde --drive', 'spawn porsche 4 --paint=#b7bcc2'] });
  sh.reg('drive <vehicle:vehicle> [--paint:paint]', 'spawn one and get in', ([t], f) => sh.exec(`spawn ${t}${f.paint ? ' --paint=' + f.paint : ''} --drive`, true), { group: 'vehicles' });
  sh.reg('despawn', 'take away everything you spawned', () => say(`${removeSpawned()} removed`), { group: 'vehicles' });
  sh.reg('exit', 'get out', () => { if (!P().onFoot) P().exit(T(), true); }, { group: 'vehicles' });
  sh.reg('fix', 'repair and refuel what you are driving', () => { const v = P().cur; if (P().onFoot) throw new Error('on foot'); v.dmg = 0; v.fuel = 1; say('good as new', 'ok'); }, { group: 'vehicles' });
  sh.reg('paint <colour:paint>', 'respray what you are driving', ([c]) => { if (P().onFoot) throw new Error('on foot'); const v = P().cur, p = paintOf(c); v.paint = p; v.bodyMesh.instanceColor.setXYZ(0, p[0], p[1], p[2]); v.bodyMesh.instanceColor.needsUpdate = true; say('sprayed', 'ok'); }, { group: 'vehicles' });
  sh.reg('tune <key:spec> <value:num>', 'change this one vehicle: vTop (m/s), acc, brake, mu…', ([k, n]) => { if (P().onFoot) throw new Error('on foot'); const v = P().cur; if (typeof v.spec[k] !== 'number') throw new Error('no such number. Tab lists them'); const was = v.spec[k]; v.spec = { ...v.spec, [k]: +n }; say(`${k}: ${fmt(was)} → ${n}`, 'ok'); }, { group: 'vehicles' });
  sh.reg('rate <vehicle:rate> [multiplier:num]', 'how common a vehicle is in traffic. No multiplier resets it', ([t, m]) => {
    const k = t === '*' ? '*' : vehType(t);
    if (m === undefined) delete St.rates[k]; else St.rates[k] = +m;
    applyRates(); const s = share();
    say(k === '*' ? 'everything scaled' : `${k}: ${(s[k]*100).toFixed(1)}% of what spawns from now on (was ${(s._b[k]/Object.values(s._b).reduce((a, b) => a + b, 0)*100).toFixed(2)}%)`, 'ok');
    say('Takes effect as cars are replaced. traffic flush does it now.', 'dim');
  }, { group: 'vehicles', more: ['rate super 500; traffic flush', 'rate * 0; rate lambo 1; traffic flush   (nothing but Lamborghinis)'] });
  sh.reg('only <vehicle:rate>', 'nothing else on the road, now', ([t]) => { const k = vehType(t); St.rates = { '*': 0, [k]: 1 }; applyRates(); flush(); say(`${k} only`, 'ok'); }, { group: 'vehicles' });
  sh.reg('traffic <what:flow> [value:num]', 'flush, density <n>, stop, go, census', ([w, n]) => {
    const t = T();
    if (w === 'flush') { flush(); say(`${t.list.length} on the road`, 'ok'); }
    else if (w === 'density') { if (!St.baseMax) St.baseMax = t.max; t.max = +n || St.baseMax; say(`up to ${t.max} at once`, 'ok'); }
    else if (w === 'stop') { St.trafficStop = true; say('stopped', 'ok'); }
    else if (w === 'go') { St.trafficStop = false; say('moving', 'ok'); }
    else if (w === 'census') { const c = {}; for (const o of t.list) c[o.type] = (c[o.type] || 0) + 1; sh.table(Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, (v/t.list.length*100).toFixed(1) + '%']), ['type', 'n', 'share']); }
    else throw new Error('flush, density, stop, go or census');
  }, { group: 'vehicles' });

  // ------------------------------------------------------------ where you are
  sh.reg('tp <where:place|at> [z:str...]', 'teleport. Names, x z, ~dx ~dz, ^right ^forward, @super, @wp, #n from find', async (a) => { const t = target(a), r = await go(t); say(`${t.name || ''} (${r.x.toFixed(1)}, ${r.z.toFixed(1)})`, 'ok'); }, { group: 'world', more: ['tp fc road', 'tp ~ ~200', 'tp ^0 ^50', 'tp @super'] });
  sh.reg('find <name:place> [more:str...]', 'search every place in Pune', (a) => {
    found = search(a.join(' '), 15);
    if (!found.length) { say('nothing'); return; }
    sh.table(found.map((p, i) => ['#' + i, p.n, p.c, Math.round(Math.hypot(p.x - P().x, p.z - P().z)) + ' m', `${p.x.toFixed(0)} ${p.z.toFixed(0)}`]));
    say('tp #0 goes to the first.', 'dim');
  }, { group: 'world' });
  sh.reg('where', 'your position, road, area', () => {
    const Pl = P(), e = W().graph?.nearest?.(Pl.x, Pl.z, 40), name = e && W().graph.names?.[e.e?.name]?.[0];
    say(`x ${Pl.x.toFixed(1)}  z ${Pl.z.toFixed(1)}  y ${Pl.y.toFixed(2)}  th ${Pl.th.toFixed(3)}  ${Pl.onFoot ? 'on foot' : Pl.cur.type}`);
    const z = T().zoneAt?.(Pl.x, Pl.z); say(`${name || 'off-road'} · traffic zone: ${z || 'ordinary'}`, 'dim');
  }, { group: 'world' });
  sh.reg('time [when:str]', 'set the hour: 21:30 or 21.5. "time lock" holds it, "time unlock" lets it go', ([w]) => {
    if (w === undefined) { const h = G.hour; say(`${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(h%1*60)).padStart(2, '0')}${St.hourLock !== null ? ' (locked)' : ''}`); return; }
    if (w === 'lock') { St.hourLock = G.hour; say('held', 'ok'); return; } if (w === 'unlock') { St.hourLock = null; say('running', 'ok'); return; }
    const m = /^(\d{1,2}):(\d{2})$/.exec(w), h = m ? +m[1] + +m[2]/60 : +w;
    if (!Number.isFinite(h) || h < 0 || h >= 24) throw new Error('21:30 or 21.5');
    G.setHour(h); if (St.hourLock !== null) St.hourLock = h; say(`it is ${w}`, 'ok');
  }, { group: 'world' });
  sh.reg('weather <kind:weather>', 'clear, cloudy, haze, rain, storm, fog', ([k]) => { if (!WEATHERS[k]) throw new Error(Object.keys(WEATHERS).join(', ')); G.weather.set(k); say(k, 'ok'); }, { group: 'world' });
  sh.reg('timescale <x:num>', 'slow motion or fast forward', ([x]) => { St.scale = Math.max(0, Math.min(16, +x)); say(`${St.scale}×`, 'ok'); }, { group: 'world', also: ['ts'] });

  // ------------------------------------------------------------ you
  sh.reg('god [on:onoff]', 'no damage, no hunger, full tank', ([a]) => { St.god = onoff(a, St.god); say(`god ${St.god ? 'on' : 'off'}`, 'ok'); }, { group: 'you' });
  sh.reg('noclip [on:onoff]', 'walk and drive through walls', ([a]) => { St.noclip = onoff(a, St.noclip); say(`noclip ${St.noclip ? 'on' : 'off'}`, 'ok'); }, { group: 'you' });
  sh.reg('fly [on:onoff]', 'detached camera: WASD, Q down, E up, Shift fast, the mouse looks', ([a]) => setFly(onoff(a, !!St.fly)), { group: 'you' });
  sh.reg('run <multiplier:num>', 'how fast you run', ([m]) => { St.foot = +m; say(`${m}×`, 'ok'); }, { group: 'you' });
  sh.reg('money <amount:int>', 'set your cash', ([n]) => { G.stats.money = +n; say(`₹${(+n).toLocaleString('en-IN')}`, 'ok'); }, { group: 'you' });
  sh.reg('give <item:item> [count:int]', 'put something in the jhola', ([k, n]) => { if (!ITEMS[k]) throw new Error('no such item. Tab lists them'); const L = G.life.s; L.inv = L.inv || {}; L.inv[k] = (L.inv[k] || 0) + (+n || 1); say(`${ITEMS[k].name} × ${L.inv[k]}`, 'ok'); }, { group: 'you' });
  sh.reg('stat <name:stat> [value:num]', 'hunger, thirst, energy, mood, respect…', ([k, v]) => { const L = G.life.s; if (v === undefined) { say(`${k} = ${fmt(L[k])}`); return; } L[k] = +v; say(`${k} = ${v}`, 'ok'); }, { group: 'you' });
  sh.reg('wanted <level:int>', 'police heat, 0 to 5', ([n]) => {
    const p = G.police, k = Math.max(0, Math.min(5, +n));
    p.pts = HEAT[k]; p.heat = k; p.unseenT = 0; p.lastSeen = { x: P().x, z: P().z };
    if (k === 0) { p.clearCharges?.(); p.clearMarshals?.(); G.hud.setHeat?.(0); } else p.charges?.add?.('theft');
    say(`heat ${k}`, 'ok');
  }, { group: 'you' });

  // ------------------------------------------------------------ the picture
  const lv = { lite: 0, low: 1, medium: 2, med: 2, high: 3, veryhigh: 4, ultra: 5 };
  sh.reg('gfx [setting:setting] [level:int]', 'every graphics setting, or pin one to a level 0-5', ([id, n]) => {
    const g = G.gfx;
    if (!id) { sh.table(SETTINGS.filter(s => s.id).map(s => { const L = g.level(s.id), v = s.val[L]; let t; try { t = s.fmt ? s.fmt(v) : fmt(v); } catch (e) { t = fmt(v); } return [s.id, s.label, 'L' + L, g.pin[s.id] !== undefined ? 'pinned' : '', t]; })); return; }
    if (id === 'reset') { g.pin = {}; g.save(); g.applyAll(); say('as the preset says', 'ok'); return; }
    if (!SETTINGS.some(s => s.id === id)) throw new Error('no such setting. Tab lists them');
    g.choose(id, n === undefined ? 'auto' : Math.max(0, Math.min(5, +n))); say(`${id} → ${n === undefined ? 'auto' : 'L' + n}`, 'ok');
  }, { group: 'picture' });
  sh.reg('preset <name:preset>', 'auto, lite, low, medium, high, veryhigh, ultra', ([n]) => { if (n !== 'auto' && lv[n] === undefined) throw new Error('auto, lite, low, medium, high, veryhigh, ultra'); G.gfx.choose('all', n === 'auto' ? 'auto' : lv[n]); say(n, 'ok'); }, { group: 'picture' });
  sh.reg('stats', 'what the renderer is drawing right now', () => { const s = window.__nh?.stats?.() || {}; sh.table(Object.entries(s).map(([k, v]) => [k, fmt(v)])); }, { group: 'picture' });
  sh.reg('readout [on:onoff]', 'the numbers top left', ([a]) => { St.hud = onoff(a, St.hud); tel.hidden = !St.hud; }, { group: 'picture', also: ['hud'] });

  // ------------------------------------------------------------ checking the terminal itself
  sh.reg('doctor', 'test every hook this terminal has into the game, and say which work', async () => {
    const check = async (name, f) => { try { const r = await f(); if (r === false) throw new Error('no'); say(`PASS  ${name}`, 'ok'); return 1; } catch (e) { say(`FAIL  ${name}: ${e && e.message || e}`, 'err'); return 0; } };
    const tests = [
      ['player and position', () => Number.isFinite(P().x) && Number.isFinite(P().th)],
      ['surface height', () => Number.isFinite(W().surf.height(P().x, P().z))],
      ['safe spot near you', () => { G.safeDrop(P().x, P().z); }],
      ['tile loader', () => typeof W().tiles?.ensure === 'function'],
      ['streamer', () => typeof W().streamer.warm === 'function'],
      ['traffic list and prefill', () => Array.isArray(T().list) && typeof T().prefill === 'function'],
      ['spawn weights', () => TYPES.super.w > 0 && typeof T().pickType === 'function'],
      ['places indexed', () => { const n = allPlaces().length; say(`      ${n} places`, 'dim'); return n > 0; }],
      ['camera rig', () => !!G.rig.cam],
      ['time', () => typeof G.setHour === 'function'],
      ['weather', () => typeof G.weather.set === 'function'],
      ['police', () => typeof G.police.raiseHeat === 'function' && 'pts' in G.police],
      ['life stats', () => typeof G.life.s.hunger === 'number'],
      ['graphics', () => typeof G.gfx.choose === 'function' && typeof G.gfx.level === 'function'],
      ['renderer stats', () => !!window.__nh?.stats],
      ['saves are shut', () => { let wrote = 0; const st = Storage.prototype.setItem; Storage.prototype.setItem = function (...a) { wrote++; return st.apply(this, a); }; try { G.life.save(); } finally { Storage.prototype.setItem = st; } return wrote === 0; }],
    ];
    let ok = 0; for (const [n, f] of tests) ok += await check(n, f);
    for (const k of Object.keys(SPECS)) { if (SPECS[k].alias) continue; ok += await check(`build ${k}`, () => { const v = make(k, null, 12); const tris = (v.bodyMesh.geometry.index ? v.bodyMesh.geometry.index.count : v.bodyMesh.geometry.attributes.position.count)/3; const Pl = P(), d = Pl.dropped.find(q => q.veh === v); Pl.removeDropped(d, T()); St.spawned.splice(St.spawned.indexOf(v), 1); v.dispose(); say(`      ${Math.round(tris).toLocaleString()} triangles`, 'dim'); }); }
    const total = tests.length + Object.keys(SPECS).filter(k => !SPECS[k].alias).length;
    say(`${ok}/${total} passed`, ok === total ? 'ok' : 'err');
  }, { group: 'shell' });

  // ------------------------------------------------------------ the terminal and its readout
  const term = new Terminal(sh, {
    onOpen: () => { G.input?.keys?.clear(); G.input?.pressed?.clear(); G.releaseMouse?.(); },
    onClose: () => { G.input?.keys?.clear(); G.input?.pressed?.clear(); G.lockMouse?.(); },
  });
  sh.order = ['vehicles', 'world', 'you', 'picture', 'live', 'shell', 'yours'];
  // the "click to take the mouse" hint has no business showing while you're typing
  const lockHint = G.hud?.setLockHint?.bind(G.hud);
  if (lockHint) G.hud.setLockHint = (on) => lockHint(on && !term.open);
  const tel = document.createElement('pre'); tel.className = 'nhc-tel'; tel.hidden = true; document.body.appendChild(tel);
  const fps = { n: 0, t: 0, low: 0, cur: 0, ms: 0, worst: 0 };
  function readout() {
    const Pl = P(), s = window.__nh?.stats?.() || {}, n = (v) => v === undefined ? '-' : v >= 1e6 ? (v/1e6).toFixed(2) + 'M' : v >= 1e3 ? (v/1e3).toFixed(1) + 'k' : v;
    const hh = G.hour || 0, lines = [
      `${fps.cur.toFixed(0).padStart(3)} fps  ${fps.ms.toFixed(1)} ms  worst ${fps.worst.toFixed(1)} ms`,
      `calls ${n(s.calls)}  tris ${n(s.tris)}  chunks ${n(s.chunks)}`,
      `xz ${Pl.x.toFixed(0)} ${Pl.z.toFixed(0)}  ${(Math.abs(Pl.v || 0)*3.6).toFixed(0)} km/h  ${Pl.onFoot ? 'foot' : Pl.cur.type}`,
      `${String(Math.floor(hh)).padStart(2, '0')}:${String(Math.floor(hh%1*60)).padStart(2, '0')}${St.hourLock !== null ? ' lock' : ''}  ${G.weather?.kind || ''}  traffic ${T().list.length}/${T().max}${St.scale !== 1 ? `  ${St.scale}×` : ''}`,
    ];
    const flags = [St.god && 'god', St.noclip && 'noclip', St.fly && 'fly', St.foot !== 1 && `run ${St.foot}×`, Object.keys(St.rates).length && `rates ${Object.entries(St.rates).map(([k, v]) => `${k}:${v}`).join(' ')}`].filter(Boolean);
    if (flags.length) lines.push(flags.join('  '));
    for (const w of St.watches) { let v; try { v = fmt(walk(w).value); } catch (e) { v = '×'; } lines.push(`${w} = ${v}`); }
    tel.textContent = lines.join('\n');
  }

  // ------------------------------------------------------------ what runs every frame
  function setFly(on) {
    const rig = G.rig, Pl = P();
    if (on === !!St.fly) return;
    if (on) {
      const c = rig.cam, f = St.fly = { x: c.position.x, y: c.position.y, z: c.position.z, up: rig.update, foot: rig.updateFoot, focus: G.focus, v: null };
      rig.footMode = true; rig.footYaw = Pl.th;
      const place = (dt) => {
        const k = G.input.keys, sp = (k.has('ShiftLeft') ? 90 : 18)*dt, yaw = rig.footYaw, pit = rig.footPitch || 0, cp = Math.cos(pit);
        const fx = Math.cos(yaw)*cp, fy = -Math.sin(pit), fz = Math.sin(yaw)*cp, rx = -Math.sin(yaw), rz = Math.cos(yaw);
        const F = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), R = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0), U = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
        f.x += (fx*F + rx*R)*sp; f.y += (fy*F + U)*sp; f.z += (fz*F + rz*R)*sp;
        c.position.set(f.x, f.y, f.z); c.lookAt(f.x + fx, f.y + fy, f.z + fz);
      };
      rig.update = rig.updateFoot = place;
      G.focus = () => c.position;                        // (the city streams in round the camera)
      Pl.frozen = true;
    } else {
      const f = St.fly; St.fly = null;
      rig.update = f.up; rig.updateFoot = f.foot; G.focus = f.focus; Pl.frozen = false; rig.inited = false;
    }
    say(`fly ${on ? 'on' : 'off'}`, 'ok');
  }
  function tick(dt, raw) {
    fps.n++; fps.t += raw; fps.worst = Math.max(fps.worst, raw*1000);
    if (fps.t >= 0.5) { fps.cur = fps.n/fps.t; fps.ms = fps.t/fps.n*1000; readout(); fps.n = 0; fps.t = 0; fps.worst = 0; }
    if (St.hourLock !== null) G.hour = St.hourLock;
    const Pl = P();
    if (St.god) {
      Pl.hp = 100; Pl.ko = false;
      const L = G.life?.s; if (L) { L.hunger = 1; L.thirst = 1; L.energy = 1; }
      if (!Pl.onFoot) { Pl.cur.dmg = 0; Pl.cur.fuel = 1; }
    }
    if (St.trafficStop) for (const o of T().list) { o.v = 0; o.argue = Math.max(o.argue || 0, 0.5); }
    for (let i = St.timers.length - 1; i >= 0; i--) { const t = St.timers[i]; t.t -= dt; if (t.t <= 0) { St.timers.splice(i, 1); sh.exec(t.c, true); } }
  }
  // the hooks go in once and do nothing outside free roam
  let hooked = false;
  function hook() {
    if (hooked) return; hooked = true;
    const frame = G.frame.bind(G), fixed = G.fixed.bind(G);
    G.frame = (dt) => { if (!armed) return frame(dt); const r = frame(dt*St.scale); try { tick(dt*St.scale, dt); } catch (e) { console.warn('terminal', e); } return r; };
    G.fixed = (h) => fixed(armed ? h*St.scale : h);
    const C = W().collision, res = C.resolve.bind(C);
    C.resolve = (...a) => armed && St.noclip ? null : res(...a);
    const Pl = P(), mul = Pl.sprintMul; Pl.sprintMul = () => (mul ? mul() : 1)*(armed ? St.foot : 1);
    // the shut saves: nothing written during free roam, whatever the terminal did to you
    const Lf = G.life, ls = Lf.save.bind(Lf); Lf.save = () => { if (!armed) ls(); };
    const ss = G.saveStats.bind(G); G.saveStats = (...a) => armed ? undefined : ss(...a);
    const S = G.debugSave?.Save; if (S && S.save) { const o = S.save; S.save = function (...a) { return armed ? undefined : o.apply(this, a); }; }
  }

  // ------------------------------------------------------------ keys
  window.addEventListener('keydown', (e) => {
    if (!armed || G.state !== 'play' && !term.open) return;
    if (term.open) { if (e.target !== term.input) { term.input.focus(); } return; }
    if (e.repeat) return;
    if (e.code === 'Slash' || e.code === 'Backquote') { e.preventDefault(); e.stopImmediatePropagation(); term.show(); return; }
    if (binds[e.code]) { e.preventDefault(); e.stopImmediatePropagation(); sh.exec(binds[e.code], true); }
  }, true);

  // ------------------------------------------------------------ in and out
  function arm() {
    if (armed) return; armed = true; hook();
    tel.hidden = !St.hud; readout();
    term.clear();
    say('Free roam terminal. Nothing here reaches your own game.', 'head');
    say('Every command is in the list. Type to narrow it, Tab or a click to take one.', 'dim');
    say('Try: spawn lambo --paint=verde --drive   ·   rate super 500; traffic flush   ·   tp fc road', 'dim');
    for (const l of autoexec) St.timers.push({ t: 0.5, c: l });
  }
  function disarm() {
    if (!armed) return;
    if (St.fly) setFly(false);
    removeSpawned();
    St.rates = {}; if (St.baseW) { for (const k in TYPES) TYPES[k].w = St.baseW[k]; St.baseW = null; }
    if (St.baseMax) { T().max = St.baseMax; St.baseMax = 0; }
    Object.assign(St, { god: false, noclip: false, hourLock: null, scale: 1, watches: [], timers: [], foot: 1, trafficStop: false });
    term.hide(); tel.hidden = true; armed = false; St.hud = false;
  }
  const leave = G.leaveFree.bind(G);
  G.leaveFree = () => { const r = leave(); disarm(); return r; };
  const begin = G.beginFree.bind(G);
  G.beginFree = (...a) => { arm(); const r = begin(...a); setTimeout(() => { if (armed) G.hud?.toast?.('Terminal', 'Press / any time in free roam', 'info', 5); }, 1500); return r; };
  G.terminal = { sh, term, arm, disarm };
}
