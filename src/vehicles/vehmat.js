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
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (vGlow < -0.5) roughnessFactor = 0.93;')     // glow -1 marks matte parts: tyres, canvas, plastic
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * max(vGlow, 0.0) * (0.25 + uNight * 3.0);');
  };
  const k = mat.customProgramCacheKey;
  mat.customProgramCacheKey = () => (k ? k.call(mat) : '') + '-glow-' + key;
  return mat;
}

export function vehicleMaterials() {
  const body = glowable(paintable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.1, envMapIntensity: 0.8 }), 'veh'), 'veh');
  const solid = glowable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.45 }), 'solid');
  const glass = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 });
  // the instanced traffic and parked cars get their own glass: one material on both instanced and single meshes
  // makes the renderer swap shaders back and forth on every draw
  return { body, solid, glass, glassI: glass.clone() };
}
