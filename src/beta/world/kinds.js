// The kinds of surface the paint shader knows (gfx/paint.js draws each its own way). Shared by the city builder in
// the worker, so no three.js here.
export const K = {
  plaster: 0, brick: 1, road: 2, paver: 3, kerbPaint: 4, tiles: 5, shutter: 6, wood: 7, glass: 8, leaf: 9, plain: 10, tin: 11, stone: 12,
  inside: 13, ad: 14, cloth: 15, paint: 16, kerb: 17, sqTiles: 18, concrete: 19, soil: 20, grass: 21, water: 22, curtain: 23, cladding: 24,
  bitumen: 25, slab: 26, tarp: 27, oldRoad: 28, marble: 29, glow: 30, facadeWin: 31, sintex: 32, gravel: 33, line: 34, stain: 35, metal: 36,
  grille: 37, rangoli: 38, net: 39, laundry: 40, goods: 41,
};
// the kinds drawn with holes in them (grilles, railings, nets, washing on a line): their own mesh, no shadow of their own
export const CUT = new Set([K.grille, K.net, K.laundry]);
// the city's own wall heights and the floor heights of each building style (the same numbers as gfx/pbr.js's
// STYLE_PARAMS: [floor, ground floor, window w, window h, spacing, sill]), so the painted city stands exactly as tall
export const STYLE = [
  [3.05, 3.2, 1.2, 1.25, 2.9, 0.85], [3.4, 4.0, 2.4, 1.6, 3.2, 0.75], [3.1, 3.4, 0.9, 1.35, 2.3, 0.75], [3.2, 3.2, 1.4, 1.4, 3.6, 0.8],
  [3.7, 3.8, 1.5, 1.8, 3.3, 0.9], [4.6, 4.8, 1.2, 2.3, 3.2, 0.9], [2.8, 2.9, 0.9, 0.9, 4.5, 1.2], [3.0, 3.0, 0, 0, 9.0, 1.0],
  [3.4, 3.8, 0.7, 1.0, 3.5, 1.2], [3.6, 4.4, 2.8, 2.6, 3.0, 0.3], [5.0, 5.0, 1.1, 3.0, 3.4, 1.2], [4.0, 4.0, 0, 0, 9.0, 1.0],
  [4.4, 4.8, 1.4, 2.4, 3.4, 0.9], [3.6, 3.6, 0, 0, 9.0, 1.0], [4.2, 4.4, 1.1, 2.4, 3.0, 1.0],
];
export const BASE = 0.15;
export const SHOP_CELL = 3.6;
export function heightOf(levels, styleId) {
  const S = STYLE[styleId] || STYLE[0];
  const shopsCapable = styleId === 0 || styleId === 1 || styleId === 2 || styleId === 9;
  const gh = (levels > 1 || shopsCapable) ? S[1] : S[0];
  return { gh, fh: S[0], H: gh + (levels - 1) * S[0] };
}
