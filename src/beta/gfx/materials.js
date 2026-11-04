// gfx/materials.js for world.js in /beta: everything as it is, except the props and the water, which are painted
// (gfx/paint.js reads the same vertex colours and glow the old builders write).
export * from '@orig/gfx/materials.js';
import { paint } from './paint.js';

export function propMaterial(opts = {}) { return paint.prop(opts); }
export function waterMaterial() { return paint.water(); }
