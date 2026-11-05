// The three powers, in every mode.
//   Vetal (V)          the main one: take someone over. Hold V on a person in front of you and keep them in your eyes
//                      while the link builds (look away and it breaks); you wake up in them, and your own body drops
//                      where you stood, out cold, for the street to find. Walk, drive, talk as them. It costs: a
//                      strong will (a cop, a dada) fights you harder, every metre from your body pulls harder, and
//                      doing what they never would (an aaji sprinting, a gentle one throwing punches, a cop breaking
//                      the law) strains the hold until they throw you out. Tap V to go home; knocked down, out of
//                      Vetal, or thrown out, you're pulled home anyway, to whatever happened to your body meanwhile.
//                      From inside someone, hold V on the next: a jump costs half. The bar refills while you're
//                      yourself, faster at night. The more time you spend in others, the better you get at it.
//   Brahmarakshas (O)  the learned one: read the person you face. Who they are, how they are, what they make of you,
//                      what they're keeping to themselves. Three times a game day.
//   Munja (.)          the one in the peepal tree: for eight seconds you see everyone within 60 m through walls,
//                      by what they mean you: red to fight, amber wary of you, green kind, blue the police.
//                      Three times a game day.
// The keys are in Pause → Controls like every other. In the terminal: list powers, refill power, retake power, take @look,
// return body, read @look, sense, set mastery, toggle powerfree, and the power.* variables.
import * as THREE from 'three';

const STORE = 'puneri_powers', DAILY = 3, SENSE = 8, SENSE_R = 60;
// how hard each kind of person holds on to themselves
const WILL = { kaka: 1, ajoba: 0.75, dada: 1.6, bhaiya: 1.25, collegeboy: 0.9, kpguy: 1, kaku: 1, aaji: 0.75, tai: 1.2, aunty: 1, collegegirl: 0.9, kpgirl: 1, cop: 2 };
const OLD = new Set(['ajoba', 'aaji']);
const GENTLE = new Set(['ajoba', 'aaji', 'kaku', 'aunty', 'collegegirl', 'collegeboy', 'kaka']);
const WHO = { kaka: 'kaka, a man of the neighbourhood', ajoba: 'ajoba, an old man', dada: 'dada, the local tough', bhaiya: 'bhaiya, a working man', collegeboy: 'a college student', kpguy: 'a Koregaon Park regular', kaku: 'kaku, a woman of the neighbourhood', aaji: 'aaji, an old woman', tai: 'tai, sure of herself', aunty: 'an aunty', collegegirl: 'a college student', kpgirl: 'a Koregaon Park regular', cop: 'Pune police' };
// what people keep to themselves (picked by who they are, the same each time you read the same person)
const SECRET = {
  kaka: ['owes the kirana shop more than he admits', 'has been skipping his walk and telling everyone he goes', 'still checks the old lottery tickets in his drawer', 'is saving up, quietly, for his daughter\'s wedding'],
  ajoba: ['remembers this road before it was tarred', 'hides his sweets from the doctor and from his son', 'writes letters he never posts', 'is lonelier than he lets on'],
  dada: ['is scared of his own mother', 'owes money to someone tougher than him', 'cried at a film last week', 'wants out and doesn\'t know how'],
  bhaiya: ['sends almost all of it home', 'hasn\'t been back to his village in three years', 'is learning Marathi from the shop signs', 'works a second job nobody knows about'],
  collegeboy: ['failed a paper and hasn\'t told his parents', 'is in love with someone in his class', 'spent the fees on a phone', 'wants to quit engineering for music'],
  kpguy: ['is broke till the end of the month', 'is a lot less sure of himself than he looks', 'misses his hometown', 'has a job interview tomorrow'],
  kaku: ['runs the whole building\'s gossip', 'puts money aside where her husband can\'t find it', 'is learning to ride a scooter in secret', 'knows who broke the society gate'],
  aaji: ['knows every family\'s story on this street', 'still keeps her wedding sari folded in paper', 'gives the stray dogs half her lunch', 'has outlived everyone she grew up with'],
  tai: ['is up for a promotion and hasn\'t said', 'is the one who complained to the corporation', 'is putting her brother through college', 'doesn\'t sleep much these days'],
  aunty: ['lies about her age, kindly', 'is planning a surprise for her husband', 'has a running feud with the vegetable seller', 'watches the same serial twice a day'],
  collegegirl: ['is going abroad and hasn\'t told anyone yet', 'topped the class and hides it', 'is writing a novel in her notebook', 'had a fight with her best friend'],
  kpgirl: ['moved here alone and loves it', 'is quitting her job on Monday', 'is homesick tonight', 'is saving for a trip to the hills'],
  cop: ['hasn\'t had a day off in a month', 'lets the vada pav man park where he shouldn\'t', 'wanted to be a teacher', 'knows more about you than you think'],
};
const DOING = { walk: 'on their way somewhere', stand: 'waiting about', watch: 'watching something', fight: 'in a fight', flee: 'running from something', free: 'going their own way', fixed: 'at their place', inside: 'inside' };

