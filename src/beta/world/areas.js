// What kind of Pune a spot is, and so how its buildings, footpaths and streets are made. Thirty kinds of place, each a
// recipe of about twenty settings (how rich, how old, how worn, what's on the roofs, which railings, how broken the
// footpath is, how many wires...). Every named neighbourhood on the map (OpenStreetMap's suburbs, about three
// hundred of them, plus the game's own central areas) is one of these kinds, with a reach.
//
// Nothing changes at a line: at any spot the kinds of the places around it are mixed by distance (a soft bell, so a
// peth fades into a college strip over a few hundred metres), and each building draws its own character from that
// mix with its own seed. Near the edge of two areas you get some of each, the way a real street goes.
// No three.js in here: the worker that builds the houses uses it too.

// ---- the kinds. Settings are 0..1 unless noted
// wealth, age, wear (grime, stains), clutter (what's hung on and stacked about), wires, fp (footpath kept: 1 smooth,
// 0 broken), mess (hawkers, bikes, rubble on the footpath), green, tanks (Sintex on the roof), solar, dish, laundry,
// plants, ac, grille (MS window grilles), rail (MS balcony railings), gallery (carved wooden galleries), arcade
// (colonial verandahs), glass (glass railings and glazing), balcony, chajja, uc (under construction), tiles (Mangalore
// tile roofs), tin, terrace (a garden up top), brick (bare brick), stone, acp (cladding on shop fronts), awning,
// rangoli, flex (banners), pal (palette), floors (storeys when the map doesn't know: [min, max])
const D = { wealth: .45, age: .5, wear: .5, clutter: .5, wires: .4, fp: .5, mess: .4, green: .3, tanks: .6, solar: .2, dish: .3, laundry: .4, plants: .3,
  ac: .3, grille: .6, rail: .5, gallery: 0, arcade: 0, glass: .05, balcony: .5, chajja: .7, uc: .02, tiles: 0, tin: .05, terrace: .02, brick: .03, stone: .02,
  acp: .2, awning: .3, rangoli: .1, flex: .3, pal: 'society', floors: [2, 5] };
