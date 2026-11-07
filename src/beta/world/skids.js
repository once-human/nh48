// Black lines on the road where the tyres locked or slid: one strip behind each wheel that's sliding, each piece fading
// away over a minute. A ring of pieces drawn together; the oldest goes first.
import * as THREE from 'three';

const MAX = 1600;
const VS = 'attribute float aB; attribute float aL; uniform float uNow; varying float vA; void main(){ vA = aL*clamp(1. - (uNow - aB)/60., 0., 1.); gl_Position = projectionMatrix*viewMatrix*vec4(position, 1.); }';
const FS = 'varying float vA; void main(){ if (vA < .01) discard; gl_FragColor = vec4(.012, .012, .014, vA*.72); }';
let mesh = null, pos, born, lev, head = 0, now = 0;
function make(scene) {
  pos = new Float32Array(MAX*12); born = new Float32Array(MAX*4).fill(-1e6); lev = new Float32Array(MAX*4);
  const g = new THREE.BufferGeometry(), idx = new Uint32Array(MAX*6);
  for (let i = 0; i < MAX; i++) { const a = i*4; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i*6); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aB', new THREE.BufferAttribute(born, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aL', new THREE.BufferAttribute(lev, 1).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  // (the alpha of the picture says how much a surface mirrors: rubber laid on the road leaves that alone)
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uNow: { value: 0 } }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 1; scene.add(mesh);
}
// lay what this vehicle's sliding tyres have left since last time (level 0..1: how black)
export function skidAt(v, level, dt) {
  const G = window.__nhAskG; if (!G || !G.scene) return;
  now += dt; if (mesh) mesh.material.uniforms.uNow.value = now;
  if (level < 0.05 || v.air) { v._skidP = null; return; }
  if (!mesh) make(G.scene);
  const S = v.spec, c = Math.cos(v.th), s = Math.sin(v.th), hw = S.two ? 0 : S.W*0.41, half = S.wb/2, wd = S.two ? 0.05 : 0.095;
  // a two-wheeler's back tyre, a car's four when locked (back two in a slide), an auto's three
  const lock = (v._lockT || 0) > 0.2, P = S.two ? [[-half, 0]] : lock ? [[half, hw], [half, -hw], [-half, hw], [-half, -hw]] : [[-half, hw], [-half, -hw]];
  const prev = v._skidP, cur = [], H = (x, z) => v.heightAt(x, z) + 0.018;
  P.forEach(([u, q], i) => {
    const x = v.x + c*u - s*q, z = v.z + s*u + c*q, y = H(x, z); cur.push([x, z, y]);
    const p = prev && prev.length === P.length && prev[i]; if (!p) return;
    const dx = x - p[0], dz = z - p[1], d = Math.hypot(dx, dz); if (d < 0.02 || d > 8) return;
    const nx = -dz/d*wd, nz = dx/d*wd, k = head*12;
    pos.set([p[0] + nx, p[2], p[1] + nz, p[0] - nx, p[2], p[1] - nz, x + nx, y, z + nz, x - nx, y, z - nz], k);
    born.fill(now, head*4, head*4 + 4); lev.fill(level, head*4, head*4 + 4);
    head = (head + 1) % MAX;
  });
  v._skidP = cur;
  const A = mesh.geometry.attributes; A.position.needsUpdate = A.aB.needsUpdate = A.aL.needsUpdate = true;
}
