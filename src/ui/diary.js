// The diary (J): your notebook open on a teak desk under a lamp. A spread for every chapter you've lived: on the
// left in your own hand, what happened (the messages that started it, each thing you did, ticked off, and what's
// left), the choices you made scribbled in the margin in a different pen; on the right, the photos you took
// while it was going on, printed and taped in (K takes them), and a newspaper cutting when it made the papers.
// Today's page has the objective in red at the top and a TRACK stamp. A / D (or the arrows) turn the pages.
import { paper, teak, url } from './materials2d.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ACT = { 0: ['उपोद्घात', 'Prologue'], 1: ['भाग १', 'Act 1 · Homecoming'], 2: ['भाग २', 'Act 2 · Bappa'], 3: ['भाग ३', 'Act 3 · Nine Nights'], 4: ['भाग ४', 'Act 4 · Lights'], 5: ['भाग ५', 'Act 5 · Winter'] };
// what you chose, as you'd have written it down (the chapter it belongs to, and the line)
const MARGIN = [
  ['p_home', 'paidAai', 'Gave Aai ₹3,000 for the bills. Her face.'],
  ['partner', 'kabirNum', 'Took his number. Don’t give it to anyone.'], ['partner', 'hitKabir', 'I hit him. He didn’t hit back.'],
  ['garba', 'r2', 'Danced. Three rounds, not one.'], ['mule', 'warned', 'Warned them. Every one.'], ['mule', 'bait', 'Used them as bait. Two in hospital. On me.'],
  ['deal', 'wire', 'Said yes to the wire.'], ['farmhouse', 'kabir', (v) => ({ shinde: 'Took Kabir to Shinde.', bhau: 'Left Kabir with Bhau.', left: 'Left Kabir there. Ran.' })[v]],
  ['dussehra', 'bhau', (v) => ({ debt: 'Did Bhau’s job. I owe him now.', no: 'Told Bhau no.' })[v]],
  ['server', 'wiped', 'Wiped it all. Dark.'], ['server', 'copied', 'Copied it. The pen drive’s in my sock.'],
  ['faral', 'aaiDoor', (v) => ({ stood: 'Stood at the door with Aai.', paid: 'Paid them to go.', shinde: 'Called Shinde. Sirens.', nobody: 'Called. Nobody came.' })[v]],
  ['strike', 'strike', 'Led them from the Wada to Swargate.'],
];
const CUTTING = { visarjan: ['पुणे वार्ता', 'Bappa’s truck hijacked on Anant Chaturdashi, recovered by mandal volunteers'], frontpage: ['पुणे मिरर', 'Rider network laundered crores, say documents'], strike: ['लोकमत', 'Delivery riders bring the city to a standstill'], framed: ['सकाळ', 'Accountant found dead in auto rickshaw; driver absconding'] };

