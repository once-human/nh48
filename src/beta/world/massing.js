// Not every building a box with a lid. What stands on top changes a building's outline from across the city, and Pune's
// have their own: a Baner or Kalyani Nagar tower with the penthouse set back from its edge behind a terrace; an IT
// block with a crown of fins round its top; a Camp bungalow or an old Cantonment office with a turret on its corner,
// an octagon under a little dome; an old city house with the room someone built on its terrace later, brick and a tin
// roof sloping off it; a society with its top floor stepped in. Each one's own chances, the same at every distance (so
// nothing changes as you come closer), and none of it touches what the building is (its height to the parapet, its
// walls, its collisions are the map's).
import { Frame, rng, signedArea, offsetRing, insideRing } from './geom.js';
import { K } from './kinds.js';

function walls(b, ring, normals, y0, y1) {
  const n = ring.length/2; let u = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1)%n, ax = ring[2*i], az = ring[2*i + 1], bx = ring[2*j], bz = ring[2*j + 1], len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    new Frame(ax, az, (bx - ax)/len, (bz - az)/len, normals[2*i], normals[2*i + 1], u).rect(b, 0, len, y0, y1, 0);
    u += len;
  }
}
// a ring inside the footprint by d, if it fits
function inset(p, normals, d) {
  const q = offsetRing(p, normals, -d), a0 = signedArea(p), a1 = signedArea(q);
  if (Math.sign(a0) !== Math.sign(a1) || Math.abs(a1) < 50) return null;
  for (let i = 0; i < q.length; i += 2) if (!insideRing(q[i], q[i + 1], p)) return null;
  return q;
}

