// Teaching the game by playing it. Two parts:
//  · the first minutes, one step at a time (walk, look, find your auto, drive, map, phone, jhola), each moving on
//    the moment you've done it;
//  · after that, a hint the first time something new happens (your first time driving, at a shop door, after
//    dark, hungry, chased by the police, in a fight, a text, a passenger waving).
// Both show in the coach card: the keys as keycaps, what they do, and why now. Each is shown once (Start over
// brings them back).
const STEPS = [
  { keys: ['W', 'A', 'S', 'D'], main: 'Walk', sub: 'Hold Shift to run', done: (G, s) => s.moved > 6 },
  { keys: ['Mouse'], main: 'Look around', sub: 'The camera follows the mouse', done: (G, s) => s.turned > 1.2 || s.t > 7 },
  { keys: ['F'], main: 'Get in your auto', sub: 'It’s the auto icon on your minimap, under the yellow marker', done: (G) => !G.player.onFoot },
  { keys: ['W', 'S', 'A', 'D', 'Space'], main: 'Drive', sub: 'W go · S brake and reverse · A D steer · Space handbrake', done: (G, s) => s.driven > 60 },
  { keys: ['M'], main: 'Open the map', sub: 'Find places, set a waypoint, see where your auto is', done: (G) => G.state === 'map' },
  { keys: ['T'], main: 'Your phone', sub: 'Texts, contacts, and everything you’ll need', done: (G) => G.phone && G.phone.on },
  { keys: ['E'], main: 'Your jhola', sub: 'Food, water and whatever you buy', done: (G) => (G.bag && G.bag.open) || (G.jhola && G.jhola.open) },
];
// first-time hints: when it applies, and what to say
const HINTS = [
  { id: 'shop', keys: ['F'], main: 'Go in', sub: 'Shops, cafés and clubs open with F at the door. 1 to 9 picks in any menu', when: (G) => G.player.onFoot && /enter|go in|shop|café|cafe/i.test(G.hud.$('h-prompt-t')?.textContent || '') },
  { id: 'night', keys: ['L'], main: 'Torch', sub: 'It’s dark: L for your torch on foot, your headlights in a vehicle', when: (G) => G.hour > 19.3 || G.hour < 5.5 },
  { id: 'hungry', keys: ['E'], main: 'You’re hungry', sub: 'Eat from your jhola (E), or any tapri, misal place or hawker', when: (G) => G.life && G.life.s && (G.life.s.hunger ?? 1) < 0.3 },
  { id: 'thirsty', keys: ['E'], main: 'You’re thirsty', sub: 'A bottle from your jhola, or a juice centre', when: (G) => G.life && G.life.s && (G.life.s.thirst ?? 1) < 0.3 },
  { id: 'cops', keys: ['Esc'], main: 'The police want you', sub: 'Lose them: break their line of sight and keep moving. Or pay your challans at a chowki (E-challans in the menu)', when: (G) => G.police && G.police.heat > 0 },
  { id: 'fight', keys: ['Click', 'C'], main: 'A fight', sub: 'Click to punch, C to roll out of the way. Or just walk off', when: (G) => G.brawl && G.brawl.active > 0 },
  { id: 'sms', keys: ['T'], main: 'A new text', sub: 'T to read it', when: (G) => G.phone && G.phone.unread && G.phone.unread() > 0 },
  { id: 'fare', keys: ['W'], main: 'Someone wants an auto', sub: 'People waving show up green on the map. Stop right next to them and they get in', when: (G) => G.rides && G.rides.enabled && !G.player.onFoot },
  { id: 'damage', keys: ['M'], main: 'Your vehicle is hurt', sub: 'Garages fix it (on the map). Past 80% it smokes, past 90% it burns', when: (G) => !G.player.onFoot && (G.player.cur.dmg || 0) > 0.4 },
  { id: 'pet', keys: ['F'], main: 'An animal', sub: 'F to pet a dog or a cat. Mind them when you drive', when: (G) => G.player.onFoot && /pet the|cow for luck/i.test(G.hud.$('h-prompt-t')?.textContent || '') },
];
const KEY = 'nh48_tut', HKEY = 'nh48_hints';
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* fine */ } } };

export class Tutorial {
  constructor(G) {
    this.g = G; this.i = -1; this.hint = null; this.hintT = 0; this.checkT = 0;
    try { this.seenHints = new Set(JSON.parse(store.get(HKEY) || '[]')); } catch (e) { this.seenHints = new Set(); }
    const el = this.el = document.createElement('div');
    el.className = 'h coach'; el.hidden = true;
    (document.getElementById('ui') || document.body).appendChild(el);
  }
  get seen() { return store.get(KEY) === '1'; }
  start() {
    if (this.seen || this.g.free) return;
    this.i = 0; this.s = this.fresh(); this.show(STEPS[0], `${1} of ${STEPS.length}`);
  }
  fresh() { const P = this.g.player; return { t: 0, moved: 0, turned: 0, driven: 0, yaw: this.g.rig ? this.g.rig.yaw : 0, lx: P.x, lz: P.z }; }
  show(st, tag) {
    const k = st.keys.map(x => `<span class="kc${x.length > 2 ? ' w' : ''}">${x}</span>`).join('');
    this.el.innerHTML = `<div class="co-keys">${k}</div><div class="co-t"><b>${st.main}</b><span>${st.sub}</span></div>${tag ? `<em class="co-n">${tag}</em>` : ''}`;
    this.el.hidden = false; this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
  }
  hide() { this.el.hidden = true; }
  update(dt) {
    const G = this.g, P = G.player;
    if (G.state === 'title') { this.hide(); return; }
    if (this.i >= 0) {
      const s = this.s, st = STEPS[this.i];
      s.t += dt;
      const d = Math.hypot(P.x - s.lx, P.z - s.lz); s.lx = P.x; s.lz = P.z;
      if (d < 20) { if (P.onFoot) s.moved += d; else s.driven += d; }
      if (G.rig) { const y = G.rig.yaw; s.turned += Math.abs(Math.atan2(Math.sin(y - s.yaw), Math.cos(y - s.yaw))); s.yaw = y; }
      if (st.done(G, s) || s.t > 45) {
        G.audio && G.audio.blip && G.audio.blip();
        this.i++;
        if (this.i >= STEPS.length) {
          this.i = -1; store.set(KEY, '1');
          this.show({ keys: ['Esc'], main: 'You’re set', sub: 'Esc pauses; the Guide in there explains everything. Pune is yours.' }, '');
          this.hintT = 6; return;
        }
        this.s = this.fresh(); this.show(STEPS[this.i], `${this.i + 1} of ${STEPS.length}`);
      }
      return;
    }
    // a hint on screen: let it sit, then go
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.hide(); return; }
    if (G.free || G.state !== 'play') return;
    if ((this.checkT -= dt) > 0) return;
    this.checkT = 0.5;
    for (const h of HINTS) {
      if (this.seenHints.has(h.id)) continue;
      let ok = false; try { ok = h.when(G); } catch (e) { ok = false; }
      if (!ok) continue;
      this.seenHints.add(h.id); store.set(HKEY, JSON.stringify([...this.seenHints]));
      this.show(h, 'Tip'); this.hintT = 7;
      G.audio && G.audio.blip && G.audio.blip();
      break;
    }
  }
  objective() { return null; }                // the coach card does the teaching now
}
export function resetTutorial() { try { localStorage.removeItem(KEY); localStorage.removeItem(HKEY); } catch (e) { /* fine */ } }
