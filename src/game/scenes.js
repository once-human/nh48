// The story's scenes (see cutscene.js): staged in the real streets, at the real hour, in whatever the weather is.
import { buildCoach } from '../vehicles/coach.js';

const ease = (t) => t * t * (3 - 2 * t);

// PROLOGUE · Shivneri. A quarter to midnight, the monsoon. The Shivneri from Bangalore-via-Mumbai pulls up on the
// road outside Shaniwar Wada; you step down with one bag; it pulls away and leaves you in the rain with the Delhi
// Darwaza lit up behind you; across the road Bapu Kaka, under the auto's hood, shouts for you
export function shivneri(S) {
  const G = S.g, P = G.player, W = G.W, A = P.auto;
  if (!A || !W.graph) return null;
  const n = W.graph.nearest(A.x, A.z, 90, e => e.rank >= 2) || W.graph.nearest(A.x, A.z, 250);
  if (!n) return null;
  const e = n.e, s0 = Math.max(4, Math.min(e.len - 4, n.s)), dir = s0 > 75 ? 1 : -1, lat = Math.max(0.9, e.w / 2 - 1.7);
  const pose = (s) => { const t = W.graph.at(e, Math.max(0, Math.min(e.len, s))), hx = t[2] * dir, hz = t[3] * dir; return { x: t[0] + hz * lat, z: t[1] - hx * lat, hx, hz }; };
  const stop = pose(s0), L = { x: stop.hz, z: -stop.hx };                         // L: towards the kerb
  const md = buildCoach('शिवनेरी', 'पुणे · PUNE'), bus = md.group;
  let bs = s0 - dir * 75, bv = 0;
  const place = () => { const p = pose(bs); bus.position.set(p.x, W.surf.height(p.x, p.z), p.z); bus.rotation.y = -Math.atan2(p.hz, p.hx); for (const w of md.wheels) w.spin.rotation.z -= bv * 0.016 / w.r; };
  const door = { x: stop.x + stop.hx * md.door.x + L.x * (md.dims.W / 2 + 0.7), z: stop.z + stop.hz * md.door.x + L.z * (md.dims.W / 2 + 0.7) };
  const kerb = { x: door.x + L.x * 2.6 + stop.hx * 0.6, z: door.z + L.z * 2.6 + stop.hz * 0.6 };
  const faceAuto = () => Math.atan2(A.z - kerb.z, A.x - kerb.x);
  const bapu = () => S.npcs && S.npcs[0];
  const head = (o, h = 1.55) => ({ x: o.x, y: W.surf.height(o.x, o.z) + h, z: o.z });
  const fem = S.fem;
  const cleanup = () => { if (bus.parent) bus.parent.remove(bus); P.hideBody = false; S.flags.sawShivneri = 1; S.save(); };
  return {
    title: 'शिवनेरी', sub: 'Prologue · Pune, 11:45 pm',
    start: () => {
      G.setHour(23.75); if (G.weather) { G.weather.kind = 'rain'; G.weather.wet = Math.max(G.weather.wet || 0, 0.75); }
      P.teleportFoot(kerb.x, kerb.z, faceAuto(), G.traffic); P.hideBody = true;
      G.scene.add(bus); place();
      G.audio.at && G.audio.at(stop.x, stop.z, () => G.audio.noiseBurst && G.audio.noiseBurst(2.5, 140, 0.6, 0.18));
    },
    shots: [
      // 1. it comes in out of the rain, headlights and the orange board, slowing for the stop
      { dur: 7, update: (cs, dt) => { const k = Math.min(1, cs.t / 6.4), sN = s0 - dir * 75 * (1 - ease(k)); bv = Math.abs(sN - bs) / Math.max(dt, 1e-3); bs = sN; place(); },
        cam: () => { const c = { x: stop.x + stop.hx * 16 + L.x * 4.2, z: stop.z + stop.hz * 16 + L.z * 4.2 }; return { ...c, y: W.surf.height(c.x, c.z) + 1.25, lx: bus.position.x, ly: bus.position.y + 1.9, lz: bus.position.z, fov: 42, ease: 2.2 }; },
        lines: [[5.4, 'you', 'पुणे. शेवटी.', 'Pune. At last.']] },
      // 2. the door hisses open; you step down into it with one bag
      { dur: 6.5,
        enter: () => { bv = 0; P.teleportFoot(door.x, door.z, Math.atan2(L.z, L.x), G.traffic); P.hideBody = false; P.puppet = { x: kerb.x, z: kerb.z, face: faceAuto() }; G.audio.noiseBurst && G.audio.noiseBurst(0.6, 2600, 0.7, 0.22); },
        cam: () => { const F = P.foot, c = { x: F.x - L.x * 2.4 - stop.hx * 1.2, z: F.z - L.z * 2.4 - stop.hz * 1.2 }; return { ...c, y: (F.y || 0) + 1.85, lx: F.x + L.x * 3, ly: (F.y || 0) + 1.5, lz: F.z + L.z * 3, fov: 48, ease: 3 }; },
        lines: [[1.4, 'you', 'दहा हजार रुपये. एक बॅग. आणि पोलिसांचं एक पत्र.', 'Ten thousand rupees. One bag. And a letter from the police.'], [4.6, 'you', 'आणि तीन आठवडे, जे मला आठवतच नाहीत.', 'And three weeks I can’t remember.']] },
      // 3. it pulls away, and there's the Wada, lit, in the rain
      { dur: 6, update: (cs, dt) => { bv = Math.min(14, bv + dt * 2.2); bs += dir * bv * dt; place(); },
        cam: () => { const F = P.foot, a = faceAuto(), c = { x: F.x - Math.cos(a) * 3.4, z: F.z - Math.sin(a) * 3.4 }; return { ...c, y: (F.y || 0) + 2.1, lx: F.x + Math.cos(a) * 20, ly: (F.y || 0) + 4.5, lz: F.z + Math.sin(a) * 20, fov: 56, ease: 1.6 }; },
        lines: [[1.2, 'you', 'शनिवारवाडा. बापू काका म्हणाले होते, इथेच.', 'Shaniwar Wada. Bapu Kaka said he’d be here.']] },
      // 4. across the road: Bapu Kaka, waving you over from under the auto's hood
      { dur: 5,
        enter: () => { const b = bapu(); if (b) { b.act = { clip: 'wave', t: 0, dur: 2.4 }; b.yaw = Math.atan2(P.z - b.z, P.x - b.x); } bus.visible = false; },
        cam: () => { const b = bapu() || { x: A.x, z: A.z }, F = P.foot, dx = b.x - F.x, dz = b.z - F.z, d = Math.hypot(dx, dz) || 1, h = head(b);
          const c = { x: F.x + dx / d * Math.max(1.5, d - 5) - dz / d * 1.2, z: F.z + dz / d * Math.max(1.5, d - 5) + dx / d * 1.2 }; return { ...c, y: W.surf.height(c.x, c.z) + 1.6, lx: h.x, ly: h.y, lz: h.z, fov: 38, cut: true }; },
        lines: [[0.4, 'bapu', fem ? 'ए! इकडे! भिजत उभी राहू नकोस!' : 'ए! इकडे! भिजत उभा राहू नकोस!', 'Hey! Over here! Don’t just stand there getting soaked!']] },
    ],
    skip: () => { P.puppet = null; P.teleportFoot(kerb.x, kerb.z, faceAuto(), G.traffic); },
    end: cleanup,
  };
}

