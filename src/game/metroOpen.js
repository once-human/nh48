// Which metro lines are running today. A line with `opens: "YYYY-MM-DD"` in transit.json starts running on
// that date in Pune (IST), with no update needed: Line 3 (Pink, Hinjewadi to Shivajinagar) opens 3 Nov 2026.
// ?line3 in the URL runs it early, for testing.
export const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
let force = false;
try { force = /[?&]line3\b/.test(location.search); } catch (e) { /* no window */ }
export function lineOpen(l) { return !!(l && (l.open || (l.opens && (force || istToday() >= l.opens)))); }
export function opensOn(l) {
  if (!l || !l.opens) return 'soon';
  const [, m, d] = l.opens.split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`;
}
// the first week a line is open: worth telling the player
export function justOpened(l) {
  if (!l || !l.opens || !lineOpen(l)) return false;
  const days = (Date.parse(istToday()) - Date.parse(l.opens)) / 864e5;
  return days >= 0 && days < 10;
}
