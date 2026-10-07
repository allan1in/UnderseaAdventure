"""Create a lossless, smaller HTML deployment; never modify source art or original build."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
import io
import json
import shutil
import subprocess
import sys

project = Path(__file__).resolve().parents[1]
source = project / 'build/web-mobile'
optimized = project / 'temp/vercel-web-mobile'
destination = project / 'build/vercel'
shutil.copytree(source, optimized, dirs_exist_ok=True)
destination.mkdir(parents=True, exist_ok=True)

def convert(file):
    original = file.read_bytes()
    with Image.open(io.BytesIO(original)) as image:
        rgba = image.convert('RGBA')
        output = io.BytesIO()
        rgba.save(output, format='WEBP', lossless=True, exact=True, method=4)
        data = output.getvalue()
        if len(data) >= len(original):
            return 0
        with Image.open(io.BytesIO(data)) as decoded:
            # WebP may discard invisible RGB, but every visible pixel must match exactly.
            a, b = rgba.tobytes(), decoded.convert('RGBA').tobytes()
            assert all(a[i+3] == b[i+3] and (a[i+3] == 0 or a[i:i+3] == b[i:i+3])
                       for i in range(0, len(a), 4)), str(file)
        file.write_bytes(data)
        return len(original) - len(data)

files = list(optimized.rglob('*.png'))
saved = 0
with ThreadPoolExecutor(max_workers=4) as pool:
    for i, savings in enumerate(pool.map(convert, files), 1):
        saved += savings
        if i % 100 == 0:
            print(f'Lossless images {i}/{len(files)}; saved {saved/1048576:.1f} MiB', flush=True)
node = sys.argv[1] if len(sys.argv) > 1 else 'node'
subprocess.run([node, str(project/'tools/pack-single-html.cjs'), str(optimized), str(destination/'index.html')], check=True)
shutil.copy2(project/'tools/vercel-static.json', destination/'vercel.json')
print(json.dumps({'file': str(destination/'index.html'), 'bytes': (destination/'index.html').stat().st_size,
                  'losslessImageSavings': saved}), flush=True)
