// Build /experiment (a painted street, from scratch, and a stress test) into dist/experiment/index.html.
// Nothing of the game goes into it. The fonts are the game's own files (dist/assets/fonts, from tools/build.mjs).
// three.js loads from jsDelivr through an import map; NH_LOCAL=1 serves it from dist/nm instead.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dev = process.argv.includes('--dev');
const t0 = Date.now();
const THREE_V = '0.186.1';
const imports = process.env.NH_LOCAL
  ? { three: '/nm/three/build/three.module.js', 'three/addons/': '/nm/three/examples/jsm/' }
  : { three: `https://cdn.jsdelivr.net/npm/three@${THREE_V}/build/three.module.min.js`, 'three/addons/': `https://cdn.jsdelivr.net/npm/three@${THREE_V}/examples/jsm/` };

const res = await esbuild.build({
  entryPoints: [path.join(root, 'src/experiment/main.js')],
  bundle: true, format: 'esm', minify: !dev, write: false, legalComments: 'none',
  target: ['es2022', 'chrome100', 'safari16', 'firefox110'], external: ['three', 'three/addons/*'], logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const CSS = `
@font-face{font-family:'Archivo';font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:url(/assets/fonts/archivo-latin-standard-normal.woff2) format('woff2')}
:root{--paper:#f3efe6;--ink:#171411;--soft:#6b645a;--red:#d8321e;--line:rgba(23,20,17,.16);color-scheme:light}
*{box-sizing:border-box}
html,body{margin:0;height:100%;overflow:hidden;background:#f3efe6;color:var(--ink);font:13px/1.35 'Archivo',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
canvas{display:block;position:fixed;inset:0;touch-action:none;cursor:crosshair}
#loading{position:fixed;inset:0;display:grid;place-content:center;gap:10px;background:var(--paper);z-index:9;transition:opacity .5s;text-align:center}
#loading.done{opacity:0;pointer-events:none}
#loading b{font-weight:900;font-stretch:125%;font-size:clamp(56px,11vw,140px);letter-spacing:-.05em;line-height:.85}
#loading span{color:var(--soft);font-size:14px}
#hud{position:fixed;top:16px;left:16px;width:288px;max-height:calc(100% - 32px);overflow:auto;background:var(--paper);border:1.5px solid var(--ink);padding:14px 14px 12px;z-index:2;
  clip-path:polygon(0 1%,3% 0,40% .6%,72% 0,100% .8%,99.4% 30%,100% 64%,99.2% 100%,60% 99.3%,24% 100%,.6% 99.2%,0 70%,.8% 36%);box-shadow:3px 3px 0 rgba(23,20,17,.18)}
#hud.hide{display:none}
.ttl b{display:block;font-weight:900;font-stretch:125%;font-size:46px;letter-spacing:-.045em;line-height:.82}
.ttl b i{font-style:normal;color:var(--red)}
.ttl span{display:block;margin-top:6px;color:var(--soft)}
#bar{height:4px;background:var(--line);margin:12px 0 10px}
#fpsbar{height:100%;background:var(--ink);transition:width .25s}#fpsbar.meh{background:#c98a14}#fpsbar.bad{background:var(--red)}
dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0 0 12px;font-variant-numeric:tabular-nums}
dt{color:var(--soft)}dd{margin:0;text-align:right;font-weight:600}
dd.big{font-weight:900;font-stretch:115%;font-size:22px;line-height:1}
label.r{display:grid;grid-template-columns:1fr auto;align-items:center;margin:8px 0 2px;font-weight:600}
label.r output{font-variant-numeric:tabular-nums;color:var(--soft);font-weight:500}
input[type=range]{grid-column:1/-1;width:100%;accent-color:var(--ink);margin:4px 0 0}
.tg{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.tg label{display:flex;align-items:center;gap:5px;border:1px solid var(--line);padding:4px 8px 4px 6px;cursor:pointer;user-select:none}
.tg input{accent-color:var(--red);margin:0}
button{width:100%;font:inherit;font-weight:800;letter-spacing:.01em;background:var(--ink);color:var(--paper);border:0;padding:9px 10px;cursor:pointer}
button:disabled{background:var(--soft);cursor:progress}
button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--red);outline-offset:2px}
table{width:100%;border-collapse:collapse;margin-top:8px;font-variant-numeric:tabular-nums}
th{font-weight:500;color:var(--soft);text-align:right;padding:2px 0}th:first-child,td:first-child{text-align:left}
td{text-align:right;padding:2px 0;border-top:1px solid var(--line)}
td.ok{font-weight:800}td.meh{color:#a0700c;font-weight:800}td.bad{color:var(--red);font-weight:800}
.foot{display:flex;justify-content:space-between;margin-top:12px;color:var(--soft)}
.foot a{color:var(--ink);font-weight:700;text-decoration:none;border-bottom:1.5px solid var(--red)}
#help{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--ink);color:var(--paper);padding:6px 12px;font-weight:600;z-index:2;white-space:nowrap;pointer-events:none}
@media (max-width:600px){#hud{top:auto;bottom:16px;left:16px;right:16px;width:auto;max-height:46%}#help{display:none}.ttl b{font-size:34px}}
`;
const BODY = `
<canvas id="gl" aria-label="A painted Pune street"></canvas>
<div id="loading" role="status" aria-live="polite"><b>experiment</b><span id="ld-msg">Starting</span></div>
<aside id="hud" aria-label="Stress test">
  <div class="ttl"><b>experi<i>ment</i></b><span>a painted street, from scratch · a stress test</span></div>
  <div id="bar"><div id="fpsbar"></div></div>
  <dl>
    <dt>fps</dt><dd class="big" id="st-fps">–</dd>
    <dt>frame</dt><dd><span id="st-ms">–</span> ms</dd>
    <dt>gpu</dt><dd><span id="st-gpu">–</span> ms</dd>
    <dt>cpu</dt><dd><span id="st-cpu">–</span> ms</dd>
    <dt>draw calls</dt><dd id="st-draws">–</dd>
    <dt>triangles</dt><dd id="st-tris">–</dd>
    <dt>people</dt><dd id="st-ppl">–</dd>
    <dt>vehicles</dt><dd id="st-veh">–</dd>
    <dt>pixels</dt><dd id="st-res">–</dd>
    <dt>gpu</dt><dd id="st-gpuname" style="font-weight:500;color:var(--soft);font-size:11px">–</dd>
  </dl>
  <label class="r">people <output></output><input id="s-people" type="range" min="0" max="6000" step="50"></label>
  <label class="r">vehicles <output></output><input id="s-cars" type="range" min="0" max="600" step="10"></label>
  <label class="r">resolution <output></output><input id="s-res" type="range" min="40" max="150" step="5"></label>
  <div class="tg">
    <label><input type="checkbox" id="t-paint">paint</label>
    <label><input type="checkbox" id="t-pencil">pencil</label>
    <label><input type="checkbox" id="t-ink">ink &amp; paper</label>
    <label><input type="checkbox" id="t-shadows">shadows</label>
    <label><input type="checkbox" id="t-msaa">msaa</label>
  </div>
  <button id="bench">run the stress test</button>
  <table><thead><tr><th>people</th><th>veh</th><th>fps</th><th>p95 ms</th><th>gpu</th><th>tris</th></tr></thead><tbody id="bench-out"></tbody></table>
  <div class="foot"><span>h hides this</span><a href="/">back to puneri</a></div>
</aside>
<div id="help">wasd walk · shift run · click and move the mouse to look · scroll to zoom</div>`;

const HEAD = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Experiment · Puneri</title>
<meta name="description" content="A painted Pune street, from scratch: a stress test of the new look for Puneri."><meta name="theme-color" content="#f3efe6"><meta name="robots" content="noindex"><link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#f3efe6"/><path d="M6 26 26 6M10 26 26 10M14 26 26 14" stroke="#171411" stroke-width="2.4"/><circle cx="10" cy="10" r="4" fill="#d8321e"/></svg>')}">`;
const html = `<!doctype html><html lang="en"><head>${HEAD}<style>${CSS}</style></head><body>${BODY}
<script type="importmap">${JSON.stringify({ imports })}</script>
<script type="module">${js}</script></body></html>`;
const out = path.join(root, 'dist/experiment');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`experiment built in ${Date.now() - t0}ms  page ${(html.length / 1024).toFixed(0)}KB`);
