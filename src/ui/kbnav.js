// Keyboard control for any list panel, so the mouse can stay in the game: W/S or the arrow keys
// move a highlight, Enter or Space picks it. Number keys still work where a panel has them.
export class KbNav {
  constructor(root, sel, onMove) { this.root = root; this.sel = sel; this.onMove = onMove; this.i = -1; }
  items() { return [...this.root.querySelectorAll(this.sel)].filter(b => !b.disabled && b.offsetParent !== null); }
  reset() { this.i = -1; this.paint(); }
  paint() {
    const it = this.items();
    if (this.i >= it.length) this.i = it.length - 1;
    it.forEach((b, k) => b.classList.toggle('kb', k === this.i));
    const b = it[this.i];
    if (b) b.scrollIntoView({ block: 'nearest' });
  }
  key(e) {
    const it = this.items();
    if (!it.length) return false;
    const d = e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : e.code === 'ArrowUp' || e.code === 'KeyW' ? -1 : 0;
    if (d) {
      e.preventDefault(); e.stopImmediatePropagation();
      this.i = this.i < 0 ? (d > 0 ? 0 : it.length - 1) : (this.i + d + it.length) % it.length;
      this.paint();
      if (this.onMove) this.onMove(it[this.i]);
      return true;
    }
    if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && it[this.i]) { e.preventDefault(); e.stopImmediatePropagation(); it[this.i].click(); return true; }
    return false;
  }
}
