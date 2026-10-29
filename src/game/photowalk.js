// #PuneriPhotowalk: Pune's landmarks are the collectibles. Take a photo (K, then Space) with a landmark in frame
// and close enough, and it goes up on Punegram: likes roll in, a small brand deal for each, a big one for all of
// them. Saved with your life (s.photowalk).
const MR = { shaniwar: 'शनिवारवाडा', dagdusheth: 'दगडूशेठ', mandai: 'मंडई', station: 'पुणे स्टेशन', agakhan: 'आगाखान पॅलेस', lalmahal: 'लाल महाल', parvati: 'पर्वती' };
export class Photowalk {
  constructor(G) { this.g = G; }
  get done() { const s = this.g.life.s; return s.photowalk || (s.photowalk = []); }
  onPhoto(x, z) {
    const G = this.g, C = G.camera;
    if (!C || G.free) return;
    const fx = -Math.sin(C.rotation.y), fz = -Math.cos(C.rotation.y);
    const dir = new C.position.constructor(); C.getWorldDirection(dir);
    let best = null, bd = 1e9;
    for (const L of G.W.landmarks || []) {
      if (this.done.includes(L.id)) continue;
      const dx = L.x - C.position.x, dz = L.z - C.position.z, d = Math.hypot(dx, dz), reach = 40 + Math.max(L.w || 0, L.d || 0) * 0.6;
      if (d > reach) continue;
      const facing = (dx * dir.x + dz * dir.z) / (d || 1);
      if (facing < 0.55) continue;                                   // it has to be in the picture
      if (d < bd) { bd = d; best = L; }
    }
    void fx; void fz;
    if (!best) return;
    this.done.push(best.id); G.life.save();
    const all = (G.W.landmarks || []).length, n = this.done.length;
    const likes = Math.round(400 + Math.random() * 2400 + n * 150), deal = 300 + n * 100;
    G.stats.money += deal; G.saveStats && G.saveStats(); G.audio && G.audio.cash && G.audio.cash();
    const tag = '#' + best.name.replace(/[^A-Za-z0-9]/g, '');
    G.later(1.2, () => G.hud.toast(`Posted · ${tag}`, `${likes.toLocaleString('en-IN')} likes · a brand deal ₹${deal} · #PuneriPhotowalk ${n} of ${all}`, 'good', 4.5));
    if (n === all) G.later(5.5, () => { G.stats.money += 25000; G.saveStats && G.saveStats(); G.hud.toast('Every landmark in Pune', 'You’re a Puneri influencer now: ₹25,000 from a phone brand that wants you on their billboard', 'good', 6); });
    if (n === 1) G.later(6, () => G.hud.sms && G.hud.sms('Punegram', `Your ${MR[best.id] || best.name} post is blowing up. Photograph every landmark in Pune for #PuneriPhotowalk: brands are watching.`, '', `${n} of ${all}`));
  }
}
