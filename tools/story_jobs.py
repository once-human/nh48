# The story's lines (src/game/part1.js) as voice jobs for Indic Parler-TTS, each with who says it and how.
# Ids are 'st_<who>_<hash of the text>' (the same hash the game computes, story.js voiceId), so a line's clip
# follows the line wherever it moves. Lines in romanised Hindi / Marathi stay subtitles (the TTS reads scripts).
# Run: python3 tools/story_jobs.py   (appends to tools/voice_jobs.json and writes tools/voice_jobs_story.json)
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'src/game/part1.js')).read()
Q = r"'((?:[^'\\]|\\.)*)'"
def fnv(t):
    h = 0x811c9dc5
    b = t.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8); h = (h * 0x01000193) & 0xffffffff
    return format(h, '08x')
lines = []   # (who, text, en)
for m in re.finditer(r"\[\s*'(\w+)',\s*" + Q + r",\s*" + Q + r"\s*\]", src): lines.append((m[1], m[2], m[3]))
for m in re.finditer(r"S\.text\('(\w+)',\s*" + Q + r",\s*" + Q, src): lines.append((m[1], m[2], m[3]))
for m in re.finditer(r"\bL\('(\w+)',\s*" + Q + r",\s*" + Q + r",\s*" + Q + r"\)", src):
    w = m[1]
    if w == 'you': lines += [('youm', m[2], m[4]), ('youf', m[3], m[4])]
    else: lines += [(w, m[2], m[4]), (w, m[3], m[4])]
for f, a, b in (('r1', 'khushi', 'kunal'), ('r2', 'tara', 'veer')):
    for m in re.finditer(r"\b" + f + r"\(" + Q + r",\s*" + Q + r",\s*" + Q + r"\)", src): lines += [(a, m[1], m[3]), (b, m[2], m[3])]
for k, a, b in (('R1', 'khushi', 'kunal'), ('R2', 'tara', 'veer')):
    for m in re.finditer(r"\[" + k + r"\(\),\s*fem\(\)\s*\?\s*" + Q + r"\s*:\s*" + Q + r",\s*" + Q, src): lines += [(b, m[1], m[3]), (a, m[2], m[3])]
    for m in re.finditer(r"\[" + k + r"\(\),\s*" + Q + r",\s*" + Q, src): lines += [(a, m[1], m[2]), (b, m[1], m[2])]
# who sounds like what (Parler's named voices; Marathi: Sanjay, Nikhil, Varun, Sunita, Radha, Isha; English: Priya, Kabir…)
CAST = {
    'aai': ('Sunita', 'warm, a little tired, a retired Marathi teacher who loves through sarcasm', 'moderate'),
    'bapu': ('Sanjay', 'an old auto-stand boss, gruff and amused', 'slow'),
    'bhau': ('Sanjay', 'a mandal president, an old-school don: low, unhurried, dangerous when polite', 'slow'),
    'shinde': ('Sunita', 'a police ACP, clipped and firm, giving nothing away', 'brisk'),
    'khushi': ('Radha', 'a young UX designer, warm, quick, teasing', 'fast'),
    'tara': ('Isha', 'a young woman from a rich family, sharp, funny and a little wild', 'fast'),
    'kunal': ('Nikhil', 'a young UX designer, warm, quick, teasing', 'fast'),
    'veer': ('Varun', 'a young man from a rich family, sharp, funny and a little wild', 'fast'),
    'kabir': ('Varun', 'a guilty co-founder, tired and desperate, trying to sound in control', 'moderate'),
    'warkari': ('Sanjay', 'an old pilgrim on the Wari, gentle and certain', 'slow'),
    'youm': ('Nikhil', 'a young man back home after everything fell apart, quiet, stubborn', 'moderate'),
    'youf': ('Isha', 'a young woman back home after everything fell apart, quiet, stubborn', 'moderate'),
    'mem': ('Varun', 'narrating a memory, hushed and slow, as if remembering', 'slow'),
    'ira': ('Priya', 'a crime YouTuber, fast, confident, a little reckless', 'fast'),
    'tj': ('Nikhil', 'a delivery rider, loud and loyal', 'fast'),
}
FEEL = [(r'[!?]{1}.*[!]|!$', 'with energy, voice raised'), (r'\?$', 'questioning'), (r'…', 'hesitantly, with pauses')]
out, seen = [], set()
for who, text, en in lines:
    if who not in CAST or who == 'unk': continue
    deva = bool(re.search('[ऀ-ॿ]', text))
    lang = 'mr' if deva else 'en' if who == 'ira' and re.match(r'^[\x00-’ ]+$', text) else None
    if not lang: continue                                 # romanised Hindi / Marathi: subtitles only
    id_ = f'st_{who}_{fnv(text)}'
    if id_ in seen: continue
    seen.add(id_)
    spk, who_desc, pace = CAST[who]
    if lang == 'en' and spk not in ('Priya', 'Kabir', 'Riya', 'Mary', 'Thoma', 'Tarun', 'Raghav', 'Gauri'): spk = 'Priya'
    feel = next((f for p, f in FEEL if re.search(p, text)), 'naturally, like talking to someone right in front of them')
    ctx = en.replace('"', '')[:140]
    out.append({'id': id_, 'lang': lang, 'speaker': spk, 'text': text,
                'desc': f"{spk} speaks {feel}, at a {pace} pace: {who_desc}. The line means: \"{ctx}\". Expressive and natural, acted, not read aloud. The recording is of very high quality, with the voice sounding clear and very close up, almost no background noise."})
json.dump(out, open(os.path.join(ROOT, 'tools/voice_jobs_story.json'), 'w'), ensure_ascii=False, indent=0)
jobs = json.load(open(os.path.join(ROOT, 'tools/voice_jobs.json')))
jobs = [j for j in jobs if not j['id'].startswith('st_')] + out
json.dump(jobs, open(os.path.join(ROOT, 'tools/voice_jobs.json'), 'w'), ensure_ascii=False, indent=0)
print(len(out), 'story lines;', len(jobs), 'jobs in all')
