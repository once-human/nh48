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
//   Brahmarakshas (B)  on foot, the learned one: read the person you look at. Who they are, how they are, what they make of you,
//                      what they're keeping to themselves. Three times a game day.
//   Munja (N)          on foot, the one in the peepal tree: for eight seconds you see everyone within 60 m through walls,
//                      by what they mean you: red to fight, amber wary of you, green kind, blue the police.
//                      Three times a game day.
// The keys are in Pause → Controls like every other. In the terminal: list powers, refill power, retake power, take @look,
// return body, read @look, sense, set mastery, toggle powerfree, and the power.* variables.
import * as THREE from 'three';
import { ikArm } from '@orig/people/humans.js';
import { dizzyPose } from './dizzy.js';

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

  // ---------------------------------------------------------------- on the game's own HUD: Vetal is a sixth ring in the vitals
  const veil = document.createElement('div'); veil.id = 'nh-veil';
  veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;transition:opacity .4s';
  const css = document.createElement('style');
  css.textContent = `.vit .v-vt { color: #b26bff; } .vit .v-vt.in svg.gl { animation: v2pulse 1.6s ease-in-out infinite; } body.nh-nohud #nh-veil { display: none; }`;
  document.head.appendChild(css);
  let ring = null, black = false;
  const mount = () => {
    const Hd = G.hud; if (!Hd || !Hd.vit || !Hd._vitEls || !document.body) { setTimeout(mount, 500); return; }
    document.body.appendChild(veil);
    const C = Hd.vitC || 2*Math.PI*15, sp = document.createElement('span');
    sp.className = 'v-vt'; sp.title = 'Vetal';
    sp.innerHTML = `<svg viewBox="0 0 36 36"><circle class="tr" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0"/></svg><svg class="gl" viewBox="0 0 24 24"><path d="M12 2.5c.6 3.1 4.6 5.2 4.6 10.1a4.6 4.6 0 0 1-9.2 0c0-2.3 1.2-3.9 2.3-4.9.1 1.6.8 2.7 1.9 3.2-.6-2.9.1-5.8.4-8.4Z"/><circle cx="12" cy="15.4" r="1.6" fill="rgba(0,0,0,.45)"/></svg>`;
    Hd.vit.appendChild(sp); ring = { sp, fg: sp.querySelector('.fg'), C };
  };
  mount();
  const draw = () => {
    if (ring) { ring.fg.setAttribute('stroke-dashoffset', (ring.C*(1 - Math.max(0, Math.min(1, S.bar)))).toFixed(1)); ring.sp.classList.toggle('in', !!host); ring.sp.classList.toggle('low', S.bar < 0.15); }
    if (black) return;
    // purple coming in from the edges: while the link builds, and while you're in someone (deeper as they fight you)
    const k = host ? 0.35 + Math.min(1, strain)*0.65 : link ? Math.min(1, link.t/link.need) : 0;
    veil.style.opacity = k.toFixed(3);
    veil.style.background = `radial-gradient(ellipse at center,transparent ${52 - k*22}%,rgba(${70 + strain*60},${10},${120 + strain*30},${0.35 + k*0.4}) 100%)`;
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

  // ---------------------------------------------------------------- the aura: light on the person's own body
  // A second skin on the same skeleton, a few millimetres out, lit only at its edges (where you see past them), so
  // they glow round their outline and moves as they move. Faded in slowly, out the same way.
  function auraMat(col) {
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const uK = { value: 0 }; m.userData.uK = uK;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uK = uK;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vF;')
        .replace('#include <project_vertex>', '#ifdef USE_SKINNING\n  transformed += normalize(objectNormal)*0.012;\n#endif\n#include <project_vertex>\n  { vec3 nV = normalize(normalMatrix*objectNormal); vF = pow(1.0 - abs(dot(nV, normalize(-mvPosition.xyz))), 2.4); }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vF;\nuniform float uK;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor = vec4(diffuse*(0.35 + 1.8*vF), (0.05 + 0.95*vF)*uK);');
    };
    return m;
  }
  const auras = new Map(); let auraN = 0;
  function aura(H, col, want, xray = false) {
    if (!H || !H.root) return;
    let A = auras.get(H);
    if (!A) {
      const mat = auraMat(col), shells = [];
      H.root.traverse(o => { if (!o.isSkinnedMesh || o.userData.aura) return; const s = new THREE.SkinnedMesh(o.geometry, mat); s.userData.aura = true; s.bind(o.skeleton, o.bindMatrix); s.position.copy(o.position); s.quaternion.copy(o.quaternion); s.scale.copy(o.scale); s.frustumCulled = false; s.renderOrder = 20; s.castShadow = false; s.receiveShadow = false; shells.push([o.parent, s]); });
      for (const [par, s] of shells) par.add(s);
      A = { mat, shells, k: 0 }; auras.set(H, A);
    }
    A.want = want; A.seen = auraN; A.mat.color.set(col); A.mat.depthTest = !xray;
  }
  function auraTick(dt) {
    for (const [H, A] of auras) {
      if (A.seen !== auraN) A.want = 0;
      A.k += (A.want - A.k)*Math.min(1, dt*2.2);
      A.mat.userData.uK.value = A.k;
      if (A.want === 0 && A.k < 0.01) { for (const [par, s] of A.shells) par.remove(s); A.mat.dispose(); auras.delete(H); }
    }
    auraN++;
  }
  const bodyOf = (p) => p && p.body && p.body.H;

  // ---------------------------------------------------------------- Vetal
  let dz = null, leaving = false, justIn = false, target = null, calm = 0, drag = null, dazeT = 0, link = null, host = null, home = null, strain = 0, held = 0, wasV = false, heat0 = 0, hp0 = 100, punches = 0;
  const RANGE = 45;
  let coolT = 0, hops = 0;
  const candidates = () => ppl() ? ppl().list.filter(p => !p.hidden && !p.corpse && !(p.fallen > 0) && !p.pax && !p._vetalBody && p.look) : [];
  const cp = new THREE.Vector3(), cf = new THREE.Vector3(), tv = new THREE.Vector3();
  const aimed = () => aimAt(candidates(), RANGE);
  function aimAt(list, range) {
    const cam = G.camera; if (!P().onFoot || !cam) return null;
    cam.getWorldPosition(cp); cam.getWorldDirection(cf);
    const F = R(); let best = null, bs = 1e9;
    for (const p of list) {
      const d = Math.hypot(p.x - F.x, p.z - F.z); if (d > range || d < 0.4) continue;
      const y = G.W?.surf ? G.W.surf.height(p.x, p.z) : 0;
      // the middle of the screen on them: the camera's line passes through their body (chest, head to hips)
      tv.set(p.x, y + 1.15, p.z).sub(cp); const along = tv.dot(cf); if (along <= 0.5) continue;
      const off = Math.sqrt(Math.max(0, tv.lengthSq() - along*along));
      if (off > 0.42) continue;
      const sc = off + along*0.004; if (sc < bs) { bs = sc; best = p; }
    }
    return best;
  }
  const raw = (look) => Object.getPrototypeOf(P()).setLook.call(P(), look);
  const fromBody = () => home ? Math.hypot(R().x - home.x, R().z - home.z) : 0;
  const costIn = (p) => 0.14*(WILL[persona(p)] || 1)*(1 - 0.4*mastery())*(host ? 0.5 : 1);
  const timeIn = (p) => 3.0*(0.75 + 0.25*(WILL[persona(p)] || 1))*(1 - 0.3*mastery())*(host ? 0.8 : 1);

  function take(p, instant = false) {
    humOn(0);
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
    coolT = 4;
    return true;
  }
  // the moment of going in: the world goes dark, and either you wake up in them or they throw you off. How likely
  // that is comes from them and from you: a strong will, a low bar, one hop too many, and less mastery all count
  // (at full strength, first try, it's very rare: about one in a hundred with an ordinary person)
  function attempt(q) {
    const w = WILL[persona(q)] || 1, m = mastery();
    const pr = S.free ? 0 : Math.min(0.6, 0.009*w*w*(1 + 4*(1 - S.bar))*(1 + 0.9*hops)*(1 - 0.6*m));
    black = true; veil.style.transition = 'opacity .3s'; veil.style.background = '#000'; veil.style.opacity = '1';
    humOn(1);
    setTimeout(() => {
      try {
        if (Math.random() < pr && ppl().list.includes(q)) {
          const who = nameOf(q);
          ppl().flee?.(q, R().x, R().z, 10); q.angry = 3;
          if (host) goHome(`${who} threw you out`, true);
          else { S.bar = Math.max(0, S.bar - costIn(q)*0.5); dazeT = 14; const Pl = P(); Pl.frozen = true; Pl.human?.play?.('knockback', { once: true, fade: 0.12 }); setTimeout(() => { Pl.frozen = false; }, 1800); toast('Vetal', `${who} fought you off`, 'warn', 3); coolT = 10; }
        } else if (ppl().list.includes(q)) { take(q); hops++; justIn = true; }
      } catch (e) { console.warn('vetal', e); }
      finally { humOn(0); black = false; veil.style.transition = 'opacity .6s'; }
    }, 420);
  }

  // the one you were in comes to, where you left them, with no idea how they got there
  function release(h, x, z) {
    const p = ppl().spawnAt(h.look, x, z, h.persona);
    if (!p) return;
    if (h.cop) p.cop = true; if (h.name) p.name = h.name;
    p.mode = 'watch'; p.watch = { x: x + 1, z }; p.wait = 4; p.anim = null; p.id = h.id; p.dizzy = { t: 0, dur: 2.6, ph: Math.random()*6 };
    setTimeout(() => G.hud?.say?.(h.name || WHO[h.kind] || 'Someone', '', h.female ? 'How… how did I get here?' : 'How did I get here?', 3), 600);
  }
  function goHome(why, hard = false, quiet = false) {
    if (!home) return;
    const Pl = P(), F = R(), b = home.body;
    if (drag && drag.p === b) drag = null;
    if (host) release(host, F.x, F.z);
    host = null;
    // whatever the street did to your body while you were out of it
    let hp = home.hp;
    if (b) { if (b.corpse) hp = 12; else if (b.over) hp = Math.max(8, hp - b.over*1.2); }
    const bx = b ? b.x : home.x, bz = b ? b.z : home.z, by = b ? b.yaw ?? home.yaw : home.yaw;
    if (b) ppl().remove(b);
    raw(home.look);
    Pl.teleportFoot(bx, bz, by, G.traffic);
    Pl.hp = hp; home = null; strain = 0; humOn(0); hops = 0; coolT = 8;
    // you come to on the ground and get up: slowly if they threw you out (and it's two minutes later)
    const H = Pl.human;
    if (hard) {
      if (!G.live && G.setHour) G.setHour(((G.hour + 2/60) % 24 + 24) % 24);
      dazeT = 45; Pl.frozen = true; H?.play?.('knockback', { once: true, fade: 0.15 });
      setTimeout(() => { H?.play?.('getup', { once: true, fade: 0.35, speed: 0.6 }); }, 2600);
      setTimeout(() => { Pl.frozen = false; }, 5200);
      if (why) toast('Vetal', why + '. You come round two minutes later, head pounding', 'warn', 4);
    } else if (!quiet) {
      Pl.frozen = true; H?.play?.('getup', { once: true, fade: 0.25, speed: 0.85 });
      setTimeout(() => { Pl.frozen = false; }, 1700);
      if (why) toast('Vetal', why, 'warn', 3);
    }
  }
  function leaveSoft() {
    if (!home || leaving) return;
    const Pl = P(); leaving = true; Pl.frozen = true;
    dz = { t: 0, dur: 0.5, ph: Math.random()*6 };
    veil.style.opacity = 1;
    setTimeout(() => {
      try {
        dz = null;
        goHome(null, false, true);
        const H2 = P().human, g = H2?.actions?.getup;
        if (g) { H2.play('getup', { once: true, fade: 0.05 }); g.timeScale = 0; }
        setTimeout(() => { if (g) g.timeScale = 0.9; setTimeout(() => { P().frozen = false; leaving = false; }, 1300); }, 500);
        if (!g) { P().frozen = false; leaving = false; }
      } catch (e) { P().frozen = false; leaving = false; }
    }, 500);
  }
  // the punch key and the mouse, counted while you're in someone (a gentle body fighting strains the hold)
  addEventListener('keydown', (e) => { if (host && e.code === 'KeyX' && !e.repeat) punches++; }, true);
  addEventListener('mousedown', (e) => { if (host && e.button === 0 && document.pointerLockElement) punches++; }, true);

  function vetal(dt) {
    // hold V on someone until you're in them (then let go: you stay); hold it on someone else to hop; a tap goes home
    const down = !!G.input?.key('KeyV') && !G.talkUI?.cur && !leaving, rel = !down && wasV;
    wasV = down;
    if (down) held += dt;
    if (coolT > 0) coolT -= dt;
    if (down && !link && held > 0.12 && !justIn && coolT <= 0 && !black) { const p = aimed(); if (p) link = { p, t: 0, need: timeIn(p) }; }
    if (rel) {
      if (justIn) justIn = false;
      else if (black) { /* going in */ }
      else if (link) { link = null; humOn(0); toast('Vetal', 'Hold V until you\'re in', 'info', 1.6); }
      else if (held < 0.35) { if (host) leaveSoft(); else toast('Vetal', 'Look at someone and hold V', 'info', 2); }
      held = 0;
    }
    target = link ? link.p : aimed();
    if (link) {
      const p = aimed();
      // look across to someone else and the link moves to them, from nothing again; look at nobody and it breaks
      if (p && p !== link.p) link = { p, t: 0, need: timeIn(p) };
      else if (!p) { link.lost = (link.lost || 0) + dt; if (link.lost > 0.35) { link = null; humOn(0); toast('Vetal', 'The link broke: keep them in your eyes', 'warn', 1.6); } }
      else link.lost = 0;
      if (link) {
        link.t += dt;
        // they feel it: they stop and look round
        if (link.t > 0.4 && link.p.mode !== 'watch' && link.p.mode !== 'fight') ppl().watch(link.p, R().x, R().z, 2);
        humOn(link.t/link.need);
        if (link.t >= link.need) { const q = link.p; link = null; attempt(q); }
      }
    }
    if (host) {
      // the cost of being someone else
      S.xp += dt;
      const d = fromBody(), w = WILL[host.kind] || 1;
      const drain = 0.008*w*(1 + d/220)*(1 - 0.45*mastery());
      if (!S.free) S.bar = Math.max(0, S.bar - drain*dt);
      // doing what they never would
      const Pl = P(), F = Pl.foot;
      if (OLD.has(host.kind) && Pl.onFoot && Math.hypot(F.vx || 0, F.vz || 0) > 3.6) { strain += dt*0.2; calm = 0; }
      if (punches) { strain += punches*(GENTLE.has(host.kind) ? 0.07 : host.kind === 'cop' ? 0.015 : 0.03); punches = 0; calm = 0; }
      const heat = G.police?.heat || 0;
      if (heat > heat0) { strain += (heat - heat0)*(host.kind === 'cop' ? 0.35 : 0.1); heat0 = heat; calm = 0; } else heat0 = heat;
      if ((Pl.hp ?? 100) < hp0) { strain += (hp0 - Pl.hp)*0.004; calm = 0; } hp0 = Pl.hp ?? 100;
      calm += dt;
      if (calm > 3) strain = Math.max(0, strain - dt*0.1*(1 + mastery()));
      if (S.free) strain = 0;
      if (strain >= 1 + mastery()*0.5) goHome('They threw you out', true);
      else if (S.bar <= 0) goHome('Vetal ran out: pulled home');
      else if (Pl.ko || (Pl.hp ?? 100) <= 0) goHome('Knocked out of them', true);
      // the street finds your body after a while
      if (home && !home.crowd && (home.t += dt) > 18 && home.body) { home.crowd = true; try { ppl().gather?.(home.body.x, home.body.z, 3, 'foot'); } catch (e) { /* no crowd here */ } }
    } else if (!link) {
      S.bar = Math.min(1, S.bar + dt*0.0045*(night() ? 1.8 : 1));
    }
  }

  // ---------------------------------------------------------------- Brahmarakshas (B, on foot): the one you look at
  let readP = null, readT = 0;
  function read(p) {
    if (!p) { toast('Brahmarakshas', 'Look at someone, then B', 'info', 2); return false; }
    if (!use('brahma')) { toast('Brahmarakshas', 'Spent for today. Back tomorrow', 'warn', 2.5); return false; }
    const k = persona(p), mem = ppl().mem?.get(p.id) || {}, rep = ppl().rep?.at?.(p.x, p.z) || { good: 0, bad: 0 };
    const mood = p.mode === 'fight' ? 'ready to fight' : p.angry > 0 ? 'angry' : p.grudge > 0 ? 'holding a grudge' : p.mode === 'flee' ? 'frightened' : p.fallen > 0 ? 'hurt' : 'calm';
    const you = mem.hit ? 'You hit them, and they haven\'t forgotten' : mem.shoved ? 'You shoved them; still sore about it' : mem.saw ? 'They saw what you did and are wary of you' : rep.bad > 2 ? 'They\'ve heard about you round here, and not good things' : rep.good > 2 ? 'They\'ve heard good things about you' : 'They don\'t know you';
    const sec = SECRET[k] || SECRET.kaka, sc = sec[Math.abs(p.id || 0) % sec.length];
    readP = p; readT = 7;
    toast(nameOf(p), `${WHO[k] || k}, ${DOING[p.mode] || 'about'}. ${mood[0].toUpperCase() + mood.slice(1)}. ${you}. Keeps to themselves: ${sc}.${p.cash !== undefined ? ` Carrying ₹${Math.round(p.cash)}.` : ''}`, 'info', 7);
    return true;
  }
  const readable = () => aimAt((ppl()?.list || []).filter(p => !p.hidden && !p._vetalBody && p.look), 14);

  // ---------------------------------------------------------------- Munja (N, on foot): everyone near, through walls
  let senseT = 0;
  function senseOn(t = SENSE) { if (!use('munja')) { toast('Munja', 'Spent for today. Back tomorrow', 'warn', 2.5); return false; } senseT = t; toast('Munja', `Everyone within ${SENSE_R} m, through the walls: red to fight, amber wary, green kind, blue police`, 'info', 3); return true; }
  const intent = (p) => {
    const m = ppl().mem?.get(p.id) || {};
    if (p.cop || p.police) return '#4aa3ff';
    if (p.mode === 'fight' || p.angry > 0 || p.grudge > 0 || (m.hit && /dada|bhaiya|tai/.test(p.persona || ''))) return '#ff4d4d';
    if (p.mode === 'flee' || m.saw || m.hit || m.shoved) return '#ffb020';
    if (p.act && p.act.clip === 'wave') return '#3ddc84';
    return '#e9e2d0';
  };
  // the auras this frame: Vetal's on whoever you're going into (only while you hold V), Brahmarakshas' on whoever you
  // read, Munja's on everyone near (through walls), and your own body while you're out of it
  function auraFrame(dt) {
    if (link && G.state === 'play') aura(bodyOf(link.p), '#b26bff', 0.25 + 0.85*Math.min(1, link.t/link.need));
    if (readP && readT > 0) { readT -= dt; aura(bodyOf(readP), '#ffb020', Math.min(0.8, readT*0.4)); }
    if (senseT > 0) {
      senseT -= dt;
      const F = R(), k = Math.min(1, senseT/1.2, (SENSE - senseT + 0.2)/0.8);
      let n = 0;
      for (const p of ppl().list) { if (p.hidden || n > 40 || Math.hypot(p.x - F.x, p.z - F.z) > SENSE_R) continue; const H = bodyOf(p); if (!H) continue; aura(H, p._vetalBody ? '#c79bff' : p.corpse ? '#777777' : intent(p), 0.9*k, true); n++; }
    }
    auraTick(dt);
  }

  // ---------------------------------------------------------------- dragging someone who's down (your own body too)
  const downed = () => { if (!P().onFoot) return null; const F = R(), th = yaw(); let best = null, bs = 1e9; for (const p of (ppl()?.list || [])) { if (p.hidden || !(p.fallen > 0)) continue; const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz); if (d > 1.9) continue; const a = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - th), Math.cos(Math.atan2(dz, dx) - th))); if (a > 1.2) continue; if (d + a < bs) { bs = d + a; best = p; } } return best; };
  const grab = new THREE.Vector3();
  let zPress = false;
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyZ' || e.repeat || G.state !== 'play' || !G.player?.onFoot) return;
    if (!drag && !downed()) return;               // nobody down at your feet: Z is the weapons wheel as ever
    e.preventDefault(); e.stopImmediatePropagation(); zPress = true;
  }, true);
  addEventListener('keyup', (e) => { if (e.code === 'KeyZ' && zPress) e.stopImmediatePropagation(); }, true);
  function dragStep(dt) {
    if (zPress) {
      zPress = false;
      if (drag) { drag = null; toast('Drag', 'Let go', 'info', 1); }
      else { const p = downed(); if (p) { drag = { p, ease: 0 }; toast('Drag', `Dragging ${p._vetalBody ? 'your own body' : nameOf(p)}. Z to let go`, 'info', 2.5); } }
    }
    if (!drag) return;
    const p = drag.p, Pl = P(), F = Pl.foot;
    if (!Pl.onFoot || p.hidden || !ppl().list.includes(p)) { drag = null; return; }
    // a heavy thing behind you: slow, and they come along a step behind, head first, pulled by the shoulders
    Pl.limpT = Math.max(Pl.limpT || 0, 0.3);
    const th = F.yaw, bx = F.x - Math.cos(th)*1.05, bz = F.z - Math.sin(th)*1.05;
    drag.ease = Math.min(1, drag.ease + dt*2.5);
    const k = 1 - Math.exp(-dt*6*drag.ease);
    p.x += (bx - p.x)*k; p.z += (bz - p.z)*k; p.v = 0; p.yaw = Math.atan2(F.z - p.z, F.x - p.x);
    p.fallen = Math.max(p.fallen, 4); if (p.anchor) { p.anchor.x = p.x; p.anchor.z = p.z; }
    if (Math.hypot(p.x - F.x, p.z - F.z) > 3) { drag = null; return; }
    // the near hand back on them
    const H = Pl.human; if (H) { grab.set(p.x + Math.cos(p.yaw)*0.55, (G.W?.surf ? G.W.surf.height(p.x, p.z) : F.y) + 0.35, p.z + Math.sin(p.yaw)*0.55); try { ikArm(H, 'r', grab, null, drag.ease); } catch (e) { /* no arm here */ } }
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
      if (P().onFoot && took('KeyB')) read(readable());
      if (P().onFoot && took('KeyN')) senseOn();
      dragStep(el);
      if (dz && !dizzyPose(P().human, dz, el, P().foot.yaw)) dz = null;
    } else { wasV = false; held = 0; target = null; if (link) { link = null; humOn(0); } }
    // a heavy head after you were thrown out: blurred, slow, clearing over the next minute
    if (dazeT > 0) { dazeT -= el; P().limpT = Math.max(P().limpT || 0, 0.3); const cv = G.renderer?.domElement; if (cv) cv.style.filter = dazeT > 0 ? `blur(${Math.min(3, dazeT/12).toFixed(2)}px) saturate(${(1 - Math.min(0.4, dazeT/100)).toFixed(2)})` : ''; }
    auraFrame(el);
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
    sh.reg('return body', 'Vetal: back to your own body', () => { if (!home) throw new Error('you are yourself'); leaveSoft(); say('home', 'ok'); }, { group: 'powers' });
    sh.reg('read <who:sel>', 'Brahmarakshas on anyone (uses one)', ([s]) => { const [p] = persons(s); read(p); }, { group: 'powers' });
    sh.reg('sense [seconds:num]', 'Munja (uses one)', ([t]) => { senseOn(+t || SENSE); }, { group: 'powers' });
    sh.reg('toggle powerfree [on:onoff]', 'powers cost nothing (testing)', ([a]) => { S.free = a === undefined ? !S.free : a === 'on'; save(); say(`free ${S.free ? 'on' : 'off'}`, 'ok'); }, { group: 'powers' });
    sh.reg('set mastery <amount:num>', 'Vetal mastery 0 to 1', ([x]) => { S.xp = Math.max(0, Math.min(1, +x))*1800; save(); say(`mastery ${Math.round(mastery()*100)}%`, 'ok'); }, { group: 'powers' });
    if (sh.order && !sh.order.includes('powers')) sh.order.splice(sh.order.indexOf('you') + 1, 0, 'powers');
  };
  shell();
  return api;
}
