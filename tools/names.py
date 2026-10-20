# Shop / brand naming for the baker: GTA-style parody names for real businesses, and
# English -> Marathi (Devanagari) rendering from a curated dictionary. Words we don't know are
# left out of the Marathi line instead of being guessed (a wrong Marathi spelling looks worse
# than a shorter board).
import re, hashlib

# real name (lower-case substring) -> (parody English, Marathi)
CURATED = [
    ('vaishali', ('Vaishnavi', 'वैष्णवी')), ('roopali', ('Rupaali', 'रुपाली')), ('rupali', ('Rupaali', 'रुपाली')),
    ('wadeshwar', ('Wadeshwari', 'वडेश्वरी')), ('goodluck', ('Goodlook Café', 'गुडलूक कॅफे')),
    ('good luck', ('Goodlook Café', 'गुडलूक कॅफे')), ('chitale', ('Chitre Bandhu', 'चित्रे बंधू')),
    ('kayani', ('Kayaani Bakery', 'कयानी बेकरी')), ('german bakery', ('Germane Bakery', 'जर्मेन बेकरी')),
    ('blue tokai', ('Blue Toucan Coffee', 'ब्लू टूकन कॉफी')), ('starbucks', ('Starbeans Coffee', 'स्टारबीन्स कॉफी')),
    ('mcdonald', ("McDougal's", 'मॅकडूगल्स')), ('domino', ("Domingo's Pizza", 'डोमिंगोज पिझ्झा')),
    ('kfc', ('KFG Chicken', 'केएफजी चिकन')), ('burger king', ('Burger Kingdom', 'बर्गर किंगडम')),
    ('subway', ('Subwhey', 'सबव्हे')), ('pizza hut', ('Pizza Hutch', 'पिझ्झा हच')),
    ('cafe coffee day', ('Café Coffee Daily', 'कॅफे कॉफी डेली')), ('ccd', ('Café Coffee Daily', 'कॅफे कॉफी डेली')),
    ('barbeque nation', ('Barbecue Nations', 'बार्बेक्यू नेशन्स')), ('haldiram', ("Haldimar's", 'हल्दीमार्स')),
    ('naturals', ('Naturelle Ice Cream', 'नॅचरेल आईस्क्रीम')), ('baskin', ('Baskin Bobbins', 'बास्किन बॉबिन्स')),
    ('dorabjee', ('Dorabji & Sons', 'दोराबजी अँड सन्स')), ('marz', ('Marz-o-Lin', 'मार्झ-ओ-लिन')),
    ("dario", ("Mario's", 'मारियोज')), ('effingut', ('Effin Hops', 'एफिन हॉप्स')),
    ('malaka', ('Malacca Spice', 'मलाक्का स्पाइस')), ('arthur', ("Arthur's Scheme", 'आर्थर्स स्कीम')),
    ('hdfc', ('HDCF Bank', 'एचडीसीएफ बँक')), ('icici', ('ICIC Bank', 'आयसीआयसी बँक')),
    ('state bank', ('Rashtriya State Bank', 'राष्ट्रीय स्टेट बँक')), ('sbi', ('Rashtriya State Bank', 'राष्ट्रीय स्टेट बँक')),
    ('axis', ('Apex Bank', 'ॲपेक्स बँक')), ('bank of maharashtra', ('Bank of Mahadesh', 'बँक ऑफ महादेश')),
    ('kotak', ('Kotaq Bank', 'कोटक बँक')), ('cosmos', ('Kosmos Sahakari Bank', 'कॉसमॉस सहकारी बँक')),
    ('canara', ('Kanara Bank', 'कनारा बँक')), ('union bank', ('Unity Bank', 'युनिटी बँक')),
    ('punjab national', ('Punjab Nation Bank', 'पंजाब नेशन बँक')), ('syndicate', ('Syndicated Bank', 'सिंडिकेटेड बँक')),
    ('yes bank', ('No Bank', 'नो बँक')), ('indusind', ('IndusLand Bank', 'इंडसलँड बँक')),
    ('apollo pharmacy', ('Apolo Pharmacy', 'अपोलो फार्मसी')), ('bata', ('Batta Shoes', 'बाटा शूज')),
    ('reliance', ('Reliant Fresh', 'रिलायंट फ्रेश')), ('dmart', ('DeeMart', 'डीमार्ट')), ('d-mart', ('DeeMart', 'डीमार्ट')),
    ('big bazaar', ('Big Bazar', 'बिग बझार')), ('zara', ('Zaara', 'झारा')), ('westside', ('Eastside', 'ईस्टसाइड')),
    ('pantaloons', ('Pantaloonz', 'पँटलून्झ')), ('crossword', ('Crossworld Books', 'क्रॉसवर्ल्ड बुक्स')),
    ('kalyan jewel', ('Kalyani Jewellers', 'कल्याणी ज्वेलर्स')), ('p n gadgil', ('PN Gadkari Jewellers', 'पु. ना. गडकरी ज्वेलर्स')),
    ('png', ('PN Gadkari Jewellers', 'पु. ना. गडकरी ज्वेलर्स')), ('chandukaka', ('Chandumama Saraf', 'चंदूमामा सराफ')),
    ('tanishq', ('Tanishka', 'तनिष्का')), ('jio', ('Jiyo Store', 'जियो स्टोअर')), ('airtel', ('Airtell', 'एअरटेल')),
    ('vodafone', ('Vee Mobile', 'व्ही मोबाईल')), ('samsung', ('Samsong', 'सॅमसाँग')), ('croma', ('Chroma', 'क्रोमा')),
    ('vijay sales', ('Vijay Sale', 'विजय सेल')), ('sujata', ('Sujeeta Mastani', 'सुजीता मस्तानी')),
    ('kaka halwai', ('Mama Halwai', 'मामा हलवाई')), ('bedekar', ('Bhedekar Misal', 'भेडेकर मिसळ')),
    ('alka', ('Alpa Talkies', 'अल्पा टॉकीज')), ('hard rock', ('Soft Rock Café', 'सॉफ्ट रॉक कॅफे')),
    ('high spirits', ('High Spirit', 'हाय स्पिरिट')), ('flour works', ('The Flower Works', 'द फ्लॉवर वर्क्स')),
    ('le plaisir', ('Le Plaisant', 'ल प्लेझां')), ('pagdandi', ('Pagdandee Books', 'पगडंडी बुक्स')),
    ('monginis', ('Mongeenies Cakes', 'मोंगिनीज केक्स')), ('swiggy', ('Swoggy', 'स्वॉगी')), ('zomato', ('Zomaato', 'झोमाटो')),
    ('the bombay store', ('The Bambai Store', 'द बंबई स्टोअर')), ('fabindia', ('FabBharat', 'फॅबभारत')),
    ('decathlon', ('Pentathlon Sports', 'पेंटॅथलॉन स्पोर्ट्स')), ('nike', ('Nyke', 'नाइक')), ('adidas', ('Adidaas', 'अदिदास')),
    ('puma', ('Pumaa', 'पुमा')), ('levi', ("Levy's Jeans", 'लेव्हीज जीन्स')), ('raymond', ('Raymund', 'रेमंड')),
    ('bikanervala', ('Bikanerwale', 'बिकानेरवाले')), ('aroma', ('Aromaa', 'अरोमा')), ('shree krishna', ('Shree Krishna', 'श्री कृष्ण')),
]