const K = (name, o) => ({ name, ...D, ...o });
export const KINDS = [
  K('Old peth, residential', { wealth: .4, age: .92, wear: .7, clutter: .55, wires: .95, fp: .35, mess: .45, green: .15, tanks: .75, solar: .15, dish: .35, laundry: .5, plants: .55,
    ac: .15, grille: .55, rail: .7, gallery: .5, balcony: .55, chajja: .6, tiles: .45, tin: .1, stone: .15, acp: .05, awning: .45, rangoli: .7, flex: .45, pal: 'peth', floors: [1, 3] }),
  K('Peth bazaar', { wealth: .4, age: .85, wear: .8, clutter: .95, wires: 1, fp: .2, mess: .95, green: .05, tanks: .7, dish: .3, laundry: .35, plants: .2, ac: .2, grille: .45,
    rail: .55, gallery: .25, balcony: .4, chajja: .55, tiles: .3, tin: .2, acp: .15, awning: .85, rangoli: .2, flex: .7, pal: 'peth', floors: [2, 4] }),
  K('Mandai and market yard', { wealth: .3, age: .7, wear: .9, clutter: 1, wires: .8, fp: .1, mess: 1, green: .05, tanks: .5, laundry: .2, plants: .05, grille: .4, rail: .3,
    balcony: .2, tiles: .25, tin: .5, acp: .05, awning: .95, flex: .6, pal: 'bazaar', floors: [1, 3] }),
  K('Heritage core', { wealth: .5, age: 1, wear: .45, clutter: .2, wires: .4, fp: .65, mess: .3, green: .35, tanks: .2, dish: .05, laundry: .1, plants: .4, ac: .05, grille: .4,
    rail: .4, gallery: .6, balcony: .3, tiles: .7, stone: .5, acp: 0, awning: .2, rangoli: .5, flex: .15, pal: 'heritage', floors: [1, 3] }),
  K('College strip', { wealth: .55, age: .55, wear: .55, clutter: .7, wires: .7, fp: .5, mess: .75, green: .45, tanks: .6, dish: .3, laundry: .45, plants: .3, ac: .35, grille: .55,
    rail: .5, balcony: .5, acp: .45, awning: .45, rangoli: .05, flex: 1, pal: 'society', floors: [2, 5] }),
  K('Old bungalows', { wealth: .75, age: .75, wear: .35, clutter: .2, wires: .45, fp: .7, mess: .15, green: .9, tanks: .5, solar: .35, dish: .2, laundry: .15, plants: .85, ac: .3,
    grille: .7, rail: .35, balcony: .4, chajja: .8, tiles: .35, terrace: .1, stone: .15, acp: .05, awning: .1, rangoli: .5, flex: .05, pal: 'bungalow', floors: [1, 2] }),
  K('Marathi middle-class societies', { wealth: .5, age: .5, wear: .5, clutter: .55, wires: .5, fp: .5, mess: .4, green: .45, tanks: .85, solar: .45, dish: .55, laundry: .65,
    plants: .6, ac: .4, grille: .8, rail: .6, balcony: .65, chajja: .85, acp: .2, awning: .3, rangoli: .4, flex: .45, pal: 'society', floors: [3, 6] }),
  K('Camp bazaar', { wealth: .6, age: .85, wear: .45, clutter: .6, wires: .55, fp: .65, mess: .55, green: .3, tanks: .4, dish: .2, laundry: .2, plants: .35, ac: .3, grille: .35,
    rail: .55, gallery: .15, arcade: .75, balcony: .5, chajja: .5, tiles: .35, stone: .2, acp: .35, awning: .65, rangoli: .05, flex: .35, pal: 'camp', floors: [2, 3] }),
  K('Cantonment lines', { wealth: .55, age: .8, wear: .15, clutter: .05, wires: .2, fp: .95, mess: .03, green: .95, tanks: .2, solar: .2, dish: .1, laundry: .05, plants: .5,
    ac: .1, grille: .4, rail: .3, arcade: .45, balcony: .2, chajja: .6, tiles: .6, stone: .25, acp: 0, awning: .05, rangoli: .1, flex: .02, pal: 'cantonment', floors: [1, 2] }),
  K('KP lanes', { wealth: .9, age: .55, wear: .2, clutter: .15, wires: .3, fp: .8, mess: .15, green: 1, tanks: .3, solar: .3, dish: .15, laundry: .05, plants: .9, ac: .55,
    grille: .35, rail: .4, glass: .35, balcony: .55, chajja: .5, tiles: .35, terrace: .3, stone: .3, acp: .3, awning: .35, rangoli: .1, flex: .1, pal: 'posh', floors: [1, 3] }),
  K('Posh mid-rise', { wealth: .9, age: .25, wear: .15, clutter: .1, wires: .15, fp: .85, mess: .15, green: .6, tanks: .1, solar: .2, dish: .1, laundry: .05, plants: .65, ac: .7,
    grille: .15, rail: .25, glass: .8, balcony: .75, chajja: .35, terrace: .3, stone: .4, acp: .7, awning: .2, rangoli: .05, flex: .1, pal: 'posh', floors: [5, 12] }),
  K('High street at night', { wealth: .85, age: .15, wear: .2, clutter: .35, wires: .15, fp: .85, mess: .3, green: .45, tanks: .1, dish: .1, laundry: .02, plants: .55, ac: .7,
    grille: .1, rail: .2, glass: .85, balcony: .6, chajja: .3, terrace: .35, stone: .35, acp: .9, awning: .45, flex: .25, pal: 'posh', floors: [3, 8] }),
  K('IT park', { wealth: .85, age: .1, wear: .1, clutter: .05, wires: .05, fp: .9, mess: .2, green: .5, tanks: 0, solar: .1, dish: .05, laundry: 0, plants: .3, ac: .2,
    grille: 0, rail: .1, glass: 1, balcony: .1, chajja: .1, uc: .08, stone: .3, acp: .8, awning: .1, rangoli: 0, flex: .15, pal: 'office', floors: [6, 14] }),
  K('New tower belt', { wealth: .7, age: .1, wear: .2, clutter: .2, wires: .2, fp: .55, mess: .35, green: .35, tanks: .1, solar: .35, dish: .25, laundry: .3, plants: .45, ac: .55,
    grille: .3, rail: .45, glass: .55, balcony: .8, chajja: .4, uc: .14, terrace: .1, brick: .04, stone: .2, acp: .5, awning: .3, rangoli: .15, flex: .55, pal: 'tower', floors: [7, 14] }),
  K('Gaothan', { wealth: .3, age: .85, wear: .7, clutter: .6, wires: .8, fp: .15, mess: .55, green: .5, tanks: .8, solar: .1, dish: .5, laundry: .7, plants: .5, ac: .1, grille: .55,
    rail: .5, gallery: .15, balcony: .35, chajja: .5, uc: .05, tiles: .5, tin: .35, brick: .12, stone: .3, acp: .05, awning: .5, rangoli: .8, flex: .55, pal: 'village', floors: [1, 3] }),
  K('Vasti', { wealth: .1, age: .6, wear: .95, clutter: 1, wires: 1, fp: .05, mess: .85, green: .15, tanks: .9, solar: 0, dish: .75, laundry: .95, plants: .3, ac: .02, grille: .3,
    rail: .25, balcony: .15, chajja: .25, uc: .1, tiles: .1, tin: .8, terrace: 0, brick: .55, stone: .05, acp: 0, awning: .55, rangoli: .55, flex: .6, pal: 'vasti', floors: [1, 3] }),
  K('Station area', { wealth: .35, age: .7, wear: .85, clutter: .85, wires: .9, fp: .25, mess: .9, green: .1, tanks: .7, dish: .4, laundry: .4, plants: .1, ac: .3, grille: .45,
    rail: .45, balcony: .35, chajja: .55, tin: .25, brick: .08, acp: .3, awning: .7, flex: .75, pal: 'bazaar', floors: [2, 5] }),
  K('Bus hub', { wealth: .3, age: .65, wear: .85, clutter: .85, wires: .85, fp: .2, mess: .95, green: .1, tanks: .6, dish: .35, laundry: .3, plants: .1, ac: .2, grille: .4,
    rail: .4, balcony: .3, chajja: .5, tin: .35, acp: .25, awning: .75, flex: .85, pal: 'bazaar', floors: [1, 4] }),
  K('MIDC industrial', { wealth: .35, age: .5, wear: .75, clutter: .4, wires: .65, fp: .3, mess: .35, green: .25, tanks: .55, solar: .3, dish: .1, laundry: .1, plants: .1, ac: .1,
    grille: .4, rail: .3, balcony: .05, chajja: .3, tin: .75, brick: .15, acp: .15, awning: .3, flex: .35, pal: 'industrial', floors: [1, 3] }),
  K('Planned PCMC', { wealth: .55, age: .35, wear: .35, clutter: .4, wires: .35, fp: .65, mess: .3, green: .55, tanks: .7, solar: .45, dish: .45, laundry: .5, plants: .6, ac: .45,
    grille: .7, rail: .6, glass: .15, balcony: .7, chajja: .75, uc: .04, acp: .3, awning: .3, rangoli: .4, flex: .45, pal: 'society', floors: [2, 6] }),
  K('Mixed dense suburb', { wealth: .4, age: .4, wear: .65, clutter: .75, wires: .75, fp: .3, mess: .65, green: .2, tanks: .85, solar: .2, dish: .6, laundry: .7, plants: .4, ac: .35,
    grille: .7, rail: .55, glass: .1, balcony: .6, chajja: .7, uc: .07, tin: .15, brick: .08, acp: .3, awning: .5, rangoli: .3, flex: .65, pal: 'mixed', floors: [3, 6] }),
  K('Riverside and ghats', { wealth: .5, age: .7, wear: .5, clutter: .25, wires: .35, fp: .5, mess: .25, green: .75, tanks: .4, dish: .2, laundry: .3, plants: .5, ac: .2,
    grille: .5, rail: .5, gallery: .2, balcony: .4, chajja: .6, tiles: .4, stone: .45, acp: .1, awning: .25, rangoli: .4, flex: .25, pal: 'peth', floors: [1, 3] }),
  K('Tekdi and hill edge', { wealth: .55, age: .35, wear: .3, clutter: .25, wires: .35, fp: .4, mess: .15, green: .9, tanks: .5, solar: .5, dish: .3, laundry: .3, plants: .65, ac: .35,
    grille: .55, rail: .5, glass: .25, balcony: .6, chajja: .6, uc: .06, terrace: .15, stone: .35, acp: .2, awning: .15, rangoli: .2, flex: .2, pal: 'bungalow', floors: [2, 6] }),
  K('Highway edge', { wealth: .3, age: .4, wear: .85, clutter: .65, wires: .6, fp: .05, mess: .6, green: .2, tanks: .55, solar: .1, dish: .3, laundry: .25, plants: .1, ac: .15,
    grille: .4, rail: .35, glass: .25, balcony: .2, chajja: .4, uc: .1, tin: .55, brick: .2, acp: .6, awning: .6, flex: .9, pal: 'industrial', floors: [1, 3] }),
  K('Peri-urban village', { wealth: .25, age: .55, wear: .6, clutter: .45, wires: .6, fp: 0, mess: .3, green: .85, tanks: .75, solar: .15, dish: .6, laundry: .6, plants: .55, ac: .05,
    grille: .55, rail: .5, balcony: .3, chajja: .45, uc: .15, tiles: .35, tin: .5, brick: .3, stone: .25, acp: .05, awning: .4, rangoli: .7, flex: .5, pal: 'village', floors: [1, 2] }),
  K('Pilgrim town', { wealth: .35, age: .8, wear: .6, clutter: .85, wires: .8, fp: .25, mess: .8, green: .3, tanks: .6, dish: .3, laundry: .45, plants: .4, ac: .1, grille: .45,
    rail: .55, gallery: .35, balcony: .5, chajja: .55, tiles: .45, tin: .3, stone: .35, acp: .05, awning: .85, rangoli: .9, flex: .75, pal: 'pilgrim', floors: [1, 3] }),
  K('Campus', { wealth: .55, age: .75, wear: .3, clutter: .1, wires: .2, fp: .75, mess: .1, green: 1, tanks: .3, solar: .3, dish: .05, laundry: .05, plants: .4, ac: .1, grille: .4,
    rail: .3, arcade: .35, balcony: .2, chajja: .6, tiles: .3, stone: .55, acp: .05, awning: .05, rangoli: 0, flex: .25, pal: 'campus', floors: [1, 3] }),
  K('Airport fringe', { wealth: .5, age: .25, wear: .4, clutter: .35, wires: .4, fp: .4, mess: .35, green: .4, tanks: .5, solar: .35, dish: .35, laundry: .4, plants: .45, ac: .4,
    grille: .55, rail: .5, glass: .35, balcony: .6, chajja: .55, uc: .12, brick: .05, acp: .4, awning: .3, rangoli: .2, flex: .5, pal: 'tower', floors: [3, 8] }),
  K('Katraj and Sinhagad Road', { wealth: .45, age: .35, wear: .55, clutter: .6, wires: .6, fp: .3, mess: .5, green: .35, tanks: .8, solar: .35, dish: .55, laundry: .65, plants: .5,
    ac: .35, grille: .7, rail: .6, glass: .15, balcony: .65, chajja: .7, uc: .1, tin: .1, brick: .06, acp: .3, awning: .4, rangoli: .35, flex: .6, pal: 'mixed', floors: [3, 7] }),
  K('Defence and government colonies', { wealth: .45, age: .6, wear: .3, clutter: .15, wires: .3, fp: .8, mess: .1, green: .8, tanks: .55, solar: .2, dish: .3, laundry: .45, plants: .5,
    ac: .15, grille: .6, rail: .45, balcony: .45, chajja: .8, tiles: .15, acp: 0, awning: .1, rangoli: .25, flex: .1, pal: 'govt', floors: [2, 4] }),
];
export const KI = Object.fromEntries(KINDS.map((k, i) => [k.name, i]));
const P = (n) => KI[n];
const PETH = P('Old peth, residential'), BAZAAR = P('Peth bazaar'), MANDAI = P('Mandai and market yard'), HERITAGE = P('Heritage core'), COLLEGE = P('College strip'),
  BUNG = P('Old bungalows'), SOC = P('Marathi middle-class societies'), CAMP = P('Camp bazaar'), CANT = P('Cantonment lines'), KP = P('KP lanes'), POSH = P('Posh mid-rise'),
  HIGH = P('High street at night'), IT = P('IT park'), TOWER = P('New tower belt'), GAO = P('Gaothan'), VASTI = P('Vasti'), STATION = P('Station area'), BUS = P('Bus hub'),
  MIDC = P('MIDC industrial'), PCMC = P('Planned PCMC'), MIXED = P('Mixed dense suburb'), RIVER = P('Riverside and ghats'), TEKDI = P('Tekdi and hill edge'),
  HWY = P('Highway edge'), VILLAGE = P('Peri-urban village'), PILGRIM = P('Pilgrim town'), CAMPUS = P('Campus'), AIRPORT = P('Airport fringe'), SOUTH = P('Katraj and Sinhagad Road'),
  GOVT = P('Defence and government colonies');

