"""place_kinds.py - what a real place is, from its name (and its listing's rough category): the game's kind (the map's
filter, and whether you can walk in) and the trade its board is painted for. Shared by doors.py and places_fix.py.
kind_of(name, coarse, osm_tags) -> (kind, trade)"""
import re

# (pattern on the lower-cased name, kind)  - first match wins, so the specific go before the general
RULES = [
  # nightlife first: a brewpub's name rarely says "bar"
  (r'\b(bar|pub|brew\w*|taproom|tap room|lounge|night ?club|cocktail|beer|wine|whisky|liquor|toit|effingut|doolally|high spirits|kiki|hard rock|independence brewing|swig|permit room|club|social|sociable|dance (&|and) kitchen|kitchen (&|and) bar|millers|dimora|disc|lounge bar)\b', 'bar'),
  (r'(\bmall$|^the mills$|^phoenix market ?city|^amanora town cent|^seasons mall|^westend mall|^the pavilion|^kumar pacific|^ishanya|^elpro city square)', 'mall'),
  (r'\b(mandir|temple|devasthan|devalay|masjid|mosque|church|chapel|gurudwara|dargah|\bmath\b|ashram|derasar|synagogue)\b', 'temple'),
  (r'\b(police|chowki|thana)\b', 'chowki'),
  (r'\b(petrol|fuel|filling station|cng station|hp pump|indian oil|bharat petroleum|hpcl|bpcl|iocl|nayara|reliance petrol)\b', 'fuel'),
  (r'\b(hospital|nursing home|multispeciality|medical college|maternity|icu)\b', 'hospital'),
  (r'\b(school|vidyalaya|vidyalay|vidyamandir|high school|junior college|college|university|vidyapeeth|vidyapith|mahavidyalaya|polytechnic|campus|symbiosis|bharati vidyapeeth|sinhgad|vishwakarma|d ?y ?patil|mit[- ]|\bmit$|coep|pccoe|aissms|cummins|fergusson|garware|wadia|nowrosjee|flame university|pict|spjimr)\b', 'college'),
  (r'\b(pharma\w*|chemist|medical (stores?|&|and|general)|medicals?\b|drug ?house|medico|apollo pharmacy|wellness forever|medplus|netmeds)\b', 'pharmacy'),
  (r'\b(clinic|dispensary|dr\.?\s|doctor|dental|dentist|diagnostic|patholog|path lab|x-?ray|physio|eye care|skin care|homeopath|ayurved\w*|polyclinic|scan\b|imaging)\b', 'clinic'),
  (r'\b(gym|fitness|cult\.?fit|crossfit|health club|muscle|bodybuilding|zumba|yoga studio|talwalkars|gold\'?s)\b', 'gym'),
  (r'\b(school|vidyalaya|vidyalay|vidyamandir|vidya mandir|vidyaniketan|high school|junior college|college|university|vidyapeeth|vidyapith|mahavidyalaya|polytechnic|iti\b|campus|kendriya)\b', 'college'),
  (r'\b(classes|class\b|academy|tuition|tutorials?|coaching|training (centre|center|institute)|abacus|spoken english|driving school|dance|music|karate|martial|taekwondo|swimming|cooking|baking class|art studio|drawing|robotics|study centre|ias|upsc|mpsc|jee|neet)\b', 'classes'),
  (r'\b(abhyasika|reading room|library|granthalay|vachanalay)\b', 'library'),
  (r'\b(misal|vada ?pav|wadapav|bhel|pani ?puri|chaat|sabudana|poha|usal)\b', 'misal'),
  (r'\b(amrut+ul+ya|tapri|chai|tea stall|cha\b|irani|yewale|premachi chaha)\b', 'tapri'),
  (r'\b(thali|bhojan|khanaval|khanawal|bhojanalay|mess\b|tiffin|dabba|veg restaurant|pure veg)\b', 'thali'),
  (r'\b(biryani|biriyani|mughlai|kebab|kabab|tandoor)\b', 'biryani'),
  (r'\b(udupi|dosa|idli|madras|south indian|vaishali|rupali|sagar|shetty|uttapa)\b', 'southindian'),
  (r'\b(chinese|momo|hakka|szechuan|schezwan|wok|noodle|manchurian)\b', 'chinese'),
  (r'\b(pizza|burger|domino|mcdonald|kfc|subway|fries|wraps?|sandwich|frankie|shawarma|rolls?\b)\b', 'fastfood'),
  (r'\b(caf[eé]|coffee|starbucks|barista|ccd|third wave|blue tokai|brew room|roastery|bistro|patisserie)\b', 'cafe'),
  (r'\b(bakery|bakers|cake|cakes|confectioner\w*|kayani|marz|kayani bakery)\b', 'bakery'),
  (r'\b(sweet|mithai|chitale|halwai|farsan|kaka halwai|pedha|modak)\b', 'sweets'),
  (r'\b(juice|mastani|sujata|ice ?cream|kulfi|gelato|shake|natural\'?s|baskin|falooda|gola)\b', 'juice'),
  (r'\b(restaurant|hotel\b|dhaba|kitchen|eatery|food|diner|grill|bar ?b ?q|cuisine|biryani house|darbar|canteen|tadka)\b', 'food'),
  (r'\b(saloon|salon|parlou?r|hair|beauty|spa\b|unisex|barber|makeover|nails?|lakme|jawed|enrich|naturals|green trends|toni ?& ?guy|looks\b)\b', 'barber'),
  (r'\b(laundry|dry ?clean\w*|ironing|istri|press ?wala|wash ?(and|&) ?fold)\b', 'laundry'),
  (r'\b(optic\w*|optician|lens|spectacle|eye ?wear|chashma|chashme|lenskart|titan eye)\b', 'optician'),
  (r'\b(jewel\w*|saraf|sarafa|ornaments?|gold|silver|diamond|tanishq|png|p n gadgil|chandukaka|malabar)\b', 'jeweller'),
  (r'\b(shoe|shoes|footwear|chappal|bata|metro shoes|sandals?|sneaker)\b', 'shoes'),
  (r'\b(saree|sari|paithani|cloth\w*|fashion|garment\w*|boutique|textile|tailor\w*|wear\b|apparel|collection|kurti|dresses|readymade|hosiery|westside|pantaloons|max fashion|zudio|lifestyle|trends|uniform)\b', 'clothes'),
  (r'\b(mobile|cellular|phone|smartphone|cellphone|recharge|airtel|jio|vodafone|\bvi\b)\b', 'mobile'),
  (r'\b(electronic\w*|computer\w*|laptop|appliances?|croma|reliance digital|vijay sales|tv\b|\bac\b|refrigeration|electricals?|cctv|inverter|battery)\b', 'electronics'),
  (r'\b(books?|book ?stall|prakashan|publication|publishers?|stationer\w*|xerox|printers?|printing|copy|crossword|pustak|granth)\b', 'books'),
  (r'\b(kirana|grocer\w*|provision|super ?market|supermart|mart\b|bazaar|dmart|d-mart|star bazaar|reliance (fresh|smart)|dairy|milk|vegetable|fruit|general stores?|kirana stores|anaj|masala|oil depot)\b', 'kirana'),
  (r'\b(florist|flowers?|phool|nursery|garden centre)\b', 'florist'),
  (r'\b(paan|pan shop|pan house|pan stall|tambakhu)\b', 'paan'),
  (r'\b(pet ?shop|pets?\b|aquarium|vet\w*|animal clinic)\b', 'petshop'),
  (r'\b(gaming|game zone|bowling|arcade|snooker|pool|playzone|timezone|smaaash|vr\b|trampoline)\b', 'gaming'),
  (r'\b(cinema|multiplex|theatre|theater|talkies|inox|pvr|cinepolis|e-square|city pride)\b', 'cinema'),
  (r'\b(garage|motor\w*|auto ?works|service (centre|center|station)|tyres?|tires?|car care|car wash|car spa|puncture|two wheeler|bike service|automobiles?|spares|auto parts)\b', 'garage'),
  (r'\b(showroom|hyundai|maruti|honda|toyota|tata motors|mahindra|kia|mg motor|bajaj|tvs|hero motocorp|royal enfield|suzuki|yamaha|ola electric|ather)\b', 'dealer'),
  (r'\b(travels?|tours?|holidays|tourist|cab service|taxi service|bus booking)\b', 'travel'),
  (r'\b(lodge|guest ?house|residency|inn\b|hostel|\bpg\b|paying guest|stay|homestay|oyo|resort|suites|hotel)\b', 'lodge'),
  (r'\b(estate agents?|real ?estate|realty|realtors?|property|properties|builders?|developers?|construction)\b', 'estate'),
  (r'\b(bank|atm|co-?op(erative)? (bank|society|credit)|patsanstha|pat sanstha|sahakari|credit society|finance|microfinance)\b', 'bank'),
  (r'\b(hardware|paints?|plywood|sanitary|tiles?|marble|steel|cement|plumbing|electrical works|glass house)\b', 'shop'),
  (r'\b(pvt\.?\s*ltd|private limited|\bltd\b|llp|technolog\w*|solutions|software|consult\w*|associates|advocates?|lawyers?|legal|chartered|\bca\b|architects?|infra\w*|insurance|capital|securities|investments?|enterprises?|industries|corporation|agency|agencies|office|offices|systems|\blabs?\b|media|marketing|logistics|courier|exports?|imports?|trading|traders|engineering|engineers|hr\b|recruit\w*|placement|foundation|trust\b|sanstha|mandal|association|federation|society\b|ngo|council|department|municipal|ward office|tehsil|collector|court|post office|telephone exchange|msedcl|mseb|bsnl|coworking|co-working|cowork|startup|design|interiors?)\b', 'office'),
  (r'\b(repair\w*|service\b|services\b|pest control|packers|movers|cyber ?cafe|internet|photo studio|photography|digital studio|key maker|locksmith|watch repair|tailoring|alteration|event|decorators?|caterers?|mandap|lawns?|banquet|hall\b)\b', 'services'),
]
RULES = [(re.compile(p, re.I), k) for p, k in RULES]
# when the name says nothing: the listing's own rough category
COARSE = {'food': 'food', 'shop': 'shop', 'bank': 'bank', 'hospital': 'clinic', 'college': 'college', 'temple': 'temple', 'park': 'park', 'landmark': 'landmark',
          'fuel': 'fuel', 'transit': 'transit', 'cinema': 'cinema', 'police': 'chowki', 'service': 'office',
          # the trades the earlier bake wrote
          'cafe': 'cafe', 'bakery': 'bakery', 'sweets': 'sweets', 'icecream': 'juice', 'clothes': 'clothes', 'shoes': 'shoes', 'jewellery': 'jeweller', 'mobile': 'mobile',
          'electronics': 'electronics', 'books': 'books', 'optician': 'optician', 'grocery': 'kirana', 'pharmacy': 'pharmacy', 'salon': 'barber', 'garage': 'garage', 'atm': 'bank', 'bar': 'bar'}
