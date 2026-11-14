// The game's version, worked out from its history. Nobody sets it by hand.
//
// Two numbers, the way Apple ships: a marketing version and a build.   Version 5.6.12 (710)
//
//   BUILD   (710)   every change ever made, counted from the first. Only ever goes up; tells any two builds apart.
//
//   VERSION 5.6.12  GENERATION.RELEASE.FIX. What a change IS decides which number moves, not how big it was or how
//                   the work was cut into commits:
//     GENERATION  a new way to play: a new mode (story, free roam, live, ...), the game rebuilt, or a new map.
//                 (a new city, or the whole map remade)
//     RELEASE     something new in the game: a story chapter or part, a mechanic, a system, a vehicle, a power,
//                 a district, a screen.
//     FIX         everything else: fixes, tuning, polish, map and asset updates, tooling.
//
// Where that judgement comes from, in order:
//   1. The change says so itself. Whoever writes the commit (see CLAUDE.md: every session does) ends the message
//      with a line   Change: generation | release | fix   and a few words on why. That line is the answer.
//   2. The changes from before that line existed: the generations are written down below (HISTORY), by what they were.
//   3. Nothing said: the code is measured. If what is new or rewritten since the last release's snapshot has reached
//      5% of the game as it stood then, it is a release whether or not anyone called it one (a feature built quietly
//      across fifty small commits still counts, once). The same goes for the world itself: when a twentieth of the
//      map and asset files (data/, assets/) are new or changed since that snapshot, it is a release.
//      Measuring never makes a generation: a re-bake touches every map file without being a new map, and only
//      the change itself can say which it was (step 1).
//
// The whole history is needed. A shallow checkout (Vercel without VERCEL_DEEP_CLONE=true) is deepened here; if that
// can't be done the version is carried on, fixes only, from the last one written down in package.json ("changes").
import { execSync } from 'node:child_process';

const RELEASE = 0.05, WORLD = /^\S+\t\S+\t((?:data|assets)\/.+)$/, WORLD_RELEASE = 0.05;
// the generations before commits said what they were
const HISTORY = {
  '42af50046a3c2be496a4c30ff56cbc3b6af13663': 'generation',   // the first Puneri
  '6a343097e30a8f56e2fea3cdeeab4e99ad6cdfef': 'generation',   // free roam, a mode
  'e05008c78adfc73edbe8c6e61f0abefce9452f28': 'generation',   // story, a mode
  'fcfc48cb1536528747cc5f012a06c43f4c555d48': 'generation',   // the pencil-and-ink Pune: the game rebuilt
  'ee3a59539d9df8c1f77da8cbfba2169f1b03fc16': 'generation',   // live, a mode
};
const SAID = /^Change:\s*(generation|release|fix)\b/mi;
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
  // every change, oldest first: its hash, what it says it is, and what it added to and took from the code
  const commits = [];
  for (const part of sh('git log --first-parent --diff-merges=first-parent --reverse --format=@%H%n%B%x00 --numstat HEAD').split(/^@(?=[0-9a-f]{40}$)/m).slice(1)) {
    const [msg, stat = ''] = part.split('\0'), h = msg.slice(0, 40), c = { h, add: 0, del: 0, world: 0, said: (SAID.exec(msg) || [])[1]?.toLowerCase() || HISTORY[h] };
    for (const l of stat.split('\n')) { const m = CODE.exec(l); if (m) { c.add += +m[1]; c.del += +m[2]; } else if (WORLD.test(l)) c.world++; }
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
  // the world: how many map and asset files there were at a snapshot, and how many are new or changed since
  const files = (h) => sh(`git ls-tree -r --name-only ${h} -- data assets`).split('\n').filter(Boolean).length;
  const changed = (a, b) => sh(`git diff --name-only --no-renames --diff-filter=AM ${a} ${b} -- data assets`).split('\n').filter(Boolean).length;
  const wmark = (h, share) => ({ h, need: Math.max(3, Math.ceil(files(h)*share)), churn: 0, at: 0 });
  const wreached = (A, c) => {
    A.churn += c.world; if (A.churn < Math.max(A.at, A.need)) return false;
    const n = changed(A.h, c.h); if (n >= A.need) return true;
    A.at = A.churn + (A.need - n); return false;
  };
  let v = [0, 0, 0], size = 0, rel = null, wrel = null;
  for (const c of commits) {
    size += c.add - c.del;
    const grown = (rel ? reached(rel, c) : false) | (wrel ? wreached(wrel, c) : false);
    const kind = c.said || (grown ? 'release' : 'fix');
    if (kind === 'generation') v = [v[0] + 1, 0, 0]; else if (kind === 'release') v = [v[0], v[1] + 1, 0]; else v[2]++;
    if (kind !== 'fix' || grown || !rel) { rel = mark(c.h, size, RELEASE); rel.at = rel.need; wrel = wmark(c.h, WORLD_RELEASE); }
  }
  return { version: v.join('.'), build: commits.length, how: 'full history', at: commits.at(-1)?.h };
}
if (process.argv[1] && process.argv[1].endsWith('version.mjs')) { const t = Date.now(), r = gameVersion(process.cwd()); console.log(r, Date.now() - t, 'ms'); }
