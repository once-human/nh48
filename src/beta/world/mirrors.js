// The mirrors in the shops are mirrors: the boutique's by the trial rooms, the barbers' and the salons', the gym's
// mirror wall. Each was a pale blue-grey panel; now it shows the room back, and you in it, live, from where you stand.
// A mirror only draws its picture while its room's open and it's in view (three's Reflector renders just before the
// glass does), at about half the screen's resolution.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Interiors } from '@orig/world/interiors.js';

const room = Interiors.prototype.room;
Interiors.prototype.room = function (dz) {
  const R = room.call(this, dz);
  if (R && R.mirrors && !R._mirrored && R.group) {
    R._mirrored = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1), base = Math.min(1024, Math.round(innerHeight*dpr*0.5));
    for (const M of R.mirrors) {
      // the texture's shape follows the glass's (a tall mirror, a long strip)
      const a = M.w/M.h, tw = Math.round(a >= 1 ? Math.min(2048, base*a) : base*a), th = a >= 1 ? base : base;
      const g = new Reflector(new THREE.PlaneGeometry(M.w, M.h), { clipBias: 0.003, textureWidth: Math.max(64, tw), textureHeight: Math.max(64, th), color: 0xc4cacc });
      g.position.set(M.x, M.y, M.z); g.rotation.y = M.ry;
      g.matrixAutoUpdate = false; g.updateMatrix();
      g.userData.mirror = true;
      R.group.add(g);
    }
  }
  return R;
};
