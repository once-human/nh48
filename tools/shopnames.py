# Shop naming for the shop baker.
#  * clean(): turns a raw Overture/OSM place name into what would be painted on the board
#    ("Pepperfry Home Furniture, Mattress & Decor Shop in S.B Road" -> "Pepperfry Home Furniture").
#  * brand_parody(): GTA-style parody for chains and well-known Pune names, matched on word
#    boundaries so "Batata Vada" never turns into a shoe shop.
#  * local_parody(): one small spelling change for an ordinary local shop.
#  * Filler: realistic invented names for frontages no dataset knows about, built only from words
#    whose Marathi spelling we know, so every board is properly bilingual.
import re, unicodedata, hashlib
from names import CURATED, WORDS, NAMEWORDS, CAT_MR, parody_word, to_marathi

def _h(*a):
    return int(hashlib.md5('|'.join(map(str, a)).encode()).hexdigest()[:8], 16)

# ---------------------------------------------------------------- brand parodies
# extra chains seen in the Pune data (Overture brands), on top of names.CURATED
BRANDS = [
    ('bank of baroda', ('Bank of Bharoda', 'बँक ऑफ भरोडा')), ('bank of india', ('Bank of Bharat', 'बँक ऑफ भारत')),
    ('idbi', ('IBDI Bank', 'आयबीडीआय बँक')), ('oyo', ('OYE Rooms', 'ओये रूम्स')), ('benetton', ('United Colours of Benetto', 'युनायटेड कलर्स ऑफ बेनेटो')),
    ('lifestyle', ('Lyfestyle', 'लाइफस्टाइल')), ('smart bazaar', ('Smaart Bazaar', 'स्मार्ट बझार')), ('wellness forever', ('Wellness Furever', 'वेलनेस फरेव्हर')),
    ('ranka', ('Rankaa Jewellers', 'रांका ज्वेलर्स')), ('jockey', ('Jokey', 'जॉकी')), ('titan eye', ('Tytan Eyeplus', 'टायटन आयप्लस')),
    ('titan', ('Tytan', 'टायटन')), ('third wave', ('Fourth Wave Coffee', 'फोर्थ वेव्ह कॉफी')), ('mad over donuts', ('Mad About Donuts', 'मॅड अबाउट डोनट्स')),
    ('archies', ('Archees Gifts', 'आर्चीज गिफ्ट्स')), ('keventers', ('Keventors', 'केव्हेंटर्स')), ("gold's gym", ("Bold's Gym", 'बोल्ड्स जिम')),
    ('louis philippe', ('Louis Phillipe', 'लुई फिलिप')), ('van heusen', ('Van Housen', 'व्हॅन हाउसन')), ('u.s. polo', ('U.S. Pollo Assn.', 'यू.एस. पोलो')),
    ('us polo', ('U.S. Pollo Assn.', 'यू.एस. पोलो')), ('pepe jeans', ('Pepe Jeanz', 'पेपे जीन्स')), ('converse', ('Konverse', 'कॉन्व्हर्स')),
    ('irish house', ('The Scottish House', 'द स्कॉटिश हाउस')), ('lenskart', ('Lenscart', 'लेन्सकार्ट')), ('metropolis', ('Metropoliz Labs', 'मेट्रोपोलिझ लॅब्स')),
    ('shoppers stop', ('Shoppers Halt', 'शॉपर्स हॉल्ट')), ('celio', ('Celeo', 'सेलिओ')), ('m.a.c', ('MEC Cosmetics', 'मेक कॉस्मेटिक्स')),
    ('mac cosmetics', ('MEC Cosmetics', 'मेक कॉस्मेटिक्स')), ('mufti', ('Mufty', 'मुफ्ती')), ('senco', ('Senko Gold', 'सेंको गोल्ड')),
    ('global desi', ('Global Deshi', 'ग्लोबल देसी')), ('globaldesi', ('Global Deshi', 'ग्लोबल देसी')), ('indian oil', ('Indian Oyl', 'इंडियन ऑइल')),
    ('karachi sweets', ('Karachee Sweets', 'कराची स्वीट्स')), ('idea cellular', ('Ideaa Mobile', 'आयडिया मोबाईल')), ('sleepwell', ('Sleepwel', 'स्लीपवेल')),
    ('panasonic', ('Panasonix', 'पॅनासोनिक्स')), ('pepperfry', ('Peppercry', 'पेपरक्राय')), ('natural ice', ('Naturelle Ice Cream', 'नॅचरेल आईस्क्रीम')),
    ('acer', ('Acerr', 'एसर')), ('sony', ('Sonny', 'सोनी')), ('wow! momo', ('Wah! Momo', 'वाह! मोमो')), ('wow momo', ('Wah! Momo', 'वाह! मोमो')),
    ('levis', ("Levy's Jeans", 'लेव्हीज जीन्स')), ('raymond', ('Raymund', 'रेमंड')), ('kwality', ('Qwality', 'क्वालिटी')),
    ('mainland china', ('Mainland Chyna', 'मेनलँड चायना')), ('chitale bandhu', ('Chitre Bandhu', 'चित्रे बंधू')), ('wadeshwar', ('Wadeshwari', 'वडेश्वरी')),
    ('the chocolate room', ('The Chocolate Rum', 'द चॉकलेट रम')), ('the mills social', ('The Mills Sociable', 'द मिल्स सोशिएबल')),
    ('reliance digital', ('Reliant Digital', 'रिलायंट डिजिटल')), ('reliance trends', ('Reliant Trendz', 'रिलायंट ट्रेंड्झ')), ('reliance smart', ('Reliant Smart', 'रिलायंट स्मार्ट')),
    ('crocs', ('Croks', 'क्रॉक्स')), ('idfc', ('IFDC First Bank', 'आयएफडीसी फर्स्ट बँक')), ('metro shoes', ('Metro Shooz', 'मेट्रो शूज')),
    ('toni & guy', ('Tony & Gai', 'टोनी अँड गाय')), ('toni and guy', ('Tony & Gai', 'टोनी अँड गाय')), ('liberty', ('Libberty Shoes', 'लिबर्टी शूज')),
    ('woodland', ('Wudland', 'वुडलँड')), ('reebok', ('Reebuk', 'रीबुक')), ('skechers', ('Sketchers', 'स्केचर्स')), ('biba', ('Bibaa', 'बीबा')),
    ('allen solly', ('Alan Solly', 'ॲलन सॉली')), ('peter england', ('Peter Ingland', 'पीटर इंग्लंड')), ('manyavar', ('Manyawar', 'मान्यवर')),
    ('max fashion', ('Maxx Fashion', 'मॅक्स फॅशन')), ('vero moda', ('Vera Moda', 'व्हेरा मोडा')), ('jack & jones', ('Jack & Jonas', 'जॅक अँड जोनास')),
    ('h&m', ('M&H', 'एम अँड एच')), ('mi store', ('Mee Store', 'मी स्टोअर')), ('oneplus', ('OnePlas', 'वनप्लस')), ('oppo', ('Opo', 'ओपो')),
    ('vivo', ('Veevo', 'व्हिवो')), ('realme', ('RealMee', 'रिअलमी')), ('theobroma', ('Theobrama', 'थिओब्रामा')), ('chaayos', ('Chaiyos', 'चायोस')),
    ('chai point', ('Chai Pointe', 'चाय पॉइंट')), ('barista', ('Baristo', 'बरिस्टो')), ('costa coffee', ('Kosta Coffee', 'कोस्टा कॉफी')),
    ('dunkin', ("Dunkan' Donuts", 'डंकन डोनट्स')), ('faasos', ('Faasoz', 'फासोझ')), ('behrouz', ('Behrooz Biryani', 'बेहरूझ बिर्याणी')),
    ('vohuman', ('Vohooman Cafe', 'वोहूमन कॅफे')), ('durvankur', ('Doorvankur Thali', 'दूर्वांकुर थाळी')), ('shreyas', ('Shreeyas', 'श्रीयस')),
    ('katakirr', ('Katakkirr Misal', 'कटाक्किर मिसळ')), ('joshi wadewale', ('Joshee Wadewale', 'जोशी वडेवाले')), ('garden vada pav', ('Gardenia Vada Pav', 'गार्डेनिया वडा पाव')),
    ('jj garden', ('JJ Gardenia Vada Pav', 'जेजे गार्डेनिया वडा पाव')), ('shabree', ('Shabari', 'शबरी')), ('janakiraman', ('Janaki Raman', 'जानकी रमण')),
    ('apple store', ('Pear Store', 'पेअर स्टोअर')), ('w for woman', ('Double-U for Woman', 'डब्ल्यू फॉर वुमन')), ('total', ('Totall', 'टोटल')),
    ('sunglass hut', ('Sunglass Hutt', 'सनग्लास हट')), ('hush puppies', ('Hush Puppys', 'हश पपीज')), ('mochi', ('Mochee Shoes', 'मोची शूज')),
    ('asian paints', ('Asean Paints', 'एशियन पेंट्स')), ('timex', ('Tymex', 'टायमेक्स')), ('hp world', ('HQ World', 'एचक्यू वर्ल्ड')),
    ('merino', ('Marino Laminates', 'मरिनो लॅमिनेट्स')), ('zo rooms', ('Yo Rooms', 'यो रूम्स')),
    ('dominos', ("Domingo's Pizza", 'डोमिंगोज पिझ्झा')), ('mc donald', ("McDougal's", 'मॅकडूगल्स')),
]
SHORT = {'kfc', 'sbi', 'png', 'jio', 'ccd', 'bata', 'axis', 'puma', 'nike', 'zara', 'oyo', 'acer', 'sony', 'marz', 'alka', 'levi', 'idbi', 'hdfc', 'total', 'mochi', 'biba', 'oppo', 'vivo'}
_ALL = BRANDS + CURATED

