# The voice bank: every non-story line the street can say, cast and directed for Indic Parler-TTS.
# Each line: who says it (persona, gender, age, their voice), the moment, the context (weather, time, festival),
# the mood and how hard, and what it means. Writes tools/voice_bank.json (the jobs, for the Colab notebook
# tools/puneri_voice_bank.ipynb) — ids are  vb_<cat>_<who>_<moment>_<ctx>_<n>[_<take>]  so the game can pick a
# line by who's speaking, what's happening and the weather.
#   python3 tools/voice_bank.py
import json, os, itertools
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- who
# persona: (language, gender, age, Parler speaker, pitch, pace, who they are)
P = {
  'kaka':        ('mr', 'man', 'middle-aged', 'Sanjay', 'slightly low', 'moderate', 'a middle-aged Puneri man, dry and a little sarcastic'),
  'ajoba':       ('mr', 'man', 'old', 'Sanjay', 'low and slightly hoarse', 'slow', 'an old man from the peths, unhurried and opinionated'),
  'dada':        ('mr', 'man', 'young', 'Nikhil', 'moderate', 'fast', 'a young local guy, casual and confident'),
  'collegeboy':  ('mr', 'man', 'young', 'Nikhil', 'slightly high', 'fast', 'a college student, energetic and joking'),
  'kaku':        ('mr', 'woman', 'middle-aged', 'Sunita', 'moderate', 'moderate', 'a middle-aged Puneri woman, sharp and warm'),
  'aaji':        ('mr', 'woman', 'old', 'Sunita', 'slightly low and a little shaky', 'slow', 'an old woman, kind but blunt'),
  'tai':         ('mr', 'woman', 'young', 'Radha', 'moderate', 'moderate', 'a young working woman, direct and lively'),
  'collegegirl': ('mr', 'woman', 'young', 'Isha', 'high', 'fast', 'a college student, bubbly and quick'),
  'bhaiya':      ('hi', 'man', 'adult', 'Aman', 'moderate', 'moderate', 'a working man from up north, friendly and loud'),
  'aunty':       ('hi', 'woman', 'middle-aged', 'Divya', 'moderate', 'moderate', 'a chatty aunty'),
  'kpguy':       ('en', 'man', 'young', 'Kabir', 'moderate', 'relaxed', 'a young man from Koregaon Park, laid-back'),
  'kpgirl':      ('en', 'woman', 'young', 'Riya', 'moderate', 'relaxed', 'a young woman from Koregaon Park, cool and amused'),
}
# ---------------------------------------------------------------- the moments on the street
# moment: (mood words, takes [intensities], contexts apply?, lines per language [native, roman, english])
M = {
 'nearmiss': ('angry, startled, voice raised', ['irritated', 'furious'], True, {
   'mr': [['अरे! दिसत नाही का?', 'Are! Disat nahi ka?', 'Hey! Can’t you see?'], ['मारशील का आता? हळू चालव!', 'Maarshil ka aata? Halu chalav!', 'Going to kill me now? Drive slowly!'], ['डोळे आहेत की नाही?', 'Dole aahet ki nahi?', 'Do you have eyes or not?'], ['काय रे, रस्ता तुझ्या बापाचा आहे का?', 'Kay re, rasta tujhya baapacha aahe ka?', 'What, does your father own the road?'], ['थांब रे जरा! माणसं चालतात इथे!', 'Thamb re jara! Maansa chaaltaat ithe!', 'Stop a bit! People walk here!']],
   'hi': [['अरे! दिखता नहीं क्या?', 'Arre! Dikhta nahi kya?', 'Hey! Can’t you see?'], ['मारेगा क्या? धीरे चला!', 'Maarega kya? Dheere chala!', 'Going to kill someone? Drive slowly!'], ['आँखें हैं कि नहीं?', 'Aankhen hain ki nahi?', 'Got eyes or not?'], ['सड़क तेरे बाप की है क्या?', 'Sadak tere baap ki hai kya?', 'Does your father own the road?'], ['रुक जा भाई! लोग चल रहे हैं!', 'Ruk ja bhai! Log chal rahe hain!', 'Stop, man! People are walking!']],
   'en': [['Whoa! Watch it!', '', 'Whoa! Watch it!'], ['Are you trying to kill someone?', '', 'Are you trying to kill someone?'], ['Seriously? Eyes on the road!', '', 'Seriously? Eyes on the road!'], ['You nearly hit me!', '', 'You nearly hit me!'], ['Slow down, man! People walk here!', '', 'Slow down! People walk here!']]}),
 'honked': ('annoyed, snapping back', ['annoyed'], True, {
   'mr': [['हो हो, जातोय!', 'Ho ho, jaatoy!', 'Yes, yes, I’m going!'], ['हॉर्न वाजवून काय उडून जाऊ का?', 'Horn vajavun kay udun jau ka?', 'Should I fly away because you honked?'], ['एवढी काय घाई आहे?', 'Evdhi kay ghai aahe?', 'What’s the big hurry?'], ['बस झालं हॉर्न!', 'Bas jhala horn!', 'Enough with the horn!'], ['दिसतंय मला, आंधळा नाहीये.', 'Distay mala, aandhla nahiye.', 'I can see, I’m not blind.']],
   'hi': [['हाँ हाँ, जा रहा हूँ!', 'Haan haan, ja raha hoon!', 'Yes, yes, I’m going!'], ['इतना हॉर्न क्यों बजा रहा है?', 'Itna horn kyun baja raha hai?', 'Why so much honking?'], ['कहाँ भागना है इतनी जल्दी?', 'Kahan bhaagna hai itni jaldi?', 'Where’s the rush?'], ['बस कर भाई, हॉर्न!', 'Bas kar bhai, horn!', 'Enough with the horn, man!'], ['दिख रहा है, अंधा नहीं हूँ.', 'Dikh raha hai, andha nahi hoon.', 'I can see, I’m not blind.']],
   'en': [['Okay, okay, I’m moving!', '', 'Okay, okay, I’m moving!'], ['Stop honking!', '', 'Stop honking!'], ['What’s the rush?', '', 'What’s the rush?'], ['Yes, I heard you.', '', 'Yes, I heard you.'], ['Honking won’t make me fly.', '', 'Honking won’t make me fly.']]}),
 'bumped': ('angry, shoved and offended', ['irritated', 'furious'], True, {
   'mr': [['धक्का का मारलास?', 'Dhakka ka maarlas?', 'Why did you shove me?'], ['बघून चाल ना!', 'Baghun chaal na!', 'Watch where you walk!'], ['काय रे, अंगावर येतोस?', 'Kay re, angavar yetos?', 'What, you coming at me?'], ['सॉरी तरी म्हण!', 'Sorry tari mhan!', 'At least say sorry!'], ['ही काय पद्धत आहे?', 'Hi kay paddhat aahe?', 'What kind of manners is this?']],
   'hi': [['धक्का क्यों मारा?', 'Dhakka kyun maara?', 'Why did you push me?'], ['देख के चल ना!', 'Dekh ke chal na!', 'Watch where you’re going!'], ['ऊपर चढ़ेगा क्या?', 'Upar chadhega kya?', 'Going to climb on me?'], ['सॉरी तो बोल!', 'Sorry to bol!', 'At least say sorry!'], ['ये क्या तरीका है?', 'Ye kya tareeka hai?', 'What kind of manners is this?']],
   'en': [['Hey! Watch it!', '', 'Hey! Watch it!'], ['Did you just shove me?', '', 'Did you just shove me?'], ['Excuse you!', '', 'Excuse you!'], ['At least say sorry.', '', 'At least say sorry.'], ['What is your problem?', '', 'What is your problem?']]}),
 'knocked': ('in pain and shock, winded', ['hurt'], False, {
   'mr': [['आई गं!', 'Aai ga!', 'Oh mother!'], ['अरे देवा, माझा पाय!', 'Are deva, maajha paay!', 'Oh god, my leg!'], ['उठवा रे मला कोणीतरी!', 'Uthava re mala konitari!', 'Someone help me up!'], ['पाडलंस ना मला!', 'Paadlas na mala!', 'You knocked me down!'], ['हळू… हळू…', 'Halu… halu…', 'Slowly… slowly…']],
   'hi': [['हाय माँ!', 'Haay maa!', 'Oh mother!'], ['मेरा पैर!', 'Mera pair!', 'My leg!'], ['कोई उठाओ मुझे!', 'Koi uthao mujhe!', 'Someone lift me up!'], ['गिरा दिया ना!', 'Gira diya na!', 'You knocked me down!'], ['आराम से… आराम से…', 'Aaram se… aaram se…', 'Easy… easy…']],
   'en': [['Ow! Ow!', '', 'Ow! Ow!'], ['My leg!', '', 'My leg!'], ['Somebody help me up.', '', 'Somebody help me up.'], ['You knocked me over!', '', 'You knocked me over!'], ['Easy… easy…', '', 'Easy… easy…']]}),
 'crash': ('shocked, a hand to the mouth', ['shocked'], True, {
   'mr': [['अरे बापरे! धडकली!', 'Are baapre! Dhadakli!', 'Oh my god! It crashed!'], ['बघितलं का? पूर्ण ठोकली!', 'Baghitla ka? Poorna thokli!', 'Did you see? Rammed it completely!'], ['कोणाला लागलं तर नाही ना?', 'Konala laagla tar nahi na?', 'I hope nobody’s hurt?'], ['हे असंच होणार होतं.', 'He asach honaar hota.', 'This was bound to happen.'], ['अॅक्सिडेंट! थांबा थांबा!', 'Accident! Thamba thamba!', 'Accident! Stop, stop!']],
   'hi': [['अरे बाप रे! ठोक दी!', 'Arre baap re! Thok di!', 'Oh my god! Rammed it!'], ['देखा? पूरा ठोक दिया!', 'Dekha? Poora thok diya!', 'See that? Hit it full on!'], ['किसी को लगी तो नहीं?', 'Kisi ko lagi to nahi?', 'Is anyone hurt?'], ['यही होना था.', 'Yahi hona tha.', 'This was bound to happen.'], ['एक्सीडेंट! रुको रुको!', 'Accident! Ruko ruko!', 'Accident! Stop, stop!']],
   'en': [['Oh my god, they crashed!', '', 'Oh my god, they crashed!'], ['Did you see that?', '', 'Did you see that?'], ['Is anyone hurt?', '', 'Is anyone hurt?'], ['That was coming.', '', 'That was coming.'], ['Accident! Stop!', '', 'Accident! Stop!']]}),
 'hurt': ('worried, urgent, kneeling by someone hurt', ['urgent'], False, {
   'mr': [['अॅम्ब्युलन्स बोलवा रे कोणीतरी!', 'Ambulance bolva re konitari!', 'Someone call an ambulance!'], ['श्वास चालू आहे का बघा!', 'Shvaas chaalu aahe ka bagha!', 'Check if they’re breathing!'], ['हलवू नका त्यांना!', 'Halvu naka tyanna!', 'Don’t move them!'], ['पाणी आणा, पाणी!', 'Paani aana, paani!', 'Bring water, water!'], ['बाजूला व्हा, जागा द्या!', 'Baajula vha, jaaga dya!', 'Move aside, give them room!']],
   'hi': [['कोई एम्बुलेंस बुलाओ!', 'Koi ambulance bulao!', 'Someone call an ambulance!'], ['साँस चल रही है क्या देखो!', 'Saans chal rahi hai kya dekho!', 'See if they’re breathing!'], ['हिलाओ मत इनको!', 'Hilao mat inko!', 'Don’t move them!'], ['पानी लाओ, पानी!', 'Paani lao, paani!', 'Bring water, water!'], ['हटो, जगह दो!', 'Hato, jagah do!', 'Move, give them room!']],
   'en': [['Someone call an ambulance!', '', 'Someone call an ambulance!'], ['Check if they’re breathing!', '', 'Check if they’re breathing!'], ['Don’t move them!', '', 'Don’t move them!'], ['Get some water!', '', 'Get some water!'], ['Give them some room!', '', 'Give them some room!']]}),
 'thief': ('outraged, shouting for help', ['loud'], False, {
   'mr': [['चोर! चोर! पकडा त्याला!', 'Chor! Chor! Pakda tyala!', 'Thief! Thief! Catch him!'], ['माझं पाकीट! माझं पाकीट गेलं!', 'Maajha paakit! Maajha paakit gela!', 'My wallet! My wallet’s gone!'], ['अरे पळाला तो, पकडा!', 'Are palaala to, pakda!', 'He ran, catch him!'], ['पोलिसांना बोलवा!', 'Polisanna bolva!', 'Call the police!'], ['माझी पर्स! कोणीतरी थांबवा!', 'Maajhi purse! Konitari thaambva!', 'My purse! Someone stop him!']],
   'hi': [['चोर! चोर! पकड़ो!', 'Chor! Chor! Pakdo!', 'Thief! Thief! Catch him!'], ['मेरा बटुआ! बटुआ गया!', 'Mera batua! Batua gaya!', 'My wallet! It’s gone!'], ['भागा वो, पकड़ो उसे!', 'Bhaaga vo, pakdo use!', 'He ran, catch him!'], ['पुलिस को बुलाओ!', 'Police ko bulao!', 'Call the police!'], ['मेरा पर्स! कोई रोको!', 'Mera purse! Koi roko!', 'My purse! Someone stop him!']],
   'en': [['Thief! Stop him!', '', 'Thief! Stop him!'], ['My wallet! It’s gone!', '', 'My wallet! It’s gone!'], ['He’s running, grab him!', '', 'He’s running, grab him!'], ['Somebody call the police!', '', 'Somebody call the police!'], ['My bag! Stop him!', '', 'My bag! Stop him!']]}),
 'calling': ('urgent on the phone, low and fast, glancing over', ['urgent'], True, {
   'mr': [['हॅलो, पोलीस? इथे गोंधळ झालाय.', 'Hello, police? Ithe gondhal jhalay.', 'Hello, police? There’s trouble here.'], ['हो, मी बघितलं, तो आत्ताच पळाला.', 'Ho, mi baghitla, to aattach palaala.', 'Yes, I saw it, he just ran.'], ['गाडीचा नंबर लिहून घेतलाय मी.', 'Gaadicha number lihun ghetlay mi.', 'I’ve noted down the vehicle number.'], ['लवकर या, एकाला लागलंय.', 'Lavkar ya, ekala laaglay.', 'Come quickly, someone’s hurt.'], ['हो, इथेच आहे अजून, लवकर पाठवा.', 'Ho, ithech aahe ajun, lavkar paathva.', 'Yes, still here, send someone quick.']],
   'hi': [['हैलो, पुलिस? यहाँ गड़बड़ हुई है.', 'Hello, police? Yahan gadbad hui hai.', 'Hello, police? There’s trouble here.'], ['हाँ, मैंने देखा, अभी भागा.', 'Haan, maine dekha, abhi bhaaga.', 'Yes, I saw it, he just ran.'], ['गाड़ी का नंबर नोट कर लिया है.', 'Gaadi ka number note kar liya hai.', 'I’ve noted the vehicle number.'], ['जल्दी आइए, किसी को लगी है.', 'Jaldi aaiye, kisi ko lagi hai.', 'Come quickly, someone’s hurt.'], ['हाँ, यहीं है अभी, जल्दी भेजिए.', 'Haan, yahin hai abhi, jaldi bhejiye.', 'Yes, still here, send someone fast.']],
   'en': [['Hello, police? Something’s happened here.', '', 'Hello, police? Something’s happened here.'], ['Yes, I saw it, he just ran.', '', 'Yes, I saw it, he just ran.'], ['I’ve got the number plate.', '', 'I’ve got the number plate.'], ['Please hurry, someone’s hurt.', '', 'Please hurry, someone’s hurt.'], ['They’re still here, send someone.', '', 'They’re still here, send someone.']]}),
 'hangup': ('frightened, backing away, the phone going down', ['scared'], False, {
   'mr': [['नाही नाही, काही नाही, ठेवतो फोन.', 'Nahi nahi, kahi nahi, thevto phone.', 'No no, nothing, I’m putting the phone down.'], ['मी काही बघितलं नाही.', 'Mi kahi baghitla nahi.', 'I didn’t see anything.'], ['जातो मी, जातो.', 'Jaato mi, jaato.', 'I’m going, I’m going.'], ['माझा काही संबंध नाही.', 'Maajha kahi sambandh nahi.', 'It’s nothing to do with me.'], ['ठीक आहे, ठीक आहे, शांत.', 'Theek aahe, theek aahe, shaant.', 'Okay, okay, calm down.']],
   'hi': [['नहीं नहीं, कुछ नहीं, रख रहा हूँ.', 'Nahi nahi, kuch nahi, rakh raha hoon.', 'No no, nothing, I’m hanging up.'], ['मैंने कुछ नहीं देखा.', 'Maine kuch nahi dekha.', 'I didn’t see anything.'], ['जा रहा हूँ, जा रहा हूँ.', 'Ja raha hoon, ja raha hoon.', 'I’m going, I’m going.'], ['मेरा कोई लेना देना नहीं.', 'Mera koi lena dena nahi.', 'It’s nothing to do with me.'], ['ठीक है, ठीक है, शांत.', 'Theek hai, theek hai, shaant.', 'Okay, okay, calm down.']],
   'en': [['No, nothing, I’m hanging up.', '', 'No, nothing, I’m hanging up.'], ['I didn’t see anything.', '', 'I didn’t see anything.'], ['I’m going, okay? I’m going.', '', 'I’m going, okay? I’m going.'], ['Not my business.', '', 'Not my business.'], ['Okay, okay, relax.', '', 'Okay, okay, relax.']]}),
 'copcame': ('relieved, pointing', ['relieved'], False, {
   'mr': [['आले बघा पोलीस.', 'Aale bagha police.', 'Look, the police are here.'], ['साहेब, त्याने केलं, तो!', 'Saheb, tyaane kela, to!', 'Sir, he did it, him!'], ['बरं झालं आलात.', 'Bara jhala aalat.', 'Good thing you came.'], ['तिकडे गेला तो, तिकडे!', 'Tikde gela to, tikde!', 'He went that way, that way!'], ['आता कळेल त्याला.', 'Aata kalel tyala.', 'Now he’ll learn.']],
   'hi': [['आ गई पुलिस.', 'Aa gayi police.', 'The police are here.'], ['साहब, इसने किया, इसने!', 'Saahab, isne kiya, isne!', 'Sir, he did it, him!'], ['अच्छा हुआ आप आ गए.', 'Achha hua aap aa gaye.', 'Good thing you came.'], ['उधर गया वो, उधर!', 'Udhar gaya vo, udhar!', 'He went that way!'], ['अब पता चलेगा इसको.', 'Ab pata chalega isko.', 'Now he’ll learn.']],
   'en': [['Finally, the police.', '', 'Finally, the police.'], ['Officer, it was him!', '', 'Officer, it was him!'], ['Thank god you’re here.', '', 'Thank god you’re here.'], ['He went that way!', '', 'He went that way!'], ['Now he’s in trouble.', '', 'Now he’s in trouble.']]}),
 'siren': ('urgent, waving people aside', ['urgent'], False, {
   'mr': [['बाजूला व्हा, अॅम्ब्युलन्स!', 'Baajula vha, ambulance!', 'Move aside, ambulance!'], ['रस्ता द्या रे!', 'Rasta dya re!', 'Give way!'], ['गाड्या बाजूला घ्या!', 'Gaadya baajula ghya!', 'Pull the vehicles aside!'], ['कोणालातरी घेऊन चाललेत.', 'Konalatari gheun chaallet.', 'They’re taking someone.'], ['देव करो, वाचू दे.', 'Dev karo, vaachu de.', 'God willing, they make it.']],
   'hi': [['हटो, एम्बुलेंस!', 'Hato, ambulance!', 'Move, ambulance!'], ['रास्ता दो भाई!', 'Raasta do bhai!', 'Give way, man!'], ['गाड़ियाँ साइड करो!', 'Gaadiyan side karo!', 'Pull the vehicles aside!'], ['किसी को ले जा रहे हैं.', 'Kisi ko le ja rahe hain.', 'They’re taking someone.'], ['भगवान करे बच जाए.', 'Bhagwan kare bach jaaye.', 'God willing, they make it.']],
   'en': [['Move aside, ambulance!', '', 'Move aside, ambulance!'], ['Make way!', '', 'Make way!'], ['Pull over, pull over!', '', 'Pull over, pull over!'], ['They’re rushing someone in.', '', 'They’re rushing someone in.'], ['I hope they make it.', '', 'I hope they make it.']]}),
 'fire': ('panicked, backing off from flames', ['panicked'], False, {
   'mr': [['आग! आग लागली!', 'Aag! Aag laagli!', 'Fire! It’s on fire!'], ['लांब व्हा, फुटेल ती!', 'Laamb vha, phutel ti!', 'Get back, it’ll blow!'], ['कोणी आत आहे का?', 'Koni aat aahe ka?', 'Is anyone inside?'], ['फायर ब्रिगेडला फोन करा!', 'Fire brigade-la phone kara!', 'Call the fire brigade!'], ['धूर बघा, किती धूर!', 'Dhoor bagha, kiti dhoor!', 'Look at the smoke, so much smoke!']],
   'hi': [['आग! आग लग गई!', 'Aag! Aag lag gayi!', 'Fire! It’s on fire!'], ['दूर हटो, फटेगी!', 'Door hato, phategi!', 'Get back, it’ll blow!'], ['कोई अंदर है क्या?', 'Koi andar hai kya?', 'Is anyone inside?'], ['फायर ब्रिगेड बुलाओ!', 'Fire brigade bulao!', 'Call the fire brigade!'], ['देखो कितना धुआँ!', 'Dekho kitna dhuaan!', 'Look how much smoke!']],
   'en': [['Fire! It’s on fire!', '', 'Fire! It’s on fire!'], ['Get back, it’s going to blow!', '', 'Get back, it’s going to blow!'], ['Is anyone inside?', '', 'Is anyone inside?'], ['Call the fire brigade!', '', 'Call the fire brigade!'], ['Look at that smoke!', '', 'Look at that smoke!']]}),
 'greet': ('warm, friendly', ['warm'], True, {
   'mr': [['नमस्कार!', 'Namaskar!', 'Hello!'], ['काय, कसं काय?', 'Kay, kasa kay?', 'So, how’s it going?'], ['बरेच दिवसांनी!', 'Barech divsaanni!', 'It’s been a while!'], ['जेवण झालं का?', 'Jevan jhala ka?', 'Had your meal?'], ['चला, भेटू नंतर.', 'Chala, bhetu nantar.', 'Okay, see you later.']],
   'hi': [['नमस्ते!', 'Namaste!', 'Hello!'], ['क्या हाल है?', 'Kya haal hai?', 'How are you?'], ['बहुत दिन बाद!', 'Bahut din baad!', 'It’s been a while!'], ['खाना खाया?', 'Khaana khaaya?', 'Have you eaten?'], ['चलो, फिर मिलते हैं.', 'Chalo, phir milte hain.', 'Okay, see you later.']],
   'en': [['Hey, hi!', '', 'Hey, hi!'], ['How’s it going?', '', 'How’s it going?'], ['Long time!', '', 'Long time!'], ['Had lunch?', '', 'Had lunch?'], ['See you around.', '', 'See you around.']]}),
 'chat': ('chatting, easygoing', ['casual'], True, {
   'mr': [['काल पाऊस किती पडला ना.', 'Kaal paaus kiti padla na.', 'It rained so much yesterday.'], ['भाजी फार महाग झालीये हल्ली.', 'Bhaaji phaar mahaag jhaaliye halli.', 'Vegetables have got so expensive lately.'], ['मेट्रो कधी सुरू होणार कोणास ठाऊक.', 'Metro kadhi suru honaar konaas thaauk.', 'Who knows when the metro will start.'], ['आमच्या वेळी पुणं शांत होतं.', 'Aamchya veli Puna shaant hota.', 'Pune was quiet in our day.'], ['चहा घेऊया का एक?', 'Chaha gheuya ka ek?', 'Shall we have a chai?']],
   'hi': [['कल बहुत बारिश हुई ना.', 'Kal bahut baarish hui na.', 'It rained a lot yesterday.'], ['सब्ज़ी बहुत महँगी हो गई.', 'Sabzi bahut mehngi ho gayi.', 'Vegetables have got so expensive.'], ['मेट्रो कब चलेगी पता नहीं.', 'Metro kab chalegi pata nahi.', 'No idea when the metro will run.'], ['ट्रैफ़िक बहुत बढ़ गया है.', 'Traffic bahut badh gaya hai.', 'Traffic has got so much worse.'], ['चाय पिएँ एक?', 'Chai piyen ek?', 'Shall we have a chai?']],
   'en': [['It poured yesterday, right?', '', 'It poured yesterday, right?'], ['Rent here is crazy now.', '', 'Rent here is crazy now.'], ['When’s the metro finally running?', '', 'When’s the metro finally running?'], ['This traffic is getting worse.', '', 'This traffic is getting worse.'], ['Coffee?', '', 'Coffee?']]}),
 'mutter': ('grumbling under the breath', ['grumbling'], True, {
   'mr': [['काय चाललंय या शहराचं.', 'Kay chaallay ya shaharacha.', 'What’s happening to this city.'], ['सगळे घाईत.', 'Sagle ghaait.', 'Everyone in a hurry.'], ['रस्ते बघा, खड्डेच खड्डे.', 'Raste bagha, khaddech khadde.', 'Look at the roads, potholes everywhere.'], ['आजकालची पोरं…', 'Aajkaalchi pora…', 'Kids these days…'], ['जाऊ दे, आपल्याला काय.', 'Jaau de, aaplyala kay.', 'Let it go, not my business.']],
   'hi': [['क्या हो रहा है इस शहर को.', 'Kya ho raha hai is shehar ko.', 'What’s happening to this city.'], ['सबको जल्दी है.', 'Sabko jaldi hai.', 'Everyone’s in a hurry.'], ['सड़कें देखो, गड्ढे ही गड्ढे.', 'Sadkein dekho, gaddhe hi gaddhe.', 'Look at the roads, potholes everywhere.'], ['आजकल के बच्चे…', 'Aajkal ke bachche…', 'Kids these days…'], ['छोड़ो, अपने को क्या.', 'Chhodo, apne ko kya.', 'Let it go, not my business.']],
   'en': [['What is happening to this city.', '', 'What is happening to this city.'], ['Everyone’s in such a hurry.', '', 'Everyone’s in such a hurry.'], ['These roads, honestly.', '', 'These roads, honestly.'], ['Kids these days…', '', 'Kids these days…'], ['Whatever. Not my problem.', '', 'Whatever. Not my problem.']]}),
 'jam': ('fed up in traffic', ['fed up'], True, {
   'mr': [['हे ट्रॅफिक कधी सुटणार?', 'He traffic kadhi sutnaar?', 'When will this traffic clear?'], ['अर्धा तास इथेच अडकलोय.', 'Ardha taas ithech adaklo.', 'Stuck right here for half an hour.'], ['पुढे काय झालंय कोणास ठाऊक.', 'Pudhe kay jhalay konaas thaauk.', 'Who knows what happened up ahead.'], ['सिग्नल पण बंद आहे वाटतं.', 'Signal pan band aahe vaatta.', 'Even the signal seems to be off.'], ['चालत गेलो असतो तर पोचलो असतो.', 'Chaalat gelo asto tar pochlo asto.', 'Would’ve been there by now on foot.']],
   'hi': [['ये ट्रैफ़िक कब खुलेगा?', 'Ye traffic kab khulega?', 'When will this traffic clear?'], ['आधे घंटे से यहीं फँसे हैं.', 'Aadhe ghante se yahin phanse hain.', 'Stuck here half an hour.'], ['आगे पता नहीं क्या हुआ है.', 'Aage pata nahi kya hua hai.', 'Who knows what happened ahead.'], ['सिग्नल भी बंद है लगता है.', 'Signal bhi band hai lagta hai.', 'Signal seems to be off too.'], ['पैदल जाते तो पहुँच जाते.', 'Paidal jaate to pahunch jaate.', 'Would’ve been there on foot.']],
   'en': [['When will this jam clear?', '', 'When will this jam clear?'], ['Stuck here for half an hour.', '', 'Stuck here for half an hour.'], ['What’s going on up ahead?', '', 'What’s going on up ahead?'], ['Is the signal even working?', '', 'Is the signal even working?'], ['Should’ve just walked.', '', 'Should’ve just walked.']]}),
 'respect': ('impressed, nodding', ['admiring'], False, {
   'mr': [['तुम्हीच ना ते? चांगलं केलंत.', 'Tumhich na te? Changla kelat.', 'You’re the one, right? Good on you.'], ['आमच्या गल्लीत तुमचं नाव आहे.', 'Aamchya gallit tumcha naav aahe.', 'Our lane knows your name.'], ['देव भलं करो.', 'Dev bhala karo.', 'God bless you.'], ['असे लोक कमी आहेत.', 'Ase lok kami aahet.', 'There aren’t many like you.'], ['या कधीही चहाला.', 'Ya kadhihi chahaala.', 'Come for chai any time.']],
   'hi': [['आप ही हो ना? अच्छा किया.', 'Aap hi ho na? Achha kiya.', 'You’re the one, right? Well done.'], ['मोहल्ले में आपका नाम है.', 'Mohalle mein aapka naam hai.', 'The neighbourhood knows your name.'], ['भगवान भला करे.', 'Bhagwan bhala kare.', 'God bless you.'], ['ऐसे लोग कम हैं.', 'Aise log kam hain.', 'There aren’t many like you.'], ['कभी भी चाय पे आओ.', 'Kabhi bhi chai pe aao.', 'Come for chai any time.']],
   'en': [['Hey, you’re the one who helped, right?', '', 'Hey, you’re the one who helped, right?'], ['People here talk about you.', '', 'People here talk about you.'], ['Respect.', '', 'Respect.'], ['Not many like you.', '', 'Not many like you.'], ['Coffee’s on me sometime.', '', 'Coffee’s on me sometime.']]}),
 'fearyou': ('afraid, quiet, keeping away', ['wary'], False, {
   'mr': [['तोच आहे तो. लांब राहा.', 'Toch aahe to. Laamb raaha.', 'That’s the one. Stay away.'], ['काल त्यानेच मारलं ना?', 'Kaal tyaanech maarla na?', 'Wasn’t it him who hit someone yesterday?'], ['बघू नकोस त्याच्याकडे.', 'Baghu nakos tyachyakade.', 'Don’t look at him.'], ['चल इथून, चल.', 'Chal ithun, chal.', 'Let’s go from here, come on.'], ['पोलिसांना कळवायला हवं.', 'Polisanna kalvaayla hava.', 'Someone should tell the police.']],
   'hi': [['वही है वो. दूर रहो.', 'Vahi hai vo. Door raho.', 'That’s the one. Stay away.'], ['कल इसी ने मारा था ना?', 'Kal isi ne maara tha na?', 'Wasn’t it him yesterday?'], ['उसकी तरफ़ मत देखो.', 'Uski taraf mat dekho.', 'Don’t look at him.'], ['चलो यहाँ से.', 'Chalo yahan se.', 'Let’s get out of here.'], ['पुलिस को बताना चाहिए.', 'Police ko bataana chahiye.', 'Someone should tell the police.']],
   'en': [['That’s the guy. Stay away.', '', 'That’s the guy. Stay away.'], ['Wasn’t he the one from yesterday?', '', 'Wasn’t he the one from yesterday?'], ['Don’t look at him.', '', 'Don’t look at him.'], ['Let’s go, now.', '', 'Let’s go, now.'], ['Someone should call the cops.', '', 'Someone should call the cops.']]}),
 'flee': ('panicked, running', ['panicked'], False, {
   'mr': [['पळा! पळा!', 'Pala! Pala!', 'Run! Run!'], ['वाचवा!', 'Vaachva!', 'Help!'], ['नको नको, सोडा!', 'Nako nako, soda!', 'No, no, let me go!'], ['अरे देवा!', 'Are deva!', 'Oh god!'], ['तिकडे जाऊ नका!', 'Tikde jaau naka!', 'Don’t go that way!']],
   'hi': [['भागो! भागो!', 'Bhaago! Bhaago!', 'Run! Run!'], ['बचाओ!', 'Bachao!', 'Help!'], ['नहीं नहीं, छोड़ो!', 'Nahi nahi, chhodo!', 'No, no, let go!'], ['हे भगवान!', 'He bhagwan!', 'Oh god!'], ['उधर मत जाओ!', 'Udhar mat jaao!', 'Don’t go that way!']],
   'en': [['Run! Run!', '', 'Run! Run!'], ['Help!', '', 'Help!'], ['No, let go of me!', '', 'No, let go of me!'], ['Oh my god!', '', 'Oh my god!'], ['Don’t go that way!', '', 'Don’t go that way!']]}),
 'taunt': ('aggressive, squaring up', ['aggressive', 'menacing'], True, {
   'mr': [['ये, ये ना पुढे!', 'Ye, ye na pudhe!', 'Come on, come closer!'], ['दाखवू का तुला?', 'Daakhvu ka tula?', 'Want me to show you?'], ['खूप हवा आहे वाटतं.', 'Khoop hava aahe vaatta.', 'Full of yourself, aren’t you.'], ['आता बघ काय होतं.', 'Aata bagh kay hota.', 'Now watch what happens.'], ['गपचूप निघ इथून.', 'Gapchup nigh ithun.', 'Leave quietly.']],
   'hi': [['आ, आगे आ!', 'Aa, aage aa!', 'Come on, step up!'], ['दिखाऊँ क्या तुझे?', 'Dikhaun kya tujhe?', 'Want me to show you?'], ['बहुत हवा है तेरी.', 'Bahut hawa hai teri.', 'Full of yourself, aren’t you.'], ['अब देख क्या होता है.', 'Ab dekh kya hota hai.', 'Now see what happens.'], ['चुपचाप निकल.', 'Chupchaap nikal.', 'Get lost, quietly.']],
   'en': [['Come on then!', '', 'Come on then!'], ['You want some?', '', 'You want some?'], ['Think you’re tough?', '', 'Think you’re tough?'], ['Now you’ll see.', '', 'Now you’ll see.'], ['Walk away. Now.', '', 'Walk away. Now.']]}),
}
# what's going on around them, said after the line (and how it changes the delivery)
CTX = {
  'base': (None, ''),
  'rain': ({'mr': ['त्यात हा पाऊस!', 'Tyaat ha paaus!', 'And this rain on top!'], 'hi': ['ऊपर से ये बारिश!', 'Upar se ye baarish!', 'And this rain on top!'], 'en': ['And in this rain!', '', 'And in this rain!']},
           'Heavy rain is falling: they speak up over it, wet and irritable.'),
  'heat': ({'mr': ['या उन्हात!', 'Ya unhaat!', 'In this heat!'], 'hi': ['इस धूप में!', 'Is dhoop mein!', 'In this heat!'], 'en': ['In this heat, too.', '', 'In this heat, too.']},
           'It is a scorching summer afternoon: they are hot, tired and short-tempered.'),
  'night': ({'mr': ['एवढ्या रात्री!', 'Evdhya raatri!', 'At this hour of the night!'], 'hi': ['इतनी रात को!', 'Itni raat ko!', 'At this hour of the night!'], 'en': ['At this hour!', '', 'At this hour!']},
           'It is late at night on an empty street: their voice is lower and wary.'),
  'fest': ({'mr': ['सणाचे दिवस आहेत!', 'Sanache divas aahet!', 'It’s festival time!'], 'hi': ['त्योहार का टाइम है!', 'Tyohaar ka time hai!', 'It’s festival time!'], 'en': ['During the festival, of all times!', '', 'During the festival, of all times!']},
           'It is festival season, dhol and crowds around: they are louder, a little excited.'),
}
FEEL = {'irritated': 'with irritation, a sharp edge in the voice', 'furious': 'furiously, shouting, the voice cracking with anger', 'annoyed': 'with annoyance, snapping back', 'hurt': 'in pain, winded, gasping between the words',
        'shocked': 'in shock, breathless', 'urgent': 'urgently, fast and tense', 'loud': 'shouting at the top of their voice', 'scared': 'frightened, voice shaking, almost whispering',
        'relieved': 'with relief, pointing and talking fast', 'panicked': 'in panic, high and fast', 'warm': 'warmly, with a smile in the voice', 'casual': 'casually, chatting easily',
        'grumbling': 'grumbling under the breath, half to themselves', 'fed up': 'wearily, fed up and sighing', 'admiring': 'admiringly, respectful and warm', 'wary': 'warily, low and quick',
        'aggressive': 'aggressively, chest out, loud', 'menacing': 'menacingly, quiet and cold'}
