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
  return {
    group, eye: [xf0 - 1.2, belt + 0.23, DRIVER_Z],
    update(steer, kmh, gear, rpm, night) {
      spin.rotation.z = steer * 7.5;          // ~15:1 rack: the wheel turns much further than the tyres
      draw(kmh, gear, rpm, night);
    },
  };
}
