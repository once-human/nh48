// Who people are: the game says what someone wears (top, bottom, skin, what they're doing); this gives them everything
// else. Dozens of haircuts built round the skull, caps and pagdis, glasses, dupattas and bags, earrings, watches, and a
// build of their own. Sarees and kurtas are cut here from scratch, fitted to the body underneath, one length of cloth.
// None of it touches the game: it's only drawn.
import * as THREE from 'three';

const v = new THREE.Vector3();
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
function rngOf(seed) { let s = seed || 1; const n = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0)/4294967296; }; return { n, pick: (a) => a[Math.floor(n()*a.length)], chance: (p) => n() < p, range: (a, b) => a + n()*(b - a) }; }
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a)/(b - a))); return t*t*(3 - 2*t); };

// a mesh from a grid of points; `wrap` closes it round
function gridGeo(P, wrap = false, sway) {
  const R = P.length, C = P[0].length, pos = [], idx = [], sw = [];
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { pos.push(P[i][j][0], P[i][j][1], P[i][j][2]); sw.push(sway ? sway(i/(R - 1), j/(C - 1)) : 0); }
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < (wrap ? C : C - 1); j++) { const j2 = (j + 1)%C, a = i*C + j, b = i*C + j2, c = (i + 1)*C + j2, d = (i + 1)*C + j; idx.push(a, d, c, a, c, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('sway', new THREE.Float32BufferAttribute(sw, 1)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function merge(list) {
  const pos = [], nor = [], sw = [], idx = []; let base = 0;
  for (const g of list) { const p = g.attributes.position, n = g.attributes.normal, s = g.attributes.sway, ix = g.index;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); sw.push(s ? s.getX(i) : 0); }
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base); base += p.count; }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setAttribute('sway', new THREE.Float32BufferAttribute(sw, 1)); o.setIndex(idx); return o;
}
const at = (g, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz))); return g; };
const tube = (pts, r, seg = 18, rad = 8, sway) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), P = []; const F = c.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) { const t = i/seg, p = c.getPointAt(t), N = F.normals[i], B = F.binormals[i], rr = typeof r === 'function' ? r(t) : r, ro = []; for (let j = 0; j < rad; j++) { const a = j/rad*Math.PI*2, ca = Math.cos(a)*rr, sa = Math.sin(a)*rr; ro.push([p.x + N.x*ca + B.x*sa, p.y + N.y*ca + B.y*sa, p.z + N.z*ca + B.z*sa]); } P.push(ro); }
  return gridGeo(P, true, sway); };

// ------------------------------------------------------------------ hair, as a shell over the skull
// hem(a): how far down the hair reaches at each angle round the head (a = 0 at the back, PI in front), as metres below the skull's middle (negative = above it)
function shell(S, hem, opts = {}) {
  const { c, r } = S, C = opts.cols || 56, R = opts.rows || 20, th = opts.th ?? .012, topY = c[1] + r[1]*(1 + th*4), P = [];
  for (let i = 0; i <= R; i++) { const s = i/R, row = []; for (let j = 0; j < C; j++) {
    const a = j/C*Math.PI*2, h = hem(a), y0 = c[1] - h, y = topY + (y0 - topY)*Math.pow(s, opts.bias || 1), k = (y - c[1])/(r[1]*(1 + th*4));
    let rad = k > 0 ? Math.sqrt(Math.max(0, 1 - k*k)) : 1;
    const below = Math.max(0, c[1] - y);
    rad *= 1 + (opts.flare ? opts.flare(below, a, s) : 0);
    let bumpy = opts.bump ? opts.bump(a, s, below) : 0, px = -Math.sin(a), pz = -Math.cos(a);
    let x = c[0] + px*(r[0]*(1 + th) + bumpy)*rad, z = c[2] + pz*(r[2]*(1 + th) + bumpy)*rad;
    if (opts.lift) { const L = opts.lift(a, s); x += L[0]; z += L[1]; }
    const out = opts.y ? opts.y(a, s, below) : 0, q = [x, y + out, z]; if (S.push) S.push(q, opts.gap ?? .005 + th*.12);       // never inside the head it's on
    row.push(q);
  } P.push(row); }
  return gridGeo(P, true, opts.sway ? (u) => u*u*opts.sway : undefined);
}
const front = (a, w = .62) => smooth(w + .28, w - .14, Math.abs(a - Math.PI));       // 1 at the face, 0 away from it
const hemOf = (faceH, sideH, backH, w) => (a) => { const f = front(a, w), b = smooth(1.5, .35, Math.min(a, Math.PI*2 - a)); return f*faceH + (1 - f)*(b*backH + (1 - b)*sideH); };

