"""Trade (shop board) and map category for Overture place categories; shared by the place tools."""
import re

TAX = {'jewelry_store': 'jewellery', 'watch_store': 'jewellery', 'shoe_store': 'shoes', 'eyewear_store': 'optician',
       'sunglasses_store': 'optician', 'bakery': 'bakery', 'patisserie_cake_shop': 'bakery', 'cupcake_shop': 'bakery',
       'donut_shop': 'bakery', 'ice_cream_shop': 'icecream', 'frozen_yogurt_shop': 'icecream', 'dessert_shop': 'icecream',
       'juice_bar': 'icecream', 'candy_store': 'sweets', 'chocolatier': 'sweets', 'grocery_store': 'grocery',
       'convenience_store': 'grocery', 'produce_store': 'grocery', 'organic_grocery_store': 'grocery', 'butcher_shop': 'grocery',
       'indian_grocery_store': 'grocery', 'health_food_store': 'grocery', 'supermarket': 'grocery', 'liquor_store': 'bar',
       'mobile_phone_store': 'mobile', 'tea_room': 'cafe', 'bubble_tea': 'cafe'}
BASIC = {'restaurant': 'food', 'casual_eatery': 'food', 'fast_food_restaurant': 'food', 'cafe': 'cafe', 'coffee_shop': 'cafe',
         'bar': 'bar', 'fashion_and_apparel_store': 'clothes', 'electronics_store': 'electronics',
         'hardware_home_and_garden_store': 'hardware', 'food_and_beverage_store': 'grocery', 'bank_or_credit_union': 'bank',
         'atm': 'atm', 'pharmacy_and_drug_store': 'pharmacy', 'dental_clinic': 'clinic', 'personal_or_beauty_service': 'salon',
         'personal_care_and_beauty_store': 'salon', 'printing_service': 'books', 'books_music_and_video_store': 'books',
         'travel_service': 'travel', 'hotel': 'hotel', 'lodging': 'hotel', 'flowers_and_gifts_store': 'generic',
         'sporting_goods_store': 'shoes', 'arts_crafts_and_hobby_store': 'generic', 'specialty_store': 'generic',
         'vehicle_parts_store': 'hardware', 'gym': 'generic', 'warehouse_club_store': 'grocery', 'vision_or_eye_care_clinic': 'optician',
         'diagnostics_imaging_or_lab_service': 'clinic', 'shopping': '?', 'grocery_store': 'grocery', 'convenience_store': 'grocery',
         'lounge': 'bar', 'dance_club': 'bar', 'nightclub': 'bar', 'pub': 'bar', 'brewery': 'bar', 'night_club': 'bar',
         'cocktail_bar': 'bar', 'wine_bar': 'bar', 'hookah_bar': 'bar', 'sports_bar': 'bar', 'beer_bar': 'bar',
         'dessert_shop': 'icecream', 'bakery': 'bakery', 'specialized_health_care': 'clinic', 'health_care': 'clinic',
         'wellness_service': 'salon', 'pet_store': 'generic', 'furniture_store': 'hardware', 'auto_dealer': 'generic',
         'vehicle_dealer': 'generic', 'automotive_service': 'hardware', 'tutoring_service': 'books', 'educational_service': 'books'}
KW = [('jewel|saraf|gold|diamond|bangle', 'jewellery'), ('medical|chemist|pharma|drug', 'pharmacy'),
      ('mobile|telecom|cellular|phone', 'mobile'), ('saree|sari|cloth|textile|fashion|boutique|dress|garment|tailor|wear|collection|paithani', 'clothes'),
      ('foot|shoe|chappal|sandal', 'shoes'), ('electric|electronic|appliance|radio|computer', 'electronics'),
      ('hardware|paint|plywood|glass|steel|sanitary|tiles|traders', 'hardware'), ('book|stationer|xerox|print', 'books'),
      ('sweet|mithai|farsan|chiwda', 'sweets'), ('bakery|cake|bakers', 'bakery'), ('optic|eye', 'optician'),
      ('kirana|provision|general store|super ?market|mart|dairy|fruit', 'grocery'), ('travel|tour', 'travel')]
def kw_cat(name):
    low = name.lower()
    for pat, c in KW:
        if re.search(pat, low): return c
    return 'generic'


def ovt_pin(bc, hier):
    h = ' '.join([bc or ''] + list(hier or []))
    if re.search(r'police', h): return 'police'
    if re.search(r'college|universit|school|place_of_learning|education|tutoring|preschool', h): return 'college'
    if re.search(r'worship|religious|temple|mosque|church|gurudwara', h): return 'temple'
    if re.search(r'hospital|clinic|health|medical|dental|pharmacy|diagnostic|physician|doctor|care_facility|rehabilitation', h): return 'hospital'
    if re.search(r'bank|atm|credit_union|financial', h): return 'bank'
    if re.search(r'gas_station|fuel|charging', h): return 'fuel'
    if re.search(r'bus_station|train_station|metro|airport|transit|railway|bus_stop|taxi', h): return 'transit'
    if re.search(r'park|garden|playground|zoo|nature|lake|hiking', h): return 'park'
    if re.search(r'movie|cinema|theat|performing_arts|auditorium', h): return 'cinema'
    if re.search(r'historic|monument|landmark|museum|fort|palace|memorial', h): return 'landmark'
    if re.search(r'restaurant|eatery|cafe|coffee|bar\b|pub|bakery|dessert|juice|tea_|food_court|fast_food|sweet|ice_cream|food_and_drink|brewery|lounge', h): return 'food'
    if re.search(r'store|shop|mall|market|retail', h): return 'shop'
    return 'service'

