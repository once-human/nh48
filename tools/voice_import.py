# Put the voices from tools/puneri_voices.ipynb into the game: python3 tools/voice_import.py puneri_voices.zip
# Each mp3 replaces the old clip with the same id (lines the notebook skipped keep their old voice).
import os, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dst = os.path.join(ROOT, 'assets', 'voice')
n = 0
with zipfile.ZipFile(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'puneri_voices.zip')) as z:
    for name in z.namelist():
        base = os.path.basename(name)
        if not base.endswith('.mp3') or base.startswith('ghost_'): continue      # the recorded ghost stays
        with z.open(name) as f, open(os.path.join(dst, base), 'wb') as o: o.write(f.read()); n += 1
print(n, 'voices in', dst, '· now build: node tools/build.mjs')
