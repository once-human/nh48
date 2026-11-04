// gfx/pbr.js for world.js in /beta: the ground, wall and roof materials the old builders still use (props, hills,
// compound walls, landmarks) are painted (gfx/paint.js reads their layers, tints and styles); everything else as it is.
export * from '@orig/gfx/pbr.js';
import { paint } from './paint.js';

export function groundMaterial() { return paint.ground(); }
export function facadeMaterial() { return paint.facade(); }
export function roofMaterial() { return paint.roof(); }
