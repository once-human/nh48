// Talk to anyone: T at them (F stays for doors, counters and animals; nothing shows over anyone's head). Who they are
// decides what you can say. On the street the way, food and where you are are always there; the rest is theirs: an
// aaji gets asked how old Pune was, a college guy about his exams, a KP girl about tonight, a delivery bhaiya about
// his day, a dada about who runs the area, a havaldar about trouble. Everyone gets a few of their own, not the same
// list. Inside, the people behind the counter talk shop (ordering is F at the counter); the people shopping, sitting,
// drinking or dancing are customers like you and talk like it. Asking someone out is here too; a date is game/date.js.
// How they take it is theirs: their way with strangers (ask.js), your karma and charm, the police, what they remember.
import { People } from '@orig/people/peds.js';
import { KbNav } from '@orig/ui/kbnav.js';
import { CAST } from '@orig/people/cast.js';
import { who } from './ask.js';

const one = (rng, a) => a[Math.floor(rng.next()*a.length)];
const WHO = { kaka: 'Kaka', ajoba: 'Ajoba', dada: 'Dada', kaku: 'Kaku', aaji: 'Aaji', tai: 'Tai', bhaiya: 'Bhaiya', collegeboy: 'A college guy', collegegirl: 'A college girl', aunty: 'Aunty', kpguy: 'A KP guy', kpgirl: 'A KP girl' };
const ROLE = { keeper: 'The shopkeeper', bartender: 'The bartender', barber: 'The barber', teller: 'At the counter', helper: 'Works here', aai: 'Aai' };
const OLD = new Set(['kaka', 'ajoba', 'kaku', 'aaji', 'aunty']);
const MOOD = { curt: 'short with you', normal: 'polite', eager: 'chatty', kind: 'warm' };
const WARM = { curt: 0, normal: 1, eager: 2, kind: 3 };
const group = (p) => p.cop ? 'cop' : OLD.has(p.persona) ? 'old' : /^college/.test(p.persona || '') ? 'college' : /^kp/.test(p.persona || '') ? 'kp' : p.persona === 'bhaiya' ? 'bhaiya' : p.persona === 'dada' ? 'dada' : p.persona === 'tai' ? 'tai' : 'any';

// what each kind of person on the street can be asked (a few of these each, picked once per person)
const STREET = {
  old: ['then', 'health', 'family', 'chaha', 'help', 'weather', 'compliment', 'jab'],
  college: ['college', 'exams', 'hangout', 'tonight', 'match', 'compliment', 'money', 'jab'],
  kp: ['tonight', 'cafe', 'work', 'outfit', 'hangout', 'weather', 'jab'],
  bhaiya: ['busy', 'from', 'cheapfood', 'weather', 'money', 'jab'],
  dada: ['boss', 'work', 'respect', 'match', 'jab'],
  tai: ['market', 'prices', 'family', 'weather', 'compliment', 'jab'],
  cop: ['trouble', 'respect', 'jab'],
  any: ['area', 'weather', 'compliment', 'money', 'jab'],
};
const LABEL = {
  then: 'What was this place like before?', health: 'How\'s your health?', family: 'How\'s the family?', chaha: 'Where\'s good chai around here?', help: 'Need a hand with that?',
  college: 'Which college are you in?', exams: 'Exams going on?', hangout: 'Where do people hang out around here?', tonight: 'Anything happening tonight?', match: 'Did you watch the match?',
  cafe: 'Know a good café near here?', work: 'What do you do?', outfit: 'Nice outfit', busy: 'Busy day?', from: 'Where are you from?', cheapfood: 'Where can I eat cheap?',
  boss: 'Who runs this area?', respect: 'Just saying namaskar', market: 'Where\'s the market?', prices: 'Everything\'s so expensive, no?', trouble: 'Any trouble around here?',
  area: 'What\'s this area like?', weather: 'Talk about the weather', compliment: 'Pay them a compliment', money: 'Ask for ₹20 for a chai', jab: 'Make a Puneri jab',
  // inside, the staff
  biz: 'How\'s business?', sells: 'What sells the most?', since: 'How long have you had this place?', good: 'What\'s good here?', discount: 'Any discount?',
  wait: 'How long\'s the wait?', cut: 'What cut would suit me?', gossip: 'Any news around here?', recommend: 'What would you recommend?', night: 'Busy night?',
  server: 'Is the server down again?', account: 'Which counter for an account?', where2: 'Where\'s this kept?', quiet: 'Everything quiet today?',
  // inside, the customers
  anygood: 'Is this place any good?', found: 'Found what you wanted?', often: 'Do you come here often?', cheaper: 'Know somewhere cheaper?',
  seat: 'Is this seat free?', ordered: 'What did you order? Any good?', day: 'How\'s your day going?',
  drinking: 'What are you drinking?', buy: 'Buy you a drink (₹250)', fun: 'Having fun?', dance: 'Dance with me?',
  train: 'How long have you been training?', spot: 'Spot me?', diet: 'Any diet tips?', waitlong: 'Been waiting long?',
};