// colours, as painted (sRGB hex): walls, then the trims and accents they're paired with
export const PALETTES = {
  peth: { wall: [0xeee6d2, 0xe9dcb4, 0xd8e4e6, 0xc9dccb, 0xe6c98f, 0xe8cfc4, 0xd6d0e0, 0xf1ece0, 0xdcc89a, 0xb9cfd6], trim: [0x6b4a2e, 0x2e4a5c, 0x3f5e3a, 0x7b2d26, 0x2b2b2b] },
  bazaar: { wall: [0xe8dcc2, 0xd9c7a0, 0xc7d3d4, 0xe6d2b0, 0xd4b48a, 0xcfd9c4, 0xe2c2b8, 0xbfb6a8], trim: [0x7b2d26, 0x2e4a5c, 0x3a3a3a, 0x6b4a2e] },
  heritage: { wall: [0xe7dcc5, 0xd9c6a0, 0xcbb894, 0xe9e1cf], trim: [0x5a3b22, 0x3d2a1c, 0x7b2d26] },
  bungalow: { wall: [0xf3eedf, 0xf0e2c0, 0xe7d3b1, 0xdfe3d6, 0xead7cf, 0xf6f2e8, 0xd9cdb2], trim: [0x6b4a2e, 0x2f4f3a, 0x8a3a2a, 0x3b4a5a] },
  society: { wall: [0xf2e6cc, 0xf0d9b5, 0xe7e0d0, 0xd9dde0, 0xe9d0c0, 0xdde6cf, 0xf3efe2, 0xe6d6a8, 0xd2dce6, 0xefc9a3], trim: [0x8a3a2a, 0x5b3a2a, 0x2e4a5c, 0x6a6a6a, 0xa0522d] },
  camp: { wall: [0xefe2b8, 0xe9d6a0, 0xf2ecdc, 0xe0cfa8, 0xd8c8b0, 0xc9b38a], trim: [0xf6f2e6, 0x7b2d26, 0x3b4a3a, 0x2b2b2b] },
  cantonment: { wall: [0xf4f0e4, 0xefe6cc, 0xe8dcb8, 0xf6f4ee], trim: [0x3b4a2a, 0x7b2d26, 0x2b2b2b] },
  posh: { wall: [0xf4f2ee, 0xe8e4dc, 0xd9d4ca, 0xc9c3b8, 0xefe9de, 0xb8b2a8, 0x9c968c], trim: [0x3a3a3a, 0x6b4a2e, 0x8c6a4a, 0x2a2a2a] },
  office: { wall: [0xe8e8e6, 0xd6d8da, 0xc4c8cc, 0xb4bac0, 0xeeeeec], trim: [0x2a2e33, 0x46505a, 0x7a8590] },
  tower: { wall: [0xf2f0ea, 0xe9e5dc, 0xdedad0, 0xf0e6d6, 0xd8d8d6, 0xece4d4], trim: [0xd2691e, 0x8a3a2a, 0x2e5a7c, 0x6a6a6a, 0xb8860b, 0x3a6a4a] },
  village: { wall: [0xe6d3a8, 0xeee6d4, 0xd8c08f, 0xc9d8de, 0xe2c6b0, 0xcfd9b8, 0xb59a74], trim: [0x2e5a8c, 0x6b4a2e, 0x7b2d26, 0x3f5e3a] },
  vasti: { wall: [0x6fa8dc, 0xe8a0b8, 0x9fd3a8, 0xf2d27a, 0xc9a7e0, 0xe8e0d0, 0x8fc9d6, 0xf0b07a, 0xb07a5a, 0xd06a50], trim: [0x2e5a8c, 0x7b2d26, 0x3a3a3a, 0x2f6a3a] },
  industrial: { wall: [0xd8dcdc, 0xc8d4dc, 0xd0dcc8, 0xe0dcd0, 0xb8bcbc, 0xe8e8e0], trim: [0x2e5a8c, 0x3a6a4a, 0x7a3a2a, 0x555555] },
  mixed: { wall: [0xf0dcbc, 0xe8d8c8, 0xdcdcd0, 0xd8e0e8, 0xe8c8b0, 0xd8e4cc, 0xf2e4c4, 0xc8d0dc], trim: [0x8a3a2a, 0x2e4a5c, 0x5b3a2a, 0x3a3a3a] },
  pilgrim: { wall: [0xf0e0b0, 0xf2d090, 0xe8e0d0, 0xf0c8a0, 0xd8e4e8, 0xf6a04a], trim: [0xd2691e, 0x7b2d26, 0x2e4a5c] },
  campus: { wall: [0xd9cbb0, 0xc8b89a, 0xe6dcc6, 0xb88a6a], trim: [0x5a3b22, 0x3a3a3a, 0x2f4f3a] },
  govt: { wall: [0xefe6c8, 0xe8dcb0, 0xf0ece0, 0xdcd8c8], trim: [0x7b2d26, 0x3b4a2a, 0x2e4a5c] },
};

