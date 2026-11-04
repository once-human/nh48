// a second prompt under the first: F for the vehicle beside you and V for the shop door you're at no longer fight
// over one line
import { HUD } from '@orig/ui/hud.js';
import { keyLabel } from '@orig/game/keys.js';

HUD.prototype.prompt2 = function (key, text, life = 0.25) {
  let el = this._p2;
  if (!el) {
    const a = this.$('h-prompt'); if (!a) return;
    el = this._p2 = a.cloneNode(true); el.id = 'h-prompt2'; el.firstChild.id = ''; el.lastChild.id = '';
    a.after(el);
  }
  el.firstChild.textContent = keyLabel(key); el.lastChild.textContent = text; el.classList.add('show');
  clearTimeout(this._p2T); this._p2T = setTimeout(() => el.classList.remove('show'), life*1000 + 60);
};
