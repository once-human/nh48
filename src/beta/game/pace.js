// game/pace.js for /beta: an even beat. A screen puts up a new picture only on its own tick (sixty times a second, say).
// A game that takes a little over one tick for some frames and a little under for others has one picture up for one
// tick and the next for two, over and over: forty-five frames a second on the counter and judder to the eye, worst
// when you turn or drive. Here every picture stays up for the same number of ticks, as few as this PC keeps to (one,
// two, three): found by watching how often a frame comes late, and tried one quicker again once things have been
// calm a while (less and less often when the try fails). A freeze (a street arriving) is a hitch, not the pace:
// it isn't counted.
export class Pace {
  constructor() {
    this.on = true; this.r = 1000/60; this.n = 1; this.lo = 1;
    this.raf = 0; this.shown = 0; this.d = []; this.big = 0; this.since = 0; this.was = false;
    this.w = 0; this.late = 0; this.over = 0; this.calm = 0; this.need = 2; this.trial = 0; this.failWork = 0;
  }
  // is this tick of the screen one to draw on? cap: the most frames a second you asked for (0: no limit), work: the
  // milliseconds this PC is spending on a frame, live: you're playing (a menu's frames say nothing about the game's)
  tick(now, cap, work, live) {
    const d = now - this.raf; this.raf = now;
    // the screen's own beat: the short end of the gaps between its ticks lately. A shorter one is believed at once.
    // A longer one that is two or three of the old beat is this PC being busy, not a different screen, and is never
    // believed (holding to "every second tick" of a beat half as long is the same thing anyway); any other longer
    // one is believed when it has been there six times running (the window was moved to another screen)
    if (d > 2 && d < 60) {
      const D = this.d; D.push(d);
      if (D.length >= 40) {
        D.sort((a, b) => a - b); const p = D[4]; D.length = 0;
        const m = p/this.r, whole = Math.abs(m - Math.round(m)) < .12 && m > 1.5;
        if (p < this.r*1.08) { this.r = p < this.r*.92 ? p : this.r + (p - this.r)*.3; this.big = 0; }
        else if (whole) this.big = 0;
        else if (++this.big >= 6) { this.r = p; this.big = 0; }
      }
    }
    const r = this.r, lo = this.lo = cap > 0 ? Math.max(1, Math.round(1000/cap/r)) : 1, hi = Math.max(lo, Math.round(50/r));
    // (the first seconds of play, and the first after any menu, are streets arriving and things being made for the
    // first time: nothing is learnt from those, and nothing is held back in them)
    if (live && !this.was) this.since = now; this.was = live;
    const warm = live && now - this.since < 8000;
    if (!this.on || warm) { this.n = lo; this.trial = 0; this.over = 0; this.calm = 0; }
    if (this.n < lo) this.n = lo; if (this.n > hi) this.n = hi;
    if (now - this.shown < (this.n - .5)*r) return false;
    const iv = now - this.shown; this.shown = now;
    if (!this.on || !live || warm) { this.w = this.late = 0; return true; }
    // late by one tick is the habit this is here to cure (one picture up for a tick, the next for two). Late by more
    // than that is a hitch, a street arriving: a PC that hitches is not helped by having every frame held back too
    if (iv > (this.n + .5)*r && iv < (this.n + 1.6)*r) this.late++;
    if (++this.w < 50) return true;
    const f = this.late/this.w, secs = this.w*this.n*r/1000; this.w = this.late = 0;
    if (this.trial) {
      // one quicker was tried: kept if it held, back (and a longer wait before the next try) if it didn't
      if (f > .2) { this.n = Math.min(hi, this.trial); this.need = Math.min(30, this.need*2); this.failWork = work; } else this.need = 2;
      this.trial = 0; this.calm = 0; this.over = 0; return true;
    }
    // (a quarter of them late, three times running, is this PC not keeping to it)
    if (f > .25) { this.calm = 0; if (++this.over >= 3 && this.n < hi) { this.n++; this.over = 0; } return true; }
    this.over = 0; this.calm = f <= .08 ? this.calm + secs : 0;
    if (this.failWork && work < this.failWork*.8) { this.need = 2; this.failWork = 0; }       // (there's less to draw than when it last failed)
    if (this.n > lo && this.calm >= this.need && work*1.1 < (this.n - 1)*r) { this.trial = this.n; this.n--; this.calm = 0; }
    return true;
  }
}
