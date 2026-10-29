// Pedestrians and animals: people walking the footpaths (or the road edge where there is no
// footpath), crossing wherever they like, waiting passengers waving down autos, cows and dogs.
// People also pop into shops and come back out, stand around chai stalls, glare when you honk,
// get up angry when you knock them over, and crowd round (phones out) when something happens.
import * as THREE from 'three';
import { hasUmbrella, umbrellaColor, umbrellaGeo, umbrellaMat } from './umbrella.js';
import { ColorBuilder, lin } from '../world/geo.js';
import { RNG, clamp, lerp, wrapAngle } from '../core/util.js';
import STREET from '../game/street_lines.json';
import { AreaMap } from './areas.js';
import { TOUGH, HP } from './fight.js';
// who someone is decides how they talk: a Marathi kaka, a Hindi-speaking delivery bhaiya, a
// Hinglish college kid, a kaku with her vegetables, an aaji... (src/game/street_lines.json)
// how many of each depends on where you are (people/areas.js): Koregaon Park is cafés and English,
// Pune Station is everybody, the peths are kakas and aajis
const PERSONA_M = ['kaka', 'ajoba', 'dada', 'bhaiya', 'collegeboy', 'kpguy'], PERSONA_F = ['kaku', 'aaji', 'tai', 'aunty', 'collegegirl', 'kpgirl'];
const OLD = new Set(['ajoba', 'aaji']);
// what they wear follows who they are: the KP crowd and students in western clothes, aajis in sarees
const DRESS = { kpguy: 'modern', kpgirl: 'western', collegeboy: 'modern', collegegirl: 'modern', aaji: 'traditional', kaku: 'traditional', ajoba: 'traditional' };


const SKINS = [[0.78, 0.6, 0.47], [0.69, 0.5, 0.37], [0.6, 0.43, 0.31], [0.52, 0.36, 0.26], [0.45, 0.31, 0.22], [0.82, 0.66, 0.53]];
const SHIRTS = [[0.95, 0.95, 0.93], [0.42, 0.6, 0.85], [0.85, 0.3, 0.28], [0.2, 0.24, 0.36], [0.95, 0.84, 0.48], [0.3, 0.55, 0.36], [0.62, 0.22, 0.52],
  [0.95, 0.6, 0.22], [0.58, 0.58, 0.58], [0.16, 0.16, 0.18], [0.75, 0.82, 0.9], [0.9, 0.75, 0.75]];
const PANTS = [[0.15, 0.18, 0.28], [0.22, 0.2, 0.18], [0.5, 0.45, 0.38], [0.12, 0.12, 0.13], [0.35, 0.38, 0.45], [0.85, 0.82, 0.75]];
const SAREES = [[0.8, 0.1, 0.25], [0.95, 0.5, 0.05], [0.1, 0.45, 0.35], [0.5, 0.1, 0.5], [0.95, 0.8, 0.15], [0.15, 0.3, 0.7], [0.95, 0.4, 0.55], [0.6, 0.15, 0.1]];

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(1, 1, 1);
const TMP = [0, 0, 0, 0];
const BASE = new THREE.Matrix4(), MM = new THREE.Matrix4(), TA = new THREE.Matrix4(), RA = new THREE.Matrix4(), RB = new THREE.Matrix4();

function boxG(sx, sy, sz, ox = 0, oy = 0, oz = 0) { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(ox, oy, oz); return g; }
// rotated box: rotate about its own centre, then move into place
function boxR(sx, sy, sz, rx, rz, ox, oy, oz) { const g = new THREE.BoxGeometry(sx, sy, sz); g.rotateX(rx); g.rotateZ(rz); g.translate(ox, oy, oz); return g; }
const I4 = new THREE.Matrix4();

function buildParts() {
  const P = {};
  // rounded parts (no boxes): ellipsoid torsos, capsule limbs
  const ell = (rx, ry, rz, x, y, z) => new THREE.SphereGeometry(1, 12, 9).scale(rx, ry, rz).translate(x, y, z);
  const cap = (r, len, y) => new THREE.CapsuleGeometry(r, len, 2, 8).translate(0, y, 0);
  // male torso (incl. head) : hips at y=0.95, faces +x
  {
    const b = new ColorBuilder(); b.paint = [];
    b.addGeo(ell(0.12, 0.3, 0.195, 0, 1.24, 0), I4, [1, 1, 1], 0, 1);
    b.addGeo(ell(0.115, 0.1, 0.18, 0, 0.96, 0), I4, [1, 1, 1], 0, 2);          // hips in pants colour
    b.addGeo(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6).translate(0, 1.53, 0), I4, [1, 1, 1], 0, 3);
    b.addGeo(new THREE.SphereGeometry(0.11, 10, 8).scale(1, 1.15, 0.95).translate(0.01, 1.66, 0), I4, [1, 1, 1], 0, 3);
    b.addGeo(new THREE.SphereGeometry(0.115, 10, 6, 0, 6.29, 0, 1.7).scale(1, 0.9, 1).translate(-0.01, 1.7, 0), I4, [0.07, 0.06, 0.05]);
    P.male = b.build();
  }
  // female torso + saree/salwar skirt + pallu + hair bun
  {
    const b = new ColorBuilder(); b.paint = [];
    b.addGeo(ell(0.11, 0.27, 0.17, 0, 1.22, 0), I4, [1, 1, 1], 0, 1);
    b.addGeo(new THREE.CylinderGeometry(0.17, 0.27, 0.98, 14).translate(0, 0.5, 0), I4, [1, 1, 1], 0, 2);
    b.addGeo(new THREE.SphereGeometry(1, 10, 8).scale(0.12, 0.32, 0.05).rotateX(0.55).translate(0.03, 1.2, 0.0), I4, [1, 1, 1], 0, 2);   // pallu across the chest
    b.addGeo(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 6).translate(0, 1.5, 0), I4, [1, 1, 1], 0, 3);
    b.addGeo(new THREE.SphereGeometry(0.105, 10, 8).scale(1, 1.15, 0.95).translate(0.01, 1.62, 0), I4, [1, 1, 1], 0, 3);
    b.addGeo(new THREE.SphereGeometry(0.11, 10, 6, 0, 6.29, 0, 1.75).translate(-0.015, 1.66, 0), I4, [0.06, 0.05, 0.05]);
    b.addGeo(new THREE.SphereGeometry(0.07, 8, 6).translate(-0.11, 1.62, 0), I4, [0.06, 0.05, 0.05]);
    b.addGeo(new THREE.SphereGeometry(0.015, 4, 3).translate(0.11, 1.66, 0), I4, [0.8, 0.05, 0.05]);  // bindi
    P.female = b.build();
  }
  // leg (pivot at hip, hangs down -y) : pants + shoe
  {
    const b = new ColorBuilder(); b.paint = [];
    b.addGeo(cap(0.068, 0.74, -0.43), I4, [1, 1, 1], 0, 1);
    b.addGeo(ell(0.12, 0.045, 0.06, 0.05, -0.9, 0), I4, [0.12, 0.1, 0.09]);
    P.leg = b.build();
  }
  // arm (pivot at shoulder): sleeve + forearm skin + hand
  {
    const b = new ColorBuilder(); b.paint = [];
    b.addGeo(cap(0.047, 0.24, -0.15), I4, [1, 1, 1], 0, 1);
    b.addGeo(cap(0.038, 0.24, -0.43), I4, [1, 1, 1], 0, 3);
    b.addGeo(new THREE.SphereGeometry(0.045, 6, 4).translate(0, -0.6, 0), I4, [1, 1, 1], 0, 3);
    P.arm = b.build();
  }
  // cow (zebu: hump, horns) standing
  {
    const b = new ColorBuilder(); b.paint = [];
    const c = [1, 1, 1];
    b.addGeo(new THREE.SphereGeometry(1, 12, 8).scale(0.95, 0.42, 0.36).translate(0, 1.05, 0), I4, c, 0, 1);
    b.addGeo(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 1.2, 0.8).translate(0.48, 1.45, 0), I4, c, 0, 1);        // hump
    b.addGeo(boxR(0.5, 0.26, 0.2, 0, -0.5, 1.05, 1.25, 0), I4, c, 0, 1);                                      // neck
    b.addGeo(boxR(0.38, 0.2, 0.18, 0, -0.2, 1.32, 1.14, 0), I4, c, 0, 1);                                    // head
    b.addGeo(boxG(0.1, 0.1, 0.16, 1.5, 1.05, 0), I4, [0.25, 0.2, 0.18]);                                          // muzzle
    for (const s of [-1, 1]) b.addGeo(new THREE.ConeGeometry(0.035, 0.28, 5).rotateX(s * 0.7).translate(1.2, 1.36, s * 0.12), I4, [0.75, 0.7, 0.6]);
    for (const [x, z] of [[0.6, 0.18], [0.6, -0.18], [-0.65, 0.18], [-0.65, -0.18]]) b.addGeo(boxG(0.12, 0.8, 0.12, x, 0.4, z), I4, c, 0, 1);
    b.addGeo(boxR(0.05, 0.75, 0.05, 0, 0.15, -0.95, 0.8, 0), I4, [0.2, 0.18, 0.16]);
    P.cow = b.build();
  }
  // street dog (Indie) standing
  {
    const b = new ColorBuilder(); b.paint = [];
    const c = [1, 1, 1];
    b.addGeo(new THREE.SphereGeometry(1, 10, 6).scale(0.36, 0.17, 0.14).translate(0, 0.42, 0), I4, c, 0, 1);
    b.addGeo(new THREE.SphereGeometry(0.11, 8, 6).scale(1.3, 1, 0.9).translate(0.38, 0.55, 0), I4, c, 0, 1);
    b.addGeo(boxG(0.14, 0.07, 0.07, 0.52, 0.52, 0), I4, c, 0, 1);
    for (const s of [-1, 1]) b.addGeo(new THREE.ConeGeometry(0.035, 0.1, 4).translate(0.36, 0.66, s * 0.05), I4, c, 0, 1);
    for (const [x, z] of [[0.22, 0.07], [0.22, -0.07], [-0.24, 0.07], [-0.24, -0.07]]) b.addGeo(boxG(0.05, 0.36, 0.05, x, 0.18, z), I4, c, 0, 1);
    b.addGeo(boxR(0.04, 0.26, 0.04, 0, 0.9, -0.42, 0.55, 0), I4, c, 0, 1);
    P.dog = b.build();
  }
  return P;
}

