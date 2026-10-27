// dev view: the six starter outfits from front, side and back, idle / walk / sit (for checking cloth fit)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HumanKit } from '../../src/people/humans.js';
import { lookOf, OUTFITS } from '../../src/people/characters.js';
const q = new URLSearchParams(location.search);
const pose = q.get('pose') || 'idle', t = +(q.get('t') || 0.4), view = q.get('view') || 'back', zoom = +(q.get('zoom') || 1);
const R = new THREE.WebGLRenderer({ antialias: true }); R.setSize(innerWidth, innerHeight); document.body.style.margin = 0; document.body.appendChild(R.domElement);
R.outputColorSpace = THREE.SRGBColorSpace;
const S = new THREE.Scene(); S.background = new THREE.Color(0x8899aa);
S.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(3, 5, 4); S.add(d);
if (q.get('shadow')) { R.shadowMap.enabled = true; d.castShadow = true; d.shadow.mapSize.set(2048, 2048); Object.assign(d.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, far: 20 }); d.position.set(1, 8, 2);
  for (const y of [0, -2.1]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), new THREE.MeshStandardMaterial({ color: 0xbbbbbb })); g.rotation.x = -Math.PI / 2; g.position.y = y + 1.0; g.receiveShadow = true; S.add(g); } }
const L = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const [gm, gf] = await Promise.all(['people_m', 'people_f'].map(n => L.loadAsync(`/assets/people/${n}.glb`)));
const kit = new HumanKit(gm, gf);
let i = 0;
const only = q.get('only'); for (const female of [false, true]) for (const o of OUTFITS[female ? 'f' : 'm']) {
  if (only && only !== (female ? 'f' : 'm') + o.id) { i++; continue; }
  const look = lookOf({ female, outfit: o.id, made: true, name: 'x' });
  const H = kit.create(look);
  const hide = (q.get('hide') || '').split(',');
  H.root.traverse(o => { if (o.isSkinnedMesh && hide.some(h => h && o.name.startsWith(h))) o.material = new THREE.MeshBasicMaterial({ visible: false }); });
  if (q.get('red')) H.root.traverse(o => { if (o.name.startsWith(q.get('red'))) o.material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); });
  H.play(pose); H.mixer.update(0); H.mixer.update(t);
  H.holder.position.set(only ? 0 : (i % 3) * 1.1 - 1.1, 0, 0); H.holder.position.y = Math.floor(i / 3) * -2.1 + 1.0;
  H.holder.rotation.y = { back: Math.PI / 2, front: -Math.PI / 2, side: 0, side2: Math.PI }[view];
  S.add(H.holder); i++;
}
const C = new THREE.PerspectiveCamera(30 / zoom, innerWidth / innerHeight, 0.1, 50); C.position.set(0, 0.4 + +(q.get('cy') || 0), 9); C.lookAt(0, 0.4 + +(q.get('cy') || 0), 0); if (q.get('el')) { C.position.y += +q.get('el'); C.lookAt(0, 0.4 + +(q.get('cy') || 0), 0); }
if (q.get('low')) { C.position.y -= 1.2; C.lookAt(0, 0.4 + +(q.get('cy') || 0), 0); }
R.render(S, C); window.__shotReady = true;
