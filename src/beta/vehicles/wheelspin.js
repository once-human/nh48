// How a wheel goes round, for cars (beta/vehicles/wheels.js) and two-wheelers (beta/vehicles/steerfront.js).
// It turns by how far the vehicle has really rolled since the last frame, along the way it points, over the wheel's
// radius: exactly the road going by, at any frame rate. (It was speed times the frame's time, cut off at a tenth of a
// second, so on a slow PC the wheels turned less than the car moved.) A slide sideways doesn't turn it, and being put
// somewhere new doesn't either.
// Fast, a wheel turns most of the way from one spoke to the next between two frames, and the eye joins up the wrong
// spokes: it stands still or creeps backwards (on film too). So past a third of a spoke a frame, close to the camera,
// it's drawn over the arc it swept as well, up to four times, as a camera's shutter smears it.
import * as THREE from 'three';

const TAU = Math.PI*2;
export function rolled(v, F) {
  const x = v.x, z = v.z;
  if (F.px === undefined) { F.px = x; F.pz = z; return 0; }
  const dx = x - F.px, dz = z - F.pz; F.px = x; F.pz = z;
  if (dx*dx + dz*dz > 400) return 0;                    // (20 m in a frame: put somewhere, not driven)
  return dx*Math.cos(v.th || 0) + dz*Math.sin(v.th || 0);
}
// a wheel on its own: its triangles of the body (geo), drawn with the body's paint, on a group that turns about the axle
export function wheelMesh(geo, body, W) {
  const mk = (g) => {
    const m = new THREE.InstancedMesh(g, body.material, 1);
    m.instanceColor = body.instanceColor; m.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-W.x, -W.y, -W.z));
    m.castShadow = body.castShadow; m.receiveShadow = body.receiveShadow; m.frustumCulled = false;
    return m;
  };
  const spin = new THREE.Group(), m = mk(geo); spin.add(m);
  return { W, spin, m, mk, ang: 0, blur: null };
}
// turn it by dAng this frame (forward is negative about z); near: close enough to the camera for the spokes to show
export function turn(w, dAng, near) {
  w.ang = (w.ang + dAng) % TAU; w.spin.rotation.z = w.ang;
  const gap = TAU/(w.W.n || 5), a = Math.abs(dAng), K = near && a > gap*0.3 ? Math.min(4, Math.ceil(a/(gap*0.3))) : 1;
  if (K > 1 && !w.blur) {
    w.blur = [];
    for (let i = 0; i < 3; i++) { const h = new THREE.Group(); h.add(w.mk(w.m.geometry)); h.visible = false; w.spin.add(h); w.blur.push(h); }
  }
  if (w.blur) for (let i = 0; i < 3; i++) {
    const h = w.blur[i], on = i + 1 < K; h.visible = on;
    if (on) { h.rotation.z = -dAng*(i + 1)/K; const c = h.children[0]; if (c.geometry !== w.m.geometry) c.geometry = w.m.geometry; }      // (back along the arc it came; a dent's copy too)
  }
}
export function dropWheel(w) { w.spin.parent && w.spin.parent.remove(w.spin); w.m.dispose(); if (w.blur) for (const h of w.blur) h.children[0].dispose(); }
const G0 = () => window.__nhAskG;
export function nearCam(v, r = 30) { const G = G0(), C = G && G.camera; if (!C) return true; const dx = C.position.x - v.x, dz = C.position.z - v.z; return dx*dx + dz*dz < r*r; }
