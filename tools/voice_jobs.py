# Every voice line in the game, cast for Indic Parler-TTS (ai4bharat/indic-parler-tts): who says it, in what
# voice, with what feeling. Writes tools/voice_jobs.json, which tools/puneri_voices.ipynb (free Colab GPU)
# turns into mp3s; tools/voice_import.py puts them in assets/voice/.
#   python3 tools/voice_jobs.py
# The line ids and texts come from tools/make_voices.py itself (its job list), so they always match the game.
import json, os, re, sys, types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'tools/make_voices.py')).read()
src = src[:src.index('def af_for')].replace('import soundfile as sf', '')
sys.argv = [sys.argv[0]]
ns = {'__file__': os.path.join(ROOT, 'tools/make_voices.py'), '__name__': 'voice_jobs'}
exec(compile(src, 'make_voices.py', 'exec'), ns)
jobs, speakable = ns['jobs'], ns['speakable']
lines = ns['lines']
street = json.load(open(os.path.join(ROOT, 'src/game/street_lines.json')))['_personas']

# ---------------------------------------------------------------- the cast
# Indic Parler-TTS's own named voices (consistent across lines): Marathi Sanjay, Sunita, Nikhil, Radha, Varun,
# Isha; Hindi Rohit, Divya, Aman, Rani; Indian English Thoma, Mary, Kabir, Riya, Tarun, Priya, Raghav, Gauri
CAST = {
    # street people, by persona: (speaker per language, pitch, pace, who they are)
    'kaka':        ({'mr': 'Sanjay', 'hi': 'Rohit', 'en': 'Raghav'}, 'slightly low-pitched', 'moderate', 'a middle-aged Puneri man, dry and a little sarcastic'),
    'ajoba':       ({'mr': 'Sanjay', 'hi': 'Rohit', 'en': 'Raghav'}, 'low, slightly hoarse', 'slow', 'an old man, unhurried and opinionated'),
    'dada':        ({'mr': 'Nikhil', 'hi': 'Aman', 'en': 'Kabir'}, 'moderate', 'fast', 'a young local guy, casual and confident'),
    'bhaiya':      ({'mr': 'Varun', 'hi': 'Aman', 'en': 'Tarun'}, 'moderate', 'moderate', 'a working man, friendly and loud'),
    'collegeboy':  ({'mr': 'Nikhil', 'hi': 'Aman', 'en': 'Kabir'}, 'slightly high-pitched', 'fast', 'a college student, energetic and joking'),
    'kaku':        ({'mr': 'Sunita', 'hi': 'Divya', 'en': 'Gauri'}, 'moderate', 'moderate', 'a middle-aged Puneri woman, sharp and warm'),
    'aaji':        ({'mr': 'Sunita', 'hi': 'Rani', 'en': 'Gauri'}, 'slightly low, a little shaky', 'slow', 'an old woman, kind but blunt'),
    'tai':         ({'mr': 'Radha', 'hi': 'Divya', 'en': 'Priya'}, 'moderate', 'moderate', 'a young woman, direct and lively'),
    'aunty':       ({'mr': 'Sunita', 'hi': 'Rani', 'en': 'Gauri'}, 'moderate', 'moderate', 'a chatty aunty'),
    'collegegirl': ({'mr': 'Isha', 'hi': 'Divya', 'en': 'Riya'}, 'high-pitched', 'fast', 'a college student, bubbly and quick'),
    'kpguy':       ({'mr': 'Nikhil', 'hi': 'Aman', 'en': 'Kabir'}, 'moderate', 'relaxed', 'a young man from Koregaon Park, laid-back'),
    'kpgirl':      ({'mr': 'Isha', 'hi': 'Divya', 'en': 'Riya'}, 'moderate', 'relaxed', 'a young woman from Koregaon Park, cool and amused'),
}
# lines.json speakers
ROLE = {
    'Traffic police': ({'mr': 'Sanjay', 'hi': 'Rohit', 'en': 'Raghav'}, 'firm, slightly low-pitched', 'brisk', 'a traffic policeman on the road', 'Command'),
    'Beat marshal':   ({'mr': 'Varun', 'hi': 'Aman', 'en': 'Tarun'}, 'firm', 'brisk', 'a police beat marshal on a motorbike', 'Command'),
    'Police radio':   ({'mr': 'Varun', 'hi': 'Rohit', 'en': 'Tarun'}, 'flat', 'fast', 'a police dispatcher on the radio', 'News'),
    'Towing van':     ({'mr': 'Varun', 'hi': 'Aman', 'en': 'Tarun'}, 'loud', 'fast', 'a tow-van worker', 'Command'),
    'Pedestrian':     ({'mr': 'Nikhil', 'hi': 'Aman', 'en': 'Kabir'}, 'raised', 'fast', 'an angry pedestrian', 'Anger'),
    'Driver':         ({'mr': 'Varun', 'hi': 'Rohit', 'en': 'Tarun'}, 'raised', 'fast', 'an annoyed driver', 'Anger'),
    'Bystander':      ({'mr': 'Sanjay', 'hi': 'Rohit', 'en': 'Raghav'}, 'moderate', 'fast', 'a startled bystander', 'Surprise'),
}
# shopkeepers by kind of shop: speaker per language plus the mood of the counter
SHOP_F = {'thali', 'clinic', 'bank', 'florist', 'clothes'}
SHOP_EN_F = {'fastfood', 'cafe', 'optician'}
def shop_cast(kind, lang):
    f = kind in SHOP_F or (lang == 'en' and kind in SHOP_EN_F)
    spk = ({'mr': 'Sunita', 'hi': 'Divya', 'en': 'Mary'} if f else {'mr': 'Varun' if kind in ('tapri', 'juice', 'fuel', 'estate') else 'Sanjay', 'hi': 'Rohit' if kind in ('bakery', 'southindian') else 'Aman', 'en': 'Thoma'})[lang]
    mood = 'Happy' if kind in ('sweets', 'icecream', 'florist', 'cafe', 'bakery', 'juice') else 'Conversation'
    return spk, 'moderate', 'moderate', f'a shopkeeper at a {kind} counter in Pune, practised and polite', mood

