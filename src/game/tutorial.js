// The first minutes, taught by doing: one thing at a time as the objective line, with its key, and on to the
// next the moment you've done it. No card to read. It runs once (and again from Start over).
const STEPS = [
  { main: 'Walk to the garden path', sub: 'W A S D to walk · hold Shift to run', done: (G, s) => s.moved > 6 },
  { main: 'Look around', sub: 'Move the mouse · this is Shaniwar Wada, the Peshwas’ fort, 1732', done: (G, s) => s.turned > 1.2 || s.t > 7 },
  { main: 'Get to your auto', sub: 'Follow the yellow marker by the garden · F to get in', done: (G) => !G.player.onFoot },
  { main: 'Take it for a spin', sub: 'W go · S brake and reverse · A D steer · Space handbrake', done: (G, s) => s.driven > 60 },
  { main: 'Open the map', sub: 'M · find places, set a waypoint, see your auto', done: (G) => G.state === 'map' },
  { main: 'Check your phone', sub: 'T · texts, contacts, and everything you’ll need', done: (G) => G.phone && G.phone.on },
  { main: 'Your jhola', sub: 'E · food, water and whatever you buy', done: (G) => (G.bag && G.bag.open) || (G.jhola && G.jhola.open) },
];
const KEY = 'nh48_tut';

export class Tutorial {
  constructor(G) { this.g = G; this.i = -1; }
  get seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  start() {
    if (this.seen) return;
    this.i = 0; this.s = this.fresh();
  }
  fresh() { const P = this.g.player; return { t: 0, x: P.x, z: P.z, moved: 0, turned: 0, driven: 0, yaw: this.g.rig ? this.g.rig.yaw : 0, lx: P.x, lz: P.z }; }
  update(dt) {
    if (this.i < 0) return;
    const G = this.g, P = G.player, s = this.s, st = STEPS[this.i];
    s.t += dt;
    const d = Math.hypot(P.x - s.lx, P.z - s.lz); s.lx = P.x; s.lz = P.z;
    if (d < 20) { if (P.onFoot) s.moved += d; else s.driven += d; }
    if (G.rig) { const y = G.rig.yaw; s.turned += Math.abs(Math.atan2(Math.sin(y - s.yaw), Math.cos(y - s.yaw))); s.yaw = y; }
    if (st.done(G, s) || s.t > 45) {
      G.audio && G.audio.blip && G.audio.blip();
      this.i++;
      if (this.i >= STEPS.length) {
        this.i = -1;
        try { localStorage.setItem(KEY, '1'); } catch (e) { /* fine */ }
        G.later(0.8, () => G.hud.toast('You’re set', 'Esc pauses (the Guide in there explains everything). Pune is yours.', 'good', 5));
        return;
      }
      this.s = this.fresh();
    }
  }
  objective() {
    if (this.i < 0) return null;
    const st = STEPS[this.i];
    return { main: st.main, sub: `${st.sub}  ·  ${this.i + 1} of ${STEPS.length}` };
  }
}
export function resetTutorial() { try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } }
