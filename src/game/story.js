// Story mode, Act 1: "Meter Down". You're back in Pune after the Bangalore job went, with Aai's flat EMI
// due and Bapu Kaka's old auto to earn it with. Six missions, driven by your phone: Bapu Kaka's rules, the
// RTO and the insurance man, a parcel for Raghu Bhau at Mandai, a shopkeeper's dues on Laxmi Road, a
// reporter who knows what was in the parcel, and midnight at Shaniwar Wada.
//
// Missions are data: texts that arrive on the phone when one starts, then steps. A step has an objective,
// somewhere to be (the waypoint and a saffron marker), and a test for done: arrive, talk (F, a
// conversation with choices), do fares, pass a driving course, take a photo, lose the police.
import * as THREE from 'three';
import { fmt } from './shops.js';

const WHO = {
  aai: ['Aai', '#f4a3c0'], bapu: ['Bapu Kaka', '#ffd166'], pappu: ['Pappu RTO', '#7bdff2'], joshi: ['Joshi Kaka', '#b8e0a8'],
  raghu: ['Raghu Bhau', '#ff6b6b'], salim: ['Salim', '#c3a6ff'], mohan: ['Mohan Sheth', '#ffb38a'], meera: ['Meera Kulkarni', '#9be7ff'],
  shinde: ['Insp. Shinde', '#d0d0d0'], you: ['You', '#ffffff'], unk: ['Unknown number', '#aaaaaa'],
};
const STORY_ON = false;
const inHours = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;
const hm = (h) => { const H = Math.floor(h) % 24, M = Math.floor((h % 1) * 60); return `${H % 12 || 12}:${String(M).padStart(2, '0')} ${H < 12 ? 'am' : 'pm'}`; };

