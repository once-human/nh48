// Player settings, kept between sessions: controls (mouse feel, invert), camera (field of view),
// sound (master, voices, club music), subtitles, HUD, the city (crowds, traffic), how strict the
// police are, clock format, full screen. The pause menu has a Settings section for all of it.
import { safeStorage } from '../core/util.js';
import { ACTIONS, keyOf, keyName, setKey, resetKeys, keyState, refreshChips } from './keys.js';

const KEY = 'nh48_settings';
export const DEFAULTS = {
  sens: 1, invertY: false, fov: 0,
  masterVol: 0.8, trafficVol: 1, voiceVol: 1, worldVol: 1, fxVol: 1, musicVol: 1, mute: false,
  subs: 'both',              // both | line | off
  hud: 'full',               // full | minimal
  crowd: 1, traffic: 1,
  police: 'normal',          // relaxed | normal | strict
  clock24: false, fullscreen: true,
};
export const SOUND_KEYS = ['masterVol', 'trafficVol', 'voiceVol', 'worldVol', 'fxVol', 'musicVol', 'mute'];
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
  refreshChips();
  if (G.rig) {
    G.rig.fovAdd = s.fov;
    // paused, the camera isn't updating: show the new field of view straight away
    if (G.state === 'pause' && G.camera) { const base = (G.rig.fov || 62) - (G.rig._fovWas ?? 0); G.camera.fov = base + s.fov; G.camera.updateProjectionMatrix(); }
    G.rig._fovWas = s.fov;
  }
  if (G.people && G.quality) G.people.max = Math.round(G.quality.peds * s.crowd);
  if (G.traffic && G.quality) G.traffic.max = Math.round(G.quality.traffic * s.traffic);
  if (G.audio) {
    const A = G.audio;
    A.setVolume(s.mute ? 0 : s.masterVol);
    for (const [bus, k] of [['traffic', 'trafficVol'], ['voice', 'voiceVol'], ['world', 'worldVol'], ['fx', 'fxVol'], ['music', 'musicVol']]) A.setBusVolume(bus, s[k]);
  }
}

// the pause-menu sections: grouped rows, a label on the left and the control on the right
export function settingsHTML(part) {
  const seg = (id, opts) => `<div class="seg" data-set="${id}">${opts.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>`;
  const range = (id, min, max, step) => `<input type="range" data-set="${id}" min="${min}" max="${max}" step="${step}">`;
  const row = (l, c, sub) => `<div class="row"><div class="rl">${l}${sub ? `<small>${sub}</small>` : ''}</div><div class="rc">${c}</div></div>`;
  if (part === 'av') return `<div class="group settings">
      ${row('Field of view', range('fov', -10, 20, 1), 'Wider shows more of the street')}</div>`;
  if (part === 'sound') {
    const vol = (id, l, sub) => row(l, `<div class="vol">${range(id, 0, id === 'masterVol' ? 1 : 1.5, 0.05)}<output data-pct="${id}"></output></div>`, sub);
    return `<div class="group settings snd">
      ${vol('masterVol', 'Master', 'Everything')}
      ${row('Sound', seg('mute', [['false', 'On'], ['true', 'Muted']]))}
      ${vol('trafficVol', 'Traffic', 'Engines, horns, sirens')}
      ${vol('voiceVol', 'Voices', 'People talking, dates, shopkeepers')}
      ${vol('worldVol', 'City', 'Street noise, crows, dogs, temple bells')}
      ${vol('fxVol', 'Effects', 'Punches, money, phone, menus')}
      ${vol('musicVol', 'Music', 'Clubs and bars')}</div>
      <div class="set-reset"><button class="btn small" data-reset="sound">Reset sound to default</button></div>`;
  }
  return `<div class="group settings">
      ${row('Subtitles', seg('subs', [['both', 'With English'], ['line', 'Line only'], ['off', 'Off']]))}
      ${row('HUD', seg('hud', [['full', 'Full'], ['minimal', 'Minimal']]))}
      ${row('Clock', seg('clock24', [['false', '12 hour'], ['true', '24 hour']]))}
      ${row('Full screen', seg('fullscreen', [['true', 'On start'], ['false', 'Never']]))}</div>
    <div class="note">Saved on this device.</div>`;
}
export function bindSettings(root, G) {
  const parse = (k, v) => typeof DEFAULTS[k] === 'boolean' ? v === 'true' : typeof DEFAULTS[k] === 'number' ? parseFloat(v) : v;
  const set = (k, v) => { G.settings[k] = parse(k, v); saveSettings(G.settings); applySettings(G); syncSettings(root, G); };
  root.querySelectorAll('.settings [data-set]').forEach(el => {
    const k = el.dataset.set;
    if (el.tagName === 'INPUT') el.oninput = () => set(k, el.value);
    else el.querySelectorAll('button').forEach(b => b.onclick = () => set(k, b.dataset.v));
  });
  const rs = root.querySelector('[data-reset="sound"]');
  if (rs) rs.onclick = () => { for (const k of SOUND_KEYS) G.settings[k] = DEFAULTS[k]; saveSettings(G.settings); applySettings(G); syncSettings(root, G); };
  syncSettings(root, G);
}
export function syncSettings(root, G) {
  const s = G.settings;
  root.querySelectorAll('.settings [data-set]').forEach(el => {
    const k = el.dataset.set;
    if (el.tagName === 'INPUT') el.value = s[k];
    else el.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(s[k]) === b.dataset.v));
  });
  root.querySelectorAll('output[data-pct]').forEach(o => { o.textContent = Math.round(s[o.dataset.pct] * 100) + '%'; });
}

