// Sound: recorded CC0 samples (Freesound) for horns, street ambience, the inside-an-auto ride,
// crows, dogs, cows and temple bells; the player's single-cylinder engine is still synthesised so
// it follows the throttle exactly. Samples arrive with the other assets and are decoded on the
// first click or key press (browsers only start audio after a user gesture).
import { clamp } from '../core/util.js';

// horn voices: car = a hatchback's dual-tone; beep = a single disc horn, pitched up and shaped
// for scooters and autos; bus/truck = an air horn. The musical tempo horn stays synthesised.
const HORN = {
  car: { s: 'horn_car', r: 1.0, v: 0.9, gap: 0.42 },
  beep: { s: 'horn_beep', r: 1.12, v: 0.8, gap: 0.3 },
  scooter: { s: 'horn_beep', r: 1.28, v: 0.7, gap: 0.26, f: { type: 'highpass', f: 500 } },
  auto: { s: 'horn_beep', r: 1.08, v: 0.95, gap: 0.3, f: { type: 'peaking', f: 1400, q: 1.2, gain: 7 } },
  bus: { s: 'horn_truck_short', r: 1.0, v: 1.0, gap: 0.6 },
  truck: { s: 'horn_truck', r: 1.0, v: 0.9, gap: 0.9 },
  bell: { s: 'horn_beep', r: 2.6, v: 0.25, gap: 0.2 },
};

// every sound goes through one of these, each with its own volume in Settings
export const BUSES = ['traffic', 'voice', 'world', 'fx', 'music'];
// which bus a recorded sample belongs to, by name
const busOf = (name) => name.startsWith('v_') ? 'voice'
  : /^(horn_|car_idle|diesel_idle|auto_start|amb_traffic|amb_auto_ride)/.test(name) ? 'traffic'
  : /^(amb_|crow|dog_bark|cow_moo|temple_bells)/.test(name) ? 'world' : 'fx';

