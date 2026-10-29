// What a neighbourhood remembers about you. Pune is a big city of small places: hit someone outside a tapri in
// Sadashiv Peth and the lane knows by evening. Every ~400 m cell keeps a tally of the bad (a beating, a death,
// a theft, a blast) and the good (a fare driven well, the street dogs you pet), saved with your game and fading
// over a few days. People there act on it: they stare, mutter, cross away, call the cops; or nod, wave, greet you.
const CELL = 400, FADE = 0.7;           // per day
// karma: who you are; respect: how much weight you carry; good/bad: what the neighbourhood saw
const DEEDS = {
  hurt: { karma: -4, bad: 2.5 }, kill: { karma: -20, respect: 1, bad: 6 }, blast: { karma: -8, bad: 4 }, theft: { karma: -3, respect: -0.5, bad: 2 },
  fight: { karma: -1.5, bad: 1 }, crash: { karma: -0.3, bad: 0.4 }, bribe: { karma: -2, bad: 0.4 }, fled: { karma: -1, respect: 0.5, bad: 0.5 },
  paid: { karma: 0.6, good: 0.2 }, patient: { karma: 4, respect: 2, good: 3 }, caught: { karma: 2, respect: 3, good: 3 }, gaveway: { karma: 0.3, good: 0.25 },
  pet: { karma: 0.4, good: 0.3 }, defended: { respect: 2, good: 1 }, ride: { karma: 0.2, good: 0.5 },
};
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
  // a deed: what you did, where. It moves who you are (karma), how much weight you carry (respect) and what that
  // neighbourhood remembers, and people act on all three (see standing)
  deed(kind, x, z, k = 1) {
    const D = DEEDS[kind]; if (!D || this.g.free) return;
    const L = this.g.life;
    if (L) { if (D.karma) L.change('karma', D.karma * k); if (D.respect) L.change('respect', D.respect * k); }
    this.add(x, z, (D.bad || 0) * k, (D.good || 0) * k);
    this.word(x, z);
  }
  // how people round here take you, -1 (keep away from him) .. +1 (one of ours): what they've seen here, and who
  // you are all over Pune
  standing(x, z) {
    const v = this.at(x, z), L = this.g.life && this.g.life.s;
    const local = Math.max(-1, Math.min(1, (v.good - v.bad) / 8)), glob = L ? Math.max(-1, Math.min(1, (L.karma || 0) / 60 + (L.respect || 0) / 160)) : 0;
    return Math.max(-1, Math.min(1, local * 0.65 + glob * 0.45));
  }
  // word gets round: when a neighbourhood's opinion of you crosses a line, you hear about it
  word(x, z) {
    const s = this.standing(x, z), t = s < -0.45 ? -2 : s < -0.15 ? -1 : s > 0.45 ? 2 : s > 0.15 ? 1 : 0, k = this.key(x, z);
    const T = this._tier || (this._tier = {}); if (T[k] === undefined) { T[k] = t; if (t === 0) return; }
    if (T[k] === t) return; const up = t > T[k]; T[k] = t;
    const G = this.g, area = (G.hud && G.hud.$ && G.hud.$('h-area')?.textContent) || 'round here';
    const M = { 2: ['They know you in ' + area, 'One of ours: people greet you, the stalls give you the regulars’ price, nobody calls the cops over little things'],
      1: ['Word’s getting round ' + area, 'People here are warming to you'], 0: [up ? 'People here are giving you another chance' : 'People here aren’t sure about you any more', area],
      '-1': ['Word’s out in ' + area, 'People keep an eye on you; prices go up, and they’re quicker to call the police'],
      '-2': ['Trouble, in ' + area, 'People cross the road, autos won’t stop for you, the stalls charge you double and the phones come out'] }[t];
    G.hud && G.hud.toast(M[0], M[1], up ? 'good' : 'bad', 4);
  }
  bad(x, z, n) { this.add(x, z, n, 0); }
  good(x, z, n) { this.add(x, z, 0, n); }
  at(x, z) { const c = this.cell(this.key(x, z)); return c ? { bad: c.b, good: c.g } : { bad: 0, good: 0 }; }
}
