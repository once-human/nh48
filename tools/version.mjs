// The game's version, worked out from the history of changes. Nobody sets it by hand.
//
// GENERATION.RELEASE.FIX, as in 2.31.7, read off the commits from the first one to this one, each judged by what it
// did to the game's own code (src/: .js, .css, .html):
//   GENERATION  a change that brings a whole new game or mode with it: 2500 lines or more added, or 10 or more new
//               source files, in one change. RELEASE and FIX go back to 0
//   RELEASE     a change that adds something: 400 lines or more added, or 3 or more new source files. FIX goes back to 0
//   FIX         every other change: fixes, tuning, small additions
// A commit message can overrule the measure with [major], [minor] or [patch] anywhere in it.
// Beside the version goes the count of all changes ever made, which only ever goes up.
//
// The whole history is needed. A shallow checkout (Vercel without VERCEL_DEEP_CLONE=true) is deepened here; if that
// can't be done, the count carries on from the last version written down in package.json ("changes").
import { execSync } from 'node:child_process';

const MAJOR = { lines: 2500, files: 10 }, MINOR = { lines: 400, files: 3 };

export function gameVersion(root, known = {}) {
  const sh = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 90000, maxBuffer: 1 << 28 }).toString(); } catch (e) { return ''; } };
  const shallow = () => sh('git rev-parse --is-shallow-repository').trim() === 'true';
  if (shallow()) sh('git fetch --unshallow --quiet');
  let v = [0, 0, 0], n = 0, range = 'HEAD';
  if (shallow()) {
    if (!known.version) return { version: '0.0.0', count: 0 };
    v = known.version.split('.').map(Number); n = known.count || 0; range = `${known.at}..HEAD`;
    if (!sh(`git cat-file -t ${known.at}`)) return { version: known.version, count: n };
  }
  const log = sh(`git log --first-parent --diff-merges=first-parent --reverse --format=@%B%x00 --numstat --summary ${range} -- .`);
  for (const part of log.split(/^@/m).slice(1)) {
    const [msg, stat = ''] = part.split('\0');
    let add = 0, made = 0;
    for (const l of stat.split('\n')) {
      const m = /^(\d+)\t\d+\t(src\/.*\.(?:js|css|html))$/.exec(l); if (m) add += +m[1];
      if (/^ create mode \d+ src\/.*\.js$/.test(l)) made++;
    }
    const tag = (/\[(major|minor|patch)\]/i.exec(msg) || [])[1]?.toLowerCase();
    const kind = tag || (add >= MAJOR.lines || made >= MAJOR.files ? 'major' : add >= MINOR.lines || made >= MINOR.files ? 'minor' : 'patch');
    if (kind === 'major') v = [v[0] + 1, 0, 0]; else if (kind === 'minor') v = [v[0], v[1] + 1, 0]; else v[2]++;
    n++;
  }
  return { version: v.join('.'), count: n };
}
if (process.argv[1] && process.argv[1].endsWith('version.mjs')) console.log(gameVersion(process.cwd()));
