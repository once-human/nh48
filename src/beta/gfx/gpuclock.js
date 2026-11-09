// The stopwatch. performance.now() only sees the game asking for work; these see how long the graphics card itself
// spends on each part of the frame. One frame in four is timed, and the answer comes back a few frames late.
const EVERY = 4;

export class GpuClock {
  constructor(gl) { this.gl = gl; this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); this.live = []; this.spare = []; this.open = null; this.on = false; this.n = 0; this.ms = {}; this.total = 0; this.cur = null; this.curN = 0; }
  frame() { this.poll(); this.on = !!this.ext && ++this.n%EVERY === 0 && this.live.length < 48; }
  lap(name) {
    this.stop(); if (!this.on) return;
    const q = this.spare.pop() || this.gl.createQuery(); this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q); this.open = { name, q, n: this.n };
  }
  stop() { if (!this.open) return; this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.live.push(this.open); this.open = null; }
  commit() {
    if (!this.cur) return; const M = this.ms, C = this.cur; let t = 0;
    for (const k in C) if (!(k in M)) M[k] = C[k];
    for (const k in M) { M[k] += ((C[k] || 0) - M[k])*.2; t += M[k]; }
    this.total = t; this.cur = null;
  }
  poll() {
    if (!this.ext) return; const gl = this.gl, L = this.live;
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) { for (const e of L) this.spare.push(e.q); L.length = 0; this.cur = null; return; }
    let i = 0;
    for (; i < L.length; i++) {
      const e = L[i]; if (!gl.getQueryParameter(e.q, gl.QUERY_RESULT_AVAILABLE)) break;
      if (e.n !== this.curN) { this.commit(); this.curN = e.n; }
      (this.cur || (this.cur = {}))[e.name] = (this.cur[e.name] || 0) + gl.getQueryParameter(e.q, gl.QUERY_RESULT)/1e6; this.spare.push(e.q);
    }
    if (i) L.splice(0, i);
  }
  text() { if (!this.ext) return 'GPU timer not available in this browser'; const M = this.ms; return `GPU ${this.total.toFixed(1)} ms · ` + Object.keys(M).sort((a, b) => M[b] - M[a]).map(k => `${k} ${M[k].toFixed(1)}`).join(' · '); }
}

// the same for the game's own work: each system timed where it is called, read as an average per frame
export function cpuLaps(list) {
  const got = {};
  for (const [name, o, m] of list) {
    if (!o || typeof o[m] !== 'function') continue;
    const f = o[m]; got[name] = 0;
    o[m] = function (...a) { const t = performance.now(), r = f.apply(this, a); got[name] += performance.now() - t; return r; };
  }
  return { text(n) { const K = Object.keys(got).sort((a, b) => got[b] - got[a]), s = K.map(k => `${k} ${(got[k]/n).toFixed(1)}`).join(' · '); for (const k of K) got[k] = 0; return s; } };
}
