// A voice belongs to the person saying it, where they are. It was set going at a point in the street and carried on at nearly
// the same level however far you'd gone; now it falls away with the distance while it plays and stops altogether if you've
// left them behind, the way it does when you drive past someone talking. And whoever's knocked down or killed stops talking,
// on the word they'd got to, with the catch in it.
import { Police } from '@orig/game/police.js';

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