// ---- named places → kind (OSM suburbs and the game's central areas). Reach in metres
const NAMED = {};
const put = (kind, r, names) => { for (const n of names) NAMED[n] = [kind, r]; };
put(PETH, 420, ['Sadashiv Peth', 'Narayan Peth', 'Shaniwar Peth', 'Kasba Peth', 'Shukrawar Peth', 'Navi Peth', 'Guruwar Peth', 'Mangalwar Peth', 'Somwar Peth', 'Ghorpade Peth']);
put(BAZAAR, 380, ['Budhwar Peth', 'Raviwar Peth', 'Ganesh Peth', 'Nana Peth', 'Bhavani Peth', 'Gandhipeth']);
put(MANDAI, 300, ['Gultekdi', 'Bhaji Mandai Chowk']);
put(COLLEGE, 650, ['Deccan Gymkhana', 'Shivajinagar', 'Gokhale Nagar', 'Lokmanya Nagar']);
put(BUNG, 600, ['Model Colony', 'Erandwane', 'Prabhat Road', 'Rambaug Colony', 'Nal Stop', 'Ganeshnagar', 'Dahanukar Colony']);
put(SOC, 900, ['Kothrud', 'Karve Nagar', 'Sahakar Nagar', 'Navasahyadri Society', 'Moraya Krupa Society', 'Natraj Society', 'Prosperity Society', 'Paud Phata',
  'Chintamani Cooperative Housing Society', 'Happy Colony', 'Vitthalwadi', 'Shahu Colony', 'Tukai Nagar', 'Kothrud Depot', 'Mukund Nagar', 'Panchawati', 'Ramnagar Colony',
  'Anupam Park', 'Mahesh Society', 'Keshav Housing Society', 'Suyojan Society', 'Ram Housing Society', 'Maharashtra Co-operative Housing Society', 'Sopan Baug']);
