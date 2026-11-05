// A vehicle you've got out of goes on smoking, and goes on burning: the fire keeps eating it and it goes up, whether
// you're in it or have run. (The smoke, the spreading fire and the blast were only worked out for the one you sat in:
// get out of a smoking car and it stopped smoking, a burning one went out.)
import { Game } from '@orig/game/game.js';

const wear = Game.prototype.vehicleWear;
Game.prototype.vehicleWear = function (dt) {
  wear.call(this, dt);
  const P = this.player; if (!P || !P.dropped) return;
  for (const d of P.dropped) {
    const v = d.veh;
    if (!v || v === P.cur && !P.onFoot || v.dead || !((v.dmg || 0) >= 0.45)) continue;
    if (v.dmg >= 0.95) v.dmg = Math.min(1, v.dmg + dt*0.006);           // burning: the fire spreads, ~8 s
    if (v.dmg >= 1) { this.explode(v); continue; }
    this.paintDamage(v);
    this.smokeFrom(v, dt);
  }
};
