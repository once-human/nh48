// Sets the story builds where it needs them and takes away after.
// The server room: two rows of 42U racks on a raised floor (perforated tiles in the cold aisle), mesh doors you
// can see the servers through, status LEDs that blink green and amber (one red), cable trays overhead with the
// bundles in them, a precision AC unit at the end of the aisle, and the cold blue light of the place.
import * as THREE from 'three';

const std = (color, roughness = 0.5, metalness = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...o });
function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d', { willReadFrequently: true }), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

export function buildServerRoom(rows = 2, per = 6) {
  const g = new THREE.Group(), leds = [];
  const rackW = 0.6, rackD = 1.07, rackH = 2.0, aisle = 1.2;
  // the floor: 600 mm tiles, every other one perforated in the cold aisle
  const floorT = tex(256, 256, (x, w, h) => { x.fillStyle = '#9aa1a8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6b7279'; x.lineWidth = 3; x.strokeRect(1, 1, w - 2, h - 2); });
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(per * 1.2, 6);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(per * rackW + 3, 0.3, rows * rackD + aisle * (rows + 1)), std(0xffffff, 0.7, 0.1, { map: floorT }));
  fl.position.y = 0.15; fl.receiveShadow = true; g.add(fl);
  const perf = tex(128, 128, (x, w, h) => { x.fillStyle = '#7c838a'; x.fillRect(0, 0, w, h); x.fillStyle = '#2b2f33'; for (let i = 4; i < w; i += 8) for (let j = 4; j < h; j += 8) { x.beginPath(); x.arc(i, j, 2.4, 0, 6.283); x.fill(); } });
  for (let k = 0; k < per; k += 2) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), std(0xffffff, 0.6, 0.2, { map: perf })); t.rotation.x = -Math.PI / 2; t.position.set(-per * rackW / 2 + k * rackW + 0.3, 0.302, 0); g.add(t); }
  // a rack: black frame, a mesh front door you see the servers through, the servers' faces and LEDs
  const mesh = tex(256, 512, (x, w, h) => { x.fillStyle = '#121416'; x.fillRect(0, 0, w, h); x.fillStyle = '#04050600'; for (let i = 3; i < w; i += 7) for (let j = 3; j < h; j += 7) { x.fillStyle = 'rgba(0,0,0,.85)'; x.fillRect(i, j, 4, 4); } });
  const face = tex(256, 512, (x, w, h) => { x.fillStyle = '#1b1e22'; x.fillRect(0, 0, w, h); for (let u = 0; u < 21; u++) { const y = 10 + u * 23.5; x.fillStyle = u % 5 === 2 ? '#2a2e33' : '#23272b'; x.fillRect(10, y, w - 20, 20); x.fillStyle = '#3a4047'; for (let d = 0; d < 8; d++) x.fillRect(18 + d * 26, y + 4, 20, 12); } });
  const frameM = std(0x15171a, 0.5, 0.4), doorM = std(0xffffff, 0.45, 0.5, { map: mesh, transparent: true, opacity: 0.88 }), faceM = std(0xffffff, 0.6, 0.2, { map: face });
  const ledG = new THREE.BoxGeometry(0.012, 0.012, 0.012);
  const COL = { g: new THREE.Color(0x35ff7a), a: new THREE.Color(0xffb020), r: new THREE.Color(0xff2a2a), off: new THREE.Color(0x15181b) };
  for (let r = 0; r < rows; r++) {
    const z = (r - (rows - 1) / 2) * (rackD + aisle), dir = r % 2 ? -1 : 1;             // the rows face each other across the cold aisle
    for (let k = 0; k < per; k++) {
      const x = -per * rackW / 2 + k * rackW + rackW / 2, rk = new THREE.Group(); rk.position.set(x, 0.3, z); rk.rotation.y = dir > 0 ? 0 : Math.PI; g.add(rk);
      const body = new THREE.Mesh(new THREE.BoxGeometry(rackW - 0.01, rackH, rackD), frameM); body.position.y = rackH / 2; body.castShadow = true; rk.add(body);
      const fc = new THREE.Mesh(new THREE.PlaneGeometry(rackW - 0.08, rackH - 0.12), faceM); fc.position.set(0, rackH / 2, -rackD / 2 - 0.004); fc.rotation.y = Math.PI; rk.add(fc);
      const dr = new THREE.Mesh(new THREE.PlaneGeometry(rackW - 0.04, rackH - 0.06), doorM); dr.position.set(0, rackH / 2, -rackD / 2 - 0.03); dr.rotation.y = Math.PI; rk.add(dr);
      rk.updateMatrix();
      for (let u = 0; u < 21; u++) for (let d = 0; d < 3; d++) {
        const m = new THREE.Matrix4().makeTranslation(-rackW / 2 + 0.07 + d * 0.025, 0.12 + u * 0.087, -rackD / 2 - 0.012).premultiply(rk.matrix);
        leds.push({ m, ph: Math.random() * 10, f: 2 + Math.random() * 9, kind: (k * 21 + u + d) % 37 === 0 ? 'r' : (u + d + k) % 6 === 0 ? 'a' : 'g' });
      }
      // name plate on top of the door
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.06), std(0xdfe3e8, 0.4)); pl.position.set(0, rackH - 0.08, -rackD / 2 - 0.035); pl.rotation.y = Math.PI; rk.add(pl);
    }
    // the cable tray over each row, with bundles of blue and yellow cable in it
    const tr = new THREE.Mesh(new THREE.BoxGeometry(per * rackW, 0.06, 0.4), std(0x8d949b, 0.4, 0.7)); tr.position.set(0, 2.72, z); g.add(tr);
    for (const [cz, col] of [[-0.1, 0x2a6fd6], [0.06, 0xe8c228], [0.14, 0x2a6fd6]]) { const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, per * rackW, 10), std(col, 0.6)); cb.rotation.z = Math.PI / 2; cb.position.set(0, 2.79, z + cz); g.add(cb); }
    for (let k = 0; k <= per; k += 2) { const dn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), std(0x2a6fd6, 0.6)); dn.position.set(-per * rackW / 2 + k * rackW, 2.5, z); g.add(dn); }
  }
  // a precision AC unit at the end of the aisle, its display lit
  const ac = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.85), std(0xe6e8ea, 0.45, 0.2)); ac.position.set(per * rackW / 2 + 0.9, 1.3, 0); ac.castShadow = true; g.add(ac);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.14), new THREE.MeshBasicMaterial({ color: 0x4fd1ff, toneMapped: false })); scr.position.set(per * rackW / 2 + 0.44, 1.75, 0); scr.rotation.y = -Math.PI / 2; g.add(scr);
  for (let k = 0; k < 8; k++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.7), std(0x9aa0a6, 0.5)); v.position.set(per * rackW / 2 + 0.445, 0.5 + k * 0.08, 0); g.add(v); }
  // cold blue light from above (a lit panel, no light objects: those would rebuild every shader)
  for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, toneMapped: false })); p.rotation.x = Math.PI / 2; p.position.set(-1.5 + k * 1.5, 3.2, 0); g.add(p); }
  // every LED in the room is one instanced mesh (one draw), blinking by its colour
  const IM = new THREE.InstancedMesh(ledG, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), leds.length);
  leds.forEach((L, i) => { IM.setMatrixAt(i, L.m); IM.setColorAt(i, COL[L.kind]); });
  IM.frustumCulled = false; g.add(IM);
  g.userData.tick = (t) => { leds.forEach((L, i) => IM.setColorAt(i, Math.sin(t * L.f + L.ph) > (L.kind === 'g' ? -0.3 : 0.2) ? COL[L.kind] : COL.off)); IM.instanceColor.needsUpdate = true; };
  return g;
}