put(CAMP, 650, ['Camp', 'Sarbatwala Chowk', 'Dhole Patil Road']);
put(CANT, 800, ['Pune Cantonment', 'Range Hills', 'Mandalay Lines', 'Khadki', 'Ghorpadi', 'Ghorpuri', 'Wanowrie', 'Wanawadi']);
put(KP, 750, ['Koregaon Park', 'Clover Park']);
put(POSH, 800, ['Kalyani Nagar', 'Boat Club Road', 'Viman Nagar', 'Aundh', 'Sindh Colony', 'Pallod Farms', 'Ganga Orchard', 'Beverley Hills', 'Harinagar', 'Sharad Nagar']);
put(HIGH, 350, ['Balewadi High Street']);
put(IT, 900, ['Hinjawadi', 'Hinjawadi Phase 1', 'Hinjawadi Phase 2', 'Hinjawadi Phase 3', 'Symphony IT Park', 'Magarpatta', 'Talawade']);
put(TOWER, 1100, ['Wakad', 'Baner', 'Balewadi', 'Tathawade', 'Punawale', 'Ravet', 'Wagholi', 'Kharadi', 'Mhalunge', 'Bavdhan', 'Pimple Saudagar', 'Vishal Nagar', 'Keshav Nagar',
  'Mahindra Antheia', 'Blue Ridge Town', 'Aditya Garden City', 'Grande View 7 Township', 'Shree Lakshmi Classic Housing Society', 'Rutuja Park', 'Chakankar Mala', 'Samarth Colony',
  'Mohan Nagar', 'Vasant Vihar', 'Ram Indu Park', 'Shivneri Park', 'Dasar', 'Park Street', 'Kaspate Vasti', 'Wadgaon Sheri', 'Ramwadi', 'Kesnand', 'Treedom Park', 'Ajmera']);
