// While the terminal is open the keyboard belongs to it. This has to be the first key listener on the page, ahead of the
// game's, so main.js imports it first: anything registered later never sees a key while `guard.on` is set.
export const guard = { on: null };
if (typeof window !== 'undefined') for (const t of ['keydown', 'keypress', 'keyup']) window.addEventListener(t, (e) => { if (guard.on) guard.on(e); }, true);
