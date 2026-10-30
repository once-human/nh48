// Key bindings the player can change (Pause → Controls). The game itself keeps reading the default
// keys (KeyF to interact, KeyE for the jhola ...): one listener, added before any other, turns the key
// you actually pressed into the default key of the action you bound it to, so every panel, prompt and
// shortcut follows a rebinding without knowing about it. The arrow keys, Esc, Enter and the number
// keys always work as they do.
import { safeStorage } from '../core/util.js';

const STORE = 'nh48_keys';
export const ACTIONS = [
  { id: 'fwd', label: 'Forward, accelerate', group: 'Move', def: 'KeyW' },
  { id: 'back', label: 'Back, brake, hold to reverse', group: 'Move', def: 'KeyS' },
  { id: 'left', label: 'Left, steer left', group: 'Move', def: 'KeyA' },
  { id: 'right', label: 'Right, steer right', group: 'Move', def: 'KeyD' },
  { id: 'sprint', label: 'Sprint; nitrous when driving', group: 'Move', def: 'ShiftLeft' },
  { id: 'slow', label: 'Walk slowly', group: 'Move', def: 'AltLeft' },
  { id: 'jump', label: 'Jump, climb, handbrake', group: 'Move', def: 'Space' },
  { id: 'use', label: 'Talk, walk in, get in or out', group: 'Do', def: 'KeyF' },
  { id: 'punch', label: 'Punch (click works too)', group: 'Do', def: 'KeyX' },
  { id: 'roll', label: 'Roll; camera when driving', group: 'Do', def: 'KeyC' },
  { id: 'pick', label: 'Pickpocket; hydraulic hop when driving', group: 'Do', def: 'KeyG' },
  { id: 'accept', label: 'Accept an offer', group: 'Do', def: 'KeyY' },
  { id: 'horn', label: 'Horn', group: 'Vehicle', def: 'KeyH' },
  { id: 'lights', label: 'Headlights, torch', group: 'Vehicle', def: 'KeyL' },
  { id: 'lookback', label: 'Look back', group: 'Vehicle', def: 'KeyB' },
  { id: 'reset', label: 'Back on the road', group: 'Vehicle', def: 'KeyR' },
  { id: 'cam', label: 'Change camera', group: 'Vehicle', def: 'KeyV' },
  { id: 'beacon', label: 'Roof lights (beacon, strobes)', group: 'Vehicle', def: 'KeyN' },
  { id: 'music', label: 'Music system', group: 'Vehicle', def: 'KeyU' },
  { id: 'bag', label: 'Jhola', group: 'Menus', def: 'KeyE' },
  { id: 'stats', label: 'Your status', group: 'Menus', def: 'Tab' },
  { id: 'map', label: 'Map', group: 'Menus', def: 'KeyM' },
  { id: 'phone', label: 'Phone', group: 'Menus', def: 'KeyT' },
  { id: 'photo', label: 'Photo mode', group: 'Menus', def: 'KeyK' },
  { id: 'pause', label: 'Pause (Esc always works)', group: 'Menus', def: 'KeyP' },
];
// these keep working whatever happens (menus need them)
const ALWAYS = new Set(['Escape', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'ShiftRight', 'F3']);

export let binds = {};
let remap = new Map(), blocked = new Set();
export const keyState = { capturing: false };

function rebuild() {
  remap = new Map(); blocked = new Set();
  for (const a of ACTIONS) { const k = binds[a.id] || a.def; if (k !== a.def) remap.set(k, a.def); }
  const bound = new Set(ACTIONS.map(a => binds[a.id] || a.def));
  for (const a of ACTIONS) if (!bound.has(a.def) && !ALWAYS.has(a.def)) blocked.add(a.def);
  // a default key that's now someone else's binding is already in remap; a free one does nothing
}
export function loadKeys() {
  try { const st = safeStorage(); binds = JSON.parse(st && st.getItem(STORE) || '{}') || {}; } catch (e) { binds = {}; }
  for (const k of Object.keys(binds)) if (!ACTIONS.some(a => a.id === k)) delete binds[k];
  rebuild();
}
function save() { try { const st = safeStorage(); st && st.setItem(STORE, JSON.stringify(binds)); } catch (e) { /* private mode */ } }
export function keyOf(id) { const a = ACTIONS.find(x => x.id === id); return a ? binds[id] || a.def : null; }
// bind an action to a key; whoever had that key takes this action's old key (a swap, never a clash)
export function setKey(id, code) {
  const old = keyOf(id);
  if (!old || old === code) return;
  const other = ACTIONS.find(a => a.id !== id && keyOf(a.id) === code);
  binds[id] = code;
  if (other) binds[other.id] = old;
  for (const a of ACTIONS) if (binds[a.id] === a.def) delete binds[a.id];
  rebuild(); save(); refreshChips();
}
export function resetKeys() { binds = {}; rebuild(); save(); refreshChips(); }
// key chips written as <span class="kbd" data-k="F"> show the key that does it now
export function refreshChips(root = document) { root.querySelectorAll('.kbd[data-k]').forEach(c => { c.textContent = keyLabel(c.dataset.k); }); }

const NAMES = { Space: 'Space', Tab: 'Tab', ShiftLeft: 'Shift', ShiftRight: 'R Shift', AltLeft: 'Alt', AltRight: 'R Alt', ControlLeft: 'Ctrl', ControlRight: 'R Ctrl',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', CapsLock: 'Caps', Enter: 'Enter', Backspace: '⌫', Escape: 'Esc' };
export function keyName(code) {
  if (!code) return '';
  if (NAMES[code]) return NAMES[code];
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^Digit(\d)$/.exec(code); if (m) return m[1];
  m = /^Numpad(.+)$/.exec(code); if (m) return 'Num ' + m[1];
  return code;
}
// the key to show for a default key ('F', 'KeyF', 'Tab'...): what the player has it bound to now
export function keyLabel(k) {
  const code = /^[A-Z]$/.test(k) ? 'Key' + k : k;
  const a = ACTIONS.find(x => x.def === code);
  return a ? keyName(keyOf(a.id)) : k;
}

// ---- the remapping listener (capture, on window, before anything else)
const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
function relay(e) {
  if (e._nh || keyState.capturing || typing(e.target)) return;
  const code = e.code, to = remap.get(code);
  if (to === undefined && !blocked.has(code)) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (to === undefined) return;          // a default key nobody uses any more: does nothing
  const ev = new KeyboardEvent(e.type, { code: to, key: e.key, repeat: e.repeat, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, bubbles: true, cancelable: true });
  ev._nh = true;
  (e.target || window).dispatchEvent(ev);
}
if (typeof window !== 'undefined') {
  loadKeys();
  window.addEventListener('load', () => refreshChips());
  window.addEventListener('keydown', relay, true);
  window.addEventListener('keyup', relay, true);
}
