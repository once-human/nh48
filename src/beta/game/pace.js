// game/pace.js for /beta: an even beat. A screen puts up a new picture only on its own tick (sixty times a second, say).
// A game that takes a little over one tick for some frames and a little under for others has one picture up for one
// tick and the next for two, over and over: forty-five frames a second on the counter and judder to the eye, worst
// when you turn or drive. Here every picture stays up for the same number of ticks, as few as this PC keeps to (one,
// two, three): found by watching how often a frame comes late, and tried one quicker again once things have been
// calm a while (less and less often when the try fails). A freeze (a street arriving) is a hitch, not the pace:
// it isn't counted.
export class Pace {
  constructor() {
    this.on = false; this.r = 1000/60; this.n = 1; this.lo = 1;
    this.raf = 0; this.shown = 0; this.d = []; this.big = 0;
    this.w = 0; this.late = 0; this.over = 0; this.calm = 0; this.need = 4; this.trial = 0; this.failWork = 0;
  }
  // is this tick of the screen one to draw on? cap: the most frames a second you asked for (0: no limit), work: the
  // milliseconds this PC is spending on a frame, live: you're playing (a menu's frames say nothing about the game's)
  tick(now, cap, work, live) {
    const d = now - this.raf; this.raf = now;
    // the screen's own beat: the short end of the gaps between its ticks lately (a shorter one is believed at once,
    // a longer one only when it's still there the next time: a heavy scene makes every gap two ticks long)
    if (d > 2 && d < 60) {
      const D = this.d; D.push(d);
      if (D.length >= 40) {
        D.sort((a, b) => a - b); const p = D[4]; D.length = 0;
        if (p < this.r*1.08) { this.r = p < this.r*.92 ? p : this.r + (p - this.r)*.3; this.big = 0; }
        else if (++this.big >= 2) { this.r = p; this.big = 0; }
      }
    }
    const r = this.r, lo = this.lo = cap > 0 ? Math.max(1, Math.round(1000/cap/r)) : 1, hi = Math.max(lo, Math.round(50/r));
    if (!this.on) { this.n = lo; this.trial = 0; }
    if (this.n < lo) this.n = lo; if (this.n > hi) this.n = hi;
    if (now - this.shown < (this.n - .5)*r) return false;
    const iv = now - this.shown; this.shown = now;
    if (!this.on || !live) { this.w = this.late = 0; return true; }
    if (iv > (this.n + .5)*r && iv < 250) this.late++;
    if (++this.w < 50) return true;
    const f = this.late/this.w, secs = this.w*this.n*r/1000; this.w = this.late = 0;
    if (this.trial) {
      // one quicker was tried: kept if it held, back (and a longer wait before the next try) if it didn't
      if (f > .1) { this.n = Math.min(hi, this.trial); this.need = Math.min(180, this.need*2); this.failWork = work; } else this.need = 4;
      this.trial = 0; this.calm = 0; this.over = 0; return true;
    }
    // (a quarter of them late, twice running, is this PC not keeping to it. Fewer than that are hitches: slowing every
    // frame down for those would only make the game slower)
    if (f > .25) { this.calm = 0; if (++this.over >= 2 && this.n < hi) { this.n++; this.over = 0; } return true; }
    this.over = 0; this.calm = f <= .05 ? this.calm + secs : 0;
    if (this.failWork && work < this.failWork*.75) { this.need = 4; this.failWork = 0; }       // (there's less to draw than when it last failed)
    if (this.n > lo && this.calm >= this.need && work*1.1 < (this.n - 1)*r) { this.trial = this.n; this.n--; this.calm = 0; }
    return true;
  }
}