// [cold, fine, warm]: each a few [said, English] (Marathi from Puneri folk, Hindi from a bhaiya, English-ish in KP)
const L = (c, f, w) => [c, f, w];
const LINES = {
  then: L([['काय सांगायचं? सगळं बदललं.', 'What\'s there to say? It\'s all changed.']], [['पूर्वी इथे शांत होतं. आता नुसती गर्दी.', 'It used to be quiet here. Now it\'s just crowds.']], [['आमच्या लहानपणी इथे वाडे होते, अंगण होतं, सायकलीच सायकली. आता इमारती आणि ट्रॅफिक.', 'When we were young there were wadas here, courtyards, bicycles everywhere. Now buildings and traffic.']]),
  health: L([['बरी आहे. तुम्हाला काय?', 'It\'s fine. Why do you care?']], [['चालू आहे, देवाच्या कृपेने.', 'Getting along, by God\'s grace.']], [['गुडघे दुखतात, पण रोज सकाळी फिरायला जातो. तुम्हीही जात जा!', 'The knees hurt, but I walk every morning. You should too!']]),
  family: L([['सगळे बरे आहेत.', 'Everyone\'s fine.']], [['मुलगा बंगळूरला असतो. येतो कधीतरी.', 'My son lives in Bengaluru. Visits sometimes.']], [['नातू आता शाळेत जातो! फार हुशार आहे, अगदी माझ्यावर गेलाय.', 'My grandson goes to school now! Very clever, takes after me.']]),
  chaha: L([['शोधा की.', 'Go find it.']], [['पुढच्या चौकात टपरी आहे.', 'There\'s a tapri at the next chowk.']], [['पुढच्या चौकातल्या टपरीवर जा. माझं नाव सांगा, कटिंग नीट देईल!', 'Go to the tapri at the next chowk. Say my name, he\'ll give you a proper cutting!']]),
  help: L([['नको. मी करतो.', 'No. I\'ll do it.']], [['नाही, होईल माझं. धन्यवाद.', 'No, I can manage. Thanks.']], [['अरे, गुणी मुलगा! नाही रे, जमेल मला. सुखी राहा.', 'Oh, good child! No, I can manage. Bless you.']]),
  college: L([['का? तुम्हाला काय करायचंय?', 'Why? What\'s it to you?']], [['इंजिनिअरिंग, दुसरं वर्ष.', 'Engineering, second year.']], [['कॉमर्स, शेवटचं वर्ष! कॉलेजपेक्षा कट्ट्यावरच जास्त असतो.', 'Commerce, final year! I\'m at the katta more than in class.']]),
  exams: L([['आठवण नका करून देऊ.', 'Don\'t remind me.']], [['हो, पुढच्या आठवड्यात. काहीच वाचलं नाही.', 'Yes, next week. Haven\'t studied a thing.']], [['हो! रात्रभर जागतोय, चहा आणि मॅगीवर. पास झालो तर पार्टी!', 'Yes! Up all night on chai and Maggi. If I pass, party!']]),
  hangout: L([['घरी.', 'At home.']], [['कट्ट्यावर, नाहीतर कुठल्यातरी कॅफेत.', 'At the katta, or some café.']], [['संध्याकाळी चौकात सगळे जमतात. या कधी!', 'Everyone gathers at the chowk in the evening. Come sometime!']]),
  tonight: L([['No idea, bro.', '']], [['Weekend pe toh kuch na kuch hota hai. Check the clubs.', 'There\'s always something on a weekend. Check the clubs.']], [['There\'s a DJ night somewhere for sure. Go late, it only picks up after eleven!', '']]),
  match: L([['नाही.', 'No.']], [['हो, शेवटची ओव्हर बघितली. काय झालं ते!', 'Yes, saw the last over. What a finish!']], [['बघितली ना! अख्खा कट्टा ओरडत होता. पुढची एकत्र बघूया!', 'Of course! The whole katta was shouting. Let\'s watch the next one together!']]),
  cafe: L([['Google it.', '']], [['There are a few down the lane. All decent.', '']], [['Oh, there\'s a tiny one round the corner, amazing cold coffee. Go before it gets crowded!', '']]),
  work: L([['काम करतो. बस.', 'I work. That\'s all.']], [['IT मध्ये. रोज Hinjewadi चं ट्रॅफिक.', 'In IT. Hinjewadi traffic every day.']], [['Startup, bro. Hours are crazy but it\'s fun. You?', '']]),
  outfit: L([['Okay...?', '']], [['Thanks!', '']], [['Aww, thank you! Got it on FC Road, total steal.', '']]),
  busy: L([['बहुत. हटो.', 'Very. Move.']], [['हाँ भाई, सुबह से दौड़ रहा हूँ.', 'Yes brother, running since morning.']], [['हाँ भाई, आज तीस डिलीवरी! पर चलता है, घर पैसे भेजने हैं.', 'Yes brother, thirty deliveries today! But it\'s fine, got to send money home.']]),
  from: L([['क्या करोगे जानके?', 'What\'ll you do knowing?']], [['बिहार से. पाँच साल हो गए पुणे में.', 'From Bihar. Five years in Pune now.']], [['यूपी से, भाई. पुणे अच्छा लगता है, थोड़ी मराठी भी सीख ली है. "काय चाललंय?"', 'From UP, brother. I like Pune, picked up a little Marathi too. "What\'s up?"']]),
  cheapfood: L([['पता नहीं.', 'No idea.']], [['आगे ठेला है, वडापाव पंद्रह का.', 'There\'s a cart ahead, vada pav for fifteen.']], [['आगे वाले ठेले पे जाओ, भाई. वडापाव और चाय, पचास में पेट भर जाएगा!', 'Go to the cart ahead, brother. Vada pav and chai, you\'ll be full for fifty!']]),
  boss: L([['तुला काय करायचंय? निघ.', 'What\'s it to you? Get lost.']], [['इथे सगळे आपले आहेत. उगाच भानगड नको.', 'Everyone here is ours. No pointless trouble.']], [['इथे आपणच. काही अडचण आली तर नाव सांग, कोणी हात लावणार नाही.', 'Here, it\'s me. Any trouble, say my name, nobody\'ll touch you.']]),
  respect: L([['हं.', 'Hm.']], [['नमस्कार.', 'Namaskar.']], [['नमस्कार! बरं वाटलं. सांभाळून राहा.', 'Namaskar! Nice of you. Take care.']]),
  market: L([['तिकडे.', 'That way.']], [['पुढे डावीकडे, मंडईकडे.', 'Ahead on the left, toward the mandai.']], [['पुढे डावीकडे. भाजी सकाळीच घ्या, संध्याकाळी सगळं शिळं.', 'Ahead on the left. Buy vegetables in the morning, by evening it\'s all stale.']]),
  prices: L([['हो.', 'Yes.']], [['काय विचारता! कांदा परत महाग झाला.', 'Don\'t ask! Onions are dear again.']], [['अहो, कोथिंबिरीची जुडी पण वीस रुपये! कसं भागवायचं घर?', 'Even a bunch of coriander is twenty rupees! How does one run a house?']]),
  trouble: L([['तुम्ही करू नका म्हणजे झालं.', 'Just don\'t you start any.']], [['नाही, सगळं शांत आहे.', 'No, it\'s all quiet.']], [['सध्या शांत. रात्री उशिरा बाहेर फिरू नका, आणि काही दिसलं तर चौकीवर कळवा.', 'Quiet for now. Don\'t roam late, and if you see anything, tell the chowki.']]),
  area: L([['ठीक आहे. जाऊ दे.', 'It\'s fine. Leave it.']], [['मस्त आहे, पण पार्किंग कधीच मिळत नाही.', 'It\'s nice, but you\'ll never find parking.']], [['भारी आहे! रात्री उशिरापर्यंत जाग असते, खायला काही ना काही मिळतं.', 'It\'s great! Stays awake late, you always find something to eat.']]),
  compliment: L([['हं. काय हवंय?', 'Hm. What do you want?']], [['धन्यवाद.', 'Thank you.']], [['अरे वा! धन्यवाद, तुमचाही दिवस छान जावो.', 'Oh wow! Thank you, have a nice day yourself.']]),
  money: L([['काम करा जरा!', 'Go do some work!']], [['सुट्टे नाहीत.', 'No change on me.']], [['घ्या, चहा प्या.', 'Here, have a chai.']]),
  jab: L([['काय म्हणालात? परत बोलून दाखवा!', 'What did you say? Say that again!']], [['तोंड सांभाळून बोला.', 'Mind your mouth.']], [['हाहा, पुणेरी आहात खरे!', 'Haha, you really are Puneri!']]),
  // staff
  biz: L([['चालू आहे.', 'It\'s going.']], [['ठीक आहे. ऑनलाईनमुळे थोडं कमी झालं.', 'Okay. A bit less since online shopping.']], [['देवाच्या कृपेने छान! सणासुदीला तर उभं राहायला जागा नसते.', 'Good, by God\'s grace! At festival time there\'s no room to stand.']]),
  sells: L([['सगळंच.', 'Everything.']], [['रोजचं सामान जास्त जातं.', 'The everyday stuff goes most.']], [['हे बघा, हे सगळ्यात जास्त जातं. घेऊन बघा, परत याल.', 'Look, this sells the most. Try it, you\'ll be back.']]),
  since: L([['खूप वर्षं.', 'Many years.']], [['वडिलांनी सुरू केलं, आता मी बघतो.', 'My father started it, now I run it.']], [['आजोबांनी सुरू केलं! तीन पिढ्या. भिंतीवरचा फोटो बघा.', 'My grandfather started it! Three generations. Look at the photo on the wall.']]),
  good: L([['मेनू बघा.', 'Look at the menu.']], [['सगळं ताजं आहे.', 'Everything\'s fresh.']], [['हे बघा, आजच आलंय. तुमच्यासाठी खास.', 'Look, this came in today. Just for you.']]),
  discount: L([['फिक्स रेट. पाटी वाचा.', 'Fixed price. Read the board.']], [['नाही हो, परवडत नाही.', 'No, I can\'t afford to.']], [['बरं, तुमच्यासाठी थोडं कमी करतो. पुढच्या वेळी पण या.', 'Fine, I\'ll take a little off for you. Come again.']]),
  wait: L([['बसा. नंबर येईल.', 'Sit. Your turn will come.']], [['दोघं आहेत, वीस मिनिटं.', 'Two ahead, twenty minutes.']], [['बसा, चहा घ्या, दहा मिनिटांत तुमचा नंबर.', 'Sit, have chai, your turn in ten minutes.']]),
  cut: L([['जे सांगाल ते.', 'Whatever you say.']], [['बाजूने बारीक, वर थोडे ठेवू.', 'Short on the sides, a bit on top.']], [['तुमच्या चेहऱ्याला साइड फेड छान दिसेल. विश्वास ठेवा!', 'A side fade will suit your face. Trust me!']]),
  gossip: L([['मला काय माहित.', 'What do I know.']], [['पलीकडच्या गल्लीत नवीन कॅफे उघडलंय.', 'A new café opened in the next lane.']], [['ऐका, पलीकडच्या गल्लीत काल मोठी भांडणं झाली... पण तुम्ही माझ्याकडून नाही ऐकलं!', 'Listen, there was a big fight in the next lane yesterday... but you didn\'t hear it from me!']]),
  recommend: L([['What do you want?', '']], [['The house special\'s popular.', '']], [['Try the house special, trust me. You won\'t regret it!', '']]),
  night: L([['Yeah.', '']], [['Weekend, so yeah.', '']], [['Crazy! Wait till midnight, this place goes off.', '']]),
  server: L([['हो. उद्या या.', 'Yes. Come tomorrow.']], [['हो, थोडा वेळ लागेल. बसा.', 'Yes, it\'ll take a while. Sit.']], [['हाहा, नेहमीचंच! दहा मिनिटं, मग तुमचं काम करतो.', 'Haha, as always! Ten minutes, then I\'ll do yours.']]),
  account: L([['तिकडे रांगेत उभे राहा.', 'Stand in that line.']], [['तीन नंबरची खिडकी. फॉर्म भरून आणा.', 'Window three. Bring the form filled.']], [['तीन नंबर. आधार आणि फोटो आणला ना? नाहीतर परत यावं लागेल.', 'Number three. Brought your Aadhaar and a photo? Otherwise you\'ll have to come back.']]),
  where2: L([['विचारा काउंटरला.', 'Ask at the counter.']], [['मागच्या रॅकवर.', 'On the back rack.']], [['चला, दाखवतो. मागच्या रॅकवर, डावीकडे.', 'Come, I\'ll show you. Back rack, on the left.']]),
  quiet: L([['काय काम आहे?', 'What do you want?']], [['हो, शांत आहे.', 'Yes, it\'s quiet.']], [['शांत आहे. पण तुम्ही इकडे का आलात? सगळं ठीक ना?', 'It\'s quiet. But why\'re you here? All okay?']]),
  // customers
  anygood: L([['मला काय माहित, मी पण पहिल्यांदा आलोय.', 'How would I know, I\'m new here too.']], [['ठीक आहे. रेट थोडे जास्त आहेत.', 'It\'s okay. Prices are a bit high.']], [['मी नेहमी इथेच येतो! क्वालिटी चांगली आहे.', 'I always come here! Good quality.']]),
  found: L([['अजून नाही.', 'Not yet.']], [['बघतोय. तुम्ही?', 'Still looking. You?']], [['हो! हे बघा, कसं आहे? ठीक वाटतंय ना?', 'Yes! Look at this, how is it? Looks okay, right?']]),
  often: L([['नाही.', 'No.']], [['कधीकधी.', 'Sometimes.']], [['आठवड्यातून एकदा तरी! तुम्ही नवीन दिसता.', 'At least once a week! You look new.']]),
  cheaper: L([['शोधा.', 'Go look.']], [['मंडईत स्वस्त मिळेल, पण घासाघीस करावी लागते.', 'It\'s cheaper at the mandai, but you have to bargain.']], [['अहो, लक्ष्मी रोडला जा, तिथे स्वस्तात मिळेल!', 'Go to Laxmi Road, you\'ll get it cheaper there!']]),
  seat: L([['नाही, कोणीतरी येणार आहे.', 'No, someone\'s coming.']], [['बसा ना.', 'Go ahead, sit.']], [['बसा, बसा! एकटेच?', 'Sit, sit! On your own?']]),
  ordered: L([['माझं मी खातोय.', 'I\'m eating mine.']], [['मिसळ. ठीक आहे.', 'Misal. It\'s fine.']], [['मिसळ! इथली तर्री भारी आहे, तुम्हीपण घ्या.', 'Misal! The tarri here is great, you should get it too.']]),
  day: L([['हं.', 'Hm.']], [['हो, बरं चाललंय. तुमचं?', 'Yes, going well. You?']], [['आज दिवसभर काम होतं, आता जरा निवांत. तुम्ही?', 'Work all day, now a little time off. You?']]),
  drinking: L([['Mine.', '']], [['Just a beer.', '']], [['Old Monk and Coke, the classic. You?', '']]),
  buy: L([['No thanks, I\'m good.', '']], [['Oh, okay. Thanks!', '']], [['Aww, sure! Cheers to that!', '']]),
  fun: L([['Was.', '']], [['Yeah, it\'s alright.', '']], [['So much! This song!', '']]),
  dance: L([['I\'m good, thanks.', '']], [['Maybe in a bit.', '']], [['Come on then!', '']]),
  train: L([['वर्षभर. का?', 'A year. Why?']], [['दोन वर्षं झाली.', 'Two years now.']], [['पाच वर्षं! आधी मी पण तुमच्यासारखा होतो. रोज या, फरक दिसेल.', 'Five years! I used to be like you. Come every day, you\'ll see the difference.']]),
  spot: L([['नंतर.', 'Later.']], [['चला, धरतो.', 'Come on, I\'ll hold it.']], [['चला! अजून एक, अजून एक... झालं! शाब्बास!', 'Come on! One more, one more... done! Well done!']]),
  diet: L([['खाणं कमी करा.', 'Eat less.']], [['प्रोटीन जास्त, साखर कमी.', 'More protein, less sugar.']], [['अंडी, डाळ, पनीर. आणि वडापाव बंद! हे सगळ्यात कठीण.', 'Eggs, dal, paneer. And no vada pav! That\'s the hardest part.']]),
  waitlong: L([['हो.', 'Yes.']], [['तासभर झाला.', 'An hour now.']], [['दोन तास! डॉक्टर अजून आलेच नाहीत. तुम्ही पण बसा, वेळ लागेल.', 'Two hours! The doctor hasn\'t even come yet. Sit, it\'ll be a while.']]),
};
const ASKOUT = { no: [['काय? नाही!', 'What? No!'], ['नको, धन्यवाद.', 'No, thank you.'], ['आज नाही. पुन्हा कधीतरी.', 'Not today. Some other time.']], yes: [['बरं... हा माझा नंबर.', 'Okay... here\'s my number.'], ['चालेल! नंबर घ्या.', 'Sure! Take my number.']] };
const WEATHER = {
  rain: [['हं.', 'Hm.'], ['पाऊस थांबतच नाही.', 'The rain just won\'t stop.'], ['पावसात भजी आणि चहा, बस!', 'Rain, bhaji and chai, that\'s all you need!']],
  hot: [['हं, ऊन आहे.', 'Hm, it\'s hot.'], ['ऊन किती आहे! दुपारी बाहेर पडू नका.', 'So hot! Don\'t go out in the afternoon.'], ['या उन्हात कोकम सरबत प्या, बरं वाटेल.', 'Have kokum sarbat in this heat, you\'ll feel better.']],
  night: [['रात्र झाली, घरी जा.', 'It\'s night, go home.'], ['उशीर झाला. जपून जा.', 'It\'s late. Go carefully.'], ['रात्रीचं पुणे वेगळंच असतं, नाही?', 'Pune at night is something else, isn\'t it?']],
  fine: [['हं.', 'Hm.'], ['आज हवा छान आहे.', 'Nice weather today.'], ['अशी हवा असली की फिरायला मजा येते.', 'Weather like this, it\'s fun to just roam.']],
};

