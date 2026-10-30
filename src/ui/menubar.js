// The bar across the top of every menu: the PUNERI wordmark, the tabs (Q / E step through them: Jhola,
// Map, Missions, Stats, Settings) and your money and the day on the right. One menu, five rooms: the jhola,
// missions and stats are drawn by the jhola; the map is the map screen; settings is the pause menu.
const TABS = [['inv', 'Jhola'], ['map', 'Map'], ['missions', 'Missions'], ['stats', 'Stats'], ['settings', 'Settings']];
const MARK = '<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M4 22a16 16 0 0 1 32 0v26H4z" fill="#F4F1EA"/><path d="M4 22a16 16 0 0 1 32 0z" fill="#F2B705"/><rect x="4" y="44" width="32" height="4" fill="#C9C4B8"/></svg>';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export class MenuBar {
  constructor(G) {
    this.g = G;
    const el = this.el = document.createElement('nav'); el.className = 'mb'; el.hidden = true;
    el.innerHTML = `<div class="mb-brand">${MARK}<b>PUNERI</b></div>
      <div class="mb-tabs"><span class="kbd">Q</span>${TABS.map(([k, n]) => `<button data-tab="${k}">${n}</button>`).join('')}<span class="kbd">E</span></div>
      <div class="mb-r"><b class="num mb-cash"></b><span class="mb-when"></span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) this.go(b.dataset.tab); });
    // Q / E on the map and in settings (the jhola handles its own)
    addEventListener('keydown', (e) => {
      if (el.hidden || (G.jhola && G.jhola.on) || e.repeat) return;
      if (e.code !== 'KeyQ' && e.code !== 'KeyE') return;
      const ae = document.activeElement; if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      if (G.hud && G.hud.pickerOpen) return;
      e.preventDefault(); e.stopImmediatePropagation(); this.step(e.code === 'KeyE' ? 1 : -1);
    }, true);
  }
  get cur() {
    const G = this.g;
    if (G.jhola && G.jhola.on) return G.jhola.tab;
    if (G.state === 'map') return 'map';
    if (G.state === 'pause') return 'settings';
    return null;
  }
  step(d) { const i = Math.max(0, TABS.findIndex(t => t[0] === this.cur)); this.go(TABS[(i + d + TABS.length) % TABS.length][0]); }
  go(k) {
    const G = this.g, J = G.jhola, cur = this.cur;
    if (k === cur) return;
    // leave where you are, without taking the mouse back (you're staying in the menus)
    if (cur === 'map') G.toggleMap(false);
    else if (cur === 'settings') this.leavePause();
    if (k === 'map') { if (J.on) J.close(true); G.toggleMap(true); }
    else if (k === 'settings') {
      if (J.on) J.close(true);
      G.togglePause(true);
      const b = G.hud.pause && G.hud.pause.querySelector('.pz-i[data-pane="set"]'); if (b) b.click();
    } else if (J.on) J.setTab(k); else J.open(k);
    this.sync();
  }
  leavePause() {
    const G = this.g; if (G.state !== 'pause') return;
    G.state = 'play'; G.livePause = false; G.hud.pause.hidden = true; G.renderer.domElement.classList.remove('paused');
  }
  // every frame: shown while any of the five is open
  update(dt) {
    const G = this.g, c = this.cur, on = !!c && G.state !== 'title';
    if (on !== !this.el.hidden) { this.el.hidden = !on; document.getElementById('ui')?.classList.toggle('mb-on', on); if (on) this._t = 0; }
    if (!on) return;
    if (c !== this._c) { this._c = c; for (const b of this.el.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === c); }
    if ((this._t = (this._t || 0) - dt) <= 0) { this._t = 0.5; this.sync(); }
  }
  sync() {
    const G = this.g, h = G.hour || 0, day = Math.floor((G.clock || 0) / 24);
    const hh = Math.floor(h), mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
    const t = G.settings && G.settings.clock24 ? `${String(hh).padStart(2, '0')}:${mm}` : `${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'am' : 'pm'}`;
    this.el.querySelector('.mb-cash').textContent = '₹' + Math.round(G.stats ? G.stats.money : 0).toLocaleString('en-IN');
    this.el.querySelector('.mb-when').textContent = `${DAYS[day % 7]}, day ${day + 1} · ${t}`;
    const c = this.cur; for (const b of this.el.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === c);
  }
}
