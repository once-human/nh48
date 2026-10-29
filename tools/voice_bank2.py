# Voice bank 2: the street, redone to sound like Pune. Each kind of person has their own way in (a kaka's "अहो!",
# a college kid's "भावा!", an aaji's "अरे बाळा!") onto proper Puneri roasts for a near-miss, a honk, a shove, a jam
# or a fight; and their own standalone lines for greetings, gossip, grumbling, rain, heat, late nights, Bappa
# season and the famous Puneri patya humour, each said three different ways. Context lines are lines of their own.
#   python3 tools/voice_bank2.py   → tools/voice_bank2.json (jobs) + assets/voice_bank2_lines.json (subtitles)
import json, os, random
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = random.Random(48)

# persona: language, gender, age, speaker, pitch, pace, who they are, their openers [native, roman, english]
P = {
 'kaka':  ('mr', 'man', 'middle-aged', 'Sanjay', 'slightly low', 'moderate', 'a middle-aged Puneri kaka, dry, sarcastic, never surprised', [['अहो!', 'Aho!', 'Hey!'], ['काय हो!', 'Kay ho!', 'What’s this!'], ['ओ साहेब!', 'O saheb!', 'Hey, mister!']]),
 'ajoba': ('mr', 'man', 'old', 'Sanjay', 'low and a little hoarse', 'slow', 'an old Puneri ajoba from the peths, unhurried and full of opinions', [['अरे बाळा!', 'Are baala!', 'Child!'], ['हे काय चाललंय!', 'He kay chaallay!', 'What is going on!'], ['अरे अरे!', 'Are are!', 'Hey, hey!']]),
 'dada':  ('mr', 'man', 'young', 'Nikhil', 'moderate', 'fast', 'a young local dada from the peth, swaggering and quick', [['ओ भाऊ!', 'O bhau!', 'Hey bro!'], ['ए!', 'Ae!', 'Hey!'], ['अरे भावा!', 'Are bhava!', 'Hey brother!']]),
 'collegeboy': ('mr', 'man', 'young', 'Nikhil', 'slightly high', 'fast', 'a college boy from FC Road, joking and dramatic', [['भावा!', 'Bhava!', 'Bro!'], ['ब्रो!', 'Bro!', 'Bro!'], ['अरे यार!', 'Are yaar!', 'Oh man!']]),
 'kaku':  ('mr', 'woman', 'middle-aged', 'Sunita', 'moderate', 'moderate', 'a Puneri kaku, sharp-tongued and warm underneath', [['अहो!', 'Aho!', 'Hey!'], ['काय हो!', 'Kay ho!', 'What’s this!'], ['अगं बाई!', 'Aga baai!', 'Oh my!']]),
 'aaji':  ('mr', 'woman', 'old', 'Sunita', 'slightly low and a little shaky', 'slow', 'a Puneri aaji, blunt, funny without trying', [['अरे देवा!', 'Are deva!', 'Oh god!'], ['अरे बाळा!', 'Are baala!', 'Child!'], ['अगं बाई!', 'Aga baai!', 'Oh my!']]),
 'tai':   ('mr', 'woman', 'young', 'Radha', 'moderate', 'moderate', 'a young working woman from Pune, direct and no-nonsense', [['ए!', 'Ae!', 'Hey!'], ['ओ हॅलो!', 'O hello!', 'Hello there!'], ['अहो दादा!', 'Aho dada!', 'Hey mister!']]),
 'collegegirl': ('mr', 'woman', 'young', 'Isha', 'high', 'fast', 'a college girl, sassy, bubbly and quick', [['ओ हॅलो!', 'O hello!', 'Hello?!'], ['ब्रो!', 'Bro!', 'Bro!'], ['अरे यार!', 'Are yaar!', 'Oh man!']]),
 'bhaiya': ('hi', 'man', 'adult', 'Aman', 'moderate', 'moderate', 'a working bhaiya, loud, friendly and quick with a comeback', [['अबे!', 'Abe!', 'Hey!'], ['ओ भाई साहब!', 'O bhai saahab!', 'Hey mister!'], ['अरे भाई!', 'Arre bhai!', 'Hey brother!']]),
 'aunty': ('hi', 'woman', 'middle-aged', 'Divya', 'moderate', 'moderate', 'a chatty aunty with opinions about everything', [['हाय राम!', 'Haay Ram!', 'Oh my god!'], ['अरे बेटा!', 'Arre beta!', 'Hey, kid!'], ['ओ हेलो!', 'O hello!', 'Hello!']]),
 'kpguy': ('en', 'man', 'young', 'Kabir', 'moderate', 'relaxed', 'a Koregaon Park guy, laid-back and sarcastic', [['Dude!', '', 'Dude!'], ['Bro!', '', 'Bro!'], ['Whoa, whoa!', '', 'Whoa, whoa!']]),
 'kpgirl': ('en', 'woman', 'young', 'Riya', 'moderate', 'relaxed', 'a Koregaon Park girl, cool and cutting', [['Excuse me?!', '', 'Excuse me?!'], ['Hello?!', '', 'Hello?!'], ['Wow. Okay.', '', 'Wow. Okay.']]),
}
# the roasts after the opener (moments where you did something to them)
ROAST = {
 'nearmiss': {
  'mr': [['गाडी चालवतोयस की विमान उडवतोयस?', 'Gaadi chaalavtoys ki vimaan udavtoys?', 'Driving or flying a plane?'], ['लायसन्स लॉटरीत लागलंय वाटतं.', 'Licence lottery-t laaglay vaatta.', 'Won your licence in a lottery, I guess.'],
         ['घरी कोणी वाट बघतंय की नाही?', 'Ghari koni vaat baghtay ki nahi?', 'Isn’t anyone waiting for you at home?'], ['हा पुणे आहे, फॉर्म्युला वन नाही.', 'Ha Pune aahe, Formula One nahi.', 'This is Pune, not Formula One.'],
         ['ब्रेक सजावटीसाठी लावलेत का?', 'Break sajaavtisaathi laavlet ka?', 'Are the brakes just for decoration?'], ['आज यमराज सुट्टीवर आहेत वाटतं.', 'Aaj Yamraj suttivar aahet vaatta.', 'Death must be on holiday today.'],
         ['एवढी घाई, ऑफिस तुझ्यामुळे बंद पडणार आहे का?', 'Evdhi ghai, office tujhyamule band padnaar aahe ka?', 'Such a rush, will the office shut without you?'], ['दिसत नाही? चष्मा घे, स्वस्त मिळतो.', 'Disat nahi? Chashma ghe, swasta milto.', 'Can’t see? Buy glasses, they’re cheap.'],
         ['पादचारी पण माणसंच असतात हो.', 'Paadchaari pan maansach astaat ho.', 'Pedestrians are people too, you know.'], ['तुझ्या बाबांनी गाडी दिली, अक्कल नाही दिली.', 'Tujhya baabanni gaadi dili, akkal nahi dili.', 'Your dad gave you a vehicle, not brains.'],
         ['अजून दोन इंच आणि मी फोटोत गेलो असतो.', 'Ajun don inch aani mi photo-t gelo asto.', 'Two more inches and I’d be a photo on the wall.'], ['रस्ता सगळ्यांचा आहे, फक्त तुझा नाही.', 'Rasta saglyancha aahe, phakta tujha nahi.', 'The road is everyone’s, not just yours.']],
  'hi': [['गाड़ी चला रहा है या जहाज़ उड़ा रहा है?', 'Gaadi chala raha hai ya jahaaz uda raha hai?', 'Driving or flying a plane?'], ['लाइसेंस लॉटरी में मिला क्या?', 'License lottery mein mila kya?', 'Get your licence in a lottery?'],
         ['ब्रेक सजावट के लिए लगाए हैं?', 'Brake sajaavat ke liye lagaaye hain?', 'Brakes are just decoration?'], ['घर पे कोई इंतज़ार नहीं करता क्या?', 'Ghar pe koi intezaar nahi karta kya?', 'Nobody waiting for you at home?'],
         ['आज ऊपर वाले ने बचा लिया तुझे.', 'Aaj upar waale ne bacha liya tujhe.', 'God saved you today.'], ['सड़क पे पैदल वाले भी इंसान हैं.', 'Sadak pe paidal waale bhi insaan hain.', 'People walking are humans too.'],
         ['इतनी जल्दी, ट्रेन छूट रही है क्या?', 'Itni jaldi, train chhoot rahi hai kya?', 'Such a rush, missing a train?'], ['चश्मा ले ले भाई, सस्ता है.', 'Chashma le le bhai, sasta hai.', 'Get glasses, man, they’re cheap.']],
  'en': [['Is this a road or your personal racetrack?', '', 'Is this a road or your personal racetrack?'], ['Did you get your licence free with a pizza?', '', 'Did you get your licence free with a pizza?'],
         ['The brakes are right there. Use them.', '', 'The brakes are right there. Use them.'], ['I am a person, not a speed bump!', '', 'I am a person, not a speed bump!'],
         ['Two more inches and I’d be on Instagram as breaking news.', '', 'Two more inches and I’d be breaking news.'], ['Main character energy, terrible driving.', '', 'Main character energy, terrible driving.'],
         ['Where’s the fire, Schumacher?', '', 'Where’s the fire, Schumacher?'], ['Pedestrians exist. Shocking, I know.', '', 'Pedestrians exist. Shocking, I know.']]},
 'honked': {
  'mr': [['हॉर्न वाजवून रस्ता मोठा होत नाही.', 'Horn vaajavun rasta motha hot nahi.', 'Honking doesn’t make the road wider.'], ['पुढे पण माणसंच आहेत, हॉर्न नका वाजवू.', 'Pudhe pan maansach aahet, horn naka vaajvu.', 'There are people ahead too, stop honking.'],
         ['हॉर्नचं बिल तुम्ही भरता का?', 'Horn-cha bill tumhi bharta ka?', 'Do you pay the horn bill?'], ['एवढं वाजवायचं तर ढोल-ताशा पथकात जा.', 'Evdha vaajvaaycha tar dhol-tasha pathkaat ja.', 'If you love making noise, join a dhol-tasha troupe.'],
         ['ऐकलं हो, कान आहेत मला.', 'Aikla ho, kaan aahet mala.', 'I heard you, I have ears.'], ['सिग्नल लाल आहे, उडून जाऊ का?', 'Signal laal aahe, udun jaau ka?', 'The signal’s red, should I fly?'],
         ['हॉर्न वाजवला म्हणून मी गायब होणार नाहीये.', 'Horn vaajavla mhanun mi gaayab honaar naahiye.', 'Honking won’t make me disappear.'], ['शांत व्हा, पुण्यात सगळे उशिराच पोचतात.', 'Shaant vha, Punyaat sagle ushiraach pochtaat.', 'Relax, everyone in Pune reaches late anyway.'],
         ['हा पहिला हॉर्न की शंभरावा?', 'Ha pahila horn ki shambharava?', 'Is that the first honk or the hundredth?'], ['घरी पण असंच ओरडता का?', 'Ghari pan asach orad-ta ka?', 'Do you shout like this at home too?']],
  'hi': [['हॉर्न बजाने से सड़क चौड़ी नहीं होती.', 'Horn bajaane se sadak chaudi nahi hoti.', 'Honking won’t widen the road.'], ['सुन लिया भाई, बहरा नहीं हूँ.', 'Sun liya bhai, behra nahi hoon.', 'I heard, man, I’m not deaf.'],
         ['इतना बजाना है तो बैंड में चला जा.', 'Itna bajaana hai to band mein chala ja.', 'Love playing so much? Join a band.'], ['लाल सिग्नल है, उड़ जाऊँ क्या?', 'Laal signal hai, ud jaaun kya?', 'It’s red, should I fly?'],
         ['धीरज रख, सब पहुँच जाएँगे.', 'Dheeraj rakh, sab pahunch jaayenge.', 'Patience, everyone gets there.'], ['हॉर्न का बिल तू भरता है क्या?', 'Horn ka bill tu bharta hai kya?', 'You paying the horn bill?']],
  'en': [['Honking doesn’t make the road wider, genius.', '', 'Honking doesn’t make the road wider, genius.'], ['Yes, I heard you. The whole city heard you.', '', 'Yes, I heard you. The whole city heard you.'],
         ['It’s red. Should I teleport?', '', 'It’s red. Should I teleport?'], ['Calm down, we’re all late here.', '', 'Calm down, we’re all late here.'],
         ['Is your horn stuck or is it your personality?', '', 'Is your horn stuck or is it your personality?'], ['Love that for you. Really.', '', 'Love that for you. Really.']]},
 'bumped': {
  'mr': [['धक्का देऊन सॉरी म्हणायची पद्धत असते.', 'Dhakka deun sorry mhanaychi paddhat aste.', 'After shoving someone, people say sorry.'], ['फुटपाथ तुमच्या नावावर आहे का?', 'Footpath tumchya naavavar aahe ka?', 'Is the footpath in your name?'],
         ['बघून चाला, डोळे खिशात ठेवलेत का?', 'Baghun chaala, dole khishaat thevlet ka?', 'Watch it, did you leave your eyes in your pocket?'], ['मी काय भिंत आहे का?', 'Mi kay bhint aahe ka?', 'Am I a wall?'],
         ['एवढी गर्दी आहे म्हणून अंगावर यायचं का?', 'Evdhi gardi aahe mhanun angaavar yaaycha ka?', 'Crowded, so you walk right into people?'], ['मोबाईलमध्ये बघत चालणार, मग असंच होणार.', 'Mobile-madhe baghat chaalnaar, mag asach honaar.', 'Walk staring at your phone, this is what happens.'],
         ['सॉरी फुकट आहे, बोलून बघा.', 'Sorry phukat aahe, bolun bagha.', 'Sorry is free, try saying it.'], ['आमच्या वेळी लोक बाजूने चालायचे.', 'Aamchya veli lok baajune chaalaayche.', 'In our day people walked to the side.']],
  'hi': [['धक्का देके सॉरी बोलते हैं.', 'Dhakka deke sorry bolte hain.', 'After a shove, you say sorry.'], ['फुटपाथ तेरे नाम पे है क्या?', 'Footpath tere naam pe hai kya?', 'Footpath registered to you?'],
         ['मैं दीवार हूँ क्या?', 'Main deewaar hoon kya?', 'Am I a wall?'], ['आँखें फ़ोन में, धक्का मुझे.', 'Aankhen phone mein, dhakka mujhe.', 'Eyes in your phone, elbow in me.'], ['सॉरी फ्री है, बोल के देख.', 'Sorry free hai, bol ke dekh.', 'Sorry is free, try it.']],
  'en': [['Wow, no sorry? Cool, cool.', '', 'Wow, no sorry? Cool, cool.'], ['Am I invisible or are you just rude?', '', 'Am I invisible or are you just rude?'],
         ['Eyes up from the phone, champ.', '', 'Eyes up from the phone, champ.'], ['The footpath is not your personal lane.', '', 'The footpath is not your personal lane.'], ['Sorry is free, you know.', '', 'Sorry is free, you know.']]},
 'jam': {
  'mr': [['या ट्रॅफिकमध्ये म्हातारा होणार मी.', 'Ya traffic-madhe mhaatara honaar mi.', 'I’ll grow old in this traffic.'], ['चालत गेलो असतो तर कधीच पोचलो असतो.', 'Chaalat gelo asto tar kadhich pochlo asto.', 'Would’ve been there ages ago on foot.'],
         ['कर्वे रोड म्हणजे पुण्याचं पार्किंग लॉट.', 'Karve Road mhanje Punyaacha parking lot.', 'Karve Road is Pune’s parking lot.'], ['मेट्रोचं काम आणि आमचं आयुष्य, दोन्ही चालूच.', 'Metro-cha kaam aani aamcha aayushya, donhi chaaluch.', 'The metro work and my life, both never-ending.'],
         ['पुढे कोणी तरी गाडी लावून चहा प्यायला गेलाय.', 'Pudhe koni tari gaadi laavun chaha pyaayla gelay.', 'Someone up ahead parked and went for chai.'], ['हॉर्न वाजवून काय होणार, सगळे इथेच आहेत.', 'Horn vaajavun kay honaar, sagle ithech aahet.', 'What’s honking going to do, we’re all stuck here.']],
  'hi': [['इस ट्रैफ़िक में बूढ़ा हो जाऊँगा.', 'Is traffic mein boodha ho jaaunga.', 'I’ll grow old in this traffic.'], ['पैदल जाता तो पहुँच जाता.', 'Paidal jaata to pahunch jaata.', 'Would’ve made it on foot.'],
         ['आगे कोई गाड़ी खड़ी करके चाय पी रहा होगा.', 'Aage koi gaadi khadi karke chai pi raha hoga.', 'Somebody ahead parked for chai, I bet.'], ['मेट्रो कब बनेगी, पोते पूछेंगे.', 'Metro kab banegi, pote poochhenge.', 'My grandkids will ask when the metro gets built.']],
  'en': [['I’ve aged five years in this jam.', '', 'I’ve aged five years in this jam.'], ['Could’ve walked. Could’ve crawled, honestly.', '', 'Could’ve walked. Could’ve crawled, honestly.'],
         ['Pune traffic: where plans go to die.', '', 'Pune traffic: where plans go to die.'], ['Someone up front is definitely having chai.', '', 'Someone up front is definitely having chai.']]},
 'taunt': {
  'mr': [['जास्त हवेत उडू नकोस, खाली यायला वेळ लागत नाही.', 'Jaast havet udu nakos, khaali yaayla vel laagat nahi.', 'Don’t fly too high, coming down doesn’t take long.'], ['तुझ्यासारखे खूप पाहिलेत.', 'Tujhyasaarkhe khoop paahilet.', 'I’ve seen plenty like you.'],
         ['पेठेत येऊन दादागिरी? धाडस आहे.', 'Pethet yeun daadaagiri? Dhaadas aahe.', 'Coming to the peth to act tough? Brave.'], ['एकदा विचार कर, मग हात उचल.', 'Ekda vichaar kar, mag haat uchal.', 'Think once, then raise your hand.'],
         ['चल, ये, बघू किती दम आहे.', 'Chal, ye, baghu kiti dam aahe.', 'Come on, let’s see what you’ve got.'], ['गल्लीतले सगळे बघतायत, लक्षात ठेव.', 'Gallitle sagle baghtaayat, lakshaat thev.', 'The whole lane is watching, remember that.']],
  'hi': [['ज़्यादा हवा में मत उड़.', 'Zyaada hawa mein mat ud.', 'Don’t fly too high.'], ['तेरे जैसे बहुत देखे हैं.', 'Tere jaise bahut dekhe hain.', 'Seen plenty like you.'], ['आ, देखते हैं कितना दम है.', 'Aa, dekhte hain kitna dam hai.', 'Come, let’s see what you’ve got.'], ['सोच ले, फिर हाथ उठा.', 'Soch le, phir haath utha.', 'Think first, then raise your hand.']],
  'en': [['You really want to do this? Here?', '', 'You really want to do this? Here?'], ['Seen tougher guys at a kitty party.', '', 'Seen tougher guys at a kitty party.'], ['Careful. Everyone’s filming.', '', 'Careful. Everyone’s filming.'], ['Go home. Sleep it off.', '', 'Go home. Sleep it off.']]},
}
# their own lines (no opener): said three ways each
OWN = {
 'greet': {
  'mr': [['काय, कसं काय? सगळं ठीक?', 'Kay, kasa kay? Sagla theek?', 'So, how’s it going? All good?'], ['जेवलात का? नसेल तर या घरी.', 'Jevlaat ka? Nasel tar ya ghari.', 'Eaten yet? If not, come home.'], ['बरेच दिवसांनी दिसलात, कुठे गायब?', 'Barech divsaanni disalat, kuthe gaayab?', 'Haven’t seen you in ages, where’d you vanish?'],
         ['नमस्कार, आज लवकर उठलात वाटतं.', 'Namaskar, aaj lavkar uthlaat vaatta.', 'Hello, up early today, I see.'], ['चहा झाला का? चला एक कटिंग.', 'Chaha jhala ka? Chala ek cutting.', 'Had chai? Come, a cutting.'], ['घरचे सगळे मजेत?', 'Gharche sagle majet?', 'Everyone at home doing well?']],
  'hi': [['क्या हाल, सब बढ़िया?', 'Kya haal, sab badhiya?', 'How are things, all good?'], ['खाना खाया? नहीं तो चल.', 'Khaana khaaya? Nahi to chal.', 'Eaten? If not, come along.'], ['बड़े दिनों बाद दिखे!', 'Bade dinon baad dikhe!', 'Long time no see!'], ['चाय पीते हैं एक.', 'Chai peete hain ek.', 'Let’s have a chai.']],
  'en': [['Hey! Long time!', '', 'Hey! Long time!'], ['How’ve you been?', '', 'How’ve you been?'], ['Coffee sometime?', '', 'Coffee sometime?'], ['Look who’s alive!', '', 'Look who’s alive!']]},
 'chat': {
  'mr': [['अरे, चितळ्यांचं दुकान दुपारी एक ते चार बंदच असतं, माहितीये ना.', 'Are, Chitalyancha dukaan dupaari ek te chaar bandach asta, maahitiye na.', 'You know Chitale’s shuts from one to four, right.'],
         ['काल मिसळ खाल्ली, अजून डोळ्यात पाणी आहे.', 'Kaal misal khaalli, ajun dolyaat paani aahe.', 'Had misal yesterday, my eyes are still watering.'], ['पुणेकर उत्तर देत नाहीत, प्रश्न विचारतात.', 'Punekar uttar det naahit, prashna vichaartaat.', 'Punekars don’t answer, they ask questions.'],
         ['मुलगा अमेरिकेत, आम्ही इथे भांडतोय पार्किंगसाठी.', 'Mulga America-t, aamhi ithe bhaandtoy parking-saathi.', 'Son’s in America, we’re here fighting over parking.'], ['सिंहगडला गेलो होतो, पिठलं-भाकरी अप्रतिम.', 'Sinhagad-la gelo hoto, pithla-bhaakri apratim.', 'Went up Sinhagad, the pithla-bhakri was amazing.'],
         ['भाडं बघितलं का कोथरूडचं? सोन्याचं घर वाटतं.', 'Bhaada baghitla ka Kothrud-cha? Sonyaacha ghar vaatta.', 'Seen Kothrud rents? Like houses made of gold.'], ['आमच्या सोसायटीत पाणी दोनच तास येतं.', 'Aamchya society-t paani donach taas yeta.', 'Our society gets water for just two hours.'],
         ['मेट्रो झाली खरी, पण स्टेशनपर्यंत रिक्षा लागते.', 'Metro jhaali khari, pan station-paryant rickshaw laagte.', 'The metro’s done, but you still need an auto to reach it.'], ['पुण्यात दोनच ऋतू: पाऊस आणि खड्डे.', 'Punyaat donach rutu: paaus aani khadde.', 'Pune has two seasons: rain and potholes.'],
         ['काल शनिवारवाड्यावर एवढी गर्दी, पाय ठेवायला जागा नाही.', 'Kaal Shaniwarwadyaavar evdhi gardi, paay thevaayla jaaga nahi.', 'Shaniwar Wada was so crowded yesterday, nowhere to stand.']],
  'hi': [['पुणे में सब सवाल पूछते हैं, जवाब कोई नहीं देता.', 'Pune mein sab sawaal poochhte hain, jawaab koi nahi deta.', 'Everyone in Pune asks questions, nobody answers.'], ['कल मिसळ खाई, आज तक आँखों में पानी है.', 'Kal misal khaayi, aaj tak aankhon mein paani hai.', 'Had misal yesterday, eyes still watering.'],
         ['किराया देखा कोथरूड का? सोने का घर है क्या.', 'Kiraaya dekha Kothrud ka? Sone ka ghar hai kya.', 'Seen Kothrud rents? Houses of gold.'], ['मेट्रो बन गई, स्टेशन तक ऑटो लगता है.', 'Metro ban gayi, station tak auto lagta hai.', 'Metro’s done, need an auto to reach it.'], ['पुणे के दो ही मौसम: बारिश और गड्ढे.', 'Pune ke do hi mausam: baarish aur gaddhe.', 'Pune has two seasons: rain and potholes.']],
  'en': [['KP on a Friday is basically a parking lot with music.', '', 'KP on a Friday is basically a parking lot with music.'], ['Rent in Baner is criminal.', '', 'Rent in Baner is criminal.'],
         ['Pune has two seasons: rain and potholes.', '', 'Pune has two seasons: rain and potholes.'], ['The metro’s done, but you still need an auto to get to it.', '', 'The metro’s done, but you still need an auto to get to it.'], ['German Bakery or Vohuman, there is no third option.', '', 'German Bakery or Vohuman, there is no third option.']]},
 'mutter': {
  'mr': [['काय होणार या शहराचं कोणास ठाऊक.', 'Kay honaar ya shaharaacha konaas thaauk.', 'Who knows what’ll become of this city.'], ['आमच्या वेळी सायकल होती, आणि शांतता होती.', 'Aamchya veli cycle hoti, aani shaantata hoti.', 'In our day we had bicycles, and peace.'],
         ['खड्डा बघून गाडी चालवायची, रस्ता बघून नाही.', 'Khadda baghun gaadi chaalvaaychi, rasta baghun nahi.', 'You drive by the potholes here, not the road.'], ['सगळे घाईत, पोचतं कोणीच वेळेवर नाही.', 'Sagle ghaait, pochta konich velevar nahi.', 'Everyone rushing, nobody arrives on time.'],
         ['आजकालची पोरं, कानात हेडफोन, डोक्यात हवा.', 'Aajkaalchi pora, kaanaat headphone, dokyaat hava.', 'Kids these days: headphones in, heads full of air.'], ['जाऊ दे, आपल्याला काय करायचंय.', 'Jaau de, aaplyala kay karaaychay.', 'Forget it, none of my business.']],
  'hi': [['क्या होगा इस शहर का.', 'Kya hoga is shehar ka.', 'What will become of this city.'], ['सब भाग रहे हैं, पहुँचता कोई नहीं.', 'Sab bhaag rahe hain, pahunchta koi nahi.', 'Everyone running, nobody arriving.'], ['छोड़ो, अपने को क्या.', 'Chhodo, apne ko kya.', 'Forget it, not my business.']],
  'en': [['This city, I swear.', '', 'This city, I swear.'], ['Everyone’s in a hurry to be late.', '', 'Everyone’s in a hurry to be late.'], ['Not my circus.', '', 'Not my circus.']]},
 'respect': {
  'mr': [['तुमच्याबद्दल ऐकलंय, चांगलं केलंत.', 'Tumchyabaddal aiklay, changla kelat.', 'Heard about you. Good on you.'], ['असे लोक हल्ली कमीच.', 'Ase lok halli kamich.', 'People like you are rare these days.'], ['आमच्या गल्लीत तुमचं नाव निघतं.', 'Aamchya gallit tumcha naav nighta.', 'Your name comes up in our lane.'], ['कधीही चहाला या, आमच्याकडे.', 'Kadhihi chahaala ya, aamchyaakade.', 'Come over for chai any time.']],
  'hi': [['आपके बारे में सुना है, अच्छा किया.', 'Aapke baare mein suna hai, achha kiya.', 'Heard about you, well done.'], ['ऐसे लोग कम मिलते हैं.', 'Aise log kam milte hain.', 'People like you are rare.']],
  'en': [['Hey, you’re the one people keep talking about.', '', 'Hey, you’re the one people keep talking about.'], ['Respect, honestly.', '', 'Respect, honestly.']]},
 'fearyou': {
  'mr': [['तोच तो. नजर देऊ नकोस.', 'Toch to. Najar deu nakos.', 'That’s him. Don’t make eye contact.'], ['चल इथून, आत्ता.', 'Chal ithun, aatta.', 'Let’s go. Now.'], ['पोलिसांना फोन करू का?', 'Polisanna phone karu ka?', 'Should I call the police?'], ['मुलांना आत घे, तो आलाय.', 'Mulanna aat ghe, to aalay.', 'Get the kids inside, he’s here.']],
  'hi': [['वही है. आँख मत मिला.', 'Vahi hai. Aankh mat mila.', 'That’s him. Don’t look.'], ['चल यहाँ से.', 'Chal yahan se.', 'Let’s get out of here.']],
  'en': [['That’s the guy. Don’t stare.', '', 'That’s the guy. Don’t stare.'], ['Let’s just go.', '', 'Let’s just go.']]},
 'crash': {
  'mr': [['अरे बापरे! पूर्ण ठोकली!', 'Are baapre! Poorna thokli!', 'Oh my god! Rammed it completely!'], ['बघितलं? हे असंच होणार होतं.', 'Baghitla? He asach honaar hota.', 'See that? This was bound to happen.'], ['कोणाला लागलं नाही ना?', 'Konala laagla nahi na?', 'Nobody hurt, right?'], ['व्हिडिओ काढा, विमा कंपनीला लागेल.', 'Video kaadha, vima companila laagel.', 'Take a video, the insurance will want it.']],
  'hi': [['अरे बाप रे! ठोक दी!', 'Arre baap re! Thok di!', 'Oh god! Rammed it!'], ['किसी को लगी तो नहीं?', 'Kisi ko lagi to nahi?', 'Anyone hurt?']],
  'en': [['Oh my god, they totally crashed!', '', 'Oh my god, they totally crashed!'], ['Everyone okay?!', '', 'Everyone okay?!']]},
 # the weather and the hour, said as lines of their own
 'rain': {
  'mr': [['या पावसात छत्री उलटी होते, माणूस नाही.', 'Ya paavsaat chhatri ulti hote, maanus nahi.', 'In this rain the umbrella flips, not the person.'], ['खड्ड्यात पाणी, पाण्यात खड्डा, कळतच नाही.', 'Khaddyaat paani, paanyaat khadda, kalatach nahi.', 'Water in the pothole or pothole in the water, who can tell.'],
         ['भजी आणि चहा, बस्स, बाकी काही नको.', 'Bhaji aani chaha, bass, baaki kaahi nako.', 'Bhaji and chai, that’s all, nothing else.'], ['सिंहगड रोडला गुडघाभर पाणी साचलंय म्हणे.', 'Sinhagad Road-la gudghabhar paani saachlay mhane.', 'They say Sinhagad Road is knee-deep.'],
         ['पाऊस आला की पुण्याचं ट्रॅफिक अजून रोमँटिक होतं.', 'Paaus aala ki Punyaacha traffic ajun romantic hota.', 'When it rains, Pune traffic gets even more romantic.'], ['कपडे वाळत घातले आणि पाऊस आला, नेहमीचंच.', 'Kapde vaalat ghaatle aani paaus aala, nehmichach.', 'Hung the washing out and it rained, as always.']],
  'hi': [['इस बारिश में छतरी भी हार मान गई.', 'Is baarish mein chhatri bhi haar maan gayi.', 'Even the umbrella gave up in this rain.'], ['पकौड़े और चाय, बस.', 'Pakode aur chai, bas.', 'Pakodas and chai, that’s all.'], ['गड्ढे में पानी है या पानी में गड्ढा?', 'Gaddhe mein paani hai ya paani mein gaddha?', 'Water in the pothole or a pothole in the water?']],
  'en': [['My shoes are a swimming pool now.', '', 'My shoes are a swimming pool now.'], ['Pune rain: romantic for five minutes, then just wet.', '', 'Pune rain: romantic for five minutes, then just wet.'], ['Chai and pakoras, cancel everything.', '', 'Chai and pakoras, cancel everything.']]},
 'heat': {
  'mr': [['या उन्हात अंड रस्त्यावरच फुटेल.', 'Ya unhaat anda rastyaavarach phutel.', 'In this sun you could fry an egg on the road.'], ['उसाचा रस, थंडगार, आत्ताच्या आत्ता.', 'Usaacha ras, thandgaar, aattachya aatta.', 'Sugarcane juice, ice cold, right now.'],
         ['दुपारी बाहेर पडणारे दोनच: कुत्री आणि बाहेरगावचे.', 'Dupaari baaher padnaare donach: kutri aani baahergaavche.', 'Only two kinds go out at noon: dogs and outsiders.'], ['पुण्याची थंड हवा कुठे गेली कोणास ठाऊक.', 'Punyaachi thanda hava kuthe geli konaas thaauk.', 'Where did Pune’s cool air go, who knows.']],
  'hi': [['इस धूप में अंडा सड़क पे पक जाए.', 'Is dhoop mein anda sadak pe pak jaaye.', 'You could cook an egg on the road in this sun.'], ['गन्ने का रस, ठंडा, अभी के अभी.', 'Ganne ka ras, thanda, abhi ke abhi.', 'Sugarcane juice, cold, right now.']],
  'en': [['It’s not hot, it’s a personal attack.', '', 'It’s not hot, it’s a personal attack.'], ['Who said Pune has nice weather?', '', 'Who said Pune has nice weather?']]},
 'night': {
  'mr': [['एवढ्या रात्री कोण फिरतं हो?', 'Evdhya raatri kon phirta ho?', 'Who wanders around this late?'], ['चल लवकर, कुत्री भुंकायला लागली.', 'Chal lavkar, kutri bhunkaayla laagli.', 'Come quick, the dogs have started barking.'],
         ['रात्री दोनला वडापाव, हेच खरं पुणं.', 'Raatri donla vadapav, hech khara Puna.', 'Vada pav at 2 am, that’s the real Pune.'], ['घरी कळलं तर संपलो मी.', 'Ghari kalla tar samplo mi.', 'If they find out at home, I’m finished.']],
  'hi': [['इतनी रात को कौन घूमता है?', 'Itni raat ko kaun ghoomta hai?', 'Who roams around this late?'], ['रात के दो बजे वडापाव, यही असली पुणे.', 'Raat ke do baje vadapav, yahi asli Pune.', 'Vada pav at 2 am, that’s real Pune.']],
  'en': [['Two am vada pav is a personality.', '', 'Two a.m. vada pav is a personality.'], ['If my mom calls, I’m at a friend’s, studying.', '', 'If my mom calls, I’m at a friend’s, studying.']]},
 'fest': {
  'mr': [['यंदा मंडळाचा देखावा भारी आहे म्हणे.', 'Yanda mandalaacha dekhaava bhaari aahe mhane.', 'They say the mandal’s display is amazing this year.'], ['दगडूशेठला दर्शनाला चार तास रांग!', 'Dagdusheth-la darshanaala chaar taas raang!', 'Four hours in line for darshan at Dagdusheth!'],
         ['ढोल-ताशाचा सराव ऐकून झोप उडाली.', 'Dhol-taashaacha saraav aikun jhop udaali.', 'The dhol-tasha practice blew my sleep away.'], ['मोदक किती खाल्ले विचारू नका.', 'Modak kiti khaalle vichaaru naka.', 'Don’t ask how many modaks I ate.'],
         ['विसर्जनाला लक्ष्मी रोड बंद, मग आम्ही घरीच.', 'Visarjanaala Laxmi Road band, mag aamhi gharich.', 'Laxmi Road shut for visarjan, so we’re staying home.']],
  'hi': [['दगडूशेठ में चार घंटे की लाइन!', 'Dagdusheth mein chaar ghante ki line!', 'Four hours in line at Dagdusheth!'], ['मोदक कितने खाए मत पूछो.', 'Modak kitne khaaye mat poochho.', 'Don’t ask how many modaks I ate.']],
  'en': [['Dhol practice at midnight, every night. Love it. Hate it.', '', 'Dhol practice at midnight, every night. Love it. Hate it.'], ['Four hours in line for darshan. Worth it.', '', 'Four hours in line for darshan. Worth it.']]},
 # the famous Puneri patya humour, said out loud
 'patya': {
  'mr': [['इथे पत्ता विचारू नये, आम्हाला पण माहीत नाही.', 'Ithe patta vichaaru naye, aamhaala pan maahit nahi.', 'Don’t ask for directions here, we don’t know either.'], ['दुकान एक ते चार बंद, कारण विचारू नये.', 'Dukaan ek te chaar band, kaaran vichaaru naye.', 'Shop shut one to four. Don’t ask why.'],
         ['सुट्टे पैसे नाहीत, उधारी बंद, आणि हसू नका.', 'Sutte paise naahit, udhaari band, aani hasu naka.', 'No change, no credit, and don’t laugh.'], ['उगाच बेल वाजवू नये, आम्ही ऐकलं तरी उघडणार नाही.', 'Ugaach bell vaajvu naye, aamhi aikla tari ughadnaar nahi.', 'Don’t ring the bell for nothing, we won’t open even if we hear it.'],
         ['पुणेकराला सल्ला देऊ नये, तो आधीच देतो.', 'Punekaraala salla deu naye, to aadhich deto.', 'Don’t advise a Punekar, he’s already advising you.'], ['इथे गाडी लावली तर हवा सोडली जाईल, सोडल्यावर तक्रार करू नये.', 'Ithe gaadi laavli tar hava sodli jaail, sodlyaavar takraar karu naye.', 'Park here and we’ll let your tyres down. Don’t complain after.']],
  'hi': [['यहाँ पता मत पूछो, हमें भी नहीं पता.', 'Yahan pata mat poochho, hamein bhi nahi pata.', 'Don’t ask for directions, we don’t know either.'], ['एक से चार दुकान बंद, क्यों मत पूछो.', 'Ek se chaar dukaan band, kyon mat poochho.', 'Shop shut one to four. Don’t ask why.']],
  'en': [['Pune shops close one to four. It’s a lifestyle.', '', 'Pune shops close one to four. It’s a lifestyle.'], ['Never give a Punekar advice. He’ll give you three back.', '', 'Never give a Punekar advice. He’ll give you three back.']]},
}
FEEL = {
 'nearmiss': ['outraged, shouting, the voice cracking', 'sarcastic, loud and cutting', 'shaken, half laughing, half furious'],
 'honked': ['sarcastic, rolling the eyes', 'annoyed, snapping back', 'dry and deadpan'],
 'bumped': ['offended, sharp', 'sarcastic and pointed', 'irritated, muttering loudly'],
 'jam': ['fed up, sighing', 'sarcastic, half laughing', 'grumbling, defeated'],
 'taunt': ['aggressive, chest out', 'menacing, quiet and cold', 'mocking, smirking'],
 'greet': ['warmly, with a smile', 'cheerfully, loud and friendly', 'teasingly, affectionate'],
 'chat': ['chatting easily, amused', 'gossiping, leaning in', 'complaining happily'],
 'mutter': ['grumbling under the breath', 'muttering, shaking the head', 'dry and resigned'],
 'respect': ['admiringly, warm', 'respectfully, nodding', 'impressed, a little shy'],
 'fearyou': ['warily, low and quick', 'frightened, whispering', 'nervous, hurrying'],
 'crash': ['shocked, breathless', 'excited, gossipy', 'worried, urgent'],
 'rain': ['amused, wet and laughing', 'grumbling, soaked', 'dreamy, romantic about the rain'],
 'heat': ['exhausted, fanning themselves', 'grumbling, sweaty', 'dramatic, mock-suffering'],
 'night': ['hushed, conspiratorial', 'tired and giggly', 'nervous, glancing around'],
 'fest': ['excited, festive', 'proud, a little boastful', 'tired but happy'],
 'patya': ['deadpan, completely serious', 'proudly Puneri, matter-of-fact', 'dry, with a straight face'],
}
CTXD = {'rain': 'Heavy rain is falling around them.', 'heat': 'It is a scorching summer afternoon.', 'night': 'It is late at night on an empty street.', 'fest': 'It is Ganeshotsav, dhol and crowds around.'}
TAIL = 'Natural and playful, acted like a real Punekar on the street, not read aloud. The recording is of very high quality, with the voice sounding clear and very close up, almost no background noise.'
def desc(spk, who, pitch, pace, feel, ctx, en):
    return f"{spk} speaks {feel}, {pitch} in pitch, at a {pace} pace: {who}. {CTXD.get(ctx, '')} The line means: \"{en}\". {TAIL}".replace('  ', ' ')

