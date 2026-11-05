// What the city sounds like where you are, at this hour. The two recorded street loops (a market with its horns and
// its "aho", "anna" going round and round) were always on and always loud: now the crowd loop is only there in a real
// crowd (the people round you, counted), and the far traffic only as loud as the traffic that's really out (fewer
// vehicles at 6 in the morning than at 6 in the evening: the city's own numbers). Horns are the real ones, from
// vehicles honking where they are (traffic.honks, as before). The rest is made here, nothing loaded:
//   the road's rumble   from the vehicles really moving near you, by how many and how fast
//   birds               the dawn chorus from first light, quieter through the day, the crows and parakeets again at
//                       dusk; many more where it's green (the map's grass and scrub round you), fewer on a busy road
//   crickets            at night, where it's green; a lone one even in the city; quiet when traffic passes
//   dogs                the odd one at night, far off
const CELL = 20;     // metres per cell of the green map

export function soundscape(G) {
  const A = () => G.audio;
  // ---------------------------------------------------------------- the green map (grass and scrub from the map data)
  let green = null;
  function buildGreen() {
    const W = G.W, M = W && W.M, ix = W && W.index;
    if (!M || !M.ground || !ix) return false;
    const x0 = ix.x0, z0 = ix.z0, sx = ix.ncx*ix.size, sz = ix.ncz*ix.size;
    const cw = Math.ceil(sx/CELL), ch = Math.ceil(sz/CELL), cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, cw, ch);
    const draw = (rings, col) => {
      c.beginPath();
      for (const r of rings) { for (let k = 0; k < r.length; k += 2) { const px = (r[k]/100 - x0)/CELL, py = (r[k + 1]/100 - z0)/CELL; if (k === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.closePath(); }
      c.fillStyle = col; c.fill('evenodd');
    };
    for (const [kind, polys] of M.ground) { const v = kind === 'grass' || kind === 'scrub' ? '#fff' : kind === 'soil' ? '#666' : null; if (v) for (const [, rings] of polys) draw(rings, v); }
    for (const [, rings] of M.water || []) draw(rings, '#999');      // (water's edge: birds and frogs too)
    const d = c.getImageData(0, 0, cw, ch).data, g = new Uint8Array(cw*ch);
    for (let i = 0; i < g.length; i++) g[i] = d[i*4];
    green = { g, cw, ch, x0, z0 };
    return true;
  }
  // how green it is round a point: the share of the 100 m about it
  const greenAt = (x, z) => {
    if (!green) return 0.25;
    const { g, cw, ch, x0, z0 } = green, ci = Math.floor((x - x0)/CELL), cj = Math.floor((z - z0)/CELL);
    let s = 0, n = 0;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const i = ci + a, j = cj + b; if (i < 0 || j < 0 || i >= cw || j >= ch) continue; s += g[j*cw + i]; n++; }
    return n ? s/n/255 : 0;
  };
  const tryGreen = () => { if (!buildGreen()) setTimeout(tryGreen, 1500); };
  tryGreen();

  // ---------------------------------------------------------------- crickets: a few seconds of them, made once and looped
  let crk = null;
  function crickets(a) {
    const ctx = a.ctx, sec = 3.2, n = Math.floor(ctx.sampleRate*sec), out = [];
    for (let side = 0; side < 2; side++) {
      const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (let c = 0; c < 4; c++) {
        const f = 3900 + Math.random()*1300, rate = 1.6 + Math.random()*2, amp = 0.25 + Math.random()*0.5, pulses = 3 + Math.floor(Math.random()*3), ph = Math.random();
        for (let t0 = ph/rate; t0 < sec - 0.2; t0 += 1/rate*(0.9 + Math.random()*0.2)) {
          for (let p = 0; p < pulses; p++) {
            const s0 = Math.floor((t0 + p*0.028)*ctx.sampleRate), len = Math.floor(0.014*ctx.sampleRate);
            for (let i = 0; i < len && s0 + i < n; i++) { const e = Math.sin(Math.PI*i/len); d[s0 + i] += amp*e*e*Math.sin(2*Math.PI*f*(s0 + i)/ctx.sampleRate); }
          }
        }
      }
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
      const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null, g = ctx.createGain(); g.gain.value = 0;
      if (pn) { pn.pan.value = side ? 0.7 : -0.7; src.connect(g).connect(pn).connect(a.bus('world')); } else src.connect(g).connect(a.bus('world'));
      src.start(0, Math.random()*sec); out.push(g);
    }
    return out;
  }

  // ---------------------------------------------------------------- a songbird anyone knows: a run of quick bright
  // "tsee" notes, each falling, then a little trill (sparrows, bulbuls, magpie-robins all sing like this)
  function song(a, L) {
    const ang = Math.random()*6.283, r = 12 + Math.random()*30;
    a.at(L.x + Math.cos(ang)*r, L.z + Math.sin(ang)*r, () => {
      const ctx = a.ctx, t0 = ctx.currentTime + 0.02, n = 3 + Math.floor(Math.random()*5), base = 3200 + Math.random()*1400, vol = 0.03 + Math.random()*0.02;
      let t = t0;
      const note = (f0, f1, dur, v) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        vib.frequency.value = 38 + Math.random()*20; vg.gain.value = f0*0.03; vib.connect(vg).connect(o.frequency);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur*0.2); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        o.connect(g); a.out3(g, 0, a.bus('world')); o.start(t); vib.start(t); o.stop(t + dur + 0.02); vib.stop(t + dur + 0.02);
      };
      for (let k = 0; k < n; k++) { const f = base*(0.92 + Math.random()*0.16); note(f*1.15, f*0.78, 0.07 + Math.random()*0.04, vol); t += 0.11 + Math.random()*0.06; }
      if (Math.random() < 0.6) for (let k = 0; k < 6; k++) { note(base*1.25, base*1.05, 0.035, vol*0.8); t += 0.045; }
    }, 7);
  }

  // ---------------------------------------------------------------- horns: only where the traffic's stuck
  function honks() {
    const T = G.traffic, A_ = A(), Pl = G.player; if (!T || !A_ || !Pl) return;
    const now = performance.now();
    for (const h of T.honks) {
      const d = Math.hypot(h.x - Pl.x, h.z - Pl.z); if (d > 70) continue;
      // a jam is a lot of vehicles close together, barely moving
      // (a red light isn't a jam: it takes a lot of vehicles, packed and crawling)
      let slow = 0; for (const o of T.list) if (Math.abs(o.x - h.x) < 20 && Math.abs(o.z - h.z) < 20 && Math.abs(o.v || 0) < 2) slow++;
      const jam = slow >= 9;
      // in a jam, a horn every few seconds somewhere near; on a moving road, now and then (about one a minute)
      if (now - (G._hornT || 0) < (jam ? 3500 : 25000)) continue;
      if (Math.random() > (jam ? 0.5 : 0.25)) continue;
      G._hornT = now;
      A_.at(h.x, h.z, () => A_.horn(h.kind, jam ? 0.5 : 0.4, 0, Math.min(h.n || 1, jam ? 2 : 1)));
      break;
    }
    T.honks.length = 0;
  }
  // ---------------------------------------------------------------- the mix: easier on the ears for hours
  function mix(a) {
    if (a._mixed || !a.ctx || !a.master || !a.buses) return false;
    a._mixed = true;
    const ctx = a.ctx;
    // take the edge off the top (the fizz of synths and recordings), less pumping from the compressor
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 4500; shelf.gain.value = -6;
    const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 280; mud.Q.value = 0.8; mud.gain.value = -2;
    try { a.muf.disconnect(); } catch (e) { /* not wired */ }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 3; comp.knee.value = 18; comp.attack.value = 0.01; comp.release.value = 0.3;
    a.muf.connect(shelf).connect(mud).connect(comp).connect(ctx.destination);
    // each kind of sound a little back from the rest (the voices stay clearest)
    const TRIM = { traffic: 0.55, world: 0.7, fx: 0.8, voice: 0.9, music: 0.85 };
    for (const k in a.buses) { const b = a.buses[k], g = ctx.createGain(); g.gain.value = TRIM[k] ?? 0.8; try { b.disconnect(); } catch (e) { /* */ } b.connect(g).connect(a.master); }
    // the engine: rounder, not a buzz
    const E = a.eng;
    if (E && E.out) { try { E.out.disconnect(); } catch (e) { /* */ } const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.5; const g = ctx.createGain(); g.gain.value = 0.6; E.out.connect(lp).connect(g).connect(a.bus('traffic')); if (E.lp) E.lp.Q.value = 0.9; }
    return true;
  }

  // ---------------------------------------------------------------- every frame, in place of the old one
  let last = performance.now(), gT = 0, gNow = 0.25, crowd = 0, road = 0, far = 0, cT = 0;
  function update(density, night, rideSpeed = 0) {
    const a = A(); if (!a || !a.ctx || !a.amb) return;
    if (!a._mixed) mix(a);
    const now = performance.now(), dt = Math.min(0.25, (now - last)/1000); last = now;
    const t = a.ctx.currentTime, L = a.lis || { x: G.player?.x || 0, z: G.player?.z || 0 }, h = G.hour ?? a.hour ?? 12;
    const duck = a.duckUntil && t < a.duckUntil ? a.duckLevel : 1;
    // what's really round you (counted a few times a second)
    if ((cT -= dt) <= 0) {
      cT = 0.25;
      let r = 0, f = 0; for (const o of G.traffic?.list || []) { const d = Math.hypot(o.x - L.x, o.z - L.z); if (d < 70) r += Math.min(1.5, Math.abs(o.v || 0)/12)*(1 - d/70); if (d < 260) f++; }
      let c = 0; for (const p of G.people?.list || []) if (!p.hidden && Math.abs(p.x - L.x) < 28 && Math.abs(p.z - L.z) < 28) c++;
      road = Math.min(1, r/4); far = Math.min(1, f/45); crowd = Math.min(1, Math.max(0, c - 4)/16);
    }
    if ((gT -= dt) <= 0) { gT = 1; gNow = greenAt(L.x, L.z); }
    const gr = gNow, inside = !!G.interiors?.inside;
    // the recorded loops: only what's really there
    a.setLoop('street', 0, 0.6);                 // (the recorded market loop, "aho", "anna" and all: gone)
    a.setLoop('traffic', (0.015 + 0.075*far)*(1 - night*0.45)*duck*(inside ? 0.35 : 1), 0.8);
    a.setLoop('ride', Math.min(1, Math.max(0, rideSpeed/12))*0.16, 0.25);
    // the road's own rumble, from what's moving near you
    a.amb.g.gain.setTargetAtTime((0.006 + 0.05*road)*duck*(inside ? 0.4 : 1), t, 0.4);
    a.amb.lp.frequency.setTargetAtTime(160 + 340*road, t, 0.4);
    // the hour, for the birds
    const day = night > 0.6 ? 0 : h >= 5.3 && h < 8.5 ? 2.4 : h < 11 ? 1.2 : h < 16.3 ? 0.55 : h < 19.2 ? 1.3 : 0.2;
    const quiet = 1 - 0.6*road;
    if (!inside && day > 0) {
      if (Math.random() < dt*0.03*day*(0.5 + 0.5*(1 - gr))) a.crow();
    }
    // crickets at night, where it's green (one or two even in the city)
    if (!crk && night > 0.3) crk = crickets(a);
    if (crk) { const v = night*(0.08 + 0.5*gr)*quiet*(inside ? 0.15 : 1)*0.07; crk.forEach((g, i) => g.gain.setTargetAtTime(v*(i ? 0.8 : 1), t, 1.2)); }
    // the odd dog, far off, at night
    if (!inside && Math.random() < dt*0.03*(0.2 + night)) a.at(L.x + (Math.random() - 0.5)*140, L.z + (Math.random() - 0.5)*140, () => a.bark(0.45, 0));
  }
  const hook = () => { const a = A(); if (!a || !a.updateAmbient) { setTimeout(hook, 500); return; } a.updateAmbient = update; G.playHonks = honks; if (!mix(a)) { const m = () => { if (!mix(a)) setTimeout(m, 800); }; setTimeout(m, 800); } };
  hook();
}