def _strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))

def brand_parody(name):
    low = _strip_accents(name).lower()
    for key, val in _ALL:
        k = re.escape(key)
        pat = r'(?<![a-z])' + k + (r'(?![a-z])' if (key in SHORT or len(key) <= 4) else '')
        if re.search(pat, low):
            return val
    return None

# ---------------------------------------------------------------- cleaning raw names
_CUT = re.compile(r'\s*(?:\||–|—| - |,|\(|@|:|;| near | opp\.? | opposite | in [A-Z][a-z]+ (?:Road|Peth|Park)).*$')
_TAIL = re.compile(r'(?:\s+(?:pune|poona|deccan|camp|f\.?\s?c\.?\s?road|j\.?\s?m\.?\s?road|koregaon park|kp|shivajinagar|'
                   r'sadashiv peth|narayan peth|shaniwar peth|budhwar peth|kasba peth|navi peth|ravivar peth|branch|'
                   r'pvt\.?|ltd\.?|private|limited|llp|india|main|registered|regd\.?|pune city|pune station|outlet|store pune))+\s*$', re.I)
AWAY = re.compile(r'mahabaleshwar|lonavala|lonavla|goa\b|nashik|varanasi|andheri|botswana|kharadi|balewadi|baner|hinjewadi|wakad|'
                  r'viman ?nagar|hadapsar|pimpri|chinchwad|aundh|wagholi|magarpatta|mumbai|satara|solapur|kolhapur|delhi|bangalore|bengaluru', re.I)