jobs, table = [], {}
for who, (L, g, age, spk, pitch, pace, wdesc, opens) in P.items():
    T = table[who] = {}
    who_full = f'{wdesc} ({g}, {age})'
    for mom, langs in ROAST.items():
        lines = langs[L]; T[mom] = []
        for oi, (o, orr, oe) in enumerate(opens):
            for li, (t, r, e) in enumerate(lines):
                text, sub, en = f'{o} {t}', f'{orr} {r}'.strip(), f'{oe} {e}'
                for k in range(3):                       # three deliveries: outraged, sarcastic, shaken (or the like)
                    jid = f'vb2_{who}_{mom}_{len(T[mom])}'
                    T[mom].append([sub or text, en])
                    jobs.append({'id': jid, 'who': who, 'moment': mom, 'lang': L, 'speaker': spk, 'text': text, 'desc': desc(spk, who_full, pitch, pace, FEEL[mom][k], '', en)})
    for mom, langs in OWN.items():
        lines = langs[L]; T[mom] = []
        for li, (t, r, e) in enumerate(lines):
            for k in range(3):
                feel = FEEL[mom][k]
                jid = f'vb2_{who}_{mom}_{len(T[mom])}'
                T[mom].append([r or t, e])
                jobs.append({'id': jid, 'who': who, 'moment': mom, 'lang': L, 'speaker': spk, 'text': t, 'desc': desc(spk, who_full, pitch, pace, feel, mom if mom in CTXD else '', e)})
json.dump(jobs, open(os.path.join(ROOT, 'tools/voice_bank2.json'), 'w'), ensure_ascii=False, indent=0)
json.dump(table, open(os.path.join(ROOT, 'assets/voice_bank2_lines.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(len(jobs), 'lines'); print(Counter(j['lang'] for j in jobs)); print(Counter(j['moment'] for j in jobs).most_common())