# English shop words -> Marathi as written on Pune boards
WORDS = {
    'cafe': 'कॅफे', 'café': 'कॅफे', 'restaurant': 'रेस्टॉरंट', 'hotel': 'हॉटेल', 'bakery': 'बेकरी', 'bakers': 'बेकर्स',
    'sweets': 'स्वीट्स', 'sweet': 'स्वीट', 'mart': 'मार्ट', 'medical': 'मेडिकल', 'medicals': 'मेडिकल्स', 'pharmacy': 'फार्मसी',
    'chemist': 'केमिस्ट', 'chemists': 'केमिस्ट्स', 'jewellers': 'ज्वेलर्स', 'jewellery': 'ज्वेलरी', 'fashion': 'फॅशन',
    'fashions': 'फॅशन्स', 'mobile': 'मोबाईल', 'mobiles': 'मोबाईल्स', 'house': 'हाउस', 'corner': 'कॉर्नर', 'centre': 'सेंटर',
    'center': 'सेंटर', 'garden': 'गार्डन', 'bar': 'बार', 'kitchen': 'किचन', 'pizza': 'पिझ्झा', 'coffee': 'कॉफी', 'tea': 'टी',
    'chai': 'चहा', 'juice': 'ज्यूस', 'momos': 'मोमोज', 'misal': 'मिसळ', 'vada': 'वडा', 'pav': 'पाव', 'bhel': 'भेळ',
    'snacks': 'स्नॅक्स', 'dosa': 'डोसा', 'the': 'द', 'and': 'अँड', '&': 'अँड', 'sons': 'सन्स', 'brothers': 'ब्रदर्स',
    'bros': 'ब्रदर्स', 'enterprises': 'एंटरप्रायझेस', 'traders': 'ट्रेडर्स', 'general': 'जनरल', 'stores': 'स्टोअर्स',
    'store': 'स्टोअर', 'provision': 'प्रोव्हिजन', 'clinic': 'क्लिनिक', 'hospital': 'हॉस्पिटल', 'lodge': 'लॉज',
    'lodging': 'लॉजिंग', 'boarding': 'बोर्डिंग', 'travels': 'ट्रॅव्हल्स', 'tours': 'टूर्स', 'electronics': 'इलेक्ट्रॉनिक्स',
    'opticians': 'ऑप्टिशियन्स', 'optician': 'ऑप्टिशियन', 'salon': 'सलून', 'saloon': 'सलून', 'beauty': 'ब्युटी',
    'parlour': 'पार्लर', 'gym': 'जिम', 'fitness': 'फिटनेस', 'books': 'बुक्स', 'book': 'बुक', 'stationery': 'स्टेशनरी',
    'xerox': 'झेरॉक्स', 'foods': 'फूड्स', 'food': 'फूड', 'family': 'फॅमिली', 'veg': 'व्हेज', 'pure': 'प्युअर',
    'shree': 'श्री', 'shri': 'श्री', 'sri': 'श्री', 'new': 'न्यू', 'royal': 'रॉयल', 'star': 'स्टार', 'city': 'सिटी',
    'point': 'पॉइंट', 'plaza': 'प्लाझा', 'mall': 'मॉल', 'palace': 'पॅलेस', 'world': 'वर्ल्ड', 'express': 'एक्सप्रेस',
    'bank': 'बँक', 'sahakari': 'सहकारी', 'shoes': 'शूज', 'footwear': 'फूटवेअर', 'cloth': 'क्लॉथ', 'textiles': 'टेक्स्टाइल्स',
    'sarees': 'साड्या', 'saree': 'साडी', 'kirana': 'किराणा', 'dairy': 'डेअरी', 'tailors': 'टेलर्स', 'hardware': 'हार्डवेअर',
    'paints': 'पेंट्स', 'auto': 'ऑटो', 'garage': 'गॅरेज', 'motors': 'मोटर्स', 'wines': 'वाइन्स', 'beer': 'बिअर', 'shop': 'शॉप',
    'mastani': 'मस्तानी', 'misalghar': 'मिसळघर', 'amruttulya': 'अमृततुल्य', 'chinese': 'चायनीज', 'biryani': 'बिर्याणी',
    'house.': 'हाउस', 'collection': 'कलेक्शन', 'mens': 'मेन्स', "men's": 'मेन्स', 'ladies': 'लेडीज', 'kids': 'किड्स',
    'wear': 'वेअर', 'gift': 'गिफ्ट', 'gifts': 'गिफ्ट्स', 'photo': 'फोटो', 'studio': 'स्टुडिओ', 'classes': 'क्लासेस',
    'academy': 'अकॅडमी', 'institute': 'इन्स्टिट्यूट', 'tuition': 'ट्यूशन', 'computers': 'कॉम्प्युटर्स', 'cake': 'केक',
    'cakes': 'केक्स', 'ice': 'आईस', 'cream': 'क्रीम', 'creamery': 'क्रीमरी', 'grill': 'ग्रिल', 'bistro': 'बिस्ट्रो',
    'brewery': 'ब्रुअरी', 'lounge': 'लाउंज', 'diner': 'डायनर', 'pub': 'पब', 'wine': 'वाइन', 'spa': 'स्पा', 'boutique': 'बुटीक',
    'farm': 'फार्म', 'fresh': 'फ्रेश', 'meat': 'मीट', 'chicken': 'चिकन', 'mutton': 'मटण', 'fish': 'फिश', 'fruits': 'फ्रुट्स',
    'vegetables': 'भाजीपाला', 'flowers': 'फुले', 'florist': 'फ्लोरिस्ट', 'puja': 'पूजा', 'bhandar': 'भांडार',
    'mithaiwale': 'मिठाईवाले', 'halwai': 'हलवाई', 'saraf': 'सराफ', 'vastra': 'वस्त्र', 'dalan': 'दालन',
}
# common Indian name words used in shop names
NAMEWORDS = {
    'ganesh': 'गणेश', 'ganesha': 'गणेश', 'gajanan': 'गजानन', 'krishna': 'कृष्ण', 'laxmi': 'लक्ष्मी', 'lakshmi': 'लक्ष्मी',
    'mahalaxmi': 'महालक्ष्मी', 'durga': 'दुर्गा', 'sai': 'साई', 'om': 'ॐ', 'balaji': 'बालाजी', 'hanuman': 'हनुमान',
    'siddhivinayak': 'सिद्धिविनायक', 'mauli': 'माऊली', 'vitthal': 'विठ्ठल', 'datta': 'दत्त', 'samarth': 'समर्थ',
    'swami': 'स्वामी', 'raj': 'राज', 'raja': 'राजा', 'rani': 'राणी', 'patil': 'पाटील', 'joshi': 'जोशी', 'kulkarni': 'कुलकर्णी',
    'deshpande': 'देशपांडे', 'gokhale': 'गोखले', 'apte': 'आपटे', 'kelkar': 'केळकर', 'bhide': 'भिडे', 'pawar': 'पवार',
    'jadhav': 'जाधव', 'shinde': 'शिंदे', 'more': 'मोरे', 'kale': 'काळे', 'gaikwad': 'गायकवाड', 'bhosale': 'भोसले',
    'mane': 'माने', 'sathe': 'साठे', 'mehta': 'मेहता', 'shah': 'शाह', 'jain': 'जैन', 'agarwal': 'अगरवाल', 'gupta': 'गुप्ता',
    'sharma': 'शर्मा', 'singh': 'सिंग', 'khan': 'खान', 'ali': 'अली', 'shaikh': 'शेख', 'irani': 'इराणी', 'sagar': 'सागर',
    'amrut': 'अमृत', 'anand': 'आनंद', 'ashirwad': 'आशीर्वाद', 'prasad': 'प्रसाद', 'ganga': 'गंगा', 'yamuna': 'यमुना',
    'kaveri': 'कावेरी', 'narmada': 'नर्मदा', 'godavari': 'गोदावरी', 'sahyadri': 'सह्याद्री', 'shivneri': 'शिवनेरी',
    'sinhagad': 'सिंहगड', 'kohinoor': 'कोहिनूर', 'moti': 'मोती', 'heera': 'हिरा', 'navratna': 'नवरत्न', 'mangal': 'मंगल',
    'shubham': 'शुभम', 'kalpana': 'कल्पना', 'saraswati': 'सरस्वती', 'sangam': 'संगम', 'milan': 'मिलन', 'kamal': 'कमल',
    'gulab': 'गुलाब', 'chandan': 'चंदन', 'sundar': 'सुंदर', 'annapurna': 'अन्नपूर्णा', 'jai': 'जय', 'vijay': 'विजय',
    'bharat': 'भारत', 'hind': 'हिंद', 'maharashtra': 'महाराष्ट्र', 'pune': 'पुणे', 'poona': 'पूना', 'deccan': 'डेक्कन',
    'kesari': 'केसरी', 'shivaji': 'शिवाजी', 'sambhaji': 'संभाजी', 'tilak': 'टिळक', 'peshwa': 'पेशवा', 'mahadev': 'महादेव',
    'shankar': 'शंकर', 'ram': 'राम', 'rama': 'राम', 'sita': 'सीता', 'radha': 'राधा', 'gopal': 'गोपाळ', 'govind': 'गोविंद',
    'madhav': 'माधव', 'vishnu': 'विष्णू', 'surya': 'सूर्य', 'chandra': 'चंद्र', 'tara': 'तारा', 'priya': 'प्रिया',
    'pooja': 'पूजा', 'neha': 'नेहा', 'sneha': 'स्नेहा', 'kiran': 'किरण', 'amar': 'अमर', 'akbar': 'अकबर', 'anthony': 'अँथनी',
    'new': 'न्यू', 'navi': 'नवी', 'nava': 'नवा', 'jagdamba': 'जगदंबा', 'bhavani': 'भवानी', 'tulja': 'तुळजा', 'ekvira': 'एकवीरा',
    'renuka': 'रेणुका', 'kalika': 'कालिका', 'shiv': 'शिव', 'shiva': 'शिव', 'parvati': 'पार्वती', 'nandi': 'नंदी',
    'guru': 'गुरू', 'kripa': 'कृपा', 'krupa': 'कृपा', 'dhan': 'धन', 'shree krishna': 'श्री कृष्ण', 'vaishnavi': 'वैष्णवी',
    'mahesh': 'महेश', 'suresh': 'सुरेश', 'ramesh': 'रमेश', 'dinesh': 'दिनेश', 'prakash': 'प्रकाश', 'santosh': 'संतोष',
    'sunil': 'सुनील', 'anil': 'अनिल', 'ajit': 'अजित', 'sachin': 'सचिन', 'rahul': 'राहुल', 'rohit': 'रोहित', 'amit': 'अमित',
}
CAT_MR = {
    'food': 'उपाहारगृह', 'cafe': 'कॅफे', 'sweets': 'मिठाई', 'bakery': 'बेकरी', 'bank': 'बँक', 'atm': 'एटीएम',
    'pharmacy': 'मेडिकल', 'clothes': 'कपडे', 'shoes': 'चप्पल-बूट', 'jewellery': 'सराफ', 'mobile': 'मोबाईल', 'books': 'पुस्तके',
    'hotel': 'हॉटेल', 'bar': 'बार', 'grocery': 'किराणा', 'hardware': 'हार्डवेअर', 'salon': 'सलून', 'optician': 'चष्मे',
    'electronics': 'इलेक्ट्रॉनिक्स', 'travel': 'ट्रॅव्हल्स', 'generic': 'दुकान', 'clinic': 'दवाखाना', 'icecream': 'आईस्क्रीम',
}

