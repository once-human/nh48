// /beta's ground chunk: its own builder (./groundChunk.js) from the game's map data: the same roads, footpaths, kerbs,
// speed breakers and potholes the cars and people feel, drawn with more to them. The footpaths' mess (world/footpath.js) is
// drawn by the painter's worker with the chunk's buildings: asked for here, first, so it's being made while the
// game's own ground and buildings are worked out.
import { buildGroundChunk as gameGround } from './groundChunk.js';
import { painter } from './buildings.js';

export { prepareGroundGlobals, addGroundTile, removeGroundTile, bumpsAt, KERB_H, WATER_Y, GB } from '@orig/world/groundChunk.js';

export function* buildGroundChunk(W, C, group) {
  painter.init(W);
  painter.early(C);
  return yield* gameGround(W, C, group);
}
