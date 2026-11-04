// Small things the game's builders lose. A prop merged into a chunk with a plain white tint keeps its own colours (the
// stalls were coming out pure white: the builder only reads shapes from a prop, never its colours).
import { ColorBuilder } from '@orig/world/geo.js';

const add = ColorBuilder.prototype.addGeo;
ColorBuilder.prototype.addGeo = function (geo, m, color, glow = 0, paint = 0) {
  const C = geo.attributes.color;
  if (!C || !color || color[0] !== 1 || color[1] !== 1 || color[2] !== 1) return add.call(this, geo, m, color, glow, paint);
  const n0 = this.c, G = geo.attributes.glow;
  add.call(this, geo, m, color, glow, paint);
  for (let k = 0, j = n0; j < this.c; k++, j++) {
    this.col[j*3] = C.getX(k); this.col[j*3 + 1] = C.getY(k); this.col[j*3 + 2] = C.getZ(k);       // (already linear: they came out of a builder)
    if (G) this.g[j] = G.getX(k);
  }
};