put(GAO, 450, ['Baner Gaon', 'Aundh Gaon', 'Pashan Gaon', 'Sus Gaon', 'Wakad gaav', 'Morya village', 'Kalas', 'Shivane', 'Bhugaon', 'Sus', 'Lavale', 'Kirkatwadi']);
put(VASTI, 380, ['Tadiwala Road', 'Janwadi', 'Vaiawadi', 'Mavale vasti', 'Shankar Maharaj Vasahat', 'Hirai Sitai Vasti', 'Parkhe Vasti', 'Sakhare Vasti', 'More Wasti', 'Dobarwadi']);
put(STATION, 650, ['Pune Station', 'Agarkar Nagar', 'Sangamwadi']);
put(BUS, 450, ['Swargate', 'Wakdewadi']);
put(MIDC, 1300, ['Bhosari', 'Kasarwadi', 'Akurdi', 'Moshi', 'Chinchwad']);
put(PCMC, 1000, ['Nigdi', 'Pimpri', 'Pimple Gurav', 'Pimple Nilakh', 'Old Sangvi', 'Rahatani', 'Thergaon', 'Kalewadi', 'Rakshak Society', 'Vinayak Nagar', 'Sharda Colony',
  'Shantiniketan Society', 'Thopte colony', 'Gulmohar colony', 'Chilekar nagar', 'Jai Malhar Nagar', 'Pawar Nagar', 'Radhakrushna colony', 'Anand housing colony', 'Ashok society',
  'Kaverinagar', 'Sainath colony', 'Shiv Nagar', 'Shivtirth Nagar', 'Jagtap nagar', 'Venunagar', 'Dagadupatil nagar', 'Pavaneshwar colony', 'Samrat Colony', 'Moraya Gosavi Raj Park',
  'Vanadeva nagar', 'Anand park', 'Ratnadeep Colony', 'Shankar Kalat Nagar', 'Chidoba Nagar']);
put(MIXED, 1000, ['Hadapsar', 'Kondhwa', 'Yerawada', 'Vishrantwadi', 'Fatima Nagar', 'Bopodi', 'Dapodi', 'Mundhwa', 'Phulenagar', 'Tingrenagar', 'Gopalpatti', 'Manjari',
  'Manjari Budruk', 'Kondhwa Budruk', 'Krushna Nagar', 'Ganesh Nagar', 'Marutrao Gaikwad nagar', 'Mandalay Lines']);
