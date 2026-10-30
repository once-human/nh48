// What the garage's gadgets do out on the road (mods.js fits them):
//  · Nitrous: hold Shift. Harder, past the top speed, flames out the back, the bottle runs down (garages refill it).
//  · Hydraulics: G and it jumps.
//  · Roof lights: N. A red beacon or strobes, and the traffic ahead pulls over to the kerb for you (as it does for
//    a siren). The police don't: a laal batti on a private car has been banned since 2017.
//  · A DJ box: U. Dhol-tasha with a lot of bass; stand still and the people on the footpath start dancing.
//  · A loud silencer: deeper, louder, it pops when you lift off (the flame kit spits fire), people jump.
//  · And the law: a havaldar who sees tinted glass, a bull bar, a fancy plate, a beacon going, hears a pressure
//    horn or a silencer pop can pull you over (₹5,000 an alteration, MV Act s.52 / s.182A(4)) and have it taken off.
import { modsOf, illegalOf, strip, applyMods } from '../vehicles/mods.js';

export class ModFX {
  constructor(G) {
    this.g = G; this.t = 0; this.chkT = 0; this.prev = {}; this.thrWas = 0; this.dancers = [];
    const el = this.el = document.createElement('div'); el.className = 'mfx'; el.hidden = true;
    (document.getElementById('hud') || document.body).appendChild(el);
  }
  edge(code) { const k = this.g.input.key(code), was = this.prev[code]; this.prev[code] = k; return k && !was; }
  update(dt) {
    const G = this.g, P = G.player, v = P.onFoot ? null : P.cur;
    this.t += dt;
    if (!v || G.state !== 'play') {
      if (this.djOn) this.music(false);
      if (G.traffic) G.traffic.yieldTo = null;
      G.audio.engLoud = 1; this.el.hidden = true;
      return;
    }
    const m = modsOf(G, v) || {}, type = v === P.auto ? 'auto' : v.type;
    const thr = v.throttle || 0;
    // nitrous
    const want = !!(v.n2oMax && (m.n2o || 0) > 0 && thr > 0.1 && G.input.key('ShiftLeft', 'ShiftRight'));
    if (want && !v.boost) { G.audio.whoosh?.(0.9); G.rig.shake?.(0.12); }
    if (!want && v.boost && (m.n2o || 0) <= 0) G.hud.toast('Nitrous empty', 'Any garage refills the bottle', 'info', 2.4);
    v.boost = want;
    if (want) { m.n2o = Math.max(0, m.n2o - dt); this.fire(v, 0.5); if ((this._bT = (this._bT || 0) - dt) <= 0) { this._bT = 0.12; G.rig.shake?.(0.04); } }
    // hydraulics
    if (this.edge('KeyG') && v.hydro) { v.vy = (v.vy || 0) + 4.2; G.audio.noiseBurst?.(0.22, 420, 0.8, 0.35); G.audio.thud?.(0.3); }
    // roof lights
    if (this.edge('KeyN') && v.beacon) { v.beaconOn = !v.beaconOn; G.hud.toast(v.beaconOn ? (v.beacon === 'red' ? 'Laal batti on' : 'Strobes on') : 'Roof lights off', v.beaconOn ? 'Traffic ahead pulls over. Any havaldar will notice' : '', v.beaconOn ? 'warn' : 'info', 1.6); }
    if (v._beacon) {
      const B = v._beacon, on = !!v.beaconOn;
      if (v.beacon === 'red') { const f = on && (this.t * 2.2) % 1 < 0.55; for (const q of B.a) q.visible = f; for (const q of B.off) q.visible = !f; }
      else { const ph = Math.floor(this.t * 8) % 4, fa = on && (ph === 0 || ph === 2) && Math.floor(this.t * 2) % 2 === 0, fb = on && (ph === 0 || ph === 2) && Math.floor(this.t * 2) % 2 === 1; for (const q of B.a) q.visible = fa; for (const q of B.b) q.visible = fb; for (let i = 0; i < B.off.length; i++) B.off[i].visible = !(i ? fa : fb); }
    }
    const lit = (v.beaconOn && v.beacon) || v.sirenOn;
    G.traffic.yieldTo = lit && Math.abs(v.v) > 1 ? { x: v.x, z: v.z, hx: Math.cos(v.th), hz: Math.sin(v.th) } : null;
    // the music
    if (this.edge('KeyU') && v.dj) this.music(!this.djOn);
    if (this.djOn && !v.dj) this.music(false);
    if (this.djOn) this.dance(v, dt);
    // a loud exhaust: the sound, and the pops when you lift off
    G.audio.engLoud = v.loud || 1;
    if ((v.loud || 1) >= 1.8 && this.thrWas > 0.6 && thr < 0.1 && Math.abs(v.v) > 4) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) setTimeout(() => { G.audio.noiseBurst?.(0.05, 140 + Math.random() * 90, 1.4, 0.55); if (v.flames) this.fire(v, 0.25); }, 60 + i * (70 + Math.random() * 60));
      G.people && G.people.onHorn && G.people.onHorn(P);
      this.loudT = 1.5;
    }
    this.thrWas = thr; if (this.loudT > 0) this.loudT -= dt;
    // the law
    if ((this.chkT -= dt) <= 0) { this.chkT = 1; this.law(v, m, type); }
    this.driftTick(dt);
    // the strip of keys for what this one has
    const keys = [this.dr && this.dr.pts > 60 ? `<b class="on">DRIFT ${Math.round(this.dr.pts).toLocaleString('en-IN')}</b>` : '',v.n2oMax ? `<span class="kbd">Shift</span><b>N₂O</b><i class="mfx-bar"><u style="width:${Math.round((m.n2o || 0) * 10)}%"></u></i>` : '', v.hydro ? '<span class="kbd">G</span><b>Hop</b>' : '', v.beacon ? `<span class="kbd">N</span><b${v.beaconOn ? ' class="on"' : ''}>${v.beacon === 'red' ? 'Laal batti' : 'Strobes'}</b>` : '', v.dj ? `<span class="kbd">U</span><b${this.djOn ? ' class="on"' : ''}>Music</b>` : ''].filter(Boolean);
    const h = keys.map(k => `<span class="mfx-k">${k}</span>`).join('');
    if (h !== this._h) { this._h = h; this.el.innerHTML = h; }
    this.el.hidden = !keys.length;
  }
  // a drift: smoke off the back tyres, the squeal, and points for a long one (a combo that grows while it lasts)
  onDrift(ev, v) {
    const G = this.g; if (!v) return;
    const c = Math.cos(v.th), s = Math.sin(v.th), L = (v.spec ? v.spec.L : 4) / 2 - 0.6, W = (v.spec ? v.spec.W : 1.7) / 2;
    if (G.smoke && Math.random() < 0.55) for (const sd of [-1, 1]) G.smoke.emit(v.x - c * L - s * sd * W, (v.y || 0) + 0.25, v.z - s * L + c * sd * W, 'steam', 0.5);
    if ((this._sqT = (this._sqT || 0) - 1 / 60) <= 0) { this._sqT = 0.09; G.audio.noiseBurst?.(0.12, 2400 + Math.random() * 600, 6, Math.min(0.22, ev.amount * 0.03)); }
    this.dr = this.dr || { pts: 0, t: 0 };
    this.dr.pts += ev.amount * ev.sp * 0.12; this.dr.t = 0.6;
  }
  driftTick(dt) {
    const D = this.dr; if (!D || D.pts <= 0) return;
    D.t -= dt;
    if (D.t <= 0) {
      const p = Math.round(D.pts);
      if (p > 150) { this.g.hud.toast(p > 2500 ? 'Monster drift!' : p > 1000 ? 'Clean drift' : 'Drift', `${p.toLocaleString('en-IN')} points${p > 1000 ? '. Somebody filmed that' : ''}`, 'meter', 2.2); this.g.life && this.g.life.change('respect', Math.min(2, p / 2000)); }
      D.pts = 0;
    }
  }
  // flames out of the exhaust tip (world position from the vehicle's frame)
  fire(v, s) {
    const G = this.g, tip = v._tip || [-(v.spec ? v.spec.L / 2 : 1.3), 0.25, 0.3];
    if (!G.smoke || Math.random() > 0.7) return;
    const c = Math.cos(v.th), sn = Math.sin(v.th);
    G.smoke.emit(v.x + c * tip[0] - sn * tip[2], (v.y || 0) + tip[1], v.z + sn * tip[0] + c * tip[2], 'fire', s * 0.4);
  }
  law(v, m, type) {
    const G = this.g, P = G.player, pol = G.police;
    if (G.free || !pol || pol.stop || pol.holding?.()) return;
    const all = illegalOf(m, type);
    if (!all.length) return;
    // what can be seen or heard right now
    const seen = all.filter(([k]) => k === 'tint' || k === 'bullbar' || k === 'fancy' || k === 'paint' || (k === 'beacon' && v.beaconOn) || (k === 'exhaust' && this.loudT > 0) || (k === 'horn' && G.input.state.horn));
    if (!seen.length) return;
    const cop = pol.copSeeing(P.x, P.z, seen.some(s => s[0] === 'horn' || s[0] === 'exhaust') ? 40 : 24);
    if (!cop) return;
    const loud = seen.some(s => s[0] === 'beacon' || s[0] === 'horn');
    pol.offence('alter', P.x, P.z, { stopChance: loud ? 0.85 : 0.4 * (m.hsrp ? 0.8 : 1), n: seen.length, what: seen.map(s => s[1]), missed: ['A havaldar looked twice', 'At your ' + seen[0][1].toLowerCase() + '. Lucky this time'] });
  }
  // the havaldar has it taken off: back to legal on this vehicle
  confiscate() {
    const G = this.g, P = G.player, v = P.onFoot ? null : P.cur; if (!v) return '';
    const m = modsOf(G, v); if (!m) return '';
    const type = v === P.auto ? 'auto' : v.type, gone = strip(m, type);
    if (!gone.length) return '';
    v.beaconOn = false;
    applyMods(G, v); if (v === P.auto) G.applyUpgrades();
    G.life.save();
    return gone.join(', ').toLowerCase();
  }
  // ---------------------------------------------------------------- the DJ box
  music(on) {
    const G = this.g, A = G.audio, ctx = A.ctx;
    this.djOn = on;
    if (this.loop) { clearInterval(this.loop); this.loop = null; }
    if (this.out) { const o = this.out; o.gain.setTargetAtTime(0, ctx.currentTime, 0.1); setTimeout(() => o.disconnect(), 600); this.out = null; }
    for (const p of this.dancers) if (p.idle === 'dance') p.idle = p._idleWas || 'idle';
    this.dancers = [];
    if (!on || !ctx) return;
    const out = this.out = ctx.createGain(); out.gain.value = 0.32; out.connect(A.bus('music'));
    // dhol (low, the 3-3-2 of a Pune procession), tasha (bright cracks), a sub bass line
    const BASS = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    let step = 0;
    const tick = () => {
      if (this.g.state !== 'play') return;
      const t = ctx.currentTime + 0.02, s = step++ % 16;
      if ([0, 3, 6, 8, 11, 14].includes(s)) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(s % 8 === 0 ? 120 : 95, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.16); g.gain.setValueAtTime(s % 8 === 0 ? 1 : 0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(out); o.start(t); o.stop(t + 0.32); }
      { const src = ctx.createBufferSource(); src.buffer = A.noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.2; const g = ctx.createGain(); const acc = s % 4 === 2 ? 0.55 : s % 2 ? 0.12 : 0.22; g.gain.setValueAtTime(acc, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07); src.connect(bp).connect(g).connect(out); src.start(t, Math.random() * 2, 0.08); }
      if (s % 2 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(BASS[(s / 2) | 0], t); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24); o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 0.26); }
    };
    this.loop = setInterval(tick, 60000 / 112 / 4);
    G.hud.toast('Music on', 'Stand still somewhere busy', 'info', 1.6);
  }
  dance(v, dt) {
    const G = this.g;
    if ((this._dT = (this._dT || 0) - dt) > 0) return;
    this._dT = 1;
    if (Math.abs(v.v) > 2 || !G.people) return;
    let n = 0;
    for (const p of G.people.list) {
      if (p.cop || p.ctl || p.hidden || p.fallen > 0 || p.mode !== 'stand' || p.idle === 'dance') continue;
      if (Math.hypot(p.x - v.x, p.z - v.z) > 16 || Math.random() > 0.5) continue;
      p._idleWas = p.idle; p.idle = 'dance'; p.anim = 'dance'; this.dancers.push(p); if (++n >= 3) break;
    }
    if (n && (this._mT = (this._mT || 0) - 1) <= 0) { this._mT = 20; G.life.change('mood', 0.02); G.life.change('respect', 0.3); }
  }
}
