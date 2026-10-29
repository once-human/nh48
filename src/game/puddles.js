// Monsoon on the road: the puddles the road shader draws (gfx/pbr.js: the same noise, worked out here in the GPU's
// own 32-bit arithmetic so a splash happens exactly where you see the water) throw spray off your wheels and feet,
// with the slap of water; in a real downpour the deepest of them are waterlogged dips that drag at you.
// Only ever checked under you, a few times a second: nothing here costs anything when it's dry.
const f = Math.fround;
const fract = (x) => f(x - Math.floor(x));
function hash(x, y) {
  let px = fract(f(x * f(123.34))), py = fract(f(y * f(456.21)));
  const d = f(f(px * f(px + f(45.32))) + f(py * f(py + f(45.32))));
  px = f(px + d); py = f(py + d);
  return fract(f(px * py));
}
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = f(x - ix), fy = f(y - iy);
  fx = f(fx * fx * (3 - 2 * fx)); fy = f(fy * fy * (3 - 2 * fy));
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// how deep the water is at (x, z): 0 none .. 1 a proper puddle (times how wet it is)
export function puddleAt(x, z, wet) { return wet * ss(0.56, 0.74, noise(f(x * 0.16), f(z * 0.16))); }

export class Puddles {
  constructor(G) { this.g = G; this.t = 0; this.inside = false; this.told = false; }
  update(dt) {
    const G = this.g, Wt = G.weather, wet = Wt ? Wt.wet || 0 : 0;
    if (wet < 0.25 || G.state !== 'play' || (G.interiors && G.interiors.inside)) { this.inside = false; return; }
    if ((this.t -= dt) > 0) return;
    this.t = 0.09;
    const P = G.player, foot = P.onFoot, x = foot ? P.foot.x : P.x, z = foot ? P.foot.z : P.z;
    const v = Math.abs(foot ? P.foot.v || 0 : P.v || 0);
    if (P.foot && P.foot.air) return;
    const W = G.W;
    if (!foot && !W.surf.isRoad(x, z)) { this.inside = false; return; }
    const d = puddleAt(x, z, wet);
    if (d < 0.22) { this.inside = false; return; }
    const th = foot ? P.foot.yaw : P.th, hx = Math.cos(th), hz = Math.sin(th), y = (foot ? P.foot.y : P.y) || W.surf.height(x, z);
    // the slap as you hit it, harder the faster
    if (!this.inside && v > 1) G.audio.splash?.(Math.min(1, 0.2 + v / 18) * (foot ? 0.5 : 1));
    this.inside = true;
    if (v > 1.5 && G.smoke) {
      const n = foot ? 1 : Math.min(5, 1 + Math.floor(v / 5)), w = foot ? 0.15 : (P.spec && P.spec.W ? P.spec.W / 2 + 0.1 : 0.7);
      for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1; G.smoke.emit(x - hz * w * s + hx * (foot ? 0 : 0.8), y + 0.15, z + hx * w * s + hz * (foot ? 0 : 0.8), 'spray', 0.3, v); }
    }
    // a real downpour: the deepest of them are waterlogged dips, the water drags at you
    if (!foot && wet > 0.7 && d > 0.62 && v > 3) {
      P.v *= 1 - 0.03 * (P.spec && P.spec.two ? 1.5 : 1);
      if (!this.told) { this.told = true; G.hud.toast('Waterlogged', 'Knee-deep in the dips when it pours like this. Ease off', 'info', 3); }
    }
  }
}
