// The powers' light on a person's own body: a second skin on the same skeleton, a few millimetres out, lit at its
// edges (where you see past them) so they glow round their outline and it moves as they move. It's strongest round
// the head and only a breath on the rest of them, and it comes up slowly and goes out at once. It belongs to
// the person, not the body the crowd happens to draw them on: when the crowd hands them another (they walked out of
// range and back), the glow goes over with them at the strength it had.
import * as THREE from 'three';

function auraMat(col) {
  const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const U = m.userData; U.uK = { value: 0 }; U.uHead = { value: new THREE.Vector3(0, -1e4, 0) }; U.uT = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uK = U.uK; sh.uniforms.uHead = U.uHead; sh.uniforms.uT = U.uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vF;\nvarying float vH;\nuniform vec3 uHead;')
      .replace('#include <project_vertex>', '#ifdef USE_SKINNING\n  transformed += normalize(objectNormal)*0.012;\n#endif\n#include <project_vertex>\n'
        + '  { vec3 nV = normalize(normalMatrix*objectNormal); vF = pow(1.0 - abs(dot(nV, normalize(-mvPosition.xyz))), 2.4);\n'
        + '    vec4 wP = modelMatrix*vec4(transformed, 1.0); vH = 1.0 - smoothstep(0.1, 0.42, distance(wP.xyz, uHead)); }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vF;\nvarying float vH;\nuniform float uK;\nuniform float uT;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n'
        + '  float br = 0.92 + 0.08*sin(uT*2.1);\n'
        + '  float body = (0.03 + 0.5*vF)*0.32, head = (0.3 + 0.7*vF)*vH;\n'
        + '  gl_FragColor = vec4(diffuse*(0.4 + 1.7*vF + 0.6*vH)*br, clamp(max(body, head)*uK, 0.0, 1.0));');
  };
  return m;
}

export function auras(G) {
  const on = new Map();          // person → { mat, H, shells, k, want, seen, xray }
  let n = 0, clock = 0;
  const hv = new THREE.Vector3();
  const bodyOf = (p) => p && (p === G.player ? p.human : p.body && p.body.H);
  function strip(A) { for (const [par, s] of A.shells) par.remove(s); A.shells = []; A.H = null; }
  function dress(A, H) {
    strip(A); if (!H || !H.root) return;
    H.root.traverse(o => {
      if (!o.isSkinnedMesh || o.userData.aura) return;
      const s = new THREE.SkinnedMesh(o.geometry, A.mat); s.userData.aura = true;
      s.bind(o.skeleton, o.bindMatrix); s.position.copy(o.position); s.quaternion.copy(o.quaternion); s.scale.copy(o.scale);
      s.frustumCulled = false; s.renderOrder = 20; s.castShadow = false; s.receiveShadow = false;
      A.shells.push([o.parent, s]);
    });
    for (const [par, s] of A.shells) par.add(s);
    A.H = H; A.head = H.root.getObjectByName('Head') || H.root.getObjectByName('head');
  }
  // light someone this frame: k from 0 to 1 (it eases there); xray: through walls
  function light(p, col, k, xray = false) {
    if (!p) return;
    let A = on.get(p);
    if (!A) { A = { mat: auraMat(col), H: null, shells: [], k: 0 }; on.set(p, A); }
    A.want = k; A.seen = n; A.mat.color.set(col); A.mat.depthTest = !xray;
    if (!xray) p._lit = performance.now();          // (a close-up glow keeps its body: people/crowd.js, patched)
  }
  function tick(dt) {
    clock += dt;
    for (const [p, A] of on) {
      if (A.seen !== n) A.want = 0;
      // it comes up as fast as the hold builds it; the moment it's let go (or you look off them) it's gone, so you
      // know it's stopped
      A.k = A.want > A.k ? A.k + (A.want - A.k)*Math.min(1, dt*4) : A.want;
      const H = bodyOf(p);
      if (H !== A.H) dress(A, H);
      const U = A.mat.userData;
      U.uK.value = A.k; U.uT.value = clock;
      if (A.head) { A.head.getWorldPosition(hv); U.uHead.value.copy(hv); }
      if (A.want === 0 && A.k < 0.01) { strip(A); A.mat.dispose(); on.delete(p); }
    }
    n++;
  }
  const level = (p) => on.get(p)?.k || 0;
  return { light, tick, level };
}