def _h(s):
    return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)

def parody_word(w):
    """Small deterministic spelling change, so the name reads 'almost' real."""
    lw = w.lower()
    if lw in WORDS or len(w) < 4 or not w.isalpha():
        return w
    h = _h(lw)
    subs = [('ee', 'i'), ('oo', 'u'), ('ph', 'f'), ('ck', 'kk'), ('c', 'k'), ('i', 'ee'), ('u', 'oo'), ('a', 'aa'), ('y', 'i'), ('s', 'z')]
    for k in range(len(subs)):
        a, b = subs[(h + k) % len(subs)]
        idx = lw.find(a, 1)
        if idx > 0:
            out = w[:idx] + b + w[idx + len(a):]
            return out[0].upper() + out[1:] if w[0].isupper() else out
    return w + 'e'

def to_marathi(name):
    """Marathi line from known words only; returns '' if any distinctive word is unknown."""
    toks = re.findall(r"[A-Za-z][A-Za-z'.-]*|&", name)
    out = []
    for t in toks:
        lt = t.lower().strip('.')
        if lt in WORDS: out.append(WORDS[lt])
        elif lt in NAMEWORDS: out.append(NAMEWORDS[lt])
        else: return ''
    return ' '.join(out)

def parody(name, cat='generic'):
    lname = name.lower()
    for key, (en, mr) in CURATED:
        if key in lname:
            return en, mr
    words = name.split()
    # keep generic words, tweak one distinctive word (the first non-generic one)
    out = []
    changed = False
    for w in words:
        if not changed and w.lower() not in WORDS and w.lower() not in NAMEWORDS and len(w) >= 4 and w.isalpha():
            out.append(parody_word(w)); changed = True
        else:
            out.append(w)
    en = ' '.join(out)
    mr = to_marathi(en)
    if not mr:
        mr = CAT_MR.get(cat, '')
    return en, mr