TAIL = 'Expressive and natural, acted like a real person on a Pune street, not read aloud. The recording is of very high quality, with the voice sounding clear and very close up, almost no background noise.'

def desc(spk, who_, pitch, pace, feel, ctx_desc, en):
    return f"{spk} speaks {feel}, {pitch} in pitch, at a {pace} pace: {who_}. {ctx_desc + ' ' if ctx_desc else ''}The line means: \"{en}\". {TAIL}"

out = []
# ---------------------------------------------------------------- street people
for who_, (L, g, age, spk, pitch, pace, who_desc) in P.items():
    for mom, (mood, takes, ctxs, lines) in M.items():
        for n, (t, r, e) in enumerate(lines[L]):
            for ck, (frag, cdesc) in CTX.items():
                if ck != 'base' and not ctxs: continue
                text, sub, en = t, r, e
                if frag: text = f'{t} {frag[L][0]}'; sub = f'{r} {frag[L][1]}'.strip(); en = f'{e} {frag[L][2]}'
                for k, tk in enumerate(takes):
                    out.append({'id': f'vb_st_{who_}_{mom}_{ck}_{n}' + (f'_{k}' if len(takes) > 1 else ''), 'cat': 'street', 'who': who_, 'gender': g, 'age': age, 'moment': mom, 'ctx': ck,
                                'lang': L, 'speaker': spk, 'text': text, 'sub': sub or text, 'en': en, 'mood': tk,
                                'desc': desc(spk, f'{who_desc} ({g}, {age})', pitch, pace, FEEL[tk], cdesc, en)})

