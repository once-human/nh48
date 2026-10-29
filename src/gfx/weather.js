// Weather: clear, cloudy, haze, rain, a monsoon storm (lightning, thunder), fog. It works on top of the time of day:
// cloud cover and darker cloud bases in the sky, less sun and more haze, rain falling around the camera (streaks
// that lean with the wind), rain on the roofs in your ears, lightning that lights the city for a blink and the
// thunder a few seconds later. In free roam you pick it (pause → Settings); in your story it follows Pune's year:
// the monsoon from June to September, winter mornings in fog, summer afternoons in haze.
import * as THREE from 'three';

export const WEATHERS = {
  clear: { cloud: 0.1, rain: 0, fog: 0, haze: 0 },
  cloudy: { cloud: 0.85, rain: 0, fog: 0.1, haze: 0.1 },
  haze: { cloud: 0.25, rain: 0, fog: 0.15, haze: 0.9 },
  rain: { cloud: 1, rain: 0.6, fog: 0.35, haze: 0.2 },
  storm: { cloud: 1, rain: 1, fog: 0.55, haze: 0.3, lightning: true },
  fog: { cloud: 0.6, rain: 0, fog: 1, haze: 0.4 },
};
const N = 5000, BOX = 36, H = 26;

export class Weather {
  constructor(scene, audio) {
    this.audio = audio; this.kind = 'clear'; this.cur = { ...WEATHERS.clear }; this.flash = 0; this.nextBolt = 8;
    const pos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const x = (Math.random() - 0.5) * BOX * 2, y = Math.random() * H, z = (Math.random() - 0.5) * BOX * 2; pos.set([x, y, z, x, y - 0.6, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color: 0xaab8c6, transparent: true, opacity: 0, depthWrite: false, fog: true });
    this.lines = new THREE.LineSegments(g, this.mat); this.lines.frustumCulled = false; this.lines.visible = false;
    scene.add(this.lines);
    this.pos = pos; this.wind = 0.18;
  }
  set(kind) { if (WEATHERS[kind]) this.kind = kind; }
  // story mode: what the sky does today, from the month and the hour (the same all day, a new roll each day)
  auto(day, hour) {
    const m = new Date().getMonth(), r = Math.abs(Math.sin(day * 12.9898 + 78.233) * 43758.5453) % 1;
    let k = 'clear';
    if (m >= 5 && m <= 8) k = r < 0.45 ? 'rain' : r < 0.62 ? 'storm' : r < 0.9 ? 'cloudy' : 'clear';
    else if (m === 11 || m <= 1) k = hour > 4.5 && hour < 9.5 && r < 0.6 ? 'fog' : r < 0.2 ? 'haze' : 'clear';
    else if (m >= 2 && m <= 4) k = hour > 12 && hour < 18 && r < 0.5 ? 'haze' : 'clear';
    else k = r < 0.2 ? 'cloudy' : r < 0.28 ? 'rain' : 'clear';
    this.kind = k;
  }
  get raining() { return this.cur.rain > 0.15; }
  // after the sky has set the time of day
  apply(dt, sky, scene, renderer, camera) {
    const T = WEATHERS[this.kind], c = this.cur, k = 1 - Math.exp(-dt * 0.35);
    for (const key of ['cloud', 'rain', 'fog', 'haze']) c[key] += (T[key] - c[key]) * k;
    const u = sky.uniforms;
    if (u && u.uCover) u.uCover.value = 0.72 + 0.28 * c.cloud + c.rain * 0.3;
    if (u && u.uCloudS) u.uCloudS.value.multiplyScalar(1 - c.rain * 0.55);
    if (u && u.uCloudL) u.uCloudL.value.multiplyScalar(1 - c.cloud * 0.35 - c.rain * 0.25);
    if (u && u.uSunVis) u.uSunVis.value *= 1 - c.cloud * 0.9;
    sky.sun.intensity *= 1 - c.cloud * 0.72;
    sky.hemi.intensity *= 1 - c.rain * 0.25;
    renderer.toneMappingExposure *= 1 - c.cloud * 0.12 - c.rain * 0.08;
    scene.fog.density *= 1 + c.fog * 7 + c.haze * 2.2 + c.rain * 1.5;
    if (c.fog > 0.05 || c.rain > 0.05) scene.fog.color.lerp(_grey.setRGB(0.55, 0.57, 0.6), Math.min(0.75, c.fog * 0.6 + c.rain * 0.4));
    if (c.haze > 0.05) scene.fog.color.lerp(_haze.setRGB(0.78, 0.72, 0.6), c.haze * 0.45);
    // lightning
    if (T.lightning && c.rain > 0.6) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.nextBolt = 6 + Math.random() * 16; this.flash = 1; const delay = 0.6 + Math.random() * 4; setTimeout(() => this.audio && this.audio.thunder && this.audio.thunder(1 - delay / 6), delay * 1000); }
    }
    if (this.flash > 0) { const f = this.flash > 0.7 || (this.flash > 0.35 && this.flash < 0.5) ? 1 : 0.25; sky.hemi.intensity += 9 * f * this.flash; renderer.toneMappingExposure *= 1 + 0.9 * f * this.flash; this.flash = Math.max(0, this.flash - dt * 3.2); }
    // the rain itself, around the camera
    const on = c.rain > 0.03;
    this.lines.visible = on;
    if (on) {
      this.mat.opacity = Math.min(0.5, c.rain * 0.55);
      const p = this.pos, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, sp = 22 * dt, n = Math.floor(N * Math.min(1, 0.25 + c.rain));
      const lean = this.wind * 0.6;
      for (let i = 0; i < N; i++) {
        const o = i * 6;
        if (i >= n) { p[o + 1] = p[o + 4] = -999; continue; }
        let x = p[o], y = p[o + 1] - sp, z = p[o + 2];
        if (y < cy - 4 || y > cy + H || Math.abs(x - cx) > BOX || Math.abs(z - cz) > BOX) { x = cx + (Math.random() - 0.5) * BOX * 2; z = cz + (Math.random() - 0.5) * BOX * 2; y = cy + H * (0.4 + Math.random() * 0.6); }
        x += lean * sp * 0.05;
        p[o] = x; p[o + 1] = y; p[o + 2] = z; p[o + 3] = x - lean * 0.6; p[o + 4] = y - 0.55 - c.rain * 0.35; p[o + 5] = z;
      }
      this.lines.geometry.attributes.position.needsUpdate = true;
    }
    if (this.audio && this.audio.rain) this.audio.rain(c.rain);
  }
}
const _grey = new THREE.Color(), _haze = new THREE.Color();
