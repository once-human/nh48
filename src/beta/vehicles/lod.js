// The same model with less in it, for further off: its corners within `cell` metres of each other become one, as long as
// they face the same way and are the same colour and part. It keeps its outline and its colours, so going from one to
// the other doesn't show (the old far models were a handful of boxes, a different vehicle each time you came near).
import * as THREE from 'three';

// (`edges` keeps what faces different ways apart, for a model you can still make out; far off it can all run together)
export function reduced(g, cell, edges = true) {
  const P = g.attributes.position, N = g.attributes.normal, names = Object.keys(g.attributes).filter(k => k !== 'position' && k !== 'normal' && !g.attributes[k].isInstancedBufferAttribute);
  const keyOf = new Map(), map = new Int32Array(P.count), sum = [], cnt = [];
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), face = !edges ? 0 : ax > ay && ax > az ? (nx > 0 ? 0 : 1) : ay > az ? (ny > 0 ? 2 : 3) : (nz > 0 ? 4 : 5);
    // (one number for the place, the way it faces and its colour and part: a string for each corner of 32 models was a second of the load)
    let k = (Math.round(x/cell) + 512) + (Math.round(y/cell) + 512)*1024 + (Math.round(z/cell) + 512)*1048576 + face*1073741824;
    let w = 8589934592; for (const n of names) { const A = g.attributes[n]; for (let c = 0; c < A.itemSize; c++) { k += (Math.max(0, Math.round(A.array[i*A.itemSize + c]*4)) & 7)*w; w *= 8; } }
    let v = keyOf.get(k); if (v === undefined) { keyOf.set(k, v = cnt.length); sum.push([0, 0, 0, 0, 0, 0]); cnt.push(0); }
    map[i] = v; const s = sum[v]; s[0] += x; s[1] += y; s[2] += z; s[3] += nx; s[4] += ny; s[5] += nz; cnt[v]++;
  }
  const n = cnt.length, pos = new Float32Array(n*3), nor = new Float32Array(n*3), first = new Int32Array(n).fill(-1);
  for (let i = 0; i < P.count; i++) if (first[map[i]] < 0) first[map[i]] = i;
  for (let v = 0; v < n; v++) { const s = sum[v], c = cnt[v], L = Math.hypot(s[3], s[4], s[5]) || 1; pos[v*3] = s[0]/c; pos[v*3 + 1] = s[1]/c; pos[v*3 + 2] = s[2]/c; nor[v*3] = s[3]/L; nor[v*3 + 1] = s[4]/L; nor[v*3 + 2] = s[5]/L; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  for (const name of names) { const A = g.attributes[name], a = new A.array.constructor(n*A.itemSize); for (let v = 0; v < n; v++) for (let c = 0; c < A.itemSize; c++) a[v*A.itemSize + c] = A.array[first[v]*A.itemSize + c]; out.setAttribute(name, new THREE.BufferAttribute(a, A.itemSize, A.normalized)); }
  const src = g.index ? g.index.array : null, count = src ? src.length : P.count, ix = [];
  for (let t = 0; t + 2 < count; t += 3) { const a = map[src ? src[t] : t], b = map[src ? src[t + 1] : t + 1], c = map[src ? src[t + 2] : t + 2]; if (a !== b && b !== c && a !== c) ix.push(a, b, c); }
  out.setIndex(new THREE.BufferAttribute(n > 65535 ? new Uint32Array(ix) : new Uint16Array(ix), 1));
  return out;
}