const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } };
const persona = (p) => p.cop || p.police ? 'cop' : p.persona || 'kaka';

export function powers(G) {
  const S = Object.assign({ bar: 1, xp: 0, free: false, day: -1, brahma: 0, munja: 0 }, load());
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* private mode */ } };
  const P = () => G.player, ppl = () => G.people, R = () => P().onFoot ? P().foot : P();
  const yaw = () => P().onFoot ? P().foot.yaw : P().th;
  const toast = (a, b, k = 'info', t = 3) => G.hud?.toast?.(a, b, k, t);
  const nameOf = (p) => p.name || G.talkUI?.nameOf?.(p) || WHO[persona(p)] || 'someone';
  const day = () => Math.floor((G.clock || 0)/24);
  const night = () => { const h = G.hour ?? 12; return h >= 20 || h < 5; };
  const mastery = () => Math.min(1, S.xp/1800);         // half an hour inside other people to master it
  const left = (k) => { if (S.day !== day()) { S.day = day(); S.brahma = 0; S.munja = 0; save(); } return S.free ? DAILY : DAILY - S[k]; };
  const use = (k) => { if (left(k) <= 0) return false; if (!S.free) { S[k]++; save(); } return true; };

  // ---------------------------------------------------------------- the status bar
  const css = document.createElement('style');
  css.textContent = `
  #nh-pw{position:fixed;left:18px;bottom:212px;display:flex;gap:8px;align-items:center;padding:7px 10px;border-radius:14px;background:rgba(14,14,18,.78);backdrop-filter:blur(6px);font:600 12px/1 system-ui,sans-serif;color:#f3ead8;z-index:5;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.35)}
  #nh-pw .pw{display:flex;align-items:center;gap:6px}
  #nh-pw .ic{width:24px;height:24px;border-radius:8px;display:grid;place-items:center;font-size:13px;color:#fff}
  #nh-pw .v .ic{background:#7b2ff2}#nh-pw .b .ic{background:#e08a00}#nh-pw .m .ic{background:#1f9d6b}
  #nh-pw .bar{width:74px;height:7px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden}
  #nh-pw .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#a46bff,#e2c2ff);border-radius:4px;transition:width .2s}
  #nh-pw .pips{display:flex;gap:3px}#nh-pw .pips b{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.18)}#nh-pw .pips b.on{background:#f3ead8}
  #nh-pw .k{opacity:.6;font-size:10px}
  #nh-pw.in .v .ic{box-shadow:0 0 0 2px #e2c2ff}
  #nh-pw .st{width:5px;height:22px;border-radius:3px;background:rgba(255,255,255,.12);position:relative;overflow:hidden;display:none}
  #nh-pw.in .st{display:block}#nh-pw .st i{position:absolute;left:0;right:0;bottom:0;background:#ff4d4d}
  #nh-veil{position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at center,transparent 45%,rgba(60,0,110,.55) 100%)}
  #nh-sense{position:fixed;inset:0;pointer-events:none;z-index:3}
  #nh-read{position:fixed;right:22px;top:40%;width:270px;padding:14px 16px;border-radius:16px;background:rgba(14,14,18,.86);color:#f3ead8;font:13px/1.45 system-ui,sans-serif;z-index:6;pointer-events:none;opacity:0;transform:translateX(12px);transition:.25s;border-left:4px solid #e08a00}
  #nh-read.on{opacity:1;transform:none}#nh-read h4{margin:0 0 6px;font-size:15px;color:#ffd38a}#nh-read p{margin:2px 0}#nh-read em{color:#ffd38a;font-style:normal}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'nh-pw';
  ui.innerHTML = `<div class="pw v"><span class="ic">◉</span><span class="bar"><i></i></span><span class="st"><i></i></span><span class="k">V</span></div>
    <div class="pw b"><span class="ic">✦</span><span class="pips"><b></b><b></b><b></b></span><span class="k">O</span></div>
    <div class="pw m"><span class="ic">❂</span><span class="pips"><b></b><b></b><b></b></span><span class="k">.</span></div>`;
  const veil = document.createElement('div'); veil.id = 'nh-veil';
  const sense = document.createElement('canvas'); sense.id = 'nh-sense';
  const card = document.createElement('div'); card.id = 'nh-read';
  const mount = () => { const host = document.getElementById('ui'); if (!host) { setTimeout(mount, 400); return; } host.appendChild(ui); host.appendChild(card); document.body.appendChild(veil); document.body.appendChild(sense); };
  mount();
  const bar = ui.querySelector('.bar i'), stb = ui.querySelector('.st i');
  const pips = (sel, n) => ui.querySelectorAll(sel + ' .pips b').forEach((b, i) => b.classList.toggle('on', i < n));
  const draw = () => {
    const shown = G.state === 'play' || G.state === 'pause';
    ui.style.display = shown ? '' : 'none';
    bar.style.width = Math.round(S.bar*100) + '%';
    ui.classList.toggle('in', !!host);
    stb.style.height = Math.round(Math.min(1, strain)*100) + '%';
    pips('.b', left('brahma')); pips('.m', left('munja'));
    veil.style.opacity = host ? 0.55 + Math.min(1, strain)*0.45 : link ? link.t/link.need*0.8 : 0;
  };

  // ---------------------------------------------------------------- a low sound for the link (made here, nothing loaded)
  let hum = null;
  const humOn = (k) => {
    const a = G.audio; if (!a || !a.ctx || !a.master) return;
    if (!hum) {
      const c = a.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sine'; o.frequency.value = 52; o2.type = 'triangle'; o2.frequency.value = 78.5; f.type = 'lowpass'; f.frequency.value = 420;
      g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(a.master); o.start(); o2.start();
      hum = { o, o2, g, f };
    }
    const t = a.ctx.currentTime;
    hum.g.gain.setTargetAtTime(0.22*k, t, 0.08); hum.o2.frequency.setTargetAtTime(78.5 + k*40, t, 0.1); hum.f.frequency.setTargetAtTime(420 + k*900, t, 0.1);
  };

  // ---------------------------------------------------------------- Vetal
  let link = null, host = null, home = null, strain = 0, held = 0, wasV = false, heat0 = 0, hp0 = 100, punches = 0;
  const RANGE = 14;
  const candidates = () => ppl() ? ppl().list.filter(p => !p.hidden && !p.corpse && !(p.fallen > 0) && !p.pax && !p._vetalBody && p.look) : [];
  function aimed() {
    if (!P().onFoot) return null;
    const F = R(), th = yaw();
    let best = null, bs = 1e9;
    for (const p of candidates()) {
      const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz); if (d > RANGE || d < 0.4) continue;
      const a = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - th), Math.cos(Math.atan2(dz, dx) - th)));
      if (a > (d < 3 ? 0.7 : 0.3)) continue;                // close you can be rough about it; far you have to mean it
      const sc = a*6 + d*0.3; if (sc < bs) { bs = sc; best = p; }
    }
    return best;
  }
  const raw = (look) => Object.getPrototypeOf(P()).setLook.call(P(), look);
  const fromBody = () => home ? Math.hypot(R().x - home.x, R().z - home.z) : 0;
  const costIn = (p) => 0.14*(WILL[persona(p)] || 1)*(1 - 0.4*mastery())*(host ? 0.5 : 1);
  const timeIn = (p) => 1.3*(WILL[persona(p)] || 1)*(1 - 0.4*mastery())*(host ? 0.5 : 1);

  function take(p, instant = false) {
    if (!p) throw new Error('nobody to take');
    const c = S.free ? 0 : costIn(p);
    if (S.bar < c) { toast('Vetal', 'Not enough left in you for that one', 'warn'); return false; }
    S.bar -= c;
    const Pl = P(), F = R();
    if (!home) {
      // your own body stays where it fell: one of the street's people now, out cold, for as long as you're away
      const body = ppl().spawnAt(Pl.look, F.x, F.z, 'kaka');
      if (body) { Object.assign(body, { fallen: 1e6, ko: true, unconscious: true, mode: 'stand', wait: 1e9, v: 0, anim: null, yaw: yaw(), _vetalBody: true, persona: null }); body.anchor = { x: body.x, z: body.z }; }
      home = { look: Pl.look, x: F.x, z: F.z, yaw: yaw(), hp: Pl.hp ?? 100, body, t: 0, crowd: false };
    } else if (host) release(host, F.x, F.z);
    host = { look: p.look, persona: p.persona, cop: p.cop || p.police, name: p.name, female: p.female, id: p.id, kind: persona(p) };
    const x = p.x, z = p.z, th = p.yaw || 0;
    ppl().remove(p);
    raw(host.look);
    Pl.teleportFoot(x, z, th, G.traffic);
    Pl.hp = 100; hp0 = 100; heat0 = G.police?.heat || 0; strain = 0; punches = 0;
    G.hud?.flash?.();
    toast('Vetal', `You are ${host.name || WHO[host.kind] || 'someone else'} now. V to go back`, 'info', 3.5);
    if (!instant) humOn(0);
    return true;
  }
  // the one you were in comes to, where you left them, with no idea how they got there
  function release(h, x, z) {
    const p = ppl().spawnAt(h.look, x, z, h.persona);
    if (!p) return;
    if (h.cop) p.cop = true; if (h.name) p.name = h.name;
    p.mode = 'watch'; p.watch = { x: x + 1, z }; p.wait = 4; p.anim = 'no'; p.id = h.id;
    setTimeout(() => G.hud?.say?.(h.name || WHO[h.kind] || 'Someone', '', h.female ? 'How… how did I get here?' : 'How did I get here?', 3), 600);
  }
  function goHome(why) {
    if (!home) return;
    const Pl = P(), F = R(), b = home.body;
    if (host) release(host, F.x, F.z);
    host = null;
    // whatever the street did to your body while you were out of it
    let hp = home.hp;
    if (b) { if (b.corpse) hp = 12; else if (b.over) hp = Math.max(8, hp - b.over*1.2); }
    const bx = b ? b.x : home.x, bz = b ? b.z : home.z;
    if (b) ppl().remove(b);
    raw(home.look);
    Pl.teleportFoot(bx, bz, home.yaw, G.traffic);
    Pl.hp = hp; home = null; strain = 0;
    if (why) { Pl.human?.play?.('knockback', { once: true, fade: 0.1 }); toast('Vetal', why, 'warn', 3); }
    humOn(0);
  }
  // the punch key and the mouse, counted while you're in someone (a gentle body fighting strains the hold)
  addEventListener('keydown', (e) => { if (host && e.code === 'KeyX' && !e.repeat) punches++; }, true);
  addEventListener('mousedown', (e) => { if (host && e.button === 0 && document.pointerLockElement) punches++; }, true);

  function vetal(dt) {
    const down = !!G.input?.key('KeyV') && !G.talkUI?.cur;
    if (down) held += dt;
    // a tap: home (in someone) or a word that there's nobody there
    if (!down && wasV) { if (held < 0.3 && !(link && link.t > 0.15)) { if (host) goHome(); else if (!aimed()) toast('Vetal', 'Look at someone and hold V', 'info', 2); } held = 0; link = null; humOn(0); }
    wasV = down;
    if (down && held > 0.12) {
      const p = aimed();
      if (!p || (link && link.p !== p)) { if (link) { link = null; humOn(0); if (p === null) toast('Vetal', 'The link broke: keep them in your eyes', 'warn', 1.6); } }
      if (p) {
        if (!link) link = { p, t: 0, need: timeIn(p) };
        link.t += dt;
        // they feel it: they stop and look round
        if (link.t > 0.3 && p.mode !== 'watch' && p.mode !== 'fight') ppl().watch(p, R().x, R().z, 1.5);
        humOn(link.t/link.need);
        if (link.t >= link.need) { const q = link.p; link = null; held = -1e9; take(q); }
      }
    }
    if (host) {
      // the cost of being someone else
      S.xp += dt;
      const d = fromBody(), w = WILL[host.kind] || 1;
      const drain = 0.011*w*(1 + d/120)*(1 - 0.45*mastery());
      if (!S.free) S.bar = Math.max(0, S.bar - drain*dt);
      // doing what they never would
      const Pl = P(), F = Pl.foot;
      if (OLD.has(host.kind) && Pl.onFoot && Math.hypot(F.vx || 0, F.vz || 0) > 3.6) strain += dt*0.35;
      if (punches) { strain += punches*(GENTLE.has(host.kind) ? 0.12 : host.kind === 'cop' ? 0.02 : 0.05); punches = 0; }
      const heat = G.police?.heat || 0;
      if (heat > heat0) { strain += (heat - heat0)*(host.kind === 'cop' ? 0.45 : 0.15); heat0 = heat; } else heat0 = heat;
      if ((Pl.hp ?? 100) < hp0) { strain += (hp0 - Pl.hp)*0.006; } hp0 = Pl.hp ?? 100;
      strain = Math.max(0, strain - dt*0.06*(1 + mastery()));
      if (S.free) strain = 0;
      if (strain >= 1 + mastery()*0.5) goHome('They threw you out');
      else if (S.bar <= 0) goHome('Vetal ran out: pulled home');
      else if (Pl.ko || (Pl.hp ?? 100) <= 0) goHome('Knocked out of them');
      // the street finds your body after a while
      if (home && !home.crowd && (home.t += dt) > 18 && home.body) { home.crowd = true; try { ppl().gather?.(home.body.x, home.body.z, 3, 'foot'); } catch (e) { /* no crowd here */ } }
    } else if (!link) {
      S.bar = Math.min(1, S.bar + dt*0.0045*(night() ? 1.8 : 1));
    }
  }

  // ---------------------------------------------------------------- Brahmarakshas
  let cardT = 0;
  function read(p) {
    if (!p) { toast('Brahmarakshas', 'Face someone to read them', 'info', 2); return false; }
    if (!use('brahma')) { toast('Brahmarakshas', 'Spent for today. Back tomorrow', 'warn', 2.5); return false; }
    const k = persona(p), mem = ppl().mem?.get(p.id) || {}, rep = ppl().rep?.at?.(p.x, p.z) || { good: 0, bad: 0 };
    const mood = p.mode === 'fight' ? 'ready to fight' : p.angry > 0 ? 'angry' : p.grudge > 0 ? 'holding a grudge' : p.mode === 'flee' ? 'frightened' : p.fallen > 0 ? 'hurt' : 'calm';
    const you = mem.hit ? 'You hit them. They haven\'t forgotten' : mem.shoved ? 'You shoved them. Still sore about it' : mem.saw ? 'They saw what you did. Wary of you' : rep.bad > 2 ? 'They\'ve heard about you round here, and not good things' : rep.good > 2 ? 'They\'ve heard good things about you' : 'They don\'t know you';
    const sec = SECRET[k] || SECRET.kaka, s = sec[Math.abs(p.id || 0) % sec.length];
    card.innerHTML = `<h4>${nameOf(p)}</h4><p>${WHO[k] || k}, ${DOING[p.mode] || 'about'}${p.anim ? ` (${p.anim.replace(/_/g, ' ')})` : ''}</p><p>Mood: <em>${mood}</em></p><p>${you}</p><p>Keeps to themselves: <em>${s}</em></p>${p.cash !== undefined ? `<p>Carrying ₹${Math.round(p.cash)}</p>` : ''}<p style="opacity:.55;font-size:11px">${left('brahma')} left today</p>`;
    card.classList.add('on'); cardT = 7;
    return true;
  }
  const faced = () => { const F = R(), th = yaw(); let best = null, bs = 1e9; for (const p of (ppl()?.list || [])) { if (p.hidden || p._vetalBody) continue; const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz); if (d > 9) continue; const a = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - th), Math.cos(Math.atan2(dz, dx) - th))); if (a > 0.6) continue; const sc = a*4 + d*0.3; if (sc < bs) { bs = sc; best = p; } } return best; };

  // ---------------------------------------------------------------- Munja
  let senseT = 0;
  const v3 = new THREE.Vector3();
  function senseOn(t = SENSE) { if (!use('munja')) { toast('Munja', 'Spent for today. Back tomorrow', 'warn', 2.5); return false; } senseT = t; toast('Munja', 'Everyone near you, through the walls', 'info', 2); return true; }
  const intent = (p) => {
    const m = ppl().mem?.get(p.id) || {};
    if (p.cop || p.police) return '#4aa3ff';
    if (p.mode === 'fight' || p.angry > 0 || p.grudge > 0 || (m.hit && /dada|bhaiya|tai/.test(p.persona || ''))) return '#ff4d4d';
    if (p.mode === 'flee' || m.saw || m.hit || m.shoved) return '#ffb020';
    if (p.act && p.act.clip === 'wave') return '#3ddc84';
    return '#f3ead8';
  };
  function drawSense(dt) {
    const c = sense, W = innerWidth, H = innerHeight;
    if (senseT <= 0) { if (c.width) { c.width = 0; c.height = 0; } return; }
    senseT -= dt;
    if (c.width !== W) { c.width = W; c.height = H; }
    const g = c.getContext('2d'), cam = G.camera; g.clearRect(0, 0, W, H);
    if (!cam) return;
    const fade = Math.min(1, senseT/1.2, (SENSE - senseT + 0.3)/0.5);
    const F = R(), surf = G.W?.surf;
    const one = (x, z, col, r) => {
      const d = Math.hypot(x - F.x, z - F.z); if (d > SENSE_R) return;
      const y = surf ? surf.height(x, z) : 0;
      v3.set(x, y + 1.0, z).project(cam); if (v3.z > 1 || v3.z < -1) return;
      const sx = (v3.x + 1)/2*W, sy = (1 - v3.y)/2*H, k = Math.max(0.35, 1 - d/SENSE_R);
      g.globalAlpha = fade*k; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2;
      const h = 70*r/Math.max(2, d)*6;
      g.beginPath(); g.ellipse(sx, sy, h*0.18 + 2, h*0.5 + 4, 0, 0, Math.PI*2); g.stroke();
      g.globalAlpha = fade*k*0.25; g.fill();
    };
    for (const p of ppl().list) if (!p.hidden && !p._vetalBody) one(p.x, p.z, p.corpse ? '#777' : intent(p), 1);
    for (const a of ppl().animals || []) one(a.x, a.z, '#9aa0a6', 0.6);
    if (home && home.body) one(home.body.x, home.body.z, '#c79bff', 1.2);   // and your own body, wherever you left it
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- every frame
  const keyEdge = {};
  const took = (code) => { const d = !!G.input?.key(code); const e = d && !keyEdge[code]; keyEdge[code] = d; return e; };
  const frame = G.frame.bind(G);
  let last = performance.now();
  G.frame = (dt) => {
    const r = frame(dt);
    const now = performance.now(), el = Math.min(0.1, (now - last)/1000); last = now;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (G.state === 'play' && !G.talkUI?.cur && !typing) {
      vetal(el);
      if (took('KeyO')) read(faced());
      if (took('Period')) senseOn();
    } else { wasV = false; held = 0; if (link) { link = null; humOn(0); } }
    if (cardT > 0 && (cardT -= el) <= 0) card.classList.remove('on');
    drawSense(el);
    draw();
    return r;
  };
  addEventListener('beforeunload', save);
  setInterval(save, 10000);

  // ---------------------------------------------------------------- the terminal
  const api = {
    S, take, goHome, read, senseOn, mastery, left,
    get host() { return host; }, get home() { return home; }, get strain() { return strain; }, set strain(x) { strain = x; },
  };
  G.powers = api;
  (G.varHooks = G.varHooks || []).push((v) => {
    v('power.vetal', 'Vetal left, 0 to 1', () => S.bar, (x) => { S.bar = x; save(); }, { min: 0, max: 1 });
    v('power.mastery', 'how good you are at Vetal, 0 to 1 (half an hour inside others to master)', () => mastery(), (x) => { S.xp = x*1800; save(); }, { min: 0, max: 1 });
    v('power.strain', 'how hard the one you\'re in is fighting you, 0 to 1', () => strain, (x) => { strain = x; }, { min: 0, max: 2 });
    v('power.free', 'powers cost nothing', () => S.free, (x) => { S.free = x; save(); }, { kind: 'bool' });
    v('power.brahma', 'Brahmarakshas reads left today', () => left('brahma'), (x) => { S.brahma = DAILY - Math.round(x); save(); }, { min: 0, max: DAILY });
    v('power.munja', 'Munja senses left today', () => left('munja'), (x) => { S.munja = DAILY - Math.round(x); save(); }, { min: 0, max: DAILY });
  });
  const shell = () => {
    const T = G.terminal; if (!T || !G.registry) { setTimeout(shell, 600); return; }
    const { sh } = T, say = (s, k) => sh.print ? sh.print(s, k) : T.term?.say?.(s, k);
    const persons = (s) => G.registry.select(s).filter(e => e.k === 'person').map(e => e.o);
    const status = () => [
      `Vetal ${Math.round(S.bar*100)}%  mastery ${Math.round(mastery()*100)}%  ${host ? `in ${host.name || WHO[host.kind]} · strain ${Math.round(strain*100)}% · ${Math.round(fromBody())} m from your body` : 'yourself'}`,
      `Brahmarakshas ${left('brahma')}/${DAILY} today   Munja ${left('munja')}/${DAILY} today${S.free ? '   (free)' : ''}`,
    ];
    sh.reg('list powers', 'the three powers: what\'s left, who you are in, how far from your body', () => status().forEach(l => say(l)), { group: 'powers' });
    sh.type('power', () => [{ v: 'all', note: 'everything' }, { v: 'vetal', note: 'the bar' }, { v: 'brahma', note: 'Brahmarakshas, today\'s reads' }, { v: 'munja', note: 'Munja, today\'s senses' }]);
    sh.reg('refill power [which:power]', 'fill them up: vetal, brahma, munja or all (default)', ([w = 'all']) => { if (w === 'all' || w === 'vetal') S.bar = 1; if (w === 'all' || w === 'brahma') S.brahma = 0; if (w === 'all' || w === 'munja') S.munja = 0; save(); say('refilled ' + w, 'ok'); }, { group: 'powers' });
    sh.reg('retake power', 'today\'s uses back, the bar full, and the strain gone', () => { S.bar = 1; S.brahma = 0; S.munja = 0; strain = 0; save(); say('all yours again', 'ok'); }, { group: 'powers' });
    sh.reg('take <who:sel>', 'Vetal: into them, now (no link)', ([s]) => { const [p] = persons(s); take(p, true); say('in', 'ok'); }, { group: 'powers' });
    sh.reg('return body', 'Vetal: back to your own body', () => { if (!home) throw new Error('you are yourself'); goHome(); say('home', 'ok'); }, { group: 'powers' });
    sh.reg('read <who:sel>', 'Brahmarakshas on anyone (uses one)', ([s]) => { const [p] = persons(s); read(p); }, { group: 'powers' });
    sh.reg('sense [seconds:num]', 'Munja (uses one)', ([t]) => { senseOn(+t || SENSE); }, { group: 'powers' });
    sh.reg('toggle powerfree [on:onoff]', 'powers cost nothing (testing)', ([a]) => { S.free = a === undefined ? !S.free : a === 'on'; save(); say(`free ${S.free ? 'on' : 'off'}`, 'ok'); }, { group: 'powers' });
    sh.reg('set mastery <amount:num>', 'Vetal mastery 0 to 1', ([x]) => { S.xp = Math.max(0, Math.min(1, +x))*1800; save(); say(`mastery ${Math.round(mastery()*100)}%`, 'ok'); }, { group: 'powers' });
    if (sh.order && !sh.order.includes('powers')) sh.order.splice(sh.order.indexOf('you') + 1, 0, 'powers');
  };
  shell();
  return api;
}
