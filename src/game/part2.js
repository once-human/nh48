// PUNERI, Parts Two and Three: Act 3 "Nine Nights" (Navratri), Act 4 "Lights" (Diwali), Act 5 "Winter".
// Aryan Malhotra knows your face now. What you choose from here is remembered (the flags below) and decides who
// is standing with you at the end, at Shaniwar Wada, at midnight, and how it ends:
//   wire     you wore ACP Shinde's wire              copied   you copied the server for evidence (wiped: destroyed it)
//   warned   you warned the riders (bait: used them)  kabir    'shinde' | 'bhau' | 'left' (where you took Kabir)
//   bhau     'debt' (did his dirty work) | 'no'       strike   you led the riders' strike
//   r2       you danced (the KP romance)              aaiDoor  how you dealt with Aryan's men at your door
// Lines: [who, as spoken (Marathi / Hindi / English), English].
import { dialogueScene, actor } from './scenes.js';
import { buildServerRoom } from '../world/storyProps.js';

const inHours = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;

export function PART2(S) {
  const G = S.g, F = S.flags;
  const fem = () => S.fem;
  const L = (who, m, f, en) => ({ fn: () => [[who, fem() ? f : m, en]] });
  const R1 = () => (fem() ? 'kunal' : 'khushi'), R2 = () => (fem() ? 'veer' : 'tara');
  const at = (...a) => () => S.at(...a);
  const here = (name, dx = 0, dz = 0) => S.at(name, '', dx, dz) || { x: G.player.x, z: G.player.z };
  const raise = (lvl, why) => { const P = G.police; if (!P) return; let k = 0; while (P.heat < lvl && k++ < 30) P.raiseHeat(1, why, 'theft'); };
  let room = null;
  return [
    // ================================================================ ACT 3 · NINE NIGHTS (Navratri)
    { id: 'garba', act: 3, title: 'Garba', mr: 'गरबा', gap: 8, when: () => inHours(G.hour, 19, 24),
      texts: [[R2(), 'नवरात्र. आज रात्री दांडिया. पांढरे कपडे घाल. आणि हो, आर्यनचा अकाउंटंट पण तिथे असेल. योगायोग.', 'Navratri. Dandiya tonight. Wear white. Oh, and Aryan’s accountant will be there too. Coincidence.']],
      steps: [
        { obj: 'Get to the dandiya ground', sub: 'By Nehru Stadium, after dark', where: at('Nehru Stadium', 'The dandiya ground', 60, 40), r: 45, done: (s) => s.arrived },
        { obj: 'Find them in the crowd', who: () => R2(), where: at('Nehru Stadium', 'By the stage', 64, 46), talk: [
          { fn: () => [[R2(), fem() ? 'आलीस! वाटलं नव्हतं. चल, एक फेरी. मग काम.' : 'आलास! वाटलं नव्हतं. चल, एक फेरी. मग काम.', 'You came! I didn’t think you would. Come, one round. Then work.']] },
          { fn: () => [[R2(), 'तो बघ. चष्मा, ग्रे शर्ट, हातात फोन. देसाई. आर्यनचे सगळे पैसे त्याच्या डोक्यात आहेत.', 'See him. Glasses, grey shirt, phone in hand. Desai. All of Aryan’s money is in his head.']] },
          { ask: [
            ['Dance with them first', () => { F.r2 = 1; G.life.change('mood', 0.25); return [[R2(), 'एक फेरी, बोललो होतो ना. …ठीक आहे, तीन. आता जा, तो निघतोय.', 'One round, I said. …Fine, three. Now go, he’s leaving.']]; }],
            ['Keep your eyes on Desai', () => [[R2(), 'कामच कामच. ठीक आहे. पण नंतर मला वडापाव तू घेऊन देशील.', 'All work. Fine. But later you’re buying me a vada pav.']]],
          ] },
        ] },
        { obj: 'Follow Desai. Don’t let him see you', sub: 'He’s nervous. Stay back', tail: { type: 'sedan', paint: [0.42, 0.44, 0.48], from: at('Nehru Stadium', '', 120, 20), to: at('Camp', '', 60, -40), speed: 9 }, tooClose: 8 },
        { obj: 'Photograph Desai with the ledger', sub: 'K for photo mode, Space to shoot', where: at('Camp', 'Desai, a café table', 60, -40), photo: 12 },
      ],
      end: () => { F.ledger = 1; S.contact('Desai', 'Aryan’s accountant'); S.text(R2(), 'मिळाला फोटो? छान. आता मला एक गोष्ट सांग: तू कोणासाठी काम करतोस?', 'Got the photo? Good. Now tell me one thing: who are you working for?'); } },

    { id: 'mule', act: 3, title: 'Mule', mr: 'म्यूल', gap: 10, when: () => inHours(G.hour, 9, 21),
      texts: [['tj', 'Desai cha photo baghitla. Tyachya ledger madhye 40 riders chi naava. Sagla mule accounts. Magarpatta la ye.', 'Saw Desai’s photo. Forty riders’ names in his ledger. All mule accounts. Come to Magarpatta.']],
      steps: [
        { obj: 'Meet TJ at the riders’ hangout', where: at('Magarpatta City', 'TJ, the riders’ chai stop', -40, 30), r: 40, done: (s) => s.arrived },
        { obj: 'Talk to TJ', who: 'tj', where: at('Magarpatta City', 'TJ', -38, 32), talk: [
          ['tj', 'Chaalis mula. Tyanna mahit pan nahi ki tyanchya naava var lakho rupaye firtat. Police aale tar te jail madhye, Aryan ghari.', 'Forty kids. They don’t even know lakhs are moving through accounts in their names. When the police come, they go to jail, Aryan goes home.'],
          ['tj', 'Don rasta. Sagalyanna saang, ek ek karun. Halu, pan te vachtil. Kinva tyanna gaal ghala: Aryan che lok tyanchya mage yetil, aani aapan Aryan chya lokan mage.', 'Two ways. Tell them all, one by one. Slow, but they’re saved. Or use them as bait: Aryan’s men come for them, and we follow Aryan’s men.'],
          { ask: [
            ['Warn every rider', () => { F.warned = 1; G.rep && G.rep.deed('patient', G.player.x, G.player.z, 0.5); return [['tj', 'Mala mahit hota tu he mhanshil. Chal, teen jaga aahet. Lavkar.', 'I knew you’d say that. Come on, three places. Quickly.']]; }],
            ['Use them as bait', () => { F.bait = 1; G.life.change('karma', -6); return [['tj', '…Theek ahe. Pan konala kahi jhala, tar te tujhya dokyavar.', '…Fine. But if anything happens to anyone, that’s on your head.']]; }],
          ] },
        ] },
        { obj: 'Warn the riders at Hadapsar', sub: 'They wait outside the dark store', where: at('Magarpatta City', 'Riders, Hadapsar', 420, 180), r: 30, skip: () => !F.warned, done: (s) => s.arrived },
        { obj: 'Warn the riders at Kharadi', where: at('EON IT Park', 'Riders, Kharadi', -60, 80), r: 30, skip: () => !F.warned, done: (s) => s.arrived },
        { obj: 'Warn the riders at Viman Nagar', where: at('Phoenix Marketcity', 'Riders, Viman Nagar', 80, -40), r: 30, skip: () => !F.warned, done: (s) => s.arrived },
        { obj: 'Aryan’s men took the bait. Follow their van', sub: 'Where they go, Aryan is', skip: () => !F.bait, tail: { type: 'tempo', paint: [0.12, 0.12, 0.14], from: at('Magarpatta City', '', 300, 0), to: at('Koregaon Park', '', -80, 120), speed: 10 }, tooClose: 9 },
      ],
      end: () => {
        if (F.warned) S.text('tj', 'Chaalis paiki adtis jaan gavi gele. Baaki doghe… tyanna ushir jhala. Tu tari prayatna kela.', 'Thirty-eight of forty went back to their villages. The other two… we were too late. At least you tried.');
        else { S.text('tj', 'Van Koregaon Park madhye thambli. Aani don mula… tyanna maarla. Hospital madhye ahet. He tuzha plan hota.', 'The van stopped in Koregaon Park. And two of the kids… they beat them. They’re in hospital. That was your plan.'); F.kpHouse = 1; }
      } },

    { id: 'deal', act: 3, title: 'Shinde’s Deal', mr: 'सौदा', gap: 6, when: () => inHours(G.hour, 9, 20),
      texts: [['shinde', 'Vishrambaug police chowki. Aaj. Ekta ye. Tujhyakade photo ahet, maajhyakade warrant. Bolu.', 'Vishrambaug police chowki. Today. Come alone. You have photos, I have warrants. Let’s talk.']],
      steps: [
        { obj: 'Go to Vishrambaug police chowki', where: at('vishrambaug', 'The chowki', 0, -40), r: 35, done: (s) => s.arrived },
        { obj: 'Hear ACP Shinde out', scene: (s) => dialogueScene(s, here('vishrambaug', 0, -38), [['shinde', 0]], [
          ['shinde', 'बस. तुझे फोटो पाहिले. देसाई, लेजर, रायडर्स. छान काम. एका संशयिताकडून.', 'Sit. I saw your photos. Desai, the ledger, the riders. Good work. From a suspect.'],
          ['shinde', 'कोर्टात हे सगळं "बेकायदेशीर पुरावा" म्हणून बाहेर फेकलं जाईल. आर्यनचे वकील मुंबईहून येतात.', 'In court all this gets thrown out as illegally obtained. Aryan’s lawyers fly in from Mumbai.'],
          ['shinde', 'पण तू त्याच्या आत जाऊ शकतोस. तो तुला ओळखतो. तुझा कोड त्याच्या खिशात आहे. एक वायर. एक रेकॉर्डिंग. मग वॉरंट.', 'But you can get inside. He knows you. Your code is in his pocket. A wire. One recording. Then a warrant.'],
          ['you', fem() ? 'आणि मी पकडले गेले तर?' : 'आणि मी पकडला गेलो तर?', 'And if I get caught?'],
          ['shinde', 'तर मी तुला ओळखत नाही.', 'Then I don’t know you.'],
        ], { title: 'सौदा', sub: 'Act 3 · Vishrambaug' }) },
        { obj: 'Decide', who: 'shinde', where: at('vishrambaug', 'ACP Shinde', 1.7, -38), talk: [
          ['shinde', 'तर? वायर घालतोस की नाही?', 'So? Will you wear the wire?'],
          { ask: [
            ['Wear the wire', () => { F.wire = 1; return [['shinde', 'छान. आजपासून तू माझा. पोलिसांच्या रडारवर असलास तरी माझा. मी त्यांना थोडं हळू ठेवेन.', 'Good. From today you’re mine. Even on police radar, you’re mine. I’ll keep them a little slower.']]; }],
            ['Refuse', () => { F.wire = 0; return [['shinde', 'मग तू संशयित आहेस. आणि संशयितांवर आम्ही नजर ठेवतो. जा.', 'Then you’re a suspect. And we keep an eye on suspects. Go.']]; }],
          ] },
        ] },
      ],
      end: () => {
        // the twist: the reporter has been feeding Shinde all along
        G.later(14, () => S.text('meera', 'मी तुला एक गोष्ट सांगायला हवी होती. तुझे फोटो मीच शिंदेंना दिले. ती माझी सोर्स आहे. सॉरी. पण तुला वाचवायला.', 'I should have told you something. I’m the one who gave your photos to Shinde. She’s my source. Sorry. But it was to save you.'));
      } },

    { id: 'farmhouse', act: 3, title: 'Farmhouse', mr: 'फार्महाऊस', gap: 8, when: () => inHours(G.hour, 20, 4),
      texts: [['unk', 'खडकवासला. धरणाच्या मागे फार्महाऊस. ते मला शोधतायत. आज रात्री. प्लीज. — क', 'Khadakwasla. A farmhouse behind the dam. They’re looking for me. Tonight. Please. — K']],
      steps: [
        { obj: () => inHours(G.hour, 21, 4) ? 'Get to the farmhouse behind Khadakwasla dam' : 'At night: the farmhouse at Khadakwasla', where: at('Khadakwasla Dam', 'Kabir’s farmhouse', 260, 180), r: 45, done: (s) => s.arrived && inHours(G.hour, 21, 4.5) },
        { obj: 'Talk to Kabir', who: 'kabir', where: at('Khadakwasla Dam', 'Kabir', 263, 183), talk: [
          L('kabir', 'आलास. मला वाटलं नव्हतं तू येशील. मी असतो तर आलो नसतो.', 'आलीस. मला वाटलं नव्हतं तू येशील. मी असतो तर आलो नसतो.', 'You came. I didn’t think you would. I wouldn’t have, in your place.'),
          ['kabir', 'आर्यनला कळलंय मी पैसे बाजूला काढले. तुझ्यासाठी. तुझ्या आईच्या घराचं कर्ज, मी फेडलं होतं. तिला माहीत नाही.', 'Aryan found out I was skimming. For you. Your mother’s house loan, I paid it off. She doesn’t know.'],
          ['kabir', 'त्याची माणसं येतायत. मला कुठेतरी घेऊन चल. कुठेही.', 'His men are coming. Take me somewhere. Anywhere.'],
          { ask: [
            ['Take him to ACP Shinde', () => { F.kabir = 'shinde'; return [['kabir', 'पोलीस? …ठीक आहे. मी साक्ष देईन. पण मला जिवंत पोचव.', 'The police? …Fine. I’ll testify. Just get me there alive.']]; }],
            ['Hide him with Bhau', () => { F.kabir = 'bhau'; return [['kabir', 'भाऊ? तो सगळ्यांना ओळखतो. …ठीक आहे. पर्याय नाही.', 'Bhau? He knows everyone. …Fine. No choice.']]; }],
            ['Leave him here', () => { F.kabir = 'left'; G.life.change('karma', -8); return [['kabir', 'बरोबर. मी हेच केलं असतं. …पळ. ते आलेत.', 'Right. That’s what I’d have done. …Run. They’re here.']]; }],
          ] },
        ] },
        { obj: () => F.kabir === 'shinde' ? 'Get Kabir to Vishrambaug chowki' : 'Get Kabir to Bhau’s pandal in Navi Peth', sub: 'Their headlights are behind you', skip: () => F.kabir === 'left',
          where: () => F.kabir === 'shinde' ? S.at('vishrambaug', 'The chowki', 0, -40) : S.at('Narayan Peth', 'Bhau’s pandal', 60, 0), r: 40, escort: { dmg: 0.35, kmh: 140 },
          enter: () => raise(2, 'Aryan’s men called the police on you'), done: (s) => s.arrived },
        { obj: 'Get away from the farmhouse', sub: 'Lose the police they’ve set on you', skip: () => F.kabir !== 'left', enter: () => raise(2, 'Seen leaving a farmhouse where shots were fired'), done: () => G.police.heat === 0 },
      ],
      end: () => {
        if (F.kabir === 'shinde') S.text('shinde', 'कबीर माझ्याकडे आहे. तो बोलतोय. खूप बोलतोय. तू आज कोणाचा तरी जीव वाचवलास.', 'Kabir’s with me. He’s talking. A lot. You saved someone’s life today.');
        else if (F.kabir === 'bhau') S.text('bhau', 'कबीर माझ्याकडे सुरक्षित आहे. काळजी नको. आता तू माझं एक काम कर.', 'Kabir is safe with me. Don’t worry. Now you do a job for me.');
        else G.later(20, () => S.text('unk', 'कबीर मल्होत्रांच्या गाडीत चढताना दिसला. हसत होता.', 'Kabir was seen getting into a Malhotra car. He was smiling.'));
      } },

    { id: 'dussehra', act: 3, title: 'Dussehra', mr: 'दसरा', gap: 10, when: () => inHours(G.hour, 10, 22),
      texts: [['bhau', 'दसरा. सोनं लुटायचा दिवस. निवडणूक जवळ आलीय. कसबा गणपतीपाशी ये. एक काम आहे.', 'Dussehra. The day you share gold. The election’s close. Come to Kasba Ganpati. There’s a job.']],
      steps: [
        { obj: 'Meet Bhau at Kasba Ganpati', who: 'bhau', where: at('Kasba Ganpati', 'Bhau Jagtap', 6, 4), talk: [
          ['bhau', 'वस्तीतल्या कमिटीने माझ्या उमेदवाराला पाठिंबा द्यायचा नाही म्हणतेय. तू त्यांना… समजावून सांग. माझी तीन पोरं तुझ्या रिक्षात बसतील.', 'The basti committee says it won’t back my candidate. You… explain things to them. Three of my boys will ride in your auto.'],
          ['bhau', 'मी तुझ्यासाठी बाप्पा वाचवला, कबीरला लपवलं. आता तुझी पाळी.', 'I saved Bappa for you, I hid Kabir. Now it’s your turn.'],
          { ask: [
            ['Drive his boys there', () => { F.bhau = 'debt'; G.life.change('karma', -10); G.life.change('respect', 6); return [['bhau', 'शहाणा. तू माझ्या माणसांसारखा विचार करतोस.', 'Smart. You think like one of mine.']]; }],
            ['Refuse', () => { F.bhau = 'no'; G.life.change('karma', 4); return [['bhau', 'ठीक आहे. पण पुण्यात भाऊला नाही म्हणणारे फार दिवस टिकत नाहीत.', 'Fine. But in Pune, people who say no to Bhau don’t last long.']]; }],
          ] },
        ] },
        { obj: 'Drive Bhau’s boys to the basti', sub: 'They want to arrive fast', skip: () => F.bhau !== 'debt', where: at('Market Yard', 'The basti', 120, 60), r: 40, done: (s) => s.arrived },
        { obj: 'Get out of there', sub: 'Someone filmed it. Lose the police', skip: () => F.bhau !== 'debt', enter: () => raise(1, 'Intimidating voters'), done: () => G.police.heat === 0 },
      ],
      end: () => { G.later(30, () => G.hud.flash('Act 3 complete: Nine Nights', 'Act 4, Lights, comes with Diwali')); } },

    // ================================================================ ACT 4 · LIGHTS (Diwali)
    { id: 'server', act: 4, title: 'Server Room', mr: 'सर्व्हर रूम', gap: 12, when: () => inHours(G.hour, 1, 5),
      texts: [[R1(), 'तुझा कोड कुठून चालतो ते सापडलं. हिंजवडी फेज 2 च्या मागे एक जुनं गोदाम. आत सर्व्हर. रात्री दोन ते चार, एक गार्ड झोपतो.', 'Found where your code runs from. An old warehouse behind Hinjewadi Phase 2. Servers inside. Two to four at night, one guard sleeps.']],
      steps: [
        { obj: () => inHours(G.hour, 1.5, 4.5) ? 'Get to the warehouse behind Phase 2' : 'Between 2 and 4 am: the warehouse, Hinjewadi', where: at('Rajiv Gandhi Infotech Park', 'The warehouse', -760, -420), r: 50, done: (s) => s.arrived && inHours(G.hour, 1.5, 4.5) },
        { obj: 'Get to the server room unseen', sub: 'On foot. Four guards', sneak: { guards: 4, goal: at('Rajiv Gandhi Infotech Park', 'The server room', -750, -405) },
          enter: () => { const p = S.at('Rajiv Gandhi Infotech Park', '', -750, -405); if (p) { room = buildServerRoom(2, 6); room.position.set(p.x, G.W.surf.height(p.x, p.z), p.z); G.scene.add(room); } } },
        { obj: 'Your code, running', scene: (s) => { const p = here('Rajiv Gandhi Infotech Park', -750, -405), P = G.player;
          return { title: 'सर्व्हर रूम', sub: 'Act 4 · Hinjewadi, 3 am',
            shots: [
              { dur: 6, update: (cs) => room && room.userData.tick(cs.t + 10), enter: () => { P.teleportFoot(p.x - 2.6, p.z, 0, G.traffic); },
                cam: (cs) => ({ x: p.x - 3.6 + cs.t * 0.25, y: G.W.surf.height(p.x, p.z) + 1.7, z: p.z + 0.2, lx: p.x + 2, ly: G.W.surf.height(p.x, p.z) + 1.3, lz: p.z, fov: 52 }),
                lines: [[1.2, 'you', 'हे सगळे… माझे. माझ्या रात्री. माझा कोड.', 'All of these… mine. My nights. My code.'], [3.8, 'you', 'आणि यातून जातात ड्रग्ज, चोरीचे पैसे, आणि चाळीस मुलांची नावं.', 'And through them go drugs, dirty money, and forty kids’ names.']] },
              { dur: 4.5, update: (cs) => room && room.userData.tick(cs.t + 16), cam: () => ({ x: p.x + 1, y: G.W.surf.height(p.x, p.z) + 1.2, z: p.z - 0.4, lx: p.x - 1, ly: G.W.surf.height(p.x, p.z) + 1.5, lz: p.z - 0.4, fov: 38, cut: true }),
                lines: [[0.6, 'you', 'एक पेन ड्राइव्ह. दोन पर्याय.', 'One pen drive. Two choices.']] },
            ] }; } },
        { obj: 'Choose', who: R1, where: () => { const p = here('Rajiv Gandhi Infotech Park', -750, -405); return { x: p.x - 1.5, z: p.z + 1.6, name: 'On the phone' }; }, talk: [
          { fn: () => [[R1(), 'मी लाईनवर आहे. पुसून टाक, सगळं संपेल, आर्यनचं नेटवर्क आज रात्री मरेल. पण पुरावा पण मरेल.', 'I’m on the line. Wipe it, it’s over, Aryan’s network dies tonight. But so does the evidence.']] },
          { fn: () => [[R1(), 'किंवा कॉपी कर. पुरावा राहील. पण नेटवर्क चालूच राहील, अजून काही आठवडे. आणि ते तुला शोधतील.', 'Or copy it. The evidence lives. But the network keeps running, a few more weeks. And they’ll hunt you.']] },
          { ask: [
            ['Wipe it all', () => { F.wiped = 1; return [[R1(), 'झालं. सगळं काळं. आत्ता या क्षणी पुण्यात हजार डिलिव्हरी अडकल्या. पळ!', 'Done. Everything dark. Right now a thousand deliveries froze across Pune. Run!']]; }],
            ['Copy it for evidence', () => { F.copied = 1; return [[R1(), 'कॉपी होतंय… झालं. ती पेन ड्राइव्ह आता या शहरातली सर्वात महाग वस्तू आहे. पळ!', 'Copying… done. That pen drive is now the most expensive thing in this city. Run!']]; }],
          ] },
        ] },
        { obj: 'Get out. They know', sub: 'Lose the police', enter: () => raise(3, 'Break-in at a data centre'), done: () => G.police.heat === 0 },
      ],
      end: () => { if (room) { if (room.parent) room.parent.remove(room); room = null; } } },

    { id: 'faral', act: 4, title: 'Faral', mr: 'फराळ', gap: 10, when: () => inHours(G.hour, 17, 22),
      texts: [['aai', 'दिवाळी आहे. फराळ केलाय. लवकर ये. एकदा तरी.', 'It’s Diwali. I’ve made faral. Come home early. For once.']],
      steps: [
        { obj: 'Go home', sub: 'Sadashiv Peth', where: at('Sadashiv Peth', 'Home'), r: 40, done: (s) => s.arrived },
        { obj: 'Diwali with Aai', scene: (s) => dialogueScene(s, here('Sadashiv Peth', 2, 2), [['aai', 0]], [
          ['aai', F.paidAai ? 'तू त्या रात्री बिलांसाठी पैसे दिलेस. मी बोलले नाही, पण मला आठवतं.' : 'त्या रात्री तू म्हणालास "पुढच्या आठवड्यात". मी वाट पाहिली. काही हरकत नाही.', F.paidAai ? 'That night you gave me money for the bills. I didn’t say anything, but I remember.' : 'That night you said “next week”. I waited. It’s all right.'],
          ['aai', 'आणि हे सांग: बँकेचं पत्र आलंय. घराचं कर्ज कोणीतरी पूर्ण फेडलंय. कोण?', 'And tell me this: a letter from the bank came. Someone has paid off the house loan in full. Who?'],
          ['you', 'कबीर.', 'Kabir.'],
          ['aai', 'कबीर? …दार. कोणीतरी दारावर आहे.', 'Kabir? …The door. Someone’s at the door.'],
        ], { title: 'दिवाळी', sub: 'Act 4 · Sadashiv Peth' }) },
        { obj: 'Aryan’s men are at the door', who: 'goons', where: at('Sadashiv Peth', 'At your door', 4, 5), talk: [
          ['goons', F.bhau === 'no' ? 'भाऊंनी नमस्कार सांगितलाय. आणि आर्यन साहेबांनी पेन ड्राइव्ह मागितलाय.' : 'आर्यन साहेबांनी पेन ड्राइव्ह मागितलाय. आणि म्हणाले, आईची काळजी घ्या.', F.bhau === 'no' ? 'Bhau sends his regards. And Aryan saheb wants the pen drive.' : 'Aryan saheb wants the pen drive. And he says, take care of your mother.'],
          ['aai', 'माझ्या घरात कोणीही पाय ठेवणार नाही. दिवाळीला तर नाहीच.', 'Nobody sets foot in my house. Certainly not at Diwali.'],
          { ask: [
            ['Stand with Aai, face them down', () => { F.aaiDoor = 'stood'; G.life.change('respect', 6); return [['goons', 'आज दिवाळी आहे म्हणून. पुढच्या वेळी नाही.', 'Only because it’s Diwali. Not next time.']]; }],
            ['Pay them ₹20,000 to go', () => { F.aaiDoor = 'paid'; if (G.shops && G.shops.spend) G.shops.spend(20000); return [['goons', 'शहाणा. पण साहेबांना पैसे नकोत. पेन ड्राइव्ह हवाय.', 'Smart. But saheb doesn’t want money. He wants the pen drive.']]; }],
            ['Call ACP Shinde', () => { F.aaiDoor = F.wire ? 'shinde' : 'nobody'; return F.wire ? [['goons', 'सायरन? …चला रे!', 'Sirens? …Let’s go!']] : [['goons', 'कोणाला फोन करतोयस? कोणी उचलत नाही?', 'Who are you calling? Nobody picking up?']]; }],
          ] },
        ] },
      ],
      end: () => { S.text('aai', 'मला सगळं सांग. आज रात्री. सगळं.', 'Tell me everything. Tonight. Everything.'); } },

    { id: 'frontpage', act: 4, title: 'Front Page', mr: 'पहिलं पान', gap: 10, when: () => inHours(G.hour, 8, 20),
      texts: [['meera', 'Vohuman, Sassoon Road. Bun maska. Aan tujhyakade je ahe te. Udya chya pepar madhye.', 'Vohuman, Sassoon Road. Bun maska. And whatever you have. Tomorrow’s paper.']],
      steps: [
        { obj: 'Meet Meera at Vohuman Cafe', who: 'meera', where: at('Vohuman Cafe', 'Meera', 4, 3), talk: [
          ['meera', F.copied ? 'हा पेन ड्राइव्ह… हे सगळं? हे फ्रंट पेज नाही, हे सरकार पाडेल.' : F.wiped ? 'तू सर्व्हर पुसलास? धाडसी. पण माझ्याकडे आता फक्त फोटो आहेत आणि तुझा शब्द.' : 'फक्त फोटो? पुरेसे नाहीत. पण छापते.', F.copied ? 'This pen drive… all of this? This isn’t a front page, this brings down a government.' : F.wiped ? 'You wiped the servers? Brave. But now all I have is photos and your word.' : 'Just photos? Not enough. But I’ll print.'],
          ['meera', 'उद्या सकाळी. तयार राहा. ते वकील घेऊन येतील, आणि मग गुंड.', 'Tomorrow morning. Be ready. They’ll come with lawyers, and then with goons.'],
        ] },
        { obj: 'Follow Aryan’s car from the Marriott', sub: 'See where he runs when the paper hits', tail: { type: 'suv', paint: [0.06, 0.06, 0.07], from: at('JW Marriott Pune', '', 40, 20), to: at('Koregaon Park', '', -120, 160), speed: 11 }, tooClose: 10 },
      ],
      end: () => { G.later(4, () => G.hud.flash('पहिलं पान', F.copied ? '“Rider network laundered crores”: the story runs, and the city reads it' : 'The story runs on page 6. By noon a court has gagged it')); G.later(40, () => G.hud.flash('Act 4 complete: Lights', 'Act 5, Winter. The end of it')); } },

    // ================================================================ ACT 5 · WINTER
    { id: 'strike', act: 5, title: 'Strike', mr: 'संप', gap: 12, when: () => inHours(G.hour, 8, 19),
      texts: [['tj', 'Udya sagla riders sanpavar. Zappo, DropKart, sagla. Aani tu aamcha chehra hoshil ka? Shaniwar Wada.', 'Tomorrow every rider strikes. Zappo, DropKart, all of them. Will you be our face? Shaniwar Wada.']],
      steps: [
        { obj: 'Shaniwar Wada: the riders are gathering', where: at('shaniwar', 'The riders’ rally', 30, -110), r: 50, done: (s) => s.arrived },
        { obj: 'Talk to TJ', who: 'tj', where: at('shaniwar', 'TJ', 33, -108), talk: [
          ['tj', F.warned ? 'He sagla tujhyamule ithe aahet. Tu tyanna vachavla. Aata te tujhe.' : 'Kahi lok tujhyavar raagavle ahet. Don mula hospital madhye gele. Pan aaj tyanna netaa have.', F.warned ? 'They’re all here because of you. You saved them. Now they’re yours.' : 'Some of them are angry with you. Two kids ended up in hospital. But today they need someone to lead.'],
          { ask: [
            ['Lead the strike', () => { F.strike = 1; G.life.change('respect', 10); return [['tj', 'Chala! Shaniwar Wada te Swargate, horn vajavat!', 'Let’s go! Shaniwar Wada to Swargate, horns blaring!']]; }],
            ['Stay out of it', () => [['tj', 'Theek. Pan lakshat thev, aaj kon ubha rahila te.', 'Fine. But remember who stood up today.']]],
          ] },
        ] },
        { obj: 'Lead the riders to Swargate', sub: 'Slow, loud, together. Don’t lose them', skip: () => !F.strike, where: at('Swargate Bus Stand', 'Swargate'), r: 60, escort: { dmg: 0.25, kmh: 30 }, done: (s) => s.arrived },
      ],
      end: () => { if (F.strike) S.text('meera', 'टीव्हीवर सगळीकडे तू. "रायडर्सचा चेहरा". आर्यन आता घाबरलाय. घाबरलेले लोक धोकादायक असतात.', 'You’re all over TV. “The face of the riders”. Aryan is scared now. Scared people are dangerous.'); } },

    { id: 'framed', act: 5, title: 'Nakabandi', mr: 'नाकाबंदी', gap: 6, when: () => inHours(G.hour, 18, 24),
      texts: [['unk', 'Desai mela. Tujhya rikshat. Police tujhya ghari ahet. — M', 'Desai is dead. In your auto. The police are at your house. — M']],
      steps: [
        { obj: 'Lose the police. The whole city is looking', sub: 'They found Desai in your auto. You didn’t do it', enter: () => raise(F.wire ? 3 : 4, 'Murder: Desai, found in your auto'), done: () => G.police.heat === 0 },
        { obj: () => F.wire ? 'Get to ACP Shinde, quietly' : F.bhau === 'debt' ? 'Hide at Bhau’s pandal' : 'Hide at TJ’s room in Hadapsar', where: () => F.wire ? S.at('vishrambaug', 'ACP Shinde, the back gate', 30, -60) : F.bhau === 'debt' ? S.at('Narayan Peth', 'Bhau’s pandal', 60, 0) : S.at('Magarpatta City', 'TJ’s room', 300, 160), r: 30, done: (s) => s.arrived },
        { obj: 'Talk', who: () => F.wire ? 'shinde' : F.bhau === 'debt' ? 'bhau' : 'tj', where: () => { const w = F.wire ? S.at('vishrambaug', '', 31.5, -58) : F.bhau === 'debt' ? S.at('Narayan Peth', '', 62, 2) : S.at('Magarpatta City', '', 302, 162); return { ...w, name: 'Here' }; }, talk: [
          { fn: () => F.wire ? [['shinde', 'मला माहीत आहे तू नाहीस. रेकॉर्डिंगमध्ये आर्यनचा आवाज आहे: "देसाईचं काम कर". पण मला त्याला रंगेहाथ हवाय. शनिवारवाडा, आज मध्यरात्री. तो तिथे तुला भेटायला येईल. तुझ्या कोडसाठी.', 'I know it wasn’t you. The recording has Aryan’s voice: “take care of Desai”. But I need him red-handed. Shaniwar Wada, midnight tonight. He’ll come to meet you there. For your code.']]
            : F.bhau === 'debt' ? [['bhau', 'मी तुला लपवेन. पण शेवटचं काम: आर्यनला शनिवारवाड्यावर बोलाव. मग त्याचं सगळं नेटवर्क माझं. आणि तुझं.', 'I’ll hide you. But one last job: call Aryan to Shaniwar Wada. Then his whole network is mine. And yours.']]
            : [['tj', 'Tu ekta nahis. Aaj raatri Shaniwar Wada. Aapan sagla tyala ghero. Rider lok, phone camera, live. Sagla Pune baghel.', 'You’re not alone. Tonight, Shaniwar Wada. We all surround him. Riders, phone cameras, live. All of Pune watches.']] },
        ] },
      ] },

    { id: 'kabirlast', act: 5, title: 'Kabir', mr: 'कबीर', gap: 3, when: () => inHours(G.hour, 20, 23.5),
      texts: [['unk', 'Ek shevatcha bhet. Z Bridge. — K', 'One last meeting. Z Bridge. — K']],
      steps: [
        { obj: 'The Z Bridge', where: at('Z Bridge', 'Kabir'), r: 35, done: (s) => s.arrived },
        { obj: 'Kabir', scene: (s) => dialogueScene(s, here('Z Bridge', 2, 1), [['kabir', 0]],
          F.kabir === 'shinde' ? [
            ['kabir', 'मी साक्ष दिली. सगळी. आर्यनच्या वकिलांनी माझी किंमत लावली, पाच कोटी. मी नाही म्हणालो.', 'I testified. All of it. Aryan’s lawyers put a price on me, five crore. I said no.'],
            ['kabir', 'आपण एकदा दहा मिनिटांत अख्खं शहर जोडलं होतं. आठवतं? चल, आज ते परत तोडूया.', 'We once connected a whole city in ten minutes. Remember? Come, tonight let’s break it back.'],
          ] : F.kabir === 'bhau' ? [
            ['kabir', 'भाऊने मला आर्यनला विकलं. मी सुटलो, कसा तरी. पण माझ्या मागे ते आहेत.', 'Bhau sold me to Aryan. I got away, somehow. But they’re behind me.'],
            ['kabir', 'ही पेन ड्राइव्ह. आर्यनचे सगळे पासवर्ड. माझ्याकडून शेवटचं. माफ कर.', 'This pen drive. All of Aryan’s passwords. My last thing to you. Forgive me.'],
          ] : [
            ['kabir', 'तू मला तिथे सोडलंस. मग मी आर्यनकडे गेलो. काय करणार होतो?', 'You left me there. So I went to Aryan. What else could I do?'],
            ['kabir', 'तो मध्यरात्री शनिवारवाड्यावर येतोय. तुझ्यासाठी. आणि मी त्याला सांगितलं तू कुठे असशील. सॉरी, मित्रा.', 'He’s coming to Shaniwar Wada at midnight. For you. And I told him where you’d be. Sorry, friend.'],
          ], { title: 'कबीर', sub: 'Act 5 · Z Bridge' }) },
      ],
      end: () => { if (F.kabir === 'bhau') F.copied = 1; } },

    { id: 'finale', act: 5, title: 'Shaniwar Wada, Midnight', mr: 'मध्यरात्र', gap: 2, when: () => inHours(G.hour, 23, 1),
      texts: [['unk', 'मध्यरात्री. दिल्ली दरवाजा. तुझा कोड आणि तू. — आर्यन', 'Midnight. The Delhi Darwaza. Your code and you. — Aryan']],
      steps: [
        { obj: () => inHours(G.hour, 23.7, 1) ? 'The Delhi Darwaza' : 'At midnight: the Delhi Darwaza', where: () => S.swAt(2.7, -92, 'The Delhi Darwaza'), r: 25, done: (s) => s.arrived && inHours(G.hour, 23.7, 1.2) },
        { obj: 'Aryan', scene: (s) => { const p = S.swAt(2.7, -94, ''); return dialogueScene(s, p, [['aryan', 0], ['goons', 0.9]], [
          ['aryan', 'शनिवारवाडा. इथे पेशव्यांनी राज्य केलं. आणि इथेच त्यांचा नारायणराव मारला गेला. तुला इतिहास आवडतो?', 'Shaniwar Wada. The Peshwas ruled from here. And here their Narayanrao was killed. Do you like history?'],
          ['aryan', 'तुझा कोड सुंदर आहे. तू सुंदर आहेस. तुला माझ्यासोबत असायला हवं होतं. अजूनही वेळ गेलेली नाही.', 'Your code is beautiful. You are beautiful. You should have been with me. It’s not too late.'],
          ['you', 'देसाईला कोणी मारलं?', 'Who killed Desai?'],
          ['aryan', 'प्रश्न चुकीचा. प्रश्न आहे: उद्या सकाळी कोण जिवंत असेल?', 'Wrong question. The question is: who will be alive tomorrow morning?'],
        ], { title: 'मध्यरात्र', sub: 'Act 5 · Shaniwar Wada' }); } },
        { obj: 'End it', who: 'aryan', where: () => ({ ...S.swAt(2.7, -94 + 1.7, ''), name: 'Aryan' }), talk: [
          ['aryan', 'तर? माझ्यासोबत, की माझ्याविरुद्ध?', 'So? With me, or against me?'],
          { ask: [
            ['Hand him to Shinde', () => { F.end = (F.wire || F.copied) ? 'clean' : 'free'; return F.end === 'clean' ? [['shinde', 'आर्यन मल्होत्रा, देसाईच्या खुनाबद्दल आणि मनी लाँडरिंगबद्दल तुम्हाला अटक करते.', 'Aryan Malhotra, I’m arresting you for the murder of Desai and for money laundering.']] : [['aryan', 'कोणत्या पुराव्यावर? …बघ, ते पण नाहीत. गुड नाइट.', 'On what evidence? …See, they don’t even have that. Good night.']]; }],
            ['Take his network for yourself', () => { F.end = 'crown'; G.life.change('karma', -30); G.life.change('respect', 30); return [['aryan', 'हा! तू माझ्यासारखा आहेस. …थांब. तू माझी जागा घेतोयस?', 'Ha! You’re like me. …Wait. You’re taking my place?']]; }],
            ['Push him off the rampart', () => { F.end = 'blood'; G.life.change('karma', -60); return [['aryan', 'तू हे करणार नाहीस…', 'You won’t do it…']]; }],
          ] },
        ] },
      ],
      end: () => {
        const E = F.end;
        if (E === 'blood') { G.police && G.police.raiseHeat(3, 'Murder at Shaniwar Wada', 'murder'); }
        const card = { clean: ['The Clean Way', 'Aryan in handcuffs on every screen. Your name, cleared. Pune knows what you did, and what you didn’t.'],
          free: ['He Walks', 'No evidence, no case. Aryan’s car pulls away. Tomorrow the city forgets. You won’t.'],
          crown: ['The Crown', 'Zappo’s dark stores light up again. Your code, your city, your rules. Nobody calls you any more. Nobody needs to.'],
          blood: ['Narayanrao', 'Two hundred and fifty years after the last one, another man falls in Shaniwar Wada. Every siren in Pune is coming for you.'] }[E] || ['The End', ''];
        G.later(3, () => G.hud.flash(card[0], card[1]));
        // the epilogue: who's at the chai stand at dawn depends on everything you did
        G.later(12, () => {
          const who = [];
          if (F.paidAai || F.aaiDoor === 'stood') who.push('Aai, with a flask of chai'); if (F.warned || F.strike) who.push('TJ and a dozen riders');
          if (F.kabir === 'shinde') who.push('Kabir, free'); if (F.r2) who.push(fem() ? 'Veer' : 'Tara');
          G.hud.flash('Dawn, the auto stand', who.length ? `Bapu Kaka pours the chai. Around it: ${who.join(', ')}.` : 'Bapu Kaka pours two cups of chai. Nobody else comes.');
        });
      } },
  ];
}
