// The game's version, worked out from its history. Nobody sets it by hand, and it doesn't matter how the work was cut
// into commits: one huge commit and the same work in fifty small ones give the same number.
//
// Two numbers, the way Apple ships: a marketing version and a build.   Version 3.4.12 (706)
//
//   BUILD   (706)   every change ever made, counted from the first. Only ever goes up; tells any two builds apart.
//
//   VERSION 3.4.12  GENERATION.RELEASE.FIX, measured on the game's own code (src/: .js, .css, .html) by comparing
//                   whole snapshots, never single commits:
//     GENERATION  goes up when the code that is new or rewritten since the last generation's snapshot is as much as
//                 the entire game was at that snapshot: more new game than old game. RELEASE and FIX go back to 0.
//     RELEASE     goes up when the code new or rewritten since the last release's snapshot reaches 5% of the game as
//                 it was then: a real addition, whatever it took to build. FIX goes back to 0.
//     FIX         every other change: fixes, tuning, small additions, map and asset updates.
//   "New or rewritten since the snapshot" is the lines git reports as added between that snapshot's tree and this
//   one's: code written and then taken out again counts for nothing, and neither does how often it was touched.
//
// The whole history is needed. A shallow checkout (Vercel without VERCEL_DEEP_CLONE=true) is deepened here; if that
// can't be done the version is carried on, fixes only, from the last one written down in package.json ("changes").
import { execSync } from 'node:child_process';

const GENERATION = 1.0, RELEASE = 0.05;
const CODE = /^(\d+)\t(\d+)\t(src\/.*\.(?:js|css|html))$/;

export function gameVersion(root, known = {}) {
  const sh = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 120000, maxBuffer: 1 << 28 }).toString(); } catch (e) { return ''; } };
  const shallow = () => sh('git rev-parse --is-shallow-repository').trim() === 'true';
  if (shallow()) sh('git fetch --unshallow --quiet');
  if (shallow()) {
    if (!known.version) return { version: '0.0.0', build: 0, how: 'no history' };
    const more = sh(`git cat-file -t ${known.at}`) ? +sh(`git rev-list --first-parent --count ${known.at}..HEAD`) || 0 : 0;
    const v = known.version.split('.').map(Number); v[2] += more;
    return { version: v.join('.'), build: (known.build || 0) + more, how: 'shallow history, carried on from package.json' };
  }
  // every change, oldest first: its hash, and what it added to and took from the code
  const commits = [];
  for (const part of sh('git log --first-parent --diff-merges=first-parent --reverse --format=@%H --numstat HEAD').split(/^@/m).slice(1)) {
    const lines = part.split('\n'), c = { h: lines[0].trim(), add: 0, del: 0 };
    for (const l of lines) { const m = CODE.exec(l); if (m) { c.add += +m[1]; c.del += +m[2]; } }
    commits.push(c);
  }
  // lines added between two snapshots (new or rewritten code that is still there)
  const fresh = (a, b) => { let n = 0; for (const l of sh(`git diff --numstat --no-renames ${a} ${b} -- src`).split('\n')) { const m = CODE.exec(l); if (m) n += +m[1]; } return n; };
  // a snapshot to measure from: its commit, the game's size then, and when it's next worth measuring (the lines added
  // by the commits since are the most the snapshots can differ by, so nothing is measured until they could reach the mark)
  const mark = (h, size, share) => ({ h, need: Math.max(1, Math.round(size*share)), churn: 0, at: 0 });
  const reached = (A, c) => {
    A.churn += c.add; if (A.churn < A.at) return false;
    const n = fresh(A.h, c.h); if (n >= A.need) return true;
    A.at = A.churn + (A.need - n); return false;
  };
  let v = [0, 0, 0], size = 0, gen = null, rel = null;
  for (const c of commits) {
    size += c.add - c.del;
    if (!gen) { v = [1, 0, 0]; gen = mark(c.h, size, GENERATION); rel = mark(c.h, size, RELEASE); gen.at = gen.need; rel.at = rel.need; continue; }
    const g = reached(gen, c), r = g || reached(rel, c);
    if (g) { v = [v[0] + 1, 0, 0]; gen = mark(c.h, size, GENERATION); gen.at = gen.need; }
    else if (r) v = [v[0], v[1] + 1, 0];
    else v[2]++;
    if (r) { rel = mark(c.h, size, RELEASE); rel.at = rel.need; }
  }
  return { version: v.join('.'), build: commits.length, how: 'full history', at: commits.at(-1)?.h };
}
if (process.argv[1] && process.argv[1].endsWith('version.mjs')) { const t = Date.now(), r = gameVersion(process.cwd()); console.log(r, Date.now() - t, 'ms'); }
