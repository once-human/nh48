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
  incident(kind, x, z, o = {}) {
    if ((kind === 'down' || kind === 'blast') && this.g.emergency) this.g.emergency.dispatch(kind, x, z, o.victim || null);
    this.inc.push({ kind, x, z, t: 0, victim: o.victim || null, byYou: !!o.byYou, helpers: 0, reported: false }); if (this.inc.length > 12) this.inc.shift();
    // you did it: the neighbourhood remembers, and whoever saw it remembers your face
    if (o.byYou) {
      const w = { down: o.victim && o.victim.corpse ? 6 : 2.5, blast: 4, theft: 2, fight: 1, crash: 0.4 }[kind] || 0.5;
      if (this.g.rep) this.g.rep.bad(x, z, w);
      if (w >= 1) for (const q of this.ppl.list) if (q !== o.victim && !q.hidden && !q.cop && Math.abs(q.x - x) < 25 && Math.abs(q.z - z) < 25) this.ppl.remember(q, 'saw');
    }
  }
  free(p) { return !(p.pax || p.cop || p.fixed || p.fallen > 0 || p.hidden || p.ctl || p.mode === 'fight' || p.mode === 'inside' || p.mode === 'free' || p.busy > 0 || p.tourist || p.venue); }
  // the people who are always there: shopkeepers in their doorways while the shop's open (in the peths they go in
  // for the 1 to 4 nap), a watchman on his chair at a gate at night
  locals(dt, P) {
    if ((this.locT = (this.locT || 0) - dt) > 0) return;
    this.locT = 1.5;
    const G = this.g, ppl = this.ppl, h = G.hour ?? 12, W = G.W;
    const area = (G.hud && G.hud.$ && G.hud.$('h-area')?.textContent) || '';
    const nap = h >= 13 && h < 16 && /Peth/.test(area), open = h >= 8.5 && h < 22.5 && !nap;
    this.keepers = (this.keepers || []).filter(k => ppl.list.includes(k.p));
    for (const k of [...this.keepers]) {
      const far = Math.hypot(k.p.x - P.x, k.p.z - P.z) > 80;
      if (far || (k.kind === 'shop' && !open) || (k.kind === 'watch' && h > 6.5 && h < 21)) { const i = ppl.list.indexOf(k.p); if (i >= 0) { if (k.p.body) k.p.body.release(); ppl.list.splice(i, 1); } if (k.d) k.d.keeper = null; this.keepers.splice(this.keepers.indexOf(k), 1); }
    }
    if (this.keepers.length >= 8 || !W.kit || !W.streamer) return;
    const night = h >= 21 || h < 6.5;
    for (const c of W.streamer.built) {
      if (!c.doors || Math.abs(c.cx - P.x) > 70 || Math.abs(c.cz - P.z) > 70) continue;
      for (const d of c.doors) {
        if (d.keeper || this.keepers.length >= 8) continue;
        const dd = Math.hypot(d.x - P.x, d.z - P.z);
        if (dd > 60 || dd < 12 || (G.inView && G.inView(d.x, d.z) && dd < 35)) continue;
        const shop = d.shop >= 0;
        if (shop ? !open : !night) continue;
        if (((d.x * 7 + d.z * 13) | 0) % (shop ? 3 : 7) !== 0) continue;        // not every shop, not every gate
        const male = !shop || R() < 0.8, look = W.kit.randomLook({ next: R, chance: (q) => R() < q, range: (a, b) => a + R() * (b - a), pick: (a) => a[Math.floor(R() * a.length)], int: (a, b) => a + Math.floor(R() * (b - a + 1)), weighted: null }, { female: !male, dress: shop ? undefined : 'traditional' });
        const x = d.x + d.nx * (shop ? 0.7 : 1.2), z = d.z + d.nz * (shop ? 0.7 : 1.2);
        const p = ppl.spawnAt(look, x, z, male ? (shop ? (R() < 0.5 ? 'kaka' : 'bhaiya') : 'kaka') : 'kaku');
        if (!p) continue;
        p.mode = 'stand'; p.fixed = true; p.anchor = { x, z, fx: x + d.nx * 4, fz: z + d.nz * 4 }; p.wait = 1e9; p.anim = null;
        p.idle = shop ? ['arms_folded', 'phone', 'idle', 'talk'][Math.floor(R() * 4)] : 'arms_folded';
        d.keeper = p; this.keepers.push({ p, d, kind: shop ? 'shop' : 'watch' });
      }
    }
  }
  update(dt, player) {
    const L = this.ppl.list, G = this.g;
    this.locals(dt, player);
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
        else if (t.temper > 0.7) { this.watch(p, P.x, P.z, 3, 'arms_folded'); ppl.speakAs('mutter', p, 1, 4); }
        else if (t.brave < 0.35) { ppl.flee(p, P.x, P.z, 10); }
        else { this.watch(p, P.x, P.z, 2.5, 'idle'); ppl.speakAs('greet', p, 0.8, 4); }
        return;
      }
    } else if (p.stare > 0) p.stare = 0;
    // 3. their own day
    if (p.mode !== 'walk' || p.chat) return;
    const h = (G.hour ?? 12), r = R();
    // dawn: the morning walkers and joggers are out (ajobas, kakas, aunties, the fitness dadas)
    if (h > 5.3 && h < 8.3 && !p.jogger && r < 0.25 && /ajoba|kaka|aunty|kaku|dada/.test(p.persona || '')) { p.jogger = true; if (/dada|kaka/.test(p.persona) && R() < 0.5) p.speed *= 2.1; else p.speed *= 1.3; }
    // the weather: in rain some hurry and some duck under an awning; in a storm everyone runs and most take shelter;
    // when it stops they go back to their own pace
    const wr = G.weather ? G.weather.cur.rain : 0;
    if (p.speed0 === undefined) p.speed0 = p.speed;
    if (wr > 0.15) {
      const storm = wr > 0.75;
      if (!p.wxDone) {
        p.wxDone = true;
        if (storm || R() < 0.35) p.speed = p.speed0 * (storm ? 2.1 : 1.8);
        if (R() < (storm ? 0.6 : 0.2)) {
          const d = ppl.doorNear && ppl.doorNear(p.x, p.z, 28, p);
          if (d) { ppl.goTo(p, d.x + d.nx * 0.9, d.z + d.nz * 0.9, (q) => this.watch(q, q.x + d.nx * 5, q.z + d.nz * 5, 30 + R() * 40, R() < 0.5 ? 'arms_folded' : 'phone'), true); p.busy = 80; return; }
        }
      }
    } else if (p.wxDone) { p.wxDone = false; p.speed = p.speed0; }
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
      p.anim = c.talker ? 'talk' : (R() < 0.5 ? 'idle' : 'arms_folded');
    }
  }
  endChat(p) { const q = p.chat && p.chat.with; p.chat = null; if (q && q.chat) q.chat = null; }
  // an old man resting on the bench at the bus stop, a tired worker at night
  sitAtStop(p) {
    const B = this.g.W.M.buses || [];
    let best = null, bd = 25 * 25;
    for (const b of B) { const x = b[0] / 100, z = b[1] / 100, d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < bd) { bd = d; best = { x, z }; } }
    if (!best) return;
    this.ppl.goTo(p, best.x + (R() - 0.5) * 1.2, best.z + (R() - 0.5) * 0.6, (q) => { this.watch(q, q.x + Math.cos(q.yaw), q.z + Math.sin(q.yaw), 20 + R() * 40, R() < 0.5 ? 'phone' : 'idle'); });
    p.busy = 70;
  }
}
