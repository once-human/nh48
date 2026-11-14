// Build Puneri into dist/: node tools/build.mjs
//   dist/index.html   the game, one page (inline CSS and JS)
//   dist/assets/...   map, textures, models, fonts and audio, fetched at runtime relative to the page
// This file lays out the assets and the manifest; tools/build-game.mjs (run from here) bundles the game and writes the page.
// three.js, its addons, postprocessing and n8ao load from jsDelivr through an import map.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { gameVersion } from './version.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const t0 = Date.now();
// fonts (data URIs; the artifact CSP allows data: fonts)
const NM = path.join(root, 'node_modules');
const DEV = 'U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const fontDefs = [
  // family, file, weight (range for variable), stretch, range
  ['Archivo', '@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2', '100 900', '62% 125%', LAT],
  ['Inter', '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', '100 900', 'normal', LAT],
  ...[400, 600, 700, 800].flatMap(w => [['Mukta', `@fontsource/mukta/files/mukta-devanagari-${w}-normal.woff2`, w, 'normal', DEV], ['Mukta', `@fontsource/mukta/files/mukta-latin-${w}-normal.woff2`, w, 'normal', LAT]]),
  ['Tiro Devanagari Marathi', '@fontsource/tiro-devanagari-marathi/files/tiro-devanagari-marathi-devanagari-400-normal.woff2', 400, 'normal', DEV],
  ['Tiro Devanagari Marathi', '@fontsource/tiro-devanagari-marathi/files/tiro-devanagari-marathi-latin-400-normal.woff2', 400, 'normal', LAT],
  ['Yatra One', '@fontsource/yatra-one/files/yatra-one-devanagari-400-normal.woff2', 400, 'normal', DEV],
  ['Yatra One', '@fontsource/yatra-one/files/yatra-one-latin-400-normal.woff2', 400, 'normal', LAT],
  ['Rozha One', '@fontsource/rozha-one/files/rozha-one-devanagari-400-normal.woff2', 400, 'normal', DEV],
  ['Rozha One', '@fontsource/rozha-one/files/rozha-one-latin-400-normal.woff2', 400, 'normal', LAT],
  ['Teko', '@fontsource/teko/files/teko-latin-500-normal.woff2', 500, 'normal', LAT],
  ['Teko', '@fontsource/teko/files/teko-latin-600-normal.woff2', 600, 'normal', LAT],
  // handwriting, Marathi and English (the diary, the paper tags in the jhola)
  ['Kalam', '@fontsource/kalam/files/kalam-devanagari-400-normal.woff2', 400, 'normal', DEV],
  ['Kalam', '@fontsource/kalam/files/kalam-latin-400-normal.woff2', 400, 'normal', LAT],
  ['Kalam', '@fontsource/kalam/files/kalam-devanagari-700-normal.woff2', 700, 'normal', DEV],
  ['Kalam', '@fontsource/kalam/files/kalam-latin-700-normal.woff2', 700, 'normal', LAT],
];
// fonts as their own files (cached by the browser, and the page itself arrives ~1.2 MB lighter)
let fontCss = '';
const FONT_OUT = path.join(root, 'dist/assets/fonts'); fs.mkdirSync(FONT_OUT, { recursive: true });
for (const [fam, file, w, st, range] of fontDefs) {
  const name = path.basename(file);
  fs.copyFileSync(path.join(NM, file), path.join(FONT_OUT, name));
  fontCss += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-stretch:${st};font-display:swap;src:url(assets/fonts/${name}) format('woff2');unicode-range:${range};}\n`;
}

// assets
const dist = path.join(root, 'dist');
fs.mkdirSync(path.join(dist, 'assets/tex'), { recursive: true });
const mapSrc = path.join(root, 'data/map.json');
// the map ships as gzip, base64-wrapped in a .txt (artifact hosting serves text, not .gz)
const mapOut = path.join(dist, 'assets/map.gz.txt');
if (!fs.existsSync(mapOut) || fs.statSync(mapOut).mtimeMs < fs.statSync(mapSrc).mtimeMs) fs.writeFileSync(mapOut, zlib.gzipSync(fs.readFileSync(mapSrc), { level: 9 }).toString('base64'));
if (fs.existsSync(path.join(dist, 'assets/map.json.gz'))) fs.unlinkSync(path.join(dist, 'assets/map.json.gz'));
const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const s = path.join(from, f), d = path.join(to, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else if (f.endsWith('.glb')) {
      // models ship gzipped (.glb.gz, unpacked in the browser); the old base64 text form was a third bigger
      const out = d + '.gz';
      if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(s).mtimeMs) fs.writeFileSync(out, zlib.gzipSync(fs.readFileSync(s), { level: 9 }));
      if (fs.existsSync(d + '.gz.txt')) fs.unlinkSync(d + '.gz.txt');
      if (fs.existsSync(d)) fs.unlinkSync(d);
    }
    else if (!fs.existsSync(d) || fs.statSync(d).mtimeMs < fs.statSync(s).mtimeMs) fs.copyFileSync(s, d);
  }
};
for (const f of fs.readdirSync(path.join(root, 'assets'))) {
  if (f === 'voice') continue;
  const s = path.join(root, 'assets', f), d = path.join(dist, 'assets', f);
  if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
}
// whole-Pune tiles (when baked): copied as they are, gzip JSON fetched by the tile streamer
const puneSrc = path.join(root, 'data/pune');
if (fs.existsSync(puneSrc)) copyDir(puneSrc, path.join(dist, 'assets/pune'));
// voice lines: concatenated into one .mp3 (one request instead of a hundred; still a valid audio/mpeg file); offsets go in the manifest
const voiceDir = path.join(root, 'assets/voice');
const voiceIndex = {};
if (fs.existsSync(voiceDir)) {
  // three packs: the street, police and passengers load with the game; the shopkeepers (k_) and the
  // people you talk to (d_) arrive in the background once you're playing
  // (and pk_, the character screen's eight lines, ride with the game itself so the menu can speak)
  // (and vb_, the voice bank of the street, police, radio and vendors: its own pack, read a clip at a time)
  const packOf = (id) => id.startsWith('vb2_') ? 5 : id.startsWith('vb_') ? 4 : id.startsWith('pk_') ? 3 : id.startsWith('d_') ? 2 : id.startsWith('k_') ? 1 : 0, names = ['voices.mp3', 'voices_k.mp3', 'voices_d.mp3', 'voices_pk.mp3', 'voices_vb.mp3', 'voices_vb2.mp3'];
  const parts = [[], [], [], [], [], []], off = [0, 0, 0, 0, 0, 0];
  for (const f of fs.readdirSync(voiceDir).filter(f => f.endsWith('.mp3')).sort()) {
    const b = fs.readFileSync(path.join(voiceDir, f)), id = f.replace(/\.mp3$/, ''), k = packOf(id);
    voiceIndex[id] = k ? [off[k], b.length, k] : [off[k], b.length]; parts[k].push(b); off[k] += b.length;
  }
  names.forEach((n, k) => fs.writeFileSync(path.join(dist, 'assets', n), Buffer.concat(parts[k])));
  fs.rmSync(path.join(dist, 'assets/voice'), { recursive: true, force: true });
}
// manifest with byte sizes (honest progress bar)
const sizes = {}, hashes = {};
const walk = (d, rel = '') => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const r = rel ? rel + '/' + f : f; if (fs.statSync(p).isDirectory()) walk(p, r); else { sizes['assets/' + r] = fs.statSync(p).size; hashes['assets/' + r] = crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 10); } } };
walk(path.join(dist, 'assets'));
// streamed Pune (a thousand map pieces and pictures): one version for the whole folder instead of an entry per
// file in the page; every URL under it carries ?v=<that>
const puneHash = crypto.createHash('sha1');
for (const k of Object.keys(hashes).sort()) if (k.startsWith('assets/pune/') || k.startsWith('assets/fonts/')) { puneHash.update(k + hashes[k]); if (!/base\.json\.gz$/.test(k)) { delete hashes[k]; delete sizes[k]; } }
const PV = puneHash.digest('hex').slice(0, 10);

// the version, read off the history of changes (tools/version.mjs): nothing to raise by hand
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { version: VER, build: NUM, how: HOW } = gameVersion(root, pkg.changes);
let SHA = process.env.VERCEL_GIT_COMMIT_SHA || ''; try { SHA = SHA || execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* no git */ }
SHA = SHA.slice(0, 7);
globalThis.__nhBuild = {
  fontCss,
  manifest: JSON.stringify({ ...sizes, __voices: voiceIndex, __v: hashes, __pv: PV, __built: new Date().toISOString(), __ver: VER, __sha: SHA, __num: NUM }),
};
const assetTotal = Object.values(sizes).reduce((a, b) => a + b, 0);
console.log(`assets in ${Date.now() - t0}ms  ${(assetTotal / 1024).toFixed(0)}KB in ${Object.keys(sizes).length} files  Version ${VER} (${NUM}) ${SHA}, ${HOW}`);
for (const f of ['test.html', 'beta', 'experiment']) fs.rmSync(path.join(dist, f), { recursive: true, force: true });
await import('./build-game.mjs');