# ---------------------------------------------------------------- police, by role
ROLE = {
  'traffic': ('mr', 'Sanjay', 'firm, slightly low', 'brisk', 'a Pune traffic constable in a hi-vis vest, used to arguments'),
  'beat':    ('mr', 'Varun', 'firm', 'brisk', 'a police beat marshal on a motorbike, quick and suspicious'),
  'patrol':  ('hi', 'Rohit', 'firm, low', 'moderate', 'a patrol jeep constable, heavy and unimpressed'),
  'qrt':     ('hi', 'Aman', 'hard, clipped', 'fast', 'a Quick Response Team officer with a rifle, commanding'),
}
PL = {
 'wave':     ('commandingly, whistling and waving', {'mr': [['ओ! इकडे या! साइडला घ्या.', 'O! Ikde ya! Side-la ghya.', 'Hey! Over here! Pull to the side.'], ['थांबा! गाडी बाजूला घ्या.', 'Thamba! Gaadi baajula ghya.', 'Stop! Pull the vehicle aside.'], ['तुम्ही, हो तुम्हीच! थांबा.', 'Tumhi, ho tumhich! Thamba.', 'You, yes you! Stop.']], 'hi': [['ए! इधर आ! साइड में ले.', 'Ae! Idhar aa! Side mein le.', 'Hey! Over here! Pull aside.'], ['रुको! गाड़ी साइड करो.', 'Ruko! Gaadi side karo.', 'Stop! Pull the vehicle aside.'], ['तुम, हाँ तुम! रुको.', 'Tum, haan tum! Ruko.', 'You, yes you! Stop.']]}),
 'docs':     ('in a businesslike way, holding out a hand', {'mr': [['लायसन्स आणि कागदपत्रं दाखवा.', 'Licence aani kaagadpatra daakhva.', 'Show me your licence and papers.'], ['आरसी कुठेय? इन्शुरन्स?', 'RC kuthey? Insurance?', 'Where’s the RC? Insurance?'], ['हेल्मेट कुठेय तुमचं?', 'Helmet kuthey tumcha?', 'Where’s your helmet?']], 'hi': [['लाइसेंस और कागज़ दिखाओ.', 'License aur kaagaz dikhao.', 'Show your licence and papers.'], ['आरसी कहाँ है? इंश्योरेंस?', 'RC kahan hai? Insurance?', 'Where’s the RC? Insurance?'], ['हेलमेट कहाँ है?', 'Helmet kahan hai?', 'Where’s your helmet?']]}),
 'fine':     ('flatly, writing out the challan', {'mr': [['सिग्नल तोडलात. पाचशे रुपये.', 'Signal todlat. Paachshe rupaye.', 'You jumped the signal. Five hundred rupees.'], ['दंड भरा, पावती मिळेल.', 'Dand bhara, paavti milel.', 'Pay the fine, you’ll get a receipt.'], ['ऑनलाइन भरा किंवा इथे, तुमची मर्जी.', 'Online bhara kinva ithe, tumchi marji.', 'Pay online or here, your choice.']], 'hi': [['सिग्नल तोड़ा. पाँच सौ रुपये.', 'Signal toda. Paanch sau rupaye.', 'You jumped the signal. Five hundred.'], ['जुर्माना भरो, रसीद मिलेगी.', 'Jurmaana bharo, raseed milegi.', 'Pay the fine, you’ll get a receipt.'], ['ऑनलाइन या यहीं, जैसा चाहो.', 'Online ya yahin, jaisa chaaho.', 'Online or here, as you like.']]}),
 'pleadno':  ('flatly, unmoved, shaking the head', {'mr': [['सगळे हेच म्हणतात.', 'Sagle hech mhantaat.', 'Everyone says that.'], ['पहिली वेळ? मग शिकाल आता.', 'Pahili vel? Mag shikaal aata.', 'First time? Then you’ll learn now.'], ['रडून काही होणार नाही.', 'Radun kahi honaar nahi.', 'Crying won’t help.']], 'hi': [['सब यही बोलते हैं.', 'Sab yahi bolte hain.', 'Everyone says that.'], ['पहली बार? तो अब सीखोगे.', 'Pehli baar? To ab seekhoge.', 'First time? Then you’ll learn.'], ['रोने से कुछ नहीं होगा.', 'Rone se kuch nahi hoga.', 'Crying won’t help.']]}),
 'pleadok':  ('softly, giving in with a sigh', {'mr': [['बरं, जा. पुन्हा दिसलात तर नाही.', 'Bara, ja. Punha disalat tar nahi.', 'Fine, go. Not if I see you again.'], ['यावेळी सोडतो. लक्षात ठेवा.', 'Yaaveli sodto. Lakshaat theva.', 'Letting you off this time. Remember it.'], ['चला, निघा.', 'Chala, nigha.', 'Go on, off you go.']], 'hi': [['ठीक है, जाओ. दोबारा नहीं.', 'Theek hai, jaao. Dobaara nahi.', 'Fine, go. Not again.'], ['इस बार छोड़ रहा हूँ. याद रखना.', 'Is baar chhod raha hoon. Yaad rakhna.', 'Letting you off this time. Remember.'], ['चलो, निकलो.', 'Chalo, niklo.', 'Go on, get going.']]}),
 'bribehint':('in a low voice, glancing around', {'mr': [['बोला, काय करायचं?', 'Bola, kay karaycha?', 'So, what shall we do?'], ['चहा-पाण्याचं बघा मग.', 'Chaha-paanyacha bagha mag.', 'See about the tea money, then.'], ['पावती हवी की नको?', 'Paavti havi ki nako?', 'Want a receipt or not?']], 'hi': [['बोलो, क्या करना है?', 'Bolo, kya karna hai?', 'So, what do we do?'], ['चाय-पानी का देख लो.', 'Chai-paani ka dekh lo.', 'Sort out the tea money.'], ['रसीद चाहिए या नहीं?', 'Raseed chahiye ya nahi?', 'Want a receipt or not?']]}),
 'bribeok':  ('quietly, pocketing the money', {'mr': [['ठीक आहे. निघा पटकन.', 'Theek aahe. Nigha patkan.', 'Fine. Leave quickly.'], ['कोणाला सांगायचं नाही.', 'Konala saangaycha nahi.', 'Don’t tell anyone.'], ['पुन्हा भेटू नका.', 'Punha bhetu naka.', 'Don’t let me see you again.']], 'hi': [['ठीक है. जल्दी निकलो.', 'Theek hai. Jaldi niklo.', 'Fine. Leave quickly.'], ['किसी को बोलना नहीं.', 'Kisi ko bolna nahi.', 'Don’t tell anyone.'], ['दोबारा मत मिलना.', 'Dobaara mat milna.', 'Don’t run into me again.']]}),
 'bribeno':  ('loudly, offended', {'mr': [['लाच देतोय मला? आत टाकीन!', 'Laach detoy mala? Aat taakin!', 'Bribing me? I’ll lock you up!'], ['हे काय? गुन्हा आहे हा!', 'He kay? Gunha aahe ha!', 'What’s this? That’s a crime!'], ['पैसे परत ठेवा. आता केस लिहितो.', 'Paise parat theva. Aata case lihito.', 'Put the money away. Now I write a case.']], 'hi': [['रिश्वत दे रहा है? अंदर कर दूँगा!', 'Rishvat de raha hai? Andar kar doonga!', 'Bribing me? I’ll lock you up!'], ['ये क्या है? जुर्म है ये!', 'Ye kya hai? Jurm hai ye!', 'What’s this? It’s a crime!'], ['पैसे रखो. अब केस बनेगा.', 'Paise rakho. Ab case banega.', 'Keep your money. Now there’s a case.']]}),
 'counter':  ('flatly, bargaining', {'mr': [['एवढ्याने नाही चालणार.', 'Evdhyaane nahi chaalnaar.', 'That won’t do.'], ['थोडं वाढवा.', 'Thoda vaadhva.', 'Raise it a little.'], ['अजून टाका, मग बघू.', 'Ajun taaka, mag baghu.', 'Add some more, then we’ll see.']], 'hi': [['इतने से नहीं चलेगा.', 'Itne se nahi chalega.', 'That won’t do.'], ['थोड़ा बढ़ाओ.', 'Thoda badhao.', 'Raise it a bit.'], ['और डालो, फिर देखते हैं.', 'Aur daalo, phir dekhte hain.', 'Add more, then we’ll see.']]}),
 'chase':    ('shouting while running, out of breath', {'mr': [['थांब! पळू नकोस!', 'Thamb! Palu nakos!', 'Stop! Don’t run!'], ['पकडा रे त्याला!', 'Pakda re tyala!', 'Grab him!'], ['जाशील कुठे?', 'Jaashil kuthe?', 'Where do you think you’re going?']], 'hi': [['रुक! भाग मत!', 'Ruk! Bhaag mat!', 'Stop! Don’t run!'], ['पकड़ो उसे!', 'Pakdo use!', 'Grab him!'], ['कहाँ जाएगा?', 'Kahan jaayega?', 'Where will you go?']]}),
 'tackle':   ('grunting, pinning someone down', {'mr': [['खाली! हात मागे!', 'Khaali! Haat maage!', 'Down! Hands behind!'], ['हलू नकोस!', 'Halu nakos!', 'Don’t move!'], ['झालं, सापडलास.', 'Jhala, saapadlas.', 'That’s it, got you.']], 'hi': [['नीचे! हाथ पीछे!', 'Neeche! Haath peeche!', 'Down! Hands behind!'], ['हिलना मत!', 'Hilna mat!', 'Don’t move!'], ['बस, पकड़ लिया.', 'Bas, pakad liya.', 'That’s it, got you.']]}),
 'cuffs':    ('calmly and with finality', {'mr': [['चला, चौकीवर.', 'Chala, chaukivar.', 'Come on, to the chowki.'], ['तुम्हाला अटक करतोय.', 'Tumhala atak kartoy.', 'You are under arrest.'], ['गाडीत बसा.', 'Gaadit basa.', 'Get in the vehicle.']], 'hi': [['चलो, थाने.', 'Chalo, thaane.', 'Come on, to the station.'], ['तुम्हें गिरफ़्तार किया जाता है.', 'Tumhein giraftaar kiya jaata hai.', 'You are under arrest.'], ['गाड़ी में बैठो.', 'Gaadi mein baitho.', 'Get in the vehicle.']]}),
 'warn':     ('shouting a final warning', {'mr': [['थांब, नाहीतर गोळी चालवीन!', 'Thamb, naahitar goli chaalveen!', 'Stop, or I’ll shoot!'], ['शेवटचं सांगतोय!', 'Shevatcha saangtoy!', 'Last warning!'], ['हात वर!', 'Haat var!', 'Hands up!']], 'hi': [['रुक जा, वरना गोली चलेगी!', 'Ruk ja, varna goli chalegi!', 'Stop, or I’ll shoot!'], ['आख़िरी बार बोल रहा हूँ!', 'Aakhiri baar bol raha hoon!', 'Last time I’m saying it!'], ['हाथ ऊपर!', 'Haath upar!', 'Hands up!']]}),
}
for role, (L, spk, pitch, pace, who_desc) in ROLE.items():
    for mom, (feel, lines) in PL.items():
        if role == 'traffic' and mom in ('warn', 'tackle'): continue
        if role != 'qrt' and mom == 'warn': continue
        for n, (t, r, e) in enumerate(lines[L]):
            for ck in (['base', 'rain', 'night'] if mom in ('wave', 'docs', 'chase') else ['base']):
                cdesc = CTX[ck][1]
                out.append({'id': f'vb_po_{role}_{mom}_{ck}_{n}', 'cat': 'police', 'who': role, 'gender': 'man', 'age': 'adult', 'moment': mom, 'ctx': ck, 'lang': L, 'speaker': spk,
                            'text': t, 'sub': r, 'en': e, 'mood': feel, 'desc': desc(spk, who_desc, pitch, pace, feel, cdesc, e)})