// ---------------------------------------------------------------- building blocks for the story's scenes
import { castLook, castPersona, castIdle } from '../people/castLooks.js';
// someone from the story, standing at (x, z) facing (fx, fz); cleared with the step's other people
export function actor(S, who, x, z, fx, fz) {
  const G = S.g, near = G.W.graph.nearest(x, z, 200); if (!near) return null;
  const p = G.people.make(near.e, near.s, near.side || 1, { mode: 'stand' });
  p.x = x; p.z = z; p.fixed = true; p.ctl = true; p.anchor = { x, z }; p.wait = 1e9; p.story = who; p.crew = true; p.idle = castIdle(who);
  const L = castLook(G.people.kit, who, (S.npcs || []).filter(q => q.story === who).length);
  if (L) { p.look = L; p.female = L.female; p.persona = castPersona(who) || p.persona; p.shirt = [L.top.r, L.top.g, L.top.b]; p.lower = [L.bottom.r, L.bottom.g, L.bottom.b]; p.skin = [L.skin.r, L.skin.g, L.skin.b]; p.scale = L.scale; }
  p.yaw = Math.atan2((fz ?? G.player.z) - z, (fx ?? G.player.x) - x);
  G.people.list.push(p); (S.npcs || (S.npcs = [])).push(p);
  return p;
}
const headOf = (G, o, h = 1.58) => ({ x: o.x, y: G.W.surf.height(o.x, o.z) + h, z: o.z });
// a conversation, shot like a film: a wide on the two (or more) of you, then over the shoulder of whoever's
// listening onto whoever's talking, a line at a time. place: where you stand; cast: [[who, side offset]]; lines:
// [[who, mr, en]] (who 'you' is you). The people talk with their hands while they speak
export function dialogueScene(S, place, cast, lines, o = {}) {
  const G = S.g, P = G.player;
  let people = [];
  const sp = (who) => who === 'you' ? P.foot : people.find(q => q.story === who) || people[0];
  const shots = [{ dur: 3.2, enter: () => {
    P.teleportFoot(place.x, place.z, P.foot.yaw, G.traffic);
    const a = o.facing ?? 0;
    people = cast.map(([who, off], i) => { const ang = a + (off ?? (i - (cast.length - 1) / 2) * 0.7); return actor(S, who, place.x + Math.cos(ang) * 1.7, place.z + Math.sin(ang) * 1.7, place.x, place.z); }).filter(Boolean);
    if (people[0]) P.foot.yaw = Math.atan2(people[0].z - P.foot.z, people[0].x - P.foot.x);
  }, cam: () => { const a = (o.facing ?? 0) + Math.PI / 2, c = { x: place.x + Math.cos(a) * 5.2, z: place.z + Math.sin(a) * 5.2 }; return { ...c, y: G.W.surf.height(c.x, c.z) + 2.1, lx: place.x, ly: G.W.surf.height(place.x, place.z) + 1.3, lz: place.z, fov: 46, cut: true }; },
    lines: o.title ? [] : [] }];
  lines.forEach(([who, mr, en], i) => {
    const dur = Math.min(7, 2.6 + (en || mr).length * 0.045);
    shots.push({ dur, enter: (cs) => { const p = sp(who); if (p && p !== P.foot) { p.act = { clip: 'talk', t: 0, dur }; } cs.line(who, mr, en); },
      cam: () => { const p = sp(who), l = who === 'you' ? (people[0] || P.foot) : P.foot, h = headOf(G, p), lh = headOf(G, l);
        const dx = h.x - lh.x, dz = h.z - lh.z, d = Math.hypot(dx, dz) || 1, side = i % 2 ? 1 : -1;
        const c = { x: lh.x - dx / d * 0.9 - dz / d * 0.55 * side, z: lh.z - dz / d * 0.9 + dx / d * 0.55 * side };
        return { ...c, y: lh.y + 0.12, lx: h.x, ly: h.y - 0.05, lz: h.z, fov: 34, cut: true }; } });
  });
  return { title: o.title, sub: o.sub, shots, start: o.start, end: (cs) => { o.end && o.end(cs); } };
}