put(RIVER, 450, ['Bund Garden']);
put(TEKDI, 700, ['Pashan', 'Bavdhan Budruk', 'Panchavati']);
put(HWY, 400, ['Kalewadi Phata', 'Theur Phata', 'Bhujbal Chowk', 'Dange Chowk']);
put(VILLAGE, 1300, ['Theur', 'Loni Kalbhor', 'Loni kand', 'Manjari Khurd', 'Fursungi', 'Maan', 'Marunji', 'Nande', 'Chande', 'Mulkhed', 'Bhukum', 'Khanapur', 'Gorhe', 'Ahire',
  'Agalambe', 'Wadki', 'Bhiwari', 'Sonori', 'Perane', 'Bahul', 'Bhose', 'Induri', 'Somatane', 'Shirgaav', 'Godumbre', 'Salumbre', 'Darumbre', 'Mamurdi', 'Gahunje', 'Saangawade',
  'Nere', 'Jaambe', 'Wadegaon', 'Wadebolai', 'Tulapur', 'Shel Pimpalgaon', 'Koregaon', 'Holkarwadi', 'Manter Wadi', 'Jadhavwadi', 'Jhenderwadi', 'Jadhavgad', 'Patharwadi',
  'Askarwadi', 'Khadakwasla', 'Malkhed', 'Thopatewadi', 'Wasavewadi', 'Manerwadi', 'Sambarewadi', 'Labadewadi', 'Shelarwadi', 'Sonarwadi', 'Wanjalewadi', 'Khadewadi',
  'Dhanewadi', 'Kolewadi', 'Sanas Nagar', 'Satavwasti', 'Kudalewasti', 'Ainalwasti', 'Waghmare Vasti', 'Gateshwar Wasti', 'Atekar Vasti', 'Dattawadi', 'Sule gaon', 'Jaambe']);
put(PILGRIM, 900, ['Alandi']);
put(CAMPUS, 650, ['Ganeshkhind', 'Pune University Chowk']);
put(AIRPORT, 1100, ['Lohegaon', 'Dhanori', 'Khese Park']);
put(SOUTH, 1000, ['Katraj', 'Dhankawadi', 'Dhayari', 'Vadgaon Budruk', 'Warje', 'Hingne Khurd', 'Anandnagar', 'Manik Baug', 'Shelke Nagar', 'Gauliwada', 'Sai Shradha Bungalow Society',
  'Yewalewadi', 'Datta nagar Chowk', 'Mavale vasti']);
put(GOVT, 450, ['Municipal Colony', 'Defence Colony (DAD) - Wing A', 'Ex-Servicemen Colony', 'Pune University Teachers Quarters', 'Vasantdada Sugar Institute Colony', 'Marutrao Gaikwad nagar']);
// the game's landmarks as small areas of their own (x, z in metres from the map's origin are filled in from the map)
const LANDMARK_AREAS = { 'Shaniwar Wada': [HERITAGE, 260], 'Lal Mahal': [HERITAGE, 160], 'Vishrambaug Wada': [HERITAGE, 140], 'Nana Wada': [HERITAGE, 120],
  'Mahatma Phule Mandai': [MANDAI, 220], 'Fergusson College': [CAMPUS, 380], 'College of Engineering Pune': [CAMPUS, 330], 'Pune Junction': [STATION, 420],
  'Pune Station Bus Stand': [BUS, 220], 'Sassoon Hospital': [STATION, 200], 'Council Hall': [CANT, 250], 'Poona Club': [CANT, 300], 'Osho Teerth Park': [KP, 300],
  'Royal Connaught Boat Club': [RIVER, 250], 'Bund Garden': [RIVER, 350] };

// a name the table doesn't know: guess from the word and how far out it is
function guess(name, x, z) {
  const d = Math.hypot(x + 1013, z - 700) / 1000;          // km from Shaniwar Wada
  const pcmc = x < -4000 && z < -6500;
  if (/Chowk/i.test(name)) return null;
  if (/Peth$/.test(name)) return [d < 3 ? PETH : MIXED, 420];
  if (/\b(Gaon|gaon|gaav|Gaav|village)\b/.test(name)) return [GAO, 450];
  if (/(Vasti|Wasti|vasti|wasti|Vasahat)$/.test(name)) return d > 11 ? [VILLAGE, 900] : [VASTI, 350];
  if (/(wadi|Wadi)$/.test(name)) return d > 10 ? [VILLAGE, 1000] : [MIXED, 600];
  if (/Phata$/.test(name)) return [HWY, 400];
  if (/(Society|Housing|Colony|colony|Nagar|nagar|Park|Baug|Township)/.test(name)) return pcmc ? [PCMC, 800] : d > 8.5 ? [TOWER, 900] : [SOC, 800];
  if (d < 2.5) return [PETH, 450];
  if (d < 7) return [SOC, 900];
  if (d < 13) return [pcmc ? PCMC : MIXED, 1100];
  return [VILLAGE, 1300];
}