# ---------------------------------------------------------------- the police radio (control room), about real places
PLACES = ['Swargate', 'Shivajinagar', 'Deccan', 'FC Road', 'JM Road', 'Laxmi Road', 'Kasba Peth', 'Sadashiv Peth', 'Narayan Peth', 'Budhwar Peth', 'Camp', 'MG Road', 'Koregaon Park',
          'Kalyani Nagar', 'Viman Nagar', 'Yerwada', 'Pune Station', 'Bund Garden', 'Kothrud', 'Karve Road', 'Erandwane', 'Aundh', 'Baner', 'Pashan', 'Sinhagad Road', 'Katraj',
          'Bibwewadi', 'Market Yard', 'Hadapsar', 'Magarpatta', 'Kharadi', 'Wakad', 'Hinjewadi', 'Nigdi', 'Shaniwar Wada', 'Dagdusheth', 'Sarasbaug', 'Tilak Road', 'University Road', 'Senapati Bapat Road']
VEH = ['black Activa', 'white scooter', 'red motorcycle', 'blue Pulsar', 'black auto', 'white hatchback', 'silver sedan', 'grey SUV', 'white Swift', 'yellow-top taxi']
RT = [
  ('All units, suspect last seen near {p}.', 'calmly and flatly'), ('Units near {p}, respond. Suspect on foot.', 'urgently'), ('Suspect in a {v}, heading towards {p}.', 'urgently'),
  ('{p} beat marshal, are you on it?', 'flatly'), ('Accident reported at {p}. Ambulance dispatched.', 'calmly and flatly'), ('Chain snatching near {p}. Suspect fled on a two-wheeler.', 'urgently'),
  ('Nakabandi at {p}. Check every two-wheeler.', 'commandingly'), ('Witness reports a fight near {p}.', 'flatly'), ('Camera hit at {p}. Plate flagged.', 'flatly'), ('Lost visual near {p}. Widen the search.', 'tensely'),
]
for i, (tpl, feel) in enumerate(RT):
    for j, pl in enumerate(PLACES):
        for vi in ([0] if '{v}' not in tpl else range(0, len(VEH), 2)):
            t = tpl.format(p=pl, v=VEH[vi])
            for spk, sx in (('Raghav', 'man'), ('Gauri', 'woman')):
                if (j + i) % 2 != (0 if sx == 'man' else 1) and '{v}' not in tpl: continue
                out.append({'id': f'vb_radio_{i}_{j}_{vi}_{sx[0]}', 'cat': 'radio', 'who': 'control', 'gender': sx, 'age': 'adult', 'moment': f'r{i}', 'ctx': 'base', 'lang': 'en', 'speaker': spk,
                            'text': t, 'sub': t, 'en': t, 'mood': feel, 'place': pl,
                            'desc': f"{spk} speaks {feel}, in a clipped police radio voice, quick and procedural: a Pune police control room dispatcher on the wireless. The line means: \"{t}\". Natural radio delivery. The recording is of very high quality, clear and close up, almost no background noise."})

