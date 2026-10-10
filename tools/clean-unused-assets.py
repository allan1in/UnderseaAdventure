"""Prune obsolete assets using UUID dependencies; theme source artwork is untouched."""
import json
import re
import sys
from pathlib import Path

project = Path(__file__).resolve().parents[1]
assets = project / 'assets'
uuid_pattern = re.compile(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}')
files = [p for p in assets.rglob('*') if p.is_file() and p.suffix != '.meta']
metas = {}
lookup = {}
for p in files:
    meta = Path(str(p) + '.meta')
    if meta.exists():
        metas[p] = meta.read_text(encoding='utf-8-sig')
        data = json.loads(metas[p])
        lookup[data['uuid']] = p

legacy = ('hero/theme-animations/', 'hero/spine-walk/', 'hero/final/',
          'hero/hero-attack-01/', 'hero/hero-attack-02/', 'hero/hero-stage-02/',
          'hero/hero-stage-03/', 'boss/dragon-01/', 'boss/dragon-02/',
          'boss/ui/', 'boss/warning/', 'magic-lamp/', 'pets/partner-')
roots = {p for p in files if p.suffix in ('.scene', '.prefab', '.ts')}
for p in files:
    rel = p.relative_to(assets).as_posix()
    if rel.startswith('resources/gameplay/') and not rel[len('resources/gameplay/'):].startswith(legacy):
        roots.add(p)
# Loading-screen authoring still uses these source portraits.
roots.add(assets / 'textures/characters/sea-hero/animations/stage-01/idle/idle-01.png')
visited = set()
pending = list(roots)
while pending:
    p = pending.pop()
    if p in visited or not p.exists():
        continue
    visited.add(p)
    source = metas.get(p, '')
    if p.suffix in ('.scene', '.prefab', '.anim', '.json', '.atlas', '.ts'):
        source += p.read_text(encoding='utf-8-sig')
    pending.extend(lookup[u] for u in uuid_pattern.findall(source) if u in lookup and lookup[u] not in visited)
    # Spine atlas texture pages are local file dependencies too.
    if p.suffix == '.atlas':
        pending.extend(p.parent / line.strip() for line in source.splitlines() if line.strip().endswith(('.png', '.jpg')))

eligible = {'.png', '.jpg', '.jpeg', '.webp', '.anim', '.json', '.atlas', '.mp3', '.wav', '.ogg'}
unused = [p for p in files if p not in visited and p.suffix in eligible]
report = {'count': len(unused), 'bytes': sum(p.stat().st_size for p in unused),
          'files': [p.relative_to(project).as_posix() for p in unused]}
out = project / 'temp/asset-cleanup-report.json'
out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'files'}))
if '--apply' in sys.argv:
    for p in unused:
        assert p.resolve().is_relative_to(assets.resolve())
        p.unlink()
        Path(str(p) + '.meta').unlink(missing_ok=True)
    for p in sorted(assets.rglob('*'), key=lambda x: len(x.parts), reverse=True):
        if p.is_dir() and not any(p.iterdir()):
            assert p.resolve().is_relative_to(assets.resolve())
            p.rmdir()
            Path(str(p) + '.meta').unlink(missing_ok=True)
    print('Unused assets and matching metadata removed.')
