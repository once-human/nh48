// Walking into a shop: you go inside a real room, not a menu. Each kind of place has its own room,
// built once (procedurally, from its kind) and reused for every shop of that kind:
//   eatery   a counter with the keeper, a menu board with today's prices, steel tables: order at
//            the counter, sit at a table (F) and your plate comes; or ask for a parcel
//   café     a glass counter, wooden tables, plants, warm light
//   club     a dark room, a dance floor that pulses, a DJ, a bar, people dancing: dance, drink,
//            talk to someone (they may dance with you, give you their number, agree to a date)
//   salon    chairs and mirrors: sit in a chair and the barber does what you ask
//   boutique racks of clothes by type, a mirror, a trial room
//   bank     counters behind glass, a token machine, an ATM
//   shop     shelves and a counter (pharmacy, kirana, mobile, books...), plus a gym floor,
//            a showroom with real vehicles on display, a clinic, a lodge, a chowki
// Rooms sit far outside the city (one slot per kind) with their own walls in the collision
// grid, so walking and the camera work exactly as outside. Inside, the people are the same
// pooled bodies as on the street (keeper, customers, dancers).
import * as THREE from 'three';
import { ColorBuilder } from './geo.js';
import { RNG } from '../core/util.js';
import { F, MENUS, AREA_FOOD } from '../game/shops.js';
import { Vehicle } from '../vehicles/vehicle.js';

