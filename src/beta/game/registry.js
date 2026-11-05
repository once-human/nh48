// The terminal's reach into everything. Three ideas, and every command is built from them:
//   variables  every number and switch in the game under one name: player.karma, world.hour, police.heat, gfx.shadows.
//              get / set / add / reset / toggle / vars. Found from the live game, so a stat added later is there too.
//   selectors  who a command acts on, the way Minecraft has them: @me @look @near @near:8 @all @cop @named @animal
//              @dog @cow @cat @car @veh @last #42. Every person verb takes one.
//   systems    every part of the game (story, date, police, gym, shops, rides, phone…) as a root for get / set / call /
//              ls, with tab completion of what each one has.
// On top: npc (people), animal, anim (any clip on anyone), test (each animation set up and played on its own),
// snapshot (a moment saved and gone back to), hud.
import { facing } from './ask.js';

const r2 = (v) => Math.round(v*100)/100;
export function registry(C) {
  const { G, sh, say, St, make, go, target, fmt, lit } = C;
  const P = () => G.player, T = () => G.traffic, ppl = () => G.people;
  const R = () => P().onFoot ? P().foot : P();

  // ------------------------------------------------------------ variables
  // name → { get, set, about, kind: 'num' | 'bool' | 'str', min, max, def }
  const V = new Map();
  const v = (name, about, get, set, o = {}) => V.set(name, { name, about, get, set, kind: o.kind || 'num', min: o.min, max: o.max, opts: o.opts, def: undefined });
  const clamp = (x, o) => Math.max(o.min ?? -Infinity, Math.min(o.max ?? Infinity, x));
  function build() {
    V.clear();
    const L = G.life?.s || {};
    // the body and the name you have: every number and switch life keeps (karma, respect, hunger…), found live
    const LIFE = { hunger: 'full 1, starving 0', thirst: 'full 1', energy: 'rested 1', mood: 'happy 1', respect: 'street cred', karma: 'good − bad', fitness: 'gym work', drunk: '0 sober' };
    for (const k of Object.keys(L)) {
      const t = typeof L[k]; if (t !== 'number' && t !== 'boolean') continue;
      const unit = t === 'number' && L[k] >= 0 && L[k] <= 1 && !/karma|respect/.test(k);
      v('player.' + k, LIFE[k] || 'life', () => G.life.s[k], (x) => { G.life.s[k] = x; }, { kind: t === 'boolean' ? 'bool' : 'num', min: unit ? 0 : undefined, max: unit ? 1 : undefined });
    }
    v('player.money', 'cash, ₹', () => G.stats.money, (x) => { G.stats.money = Math.round(x); });
    v('player.hp', 'health, 0 to 100', () => P().hp ?? 100, (x) => { P().hp = x; }, { min: 0, max: 100 });
    v('player.wanted', 'police heat 0 to 5', () => G.police?.heat || 0, (x) => sh.exec(`player wanted ${Math.round(x)}`, true), { min: 0, max: 5 });
    v('player.x', 'east, m', () => R().x, (x) => sh.exec(`tp ${x} ${R().z}`, true));
    v('player.z', 'south, m', () => R().z, (z) => sh.exec(`tp ${R().x} ${z}`, true));
    v('player.yaw', 'facing, radians', () => P().onFoot ? P().foot.yaw : P().th, (a) => { if (P().onFoot) P().foot.yaw = a; });
    v('player.run', 'run speed multiplier', () => St.foot, (x) => { St.foot = x; }, { min: 0.1, max: 20 });
    v('player.god', 'no damage, no hunger', () => St.god, (x) => { St.god = x; }, { kind: 'bool' });
    v('player.noclip', 'through walls', () => St.noclip, (x) => { St.noclip = x; }, { kind: 'bool' });
    v('player.fly', 'flying', () => !!St.flight, (x) => sh.exec(`fly ${x ? 'on' : 'off'}`, true), { kind: 'bool' });
    v('player.flyspeed', 'flight speed ×', () => St.flySpeed, (x) => { St.flySpeed = x; }, { min: 0.1, max: 20 });
    for (const k of Object.keys(G.stats || {})) if (typeof G.stats[k] === 'number' && k !== 'money') v('stats.' + k, 'career', () => G.stats[k], (x) => { G.stats[k] = x; });
    v('world.hour', 'time of day, 0 to 24', () => G.hour, (h) => { G.setHour(((h % 24) + 24) % 24); if (St.hourLock !== null) St.hourLock = G.hour; }, { min: 0, max: 23.99 });
    v('world.hourlock', 'hold the hour', () => St.hourLock !== null, (x) => { St.hourLock = x ? G.hour : null; }, { kind: 'bool' });
    v('world.timescale', 'speed of everything ×', () => St.scale, (x) => { St.scale = x; }, { min: 0, max: 16 });
    v('world.weather', 'the sky', () => G.weather?.kind, (k) => G.weather.set(k), { kind: 'str', opts: () => Object.keys(C.WEATHERS || {}) });
    v('traffic.density', 'vehicles at once', () => T().max, (n) => { if (!St.baseMax) St.baseMax = T().max; T().max = Math.round(n); }, { min: 0, max: 400 });
    v('traffic.stop', 'everyone stands', () => !!St.trafficStop, (x) => { St.trafficStop = x; }, { kind: 'bool' });
    v('people.count', 'people out now (read only)', () => ppl().list.length, () => { throw new Error('read only: npc spawn / npc remove'); });
    v('police.heat', 'wanted level 0 to 5', () => G.police?.heat || 0, (x) => sh.exec(`player wanted ${Math.round(x)}`, true), { min: 0, max: 5 });
    v('police.pts', 'heat points', () => G.police?.pts || 0, (x) => { G.police.pts = x; });
    v('cam.fov', 'field of view °, 0 = the camera\'s own', () => St.fov, (x) => { St.fov = x; }, { min: 0, max: 140 });
    for (const s of C.SETTINGS || []) if (s.id) v('gfx.' + s.id, s.label + ', level 0 to 5', () => G.gfx.level(s.id), (x) => G.gfx.choose(s.id, Math.round(x)), { min: 0, max: 5 });
    // a vehicle's every number while you're in one
    const cur = !P().onFoot && P().cur;
    if (cur && cur.spec) for (const k of Object.keys(cur.spec)) if (typeof cur.spec[k] === 'number') v('vehicle.' + k, 'this vehicle', () => P().cur.spec[k], (x) => { P().cur.spec = { ...P().cur.spec, [k]: x }; });
    if (cur) { v('vehicle.fuel', 'tank 0 to 1', () => P().cur.fuel, (x) => { P().cur.fuel = x; }, { min: 0, max: 1 }); v('vehicle.damage', 'damage 0 to 1', () => P().cur.dmg || 0, (x) => { P().cur.dmg = x; }, { min: 0, max: 1 }); }
    for (const e of V.values()) if (e.def === undefined) { try { e.def = e.get(); } catch (err) { /* not there yet */ } }
  }
  const DEF = new Map();          // what each was when free roam began, for reset
  const varOf = (n) => { if (!V.size || !V.has(n)) build(); return V.get(n); };
  const parse = (e, s) => {
    if (e.kind === 'bool') return s === 'on' || s === 'true' || s === '1' || s === 'yes';
    if (e.kind === 'str') return String(s);
    const n = +s; if (!Number.isFinite(n)) throw new Error(`${e.name} is a number`); return clamp(n, e);
  };
  const show = (e) => { let x; try { x = e.get(); } catch (err) { x = '?'; } return typeof x === 'number' ? r2(x) : String(x); };
  sh.type('var', (cur) => { build(); return [...V.values()].filter(e => e.name.startsWith(cur || '')).map(e => ({ v: e.name, note: `${show(e)} · ${e.about}` })); });
  sh.type('varval', () => []);
  const ext = (name) => varOf(name);
  // get / set first try a variable, and fall back to a raw path into the code (G.player.foot.x)
  const raw = { get: sh.cmds.get('get'), set: sh.cmds.get('set') };
  sh.reg('vars [prefix:var]', 'every variable and its value. vars player · vars gfx', ([pre = '']) => {
    build();
    const rows = [...V.values()].filter(e => e.name.startsWith(pre)).map(e => [e.name, show(e), e.about]);
    if (!rows.length) throw new Error('nothing starts with that'); sh.table(rows, ['variable', 'now', 'what']);
  }, { group: 'variables' });
  sh.reg('get <name:var|path>', 'a variable (player.karma) or anything in the code (P.foot.x)', (a, f, line) => {
    const e = ext(a[0]); if (!e) return raw.get.run(a, f, line);
    say(`${e.name} = ${show(e)}`);
  }, { group: 'variables', more: ['get player.karma', 'get world.hour', 'get P.foot.v   (a raw path: roots in help get)'] });
  sh.reg('set <name:var|path> <value:str>', 'set a variable (set player.karma 50) or anything in the code', (a, f, line) => {
    const e = ext(a[0]); if (!e) return raw.set.run(a, f, line);
    if (!DEF.has(e.name)) DEF.set(e.name, e.get());
    const was = show(e); e.set(parse(e, a[1])); say(`${e.name}: ${was} → ${show(e)}`, 'ok');
  }, { group: 'variables', more: ['set player.respect 80', 'set world.weather rain', 'set gfx.shadows 5', 'set player.god on'] });
  sh.reg('add <name:var> <amount:num>', 'add to a number (add player.money 5000 · add player.karma -10)', ([n, x]) => {
    const e = ext(n); if (!e || e.kind !== 'num') throw new Error('a number variable: vars lists them');
    if (!DEF.has(e.name)) DEF.set(e.name, e.get());
    const was = show(e); e.set(clamp(e.get() + +x, e)); say(`${e.name}: ${was} → ${show(e)}`, 'ok');
  }, { group: 'variables' });
  sh.reg('toggle <name:var>', 'flip a switch (toggle player.god)', ([n]) => { const e = ext(n); if (!e || e.kind !== 'bool') throw new Error('a switch'); e.set(!e.get()); say(`${e.name} ${e.get() ? 'on' : 'off'}`, 'ok'); }, { group: 'variables' });
  sh.reg('reset [name:var]', 'a variable back to what it was when free roam began. No name: all you changed', ([n]) => {
    const names = n ? [n] : [...DEF.keys()]; let k = 0;
    for (const m of names) { const e = ext(m); if (!e) continue; const d = DEF.has(m) ? DEF.get(m) : e.def; if (d === undefined) continue; e.set(d); DEF.delete(m); k++; }
    say(`${k} reset`, 'ok');
  }, { group: 'variables' });

  // ------------------------------------------------------------ selectors
  const people = () => ppl().list.filter(p => !p.hidden);
  const dist = (o) => Math.hypot(o.x - R().x, o.z - R().z);
  const byDist = (a) => a.sort((m, n) => dist(m) - dist(n));
  let last = [];
  function select(s) {
    if (!s) throw new Error('who? @me @look @near @near:8 @all @cop @named @animal @dog @cow @cat @car @veh @last #id');
    const m = /^@([a-z]+)(?::(\d+(?:\.\d+)?))?$/.exec(s), r = m && m[2] ? +m[2] : null, within = (a) => r ? a.filter(o => dist(o) <= r) : a;
    if (s[0] === '#') { const id = +s.slice(1), p = ppl().list.find(q => q.id === id); if (!p) throw new Error(`nobody is #${id}`); return [{ k: 'person', o: p }]; }
    if (!m) throw new Error(`"${s}" is not a selector`);
    const pick = (a, k) => { a = byDist(within(a)); if (!a.length) throw new Error(`nobody: ${s}`); return (r ? a : a.slice(0, 1)).map(o => ({ k, o })); };
    switch (m[1]) {
      case 'me': return [{ k: 'player', o: P() }];
      case 'look': {
        const F = R(), th = P().onFoot ? P().foot.yaw : P().th;
        let best = null, bs = 1e9; for (const p of people()) { const sc = facing(F.x, F.z, th, p.x, p.z, r || 6); if (sc < bs) { bs = sc; best = p; } }
        if (!best) throw new Error('nobody in front of you'); return [{ k: 'person', o: best }];
      }
      case 'near': return pick(people(), 'person');
      case 'all': return within(people()).map(o => ({ k: 'person', o }));
      case 'cop': return pick(people().filter(p => p.cop || p.police), 'person');
      case 'named': return pick(people().filter(p => p.name), 'person');
      case 'animal': return pick(ppl().animals.slice(), 'animal');
      case 'dog': case 'cow': case 'cat': return pick(ppl().animals.filter(a => a.kind === m[1]), 'animal');
      case 'car': return pick(T().list.slice(), 'vehicle');
      case 'veh': { if (P().onFoot) throw new Error('on foot'); return [{ k: 'vehicle', o: P().cur }]; }
      case 'last': if (!last.length) throw new Error('nothing spawned yet'); return last;
      default: throw new Error(`no selector @${m[1]}`);
    }
  }
  const SEL = ['@me', '@look', '@near', '@near:5', '@near:15', '@all', '@all:20', '@cop', '@named', '@animal', '@dog', '@cow', '@cat', '@car', '@veh', '@last'];
  sh.type('sel', (cur) => {
    const out = SEL.map(v => ({ v, note: 'selector' }));
    if (!cur || cur[0] === '#') for (const p of byDist(people()).slice(0, 12)) out.push({ v: '#' + p.id, note: `${p.name || p.persona || 'someone'} · ${Math.round(dist(p))} m · ${p.mode}${p.anim ? ' ' + p.anim : ''}` });
    return out;
  });
  const persons = (s) => { const a = select(s).filter(e => e.k === 'person'); if (!a.length) throw new Error('that picks no people'); return a.map(e => e.o); };
  const nameOf = (p) => p.name || G.talkUI?.nameOf?.(p) || p.persona || 'someone';

  // ------------------------------------------------------------ people
  const PERSONAS = ['kaka', 'ajoba', 'dada', 'bhaiya', 'collegeboy', 'kpguy', 'kaku', 'aaji', 'tai', 'aunty', 'collegegirl', 'kpgirl'];
  const FEM = new Set(['kaku', 'aaji', 'tai', 'aunty', 'collegegirl', 'kpgirl']);
  sh.type('persona', () => [...PERSONAS, 'cop'].map(v => ({ v, note: FEM.has(v) ? 'woman' : v === 'cop' ? 'police' : 'man' })));
  const ahead = (d, side = 0) => { const F = R(), th = P().onFoot ? P().foot.yaw : P().th, c = Math.cos(th), n = Math.sin(th); return { x: F.x + c*d - n*side, z: F.z + n*d + c*side, th }; };
  function spawnPerson(persona, i, f) {
    const kit = G.W.kit; if (!kit) throw new Error('the people kit is not loaded yet');
    const cop = persona === 'cop', per = cop ? 'kaka' : persona || PERSONAS[Math.floor(Math.random()*PERSONAS.length)];
    const female = f.female ? true : f.male ? false : FEM.has(per);
    const look = kit.randomLook(ppl().rng, cop ? { role: 'police' } : { female });
    const at = ahead(2.5 + Math.floor(i/4)*1.2, ((i % 4) - 1.5)*0.9);
    const p = ppl().spawnAt(look, at.x, at.z, per); if (!p) throw new Error('no footing there');
    p.yaw = at.th + Math.PI; if (cop) p.cop = true;
    p.mode = 'stand'; p.anchor = { x: p.x, z: p.z }; p.wait = 1e9; p.anim = null; p._spawned = true;
    return p;
  }
  sh.reg('npc spawn [persona:persona] [count:int] [--female] [--male]', 'people in front of you, facing you: kaka, aaji, collegegirl, dada, cop…', ([per, n], f) => {
    const out = []; for (let i = 0; i < Math.min(30, Math.max(1, +n || 1)); i++) out.push(spawnPerson(per, i, f));
    last = out.map(o => ({ k: 'person', o })); say(`${out.length} × ${per || 'anyone'}: ${out.map(p => '#' + p.id).join(' ')}`, 'ok');
  }, { group: 'people', also: ['summon'], more: ['npc spawn aaji', 'npc spawn dada 5', 'npc spawn cop 2', 'then: npc do @last dance'] });
  sh.reg('npc list [radius:num]', 'who is around: id, who, what they are doing', ([rad]) => {
    const a = byDist(people().filter(p => dist(p) <= (+rad || 30))).slice(0, 40);
    sh.table(a.map(p => ['#' + p.id, nameOf(p), p.persona || '', p.mode, p.anim || p.idle || '', Math.round(dist(p)) + ' m', p.hp !== undefined ? Math.round(p.hp) : '']), ['id', 'who', 'persona', 'mode', 'anim', 'away', 'hp']);
  }, { group: 'people' });
  sh.reg('npc info <who:sel>', 'everything about someone', ([s]) => {
    for (const p of persons(s)) { say(`#${p.id} ${nameOf(p)}`, 'head'); sh.table(Object.keys(p).filter(k => { const q = p[k]; return q !== null && (typeof q !== 'object' || Array.isArray(q) && q.length < 4) && typeof q !== 'function'; }).slice(0, 60).map(k => [k, fmt(p[k])])); }
  }, { group: 'people' });
  // what someone can be made to do. Each one is a body doing a thing, the way the game has them do it
  const DO = {
    idle: 'stand there', sit: 'sit down where they are', dance: 'dance', wave: 'wave', phone: 'on the phone', talk: 'talking', pray: 'hands together',
    arms_folded: 'arms folded', walk: 'back to walking their way', come: 'walk to you', follow: 'follow you about', flee: 'run from you', fight: 'come at you',
    freeze: 'stop dead, frozen', cheer: 'cheer', no: 'shake their head', yes: 'nod',
  };
  sh.type('action', () => Object.keys(DO).map(v => ({ v, note: DO[v] })));
  const hold = (p, anim) => { p.mode = 'stand'; p.anchor = { x: p.x, z: p.z }; p.wait = 1e9; p.anim = anim; p.v = 0; p.foe = null; p.goal = null; };
  sh.reg('npc do <who:sel> <action:action>', 'make them do it: sit dance wave phone follow flee fight freeze…', ([s, a]) => {
    if (!DO[a]) throw new Error(Object.keys(DO).join(' '));
    const ps = persons(s);
    for (const p of ps) {
      p.attend = null; p._was = null;
      if (a === 'walk') { p.anim = null; ppl().backToPath(p); }
      else if (a === 'come') { p.anim = null; ppl().goTo(p, R().x, R().z, (q) => hold(q, null)); }
      else if (a === 'follow') { p.anim = null; p._follow = true; }
      else if (a === 'flee') ppl().flee(p, R().x, R().z, 30);
      else if (a === 'fight') ppl().startFight(p, P());
      else if (a === 'freeze') { hold(p, null); p.fixed = true; }
      else hold(p, a === 'idle' ? null : a === 'cheer' ? 'wave' : a);
      if (a !== 'follow') p._follow = false;
    }
    say(`${ps.length} → ${a}`, 'ok');
  }, { group: 'people', more: ['npc do @look sit', 'npc do @all:10 dance', 'npc do #42 follow'] });
  sh.reg('npc kill <who:sel>', 'down for good', ([s]) => { const ps = persons(s); for (const p of ps) { p.fallen = 1e6; p.ko = true; p.corpse = true; p.hp = 0; p.v = 0; p.mode = 'stand'; } say(`${ps.length} down`, 'ok'); }, { group: 'people' });
  sh.reg('npc ko <who:sel> [seconds:num]', 'knocked out, gets up after', ([s, t]) => { const ps = persons(s); for (const p of ps) { p.fallen = +t || 8; p.ko = true; p.unconscious = true; p.v = 0; } say(`${ps.length} out cold`, 'ok'); }, { group: 'people' });
  sh.reg('npc heal <who:sel>', 'up again, whole', ([s]) => { const ps = persons(s); for (const p of ps) { p.fallen = 0; p.ko = false; p.corpse = false; p.unconscious = false; p.inj = null; p.limp = 0; if (p.hp0) p.hp = p.hp0; } say(`${ps.length} healed`, 'ok'); }, { group: 'people' });
  sh.reg('npc remove <who:sel>', 'gone from the world', ([s]) => { const ps = persons(s); for (const p of ps) ppl().remove(p); say(`${ps.length} removed`, 'ok'); }, { group: 'people' });
  sh.reg('npc bring <who:sel>', 'stand them in front of you', ([s]) => { const ps = persons(s); ps.forEach((p, i) => { const at = ahead(1.6 + Math.floor(i/4)*0.9, ((i % 4) - 1.5)*0.8); p.x = at.x; p.z = at.z; p.yaw = at.th + Math.PI; hold(p, null); }); say(`${ps.length} here`, 'ok'); }, { group: 'people' });
  sh.reg('npc goto <who:sel>', 'you, next to them', async ([s]) => { const [e] = select(s); await go({ x: e.o.x, z: e.o.z, name: '' }); say('there', 'ok'); }, { group: 'people' });
  sh.reg('npc say <who:sel> <text:str...>', 'words in their mouth, as subtitles', ([s, ...w]) => { for (const p of persons(s)) G.hud.say(nameOf(p), '', w.join(' '), 4); }, { group: 'people' });
  sh.reg('npc talk <who:sel>', 'open a conversation with them, wherever they are', ([s]) => { const [p] = persons(s); G.talkUI?.open(p, G.interiors?.inside ? G.interiors.cur : null); }, { group: 'people' });
  sh.reg('npc set <who:sel> <key:str> <value:str>', 'any field on them: npc set @look hp 10 · npc set #12 angry 5', ([s, k, x]) => { const ps = persons(s); for (const p of ps) p[k] = lit(x); say(`${ps.length} × ${k} = ${x}`, 'ok'); }, { group: 'people' });

  // ------------------------------------------------------------ animals
  sh.type('animal', () => [{ v: 'dog', note: 'street dog' }, { v: 'cow', note: 'cow' }, { v: 'cat', note: 'cat' }]);
  sh.reg('animal spawn <kind:animal> [count:int]', 'a dog, a cow or a cat by you', ([k, n]) => {
    if (!/^(dog|cow|cat)$/.test(k)) throw new Error('dog, cow or cat');
    const out = [];
    for (let i = 0; i < Math.min(20, +n || 1); i++) {
      const at = ahead(3 + i*1.5), near = G.nearest(at.x, at.z, 40); if (!near) break;
      const cow = k === 'cow', side = near.side || 1, e = near.e;
      const a = { kind: k, cow, e, s: near.s, side, lat: side*(e.w/2 + (cow ? -1.0 : 0.6)), dir: 1, speed: cow ? 0.35 : k === 'cat' ? 0.8 : 1.2, x: at.x, z: at.z, yaw: at.th, hx: 1, hz: 0, rest: 30, moving: false,
        col: cow ? [0.85, 0.82, 0.78] : [0.6, 0.4, 0.22], W: cow ? 0.7 : k === 'cat' ? 0.25 : 0.35, L: cow ? 2.2 : k === 'cat' ? 0.5 : 0.9, v: 0, _spawned: true };
      ppl().placeAnimal(a); a.x = at.x; a.z = at.z; ppl().animals.push(a); out.push(a);
    }
    last = out.map(o => ({ k: 'animal', o })); say(`${out.length} × ${k}`, 'ok');
  }, { group: 'animals' });
  sh.reg('animal list', 'the animals near you', () => sh.table(byDist(ppl().animals.slice()).slice(0, 30).map((a, i) => [i, a.kind, Math.round(dist(a)) + ' m', a.free ? 'following/chasing' : a.moving ? 'walking' : 'resting'])), { group: 'animals' });
  sh.reg('animal remove <which:sel>', 'take them away', ([s]) => { const a = select(s).filter(e => e.k === 'animal'); for (const e of a) { const i = ppl().animals.indexOf(e.o); if (i >= 0) { G.fauna?.release?.(e.o); ppl().animals.splice(i, 1); } } say(`${a.length} removed`, 'ok'); }, { group: 'animals' });
  sh.reg('animal follow <which:sel>', 'it follows you about', ([s]) => { for (const e of select(s)) if (e.k === 'animal') G.strays.free(e.o, { t: 120, follow: true }); say('following', 'ok'); }, { group: 'animals' });

  // ------------------------------------------------------------ animations
  const clips = () => Object.keys(P().human?.actions || {}).sort();
  sh.type('clip', () => clips().map(v => ({ v, note: 'clip' })));
  sh.reg('anim list [filter:str]', 'every animation the bodies have', ([q = '']) => { const a = clips().filter(c => c.includes(q)); say(a.join('  ')); say(`${a.length} clips`, 'dim'); }, { group: 'animation' });
  sh.reg('anim play <who:sel> <clip:clip> [--once] [--speed:num]', 'any clip on anyone: anim play @me dance · anim play @look sit', ([s, c], f) => {
    if (!clips().includes(c)) throw new Error('no such clip: anim list');
    for (const e of select(s)) {
      if (e.k === 'player') { const H = P().human; P()._animHold = f.once ? null : c; H.play(c, { fade: 0.25, once: !!f.once, restart: true, speed: +f.speed || 1 }); }
      else if (e.k === 'person') hold(e.o, c);
    }
    say(`${c}`, 'ok');
  }, { group: 'animation', also: ['anim'] });
  sh.reg('anim stop [who:sel]', 'back to what they would be doing', ([s = '@me']) => { for (const e of select(s)) { if (e.k === 'player') { P()._animHold = null; P().human.play('idle', { fade: 0.3 }); } else if (e.k === 'person') e.o.anim = null; } say('stopped', 'ok'); }, { group: 'animation' });
  sh.reg('anim speed <x:num>', 'your body\'s playback speed (0.1 to look at a move frame by frame)', ([x]) => { const H = P().human; H.mixer.timeScale = Math.max(0, +x); say(`${x}×`, 'ok'); }, { group: 'animation' });

  // ------------------------------------------------------------ tests: each animation set up and played, on its own
  const modelType = (m) => C.vehType(m);
  async function beside(type, side = -1, gap = 1.6) {
    const v = make(type, null, 6, 0); await wait(300);
    const th = v.th, hx = Math.cos(th), hz = Math.sin(th);
    if (!P().onFoot) P().exit(T(), true);
    P().teleportFoot(v.x - hz*gap*side*-1, v.z + hx*gap*side*-1, th, T());
    return v;
  }
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const dropOf = (v) => P().dropped.find(q => q.veh === v);
  const TESTS = {
    mount: ['getting on: a two-wheeler, from beside it', async (m = 'activa') => { const v = await beside(modelType(m)); P().enter({ kind: 'dropped', d: dropOf(v), label: '' }, T()); }],
    dismount: ['getting off what you are on (or a new one)', async (m = 'activa') => { if (P().onFoot) { const v = await beside(modelType(m)); P().enter({ kind: 'dropped', d: dropOf(v), label: '', now: true }, T()); await wait(900); } P().exit(T()); }],
    getin: ['into a car, by its door', async (m = 'swift') => { const v = await beside(modelType(m), -1, 2.4); P().enter({ kind: 'dropped', d: dropOf(v), label: '' }, T()); }],
    getout: ['out of what you drive', async () => { if (!P().onFoot) P().exit(T()); }],
    shove: ['knock a rider off: the nearest two-wheeler in traffic', async () => { const o = byDist(T().list.filter(q => q.spec?.two && !q.parked)).find(Boolean); if (!o) throw new Error('no two-wheeler near'); o.v = 0; const hx = Math.cos(o.yaw ?? o.th ?? 0), hz = Math.sin(o.yaw ?? o.th ?? 0); P().teleportFoot(o.x + hz*1.4, o.z - hx*1.4, o.yaw ?? 0, T()); await wait(300); P().enter({ kind: 'traffic', o, label: '' }, T()); }],
    walkin: ['walk into the nearest shop', async () => { const S = G.shops; if (!S.near) throw new Error('go near a shop door first (tp to one)'); S.tryUse(); }],
    sit: ['sit down', async () => { P().human.play('sit', { fade: 0.3 }); P()._animHold = 'sit'; }],
    fall: ['knocked down and up again', async () => { P().knock?.(6, 0, 0) ?? P().human.play('knockback', { once: true, fade: 0.1 }); }],
    talk: ['talk to whoever you face', async () => { G.talkUI?.tryTalk?.() ?? sh.exec('npc talk @look', true); }],
    fly: ['take off', async () => sh.exec('fly on', true)],
  };
  sh.type('test', () => Object.keys(TESTS).map(v => ({ v, note: TESTS[v][0] })));
  sh.reg('test <what:test> [model:model]', 'play one animation, set up for you: mount dismount getin shove walkin sit fall…', async ([w, m]) => {
    const t = TESTS[w]; if (!t) throw new Error(Object.keys(TESTS).join(' '));
    await t[1](m); say(`test ${w}${m ? ' ' + m : ''}`, 'ok');
  }, { group: 'animation', more: ['test mount activa', 'test mount classic350', 'test getin creta', 'test shove', 'anim speed 0.25 first to watch it slowly'] });

  // ------------------------------------------------------------ snapshots: a moment to come back to
  const SNAP = {};
  sh.reg('snapshot save [name:str]', 'where you are, the hour, the weather, every variable', ([n = 'a']) => { build(); const vals = {}; for (const e of V.values()) { try { vals[e.name] = e.get(); } catch (err) { /* skip */ } } SNAP[n] = { x: R().x, z: R().z, yaw: P().onFoot ? P().foot.yaw : P().th, vals }; say(`saved ${n}`, 'ok'); }, { group: 'variables' });
  sh.reg('snapshot load [name:str]', 'back to it', async ([n = 'a']) => {
    const s = SNAP[n]; if (!s) throw new Error(`no snapshot ${n}: ${Object.keys(SNAP).join(' ') || 'none yet'}`);
    await go({ x: s.x, z: s.z, name: n });
    build(); for (const [k, x] of Object.entries(s.vals)) { const e = V.get(k); if (!e || /^player\.(x|z|fly)$|^people\./.test(k)) continue; try { if (e.get() !== x) e.set(x); } catch (err) { /* skip */ } }
    say(`back to ${n}`, 'ok');
  }, { group: 'variables' });

  // ------------------------------------------------------------ the systems
  const SYS = () => Object.keys(G).filter(k => { const o = G[k]; return o && typeof o === 'object' && !Array.isArray(o) && !o.isObject3D && o.constructor && o.constructor !== Object && !/^_/.test(k); }).sort();
  sh.type('system', () => SYS().map(v => ({ v, note: G[v].constructor.name })));
  sh.reg('sys list', 'every part of the game, each a root for get / set / call / ls', () => sh.table(SYS().map(k => { const o = G[k], m = Object.getOwnPropertyNames(Object.getPrototypeOf(o)).filter(q => q !== 'constructor').length; return [k, o.constructor.name, m + ' methods']; })), { group: 'systems' });
  sh.reg('sys show <name:system>', 'what one has: its values and what you can call', ([k]) => {
    const o = G[k]; if (!o || typeof o !== 'object') throw new Error('sys list');
    const vals = Object.keys(o).filter(q => typeof o[q] !== 'object' || o[q] === null).slice(0, 50).map(q => [q, fmt(o[q])]);
    if (vals.length) sh.table(vals, ['value', 'now']);
    say('call: ' + Object.getOwnPropertyNames(Object.getPrototypeOf(o)).filter(q => q !== 'constructor' && typeof o[q] === 'function').map(q => `${k}.${q}`).join('  '), 'dim');
  }, { group: 'systems', more: ['sys show story', 'call story.<Tab>', 'get police.heat'] });
  sh.reg('hud [on:onoff]', 'the whole HUD on or off (for clean pictures)', ([a]) => { const on = a === undefined ? document.body.classList.contains('nh-nohud') : a === 'on'; document.body.classList.toggle('nh-nohud', !on); say(`hud ${on ? 'on' : 'off'}`, 'ok'); }, { group: 'picture' });

  // (hooked in once the people and your body exist)
  const install = () => {
    if (!G.people || !G.player || !G.player.updateFoot) { setTimeout(install, 500); return; }
    // follow: someone told to follow keeps a step behind you
    const upd = ppl().constructor.prototype.update;
    if (!upd.__follow) {
      const f = function (dt, ...a) {
        const out = upd.call(this, dt, ...a);
        for (const p of this.list) if (p._follow) { const d = Math.hypot(p.x - R().x, p.z - R().z); if (d > 2.2 && p.mode !== 'walk') { p.anim = null; this.goTo(p, R().x, R().z, (q) => hold(q, null), d > 8); } }
        return out;
      };
      f.__follow = true; ppl().constructor.prototype.update = f;
    }
    // your own body held in a clip (anim play @me): the game's own pose waits until you move
    const pu = P().updateFoot;
    P().updateFoot = function (dt, ...a) {
      const out = pu.call(this, dt, ...a), h = this._animHold;
      if (h && this.human) { const F = this.foot; if (F.v > 0.4) this._animHold = null; else if (this.human.cur !== this.human.actions[h]) this.human.play(h, { fade: 0.2 }); }
      return out;
    };
  };
  install();
  return { build, V, select };
}