export class Audio {
  constructor(raw) {
    this.ctx = null; this.enabled = true; this.volume = 0.8;
    this.vols = { traffic: 1, voice: 1, world: 1, fx: 1, music: 1 };
    this.buses = {}; this._bus = null;
    this.lastHonk = 0;
    this.raw = raw || {};          // name -> ArrayBuffer (mp3)
    this.buf = {};
    this.loops = {};
  }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5;
    this.master.connect(comp).connect(ctx.destination);
    // every bus straight into the master (the fx bus used to be wired into itself, so punches, clicks and UI sounds never came out)
    for (const k of BUSES) { const g = this.buses[k] = ctx.createGain(); g.gain.value = this.vols[k] ?? 1; g.connect(this.master); }
    // (no convolution reverb: too heavy for the audio thread on laptops, the sound broke up)
    this.noise = this.makeNoise(2);
    this.buildEngine();
    this.buildAmbient();
    this.decodeAll();
  }
  async decodeAll() {
    const ctx = this.ctx;
    // voice lines decode when first spoken (thousands of them; decoding all would cost seconds and memory)
    await Promise.all(Object.entries(this.raw).filter(([k]) => !k.startsWith('v_')).map(async ([k, ab]) => {
      try { this.buf[k] = await ctx.decodeAudioData(ab.slice(0)); } catch (e) { /* unsupported codec: that sound stays silent */ }
    }));
    this.startLoops();
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setBusVolume(k, v) { this.vols[k] = v; const g = this.buses[k]; if (g) g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  // the node a sound connects to: its category's bus (inside horn() etc. the category is set for the call)
  bus(k) { return this.buses[k || this._bus || 'fx'] || this.master; }
  // run fn with every sound it makes going to bus k
  on(k, fn) { const was = this._bus; this._bus = k; try { return fn(); } finally { this._bus = was; } }
  makeNoise(sec) {
    const ctx = this.ctx, n = ctx.sampleRate * sec;
    const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  // ---------------------------------------------------------------- samples
  // ---------------------------------------------------------------- 3D: where you hear things from
  // the listener rides the camera (set every frame); anything played inside at(x, z, fn) comes from that spot: the
  // right ear or the left, in front or behind, and quieter with distance (so far traffic is a murmur)
  listen(cam) {
    if (!this.ctx || !cam) return;
    const L = this.ctx.listener, p = cam.position, f = this._fwd || (this._fwd = cam.position.clone());
    cam.getWorldDirection(f);
    if (L.positionX) { const t = this.ctx.currentTime; L.positionX.setTargetAtTime(p.x, t, 0.02); L.positionY.setTargetAtTime(p.y, t, 0.02); L.positionZ.setTargetAtTime(p.z, t, 0.02);
      L.forwardX.setTargetAtTime(f.x, t, 0.02); L.forwardY.setTargetAtTime(f.y, t, 0.02); L.forwardZ.setTargetAtTime(f.z, t, 0.02); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else if (L.setPosition) { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    this.lis = { x: p.x, z: p.z };
  }
  at(x, z, fn, y = 1.2) { const was = this._at; this._at = { x, y, z }; try { return fn(); } finally { this._at = was; } }
  panner(pos, ref = 6) {
    const ctx = this.ctx, pn = ctx.createPanner();
    // equalpower is cheap on the audio thread (HRTF on every sound made it stutter); people's voices get HRTF, there's only ever one
    pn.panningModel = this._hrtf ? 'HRTF' : 'equalpower'; pn.distanceModel = 'inverse';
    pn.refDistance = ref; pn.rolloffFactor = 1.15; pn.maxDistance = 400;
    if (pn.positionX) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; } else pn.setPosition(pos.x, pos.y, pos.z);
    return pn;
  }
  out3(g, pan, out) {
    const ctx = this.ctx;
    if (this._at) { g.connect(this.panner(this._at)).connect(out); return; }
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p).connect(out); } else g.connect(out);
  }
  play(name, { vol = 0.5, pan = 0, rate = 1, delay = 0, offset = 0, dur, filter, bus } = {}) {
    const b = this.buf[name];
    if (!this.ctx || !b) return null;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = vol;
    let node = src;
    if (filter) {
      const f = ctx.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.f; f.Q.value = filter.q || 0.8;
      if (filter.gain !== undefined) f.gain.value = filter.gain;
      node.connect(f); node = f;
    }
    node.connect(g);
    const out = this.bus(bus || this._bus || busOf(name));
    this.out3(g, pan, out);
    src.start(t, offset, dur);
    return { src, g };
  }
  loop(name, vol = 0) {
    const b = this.buf[name];
    if (!this.ctx || !b) return null;
    const src = this.ctx.createBufferSource(); src.buffer = b; src.loop = true;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(this.bus(busOf(name)));
    src.start(0, Math.random() * b.duration);
    return { src, g };
  }
  // a sound that arrived after the start (they download once you're at the title): decode it now, and
  // start the ambient loops once theirs are in
  addRaw(name, ab) {
    this.raw[name] = ab;
    if (!this.ctx || name.startsWith('v_')) return;
    this.ctx.decodeAudioData(ab.slice(0)).then(b => { this.buf[name] = b; if (/^amb_/.test(name) && this.loops) { const k = { amb_street: 'street', amb_traffic: 'traffic', amb_auto_ride: 'ride' }[name]; if (k && !this.loops[k]) this.loops[k] = this.loop(name, 0); } }).catch(() => {});
  }
  startLoops() {
    this.loops.street = this.loop('amb_street', 0);
    this.loops.traffic = this.loop('amb_traffic', 0);
    this.loops.ride = this.loop('amb_auto_ride', 0);
  }
  // pause / map: everything goes quiet (sirens, engines, voices), and comes back after
  hush(on) {
    if (!this.ctx) return;
    if (on && this.ctx.state === 'running') this.ctx.suspend();
    else if (!on && this.ctx.state === 'suspended') this.ctx.resume();
  }
  setLoop(name, v, tc = 0.4) { const l = this.loops[name]; if (l) l.g.gain.setTargetAtTime(v, this.ctx.currentTime, tc); }

  // ---------------------------------------------------------------- voices (TTS lines, see lines.json)
  // a clip that isn't here yet: read just its bytes from its pack (or the whole pack once, from a server that
  // can't do ranges), then say it if it's still timely
  fetchVoice(id, then) {
    const R = this.remote, e = R && R.idx[id];
    if (!e) return false;
    const name = 'v_' + id, [off, len, pk] = e, url = R.urls[pk || 0];
    if (!url) return false;
    this.fetching = this.fetching || {};
    if (this.fetching[name]) return true;
    this.fetching[name] = true;
    const asked = this.ctx.currentTime, whole = (R.whole = R.whole || {});
    const got = (ab) => { this.raw[name] = ab; delete this.fetching[name]; if (this.ctx.currentTime - asked < 1.5) then(); };
    if (whole[url]) { whole[url].then((b) => b && got(b.slice(off, off + len))); return true; }
    fetch(url, { headers: { Range: `bytes=${off}-${off + len - 1}` } }).then(async (r) => {
      if (r.status === 206) return got(await r.arrayBuffer());
      if (!r.ok) throw new Error(r.status);
      const all = r.arrayBuffer(); whole[url] = all;
      got((await all).slice(off, off + len));
    }).catch(() => { delete this.fetching[name]; });
    return true;
  }
  voice(id, vol = 1, pan = 0, radio = false, pri = 2) {
    // one voice at a time, and not everyone at once: idle chatter (pri 0) waits for silence, a
    // reaction (pri 1: someone you knocked over, hit, or whose car you took) won't talk over another
    // reaction, and the police / your passenger (pri 2) always get through
    if (!this.ctx) return true;
    if (this.only && !id.startsWith(this.only)) return false;
    const now = this.ctx.currentTime, busy = this.curVoice && now < this.voiceEnd - 0.15;
    if (busy && (pri === 0 || (pri < 2 && pri <= this.voicePri))) return false;
    // after someone has spoken, a breath of quiet before the next bit of idle chatter
    if (pri === 0 && this.voiceEnd && now < this.voiceEnd + 2.5) return false;
    const name = 'v_' + id;
    if (!this.buf[name]) {
      const raw = this.raw[name];
      const at0 = this._at, again = () => at0 ? this.at(at0.x, at0.z, () => this.voice(id, vol, pan, radio, pri), at0.y) : this.voice(id, vol, pan, radio, pri);
      if (!raw) return this.fetchVoice(id, again);
      this.decoding = this.decoding || {};
      if (!this.decoding[name]) {
        this.decoding[name] = true;
        const asked = now;
        this.ctx.decodeAudioData(raw.slice(0)).then((b) => {
          this.buf[name] = b; this.keepVoice(name);
          if (this.ctx.currentTime - asked < 1.2) again();
        }).catch(() => { /* bad clip: stays silent */ }).finally(() => { delete this.decoding[name]; });
      }
      return true;
    }
    this.keepVoice(name);
    if (this.curVoice) { try { this.curVoice.g.gain.setTargetAtTime(0, now, 0.04); this.curVoice.src.stop(now + 0.15); } catch (e) { /* already stopped */ } }
    this._hrtf = true;
    let v; try { v = this.play('v_' + id, { vol: 0.95 * vol, pan, filter: radio ? { type: 'bandpass', f: 1500, q: 0.9 } : undefined }); } finally { this._hrtf = false; }
    if (!v) return false;
    this.curVoice = v; this.voicePri = pri; this.voiceEnd = now + v.src.buffer.duration;
    this.duck(radio ? 0.75 : 0.55, Math.min(4, v.src.buffer.duration + 0.3));
    return true;
  }
  // keep the most recent ~180 decoded lines, drop the oldest
  keepVoice(name) {
    const o = this.vOrder || (this.vOrder = []);
    const i = o.indexOf(name); if (i >= 0) o.splice(i, 1);
    o.push(name);
    while (o.length > 180) { const old = o.shift(); if (!this.curVoice || this.curVoice.src.buffer !== this.buf[old]) delete this.buf[old]; }
  }
  voiceBusy() { return !!(this.ctx && this.curVoice && this.ctx.currentTime < this.voiceEnd - 0.15); }
  // street ambience dips while someone speaks
  duck(level, sec) {
    if (!this.ctx) return;
    this.duckUntil = this.ctx.currentTime + sec;
    this.duckLevel = level;
  }
  // police siren: a rising-falling wail; level 0 = off
  siren(level, pan = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.sir) {
      if (level <= 0) return;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0;
      const p = this.panner({ x: 0, y: 2, z: 0 }, 14);
      const m = ctx.createGain(); m.gain.value = 0.35;
      o.connect(bp); o2.connect(m).connect(bp); bp.connect(g);
      const out = this.bus('traffic');
      g.connect(p).connect(out);
      o.start(); o2.start();
      this.sir = { o, o2, g, p, ph: 0 };
    }
    const S = this.sir;
    S.ph = (S.ph + 1 / 60) % 3.2;
    const f = 620 + 760 * Math.sin(Math.PI * S.ph / 3.2);    // up and down over ~3 s
    S.o.frequency.setTargetAtTime(f, t, 0.03); S.o2.frequency.setTargetAtTime(f * 1.006, t, 0.03);
    S.g.gain.setTargetAtTime(level > 0 ? 0.32 : 0, t, 0.15);       // loudness comes from distance now
    // the siren is where the nearest siren-vehicle is (police.js / emergency.js set sirenAt)
    const sp = this.sirenAt || (this.lis ? { x: this.lis.x + pan * 20, z: this.lis.z } : { x: 0, z: 0 });
    if (S.p.positionX) { S.p.positionX.setTargetAtTime(sp.x, t, 0.05); S.p.positionY.setTargetAtTime(1.8, t, 0.05); S.p.positionZ.setTargetAtTime(sp.z, t, 0.05); } else S.p.setPosition(sp.x, 1.8, sp.z);
  }

  // ---------------------------------------------------------------- engine (single-cylinder 4-stroke putter)
  buildEngine() {
    const ctx = this.ctx;
    this.eng = {};
    const out = ctx.createGain(); out.gain.value = 0;
    out.connect(this.bus('traffic'));
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 12;
    const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 24;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); }
    shaper.curve = curve;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3.5;
    const mix = ctx.createGain(); mix.gain.value = 0.55;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    osc.connect(mix); osc2.connect(g2).connect(mix);
    mix.connect(shaper).connect(lp).connect(out);
    const nz = ctx.createBufferSource(); nz.buffer = this.noise; nz.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 12;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.16;
    lfo.connect(lfoG).connect(am.gain);
    nz.connect(bp).connect(am).connect(out);
    osc.start(); osc2.start(); nz.start(); lfo.start();
    Object.assign(this.eng, { out, osc, osc2, lp, lfo, bp });
  }
  // kind: 'auto' (single-cylinder putter), 'two' (scooter/bike: same synth, higher and lighter),
  // 'car' / 'bus' (recorded petrol / diesel idle, pitched up with revs)
  updateEngine(rpm, throttle, running, kind = 'auto') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const E = this.eng;
    const synth = running && (kind === 'auto' || kind === 'two');
    const mul = kind === 'two' ? 1.7 : 1;
    const f = (9 + rpm * 38) * mul;
    E.osc.frequency.setTargetAtTime(f, t, 0.04);
    E.osc2.frequency.setTargetAtTime(f * 2.01, t, 0.04);
    E.lfo.frequency.setTargetAtTime(f, t, 0.04);
    E.lp.frequency.setTargetAtTime((260 + rpm * 900 + throttle * 300) * (kind === 'two' ? 1.5 : 1), t, 0.05);
    E.bp.frequency.setTargetAtTime((700 + rpm * 1400) * mul, t, 0.05);
    E.out.gain.setTargetAtTime(synth ? (0.16 + throttle * 0.1 + rpm * 0.06) * (kind === 'two' ? 0.7 : 1) : 0, t, 0.08);
    // recorded engines for cars and buses
    for (const [k, name] of [['car', 'car_idle'], ['bus', 'diesel_idle']]) {
      const on = running && kind === k;
      if (on && !this.loops[name] && this.buf[name]) this.loops[name] = this.loop(name, 0);
      const l = this.loops[name];
      if (!l) continue;
      l.g.gain.setTargetAtTime(on ? 0.22 + throttle * 0.18 : 0, t, 0.12);
      l.src.playbackRate.setTargetAtTime(on ? (k === 'bus' ? 0.85 : 0.9) + rpm * (k === 'bus' ? 0.7 : 1.3) : 1, t, 0.08);
    }
    if (!running && kind !== 'none') for (const k of ['street', 'traffic', 'ride']) this.setLoop(k, 0, 0.3);
  }

  // ---------------------------------------------------------------- ambience
  buildAmbient() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const g = ctx.createGain(); g.gain.value = 0.04;
    src.connect(lp).connect(g).connect(this.bus('world'));
    src.start();
    this.amb = { g, lp };
  }
  updateAmbient(density, night, rideSpeed = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const duck = this.duckUntil && t < this.duckUntil ? this.duckLevel : 1;
    this.amb.g.gain.setTargetAtTime((0.02 + density * 0.03) * duck, t, 0.5);
    this.setLoop('street', (0.22 + density * 0.18) * (1 - night * 0.55) * duck, 0.25);
    this.setLoop('traffic', (0.05 + density * 0.13) * (1 - night * 0.6) * duck, 0.25);        // the far traffic hum, quieter: close vehicles are heard where they are
    this.setLoop('ride', clamp(rideSpeed / 12, 0, 1) * 0.16, 0.25);
    // nature: crows and small birds all day, most in the morning and the quiet afternoon (less traffic to drown them);
    // at night only the odd dog
    const h = this.hour ?? 12, birds = night > 0.6 ? 0 : (h > 5.5 && h < 10 ? 1.4 : h >= 12 && h < 17 ? 1.8 : 0.8) * (1.2 - density * 0.6);
    if (Math.random() < 0.003 * birds) this.crow();
    if (Math.random() < 0.006 * birds) this.chirp();
    if (Math.random() < 0.0015 * (0.3 + night)) this.at(this.lis ? this.lis.x + (Math.random() - 0.5) * 120 : 0, this.lis ? this.lis.z + (Math.random() - 0.5) * 120 : 0, () => this.bark(0.5, 0));
  }

  // ---------------------------------------------------------------- horns
  horn(kind, vol = 0.5, pan = 0, n = 1) {
    const H = HORN[kind] || HORN.car;
    if (kind === 'tempo' || !this.buf[H.s]) return this.on('traffic', () => this.hornSynth(kind, vol, pan, n));
    for (let k = 0; k < n; k++) this.play(H.s, { vol: vol * H.v, pan, rate: H.r * (0.97 + Math.random() * 0.06), delay: k * H.gap, filter: H.f });
  }
  hornSynth(kind, vol, pan, n) {
    for (let k = 0; k < n; k++) {
      const d = k * 0.28;
      if (kind === 'auto') this.tone('square', [415, 432], 0.22, vol * 0.5, pan, d, 0);
      else if (kind === 'beep' || kind === 'scooter') this.tone('square', [520], 0.15, vol * 0.35, pan, d, 0);
      else if (kind === 'car') this.tone('sawtooth', [370, 466], 0.32, vol * 0.3, pan, d * 1.3, 0);
      else if (kind === 'bus' || kind === 'truck') this.tone('sawtooth', [185, 233, 277], 0.6, vol * 0.4, pan, d * 1.8, 0);
      else if (kind === 'bell') this.tone('sine', [1800, 2400], 0.12, vol * 0.25, pan, d * 0.6, 0);
      else if (kind === 'tempo') {
        const notes = [523, 659, 784, 659, 523];
        notes.forEach((f, i) => this.tone('square', [f], 0.11, vol * 0.25, pan, i * 0.12, 0));
        break;
      }
    }
  }
  // the player's horn while the key is held: loops the steady middle of the recording
  playerHorn(on, kind = 'auto') {
    if (!this.ctx) return;
    const H = HORN[kind] || HORN.auto, b = this.buf[H.s];
    if (on && !this.hornNode && b) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = H.r;
      src.loop = true; src.loopStart = b.duration * 0.3; src.loopEnd = b.duration * 0.72;
      const g = ctx.createGain(); g.gain.value = 0;
      let node = src;
      if (H.f) {
        const f = ctx.createBiquadFilter(); f.type = H.f.type; f.frequency.value = H.f.f; f.Q.value = H.f.q || 0.8;
        if (H.f.gain !== undefined) f.gain.value = H.f.gain;
        src.connect(f); node = f;
      }
      node.connect(g).connect(this.bus('traffic'));
      src.start();
      g.gain.setTargetAtTime(0.55 * H.v, ctx.currentTime, 0.008);
      this.hornNode = { src, g };
    } else if (!on && this.hornNode) {
      const h = this.hornNode; this.hornNode = null;
      h.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015);
      setTimeout(() => { try { h.src.stop(); } catch (e) { /* stopped */ } }, 120);
    }
  }

  // ---------------------------------------------------------------- one-shots
  env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  tone(type, freqs, dur, vol, pan = 0, delay = 0, vib = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const g = ctx.createGain();
    const out = this.bus();
    this.out3(g, pan, out);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freqs[0] * 2.2; bp.Q.value = 0.7;
    bp.connect(g);
    for (const f of freqs) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      if (vib) { const l = ctx.createOscillator(); l.frequency.value = vib; const lg = ctx.createGain(); lg.gain.value = f * 0.015; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.1); }
      o.connect(bp); o.start(t); o.stop(t + dur + 0.05);
    }
    this.env(g, t, 0.01, vol, dur * 0.8, dur * 0.2 + 0.02);
  }
  // a punch landing: a short slap of noise and a low knock
  punch(strength = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 500; bp.Q.value = 0.9;
    const g = ctx.createGain();
    src.connect(bp).connect(g).connect(this.bus());
    this.env(g, t, 0.002, clamp(0.25 + strength * 0.4, 0.1, 0.8), 0.01, 0.07);
    src.start(t, Math.random()); src.stop(t + 0.15);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const og = ctx.createGain(); o.connect(og).connect(this.bus());
    this.env(og, t, 0.002, clamp(0.2 + strength * 0.35, 0.1, 0.7), 0.01, 0.12);
    o.start(t); o.stop(t + 0.2);
  }
  // lub-dub, when you're nearly out
  heartbeat(k = 0.7) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [dt, f] of [[0, 62], [0.16, 54]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(34, t + dt + 0.12);
      o.connect(g).connect(this.bus()); this.env(g, t + dt, 0.004, 0.25 + k * 0.35, 0.02, 0.12);
      o.start(t + dt); o.stop(t + dt + 0.2);
    }
  }
  // a swing through the air
  whoosh(strength = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
    const g = ctx.createGain();
    src.connect(bp).connect(g).connect(this.bus());
    this.env(g, t, 0.03, 0.08 * strength, 0.04, 0.08);
    src.start(t, Math.random()); src.stop(t + 0.25);
  }
  thud(strength, pan = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180 + strength * 400;
    const g = ctx.createGain();
    src.connect(lp).connect(g).connect(this.bus());
    this.env(g, t, 0.005, clamp(strength * 0.35, 0.05, 0.9), 0.02, 0.25);
    src.start(t, Math.random()); src.stop(t + 0.4);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    const og = ctx.createGain(); o.connect(og).connect(this.bus());
    this.env(og, t, 0.005, clamp(strength * 0.3, 0.05, 0.6), 0.02, 0.2);
    o.start(t); o.stop(t + 0.3);
  }
  // the vehicles around you, each heard where it is: the ten nearest get an engine voice (a scooter's buzz, an
  // auto's putter, a car's hum, a bus's diesel), pitched by its speed, moving with it, fading as it goes
  engines(list, lx, lz) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.teng) {
      this.teng = [];
      // three voices, one oscillator each: the ambient loop carries the rest of the traffic
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 0.9;
        const g = ctx.createGain(); g.gain.value = 0;
        const pn = this.panner({ x: 0, y: 0.8, z: 0 }, 5);
        o.connect(lp); lp.connect(g); g.connect(pn).connect(this.bus('traffic'));
        o.start();
        this.teng.push({ o, lp, g, pn, v: null, f: 0, on: true });
      }
    }
    const near = [];
    for (const v of list) { const q = (v.x - lx) ** 2 + (v.z - lz) ** 2; if (q > 2500) continue; near.push([q, v]); }
    near.sort((a, b) => a[0] - b[0]);
    this.teng.forEach((E, i) => {
      const v = near[i] && near[i][1];
      if (!v) { if (E.on) { E.on = false; E.g.gain.setTargetAtTime(0, t, 0.2); } return; }
      E.on = true;
      const ty = v.type || '', sp = Math.abs(v.v || 0);
      const base = /^(scooter|bike)/.test(ty) ? 55 : /^auto/.test(ty) ? 30 : /bus|tempo/.test(ty) ? 24 : 34;
      const f = base * (1 + sp / (/^(scooter|bike)/.test(ty) ? 9 : 14));
      if (Math.abs(f - E.f) > 1) { E.f = f; E.o.frequency.setTargetAtTime(f, t, 0.1); }
      if (E.v !== v) { E.v = v; E.lp.frequency.setTargetAtTime(/bus|tempo/.test(ty) ? 380 : /^(scooter|bike)/.test(ty) ? 1000 : 650, t, 0.2); }
      E.g.gain.setTargetAtTime((/bus|tempo/.test(ty) ? 0.16 : 0.1) * (0.4 + Math.min(1, sp / 10) * 0.6), t, 0.15);
      if (E.pn.positionX) { E.pn.positionX.setTargetAtTime(v.x, t, 0.08); E.pn.positionZ.setTargetAtTime(v.z, t, 0.08); } else E.pn.setPosition(v.x, 0.8, v.z);
    });
  }
  // a small bird in a tree near you: a few quick rising trills (bulbuls, sparrows, the koel in summer)
  chirp() {
    if (!this.ctx || !this.lis) return;
    const a = Math.random() * 6.283, r = 10 + Math.random() * 35, koel = Math.random() < 0.15;
    this.at(this.lis.x + Math.cos(a) * r, this.lis.z + Math.sin(a) * r, () => {
      const ctx = this.ctx, t0 = ctx.currentTime, n = koel ? 3 : 2 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        const t = t0 + k * (koel ? 0.45 : 0.11 + Math.random() * 0.05), o = ctx.createOscillator(), g = ctx.createGain();
        const f0 = koel ? 700 + k * 120 : 2800 + Math.random() * 1600;
        o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (koel ? 1.5 : 1.25), t + (koel ? 0.3 : 0.07));
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(koel ? 0.09 : 0.05, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t + (koel ? 0.38 : 0.09));
        o.connect(g); this.out3(g, 0, this.bus('world')); o.start(t); o.stop(t + 0.42);
      }
    }, 7);
  }
  // a cat purring: a low rumble, pulsing
  purr() {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 26; lp.type = 'lowpass'; lp.frequency.value = 180;
      lfo.frequency.value = 2.2; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08, t + 0.3); g.gain.linearRampToValueAtTime(0.08, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 2.8);
      o.connect(lp); lp.connect(g); g.connect(this.master || ctx.destination); o.start(t); lfo.start(t); o.stop(t + 2.9); lfo.stop(t + 2.9);
    } catch (e) { /* silent */ }
  }
  // rain on the roofs and the road: filtered noise, louder with the rain
  rain(level) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.rainN) {
      if (level < 0.03) return;
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.value = 0;
      n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.master || ctx.destination); n.start();
      this.rainN = { n, g };
    }
    this.rainN.g.gain.setTargetAtTime(Math.min(0.35, level * 0.32), ctx.currentTime, 0.5);
  }
  // thunder: a crack close, a long low roll far off
  thunder(near = 0.5) {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime, len = ctx.sampleRate * 5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let v = 0; for (let i = 0; i < len; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.15; const k = i / len; d[i] = v * (k < 0.02 ? k / 0.02 : Math.pow(1 - k, 1.6)) * (1 + 0.6 * Math.sin(k * 40)); }
      const n = ctx.createBufferSource(); n.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300 + near * 900;
      const g = ctx.createGain(); g.gain.value = 0.6 + near * 1.4;
      n.connect(lp); lp.connect(g); g.connect(this.master || ctx.destination); n.start(t); n.stop(t + 5);
    } catch (e) { /* silent */ }
  }
  // a blast: a deep thump, a roar of filtered noise rolling off, debris rattling down
  boom() {
    if (!this.ctx) return;
    try {
      const ctx = this.ctx, t = ctx.currentTime, out = this.sfx || this.master || ctx.destination;
      const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) { const k = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.2); }
      const n = ctx.createBufferSource(); n.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(140, t + 2.6);
      const g = ctx.createGain(); g.gain.setValueAtTime(1.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 3);
      n.connect(lp); lp.connect(g); g.connect(out); n.start(t); n.stop(t + 3);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.8);
      const og = ctx.createGain(); og.gain.setValueAtTime(1.2, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1);
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 1.1);
    } catch (e) { /* silent */ }
  }
  crash(strength) { this.thud(strength); this.tone('square', [180 + Math.random() * 120, 260], 0.1, 0.06 * strength, 0, 0.02); }
  crow() {
    if (!this.ctx) return;
    // from a tree somewhere around you, up high (not just a random ear)
    if (this.lis && !this._at && !this._crowing) { const a = Math.random() * 6.283, r = 15 + Math.random() * 30; this._crowing = true; try { return this.at(this.lis.x + Math.cos(a) * r, this.lis.z + Math.sin(a) * r, () => this.crow(), 9); } finally { this._crowing = false; } }
    if (this.buf.crow) { this.play('crow', { vol: 0.1 + Math.random() * 0.1, pan: Math.random() * 1.6 - 0.8, offset: Math.random() * 2.6, dur: 0.8 + Math.random() * 1.2, rate: 0.95 + Math.random() * 0.1 }); return; }
    const ctx = this.ctx, t = ctx.currentTime;
    const n = 1 + Math.floor(Math.random() * 3);
    const pan = Math.random() * 1.6 - 0.8;
    for (let k = 0; k < n; k++) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const st = t + k * 0.42;
      o.frequency.setValueAtTime(620, st); o.frequency.linearRampToValueAtTime(480, st + 0.28);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2.5;
      const g = ctx.createGain();
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.connect(bp).connect(g);
      if (p) { p.pan.value = pan; g.connect(p).connect(this.bus('world')); } else g.connect(this.bus('world'));
      this.env(g, st, 0.02, 0.05, 0.12, 0.14);
      o.start(st); o.stop(st + 0.35);
    }
  }
  bark(vol = 0.3, pan = Math.random() * 1.6 - 0.8) {
    if (!this.ctx) return;
    if (this.buf.dog_bark) { this.play(Math.random() < 0.5 ? 'dog_bark' : 'dog_bark2', { vol: vol * 0.8, pan, rate: 0.9 + Math.random() * 0.25 }); return; }
    const ctx = this.ctx, t = ctx.currentTime;
    for (let k = 0; k < 2; k++) {
      const st = t + k * 0.3;
      const o = ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(420, st); o.frequency.exponentialRampToValueAtTime(260, st + 0.12);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain();
      o.connect(lp).connect(g).connect(this.bus('world'));
      this.env(g, st, 0.01, vol * 0.2, 0.04, 0.08);
      o.start(st); o.stop(st + 0.2);
    }
  }
  moo(vol = 0.3, pan = 0) { this.play('cow_moo', { vol, pan, rate: 0.95 + Math.random() * 0.1 }); }
  bells(vol = 0.25, pan = 0) { this.play('temple_bells', { vol, pan }); }
  ignition() { this.play('auto_start', { vol: 0.5 }); }
  chime() { this.tone('sine', [880], 0.18, 0.18, 0, 0); this.tone('sine', [1318], 0.3, 0.16, 0, 0.16); }
  cash() { [1046, 1318, 1568, 2093].forEach((f, i) => this.tone('triangle', [f], 0.09, 0.12, 0, i * 0.06)); }
  fine() { this.tone('sawtooth', [220], 0.25, 0.15, 0, 0); this.tone('sawtooth', [165], 0.4, 0.15, 0, 0.22); }
  // traffic police whistle: a pea whistle's warble around 3 kHz, two short blasts
  whistle() {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (const [d, len] of [[0, 0.22], [0.32, 0.5]]) {
      const t = t0 + d;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 3050;
      const trill = ctx.createOscillator(); trill.frequency.value = 38; const tg = ctx.createGain(); tg.gain.value = 140;
      trill.connect(tg).connect(o.frequency);
      const am = ctx.createGain(); am.gain.value = 0.7;
      const amo = ctx.createOscillator(); amo.frequency.value = 38; const amg = ctx.createGain(); amg.gain.value = 0.3; amo.connect(amg).connect(am.gain);
      const g = ctx.createGain();
      o.connect(am).connect(g).connect(this.bus());
      this.env(g, t, 0.015, 0.13, len, 0.05);
      for (const n of [o, trill, amo]) { n.start(t); n.stop(t + len + 0.1); }
    }
  }
  blip() { this.tone('sine', [660], 0.06, 0.08); }
}
