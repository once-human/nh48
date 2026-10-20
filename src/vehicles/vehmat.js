// Vehicle materials: glossy paint with per-instance paint channels and glowing lamps.
import * as THREE from 'three';
import { paintable, U } from '../gfx/materials.js';

function glowable(mat, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uNight = U.uNight;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow; varying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight; varying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow * (0.25 + uNight * 3.0);');
  };
  const k = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => (k ? k.call(mat) : '') + '-glow-' + key;
  return mat;
}

export function vehicleMaterials() {
  const body = glowable(paintable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.12, envMapIntensity: 0.9 }), 'veh'), 'veh');
  const solid = glowable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.9 }), 'solid');
  const glass = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 });
  return { body, solid, glass };
}
