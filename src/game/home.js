// Home: काळे सदन, the Kales' house in Sadashiv Peth. An old two-storey Peth house unlike anything else on the
// street: a compound wall with a wrought-iron gate and the name on a marble plate, a paved yard with room for
// one two-wheeler and one car (or your auto), a tulsi vrindavan, a raised veranda (the oti) under carved teak
// pillars, a carved double door with brass studs, windows with wooden shutters and iron grilles, a wooden balcony
// on the first floor, and a Mangalore-tiled roof. Walk up to the door and press F: Aai is inside.
//
// Where: the first free plot on a quiet lane near the middle of Sadashiv Peth (found once, then remembered).
// The yard keeps what you leave in it: park in a bay and it's still there next time you play.
import * as THREE from 'three';
import { ColorBuilder } from '../world/geo.js';
import { Vehicle } from '../vehicles/vehicle.js';

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const lin = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const PW = 16, PD = 22;                         // the plot: 16 m along the lane, 22 m deep
const BAYS = { car: { x: -1.6, z: 5.2, w: 2.7, d: 5.2 }, two: { x: 2.4, z: 4.2, w: 1.3, d: 2.4 } };

export class Home {
  constructor(G) { this.g = G; this.t = 0; this.at = null; this.group = null; }
  get s() { return this.g.life.s; }
  // world <-> the plot's frame (x along the lane, z in from the kerb)
  W(x, z) { const a = this.at; return { x: a.x + a.hx * x + a.nx * z, z: a.z + a.hz * x + a.nz * z }; }
  L(x, z) { const a = this.at, dx = x - a.x, dz = z - a.z; return { x: dx * a.hx + dz * a.hz, z: dx * a.nx + dz * a.nz }; }
  update(dt) {
    const G = this.g;
    if ((this.t -= dt) > 0) return; this.t = 2;
    if (!this.at) this.find();
    if (this.at && !this.group) this.build();
    if (this.group) this.parkTick();
  }
  // a free plot: every point of it off the road, out of any building, not water, beside a quiet lane
  find() {
    const G = this.g, W = G.W, S = W.surf, P = G.player;
    if (this.s.homeAt) { this.at = this.s.homeAt; return; }
    const A = G.people.areas.list.find(a => a.name === 'Sadashiv Peth'); if (!A) return;
    if (Math.hypot(P.x - A.x, P.z - A.z) > 900) return;                 // its streets have to be loaded to look
    const edges = [...W.graph.gridQuery(A.x, A.z, 420)].filter(e => e.rank >= 1 && e.rank <= 3 && e.len > 30);
    edges.sort((a, b) => { const ma = W.graph.at(a, a.len / 2), mb = W.graph.at(b, b.len / 2); return Math.hypot(ma[0] - A.x, ma[1] - A.z) - Math.hypot(mb[0] - A.x, mb[1] - A.z); });
    for (const e of edges.slice(0, 160)) for (const s of [e.len * 0.35, e.len * 0.65]) for (const side of [1, -1]) {
      const t = W.graph.at(e, s), hx = t[2], hz = t[3], nx = hz * side, nz = -hx * side, off = e.w / 2 + 1.6;
      const c = { x: t[0] + nx * off, z: t[1] + nz * off, hx, hz, nx, nz };
      let ok = true;
      for (let i = -PW / 2; i <= PW / 2 && ok; i += 1.6) for (let j = 0.5; j <= PD && ok; j += 1.6) {
        const x = c.x + hx * i + nx * j, z = c.z + hz * i + nz * j;
        if (S.isRoad(x, z) || S.inBuilding(x, z) || S.isWater(x, z)) ok = false;
      }
      if (ok) { this.at = this.s.homeAt = { ...c, x: +c.x.toFixed(2), z: +c.z.toFixed(2) }; this.g.life.save(); return; }
    }
  }
  build() {
    const G = this.g, a = this.at, B = new ColorBuilder(), C = G.W.collision;
    const y0 = G.W.surf.height(a.x + a.nx * PD / 2, a.z + a.nz * PD / 2);
    const ry = Math.atan2(-a.nz, a.nx) + 0;                 // (the plot's frame turned into the world)
    const box = (x, y, z, w, h, d, col, rot = 0) => {
      const p = this.W(x, z), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot, -Math.atan2(a.hz, a.hx), 0, 'YXZ'));
      B.addGeo(UNIT, new THREE.Matrix4().compose(new THREE.Vector3(p.x, y0 + y, p.z), q, new THREE.Vector3(w, h, d)), lin(col));
    };
    void ry;
    const LIME = 0xe8d6a8, OCHRE = 0xd9a85a, TEAK = 0x5a3519, TEAK2 = 0x7a4a22, TILE = 0xa8452a, STONE = 0x8d8778, IRON = 0x1d1f22, BRASS = 0xc9a24a, WHITE = 0xf2efe6;
    // ---- the compound wall, the gate, the name plate
    const wallH = 1.5;
    const wall = (x0, z0, x1, z1) => { const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0); box(mx, wallH / 2, mz, x0 === x1 ? 0.25 : L, wallH, x0 === x1 ? L : 0.25, LIME); box(mx, wallH + 0.04, mz, x0 === x1 ? 0.34 : L + 0.1, 0.08, x0 === x1 ? L + 0.1 : 0.34, STONE); const p0 = this.W(x0, z0), p1 = this.W(x1, z1); C.addSeg(p0.x, p0.z, p1.x, p1.z, 0); };
    wall(-PW / 2, 0.3, -3.2, 0.3); wall(1.4, 0.3, 2.6, 0.3); wall(3.6, 0.3, PW / 2, 0.3);
    wall(-PW / 2, 0.3, -PW / 2, PD); wall(PW / 2, 0.3, PW / 2, PD); wall(-PW / 2, PD, PW / 2, PD);
    for (const x of [-3.35, 1.55, 2.45, 3.75]) { box(x, 0.9, 0.3, 0.45, 1.8, 0.45, LIME); box(x, 1.86, 0.3, 0.55, 0.12, 0.55, STONE); box(x, 2.0, 0.3, 0.22, 0.18, 0.22, OCHRE); }
    // the wrought-iron gate, standing open (two leaves swung in), bars and a scroll band
    for (const [hinge, dir] of [[-3.2, 1], [1.4, -1]]) for (let k = 0; k < 9; k++) { const along = (k + 0.5) * 0.235; box(hinge + dir * 0.18, 0.75, 0.3 + along, 0.03, 1.5, 0.03, IRON); }
    for (const [hinge] of [[-3.2], [1.4]]) { box(hinge + (hinge < 0 ? 0.18 : -0.18), 1.35, 1.36, 0.04, 0.05, 2.12, IRON); box(hinge + (hinge < 0 ? 0.18 : -0.18), 0.2, 1.36, 0.04, 0.05, 2.12, IRON); }
    box(3.1, 0.75, 0.3, 0.9, 1.5, 0.04, IRON);                                // the small gate, shut
    box(-5.8, 1.15, 0.16, 1.1, 0.42, 0.04, 0xf4f1ea);                         // the name plate (marble)
    // ---- the yard: Shahabad stone, the bays painted on it, a tulsi vrindavan, potted plants
    box(0, 0.03, 4.8, PW - 0.6, 0.06, 9, STONE);
    for (let i = -7; i < 8; i += 1) box(i + 0.5, 0.062, 4.8, 0.02, 0.004, 9, 0x6e6a60);
    for (const b of Object.values(BAYS)) { box(b.x - b.w / 2, 0.07, b.z, 0.08, 0.01, b.d, WHITE); box(b.x + b.w / 2, 0.07, b.z, 0.08, 0.01, b.d, WHITE); box(b.x, 0.07, b.z + b.d / 2, b.w, 0.01, 0.08, WHITE); }
    box(5.6, 0.5, 5.2, 0.9, 1.0, 0.9, OCHRE); box(5.6, 1.06, 5.2, 1.0, 0.12, 1.0, LIME); box(5.6, 1.35, 5.2, 0.5, 0.5, 0.5, 0x3f7a2f);      // tulsi
    for (const [x, z] of [[6.8, 8.2], [-6.8, 8.2], [-6.8, 2.2]]) { box(x, 0.25, z, 0.5, 0.5, 0.5, 0xa8452a); box(x, 0.75, z, 0.7, 0.6, 0.7, 0x2f6b2a); }
    C.addCircle(this.W(5.6, 5.2).x, this.W(5.6, 5.2).z, 0.6, 2);
    // ---- the house: plinth, the oti (veranda) under teak pillars, two storeys, balcony, tiled roof
    const hx0 = -6.5, hx1 = 6.5, hz0 = 11, hz1 = 20.5, gf = 3.4, ff = 3.0, plinth = 0.45;
    box(0, plinth / 2, (9 + hz1) / 2, hx1 - hx0 + 0.6, plinth, hz1 - 9 + 0.2, STONE);                 // plinth and the oti
    for (const x of [-0.7, 0.7]) box(x, plinth / 2 - 0.08, 8.6, 1.2, 0.18, 0.5, STONE);                  // the steps up
    for (const x of [-5.6, -2.0, 2.0, 5.6]) { box(x, plinth + gf / 2, 9.4, 0.32, gf, 0.32, TEAK); box(x, plinth + 0.12, 9.4, 0.46, 0.24, 0.46, STONE); box(x, plinth + gf - 0.12, 9.4, 0.48, 0.2, 0.48, TEAK2); }
    box(0, plinth + gf - 0.05, 10.2, hx1 - hx0 + 0.3, 0.12, 2.0, TEAK2);                                 // the veranda's beam and ceiling
    // ground floor walls (lime-washed, an ochre band at the foot)
    box(0, plinth + gf / 2, hz1, hx1 - hx0, gf, 0.3, LIME); box(hx0, plinth + gf / 2, (hz0 + hz1) / 2, 0.3, gf, hz1 - hz0, LIME); box(hx1, plinth + gf / 2, (hz0 + hz1) / 2, 0.3, gf, hz1 - hz0, LIME);
    box(-3.85, plinth + gf / 2, hz0, 5.3, gf, 0.3, LIME); box(3.85, plinth + gf / 2, hz0, 5.3, gf, 0.3, LIME); box(0, plinth + gf - 0.4, hz0, 2.4, 0.8, 0.3, LIME);
    box(0, plinth + 0.35, hz0 - 0.16, hx1 - hx0, 0.7, 0.04, OCHRE);
    // the main door: carved teak, two leaves, brass studs and a brass knocker, a toran over it
    box(0, plinth + 1.3, hz0 - 0.12, 2.4, 2.6, 0.08, TEAK);
    for (const s of [-1, 1]) { box(s * 0.55, plinth + 1.25, hz0 - 0.17, 1.0, 2.4, 0.04, TEAK2); for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(s * (0.25 + j * 0.3), plinth + 0.35 + i * 0.38, hz0 - 0.2, 0.05, 0.05, 0.03, BRASS); }
    for (let i = 0; i < 9; i++) box(-1.0 + i * 0.25, plinth + 2.55, hz0 - 0.22, 0.09, 0.16, 0.02, i % 2 ? 0xf2a12a : 0x2f7a2a);      // mango-leaf toran
    // windows: wooden frames, shutters folded open, iron grilles (ground floor and first floor)
    const win = (x, y, z, face) => { box(x, y, z + face * 0.17, 1.3, 1.5, 0.06, TEAK); box(x, y, z + face * 0.2, 1.1, 1.3, 0.02, 0x23262a); for (let k = 0; k < 6; k++) box(x - 0.5 + k * 0.2, y, z + face * 0.22, 0.025, 1.3, 0.025, IRON); for (const s of [-1, 1]) box(x + s * 0.95, y, z + face * 0.25, 0.55, 1.4, 0.04, 0x2f5d3a); };
    for (const x of [-4.6, 4.6]) win(x, plinth + 1.6, hz0, -1);
    // first floor
    const f0 = plinth + gf;
    box(0, f0 + 0.08, (hz0 + hz1) / 2, hx1 - hx0 + 0.4, 0.16, hz1 - hz0 + 0.4, STONE);
    box(0, f0 + ff / 2, hz1, hx1 - hx0, ff, 0.3, OCHRE); box(hx0, f0 + ff / 2, (hz0 + hz1) / 2, 0.3, ff, hz1 - hz0, OCHRE); box(hx1, f0 + ff / 2, (hz0 + hz1) / 2, 0.3, ff, hz1 - hz0, OCHRE);
    box(0, f0 + ff / 2, hz0, hx1 - hx0, ff, 0.3, OCHRE);
    for (const x of [-4.2, -1.4, 1.4, 4.2]) win(x, f0 + 1.5, hz0, -1);
    // the wooden balcony: a deck on brackets, carved balusters, a rail, a little roof of its own
    box(0, f0 + 0.1, 9.9, 10.4, 0.12, 1.9, TEAK2);
    for (let i = 0; i < 6; i++) box(-5 + i * 2, f0 - 0.25, 10.3, 0.12, 0.5, 0.6, TEAK, 0.6);
    for (let i = 0; i < 41; i++) { const x = -5.1 + i * 0.255; box(x, f0 + 0.55, 8.98, 0.07, 0.8, 0.07, TEAK); }
    for (const x of [-5.15, 5.15]) for (let i = 0; i < 7; i++) box(x, f0 + 0.55, 9.1 + i * 0.26, 0.07, 0.8, 0.07, TEAK);
    box(0, f0 + 0.98, 8.98, 10.4, 0.08, 0.12, TEAK2); box(0, f0 + 0.2, 8.98, 10.4, 0.06, 0.1, TEAK2);
    for (const x of [-5.1, 5.1]) box(x, f0 + 1.35, 9.0, 0.14, 2.5, 0.14, TEAK);
    box(0, f0 + 2.65, 9.6, 10.8, 0.08, 1.8, TILE, -0.28);
    // the roof: Mangalore tiles in two slopes and the ridge, the gable ends filled
    const rf = f0 + ff, rise = 2.0, run = (hz1 - hz0) / 2 + 0.7, slope = Math.atan2(rise, run), L = Math.hypot(rise, run);
    for (const s of [-1, 1]) {
      const zc = (hz0 + hz1) / 2 + s * run / 2;
      box(0, rf + rise / 2, zc, hx1 - hx0 + 1.2, 0.12, L, TILE, s * slope);
      // tile courses: a darker line every row down the slope
      for (let i = 1; i < 12; i++) { const t = i / 12 - 0.5; box(0, rf + rise / 2 + (s > 0 ? -1 : 1) * t * rise + 0.075, zc + t * run, hx1 - hx0 + 1.2, 0.025, 0.06, 0x8a3520, s * slope); }
    }
    box(0, rf + rise + 0.06, (hz0 + hz1) / 2, hx1 - hx0 + 1.3, 0.16, 0.3, 0x7a2e1a);
    // the gable ends, filled in steps up to the ridge
    for (const x of [hx0, hx1]) for (let k = 0; k < 6; k++) { const f = (k + 0.5) / 6; box(x, rf + f * rise, (hz0 + hz1) / 2, 0.3, rise / 6 + 0.02, (hz1 - hz0) * (1 - f) + 0.1, OCHRE); }
    // a little electricity meter box by the door, a doorbell, the house number
    box(-1.7, plinth + 1.6, hz0 - 0.18, 0.4, 0.5, 0.12, 0x3a3d42); box(1.45, plinth + 1.3, hz0 - 0.17, 0.08, 0.1, 0.03, WHITE);
    // collision: the house, the oti's front edge (steps in the middle)
    const corners = [[hx0 - 0.15, hz0 - 0.15], [hx1 + 0.15, hz0 - 0.15], [hx1 + 0.15, hz1 + 0.15], [hx0 - 0.15, hz1 + 0.15]].map(([x, z]) => this.W(x, z));
    C.addRing(corners.flatMap(p => [p.x, p.z]), 0);
    for (const x of [-5.6, -2.0, 2.0, 5.6]) { const p = this.W(x, 9.4); C.addCircle(p.x, p.z, 0.3, 0); }
    const geo = B.build(), m = new THREE.Mesh(geo, G.W.mats.prop); m.castShadow = true; m.receiveShadow = true;
    const g = this.group = new THREE.Group(); g.name = 'home'; g.add(m);
    // the name on the plate: काळे सदन
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const x = cv.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 512, 192); x.strokeStyle = '#b89b5a'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 172);
    x.fillStyle = '#3a2a1a'; x.font = '800 86px Mukta, "Noto Sans Devanagari", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('काळे सदन', 256, 86); x.font = '600 30px Inter, sans-serif'; x.fillText('KALE SADAN · 1187', 256, 152);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.39), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
    const pp = this.W(-5.8, 0.13); plate.position.set(pp.x, y0 + 1.15, pp.z); plate.rotation.y = -Math.atan2(a.hz, a.hx) + Math.PI;
    g.add(plate);
    G.scene.add(g);
    // the door you go in by (F)
    this.door = this.W(0, 10.3);
    this.restoreParked();
  }
  // ---- the door
  near(x, z) { const d = this.door; if (!d || Math.hypot(d.x - x, d.z - z) > 1.8) return null; return { kind: 'homeDoor', name: 'Home', x: d.x, z: d.z }; }
  use() {
    const G = this.g;
    if (G.interiors && G.interiors.enter({ kind: 'home', name: 'काळे सदन', x: this.door.x, z: this.door.z, home: true })) return;
    G.hud.toast('Home', 'Aai’s inside', 'info', 2);
  }
  // ---- the yard: what you leave in a bay stays
  bayOf(v) {
    const p = this.L(v.x, v.z);
    for (const [k, b] of Object.entries(BAYS)) if (Math.abs(p.x - b.x) < b.w / 2 + 0.6 && Math.abs(p.z - b.z) < b.d / 2 + 0.8) return k;
    return null;
  }
  parkTick() {
    const G = this.g, P = G.player, out = [];
    for (const d of P.dropped) {
      const v = d.veh, bay = this.bayOf(v); if (!bay) continue;
      const two = !!(v.spec && v.spec.two);
      if ((bay === 'two') !== two && !(bay === 'car' && !two)) continue;
      if (out.some(q => q.bay === bay)) continue;
      out.push({ bay, auto: v === P.auto, type: v.type, col: v.paint || null, plate: v.plate || '', owned: v.owned ? v.owned.id : null, th: v.th || 0 });
    }
    const was = JSON.stringify(this.s.homeParked || []), now = JSON.stringify(out);
    if (was !== now) {
      const had = (this.s.homeParked || []).map(q => q.bay);
      for (const q of out) if (!had.includes(q.bay)) G.hud.toast('Parked at home', q.bay === 'two' ? 'It’ll be here in the yard' : 'Safe in the yard', 'good', 2);
      this.s.homeParked = out; this.g.life.save();
    }
  }
  restoreParked() {
    const G = this.g, P = G.player, list = this.s.homeParked || [];
    for (const q of list) {
      const b = BAYS[q.bay], p = this.W(b.x, b.z), th = Math.atan2(this.at.nz, this.at.nx);
      if (q.auto) { P.moveAuto(p.x, p.z, th, G.traffic); continue; }
      if (P.dropped.some(d => d.veh.plate === q.plate && q.plate)) continue;
      try {
        const own = q.owned && this.s.vehicles.find(v => v.id === q.owned);
        if (own && G.shops.respawnOwned) { G.shops.respawnOwned(own, { x: p.x, z: p.z, th }); continue; }
        const v = new Vehicle(G.W, G.scene, G.vmats, q.type, q.col || undefined); v.reset(p.x, p.z, th); v.y = G.W.surf.height(p.x, p.z); v.plate = q.plate; v.fuel = 1; P.addDropped(v, G.traffic);
      } catch (e) { /* keep going */ }
    }
  }
  // where the story's "home" is
  spot() { return this.door ? { x: this.door.x, z: this.door.z } : null; }
}