NOT_SHOP = re.compile(r'solution|consultan|technolog|infotech|software|logistic|realty|realtor|developers|associates|'
                      r'dispensary|no\.\s?\d|office|headquarter|corporate|industries|foundation|trust|society|'
                      r'institute of|registered|limited', re.I)

def clean(raw):
    if not raw:
        return ''
    s = _strip_accents(raw).replace('_', ' ').strip()
    if sum(c.isascii() for c in s) < 0.8 * len(s):
        return ''
    if AWAY.search(s) or NOT_SHOP.search(s):
        return ''
    s = re.sub(r'\bOYO\s*\d+\s*', '', s)
    s = _CUT.sub('', s)
    for _ in range(3):
        s = _TAIL.sub('', s).strip(' .-&')
    s = re.sub(r'\s+', ' ', s).strip()
    words = s.split()
    if len(words) > 4:
        s = ' '.join(words[:4])
    if len(s) > 28:
        s = ' '.join(words[:3])
    if len(s) < 3 or len(s) > 28 or re.search(r'\d{3,}|www\.|\.com', s, re.I):
        return ''
    s = re.sub(r'(?:\s+(?:and|&|of|the|by|at|for|n|-))+$', '', s, flags=re.I).strip()
    if len(s) < 3:
        return ''
    if s.isupper() and len(s) > 5 or s.islower():
        s = ' '.join(w if (w.isupper() and len(w) <= 3) else w.capitalize() for w in s.split())
    return s

