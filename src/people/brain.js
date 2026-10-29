// What people think. Every pedestrian has a character (brave, curious, helpful, short-tempered, sociable; shaped
// by who they are: college kids are curious and social, ajobas cautious, dadas brave and quick to anger), notices
// what happens around them, and decides what to do about it, a few people at a time each frame:
//  · someone down on the road: the helpful go and kneel by them and call an ambulance; the curious stop and film
//    it on their phones (this is Pune); the timid hurry past; whoever saw you do it may call the police
//  · a fight, a blast, a burning wreck: most back off, the brave come closer, a few square up to you
//  · their own lives: two people who know each other stop for a chat (nods, head-shakes, laughing), someone waves
//    across the road, someone stops to pick something up, sits a while on a bus-stop bench, hurries at rush hour
//  · you: stand in someone's face and they react the way they would; a respected local gets greeted
const R = Math.random;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const SHAPE = {
  college: { curious: 0.25, social: 0.25, brave: 0.05, helpful: 0 }, kp: { curious: 0.15, social: 0.2 }, dada: { brave: 0.25, temper: 0.25 },
  kaka: { helpful: 0.15, temper: 0.1 }, ajoba: { brave: -0.3, helpful: 0.1, social: 0.1 }, aaji: { brave: -0.35, helpful: 0.2 }, kaku: { helpful: 0.2, curious: 0.15 },
  tai: { helpful: 0.15, brave: 0.05 }, bhaiya: { brave: 0.15, helpful: 0.1 }, aunty: { curious: 0.25, social: 0.15 },
};
export class Brain {
  constructor(people, G) { this.ppl = people; this.g = G; this.inc = []; this.k = 0; this.T = 0; }
  traits(p) {
    if (p.tr) return p.tr;
    const t = { brave: R(), curious: R(), helpful: R(), temper: R(), social: R() };
    const per = p.persona || '';
    for (const [key, sh] of Object.entries(SHAPE)) if (per.includes(key)) for (const [k, v] of Object.entries(sh)) t[k] = clamp01(t[k] + v);
    return (p.tr = t);
  }
  // something happened: kind 'down' (someone knocked out or killed), 'fight', 'blast', 'crash', 'theft'; byYou: the player did it
  incident(kind, x, z, o = {}) { this.inc.push({ kind, x, z, t: 0, victim: o.victim || null, byYou: !!o.byYou, helpers: 0, reported: false }); if (this.inc.length > 12) this.inc.shift(); }
  free(p) { return !(p.pax || p.cop || p.fixed || p.fallen > 0 || p.hidden || p.ctl || p.mode === 'fight' || p.mode === 'inside' || p.mode === 'free' || p.busy > 0 || p.tourist || p.venue); }
  update(dt, player) {
    const L = this.ppl.list, G = this.g;
    this.T += dt;
    for (const I of this.inc) I.t += dt;
    this.inc = this.inc.filter(I => I.t < (I.kind === 'down' ? 90 : 40));
    for (const p of L) if (p.busy > 0) { p.busy -= dt; if (p.busy <= 0 && p.chat) this.endChat(p); }
    this.chats(dt);
    // a handful of people think each frame (each one about twice a second)
    const n = Math.max(1, Math.ceil(L.length * dt * 2));
    for (let i = 0; i < n && L.length; i++) {
      const p = L[this.k = (this.k + 1) % L.length];
      if (!this.free(p)) continue;
      this.think(p, player, G);
    }
  }
  think(p, P, G) {
    const t = this.traits(p), ppl = this.ppl;
    const dP = Math.hypot(p.x - P.x, p.z - P.z);
    // 1. something going on nearby
    for (const I of this.inc) {
      const d = Math.hypot(p.x - I.x, p.z - I.z);
      if (d > 45 || (p.seen && p.seen.has(I))) continue;
      (p.seen || (p.seen = new Set())).add(I);
      if (I.kind === 'blast' || (I.kind === 'fight' && d < 15 && t.brave < 0.5)) {
        if (t.brave > 0.8 && t.curious > 0.5 && I.kind === 'blast') { this.watch(p, I.x, I.z, 14 + R() * 12, 'phone'); ppl.speakAs('crowd', p, 0.4, 4); }
        else { ppl.flee(p, I.x, I.z, 30 + R() * 15); ppl.speakAs('scared', p, 0.3, 4); }
        return;
      }
      if (I.kind === 'down' && I.victim && !I.victim.corpse && I.helpers < 2 && t.helpful > 0.55 && d < 30) {
        // kneel by them, check on them, call for help (and if they're only knocked out, help them come round)
        I.helpers++;
        const v = I.victim, a = R() * 6.28;
        ppl.goTo(p, v.x + Math.cos(a) * 0.9, v.z + Math.sin(a) * 0.9, (q) => { this.watch(q, v.x, v.z, 10 + R() * 8, 'crouch'); q.watchFollow = v; ppl.speakAs('kind', q, 0.7, 4) || ppl.speakAs('crowd', q, 0.6, 4);
          if (v.ko && !v.corpse && v.fallen > 4) v.fallen = Math.max(3, v.fallen - 6); }, true);
        p.busy = 25;
        this.report(I, p, t);
        return;
      }
      if ((I.kind === 'down' || I.kind === 'crash' || I.kind === 'fight') && t.curious > 0.5 && d < 35) {
        // stop and film it
        const back = Math.max(6, d * 0.7), a = Math.atan2(p.z - I.z, p.x - I.x);
        ppl.goTo(p, I.x + Math.cos(a) * back, I.z + Math.sin(a) * back, (q) => { this.watch(q, I.x, I.z, 12 + R() * 15, R() < 0.7 ? 'phone' : 'arms_folded'); ppl.speakAs('crowd', q, 0.35, 5); });
        p.busy = 30;
        if (I.byYou) this.report(I, p, t);
        return;
      }
      if (I.byYou && I.kind !== 'down' && t.brave > 0.82 && t.temper > 0.6 && dP < 12 && P.onFoot) {
        ppl.startFight(p, P); ppl.speakAs('fight', p, 1, 4); return;
      }
      if (I.byYou) this.report(I, p, t);
    }
    // 2. you, right in their face
    if (P.onFoot && dP < 1.8 && Math.abs(P.v) < 0.3) {
      p.stare = (p.stare || 0) + 0.5;
      if (p.stare > 2.5) {
        p.stare = -8;
        const S = G.life && G.life.s;
        if (S && S.respect > 25) { this.watch(p, P.x, P.z, 3, 'wave'); ppl.speakAs('respect', p, 1, 4) || ppl.speakAs('greet', p, 1, 4); }
        else if (t.temper > 0.7) { this.watch(p, P.x, P.z, 3, 'no'); ppl.speakAs('mutter', p, 1, 4); }
        else if (t.brave < 0.35) { ppl.flee(p, P.x, P.z, 10); }
        else { this.watch(p, P.x, P.z, 2.5, R() < 0.5 ? 'yes' : 'idle'); ppl.speakAs('greet', p, 0.8, 4); }
        return;
      }
    } else if (p.stare > 0) p.stare = 0;
    // 3. their own day
    if (p.mode !== 'walk' || p.chat) return;
    const h = (G.hour ?? 12), r = R();
    // rush hour: some are late
    if ((h > 8.5 && h < 10) || (h > 17.5 && h < 19.5)) { if (!p.hurry && r < 0.08 && /college|dada|kp|tai/.test(p.persona || '')) { p.hurry = true; p.speed *= 1.9; } }
    // two people who know each other stop for a chat
    if (t.social > 0.55 && r < 0.12) {
      for (const q of ppl.list) {
        if (q === p || !this.free(q) || q.mode !== 'walk' || q.chat) continue;
        if (Math.abs(q.x - p.x) > 3 || Math.abs(q.z - p.z) > 3) continue;
        if (this.traits(q).social < 0.4) continue;
        this.startChat(p, q); return;
      }
    }
    // a wave across the road, a dropped coin, a sit at the bus stop
    if (r < 0.02) { p.act = { clip: 'wave', t: 0, dur: 1.8 }; ppl.speakAs('greet', p, 0.25, 6); return; }
    if (r < 0.03) { this.watch(p, p.x + Math.cos(p.yaw), p.z + Math.sin(p.yaw), 1.8, 'pickup'); return; }
    if (r < 0.045 && (h > 20 || h < 7 || /ajoba|aaji|kaka/.test(p.persona || ''))) this.sitAtStop(p);
  }
  watch(p, x, z, secs, anim) { p.mode = 'watch'; p.watch = { x, z }; p.wait = secs; p.anim = anim; p.v = 0; p.busy = Math.max(p.busy || 0, secs); }
  // someone saw it and calls 100 (once per incident, more likely the braver and more helpful they are)
  report(I, p, t) {
    if (!I.byYou || I.reported || !this.g.police || this.g.free) return;
    if (R() > 0.25 + t.helpful * 0.4 + t.brave * 0.2) return;
    I.reported = true;
    this.g.later(4 + R() * 6, () => { if (!this.g.free) this.g.police.raiseHeat(1, I.kind === 'down' ? 'A witness called 100' : 'Someone called the police', null); });
    p.act = { clip: 'phone', t: 0, dur: 4 };
  }
  // a chat in the middle of the footpath: they face each other, one talks, the other nods or shakes their head
  startChat(a, b) {
    const dur = 10 + R() * 22, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    for (const [p, q] of [[a, b], [b, a]]) { this.watch(p, q.x, q.z, dur, 'talk'); p.watch.follow = q; p.chat = { with: q, beat: R() * 3, talker: p === a }; }
    void mx; void mz;
    this.ppl.speakAs('chat', a, 0.6, 6);
  }
  chats(dt) {
    for (const p of this.ppl.list) {
      const c = p.chat; if (!c || p.mode !== 'watch') { if (c && p.mode !== 'watch') p.chat = null; continue; }
      c.beat -= dt;
      if (c.beat > 0) continue;
      c.beat = 2 + R() * 3; c.talker = !c.talker;
      p.anim = c.talker ? (R() < 0.8 ? 'talk' : 'no') : (R() < 0.55 ? 'yes' : R() < 0.5 ? 'idle' : 'arms_folded');
    }
  }
  endChat(p) { const q = p.chat && p.chat.with; p.chat = null; if (q && q.chat) q.chat = null; }
  // an old man resting on the bench at the bus stop, a tired worker at night
  sitAtStop(p) {
    const B = this.g.W.M.buses || [];
    let best = null, bd = 25 * 25;
    for (const b of B) { const x = b[0] / 100, z = b[1] / 100, d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < bd) { bd = d; best = { x, z }; } }
    if (!best) return;
    this.ppl.goTo(p, best.x + (R() - 0.5) * 1.2, best.z + (R() - 0.5) * 0.6, (q) => { this.watch(q, q.x + Math.cos(q.yaw), q.z + Math.sin(q.yaw), 20 + R() * 40, 'sit_talk'); });
    p.busy = 70;
  }
}
