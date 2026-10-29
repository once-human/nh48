// What a neighbourhood remembers about you. Pune is a big city of small places: hit someone outside a tapri in
// Sadashiv Peth and the lane knows by evening. Every ~400 m cell keeps a tally of the bad (a beating, a death,
// a theft, a blast) and the good (a fare driven well, the street dogs you pet), saved with your game and fading
// over a few days. People there act on it: they stare, mutter, cross away, call the cops; or nod, wave, greet you.
const CELL = 400, FADE = 0.7;           // per day
export class Rep {
  constructor(G) { this.g = G; }
  get store() { const L = this.g.life; if (!L || !L.s) return (this._tmp = this._tmp || {}); return (L.s.rep = L.s.rep || {}); }
  day() { return Math.floor((this.g.clock || 0) / 24); }
  key(x, z) { return Math.floor(x / CELL) + ',' + Math.floor(z / CELL); }
  cell(k) { const S = this.store, d = this.day(); let c = S[k]; if (!c) return null; if (c.d !== d) { const f = Math.pow(FADE, Math.max(0, d - c.d)); c.b *= f; c.g *= f; c.d = d; if (c.b < 0.05 && c.g < 0.05) { delete S[k]; return null; } } return c; }
  add(x, z, bad, good) {
    if (this.g.free) return;                       // free roam is free: nobody keeps score
    const S = this.store, d = this.day(), i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const w = i === i0 && j === j0 ? 1 : 0.35, k = i + ',' + j;
      const c = this.cell(k) || (S[k] = { b: 0, g: 0, d });
      c.b = Math.min(30, c.b + bad * w); c.g = Math.min(30, c.g + good * w);
    }
  }
  bad(x, z, n) { this.add(x, z, n, 0); }
  good(x, z, n) { this.add(x, z, 0, n); }
  at(x, z) { const c = this.cell(this.key(x, z)); return c ? { bad: c.b, good: c.g } : { bad: 0, good: 0 }; }
}
