// Game flow: title → shift (rides) or free roam; per-frame updates; events → feedback;
// signals, challans, street names; pause/map/settings; adaptive resolution.
import * as THREE from 'three';
import { clamp, lerp, RNG, safeStorage, wrapAngle, damp } from '../core/util.js';
import { HUD } from '../ui/hud.js';
import { CityMap } from '../ui/map.js';
import { SW } from '../world/landmarks.js';

const Y_UP = new THREE.Vector3(0, 1, 0), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _ax = new THREE.Vector3();
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
import { Shops, lookFromJSON, DEALER, openNow } from './shops.js';
import { Props } from './props.js';
import { Gigs } from './gigs.js';
import { Hustle } from './hustle.js';
import { Transit } from './transit.js';
import { PhotoMode } from './photo.js';
import { Wada } from './wada.js';
import TRANSIT_DATA from './transit.json';
import VLINES from './vendor_lines.json';
import { Rep } from '../people/rep.js';
import { Blood } from '../gfx/blood.js';
import { Duty } from './duty.js';
import { buildAmbulance, buildPoliceJeep } from '../vehicles/emodels.js';
import { Vehicle, specOf, makeService, knock } from '../vehicles/vehicle.js';
import FAMOUS from '../world/famous.json';
import { VoiceBank } from './voicebank.js';
import { ikArm, bendBone } from '../people/humans.js';
const _cufT = new THREE.Vector3(), _cufP = new THREE.Vector3();
import { justOpened, lineOpen, opensOn } from './metroOpen.js';
import { Club } from './club.js';
import { Lights } from './lights.js';
import { Phone } from './phone.js';
import { Eggs } from './eggs.js';
import { Story } from './story.js';
import { Tutorial } from './tutorial.js';
import { Smoke } from '../gfx/smoke.js';
import { Photowalk } from './photowalk.js';
import { Brain } from '../people/brain.js';
import { Emergency } from './emergency.js';
import { Weather } from '../gfx/weather.js';
import { Strays } from '../people/strays.js';
import { Interiors } from '../world/interiors.js';
import { StreetApproach } from './approach.js';
import { Dates } from './date.js';
import { loadSettings, applySettings } from './settings.js';
import { refreshChips } from './keys.js';
import { Trial } from './trial.js';
import { Fauna } from '../people/animals.js';
import { Puddles } from './puddles.js';
import { Cutscene } from './cutscene.js';
import { Home } from './home.js';
import { setShutters } from '../world/buildingsChunk.js';
import { applyMods } from '../vehicles/mods.js';
import { Postcards } from './postcards.js';
import { LiveView } from '../ui/liveview.js';
import { MenuBar } from '../ui/menubar.js';
import { Jhola } from '../ui/jhola.js';
import { GarageUI } from './garageui.js';
import { ModFX } from './modfx.js';
import { Diary } from '../ui/diary.js';

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
    this.people.cars = () => this.traffic ? this.traffic.list : null;
    this.people.servicesOf = () => { const L = []; if (this.police) for (const m of this.police.marshals) if (m.mode === 'drive') L.push(m.veh); if (this.emergency) for (const R of this.emergency.list) L.push(R.v); return L; };      // people step out of the way of cars, never through them
    // which shop fronts are clubs (they get a crowd out front at night)
    this.people.isClub = (d) => { if (d.club === undefined) { const inf = d.shop >= 0 && this.shops && this.shops.infoOf(d); d.club = !!(inf && inf.kind === 'bar' && this.shops.isClub(inf)); } return d.club; };
    this.crowd = new Crowd(this.people, W.kit, this.scene, W, this.quality);
    this.crowd.traffic = this.traffic; this.traffic.richR = this.crowd.range * 0.7;
    this.people.signalsOf = () => this.traffic && this.traffic.signals;
    this.fauna = new Fauna(this.people, W.animalKit, this.scene, W);
    this.smoke = new Smoke(this.scene);
    this.puddles = new Puddles(this);
    this.cut = new Cutscene(this);
    this.home = new Home(this);
    this.jhola = new Jhola(this); this.diary = new Diary(this); this.menubar = new MenuBar(this); this.postcards = new Postcards(this); this.liveView = new LiveView(this);
    player.animalsNear = () => this.people.animals;
    // on foot your head (and a little of your body) turns to where the camera looks, so looking back you look back;
    // the torch arm goes on top
    {
      const rot = { yH: 0, yS: 0 }, dir = new THREE.Vector3();
      player.lookPose = (H, dt) => {
        const P = this.player, C = this.camera;
        if (!P.onFoot || P.downT > 0 || this.state !== 'play') { rot.yH *= 0.8; rot.yS *= 0.8; }
        else {
          C.getWorldDirection(dir);
          const want = Math.atan2(dir.z, dir.x), d = Math.atan2(Math.sin(want - P.foot.yaw), Math.cos(want - P.foot.yaw));
          const k = 1 - Math.exp(-dt * 6);
          rot.yH += (Math.max(-1.25, Math.min(1.25, d)) * 0.62 - rot.yH) * k;     // head takes most of it
          rot.yS += (Math.max(-1.25, Math.min(1.25, d)) * 0.38 - rot.yS) * k;     // the chest the rest
        }
        const sp = H.root.getObjectByName('spine_03'), hd = H.root.getObjectByName('Head');
        // a pure turn about the vertical: the world's up taken into each bone's parent frame (a world axis used
        // directly in a rotated rig tips the body forward or back instead of turning it)
        H.root.updateMatrixWorld(true);
        void sp;
        // (from the clip's pose each frame, never on top of the last turn: the head used to wander off and glitch)
        if (hd) bendBone(hd, Y_UP, -rot.yH - rot.yS * 0.5);
        if (P.torchArm) P.torchArm(H);
      };
    }
    this.wrecks = [];
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
    // a vendor's cry: heard from the stall, subtitled when you're close enough to make it out
    this.people.sayVendor = (p, kind, d) => {
      if (this.state !== 'play') return;
      if (this.vb && this.vb.vendor(kind, p, d)) return;          // the voice bank first
      const L = VLINES[kind]; if (!L) return;
      const i = Math.floor(Math.random() * L.length), id = `vd_${kind}_${i}`;
      this.audio.callAt(id, p.x, p.z, clamp(1.1 - d / 60, 0.35, 1));
      if (d < 13 && !(this.audio.voiceBusy && this.audio.voiceBusy())) this.hud.say(['Chaha', 'Paanwala', 'Vadapav', 'Phalwala', 'Phoolwali', 'Rasvanti'][kind] || 'Vendor', L[i][1], L[i][2], 2.6);
    };
    this.brawl = new Brawl(this); this.people.brawl = this.brawl;
    this.brain = new Brain(this.people, this); this.people.brain = this.brain;
    this.rep = new Rep(this); this.people.rep = this.rep;
    this.blood = new Blood(this.scene, W);
    this.duty = new Duty(this);
    this.vb = new VoiceBank(this); this.people.vb = this.vb;
    // police bikes and jeeps, ambulances: yours to take when they're stopped (a crime, if their crew is right there)
    player.servicesNear = () => {
      const L = [];
      for (const m of this.police ? this.police.marshals : []) if (!m.taken) L.push({ veh: m.veh, kind: 'pol', unit: m, label: m.jeep ? 'Take the police jeep' : 'Take the police bike' });
      for (const R of this.emergency ? this.emergency.list : []) if (!R.taken) L.push({ veh: R.v, kind: R.type === 'ambulance' ? 'amb' : 'pol', R, label: R.type === 'ambulance' ? 'Steal the ambulance' : 'Steal the police jeep' });
      for (const d of this.depots.list || []) if (d.veh) L.push({ veh: d.veh, kind: d.kind, depot: d, label: d.kind === 'amb' ? 'Sign in for a 108 shift' : 'Sign in for a Home Guard patrol' });
      return L;
    };
    player.onService = (sv) => this.takeService(sv);
    this.depots = { list: null, taken: new Set(), t: 0 };
    this.emergency = new Emergency(this);
    this.weather = new Weather(this.scene, this.audio);
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
    this.tut = new Tutorial(this);
    this.photowalk = new Photowalk(this);
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
    this.garageUI = new GarageUI(this); this.modfx = new ModFX(this);
    // the traffic is the neighbourhood's: Koregaon Park and Baner get the German sedans and the odd supercar,
    // the peths scooters and cycles, Lohegaon and Wagholi autos, tempos and Thars
    { const RICH = /koregaon park|boat club|bund garden|kalyani nagar|baner|balewadi|aundh|prabhat road|model colony|viman nagar|dhole patil|sopan baug|pashan|bavdhan|erandwane|salunke vihar|nibm|magarpatta city/i,
        IT = /hinjawadi|hinjewadi|kharadi|magarpatta|wakad|eon|commerzone|panchshil|mundhwa|yerawada/i, PETH = /peth\b|kasba|mandai|tulshibaug/i,
        STN = /pune station|sangamwadi|tadiwala|wakdewadi|agarkar nagar|swargate/i,
        OUT = /lohegaon|lohgaon|wagholi|dhanori|charholi|moshi|dighi|kesnand|manjari|fursungi|uruli|undri|pisoli|yewalewadi|handewadi|narhe|ambegaon|kirkatwadi|khadakwasla|shivane|\bsus\b|mahalunge|marunji|\bmaan\b|punawale|ravet|talawade|chikhali|loni|kondhwa budruk|bhugaon|nanded/i;
      const cache = new Map();
      this.traffic.zoneAt = (x, z) => {
        const k = Math.round(x / 300) * 100000 + Math.round(z / 300); if (cache.has(k)) return cache.get(k);
        let best = null, bd = 1200 * 1200; for (const a of this.hud.suburbs || []) { const d = (a.x - x) ** 2 + (a.z - z) ** 2; if (d < bd) { bd = d; best = a.n; } }
        const zn = !best ? null : RICH.test(best) ? 'rich' : IT.test(best) ? 'it' : PETH.test(best) ? 'peth' : STN.test(best) ? 'station' : OUT.test(best) ? 'outskirts' : null;
        cache.set(k, zn); return zn;
      }; }
    this.people.reaction = () => this.life.reaction();
    player.hpMax = () => this.life.hpMax;
    // sprinting tires you (about 15 s flat out, then you're down to a jog till you've got your breath back); shot or
    // limping, you can't run at all
    // out of breath slows you gradually (from a third left down to a jog), not off a cliff
    player.sprintMul = () => { const P = this.player, st = P.stam ?? 1; return this.life.sprintMul * (st < 0.33 ? 0.6 + 0.4 * st / 0.33 : 1) * (P.limpT > 0 ? 0.5 : 1); };
    player.stamDrain = () => { const s = this.life.s; return (s.energy < 0.3 ? 1.5 : 1) * (s.hunger < 0.15 ? 1.25 : 1) * (s.drunk > 0.4 ? 1.3 : 1); };
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
      if (this.phone && this.phone.on && ['Escape', 'KeyE', 'KeyJ', 'Tab', 'KeyF', 'KeyM', 'KeyP', 'KeyK'].includes(e.code)) return;      // (the phone has them while it's out)
      // (Esc that just released the mouse already opened the pause menu: don't close it again)
      if (e.code === 'Escape' || e.code === 'KeyP') { if ((this.state === 'play' || this.state === 'pause') && performance.now() - (this._pausedAt || 0) > 300) this.togglePause(); }
      if (e.code === 'KeyM' && (this.state === 'play' || this.state === 'map')) this.toggleMap();
      if (this.free && this.state === 'play' && (e.code === 'BracketLeft' || e.code === 'BracketRight')) this.setHour((this.hour + (e.code === 'BracketRight' ? 1 : 23)) % 24);
      if (e.code === 'KeyE' && this.state === 'play' && !e.repeat) { e.preventDefault(); this.jhola.open(); }
      if (e.code === 'Tab' && this.state === 'play') { e.preventDefault(); this.jhola.open(); }
      if (e.code === 'KeyJ' && this.state === 'play' && !e.repeat) { e.preventDefault(); this.jhola.open('missions'); }
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
    document.addEventListener('mousemove', (e) => { if (locked() && this.state === 'play') { const s = this.settings.sens; if (this.cut && this.cut.on) { this.cut.drag(e.movementX * 0.8 * s, e.movementY * 0.8 * s); return; } this.rig.drag(e.movementX * 0.8 * s, e.movementY * 0.8 * s * (this.settings.invertY ? -1 : 1)); } });
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
      // (into the same picture the game draws into: with the after-frame smoothing that's the pass's, not the screen)
      const tgt = this.post && this.post.fxaa ? this.post.target() : null;
      R.setRenderTarget(tgt); R.render(this.scene, cam); R.setRenderTarget(null);
      if (pv) { this.player.human.holder.visible = pv.vis; this.player.human.holder.position.copy(pv.pos); }   // back as it was (at the wheel, or wherever)
    } catch (e) { console.warn('prewarm', e); }
    for (const s of shown) { s.H.holder.visible = false; if (kit) kit.applyLook(s.H, s.H.look); }
    for (const v of tmp) v.dispose();
  }
  // a dent means a discussion, in Pune: the car you hit stops, its driver gets out, comes round to your window and
  // has his say (the people on the footpath have theirs), then goes back and drives off. Drive away if you like
  fenderBender(o) {
    if (this.free || (this._argT || 0) > this.t || o.argue > 0) return;
    this._argT = this.t + 40;
    o.argue = 22; o.v = 0;
    this.later(1.4, () => {
      const P = this.player, p = P.spawnAngryDriver(o, 'bump');
      if (!p) { o.argue = 0; return; }
      p.busy = 22;
      const sd = (P.spec && P.spec.W ? P.spec.W / 2 : 0.8) + 0.9;
      this.people.goTo(p, P.x - Math.sin(P.th) * sd, P.z + Math.cos(P.th) * sd, (q) => {
        this.people.watch(q, P.x, P.z, 10); q.anim = 'no';
        this.people.speakAs('fight', q, 1, 2);
        this.later(4.5, () => this.people.speakAs('bump', q, 1, 2));
        this.later(7, () => { for (const r of this.people.list) if (r !== q && !r.cop && !r.hidden && r.mode === 'watch' && Math.abs(r.x - q.x) < 14 && Math.abs(r.z - q.z) < 14) { this.people.speakAs('crowd', r, 1, 3); break; } });
      }, true);
      this.later(15, () => {
        if (!this.people.list.includes(p)) { o.argue = 0; return; }
        p.anim = null; p.busy = 10;
        this.people.goTo(p, o.x, o.z, (q) => { this.people.remove(q); o.argue = 0; o.angry = 4; });
        this.later(12, () => { if (o.argue > 0) { if (this.people.list.includes(p)) this.people.remove(p); o.argue = 0; } });
      });
    });
  }
  // knocked down in the street: what happens next depends on who you are round here. Where they like you someone
  // comes over, helps you up and gives you water; where you've a bad name they step round you, and someone may
  // help themselves to your wallet
  streetHelp() {
    const P = this.player;
    if (this.free || !this.rep || (this._helpT || 0) > this.t) return;
    this._helpT = this.t + 25;
    const st = this.rep.standing(P.x, P.z);
    let best = null, bd = 22 * 22;
    for (const q of this.people.list) {
      if (q.hidden || q.cop || q.fixed || q.pax || q.fallen > 0 || q.rideOf || q.mode === 'fight' || q.mode === 'inside' || q.busy > 0) continue;
      const d = (q.x - P.x) ** 2 + (q.z - P.z) ** 2; if (d < bd) { bd = d; best = q; }
    }
    if (!best) return;
    if (st > -0.15 && this.rng.chance(0.4 + st * 0.5)) {
      best.busy = 12;
      this.people.goTo(best, P.x + 0.8, P.z + 0.4, (q) => {
        this.people.watch(q, P.x, P.z, 4); q.act = { clip: 'talk', t: 0, dur: 3 };
        this.people.speakAs('kind', q, 1, 3);
        this.life.change('hp', 12);
        this.hud.toast('Someone helps you up', st > 0.3 ? 'They know you round here. A hand up and a sip of water (+12 health)' : 'A hand up and a sip of water (+12 health)', 'good', 3);
      }, true);
    } else if (st < -0.3) {
      this.people.speakAs('mutter', best, 1, 3);
      if (this.rng.chance(Math.min(0.6, -st * 0.7)) && this.stats.money > 200) {
        const amt = Math.min(1500, Math.round(this.stats.money * 0.05 / 10) * 10 + 100);
        this.later(2.5, () => { this.stats.money -= amt; this.saveStats(); this.hud.toast(`₹${amt} gone`, 'Someone helped themselves while you were down. Nobody saw anything, of course', 'bad', 3.4); });
      }
    }
  }
  // fuel burns as you drive (a full tank lasts ~25 km in an auto, more on a scooter), crashes dent
  // the engine (never an explosion: Indian vehicles are tougher than that), and both slow you down
  vehicleWear(dt) {
    const P = this.player;
    if (P.onFoot) return;
    const v = P.cur, S = P.spec || {};
    if (v.fuel === undefined) v.fuel = v === P.auto ? 1 : 0.35 + Math.random() * 0.6;
    if (v.dmg === undefined) v.dmg = 0;
    // forgiving: a full tank of CNG in the auto lasts ~60 km, a two-wheeler ~70, a car ~100
    const range = (v === P.auto ? 60000 : S.two ? (S.name === 'Bicycle' ? 1e12 : 70000) : 100000) * (v.econ || 1);
    const was = v.fuel;
    v.fuel = Math.max(0, v.fuel - Math.abs(v.v) * dt / range * (0.6 + (v.throttle || 0) * 0.6));
    const kind = v === P.auto || v.cngKit ? 'CNG' : 'Petrol';
    if (was > 0.15 && v.fuel <= 0.15) this.hud.toast(`${kind} low`, `About 15% left. Nearest pump: ${this.nearestPump()}`, 'warn', 4);
    if (was > 0 && v.fuel <= 0) this.hud.toast(`Out of ${kind}`, 'Running on fumes: slow, but enough to get you to a pump', 'bad', 4);
    const fuelMul = v.fuel > 0 ? 1 : 0.38;
    // a beaten engine: weaker and weaker, smoking, then burning, then gone
    v.powerMul = v.dead || (this.refuel && this.refuel.v === v) ? 0 : (v.tune || 1) * fuelMul * (1 - Math.min(0.95, v.dmg) * 0.6) * (v.flat > 0 ? 0.35 : 1);   // (shredded tyres: it limps)
    this.engineState(v, dt);
    if (v === P.auto) { this.life.s.autoFuel = Math.round(v.fuel * 1000) / 1000; this.life.s.autoDmg = Math.round(v.dmg * 1000) / 1000; }
  }
  // damage you can see and hear: soot on the paint, grey smoke past half, black smoke and a warning at 80%,
  // flames and a last warning at 90% (the fire keeps eating it), and at 100% it goes up
  engineState(v, dt) {
    const P = this.player, d = v.dmg || 0, w = v._dw || 0;
    this.paintDamage(v);
    if (d >= 0.75 && w < 0.75) this.hud.toast('Engine smoking', 'Black smoke now. Get it to a garage before it catches fire', 'warn', 4.5);
    if (d >= 0.95 && w < 0.95) { this.hud.toast('It’s going to blow!', 'Flames under the engine. Get out and get clear (F)', 'bad', 5); this.audio.crash && this.audio.crash(0.3); }
    v._dw = d;
    if (d >= 0.95 && !v.dead) v.dmg = Math.min(1, d + dt * 0.006);               // the fire spreads (about 8 s to get clear)
    if (v.dmg >= 1 && !v.dead) { this.explode(v); return; }
    this.smokeFrom(v, dt);
  }
  smokeFrom(v, dt) {
    const d = v.dmg || 0;
    if (d < 0.45) return;
    v._smT = (v._smT || 0) - dt;
    if (v._smT > 0) return;
    v._smT = d > 0.95 ? 0.04 : d > 0.75 ? 0.08 : 0.18;
    const hx = Math.cos(v.th || 0), hz = Math.sin(v.th || 0), back = v === this.player.auto ? -1.1 : 1.4;
    const x = v.x + hx * back, z = v.z + hz * back, y = (v.y || 0) + 1.0;
    // white steam first, then black smoke, then flames
    this.smoke.emit(x, y, z, d > 0.75 ? 'black' : 'steam', 0.4);
    if (d > 0.95) this.smoke.emit(x, y - 0.2, z, 'fire', 0.5);
  }
  paintDamage(v) {
    const d = v.dead ? 1 : v.dmg || 0;
    if (Math.abs((v._pd ?? -1) - d) < 0.02) return;
    v._pd = d;
    (v.root || v.tilt)?.traverse?.((o) => {
      if (!o.isInstancedMesh || !o.instanceColor) return;
      const a = o.instanceColor.array;
      if (!o.userData.paint0) o.userData.paint0 = Array.from(a);
      const k = v.dead ? 0.08 : 1 - Math.max(0, d - 0.2) * 0.55;
      for (let i = 0; i < a.length; i++) a[i] = o.userData.paint0[i] * k + (v.dead ? 0.02 : 0);
      o.instanceColor.needsUpdate = true;
    });
  }
  explode(v) {
    const P = this.player;
    this.shout('fire', v.x, v.z);
    v.dead = true; v.dmg = 1; v.v = 0; v.powerMul = 0;
    this.paintDamage(v);
    this.smoke.explode(v.x, (v.y || 0) + 0.8, v.z);
    this.rig.shake(1.2); this.audio.at(v.x, v.z, () => { this.audio.crash && this.audio.crash(1); this.audio.boom && this.audio.boom(); });
    if (!P.onFoot && P.cur === v) { P.exit(this.traffic, true); P.downT = 3.5; if (P.human) P.human.play('knockback', { once: true, fade: 0.06 }); this.burnHurt(68, 'Caught in the blast'); }
    else if (P.onFoot) this.blastHurt(v.x, v.z);
    for (const p of this.people.list) { const dd = Math.hypot(p.x - v.x, p.z - v.z); if (dd < 9 && !p.fixed) { p.fallen = 4 + Math.random() * 3; } else if (dd < 40 && p.flee !== undefined) p.flee = 6; }
    this.police && this.police.offence && this.police.offence('explosion', v.x, v.z, {});
    this.wrecks.push({ v, t: 0 });
    this.brain && this.brain.incident('blast', v.x, v.z, { byYou: !this.player.onFoot || this.player.cur === v });
    this.hud.toast('It went up', v === P.auto ? 'Your auto is a burnt shell' : 'That vehicle is a burnt shell', 'bad', 4);
    if (v === P.auto) this.later(18, () => this.rebuildAuto());
  }
  // taking a service vehicle: it stops being theirs (no more AI driving it); with its crew watching it's a theft of
  // government property, and they come after you; on duty, its calls come to you
  takeService(sv) {
    const v = sv.veh, G = this, ex = this.traffic.extra || [], S = this.life.s.svc || (this.life.s.svc = {});
    // a shift you sign up for: the 108 depot at a hospital, the Home Guard at a chowki (not if they know you)
    if (sv.depot) {
      const barred = sv.kind === 'amb' ? (S.bar108 || 0) > (this.clock || 0) : (S.barHG || 0) > (this.clock || 0) || (this.police && (this.police.heat > 0 || Object.keys(this.police.record || {}).some(k => ['theft', 'assault', 'murder', 'hitrun', 'fled', 'pickpocket'].includes(k))));
      if (barred) { this.hud.toast(sv.kind === 'amb' ? '108 won’t take you' : 'Not with your record', sv.kind === 'amb' ? 'You stole one of their ambulances. Come back in a few days' : 'The Home Guard checks records. Yours has things on it', 'bad', 3.4); return false; }
      v.serviceKind = sv.kind; v.service = true; v.legit = true; v.agent.isPlayer = true;
      const k = ex.indexOf(v.agent); if (k >= 0) ex.splice(k, 1);
      this.depots.taken.add(sv.depot.key); sv.depot.veh = null;
      v.seatOverride = sv.kind === 'amb' ? [1.32, 1.18, 0.42] : [0.05, 0.82, 0.38];
      this.hud.toast(sv.kind === 'amb' ? 'Signed in · 108 shift' : 'Signed in · Home Guard patrol', 'Calls will come to you. H for the siren and lights', 'meter', 3.4);
      return true;
    }
    v.serviceKind = sv.kind; v.service = true; v.stolen = true; v.agent.isPlayer = true;
    if (sv.unit) { const P = this.police, i = P.marshals.indexOf(sv.unit); sv.unit.taken = true; if (i >= 0) P.marshals.splice(i, 1);
      // the crew on foot stay as they are (furious); the rider on the bike gets off
      if (sv.unit.H) sv.unit.H.holder.visible = false; for (const c of sv.unit.crew || []) c.H.holder.visible = c !== sv.unit.crew[0]; }
    if (sv.R) { sv.R.taken = true; const L = this.emergency.list, i = L.indexOf(sv.R); if (i >= 0) L.splice(i, 1); for (const c of sv.R.crew) c.H.holder.visible = c.role !== 'driver'; }
    const k = ex.indexOf(v.agent); if (k >= 0) ex.splice(k, 1);
    v.seatOverride = v.spec.two ? null : sv.kind === 'amb' ? [1.32, 1.18, 0.42] : [0.05, 0.82, 0.38];
    // a working vehicle, stolen: a serious crime, in front of its crew; no calls come to a stolen one, and the service
    // remembers (108 won't take you for days). If there's a patient in the back, they're now yours to get to hospital
    if (!this.free) { this.rep && this.rep.deed('theft', this.player.x, this.player.z); this.police.raiseHeat(2, sv.kind === 'amb' ? 'Stole an ambulance' : 'Stole a police vehicle', 'theft'); this.police.law && (this.police.law.setDesc(), this.police.law.radioDesc()); }
    if (sv.kind === 'amb') S.bar108 = (this.clock || 0) + 72; else S.barHG = (this.clock || 0) + 168;
    const patient = sv.R && (sv.R.ph === 'loaded' || sv.R.ph === 'carry' || sv.R.ph === 'lift') && sv.R.victim && !sv.R.victim.corpse;
    if (patient && this.duty) this.duty.patientAboard();
    G.hud.toast(sv.kind === 'amb' ? 'You stole an ambulance' : 'You stole a police vehicle', patient ? 'There’s a patient in the back. Get them to a hospital' : 'No calls will come to it. And they know who took it', 'bad', 3.8);
  }
  // a parked 108 ambulance at each hospital, a Home Guard jeep at the police chowkis: there when you're near
  depotsTick(dt) {
    const D = this.depots; if ((D.t -= dt) > 0) return; D.t = 1;
    if (!D.list) {
      const H = ['Sassoon Hospital', 'KEM Hospital', 'Ruby Hall Clinic', 'Jehangir Hospital', 'Deenanath Mangeshkar Hospital', 'Bharati Vidyapeeth'].map(n => FAMOUS.find(f => f.name === n)).filter(Boolean);
      D.list = [...H.map(h => ({ key: h.name, kind: 'amb', x: h.x, z: h.z })), ...(this.police ? this.police.chowkis : []).slice(0, 40).map(c => ({ key: c.name, kind: 'pol', x: c.x, z: c.z }))];
    }
    const P = this.player;
    for (const d of D.list) {
      const near = Math.hypot(d.x - P.x, d.z - P.z);
      if (d.veh && near > 300) { if (d.veh.root.parent) d.veh.root.parent.remove(d.veh.root); const ex = this.traffic.extra || [], k = ex.indexOf(d.veh.agent); if (k >= 0) ex.splice(k, 1); d.veh = null; }
      if (!d.veh && near < 150 && !D.taken.has(d.key) && !(this.inView && this.inView(d.x, d.z) && near < 60)) {
        if (!this.W.graph.nearest(d.x, d.z, 200)) continue;        // its street hasn't loaded yet
        const sp = this.police.kerbSpot(d.x, d.z), amb = d.kind === 'amb';
        const v = new Vehicle(this.W, this.scene, this.vmats, amb ? 'tempo' : 'suv', [0.95, 0.95, 0.93]);
        v.reset(sp.x, sp.z, sp.th); v.y = this.W.surf.height(sp.x, sp.z);
        for (const c of v.tilt.children) c.visible = false;
        const md = amb ? buildAmbulance() : buildPoliceJeep(); v.tilt.add(md.group); v.md = md; for (const L2 of ['red', 'blue', 'red2']) if (md.lights[L2]) md.lights[L2].visible = false;
        v.spec = { ...specOf(amb ? 'tempo' : 'suv'), L: md.dims.L, W: md.dims.W }; makeService(v);
        this.traffic.extra = this.traffic.extra || []; this.traffic.extra.push(v.agent);
        d.veh = v;
      }
    }
  }
  // the traffic's damage: smoke past half, black smoke and flames near the end, then it goes up like yours
  trafficDamage(dt) {
    if ((this._tdT = (this._tdT || 0) - dt) > 0) return;
    this._tdT = 0.1;
    for (const o of this.traffic.list) {
      const d = o.dmg || 0;
      if (d < 0.5 || o.wreck) continue;
      if (d >= 0.95) o.dmg = d + 0.1 * 0.007;                                           // once it's burning, it keeps burning (~7 s)
      if (o.dmg >= 1) { this.explodeAgent(o); continue; }
      const T = o.T || {}, back = (T.L || 3) * 0.35, hx = o.hx ?? Math.cos(o.yaw || 0), hz = o.hz ?? Math.sin(o.yaw || 0);
      if (Math.random() < (d > 0.95 ? 1 : d > 0.75 ? 0.6 : 0.3)) this.smoke.emit(o.x + hx * back, (o.y || 0) + 0.9, o.z + hz * back, d > 0.75 ? 'black' : 'steam', 0.35);
      if (d > 0.95) this.smoke.emit(o.x + hx * back, (o.y || 0) + 0.6, o.z + hz * back, 'fire', 0.4);
    }
  }
  // someone nearby shouts what's happening (from the voice bank)
  shout(moment, x, z) {
    if (!this.vb) return;
    let best = null, bd = 25;
    for (const q of this.people.list) { if (q.hidden || q.cop || q.crew || q.fallen > 0) continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } }
    if (best) this.later(0.5 + Math.random() * 0.6, () => this.vb.street(best, moment, { pri: 2 }));
  }
  explodeAgent(o) {
    const P = this.player;
    this.shout('fire', o.x, o.z);
    o.wreck = true; o.v = 0; o.dmg = 1; o.rich = false;
    this.smoke.explode(o.x, (o.y || 0) + 0.8, o.z);
    const d = Math.hypot(P.x - o.x, P.z - o.z);
    this.rig.shake(Math.max(0.2, 1.2 - d / 40)); this.audio.at(o.x, o.z, () => { this.audio.crash && this.audio.crash(1); this.audio.boom && this.audio.boom(); });
    if (P.onFoot) this.blastHurt(o.x, o.z);
    for (const p of this.people.list) { const dd = Math.hypot(p.x - o.x, p.z - o.z); if (dd < 8 && !p.fixed && !(p.fallen > 0)) p.fallen = 4 + Math.random() * 3; }
    this.wrecks.push({ v: o, t: 0 });
    this.brain && this.brain.incident('blast', o.x, o.z, { byYou: true });
  }
  // fire and blasts hurt you: the blast by how close you were (right beside it, most of your health), the flames while
  // you sit in a burning vehicle or stand in a burning wreck's fire
  blastHurt(x, z) {
    const P = this.player, d = Math.hypot(P.x - x, P.z - z);
    if (d < 10) { P.downT = 3; if (P.human) P.human.play('knockback', { once: true, fade: 0.06 }); this.burnHurt(Math.round(80 * (1 - d / 10) + 15), 'Caught in the blast'); }
    else if (d < 14) this.burnHurt(8, '');
  }
  burnHurt(n, why) {
    const P = this.player;
    P.hp = (P.hp ?? 100) - n; this.hud.hurt && this.hud.hurt(); this.vb && this.vb.you('hurt', n > 25);
    if (P.hp <= 0) { P.hp = 0; this.blackout && this.blackout(why || 'Burns'); }
  }
  fireTick(dt) {
    const P = this.player;
    // in a vehicle that's on fire
    if (!P.onFoot && P.cur && (P.cur.dmg || 0) >= 0.9 && !P.cur.dead) { this._fireT = (this._fireT || 0) + dt; if (this._fireT > 0.5) { this._fireT = 0; this.burnHurt(4, 'Burnt in a vehicle fire'); this.hud.toast('You’re burning', 'Get out (F)!', 'bad', 0.8); } }
    // standing in a wreck's flames
    if (P.onFoot) for (const w of this.wrecks) if (w.t < 25 && Math.hypot(w.v.x - P.x, w.v.z - P.z) < 3) { this._fireT2 = (this._fireT2 || 0) + dt; if (this._fireT2 > 0.5) { this._fireT2 = 0; this.burnHurt(5, 'Burnt'); } break; }
  }
  burnWrecks(dt) {
    for (const w of this.wrecks) {
      w.t += dt; const v = w.v;
      if (w.t > 70) continue;
      w.e = (w.e || 0) - dt; if (w.e > 0) continue;
      w.e = w.t < 25 ? 0.06 : 0.25;
      this.smoke.emit(v.x, (v.y || 0) + 1.2, v.z, 'black', 1.2);
      if (w.t < 25) this.smoke.emit(v.x, (v.y || 0) + 0.6, v.z, 'fire', 1.4);
    }
    // a burnt-out vehicle in the traffic is towed away a couple of minutes later, once you're not watching
    for (const w of this.wrecks) if (w.v.wreck && w.t > 110 && !(this.inView && this.inView(w.v.x, w.v.z))) { w.v.alive = false; w.gone = true; }
    this.wrecks = this.wrecks.filter(w => !w.gone && (w.t <= 70 || (w.v.wreck && w.v.alive)));
  }
  // Bapu Kaka sorts it out: the shell is towed, a rebuilt auto waits at the stand by Shaniwar Wada
  rebuildAuto() {
    const A = this.player.auto, cost = 6000, paid = Math.min(cost, Math.max(0, this.stats.money));
    this.stats.money -= paid; this.saveStats?.();
    A.dead = false; A.dmg = 0; A.fuel = 1; A._pd = -1; this.paintDamage(A);
    const S = this.stand || this.wadaStart();
    if (S) this.player.moveAuto(S.x, S.z, S.th, this.traffic);
    this.hud.sms('Bapu Kaka', `रिक्षा पुन्हा उभी केली. ₹${paid.toLocaleString('en-IN')} लागले. स्टँडवर आहे. आता तरी सावकाश चालव.`, '', 'Rebuilt your auto. It’s at the stand by Shaniwar Wada. Drive slowly this time.');
  }
  // at the pump: the engine stays off and the meter runs up while the attendant fills, then you're off
  startRefuel(v, add, price, cng, tank) { this.refuel = { v, from: v.fuel ?? 0, to: Math.min(1, (v.fuel ?? 0) + add), t: 0, dur: 2.5 + add * 9, price, cng, units: add * tank }; }
  stepRefuel(dt) {
    const R = this.refuel; if (!R) return;
    R.t += dt; const k = Math.min(1, R.t / R.dur);
    R.v.fuel = R.from + (R.to - R.from) * k; R.v.powerMul = 0;
    if (k >= 1) { this.refuel = null; this.hud.toast('Tank filled', `${R.units.toFixed(1)} ${R.cng ? 'kg CNG' : 'litres'} · ₹${R.price}. “Chala, bye!”`, 'good', 3); }
  }
  // petting: you turn to it and crouch (a cow you just reach up to), your hand goes to its back and strokes, a few
  // seconds; it turns to you and wags (a dog), leans in and settles (a cat), or just lets you (a cow)
  petAnimal(a) {
    const P = this.player, F = P.foot, H = P.human;
    if (!P.onFoot || !H) return;
    if (this.rep) this.rep.good(a.x, a.z, 0.35);          // the lane notices who's kind to its dogs
    F.yaw = Math.atan2(a.z - F.z, a.x - F.x); F.vx = F.vz = 0;
    a.petT = 3.2; a.petPh = 0; a.petX = F.x; a.petZ = F.z;
    const cow = a.cow || a.kind === 'cow', dur = 3.0;
    if (!cow) H.play('crouch', { fade: 0.25 });
    P.act = { kind: 'hurt', t: 0, dur };
    const tgt = new THREE.Vector3(), pole = new THREE.Vector3();
    let t = 0;
    const prev = P.postPose;
    P.postPose = (H2, dt) => {
      t += dt;
      if (prev) prev(H2, dt);
      const k = Math.min(1, t * 3) * Math.min(1, Math.max(0, (dur - t) * 3));
      const fx = Math.cos(F.yaw), fz = Math.sin(F.yaw), stroke = Math.sin(t * 5.5) * 0.14;
      const back = cow ? 1.05 : a.kind === 'cat' ? 0.28 : 0.42;
      tgt.set(a.x - fx * 0.05 + fx * stroke, this.W.surf.height(a.x, a.z) + back, a.z - fz * 0.05 + fz * stroke);
      pole.set(-fz, -0.6, fx).normalize();
      ikArm(H2, 'r', tgt, pole, k);
      if (t >= dur) { P.postPose = prev || null; if (!cow) H2.play('idle', { fade: 0.3 }); }
    };
    if (a.kind === 'cat') this.later(0.6, () => this.audio && this.audio.purr && this.audio.purr());
    else if (!cow) this.later(0.4, () => this.audio && this.audio.bark && this.audio.bark(0.25));
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
  // while a menu shows somewhere far off live (the map's place card, a mission), the city streams in there
  get peeking() { return !!(this.peek && (this.state === 'map' || this.state === 'shop' || this.state === 'pause')); }
  focus() {
    if (this.state === 'title') return this.camera.position;
    if (this.peeking) { this._peekV = this._peekV || new THREE.Vector3(); return this._peekV.set(this.peek.x, 0, this.peek.z); }
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
    this.tut && this.later(1.2, () => this.tut.start());     // the first minutes, taught by doing (once, for everyone)
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
    if (this.garageUI && this.garageUI.open) this.garageUI.close();
    if (this.shops && this.shops.open) this.shops.close();
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
    if (Q.shadows !== this.shadowsOn()) this.swapShadows(Q.shadows, Q.shadowSize || 1024);
    this.qualityNote = Q.texMax !== this.quality.texMax || Q.msaa !== this.quality.msaa ? 'Some changes (textures, edge smoothing) apply after you reload the page.' : '';
  }
  shadowsOn() { return this.renderer.shadowMap.enabled && !this.shadowsOff; }
  // shadows on or off changes every shader in the city, and compiling them all again froze the game for seconds
  // on a laptop. So once the shadowed shaders exist they stay: "off" just stops drawing the shadow pass and
  // fades the shadows to nothing (a setting, not a shader change), and "on" again brings them straight back
  swapShadows(on, size) {
    const R = this.renderer, sky = this.sky;
    if (R.shadowMap.enabled) {
      this.shadowsOff = !on;
      sky.sun.shadow.intensity = on ? 1 : 0;
      if (on) { if (size !== sky.sun.shadow.mapSize.x) sky.setShadows(true, size); R.shadowMap.needsUpdate = true; }
      return;
    }
    // started without shadows: their shaders have to be built now (picked from the menu, so it's a pause there)
    this.shadowsOff = false; sky.sun.shadow.intensity = 1;
    R.shadowMap.enabled = true; sky.setShadows(true, size);
    this.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => (m.needsUpdate = true)); });
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
      L.s.tally.knockedOut++; L.change('mood', -0.1); if (L.s.upg.chain) { L.s.upg.chain = 0; this.hud.toast('Your gold chain’s gone', 'Taken while you were out cold', 'bad', 3); }
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
    applyMods(this, A);              // the garage's mods (engine, turbo, neon, horn...) on your auto
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
    if (this.refuel) { const R = this.refuel, k = Math.min(1, R.t / R.dur); return { main: 'Filling up · engine off', sub: `₹${Math.round(R.price * k)} · ${(R.units * k).toFixed(1)} ${R.cng ? 'kg' : 'L'}` }; }
    const tj = this.tut && this.tut.objective();
    if (tj) return tj;
    const dj = this.duty && this.duty.objective();
    if (dj) return dj;
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
    // (until you put your foot down: then you're just driving off, and it's leaving a police stop)
    if (this.police.holding() && !(inp.throttle > 0.05 || Math.abs(inp.steer) > 0.2)) { inp.throttle = 0; inp.brake = Math.abs(this.player.v) > 0.5 ? 1 : 0; inp.steer = 0; inp.handbrake = true; inp.horn = false; }
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
        if (ev.speed > 8 && ev.kind !== 3) this.brain && this.brain.incident('crash', ev.x ?? P.x, ev.z ?? P.z, { byYou: true });
        this.rig.shake(Math.min(0.5, ev.speed * 0.06)); this.audio.crash(Math.min(1, ev.speed / 8));
        if (!P.onFoot && ev.speed > 3) { const v = P.cur; knock(v, ev.speed, 0.007); if (v.dmg > 0.6 && !this._dmgWarn) { this._dmgWarn = true; this.date && this.date.event('crash'); this.hud.toast('Your vehicle is badly damaged', 'It’s slower now. Any garage can fix it', 'warn', 3.4); } if (v.dmg < 0.3) this._dmgWarn = false; }
        if (ev.kind === 3) this.hud.toast('End of the shift area', 'Turn back, the map ends here', 'warn', 2);
      }
      if (ev.type === 'hit' && ev.o && !P.onFoot && ev.speed > 2.5 && ev.speed < 12 && ev.o.T && !ev.o.T.two && !ev.o.service) this.fenderBender(ev.o);
      if (ev.type === 'scrape') this.audio.thud(0.15);
      if (ev.type === 'pedDied' && ev.bled) { this.hud.toast('They didn’t make it', 'Nobody got them to a hospital in time', 'bad', 4); }
      else if (ev.type === 'pedDied' && this.blood) this.blood.spill(ev.x, ev.z, 0.9, 30);
      if (ev.type === 'pedDied' && !ev.bled) {
        if (!this.free) { this.hud.toast('You killed someone', 'Murder is BNS s.103. If anyone saw, they’ll call it in', 'bad', 5); this.life.change('karma', -30); this.police && this.police.law && this.police.law.report(3, 'Killed someone in a fight', 'murder', ev.x ?? P.x, ev.z ?? P.z, { victim: ev.p }); }
      }
      if (ev.type === 'pet') {
        const a = ev.a; a.moving = false; a.rest = 8; this.life.change('mood', 0.06); this.rep && this.rep.deed('pet', a.x, a.z);
        this.petAnimal(a);
        const L = a.cow ? ['Touch the cow for luck', 'She doesn’t care. A kaku nearby approves.'] : a.kind === 'cat' ? ['The cat allows it', 'Three seconds, then a look that says enough.'] : ['Good dog', 'The tail goes like a fan. A friend for life, or till the next vada pav.'];
        this.hud.toast(L[0], L[1], 'good', 2.6); if (!a.cow && a.kind !== 'cat') this.audio.bark && this.audio.bark(0.3);
      }
      if (ev.type === 'animalHit') {
        this.brain && this.brain.incident('crash', ev.x, ev.z, { byYou: true });
        this.audio.thud(0.5); this.audio.bark && this.audio.bark(0.9);
        if (ev.dead) { this.hud.toast(ev.a.kind === 'cat' ? 'You killed a cat' : 'You killed a street dog', 'People saw. Nobody in Pune forgets that', 'bad', 4); this.life.change('karma', -8); }
        else { this.hud.toast(ev.a.kind === 'cat' ? 'You hit a cat' : 'You hit a street dog', 'It limps off yelping. Slow down near the kerb', 'warn', 3); this.life.change('karma', -3); }
        if ((this._gatherT || 0) < this.t) { this._gatherT = this.t + 8; this.people.gather(ev.x, ev.z, 4); }
      }
      if (ev.type === 'cowHit' && !P.onFoot) {
        const v = P.cur, kmh = ev.speed * 3.6;
        v.v = 0; v.vl = 0; this.rig.shake(Math.min(0.9, ev.speed * 0.08)); this.audio.crash(1);
        knock(v, ev.speed + 2, 0.012);
        this.life.change('karma', -10);
        this.hud.toast('You hit a cow', kmh > 25 ? 'She’s hurt, your vehicle’s wrecked, and a crowd is forming fast' : 'She barely moved. Your bumper did. Everyone is staring', 'bad', 4);
        if ((this._gatherT || 0) < this.t) { this._gatherT = this.t + 8; this.people.gather(ev.x, ev.z, 8); }
        if (kmh > 25 && this.police && this.police.raiseHeat) this.police.raiseHeat(1, 'Hit a cow', 'rash');
      }
      if (ev.type === 'bark' || ev.type === 'dogChase') { const d = Math.hypot(ev.x - P.x, ev.z - P.z); if (d < 60) this.audio.at(ev.x, ev.z, () => this.audio.bark(0.7, 0)); }
      if (ev.type === 'dogChase' && (this._dogT || 0) < this.t) { this._dogT = this.t + 30; this.hud.toast('A street dog is chasing you', 'Classic. Keep going, it’ll give up.', 'info', 2.4); }
      if (ev.type === 'drift') this.modfx && this.modfx.onDrift(ev, P.cur);
      if (ev.type === 'bump') {
        this.rig.shake(Math.min(0.25, ev.strength * 0.03)); this.audio.thud(Math.min(0.6, ev.strength * 0.12));
        const v = !P.onFoot && P.cur;          // slammed (the garage): a breaker or a pothole scrapes the floor
        if (v && (v.lower || 0) >= 0.07 && ev.strength > 0.9) { v.dmg = Math.min(0.9, (v.dmg || 0) + 0.006); this.audio.noiseBurst?.(0.18, 900, 0.6, 0.3); if (!this._scrapeT || this.t - this._scrapeT > 90) { this._scrapeT = this.t; this.hud.toast('Scraped the floor', 'Slammed and Pune’s speed breakers don’t mix', 'warn', 2.4); } }
      }
      if (ev.type === 'tip') { this.rig.shake(0.5); this.audio.crash(0.8); this.hud.toast('Auto tipped over!', 'Corner slower, autos lift a wheel easily', 'warn', 3); }
      if (ev.type === 'hit') { this.audio.crash(Math.min(1, ev.speed / 6)); }
      if (ev.type === 'knock') { this.audio.crash(0.7); this.hud.toast('You knocked over a two-wheeler', 'They’re fine. Very, very angry, but fine.', 'warn', 2.6); }
      if (ev.type === 'pedHit') {
        this.brain && this.brain.incident(ev.sev === 'knock' ? 'crash' : 'down', ev.x, ev.z, { victim: ev.p, byYou: true });
        // blood under the badly hurt: a little for knocked out, a spreading pool for the critical and the dead
        const J = ev.p && ev.p.inj, sev = J ? J.sev : ev.sev;
        if (this.blood && sev !== 'knock') this.blood.spill(ev.p.x, ev.p.z, sev === 'dead' ? 1.1 : sev === 'critical' ? 0.85 : 0.35, sev === 'ko' ? 15 : 40);
        this.audio.thud(ev.sev === 'knock' ? 0.4 : 0.8); this.rig.shake(ev.sev === 'knock' ? 0.15 : 0.35);
        if (ev.sev === 'dead') { this.hud.toast('You killed someone', 'Hit and run is BNS s.106: up to ten years. If anyone saw, they’ll call it in', 'bad', 5); this.life.change('karma', -25); this.police && this.police.law && this.police.law.report(3, 'Killed a pedestrian', 'hitrun', ev.x, ev.z, { victim: ev.p }); }
        else if (ev.sev === 'ko') { this.hud.toast('You knocked someone out', 'They’re not getting up. Someone may call it in', 'bad', 3.6); this.life.change('karma', -6); this.police && this.police.law && this.police.law.report(1, 'Hit a pedestrian', 'hitrun', ev.x, ev.z, { victim: ev.p }); }
        else { this.hud.toast('Watch the pedestrians!', 'They’re hurt and furious', 'warn', 2.4); this.stats.money = Math.max(0, this.stats.money - 50); }
      }
      if (ev.type === 'dodge') { if (this.rng.chance(0.35) && (this._dodgeT || 0) < this.t) { this._dodgeT = this.t + 4; if (!(ev.p && this.people.speakAs('dodge', ev.p, 1, 4))) this.police.say(this.rng.pick(['d1', 'd2', 'd3', 'd4']), ev); } }
      if (ev.type === 'recovered') this.hud.toast('Back on three wheels', '', 'info', 1.6);
      if ((ev.type === 'jump' && this.rng.chance(0.3)) || ev.type === 'climb') this.people.onStunt(P);
      if (ev.type === 'gotHit') { P.hp = (P.hp ?? 100) - Math.min(60, 10 + (ev.speed || 4) * 4); if (P.hp <= 0) { this.blackout('hit'); continue; } this.audio.thud(0.6); this.rig.shake(0.4); this.hud.toast('Knocked down', 'Traffic doesn\u2019t stop for pedestrians here. Stay on the footpath.', 'bad', 3); this.streetHelp(); }
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
        if ((this._gatherT || 0) < this.t) { this._gatherT = this.t + 8; this.people.gather(ev.x ?? P.x, ev.z ?? P.z, ev.type === 'crash' ? 3 : 5, ev.type === 'pedBumped' || ev.type === 'gotHit' ? 'foot' : 'vehicle'); }
      }
    }
  }

  frame(dt) {
    if (this.jhola) this.jhola.update(dt);
    if (this.menubar) this.menubar.update(this.realDt || dt);
    if (this.postcards && this.W) this.postcards.update(this.realDt || dt);
    if (this.liveView) this.liveView.update(this.realDt || dt);
    // shutters: up on the shops that are open now, down on the rest (new chunks straight away, the rest every couple of seconds)
    if (this.shops && this.W && this.W.streamer) {
      const all = (this._shT = (this._shT || 0) - (this.realDt || dt)) <= 0; if (all) this._shT = 2;
      const H = this.hour, sh = this.shops;
      for (const c of this.W.streamer.built) if (c.shutters && (all || c.shutters.fresh)) { c.shutters.fresh = false; setShutters(c, (d) => { const inf = sh.infoOf(d); return !!inf && openNow(inf, H).open; }); }
    }
    if (this.audio) this.audio.hour = this.hour;
    // audio parameters at a steady 30 / 20 a second (scheduling them every frame clogged the audio thread)
    this._aT = (this._aT || 0) + dt; this._eT = (this._eT || 0) + dt;
    if (this.audio && this.audio.listen && this._aT > 1 / 30) { this._aT = 0; this.audio.listen(this.camera); }
    if (this.audio && this.audio.engines && this._eT > 0.12 && this.state === 'play' && this.traffic) { this._eT = 0; this.audio.engines(this.traffic.list, this.camera.position.x, this.camera.position.z); }
    // a dark base under the whole city: any hairline crack between ground pieces shows asphalt, not the bright sky
    if (!this.under) { this.under = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshLambertMaterial({ color: 0x2b2b2d })); this.under.rotation.x = -Math.PI / 2; this.under.receiveShadow = false; this.scene.add(this.under); }
    this.under.position.set(Math.round(this.camera.position.x / 50) * 50, -0.03, Math.round(this.camera.position.z / 50) * 50);
    this.W.playerVeh = this.player.onFoot ? null : this.player.cur;      // (only your driving wrecks the traffic)
    // in cuffs: hands together behind your back
    if (this.cuffT > 0) {
      this.cuffT -= dt; const P = this.player, H = P.human;
      if (H && P.onFoot) {
        H.holder.updateMatrixWorld(true);
        const F = P.foot, fx = Math.cos(F.yaw), fz = Math.sin(F.yaw), rx = -fz, rz = fx;
        for (const sd of [1, -1]) { _cufT.set(F.x - fx * 0.2 + rx * 0.05 * sd, F.y + 0.92, F.z - fz * 0.2 + rz * 0.05 * sd); _cufP.set(rx * sd, -0.5, rz * sd).normalize(); ikArm(H, sd > 0 ? 'r' : 'l', _cufT, _cufP, 1); }
      }
    }
    if (this.blood) this.blood.update(dt);
    if (this.state === 'play') this.fireTick(dt);
    if (this.puddles) this.puddles.update(dt);
    if (this.home && this.state === 'play' && !this.free) this.home.update(dt);
    // where the traffic slows to gawk: the last minute's crashes, fights and people down in the road
    if ((this._gawkT = (this._gawkT || 0) - dt) <= 0 && this.brain && this.traffic) {
      this._gawkT = 1; const L = [];
      for (const I of this.brain.inc) if (I.t < 60 && (I.kind === 'down' || I.kind === 'crash' || I.kind === 'blast' || I.kind === 'fight')) L.push({ x: I.x, z: I.z });
      this.traffic.gawk = L.slice(-6);
    }
    if (this.smoke) { this.smoke.update(dt); this.burnWrecks(dt); if (this.traffic && this.state === 'play') this.trafficDamage(dt); }
    this.stepRefuel(dt);
    if (this.brain && this.state !== 'title') this.brain.update(dt, this.player);
    if (this.emergency && this.state !== 'title') this.emergency.update(dt);
    if (this.duty && this.state === 'play') { this.duty.update(dt); this.depotsTick(dt); }
    // in your story the weather follows Pune's year (free roam: whatever you picked)
    if (this.weather && !this.free) { const day = Math.floor((this.clock || 0) / 24), hb = Math.floor(this.hour || 0); if (day !== this._wDay || hb !== this._wHr) { this._wDay = day; this._wHr = hb; this.weather.auto(day, this.hour || 12); } }
    if (this.state !== 'title' && this.tut) this.tut.update(dt);
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
      this.modfx.update(dt);
      if (this.input.took('KeyV')) this.rig.setMode(this.rig.mode + 1);
      if (this.input.took('KeyL')) this.lights.toggle();
      this.rig.lookBack = this.input.key('KeyB');
      if (this.input.took('KeyR') && P.tipped === 0 && !P.onFoot) this.backOnRoad();
      if (!this.interiors.inside) this.checkRoad(dt);
      this.interiors.update(dt);
      this.date.update(dt);
      this.approachSt.update(dt);
      this.updateNav(dt);
      if (!(this.jhola && this.jhola.on)) this.rig.update(dt, P);     // (the jhola holds the camera)
      if (this.cut && this.cut.on) { this.cut.update(dt); this.cut.camera(this.camera, dt); }
      const S = P.spec;
      const kind = !S ? 'none' : P.inAuto ? 'auto' : S.two ? 'two' : S.L > 6 ? 'bus' : 'car';
      this.audio.updateEngine(P.rpm, P.throttle, kind !== 'none', kind);
      // H: the horn; in a police vehicle or an ambulance, the siren and lights on and off (and traffic makes way)
      const svc = !P.onFoot && P.cur && P.cur.serviceKind, hk = this.input.state.horn && !P.onFoot;
      if (svc && hk && !this._hornWas) { P.cur.sirenOn = !P.cur.sirenOn; this.hud.toast(P.cur.sirenOn ? 'Siren on' : 'Siren off', P.cur.sirenOn ? 'Traffic ahead will make way' : '', 'info', 1.4); }
      this._hornWas = hk;
      if (P.cur && P.cur.md && P.cur.md.lights) { const Lg = P.cur.md.lights, on = !!P.cur.sirenOn, f = on && Math.floor(this.t * 6) % 2 === 0; Lg.red.visible = f; Lg.redOff.visible = !f; Lg.blue.visible = on && !f; Lg.blueOff.visible = !(on && !f); }
      const horn = hk && !svc;
      this.audio.playerHorn(horn, (P.cur && P.cur.hornKind) || (S ? S.honk : 'auto'));
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
    if (this.state === 'play' || this.state === 'shop') this.phone.update(this.realDt || dt);
    if (this.story.talking) this.story.cam(dt);
    if (this.garageUI && this.garageUI.open) this.garageUI.update(this.realDt || dt);
    else if (this.state !== 'play' && this.modfx) this.modfx.update(dt);
    if (this.lightPools) { this.lightPools.mesh.visible = night > 0.05; this.lightPools.mesh.material.opacity = night * 0.55; }
    this.people.render(P.x, P.z);
    { const rn = this.weather && !(this.interiors && this.interiors.inside) ? this.weather.cur.rain : 0; this.people.rain = rn; this.people.hour = this.hour; if (this.crowd) this.crowd.rain = rn; }
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
      void hx; void hz;
      A.at(h.x, h.z, () => A.horn(h.kind, 0.85, 0, h.n || 1));          // from where the horn is (3D audio)
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
      // steady: a resolution change reallocates every render target (a hitch, and the picture visibly softens or
      // sharpens), so only on a clear, lasting trend
      if (fps < 42) p.slow++; else p.slow = 0;
      if (fps > 58) p.fast++; else p.fast = 0;
      const maxPr = Math.min(window.devicePixelRatio || 1, this.QUALITY[this.qualityName].pixelRatio);
      // never below the screen's own resolution (1.0): below that every sign, plate and shop board
      // smears. Slow machines lose shadows, grass and range instead (the preset step below).
      const floor = this.qualityName === 'lite' ? 0.6 : Math.min(1, window.devicePixelRatio || 1);
      if (p.slow >= 2 && p.pr > floor) { p.pr = Math.max(floor, p.pr - (fps < 30 ? 0.15 : 0.08)); this.applyPixelRatio(p.pr); p.slow = 0; }
      else if (p.fast >= 6 && p.pr < maxPr) { p.pr = Math.min(maxPr, p.pr + 0.08); this.applyPixelRatio(p.pr); p.fast = 0; }
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
