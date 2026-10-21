// Build NH48 into dist/:
//   dist/index.html   – page body for the artifact (inline CSS, fonts as data URIs, inline ES module)
//   dist/test.html    – the same page wrapped in a full document, for local tests over http
//   dist/assets/...   – map, textures, models and audio, fetched at runtime relative to the page
// three.js, its addons, postprocessing and n8ao load from jsDelivr through an import map.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dev = process.argv.includes('--dev');
const t0 = Date.now();
const V = { three: '0.186.1', pp: '6.39.5', n8ao: '2.0.1' };
const IMPORTS = {
  three: `https://cdn.jsdelivr.net/npm/three@${V.three}/build/three.module.min.js`,
  'three/addons/': `https://cdn.jsdelivr.net/npm/three@${V.three}/examples/jsm/`,
  'three/examples/jsm/': `https://cdn.jsdelivr.net/npm/three@${V.three}/examples/jsm/`,
  postprocessing: `https://cdn.jsdelivr.net/npm/postprocessing@${V.pp}/build/index.js`,
  n8ao: `https://cdn.jsdelivr.net/npm/n8ao@${V.n8ao}/dist/N8AO.js`,
};
// NH_LOCAL=1: serve the libraries from node_modules (for tests where the CDN can't be reached)
if (process.env.NH_LOCAL) {
  IMPORTS.three = './nm/three/build/three.module.js';
  IMPORTS['three/addons/'] = IMPORTS['three/examples/jsm/'] = './nm/three/examples/jsm/';
  IMPORTS.postprocessing = './nm/postprocessing/build/index.js';
  IMPORTS.n8ao = './nm/n8ao/dist/N8AO.js';
}
const res = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, format: 'esm', minify: !dev, sourcemap: false, write: false, legalComments: 'none',
  target: ['es2022', 'chrome100', 'safari16', 'firefox110'],
  external: ['three', 'three/addons/*', 'three/examples/jsm/*', 'postprocessing', 'n8ao'],
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
  plugins: [{
    // ez-tree imports its bundled bark/leaf images from ./textures; NH48 brings its own
    name: 'eztree-textures',
    setup(b) {
      b.onResolve({ filter: /^\.\/textures$/ }, (a) => (a.importer.includes('ez-tree') ? { path: path.join(root, 'src/gfx/eztreeStub.js') } : undefined));
    },
  }],
});
const js = res.outputFiles[0].text;

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
];
let fontCss = '';
for (const [fam, file, w, st, range] of fontDefs) {
  const b64 = fs.readFileSync(path.join(NM, file)).toString('base64');
  fontCss += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-stretch:${st};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range};}\n`;
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
      // models ship as gzip+base64 text: the artifact host doesn't serve .glb
      const out = d + '.gz.txt';
      if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(s).mtimeMs) fs.writeFileSync(out, zlib.gzipSync(fs.readFileSync(s), { level: 9 }).toString('base64'));
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
  const packOf = (id) => id.startsWith('d_') ? 2 : id.startsWith('k_') ? 1 : 0, names = ['voices.mp3', 'voices_k.mp3', 'voices_d.mp3'];
  const parts = [[], [], []], off = [0, 0, 0];
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

const tpl = fs.readFileSync(path.join(root, 'src/page.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
const importMap = `<script type="importmap">${JSON.stringify({ imports: IMPORTS })}</script>`;
const body = tpl
  .replace('/*FONTS*/', () => fontCss)
  .replace('/*CSS*/', () => css)
  .replace('<!--IMPORTMAP-->', () => importMap)
  .replace('/*MANIFEST*/', () => JSON.stringify({ ...sizes, __voices: voiceIndex, __v: hashes }))
  .replace('/*JS*/', () => js.replace(/<\/script/gi, '<\\/script'));
fs.writeFileSync(path.join(dist, 'index.html'), body);
fs.writeFileSync(path.join(dist, 'test.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:dark}body{margin:0}[hidden]{display:none!important}</style></head><body>${body}</body></html>`);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
const assetTotal = Object.values(sizes).reduce((a, b) => a + b, 0);
console.log(`built in ${Date.now() - t0}ms  page ${kb(body.length)} (js ${kb(js.length)}, fonts ${kb(fontCss.length)})  assets ${kb(assetTotal)} in ${Object.keys(sizes).length} files`);