try:
    from wordfreq import zipf_frequency
except ImportError:                       # optional: without it every non-dictionary word is fair game
    zipf_frequency = None
def is_english(w):
    return zipf_frequency is not None and zipf_frequency(w.lower(), 'en') >= 2.9

# Indian-English spelling variants, in order of how natural they read on a board
_RULES = [
    (r'(?<=[^aeiou])a$', 'aa'),            # Chetna -> Chetnaa, Anokha -> Anokhaa
    (r'ee', 'i'), (r'oo', 'u'), (r'(?<=[^aeiou])i$', 'ee'), (r'ph', 'f'), (r'ck', 'k'),
    (r'(?<=[^aeiou])u(?=[^aeiou])', 'oo'), # Rupam -> Roopam
    (r'(?<!^)w', 'v'), (r'(?<!^)v', 'w'), (r'c(?=[aou])', 'k'), (r'(?<=[^aeiou])y$', 'ie'),
    (r'(?<=^[^aeiou])a(?=[^aeiou])', 'aa'),  # Sahil -> Saahil (first vowel only)
    (r'(?<=[^aeiou])e$', 'ey'), (r'sh', 's'), (r'z', 's'),
]
def nice_parody(w):
    lw = w.lower()
    hits = [(pat, rep) for pat, rep in _RULES if re.search(pat, lw) and 'aaa' not in re.sub(pat, rep, lw, count=1)]
    if not hits:
        return w
    pat, rep = hits[_h(lw) % min(2, len(hits))]
    out = re.sub(pat, rep, lw, count=1)
    return out[0].upper() + out[1:] if w[0].isupper() else out

def local_parody(name, cat):
    """One small, believable spelling change in the most distinctive (non-English) word."""
    out, changed = [], False
    for w in name.split():
        lw = w.lower().strip('.')
        if (not changed and w.isalpha() and len(w) >= 4 and lw not in WORDS and lw not in NAMEWORDS
                and not is_english(lw)):
            out.append(nice_parody(w)); changed = True
        else:
            out.append(w)
    if not changed:                       # every word looked English: tweak the longest non-trade word
        idx = [i for i, w in enumerate(out) if w.isalpha() and len(w) >= 4 and w.lower() not in WORDS
               and (zipf_frequency is None or zipf_frequency(w.lower(), 'en') < 3.6)]
        if idx:
            i = max(idx, key=lambda i: len(out[i])); out[i] = nice_parody(out[i])
    out = [w[0].upper() + w[1:] if (len(w) > 3 and w.islower()) else w for w in out]
    en = ' '.join(out)
    mr = to_marathi(en) or CAT_MR.get(cat, '')
    return en, mr

def board_name(raw, cat):
    """-> (english, marathi, brand?) or None if the name isn't usable on a board."""
    b = brand_parody(raw)
    if b:
        return b[0], b[1], True
    c = clean(raw)
    if not c:
        return None
    b = brand_parody(c)
    if b:
        return b[0], b[1], True
    en, mr = local_parody(c, cat)
    return en, mr, False

