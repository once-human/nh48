// /beta's people and vehicles: the stress test's bodies, GPU-animated and instanced (a few draws for all of them), placed
// each frame from where the game's logic says everyone is. The game's own bodies are never shown; it can't tell.
import * as THREE from 'three';
import { paintMaterial, paintNoise, U } from '@orig/experiment/paint.js';
import { Crowd, NEAR, makeLook, B } from '@orig/experiment/people.js';
import { Traffic } from '@orig/experiment/traffic.js';
import { hex, rng } from '@orig/experiment/geo.js';
import { PU } from '../gfx/paint.js';

// the stress test paints in screen colour; /beta's picture is linear until its last pass
const linear = (m) => { for (const s of [m]) s.fragmentShader = s.fragmentShader.replace('fragColor = vec4(c, 1.);', 'fragColor = vec4(pow(max(c, vec3(0.)), vec3(2.2)), 1.);').replace('fragColor = vec4(mix(c, fogCol, smoothstep(fogR.x, fogR.y, vZ)*.9), 1.);', 'fragColor = vec4(pow(max(mix(c, fogCol, smoothstep(fogR.x, fogR.y, vZ)*.9), vec3(0.)), vec3(2.2)), 1.);'); return m; };
const CAP = 500, SHIRT = [0x2f5fd0, 0xf08a24, 0xf2c230, 0xd83a2a, 0x2f8a5a, 0xeee8dc, 0x262626, 0x2a8a8a], FRAME = [0x1c1c1e, 0xb8302a, 0x2f5fd0, 0x6a6a6e, 0xeeeeea], CAR = [0xeeeeea, 0xb8bcc0, 0xc0302a, 0x2f5fd0, 0x3a3a3e, 0x1c1c1e, 0x7a2a30], BUS = [0xc8522a, 0xeeeeea];
const kindOf = (v) => ((v.spec && v.spec.two) || (v.T && v.T.two) ? 'bike' : /bus|coach/.test(v.type || '') ? 'bus' : /auto|rick/.test(v.type || '') ? 'auto' : 'car');

