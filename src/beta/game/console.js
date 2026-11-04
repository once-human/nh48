// Free roam's terminal. A small language, not a cheat menu: a command is `name args --flag=value`, statements chain with
// `;`, arguments complete from the live game by type. Every command declares its signature as a string, like
//   spawn <vehicle:vehicle> [count:int] [--paint:paint] [--drive]
// and that one string is its help, its usage line and its tab completion. Nothing here knows about the game: commands.js does.
import { guard } from './guard.js';

const esc = (s) => String(s), MAX = 2000;

// ---------------------------------------------------------------- the language
// a signature as you'd read it: <vehicle> rather than <vehicle:vehicle>
export const plain = (sig) => sig.replace(/:[\w|-]+/g, '');
export function tokenize(line) {
  const out = []; let i = 0, cur = '', on = false, q = '', start = 0;
  const flush = (end) => { if (on) { out.push({ v: cur, start, end, quoted: !!q }); cur = ''; on = false; } };
  for (; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) { q = ''; flush(i + 1); } else if (c === '\\' && i + 1 < line.length) cur += line[++i]; else cur += c; continue; }
    if (c === '"' || c === "'") { if (!on) start = i; on = true; q = c; continue; }
    if (c === ' ' || c === '\t') { flush(i); continue; }
    if (!on) { on = true; start = i; }
    cur += c;
  }
  const open = !!q;
  if (on) out.push({ v: cur, start, end: line.length, open });
  return out;
}
// statements split on `;`, not inside quotes
export function statements(line) {
  const out = []; let q = '', cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === ';' && !q) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += c;
    if (q && c === '\\') cur += line[++i] ?? '';
    else if (q) { if (c === q) q = ''; }
    else if (c === '"' || c === "'") q = c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// `spawn type <kind:kind> [count:int] [--paint:paint] [--drive]` into its parts. A name can be several words, a command and