# ---------------------------------------------------------------- invented, realistic fillers
# (english, marathi) pairs; every filler is assembled only from these, so Marathi is always right
DEITY = [('Shree Ganesh', 'श्री गणेश'), ('Shree Gajanan', 'श्री गजानन'), ('Om Sai', 'ॐ साई'), ('Jai Bhavani', 'जय भवानी'),
         ('Mauli', 'माऊली'), ('Morya', 'मोरया'), ('Swami Samarth', 'स्वामी समर्थ'), ('Shree Datta', 'श्री दत्त'),
         ('Vitthal', 'विठ्ठल'), ('Shree Balaji', 'श्री बालाजी'), ('Mahalaxmi', 'महालक्ष्मी'), ('Annapurna', 'अन्नपूर्णा'),
         ('Jagdamba', 'जगदंबा'), ('Ekvira', 'एकवीरा'), ('Shree Krishna', 'श्री कृष्ण'), ('Shree Ram', 'श्री राम'),
         ('Siddhivinayak', 'सिद्धिविनायक'), ('Tuljabhavani', 'तुळजाभवानी'), ('Renuka', 'रेणुका'), ('Mahadev', 'महादेव'),
         ('Gurukrupa', 'गुरुकृपा'), ('Ashirwad', 'आशीर्वाद'), ('Shubham', 'शुभम'), ('Mangal', 'मंगल'), ('Navratna', 'नवरत्न'),
         ('Sahyadri', 'सह्याद्री'), ('Shivneri', 'शिवनेरी'), ('Sinhagad', 'सिंहगड'), ('Kohinoor', 'कोहिनूर'), ('Sangam', 'संगम'),
         ('Chandan', 'चंदन'), ('Amrut', 'अमृत'), ('Anand', 'आनंद'), ('Prasad', 'प्रसाद'), ('Vijay', 'विजय'), ('Kalpana', 'कल्पना'),
         ('Saraswati', 'सरस्वती'), ('Moti', 'मोती'), ('Kamal', 'कमल'), ('Gulab', 'गुलाब'), ('Samruddhi', 'समृद्धी'),
         ('Omkar', 'ओंकार'), ('Rajmudra', 'राजमुद्रा'), ('Shivam', 'शिवम'), ('Yashwant', 'यशवंत'), ('Chaitanya', 'चैतन्य'),
         ('Pranav', 'प्रणव'), ('Sneh', 'स्नेह'), ('Milan', 'मिलन'), ('Swaraj', 'स्वराज'), ('Ganga', 'गंगा'), ('Kaveri', 'कावेरी')]
SURNAME = [('Joshi', 'जोशी'), ('Kulkarni', 'कुलकर्णी'), ('Deshpande', 'देशपांडे'), ('Gokhale', 'गोखले'), ('Apte', 'आपटे'),
           ('Kelkar', 'केळकर'), ('Bhide', 'भिडे'), ('Pawar', 'पवार'), ('Jadhav', 'जाधव'), ('Shinde', 'शिंदे'), ('More', 'मोरे'),
           ('Kale', 'काळे'), ('Gaikwad', 'गायकवाड'), ('Bhosale', 'भोसले'), ('Mane', 'माने'), ('Sathe', 'साठे'), ('Mehta', 'मेहता'),
           ('Shah', 'शाह'), ('Jain', 'जैन'), ('Agarwal', 'अगरवाल'), ('Oswal', 'ओसवाल'), ('Gandhi', 'गांधी'), ('Lunawat', 'लुणावत'),
           ('Bafna', 'बाफना'), ('Kothari', 'कोठारी'), ('Datar', 'दातार'), ('Ranade', 'रानडे'), ('Phadke', 'फडके'), ('Paranjpe', 'परांजपे'),
           ('Marathe', 'मराठे'), ('Limaye', 'लिमये'), ('Karve', 'कर्वे'), ('Sawant', 'सावंत'), ('Chavan', 'चव्हाण'), ('Khan', 'खान'),
           ('Shaikh', 'शेख'), ('Irani', 'इराणी'), ('Patel', 'पटेल'), ('Thakkar', 'ठक्कर'), ('Rathi', 'राठी')]
