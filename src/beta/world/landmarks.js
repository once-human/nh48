// world/landmarks.js for /beta: the game's landmarks, every one where and how it is, and their walls built up for real.
// While a landmark is being built, a stone wall comes out as its courses of separate blocks, each standing a little
// proud of the mortar with its own colour; a plastered wall gets pilasters; every tall wall stands on a moulded plinth
// and ends in a moulded cornice. It's only drawn, the game's outlines and collisions are what they were.
export * from '@orig/world/landmarks.js';
import { buildLandmark as gameLandmark } from '@orig/world/landmarks.js';
import { FacadeB } from '@orig/world/buildingsChunk.js';
import { WL } from '@orig/gfx/pbr.js';

const wall0 = FacadeB.prototype.wall, SKIP = new Set([WL.shutter, WL.rustyShutter, WL.tin, WL.wood, WL.clayTiles, WL.tiles, WL.bitumen]), BLOCK = new Set([WL.rubble, WL.sandstone, WL.slab]);
let on = false, Y0 = 0;
const hsh = (a, b) => { const x = Math.sin(a*127.1 + b*311.7)*43758.5453; return x - Math.floor(x); };
const tinted = (A, k, warm = 0) => ({ ...A, tint: [Math.min(1, A.tint[0]*k*(1 + warm)), Math.min(1, A.tint[1]*k), Math.min(1, A.tint[2]*k*(1 - warm))] });

// a solid sticking out of the wall: its face, its top, its underside and its ends
function proud(fb, ax, az, tx, tz, nx, nz, u0, u1, y0, y1, d, A, ue, under = true) {
  const x0 = ax + tx*u0, z0 = az + tz*u0, x1 = ax + tx*u1, z1 = az + tz*u1, ox = nx*d, oz = nz*d;
  wall0.call(fb, x0 + ox, z0 + oz, x1 + ox, z1 + oz, y0, y1, nx, nz, ue + u0, A);
  fb.flat([[x0, y1, z0], [x1, y1, z1], [x1 + ox, y1, z1 + oz], [x0 + ox, y1, z0 + oz]], 1, A);
  if (under) fb.flat([[x0, y0, z0], [x1, y0, z1], [x1 + ox, y0, z1 + oz], [x0 + ox, y0, z0 + oz]], -1, A);
  wall0.call(fb, x0, z0, x0 + ox, z0 + oz, y0, y1, -tx, -tz, ue + u0, A);
  wall0.call(fb, x1, z1, x1 + ox, z1 + oz, y0, y1, tx, tz, ue + u1, A);
}

FacadeB.prototype.wall = function (ax, az, bx, bz, y0, y1, nx, nz, u0, A) {
  if (!on || SKIP.has(A.layer)) return wall0.call(this, ax, az, bx, bz, y0, y1, nx, nz, u0, A);
  on = false;                                             // (what's added below goes straight in)
  const L = Math.hypot(bx - ax, bz - az), h = y1 - y0;
  wall0.call(this, ax, az, bx, bz, y0, y1, nx, nz, u0, A);
  if (L > 0.5 && h > 0.35) {
    const tx = (bx - ax)/L, tz = (bz - az)/L, seed = Math.abs(ax*3.1 + az*1.7 + y0*5.3)%97;
    if (BLOCK.has(A.layer) && L*h < 240) {
      // courses of blocks, staggered, every one its own
      const rubble = A.layer === WL.rubble, courseH = rubble ? 0.42 : 0.56; let row = 0;
      for (let y = y0; y < y1 - 0.05; row++) {
        const hh = Math.min(courseH*(0.8 + hsh(row, seed)*0.5), y1 - y); let u = (row%2)*0.4*hsh(seed, row), c = 0;
        if (u > 0.05) { proud(this, ax, az, tx, tz, nx, nz, 0, u - 0.012, y + 0.012, y + hh - 0.012, 0.012, A, u0, false); }
        for (; u < L - 0.02; c++) {
          const r = hsh(row*13 + c, seed), w = Math.min((rubble ? 0.55 : 0.8) + r*(rubble ? 0.8 : 0.7), L - u), k = 0.84 + hsh(c, row + seed)*0.3;
          proud(this, ax, az, tx, tz, nx, nz, u + 0.008, u + w - 0.008, y + 0.01, y + hh - 0.01, 0.012 + hsh(c*7, row)*(rubble ? 0.034 : 0.014), tinted(A, k, (r - 0.5)*0.08), u0, false);
          u += w;
        }
        y += hh;
      }
    } else if (!BLOCK.has(A.layer) && A.layer !== WL.brick && h > 2.8 && L > 3) {
      // pilasters
      const n = Math.max(1, Math.round(L/3.4)), P = tinted(A, 1.04);
      for (let k = 0; k <= n; k++) { const u = k*L/n; proud(this, ax, az, tx, tz, nx, nz, Math.max(0, u - 0.17), Math.min(L, u + 0.17), y0 + 0.02, y1 - 0.02, 0.05, P, u0, true); }
    }
    if (h > 1.6) {
      // a plinth where it meets the ground (or the course below), a cornice where it ends: steps that catch the light
      const dark = tinted(A, 0.82), light = tinted(A, 1.06);
      if (y0 - Y0 < 0.6) { proud(this, ax, az, tx, tz, nx, nz, -0.04, L + 0.04, y0, y0 + 0.34, 0.1, dark, u0, false); proud(this, ax, az, tx, tz, nx, nz, -0.02, L + 0.02, y0 + 0.34, y0 + 0.42, 0.055, dark, u0, false); }
      proud(this, ax, az, tx, tz, nx, nz, -0.02, L + 0.02, y1 - 0.2, y1 - 0.12, 0.06, light, u0, true);
      proud(this, ax, az, tx, tz, nx, nz, -0.04, L + 0.04, y1 - 0.12, y1 - 0.05, 0.12, light, u0, true);
      proud(this, ax, az, tx, tz, nx, nz, -0.06, L + 0.06, y1 - 0.05, y1 + 0.01, 0.17, tinted(A, 0.94), u0, true);
    }
  }
  on = true;
};

export function buildLandmark(W, id, b) {
  on = true; Y0 = 0.15;
  try { return gameLandmark(W, id, b); } finally { on = false; }
}