OSM_KIND = {('amenity', 'bar'): 'bar', ('amenity', 'pub'): 'bar', ('amenity', 'nightclub'): 'bar', ('amenity', 'biergarten'): 'bar', ('amenity', 'cafe'): 'cafe',
            ('amenity', 'ice_cream'): 'juice', ('shop', 'bakery'): 'bakery', ('shop', 'confectionery'): 'sweets', ('shop', 'clothes'): 'clothes', ('shop', 'tailor'): 'clothes',
            ('shop', 'shoes'): 'shoes', ('shop', 'jewelry'): 'jeweller', ('shop', 'mobile_phone'): 'mobile', ('shop', 'electronics'): 'electronics', ('shop', 'computer'): 'electronics',
            ('shop', 'books'): 'books', ('shop', 'stationery'): 'books', ('shop', 'copyshop'): 'books', ('shop', 'optician'): 'optician', ('shop', 'supermarket'): 'kirana',
            ('shop', 'convenience'): 'kirana', ('shop', 'greengrocer'): 'kirana', ('shop', 'dairy'): 'kirana', ('amenity', 'pharmacy'): 'pharmacy', ('shop', 'chemist'): 'pharmacy',
            ('shop', 'hairdresser'): 'barber', ('shop', 'beauty'): 'barber', ('shop', 'car_repair'): 'garage', ('shop', 'tyres'): 'garage', ('shop', 'motorcycle_repair'): 'garage',
            ('shop', 'car'): 'dealer', ('shop', 'motorcycle'): 'dealer', ('leisure', 'fitness_centre'): 'gym', ('amenity', 'hospital'): 'hospital', ('amenity', 'clinic'): 'clinic',
            ('amenity', 'doctors'): 'clinic', ('amenity', 'dentist'): 'clinic', ('amenity', 'bank'): 'bank', ('amenity', 'atm'): 'bank', ('amenity', 'fuel'): 'fuel',
            ('amenity', 'place_of_worship'): 'temple', ('amenity', 'school'): 'college', ('amenity', 'college'): 'college', ('amenity', 'university'): 'college',
            ('amenity', 'cinema'): 'cinema', ('shop', 'mall'): 'mall', ('shop', 'florist'): 'florist', ('shop', 'pet'): 'petshop', ('office', '*'): 'office',
            ('amenity', 'restaurant'): 'food', ('amenity', 'fast_food'): 'fastfood', ('tourism', 'hotel'): 'lodge', ('tourism', 'guest_house'): 'lodge', ('shop', 'laundry'): 'laundry', ('shop', 'dry_cleaning'): 'laundry'}