MOD = [('Urban', 'अर्बन'), ('Green', 'ग्रीन'), ('Blue', 'ब्लू'), ('Little', 'लिटल'), ('Golden', 'गोल्डन'),
       ('Royal', 'रॉयल'), ('Cosmo', 'कॉस्मो'), ('Metro', 'मेट्रो'), ('Silver', 'सिल्व्हर'), ('Lotus', 'लोटस'), ('Bombay', 'बॉम्बे'),
       ('Deccan', 'डेक्कन'), ('Poona', 'पूना'), ('Peshwa', 'पेशवा'), ('Maratha', 'मराठा'), ('Hilltop', 'हिलटॉप'), ('Monsoon', 'मान्सून'),
       ('Banyan', 'बनियन'), ('Mango', 'मँगो'), ('Saffron', 'सॅफ्रन'), ('Pepper', 'पेपर'), ('Coral', 'कोरल'), ('Indigo', 'इंडिगो')]
# category -> list of templates: (english, marathi) with {D} deity/auspicious, {S} surname, {M} modern word
T = {
    'pharmacy': [('{D} Medical', '{D} मेडिकल'), ('{D} Medical & General Stores', '{D} मेडिकल अँड जनरल स्टोअर्स'), ('{S} Medicals', '{S} मेडिकल्स'),
                 ('New {D} Medical', 'न्यू {D} मेडिकल'), ('{S} Chemists', '{S} केमिस्ट्स'), ('{M} Pharmacy', '{M} फार्मसी')],
    'grocery': [('{D} Kirana Stores', '{D} किराणा स्टोअर्स'), ('{S} Provision Stores', '{S} प्रोव्हिजन स्टोअर्स'), ('{D} General Stores', '{D} जनरल स्टोअर्स'),
                ('{D} Dairy', '{D} डेअरी'), ('{S} Dairy', '{S} डेअरी'), ('{D} Fruits', '{D} फ्रुट्स'), ('{S} Kirana Bhandar', '{S} किराणा भांडार'),
                ('{D} Super Market', '{D} सुपर मार्केट'), ('{D} Chicken Centre', '{D} चिकन सेंटर')],
    'sweets': [('{D} Sweets', '{D} स्वीट्स'), ('{S} Mithaiwale', '{S} मिठाईवाले'), ('{D} Sweets & Farsan', '{D} स्वीट्स अँड फरसाण'),
               ('{S} Bandhu', '{S} बंधू'), ('{D} Dairy & Sweets', '{D} डेअरी अँड स्वीट्स')],
    'jewellery': [('{S} Saraf', '{S} सराफ'), ('{S} Jewellers', '{S} ज्वेलर्स'), ('{D} Jewellers', '{D} ज्वेलर्स'), ('{S} & Sons Jewellers', '{S} अँड सन्स ज्वेलर्स'),
                  ('{S} Bangles', '{S} बांगड्या')],
    'clothes': [('{D} Saree Centre', '{D} साडी सेंटर'), ('{D} Collection', '{D} कलेक्शन'), ('{D} Fashions', '{D} फॅशन्स'), ('{S} Tailors', '{S} टेलर्स'),
                ('{D} Textiles', '{D} टेक्स्टाइल्स'), ('{D} Mens Wear', '{D} मेन्स वेअर'), ('{D} Vastra Dalan', '{D} वस्त्र दालन'), ('{M} Boutique', '{M} बुटीक'),
                ('{D} Paithani', '{D} पैठणी'), ('{S} Cloth Stores', '{S} क्लॉथ स्टोअर्स'), ('{D} Kids Wear', '{D} किड्स वेअर'), ('{D} Ladies Tailor', '{D} लेडीज टेलर')],
    'shoes': [('{D} Footwear', '{D} फूटवेअर'), ('{S} Shoe House', '{S} शू हाउस'), ('{M} Footwear', '{M} फूटवेअर'), ('{D} Chappal Bhandar', '{D} चप्पल भांडार')],
    'mobile': [('{D} Mobiles', '{D} मोबाईल्स'), ('{M} Mobile Point', '{M} मोबाईल पॉइंट'), ('{D} Mobile Shoppe', '{D} मोबाईल शॉपी'), ('{S} Telecom', '{S} टेलिकॉम')],
    'books': [('{D} Xerox', '{D} झेरॉक्स'), ('{S} Book Depot', '{S} बुक डेपो'), ('{D} Stationery', '{D} स्टेशनरी'), ('{D} Xerox Centre', '{D} झेरॉक्स सेंटर'),
              ('{D} Pustakalay', '{D} पुस्तकालय'), ('{M} Print Point', '{M} प्रिंट पॉइंट')],
    'electronics': [('{D} Electricals', '{D} इलेक्ट्रिकल्स'), ('{D} Electronics', '{D} इलेक्ट्रॉनिक्स'), ('{S} Radio House', '{S} रेडिओ हाउस'), ('{M} Electronics', '{M} इलेक्ट्रॉनिक्स')],
    'hardware': [('{D} Hardware', '{D} हार्डवेअर'), ('{S} Hardware & Paints', '{S} हार्डवेअर अँड पेंट्स'), ('{D} Steel Bhandi', '{D} स्टील भांडी'),
                 ('{S} Traders', '{S} ट्रेडर्स'), ('{D} Plywood', '{D} प्लायवूड'), ('{D} Auto Parts', '{D} ऑटो पार्ट्स')],
    'food': [('Hotel {D}', 'हॉटेल {D}'), ('{D} Vadapav', '{D} वडापाव'), ('{S} Misal House', '{S} मिसळ हाउस'), ('{D} Bhojanalay', '{D} भोजनालय'),
             ('{D} Snacks Centre', '{D} स्नॅक्स सेंटर'), ('{D} Dosa Corner', '{D} डोसा कॉर्नर'), ('{M} Kitchen', '{M} किचन'), ('{D} Pure Veg', '{D} प्युअर व्हेज'),
             ('{D} Biryani House', '{D} बिर्याणी हाउस'), ('{D} Chinese Corner', '{D} चायनीज कॉर्नर'), ('{D} Thali', '{D} थाळी')],
    'cafe': [('{D} Amruttulya', '{D} अमृततुल्य'), ('{M} Cafe', '{M} कॅफे'), ('{D} Tea House', '{D} टी हाउस'), ('{M} Coffee House', '{M} कॉफी हाउस'),
             ('{S} Chaha', '{S} चहा')],
    'bakery': [('{D} Bakery', '{D} बेकरी'), ('{S} Bakers', '{S} बेकर्स'), ('{M} Bakehouse', '{M} बेकहाउस'), ('{D} Cake Shop', '{D} केक शॉप')],
    'salon': [('{D} Hair Salon', '{D} हेअर सलून'), ('{M} Beauty Parlour', '{M} ब्युटी पार्लर'), ('{D} Mens Parlour', '{D} मेन्स पार्लर'), ('{M} Salon & Spa', '{M} सलून अँड स्पा')],
    'optician': [('{S} Opticians', '{S} ऑप्टिशियन्स'), ('{D} Optical', '{D} ऑप्टिकल'), ('{M} Eye Care', '{M} आय केअर')],
    'clinic': [('Dr. {S} Clinic', 'डॉ. {S} क्लिनिक'), ('{S} Dental Clinic', '{S} डेंटल क्लिनिक'), ('{D} Clinic', '{D} दवाखाना'), ('{D} Pathology Lab', '{D} पॅथॉलॉजी लॅब')],
    'hotel': [('Hotel {D}', 'हॉटेल {D}'), ('{D} Lodging', '{D} लॉजिंग'), ('Hotel {D} Lodge', 'हॉटेल {D} लॉज'), ('{M} Residency', '{M} रेसिडेन्सी')],
    'travel': [('{D} Travels', '{D} ट्रॅव्हल्स'), ('{D} Tours & Travels', '{D} टूर्स अँड ट्रॅव्हल्स'), ('{S} Travels', '{S} ट्रॅव्हल्स')],
    'bar': [('{M} Bistro', '{M} बिस्ट्रो'), ('The {M} Lounge', 'द {M} लाउंज'), ('{M} Bar & Kitchen', '{M} बार अँड किचन'), ('{D} Wines', '{D} वाइन्स')],
    'icecream': [('{M} Ice Cream', '{M} आईस्क्रीम'), ('{D} Juice Centre', '{D} ज्यूस सेंटर'), ('{D} Mastani House', '{D} मस्तानी हाउस'), ('{D} Lassi Ghar', '{D} लस्सी घर')],
    'generic': [('{D} Puja Sahitya', '{D} पूजा साहित्य'), ('{D} Phool Bhandar', '{D} फूल भांडार'), ('{D} Laundry', '{D} लाँड्री'), ('{S} Classes', '{S} क्लासेस'),
                ('{M} Gift Centre', '{M} गिफ्ट सेंटर'), ('{D} Cyber Cafe', '{D} सायबर कॅफे'), ('{D} Photo Studio', '{D} फोटो स्टुडिओ'),
                ('{D} Watch Repair', '{D} घड्याळ दुरुस्ती'), ('{D} Key Maker', '{D} चावीवाले'), ('{M} Gym', '{M} जिम'), ('{D} Agencies', '{D} एजन्सीज')],
}
# chance a filler takes the Marathi-first traditional board look
TRAD = {'sweets', 'jewellery', 'grocery', 'generic', 'clothes', 'hardware'}

