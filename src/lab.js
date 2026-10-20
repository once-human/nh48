// Tree lab (?lab=trees): every species in a row — near LOD in front, mid LOD behind, impostors at
// the back — under the real sky and post stack. Used for tuning the species by eye.
import * as THREE from 'three';
import { createTreeKit } from './world/trees.js';
import { Sky } from './gfx/sky.js';
import { Post } from './gfx/post.js';
import { U } from './gfx/materials.js';
import { RNG } from './core/util.js';

export function runTreeLab(renderer, quality, T, params) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 3000);
  const sky = new Sky(renderer, scene);
  sky.setShadows(quality.shadows, quality.shadowSize);
  sky.shadowRange = 120; sky.setShadows(quality.shadows, quality.shadowSize);
  const kit = createTreeKit(renderer, quality, { bark: T.bark, barkN: T.barkN, palm: T.palm });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x6b6450, roughness: 1 }));
  ground.rotateX(-Math.PI / 2); ground.receiveShadow = true; scene.add(ground);
  const gap = 24;
  kit.arch.forEach((A, k) => {
    const x = (k - 3.5) * gap;
    for (const [lod, z] of [['near', 0], ['mid', -45]]) {
      const b = new THREE.InstancedMesh(A[lod].b, kit.barkMats[k], 1), l = new THREE.InstancedMesh(A[lod].l, kit.leafMat, 1);
      const m = new THREE.Matrix4().makeTranslation(x, 0, z);
      b.setMatrixAt(0, m); l.setMatrixAt(0, m);
      for (const o of [b, l]) { o.castShadow = o.receiveShadow = true; scene.add(o); }
    }
  });
  const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
  const cells = new THREE.InstancedBufferAttribute(new Float32Array(8), 1);
  quad.setAttribute('aCell', cells);
  const bb = new THREE.InstancedMesh(quad, kit.bbMat, 8);
  for (let k = 0; k < 8; k++) { bb.setMatrixAt(k, new THREE.Matrix4().makeTranslation((k - 3.5) * gap, 0, -90)); cells.array[k] = k; }
  bb.frustumCulled = false;
  scene.add(bb);
  // atlas preview
  const prev = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: kit.atlas.tex, transparent: true }));
  prev.position.set(0, 12, -140); scene.add(prev);
  const prevI = new THREE.Mesh(new THREE.PlaneGeometry(64, 8), new THREE.MeshBasicMaterial({ map: kit.imp.albedo, transparent: true }));
  prevI.position.set(0, 30, -140); scene.add(prevI);
  const post = new Post(renderer, scene, camera, quality);
  const at = (params.get('at') || '0,40,9,0,-8').split(',').map(Number);
  camera.position.set(at[0], at[2], at[1]);
  camera.rotation.set(at[4] * Math.PI / 180, at[3] * Math.PI / 180, 0, 'YXZ');
  const hour = +(params.get('hour') || 10.5);
  post.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  let frames = 0;
  window.__nh = {
    setView: (x, z, y, yaw, pitch) => { camera.position.set(x, y, z); camera.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, 0, 'YXZ'); },
    setHour: (h) => sky.update(h, camera.position, 0), stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }), pending: () => 0,
  };
  const loop = () => {
    renderer.info.reset();
    U.uTime.value += 1 / 30;
    sky.update(hour, new THREE.Vector3(0, 0, 0), 1 / 30);
    post.render(1 / 30);
    if (++frames === 3) window.__shotReady = true;
    requestAnimationFrame(loop);
  };
  document.getElementById('loading').classList.add('done');
  requestAnimationFrame(loop);
}

// People lab (?lab=people[&anim=walk]): a line-up of random Pune looks, front row facing the
// camera, back row facing away — for checking clothing paint, faces, accessories, orientation.
export function runPeopleLab(renderer, quality, kit, params, animals) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 500);
  const sky = new Sky(renderer, scene);
  sky.shadowRange = 20; sky.setShadows(quality.shadows, quality.shadowSize);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 1 }));
  ground.rotateX(-Math.PI / 2); ground.receiveShadow = true; scene.add(ground);
  const rng = new RNG(+(params.get('seed') || 7));
  const anims = (params.get('anim') || 'idle,walk,talk,phone,wave,no').split(',');
  const people = [];
  const N = 8;
  for (let row = 0; row < 2; row++) for (let k = 0; k < N; k++) {
    const opts = k === 0 ? { role: 'police' } : k === 1 ? { helmet: true } : { female: k % 2 === 0 };
    const H = kit.create(kit.randomLook(rng, opts));
    const yaw = row === 0 ? Math.PI / 2 : -Math.PI / 2;     // front row faces +z (the camera)
    H.holder.position.set((k - (N - 1) / 2) * 1.1, 0, row === 0 ? 0 : -2.2);
    H.holder.rotation.set(0, -yaw, 0);
    H.play(anims[k % anims.length]);
    H.mixer.update(0.37 + k * 0.11);
    scene.add(H.holder);
    people.push(H);
  }
  // animals in front, all heading +X (the game's yaw 0), one walking and one standing of each
  if (animals) ['dog', 'cat', 'cow', 'kite'].forEach((k, i) => {
    for (let j = 0; j < 2; j++) {
      const A = animals.create(k, rng);
      if (!A) continue;
      A.holder.position.set(-4.2 + i * 2.6 + j * 1.2, k === 'kite' ? 1.2 : 0, 2.2 + j * 0.9);
      A.play(j ? 'Walk' : 'Idle'); if (k === 'kite') A.play('Fly');
      A.mixer.update(0.3);
      scene.add(A.holder);
    }
  });
  const post = new Post(renderer, scene, camera, quality);
  const at = (params.get('at') || '0,7.5,1.6,0,-4').split(',').map(Number);
  camera.position.set(at[0], at[2], at[1]);
  camera.rotation.set(at[4] * Math.PI / 180, at[3] * Math.PI / 180, 0, 'YXZ');
  post.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  let frames = 0;
  window.__nh = { setView: (x, z, y, yaw, pitch) => { camera.position.set(x, y, z); camera.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, 0, 'YXZ'); }, pending: () => 0 };
  const loop = () => {
    sky.update(+(params.get('hour') || 10.5), new THREE.Vector3(), 1 / 30);
    post.render(1 / 30);
    if (++frames === 3) window.__shotReady = true;
    requestAnimationFrame(loop);
  };
  document.getElementById('loading').classList.add('done');
  requestAnimationFrame(loop);
}
