// What each part of Pune is like, and so who you meet there and how they talk.
// Every area gets a short internal description (what the street feels like) and a crowd mix:
// how likely each persona (src/game/street_lines.json) is to be the person walking past.
// The nearest area centre within its radius wins; outside every area the city default applies.
//
// Personas: kaka / ajoba / dada / bhaiya / collegeboy / kpguy (male)
//           kaku / aaji / tai / aunty / collegegirl / kpgirl (female)

const MIX = {
  // the base Pune mix: Marathi middle class, some Hindi speakers, students everywhere
  city: { kaka: 3, ajoba: 1.2, dada: 3, bhaiya: 2, collegeboy: 2, kpguy: 0.4, kaku: 3, aaji: 1.2, tai: 3, aunty: 1.6, collegegirl: 2, kpgirl: 0.4 },
  // KP, Boat Club Road, Bund Garden: cafés, startups, expats, English and Hinglish
  polished: { kaka: 0.6, ajoba: 0.4, dada: 1.2, bhaiya: 1.2, collegeboy: 1.4, kpguy: 4.5, kaku: 0.6, aaji: 0.3, tai: 1.6, aunty: 1.2, collegegirl: 1.4, kpgirl: 4.5 },
  // Camp / Cantonment: old Parsi and Christian families, MG Road shoppers, everyone mixed together
  camp: { kaka: 1.2, ajoba: 0.8, dada: 1.8, bhaiya: 2.2, collegeboy: 1.6, kpguy: 2, kaku: 1.2, aaji: 0.6, tai: 1.6, aunty: 2.6, collegegirl: 1.6, kpgirl: 2 },
  // Pune Station, Sangamwadi, Tadiwala Road: travellers, porters, migrants, the whole country passing through
  station: { kaka: 1.6, ajoba: 0.8, dada: 2, bhaiya: 4.5, collegeboy: 1.2, kpguy: 0.4, kaku: 1.6, aaji: 0.8, tai: 1.4, aunty: 2.8, collegegirl: 1, kpgirl: 0.3 },
  // the peths: old Pune, wadas, temples, Marathi elders and shopkeepers
  peth: { kaka: 4, ajoba: 2.6, dada: 2.6, bhaiya: 0.8, collegeboy: 1, kpguy: 0.1, kaku: 4, aaji: 2.6, tai: 2.6, aunty: 0.6, collegegirl: 1, kpgirl: 0.1 },
  // Deccan, FC Road, Shivajinagar, Model Colony: colleges, hostels, tapris, coaching classes
  college: { kaka: 1.6, ajoba: 0.8, dada: 2, bhaiya: 1.4, collegeboy: 4.5, kpguy: 0.8, kaku: 1.6, aaji: 0.6, tai: 2.2, aunty: 1, collegegirl: 4.5, kpgirl: 0.8 },
  // quiet residential colonies: families, morning walkers, aajis on benches
  colony: { kaka: 3.4, ajoba: 2, dada: 2.4, bhaiya: 1.2, collegeboy: 1.4, kpguy: 0.6, kaku: 3.4, aaji: 2, tai: 2.6, aunty: 1.6, collegegirl: 1.4, kpgirl: 0.6 },
};

// name → [mix, radius (m), what it's like]
export const AREAS = {
  'Koregaon Park': ['polished', 900, 'Leafy lanes of cafés, bars and boutique offices; joggers, startup folk, expats and weekend brunch crowds, mostly English and Hinglish.'],
  'Boat Club Road': ['polished', 600, 'Old bungalows, clubs and premium flats; quiet, moneyed, English-speaking.'],
  'Bund Garden': ['polished', 600, 'River promenade, hotels and walkers; families in the evening, polished office crowd by day.'],
  'Dhole Patil Road': ['polished', 600, 'Showrooms, hotels and offices between Station and KP; well-dressed and busy.'],
  'Camp': ['camp', 900, 'MG Road and East Street shopping, bakeries, churches and old Irani cafés; Parsi aunties, army families, shoppers from everywhere.'],
  'Pune Cantonment': ['camp', 900, 'Army lines, wide roads and the old Camp bazaar; mixed and cosmopolitan.'],
  'Pune Station': ['station', 800, 'Rickshaw queues, lodges, porters, travellers with bags; Hindi, Marathi, everything at once.'],
  'Sangamwadi': ['station', 600, 'Bus stands and river bank, migrants and travellers.'],
  'Tadiwala Road': ['station', 600, 'Dense working-class settlement by the tracks; loud, busy, Hindi and Marathi.'],
  'Wakdewadi': ['station', 600, 'Bus depot traffic and workshops.'],
  'Agarkar Nagar': ['camp', 500, 'Small offices and hospitals near the station.'],
  'Deccan Gymkhana': ['college', 800, 'FC Road and JM Road: Fergusson students, tapris, coaching classes, bookshops; young and loud.'],
  'Shivajinagar': ['college', 800, 'COEP, courts and the bus stand; students, lawyers and commuters.'],
  'Model Colony': ['colony', 700, 'Quiet professional families and students renting rooms.'],
  'Erandwane': ['colony', 700, 'Hospitals, schools and old Brahmin families; Marathi, measured.'],
  'Prabhat Road': ['colony', 600, 'Bungalows and lanes of old-money Marathi Pune.'],
  'Gokhale Nagar': ['college', 600, 'Hostels and families under the hills.'],
  'Suyojan Society': ['colony', 400, 'A residential society.'],
};
for (const n of ['Sadashiv Peth', 'Kasba Peth', 'Rasta Peth', 'Budhwar Peth', 'Raviwar Peth', 'Bhavani Peth', 'Nana Peth', 'Guruwar Peth', 'Shukrawar Peth',
  'Narayan Peth', 'Shaniwar Peth', 'Mangalwar Peth', 'Somwar Peth', 'Ganesh Peth', 'Navi Peth'])
  AREAS[n] = ['peth', 500, 'Old Pune: wadas, temples, wholesale lanes and tiny shops; Marathi kakas, kakus and aajis who have lived here for generations.'];

export class AreaMap {
  constructor(M) {
    this.list = [];
    for (const a of M.areas || []) {
      const def = AREAS[a[0]];
      if (def) this.list.push({ name: a[0], x: a[2] / 100, z: a[3] / 100, mix: MIX[def[0]], kind: def[0], r: def[1], desc: def[2] });
    }
  }
  // the area you're in (nearest centre, scaled by its size), or null
  at(x, z) {
    let best = null, bd = 1;
    for (const a of this.list) {
      const d = Math.hypot(a.x - x, a.z - z) / a.r;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  mixAt(x, z) { const a = this.at(x, z); return a ? a.mix : MIX.city; }
}
export { MIX };
