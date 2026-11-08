// You start with a pistol: a katta and a dozen rounds in the jhola, on the wheel (hold Z), from your first minute in a
// new game or an old save. Once only: sell it or lose it and it doesn't come back.
const G0 = () => window.__nhAskG;
const tick = () => {
  const G = G0(), L = G && G.life && G.life.s;
  if (!L || G.state !== 'play') { setTimeout(tick, 1000); return; }
  if (L._pistol0) return;
  L._pistol0 = true;
  L.inv = L.inv || {}; L.inv.katta = Math.max(1, L.inv.katta || 0); L.ammo = Math.max(12, L.ammo || 0);
  const q = L.quick = (L.quick || []).slice(0, 5); while (q.length < 5) q.push(null);
  if (!q.includes('katta')) { const i = q.indexOf(null); q[i >= 0 ? i : 4] = 'katta'; }
};
setTimeout(tick, 1000);