// its sub-commands, the way a real shell has `git remote add`: everything before the first <argument> or [option]
export function signature(sig) {
  const parts = sig.split(/\s+/), words = [], args = [], flags = {};
  while (parts.length && !/^[<\[]/.test(parts[0])) words.push(parts.shift());
  const name = words.join(' ');
  for (const p of parts) {
    const m = /^([<\[])(--)?([\w-]+)(?::([\w|-]+))?(\.\.\.)?[>\]]$/.exec(p);
    if (!m) continue;
    if (m[2]) flags[m[3]] = m[4] || 'bool';
    else args.push({ n: m[3], t: m[4] || 'str', opt: m[1] === '[', rest: !!m[5] });
  }
  return { name, args, flags };
}

export class Shell {
  constructor() { this.cmds = new Map(); this.types = {}; this.aliases = {}; this.printer = () => {}; this.vars = {}; this.lines = []; this.seen = new Set(); }
  // a whole line ready to run, listed with the commands: "spawn type suv 4"
  line(v, note, group) { if (this.seen.has(v)) return; this.seen.add(v); this.lines.push({ v, note, group }); }
  // move a command under another name, the old one kept as an alias: "fix" is now "vehicle fix"
  move(from, to) {
    const c = this.cmds.get(from); if (!c) return;
    this.cmds.delete(from); c.sig = to + c.sig.slice(from.length); c.name = to; this.cmds.set(to, c); this.aliases[from] = to;
  }
  // the command a line starts with: the longest name its first words make. Returns { c, n } with n words used
  match(t) {
    for (let n = Math.min(3, t.length); n > 0; n--) { const c = this.cmds.get(t.slice(0, n).map(x => x.v).join(' ')); if (c) return { c, n }; }
    const a = t.length && this.aliases[t[0].v];
    return a ? { c: this.cmds.get(a), n: 1 } : null;
  }
  // the words that can come next after these: "spawn" gives "type", "list", "clear"
  subs(words) {
    const pre = words.length ? words.join(' ') + ' ' : '', out = new Map();
    for (const c of this.cmds.values()) {
      if (!c.name.startsWith(pre)) continue;
      const rest = c.name.slice(pre.length).split(' '), w = rest[0];
      if (!w || out.has(w)) continue;
      out.set(w, { v: w, note: rest.length > 1 ? 'more: ' + [...this.cmds.keys()].filter(k => k.startsWith(pre + w + ' ')).map(k => k.slice(pre.length + w.length + 1).split(' ')[0]).filter((q, i, a) => a.indexOf(q) === i).join(', ') : c.about, args: rest.length > 1 ? '…' : plain(c.sig.slice(c.name.length).trim()), sub: true });
    }
    return [...out.values()];
  }
  reg(sig, about, run, opts = {}) {
    const s = signature(sig), c = { ...s, sig, about, run, ...opts };
    this.cmds.set(s.name, c);
    for (const a of opts.also || []) this.aliases[a] = s.name;
    return c;
  }
  type(name, fn) { this.types[name] = fn; }
  print(text, cls = '') { this.printer(esc(text), cls); }
  table(rows, head) {
    if (this.tabler) return this.tabler(rows, head);
    const all = head ? [head, ...rows] : rows, n = Math.max(...all.map(r => r.length)), w = [];
    for (let c = 0; c < n; c++) w[c] = Math.max(...all.map(r => String(r[c] ?? '').length));
    const fmt = (r) => r.map((v, c) => String(v ?? '').padEnd(w[c] + 2)).join('').trimEnd();
    if (head) this.print(fmt(head), 'dim');
    for (const r of rows) this.print(fmt(r));
  }
  find(name) { return this.cmds.get(this.aliases[name] || name) || this.match(tokenize(String(name)))?.c; }
  // run a line. A command's error is printed, it never reaches the game's frame
  async exec(line, quiet = false) {
    for (const st of statements(line)) {
      if (!quiet) this.print(st, 'cmd');
      const t = tokenize(st);
      if (!t.length) continue;
      const head = t[0].v;
      if (head.startsWith('#')) continue;
      if (this.userAlias && this.userAlias[head]) { await this.exec(this.userAlias[head] + ' ' + st.slice(t[0].end), true); continue; }
      const m = this.match(t);
      if (!m) {
        const sub = this.subs([head]);
        if (sub.length) { this.print(`${head}: needs one of: ${sub.map(s => s.v).join(', ')}`, 'err'); continue; }
        this.print(`${head}: no such command. Try: help`, 'err'); continue;
      }
      const { c } = m;
      if (m.n === 1 && t.length > 1 && !c.args.length) { const sub = this.subs([head]); if (sub.length) { this.print(`${head}: no "${t[1].v}". One of: ${sub.map(s => s.v).join(', ')}`, 'err'); continue; } }
      const args = [], flags = {};
      for (const a of t.slice(m.n)) {
        const m = !a.quoted && /^--([\w-]+)(?:=(.*))?$/.exec(a.v);
        if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; else args.push(a.v);
      }
      const need = c.args.filter(a => !a.opt).length;
      if (args.length < need) { this.print('usage: ' + plain(c.sig), 'err'); continue; }
      for (const f in flags) if (!(f in c.flags)) this.print(`${head}: unknown flag --${f}`, 'warn');
      try { await c.run(args, flags, st); }
      catch (e) { this.print(`${c.name}: ${e && e.message || e}`, 'err'); console.warn('console', st, e); }
    }
  }
  // every command, in the order they were registered, grouped
  listing() {
    const pretty = (a) => a.replace(/:[\w|-]+/, '');
    return [...this.cmds.values()].map(c => ({ v: c.name, note: c.about, group: c.group || 'other', args: c.sig.slice(c.name.length).trim().split(/\s+/).map(pretty).join(' ') }))
      .concat(this.lines)
      .concat(Object.keys(this.userAlias || {}).map(v => ({ v, note: 'your alias: ' + this.userAlias[v], group: 'yours' })))
      .map((c, i) => [(this.order || []).indexOf(c.group), i, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  }
  // what could go at the end of the line. Returns { from, items: [{ v, note }], sig, argIndex }
  complete(line) {
    const st0 = line.lastIndexOf(';') + 1, st = line.slice(st0), toks = tokenize(st), endsSpace = !st.length || /\s$/.test(st);
    if (!st.trim()) return { from: line.length, items: this.listing(), sig: null, all: true };
    const cur = endsSpace ? '' : (toks[toks.length - 1]?.v ?? ''), from = st0 + (endsSpace ? st.length : toks[toks.length - 1].start);
    const pick = (list, q0 = cur) => {
      const q = q0.toLowerCase(), a = [], b = [];
      for (const it of list) { const o = it && it.v !== undefined ? it : { v: it }, l = String(o.v).toLowerCase(); if (l.startsWith(q)) a.push(o); else if (q && l.includes(q)) b.push(o); }
      return [...a, ...b].slice(0, MAX);
    };
    if (toks.length === 1 && !endsSpace) {
      // by name first, then anything whose description mentions it ("teleport" finds tp)
      const all = this.listing(), named = pick(all), q = cur.toLowerCase(), said = all.filter(o => !named.includes(o) && String(o.note).toLowerCase().includes(q));
      return { from, items: [...named, ...said], sig: null, all: true, noQuote: true };
    }
    // the command so far, and what sub-commands could still follow it
    const done = toks.slice(0, endsSpace ? undefined : -1), m = this.match(done), words = done.map(x => x.v);
    const subs = m && m.n < done.length ? [] : pick(this.subs(words));
    if (!m) return { from, items: subs, sig: null, noQuote: true };
    const { c, n } = m;
    if (subs.length && done.length === n && !c.args.length) return { from, items: subs, sig: c, noQuote: true };
    const used = toks.slice(n, endsSpace ? undefined : -1), pos = used.filter(a => !a.v.startsWith('--')).length;
    if (cur.startsWith('--')) {
      const m = /^--([\w-]+)=(.*)$/.exec(cur);
      if (m && c.flags[m[1]]) { const fn = this.types[c.flags[m[1]]]; return { from: from + m[1].length + 3, items: pick(fn ? fn(m[2], c, used) : [], m[2]), sig: c, argIndex: -1, noQuote: true }; }
      return { from, items: pick(Object.entries(c.flags).map(([k, t]) => ({ v: '--' + k + (t === 'bool' ? '' : '='), note: t }))), sig: c, argIndex: -1 };
    }
    // a name of several words: everything after the command is the one thing being searched for
    const first = c.args[0] && c.args[0].t.split('|').map(t => this.types[t]).find(f => f && f.span);
    if (first && toks.length > n && !/^[~^@#\d-]/.test(toks[n].v) && !(subs.length && toks.length === n + 1)) {
      const q = st.slice(toks[n].start).replace(/^["']/, '');
      return { from: st0 + toks[n].start, items: first(q.trim()).slice(0, MAX), sig: c, argIndex: 0 };
    }
    const arg = c.args[Math.min(pos, c.args.length - 1)], use = arg && (pos < c.args.length || arg.rest) ? arg : null;
    if (!use) return { from, items: subs, sig: c, argIndex: -1, noQuote: true };
    let items = pos === 0 && done.length === n ? subs : [];
    for (const t of use.t.split('|')) { const fn = this.types[t]; if (fn) items = items.concat(fn.own ? fn(cur, c, used) : pick(fn(cur, c, used))); }
    return { from, items: items.slice(0, MAX), sig: c, argIndex: Math.min(pos, c.args.length - 1), argName: use.n };
  }
}

// ---------------------------------------------------------------- the terminal
const HIST = 'nh48_console_hist';
export class Terminal {
  constructor(shell, opts = {}) {
    this.sh = shell; this.opts = opts; this.open = false; this.hist = []; this.hi = -1; this.sel = -1; this.draft = '';
    try { this.hist = JSON.parse(localStorage.getItem(HIST) || '[]'); } catch (e) { /* private window */ }
    const el = this.el = document.createElement('div');
    el.className = 'nhc'; el.hidden = true;
    el.innerHTML = `<div class="nhc-card">
      <header class="nhc-head"><h2>terminal</h2><div class="nhc-meta"><div class="nhc-stat"></div><div class="nhc-tip">tab complete · ↓ list · ↑ history · pgup/pgdn scroll · ctrl+l clear · esc close</div></div><button class="nhc-copy" type="button">copy log</button></header>
      <div class="nhc-main"><div class="nhc-log" role="log"></div><div class="nhc-sig" hidden></div>
        <label class="nhc-in"><span class="nhc-p">nh48 ›</span><span class="nhc-w"><span class="nhc-ghost"></span><input spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="command…"></span></label></div>
      <aside class="nhc-side"><div class="nhc-count"></div><div class="nhc-cols"><span>#</span><span>command</span><span>args</span><span>what it does</span></div><div class="nhc-sug" role="listbox"></div></aside>
    </div>`;
    (opts.parent || document.body).appendChild(el);
    this.log = el.querySelector('.nhc-log'); this.sug = el.querySelector('.nhc-sug'); this.sigEl = el.querySelector('.nhc-sig'); this.count = el.querySelector('.nhc-count'); this.stat = el.querySelector('.nhc-stat'); this.cols = el.querySelector('.nhc-cols');
    this.input = el.querySelector('input'); this.ghost = el.querySelector('.nhc-ghost');
    shell.printer = (t, c) => this.line(t, c);
    shell.tabler = (rows, head) => this.tableOut(rows, head);
    this.input.addEventListener('input', () => { this.hi = -1; this.refresh(); });
    el.querySelector('.nhc-copy').addEventListener('click', (e) => { const b = e.currentTarget; navigator.clipboard?.writeText(this.log.innerText).then(() => { b.textContent = 'copied'; setTimeout(() => { b.textContent = 'copy log'; }, 1200); }); this.input.focus(); });
    // a click off the card puts it away; a click on the card keeps the typing going, unless you're selecting text to copy
    el.addEventListener('mousedown', (e) => { if (e.target === el) { e.preventDefault(); this.hide(); } });
    el.addEventListener('mouseup', () => { if (!String(getSelection())) this.input.focus(); });
    for (const k of ['wheel', 'pointerdown', 'pointerup', 'click', 'contextmenu']) el.addEventListener(k, (e) => e.stopPropagation());
    this.keys = (e) => {
      // Every key stops here, before the game. The text still lands in the input: only the listeners are skipped
      if (e.type === 'keydown') {
        if (document.activeElement !== this.input && !e.ctrlKey && !e.metaKey && !['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) this.input.focus();
        this.key(e);
      }
      e.stopImmediatePropagation();
    };
  }
  line(text, cls = '') {
    const d = document.createElement('div'); d.className = 'nhc-l' + (cls ? ' ' + cls : ''); d.textContent = text;
    const t = new Date(); d.dataset.t = [t.getHours(), t.getMinutes(), t.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
    this.add(d);
  }
  tableOut(rows, head) {
    const n = Math.max(...(head ? [head, ...rows] : rows).map(r => r.length)), t = document.createElement('div');
    t.className = 'nhc-t'; t.style.gridTemplateColumns = `repeat(${n}, auto)`;
    const cells = (r, cls) => { for (let c = 0; c < n; c++) { const d = document.createElement('span'); d.textContent = r[c] ?? ''; if (cls) d.className = cls; t.appendChild(d); } };
    if (head) cells(head, 'dim');
    for (const r of rows) cells(r);
    this.add(t);
  }
  add(d) {
    this.log.appendChild(d);
    while (this.log.children.length > 600) this.log.firstChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }
  clear() { this.log.textContent = ''; }
  show(prefill = '') {
    if (this.open) return;
    this.open = true; this.el.hidden = false; guard.on = this.keys;
    const tick = () => { try { this.stat.textContent = this.opts.status ? this.opts.status() : ''; } catch (e) { /* the game's mid-change */ } };
    tick(); clearInterval(this.statT); this.statT = setInterval(tick, 250);
    this.input.value = prefill; this.hi = -1; this.refresh();
    this.input.focus();
    this.opts.onOpen && this.opts.onOpen();
  }
  hide() {
    if (!this.open) return;
    this.open = false; this.el.hidden = true; this.input.blur(); guard.on = null; clearInterval(this.statT);
    this.opts.onClose && this.opts.onClose();
  }
  push(line) {
    if (line && this.hist[this.hist.length - 1] !== line) this.hist.push(line);
    if (this.hist.length > 300) this.hist.splice(0, this.hist.length - 300);
    try { localStorage.setItem(HIST, JSON.stringify(this.hist)); } catch (e) { /* private window */ }
  }
  key(e) {
    const inp = this.input, C = this.c;
    if (e.key === 'Escape' || (e.code === 'Backquote' && !inp.value)) { e.preventDefault(); this.hide(); return; }
    if (e.code === 'Slash' && !inp.value) { e.preventDefault(); return; }           // (the habit of typing /spawn)
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!C || !C.items.length) return;
      if (this.sel >= 0) { this.accept(C.items[this.sel]); return; }
      // what starts with what you typed decides, not what only mentions it: one of those is taken, several give the part they
      // share, the way a shell does; then Tab walks the list
      const cur = inp.value.slice(C.from), names = C.items.filter(i => cur && String(i.v).toLowerCase().startsWith(cur.toLowerCase()));
      if (names.length === 1 || C.items.length === 1) { this.accept(names[0] || C.items[0]); return; }
      const pre = commonPrefix(names.map(i => String(i.v)));
      if (pre.length > cur.length) { inp.value = inp.value.slice(0, C.from) + pre; this.refresh(); return; }
      this.pick(e.shiftKey ? C.items.length - 1 : 0);
      return;
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); this.sug.scrollTop += (e.key === 'PageUp' ? -1 : 1)*this.sug.clientHeight*.85; return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1, n = C ? C.items.length : 0;
      // ↓ walks down the list, ↑ walks back up it and out of the top. With nothing picked, ↑ is your last command
      if (this.sel >= 0) { this.pick(this.sel + dir >= n ? this.sel : this.sel + dir); return; }
      if (dir > 0 && this.hi < 0) { if (n) this.pick(0); return; }
      if (this.hi < 0) { this.draft = inp.value; this.hi = this.hist.length; }
      this.hi = Math.max(0, Math.min(this.hist.length, this.hi + dir));
      inp.value = this.hi >= this.hist.length ? this.draft : this.hist[this.hi] ?? '';
      if (this.hi >= this.hist.length) this.hi = -1;
      this.refresh();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.sel >= 0 && C) { this.accept(C.items[this.sel]); return; }
      const v = inp.value.trim().replace(/^\//, ''); inp.value = ''; this.hi = -1; this.refresh();
      if (v) { this.push(v); this.sh.exec(v); }
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); this.clear(); return; }
    if (e.ctrlKey && e.key.toLowerCase() === 'u') { e.preventDefault(); inp.value = ''; this.refresh(); }
  }
  accept(it) {
    const inp = this.input, C = this.c, v = String(it.v), q = /\s/.test(v) && !C.noQuote ? `"${v}"` : v, dot = /[.=]$/.test(v);
    inp.value = inp.value.slice(0, C.from) + q + (dot ? '' : ' ');
    this.refresh(); inp.focus();
  }
  refresh() {
    let c = null;
    try { c = this.sh.complete(this.input.value); } catch (e) { console.warn('complete', e); }
    this.c = c; this.sel = -1; this.paint(); this.log.scrollTop = this.log.scrollHeight;
  }
  // choose a row of the list, -1 for none, and keep it in view
  pick(i) {
    const rows = this.rows || [];
    if (rows[this.sel]) rows[this.sel].classList.remove('on');
    this.sel = i;
    if (rows[i]) { rows[i].classList.add('on'); rows[i].scrollIntoView({ block: 'nearest' }); }
    this.ghostOn();
  }
  ghostOn() {
    const C = this.c, inp = this.input; this.ghost.textContent = '';
    if (!C || !C.items.length || !inp.value) return;
    const cur = inp.value.slice(C.from), top = String(C.items[Math.max(0, this.sel)].v);
    if (top.toLowerCase().startsWith(cur.toLowerCase())) this.ghost.textContent = inp.value + top.slice(cur.length);
  }
  paint() {
    const C = this.c, S = this.sug, items = C ? C.items : [], frag = document.createDocumentFragment(), rows = [];
    let group = null;
    const whole = C && C.all && !this.input.value.trim().split(';').pop().trim(), counts = {};
    if (whole) for (const it of items) counts[it.group] = (counts[it.group] || 0) + 1;
    items.forEach((it, i) => {
      // over the whole list, a rule and a heading wherever the group changes; filtered, the matches just come in order
      if (whole && it.group !== group) { group = it.group; const h = document.createElement('div'); h.className = 'nhc-g'; h.innerHTML = '<span></span><em></em>'; h.firstChild.textContent = group; h.lastChild.textContent = String(counts[group]).padStart(3, '0'); frag.appendChild(h); }
      const d = document.createElement('div'); d.className = 'nhc-s'; d.setAttribute('role', 'option');
      const cell = (tag, t, c) => { const e = document.createElement(tag); e.textContent = t ?? ''; if (c) e.className = c; d.appendChild(e); };
      cell('span', String(i + 1).padStart(3, '0'), 'n'); cell('b', it.v); cell('code', it.args || ''); cell('i', it.note);
      d.title = [it.v, it.args, it.note].filter(Boolean).join('  ');
      d.addEventListener('mousedown', (e) => { e.preventDefault(); this.accept(it); });
      frag.appendChild(d); rows.push(d);
    });
    S.textContent = ''; S.appendChild(frag); S.scrollTop = 0; this.rows = rows;
    this.count.textContent = !C ? '' : C.all ? (whole ? `commands  ${items.length}` : `match  ${items.length}`) : items.length ? `<${C.argName || 'value'}>  ${items.length}` : 'free text: type it in';
    this.ghostOn();
    const G = this.sigEl;
    if (C && C.sig) {
      G.hidden = false; G.textContent = '';
      const parts = C.sig.sig.split(/\s+/); let arg = -1;
      for (const p of parts) {
        const s = document.createElement('span'), isArg = /^[<\[](?!--)/.test(p);
        if (isArg) arg++;
        s.textContent = p.replace(/:[\w|-]+/, '') + ' '; if (isArg && arg === C.argIndex) s.className = 'on';
        G.appendChild(s);
      }
      const m = document.createElement('em'); m.textContent = C.sig.about; G.appendChild(m);
    } else G.hidden = true;
  }
}
function commonPrefix(list) {
  if (!list.length) return '';
  let p = list[0];
  for (const s of list) { let i = 0; while (i < p.length && i < s.length && p[i].toLowerCase() === s[i].toLowerCase()) i++; p = p.slice(0, i); if (!p) break; }
  return p;
}
