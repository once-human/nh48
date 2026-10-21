# Voice lines for NH48 — offline TTS → small mono MP3s in assets/voice/.
#   Kokoro-82M (Apache-2.0) Hindi voices hm_omega / hm_psi / hf_alpha / hf_beta, through kokoro-onnx
#   Piper mr_IN-google-medium (dataset: OpenSLR 64, CC BY-SA 4.0), speakers mr0..mr8
# usage: python3 tools/make_voices.py [only_id ...]
import json, os, subprocess, sys, tempfile
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = '/home/claude/assets_src/piper'
OUT = os.path.join(ROOT, 'assets', 'voice')
os.makedirs(OUT, exist_ok=True)
lines = {k: v for k, v in json.load(open(os.path.join(ROOT, 'src/game/lines.json'))).items() if not k.startswith('_')}
only = set(sys.argv[1:])

kok = None
def kokoro(text, voice, lang, path):
    global kok
    if kok is None:
        from kokoro_onnx import Kokoro
        kok = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'))
    try:
        s, sr = kok.create(text, voice=voice, speed=1.05, lang=lang)
    except Exception as e:
        print('  lang', lang, 'failed, using hi:', e)
        s, sr = kok.create(text, voice=voice, speed=1.05, lang='hi')
    sf.write(path, s, sr)

def piper(text, spk, path):
    subprocess.run([sys.executable, '-m', 'piper', '-m', os.path.join(MODELS, 'mr_IN-google-medium.onnx'), '-s', str(spk), '-f', path],
                   input=text.encode(), check=True, capture_output=True)

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

def af_for(lid): return lid
for lid, voice, lang, tts in jobs:
    if only and lid not in only and not any(lid.startswith(o) for o in only): continue
    tmp = tempfile.mktemp(suffix='.wav')
    if voice.startswith('mr'): piper(tts, int(voice[2:]), tmp)
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
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-af', af, '-ac', '1', '-ar', '24000', '-b:a', '32k', out], check=True)
    os.remove(tmp)
    print(lid, voice, os.path.getsize(out), 'bytes')
