# Pune's famous places, checked: each name is looked up on OpenStreetMap (Nominatim) and kept only if OSM has it
# inside Pune; its exact spot becomes the game's. Also cross-checks the game's own pins (same name within 300 m).
# Writes src/world/famous.json. Run: python3 tools/famous_places.py   (about 1 request a second, as Nominatim asks)
import json, gzip, math, os, re, time, urllib.parse, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAT0, LON0, ML, MO = 18.527, 73.865, 110686.0, 105589.0
# name, search query, kind (shop kind for its storefront, or '' for a place with no counter), Marathi
PLACES = [
  # food institutions
  ('Vaishali', 'Vaishali Restaurant, Fergusson College Road, Pune', 'southindian', 'वैशाली'),
  ('Roopali', 'Roopali, Fergusson College Road, Pune', 'southindian', 'रूपाली'),
  ('Wadeshwar Bhavan', 'Wadeshwar, Fergusson College Road, Pune', 'southindian', 'वाडेश्वर'),
  ('Cafe Goodluck', 'Cafe Goodluck, Deccan Gymkhana, Pune', 'cafe', 'कॅफे गुडलक'),
  ('Hotel Shreyas', 'Hotel Shreyas, Apte Road, Pune', 'thali', 'हॉटेल श्रेयस'),
  ('Durvankur Dining Hall', 'Durvankur Dining Hall, Pune', 'thali', 'दुर्वांकुर'),
  ('Bedekar Misal', 'Bedekar Tea Stall, Narayan Peth, Pune', 'misal', 'बेडेकर मिसळ'),
  ('Katakirr Misal', 'Katakirr, Karve Road, Pune', 'misal', 'काटाकिर्र'),
  ('Shri Krishna Bhuvan', 'Shri Krishna Bhuvan, Pune', 'misal', ''),
  ('Chitale Bandhu', 'Chitale Bandhu Mithaiwale, Deccan Gymkhana, Pune', 'sweets', 'चितळे बंधू'),
  ('Chitale Bandhu (Bajirao Road)', 'Chitale Bandhu Mithaiwale, Bajirao Road, Pune', 'sweets', 'चितळे बंधू'),
  ('Sujata Mastani', 'Sujata Mastani, Sadashiv Peth, Pune', 'icecream', 'सुजाता मस्तानी'),
  ('Kayani Bakery', 'Kayani Bakery, East Street, Pune', 'bakery', 'कयानी बेकरी'),
  ('Marz-o-rin', 'Marz-o-rin, MG Road, Pune', 'cafe', 'मार्झोरिन'),
  ('Dorabjee & Sons', 'Dorabjee, Dastur Meher Road, Pune', 'food', 'दोराबजी'),
  ('German Bakery', 'German Bakery, North Main Road, Koregaon Park, Pune', 'bakery', 'जर्मन बेकरी'),
  ('Malaka Spice', 'Malaka Spice, Koregaon Park, Pune', 'food', 'मलाका स्पाइस'),
  ('SP’s Biryani House', 'SP Biryani House, Sadashiv Peth, Pune', 'biryani', 'एसपीज बिर्याणी'),
  ('Garden Vada Pav', 'Garden Vada Pav, Pune', 'fastfood', 'गार्डन वडापाव'),
  ('Joshi Wadewale', 'Joshi Wadewale, Pune', 'fastfood', 'जोशी वडेवाले'),
  ('Cafe Durga', 'Cafe Durga, Kothrud, Pune', 'cafe', 'कॅफे दुर्गा'),
  ('Kalyan Bhel', 'Kalyan Bhel, Pune', 'tapri', 'कल्याण भेळ'),
  ('Amruttulya', 'Amruttulya, Pune', 'tapri', 'अमृततुल्य'),
  # temples
  ('Saras Baug Ganpati', 'Talyatla Ganpati, Saras Baug, Pune', '', 'सारसबाग गणपती'),
  ('Pataleshwar Caves', 'Pataleshwar, Jangli Maharaj Road, Pune', '', 'पाताळेश्वर'),
  ('ISKCON NVCC', 'ISKCON NVCC, Katraj Kondhwa Road, Pune', '', 'इस्कॉन'),
  ('Jangli Maharaj Temple', 'Jangli Maharaj Samadhi Mandir, Pune', '', 'जंगली महाराज मंदिर'),
  ('Tambdi Jogeshwari', 'Tambdi Jogeshwari, Budhwar Peth, Pune', '', 'तांबडी जोगेश्वरी'),
  ('Guruji Talim Ganpati', 'Guruji Talim, Pune', '', 'गुरुजी तालीम गणपती'),
  ('Tulshibaug Ganpati', 'Tulshibaug Ganpati, Pune', '', 'तुळशीबाग गणपती'),
  ('Kesariwada Ganpati', 'Kesari Wada, Narayan Peth, Pune', '', 'केसरीवाडा'),
  # parks and open spaces
  ('Saras Baug', 'Saras Baug, Pune', '', 'सारसबाग'),
  ('Empress Garden', 'Empress Garden, Pune', '', 'एम्प्रेस गार्डन'),
  ('Bund Garden', 'Bund Garden, Pune', '', 'बंड गार्डन'),
  ('Pu La Deshpande Garden', 'Pu La Deshpande Udyan, Sinhagad Road, Pune', '', 'पु. ल. देशपांडे उद्यान'),
  ('Kamala Nehru Park', 'Kamala Nehru Park, Erandwane, Pune', '', 'कमला नेहरू पार्क'),
  ('Peshwe Park', 'Peshwe Park, Pune', '', 'पेशवे पार्क'),
  ('Vetal Tekdi', 'Vetal Hill, Pune', '', 'वेताळ टेकडी'),
  ('Rajiv Gandhi Zoo', 'Rajiv Gandhi Zoological Park, Katraj, Pune', '', 'कात्रज प्राणिसंग्रहालय'),
  ('Osho Teerth Park', 'Osho Teerth Park, Koregaon Park, Pune', '', 'ओशो तीर्थ पार्क'),
  # museums, theatres, culture
  ('Raja Dinkar Kelkar Museum', 'Raja Dinkar Kelkar Museum, Pune', '', 'राजा दिनकर केळकर संग्रहालय'),
  ('Mahatma Phule Museum', 'Mahatma Phule Museum, Pune', '', 'महात्मा फुले संग्रहालय'),
  ('Bal Gandharva Rang Mandir', 'Bal Gandharva Rang Mandir, Pune', '', 'बालगंधर्व रंगमंदिर'),
  ('Tilak Smarak Mandir', 'Tilak Smarak Mandir, Pune', '', 'टिळक स्मारक मंदिर'),
  ('Yashwantrao Chavan Natyagruha', 'Yashwantrao Chavan Natyagruha, Kothrud, Pune', '', 'यशवंतराव चव्हाण नाट्यगृह'),
  ('FTII', 'Film and Television Institute of India, Pune', '', 'एफटीआयआय'),
  ('National War Memorial', 'National War Memorial Southern Command, Pune', '', 'राष्ट्रीय युद्ध स्मारक'),
  ('Joshi’s Museum of Miniature Railways', 'Joshi Museum of Miniature Railway, Pune', '', 'जोशी रेल्वे संग्रहालय'),
  ('Nana Wada', 'Nana Wada, Pune', '', 'नाना वाडा'),
  ('Vishrambaug Wada', 'Vishrambaug Wada, Pune', '', 'विश्रामबाग वाडा'),
  # colleges
  ('BMCC', 'Brihan Maharashtra College of Commerce, Pune', '', 'बीएमसीसी'),
  ('Symbiosis', 'Symbiosis Society, Senapati Bapat Road, Pune', '', 'सिम्बायोसिस'),
  ('Deccan College', 'Deccan College, Pune', '', 'डेक्कन कॉलेज'),
  ('ILS Law College', 'ILS Law College, Pune', '', 'आयएलएस लॉ कॉलेज'),
  ('Garware College', 'Abasaheb Garware College, Pune', '', 'गरवारे कॉलेज'),
  ('SP College', 'Sir Parashurambhau College, Pune', '', 'स. प. महाविद्यालय'),
  # markets and malls
  ('Laxmi Road', 'Laxmi Road, Pune', '', 'लक्ष्मी रस्ता'),
  ('Fashion Street', 'Fashion Street, Camp, Pune', '', 'फॅशन स्ट्रीट'),
  ('Appa Balwant Chowk', 'Appa Balwant Chowk, Pune', '', 'अप्पा बळवंत चौक'),
  ('Juna Bazar', 'Juna Bazar, Pune', '', 'जुना बाजार'),
  ('Phoenix Marketcity', 'Phoenix Marketcity, Viman Nagar, Pune', '', 'फिनिक्स मार्केटसिटी'),
  ('Pavillion Mall', 'The Pavillion, Senapati Bapat Road, Pune', '', 'द पॅव्हिलियन'),
  ('Westend Mall', 'Westend Mall, Aundh, Pune', '', 'वेस्टएंड मॉल'),
  ('Amanora Mall', 'Amanora Mall, Hadapsar, Pune', '', 'अमानोरा मॉल'),
  ('Seasons Mall', 'Seasons Mall, Magarpatta, Pune', '', 'सीझन्स मॉल'),
  ('Balewadi High Street', 'Balewadi High Street, Pune', '', 'बालेवाडी हाय स्ट्रीट'),
  ('Kumar Pacific Mall', 'Kumar Pacific Mall, Pune', '', 'कुमार पॅसिफिक मॉल'),
  # transport and sport
  ('Swargate Bus Stand', 'Swargate Bus Stand, Pune', '', 'स्वारगेट बस स्थानक'),
  ('Shivajinagar Bus Stand', 'Shivajinagar Bus Stand, Pune', '', 'शिवाजीनगर बस स्थानक'),
  ('Pune Airport', 'Pune International Airport', '', 'पुणे विमानतळ'),
  ('Balewadi Stadium', 'Shree Shiv Chhatrapati Sports Complex, Balewadi, Pune', '', 'बालेवाडी क्रीडा संकुल'),
  ('Nehru Stadium', 'Nehru Stadium, Swargate, Pune', '', 'नेहरू स्टेडियम'),
  ('Deccan Gymkhana', 'Deccan Gymkhana Club, Pune', '', 'डेक्कन जिमखाना'),
  ('PYC Hindu Gymkhana', 'PYC Hindu Gymkhana, Pune', '', 'पीवायसी हिंदू जिमखाना'),
  ('Sinhagad Fort', 'Sinhagad Fort', '', 'सिंहगड'),
  ('Khadakwasla Dam', 'Khadakwasla Dam', '', 'खडकवासला धरण'),
]
def q(query):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': query, 'format': 'json', 'limit': 3, 'viewbox': '73.6,18.75,74.15,18.35', 'bounded': 1})
    req = urllib.request.Request(url, headers={'User-Agent': 'puneri-game-places/1.0'})
    with urllib.request.urlopen(req, timeout=20) as r: return json.loads(r.read())
