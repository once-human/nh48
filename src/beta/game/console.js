// The Test bench's terminal. A small language, not a cheat menu: a command is `name args --flag=value`, statements chain with
// `;`, arguments complete from the live game by type. Every command declares its signature as a string, like
//   spawn <vehicle:vehicle> [count:int] [--paint:paint] [--drive]
// and that one string is its help, its usage line and its tab completion. Nothing here knows about the game: commands.js does.
const esc = (s) => String(s);

// ---------------------------------------------------------------- the language
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
// `spawn <vehicle:vehicle> [count:int] [--paint:paint] [--drive]` into its parts
export function signature(sig) {
  const parts = sig.split(/\s+/), name = parts.shift(), args = [], flags = {};
  for (const p of parts) {
    const m = /^([<\[])(--)?([\w-]+)(?::([\w|-]+))?(\.\.\.)?[>\]]$/.exec(p);
    if (!m) continue;
    if (m[2]) flags[m[3]] = m[4] || 'bool';
    else args.push({ n: m[3], t: m[4] || 'str', opt: m[1] === '[', rest: !!m[5] });
  }
  return { name, args, flags };
}

export class Shell {
  constructor() { this.cmds = new Map(); this.types = {}; this.aliases = {}; this.printer = () => {}; this.vars = {}; }
  reg(sig, about, run, opts = {}) {
    const s = signature(sig), c = { ...s, sig, about, run, ...opts };
    this.cmds.set(s.name, c);
    for (const a of opts.also || []) this.aliases[a] = s.name;
    return c;
  }
  type(name, fn) { this.types[name] = fn; }
  print(text, cls = '') { this.printer(esc(text), cls); }
  table(rows, head) {
    const all = head ? [head, ...rows] : rows, n = Math.max(...all.map(r => r.length)), w = [];
    for (let c = 0; c < n; c++) w[c] = Math.max(...all.map(r => String(r[c] ?? '').length));
    const fmt = (r) => r.map((v, c) => String(v ?? '').padEnd(w[c] + 2)).join('').trimEnd();
    if (head) this.print(fmt(head), 'dim');
    for (const r of rows) this.print(fmt(r));
  }
  find(name) { return this.cmds.get(this.aliases[name] || name); }
  // run a line. A command's error is printed, it never reaches the game's frame
  async exec(line, quiet = false) {
    for (const st of statements(line)) {
      if (!quiet) this.print(st, 'cmd');
      const t = tokenize(st);
      if (!t.length) continue;
      const head = t[0].v;
      if (head.startsWith('#')) continue;
      if (this.userAlias && this.userAlias[head]) { await this.exec(this.userAlias[head] + ' ' + st.slice(t[0].end), true); continue; }
      const c = this.find(head);
      if (!c) { this.print(`${head}: no such command. Try: help`, 'err'); continue; }
      const args = [], flags = {};
      for (const a of t.slice(1)) {
        const m = !a.quoted && /^--([\w-]+)(?:=(.*))?$/.exec(a.v);
        if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; else args.push(a.v);
      }
      const need = c.args.filter(a => !a.opt).length;
      if (args.length < need) { this.print('usage: ' + c.sig, 'err'); continue; }
      for (const f in flags) if (!(f in c.flags)) this.print(`${head}: unknown flag --${f}`, 'warn');
      try { await c.run(args, flags, st); }
      catch (e) { this.print(`${head}: ${e && e.message || e}`, 'err'); console.warn('console', st, e); }
    }
  }
  // what could go at the end of the line. Returns { from, items: [{ v, note }], sig, argIndex }
  complete(line) {
    const st0 = line.lastIndexOf(';') + 1, st = line.slice(st0), toks = tokenize(st), endsSpace = !st.length || /\s$/.test(st);
    if (!st.trim()) return { from: line.length, items: [], sig: null };
    const cur = endsSpace ? '' : (toks[toks.length - 1]?.v ?? ''), from = st0 + (endsSpace ? st.length : toks[toks.length - 1].start);
    const pick = (list, q0 = cur) => {
      const q = q0.toLowerCase(), a = [], b = [];
      for (const it of list) { const o = it && it.v !== undefined ? it : { v: it }, l = String(o.v).toLowerCase(); if (l.startsWith(q)) a.push(o); else if (q && l.includes(q)) b.push(o); }
      return [...a, ...b].slice(0, 40);
    };
    if (toks.length === 1 && !endsSpace) {
      const all = [...this.cmds.values()].map(c => ({ v: c.name, note: c.about })).concat(Object.keys(this.userAlias || {}).map(v => ({ v, note: 'alias' })));
      return { from, items: pick(all), sig: null };
    }
    const c = this.find(toks[0].v);
    if (!c) return { from, items: [], sig: null };
    const used = toks.slice(1, endsSpace ? undefined : -1), pos = used.filter(a => !a.v.startsWith('--')).length;
    if (cur.startsWith('--')) {
      const m = /^--([\w-]+)=(.*)$/.exec(cur);
      if (m && c.flags[m[1]]) { const fn = this.types[c.flags[m[1]]]; return { from: from + m[1].length + 3, items: pick(fn ? fn(m[2], c, used) : [], m[2]), sig: c, argIndex: -1, noQuote: true }; }
      return { from, items: pick(Object.entries(c.flags).map(([k, t]) => ({ v: '--' + k + (t === 'bool' ? '' : '='), note: t }))), sig: c, argIndex: -1 };
    }
    // a name of several words: everything after the command is the one thing being searched for
    const first = c.args[0] && c.args[0].t.split('|').map(t => this.types[t]).find(f => f && f.span);
    if (first && toks.length > 1 && !/^[~^@#\d-]/.test(toks[1].v)) {
      const q = st.slice(toks[1].start).replace(/^["']/, '');
      return { from: st0 + toks[1].start, items: first(q.trim()).slice(0, 40), sig: c, argIndex: 0 };
    }
    const arg = c.args[Math.min(pos, c.args.length - 1)], use = arg && (pos < c.args.length || arg.rest) ? arg : null;
    if (!use) return { from, items: [], sig: c, argIndex: -1 };
    let items = [];
    for (const t of use.t.split('|')) { const fn = this.types[t]; if (fn) items = items.concat(fn.own ? fn(cur, c, used) : pick(fn(cur, c, used))); }
    return { from, items: items.slice(0, 40), sig: c, argIndex: Math.min(pos, c.args.length - 1) };
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
    el.innerHTML = '<div class="nhc-log" role="log"></div><div class="nhc-sug" hidden></div><div class="nhc-sig" hidden></div><label class="nhc-in"><span class="nhc-p"></span><span class="nhc-w"><span class="nhc-ghost"></span><input spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Command"></span></label>';
    (opts.parent || document.body).appendChild(el);
    this.log = el.querySelector('.nhc-log'); this.sug = el.querySelector('.nhc-sug'); this.sigEl = el.querySelector('.nhc-sig');
    this.input = el.querySelector('input'); this.ghost = el.querySelector('.nhc-ghost');
    el.querySelector('.nhc-p').textContent = opts.prompt || '$';
    shell.printer = (t, c) => this.line(t, c);
    this.input.addEventListener('input', () => { this.hi = -1; this.refresh(); });
    this.input.addEventListener('keydown', (e) => this.key(e));
    // nothing typed here reaches the game, the page or the pointer lock
    for (const k of ['keydown', 'keypress']) el.addEventListener(k, (e) => e.stopPropagation());
  }
  line(text, cls = '') {
    const d = document.createElement('div'); d.className = 'nhc-l' + (cls ? ' ' + cls : ''); d.textContent = text;
    this.log.appendChild(d);
    while (this.log.children.length > 600) this.log.firstChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }
  clear() { this.log.textContent = ''; }
  show(prefill = '') {
    if (this.open) return;
    this.open = true; this.el.hidden = false;
    this.input.value = prefill; this.refresh();
    this.input.focus();
    this.opts.onOpen && this.opts.onOpen();
  }
  hide() {
    if (!this.open) return;
    this.open = false; this.el.hidden = true; this.input.blur();
    this.opts.onClose && this.opts.onClose();
  }
  push(line) {
    if (line && this.hist[this.hist.length - 1] !== line) this.hist.push(line);
    if (this.hist.length > 300) this.hist.splice(0, this.hist.length - 300);
    try { localStorage.setItem(HIST, JSON.stringify(this.hist)); } catch (e) { /* private window */ }
  }
  key(e) {
    const inp = this.input, C = this.c;
    if (e.key === 'Escape') { e.preventDefault(); this.hide(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!C || !C.items.length) return;
      if (C.items.length === 1 || this.sel >= 0) { this.accept(C.items[Math.max(0, this.sel)]); return; }
      // the part every candidate shares first, the way a shell does; then walk the list
      const pre = commonPrefix(C.items.map(i => String(i.v))), cur = inp.value.slice(C.from);
      if (pre.length > cur.length) { inp.value = inp.value.slice(0, C.from) + pre; this.refresh(); return; }
      this.sel = e.shiftKey ? C.items.length - 1 : 0; this.paint();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      if (this.sel >= 0 && C) { this.sel = (this.sel + dir + C.items.length) % C.items.length; this.paint(); return; }
      if (this.hi < 0) { if (dir > 0) return; this.draft = inp.value; this.hi = this.hist.length; }
      this.hi = Math.max(0, Math.min(this.hist.length, this.hi + dir));
      inp.value = this.hi >= this.hist.length ? this.draft : this.hist[this.hi];
      if (this.hi >= this.hist.length) this.hi = -1;
      this.sug.hidden = true; this.c = null; this.ghost.textContent = '';
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.sel >= 0 && C) { this.accept(C.items[this.sel]); return; }
      const v = inp.value.trim(); inp.value = ''; this.hi = -1; this.refresh();
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
  paint() {
    const C = this.c, S = this.sug, inp = this.input;
    this.ghost.textContent = '';
    if (!C || !C.items.length || (C.items.length === 1 && inp.value.slice(C.from) === String(C.items[0].v))) { S.hidden = true; }
    else {
      S.hidden = false; S.textContent = '';
      const n = Math.min(10, C.items.length), first = this.sel >= n ? this.sel - n + 1 : 0;
      for (let i = first; i < first + n && i < C.items.length; i++) {
        const it = C.items[i], d = document.createElement('div'); d.className = 'nhc-s' + (i === this.sel ? ' on' : '');
        const a = document.createElement('b'); a.textContent = it.v; d.appendChild(a);
        if (it.note) { const m = document.createElement('i'); m.textContent = it.note; d.appendChild(m); }
        d.addEventListener('mousedown', (e) => { e.preventDefault(); this.accept(it); });
        S.appendChild(d);
      }
      if (C.items.length > n) { const d = document.createElement('div'); d.className = 'nhc-s more'; d.textContent = `+${C.items.length - n} more`; S.appendChild(d); }
      const cur = inp.value.slice(C.from), top = String(C.items[Math.max(0, this.sel)].v);
      if (top.toLowerCase().startsWith(cur.toLowerCase())) this.ghost.textContent = inp.value + top.slice(cur.length);
    }
    const G = this.sigEl;
    if (C && C.sig) {
      G.hidden = false; G.textContent = '';
      const parts = C.sig.sig.split(/\s+/); let arg = -1;
      for (const p of parts) {
        const s = document.createElement('span'), isArg = /^[<\[](?!--)/.test(p);
        if (isArg) arg++;
        s.textContent = p + ' '; if (isArg && arg === C.argIndex) s.className = 'on';
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