def lang_of(l): return 'en' if l.startswith('en') else l if l in ('mr', 'hi') else 'hi'
def describe(name, pitch, pace, who, emotion='Conversation'):
    feel = {'Command': 'with authority, every word clipped', 'Anger': 'angrily, voice raised', 'Surprise': 'in surprise', 'Happy': 'warmly, with a smile in the voice',
            'News': 'in a flat, clipped radio voice', 'Fear': 'fearfully, voice trembling', 'Sad': 'sadly', 'Conversation': 'naturally, like talking to someone right in front of them'}[emotion]
    return (f"{name} speaks {feel}, {pitch} in pitch and at a {pace} pace: {who}. Expressive and natural, not read aloud. "
            "The recording is of very high quality, with the voice sounding clear and very close up, almost no background noise.")

out = []
for lid, voice, lang, text in jobs:
    L = lang_of(lang)
    if lid.startswith(('s_', 'q_')):
        pid = lid.split('_')[1]
        for p in street:
            if lid.startswith(f's_{p}_') or lid.startswith(f'q_{p}_'): pid = p
        spk, pitch, pace, who = CAST[pid][0][L], *CAST[pid][1:]
        # the moment decides the feeling: shouted at a near-miss, scared running, warm saying hello
        scn = re.sub(r'\d+$', '', lid.split('_', 2)[2]) if lid.count('_') >= 2 else ''
        emo = {'dodge': 'Anger', 'honk': 'Anger', 'bump': 'Anger', 'shoved': 'Anger', 'fight': 'Anger', 'hit': 'Anger', 'fall': 'Anger',
               'carjack_two': 'Anger', 'carjack_car': 'Anger', 'carjack_auto': 'Anger', 'flee': 'Fear', 'scared': 'Fear',
               'greet': 'Happy', 'nice': 'Happy', 'respect': 'Happy', 'kind': 'Happy', 'odd': 'Surprise', 'stunt': 'Surprise'}.get(scn, 'Conversation')
    elif lid.startswith('p_'):
        f = lid.endswith('_f')
        spk, pitch, pace, who, emo = (['Sunita', 'Radha', 'Isha'][sum(map(ord, lid)) % 3] if f else ['Sanjay', 'Nikhil', 'Varun'][sum(map(ord, lid)) % 3]), 'moderate', 'moderate', 'a passenger hailing or riding an auto rickshaw', 'Conversation'
    elif lid.startswith('k_'):
        spk, pitch, pace, who, emo = shop_cast(lid.split('_')[1], L)
    elif lid.startswith('d_'):
        _, sx, dl, _rest = lid.split('_', 3)
        spk = {'f': {'mr': 'Radha', 'hi': 'Divya', 'en': 'Riya'}, 'm': {'mr': 'Nikhil', 'hi': 'Aman', 'en': 'Kabir'}}[sx][dl]
        pitch, pace, who, emo = 'moderate', 'moderate', 'someone on a date, relaxed, a little flirty, a little shy', 'Conversation'
    elif lid.startswith('pk_'):
        spk = 'Riya' if '_f' in lid else 'Kabir'
        pitch, pace, who, emo = 'moderate', 'moderate', 'a young person, excited to start', 'Happy'
    elif lid in lines:
        role = lines[lid][0]
        spk, pitch, pace, who, emo = ROLE.get(role, ROLE['Bystander'])[0][L], *ROLE.get(role, ROLE['Bystander'])[1:]
    else:
        continue
    t = speakable(text)
    if not t: continue
    out.append({'id': lid, 'lang': L, 'speaker': spk, 'text': t, 'desc': describe(spk, pitch, pace, who, emo)})

# street vendors calling their wares (src/game/vendor_lines.json): loud, sing-song hawkers' cries
VEND = {'0': ('Varun', 'a tea-stall boy calling to passers-by'), '1': ('Nikhil', 'a paan-shop man calling to passers-by'), '2': ('Sanjay', 'a vada pav cart owner calling to passers-by'),
        '3': ('Varun', 'a fruit-cart seller calling to passers-by'), '4': ('Sunita', 'a flower seller with gajras calling to passers-by'), '5': ('Sanjay', 'a sugarcane-juice stall owner calling to passers-by')}
for kind, L in json.load(open(os.path.join(ROOT, 'src/game/vendor_lines.json'))).items():
    if kind == '_': continue
    spk, who = VEND[kind]
    for i, (t, _r, _e) in enumerate(L):
        out.append({'id': f'vd_{kind}_{i}', 'lang': 'mr', 'speaker': spk, 'text': t,
                    'desc': f"{spk} calls out loudly in a sing-song hawker's cry, raised and carrying, at a brisk pace: {who} on a busy Pune street. Expressive and natural, not read aloud. The recording is of very high quality, with the voice sounding clear and close up, almost no background noise."})
dst = os.path.join(ROOT, 'tools/voice_jobs.json')
json.dump(out, open(dst, 'w'), ensure_ascii=False, indent=0)
from collections import Counter
print(len(out), 'lines →', dst)
print(Counter(j['speaker'] for j in out).most_common())
# the story's lines join the list (tools/story_jobs.py)
exec(open(os.path.join(ROOT, 'tools/story_jobs.py')).read(), {'__file__': os.path.join(ROOT, 'tools/story_jobs.py')})
