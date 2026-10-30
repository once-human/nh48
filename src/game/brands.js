// Not every shop of a kind is the same. The name on the board says what it is and what it costs:
// a chain optician with free eye tests and frames from ₹999, a premium one, the local uncle with a
// lens box; a dental clinic, a skin clinic, a lab, a physio, a GP, a hospital; a premium salon vs a
// gully barber; a chain gym vs an akhada-style one; a handloom shop, a men's tailor, a brand store.
// Each has its own services and prices, and many change something in the game:
//   glasses      see further on the minimap · sunglasses: style in polished areas
//   dental       cleaning or whitening: charm (better dates, tips, bargains) for days
//   skin         facial, peel, laser: charm and style
//   lab          a full checkup tells you your real numbers; a fit result gives +5 max health
//   physio       energy back, fitness gains stick
// Food brands: chains and posh places cost more; the room's look follows the cuisine (interiors).

const has = (n, re) => re.test(n.toLowerCase());

export function tierOf(kind, name, flag) {
  const n = name || '';
  if (kind === 'optician') return has(n, /titan|eyeplus|lawrence|mayo|vision express|carl zeiss/) ? 'premium' : has(n, /lens ?kart|specsmakers|eye ?mantra|eyewear|opticals? (plus|world)/) || flag === 'brand' ? 'chain' : 'local';
  if (kind === 'clinic') {
    if (has(n, /dental|dentist|smile|teeth|orthodont/)) return 'dental';
    if (has(n, /skin|derma|aesthetic|cosmetic|hair|laser|kleo|kaya|clinic of/)) return 'skin';
    if (has(n, /diagnostic|lab|patholog|scan|imaging|x-?ray/)) return 'lab';
    if (has(n, /physio|rehab|ortho|spine|sports/)) return 'physio';
    if (has(n, /eye|nethra|netra|vision/)) return 'eyehosp';
    if (has(n, /hospital|multispecial|nursing home|medical (centre|center)|institute/)) return 'hospital';
    return 'gp';
  }
  // three kinds of salon: the brands (polished, English), the unisex studios in between, the neighbourhood barber
  if (kind === 'barber') return has(n, /habib|hab[ie]b|lakm|naturals|bblunt|b blunt|enrich|toni|looks salon|jean-claude|green trends|y ?salon|geetanjali|kaya/) || flag === 'brand' ? 'premium' : has(n, /unisex|studio|salon & spa|\bspa\b|beauty|makeover|hair ?(lounge|studio|zone)|parlou?r|family salon|men'?s salon/) ? 'mid' : 'local';
  if (kind === 'gym') return has(n, /gold|cult|anytime|talwalkar|snap|fitness first|crossfit/) || flag === 'brand' ? 'premium' : 'local';
  if (kind === 'clothes') {
    if (has(n, /handloom|saree|sari|silk|paithani|kurti|ladies|women|boutique|chhabra|kala ?niketan|mangaldeep/)) return 'women';
    if (has(n, /gents|men'?s|raymond|peter england|louis|van heusen|allen solly|arrow|tailor|suiting/)) return 'men';
    if (has(n, /fab ?india|khadi|ethnic|kurta/)) return 'ethnic';
    return flag === 'brand' ? 'brand' : 'all';
  }
  if (flag === 'brand') return 'chain';
  return 'local';
}
export const TIER_MUL = { mid: 1.25, premium: 1.9, chain: 1.25, brand: 1.35, local: 0.85, women: 1, men: 1, ethnic: 1.2, all: 1,
  dental: 1, skin: 1, lab: 1, physio: 1, eyehosp: 1, hospital: 1.3, gp: 1 };
export const TIER_LABEL = { mid: 'Unisex salon', premium: 'Premium', chain: 'Chain store', brand: 'Brand store', local: 'Local shop', women: 'Women’s wear', men: 'Men’s wear', ethnic: 'Ethnic wear', all: 'Clothing store',
  dental: 'Dental clinic', skin: 'Skin & hair clinic', lab: 'Diagnostic lab', physio: 'Physiotherapy', eyehosp: 'Eye hospital', hospital: 'Hospital', gp: 'Doctor’s clinic' };

// services: [label, note, base price, effect(G) -> message]
export function servicesFor(kind, tier, G) {
  const L = G.life, P = G.player, heal = (f) => { P.hp = Math.min(L.hpMax, (P.hp ?? 100) + L.hpMax * f); };
  if (kind === 'optician') {
    const free = tier !== 'local';
    const fr = { premium: [4500, 'Titanium frames, anti-glare, a nice case'], chain: [999, 'Any frame, blue-cut lenses included'], local: [700, 'Metal frames, the uncle’s own lenses'] }[tier];
    return [
      ['Eye test', free ? 'Free with any purchase here' : 'Ten minutes with the chart', free ? 0 : 200, () => { L.s.eyesTested = true; return L.s.glasses ? 'Your number hasn’t changed' : 'Minus 0.75 in both eyes. You probably need glasses'; }],
      ['Prescription glasses', fr[1], fr[0], () => { L.s.glasses = tier; return 'Everything is sharper. The minimap shows more of the city'; }],
      ['Sunglasses', tier === 'premium' ? 'Polarised aviators' : 'UV400 wayfarers', tier === 'premium' ? 6500 : tier === 'chain' ? 1500 : 450, () => { L.s.shades = tier; return 'Sharp. They look best in Koregaon Park'; }],
      ['Contact lenses, monthly', 'No frames on your face', tier === 'premium' ? 2400 : 1200, () => { L.s.glasses = tier; L.s.charmBoost = Math.min(0.15, (L.s.charmBoost || 0) + 0.03); return 'Contacts in. You see clearly and look the same'; }],
    ];
  }
  if (kind === 'clinic') {
    switch (tier) {
      case 'dental': return [
        ['Check-up', 'Mirror, probe, a lecture about sweets', 400, () => 'Two small cavities. Floss, apparently'],
        ['Cleaning and polishing', 'Charm up for a few days', 1500, () => { L.s.charmBoost = Math.min(0.2, (L.s.charmBoost || 0) + 0.08); L.change('mood', 0.03); return 'Your smile is noticeably brighter'; }],
        ['Teeth whitening', 'A big charm boost that lasts', 7000, () => { L.s.charmBoost = Math.min(0.25, (L.s.charmBoost || 0) + 0.18); return 'Film-star teeth. People smile back more'; }],
        ['Filling', 'Fixes the toothache you didn’t know you had', 2500, () => { L.change('mood', 0.06); return 'Done. Don’t eat for an hour'; }],
      ];
      case 'skin': return [
        ['Consultation', 'The dermatologist looks at your face for a long time', 800, () => 'Drink more water, she says'],
        ['Hydra facial', 'Glowing skin: charm and style', 3200, () => { L.s.charmBoost = Math.min(0.25, (L.s.charmBoost || 0) + 0.08); L.change('mood', 0.05); return 'Glowing. People will ask what you did'; }],
        ['Chemical peel', 'Bigger effect, a day of looking pink', 5500, () => { L.s.charmBoost = Math.min(0.25, (L.s.charmBoost || 0) + 0.12); return 'Fresh skin. Avoid the sun today'; }],
        ['Laser hair removal, one session', 'Smooth, and expensive', 9000, () => { L.s.charmBoost = Math.min(0.25, (L.s.charmBoost || 0) + 0.06); return 'One of six sessions. Probably'; }],
      ];
      case 'lab': return [
        ['Full body checkup', '70 tests, report in an hour', 2999, () => { const fit = L.s.fitness >= 10 && L.s.hunger > 0.4; if (fit && !L.s.labBonus) { L.s.labBonus = true; L.change('fitness', 5); } return `Report: health ${Math.round(P.hp)}/${L.hpMax}, fitness ${Math.round(L.s.fitness)}. ${fit ? 'Excellent. +5 max health from knowing it' : 'Vitamin D low, like everyone in Pune'}`; }],
        ['Blood sugar test', 'A quick prick', 150, () => L.s.hunger < 0.2 ? 'Low. Eat something right now' : 'Normal'],
        ['X-ray', 'For that fall from the scooter', 600, () => 'Nothing broken'],
      ];
      case 'physio': return [
        ['Physio session', 'Energy back, aches gone', 900, () => { L.apply({ energy: 0.3, mood: 0.04 }); heal(0.2); return 'Loose and light again'; }],
        ['Sports massage', 'Fitness gains come easier this week', 1500, () => { L.change('fitness', 1); L.apply({ energy: 0.2 }); return 'Your legs thank you'; }],
      ];
      case 'eyehosp': return [
        ['Eye check-up', 'Proper machines', 500, () => { L.s.eyesTested = true; return 'Minus 0.75. An optician can sort you out'; }],
        ['LASIK consultation', 'No more glasses, ever', 0, () => 'Surgery is ₹55,000. Come back when you’re ready'],
        ['LASIK surgery', 'Perfect eyesight, permanently', 55000, () => { L.s.glasses = 'lasik'; return 'You see everything. The minimap shows more of the city'; }],
      ];
      case 'hospital': return [
        ['Casualty: get patched up', 'Full health, private hospital rates', 2500, () => { heal(1); return 'Stitched and bandaged'; }],
        ['Specialist consultation', 'A long wait, a short talk', 1500, () => { heal(0.4); return 'Rest and fluids'; }],
        ['Glucose drip', 'Food, water and energy topped up', 1800, () => { L.apply({ hunger: 0.4, thirst: 0.6, energy: 0.3 }); return 'Feeling human again'; }],
      ];
      default: return [
        ['See the doctor', 'Consultation and a dressing: health back', 500, () => { heal(0.8); return 'Paracetamol and rest'; }],
        ['Injection', 'The Pune GP special. Fast relief', 300, () => { heal(0.5); return 'Ouch. Better though'; }],
        ['Medical certificate', 'For the office', 200, () => 'Two days’ rest, signed'],
      ];
    }
  }
  return null;
}