# ---------------------------------------------------------------- vendors (calls and haggling), paramedics, crowds, you
VEND = {
 'tea':    ('Varun', [['चहा! गरम गरम चहा!', 'Chaha! Garam garam chaha!', 'Tea! Hot tea!'], ['कटिंग घ्या, कटिंग!', 'Cutting ghya, cutting!', 'Have a cutting!'], ['आल्याचा चहा, दहा रुपये!', 'Alyacha chaha, daha rupaye!', 'Ginger tea, ten rupees!'], ['पावसात चहा, या या!', 'Paavsaat chaha, ya ya!', 'Tea in the rain, come come!']]),
 'vadapav':('Sanjay', [['वडापाव! गरमागरम वडापाव!', 'Vadapav! Garamagaram vadapav!', 'Vada pav! Piping hot!'], ['भजी घ्या, कांदा भजी!', 'Bhaji ghya, kanda bhaji!', 'Onion bhaji!'], ['पंधरा रुपयात वडापाव!', 'Pandhra rupayat vadapav!', 'Vada pav for fifteen!'], ['ताजे वडे, आत्ताच तळले!', 'Taje vade, aattach talle!', 'Fresh vadas, just fried!']]),
 'fruit':  ('Varun', [['आंबे घ्या, हापूस आंबे!', 'Aambe ghya, Hapus aambe!', 'Alphonso mangoes!'], ['केळी, डझनाला चाळीस!', 'Keli, dazanala chaalis!', 'Bananas, forty a dozen!'], ['ताजी फळं, स्वस्तात!', 'Taaji phala, swastaat!', 'Fresh fruit, cheap!'], ['पेरू, चिकू, डाळिंब!', 'Peru, chiku, daalimb!', 'Guava, chikoo, pomegranate!']]),
 'flowers':('Sunita', [['गजरा घ्या, मोगऱ्याचा गजरा!', 'Gajra ghya, mogryacha gajra!', 'Jasmine gajra!'], ['फुलं, हार, देवाची फुलं!', 'Phula, haar, devaachi phula!', 'Flowers, garlands!'], ['झेंडू, शेवंती, ताजी फुलं!', 'Zendu, shevanti, taaji phula!', 'Marigold, chrysanthemum!'], ['ताई, गजरा घ्या ना!', 'Taai, gajra ghya na!', 'Sister, buy a gajra!']]),
 'juice':  ('Sanjay', [['उसाचा रस! थंडगार!', 'Usaacha ras! Thandgaar!', 'Sugarcane juice! Ice cold!'], ['रसवंती, ग्लास वीस रुपये!', 'Rasvanti, glass vees rupaye!', 'Twenty a glass!'], ['लिंबू आलं घालून!', 'Limbu aala ghaalun!', 'With lemon and ginger!'], ['या उन्हात थंड रस!', 'Ya unhaat thanda ras!', 'Cold juice in this heat!']]),
 'paan':   ('Nikhil', [['पान घ्या, मसाला पान!', 'Paan ghya, masala paan!', 'Masala paan!'], ['मीठा पान, कलकत्ता पान!', 'Meetha paan, Kalkatta paan!', 'Sweet paan!'], ['फायर पान, एकदा खाऊन बघा!', 'Fire paan, ekda khaun bagha!', 'Try the fire paan!'], ['जेवणानंतर पान हवंच!', 'Jevanaantar paan havach!', 'After a meal, you need a paan!']]),
}
HAGGLE = [['एवढं नाही, कमी करा.', 'Evdha nahi, kami kara.', 'Not that much, lower it.', 'you'], ['शेवटचा भाव सांगा.', 'Shevatcha bhaav saanga.', 'Tell me your last price.', 'you'],
          ['नाही परवडत, साहेब.', 'Nahi paravadat, saheb.', 'Can’t do that, sir.', 'v'], ['बरं, तुमच्यासाठी पाच कमी.', 'Bara, tumchyasaathi paach kami.', 'Okay, five less for you.', 'v'], ['घ्या, बोहनी करा.', 'Ghya, bohni kara.', 'Take it, make my first sale.', 'v']]
