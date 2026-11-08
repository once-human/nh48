// A voice belongs to the person saying it, where they are. It was set going at a point in the street and carried on at nearly
// the same level however far you'd gone; now it falls away with the distance while it plays and stops altogether if you've
// left them behind, the way it does when you drive past someone talking. And whoever's knocked down or killed stops talking,
// on the word they'd got to, with the catch in it.
import { Police } from '@orig/game/police.js';
import { Audio } from '@orig/game/audio.js';

// How far a voice carries. A person talking isn't a loudspeaker: full at arm's length, half as loud a couple of metres
// further, a murmur across the road, gone by the next junction (it carried like a PA, so people forty metres off were
// still in your ear). The air takes the top off it as it goes, so a far voice is far, not just quiet; and from inside a
// car with the glass up, everyone outside is muffled through it. Where they are, left or right, in front or behind,
// is the listener's (the camera's) own, every frame.
const pan0 = Audio.prototype.panner;
Audio.prototype.panner = function (pos, ref = 6) {
  const pn = pan0.call(this, pos, ref);
  if (this._hrtf) { pn.refDistance = 2.2; pn.rolloffFactor = 1.5; }
  this._pn = pn; return pn;
};
const shut = (P) => { const V = P && !P.onFoot && P.cur; return !!(V && V.spec && !V.spec.two && !/^auto|^cycle|^bus|^tempo/.test(V.type || '')); };
const voice0 = Audio.prototype.voice;
Audio.prototype.voice = function (id, vol = 1, pan = 0, radio = false, pri = 1, lp = 0) {
  const at = this._at, G = window.__nhAskG, P = G && G.player;
  let inCar = false;
  if (at && !radio) {
    const L = this.lis || at, d = Math.hypot(at.x - L.x, at.z - L.z);
    const air = d > 3 ? Math.max(650, 13000*Math.pow(3/d, 1.25)) : 0;
    if (air) lp = lp ? Math.min(lp, air) : air;
    inCar = shut(P);
    if (inCar) lp = lp ? Math.min(lp, 900) : 900;
  }
  const was = this.curVoice, r = voice0.call(this, id, vol, pan, radio, pri, lp), v = this.curVoice;
  if (v && v !== was && at) { v.at = { x: at.x, z: at.z }; if (inCar) { try { v.g.gain.value *= 0.5; } catch (e) { /* as it was */ } } }
  return r;
};

const NEAR = 12, FAR = 52;
const say = Police.prototype.say;
Police.prototype.say = function (id, who, ...rest) {
  const A = this.g && this.g.audio, was = A && A.curVoice, r = say.call(this, id, who, ...rest), src = who && (who.ped || who.veh || who);
  if (A && A.curVoice && A.curVoice !== was && src && src.x !== undefined && !src.pax) { const v = A.curVoice; v.who = src; v.base = v.g.gain.value; v.k = 1; }
  return r;
};
export function tickVoice(G) {
  const A = G.audio, v = A && A.curVoice, c = A && A.ctx;
  if (!v || !v.who || !c || v.done) return;
  const now = c.currentTime; if (now >= A.voiceEnd) return;
  const p = v.who, P = G.player, stop = (fade) => { v.done = true; try { v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, fade); v.src.stop(now + fade*5); } catch (e) { /* already stopped */ } A.voiceEnd = now + fade*3; };
  // cut off where they stand: the pitch catches, and nothing after it
  if (p._hit || p.corpse || p.dead || p.fallen > 1.6 || p.ko) { try { v.src.playbackRate.setTargetAtTime(0.72, now, 0.03); } catch (e) { /* the clip's own */ } stop(0.035); G.hud?.clearSay?.(); return; }
  const d = Math.hypot(p.x - P.x, p.z - P.z), t = Math.max(0, Math.min(1, (d - NEAR)/(FAR - NEAR))), k = (1 - t)*(1 - t);
  if (d >= FAR) { stop(0.08); return; }
  if (Math.abs(k - v.k) > 0.01) { v.k = k; v.g.gain.setTargetAtTime((v.base ?? 1)*k, now, 0.06); }
}