// ---------------------------------------------------------------- the missions
// where: () => {x, z, name}; lm(id, dx, dz) a landmark, area(name) an area centre
function MISSIONS(S) {
  const G = S.g, F = new Proxy({}, { get: (_, k) => (S.st.flags || (S.st.flags = {}))[k], set: (_, k, v) => { (S.st.flags || (S.st.flags = {}))[k] = v; return true; } });
  const lm = (id, dx = 0, dz = 0, name) => { const L = (G.W.landmarks || []).find(l => l.id === id); return L ? { x: L.x + dx, z: L.z + dz, name: name || L.name } : null; };
  const area = (n, name) => { const a = G.people.areas.list.find(q => q.name === n); return a ? { x: a.x, z: a.z, name: name || n } : null; };
  return [
    { id: 'home', title: 'Home Again', mr: 'घरी परत',
      texts: [['aai', 'पोचलास का रे? बापू काकांची रिक्षा शनिवारवाड्यापाशी लावली आहे. चावी त्यातच आहे.', 'Reached? Bapu Kaka’s rickshaw is parked by Shaniwar Wada. The key’s in it.']],
      steps: [
        { obj: 'Get into Bapu Kaka’s auto', sub: 'It’s parked by Shaniwar Wada, under the yellow marker', enter: () => { G.findAuto = !G.player.inAnyAuto; }, done: () => G.player.inAnyAuto },
        { obj: 'Drive to Bapu Kaka at Kasba Peth', where: () => lm('kasba', 0, 0, 'Bapu Kaka, Kasba Peth'), r: 40, done: (s) => s.arrived },
        { obj: 'Talk to Bapu Kaka', who: 'bapu', where: () => lm('kasba', 0, 0, 'Bapu Kaka'), talk: [
          ['bapu', 'आलास? बंगलोरहून थेट रिक्षात. वा, प्रगती.', 'You’re here. Straight from Bangalore into a rickshaw. What progress.'],
          ['you', 'काका, नोकरी गेली. आईच्या फ्लॅटचा हप्ता थांबू शकत नाही.', 'Kaka, the job’s gone. Aai’s flat EMI can’t wait.'],
          ['bapu', 'माहीत आहे. म्हणून तर रिक्षा दिली. पण तीन नियम.', 'I know. That’s why you have the rickshaw. But three rules.'],
          ['bapu', 'एक: मीटर डाऊन. नेहमी. पुणेकर हिशोब ठेवतात.', 'One: meter down. Always. Punekars keep accounts.'],
          ['bapu', 'दोन: दुपारी एक ते चार मला फोन नाही.', 'Two: no calls to me between one and four.'],
          ['bapu', 'तीन: रघु भाऊचं काम घ्यायचं नाही. काहीही झालं तरी.', 'Three: never take work from Raghu Bhau. Whatever happens.'],
          ['you', 'रघु भाऊ कोण?', 'Who’s Raghu Bhau?'],
          ['bapu', 'कळेल. पुण्यात सगळ्यांना सगळं कळतं. आता जा, दोन भाडी करून ये.', 'You’ll find out. In Pune everyone finds out everything. Now go, do two fares.'],
        ] },
        { obj: 'Do two fares, meter down', rides: 2 },
      ],
      end: () => { S.text('bapu', 'दोन भाडी, एकही भांडण नाही. जमेल तुला.', 'Two fares and not one argument. You’ll manage.'); G.life.change('respect', 2); } },

    { id: 'papers', title: 'Paperwork', mr: 'कागदपत्रं', gap: 0.5,
      texts: [['bapu', 'बॅज लायसन्स आणि इन्शुरन्स नसेल तर पोलीस रिक्षा उचलतील. आरटीओ, संगमवाडी. आज.', 'Without a badge licence and insurance the police will lift the rickshaw. RTO, Sangamwadi. Today.']],
      steps: [
        { obj: 'Go to the RTO at Sangamwadi', where: () => area('Sangamwadi', 'RTO Pune, Sangamwadi'), r: 60, done: (s) => s.arrived },
        { obj: 'Talk to the agent outside the RTO', who: 'pappu', where: () => area('Sangamwadi', 'RTO agent'), talk: [
          ['pappu', 'Licence? Badge? Arre boss, line mein teen din lagenge. Pappu hai na.', 'Licence? Badge? Boss, the queue takes three days. But Pappu is here.'],
          ['pappu', 'Pandrah sau. Kal subah haath mein. Test-vest kuch nahi.', 'Fifteen hundred. In your hand tomorrow morning. No test, nothing.'],
          { ask: [
            ['Pay Pappu ₹1,500', () => { if (!G.shops.spend(1500)) return [['pappu', 'Paise nahi? Toh line mein lago, boss.', 'No money? Then join the queue, boss.']]; F.agent = 1; F.licence = 1; S.skip = 1; return [['pappu', 'Samajhdar aadmi. Pune mein sab set hota hai.', 'Smart man. In Pune, everything can be set.']]; }],
            ['Take the driving test yourself', () => [['pappu', 'Theek hai, Shaktimaan. Ground pe jao, teen cone, nabbe second.', 'Fine, Shaktimaan. Out to the ground: three cones, ninety seconds.']]],
          ] },
        ] },
        { obj: 'Driving test: through the three checkpoints', course: 3, limit: 90, skip: () => F.licence, where: () => area('Sangamwadi', 'Test ground') },
        { obj: 'See Joshi Kaka about insurance at Tulshibaug', where: () => lm('tulshibaug', 0, 0, 'Joshi Kaka, Tulshibaug'), r: 45, done: (s) => s.arrived, enter: () => { if (!F.agent) { F.licence = 1; G.hud.toast('Passed', 'Badge licence, on merit. Pappu looks offended', 'good', 3); } } },
        { obj: 'Talk to Joshi Kaka', who: 'joshi', where: () => lm('tulshibaug', 0, 0, 'Joshi Kaka'), talk: [
          ['joshi', 'या, या. बसा. पाणी घ्या. इन्शुरन्स म्हणजे काळजी, बाकी काही नाही.', 'Come, come. Sit. Have some water. Insurance means peace of mind, nothing else.'],
          ['joshi', 'थर्ड पार्टी कायद्याने लागतो, २,८०० रुपये. पूर्ण कव्हर ६,५००: अपघात, चोरी, पूर, सगळं.', 'Third party is the law: ₹2,800. Full cover ₹6,500: accidents, theft, floods, everything.'],
          { ask: [
            ['Third party, ₹2,800', () => { if (!G.shops.spend(2800)) return [['joshi', 'पैसे जमले की या. मी इथेच असतो. चाळीस वर्षं.', 'Come back when you have it. I’m always here. Forty years.']]; F.insured = 1; return []; }],
            ['Full cover, ₹6,500', () => { if (!G.shops.spend(6500)) return [['joshi', 'पैसे जमले की या. मी इथेच असतो. चाळीस वर्षं.', 'Come back when you have it. I’m always here. Forty years.']]; F.insured = 2; return []; }],
          ] },
          { fn: () => F.insured ? [['joshi', 'पॉलिसी तुमच्या फोनवर येईल. आणि हो, रघु भाऊच्या कामाला कोणतंही इन्शुरन्स नसतं.', 'The policy will come on your phone. And yes: there’s no insurance for Raghu Bhau’s kind of work.']] : (S.again = 1, []) },
        ] },
      ],
      end: () => { G.phone.store('Insurance', `Policy issued: ${F.insured === 2 ? 'comprehensive' : 'third party'} cover for MH12 auto rickshaw. Valid one year.`); G.hud.toast('Papers in order', 'Badge licence and insurance. The police can only glare now', 'good', 3.4); } },

    { id: 'parcel', title: 'The Parcel', mr: 'पार्सल', gap: 2, when: () => inHours(G.hour, 18, 23.5),
      texts: [['unk', 'Raghu Bhau ko milo. Mandai, raat nau baje. Akele.', 'Meet Raghu Bhau. Mandai, nine tonight. Alone.']],
      steps: [
        { obj: () => G.hour < 21 && G.hour > 12 ? 'Be at Mandai by 9 pm' : 'Meet Raghu Bhau at Mandai', sub: () => `It’s ${hm(G.hour)}`, where: () => lm('mandai', 0, 0, 'Mandai'), r: 45, done: (s) => s.arrived && inHours(G.hour, 21, 3) },
        { obj: 'Talk to Raghu Bhau', who: 'raghu', where: () => lm('mandai', 0, 0, 'Raghu Bhau'), talk: [
          ['raghu', 'Toh tu hai Bapu ka bhatija. Bangalore wala. Laptop chhod ke rickshaw pakdi.', 'So you’re Bapu’s nephew. The Bangalore guy. Put down the laptop, picked up a rickshaw.'],
          ['raghu', 'Seedhi baat. Ek parcel. Budhwar Peth se Tadiwala Road. Paanch hazaar.', 'Straight talk. One parcel. Budhwar Peth to Tadiwala Road. Five thousand.'],
          ['raghu', 'Kholna nahi. Poochna nahi. Bapu ko batana nahi.', 'Don’t open it. Don’t ask. Don’t tell Bapu.'],
          ['you', 'आणि नाही म्हटलं तर?', 'And if I say no?'],
          ['raghu', 'Toh rickshaw chalata reh. EMI bhi chalti rahegi. Dheere dheere.', 'Then keep driving the rickshaw. The EMI will keep running too. Slowly.'],
          { ask: [
            ['Take the parcel (₹5,000)', () => { F.parcel = 1; return [['raghu', 'Shabaash. Budhwar Peth, Chhotu dega. Aur haan, dhyaan se chalana.', 'Good. Budhwar Peth, Chhotu will hand it over. And drive carefully.']]; }],
            ['Walk away', () => { S.retry = 1; return [['raghu', 'Kal raat phir aana. Main yahin hoon. Hamesha.', 'Come back tomorrow night. I’m right here. Always.']]; }],
          ] },
        ] },
        { obj: 'Pick up the parcel in Budhwar Peth', where: () => area('Budhwar Peth', 'Chhotu, Budhwar Peth'), r: 35, done: (s) => s.arrived, after: () => G.hud.toast('The parcel', 'A boy hands you a taped carton. It clinks. It’s heavier than it looks', 'info', 3.6) },
        { obj: 'Take the parcel to Tadiwala Road', sub: () => G.police.heat ? 'Lose the police first' : 'Don’t open it', where: () => area('Tadiwala Road', 'Tadiwala Road'), r: 45,
          enter: () => { G.later(22, () => { if (S.cur() && S.cur().obj === 'Take the parcel to Tadiwala Road') { S.text('raghu', 'Shivaji Road pe nakabandi hai. Galiyon se ja.', 'Checkpoint on Shivaji Road. Take the lanes.'); G.police.raiseHeat?.(1, 'Nakabandi: they want to look inside your auto', null); } }); },
          done: (s) => s.arrived && !G.police.heat },
        { obj: 'Hand the parcel to Salim', who: 'salim', where: () => area('Tadiwala Road', 'Salim'), talk: [
          ['salim', 'Bhau ka maal? Theek hai. Yeh le, gin le.', 'Bhau’s stuff? Fine. Here, count it.'],
          ['salim', 'Aur suno. Kisi ne dekha toh tum mujhe nahi jaante.', 'And listen. If anyone saw, you don’t know me.'],
        ] },
      ],
      end: () => { G.stats.money += 5000; G.saveStats(); G.audio.cash(); G.life.change('karma', -3); G.hud.toast('₹5,000', 'Easy money. Too easy', 'meter', 3);
        G.later(40, () => S.text('meera', 'I saw you at Tadiwala Road tonight. Don’t worry, I’m not the police. We should talk. M.', '')); } },

    { id: 'hafta', title: 'The Cut', mr: 'हप्ता', gap: 10, when: () => inHours(G.hour, 9, 19),
      texts: [['raghu', 'Laxmi Road pe Mohan Mithaiwala. Uska hissa baaki hai. Le aa.', 'Mohan the sweet-maker on Laxmi Road. His share is overdue. Bring it.']],
      steps: [
        { obj: 'Go to Mohan’s sweet shop on Laxmi Road', where: () => area('Raviwar Peth', 'Mohan Mithaiwala, Laxmi Road'), r: 40, done: (s) => s.arrived },
        { obj: 'Talk to Mohan Sheth', who: 'mohan', where: () => area('Raviwar Peth', 'Mohan Sheth'), talk: [
          ['mohan', 'तुम्हीपण? मागच्या महिन्यात त्यांनी दुकानाच्या काचा फोडल्या.', 'You too? Last month they smashed my shop windows.'],
          ['mohan', 'दहा हजार. मुलीची कॉलेजची फी भरायची होती यातून.', 'Ten thousand. This was for my daughter’s college fees.'],
          { ask: [
            ['Take the ₹10,000 for Raghu', () => { F.took = 1; G.life.change('karma', -5); return [['mohan', 'पुणं असं नव्हतं.', 'Pune wasn’t like this.']]; }],
            ['Tell him to keep it and go to the police', () => { F.warned = 1; G.life.change('karma', 5); G.life.change('respect', 3); return [['mohan', 'तुम्ही वेगळे दिसता. देव भलं करो.', 'You seem different. God bless you.']]; }],
          ] },
        ] },
        { obj: 'Take Mohan’s money to Raghu at Mandai', skip: () => !F.took, where: () => lm('mandai', 0, 0, 'Raghu Bhau'), r: 40, done: (s) => s.arrived,
          after: () => { G.stats.money += 2000; G.saveStats(); G.audio.cash(); S.text('raghu', 'Do hazaar tera. Tu kaam ka aadmi hai.', 'Two thousand is yours. You’re useful.'); } },
      ],
      end: () => { if (F.warned) S.text('raghu', 'Tune Mohan ko kya bola? Dekh lunga tujhe.', 'What did you tell Mohan? I’ll deal with you.'); } },

    { id: 'photo', title: 'The First Photo', mr: 'पहिला फोटो', gap: 6, when: () => inHours(G.hour, 9, 18),
      texts: [['meera', 'Café across from Fergusson College, any time before six. I know what was in the parcel. Come. M.', '']],
      steps: [
        { obj: 'Meet Meera near Fergusson College', where: () => lm('fergusson', 0, 0, 'Meera, FC Road'), r: 60, done: (s) => s.arrived },
        { obj: 'Talk to Meera', who: 'meera', where: () => lm('fergusson', 0, 0, 'Meera Kulkarni'), talk: [
          ['meera', 'Meera Kulkarni. Crime desk. Sit, your chai is getting cold.', ''],
          ['meera', 'That carton? Cough syrup with codeine. Fake labels. It ends up in hostels on this very road.', ''],
          ['you', 'मला माहीत नव्हतं.', 'I didn’t know.'],
          ['meera', 'I know. That’s why I’m talking to you and not writing about you.', ''],
          ['meera', 'Raghu keeps the stock in a half-built tower in Koregaon Park. I need a photo of his men loading it. Tonight, after ten.', ''],
          ['meera', 'Your phone has a camera. K for photo mode. Get close, take it, and get out before they see you.', ''],
          { ask: [
            ['“I’ll do it.”', () => { F.meera = 1; return [['meera', 'Good. And don’t be a hero. Heroes don’t file stories.', '']]; }],
            ['“I’m not getting involved.”', () => { S.retry = 1; return [['meera', 'Then pray nobody’s kid drinks what you carried. Same café, if you change your mind.', '']]; }],
          ] },
        ] },
        { obj: () => inHours(G.hour, 22, 3) ? 'Go to the building site in Koregaon Park' : 'After 10 pm: the building site in Koregaon Park', sub: () => `It’s ${hm(G.hour)}`, where: () => area('Koregaon Park', 'Building site, Koregaon Park'), r: 70, done: (s) => s.arrived && inHours(G.hour, 22, 3) },
        { obj: 'Photograph Raghu’s men: K for photo mode, Space to shoot', sub: 'From close by, under 45 m', who: 'goons', where: () => area('Koregaon Park', 'Raghu’s men'), photo: 45 },
        { obj: 'They saw you. Lose the police', sub: 'Raghu’s friends in uniform', enter: () => { G.hud.say?.('?', 'Oye! Kaun hai wahan? Pakdo usko!', 'Hey! Who’s there? Grab him!', 3); G.police.raiseHeat?.(2, 'Raghu’s friends in uniform are after you', null); }, done: () => !G.police.heat },
      ],
      end: () => { S.text('meera', 'Got the photos. They’re clear. Lie low tonight. You did something good. M.', ''); G.life.change('respect', 5); } },

    { id: 'midnight', title: 'Midnight at Shaniwar Wada', mr: 'मध्यरात्र', gap: 12, when: () => inHours(G.hour, 19, 23.7),
      texts: [['shinde', 'Meera gave me your photos. Brave. Shaniwar Wada, midnight, at the gate. Come alone. Insp. Shinde, Vishrambaug police.', '']],
      steps: [
        { obj: () => inHours(G.hour, 23.75, 1) ? 'Go to the Delhi Darwaza' : 'Be at Shaniwar Wada at midnight', sub: () => `It’s ${hm(G.hour)}`, where: () => S.swAt(2.7, -100, 'Delhi Darwaza'), r: 30, done: (s) => s.arrived && inHours(G.hour, 23.75, 1.5) },
        { obj: 'Talk to Inspector Shinde', who: 'shinde', where: () => S.swAt(-4, -96, 'Inspector Shinde'), talk: [
          ['shinde', 'या. शनिवारवाड्याला मध्यरात्री कोणी येत नाही. भुतांची भीती.', 'Come. Nobody comes to Shaniwar Wada at midnight. They’re scared of ghosts.'],
          ['shinde', 'फोटो चांगले आहेत. फोन द्या.', 'Good photos. Hand me the phone.'],
          ['shinde', 'रघुला मी ओळखतो. पंधरा वर्षं.', 'I’ve known Raghu fifteen years.'],
          ['raghu', 'Bees saal, Shinde saheb. Bees.', 'Twenty, Shinde sir. Twenty.'],
          { fn: () => [['shinde', F.agent ? 'पुण्यात सगळं सेट होतं. पप्पूने सांगितलं नाही का?' : 'पुण्यात सगळं सेट होतं. कोणी सांगितलं नाही का?', F.agent ? 'In Pune everything gets set. Didn’t Pappu tell you?' : 'In Pune everything gets set. Didn’t anyone tell you?']] },
          { ask: [
            ['Hand over the phone', () => { F.sold = 1; return [['raghu', 'Samajhdar. Kal se tu mera driver. Mahine ka pachaas hazaar.', 'Smart. From tomorrow you drive for me. Fifty thousand a month.']]; }],
            ['Run', () => { F.ran = 1; return [['shinde', 'पकडा त्याला!', 'Get him!']]; }],
          ] },
        ] },
        { obj: 'Lose them', sub: 'Then get to Meera', skip: () => !F.ran, enter: () => G.police.raiseHeat?.(3, 'Inspector Shinde wants your phone', null), done: () => !G.police.heat },
        { obj: 'Get the phone to Meera at FC Road', skip: () => !F.ran, where: () => lm('fergusson', 0, 0, 'Meera'), r: 60, done: (s) => s.arrived },
      ],
      end: () => {
        if (F.sold) { G.stats.money += 50000; G.saveStats(); G.audio.cash(); G.life.change('karma', -10); S.text('meera', 'They got to you too. I understand. I won’t forget.', ''); }
        else { G.life.change('respect', 15); G.life.change('karma', 10); S.text('meera', 'Front page tomorrow. Raghu, Shinde, the tower in KP. You did this. Chai’s on me for a year.', ''); }
        G.later(3, () => G.hud.flash('Act 1 complete: Meter Down', F.sold ? 'You drive for Raghu Bhau now. Act 2, Hinjewadi, is coming.' : 'Pune knows your name now. Act 2, Hinjewadi, is coming.'));
      } },
  ];
}