for kind, (spk, lines) in VEND.items():
    for n, (t, r, e) in enumerate(lines):
        for take, feel in enumerate(['calling out loudly in a sing-song hawker’s cry, raised and carrying', 'calling out, a little tired after a long day, still loud']):
            out.append({'id': f'vb_vd_{kind}_{n}_{take}', 'cat': 'vendor', 'who': kind, 'gender': 'woman' if spk == 'Sunita' else 'man', 'age': 'adult', 'moment': 'call', 'ctx': 'base', 'lang': 'mr', 'speaker': spk,
                        'text': t, 'sub': r, 'en': e, 'mood': feel, 'desc': desc(spk, f'a street vendor selling {kind} in Pune', 'moderate', 'brisk', feel, '', e)})
    for n, (t, r, e, w) in enumerate(HAGGLE):
        if w != 'v': continue
        out.append({'id': f'vb_vd_{kind}_haggle{n}', 'cat': 'vendor', 'who': kind, 'gender': 'man', 'age': 'adult', 'moment': 'haggle', 'ctx': 'base', 'lang': 'mr', 'speaker': spk,
                    'text': t, 'sub': r, 'en': e, 'mood': 'bargaining', 'desc': desc(spk, f'a street vendor selling {kind} in Pune', 'moderate', 'moderate', 'bargaining good-naturedly', '', e)})
