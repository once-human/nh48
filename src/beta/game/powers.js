// The three powers, in every mode.
//   Vetal (V)          take someone over. Hold V with them in the middle of the screen (up to 135 m off) and keep them
//                      there for five seconds while the link builds: the glow comes up round their head, the purple in
//                      from the edges of your eyes, the whole time. Look across to someone else and it moves to them,
//                      from nothing again. Let go early and it costs a little (1 to 3, mostly 1). At the end it goes
//                      dark: you wake up in them, or they throw you off (rare, fresh, at full strength; likelier
//                      with a strong will, a low bar, and every hop). Then let go of V: you're them, their body,
//                      their hunger, their jhola. Tap V to go home (they go dizzy, you're out, and a moment later your
//                      own body gets up off the ground); hold V on someone else to hop. Doing what they never would (an
//                      aaji sprinting, a gentle one throwing punches, a cop breaking the law) builds strain, and it
//                      eases off once you stop; too much and they throw you out, and you come round two minutes later
//                      with a heavy head.
//                      100 units. Going in costs 5 to 8, each hop after more (6–9, 7–10, 8–12, 10–15, then up), the
//                      low end mostly; thrown off at the door 3 to 5. Being someone else costs too: a full bar alone
//                      lasts about three minutes. It comes back while you're yourself: slowly by day, faster at night,
//                      and fastest near a cremation ground or a cemetery, or a Vetal temple (the real ones on the map).
//   Brahmarakshas (B)  on foot, the learned one: hold B on someone for three seconds (up to 40 m) and you know them:
//                      who they are, their age and work, where they live and where they're going, their mood and what
//                      they make of you, what they carry, what's on their mind, what they keep to themselves, and
//                      how hard they'd fight Vetal. Three a game day; let go early and it costs nothing.
//   Munja (N)          on foot, the one in the peepal tree: hold N and everyone within 60 m glows through the walls
//                      (red to fight, amber wary of you, green kind, blue the police, your own body violet), with
//                      where each of them is about to walk lit on the ground ahead of them. While you hold it, click
//                      someone to rustle the bushes behind them (they whip round, their back to you), or right-click
//                      a spot to flick a stone there (everyone near turns to it; a constable walks over to look).
//                      Its own bar: it goes eight times as fast as being in someone (about 22 s full), and comes back
//                      three times as fast as Vetal.
//   Z                  someone out cold at your feet (your own body too, while you're away in someone): drag them
//                      by the shoulders; Z again to lay them down (beta/game/acts.js).
// The keys are in Pause → Controls like every other. In the terminal: list powers, refill power, set power, take,
// return body, read, sense, startle, throw stone, drag, toggle powerfree, the test commands, and the power.* variables.
import * as THREE from 'three';
import { ITEMS } from '@orig/game/life.js';
import { dizzyPose } from './dizzy.js';
import { auras } from './aura.js';
import { people } from './wake.js';
import { acts } from './acts.js';
import { hostBody } from './host.js';
import { Vehicle } from '@orig/vehicles/vehicle.js';

const STORE = 'puneri_powers', DAILY = 3;
// how strong your powers are: level 1 is half of what they'll be once they've grown (levelling up raises LV toward 1).
// It scales every reach (who you can take, read or sense, how far from your body you can go), the bars (each use costs
// 1/LV as much, so a full bar lasts LV as long) and how hard a take is (the chance of being thrown off, 1/LV)
const LV = 0.5;
const V_HOLD = 5, V_RANGE = 135*LV, B_HOLD = 2, B_RANGE = 40*LV, N_R = 60*LV, N_UP = 1.0;
const V_LEASH = Math.min(500, 1000*LV);         // the most Vetal ever reaches from your own body (m); each person less (leashOf)
const STAY = 100/180;                           // units a second, being someone ordinary close to your own body
const N_DRAIN = 8*STAY;
const R_DAY = 0.075, R_NIGHT = 0.405, N_REFILL = 3;    // units a second
const HOP = [[5, 8], [6, 9], [7, 10], [8, 12], [10, 15]];
// how hard each kind of person holds on to themselves
const WILL = { kaka: 1, ajoba: 0.75, dada: 1.6, bhaiya: 1.25, collegeboy: 0.9, kpguy: 1, kaku: 1, aaji: 0.75, tai: 1.2, aunty: 1, collegegirl: 0.9, kpgirl: 1, cop: 2 };
const OLD = new Set(['ajoba', 'aaji']);
const GENTLE = new Set(['ajoba', 'aaji', 'kaku', 'aunty', 'collegegirl', 'collegeboy', 'kaka']);
const WHO = { kaka: 'kaka, a man of the neighbourhood', ajoba: 'ajoba, an old man', dada: 'dada, the local tough', bhaiya: 'bhaiya, a working man', collegeboy: 'a college student', kpguy: 'a Koregaon Park regular', kaku: 'kaku, a woman of the neighbourhood', aaji: 'aaji, an old woman', tai: 'tai, sure of herself', aunty: 'an aunty', collegegirl: 'a college student', kpgirl: 'a Koregaon Park regular', cop: 'Pune police' };
const AGE = { kaka: [45, 60], kaku: [42, 58], ajoba: [66, 84], aaji: [64, 82], dada: [24, 38], bhaiya: [21, 40], collegeboy: [18, 22], collegegirl: [18, 22], kpguy: [24, 33], kpgirl: [23, 31], tai: [30, 45], aunty: [38, 52], cop: [27, 52] };
const WORK = {
  kaka: ['runs a kirana shop', 'a clerk in a government office', 'an LIC agent', 'an electrician'],
  kaku: ['keeps house, and the whole building', 'runs a mess from home', 'a schoolteacher', 'a tailor'],
  ajoba: ['retired from the railways', 'a retired schoolteacher', 'retired from a factory job', 'a retired bank clerk'],
  aaji: ['looks after the grandchildren', 'a retired teacher', 'makes papad and pickle to sell'],
  dada: ['runs errands for a local politician', 'owns two autos and rents them out', 'a gym trainer', 'calls himself a property consultant'],
  bhaiya: ['a construction worker', 'a delivery rider', 'a security guard', 'runs a pani puri cart'],
  collegeboy: ['an engineering student', 'a commerce student', 'studying for the MPSC exams'],
  collegegirl: ['an engineering student', 'studying law', 'studying for the MPSC exams'],
  kpguy: ['a software engineer', 'works at a startup', 'a bartender', 'a designer'],
  kpgirl: ['a software engineer', 'works at a startup', 'a designer', 'a photographer'],
  tai: ['a nurse', 'a bank officer', 'runs a beauty parlour', 'a schoolteacher'],
  aunty: ['keeps house', 'runs a boutique', 'a yoga teacher'],
  cop: ['a constable at the local chowki', 'traffic police', 'a head constable'],
};
const CASH = { kaka: [200, 900], kaku: [150, 700], ajoba: [100, 600], aaji: [100, 500], dada: [1000, 5000], bhaiya: [100, 600], collegeboy: [50, 400], collegegirl: [80, 500], kpguy: [500, 3000], kpgirl: [400, 2500], tai: [300, 1500], aunty: [300, 1200], cop: [300, 1500] };
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
const DOING = { walk: 'on their way somewhere', stand: 'waiting about', watch: 'watching something', fight: 'in a fight', flee: 'running from something', free: 'going somewhere', fixed: 'at their place', inside: 'inside' };
// where Vetal comes back fastest: the burning grounds and burial grounds, and his own temples
const HAUNT = /cemetery|crematorium|shamshan|smashan|kabrastan|qabrastan|graveyard|burial/i;

const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } };
const persona = (p) => p.cop || p.police ? 'cop' : p.persona || 'kaka';
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x*x*(3 - 2*x); };
const rnd = (id, k) => { let h = (Math.abs(id | 0) + 1)*2654435761 ^ k*40503; h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^ (h >>> 16)) >>> 0)/4294967296; };

