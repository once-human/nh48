import { testBench } from './commands.js';

// What /beta changes about the game once it's made, from the outside (no game file is edited):
//  - there's no auto of your own: you start on foot, and the auto the game keeps for you never shows up on the
//    street, on the map or in a prompt (any other vehicle, autos in traffic included, is yours to take as always)
//  - the title says Play instead of Story (there's no story here) and has no Experimental graphics: /beta is the new look
//  - the title has a Test bench: free roam with a terminal (commands.js)
export function betaGame(G) {
  const P = G.player;
  const hideAuto = () => {
    const A = P.auto;
    if (!A) return;
    if (P.cur === A && !P.onFoot) {
      // (the game put you in your auto: you're standing beside where it was instead)
      const s = Math.sin(A.th || 0), c = Math.cos(A.th || 0);
      P.teleportFoot(A.x - s * 1.8, A.z + c * 1.8, A.th || 0, G.traffic);
      if (G.rig) G.rig.inited = false;
    }
    const d = P.dropped && P.dropped.find(q => q.veh === A);
    if (d) P.removeDropped(d, G.traffic);
    if (A.root) A.root.visible = false;
    G.findAuto = false;
  };
  const frame = G.frame.bind(G);
  G.frame = (dt) => { hideAuto(); return frame(dt); };
  const start = G.startPlay.bind(G);
  G.startPlay = (shift) => { const r = start(shift); hideAuto(); return r; };
  testBench(G);
}

// the title screen (the HUD exists once the game's init has run)
export function betaTitle(G) {
  const H = G.hud, title = () => {
    const t = document.querySelector('#t-paint'); if (t) { t.hidden = true; t.style.display = 'none'; }
    const fr = document.querySelector('#t-free');
    if (fr && !document.querySelector('#t-test')) {
      const b = document.createElement('button'); b.className = 'pz-i'; b.id = 't-test'; b.textContent = 'Test bench';
      b.onclick = () => G.beginTest();
      fr.after(b);
    }
    const r = document.querySelector('#t-roam'); if (r && /^Story/.test(r.textContent)) r.textContent = r.textContent.replace(/^Story/, 'Play');
    for (const e of (H && H.title ? H.title.querySelectorAll('p, div') : [])) if (!e.children.length && /^Start at Shaniwar Wada\. Run an auto/.test(e.textContent)) e.textContent = 'Start at Shaniwar Wada, on foot. Misal on FC Road, a date in Baner.';
  };
  if (H && H.syncTitle) { const s = H.syncTitle.bind(H); H.syncTitle = (...a) => { const r = s(...a); title(); return r; }; }
  title();
}