pins = json.loads(gzip.open(os.path.join(ROOT, 'data/pune/pins.json.gz')).read())
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
out, miss = [], []
for name, query, kind, mr in PLACES:
    time.sleep(1.1)
    try: res = q(query)
    except Exception as e: res = []
    if not res:
        miss.append(name); print('not found on OSM:', name); continue
    r = res[0]; lat, lon = float(r['lat']), float(r['lon'])
    x, z = (lon - LON0) * MO, -(lat - LAT0) * ML
    # the game's own pin with that name, if close
    key = norm(name)[:7]; pin = None
    for p in pins:
        if norm(p[0]).startswith(key) and math.hypot(p[3] / 100 - x, p[4] / 100 - z) < 300: pin = p; break
    out.append({'name': name, 'mr': mr, 'kind': kind, 'x': round(x, 1), 'z': round(z, 1), 'osm': r.get('display_name', '')[:90], 'pinOff': round(math.hypot(pin[3] / 100 - x, pin[4] / 100 - z)) if pin else None})
    print(f"{name:34s} {x:8.0f} {z:8.0f}  pin {'%dm' % out[-1]['pinOff'] if pin else 'none'}")
json.dump(out, open(os.path.join(ROOT, 'src/world/famous.json'), 'w'), ensure_ascii=False, indent=0)
print(len(out), 'verified,', len(miss), 'not on OSM:', miss)
