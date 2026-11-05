// A cat's meow, for petting one (the game had only its purr). Made the way a cat makes it: a voice (a buzz at the
// pitch it cries at) shaped by its mouth, which opens and closes as it goes. The pitch climbs from the "m" to the top
// of the "ee-aa" and slides down through the "ow"; the mouth's resonances (three of them, as in any voice) move from a
// closed "ee" to the open "aa" and round to the "oo"; a breath of air under it, a little waver in the pitch. Each one a
// little different: some short and questioning, some long and complaining.
import { Audio } from '@orig/game/audio.js';

Audio.prototype.meow = function (x, z) {
  if (!this.ctx) return;
  const go = () => {
    try {
      const ctx = this.ctx, t = ctx.currentTime + 0.01, R = Math.random;
      const dur = 0.45 + R()*0.45, top = 700 + R()*250, end = 380 + R()*120, ask = R() < 0.3;      // (ask: it ends going up)
      // the voice: a buzz (rich in overtones, for the mouth to shape), wavering
      const v = ctx.createOscillator(); v.type = 'sawtooth';
      const f = v.frequency;
      f.setValueAtTime(top*0.62, t);
      f.linearRampToValueAtTime(top, t + dur*0.3);
      if (ask) f.linearRampToValueAtTime(top*1.12, t + dur);
      else { f.linearRampToValueAtTime(top*0.88, t + dur*0.6); f.exponentialRampToValueAtTime(end, t + dur); }
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5 + R()*2; vg.gain.value = top*0.012; vib.connect(vg); vg.connect(f);
      // breath: noise under the voice
      const nb = ctx.createBuffer(1, Math.ceil(ctx.sampleRate*(dur + 0.1)), ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = R()*2 - 1;
      const n = ctx.createBufferSource(); n.buffer = nb; const ng = ctx.createGain(); ng.gain.value = 0.18;
      const src = ctx.createGain(); v.connect(src); n.connect(ng); ng.connect(src);
      // the mouth: three resonances moving m-ee -> aa -> ow (Hz)
      const F = [[[420, 0], [650, 0.25], [900, 0.5], [560, 1]], [[1900, 0], [2300, 0.2], [1500, 0.55], [950, 1]], [[3000, 0], [3300, 0.3], [2700, 1]]];
      const amp = [1, 0.55, 0.25];
      const mix = ctx.createGain();
      F.forEach((path, k) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = k === 0 ? 6 : 9;
        for (const [hz, at] of path) bp.frequency.linearRampToValueAtTime(hz, t + at*dur);
        const g = ctx.createGain(); g.gain.value = amp[k]; src.connect(bp); bp.connect(g); g.connect(mix);
      });
      // loudness: the "m" closed and soft, open on the vowel, fading in the "ow"
      const out = ctx.createGain(), A = out.gain, lv = 0.5;
      A.setValueAtTime(0, t); A.linearRampToValueAtTime(lv*0.25, t + 0.04); A.linearRampToValueAtTime(lv, t + dur*0.3);
      A.linearRampToValueAtTime(lv*0.7, t + dur*0.75); A.linearRampToValueAtTime(0, t + dur);
      mix.connect(out);
      if (this.out3) this.out3(out, 0, this.bus('world')); else out.connect(this.master || ctx.destination);
      v.start(t); vib.start(t); n.start(t); v.stop(t + dur + 0.05); vib.stop(t + dur + 0.05); n.stop(t + dur + 0.05);
    } catch (e) { /* silent */ }
  };
  if (x !== undefined && this.at) this.at(x, z, go, 0.3); else go();
};
