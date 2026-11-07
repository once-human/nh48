import { StaticDrawUsage } from 'three';
// What the camera can see from above, for anything drawn as a list of instances: three can't leave out one instance
// of many, so whatever was on the list was drawn, all round you. A thing near you stays in whichever way you're looking
// (its shadow can still fall in front of you); past that it has to be inside the view, with room to spare for its own
// size and for the view swinging round before the lists are next filled.
export const view = {
  on: false, vx: 0, vz: 0, c: -2, x: 0, z: 0, swung: 0,
  set(cam) {
    const e = cam.matrixWorld.elements, h = Math.hypot(e[8], e[10]), wasX = this.vx, wasZ = this.vz;
    this.x = e[12]; this.z = e[14];
    // (looking steeply down or up, the sides of the view open right out: everything stays)
    this.on = h > .6 && e[9] > -.6;
    if (!this.on) return;
    this.vx = -e[8]/h; this.vz = -e[10]/h;
    const half = Math.atan(Math.tan(cam.fov*Math.PI/360)*cam.aspect)/h + .3;
    this.c = half >= Math.PI ? -2 : Math.cos(half);
    this.swung = Math.max(this.swung, 1 - (this.vx*wasX + this.vz*wasZ));
  },
  sees(x, z, near = 35, size = 22) {
    if (!this.on) return true;
    const dx = x - this.x, dz = z - this.z, d = Math.hypot(dx, dz);
    return d < near || (dx*this.vx + dz*this.vz)/d >= this.c - size/d;
  },
};
// only the part of a list that's in use goes to the graphics card (each whole list, every time, was most of the uploads)
export function ranged(a, n) { a.clearUpdateRanges(); a.addUpdateRange(0, n*a.itemSize); a.needsUpdate = true; }
// the graphics card has it now: a street's geometry doesn't need a second copy in JS, all it did was fill the heap
// (not what still changes: a board's light (aGlow) goes up again when its shutter moves. A lost context reloads the page)
const drop = function () { this.array = new this.array.constructor(0); };
export function letGo(g) {
  if (g.userData.shared) return;
  for (const k in g.attributes) { const a = g.attributes[k]; if (k !== 'aGlow' && a.isBufferAttribute && a.usage === StaticDrawUsage) a.onUpload(drop); }
  if (g.index) g.index.onUpload(drop);
}