export function powers(G) {
  const L0 = load();
  const S = Object.assign({ vu: L0.bar !== undefined ? L0.bar*100 : 100, mu: 100, free: false, day: -1, brahma: 0 }, L0);
  delete S.bar; delete S.xp; delete S.munja;
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* private mode */ } };
  const P = () => G.player, ppl = () => G.people, R = () => P().onFoot ? P().foot : P();
  const yaw = () => P().onFoot ? P().foot.yaw : P().th;
  const toast = (a, b, k = 'info', t = 3) => G.hud?.toast?.(a, b, k, t);
  const nameOf = (p) => p.name || G.talkUI?.nameOf?.(p) || WHO[persona(p)] || 'someone';
  const day = () => Math.floor((G.clock || 0)/24);
  const nightK = () => { const h = G.hour ?? 12; return h >= 20 || h < 5 ? 1 : h >= 18 ? (h - 18)/2 : h < 7 ? 1 - (h - 5)/2 : 0; };
  const left = () => { if (S.day !== day()) { S.day = day(); S.brahma = 0; save(); } return S.free ? DAILY : DAILY - S.brahma; };
  const hpMax = () => G.life?.hpMax || 100;

  const AU = auras(G), PE = people(G), AC = acts(G), HB = hostBody(G);

  // ---------------------------------------------------------------- on the game's own HUD: two more rings in the vitals
  const veil = document.createElement('div'); veil.id = 'nh-veil';
  veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0';
  const css = document.createElement('style');
  css.textContent = `.vit .v-vt { color: #b26bff; } .vit .v-mj { color: #bcd4ff; } .vit .v-vt.in svg.gl, .vit .v-mj.in svg.gl { animation: v2pulse 1.6s ease-in-out infinite; }
    body.nh-nohud #nh-veil { display: none; } .toast.nh-read { max-width: min(460px, 86vw); } .toast.nh-read .tt-sub { white-space: pre-line; line-height: 1.45; text-align: left; }`;
  document.head.appendChild(css);
  const rings = {};
  const GLYPH = {
    vt: '<path d="M12 2.5c.6 3.1 4.6 5.2 4.6 10.1a4.6 4.6 0 0 1-9.2 0c0-2.3 1.2-3.9 2.3-4.9.1 1.6.8 2.7 1.9 3.2-.6-2.9.1-5.8.4-8.4Z"/><circle cx="12" cy="15.4" r="1.6" fill="rgba(0,0,0,.45)"/>',
    // a peepal leaf, its long tip up
    mj: '<path d="M12 1.6c-.4 1.7-1.5 2.7-2.9 3.7C7 6.9 5.5 9.3 5.5 12.5a6.5 6.5 0 0 0 5.5 6.4V22h2v-3.1a6.5 6.5 0 0 0 5.5-6.4c0-3.2-1.5-5.6-3.6-7.2-1.4-1-2.5-2-2.9-3.7Z"/><path d="M12 6.5v12" stroke="rgba(0,0,0,.4)" stroke-width="1.1" fill="none"/>',
  };
  const mount = () => {
    const Hd = G.hud; if (!Hd || !Hd.vit || !Hd._vitEls || !document.body) { setTimeout(mount, 500); return; }
    document.body.appendChild(veil);
    const C = Hd.vitC || 2*Math.PI*15;
    for (const [k, n] of [['vt', 'Vetal'], ['mj', 'Munja']]) {
      const sp = document.createElement('span'); sp.className = 'v-' + k; sp.title = n;
      sp.innerHTML = `<svg viewBox="0 0 36 36"><circle class="tr" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0"/></svg><svg class="gl" viewBox="0 0 24 24">${GLYPH[k]}</svg>`;
      Hd.vit.appendChild(sp); rings[k] = { sp, fg: sp.querySelector('.fg'), C };
    }
  };
  mount();
  let black = false, strainShow = 0;
  const ringSet = (R, v, on, low) => { if (!R) return; const o = (R.C*(1 - clamp01(v))).toFixed(1); if (R.fg._o !== o) { R.fg._o = o; R.fg.setAttribute('stroke-dashoffset', o); } R.sp.classList.toggle('in', on); R.sp.classList.toggle('low', low); };
  const draw = (dt) => {
    ringSet(rings.vt, S.vu/100, !!host || !!link, S.vu < 12);
    ringSet(rings.mj, S.mu/100, nk > 0, S.mu < 12);
    if (black) return;
    strainShow += (strain - strainShow)*Math.min(1, dt*0.6);        // (it spreads in slowly, as the strain builds)
    // the edges of your eyes: purple while the link builds (from the first moment, evenly to the end) and while you're
    // in someone (deeper as they fight you); amber while you read someone; pale while Munja's open
    if (!host) edgeK = 0;
    const kv = host ? Math.min(1, 0.32 + 0.68*clamp01(strainShow) + 0.68*edgeK) : link ? 0.12 + 0.88*clamp01(link.t/link.need) : 0;
    const kb = bl ? 0.08 + 0.55*clamp01(bl.t/B_HOLD) : 0, kn = smooth(nk)*0.45;
    const L = [];
    if (kv > 0.005) L.push(`radial-gradient(ellipse at center,transparent ${54 - kv*24}%,rgba(${70 + strainShow*70},10,${120 + strainShow*20},${(0.3 + kv*0.45).toFixed(3)}) 100%)`);
    if (kb > 0.005) L.push(`radial-gradient(ellipse at center,transparent ${60 - kb*20}%,rgba(255,170,30,${(0.15 + kb*0.4).toFixed(3)}) 100%)`);
    if (kn > 0.005) L.push(`radial-gradient(ellipse at center,transparent ${62 - kn*18}%,rgba(170,200,255,${(0.1 + kn*0.35).toFixed(3)}) 100%)`);
    veil.style.transition = ''; veil.style.background = L.join(',') || 'none'; veil.style.opacity = L.length ? '1' : '0';
  };
  // the world goes dark a moment (going in, coming home)
  function blackout(fn, hold = 260) {
    black = true; veil.style.transition = 'opacity .25s'; veil.style.background = '#000'; veil.style.opacity = '1';
    setTimeout(() => { try { fn(); } catch (e) { console.warn('vetal', e); } finally { setTimeout(() => { veil.style.transition = 'opacity .7s'; veil.style.opacity = '0'; setTimeout(() => { black = false; }, 700); }, 120); } }, hold);
  }

  // ---------------------------------------------------------------- sounds (made here, nothing loaded)
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
    hum.g.gain.setTargetAtTime(0.2*k, t, 0.08); hum.o2.frequency.setTargetAtTime(78.5 + k*40, t, 0.1); hum.f.frequency.setTargetAtTime(420 + k*900, t, 0.1);
  };
  let noise = null;
  const noiseBuf = (C) => { if (noise) return noise; const n = C.sampleRate, b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random()*2 - 1; return (noise = b); };
  // where a sound is, for your ears: quieter further off, to the side it's on
  function placed(x, z, C, out) {
    const cam = G.camera, cp = cam.position, dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz) || 1, rx = -dir.z, rz = dir.x;
    const g = C.createGain(); g.gain.value = 1/(1 + d/7);
    const pn = C.createStereoPanner(); pn.pan.value = Math.max(-0.9, Math.min(0.9, (dx*rx + dz*rz)/d));
    g.connect(pn); pn.connect(out); return g;
  }
  // leaves and dry twigs pushed aside: a run of small crackles in a hiss, rising and falling
  function rustle(x, z) {
    const a = G.audio; if (!a || !a.ctx || !a.master) return; const C = a.ctx, t0 = C.currentTime;
    const out = placed(x, z, C, a.master);
    for (let i = 0; i < 26; i++) {
      const s = C.createBufferSource(); s.buffer = noiseBuf(C);
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600 + Math.random()*3200; bp.Q.value = 1.4 + Math.random()*2;
      const g = C.createGain(), at = t0 + 0.02 + Math.pow(i/26, 0.85)*0.75 + Math.random()*0.03, L = 0.025 + Math.random()*0.06, v = 0.25 + 0.5*Math.sin(Math.PI*i/26);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + 0.004); g.gain.exponentialRampToValueAtTime(0.001, at + L);
      s.connect(bp); bp.connect(g); g.connect(out); s.start(at, Math.random()*0.8, L + 0.02);
    }
    const s = C.createBufferSource(); s.buffer = noiseBuf(C);
    const hp = C.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const g = C.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12, t0 + 0.15); g.gain.linearRampToValueAtTime(0, t0 + 0.8);
    s.connect(hp); hp.connect(g); g.connect(out); s.start(t0, 0, 0.85);
  }
  // a small stone on the road: a sharp tok, and two smaller ones as it skips
  function stone(x, z) {
    const a = G.audio; if (!a || !a.ctx || !a.master) return; const C = a.ctx, t0 = C.currentTime;
    const out = placed(x, z, C, a.master);
    [[0, 1, 2300], [0.13, 0.45, 2700], [0.22, 0.2, 3100]].forEach(([dt, v, fq]) => {
      const s = C.createBufferSource(); s.buffer = noiseBuf(C);
      const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 9;
      const g = C.createGain(), at = t0 + dt;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.9*v, at + 0.002); g.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
      s.connect(bp); bp.connect(g); g.connect(out); s.start(at, Math.random()*0.5, 0.09);
    });
  }

  // ---------------------------------------------------------------- aiming: whoever's in the middle of the screen
  const cp = new THREE.Vector3(), cf = new THREE.Vector3(), tv = new THREE.Vector3();
  function aimAt(list, range) {
    const cam = G.camera; if (!P().onFoot || !cam) return null;
    cam.getWorldPosition(cp); cam.getWorldDirection(cf);
    const F = R(); let best = null, bs = 1e9;
    for (const p of list) {
      const d = Math.hypot(p.x - F.x, p.z - F.z); if (d > range || d < 0.4) continue;
      const y = G.W?.surf ? G.W.surf.height(p.x, p.z) : 0;
      // the camera's line passes through their body (chest; more give the further off they are)
      // snaps to whoever's nearest the middle of the screen within ~8 degrees of it (a metre's give close up), and
      // stays on the one it's on unless someone else is clearly more in the middle
      tv.set(p.x, y + 1.15, p.z).sub(cp); const along = tv.dot(cf); if (along <= 0.5) continue;
      const off = Math.sqrt(Math.max(0, tv.lengthSq() - along*along));
      if (off > Math.max(1.0, along*0.14)) continue;
      let sc = Math.atan2(Math.max(0, off - 0.3), along) + along*0.0004;
      if (p === stick) sc *= 0.7;
      if (sc < bs) { bs = sc; best = p; }
    }
    return best;
  }
  // a dot in the middle of the screen while you're aiming V or B (there's no crosshair on foot otherwise): pale while
  // it's on nobody, the power's colour once it's snapped to someone
  let dotEl = null;
  function aimDot(on, onSomeone) {
    if (!dotEl && on) { dotEl = document.createElement('div'); dotEl.style.cssText = 'position:fixed;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;pointer-events:none;z-index:30;transition:background .12s,box-shadow .12s'; document.body.appendChild(dotEl); }
    if (!dotEl) return;
    dotEl.style.display = on ? 'block' : 'none';
    const c = link ? '#b26bff' : bl ? '#ffb020' : 'rgba(255,255,255,.55)';
    dotEl.style.background = c; dotEl.style.boxShadow = onSomeone ? `0 0 10px ${c}` : 'none';
  }
  let stick = null;                  // who the aim's on (Vetal's link or Brahmarakshas' read)
  const candidates = () => ppl() ? ppl().list.filter(p => !p.hidden && !p.corpse && !(p.fallen > 0) && !p.pax && !p._vetalBody && !p._wake && p.look) : [];
  // and whoever's in the traffic round you: a rider close up is a real body on the seat (people/crowd.js riders); in a
  // car, a bus, a far two-wheeler there's nobody drawn, so they're someone at the wheel made once for that vehicle
  const DRV = ['kaka', 'dada', 'bhaiya', 'kpguy', 'collegeboy'];
  const vehOf = (q) => q && (q._drv ? q.veh : q.rideOf) || null;
  function drv(o) {
    const r = o._riders && o._riders[0];
    if (r && r.body) return r;
    let d = o._drv;
    if (!d) {
      const kit = G.W?.kit; if (!kit) return null;
      const female = Math.random() < 0.15, rng = { next: Math.random, chance: (q) => Math.random() < q, range: (a, b) => a + Math.random()*(b - a), pick: (a) => a[Math.floor(Math.random()*a.length)], int: (a, b) => a + Math.floor(Math.random()*(b - a + 1)) };
      d = o._drv = { _drv: true, veh: o, id: (o.id || 0)*4 + 1e7 + 3, female, look: kit.randomLook(rng, { female, helmet: !!o.T?.two && o.type !== 'cycle' }), persona: female ? (Math.random() < 0.5 ? 'tai' : 'aunty') : DRV[Math.floor(Math.random()*DRV.length)], hp0: 100, mode: 'drive' };
    }
    d.x = o.rx ?? o.x; d.z = o.rz ?? o.z; d.yaw = Math.atan2(o.hz ?? 0, o.hx ?? 1);
    return d;
  }
  const inVeh = (range) => { const out = [], F = R(); for (const o of G.traffic?.list || []) { if (!o.alive || o.wreck || o.fallen > 0 || !o.T || o.parked) continue; if (Math.abs(o.x - F.x) > range || Math.abs(o.z - F.z) > range) continue; const d = drv(o); if (d) out.push(d); } return out; };
  const vCands = () => candidates().concat(inVeh(V_RANGE));
  const stillThere = (q) => { const o = vehOf(q); return o ? !!G.traffic?.list.includes(o) && o.alive && !o.wreck : ppl().list.includes(q); };
  const bodyOf = (p) => p && p.body && p.body.H;

  // ---------------------------------------------------------------- Vetal
  let link = null, host = null, home = null, strain = 0, calm = 0, held = 0, wasV = false, justIn = false, leaving = false;
  let heat0 = 0, hp0 = 100, punches = 0, coolT = 0, hops = 0, dazeT = 0, dazeMax = 60, hauntT = 0;
  const raw = (look) => Object.getPrototypeOf(P()).setLook.call(P(), look);
  const fromBody = () => home ? Math.hypot(R().x - home.x, R().z - home.z) : 0;
  const will = (p) => WILL[persona(p)] || 1;
  // how far from your body you can go in this one: 300 to 500 m, mostly close to 500 (the same person, the same reach)
  const leashOf = (id) => { const r = ((Math.sin(((id | 0) + 1)*12.9898)*43758.5453) % 1 + 1) % 1; return V_LEASH*(1 - 0.4*r*r*r); };
  let edgeK = 0, edgeBeeps = 0;
  // how it's going: their will, how far you are from your own body, how low you are; mostly near the low end
  const sit = (p) => Math.pow(clamp01(0.5*(will(p) - 0.75)/1.25 + 0.3*Math.min(1, Math.hypot(p.x - (home ? home.x : R().x), p.z - (home ? home.z : R().z))/V_RANGE) + 0.2*(1 - S.vu/100)), 1.6);
  const hopRange = (k) => k < HOP.length ? HOP[k] : [10 + 3*(k - 4), 15 + 4*(k - 4)];
  const costIn = (p) => { const [lo, hi] = hopRange(hops); return lo + (hi - lo)*sit(p); };
  const holdFor = (p) => V_HOLD*(0.92 + 0.08*will(p));
  const spend = (u) => { if (!S.free) S.vu = Math.max(0, S.vu - u/LV); };
  function earlyCost(l) {
    if (l.t < 0.4) return;
    const p = l.p, d = Math.hypot(p.x - R().x, p.z - R().z);
    spend(1 + 2*Math.pow(clamp01(0.45*l.t/l.need + 0.3*(will(p) - 0.75)/1.25 + 0.25*d/V_RANGE), 2));
  }

  function take(q) {
    humOn(0);
    if (!q) throw new Error('nobody to take');
    spend(costIn(q));
    const Pl = P(), F = R();
    if (AC.dragging) AC.stopDrag();
    if (!home) {
      // your own body stays where it fell: one of the street's people now, out cold, for as long as you're away
      // (indoors there's no street within reach to make someone from, and none was made: you left no body in the
      // room. Made where you stand, whatever's round you, like the room's own people)
      let body = G.interiors?.inside ? null : ppl().spawnAt(Pl.look, F.x, F.z, 'kaka');
      if (!body && G.W?.graph?.edges?.[0]) {
        const L = Pl.look; body = ppl().make(G.W.graph.edges[0], 1, 1, { female: !!L.female, mode: 'fixed', adult: true });
        Object.assign(body, { look: L, female: !!L.female, x: F.x, z: F.z, onRoad: false, fixed: true, interior: !!G.interiors?.inside, shirt: [L.top.r, L.top.g, L.top.b], lower: [L.bottom.r, L.bottom.g, L.bottom.b], skin: [L.skin.r, L.skin.g, L.skin.b] });
      }
      // (fixed: the street's crowd lets its far people go, 150 m off, and new ones walk in near you. Your body isn't
      // one of them: it lies where it fell however far you go)
      if (body) { Object.assign(body, { fallen: 1e6, ko: true, unconscious: true, mode: 'stand', wait: 1e9, v: 0, anim: null, yaw: yaw(), _vetalBody: true, persona: null, fixed: true, _downAt: performance.now() }); body.anchor = { x: body.x, z: body.z }; }
      home = { look: Pl.look, x: F.x, z: F.z, yaw: yaw(), hp: Pl.hp ?? 100, body, t: 0, crowd: false };
    } else if (host) release(host, F.x, F.z, 'soft');
    host = { look: q.look, persona: q.persona, cop: q.cop || q.police, name: q.name, female: !!(q.female || q.look?.female), id: q.id, kind: persona(q), hp0: q.hp0 || 100 };
    const hpR = clamp01((q.hp ?? q.hp0 ?? 100)/(q.hp0 || 100));
    HB.enter(q, Pl);
    const x = q.x, z = q.z, th = q.yaw || 0, o = vehOf(q);
    if (!o) { ppl().remove(q); raw(host.look); Pl.teleportFoot(x, z, th, G.traffic); }
    else {
      // at their wheel, as it was going: the same vehicle, the same speed, you driving it now
      raw(host.look);
      if (!Pl.onFoot) Pl.exit(G.traffic, true);
      Pl.teleportFoot(o.x, o.z, th, G.traffic);
      const veh = new Vehicle(Pl.W, Pl.scene, Pl.vmats, o.type, o.col);
      veh.reset(o.x, o.z, Math.atan2(o.hz ?? 0, o.hx ?? 1)); veh.v = Math.max(0, o.v || 0);
      if ((o.y || 0) > 0.5 && Pl.W.fly) { const qd = Pl.W.fly.probe(o.x, o.z); if (qd) { veh.deck = qd.s.f; veh.y = qd.h; } }
      veh.helmet = false; veh.plate = Pl.randomPlate ? Pl.randomPlate() : veh.plate; veh.vetal = true;
      const idx = G.traffic.list.indexOf(o); if (idx >= 0) G.traffic.despawn(idx);
      Pl.switchTo(veh);
    }
    Pl.hp = hpMax()*(hpR || 1); hp0 = Pl.hp; heat0 = G.police?.heat || 0; strain = 0; strainShow = 0; punches = 0; calm = 0;
    hops++;
    AC.shudder();
    toast('Vetal', `You are ${host.name || WHO[host.kind] || 'someone else'} now. Tap V to go back`, 'info', 3);
    coolT = 4;
    return true;
  }
  // the moment of going in: dark, and either you wake up in them or they throw you off. How likely that is comes
  // from them and from you: a strong will, a low bar, one hop too many (fresh, at full strength, an ordinary person:
  // about one in a hundred)
  function attempt(q) {
    const w = will(q);
    const pr = S.free ? 0 : Math.min(0.6, 0.009*w*w*(1 + 4*(1 - S.vu/100))*(1 + 0.9*hops)/LV);
    humOn(1);
    blackout(() => {
      humOn(0);
      if (!stillThere(q)) return;
      if (Math.random() < pr) {
        spend(3 + 2*sit(q));
        const who = nameOf(q);
        // they felt you at the door: startled, and wary of you (a dada squares up; one at the wheel leans on the horn)
        if (vehOf(q)) { const o = vehOf(q); o.angry = 6; if (G.traffic && !(o.honkT > 0)) { o.honkT = 2.5; G.traffic.honks.push({ x: o.x, z: o.z, kind: o.T?.honk, n: 3 }); } }
        else if ((q.angry = 3) && persona(q) === 'dada') { q.grudge = 30; ppl().watch(q, R().x, R().z, 3); } else ppl().flee?.(q, R().x, R().z, 10);
        if (host) throwOut(`${who} threw you off`);
        else { dazeT = 14; coolT = 10; AC.foughtOff(); toast('Vetal', `${who} fought you off`, 'warn', 3); }
      } else { take(q); justIn = !!G.input?.key('KeyV'); }          // (still holding V: that letting go isn't a tap)
    }, 420);
  }

  // the one you were in comes to, where you left them, with no idea how they got there
  function release(h, x, z, how, D) {
    HB.leave(P());
    const p = ppl().spawnAt(h.look, x, z, h.persona);
    if (!p) return;
    if (h.cop) p.cop = true; if (h.name) p.name = h.name;
    p.id = h.id; p.female = h.female; p.yaw = yaw(); p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
    p.hp = (p.hp0 || h.hp0 || 100)*clamp01((P().hp ?? 100)/hpMax());
    const sev = 1 + 0.25*Math.max(0, hops - 1);
    if (how === 'ko') { Object.assign(p, { fallen: 40, ko: true, unconscious: true, v: 0 }); return; }
    if (how === 'thrown') { p.act = { clip: 'getup', speed: 0.6, t: 0, dur: 1.57/0.6 }; PE.wake(p, { delay: 1.57/0.6, sev: sev + 0.3, hops, female: h.female }); return; }
    PE.wake(p, { D, sev, hops, female: h.female });
  }
  // how: soft (tapped V, or it ran out), thrown (they threw you out), ko (knocked out in them)
  function goHome(why, how = 'soft', D) {
    if (!home) return;
    const Pl = P();
    if (!Pl.onFoot) Pl.exit(G.traffic, true);                 // (they come to beside the vehicle you had them in)
    const F = R(), b = home.body;
    if (AC.dragging) AC.stopDrag();
    if (host) release(host, F.x, F.z, how, D);
    HB.home(Pl);
    host = null;
    // whatever the street did to your body while you were out of it
    let hp = home.hp;
    if (b) { if (b.corpse) hp = 12; else if (b.over) hp = Math.max(8, hp - b.over*1.2); }
    const bx = b ? b.x : home.x, bz = b ? b.z : home.z, by = b ? b.yaw ?? home.yaw : home.yaw;
    if (b) ppl().remove(b);
    raw(home.look);
    Pl.teleportFoot(bx, bz, by, G.traffic);
    Pl.hp = hp; home = null; strain = 0; humOn(0); hops = 0; coolT = 8;
    const hard = how !== 'soft';
    if (how === 'thrown' && !G.live && G.setHour) G.setHour(((G.hour + 2/60) % 24 + 24) % 24);
    // a minute of it whichever way you came back (worse thrown out): slow on your feet, the street swimming
    dazeT = dazeMax = hard ? 60 : 50;
    Pl.slowMul = () => dazeT > 0 ? 0.42 + 0.58*smooth(1 - dazeT/dazeMax) : 1;
    AC.wakeUp(hard);
    if (why) toast('Vetal', how === 'thrown' ? why + '. You come round two minutes later, head pounding' : why, 'warn', 4);
  }
  function leaveSoft(why) {
    if (!home || leaving) return;
    if (!host) { goHome(why, 'soft'); return; }
    leaving = true; AC.cancel();
    const D = { t: 0, ph: Math.random()*6, dur: 9, sev: 1 + 0.25*Math.max(0, hops - 1), hand: 'r' };
    AC.dizzyOut(D, 0.5, () => blackout(() => { leaving = false; goHome(why, 'soft', D); }));
  }
  function throwOut(why) {
    if (!home || leaving) return;
    leaving = true; AC.cancel();
    AC.thrownOut(() => blackout(() => { leaving = false; goHome(why, 'thrown'); }));
  }
  // the punch key and the mouse, counted while you're in someone (a gentle body fighting strains the hold)
  addEventListener('keydown', (e) => { if (host && e.code === 'KeyX' && !e.repeat) punches++; }, true);
  addEventListener('mousedown', (e) => { if (host && e.button === 0 && document.pointerLockElement && !(nk > 0)) punches++; }, true);

  let farSaid = false;
  function vetal(dt) {
    // hold V on someone until you're in them (then let go: you stay); hold it on someone else to hop; a tap goes home
    const down = !!G.input?.key('KeyV') && !leaving && !AC.busy, rel = !down && wasV;
    wasV = down;
    if (down) held += dt;
    if (coolT > 0) coolT -= dt;
    if (down && !link && held > 0.35 && !justIn && coolT <= 0 && !black && P().onFoot) {
      const p = aimAt(vCands(), V_RANGE);
      if (p) { if (!S.free && S.vu < hopRange(hops)[0]/LV) { toast('Vetal', 'Not enough left in you for that', 'warn', 2); held = -1e9; } else link = { p, t: 0, need: holdFor(p) }; }
    }
    if (rel) {
      if (justIn) justIn = false;
      else if (black) { /* going in */ }
      else if (link) { earlyCost(link); link = null; humOn(0); }
      else if (held > 0 && held < 0.35) { if (host) leaveSoft(); else toast('Vetal', 'Hold V with someone in the middle of the screen', 'info', 2); }
      held = 0;
    }
    if (link) {
      const p = aimAt(vCands(), V_RANGE);
      // look across to someone else and the link moves to them, from nothing again; look at nobody and it breaks
      if (p && p !== link.p) link = { p, t: 0, need: holdFor(p) };
      else if (!p) { link.lost = (link.lost || 0) + dt; if (link.lost > 0.2) { earlyCost(link); link = null; humOn(0); toast('Vetal', 'The link broke: keep them in the middle', 'warn', 1.6); } }
      else link.lost = 0;
      if (link) {
        link.t += dt;
        // they feel it: they stop and look round, uneasy
        if (link.t > 1.2 && !vehOf(link.p) && link.p.mode !== 'watch' && link.p.mode !== 'fight' && !link.p._startle) ppl().watch(link.p, link.p.x + Math.cos(link.p.yaw || 0)*4, link.p.z + Math.sin(link.p.yaw || 0)*4, 2.5);
        humOn(link.t/link.need);
        if (link.t >= link.need) { const q = link.p; link = null; attempt(q); }
      }
    }
    if (host) {
      // the cost of being someone else
      const d = fromBody(), w = WILL[host.kind] || 1;
      const LL = host.leash || (host.leash = leashOf(host.id ?? Math.random()*1e6));
      spend(STAY*(0.8 + 0.2*w)*(1 + d/(LL/2))*dt);
      // doing what they never would
      const Pl = P(), F = Pl.foot;
      if (OLD.has(host.kind) && Pl.onFoot && Math.hypot(F.vx || 0, F.vz || 0) > 3.6) { strain += dt*0.2; calm = 0; }
      if (punches) { strain += punches*(GENTLE.has(host.kind) ? 0.07 : host.kind === 'cop' ? 0.015 : 0.03); punches = 0; calm = 0; }
      const heat = G.police?.heat || 0;
      if (heat > heat0) { strain += (heat - heat0)*(host.kind === 'cop' ? 0.35 : 0.1); heat0 = heat; calm = 0; } else heat0 = heat;
      if ((Pl.hp ?? 100) < hp0) { strain += (hp0 - Pl.hp)*0.012; calm = 0; } hp0 = Pl.hp ?? 100;     // their pain loosens the hold, fast
      // nearing the end of the reach: the purple closes in, the link says so, and it beeps at you (the challan's sound),
      // once, again, a third time right at the edge
      edgeK = clamp01((d/LL - 0.7)/0.3);
      if (d > LL*0.8 && !farSaid) { farSaid = true; toast('Vetal', `The link's getting weaker: ${Math.round(LL - d)} m more and you're pulled home`, 'warn', 2.6); } else if (d < LL*0.72) { farSaid = false; edgeBeeps = 0; }
      const nb = d > LL*0.97 ? 3 : d > LL*0.91 ? 2 : d > LL*0.84 ? 1 : 0;
      if (nb > edgeBeeps) { edgeBeeps = nb; G.audio?.fine?.(); }
      calm += dt;
      if (calm > 3) strain = Math.max(0, strain - dt*0.1);
      if (S.free) strain = 0;
      if (!leaving && !AC.busy) {
        if (strain >= 1) throwOut('They threw you out');
        else if ((Pl.hp ?? 100) < 30) throwOut('Their body is too hurt to hold');
        // as far from your own body as this one lets you reach (LL): home past it
        else if (d > LL) leaveSoft('Too far from your body: the link snapped');
        else if (S.vu <= 0) leaveSoft('Vetal ran out: pulled home');
        else if (Pl.ko || (Pl.hp ?? 100) <= 0) { leaving = true; blackout(() => { leaving = false; goHome('Knocked out of them', 'ko'); }); }
      }
      // the street finds your body after a while
      if (home && !home.crowd && (home.t += dt) > 18 && home.body) { home.crowd = true; try { ppl().gather?.(home.body.x, home.body.z, 3, 'foot'); } catch (e) { /* no crowd here */ } }
    } else if (!link) {
      S.vu = Math.min(100, S.vu + dt*(R_DAY + (R_NIGHT - R_DAY)*nightK())*haunt(dt));
    }
  }
  // near the burning grounds, the burial grounds, a Vetal temple: it comes back three times as fast
  let haunts = null, hauntChk = 0, hauntName = null;
  const hauntSaid = new Set();
  function haunt(dt) {
    if (!haunts && (hauntChk -= dt) <= 0) {
      hauntChk = 5;
      const pl = G.W?.cityMap?.places || G.cityMap?.places;
      if (pl && pl.length) haunts = pl.filter(q => q.n && (HAUNT.test(q.n) || (/vetal/i.test(q.n) && (q.c === 'temple' || q.sub === 'temple' || /mandir|temple/i.test(q.n))))).map(q => ({ n: q.n, x: q.x, z: q.z }));
    }
    if (!haunts || !haunts.length) return 1;
    const F = R(); let best = null, bd = 1e9;
    if ((hauntT -= dt) <= 0) { hauntT = 1; for (const q of haunts) { const d = Math.hypot(q.x - F.x, q.z - F.z); if (d < bd) { bd = d; best = q; } } hauntName = best && bd < 400 ? { q: best, d: bd } : null; }
    if (!hauntName) return 1;
    const k = 1 + 2*clamp01(1 - (hauntName.d - 120)/280);
    if (k > 2.5 && !hauntSaid.has(hauntName.q.n) && S.vu < 99) { hauntSaid.add(hauntName.q.n); toast('Vetal', `${hauntName.q.n}: it comes back faster here`, 'info', 3); }
    return k;
  }

  // ---------------------------------------------------------------- Brahmarakshas (B, on foot): hold on someone
  let bl = null, bDone = false, readP = null, readT = 0;
  const readable = () => (ppl()?.list || []).filter(p => !p.hidden && !p._vetalBody && p.look).concat(inVeh(B_RANGE));
  function reading(p) {
    const k = persona(p), id = p.id || 0, mem = ppl().mem?.get(p.id) || {}, rep = ppl().rep?.at?.(p.x, p.z) || { good: 0, bad: 0 }, h = G.hour ?? 12;
    const [a0, a1] = AGE[k] || [30, 50], age = Math.round(a0 + (a1 - a0)*rnd(id, 1));
    const work = (WORK[k] || WORK.kaka)[Math.floor(rnd(id, 2)*(WORK[k] || WORK.kaka).length)];
    // home: one of the real neighbourhoods round here
    const subs = (G.hud?.suburbs || []).map(s => [s, Math.hypot(s.x - p.x, s.z - p.z)]).sort((x, y) => x[1] - y[1]).slice(0, 6);
    const homeA = subs.length ? subs[Math.floor(rnd(id, 3)*subs.length)][0].n : null;
    // where they're going: the real place at the end of their way, or the road they're on
    const places = G.W?.cityMap?.places || [];
    const nearPlace = (x, z, m) => { let b = null, bd = m; for (const q of places) { const d = Math.abs(q.x - x) + Math.abs(q.z - z); if (d < bd) { bd = d; b = q; } } return b; };
    let going = DOING[p.mode] || 'about';
    if (p.goal) { const q = nearPlace(p.goal.x, p.goal.z, 120); if (q) going = `heading to ${q.n}`; }
    else if (p.mode === 'walk' && p.e) { const rn = G.W?.graph?.names?.[p.e.name]?.[0]; if (rn) going = `walking along ${rn}`; }
    const mood = p.mode === 'fight' ? 'ready to fight' : p.angry > 0 ? 'angry' : p.grudge > 0 ? 'holding a grudge' : p.mode === 'flee' ? 'frightened' : p.fallen > 0 ? 'hurt' : (HB.vitalsFor(p).mood > 0.62 ? 'in a good mood' : 'calm');
    const you = mem.hit ? 'you hit them, and they haven\'t forgotten' : mem.shoved ? 'you shoved them; still sore about it' : mem.saw ? 'they saw what you did and are wary of you' : rep.bad > 2 ? 'they\'ve heard about you round here, and not good things' : rep.good > 2 ? 'they\'ve heard good things about you' : 'they don\'t know you';
    const [c0, c1] = CASH[k] || [100, 800], cash = p.cash !== undefined ? Math.round(p.cash) : Math.round((c0 + (c1 - c0)*rnd(id, 4))/10)*10;
    const bag = Object.keys(HB.bagFor(p)).map(it => (ITEMS[it]?.name || it).toLowerCase());
    // what's on their mind: the hour, the weather, what's near
    const V = HB.vitalsFor(p), mind = [];
    if (V.hunger < 0.35) mind.push('food'); else if (h >= 6 && h < 10) mind.push(OLD.has(k) ? 'the morning walk and the milk' : 'getting there on time'); else if (h >= 13 && h < 15) mind.push('lunch, and the heat'); else if (h >= 18 && h < 21) mind.push('what\'s for dinner'); else if (h >= 21 || h < 1) mind.push('getting home'); else if (h < 6) mind.push('sleep, and why they\'re still out'); else mind.push('the day\'s work');
    if (G.weather?.cur && /rain|storm/i.test(G.weather.cur)) mind.push('the rain');
    if (V.drunk > 0.3) mind.push('the last drink');
    if ((G.police?.heat || 0) > 0) mind.push('the sirens');
    const np = nearPlace(p.x, p.z, 45); if (np && /food|tapri|cafe|bakery|sweets|misal|thali|biryani/.test(np.c || np.sub || '')) mind.push(`the smell from ${np.n}`);
    if (mem.hit || mem.shoved) mind.push('you');
    const sec = (SECRET[k] || SECRET.kaka)[Math.abs(id) % (SECRET[k] || SECRET.kaka).length];
    const w = will(p), wl = w <= 0.8 ? 'weak' : w <= 1.05 ? 'ordinary' : w <= 1.3 ? 'firm' : w <= 1.7 ? 'strong' : 'iron';
    const [lo, hi] = hopRange(home ? hops : 0).map((x) => x/LV), est = Math.round(lo + (hi - lo)*sit(p));
    const pr = Math.min(0.6, 0.009*w*w*(1 + 4*(1 - S.vu/100))*(1 + 0.9*(home ? hops : 0))/LV);
    return {
      title: `${nameOf(p)}, ${age}`,
      lines: [
        `${work[0].toUpperCase() + work.slice(1)}${homeA ? ` · lives in ${homeA}` : ''}`,
        `${going[0].toUpperCase() + going.slice(1)} · ${mood}`,
        `Of you: ${you}`,
        `Carrying ₹${cash}${bag.length ? ' · ' + bag.join(', ') : ''}, a phone`,
        `On their mind: ${mind.slice(0, 3).join(', ')}`,
        `Keeps to themselves: ${sec}`,
        `Will: ${wl}. Vetal into them about ${est}; ${pr < 0.02 ? 'they won\'t fight you off' : pr < 0.08 ? 'they might fight you off' : 'they may well throw you off'}`,
      ],
    };
  }
  function read(p, free = false) {
    if (!p) return false;
    // as many reads as you like: no daily count any more
    const r = reading(p);
    toast(r.title, r.lines.join('\n'), 'info', 11);
    const T = G.hud?.toasts; if (T && T.length) T[T.length - 1].el.classList.add('nh-read');
    readP = p; readT = 9;
    return true;
  }
  function brahma(dt) {
    const down = !!G.input?.key('KeyB') && P().onFoot && !AC.busy;
    if (!down) { bl = null; bDone = false; return; }
    if (bDone) return;
    const p = aimAt(readable(), B_RANGE);
    if (!bl) {
      if (!p) return;
      bl = { p, t: 0 };
    } else if (p && p !== bl.p) bl = { p, t: 0 };       // the aim's moved to someone else: it goes with it
    else if (!p) { bl.lost = (bl.lost || 0) + dt; if (bl.lost > 0.25) { bl = null; return; } } else bl.lost = 0;
    bl.t += dt;
    if (bl.t >= B_HOLD) { read(bl.p); bl = null; bDone = true; }
  }

  // ---------------------------------------------------------------- Munja (N, on foot): everyone near, through walls
  let nk = 0, nForce = 0, nSaid = false;
  // the colours: the police blue, anyone with it in for you red, the people in your phone a cooler white, and
  // everyone else the plain warm white (your own body violet, the dead grey)
  const known = () => { const out = new Set(); for (const c of G.date?.contacts || []) out.add(c.name); for (const c of G.phone?.s?.contacts || []) out.add(c.name); return out; };
  let knownSet = new Set(), knownT = 0;
  const intent = (p) => {
    const m = ppl().mem?.get(p.id) || {};
    if (p._vetalBody) return '#c79bff';
    if (p.corpse) return '#777777';
    if (p.cop || p.police) return '#4aa3ff';
    if (p.mode === 'fight' || p.angry > 0 || p.grudge > 0 || (m.hit && /dada|bhaiya|tai/.test(p.persona || ''))) return '#ff4d4d';
    if (p.name && knownSet.has(p.name)) return '#cfe4ff';
    return '#efe6d2';
  };
  const near = () => { const F = R(), out = []; for (const p of ppl()?.list || []) { if (p.hidden) continue; const d = Math.hypot(p.x - F.x, p.z - F.z); if (d <= N_R) out.push([p, d]); } return out.sort((x, y) => x[1] - y[1]); };
  // it opens only with at least 5 left in it (under that, holding N does nothing at all: no glow, no paths), and once
  // it runs dry it shuts, and stays shut until you let go of N and there's 5 again
  let nOn = false, nPress = false;
  function munja(dt) {
    const press = nForce > 0 || (!!G.input?.key('KeyN') && P().onFoot && !AC.busy);
    if (!press) nOn = false;
    else if (!nOn && !nPress) { if (S.free || nForce > 0 || S.mu >= 5) nOn = true; else toast('Munja', 'Too little left. It comes back in time', 'warn', 1.6); }
    nPress = press;
    if (nOn && !S.free && nForce <= 0 && S.mu <= 0) { nOn = false; toast('Munja', 'Spent. It comes back in time', 'warn', 2); }
    const want = press && nOn;
    if (nForce > 0) nForce -= dt;
    nk = want ? Math.min(1, nk + dt/N_UP) : 0;                    // (let go and it's gone at once)
    if (want && (knownT -= dt) <= 0) { knownT = 1; knownSet = known(); }
    if (want && nForce <= 0) spend2(N_DRAIN*dt);
    if (!want) nSaid = false;
    if (!want && nk <= 0) S.mu = Math.min(100, S.mu + dt*(R_DAY + (R_NIGHT - R_DAY)*nightK())*N_REFILL);
    if (nk >= 1 && !nSaid) {
      nSaid = true;
      let hos = 0, kn = 0, cop = 0, calm2 = 0;
      for (const [p] of near()) { const c = intent(p); if (c === '#ff4d4d') hos++; else if (c === '#cfe4ff') kn++; else if (c === '#4aa3ff') cop++; else if (!p._vetalBody && !p.corpse) calm2++; }
      toast('Munja', [hos && `${hos} hostile`, cop && `${cop} police`, kn && `${kn} you know`, `${calm2} others`].filter(Boolean).join(', '), 'info', 2.5);
    }
  }
  const spend2 = (u) => { if (!S.free) S.mu = Math.max(0, S.mu - u/LV); };
  // where each of them is about to walk, lit on the ground ahead of them
  const TR_N = 44, TR_M = 12, TR_Q = 5200;
  let trail = null, trT = 0, trPh = 0;
  const TMP = [0, 0, 0, 0];
  function trailMesh() {
    const g = new THREE.BufferGeometry(), nv = TR_Q*4;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv*3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv*4), 4));
    const idx = new Uint32Array(TR_Q*6); for (let i = 0; i < TR_Q; i++) { const v = i*4; idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i*6); }
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
    // solid paint in their colour (light added on a bright road barely showed), seen through walls like the auras
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide, opacity: 0 });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 19;
    G.scene.add(mesh); return mesh;
  }
  function pathOf(p) {
    const pts = [p.x, p.z], cap = 28;
    let len = 0;
    const push = (x, z) => { const lx = pts[pts.length - 2], lz = pts[pts.length - 1], d = Math.hypot(x - lx, z - lz); if (d < 0.5) return true; if (len + d > cap) { const k = (cap - len)/d; pts.push(lx + (x - lx)*k, lz + (z - lz)*k); return false; } len += d; pts.push(x, z); return pts.length < TR_M*2; };
    if (p.goal) {
      const g = p.goal; if (g.path) { for (let i = g.k || 0; i + 1 < g.path.length; i += 2) if (!push(g.path[i], g.path[i + 1])) break; } else push(g.x, g.z);
    } else if (p.mode === 'walk' && p.e && ppl().g?.at) {
      const e = p.e, dir = p.dir || 1;
      for (let i = 1; i < TR_M; i++) { const s = p.s + dir*i*2.5; if (s < 0 || s > e.len) break; ppl().g.at(e, s, TMP); if (!push(TMP[0] + TMP[3]*p.lat, TMP[1] - TMP[2]*p.lat)) break; }
    } else if (p.mode === 'flee' && p.goal == null && p.fleeTo) push(p.fleeTo.x, p.fleeTo.z);
    return pts;
  }
  // the traffic too: everyone on a two-wheeler, in an auto, a car, a bus near you, and where they're headed down the road
  const vehNear = () => { const F = R(), T = G.traffic, out = []; if (!T) return out; for (const v of T.list) { if (!v.alive || v.wreck) continue; const d = Math.hypot(v.x - F.x, v.z - F.z); if (d <= N_R) out.push([v, d]); } return out.sort((a, b) => a[1] - b[1]); };
  const vIntent = (v) => v.angry > 0 ? '#ff4d4d' : '#efe6d2';
  function pathOfVeh(v) {
    const pts = [v.x, v.z], gr = ppl().g;
    if (!gr?.at || !v.l || v.jc) return pts;
    // along its lane the way it's going (s counts that way), on into the road it turns onto next
    for (let i = 1; i < TR_M; i++) {
      let L = v.l, s = v.s + i*3.5;
      if (s > L.e.len) { if (!v.next || !v.next.l) break; s -= L.e.len; L = v.next.l; if (s > L.e.len) break; }
      gr.at(L.e, L.dir > 0 ? s : L.e.len - s, TMP);
      const sg = L.dir > 0 ? 1 : -1, tx = TMP[2]*sg, tz = TMP[3]*sg;
      pts.push(TMP[0] + tz*v.lat, TMP[1] - tx*v.lat);
    }
    return pts;
  }
  // a glow round the vehicles whose riders aren't real people up close (cars, the far two-wheelers): an ellipsoid of
  // light their size, through walls like the rest
  let vg = null;
  function vGlow(k) {
    if (!vg) {
      const g = new THREE.SphereGeometry(0.5, 18, 12), m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 });
      vg = new THREE.InstancedMesh(g, m, 24); vg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(72), 3); vg.frustumCulled = false; vg.renderOrder = 19; G.scene.add(vg);
    }
    vg.material.opacity = 0.22*k;
    let n = 0;
    if (k > 0.01) for (const [v] of vehNear()) {
      if (n >= 24) break;
      if (v.rich && v._riders && v._riders.every(r => r.body)) { for (const r of v._riders) AU.light(r, vIntent(v), 0.9*k, true); continue; }
      const T = v.T || {}, L = T.L || 2, W = T.W || 1, H = T.two ? 1.6 : T.L > 6 ? 3.2 : 1.6;
      vm.compose(vp.set(v.rx ?? v.x, (v.y || 0) + H*0.5, v.rz ?? v.z), vq.setFromAxisAngle(vy, -(v.ryaw ?? v.yaw ?? 0)), vs.set(L*1.15, H*1.15, W*1.3));
      vg.setMatrixAt(n, vm); col.set(vIntent(v)); vg.instanceColor.setXYZ(n, col.r, col.g, col.b); n++;
    }
    vg.count = n; vg.instanceMatrix.needsUpdate = true; vg.instanceColor.needsUpdate = true;
  }
  const vm = new THREE.Matrix4(), vp = new THREE.Vector3(), vq = new THREE.Quaternion(), vs = new THREE.Vector3(), vy = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  // how far someone (or a vehicle) has come, for where their next step or tyre mark falls
  const odo = (o) => { const d = Math.hypot(o.x - (o._mx ?? o.x), o.z - (o._mz ?? o.z)); o._mx = o.x; o._mz = o.z; if (d < 4) o._modo = (o._modo || 0) + d; return o._modo || 0; };
  function trails(dt) {
    vGlow(smooth(nk));
    if (nk <= 0.01) { if (trail) { trail.material.opacity = 0; trail.geometry.setDrawRange(0, 0); } return; }
    if (!trail) trail = trailMesh();
    trail.material.opacity = smooth(nk);
    trPh += dt;
    if ((trT -= dt) > 0) return; trT = 1/30;
    const pos = trail.geometry.attributes.position.array, cl = trail.geometry.attributes.color.array, surf = G.W?.surf;
    let q = 0;
    const list = [];
    for (const [p] of near().slice(0, 28)) { if (!(p.fallen > 0 || p._vetalBody || p.corpse)) list.push([pathOf(p), intent(p), null, odo(p)]); }
    // a vehicle's wheels: one line for a two-wheeler or an auto (its back wheels run in the front one's track... near
    // enough: the auto's single front wheel leads), two for anything on four wheels, its track apart
    for (const [v] of vehNear().slice(0, 16)) { const T = v.T || {}, one = T.two || v.type === 'auto'; list.push([pathOfVeh(v), vIntent(v), one ? [0] : [-(T.W || 1.7)*0.41, (T.W || 1.7)*0.41], odo(v)]); }
    // a rectangle on the ground: centre (cx, cz), along (fx, fz) half a long and b wide, at alpha al
    const rect = (cx, cz, fx, fz, a, b, al) => {
      if (q >= TR_Q) return;
      const nx = -fz*b, nz = fx*b, ex = fx*a, ez = fz*a, v = q*12, c = q*16, y = hAt(cx, cz);
      pos.set([cx - ex + nx, y, cz - ez + nz, cx - ex - nx, y, cz - ez - nz, cx + ex + nx, y, cz + ez + nz, cx + ex - nx, y, cz + ez - nz], v);
      for (let j = 0; j < 4; j++) { cl[c + j*4] = col.r; cl[c + j*4 + 1] = col.g; cl[c + j*4 + 2] = col.b; cl[c + j*4 + 3] = al; }
      q++;
    };
    const hAt = (x, z) => (surf ? surf.height(x, z) : 0) + 0.06;
    // wheels: dashes 1 m long, 0.6 m apart, a hand wide; feet: a footprint (the sole, a gap, the heel) left and right in
    // turn, a step apart. Both are laid on the ground where they'll be, counted from how far each one has come, so they
    // stay put as the person or the vehicle moves on to them (nothing slides along)
    const DASH = 1.0, GAP = 0.6, PER = DASH + GAP, HW = 0.09, STEP = 0.68;
    const mod = (a, m) => ((a % m) + m) % m;
    const foot = (x, z, fx, fz, side, al) => {
      const ox = -fz*0.1*side, oz = fx*0.1*side;
      rect(x + ox + fx*0.045, z + oz + fz*0.045, fx, fz, 0.085, 0.048, al);         // the sole and toes
      rect(x + ox - fx*0.1, z + oz - fz*0.1, fx, fz, 0.042, 0.038, al);              // the heel
    };
    for (const [pts, c, wheels, od] of list) {
      const flow = mod(-od, PER), flowF = mod(-od, STEP);
      if (pts.length < 4) continue;
      col.set(c);
      let tot = 0; for (let i = 0; i + 3 < pts.length; i += 2) tot += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
      if (tot < 0.5) continue;
      let d0 = 0;
      for (let i = 0; i + 3 < pts.length && q < TR_Q; i += 2) {
        const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3], L = Math.hypot(bx - ax, bz - az);
        if (L < 1e-3) continue;
        const fx = (bx - ax)/L, fz = (bz - az)/L;
        if (!wheels) {
          // the steps on this piece of the way: left at k*2*STEP + flowF, right a step on
          for (let k = Math.floor((d0 - flowF)/STEP) - 1; ; k++) {
            const sd = k*STEP + flowF;
            if (sd >= d0 + L) break;
            if (sd < d0 || sd < 0.3) continue;
            const t = (sd - d0)/L;
            foot(ax + (bx - ax)*t, az + (bz - az)*t, fx, fz, (Math.round((od + sd)/STEP) & 1) ? 1 : -1, 0.9*(1 - sd/tot));
          }
        } else {
          for (let k = Math.floor((d0 - flow)/PER) - 1; ; k++) {
            const s0 = k*PER + flow, s1 = s0 + DASH;
            if (s0 >= d0 + L) break;
            const u0 = Math.max(s0, d0), u1 = Math.min(s1, d0 + L);
            if (u1 <= u0) continue;
            const um = (u0 + u1)/2, t = (um - d0)/L, mx = ax + (bx - ax)*t, mz = az + (bz - az)*t, al = 0.85*(1 - um/tot);
            for (const o of wheels) rect(mx - fz*o, mz + fx*o, fx, fz, (u1 - u0)/2, HW, al);
          }
        }
        d0 += L;
      }
    }
    trail.geometry.setDrawRange(0, q*6);
    trail.geometry.attributes.position.needsUpdate = true; trail.geometry.attributes.color.needsUpdate = true;
  }
  // startling: with Munja open, click someone (a rustle behind them), right-click a spot (a stone lands there)
  function startle(p) {
    if (!p) return false;
    if (!S.free && S.mu < 6) { toast('Munja', 'Not enough left', 'warn', 1.5); return false; }
    spend2(6);
    const F = R(), dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz) || 1, x = p.x + dx/d*1.6, z = p.z + dz/d*1.6;
    rustle(x, z); PE.startle(p, x, z);
    return true;
  }
  function groundHit(max = 40) {
    const cam = G.camera; cam.getWorldPosition(cp); cam.getWorldDirection(cf);
    const surf = G.W?.surf;
    for (let s = 1; s < max; s += 0.5) { const x = cp.x + cf.x*s, y = cp.y + cf.y*s, z = cp.z + cf.z*s; if (y <= (surf ? surf.height(x, z) : 0)) return { x, z }; }
    return null;
  }
  function throwStone(at) {
    const h = at || groundHit(); if (!h) return false;
    if (!S.free && S.mu < 5) { toast('Munja', 'Not enough left', 'warn', 1.5); return false; }
    spend2(5);
    setTimeout(() => {
      stone(h.x, h.z);
      for (const p of ppl()?.list || []) {
        if (p.hidden || p.fallen > 0 || p._vetalBody || p.pax || p.mode === 'fight' || p._wake) continue;
        const d = Math.hypot(p.x - h.x, p.z - h.z);
        if ((p.cop || p.police) && d < 18) { ppl().goTo(p, h.x, h.z, (q) => ppl().watch(q, h.x, h.z, 3)); continue; }
        if (d < 12 && Math.random() < 1 - d/14) setTimeout(() => PE.startle(p, h.x, h.z), d*40);
      }
    }, 350);
    return true;
  }
  addEventListener('mousedown', (e) => {
    if (!(nk > 0.4) || G.state !== 'play' || !P().onFoot || !document.pointerLockElement) return;
    if (e.button === 0) { const p = aimAt(candidates(), N_R); if (!p) return; e.preventDefault(); e.stopImmediatePropagation(); startle(p); }
    else if (e.button === 2) { e.preventDefault(); e.stopImmediatePropagation(); throwStone(); }
  }, true);

  // the lights on people this frame: Vetal's on whoever you're going into (only while you hold V), Brahmarakshas' on
  // whoever you're reading and have read, Munja's on everyone near (through walls); all building over the whole hold
  // someone at the wheel with no body drawn (a car's driver behind the glass): the glow where they sit, head and
  // shoulders, through the car
  let sg = null;
  function seatGlow(list) {
    if (!sg) {
      const g = new THREE.SphereGeometry(0.5, 16, 12), m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
      sg = new THREE.InstancedMesh(g, m, 4); sg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(12), 3); sg.frustumCulled = false; sg.renderOrder = 20; G.scene.add(sg);
    }
    let n = 0;
    for (const [q, c, k] of list) {
      const o = q.veh; if (!o || n >= 4 || k <= 0) continue;
      const T = o.T || {}, L = T.L || 4, Wd = T.W || 1.7, bus = L > 6, two = !!T.two, hx = o.hx ?? 1, hz = o.hz ?? 0;
      // where the driver sits: a two-wheeler's saddle; a car's right front seat; a bus's cab
      const fwd = two ? 0 : bus ? L/2 - 1.3 : L*0.04, side = two ? 0 : Wd*0.22, y = (o.y || 0) + (two ? 1.25 : bus ? 2.1 : 1.0);
      vm.compose(vp.set((o.rx ?? o.x) + hx*fwd - hz*side, y, (o.rz ?? o.z) + hz*fwd + hx*side), vq.identity(), vs.set(0.55, 0.85, 0.5));
      sg.setMatrixAt(n, vm); col.set(c).multiplyScalar(k); sg.instanceColor.setXYZ(n, col.r, col.g, col.b); n++;
    }
    sg.count = n; sg.instanceMatrix.needsUpdate = true; sg.instanceColor.needsUpdate = true;
  }
  function lights(dt) {
    stick = link ? link.p : bl ? bl.p : null;
    const sl = [];
    if (link && !(link.lost > 0) && link.p._drv && G.state === 'play') sl.push([link.p, '#b26bff', 0.12 + 0.88*clamp01(link.t/link.need)]);
    if (bl && !(bl.lost > 0) && bl.p._drv) sl.push([bl.p, '#ffb020', 0.12 + 0.88*clamp01(bl.t/B_HOLD)]);
    seatGlow(sl);
    // (off the moment they're out of the middle of your view: you see it's let go)
    if (link && !(link.lost > 0) && G.state === 'play') AU.light(link.p, '#b26bff', 0.12 + 0.88*clamp01(link.t/link.need));
    if (bl && !(bl.lost > 0)) AU.light(bl.p, '#ffb020', 0.12 + 0.88*clamp01(bl.t/B_HOLD));
    if (readP && readT > 0) { readT -= dt; AU.light(readP, '#ffb020', Math.min(0.9, readT*0.35)); }
    if (nk > 0) { const k = 0.9*smooth(nk); for (const [p] of near().slice(0, 28)) AU.light(p, intent(p), k, true); }
    AU.tick(dt);
  }

  // ---------------------------------------------------------------- dragging (Z, with someone out cold at your feet)
  const downed = () => { if (!P().onFoot) return null; const F = R(), th = yaw(); let best = null, bs = 1e9; for (const p of (ppl()?.list || [])) { if (p.hidden || !(p.fallen > 1.6) || !(p.ko || p.corpse || p._vetalBody)) continue; const dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz); if (d > 2.6) continue; const a = Math.abs(Math.atan2(Math.sin(Math.atan2(dz, dx) - th), Math.cos(Math.atan2(dz, dx) - th))); if (a > 1.4) continue; if (d + a < bs) { bs = d + a; best = p; } } return best; };
  let zPress = false;
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyZ' || e.repeat || G.state !== 'play' || !G.player?.onFoot) return;
    if (!AC.dragging && !downed()) return;               // nobody down at your feet: Z is the weapons wheel as ever
    e.preventDefault(); e.stopImmediatePropagation(); zPress = true;
  }, true);
  addEventListener('keyup', (e) => { if (e.code === 'KeyZ' && zPress) e.stopImmediatePropagation(); }, true);
  function dragKeys() {
    if (!zPress) return; zPress = false;
    if (AC.dragging) AC.letGo();
    else if (!AC.busy) { const p = downed(); if (p) AC.grab(p); }
  }

  // where your own body lies, on the minimap and the big map, while you're away in someone (game/hud.js, patched)
  G.extraMarks = () => home ? [{ kind: 'body', x: home.body ? home.body.x : home.x, z: home.body ? home.body.z : home.z, label: 'Your body' }] : [];
  // ---------------------------------------------------------------- every frame
  const frame = G.frame.bind(G);
  let last = performance.now();
  G.frame = (dt) => {
    const r = frame(dt);
    const now = performance.now(), el = Math.min(0.1, (now - last)/1000); last = now;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (G.state === 'play' && !G.talkUI?.cur && !typing) {
      vetal(el); brahma(el); munja(el); dragKeys();
      aimDot(P().onFoot && (!!G.input?.key('KeyV') || !!G.input?.key('KeyB')), link || bl);
      // say so: someone out cold at your feet can be dragged (and let go of), as the F offers are shown
      if (P().onFoot && !P().offer && G.hud?.prompt) { if (AC.dragging) G.hud.prompt('Z', 'Let go of them', 0.3); else if (!AC.busy && downed()) G.hud.prompt('Z', 'Drag them', 0.3); }
    } else { wasV = false; held = 0; if (link) { link = null; humOn(0); } bl = null; nk = 0; aimDot(false); }
    if (G.state === 'play') { PE.tick(el); AC.dragTick(el); }
    // a heavy head after you were thrown out: blurred, slow, clearing over the next minute
    // a heavy head: the picture swims (a slow lean and drift), soft and washed out, clearing over the minute
    if (dazeT > 0) {
      dazeT -= el; P().limpT = Math.max(P().limpT || 0, 0.3);
      const cv = G.renderer?.domElement, k = smooth(Math.max(0, dazeT)/dazeMax), t = now/1000;
      if (cv) {
        if (dazeT > 0) {
          cv.style.filter = `blur(${(0.4 + 2.4*k).toFixed(2)}px) saturate(${(1 - 0.45*k).toFixed(2)}) brightness(${(1 - 0.12*k).toFixed(2)})`;
          cv.style.transform = `rotate(${(Math.sin(t*0.7)*1.6*k).toFixed(3)}deg) translate(${(Math.sin(t*0.43)*10*k).toFixed(1)}px, ${(Math.sin(t*0.61)*6*k).toFixed(1)}px) scale(${(1 + 0.05*k).toFixed(3)})`;
        } else { cv.style.filter = ''; cv.style.transform = ''; }
      }
    }
    lights(el); trails(el);
    draw(el); HB.draw(el);
    return r;
  };
  addEventListener('beforeunload', save);
  setInterval(save, 10000);

  // ---------------------------------------------------------------- the terminal
  const api = {
    S, take, goHome, leaveSoft, throwOut, read, reading, startle, throwStone, acts: AC, wake: PE, body: HB, aura: AU,
    get host() { return host; }, get home() { return home; }, get strain() { return strain; }, set strain(x) { strain = x; },
  };
  G.powers = api;
  const ro = () => { throw new Error('read only'); };
  (G.varHooks = G.varHooks || []).push((v) => {
    v('power.vetal', 'Vetal units left, 0 to 100', () => Math.round(S.vu*10)/10, (x) => { S.vu = Math.max(0, Math.min(100, x)); save(); }, { min: 0, max: 100 });
    v('power.munja', 'Munja units left, 0 to 100', () => Math.round(S.mu*10)/10, (x) => { S.mu = Math.max(0, Math.min(100, x)); save(); }, { min: 0, max: 100 });
    v('power.strain', 'how hard the one you\'re in is fighting you (1 throws you out)', () => strain, (x) => { strain = x; }, { min: 0, max: 2 });
    v('power.free', 'powers cost nothing', () => S.free, (x) => { S.free = x; save(); }, { kind: 'bool' });
    v('power.brahma', 'Brahmarakshas reads left today', () => left(), (x) => { S.brahma = DAILY - Math.round(x); save(); }, { min: 0, max: DAILY });
    v('power.hops', 'how many bodies in this run (the next one costs more)', () => hops, (x) => { hops = Math.max(0, Math.round(x)); }, { min: 0, max: 12 });
    v('power.refill', 'Vetal coming back, units a minute, here and now', () => Math.round((R_DAY + (R_NIGHT - R_DAY)*nightK())*60*10)/10, ro);
  });
  const shell = () => {
    const T = G.terminal; if (!T || !G.registry) { setTimeout(shell, 600); return; }
    const { sh } = T, say = (s, k) => sh.print ? sh.print(s, k) : T.term?.say?.(s, k);
    const persons = (s) => G.registry.select(s).filter(e => e.k === 'person').map(e => e.o);
    const one = (s) => { const [p] = persons(s); if (!p) throw new Error('nobody there'); return p; };
    const status = () => [
      `Vetal ${Math.round(S.vu)}/100   Munja ${Math.round(S.mu)}/100   Brahmarakshas unlimited${S.free ? '   (free)' : ''}`,
      host ? `in ${host.name || WHO[host.kind]} · hop ${hops} · strain ${Math.round(strain*100)}% · ${Math.round(fromBody())} m from your body` : `yourself · next way in costs ${hopRange(0).map((x) => Math.round(x/LV)).join('–')}   (powers at ${Math.round(LV*100)}%)`,
    ];
    const G_ = 'powers';
    sh.reg('list powers', 'the three powers: what\'s left, who you are in, how far from your body', () => status().forEach(l => say(l)), { group: G_ });
    sh.type('power', () => [{ v: 'all', note: 'everything' }, { v: 'vetal', note: 'the Vetal bar' }, { v: 'munja', note: 'the Munja bar' }, { v: 'brahma', note: 'Brahmarakshas, today\'s reads' }]);
    sh.reg('refill power [which:power]', 'fill them up: vetal, munja, brahma or all (default)', ([w = 'all']) => { if (w === 'all' || w === 'vetal') S.vu = 100; if (w === 'all' || w === 'munja') S.mu = 100; if (w === 'all' || w === 'brahma') S.brahma = 0; save(); say('refilled ' + w, 'ok'); }, { group: G_ });
    sh.reg('set power <which:power> <units:num>', 'a bar to so many units (0 to 100), or reads left today', ([w, x]) => { x = +x; if (w === 'vetal') S.vu = Math.max(0, Math.min(100, x)); else if (w === 'munja') S.mu = Math.max(0, Math.min(100, x)); else if (w === 'brahma') S.brahma = DAILY - Math.max(0, Math.min(DAILY, Math.round(x))); else throw new Error('vetal, munja or brahma'); save(); say(`${w} ${x}`, 'ok'); }, { group: G_ });
    sh.reg('retake power', 'everything full again, today\'s reads back, the strain gone', () => { S.vu = 100; S.mu = 100; S.brahma = 0; strain = 0; save(); say('all yours again', 'ok'); }, { group: G_ });
    sh.reg('take <who:sel>', 'Vetal: into them, now (no link, no cost)', ([s]) => { const fr = S.free; S.free = true; try { take(one(s)); } finally { S.free = fr; } say('in', 'ok'); }, { group: G_ });
    sh.reg('return body', 'Vetal: back to your own body', () => { if (!home) throw new Error('you are yourself'); leaveSoft(); say('home', 'ok'); }, { group: G_ });
    sh.reg('read <who:sel>', 'Brahmarakshas on anyone (free)', ([s]) => { read(one(s), true); }, { group: G_ });
    sh.reg('sense [seconds:num]', 'Munja open for so many seconds (no cost)', ([t]) => { nForce = +t || 8; say('open', 'ok'); }, { group: G_ });
    sh.reg('startle <who:sel>', 'Munja: a rustle behind them', ([s]) => { const fr = S.free; S.free = true; try { startle(one(s)); } finally { S.free = fr; } say('rustle', 'ok'); }, { group: G_ });
    sh.reg('throw stone', 'Munja: a stone where you look', () => { const fr = S.free; S.free = true; try { if (!throwStone()) throw new Error('look at the ground'); } finally { S.free = fr; } say('tok', 'ok'); }, { group: G_ });
    sh.reg('drag <who:sel>', 'drag someone who\'s out cold (Z to let go)', ([s]) => { const p = one(s); if (!(p.fallen > 1.6)) throw new Error('they\'re not down'); AC.grab(p); say('dragging', 'ok'); }, { group: G_ });
    sh.reg('toggle powerfree [on:onoff]', 'powers cost nothing (testing)', ([a]) => { S.free = a === undefined ? !S.free : a === 'on'; save(); say(`free ${S.free ? 'on' : 'off'}`, 'ok'); }, { group: G_ });
    // the moves, one at a time
    const T_ = 'tests';
    sh.reg('test getup', 'you: lying, then the slow get-up and a sway', () => { AC.wakeUp(false); say('ok', 'ok'); }, { group: T_ });
    sh.reg('test getuphard', 'you: thrown-out get-up (a stumble, a heavier sway)', () => { AC.wakeUp(true); say('ok', 'ok'); }, { group: T_ });
    sh.reg('test shudder', 'you: the shudder of going into someone', () => { AC.shudder(); say('ok', 'ok'); }, { group: T_ });
    sh.reg('test thrownout', 'you: thrown out (both hands to the head, the stagger, down)', () => { AC.thrownOut(() => AC.wakeUp(true)); say('ok', 'ok'); }, { group: T_ });
    sh.reg('test foughtoff', 'you: fought off at the door', () => { AC.foughtOff(); say('ok', 'ok'); }, { group: T_ });
    sh.reg('test dizzy [who:sel]', 'dizzy: you, or someone', ([s]) => { if (!s) { const D = { t: 0, dur: 4, ph: 0, sev: 1.3, hand: 'r' }; AC.dizzyOut(D, 4, () => {}); } else for (const p of persons(s)) PE.wake(p, { sev: 1.3 }); say('ok', 'ok'); }, { group: T_ });
    sh.reg('test cometo <who:sel> [hops:int]', 'someone coming round after Vetal leaves them', ([s, h]) => { for (const p of persons(s)) PE.wake(p, { hops: +h || 0, sev: 1 + 0.25*(+h || 0), female: !!(p.female || p.look?.female) }); say('ok', 'ok'); }, { group: T_ });
    sh.reg('test startle <who:sel>', 'a rustle behind someone (free)', ([s]) => { for (const p of persons(s)) { const F = R(), dx = p.x - F.x, dz = p.z - F.z, d = Math.hypot(dx, dz) || 1; rustle(p.x + dx/d*1.6, p.z + dz/d*1.6); PE.startle(p, p.x + dx/d*1.6, p.z + dz/d*1.6); } say('ok', 'ok'); }, { group: T_ });
    if (sh.order && !sh.order.includes(G_)) sh.order.splice(sh.order.indexOf('you') + 1, 0, G_);
  };
  shell();
  return api;
}