for _k in ['tapri','misal','thali','biryani','southindian','chinese','fastfood','juice','bar','barber','laundry','kirana','florist','paan','petshop','jeweller','dealer','travel','lodge','estate','library','clinic','hospital','gym','office','classes','services','mall','gaming','chowki','pharmacy']: COARSE.setdefault(_k, _k)
# the board each kind gets painted as (gfx/boards.js CAT_STYLE)
TRADE = {'food': 'food', 'thali': 'food', 'misal': 'food', 'biryani': 'food', 'southindian': 'food', 'chinese': 'food', 'fastfood': 'food', 'tapri': 'cafe', 'cafe': 'cafe',
         'bakery': 'bakery', 'sweets': 'sweets', 'juice': 'icecream', 'bar': 'bar', 'barber': 'salon', 'clothes': 'clothes', 'shoes': 'shoes', 'optician': 'optician',
         'laundry': 'generic', 'kirana': 'grocery', 'shop': 'hardware', 'mobile': 'mobile', 'electronics': 'electronics', 'books': 'books', 'florist': 'generic', 'paan': 'generic',
         'petshop': 'generic', 'jeweller': 'jewellery', 'bank': 'bank', 'dealer': 'generic', 'garage': 'garage', 'travel': 'travel', 'lodge': 'hotel', 'estate': 'office',
         'library': 'books', 'pharmacy': 'pharmacy', 'clinic': 'clinic', 'hospital': 'clinic', 'gym': 'gym', 'office': 'office', 'classes': 'classes', 'services': 'generic',
         'mall': 'generic', 'gaming': 'generic', 'cinema': 'generic', 'chowki': 'police', 'college': 'classes', 'temple': 'generic', 'fuel': 'generic'}

def kind_of(name, coarse=None, osm=None):
    n = (name or '').lower()
    if osm:
        for (k, v), kind in OSM_KIND.items():
            if osm.get(k) and (v == '*' or osm.get(k) == v): return kind, TRADE.get(kind, 'generic')
    for rx, kind in RULES:
        if rx.search(n): return kind, TRADE.get(kind, 'generic')
    kind = COARSE.get(coarse or '', 'shop')
    return kind, TRADE.get(kind, 'generic')
