// /beta's people: close by, the real rigs (draw/skin.js); further off, the stress test's GPU-animated bodies, placed
// each frame from where the game's logic says everyone is. The game's own far figures are never shown.
import * as THREE from 'three';
import { paintMaterial, paintNoise, U } from '@orig/experiment/paint.js';
import { Crowd, NEAR, makeLook, B } from '@orig/experiment/people.js';
import { rng } from '@orig/experiment/geo.js';
import { PU, LAMP } from '../gfx/paint.js';
import { Skin } from './skin.js';

// the stress test paints in screen colour; /beta's picture is linear until its last pass
const linear = (m) => { for (const s of [m]) s.fragmentShader = s.fragmentShader.replace('fragColor = vec4(c, 1.);', 'fragColor = vec4(pow(max(c, vec3(0.)), vec3(2.2)), 1.);').replace('fragColor = vec4(mix(c, fogCol, smoothstep(fogR.x, fogR.y, vZ)*.9), 1.);', 'fragColor = vec4(pow(max(mix(c, fogCol, smoothstep(fogR.x, fogR.y, vZ)*.9), vec3(0.)), vec3(2.2)), 1.);'); return m; };
// and it reads the same sun, shade, lamps and sun curve as everything else, so it goes dark at night and lights up under a lamp
const lit = (m) => {
  const fs = m.fragmentShader.replace('out vec4 fragColor;', `uniform float dayK;\n${LAMP}\nout vec4 fragColor;`).replace('float L = lit*sh;', 'float L = lit*sh*dayK;').replace('+ vec3(.025, .03, .045);', '+ vec3(.025, .03, .045)*dayK;').replace('vec3 cl = base*sunCol;', 'vec3 cl = sunRoll(base*sunCol);').replace('if (k == 13) c = mix(c, base*1.05, .7);', 'c += base*lampAt(w, n);\n  if (k == 13) c = mix(c, base*1.05, .7);');
  if (!fs.includes('lampAt(w, n)') || !fs.includes('sunRoll(base') || !fs.includes('lit*sh*dayK')) throw new Error('far crowd: the light lines have moved');
  m.fragmentShader = fs; for (const k of ['tLamp', 'lampC', 'headP', 'headD', 'headS', 'lampY', 'dayK', 'shadeCol', 'sunCol']) m.uniforms[k] = PU[k];
  return m;
};
// the simple figure's half of the hand-over to a full body (draw/skin.js): it keeps the pixels the body doesn't have yet
const handover = (m) => {
  const vs = m.vertexShader.replace('out vec3 vW; out vec3 vN; out vec3 vC; flat out float vK; out float vZ;', 'out vec3 vW; out vec3 vN; out vec3 vC; flat out float vK; out float vZ;\n#ifdef PEOPLE\nflat out float vFd;\n#endif')
    .replace('  vec3 p = position, n = normal, c = color;\n#ifdef PEOPLE', '  vec3 p = position, n = normal, c = color;\n#ifdef PEOPLE\n  vFd = iAnim.w;');
  const i = m.fragmentShader.indexOf('out vec4 fragColor;'), j = m.fragmentShader.indexOf('void main(){', i);
  if (vs === m.vertexShader || !vs.includes('vFd = iAnim.w;') || i < 0 || j < 0) throw new Error('far crowd: the hand-over lines have moved');
  const f = m.fragmentShader;
  m.fragmentShader = f.slice(0, i) + '#ifdef PEOPLE\nflat in float vFd;\nfloat ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(.06711056, .00583715)))); }\n#endif\n' + f.slice(i, j + 12) +
    '\n#ifdef PEOPLE\n  if (vFd > 0. && ign(gl_FragCoord.xy) < vFd) discard;\n#endif\n' + f.slice(j + 12);
  m.vertexShader = vs;
  return m;
};
const CAP = 500;
// the simple figure dressed as the person really is (what the full body wears: beta/draw/wardrobe.js dress), so nobody
// changes clothes, or from a man to a woman, as they come closer
const hexOf = (c, d) => c && c.getHex ? c.getHex() : (typeof c === 'number' ? c : d);
function lookOf(L) {
  const cut = L.cut || { w: 0, y: 1 }, saree = cut.w > 1.5 && cut.w < 2.5, kurta = !saree && cut.y < .9;
  let mask = 0;
  if (L.female) mask |= saree ? B.SAREE | B.BUN : kurta ? B.KURTA | B.LONG : B.LONG;
  else if (kurta) mask |= B.KURTA;
  if (L.acc === 'helmet') mask |= B.HELMET; else if (L.acc === 'cap_police') mask |= B.CAP;
  if (L.beard) mask |= B.BEARD;
  const top = hexOf(L.top, 0xdddddd), acc = L.acc === 'helmet' ? hexOf(L.helmetCol, 0x222222) : top;
  return { shirt: top, lower: hexOf(L.bottom, 0x2a2a30), skin: hexOf(L.skin, 0xa06a48), hair: hexOf(L.hair, 0x15100c), acc, acc2: acc, mask, h: Math.max(.62, Math.min(1.18, L.scale || 1)), girth: .5 };
}

