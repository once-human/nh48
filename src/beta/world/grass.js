// /beta draws no tufts of the game's grass: the game's field is made (its logic stays) and never shown.
import { GrassField as GameGrass } from '@orig/world/grass.js';
export class GrassField extends GameGrass {
  constructor(W, scene, quality) { const n0 = scene.children.length; super(W, scene, quality); for (let i = n0; i < scene.children.length; i++) scene.children[i].visible = false; }
  update() {}
}
