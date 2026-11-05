// The paramedics don't take someone out of your hands. While you're dragging the one they came for, they stop where
// they are, stretcher and all, and tell you to put them down; let go and they carry on. Once they've knelt to someone,
// that person is theirs: you can't take them off the stretcher (beta/game/powers.js won't let you take hold).
import { Emergency } from '@orig/game/emergency.js';

const pm = Emergency.prototype.paramedics;
Emergency.prototype.paramedics = function (R, dt) {
  const G = this.g, q = R.victim, AC = G.acts || G.wake;
  const held = q && (q._drag || (AC && AC.dragging === q));
  if (held) {
    if (!R._heldSaid && R.ph && R.ph !== 'wait') { R._heldSaid = true; G.hud.say('Paramedic', 'अहो, सोडा त्यांना! आम्हाला बघू द्या.', 'Hey, put them down! Let us see to them.', 4); }
    if (!R.ph || R.ph === 'wait') R.t = Math.min(R.t, 0.5);          // (not out of the van yet: they wait in it)
    else if (R.medics) for (const p of R.medics) { p.v = 0; if (R.ph === 'treat') p.anim = null; }
    return;
  }
  R._heldSaid = false;
  if (q && (R.ph === 'treat' || R.ph === 'lift' || R.ph === 'carry')) q._medic = true;
  return pm.call(this, R, dt);
};
