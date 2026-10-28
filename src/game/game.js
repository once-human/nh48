// Game flow: title → shift (rides) or free roam; per-frame updates; events → feedback;
// signals, challans, street names; pause/map/settings; adaptive resolution.
import * as THREE from 'three';
import { clamp, lerp, RNG, safeStorage, wrapAngle, damp } from '../core/util.js';
import { HUD } from '../ui/hud.js';
import { CityMap } from '../ui/map.js';
import { SW } from '../world/landmarks.js';

const LM_MR = { shaniwar: 'शनिवारवाडा', dagdusheth: 'श्रीमंत दगडूशेठ हलवाई गणपती', mandai: 'महात्मा फुले मंडई', station: 'पुणे रेल्वे स्टेशन',
  agakhan: 'आगाखान पॅलेस', lalmahal: 'लाल महाल', ohel: 'लाल देऊळ', tulshibaug: 'तुळशीबाग राम मंदिर', kasba: 'कसबा गणपती', sppu: 'सावित्रीबाई फुले पुणे विद्यापीठ',
  coep: 'सीओईपी', osho: 'ओशो आश्रम', parvati: 'पर्वती', shinde: 'शिंदे छत्री', omkareshwar: 'ओंकारेश्वर मंदिर', stmary: 'सेंट मेरी चर्च',
  vishrambaug: 'विश्रामबाग वाडा', fergusson: 'फर्ग्युसन कॉलेज', chaturshringi: 'चतुःशृंगी मंदिर' };
