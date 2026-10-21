// Small line icons for the HUD and the backpack (24×24, stroke = currentColor).
const P = {
  health: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  food: '<path d="M3 12h18"/><path d="M5 12a7 7 0 0 0 14 0"/><path d="M9 8c0-1 1-1.5 1-2.5M13 8c0-1 1-1.5 1-2.5"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  energy: '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
  mood: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  bottle: '<path d="M10 2h4v3l1.5 2.5V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7.5L10 5z"/><path d="M8.5 12h7"/>',
  parcel: '<path d="M4 9h16l-1.5 11h-13z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',
  biscuit: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  banana: '<path d="M4 13c3 6 11 7 16-3"/><path d="M4 13c4 3 10 2 14-5"/><path d="M19 8l1-2"/>',
  chikki: '<path d="M4 8h16v8H4z"/><path d="M8 8v8M12 8v8M16 8v8"/>',
  medkit: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M12 10v7M8.5 13.5h7"/>',
  pill: '<path d="M8.5 15.5 15.5 8.5a3.5 3.5 0 0 1 5 5l-7 7a3.5 3.5 0 0 1-5-5z" transform="translate(-3 -3)"/><path d="M9 9l4 4"/>',
  can: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M12.5 7 10 12h3l-1 5"/>',
  cup: '<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M9 3v2M13 3v2"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12"/><path d="M12 9c-2-4-6-4-6-1.5S12 9 12 9zm0 0c2-4 6-4 6-1.5S12 9 12 9z"/>',
  flower: '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5a3 3 0 1 1 0-6 3 3 0 1 1 0 6M12 14.5a3 3 0 1 0 0 6 3 3 0 1 0 0-6M9.5 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0M14.5 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0"/>',
  book: '<path d="M4 4h10a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h10"/>',
  ticket: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  mug: '<path d="M5 6h10v14H5z"/><path d="M15 9h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M5 9h10"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M9 9h6M9 12h6M12 9c2 0 2 3 0 3l3 4"/>',
  home: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  scooter: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h9l3-7h-3M9 17l2-6h4"/>',
  auto: '<path d="M4 16V9a5 5 0 0 1 5-5h4l5 6v6"/><circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M4 10h10V4"/>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  shirt: '<path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3a4 4 0 0 1-8 0z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
};
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.parcel}</svg>`;
}
// which icon each backpack item uses
export const ITEM_ICON = { water: 'bottle', tiffin: 'parcel', vadapav: 'parcel', biscuit: 'biscuit', banana: 'banana', chikki: 'chikki', medkit: 'medkit', painkiller: 'pill', ors: 'pill',
  energy: 'can', coldcoffee: 'cup', bakarwadi: 'gift', barfi: 'gift', shrewsbury: 'gift', gajra: 'flower', book: 'book', lottery: 'ticket', beer: 'mug' };
