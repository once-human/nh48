// Somebody has to serve you. A counter, a bar or a barber's chair works only while one of the people who work it is
// on their feet: knock out the bartender and the bar is shut to you until they get up; kill the only shopkeeper and
// nobody sells you anything again. The carts on the street are the same: the chai, paan, vada pav, fruit, flower and
// sugarcane carts sell through whoever is standing behind them, and with nobody there there's nothing to buy.
import { Interiors } from '@orig/world/interiors.js';
import { Shops } from '@orig/game/shops.js';

// who works what
const WORKS = { counter: ['keeper', 'teller', 'helper'], bar: ['bartender', 'keeper'], chair: ['barber', 'keeper'], vehicle: ['keeper', 'helper'], atm: null };
const down = (p) => !p || p.corpse || p.dead || p.ko || p.fallen > 0 || p.hidden || p.mode === 'flee';

const use = Interiors.prototype.use;
Interiors.prototype.use = function (s) {
  const C = this.cur, G = this.g, roles = C && WORKS[s.kind];
  if (roles) {
    const R = C.R;
    if (!C._staff) C._staff = (R.people || []).map((k, i) => ({ p: R.peds[i], role: k.role }));
    const crew = C._staff.filter(x => roles.includes(x.role));
    if (crew.length && crew.every(x => down(x.p))) {
      const dead = crew.every(x => x.p && (x.p.corpse || x.p.dead));
      G.hud.toast(s.kind === 'bar' ? 'Nobody behind the bar' : s.kind === 'chair' ? 'Nobody to cut your hair' : 'Nobody at the counter',
        dead ? 'Nobody is serving anyone here now' : 'Not while they’re on the floor', 'warn', 2.4);
      return;
    }
  }
  return use.call(this, s);
};

// the carts: what each sells (people/peds.js VENDOR kinds) and what it's called
const CART = { 0: ['tapri', 'Chai cart'], 1: ['paan', 'Paan stall'], 2: ['misal', 'Vada pav cart'], 3: ['juice', 'Fruit cart'], 4: ['florist', 'Flower stall'], 5: ['juice', 'Sugarcane juice cart'] };
const scan = Shops.prototype.scan;
Shops.prototype.scan = function () {
  scan.call(this);
  const G = this.g, P = G.player, I = G.interiors;
  if (!P.onFoot || (I && I.inside) || !G.people) return;
  const best = this.near, bd = best && best.x !== undefined ? Math.hypot(best.x - P.x, best.z - P.z) : 1e9;
  let v = null, vd = 2.2;
  for (const p of G.people.list) {
    if (!p.vendor || down(p) || p.mode === 'fight') continue;
    const d = Math.hypot(p.x - P.x, p.z - P.z);
    if (d < vd) { vd = d; v = p; }
  }
  if (!v || vd > bd) return;
  const c = CART[v.vendor.kind] || CART[0];
  this.near = { kind: c[0], name: c[1], mr: '', x: v.x, z: v.z, door: null, cart: true, vendor: v, tier: 'local' };
};

// ---------------------------------------------------------------- who you know, over their heads (inside)
// black heart: your partner (or they said I love you back); blue heart: in your phone and someone you could see;
// a small dot: anyone else in your phone (family, friends, people from the story); nothing over strangers
import * as THREE from 'three';
Interiors.prototype.heartKind = function (p) {
  const D = this.g.date, ct = D && p.name && (D.contacts || []).find(c => c.name === p.name && !c.done);
  if (ct && (ct.partner || ct.saidLove)) return 'partner';
  if (ct || p.dateWith) return p.dateWith || (D.eligible && D.eligible(p)) ? 'seeing' : 'contact';
  return p.aai || p.story ? 'contact' : 'new';
};
const mark = Interiors.prototype.markHearts;
Interiors.prototype.markHearts = function (R) {
  if (!this.heartMats) this.heartMats = { new: this.heartTex('#ff5c7a', '#2a0a12'), seeing: this.heartTex('#3d8bff', '#06142e'), partner: this.heartTex('#111114', '#f4f1ea') };
  if (!this.heartMats.contact) {
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.beginPath(); x.arc(16, 16, 11, 0, 7); x.fill(); x.fillStyle = '#3d8bff'; x.beginPath(); x.arc(16, 16, 7, 0, 7); x.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.heartMats.contact = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  }
  mark.call(this, R);
  for (const m of R.hearts || []) if (this.heartKind(m.userData.p) === 'contact') m.scale.setScalar(0.09);
};