import { Rides, fareFor } from './rides.js';
import { Audio } from './audio.js';
import { People } from '../people/peds.js';
import { buildParked } from '../traffic/parked.js';
import { Police } from './police.js';
import { Crowd } from '../people/crowd.js';
import { Brawl } from '../people/fight.js';
import * as Save from './save.js';
import { Life } from './life.js';
import { Shops, lookFromJSON, DEALER } from './shops.js';
import { Props } from './props.js';
import { Gigs } from './gigs.js';
import { Hustle } from './hustle.js';
import { Transit } from './transit.js';
import { PhotoMode } from './photo.js';
import { Wada } from './wada.js';
import TRANSIT_DATA from './transit.json';
import { justOpened, lineOpen, opensOn } from './metroOpen.js';
import { Club } from './club.js';
import { Lights } from './lights.js';
import { Bag } from './bag.js';
import { Phone } from './phone.js';
import { Eggs } from './eggs.js';
import { Story } from './story.js';
import { Strays } from '../people/strays.js';
import { Interiors } from '../world/interiors.js';
import { StreetApproach } from './approach.js';
import { Dates } from './date.js';
import { loadSettings, applySettings } from './settings.js';
import { refreshChips } from './keys.js';
import { Trial } from './trial.js';
import { Fauna } from '../people/animals.js';
import { Vehicle } from '../vehicles/vehicle.js';

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx);
    this.hour = parseFloat(this.params.get('hour') || '15.75');
    this.timeScale = 1 / 180;        // game hours per real second (1 h = 3 min)
    this.state = 'title';
    this.clock = 0;                  // game hours since the save began (never wraps)
    this.viewScale = 1;
    this.t = 0;
    this.rng = new RNG(1);
    this.qualityName = this.quality.name;
    // a preset the player chose (or a ?q= test override) is never changed automatically
    const st0 = safeStorage();
    let saved = null; try { saved = st0 && st0.getItem('nh48_quality'); } catch (e) { /* ignore */ }
    this.userQuality = !!(this.params.get('q') || saved);
    this.stats = { money: 10000, rides: 0, starSum: 0, rating: 0, grant: 3 };    // every new player starts with ₹10,000
    this.test = {
      drive: parseFloat(this.params.get('drive') || '0'),
      steer: parseFloat(this.params.get('steer') || '0'),
      frames: parseInt(this.params.get('frames') || '4'),
      cam: parseInt(this.params.get('cammode') || '0'),
      brakeAfter: parseFloat(this.params.get('brakeafter') || '999'),
      play: this.params.get('play'),
      foot: parseFloat(this.params.get('foot') || '0'),
      take: this.params.get('take'),
    };
    this.perf = { acc: 0, n: 0, slow: 0, fast: 0, pr: Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio) };
    this.timers = { street: 0, wrong: 0, sig: 0, finesCool: 0 };
    this.lastJunction = -1;
  }

  async init(progress) {
    const { W, player, traffic } = this;
    const st = safeStorage();
    if (st) { try { const s = JSON.parse(st.getItem('nh48_stats') || 'null'); if (s) { Object.assign(this.stats, s); if ((s.grant || 0) < 3) { this.stats.money = Math.max(10000, this.stats.money); this.stats.grant = 3; } } } catch (e) { /* ignore */ } }
    // first time in: on the road by Shaniwar Wada's garden, the Delhi Darwaza in view (?spawn=FC Road etc. for others)
    const start = this.params.get('spawn') ? this.findStart(this.params.get('spawn')) : (this.wadaStart() || this.findStart('FC Road'));
    // where you were last time (position, vehicle, towed auto...)
    this.saved = this.params.has('test') || this.params.has('spawn') ? null : Save.load();
    const sp = Save.startPoint(this.saved);
    if (sp) { start.x = sp.x; start.z = sp.z; start.th = sp.th; if (this.saved.hour !== undefined) this.hour = this.saved.hour; }
    // coming back from a graphics reset: same spot, same time of day, straight into play
    let resume = null;
    try { resume = JSON.parse(sessionStorage.getItem('nh48_resume') || 'null'); sessionStorage.removeItem('nh48_resume'); } catch (e) { /* ignore */ }
    if (resume && Date.now() - resume.t < 120000 && !this.params.has('test')) {
      start.x = resume.x; start.z = resume.z; start.th = resume.th; this.hour = resume.hour;
      this.resumed = true;
    }
    player.reset(start.x, start.z, start.th);
    this.start = start;
    // a brand new game: you step out of your auto onto the garden in front of the Delhi Darwaza, facing it
    this.wadaIntro = (!this.saved && !this.resumed && !this.params.has('spawn') && !this.params.has('test')) || this.params.has('intro');
    this.settings = loadSettings();
    this.audio = new Audio(this.sounds);
    // browsers only allow sound after a gesture: start on the first click or key anywhere
    const unlock = () => { this.audio.start(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    this.people = new People(W, this.scene, this.vmats.body, this.quality);
    this.people.cars = () => this.traffic ? this.traffic.list : null;      // people step out of the way of cars, never through them
    // which shop fronts are clubs (they get a crowd out front at night)
    this.people.isClub = (d) => { if (d.club === undefined) { const inf = d.shop >= 0 && this.shops && this.shops.infoOf(d); d.club = !!(inf && inf.kind === 'bar' && this.shops.isClub(inf)); } return d.club; };
    this.crowd = new Crowd(this.people, W.kit, this.scene, W, this.quality);
    this.fauna = new Fauna(this.people, W.animalKit, this.scene, W);
    this.traffic.peds = this.people;
    this.city = new CityMap(W);
    this.city.warm(0);
    // waypoint beacon: a soft column of light you can see over the rooftops
    {
      const g = new THREE.CylinderGeometry(0.9, 0.9, 140, 20, 1, true); g.translate(0, 70, 0);
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { uA: { value: 0 } },
        vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y; vec4 w = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-w.xyz); gl_Position = projectionMatrix * w; }',
        fragmentShader: 'uniform float uA; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1. - abs(dot(vN, vV)), 1.5); float f = (1. - smoothstep(10., 140., vY)) * (0.35 + 0.65 * (1. - rim)); gl_FragColor = vec4(vec3(0.37,0.82,1.0) * f * uA, 1.); }',
      });
      this.beacon = new THREE.Mesh(g, m); this.beacon.visible = false; this.beacon.frustumCulled = false; this.beacon.renderOrder = 5;
      this.scene.add(this.beacon);
    }
    this.waypoint = null; this.nav = null;
    this.hud = new HUD(this);
    player.hud = this.hud; player.audio = this.audio;
    this.rides = new Rides(this);
    this.rides.enabled = false;
    this.rig.setMode(this.test.cam);
    this.placeCops();
    this.police = new Police(this);
    player.onRelease = (d) => this.police.release(d);
    player.speak = (id, src) => this.police.say(id, src);
    player.speakAs = (sc, who) => { this.people.lineT = 0; return this.people.speakAs(sc, who, 1, 4); };
    this.people.say = (id, src) => this.police.say(id, src);
    this.brawl = new Brawl(this); this.people.brawl = this.brawl;
    player.makePed = (look, x, z, per) => this.people.spawnAt(look, x, z, per);
    player.pickPersona = (f, x, z) => this.people.pickPersona(f, x, z);
    this.buildLightPools();
    const parked = W.parked = buildParked(W, this.scene, this.vmats, this.quality);
    W.instSets.push(...parked.sets);
    this.traffic.setStatics(parked.statics);
    // you as a person (hunger, respect...), the shops, property, deliveries, nights out, the backpack
    this.life = new Life(this);
    this.shops = new Shops(this);
    this.props = new Props(this);
    this.gigs = new Gigs(this);
    this.hustle = new Hustle(this);
    this.transit = new Transit(this);
    this.photo = new PhotoMode(this);
    this.wada = new Wada(this);
    this.club = new Club(this);
    this.bag = new Bag(this);
    this.phone = new Phone(this);
    this.eggs = new Eggs(this);
    this.story = new Story(this);
    this.lights = new Lights(this);
    this.strays = new Strays(this);
    this.interiors = new Interiors(this);
    this.date = new Dates(this);
    this.approachSt = new StreetApproach(this);
    applySettings(this);
    this.trial = new Trial(this);
    this.people.reaction = () => this.life.reaction();
    player.hpMax = () => this.life.hpMax;
    player.sprintMul = () => this.life.sprintMul;
    player.drunk = () => this.life.s.drunk;
    player.useHook = () => this.shops.tryUse();
    this.origLook = player.look ? { ...player.look, top: player.look.top.clone(), bottom: player.look.bottom.clone(), shoe: player.look.shoe.clone(), hair: player.look.hair.clone(), cut: player.look.cut.clone() } : null;
    if (this.life.s.look && player.look) { lookFromJSON(player.look, this.life.s.look); W.kit.applyLook(player.human, player.look); }
    // a new character from the picker starts with their own clothes
    const setLook = player.setLook.bind(player);
    player.setLook = (look) => { setLook(look); if (this.life) { this.life.s.look = null; this.life.save(); } this.origLook = { ...look }; };
    if (this.saved) { try { Save.restore(this, this.saved, Vehicle); } catch (e) { console.warn('restore', e); } }
    if (this.life.s.autoFuel !== undefined) player.auto.fuel = this.life.s.autoFuel;
    if (this.life.s.autoDmg !== undefined) player.auto.dmg = this.life.s.autoDmg;
    this.applyUpgrades();
    // keep it saved: every few seconds while playing, and whenever the tab goes away
    const persist = () => { if (this.free) return; if (this.state === 'play' || this.state === 'pause' || this.state === 'map') { Save.save(this); this.saveStats(); } };
    this.debugSave = { Save, Vehicle };
    setInterval(persist, 5000);
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    await progress('Waking up the traffic', 0.94);
    traffic.prefill(player.x, player.z);
    W.activity.setHour(this.hour); this.traffic.hour = this.hour;
    for (let k = 0; k < 10; k++) this.people.update(0.1, player, null);
    // keys
    window.addEventListener('keydown', (e) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;     // typing in the map search
      // (Esc that just released the mouse already opened the pause menu: don't close it again)
      if (e.code === 'Escape' || e.code === 'KeyP') { if ((this.state === 'play' || this.state === 'pause') && performance.now() - (this._pausedAt || 0) > 300) this.togglePause(); }
      if (e.code === 'KeyM' && (this.state === 'play' || this.state === 'map')) this.toggleMap();
      if (this.free && this.state === 'play' && (e.code === 'BracketLeft' || e.code === 'BracketRight')) this.setHour((this.hour + (e.code === 'BracketRight' ? 1 : 23)) % 24);
      if (e.code === 'KeyE' && this.state === 'play' && !e.repeat) { e.preventDefault(); this.bag.show('bag'); }
      if (e.code === 'Tab' && this.state === 'play') { e.preventDefault(); this.bag.show('me'); }
      if (this.state === 'title' && (e.code === 'Enter' || e.code === 'Space') && !(this.hud.pickerOpen)) this.begin();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.togglePause(true); });
    document.addEventListener('fullscreenchange', () => { this._fsT = performance.now(); });
    // drag on the canvas orbits the camera a little
    const cv = this.renderer.domElement;
    let drag = null;
    // the mouse belongs to the game while you play: click once to capture it, then moving it turns
    // the camera and a click is a punch. Esc (or any menu) gives the cursor back.
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    const locked = () => document.pointerLockElement === cv;
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') { drag = { x: e.clientX, y: e.clientY }; return; }
      if (this.state === 'play' && !locked() && cv.requestPointerLock) { this.lockMouse(); return; }
      if (locked() && e.button === 0 && this.state === 'play') this.input.pressed.add('Mouse0');
      if (!locked() && (e.button === 0 || e.button === 2)) drag = { x: e.clientX, y: e.clientY };
    });
    document.addEventListener('mousemove', (e) => { if (locked() && this.state === 'play') { const s = this.settings.sens; this.rig.drag(e.movementX * 0.8 * s, e.movementY * 0.8 * s * (this.settings.invertY ? -1 : 1)); } });
    document.addEventListener('pointerlockchange', () => {
      this.hud.setLockHint?.(this.state === 'play' && !locked());
      // Esc released the mouse during play: that's a pause, like any game. Esc that closed a shop
      // or the jhola only closes it; the next key you press takes the mouse back.
      // going full screen, or coming back from the pause menu, can drop the mouse for a moment: that's no pause
      const fromMenu = performance.now() - (this._menuT || 0) < 450 || performance.now() - (this._resumeT || 0) < 1500 || performance.now() - (this._fsT || 0) < 1500;
      // the browser eats Esc to release the mouse, so inside a shop or the jhola that release IS the Esc
      if (!locked() && this.state === 'shop' && !this._unlockOk) { this.closeMenus(); this._menuT = performance.now(); }
      else if (!locked() && this.state === 'play' && !this._unlockOk && !fromMenu) this.togglePause(true);
      this._unlockOk = false;
    });
    // any key in play takes the mouse back (keys count as a gesture; Esc never does)
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'play' || locked() || e.code === 'Escape' || this.params.has('test') || !cv.requestPointerLock) return;
      this.lockMouse();
    });
    this.lockMouse = () => {
      if (locked() || !cv.requestPointerLock || this.params.has('test')) return;
      try { const r = cv.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { cv.requestPointerLock(); } catch (e2) { /* next key */ } }); } catch (err) { /* tried too soon after Esc; the next key will do it */ }
    };
    this.releaseMouse = () => { if (locked()) { this._unlockOk = true; document.exitPointerLock(); } };
    window.addEventListener('pointermove', (e) => { if (drag) { this.rig.drag(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; } });
    window.addEventListener('pointerup', () => { drag = null; });
    // shaders compile in the background (the driver does it off the main thread where it can): the title
    // screen comes up now, the city fades in behind it when they're done
    this.warming = this.prewarm().catch(() => {}).finally(() => { this._warmDone = true; });
    if (this.test.play) this.startPlay(this.test.play === 'shift');
    if (this.resumed) { this.startPlay(false); this.hud.toast('Recovered', 'Your graphics driver reset, so the game reloaded where you were.', 'info', 4); }
  }
  // compile every shader the game will need now, behind the loading screen, instead of the first
  // time someone new walks up or you take a vehicle (that compile was the freeze)
  async prewarm() {
    const R = this.renderer, cam = this.camera, kit = this.W.kit;
    const shown = [], tmp = [];
    // the sky's reflection map first: every material's shader depends on it, and compiling before it
    // existed meant compiling the whole scene twice
    if (this.sky && !this.sky.envRT) this.sky.update(this.hour, cam.position, 0);
    try {
      // in front of the camera, really rendered once (behind the loading screen): that also builds
      // the shadow and skinning variants that compile() alone skips
      const fw = new THREE.Vector3(); cam.getWorldDirection(fw);
      let k = 0;
      const at = (o) => { o.position.set(cam.position.x + fw.x * 7 + (k % 6 - 3) * 1.2, cam.position.y - 1.6, cam.position.z + fw.z * 7 + Math.floor(k / 6) * 1.2); k++; };
      if (this.crowd) for (const s of this.crowd.pool) { s.H.holder.visible = true; at(s.H.holder); for (const o of s.H.parts) o.visible = true; shown.push(s); }
      // every kind you can take, with its driver's-seat interior showing (that view compiles too)
      for (const t of ['sedan', 'hatch', 'suv', 'taxi', 'scooter', 'bike', 'cycle', 'auto', 'bus', 'tempo']) { const v = new Vehicle(this.W, this.scene, this.vmats, t); if (v.cockpit) v.cockpit.group.visible = true; at(v.root); tmp.push(v); }
      const pv = this.player.human && { vis: this.player.human.holder.visible, pos: this.player.human.holder.position.clone() };
      if (this.player.human) { this.player.human.holder.visible = true; at(this.player.human.holder); }
      await R.compileAsync(this.scene, cam);       // in parallel on the GPU driver where it can
      R.render(this.scene, cam);
      if (pv) { this.player.human.holder.visible = pv.vis; this.player.human.holder.position.copy(pv.pos); }   // back as it was (at the wheel, or wherever)
    } catch (e) { console.warn('prewarm', e); }
    for (const s of shown) { s.H.holder.visible = false; if (kit) kit.applyLook(s.H, s.H.look); }
    for (const v of tmp) v.dispose();
  }
  // fuel burns as you drive (a full tank lasts ~25 km in an auto, more on a scooter), crashes dent
  // the engine (never an explosion: Indian vehicles are tougher than that), and both slow you down
  vehicleWear(dt) {
    const P = this.player;
    if (P.onFoot) return;
    const v = P.cur, S = P.spec || {};
    if (v.fuel === undefined) v.fuel = v === P.auto ? 1 : 0.35 + Math.random() * 0.6;
    if (v.dmg === undefined) v.dmg = 0;
    const range = v === P.auto ? 25000 : S.two ? (S.name === 'Bicycle' ? 1e12 : 32000) : 45000;
    const was = v.fuel;
    v.fuel = Math.max(0, v.fuel - Math.abs(v.v) * dt / range * (0.6 + (v.throttle || 0) * 0.6));
    if (was > 0.12 && v.fuel <= 0.12) this.hud.toast('Fuel low', `Under 12%. Nearest pump: ${this.nearestPump()}`, 'warn', 4);
    if (was > 0 && v.fuel <= 0) this.hud.toast('Out of fuel', 'The engine coughs. You can crawl to a pump', 'bad', 4);
    const fuelMul = v.fuel > 0 ? 1 : 0.22;
    v.powerMul = (v.tune || 1) * fuelMul * (1 - Math.min(0.8, v.dmg) * 0.4);
    if (v === P.auto) { this.life.s.autoFuel = Math.round(v.fuel * 1000) / 1000; this.life.s.autoDmg = Math.round(v.dmg * 1000) / 1000; }
  }
  nearestPump() {
    const P = this.player;
    let best = null, bd = 1e9;
    for (const p of this.shops.places) if (p.kind === 'fuel') { const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < bd) { bd = d; best = p; } }
    return best ? `${best.name}, ${bd > 950 ? (bd / 1000).toFixed(1) + ' km' : Math.round(bd / 10) * 10 + ' m'}` : 'see the map';
  }
  // run fn after t seconds of game time
  later(t, fn) { (this.delayed || (this.delayed = [])).push({ t, fn }); }
  tickTimers(dt) {
    const D = this.delayed;
    if (!D) return;
    for (let i = D.length - 1; i >= 0; i--) { const T = D[i]; if ((T.t -= dt) <= 0) { D.splice(i, 1); T.fn(); } }
  }
  saveResume() {
    const P = this.player;
    try { sessionStorage.setItem('nh48_resume', JSON.stringify({ x: P.x, z: P.z, th: P.th, hour: this.hour, t: Date.now() })); } catch (e) { /* ignore */ }
    this.saveStats();
  }

  // a floating marker over your auto until you first get in it
  autoMarkerTick(dt) {
    const P = this.player;
    if (this.findAuto && !P.onFoot && P.cur === P.auto) {
      this.findAuto = false;
      const dd = P.dropped && P.dropped.find(q => q.veh === P.auto); if (dd) dd.safe = false;
      this.hud.toast('Your auto', 'On the meter whenever you drive it: people waving show up green on the map', 'meter', 4);
    }
    if (!this.findAuto) { if (this._mk) this._mk.visible = false; return; }
    if (!this._mk) {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthTest: false });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4), m); cone.rotation.x = Math.PI; g.add(cone);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 24), m); ring.rotation.x = Math.PI / 2; ring.position.y = -0.7; g.add(ring);
      g.renderOrder = 999; g.traverse(o => { o.renderOrder = 999; });
      this.scene.add(g); this._mk = g;
    }
    const A = P.auto, t = performance.now() / 1000;
    this._mk.visible = true; this._mk.position.set(A.x, 3.4 + Math.sin(t * 2.4) * 0.18, A.z); this._mk.rotation.y = t * 1.6;
  }
  wadaStart() {
    const W = this.W, L = W.landmarks && W.landmarks.find(l => l.id === 'shaniwar');
    if (!L) return null;
    const c = Math.cos(L.rot), s = Math.sin(L.rot), P = (u, v) => [L.x + u * c + v * s, L.z + u * s - v * c];
    const [gx, gz] = P(2.7, -83), [px, pz] = P(2.7, -128);
    const near = W.graph.nearest(px, pz, 90, (e) => e.rank >= 3);
    if (!near) return null;
    const e = near.e, t = W.graph.at(e, Math.max(3, Math.min(e.len - 3, near.s)));
    let hx = t[2], hz = t[3];
    if (hx * (gx - t[0]) + hz * (gz - t[1]) < 0) { hx = -hx; hz = -hz; }
    // the auto stand: off the carriageway on the Wada side of the road, clear of trees, carts and the
    // footpath's busiest line, parallel to the road and as close to it as that allows (never towed there)
    const S = this.standSpot(L, P, e, t);
    if (S) { this.stand = S; return S; }
    const lat = e.oneway ? e.w / 2 - 1.8 : (hx === t[2] ? 1.8 : -1.8);
    return { x: t[0] + t[3] * lat, z: t[1] - t[2] * lat, th: Math.atan2(hz, hx) };
  }
  standSpot(L, P, e, t) {
    const W = this.W, T = W.trees, busy = [...SW.vendors.map(q => P(q[0], q[1])), P(...SW.counter), P(...SW.plaque), P(SW.GU, SW.GV - 36)];
    const tx = t[2], tz = t[3];
    let best = null;
    for (let u = -40; u <= 46; u += 2) for (let v = -150; v <= -92; v += 2) {
      const [x, z] = P(u, v);
      // the whole footprint (3 m long, 1.5 m wide) off the road and out of buildings
      let ok = true;
      for (const [a, b] of [[0, 0], [1.8, 0], [-1.8, 0], [0, 1.1], [0, -1.1], [1.8, 1.1], [-1.8, -1.1]]) {
        const qx = x + tx * a - tz * b, qz = z + tz * a + tx * b;
        if (W.surf.isRoad(qx, qz) || W.surf.inBuilding(qx, qz) || W.surf.isWater(qx, qz)) { ok = false; break; }
      }
      if (!ok) continue;
      if (Math.abs(u - SW.GU) < 20 && v > SW.GV - 52) continue;                 // the garden and the statue lawn
      if (busy.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 4.5)) continue;
      if (T) { let near = false; for (let i = 0; i < T.x.length && !near; i++) near = Math.abs(T.x[i] - x) < 4.5 && Math.abs(T.z[i] - z) < 4.5; if (near) continue; }
      // closest to the road (but at least a car's width off its edge), then closest to the gate
      const n = W.graph.nearest(x, z, 40, (q) => q.rank >= 2);
      if (!n) continue;
      const q = W.graph.at(n.e, Math.max(0, Math.min(n.e.len, n.s))), dRoad = Math.hypot(q[0] - x, q[1] - z) - n.e.w / 2;
      if (dRoad < 2.2) continue;
      const score = dRoad * 3 + Math.hypot(u - SW.GU, v - SW.GV) * 0.15;
      if (!best || score < best.score) best = { x, z, th: Math.atan2(q[3], q[2]), score };
    }
    return best;
  }
  findStart(roadName) {
    const { W } = this;
    const ids = new Set(W.graph.names.map((n, i) => (n[0] === roadName ? i : -1)).filter(i => i >= 0));
    let edges = W.graph.liveEdges.filter(e => ids.has(e.name) && e.len > 40);
    if (!edges.length) edges = W.graph.liveEdges.filter(e => e.rank >= 4 && e.len > 60);
    edges.sort((a, b) => b.pts[1] - a.pts[1]);
    const e = edges[Math.min(edges.length - 1, parseInt(this.params.get('ei') || '1'))];
    const s = Math.min(e.len * 0.5, 30);
    const t = W.graph.at(e, s);
    const lat = e.oneway ? e.w / 2 - 1.8 : 1.8;
    return { x: t[0] + t[3] * lat, z: t[1] - t[2] * lat, th: Math.atan2(t[3], t[2]) };
  }
  // where the world streams around: you, or the shop door while you're inside it
  focus() {
    if (this.state === 'title') return this.camera.position;
    const I = this.interiors && this.interiors.cur;
    if (I) { this._door = this._door || new THREE.Vector3(); return this._door.set(I.door.x, 0, I.door.z); }
    return this.player.root.position;
  }

  // ---------------------------------------------------------------- state changes
  // Start: pick who you are the first time, then you're in your auto (the shift runs while you drive it)
  // Free roam: no police, unlimited cash, any time of day, go anywhere from the map. Your story game is left alone
  beginFree() {
    if (!this.free) { const P = this.player; this._story = { money: this.stats.money, hour: this.hour, x: P.x, z: P.z, th: P.onFoot ? P.foot.yaw : P.th, foot: P.onFoot, life: JSON.stringify(this.life.s) }; this.free = true; this.stats.money = 99999999; this.hour = 17.2; this.wadaIntro = true; }   // a fresh game every time, from Shaniwar Wada at golden hour
    this.hud.setFree?.(true);
    if (!this.hud.hasCharacter || this.hud.hasCharacter()) return this.startPlay(false);
    this.hud.showPicker(() => this.startPlay(false));
  }
  leaveFree() {
    if (!this.free) return;
    if (this.police) this.police.heat = 0;
    {
      // back to the story: your money, your time of day, and where you were, as if free roam never happened
      const S = this._story; this.free = false; this.stats.money = S.money; this.hour = S.hour; this.hud.setFree?.(false);
      try { this.life.s = JSON.parse(S.life); } catch (e) { /* keep */ }
      try { if (S.foot) this.player.teleportFoot(S.x, S.z, S.th, this.traffic); else this.player.reset(S.x, S.z, S.th); this.rig.inited = false; } catch (e) { /* stay */ }
    }
    this.hud.syncTitle?.();
  }
  begin() {
    this.leaveFree();
    if (!this.hud.hasCharacter || this.hud.hasCharacter()) return this.startPlay(false);
    this.hud.showPicker(() => this.startPlay(false));
  }
  startPlay(shift) {
    refreshChips();      // key chips in every panel show your bindings
    if (this.warming && !this._warmDone) { this.warming.then(() => this.startPlay(shift)); return; }   // Start before the city's ready: in a moment
    // drop focus from the menu button so Space (handbrake) can't press it again
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    this.state = 'play';
    if (this.wadaIntro) {
      this.wadaIntro = false;
      const L = this.W.landmarks && this.W.landmarks.find(l => l.id === 'shaniwar');
      if (L) {
        const c = Math.cos(L.rot), s = Math.sin(L.rot), P = (u, v) => [L.x + u * c + v * s, L.z + u * s - v * c];
        const [gx, gz] = P(2.7, -83), [x, z] = P(-4, -112);
        try { this.player.teleportFoot(x, z, Math.atan2(gz - z, gx - x), this.traffic); this.rig.inited = false; } catch (e) { /* stay in the auto */ }
        const dd = this.player.dropped && this.player.dropped.find(q => q.veh === this.player.auto);
        if (dd) dd.safe = true;
        this.findAuto = true;
        this.hud.intro?.(this.free);
      }
    }
    this.goFullscreen();
    this.lockMouse && this.lockMouse();
    this.audio.start();
    if (shift && this.police.suspended) { shift = false; this.hud.toast('Licence suspended', 'No fares until it’s back, free roam only. Pay pending challans from the menu.', 'bad', 4); }
    this.rides.setEnabled(shift);
    this.hud.setPlaying(true);
    this.rig.inited = false;
    this.playT0 = this.t;
    if (this.pendingHeat) { const h = this.pendingHeat; this.pendingHeat = 0; this.later(1.5, () => { for (const c of this.pendingCharges || []) this.police.charges.add(c); this.police.raiseHeat(h, 'Still wanted from before', null); }); }
    if (this.saved && !this.welcomed) { this.welcomed = true; this.hud.toast('Welcome back', 'Right where you left off', 'info', 2.6); }
    if (shift) this.hud.toast('Shift started', 'People waving for an auto show up green on the map', 'meter', 3.6);
    // Pune Metro Line 3: news the first week it runs, a heads-up before that
    if (!this._metroNews) {
      this._metroNews = true;
      const pink = TRANSIT_DATA.metro.find(l => l.id === 'pink');
      if (justOpened(pink)) this.later(shift ? 4.5 : 1.2, () => this.hud.toast('Pink Line is open', 'Metro Line 3, Hinjewadi to Shivajinagar. Change at District Court', 'info', 5));
      else if (pink && !lineOpen(pink)) this.later(shift ? 4.5 : 1.2, () => this.hud.toast(`Pink Line opens ${opensOn(pink)}`, 'Metro Line 3, Hinjewadi to Shivajinagar. Test runs on now', 'info', 4));
    }
  }
  endShift() {
    this.togglePause(false);
    if (this.free) this.leaveFree();
    this.state = 'title';
    this.rides.setEnabled(false);
    this.hud.setPlaying(false);
    this.audio.updateEngine(0, 0, false);
    this.saveStats();
  }
  // full screen when you start playing (a click is needed for it). With Esc held by the keyboard
  // lock, Esc reaches the game (closes menus, pauses) instead of throwing you out of full screen.
  goFullscreen() {
    if (this.params.has('test') || this.settings?.fullscreen === false) return;
    const el = document.documentElement;
    if (document.fullscreenElement) return;
    const hint = () => { if (!this._fsHint) { this._fsHint = true; this.hud.toast('Play full screen', /Mac/.test(navigator.platform) ? 'Press Ctrl + Cmd + F' : 'Press F11', 'info', 4); } };
    if (!el.requestFullscreen) return hint();
    el.requestFullscreen({ navigationUI: 'hide' }).then(() => { navigator.keyboard?.lock?.(['Escape']).catch(() => {}); }).catch(hint);
  }
  // close whatever list is open (shop, trial room, conversation, jhola, club card)
  closeMenus() {
    if (this.date && this.date.cur) this.date.close();
    if (this.trial && this.trial.open) this.trial.close();
    if (this.shops && this.shops.open) this.shops.close();
    if (this.bag && this.bag.open) this.bag.close();
    if (this.club && this.club.on) this.club.leave();
    if (this.transit && this.transit.open) this.transit.close();
    if (this.state === 'shop') this.state = 'play';
  }
  lightHour() {
    const I = this.interiors;
    if (I && I.inside) return 12.5;                // lit inside, whatever the hour outside
    return this.hour;
  }
  togglePause(force) {
    const to = force !== undefined ? force : this.state !== 'pause';
    if (to && this.state === 'play') { this._pausedAt = performance.now(); this.state = 'pause'; this.pauseFrames = 0; this.renderer.domElement.classList.add('paused'); this.hud.setLockHint?.(false); this.hud.pause.hidden = false; this.hud.syncPause(); this.audio.updateEngine(0, 0, false); this.audio.playerHorn(false); this.audio.hush(true); }
    else if (!to && this.state === 'pause') {
      this.state = 'play'; this._resumeT = performance.now(); this.livePause = false; this.hud.pause.hidden = true; this.audio.hush(false); this.renderer.domElement.classList.remove('paused');
      try { this.lockMouse?.(); } catch (e) { /* the next click takes the mouse */ }
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    }
  }
  toggleMap(force) {
    const to = force !== undefined ? force : this.hud.bigmap.hidden;
    if (to && this.state === 'play') { this.state = 'map'; this.hud.mapScreen.open(); this.audio.updateEngine(0, 0, false); this.audio.hush(true); }
    else if (!to && this.state === 'map') { this.state = 'play'; this.hud.mapScreen.close(); this.audio.hush(false); }
  }
  // take a rickshaw: someone else's auto drives you there (the ride is skipped). Pune RTA meter:
  // ₹30 for the first 1.5 km, ₹20 a km after (RTA, from 1 Sept 2026), 25% more from midnight to 5,
  // by road (~1.3x the straight line), no cap. You arrive on foot; your own auto stays where it was.
  fastTravelCost(x, z) {
    const km = Math.hypot(x - this.player.x, z - this.player.z) * 1.3 / 1000;
    return Math.round(fareFor(km * 1000, this.hour));
  }
  fastTravelBlock() {
    if (this.police && this.police.heat > 0) return 'Not while the police are after you';
    if (this.rides && this.rides.current) return 'Finish the ride first';
    if (this.player.tipped) return 'Get back on your wheels first';
    return '';
  }
  fastTravel(x, z, name) {
    const why = this.fastTravelBlock();
    if (why) { this.hud.toast('No rickshaw right now', why, 'warn', 2.6); return false; }
    const cost = this.fastTravelCost(x, z);
    if (this.stats.money < cost) { this.hud.toast('Not enough money', `The meter says ₹${cost}`, 'warn', 2.6); return false; }
    // all of Pune: the streets over there are fetched and built first, behind a black screen
    if (this.W.tiles && !this._arriving) {
      this._arriving = true; this.toggleMap(false); const was = this.state; this.state = 'shop';
      const km = Math.hypot(x - this.player.x, z - this.player.z) * 1.3 / 1000;
      this.hud.curtain(true, name ? `Rickshaw to ${name}` : 'Taking a rickshaw', km);
      // never stuck behind the black screen: whatever happens, you arrive (15 s at the most)
      const go = Promise.race([this.W.tiles.ensure(x, z, 650, (f) => this.hud.curtainProgress(f)), new Promise(r => setTimeout(r, 15000))]);
      go.catch(() => {}).then(() => {
        this.hud.curtainProgress(1);
        this.state = 'play';
        try { this.fastTravel(x, z, name); } catch (e) { console.warn('arrive', e); }
      }).finally(() => { this._arriving = false; setTimeout(() => this.hud.curtain(false), 300); });
      return true;
    }
    const spot = this.safeDrop(x, z);
    if (!spot) { this.hud.toast('No rickshaw goes there', 'No road near that spot', 'warn', 2.4); return false; }
    const e = spot.e;
    const P = this.player;
    // dropped at the kerb, on foot; whatever you were driving stays parked where you left it
    P.teleportFoot(spot.x, spot.z, spot.th, this.traffic);
    this.stats.money -= cost; this.saveStats();
    this.setWaypoint(null);
    this.W.streamer.warm(P.x, P.z, Math.min(260, this.quality.streamRadius || 260));
    this.traffic.prefill(P.x, P.z);
    this.toggleMap(false);
    this.hud.flash(name || 'Here you are', `Rickshaw fare ₹${cost} · ${this.W.graph.names[e.name] ? this.W.graph.names[e.name][0] : ''} · your auto is marked on the map`);
    return true;
  }
  // somewhere you can actually stand: on a public road's footpath or kerb, never inside a building,
  // a wall, the river or a compound, and with room to walk away. Falls back to the road itself.
  safeDrop(x, z) {
    const G = this.W.graph, S = this.W.surf, C = this.W.collision;
    const clear = (px, pz) => {
      if (S.inBuilding(px, pz) || S.isWater(px, pz) || C.resolve(px, pz, 0.55)) return false;
      // room to move: at least three of four directions 1.5 m away are open too
      let open = 0;
      for (const [dx, dz] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (!S.inBuilding(px + dx, pz + dz) && !C.resolve(px + dx, pz + dz, 0.4)) open++;
      return open >= 3;
    };
    const cands = [];
    for (const e of G.gridQuery(x, z, 320)) {
      if (e.rank < 1 || e.restricted || e.bridge) continue;
      const n = G.nearest(x, z, 400, q => q === e);
      if (n) cands.push([n.d + (e.rank < 2 ? 25 : 0), e, n.s]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (const [, e, s0] of cands.slice(0, 30)) {
      for (const ds of [0, 6, -6, 12, -12, 20, -20, 32, -32]) {
        const s = Math.max(1, Math.min(e.len - 1, s0 + ds));
        const t = G.at(e, s), th = Math.atan2(t[3], t[2]);
        for (const side of [1, -1]) for (const off of [e.w / 2 + Math.max(0.8, e.sw / 2), e.w / 2 + 0.45]) {
          const px = t[0] + t[3] * off * side, pz = t[1] - t[2] * off * side;
          if (clear(px, pz)) return { x: px, z: pz, th: th + Math.PI / 2 * side, e };
        }
      }
    }
    // last resort: the edge of the carriageway of the nearest proper road
    const near = G.nearest(x, z, 600, e => e.rank >= 2 && !e.restricted) || G.nearest(x, z, 900);
    if (!near) return null;
    const e = near.e, t = G.at(e, near.s), lat = e.w / 2 - 0.8;
    return { x: t[0] + t[3] * lat, z: t[1] - t[2] * lat, th: Math.atan2(t[3], t[2]), e };
  }
  // waypoint + GPS: a blue route along the road graph, refreshed as you drive
  setWaypoint(wp) {
    this.waypoint = wp;
    if (!wp && this.beacon) this.beacon.visible = false;
    this.nav = wp ? { pts: null, left: Math.hypot(wp.x - this.player.x, wp.z - this.player.z), t: 0 } : null;
    if (wp && !wp.gig) this.hud.toast('Waypoint set', wp.name || '', 'info', 2.5);
    if (this.hud.mapScreen && this.hud.mapScreen.sel) this.hud.mapScreen.renderCard();
  }
  updateNav(dt) {
    const wp = this.waypoint, nav = this.nav;
    if (!wp || !nav) return;
    const P = this.player, d = Math.hypot(wp.x - P.x, wp.z - P.z);
    this.beacon.visible = true; this.beacon.position.set(wp.x, 0, wp.z);
    this.beacon.material.uniforms.uA.value = Math.min(1, Math.max(0.15, (d - 20) / 120)) * 0.55;
    if (d < 28 && !wp.gig) { this.hud.toast('Arrived', wp.name || '', 'good', 3); this.setWaypoint(null); return; }
    nav.t -= dt;
    if (nav.t > 0) return;
    nav.t = 1.5;
    const G = this.W.graph;
    const from = G.nearest(P.x, P.z, 80), to = G.nearest(wp.x, wp.z, 250);
    if (!from || !to) { nav.pts = null; nav.left = d; return; }
    const r = G.route(from, to, false) || G.route(from, to, true);
    if (!r) { nav.pts = null; nav.left = d; return; }
    nav.pts = G.routePolyline(r, from, to);
    nav.pts.push(wp.x, wp.z);
    nav.left = r.cost + from.d;
  }
  setHour(h) { this.hour = h; }
  setQuality(name, auto = false) {
    const Q = this.QUALITY[name];
    if (!Q) return;
    if (!auto) {
      this.userQuality = true;
      const st = safeStorage();
      if (st) try { st.setItem('nh48_quality', name); } catch (e) { /* ignore */ }
    }
    this.qualityName = name;
    this.perf.pr = Math.min(window.devicePixelRatio || 1, Q.pixelRatio);
    this.applyPixelRatio(this.perf.pr);
    this.W.streamer.setRadius(Q.streamRadius);
    this.traffic.max = Q.traffic; this.people.max = Math.min(Q.peds, this.people.cap - 120);
    if (this.crowd) this.crowd.setQuality(Q);
    if (Q.shadows !== this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = Q.shadows;
      this.sky.setShadows(Q.shadows, Q.shadowSize || 1024);
      this.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => (m.needsUpdate = true)); });
    }
    this.qualityNote = Q.texMax !== this.quality.texMax || Q.msaa !== this.quality.msaa ? 'Some changes (textures, edge smoothing) apply after you reload the page.' : '';
  }
  applyPixelRatio(pr) {
    this.renderer.setPixelRatio(pr);
    if (this.post) this.post.setSize(window.innerWidth, window.innerHeight); else this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  // passed out (beaten, starved, dehydrated, run over): you wake up in the nearest hospital with a bill
  blackout(cause, robbed = 0) {
    const P = this.player, L = this.life;
    if (this._blacking) return;
    this._blacking = true;
    P.ko = true; P.downT = 4;
    if (P.human) P.human.play('death', { once: true, fade: 0.1 });
    if (this.interiors.inside) this.interiors.exit();
    if (!P.onFoot) P.exit(this.traffic, true);
    const why = { beaten: 'You were beaten unconscious', hunger: 'You collapsed from hunger', thirst: 'You collapsed from dehydration', hit: 'You were run over' }[cause] || 'You passed out';
    this.hud.flash('बेशुद्ध · Out cold', why);
    this.audio.thud(0.6);
    this.later(3.2, () => {
      // the nearest hospital: a government one costs little, a private one a lot
      let best = null, bd = 1e12;
      for (const p of this.W.M.places || []) if (p[2] === 'hospital') { const x = p[3] / 100, z = p[4] / 100, d = (x - P.x) ** 2 + (z - P.z) ** 2; if (d < bd) { bd = d; best = { name: p[0], x, z }; } }
      const govt = best && /sassoon|kamala nehru|government|municipal|civil|ESI|cantonment/i.test(best.name);
      const bill = (govt ? 600 : 3500) + (cause === 'beaten' || cause === 'hit' ? 1500 : 0);
      const spot = best ? this.safeDrop(best.x, best.z) : null;
      if (spot) P.teleportFoot(spot.x, spot.z, spot.th, this.traffic);
      const fromCash = Math.min(this.stats.money, bill), rest = bill - fromCash;
      this.stats.money -= fromCash;
      const fromBank = Math.min(L.s.bank, rest); L.s.bank -= fromBank;
      this.saveStats();
      const hours = 6; this.hour = (this.hour + hours) % 24; this.clock += hours;
      P.ko = false; P.downT = 0; P.hp = L.hpMax * 0.7; P.hurtT = 0;
      L.s.hunger = Math.max(L.s.hunger, 0.5); L.s.thirst = Math.max(L.s.thirst, 0.55); L.s.energy = Math.max(L.s.energy, 0.5); L.s.drunk = 0;
      L.s.tally.knockedOut++; L.change('mood', -0.1);
      if ((cause === 'beaten' || robbed) && this.rng.chance(0.7)) this.lights.lose('Lost while you were out cold');
      if (P.human) P.human.play('idle', { fade: 0.3 });
      this.rig.footMode = false;
      this.date && this.date.event('hosp', bill);
      this.hud.toast(`Discharged from ${best ? best.name : 'hospital'}`, `Hospital bill ₹${bill.toLocaleString('en-IN')}${fromBank ? ' (part from your bank)' : ''}${robbed ? ` · ₹${robbed} was taken from your wallet` : ''} · ${hours} hours later`, 'bad', 6);
      this._blacking = false;
    });
  }
  // sleep at home or a lodge: wake at 7 AM rested
  sleep() {
    const L = this.life, P = this.player;
    const to = 7, h = this.hour, dh = ((to - h) + 24) % 24 || 24;
    this.hour = to; this.clock += dh;
    L.apply({ energy: 1, mood: 0.1, hunger: -0.15, thirst: -0.2 }); L.s.drunk = 0;
    P.hp = L.hpMax;
    this.hud.flash('Good morning', `You slept ${Math.round(dh)} hours. 7:00 AM, fully rested.`);
  }
  // what you've done to your auto at the garage
  applyUpgrades() {
    const U = this.life.s.upg, A = this.player.auto;
    A.tune = 1 + (U.engine || 0) * 0.08;
    if (A.setSticker) A.setSticker(U.sticker || 0);
  }
  baseLook() { return this.origLook; }
  // Start over: wipe all progress (with the warning shown in the pause menu) and reload fresh
  resetAll() {
    // only your progress goes (settings, quality, downloads stay); and nothing may write it back on the way
    // out: the wipe runs again first thing on the next load, before anything reads your save
    this.state = 'resetting';
    try { sessionStorage.setItem('nh48_wipe', '1'); } catch (e) { /* ignore */ }
    Save.wipe();
    const st = safeStorage();
    if (st) { const set = st.setItem.bind(st); st.setItem = (k, v) => { if (!Save.PROGRESS_KEYS.includes(k)) set(k, v); }; }
    location.reload();
  }
  saveStats() {
    if (this.free) return;                   // free roam never touches your story game
    const st = safeStorage();
    if (st) try { st.setItem('nh48_stats', JSON.stringify({ money: this.stats.money, rides: this.stats.rides, starSum: this.stats.starSum, rating: this.stats.rating, grant: 2 })); } catch (e) { /* ignore */ }
  }

  objective() {
    const r = this.rides, P = this.player;
    if (P.tipped) return { main: 'Auto tipped over!', sub: 'Hold on… getting it back on three wheels', urgent: true };
    const so = this.story && this.story.objective();
    if (so && !(r.current && r.current.state === 'onboard')) return so;
    const hj = this.hustle && this.hustle.objective();
    if (hj) return hj;
    const gj = this.gigs && this.gigs.objective();
    if (gj && !(r.current)) return gj;
    const veh = !P.onFoot ? P.cur : null;
    if (veh && veh.fuel !== undefined && veh.fuel <= 0) return { main: 'Out of fuel', sub: 'Crawl to a pump (on the map), or call roadside help from the backpack', urgent: true };
    // free roam: a short hint at the start, then a clean screen
    if (!r.enabled) return this.t - (this.playT0 || 0) < 6 ? { main: this.free ? 'Free roam' : 'Pune', sub: this.free ? 'No cops, unlimited cash · [ ] time of day · M to go anywhere' : 'Esc for menu · M for map' } : { main: '', sub: '' };
    const c = r.current;
    if (c && c.state === 'boarding') return { main: `${c.name} is getting in…`, sub: '' };
    if (c && c.state === 'onboard') {
      const d = Math.hypot((c.dropX ?? c.dest.x) - P.x, (c.dropZ ?? c.dest.z) - P.z);
      const left = Math.max(0, c.limit - c.elapsed);
      return { main: `Drop at ${c.dest.name}`, sub: `${d > 950 ? (d / 1000).toFixed(1) + ' km' : Math.round(d / 10) * 10 + ' m'} away · ${left > 0 ? Math.ceil(left) + ' s left for a tip' : 'running late'}`, urgent: left <= 0 };
    }
    const n = r.offers.length;
    if (!n) return { main: 'Looking for passengers…', sub: 'Keep driving' };
    let near = Infinity;
    for (const o of r.offers) near = Math.min(near, Math.hypot(o.p.x - P.x, o.p.z - P.z));
    return { main: `${n} ${n === 1 ? 'person is' : 'people are'} waving for an auto`, sub: `Nearest ${Math.round(near / 10) * 10} m · stop next to them to pick up` };
  }

  // ---------------------------------------------------------------- simulation
  fixed(dt) {
    if (this.state !== 'play') return;
    const inp = this.input.poll(dt);
    if (this.params.has('test')) {
      const tt = this.t, T = this.test;
      const d0 = T.foot ? T.foot + 0.4 : 0;           // driving starts after the on-foot part
      const driving = tt >= d0 && tt < d0 + T.drive;
      inp.throttle = driving ? 1 : 0;
      inp.brake = tt > T.brakeAfter ? 1 : 0;
      inp.steer = driving ? T.steer : 0;
      if (T.foot) this.testFoot(tt);
      if (this.params.get('police')) this.testPolice(tt);
    }
    // a police stop holds you in place
    if (this.police.holding()) { inp.throttle = 0; inp.brake = Math.abs(this.player.v) > 0.5 ? 1 : 0; inp.steer = 0; inp.handbrake = true; inp.horn = false; }
    // a few drinks in, the steering wanders
    const dr = this.life ? this.life.s.drunk : 0;
    if (dr > 0.4 && !this.player.onFoot) { this._wob = (this._wob || 0) + dt; inp.steer = Math.max(-1, Math.min(1, inp.steer + Math.sin(this._wob * 1.3) * Math.sin(this._wob * 0.37) * (dr - 0.4) * 0.6)); }
    // C: on foot it's a roll, in a vehicle it changes the camera (V always does)
    if (this.state === 'play' && !this.player.onFoot && this.input.took('KeyC')) this.rig.setMode(this.rig.mode + 1);
    if (this.state === 'play') this.brawl.update(dt, this.input);
    this.player.update(dt, inp, this.traffic, this.input, this.rig.footMode ? this.rig.footYaw : undefined);
    this.t += dt;
    this.handleEvents();
  }
  // test script: hop out, walk forward, then take a vehicle (parked / traffic / auto)
  testFoot(tt) {
    const T = this.test, P = this.player;
    if (tt > 0.2 && !this._footOut) { this._footOut = true; P.exit(this.traffic); }
    if (tt > 0.2 && tt < T.foot) this.input.keys.add('KeyW'); else this.input.keys.delete('KeyW');
    if (!T.take || this._took || tt < T.foot) return;
    this._took = true;
    let offer = null;
    if (T.take === 'parked') {
      let best = null, bd = this.params.get('kind') ? 400 : 80;
      for (const r of this.W.parkedList || []) { const d = Math.hypot(r.x - P.x, r.z - P.z); if (d < bd && !r.taken && (!this.params.get('kind') || r.kind === this.params.get('kind'))) { bd = d; best = r; } }
      if (best) offer = { kind: 'parked', r: best };
    } else if (T.take === 'traffic') {
      let best = null, bd = 80;
      for (const o of this.traffic.list) { if (!o.T || o.isPlayer) continue; const d = Math.hypot(o.x - P.x, o.z - P.z); if (d < bd) { bd = d; best = o; } }
      if (best) { best.v = 0; offer = { kind: 'traffic', o: best }; }
    } else offer = P.offer;
    if (offer) {
      const tx = offer.r ? offer.r.x : offer.o ? offer.o.x : P.x, tz = offer.r ? offer.r.z : offer.o ? offer.o.z : P.z;
      P.foot.x = tx + 1.5; P.foot.z = tz;
      P.enter(offer, this.traffic);
    }
    console.log('test take', T.take, offer ? offer.kind : 'none', P.vehicleLabel());
  }
  // test script for the police: ?police=stop&pick=1  or  ?police=heat
  testPolice(tt) {
    const mode = this.params.get('police'), pol = this.police, P = this.player;
    if (tt > 0.3 && !this._polT) {
      this._polT = 1;
      if (mode === 'stop') {
        let best = null, bd = 1e9;
        for (const c of pol.cops) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d < bd) { bd = d; best = c; } }
        const sp = pol.kerbSpot(best.x, best.z);
        P.reset(sp.x, sp.z, sp.th);
        pol.beginStop(best, this.params.get('kind') || 'signal', {});
        console.log('test stop with', best.name, 'dist', bd.toFixed(0));
      } else if (mode === 'heat') { pol.raiseHeat(+(this.params.get('lvl') || 2), 'test'); }
      else if (mode === 'echallan') { pol.offence('signal', P.x, P.z, { cop: false, camChance: 1, how: 'signal camera' }); pol.addDue('signal', 1500, 'test'); }
    }
    if (mode === 'heat' && Math.floor(tt) !== Math.floor(tt - 1 / 60)) {
      console.log('t', tt.toFixed(0), 'heat', pol.heat, pol.marshals.map(m => `d=${Math.hypot(m.veh.x - P.x, m.veh.z - P.z).toFixed(0)} v=${m.veh.v.toFixed(1)} sees=${m.sees} route=${m.route ? m.route.length / 2 : 0} stuck=${m.stuckT.toFixed(1)} hit=${m.lastHit || '-'} at=${m.veh.x.toFixed(0)},${m.veh.z.toFixed(0)} foot=${m.veh.onFootpath}`).join(' | '));
    }
    const pick = parseInt(this.params.get('pick') || '0');
    if (pick && pol.stop && pol.stop.phase === 'talk' && pol.stop.t > 1.5) pol.choose(pick - 1);
  }
  handleEvents() {
    const P = this.player;
    const evs = [...this.player.events, ...this.people.events];
    this.people.events.length = 0;
    for (const ev of evs) {
      if (ev.type === 'crash') {
        this.rig.shake(Math.min(0.5, ev.speed * 0.06)); this.audio.crash(Math.min(1, ev.speed / 8));
        if (!P.onFoot && ev.speed > 3) { const v = P.cur; v.dmg = Math.min(1, (v.dmg || 0) + (ev.speed - 3) * 0.006); if (v.dmg > 0.6 && !this._dmgWarn) { this._dmgWarn = true; this.date && this.date.event('crash'); this.hud.toast('Your vehicle is badly damaged', 'It’s slower now. Any garage can fix it', 'warn', 3.4); } if (v.dmg < 0.3) this._dmgWarn = false; }
        if (ev.kind === 3) this.hud.toast('End of the shift area', 'Turn back, the map ends here', 'warn', 2);
      }
      if (ev.type === 'scrape') this.audio.thud(0.15);
      if (ev.type === 'bark' || ev.type === 'dogChase') { const d = Math.hypot(ev.x - P.x, ev.z - P.z); if (d < 60) this.audio.bark(Math.min(0.9, 12 / (d + 6))); }
      if (ev.type === 'dogChase' && (this._dogT || 0) < this.t) { this._dogT = this.t + 30; this.hud.toast('A street dog is chasing you', 'Classic. Keep going, it’ll give up.', 'info', 2.4); }
      if (ev.type === 'bump') { this.rig.shake(Math.min(0.25, ev.strength * 0.03)); this.audio.thud(Math.min(0.6, ev.strength * 0.12)); }
      if (ev.type === 'tip') { this.rig.shake(0.5); this.audio.crash(0.8); this.hud.toast('Auto tipped over!', 'Corner slower, autos lift a wheel easily', 'warn', 3); }
      if (ev.type === 'hit') { this.audio.crash(Math.min(1, ev.speed / 6)); }
      if (ev.type === 'knock') { this.audio.crash(0.7); this.hud.toast('You knocked over a two-wheeler', 'They’re fine. Very, very angry, but fine.', 'warn', 2.6); }
      if (ev.type === 'pedHit') { this.audio.thud(0.4); this.hud.toast('Watch the pedestrians!', 'They’re fine, just furious', 'warn', 2.4); this.stats.money = Math.max(0, this.stats.money - 50); }
      if (ev.type === 'dodge') { if (this.rng.chance(0.35) && (this._dodgeT || 0) < this.t) { this._dodgeT = this.t + 4; if (!(ev.p && this.people.speakAs('dodge', ev.p, 1, 4))) this.police.say(this.rng.pick(['d1', 'd2', 'd3', 'd4']), ev); } }
      if (ev.type === 'recovered') this.hud.toast('Back on three wheels', '', 'info', 1.6);
      if ((ev.type === 'jump' && this.rng.chance(0.3)) || ev.type === 'climb') this.people.onStunt(P);
      if (ev.type === 'gotHit') { P.hp = (P.hp ?? 100) - Math.min(60, 10 + (ev.speed || 4) * 4); if (P.hp <= 0) { this.blackout('hit'); continue; } this.audio.thud(0.6); this.rig.shake(0.4); this.hud.toast('Knocked down', 'Traffic doesn\u2019t stop for pedestrians here. Stay on the footpath.', 'bad', 3); }
      if (ev.type === 'carjack') { this.audio.crash(0.2); this.life.change('karma', -3); }
      if (ev.type === 'stoleParked') this.life.change('karma', -2);
      if (ev.type === 'pedHit') this.life.change('karma', -2);
      if (ev.type === 'exit' && this.state === 'play' && (this._parkHintT || 0) < this.t && this.W.surf.isRoad(P.cur.x, P.cur.z)) {
        const near = this.W.graph.nearest(P.cur.x, P.cur.z, 12);
        if (near && near.e.rank >= 4) { this._parkHintT = this.t + 120; this.hud.toast('No parking on main roads', 'Pune’s tow vans are quick. Side lanes are safer.', 'warn', 3.2); }
      }
      if (ev.type === 'enter' && ev.vehicle && this.state === 'play') { const S = this.player.spec; if (S) this.hud.toast(S.name, `${S.model} \u00b7 top speed ~${Math.round(S.vTop * 3.6 * 0.9)} km/h`, 'info', 2.4); }
      if (this.rides) this.rides.onEvent(ev);
      this.police.onEvent(ev);
      // accidents draw a crowd
      if (ev.type === 'pedHit' || ev.type === 'knock' || ev.type === 'gotHit' || ev.type === 'pedBumped' || (ev.type === 'crash' && ev.speed > 6 && ev.kind !== 3)) {
        if ((this._gatherT || 0) < this.t) { this._gatherT = this.t + 8; this.people.gather(ev.x ?? P.x, ev.z ?? P.z, ev.type === 'crash' ? 3 : 5); }
      }
    }
  }

  frame(dt) {
    const P = this.player;
    if (this.state === 'photo') this.photo.update(dt);
    this.autoMarkerTick(dt);
    if (this.state === 'play') { this.hour = (this.hour + dt * this.timeScale) % 24; this.clock += dt * this.timeScale; }
    // shop panels, the jhola and conversations keep the mouse (they're all number keys and arrows);
    // the pause menu, the map and the title get the cursor
    if (this.state === 'shop') this._menuT = performance.now();
    else if (this.state !== 'play' && document.pointerLockElement && this.releaseMouse) this.releaseMouse();
    if ((this._lhT = (this._lhT || 0) - dt) <= 0) { this._lhT = 0.5; this.hud.setLockHint?.(this.state === 'play' && !document.pointerLockElement && !this.params.has('test')); }
    // never left floating outside the city (a room you didn't get out of properly, an old save)
    if (this.state === 'play' && this.player.onFoot && !this.interiors.inside && Math.abs(this.player.x) > 30000) { const A = this.player.auto, sp = this.safeDrop(A.x, A.z); if (sp) this.player.teleportFoot(sp.x, sp.z, sp.th, this.traffic); this.rig.footMode = false; }
    const live = this.state === 'play' || this.state === 'title';
    if (live) {
      this.W.activity.setHour(this.hour);
      this.traffic.hour = this.hour;
      this.traffic.cam.copy(this.camera.position);
      // inside a shop the street outside waits for you (the room has its own people)
      if (!this.interiors.inside) {
        this.traffic.update(Math.min(dt, 0.05), P.x, P.z, this.inView);
        this.people.hour = this.hour;
        this.people.update(Math.min(dt, 0.05), P, this.inView);
      }
    }
    if (this.state === 'play') {
      // the shift is on whenever you're driving an auto (yours or one you took), off when you get out
      const want = P.inAnyAuto && !this.police.suspended && !this.params.has('noshift');
      if (want !== this.rides.enabled && !(this.rides.current && this.rides.current.state === 'onboard')) {
        this.rides.setEnabled(want);
        this.hud.setMode();
        if (want && this.t - (this.shiftToastT ?? -99) > 30) { this.shiftToastT = this.t; this.hud.toast('On shift', 'People waving for an auto show up green on the map', 'meter', 3); }
      }
      this.rides.update(dt);
      this.police.update(dt);
      this.tickTimers(dt);
      this.life.update(dt);
      this.shops.update(dt);
      this.wada.update(dt);
      this.gigs.update(dt, this.input);
      this.hustle.update(dt, this.input);
      this.strays.update(dt);
      this.eggs.update(dt);
      this.story.update(dt);
      this.rig.drunk = this.life.s.drunk;
      if (this.post) this.post.drunk = this.interiors.inside && this.interiors.cur.R.tpl === 'club' ? Math.min(this.life.s.drunk, 0.5) : this.life.s.drunk;
      this.hud.lowHealth?.((P.hp ?? 100) / this.life.hpMax);
      // driving drunk: the next cop who sees you pulls you over (₹10,000, MV Act s.185)
      if (!P.onFoot && this.life.s.drunk > 0.45 && Math.abs(P.v) > 3 && !this.police.stop && (this._drunkChk = (this._drunkChk || 0) - dt) <= 0) {
        this._drunkChk = 6;
        if (this.police.copSeeing(P.x, P.z, 35) && this.rng.chance(0.6)) this.police.offence('drunk', P.x, P.z, { how: 'breathalyser', missed: ['Driving after drinks', 'Lucky. Nobody stopped you.'], stopChance: 0.85 });
      }
      // a rental goes back at the end of its day
      for (const d of P.dropped) if (d.veh.owned && d.veh.owned.rental && this.clock > d.veh.owned.until && d.veh !== P.cur) { P.removeDropped(d, this.traffic); d.veh.dispose(); this.hud.toast('Rental returned', 'The travels picked up their scooter', 'info', 2.6); break; }
      this.vehicleWear(dt);
      if (this.input.took('KeyV')) this.rig.setMode(this.rig.mode + 1);
      if (this.input.took('KeyL')) this.lights.toggle();
      this.rig.lookBack = this.input.key('KeyB');
      if (this.input.took('KeyR') && P.tipped === 0 && !P.onFoot) this.backOnRoad();
      if (!this.interiors.inside) this.checkRoad(dt);
      this.interiors.update(dt);
      this.date.update(dt);
      this.approachSt.update(dt);
      this.updateNav(dt);
      this.rig.update(dt, P);
      const S = P.spec;
      const kind = !S ? 'none' : P.inAuto ? 'auto' : S.two ? 'two' : S.L > 6 ? 'bus' : 'car';
      this.audio.updateEngine(P.rpm, P.throttle, kind !== 'none', kind);
      const horn = this.input.state.horn && !P.onFoot;
      this.audio.playerHorn(horn, S ? S.honk : 'auto');
      if (horn) { this.hornScare(); this.police.honked(); if ((this._pedHornT = (this._pedHornT || 0) - dt) <= 0) { this._pedHornT = 0.5; this.people.onHorn(P); } }
      const sl = this.shops.near && this.shops.label();
      if (P.offer && P.onFoot) this.hud.prompt(P.offer.key, P.offer.label, 0.3);
      else if (sl && this.state === 'play') this.hud.prompt('F', sl, 0.3);
      else if (!P.onFoot && Math.abs(P.v) < 1 && this.state === 'play') this.hud.prompt('F', P.inAuto ? 'Get out of the auto' : 'Get off', 0.3);
      this.playHonks();
      this.audio.updateAmbient(Math.min(1, this.traffic.list.length / 100), this.sky.state ? this.sky.state.night : 0, P.inAuto ? Math.abs(P.v) : 0);
    } else if (this.state === 'title') {
      // slow orbit around the auto
      P.setCockpit(false); this.rig.setNear(0.3);
      this.camera.up.set(0, 1, 0);
      const a = performance.now() / 1000 * 0.05 + 2.3;
      const L = this.W.landmarks && this.W.landmarks.find(l => l.id === 'shaniwar');
      if (L && this.wadaIntro) {
        // first launch: a low drone shot drifting across the front of Shaniwar Wada, the Delhi Darwaza and
        // Bajirao's statue in frame, the city behind
        const c = Math.cos(L.rot), sn = Math.sin(L.rot), Pw = (u, v) => [L.x + u * c + v * sn, L.z + u * sn - v * c];
        const t = performance.now() / 1000 * 0.06, sw = Math.sin(t) * 0.75;           // swings 85 degrees side to side
        const [gx, gz] = Pw(2.7, -86), [ox, oz] = Pw(2.7 + Math.sin(sw) * 78, -86 - Math.cos(sw) * 78);
        this.camera.position.set(ox, 21 + Math.sin(t * 0.7) * 3, oz);
        this.camera.lookAt(gx, 9, gz);
      } else {
        const r = 11;
        this.camera.position.set(P.x + Math.cos(a) * r, 3.2 + Math.sin(a * 0.7) * 0.5, P.z + Math.sin(a) * r);
        this.camera.lookAt(P.x - Math.cos(a) * 6, 2.2, P.z - Math.sin(a) * 6);
      }
      if (this.camera.fov !== 50) { this.camera.fov = 50; this.camera.updateProjectionMatrix(); }
      this.traffic.honks.length = 0;
    }
    if (this.state !== 'play') this.input.poll(dt);
    // signals: lamp colours (4 Hz)
    this.timers.sig -= dt;
    if (this.timers.sig <= 0) { this.timers.sig = 0.25; this.updateSignalLamps(); }
    // night lights
    const night = this.sky.state ? this.sky.state.night : 0;
    this.lights.update(dt, night);
    if (this.state === 'play' || this.state === 'shop') this.phone.update(dt);
    if (this.story.talking) this.story.cam(dt);
    if (this.lightPools) { this.lightPools.mesh.visible = night > 0.05; this.lightPools.mesh.material.opacity = night * 0.55; }
    this.people.render(P.x, P.z);
    if (this.crowd) { this.crowd.inView = this.inView; this.crowd.update(dt, this.camera.position.x, this.camera.position.z); }
    if (this.fauna) this.fauna.update(Math.min(dt, 0.05), this.camera.position.x, this.camera.position.z);
    if (this.state === 'play' || this.state === 'pause' || this.state === 'map' || this.state === 'shop') this.hud.update(dt);
    this.input.endFrame();
    this.sanity();
  }
  // a single NaN in the physics or the camera turns the whole frame black for good; catch it and
  // put things back where they last were valid
  sanity() {
    const P = this.player, C = this.camera.position;
    const okP = Number.isFinite(P.x) && Number.isFinite(P.z) && Number.isFinite(P.th);
    if (okP) { (this._good = this._good || {}).x = P.x; this._good.z = P.z; this._good.th = P.th; }
    else if (this._good) { console.warn('player state was invalid; restored'); P.reset(this._good.x, this._good.z, this._good.th); }
    if (!(Number.isFinite(C.x) && Number.isFinite(C.y) && Number.isFinite(C.z))) {
      console.warn('camera was invalid; reset');
      this.rig.inited = false;
      C.set(P.x - 6, 3, P.z);
      this.camera.quaternion.identity();
      this.camera.lookAt(P.x, 1, P.z);
    }
  }

  backOnRoad() {
    const near = this.W.graph.nearest(this.player.x, this.player.z, 120, e => e.rank >= 2);
    if (!near) return;
    const e = near.e;
    const t = this.W.graph.at(e, near.s);
    const lat = e.oneway ? e.w / 2 - 1.6 : 1.6;
    if (this.player.cur && this.player.cur !== this.player.auto) this.player.cur.reset(t[0] + t[3] * lat, t[1] - t[2] * lat, Math.atan2(t[3], t[2]));
    else this.player.reset(t[0] + t[3] * lat, t[1] - t[2] * lat, Math.atan2(t[3], t[2]));
    this.hud.toast('Back on the road', '', 'info', 1.4);
  }

  // is there a road under (x, z) that you may drive along in direction (hx, hz)?
  landmarkAt(x, z) {
    for (const L of this.W.landmarks || []) {
      if (!L.w || !L.d) continue;
      const dx = x - L.x, dz = z - L.z, c = Math.cos(L.rot), s = Math.sin(L.rot);
      const u = dx * c + dz * s, v = dx * s - dz * c;
      if (Math.abs(u) < L.w / 2 + 2 && Math.abs(v) < L.d / 2 + 2) return L;
    }
    return null;
  }
  rightWayHere(x, z, hx, hz) {
    const G = this.W.graph;
    for (const e of G.gridQuery(x, z, 20)) {
      const p = e.pts;
      for (let k = 0; k + 3 < p.length; k += 2) {
        const ax = p[k], az = p[k + 1], dx = p[k + 2] - ax, dz = p[k + 3] - az, L2 = dx * dx + dz * dz || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
        const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
        if (d > e.w / 2 + 0.8) continue;
        if (!e.oneway || (hx * dx + hz * dz) > 0) return true;
      }
    }
    return false;
  }
  // street names, wrong way, red lights
  checkRoad(dt) {
    const P = this.player, G = this.W.graph;
    this.timers.street -= dt; this.timers.wrong -= dt; this.timers.finesCool -= dt;
    if (this.timers.street > 0) return;
    this.timers.street = 0.4;
    // up on a flyover the streets below don't apply (no signals, no wrong way checks against them)
    const veh = !P.onFoot && P.cur, deck = veh && veh.deck >= 0 ? this.W.fly.decks[veh.deck] : null;
    if (deck) { const mr = (this.W.M.names.find(n => n[0] === deck.name) || [])[1]; this.hud.showStreet(mr || 'उड्डाणपूल', deck.name || 'Flyover'); return; }
    // inside a landmark's grounds (Shaniwar Wada's lawns, Aga Khan Palace's garden) its name, not a street's
    const lm = this.landmarkAt(P.x, P.z);
    if (lm) { this.hud.showStreet(LM_MR[lm.id] || lm.name, lm.name); return; }
    const near = G.nearest(P.x, P.z, 14);
    if (!near) return;
    const e = near.e;
    const nm = G.names[e.name];
    if (nm && nm[0]) this.hud.showStreet(nm[1], nm[0]);
    const t = G.at(e, near.s);
    const hx = Math.cos(P.th), hz = Math.sin(P.th);
    const dot = hx * t[2] + hz * t[3];
    // wrong way only if no carriageway under you runs your way (dual carriageways such as North Main
    // Road are two one-way roads side by side; the nearest centreline is often the other one), and only
    // after a few seconds of it
    const wrongNow = e.oneway && dot < -0.5 && P.v > 3 && !P.onFoot && !this.rightWayHere(P.x, P.z, hx, hz);
    this.wrongT = wrongNow ? (this.wrongT || 0) + 0.4 : 0;
    if (wrongNow && this.wrongT >= 2.8 && this.timers.wrong <= 0) {
      this.timers.wrong = 20;
      this.police.offence('wrong', P.x, P.z, { camChance: e.rank >= 4 ? 0.2 : 0, how: 'junction camera', missed: ['Wrong side of a one-way', 'Very Pune. Also very dangerous.'] });
      this.rides.onEvent({ type: 'wrongway' });
    }
    // red light: entering a signalised junction while our approach is red
    for (const nd of [G.nodes[e.a], G.nodes[e.b]]) {
      if (!nd.signal) continue;
      const d = Math.hypot(nd.x - P.x, nd.z - P.z);
      if (d < nd.jr && this.lastJunction !== nd.i) {
        this.lastJunction = nd.i;
        const st = this.traffic.signals.stateForAngle(nd.i, Math.atan2(hz, hx));
        const pol = this.police;
        if (P.v > 3 && !P.onFoot) {
          if (st === 'r') pol.offence('signal', nd.x, nd.z, { camChance: 0.2, how: 'signal camera', missed: ['Jumped a red light', 'Nobody saw. This time.'] });
          else if (st === 'a') {
            // strict officers stop you for amber too, and then you can argue, and be right
            const cop = pol.copSeeing(nd.x, nd.z, 40);
            if (cop && cop.mood < 0.3) pol.offence('signal', nd.x, nd.z, { amber: true, stopChance: 1 });
          }
          // helmet cameras at signals (two-wheelers without a helmet)
          const S = P.spec;
          if (S && S.helmet && P.cur && !P.cur.helmet) pol.offence('helmet', nd.x, nd.z, { camChance: 0.12, how: 'ITMS helmet camera', stopChance: 0.5 });
        }
      }
      if (d > nd.jr + 8 && this.lastJunction === nd.i) this.lastJunction = -1;
    }
  }

  hornScare() {
    // honking makes the vehicles right in front edge aside (sometimes)
    const P = this.player;
    if ((this._hornT = (this._hornT || 0) - 1 / 60) > 0) return;
    this._hornT = 0.4;
    const hx = Math.cos(P.th), hz = Math.sin(P.th);
    this.traffic.near(P.x + hx * 8, P.z + hz * 8, 9, (o) => {
      if (!o.T || o.jc) return;
      const along = (o.x - P.x) * hx + (o.z - P.z) * hz;
      if (along < 0 || along > 18) return;
      if (this.rng.next() < 0.6) {
        const side = -(o.x - P.x) * hz + (o.z - P.z) * hx;
        o.latT = o.lat + (side > 0 ? -1 : 1) * 1.2;
      }
    });
  }
  playHonks() {
    const P = this.player, A = this.audio;
    const hx = Math.cos(P.th), hz = Math.sin(P.th);
    let n = 0;
    for (const h of this.traffic.honks) {
      const dx = h.x - P.x, dz = h.z - P.z, d = Math.hypot(dx, dz);
      if (d > 90 || n > 2) continue;
      const side = (-dx * hz + dz * hx) / (d || 1);
      A.horn(h.kind, Math.min(1, 9 / (d + 6)), side, h.n || 1);
      n++;
    }
    this.traffic.honks.length = 0;
  }

  // ---------------------------------------------------------------- signals & extras
  updateSignalLamps() {
    const heads = this.W.signalHeads, bulbs = this.W.signalBulbs, S = this.traffic.signals;
    if (!heads) return;
    const ON = [[1.0, 0.08, 0.04], [1.0, 0.6, 0.0], [0.15, 1.0, 0.35]];
    const OFF = [[0.18, 0.03, 0.02], [0.16, 0.1, 0.0], [0.02, 0.12, 0.05]];
    for (const h of heads) {
      const st = S.stateForAngle(h.node, Math.atan2(-h.dz, -h.dx)) || 'g';
      const lit = st === 'r' ? 0 : st === 'a' ? 1 : 2;
      for (let k = 0; k < 3; k++) {
        const c = k === lit ? ON[k] : OFF[k];
        bulbs.instanceColor.setXYZ(h.bulbs[k], c[0], c[1], c[2]);
      }
    }
    bulbs.instanceColor.needsUpdate = true;
  }
  placeCops() {
    this.cops = [];
    const heads = this.W.signalHeads || [];
    const used = new Set();
    const S = this.W.surf, C = this.W.collision, G = this.W.graph;
    for (const h of heads) {
      // one in five signalised junctions, and only the busier ones (not every signal has a cop)
      if (used.has(h.node) || this.rng.next() > 0.2) continue;
      const nd = G.nodes[h.node];
      if (nd && (nd.out.length + nd.inc.length) < 3) continue;
      used.add(h.node);
      // beside the signal pole on the footpath, never inside it or out in the traffic
      let best = null;
      for (let k = 0; k < 12 && !best; k++) {
        const a = Math.atan2(-h.dz, -h.dx) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.55, r = k < 6 ? 1.1 : 1.6;
        const x = h.x + Math.cos(a) * r, z = h.z + Math.sin(a) * r;
        if (!S.isRoad(x, z) && !C.resolve(x, z, 0.35) && !S.inBuilding(x, z)) best = { x, z };
      }
      if (!best) continue;
      this.cops.push({ x: best.x, z: best.z, fx: nd ? nd.x : h.x + h.dx * 8, fz: nd ? nd.z : h.z + h.dz * 8 });
    }
    this.people.addCops(this.cops, heads);
  }
  buildLightPools() {
    const pos = this.W.lampPositions || [];
    if (!pos.length) return;
    const tex = this.W.tex.decal;
    const uv = this.W.decalUV(6);
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const uva = g.attributes.uv;
    for (let i = 0; i < uva.count; i++) uva.setXY(i, uv[0] + uva.getX(i) * uv[2], uv[1] + uva.getY(i) * uv[2]);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffe0a8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const mesh = new THREE.InstancedMesh(g, mat, pos.length);
    const m = new THREE.Matrix4();
    pos.forEach(([x, z], i) => { m.makeScale(11, 1, 11); m.setPosition(x, 0.05, z); mesh.setMatrixAt(i, m); });
    mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
    this.scene.add(mesh);
    this.lightPools = { mesh };
  }

  // adaptive resolution for weak GPUs
  afterRender(dt) {
    if (this.state !== 'play' || this.params.has('test')) return;
    const p = this.perf;
    p.acc += dt; p.n++;
    if (p.acc >= 2) {
      const fps = p.n / p.acc;
      p.acc = 0; p.n = 0;
      if (fps < 45) p.slow++; else p.slow = 0;
      if (fps > 57) p.fast++; else p.fast = 0;
      const maxPr = Math.min(window.devicePixelRatio || 1, this.QUALITY[this.qualityName].pixelRatio);
      // never below the screen's own resolution (1.0): below that every sign, plate and shop board
      // smears. Slow machines lose shadows, grass and range instead (the preset step below).
      const floor = this.qualityName === 'lite' ? 0.6 : Math.min(1, window.devicePixelRatio || 1);
      if (p.slow >= 1 && p.pr > floor) { p.pr = Math.max(floor, p.pr - (fps < 30 ? 0.15 : 0.08)); this.applyPixelRatio(p.pr); p.slow = 0; }
      else if (p.fast >= 3 && p.pr < maxPr) { p.pr = Math.min(maxPr, p.pr + 0.08); this.applyPixelRatio(p.pr); p.fast = 0; }
      // still struggling at the lowest resolution: step the graphics preset down once per level
      // (only when the player hasn't picked a preset themselves)
      p.floor = (p.pr <= floor + 0.01 && fps < 30) ? (p.floor || 0) + 1 : 0;
      if (p.floor >= 2 && !this.userQuality && this.qualityName !== 'lite') {
        p.floor = 0;
        const next = { high: 'med', med: 'low', low: 'lite' }[this.qualityName] || 'lite';
        this.setQuality(next, true);
        p.pr = Math.min(window.devicePixelRatio || 1, this.QUALITY[next].pixelRatio);
        this.applyPixelRatio(p.pr);
        this.hud.toast('Graphics lowered', 'Switched to ' + ({ med: 'Medium', low: 'Low', lite: 'Lite' }[next]) + ' for smoother driving · change it in the menu', 'info', 3);
      }
    }
  }
  testDone(frames) {
    const need = Math.max(this.test.frames, Math.ceil((this.test.drive + this.test.foot + 0.5) * 30));
    return frames >= need && (frames === need || frames % 30 === 0);
  }
  testInfo() { const P = this.player, pol = this.police; return { hour: +this.hour.toFixed(2), state: this.state, peds: this.people.list.length, offers: this.rides.offers.length, mode: P.mode, offer: P.offer && P.offer.label, veh: P.vehicleLabel && P.vehicleLabel(), heat: pol.heat, dues: pol.duesTotal, stop: pol.stop && pol.stop.phase, marshals: pol.marshals.length,
    crowd: this.crowd ? { pool: this.crowd.pool.length, used: this.crowd.pool.filter(s => s.p).length, vis: this.crowd.pool.filter(s => s.p && s.H.holder.visible).map(s => [+(s.H.holder.position.x - P.x).toFixed(1), +(s.H.holder.position.z - P.z).toFixed(1), s.p.mode]) } : null,
    near: this.people.list.map(p => Math.hypot(p.x - P.x, p.z - P.z)).sort((a, b) => a - b).slice(0, 6).map(d => +d.toFixed(0)),
    modes: this.people.list.reduce((m, p) => (m[p.mode] = (m[p.mode] || 0) + 1, m), {}) }; }
}