const UC = new THREE.Color();
function instMesh(scene, geo, mat, cap, extra = true) {
  const g = geo.clone();
  const m = new THREE.InstancedMesh(g, mat, cap);
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
  g.setAttribute('aColB', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3));
  g.setAttribute('aColC', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3));
  m.frustumCulled = false; m.count = 0; m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}

export class People {
  constructor(W, scene, mat, quality) {
    this.W = W; this.g = W.graph; this.rng = new RNG(31337);
    this.max = quality.peds;
    this.list = []; this.animals = [];
    const P = buildParts();
    // the crowd swells to 1.6x on FC Road at 7 pm or outside the Mills' bars at 11, and thins to a
    // few people on a residential lane at 3 am (world/activity.js)
    this.act = W.activity; this.areas = new AreaMap(W.M); this.target = this.max; this.actT = 0; this.actHere = 10; this.nightHere = 0;
    const cap = this.cap = Math.ceil(this.max * 1.6) + 120;      // + traffic police and passengers
    this.mMale = instMesh(scene, P.male, mat, cap);
    this.mFemale = instMesh(scene, P.female, mat, cap);
    this.mLeg = instMesh(scene, P.leg, mat, cap * 2);
    this.mArm = instMesh(scene, P.arm, mat, cap * 2);
    this.mCow = instMesh(scene, P.cow, mat, 24);
    this.mDog = instMesh(scene, P.dog, mat, 48);
    // the far figures' umbrellas (in the rain)
    this.mUmb = new THREE.InstancedMesh(umbrellaGeo(), umbrellaMat(), cap);
    this.mUmb.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    this.mUmb.frustumCulled = false; this.mUmb.count = 0; this.mUmb.castShadow = true; scene.add(this.mUmb);
    this.rain = 0;
    this.events = [];
    this.crossers = [];
    this.kit = W.kit;
    this.stallsUsed = new Map();   // stall index → people standing there
    this.lineT = 0;                // voice cooldown
    this.say = null;               // (lineId, source), set by the game
    this.spawnAnimals();
  }
  speak(ids, src, chance = 1) {
    if (!this.say || this.lineT > 0 || this.rng.next() > chance) return;
    this.lineT = 5;
    this.say(ids[Math.floor(this.rng.next() * ids.length)], src);
  }
  // a line for this situation in this person's own voice (the speaker is always the one who talks)
  // people remember you (for as long as they're around): run into someone you hit or shoved and they react
  remember(p, what) { const m = this.mem || (this.mem = new Map()); const r = m.get(p.id) || {}; r[what] = (r[what] || 0) + 1; r.t = performance.now(); m.set(p.id, r); }
  recall(p, player) {
    const r = this.mem && this.mem.get(p.id);
    if (!r || p.corpse || p.fallen > 0 || r.met > performance.now() - 20000) return;
    if (Math.hypot(p.x - player.x, p.z - player.z) > 3.5 || !player.onFoot) return;
    r.met = performance.now();
    if (r.hit) { if ((TOUGH[p.persona] || 0.1) > 0.3 && this.rng.next() < 0.6) { this.startFight(p, player); this.speakAs('fight', p, 1, 4); } else { this.speakAs('scared', p, 1, 4) || this.speakAs('flee', p, 1, 4); this.flee(p, player.x, player.z, 24); } }
    else if (r.shoved) { p.angry = 4; p.grudge = 15; this.speakAs('shoved', p, 1, 4); }
  }
  speakAs(scenario, p, chance = 1, cool = 5) {
    if (!this.say || !p || this.lineT > 0 || this.rng.next() > chance) return false;
    let per = p.persona;
    if (!per || !STREET[per]) per = p.persona = this.pickPersona(p.female, p.x, p.z);
    // no line for this moment: stay quiet rather than say something that doesn't fit
    const arr = STREET[per][scenario] || (scenario.startsWith('carjack') ? STREET[per].carjack_two : null);
    if (!arr || !arr.length) return false;
    // a crowd round a shove or a fight on foot doesn't talk about accidents, speeding or number plates
    let ok = arr.map((_, k) => k);
    if (scenario === 'crowd' && this.crowdCtx === 'foot') ok = ok.filter(k => !/accident|fast|number|driv|ॲक्सिडेंट|गाडी|स्पीड/i.test(arr[k][1] + ' ' + arr[k][2] + ' ' + arr[k][0]));
    if (!ok.length) return false;
    // don't repeat the last line this persona said
    let i = ok[Math.floor(this.rng.next() * ok.length)];
    const key = per + scenario;
    this.lastLine = this.lastLine || {};
    if (ok.length > 1 && this.lastLine[key] === i) i = ok[(ok.indexOf(i) + 1) % ok.length];
    // the audio decides: idle chatter waits until nobody else is talking (see audio.voice)
    if (!this.say(`s_${per}_${scenario}${i}`, p)) return false;
    this.lastLine[key] = i;
    this.lineT = cool;
    p.saidT = 0;
    return true;
  }
  // more college kids round the colleges and cafes, more kakas and aajis in the peths
  pickPersona(female, x, z) {
    const list = female ? PERSONA_F : PERSONA_M, mix = this.areas.mixAt(x, z);
    const o = {}; if (this.act) this.act.at(x, z, o);
    const c = this.act && this.act.map.get(Math.floor(x / this.act.cell) + ',' + Math.floor(z / this.act.cell));
    const edu = c ? c.v[this.act.cls.indexOf('edu')] || 0 : 0, peth = c && c.peth;
    let tot = 0; const w = list.map(id => {
      let v = mix[id] || 0.5;
      // a college right here, or a night out, still brings the students; the peth lanes their elders
      if (/college/.test(id)) v *= 1 + Math.min(2, edu / 10) + (o.night || 0) * 1.5;
      if (/^kp/.test(id)) v *= 1 + (o.night || 0);
      if (peth && (id === 'kaka' || id === 'kaku' || OLD.has(id))) v *= 1.3;
      tot += v; return v;
    });
    let r = this.rng.next() * tot;
    for (let k = 0; k < list.length; k++) { r -= w[k]; if (r <= 0) return list[k]; }
    return list[0];
  }

  // ---------------------------------------------------------------- spawning
  sidewalkLat(e, side) {
    if (e.sw > 0.7) return side * (e.w / 2 + e.sw * 0.5);
    return side * (e.w / 2 - 0.35);
  }
  spawnOne(px, pz, rMin, rMax, avoidView, opts = {}) {
    // candidate streets near the player (refreshed every couple of seconds)
    if (!this._near || (this._nearT = (this._nearT || 0) - 1) <= 0 || Math.hypot(px - this._nearX, pz - this._nearZ) > 40) {
      // lanes and compound roads too (the Mills, a KP lane of cafes), but only where real places draw people
      this._near = [...this.g.gridQuery(px, pz, 160)].filter(e => e.rank >= 2 || (this.act && this.act.at(e.pts[0], e.pts[1]) > 6));
      this._nearT = 120; this._nearX = px; this._nearZ = pz;
    }
    const edges = this._near.length ? this._near : this.g.liveEdges;
    for (let t = 0; t < 30; t++) {
      const e = edges[Math.floor(this.rng.next() * edges.length)];
      if (e.rank < 2 && !this.act) continue;
      if (this.rng.next() > 0.3 + Math.max(1, e.rank) * 0.14) continue;
      const s = this.rng.range(1, Math.max(1.1, e.len - 1));
      const side = this.rng.chance(0.5) ? 1 : -1;
      this.g.at(e, s, TMP);
      const lat = this.sidewalkLat(e, side);
      const x = TMP[0] + TMP[3] * lat, z = TMP[1] - TMP[2] * lat;
      const d = Math.hypot(x - px, z - pz);
      if (d < rMin || d > rMax) continue;
      if (avoidView && avoidView(x, z)) continue;
      // more people where the real places are busy at this hour
      if (this.act && this.rng.next() > clamp(this.act.at(x, z) / (this.actHere * 1.3 + 1), 0.12, 1)) continue;
      return this.make(e, s, side, opts);
    }
    return null;
  }
  make(e, s, side, opts = {}) {
    const r = this.rng;
    const female = opts.female ?? r.chance(0.42);
    const kid = false;            // (the bodies are adult-proportioned: scaled down they looked like tiny aunties)
    const p = {
      e, s, side, dir: r.chance(0.5) ? 1 : -1, female, scale: kid ? 0.68 : r.range(0.94, 1.06),
      speed: kid ? 1.5 : r.range(1.05, 1.5), phase: r.range(0, 6.28), x: 0, z: 0, hx: 1, hz: 0, yaw: 0,
      lat: this.sidewalkLat(e, side), latT: 0, mode: opts.mode || 'walk', t: 0, wait: 0, fallen: 0, dodge: 0, dodgeX: 0, dodgeZ: 0,
      shirt: lin3(female ? r.pick(SAREES) : r.pick(SHIRTS)), lower: lin3(female ? r.pick(SAREES) : r.pick(PANTS)), skin: lin3(r.pick(SKINS)),
      pax: !!opts.pax, kid, wave: 0, W: 0.6, L: 0.6, v: 0, id: r.int(0, 1e9), onRoad: false,
    };
    if (female && r.chance(0.5)) p.shirt = p.lower.map(v => v * 0.85);
    // the dressed look used up close; the far figure takes its colours from it
    if (!kid && !opts.pax) { this.g.at(e, s, TMP); p.persona = this.pickPersona(female, TMP[0], TMP[1]); }
    if (this.kit) {
      p.look = this.kit.randomLook(new RNG(p.id), { female, dress: DRESS[p.persona] });
      p.shirt = [p.look.top.r, p.look.top.g, p.look.top.b];
      p.lower = [p.look.bottom.r, p.look.bottom.g, p.look.bottom.b];
      p.skin = [p.look.skin.r, p.look.skin.g, p.look.skin.b];
    }
    p.idle = r.pick(['idle', 'idle', 'phone', 'talk', 'arms_folded']);
    if (p.persona) {
      // they look their age: grey hair for the old, beards on some kakas, jeans on the college crowd
      if (p.look) {
        if (OLD.has(p.persona)) { p.look.hair = new THREE.Color(r.pick([0xb8b2aa, 0xd6d2cc, 0x8e8984])).convertSRGBToLinear(); p.look.scale *= 0.97; p.speed *= 0.75; if (!female) p.look.beard = r.chance(0.4); }
        else if (p.persona === 'kaka') p.look.beard = r.chance(0.45);
        else if (/college/.test(p.persona)) p.look.beard = !female && r.chance(0.2);
      }
    }
    p.latT = p.lat;
    if (p.mode === 'stand') p.wait = r.range(20, 80);
    this.place(p);
    this.list.push(p);
    return p;
  }
  spawnAnimals() {
    const r = this.rng;
    const edges = this.g.liveEdges.filter(e => e.rank >= 2 && e.rank <= 4 && e.len > 30);
    for (let k = 0; k < 14; k++) {
      const e = r.pick(edges), s = r.range(5, e.len - 5), side = r.chance(0.5) ? 1 : -1;
      const cow = k < 6;
      const a = { cow, e, s, side, lat: side * (e.w / 2 - (cow ? 1.0 : 0.2)), dir: r.chance(0.5) ? 1 : -1, speed: cow ? 0.35 : 1.2, x: 0, z: 0, yaw: 0, hx: 1, hz: 0,
        rest: r.range(5, 60), moving: false, col: cow ? lin3(r.pick([[0.92, 0.9, 0.85], [0.85, 0.82, 0.78], [0.55, 0.45, 0.38], [0.95, 0.94, 0.9]])) : lin3(r.pick([[0.7, 0.5, 0.3], [0.2, 0.18, 0.16], [0.85, 0.8, 0.7], [0.6, 0.4, 0.22]])),
        W: cow ? 0.7 : 0.35, L: cow ? 2.2 : 0.9, v: 0 };
      if (!cow) a.lat = side * (e.w / 2 + Math.max(0.6, e.sw * 0.5));
      a.kind = cow ? 'cow' : 'dog';
      this.placeAnimal(a);
      this.animals.push(a);
    }
    // cats keep to the building side of the footpath
    for (let k = 0; k < 6; k++) {
      const e = r.pick(edges), s = r.range(5, e.len - 5), side = r.chance(0.5) ? 1 : -1;
      const a = { kind: 'cat', cow: false, e, s, side, lat: side * (e.w / 2 + Math.max(0.5, e.sw - 0.35)), dir: r.chance(0.5) ? 1 : -1, speed: 0.8, x: 0, z: 0, yaw: 0, hx: 1, hz: 0,
        rest: r.range(5, 40), moving: false, col: [0.4, 0.4, 0.4], W: 0.25, L: 0.5, v: 0 };
      this.placeAnimal(a);
      this.animals.push(a);
    }
  }

  place(p) {
    this.g.at(p.e, p.s, TMP);
    const x = TMP[0] + TMP[3] * p.lat, z = TMP[1] - TMP[2] * p.lat;
    let hx = TMP[2] * p.dir, hz = TMP[3] * p.dir;
    if (p.mode === 'cross') { hx = TMP[3] * -Math.sign(p.lat - p.latT) * -1; hz = -TMP[2] * -Math.sign(p.lat - p.latT) * -1; }
    // never a jump: when the path hands them on (a corner onto the next street's footpath, back from a detour),
    // the gap is carried as an offset that closes at a walking pace instead of a snap
    this.settle(p, x + p.dodgeX, z + p.dodgeZ);
    if ((p.mode !== 'stand' || !p.faced) && !(p.dodge > 0)) {          // while scrambling clear they face where they run
      const yaw = Math.atan2(hz, hx);
      p.yaw = p.yaw + wrapAngle(yaw - p.yaw) * 0.25;
      p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
    }
    p.onRoad = Math.abs(p.lat) < p.e.w / 2 + 0.1;
  }
  // move someone to where the path says they are, without a jump: any gap is carried as an offset that closes
  // at a walking pace
  settle(p, nx, nz) {
    let ox = p.offX || 0, oz = p.offZ || 0;
    const ol = Math.hypot(ox, oz);
    if (ol > 0.001) { const k = Math.max(0, ol - Math.max(ol * 2.2, 1.6) * (this._dt || 0.016)) / ol; ox *= k; oz *= k; }
    if (p.placed) { const jx = p.x - (nx + ox), jz = p.z - (nz + oz), j = Math.hypot(jx, jz); if (j > 0.3 && j < 16) { ox += jx; oz += jz; } else if (j >= 16) { ox = oz = 0; } }
    p.placed = true; p.offX = ox; p.offZ = oz;
    p.x = nx + ox; p.z = nz + oz;
  }
  placeAnimal(a) {
    this.g.at(a.e, a.s, TMP);
    a.x = TMP[0] + TMP[3] * a.lat; a.z = TMP[1] - TMP[2] * a.lat;
    a.yaw = Math.atan2(TMP[3] * a.dir, TMP[2] * a.dir);
    a.hx = Math.cos(a.yaw); a.hz = Math.sin(a.yaw);
  }

  // agents standing or walking on the carriageway (for traffic avoidance)
  *roadAgents() {
    for (const p of this.list) if (p.onRoad && !p.fallen) yield p;
    for (const a of this.animals) if (a.cow) yield a;
  }

