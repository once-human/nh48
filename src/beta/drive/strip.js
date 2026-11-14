// Long Drive keeps only what driving needs. The game is built whole (one codebase, one start-up), and then everything a
// drive through empty country has no use for is taken down: its things leave the scene, the memory of what only it drew
// is given back to the graphics card, its lists are emptied, and its work each frame is gone (not skipped by a check:
// the step itself is replaced by nothing). What stays: you and the car (its physics, crashes, damage, glass, fire and
// smoke), the camera, the sky, the weather and the wet road, the lights, the sound and the radio, the HUD and the menus.
import * as THREE from 'three';

// the game's systems that go
const GAME = ['people', 'police', 'emergency', 'fauna', 'strays', 'transit', 'shops', 'interiors', 'club', 'gigs', 'gym', 'home', 'hustle',
  'date', 'story', 'tut', 'rides', 'duty', 'eggs', 'wada', 'postcards', 'photowalk', 'brawl', 'brain', 'approachSt', 'edge', 'trial',
  'blood', 'arms', 'jhola', 'props', 'talkUI', 'cows', 'cyclists', 'dogs', 'kites', 'cats'];
// and the city's own parts of the world
const WORLD = ['nearBoards', 'trains', 'parked', 'grass', 'farCity', 'farGround', 'landmarks', 'activity', 'cityMap', 'lampSet', 'lampDeadSet'];
const STEPS = ['update', 'step', 'tick', 'think', 'render', 'spawn', 'prebuild', 'prewarm', 'populate', 'refill', 'warm'];
const NOOP = () => {};
let SHARED = new Set();

// every 3D thing an object holds (in its fields, and in lists, maps and sets of them), two levels down
// (never into what's shared: the game itself, the world, the sky, you, the camera and the rest that stays)
function things(o, out, depth = 0, seen = new Set()) {
  if (!o || typeof o !== 'object' || seen.has(o) || depth > 2) return out;
  seen.add(o);
  if (o.isObject3D) { out.add(o); return out; }
  const each = (v) => { if (v && typeof v === 'object' && !SHARED.has(v)) { if (v.isObject3D) out.add(v); else if (depth < 2 && !v.isMaterial && !v.isTexture && !v.isBufferGeometry && !ArrayBuffer.isView(v)) things(v, out, depth + 1, seen); } };
  if (Array.isArray(o) || o instanceof Set) { for (const v of o) each(v); return out; }
  if (o instanceof Map) { for (const v of o.values()) each(v); return out; }
  for (const k of Object.keys(o)) { if (k === 'game' || k === 'G' || k === 'W' || k === 'scene' || k === 'renderer' || k === 'camera' || k === 'player' || k === 'parent') continue; each(o[k]); }
  return out;
}

// before the game sets itself up: nothing that would fill the (empty) streets with people or traffic runs at all
export function quiet(G) {
  for (const k of GAME) { const o = G[k]; if (o && typeof o === 'object') for (const m of STEPS) if (typeof o[m] === 'function') o[m] = NOOP; }
  const T = G.traffic; if (T) for (const m of ['prefill', 'spawn', 'randomLink', 'despawn']) if (typeof T[m] === 'function') T[m] = m === 'randomLink' ? () => null : NOOP;
}

export function strip(G) {
  const W = G.W, scene = G.scene, gone = new Set(), keep = new Set();
  SHARED = new Set([G, W, G.sky, W.sky, G.player, G.rig, G.camera, G.renderer, G.post, G.audio, G.hud, G.weather, G.lights, G.smoke, G.traffic, G.input,
    G.scene, W.country, W.trees, W.surf, W.collision, W.mats, W.hills, G.puddles, G.modfx, G.photo, G.cut, G.phone, G.menubar, G.life, G.gfx, G.crowd].filter(Boolean));
  // what must stay, whoever holds it: you, your body, what you drive, the sky, the country
  const P = G.player;
  for (const o of [P && P.root, P && P.auto && P.auto.root, W.country && W.country.group, W.sky && W.sky.dome, W.trees && W.trees.group, G.smoke && G.smoke.group]) if (o) keep.add(o);
  const take = (sys) => {
    if (!sys || typeof sys !== 'object') return;
    for (const o of things(sys, new Set())) {
      let k = o, safe = false; while (k) { if (keep.has(k)) { safe = true; break; } k = k.parent; }
      if (safe || o === scene || o.isCamera) continue;
      // (and never a light, or anything with one in it: the sun and the sky's light are shared by everything)
      let lit = false; o.traverse((q) => { if (q.isLight) lit = true; }); if (lit) continue;
      gone.add(o);
    }
    // its work each frame: nothing
    for (const m of STEPS) if (typeof sys[m] === 'function') sys[m] = NOOP;
    // and its lists of things, empty
    for (const k of ['list', 'items', 'agents', 'all', 'active', 'pool']) if (Array.isArray(sys[k])) sys[k].length = 0;
  };
  for (const k of GAME) take(G[k]);
  for (const k of WORLD) take(W[k]);
  // the traffic object stays (your car is filed with it), its vehicles' drawings go
  if (G.traffic) { for (const o of things(G.traffic.inst || {}, new Set())) gone.add(o); G.traffic.list.length = 0; }
  for (const o of gone) if (o.parent) o.parent.remove(o);
  // the graphics card's copy of anything drawn only by what's gone
  const used = new Set();
  scene.traverse((o) => { if (o.geometry) used.add(o.geometry); if (o.material) for (const m of [].concat(o.material)) used.add(m); });
  let ng = 0, nm = 0;
  for (const o of gone) o.traverse((q) => {
    if (q.geometry && !used.has(q.geometry)) { q.geometry.dispose(); used.add(q.geometry); ng++; }
    if (q.isInstancedMesh && q.dispose && !used.has(q)) { try { q.dispose(); } catch (e) { /* done */ } used.add(q); }
    if (q.material) for (const m of [].concat(q.material)) if (!used.has(m)) { m.dispose(); used.add(m); nm++; }
  });
  G.stripped = { objects: gone.size, geometries: ng, materials: nm };
  return G.stripped;
}
