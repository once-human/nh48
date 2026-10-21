// Your game survives a reload: where you are, what you're driving (your auto, a car you took),
// where you left your auto (or that it was towed, and to which chowki), the time of day, health
// and whether the police are after you. Money, fines and everything you own have their own keys
// (nh48_stats, nh48_police, nh48_life); this is the "where was I" part. Saved every few seconds
// while playing and when the tab is hidden or closed.
import { safeStorage } from '../core/util.js';

const KEY = 'nh48_save';
// everything "Start over" wipes (graphics quality is a device setting, not progress)
export const PROGRESS_KEYS = ['nh48_save', 'nh48_stats', 'nh48_police', 'nh48_life', 'nh48_char'];

const r2 = (v) => Math.round(v * 100) / 100;
function vehOf(v, auto) {
  if (!v) return null;
  return { type: v === auto ? 'auto' : v.type, col: v.paint, plate: v.plate || null, stolen: !!v.stolen, helmet: !!v.helmet, x: r2(v.x), z: r2(v.z), th: r2(v.th), owned: v.owned || null, fuel: v.fuel ?? null, dmg: v.dmg ?? 0 };
}

export function snapshot(G) {
  const P = G.player, A = P.auto;
  const d = P.dropped.find(q => q.veh === A);
  // inside a shop the save remembers its door, not the room (rooms sit far outside the city)
  const I = G.interiors && G.interiors.cur;
  const foot = I ? { x: r2(I.door.x), z: r2(I.door.z), yaw: r2(I.door.yaw + Math.PI) } : { x: r2(P.foot.x), z: r2(P.foot.z), yaw: r2(P.foot.yaw) };
  return {
    v: 1, t: Date.now(), hour: r2(G.hour), clock: r2(G.clock || 0),
    mode: P.mode,
    foot,
    veh: P.mode === 'veh' ? vehOf(P.cur, A) : null,
    auto: { x: r2(A.x), z: r2(A.z), th: r2(A.th), towed: d && d.towed ? d.towed : null, towedAt: G.police.towedAt || null },
    dropped: P.dropped.filter(q => q.veh !== A).map(q => vehOf(q.veh, A)),
    heat: G.police.heat || 0, hp: Math.round(P.hp ?? 100),
    waypoint: G.waypoint ? { x: G.waypoint.x, z: G.waypoint.z, name: G.waypoint.name || '' } : null,
  };
}

export function save(G) {
  if (!G.player || !G.police || G.params.has('test')) return;
  const st = safeStorage();
  if (st) try { st.setItem(KEY, JSON.stringify(snapshot(G))); } catch (e) { /* storage full or blocked */ }
}
export function load() {
  const st = safeStorage();
  try { return st ? JSON.parse(st.getItem(KEY) || 'null') : null; } catch (e) { return null; }
}

// where to build the world first (before anything else exists)
export function startPoint(s) {
  if (!s) return null;
  // an old save made inside a shop room: come back at your auto instead
  if (s.foot && Math.abs(s.foot.x) > 30000) { s.foot = { x: s.auto.x + 2, z: s.auto.z + 2, yaw: s.auto.th }; }
  if (s.mode === 'foot') return { x: s.foot.x, z: s.foot.z, th: s.foot.yaw };
  if (s.mode === 'veh' && s.veh) return { x: s.veh.x, z: s.veh.z, th: s.veh.th };
  return { x: s.auto.x, z: s.auto.z, th: s.auto.th };
}

// put everything back (after the world, traffic and police exist)
export function restore(G, s, Vehicle) {
  const P = G.player, T = G.traffic;
  if (s.clock) G.clock = s.clock;
  if (s.hour !== undefined) G.hour = s.hour;
  P.hp = s.hp ?? 100;
  const make = (o) => {
    const v = new Vehicle(G.W, G.scene, G.vmats, o.type, o.col);
    v.reset(o.x, o.z, o.th); v.y = G.W.surf.height(o.x, o.z);
    v.plate = o.plate || P.randomPlate(); v.stolen = o.stolen; v.helmet = o.helmet; v.owned = o.owned || null;
    if (o.fuel !== null && o.fuel !== undefined) v.fuel = o.fuel; v.dmg = o.dmg || 0;
    return v;
  };
  if (s.mode !== 'auto') {
    // your auto stays where you left it (or at the chowki it was towed to)
    P.teleportFoot(s.foot.x, s.foot.z, s.foot.yaw, T);
    P.moveAuto(s.auto.x, s.auto.z, s.auto.th, T);
    const d = P.dropped.find(q => q.veh === P.auto);
    if (d && s.auto.towed) d.towed = s.auto.towed;
    if (s.auto.towedAt) G.police.towedAt = s.auto.towedAt;
  }
  for (const o of s.dropped || []) { if (!o || o.type === 'auto') continue; try { P.addDropped(make(o), T); } catch (e) { /* model gone */ } }
  if (s.mode === 'veh' && s.veh && s.veh.type !== 'auto') {
    try { P.switchTo(make(s.veh)); } catch (e) { /* stay on foot */ }
  }
  if (s.waypoint) G.setWaypoint(s.waypoint);
  G.pendingHeat = s.heat || 0;
}

export function wipe() {
  const st = safeStorage();
  if (st) for (const k of PROGRESS_KEYS) try { st.removeItem(k); } catch (e) { /* ignore */ }
  try { sessionStorage.removeItem('nh48_resume'); } catch (e) { /* ignore */ }
}