  // ---------------------------------------------------------------- update
  update(dt, player, avoidView) {
    const px = player.x, pz = player.z;
    this._dt = dt;
    this.g_inView = avoidView;
    // population
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.pax || p.fixed) continue;
      const far = Math.hypot(p.x - px, p.z - pz);
      if ((far > 150 && !(avoidView && avoidView(p.x, p.z) && far < 230)) || p.dead) { if (p.door) p.door.n--; if (p.venue) (p.clubber ? p.venue.clubCrowd-- : p.venue.crowd--); if (p.body) p.body.release(); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    }
    // traffic police (fixed) and waiting passengers don't count towards the walking crowd
    if (this.act && (this.actT -= dt) <= 0) {
      this.actT = 2;
      const o = {};
      this.actHere = this.act.around(px, pz, 110);
      this.act.at(px, pz, o); this.nightHere = o.night;
      this.target = Math.round(this.max * clamp(Math.sqrt(this.actHere / 14), 0.15, 1.6));
    }
    let tries = 5;
    let walkers = 0;
    for (const p of this.list) if (!p.fixed && !p.pax) walkers++;
    // thinning out (late at night): let the far ones go home
    if (walkers > this.target * 1.15) {
      for (let i = this.list.length - 1; i >= 0 && walkers > this.target * 1.15; i--) {
        const p = this.list[i];
        if (p.pax || p.fixed || p.body || Math.hypot(p.x - px, p.z - pz) < 70 || (avoidView && avoidView(p.x, p.z))) continue;
        if (p.door) p.door.n--; if (p.venue) (p.clubber ? p.venue.clubCrowd-- : p.venue.crowd--);
        this.list[i] = this.list[this.list.length - 1]; this.list.pop(); walkers--;
      }
    }
    while (walkers + (5 - tries) < this.target && tries-- > 0) {
      const urgent = walkers < this.target * 0.5;
      // most people appear within ~100 m (out of view), so the street around you feels busy
      // never out of thin air in front of you: out of view, or far enough to be a figure in the crowd
      const hidden = avoidView ? (x, z) => avoidView(x, z) && Math.hypot(x - px, z - pz) < 110 : null;
      const p = this.spawnOne(px, pz, urgent ? 30 : 40, this.rng.chance(0.65) ? 95 : 140, hidden);
      // outside the bars at night people stand around in groups rather than walk
      if (p && this.rng.chance(0.18 + 0.55 * this.nightHere)) { p.mode = 'stand'; p.wait = this.rng.range(15, 90) * (1 + this.nightHere * 2); }
    }
    if ((this.venueT = (this.venueT || 0) - dt) <= 0) { this.venueT = 0.7; this.venueCrowds(px, pz, avoidView); this.clubCrowds(px, pz, avoidView); }
    this.talkTick(dt, player);
    const pv = Math.abs(player.v);
    const phx = Math.cos(player.th), phz = Math.sin(player.th);
    this.lineT -= dt;
    if ((this._stallT = (this._stallT || 0) - dt) <= 0) { this._stallT = 2; this.populateStalls(px, pz); }
    if (player.onFoot) this.bumpPlayer(player);
    for (const p of this.list) this.step(p, dt, player, player.onFoot ? 0 : pv, phx, phz);
    for (const a of this.animals) this.stepAnimal(a, dt, px, pz, player);
  }

  step(p, dt, player, pv, phx, phz) {
    if (p.ctl) { if (p.v > 0) p.phase += dt * p.v * 4.2; return; }     // driven by someone else (police stop)
    if (p.react > 0) p.react -= dt;
    if (p.bumpT > 0) p.bumpT -= dt;
    if (p.shoveT > 0) p.shoveT -= dt;
    if (p.mode === 'inside') {
      p.wait -= dt; p.v = 0;
      if (p.wait <= 0) {
        const d = p.door; p.hidden = false; p.door = null; if (d) d.n--;
        if (d) { p.x = d.x + d.nx * 0.35; p.z = d.z + d.nz * 0.35; p.yaw = Math.atan2(d.nz, d.nx); }
        this.backToPath(p);
      }
      return;
    }
    if (p.fallen > 0) {
      p.fallen -= dt;
      if (p.fallen <= 0) {
        p.wave = 0;
        if (p.ko) {
          // came round after a beating: stagger off, and never pick a fight with you again
          p.ko = false; p.hp = p.hp0 * 0.5; p.mode = 'walk'; p.foe = null; p.beaten = true;
          this.speakAs('flee', p, 0.7, 3); this.flee(p, player.x, player.z, 26);
        } else if (p.mode === 'fight') p.stun = 0.2;
        else {
          p.angry = 4;
          // what they say depends on what knocked them over: you on foot, or something you were driving
          const sc = p.fallBy === 'foot' ? 'shoved' : 'fall'; p.fallBy = null;
          if (Math.hypot(p.x - player.x, p.z - player.z) < 30) { this.lineT = 0; this.speakAs(sc, p); }
          if (sc === 'shoved') p.grudge = 20;
        }
      }
      return;
    }
    if (p.mode !== 'fight') {
      if (p.act) { p.act.t += dt; if (p.act.t >= p.act.dur) p.act = null; }
      if (p.stun > 0) { p.stun -= dt; p.v = 0; return; }
    }
    if (p.mode === 'fight' && this.brawl) return this.brawl.stepPed(p, dt);
    // the driver you pulled out, or someone you shoved: will square up if you come back on foot
    if (p.grudge > 0) {
      p.grudge -= dt;
      if (player.onFoot && !p.beaten && Math.hypot(p.x - player.x, p.z - player.z) < 7 && this.rng.next() < dt * 2) {
        if (this.rng.next() < (TOUGH[p.persona] || 0.1) + 0.25) { this.startFight(p, player); this.speakAs('fight', p, 1, 4); return; }
        p.grudge = 0;
      }
    }
    if (p.angry > 0) p.angry -= dt;
    if (p.froze > 0) { p.froze -= dt; p.v = 0; }
    if (this.mem && (p.id & 3) === ((this._mf = ((this._mf || 0) + 1) & 3))) this.recall(p, player);
    // react to the player's auto
    const dx = p.x - player.x, dz = p.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d < 6 && !player.tipped && !player.onFoot) {        // a vehicle coming at them (you on foot don't make people scramble)
      const along = dx * phx + dz * phz;                  // in front of the auto?
      const side = -dx * phz + dz * phx;
      if (along > -1.5 && along < 2 + pv * 0.9 && Math.abs(side) < 1.6 && pv > 2.2 && p.dodge <= 0 && !p.froze) {
        // see it coming? Everyone reacts at their own speed: the old, and anyone on their phone, are slow;
        // if there isn't time, they freeze (and get hit) instead of gliding sideways out of it
        const react = p.react || (p.react = (OLD.has(p.persona) ? 0.75 : 0.42) + (p.idle === 'phone' ? 0.25 : 0) + this.rng.next() * 0.3);
        const tti = Math.max(0, along) / Math.max(0.1, pv);
        if (tti > react) {
          const s = Math.sign(side) || 1;
          p.dodge = 0.6; p.dodgeVX = -phz * s * 3.4; p.dodgeVZ = phx * s * 3.4;
          p.yaw = Math.atan2(phx * s, -phz * s); p.v = 3.4;                  // a scramble, facing where they run
          this.events.push({ type: 'dodge', p, x: p.x, z: p.z });
        } else { p.froze = 0.8; this.events.push({ type: 'dodge', p, x: p.x, z: p.z }); }
      }
      if (d < 1.15 && pv > 2.0) {
        // how bad it is depends on how fast you were going: a knock, knocked out, or killed
        const kmh = pv * 3.6, R = this.rng.next();
        const dead = kmh > 70 ? R < 0.8 : kmh > 50 ? R < 0.4 : kmh > 35 ? R < 0.08 : false;
        const ko = dead || kmh > 25;
        p.dodge = 0.3; p.dodgeVX = phx * pv * 0.55; p.dodgeVZ = phz * pv * 0.55;       // thrown along your path
        p.fallen = dead ? 1e6 : ko ? 8 + kmh * 0.25 + R * 6 : 3 + kmh * 0.12; p.ko = ko; p.corpse = dead; p.v = 0;
        this.remember(p, dead ? 'dead' : 'hit');
        this.events.push({ type: 'pedHit', p, speed: pv, x: p.x, z: p.z, sev: dead ? 'dead' : ko ? 'ko' : 'knock' });
        return;
      }
    }
    if (p.mode === 'free') return this.stepFree(p, dt);
    if (p.mode === 'watch') {
      p.wait -= dt; p.v = 0;
      if (p.watch.follow && !p.watch.follow.hidden) { p.watch.x = p.watch.follow.x; p.watch.z = p.watch.follow.z; }
      this.face(p, p.watch.x, p.watch.z, dt);
      if (p.wait <= 0) { p.anim = null; this.backToPath(p); }
      return;
    }
    if (p.dodge > 0) {
      p.dodge -= dt;
      p.dodgeX += p.dodgeVX * dt; p.dodgeZ += p.dodgeVZ * dt;
    } else { p.dodgeX *= Math.exp(-dt * 0.8); p.dodgeZ *= Math.exp(-dt * 0.8); }

    if (p.fixed) { p.v = 0; p.x += p.dodgeX * 0; return; }
    if (p.pax) { p.wave += dt; p.v = 0; this.face(p, player.x, player.z, dt); return; }
    if (p.mode === 'stand') {
      p.wait -= dt; p.v = 0;
      if (p.anchor) {
        p.x = p.anchor.x; p.z = p.anchor.z;
        if (p.anchor.fx !== undefined) this.face(p, p.anchor.fx, p.anchor.fz, dt);
        if (p.wait <= 0) { const nx = p.anchorNext; p.anchor = null; p.anchorNext = null; if (p.venue) { (p.clubber ? p.venue.clubCrowd-- : p.venue.crowd--); p.venue = null; } if (nx) { p.mode = 'walk'; nx(p); } else this.backToPath(p); }
        return;
      }
      if (p.wait <= 0) p.mode = 'walk';
      this.place(p);
      return;
    }
    // stop and glare at whoever just honked
    if (p.react > 0 && p.mode === 'walk' && p.reactAt) { p.v = 0; this.face(p, p.reactAt.x, p.reactAt.z, dt); return; }
    if (p.mode === 'cross') {
      const sp = p.speed * (p.hurry ? 1.9 : 1.0);
      const dl = p.latT - p.lat;
      const step = Math.sign(dl) * Math.min(Math.abs(dl), sp * dt);
      p.lat += step;
      p.v = sp;
      p.phase += dt * sp * 4.2;
      // hurry if something is coming
      p.hurry = false;
      if (Math.abs(p.lat - p.latT) < 0.05) { p.mode = 'walk'; p.side = Math.sign(p.latT); }
      this.placeCross(p);
      return;
    }
    // walk along the footpath
    p.s += p.dir * p.speed * dt;
    p.v = p.speed;
    p.phase += dt * p.speed * 4.2;
    if (p.s < 0 || p.s > p.e.len) {
      const nodeIdx = p.s < 0 ? p.e.a : p.e.b;
      const node = this.g.nodes[nodeIdx];
      const opts = [...node.out, ...node.inc].map(l => l.e).filter(e => e !== p.e && (e.rank >= 2 || p.e.rank < 2 || (this.act && this.act.at(e.pts[0], e.pts[1]) > 6)));
      if (!opts.length || node.portal) { p.dir = -p.dir; p.s = clamp(p.s, 0, p.e.len); }
      else {
        const e = this.rng.pick(opts);
        // round the corner on the same side of the street (picking a side at random teleported people
        // across the road: they seemed to vanish mid-step)
        const handed = p.side * p.dir;
        p.e = e;
        p.dir = e.a === nodeIdx ? 1 : -1;
        p.s = p.dir > 0 ? 0.5 : e.len - 0.5;
        p.side = handed * p.dir;
        p.lat = p.latT = this.sidewalkLat(e, p.side);
      }
    }
    // pop into a shop now and then
    if (!p.kid && this.rng.next() < dt * 0.02) {
      const d = this.doorNear(p.x, p.z, 4.5, p);
      // only a door just ahead of them, so they walk in rather than turn round and blink out
      if (d && (d.x - p.x) * p.hx + (d.z - p.z) * p.hz > 0.5) { d.n++; this.goTo(p, d.x, d.z, (q) => { q.mode = 'inside'; q.hidden = true; q.door = d; q.wait = this.rng.range(6, 35); }); return; }
    }
    // occasionally cross the road wherever (very Pune)
    if (this.rng.next() < dt * 0.012 && p.e.rank <= 5) {
      p.mode = 'cross';
      p.latT = this.sidewalkLat(p.e, -p.side);
    }
    this.place(p);
  }
  placeCross(p) {
    this.g.at(p.e, p.s, TMP);
    this.settle(p, TMP[0] + TMP[3] * p.lat + p.dodgeX, TMP[1] - TMP[2] * p.lat + p.dodgeZ);
    const s = Math.sign(p.latT - p.lat) || 1;
    const hx = TMP[3] * s, hz = -TMP[2] * s;     // across the road
    const yaw = Math.atan2(hz, hx);
    p.yaw += wrapAngle(yaw - p.yaw) * 0.3;
    p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
    p.onRoad = Math.abs(p.lat) < p.e.w / 2 + 0.1;
  }
  face(p, tx, tz, dt) {
    const yaw = Math.atan2(tz - p.z, tx - p.x);
    p.yaw += wrapAngle(yaw - p.yaw) * Math.min(1, dt * 3);
    p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
  }
  stepAnimal(a, dt, px, pz, player) {
    if (a.free) return;                       // following you, chasing you, running away (people/strays.js)
    // animals far away jump to a new spot near the player now and then, so there are always some around
    if (Math.abs(a.x - px) > 260 || Math.abs(a.z - pz) > 260) { if (this.relocate(a, px, pz)) return; }
    a.rest -= dt;
    if (a.rest <= 0) { a.moving = !a.moving; a.rest = a.moving ? this.rng.range(4, 15) : this.rng.range(10, 60); }
    let sp = a.speed;
    // street dogs chase two-wheelers (and bark at everything else)
    if (a.kind === 'dog' && player && !player.onFoot) {
      const d = Math.hypot(a.x - px, a.z - pz), v = Math.abs(player.v);
      if (!(a.chase > 0) && d < 14 && v > 2.5 && v < 11 && player.spec && player.spec.two && this.rng.next() < dt * (this.act && (this.act._h > 22 || this.act._h < 5.5) ? 1.4 : 0.5)) { a.chase = 5 + this.rng.next() * 3; this.events.push({ type: 'dogChase', x: a.x, z: a.z }); }
      if (a.chase > 0) {
        a.chase -= dt;
        this.g.at(a.e, clamp(a.s, 0, a.e.len), TMP);
        const along = (px - a.x) * TMP[2] + (pz - a.z) * TMP[3];
        a.dir = along >= 0 ? 1 : -1;
        a.moving = true; sp = 5.4; a.rest = 3;
        if (d > 30) a.chase = 0;
        if (this.rng.next() < dt * 1.5) this.events.push({ type: 'bark', x: a.x, z: a.z });
      }
    }
    // your vehicle: animals get out of the way if they can; a dog or cat that can't is hurt or killed; a cow
    // doesn't move for anyone, and what you hit is a few hundred kilos of cow
    if (a.dead) { a.v = 0; a.moving = false; return; }
    if (player && !player.onFoot && !player.tipped) {
      const pv = Math.abs(player.v), hx = Math.cos(player.th), hz = Math.sin(player.th), dx = a.x - px, dz = a.z - pz, d = Math.hypot(dx, dz);
      const along = dx * hx + dz * hz, side = -dx * hz + dz * hx, r = a.cow ? 1.9 : 1.2;
      if (!a.cow && pv > 2.5 && along > 0 && along < 2 + pv && Math.abs(side) < 1.5 && !(a.dodgeT > 0) && along / pv > (a.kind === 'cat' ? 0.25 : 0.4)) {
        a.dodgeT = 1; a.lat += (Math.sign(a.lat) || 1) * 1.6; a.moving = true; sp = 6;                // a dart for the kerb
      }
      if (a.dodgeT > 0) a.dodgeT -= dt;
      if (d < r && pv > 2) {
        const kmh = pv * 3.6;
        if (a.cow) { this.events.push({ type: 'cowHit', a, speed: pv, x: a.x, z: a.z }); a.rest = 20; a.moving = false; }
        else if (!(a.hurtT > 0)) {
          const dead = kmh > 35 || (kmh > 20 && this.rng.next() < 0.4);
          if (dead) { a.dead = true; a.moving = false; a.v = 0; } else { a.hurtT = 8; a.chase = 0; a.dir = -a.dir; a.moving = true; a.rest = 8; }
          this.events.push({ type: 'animalHit', a, dead, x: a.x, z: a.z });
          return;
        }
      }
    }
    if (a.hurtT > 0) { a.hurtT -= dt; sp = Math.max(sp, 4.5); }                 // limping off, fast
    if (a.moving) {
      a.s += a.dir * sp * dt;
      if (a.s < 2 || a.s > a.e.len - 2) { a.dir = -a.dir; a.s = clamp(a.s, 2, a.e.len - 2); a.chase = 0; }
      a.v = sp;
    } else a.v = 0;
    this.placeAnimal(a);
  }
  relocate(a, px, pz) {
    for (let t = 0; t < 12; t++) {
      const LE = this.g.liveEdges, e = LE[Math.floor(this.rng.next() * LE.length)];
      if (e.rank < 2 || e.rank > 4 || e.len < 30) continue;
      this.g.at(e, e.len / 2, TMP);
      const d = Math.hypot(TMP[0] - px, TMP[1] - pz);
      const night = this.act && (this.act._h > 22 || this.act._h < 5.5);
      if (d < (night && a.kind === 'dog' ? 45 : 90) || d > 220) continue;
      a.e = e; a.s = this.rng.range(5, e.len - 5); a.dead = false; a.hurtT = 0;          // a different animal, out of sight
      a.lat = a.cow ? a.side * (e.w / 2 - 1.0) : a.kind === 'cat' ? a.side * (e.w / 2 + Math.max(0.5, e.sw - 0.35)) : a.side * (e.w / 2 + Math.max(0.6, e.sw * 0.5));
      this.placeAnimal(a);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- off-path movement
  // walk straight to (tx, tz), then call then(p)
  goTo(p, tx, tz, then, hurry = false) {
    p.mode = 'free'; p.goal = { x: tx, z: tz, then, hurry, t: 0, path: this.walkPath(p.x, p.z, tx, tz), k: 0, prog: 0, best: 1e9 };
  }
  // how a person gets somewhere: straight there if nothing's in the way, otherwise along the streets on the footpath
  // (the route's centreline pushed out to the side of the road they're on), never through a building
  walkPath(x0, z0, x1, z1) {
    const surf = this.W.surf, d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 1.5);
    let clear = true;
    if (surf.inBuilding) for (let i = 1; i < n && clear; i++) { const t = i / n; if (surf.inBuilding(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) clear = false; }
    if (clear) return null;
    const G = this.g, a = G.nearest(x0, z0, 50), b = G.nearest(x1, z1, 50);
    if (!a || !b) return null;
    const r = G.route(a, b, true); if (!r) return null;
    const pl = G.routePolyline(r, a, b); if (!pl || pl.length < 4) return null;
    // which side of the road they start on, kept the whole way (people stay on their footpath)
    const sx = pl[2] - pl[0], sz = pl[3] - pl[1], sl = Math.hypot(sx, sz) || 1, side = Math.sign((x0 - pl[0]) * (sz / sl) - (z0 - pl[1]) * (sx / sl)) || 1;
    const off = Math.max(3.2, (a.e.w || 7) / 2 + 1.2), out = [];
    for (let i = 0; i + 1 < pl.length; i += 2) {
      const j = Math.min(pl.length - 2, i + 2), k = Math.max(0, i - 2), tx = pl[j] - pl[k], tz = pl[j + 1] - pl[k + 1], tl = Math.hypot(tx, tz) || 1;
      let px = pl[i] + (tz / tl) * off * side, pz = pl[i + 1] - (tx / tl) * off * side;
      if (surf.inBuilding && surf.inBuilding(px, pz)) { px = pl[i] + (tz / tl) * (off - 1.5) * side; pz = pl[i + 1] - (tx / tl) * (off - 1.5) * side; }
      out.push(px, pz);
    }
    out.push(x1, z1);
    return out;
  }
  stepFree(p, dt) {
    const g = p.goal;
    g.t += dt;
    // the next point on the way (or the goal itself)
    let gx = g.x, gz = g.z;
    if (g.path) {
      while (g.k < g.path.length - 2 && Math.hypot(g.path[g.k] - p.x, g.path[g.k + 1] - p.z) < 1.4) g.k += 2;
      gx = g.path[g.k]; gz = g.path[g.k + 1];
    }
    const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz), dGoal = Math.hypot(g.x - p.x, g.z - p.z);
    // getting nowhere for a few seconds (something in the way): stop trying, carry on from here
    if (dGoal < g.best - 0.5) { g.best = dGoal; g.prog = 0; } else g.prog += dt;
    if (dGoal < 0.3 || g.t > 60 || g.prog > 3.5) { p.goal = null; g.then(p); return; }
    const sp = p.speed * (g.hurry ? 1.9 : 1);
    const st = Math.min(d, sp * dt);
    const surf = this.W.surf, ox = p.x, oz = p.z;
    let nx = p.x + dx / d * st, nz = p.z + dz / d * st;
    // never step into a building: stop at the wall instead of tunnelling through it
    if (surf.inBuilding && surf.inBuilding(nx, nz) && !surf.inBuilding(ox, oz)) { nx = ox; nz = oz; }
    p.x = nx; p.z = nz;
    const res = this.W.collision.resolve(p.x, p.z, 0.22);
    if (res && res.kind !== 3) { p.x += res.nx * res.depth; p.z += res.nz * res.depth; }
    // nor through a car: pushed out of any vehicle's box (moving traffic and the ones stopped in it)
    const cars = this.cars ? this.cars() : null;
    if (cars) for (const v of cars) {
      const ex = p.x - v.x, ez = p.z - v.z;
      if (Math.abs(ex) > 4 || Math.abs(ez) > 4 || !v.T) continue;
      const hl = v.T.L / 2 + 0.25, hw = v.T.W / 2 + 0.25, lx = ex * v.hx + ez * v.hz, lz = -ex * v.hz + ez * v.hx;
      if (Math.abs(lx) >= hl || Math.abs(lz) >= hw) continue;
      // out of the box, but at a stumble, not a jump
      const cap = Math.max(0.05, 5 * dt), pl = Math.min(cap, hl - Math.abs(lx)), pw = Math.min(cap, hw - Math.abs(lz));
      if (hl - Math.abs(lx) < hw - Math.abs(lz)) { const s = Math.sign(lx) || 1; p.x += v.hx * pl * s; p.z += v.hz * pl * s; }
      else { const s = Math.sign(lz) || 1; p.x += -v.hz * pw * s; p.z += v.hx * pw * s; }
    }
    // somehow inside a building (spawned or shoved there): back out to the street at once
    // (walk out to the street: they can always step out of a wall, only never into one)
    if (surf.inBuilding && surf.inBuilding(p.x, p.z) && !g.outside) {
      const near = this.g.nearest(p.x, p.z, 60);
      if (near) { this.g.at(near.e, near.s, TMP); g.x = TMP[0]; g.z = TMP[1]; g.path = null; g.outside = true; g.best = 1e9; }
    }
    // stuck against something (a wall between them and where they're going): don't keep running into
    // it; head for the street, or give up and carry on from here
    const moved = Math.hypot(p.x - ox, p.z - oz);
    g.stuck = moved < st * 0.35 ? (g.stuck || 0) + dt : Math.max(0, (g.stuck || 0) - dt);
    if (g.stuck > 0.7) {
      g.stuck = 0;
      const near = !g.rerouted && this.g.nearest(p.x, p.z, 40);
      if (near) { this.g.at(near.e, near.s, TMP); g.x = TMP[0]; g.z = TMP[1]; g.rerouted = true; }
      else { p.goal = null; g.then(p); return; }
    }
    const mdx = p.x - ox, mdz = p.z - oz;
    const face = moved > 1e-4 ? Math.atan2(mdz, mdx) : Math.atan2(dz, dx);
    p.yaw += wrapAngle(face - p.yaw) * Math.min(1, dt * 8);
    p.hx = Math.cos(p.yaw); p.hz = Math.sin(p.yaw);
    p.v = moved / Math.max(dt, 1e-4); p.phase += dt * p.v * 4.2;
    p.onRoad = surf.isRoad(p.x, p.z);
  }
  // back to the footpath and carry on walking
  backToPath(p) {
    this.g.at(p.e, clamp(p.s, 0, p.e.len), TMP);
    p.lat = p.latT = this.sidewalkLat(p.e, p.side || 1);
    const x = TMP[0] + TMP[3] * p.lat, z = TMP[1] - TMP[2] * p.lat;
    this.goTo(p, x, z, (q) => { q.mode = 'walk'; q.dodgeX = q.dodgeZ = 0; q.anim = null; this.place(q); });
  }
  // people standing in groups outside real bars, cafes and restaurants: the Mills or a KP lane at
  // night, a vada pav place at lunch. Only at doors of real businesses (world/buildingsChunk.js),
  // as many as the place and the hour call for; they drift off to the footpath when they're done.
  venueCrowds(px, pz, avoidView) {
    if (!this.act) return;
    let n = 0;
    for (const p of this.list) if (p.venue) n++;
    const want = Math.round(this.target * clamp(0.08 + this.nightHere * 0.7, 0, 0.6));
    if (n >= want) return;
    const st = this.W.streamer, cands = [];
    let tot = 0;
    for (const c of st.built) {
      if (!c.doors || Math.abs(c.cx - px) > 140 || Math.abs(c.cz - pz) > 140) continue;
      for (const d of c.doors) {
        const dd = Math.hypot(d.x - px, d.z - pz);
        if (dd > 120 || d.crowd > 4) continue;
        const o = {}, a = this.act.at(d.x, d.z, o);
        const w = a * (0.2 + o.night) ** 2;
        if (w < 1.5) continue;
        cands.push([d, w]); tot += w;
      }
    }
    if (!cands.length) return;
    let r = this.rng.next() * tot, d = cands[0][0];
    for (const [dd, w] of cands) { r -= w; if (r <= 0) { d = dd; break; } }
    const urgent = n < want * 0.4;
    // a group of 2-5 a couple of metres out from the door
    const k = this.rng.int(2, 5), gx = d.x + d.nx * this.rng.range(1.6, 3.2), gz = d.z + d.nz * this.rng.range(1.6, 3.2);
    if (avoidView && avoidView(gx, gz) && Math.hypot(gx - px, gz - pz) < 110) return;
    void urgent;
    const near = this.g.nearest(gx, gz, 90);
    if (!near) return;
    d.crowd = (d.crowd || 0) + k;
    for (let i = 0; i < k; i++) {
      const a = i / k * Math.PI * 2 + this.rng.range(-0.3, 0.3), rr = this.rng.range(0.45, 0.8);
      const x = gx + Math.cos(a) * rr, z = gz + Math.sin(a) * rr;
      const res = this.W.collision.resolve(x, z, 0.25);
      if (res && res.kind !== 3) continue;
      const p = this.make(near.e, near.s, near.side || 1, { mode: 'stand' });
      p.anchor = { x, z, fx: gx, fz: gz }; p.x = x; p.z = z; p.venue = d;
      p.wait = this.rng.range(40, 160) * (1 + this.nightHere);
      p.idle = this.rng.pick(['talk', 'talk', 'phone', 'idle', 'arms_folded']);
    }
  }
  // a club at night: the pavement out front is packed. Groups smoking, waiting on friends, arguing about where
  // next, someone on the phone, couples. Up to ~30 people per club, thinning out after 2 AM
  clubCrowds(px, pz, avoidView) {
    const h = this.hour ?? 12;
    if (!this.isClub || !(h >= 21 || h < 2.5)) return;
    const peak = h >= 23 || h < 1.5 ? 1 : 0.6, st = this.W.streamer;
    for (const c of st.built) {
      if (!c.doors || Math.abs(c.cx - px) > 140 || Math.abs(c.cz - pz) > 140) continue;
      for (const d of c.doors) {
        if (d.shop < 0 || Math.hypot(d.x - px, d.z - pz) > 110 || !this.isClub(d)) continue;
        const cap = Math.round(30 * peak);
        if ((d.clubCrowd || 0) >= cap) continue;
        const gx = d.x + d.nx * this.rng.range(1.8, 6.5) + d.nz * this.rng.range(-7, 7), gz = d.z + d.nz * this.rng.range(1.8, 6.5) - d.nx * this.rng.range(-7, 7);
        if (avoidView && avoidView(gx, gz) && Math.hypot(gx - px, gz - pz) < 110) continue;
        const near = this.g.nearest(gx, gz, 90);
        if (!near) continue;
        const k = this.rng.int(2, 6);
        for (let i = 0; i < k; i++) {
          const a = i / k * Math.PI * 2 + this.rng.range(-0.3, 0.3), rr = this.rng.range(0.45, 0.85);
          const x = gx + Math.cos(a) * rr, z = gz + Math.sin(a) * rr;
          const res = this.W.collision.resolve(x, z, 0.25);
          if (res && res.kind !== 3) continue;
          const p = this.make(near.e, near.s, near.side || 1, { mode: 'stand', female: this.rng.chance(0.48) });
          p.persona = this.rng.pick(p.female ? ['kpgirl', 'kpgirl', 'collegegirl'] : ['kpguy', 'kpguy', 'collegeboy']);
          p.anchor = { x, z, fx: gx, fz: gz }; p.x = x; p.z = z; p.venue = d; p.clubber = true;
          p.wait = this.rng.range(60, 240);
          p.idle = this.rng.pick(['talk', 'talk', 'talk', 'phone', 'idle', 'arms_folded', 'dance']);
          d.clubCrowd = (d.clubCrowd || 0) + 1;
        }
        return;                       // one group per tick
      }
    }
  }
  doorNear(x, z, r, p) {
    let best = null, bd = r;
    const st = this.W.streamer, half = this.W.index.size * 0.75;
    for (const c of st.built) {
      if (!c.doors || Math.abs(c.cx - x) > half + r || Math.abs(c.cz - z) > half + r) continue;
      for (const d of c.doors) {
        if (d.n > 1) continue;
        const dx = x - d.x, dz = z - d.z, dd = Math.hypot(dx, dz);
        if (dd < bd && dx * d.nx + dz * d.nz > 0.2) { bd = dd; best = d; }
      }
    }
    return best;
  }
  // walking into a traffic cop: a telling-off, a warning, a ₹500 fine, then he's had enough
  copShoved(p, P) {
    p.bumpT = 2.5; p.react = 2.2; p.reactAt = { x: P.x, z: P.z }; p.reactAnim = 'no';
    p.shoves = (p.shoveT > 0 ? p.shoves || 0 : 0) + 1; p.shoveT = 90;
    const pol = this.brawl && this.brawl.g.police;
    if (p.shoves === 1) this.say && this.say('cop_push', p);
    else if (p.shoves === 2) this.say && this.say('cop_warn', p);
    else if (p.shoves === 3) { this.say && this.say('cop_fine', p); if (pol) pol.charge('obstruct', 500, 'Obstructing a public servant'); }
    else { this.startFight(p, P); this.say && this.say('cop_fight', p); if (pol) pol.raiseHeat(1, 'Shoving a traffic cop', 'assault'); }
    if (this.brawl) this.brawl.g.events?.push?.({ type: 'copShoved', n: p.shoves });
  }
  // ---------------------------------------------------------------- fights (see fight.js)
  // someone gets hit (by you, usually)
  hurt(p, dmg, sx, sz, M, byPlayer) {
    if (p.corpse) return;
    // putting the boot in on someone already out cold: enough of it and they don't get up again
    if (p.fallen > 0 && p.ko) {
      p.over = (p.over || 0) + dmg; p.fallen = Math.max(p.fallen, 14);
      if (p.over > 45) {
        p.corpse = true; p.fallen = 1e6;
        this.events.push({ type: 'pedDied', p, x: p.x, z: p.z });
        if (this.brain) this.brain.incident('down', p.x, p.z, { victim: p, byYou: !!byPlayer });
      }
      return;
    }
    // a fighter who sees it coming blocks: most of the blow is taken on the arms
    if (p.mode === 'fight' && p.fightT > 0.6 && !p.act && this.rng.next() < (p.cop ? 0.35 : 0.22) + (TOUGH[p.persona] || 0.05) * 0.3) {
      p.act = { kind: 'block', clip: 'block', speed: 1.4, t: 0, dur: 0.45 }; p.actId = (p.actId || 0) + 1; dmg *= 0.25;
    }
    if (p.hp0 === undefined) { p.hp0 = p.cop ? 130 : HP[p.persona] || 60; p.hp = p.hp0; }
    p.hp -= dmg;
    const dx = p.x - sx, dz = p.z - sz, d = Math.hypot(dx, dz) || 1;
    p.x += dx / d * (M ? M.push : 0.3); p.z += dz / d * (M ? M.push : 0.3);
    const res = this.W.collision.resolve(p.x, p.z, 0.25);
    if (res && res.kind !== 3) { p.x += res.nx * res.depth; p.z += res.nz * res.depth; }
    if (p.anchor) { p.anchor = null; if (p.venue) { (p.clubber ? p.venue.clubCrowd-- : p.venue.crowd--); p.venue = null; } }
    if (p.door) { p.door.n--; p.door = null; }
    p.act = null; p.anim = null;
    if (p.hp <= 0) {
      // out cold
      p.ko = true; p.fallen = this.rng.range(14, 26); p.v = 0; p.stun = 0;
      // a big last blow on someone already in a bad way can kill (rarely)
      if (M && M.dmg >= 20 && p.hp < -p.hp0 * 0.35 && this.rng.next() < 0.18) { p.corpse = true; p.fallen = 1e6; this.events.push({ type: 'pedDied', p, x: p.x, z: p.z }); }
      this.events.push({ type: 'pedKO', p, x: p.x, z: p.z });
      if (this.brain) this.brain.incident('down', p.x, p.z, { victim: p, byYou: !!byPlayer });
      const L = byPlayer && this.brawl && this.brawl.g.life;
      if (L) {
        // beating someone who fought back earns street cred; beating someone who didn't costs karma
        if (p.mode === 'fight') { L.s.tally.fightsWon++; L.change('respect', p.cop ? 6 : 3); }
        else L.change('karma', OLD.has(p.persona) || p.female ? -10 : -5);
      }
      return;
    }
    if (M && M.down && this.rng.next() < M.down + (p.hp < p.hp0 * 0.4 ? 0.3 : 0)) { p.fallen = 2.2; p.v = 0; }
    else { p.stun = 0.34; p.act = { kind: 'hurt', clip: this.rng.chance(0.5) ? 'hit_head' : 'hit', speed: 1, t: 0, dur: 0.34 }; p.actId = (p.actId || 0) + 1; }
    if (!byPlayer) return;
    if (p.mode !== 'fight' && this.brawl && this.brawl.g.life) this.brawl.g.life.change('karma', -1);
    if (p.mode !== 'fight' && !p.fleeing) {
      // first blow: fight back, or run and shout
      const resp = this.brawl && this.brawl.g.life ? this.brawl.g.life.s.respect : 0;
      const tough = p.beaten ? 0 : p.cop ? 1 : ((TOUGH[p.persona] || 0.05) + (p.grudge > 0 ? 0.2 : 0) + (p.angry > 0 ? 0.1 : 0)) * (resp > 40 ? 0.55 : resp > 20 ? 0.8 : 1);
      if (p.cop) { this.startFight(p, this.brawl.P); this.say && this.say('cop_fight', p); p.backupT = 4; }
      else if (this.rng.next() < tough) { this.startFight(p, this.brawl.P); this.lineT = 0; this.speakAs(this.rng.chance(0.5) ? 'fight' : 'hit', p, 1, 3); }
      else { this.lineT = 0; this.speakAs(this.rng.chance(0.6) ? 'flee' : 'hit', p, 1, 3); this.flee(p, sx, sz, 28); }
    } else if (this.rng.next() < 0.18) this.speakAs('hit', p, 1, 3);
  }
  startFight(p, foe) {
    if (this.brain && foe && foe.foot) this.brain.incident('fight', p.x, p.z, { byYou: true });
    if (p.hp0 === undefined) { p.hp0 = p.cop ? 130 : HP[p.persona] || 60; p.hp = p.hp0; }
    if (p.anchor) { p.anchor = null; if (p.venue) { (p.clubber ? p.venue.clubCrowd-- : p.venue.crowd--); p.venue = null; } }
    p.mode = 'fight'; p.foe = foe; p.fightT = 0; p.atkT = this.rng.range(0.5, 1.1); p.act = null; p.fixedWas = p.fixedWas ?? p.fixed; p.fixed = false;
    p.anim = null; p.goal = null; p.fleeing = false;
    if (this.brawl) this.brawl.active = 0.01;
  }
  endFight(p, won) {
    p.foe = null; p.act = null; p.stun = 0;
    if (p.cop && p.fixedWas) { const post = p.post || { x: p.x, z: p.z }; this.goTo(p, post.x, post.z, (q) => { q.fixed = true; q.mode = 'fixed'; }); return; }
    if (won) { p.react = 2; p.reactAnim = 'yes'; }
    this.backToPath(p);
  }
  // get away from (x, z), then carry on
  flee(p, x, z, dist = 25) {
    if (p.anchor) { p.anchor = null; if (p.venue) { (p.clubber ? p.venue.clubCrowd-- : p.venue.crowd--); p.venue = null; } }
    let a = Math.atan2(p.z - z, p.x - x);
    let tx = p.x + Math.cos(a) * dist, tz = p.z + Math.sin(a) * dist;
    // run along the street rather than into a wall
    const near = this.g.nearest(tx, tz, 40);
    if (near) { this.g.at(near.e, near.s, TMP); tx = TMP[0]; tz = TMP[1]; }
    p.fleeing = true; p.anim = null; p.speed = Math.max(p.speed, 1.5);
    this.goTo(p, tx, tz, (q) => { q.fleeing = false; this.backToPath(q); }, true);
  }

  // ---------------------------------------------------------------- talk
  // people say hello when you walk past slowly, and you overhear the ones standing around
  talkTick(dt, P) {
    this.chatT = (this.chatT ?? 12) - dt;
    if (P.onFoot && P.v < 2.6) {
      for (const p of this.list) {
        if (p.greeted || p.pax || p.cop || p.hidden || p.fallen > 0 || p.ctl || p.kid) continue;
        const dx = p.x - P.x, dz = p.z - P.z;
        if (Math.abs(dx) > 2.4 || Math.abs(dz) > 2.4 || Math.hypot(dx, dz) > 2.2) continue;
        p.greeted = true;
        // how they read you: a respected local, trouble, an unusual outfit, a drunk, well turned out
        const how = this.reaction ? this.reaction() : null;
        const sc = how && STREET[p.persona] && STREET[p.persona][how] ? how : 'greet';
        if (this.rng.next() < (sc === 'greet' ? 0.3 : 0.5) && this.speakAs(sc, p, 1, 6)) {
          p.react = 2.4; p.reactAt = { x: P.x, z: P.z }; p.reactAnim = sc === 'scared' || sc === 'odd' ? 'no' : sc === 'respect' ? 'wave' : 'talk';
          if (sc === 'scared') setTimeout(() => this.flee(p, P.x, P.z, 18), 900);
        }
        break;
      }
    }
    // talking to themselves as they pass: the price of kothimbir, a late cab, a deadline
    this.mutterT = (this.mutterT ?? 9) - dt;
    if (this.mutterT <= 0) {
      this.mutterT = this.rng.range(8, 18);
      if (Math.abs(P.v) < 7) {
        let best = null, bd = 9;
        for (const p of this.list) {
          if (p.pax || p.cop || p.hidden || p.kid || p.mode === 'fight' || p.fleeing || p.fallen > 0 || p.venue) continue;
          const d = Math.hypot(p.x - P.x, p.z - P.z);
          if (d < bd && d > 1.2) { bd = d; best = p; }
        }
        if (best) this.speakAs('mutter', best, 0.8, 5);
      }
    }
    if (this.chatT <= 0) {
      this.chatT = this.rng.range(14, 32);
      if (Math.abs(P.v) > 6) return;
      let best = null, bd = 16;
      for (const p of this.list) {
        if (p.pax || p.cop || p.hidden || p.kid || !(p.mode === 'stand' || p.venue)) continue;
        const d = Math.hypot(p.x - P.x, p.z - P.z);
        if (d < bd && d > 2) { bd = d; best = p; }
      }
      if (best) this.speakAs('chat', best, 1, 7);
    }
  }
  // you jumped or climbed a wall in front of people
  onStunt(P) {
    let best = null, bd = 13;
    for (const p of this.list) {
      if (p.pax || p.cop || p.hidden || p.kid || p.fallen > 0) continue;
      const d = Math.hypot(p.x - P.x, p.z - P.z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best && this.speakAs('stunt', best, 0.7, 6)) { best.react = 2.2; best.reactAt = { x: P.x, z: P.z }; best.reactAnim = 'no'; }
  }
  // ---------------------------------------------------------------- reactions
  // the player honked: people ahead stop and glare; crossers hurry
  onHorn(P) {
    const hx = Math.cos(P.th), hz = Math.sin(P.th);
    let any = null;
    for (const p of this.list) {
      if (p.pax || p.cop || p.fallen > 0 || p.hidden || p.ctl) continue;
      const dx = p.x - P.x, dz = p.z - P.z;
      if (Math.abs(dx) > 18 || Math.abs(dz) > 18) continue;
      const along = dx * hx + dz * hz, side = -dx * hz + dz * hx;
      if (along < -2 || along > 18 || Math.abs(side) > 7) continue;
      if (p.mode === 'cross') { p.hurry = true; p.speed = Math.max(p.speed, 1.9); }
      if (!(p.react > 0)) { p.react = 2.2; p.reactAt = { x: P.x, z: P.z }; p.reactAnim = 'no'; any = p; }
    }
    if (any) this.speakAs('honk', any, 0.4);
  }
  // something happened at (x, z): people nearby come and stand around, some filming it
  gather(x, z, n = 5, ctx = 'vehicle') {
    this.crowdCtx = ctx;
    const c = [];
    for (const p of this.list) {
      if (p.pax || p.cop || p.fallen > 0 || p.hidden || p.ctl || p.mode === 'free' || p.mode === 'watch' || p.mode === 'inside') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 42 && d > 1.5) c.push([d, p]);
    }
    c.sort((a, b) => a[0] - b[0]);
    c.slice(0, n).forEach(([, p], i) => {
      const a = (i / n) * Math.PI * 2 + this.rng.next() * 0.8, r = 2.6 + this.rng.next() * 1.6;
      p.anchor = null;
      this.goTo(p, x + Math.cos(a) * r, z + Math.sin(a) * r, (q) => {
        q.mode = 'watch'; q.watch = { x, z }; q.wait = 14 + this.rng.next() * 12;
        q.anim = this.rng.pick(['arms_folded', 'phone', 'phone', 'talk', 'idle']);
      }, true);
    });
    if (c.length) setTimeout(() => this.speakAs('crowd', c[0][1], 0.9), 1600);
  }
  // you, on foot, walking into people
  bumpPlayer(P) {
    for (const p of this.list) {
      if (p.hidden || p.fallen > 0 || p.ctl) continue;
      const dx = p.x - P.x, dz = p.z - P.z;
      if (Math.abs(dx) > 0.8 || Math.abs(dz) > 0.8) continue;
      const d = Math.hypot(dx, dz);
      if (d > 0.62 || d < 1e-3) continue;
      const push = 0.62 - d;
      if (p.mode === 'walk' || p.mode === 'cross') { p.dodgeX += dx / d * push; p.dodgeZ += dz / d * push; }
      else { p.x += dx / d * push; p.z += dz / d * push; }
      if (p.cop && P.v > 1.2 && !(p.bumpT > 0) && p.mode !== 'fight') { this.copShoved(p, P); continue; }
      if (P.v > 2.4 && !(p.bumpT > 0)) {
        p.bumpT = 3; p.react = 1.4; p.reactAt = { x: P.x, z: P.z }; p.reactAnim = 'hit';
        if (P.v > 5.2 && !p.cop) { this.remember(p, 'shoved'); p.fallen = 2.4; p.fallBy = 'foot'; this.events.push({ type: 'pedBumped', p, x: p.x, z: p.z }); }
        else this.speakAs('bump', p, 0.6);
      }
    }
  }
  // chai and vada-pav stalls get a few people standing around them
  populateStalls(px, pz) {
    const S = this.W.M.stalls || [];
    for (const [k, list] of this.stallsUsed) {
      const st = S[k];
      if (Math.hypot(st[0] / 100 - px, st[1] / 100 - pz) > 220) { this.stallsUsed.delete(k); }
    }
    for (let k = 0; k < S.length; k++) {
      const st = S[k], x = st[0] / 100, z = st[1] / 100;
      if (Math.abs(x - px) > 110 || Math.abs(z - pz) > 110 || this.stallsUsed.has(k)) continue;
      const d = Math.hypot(x - px, z - pz);
      if (d > 110 || d < 30 || (this.g_inView && this.g_inView(x, z) && d < 100)) continue;
      const n = this.rng.int(0, 3);
      this.stallsUsed.set(k, n);
      for (let i = 0; i < n; i++) {
        const a = st[2] + Math.PI / 2 + (this.rng.next() - 0.5) * 2.2, r = 1.3 + this.rng.next() * 0.7;
        let sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
        const res = this.W.collision.resolve(sx, sz, 0.3); if (res) { sx += res.nx * res.depth; sz += res.nz * res.depth; }
        const near = this.g.nearest(sx, sz, 30, e => e.rank >= 2);
        if (!near) continue;
        const p = this.make(near.e, near.s, near.side || 1, { mode: 'stand' });
        p.anchor = { x: sx, z: sz, fx: x, fz: z }; p.x = sx; p.z = sz;
        p.wait = this.rng.range(50, 160);
        p.idle = this.rng.pick(['talk', 'talk', 'phone', 'idle', 'arms_folded']);
      }
    }
  }

  // traffic police at some signalised junctions: khaki uniform, standing at the corner
  addCops(cops, heads) {
    for (const c of cops) {
      const near = this.g.nearest(c.x, c.z, 40);
      if (!near) continue;
      const p = this.make(near.e, near.s, near.side || 1, { female: false, mode: 'fixed', adult: true });
      p.fixed = true; p.x = c.x; p.z = c.z; p.cop = true; p.post = { x: c.x, z: c.z };
      if (this.kit) { p.look = this.kit.randomLook(new RNG(p.id), { role: 'police' }); p.idle = 'arms_folded'; }
      c.ped = p;
      p.shirt = [0.42, 0.36, 0.2].map(v => v); p.lower = [0.4, 0.34, 0.2]; p.skin = [0.32, 0.2, 0.13];
      p.yaw = c.fx !== undefined ? Math.atan2(c.fz - c.z, c.fx - c.x) : Math.atan2(near.e.pts[1] - c.z, near.e.pts[0] - c.x);
      p.onRoad = false;
    }
  }

  // someone specific, right here (the driver you pulled out of their car)
  spawnAt(look, x, z, persona) {
    const near = this.g.nearest(x, z, 40);
    if (!near) return null;
    const p = this.make(near.e, near.s, near.side || 1, { female: !!look.female, mode: 'watch', adult: true });
    p.look = look; p.persona = persona; p.female = !!look.female;
    p.shirt = [look.top.r, look.top.g, look.top.b]; p.lower = [look.bottom.r, look.bottom.g, look.bottom.b]; p.skin = [look.skin.r, look.skin.g, look.skin.b];
    p.x = x; p.z = z; p.onRoad = true;
    p.watch = { x, z }; p.wait = 2.8; p.anim = 'no';
    return p;
  }
  // passengers for the ride system
  spawnPassenger(e, s, side) {
    const p = this.make(e, s, side, { pax: true, mode: 'stand' });
    p.wait = 1e9;
    return p;
  }
  remove(p) { const i = this.list.indexOf(p); if (i >= 0) { if (p.body) p.body.release(); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); } }

  // ---------------------------------------------------------------- render
  render(cx, cz) {
    let nm = 0, nf = 0, nl = 0, na = 0, nu = 0;
    const umb = this.rain > 0.2;
    const mm = this.mMale, mf = this.mFemale, ml = this.mLeg, ma = this.mArm;
    for (const p of this.list) {
      if (p.body || p.hidden) continue;    // drawn up close by crowd.js, or inside a shop
      if (nm >= this.cap - 1 || nf >= this.cap - 1) break;
      if (Math.abs(p.x - cx) > 130 || Math.abs(p.z - cz) > 130) continue;
      // behind the camera and not right next to it: nothing to draw (their shadows fall well inside 25 m)
      if (this.g_inView && Math.abs(p.x - cx) + Math.abs(p.z - cz) > 25 && !this.g_inView(p.x, p.z)) continue;
      if (p.gyX === undefined || Math.abs(p.x - p.gyX) + Math.abs(p.z - p.gyZ) > 1.5) { p.gyX = p.x; p.gyZ = p.z; p.gy = this.W.surf.height(p.x, p.z); }
      const y = p.gy;
      const s = p.scale;
      const swing = p.mode === 'stand' || p.pax ? 0 : Math.sin(p.phase) * 0.5;
      // body
      E.set(p.fallen > 0 ? 0 : 0, -p.yaw, p.fallen > 0 ? -1.45 : 0, 'YXZ');
      Q.setFromEuler(E);
      P3.set(p.x, y + (p.fallen > 0 ? 0.15 : Math.abs(Math.sin(p.phase)) * 0.03), p.z);
      S3.set(s, s, s);
      M4.compose(P3, Q, S3);
      const body = p.female ? mf : mm;
      const bi = p.female ? nf++ : nm++;
      body.setMatrixAt(bi, M4);
      body.instanceColor.setXYZ(bi, p.shirt[0], p.shirt[1], p.shirt[2]);
      body.geometry.attributes.aColB.setXYZ(bi, p.lower[0], p.lower[1], p.lower[2]);
      body.geometry.attributes.aColC.setXYZ(bi, p.skin[0], p.skin[1], p.skin[2]);
      BASE.copy(M4);
      if (p.fallen > 0) continue;
      if (umb && hasUmbrella(p) && nu < this.cap) {
        P3.set(p.x + p.hx * 0.22, y + 1.02, p.z + p.hz * 0.22); S3.set(1, 1, 1); Q.identity();
        M4.compose(P3, Q, S3); this.mUmb.setMatrixAt(nu, M4); UC.setHex(umbrellaColor(p)).convertSRGBToLinear(); this.mUmb.instanceColor.setXYZ(nu, UC.r, UC.g, UC.b); nu++;
      }
      // legs (men only; saree hides them)
      if (!p.female) for (const sd of [-1, 1]) {
        TA.makeTranslation(0, 0.95, sd * 0.09); RA.makeRotationZ(swing * sd);
        MM.copy(BASE).multiply(TA).multiply(RA);
        ml.setMatrixAt(nl, MM);
        ml.instanceColor.setXYZ(nl, p.lower[0], p.lower[1], p.lower[2]);
        nl++;
      }
      // arms (passengers wave one arm)
      for (const sd of [-1, 1]) {
        let rot = -swing * sd * 0.8, lift = 0;
        if (p.pax && sd === -1) { rot = 0.3; lift = -2.6 + Math.sin(p.wave * 7) * 0.35; }
        if (p.angry > 0 && sd === 1) { lift = -2.2 + Math.sin(p.angry * 14) * 0.3; }
        const sh = p.female ? 1.4 : 1.46;
        TA.makeTranslation(0, sh, sd * (p.female ? 0.19 : 0.23)); RA.makeRotationZ(rot); RB.makeRotationX(lift * sd);
        MM.copy(BASE).multiply(TA).multiply(RA).multiply(RB);
        ma.setMatrixAt(na, MM);
        ma.instanceColor.setXYZ(na, p.shirt[0], p.shirt[1], p.shirt[2]);
        ma.geometry.attributes.aColC.setXYZ(na, p.skin[0], p.skin[1], p.skin[2]);
        na++;
      }
    }
    this.mUmb.count = nu; if (nu) { this.mUmb.instanceMatrix.needsUpdate = true; this.mUmb.instanceColor.needsUpdate = true; }
    for (const [m, n] of [[mm, nm], [mf, nf], [ml, nl], [ma, na]]) {
      m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      m.geometry.attributes.aColB.needsUpdate = true; m.geometry.attributes.aColC.needsUpdate = true;
    }
    if (this.drawAnimals === false) return;
    let nc = 0, nd = 0;
    for (const a of this.animals) {
      if (a.kind === 'cat') continue;
      const mesh = a.cow ? this.mCow : this.mDog;
      const i = a.cow ? nc++ : nd++;
      E.set(0, -a.yaw, 0, 'YXZ'); Q.setFromEuler(E);
      const lie = !a.moving && !a.cow;
      P3.set(a.x, (Math.abs(a.lat) < a.e.w / 2 ? 0 : 0.15) - (lie ? 0.18 : 0), a.z);
      S3.set(1, lie ? 0.6 : 1, 1);
      M4.compose(P3, Q, S3);
      mesh.setMatrixAt(i, M4);
      mesh.instanceColor.setXYZ(i, a.col[0], a.col[1], a.col[2]);
    }
    for (const [m, n] of [[this.mCow, nc], [this.mDog, nd]]) { m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  }
}

function lin3(c) { return [lin(c[0]), lin(c[1]), lin(c[2])]; }