function makeHair(S) {
  const { c, r, fem } = S, top = c[1] + r[1], back = c[2] - r[2], H = {}, line = -r[1]*.48, side0 = r[1]*.15;
  const noiseB = (k, amp) => (a, s) => Math.sin(a*k + s*7)*amp*Math.min(1, s*4);
  // close to the head
  H.buzz = shell(S, hemOf(line, side0 + .02, r[1]*.8), { th: .006 });
  H.crop = shell(S, hemOf(line, side0 + .03, r[1]*.95), { th: .02, cols: 44, rows: 14 });
  H.parted = shell(S, hemOf(line - .01, side0 + .03, r[1]*.95), { th: .025, cols: 48, rows: 16, y: (a, s) => (1 - s)*(1 - s)*.018*(.6 + .4*Math.sin(a + 1)) });
  H.sweep = shell(S, hemOf(line - .012, side0 + .025, r[1]*.9), { th: .028, cols: 48, y: (a, s) => (1 - s)*(1 - s)*.026*(Math.sin(a) > 0 ? 1 : .55) });
  H.quiff = shell(S, hemOf(line - .025, side0 + .02, r[1]*.88), { th: .025, cols: 48, y: (a, s) => s < .55 ? front(a, 1.)*.035*smooth(.55, .15, s)*(1 - s) : 0 });
  H.curly = shell(S, hemOf(line - .01, side0 + .04, r[1]*1.05), { th: .05, cols: 60, rows: 22, bump: (a, s) => (Math.sin(a*19 + s*23) + Math.sin(a*31 - s*17))*.006*Math.min(1, s*6) });
  H.bald = shell(S, hemOf(side0 + .02, side0 + .03, r[1]*.9), { th: .012, cols: 44, rows: 14 });      // (sides and back only: the ring is cut off the top below)
  { const P = []; const C = 44, R = 8; for (let i = 0; i <= R; i++) { const s = i/R, row = []; for (let j = 0; j < C; j++) { const a = j/C*Math.PI*2, y = c[1] + r[1]*.52 - s*(r[1]*.5 + smooth(.5, 2.8, Math.abs(a - Math.PI) )*r[1]*.5), k = (y - c[1])/r[1], rad = k > 0 ? Math.sqrt(Math.max(0, 1 - k*k)) : 1; row.push([c[0] - Math.sin(a)*(r[0] + .006)*rad, y, c[2] - Math.cos(a)*(r[2] + .006)*rad]); } P.push(row); }
    H.bald = gridGeo(P, true); }
  H.collar = shell(S, hemOf(line - .01, r[1]*.75, r[1]*1.5), { th: .035, flare: (b) => b*.15 });
  // to the jaw, and past it
  const bobF = (b) => .03 + b*.18, bobIn = (b, a, s) => bobF(b) - smooth(.86, 1, s)*.04;
  H.bob = shell(S, hemOf(line - .012, r[1]*1.15, r[1]*1.2, .58), { th: .05, cols: 64, rows: 26, flare: bobIn, sway: .15 });
  H.lob = shell(S, hemOf(line - .012, r[1]*1.75, r[1]*1.75, .56), { th: .05, cols: 64, rows: 30, flare: (b) => .03 + b*.2, lift: (a, s) => [0, -smooth(.6, 1, s)*.012], sway: .3 });
  H.shoulder = shell(S, hemOf(line - .012, r[1]*2.3, r[1]*2.5, .54), { th: .05, cols: 64, rows: 34, flare: (b) => .03 + Math.min(b*.28, .22), lift: (a, s) => [0, -smooth(.45, 1, s)*.035], sway: .4, bump: (a, s) => Math.sin(a*26 + s*6)*.004*s });
  const longF = (b) => .03 + Math.min(b*.3, .26), longL = (a, s) => [(-Math.sin(a) > 0 ? -1 : 1)*smooth(.55, 1, s)*.012, -smooth(.32, .85, s)*.06];
  H.long = shell(S, hemOf(line - .012, r[1]*3.1, r[1]*5, .52), { th: .05, cols: 72, rows: 44, flare: longF, lift: longL, sway: .7, bias: 1.15, bump: (a, s) => Math.sin(a*30 + s*3)*.004*s });
  H.wavy = shell(S, hemOf(line - .012, r[1]*2.9, r[1]*4.4, .52), { th: .055, cols: 72, rows: 50, flare: longF, lift: longL, sway: .7, bias: 1.15, bump: (a, s) => (Math.sin(s*30 + a*5)*.012 + Math.sin(a*22 + s*9)*.005)*smooth(.25, .6, s) });
  H.fringe = merge([shell(S, hemOf(line - .012, r[1]*2.2, r[1]*2.5, .54), { th: .05, cols: 60, rows: 30, flare: (b) => .03 + Math.min(b*.28, .22), lift: (a, s) => [0, -smooth(.45, 1, s)*.03], sway: .3 }), gridGeo((() => { const P = []; for (let i = 0; i <= 5; i++) { const s = i/5, row = []; for (let j = 0; j <= 16; j++) { const u = j/16*2 - 1, x = u*r[0]*.82, z = c[2] + Math.sqrt(Math.max(0, 1 - u*u*.67))*r[2]*(1.04 + (1 - s)*.02) ; row.push([c[0] + x, c[1] + r[1]*.72 - s*r[1]*(.55 + .04*Math.sin(j*2.1)), z]); } P.push(row); } return P; })())]);
  // tied back
  const cap = (h = r[1]*.95) => shell(S, hemOf(line - .012, r[1]*.55, h, .6), { th: .03, cols: 52, rows: 18, y: (a, s) => (1 - s)*(1 - s)*.012 });
  const tie = (x, y, z, rr = .026) => at(new THREE.SphereGeometry(rr, 10, 8), x, y, z);
  const tail = (y0, z0, L, rr) => tube([[c[0], y0, z0], [c[0], y0 - L*.12, z0 - .04], [c[0], y0 - L*.45, z0 - .05], [c[0], y0 - L*.8, z0 - .03], [c[0], y0 - L, z0 - .02]], (t) => rr*(1 - t*t*.78)*(1 + .22*Math.sin(t*3.1)), 20, 10, (t) => t*t*1.2);
  H.pony = merge([cap(), tie(c[0], c[1] + r[1]*.26, back - .008), tail(c[1] + r[1]*.24, back - .02, .34, .036)]);
  H.ponyLow = merge([cap(), tie(c[0], c[1] - r[1]*.42, back + .005), tail(c[1] - r[1]*.45, back - .004, .3, .032)]);
  const plait = (x0, y0, z0, L, dx = 0, r0 = .026, frontIt = false) => { const pts = frontIt ? [[x0, y0, z0], [x0 + dx*.6, y0 - L*.25, z0 + .03], [x0 + dx, y0 - L*.55, z0 + .15], [x0 + dx, y0 - L, z0 + .165]] : [[x0, y0, z0], [x0, y0 - L*.2, z0 - .03], [x0 + dx, y0 - L*.6, z0 - .055], [x0 + dx, y0 - L, z0 - .04]];
    const g = tube(pts, (t) => r0*(1 - t*.45)*(.78 + .22*Math.abs(Math.sin(t*34))), 46, 8, (t) => t*t*.8), end = tube([pts[3], [pts[3][0], pts[3][1] - .06, pts[3][2]]], (t) => r0*.3*(1 - t*.7), 4, 6); return merge([g, end]); };
  H.plait = merge([cap(), plait(c[0], c[1] - r[1]*.2, back + .002, .5)]);
  H.plaitLong = merge([cap(), plait(c[0], c[1] - r[1]*.15, back + .002, .78, 0, .03)]);
  H.twoPlaits = merge([cap(), plait(c[0] - r[0]*.72, c[1] - r[1]*.42, c[2] - r[2]*.32, .42, -.03, .022, true), plait(c[0] + r[0]*.72, c[1] - r[1]*.42, c[2] - r[2]*.32, .42, .03, .022, true)]);
  const bun = (y, z, rr = .056) => { const P = []; for (let i = 0; i <= 12; i++) { const t = i/12*Math.PI, row = []; for (let j = 0; j < 18; j++) { const a = j/18*Math.PI*2, w = 1 + .08*Math.sin(a*2 + t*5); row.push([c[0] + Math.cos(a)*Math.sin(t)*rr*w, y + Math.cos(t)*rr*.84*w, z + Math.sin(a)*Math.sin(t)*rr*w]); } P.push(row); } return gridGeo(P, true); };
  H.bunLow = merge([cap(), bun(c[1] - r[1]*.5, back - .03)]);
  H.bunHigh = merge([cap(), bun(c[1] + r[1]*.85, c[2] - r[2]*.25, .05)]);
  H.halfUp = merge([shell(S, hemOf(line - .012, r[1]*2.6, r[1]*3.4, .53), { th: .05, cols: 64, rows: 36, flare: longF, lift: longL, sway: .5 }), bun(c[1] + r[1]*.45, back - .012, .03)]);
  // flowers for a bun: gajra
  const fl = []; for (let i = 0; i < 14; i++) { const a = i/14*Math.PI*2; fl.push(at(new THREE.IcosahedronGeometry(.0088, 0), c[0] + Math.cos(a)*.054, c[1] - r[1]*.48 + Math.sin(i*2.3)*.005, back - .03 + Math.sin(a)*.054)); }
  H.gajra = merge(fl);
  for (const k in H) H[k].userData.kind = 'hair';
  return H;
}
// ------------------------------------------------------------------ hats, spectacles and everything else on the head
function makeHead(S) {
  const { c, r, eyeY, eyeZ, eyeW } = S, X = {}, top = c[1] + r[1], back = c[2] - r[2];
  const outside = (g, off) => { if (!S.push) return g; const p = g.attributes.position, q = [0, 0, 0]; for (let i = 0; i < p.count; i++) { q[0] = p.getX(i); q[1] = p.getY(i); q[2] = p.getZ(i); S.push(q, off); p.setXYZ(i, q[0], q[1], q[2]); } g.computeVertexNormals(); return g; };
  const dome = (k, yk = 1, cut = .55) => { const g = new THREE.SphereGeometry(1, 36, 18, 0, Math.PI*2, 0, Math.PI*cut); return outside(at(g, c[0], c[1] + r[1]*.05, c[2], r[0]*k, r[1]*k*yk, r[2]*k), .012); };
  const brim = () => { const P = []; for (let i = 0; i <= 5; i++) { const s = i/5, row = []; for (let j = 0; j <= 20; j++) { const a = (j/20 - .5)*Math.PI*.82, k = Math.cos(a*1.22), rr = r[2]*1.06 + s*.088*Math.pow(Math.max(0, k), .6); row.push([c[0] + Math.sin(a)*(r[0]/r[2])*rr, c[1] + r[1]*.36 - s*.012 - s*s*.012 + (1 - k)*.012 - s*Math.abs(Math.sin(a))*.012, c[2] + Math.cos(a)*rr]); } P.push(row); } const top = gridGeo(P), under = gridGeo(P.slice().reverse()); return merge([top, under]); };
  X.cap = merge([dome(1.09, .96, .5), brim(), at(new THREE.SphereGeometry(.009, 8, 6), c[0], top + .018, c[2])]);
  X.capBack = merge([dome(1.09, .96, .5), at(brim(), 0, 0, 2*c[2], 1, 1, -1)]);
  // a knitted beanie: a rib, a folded cuff
  { const rows = []; for (let i = 0; i <= 18; i++) { const s = i/18, k = s < .72 ? s/.72 : 1, y = c[1] + r[1]*(1.2 - k*.98) - (s > .72 ? (s - .72)*.1 : 0), q = Math.sqrt(Math.max(0, 1 - Math.pow(1 - k, 2)*.98)), row = []; for (let j = 0; j < 48; j++) { const a = j/48*Math.PI*2, cuff = s > .72 ? .008 : 0, rib = .0016*Math.sin(a*24); row.push([c[0] + Math.sin(a)*(r[0]*1.08*q + cuff + rib), y, c[2] + Math.cos(a)*(r[2]*1.08*q + cuff + rib)]); } rows.push(row); } X.beanie = outside(gridGeo(rows, true), .012); }
  // the Gandhi topi: white cloth folded to a ridge, two flat sides, a band round the head
  { const P = [], y0 = c[1] + r[1]*.4, y1 = c[1] + r[1]*1.26, R0 = 18, C0 = 16; for (let i = 0; i <= R0; i++) { const t = i/R0*2 - 1, w = r[0]*1.08*Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), .5), row = []; for (let j = 0; j <= C0; j++) { const u = j/C0*2 - 1, au = Math.abs(u), ridge = y1 - t*t*.022 + t*.006, base = y0 + Math.abs(t)*.018 - t*.012; row.push([c[0] + u*w, ridge + (base - ridge)*Math.pow(au, .85), c[2] + t*r[2]*1.14 + (1 - au)*t*.004]); } P.push(row); } for (const row of P) for (const q of row) S.push(q, .01); X.topi = merge([gridGeo(P), gridGeo(P.slice().reverse())]); }
  // a pheta: a length of cloth wound round and round, lumps running on a slant, the crest standing at one side and a tail behind
  { const P = [], RR = 30, CC = 64, y0 = c[1] + r[1]*.26, y1 = c[1] + r[1]*1.5; for (let i = 0; i <= RR; i++) { const s = i/RR, y = y0 + (y1 - y0)*s, cap = s > .78 ? Math.sqrt(Math.max(0, 1 - Math.pow((s - .78)/.22, 2))) : 1, row = []; for (let j = 0; j < CC; j++) { const a = j/CC*Math.PI*2, wr = Math.pow(Math.abs(Math.sin((s*6.5 + a/(Math.PI*2)*1.5 + Math.sin(a*2)*.12)*Math.PI)), .55), rr = (1.1 + .13*Math.sin(s*Math.PI)) + .085*wr; row.push([c[0] + Math.sin(a)*r[0]*rr*cap, y + Math.cos(a)*.022*(1 - s), c[2] - .008 + Math.cos(a)*r[2]*rr*cap]); } P.push(row); } const crest = gridGeo([0, 1, 2, 3, 4, 5, 6].map(i => [-1, -.5, 0, .5, 1].map(u => { const t = i/6; return [c[0] + r[0]*.62 + u*(.018 + t*.045), y1 - .03 + t*.15, c[2] - .02 - t*.04 + Math.sin(u*2 + t*3)*.008]; }))); X.pheta = merge([gridGeo(P, true), crest, gridGeo([6, 5, 4, 3, 2, 1, 0].map(i => [-1, -.5, 0, .5, 1].map(u => { const t = i/6; return [c[0] + r[0]*.62 + u*(.018 + t*.045), y1 - .03 + t*.15, c[2] - .02 - t*.04 + Math.sin(u*2 + t*3)*.008]; }))), tube([[c[0] - .02, c[1] + r[1]*.5, back - .012], [c[0] - .03, c[1] - .05, back - .05], [c[0] - .02, c[1] - .34, back - .06]], (t) => .026 + t*.018, 16, 8, (t) => t*.7)]); X.pheta.userData.kind = 'cloth'; }
  // a headscarf over the hair, down to the shoulders, a hood of cloth (hijab, or a dupatta drawn up)
  X.scarf = shell(S, (a) => { const f = front(a, .64); return f*(-r[1]*.46) + (1 - f)*r[1]*2.1; }, { th: .06, cols: 60, rows: 24, flare: (b) => .05 + Math.min(b*.45, .32) });
  // a stole round the face, as anyone on a scooter wears it: only the eyes showing
  X.faceScarf = shell(S, (a) => r[1]*2, { th: .075, cols: 60, rows: 28, flare: (b) => .05 + Math.min(b*.3, .22) });
  { const g = X.faceScarf, p = g.attributes.position, i2 = []; const ix = g.index.array, keep = (a) => { const y = p.getY(a), z = p.getZ(a); return !(z > c[2] + r[2]*.5 && y < eyeY + .028 && y > eyeY - .022); }; for (let i = 0; i < ix.length; i += 3) if (keep(ix[i]) && keep(ix[i + 1]) && keep(ix[i + 2])) i2.push(ix[i], ix[i + 1], ix[i + 2]); g.setIndex(i2); }
  X.bandana = shell(S, hemOf(-r[1]*.5, r[1]*.1, r[1]*.45), { th: .075, gap: .014, cols: 44, rows: 12 });
  // spectacles: rims, a bridge, arms. Then sunglasses: dark lenses, bigger
  const rim = (x, rr, tube = .0028) => at(new THREE.TorusGeometry(rr, tube, 6, 22), x, eyeY, eyeZ + .014, 1, .86, 1);
  const arm = (s) => tube2([[c[0] + s*eyeW*.53, eyeY + .004, eyeZ + .012], [c[0] + s*(r[0] + .006), eyeY + .006, c[2] + .02], [c[0] + s*(r[0] + .002), eyeY - .012, c[2] - r[2]*.4]], .0026);
  function tube2(p, rr) { return tube(p, rr, 8, 5); }
  const bridge = tube2([[c[0] - eyeW*.09, eyeY + .004, eyeZ + .014], [c[0], eyeY + .01, eyeZ + .018], [c[0] + eyeW*.09, eyeY + .004, eyeZ + .014]], .0024);
  X.specs = merge([rim(c[0] - eyeW*.27, eyeW*.17), rim(c[0] + eyeW*.27, eyeW*.17), bridge, arm(-1), arm(1)]);
  const lens = (x, rr) => { const g = new THREE.SphereGeometry(rr, 14, 10); return at(g, x, eyeY, eyeZ + .012, 1, .84, .18); };
  X.shadesFrame = merge([rim(c[0] - eyeW*.28, eyeW*.2, .0032), rim(c[0] + eyeW*.28, eyeW*.2, .0032), bridge, arm(-1), arm(1)]);
  X.shadesLens = merge([lens(c[0] - eyeW*.28, eyeW*.195), lens(c[0] + eyeW*.28, eyeW*.195)]);
  // jewellery
  const ear = (s) => [c[0] + s*(r[0] + .002), eyeY - .045, c[2] - .006];
  X.studs = merge([-1, 1].map(s => at(new THREE.SphereGeometry(.0058, 8, 6), ...ear(s))));
  X.hoops = merge([-1, 1].map(s => at(new THREE.TorusGeometry(.016, .0018, 6, 18), ear(s)[0], ear(s)[1] - .015, ear(s)[2], 1, 1, 1, 0, Math.PI/2)));
  X.jhumka = merge([-1, 1].flatMap(s => [at(new THREE.SphereGeometry(.0052, 8, 6), ...ear(s)), at(new THREE.ConeGeometry(.0125, .018, 12, 1, true), ear(s)[0], ear(s)[1] - .017, ear(s)[2])]));
  X.nosePin = at(new THREE.SphereGeometry(.0028, 6, 5), c[0] + eyeW*.13, eyeY - .046, eyeZ + .004);
  X.tikka = merge([tube([[c[0], c[1] + r[1]*.92, c[2] + r[2]*.42], [c[0], c[1] + r[1]*.62, c[2] + r[2]*.86], [c[0], c[1] + r[1]*.42, c[2] + r[2]*1.0]], .0012, 8, 4), at(new THREE.SphereGeometry(.0075, 8, 6), c[0], c[1] + r[1]*.38, c[2] + r[2]*1.01)]);
  // faces: moustaches, a chin beard
  const mo = (w, drop, t) => merge([-1, 1].map(s => tube([[c[0] + s*.002, eyeY - .068, eyeZ + .006], [c[0] + s*w*.5, eyeY - .07, eyeZ - .002], [c[0] + s*w, eyeY - .07 - drop, eyeZ - .018]], (u) => t*(1 - u*.6), 8, 6)));
  X.tash = mo(.031, .006, .0072); X.tashBig = mo(.044, -.008, .0095); X.tashThin = mo(.027, .003, .0038);
  X.goatee = at(new THREE.SphereGeometry(.016, 10, 8), c[0], eyeY - .118, eyeZ - .012, 1, 1.5, .72);
  for (const k of ['faceScarf', 'scarf', 'bandana', 'cap', 'capBack', 'beanie', 'topi']) X[k].userData.kind = 'cloth';
  return X;
}
// ------------------------------------------------------------------ on the body
function makeBody(F) {
  const { neckY, shY, hipY, chestZ, backZ, shX, wristL, wristR } = F, X = {};
  const on = F.onBody, neck = (drop, n = 48) => { const pts = []; for (let i = 0; i <= n; i++) { const a = i/n*Math.PI*2, f = (1 + Math.sin(a))/2, p = [Math.cos(a)*.066, neckY - .012 - Math.pow(f, 2.4)*drop, -.012 + Math.sin(a)*.078]; on(p, .005); pts.push(p); } return pts; };
  // necklaces
  X.chain = tube(neck(.1), .0018, 56, 5);
  { const pts = neck(.15, 38); X.mangal = merge(pts.map(p => at(new THREE.IcosahedronGeometry(.0034, 0), p[0], p[1], p[2]))); const q = pts[10]; X.mangalP = merge([at(new THREE.SphereGeometry(.0085, 10, 8), q[0] - .008, q[1] - .009, q[2] + .004, 1, 1, .5), at(new THREE.SphereGeometry(.0085, 10, 8), q[0] + .008, q[1] - .009, q[2] + .004, 1, 1, .5)]); }
  // straps follow the body they lie across
  const strap = (pts, w = .012) => { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), out = []; for (let i = 0; i <= 34; i++) { const q = c.getPointAt(i/34), p = [q.x, q.y, q.z]; on(p, .01); out.push(p); } return tube(out, w, 44, 6); };
  const across = [[shX*.5, shY + .03, 0], [shX*.1, shY - .08, chestZ + .03], [-shX*.5, hipY + .14, chestZ*.94], [-shX*.78, hipY + .02, 0], [-shX*.3, hipY + .12, backZ - .03], [shX*.45, shY - .12, backZ - .02], [shX*.5, shY + .03, 0]];
  const box = (x, y, z, sx, sy, sz, n = .34) => at(makeRB(n), x, y, z, sx, sy, sz);
  X.strapX = strap(across, .009);
  // a laptop bag: stiff, a flap over the front with two buckles, a zip along the top
  { const bx = -shX*.98, by = hipY - .03, bz = .02, w = .075, h = .29, d = .38; X.laptop = merge([strap(across, .01), box(bx, by, bz, w, h, d), box(bx - w*.47, by + h*.17, bz, .012, h*.68, d*1.01, .2), box(bx - w*.58, by + h*.02, bz - d*.25, .006, .05, .018, .25), box(bx - w*.58, by + h*.02, bz + d*.25, .006, .05, .018, .25), box(bx, by + h*.5, bz, w*.5, .006, d*.92, .2)]); }
  // a jhola: soft, wider at the bottom, sagging
  { const bx = shX*1.0, P = []; for (let i = 0; i <= 12; i++) { const t = i/12, row = []; for (let j = 0; j < 24; j++) { const a = j/24*Math.PI*2, wd = .15 + .05*t - .012*Math.sin(t*3.1), sag = .012 + .05*Math.sin(t*2.9)*(t < .96 ? 1 : .2); row.push([bx + Math.cos(a)*sag + (Math.cos(a) > 0 ? .012 : 0), hipY + .14 - t*.36 + Math.sin(a)*Math.abs(Math.sin(a))*t*.006, Math.sin(a)*wd]); } P.push(row); } X.jhola = merge([gridGeo(P, true), strap([[shX*.6, shY + .02, -.02], [shX*.72, shY - .3, chestZ*.65], [bx, hipY + .14, .1]], .012), strap([[shX*.6, shY + .02, -.02], [shX*.78, shY - .3, backZ*.75], [bx, hipY + .14, -.1]], .012)]); }
  // a handbag on the shoulder: a structured box, a flap, a clasp, two short handles
  { const bx = shX*1.06, by = hipY + .02, w = .065, h = .17, d = .25; X.handbag = merge([box(bx, by, 0, w, h, d, .3), box(bx + w*.42, by + h*.2, 0, .014, h*.56, d*.98, .22), strap([[shX*.62, shY + .02, -.03], [shX*.86, shY - .22, chestZ*.45], [bx, by + h*.5, .07]], .0065), strap([[shX*.62, shY + .02, -.03], [shX*.88, shY - .22, backZ*.45], [bx, by + h*.5, -.07]], .0065)]); X.clasp = box(bx + w*.56, by + h*.02, 0, .006, .022, .022, .4); }
  // a tote: tall and open, its handles over the shoulder
  { const bx = shX*.98, P = [], Q = []; for (let i = 0; i <= 8; i++) { const t = i/8, row = []; for (let j = 0; j < 20; j++) { const a = j/20*Math.PI*2; row.push([bx + Math.cos(a)*(.025 + t*.03), hipY + .16 - t*.38, Math.sin(a)*.17]); } P.push(row); } X.tote = merge([gridGeo(P, true), strap([[shX*.6, shY + .02, -.02], [shX*.74, shY - .28, chestZ*.6], [bx, hipY + .16, .07]], .007), strap([[shX*.6, shY + .02, -.02], [shX*.76, shY - .28, backZ*.6], [bx, hipY + .16, -.07]], .007)]); }
  // a backpack: main body, front pocket, side pockets, a top loop, padded straps
  { const zb = backZ - .09, yb = shY - .25; X.pack = merge([box(0, yb, zb, .3, .46, .17, .42), box(0, yb - .08, zb - .1, .24, .22, .06, .36), box(-.158, yb - .1, zb, .04, .2, .12, .4), box(.158, yb - .1, zb, .04, .2, .12, .4), box(0, yb + .05, zb - .088, .2, .008, .012, .2), tube([[-.04, yb + .23, zb], [0, yb + .27, zb], [.04, yb + .23, zb]], .006, 10, 6), ...[-1, 1].map(s => strap([[s*.11, shY - .46, backZ - .02], [s*.13, shY - .1, backZ - .01], [s*.1, shY + .02, .0], [s*.1, shY - .07, chestZ*.8], [s*.1, shY - .3, chestZ*.9], [s*.12, shY - .44, .05]], .012))]); }
  // a handkerchief at the neck, a gamcha over a shoulder
  X.gamcha = merge([tube([[-shX*.1, neckY - .04, backZ*.5], [shX*.42, shY + .018, 0], [shX*.62, shY - .32, chestZ*.92]], .022, 16, 6, (t) => t*.3), tube([[shX*.42, shY + .018, 0], [shX*.55, shY - .36, backZ - .01]], .021, 10, 6, (t) => t*.3)]);
  // a tie
  { const P = []; for (let i = 0; i <= 8; i++) { const t = i/8, y = neckY - .08 - t*.42, w = .012 + t*.034; P.push([[-w, y, chestZ + .018 - (1 - t)*.024], [0, y, chestZ + .024 - (1 - t)*.02], [w, y, chestZ + .018 - (1 - t)*.024]]); } X.tie = gridGeo(P); }
  // wrists: a watch, bangles (they go on the forearm, whichever way the arm is)
  const wrist = (w, s) => { const r = .036, list = [at(new THREE.TorusGeometry(r, .0052, 6, 18), w[0], w[1], w[2], 1, 1, 1, 0, Math.PI/2)]; list.push(at(new THREE.CylinderGeometry(.018, .018, .007, 14), w[0], w[1] + r + .002, w[2])); return merge(list); };
  X.watchL = wrist(wristL); X.watchR = wrist(wristR);
  const bangles = (w, n, col) => merge(Array.from({ length: n }, (_, i) => at(new THREE.TorusGeometry(.04, .0024, 5, 18), w[0] - Math.sign(w[0])*(i*.0065 + .004), w[1], w[2], 1, 1, 1, 0, Math.PI/2)));
  X.banglesL = bangles(wristL, 7); X.banglesR = bangles(wristR, 7);
  for (const k of ['strapX', 'gamcha', 'laptop', 'jhola', 'pack', 'tie', 'handbag', 'tote']) X[k].userData.kind = 'cloth';
  return X;
}
function makeRB(n = .4) { const g = new THREE.SphereGeometry(.5, 12, 8), p = g.attributes.position, f = (q) => Math.sign(q)*Math.pow(Math.abs(q*2), n)*.5; for (let i = 0; i < p.count; i++) p.setXYZ(i, f(p.getX(i)), f(p.getY(i)), f(p.getZ(i))); g.computeVertexNormals(); return g; }