// a few topics each, picked once per person, so no two people give you the same list
function pickTopics(rng, pool, n) { const a = pool.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.next()*(i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }

class Talk {
  constructor(G) {
    this.g = G; this.cur = null;
    const el = document.createElement('div');
    el.className = 'shop glass talk'; el.hidden = true;
    el.innerHTML = `<div class="sh-head"><div class="sh-k tk-k">Talking</div><div class="sh-t tk-name"></div><div class="tk-meta"><span class="tk-job"></span></div>
      <div class="tk-bubble"><b class="tk-line"></b><span class="tk-tr"></span><span class="tk-how"></span></div></div><div class="sh-list tk-opts"></div><div class="sh-msg"></div>
      <div class="sh-foot"><span></span><span><span class="kbd">1–9</span> or <span class="kbd">↑↓</span> <span class="kbd">Enter</span> · <span class="kbd">T</span> leave</span></div>`;
    (document.getElementById('hud') || document.body).appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => { const b = e.target.closest('.sh-item'); if (b && !b.disabled) this.pick(+b.dataset.i); });
    addEventListener('keydown', (e) => {
      if (!this.cur) return;
      if (e.code === 'Escape' || e.code === 'KeyT') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); return; }
      const m = /^Digit(\d)$/.exec(e.code); if (m) { e.preventDefault(); e.stopImmediatePropagation(); this.pick(+m[1] - 1); return; }
      this.nav.key(e);
    }, true);
    // T: talk to whoever is in front of you, out on the street or inside
    addEventListener('keydown', (e) => {
      if (e.code !== 'KeyT' || e.repeat || this.cur || G.state !== 'play' || !G.player.onFoot) return;
      if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) return;
      if (this.tryTalk()) e.preventDefault();
    });
    this.nav = new KbNav(el.querySelector('.tk-opts'), '.sh-item');
  }
  tryTalk() {
    const G = this.g, P = G.player, I = G.interiors;
    if ((this._t || 0) > performance.now()) return false;
    this._t = performance.now() + 600;
    if (I && I.inside) {
      const C = I.cur, x = P.x, z = P.z, fx = Math.cos(P.th), fz = Math.sin(P.th);
      let best = null, bd = 2.4;
      for (const p of C.R.peds || []) {
        if (p.hidden || p.walkedOff) continue;
        const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
        if (d < bd && (d < 0.9 || (dx*fx + dz*fz)/d > 0.2)) { bd = d; best = p; }
      }
      if (!best) return false;
      // the one you're here with: that's the date
      if (best.dateWith && G.date) { G.date.talk(best, C); return true; }
      return this.open(best, C);
    }
    const p = who(G.people, P);
    return p ? this.open(p, null) : false;
  }
  // who they are where you found them
  roleOf(p, C) {
    if (!C) return 'street';
    const R = C.R, i = R.peds ? R.peds.indexOf(p) : -1;
    if (p.police) return 'cop';
    if (i >= 0 && i < (R.people || []).length) return (R.people[i].role || 'keeper');
    if (p.dancer) return 'dancer';
    if (p.atBar) return 'bar';
    if (R.tpl === 'gym') return 'gym';
    if (R.tpl === 'clinic') return 'patient';
    if (/^sit/.test(p.anim || p.idle || '')) return 'seated';
    return 'customer';
  }
  open(p, room) {
    const G = this.g, ppl = G.people, P = G.player, name = this.nameOf(p, room);
    const sub = (mr, en, t = 4) => G.hud.say(name, mr, en, t);
    const att = ppl.gate ? ppl.gate(p, P, G, sub) : 'normal';
    if (!att) return true;                          // that was all they had for you
    this.cur = { p, room, att, used: {}, role: this.roleOf(p, room) };
    G.state = 'shop';
    const ph = (p.anim || p.idle) === 'phone';
    const hi = ph ? ['एक मिनिट, फोनवर आहे... हां, बोला.', 'One minute, I\'m on the phone... yes, go on.']
      : this.cur.role === 'keeper' ? ['बोला, काय देऊ?', 'Tell me, what can I get you?']
      : WARM[att] >= 2 ? one(ppl.rng, [['हां, बोला?', 'Yes, tell me?'], ['नमस्कार! काय म्हणताय?', 'Namaskar! What\'s up?']]) : att === 'curt' ? ['काय?', 'What?'] : ['हां?', 'Yes?'];
    this.say(...hi);
    this.render(); this.el.hidden = false;
    return true;
  }
  nameOf(p, room) {
    if (p.name) return p.name;
    if (p.cop || p.police) return 'Havaldar';
    const r = room && this.roleOf(p, room);
    return ROLE[r] || WHO[p.persona] || (p.female ? 'A woman' : 'A man');
  }
  say(mr, en) { this.el.querySelector('.tk-line').textContent = mr ? `“${mr}”` : ''; this.el.querySelector('.tk-tr').textContent = en || ''; }
  options() {
    const c = this.cur, G = this.g, p = c.p, D = G.date, o = [], add = (id) => o.push({ id, label: LABEL[id] }), R = c.room && c.room.R;
    const dateable = D && !p.cop && !p.police && !OLD.has(p.persona) && (p.name ? D.eligible(p) : !!p.female !== !!G.player.look.female);
    switch (c.role) {
      case 'street': {
        // the way, food and where you are: always, outside
        if (G.waypoint) o.push({ id: 'way', label: `Ask the way to ${G.waypoint.name || 'your waypoint'}` });
        o.push({ id: 'food', label: 'Where can I get something to eat?' }, { id: 'where', label: 'Where am I?' });
        if (G.waypoint && !p.cop) o.push({ id: 'lift', label: `Going towards ${G.waypoint.name || 'there'}? Could you drop me?` });
        const g = group(p);
        if (!p._topics) p._topics = pickTopics(G.people.rng, STREET[g] || STREET.any, g === 'cop' ? 3 : 4);
        p._topics.forEach(add);
        break;
      }
      case 'keeper': {
        const tpl = R && R.tpl;
        if (tpl === 'chowki') { add('quiet'); add('trouble'); break; }
        if (/cafe|eatery/.test(tpl)) { add('good'); add('biz'); add('since'); break; }
        if (/club|pub/.test(tpl)) { add('recommend'); add('night'); break; }
        if (tpl === 'bank') { add('account'); add('server'); break; }
        add('good'); add('sells'); add('biz'); add('since'); add('discount');
        break;
      }
      case 'teller': add('account'); add('server'); break;
      case 'barber': add('wait'); add('cut'); add('gossip'); break;
      case 'bartender': add('recommend'); add('night'); add('drinking'); break;
      case 'helper': add('where2'); add('good'); break;
      case 'cop': add('quiet'); add('trouble'); add('respect'); break;
      case 'dancer': add('fun'); add('dance'); add('buy'); break;
      case 'bar': add('drinking'); add('buy'); add('often'); add('day'); break;
      case 'seated': add('seat'); add('ordered'); add('day'); add('often'); break;
      case 'gym': add('train'); add('spot'); add('diet'); break;
      case 'patient': add('waitlong'); add('day'); break;
      default: add('anygood'); add('found'); add('often'); add('cheaper');
    }
    if (dateable && !['keeper', 'teller', 'cop', 'barber', 'bartender', 'helper'].includes(c.role)) o.push({ id: 'askout', label: c.room ? 'Chat them up' : 'Ask them out' });
    o.push({ id: 'bye', label: 'Leave it' });
    return o;
  }
  render() {
    const c = this.cur, p = c.p;
    this.el.querySelector('.tk-k').textContent = c.role === 'street' ? 'Stopped someone' : 'Talking';
    this.el.querySelector('.tk-name').textContent = this.nameOf(p, c.room);
    this.el.querySelector('.tk-job').textContent = MOOD[c.att] || '';
    this.opts = this.options();
    const list = this.el.querySelector('.tk-opts'); list.innerHTML = '';
    this.opts.forEach((q, i) => {
      const b = document.createElement('button'); b.className = 'sh-item'; b.dataset.i = i; b.disabled = !!c.used[q.id] && q.id !== 'bye';
      b.innerHTML = `<span class="n">${i + 1}</span><span class="nm"><b></b><small></small></span><span class="pr"></span>`;
      b.querySelector('b').textContent = q.label; b.querySelector('small').textContent = c.used[q.id] ? 'Already asked' : '';
      list.appendChild(b);
    });
    this.nav.paint();
  }
  // how warm they are to this, 0 cold to 2 warm: their way, your karma and charm, how it's gone so far
  warmth(extra = 0) {
    const c = this.cur, G = this.g, k = G.life?.s?.karma || 0, ch = G.life?.charm ?? 0.5;
    const w = WARM[c.att] - 0.4 + k/60 + (ch - 0.5) + extra + (c.warm || 0) + (G.people.rng.next() - 0.5)*0.8;
    return w < 0.6 ? 0 : w < 1.8 ? 1 : 2;
  }
  pick(i) {
    const c = this.cur; if (!c) return;
    const q = this.opts && this.opts[i]; if (!q) return;
    if (q.id === 'bye') { this.close(); return; }
    if (c.used[q.id]) return;
    c.used[q.id] = true;
    const G = this.g, ppl = G.people, p = c.p, P = G.player, rng = ppl.rng, Lf = G.life;
    let said = false, last = null; const say = (mr, en) => { said = true; last = [mr, en]; this.say(mr, en); };
    const line = (id, extra = 0) => one(rng, (LINES[id] || LINES.day)[this.warmth(extra)]);
    p.act = { clip: 'talk', t: 0, dur: 2.4 };
    switch (q.id) {
      case 'way': case 'food': case 'where': case 'lift': ppl.answer(p, P, G, q.id, c.att, say); if (ppl.lift && ppl.lift.p === p) { this.close(); if (last) G.hud.say(this.nameOf(p), last[0], last[1], 5); return; } break;
      case 'weather': {
        const k = G.weather?.kind || '', h = G.hour ?? 12, W = /rain|storm/.test(k) ? 'rain' : h >= 21 || h < 5 ? 'night' : h > 11 && h < 16 && !/cloud|fog|haze/.test(k) ? 'hot' : 'fine';
        say(...WEATHER[W][this.warmth()]); break;
      }
      case 'compliment': case 'outfit': case 'respect': { const w = this.warmth(0.2); say(...one(rng, LINES[q.id][w])); if (w === 2) { Lf?.change?.('mood', 0.03); c.warm = (c.warm || 0) + 0.3; } break; }
      case 'help': { say(...line('help', 0.3)); Lf?.change?.('karma', 1); c.warm = (c.warm || 0) + 0.3; break; }
      case 'money': { const w = this.warmth(-0.8); say(...one(rng, LINES.money[w])); if (w === 2) { G.stats.money += 20; Lf?.change?.('respect', -1); } break; }
      case 'buy': {
        if ((G.stats.money || 0) < 250) { this.el.querySelector('.tk-how').textContent = 'Not enough money on you'; c.used.buy = false; break; }
        const w = this.warmth(0.6); say(...one(rng, LINES.buy[w]));
        if (w > 0) { G.stats.money -= 250; G.saveStats?.(); c.warm = (c.warm || 0) + 0.6; Lf?.change?.('mood', 0.05); }
        break;
      }
      case 'jab': case 'boss': {
        const w = this.warmth(q.id === 'jab' ? -0.5 : -0.2); say(...one(rng, LINES[q.id][w]));
        if (q.id === 'jab' && w === 0) {
          p.angry = 5; p.grudge = 15; Lf?.change?.('karma', -1);
          if (G.brawl && !p.cop && (group(p) === 'dada' || rng.next() < 0.3)) { this.close(); ppl.startFight?.(p, P); return; }
        }
        if (w === 2) Lf?.change?.('respect', 1);
        break;
      }
      case 'askout': {
        const D = G.date;
        if (c.room && p.name) { const room = c.room; this.close(); D.talk(p, room); return; }
        const ok = rng.next() < 0.08 + (Lf?.charm ?? 0.5)*0.3 + (WARM[c.att] - 1)*0.08 + (G.life?.s?.karma || 0)/300 + (c.warm || 0)*0.15;
        if (!ok) { const w = this.warmth(-0.6); say(...ASKOUT.no[w]); if (w === 0) { this.close(); ppl.flee(p, P.x, P.z, 8); return; } break; }
        say(...one(rng, ASKOUT.yes));
        this.addContact(p);
        break;
      }
      default: say(...line(q.id));
    }
    if (!said) this.say('', '');
    this.render();
  }
  // a number: they go into your phone like anyone you met in a café
  addContact(p) {
    const G = this.g, D = G.date, Lf = G.life; if (!D) return;
    const taken = new Set((D.contacts || []).map(c => c.name)), pool = CAST[p.female ? 'f' : 'm'].filter(c => !taken.has(c.name));
    if (!p.name && pool.length) p.name = pool[Math.floor(G.people.rng.next()*pool.length)].name;
    if (!p.name) return;
    const P = D.profile(p), area = (G.hud?.suburbs || []).reduce((a, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); return d < a.d ? { d, n: q.n } : a; }, { d: 1e9, n: 'the street' }).n;
    const ct = { name: p.name, female: !!p.female, lang: P.lang, vibe: P.vibe, likes: P.likes, job: P.job, area: P.area, met: area, aff: 10, t: G.clock || 0, lastSeen: G.clock || 0, partner: false };
    Lf.s.contacts = D.contacts.filter(x => x.name !== ct.name).concat([ct]);
    Lf.change('mood', 0.1); Lf.save?.();
    this.el.querySelector('.tk-how').textContent = `${p.name} is in your phone. Jhola → People to text them`;
    G.later?.(G.people.rng.next()*100 + 50, () => D.sms(ct, 't_hi', 'Ask to meet from Jhola → People'));
  }
  close() {
    const c = this.cur; if (!c) return;
    this.cur = null; this.el.hidden = true; this.el.querySelector('.tk-how').textContent = '';
    if (c.p.mode === 'watch') c.p.wait = 1.2;
    if (this.g.state === 'shop') this.g.state = 'play';
    this._t = performance.now() + 400;
  }
}

// made once the game is up (ask.js keeps the game on the people as _G)
const upd = People.prototype.update;
People.prototype.update = function (dt, player, ...a) {
  const G = this._G;
  if (G && !G.talkUI) G.talkUI = new Talk(G);
  return upd.call(this, dt, player, ...a);
};