// ---- Controls: every action, the key it's on; click one and press a key to change it
export function controlsHTML() {
  const groups = [...new Set(ACTIONS.map(a => a.group))];
  return `<p class="ctl-tip">Click an action, then press the new key. Esc cancels. If the key is taken, the two swap.</p>` +
    groups.map(g => `<div class="gt">${g}</div><div class="group ctl">${ACTIONS.filter(a => a.group === g).map(a =>
      `<div class="row"><div class="rl">${a.label}</div><div class="rc"><button class="keybtn" data-act="${a.id}"></button></div></div>`).join('')}</div>`).join('') +
    `<div class="gt">Fixed</div><div class="group ctl"><div class="row"><div class="rl">Look around</div><div class="rc"><span class="kbd">Mouse</span></div></div>
      <div class="row"><div class="rl">Punch</div><div class="rc"><span class="kbd">Click</span></div></div>
      <div class="row"><div class="rl">Pick in a menu</div><div class="rc"><span class="kbd">↑</span><span class="kbd">↓</span><span class="kbd">1–9</span><span class="kbd">Enter</span></div></div>
      <div class="row"><div class="rl">Close a menu, pause</div><div class="rc"><span class="kbd">Esc</span></div></div>
      <div class="row"><div class="rl">Performance stats</div><div class="rc"><span class="kbd">F3</span></div></div></div>
    <div class="set-reset"><button class="btn small" data-reset="keys">Reset controls to default</button></div>`;
}
const NOBIND = new Set(['Escape', 'Enter', 'NumpadEnter', 'F3', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
export function bindControls(root, onChange) {
  const paint = () => root.querySelectorAll('.keybtn').forEach(b => { if (!b.classList.contains('wait')) b.textContent = keyName(keyOf(b.dataset.act)); });
  let wait = null;
  const stop = () => { if (!wait) return; wait.classList.remove('wait'); wait = null; keyState.capturing = false; window.removeEventListener('keydown', grab, true); paint(); };
  const grab = (e) => {
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape') return stop();
    if (NOBIND.has(e.code) || !e.code) return;
    const id = wait.dataset.act;
    stop(); setKey(id, e.code); paint(); onChange && onChange();
  };
  root.querySelectorAll('.keybtn').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    if (wait === b) return stop();
    stop();
    wait = b; b.classList.add('wait'); b.textContent = 'Press a key';
    keyState.capturing = true;
    window.addEventListener('keydown', grab, true);
  });
  const r = root.querySelector('[data-reset="keys"]');
  if (r) r.onclick = () => { stop(); resetKeys(); paint(); onChange && onChange(); };
  root._stopKeys = stop;
  paint();
}