// returns the building as it now is for what goes on its roof (the top of the set-back storey), or null to leave it
export function massing(b, G, flatRoof, cb) {
  const { p, n, normals, top, levels, L, type, fh, A2, B, cx, cz } = G;
  const R = rng(B.seed ^ 0x51ed27), convex = G.convex;
  // a storey set back behind a terrace: the towers, the posh ones, now and then a society
  const want = type === 'posh' ? 0.45 : type === 'tower' ? 0.4 : type === 'soc' ? 0.16 : 0;
  if (want && levels >= 5 && convex && n <= 8 && A2 > 200 && R() < want) {
    const q = inset(p, normals, 1.8 + R()*1.6);
    if (q) {
      const t1 = top + fh;
      b.set(type === 'posh' && R() < 0.5 ? K.curtain : K.facadeWin, L.wall, L.wear, (G.st*16 + (B.seed & 7))/255);
      walls(b, q, normals, top, t1);
      const G2 = { ...G, p: q, top: t1, wallTop: t1 + (type === 'posh' ? 0.5 : 0.9), A2: Math.abs(signedArea(q)), levels: levels + 1 };
      flatRoof(b, cb, G2);
      // the terrace round it: a glass rail at the parapet on the posh ones, planters
      if (type === 'posh') { b.set(K.leaf, 0x4f7a3a, 0); for (let i = 0; i < n; i++) if (R() < 0.6) { const x = (p[2*i] + q[2*i])/2, z = (p[2*i + 1] + q[2*i + 1])/2; b.set(K.plain, 0x8a8a86, 0.2); b.ybox(x, top, z, 0.7, top + 0.5, 0.7, 0, 8); b.set(K.leaf, [0x4f7a3a, 0x5e8a40][i%2], 0); b.blob(x, top + 0.95, z, 0.45, 0.5, 0.45); } }
      return G2;
    }
  }
  // a crown of fins round an IT block's top, with a beam tying them
  if (type === 'office' && levels >= 7 && convex && n <= 8 && R() < 0.5) {
    const q = inset(p, normals, 0.35);
    if (q) {
      const h = 3 + R()*3, gap = 1.6 + R()*1.4, c = R() < 0.5 ? [0.82, 0.83, 0.84] : [0.3, 0.32, 0.34];
      b.set(K.cladding, c, 0.1);
      for (let i = 0; i < n; i++) {
        const j = (i + 1)%n, ax = q[2*i], az = q[2*i + 1], bx = q[2*j], bz = q[2*j + 1], len = Math.hypot(bx - ax, bz - az); if (len < 1) continue;
        const F = new Frame(ax, az, (bx - ax)/len, (bz - az)/len, normals[2*i], normals[2*i + 1]);
        for (let u = 0.3; u < len - 0.2; u += gap) F.box(b, u, u + 0.18, top, top + h, -0.5, 0, 2 | 8);
        F.box(b, 0, len, top + h - 0.35, top + h, -0.5, 0, 2);
      }
      return null;
    }
  }
  // a turret on a colonial corner: an octagon and its dome, a finial
  if (type === 'colonial' && levels <= 3 && A2 > 120 && R() < 0.38) {
    let best = -1, bl = 0;
    for (let i = 0; i < n; i++) { const h = (i - 1 + n)%n, a = Math.hypot(p[2*i] - p[2*h], p[2*i + 1] - p[2*h + 1]), c = Math.hypot(p[2*((i + 1)%n)] - p[2*i], p[2*((i + 1)%n) + 1] - p[2*i + 1]), m = Math.min(a, c); if (m > bl) { bl = m; best = i; } }
    if (best >= 0 && bl > 5) {
      const vx = p[2*best], vz = p[2*best + 1], dx = cx - vx, dz = cz - vz, dl = Math.hypot(dx, dz) || 1, r = 1.4 + R()*0.6;
      const x = vx + dx/dl*(r + 0.3), z = vz + dz/dl*(r + 0.3);
      if (insideRing(x, z, p)) {
        const h = 2.6 + R()*2;
        b.set(L.wk === K.stone ? K.stone : K.plaster, L.wall, L.wear); b.cyl(x, top, z, r, r, h, 8);
        b.set(K.plaster, L.trim, L.wear); b.cyl(x, top + h, z, r + 0.15, r + 0.15, 0.25, 8);
        b.set(K.slab, R() < 0.5 ? L.trim : [0.5, 0.52, 0.5], L.wear); b.blob(x, top + h + 0.25, z, r, r*0.9, r, 8);
        b.set(K.metal, [0.35, 0.33, 0.3], 0.3); b.cyl(x, top + h + 0.2 + r*0.85, z, 0.06, 0.02, 0.9, 6);
      }
    }
    return null;
  }
  // the room added on an old city terrace, brick, its tin roof sloping off it
  if ((type === 'peth' || type === 'vasti' || type === 'village') && levels >= 2 && levels <= 4 && A2 > 50 && R() < 0.3) {
    const q = inset(p, normals, 0.6);
    if (q) {
      const i = (R()*n) | 0, j = (i + 1)%n, ax = q[2*i], az = q[2*i + 1], bx = q[2*j], bz = q[2*j + 1], len = Math.hypot(bx - ax, bz - az);
      if (len > 3) {
        const w = Math.min(len - 0.4, 2.6 + R()*1.6), dd = 2.4 + R()*1, u0 = (len - w)*R(), F = new Frame(ax, az, (bx - ax)/len, (bz - az)/len, normals[2*i], normals[2*i + 1]);
        const [mx, , mz] = F.P(u0 + w/2, 0, -dd);
        if (insideRing(mx, mz, p)) {
          const hF = 2.3, hB = 2.0;
          b.set(R() < 0.6 ? K.brick : K.plaster, R() < 0.6 ? [0.62, 0.36, 0.28] : L.wall, Math.min(1, L.wear + 0.2));
          F.box(b, u0, u0 + w, top, top + hB, -dd, 0, 4 | 8);
          b.set(K.tin, [0.55, 0.56, 0.58], 0.7);
          b.quad(F.P(u0 - 0.2, top + hF, 0.3), F.P(u0 + w + 0.2, top + hF, 0.3), F.P(u0 + w + 0.2, top + hB + 0.05, -dd - 0.25), F.P(u0 - 0.2, top + hB + 0.05, -dd - 0.25), [0, 1, 0]);
          b.set(K.wood, 0x5a3a24, 0.4); F.box(b, u0 + w*0.3, u0 + w*0.3 + 0.8, top, top + 1.9, 0, 0.03, 2 | 8);
        }
      }
    }
  }
  return null;
}