// ------------------------------------------------------------------ cloth cut from scratch
// everything the cloth has to go round, as how far out the body reaches in each direction at each height
class Fit {
  constructor(A, arms) { this.pts = []; const P = A.pos, SI = A.si, SW = A.sw;
    for (let i = 0; i < P.length/3; i++) { let w = 0; for (let c = 0; c < 4; c++) if (arms.has(SI[i*4 + c])) w += SW[i*4 + c]; if (w < .3) this.pts.push(P[i*3], P[i*3 + 1], P[i*3 + 2]); } }
  ring(y, segs, band = .03) { const key = Math.round(y*100) + '/' + segs, hit = (this.memo || (this.memo = new Map())).get(key); if (hit) return hit; const need = new Float32Array(segs), pts = this.pts; let cx = 0, cz = 0, n = 0;
    for (let i = 0; i < pts.length; i += 3) if (Math.abs(pts[i + 1] - y) < band) { cx += pts[i]; cz += pts[i + 2]; n++; } if (n) { cx /= n; cz /= n; }
    for (let i = 0; i < pts.length; i += 3) { if (Math.abs(pts[i + 1] - y) > band) continue; const dx = pts[i] - cx, dz = pts[i + 2] - cz, a = (Math.floor((Math.atan2(dz, dx)/(2*Math.PI) + 1)*segs))%segs; need[a] = Math.max(need[a], Math.hypot(dx, dz)); }
    for (let k = 0; k < 3; k++) { const c = need.slice(); for (let a = 0; a < segs; a++) need[a] = Math.max(c[a], (c[(a + 1)%segs] + c[(a + segs - 1)%segs])*.5); }
    const out = { need, cx, cz }; this.memo.set(key, out); return out; }
}
// bones, in the mesh's own space, for how cloth hangs on them
function weighTube(y, x, hipY, kneeY, B) {
  if (y > hipY + .08) { const k = smooth(hipY + .08, hipY + .3, y); return [[B.spine1, 1 - k], [B.spine3, k]]; }
  if (y > hipY) { const k = (y - hipY)/.08; return [[B.spine1, k], [B.pelvis, 1 - k]]; }
  const leg = Math.min(1, (hipY - y)/Math.max(.1, hipY - kneeY)*.9), s = Math.max(.15, Math.min(.85, .5 + x/.34));
  return [[B.pelvis, 1 - leg*.82], [B.tl, leg*.82*s], [B.tr, leg*.82*(1 - s)]];
}
function fromGrid(P, UV, weights) {
  const R = P.length, C = P[0].length, wrap = P.wrap, pos = [], uv = [], bp = [], si = [], sw = [], idx = [];
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const p = P[i][j]; pos.push(p[0], p[1], p[2]); bp.push(p[0], p[1], p[2]); uv.push(UV(i/(R - 1), j/(C - 1))[0], UV(i/(R - 1), j/(C - 1))[1]); const W = weights(p, i/(R - 1), j/(C - 1)); for (let c = 0; c < 4; c++) { si.push(W[c] ? W[c][0] : 0); sw.push(W[c] ? W[c][1] : 0); } }
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < (wrap ? C : C - 1); j++) { const j2 = (j + 1)%C, a = i*C + j, b = i*C + j2, c = (i + 1)*C + j2, d = (i + 1)*C + j; idx.push(a, d, c, a, c, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return { pos, nor: Array.from(g.attributes.normal.array), uv, bp, si, sw, idx };
}
// how wide the hips are all the way round: what a long garment falls from
function hipOf(F, hipY, Q) { if (F.hips) return F.hips; const c = new Float32Array(Q); for (const y of [hipY + .04, hipY - .03, hipY - .1, hipY - .17]) { const r = F.ring(y, Q, .035); for (let i = 0; i < Q; i++) c[i] = Math.max(c[i], r.need[i]); } for (let k = 0; k < 4; k++) { const d = c.slice(); for (let i = 0; i < Q; i++) c[i] = (d[(i + 1)%Q] + d[(i + Q - 1)%Q] + 2*d[i])/4; } return F.hips = c; }
// a tube of cloth round the body from y0 to y1
function tubeCloth(F, y0, y1, rows, segs, ease, B, hipY, kneeY, opts = {}) {
  const P = []; P.wrap = true; const Q = 64;
  for (let i = 0; i <= rows; i++) {
    const t = i/rows, y = y0 + (y1 - y0)*t, { need, cx, cz } = F.ring(y, Q, .035), row = [];
    for (let j = 0; j < segs; j++) {
      const a = j/segs*Math.PI*2, qa = a/(2*Math.PI)*Q, q0 = Math.floor(qa)%Q, q1 = (q0 + 1)%Q; let nd = need[q0] + (need[q1] - need[q0])*(qa - Math.floor(qa));
      if (y < hipY - .03) { const col = hipOf(F, hipY, Q); nd = col[q0] + (col[q1] - col[q0])*(qa - Math.floor(qa)); }
      let r = Math.max(nd, opts.minR || .05) + ease(t, a);
      if (opts.pleat) r += opts.pleat(t, a);
      row.push([cx + Math.cos(a)*r, y, cz + Math.sin(a)*r]);
    }
    P.push(row);
  }
  return fromGrid(P, (t, u) => [u, t], (p) => weighTube(p[1], p[0], hipY, kneeY, B));
}
// a band of cloth along a path, its width across it
function drape(path, width, across, nearW, rows = 26, cols = 8, conform) {
  const c = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p))), P = [];
  for (let i = 0; i <= rows; i++) { const t = i/rows, q = c.getPointAt(t), row = []; const a = across(t); const w = typeof width === 'function' ? width(t) : width; for (let j = 0; j <= cols; j++) { const u = j/cols - .5; const pt = [q.x + a[0]*u*w, q.y + a[1]*u*w + Math.sin(j*1.9)*.0035, q.z + a[2]*u*w + Math.sin(j*2.7 + t*7)*.005]; if (conform) conform(pt); row.push(pt); } P.push(row); }
  return fromGrid(P, (t, u) => [1.5 + u, t], nearW);
}

