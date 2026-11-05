// Live Pune: the city as it is right now. The clock is Pune's (IST, second for second, so it's dark when it's dark
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
    setTimeout(() => G.hud?.toast?.('Live Pune', 'Pune\'s own clock and sky, right now', 'info', 5), 1500);
  }
  // the title: Live Pune, under Free roam
  const button = () => {
    const f = document.querySelector('#t-free'); if (!f) return false;
    if (document.querySelector('#t-live')) return true;
    const b = document.createElement('button'); b.className = 'pz-i'; b.id = 't-live'; b.textContent = 'Live Pune';
    b.title = 'Pune right now: the real time and the real weather';
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
  const leave = G.leaveFree.bind(G);
  G.leaveFree = (...a) => { L.on = false; G.live = false; return leave(...a); };
}
