// Driver's-seat interior for cars (right-hand drive, as in India): a moulded dashboard, a steering
// wheel that turns with the front wheels, and a lit instrument cluster that shows the real speed.
import * as THREE from 'three';
import { ColorBuilder } from '../world/geo.js';
import { loft } from './loft.js';
import { carSpec } from './models.js';

const DASH = [0.17, 0.16, 0.15], SOFT = [0.28, 0.26, 0.24], WHEEL = [0.07, 0.07, 0.075], METAL = [0.55, 0.56, 0.58];
const MATTE = -1;
const DRIVER_Z = 0.36;          // the driver sits on the right (+z)

export function buildCarCockpit(kind, mats) {
  const S = carSpec(kind);
  const hl = S.L / 2, hw = S.W / 2, xf0 = hl - S.hood, belt = S.beltY;
  const group = new THREE.Group();
  // dashboard: a rounded slab across the car under the windscreen
  const d = new ColorBuilder();
  loft(d, [
    { x: xf0 - 0.62, w: hw - 0.1, yb: belt - 0.32, yt: belt - 0.08, n: 6 },
    { x: xf0 - 0.5, w: hw - 0.08, yb: belt - 0.34, yt: belt + 0.02, n: 6 },
    { x: xf0 - 0.2, w: hw - 0.07, yb: belt - 0.3, yt: belt + 0.03, n: 6 },
    { x: xf0 - 0.02, w: hw - 0.08, yb: belt - 0.12, yt: belt + 0.0, n: 5 },
  ], (seg, q) => (q.ny > 0.5 ? [...DASH, 0, MATTE] : [...SOFT, 0, MATTE]), { ring: 24 });
  group.add(new THREE.Mesh(d.build(), mats.solid));
  // cluster hood over the gauges, in front of the driver (built centred, then moved across)
  const hb = new ColorBuilder();
  loft(hb, [
    { x: xf0 - 0.62, w: 0.17, yb: belt - 0.04, yt: belt + 0.1, n: 3 },
    { x: xf0 - 0.5, w: 0.19, yb: belt - 0.04, yt: belt + 0.12, n: 3 },
    { x: xf0 - 0.38, w: 0.17, yb: belt - 0.02, yt: belt + 0.06, n: 3 },
  ], (seg) => (seg === 'capRear' ? null : [...DASH, 0, MATTE]), { ring: 16 });
  const hoodGeo = hb.build();
  hoodGeo.translate(0, 0, DRIVER_Z);
  group.add(new THREE.Mesh(hoodGeo, mats.solid));
  // steering column
  const col = new ColorBuilder();
  const cylG = new THREE.CylinderGeometry(0.035, 0.045, 0.4, 10);
  const ax = new THREE.Vector3(-0.91, 0.41, 0).normalize();
  const qa = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax);
  const wc = new THREE.Vector3(xf0 - 0.62, belt + 0.03, DRIVER_Z);
  col.addGeo(cylG, new THREE.Matrix4().compose(wc.clone().addScaledVector(ax, -0.2), qa, new THREE.Vector3(1, 1, 1)), WHEEL);
  group.add(new THREE.Mesh(col.build(), mats.solid));
  // the wheel itself on a pivot: rim, three spokes, hub with a little badge
  const w = new ColorBuilder();
  const rim = new THREE.TorusGeometry(0.185, 0.022, 8, 28);
  w.addGeo(rim, new THREE.Matrix4(), WHEEL, MATTE);
  for (const a of [0, 2.2, -2.2]) {
    const sp = new THREE.BoxGeometry(0.032, 0.17, 0.02);
    w.addGeo(sp, new THREE.Matrix4().compose(new THREE.Vector3(Math.sin(a) * 0.095, -Math.cos(a) * 0.095, 0.005), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a), new THREE.Vector3(1, 1, 1)), WHEEL, MATTE);
  }
  w.addGeo(new THREE.CylinderGeometry(0.055, 0.06, 0.04, 14), new THREE.Matrix4().makeRotationX(Math.PI / 2), [0.09, 0.09, 0.095]);
  w.addGeo(new THREE.CircleGeometry(0.022, 12), new THREE.Matrix4().makeTranslation(0, 0, 0.021), METAL);
  const wheelMesh = new THREE.Mesh(w.build(), mats.solid);
  const pivot = new THREE.Group();
  pivot.position.copy(wc);
  // the wheel's face points back at the driver (+z of the torus -> towards -x, tilted up)
  const qFace = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), ax);
  pivot.quaternion.copy(qFace);
  const spin = new THREE.Group();
  spin.add(wheelMesh);
  pivot.add(spin);
  group.add(pivot);
  // instrument cluster: a lit canvas screen behind the wheel
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 120;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1125), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(xf0 - 0.56, belt + 0.06, DRIVER_Z);
  screen.rotation.set(0, -Math.PI / 2, 0);
  screen.rotateX(-0.25);
  group.add(screen);
  // centre screen (infotainment), dimly lit
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), new THREE.MeshBasicMaterial({ color: 0x0d1418, toneMapped: false }));
  cs.position.set(xf0 - 0.33, belt - 0.06, 0);
  cs.rotation.set(0, -Math.PI / 2, 0);
  cs.rotateX(-0.35);
  group.add(cs);
  group.visible = false;

  let lastDraw = -1;
  const draw = (kmh, gear, rpm, night) => {
    const k = Math.round(kmh);
    const key = k * 100 + gear * 10 + Math.round(rpm * 9);
    if (key === lastDraw) return;
    lastDraw = key;
    ctx.clearRect(0, 0, 320, 120);
    ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, 320, 120);
    // speed arc
    const f = Math.min(1, kmh / 160);
    ctx.lineCap = 'round';
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(160, 128, 100, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.strokeStyle = '#5fd0ff';
    ctx.beginPath(); ctx.arc(160, 128, 100, Math.PI * 1.15, Math.PI * (1.15 + 0.7 * f)); ctx.stroke();
    ctx.fillStyle = '#f4f1ea'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 52px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText(String(k), 160, 92);
    ctx.font = '500 13px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(244,241,234,0.6)';
    ctx.fillText('KM/H', 160, 110);
    ctx.textAlign = 'left'; ctx.font = '600 18px ui-monospace, Menlo, Consolas, monospace'; ctx.fillStyle = '#f2b705';
    ctx.fillText(gear > 0 ? String(gear) : 'N', 22, 104);
    // rpm bar on the right
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(262, 30, 8, 70);
    ctx.fillStyle = rpm > 0.85 ? '#ff5a4f' : '#33d17a'; ctx.fillRect(262, 100 - 70 * Math.min(1, rpm), 8, 70 * Math.min(1, rpm));
    tex.needsUpdate = true;
  };
  draw(0, 1, 0.1, 0);
  // the cabin round you: carpet, door cards with armrests and handles, both front seats, the console and
  // handbrake between them, the rear bench, so nothing of the paint shows on the inside
  {
    const c = new ColorBuilder(), CLOTH = [0.33, 0.31, 0.28, 0, MATTE], TRIM = [0.2, 0.19, 0.18, 0, MATTE], CARPET = [0.11, 0.105, 0.1, 0, MATTE], HANDLE = [0.5, 0.5, 0.52, 0, 0.4];
    const bx = (x0, y0, z0, x1, y1, z1, col) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); c.addGeo(g, new THREE.Matrix4(), col.slice(0, 3), 0, col[4] ?? 0); };
    const fl = S.sill + 0.06, xb = -hl + 0.55, xd = xf0 - 0.55;
    bx(xb, fl - 0.04, -hw + 0.12, xd, fl, hw - 0.12, CARPET);
    for (const sd of [-1, 1]) {
      const zi = sd * (hw - 0.1);
      bx(xb, fl, zi - sd * 0.05, xd, belt - 0.02, zi, TRIM);                                     // door card
      bx(xf0 - 1.55, belt - 0.32, zi - sd * 0.13, xf0 - 0.85, belt - 0.26, zi - sd * 0.04, SOFT.concat([0, MATTE]));   // armrest
      bx(xf0 - 0.95, belt - 0.12, zi - sd * 0.07, xf0 - 0.82, belt - 0.08, zi - sd * 0.05, HANDLE);  // handle
      bx(xf0 - 0.4, belt - 0.05, zi - sd * 0.12, xf0 - 0.1, belt + 0.02, zi, TRIM);             // the corner by the mirror
      // front seats: cushion, backrest leaning back, headrest
      const zs = sd * 0.36, xs = xf0 - 1.35;
      bx(xs - 0.28, fl + 0.22, zs - 0.24, xs + 0.24, fl + 0.36, zs + 0.24, CLOTH);
      const back = new THREE.BoxGeometry(0.12, 0.62, 0.46); back.rotateZ(0.2); back.translate(xs - 0.36, fl + 0.68, zs);
      c.addGeo(back, new THREE.Matrix4(), CLOTH.slice(0, 3), 0, MATTE);
      bx(xs - 0.5, fl + 1.02, zs - 0.13, xs - 0.4, fl + 1.2, zs + 0.13, CLOTH);
    }
    bx(xf0 - 1.65, fl, -0.1, xf0 - 0.55, fl + 0.3, 0.1, TRIM);                                  // console
    bx(xf0 - 1.3, fl + 0.3, -0.03, xf0 - 1.1, fl + 0.38, 0.03, DASH.concat([0, MATTE]));          // handbrake
    if (S.L > 3.8) { bx(xb + 0.05, fl + 0.2, -hw + 0.15, xb + 0.55, fl + 0.36, hw - 0.15, CLOTH); bx(xb - 0.02, fl + 0.36, -hw + 0.15, xb + 0.1, fl + 0.95, hw - 0.15, CLOTH); }
    // the windscreen's two pillars, dash corner to roof, in trim (the body's own pillars aren't drawn from inside)
    const roofX = hl - S.roofF - S.hood * 0 , H = S.H;
    for (const sd of [-1, 1]) {
      const a = new THREE.Vector3(xf0 - 0.05, belt + 0.02, sd * (hw - 0.12)), b2 = new THREE.Vector3(Math.min(xf0 - 0.6, xf0 - (H - belt) * 0.9), H - 0.08, sd * (hw - 0.22));
      const len = a.distanceTo(b2), g = new THREE.BoxGeometry(0.06, len, 0.07);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b2.clone().sub(a).normalize()));
      g.translate((a.x + b2.x) / 2, (a.y + b2.y) / 2, (a.z + b2.z) / 2);
      c.addGeo(g, new THREE.Matrix4(), TRIM.slice(0, 3), 0, MATTE);
    }
    void roofX;
    // the rear-view mirror at the top of the windscreen
    const mx = xf0 - 0.42;
    bx(mx - 0.015, H - 0.17, -0.09, mx + 0.015, H - 0.12, 0.09, [0.08, 0.08, 0.085, 0, MATTE]);
    bx(mx - 0.008, H - 0.12, -0.01, mx + 0.008, H - 0.07, 0.01, [0.08, 0.08, 0.085, 0, MATTE]);
    // the centre stack: vents, a screen, the AC knobs; the glovebox line on the passenger side
    bx(xf0 - 0.62, belt - 0.32, -0.16, xf0 - 0.5, belt - 0.02, 0.16, DASH.concat([0, MATTE]));
    for (const zz of [-0.1, 0.1]) bx(xf0 - 0.635, belt - 0.1, zz - 0.045, xf0 - 0.62, belt - 0.05, zz + 0.045, [0.04, 0.04, 0.045, 0, MATTE]);
    for (const zz of [-0.06, 0, 0.06]) bx(xf0 - 0.64, belt - 0.29, zz - 0.018, xf0 - 0.615, belt - 0.255, zz + 0.018, METAL.concat([0, 0.4]));
    bx(xf0 - 0.5, belt - 0.2, -hw + 0.25, xf0 - 0.48, belt - 0.19, -0.25, [0.1, 0.095, 0.09, 0, MATTE]);
    group.add(new THREE.Mesh(c.build(), mats.solid));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.14), new THREE.MeshBasicMaterial({ color: 0x2a4a6e, toneMapped: false }));
    scr.position.set(xf0 - 0.64, belt - 0.17, 0); scr.rotation.y = -Math.PI / 2; group.add(scr);
  }
  return {
    group, eye: [xf0 - 1.2, belt + 0.23, DRIVER_Z],
    update(steer, kmh, gear, rpm, night) {
      spin.rotation.z = steer * 7.5;          // ~15:1 rack: the wheel turns much further than the tyres
      draw(kmh, gear, rpm, night);
    },
  };
}
