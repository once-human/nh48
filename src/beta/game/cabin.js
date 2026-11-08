// Sitting in a car: the world outside goes behind glass. People talking, the street, the crickets, the traffic's
// engines all come through muffled, more the better the car is shut (a luxury car or a supercar almost sealed, an
// SUV less, a hatchback's thin doors less again), and an auto or a two-wheeler not at all: you're out in it. Horns
// stay clear (they're meant to get through). Open a door and the world comes back in as it swings, and shuts out again
// as it closes. (Between each bus and its trim in soundscape.js; game/radio.js does the radio's own side of it.)
import { kindOf, doorOpen } from './radio.js';

// how far each kind of car shuts out the world (low-pass, level), the street and voices, and the traffic
const SHUT = {
  prem: { world: [650, 0.42], voice: [720, 0.48], traffic: [3200, 0.8] },
  good: { world: [1100, 0.55], voice: [1200, 0.6], traffic: [4800, 0.88] },
  basic: { world: [1900, 0.7], voice: [2100, 0.74], traffic: [7000, 0.94] },
};
const G0 = () => window.__nhAskG;
let F = null, hornWrapped = false;

function wire(a) {
  if (F || !a.ctx || !a.trims) return F;
  const ctx = a.ctx; F = {};
  for (const k of ['world', 'voice', 'traffic']) {
    const b = a.buses[k], t = a.trims[k]; if (!b || !t) continue;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 1;
    try { b.disconnect(); } catch (e) { /* */ }
    b.connect(lp).connect(g).connect(t);
    F[k] = { lp, g };
  }
  // a horn's own sample plays on the fx bus, which isn't muffled: make sure it stays there
  if (!hornWrapped && a.horn) { hornWrapped = true; const h = a.horn; a.horn = function (...args) { return this.on('fx', () => h.apply(this, args)); }; }
  return F;
}

let shut = 0, kind = null;
const tick = () => {
  requestAnimationFrame(tick);
  const G = G0(), a = G && G.audio; if (!a || !a.ctx || !wire(a)) return;
  const P = G.player, v = P && !P.onFoot ? P.cur : null, k = v && !(G.interiors && G.interiors.inside) ? kindOf(v) : null;
  // shut: how closed in you are (in a car with its doors to, 1; the door opening, less; on foot, 0)
  const want = k && SHUT[k] ? 1 - doorOpen(P, v) : 0;
  if (k && SHUT[k]) kind = k;
  shut += (want - shut)*0.2;
  const S = SHUT[kind] || SHUT.basic, t = a.ctx.currentTime;
  for (const b in F) {
    const [f, l] = S[b];
    F[b].lp.frequency.setTargetAtTime(Math.exp(Math.log(20000)*(1 - shut) + Math.log(f)*shut), t, 0.06);
    F[b].g.gain.setTargetAtTime(1 + (l - 1)*shut, t, 0.06);
  }
};
requestAnimationFrame(tick);
