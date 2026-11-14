// traffic/temper.js for /beta: the one who gets out. Stand in a driver's way (in a car or on your feet) and they hoot,
// then lean on the horn (the traffic's own step: tools/build-beta.mjs); most then back up a little and squeeze
// round you. A few have had enough: the engine's left running, the door opens, and they come to your window. In a
// car they bang on it and tell you what they think; on foot, or the moment you get out, it's a fight. Then back
// to their own vehicle and round you. One at a time, and not again for a while.
import { Traffic } from '@orig/traffic/traffic.js';

const G_ = () => window.__nhAskG;
const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function rage(G, o) {
  const round = () => { o.temper = 'round'; o.temperGo = 1; };
  if (G.free || (G._argT || 0) > G.t || o.argue > 0 || (o.y || 0) > 0.5 || !o.alive || o.fallen > 0) return round();
  const P = G.player, ppl = G.people, p = P.spawnAngryDriver && P.spawnAngryDriver(o, 'bump');
  if (!p) return round();
  G._argT = G.t + 50; o.argue = 34; o.v = 0;
  p.busy = 34; p.grudge = 60; p.angry = 8;
  const sd = (P.onFoot ? 0 : (P.spec && P.spec.W ? P.spec.W/2 : 0.8)) + 0.85;
  let done = false;
  const home = () => {
    if (done) return; done = true;
    if (!ppl.list.includes(p)) { o.argue = 0; round(); return; }
    if (p.mode === 'fight' || p.fallen > 0 || p.ko) { o.argue = 0; round(); return; }        // (it's between the two of you now; the vehicle's left where it is till they're back)
    p.anim = null; p.busy = 10;
    ppl.goTo(p, o.x, o.z, (q) => { ppl.remove(q); o.argue = 0; o.angry = 4; round(); });
    G.later(12, () => { if (o.argue > 0) { if (ppl.list.includes(p)) ppl.remove(p); o.argue = 0; round(); } });
  };
  ppl.goTo(p, P.x - Math.sin(P.th || 0)*sd, P.z + Math.cos(P.th || 0)*sd, (q) => {
    ppl.watch && ppl.watch(q, P.x, P.z, 10);
    ppl.speakAs && ppl.speakAs('fight', q, 1, 2);
    if (P.onFoot) { ppl.startFight(q, P); return; }
    q.anim = 'no';
    let n = 0;
    const bang = () => {
      if (done || !ppl.list.includes(q) || far(q, P) > 3.4) return;
      if (P.onFoot) { ppl.startFight(q, P); return; }
      G.audio.thud && G.audio.thud(0.75); G.rig && G.rig.impact && G.rig.impact(1.8, q.x, q.z);
      if (++n === 2 && ppl.speakAs) ppl.speakAs('bump', q, 1, 2);
      if (n < 5) G.later(0.8 + Math.random()*0.9, bang);
    };
    G.later(0.9, bang);
  }, true);
  // you've moved off, or they've said it all: back to the wheel
  const watch = (k) => G.later(1, () => {
    if (done) return;
    if (!ppl.list.includes(p)) { done = true; o.argue = 0; round(); return; }
    if (P.onFoot && p.mode !== 'fight' && far(p, P) < 3) ppl.startFight(p, P);
    if (k > 15 || (far(o, P) > 14 && p.mode !== 'fight')) home(); else watch(k + 1);
  });
  watch(0);
}
const upd = Traffic.prototype.update;
Traffic.prototype.update = function (...a) {
  const r = upd.apply(this, a);
  if (this.rageBy) { const o = this.rageBy; this.rageBy = null; const G = G_(); if (G && G.player && G.people) { try { rage(G, o); } catch (e) { console.warn('temper', e); o.temper = 'round'; o.temperGo = 1; o.argue = 0; } } }
  return r;
};
