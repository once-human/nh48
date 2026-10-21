// World assembly: map services (road graph, surfaces, collision), PBR materials, sign atlases,
// global instanced props, and the chunk streamer that builds the city around the camera.
import * as THREE from 'three';
import { makeDecalTexture } from '../gfx/textures.js';
import { makeSignAtlas, ensureFonts } from '../gfx/signs.js';
import { Boards, NearBoards, ensureBoardFonts } from '../gfx/boards.js';
import { Flyovers } from './flyover.js';
import { Activity } from './activity.js';
import { propMaterial, waterMaterial, U } from '../gfx/materials.js';
import { groundMaterial, facadeMaterial, roofMaterial } from '../gfx/pbr.js';
import { Graph, Surfaces, Collision } from './mapdata.js';
import { WorldIndex, Streamer } from './index.js';
import { buildGroundChunk, prepareGroundGlobals } from './groundChunk.js';
import { buildBuildingsChunk } from './buildingsChunk.js';
import { buildGlobalProps, buildPropsChunk } from './propsChunk.js';
import { cmRing } from './geo.js';
import { buildFarCity } from './farCity.js';
import { TreeField } from './trees.js';
import { GrassField } from './grass.js';

export async function buildWorld(M, T, renderer, scene, quality, progress) {
  const W = { M, scene, renderer, quality, T };
  W.index = new WorldIndex(M);
  W.graph = new Graph(M);
  W.graph.buildGrid(40);
  W.surf = new Surfaces(M);
  W.collision = new Collision(8);
  W.footprintsByChunk = new Map();
  const play = M.meta.play.map(v => v / 100);
  W.play = { x0: play[0], z0: play[1], x1: play[2], z1: play[3] };
  // junction lookup for kerb paint, stalls etc.
  const jgrid = new Map();
  for (const n of W.graph.nodes) {
    if (n.deg < 3 || n.maxRank < 3) continue;
    const key = Math.floor(n.x / 50) + ',' + Math.floor(n.z / 50);
    if (!jgrid.has(key)) jgrid.set(key, []);
    jgrid.get(key).push(n);
  }
  W.junctionNear = (x, z, extra) => {
    const i = Math.floor(x / 50), j = Math.floor(z / 50);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) {
      const l = jgrid.get(a + ',' + b);
      if (l) for (const n of l) if (Math.hypot(n.x - x, n.z - z) < n.jr + extra) return true;
    }
    return false;
  };
  await progress('Painting the city', 0.05);
  const decal = makeDecalTexture();
  W.tex = { decal: decal.tex };
  W.decalUV = decal.uv;
  await ensureFonts();
  await ensureBoardFonts();
  W.signs = makeSignAtlas(quality.signScale);
  W.boards = new Boards(quality);
  W.mats = {
    ground: groundMaterial(T),
    facade: facadeMaterial(T),
    roof: roofMaterial(T),
    prop: propMaterial(),
    propDS: propMaterial({ side: THREE.DoubleSide }),
    water: waterMaterial(),
    decal: new THREE.MeshStandardMaterial({ map: W.tex.decal, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }),
    sign: new THREE.MeshStandardMaterial({ map: W.boards.tex, emissiveMap: W.boards.tex, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    oldSign: new THREE.MeshStandardMaterial({ map: W.signs.tex, emissiveMap: W.signs.tex, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  };
  W.signMats = new Set();           // per-chunk board materials (follow the night glow too)
  W.nearBoards = new NearBoards(renderer, scene, W.mats.sign, W.index ? W.index.shopNames : (M.shopNames || []));
  W.signMats.add(W.nearBoards.mat);
  W.fly = new Flyovers(W, scene);
  W.activity = new Activity(W.M);
  await progress('Laying out the roads', 0.2);
  prepareGroundGlobals(W);
  // static collision for the whole map (cheap 2D grid)
  for (const B of M.buildings) W.collision.addRing(cmRing(B[1]), 0);
  for (const [, line] of M.banks) W.collision.addLine(cmRing(line), 4);
  for (const [, line] of M.rails) W.collision.addLine(cmRing(line), 4);
  const pl = W.play;
  W.collision.addSeg(pl.x0, pl.z0, pl.x1, pl.z0, 3); W.collision.addSeg(pl.x1, pl.z0, pl.x1, pl.z1, 3);
  W.collision.addSeg(pl.x1, pl.z1, pl.x0, pl.z1, 3); W.collision.addSeg(pl.x0, pl.z1, pl.x0, pl.z0, 3);
  await progress('Growing the trees', 0.3);
  W.trees = new TreeField(W, scene, renderer, quality, { bark: T.bark, barkN: T.barkN, palm: T.palm, leaves: T.leaves });
  W.grass = new GrassField(W, scene, quality);
  buildGlobalProps(W);
  await progress('Raising the skyline', 0.4);
  buildFarCity(W);
  W.streamer = new Streamer(W, scene, [buildGroundChunk, buildBuildingsChunk, buildPropsChunk],
    { radius: quality.streamRadius, budgetMs: quality.streamBudget });
  return W;
}

export function updateWorldMaterials(W) {
  const n = U.uNight.value;
  W.mats.sign.emissiveIntensity = 0.05 + n * 0.9;
  for (const m of W.signMats) m.emissiveIntensity = W.mats.sign.emissiveIntensity;
  W.mats.oldSign.emissiveIntensity = 0.05 + n * 0.8;
}