# district -> category weights (0 deccan, 1 peth, 2 camp, 3 kp, 4 station, 5 residential, 6 riverside)
DIST_W = [
    {'cafe': 14, 'clothes': 14, 'food': 12, 'mobile': 8, 'books': 8, 'shoes': 6, 'salon': 6, 'optician': 4, 'icecream': 6, 'electronics': 4, 'pharmacy': 4, 'generic': 5, 'bakery': 3},
    {'clothes': 16, 'jewellery': 10, 'sweets': 8, 'grocery': 10, 'pharmacy': 7, 'hardware': 9, 'electronics': 7, 'generic': 9, 'books': 5, 'bakery': 3, 'shoes': 5, 'optician': 2, 'mobile': 4, 'food': 6, 'cafe': 3},
    {'clothes': 14, 'shoes': 10, 'bakery': 8, 'generic': 7, 'food': 10, 'cafe': 6, 'optician': 4, 'electronics': 6, 'pharmacy': 4, 'jewellery': 4, 'mobile': 4},
    {'cafe': 16, 'food': 14, 'bar': 10, 'clothes': 10, 'salon': 8, 'bakery': 6, 'grocery': 4, 'generic': 4, 'icecream': 3},
    {'hotel': 16, 'travel': 12, 'food': 14, 'mobile': 8, 'pharmacy': 6, 'cafe': 8, 'generic': 5, 'grocery': 3},
    {'pharmacy': 10, 'grocery': 14, 'salon': 6, 'generic': 8, 'clinic': 6, 'books': 5, 'hardware': 5, 'bakery': 4, 'mobile': 4, 'food': 6, 'clothes': 5, 'electronics': 3},
    {'generic': 12, 'cafe': 6, 'food': 6, 'sweets': 3},
]

def filler(cat, seed):
    """Deterministic invented name for a category. Different seeds give different names."""
    tpls = T.get(cat) or T['generic']
    en_t, mr_t = tpls[seed % len(tpls)]
    d = DEITY[(seed // 7) % len(DEITY)]
    s = SURNAME[(seed // 13) % len(SURNAME)]
    m = MOD[(seed // 17) % len(MOD)]
    en = en_t.replace('{D}', d[0]).replace('{S}', s[0]).replace('{M}', m[0])
    mr = mr_t.replace('{D}', d[1]).replace('{S}', s[1]).replace('{M}', m[1])
    return en, mr
