// Walking into a shop: you go inside a real room, not a menu. Rooms are built procedurally and
// reused; which room you get depends on the kind of place and the name on the board (designOf):
//   look     chains and posh places get a designed interior: minimal (pale oak, white, pendants),
//            bold (colour-blocked walls, stripes, spots), industrial (concrete, brick, Edison bulbs),
//            heritage (wood dado, frames), luxe (dark marble, gold trim), pastel; clinics are clinical;
//            local places get their cuisine's look (Udupi green tiles, Irani checkers, biryani brass,
//            red Chinese lanterns) or the plain Pune shop with tube lights
//   layout   eateries: a grid of tables, booths down the walls, long communal tables, or a window
//            bar with stools; cafés also a sofa lounge; shops: wall shelves, supermarket aisles,
//            display islands (phones, laptops), glass cases in a U (jewellers); boutiques: racks on
//            the floor or a gallery with clothes on the walls
//   size     a tapri is small, a D-Mart or a Croma is huge; chains and premium places are bigger
// Every kind has its things to do: order at the counter and eat at a table (or take a parcel),
// dance and talk in clubs, sit in the salon chair, try clothes on, queue at the bank, see the doctor.
// Rooms sit far outside the city with their own walls in the collision grid, so walking and the
// camera work exactly as outside. Inside, the people are the same pooled bodies as on the street.
import * as THREE from 'three';
import { ColorBuilder } from './geo.js';
import { RNG } from '../core/util.js';
import { castAs, pickCast } from '../people/cast.js';
import { ikArm } from '../people/humans.js';
import { F, MENUS, AREA_FOOD } from '../game/shops.js';
import { Vehicle } from '../vehicles/vehicle.js';
import { tierOf } from '../game/brands.js';

