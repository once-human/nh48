// While the terminal is open the keyboard belongs to it. This has to be the first key listener on the page, ahead of the
// game's, so main.js imports it first: anything registered later never sees a key while `guard.on` is set.
export const guard = { on: null };
if (typeof window !== 'undefined') for (const t of ['keydown', 'keypress', 'keyup']) window.addEventListener(t, (e) => { if (t === 'keyup') window.__nhAskG?.input?.keys?.delete(e.code); if (guard.on) guard.on(e); }, true);
// (a key let go is let go, whoever had the keyboard at the time: a menu or the terminal taking the key up left it held down, the wheel over, until you pressed it again)