export function buildCloth(sk, k, partsA, B, U) {
  const { bones, boneInv } = B, body = partsA.get('body_' + k), arms = new Set(); bones.forEach((b, i) => { if (/arm|hand|clavicle|index|middle|pinky|ring|thumb/.test(b.name)) arms.add(i); });
  const idx = (n) => bones.findIndex(b => b.name === n), bo = { pelvis: idx('pelvis'), spine1: idx('spine_01'), spine2: idx('spine_02'), spine3: idx('spine_03'), neck: idx('neck_01'), tl: idx('thigh_l'), tr: idx('thigh_r') };
  const F = new Fit(body, arms), hipY = U.hip, neckY = U.neck, foot = U.foot, kneeY = U.knee;
  // a kurta: from under the arms to below the knee, widening over the hips, a little fall to it, the side slits are cut by the shader
  const kurta = tubeCloth(F, neckY - .24, kneeY - .1, 34, 48, (t, a) => .015 + smooth(.3, 1, t)*.05 + .006*Math.sin(a*11 + t*5)*smooth(.25, 1, t), bo, hipY, kneeY, { minR: .09 });
  // a saree: pleated at the front from the waist to the floor, close round the hips and falling straight
  const saree = tubeCloth(F, hipY + .17, foot + .02, 44, 72, (t, a) => .012 + smooth(.12, 1, t)*.045, bo, hipY, kneeY, { minR: .08,
    pleat: (t, a) => { const fr = smooth(.9, .15, Math.abs(a - Math.PI/2)); return fr*(.009 + t*.006)*Math.sin(a*30)*smooth(.02, .15, t) + (1 - fr)*.003*Math.sin(a*9 + t*4)*t; } });
  // anything laid over the body stays on the outside of it
  U.onBody = (p, m = .006) => { const { need, cx, cz } = F.ring(p[1], 48, .03), dx = p[0] - cx, dz = p[2] - cz, a = Math.atan2(dz, dx), i = Math.floor((a/(2*Math.PI) + 1)*48)%48, n = Math.max(need[i], need[(i + 1)%48], need[(i + 47)%48]) + m, r = Math.hypot(dx, dz); if (r < n && r > 1e-4) { p[0] = cx + dx/r*n; p[2] = cz + dz/r*n; } };
  const conf = (p) => { if (p[1] < hipY - .4 || p[1] > neckY - .04) return; const { need, cx, cz } = F.ring(p[1], 48, .035), dx = p[0] - cx, dz = p[2] - cz, a = Math.atan2(dz, dx), i = Math.floor((a/(2*Math.PI) + 1)*48)%48, n = Math.max(need[i], need[(i + 1)%48], need[(i + 47)%48]) + .021, r = Math.hypot(dx, dz); if (r < n) { p[0] = cx + dx/r*n; p[2] = cz + dz/r*n; } };
  const ring = (y, a, extra = .02) => { const { need, cx, cz } = F.ring(y, 48, .035), i = Math.floor((a/(2*Math.PI) + 1)*48)%48; return [cx + Math.cos(a)*(need[i] + extra), y, cz + Math.sin(a)*(need[i] + extra)]; };
  const nearW = (p, t) => { const y = p[1]; if (y > hipY + .1) { const k = smooth(hipY + .1, neckY - .1, y); return [[bo.spine1, 1 - k], [bo.spine3, k]]; } return [[bo.pelvis, .5], [bo.spine1, .5]]; };
  // the pallu: tucked in at the right of the waist, across the front, up over the left shoulder and down the back
  const lShoulder = neckY - .025, sx = U.shX*.5, pz = (y, a) => ring(y, a, .026);
  const pallu = drape([pz(hipY + .05, 2.8), pz(hipY + .17, 2.2), pz(hipY + .3, 1.6), pz(neckY - .16, 1.05), [sx*1.25, lShoulder + .02, U.chest*.1], [sx*1.15, lShoulder - .1, U.back - .03], [sx*.9, hipY + .22, U.back - .06], [sx*.75, hipY - .14, U.back - .085], [sx*.65, hipY - .42, U.back - .09]], (t) => .22 + smooth(.5, 1, t)*.16 + smooth(.32, .05, t)*.06, (t) => (t < .45 ? [.55, .7, .4] : t < .58 ? [.8, .05, .6] : [1, 0, .12]), nearW, 40, 12, conf);
  // a dupatta: a long light scarf round the neck, both ends falling, one in front and one down the back
  const dupatta = drape([[-sx*1.2, hipY - .08, U.chest + .05], [-sx*1.25, hipY + .28, U.chest + .025], [-sx*1.08, neckY - .05, U.chest*.72], [-sx*.5, neckY + .025, U.back*.1], [sx*.6, neckY + .012, U.back*.65], [sx*1.05, neckY - .08, U.back - .02], [sx*.95, hipY + .3, U.back - .055], [sx*.8, hipY - .25, U.back - .065]], .19, (t) => (t < .28 ? [1, 0, .15] : t < .62 ? [.15, .32, .9] : [1, 0, -.1]), nearW, 36, 7, conf);
  return { cloth_kurta: kurta, cloth_saree: saree, x_pallu: pallu, x_dupatta: dupatta };
}

