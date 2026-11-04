// /beta's people: close by, the real rigs (draw/skin.js); further off, the stress test's GPU-animated bodies, placed
// each frame from where the game's logic says everyone is. The game's own far figures are never shown.
import * as THREE from 'three';
import { paintMaterial, paintNoise, U } from '@orig/experiment/paint.js';
import { Crowd, NEAR, makeLook, B } from '@orig/experiment/people.js';
import { rng } from '@orig/experiment/geo.js';
import { PU } from '../gfx/paint.js';
import { Skin } from './skin.js';

// the stress test paints in screen colour; /beta's picture is linear until its last pass
const linear = (m) => { for (const s of [m]) s.fragmentShader = s.fragmentShader.replace('fragColor = vec4(c, 1.);', 'fragColor = vec4(pow(max(c, vec3(0.)), vec3(2.2)), 1.);').replace('fragColor = vec4(mix(c, fogCol, smoothstep(fogR.x, fogR.y, vZ)*.9), 1.);', 'fragColor = vec4(pow(max(mix(c, fogCol, smoothstep(fogR.x, fogR.y, vZ)*.9), vec3(0.)), vec3(2.2)), 1.);'); return m; };
const CAP = 500;

export class Actors {
  constructor(G, scene) {
    this.G = G;
    U.tNoise.value = paintNoise();
    const pm = linear(paintMaterial({ people: true }));
    this.crowd = new Crowd(CAP, pm); U.crowdTex.value = this.crowd.tex;
    const R = rng(21); for (let i = 1; i < CAP; i++) this.crowd.look(i, makeLook(R));
    this.crowd.look(0, { shirt: 0xeeeeea, lower: 0x161a2a, skin: 0xa06a48, hair: 0x1a1512, acc: 0xeeeeea, acc2: 0xeeeeea, mask: B.CURLY, h: 1, girth: .55 });
    this.crowd.tex.needsUpdate = true; this.crowd.n = CAP;
    this.all = [...this.crowd.meshes];
    for (const m of this.all) { m.renderOrder = -1; scene.add(m); }
    this.next = 1; this.t = 0; this.hidOld = false;
    this.skin = new Skin(G.W.kit, scene); G.skin = this.skin;
  }
  hideOld() {
    const G = this.G, Pp = G.people;
    if (!this.hidOld && Pp) { for (const k of ['mMale', 'mFemale', 'mLeg', 'mArm', 'mUmb']) if (Pp[k]) Pp[k].visible = false; this.hidOld = true; }
  }
  update(dt, camera) {
    const G = this.G, P = G.player; this.t += dt; if (!P) return;
    const on = !(G.interiors && G.interiors.inside);
    for (const m of this.all) m.visible = on;
    // what the stress test's paint reads, from the sky of the moment
    U.time.value = this.t; U.sunDir.value.copy(PU.sunDir.value); if (PU.shadowTex.value) U.shadowTex.value = PU.shadowTex.value; U.shadowMat.value.copy(PU.shadowMat.value); U.shadowTexel.value = PU.shadowTexel.value; if (PU.shadowOn) U.shadowOn.value = PU.shadowOn.value;
    const s = PU.sunCol.value, f = PU.fogCol.value; U.sunCol.value.set(Math.pow(s.x ?? s.r, .45), Math.pow(s.y ?? s.g, .45), Math.pow(s.z ?? s.b, .45)); U.fogCol.value.set(Math.pow(f.r, .45), Math.pow(f.g, .45), Math.pow(f.b, .45)); U.fogR.value.set(90, 700);
    this.hideOld();
    this.skin.update(camera, P.human);
    if (!on) return;
    const C = this.crowd, nA = C.near.geometry.attributes, fA = C.far.geometry.attributes, cx = camera.position.x, cz = camera.position.z;
    let a = 0, b = 0;
    const put = (x, y, z, yaw, ph, amp, id) => { const dx = x - cx, dz = z - cz, d2 = dx*dx + dz*dz; if (d2 > 90000) return;
      const near = d2 < NEAR*NEAR, A = near ? nA : fA, o = near ? a++ : b++; if (o >= CAP) return;
      A.iPos.array.set([x, y, z, Math.PI/2 - yaw], o*4); A.iAnim.array.set([ph, amp, id, 0], o*4); };
    for (const p of (G.people ? G.people.list : [])) {
      if (p.hidden || p.pax || p.body) continue;     // (who has a real body close by is drawn by the skin)
      if (!p._dk) { p._dk = this.next; this.next = this.next%(CAP - 1) + 1; p._dph = Math.random()*9; }
      const v = Math.abs(p.v || 0); p._dph += dt*v/.68*Math.PI;
      put(p.x, p.y || 0, p.z, p.yaw || 0, p._dph, Math.min(1, v/1.2), p._dk);
    }
    C.near.geometry.instanceCount = a; C.far.geometry.instanceCount = b; nA.iPos.needsUpdate = nA.iAnim.needsUpdate = fA.iPos.needsUpdate = fA.iAnim.needsUpdate = true;
  }
}