const SLOT0 = 40000;
const FLOOR = 0.15;          // the game's off-road ground height, so people stand on the floor
const TEMPLATE = {
  tapri: 'eatery', misal: 'eatery', thali: 'eatery', biryani: 'eatery', southindian: 'eatery', chinese: 'eatery', fastfood: 'eatery', food: 'eatery',
  cafe: 'cafe', bakery: 'cafe', sweets: 'cafe', juice: 'cafe', icecream: 'cafe',
  bar: 'club', barber: 'salon', clothes: 'boutique', shoes: 'boutique', optician: 'boutique', bank: 'bank',
  pharmacy: 'shop', kirana: 'shop', mobile: 'shop', electronics: 'shop', books: 'shop', florist: 'shop', paan: 'shop', jeweller: 'shop',
  clinic: 'clinic', gym: 'gym', dealer: 'showroom', lodge: 'lodge', chowki: 'chowki', estate: 'office',
};
// How big each kind of room is (w across, d deep, h tall) before the brand scales it
const ROOM = {
  eatery: [20, 15, 3.8], cafe: [18, 13, 3.7], club: [28, 22, 6], salon: [16, 11, 3.5], boutique: [22, 16, 4],
  bank: [20, 14, 4.2], shop: [16, 12, 3.6], clinic: [16, 12, 3.4], gym: [22, 15, 4.8], showroom: [26, 17, 6],
  lodge: [14, 11, 3.4], chowki: [13, 10, 3.4], office: [14, 10, 3.4],
};
// A place's look. The brand picks it: the chains and posh places get a designed interior (minimal,
// bold, industrial, heritage, luxe, pastel), the local places a cuisine look or the plain Pune shop.
// floor, wall, accent, table top, metal legs?, counter, ceiling, light: tube | pendant | spot | edison | panel | neon
const A = (floor, wall, accent, top, steel, counter, ceil, light, extra) => ({ floor, wall, accent, top, steel, counter, ceil, light, ...extra });
const AES = {
  local: A(0xd9d2c4, 0xe9e0c8, 0x2e7d4f, 0xc8ccd2, true, 0x9aa0a6, 0xf4f2ee, 'tube'),
  minimal: A(0xcdb999, 0xf7f6f2, 0x1a1a1a, 0xf2efe8, false, 0xf0ede6, 0xffffff, 'pendant', { legs: 0x1a1a1a, plants: true, chair: 0xd8c4a4 }),
  bold0: A(0x26262b, 0xf2c230, 0xe63946, 0xffffff, false, 0xe63946, 0x1e1e22, 'spot', { stripes: true, legs: 0x1a1a1a, chair: 0xe63946 }),
  bold1: A(0x26262b, 0xe63946, 0xffd23f, 0xffffff, false, 0x1a1a1a, 0x1e1e22, 'spot', { stripes: true, legs: 0x1a1a1a, chair: 0xffd23f }),
  bold2: A(0x1a1d26, 0x1d4e89, 0x4cc9f0, 0xf4f4f4, false, 0x4cc9f0, 0x14161c, 'spot', { stripes: true, legs: 0xdddddd, chair: 0x4cc9f0 }),
  bold3: A(0x22262a, 0x2a9d8f, 0xf4a261, 0xffffff, false, 0xf4a261, 0x1c1f22, 'spot', { stripes: true, legs: 0x1a1a1a, chair: 0xf4a261 }),
  industrial: A(0x8d8a85, 0x8a4a34, 0xff8a2a, 0x5a3a26, false, 0x2a2420, 0x2a2a2a, 'edison', { brick: true, ducts: true, legs: 0x1a1a1a, chair: 0x3a2a20 }),
  heritage: A(0x6b4a32, 0xefe3c8, 0x8a6a2a, 0x5a3a26, false, 0x4a2e1e, 0xf4ecd8, 'pendant', { dado: 0x5a3a26, frames: true, chair: 0x4a2e1e }),
  luxe: A(0x1c1c20, 0x2a2a30, 0xc9a227, 0xe8e4dc, false, 0x111114, 0x18181c, 'spot', { trim: true, legs: 0xc9a227, chair: 0x3a2f2a }),
  pastel: A(0xf4ece6, 0xf9d9e0, 0x7cc6b8, 0xffffff, false, 0xf6b8c8, 0xffffff, 'pendant', { dado: 0xbfe6dc, legs: 0xf2f2f2, chair: 0x7cc6b8, plants: true }),
  clinical: A(0xe8eeec, 0xf6faf8, 0x2e8b6e, 0xffffff, true, 0xffffff, 0xffffff, 'panel', { band: 0x2e8b6e }),
  darkgym: A(0x2b2b2e, 0x3a3d42, 0xe0b23a, 0x2b2b2e, true, 0xe0b23a, 0x2a2a2e, 'tube'),
  // cuisines, for the local places
  udupi: A(0xf0f0ec, 0xdfeee3, 0x1f7a4a, 0xd8dde2, true, 0x2e7d4f, 0xf4f2ee, 'tube', { band: 0x2e9d5f }),
  irani: A(0xf2f2f2, 0xf3ead8, 0x7a1e1e, 0xf0eee8, false, 0x5a3a26, 0xf8f4ea, 'pendant', { checker: true, chair: 0x3a2416, frames: true }),
  biryani: A(0x3a2a20, 0xb98b5a, 0x8a1e1e, 0x5a3a26, false, 0x3a2416, 0x3a2a20, 'pendant', { brass: true, chair: 0x3a2416 }),
  chinese: A(0x2a1a14, 0x8a1e1e, 0xffc23a, 0x1a1a1a, false, 0x3a1010, 0x2a1414, 'pendant', { lanterns: true, chair: 0x1a1a1a }),
  misal: A(0xcfc6b4, 0xe4d9be, 0xb5341f, 0xc8ccd2, true, 0x8a8f96, 0xf2ede2, 'tube'),
  thali: A(0x8a5a3c, 0xf1e2c6, 0xc8762a, 0x7a5236, false, 0x6b3a26, 0xf4ead6, 'pendant', { dado: 0x7a4a2c, plants: true }),
  cafe: A(0x8a6a4d, 0xefe6d6, 0x6b4a2e, 0x7a5236, false, 0x6b4a2e, 0xf4efe6, 'pendant', { plants: true }),
  bakery: A(0xe8dcc8, 0xf6efe2, 0xb07a43, 0xd8c4a0, false, 0x8a6a4d, 0xfaf6ee, 'pendant', { display: true }),
  sweets: A(0xf4f0ea, 0xfdf6e6, 0xc9a227, 0xf0e6cc, false, 0xc9a227, 0xffffff, 'tube', { display: true }),
  warehouse: A(0x1a1816, 0x4a2e24, 0xff6a1a, 0x222222, false, 0x2a2420, 0x0c0b10, 'neon'),
  lounge: A(0x1a1424, 0x2a1f3a, 0xc58cff, 0x3a2f4a, false, 0x2a1f3a, 0x0c0b10, 'neon'),
  bollywood: A(0x0e0e14, 0x14141e, 0xff2f7d, 0x222230, false, 0x1a1a24, 0x0c0b10, 'neon'),
};
const hash = (s) => { let h = 2166136261; for (const c of s || '') { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const BOLD = (h) => 'bold' + (h % 4);
// pick a room: template, look, layout and size from the kind and the name on the board
export function designOf(ctx) {
  const k = ctx.kind, tpl = TEMPLATE[k], n = (ctx.name || '').toLowerCase(), h = hash(n), pick = (a) => a[h % a.length];
  const tier = ctx.tier || tierOf(k, ctx.name, ctx.flag), chain = ctx.flag === 'brand' || tier === 'chain' || tier === 'brand';
  let aes = 'local', layout = 'grid', scale = 1;
  switch (tpl) {
    case 'eatery':
      if (/mcdonald|kfc|burger king|domino|pizza hut|subway|wow|faasos|la pino|haldiram|wendy/.test(n) || (k === 'fastfood' && chain)) { aes = BOLD(h); layout = pick(['booths', 'counter']); scale = 1.1; }
      else if (/bistro|social|grill|kitchen|terrace|lounge|brasserie|house of|the /.test(n) || chain) { aes = pick(['minimal', 'industrial', 'heritage', 'luxe']); layout = pick(['booths', 'communal', 'grid']); scale = 1.15; }
      else if (/irani|good ?luck|vohuman|kayani|marz|naaz/.test(n)) { aes = 'irani'; layout = 'grid'; }
      else {
        aes = { southindian: 'udupi', biryani: 'biryani', chinese: 'chinese', misal: 'misal', tapri: 'misal', thali: 'thali', fastfood: BOLD(h) }[k] || pick(['local', 'heritage', 'misal', 'udupi']);
        layout = k === 'tapri' || k === 'misal' ? pick(['counter', 'grid']) : k === 'thali' ? 'communal' : k === 'fastfood' ? 'booths' : pick(['grid', 'grid', 'booths']);
        scale = k === 'tapri' ? 0.75 : 0.95;
      }
      break;
    case 'cafe':
      if (/starbucks|third wave|blue tokai|tim hortons|subko|araku|roastery|brew/.test(n)) { aes = pick(['minimal', 'industrial']); layout = pick(['communal', 'lounge']); scale = 1.15; }
      else if (/coffee day|ccd|barista|chaayos|chai point/.test(n)) { aes = BOLD(h); layout = 'grid'; }
      else if (/irani|good ?luck|vohuman|kayani|marz|naaz/.test(n)) aes = 'irani';
      else if (k === 'icecream') { aes = 'pastel'; layout = pick(['grid', 'counter']); }
      else if (k === 'sweets') { aes = /chitale|kaka halwai|ganesh|chandu/.test(n) ? 'heritage' : 'sweets'; layout = 'counter'; }
      else if (k === 'bakery') { aes = pick(['bakery', 'pastel', 'heritage']); layout = 'counter'; }
      else if (k === 'juice') { aes = pick([BOLD(h), 'pastel', 'local']); layout = 'counter'; scale = 0.85; }
      else { aes = pick(['minimal', 'industrial', 'heritage', 'pastel', 'cafe']); layout = pick(['grid', 'lounge', 'communal']); }
      break;
    case 'club': aes = /brew|tap|craft|factory|warehouse|mill/.test(n) ? 'warehouse' : /lounge|sky|roof|terrace|social/.test(n) ? 'lounge' : pick(['warehouse', 'lounge', 'bollywood']); break;
    case 'salon': aes = tier === 'premium' ? pick(['luxe', 'minimal']) : pick(['local', 'local', BOLD(h)]); scale = tier === 'premium' ? 1.15 : 0.9; break;
    case 'boutique':
      if (k === 'optician') { aes = tier === 'premium' ? 'luxe' : tier === 'chain' ? pick(['minimal', 'bold2']) : 'local'; layout = 'gallery'; scale = tier === 'local' ? 0.75 : 0.9; }
      else if (k === 'shoes') { const chainN = chain || /bata|nike|adidas|puma|skechers|reebok|metro|mochi|woodland|red tape|crocs|asics/.test(n); aes = chainN ? pick(['industrial', 'bold0', 'minimal']) : 'local'; layout = 'gallery'; scale = 0.9; }
      else if (/westside|zara|h ?& ?m|\bmax\b|pantaloons|lifestyle|uniqlo|levi|allen solly|peter england|van heusen|louis philippe|biba|w for woman|manyavar|zudio|trends|shoppers stop|marks/.test(n)) { aes = pick(['minimal', 'luxe', 'industrial', 'bold3']); layout = pick(['gallery', 'racks']); scale = 1.15; }
      else { aes = tier === 'women' ? pick(['pastel', 'heritage']) : tier === 'ethnic' ? 'heritage' : tier === 'men' ? pick(['heritage', 'minimal']) : chain ? pick(['minimal', 'luxe', 'industrial']) : 'local'; layout = chain || tier === 'women' ? pick(['gallery', 'racks']) : 'racks'; scale = chain ? 1.1 : 1; }
      break;
    case 'bank': aes = /hdfc|icici|axis|kotak|yes bank|indusind|idfc|hsbc|citi|standard chartered/.test(n) ? pick(['minimal', 'bold2']) : 'local'; break;
    case 'shop':
      if (k === 'mobile' || k === 'electronics') { const big = /apple|imagine|unicorn|croma|reliance digital|vijay sales|samsung|xiaomi|mi store|oneplus|sony|lg /.test(n); aes = big ? pick(['minimal', 'bold2', 'bold1']) : 'local'; layout = big ? 'island' : 'walls'; scale = big ? 1.2 : 0.85; }
      else if (k === 'jeweller') { aes = /tanishq|png|p\. ?n\. ?gadgil|malabar|kalyan|senco|caratlane|chandukaka/.test(n) ? 'luxe' : 'heritage'; layout = 'cases'; scale = 1.1; }
      else if (k === 'kirana') { const mart = /d-?mart|more|reliance (fresh|smart)|star bazaar|spar|big ?bazaar|nature'?s basket|dorabjee|mart\b|super ?market|hyper/.test(n); aes = mart ? BOLD(h) : 'local'; layout = 'aisles'; scale = mart ? 1.5 : 0.85; }
      else if (k === 'pharmacy') { aes = 'clinical'; layout = /apollo|medplus|wellness|noble|truemeds|frank ross/.test(n) ? 'aisles' : 'walls'; scale = 0.9; }
      else if (k === 'books') { aes = /crossword|sapna|landmark/.test(n) ? 'minimal' : 'heritage'; layout = 'aisles'; scale = 1.1; }
      else if (k === 'florist') { aes = 'pastel'; layout = 'walls'; scale = 0.75; }
      else { aes = 'local'; layout = 'walls'; scale = 0.7; }
      break;
    case 'clinic': aes = 'clinical'; scale = tier === 'hospital' ? 1.35 : tier === 'gp' ? 0.85 : 1; break;
    case 'gym': aes = tier === 'premium' ? pick(['industrial', 'bold1', 'bold2']) : 'darkgym'; scale = tier === 'premium' ? 1.2 : 0.95; break;
    case 'showroom': aes = /toyota|kia|mg |skoda|volkswagen|hyundai|mercedes|bmw|audi/.test(n) ? pick(['minimal', 'luxe']) : pick(['minimal', 'bold0', 'bold2']); break;
    case 'lodge': aes = pick(['heritage', 'local']); break;
    case 'office': aes = pick(['minimal', 'local']); break;
  }
  const sub = tpl === 'boutique' && (k === 'optician' || k === 'shoes') ? k : '';
  return { tpl, aes, layout, scale, kind: sub, key: `${tpl}:${aes}:${layout}:${scale}${sub ? ':' + sub : ''}` };
}
// kept for older callers
export function styleOf(ctx) { return designOf(ctx).aes; }
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
  room(dz) {
    if (this.rooms[dz.key]) return this.rooms[dz.key];
    const tpl = dz.tpl, style = dz.aes, lay = dz.layout, S = AES[style] || AES.local;
    const idx = Object.keys(this.rooms).length;
    const O = { x: SLOT0 + idx * 140, z: SLOT0 };
    const [W0, D0, H0] = ROOM[tpl], sc = tpl === 'club' ? 1 : dz.scale;
    const W = Math.round(W0 * sc), D = Math.round(D0 * sc), H = +(H0 * (sc > 1.1 ? 1.1 : 1)).toFixed(2);
    const floor = S.floor, wall = S.wall, accent = S.accent;
    const B = new ColorBuilder(), GL = new ColorBuilder(), C = this.g.W.collision;
    const box = (b, cx, cy, cz, sx, sy, sz, col, ry = 0) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(O.x + cx, cy + FLOOR, O.z + cz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
      b.addGeo(UNIT, m, hex(col));
    };
    const solid = (cx, cz, sx, sz, kind = 0) => { const x0 = O.x + cx - sx / 2, x1 = O.x + cx + sx / 2, z0 = O.z + cz - sz / 2, z1 = O.z + cz + sz / 2; C.addRing([x0, z0, x1, z0, x1, z1, x0, z1], kind); };
    // ---- shell: floor, ceiling, four walls (a door gap in the front wall), skirting
    box(B, 0, -0.05, D / 2, W, 0.1, D, floor);
    if (S.checker) for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) if ((i + j) & 1) box(B, -W / 2 + i + 0.5, 0.002, j + 0.5, 1, 0.006, 1, 0x1c1c1c);
    if (style === 'minimal' || style === 'heritage') for (let i = 0; i < W / 1.2; i++) box(B, -W / 2 + (i + 0.5) * 1.2, 0.001, D / 2, 0.01, 0.004, D, style === 'minimal' ? 0xb9a585 : 0x5a3c28);   // floorboards
    if (style === 'luxe') for (let i = 1; i < W / 2; i++) box(B, -W / 2 + i * 2, 0.001, D / 2, 0.02, 0.004, D, 0x34343a);                   // marble joints
    box(B, 0, H + 0.05, D / 2, W, 0.1, D, S.ceil);
    box(B, -W / 2 - 0.1, H / 2, D / 2, 0.2, H, D, wall); box(B, W / 2 + 0.1, H / 2, D / 2, 0.2, H, D, wall);
    box(B, 0, H / 2, D + 0.1, W, H, 0.2, wall);
    box(B, -W / 4 - 0.45, H / 2, -0.1, W / 2 - 0.9, H, 0.2, wall); box(B, W / 4 + 0.45, H / 2, -0.1, W / 2 - 0.9, H, 0.2, wall);
    box(B, 0, (2.45 + H) / 2, -0.1, 1.8, H - 2.45, 0.2, wall);        // wall over the door, all the way up
    // the door: a dark aluminium frame, two leaves of tinted glass over a kick plate, push bars, a lit EXIT sign
    const fr = 0x2a2c30, glass = 0x33414c;
    box(B, -0.88, 1.225, -0.12, 0.08, 2.45, 0.14, fr); box(B, 0.88, 1.225, -0.12, 0.08, 2.45, 0.14, fr); box(B, 0, 2.41, -0.12, 1.84, 0.08, 0.14, fr);
    for (const sx of [-1, 1]) {
      const cx = sx * 0.43;
      box(B, cx, 1.22, -0.16, 0.84, 2.36, 0.03, fr);                   // the leaf
      box(B, cx, 1.36, -0.14, 0.7, 1.86, 0.02, glass);                 // its glass
      box(B, cx, 0.2, -0.14, 0.7, 0.3, 0.02, 0x1d1e21);                // kick plate
      box(B, sx * 0.1, 1.1, -0.06, 0.04, 0.5, 0.04, 0xc9cbcf);         // pull handle
    }
    box(B, 0, 1.22, -0.13, 0.03, 2.36, 0.05, fr);                      // where the leaves meet
    box(GL, 0, 2.62, -0.0, 0.62, 0.2, 0.03, 0x22d36f);                 // EXIT
    // shopfront windows either side of the door
    if (tpl !== 'club') for (const s of [-1, 1]) box(GL, s * (W / 4 + 0.45), 1.5, 0.005, W / 2 - 2.4, 1.6, 0.02, 0xd8e6ee);
    for (const s of [-1, 1]) box(B, s * W / 2, 0.06, D / 2, 0.04, 0.12, D, accent);
    box(B, 0, 0.06, D, W, 0.12, 0.04, accent);
    // the look on the walls
    const onWalls = (y, h, col, glow) => { const b = glow ? GL : B; box(b, -W / 2 + 0.005, y, D / 2, 0.02, h, D, col); box(b, W / 2 - 0.005, y, D / 2, 0.02, h, D, col); box(b, 0, y, D - 0.005, W, h, 0.02, col); };
    if (S.dado) onWalls(0.6, 1.2, S.dado);
    if (S.band) onWalls(1.2, 0.12, S.band);
    if (S.stripes) { onWalls(1.0, 0.22, accent); onWalls(1.4, 0.08, 0xffffff); }
    if (S.trim) { onWalls(1.1, 0.03, accent, true); onWalls(H - 0.25, 0.03, accent, true); }
    if (S.brick) for (let r = 0; r < H / 0.3; r++) for (let i = 0; i < W / 1.2; i++) if ((r * 7 + i * 3) % 5 === 0) box(B, -W / 2 + (i + (r & 1) * 0.5) * 1.2, r * 0.3 + 0.15, D - 0.01, 0.55, 0.12, 0.02, 0x6e3a28);
    if (S.ducts) for (const x of [-W / 4, W / 4]) box(B, x, H - 0.45, D / 2, 0.5, 0.5, D, 0x6b6e72);
    if (S.frames) for (let i = 0; i < Math.floor(D / 3); i++) for (const s of [-1, 1]) { box(B, s * (W / 2 - 0.03), 1.9, 2 + i * 3, 0.04, 0.8, 0.6, 0x3a2416); box(B, s * (W / 2 - 0.05), 1.9, 2 + i * 3, 0.03, 0.66, 0.46, [0x8aa2b8, 0xc89a6a, 0x6a8a5a][i % 3]); }
    if (S.plants) for (const x of [-W / 2 + 0.6, W / 2 - 0.6]) for (const z of [1.2, D * 0.55]) { box(B, x, 0.25, z, 0.5, 0.5, 0.5, 0xe8e2d6); box(B, x, 0.85, z, 0.7, 0.8, 0.7, 0x3f7a52); C.addCircle(O.x + x, O.z + z, 0.4, 2); }
    if (S.lanterns) for (let i = 0; i < 6; i++) box(GL, -W / 2 + 2 + i * (W - 4) / 5, H - 0.7, D / 2, 0.5, 0.6, 0.5, 0xff3a2a);
    if (S.brass) for (let i = 0; i < 5; i++) box(GL, -W / 2 + 2 + i * (W - 4) / 4, H - 0.5, 2.4, 0.3, 0.3, 0.3, 0xffb24a);
    // a lit sign over the back wall for the designed places
    if (/bold|minimal|luxe|industrial/.test(style) && !['club', 'showroom'].includes(tpl)) box(GL, 0, H - 0.55, D - 0.03, Math.min(6, W * 0.35), 0.5, 0.02, style === 'minimal' ? 0x2a2a2a : accent);
    C.addLine([O.x - W / 2, O.z, O.x - W / 2, O.z + D, O.x + W / 2, O.z + D, O.x + W / 2, O.z], 0);
    C.addSeg(O.x - W / 2, O.z, O.x - 0.9, O.z, 0); C.addSeg(O.x + 0.9, O.z, O.x + W / 2, O.z, 0);
    C.addSeg(O.x - 0.9, O.z - 0.05, O.x + 0.9, O.z - 0.05, 0);       // you leave through F at the door, not by walking out
    // ---- lights
    const nx = Math.max(2, Math.round(W / 4)), nz = Math.max(2, Math.round(D / 4));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = -W / 2 + (i + 0.5) * W / nx, z = (j + 0.5) * D / nz;
      switch (S.light) {
        case 'neon': if (j === 0) box(GL, x, H - 0.02, D / 2, 0.08, 0.04, D * 0.8, [0xff2f7d, 0x2f7dff, 0x7d2fff, 0xffb02f][i % 4]); break;
        case 'tube': if (j % 2 === 0) box(GL, x, H - 0.03, z, 0.12, 0.05, 1.4, 0xfffbf0); break;
        case 'panel': box(GL, x, H - 0.02, z, 1.2, 0.03, 1.2, 0xf6fbff); break;
        case 'spot': box(GL, x, H - 0.02, z, 0.22, 0.03, 0.22, 0xfff3dc); box(GL, x + W / nx / 2, H - 0.02, z, 0.22, 0.03, 0.22, 0xfff3dc); break;
        case 'pendant': box(B, x, H - 0.5, z, 0.02, 1.0, 0.02, 0x222222); box(B, x, H - 1.05, z, 0.42, 0.2, 0.42, style === 'minimal' ? 0x1a1a1a : accent); box(GL, x, H - 1.16, z, 0.34, 0.02, 0.34, 0xffe2b0); break;
        case 'edison': for (const o of [-0.4, 0.4]) { box(B, x + o, H - 0.6, z, 0.015, 1.2, 0.015, 0x111111); box(GL, x + o, H - 1.25, z, 0.1, 0.14, 0.1, 0xffb050); } break;
      }
    }
    const R = { tpl, style, layout: lay, O, W, D, H, spots: [], seats: [], people: [], dyn: [], props: [], browse: [] };
    // a generous reach: you shouldn't have to stand on an exact spot to use something (nearest wins)
    const spot = (x, z, r, kind, label, extra) => R.spots.push({ x: O.x + x, z: O.z + z, r: kind === 'exit' ? r : Math.max(r * 1.3, 1.4), kind, label, ...extra });
    spot(0, 0.6, 1.2, 'exit', 'Go back outside');
    const counter = (x, z, w, d, col, glass) => { box(B, x, 0.5, z, w, 1.0, d, col); box(B, x, 1.02, z, w + 0.08, 0.05, d + 0.08, style === 'luxe' ? 0xe8e4dc : style === 'minimal' ? 0xf7f6f2 : 0x3b3b3e); if (glass) box(GL, x, 0.75, z - d / 2 - 0.01, w * 0.94, 0.4, 0.02, 0xfff1d6); solid(x, z, w, d); };
    const legC = S.steel ? 0xb8bcc2 : S.legs || 0x4a3626, chairC = S.steel ? 0xc8ccd2 : S.chair || 0x6b4a2e;
    // a chair at (x, z) facing yaw, and the seat for it
    const chair = (x, z, yaw, tx, tz, opts = {}) => {
      const r = -yaw, bx = x - Math.cos(yaw) * 0.22, bz = z - Math.sin(yaw) * 0.22;
      if (opts.stool) { box(B, x, 0.72, z, 0.36, 0.05, 0.36, chairC, r); box(B, x, 0.36, z, 0.05, 0.72, 0.05, legC); }
      else {
        box(B, x, 0.45, z, 0.45, 0.05, 0.45, chairC, r); box(B, bx, 0.75, bz, 0.05, 0.6, 0.45, chairC, r);
        for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(B, x + a, 0.22, z + b, 0.04, 0.44, 0.04, legC);
      }
      R.seats.push({ x: O.x + x, z: O.z + z, yaw, table: { x: O.x + tx, z: O.z + tz }, used: false, ...opts.seat });
    };
    // a table w×d at (x, z), round-ish collision for small ones, a ring for long ones
    const tableTop = (x, z, w, d, h = 0.74) => {
      box(B, x, h, z, w, 0.05, d, S.top);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(B, x + a * (w / 2 - 0.08), h / 2, z + b * (d / 2 - 0.08), 0.05, h, 0.05, legC);
      if (w < 1.3 && d < 1.3) C.addCircle(O.x + x, O.z + z, Math.max(w, d) * 0.55, 2); else solid(x, z, w, d, 2);
    };
    const table2 = (x, z) => { tableTop(x, z, 0.95, 0.75); chair(x, z + 0.75, -Math.PI / 2, x, z); chair(x, z - 0.75, Math.PI / 2, x, z); };
    const table4 = (x, z) => { tableTop(x, z, 1.2, 1.0); for (const s of [-1, 1]) { chair(x - 0.32, z + s * 0.85, -s * Math.PI / 2, x, z); chair(x + 0.32, z + s * 0.85, -s * Math.PI / 2, x, z); } };
    const sofa = (x, z, yaw, len, col) => {      // facing yaw; seat cushions and a back
      const r = -yaw, bx = x - Math.cos(yaw) * 0.35, bz = z - Math.sin(yaw) * 0.35;
      box(B, x, 0.3, z, 0.8, 0.45, len, col, r); box(B, bx, 0.7, bz, 0.22, 0.8, len, col, r);
      solid(x, z, Math.abs(Math.cos(yaw)) > 0.5 ? 0.8 : len, Math.abs(Math.cos(yaw)) > 0.5 ? len : 0.8, 2);
    };
    const shelf = (x, z, w, rot, n = 4, hgt = 2.2, cols) => {
      box(B, x, hgt / 2, z, rot ? 0.45 : w, hgt, rot ? w : 0.45, style === 'minimal' ? 0xe8e4dc : style === 'clinical' ? 0xf2f6f5 : style === 'luxe' ? 0x1a1a1e : 0x8a7a66);
      const nk = Math.max(4, Math.round(w * 2.2));
      for (let r = 0; r < n; r++) for (let k = 0; k < nk; k++) {
        const t = (k + 0.5) / nk - 0.5, c = (cols || [0xd1495b, 0xf4d58d, 0x2e86ab, 0x7a9e7e, 0xf28f3b, 0xffffff, 0x3d405b, 0xe9cf7a])[(r * 7 + k * 3) % (cols ? cols.length : 8)];
        if (rot) box(B, x, 0.35 + r * (hgt - 0.4) / n, z + t * w * 0.94, 0.5, 0.3, w / nk * 0.8, c); else box(B, x + t * w * 0.94, 0.35 + r * (hgt - 0.4) / n, z, w / nk * 0.8, 0.3, 0.5, c);
      }
      solid(x, z, rot ? 0.45 : w, rot ? w : 0.45);
    };
    const kp = (x, z, yaw, anim, role) => R.people.push({ x: O.x + x, z: O.z + z, yaw, anim, role });
    const browse = (x, z) => R.browse.push([O.x + x, O.z + z]);

    if (tpl === 'eatery' || tpl === 'cafe') {
      const cafe = tpl === 'cafe';
      const cw = Math.min(W * 0.5, 9);
      counter(0, D - 1.6, cw, 0.8, S.counter, cafe || S.display);
      kp(0, D - 0.8, -Math.PI / 2, 'idle', 'keeper');
      kp(cw * 0.33, D - 0.8, -Math.PI / 2, 'idle', 'helper');
      if (W > 18) kp(-cw * 0.33, D - 0.8, -Math.PI / 2, 'idle', 'helper');
      spot(0, D - 2.4, 1.6, 'counter', 'Order at the counter');
      const zEnd = D - 4.2;
      if (lay === 'booths') {
        // booths down both walls, a table and two benches each, small tables in the middle
        for (const s of [-1, 1]) for (let z = 2.2; z <= zEnd; z += 2.3) {
          const x = s * (W / 2 - 0.9);
          tableTop(x, z, 1.2, 0.8);
          for (const o of [-1, 1]) { box(B, x, 0.3, z + o * 0.85, 1.4, 0.45, 0.5, S.chair || accent); box(B, x, 0.75, z + o * 1.05, 1.4, 0.9, 0.12, S.chair || accent); solid(x, z + o * 0.9, 1.4, 0.6, 2);
            R.seats.push({ x: O.x + x - s * 0.25, z: O.z + z + o * 0.8, yaw: o > 0 ? -Math.PI / 2 : Math.PI / 2, table: { x: O.x + x, z: O.z + z }, used: false }); }
        }
        for (let x = -W / 2 + 4.5; x <= W / 2 - 4.5 + 0.01; x += 3) for (let z = 2.6; z <= zEnd; z += 2.6) table2(x, z);
      } else if (lay === 'communal') {
        // long shared tables, people elbow to elbow
        const len = Math.min(W - 5, 9), rows = Math.max(1, Math.floor((zEnd - 1.6) / 2.8));
        for (let r = 0; r < rows; r++) {
          const z = 2.6 + r * 2.8;
          tableTop(0, z, len, 0.9);
          for (let x = -len / 2 + 0.5; x <= len / 2 - 0.4; x += 0.9) { chair(x, z + 0.7, -Math.PI / 2, x, z, { stool: style === 'industrial' }); chair(x, z - 0.7, Math.PI / 2, x, z, { stool: style === 'industrial' }); }
        }
        for (const s of [-1, 1]) for (let z = 2.4; z <= zEnd; z += 2.4) if (W / 2 - len / 2 > 2.4) table2(s * (W / 2 - 1.3), z);
      } else if (lay === 'counter') {
        // a bar along the shop window with stools, standing tables, a few tables at the back
        for (const s of [-1, 1]) {
          const x0 = s * (W / 4 + 0.45), w = W / 2 - 2.6;
          box(B, x0, 1.05, 0.45, w, 0.05, 0.5, S.top); box(B, x0, 0.52, 0.3, w, 1.0, 0.06, S.counter); solid(x0, 0.4, w, 0.5, 2);
          for (let x = x0 - w / 2 + 0.4; x <= x0 + w / 2 - 0.3; x += 0.75) chair(x, 1.0, -Math.PI / 2, x, 0.45, { stool: true });
        }
        for (let x = -W / 2 + 2; x <= W / 2 - 2 + 0.01; x += 2.6) { box(B, x, 0.55, 3.2, 0.12, 1.1, 0.12, legC); box(B, x, 1.1, 3.2, 0.7, 0.04, 0.7, S.top); C.addCircle(O.x + x, O.z + 3.2, 0.4, 2); browse(x + 0.7, 3.2); }
        for (let x = -W / 2 + 2.2; x <= W / 2 - 2.2 + 0.01; x += 3.2) for (let z = 5.4; z <= zEnd; z += 2.5) table2(x, z);
      } else if (lay === 'lounge') {
        // sofas and armchairs round low tables
        for (let x = -W / 2 + 2.6; x <= W / 2 - 2.6 + 0.01; x += 4.2) for (let z = 2.8; z <= zEnd - 0.4; z += 3.4) {
          box(B, x, 0.22, z, 1.1, 0.04, 0.7, S.top); box(B, x, 0.11, z, 0.9, 0.2, 0.5, legC); C.addCircle(O.x + x, O.z + z, 0.55, 2);
          sofa(x, z + 1.1, -Math.PI / 2, 1.8, S.chair || accent);
          R.seats.push({ x: O.x + x - 0.4, z: O.z + z + 1.0, yaw: -Math.PI / 2, table: { x: O.x + x, z: O.z + z }, used: false }, { x: O.x + x + 0.4, z: O.z + z + 1.0, yaw: -Math.PI / 2, table: { x: O.x + x, z: O.z + z }, used: false });
          chair(x, z - 1.0, Math.PI / 2, x, z);
        }
      } else {
        for (let x = -W / 2 + 2.2; x <= W / 2 - 2.2 + 0.01; x += 3.4) for (let z = 2.3; z <= zEnd; z += 2.6) (W > 17 && ((x + z) | 0) % 3 === 0 ? table4 : table2)(x, z);
      }
      R.board = { x: 0, y: Math.min(2.6, H - 1.1), z: D - 0.02, w: 3.4, h: 1.2 };
      R.customers = Math.min(16, Math.round(R.seats.length * 0.4));
    } else if (tpl === 'club') {
      const v = style || 'bollywood';
      // the bar runs down the left wall
      counter(-W / 2 + 1.8, D / 2, 1.0, D * 0.55, S.counter);
      box(GL, -W / 2 + 1.3, 1.3, D / 2, 0.05, 0.08, D * 0.55, accent);
      for (let i = 0; i < 12; i++) box(GL, -W / 2 + 0.25, 1.5 + (i % 3) * 0.5, D / 2 - 5 + i * 0.85, 0.15, 0.35, 0.12, [0x7fd6ff, 0xffc23a, 0x9be564][i % 3]);    // bottles lit from below
      kp(-W / 2 + 0.8, D / 2, 0, 'idle', 'keeper'); kp(-W / 2 + 0.8, D / 2 + 3, 0, 'idle', 'bartender');
      spot(-W / 2 + 2.9, D / 2, 2.2, 'bar', 'Order at the bar');
      // the dance floor: tiles that pulse with the beat
      const fx = 2, fz = D * 0.45, fnx = 8, fnz = 6;
      for (let i = 0; i < fnx; i++) for (let j = 0; j < fnz; j++) {
        const g = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 1.15), new THREE.MeshBasicMaterial({ color: 0x220033, toneMapped: false }));
        g.position.set(O.x + fx + (i - fnx / 2 + 0.5) * 1.2, FLOOR + 0.02, O.z + fz + (j - fnz / 2 + 0.5) * 1.2);
        R.dyn.push(g);
      }
      R.floor = { x: O.x + fx, z: O.z + fz, w: fnx * 1.2, d: fnz * 1.2 };
      // the DJ on a raised booth at the back
      box(B, fx, 0.5, D - 1.6, 5, 1.0, 2, 0x101014); box(B, fx, 1.25, D - 1.4, 3.6, 0.5, 0.9, 0x18181f); box(GL, fx, 1.52, D - 1.4, 3.2, 0.04, 0.6, accent); solid(fx, D - 1.6, 5, 2);
      kp(fx, D - 0.9, -Math.PI / 2, 'dance', 'dj');
      if (v === 'bollywood') { box(GL, fx, 3.2, D - 0.06, W * 0.6, 3.4, 0.04, 0x2f2fff); R.ledWall = true; }      // the LED wall
      if (v === 'warehouse') { for (let i = 0; i < 6; i++) box(B, -W / 2 + 3 + i * (W - 6) / 5, H - 0.3, D / 2, 0.3, 0.3, D, 0x2a2a2a); for (let i = 0; i < 4; i++) box(GL, -W / 2 + 4 + i * (W - 8) / 3, H - 0.6, D / 2, 0.2, 0.2, 0.2, 0xffa02a); }
      // sofas round the edge
      const sc2 = v === 'lounge' ? 0x5a2f7a : 0x2a2a34;
      for (let i = 0; i < 5; i++) { const z = 3 + i * 3.4; box(B, W / 2 - 1.1, 0.35, z, 1.4, 0.5, 2.6, sc2); box(B, W / 2 - 0.5, 0.75, z, 0.4, 0.8, 2.6, sc2); box(B, W / 2 - 2.6, 0.4, z, 0.8, 0.8, 0.8, 0x101014); C.addCircle(O.x + W / 2 - 1.4, O.z + z, 1.2, 2);
        R.seats.push({ x: O.x + W / 2 - 1.2, z: O.z + z, yaw: Math.PI, table: { x: O.x + W / 2 - 2.6, z: O.z + z }, used: false, sofa: true }); }
      for (let i = 0; i < 4; i++) { const x = -W / 2 + 6 + i * 2.6, z = 2.6; box(B, x, 0.55, z, 0.7, 1.1, 0.7, 0x2a2a34); box(GL, x, 1.12, z, 0.75, 0.03, 0.75, accent); C.addCircle(O.x + x, O.z + z, 0.5, 2); }
      if (v !== 'warehouse') { const mb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ color: 0xdfe6ef, toneMapped: false })); mb.position.set(O.x + fx, H - 1, O.z + fz); R.dyn.push(mb); R.ball = mb; }
      spot(fx, fz, 4, 'dance', 'Dance');
      R.dancers = 18; R.ctxStyle = v;
    } else if (tpl === 'salon') {
      const xs = []; for (let x = -W / 2 + 2; x < W / 2 - 3; x += 2.4) xs.push(x);
      for (const x of xs) {
        box(B, x, 0.5, D - 0.9, 0.7, 0.12, 0.7, style === 'luxe' ? 0x111114 : 0x1b1c1f); box(B, x, 0.9, D - 0.6, 0.7, 0.8, 0.12, 0x1b1c1f); box(B, x, 0.25, D - 0.9, 0.2, 0.5, 0.2, 0x8e9093);
        box(B, x, 1.7, D - 0.05, 1.1, 1.3, 0.04, 0xbcd0dc);   // mirror
        if (style === 'luxe' || style === 'minimal') box(GL, x, 2.42, D - 0.06, 1.1, 0.04, 0.04, 0xfff1d6);   // a light bar over each mirror
        R.seats.push({ x: O.x + x, z: O.z + D - 0.9, yaw: Math.PI / 2, salon: true, used: false });
        spot(x, D - 1.9, 1.0, 'chair', 'Sit in the chair');
      }
      xs.forEach((x, i) => { if (i % 2 === 0) kp(x + 1.2, D - 1.7, Math.PI / 2, 'idle', i ? 'barber' : 'keeper'); });
      // wash basins down the side, a reception, a waiting sofa
      for (let z = 3; z < D - 3; z += 1.6) { box(B, W / 2 - 0.5, 0.45, z, 0.7, 0.9, 0.7, 0x1b1c1f); box(B, W / 2 - 0.5, 0.92, z, 0.5, 0.06, 0.45, 0xf2f2f2); solid(W / 2 - 0.5, z, 0.7, 0.7, 2); }
      sofa(-W / 2 + 0.7, 3, 0, 3.2, S.chair || 0x6b4a2e);
      counter(-W / 2 + 3.4, 1.8, 1.8, 0.6, S.counter);
      R.customers = 3;
    } else if (tpl === 'boutique') {
      const racks = [];
      const LBL = dz.kind === 'optician' ? [['Frames', 'frames'], ['Sunglasses', 'shades'], ['Contact lenses', 'lens']] : dz.kind === 'shoes' ? [['Sneakers', 'sneak'], ['Formal shoes', 'formal'], ['Chappals and sandals', 'chappal']] : [['Shirts and tees', 'tops'], ['Trousers and jeans', 'bottoms'], ['Kurtas and sarees', 'ethnic']];
      const label = (i) => LBL[i % 3];
      if (lay === 'gallery') {
        // clothes hung along the walls, a big table of folded things in the middle, lots of space
        for (let z = 2.5, i = 0; z < D - 3; z += 3.2, i++) { racks.push([-W / 2 + 1.0, z, ...label(i), true]); racks.push([W / 2 - 1.0, z, ...label(i + 1), true]); }
        const tw = Math.min(5, W * 0.3);
        box(B, 0, 0.45, D / 2, tw, 0.9, 1.6, S.counter); solid(0, D / 2, tw, 1.6, 2);
        for (let k = 0; k < 10; k++) box(B, -tw / 2 + 0.3 + (k % 5) * (tw - 0.6) / 4, 0.95, D / 2 - 0.4 + Math.floor(k / 5) * 0.8, 0.4, 0.1 + (k % 3) * 0.05, 0.35, [0xf2f0ea, 0x8fb3d9, 0x1f2024, 0xbf3f3a, 0xe0b23a][k % 5]);
        browse(0, D / 2 - 1.3); browse(1.5, D / 2 + 1.3);
      } else {
        for (let z = 3.4, j = 0; z < D - 3.5; z += 3.4, j++) for (let x = -W / 2 + 3.5, i = 0; x <= W / 2 - 3.5 + 0.01; x += 5, i++) racks.push([x, z, ...label(i + j), false]);
      }
      // garments that read as what they are: shirts with shoulders, trousers with two legs, sarees
      // with a gold border, on hangers; a printed sign over every rack says what's there
      const COLS = [0xf2f0ea, 0x8fb3d9, 0x1f2024, 0xbf3f3a, 0xe0b23a, 0x2f5d45, 0xd1495b, 0x7b2cbf, 0x6b4a2e, 0x4cc9f0];
      const smallGoods = dz.kind === 'optician' || dz.kind === 'shoes';
      const garment = (gx, gz, sub, col, alongX) => {
        if (smallGoods) {      // a little stand: three tiers of frames or pairs of shoes
          for (let t = 0; t < 3; t++) { const y = 0.7 + t * 0.4, c = dz.kind === 'shoes' ? col : [0x1a1a1a, 0x8a6a2a, col][t];
            alongX ? box(B, gx, y, gz, 0.22, dz.kind === 'shoes' ? 0.1 : 0.05, dz.kind === 'shoes' ? 0.3 : 0.14, c) : box(B, gx, y, gz, dz.kind === 'shoes' ? 0.3 : 0.14, dz.kind === 'shoes' ? 0.1 : 0.05, 0.22, c);
            alongX ? box(B, gx, y - 0.06, gz, 0.28, 0.02, 0.36, 0xe8e4dc) : box(B, gx, y - 0.06, gz, 0.36, 0.02, 0.28, 0xe8e4dc); }
          return;
        }
        // t: thickness along the rail, w: width across it
        const bx = (cx, cy, cz, t, h, w, c) => alongX ? box(B, cx, cy, cz, t, h, w, c) : box(B, cx, cy, cz, w, h, t, c);
        bx(gx, 1.56, gz, 0.02, 0.08, 0.04, 0x8e9093);                       // hook
        bx(gx, 1.5, gz, 0.03, 0.03, 0.44, 0x6b4a2e);                        // hanger
        if (sub === 'tops') { bx(gx, 1.22, gz, 0.06, 0.56, 0.42, col); bx(gx, 1.42, gz, 0.06, 0.14, 0.62, col); }
        else if (sub === 'bottoms') { const o = 0.1; alongX ? (box(B, gx, 1.02, gz - o, 0.06, 0.92, 0.17, col), box(B, gx, 1.02, gz + o, 0.06, 0.92, 0.17, col)) : (box(B, gx - o, 1.02, gz, 0.17, 0.92, 0.06, col), box(B, gx + o, 1.02, gz, 0.17, 0.92, 0.06, col)); bx(gx, 1.45, gz, 0.06, 0.08, 0.38, col); }
        else { bx(gx, 0.86, gz, 0.05, 1.28, 0.46, col); bx(gx, 0.28, gz, 0.055, 0.1, 0.47, 0xc9a227); }
      };
      for (const [x, z, lbl, sub, wallRack] of racks) {
        const along = wallRack ? 2.6 : 2.2;
        if (wallRack) {
          box(B, x, 1.6, z, 0.04, 0.04, along, 0x8e9093);
          for (let k = 0; k < 8; k++) garment(x, z - along / 2 + 0.2 + k * 0.31, sub, COLS[(k * 3 + Math.round(z)) % COLS.length], false);
          solid(x, z, 0.6, along, 2); spot(x + (x < 0 ? 0.9 : -0.9), z, 1.7, 'rack', lbl, { sub });
          this.sign(R, lbl, x + (x < 0 ? 0.05 : -0.05), 2.35, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, 2.2, accent);
        } else {
          box(B, x, 1.6, z, along, 0.04, 0.04, 0x8e9093); for (const e of [-1, 1]) box(B, x + e * along / 2, 0.8, z, 0.04, 1.6, 0.04, 0x8e9093);
          for (let k = 0; k < 7; k++) garment(x - 0.9 + k * 0.3, z, sub, COLS[(k * 3 + Math.round(x)) % COLS.length], true);
          C.addCircle(O.x + x, O.z + z, 1.0, 2); spot(x, z, 2.1, 'rack', lbl, { sub }); browse(x + 1.4, z - 1.0);
          box(B, x, 2.0, z, 0.03, 0.8, 0.03, 0x8e9093);
          this.sign(R, lbl, x, 2.55, z - 0.02, Math.PI, 2.0, accent);
        }
      }
      // mirror, trial rooms at the back, the till
      box(B, W / 2 - 0.05, 1.4, D - 2, 0.04, 2.2, 1.2, 0xbcd0dc);
      spot(W / 2 - 1.0, D - 2, 1.0, 'mirror', 'Look in the mirror');
      for (let i = 0; i < 3; i++) { const x = W / 2 - 3 - i * 1.6; box(B, x - 0.75, 1.1, D - 0.8, 0.06, 2.2, 1.4, S.counter); box(B, x, 1.2, D - 0.12, 1.4, 1.8, 0.04, accent); }
      counter(-W / 2 + 1.6, D - 1, 2.0, 0.7, S.counter);
      kp(-W / 2 + 1.6, D - 0.4, -Math.PI / 2, 'idle', 'keeper');
      spot(-W / 2 + 1.6, D - 2, 1.1, 'counter', 'Shoes at the counter');
      R.customers = 3;
    } else if (tpl === 'bank') {
      counter(0, D - 2, W * 0.7, 0.8, S.counter === 0xf0ede6 ? 0xe8e4dc : 0xbfc5ca);
      box(B, 0, 1.75, D - 2, W * 0.7, 1.4, 0.04, 0xcfe2ec);   // glass partition
      const nt = Math.max(3, Math.floor(W * 0.7 / 2.4));
      for (let i = 0; i < nt; i++) { const x = (i - (nt - 1) / 2) * 2.4; kp(x, D - 1.3, -Math.PI / 2, 'idle', i === (nt >> 1) ? 'keeper' : 'teller'); box(GL, x, 2.6, D - 2, 0.5, 0.25, 0.03, 0xff3a2a); }   // counter numbers
      spot(0, D - 3, 1.4, 'counter', 'Go to the counter');
      // rows of waiting chairs, a token machine, the ATM
      for (let r = 0; r < 3; r++) for (let x = -W / 4; x <= W / 4; x += 0.7) chair(x, 3.5 + r * 1.4, Math.PI / 2, x, 8, { seat: { wait: true } });
      box(B, -W / 2 + 0.8, 0.7, 1.6, 0.5, 1.4, 0.4, 0x2b3550); box(GL, -W / 2 + 0.8, 1.2, 1.38, 0.3, 0.2, 0.02, 0x7fd6ff); solid(-W / 2 + 0.8, 1.6, 0.5, 0.4);
      box(B, W / 2 - 0.5, 1.0, 1.6, 0.7, 2.0, 0.7, 0x2b3550); box(GL, W / 2 - 0.86, 1.4, 1.6, 0.02, 0.4, 0.5, 0x7fd6ff); solid(W / 2 - 0.5, 1.6, 0.7, 0.7);
      spot(W / 2 - 1.4, 1.6, 1.0, 'atm', 'Use the ATM');
      R.customers = 6;
    } else if (tpl === 'gym') {
      const rows = Math.floor((W - 6) / 2.6) + 1;
      for (let i = 0; i < rows; i++) { const x = -W / 2 + 3 + i * 2.6; box(B, x, 0.5, 4.5, 1.6, 1.0, 0.6, 0x1b1c1f); box(B, x, 1.05, 4.5, 1.8, 0.06, 0.06, 0xb8bcc2); C.addCircle(O.x + x, O.z + 4.5, 0.8, 2); }
      for (let i = 0; i < rows - 1; i++) { const x = -W / 2 + 4 + i * 2.6; box(B, x, 0.7, D - 2.5, 0.8, 1.4, 1.8, 0x1b1c1f); box(B, x, 1.4, D - 3.2, 0.7, 0.05, 0.4, 0x2a2a2e); solid(x, D - 2.5, 0.8, 1.8, 2); }   // treadmills
      box(B, 0, 0.02, 2.2, W * 0.8, 0.04, 1.8, 0x2f2f33);
      box(B, -W / 2 + 0.03, 1.5, D / 2, 0.03, 2.2, D * 0.7, 0xbcd0dc);                   // the mirror wall
      spot(-1.4, 3.3, 1.4, 'workout', 'Work out');
      spot(W / 2 - 1.4, D - 1.4, 1.2, 'counter', 'Front desk');
      counter(W / 2 - 1.4, D - 0.6, 1.6, 0.6, S.counter);
      kp(W / 2 - 1.4, D - 0.25, -Math.PI / 2, 'idle', 'keeper');
      R.lifters = Math.min(6, rows);
    } else if (tpl === 'showroom') {
      R.display = [[-8, 7], [-2.7, 7], [2.7, 7], [8, 7]];
      for (const [x, z] of R.display) { box(B, x, 0.06, z, 4.6, 0.12, 2.8, style === 'luxe' ? 0x2a2a30 : 0xd9d9dc); box(GL, x, H - 0.03, z, 3, 0.03, 1.6, 0xfff8ee); spot(x, z - 2.2, 1.6, 'vehicle', 'Look at this one'); C.addCircle(O.x + x, O.z + z, 1.6, 0); }
      counter(W / 2 - 2, D - 1.2, 2.2, 0.8, S.counter);
      for (let i = 0; i < 2; i++) { tableTop(-W / 2 + 3 + i * 3, D - 2.5, 1.0, 1.0); chair(-W / 2 + 3 + i * 3, D - 1.6, -Math.PI / 2, -W / 2 + 3 + i * 3, D - 2.5); chair(-W / 2 + 3 + i * 3, D - 3.4, Math.PI / 2, -W / 2 + 3 + i * 3, D - 2.5); }
      kp(W / 2 - 2, D - 0.5, -Math.PI / 2, 'idle', 'keeper');
      spot(W / 2 - 2, D - 2.1, 1.2, 'counter', 'Talk to the salesman');
      R.customers = 2;
    } else if (tpl === 'shop') {
      const cw = Math.min(W * 0.45, 7);
      if (lay === 'cases') {
        // glass display cases in a U, staff behind them
        counter(0, D - 1.8, cw * 1.3, 0.8, S.counter, true);
        for (const s of [-1, 1]) { counter(s * (W / 2 - 1.6), D / 2, 0.8, D * 0.5, S.counter, true); kp(s * (W / 2 - 0.9), D / 2, s > 0 ? Math.PI : 0, 'idle', 'helper'); chair(s * (W / 2 - 2.5), D / 2, s > 0 ? 0 : Math.PI, s * (W / 2 - 1.6), D / 2, { stool: true }); }
        kp(0, D - 1.0, -Math.PI / 2, 'idle', 'keeper');
        spot(0, D - 2.7, 1.5, 'counter', 'At the counter');
        browse(-2, D - 3); browse(2.2, D - 3.1);
      } else {
        counter(0, D - 1.6, cw, 0.8, S.counter, lay === 'island');
        kp(0, D - 0.8, -Math.PI / 2, 'idle', 'keeper');
        spot(0, D - 2.5, 1.4, 'counter', 'At the counter');
        const cols = style === 'clinical' ? [0xffffff, 0x8fd3c1, 0xe8eef0, 0xd1495b, 0x2e86ab] : style === 'pastel' ? [0xff8fab, 0xffd166, 0xffffff, 0xc77dff, 0x80ed99] : null;
        if (lay === 'aisles') {
          // rows of shelving, both sides stocked, aisles in between
          for (let x = -W / 2 + 3; x <= W / 2 - 3 + 0.01; x += 2.6) { shelf(x, D * 0.45, D * 0.5, true, 5, 1.9, cols); browse(x + 1.3, D * 0.35); }
          shelf(-W / 2 + 0.3, D / 2, D * 0.8, true, 5, 2.2, cols); shelf(W / 2 - 0.3, D / 2, D * 0.8, true, 5, 2.2, cols);
          if (dz.scale > 1.2) { counter(-W / 2 + 2.5, 1.6, 2.2, 0.7, S.counter); counter(-W / 2 + 5.5, 1.6, 2.2, 0.7, S.counter); kp(-W / 2 + 2.5, 2.2, -Math.PI / 2, 'idle', 'helper'); }   // checkouts
        } else if (lay === 'island') {
          // display tables with the products out, screens on the walls
          for (let x = -W / 4; x <= W / 4 + 0.01; x += W / 4) for (let z = 3; z <= D - 4.5; z += 3.2) {
            box(B, x, 0.45, z, 2.6, 0.9, 1.1, S.counter); solid(x, z, 2.6, 1.1, 2);
            for (let k = 0; k < 6; k++) box(GL, x - 1.0 + (k % 3) * 1.0, 0.92, z - 0.25 + Math.floor(k / 3) * 0.5, 0.18, 0.02, 0.32, 0x8ec5ff);
            browse(x, z - 1.0);
          }
          for (const s of [-1, 1]) for (let z = 2.5; z < D - 3; z += 2.2) box(GL, s * (W / 2 - 0.02), 1.7, z, 0.02, 0.9, 1.5, [0x3a86ff, 0xff006e, 0x8338ec, 0xfb5607][(z | 0) % 4]);
        } else {
          shelf(-W / 2 + 0.3, D / 2, D * 0.7, true, 4, 2.2, cols); shelf(W / 2 - 0.3, D / 2, D * 0.7, true, 4, 2.2, cols);
          if (W > 12) shelf(0, D * 0.4, W * 0.35, false, 3, 1.4, cols);
          browse(-W / 2 + 1.4, D / 2); browse(W / 2 - 1.4, D / 2 + 1);
        }
      }
      R.customers = Math.min(6, R.browse.length);
    } else {
      // clinic / lodge / chowki / office
      counter(0, D - 1.6, Math.min(W * 0.45, 6), 0.8, tpl === 'chowki' ? 0x6b5a36 : tpl === 'lodge' ? 0x6b3a26 : S.counter);
      kp(0, D - 0.8, -Math.PI / 2, 'idle', 'keeper');
      spot(0, D - 2.5, 1.4, 'counter', tpl === 'clinic' ? 'See the doctor' : tpl === 'lodge' ? 'Reception' : tpl === 'chowki' ? 'Talk to the havaldar' : 'At the counter');
      if (tpl === 'clinic') {
        // a waiting area in rows, doctors' cabins along one side
        for (let r = 0; r < 2; r++) for (let x = -W / 2 + 1.5; x <= -1; x += 0.7) chair(x, 2.5 + r * 1.5, Math.PI / 2, x, 6, { seat: { wait: true } });
        for (let z = 2; z < D - 3; z += 3) { box(B, W / 2 - 1.6, H / 2, z, 0.08, H, 0.08, 0xe0e6e4); box(B, W / 2 - 1.6, 1.2, z + 1.5, 0.06, 2.4, 2.0, 0xd8e6e2); box(GL, W / 2 - 1.62, 2.3, z + 1.5, 0.02, 0.2, 0.8, 0x2e8b6e); solid(W / 2 - 1.6, z + 1.5, 0.1, 2.0); }
        box(GL, 0, 2.9, D - 0.04, 1.2, 0.5, 0.02, 0xff3a2a);   // a red cross sign
      } else if (tpl === 'lodge') {
        sofa(-W / 2 + 0.7, 3.2, 0, 2.6, 0x6b3a26); sofa(-W / 2 + 0.7, 6.2, 0, 2.6, 0x6b3a26);
        for (const z of [2.6, 3.8, 5.6, 6.8]) R.seats.push({ x: O.x - W / 2 + 0.85, z: O.z + z, yaw: 0, table: { x: O.x - W / 2 + 2, z: O.z + 4.7 }, used: false, wait: true });
        browse(W / 2 - 2, D - 2.2);
        box(B, -W / 2 + 2.0, 0.22, 4.7, 1.0, 0.44, 1.6, 0x4a2e1e); solid(-W / 2 + 2.0, 4.7, 1.0, 1.6, 2);
        box(B, W / 2 - 0.6, 1.3, D - 1.2, 0.2, 2.6, 1.2, 0x8a8a8a); box(GL, W / 2 - 0.72, 2.2, D - 1.2, 0.02, 0.2, 0.3, 0xffb050);     // the lift
      } else if (tpl === 'office') {
        for (let x = -W / 2 + 2.5; x <= W / 2 - 2.5 + 0.01; x += 3) { tableTop(x, 3.4, 1.6, 0.8); chair(x, 4.2, -Math.PI / 2, x, 3.4); box(GL, x, 1.0, 3.3, 0.6, 0.35, 0.03, 0x8ec5ff); }
      } else {
        for (let i = 0; i < 5; i++) chair(-W / 2 + 0.5, 1.5 + i * 0.7, 0, 2, 1.5 + i * 0.7, { seat: { wait: true } });
        box(B, W / 2 - 0.05, 1.9, D / 2, 0.03, 1.0, 1.6, 0xd8cfa8);   // notice board
      }
      R.customers = tpl === 'chowki' ? 2 : 4;
    }
    const mesh = new THREE.Mesh(B.build(), this.mat); mesh.receiveShadow = false; mesh.castShadow = false;
    const glow = GL.empty ? null : new THREE.Mesh(GL.build(), this.glowMat);
    const grp = new THREE.Group(); grp.add(mesh); if (glow) grp.add(glow); for (const d of R.dyn) grp.add(d);
    for (const m of R.signs || []) grp.add(m);
    grp.visible = false;
    this.g.scene.add(grp);
    R.group = grp;
    this.rooms[dz.key] = R;
    return R;
  }
  // a printed sign: dark board, white capitals, a stripe in the shop's colour (both faces)
  sign(R, text, x, y, z, ry, w = 2, accent = 0xc9a227) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112;
    const g = cv.getContext('2d');
    g.fillStyle = '#16171b'; g.fillRect(0, 0, 512, 112);
    g.fillStyle = '#' + accent.toString(16).padStart(6, '0'); g.fillRect(0, 98, 512, 14);
    g.fillStyle = '#f4f2ee'; g.font = '700 46px Archivo, Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text.toUpperCase().replace(' AND ', ' & '), 256, 52, 490);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    // two faces back to back, so it reads the right way round from either side of the rack
    const geo = new THREE.PlaneGeometry(w, w * 112 / 512), mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const m = new THREE.Group();
    const a = new THREE.Mesh(geo, mat), b = new THREE.Mesh(geo, mat); b.rotation.y = Math.PI;
    m.add(a, b);
    m.position.set(R.O.x + x, FLOOR + y, R.O.z + z); m.rotation.y = ry;
    (R.signs || (R.signs = [])).push(m);
    return m;
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
    if (!tpl || !P.onFoot || this.cur || P.x > SLOT0 - 1000) return false;      // never from inside another room
    const R = this.room(designOf(ctx));
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
    if (G.crowd) { this.capWas = G.crowd.cap; G.crowd.cap = Math.max(G.crowd.cap, tpl === 'club' ? 22 : 14); }
    G.audio.duck?.(0.2, 2);
    if (tpl === 'club') G.club.beat(true);
    G.shops.speak(ctx.kind, 'hello');
    return true;
  }
  exit() {
    const G = this.g, P = G.player, C = this.cur;
    if (!C) return;
    if (C.seat) this.stand();
    for (const p of C.R.peds || []) { if (p.name && this._mem && !p.dateWith) this._mem[p.name] = { walkedOff: p.walkedOff, interest: p.interest, approached: p.approached }; G.people.remove(p); }
    C.R.peds = [];
    for (const m of C.R.hearts || []) G.scene.remove(m);
    C.R.hearts = [];
    G.date && G.date.cur && G.date.close();
    C.R.group.visible = false;
    if (C.R.shown) { for (const v of C.R.shown) v.dispose(); C.R.shown = null; }
    if (C.R.tpl === 'club') G.club.beat(false);
    // back out of the door, facing the street
    const d = C.door, back = d.yaw + Math.PI;
    if (d.x > SLOT0 - 1000) { const sp = G.safeDrop(C.ctx.x, C.ctx.z); if (sp) { d.x = sp.x; d.z = sp.z; } }
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
    const G = this.g, ppl = G.people, kit = G.W.kit;
    // the same crowd while it's the same crowd: a club keeps its people all night, anywhere else for a couple of
    // hours. Walk out and back in and it's who you left (and who walked off on you); later on it's new faces
    const key = venueKey(ctx), slot = R.tpl === 'club' ? 'n' + nightOf(G) : 'h' + Math.floor((G.clock || 0) / 2);
    let seed = 7; for (const ch of key + slot) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rng = this.rng = new RNG(seed), pplRng = ppl.rng; ppl.rng = rng;
    this._mem = (this.mem || (this.mem = {}))[key + slot] || (this.mem[key + slot] = {});
    for (const k of Object.keys(this.mem)) if (k.startsWith(key) && k !== key + slot) delete this.mem[k];
    let made = 0;
    R.peds = [];
    this._ctx = ctx;
    const make = this._make = (x, z, yaw, anim, female, opts = {}) => {
      const e = G.W.graph.edges[0];
      const p = ppl.make(e, 1, 1, { female, mode: 'fixed', adult: true });
      p.fixed = true; p.mode = 'fixed'; p.interior = true; p.x = x; p.z = z; p.yaw = yaw; p.hx = Math.cos(yaw); p.hz = Math.sin(yaw);
      p.anim = anim; p.idle = anim; p.onRoad = false;
      p.persona = opts.persona || ppl.pickPersona(female, ctx.x, ctx.z);
      if (kit) {
        const lr = new RNG(seed + 977 * ++made);
        p.look = opts.police ? kit.randomLook(lr, { role: 'police' }) : kit.randomLook(lr, { female, dress: /^kp|college/.test(p.persona) ? 'modern' : undefined });
        p.shirt = [p.look.top.r, p.look.top.g, p.look.top.b]; p.lower = [p.look.bottom.r, p.look.bottom.g, p.look.bottom.b]; p.skin = [p.look.skin.r, p.look.skin.g, p.look.skin.b];
      }
      R.peds.push(p);
      return p;
    };
    const taken = new Set(G.date && G.date.pending ? [G.date.pending.ct.name] : []);
    const name = (q) => { const c = pickCast(rng, q.female, taken, R.tpl); if (c) { taken.add(c.name); castAs(q, c, kit); } return q; };
    this._name = name;
    for (const k of R.people) make(k.x, k.z, k.yaw, k.anim, k.role === 'teller' ? rng.chance(0.6) : rng.chance(0.25), { police: R.tpl === 'chowki' && k.role === 'keeper' });
    for (const s of R.seats) s.used = false;
    // customers at tables, eating and chatting
    const free = R.seats.filter(s => !s.salon);
    // customers: at tables, or browsing the shelves and racks
    const stand = (R.browse || []).slice();
    for (let i = 0; i < (R.customers || 0); i++) {
      if (free.length && !(stand.length && rng.chance(0.35))) {
        const s = free.splice(rng.int(0, free.length - 1), 1)[0];
        s.used = true; const q = make(s.x, s.z, s.yaw, s.wait ? rng.pick(['sit', 'sit', 'phone']) : rng.pick(['sit', 'sit_talk']), rng.chance(0.4));
        if (q.anim === 'phone') q.anim = q.idle = 'sit';
        if (/cafe|eatery/.test(R.tpl) && rng.chance(0.5)) name(q);
      } else if (stand.length) {
        const [x, z] = stand.splice(rng.int(0, stand.length - 1), 1)[0];
        const q = make(x + rng.range(-0.3, 0.3), z + rng.range(-0.3, 0.3), rng.range(0, 6.28), rng.pick(['idle', 'phone', 'idle']), rng.chance(0.45));
        if (/cafe|eatery/.test(R.tpl) && rng.chance(0.4)) name(q);
      }
    }
    // a full dance floor (busier late), people at the bar
    if (R.dancers) {
      const n = Math.round(R.dancers * (G.hour > 22 || G.hour < 2 ? 1.3 : 0.8));
      for (let i = 0; i < n; i++) {
        const F0 = R.floor, p = make(F0.x + rng.range(-F0.w / 2 + 0.6, F0.w / 2 - 0.6), F0.z + rng.range(-F0.d / 2 + 0.6, F0.d / 2 - 0.6), rng.range(0, 6.28), 'dance', rng.chance(0.5));
        p.dancer = true; name(p);
      }
      for (let i = 0; i < 5; i++) { const q = make(R.O.x - R.W / 2 + 2.6, R.O.z + R.D / 2 - 3 + i * 1.3, Math.PI, rng.pick(['drink', 'talk', 'idle']), rng.chance(0.45)); name(q); q.atBar = true; }
      for (const s of R.seats) if (s.sofa && rng.chance(0.6)) { s.used = true; const q = make(s.x, s.z, s.yaw, rng.pick(['sit', 'sit_talk']), rng.chance(0.5)); name(q); }
    }
    if (R.lifters) for (let i = 0; i < R.lifters; i++) make(R.O.x - 4 + i * 2.6, R.O.z + 3.8, Math.PI / 2, rng.pick(['crouch', 'push', 'idle']), rng.chance(0.3));
    // everyone who isn't staff has a name and is someone you could talk to (young, out, up for it)
    const staff = R.people.length;
    R.peds.forEach((q, k) => {
      if (k < staff || q.police) return;
      if (!q.name) name(q);
      if (q.name && /^(kaka|ajoba|kaku|aaji|aunty)$/.test(q.persona)) q.persona = q.female ? rng.pick(['collegegirl', 'kpgirl']) : rng.pick(['collegeboy', 'kpguy']);
    });
    ppl.rng = pplRng;
    // what happened the last time you were in (same crowd): who walked off, who you got along with
    for (const p of R.peds) { const m = p.name && this._mem[p.name]; if (m) { p.walkedOff = m.walkedOff; p.interest = m.interest; p.approached = m.approached; } }
    this.markHearts(R);
  }
  addPerson(x, z, yaw, anim, female) { if (!this.cur || !this._make) return null; const p = this._make(x, z, yaw, anim, !!female); this.markHearts(this.cur.R); return p; }
  // a small heart over the people who'd be up for a chat (the other gender from you, not walked off)
  // a heart over everyone you could talk to: pink for someone new, blue for someone you're talking to or
  // seeing, black for your partner (and bigger over the one you're here to meet)
  heartTex(fill, line) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = fill; x.strokeStyle = line; x.lineWidth = 4;
    x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(4, 34, 8, 8, 32, 20); x.bezierCurveTo(56, 8, 60, 34, 32, 54); x.closePath(); x.stroke(); x.fill();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true, toneMapped: false });
  }
  recolourHearts() { const R = this.cur && this.cur.R; if (R && R.hearts && this.heartMats) for (const m of R.hearts) m.material = this.heartMats[this.heartKind(m.userData.p)]; }
  heartKind(p) {
    const D = this.g.date, ct = D && p.name && (D.contacts || []).find(c => c.name === p.name && !c.done);
    if (ct && ct.partner) return 'partner';
    if (ct || p.dateWith || (p.interest || 0) > 0) return 'seeing';
    return 'new';
  }
  markHearts(R) {
    const G = this.g;
    if (!this.heartMats) this.heartMats = { new: this.heartTex('#ff5c7a', '#2a0a12'), seeing: this.heartTex('#3d8bff', '#06142e'), partner: this.heartTex('#111114', '#f4f1ea') };
    for (const m of R.hearts || []) G.scene.remove(m);
    R.hearts = [];
    for (const p of R.peds) {
      if (!p.name || !(p.dateWith || G.date && G.date.eligible(p))) continue;
      const m = new THREE.Sprite(this.heartMats[this.heartKind(p)]); m.scale.setScalar(p.dateWith ? 0.34 : 0.22);
      m.position.set(p.x, FLOOR + (/sit/.test(p.anim) ? 1.55 : 2.05), p.z); m.userData.p = p;
      G.scene.add(m); R.hearts.push(m);
    }
  }
  showVehicles(R) {
    const G = this.g, types = ['scooter', 'bike', 'hatch', 'suv'];
    R.shown = R.display.map(([x, z], i) => {
      const v = new Vehicle(G.W, G.scene, G.vmats, types[i], [[0.78, 0.1, 0.1], [0.1, 0.12, 0.16], [0.92, 0.92, 0.9], [0.18, 0.32, 0.62]][i]);
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
    // someone close by beats a big area spot (the dance floor covers the whole floor, so it used to hide everyone on it)
    let talk = null, td = 1e9;
    // (sitting down, only the person you're on a date with: you're at their table)
    if (C.R.peds) { const D = this.g.date; for (const p of C.R.peds) { if (!p.name || p.walkedOff || !(p.dateWith || D && D.eligible(p)) || (C.seat && !p.dateWith)) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < 2.4 && d < td) { td = d; talk = { kind: 'talk', p, label: p.dateWith ? (C.seat ? `Talk to ${p.name}` : `Sit with ${p.name}`) : `Talk to ${p.name}` }; } } }
    if (talk && (!best || td < bd || (best.r >= 3 && td < 1.9))) best = talk;
    if (best && C.ctx.kind === 'optician' && (best.kind === 'rack' || best.kind === 'counter')) best = { ...best, kind: 'counter', label: best.kind === 'rack' ? 'Try on frames' : 'Eye test and glasses' };
    if (best && C.ctx.kind === 'shoes' && best.kind === 'rack') best = { ...best, kind: 'counter', label: 'Try on shoes' };
    if (C.seat) best = talk && talk.p.dateWith && !C.eating ? talk : { kind: 'stand', label: C.eating ? 'Eating…' : 'Get up' };
    if (C.dancing && !(talk && td < 1.9)) best = { kind: 'undance', label: 'Stop dancing' };
    return best;
  }
  label(s) { return s.label; }
  use(s) {
    const G = this.g, C = this.cur, P = G.player, ctx = C.ctx;
    switch (s.kind) {
      case 'exit': this.exit(); return;
      case 'counter': case 'bar':
        if (C.R.tpl === 'boutique' && ctx.kind !== 'optician') { G.trial.show({ ...ctx, kind: 'shoes', inside: true }, 'shoes'); return; }
        G.shops.show({ ...ctx, inside: true, spot: s.kind }); G.shops.speak(ctx.kind, 'hello'); return;
      case 'atm': G.shops.show({ ...ctx, kind: 'bank', inside: true, atm: true }); return;
      case 'rack': G.trial.show({ ...ctx, kind: 'clothes', inside: true }, 'clothes', s.sub); return;
      case 'mirror': { const st = G.life.style(); G.hud.toast(st.odd ? 'Bold. Very bold.' : st.score > 0.85 ? 'Looking sharp' : 'Not bad', st.odd ? 'People will talk. Let them.' : st.score > 0.85 ? 'This suits the area' : 'Something more local might fit in better here', 'info', 3); P.human.play('yes', { once: true, restart: true }); P.act = { kind: 'hurt', t: 0, dur: 1 }; return; }
      case 'chair': { const seat = C.R.seats.find(q => q.salon && Math.hypot(q.x - s.x, q.z - (s.z + 1)) < 1.6) || C.R.seats.find(q => q.salon); this.sit(seat, true); G.trial.show({ ...ctx, kind: 'barber', inside: true }, 'salon'); return; }
      case 'seat': this.sit(s.seat); if (C.plate) this.eat(); return;
      case 'stand': if (!C.eating) this.stand(); return;
      case 'dance': this.dance(true); return;
      case 'undance': this.dance(false); return;
      case 'workout': G.shops.show({ ...ctx, kind: 'gym', inside: true }); return;
      case 'vehicle': G.shops.show({ ...ctx, kind: 'dealer', inside: true }); return;
      case 'talk':
        if (C.dancing) this.dance(false);
        // a date: sit down next to them first, then talk
        if (s.p.dateWith && !C.seat) { const seat = this.dateSeatFor(s.p); if (seat) { seat.used = false; this.sit(seat); } }
        G.date && G.date.talk(s.p, C); return;
    }
  }
  // where you sit on a date: across the table from them, or beside them if there's no chair opposite
  dateSeatFor(p) {
    const R = this.cur.R, d = (a, x, z) => Math.hypot(a.x - x, a.z - z);
    const hers = R.seats.filter(q => !q.salon && q.table).sort((a, b) => d(a, p.x, p.z) - d(b, p.x, p.z))[0];
    if (!hers || d(hers, p.x, p.z) > 0.6) return null;
    const T = hers.table, mates = R.seats.filter(q => q !== hers && q.table && Math.hypot(q.table.x - T.x, q.table.z - T.z) < 0.05);
    const hx = hers.x - T.x, hz = hers.z - T.z;
    const across = mates.filter(q => (q.x - T.x) * hx + (q.z - T.z) * hz < 0).sort((a, b) => d(a, hers.x, hers.z) - d(b, hers.x, hers.z))[0];
    const pick = across || mates.sort((a, b) => d(a, hers.x, hers.z) - d(b, hers.x, hers.z))[0];
    if (!pick) return null;
    // whoever was sitting there finds another table
    for (const q of R.peds.slice()) if (q !== p && d(q, pick.x, pick.z) < 0.35) { this.g.people.remove(q); R.peds.splice(R.peds.indexOf(q), 1); }
    return pick;
  }
  sit(seat, salon) {
    const C = this.cur, P = this.g.player;
    if (!seat) return;
    seat.used = true; C.seat = seat;
    P.foot.x = seat.x; P.foot.z = seat.z; P.foot.yaw = seat.yaw; P.foot.vx = P.foot.vz = 0;
    P.seated = true;
    P.human.play('sit', { fade: 0.45 });
    // the chat panel pauses your own update, so put you in the chair now rather than when it closes
    const H = P.human;
    if (H && H.holder) { H.holder.position.x = seat.x; H.holder.position.z = seat.z; H.holder.rotation.set(0, -seat.yaw, 0); H.mixer.update(0.6); }
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
    const drink = /chai|coffee|tea|lassi|taak|mastani|juice|cola|soda|beer|cocktail|mocktail|sharbat|shake|water|whisky|rum|vodka|wine|shot|kokum|neer/i.test(plate.name);
    // what's on the table: a plate of food, or a glass
    const t = C.seat.table, tx = t.x + (C.seat.x - t.x) * 0.35, tz = t.z + (C.seat.z - t.z) * 0.35;
    const objs = [];
    if (!drink) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.03, 16), new THREE.MeshLambertMaterial({ color: 0xd9dde2 }));
      const food = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xc9772e }));
      m.position.set(tx, FLOOR + 0.79, tz); food.position.set(tx, FLOOR + 0.8, tz);
      objs.push(m, food); G.scene.add(m, food); C._food = food;
    }
    // the glass (or the spoonful) travels in your right hand
    const cup = new THREE.Mesh(drink ? new THREE.CylinderGeometry(0.035, 0.028, 0.1, 12) : new THREE.SphereGeometry(0.02, 8, 6),
      new THREE.MeshLambertMaterial({ color: drink ? (/beer|whisky|rum|cola|coffee|chai/i.test(plate.name) ? 0x9a5b22 : 0xe8d6a8) : 0xc9772e, transparent: drink, opacity: drink ? 0.85 : 1 }));
    const hand = P.human.root.getObjectByName('hand_r');
    if (hand) { hand.add(cup); cup.position.set(0, 0.08, 0.02); cup.scale.setScalar(1 / (P.look.scale || 1)); }
    P.human.play('sit', { fade: 0.2 });
    G.hud.toast(`${drink ? 'Drinking' : 'Eating'}: ${plate.name}`, 'Take your time', 'info', 2.4);
    // the sitting pose stays; the right arm goes table → mouth and back, a sip or a bite every couple of seconds
    const yaw = C.seat.yaw, fx = Math.cos(yaw), fz = Math.sin(yaw);
    const head = P.human.root.getObjectByName('Head'), mouth = new THREE.Vector3(), tgt = new THREE.Vector3(), pole = new THREE.Vector3(), rest = new THREE.Vector3(tx, FLOOR + 0.86, tz);
    let ph = 0;
    P.postPose = (H, dt) => {
      ph += dt;
      if (!head) return;
      head.getWorldPosition(mouth); mouth.x += fx * 0.1; mouth.z += fz * 0.1; mouth.y -= 0.02;
      const cyc = (ph % 2.6) / 2.6, lift = cyc < 0.25 ? cyc / 0.25 : cyc < 0.55 ? 1 : cyc < 0.8 ? 1 - (cyc - 0.55) / 0.25 : 0;
      const e = lift * lift * (3 - 2 * lift);
      tgt.copy(rest).lerp(mouth, e);
      if (drink) tgt.y -= 0.02 * (1 - e);
      pole.set(fz, -0.6, -fx).normalize();       // the elbow out to the side and down
      ikArm(H, 'r', tgt, pole, Math.min(1, ph * 3));
      cup.rotation.z = drink ? -e * 0.9 : 0;
    };
    const steps = 5; let k = 0;
    const tick = setInterval(() => {
      k++;
      const part = {}; for (const [a, v] of Object.entries(plate.eff)) part[a] = v / steps;
      G.life.apply(part);
      if (C._food) C._food.scale.setScalar(Math.max(0.05, 1 - k / steps));
      if (k >= steps) {
        clearInterval(tick); for (const o of objs) { G.scene.remove(o); o.geometry.dispose(); }
        cup.parent && cup.parent.remove(cup); cup.geometry.dispose(); C._food = null; P.postPose = null;
        C.eating = false; G.life.s.tally.meals++;
        G.hud.toast('Done', drink ? 'Glass empty' : 'Wipe your hands, pay the bill, belch politely', 'good', 2.2);
        // finished: get up from the table
        if (this.cur === C && C.seat && !C.dateTable) setTimeout(() => { if (this.cur === C && C.seat && !C.eating) this.stand(); }, 900);
      }
    }, 1300);
  }
  dance(on) {
    const G = this.g, C = this.cur, P = G.player;
    C.dancing = on;
    if (on) { P.human.play('dance', { fade: 0.3 }); P.seated = true; G.hud.toast('On the floor', 'Mood up, energy down. F to stop', 'info', 2.2); C.danceT = 0; }
    else { P.human.play('idle', { fade: 0.3 }); P.seated = false; }
  }
  // people come up to you. Clubs late at night most of all, while you dance, more with charm, and a lot more
  // if you're a woman. They walk over, then it's your call: talk, dance, smile them off, or turn them down
  approachTick(dt) {
    const G = this.g, C = this.cur, D = G.date, P = G.player, R = C.R;
    if (!D || !R.peds || !/club|cafe|eatery/.test(R.tpl)) return;
    const A = C.appr;
    if (A) {
      const p = A.p, tx = A.phase === 'back' ? A.home.x : P.x, tz = A.phase === 'back' ? A.home.z : P.z;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1e-3, stop = A.phase === 'back' ? 0.05 : 0.95;
      if (A.phase === 'talk') return;
      if (A.phase === 'walk' && (G.state !== 'play' || C.seat || (A.t += dt) > 20)) { this.approachDone(p); return; }
      p.yaw = Math.atan2(dz, dx); p.hx = dx / d; p.hz = dz / d;
      if (d > stop) { const st = Math.min(d - stop, 1.3 * dt); p.x += dx / d * st; p.z += dz / d * st; p.anim = 'walk'; return; }
      if (A.phase === 'back') { p.yaw = A.home.yaw; p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw); p.anim = A.home.anim; p.idle = A.home.idle; C.appr = null; return; }
      A.phase = 'talk'; p.anim = p.idle = 'talk';
      if (!D.approach(p, C)) this.approachDone(p);
      return;
    }
    if ((C.apprCool = (C.apprCool || 0) - dt) > 0) return;
    if (G.state !== 'play' || C.seat || C.eating || D.cur || R.peds.some(q => q.dateWith)) return;
    const club = R.tpl === 'club', late = G.hour >= 21 || G.hour < 3;
    let rate = club ? (late ? 1 / 70 : 1 / 160) : 1 / 480;      // per second, for a man
    if (P.look.female) rate *= 3.2;
    if (C.dancing) rate *= 1.8;
    rate *= 0.4 + G.life.charm * 1.2;
    if (G.life.s.drunk >= 0.7) rate *= 0.4;
    if (this.rng.next() > rate * dt) return;
    const cand = R.peds.filter(q => q.name && !q.approached && !q.walkedOff && D.eligible(q) && !/sit/.test(q.anim) && Math.hypot(q.x - P.x, q.z - P.z) > 2 && Math.hypot(q.x - P.x, q.z - P.z) < 16);
    if (!cand.length) { C.apprCool = 10; return; }
    const p = cand[this.rng.int(0, cand.length - 1)];
    p.approached = true;
    C.appr = { p, phase: 'walk', t: 0, home: { x: p.x, z: p.z, yaw: p.yaw, anim: p.anim, idle: p.idle } };
  }
  // the chat's over: they go back where they were (unless they're dancing with you now)
  approachDone(p) {
    const C = this.cur;
    if (!C || !C.appr || C.appr.p !== p) return;
    C.apprCool = this.rng.range(20, 45);
    if (p.anim === 'dance' && C.dancing) { C.appr = null; return; }
    C.appr.phase = 'back';
  }
  update(dt) {
    const C = this.cur, G = this.g;
    if (!C) return;
    const R = C.R;
    this.approachTick(dt);
    // the floor pulses with the beat
    if (R.ball) R.ball.rotation.y += dt * 0.8;
    if (R.hearts) { const t = performance.now() / 1000, recolour = (this._hk = (this._hk || 0) + 1) % 20 === 0; for (const m of R.hearts) { const p = m.userData.p; m.visible = !p.walkedOff && !(G.date && G.date.cur && G.date.cur.p === p); if (recolour) m.material = this.heartMats[this.heartKind(p)]; m.position.x = p.x; m.position.z = p.z; m.position.y += Math.sin(t * 3 + p.id) * 0.002; } }
    if (R.dyn.length) {
      const t = performance.now() / 1000, beat = (t * 124 / 60) % 1;
      R.dyn.forEach((g, i) => { if (g === R.ball) return; const h = ((i * 0.13 + t * 0.1) % 1); const v = (beat < 0.25 ? 1 : 0.35) * (((i + Math.floor(t * 2.07)) % 3) ? 0.5 : 1); g.material.color.setHSL(h, 0.9, 0.12 + v * 0.35); });
    }
    if (C.dancing) {
      C.danceT += dt;
      G.life.apply({ mood: dt * 0.012, energy: -dt * 0.004, thirst: -dt * 0.003 });
      if (G.life.s.energy < 0.08) { this.dance(false); G.hud.toast('You’re spent', 'Sit down, drink some water', 'warn', 2.4); }
    }
    // indoor light: steady, whatever the time outside
    if (G.sky) { G.sky.hemi.intensity = Math.PI * (R.tpl === 'club' ? 1.05 : 0.95); if (R.tpl === 'club') G.sky.hemi.color.setRGB(0.85, 0.6, 1); else G.sky.hemi.color.setRGB(1, 0.97, 0.92); G.sky.hemi.groundColor.setRGB(0.55, 0.52, 0.5); G.sky.sun.intensity = R.tpl === 'club' ? 0.9 : 1.2; }
  }
}
const UNIT = new THREE.BoxGeometry(1, 1, 1);
// a venue's identity, and which night it is (a night runs noon to noon, so 1 AM is still last night)
export const venueKey = (ctx) => `${Math.round(ctx.x)},${Math.round(ctx.z)}`;
export const nightOf = (G) => Math.round(((G.clock || 0) - G.hour) / 24) - (G.hour < 12 ? 1 : 0);