MED = [['श्वास चालू आहे. लवकर स्ट्रेचर!', 'Shvaas chaalu aahe. Lavkar stretcher!', 'They’re breathing. Stretcher, quick!'], ['मान हलवू नका.', 'Maan halvu naka.', 'Don’t move the neck.'], ['बाजूला व्हा, जागा द्या!', 'Baajula vha, jaaga dya!', 'Move aside, give us room!'],
       ['एक, दोन, तीन, उचला!', 'Ek, don, teen, uchla!', 'One, two, three, lift!'], ['ऐकू येतंय का? डोळे उघडा.', 'Aiku yetay ka? Dole ughda.', 'Can you hear me? Open your eyes.'], ['ससूनला कळवा, येतोय आम्ही.', 'Sassoon-la kalva, yetoy aamhi.', 'Tell Sassoon we’re coming.'],
       ['रक्त खूप गेलंय, लवकर!', 'Rakta khoop gelay, lavkar!', 'They’ve lost a lot of blood, quick!'], ['हळू, हळू, पायरी आहे.', 'Halu, halu, paayri aahe.', 'Easy, easy, there’s a step.'], ['घाबरू नका, आम्ही आहोत.', 'Ghaabru naka, aamhi aahot.', 'Don’t be scared, we’re here.'], ['दरवाजा उघडा!', 'Darvaaja ughda!', 'Open the door!']]