export class Actors {
  constructor(G, scene) {
    this.G = G;
    U.tNoise.value = paintNoise();
    const pm = handover(lit(linear(paintMaterial({ people: true }))));
    this.crowd = new Crowd(CAP, pm); U.crowdTex.value = this.crowd.tex;
    const R = rng(21); for (let i = 1; i < CAP; i++) this.crowd.look(i, makeLook(R));
    this.crowd.look(0, { shirt: 0xeeeeea, lower: 0x161a2a, skin: 0xa06a48, hair: 0x1a1512, acc: 0xeeeeea, acc2: 0xeeeeea, mask: B.CURLY, h: 1, girth: .55 });
    this.crowd.tex.needsUpdate = true; this.crowd.n = CAP;
    this.all = [...this.crowd.meshes];
    const cast = new THREE.RawShaderMaterial({ vertexShader: pm.vertexShader, fragmentShader: 'precision highp float; out vec4 o; void main(){ o = vec4(0.); }', uniforms: pm.uniforms, defines: pm.defines, glslVersion: pm.glslVersion, side: THREE.DoubleSide, colorWrite: false });
    for (const m of this.all) { m.renderOrder = -1; m.castShadow = true; m.customDepthMaterial = cast; scene.add(m); }
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
    const f = PU.fogCol.value; U.fogCol.value.set(Math.pow(f.r, .45), Math.pow(f.g, .45), Math.pow(f.b, .45)); U.fogR.value.set(90, 700);
    this.hideOld();
    this.skin.update(camera, P.human);
    if (!on) return;
    const C = this.crowd, nA = C.near.geometry.attributes, fA = C.far.geometry.attributes, cx = camera.position.x, cz = camera.position.z;
    let a = 0, b = 0, dirty = false; if (!C._own) C._own = [];
    const put = (x, y, z, yaw, ph, amp, id, fd = 0) => { const dx = x - cx, dz = z - cz, d2 = dx*dx + dz*dz; if (d2 > 122500) return;
      const near = d2 < NEAR*NEAR, A = near ? nA : fA, o = near ? a++ : b++; if (o >= CAP) return;
      A.iPos.array.set([x, y, z, Math.PI/2 - yaw], o*4); A.iAnim.array.set([ph, amp, id, fd], o*4); };
    for (const p of (G.people ? G.people.list : [])) {
      if (p.hidden || p.pax) continue;
      // (who has a real body close by is drawn by the skin; while it's coming in or going, this figure has the rest.
      // But only if the skin really drew it this frame: the crowd hands out up to 150 bodies and the skin draws as many
      // as the graphics setting allows, nearest first, so the ones past that had a body nobody drew and no figure
      // either, and went missing in the street while Munja still showed them there)
      if (p.body && p.body.H && (p.body.H._drawnT === this.skin.drawnAt || p.fallen > 0 || p.corpse)) continue;
      // (someone lying down has a real body out to 100 m, crowd.js: past that, nobody's drawn standing up in their place)
      if (p.fallen > 0 || p.corpse) continue;
      if (!p._dk) { p._dk = this.next; this.next = this.next%(CAP - 1) + 1; p._dph = Math.random()*9; p._lx = p.x; p._lz = p.z; p._dv = 0; }
      if (p._dkL !== p.look || C._own[p._dk] !== p) { p._dkL = p.look; C._own[p._dk] = p; if (p.look) { C.look(p._dk, lookOf(p.look)); dirty = true; } }
      // the legs go with how far they really moved this frame (not the speed they mean to walk at), so nobody glides:
      // a step is about 0.68 m, half a cycle
      // far off the game moves people a few times a second, in steps: drawn, they glide after where they are (a real
      // jump, more than 3 m, is taken at once), and they face the way they're really going, so nobody walks backwards
      if (p._sx === undefined || Math.hypot(p.x - p._sx, p.z - p._sz) > 3) { p._sx = p.x; p._sz = p.z; p._sy = p.yaw || 0; }
      const fk = Math.min(1, dt*9), ox = p._sx, oz = p._sz; p._sx += (p.x - p._sx)*fk; p._sz += (p.z - p._sz)*fk;
      const m = Math.hypot(p._sx - ox, p._sz - oz);
      if (dt > 0) { p._dv += (m/dt - p._dv)*Math.min(1, dt*6); p._dph += m/.68*Math.PI; }
      const want = p._dv > 0.3 && m > 1e-4 ? Math.atan2(p._sz - oz, p._sx - ox) : (p.yaw || 0);
      let dy = want - p._sy; dy -= Math.round(dy/(Math.PI*2))*Math.PI*2; p._sy += dy*Math.min(1, dt*7);
      put(p._sx, p.y || 0, p._sz, p._sy, p._dph, Math.min(1, p._dv/1.1), p._dk, 0);
    }
    if (dirty) C.tex.needsUpdate = true;
    C.near.geometry.instanceCount = a; C.far.geometry.instanceCount = b; nA.iPos.needsUpdate = nA.iAnim.needsUpdate = fA.iPos.needsUpdate = fA.iAnim.needsUpdate = true;
  }
}
