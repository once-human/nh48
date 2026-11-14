// Live: one of the game's three modes (story, free roam, live; G.mode says which), started with G.beginLive.
// Live: Puneri's mode for the city as it is right now. It never stops: Esc brings the menu up over a world that goes on
// (the traffic, the people, the voices), heard a little muffled and a little quieter behind it, and with the window in
// the background the city still runs (on a timer: the browser stops drawing a hidden page). The city as it is right now. The clock is Pune's (IST, second for second, so it's dark when it's dark
// there) and the sky is Pune's: the weather as reported this minute for the middle of the city (Open-Meteo: free, no key,
// fetched every ten minutes; no data of yours goes anywhere). Free roam's rules otherwise, so your story game is left
// alone. This is the mode other players will share later; for now it's the world, live.
const PUNE = { lat: 18.5204, lon: 73.8567 };
const URL_ = `https://api.open-meteo.com/v1/forecast?latitude=${PUNE.lat}&longitude=${PUNE.lon}&current=weather_code,cloud_cover,visibility,precipitation,temperature_2m&timezone=Asia%2FKolkata`;
const EVERY = 10*60*1000;

// the hour in Pune now, as a fraction (IST is UTC + 5:30 all year)
export const istHour = (d = new Date()) => (((d.getUTCHours() + d.getUTCMinutes()/60 + d.getUTCSeconds()/3600 + d.getUTCMilliseconds()/3.6e6 + 5.5) % 24) + 24) % 24;
// WMO weather code (and what else was reported) to one of the game's skies
export function skyOf(c) {
  const w = c.weather_code ?? 0, vis = c.visibility ?? 20000, cloud = c.cloud_cover ?? 0;
  if (w >= 95) return 'storm';
  if ((w >= 51 && w <= 67) || (w >= 80 && w <= 82)) return w === 65 || w === 82 ? 'storm' : 'rain';
  if (w === 45 || w === 48) return 'fog';
  if (vis < 4000) return vis < 1000 ? 'fog' : 'haze';
  if (w === 3 || cloud > 70) return 'cloudy';
  if (vis < 8000) return 'haze';
  return 'clear';
}
const WORD = { clear: 'clear', cloudy: 'overcast', haze: 'hazy', rain: 'raining', storm: 'thunderstorm', fog: 'foggy' };

export function liveMode(G) {
  const L = { on: false, kind: null, temp: null, at: 0, err: null, t: 0 };
  G.liveState = L;
  async function fetchSky() {
    L.at = Date.now();
    try {
      const r = await fetch(URL_, { cache: 'no-store' }); if (!r.ok) throw new Error('weather ' + r.status);
      const j = await r.json(), c = j.current || {};
      L.kind = skyOf(c); L.temp = c.temperature_2m; L.err = null;
      if (L.on && G.weather) G.weather.set(L.kind);
    } catch (e) { L.err = String(e.message || e); }
  }
  const label = () => {
    const m = document.getElementById('h-mode'); if (!m) return;
    const h = istHour(), hh = Math.floor(h), mm = Math.floor(h%1*60);
    m.textContent = `Live · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} IST${L.kind ? ` · ${WORD[L.kind]}${L.temp !== null && L.temp !== undefined ? `, ${Math.round(L.temp)}°C` : ''}` : ''}`;
  };
  function start() {
    L.on = true; G.live = true;
    G.beginFree();
    G.setHour(istHour());
    fetchSky();
    setTimeout(() => G.hud?.toast?.('Live', 'Real time, real weather. Nothing pauses', 'info', 5), 1500);
  }
  G.beginLive = start;
  // the title: Live, its own entry after Free roam
  const button = () => {
    const f = document.querySelector('#t-free'); if (!f) return false;
    if (document.querySelector('#t-live')) return true;
    const b = document.createElement('button'); b.className = 'pz-i'; b.id = 't-live'; b.textContent = 'Live';
    b.title = 'Real time and real weather. The world never pauses';
    f.after(b); b.onclick = start; return true;
  };
  const poll = () => { if (!button()) setTimeout(poll, 400); }; poll();
  // every frame while it's on: the hour is Pune's; the sky is checked again every ten minutes
  const frame = G.frame.bind(G);
  G.frame = (dt) => {
    const r = frame(dt);
    if (L.on) {
      if (!G.free) { L.on = false; G.live = false; return r; }
      G.hour = istHour();
      if (Date.now() - L.at > EVERY) fetchSky();
      L.t += dt; if (L.t > 1) { L.t = 0; label(); if (L.kind && G.weather && G.weather.kind !== L.kind) G.weather.set(L.kind); }
    }
    return r;
  };
  // (the HUD writes its own mode name now and then: while live, it's ours)
  const sm = G.hud && G.hud.setMode;
  if (sm) G.hud.setMode = function (...a) { const r = sm.apply(this, a); if (L.on) label(); return r; };
  // never paused: the menu comes up over a running world, which you hear muffled behind it
  const A = () => G.audio;
  const muffle = (on) => {
    const a = A(); if (!a || !a.ctx || !a.muf) return;
    const t = a.ctx.currentTime;
    if (a.ctx.state === 'suspended') a.ctx.resume();
    a.muf.frequency.setTargetAtTime(on ? 2400 : 20000, t, 0.25);
    a.master.gain.setTargetAtTime(a.volume*(on ? 0.62 : 1), t, 0.25);
  };
  const hush = A() && A().hush && A().hush.bind(A());
  if (hush) A().hush = (on) => { if (L.on) { muffle(on); return; } return hush(on); };
  const tp = G.togglePause.bind(G);
  G.togglePause = (force) => { const r = tp(force); if (L.on) { G.livePause = G.state === 'pause'; muffle(G.state !== 'play'); const t = G.hud?.pause?.querySelector?.('.p-title'); if (t) t.textContent = G.state === 'pause' ? 'Menu · the city goes on' : 'Paused'; } return r; };
  // the world under the menu: it runs as in play, with your own keys kept out of it
  const run = (dt) => {
    const was = G.state; G.state = 'play';
    try { G.input?.keys?.clear?.(); G.input?.pressed?.clear?.(); frame(dt); } finally { if (G.state === 'play') G.state = was; }
  };
  const inner = G.frame;
  G.frame = (dt) => { if (L.on && (G.state === 'pause' || G.state === 'map')) { run(dt); G.hour = istHour(); return; } return inner(dt); };
  // a hidden window gets no frames: a timer keeps the city going (and the clock is the real one whatever happens)
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), el = Math.min(2, (now - last)/1000); last = now;
    if (!L.on || !document.hidden) return;
    for (let t = el; t > 0.001; t -= 0.1) { const d = Math.min(0.1, t); if (G.state === 'play') inner(d); else run(d); }
  }, 200);
  document.addEventListener('visibilitychange', () => { last = performance.now(); if (L.on) muffle(document.hidden || G.state !== 'play'); });
  window.addEventListener('blur', () => { if (L.on) muffle(true); });
  window.addEventListener('focus', () => { if (L.on) muffle(G.state !== 'play'); });
  const leave = G.leaveFree.bind(G);
  G.leaveFree = (...a) => { L.on = false; G.live = false; G.livePause = false; muffle(false); return leave(...a); };
}