for spk, sx in (('Varun', 'man'), ('Radha', 'woman')):
    for n, (t, r, e) in enumerate(MED):
        out.append({'id': f'vb_med_{sx[0]}_{n}', 'cat': 'medic', 'who': 'paramedic', 'gender': sx, 'age': 'adult', 'moment': f'm{n}', 'ctx': 'base', 'lang': 'mr', 'speaker': spk, 'text': t, 'sub': r, 'en': e, 'mood': 'urgent',
                    'desc': desc(spk, 'a 108 ambulance paramedic at an accident, calm but urgent', 'moderate', 'fast', 'urgently but steady, in control', '', e)})
CROWD = [['गणपती बाप्पा मोरया!', 'Ganpati Bappa Morya!', 'Ganpati Bappa Morya!'], ['पुढच्या वर्षी लवकर या!', 'Pudhchya varshi lavkar ya!', 'Come back soon next year!'], ['मंगलमूर्ती मोरया!', 'Mangalmoorti Morya!', 'Mangalmoorti Morya!'],
         ['जय भवानी, जय शिवाजी!', 'Jai Bhavani, Jai Shivaji!', 'Jai Bhavani, Jai Shivaji!'], ['पुंडलिक वरदे हारी विठ्ठल!', 'Pundalik varade haari Vitthal!', 'Pundalik varade hari Vitthal!'], ['आला रे आला!', 'Aala re aala!', 'Here it comes!']]
for spk in ('Sanjay', 'Nikhil', 'Radha'):
    for n, (t, r, e) in enumerate(CROWD):
        out.append({'id': f'vb_crowd_{spk.lower()}_{n}', 'cat': 'crowd', 'who': 'crowd', 'gender': 'woman' if spk == 'Radha' else 'man', 'age': 'adult', 'moment': f'c{n}', 'ctx': 'fest', 'lang': 'mr', 'speaker': spk,
                    'text': t, 'sub': r, 'en': e, 'mood': 'joyful', 'desc': desc(spk, 'one voice in a festival crowd in Pune', 'raised', 'moderate', 'joyfully chanting at full voice', CTX['fest'][1], e)})
YOU = {
 'hurt': ['आह!', 'Aah!', 'Argh!'], 'effort': ['हं!', 'Hm!', 'Hup!'], 'fall': ['आई गं!', 'Aai ga!', 'Oh no!'], 'sorry': ['सॉरी, सॉरी!', 'Sorry, sorry!', 'Sorry, sorry!'],
 'traffic': ['अरे बघून चालव!', 'Are baghun chaalav!', 'Hey, watch how you drive!'], 'greet': ['नमस्कार!', 'Namaskar!', 'Hello!'], 'thanks': ['धन्यवाद!', 'Dhanyavaad!', 'Thank you!'],
 'haggle': ['थोडं कमी करा ना.', 'Thoda kami kara na.', 'Lower it a bit, please.'], 'flee': ['चल, चल, चल!', 'Chal, chal, chal!', 'Go, go, go!'], 'caught': ['सोडा मला!', 'Soda mala!', 'Let me go!'],
 'cheer': ['हो! जमलं!', 'Ho! Jamla!', 'Yes! Did it!'], 'tired': ['दमलो…', 'Damlo…', 'I’m exhausted…'],
}
for spk, sx, nm in (('Nikhil', 'man', 'sid'), ('Isha', 'woman', 'saee')):
    for mom, (t, r, e) in YOU.items():
        if nm == 'saee' and mom == 'tired': t, r = 'दमले…', 'Damle…'
        for take, feel in enumerate(['naturally', 'with more force, breathing hard']):
            out.append({'id': f'vb_you_{nm}_{mom}_{take}', 'cat': 'you', 'who': nm, 'gender': sx, 'age': 'young', 'moment': mom, 'ctx': 'base', 'lang': 'mr', 'speaker': spk, 'text': t, 'sub': r, 'en': e, 'mood': feel,
                        'desc': desc(spk, f'a young {sx} from Pune, the player', 'moderate', 'moderate', feel, '', e)})

# no duplicates
seen, uniq = set(), []
for j in out:
    if j['id'] in seen: continue
    seen.add(j['id']); uniq.append(j)
json.dump(uniq, open(os.path.join(ROOT, 'tools/voice_bank.json'), 'w'), ensure_ascii=False, indent=0)
from collections import Counter
print(len(uniq), 'lines'); print(Counter(j['cat'] for j in uniq)); print(Counter(j['speaker'] for j in uniq).most_common())
