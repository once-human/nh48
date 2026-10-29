// How busy a spot in Pune is at a given hour, from the real places around it (tools/bake_street.py
// counts them on a 50 m grid by what they draw people for). The hourly curves follow how the city
// actually runs: offices 9:30 to 7, colleges from 7:30, peth shops shut for the afternoon
// (roughly 1:30 to 4), restaurants busiest after 8 pm, bars and lounges full from 9 pm until last
// orders at 1:30 am, temples at dawn and dusk, park walkers early morning and evening.
const H = (a) => Float32Array.from(a);
export const PROFILE = {
  night:   H([0.85, 0.75, 0.3, 0.08, 0.02, 0, 0, 0, 0, 0, 0, 0, 0.05, 0.1, 0.08, 0.05, 0.05, 0.1, 0.22, 0.4, 0.65, 0.92, 1, 1]),
  food:    H([0.3, 0.12, 0.05, 0.02, 0.02, 0.03, 0.1, 0.3, 0.55, 0.5, 0.35, 0.4, 0.75, 0.85, 0.6, 0.4, 0.45, 0.65, 0.85, 0.95, 1, 0.95, 0.75, 0.5]),
  retail:  H([0.02, 0, 0, 0, 0, 0, 0.02, 0.08, 0.2, 0.4, 0.65, 0.8, 0.85, 0.7, 0.6, 0.65, 0.8, 0.92, 1, 1, 0.9, 0.6, 0.25, 0.06]),
  office:  H([0, 0, 0, 0, 0, 0, 0.05, 0.2, 0.55, 0.9, 1, 1, 0.9, 1, 0.95, 0.9, 0.85, 0.8, 0.65, 0.35, 0.15, 0.05, 0.02, 0]),
  edu:     H([0, 0, 0, 0, 0, 0, 0.1, 0.6, 1, 0.9, 0.75, 0.7, 0.85, 0.9, 0.7, 0.6, 0.7, 0.8, 0.55, 0.35, 0.18, 0.06, 0.02, 0]),
  worship: H([0, 0, 0, 0, 0.05, 0.3, 0.7, 0.8, 0.5, 0.35, 0.3, 0.25, 0.2, 0.15, 0.15, 0.2, 0.3, 0.5, 0.85, 1, 0.7, 0.3, 0.05, 0]),
  leisure: H([0.02, 0, 0, 0, 0.02, 0.25, 0.8, 0.8, 0.5, 0.35, 0.35, 0.4, 0.4, 0.35, 0.35, 0.45, 0.6, 0.85, 1, 0.95, 0.7, 0.4, 0.15, 0.05]),
  health:  H([0.2, 0.15, 0.15, 0.15, 0.15, 0.2, 0.3, 0.5, 0.8, 1, 1, 1, 0.9, 0.8, 0.8, 0.85, 0.9, 0.95, 0.9, 0.75, 0.55, 0.4, 0.3, 0.25]),
  transit: H([0.35, 0.25, 0.2, 0.25, 0.4, 0.6, 0.8, 0.9, 1, 0.9, 0.75, 0.7, 0.7, 0.65, 0.65, 0.7, 0.8, 0.95, 1, 0.95, 0.8, 0.65, 0.55, 0.45]),
  // everyone else: out in the morning and in the evening, home by midnight
  resid:   H([0.1, 0.06, 0.03, 0.02, 0.03, 0.12, 0.4, 0.7, 0.8, 0.6, 0.45, 0.4, 0.4, 0.35, 0.35, 0.4, 0.55, 0.75, 0.9, 0.95, 0.8, 0.55, 0.32, 0.17]),
};
// people on the street per real place of each kind (a bar spills onto the pavement; an office mostly keeps its people inside)
const WEIGHT = { night: 10, food: 2.0, retail: 0.8, office: 0.45, edu: 1.2, worship: 1.0, leisure: 1.0, health: 0.6, transit: 2.5 };
// vehicles on the road, all of Pune, by hour: morning and evening peaks, quiet from 1 to 5 am
// Pune's day: the office rush 8:30 to 10:30 and 5:30 to 8, a lull through the afternoon (lunch, the 1 to 4 nap), empty late
export const TRAFFIC = H([0.2, 0.14, 0.1, 0.09, 0.11, 0.22, 0.42, 0.72, 0.95, 1, 0.9, 0.72, 0.6, 0.5, 0.44, 0.5, 0.66, 0.9, 1, 1, 0.86, 0.64, 0.44, 0.3]);
const PETH_SHUT = H([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.6, 0.35, 0.4, 0.85, 1, 1, 1, 1, 1, 1, 1]);

export function curve(arr, hour) {
  const h = ((hour % 24) + 24) % 24, i = Math.floor(h), f = h - i;
  return arr[i] * (1 - f) + arr[(i + 1) % 24] * f;
}

export class Activity {
  constructor(M) {
    const A = M.activity || { cell: 50, cls: [], cells: [] };
    this.cell = A.cell; this.cls = A.cls;
    this.w = Float32Array.from(this.cls.map(c => WEIGHT[c] || 1));
    this.map = new Map();
    // peths keep the old afternoon closing for their shops
    this.peths = (M.areas || []).filter(a => /Peth\b/.test(a[0])).map(a => [a[2] / 100, a[3] / 100]);
    this.addCells(A.cells || [], 0);
    this.ri = this.cls.indexOf('retail'); this.ni = this.cls.indexOf('night');
    this._h = -1; this._p = new Float32Array(this.cls.length);
  }
  // a tile's cells come and go with the tile
  addCells(cells, tag) {
    for (const r of cells) {
      const x = (r[0] + 0.5) * this.cell, z = (r[1] + 0.5) * this.cell;
      let peth = false;
      for (const [px, pz] of this.peths) if ((px - x) ** 2 + (pz - z) ** 2 < 450 * 450) { peth = true; break; }
      this.map.set(r[0] + ',' + r[1], { v: Float32Array.from(r.slice(2)), peth, tag });
    }
  }
  removeTag(tag) { for (const [k, c] of this.map) if (c.tag === tag) this.map.delete(k); }
  setHour(h) {
    if (Math.abs(h - this._h) < 0.02) return;
    this._h = h;
    this.cls.forEach((c, k) => { this._p[k] = curve(PROFILE[c], h) * this.w[k]; });
    this._res = curve(PROFILE.resid, h);
    this._peth = curve(PETH_SHUT, h);
  }
  // people-per-street score at (x, z); ~2-4 on a quiet residential lane, 30+ on FC Road at 7 pm
  at(x, z, out) {
    const c = this.map.get(Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell));
    let a = 3.5 * this._res, night = 0;
    if (c) {
      for (let k = 0; k < c.v.length; k++) {
        let t = c.v[k] * this._p[k];
        if (k === this.ri && c.peth) t *= this._peth;
        a += t;
      }
      if (this.ni >= 0) night = c.v[this.ni] * this._p[this.ni];
    }
    if (out) { out.night = a > 0 ? night / a : 0; }
    return a;
  }
  // mean over a neighbourhood (radius ~ the crowd's spawn ring)
  around(x, z, r = 120) {
    let s = 0, n = 0;
    for (let dx = -r; dx <= r; dx += this.cell) for (let dz = -r; dz <= r; dz += this.cell) {
      if (dx * dx + dz * dz > r * r) continue;
      s += this.at(x + dx, z + dz); n++;
    }
    // a compact cluster (the Mills, a KP lane of cafes) should still feel packed when you're in it
    return n ? 0.5 * s / n + 0.5 * this.at(x, z) : this.at(x, z);
  }
}
