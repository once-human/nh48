// Player settings, kept between sessions: controls (mouse feel, invert), camera (field of view),
// sound (master, voices, club music), subtitles, HUD, the city (crowds, traffic), how strict the
// police are, clock format, full screen. The pause menu has a Settings section for all of it.
import { safeStorage } from '../core/util.js';

const KEY = 'nh48_settings';
export const DEFAULTS = {
  sens: 1, invertY: false, fov: 0,
  voiceVol: 1, musicVol: 1,
  subs: 'both',              // both | line | off
  hud: 'full',               // full | minimal
  crowd: 1, traffic: 1,
  police: 'normal',          // relaxed | normal | strict
  clock24: false, fullscreen: true,
};
export const POLICE_MUL = { relaxed: 0.45, normal: 1, strict: 1.6 };

export function loadSettings() {
  const st = safeStorage();
  let s = {};
  try { s = JSON.parse(st && st.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
  // mouse feel, crowds, traffic and police strictness are fixed now (tuned, not player settings)
  for (const k of ['sens', 'invertY', 'crowd', 'traffic', 'police']) delete s[k];
  return { ...DEFAULTS, ...s };
}
export function saveSettings(s) {
  const st = safeStorage();
  try { st && st.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
}
// what each control does to the game, applied live
export function applySettings(G) {
  const s = G.settings;
  document.getElementById('hud')?.classList.toggle('hud-min', s.hud === 'minimal');
  if (G.rig) G.rig.fovAdd = s.fov;
  if (G.people && G.quality) G.people.max = Math.round(G.quality.peds * s.crowd);
  if (G.traffic && G.quality) G.traffic.max = Math.round(G.quality.traffic * s.traffic);
  if (G.audio) { G.audio.voiceVol = s.voiceVol; G.audio.musicVol = s.musicVol; }
}

// the pause-menu section
export function settingsHTML() {
  const seg = (id, opts) => `<div class="seg" data-set="${id}">${opts.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>`;
  const range = (id, min, max, step) => `<input type="range" data-set="${id}" min="${min}" max="${max}" step="${step}">`;
  return `<div class="sec settings"><div class="cap">Settings</div>
    <div class="set-grid">
      <label>Field of view</label>${range('fov', -10, 20, 1)}
      <label>Voices</label>${range('voiceVol', 0, 1.5, 0.05)}
      <label>Club music</label>${range('musicVol', 0, 1.5, 0.05)}
      <label>Subtitles</label>${seg('subs', [['both', 'With English'], ['line', 'Line only'], ['off', 'Off']])}
      <label>HUD</label>${seg('hud', [['full', 'Full'], ['minimal', 'Minimal']])}
      <label>Clock</label>${seg('clock24', [['false', '12 hour'], ['true', '24 hour']])}
      <label>Full screen</label>${seg('fullscreen', [['true', 'On start'], ['false', 'Never']])}
    </div>
    <div class="note">Saved on this device.</div></div>`;
}
export function bindSettings(root, G) {
  const parse = (k, v) => typeof DEFAULTS[k] === 'boolean' ? v === 'true' : typeof DEFAULTS[k] === 'number' ? parseFloat(v) : v;
  const set = (k, v) => { G.settings[k] = parse(k, v); saveSettings(G.settings); applySettings(G); syncSettings(root, G); };
  root.querySelectorAll('.settings [data-set]').forEach(el => {
    const k = el.dataset.set;
    if (el.tagName === 'INPUT') el.oninput = () => set(k, el.value);
    else el.querySelectorAll('button').forEach(b => b.onclick = () => set(k, b.dataset.v));
  });
  syncSettings(root, G);
}
export function syncSettings(root, G) {
  const s = G.settings;
  root.querySelectorAll('.settings [data-set]').forEach(el => {
    const k = el.dataset.set;
    if (el.tagName === 'INPUT') el.value = s[k];
    else el.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(s[k]) === b.dataset.v));
  });
}