const SLOT0 = 40000;
const FLOOR = 0.15;          // the game's off-road ground height, so people stand on the floor
const TEMPLATE = {
  tapri: 'eatery', misal: 'eatery', thali: 'eatery', biryani: 'eatery', southindian: 'eatery', chinese: 'eatery', fastfood: 'eatery', food: 'eatery',
  cafe: 'cafe', bakery: 'cafe', sweets: 'cafe', juice: 'cafe', icecream: 'cafe',
  bar: 'club', barber: 'salon', clothes: 'boutique', shoes: 'boutique', optician: 'boutique', bank: 'bank',
  pharmacy: 'shop', kirana: 'shop', mobile: 'shop', electronics: 'shop', books: 'shop', florist: 'shop', paan: 'shop', jeweller: 'shop',
  clinic: 'clinic', gym: 'gym', dealer: 'showroom', lodge: 'lodge', chowki: 'chowki', estate: 'office',
};
// room size (w across, d deep, h tall), floor, walls, accent
const ROOM = {
  eatery: [10, 8.5, 3.4, 0xd9d2c4, 0xe9e0c8, 0x2e7d4f], cafe: [9, 7.5, 3.3, 0x8a6a4d, 0xefe6d6, 0x6b4a2e], club: [16, 13, 4.8, 0x15141a, 0x1c1a24, 0x7d2fff],
  salon: [8, 6.5, 3.2, 0xe8e8e8, 0xf2efe9, 0x2b5d8a], boutique: [11, 8, 3.4, 0xd8cfc0, 0xf4f0ea, 0x8e5572], bank: [11, 8.5, 3.6, 0xcfd3d6, 0xe9ecef, 0x1d4e89],
  shop: [7.5, 6.5, 3.2, 0xd0c8b8, 0xece6d8, 0x2a9d8f], clinic: [9, 7, 3.2, 0xe6ece9, 0xf3f7f5, 0x2e8b6e], gym: [12, 9, 3.8, 0x2b2b2e, 0x3a3d42, 0xe0b23a],
  showroom: [18, 13, 5, 0xe8e8ea, 0xf6f6f7, 0xbf3f3a], lodge: [8, 7, 3.2, 0x8a5a3c, 0xe8dcc4, 0x7a2e2e], chowki: [8, 7, 3.2, 0xb8b0a0, 0xd9d2bf, 0x6b5a36], office: [8, 7, 3.2, 0xc8c2b6, 0xf0ece4, 0x3d405b],
};
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export class Interiors {
  constructor(G) {
    this.g = G; this.rng = new RNG(9090);
    this.rooms = {}; this.cur = null;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.spots = [];
  }
  templateOf(kind) { return TEMPLATE[kind] || null; }

  // ---------------------------------------------------------------- building a room
  room(tpl, slotKey) {
    const key = slotKey || tpl;
    if (this.rooms[key]) return this.rooms[key];
    const idx = Object.keys(this.rooms).length;
    const O = { x: SLOT0 + idx * 120, z: SLOT0 };
    const [W, D, H, floor, wall, accent] = ROOM[tpl];
    const B = new ColorBuilder(), GL = new ColorBuilder(), C = this.g.W.collision;
    const box = (b, cx, cy, cz, sx, sy, sz, col, ry = 0) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(O.x + cx, cy + FLOOR, O.z + cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
      b.addGeo(UNIT, m, hex(col));
    };
    const solid = (cx, cz, sx, sz) => { const x0 = O.x + cx - sx / 2, x1 = O.x + cx + sx / 2, z0 = O.z + cz - sz / 2, z1 = O.z + cz + sz / 2; C.addRing([x0, z0, x1, z0, x1, z1, x0, z1], 0); };
    // shell: floor, ceiling, four walls (a door gap in the front wall), skirting
    box(B, 0, -0.05, D / 2, W, 0.1, D, floor);
    box(B, 0, H + 0.05, D / 2, W, 0.1, D, tpl === 'club' ? 0x0c0b10 : 0xf4f2ee);
    box(B, -W / 2 - 0.1, H / 2, D / 2, 0.2, H, D, wall); box(B, W / 2 + 0.1, H / 2, D / 2, 0.2, H, D, wall);
    box(B, 0, H / 2, D + 0.1, W, H, 0.2, wall);
    box(B, -W / 4 - 0.45, H / 2, -0.1, W / 2 - 0.9, H, 0.2, wall); box(B, W / 4 + 0.45, H / 2, -0.1, W / 2 - 0.9, H, 0.2, wall);
    box(B, 0, H - 0.45, -0.1, 1.8, 0.9, 0.2, wall);
    box(B, 0, 1.2, -0.16, 1.8, 2.4, 0.04, 0xbcd7e6);                // glass door, the street glow behind it
    for (const s of [-1, 1]) box(B, s * W / 2, 0.06, D / 2, 0.04, 0.12, D, accent);
    box(B, 0, 0.06, D, W, 0.12, 0.04, accent);
    C.addLine([O.x - W / 2, O.z, O.x - W / 2, O.z + D, O.x + W / 2, O.z + D, O.x + W / 2, O.z], 0);
    C.addSeg(O.x - W / 2, O.z, O.x - 0.9, O.z, 0); C.addSeg(O.x + 0.9, O.z, O.x + W / 2, O.z, 0);
    C.addSeg(O.x - 0.9, O.z - 0.05, O.x + 0.9, O.z - 0.05, 0);       // you leave through F at the door, not by walking out
    // tube lights (the Pune shop classic), or club strips
    const nL = Math.max(2, Math.round(W / 4));
    for (let i = 0; i < nL; i++) {
      const x = -W / 2 + (i + 0.5) * W / nL;
      if (tpl === 'club') box(GL, x, H - 0.02, D / 2, 0.08, 0.04, D * 0.8, [0xff2f7d, 0x2f7dff, 0x7d2fff, 0xffb02f][i % 4]);
      else box(GL, x, H - 0.03, D / 2, 0.12, 0.05, 1.4, 0xfffbf0);
    }
    const R = { tpl, O, W, D, H, spots: [], seats: [], people: [], dyn: [], props: [] };
    const spot = (x, z, r, kind, label, extra) => R.spots.push({ x: O.x + x, z: O.z + z, r, kind, label, ...extra });
    spot(0, 0.6, 1.2, 'exit', 'Go back outside');
    const counter = (x, z, w, d, col) => { box(B, x, 0.5, z, w, 1.0, d, col); box(B, x, 1.02, z, w + 0.08, 0.05, d + 0.08, 0x3b3b3e); solid(x, z, w, d); };
    const table = (x, z, top, steel) => {
      box(B, x, 0.74, z, 0.95, 0.05, 0.75, top);
      for (const [a, b] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) box(B, x + a, 0.36, z + b, 0.05, 0.72, 0.05, steel ? 0xb8bcc2 : 0x4a3626);
      C.addCircle(O.x + x, O.z + z, 0.5, 2);
      for (const s of [-1, 1]) {           // two chairs, either side
        const cz = z + s * 0.75;
        box(B, x, 0.45, cz, 0.45, 0.05, 0.45, steel ? 0xc8ccd2 : 0x6b4a2e);
        box(B, x, 0.75, cz + s * 0.22, 0.45, 0.6, 0.05, steel ? 0xc8ccd2 : 0x6b4a2e);
        for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(B, x + a, 0.22, cz + b, 0.04, 0.44, 0.04, 0x55585e);
        R.seats.push({ x: O.x + x, z: O.z + cz, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, table: { x: O.x + x, z: O.z + z }, used: false });
      }
    };
    const shelf = (x, z, w, rot, n = 4) => {
      box(B, x, 1.1, z, rot ? 0.45 : w, 2.2, rot ? w : 0.45, 0x8a7a66);
      for (let r = 0; r < n; r++) for (let k = 0; k < 6; k++) {
        const t = (k + 0.5) / 6 - 0.5, c = [0xd1495b, 0xf4d58d, 0x2e86ab, 0x7a9e7e, 0xf28f3b, 0xffffff, 0x3d405b, 0xe9cf7a][(r * 7 + k * 3) % 8];
        if (rot) box(B, x - 0.05, 0.35 + r * 0.5, z + t * w * 0.9, 0.3, 0.32, w / 7, c); else box(B, x + t * w * 0.9, 0.35 + r * 0.5, z - 0.05, w / 7, 0.32, 0.3, c);
      }
      solid(x, z, rot ? 0.45 : w, rot ? w : 0.45);
    };
    const kp = (x, z, yaw, anim, role) => R.people.push({ x: O.x + x, z: O.z + z, yaw, anim, role });

    if (tpl === 'eatery' || tpl === 'cafe') {
      const cafe = tpl === 'cafe';
      counter(0, D - 1.6, W * 0.55, 0.8, cafe ? 0x6b4a2e : 0x9aa0a6);
      if (cafe) box(GL, 0, 1.25, D - 1.6, W * 0.5, 0.4, 0.6, 0xfff1d6);    // lit display case
      kp(0, D - 0.8, -Math.PI / 2, 'idle', 'keeper');
      spot(0, D - 2.4, 1.3, 'counter', cafe ? 'Order at the counter' : 'Order at the counter');
      const cols = cafe ? [-2.6, 2.6] : [-3, 0, 3];
      for (const x of cols) for (const z of cafe ? [2.2] : [2.0, 4.1]) table(x, z, cafe ? 0x7a5236 : 0xc8ccd2, !cafe);
      if (cafe) for (const x of [-W / 2 + 0.6, W / 2 - 0.6]) box(B, x, 0.5, 0.8, 0.5, 1.0, 0.5, 0x3f7a52);     // plants
      // the menu board, today's prices
      R.board = { x: 0, y: 2.4, z: D - 0.02, w: 3.2, h: 1.1 };
      // a couple of customers already eating
      R.customers = 3;
    } else if (tpl === 'club') {
      counter(-W / 2 + 1.6, D / 2 + 1, 1.0, 6, 0x2a2633);
      box(GL, -W / 2 + 1.15, 1.3, D / 2 + 1, 0.05, 0.08, 6, 0xff2f7d);
      kp(-W / 2 + 0.7, D / 2 + 1, 0, 'idle', 'keeper');
      spot(-W / 2 + 2.6, D / 2 + 1, 1.6, 'bar', 'Order at the bar');
      // the dance floor: tiles that pulse with the beat
      for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 1.15), new THREE.MeshBasicMaterial({ color: 0x220033, toneMapped: false }));
        g.position.set(O.x + 1.2 + (i - 2) * 1.2, FLOOR + 0.02, O.z + 4.5 + j * 1.2);
        R.dyn.push(g);
      }
      box(B, 1.2, 0.6, D - 1.2, 3, 1.2, 1, 0x101014); box(GL, 1.2, 1.22, D - 1.2, 2.6, 0.04, 0.6, 0x2f7dff); solid(1.2, D - 1.2, 3, 1);
      kp(1.2, D - 0.4, -Math.PI / 2, 'dance', 'dj');
      spot(1.2, 6.3, 2.6, 'dance', 'Dance');
      R.dancers = 8;
    } else if (tpl === 'salon') {
      for (const x of [-2, 1.2]) {
        box(B, x, 0.5, D - 0.9, 0.7, 0.12, 0.7, 0x1b1c1f); box(B, x, 0.9, D - 0.6, 0.7, 0.8, 0.12, 0x1b1c1f); box(B, x, 0.25, D - 0.9, 0.2, 0.5, 0.2, 0x8e9093);
        box(B, x, 1.7, D - 0.05, 1.1, 1.3, 0.04, 0xbcd0dc);   // mirror
        R.seats.push({ x: O.x + x, z: O.z + D - 0.9, yaw: Math.PI / 2, salon: true, used: false });
        spot(x, D - 1.9, 1.0, 'chair', 'Sit in the chair');
      }
      kp(-0.4, D - 1.6, Math.PI / 2, 'idle', 'keeper');
      box(B, -W / 2 + 0.4, 0.45, 2.2, 0.6, 0.45, 2.6, 0x6b4a2e);    // waiting bench
      R.customers = 1;
    } else if (tpl === 'boutique') {
      const racks = [[-3.2, 3.2, 'Shirts and tees', 'tops'], [0, 3.2, 'Trousers and jeans', 'bottoms'], [3.2, 3.2, 'Kurtas and sarees', 'ethnic']];
      for (const [x, z, label, sub] of racks) {
        box(B, x, 1.55, z, 2.2, 0.04, 0.04, 0x8e9093);
        for (let k = 0; k < 8; k++) box(B, x - 0.95 + k * 0.27, 1.0, z, 0.06, 1.0, 0.5, [0xf2f0ea, 0x8fb3d9, 0x1f2024, 0xbf3f3a, 0xe0b23a, 0x2f5d45, 0xd1495b, 0x7b2cbf][(k + Math.round(x)) & 7]);
        C.addCircle(O.x + x, O.z + z, 1.0, 2);
        spot(x, z - 1.2, 1.1, 'rack', label, { sub });
      }
      box(B, W / 2 - 0.05, 1.4, D - 2, 0.04, 2.2, 1.2, 0xbcd0dc);
      spot(W / 2 - 1.0, D - 2, 1.0, 'mirror', 'Look in the mirror');
      counter(-W / 2 + 1.5, D - 1, 1.6, 0.7, 0x6b4a2e);
      kp(-W / 2 + 1.5, D - 0.4, -Math.PI / 2, 'idle', 'keeper');
      spot(-W / 2 + 1.5, D - 2, 1.1, 'counter', 'Shoes at the counter');
      R.customers = 2;
    } else if (tpl === 'bank') {
      counter(0, D - 2, W * 0.7, 0.8, 0xbfc5ca);
      box(B, 0, 1.75, D - 2, W * 0.7, 1.4, 0.04, 0xcfe2ec);   // glass partition
      for (const x of [-2.5, 0, 2.5]) kp(x, D - 1.3, -Math.PI / 2, 'idle', x === 0 ? 'keeper' : 'teller');
      spot(0, D - 3, 1.4, 'counter', 'Go to the counter');
      box(B, W / 2 - 0.5, 1.0, 1.6, 0.7, 2.0, 0.7, 0x2b3550); box(GL, W / 2 - 0.86, 1.4, 1.6, 0.02, 0.4, 0.5, 0x7fd6ff); solid(W / 2 - 0.5, 1.6, 0.7, 0.7);
      spot(W / 2 - 1.4, 1.6, 1.0, 'atm', 'Use the ATM');
      R.customers = 3;
    } else if (tpl === 'gym') {
      for (let i = 0; i < 4; i++) { box(B, -4 + i * 2.6, 0.5, 4.5, 1.6, 1.0, 0.6, 0x1b1c1f); box(B, -4 + i * 2.6, 1.05, 4.5, 1.8, 0.06, 0.06, 0xb8bcc2); C.addCircle(O.x - 4 + i * 2.6, O.z + 4.5, 0.8, 2); }
      box(B, 0, 0.02, 2.2, W * 0.8, 0.04, 1.8, 0x2f2f33);
      spot(-1.4, 3.3, 1.4, 'workout', 'Work out');
      spot(W / 2 - 1.4, D - 1.4, 1.2, 'counter', 'Front desk');
      counter(W / 2 - 1.4, D - 0.6, 1.6, 0.6, 0xe0b23a);
      kp(W / 2 - 1.4, D - 0.25, -Math.PI / 2, 'idle', 'keeper');
      R.lifters = 3;
    } else if (tpl === 'showroom') {
      R.display = [[-5, 6], [0, 6], [5, 6]];
      for (const [x, z] of R.display) { box(B, x, 0.06, z, 4.6, 0.12, 2.8, 0xd9d9dc); spot(x, z - 2.2, 1.6, 'vehicle', 'Look at this one'); C.addCircle(O.x + x, O.z + z, 1.6, 0); }
      counter(W / 2 - 2, D - 1.2, 2.2, 0.8, 0x2b2b2e);
      kp(W / 2 - 2, D - 0.5, -Math.PI / 2, 'idle', 'keeper');
      spot(W / 2 - 2, D - 2.1, 1.2, 'counter', 'Talk to the salesman');
    } else {
      // shop / clinic / lodge / chowki / office: shelves or chairs and a counter or desk
      counter(0, D - 1.6, W * 0.5, 0.8, tpl === 'chowki' ? 0x6b5a36 : tpl === 'lodge' ? 0x6b3a26 : 0x9aa0a6);
      kp(0, D - 0.8, -Math.PI / 2, 'idle', 'keeper');
      spot(0, D - 2.5, 1.4, 'counter', tpl === 'clinic' ? 'See the doctor' : tpl === 'lodge' ? 'Reception' : tpl === 'chowki' ? 'Talk to the havaldar' : 'At the counter');
      if (tpl === 'shop') { shelf(-W / 2 + 0.3, D / 2, D * 0.7, true); shelf(W / 2 - 0.3, D / 2, D * 0.7, true); }
      if (tpl === 'clinic' || tpl === 'chowki' || tpl === 'office') for (let i = 0; i < 4; i++) box(B, -W / 2 + 0.4, 0.45, 1.5 + i * 0.7, 0.5, 0.45, 0.55, 0x2b5d8a);
      R.customers = tpl === 'shop' ? 1 : 2;
    }
    const mesh = new THREE.Mesh(B.build(), this.mat); mesh.receiveShadow = false; mesh.castShadow = false;
    const glow = GL.empty ? null : new THREE.Mesh(GL.build(), this.glowMat);
    const grp = new THREE.Group(); grp.add(mesh); if (glow) grp.add(glow); for (const d of R.dyn) grp.add(d);
    grp.visible = false;
    this.g.scene.add(grp);
    R.group = grp;
    this.rooms[key] = R;
    return R;
  }
  // today's menu, painted on the board behind the counter
  paintBoard(R, ctx) {
    if (!R.board) return;
    const ids = MENUS[ctx.kind] || AREA_FOOD[this.areaKind(ctx)] || MENUS.misal;
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 352;
    const x = cv.getContext('2d');
    x.fillStyle = '#16301f'; x.fillRect(0, 0, 1024, 352);
    x.strokeStyle = '#c9b77a'; x.lineWidth = 8; x.strokeRect(8, 8, 1008, 336);
    x.fillStyle = '#f4ecd0'; x.font = '700 46px Archivo, Inter, sans-serif'; x.textAlign = 'center';
    x.fillText(ctx.name.slice(0, 34), 512, 64);
    x.font = '600 30px Inter, sans-serif'; x.textAlign = 'left';
    const mul = this.g.shops.priceMul(ctx.x, ctx.z);
    ids.slice(0, 8).forEach((id, i) => {
      const f = F[id]; if (!f) return;
      const col = i % 2, row = Math.floor(i / 2);
      const px = 50 + col * 490, py = 130 + row * 52;
      x.fillStyle = '#f4ecd0'; x.fillText(f[0], px, py);
      x.fillStyle = '#f2c230'; x.textAlign = 'right'; x.fillText('₹' + Math.max(10, Math.round(f[2] * mul / 10) * 10), px + 440, py); x.textAlign = 'left';
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    if (!R.boardMesh) {
      R.boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(R.board.w, R.board.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      R.boardMesh.position.set(R.O.x + R.board.x, R.board.y + FLOOR, R.O.z + R.board.z); R.boardMesh.rotation.y = Math.PI;
      R.group.add(R.boardMesh);
    } else { R.boardMesh.material.map.dispose(); R.boardMesh.material.map = tex; }
  }
  areaKind(ctx) { const a = this.g.people.areas.at(ctx.x, ctx.z); return a ? a.kind : 'city'; }

  // ---------------------------------------------------------------- going in and out
  enter(ctx) {
    const G = this.g, P = G.player, tpl = this.templateOf(ctx.kind);
    if (!tpl || !P.onFoot) return false;
    const R = this.room(tpl);
    this.cur = { R, ctx, door: { x: P.x, z: P.z, yaw: P.th }, plate: null, seat: null, dancing: false, talk: null };
    R.group.visible = true;
    this.paintBoard(R, ctx);
    this.populate(R, ctx);
    if (R.display) this.showVehicles(R);
    P.teleportFoot(R.O.x, R.O.z + 1.3, Math.PI / 2, G.traffic);
    G.rig.footMode = false;              // the camera cuts inside (no 40 km swoop)
    G.rig.update(0.016, P); G.rig.footYaw = Math.PI / 2; G.rig.footPitch = 0.12;
    G.camera.far = 80; G.camera.updateProjectionMatrix();
    G.hud.enterPlace?.(ctx);
    if (G.crowd) { this.capWas = G.crowd.cap; G.crowd.cap = Math.max(G.crowd.cap, 14); }
    G.audio.duck?.(0.2, 2);
    if (tpl === 'club') G.club.beat(true);
    const hello = G.shops.hello(ctx.kind);
    if (hello) G.hud.say(tpl === 'club' ? 'Bouncer' : 'Keeper', hello[0], hello[1], 3.5);
    return true;
  }
  exit() {
    const G = this.g, P = G.player, C = this.cur;
    if (!C) return;
    if (C.seat) this.stand();
    for (const p of C.R.peds || []) G.people.remove(p);
    C.R.peds = [];
    C.R.group.visible = false;
    if (C.R.shown) { for (const v of C.R.shown) v.dispose(); C.R.shown = null; }
    if (C.R.tpl === 'club') G.club.beat(false);
    // back out of the door, facing the street
    const d = C.door, back = d.yaw + Math.PI;
    P.teleportFoot(d.x + Math.cos(back) * 0.6, d.z + Math.sin(back) * 0.6, back, G.traffic);
    G.rig.footMode = false; G.rig.update(0.016, P); G.rig.footYaw = back;
    G.camera.far = G.farWas || G.camera.far; G.camera.far = G.quality.far || 2200; G.camera.updateProjectionMatrix();
    if (G.crowd && this.capWas) G.crowd.cap = this.capWas;
    this.cur = null;
    G.hud.leavePlace?.();
    G.shops.scanT = 0.5;
  }
  get inside() { return !!this.cur; }

  // the keeper, customers and dancers: pooled street bodies, dressed for the area
  populate(R, ctx) {
    const G = this.g, ppl = G.people, kit = G.W.kit, rng = this.rng;
    R.peds = [];
    const make = (x, z, yaw, anim, female, opts = {}) => {
      const e = G.W.graph.edges[0];
      const p = ppl.make(e, 1, 1, { female, mode: 'fixed', adult: true });
      p.fixed = true; p.mode = 'fixed'; p.interior = true; p.x = x; p.z = z; p.yaw = yaw; p.hx = Math.cos(yaw); p.hz = Math.sin(yaw);
      p.anim = anim; p.idle = anim; p.onRoad = false;
      p.persona = opts.persona || ppl.pickPersona(female, ctx.x, ctx.z);
      if (kit) {
        p.look = opts.police ? kit.randomLook(new RNG(p.id), { role: 'police' }) : kit.randomLook(new RNG(p.id), { female, dress: /^kp|college/.test(p.persona) ? 'modern' : undefined });
        p.shirt = [p.look.top.r, p.look.top.g, p.look.top.b]; p.lower = [p.look.bottom.r, p.look.bottom.g, p.look.bottom.b]; p.skin = [p.look.skin.r, p.look.skin.g, p.look.skin.b];
      }
      R.peds.push(p);
      return p;
    };
    for (const k of R.people) make(k.x, k.z, k.yaw, k.anim, k.role === 'teller' ? rng.chance(0.6) : rng.chance(0.25), { police: R.tpl === 'chowki' && k.role === 'keeper' });
    for (const s of R.seats) s.used = false;
    // customers at tables, eating and chatting
    const free = R.seats.filter(s => !s.salon);
    for (let i = 0; i < (R.customers || 0) && free.length; i++) {
      const s = free.splice(rng.int(0, free.length - 1), 1)[0];
      if (s) { s.used = true; make(s.x, s.z, s.yaw, rng.pick(['sit', 'sit_talk']), rng.chance(0.4)); }
      else make(R.O.x + rng.range(-R.W / 3, R.W / 3), R.O.z + rng.range(1.8, R.D - 3), rng.range(0, 6.28), 'idle', rng.chance(0.45));
    }
    if (!free.length && R.customers && !R.seats.length) for (let i = 0; i < R.customers; i++) make(R.O.x + rng.range(-R.W / 3, R.W / 3), R.O.z + rng.range(1.8, R.D - 2.6), rng.range(0, 6.28), rng.pick(['idle', 'phone']), rng.chance(0.45));
    // a full dance floor (busier late), people at the bar
    if (R.dancers) {
      const n = Math.round(R.dancers * (G.hour > 22 || G.hour < 2 ? 1.3 : 0.8));
      for (let i = 0; i < n; i++) {
        const p = make(R.O.x + 1.2 + rng.range(-2.6, 2.6), R.O.z + 4.6 + rng.range(0, 3.4), rng.range(0, 6.28), 'dance', rng.chance(0.5));
        p.dancer = true; p.name = rng.pick(p.female ? FEM : MALE);
      }
      for (let i = 0; i < 3; i++) make(R.O.x - R.W / 2 + 2.4, R.O.z + R.D / 2 - 1 + i * 1.1, Math.PI, rng.pick(['drink', 'talk', 'idle']), rng.chance(0.4)).name = rng.pick(FEM.concat(MALE));
    }
    if (R.lifters) for (let i = 0; i < R.lifters; i++) make(R.O.x - 4 + i * 2.6, R.O.z + 3.8, Math.PI / 2, rng.pick(['crouch', 'push', 'idle']), rng.chance(0.3));
  }
  showVehicles(R) {
    const G = this.g, types = ['scooter', 'hatch', 'suv'];
    R.shown = R.display.map(([x, z], i) => {
      const v = new Vehicle(G.W, G.scene, G.vmats, types[i], [[0.78, 0.1, 0.1], [0.92, 0.92, 0.9], [0.1, 0.12, 0.16]][i]);
      v.reset(R.O.x + x, R.O.z + z, Math.PI * 0.85); v.y = FLOOR + 0.12; v.sync && v.sync(0);
      v.showType = types[i];
      return v;
    });
  }

  // ---------------------------------------------------------------- what F does in here
  near(x, z) {
    const C = this.cur;
    if (!C) return null;
    let best = null, bd = 1e9;
    for (const s of C.R.spots) { const d = Math.hypot(s.x - x, s.z - z); if (d < s.r && d < bd) { bd = d; best = s; } }
    // a free seat at a table (to eat what you ordered), or someone to talk to
    if (!best && C.R.seats.length) for (const s of C.R.seats) { if (s.used || s.salon) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < 1.1 && d < bd) { bd = d; best = { kind: 'seat', seat: s, label: C.plate ? `Sit down and eat your ${C.plate.name.toLowerCase()}` : 'Sit down' }; } }
    if (!best && C.R.peds) for (const p of C.R.peds) { if (!p.dancer && !p.name) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < 1.4 && d < bd) { bd = d; best = { kind: 'talk', p, label: `Talk to ${p.name}` }; } }
    if (C.seat) best = { kind: 'stand', label: C.eating ? 'Eating…' : 'Get up' };
    if (C.dancing) best = { kind: 'undance', label: 'Stop dancing' };
    return best;
  }
  label(s) { return s.label; }
  use(s) {
    const G = this.g, C = this.cur, P = G.player, ctx = C.ctx;
    switch (s.kind) {
      case 'exit': this.exit(); return;
      case 'counter': case 'bar': G.shops.show({ ...ctx, kind: C.R.tpl === 'boutique' ? 'shoes' : ctx.kind, inside: true, spot: s.kind }); return;
      case 'atm': G.shops.show({ ...ctx, kind: 'bank', inside: true, atm: true }); return;
      case 'rack': G.shops.show({ ...ctx, kind: 'clothes', inside: true, sub: s.sub }); return;
      case 'mirror': { const st = G.life.style(); G.hud.toast(st.odd ? 'Bold. Very bold.' : st.score > 0.85 ? 'Looking sharp' : 'Not bad', st.odd ? 'People will talk. Let them.' : st.score > 0.85 ? 'This suits the area' : 'Something more local might fit in better here', 'info', 3); P.human.play('yes', { once: true, restart: true }); P.act = { kind: 'hurt', t: 0, dur: 1 }; return; }
      case 'chair': { const seat = C.R.seats.find(q => q.salon && Math.hypot(q.x - s.x, q.z - (s.z + 1)) < 1.6) || C.R.seats.find(q => q.salon); this.sit(seat, true); G.shops.show({ ...ctx, kind: 'barber', inside: true }); return; }
      case 'seat': this.sit(s.seat); if (C.plate) this.eat(); return;
      case 'stand': if (!C.eating) this.stand(); return;
      case 'dance': this.dance(true); return;
      case 'undance': this.dance(false); return;
      case 'workout': G.shops.show({ ...ctx, kind: 'gym', inside: true }); return;
      case 'vehicle': G.shops.show({ ...ctx, kind: 'dealer', inside: true }); return;
      case 'talk': G.date && G.date.talk(s.p, C); return;
    }
  }
  sit(seat, salon) {
    const C = this.cur, P = this.g.player;
    if (!seat) return;
    seat.used = true; C.seat = seat;
    P.foot.x = seat.x; P.foot.z = seat.z; P.foot.yaw = seat.yaw; P.foot.vx = P.foot.vz = 0;
    P.seated = true;
    P.human.play('sit', { fade: 0.3 });
    void salon;
  }
  stand() {
    const C = this.cur, P = this.g.player;
    if (!C || !C.seat) return;
    C.seat.used = false;
    P.foot.x = C.seat.x - Math.cos(C.seat.yaw) * 0.6; P.foot.z = C.seat.z - Math.sin(C.seat.yaw) * 0.6;
    C.seat = null; P.seated = false;
    P.human.play('idle', { fade: 0.3 });
  }
  // the counter takes your order: your plate comes to your table
  serve(name, eff) {
    const C = this.cur;
    C.plate = { name, eff };
    if (C.seat && !C.seat.salon) { setTimeout(() => this.eat(), 600); return `${name} is coming to your table`; }
    return `${name} ordered. Sit at any table (F) and it comes to you`;
  }
  eat() {
    const G = this.g, C = this.cur, P = G.player;
    if (!C || !C.plate || !C.seat) return;
    const plate = C.plate; C.plate = null; C.eating = true;
    // a plate on the table in front of you
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.03, 16), new THREE.MeshLambertMaterial({ color: 0xd9dde2 }));
    const food = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: /chai|coffee|lassi|taak|mastani|juice|cola|beer|cocktail|mocktail|sharbat/i.test(plate.name) ? 0xc8a16a : 0xc9772e }));
    const t = C.seat.table, tx = t.x + (C.seat.x - t.x) * 0.35, tz = t.z + (C.seat.z - t.z) * 0.35;
    m.position.set(tx, FLOOR + 0.79, tz); food.position.set(tx, FLOOR + 0.8, tz);
    G.scene.add(m, food);
    P.human.play('drink', { fade: 0.3 });
    G.hud.toast(`Eating: ${plate.name}`, 'Take your time', 'info', 2.4);
    const steps = 5; let k = 0;
    const tick = setInterval(() => {
      k++;
      const part = {}; for (const [a, v] of Object.entries(plate.eff)) part[a] = v / steps;
      G.life.apply(part);
      food.scale.setScalar(Math.max(0.05, 1 - k / steps));
      if (k >= steps) {
        clearInterval(tick); G.scene.remove(m, food); m.geometry.dispose(); food.geometry.dispose();
        C.eating = false; G.life.s.tally.meals++;
        if (this.cur === C && C.seat) P.human.play('sit', { fade: 0.3 });
        G.hud.toast('Done', 'Wipe your hands, pay the bill, belch politely', 'good', 2.2);
      }
    }, 1100);
  }
  dance(on) {
    const G = this.g, C = this.cur, P = G.player;
    C.dancing = on;
    if (on) { P.human.play('dance', { fade: 0.3 }); P.seated = true; G.hud.toast('On the floor', 'Mood up, energy down. F to stop', 'info', 2.2); C.danceT = 0; }
    else { P.human.play('idle', { fade: 0.3 }); P.seated = false; }
  }
  update(dt) {
    const C = this.cur, G = this.g;
    if (!C) return;
    const R = C.R;
    // the floor pulses with the beat
    if (R.dyn.length) {
      const t = performance.now() / 1000, beat = (t * 124 / 60) % 1;
      R.dyn.forEach((g, i) => { const h = ((i * 0.13 + t * 0.1) % 1); const v = (beat < 0.25 ? 1 : 0.35) * (((i + Math.floor(t * 2.07)) % 3) ? 0.5 : 1); g.material.color.setHSL(h, 0.9, 0.12 + v * 0.35); });
    }
    if (C.dancing) {
      C.danceT += dt;
      G.life.apply({ mood: dt * 0.012, energy: -dt * 0.004, thirst: -dt * 0.003 });
      if (G.life.s.energy < 0.08) { this.dance(false); G.hud.toast('You’re spent', 'Sit down, drink some water', 'warn', 2.4); }
    }
    // indoor light: steady, whatever the time outside
    if (G.sky) { G.sky.hemi.intensity = Math.PI * (R.tpl === 'club' ? 0.75 : 0.95); if (R.tpl === 'club') G.sky.hemi.color.setRGB(0.85, 0.6, 1); else G.sky.hemi.color.setRGB(1, 0.97, 0.92); G.sky.hemi.groundColor.setRGB(0.55, 0.52, 0.5); G.sky.sun.intensity = R.tpl === 'club' ? 0.3 : 1.2; }
  }
}
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const FEM = ['Riya', 'Ananya', 'Sanika', 'Tanvi', 'Ishita', 'Mrunmayi', 'Aditi', 'Shreya', 'Kavya', 'Pooja', 'Zoya', 'Neha'];
const MALE = ['Arjun', 'Kabir', 'Rohan', 'Omkar', 'Siddhant', 'Aditya', 'Varun', 'Nikhil', 'Yash', 'Aman', 'Rahul', 'Dev'];