export class Story {
  constructor(G) {
    this.g = G; this.npcs = []; this.marker = null;
    const el = this.el = document.createElement('div');
    el.className = 'sd'; el.hidden = true;
    el.innerHTML = '<div class="sd-bar top"></div><div class="sd-bar bot"></div><div class="sd-box"><div class="sd-who"></div><div class="sd-line"></div><div class="sd-tr"></div><div class="sd-ask"></div><div class="sd-next"><span class="kbd">F</span> next</div></div>';
    (document.getElementById('ui') || document.body).appendChild(el);
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) this.pick(+b.dataset.k); else if (!this.asking) this.next(); });
    window.addEventListener('keydown', (e) => {
      if (!this.talking) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      if (this.asking) { const k = /^Digit([1-4])$/.exec(e.code); if (k) this.pick(+k[1] - 1); else if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.askSel = (this.askSel + 1) % this.asking.length; this.drawAsk(); } else if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.askSel = (this.askSel + this.asking.length - 1) % this.asking.length; this.drawAsk(); } else if (e.code === 'Enter' || e.code === 'KeyF' || e.code === 'Space') this.pick(this.askSel); return; }
      if (e.code === 'KeyF' || e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') this.next();
    }, true);
  }
  get st() { const s = this.g.life.s; return s.story || (s.story = { m: 0, step: -1, flags: {}, nextAt: 0 }); }
  get on() { return !this.g.free && this.g.state !== 'title'; }
  // the old Act 1 is retired: Part One, Dark Store, is being written on this engine
  list() { return this._ms || (this._ms = STORY_ON ? MISSIONS(this) : []); }
  mission() { return this.list()[this.st.m] || null; }
  cur() { const m = this.mission(); return m && this.st.step >= 0 ? m.steps[this.st.step] : null; }
  swAt(u, v, name) { const W = this.g.W, L = W.landmarks && W.landmarks.find(l => l.id === 'shaniwar'); if (!L) return null; const c = Math.cos(L.rot), s = Math.sin(L.rot); return { x: L.x + u * c + v * s, z: L.z + u * s - v * c, name }; }
  text(who, mr, en) { const [n] = WHO[who] || [who]; this.g.phone.push(n, en ? `${mr}  (${en})` : mr); }
  save() { this.g.life.save(); }
  summary() {
    const ms = this.list(), st = this.st, out = [];
    ms.forEach((m, i) => out.push({ t: `${i + 1}. ${m.title}`, s: i < st.m ? 'Done' : i === st.m ? (st.step >= 0 ? (typeof this.cur()?.obj === 'function' ? this.cur().obj() : this.cur()?.obj) || 'In progress' : 'Your phone will ring') : 'Locked', cur: i === st.m }));
    return out;
  }

  // ---------------------------------------------------------------- flow
  startMission() {
    const m = this.mission(); if (!m) return;
    this.st.step = 0; this.st.base = this.g.stats.rides || 0; this.save(); this._entered = true;
    this.g.hud.flash(m.title, `${m.mr} · Act 1, mission ${this.st.m + 1} of ${this.list().length}`);
    for (const [w, mr, en] of m.texts || []) this.g.later(1.5, () => this.text(w, mr, en));
    this.enterStep();
  }
  enterStep() {
    const G = this.g, s = this.cur(); if (!s) return;
    this.dropNpcs(); this.arrived = false; this.course = null; this.photoAt = null; this.retry = 0; this.skip = 0; this.again = 0; this._entered = true;
    if (s.skip && s.skip()) { this.advance(); return; }
    s.enter && s.enter(this);
    const w = s.where && s.where();
    this.where = w;
    if (w && !s.who) G.setWaypoint({ x: w.x, z: w.z, name: w.name, gig: true });
    else if (!w) G.setWaypoint(null);
    if (s.rides) this.st.base = G.stats.rides || 0;
    if (s.course) this.makeCourse(s);
  }
  advance() {
    const G = this.g, m = this.mission(), s = this.cur();
    s && s.after && s.after(this);
    this.dropNpcs();
    this.st.step++;
    if (this.skip) { this.skip = 0; while (this.cur() && this.cur().course) this.st.step++; }
    if (this.st.step >= m.steps.length) {
      G.setWaypoint(null);
      m.end && m.end(this);
      G.hud.toast('Mission complete', m.title, 'good', 3.2); G.audio.cash?.();
      this.st.m++; this.st.step = -1;
      const nx = this.mission(); this.st.nextAt = (G.clock || 0) + (nx && nx.gap || 0.5);
      this.save();
      return;
    }
    this.save();
    this.enterStep();
  }
  // a refusal: back to the start of the mission, tomorrow-ish
  restart() { const G = this.g; this.dropNpcs(); G.setWaypoint(null); this.st.step = -1; this.st.nextAt = (G.clock || 0) + 6; this.save(); G.hud.toast('Not now', 'The offer will come again', 'info', 2.6); }

  update(dt) {
    const G = this.g;
    if (!this.on || G.state === 'resetting') { this.hideMarker(); return; }
    const st = this.st, m = this.mission();
    if (!m) { this.hideMarker(); return; }
    if (st.step < 0) {
      if ((G.clock || 0) >= (st.nextAt || 0) && (!m.when || m.when()) && G.state === 'play') this.startMission();
      this.hideMarker(); return;
    }
    if (!this._entered) { this._entered = true; this.enterStep(); }
    const s = this.cur(); if (!s) return;
    const P = G.player, w = this.where;
    if (w) { const d = Math.hypot(w.x - P.x, w.z - P.z); if (d < (s.r || 30)) this.arrived = true; }
    // characters stand where the scene is, once you're close enough to see them
    if (s.who && w && !this.npcs.length && Math.hypot(w.x - P.x, w.z - P.z) < 220) this.spawnNpcs(s, w);
    if (s.who && w && Math.hypot(w.x - P.x, w.z - P.z) > 120 && (!G.waypoint || G.waypoint.x !== w.x)) G.setWaypoint({ x: w.x, z: w.z, name: w.name, gig: true });
    // the marker: over the person to talk to, or over the place
    const tgt = this.npcs[0] || (w && Math.hypot(w.x - P.x, w.z - P.z) < 160 ? w : null);
    if (tgt && !this.talking) this.showMarker(tgt.x, tgt.z); else this.hideMarker();
    if (this.talking) return;
    if (s.course) { this.courseTick(dt); return; }
    if (s.photo) { if (this.photoAt && w && Math.hypot(this.photoAt.x - w.x, this.photoAt.z - w.z) < s.photo) { this.photoAt = null; G.hud.toast('Got it', 'Clear as day. Now get out of here', 'good', 2.4); this.advance(); } return; }
    if (s.rides) { if ((G.stats.rides || 0) - (st.base || 0) >= s.rides) this.advance(); return; }
    if (s.talk) return;                               // waits for F
    if (s.done && s.done(this)) this.advance();
  }
  objective() {
    if (!this.on) return null;
    const G = this.g, s = this.cur(), m = this.mission();
    if (!s || !m) return null;
    const main = typeof s.obj === 'function' ? s.obj() : s.obj;
    let sub = typeof s.sub === 'function' ? s.sub() : s.sub;
    if (s.rides) sub = `${Math.max(0, (G.stats.rides || 0) - (this.st.base || 0))} of ${s.rides} done · people waving show green on the map`;
    if (s.course && this.course) sub = `Checkpoint ${this.course.i + 1} of ${this.course.pts.length} · ${Math.max(0, Math.ceil(this.course.left))} s`;
    if (!sub && this.where) { const d = Math.hypot(this.where.x - G.player.x, this.where.z - G.player.z); sub = d > 950 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 10) * 10} m`; }
    return { main: `${m.title} · ${main}`, sub: sub || '', urgent: !!(s.course && this.course && this.course.left < 15) };
  }

  // ---------------------------------------------------------------- people
  spawnNpcs(s, w) {
    const G = this.g, n = s.who === 'goons' ? 3 : s.who === 'shinde' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const spot = G.safeDrop(w.x + i * 2.2, w.z + i * 1.4) || w;
      const near = G.W.graph.nearest(spot.x, spot.z, 160); if (!near) return;
      const p = G.people.make(near.e, near.s, near.side || 1, { mode: 'stand', female: s.who === 'meera' });
      p.x = spot.x + i * 1.6; p.z = spot.z + i * 0.9; p.fixed = true; p.anchor = { x: p.x, z: p.z }; p.wait = 1e9; p.idle = s.who === 'goons' ? 'arms_folded' : 'talk'; p.story = s.who;
      G.people.list.push(p); this.npcs.push(p);
    }
  }
  dropNpcs() {
    const list = this.g.people.list;
    for (const p of this.npcs) { const i = list.indexOf(p); if (i >= 0) { if (p.body) p.body.release(); list.splice(i, 1); } }
    this.npcs = [];
  }
  // the F prompt (shops.scan asks)
  near(x, z) {
    const s = this.cur(); if (!s || !s.talk || !this.npcs.length || this.talking) return null;
    const p = this.npcs[0]; if (Math.hypot(p.x - x, p.z - z) > 3) return null;
    return { kind: 'story', name: (WHO[s.who] || [s.who])[0], x: p.x, z: p.z };
  }
  label(n) { return `Talk to ${n.name} · F`; }
  use() { const s = this.cur(); if (s && s.talk) this.talk(s.talk.slice()); }

  // ---------------------------------------------------------------- the conversation
  talk(queue) {
    const G = this.g;
    this.queue = queue; this.talking = true; this.asking = null; this.hideMarker();
    this._was = G.state; G.state = 'shop'; G.audio.updateEngine?.(0, 0, false);
    const p = this.npcs[0]; if (p) { p.yaw = Math.atan2(G.player.x - p.x, G.player.z - p.z); }
    this.el.hidden = false; this.el.classList.remove('in'); void this.el.offsetWidth; this.el.classList.add('in');
    this.next();
  }
  next() {
    const G = this.g;
    if (!this.talking || this.asking) return;
    let it = this.queue.shift();
    while (it && it.fn) { const more = it.fn() || []; this.queue.unshift(...more); it = this.queue.shift(); }
    if (!it) { this.endTalk(); return; }
    if (it.ask) { this.asking = it.ask; this.askSel = 0; this.drawLine(null); this.drawAsk(); G.releaseMouse?.(); return; }
    this.drawLine(it);
    G.audio.blip?.();
  }
  drawLine(it) {
    const q = (c) => this.el.querySelector(c);
    if (it) {
      const [w, line, tr] = it, [name, col] = WHO[w] || [w, '#fff'];
      q('.sd-who').textContent = name; q('.sd-who').style.color = col;
      q('.sd-line').textContent = line; q('.sd-tr').textContent = tr || '';
      q('.sd-line').lang = /[ऀ-ॿ]/.test(line) ? 'mr' : 'en';
    }
    q('.sd-ask').innerHTML = ''; q('.sd-next').hidden = !!this.asking;
  }
  drawAsk() { this.el.querySelector('.sd-ask').innerHTML = this.asking.map(([l], i) => `<button data-k="${i}" class="${i === this.askSel ? 'sel' : ''}"><b>${i + 1}</b>${l}</button>`).join(''); }
  pick(i) {
    const a = this.asking && this.asking[i]; if (!a) return;
    this.asking = null; this.g.lockMouse?.();
    const more = a[1]() || [];
    this.queue.unshift(...more);
    this.next();
  }
  endTalk() {
    const G = this.g;
    this.talking = false; this.el.hidden = true; this._camOn = false; if (G.rig) G.rig.inited = false;
    if (G.state === 'shop') G.state = 'play';
    G.lockMouse?.();
    if (this.retry) { this.retry = 0; this.restart(); return; }
    if (this.again) { this.again = 0; return; }              // not settled yet: talk again when you're ready
    this.advance();
  }

  // ---------------------------------------------------------------- the driving test
  makeCourse(s) {
    const G = this.g, w = s.where && s.where(); if (!w) return;
    const pts = [];
    for (let i = 0; i < s.course; i++) { const a = i / s.course * 6.283 + 0.6; const p = G.safeDrop(w.x + Math.cos(a) * 140, w.z + Math.sin(a) * 140); if (p) pts.push(p); }
    this.course = { pts, i: 0, left: s.limit, started: false };
    G.setWaypoint({ x: pts[0].x, z: pts[0].z, name: 'Checkpoint 1', gig: true });
  }
  courseTick(dt) {
    const G = this.g, c = this.course, P = G.player; if (!c || !c.pts.length) { this.advance(); return; }
    if (P.onFoot) { c.left = this.cur().limit; c.i = 0; c.started = false; return; }
    c.started = true; c.left -= dt;
    const t = c.pts[c.i];
    if (Math.hypot(t.x - P.x, t.z - P.z) < 14) {
      G.audio.blip?.(); c.i++;
      if (c.i >= c.pts.length) { this.advance(); return; }
      G.setWaypoint({ x: c.pts[c.i].x, z: c.pts[c.i].z, name: `Checkpoint ${c.i + 1}`, gig: true });
    }
    if (c.left <= 0) { G.hud.toast('Failed', 'Too slow. The inspector sighs. Again', 'warn', 2.6); c.i = 0; c.left = this.cur().limit; G.setWaypoint({ x: c.pts[0].x, z: c.pts[0].z, name: 'Checkpoint 1', gig: true }); }
  }
  // over your shoulder, onto whoever's talking
  cam(dt) {
    const G = this.g, p = this.npcs[0], P = G.player, C = G.camera;
    if (!p || !P.onFoot) return;
    let dx = p.x - P.x, dz = p.z - P.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const y0 = G.W.surf.height(P.x, P.z), tx = P.x - dx * 2.3 + dz * 1.1, tz = P.z - dz * 2.3 - dx * 1.1;
    const k = 1 - Math.exp(-dt * 4);
    if (!this._camOn) { C.position.set(tx, y0 + 1.75, tz); this._camOn = true; }
    C.position.x += (tx - C.position.x) * k; C.position.z += (tz - C.position.z) * k; C.position.y += (y0 + 1.75 - C.position.y) * k;
    C.lookAt(p.x, G.W.surf.height(p.x, p.z) + 1.5, p.z);
    if (P.foot) P.foot.yaw = Math.atan2(dz, dx);
  }
  onPhoto(x, z) { if (this.cur() && this.cur().photo) this.photoAt = { x, z }; }

  // ---------------------------------------------------------------- the saffron marker
  showMarker(x, z) {
    const G = this.g;
    if (!this.marker) {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.95, depthTest: false });
      const cone = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), m); cone.scale.y = 1.6; g.add(cone);
      g.traverse(o => { o.renderOrder = 999; }); G.scene.add(g); this.marker = g;
    }
    const t = performance.now() / 1000;
    this.marker.visible = true; this.marker.position.set(x, G.W.surf.height(x, z) + 2.9 + Math.sin(t * 2.6) * 0.15, z); this.marker.rotation.y = t * 1.8;
  }
  hideMarker() { if (this.marker) this.marker.visible = false; }
}
export { fmt };