export class Diary {
  constructor(G) {
    this.g = G; this.on = false; this.i = 0;
    const el = this.el = document.createElement('div'); el.className = 'dy'; el.hidden = true;
    el.innerHTML = `<div class="dy-desk"></div><div class="dy-lamp"></div><div class="dy-book"><div class="dy-page l"></div><div class="dy-page r"></div><div class="dy-spine"></div><div class="dy-flip"><div class="f"></div><div class="b"></div></div></div>
      <div class="dy-keys"><span>A / D turn the page</span><span>J or Esc close</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    el.querySelector('.dy-desk').style.backgroundImage = `url(${url(teak())})`;
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-track]')) { const t = G.story && G.story.trackNow && G.story.trackNow(); if (t) { G.hud.toast('Tracking', t.name, 'meter', 2); this.close(); } return; }
      if (e.target.closest('.dy-page.r')) this.turn(1); else if (e.target.closest('.dy-page.l')) this.turn(-1);
    });
    addEventListener('keydown', (e) => {
      if (!this.on) return;
      const c = e.code;
      if (c === 'Escape' || c === 'KeyJ') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
      else if (c === 'KeyD' || c === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); this.turn(1); }
      else if (c === 'KeyA' || c === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); this.turn(-1); }
    }, true);
  }
  chapters() {
    const S = this.g.story; if (!S || !S.list) return [];
    const ms = S.list(), st = S.st;
    return ms.slice(0, Math.min(ms.length, st.m + 1)).map((m, i) => ({ m, i, cur: i === st.m }));
  }
  open() {
    const G = this.g;
    if (this.on || (G.state !== 'play' && G.state !== 'shop')) return;
    this.on = true; this.was = G.state; G.state = 'shop';
    G.audio.hush?.(true); G.releaseMouse?.();
    const ch = this.chapters(); this.i = Math.max(0, ch.length - 1);
    this.paint();
    this.el.hidden = false; this.el.classList.remove('out'); void this.el.offsetWidth; this.el.classList.add('in');
  }
  close() {
    if (!this.on) return;
    const G = this.g; this.on = false;
    this.el.classList.remove('in'); this.el.classList.add('out'); setTimeout(() => { if (!this.on) this.el.hidden = true; }, 300);
    if (G.state === 'shop') G.state = 'play';
    G.audio.hush?.(false); G.lockMouse?.();
  }
  turn(d) {
    const n = this.chapters().length, j = Math.max(0, Math.min(n - 1, this.i + d));
    if (j === this.i || this.flipping) return;
    // the page lifts and turns over the spine, then the next spread is there
    const F = this.el.querySelector('.dy-flip');
    F.className = 'dy-flip ' + (d > 0 ? 'fwd' : 'back');
    F.querySelector('.f').innerHTML = this.el.querySelector(d > 0 ? '.dy-page.r' : '.dy-page.l').innerHTML;
    F.querySelector('.f').style.backgroundImage = this.el.querySelector(d > 0 ? '.dy-page.r' : '.dy-page.l').style.backgroundImage;
    this.flipping = true; this.i = j;
    setTimeout(() => this.paint(true), 260);
    setTimeout(() => { F.className = 'dy-flip'; this.flipping = false; }, 620);
  }
  paint() {
    const G = this.g, S = G.story, ch = this.chapters(), C = ch[this.i];
    const L = this.el.querySelector('.dy-page.l'), R = this.el.querySelector('.dy-page.r');
    L.style.backgroundImage = `url(${url(paper(900, 1200, this.i * 2 + 1, true))})`;
    R.style.backgroundImage = `url(${url(paper(900, 1200, this.i * 2 + 2, false))})`;
    if (!C) { L.innerHTML = `<div class="dy-h"><small>दैनंदिनी</small><b>${G.free ? 'Free roam' : 'Nothing yet'}</b></div><p class="dy-t">${G.free ? 'No story in free roam. Just Pune.' : 'The first page is waiting.'}</p>`; R.innerHTML = ''; return; }
    const m = C.m, st = S.st, F = S.flags, day = Math.floor((G.clock || 0) / 24) + 1, a = ACT[m.act] || ['', ''];
    // what happened: the messages that started it, then each step (ticked when done)
    const texts = []; for (const t of m.texts || []) { const v = t.fn ? t.fn() : [t]; for (const q of v) texts.push(q); }
    const steps = (m.steps || []).filter(s => !s.flash && !s.scene).map((s, k) => ({ t: typeof s.obj === 'function' ? s.obj() : s.obj, done: !C.cur || k < st.step, now: C.cur && k === st.step }));
    const marg = MARGIN.filter(([id, f]) => id === m.id && F[f]).map(([, f, line]) => typeof line === 'function' ? line(F[f]) : line).filter(Boolean);
    const t = C.cur && S.target ? S.target() : null, cur = C.cur && steps.find(s => s.now);
    L.innerHTML = `<div class="dy-h"><small>${esc(a[0])} · ${esc(a[1])}</small><b>${esc(m.mr || m.title)}</b><i>${esc(m.title)}</i></div>
      ${C.cur && cur ? `<div class="dy-today"><span>आज · today</span>${esc(cur.t)}${t ? '<button class="dy-stamp" data-track>Track</button>' : ''}</div>` : ''}
      ${texts.slice(0, 2).map(q => `<p class="dy-msg">“${esc(q[2] || q[1])}”<span>— ${esc(S.name ? S.name(q[0]) : q[0])}</span></p>`).join('')}
      <ul class="dy-steps">${steps.map(s => `<li class="${s.done ? 'done' : s.now ? 'now' : 'todo'}">${esc(s.t)}</li>`).join('')}</ul>
      ${C.cur ? '' : '<p class="dy-end">Done. Page turned.</p>'}
      <div class="dy-margin">${marg.map(x => `<p>${esc(x)}</p>`).join('')}</div>
      <div class="dy-date">Day ${day} · Pune</div>`;
    // the right page: your photos from this chapter, taped in; a cutting if it made the papers
    const photos = (G.life.s.photos || []).filter(p => p.m === C.i).slice(-4);
    const cut = !C.cur && CUTTING[m.id];
    R.innerHTML = `${photos.map((p, k) => `<figure class="dy-pol" style="--r:${[-6, 4, -2, 7][k]}deg;--x:${[6, 46, 12, 50][k]}%;--y:${[6, 10, 48, 52][k]}%"><img alt="" src="${p.url}"><figcaption>${esc(p.at)}</figcaption><i class="tape"></i></figure>`).join('')}
      ${cut ? `<div class="dy-cut"><b>${esc(cut[0])}</b><p>${esc(cut[1])}</p></div>` : ''}
      ${photos.length || cut ? '' : `<p class="dy-none">No photos from this one.<br><small>K takes a picture; it gets printed in here.</small></p>`}
      <div class="dy-pn">${this.i + 1} / ${ch.length}</div>`;
  }
}