export class Actors {
  constructor(G, scene) {
    this.G = G;
    U.tNoise.value = paintNoise();
    const pm = linear(paintMaterial({ people: true })), vm = linear(paintMaterial({ vehicle: true }));
    this.crowd = new Crowd(CAP, pm); U.crowdTex.value = this.crowd.tex;
    const R = rng(21); for (let i = 1; i < CAP; i++) this.crowd.look(i, makeLook(R));
    this.crowd.look(0, { shirt: 0xeeeeea, lower: 0x161a2a, skin: 0xa06a48, hair: 0x1a1512, acc: 0xeeeeea, acc2: 0xeeeeea, mask: B.CURLY, h: 1, girth: .55 });
    this.crowd.tex.needsUpdate = true; this.crowd.n = CAP;
    this.traffic = new Traffic(240, vm);
    this.all = [...this.crowd.meshes, ...Object.values(this.traffic.meshes)];
    for (const m of this.all) { m.renderOrder = -1; scene.add(m); }
    this.next = 1; this.t = 0; this.hidOld = false;
  }
  hideOld() {
    const G = this.G, Pp = G.people;
    if (!this.hidOld && Pp) { for (const k of ['mMale', 'mFemale', 'mLeg', 'mArm', 'mUmb']) if (Pp[k]) Pp[k].visible = false; this.hidOld = true; }
    if (!this.hidCars && G.traffic) { const seen = new Set(), walk = (o, d) => { if (!o || typeof o !== 'object' || seen.has(o) || d > 3) return; seen.add(o); if (o.isInstancedMesh) { o.visible = false; return; } if (o.isObject3D || o === G.W) return; for (const v of (o instanceof Map ? o.values() : Object.values(o))) walk(v, d + 1); }; for (const k of Object.keys(G.traffic)) if (k !== 'W' && k !== 'graph' && k !== 'list') walk(G.traffic[k], 0); this.hidCars = true; }
    if (G.crowd && G.crowd.pool) for (const s of G.crowd.pool) { const h = s.H && s.H.holder; if (h && h.parent) h.parent.remove(h); }
  }
  update(dt, camera) {
    const G = this.G, P = G.player; this.t += dt; if (!P) return;
    const on = !(G.interiors && G.interiors.inside);
    for (const m of this.all) m.visible = on;
    // what the stress test's paint reads, from the sky of the moment
    U.time.value = this.t; U.sunDir.value.copy(PU.sunDir.value); if (PU.shadowTex.value) U.shadowTex.value = PU.shadowTex.value; U.shadowMat.value.copy(PU.shadowMat.value); U.shadowTexel.value = PU.shadowTexel.value; if (PU.shadowOn) U.shadowOn.value = PU.shadowOn.value;
    const s = PU.sunCol.value, f = PU.fogCol.value; U.sunCol.value.set(Math.pow(s.x ?? s.r, .45), Math.pow(s.y ?? s.g, .45), Math.pow(s.z ?? s.b, .45)); U.fogCol.value.set(Math.pow(f.r, .45), Math.pow(f.g, .45), Math.pow(f.b, .45)); U.fogR.value.set(90, 700);
    this.hideOld();
    if (!on) { if (P.human) P.human.holder.visible = !P.hideBody; return; }
    const C = this.crowd, nA = C.near.geometry.attributes, fA = C.far.geometry.attributes, cx = camera.position.x, cz = camera.position.z;
    let a = 0, b = 0;
    const put = (x, y, z, yaw, ph, amp, id) => { const dx = x - cx, dz = z - cz, d2 = dx*dx + dz*dz; if (d2 > 90000) return;
      const near = d2 < NEAR*NEAR, A = near ? nA : fA, o = near ? a++ : b++; if (o >= CAP) return;
      A.iPos.array.set([x, y, z, Math.PI/2 - yaw], o*4); A.iAnim.array.set([ph, amp, id, 0], o*4); };
    for (const p of (G.people ? G.people.list : [])) {
      if (p.hidden || p.pax) continue;
      if (!p._dk) { p._dk = this.next; this.next = this.next%(CAP - 1) + 1; p._dph = Math.random()*9; }
      const v = Math.abs(p.v || 0); p._dph += dt*v/.68*Math.PI;
      put(p.x, p.y || 0, p.z, p.yaw || 0, p._dph, Math.min(1, v/1.2), p._dk);
    }
    if (P.onFoot && !P.hideBody) { if (P.human) P.human.holder.visible = false; const v = Math.abs(P.foot.v || 0); this._ph = (this._ph || 0) + dt*v/.68*Math.PI; put(P.foot.x, P.foot.y || 0, P.foot.z, P.foot.yaw, this._ph, Math.min(1, v/1.2), 0); }
    C.near.geometry.instanceCount = a; C.far.geometry.instanceCount = b; nA.iPos.needsUpdate = nA.iAnim.needsUpdate = fA.iPos.needsUpdate = fA.iAnim.needsUpdate = true;
    // vehicles
    const idx = { bike: 0, auto: 0, car: 0, bus: 0 }, T = this.traffic.meshes;
    const vput = (v, me) => { const k = kindOf(v), m = T[k]; if (idx[k] >= m.cap) return; const j = idx[k]++, A = m.geometry.attributes;
      if (v._ds === undefined) v._ds = Math.floor(Math.random()*1e6);
      const h = v._ds, c0 = me ? 0xeeeeea : k === 'auto' ? 0xf2c230 : k === 'car' ? CAR[h%CAR.length] : k === 'bus' ? BUS[h%2] : SHIRT[h%SHIRT.length], c1 = k === 'auto' ? 0x1e1e1e : k === 'bus' ? 0xf0e6cc : k === 'bike' ? FRAME[h%FRAME.length] : 0;
      A.iPos.array.set([v.x, v.y || 0, v.z, Math.PI/2 - (v.th ?? v.yaw ?? 0)], j*4); A.iCol0.array.set(hex(c0), j*3); A.iCol1.array.set(hex(c1), j*3); A.iMask.array[j] = k === 'bike' ? 1 | (h%2 ? 2 : 0) : 0; };
    for (const v of (G.traffic ? G.traffic.list : [])) { if (v.root) v.root.visible = false; if (Number.isFinite(v.x)) vput(v, false); }
    if (!P.onFoot && P.cur) { if (!P.cockpitOn) { P.cur.root.visible = false; if (P.human) P.human.holder.visible = false; vput(P.cur, true); } }
    for (const k in T) { const A = T[k].geometry.attributes; T[k].geometry.instanceCount = idx[k]; A.iPos.needsUpdate = A.iCol0.needsUpdate = A.iCol1.needsUpdate = A.iMask.needsUpdate = true; }
  }
}
