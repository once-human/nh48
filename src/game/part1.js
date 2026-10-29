import { shivneri } from './scenes.js';
// PUNERI, Part One: the prologue, Act 1 "Homecoming" (the monsoon) and Act 2 "Bappa" (Ganeshotsav).
// You're Sid or Saee Kale (whoever you made): back from Bangalore after Blink10, the delivery company you
// built with Kabir, fell apart. ₹10,000, a cyber-cell notice, and three weeks you can't remember.
// The two people who could matter follow who you are: for Sid, Khushi (a UX designer in Baner) and Tara (a
// girl at a club in KP); for Saee, Kunal (a UX designer in Baner) and Veer (a guy at a club in KP).
//
// Lines are [who, Marathi / Hindi / English as spoken, English]; L(who, his, hers, en) picks the form for
// how they address you (Marathi verbs follow who you are: आलास / आलीस). Steps use the story engine (story.js).
const inHours = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;

export function PART1(S) {
  const G = S.g, F = S.flags;
  const fem = () => S.fem;
  // a line whose words change with who you are (when someone talks to you, or you talk about yourself)
  const L = (who, m, f, en) => ({ fn: () => [[who, fem() ? f : m, en]] });
  const R1 = () => (fem() ? 'kunal' : 'khushi'), R2 = () => (fem() ? 'veer' : 'tara');
  const r1 = (m, f, en) => ({ fn: () => [[R1(), fem() ? f : m, en]] });
  const r2 = (m, f, en) => ({ fn: () => [[R2(), fem() ? f : m, en]] });
  const at = (...a) => () => S.at(...a);
  return [
    // ---------------------------------------------------------------- prologue
    { id: 'p_home', act: 0, title: 'Shivneri', mr: 'शिवनेरी', cine: true,
      texts: [['aai', 'बस पोचली का? बापू तुला शनिवारवाड्यापाशी भेटेल. उशीर करू नकोस.', 'Has the bus reached? Bapu will meet you at Shaniwar Wada. Don’t be late.']],
      steps: [
        { obj: 'Find Bapu Kaka at the auto stand', sub: 'By the Wada’s garden', who: 'bapu', enter: (s) => { if (!s.flags.sawShivneri && s.g.cut) { const sc = shivneri(s); if (sc) s.g.later(0.4, () => s.g.cut.play(sc)); } }, where: () => { const A = G.player.auto; return A ? { x: A.x + Math.cos(A.th || 0) * 2.6 - Math.sin(A.th || 0) * 1.8, z: A.z + Math.sin(A.th || 0) * 2.6 + Math.cos(A.th || 0) * 1.8, name: 'Bapu Kaka, by your auto' } : S.at('shaniwar', 'Bapu Kaka, the auto stand', 8, -112); }, talk: [
          L('bapu', 'आलास! पावसात, रात्री पावणेबारा वाजता. बंगलोरहून सगळे असेच येतात का?', 'आलीस! पावसात, रात्री पावणेबारा वाजता. बंगलोरहून सगळे असेच येतात का?', 'You’re here! In the rain, at a quarter to twelve. Does everyone come back from Bangalore like this?'),
          L('you', 'काका, सगळं गेलं. कंपनी, नोकरी, पैसे. दहा हजार उरलेत.', 'काका, सगळं गेलं. कंपनी, नोकरी, पैसे. दहा हजार उरलेत.', 'Kaka, it’s all gone. The company, the job, the money. Ten thousand left.'),
          ['bapu', 'माहीत आहे. पेपरमध्ये वाचलं. Blink10, दहा मिनिटांत डिलिव्हरी. आणि आता दहा मिनिटांत गायब.', 'I know. I read it in the paper. Blink10, delivery in ten minutes. And gone in ten minutes.'],
          ['bapu', 'स्टँडवरची जुनी रिक्षा घे. माझी नाही, स्टँडची. पेट्रोल तू भर. आईला काही सांगू नको.', 'Take the stand’s old auto. Not mine, the stand’s. You fill the fuel. Don’t tell Aai anything.'],
          L('you', 'काय सांगू नको?', 'काय सांगू नको?', 'Tell her what?'),
          ['bapu', 'की तुला पोलिसांचं पत्र आलंय. ती आधीच पुरेशी काळजी करते.', 'That the police have written to you. She worries enough already.'],
        ] },
        { obj: 'Ride home to Sadashiv Peth', sub: 'Your auto is on the map', where: at('Sadashiv Peth', 'Home, Sadashiv Peth'), r: 50, done: (s) => s.arrived },
        { obj: 'Talk to Aai', who: 'aai', where: at('Sadashiv Peth', 'Aai', 6, 4), talk: [
          L('aai', 'आलास. वजन कमी झालंय. बंगलोरला जेवण मिळत नाही वाटतं.', 'आलीस. वजन कमी झालंय. बंगलोरला जेवण मिळत नाही वाटतं.', 'You’re home. You’ve lost weight. I suppose they don’t feed you in Bangalore.'),
          ['aai', 'लाइटबिल, सोसायटी, गॅस. तीन महिने थकलंय. मी काही म्हणत नाहीये, फक्त सांगतेय.', 'Electricity, society dues, gas. Three months behind. I’m not saying anything, just telling you.'],
          { ask: [
            ['Give Aai ₹3,000 for the bills', () => { if (!G.shops.spend(3000)) return [['aai', 'राहू दे. आधी जेव.', 'Leave it. Eat first.']]; F.paidAai = 1; G.life.change('karma', 3); return [['aai', 'एवढे कुठून आणले? बरं, ठेवते. पण उद्यापासून कामाला लाग.', 'Where did you get this much? Fine, I’ll keep it. But from tomorrow, work.']]; }],
            ['“Next week, Aai. I promise.”', () => [['aai', 'तुझे बाबा पण असंच म्हणायचे. जेवायला बस.', 'Your father used to say that too. Sit, eat.']]],
          ] },
          ['aai', 'आणि हे पत्र आलंय. सायबर पोलीस. तुझ्या नावाने. काय केलंस?', 'And this letter came. Cyber police. In your name. What have you done?'],
          L('you', 'काही नाही, आई. चुकून आलं असेल.', 'काही नाही, आई. चुकून आलं असेल.', 'Nothing, Aai. It must be a mistake.'),
        ] },
      ],
      end: () => { G.phone.store('Cyber Cell, Pune', 'NOTICE u/s 91 CrPC: you are directed to appear before the Cyber Police Station, Shivajinagar, within 30 days, regarding Blink10 Technologies Pvt Ltd.'); G.later(2, () => G.hud.flash('Act 1: Homecoming', 'The monsoon. Pune. Nothing’s changed. Everything has.')); } },

    // ---------------------------------------------------------------- Act 1: Homecoming
    { id: 'gig', act: 1, title: 'Gig', mr: 'गिग', gap: 6, when: () => inHours(G.hour, 8, 22),
      texts: [['unk', 'Welcome to DropKart Partner! Your account is active. Go online and accept orders near you.', '']],
      steps: [
        { obj: 'Do three deliveries', drops: 3, sub: 'Accept an order when your phone pings; pick up, drop off' },
        { obj: 'A rider at Deccan is waving at you', who: 'tj', where: at('Deccan Gymkhana', 'The rider at the pickup counter'), talk: [
          ['tj', 'Oye. Ruk. Tu… Blink10 cha founder?! Tu?? DropKart var?!', 'Wait. Hold on. You… Blink10’s founder?! You?? On DropKart?!'],
          L('you', 'हळू बोल. कोणाला सांगू नकोस. प्लीज.', 'हळू बोल. कोणाला सांगू नकोस. प्लीज.', 'Keep it down. Don’t tell anyone. Please.'),
          ['tj', 'Bhai, mi pan Blink10 madhe hoto. Rider. Paise ajun ale nahit. Tujhya pan nahi ale vatta.', 'I was at Blink10 too. A rider. Never got paid. Looks like you didn’t either.'],
          ['tj', 'TJ. Tejas Pawar. Number save kar. Kahi lagla tar sang. Bhari?', 'TJ. Tejas Pawar. Save the number. Need anything, tell me. Cool?'],
        ] },
      ],
      end: () => { S.contact('TJ', 'Rider · Deccan'); S.text('tj', 'Ani ho, Aai la sang mi namaskar mhanto. 😂', 'And tell your Aai I said namaskar.'); } },

    { id: 'notice', act: 1, title: 'The Notice', mr: 'नोटीस', gap: 4, when: () => inHours(G.hour, 10, 17),
      texts: [['unk', 'Reminder: appear at Cyber Police Station, Shivajinagar. Bring ID.', '']],
      steps: [
        { obj: 'Go to the cyber police station', where: at('Shivajinagar', 'Cyber Police, Shivajinagar'), r: 50, done: (s) => s.arrived },
        { obj: 'See ACP Shinde', who: 'shinde', where: at('Shivajinagar', 'ACP Rashmi Shinde', 5, 3), talk: [
          ['shinde', 'बसा. Blink10 चे को-फाउंडर. तुम्ही बंद केलीत कंपनी, बरोबर?', 'Sit. Blink10’s co-founder. You shut the company down, right?'],
          L('you', 'बोर्डाने केली. मला बाहेर काढलं.', 'बोर्डाने केली. मला बाहेर काढलं.', 'The board did. They threw me out.'),
          ['shinde', 'मग हे बघा. तुमचे सर्व्हर अजून चालू आहेत. ऑर्डर राउट करतायत. पुण्यातून.', 'Then look at this. Your servers are still running. Routing orders. From Pune.'],
          ['shinde', 'कोणत्या ऑर्डर, ते मला माहीत नाही. पण रात्री एक ते चार सगळ्यात जास्त.', 'Which orders, I don’t know. But they peak between one and four at night.'],
          L('shinde', 'तुम्ही शहर सोडू नका. आणि काही कळलं तर मला आधी सांगा. मीडियाला नाही.', 'तुम्ही शहर सोडू नका. आणि काही कळलं तर मला आधी सांगा. मीडियाला नाही.', 'Don’t leave the city. And if you find out anything, tell me first. Not the media.'),
        ] },
      ],
      end: () => { S.contact('ACP Shinde', 'Cyber police · Shivajinagar'); } },

    { id: 'studio', act: 1, title: 'Studio Hours', mr: 'स्टुडिओ', gap: 8, when: () => inHours(G.hour, 9.5, 19),
      texts: [['tj', 'Baner la ek studio ahe, tyana ek aathavdyasathi developer pahije. Mi tujha naav dila. Udya sakali ja.', 'There’s a studio in Baner that needs a developer for a week. I gave them your name. Go tomorrow morning.']],
      steps: [
        { obj: 'Go to the studio in Baner', where: at('Baner Hill', 'The studio, Baner', 420, 160), r: 60, done: (s) => s.arrived },
        { obj: 'Meet the designer at the next desk', who: () => R1(), where: at('Baner Hill', 'Next desk', 424, 163), talk: [
          r1('हा बटन कोणी बनवला? याला बटन म्हणतात का? हा तर अपघात आहे.', 'हा बटन कोणी बनवला? याला बटन म्हणतात का? हा तर अपघात आहे.', 'Who made this button? You call this a button? It’s an accident.'),
          L('you', 'मी. आणि तुमचा फिग्मा फाइल प्रोडक्शनमध्ये चालत नाही, म्हणून.', 'मी. आणि तुमचा फिग्मा फाइल प्रोडक्शनमध्ये चालत नाही, म्हणून.', 'Me. Because your Figma file doesn’t work in production.'),
          r1('ओह. तर तूच तो नवीन डेव्ह. मी तुझा कोड शिव्या देत फिक्स करत होते.', 'ओह. तर तूच ती नवीन डेव्ह. मी तुझा कोड शिव्या देत फिक्स करत होतो.', 'Oh. So you’re the new dev. I was fixing your code and swearing at it.'),
          { ask: [
            ['“I’ll fix your bug if you fix my button.”', () => { F.r1 = (F.r1 || 0) + 2; return [{ fn: () => [[R1(), 'डील. आणि टेरेसवर चहा. तू पाजशील.', 'Deal. And chai on the terrace. Your treat.']] }]; }],
            ['“Your file was wrong, not my code.”', () => { F.r1 = (F.r1 || 0) + 1; return [{ fn: () => [[R1(), 'वा. पहिल्या दिवशीच भांडण. मला आवडलं.', 'Wow. A fight on day one. I like it.']] }]; }],
          ] },
          { fn: () => [[R1(), fem() ? 'नंबर घे. “Kunal (design, not therapy)”. अडकलीस तर मेसेज कर.' : 'नंबर घे. “Khushi (design, not therapy)”. अडकलास तर मेसेज कर.', 'Take my number. “(design, not therapy)”. Message me when you’re stuck.']] },
        ] },
      ],
      end: () => { S.contact(S.name(R1()), 'Design, not therapy · Baner'); G.later(30, () => S.text(R1(), 'तुझा बटन अजून वाईट आहे. पण चहा चांगला होता.', 'Your button is still bad. The chai was good though.')); } },

    { id: 'lastseen', act: 1, title: 'Last Seen', mr: 'शेवटचं पाहिलं', gap: 10, when: () => inHours(G.hour, 10, 20),
      texts: [['tj', 'Bhai. Kabir. Tin athavde aadhi Baner madhe UPI kela. Ek café. Studio pasun don galli. Riders sagla baghtat.', 'Bro. Kabir. Paid by UPI in Baner three weeks ago. A café two lanes from your studio. Riders see everything.']],
      steps: [
        { obj: 'Find the café in Baner', where: at('Baner Hill', 'The café', 380, 240), r: 45, done: (s) => s.arrived },
        { obj: 'Talk to the barista', who: 'barista', where: at('Baner Hill', 'The barista', 383, 242), talk: [
          ['barista', 'Order kya hai? Cold brew aaj khatam hai.', 'What’ll it be? We’re out of cold brew today.'],
          L('you', 'तीन आठवड्यांपूर्वीचं सीसीटीव्ही बघायचंय. एक माणूस. काळा थार.', 'तीन आठवड्यांपूर्वीचं सीसीटीव्ही बघायचंय. एक माणूस. काळा थार.', 'I need to see the CCTV from three weeks ago. One man. A black Thar.'),
          ['barista', 'Boss, main police nahi bula raha, yahi bahut hai.', 'Boss, I’m not calling the police; be grateful.'],
          { ask: [
            ['Slide him ₹500', () => { if (!G.shops.spend(500)) return [['barista', 'Paise bhi nahi? Wah.', 'No money either? Wow.']]; F.cctv = 1; return [['barista', 'Paanch minute. Screen dekh lo, phone mat nikalna. Mazaak kar raha hoon, nikaal lo.', 'Five minutes. Look at the screen, don’t take out your phone. Kidding, take it out.']]; }],
            ['Call your designer friend for help', () => { F.cctv = 1; F.r1 = (F.r1 || 0) + 2; return [{ fn: () => [[R1(), 'मी आले. … ओ भैया, तुमचं मेन्यू कार्ड मी फ्री मध्ये रीडिझाइन करते. स्क्रीन दाखवा.', 'I’m here. … Bhaiya, I’ll redesign your menu card for free. Show us the screen.']] }]; }],
          ] },
        ] },
        { obj: 'Photograph the CCTV screen: K for photo mode, Space to shoot', where: at('Baner Hill', 'The CCTV screen', 381, 241), photo: 25 },
      ],
      end: () => { S.text('tj', 'Photo baghitla. To Kabir ch ahe. Ani to ekta nahi.', 'Saw the photo. It’s Kabir. And he’s not alone.'); } },

    { id: 'friday', act: 1, title: 'Friday', mr: 'शुक्रवार', gap: 6, when: () => inHours(G.hour, 21.5, 2),
      texts: [['tj', 'Aaj shukravar. Ek raat visar sagla. KP, North Main Road. 11 vajta. Nahi mhanaycha nahi.', 'It’s Friday. Forget everything for one night. KP, North Main Road. 11 pm. No saying no.']],
      steps: [
        { obj: () => inHours(G.hour, 22.5, 3) ? 'Meet TJ on North Main Road' : 'After 10:30 pm: North Main Road, Koregaon Park', where: at('German Bakery', 'TJ, North Main Road', 30, 10), r: 50, done: (s) => s.arrived && inHours(G.hour, 22.5, 3.5) },
        { obj: 'At the bar: someone is arguing with the DJ', who: () => R2(), where: at('German Bakery', 'At the bar', 34, 14), talk: [
          r2('हे गाणं? शुक्रवारी रात्री? कोणीतरी डीजेला थांबवा.', 'हे गाणं? शुक्रवारी रात्री? कोणीतरी डीजेला थांबवा.', 'This song? On a Friday night? Somebody stop the DJ.'),
          L('you', 'मी पण तेच म्हणत होतो.', 'मी पण तेच म्हणत होते.', 'I was just saying the same thing.'),
          r2('शेवटी कोणीतरी शहाणं. तू इथला नाहीस वाटतं.', 'शेवटी कोणीतरी शहाणं. तू इथली नाहीस वाटतं.', 'Finally, someone sane. You’re not from here, are you?'),
          L('you', 'पुण्याचाच. मधे थोडं बंगलोर झालं.', 'पुण्याचीच. मधे थोडं बंगलोर झालं.', 'From Pune. Did a bit of Bangalore in between.'),
          r2('बंगलोर माणसं खातं. चल, बाहेर वडापाव खाऊ. इथलं संगीत माणसं खातं.', 'बंगलोर माणसं खातं. चल, बाहेर वडापाव खाऊ. इथलं संगीत माणसं खातं.', 'Bangalore eats people. Come, let’s eat vada pav outside. The music in here eats people.'),
          { ask: [
            ['Go out for vada pav', () => { F.r2 = (F.r2 || 0) + 3; return [{ fn: () => [[R2(), 'रात्री दोन वाजता वडापाव म्हणजे पुणं. नंबर दे. काहीच नाही, फक्त नंबर.', 'Vada pav at 2 am, that’s Pune. Give me your number. Nothing more, just a number.']] }]; }],
            ['Stay with TJ', () => { F.r2 = (F.r2 || 0) + 1; return [{ fn: () => [[R2(), 'बरं. तरी नंबर दे. डीजेबद्दल तक्रार करायला कोणीतरी लागेल.', 'Fine. Give me your number anyway. I’ll need someone to complain about DJs to.']] }]; }],
          ] },
        ] },
      ],
      end: () => { S.contact(S.name(R2()), 'Vada pav at 2 am · KP'); G.later(20, () => S.text(R2(), 'reached home. that DJ still owes us an apology', '')); } },

    { id: 'wari', act: 1, title: 'The Wari', mr: 'वारी', gap: 10, when: () => inHours(G.hour, 7, 18),
      texts: [['tj', 'Kala Thar dislay. Hadapsar, Palkhi chya raste. Ata. Lavkar ye.', 'The black Thar’s been spotted. Hadapsar, on the Palkhi route. Now. Hurry.']],
      steps: [
        { obj: 'Get to Hadapsar', where: at('Magarpatta City', 'Hadapsar, the Palkhi route', -500, 0), r: 120, done: (s) => s.arrived },
        { obj: 'Tail the black Thar. Don’t get too close', sub: 'Stay within sight; he’s heading out of the city', tail: { type: 'suv', paint: [0.03, 0.03, 0.035], from: at('Magarpatta City', '', -420, 30), to: at('Magarpatta City', '', 1800, 1400), speed: 11 }, endOnLose: true },
        { obj: 'An old warkari is waving something at you', who: 'warkari', where: () => S.lastTail || S.at('Magarpatta City', 'The warkari', 600, 500), talk: [
          ['warkari', 'ए बाळा! ती गाडी गेली. पण हा फोन पडला. तुझ्या मित्राचा असेल.', 'Hey, child! That car’s gone. But this phone fell out. It must be your friend’s.'],
          L('you', 'तुम्हाला कसं कळलं तो माझा मित्र आहे?', 'तुम्हाला कसं कळलं तो माझा मित्र आहे?', 'How did you know he’s my friend?'),
          ['warkari', 'चेहऱ्यावर लिहिलंय. विठ्ठलाची कृपा. जा.', 'It’s written on your face. Vitthal’s grace. Go.'],
        ] },
      ],
      end: () => { F.kabirPhone = 1; G.hud.toast('Kabir’s phone', 'Locked. The lock screen is a photo of the two of you', 'info', 3.4); } },

    { id: 'fb_funding', act: 1, title: 'Flashback: Funding Call', mr: 'आठवण', gap: 0.2,
      steps: [
        { obj: 'Remember', flash: [
          ['mem', 'बंगलोर. दोन वर्षांपूर्वी. Blink10 चं लाँच. छतावर दिवे, बाटल्या, घोषणा.', 'Bangalore. Two years ago. The Blink10 launch. Lights on the roof, bottles, speeches.'],
          ['kabir', 'दहा मिनिटं! अख्ख्या शहरात! आणि हे सगळं याच्या कोडमुळे. माझ्या पार्टनरच्या.', 'Ten minutes! Across the whole city! And all of it because of this one’s code. My partner’s.'],
          ['mem', 'मग त्याचा फोन वाजला. तो बाहेर गेला. दहा मिनिटं.', 'Then his phone rang. He went outside. Ten minutes.'],
          ['kabir', 'फंडिंग गेलं. ते मागे झाले. … पण काळजी करू नको. मी काहीतरी बघतो.', 'The funding’s gone. They pulled out. … But don’t worry. I’ll figure something out.'],
          ['mem', 'तो परत आला तेव्हा तो वेगळाच माणूस होता.', 'When he came back he was a different man.'],
        ] },
      ] },

    { id: 'deadphone', act: 1, title: 'Dead Phone', mr: 'बंद फोन', gap: 4, when: () => inHours(G.hour, 10, 22),
      texts: [{ fn: () => [[R1(), 'TJ म्हणाला तुझ्याकडे लॉक झालेला फोन आहे. स्टुडिओत ये. मी लॉक स्क्रीन डिझाइन करते, तोडतेही.', 'TJ said you have a locked phone. Come to the studio. I design lock screens. I break them too.']] }],
      steps: [
        { obj: 'Take Kabir’s phone to the studio', who: () => R1(), where: at('Baner Hill', 'The studio', 424, 163), talk: [
          r1('बघू. … पासकोड तुझी जन्मतारीख आहे. गंभीरपणे? तो अजूनही तुझा फॅन आहे.', 'बघू. … पासकोड तुझी जन्मतारीख आहे. गंभीरपणे? तो अजूनही तुझा फॅन आहे.', 'Let’s see. … The passcode is your birthday. Seriously? He’s still your fan.'),
          r1('थांब. हे ॲप… Zappo. हे स्क्रीन मी बनवले होते. फ्रीलान्स. सहा महिन्यांपूर्वी.', 'थांब. हे ॲप… Zappo. हे स्क्रीन मी बनवले होते. फ्रीलान्स. सहा महिन्यांपूर्वी.', 'Wait. This app… Zappo. I designed these screens. Freelance. Six months ago.'),
          r1('पण हा मेन्यू मी बनवला नाही. “चखना कॉम्बो”. रात्री एक ते चार. हे काय आहे?', 'पण हा मेन्यू मी बनवला नाही. “चखना कॉम्बो”. रात्री एक ते चार. हे काय आहे?', 'But I didn’t make this menu. “Chakna combo”. One to four. What is this?'),
          L('you', 'आणि याचं राउटिंग… हे माझं इंजिन आहे. माझा कोड.', 'आणि याचं राउटिंग… हे माझं इंजिन आहे. माझा कोड.', 'And its routing… that’s my engine. My code.'),
        ] },
      ],
      end: () => { F.zappo = 1; } },

    { id: 'ektechar', act: 1, title: 'Ek Te Char', mr: 'एक ते चार', gap: 8, when: () => inHours(G.hour, 13, 15.5),
      texts: [['tj', 'Zappo cha godown sapadla. Kasba Peth. Dupari ek te char, sagle zoplele astana, tyanche riders nightat.', 'Found Zappo’s godown. Kasba Peth. One to four in the afternoon, while everyone naps, their riders go out.']],
      steps: [
        { obj: () => inHours(G.hour, 13, 16) ? 'Get to the godown in Kasba Peth' : 'Between 1 and 4 pm: Kasba Peth', where: at('kasba', 'The godown, Kasba Peth', 60, 40), r: 60, done: (s) => s.arrived && inHours(G.hour, 13, 16) },
        { obj: 'Follow the Zappo rider. Don’t let him see you', sub: 'Keep him in sight, not on his tail', tail: { type: 'scooter', paint: [0.85, 0.2, 0.55], from: at('kasba', '', 70, 50), to: at('fergusson', '', 120, 60), speed: 9 }, tooClose: 6 },
        { obj: 'Someone else is filming the drop', who: 'ira', where: () => S.lastTail || S.at('fergusson', 'The girl with the camera', 125, 66), talk: [
          ['ira', 'Smile, you’re on Pune Files. Kidding. Mostly.', ''],
          ['ira', 'Ira Kulkarni. Crime YouTuber. Two lakh subscribers who think I’m brave and one mother who thinks I’m stupid.', ''],
          ['ira', 'That rider just delivered “chakna” to a girls’ hostel at 2 pm. You followed him for a reason. So did I.', ''],
          { ask: [
            ['Tell her what you know', () => { F.ira = 2; return [['ira', 'Your code? Oh, this is a much better story than I thought. Don’t worry, I’ll blur you.', '']]; }],
            ['Tell her nothing', () => { F.ira = 1; return [['ira', 'Fine. I’ll find out anyway. I always do.', '']]; }],
          ] },
        ] },
      ],
      end: () => {
        S.contact('Ira Kulkarni', 'Pune Files · YouTube');
        G.later(6, () => S.text('ira', 'Video’s up. 4 lakh views. You’re blurred. Badly. Sorry.', ''));
        G.later(12, () => S.text(R1(), 'is that you in Ira’s video??', ''));
        G.later(18, () => S.text(R2(), 'you’re famous, vada pav ' + (fem() ? 'girl' : 'guy'), ''));
        G.later(26, () => S.text('unk', 'पांढरी स्कॉर्पिओ टिळक रोडला उभी आहे. भाऊंना भेटायचंय. आता.', 'A white Scorpio is waiting on Tilak Road. Bhau wants to meet. Now.'));
        G.later(30, () => G.hud.flash('Act 1 complete: Homecoming', 'Act 2: Bappa. Ganeshotsav. Bhau Jagtap wants a word.'));
      } },

    // ---------------------------------------------------------------- Act 2: Bappa
    { id: 'bhau', act: 2, title: 'Bhau', mr: 'भाऊ', gap: 1, when: () => inHours(G.hour, 9, 23),
      texts: [['unk', 'नवी पेठ, मंडळाचा मंडप. भाऊ वाट पाहतायत.', 'Navi Peth, the mandal’s pandal. Bhau is waiting.']],
      steps: [
        { obj: 'Go to the pandal in Navi Peth', where: at('Navi Peth', 'The mandal’s pandal'), r: 50, done: (s) => s.arrived },
        { obj: 'Talk to Bhau Jagtap', who: 'bhau', where: at('Navi Peth', 'Bhau Jagtap', 4, 3), talk: [
          ['bhau', 'बसा. बाप्पाची मूर्ती अर्धी झालीय. रंग बाकी आहे. तुमच्यासारखा.', 'Sit. Bappa’s idol is half done. The paint’s left. Like you.'],
          ['bhau', 'Zappo. माझ्या पेठांमध्ये विष विकतायत. पोरांना. आणि ते इंजिन तुम्ही बनवलंत.', 'Zappo. They sell poison in my peths. To kids. And you built the engine.'],
          L('you', 'मी बनवलं, विकलं नाही. मला माहीतही नव्हतं.', 'मी बनवलं, विकलं नाही. मला माहीतही नव्हतं.', 'I built it, I didn’t sell it. I didn’t even know.'),
          ['bhau', 'मला माहीत आहे. म्हणून तुम्ही इथे बसलायत, नदीत नाही.', 'I know. That’s why you’re sitting here and not in the river.'],
          ['bhau', 'तुमच्या लोनवाल्यांचा फोन बंद झाला. मी बोललो. आता तुम्ही माझे. उत्सव संपेपर्यंत.', 'Your loan agents have stopped calling. I spoke to them. Now you’re mine. Till the festival ends.'],
        ] },
      ],
      end: () => { S.contact('Bhau Jagtap', 'Mandal president · Navi Peth'); G.life.change('respect', 3); } },

    { id: 'pratishthapana', act: 2, title: 'Pratishthapana', mr: 'प्रतिष्ठापना', gap: 6, when: () => inHours(G.hour, 8, 19),
      texts: [['bhau', 'आज बाप्पा घरी येणार. लक्ष्मी रोडहून मंडपापर्यंत. एकही धक्का नको.', 'Bappa comes home today. From Laxmi Road to the pandal. Not one bump.']],
      steps: [
        { obj: 'Pick up Bappa at Laxmi Road', where: at('Laxmi Road', 'The idol workshop, Laxmi Road'), r: 45, done: (s) => s.arrived && !G.player.onFoot },
        { obj: 'Bring Bappa to the pandal. Gently', sub: 'Under 25 km/h, no knocks', where: at('Navi Peth', 'The pandal'), r: 35, escort: { dmg: 0.08, kmh: 25 }, done: (s) => s.arrived },
      ],
      end: () => { S.text('bhau', 'गणपती बाप्पा मोरया! एकही धक्का नाही. तुम्ही कामाचे आहात.', 'Ganpati Bappa Morya! Not one bump. You’re useful.'); G.stats.money += 3000; G.saveStats(); G.audio.cash?.(); } },

    { id: 'pathak', act: 2, title: 'Pathak', mr: 'पथक', gap: 8, when: () => inHours(G.hour, 19, 23),
      texts: [['bhau', 'आज रात्री ढोल-ताशा सराव. नारायण पेठ, नदीकाठी. ढोल तुम्ही वाजवणार.', 'Dhol-tasha practice tonight. Narayan Peth, by the river. You’re on the dhol.']],
      steps: [
        { obj: () => inHours(G.hour, 19, 23.5) ? 'Get to the practice at the riverside' : 'Practice is at night: Narayan Peth riverside', where: at('Narayan Peth', 'Dhol-tasha practice'), r: 45, done: (s) => s.arrived && inHours(G.hour, 19, 23.5) },
        { obj: 'Play the dhol: Space on the beat', rhythm: { beats: 24, need: 15, bpm: 100 } },
        { obj: 'Someone from the next pathak is watching', who: () => R2(), where: at('Narayan Peth', 'The next pathak', 14, 10), talk: [
          r2('तू? ढोल? वडापाव खाणारा बंगलोरवाला?', 'तू? ढोल? वडापाव खाणारी बंगलोरवाली?', 'You? On the dhol? The vada pav Bangalore one?'),
          r2('तुला वाटलं मी फक्त क्लबमध्ये असतो? दहा वर्षं पथकात आहे.', 'तुला वाटलं मी फक्त क्लबमध्ये असते? दहा वर्षं पथकात आहे.', 'You thought I was only clubs? Ten years in a pathak.'),
          { ask: [
            ['Walk them to their scooter', () => { F.r2 = (F.r2 || 0) + 3; return [{ fn: () => [[R2(), 'हं. बरं वाटलं. पुन्हा भेटूया. खरंच.', 'Hm. That was nice. Let’s meet again. Really.']] }]; }],
            ['“See you at the next practice.”', () => { F.r2 = (F.r2 || 0) + 1; return []; }],
          ] },
        ] },
      ],
      end: () => {} },

    { id: 'darshan', act: 2, title: 'Darshan', mr: 'दर्शन', gap: 10, when: () => inHours(G.hour, 9, 20),
      texts: [{ fn: () => [['bhau', 'हरीश मल्होत्राच्या आईला दगडूशेठ दर्शनाला न्यायचंय. व्हीआयपी. तुम्ही गाडी चालवणार.', 'Harish Malhotra’s mother wants darshan at Dagdusheth. VIP. You drive.'], [R1(), 'मी एक “देणगी ॲप” बनवलंय. खरं तर ट्रॅकर. त्याच्या फोनवर टाक. चांगलं UX दिसत नाही.', 'I built a “donation app”. It’s really a tracker. Put it on his phone. Good UX is invisible.']] }],
      steps: [
        { obj: 'Pick up Mrs Malhotra in Koregaon Park', where: at('The Westin Pune', 'The Malhotra bungalow', -260, 120), r: 50, done: (s) => s.arrived && !G.player.onFoot },
        { obj: 'Drive her to Dagdusheth. Smoothly', sub: 'She hates potholes, horns and you', where: at('dagdusheth', 'Dagdusheth Ganpati'), r: 45, escort: { dmg: 0.1, kmh: 40 }, done: (s) => s.arrived },
        { obj: 'Install the “donation app” on Harish’s phone', who: 'harish', where: at('dagdusheth', 'Harish Malhotra', 6, 4), talk: [
          ['harish', 'Aap Bhau ke aadmi ho? Achha. Mummy khush hai, toh main khush.', 'You’re Bhau’s? Good. If Mummy’s happy, I’m happy.'],
          L('you', 'साहेब, मंदिराचं नवीन देणगी ॲप. एक क्लिक. पावती थेट फोनवर.', 'साहेब, मंदिराचं नवीन देणगी ॲप. एक क्लिक. पावती थेट फोनवर.', 'Sir, the temple’s new donation app. One click. The receipt comes straight to your phone.'),
          ['harish', 'Wah, digital Bappa. Daal do.', 'Wow, digital Bappa. Put it on.'],
        ] },
      ],
      end: () => { F.tracker = 1; G.later(8, () => S.text(R1(), 'ट्रॅकर चालू. तो आत्ता… कोरेगाव पार्कमधल्या एका क्लबमध्ये. Vault.', 'Tracker’s live. He’s… at a club in Koregaon Park right now. Vault.')); } },

    { id: 'darkstore', act: 2, title: 'Dark Store', mr: 'डार्क स्टोअर', gap: 10, when: () => inHours(G.hour, 13, 15.5),
      texts: [['tj', 'Kasba Peth cha dark store. Dupari ek te char, tithe phakt don packer ani ek watchman. Pathak cha tempo ghe.', 'The Kasba Peth dark store. One to four, just two packers and a watchman inside. Take the pathak’s tempo.']],
      steps: [
        { obj: () => inHours(G.hour, 13, 16) ? 'Get to the dark store in Kasba Peth' : 'Between 1 and 4 pm: the dark store, Kasba Peth', where: at('kasba', 'The dark store', -50, 60), r: 40, done: (s) => s.arrived && inHours(G.hour, 13, 16) },
        { obj: 'Get to the cold room unseen', sub: 'On foot. Stay out of their line of sight', sneak: { guards: 3, goal: at('kasba', 'The cold room', -42, 72) } },
      ],
      end: () => { F.sims = 1; G.hud.toast('Found', 'A box of SIM cards in riders’ names. And a roster in Kabir’s handwriting', 'info', 4); } },

    { id: 'fb_signature', act: 2, title: 'Flashback: The Signature', mr: 'सही', gap: 0.2,
      steps: [
        { obj: 'Remember', flash: [
          ['mem', 'तीच रात्र. जी आठवत नाही. एका वकिलाचं ऑफिस. रात्रीचा एक.', 'That night. The one you can’t remember. A lawyer’s office. 1 am.'],
          ['kabir', 'फक्त एक सही. कंपनी वाचेल. माझ्यावर विश्वास आहे ना?', 'Just one signature. It saves the company. You trust me, right?'],
          ['mem', 'तुम्ही वाचलं नाही. कधीच वाचलं नाही. कारण कबीरने सांगितलं होतं.', 'You didn’t read it. You never read it. Because Kabir asked.'],
          ['mem', 'खाली, बारीक अक्षरात: “सर्व सोर्स कोड आणि की हस्तांतरित”.', 'At the bottom, in small print: “all source code and keys transferred”.'],
        ] },
      ] },

    { id: 'partner', act: 2, title: 'Partner', mr: 'पार्टनर', gap: 4, when: () => inHours(G.hour, 23, 2),
      texts: [['unk', 'झेड ब्रिज. बारा वाजता. एकटा ये. — क', 'Z Bridge. Midnight. Come alone. — K']],
      steps: [
        { obj: () => inHours(G.hour, 23.5, 2) ? 'Meet Kabir on the Z Bridge' : 'At midnight: the Z Bridge', where: at('Z Bridge', 'Kabir, the Z Bridge'), r: 35, done: (s) => s.arrived && inHours(G.hour, 23.5, 2.5) },
        { obj: 'Talk to Kabir', who: 'kabir', where: at('Z Bridge', 'Kabir', 3, 2), talk: [
          L('kabir', 'आलास. पावसात. नेहमीसारखा उशिरा.', 'आलीस. पावसात. नेहमीसारखी उशिरा.', 'You came. In the rain. Late, as always.'),
          L('you', 'माझा कोड, कबीर. माझा कोड ड्रग्ज पोचवतोय.', 'माझा कोड, कबीर. माझा कोड ड्रग्ज पोचवतोय.', 'My code, Kabir. My code is delivering drugs.'),
          ['kabir', 'मी चोरी नाही केली. मी आपल्याला वाचवलं. कोड चालणारच होता. कोणाच्या तरी हातात.', 'I didn’t steal from you. I saved us. The code was going to run anyway. In someone’s hands.'],
          ['kabir', 'आर्यन मल्होत्रा. त्याच्यापासून लांब राहा. मी जे करतोय ते तुझ्यासाठी.', 'Aryan Malhotra. Stay away from him. What I’m doing, I’m doing for you.'],
          { ask: [
            ['Take his number', () => { F.kabirNum = 1; return [['kabir', 'फक्त गरज असेल तेव्हा. आणि हा नंबर कोणालाही देऊ नको. कोणालाही.', 'Only when you have to. And don’t give this number to anyone. Anyone.']]; }],
            ['Hit him', () => { F.hitKabir = 1; G.life.change('karma', -2); return [['kabir', '…ठीक आहे. हे मी कमावलं. पण माझं ऐक: कोणावर विश्वास ठेवू नको.', '…Fine. I earned that. But listen: don’t trust anyone.']]; }],
          ] },
        ] },
      ],
      end: () => { if (F.kabirNum) S.contact('Kabir', 'Don’t call'); } },

    { id: 'hinjewadi', act: 2, title: 'Hinjewadi', mr: 'हिंजवडी', gap: 8, when: () => inHours(G.hour, 9, 20),
      texts: [['tj', 'Majha mitra Sunny. Zappo rider, Hinjewadi. Don divas phone band. Mule account baddal vicharat hota.', 'My friend Sunny. A Zappo rider in Hinjewadi. Phone off for two days. He was asking about the mule accounts.']],
      steps: [
        { obj: 'Get to Hinjewadi', sub: 'Phase 1. The traffic is legendary', where: at('Rajiv Gandhi Infotech Park', 'Hinjewadi Phase 1'), r: 150, done: (s) => s.arrived },
        { obj: 'Find Sunny’s room behind Phase 2', sub: 'Faster on foot than in this traffic', where: at('Rajiv Gandhi Infotech Park', 'Sunny’s room', -900, -500), r: 30, done: (s) => s.arrived },
        { obj: 'Talk to Sunny', who: 'sunny', where: at('Rajiv Gandhi Infotech Park', 'Sunny', -897, -497), talk: [
          ['sunny', 'TJ ne pathavla? … Bas kar, hasu nako. Chehra asa ch zala.', 'TJ sent you? … Don’t laugh. My face is just like this now.'],
          ['sunny', 'Maza naav var bank account ahe. Mi kadhi ughadla nahi. Lakho rupaye roj yetat ani jatat.', 'There’s a bank account in my name. I never opened it. Lakhs come in and go out every day.'],
          ['sunny', 'Vicharla tar mala marla. Aryan bhai che lok. Tumhi pan javu naka tithe.', 'I asked, so they beat me. Aryan bhai’s men. Don’t you go there either.'],
        ] },
      ],
      end: () => { S.text('tj', 'Thank you. Sunny gavi gela. Ata he personal ahe.', 'Thank you. Sunny’s gone back to his village. Now it’s personal.'); } },

    { id: 'surname', act: 2, title: 'The Surname', mr: 'आडनाव', gap: 10, when: () => inHours(G.hour, 18, 23),
      texts: [{ fn: () => [[R2(), 'आज घरी छोटा कार्यक्रम आहे. ये ना. कोरेगाव पार्क. मी पत्ता पाठवते.', 'There’s a small do at home today. Come. Koregaon Park. I’ll send the address.']] }],
      steps: [
        { obj: 'Go to the house in Koregaon Park', where: at('The Westin Pune', 'The house', -260, 120), r: 45, done: (s) => s.arrived },
        { obj: 'Find them on the balcony', who: () => R2(), where: at('The Westin Pune', 'The balcony', -256, 124), talk: [
          r2('आलास! हे माझे काका, हरीश. आणि हा माझा कझिन, आर्यन.', 'आलीस! हे माझे काका, हरीश. आणि हा माझा कझिन, आर्यन.', 'You came! That’s my uncle, Harish. And that’s my cousin, Aryan.'),
          ['mem', 'आर्यन मल्होत्रा. हसतो. हात पुढे करतो. तुझा कोड त्याच्या खिशात आहे.', 'Aryan Malhotra. He smiles. He holds out his hand. Your code is in his pocket.'],
          L('you', 'तुला माहीत होतं?', 'तुला माहीत होतं?', 'Did you know?'),
          r2('काय? … तू Zappo बद्दल बोलतोयस? आर्यनचा बिझनेस? मला काहीच माहीत नाही.', 'काय? … तू Zappo बद्दल बोलतेयस? आर्यनचा बिझनेस? मला काहीच माहीत नाही.', 'What? … You’re talking about Zappo? Aryan’s business? I don’t know anything.'),
          { ask: [
            ['Tell them everything', () => { F.r2 = (F.r2 || 0) + 2; F.toldR2 = 1; return [{ fn: () => [[R2(), 'मला वेळ दे. मी शोधून काढेन. माझ्या घरातलं आहे हे.', 'Give me time. I’ll find out. This is my family.']] }]; }],
            ['Say nothing and leave', () => { F.r2 = (F.r2 || 0) - 1; return [{ fn: () => [[R2(), 'तू खोटं बोलतोयस. मला दिसतंय.', 'You’re lying. I can see it.']] }]; }],
          ] },
        ] },
      ],
      end: () => {} },

    { id: 'visarjan', act: 2, title: 'Visarjan', mr: 'विसर्जन', gap: 12, when: () => inHours(G.hour, 16, 23.5),
      texts: [['bhau', 'अनंत चतुर्दशी. आर्यनच्या माणसांनी आमचा ट्रक पळवला. आत बाप्पा आहे. आणि त्यांचा माल. पकडा!', 'Anant Chaturdashi. Aryan’s men have taken our truck. Bappa is inside. And their stock. Catch it!']],
      steps: [
        { obj: 'Catch the hijacked idol truck', sub: 'Get right alongside it', chase: { type: 'tempo', paint: [0.85, 0.55, 0.12], from: at('Laxmi Road', '', 200, 80), to: at('Magarpatta City', '', -400, 0), speed: 12 } },
        { obj: 'Bring Bappa to the ghat in time', sub: 'Gently. A million people are watching', where: at('omkareshwar', 'The ghat'), r: 40, escort: { dmg: 0.12, kmh: 35 }, done: (s) => s.arrived },
      ],
      end: () => {
        G.stats.money += 8000; G.saveStats(); G.audio.cash?.(); G.life.change('respect', 8);
        S.text('bhau', 'गणपती बाप्पा मोरया, पुढच्या वर्षी लवकर या! तुम्ही आज आमचं नाक वाचवलं.', 'Ganpati Bappa Morya, come back soon next year! You saved our honour today.');
        G.later(10, () => S.text('aai', 'तुझ्या बॅगेत हे सिमकार्ड काय आहेत? लोकांच्या नावाचे? मला बोलू नकोस.', 'What are these SIM cards in your bag? In other people’s names? Don’t talk to me.'));
        G.later(18, () => S.text(R1(), fem() ? 'सरळ विचारतो. तू माझ्याशी खोटं बोलतेयस का?' : 'सरळ विचारते. तू माझ्याशी खोटं बोलतोयस का?', 'Straight question. Are you lying to me?'));
        G.later(26, () => S.text(R2(), 'मी आर्यन काय करतोय ते शोधते. काही दिवस फोन करू नको.', 'I’ll find out what Aryan’s doing. Don’t call me for a while.'));
        G.later(32, () => G.hud.flash('Act 2 complete: Bappa', 'Act 3, Nine Nights, begins with Navratri'));
      } },
  ];
}
