# Voice lines for NH48 — offline TTS → small mono MP3s in assets/voice/.
#   Kokoro-82M (Apache-2.0) Hindi voices hm_omega / hm_psi / hf_alpha / hf_beta, through kokoro-onnx
#   Piper mr_IN-google-medium (dataset: OpenSLR 64, CC BY-SA 4.0), speakers mr0..mr8
# usage: python3 tools/make_voices.py [only_id ...]
import json, os, re, subprocess, sys, tempfile
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = '/home/claude/assets_src/piper'
OUT = os.environ.get('NH_VOICE_OUT') or os.path.join(ROOT, 'assets', 'voice')
os.makedirs(OUT, exist_ok=True)
lines = {k: v for k, v in json.load(open(os.path.join(ROOT, 'src/game/lines.json'))).items() if not k.startswith('_')}
only = set(sys.argv[1:])

kok = None
# what a person says, not the punctuation: no quote marks, ellipses as pauses, "mm/hmm" as a real hum,
# dashes as commas, nothing a TTS would spell out letter by letter
def speakable(t):
    t = t.replace('\u2019', "'").replace('\u2018', "'")
    t = re.sub(r'[\u201c\u201d"\u00ab\u00bb]', '', t)
    t = re.sub(r'\.{2,}|\u2026', ', ', t)
    t = re.sub(r'\b[Mm]+[Hh]?[Mm]+\b|\b[Hh]m+\b', 'hmm', t)
    t = re.sub(r'\s*[\u2014\u2013-]{1,2}\s*', ', ', t)
    t = re.sub(r'[*_~#()\[\]{}<>|/\\]', ' ', t)
    t = re.sub(r'\s*,(\s*,)+', ',', t)
    t = re.sub(r'\s*,\s*([?!.])', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip(' ,')

def kokoro(text, voice, lang, path):
    text = speakable(text)
    # Kokoro has no retroflex l: espeak drops ळ entirely (वेळ came out "ve"), so read it as ल
    if lang in ('mr', 'hi'): text = text.replace('\u0933', '\u0932')
    global kok
    if kok is None:
        from kokoro_onnx import Kokoro
        kok = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'))
    try:
        s, sr = kok.create(text, voice=voice, speed=0.97, lang=lang)
    except Exception as e:
        print('  lang', lang, 'failed, using hi:', e)
        s, sr = kok.create(text, voice=voice, speed=1.05, lang='hi')
    sf.write(path, s, sr)

def piper(text, spk, path):
    subprocess.run([sys.executable, '-m', 'piper', '-m', os.path.join(MODELS, 'mr_IN-google-medium.onnx'), '-s', str(spk), '-f', path],
                   input=speakable(text).encode(), check=True, capture_output=True)

# passenger lines: male voices alternate between the two Kokoro men, female between Piper speakers
jobs = [(lid, voice, lang, tts) for lid, (who, voice, lang, tts, roman, en) in lines.items()]
rides = {k: v for k, v in json.load(open(os.path.join(ROOT, 'src/game/ride_lines.json'))).items() if not k.startswith('_')}
n = 0
for kind, arr in rides.items():
    for i, (male, female) in enumerate(arr):
        jobs.append((f'p_{kind}{i}_m', ['hm_omega', 'hm_psi'][n % 2], 'mr', male))
        jobs.append((f'p_{kind}{i}_f', ['mr0', 'mr3', 'mr5', 'mr8'][n % 4], 'mr', female or male))
        n += 1

# street people: one voice per persona, shaped for age (pitch / tempo)
street = json.load(open(os.path.join(ROOT, 'src/game/street_lines.json')))
shape = {}
for pid, P in street['_personas'].items():
    for sc, arr in street.get(pid, {}).items():
        for i, (deva, roman, en) in enumerate(arr):
            lid = f's_{pid}_{sc}{i}'
            jobs.append((lid, P['voice'], P['lang'], deva)); shape[lid] = (P['pitch'], P['tempo'])

# auto passengers: same persona voices
pax = json.load(open(os.path.join(ROOT, 'src/game/pax_lines.json')))
for pid, P in street['_personas'].items():
    for kind, arr in pax.get(pid, {}).items():
        for i, (deva, roman, en) in enumerate(arr):
            lid = f'q_{pid}_{kind}{i}'
            jobs.append((lid, P['voice'], P['lang'], deva)); shape[lid] = (P['pitch'], P['tempo'])

# shopkeepers: one voice per kind of shop
shopl = json.load(open(os.path.join(ROOT, 'src/game/shop_lines.json')))
for kind, (voice, lang, tempo) in shopl['_voice'].items():
    for sc, arr in shopl.get(kind, {}).items():
        for i, (deva, roman, en) in enumerate(arr):
            lid = f'k_{kind}_{sc}{i}'
            jobs.append((lid, voice, lang, deva)); shape[lid] = (1.0, tempo)

# people you talk to (clubs, dates): every line in a woman's and a man's voice, in the speaker's language;
# {woman|man} picks the gendered form
import re
def gform(t, f): return re.sub(r'\{([^{}|]*)\|([^{}|]*)\}', lambda m: m.group(1) if f else m.group(2), t)
# date lines: the first form is the real script (Devanagari for Hindi and Marathi), read in the speaker's
# own language; Marathi falls back to the Hindi phonemizer when the Piper Marathi model isn't installed
_MR = 'mr0' if os.path.exists(os.path.join(MODELS, 'mr_IN-google-medium.onnx')) else 'hf_alpha'
# Marathi through espeak's own Marathi rules (not Hindi's): v not ʋ, Marathi stress
DV = {'f': {'en': ('hf_beta', 'en-us', 1.0), 'hi': ('hf_beta', 'hi', 0.98), 'mr': (_MR, 'mr', 0.96)},
      'm': {'en': ('hm_psi', 'en-us', 1.0), 'hi': ('hm_omega', 'hi', 0.98), 'mr': ('hm_psi', 'mr', 0.96)}}
for lang in ('en', 'hi', 'mr'):
    dl = json.load(open(os.path.join(ROOT, f'src/game/date/{lang}.json')))
    for key, arr in dl.items():
        for i, row in enumerate(arr):
            for sx in ('f', 'm'):
                voice, vl, tempo = DV[sx][lang]
                text = gform(row[0] if isinstance(row, list) else row, sx == 'f')
                lid = f'd_{sx}_{lang}_{key}{i}'
                jobs.append((lid, voice, vl, text)); shape[lid] = (1.0, tempo)

# the character creator: what the new you says when you switch between a man and a woman
PK = {'pk_f0': 'Okay Pune. Let’s see what you’ve got.', 'pk_f1': 'Chal, the city’s waiting.', 'pk_f2': 'Yeah. This feels like me.', 'pk_f3': 'FC Road, here I come.',
      'pk_m0': 'Right. Let’s go, Pune.', 'pk_m1': 'Chal bhai, kaam pe chalte hain.', 'pk_m2': 'This one. Definitely this one.', 'pk_m3': 'Koregaon Park tonight? Let’s see.'}
for lid, text in PK.items():
    jobs.append((lid, 'hf_beta' if '_f' in lid else 'hm_omega', 'en-us', text)); shape[lid] = (1.0, 1.02)

def af_for(lid): return lid
for lid, voice, lang, tts in jobs:
    if only and lid not in only and not any(lid.startswith(o) for o in only): continue
    if os.path.exists(os.path.join(OUT, lid + '.mp3')) and not os.environ.get('FORCE'): continue
    tmp = tempfile.mktemp(suffix='.wav')
    if voice.startswith('mr') and _MR == 'mr0': piper(tts, int(voice[2:]), tmp)
    elif voice.startswith('mr'): kokoro(tts, ['hf_alpha', 'hf_beta'][int(voice[2:]) % 2], 'hi', tmp)
    else: kokoro(tts, voice, lang, tmp)
    out = os.path.join(OUT, lid + '.mp3')
    # trim silence at both ends, gentle compression + loudness so lines sit above the street noise
    pre = ''
    if lid in shape:
        p_, t_ = shape[lid]
        # pitch by resampling, then put the speed back (and apply the persona's tempo)
        sr = sf.info(tmp).samplerate
        pre = f'asetrate={sr}*{p_},aresample=24000,atempo={max(0.5, min(2.0, t_ / p_)):.4f},'
    af = (pre + 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,'
          'highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7,apad=pad_dur=0.08')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', af, '-ac', '1', '-ar', '24000', '-b:a', '48k', out], check=True)
    os.remove(tmp)
    print(lid, voice, os.path.getsize(out), 'bytes')