// ------------------------------------------------------------------ the kit: what's in the wardrobe for each of m and f
export class Wardrobe {
  // this hair, without what would poke through a hat
  under(name) { const key = name + '_u'; if (this.hair[key]) return key; const g = this.hair[name], p = g.attributes.position, ix = g.index.array, yMax = this.S.c[1] + this.S.r[1]*.34, keep = []; for (let i = 0; i < ix.length; i += 3) if (p.getY(ix[i]) < yMax || p.getY(ix[i + 1]) < yMax || p.getY(ix[i + 2]) < yMax) keep.push(ix[i], ix[i + 1], ix[i + 2]); const o = new THREE.BufferGeometry(); for (const n in g.attributes) o.setAttribute(n, g.attributes[n]); o.setIndex(keep); o.userData.kind = 'hair'; this.hair[key] = o; return key; }
  constructor(skin, k, partsA, bones, boneInv, U) {
    const hairCap = partsA.get(k === 'f' ? 'hair_buzzedfemale' : 'hair_buzzed'), eyes = partsA.get('eyes');
    const box = (A) => { const b = new THREE.Box3(); for (let i = 0; i < A.pos.length; i += 3) b.expandByPoint(v.set(A.pos[i], A.pos[i + 1], A.pos[i + 2])); return b; };
    const bc = box(hairCap), be = box(eyes), size = bc.getSize(new THREE.Vector3()), ctr = bc.getCenter(new THREE.Vector3());
    const S = { fem: k === 'f', c: [ctr.x, bc.max.y - size.y*.5 - .012, ctr.z], r: [size.x*.5 + .002, size.y*.5 + .004, size.z*.5 + .002], eyeY: (be.min.y + be.max.y)/2, eyeZ: be.max.z, eyeW: be.max.x - be.min.x };
    const pos = (n) => { const i = bones.findIndex(b => b.name === n), m = new THREE.Matrix4().copy(boneInv[i]).invert(); return new THREE.Vector3().setFromMatrixPosition(m); };
    const wl = pos('hand_l'), wr = pos('hand_r'), low = pos('lowerarm_l'), FF = { onBody: U.onBody, neckY: U.neck, shY: pos('upperarm_l').y + .015, hipY: U.hip, chestZ: U.chest, backZ: U.back, shX: Math.abs(pos('upperarm_l').x) + .06, wristL: [wl.x - Math.sign(wl.x)*.035, wl.y, wl.z], wristR: [wr.x - Math.sign(wr.x)*.035, wr.y, wr.z] };
    // how far the actual head reaches in every direction from the skull's middle: hair sits on that, not on a guess
    { const N = 28, M = 56, map = new Float32Array(N*M), bin = (d) => { const e = Math.min(N - 1, Math.floor((Math.asin(Math.max(-1, Math.min(1, d[1])))/Math.PI + .5)*N)), f = Math.floor((Math.atan2(d[0], d[2])/(Math.PI*2) + 1)*M)%M; return e*M + f; }, B = partsA.get('body_' + k).pos, c0 = S.c, dirOf = (x, y, z) => { const dx = x - c0[0], dy = y - c0[1], dz = z - c0[2], L = Math.hypot(dx, dy, dz) || 1; return [dx/L, dy/L, dz/L, L]; };
      for (let i = 0; i < B.length; i += 3) { if (B[i + 1] < U.neck + .03) continue; const d = dirOf(B[i], B[i + 1], B[i + 2]), b = bin(d); map[b] = Math.max(map[b], d[3]); }
      const grown = map.slice(); for (let e = 0; e < N; e++) for (let f = 0; f < M; f++) { let v = map[e*M + f]; for (let de = -1; de <= 1; de++) for (let df = -1; df <= 1; df++) { const e2 = e + de; if (e2 >= 0 && e2 < N) v = Math.max(v, map[e2*M + (f + df + M)%M]); } grown[e*M + f] = v; }
      S.push = (q, off) => { const d = dirOf(q[0], q[1], q[2]), m = grown[bin(d)]; if (m > 0 && d[3] < m + off) { q[0] = c0[0] + d[0]*(m + off); q[1] = c0[1] + d[1]*(m + off); q[2] = c0[2] + d[2]*(m + off); } }; }
    this.hair = makeHair(S); this.head = makeHead(S); this.body = makeBody(FF); this.S = S;
    this.bi = (n) => bones.findIndex(b => b.name === n);
    this.headB = this.bi('Head'); this.spineB = this.bi('spine_03'); this.pelvisB = this.bi('pelvis'); this.laB = this.bi('lowerarm_l'); this.raB = this.bi('lowerarm_r'); this.neckB = this.bi('neck_01');
    // builds: how much wider or deeper each part of the body is than the model, per person
    const pivot = (n) => pos(n), mk = (spec) => { const out = []; for (const [n, x, z] of spec) { const i = this.bi(n); if (i < 0) continue; const p = pivot(n), m = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeScale(x, 1, z)).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z)); out.push([i, m]); } return out; };
    const legs = (t, c) => [['thigh_l', t, t], ['thigh_r', t, t], ['calf_l', c, c], ['calf_r', c, c]], arms = (u, l) => [['upperarm_l', 1, 1], ['upperarm_r', 1, 1]];
    this.builds = [[], // average
      mk([['spine_01', .9, .9], ['spine_02', .9, .9], ['spine_03', .92, .92], ['pelvis', .93, .93], ...legs(.88, .9)]),        // slight
      mk([['spine_01', .84, .84], ['spine_02', .84, .84], ['spine_03', .86, .86], ['pelvis', .88, .9], ...legs(.8, .84)]),       // thin
      mk([['spine_01', 1.1, 1.14], ['spine_02', 1.1, 1.13], ['spine_03', 1.05, 1.06], ['pelvis', 1.05, 1.05], ...legs(1.04, 1.02)]),    // solid
      mk([['spine_01', 1.16, 1.34], ['spine_02', 1.14, 1.28], ['spine_03', 1.06, 1.1], ['pelvis', 1.08, 1.12], ...legs(1.05, 1.03)]),    // a belly
      mk([['spine_01', 1.2, 1.24], ['spine_02', 1.18, 1.22], ['spine_03', 1.12, 1.14], ['pelvis', 1.16, 1.16], ...legs(1.09, 1.06)]),   // heavy
      mk([['spine_01', .98, 1], ['spine_02', 1.03, 1.03], ['spine_03', 1.13, 1.1], ['pelvis', .97, .97], ...legs(1.05, 1.03)]),         // broad shoulders
    ];
  }
}
const HAIR_F = ['long', 'long', 'wavy', 'wavy', 'shoulder', 'lob', 'bob', 'bob', 'fringe', 'pony', 'pony', 'ponyLow', 'plait', 'plaitLong', 'twoPlaits', 'bunLow', 'bunLow', 'bunHigh', 'halfUp'];
const HAIR_TRAD = ['plaitLong', 'plaitLong', 'plait', 'bunLow', 'bunLow', 'bunLow', 'long', 'twoPlaits'];
const HAIR_M = ['crop', 'crop', 'parted', 'parted', 'parted', 'sweep', 'sweep', 'quiff', 'curly', 'curly', 'buzz', 'bald', 'collar'];
const CAP = [0x223a6b, 0x8a2c2c, 0x1d1d20, 0xece7da, 0x3f5d3b, 0xd98a2b, 0x6d6a66];
const SCARF = [0xc94f4f, 0x3f6d8e, 0xe0a8bc, 0x6b4c8a, 0xede8dd, 0x2f7a68, 0xd1a23f, 0x1e2230];
const BAG = [0x7a4b28, 0x1d1f24, 0x2e4a6b, 0x8a7a5a, 0x7b2d2d, 0x3f4f3a, 0xc08a5a];
const col = (h) => new THREE.Color(h).convertSRGBToLinear();
// what this person has on, decided once for each look
export function dress(H, W) {
  const L = H.look; if (L._dress) return L._dress;
  // the seed is their look, so someone stays who they are whichever body the crowd draws them on
  const hx = (c) => c && c.getHex ? c.getHex() : (c || 0), fem = !!L.female, base = hash([hx(L.top), hx(L.bottom), hx(L.skin), hx(L.shoe), hx(L.hair), hx(L.pat), hx(L.patCol), L.scale, L.style, L.beard, L.bindi].join()), R = rngOf(base || 7), out = L._dress = { build: 0, hair: null, hairCol: null, items: [], cloth: [] };
  const saree = L.cut.w > 1.5 && L.cut.w < 2.5, kurta = !saree && L.cut.y < .9, skirt = L.cut.w > 2.5, cop = L.acc === 'cap_police', trad = saree || kurta;
  const hc = (L.hair ? L.hair.clone() : col(0x15100c)).lerp(col(0x17100b), R.chance(.08) ? .2 : .8); if (R.chance(fem ? .06 : .16)) hc.lerp(col(0xa8a49c), R.range(.4, .95));          // near-black or dark brown, some going grey
  out.hairCol = hc.multiplyScalar(1.1);
  out.build = R.pick(fem ? [0, 0, 0, 1, 1, 2, 3, 3, 4, 5] : [0, 0, 0, 1, 2, 3, 3, 4, 4, 5, 6, 6]);
  const item = (g, bone, c) => { if (g) out.items.push({ g, b: bone, c: c instanceof THREE.Color ? c : col(c) }); };
  const H_ = W.head, B_ = W.body;
  let hat = null;
  if (cop) { out.hair = 'crop'; }
  else if (fem) {
    out.hair = (trad ? R.pick(HAIR_TRAD) : R.pick(HAIR_F));
    const s = R.n();
    if (!trad && s < .1) hat = 'cap'; else if (!trad && s < .13) hat = 'beanie'; else if (s < .19) hat = 'scarf'; else if (!trad && s < .22) hat = 'bandana';
  } else {
    out.hair = R.pick(HAIR_M);
    const s = R.n();
    if (s < .13) hat = 'cap'; else if (s < .18) hat = 'capBack'; else if (s < .25 && (kurta || R.chance(.45))) hat = 'topi'; else if (s < .285) hat = 'pheta'; else if (s < .31) hat = 'beanie'; else if (s < .33) hat = 'bandana';
  }
  if (hat) {
    const hatCol = hat === 'topi' ? 0xf4f1e6 : hat === 'pheta' ? R.pick([0xe8761a, 0xd92b2b, 0xf0c21a, 0xf1ece0]) : hat === 'scarf' || hat === 'faceScarf' || hat === 'bandana' ? R.pick(SCARF) : R.pick(CAP);
    item(H_[hat], W.headB, hatCol);
    if (hat === 'scarf' || hat === 'faceScarf' || hat === 'pheta') out.hair = null; else if (out.hair) out.hair = W.under(out.hair === 'bald' || out.hair === 'buzz' ? 'crop' : out.hair);
    if (hat === 'faceScarf') { out.face = true; }
  }
  // eyes
  const shades = !cop && R.chance(fem ? .09 : .1) || hat === 'faceScarf', specs = !shades && R.chance(.14);
  if (shades) { item(H_.shadesFrame, W.headB, 0x0d0d0f); item(H_.shadesLens, W.headB, R.pick([0x0a0a0c, 0x1a1408, 0x10202a])); } else if (specs) item(H_.specs, W.headB, R.pick([0x161412, 0x2b2017, 0x8b7a4a, 0x444444]));
  if (fem) {
    const j = R.n(); const gold = R.pick([0xd9ae3f, 0xc99b32, 0xe6c15a]);
    if (!out.face) { if (j < .35 || saree) item(H_.jhumka, W.headB, gold); else if (j < .6) item(H_.hoops, W.headB, gold); else if (j < .8) item(H_.studs, W.headB, 0xe8e8e8); if (R.chance(saree ? .3 : .08)) item(H_.nosePin, W.headB, 0xe8c45a); if (saree && R.chance(.08)) item(H_.tikka, W.headB, gold); }
    if (saree || (kurta && R.chance(.3))) { item(B_.mangal, W.spineB, 0x0c0c0e); item(B_.mangalP, W.spineB, gold); } else if (R.chance(.25)) item(B_.chain, W.spineB, gold);
    if (saree || kurta || R.chance(.2)) { const bc = R.pick([0xb8232f, 0xd9ae3f, 0x2d6e3e, 0x1f4d9c]); item(B_.banglesL, W.laB, bc); if (R.chance(.7)) item(B_.banglesR, W.raB, bc); } else if (R.chance(.3)) item(B_.watchL, W.laB, 0x2a2622);
    if (saree && out.hair === 'bunLow' && R.chance(.6)) item(W.hair.gajra, W.headB, 0xf8f4e0);
    if (saree) out.cloth.push({ n: 'x_pallu' });
    else if (kurta && R.chance(.62)) out.cloth.push({ n: 'x_dupatta', c: col(R.pick([0xe7c8a0, 0xc94f4f, 0x356f8f, 0xdc9fb6, 0x4a3a7d, 0xece6da, 0x2f7a68])) });
  } else {
    if (R.chance(.35)) item(B_.watchL, W.laB, R.pick([0x2a2622, 0x8d8d90, 0xc9a24a]));
    if (R.chance(.14)) item(B_.chain, W.spineB, 0xc9a24a);
    if (!out.face) { const f = R.n(); if (f < .16) item(H_.tash, W.headB, hc); else if (f < .24) item(H_.tashBig, W.headB, hc); else if (f < .32) item(H_.tashThin, W.headB, hc); else if (f < .36) item(H_.goatee, W.headB, hc); }
    if (!trad && R.chance(.05) && L.cut.x > .6) item(B_.tie, W.spineB, R.pick([0x1b2f55, 0x6b1f1f, 0x2c2c2c]));
    if (R.chance(.05)) item(B_.gamcha, W.spineB, R.pick([0xcfc8b2, 0xa52a2a, 0x2a4f7a]));
  }
  // what they carry
  const c = R.n();
  if (fem) { if (c < .08) item(B_.pack, W.spineB, R.pick(BAG)); else if (c < .34) { const b = R.pick([...BAG, 0x8c1d2c, 0xd9c7a3]); item(B_.handbag, W.spineB, b); item(B_.clasp, W.spineB, 0xc9a24a); } else if (c < .44) item(B_.tote, W.spineB, R.pick([0xd9c7a3, 0x2e4a6b, 0xc25b3f, 0x31604f])); else if (c < .52) item(B_.jhola, W.spineB, R.pick([0xe0d5bd, 0xc25b3f, 0x2e4a6b])); }
  else { if (c < .1) item(B_.pack, W.spineB, R.pick(BAG)); else if (c < .16) item(B_.jhola, W.spineB, R.pick([...BAG, 0xe0d5bd])); else if (c < .22) item(B_.laptop, W.spineB, R.pick([0x1d1f24, 0x2b2622, 0x2e3a4a])); }
  out.kurta = kurta; out.saree = saree; out.bg = L.bindi;
  if (saree) { out.clothK = R.pick([1, 1, 2, 2, 3, 4]); out.pat = col(R.pick([0xd9ae3f, 0xd9ae3f, 0xd9ae3f, 0xcfcfd4, 0x7a1522, 0x14213d, 0xe9d9b4])); }
  else if (kurta) { out.clothK = R.pick([1, 1, 1, 2, 3, 4]); out.pat = (L.top.clone().lerp(col(R.chance(.5) ? 0xf2ead8 : 0x201810), .6)); }
  return out;
}