export class AreaField {
  // M: the city as loaded (its pois carry the suburbs, its areas and landmarks the game's own places)
  constructor(M, given) {
    const pts = given || [];
    if (!given) this.collect(M, pts);
    this.pts = pts;
    // a 1.5 km grid of the points, for quick lookups
    this.grid = new Map();
    for (const p of pts) { const k = this.key(Math.floor(p.x / 1500), Math.floor(p.z / 1500)); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(p); }
    this.cache = new Map();
  }
  // the worker gets the points, not the map
  static fromPts(pts) { return new AreaField(null, pts); }
  toPts() { return this.pts; }
  collect(M, pts) {
    const add = (name, x, z, kr) => { if (kr) pts.push({ name, x, z, k: kr[0], r: kr[1] }); };
    const seen = new Set();
    for (const a of M.areas || []) { const n = a[0]; seen.add(n); add(n, a[2] / 100, a[3] / 100, NAMED[n] || guess(n, a[2] / 100, a[3] / 100)); }
    for (const p of M.pois || []) {
      if (p[4] !== 'suburb' && p[4] !== 'neighbourhood' && p[4] !== 'locality') continue;
      const n = p[0], x = p[2] / 100, z = p[3] / 100;
      if (seen.has(n)) continue; seen.add(n);
      add(n, x, z, NAMED[n] || guess(n, x, z));
    }
    for (const l of M.landmarks || []) { const kr = LANDMARK_AREAS[l[0]]; if (kr) add(l[0], l[2] / 100, l[3] / 100, kr); }
  }
  key(i, j) { return (i + 4096) * 8192 + (j + 4096); }
  // the mix of kinds at a spot: up to four [kind, weight] pairs, heaviest first, weights summing to 1. Cached on a 50 m grid
  at(x, z) {
    const ci = Math.floor(x / 50), cj = Math.floor(z / 50), ck = this.key(ci, cj);
    let r = this.cache.get(ck);
    if (r) return r;
    const cx = (ci + 0.5) * 50, cz = (cj + 0.5) * 50;
    const w = new Float64Array(KINDS.length);
    const gi = Math.floor(cx / 1500), gj = Math.floor(cz / 1500);
    let tot = 0;
    for (let a = gi - 2; a <= gi + 2; a++) for (let b = gj - 2; b <= gj + 2; b++) {
      const l = this.grid.get(this.key(a, b)); if (!l) continue;
      for (const p of l) {
        const d = Math.hypot(p.x - cx, p.z - cz) / p.r;
        if (d > 2.6) continue;
        const v = Math.exp(-d * d);
        w[p.k] += v; tot += v;
      }
    }
    // far from every named place: what that distance from the centre usually is (a faint vote, so it only decides alone)
    const d = Math.hypot(cx + 1013, cz - 700) / 1000, pc = cx < -4000 && cz < -6500;
    const fb = d < 2.5 ? PETH : d < 6.5 ? SOC : d < 12 ? (pc ? PCMC : MIXED) : VILLAGE;
    w[fb] += 0.02; tot += 0.02;
    const list = [];
    for (let k = 0; k < w.length; k++) if (w[k] / tot > 0.04) list.push([k, w[k] / tot]);
    list.sort((p, q) => q[1] - p[1]);
    const top = list.slice(0, 4), s = top.reduce((a, p) => a + p[1], 0);
    r = top.map(([k, v]) => [k, v / s]);
    if (this.cache.size > 60000) this.cache.clear();
    this.cache.set(ck, r);
    return r;
  }
  name(x, z) { const m = this.at(x, z); return KINDS[m[0][0]].name; }
}

// the settings for a mix (weighted average), and which kind a building takes its character from (by its seed)
export function blend(mix) {
  const o = {};
  for (const key in D) {
    if (key === 'pal' || key === 'floors') continue;
    let v = 0; for (const [k, w] of mix) v += KINDS[k][key] * w; o[key] = v;
  }
  return o;
}
export function pick(mix, r) {
  let a = 0; for (const [k, w] of mix) { a += w; if (r < a) return k; }
  return mix[0][0];
}
export const KIND_IDS = { PETH, BAZAAR, MANDAI, HERITAGE, COLLEGE, BUNG, SOC, CAMP, CANT, KP, POSH, HIGH, IT, TOWER, GAO, VASTI, STATION, BUS, MIDC, PCMC, MIXED, RIVER, TEKDI,
  HWY, VILLAGE, PILGRIM, CAMPUS, AIRPORT, SOUTH, GOVT };
